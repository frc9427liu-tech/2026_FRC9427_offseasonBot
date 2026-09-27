// Arena bowl: tiered stands wrap the field on the audience side and both ends (open on the referee / scoring-table side),
// with real stadium chairs, aisles with steps, a front barrier and an arena floor apron that blends into the field.
import * as THREE from 'three';
import { FIELD_L, FIELD_W } from './field.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const L = FIELD_L * 0.0254;
const W = FIELD_W * 0.0254;
export const CX = L / 2;
export const CZ = -W / 2;
const R0 = 2.4;
const cutZ = W / 2 - 1.2; // where the end stands stop before the referee side
// World Z the two end-wall vomitories sit at (see inGap in buildBowl) - exported so venue.js can put an
// actual entrance door in the outer wall exactly where each aisle leads to it.
export const AISLE_END_Z = CZ + (cutZ + (-(W / 2) - cutZ) * 0.45);
// Lower tier: 6 rows, with a ~3 m concourse (mezzanine) between the top row and the venue wall.
const ROWS = 6, RISE = 0.4, ROW_DEPTH = 1.0, MARGIN = 3.4;
// Height of the mezzanine concourse floor behind the lower tier. The stands step UP from the field floor,
// so anything on that level - the doors, the railing, people - sits at this height, not at y=0.
export const STAND_TOP_H = ROWS * RISE;
// World Z where the end stands stop on the referee side; the concourse carries on past it to the
// referee-side stand, so it now runs unbroken around all four walls.
export const DECK_END_Z = CZ + cutZ;
// Venue room bounds (venue.js builds its walls from these, so the concourse and the doors line up with them)
export const ROOM = { X0: -12.5, X1: L + 12.5, Zfar: -W - 12.5, Znear: 17 };
// Referee-side stand: starts here (clear of the scoring table/tent/cameras) and faces -Z
export const NEAR_FRONT_Z = 8.4;
// Every door in the outer walls, all on the concourse level. wall: which wall; at: world X (far/near wall)
// or world Z (end walls). venue.js cuts a real opening in the wall for each; props.js builds the door.
export const DOORS = [
  { wall: 'far', at: CX, kind: 'entrance' },
  { wall: 'blue', at: AISLE_END_Z, kind: 'entrance' },
  { wall: 'red', at: AISLE_END_Z, kind: 'entrance' },
  { wall: 'blue', at: -12, kind: 'exit' },
  { wall: 'red', at: -12, kind: 'exit' },
  { wall: 'blue', at: 11.5, kind: 'exit' },
  { wall: 'red', at: 11.5, kind: 'exit' },
];
export const DOOR_W = 1.7, DOOR_H = 2.2;

// Straight-sided rectangle path around the field (sharp corners, no arc - real telescoping bleachers are
// straight sections bolted together at an angle, not a smooth poured-concrete curve), sampled with the same
// parameter for every offset so neighbouring tiers line up. Local coords: X along the field length, Z
// toward the scoring table (+Z = table side). nArc/R0 stay in the signature but are now ignored, so every
// call site below keeps working unedited.
function pathSamples(off, nStraightA, nStraightB, nArc, R0, cutZ) {
  const a = L / 2 + off, b = W / 2 + off;
  const sA = a, sB = b;
  const pts = [];
  const push = (X, Z, nx, nz) => pts.push({ x: CX + X, z: CZ + Z, nx, nz }); // n = outward normal
  // left end, near -> far (Z from cutZ down to -sB)
  for (let i = 0; i <= nStraightB; i++) { const Z = cutZ + (-sB - cutZ) * (i / nStraightB); push(-a, Z, -1, 0); }
  // sharp corner at (-sA, -sB): that point was already the end segment's last point above, so start at i=1
  // audience straight
  for (let i = 1; i < nStraightA; i++) { const X = -sA + 2 * sA * (i / nStraightA); push(X, -b, 0, -1); }
  push(sA, -b, 0, -1);   // sharp corner at (sA, -sB): the right end segment's first point below is the same one
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
  // material.vertexColors needs a per-vertex 'color' attribute to multiply against (plain white: the actual
  // colour comes entirely from each instance's instanceColor, set per-chair below)
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(pos.length).fill(1), 3));
  g.setIndex(idx);
  return g;
}

