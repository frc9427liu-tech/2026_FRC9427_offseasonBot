// Connects the scene to the simulator bridge: robot pose from the running robot code, and the driver-station
// input (keyboard / gamepad / touch) going back to it exactly like a real Driver Station would.
import * as THREE from 'three';

const BRIDGE_URL = `ws://${location.hostname || 'localhost'}:8765`;

// Keyboard layout for the virtual Xbox pad: which key(s) drive each physical control. Axes take a [negative, positive]
// key pair, everything else one key. The user can rebind any of them; the choice is remembered in the browser.
export const DEFAULT_BINDINGS = {
  LeftX: ['KeyA', 'KeyD'], LeftY: ['KeyW', 'KeyS'], RightX: ['ArrowLeft', 'ArrowRight'], RightY: ['ArrowUp', 'ArrowDown'],
  LT: ['KeyQ'], RT: ['KeyE'],
  A: ['Space'], B: ['KeyB'], X: ['KeyX'], Y: ['KeyY'], LB: ['ShiftLeft'], RB: ['KeyR'], Start: ['Enter'], Back: [],
  DPadUp: ['KeyI'], DPadDown: ['KeyK'], DPadLeft: ['KeyJ'], DPadRight: ['KeyL'],
};
export const AXIS_CONTROLS = ['LeftX', 'LeftY', 'RightX', 'RightY'];
const STORE = 'sim.keybindings';
export const bindings = (() => {
  const b = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
  try { Object.assign(b, JSON.parse(localStorage.getItem(STORE) || '{}')); } catch { /* no storage: defaults */ }
  return b;
})();
const saveBindings = () => { try { localStorage.setItem(STORE, JSON.stringify(bindings)); } catch { /* ignore */ } };
export function setBinding(control, slot, code) {
  // a key can only drive one thing: unbind it elsewhere first
  for (const arr of Object.values(bindings)) arr.forEach((c, i) => { if (c === code) arr[i] = ''; });
  const arr = bindings[control] || (bindings[control] = []);
  arr[slot] = code;
  saveBindings();
}
export function resetBindings() {
  for (const k of Object.keys(bindings)) delete bindings[k];
  Object.assign(bindings, JSON.parse(JSON.stringify(DEFAULT_BINDINGS)));
  saveBindings();
}
export function keyLabel(code) {
  if (!code) return '—';
  const m = /^(?:Key|Digit)(.)$/.exec(code);
  if (m) return m[1];
  return ({ Space: 'Space', Enter: 'Enter', ShiftLeft: 'Shift', ShiftRight: 'R-Shift', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', ControlLeft: 'Ctrl', AltLeft: 'Alt', Tab: 'Tab', Backspace: '⌫' })[code] || code;
}

export function buildPlaceholderRobot(alliance = 'blue') {
  // Stand-in until the team's own CAD model is loaded: frame, bumpers in alliance colour, and a direction marker.
  const g = new THREE.Group();
  const size = 0.84, h = 0.42;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(size - 0.12, h, size - 0.12), new THREE.MeshStandardMaterial({ color: 0x2b3038, roughness: 0.5, metalness: 0.6 }));
  frame.position.y = h / 2 + 0.05;
  const bumperMat = new THREE.MeshStandardMaterial({ color: alliance === 'blue' ? 0x1f5fd0 : 0xd7263d, roughness: 0.85 });
  const bumper = (w, d, x, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.13, d), bumperMat); m.position.set(x, 0.14, z); return m; };
  const body = new THREE.Group();   // frame + bumpers + nose: scaled to the described footprint (fitModelToDesc)
  body.add(frame, bumper(size, 0.09, 0, size / 2 - 0.045), bumper(size, 0.09, 0, -size / 2 + 0.045), bumper(0.09, size, size / 2 - 0.045, 0), bumper(0.09, size, -size / 2 + 0.045, 0));
  g.add(body);
  g.userData.body = body;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 3), new THREE.MeshBasicMaterial({ color: 0xffd24a }));
  nose.rotation.z = -Math.PI / 2; nose.position.set(size / 2 - 0.02, 0.5, 0);
  body.add(nose);

  // Mechanism stand-ins driven by the robot code's logged values (replaced by the CAD parts later):
  // intake slides out of the front, the hood tilts at the back, the flywheel spins under it.
  const partMat = new THREE.MeshStandardMaterial({ color: 0xc9ccd2, roughness: 0.4, metalness: 0.7 });
  const intake = new THREE.Group();
  intake.position.set(size / 2 - 0.1, 0.16, 0);
  const rollerBar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.6, 20), new THREE.MeshStandardMaterial({ color: 0xff8a1f, roughness: 0.7 }));
  rollerBar.rotation.x = Math.PI / 2; rollerBar.position.x = 0.06;
  intake.add(rollerBar);
  const hood = new THREE.Group();
  hood.position.set(-0.12, 0.62, 0);
  const hoodPlate = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.025, 0.42), partMat);
  hoodPlate.position.x = 0.17;
  hood.add(hoodPlate);
  const flywheel = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.36, 24), new THREE.MeshStandardMaterial({ color: 0x555b66, roughness: 0.35, metalness: 0.85 }));
  flywheel.rotation.x = Math.PI / 2; flywheel.position.set(-0.12, 0.56, 0);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.362, 0.03), new THREE.MeshBasicMaterial({ color: 0xffd24a }));
  stripe.position.x = 0.075;
  flywheel.add(stripe);
  g.add(intake, hood, flywheel);
  g.userData.mech = { intake, hood, flywheel, intakeHome: intake.position.x };
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// A signal from the robot description (bridge/mechanisms.mjs): "nt:<topic>" = a value the robot code publishes
// (booleans count as 0/1), "motor:<name>" = that motor's simulated rotor speed in rev/s (absolute). null if the
// source is unset or not being published right now.
export function readSignal(src, st) {
  if (!src || !st) return null;
  if (src.startsWith('nt:')) {
    const v = (st.values || {})[src.slice(3)];
    return typeof v === 'number' ? v : typeof v === 'boolean' ? (v ? 1 : 0) : null;
  }
  if (src.startsWith('motor:')) {
    const r = (st.rotors || {})[src.slice(6)];
    return r ? Math.abs(r.vel) : null;
  }
  return null;
}

