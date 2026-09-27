// Venue props: broadcast cameras, FTA tent, LED ribbon board, exit gates, hanging pennant flags.
import * as THREE from 'three';
import { FIELD_L, FIELD_W } from './field.js';
import { CX, CZ, AISLE_END_Z } from './stands.js';

const L = FIELD_L * 0.0254, W = FIELD_W * 0.0254;
const dark = () => new THREE.MeshStandardMaterial({ color: 0x1b1f26, roughness: 0.5, metalness: 0.4 });

export function tripodCamera(x, z, faceZ = -1) {
  const g = new THREE.Group();
  const leg = dark();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 1.45, 8), leg);
    l.position.set(Math.cos(a) * 0.22, 0.68, Math.sin(a) * 0.22);
    l.rotation.z = -Math.cos(a) * 0.2;
    l.rotation.x = Math.sin(a) * 0.2;
    g.add(l);
  }
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.42), dark());
  head.position.set(0, 1.5, 0);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.5), new THREE.MeshStandardMaterial({ color: 0x2b3038, roughness: 0.4, metalness: 0.5 }));
  body.position.set(0, 1.66, 0.02);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.42, 16), new THREE.MeshStandardMaterial({ color: 0x0e1014, roughness: 0.25, metalness: 0.6 }));
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, 1.66, -0.4);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.07, 16), new THREE.MeshStandardMaterial({ color: 0x3a5a8a, roughness: 0.05, metalness: 0.9 }));
  glass.position.set(0, 1.66, -0.612);
  glass.rotation.y = Math.PI;
  const view = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.03), new THREE.MeshBasicMaterial({ color: 0x86b8ff }));
  view.position.set(0, 1.82, 0.28);
  g.add(head, body, lens, glass, view);
  g.position.set(x, 0, z);
  g.rotation.y = faceZ > 0 ? Math.PI : 0;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

