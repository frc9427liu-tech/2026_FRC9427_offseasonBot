// Simulator bridge: runs an unmodified WPILib robot project in simulation and connects it to the web UI.
//   robot project --(HALSim WebSocket :3300, NT4 :5810)--> this bridge --(WebSocket :8765)--> browser
// Nothing in the robot project is edited: the WebSocket extension is enabled through a Gradle init script.
import { WebSocketServer } from 'ws';
import { decodeMulti } from '@msgpack/msgpack';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeProject } from './analyze.mjs';
import { MotorSim } from './motorsim.mjs';
import { SwerveChassis } from './chassis.mjs';
import { deriveMechanisms, loadRobotDesc, saveRobotDesc, listMotors } from './mechanisms.mjs';
import { findLimelights, limelightFrame } from './vision.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const UI_PORT = Number(process.env.SIM_BRIDGE_PORT || 8765);
const HALSIM_URL = 'ws://127.0.0.1:3300/wpilibws';
const NT_URL = 'ws://127.0.0.1:5810/nt/simbridge';

const state = {
  robot: { running: false, project: null, log: [] },
  hal: { connected: false, devices: {} },   // "Type:device" -> merged data
  nt: { connected: false, values: {}, types: {} },
};
const clients = new Set();
const send = (ws, msg) => { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); };
const broadcast = (msg) => clients.forEach((c) => send(c, msg));

// ---------- read the project's source: how is it driven? (re-run whenever the code changes) ----------
let mechInfo = null;
let controlsInfo = null, watcher = null, watchTimer = null;
let robotDesc = null, descProject = null, codeMotors = [];   // game-piece description of the robot (mechanisms.mjs), edited from the UI
function analyze(projectDir) {
  try { robotDesc = loadRobotDesc(projectDir); descProject = projectDir; codeMotors = listMotors(projectDir); limelights = findLimelights(projectDir); console.log('limelights:', limelights.join(', ') || 'none'); broadcast({ t: 'robotDesc', desc: robotDesc, motors: codeMotors }); } catch (e) { console.error('robot desc:', e); }
  try { const mech = deriveMechanisms(projectDir); motorSim.setMechanisms(mech); chassis.configure(mech.chassis); mechInfo = mech; } catch (e) { console.error('mechanisms:', e); }
  try { controlsInfo = analyzeProject(projectDir); } catch (e) { controlsInfo = { ok: false, error: String(e.message || e) }; }
  broadcast({ t: 'controls', data: controlsInfo });
}
function watchProject(projectDir) {
  if (watcher) watcher.close();
  const src = path.join(projectDir, 'src', 'main', 'java');
  if (!fs.existsSync(src)) return;
  try {
    watcher = fs.watch(src, { recursive: true }, () => {
      clearTimeout(watchTimer);
      watchTimer = setTimeout(() => analyze(projectDir), 700);
    });
  } catch { /* recursive watch unsupported: manual re-analyze still works */ }
}

