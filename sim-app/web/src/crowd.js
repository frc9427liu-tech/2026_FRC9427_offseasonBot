// Spectators, referees, staff and drive teams. Every person is one instance of a baked-animation character
// (see vat.js): four draw calls for the whole venue, per-person skin/hair/outfit colours, and mood-driven reactions.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FIELD_L, FIELD_W } from './field.js';
import { buildBowl } from './stands.js';
import { bakeType, makeMaterial } from './vat.js';

const L = FIELD_L * 0.0254;
const W = FIELD_W * 0.0254;
const CHARS = ['remy', 'p21', 'p22', 'p23'];
const CLIPS = {
  idle: 'a_sit_idle', clap: 'a_sit_clap', cheer: 'a_sit_cheer',
  st_idle: 'a_standing_idle', st_clap: 'a_standing_clap', st_cheer: 'a_stand_cheer',
};

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

const MOOD_CLIP = (mood, stand) => (stand ? 'st_' : '') + mood;

export async function buildCrowd({ occupancy = 0.55, seed = 7 } = {}) {
  const group = new THREE.Group();
  const bowl = buildBowl({ rows: 6, rowDepth: 1.0, rise: 0.4, margin: 3.4 });
  group.add(bowl.group);

  const loader = new GLTFLoader();
  const load = (f) => loader.loadAsync(`./crowd/${f}.glb`);
  const [chars, clipSrc] = await Promise.all([
    Promise.all(CHARS.map(load)),
    Promise.all(Object.values(CLIPS).map(load)),
  ]);
  const baseClips = Object.keys(CLIPS).map((k, i) => { const c = clipSrc[i].animations[0]; c.name = k; return c; });

  // Per character type: retarget the clips (bone-name prefix, rig scale), then bake.
  const ANIM_HIPS = 0.95;
  const t0 = performance.now();
  const types = chars.map((g) => {
    let prefix = 'mixamorig', hipsY = ANIM_HIPS;
    g.scene.traverse((o) => {
      const m = /^(mixamorig\d*)Hips$/.exec(o.name);
      if (m) { prefix = m[1]; hipsY = o.position.y; }
    });
    const k = hipsY / ANIM_HIPS;
    const clips = {};
    Object.keys(CLIPS).forEach((name, i) => {
      const cl = baseClips[i].clone();
      cl.tracks = cl.tracks.map((t) => {
        const nt = t.clone();
        nt.name = nt.name.replace(/^mixamorig\d*/, prefix);
        if (nt.name.endsWith('.position')) nt.values = nt.values.map((v) => v * k);
        return nt;
      });
      clips[name] = cl;
    });
    const baked = bakeType(g.scene, clips, 12);
    return { k, hipsY, baked, specs: [] };
  });
  console.log('crowd bake ms', Math.round(performance.now() - t0));
  const timeUniform = { value: 0 };
  if (typeof window !== 'undefined') window.__crowdTypes = types; // dev hook
  types.forEach((t) => { t.material = makeMaterial(t.baked, t.hipsY, timeUniform); });

  // ---- people ----
  const rand = rng(seed);
  const people = [];
  function spawn({ x, y, z, fx, fz, side, stand = false, look: lookIn = {}, scale = 1, essential = false, reacts = true }) {
    const ti = Math.floor(rand() * types.length);
    const type = types[ti];
    const fan = rand() < 0.55;
    const team = side === 'blue' ? BLUE : side === 'red' ? RED : CASUAL;
    const look = {
      skin: pick(rand, SKIN), hair: pick(rand, HAIR),
      shirt: fan ? pick(rand, team) : pick(rand, CASUAL),
      pants: pick(rand, JEANS),
      shirtAmt: fan ? 0.9 : 0.55 + rand() * 0.4,
      pantsAmt: 0.55 + rand() * 0.4,
      ...lookIn,
    };
    const p = {
      type, ti, x, y: y + 0.02, z, yaw: Math.atan2(fx, fz), side, stand, look, essential, reacts,
      scale: scale * (0.96 + rand() * 0.08) / type.k, rank: essential ? -1 : rand(),
      speed: 0.9 + rand() * 0.2, lag: rand() * 0.9, phase: rand() * 5,
      mood: 'idle', pending: null,
    };
    people.push(p);
    type.specs.push(p);
    return p;
  }

  for (const seat of bowl.seats) {
    if (rand() > (seat.zone === 'near' ? occupancy * 0.62 : occupancy)) continue; // empty seats
    spawn({ x: seat.x, y: seat.y, z: seat.z, fx: seat.fx, fz: seat.fz, side: seat.x < L / 2 ? 'blue' : 'red' });
  }

  // Staff, referees and drive teams standing on the floor (standing clip set); never culled by the density setting.
  const BLACK = [0.07, 0.07, 0.08], NAVY = [0.08, 0.12, 0.3], WHITE = [0.92, 0.92, 0.92];
  const ADULT = { shirtAmt: 0.95, pantsAmt: 0.9 };
  const badged = [];   // referees/officials/FTA get an event lanyard - drive team and staff at the DS shelf don't
  const staff = (o, wantsBadge) => { const p = spawn({ y: 0, stand: true, essential: true, side: 'ref', reacts: false, ...o }); if (wantsBadge) badged.push(p); return p; };
  for (const x of [L * 0.14, L * 0.36, L * 0.64, L * 0.86]) staff({ x, z: 1.05, fx: 0, fz: -1, look: { ...ADULT, shirt: BLACK, pants: BLACK } }, true);
  for (const x of [L * 0.42, L * 0.5, L * 0.58]) staff({ x, z: 3.15, fx: 0, fz: -1, look: { ...ADULT, shirt: NAVY, pants: BLACK } }, true);
  for (const sy of [W * 0.17, W * 0.5, W * 0.83]) {
    for (const k of [0, 1]) {
      const off = (k - 0.5) * 0.7;
      staff({ x: -1.0, z: -sy + off, fx: 1, fz: 0, side: 'blue', reacts: true, look: { ...ADULT, shirt: [0.14, 0.4, 0.95] } });
      staff({ x: L + 1.0, z: -sy + off, fx: -1, fz: 0, side: 'red', reacts: true, look: { ...ADULT, shirt: [0.92, 0.16, 0.2] } });
    }
  }
  for (const [x, z] of [[-3.2, 2.4], [-2.4, 3.6], [L + 3.2, 2.4], [L + 2.4, 3.6]]) staff({ x, z, fx: 0.6, fz: -1, look: { shirt: NAVY, shirtAmt: 0.95, pantsAmt: 0.85, pants: BLACK } }, true);
  for (const [x, z, fz] of [[L * 0.22, 4.95, -1], [L * 0.78, 4.95, -1], [-4.4, -W / 2 - 0.6, 1]]) staff({ x, z, fx: 0, fz, look: { shirt: BLACK, shirtAmt: 0.95, pants: BLACK, pantsAmt: 0.9 } }, true);
  staff({ x: -6.5, z: 6.4, fx: 0.2, fz: -1, look: { shirt: WHITE, shirtAmt: 0.9, pants: BLACK, pantsAmt: 0.9 } }, true);

  // Event lanyard + badge: every event has officials wearing one, and it's a small enough detail that a
  // solid colour "shirt" can't already suggest it - a real prop reads more like actual staff than a bystander.
  {
    const strapMat = new THREE.MeshStandardMaterial({ color: 0x1a3a8a, roughness: 0.8 });
    const cardMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f0, roughness: 0.4, metalness: 0.1 });
    for (const p of badged) {
      const g = new THREE.Group();
      g.position.set(p.x, p.y, p.z);
      g.rotation.y = p.yaw;   // spawn() already stored this; it's exactly the character mesh's own rotation
      for (const side of [-1, 1]) {
        const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.13, 5), strapMat);
        strap.position.set(side * 0.045, 1.4, 0.09);
        strap.rotation.x = side * 0.55;
        g.add(strap);
      }
      const card = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.004), cardMat);
      card.position.set(0, 1.3, 0.12);
      g.add(card);
      group.add(g);
    }
  }

  // ---- one InstancedMesh per character type ----
  const info = (type, name) => { const c = type.baked.clipInfo[name]; return [c.start, c.frames, c.dur]; };
  for (const type of types) {
    // essential people first (rank -1), then by random rank so a density fraction is always a uniform sample
    type.specs.sort((a, b) => a.rank - b.rank);
    const n = type.specs.length;
    const mesh = new THREE.InstancedMesh(type.baked.geometry, type.material, Math.max(n, 1));
    mesh.frustumCulled = false;
    mesh.castShadow = false; mesh.receiveShadow = false;
    const mk = (size) => new THREE.InstancedBufferAttribute(new Float32Array(n * size), size);
    const aCur = mk(4), aPrev = mk(4), aSS = mk(2), aSkinA = mk(4), aHairA = mk(4), aShirt = mk(3), aPants = mk(3);
    Object.entries({ aCur, aPrev, aSS, aSkinA, aHairA, aShirt, aPants }).forEach(([k, a]) => type.baked.geometry.setAttribute(k, a));
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), sc = new THREE.Vector3();
    type.specs.forEach((p, i) => {
      p.index = i;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw);
      m4.compose(pos.set(p.x, p.y, p.z), q, sc.setScalar(p.scale));
      mesh.setMatrixAt(i, m4);
      const [s, f, d] = info(type, MOOD_CLIP('idle', p.stand));
      aCur.setXYZW(i, s, f, d, p.phase); aPrev.setXYZW(i, s, f, d, p.phase);
      aSS.setXY(i, p.speed, -10);
      aSkinA.setXYZW(i, ...p.look.skin, p.look.shirtAmt); aHairA.setXYZW(i, ...p.look.hair, p.look.pantsAmt);
      aShirt.setXYZ(i, ...p.look.shirt); aPants.setXYZ(i, ...p.look.pants);
    });
    mesh.instanceMatrix.needsUpdate = true;
    type.mesh = mesh; type.attrs = { aCur, aPrev, aSS };
    type.essentialCount = type.specs.filter((p) => p.essential).length;
    group.add(mesh);
  }

  // ---- moods ----
  let time = 0, density = 1;
  const applyDensity = () => {
    for (const type of types) {
      const seats = type.specs.length - type.essentialCount;
      type.mesh.count = Math.max(1, type.essentialCount + Math.ceil(seats * density));
    }
  };
  const switchTo = (p, mood) => {
    if (mood === p.mood) return;
    const { aCur, aPrev, aSS } = p.type.attrs;
    const i = p.index;
    aPrev.setXYZW(i, aCur.getX(i), aCur.getY(i), aCur.getZ(i), aCur.getW(i));
    const [s, f, d] = info(p.type, MOOD_CLIP(mood, p.stand));
    aCur.setXYZW(i, s, f, d, Math.random() * 3);
    aSS.setY(i, time);
    aCur.needsUpdate = aPrev.needsUpdate = aSS.needsUpdate = true;
    p.mood = mood;
  };

  const timers = [];
  const api = {
    group,
    meshes: types.map((t) => t.mesh), // the instanced meshes (the AO pass must skip them: its override material knows nothing about the baked animation)
    count: people.length,
    // Keep only the given fraction of spectators (staff stay); used by the quality setting and the auto-adapt in main.js.
    setDensity(f) { density = f; applyDensity(); },
    get density() { return density; },
    // side: 'blue' | 'red' | 'both'; mood: 'idle' | 'clap' | 'cheer'. Each person reacts after a small personal lag.
    setMood(side, mood) {
      for (const p of people) if (p.reacts && (side === 'both' || p.side === side)) p.pending = { to: mood, t: p.lag };
    },
    // Hold a mood for `seconds`, then relax back to idle.
    react(side, mood, seconds) {
      api.setMood(side, mood);
      timers.push({ t: seconds, side });
    },
    update(dt) {
      time += dt;
      timeUniform.value = time;
      for (const tm of timers) tm.t -= dt;
      for (let i = timers.length - 1; i >= 0; i--) if (timers[i].t <= 0) { api.setMood(timers[i].side, 'idle'); timers.splice(i, 1); }
      for (const p of people) {
        if (p.pending) {
          p.pending.t -= dt;
          if (p.pending.t <= 0) { switchTo(p, p.pending.to); p.pending = null; }
        }
      }
    },
  };
  return api;
}
