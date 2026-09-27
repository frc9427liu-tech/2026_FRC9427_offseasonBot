// Lobby / mode select / modal UI. Pure DOM, no framework.
import { bindings, setBinding, resetBindings, keyLabel, AXIS_CONTROLS } from './robot.js';
import { t, tf, LANGS, getLang, setLang } from './i18n.js';
const $ = (id) => document.getElementById(id);

export const settings = {
  quality: '高', crowd: '自動', shadows: true, vsync: true, volume: '中', touch: '自動',
  cam: 'hero', hints: true, units: '英制', lang: getLang(),
};

const DOCK = [
  { id: 'robot', g: '🤖', label: '機器人' },
  { id: 'field', g: '🏟', label: '場地' },
  { id: 'controls', g: '🎮', label: '操作' },
  { id: 'settings', g: '⚙', label: '設定' },
];

const CARDS = [
  { g: '📘', t: '新手教學', s: '5 分鐘學會操作' },
  { g: '🏆', t: '2026 REBUILT', s: 'Fuel / Hub / Tower 規則' },
  { g: '🌐', t: '線上房間', s: '即將開放' },
];

const MODE_GROUPS = [
  { id: 'match', g: '🏁', label: '比賽', modes: [
    { name: '正式比賽', sub: '3v3 · 2:40', on: true },
    { name: '資格賽', sub: '3v3 · 完整計分 · 2:40', on: true },
    { name: '單機器人', sub: '1v0 · 練習計分', on: true },
  ] },
  { id: 'practice', g: '🎯', label: '練習', modes: [
    { name: '自由練習', sub: '空場 · 無時限', on: true },
    { name: '投射訓練', sub: 'Hub 靶 · 統計命中率', on: true },
    { name: '爬升訓練', sub: 'Tower 三段', on: true },
  ] },
  { id: 'auto', g: '🛰', label: '自動', modes: [
    { name: '路徑測試', sub: 'PathPlanner / Choreo', on: true },
    { name: '自動賽 20s', sub: '完整自動階段', on: true },
  ] },
  { id: 'online', g: '🌐', label: '線上', modes: [
    { name: '快速配對', sub: '即將開放', on: false },
    { name: '房間 ID', sub: '即將開放', on: false },
  ] },
];

const opt = (k, hint, options, key) => ({ k, hint, type: 'opts', options, key });
const sw = (k, hint, key) => ({ k, hint, type: 'switch', key });
const val = (k, hint, v) => ({ k, hint, type: 'val', v });

const MODALS = {
  robot: { title: '機器人', pages: [
    ['外觀模型', [val('目前模型', '之後匯入 Onshape', '簡化方塊'), val('顏色', '', '聯盟色')]],
    ['程式與按鍵', [val('機器人程式', '目前使用', 'FRC9427 offseasonBot'), val('按鍵綁定', '自動從 RobotContainer 讀取', '尚未連線')]],
    ['機構描述', [val('狀態', '', '等待橋接程式')]],
  ] },
  field: { title: '場地', pages: [
    ['規則', [val('賽季', '', '2026 REBUILT'), val('計分', '官方（可自訂）', '官方')]],
    ['Fuel 球', [val('直徑', '', '5.91 in'), val('質量', '', '0.448–0.500 lb'), val('總數', '', '504')]],
    ['鏡頭', [opt('預設鏡頭', '', ['總覽', '俯視', '藍方', '紅方'], 'cam')]],
  ] },
  controls: { title: '操作', pages: [
    ['程式的操作', [val('狀態', '從機器人原始碼自動分析,程式一改就更新', '尚未連線橋接程式')]],
    ['鍵盤', [val('重新綁鍵', '在「程式的操作」頁點按鍵按鈕,再按新的鍵(Esc 取消)', '已存在瀏覽器')]],
    ['手把', [val('移動', '', '左搖桿'), val('旋轉', '', '右搖桿')]],
    ['觸控', [opt('螢幕操作', '版面依機器人程式用到的搖桿與按鈕自動產生', ['自動', '開', '關'], 'touch')]],
  ] },
  settings: { title: '設定', pages: [
    ['畫面', [opt('畫質', '影響效能', ['低', '中', '高'], 'quality'), opt('人群密度', '自動會依流暢度調整', ['自動', '低', '中', '高'], 'crowd'), sw('陰影', '', 'shadows'), sw('垂直同步', '', 'vsync')]],
    ['介面', [opt('語言', 'Language', LANGS, 'lang'), sw('提示文字', '顯示操作提示', 'hints'), opt('單位', '', ['英制', '公制'], 'units')]],
    ['音效', [opt('音量', '', ['靜音', '低', '中', '高'], 'volume')]],
    ['網路', [val('伺服器', '線上功能開放後設定', '未設定')]],
  ] },
};

