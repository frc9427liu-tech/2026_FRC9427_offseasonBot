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
import { deriveMechanisms } from './mechanisms.mjs';

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
function analyze(projectDir) {
  try { const mech = deriveMechanisms(projectDir); motorSim.setMechanisms(mech); mechInfo = mech; } catch (e) { console.error('mechanisms:', e); }
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
let hal = null;
function connectHal() {
  const ws = new WebSocket(HALSIM_URL);
  hal = ws;
  ws.onopen = () => { state.hal.connected = true; broadcast({ t: 'hal', connected: true }); };
  ws.onmessage = (e) => {
    try {
      const m = JSON.parse(e.data);
      const key = `${m.type}:${m.device || ''}`;
      const d = (state.hal.devices[key] ||= {});
      Object.assign(d, m.data);
    } catch { /* ignore */ }
  };
  ws.onclose = () => { state.hal.connected = false; state.hal.devices = {}; hal = null; setTimeout(connectHal, 1500); };
  ws.onerror = () => { try { ws.close(); } catch { /* ignore */ } };
}

// ---------- NT4 client ----------
function connectNt() {
  const ws = new WebSocket(NT_URL, 'v4.1.networktables.first.wpi.edu');
  ws.binaryType = 'arraybuffer';
  const topics = new Map();
  ws.onopen = () => {
    state.nt.connected = true;
    ws.send(JSON.stringify([{ method: 'subscribe', params: { topics: [''], subuid: 1, options: { prefix: true, periodic: 0.05 } } }]));
  };
  ws.onmessage = (e) => {
    if (typeof e.data === 'string') {
      for (const m of JSON.parse(e.data)) {
        if (m.method === 'announce') { topics.set(m.params.id, m.params.name); state.nt.types[m.params.name] = m.params.type; }
        if (m.method === 'unannounce') { topics.delete(m.params.id); }
      }
    } else {
      for (const arr of decodeMulti(new Uint8Array(e.data))) {
        const name = topics.get(arr[0]);
        if (name) state.nt.values[name] = arr[3];
      }
    }
  };
  ws.onclose = () => { state.nt.connected = false; state.nt.values = {}; state.nt.types = {}; setTimeout(connectNt, 1500); };
  ws.onerror = () => { try { ws.close(); } catch { /* ignore */ } };
}

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
let lastMotorT = performance.now();
setInterval(() => {
  const now = performance.now();
  const dt = Math.min((now - lastMotorT) / 1000, 0.1);
  lastMotorT = now;
  if (!hal || hal.readyState !== 1) return;
  for (const msg of motorSim.step(dt, state.hal.devices)) hal.send(JSON.stringify(msg));
}, 10);

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
    if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string' || (Array.isArray(v) && v.length <= 8 && v.every((x) => typeof x === 'number'))) numeric[k] = v;
  }
  return {
    t: 'state',
    robot: { running: state.robot.running, project: state.robot.project },
    hal: state.hal.connected, nt: state.nt.connected,
    pose: Array.isArray(field) && field.length >= 3 ? field.slice(0, 3) : null,
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
  if (!controlsInfo && process.env.SIM_PROJECT) analyze(process.env.SIM_PROJECT);
  if (controlsInfo) send(ws, { t: 'controls', data: controlsInfo });
  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'start') send(ws, { t: 'startResult', ...startRobot(m.project || process.env.SIM_PROJECT) });
    else if (m.t === 'stop') stopRobot();
    else if (m.t === 'devices') send(ws, { t: 'devices', devices: state.hal.devices, mech: mechInfo });
    else if (m.t === 'analyze') analyze(m.project || process.env.SIM_PROJECT);
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
if (process.env.SIM_PROJECT && process.env.SIM_AUTOSTART !== '0') startRobot(process.env.SIM_PROJECT);
