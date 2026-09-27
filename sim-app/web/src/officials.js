// Referee / scoring-table side of the arena: the scoring table with laptops, cable covers, equipment cases and
// alliance-station shelves behind the alliance walls. People standing here are spawned in crowd.js.
import * as THREE from 'three';
import { FIELD_L, FIELD_W } from './field.js';

const L = FIELD_L * 0.0254, W = FIELD_W * 0.0254;

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
  const screen = new THREE.MeshBasicMaterial({ color: 0x6fb4ff });
  const cover = new THREE.MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.6 });

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
    const caseMesh = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.55), dark);
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
