// Referee / scoring-table side of the arena: the scoring table with laptops, cable covers, equipment cases and
// alliance-station shelves behind the alliance walls. People standing here are spawned in crowd.js.
import * as THREE from 'three';
import { FIELD_L, FIELD_W } from './field.js';

const L = FIELD_L * 0.0254, W = FIELD_W * 0.0254;

// Yellow/black hazard cable ramp, not a flat mustard slab
function cableTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#e8b400';
  g.fillRect(0, 0, 64, 256);
  g.fillStyle = '#181818';
  for (let y = -64; y < 256; y += 32) { g.save(); g.translate(0, y); g.rotate(-0.5); g.fillRect(-64, 0, 192, 14); g.restore(); }
  g.fillStyle = 'rgba(0,0,0,.35)';
  g.fillRect(20, 0, 6, 256); g.fillRect(38, 0, 6, 256);   // raised cable channel shadow lines
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 3);
  return t;
}

// Rugged flight-case shell: ABS-grey with rubber corner guards and a latch, not a flat dark box
function caseTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#3a3d42';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 500; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.1)' : 'rgba(255,255,255,.06)'; g.fillRect(Math.random() * 128, Math.random() * 128, 1.5, 1.5); }
  g.fillStyle = '#16171a';   // corner guard + latch
  g.fillRect(0, 0, 22, 22); g.fillRect(106, 0, 22, 22); g.fillRect(0, 106, 22, 22); g.fillRect(106, 106, 22, 22);
  g.fillRect(54, 54, 20, 20);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// A laptop screen showing something, not a flat blue rectangle
function screenTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 80;
  const g = c.getContext('2d');
  g.fillStyle = '#0d2038'; g.fillRect(0, 0, 128, 80);
  g.fillStyle = '#173257'; g.fillRect(0, 0, 128, 14);
  g.fillStyle = '#6fb4ff';
  for (let i = 0; i < 5; i++) g.fillRect(6, 20 + i * 12, 30 + Math.random() * 60, 6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function signTexture(text) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#0d1b3d';
  g.fillRect(0, 0, 1024, 128);
  g.fillStyle = '#f2f5f8';
  g.font = '700 64px "Segoe UI", sans-serif';
  g.textAlign = 'center';
  g.fillText(text, 512, 88);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildOfficials() {
  const g = new THREE.Group();
  const cloth = new THREE.MeshStandardMaterial({ color: 0x14171d, roughness: 0.95 });
  const top = new THREE.MeshStandardMaterial({ color: 0xb9bec4, roughness: 0.55 });   // was near-white laminate, now a duller grey-white
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b1f26, roughness: 0.5, metalness: 0.3 });
  const screen = new THREE.MeshBasicMaterial({ map: screenTexture() });
  const cover = new THREE.MeshStandardMaterial({ map: cableTexture(), roughness: 0.75 });
  const caseMat = new THREE.MeshStandardMaterial({ map: caseTexture(), roughness: 0.6 });

  // Scoring table: 8 m long, black skirt, white top, along the scoring-table side behind the referees
  const tx = L / 2, tz = 2.55, tl = 8.4, td = 0.8;
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(tl, 0.72, td), cloth);
  skirt.position.set(tx, 0.36, tz);
  skirt.receiveShadow = true; skirt.castShadow = true;
  g.add(skirt);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(tl + 0.06, 0.05, td + 0.06), top);
  slab.position.set(tx, 0.745, tz);
  g.add(slab);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.45), new THREE.MeshBasicMaterial({ map: signTexture('SCORING TABLE') }));
  sign.position.set(tx, 0.42, tz - td / 2 - 0.005);
  sign.rotation.y = Math.PI; // faces the field (-Z)
  g.add(sign);

  // Laptops and monitors on the table
  for (let i = 0; i < 6; i++) {
    const x = tx - tl / 2 + 0.9 + i * ((tl - 1.8) / 5);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.02, 0.25), dark);
    base.position.set(x, 0.79, tz + 0.05);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.24, 0.015), dark);
    lid.position.set(x, 0.91, tz + 0.17);
    lid.rotation.x = -0.25;
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.2), screen);
    scr.position.set(x, 0.91, tz + 0.158);
    scr.rotation.x = -0.25;
    scr.rotation.y = Math.PI;
    g.add(base, lid, scr);
  }
  // Cable covers running from the table to the field edge
  for (const x of [L * 0.25, L * 0.75]) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.02, 1.5), cover);
    c.position.set(x, 0.011, 1.3);
    g.add(c);
  }
  // Equipment cases beside the table
  for (let i = 0; i < 4; i++) {
    const caseMesh = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.55), caseMat);
    caseMesh.position.set(tx + tl / 2 + 1.0 + (i % 2) * 1.0, 0.3 + (i > 1 ? 0.6 : 0), 2.6);
    g.add(caseMesh);
  }
  // Driver-station shelves behind each alliance wall (three per alliance)
  const shelf = (x) => {
    for (const sy of [W * 0.17, W * 0.5, W * 0.83]) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 1.9), dark);
      s.position.set(x, 1.02, -sy);
      g.add(s);
    }
  };
  shelf(-0.55); shelf(L + 0.55);
  return g;
}
