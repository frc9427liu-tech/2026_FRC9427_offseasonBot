// Connects the scene to the simulator bridge: robot pose from the running robot code, and the driver-station
// input (keyboard / gamepad / touch) going back to it exactly like a real Driver Station would.
import * as THREE from 'three';

const BRIDGE_URL = `ws://${location.hostname || 'localhost'}:8765`;

export function buildPlaceholderRobot(alliance = 'blue') {
  // Stand-in until the team's own CAD model is loaded: frame, bumpers in alliance colour, and a direction marker.
  const g = new THREE.Group();
  const size = 0.84, h = 0.42;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(size - 0.12, h, size - 0.12), new THREE.MeshStandardMaterial({ color: 0x2b3038, roughness: 0.5, metalness: 0.6 }));
  frame.position.y = h / 2 + 0.05;
  const bumperMat = new THREE.MeshStandardMaterial({ color: alliance === 'blue' ? 0x1f5fd0 : 0xd7263d, roughness: 0.85 });
  const bumper = (w, d, x, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.13, d), bumperMat); m.position.set(x, 0.14, z); return m; };
  g.add(frame, bumper(size, 0.09, 0, size / 2 - 0.045), bumper(size, 0.09, 0, -size / 2 + 0.045), bumper(0.09, size, size / 2 - 0.045, 0), bumper(0.09, size, -size / 2 + 0.045, 0));
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 3), new THREE.MeshBasicMaterial({ color: 0xffd24a }));
  nose.rotation.z = -Math.PI / 2; nose.position.set(size / 2 - 0.02, 0.5, 0);
  g.add(nose);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
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
        if (m.pose) {
          // WPILib field coordinates (m, deg): +X toward red, +Y away from the scoring table (= -Z in the scene)
          robot.visible = true;
          robot.position.set(m.pose[0], 0, -m.pose[1]);
          robot.rotation.y = THREE.MathUtils.degToRad(m.pose[2]);
          if (link.onPose) link.onPose(m.pose);
        }
        link.onStatus(link);
      } else if (m.t === 'log') { link.log.push(m.line); if (link.log.length > 200) link.log.shift(); }
      else if (m.t === 'hello') { link.log = m.log || []; }
    };
  }
  connect();

  link.start = (project) => send({ t: 'start', project });
  link.stop = () => send({ t: 'stop' });
  link.setDs = (patch) => { Object.assign(link.ds, patch); send({ t: 'ds', enabled: link.ds.enabled, autonomous: link.ds.autonomous }); };

  // ---- inputs: keyboard -> virtual Xbox pad; a real gamepad overrides it while connected ----
  const keys = new Set();
  addEventListener('keydown', (e) => { if (!e.repeat) keys.add(e.code); });
  addEventListener('keyup', (e) => keys.delete(e.code));
  const pad = link.pad;
  const kbdPad = () => {
    const ax = (neg, pos) => (keys.has(pos) ? 1 : 0) - (keys.has(neg) ? 1 : 0);
    pad.axes = [ax('KeyA', 'KeyD'), ax('KeyW', 'KeyS'), keys.has('KeyQ') ? 1 : 0, keys.has('KeyE') ? 1 : 0, ax('ArrowLeft', 'ArrowRight'), ax('ArrowUp', 'ArrowDown')];
    // WPILib Xbox: index 0 A,1 B,2 X,3 Y,4 LB,5 RB,6 Back,7 Start,8 LS,9 RS
    const b = new Array(12).fill(false);
    b[0] = keys.has('Space'); b[1] = keys.has('KeyB'); b[2] = keys.has('KeyX'); b[3] = keys.has('KeyY');
    b[4] = keys.has('ShiftLeft'); b[5] = keys.has('KeyR'); b[7] = keys.has('Enter');
    pad.buttons = b;
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
    if (!link.connected) return;
    if (!gamepadPad()) kbdPad();
    const dz = (v) => (Math.abs(v) < 0.08 ? 0 : v);
    send({ t: 'joy', index: 0, axes: pad.axes.map(dz), buttons: pad.buttons, povs: pad.povs });
  }, 20);

  return link;
}
