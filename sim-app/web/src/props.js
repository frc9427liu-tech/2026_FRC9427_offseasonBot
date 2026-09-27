// Venue props: broadcast cameras, FTA tent, LED ribbon board, exit gates, hanging pennant flags.
import * as THREE from 'three';
import { FIELD_L, FIELD_W } from './field.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { STAND_TOP_H, ROOM, DOORS, DOOR_W, DOOR_H } from './stands.js';

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

  // Doors: every opening in the outer walls (stands.js DOORS; venue.js cuts the matching hole in the wall).
  // Each one is a real open doorway on the concourse level - steel frame, both leaves swung open, and a
  // short passage behind it lit by a ceiling fitting - so it reads as a way through to the corridors behind
  // the stands, not a black panel stuck on the wall.
  const frame = new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 0.45, metalness: 0.7 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x23272e, roughness: 0.5, metalness: 0.5 });
  const alcoveMat = new THREE.MeshStandardMaterial({ color: 0x5a2a2e, roughness: 0.85 });   // maroon portal, per the reference
  const landingMat = new THREE.MeshStandardMaterial({ color: 0x6b727b, roughness: 0.8 });
  const passageMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff1d8 });
  const signTex = (text, bg) => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const x = c.getContext('2d');
    x.fillStyle = bg; x.fillRect(0, 0, 256, 64);
    x.fillStyle = '#ffffff'; x.font = '700 38px "Segoe UI", sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, 128, 34);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  const signMats = {
    entrance: new THREE.MeshBasicMaterial({ map: signTex('ENTRANCE', '#1f5fd0') }),
    exit: new THREE.MeshBasicMaterial({ map: signTex('EXIT', '#15a34a') }),
  };
  // The passage shell (floor, ceiling, side walls, back wall) as one vertex-coloured mesh with the lighting
  // baked in: dim warm light spilling from a ceiling fitting ~1 m in, falling off toward the back.
  const passageGeo = (() => {
    const dw = DOOR_W, dh = DOOR_H, depth = 2.6, lampZ = -1.0;
    const parts = [];
    const plane = (w, h, sx, sy, m) => { const g = new THREE.PlaneGeometry(w, h, sx, sy); g.applyMatrix4(m); parts.push(g); };
    const M = () => new THREE.Matrix4();
    plane(dw, depth, 1, 8, M().makeRotationX(-Math.PI / 2).setPosition(0, 0.002, -depth / 2));        // floor
    plane(dw, depth, 1, 8, M().makeRotationX(Math.PI / 2).setPosition(0, dh, -depth / 2));             // ceiling
    plane(depth, dh, 8, 4, M().makeRotationY(Math.PI / 2).setPosition(-dw / 2, dh / 2, -depth / 2));   // left side
    plane(depth, dh, 8, 4, M().makeRotationY(-Math.PI / 2).setPosition(dw / 2, dh / 2, -depth / 2));   // right side
    plane(dw, dh, 1, 4, M().setPosition(0, dh / 2, -depth));                                          // back
    const g = mergeGeometries(parts);
    const p = g.attributes.position, col = [];
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), z = p.getZ(i);
      const t = -z / depth;
      const pool = 0.22 * Math.exp(-((z - lampZ) ** 2) / 0.6) * (0.4 + 0.6 * (1 - Math.abs(y - dh) / dh));
      const v = 0.07 * (1 - t) + 0.015 + pool;
      col.push(v, v * 0.88, v * 0.72);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return g;
  })();
  const doorway = (x, z, ry, kind) => {
    const d = new THREE.Group();   // local: +Z into the room, X along the wall, y=0 at the concourse floor
    const dw = DOOR_W, dh = DOOR_H;
    d.add(new THREE.Mesh(passageGeo, passageMat));
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.14), lampMat);
    lamp.position.set(0, dh - 0.02, -1.0);
    d.add(lamp);
    const add = (geo, mat, px, py, pz, rotY = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.rotation.y = rotY; m.castShadow = true; d.add(m); return m; };
    // steel frame (head + jambs) proud of the wall
    add(new THREE.BoxGeometry(dw + 0.2, 0.1, 0.08), frame, 0, dh + 0.05, 0.04);
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.1, dh + 0.1, 0.08), frame, s * (dw / 2 + 0.05), (dh + 0.1) / 2, 0.04);
    // both leaves standing open, swung ~80 degrees back into the passage
    const th = 80 * Math.PI / 180;
    for (const s of [-1, 1]) {
      const hx = s * (dw / 2 - 0.03), hz = -0.06;
      const leaf = add(new THREE.BoxGeometry(dw / 2 - 0.04, dh - 0.04, 0.04), leafMat,
        hx - s * Math.cos(th) * (dw / 4 - 0.02), (dh - 0.04) / 2, hz - Math.sin(th) * (dw / 4 - 0.02), -s * th);
      leaf.castShadow = false;
    }
    // entrances get the maroon portal surround from the reference; exits just the frame
    if (kind === 'entrance') {
      const bw = 0.28, pz = 0.015;
      add(new THREE.BoxGeometry(dw + 0.2 + 2 * bw, bw, 0.03), alcoveMat, 0, dh + 0.1 + bw / 2, pz);
      for (const s of [-1, 1]) add(new THREE.BoxGeometry(bw, dh + 0.1, 0.03), alcoveMat, s * (dw / 2 + 0.1 + bw / 2), (dh + 0.1) / 2, pz);
    }
    const sign = add(new THREE.PlaneGeometry(0.9, 0.225), signMats[kind], 0, dh + (kind === 'entrance' ? 0.62 : 0.3), 0.05);
    sign.castShadow = false;
    const landing = add(new THREE.BoxGeometry(dw + 0.2, 0.01, 1.0), landingMat, 0, 0.005, 0.5);
    landing.castShadow = false;
    d.position.set(x, STAND_TOP_H, z);
    d.rotation.y = ry;
    g.add(d);
  };
  for (const door of DOORS) {
    if (door.wall === 'far') doorway(door.at, ROOM.Zfar, 0, door.kind);
    else if (door.wall === 'near') doorway(door.at, ROOM.Znear, Math.PI, door.kind);
    else if (door.wall === 'blue') doorway(ROOM.X0, door.at, Math.PI / 2, door.kind);
    else doorway(ROOM.X1, door.at, -Math.PI / 2, door.kind);
  }

  return {
    group: g,
    update(t) {
      ribbon.children.forEach((m) => { m.material.map.offset.x = (t * 0.05) % 1; });
    },
  };
}
