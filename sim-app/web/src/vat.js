// Vertex-animation-texture crowd rendering.
// bakeType(): plays a rigged character through its clips once, samples the skinned vertices into two textures
// (positions as half floats, normals as bytes) and merges all sub-meshes into one geometry. The crowd is then a
// single InstancedMesh per character type: one draw call, no per-frame skeleton work, per-instance recolouring.
import * as THREE from 'three';

const TEX_W = 2048; // texture row length (power of two so the shader can use bit ops)

export function bakeType(scene, clips, fps = 12) {
  scene.updateMatrixWorld(true);
  const meshes = [];
  scene.traverse((o) => { if (o.isSkinnedMesh) meshes.push(o); });

  // ---- merge geometry (bind pose in scene space) ----
  let V = 0;
  for (const m of meshes) V += m.geometry.attributes.position.count;
  const bindPos = new Float32Array(V * 3), bindNor = new Float32Array(V * 3), uv = new Float32Array(V * 2);
  const localPos = new Float32Array(V * 3), localNor = new Float32Array(V * 3); // mesh-local bind data (what skinning expects)
  const vid = new Float32Array(V), role = new Float32Array(V), texId = new Float32Array(V), alphaF = new Float32Array(V);
  const skinIdx = new Uint16Array(V * 4), skinW = new Float32Array(V * 4), meshOf = new Uint8Array(V);
  const index = [];
  const textures = [];
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  let off = 0;
  meshes.forEach((m, mi) => {
    const g = m.geometry, mat = m.material;
    const cnt = g.attributes.position.count;
    const name = (mat.name || '') + ' ' + (m.name || '');
    const r = /hair/i.test(name) ? 1 : /lash|eye/i.test(name) ? 2 : 0;
    const hasAlpha = r !== 0 || mat.transparent || mat.alphaTest > 0;
    let ti = textures.indexOf(mat.map);
    if (ti < 0) { textures.push(mat.map); ti = textures.length - 1; }
    const normalMat = new THREE.Matrix3().getNormalMatrix(m.matrixWorld);
    for (let i = 0; i < cnt; i++) {
      const k = off + i;
      p.fromBufferAttribute(g.attributes.position, i).applyMatrix4(m.matrixWorld);
      n.fromBufferAttribute(g.attributes.normal, i).applyMatrix3(normalMat).normalize();
      localPos[k * 3] = g.attributes.position.getX(i); localPos[k * 3 + 1] = g.attributes.position.getY(i); localPos[k * 3 + 2] = g.attributes.position.getZ(i);
      localNor[k * 3] = g.attributes.normal.getX(i); localNor[k * 3 + 1] = g.attributes.normal.getY(i); localNor[k * 3 + 2] = g.attributes.normal.getZ(i);
      bindPos.set([p.x, p.y, p.z], k * 3);
      bindNor.set([n.x, n.y, n.z], k * 3);
      uv[k * 2] = g.attributes.uv.getX(i); uv[k * 2 + 1] = g.attributes.uv.getY(i);
      vid[k] = k; role[k] = r; texId[k] = ti; alphaF[k] = hasAlpha ? 1 : 0; meshOf[k] = mi;
      for (let c = 0; c < 4; c++) {
        skinIdx[k * 4 + c] = g.attributes.skinIndex.getComponent(i, c);
        skinW[k * 4 + c] = g.attributes.skinWeight.getComponent(i, c);
      }
    }
    const idx = g.index;
    for (let i = 0; i < idx.count; i++) index.push(idx.getX(i) + off);
    off += cnt;
  });

  // ---- clip table ----
  const clipInfo = {};
  let F = 0;
  for (const [name, clip] of Object.entries(clips)) {
    const frames = Math.max(2, Math.ceil(clip.duration * fps));
    clipInfo[name] = { start: F, frames, dur: clip.duration };
    F += frames;
  }
  const rpf = Math.ceil(V / TEX_W);
  const height = F * rpf;
  const posData = new Uint16Array(TEX_W * height * 4);
  const norData = new Uint8Array(TEX_W * height * 4);
  const half = THREE.DataUtils.toHalfFloat;

  // ---- bake ----
  const root = scene;
  const mixer = new THREE.AnimationMixer(root);
  const C = meshes.map(() => null);
  const M = new THREE.Matrix4(), tmp = new THREE.Matrix4();
  for (const [name, clip] of Object.entries(clips)) {
    const info = clipInfo[name];
    mixer.stopAllAction();
    const action = mixer.clipAction(clip);
    action.play();
    for (let f = 0; f < info.frames; f++) {
      mixer.setTime((f / info.frames) * info.dur);
      root.updateMatrixWorld(true);
      meshes.forEach((m, mi) => {
        m.skeleton.update();
        const bones = m.skeleton.bones.length;
        const arr = new Float32Array(bones * 16);
        for (let b = 0; b < bones; b++) {
          // full transform for bone b: meshWorld * bindInverse * boneMatrix * bind
          tmp.fromArray(m.skeleton.boneMatrices, b * 16);
          M.copy(m.matrixWorld).multiply(m.bindMatrixInverse).multiply(tmp).multiply(m.bindMatrix);
          M.toArray(arr, b * 16);
        }
        C[mi] = arr;
      });
      const base = (info.start + f) * rpf * TEX_W;
      for (let k = 0; k < V; k++) {
        const arr = C[meshOf[k]];
        const px = localPos[k * 3], py = localPos[k * 3 + 1], pz = localPos[k * 3 + 2];
        let x = 0, y = 0, z = 0, nx = 0, ny = 0, nz = 0;
        for (let c = 0; c < 4; c++) {
          const w = skinW[k * 4 + c];
          if (w === 0) continue;
          const o = skinIdx[k * 4 + c] * 16;
          x += w * (arr[o] * px + arr[o + 4] * py + arr[o + 8] * pz + arr[o + 12]);
          y += w * (arr[o + 1] * px + arr[o + 5] * py + arr[o + 9] * pz + arr[o + 13]);
          z += w * (arr[o + 2] * px + arr[o + 6] * py + arr[o + 10] * pz + arr[o + 14]);
          const bx = localNor[k * 3], by = localNor[k * 3 + 1], bz = localNor[k * 3 + 2];
          nx += w * (arr[o] * bx + arr[o + 4] * by + arr[o + 8] * bz);
          ny += w * (arr[o + 1] * bx + arr[o + 5] * by + arr[o + 9] * bz);
          nz += w * (arr[o + 2] * bx + arr[o + 6] * by + arr[o + 10] * bz);
        }
        const nl = Math.hypot(nx, ny, nz) || 1;
        const t = (base + k) * 4;
        posData[t] = half(x); posData[t + 1] = half(y); posData[t + 2] = half(z); posData[t + 3] = half(1);
        norData[t] = Math.round((nx / nl * 0.5 + 0.5) * 255);
        norData[t + 1] = Math.round((ny / nl * 0.5 + 0.5) * 255);
        norData[t + 2] = Math.round((nz / nl * 0.5 + 0.5) * 255);
        norData[t + 3] = 255;
      }
    }
    action.stop();
  }
  const posTex = new THREE.DataTexture(posData, TEX_W, height, THREE.RGBAFormat, THREE.HalfFloatType);
  const norTex = new THREE.DataTexture(norData, TEX_W, height, THREE.RGBAFormat, THREE.UnsignedByteType);
  for (const t of [posTex, norTex]) {
    t.minFilter = t.magFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.needsUpdate = true;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(bindPos, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(bindNor, 3));
  geometry.setAttribute('aUv', new THREE.BufferAttribute(uv, 2));
  const tag = new Float32Array(V * 4);
  for (let k = 0; k < V; k++) { tag[k * 4] = vid[k]; tag[k * 4 + 1] = role[k]; tag[k * 4 + 2] = texId[k]; tag[k * 4 + 3] = alphaF[k]; }
  geometry.setAttribute('aTag', new THREE.BufferAttribute(tag, 4)); // vertex id, role, texture slot, alpha flag (packed: GPUs allow 16 attributes)
  geometry.setIndex(index);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 3);

  return { geometry, textures, posTex, norTex, rpf, clipInfo, vertexCount: V };
}

