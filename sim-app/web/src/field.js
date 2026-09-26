// REBUILT 2026 field built from the official element CAD (STEP -> JSON) placed with official coordinates.
// Units: field inches from the drawings (X toward Red wall, Y away from scoring table), rendered in meters.
import * as THREE from 'three';

const IN = 0.0254;
export const FIELD_L = 651.2;
export const FIELD_W = 317.7;

const ALLIANCE = { blue: 0x2f7fe8, red: 0xe0353f };

// Blue-side placements (inches). Red side is the same rotated 180 deg about the field center.
// `anchor` picks which bbox point of the raw model lands on (x,y): 'c' = center, 'wall' = min-X face on x.
const ELEMENTS = [
  { id: 'TE-26300', name: 'hub',     at: [[181.56, FIELD_W / 2]] },
  { id: 'TE-26100', name: 'bump',    at: [[181.56, 102.15], [181.56, FIELD_W - 102.15]] },
  { id: 'TE-26200', name: 'trench',  at: [[181.56, 32.83], [181.56, FIELD_W - 32.83]] },
  { id: 'TE-26500', name: 'tower',   at: [[23.2, 155.36]] },
  { id: 'TE-26000', name: 'outpost', at: [[0, 34.12]] },
  { id: 'TE-26600', name: 'depot',   at: [[13.5, 254.0]] },
];

function bbox(meshes) {
  const b = new THREE.Box3();
  for (const m of meshes) {
    const p = m.pos;
    for (let i = 0; i < p.length; i += 3) b.expandByPoint(new THREE.Vector3(p[i], p[i + 1], p[i + 2]));
  }
  return b;
}

const near = (c, r, g, b) => Math.abs(c.r - r) < 0.03 && Math.abs(c.g - g) < 0.03 && Math.abs(c.b - b) < 0.03;

// The CAD ships default STEP colours; map them to real materials (see official field photos).
function material(base, alliance, elName) {
  const paint = ALLIANCE[alliance];
  if (near(base, 0.82, 0.49, 0.21)) return new THREE.MeshStandardMaterial({ color: paint, roughness: 0.35, metalness: 0.1 });
  if (near(base, 0.83, 0.60, 0.39)) {
    if (elName === 'bump') return new THREE.MeshStandardMaterial({ color: paint, roughness: 0.3, metalness: 0.1 });
    const c = elName === 'depot' ? 0x8b9198 : 0x14171c;
    return new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: 0.05 });
  }
  if (near(base, 0.60, 0.60, 0.60)) return new THREE.MeshStandardMaterial({ color: 0xc3c9d0, roughness: 0.32, metalness: 0.85 });
  if (near(base, 0.82, 0.82, 0.82)) return new THREE.MeshStandardMaterial({ color: 0xe9edf2, roughness: 0.45, metalness: 0.05 });
  if (near(base, 0.38, 0.38, 0.38)) return new THREE.MeshStandardMaterial({ color: 0x2a2e34, roughness: 0.6, metalness: 0.3 });
  return new THREE.MeshStandardMaterial({ color: base, roughness: 0.55, metalness: 0.2 });
}

function buildModel(meshes, alliance, elName) {
  const g = new THREE.Group();
  for (const m of meshes) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(m.pos, 3));
    geo.setIndex(m.idx);
    geo.computeVertexNormals();
    const base = m.color ? new THREE.Color(m.color[0], m.color[1], m.color[2]) : new THREE.Color(0x9aa4b2);
    const mesh = new THREE.Mesh(geo, material(base, alliance, elName));
    mesh.castShadow = mesh.receiveShadow = true;
    g.add(mesh);
  }
  return g;
}

async function loadJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

function carpet() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#5d6168';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const v = 78 + Math.random() * 34;
    g.fillStyle = `rgb(${v},${v + 4},${v + 10})`;
    g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(FIELD_L / 40, FIELD_W / 40);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function strip(x0, y0, w, h, color, y = 0.002) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w * IN, h * IN),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
  m.rotation.x = -Math.PI / 2;
  m.position.set((x0 + w / 2) * IN, y, -(y0 + h / 2) * IN);
  m.receiveShadow = true;
  return m;
}

export async function buildField(base = './models/') {
  const root = new THREE.Group();

  // Carpet + surround
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(FIELD_L * IN, FIELD_W * IN),
    new THREE.MeshStandardMaterial({ map: carpet(), roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(FIELD_L / 2 * IN, 0, -FIELD_W / 2 * IN);
  floor.receiveShadow = true;
  root.add(floor);

  // Alliance zone tape (158.6 in deep) and center line
  const zone = 158.6;
  root.add(strip(zone - 1, 0, 2, FIELD_W, 0x2f7fe8));
  root.add(strip(FIELD_L - zone - 1, 0, 2, FIELD_W, 0xe0353f));
  root.add(strip(FIELD_L / 2 - 1, 0, 2, FIELD_W, 0xdfe6ee));

  // Alliance-colored floor bands near the walls
  root.add(strip(0, 0, 12, FIELD_W, 0x1d4f99));
  root.add(strip(FIELD_L - 12, 0, 12, FIELD_W, 0x9c2530));

  // Perimeter walls
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xcfd6df, roughness: 0.4, metalness: 0.2 });
  const wall = (x, z, w, d, h = 0.5) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    m.position.set(x, h / 2, z);
    m.castShadow = m.receiveShadow = true;
    root.add(m);
  };
  const L = FIELD_L * IN, W = FIELD_W * IN;
  wall(L / 2, 0.03, L, 0.06);
  wall(L / 2, -W - 0.03, L, 0.06);
  wall(-0.03, -W / 2, 0.06, W, 0.9);
  wall(L + 0.03, -W / 2, 0.06, W, 0.9);

  // Elements from CAD
  for (const el of ELEMENTS) {
    let meshes;
    try {
      meshes = await loadJson(`${base}${el.id}.json`);
    } catch (e) {
      console.warn('missing model', el.id, e);
      continue;
    }
    const bb = bbox(meshes);
    const size = bb.getSize(new THREE.Vector3());
    const ctr = bb.getCenter(new THREE.Vector3());
    for (const alliance of ['blue', 'red']) {
      for (const [ix, iy] of el.at) {
        const m = buildModel(meshes, alliance, el.name);
        const holder = new THREE.Group();
        // Raw model is Z-up in its own frame: recentre on x/y, sit on floor, then map (x,y,z)->(x,z,y).
        m.position.set(-ctr.x, -ctr.y, -bb.min.z);
        m.rotation.x = 0;
        const zUp = new THREE.Group();
        zUp.add(m);
        zUp.rotation.x = -Math.PI / 2; // Z-up -> Y-up; model +Y becomes -Z, matching field +Y = -Z
        zUp.scale.set(1, 1, 1);
        holder.add(zUp);
        const x = alliance === 'blue' ? ix : FIELD_L - ix;
        const y = alliance === 'blue' ? iy : FIELD_W - iy;
        holder.position.set(x * IN, 0, -y * IN);
        if (alliance === 'red') holder.rotation.y = Math.PI;
        holder.userData = { element: el.name, alliance, size: size.toArray() };
        root.add(holder);
      }
    }
  }
  return root;
}



