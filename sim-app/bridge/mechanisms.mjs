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
  const s = expr.replace(/Math\.PI/g, String(Math.PI)).replace(/\b(\d+(?:\.\d+)?)[dDfF]\b/g, '$1');
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

export function deriveMechanisms(projectDir) {
  const src = path.join(projectDir, 'src', 'main', 'java');
  const result = { links: [], loads: {}, notes: [] };
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