const CN = {
  LeftX: '左搖桿 左右', LeftY: '左搖桿 前後', RightX: '右搖桿 左右', RightY: '右搖桿 前後', LT: '左板機', RT: '右板機',
  A: 'A 鍵', B: 'B 鍵', X: 'X 鍵', Y: 'Y 鍵', LB: '左肩鍵 LB', RB: '右肩鍵 RB', Start: 'Start', Back: 'Back',
  DPadUp: '十字鍵 上', DPadDown: '十字鍵 下', DPadLeft: '十字鍵 左', DPadRight: '十字鍵 右',
};
const ORDER = ['LeftY', 'LeftX', 'RightX', 'RightY', 'LT', 'RT', 'A', 'B', 'X', 'Y', 'LB', 'RB', 'Start', 'Back'];
const ROLE_CN = { 'translate forward/back': '前後移動', 'strafe left/right': '左右平移', rotate: '旋轉' };
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const BIND_CN = { onTrue: '按下時', whileTrue: '按住時', onFalse: '放開時', whileFalse: '未按時', toggleOnTrue: '按一下切換' };

// Rebuild the "controls read from the code" page from the bridge's source analysis.
let lastControls = null;   // kept so a language change can rebuild the page
export function setControlsInfo(info, keymap = {}) {
  lastControls = info;
  const page = MODALS.controls.pages[0];
  if (!info || !info.ok) {
    page[1] = [val('狀態', '', info && info.error ? info.error : t('尚未分析'))];
    return;
  }
  const keys = Object.keys(info.controls);
  const sorted = [...ORDER.filter((k) => keys.includes(k)), ...keys.filter((k) => !ORDER.includes(k))];
  const rows = sorted.map((k) => {
    const items = info.controls[k];
    const parts = items.map((it) => {
      if (it.kind === 'binding') return `${t(BIND_CN[it.how]) || it.how}: ${esc(it.action.replace(/^this\./, ''))}`;
      if (it.role) return esc(t(ROLE_CN[it.role]) || it.role);
      return tf.readIn(esc(it.in || it.at));
    });
    return { k: `${CN[k] || k}`, hint: parts.join('<br>'), type: 'bind', control: k };
  });
  rows.push({ k: '恢復預設按鍵', hint: '', type: 'bind', control: '', reset: true });
  const ctrl = (info.controllers || []).map((c) => `${c.type} #${c.port}`).join(', ');
  page[1] = [val('控制器', tf.scanned(info.filesScanned), ctrl || t('未找到')), ...rows];
}

