const ws = new WebSocket('ws://127.0.0.1:8765');
let last = null, logs = 0;
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.t === 'state') last = m; else if (m.t === 'log') logs++; else if (m.t==='startResult') console.log('start', JSON.stringify(m)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
ws.onopen = async () => {
  for (let i = 0; i < 70; i++) { await sleep(2000); if (last && last.hal && last.nt && last.pose) break; }
  console.log('connected', last && last.hal, last && last.nt, 'pose', last && last.pose, 'logs', logs);
  ws.send(JSON.stringify({ t: 'ds', enabled: true, autonomous: false }));
  const axes = [0, -0.6, 0, 0, 0, 0]; // left stick forward
  const iv = setInterval(() => ws.send(JSON.stringify({ t: 'joy', index: 0, axes, buttons: new Array(12).fill(false), povs: [-1] })), 20);
  await sleep(3000);
  console.log('after drive 3s pose', JSON.stringify(last.pose), 'motors', Object.keys(last.motors).length);
  const m = Object.entries(last.motors).slice(0, 4).map(([k, v]) => k + '=' + v.volts.toFixed(2)); console.log(m.join(' '));
  clearInterval(iv); ws.send(JSON.stringify({ t: 'ds', enabled: false }));
  process.exit(0);
};
setTimeout(() => { console.log('timeout'); process.exit(1); }, 170000);
