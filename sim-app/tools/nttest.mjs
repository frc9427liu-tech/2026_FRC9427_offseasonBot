import { decodeMulti } from '@msgpack/msgpack';
const ws = new WebSocket('ws://127.0.0.1:5810/nt/bridge', 'v4.1.networktables.first.wpi.edu');
ws.binaryType = 'arraybuffer';
const topics = new Map(); const vals = {};
ws.onopen = () => {
  console.log('nt open');
  ws.send(JSON.stringify([{ method: 'subscribe', params: { topics: [''], subuid: 1, options: { prefix: true, periodic: 0.1 } } }]));
};
ws.onmessage = (e) => {
  if (typeof e.data === 'string') {
    for (const m of JSON.parse(e.data)) if (m.method === 'announce') topics.set(m.params.id, { name: m.params.name, type: m.params.type });
  } else {
    for (const arr of decodeMulti(new Uint8Array(e.data))) { const t = topics.get(arr[0]); if (t) vals[t.name] = arr[3]; }
  }
};
ws.onerror = (e) => console.log('err', e.message);
setTimeout(() => {
  const names = [...topics.values()].map((t) => t.name + ' ' + t.type);
  console.log('topics', names.length);
  console.log(names.filter((n) => /Pose|Field|hood|shoot|intake|flywheel/i.test(n)).slice(0, 30).join('\n'));
  for (const k of Object.keys(vals).filter((k) => /Pose|Field\/Robot/.test(k)).slice(0, 4)) console.log(k, JSON.stringify(vals[k]).slice(0, 120));
  process.exit(0);
}, 6000);
