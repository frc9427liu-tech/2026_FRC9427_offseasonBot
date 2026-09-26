// Arena bowl: tiered stands wrap the field on the audience side and both ends (open on the referee / scoring-table side),
// with real stadium chairs, aisles with steps, a front barrier and an arena floor apron that blends into the field.
import * as THREE from 'three';
import { FIELD_L, FIELD_W } from './field.js';

const L = FIELD_L * 0.0254;
const W = FIELD_W * 0.0254;
export const CX = L / 2;
export const CZ = -W / 2;

// Parallel rounded-rectangle path around the field, sampled with the same parameter for every offset so
// neighbouring tiers line up. Local coords: X along the field length, Z toward the scoring table (+Z = table side).
function pathSamples(off, nStraightA, nStraightB, nArc, R0, cutZ) {
  const a = L / 2 + off, b = W / 2 + off, R = R0 + off;
  const sA = a - R, sB = b - R;
  const pts = [];
  const push = (X, Z, nx, nz) => pts.push({ x: CX + X, z: CZ + Z, nx, nz }); // n = outward normal
  // left end, near -> far (Z from cutZ down to -sB)
  for (let i = 0; i <= nStraightB; i++) { const Z = cutZ + (-sB - cutZ) * (i / nStraightB); push(-a, Z, -1, 0); }
  // audience-left corner: center (-sA, -sB), angle pi -> 3pi/2
  for (let i = 1; i <= nArc; i++) { const t = Math.PI + (Math.PI / 2) * (i / nArc); push(-sA + R * Math.cos(t), -sB + R * Math.sin(t), Math.cos(t), Math.sin(t)); }
  // audience straight
  for (let i = 1; i < nStraightA; i++) { const X = -sA + 2 * sA * (i / nStraightA); push(X, -b, 0, -1); }
  // audience-right corner: center (sA, -sB), 3pi/2 -> 2pi
  for (let i = 0; i <= nArc; i++) { const t = 1.5 * Math.PI + (Math.PI / 2) * (i / nArc); push(sA + R * Math.cos(t), -sB + R * Math.sin(t), Math.cos(t), Math.sin(t)); }
  // right end, far -> near
  for (let i = 1; i <= nStraightB; i++) { const Z = -sB + (cutZ + sB) * (i / nStraightB); push(a, Z, 1, 0); }
  return pts;
}

