import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildField, FIELD_L, FIELD_W } from './field.js';
import { initUI, setControlsInfo, setRobotDesc } from './ui.js';
import { t as tr } from './i18n.js';
import { buildFuel } from './fuel.js';
import { buildTags } from './tags.js';
import { buildVenue } from './venue.js';
import { buildScoreboards } from './scoreboard.js';
import { buildCrowd } from './crowd.js';
import { buildOfficials } from './officials.js';
import { buildProps } from './props.js';
import { events, wireCrowd } from './events.js';
import { createRobotLink } from './robot.js';
import { createTouchUI } from './touch.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

const IN = 0.0254;
window.__dbg = {}; // dev hooks for profiling
const W_M = FIELD_W * IN;

// ---------- 3D scene ----------
const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// Khronos PBR Neutral keeps saturated albedo (royal blue plates, yellow fuel) instead of ACES bleaching them toward white
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 0.8;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
// warm, not the cool blue-grey it was - matches the venue's own warmer palette instead of fighting it
scene.background = new THREE.Color(0xc7bda5);
scene.fog = new THREE.Fog(0xc7bda5, 45, 110);
// Image-based lighting so metal and paint get believable reflections. Real HDRI (Poly Haven "Gym 01",
// CC0, public/env/gym_01_1k.hdr) - actual captured indoor-gym light/reflections, not just the procedural
// RoomEnvironment placeholder. Loads async; the procedural room lights the very first frames until it's in.
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.5;
new HDRLoader().load('/env/gym_01_1k.hdr', (hdr) => {
  const envMap = pmrem.fromEquirectangular(hdr).texture;
  scene.environment = envMap;
  hdr.dispose();
  pmrem.dispose();
});

const camera = new THREE.PerspectiveCamera(45, 1, 0.2, 120);
const center = new THREE.Vector3(FIELD_L / 2 * IN, 0.4, -FIELD_W / 2 * IN);
const controls = new OrbitControls(camera, canvas);
controls.target.copy(center);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 2;
controls.maxDistance = 30;

scene.add(new THREE.HemisphereLight(0xdbe8ff, 0x6a707c, 0.8));
const sun = new THREE.DirectionalLight(0xfff3e0, 1.4);
sun.position.set(center.x + 6, 14, center.z + 5);
sun.target.position.copy(center);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
const sc = sun.shadow.camera;
sc.left = -10; sc.right = 10; sc.top = 6; sc.bottom = -6; sc.near = 1; sc.far = 40;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

buildField().then((f) => scene.add(f));
const fuel = buildFuel(events);
scene.add(fuel);
scene.add(buildTags());
scene.add(buildVenue());
scene.add(buildOfficials());
const props = buildProps();
scene.add(props.group);

// ---- robot link (bridge to the running robot code) ----
const link = createRobotLink(scene);
window.__link = link; // dev hook
window.__lookAt = (px, py, pz, tx, ty, tz) => { camera.position.set(px, py, pz); controls.target.set(tx, ty, tz); controls.update(); }; // dev hook
window.__link = link;
let followRobot = false;
const dsEl = { state: document.getElementById('dsstate'), en: document.getElementById('dsen'), mode: document.getElementById('dsmode'), follow: document.getElementById('dsfollow'), bar: document.getElementById('dsbar') };
link.onStatus = (l) => {
  dsEl.bar.hidden = false;
  dsEl.state.textContent = !l.connected ? 'BRIDGE: OFFLINE' : !l.running ? 'ROBOT CODE: STOPPED' : l.state && l.state.hal ? 'ROBOT CODE: RUNNING' : 'ROBOT CODE: STARTING...';
  dsEl.state.className = 'ds-chip ' + (l.connected && l.running && l.state && l.state.hal ? 'ok' : 'bad');
  dsEl.en.textContent = l.ds.enabled ? 'DISABLE' : 'ENABLE'; dsEl.en.classList.toggle('on', l.ds.enabled);
  dsEl.mode.textContent = l.ds.autonomous ? 'AUTO' : 'TELEOP';
};
dsEl.en.onclick = () => link.setDs({ enabled: !link.ds.enabled });
dsEl.mode.onclick = () => link.setDs({ autonomous: !link.ds.autonomous });
dsEl.follow.onclick = () => { followRobot = !followRobot; dsEl.follow.classList.toggle('on', followRobot); };
addEventListener('keydown', (e) => { if (e.code === 'Enter' && appState === 'game') link.setDs({ enabled: !link.ds.enabled }); });
const scoreboards = buildScoreboards();
scene.add(scoreboards.group);
scoreboards.set({ blue: 42, red: 37, blueFuel: 58, redFuel: 51, time: 118, phase: 'TELEOP' }); // demo values until the match engine drives it
window.__score = (p) => scoreboards.set(p);
let crowd = null;
let crowdMode = '自動';
let slowSince = 0;
window.__events = events; // dev hook: __events.emit('score', { side: 'blue', points: 1 })
events.on('score', ({ side, points = 1, fuel: f = 0 }) => {
  const key = side === 'blue' ? 'blue' : 'red';
  scoreboards.set({ [key]: scoreboards.state[key] + points, [key + 'Fuel']: (scoreboards.state[key + 'Fuel'] || 0) + f });
});
buildCrowd().then((c) => {
  crowd = c; wireCrowd(c); scene.add(c.group); console.log('crowd', c.count);
  // keep the crowd out of the AO pre-pass (its override material would draw the un-animated T-pose)
  const aoRender = ao.render.bind(ao);
  ao.render = (...args) => { c.meshes.forEach((m) => { m.visible = false; }); aoRender(...args); c.meshes.forEach((m) => { m.visible = true; }); };
}).catch((e) => console.error('crowd failed', e));

