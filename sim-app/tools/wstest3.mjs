const ws = new WebSocket('ws://127.0.0.1:3300/wpilibws');
const dev = {}; 
ws.onmessage = (e) => { try { const m = JSON.parse(e.data); const k = m.type + ':' + (m.device || ''); (dev[k] ||= {}); Object.assign(dev[k], m.data); } catch (x) {} };
setTimeout(() => {
  for (const k of Object.keys(dev).filter(k => /^CANMotor/.test(k)).slice(0, 4)) console.log(k, JSON.stringify(dev[k]).slice(0, 400));
  for (const k of Object.keys(dev).filter(k => /Talon FX \(v6\)\[9\]/.test(k))) console.log(k, JSON.stringify(dev[k]).slice(0, 300));
  console.log('motors', Object.keys(dev).filter(k => /^CANMotor/.test(k)).length);
  process.exit(0);
}, 5000);
