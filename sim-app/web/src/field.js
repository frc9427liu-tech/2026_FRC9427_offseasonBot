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
  { id: 'TE-26600', name: 'depot',   at: [[13.5, 214.0]] },
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


// Enclosure details on the HUB that the test-element CAD lacks: polycarbonate lower panels and the teal REBUILT sign.
function signTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 384;
  const g = c.getContext('2d');
  g.fillStyle = '#2aa9b8';
  g.fillRect(0, 0, 512, 384);
  g.strokeStyle = 'rgba(15,40,60,.85)';
  g.setLineDash([16, 10]);
  g.lineWidth = 6;
  g.strokeRect(20, 20, 472, 344);
  g.setLineDash([]);
  g.fillStyle = '#12222e';
  g.font = 'italic 900 84px "Segoe UI", sans-serif';
  g.textAlign = 'center';
  g.fillText('REBUILT', 262, 214);
  g.fillStyle = '#f2c14e';
  g.beginPath(); g.moveTo(90, 150); g.lineTo(140, 120); g.lineTo(190, 150); g.lineTo(140, 180); g.closePath(); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function hubDetails() {
  const g = new THREE.Group();
  const half = 23.9 * IN;
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.14, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false });
  const sign = new THREE.MeshStandardMaterial({ map: signTexture(), roughness: 0.5 });
  for (let i = 0; i < 4; i++) {
    const holder = new THREE.Group();
    holder.rotation.y = i * Math.PI / 2;
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(45 * IN, 34 * IN), glassMat);
    glass.position.set(0, 20 * IN, half);
    holder.add(glass);
    if (i % 2 === 0) { // the two faces without the tag pairs facing the bumps carry the sign
      const s = new THREE.Mesh(new THREE.PlaneGeometry(30 * IN, 22.5 * IN), sign);
      s.position.set(0, 21 * IN, half + 0.004);
      holder.add(s);
    }
    g.add(holder);
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

  // Perimeter: low polycarbonate guardrails on the long sides, diamond plate + glass at the alliance walls.
  const L = FIELD_L * IN, W = FIELD_W * IN;
  const alu = new THREE.MeshStandardMaterial({ color: 0xc9cfd6, roughness: 0.3, metalness: 0.9 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0, side: THREE.DoubleSide, depthWrite: false });
  const add = (geo, mat, x, y, z, shadow = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = shadow;
    m.receiveShadow = true;
    root.add(m);
    return m;
  };
  const guard = (x0, z0, x1, z1, h) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const ang = Math.atan2(z1 - z0, x1 - x0);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const panel = add(new THREE.BoxGeometry(len, h, 0.01), glass, cx, h / 2 + 0.03, cz, false);
    panel.rotation.y = -ang;
    const rail = add(new THREE.BoxGeometry(len, 0.035, 0.05), alu, cx, h + 0.05, cz);
    rail.rotation.y = -ang;
    const base = add(new THREE.BoxGeometry(len, 0.05, 0.06), alu, cx, 0.045, cz);
    base.rotation.y = -ang;
    const n = Math.max(2, Math.round(len / 1.2));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      add(new THREE.BoxGeometry(0.04, h + 0.05, 0.04), alu, x0 + (x1 - x0) * t, (h + 0.05) / 2, z0 + (z1 - z0) * t);
    }
  };
  guard(0, 0.03, L, 0.03, 0.5);          // scoring-table side (y = 0)
  guard(0, -W - 0.03, L, -W - 0.03, 0.5); // far side (y = W)
  // alliance walls: diamond plate lower panel + polycarbonate window
  const plate = new THREE.MeshStandardMaterial({ color: 0xb9c0c8, roughness: 0.28, metalness: 0.95 });
  for (const x of [-0.06, L + 0.06]) {
    add(new THREE.BoxGeometry(0.05, 0.75, W), plate, x, 0.375, -W / 2);
    add(new THREE.BoxGeometry(0.03, 1.15, W), glass, x, 0.75 + 0.575, -W / 2, false);
    add(new THREE.BoxGeometry(0.08, 0.06, W), alu, x, 1.93, -W / 2);
  }
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
        if (el.name === 'hub') holder.add(hubDetails());
        holder.userData = { element: el.name, alliance, size: size.toArray() };
        root.add(holder);
      }
    }
  }
  return root;
}