const DUMMY = (() => { const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); t.needsUpdate = true; return t; })();

export function makeMaterial(baked, hipsY, timeUniform) {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.82, metalness: 0 });
  const texUniforms = {};
  for (let i = 0; i < 6; i++) texUniforms[`uTex${i}`] = { value: baked.textures[i] || DUMMY };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, {
      uPosTex: { value: baked.posTex }, uNorTex: { value: baked.norTex },
      uTime: timeUniform, uRPF: { value: baked.rpf }, uHips: { value: hipsY }, ...texUniforms,
    });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
uniform highp sampler2D uPosTex; uniform highp sampler2D uNorTex; uniform float uTime; uniform int uRPF; uniform float uHips;
attribute vec2 aUv; attribute vec4 aTag;
attribute vec4 aCur, aPrev; attribute vec2 aSS;
attribute vec4 aSkinA, aHairA; attribute vec3 aShirt, aPants;
varying vec2 vCUv; varying vec4 vCTag; varying vec4 vCSkin, vCHair, vCShirt, vCPants;
ivec2 vatTexel(float frame, float vid) { int idx = int(frame) * uRPF * 2048 + int(vid); return ivec2(idx & 2047, idx >> 11); }
float vatFrame(vec4 c, out float f1, out float w) {
  float f = fract((uTime * aSS.x + c.w) / c.z) * c.y; float f0 = floor(f);
  f1 = mod(f0 + 1.0, c.y); w = f - f0; return f0;
}
void vatSample(vec4 c, out vec3 P, out vec3 N) {
  float f1, w; float f0 = vatFrame(c, f1, w);
  vec3 pa = texelFetch(uPosTex, vatTexel(c.x + f0, aTag.x), 0).xyz;
  vec3 pb = texelFetch(uPosTex, vatTexel(c.x + f1, aTag.x), 0).xyz;
  vec3 na = texelFetch(uNorTex, vatTexel(c.x + f0, aTag.x), 0).xyz * 2.0 - 1.0;
  vec3 nb = texelFetch(uNorTex, vatTexel(c.x + f1, aTag.x), 0).xyz * 2.0 - 1.0;
  P = mix(pa, pb, w); N = mix(na, nb, w);
}`)
      .replace('#include <beginnormal_vertex>', `
