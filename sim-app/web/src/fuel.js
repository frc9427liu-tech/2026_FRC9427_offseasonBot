// FUEL: 5.91 in foam balls. Starting layout follows the official manual (6.3.4) and field photos:
//  - 360 in the neutral zone (two hex-packed blocks straddling the center line, 15 across x 12 deep each)
//  - 24 staged in each DEPOT (manual: "may not be in a uniform layout" - hex-packed here, same as neutral zone)
//  - 24 staged in each OUTPOST CHUTE (manual 6.3.4; see assets-src/imgs/blue-outpost-corral.jpg)
// (Robot preloads are added when robots arrive.)
import * as THREE from 'three';
import { FIELD_L, FIELD_W } from './field.js';
import { BallSim } from './balls.js';
import { readSignal } from './robot.js';

const IN = 0.0254;
export const FUEL_D = 5.91 * IN;
export const FUEL_R = FUEL_D / 2;

function hexBlock(cx, cy, across, deep) {
  const dy = 5.91 * 1.005; // tiny clearance so spheres never interpenetrate
  const dx = dy * 0.866;
  const pts = [];
  for (let r = 0; r < deep; r++) {
    const off = (r % 2) * dy / 2;
    for (let c = 0; c < across; c++) {
      pts.push([cx + (r - (deep - 1) / 2) * dx, cy + (c - (across - 1) / 2) * dy + off - dy / 4]);
    }
  }
  return pts;
}

export function startingLayout() {
  const pts = [];
  const cx = FIELD_L / 2, cy = FIELD_W / 2;
  const blockW = 15 * 5.91;
  pts.push(...hexBlock(cx, cy - blockW / 2, 15, 12));
  pts.push(...hexBlock(cx, cy + blockW / 2 + 1, 15, 12));
  for (const alliance of ['blue', 'red']) {
    for (const [lx, ly] of hexBlock(0, 0, 6, 4)) {
      // Blue depot: on the blue wall, beside the tower. Red is the 180 deg rotation.
      const bx = 14 + lx, by = 214 + ly;
      pts.push(alliance === 'blue' ? [bx, by] : [FIELD_L - bx, FIELD_W - by]);
    }
    for (const [lx, ly] of hexBlock(0, 0, 4, 6)) {
      // Blue outpost chute: at the alliance wall near the audience-side corner (field.js ELEMENTS anchor
      // for 'outpost' is (0, 34.12)); inset off the wall by the same margin the depot rack uses.
      const bx = 14 + lx, by = 34.12 + ly;
      pts.push(alliance === 'blue' ? [bx, by] : [FIELD_L - bx, FIELD_W - by]);
    }
  }
  return pts;
}

