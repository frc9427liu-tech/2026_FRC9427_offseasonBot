import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildField, FIELD_L, FIELD_W } from './field.js';
import { initUI } from './ui.js';
import { buildFuel } from './fuel.js';
import { buildTags } from './tags.js';

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
scene.fog = new THREE.Fog(0x070d1a, 18, 46);

const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 120);
const center = new THREE.Vector3(FIELD_L / 2 * IN, 0.4, -FIELD_W / 2 * IN);
const controls = new OrbitControls(camera, canvas);
controls.target.copy(center);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 2;
controls.maxDistance = 30;

scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x1a2233, 0.9));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(center.x + 6, 14, center.z + 5);
sun.target.position.copy(center);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
const sc = sun.shadow.camera;
sc.left = -10; sc.right = 10; sc.top = 6; sc.bottom = -6; sc.near = 1; sc.far = 40;
sun.shadow.bias = -0.0004;
scene.add(sun, sun.target);

// Venue floor beyond the field
const venue = new THREE.Mesh(new THREE.PlaneGeometry(200, 200),
  new THREE.MeshStandardMaterial({ color: 0x0c1424, roughness: 0.95 }));
venue.rotation.x = -Math.PI / 2;
venue.position.y = -0.01;
venue.receiveShadow = true;
scene.add(venue);

buildField().then((f) => scene.add(f));
scene.add(buildFuel());
scene.add(buildTags());

// Camera presets
const VIEWS = {
  hero: () => setView([center.x - 7.5, 5.2, center.z + 8.5], center),
  hubBlue: () => setView([181.56 * IN + 2.6, 1.9, -158.3 * IN + 0.6], new THREE.Vector3(181.56 * IN, 1.1, -158.3 * IN)),
  top: () => setView([center.x, 19, center.z + 0.01], center),
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

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
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
  renderer.render(scene, camera);
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


