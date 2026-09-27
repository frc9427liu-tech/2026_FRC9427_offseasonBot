// AprilTags on the field (layout in tagdata.js).
import * as THREE from 'three';
import { TAGS } from './tagdata.js';

const IN = 0.0254;

export { TAGS };

export function buildTags(base = './tags/') {
  const group = new THREE.Group();
  const loader = new THREE.TextureLoader();
  const size = 8.125 * 10 / 8 * IN; // image includes a 1-cell white margin around the 8-cell tag
  for (const [id, x, y, z, rot] of TAGS) {
    const tex = loader.load(`${base}${id}.png`);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: tex }));
    const r = THREE.MathUtils.degToRad(rot);
    const nx = Math.cos(r), nz = -Math.sin(r); // field +Y is three -Z
    m.position.set(x * IN + nx * 0.004, z * IN, -y * IN + nz * 0.004);
    m.rotation.y = Math.atan2(nx, nz);
    m.userData.tagId = id;
    group.add(m);
  }
  return group;
}
