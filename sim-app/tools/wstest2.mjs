const ws = new WebSocket('ws://127.0.0.1:3300/wpilibws');
const dev = {}; 
ws.onmessage = (e) => { try { const m = JSON.parse(e.data); const k = m.type + ':' + (m.device || ''); (dev[k] ||= {}); Object.assign(dev[k], m.data); } catch (x) {} };
setTimeout(() => {
  const pick = Object.keys(dev).filter(k => /\[9\]|\[15\]|Pigeon|CANcoder \(v6\)\[1\]|^(DriverStation|Robot|RoboRIO|SimDevice)/i.test(k) || /^(DriverStation|Joystick)/.test(k));
  for (const k of pick.slice(0, 40)) console.log(k, JSON.stringify(dev[k]).slice(0, 220));
  console.log('types', [...new Set(Object.keys(dev).map(k => k.split(':')[0]))].join(' '));
  process.exit(0);
}, 5000);