function ribbon(inner, outer, hTop, hBottom, mat) {
  // top face between two parallel paths plus the riser at the inner edge
  const pos = [], idx = [];
  const n = inner.length;
  for (let i = 0; i < n; i++) {
    pos.push(inner[i].x, hTop, inner[i].z, outer[i].x, hTop, outer[i].z, inner[i].x, hBottom, inner[i].z);
  }
  for (let i = 0; i < n - 1; i++) {
    const a = i * 3, b = (i + 1) * 3;
    idx.push(a, b, a + 1, a + 1, b, b + 1); // top
    idx.push(a + 2, b + 2, a, a, b + 2, b);   // riser
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.material.side = THREE.DoubleSide;
  m.receiveShadow = true;
  return m;
}

function chairGeometry() {
  const parts = [];
  const box = (w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); parts.push(g); };
  box(0.44, 0.06, 0.42, 0, 0.44, 0);        // seat pan
  box(0.44, 0.42, 0.05, 0, 0.7, -0.2);      // back rest
  box(0.04, 0.05, 0.36, -0.235, 0.6, -0.02); // arm rests
  box(0.04, 0.05, 0.36, 0.235, 0.6, -0.02);
  box(0.05, 0.42, 0.05, -0.2, 0.21, 0.12);  // legs
  box(0.05, 0.42, 0.05, 0.2, 0.21, 0.12);
  // merge
  const pos = [], nor = [], idx = [];
  let off = 0;
  for (const g of parts) {
    pos.push(...g.attributes.position.array);
    nor.push(...g.attributes.normal.array);
    idx.push(...Array.from(g.index.array, (v) => v + off));
    off += g.attributes.position.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

export function buildBowl({ rows = 6, rowDepth = 1.0, rise = 0.4, margin = 3.4 } = {}) {
  const group = new THREE.Group();
  const seats = [];
  const R0 = 2.4;
  const cutZ = W / 2 - 1.2; // where the end stands stop before the referee side
  const nA = 60, nB = 14, nArc = 10;

  const deck = new THREE.MeshStandardMaterial({ color: 0x6b727b, roughness: 0.8 });
  const stairMat = new THREE.MeshStandardMaterial({ color: 0x2f3744, roughness: 0.6 });

  // arena floor apron: a lighter carpet strip around the field so the field edge sits on a real floor
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(L + 2 * margin + 0.4, W + 2 * margin + 0.4),
    new THREE.MeshStandardMaterial({ color: 0x5c6269, roughness: 0.6, metalness: 0.04 }));
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(CX, -0.008, CZ);
  apron.receiveShadow = true;
  group.add(apron);

  const prev = pathSamples(margin, nA, nB, nArc, R0, cutZ);
  const chairGeo = chairGeometry();
  const chairMat = new THREE.MeshStandardMaterial({ color: 0x2a4f95, roughness: 0.55, metalness: 0.1 });
  const chairs = [];

  for (let r = 0; r < rows; r++) {
    const dIn = margin + r * rowDepth, dOut = dIn + rowDepth;
    const inner = pathSamples(dIn, nA, nB, nArc, R0, cutZ);
    const outer = pathSamples(dOut, nA, nB, nArc, R0, cutZ);
    const hTop = rise * (r + 1), hBot = rise * r;
    group.add(ribbon(inner, outer, hTop, hBot, deck));

    // seats along the mid line of this tier; every 11th seat is an aisle step
    const mid = pathSamples(dIn + rowDepth * 0.62, nA, nB, nArc, R0, cutZ);
    let dist = 0, next = 0.3, count = 0;
    for (let i = 1; i < mid.length; i++) {
      const p = mid[i - 1], q = mid[i];
      const seg = Math.hypot(q.x - p.x, q.z - p.z);
      while (dist + seg >= next) {
        const t = (next - dist) / seg;
        const x = p.x + (q.x - p.x) * t, z = p.z + (q.z - p.z) * t;
        let nx = p.nx + (q.nx - p.nx) * t, nz = p.nz + (q.nz - p.nz) * t;
        const nl = Math.hypot(nx, nz); nx /= nl; nz /= nl;
        count++;
        next += 0.55;
        if (count % 12 === 0) { // aisle: a step block instead of a chair
          const st = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, rowDepth * 0.95), stairMat);
          st.position.set(x, hTop + 0.03, z);
          st.rotation.y = Math.atan2(nx, nz);
          group.add(st);
          continue;
        }
        // chairs face the field: inward = -normal; chair geometry faces +Z
        const m = new THREE.Matrix4().makeRotationY(Math.atan2(-nx, -nz));
        m.setPosition(x, hTop, z);
        chairs.push(m);
        seats.push({ x, y: hTop, z, fx: -nx, fz: -nz, row: r });
      }
      dist += seg;
    }
  }
  // Referee-side stands: set well back from the scoring table, tent and cameras so those keep their working space,
  // with a concourse rail in front. They face the field (-Z).
  {
    const zStart = 8.4, nRows = 5, x0 = -12.5, x1 = L + 12.5;
    const nearW = x1 - x0;
    const nearFront = zStart;
    for (let r = 0; r < nRows; r++) {
      const hTop = rise * (r + 1);
      const step = new THREE.Mesh(new THREE.BoxGeometry(nearW, hTop, rowDepth), deck);
      step.position.set((x0 + x1) / 2, hTop / 2, nearFront + r * rowDepth + rowDepth / 2);
      step.receiveShadow = true;
      group.add(step);
      const z = nearFront + r * rowDepth + rowDepth * 0.62;
      let count = 0;
      for (let x = x0 + 0.3; x < x1 - 0.2; x += 0.55) {
        count++;
        if (count % 12 === 0) {
          const st = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, rowDepth * 0.95), stairMat);
          st.position.set(x, hTop + 0.03, z);
          group.add(st);
          continue;
        }
        const m = new THREE.Matrix4().makeRotationY(Math.PI); // face -Z
        m.setPosition(x, hTop, z);
        chairs.push(m);
        seats.push({ x, y: hTop, z, fx: 0, fz: -1, row: r, zone: 'near' });
      }
    }
    // concourse rail and back wall for this section
    const rail = new THREE.Mesh(new THREE.BoxGeometry(nearW, 0.9, 0.08), new THREE.MeshStandardMaterial({ color: 0x2a3140, roughness: 0.7 }));
    rail.position.set((x0 + x1) / 2, 0.45, nearFront - 0.05);
    group.add(rail);
    const glow = new THREE.Mesh(new THREE.BoxGeometry(nearW, 0.09, 0.02), new THREE.MeshBasicMaterial({ color: 0x3a8dff }));
    glow.position.set((x0 + x1) / 2, 0.6, nearFront - 0.1);
    group.add(glow);
  }

  const inst = new THREE.InstancedMesh(chairGeo, chairMat, chairs.length);
  chairs.forEach((m, i) => inst.setMatrixAt(i, m));
  inst.castShadow = false; inst.receiveShadow = true;
  group.add(inst);

  // front barrier with a glowing advertising band, and a back wall
  const frontIn = pathSamples(margin - 0.05, nA, nB, nArc, R0, cutZ);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x2a3140, roughness: 0.7 });
  const bandMat = new THREE.MeshBasicMaterial({ color: 0x3a8dff });
  const ribbonH = (pts, y0, y1, mat) => {
    const pos = [], idx = [];
    pts.forEach((p, i) => { pos.push(p.x, y0, p.z, p.x, y1, p.z); if (i) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.material.side = THREE.DoubleSide; return m;
  };
  group.add(ribbonH(frontIn, 0, 0.9, wallMat));
  group.add(ribbonH(frontIn, 0.55, 0.66, bandMat));
  const backOff = margin + rows * rowDepth + 0.1;
  group.add(ribbonH(pathSamples(backOff, nA, nB, nArc, R0, cutZ), 0, rise * rows + 2.2, wallMat));

  return { group, seats, backOffset: backOff };
}