export function buildBowl({ rows = ROWS, rowDepth = ROW_DEPTH, rise = RISE, margin = MARGIN } = {}) {
  const group = new THREE.Group();
  const seats = [];
  const nA = 60, nB = 14, nArc = 10;
  const entranceW = 1.9;

  // Vomitory entrances, defined once in the LOCAL coordinates that pathSamples' straight runs keep constant
  // regardless of tier offset (sA, sB, cutZ are all offset-independent - see pathSamples), so the same test
  // lines up every tier from the front barrier to the back wall into one real radial aisle, not just a gap
  // cut in the wall. Two near the ends (close to the concourse by the scoring table) and one on the far side.
  const sB0 = W / 2;   // matches pathSamples' sB (=b) now that corners are sharp (R is always 0)
  const endGapZ = cutZ + (-sB0 - cutZ) * 0.45;   // local Z, same for both end walls
  // Vertical aisles (stairways from the concourse down through the seats), in the local coordinate that runs
  // along each straight: the main one on each side lines up with that wall's entrance door, plus narrower
  // ones splitting the rest of the seating into sections. c = centre, h = half width.
  const endAisles = [{ c: endGapZ, h: entranceW / 2 }, { c: -6.0, h: 0.6 }];
  const audAisles = [{ c: 0, h: entranceW / 2 }, { c: -6.2, h: 0.6 }, { c: 6.2, h: 0.6 }];
  // extra: widens the cut past the aisle itself (the railing gap / clear landing around it)
  const inGap = (x, z, nx, nz, extra = 0) => {
    const lx = x - CX, lz = z - CZ;
    if (Math.abs(nx) > 0.5) return endAisles.some((a) => Math.abs(lz - a.c) < a.h + extra);   // end walls (nx = ±1)
    if (nz < -0.5) return audAisles.some((a) => Math.abs(lx - a.c) < a.h + extra);            // audience straight
    return false;
  };

  const deck = new THREE.MeshStandardMaterial({ color: 0x6b727b, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  // lighter than the deck (was almost the same tone as the seats/deck, unreadable as a step) so the aisle
  // steps actually read as a lit tread, matching the high-contrast white-edged stairs in the reference photo
  const stairMat = new THREE.MeshStandardMaterial({ color: 0xd8d3c4, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });

  // arena floor apron: a lighter carpet strip around the field so the field edge sits on a real floor
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(L + 2 * margin + 0.4, W + 2 * margin + 0.4),
    new THREE.MeshStandardMaterial({ color: 0x5c6269, roughness: 0.6, metalness: 0.04 }));
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(CX, -0.008, CZ);
  apron.receiveShadow = true;
  group.add(apron);

  const prev = pathSamples(margin, nA, nB, nArc, R0, cutZ);
  const chairGeo = chairGeometry();
  // base white: per-instance colour (below) supplies the actual blue, since three.js multiplies the two
  // vertexColors: true is what actually turns on per-instance colour multiplication (instanceColor alone
  // is silently ignored by the standard material shader without it)
  const chairMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.1, vertexColors: true });
  const chairs = [];

  for (let r = 0; r < rows; r++) {
    const dIn = margin + r * rowDepth, dOut = dIn + rowDepth;
    const inner = pathSamples(dIn, nA, nB, nArc, R0, cutZ);
    const outer = pathSamples(dOut, nA, nB, nArc, R0, cutZ);
    const hTop = rise * (r + 1), hBot = rise * r;
    group.add(ribbon(inner, outer, hTop, hBot, deck));

    // seats along the mid line of this tier; every 11th seat is an aisle step
    const mid = pathSamples(dIn + rowDepth * 0.62, nA, nB, nArc, R0, cutZ);
    let dist = 0, next = 0.3;
    for (let i = 1; i < mid.length; i++) {
      const p = mid[i - 1], q = mid[i];
      const seg = Math.hypot(q.x - p.x, q.z - p.z);
      while (dist + seg >= next) {
        const t = (next - dist) / seg;
        const x = p.x + (q.x - p.x) * t, z = p.z + (q.z - p.z) * t;
        let nx = p.nx + (q.nx - p.nx) * t, nz = p.nz + (q.nz - p.nz) * t;
        const nl = Math.hypot(nx, nz); nx /= nl; nz /= nl;
        next += 0.55;
        if (inGap(x, z, nx, nz)) continue; // aisle: stairs here on every tier (built below), no seat
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
  // Same row count as the rest of the bowl so its top meets the concourse flush; it spans only as wide as the
  // end stands' outer edge, so the concourse wraps around both of its ends.
  const nearX0 = CX - (L / 2 + margin + rows * rowDepth), nearX1 = CX + (L / 2 + margin + rows * rowDepth);
  const nearAisles = [-12, -4, 4, 12].map((d) => CX + d);
  const inNearGap = (x, extra = 0) => nearAisles.some((a) => Math.abs(x - a) < 0.6 + extra);
  {
    const nRows = rows, x0 = nearX0, x1 = nearX1;
    const nearW = x1 - x0;
    const nearFront = NEAR_FRONT_Z;
    for (let r = 0; r < nRows; r++) {
      const hTop = rise * (r + 1);
      const step = new THREE.Mesh(new THREE.BoxGeometry(nearW, hTop, rowDepth), deck);
      step.position.set((x0 + x1) / 2, hTop / 2, nearFront + r * rowDepth + rowDepth / 2);
      step.receiveShadow = true;
      group.add(step);
      const z = nearFront + r * rowDepth + rowDepth * 0.62;
      for (let x = x0 + 0.3; x < x1 - 0.2; x += 0.55) {
        if (inNearGap(x)) continue;
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
  const seatColor = new THREE.Color();
  chairs.forEach((m, i) => {
    inst.setMatrixAt(i, m);
    // real bleacher seats are never one flat colour: age, moulding batch and grime vary each shell a little.
    // Color.setRGB takes linear components by default (no sRGB decode) - setHex does decode, so build the
    // variation from that instead of writing the sRGB 0x2a4f95 floats directly (which read ~2x too bright).
    const k = 0.85 + Math.random() * 0.3;
    seatColor.setHex(0x2a4f95).multiplyScalar(k);
    inst.setColorAt(i, seatColor);
  });
  inst.castShadow = false; inst.receiveShadow = true;
  group.add(inst);

  // front barrier with a glowing advertising band, and a back wall
  const frontIn = pathSamples(margin - 0.05, nA, nB, nArc, R0, cutZ);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x2a3140, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  // the band sits exactly on the barrier wall: pull it toward the camera in depth so the two never z-fight (flicker)
  const bandMat = new THREE.MeshBasicMaterial({ color: 0x3a8dff, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  // Vertical quad strip along a polyline between heights y0..y1. skip(p) drops the quad between two
  // consecutive points when either one falls in an opening (a railing gap where an aisle comes up).
  const ribbonH = (pts, y0, y1, mat, uvScale = 1, skip = null) => {
    const pos = [], idx = [], uv = [];
    let dist = 0;
    pts.forEach((p, i) => {
      if (i) dist += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z);
      pos.push(p.x, y0, p.z, p.x, y1, p.z);
      uv.push(dist * uvScale, 0, dist * uvScale, (y1 - y0) * uvScale);
    });
    for (let i = 1; i < pts.length; i++) {
      if (skip && (skip(pts[i - 1]) || skip(pts[i]))) continue;
      const a = (i - 1) * 2, b = i * 2;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.material.side = THREE.DoubleSide; return m;
  };
  group.add(ribbonH(frontIn, 0, 0.9, wallMat));
  group.add(ribbonH(frontIn, 0.55, 0.66, bandMat));

  // Resample a polyline at a fixed spacing: pathSamples is sparse on the end walls (~0.8 m), too coarse to
  // cut a clean railing gap at an aisle. Each new point takes the normal of the segment's end point, which
  // is the straight that segment belongs to (the corner point itself carries the previous straight's normal).
  const densify = (pts, step = 0.2) => {
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1], q = pts[i];
      const n = Math.max(1, Math.ceil(Math.hypot(q.x - p.x, q.z - p.z) / step));
      for (let k = 1; k <= n; k++) out.push({ x: p.x + (q.x - p.x) * k / n, z: p.z + (q.z - p.z) * k / n, nx: q.nx, nz: q.nz });
    }
    return out;
  };
  const line = (x0, z0, x1, z1, nx, nz) => densify([{ x: x0, z: z0, nx, nz }, { x: x1, z: z1, nx, nz }]);

  // ---- Mezzanine concourse ----
  // One continuous floor level at the height of the top row, running all the way round the room: behind the
  // three bowl sides, along both end walls past where the end stands stop, and behind the referee-side stand.
  // The entrance doors are in the wall at the back of it; aisles come up through the seats onto it.
  const deckH = rise * rows;
  const edgeOff = margin + rows * rowDepth;   // outer edge of the top row
  const backOff = edgeOff + 0.1;
  const wallOff = CX - ROOM.X0 - L / 2 - 0.05;   // pathSamples offset that lands on the venue walls
  const nearBack = NEAR_FRONT_Z + rows * rowDepth;   // back edge of the referee-side stand's top row
  const zNearWall = ROOM.Znear - 0.05;
  const slabMat = new THREE.MeshStandardMaterial({ color: 0x8c8f93, roughness: 0.45, metalness: 0.05, envMapIntensity: 0.7 });
  const slab = ribbon(pathSamples(edgeOff, nA, nB, nArc, R0, cutZ), pathSamples(wallOff, nA, nB, nArc, R0, cutZ), deckH, 0, slabMat);
  slab.receiveShadow = true;
  group.add(slab);
  const box = (w, h, d, x, y, z, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.receiveShadow = true; group.add(m); return m; };
  // end-wall runs, from where the end stands stop to the referee-side concourse
  for (const s of [-1, 1]) {
    box(wallOff - edgeOff, deckH, nearBack - (CZ + cutZ), CX + s * (L / 2 + (edgeOff + wallOff) / 2), deckH / 2, (CZ + cutZ + nearBack) / 2, slabMat);
  }
  // behind the referee-side stand, wall to wall
  box(L + 2 * wallOff, deckH, zNearWall - nearBack, CX, deckH / 2, (nearBack + zNearWall) / 2, slabMat);
  // Where an end-wall run faces the arena floor (between the end stand and the referee stand) its drop is
  // clad like the front barrier: dark panel with the blue light line, not bare slab.
  for (const s of [-1, 1]) {
    const len = NEAR_FRONT_Z - (CZ + cutZ);
    const x = CX + s * (L / 2 + edgeOff + 0.01);
    const clad = new THREE.Mesh(new THREE.PlaneGeometry(len, deckH), wallMat);
    clad.position.set(x, deckH / 2, (CZ + cutZ + NEAR_FRONT_Z) / 2);
    clad.rotation.y = -s * Math.PI / 2;
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.09), bandMat);
    glow.position.set(x - s * 0.005, deckH - 0.25, clad.position.z);
    glow.rotation.y = clad.rotation.y;
    group.add(clad, glow);
  }

  // Glass balustrade along every edge of the concourse that drops away (stand side and arena-floor side):
  // frameless glass with a steel handrail and posts, open wherever an aisle climbs up onto the concourse.
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xcfe3ee, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0xc8cdd3, roughness: 0.3, metalness: 0.9 });
  const postGeo = new THREE.CylinderGeometry(0.025, 0.025, 1.06, 8);
  const balustrade = (pts, skip = null) => {
    group.add(ribbonH(pts, deckH + 0.05, deckH + 1.0, glassMat, 1, skip));
    group.add(ribbonH(pts, deckH + 1.0, deckH + 1.06, steelMat, 1, skip));
    let dist = 0;
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1], q = pts[i];
      const seg = Math.hypot(q.x - p.x, q.z - p.z);
      const gapEdge = skip && !skip(q) && (skip(p) || (pts[i + 1] && skip(pts[i + 1])));   // a post at each side of every gap
      if ((Math.floor(dist / 1.5) !== Math.floor((dist + seg) / 1.5) || gapEdge || i === pts.length - 1) && !(skip && skip(q))) {
        const post = new THREE.Mesh(postGeo, steelMat);
        post.position.set(q.x, deckH + 0.53, q.z);
        group.add(post);
      }
      dist += seg;
    }
  };
  const bowlGap = (p) => inGap(p.x, p.z, p.nx, p.nz, 0.3);
  balustrade(densify(pathSamples(backOff, nA, nB, nArc, R0, cutZ)), bowlGap);
  for (const s of [-1, 1]) {
    const x = CX + s * (L / 2 + backOff);
    balustrade(line(x, CZ + cutZ, x, nearBack + 0.1, s, 0));
  }
  balustrade(line(CX - (L / 2 + backOff), nearBack + 0.1, CX + (L / 2 + backOff), nearBack + 0.1, 0, 1), (p) => inNearGap(p.x, 0.3));

  // standing spots for concourse spectators, just behind the balustrade, kept clear of the aisle landings
  const deckSpots = [];
  const addSpots = (pts, fx, fz, skip) => {
    let dist = 0;
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1], q = pts[i];
      const seg = Math.hypot(q.x - p.x, q.z - p.z);
      if (Math.floor(dist / 1.3) !== Math.floor((dist + seg) / 1.3) && !(skip && skip(q))) {
        deckSpots.push({ x: q.x, y: deckH, z: q.z, fx: fx ?? -q.nx, fz: fz ?? -q.nz });
      }
      dist += seg;
    }
  };
  addSpots(densify(pathSamples(backOff + 0.7, nA, nB, nArc, R0, cutZ)), null, null, (p) => inGap(p.x, p.z, p.nx, p.nz, 0.9));
  for (const s of [-1, 1]) {
    const x = CX + s * (L / 2 + backOff + 0.7);
    addSpots(line(x, CZ + cutZ + 0.5, x, NEAR_FRONT_Z - 0.5, s, 0), -s, 0);
  }
  addSpots(line(nearX0 + 0.5, nearBack + 0.8, nearX1 - 0.5, nearBack + 0.8, 0, 1), 0, -1, (p) => inNearGap(p.x, 0.9));

  // ---- Aisle stairs ----
  // Each vertical aisle is a real stairway: every 0.4 m row is split into two 0.2 m steps (a half-height
  // block on the back half of the row), light treads with a yellow safety nosing on every step edge, from
  // the front row up to the concourse. Merged into two meshes so ~11 aisles x 6 rows stay 2 draw calls.
  const treadGeos = [], noseGeos = [];
  const put = (list, w, h, d, x, y, z, ry) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.applyMatrix4(new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z));
    list.push(g);
  };
  // at(off): aisle centre in world coords at distance `off` out from the field; ry turns box +Z outward
  const stairway = (halfW, at, ry, rowStart) => {
    for (let r = 0; r < rows; r++) {
      const d0 = rowStart + r * rowDepth, hTop = rise * (r + 1);
      let p = at(d0 + rowDepth * 0.25);
      put(treadGeos, halfW * 2, 0.012, rowDepth * 0.5, p.x, hTop + 0.006, p.z, ry);   // level half of the row
      p = at(d0 + 0.03);
      put(noseGeos, halfW * 2, 0.016, 0.06, p.x, hTop + 0.008, p.z, ry);
      if (r === rows - 1) break;   // top row is level with the concourse
      p = at(d0 + rowDepth * 0.75);
      put(treadGeos, halfW * 2, rise / 2, rowDepth * 0.5, p.x, hTop + rise / 4, p.z, ry);
      p = at(d0 + rowDepth * 0.5 + 0.03);
      put(noseGeos, halfW * 2, 0.016, 0.06, p.x, hTop + rise / 2 + 0.008, p.z, ry);
    }
  };
  for (const a of endAisles) {
    stairway(a.h, (off) => ({ x: CX - (L / 2 + off), z: CZ + a.c }), Math.PI / 2, margin);
    stairway(a.h, (off) => ({ x: CX + (L / 2 + off), z: CZ + a.c }), Math.PI / 2, margin);
  }
  for (const a of audAisles) stairway(a.h, (off) => ({ x: CX + a.c, z: CZ - (W / 2 + off) }), 0, margin);
  for (const x of nearAisles) stairway(0.6, (off) => ({ x, z: off }), 0, NEAR_FRONT_Z);
  const noseMat = new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.6 });
  for (const [geos, mat] of [[treadGeos, stairMat], [noseGeos, noseMat]]) {
    const m = new THREE.Mesh(mergeGeometries(geos), mat);
    m.receiveShadow = true;
    group.add(m);
  }

  // Handrails along both edges of each vomitory aisle, stepping down from the back wall to the front
  // barrier so the walkway the tiers already line up on reads as somewhere a person actually climbs.
  const railMat = new THREE.MeshStandardMaterial({ color: 0xbfc4cb, roughness: 0.35, metalness: 0.85 });
  const railH = 0.92;
  const bar = (p0, p1, radius) => {
    const dx = p1.x - p0.x, dy = p1.y - p0.y, dz = p1.z - p0.z;
    const len = Math.hypot(dx, dy, dz);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 8), railMat);
    m.position.set((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, (p0.z + p1.z) / 2);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, dy, dz).normalize());
    group.add(m);
  };
  // boundaries from the front barrier (k=0, floor height 0) to the back wall (k=rows, tier top height)
  const boundaryOffsets = [margin, ...Array.from({ length: rows }, (_, r) => margin + (r + 1) * rowDepth)];
  const boundaryHeights = [0, ...Array.from({ length: rows }, (_, r) => rise * (r + 1))];
  // edge(k): the two rail lines (left/right of the aisle) at boundary k, in world coords
  const buildRail = (edge) => {
    const left = boundaryOffsets.map((off, k) => ({ ...edge(off, -1), y: boundaryHeights[k] }));
    const right = boundaryOffsets.map((off, k) => ({ ...edge(off, 1), y: boundaryHeights[k] }));
    for (const line of [left, right]) {
      for (let k = 0; k < line.length; k++) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, railH, 8), railMat);
        post.position.set(line[k].x, line[k].y + railH / 2, line[k].z);
        group.add(post);
        if (k > 0) bar({ ...line[k - 1], y: line[k - 1].y + railH }, { ...line[k], y: line[k].y + railH }, 0.022);
      }
    }
  };
  const halfW = entranceW / 2 + 0.1;
  buildRail((off, side) => ({ x: CX - (L / 2 + off), z: CZ + endGapZ + side * halfW }));   // left-end aisle
  buildRail((off, side) => ({ x: CX + (L / 2 + off), z: CZ + endGapZ + side * halfW }));   // right-end aisle
  buildRail((off, side) => ({ x: CX + side * halfW, z: CZ - (W / 2 + off) }));             // audience-side aisle

  return { group, seats, deckSpots, backOffset: backOff };
}