// ---- ROBOT > 機構描述: the robot description the game-piece rules use (bridge/mechanisms.mjs), editable ----
// Each field is a number or a signal source; signal choices come from what the running code actually publishes
// (NT topics) and the motors the sim sees, so the list always matches the loaded robot program.
const descCtx = { desc: null, getState: () => null, save: () => {}, motors: [] };   // motors: [{name, label}] found in the code
const DESC_ROWS = [
  ['h', '車身'],
  ['num', 'size.length', '長度', 'm，含保險桿', 0.01],
  ['num', 'size.width', '寬度', 'm，含保險桿', 0.01],
  ['num', 'size.height', '高度', 'm，球從上面彈開的高度', 0.01],
  ['num', 'capacity', '最多存球', '顆', 1],
  ['h', '吸球'],
  ['src', 'intake.source', '吸球訊號', '超過門檻時吸球口開啟；數值同時當作吸球口伸出量'],
  ['num', 'intake.min', '門檻', '', 0.01],
  ['num', 'intake.width', '吸球口寬', 'm', 0.01],
  ['num', 'intake.reach', '吸球口伸出', 'm，保險桿前方', 0.01],
  ['num', 'intake.scale', '伸出倍率', '訊號每 1 單位多伸出幾 m', 0.01],
  ['h', '發射'],
  ['src', 'shooter.fire', '送球訊號', '超過門檻時一顆顆送進飛輪（建議選把球推進飛輪的馬達）'],
  ['num', 'shooter.fireMin', '門檻', '馬達為 rev/s', 0.5],
  ['src', 'shooter.speed', '飛輪轉速', 'rev/s'],
  ['src', 'shooter.hood', 'Hood 角度', '度'],
  ['num', 'shooter.elevationBase', '仰角基準', '出射仰角 = 基準 − hood 角度（度）', 0.5],
  ['num', 'shooter.wheelRadiusIn', '飛輪半徑', 'in', 0.1],
  ['num', 'shooter.efficiency', '球速效率', '球速 = 效率 × 輪緣速度', 0.01],
  ['num', 'shooter.rate', '射速', '顆/秒', 0.5],
  ['num', 'shooter.spreadDeg', '左右散布', '度', 0.1],
  ['num', 'shooter.x', '發射點 前後', 'm，車身中心往前為正', 0.01],
  ['num', 'shooter.y', '發射點 左右', 'm，往左為正', 0.01],
  ['num', 'shooter.z', '發射點 高度', 'm', 0.01],
  ['h', '視覺（Limelight 模擬，名稱從程式自動找）'],
  ['num', 'vision.x', '鏡頭位置 前後', 'm，車身中心往前為正', 0.01],
  ['num', 'vision.y', '鏡頭位置 左右', 'm，往左為正', 0.01],
  ['num', 'vision.z', '鏡頭高度', 'm', 0.01],
  ['num', 'vision.yawDeg', '鏡頭朝向', '度，0 = 朝車頭，180 = 朝車尾', 1],
  ['num', 'vision.hfovDeg', '水平視角', '度（LL3 約 62.5）', 0.5],
  ['num', 'vision.maxDist', '最遠辨識距離', 'm', 0.1],
];
const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const setPath = (o, p, v) => { const ks = p.split('.'); const last = ks.pop(); ks.reduce((a, k) => (a[k] ||= {}), o)[last] = v; };
const srcLabel = (s) => {
  if (!s) return t('（未設定）');
  if (s.startsWith('motor:')) { const m = descCtx.motors.find((x) => x.name === s.slice(6)); return tf.motor(m ? m.label : s.slice(6)); }
  return `NT ${s.slice(3).split('/').pop()}`;
};
function liveText(src) {
  const st = descCtx.getState();
  if (!src || !st) return '';
  let v = null;
  if (src.startsWith('nt:')) { v = (st.values || {})[src.slice(3)]; if (typeof v === 'boolean') v = v ? 1 : 0; }
  else if (src.startsWith('motor:')) { const r = (st.rotors || {})[src.slice(6)]; v = r ? Math.abs(r.vel) : null; }
  return typeof v === 'number' ? tf.current(v.toFixed(2)) : t('目前沒有數值');
}
function sourceOptions(cur) {
  const st = descCtx.getState() || {};
  const nt = Object.entries(st.values || {}).filter(([, v]) => typeof v === 'number' || typeof v === 'boolean').map(([k]) => `nt:${k}`).sort();
  const motors = [...new Set([...descCtx.motors.map((m) => m.name), ...Object.keys(st.rotors || {})])].map((k) => `motor:${k}`).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const all = ['', ...motors, ...nt];
  if (cur && !all.includes(cur)) all.push(cur);   // keep a saved choice visible even while the code isn't running
  return all.map((s) => `<option value="${esc(s)}"${s === cur ? ' selected' : ''} title="${esc(s)}">${esc(srcLabel(s))}</option>`).join('');
}
export function setRobotDesc(desc, { getState, save, motors } = {}) {
  descCtx.desc = desc;
  if (motors) descCtx.motors = motors;
  if (getState) descCtx.getState = getState;
  if (save) descCtx.save = save;
  const page = MODALS.robot.pages.find((p) => p[0] === '機構描述');
  if (!desc) { page[1] = [val('狀態', '', '等待橋接程式')]; return; }
  page[1] = [val('說明', '吸球、發射、碰撞都照這裡算；訊號從機器人程式實際送出的數值挑。改了立刻存檔（sim-app/mechanisms/）', ''),
    ...DESC_ROWS.map(([type, path, k, hint, step]) => (type === 'h' ? { type: 'head', k: path } : { type, path, k, hint: hint || '', step }))];
}

