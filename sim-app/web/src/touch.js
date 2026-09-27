// On-screen controls generated from what the robot code actually uses (bridge/analyze.mjs output):
// a stick for every stick the code reads, and a labelled button for every button/trigger/D-pad it binds.
// Nothing here is hard-coded to one robot: a project that only uses the left stick and two buttons gets exactly that.

const BUTTON_INDEX = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, Back: 6, Start: 7 };
const AXIS_INDEX = { LeftX: 0, LeftY: 1, LT: 2, RT: 3, RightX: 4, RightY: 5 };
const POV = { DPadUp: 0, DPadRight: 90, DPadDown: 180, DPadLeft: 270 };
const BTN_ORDER = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'DPadUp', 'DPadDown', 'DPadLeft', 'DPadRight', 'Start', 'Back'];

// Short readable label for a button from the first thing it triggers, e.g. "this.shooter.shoot" -> "shoot".
function labelFor(control, items) {
  const b = (items || []).find((it) => it.kind === 'binding' && it.action);
  if (!b) return control;
  const name = b.action.replace(/^this\./, '').replace(/\(.*$/, '').split('.').filter(Boolean).pop() || control;
  return name.length > 9 ? name.slice(0, 8) + '…' : name;
}

export function createTouchUI(link) {
  const root = document.createElement('div');
  root.id = 'touchui';
  root.hidden = true;
  document.body.appendChild(root);
  let mode = '自動';

  const isTouch = () => matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  const apply = () => {
    const on = mode === '開' || (mode === '自動' && isTouch());
    root.hidden = !on;
    link.touch.active = on;
    if (!on) reset();
  };
  function reset() {
    link.touch.axes.fill(0); link.touch.buttons.fill(false); link.touch.povs = -1;
  }

  function stick(cls, xName, yName) {
    const el = document.createElement('div');
    el.className = `tstick ${cls}`;
    el.innerHTML = '<div class="tknob"></div>';
    const knob = el.firstChild;
    let id = null, cx = 0, cy = 0;
    const R = 56;
    const set = (dx, dy) => {
      const len = Math.hypot(dx, dy) || 1, k = Math.min(1, len / R);
      const nx = (dx / len) * k, ny = (dy / len) * k;
      knob.style.transform = `translate(${nx * R}px, ${ny * R}px)`;
      if (xName) link.touch.axes[AXIS_INDEX[xName]] = len ? nx : 0;
      if (yName) link.touch.axes[AXIS_INDEX[yName]] = len ? ny : 0;   // screen-down = +Y, same as a real pad
    };
    el.addEventListener('pointerdown', (e) => {
      id = e.pointerId; el.setPointerCapture(id);
      const r = el.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      set(e.clientX - cx, e.clientY - cy); e.preventDefault();
    });
    el.addEventListener('pointermove', (e) => { if (e.pointerId === id) set(e.clientX - cx, e.clientY - cy); });
    const end = (e) => { if (e.pointerId !== id) return; id = null; knob.style.transform = ''; if (xName) link.touch.axes[AXIS_INDEX[xName]] = 0; if (yName) link.touch.axes[AXIS_INDEX[yName]] = 0; };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    return el;
  }

  function button(control, label) {
    const el = document.createElement('button');
    el.className = 'tbtn';
    el.textContent = label;
    el.title = control;
    const press = (v) => {
      el.classList.toggle('down', v);
      if (control in BUTTON_INDEX) link.touch.buttons[BUTTON_INDEX[control]] = v;
      else if (control in AXIS_INDEX) link.touch.axes[AXIS_INDEX[control]] = v ? 1 : 0;
      else if (control in POV) link.touch.povs = v ? POV[control] : -1;
    };
    el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); press(true); e.preventDefault(); });
    const up = () => press(false);
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    return el;
  }

  // (re)build from the analysis: called whenever the bridge re-reads the robot source
  function build(info) {
    root.innerHTML = '';
    reset();
    if (!info || !info.ok) return;
    const used = info.controls || {};
    const has = (...n) => n.some((k) => k in used);
    if (has('LeftX', 'LeftY')) root.appendChild(stick('left', 'LeftX', 'LeftY'));
    if (has('RightX', 'RightY')) root.appendChild(stick('right', 'RightX', 'RightY'));
    const pad = document.createElement('div');
    pad.className = 'tbtns';
    for (const c of BTN_ORDER) if (c in used) pad.appendChild(button(c, labelFor(c, used[c])));
    if (pad.children.length) root.appendChild(pad);
  }

  return { build, setMode(m) { mode = m; apply(); }, apply };
}
