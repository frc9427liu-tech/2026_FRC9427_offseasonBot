// Reads a robot project's Java source and works out how it is driven:
//  - which controllers exist (type + port)
//  - button/trigger bindings (RobotContainer style: controller.rightTrigger().whileTrue(cmd).onFalse(cmd2))
//  - which sticks/triggers/buttons are polled (getLeftY(), getHID().getRightBumper(), ...) and what they feed
// The result drives the on-screen control panel, so the sim's controls follow the code, not the other way round.
import fs from 'node:fs';
import path from 'node:path';

const CONTROLLER_TYPES = ['CommandXboxController', 'XboxController', 'CommandPS4Controller', 'PS4Controller', 'CommandPS5Controller', 'PS5Controller', 'CommandJoystick', 'Joystick', 'CommandGenericHID', 'GenericHID'];

const BUTTON_METHODS = {
  a: 'A', b: 'B', x: 'X', y: 'Y', leftBumper: 'LB', rightBumper: 'RB', start: 'Start', back: 'Back',
  leftStick: 'LS', rightStick: 'RS', leftTrigger: 'LT', rightTrigger: 'RT',
  povUp: 'DPadUp', povDown: 'DPadDown', povLeft: 'DPadLeft', povRight: 'DPadRight', povCenter: 'DPadCenter',
  povUpLeft: 'DPadUpLeft', povUpRight: 'DPadUpRight', povDownLeft: 'DPadDownLeft', povDownRight: 'DPadDownRight',
  square: 'Square', cross: 'Cross', circle: 'Circle', triangle: 'Triangle', L1: 'L1', R1: 'R1', L2: 'L2', R2: 'R2', L3: 'L3', R3: 'R3',
  trigger: 'Trigger', top: 'Top',
};
const GET_METHODS = {
  getLeftX: 'LeftX', getLeftY: 'LeftY', getRightX: 'RightX', getRightY: 'RightY',
  getLeftTriggerAxis: 'LT', getRightTriggerAxis: 'RT',
  getAButton: 'A', getBButton: 'B', getXButton: 'X', getYButton: 'Y',
  getLeftBumper: 'LB', getRightBumper: 'RB', getStartButton: 'Start', getBackButton: 'Back',
  getLeftStickButton: 'LS', getRightStickButton: 'RS',
  getAButtonPressed: 'A', getBButtonPressed: 'B', getXButtonPressed: 'X', getYButtonPressed: 'Y',
  getLeftBumperPressed: 'LB', getRightBumperPressed: 'RB', getPOV: 'DPad',
  getRawAxis: 'RawAxis', getRawButton: 'RawButton', getX: 'JoyX', getY: 'JoyY', getZ: 'JoyZ', getTwist: 'JoyTwist', getThrottle: 'JoyThrottle',
};
const BINDERS = ['onTrue', 'onFalse', 'whileTrue', 'whileFalse', 'toggleOnTrue', 'toggleOnFalse', 'onChange', 'debounce', 'and', 'or', 'negate'];
const XBOX_AXIS = { LeftX: 0, LeftY: 1, LT: 2, RT: 3, RightX: 4, RightY: 5 };

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.java')) out.push(p);
  }
  return out;
}

// blank out comments (keep offsets/newlines) so regexes never match commented-out code
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
}

function balanced(src, openIdx) { // index of the matching ')' for the '(' at openIdx
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')') { depth--; if (depth === 0) return i; }
  }
  return -1;
}
const squash = (s) => s.replace(/\s+/g, ' ').trim();
const lineOf = (src, idx) => src.slice(0, idx).split('\n').length;