// ---------- which robot project: remembered per machine in sim-config.json ----------
// SIM_PROJECT (env) wins; otherwise the project last picked in the UI; otherwise this repo's own robot project.
const CONFIG_FILE = path.join(here, '..', 'sim-config.json');
const readConfig = () => { try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch { return {}; } };
const config = readConfig();
function currentProject() {
  if (process.env.SIM_PROJECT) return process.env.SIM_PROJECT;
  if (config.project && fs.existsSync(config.project)) return config.project;
  const own = path.join(here, '..', '..', 'FRC9427_offseasonBot');
  return fs.existsSync(path.join(own, 'build.gradle')) ? own : null;
}
function projectProblem(dir) {
  if (!dir || !fs.existsSync(dir)) return 'folder not found';
  if (!fs.existsSync(path.join(dir, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew'))) return 'no gradlew here (pick the folder that has gradlew / build.gradle)';
  if (!fs.existsSync(path.join(dir, 'src', 'main', 'java'))) return 'no src/main/java here';
  return null;
}
const projectInfo = () => ({ t: 'project', project: currentProject(), recent: (config.recent || []).filter((p) => fs.existsSync(p)) });
// Switch the running robot program to another project folder: stop the current one, remember the choice,
// start the new one (the UI gets the new controls / description as soon as it's analysed).
async function switchProject(dir) {
  dir = path.resolve(String(dir || ''));
  const problem = projectProblem(dir);
  if (problem) return { ok: false, error: problem };
  delete process.env.SIM_PROJECT;   // an explicit choice in the UI overrides the start-up setting from now on
  config.project = dir;
  config.recent = [dir, ...(config.recent || []).filter((p) => p !== dir)].slice(0, 6);
  try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n'); } catch (e) { console.error('config:', e.message); }
  if (robotProc) {
    stopRobot();
    for (let i = 0; i < 100 && robotProc; i++) await new Promise((r) => setTimeout(r, 100));
  }
  controlsInfo = null; robotDesc = null;
  chassis.reset(2.0, 4.03, 0);
  const r = startRobot(dir);
  broadcast(projectInfo());
  return r;
}
// Native folder picker (the browser can't hand over a real path). Runs on the machine the bridge is on.
function pickFolder() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve(null);
    const ps = [
      '[Console]::OutputEncoding=[Text.Encoding]::UTF8',
      'Add-Type -AssemblyName System.Windows.Forms',
      '$d=New-Object System.Windows.Forms.FolderBrowserDialog',
      "$d.Description='WPILib robot project folder (the one with gradlew / build.gradle)'",
      '$d.ShowNewFolderButton=$false',
      `$d.SelectedPath='${(currentProject() || '').replace(/'/g, "''")}'`,
      '$f=New-Object System.Windows.Forms.Form -Property @{TopMost=$true}',
      "if($d.ShowDialog($f) -eq 'OK'){[Console]::Out.Write($d.SelectedPath)}",
    ].join('; ');
    const p = spawn('powershell.exe', ['-NoProfile', '-STA', '-Command', ps], { windowsHide: true });
    let out = '';
    p.stdout.on('data', (b) => { out += b.toString('utf8'); });
    p.on('exit', () => resolve(out.trim() || null));
    p.on('error', () => resolve(null));
  });
}
// ---------- robot process ----------
let robotProc = null;
function findJdk() {
  if (process.env.JAVA_HOME) return process.env.JAVA_HOME;
  const root = 'C:\\Users\\Public\\wpilib';
  if (fs.existsSync(root)) {
    const years = fs.readdirSync(root).filter((d) => /^\d{4}$/.test(d)).sort().reverse();
    for (const y of years) if (fs.existsSync(path.join(root, y, 'jdk'))) return path.join(root, y, 'jdk');
  }
  return null;
}

export function startRobot(projectDir) {
  if (robotProc) return { ok: false, error: 'already running' };
  const gradlew = path.join(projectDir, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
  if (!fs.existsSync(gradlew)) return { ok: false, error: `no gradlew in ${projectDir}` };
  const jdk = findJdk();
  const init = path.join(here, 'enable-ws.init.gradle');
  const env = { ...process.env, JAVA_HOME: jdk || process.env.JAVA_HOME, JAVA_TOOL_OPTIONS: '-Dfile.encoding=UTF-8' };
  robotProc = spawn(gradlew, ['simulateJava', '-I', init], { cwd: projectDir, env, shell: process.platform === 'win32' });
  state.robot = { running: true, project: projectDir, log: [] };
  analyze(projectDir);
  watchProject(projectDir);
  const onData = (buf) => {
    for (const line of buf.toString().split(/\r?\n/)) {
      if (!line.trim() || /reportJoystickUnpluggedWarning|on port \d+ not available/.test(line)) continue;
      state.robot.log.push(line);
      if (state.robot.log.length > 300) state.robot.log.shift();
      broadcast({ t: 'log', line });
    }
  };
  robotProc.stdout.on('data', onData);
  robotProc.stderr.on('data', onData);
  robotProc.on('exit', (code) => {
    robotProc = null; state.robot.running = false;
    broadcast({ t: 'robot', running: false, code });
  });
  broadcast({ t: 'robot', running: true, project: projectDir });
  return { ok: true };
}

export function stopRobot() {
  if (!robotProc) return;
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(robotProc.pid), '/T', '/F']);
  else robotProc.kill('SIGTERM');
}

