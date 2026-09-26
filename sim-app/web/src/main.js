import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildField, FIELD_L, FIELD_W } from './field.js';
import { initUI } from './ui.js';
import { buildFuel } from './fuel.js';
import { buildTags } from './tags.js';
import { buildVenue } from './venue.js';
import { buildScoreboards } from './scoreboard.js';
import { buildCrowd } from './crowd.js';
import { events, wireCrowd } from './events.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const IN = 0.0254;

// ---------- 3D scene ----------
const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070d1a);
scene.fog = new THREE.Fog(0x070d1a, 24, 60);
// Image-based lighting so metal and paint get believable reflections
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.22;

const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 120);
const center = new THREE.Vector3(FIELD_L / 2 * IN, 0.4, -FIELD_W / 2 * IN);
const controls = new OrbitControls(camera, canvas);
controls.target.copy(center);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 2;
controls.maxDistance = 30;

scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x1a2233, 0.35));
const sun = new THREE.DirectionalLight(0xfff3e0, 1.5);
sun.position.set(center.x + 6, 14, center.z + 5);
sun.target.position.copy(center);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
const sc = sun.shadow.camera;
sc.left = -10; sc.right = 10; sc.top = 6; sc.bottom = -6; sc.near = 1; sc.far = 40;
sun.shadow.bias = -0.0004;
scene.add(sun, sun.target);

buildField().then((f) => scene.add(f));
scene.add(buildFuel());
scene.add(buildTags());
scene.add(buildVenue());
const scoreboards = buildScoreboards();
scene.add(scoreboards.group);
scoreboards.set({ blue: 42, red: 37, blueFuel: 58, redFuel: 51, time: 118, phase: 'TELEOP' }); // demo values until the match engine drives it
window.__score = (p) => scoreboards.set(p);
let crowd = null;
window.__events = events; // dev hook: __events.emit('score', { side: 'blue', points: 1 })
events.on('score', ({ side, points = 1 }) => {
  const key = side === 'blue' ? 'blue' : 'red';
  scoreboards.set({ [key]: scoreboards.state[key] + points });
});
buildCrowd().then((c) => { crowd = c; wireCrowd(c); scene.add(c.group); console.log('crowd', c.count); }).catch((e) => console.error('crowd failed', e));

// Camera presets
const VIEWS = {
  hero: () => setView([center.x - 7.5, 5.2, center.z + 8.5], center),
  stands: () => setView([center.x - 2, 2.6, center.z - 1.5], new THREE.Vector3(center.x + 1, 2.0, center.z - 8.5)),
  hubBlue: () => setView([181.56 * IN + 2.6, 1.9, -158.3 * IN + 0.6], new THREE.Vector3(181.56 * IN, 1.1, -158.3 * IN)),
  top: () => setView([center.x, 19, center.z + 0.01], center),
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
ao.output = GTAOPass.OUTPUT.Default;
ao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.5, thickness: 1, scale: 1.1, samples: 12 });
composer.addPass(ao);
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

// Slow orbit while in the menu
let menuMode = true;
let last = performance.now(), frames = 0, acc = 0;
const fpsEl = document.getElementById('fps');
renderer.setAnimationLoop((t) => {
  const dt = (t - last) / 1000; last = t;
  acc += dt; frames++;
  if (acc > 0.5) { fpsEl.textContent = `${Math.round(frames / acc)} FPS`; acc = 0; frames = 0; }
  if (menuMode) controls.autoRotate = true, controls.autoRotateSpeed = 0.35;
  else controls.autoRotate = false;
  controls.update();
  if (crowd) crowd.update(Math.min(dt, 0.1));
  composer.render();
});

// ---------- UI ----------
const VIEW_NAMES = { '總覽': 'hero', '俯視': 'top', '藍方': 'blue', '紅方': 'red' };
initUI({
  onStart: () => {
    document.body.classList.remove('lobby');
    document.body.classList.add('playing');
    menuMode = false;
    VIEWS.top();
  },
  onPreview: (on) => { if (on) VIEWS.top(); else VIEWS.hero(); },
  onSettingChange: (k, v) => {
    if (k === 'shadows') renderer.shadowMap.enabled = !!v;
    if (k === 'quality') ao.enabled = v === '高';
    if (k === 'quality') renderer.setPixelRatio(v === '低' ? 1 : v === '中' ? Math.min(devicePixelRatio, 1.5) : Math.min(devicePixelRatio, 2));
    if (k === 'cam' && VIEW_NAMES[v]) VIEWS[VIEW_NAMES[v]]();
  },
});
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.body.classList.contains('playing')) {
    document.body.classList.remove('playing');
    document.body.classList.add('lobby');
    menuMode = true;
    VIEWS.hero();
  }
});










