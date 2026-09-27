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

// Measured with a swerve project whose velocity loops ran away to +-12 V: HALSim's "<motorVoltage" and the
// Rotor Sensor input have opposite sign conventions, so the motor's own rotor sensor is fed back negated.
// (External sensors such as a CANcoder are positive and unaffected.)
const ROTOR_SENSOR_SIGN = -1;

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
      // rotor rad/s. A few sub-steps keep the stiff electrical term stable at low inertia.
      const n = 4, h = dt / n;
      for (let i = 0; i < n; i++) {
        const torque = Kt * (volts - Ke * m.vel) / R;
        const fr = Math.abs(m.vel) < 1e-3 && Math.abs(torque) < friction ? -torque : -Math.sign(m.vel) * friction;
        m.vel += ((torque + fr) / inertia) * h;
        m.pos += (m.vel / (2 * Math.PI)) * h;
        if (m.pos < minRot) { m.pos = minRot; if (m.vel < 0) m.vel = 0; }
        if (m.pos > maxRot) { m.pos = maxRot; if (m.vel > 0) m.vel = 0; }
      }
      out.push({ type: 'CANEncoder', device: `${name}/Rotor Sensor`, data: { '>rawPositionInput': ROTOR_SENSOR_SIGN * m.pos, '>velocity': ROTOR_SENSOR_SIGN * m.vel / (2 * Math.PI) } });
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
    return Object.fromEntries([...this.motors].map(([k, m]) => [k, { pos: m.pos, vel: m.vel / (2 * Math.PI) }]));
  }
}