// ---------- HALSim WebSocket client ----------
// messages per second from each HALSim device (diagnostics: how fresh the motor outputs are)
const halCounts = {}; let halRates = {};
setInterval(() => { halRates = Object.fromEntries(Object.entries(halCounts).map(([k, n]) => [k, n / 2])); for (const k of Object.keys(halCounts)) halCounts[k] = 0; }, 2000);
let hal = null;
function connectHal() {
  const ws = new WebSocket(HALSIM_URL);
  hal = ws;
  ws.onopen = () => { state.hal.connected = true; broadcast({ t: 'hal', connected: true }); };
  ws.onmessage = (e) => {
    try {
      const m = JSON.parse(e.data);
      const key = `${m.type}:${m.device || ''}`;
      halCounts[key] = (halCounts[key] || 0) + 1;
      const d = (state.hal.devices[key] ||= {});
      Object.assign(d, m.data);
    } catch { /* ignore */ }
  };
  ws.onclose = () => { state.hal.connected = false; state.hal.devices = {}; hal = null; setTimeout(connectHal, 1500); };
  ws.onerror = () => { try { ws.close(); } catch { /* ignore */ } };
}

// ---------- NT4 client ----------
// Subscribes to everything the code publishes, and publishes what simulated sensors that live on NT (Limelights)
// would send. Published values carry the robot's own NT clock (NT4 time sync), because the code uses those
// timestamps for latency compensation (LimelightHelpers -> addVisionMeasurement).
let ntPublish = null;   // (topic, type, value) => void, while connected
function connectNt() {
  const ws = new WebSocket(NT_URL, 'v4.1.networktables.first.wpi.edu');
  ws.binaryType = 'arraybuffer';
  const topics = new Map();
  const pubs = new Map();   // topic -> pubuid
  let clockOffset = null;   // server time (us) - local time (us)
  const nowUs = () => Math.round(performance.now() * 1000);
  const sync = () => { if (ws.readyState === 1) ws.send(ntFrame(-1, 0, 2, nowUs())); };
  let syncTimer = null;
  ws.onopen = () => {
    state.nt.connected = true;
    ws.send(JSON.stringify([{ method: 'subscribe', params: { topics: [''], subuid: 1, options: { prefix: true, periodic: 0.05 } } }]));
    sync(); syncTimer = setInterval(sync, 3000);
    ntPublish = (topic, type, value) => {
      if (clockOffset == null || ws.readyState !== 1) return;
      let id = pubs.get(topic);
      if (id == null) {
        id = pubs.size + 1;
        pubs.set(topic, id);
        ws.send(JSON.stringify([{ method: 'publish', params: { name: topic, pubuid: id, type, properties: {} } }]));
      }
      ws.send(ntFrame(id, nowUs() + clockOffset, NT_TYPE[type], value));
    };
  };
  ws.onmessage = (e) => {
    if (typeof e.data === 'string') {
      for (const m of JSON.parse(e.data)) {
        if (m.method === 'announce') { topics.set(m.params.id, m.params.name); state.nt.types[m.params.name] = m.params.type; }
        if (m.method === 'unannounce') { topics.delete(m.params.id); }
      }
    } else {
      for (const arr of decodeMulti(new Uint8Array(e.data))) {
        if (arr[0] === -1) { const rtt = nowUs() - Number(arr[3]); clockOffset = Number(arr[1]) + rtt / 2 - nowUs(); continue; }
        const name = topics.get(arr[0]);
        if (name) state.nt.values[name] = arr[3];
      }
    }
  };
  ws.onclose = () => { state.nt.connected = false; state.nt.values = {}; state.nt.types = {}; ntPublish = null; clearInterval(syncTimer); setTimeout(connectNt, 1500); };
  ws.onerror = () => { try { ws.close(); } catch { /* ignore */ } };
}
// NT4 binary frame [id, timestamp us, type, value] as msgpack, written by hand so doubles always go out as
// float64 (a generic encoder turns 1.0 into an int, which ntcore rejects for a double topic).
const NT_TYPE = { boolean: 0, double: 1, int: 2, 'double[]': 17 };
function ntFrame(id, ts, type, value) {
  const b = [];
  const u8 = (v) => b.push(v & 0xff);
  const int = (v) => {
    if (v >= 0 && v < 128) return u8(v);
    if (v < 0 && v >= -32) return u8(0xe0 | (v + 32));
    const dv = new DataView(new ArrayBuffer(9)); dv.setUint8(0, 0xd3); dv.setBigInt64(1, BigInt(Math.round(v))); b.push(...new Uint8Array(dv.buffer));
  };
  const dbl = (v) => { const dv = new DataView(new ArrayBuffer(9)); dv.setUint8(0, 0xcb); dv.setFloat64(1, v); b.push(...new Uint8Array(dv.buffer)); };
  u8(0x94); int(id); int(ts); int(type);
  if (type === 1) dbl(value);
  else if (type === 17) { u8(0xdc); u8(value.length >> 8); u8(value.length); value.forEach(dbl); }
  else if (type === 0) u8(value ? 0xc3 : 0xc2);
  else int(value);
  return new Uint8Array(b);
}