// Fit the stand-in model to the robot description (ROBOT > 機構描述): bumper footprint and height, the intake
// mouth's width, the launcher where the fuel actually leaves - so what you see matches what the fuel rules use.
function fitModelToDesc(robot, desc) {
  const mech = robot.userData.mech;
  if (!mech || !desc) return;
  const base = 0.84;   // buildPlaceholderRobot's footprint
  const sx = desc.size.length / base, sz = desc.size.width / base;
  robot.userData.body.scale.set(sx, desc.size.height / 0.55, sz);
  mech.intakeHome = desc.size.length / 2 - 0.1;
  mech.intake.position.set(mech.intakeHome, 0.16, 0);
  mech.intake.children[0].scale.y = desc.intake.width / 0.6;   // roller bar length (cylinder axis = local Y)
  const S = desc.shooter;
  mech.flywheel.position.set(S.x - 0.06, S.z + 0.07, -S.y);
  mech.hood.position.set(S.x - 0.06, S.z + 0.13, -S.y);
}

// Stand-in mechanisms follow the same signals the game-piece rules use: intake extension (m, x scale), hood
// angle (deg), flywheel speed (rev/s).
let lastAnim = performance.now();
function animateMechanisms(mech, st, desc) {
  if (!mech || !desc) return;
  const now = performance.now(), dt = Math.min((now - lastAnim) / 1000, 0.2);
  lastAnim = now;
  const sig = (s) => readSignal(s, st) || 0;
  mech.intake.position.x = mech.intakeHome + sig(desc.intake.source) * (desc.intake.scale ?? 1);
  mech.hood.rotation.z = THREE.MathUtils.degToRad(sig(desc.shooter.hood));
  mech.flywheel.rotation.y -= sig(desc.shooter.speed) * 2 * Math.PI * dt * 0.1;  // slowed 10x: a real 60 rev/s wheel would just strobe
}

