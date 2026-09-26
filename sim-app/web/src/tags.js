// Official 2026 AprilTag layout (tag36h11, 8.125 in). Source: FE-2026 field drawing sheet 11.
// [id, x, y, z, rotZ deg] in field inches; rot 0 faces the Red wall (+X), 90 faces +Y, 180 faces the Blue wall.
import * as THREE from 'three';

const IN = 0.0254;

export const TAGS = [
  [1, 467.08, 291.79, 35.0, 180], [2, 468.56, 182.08, 44.25, 90], [3, 444.80, 172.32, 44.25, 180],
  [4, 444.80, 158.32, 44.25, 180], [5, 468.56, 134.56, 44.25, 270], [6, 467.08, 24.85, 35.0, 180],
  [7, 470.03, 24.85, 35.0, 0], [8, 482.56, 134.56, 44.25, 270], [9, 492.33, 144.32, 44.25, 0],
  [10, 492.33, 158.32, 44.25, 0], [11, 482.56, 182.08, 44.25, 90], [12, 470.03, 291.79, 35.0, 0],
  [13, 649.58, 291.02, 21.75, 180], [14, 649.58, 274.02, 21.75, 180], [15, 649.57, 169.78, 21.75, 180],
  [16, 649.57, 152.78, 21.75, 180], [17, 183.03, 24.85, 35.0, 0], [18, 181.56, 134.56, 44.25, 270],
  [19, 205.32, 144.32, 44.25, 0], [20, 205.32, 158.32, 44.25, 0], [21, 181.56, 182.08, 44.25, 90],
  [22, 183.03, 291.79, 35.0, 0], [23, 180.08, 291.79, 35.0, 180], [24, 167.56, 182.08, 44.25, 90],
  [25, 157.79, 172.32, 44.25, 180], [26, 157.79, 158.32, 44.25, 180], [27, 167.56, 134.56, 44.25, 270],
  [28, 180.08, 24.85, 35.0, 180], [29, 0.54, 25.62, 21.75, 0], [30, 0.54, 42.62, 21.75, 0],
  [31, 0.55, 146.86, 21.75, 0], [32, 0.55, 163.86, 21.75, 0], // 32: mirrored from 15/16 spacing
];

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