// ---------- simulated Limelights (vision.mjs): 20 Hz, like a camera pipeline ----------
let limelights = [];
setInterval(() => {
  if (!ntPublish || !chassis.cfg || !state.robot.running || !limelights.length) return;
  const cam = (robotDesc && robotDesc.vision) || {};
  if (cam.enabled === false) return;
  for (const name of limelights) {
    // MegaTag2 reports the robot yaw the code itself sent (robot_orientation_set), exactly like the real camera
    const ori = state.nt.values[`/${name}/robot_orientation_set`];
    const yaw = Array.isArray(ori) && typeof ori[0] === 'number' ? ori[0] : (chassis.pose.theta * 180) / Math.PI;
    for (const v of limelightFrame(name, chassis.pose, { x: 0.2, y: 0, z: 0.5, yawDeg: 0, hfovDeg: 62.5, vfovDeg: 48.9, maxDist: 6, ...cam }, yaw)) ntPublish(v.topic, v.type, v.value);
  }
}, 50);
// ---------- driver station / joystick -> robot ----------
const ds = { enabled: false, autonomous: false, test: false, estop: false };
function pushDs() {
  if (!hal || hal.readyState !== 1) return;
  hal.send(JSON.stringify({ type: 'DriverStation', device: '', data: { '>enabled': ds.enabled, '>autonomous': ds.autonomous, '>test': ds.test, '>estop': ds.estop, '>ds': true, '>new_data': true } }));
}
const joys = {};
function pushJoy(i) {
  if (!hal || hal.readyState !== 1) return;
  const j = joys[i];
  hal.send(JSON.stringify({ type: 'Joystick', device: String(i), data: { '>axes': j.axes, '>buttons': j.buttons, '>povs': j.povs } }));
}
setInterval(() => { pushDs(); for (const i of Object.keys(joys)) pushJoy(i); }, 20);

// ---------- generic motor physics: commanded voltage -> rotor position/velocity feedback ----------
const motorSim = new MotorSim();
const chassis = new SwerveChassis();
let lastMotorT = performance.now();
function motorTick() {
  const now = performance.now();
  const dt = Math.min((now - lastMotorT) / 1000, 0.1);
  lastMotorT = now;
  if (!hal || hal.readyState !== 1) return;
  for (const msg of motorSim.step(dt, state.hal.devices)) hal.send(JSON.stringify(msg));
  for (const msg of chassis.step(dt, state.hal.devices, motorSim.snapshot())) hal.send(JSON.stringify(msg));
}
// Sensor feedback rate matters: the motor controllers close their loops on the rotor position we send, so a
// stale position is loop delay. Windows timers only tick every ~15.6 ms (setInterval/Atomics.wait alike), which
// made stiff position loops (a hood at kP 160) oscillate. While the robot program runs, step every
// MOTOR_PERIOD_MS using setImmediate (still yields to network I/O every pass); otherwise idle on a timer.
const MOTOR_PERIOD_MS = Number(process.env.SIM_MOTOR_PERIOD_MS || 4);
let nextMotor = performance.now();
function motorLoop() {
  const now = performance.now();
  if (now >= nextMotor) { motorTick(); nextMotor = Math.max(nextMotor + MOTOR_PERIOD_MS, now - 20); }
  if (robotProc && hal && hal.readyState === 1) setImmediate(motorLoop);
  else setTimeout(() => { nextMotor = performance.now(); motorLoop(); }, 10);
}
motorLoop();

