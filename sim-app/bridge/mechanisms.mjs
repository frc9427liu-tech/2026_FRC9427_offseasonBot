// Mechanism description: which motor drives which sensor, through what ratio, with what load.
// Derived automatically from the robot's own source (swerve pattern: <Name>DriveId / <Name>SteerId / <Name>EncoderId
// constants + RotorToSensorRatio), then overridden/extended by sim-app/mechanisms/<project folder>.json
// (edited from the UI). Nothing is written into the robot project.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (p.endsWith('.java')) out.push(p);
  }
  return out;
}

// Evaluate "287.0 / 11.0", "4.71", "2 * Math.PI" ... (numbers and + - * / ( ) only).
function evalNumber(expr) {
  const s = expr
    .replace(/Math\.PI|\bPI\b/g, String(Math.PI))
    .replace(/(?:\w+\.)*inchesToMeters\s*\(/g, '0.0254*(')
    .replace(/(?:\w+\.)*feetToMeters\s*\(/g, '0.3048*(')
    .replace(/(?:\w+\.)*degreesToRadians\s*\(/g, `${Math.PI / 180}*(`)
    .replace(/\b(\d+(?:\.\d+)?)[dDfF]\b/g, '$1');
  if (!/^[\d\s+\-*/().eE]+$/.test(s)) return null;
  try { const v = Function(`"use strict"; return (${s});`)(); return Number.isFinite(v) ? v : null; } catch { return null; }
}

// name -> numeric value for `static final <type> NAME = <expr>;` (last definition wins; refs to other constants resolved once)
function collectConstants(files) {
  const consts = {};
  const re = /static\s+final\s+(?:int|double|long|float)\s+(\w+)\s*=\s*([^;]+);/g;
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    let m;
    while ((m = re.exec(src))) {
      const expr = m[2].replace(/\b[A-Za-z_]\w*\.(?=[A-Za-z_]\w*)/g, '').replace(/\b([A-Za-z_]\w*)\b/g, (w) => (w in consts ? String(consts[w]) : w));
      const v = evalNumber(expr);
      if (v != null) consts[m[1]] = v;
    }
  }
  return consts;
}

// ---------- robot description: what the game-piece rules need to know about this robot ----------
// Generic defaults; the per-project values (which NT topic / motor is the intake, the shooter's feed, ...)
// live in sim-app/mechanisms/<project folder>.json under "robot" and are edited from the ROBOT page in the UI.
// Signal sources are strings: "nt:<topic>" (a value the code publishes) or "motor:<HALSim motor name>"
// (that motor's simulated rotor speed in rev/s, absolute) - so the rules follow what the code actually drives.
export const DEFAULT_ROBOT_DESC = {
  size: { length: 0.86, width: 0.86, height: 0.55 },   // metres, bumpers included
  capacity: 40, preload: 8,
  intake: { source: '', min: 0.05, width: 0.64, reach: 0.15, scale: 1 },
  shooter: {
    fire: '', fireMin: 10,           // a ball leaves while this signal is above fireMin
    speed: '', hood: '',             // flywheel rev/s, hood angle (deg)
    elevationBase: 80, hoodScale: 1,   // launch elevation (deg) = elevationBase - hoodScale x hood angle
    wheelRadiusIn: 2, efficiency: 0.5, rate: 8, spreadDeg: 1.5,
    x: 0.151, y: 0, z: 0.487,        // launch point, robot frame (m): +x forward, +y left, z up
  },
  // simulated Limelight(s) the code reads (bridge/vision.mjs): mount in the robot frame, optics of an LL3/LL3G
  vision: { enabled: true, x: 0.2, y: 0, z: 0.5, yawDeg: 0, hfovDeg: 62.5, vfovDeg: 48.9, maxDist: 6 },
};

const descFile = (projectDir) => path.join(here, '..', 'mechanisms', `${path.basename(projectDir)}.json`);
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return {}; } };
const merge = (base, over) => {
  const out = { ...base };
  for (const [k, v] of Object.entries(over || {})) out[k] = v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' ? merge(base[k], v) : v;
  return out;
};

export function loadRobotDesc(projectDir) {
  return merge(DEFAULT_ROBOT_DESC, projectDir ? readJson(descFile(projectDir)).robot : {});
}

// Writes only the "robot" key; links/loads in the same file are kept as they are.
export function saveRobotDesc(projectDir, desc) {
  const f = descFile(projectDir);
  const j = readJson(f);
  j.robot = merge(DEFAULT_ROBOT_DESC, desc);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(j, null, 2) + '\n');
  return j.robot;
}

