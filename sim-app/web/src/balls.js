// Fuel physics: soft 5.91 in foam balls (gravity, bounce, rolling loss, ball-ball contact), the field perimeter, the
// HUB body and funnel, and a moving robot that pushes balls around. Pure maths in field coordinates
// (x along the field, y across, z up, metres); fuel.js maps it to the scene.
//
// The robot-facing rules (intake, shooter, HUB scoring) live in fuelgame.js; this file only knows shapes and contacts.

export const R = 5.91 * 0.0254 / 2;
const G = 9.81;
const E_FLOOR = 0.42, E_WALL = 0.5, E_BALL = 0.45, E_ROBOT = 0.3;
const ROLL_LOSS = 1.3;        // 1/s horizontal speed decay while touching the floor (foam rolls poorly)
const AIR = 0.05;             // 1/s
const CELL = 0.2;

export const FIELD_L = 651.2 * 0.0254, FIELD_W = 317.7 * 0.0254;
export const HUB_HALF = 0.6, HUB_BODY_H = 1.42, FUNNEL_TOP = 1.83, OPENING_R = 0.53, WALL_R = 0.61;   // opening: 41.7 in across, 72 in up

export class BallSim {
  // starts: [[x, y], ...] resting positions; hubs: [{x, y, side}]
  constructor(starts, hubs) {
    this.n = starts.length;
    this.p = new Float32Array(this.n * 3);
    this.v = new Float32Array(this.n * 3);
    this.q = new Float32Array(this.n * 4);   // orientation (visual roll)
    this.state = new Uint8Array(this.n);     // 0 free, 1 held by robot, 2 inside a HUB
    this.hubs = hubs;
    this.onScore = null;                     // (hubIndex, ballIndex) => void
    this.robot = null;                       // {x, y, theta, vx, vy, omega, half: [hl, hw], height}
    starts.forEach(([x, y], i) => { this.p.set([x, y, R], i * 3); this.q.set([0, 0, 0, 1], i * 4); });
    this.dirty = true;
    this._acc = 0;
  }

  park(i, state) { this.state[i] = state; this.p.set([-50, -50, -50], i * 3); this.v.fill(0, i * 3, i * 3 + 3); }
  launch(i, pos, vel) { this.state[i] = 0; this.p.set(pos, i * 3); this.v.set(vel, i * 3); }
  firstWithState(s) { return this.state.indexOf(s); }
  count(s) { let c = 0; for (let i = 0; i < this.n; i++) if (this.state[i] === s) c++; return c; }

  step(dt) {
    this._acc += Math.min(dt, 0.1);
    const h = 1 / 120;
    let steps = 0;
    while (this._acc >= h && steps < 6) { this._sub(h); this._acc -= h; steps++; }
  }

