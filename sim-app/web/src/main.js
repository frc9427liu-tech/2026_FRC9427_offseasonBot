import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildField, FIELD_L, FIELD_W } from './field.js';

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

// Camera presets
const VIEWS = {
  hero: () => setView([center.x - 7.5, 5.2, center.z + 8.5], center),
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

// ---------- Menu ----------
const MENU = [
  { id: 'play', label: 'PLAY', sub: '比賽', tabs: [
    ['match', '正式比賽', [['模式', '3v3 · 完整規則'], ['場次', '2:40（自動 20s + 遙控 2:20）'], ['對手', '玩家 / AI（即將推出）']]],
    ['practice', '自由練習', [['場地', '空場、無時間限制'], ['球數', '依規則 / 自訂']]],
    ['auto', '自動路徑測試', [['路徑', 'PathPlanner / Choreo'], ['來源', '從機器人專案讀取']]],
    ['online', '線上房間', [['狀態', '尚未開放（先做場地）']]],
  ] },
  { id: 'robot', label: 'ROBOT', sub: '機器人', tabs: [
    ['model', '外觀模型', [['目前', '簡化方塊'], ['Onshape', '之後匯入']]],
    ['code', '程式與按鍵', [['程式', 'FRC9427 offseasonBot'], ['按鍵綁定', '從 RobotContainer 自動讀取']]],
    ['params', '物理參數', [['質量 / 尺寸 / 速度', '依機器人程式設定']]],
  ] },
  { id: 'field', label: 'FIELD', sub: '場地', tabs: [
    ['rules', '規則', [['賽季', '2026 REBUILT'], ['計分', '官方（可自訂）']]],
    ['fuel', 'Fuel 球', [['直徑', '5.91 in'], ['質量', '0.448–0.500 lb'], ['總數', '504（456 + 48）']]],
    ['view', '鏡頭與畫質', [['視角', 'hero / top / blue / red'], ['陰影', '高']]],
  ] },
  { id: 'controls', label: 'CONTROLS', sub: '操作', tabs: [
    ['kb', '鍵盤', [['移動', 'W A S D'], ['旋轉', 'Q / E']]],
    ['pad', '手把', [['移動', '左搖桿'], ['旋轉', '右搖桿']]],
    ['touch', '觸控', [['移動', '左側虛擬搖桿'], ['旋轉', '右側虛擬搖桿']]],
  ] },
  { id: 'settings', label: 'SETTINGS', sub: '設定', tabs: [
    ['gfx', '畫面', [['解析度縮放', '自動'], ['垂直同步', '開']]],
    ['audio', '音效', [['音量', '80%']]],
    ['net', '網路', [['伺服器', '未設定']]],
  ] },
];

const menuEl = document.getElementById('menu');
const pageEl = document.getElementById('page');
let cur = 'play', curTab = 0;

function renderMenu() {
  menuEl.innerHTML = '';
  for (const m of MENU) {
    const b = document.createElement('button');
    b.className = 'menu-item' + (m.id === cur ? ' active' : '');
    b.innerHTML = `${m.label}<small>${m.sub}</small>`;
    b.onclick = () => { cur = m.id; curTab = 0; renderMenu(); renderPage(); };
    menuEl.appendChild(b);
  }
}
function renderPage() {
  const m = MENU.find((x) => x.id === cur);
  const tabs = m.tabs.map((t, i) => `<button class="tab${i === curTab ? ' active' : ''}" data-i="${i}">${t[1]}</button>`).join('');
  const rows = m.tabs[curTab][2].map(([k, v]) => `<div class="row"><span class="k">${k}</span><span>${v}</span></div>`).join('');
  pageEl.innerHTML = `<div class="sub-tabs">${tabs}</div><div class="card">${rows}</div>`;
  pageEl.querySelectorAll('.tab').forEach((el) => (el.onclick = () => { curTab = +el.dataset.i; renderPage(); }));
}
renderMenu();
renderPage();

document.getElementById('start').onclick = () => {
  document.body.classList.add('playing');
  menuMode = false;
  VIEWS.top();
};
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { document.body.classList.remove('playing'); menuMode = true; VIEWS.hero(); }
});