vec3 bakedP, bakedN;
{
  vec3 P1, N1; vatSample(aCur, P1, N1);
  float bl = clamp((uTime - aSS.y) / 0.6, 0.0, 1.0);
  if (bl < 1.0) { vec3 P0, N0; vatSample(aPrev, P0, N0); bl = bl * bl * (3.0 - 2.0 * bl); P1 = mix(P0, P1, bl); N1 = mix(N0, N1, bl); }
  bakedP = P1; bakedN = normalize(N1);
}
vec3 objectNormal = bakedN;`)
      .replace('#include <begin_vertex>', `vec3 transformed = bakedP;
vCUv = aUv; vCTag = vec4(aTag.y, aTag.z, aTag.w, position.y / uHips);
vCSkin = aSkinA; vCHair = aHairA; vCShirt = vec4(aShirt, 0.0); vCPants = vec4(aPants, 0.0);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D uTex0, uTex1, uTex2, uTex3, uTex4, uTex5;
varying vec2 vCUv; varying vec4 vCTag, vCSkin, vCHair, vCShirt, vCPants;`)
      .replace('#include <map_fragment>', `
{
  int ti = int(vCTag.y + 0.5);
  vec4 tc = ti == 0 ? texture2D(uTex0, vCUv) : ti == 1 ? texture2D(uTex1, vCUv) : ti == 2 ? texture2D(uTex2, vCUv)
          : ti == 3 ? texture2D(uTex3, vCUv) : ti == 4 ? texture2D(uTex4, vCUv) : texture2D(uTex5, vCUv);
  if (vCTag.z > 0.5 && tc.a < 0.5) discard;
  vec3 c = tc.rgb;
  float lum = dot(c, vec3(0.3, 0.59, 0.11));
  float role = vCTag.x;
  if (role > 0.5 && role < 1.5) {
    c = vCHair.rgb * (0.35 + lum * 1.9);
  } else if (role < 0.5) {
    float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b)), d = mx - mn;
    float h = 0.0;
    if (d > 0.001) {
      if (mx == c.r) h = mod((c.g - c.b) / d, 6.0);
      else if (mx == c.g) h = (c.b - c.r) / d + 2.0;
      else h = (c.r - c.g) / d + 4.0;
      h /= 6.0;
    }
    float s = mx > 0.001 ? d / mx : 0.0;
    bool skin = (h < 0.1 || h > 0.96) && s > 0.16 && s < 0.78 && mx > 0.22;
    float ry = vCTag.w;
    if (skin) c = c * vCSkin.rgb;
    else if (ry > 0.98 && ry < 1.85) c = mix(c, vCShirt.rgb * (lum * 1.55 + 0.1), vCSkin.w);
    else if (ry > 0.14 && ry <= 0.98) c = mix(c, vCPants.rgb * (lum * 1.5 + 0.1), vCHair.w);
  }
  diffuseColor.rgb *= c;
}`);
  };
  mat.customProgramCacheKey = () => 'vat-crowd';
  return mat;
}