// Every CTRE motor the code constructs, with the class it lives in, so the UI can offer a motor as a signal
// source (and name it) before the code has ever driven it - HALSim only reports a motor once it's commanded.
export function listMotors(projectDir) {
  const src = path.join(projectDir, 'src', 'main', 'java');
  if (!fs.existsSync(src)) return [];
  const files = walk(src);
  const c = collectConstants(files);
  const out = new Map();
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    for (const m of text.matchAll(/new\s+TalonFX\s*\(\s*([\w.]+)/g)) {
      const arg = m[1].split('.').pop();
      const id = /^\d+$/.test(arg) ? Number(arg) : c[arg];
      if (id == null) continue;   // passed in from elsewhere (e.g. a module constructor): the chassis already covers those
      const name = `Talon FX (v6)[${id}]`;
      if (!out.has(name)) out.set(name, { name, label: `${path.basename(f, '.java')} #${id}` });
    }
  }
  return [...out.values()];
}

// ---------- mechanism loads for non-drivetrain motors, from the robot source ----------
// Each TalonFX's file gives its gear ratio (SensorToMechanismRatio) and software limits; the moving mass behind
// it is estimated from what kind of mechanism the class is (a flywheel, a hood, a linear intake, a roller).
// The limits become hard stops a little outside the code's soft limits, like the real frame. Without this every
// motor was simulated with one generic heavy load, so position loops (hood, intake) overshot and oscillated.
const ROTOR_J = 5e-5;   // kg m^2, a Kraken X60 rotor
const KIND_J = [   // [class-name pattern, mechanism-side inertia kg m^2, per motor]
  [/flywheel|shoot/i, 0.0015],
  [/hood|pivot|wrist/i, 0.02],
  [/arm|elevator|slide|extend/i, 0.001],
  [/roller|conveyor|trigger|tigger|feed|index|hopper|intake/i, 0.0004],
];
function angleConstants(files) {
  // static final Angle NAME = Degree(s).of(x) / Rotations.of(x) / Radians.of(x)  ->  mechanism rotations
  const out = {};
  const re = /static\s+final\s+Angle\s+(\w+)\s*=\s*(Degrees?|Rotations?|Radians?)\.of\(\s*([-\d.eE]+)\s*\)/g;
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    let m;
    while ((m = re.exec(src))) {
      const v = Number(m[3]);
      out[m[1]] = /^Deg/.test(m[2]) ? v / 360 : /^Rad/.test(m[2]) ? v / (2 * Math.PI) : v;
    }
  }
  return out;
}
export function deriveLoads(projectDir) {
  const src = path.join(projectDir, 'src', 'main', 'java');
  if (!fs.existsSync(src)) return {};
  const files = walk(src);
  const c = collectConstants(files), ang = angleConstants(files);
  const num = (expr) => {
    if (expr == null) return null;
    const e = expr.trim();
    const unit = /^(Degrees?|Rotations?|Radians?)\.of\(\s*([-\d.eE]+)\s*\)$/.exec(e);
    if (unit) { const v = Number(unit[2]); return /^Deg/.test(unit[1]) ? v / 360 : /^Rad/.test(unit[1]) ? v / (2 * Math.PI) : v; }
    const name = e.split('.').pop();
    if (name in ang) return ang[name];
    return evalNumber(e.replace(/\b[A-Za-z_]\w*\.(?=[A-Za-z_]\w*)/g, '').replace(/\b([A-Za-z_]\w*)\b/g, (w) => (w in c ? String(c[w]) : w)));
  };
  const loads = {};
  for (const f of files) {
    if (/Drivetrain|Swerve/i.test(f)) continue;   // chassis motors are handled by chassis.mjs
    const text = fs.readFileSync(f, 'utf8');
    const ids = [...text.matchAll(/new\s+TalonFX\s*\(\s*([\w.]+)/g)].map((m) => (/^\d+$/.test(m[1]) ? Number(m[1]) : c[m[1].split('.').pop()])).filter((v) => v != null);
    if (!ids.length) continue;
    const ratio = num(/SensorToMechanismRatio\s*(?:=|\()\s*([^;)]+(?:\([^)]*\))?)/.exec(text)?.[1]) || 1;
    const lo = num(/withReverseSoftLimitThreshold\(\s*([^)]+\)?)\s*\)/.exec(text)?.[1] ?? /ReverseSoftLimitThreshold\s*=\s*([^;]+);/.exec(text)?.[1]);
    const hi = num(/withForwardSoftLimitThreshold\(\s*([^)]+\)?)\s*\)/.exec(text)?.[1] ?? /ForwardSoftLimitThreshold\s*=\s*([^;]+);/.exec(text)?.[1]);
    const cls = path.basename(f, '.java');
    const jMech = (KIND_J.find(([re]) => re.test(cls)) || [null, 0.0004])[1];
    let inertia = ROTOR_J + jMech / (ratio * ratio);
    // a linear mechanism that states its travel per rotor turn (e.g. kMetersPerRotorRotation): a ~3 kg carriage
    const mpr = /\b(k\w*MetersPerRotorRotation)\b/.exec(text);
    if (mpr && c[mpr[1]]) inertia = ROTOR_J + 3 * (c[mpr[1]] / (2 * Math.PI)) ** 2;
    const load = { inertia, friction: 0.005, note: `${cls}: ratio ${+ratio.toFixed(3)}` };
    if (lo != null && hi != null && hi > lo) {
      // hard stops just outside the soft limits, in rotor rotations (mechanism rotations x ratio)
      const pad = (hi - lo) * 0.04;
      load.minRot = (lo - pad) * ratio; load.maxRot = (hi + pad) * ratio;
      load.note += `, limits ${+(lo * 360).toFixed(1)}..${+(hi * 360).toFixed(1)} deg (mech)`;
    }
    for (const id of ids) loads[`[${id}]`] = load;
  }
  return loads;
}

