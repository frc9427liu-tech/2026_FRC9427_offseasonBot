const ws = new WebSocket('ws://127.0.0.1:3300/wpilibws');
const seen = {}; let n = 0;
ws.onopen = () => console.log('open');
ws.onmessage = (e) => { n++; try { const m = JSON.parse(e.data); const k = m.type + ':' + (m.device || ''); if (!seen[k]) { seen[k] = 1; if (Object.keys(seen).length < 40) console.log(k, JSON.stringify(m.data).slice(0, 140)); } } catch (x) { console.log('raw', String(e.data).slice(0, 100)); } };
ws.onerror = (e) => console.log('err', e.message || e);
setTimeout(() => { console.log('msgs', n, 'kinds', Object.keys(seen).length); process.exit(0); }, 6000);
