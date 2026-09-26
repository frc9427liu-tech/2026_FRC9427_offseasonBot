// Spectator stands on the audience side (far from the scoring table), filled with animated people.
// Each spectator has their own skin tone, hair colour and outfit colours (shader recolouring of the shared Mixamo rigs)
// and belongs to a side: fans react together (setMood) when their alliance scores or wins.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { FIELD_L, FIELD_W } from './field.js';
import { buildBowl } from './stands.js';

const L = FIELD_L * 0.0254;
const W = FIELD_W * 0.0254;
const CHARS = ['remy', 'p21', 'p22', 'p23'];
const CLIPS = { idle: 'a_sit_idle', clap: 'a_sit_clap', cheer: 'a_sit_cheer' };

// mulberry32: same crowd on every load
function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Skin tone multipliers (relative to the light textures), hair colours, and outfit palettes.
const SKIN = [[1, 1, 1], [0.93, 0.82, 0.72], [0.85, 0.66, 0.5], [0.66, 0.46, 0.33], [0.46, 0.3, 0.21], [0.36, 0.23, 0.16]];
const HAIR = [[0.05, 0.04, 0.04], [0.16, 0.1, 0.06], [0.32, 0.2, 0.1], [0.62, 0.45, 0.2], [0.78, 0.62, 0.34], [0.55, 0.55, 0.57], [0.45, 0.16, 0.08], [0.85, 0.85, 0.85]];
const CASUAL = [[0.85, 0.85, 0.85], [0.1, 0.1, 0.12], [0.2, 0.42, 0.28], [0.85, 0.7, 0.2], [0.5, 0.2, 0.55], [0.85, 0.5, 0.15], [0.15, 0.55, 0.6], [0.55, 0.36, 0.22], [0.3, 0.3, 0.35]];
const JEANS = [[0.16, 0.24, 0.42], [0.1, 0.1, 0.12], [0.5, 0.42, 0.32], [0.28, 0.3, 0.34], [0.22, 0.34, 0.5], [0.36, 0.28, 0.2]];
const BLUE = [[0.14, 0.4, 0.95], [0.1, 0.25, 0.7], [0.85, 0.9, 1]];
const RED = [[0.92, 0.16, 0.2], [0.65, 0.1, 0.14], [1, 0.9, 0.9]];

const pick = (r, a) => a[Math.floor(r() * a.length)];

