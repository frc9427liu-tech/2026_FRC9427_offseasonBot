const ws = new WebSocket('ws://127.0.0.1:8765');
let last = null; const logs = [];
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.t === 'state') last = m; else if (m.t === 'log') logs.push(m.line); else if (m.t === 'hello') logs.push(...m.log); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
ws.onopen = async () => {
  await sleep(1500);
  ws.send(JSON.stringify({ t: 'ds', enabled: true, autonomous: false }));
  const axes = [0, -0.6, 0, 0, 0, 0];
  const iv = setInterval(() => ws.send(JSON.stringify({ t: 'joy', index: 0, axes, buttons: new Array(12).fill(false), povs: [-1] })), 20);
  await sleep(2500);
  console.log('ds', JSON.stringify(last.ds));
  const v = Object.entries(last.values).filter(([k]) => /Pose|hood|shoot|arm|Robot|Speed|Chassis|Drive/i.test(k)).slice(0, 12); console.log(JSON.stringify(v));
  console.log(logs.slice(-12).join('\n'));
  clearInterval(iv); process.exit(0);
};
