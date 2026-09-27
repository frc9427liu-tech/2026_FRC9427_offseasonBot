// Venue props: broadcast cameras, FTA tent, LED ribbon board, exit gates, hanging pennant flags.
import * as THREE from 'three';
import { FIELD_L, FIELD_W } from './field.js';
import { CX, CZ, AISLE_END_Z, STAND_TOP_H } from './stands.js';

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
    for (const z of [15, -3]) {   // was 8.5: inside the referee-side stand block's own footprint (z 8.4-13.4), blocked by it
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
  const alcoveMat = new THREE.MeshStandardMaterial({ color: 0x5a2a2e, roughness: 0.85 });   // recessed maroon frame, per the reference
  const doorway = (x, z, ry) => {
    // The stands step UP from the field floor; the aisle behind them (and its handrail) reaches the outer
    // wall at the TOP of that climb, not at ground level - the door was floating at y=0 before, well above
    // the actual concourse floor and disconnected from the steps leading up to it. h0 is that floor height.
    const h0 = STAND_TOP_H;
    // Real proportions: a double door is about 1.7m wide, 2.2m tall (roughly 1.3x a person's height) -
    // the previous door (2.6 x 3.2) and its alcove (4.2 tall!) were nearly double that, reading as a
    // structure a person couldn't plausibly walk through, half-swallowed by the truss above.
    const dw = 1.7, dh = 2.2, recess = 0.35;
    const fwd = [Math.sin(ry), Math.cos(ry)];   // the +Z-after-rotation direction (into the room), used throughout
    // recessed passage: back panel + two side jambs, so it reads as an actual cut opening with depth, not
    // a coloured decal stuck flat on the wall
    const back = new THREE.Mesh(new THREE.BoxGeometry(dw + 0.5, dh + 0.4, 0.1), alcoveMat);
    back.position.set(x - fwd[0] * recess, h0 + (dh + 0.4) / 2, z - fwd[1] * recess);
    back.rotation.y = ry;
    g.add(back);
    for (const side of [-1, 1]) {
      const jamb = new THREE.Mesh(new THREE.BoxGeometry(recess, dh + 0.4, 0.1), alcoveMat);
      const jx = x + Math.cos(ry) * side * (dw + 0.5) / 2, jz = z - Math.sin(ry) * side * (dw + 0.5) / 2;
      jamb.position.set(jx - fwd[0] * recess / 2, h0 + (dh + 0.4) / 2, jz - fwd[1] * recess / 2);
      jamb.rotation.y = ry;
      g.add(jamb);
    }
    const door = new THREE.Mesh(new THREE.PlaneGeometry(dw, dh), gateMat);
    door.position.set(x, h0 + dh / 2, z);
    door.rotation.y = ry;
    const top = new THREE.Mesh(new THREE.BoxGeometry(dw + 0.15, 0.15, 0.12), frame);
    top.position.set(x, h0 + dh + 0.08, z);
    top.rotation.y = ry;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.24), entrance);
    const inset = 0.06;
    sign.position.set(x + fwd[0] * inset, h0 + dh + 0.4, z + fwd[1] * inset);
    sign.rotation.y = ry;
    // a short landing/threshold plate at the door so the floor doesn't just stop under it
    const landing = new THREE.Mesh(new THREE.BoxGeometry(dw + 0.2, 0.01, 1.0), new THREE.MeshStandardMaterial({ color: 0x6b727b, roughness: 0.8 }));
    landing.rotation.y = ry;
    landing.position.set(x + fwd[0] * 0.5, h0 + 0.005, z + fwd[1] * 0.5);
    g.add(door, top, sign, landing);
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