  _sub(dt) {
    const { p, v, n } = this;
    for (let i = 0; i < n; i++) {
      if (this.state[i] !== 0) continue;
      const o = i * 3;
      const prevZ = p[o + 2];
      v[o + 2] -= G * dt;
      const air = Math.exp(-AIR * dt);
      v[o] *= air; v[o + 1] *= air; v[o + 2] *= air;
      p[o] += v[o] * dt; p[o + 1] += v[o + 1] * dt; p[o + 2] += v[o + 2] * dt;

      // floor
      if (p[o + 2] < R) {
        p[o + 2] = R;
        if (v[o + 2] < -0.25) v[o + 2] = -v[o + 2] * E_FLOOR; else v[o + 2] = 0;
        const k = Math.exp(-ROLL_LOSS * dt);
        v[o] *= k; v[o + 1] *= k;
      }
      // perimeter (tall polycarbonate/alliance walls)
      if (p[o] < R) { p[o] = R; if (v[o] < 0) v[o] = -v[o] * E_WALL; }
      if (p[o] > FIELD_L - R) { p[o] = FIELD_L - R; if (v[o] > 0) v[o] = -v[o] * E_WALL; }
      if (p[o + 1] < R) { p[o + 1] = R; if (v[o + 1] < 0) v[o + 1] = -v[o + 1] * E_WALL; }
      if (p[o + 1] > FIELD_W - R) { p[o + 1] = FIELD_W - R; if (v[o + 1] > 0) v[o + 1] = -v[o + 1] * E_WALL; }

      this._hubs(i, prevZ);
      this._robot(i);
    }
    this._ballBall();
    // visual roll from horizontal travel
    for (let i = 0; i < n; i++) {
      if (this.state[i] !== 0) continue;
      const o = i * 3, sx = v[o], sy = v[o + 1], sp = Math.hypot(sx, sy);
      if (sp < 0.02) continue;
      const ang = (sp * dt) / R;
      const ax = -sy / sp, ay = sx / sp;   // axis = up x v
      const s = Math.sin(ang / 2), c = Math.cos(ang / 2);
      const qo = i * 4, x = this.q[qo], y = this.q[qo + 1], z = this.q[qo + 2], w = this.q[qo + 3];
      const rx = ax * s, ry = ay * s, rz = 0, rw = c;   // rotation applied in the world frame: r * q
      this.q[qo] = rw * x + rx * w + ry * z - rz * y;
      this.q[qo + 1] = rw * y - rx * z + ry * w + rz * x;
      this.q[qo + 2] = rw * z + rx * y - ry * x + rz * w;
      this.q[qo + 3] = rw * w - rx * x - ry * y - rz * z;
    }
    this.dirty = true;
  }

  _hubs(i, prevZ) {
    const { p, v } = this, o = i * 3;
    for (let h = 0; h < this.hubs.length; h++) {
      const hub = this.hubs[h];
      const dx = p[o] - hub.x, dy = p[o + 1] - hub.y;
      // scored: crossed the opening plane going down, inside the opening
      if (prevZ >= FUNNEL_TOP && p[o + 2] < FUNNEL_TOP && Math.hypot(dx, dy) < OPENING_R && v[o + 2] < 0) {
        this.park(i, 2);
        if (this.onScore) this.onScore(h, i);
        return;
      }
      // funnel: the outer wall (vertical, radius WALL_R) and the rim ring around the opening
      const d = Math.hypot(dx, dy);
      if (p[o + 2] > HUB_BODY_H - R && p[o + 2] < FUNNEL_TOP + R && d >= WALL_R - 0.02 && d < WALL_R + R) {
        const nx = dx / (d || 1), ny = dy / (d || 1), push = WALL_R + R - d;
        p[o] += nx * push; p[o + 1] += ny * push;
        const vn = v[o] * nx + v[o + 1] * ny;
        if (vn < 0) { v[o] -= (1 + E_WALL) * vn * nx; v[o + 1] -= (1 + E_WALL) * vn * ny; }
      } else if (prevZ >= FUNNEL_TOP && p[o + 2] < FUNNEL_TOP + R * 0.5 && d >= OPENING_R && d < WALL_R && v[o + 2] < 0) {
        p[o + 2] = FUNNEL_TOP + R * 0.5; v[o + 2] = -v[o + 2] * E_FLOOR;   // landed on the rim: bounces, then rolls off outward
        v[o] += (dx / (d || 1)) * 0.8; v[o + 1] += (dy / (d || 1)) * 0.8;
      }      // body: axis-aligned box
      if (p[o + 2] < HUB_BODY_H + R) {
        const ex = HUB_HALF + R - Math.abs(dx), ey = HUB_HALF + R - Math.abs(dy);
        if (ex > 0 && ey > 0) {
          const top = HUB_BODY_H + R - p[o + 2];
          if (top < Math.min(ex, ey) && v[o + 2] < 0) { p[o + 2] = HUB_BODY_H + R; v[o + 2] = -v[o + 2] * E_FLOOR; }
          else if (ex < ey) { p[o] += Math.sign(dx) * ex; if (v[o] * Math.sign(dx) < 0) v[o] = -v[o] * E_WALL; }
          else { p[o + 1] += Math.sign(dy) * ey; if (v[o + 1] * Math.sign(dy) < 0) v[o + 1] = -v[o + 1] * E_WALL; }
        }
      }
    }
  }

