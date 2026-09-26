// FUEL: 5.91 in foam balls. Starting layout follows the official field photos:
//  - 360 in the neutral zone (two hex-packed blocks straddling the center line, 15 across x 12 deep each)
//  - 24 in each DEPOT (4 x 6 rows on the mat)
// (Outpost corral balls and robot preloads are added when robots arrive.)
import * as THREE from 'three';
import { FIELD_L, FIELD_W } from './field.js';

const IN = 0.0254;
export const FUEL_D = 5.91 * IN;
export const FUEL_R = FUEL_D / 2;

function hexBlock(cx, cy, across, deep) {
  const dy = 5.91 * 1.005; // tiny clearance so spheres never interpenetrate
  const dx = dy * 0.866;
  const pts = [];
  for (let r = 0; r < deep; r++) {
    const off = (r % 2) * dy / 2;
    for (let c = 0; c < across; c++) {
      pts.push([cx + (r - (deep - 1) / 2) * dx, cy + (c - (across - 1) / 2) * dy + off - dy / 4]);
    }
  }
  return pts;
}

export function startingLayout() {
  const pts = [];
  const cx = FIELD_L / 2, cy = FIELD_W / 2;
  const blockW = 15 * 5.91;
  pts.push(...hexBlock(cx, cy - blockW / 2, 15, 12));
  pts.push(...hexBlock(cx, cy + blockW / 2 + 1, 15, 12));
  for (const alliance of ['blue', 'red']) {
    for (const [lx, ly] of hexBlock(0, 0, 6, 4)) {
      // Blue depot: on the blue wall, beside the tower. Red is the 180 deg rotation.
      const bx = 14 + lx, by = 214 + ly;
      pts.push(alliance === 'blue' ? [bx, by] : [FIELD_L - bx, FIELD_W - by]);
    }
  }
  return pts;
}

function fuelTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#f7c600';
  g.fillRect(0, 0, 512, 256);
  // subtle molding seam on the equator + a slightly darker patch, like the real foam ball
  g.fillStyle = 'rgba(160,110,0,.35)';
  g.fillRect(0, 126, 512, 3);
  const grad = g.createRadialGradient(256, 128, 5, 256, 128, 120);
  grad.addColorStop(0, 'rgba(255,215,60,.25)');
  grad.addColorStop(1, 'rgba(255,215,60,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function buildFuel() {
  const pts = startingLayout();
  const geo = new THREE.SphereGeometry(FUEL_R, 32, 20);
  const mat = new THREE.MeshStandardMaterial({ map: fuelTexture(), roughness: 0.4, metalness: 0, emissive: 0x4a3600, emissiveIntensity: 0.6 });
  const mesh = new THREE.InstancedMesh(geo, mat, pts.length);
  mesh.castShadow = mesh.receiveShadow = true;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  pts.forEach(([x, y], i) => {
    e.set(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28);
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(x * IN, FUEL_R, -y * IN), q, new THREE.Vector3(1, 1, 1));
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.userData.count = pts.length;
  return mesh;
}