// Camera presets
const VIEWS = {
  hero: () => setView([center.x - 7.5, 5.2, center.z + 8.5], center),
  wide: () => setView([center.x + 6, 7.5, -W_M - 8], new THREE.Vector3(center.x - 2, 2.5, 2)),
  table: () => setView([center.x - 3, 2.6, -W_M - 2.5], new THREE.Vector3(center.x + 1, 1.2, 4)),
  stands: () => setView([center.x - 2, 2.6, center.z - 1.5], new THREE.Vector3(center.x + 1, 2.0, center.z - 8.5)),
  hubBlue: () => setView([181.56 * IN + 2.6, 1.9, -158.3 * IN + 0.6], new THREE.Vector3(181.56 * IN, 1.1, -158.3 * IN)),
  // high and a little toward the scoring table: straight down from under the roof would look onto the top of the centre-hung scoreboard
  top: () => setView([center.x, 12, center.z + 5.5], center),
  scoreboard: () => setView([FIELD_L * IN - 2, 2.2, center.z + 0.3], new THREE.Vector3(-0.25, 2.9, center.z)),
  blue: () => setView([-1.5, 3.4, center.z], new THREE.Vector3(center.x - 3, 0.6, center.z)),
  red: () => setView([FIELD_L * IN + 1.5, 3.4, center.z], new THREE.Vector3(center.x + 3, 0.6, center.z)),
};
function setView(pos, target) {
  camera.position.set(...pos);
  controls.target.copy(target);
  controls.update();
}
window.__view = (n) => VIEWS[n] && VIEWS[n]();
VIEWS.hero();

// Post: ambient occlusion for contact shadows
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const ao = new GTAOPass(scene, camera, innerWidth, innerHeight);
Object.assign(window.__dbg, { scene, ao, renderer });
ao.output = GTAOPass.OUTPUT.Default;
// radius up a bit (was missing the taller contact lines - stand risers, table legs) so more of the scene
// actually gets the "grounded" contact-shadow look instead of floating free of its own shadow
ao.updateGtaoMaterial({ radius: 0.55, distanceExponent: 1.4, thickness: 1, scale: 1.25, samples: 12 });
composer.addPass(ao);
// Subtle warm glow around bright lights/screens - the reference look has this atmospheric quality that a
// flat, unbloomed render (what every screenshot so far has been) can't reach no matter what colour the
// materials are.
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.12, 0.4, 0.94);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ---------- app states: LOBBY and GAME are two separate screens ----------
// LOBBY: only the menus exist in the page; the 3D view behind them is a cheap backdrop (no post-processing,
//   reduced resolution, ~20 fps, no crowd animation, no fuel physics, shadows frozen).
// GAME: the lobby DOM is detached from the page entirely and only the match HUD is mounted; the renderer
//   gets full resolution, post-processing and every simulation step. Esc / the HUD exit button goes back.
const lobbyRoot = document.getElementById('lobbyRoot');
const gameRoot = document.getElementById('gameRoot');
const hud = { blue: document.getElementById('hudBlue'), red: document.getElementById('hudRed'), time: document.getElementById('hudTime'), phase: document.getElementById('hudPhase'), fps: document.getElementById('hudFps'), exit: document.getElementById('hudExit'), exitLabel: document.getElementById('hudExitLabel') };
const fpsEl = document.getElementById('fps');
gameRoot.remove();
let appState = 'lobby';
let qualityPR = Math.min(devicePixelRatio, 2);   // the in-game pixel ratio (Settings > Display > Quality)
function applyPixelRatio() {
  renderer.setPixelRatio(appState === 'game' ? qualityPR : Math.min(qualityPR, 1) * 0.75);
  composer.setPixelRatio(renderer.getPixelRatio());
  resize();
}
applyPixelRatio();   // start in the lobby's cheap backdrop mode
let hudTimer = 0;
function updateHud() {
  const s = scoreboards.state;
  hud.blue.textContent = s.blue ?? 0;
  hud.red.textContent = s.red ?? 0;
  const tm = Math.max(0, Math.round(s.time ?? 0));
  hud.time.textContent = `${Math.floor(tm / 60)}:${String(tm % 60).padStart(2, '0')}`;
  hud.phase.textContent = s.phase || '';
}
function setAppState(next) {
  if (next === appState) return;
  appState = next;
  if (next === 'game') {
    lobbyRoot.remove();
    document.body.append(gameRoot);
    document.body.classList.replace('lobby', 'playing');
    hud.exitLabel.textContent = tr('離開');
    renderer.shadowMap.autoUpdate = true;
    updateHud(); hudTimer = setInterval(updateHud, 250);
    VIEWS.top();
  } else {
    link.setDs({ enabled: false });   // leaving the match disables the robot, like closing the Driver Station
    followRobot = false; dsEl.follow.classList.remove('on');
    clearInterval(hudTimer);
    gameRoot.remove();
    document.body.insertBefore(lobbyRoot, canvas.nextSibling);
    document.body.classList.replace('playing', 'lobby');
    VIEWS.hero();
  }
  applyPixelRatio();
}
hud.exit.onclick = () => setAppState('lobby');
addEventListener('keydown', (e) => { if (e.key === 'Escape' && appState === 'game') setAppState('lobby'); });