  _robot(i) {
    const r = this.robot;
    if (!r) return;
    const { p, v } = this, o = i * 3;
    if (p[o + 2] - R > r.height) return;   // above the robot
    const c = Math.cos(r.theta), s = Math.sin(r.theta);
    const dx = p[o] - r.x, dy = p[o + 1] - r.y;
    const lx = dx * c + dy * s, ly = -dx * s + dy * c;   // ball in robot coordinates
    const [hl, hw] = r.half;
    const qx = Math.max(-hl, Math.min(hl, lx)), qy = Math.max(-hw, Math.min(hw, ly));
    let nx = lx - qx, ny = ly - qy, d = Math.hypot(nx, ny);
    if (d >= R) return;
    if (d < 1e-6) { // centre inside the box: push out through the nearest face
      const ox = hl - Math.abs(lx), oy = hw - Math.abs(ly);
      if (ox < oy) { nx = Math.sign(lx) || 1; ny = 0; d = -ox; } else { nx = 0; ny = Math.sign(ly) || 1; d = -oy; }
    } else { nx /= d; ny /= d; }
    const pen = R - d;
    // back to world
    const wx = nx * c - ny * s, wy = nx * s + ny * c;
    p[o] += wx * pen; p[o + 1] += wy * pen;
    // relative velocity at the contact (robot translation + rotation)
    const rx = p[o] - r.x, ry = p[o + 1] - r.y;
    const rvx = r.vx - r.omega * ry, rvy = r.vy + r.omega * rx;
    const vrn = (v[o] - rvx) * wx + (v[o + 1] - rvy) * wy;
    if (vrn < 0) { v[o] -= (1 + E_ROBOT) * vrn * wx; v[o + 1] -= (1 + E_ROBOT) * vrn * wy; }
  }

  _ballBall() {
    const { p, v, n } = this;
    const grid = new Map();
    for (let i = 0; i < n; i++) {
      if (this.state[i] !== 0) continue;
      const key = Math.floor(p[i * 3] / CELL) * 4096 + Math.floor(p[i * 3 + 1] / CELL);
      (grid.get(key) || grid.set(key, []).get(key)).push(i);
    }
    const D = 2 * R;
    for (const [key, list] of grid) {
      const cx = Math.floor(key / 4096), cy = key % 4096;
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
        const other = grid.get((cx + ox) * 4096 + (cy + oy));
        if (!other) continue;
        for (const i of list) for (const j of other) {
          if (j <= i) continue;
          const a = i * 3, b = j * 3;
          const dx = p[b] - p[a], dy = p[b + 1] - p[a + 1], dz = p[b + 2] - p[a + 2];
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 >= D * D || d2 < 1e-12) continue;
          const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, nz = dz / d, pen = (D - d) / 2;
          p[a] -= nx * pen; p[a + 1] -= ny * pen; p[a + 2] -= nz * pen;
          p[b] += nx * pen; p[b + 1] += ny * pen; p[b + 2] += nz * pen;
          const vn = (v[b] - v[a]) * nx + (v[b + 1] - v[a + 1]) * ny + (v[b + 2] - v[a + 2]) * nz;
          if (vn < 0) {
            const imp = -(1 + E_BALL) * vn / 2;
            v[a] -= imp * nx; v[a + 1] -= imp * ny; v[a + 2] -= imp * nz;
            v[b] += imp * nx; v[b + 1] += imp * ny; v[b + 2] += imp * nz;
          }
        }
      }
    }
    for (let i = 0; i < n; i++) if (this.state[i] === 0 && p[i * 3 + 2] < R) p[i * 3 + 2] = R;
  }
}