export function deriveMechanisms(projectDir) {
  const src = path.join(projectDir, 'src', 'main', 'java');
  const result = { links: [], loads: {}, notes: [] };
  try { Object.assign(result.loads, deriveLoads(projectDir)); } catch (e) { result.notes.push(`loads: ${e.message}`); }
  if (!fs.existsSync(src)) return result;
  const files = walk(src);
  const c = collectConstants(files);

  // swerve: steer motor's remote CANcoder follows the steer rotor through RotorToSensorRatio
  const all = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  const ratioExpr = /RotorToSensorRatio\s*=\s*([^;]+);/.exec(all)?.[1];
  let ratio = null;
  if (ratioExpr) {
    const e = ratioExpr.replace(/\b[A-Za-z_]\w*\.(?=[A-Za-z_]\w*)/g, '').replace(/\b([A-Za-z_]\w*)\b/g, (w) => (w in c ? String(c[w]) : w));
    ratio = evalNumber(e);
  }
  if (ratio) {
    for (const key of Object.keys(c)) {
      const m = /^k(\w+?)SteerId$/.exec(key);
      if (!m) continue;
      const enc = c[`k${m[1]}EncoderId`];
      if (enc == null) continue;
      result.links.push({ sensor: `CANcoder (v6)[${enc}]`, motor: `Talon FX (v6)[${c[key]}]`, ratio, note: `swerve ${m[1]} steer` });
    }
  } else if (ratioExpr) result.notes.push(`could not evaluate RotorToSensorRatio (${ratioExpr.trim()})`);

  // swerve chassis: module <Name> = FL/FR/BL/BR; position from wheel base / track width, ratios from the constants
  const gyroId = c.kPigeonId;
  const driveRatio = c.kDriveGearRatio, wheelRadius = c.kWheelRadius;
  const wb = c.kWheelBase, tw = c.kTrackWidth;
  const modules = [];
  if (driveRatio && wheelRadius && wb && tw) {
    for (const key of Object.keys(c)) {
      const m = /^k(FL|FR|BL|BR)DriveId$/.exec(key);
      if (!m) continue;
      const n = m[1], enc = c[`k${n}EncoderId`];
      if (enc == null) continue;
      modules.push({ name: n, drive: `Talon FX (v6)[${c[key]}]`, encoder: `CANcoder (v6)[${enc}]`, x: (n[0] === 'F' ? 1 : -1) * wb / 2, y: (n[1] === 'L' ? 1 : -1) * tw / 2 });
    }
  }
  // HALSim reports motor voltage/rotor motion in the raw CCW-positive frame: a Clockwise_Positive motor's wheel
  // therefore travels the opposite way to its raw rotor motion (the code's own +velocity = wheel forward).
  const invertedText = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  for (const mod of modules) {
    const cw = new RegExp(`k${mod.name}DriveInverted\\s*=\\s*(?:\\w+\\.)*Clockwise_Positive`).test(invertedText);
    mod.userSign = cw ? -1 : 1;
  }
  if (modules.length) result.chassis = { type: 'swerve', modules, driveRatio, wheelRadius, gyro: gyroId != null ? `Pigeon 2 (v6)[${gyroId}]` : null };

  const custom = path.join(here, '..', 'mechanisms', `${path.basename(projectDir)}.json`);
  if (fs.existsSync(custom)) {
    try {
      const j = JSON.parse(fs.readFileSync(custom, 'utf8'));
      if (Array.isArray(j.links)) result.links.push(...j.links);
      Object.assign(result.loads, j.loads || {});
    } catch (e) { result.notes.push(`bad ${custom}: ${e.message}`); }
  }
  return result;
}