let last = performance.now(), frames = 0, acc = 0, lastLobbyFrame = 0;
renderer.setAnimationLoop((t) => {
  if (appState === 'lobby') {
    if (t - lastLobbyFrame < 50) return;   // ~20 fps backdrop
    const dt = (t - (lastLobbyFrame || t)) / 1000;
    lastLobbyFrame = t; last = t;
    acc += dt; frames++;
    if (acc > 0.5) { fpsEl.textContent = `${Math.round(frames / acc)} FPS`; acc = 0; frames = 0; }
    controls.autoRotate = true; controls.autoRotateSpeed = 0.35 * 3;   // x3: fewer frames per second
    controls.update();
    renderer.shadowMap.autoUpdate = false;   // shadows stay as last rendered
    renderer.render(scene, camera);
    return;
  }
  const dt = (t - last) / 1000; last = t;
  acc += dt; frames++;
  if (acc > 0.5) { hud.fps.textContent = `${Math.round(frames / acc)} FPS`; acc = 0; frames = 0; }
  controls.autoRotate = false;
  controls.update();
  if (followRobot && link.robot.visible) {
    const p = link.robot.position;
    controls.target.lerp(new THREE.Vector3(p.x, 0.4, p.z), 0.12);
    const dir = new THREE.Vector3().subVectors(camera.position, controls.target); dir.y = 0;
    if (dir.length() > 5) camera.position.add(new THREE.Vector3().subVectors(controls.target, camera.position).setY(0).multiplyScalar(0.02));
  }
  if (crowd) {
    crowd.update(Math.min(dt, 0.1));
    // auto density: shed spectators while the frame rate stays low, never below 35%
    if (crowdMode === '自動' && dt > 0.05 && crowd.density > 0.35) {
      slowSince += dt;
      if (slowSince > 2.5) { crowd.setDensity(Math.max(0.35, crowd.density - 0.15)); slowSince = 0; }
    } else if (dt <= 0.05) slowSince = 0;
  }
  fuel.userData.update(Math.min(dt, 0.1), link);
  props.update(t / 1000);
  composer.render();
});
// ---------- UI ----------
const VIEW_NAMES = { '總覽': 'hero', '俯視': 'top', '藍方': 'blue', '紅方': 'red' };
const uiApi = initUI({
  onStart: () => {
    setAppState('game');
    if (link.connected && !link.running) link.start();
  },
  onPreview: (on) => { if (on) VIEWS.top(); else VIEWS.hero(); },
  onSettingChange: (k, v) => {
    if (k === 'crowd') { crowdMode = v; if (crowd && v !== '自動') crowd.setDensity(v === '低' ? 0.35 : v === '中' ? 0.7 : 1); }
    if (k === 'shadows') renderer.shadowMap.enabled = !!v;
    if (k === 'quality') ao.enabled = v === '高';
    if (k === 'quality') { qualityPR = v === '低' ? 1 : v === '中' ? Math.min(devicePixelRatio, 1.5) : Math.min(devicePixelRatio, 2); applyPixelRatio(); }
    if (k === 'touch') touchUI.setMode(v);
    if (k === 'cam' && VIEW_NAMES[v]) VIEWS[VIEW_NAMES[v]]();
  },
});
// control panel follows the robot's own source: re-read whenever the bridge re-analyses the project
const touchUI = createTouchUI(link);
touchUI.apply();
link.onControls = (info) => { setControlsInfo(info); touchUI.build(info); uiApi.refresh(); };
if (link.controls) link.onControls(link.controls);
// ROBOT > 機構描述 edits the description the fuel rules read (link.desc); the bridge saves it per project
link.onDesc = (desc) => { setRobotDesc(desc, { getState: () => link.state, save: (d) => link.saveDesc(d), motors: link.descMotors }); uiApi.refresh(); };
if (link.desc) link.onDesc(link.desc);
