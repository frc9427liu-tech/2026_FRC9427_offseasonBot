// Swerve chassis physics: the robot's real wheel speeds and steer angles (as the robot code itself sees them)
// give the chassis velocity, which is integrated into a field pose with wall/Hub collisions. The heading is fed back
// to the robot's gyro so field-oriented driving and odometry close the loop like on a real robot.
//
// Module geometry, gear ratio and wheel size are read from the robot source (bridge/mechanisms.mjs), nothing is set by hand.

const FIELD_L = 651.2 * 0.0254, FIELD_W = 317.7 * 0.0254;
const HUB = 47 * 0.0254;                     // Hub footprint (square)
const HUB_X = 158.6 * 0.0254 + HUB / 2;      // alliance wall to Hub centre (rules: 158.6 in to the near face)
const OBSTACLES = [                          // axis-aligned boxes: cx, cy, half-width, half-height
  [HUB_X, FIELD_W / 2, HUB / 2, HUB / 2],
  [FIELD_L - HUB_X, FIELD_W / 2, HUB / 2, HUB / 2],
];

// BUMP (manual 2026, arena ch.): 73.0in wide (Y) x 44.4in deep (X, the ramp/drive direction) x 6.513in tall,
// centred between the alliance wall and the HUB on both sides of it - one pair per alliance (4 total).
// Modelled as a simple ramp-up-then-down "tent" profile along X: height 0 at the footprint edge, full
// height at the centre. (The manual's 15 deg ramp angle and these dimensions don't quite reconcile to a
// flat-topped plateau - this shape keeps the real height and footprint and is close enough for sim feel.)
const BUMP_HALF_DEPTH = 44.4 * 0.0254 / 2, BUMP_HALF_WIDTH = 73.0 * 0.0254 / 2, BUMP_HEIGHT = 6.513 * 0.0254;
const BUMPS = [102.15, 317.7 - 102.15].flatMap((y) => [181.56, 651.2 - 181.56].map((x) => ({ x: x * 0.0254, y: y * 0.0254 })));

