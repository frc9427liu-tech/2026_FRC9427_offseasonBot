// Generic motor physics for any robot project: reads the voltage the robot code commands on each virtual
// CAN motor (HALSim "CANMotor:*") and writes back the rotor position/velocity of the paired
// "CANEncoder:*/Rotor Sensor", so closed-loop code (PID, MotionMagic, velocity control) sees a real response.
// Motor constants are per motor type; load (inertia, friction, hard stops) comes from the mechanism description.

const MOTORS = {
  // freeRps: free speed at 12 V (rev/s), stallNm / stallA at 12 V
  'Talon FX (v6)': { freeRps: 100, stallNm: 7.09, stallA: 366 },      // Kraken X60
  'Talon FX (v6) X44': { freeRps: 130, stallNm: 4.05, stallA: 275 },  // Kraken X44
  'default': { freeRps: 100, stallNm: 7.09, stallA: 366 },
};

// The Rotor Sensor input is in HALSim's raw frame (positive = positive voltage); Phoenix applies the motor's
// Inverted setting itself when the robot code reads it back. (An earlier -1 here only looked stable: it fed the
// back-EMF the wrong way round and pinned Phoenix's simulated current limit at ~0.7 V.)
export const ROTOR_SENSOR_SIGN = 1;

const DEFAULT_LOAD = { inertia: 0.002, friction: 0.01, minRot: -Infinity, maxRot: Infinity };

export class MotorSim {
  constructor() {
    this.motors = new Map();   // "Talon FX (v6)[2]" -> {vel, pos, params, load}
    this.loads = {};           // overrides: name or "[id]" -> partial load
    this.links = [];           // {sensor, motor, ratio}: external sensor follows a motor's rotor (rotor turns / sensor turn)
  }

  setMechanisms({ links = [], loads = {} } = {}) { this.links = links; this.loads = loads; }

  // mechanism description: { "[2]": {inertia, friction, minRot, maxRot}, ... }
  setLoads(loads) { this.loads = loads || {}; }

  _load(name) {
    const id = /\[(\d+)\]$/.exec(name)?.[1];
    return { ...DEFAULT_LOAD, ...(this.loads[name] || {}), ...(id ? this.loads[`[${id}]`] || {} : {}) };
  }

  // devices: bridge's merged HALSim state. Returns HALSim messages to send (encoder feedback).
  step(dt, devices) {
    const out = [];
    for (const key of Object.keys(devices)) {
      if (!key.startsWith('CANMotor:')) continue;
      const name = key.slice(9);
      const kind = name.replace(/\[\d+\]$/, '').trim();
      let m = this.motors.get(name);
      if (!m) {
        const p = MOTORS[kind] || MOTORS.default;
        const R = 12 / p.stallA;
        const Kt = p.stallNm / p.stallA;
        const Ke = 12 / (p.freeRps * 2 * Math.PI);
        m = { vel: 0, pos: 0, p: { R, Kt, Ke }, load: this._load(name) };
        this.motors.set(name, m);
      }
      m.load = this._load(name);
      const volts = devices[key]['<motorVoltage'] ?? 0;
      const { R, Kt, Ke } = m.p;
      const { inertia, friction, minRot, maxRot } = m.load;
      const sign = ROTOR_SENSOR_SIGN;
      // rotor rad/s. The back-EMF term is integrated implicitly: a light mechanism (a geared hood is ~1e-4 kg m^2
      // at the rotor) has an electrical time constant of ~2 ms, shorter than a sub-step, where plain Euler blows up.
      const n = 4, h = dt / n;
      const damp = (Kt * Ke) / R;   // N m per rad/s
      for (let i = 0; i < n; i++) {
        const drive = (Kt * volts) / R;
        const torque = drive - damp * m.vel;
        const fr = Math.abs(m.vel) < 1e-3 && Math.abs(torque) < friction ? -torque : -Math.sign(m.vel) * friction;
        m.vel = (m.vel + ((drive + fr) / inertia) * h) / (1 + (damp / inertia) * h);
        m.pos += (m.vel / (2 * Math.PI)) * h;
        if (m.pos < minRot) { m.pos = minRot; if (m.vel < 0) m.vel = 0; }
        if (m.pos > maxRot) { m.pos = maxRot; if (m.vel > 0) m.vel = 0; }
      }
      out.push({ type: 'CANEncoder', device: `${name}/Rotor Sensor`, data: { '>rawPositionInput': sign * m.pos, '>velocity': sign * m.vel / (2 * Math.PI) } });
      for (const l of this.links) {
        if (l.motor !== name) continue;
        const r = (l.ratio || 1) * (l.invert ? -1 : 1);
        out.push({ type: 'CANEncoder', device: l.sensor, data: { '>rawPositionInput': m.pos / r + (l.offset || 0), '>velocity': m.vel / (2 * Math.PI) / r } });
      }
    }
    return out;
  }

  // rotor state for the UI (mechanism animation): name -> {pos (rev), vel (rev/s)}
  snapshot() {
    // rotor motion in HALSim's raw frame (positive = positive commanded voltage)
    return Object.fromEntries([...this.motors].map(([k, m]) => [k, { pos: m.pos, vel: m.vel / (2 * Math.PI) }]));
  }
}