function enclosingMethod(src, idx) {
  const before = src.slice(0, idx);
  const re = /(?:public|private|protected|static|final|\s)+[\w<>\[\],.? ]+\s+(\w+)\s*\([^;{)]*\)\s*(?:throws [\w, .]+)?\s*\{/g;
  let m, last = null;
  while ((m = re.exec(before))) if (!/^(if|for|while|switch|catch|return|new)$/.test(m[1])) last = m[1];
  return last;
}

export function analyzeProject(projectDir) {
  const root = path.join(projectDir, 'src', 'main', 'java');
  if (!fs.existsSync(root)) return { ok: false, error: 'no src/main/java' };
  const files = walk(root);
  const controllers = {};   // "file:var" -> { type, port, file }
  const bindings = [];
  const polls = [];
  const warnings = [];

  for (const file of files) {
    const rel = path.relative(root, file).replace(/\\/g, '/');
    const cls = path.basename(file, '.java');
    const src = stripComments(fs.readFileSync(file, 'utf8'));

    // controller variables declared in this file (fields, params, locals)
    const vars = {};
    const declRe = new RegExp(`\\b(${CONTROLLER_TYPES.join('|')})\\s+(\\w+)\\s*(?:=\\s*new\\s+\\w+\\s*\\(\\s*([^)]*?)\\s*\\))?`, 'g');
    let m;
    while ((m = declRe.exec(src))) {
      const [, type, name, portExpr] = m;
      vars[name] = { type, name, port: portExpr !== undefined ? portExpr : null, file: rel, cls };
      if (portExpr !== undefined) controllers[`${cls}.${name}`] = vars[name];
    }
    // also: new JoystickButton(var, ...) style
    const names = Object.keys(vars);
    if (!names.length) continue;
    const nameAlt = names.map((n) => n.replace(/\$/g, '\\$')).join('|');

    // --- trigger bindings: var.btn(...)[.binder(...)]* ---
    const bindRe = new RegExp(`\\b(${nameAlt})\\s*\\.\\s*(${Object.keys(BUTTON_METHODS).join('|')}|button|axisGreaterThan|axisLessThan|pov)\\s*\\(`, 'g');
    while ((m = bindRe.exec(src))) {
      const [, v, meth] = m;
      const open = m.index + m[0].length - 1;
      let close = balanced(src, open);
      if (close < 0) continue;
      const arg = squash(src.slice(open + 1, close));
      let control = BUTTON_METHODS[meth] || (meth === 'button' ? `Button${arg}` : meth === 'pov' ? `POV${arg}` : `${meth}(${arg})`);
      // walk the chain
      const chain = [];
      let pos = close + 1;
      for (;;) {
        const rest = src.slice(pos);
        const cm = /^\s*\.\s*(\w+)\s*\(/.exec(rest);
        if (!cm) break;
        const o = pos + cm[0].length - 1;
        const c = balanced(src, o);
        if (c < 0) break;
        chain.push({ binder: cm[1], action: squash(src.slice(o + 1, c)) });
        pos = c + 1;
      }
      const actions = chain.filter((c) => ['onTrue', 'onFalse', 'whileTrue', 'whileFalse', 'toggleOnTrue', 'toggleOnFalse'].includes(c.binder));
      if (!actions.length) continue; // condition-only expression (e.g. used as a Trigger value)
      bindings.push({ controller: v, port: vars[v].port, control, actions, file: rel, line: lineOf(src, m.index), method: enclosingMethod(src, m.index) });
    }

    // --- new JoystickButton(var, Button.kX.value) ---
    const jbRe = new RegExp(`new\\s+JoystickButton\\s*\\(\\s*(${nameAlt})\\s*,\\s*([^)]*)\\)`, 'g');
    while ((m = jbRe.exec(src))) {
      const bm = /k(\w+)/.exec(m[2]);
      let pos = m.index + m[0].length;
      const chain = [];
      for (;;) {
        const cm = /^\s*\.\s*(\w+)\s*\(/.exec(src.slice(pos));
        if (!cm) break;
        const o = pos + cm[0].length - 1;
        const c = balanced(src, o);
        if (c < 0) break;
        chain.push({ binder: cm[1], action: squash(src.slice(o + 1, c)) });
        pos = c + 1;
      }
      if (chain.length) bindings.push({ controller: m[1], port: vars[m[1]].port, control: bm ? bm[1] : squash(m[2]), actions: chain, file: rel, line: lineOf(src, m.index), method: enclosingMethod(src, m.index) });
    }

    // --- polled values: var.getLeftY(), var.getHID().getRightBumper(), ... ---
    const pollRe = new RegExp(`\\b(${nameAlt})\\s*\\.\\s*(?:getHID\\s*\\(\\s*\\)\\s*\\.\\s*)?(${Object.keys(GET_METHODS).join('|')})\\s*\\(([^)]*)\\)`, 'g');
    while ((m = pollRe.exec(src))) {
      const [, v, meth, arg] = m;
      const stmtStart = Math.max(src.lastIndexOf(';', m.index), src.lastIndexOf('{', m.index), src.lastIndexOf('}', m.index)) + 1;
      const stmt = squash(src.slice(stmtStart, m.index + m[0].length + 60).split(';')[0]);
      const assign = /(?:double|var|int|boolean|float)?\s*(\w+)\s*=\s*/.exec(stmt);
      let branch = null;
      const ifm = /\bif\s*\(\s*!?\s*$/.exec(src.slice(Math.max(0, m.index - 24), m.index));
      if (ifm) {
        const braceIdx = src.indexOf('{', m.index + m[0].length);
        if (braceIdx > 0) {
          let d = 0, end = braceIdx;
          for (let i = braceIdx; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (d === 0) { end = i; break; } } }
          const calls = [...src.slice(braceIdx, end).matchAll(/\b(\w+)\.(\w+)\s*\(/g)].map((c) => `${c[1]}.${c[2]}`).filter((c) => !/^(Math|MathUtil|Logger|this|super)\./.test(c));
          branch = [...new Set(calls)].slice(-2).join(', ') || null;
        }
      }
      polls.push({
        branch,
        controller: v, port: vars[v].port, control: GET_METHODS[meth] + (arg ? `(${squash(arg)})` : ''), method_called: meth,
        file: rel, line: lineOf(src, m.index), method: enclosingMethod(src, m.index), cls,
        feeds: assign ? assign[1] : null, statement: stmt.slice(0, 160),
      });
    }
  }

  // ---- summarize: what each physical control does, in plain words ----
  const axisRole = (feeds) => {
    if (!feeds) return null;
    if (/^(x|forward|vx|xSpeed|drive)/i.test(feeds)) return 'translate forward/back';
    if (/^(y|strafe|vy|ySpeed)/i.test(feeds)) return 'strafe left/right';
    if (/(rot|omega|turn|theta|angular)/i.test(feeds)) return 'rotate';
    return feeds;
  };
  const controls = {};
  const add = (control, entry) => { (controls[control] ||= []).push(entry); };
  for (const b of bindings) {
    for (const a of b.actions) add(b.control, { kind: 'binding', how: a.binder, action: a.action, at: `${b.file}:${b.line}` });
  }
  for (const p of polls) {
    const stick = ['LeftX', 'LeftY', 'RightX', 'RightY', 'LT', 'RT'].includes(p.control);
    add(p.control.replace(/\(.*/, ''), { kind: stick ? 'axis' : 'poll', role: axisRole(p.feeds) || (p.branch ? `while held: ${p.branch}` : null), feeds: p.feeds, at: `${p.file}:${p.line}`, in: `${p.cls}.${p.method || ''}`, statement: p.statement });
  }
  // Xbox axis index (WPILib) for the sim's virtual pad
  const axisIndex = XBOX_AXIS;
  return { ok: true, project: projectDir, filesScanned: files.length, controllers: Object.values(controllers), bindings, polls, controls, axisIndex, warnings };
}

if (process.argv[1] && process.argv[1].endsWith('analyze.mjs')) {
  const r = analyzeProject(process.argv[2]);
  console.log(JSON.stringify(r, null, 2));
}
