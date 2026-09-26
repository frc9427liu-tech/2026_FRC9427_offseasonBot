// Event venue around the field: polished floor, black drape with folds, overhead lamps, alliance colour wash.
import * as THREE from 'three';
import { FIELD_L, FIELD_W } from './field.js';

const IN = 0.0254;
const L = FIELD_L * IN, W = FIELD_W * IN;

function drape(width, height, folds, seed = 0) {
  const geo = new THREE.PlaneGeometry(width, height, Math.round(width * 6), 1);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    p.setZ(i, Math.sin(x * folds + seed) * 0.16 + Math.sin(x * folds * 2.3 + seed * 2) * 0.05);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: 0x0a0d12, roughness: 0.95, metalness: 0, side: THREE.DoubleSide });
  const m = new THREE.Mesh(geo, mat);
  m.receiveShadow = true;
  return m;
}

export function buildVenue() {
  const g = new THREE.Group();
  const cx = L / 2, cz = -W / 2;

  // Floor beyond the field: dark polished concrete
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120),
    new THREE.MeshStandardMaterial({ color: 0x080b10, roughness: 0.6, metalness: 0.05 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, -0.012, cz);
  floor.receiveShadow = true;
  g.add(floor);

  // Drapes: rear (far side) and both ends; the scoring-table side is left open for the stands.
  const rearZ = -W - 13;
  const rear = drape(L + 24, 7.5, 5.5, 1);
  rear.position.set(cx, 3.75, rearZ);
  g.add(rear);
  for (const s of [-1, 1]) {
    const end = drape(W + 12, 7.5, 5.5, 3 + s);
    end.rotation.y = Math.PI / 2;
    end.position.set(cx + s * (L / 2 + 9), 3.75, cz - 2.5);
    g.add(end);
  }

  // Overhead metal-halide fixtures with warm-white spot pools
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff1d6 });
  const housing = new THREE.MeshStandardMaterial({ color: 0x20242b, roughness: 0.5, metalness: 0.7 });
  const nx = 6, nz = 3;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const x = (i + 0.5) / nx * L;
      const z = -(j + 0.5) / nz * W;
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 0.28, 24), housing);
      disc.position.set(x, 8.6, z);
      const bulb = new THREE.Mesh(new THREE.CircleGeometry(0.4, 24), lampMat);
      bulb.rotation.x = Math.PI / 2;
      bulb.position.set(x, 8.45, z);
      g.add(disc, bulb);
      if ((i + j) % 2 === 0) {
        const s = new THREE.SpotLight(0xfff0dc, 9, 20, 0.7, 0.7, 1.6);
        s.position.set(x, 8.4, z);
        s.target.position.set(x, 0, z);
        g.add(s, s.target);
      }
    }
  }

  // Alliance colour wash on the drapes, like the event uplights
  const wash = (color, x, z, tx, tz, intensity) => {
    const s = new THREE.SpotLight(color, intensity, 24, 0.9, 0.9, 1.2);
    s.position.set(x, 0.3, z);
    s.target.position.set(tx, 3.5, tz);
    g.add(s, s.target);
  };
  wash(0x1f6bff, 2, -W - 1, 4, rearZ, 90);
  wash(0xff2a3a, L - 2, -W - 1, L - 4, rearZ, 90);
  wash(0x1f6bff, -3, -W / 2, cx - 6, rearZ, 60);
  wash(0xff2a3a, L + 3, -W / 2, cx + 6, rearZ, 60);
  return g;
}


