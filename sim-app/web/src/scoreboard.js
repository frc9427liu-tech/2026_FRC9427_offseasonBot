// In-scene electronic scoreboards (LED look) mounted above each alliance wall.
// Drive with board.set({ blue, red, time, phase, blueFuel, redFuel }).
import * as THREE from 'three';
import { FIELD_L, FIELD_W } from './field.js';

const IN = 0.0254;
const W = FIELD_W * IN, L = FIELD_L * IN;

function makeScreen() {
  const canvas = document.createElement('canvas');
  canvas.width = 1536; canvas.height = 384;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return { canvas, tex, ctx: canvas.getContext('2d') };
}

const LED = '"DSEG7 Classic", "Consolas", "Courier New", monospace';

function draw(s, st) {
  const g = s.ctx;
  const w = s.canvas.width, h = s.canvas.height;
  g.fillStyle = '#05070b';
  g.fillRect(0, 0, w, h);
  // alliance blocks
  const block = (x, color, dim, label, score, fuel) => {
    g.fillStyle = dim;
    g.fillRect(x, 24, 560, h - 48);
    g.fillStyle = color;
    g.font = `700 44px ${LED}`;
    g.textAlign = 'left';
    g.fillText(label, x + 28, 78);
    g.font = `900 200px ${LED}`;
    g.textAlign = 'right';
    g.fillText(String(score).padStart(3, '0'), x + 532, 268);
    g.font = `700 40px ${LED}`;
    g.fillStyle = '#ffd24a';
    g.textAlign = 'left';
    g.fillText(`FUEL ${String(fuel).padStart(3, '0')}`, x + 28, 336);
  };
  block(24, '#4da3ff', '#0a1a33', 'BLUE', st.blue, st.blueFuel);
  block(w - 24 - 560, '#ff5560', '#33101a', 'RED', st.red, st.redFuel);
  // clock
  g.fillStyle = '#ffd24a';
  g.textAlign = 'center';
  g.font = `700 40px ${LED}`;
  g.fillText(st.phase, w / 2, 78);
  const m = Math.floor(st.time / 60), sec = Math.floor(st.time % 60);
  g.font = `900 130px ${LED}`;
  g.fillStyle = st.time <= 10 ? '#ff5560' : '#f2f5f8';
  g.fillText(`${m}:${String(sec).padStart(2, '0')}`, w / 2, 230);
  // scanline / LED dot grid feel
  g.fillStyle = 'rgba(0,0,0,.28)';
  for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1);
}

export function buildScoreboards() {
  const group = new THREE.Group();
  const boards = [];
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x14171c, roughness: 0.5, metalness: 0.6 });
  const state = { blue: 0, red: 0, blueFuel: 0, redFuel: 0, time: 160, phase: 'AUTO' };

  for (const side of [-1, 1]) {
    const s = makeScreen();
    boards.push(s);
    const bw = 4.2, bh = 1.05;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh),
      new THREE.MeshBasicMaterial({ map: s.tex, toneMapped: false }));
    const frame = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.12, bh + 0.12, 0.14), frameMat);
    const holder = new THREE.Group();
    frame.position.z = -0.08;
    holder.add(frame, screen);
    // Alliance wall top is ~1.93 m; hang the board just above, facing the field.
    const x = side < 0 ? -0.25 : L + 0.25;
    holder.position.set(x, 2.95, -W / 2);
    holder.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    // support posts
    for (const dz of [-1.7, 1.7]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.4, 0.08), frameMat);
      const p = post.clone();
      p.position.set(x, 2.25, -W / 2 + dz * (side < 0 ? 1 : 1));
      group.add(p);
    }
    group.add(holder);
  }

  // Centre-hung four-sided video cube (arena style): every face shows the same live score.
  {
    const cube = new THREE.Group();
    const size = 3.6, fh = 0.9;
    const body = new THREE.Mesh(new THREE.BoxGeometry(size, fh + 0.5, size), frameMat);
    body.position.y = 0;
    cube.add(body);
    for (let i = 0; i < 4; i++) {
      const s = makeScreen();
      boards.push(s);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(size - 0.1, fh),
        new THREE.MeshBasicMaterial({ map: s.tex, toneMapped: false }));
      const holder = new THREE.Group();
      holder.add(face);
      face.position.z = size / 2 + 0.01;
      holder.rotation.y = (i * Math.PI) / 2;
      cube.add(holder);
    }
    cube.position.set(L / 2, 10.0, -W / 2);
    group.add(cube);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 3.3, 6), frameMat);
      cable.position.set(L / 2 + dx * 1.5, 11.65, -W / 2 + dz * 1.5);
      group.add(cable);
    }
  }

  const api = {
    group,
    set(patch) {
      Object.assign(state, patch);
      for (const s of boards) { draw(s, state); s.tex.needsUpdate = true; }
    },
    state,
  };
  api.set({});
  return api;
}
