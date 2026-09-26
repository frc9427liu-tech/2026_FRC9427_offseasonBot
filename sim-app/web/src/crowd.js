// Spectator stands on the scoring-table side, filled with animated people (Mixamo rigs, decimated for the web).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { FIELD_L, FIELD_W } from './field.js';

const L = FIELD_L * 0.0254;
const W = FIELD_W * 0.0254;
const CHARS = ['remy', 'p21', 'p22', 'p23'];
const CLIPS = {
  sit_idle: 'a_sit_idle', sit_clap: 'a_sit_clap', sit_cheer: 'a_sit_cheer',
};

// mulberry32: same crowd on every load
function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
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

export async function buildCrowd({ rows = 6, perRow = 20, seed = 7 } = {}) {
  const group = new THREE.Group();
  const rowDepth = 0.95, rise = 0.38, z0 = W + 3.2; // audience side: beyond the far guardrail (y = W), opposite the scoring table
  const stands = buildStands(rows, rowDepth, rise, z0);
  group.add(stands.group);

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

  // Per character type: bone-name prefix (Mixamo exports use mixamorig: or mixamorig2:) and rig scale relative to the clips.
  const ANIM_HIPS = 0.95;
  const types = chars.map((g) => {
    let prefix = 'mixamorig', hipsY = ANIM_HIPS;
    g.scene.traverse((o) => {
      const m = /^(mixamorig\d*)Hips$/.exec(o.name); // GLTFLoader strips the colon from node names
      if (m) { prefix = m[1]; hipsY = o.position.y; }
    });
    const k = hipsY / ANIM_HIPS;
    const cs = clips.map((clip) => {
      const cl = clip.clone();
      cl.tracks = cl.tracks.map((t) => {
        const nt = t.clone();
        nt.name = nt.name.replace(/^mixamorig\d*/, prefix);
        if (nt.name.endsWith('.position')) nt.values = nt.values.map((v) => v * k);
        return nt;
      });
      return cl;
    });
    return { scene: g.scene, k, clips: cs };
  });

  const rand = rng(seed);
  const mixers = [];
  const spacing = (L + 2) / perRow;
  const fieldCenter = new THREE.Vector3(L / 2, 0, -1.5);
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < perRow; i++) {
      if (rand() < 0.3) continue; // empty seats
      const type = types[Math.floor(rand() * types.length)];
      const person = SkeletonUtils.clone(type.scene);
      const holder = new THREE.Group();
      holder.add(person);
      const x = -1 + i * spacing + (rand() - 0.5) * 0.25;
      const z = -(z0 + r * rowDepth + rowDepth * 0.6);
      holder.position.set(x, stands.rowTop(r) + 0.02, z);
      const s = 0.94 + rand() * 0.12;
      holder.scale.setScalar(s / type.k);
      holder.lookAt(fieldCenter.x * 0.6 + x * 0.4, holder.position.y, -W / 2);
      holder.rotation.x = 0; holder.rotation.z = 0;
      person.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.frustumCulled = true; } });
      const mixer = new THREE.AnimationMixer(person);
      const pick = rand();
      const clip = type.clips[pick < 0.5 ? 0 : pick < 0.82 ? 1 : 2];
      const act = mixer.clipAction(clip);
      act.time = rand() * clip.duration;
      act.timeScale = 0.85 + rand() * 0.3;
      act.play();
      mixers.push(mixer);
      group.add(holder);
    }
  }

  // update a quarter of the mixers each frame with the accumulated time step
  let frame = 0, acc = 0;
  return {
    group,
    count: mixers.length,
    update(dt) {
      acc += dt;
      frame++;
      const n = mixers.length;
      for (let i = frame % 4; i < n; i += 4) mixers[i].update(acc);
      if (frame % 4 === 3) acc = 0;
    },
  };
}