function ftaTent(x, z) {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xeef1f5, roughness: 0.85, side: THREE.DoubleSide });
  const blue = new THREE.MeshStandardMaterial({ color: 0x1f5fd0, roughness: 0.85, side: THREE.DoubleSide });
  const metal = new THREE.MeshStandardMaterial({ color: 0xc4c9d0, roughness: 0.4, metalness: 0.9 });
  const s = 3.0, h = 2.4;
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, h, 8), metal);
    p.position.set(dx * s / 2, h / 2, dz * s / 2);
    g.add(p);
  }
  const roof = new THREE.Mesh(new THREE.ConeGeometry(s * 0.95, 0.7, 4, 1, true), blue);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = h + 0.35;
  const valance = new THREE.Mesh(new THREE.BoxGeometry(s + 0.1, 0.35, s + 0.1), white);
  valance.position.y = h - 0.15;
  valance.material = white;
  g.add(roof);
  const table = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.05, 0.8), new THREE.MeshStandardMaterial({ color: 0xdfe3e8, roughness: 0.5 }));
  table.position.set(0, 0.75, 0);
  const legT = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.72, 0.7), new THREE.MeshStandardMaterial({ color: 0x14171d, roughness: 0.9 }));
  legT.position.set(0, 0.36, 0);
  g.add(table, legT);
  const lap = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 0.24), dark());
  lap.position.set(-0.4, 0.79, 0);
  g.add(lap);
  g.position.set(x, 0, z);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function ribbonTexture() {
  const c = document.createElement('canvas');
  c.width = 2048; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#06122a';
  g.fillRect(0, 0, 2048, 64);
  g.font = '700 40px "Segoe UI", sans-serif';
  g.textBaseline = 'middle';
  const items = [['REBUILT', '#f2c14e'], ['FRC 9427', '#ffffff'], ['BLUE ALLIANCE', '#4da3ff'], ['RED ALLIANCE', '#ff5560'], ['GRACIOUS PROFESSIONALISM', '#c6d6ff']];
  let x = 20;
  for (let i = 0; i < 8; i++) {
    const [t, col] = items[i % items.length];
    g.fillStyle = col;
    g.fillText(t, x, 34);
    x += g.measureText(t).width + 90;
    g.fillStyle = '#48688f';
    g.fillText('◆', x - 60, 34);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(1, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildProps() {
  const g = new THREE.Group();

  // Broadcast cameras on the referee side (operators are spawned in crowd.js at the same spots)
  g.add(tripodCamera(L * 0.22, 4.3));
  g.add(tripodCamera(L * 0.78, 4.3));
  g.add(tripodCamera(-4.4, -W / 2, 1)); // low camera at the blue end aisle, looking down the field

  // FTA tent in the referee-side corner
  g.add(ftaTent(-6.5, 5.2));

  // Scrolling LED ribbon along the front of the stands (a real strip of LEDs, not a flat colour)
  const tex = ribbonTexture();
  const ribbon = new THREE.Group();
  const seg = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.2), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    m.position.set((x0 + x1) / 2, 0.66, (z0 + z1) / 2);
    m.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    m.material.map = tex.clone();
    m.material.map.repeat.set(len / 8, 1);
    m.material.map.wrapS = THREE.RepeatWrapping;
    m.material.map.needsUpdate = true;
    ribbon.add(m);
  };
  const cz = -W / 2;
  seg(-3.35, cz - W / 2 - 3.36, L + 3.35, cz - W / 2 - 3.36); // audience straight, just in front of the barrier
  g.add(ribbon);

  // Exit gates on both end walls, near the referee side
  const gateMat = new THREE.MeshStandardMaterial({ color: 0x0b0d11, roughness: 0.9 });
  const frame = new THREE.MeshStandardMaterial({ color: 0xc4c9d0, roughness: 0.4, metalness: 0.8 });
  const exit = new THREE.MeshBasicMaterial({ color: 0x25d366 });
  for (const s of [-1, 1]) {
    const x = s < 0 ? -12.45 : L + 12.45;   // just inside the venue end wall (venue.js X0/X1 = ∓12.5)
    for (const z of [8.5, -3]) {
      const door = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.2), gateMat);
      door.position.set(x, 1.6, z);
      door.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2;
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 2.7), frame);
      top.position.set(x, 3.3, z);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.3), exit);
      sign.position.set(x + (s < 0 ? 0.06 : -0.06), 3.75, z);
      sign.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2;
      g.add(door, top, sign);
    }
  }

  // Main entrance doors: one where each of the three stand aisles (stands.js) actually reaches the outer
  // wall, so "walk in through the aisle" has a real door at the end of it, not just an open wall panel.
  // Positions must track venue.js's current room bounds (X0/X1/Zfar = ∓12.5 / -W-12.5).
  const X0V = -12.45, X1V = L + 12.45, ZfarV = -W - 12.45;
  const entrance = new THREE.MeshBasicMaterial({ color: 0x3a8dff });
  const doorway = (x, z, ry) => {
    const door = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.2), gateMat);
    door.position.set(x, 1.6, z);
    door.rotation.y = ry;
    // width on local X to match PlaneGeometry's own width axis, so rotating both by the same ry keeps
    // the lintel spanning the doorway instead of poking edge-on into the room (was swapped X/Z - the
    // beam only happened to look right on the two ry=90 doors and stuck out as a thin peg at ry=0)
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.2, 0.15), frame);
    top.position.set(x, 3.3, z);
    top.rotation.y = ry;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.32), entrance);
    const inset = 0.06;
    sign.position.set(x + Math.sin(ry) * inset, 3.75, z + Math.cos(ry) * inset);
    sign.rotation.y = ry;
    g.add(door, top, sign);
  };
  doorway(CX, ZfarV + 0.02, 0);                       // audience-straight aisle -> far wall
  doorway(X0V + 0.02, CZ + AISLE_END_Z, Math.PI / 2);  // left-end aisle -> blue end wall
  doorway(X1V - 0.02, CZ + AISLE_END_Z, -Math.PI / 2); // right-end aisle -> red end wall

  return {
    group: g,
    update(t) {
      ribbon.children.forEach((m) => { m.material.map.offset.x = (t * 0.05) % 1; });
    },
  };
}