// Terrain at a field point: ground height and its slope (dz/dx, dz/dy), used both to lift the chassis
// visually and to feed the robot's gyro real pitch/roll (its own code already reads tilt - see
// CommandSwerveDrivetrain.isClimbing() - to tell when it's driving over a BUMP).
function terrainAt(x, y) {
  for (const b of BUMPS) {
    const ld = x - b.x, lw = y - b.y;
    if (Math.abs(lw) > BUMP_HALF_WIDTH || Math.abs(ld) > BUMP_HALF_DEPTH) continue;
    const z = BUMP_HEIGHT * (1 - Math.abs(ld) / BUMP_HALF_DEPTH);
    const dzdx = -Math.sign(ld) * (BUMP_HEIGHT / BUMP_HALF_DEPTH);
    return { z, dzdx, dzdy: 0 };
  }
  return { z: 0, dzdx: 0, dzdy: 0 };
}

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class SwerveChassis {
  constructor() {
    this.cfg = null;
    this.pose = { x: 2.0, y: FIELD_W / 2, theta: 0 };   // blue-side start until the UI says otherwise
    this.vel = { vx: 0, vy: 0, omega: 0 };               // robot-relative
    this.halfLen = 0.43; this.halfWid = 0.43;
  }

  configure(chassis) { this.cfg = chassis && chassis.modules?.length ? chassis : null; }
  reset(x, y, thetaDeg) { this.pose = { x, y, theta: (thetaDeg * Math.PI) / 180 }; this.vel = { vx: 0, vy: 0, omega: 0 }; }

  // rotors: MotorSim.snapshot() ({name: {pos, vel (rev/s)}}), devices: bridge HALSim state. Returns HALSim messages.
  step(dt, devices, rotors) {
    const c = this.cfg;
    if (!c) return [];
    // Least squares for (vx, vy, omega) from module velocity vectors: v_i = (vx - w*y_i, vy + w*x_i)
    let n = 0, svx = 0, svy = 0, srr = 0, srv = 0;
    for (const m of c.modules) {
      const rot = rotors[m.drive];
      const ang = devices[`CANEncoder:${m.encoder}`]?.['<position'];
      if (!rot || ang == null) continue;
      const speed = (m.userSign * rot.vel / c.driveRatio) * 2 * Math.PI * c.wheelRadius;
      const a = ang * 2 * Math.PI;
      const vx = speed * Math.cos(a), vy = speed * Math.sin(a);
      n++; svx += vx; svy += vy;
      srr += m.x * m.x + m.y * m.y;
      srv += m.x * vy - m.y * vx;   // r x v
    }
    if (n < 2) return [];
    const vx = svx / n, vy = svy / n;
    this.debug = c.modules.map((m) => { const a = devices[`CANEncoder:${m.encoder}`]?.['<position']; const r = rotors[m.drive]; return `${m.name} ang=${a?.toFixed(3)} v=${'V=' + (devices[`CANMotor:${m.drive}`]?.['<motorVoltage'] ?? 0).toFixed(2)} v=${r ? ((m.userSign * r.vel / c.driveRatio) * 2 * Math.PI * c.wheelRadius).toFixed(2) : '-'}`; }).join(' | ');
    const omega = srv / (srr || 1);
    this.vel = { vx, vy, omega };

    const th = this.pose.theta;
    const mid = th + (omega * dt) / 2;
    this.pose.x += (vx * Math.cos(mid) - vy * Math.sin(mid)) * dt;
    this.pose.y += (vx * Math.sin(mid) + vy * Math.cos(mid)) * dt;
    this.pose.theta = wrap(th + omega * dt);
    this._collide();

    // BUMP ramp: lift the chassis and tilt it into the robot's own pitch/roll axes
    const terrain = terrainAt(this.pose.x, this.pose.y);
    this.pose.z = terrain.z;
    const fwd = [Math.cos(this.pose.theta), Math.sin(this.pose.theta)];
    const right = [Math.sin(this.pose.theta), -Math.cos(this.pose.theta)];
    const grad = [terrain.dzdx, terrain.dzdy];
    this.pitch = Math.atan(grad[0] * fwd[0] + grad[1] * fwd[1]);
    this.roll = Math.atan(grad[0] * right[0] + grad[1] * right[1]);

    if (!c.gyro || process.env.SIM_NOGYRO) return [];
    return [{
      type: 'CANGyro', device: c.gyro, data: {
        '>rawYawInput': (this.pose.theta * 180) / Math.PI, '>angularVelZ': (omega * 180) / Math.PI,
        '>pitch': (this.pitch * 180) / Math.PI, '>roll': (this.roll * 180) / Math.PI,
      },
    }];
  }

  // push the robot's rectangle out of the perimeter and the Hubs (SAT against axis-aligned boxes)
  _collide() {
    const p = this.pose;
    for (let iter = 0; iter < 3; iter++) {
      const c = Math.cos(p.theta), s = Math.sin(p.theta);
      const axes = [[1, 0], [0, 1], [c, s], [-s, c]];
      const corners = [];
      for (const [ax, ay] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const lx = ax * this.halfLen, ly = ay * this.halfWid;
        corners.push([p.x + lx * c - ly * s, p.y + lx * s + ly * c]);
      }
      let dx = 0, dy = 0;   // perimeter: every corner stays inside [0,L] x [0,W]
      for (const [x, y] of corners) {
        if (x < 0) dx = Math.max(dx, -x);
        if (x > FIELD_L) dx = Math.min(dx, FIELD_L - x);
        if (y < 0) dy = Math.max(dy, -y);
        if (y > FIELD_W) dy = Math.min(dy, FIELD_W - y);
      }
      p.x += dx; p.y += dy;
      for (const [cx, cy, hw, hh] of OBSTACLES) {
        let best = null;
        for (const [ax, ay] of axes) {
          const proj = corners.map(([x, y]) => x * ax + y * ay);
          const rmin = Math.min(...proj), rmax = Math.max(...proj);
          const bc = cx * ax + cy * ay, br = hw * Math.abs(ax) + hh * Math.abs(ay);
          const overlap = Math.min(rmax, bc + br) - Math.max(rmin, bc - br);
          if (overlap <= 0) { best = null; break; }   // separating axis: no contact
          if (!best || overlap < best.o) best = { o: overlap, ax, ay, sign: (rmin + rmax) / 2 < bc ? -1 : 1 };
        }
        if (best) { p.x += best.ax * best.o * best.sign; p.y += best.ay * best.o * best.sign; }
      }
    }
  }
}
