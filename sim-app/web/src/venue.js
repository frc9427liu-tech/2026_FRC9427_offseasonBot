// Event venue: a bright indoor arena. Light walls with banners, a ceiling with trusses and light panels,
// polished floor, alliance-colour accents. The field stays the focal point; the room is evenly lit, not dark.
import * as THREE from 'three';
import { FIELD_L, FIELD_W } from './field.js';

const L = FIELD_L * 0.0254, W = FIELD_W * 0.0254;

function bannerTexture(color, text) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 768;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 768);
  grad.addColorStop(0, color);
  grad.addColorStop(1, '#0a1a3a');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 768);
  g.strokeStyle = 'rgba(255,255,255,.75)';
  g.lineWidth = 6;
  g.strokeRect(12, 12, 232, 744);
  g.fillStyle = '#fff';
  g.font = 'italic 900 64px "Segoe UI", sans-serif';
  g.textAlign = 'center';
  g.save();
  g.translate(128, 384);
  g.rotate(-Math.PI / 2);
  g.fillText(text, 0, 22);
  g.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function wallTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#d9dde3';
  g.fillRect(0, 0, 512, 512);
  g.strokeStyle = 'rgba(90,100,115,.28)';
  g.lineWidth = 2;
  for (let x = 0; x <= 512; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); }
  for (let y = 0; y <= 512; y += 256) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildVenue() {
  const g = new THREE.Group();
  const cx = L / 2, cz = -W / 2;
  const X0 = -17, X1 = L + 17, Zfar = -W - 15.5, Znear = 17, H = 13;

  // Floor: polished concrete beyond the field
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0 + 4, Znear - Zfar + 4),
    new THREE.MeshStandardMaterial({ color: 0x5c6269, roughness: 0.6, metalness: 0.04 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, -0.012, (Znear + Zfar) / 2);
  floor.receiveShadow = true;
  g.add(floor);

  // Walls
  const wt = wallTexture();
  const wallMat = (rx, ry) => { const t = wt.clone(); t.needsUpdate = true; t.repeat.set(rx, ry); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }); };
  const navy = new THREE.MeshStandardMaterial({ color: 0x1a2b52, roughness: 0.8 });
  const wall = (w, h, x, y, z, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat(w / 4, h / 4));
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.receiveShadow = true;
    g.add(m);
    const band = new THREE.Mesh(new THREE.PlaneGeometry(w, 2.4), navy);
    band.position.set(x, 1.2, z);
    band.rotation.y = ry;
    const off = 0.01 * (ry === 0 ? 1 : ry > 0 ? -1 : 1);
    band.position.z += ry === 0 ? off : 0;
    band.position.x += ry === 0 ? 0 : (ry > 0 ? -off : off);
    g.add(band);
  };
  wall(X1 - X0, H, cx, H / 2, Zfar, 0);                    // far wall (faces +Z)
  wall(X1 - X0, H, cx, H / 2, Znear, Math.PI);             // table-side wall (faces -Z)
  wall(Znear - Zfar, H, X0, H / 2, (Znear + Zfar) / 2, Math.PI / 2);   // blue end wall
  wall(Znear - Zfar, H, X1, H / 2, (Znear + Zfar) / 2, -Math.PI / 2);  // red end wall

  // Banners along the far wall and ends, alternating alliance colours
  const banner = (x, y, z, ry, color, text) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 4.8), new THREE.MeshStandardMaterial({ map: bannerTexture(color, text), roughness: 0.7 }));
    m.position.set(x, y, z);
    m.rotation.y = ry;
    g.add(m);
  };
  for (let i = 0; i < 9; i++) {
    const x = X0 + 4 + i * ((X1 - X0 - 8) / 8);
    banner(x, 6.4, Zfar + 0.05, 0, i % 2 ? '#c8202f' : '#1f5fd0', 'REBUILT');
  }
  for (let i = 0; i < 9; i++) { // referee-side wall: same banners, plus a long sponsor strip
    const x = X0 + 4 + i * ((X1 - X0 - 8) / 8);
    banner(x, 6.4, Znear - 0.05, Math.PI, i % 2 ? '#1f5fd0' : '#c8202f', 'FIRST ROBOTICS');
  }
  {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0 - 6, 1.1),
      new THREE.MeshStandardMaterial({ color: 0x14274f, roughness: 0.7 }));
    strip.position.set(cx, 3.6, Znear - 0.04);
    strip.rotation.y = Math.PI;
    g.add(strip);
  }
  for (let j = 0; j < 4; j++) {
    const z = Zfar + 6 + j * 8;
    banner(X0 + 0.05, 6.4, z, Math.PI / 2, '#1f5fd0', 'BLUE ALLIANCE');
    banner(X1 - 0.05, 6.4, z, -Math.PI / 2, '#c8202f', 'RED ALLIANCE');
  }

  // Ceiling with steel trusses and light panels
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, Znear - Zfar),
    new THREE.MeshStandardMaterial({ color: 0xc9ced6, roughness: 0.95, side: THREE.DoubleSide }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(cx, H, (Znear + Zfar) / 2);
  g.add(ceil);
  const steel = new THREE.MeshStandardMaterial({ color: 0x6d7580, roughness: 0.5, metalness: 0.8 });
  for (let i = 0; i < 8; i++) {
    const x = X0 + (i + 0.5) * (X1 - X0) / 8;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.5, Znear - Zfar), steel);
    beam.position.set(x, H - 0.4, (Znear + Zfar) / 2);
    g.add(beam);
  }
  const panelMat = new THREE.MeshBasicMaterial({ color: 0xfff6e6 });
  const spots = [];
  const nx = 8, nz = 5;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const x = X0 + (i + 0.5) * (X1 - X0) / nx + 2;
      const z = Zfar + (j + 0.5) * (Znear - Zfar) / nz;
      const panel = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.15, 1.2), panelMat);
      panel.position.set(x, H - 0.75, z);
      g.add(panel);
      spots.push([x, z]);
    }
  }
  // spot pools on the floor: stronger over the field, softer over the stands
  for (const [x, z] of spots) {
    const overField = x > -2 && x < L + 2 && z > -W - 2 && z < 2;
    const s = new THREE.SpotLight(0xfff2de, overField ? 60 : 26, 34, 0.7, 0.85, 1.1);
    s.position.set(x, H - 0.8, z);
    s.target.position.set(x, 0, z);
    g.add(s, s.target);
  }
  return g;
}