export function createRobotLink(scene) {
  const robot = buildPlaceholderRobot('blue');
  robot.visible = false;
  scene.add(robot);

  const link = {
    robot, connected: false, running: false, state: null, log: [], onStatus: () => {},
    ds: { enabled: false, autonomous: false }, pad: { axes: [0, 0, 0, 0, 0, 0], buttons: new Array(12).fill(false), povs: [-1] },
    onPose: null,
  };
  let ws = null;
  const send = (m) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };

  function connect() {
    ws = new WebSocket(BRIDGE_URL);
    ws.onopen = () => { link.connected = true; link.onStatus(link); };
    ws.onclose = () => { link.connected = false; link.running = false; robot.visible = false; link.onStatus(link); setTimeout(connect, 2000); };
    ws.onerror = () => { try { ws.close(); } catch { /* ignore */ } };
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.t === 'state') {
        link.state = m; link.running = m.robot.running;
        animateMechanisms(robot.userData.mech, m, link.desc);
        if (m.pose) {
          // WPILib field coordinates (m, deg): +X toward red, +Y away from the scoring table (= -Z in the scene)
          robot.visible = true;
          const t = m.terrain;   // BUMP ramp lift/tilt from the bridge's chassis physics, if simulated
          robot.position.set(m.pose[0], t ? t.z : 0, -m.pose[1]);
          // This placeholder model's nose points local +X (see buildPlaceholderRobot), not the usual +Z, so
          // "pitch" (tilt about the forward axis' perpendicular) lands on local Z and "roll" (bank around
          // the forward axis itself) lands on local X - 'YZX' applies yaw first, then those, in that frame.
          robot.rotation.order = 'YZX';
          robot.rotation.set(t ? THREE.MathUtils.degToRad(t.roll) : 0, THREE.MathUtils.degToRad(m.pose[2]), t ? THREE.MathUtils.degToRad(t.pitch) : 0);
          if (link.onPose) link.onPose(m.pose);
        }
        link.onStatus(link);
      } else if (m.t === 'controls') { link.controls = m.data; if (link.onControls) link.onControls(m.data); }
      else if (m.t === 'log') { link.log.push(m.line); if (link.log.length > 200) link.log.shift(); }
      else if (m.t === 'hello') { link.log = m.log || []; }
      else if (m.t === 'project') { link.project = { project: m.project, recent: m.recent || [], busy: false, error: null }; if (link.onProject) link.onProject(link.project); }
      else if (m.t === 'projectResult') { link.project = { ...(link.project || {}), busy: false, error: m.ok || m.cancelled ? null : m.error }; if (link.onProject) link.onProject(link.project); }
      else if (m.t === 'robotDesc') { link.desc = m.desc; link.descMotors = m.motors || []; fitModelToDesc(robot, m.desc); if (link.onDesc) link.onDesc(m.desc); }
    };
  }
  connect();

  link.start = (project) => { send({ t: 'start', project }); link.resetPose(); };
  // put the simulated chassis back on the blue start line (field coordinates, metres / degrees)
  link.resetPose = (x = 2.0, y = 4.03, deg = 0) => send({ t: 'resetPose', x, y, deg });
  link.stop = () => send({ t: 'stop' });
  // robot project: native folder picker on the bridge's machine, or a folder from the recent list
  const projectBusy = () => { link.project = { ...(link.project || {}), busy: true, error: null }; if (link.onProject) link.onProject(link.project); };
  link.pickProject = () => { projectBusy(); send({ t: 'pickProject' }); };
  link.useProject = (dir) => { projectBusy(); send({ t: 'setProject', project: dir }); };
  link.saveDesc = (desc) => { link.desc = desc; fitModelToDesc(robot, desc); send({ t: 'saveRobotDesc', desc }); };
  link.setDs = (patch) => { Object.assign(link.ds, patch); send({ t: 'ds', enabled: link.ds.enabled, autonomous: link.ds.autonomous }); };

  // ---- inputs: keyboard -> virtual Xbox pad; a real gamepad overrides it while connected ----
  const keys = new Set();
  addEventListener('keydown', (e) => { if (!e.repeat) keys.add(e.code); });
  addEventListener('keyup', (e) => keys.delete(e.code));
  const pad = link.pad;
  // on-screen (touch) controls write here; merged with the keyboard so both work at once
  link.touch = { axes: [0, 0, 0, 0, 0, 0], buttons: new Array(12).fill(false), povs: -1, active: false };
  const kbdPad = () => {
    const held = (c) => (c && keys.has(c) ? 1 : 0);
    const ax = (name) => held(bindings[name][1]) - held(bindings[name][0]);
    // WPILib Xbox axes: 0 LeftX, 1 LeftY, 2 LT, 3 RT, 4 RightX, 5 RightY
    pad.axes = [ax('LeftX'), ax('LeftY'), held(bindings.LT[0]), held(bindings.RT[0]), ax('RightX'), ax('RightY')];
    // WPILib Xbox buttons: 0 A,1 B,2 X,3 Y,4 LB,5 RB,6 Back,7 Start,8 LS,9 RS
    const b = new Array(12).fill(false);
    ['A', 'B', 'X', 'Y', 'LB', 'RB', 'Back', 'Start'].forEach((n, i) => { b[i] = !!held(bindings[n][0]); });
    pad.buttons = b;
    const dp = ['DPadUp', 'DPadRight', 'DPadDown', 'DPadLeft'].findIndex((n) => held(bindings[n][0]));
    pad.povs = [dp < 0 ? -1 : dp * 90];
  };
  const mergeTouch = () => {
    const t = link.touch;
    if (!t.active) return;
    pad.axes = pad.axes.map((v, i) => (Math.abs(t.axes[i]) > Math.abs(v) ? t.axes[i] : v));
    pad.buttons = pad.buttons.map((v, i) => v || t.buttons[i]);
    if (t.povs >= 0) pad.povs = [t.povs];
  };
  const gamepadPad = () => {
    const gp = [...(navigator.getGamepads ? navigator.getGamepads() : [])].find((g) => g && g.connected);
    if (!gp) return false;
    const a = (i) => gp.axes[i] || 0, lt = gp.buttons[6]?.value || 0, rt = gp.buttons[7]?.value || 0;
    pad.axes = [a(0), a(1), lt, rt, a(2), a(3)];
    const b = new Array(12).fill(false);
    [0, 1, 2, 3, 4, 5].forEach((i) => { b[i] = !!gp.buttons[i]?.pressed; });
    b[6] = !!gp.buttons[8]?.pressed; b[7] = !!gp.buttons[9]?.pressed; b[8] = !!gp.buttons[10]?.pressed; b[9] = !!gp.buttons[11]?.pressed;
    pad.povs = [gp.buttons[12]?.pressed ? 0 : gp.buttons[15]?.pressed ? 90 : gp.buttons[13]?.pressed ? 180 : gp.buttons[14]?.pressed ? 270 : -1];
    return true;
  };
  setInterval(() => {
    // a hidden tab doesn't drive: browsers throttle its timers to ~1 Hz, which would chop a held trigger into
    // on/off pulses (and fight whichever window the driver is actually using)
    if (!link.connected || document.hidden) return;
    if (!gamepadPad()) kbdPad();
    mergeTouch();
    const dz = (v) => (Math.abs(v) < 0.08 ? 0 : v);
    send({ t: 'joy', index: 0, axes: pad.axes.map(dz), buttons: pad.buttons, povs: pad.povs });
  }, 20);

  return link;
}