// ---------- summary to the UI ----------
function summary() {
  const nt = state.nt.values;
  const field = nt['/SmartDashboard/Field/Robot'];
  const motors = {};
  for (const [k, v] of Object.entries(state.hal.devices)) {
    if (k.startsWith('CANMotor:')) motors[k.slice(9)] = { volts: v['<motorVoltage'] ?? 0, duty: v['<dutyCycle'] ?? 0 };
  }
  const numeric = {};
  for (const [k, v] of Object.entries(nt)) {
    // AdvantageKit logs Pose2d as a WPILib struct (3 little-endian doubles: x, y, rotation rad) -> [x, y, deg]
    if (state.nt.types[k] === 'struct:Pose2d' && v instanceof Uint8Array && v.length === 24) {
      const d = new DataView(v.buffer, v.byteOffset, 24);
      numeric[k] = [d.getFloat64(0, true), d.getFloat64(8, true), (d.getFloat64(16, true) * 180) / Math.PI];
      continue;
    }
    if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string' || (Array.isArray(v) && v.length <= 8 && v.every((x) => typeof x === 'number'))) numeric[k] = v;
  }
  return {
    t: 'state',
    robot: { running: state.robot.running, project: state.robot.project },
    hal: state.hal.connected, nt: state.nt.connected,
    // simulated chassis (from the real wheels) when the robot is a known drivetrain, else whatever the code publishes
    pose: chassis.cfg && state.robot.running ? [chassis.pose.x, chassis.pose.y, (chassis.pose.theta * 180) / Math.PI]
      : Array.isArray(field) && field.length >= 3 ? field.slice(0, 3) : null,
    // BUMP ramp height/tilt, degrees/metres, field-frame (only meaningful alongside the simulated pose above)
    terrain: chassis.cfg ? { z: chassis.pose.z || 0, pitch: ((chassis.pitch || 0) * 180) / Math.PI, roll: ((chassis.roll || 0) * 180) / Math.PI } : null,
    chassisDebug: chassis.debug, halRates,
    robotPose: Array.isArray(field) && field.length >= 3 ? field.slice(0, 3) : null,
    ds, motors, values: numeric, rotors: motorSim.snapshot(),
    gyro: Object.fromEntries(Object.entries(state.hal.devices).filter(([k]) => k.startsWith('CANGyro:')).map(([k, v]) => [k.slice(8), v['<yaw'] ?? 0])),
  };
}
setInterval(() => { if (clients.size) broadcast(summary()); }, 50);

// ---------- UI server ----------
const wss = new WebSocketServer({ port: UI_PORT });
wss.on('connection', (ws) => {
  clients.add(ws);
  send(ws, { t: 'hello', running: state.robot.running, project: state.robot.project, log: state.robot.log.slice(-60) });
  send(ws, projectInfo());
  if (!controlsInfo && currentProject()) analyze(currentProject());
  if (controlsInfo) send(ws, { t: 'controls', data: controlsInfo });
  if (robotDesc) send(ws, { t: 'robotDesc', desc: robotDesc, motors: codeMotors });
  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'start') send(ws, { t: 'startResult', ...startRobot(m.project || currentProject()) });
    else if (m.t === 'stop') stopRobot();
    else if (m.t === 'pickProject') pickFolder().then((dir) => (dir ? switchProject(dir) : { ok: false, cancelled: true })).then((r) => send(ws, { t: 'projectResult', ...r }));
    else if (m.t === 'setProject') switchProject(m.project).then((r) => send(ws, { t: 'projectResult', ...r }));
    else if (m.t === 'resetPose') chassis.reset(m.x ?? 2, m.y ?? 4, m.deg ?? 0);
    else if (m.t === 'devices') send(ws, { t: 'devices', devices: state.hal.devices, mech: mechInfo });
    else if (m.t === 'saveRobotDesc' && m.desc) {
      const dir = descProject || state.robot.project || currentProject();
      if (dir) { try { robotDesc = saveRobotDesc(dir, m.desc); broadcast({ t: 'robotDesc', desc: robotDesc, motors: codeMotors }); } catch (e) { send(ws, { t: 'error', error: String(e.message || e) }); } }
    } else if (m.t === 'analyze') analyze(m.project || currentProject());
    else if (m.t === 'ds') Object.assign(ds, { enabled: !!m.enabled, autonomous: !!m.autonomous, test: !!m.test, estop: !!m.estop });
    else if (m.t === 'joy') joys[m.index ?? 0] = { axes: m.axes || [], buttons: m.buttons || [], povs: m.povs || [] };
  });
  ws.on('close', () => {
    clients.delete(ws);
    if (!clients.size) { // nobody is driving: release the sticks and disable, like unplugging a Driver Station
      for (const i of Object.keys(joys)) delete joys[i];
      ds.enabled = false;
    }
  });
});

connectHal();
connectNt();
process.on('SIGINT', () => { stopRobot(); process.exit(0); });
console.log(`sim bridge listening on ws://localhost:${UI_PORT}`);
if (currentProject() && process.env.SIM_AUTOSTART !== '0') startRobot(currentProject());
else if (!currentProject()) console.log('no robot project yet: pick one in the UI (Robot > Code & bindings)');
