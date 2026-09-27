// FUEL: 5.91 in foam balls. Starting layout follows the official field photos:
//  - 360 in the neutral zone (two hex-packed blocks straddling the center line, 15 across x 12 deep each)
//  - 24 in each DEPOT (4 x 6 rows on the mat)
// (Outpost corral balls and robot preloads are added when robots arrive.)
import * as THREE from 'three';
import { FIELD_L, FIELD_W } from './field.js';
import { BallSim } from './balls.js';

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
  }
  return pts;
}

function fuelTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#f4c000';   // saturated warm yellow like the real foam ball (was a pale cream)
  g.fillRect(0, 0, 512, 256);
  // subtle molding seam on the equator + a slightly darker patch, like the real foam ball
  g.fillStyle = 'rgba(160,110,0,.35)';
  g.fillRect(0, 126, 512, 3);
  const grad = g.createRadialGradient(256, 128, 5, 256, 128, 120);
  grad.addColorStop(0, 'rgba(255,200,30,.2)');
  grad.addColorStop(1, 'rgba(255,200,30,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Robot geometry the fuel rules need (metres, robot frame): bumper half sizes, frame height, intake mouth, launcher.
// The launcher pose and the shot model below were fitted to this robot's own shooting tables
// (ShooterCalculator hood/rps/time-of-flight): elevation = 80 deg - hood angle, ball speed = 0.5 * wheel surface speed.
const ROBOT = { half: [0.43, 0.43], height: 0.55, capacity: 40, preload: 8 };
const SHOOTER = { pos: [0.151, 0, 0.487], wheelRadius: 2 * IN, efficiency: 0.5, elevationBase: 80, ratePerSec: 8, spreadDeg: 1.5 };
const NT = {
  intake: '/AdvantageKit/RealOutputs/intakearmangle', hood: '/AdvantageKit/RealOutputs/hoodangle', rps: '/AdvantageKit/RealOutputs/shootrps',
  hoodOk: '/AdvantageKit/RealOutputs/hoodisatposition', flyOk: '/AdvantageKit/RealOutputs/flywheelisatposition',
};

export function buildFuel(events) {
  const pts = startingLayout();
  const extra = ROBOT.preload;                       // preloaded fuel starts inside the robot
  const total = pts.length + extra;
  const geo = new THREE.SphereGeometry(FUEL_R, 32, 20);
  const mat = new THREE.MeshStandardMaterial({ map: fuelTexture(), roughness: 0.5, metalness: 0, emissive: 0x2a1600, emissiveIntensity: 0.25 });
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
      sim.robot = { x, y, theta: th, vx: rv.vx, vy: rv.vy, omega: rv.omega, half: ROBOT.half, height: ROBOT.height };
      const vals = st.values || {};
      const num = (k) => (typeof vals[k] === 'number' ? vals[k] : 0);
      const c = Math.cos(th), s = Math.sin(th);
      // intake: fuel that rolls into the mouth while the intake is out is taken in
      const ext = num(NT.intake);
      if (ext > 0.05) {
        let held = sim.count(1);
        for (let i = 0; i < total && held < ROBOT.capacity; i++) {
          if (sim.state[i] !== 0 || sim.p[i * 3 + 2] > 0.3) continue;
          const dx = sim.p[i * 3] - x, dy = sim.p[i * 3 + 1] - y;
          const lx = dx * c + dy * s, ly = -dx * s + dy * c;
          if (lx > ROBOT.half[0] - 0.1 && lx < ROBOT.half[0] + 0.15 + ext && Math.abs(ly) < 0.32) { sim.park(i, 1); held++; }
        }
      }
      // shooter: trigger held, flywheel and hood at their targets -> one fuel every 1/rate s
      const rt = link.pad && link.pad.axes[3] > 0.5;
      const ready = rt && vals[NT.flyOk] && vals[NT.hoodOk] && num(NT.rps) > 15;
      fireT = ready ? fireT + dt : 0;
      while (ready && fireT >= 1 / SHOOTER.ratePerSec) {
        fireT -= 1 / SHOOTER.ratePerSec;
        const i = sim.firstWithState(1);
        if (i < 0) break;
        const speed = SHOOTER.efficiency * 2 * Math.PI * SHOOTER.wheelRadius * num(NT.rps) * (1 + (Math.random() - 0.5) * 0.03);
        const elev = ((SHOOTER.elevationBase - num(NT.hood)) * Math.PI) / 180;
        const yaw = th + ((Math.random() - 0.5) * 2 * SHOOTER.spreadDeg * Math.PI) / 180;
        const [ox, oy, oz] = SHOOTER.pos;
        const hv = speed * Math.cos(elev);
        sim.launch(i, [x + ox * c - oy * s, y + ox * s + oy * c, oz], [hv * Math.cos(yaw) + rv.vx, hv * Math.sin(yaw) + rv.vy, speed * Math.sin(elev)]);
      }
    } else sim.robot = null;
    sim.step(dt);
    if (sim.dirty) { flush(); sim.dirty = false; }
  };
  return mesh;
}