export function initUI({ onStart, onPreview, onSettingChange }) {
  // dock + cards
  const renderLobby = () => {
  $('dock').innerHTML = DOCK.map((d) => `<button class="dock-item" data-open="${d.id}"><span class="g">${d.g}</span>${t(d.label)}</button>`).join('');
  $('cards').innerHTML = CARDS.map((c) => `<button class="ecard"><span class="glyph">${c.g}</span><span>${t(c.t)}<small>${t(c.s)}</small></span></button>`).join('');
  document.querySelector('#modes h2').textContent = t('模式選擇');
  document.querySelectorAll('[data-open="settings"][title]').forEach((b) => { b.title = t('設定'); });
  };
  renderLobby();

  // mode select
  let group = 0, mode = 0;
  const renderModes = () => {
    $('rail').innerHTML = MODE_GROUPS.map((g, i) => `<button class="rail-item${i === group ? ' active' : ''}" data-g="${i}"><span class="g">${g.g}</span>${t(g.label)}</button>`).join('');
    $('modelist').innerHTML = MODE_GROUPS[group].modes.map((m, i) =>
      `<button class="mcard${i === mode ? ' active' : ''}${m.on ? '' : ' locked'}" data-m="${i}"><b>${t(m.name)}</b><small>${t(m.sub)}</small></button>`).join('');
    $('prevtag').textContent = '2026 REBUILT · 651.2 × 317.7 in';
    const cur = MODE_GROUPS[group].modes[mode];
    $('modelabel').textContent = t(cur.name);
    $('startsub').textContent = cur.on ? 'READY' : 'SOON';
  };
  $('rail').onclick = (e) => { const b = e.target.closest('[data-g]'); if (b) { group = +b.dataset.g; mode = 0; renderModes(); } };
  $('modelist').onclick = (e) => { const b = e.target.closest('[data-m]'); if (b) { mode = +b.dataset.m; renderModes(); } };
  $('modebtn').onclick = () => { $('modes').hidden = false; onPreview(true); };
  document.querySelector('[data-back]').onclick = () => { $('modes').hidden = true; onPreview(false); };
  renderModes();

  // modal
  let mkey = 'settings', mpage = 0;
  const renderModal = () => {
    const m = MODALS[mkey];
    $('mtitle').textContent = t(m.title);
    $('mlist').innerHTML = m.pages.map((p, i) => `<button class="ditem${i === mpage ? ' active' : ''}" data-p="${i}">${t(p[0])}</button>`).join('');
    $('mcontent').innerHTML = m.pages[mpage][1].map((r, ri) => {
      const hint = r.hint ? `<span class="hint">${t(r.hint)}</span>` : '';
      let right = '';
      if (r.type === 'opts') right = `<div class="opts">${r.options.map((o) => `<button class="opt${settings[r.key] === o ? ' on' : ''}" data-r="${ri}" data-o="${o}"><span class="dot"></span>${t(o)}</button>`).join('')}</div>`;
      else if (r.type === 'switch') right = `<button class="switch${settings[r.key] ? ' on' : ''}" data-r="${ri}" data-sw="1"></button>`;
      else if (r.type === 'bind') {
        if (r.reset) right = `<button class="bindbtn reset" data-reset="1">${t('重設')}</button>`;
        else {
          const codes = bindings[r.control] || [];
          const slots = AXIS_CONTROLS.includes(r.control) ? [['−', 0], ['+', 1]] : [['', 0]];
          right = `<span>${slots.map(([tag, s]) => `${tag ? `<small>${tag}</small>` : ''}<button class="bindbtn" data-bind="${r.control}" data-slot="${s}">${esc(keyLabel(codes[s]))}</button>`).join('')}</span>`;
        }
      } else if (r.type === 'head') return `<div class="dhead">${t(r.k)}</div>`;
      else if (r.type === 'num') right = `<input class="numin" type="number" step="${r.step}" data-path="${r.path}" value="${getPath(descCtx.desc, r.path) ?? ''}">`;
      else if (r.type === 'src') {
        const cur = getPath(descCtx.desc, r.path) || '';
        right = `<span class="srcwrap"><select class="srcsel" data-path="${r.path}">${sourceOptions(cur)}</select><small data-live="${r.path}">${liveText(cur)}</small></span>`;
      } else right = `<span class="val">${t(r.v)}</span>`;
      return `<div class="drow"><span class="k">${t(r.k)}${hint}</span>${right}</div>`;
    }).join('');
  };
  // description edits: save on every change (bridge writes the project's JSON and echoes it back)
  $('mcontent').addEventListener('change', (e) => {
    const el = e.target.closest('[data-path]');
    if (!el || !descCtx.desc) return;
    const v = el.tagName === 'SELECT' ? el.value : parseFloat(el.value);
    if (el.tagName !== 'SELECT' && !Number.isFinite(v)) return;
    const d = JSON.parse(JSON.stringify(descCtx.desc));
    setPath(d, el.dataset.path, v);
    descCtx.desc = d;
    descCtx.save(d);
    if (el.tagName === 'SELECT') { const live = el.parentElement.querySelector('[data-live]'); if (live) live.textContent = liveText(v); }
  });
  // live signal values next to each source, without re-rendering (so a field being typed in keeps focus)
  setInterval(() => {
    if ($('modal').hidden) return;
    document.querySelectorAll('#mcontent [data-live]').forEach((s) => { s.textContent = liveText(getPath(descCtx.desc, s.dataset.live)); });
  }, 400);
  $('mlist').onclick = (e) => { const b = e.target.closest('[data-p]'); if (b) { mpage = +b.dataset.p; renderModal(); } };
  $('mcontent').onclick = (e) => {
    const kb = e.target.closest('[data-bind]');
    if (kb) { // rebind: the next key pressed becomes this control's key (Esc cancels)
      kb.textContent = t('按下按鍵…'); kb.classList.add('wait');
      const h = (ev) => {
        ev.preventDefault(); ev.stopImmediatePropagation();
        removeEventListener('keydown', h, true);
        if (ev.code !== 'Escape') setBinding(kb.dataset.bind, +kb.dataset.slot, ev.code);
        renderModal();
      };
      addEventListener('keydown', h, true);
      return;
    }
    if (e.target.closest('[data-reset]')) { resetBindings(); renderModal(); return; }
    const b = e.target.closest('[data-r]'); if (!b) return;
    const r = MODALS[mkey].pages[mpage][1][+b.dataset.r];
    if (b.dataset.sw) settings[r.key] = !settings[r.key];
    else settings[r.key] = b.dataset.o;
    if (r.key === 'lang') { // everything visible re-renders in the new language
      setLang(settings.lang);
      renderLobby(); renderModes();
      if (lastControls) setControlsInfo(lastControls);
    }
    onSettingChange(r.key, settings[r.key]);
    renderModal();
  };
  const open = (k) => { mkey = k; mpage = 0; renderModal(); $('modal').hidden = false; };
  const close = () => { $('modal').hidden = true; };
  document.addEventListener('click', (e) => {
    const o = e.target.closest('[data-open]'); if (o) open(o.dataset.open);
    if (e.target.closest('[data-close]') || e.target === $('modal')) close();
  });

  $('start').onclick = () => {
    const cur = MODE_GROUPS[group].modes[mode];
    if (cur.on) onStart(cur);
  };
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('modal').hidden) close();
    else if (!$('modes').hidden) { $('modes').hidden = true; onPreview(false); }
  });
  return { refresh: () => { if (!$('modal').hidden) renderModal(); } };
}
