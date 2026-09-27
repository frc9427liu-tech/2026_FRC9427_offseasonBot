// Lobby / mode select / modal UI. Pure DOM, no framework.
import { bindings, setBinding, resetBindings, keyLabel, AXIS_CONTROLS } from './robot.js';
const $ = (id) => document.getElementById(id);

export const settings = {
  quality: '高', crowd: '自動', shadows: true, vsync: true, volume: '中', touch: '自動',
  cam: 'hero', hints: true, units: '英制',
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
    ['物理參數', [val('質量', '', '—'), val('尺寸', '', '—'), val('最大速度', '', '—')]],
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
    ['介面', [sw('提示文字', '顯示操作提示', 'hints'), opt('單位', '', ['英制', '公制'], 'units')]],
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
export function setControlsInfo(info, keymap = {}) {
  const page = MODALS.controls.pages[0];
  if (!info || !info.ok) {
    page[1] = [val('狀態', '', info && info.error ? info.error : '尚未分析')];
    return;
  }
  const keys = Object.keys(info.controls);
  const sorted = [...ORDER.filter((k) => keys.includes(k)), ...keys.filter((k) => !ORDER.includes(k))];
  const rows = sorted.map((k) => {
    const items = info.controls[k];
    const parts = items.map((it) => {
      if (it.kind === 'binding') return `${BIND_CN[it.how] || it.how}:${esc(it.action.replace(/^this\./, ''))}`;
      if (it.role) return esc(ROLE_CN[it.role] || it.role);
      return `讀取於 ${esc(it.in || it.at)}`;
    });
    return { k: `${CN[k] || k}`, hint: parts.join('<br>'), type: 'bind', control: k };
  });
  rows.push({ k: '恢復預設按鍵', hint: '', type: 'bind', control: '', reset: true });
  const ctrl = (info.controllers || []).map((c) => `${c.type} #${c.port}`).join(', ');
  page[1] = [val('控制器', `共掃描 ${info.filesScanned} 個原始檔`, ctrl || '未找到'), ...rows];
}

export function initUI({ onStart, onPreview, onSettingChange }) {
  // dock + cards
  $('dock').innerHTML = DOCK.map((d) => `<button class="dock-item" data-open="${d.id}"><span class="g">${d.g}</span>${d.label}</button>`).join('');
  $('cards').innerHTML = CARDS.map((c) => `<button class="ecard"><span class="glyph">${c.g}</span><span>${c.t}<small>${c.s}</small></span></button>`).join('');

  // mode select
  let group = 0, mode = 0;
  const renderModes = () => {
    $('rail').innerHTML = MODE_GROUPS.map((g, i) => `<button class="rail-item${i === group ? ' active' : ''}" data-g="${i}"><span class="g">${g.g}</span>${g.label}</button>`).join('');
    $('modelist').innerHTML = MODE_GROUPS[group].modes.map((m, i) =>
      `<button class="mcard${i === mode ? ' active' : ''}${m.on ? '' : ' locked'}" data-m="${i}"><b>${m.name}</b><small>${m.sub}</small></button>`).join('');
    $('prevtag').textContent = '2026 REBUILT · 651.2 × 317.7 in';
    const cur = MODE_GROUPS[group].modes[mode];
    $('modelabel').textContent = cur.name;
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
    $('mtitle').textContent = m.title;
    $('mlist').innerHTML = m.pages.map((p, i) => `<button class="ditem${i === mpage ? ' active' : ''}" data-p="${i}">${p[0]}</button>`).join('');
    $('mcontent').innerHTML = m.pages[mpage][1].map((r, ri) => {
      const hint = r.hint ? `<span class="hint">${r.hint}</span>` : '';
      let right = '';
      if (r.type === 'opts') right = `<div class="opts">${r.options.map((o) => `<button class="opt${settings[r.key] === o ? ' on' : ''}" data-r="${ri}" data-o="${o}"><span class="dot"></span>${o}</button>`).join('')}</div>`;
      else if (r.type === 'switch') right = `<button class="switch${settings[r.key] ? ' on' : ''}" data-r="${ri}" data-sw="1"></button>`;
      else if (r.type === 'bind') {
        if (r.reset) right = '<button class="bindbtn reset" data-reset="1">重設</button>';
        else {
          const codes = bindings[r.control] || [];
          const slots = AXIS_CONTROLS.includes(r.control) ? [['−', 0], ['+', 1]] : [['', 0]];
          right = `<span>${slots.map(([tag, s]) => `${tag ? `<small>${tag}</small>` : ''}<button class="bindbtn" data-bind="${r.control}" data-slot="${s}">${esc(keyLabel(codes[s]))}</button>`).join('')}</span>`;
        }
      } else right = `<span class="val">${r.v}</span>`;
      return `<div class="drow"><span class="k">${r.k}${hint}</span>${right}</div>`;
    }).join('');
  };
  $('mlist').onclick = (e) => { const b = e.target.closest('[data-p]'); if (b) { mpage = +b.dataset.p; renderModal(); } };
  $('mcontent').onclick = (e) => {
    const kb = e.target.closest('[data-bind]');
    if (kb) { // rebind: the next key pressed becomes this control's key (Esc cancels)
      kb.textContent = '按下按鍵…'; kb.classList.add('wait');
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