// Recolour a cloned material per spectator. Uniforms live on the material so no per-instance draw setup is needed.
function personalize(mat, look, hipsY) {
  const m = mat.clone();
  const isHair = /hair/i.test(m.name);
  const isLash = /lash|eye/i.test(m.name);
  if (isLash) return m;
  const u = {
    uSkin: { value: new THREE.Vector3(...look.skin) },
    uHair: { value: new THREE.Vector3(...look.hair) },
    uShirt: { value: new THREE.Vector3(...look.shirt) },
    uPants: { value: new THREE.Vector3(...look.pants) },
    uShirtAmt: { value: look.shirtAmt },
    uPantsAmt: { value: look.pantsAmt },
    uHips: { value: hipsY },
    uIsHair: { value: isHair ? 1 : 0 },
  };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vRelY;\nuniform float uHips;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRelY = position.y / uHips;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying float vRelY;
uniform vec3 uSkin, uHair, uShirt, uPants; uniform float uShirtAmt, uPantsAmt, uIsHair;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
{
  vec3 c = diffuseColor.rgb;
  float lum = dot(c, vec3(0.3, 0.59, 0.11));
  if (uIsHair > 0.5) {
    diffuseColor.rgb = uHair * (0.35 + lum * 1.9);
  } else {
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
    if (skin) {
      diffuseColor.rgb = c * uSkin;
    } else if (vRelY > 0.98 && vRelY < 1.85) {
      diffuseColor.rgb = mix(c, uShirt * (lum * 1.55 + 0.1), uShirtAmt);
    } else if (vRelY > 0.14 && vRelY <= 0.98) {
      diffuseColor.rgb = mix(c, uPants * (lum * 1.5 + 0.1), uPantsAmt);
    }
  }
}`);
  };
  m.customProgramCacheKey = () => 'crowd-person';
  return m;
}

function buildStands(rows, rowDepth, rise, z0) {
  const g = new THREE.Group();
  const deck = new THREE.MeshStandardMaterial({ color: 0x1a1f28, roughness: 0.85 });
  const bench = new THREE.MeshStandardMaterial({ color: 0x2b323d, roughness: 0.6, metalness: 0.3 });
  const w = L + 6;
  for (let r = 0; r < rows; r++) {
    const h = rise * (r + 1);
    const step = new THREE.Mesh(new THREE.BoxGeometry(w, h, rowDepth), deck);
    step.position.set(L / 2, h / 2, -(z0 + r * rowDepth + rowDepth / 2));
    step.receiveShadow = true;
    g.add(step);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, 0.42), bench);
    seat.position.set(L / 2, h + 0.42, -(z0 + r * rowDepth + rowDepth * 0.55));
    g.add(seat);
  }
  return { group: g, rowTop: (r) => rise * (r + 1) };
}

export async function buildCrowd({ occupancy = 0.3, seed = 7 } = {}) {
  const group = new THREE.Group();
  const bowl = buildBowl({ rows: 6, rowDepth: 1.0, rise: 0.4, margin: 3.4 });
  group.add(bowl.group);

  const loader = new GLTFLoader();
  const load = (f) => loader.loadAsync(`./crowd/${f}.glb`);
  const [chars, clipSrc] = await Promise.all([
    Promise.all(CHARS.map(load)),
    Promise.all(Object.values(CLIPS).map(load)),
  ]);
  const clips = Object.keys(CLIPS).map((k, i) => {
    const c = clipSrc[i].animations[0];
    c.name = k;
    return c;
  });

  // Per character type: bone-name prefix (GLTFLoader strips ':' so mixamorig / mixamorig2) and rig scale relative to the clips.
  const ANIM_HIPS = 0.95;
  const types = chars.map((g) => {
    let prefix = 'mixamorig', hipsY = ANIM_HIPS;
    g.scene.traverse((o) => {
      const m = /^(mixamorig\d*)Hips$/.exec(o.name);
      if (m) { prefix = m[1]; hipsY = o.position.y; }
    });
    const k = hipsY / ANIM_HIPS;
    const cs = {};
    Object.keys(CLIPS).forEach((name, i) => {
      const cl = clips[i].clone();
      cl.tracks = cl.tracks.map((t) => {
        const nt = t.clone();
        nt.name = nt.name.replace(/^mixamorig\d*/, prefix);
        if (nt.name.endsWith('.position')) nt.values = nt.values.map((v) => v * k);
        return nt;
      });
      cs[name] = cl;
    });
    return { scene: g.scene, k, hipsY, clips: cs };
  });

  const rand = rng(seed);
  const people = [];
  {
    for (const seat of bowl.seats) {
      if (rand() > occupancy) continue; // empty seats
      const type = types[Math.floor(rand() * types.length)];
      const person = SkeletonUtils.clone(type.scene);
      const x = seat.x;
      const side = x < L / 2 ? 'blue' : 'red';
      const fan = rand() < 0.55; // wearing alliance colours
      const team = side === 'blue' ? BLUE : RED;
      const look = {
        skin: pick(rand, SKIN), hair: pick(rand, HAIR),
        shirt: fan ? pick(rand, team) : pick(rand, CASUAL),
        pants: pick(rand, JEANS),
        shirtAmt: fan ? 0.9 : 0.55 + rand() * 0.4,
        pantsAmt: 0.55 + rand() * 0.4,
      };
      person.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = false; o.receiveShadow = false;
        o.material = Array.isArray(o.material) ? o.material.map((m) => personalize(m, look, type.hipsY)) : personalize(o.material, look, type.hipsY);
      });
      const holder = new THREE.Group();
      holder.add(person);
      holder.position.set(x, seat.y + 0.02, seat.z);
      holder.scale.setScalar((0.96 + rand() * 0.08) / type.k);
      holder.lookAt(x + seat.fx, holder.position.y, seat.z + seat.fz); // face the field, like the chair
      const mixer = new THREE.AnimationMixer(person);
      const actions = {};
      for (const name of Object.keys(CLIPS)) actions[name] = mixer.clipAction(type.clips[name]);
      const p = { mixer, actions, side, current: 'idle', pending: null, lag: rand() * 0.9 };
      actions.idle.time = rand() * actions.idle.getClip().duration;
      actions.idle.setEffectiveWeight(1).play();
      for (const n of ['clap', 'cheer']) { actions[n].setEffectiveWeight(0).play(); actions[n].time = rand() * actions[n].getClip().duration; }
      mixer.timeScale = 0.9 + rand() * 0.2;
      people.push(p);
      group.add(holder);
    }
  }

  const fade = (p, to) => {
    if (to === p.current) return;
    const a = p.actions[to], b = p.actions[p.current];
    a.setEffectiveWeight(1);
    a.crossFadeFrom(b, 0.6, false);
    p.current = to;
  };

  let frame = 0, acc = 0;
  const timers = []; // { t, side, mood }
  const api = {
    group,
    count: people.length,
    // side: 'blue' | 'red' | 'both'; mood: 'idle' | 'clap' | 'cheer'. Each fan reacts after a small personal lag.
    setMood(side, mood) {
      for (const p of people) if (side === 'both' || p.side === side) p.pending = { to: mood, t: p.lag };
    },
    // Hold a mood for `seconds`, then relax back to idle.
    react(side, mood, seconds) {
      api.setMood(side, mood);
      timers.push({ t: seconds, side });
    },
    update(dt) {
      acc += dt;
      frame++;
      for (const tm of timers) tm.t -= dt;
      for (let i = timers.length - 1; i >= 0; i--) if (timers[i].t <= 0) { api.setMood(timers[i].side, 'idle'); timers.splice(i, 1); }
      for (const p of people) {
        if (p.pending) {
          p.pending.t -= dt;
          if (p.pending.t <= 0) { fade(p, p.pending.to); p.pending = null; }
        }
      }
      for (let i = frame % 4; i < people.length; i += 4) people[i].mixer.update(acc);
      if (frame % 4 === 3) acc = 0;
    },
  };
  return api;
}
