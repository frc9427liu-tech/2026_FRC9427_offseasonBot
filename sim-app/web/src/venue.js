// Event venue: a bright indoor arena. Light walls with banners, a ceiling with trusses and light panels,
// polished floor, alliance-colour accents. The field stays the focal point; the room is evenly lit, not dark.
import * as THREE from 'three';
import { FIELD_L, FIELD_W } from './field.js';

const L = FIELD_L * 0.0254, W = FIELD_W * 0.0254;

// Printed fabric banner: a solid colour (a hard top-to-navy fade and a bright white keyline read as a flat
// vector graphic, not cloth) with woven-fabric grain, a soft vignette toward the edges, and a sewn hem top
// and bottom instead of a stroked outline.
function bannerTexture(color, text) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 768;
  const g = c.getContext('2d');
  g.fillStyle = color;
  g.fillRect(0, 0, 256, 768);
  // fabric weave grain
  for (let i = 0; i < 6000; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.04)';
    g.fillRect(Math.random() * 256, Math.random() * 768, 1.5, 1.5);
  }
  // gentle vignette so the edges recede instead of a hard-edged colour block
  const vg = g.createRadialGradient(128, 384, 120, 128, 384, 420);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,.32)');
  g.fillStyle = vg;
  g.fillRect(0, 0, 256, 768);
  // sewn hem: a darker folded band top and bottom with stitch dashes, not a bright outline
  for (const y of [0, 768 - 26]) {
    g.fillStyle = 'rgba(0,0,0,.22)';
    g.fillRect(0, y, 256, 26);
    g.strokeStyle = 'rgba(255,255,255,.3)';
    g.setLineDash([6, 6]);
    g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(0, y + 13); g.lineTo(256, y + 13); g.stroke();
    g.setLineDash([]);
  }
  // grommets at the top corners, where the hanging cable ties on
  g.fillStyle = '#cfd3d8';
  for (const x of [22, 234]) { g.beginPath(); g.arc(x, 13, 7, 0, Math.PI * 2); g.fill(); g.fillStyle = '#3a3f46'; g.beginPath(); g.arc(x, 13, 3.5, 0, Math.PI * 2); g.fill(); g.fillStyle = '#cfd3d8'; }
  g.fillStyle = 'rgba(255,255,255,.92)';
  g.font = 'italic 900 62px "Segoe UI", sans-serif';
  g.textAlign = 'center';
  g.save();
  g.translate(128, 400);
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
  g.fillStyle = '#aab0b9';   // was near-white; a real precast/drywall arena wall reads mid-grey under these lights
  g.fillRect(0, 0, 512, 512);
  g.strokeStyle = 'rgba(40,46,54,.35)';
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
  // Concourse depth beyond the stands' back wall: was ~6-7.5 m of bare dead floor on three sides (the stands
  // back wall stops around field-edge + 9.5 m); tightened to a walkable ~3 m so the room isn't mostly empty.
  const X0 = -12.5, X1 = L + 12.5, Zfar = -W - 12.5, Znear = 17, H = 13;

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
    new THREE.MeshStandardMaterial({ color: 0x8f95a0, roughness: 0.95, side: THREE.DoubleSide }));   // was near-white
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
  const panelMat = new THREE.MeshBasicMaterial({ color: 0xe4dcc3 });   // warm light panel, dimmed so it reads as a lit fixture, not a blown-out card
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
  // Light pools on the floor: stronger over the field, softer over the stands. Every real light costs every
  // fragment of every lit material, so the 40 panels are lit by only 12 wider spots.
  const lights = [];
  const lnx = 4, lnz = 3;
  for (let i = 0; i < lnx; i++) {
    for (let j = 0; j < lnz; j++) {
      lights.push([X0 + (i + 0.5) * (X1 - X0) / lnx + 2, Zfar + (j + 0.5) * (Znear - Zfar) / lnz]);
    }
  }
  const boost = spots.length / lights.length;
  for (const [x, z] of lights) {
    const overField = x > -2 && x < L + 2 && z > -W - 2 && z < 2;
    const s = new THREE.SpotLight(0xfff2de, (overField ? 60 : 26) * boost, 46, 0.95, 0.9, 1.1);
    s.position.set(x, H - 0.8, z);
    s.target.position.set(x, 0, z);
    g.add(s, s.target);
  }
  return g;
}
