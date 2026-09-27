// Event venue: a bright indoor arena. Light walls with banners, a ceiling with trusses and light panels,
// polished floor, alliance-colour accents. The field stays the focal point; the room is evenly lit, not dark.
import * as THREE from 'three';
import { FIELD_L, FIELD_W } from './field.js';
import { DOORS, DOOR_W, DOOR_H, STAND_TOP_H } from './stands.js';

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
  // Warm cream, not cool grey: the user's own reference mockup for the venue (outside the field, which
  // stays untouched) is a warmer, more finished convention-hall palette - cream wall panels with a wood-tone
  // band, golden light, wood-look concourse floor - rather than an industrial grey box.
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#d9cbaa';
  g.fillRect(0, 0, 512, 512);
  g.strokeStyle = 'rgba(70,55,35,.28)';
  g.lineWidth = 2;
  for (let x = 0; x <= 512; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); }
  for (let y = 0; y <= 512; y += 256) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Wood-look plank floor for the concourse (outside the field/stands, which keep their own carpet/deck)
function floorTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const planks = 8, ph = 256 / planks;
  for (let i = 0; i < planks; i++) {
    const base = 130 + Math.floor(Math.random() * 25);
    g.fillStyle = `rgb(${base},${base - 35},${base - 65})`;
    g.fillRect(0, i * ph, 256, ph);
    g.strokeStyle = 'rgba(40,25,12,.5)'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(0, i * ph); g.lineTo(256, i * ph); g.stroke();
    for (let n = 0; n < 60; n++) { g.strokeStyle = `rgba(60,40,20,${0.03 + Math.random() * 0.05})`; const y = i * ph + Math.random() * ph; g.beginPath(); g.moveTo(Math.random() * 256, y); g.lineTo(Math.random() * 256, y); g.stroke(); }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Micro-roughness variation so the gloss isn't perfectly uniform (a sealed gym floor has faint wear/scuff
// patches), not a texture map - just noise, so it stays cheap and tileable at any repeat.
function floorRoughnessTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#5c5c5c'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 400; i++) {
    const v = 60 + Math.floor(Math.random() * 90);
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.beginPath(); g.arc(Math.random() * 128, Math.random() * 128, 2 + Math.random() * 6, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function buildVenue() {
  const g = new THREE.Group();
  const cx = L / 2, cz = -W / 2;
  // Concourse depth beyond the stands' back wall: was ~6-7.5 m of bare dead floor on three sides (the stands
  // back wall stops around field-edge + 9.5 m); tightened to a walkable ~3 m so the room isn't mostly empty.
  const X0 = -12.5, X1 = L + 12.5, Zfar = -W - 12.5, Znear = 17, H = 13;

  // Floor: wood-look concourse beyond the field/stands (which keep their own carpet/deck untouched) -
  // sealed-gym-floor gloss: lower base roughness, a roughness map for faint uneven wear, and enough
  // envMapIntensity to actually pick up the room reflection (IBL) instead of reading as a flat diffuse map.
  const ftex = floorTexture();
  const frough = floorRoughnessTexture();
  ftex.repeat.set((X1 - X0 + 4) / 3, (Znear - Zfar + 4) / 3);
  frough.repeat.set((X1 - X0 + 4) / 2, (Znear - Zfar + 4) / 2);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0 + 4, Znear - Zfar + 4),
    new THREE.MeshStandardMaterial({ map: ftex, roughnessMap: frough, roughness: 0.28, envMapIntensity: 0.8 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, -0.012, (Znear + Zfar) / 2);
  floor.receiveShadow = true;
  g.add(floor);

  // Walls
  const wt = wallTexture();
  // shape-UV walls: ShapeGeometry UVs are in metres, so one texture tile = 4 m like the old w/4 repeat
  const wallMat = () => { const t = wt.clone(); t.needsUpdate = true; t.repeat.set(0.25, 0.25); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }); };
  const navy = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.6 });   // wood-tone accent band
  // Each wall has a real opening cut for every door in it (stands.js DOORS), so the passage props.js builds
  // behind the wall actually shows through. The wood band runs at the concourse level (the floor below it is
  // all covered by the concourse now) and is broken at each door.
  const bandH = 1.0;
  const wall = (name, w, h, x, y, z, ry) => {
    const holes = DOORS.filter((d) => d.wall === name).map((d) => {
      const dx = (name === 'far' || name === 'near' ? d.at : x) - x, dz = (name === 'far' || name === 'near' ? z : d.at) - z;
      return dx * Math.cos(ry) - dz * Math.sin(ry);   // along-wall offset in the wall's own local X
    });
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, -h / 2); shape.lineTo(w / 2, -h / 2); shape.lineTo(w / 2, h / 2); shape.lineTo(-w / 2, h / 2); shape.closePath();
    const y0 = STAND_TOP_H - h / 2;
    for (const u of holes) {
      const p = new THREE.Path();
      p.moveTo(u - DOOR_W / 2, y0); p.lineTo(u - DOOR_W / 2, y0 + DOOR_H); p.lineTo(u + DOOR_W / 2, y0 + DOOR_H); p.lineTo(u + DOOR_W / 2, y0); p.closePath();
      shape.holes.push(p);
    }
    const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), wallMat());
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.receiveShadow = true;
    g.add(m);
    // band segments between the door openings
    const cuts = [-w / 2, ...holes.sort((a, b) => a - b).flatMap((u) => [u - DOOR_W / 2 - 0.4, u + DOOR_W / 2 + 0.4]), w / 2];
    for (let i = 0; i < cuts.length; i += 2) {
      const a = cuts[i], b = cuts[i + 1];
      if (b - a < 0.05) continue;
      const band = new THREE.Mesh(new THREE.PlaneGeometry(b - a, bandH), navy);
      band.position.set((a + b) / 2, STAND_TOP_H + bandH / 2 - h / 2, 0.01);
      band.position.applyEuler(new THREE.Euler(0, ry, 0)).add(new THREE.Vector3(x, y, z));
      band.rotation.y = ry;
      g.add(band);
    }
  };
  wall('far', X1 - X0, H, cx, H / 2, Zfar, 0);                    // far wall (faces +Z)
  wall('near', X1 - X0, H, cx, H / 2, Znear, Math.PI);            // table-side wall (faces -Z)
  wall('blue', Znear - Zfar, H, X0, H / 2, (Znear + Zfar) / 2, Math.PI / 2);   // blue end wall
  wall('red', Znear - Zfar, H, X1, H / 2, (Znear + Zfar) / 2, -Math.PI / 2);  // red end wall

  // Banners along the far wall and ends, alternating alliance colours. One hanging height everywhere:
  // bottom edge at 5.0 m, clear of the concourse doors and the referee-side sponsor strip (3.85-4.95 m).
  const BANNER_Y = 5.0 + 4.8 / 2;
  const banner = (x, y, z, ry, color, text) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 4.8), new THREE.MeshStandardMaterial({ map: bannerTexture(color, text), roughness: 0.7 }));
    m.position.set(x, y, z);
    m.rotation.y = ry;
    g.add(m);
  };
  for (let i = 0; i < 9; i++) {
    if (i === 4) continue;   // centre of the far wall is the main entrance door
    const x = X0 + 4 + i * ((X1 - X0 - 8) / 8);
    banner(x, BANNER_Y, Zfar + 0.05, 0, i % 2 ? '#c8202f' : '#1f5fd0', 'REBUILT');
  }
  for (let i = 0; i < 9; i++) { // referee-side wall: same banners, plus a long sponsor strip
    const x = X0 + 4 + i * ((X1 - X0 - 8) / 8);
    banner(x, BANNER_Y, Znear - 0.05, Math.PI, i % 2 ? '#1f5fd0' : '#c8202f', 'FIRST ROBOTICS');
  }
  {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0 - 6, 1.1),
      new THREE.MeshStandardMaterial({ color: 0x14274f, roughness: 0.7 }));
    strip.position.set(cx, 4.4, Znear - 0.04);   // above the concourse-level wood band (2.4-3.4 m)
    strip.rotation.y = Math.PI;
    g.add(strip);
  }
  for (let j = 0; j < 4; j++) {
    const z = Zfar + 6 + j * 8;
    banner(X0 + 0.05, BANNER_Y, z, Math.PI / 2, '#1f5fd0', 'BLUE ALLIANCE');
    banner(X1 - 0.05, BANNER_Y, z, -Math.PI / 2, '#c8202f', 'RED ALLIANCE');
  }

  // Ceiling: exposed steel bar-joist trusses under a corrugated roof deck, chain-hung can lights and a
  // speaker/truss rig - not a finished drop ceiling with flush panels (reference: real FRC venues are
  // gyms/expo halls with the structure exposed, e.g. assets-src venue photos, FIRST Championship photos).
  const deckTex = (() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const g2 = c.getContext('2d');
    g2.fillStyle = '#3a4048'; g2.fillRect(0, 0, 64, 64);
    g2.strokeStyle = 'rgba(0,0,0,.35)'; g2.lineWidth = 3;
    for (let x = 0; x <= 64; x += 8) { g2.beginPath(); g2.moveTo(x, 0); g2.lineTo(x, 64); g2.stroke(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  })();
  deckTex.repeat.set((X1 - X0) / 1.2, (Znear - Zfar) / 1.2);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, Znear - Zfar),
    new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.8, metalness: 0.4, side: THREE.DoubleSide }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(cx, H, (Znear + Zfar) / 2);
  g.add(ceil);
  // Two long clerestory skylights, each a grid of glowing glass lights divided by white mullion bars (the
  // reference's distinctive greenhouse-style angled roof glazing, not a plain glowing strip).
  const mullionTex = (() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 512;
    const g2 = c.getContext('2d');
    g2.fillStyle = '#ffe9bf'; g2.fillRect(0, 0, 128, 512);
    g2.strokeStyle = '#f2ede0'; g2.lineWidth = 10;
    for (let x = 0; x <= 128; x += 64) { g2.beginPath(); g2.moveTo(x, 0); g2.lineTo(x, 512); g2.stroke(); }
    for (let y = 0; y <= 512; y += 64) { g2.beginPath(); g2.moveTo(0, y); g2.lineTo(128, y); g2.stroke(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  })();
  for (const sx of [cx - (X1 - X0) * 0.22, cx + (X1 - X0) * 0.22]) {
    const len = Znear - Zfar - 4;
    const tex = mullionTex.clone(); tex.needsUpdate = true; tex.repeat.set(1, len / 4);
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(3.2, len), new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffcf7a, emissiveIntensity: 1.0, emissiveMap: tex, roughness: 0.6, side: THREE.DoubleSide }));
    sky.rotation.x = Math.PI / 2;
    sky.position.set(sx, H - 0.02, (Znear + Zfar) / 2);
    g.add(sky);
  }

  const steel = new THREE.MeshStandardMaterial({ color: 0x6d7580, roughness: 0.5, metalness: 0.8 });
  const nTruss = 8;
  const spots = [];
  for (let i = 0; i < nTruss; i++) {
    const x = X0 + (i + 0.5) * (X1 - X0) / nTruss;
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, Znear - Zfar), steel);
    top.position.set(x, H - 0.15, (Znear + Zfar) / 2);
    g.add(top);
    const bot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, Znear - Zfar), steel);
    bot.position.set(x, H - 0.75, (Znear + Zfar) / 2);
    g.add(bot);
    // zig-zag web bracing between the two chords, like a real bar-joist truss
    const nSeg = 14, segLen = (Znear - Zfar) / nSeg;
    const webLen = Math.hypot(segLen, 0.6);
    for (let s = 0; s < nSeg; s++) {
      const z = Zfar + (s + 0.5) * segLen;
      const web = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, webLen, 6), steel);
      web.position.set(x, H - 0.45, z);
      web.rotation.x = (s % 2 ? 1 : -1) * Math.atan(segLen / 0.6);
      g.add(web);
    }
    // a light or a speaker cluster hangs from every other truss on a short chain
    for (let j = 0; j < 4; j++) {
      const z = Zfar + (j + 0.5) * (Znear - Zfar) / 4;
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.8, 5), steel);
      chain.position.set(x, H - 1.15, z);
      g.add(chain);
      if (i % 2 === 0) {
        const fixture = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.16, 12), new THREE.MeshStandardMaterial({ color: 0x1c1f24, roughness: 0.5, metalness: 0.6 }));
        fixture.position.set(x, H - 1.55, z);
        g.add(fixture);
        const lens = new THREE.Mesh(new THREE.CircleGeometry(0.19, 12), new THREE.MeshBasicMaterial({ color: 0xe4dcc3 }));
        lens.rotation.x = Math.PI / 2; lens.position.set(x, H - 1.63, z);
        g.add(lens);
        spots.push([x, z]);
      } else if (j === 1 || j === 2) {
        const spk = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.55, 0.4), new THREE.MeshStandardMaterial({ color: 0x101215, roughness: 0.7 }));
        spk.position.set(x, H - 1.6, z);
        g.add(spk);
      }
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