function fuelTexture() {
  // Reference: a real ball, photographed under room light and white-balance corrected against its own
  // background, is a flat matte lemon yellow with a fine pebbled (orange-peel) foam surface and a small
  // printed "FIRST" logo — no shiny highlight band and no visible molding seam.
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#dcb800';   // a shade deeper/more mustard than the first pass, less lemon-neon
  g.fillRect(0, 0, 512, 256);
  // fine pebble grain: tiny randomized specks, slightly lighter and darker than the base
  for (let i = 0; i < 3200; i++) {
    const x = Math.random() * 512, y = Math.random() * 256, r = 0.6 + Math.random() * 0.8;
    const d = Math.random() < 0.5 ? -1 : 1;
    g.fillStyle = `rgba(${d < 0 ? '150,105,0' : '255,255,200'},${0.05 + Math.random() * 0.07})`;
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  // printed logo, small and off-centre like the real ball
  g.save();
  g.translate(150, 130);
  g.fillStyle = 'rgba(30,24,0,.82)';
  g.font = '700 26px "Segoe UI", sans-serif';
  g.textAlign = 'left';
  g.fillText('FIRST', 8, 9);
  g.beginPath(); g.arc(-16, 0, 11, 0, Math.PI * 2); g.fill();
  g.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Fallback robot description (same shape as bridge/mechanisms.mjs DEFAULT_ROBOT_DESC) until the bridge sends the
// project's own one; the per-robot values (which signal is the intake, the shooter feed, ...) come from there.
// The shot model fitted to this robot's shooting tables (ShooterCalculator hood/rps/time-of-flight):
// elevation = elevationBase - hoodScale x hood angle, ball speed = efficiency x wheel surface speed.
const FALLBACK_DESC = {
  size: { length: 0.86, width: 0.86, height: 0.55 }, capacity: 40, preload: 8,
  intake: { source: '', min: 0.05, width: 0.64, reach: 0.15, scale: 1 },
  shooter: { fire: '', fireMin: 10, speed: '', hood: '', elevationBase: 80, wheelRadiusIn: 2, efficiency: 0.5, rate: 8, spreadDeg: 1.5, x: 0.151, y: 0, z: 0.487 },
};
export function buildFuel(events) {
  const pts = startingLayout();
  const extra = FALLBACK_DESC.preload;               // preloaded fuel starts inside the robot
  const total = pts.length + extra;
  const geo = new THREE.SphereGeometry(FUEL_R, 32, 20);
  // matte foam, not shiny plastic: higher roughness, tiny emissive so it never reads black in shadow
  const mat = new THREE.MeshStandardMaterial({ map: fuelTexture(), roughness: 0.85, metalness: 0, emissive: 0x2a2400, emissiveIntensity: 0.15 });
  const mesh = new THREE.InstancedMesh(geo, mat, total);
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.frustumCulled = false;

  const hubs = [{ x: 181.56 * IN, y: FIELD_W / 2 * IN, side: 'blue' }, { x: (FIELD_L - 181.56) * IN, y: FIELD_W / 2 * IN, side: 'red' }];
  const sim = new BallSim(pts.map(([x, y]) => [x * IN, y * IN]).concat(Array.from({ length: extra }, () => [-50, -50])), hubs);
  sim.p.fill(-50, pts.length * 3);
  for (let i = pts.length; i < total; i++) { sim.p[i * 3 + 2] = -50; sim.state[i] = 1; }   // preload: held
  for (let i = 0; i < pts.length; i++) { // random starting orientation
    const e = new THREE.Euler(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28);
    const q = new THREE.Quaternion().setFromEuler(e);
    sim.q.set([q.x, q.y, q.z, q.w], i * 4);
  }
  sim.onScore = (h) => { const side = hubs[h].side; if (events) events.emit('score', { side, points: 1, fuel: 1 }); };

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const flush = () => {
    for (let i = 0; i < total; i++) {
      // field (x, y, z-up) -> scene (x, z-up = y, -y)
      pos.set(sim.p[i * 3], sim.p[i * 3 + 2], -sim.p[i * 3 + 1]);
      q.set(sim.q[i * 4], sim.q[i * 4 + 2], -sim.q[i * 4 + 1], sim.q[i * 4 + 3]);
      m.compose(pos, q, one);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  flush();

  // ---- robot <-> fuel rules ----
  let last = null, fireT = 0;
  const rv = { vx: 0, vy: 0, omega: 0 };
  mesh.userData.count = total;
  mesh.userData.sim = sim;
  mesh.userData.update = (dt, link) => {
    const st = link && link.state;
    if (st && st.pose && st.robot && st.robot.running) {
      const [x, y, deg] = st.pose, th = (deg * Math.PI) / 180;
      if (last && dt > 0) {
        const k = Math.min(1, dt * 12);   // light smoothing: pose arrives at 20 Hz
        let dth = th - last.th; dth = Math.atan2(Math.sin(dth), Math.cos(dth));
        rv.vx += ((x - last.x) / dt - rv.vx) * k; rv.vy += ((y - last.y) / dt - rv.vy) * k; rv.omega += (dth / dt - rv.omega) * k;
      }
      if (!last || last.x !== x || last.y !== y || last.th !== th) last = { x, y, th };
      const desc = link.desc || FALLBACK_DESC, I = desc.intake, S = desc.shooter;
      const half = [desc.size.length / 2, desc.size.width / 2];
      sim.robot = { x, y, theta: th, vx: rv.vx, vy: rv.vy, omega: rv.omega, half, height: desc.size.height };
      const sig = (src) => readSignal(src, st);
      const c = Math.cos(th), s = Math.sin(th);
      // intake: while its signal is above the threshold, fuel that rolls into the mouth in front of the bumper is taken in
      const ext = sig(I.source);
      if (ext != null && ext > I.min) {
        let held = sim.count(1);
        const reach = half[0] + I.reach + ext * I.scale;
        for (let i = 0; i < total && held < desc.capacity; i++) {
          if (sim.state[i] !== 0 || sim.p[i * 3 + 2] > 0.3) continue;
          const dx = sim.p[i * 3] - x, dy = sim.p[i * 3 + 1] - y;
          const lx = dx * c + dy * s, ly = -dx * s + dy * c;
          if (lx > half[0] - 0.1 && lx < reach && Math.abs(ly) < I.width / 2) { sim.park(i, 1); held++; }
        }
      }
      // shooter: while the feed signal (e.g. the motor that pushes fuel into the flywheel) is running, one fuel
      // leaves every 1/rate s at the speed/angle the flywheel and hood signals give
      const feed = sig(S.fire);
      const ready = feed != null && feed > S.fireMin;
      fireT = ready ? fireT + dt : 0;
      while (ready && fireT >= 1 / S.rate) {
        fireT -= 1 / S.rate;
        const i = sim.firstWithState(1);
        if (i < 0) break;
        const speed = S.efficiency * 2 * Math.PI * S.wheelRadiusIn * IN * (sig(S.speed) || 0) * (1 + (Math.random() - 0.5) * 0.03);
        const elev = ((S.elevationBase - (S.hoodScale ?? 1) * (sig(S.hood) || 0)) * Math.PI) / 180;
        const yaw = th + ((Math.random() - 0.5) * 2 * S.spreadDeg * Math.PI) / 180;
        const hv = speed * Math.cos(elev);
        sim.launch(i, [x + S.x * c - S.y * s, y + S.x * s + S.y * c, S.z], [hv * Math.cos(yaw) + rv.vx, hv * Math.sin(yaw) + rv.vy, speed * Math.sin(elev)]);
      }
    } else sim.robot = null;
    sim.step(dt);
    if (sim.dirty) { flush(); sim.dirty = false; }
  };
  return mesh;
}