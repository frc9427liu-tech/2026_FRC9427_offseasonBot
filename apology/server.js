const http = require('http'), fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 3000;
const DATA = path.join(__dirname, 'data', 'content.json');
const PUB = path.join(__dirname, 'public');
const read = () => JSON.parse(fs.readFileSync(DATA, 'utf8').replace(/^﻿/, ''));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript' };
const send = (res, code, body, type = 'application/json; charset=utf-8') => { res.writeHead(code, { 'Content-Type': type }); res.end(body); };

http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/api/content' && req.method === 'GET') {
    const { password, ...pub } = read();
    return send(res, 200, JSON.stringify(pub));
  }
  if (url === '/api/admin/load' && req.method === 'POST') {
    let b = ''; req.on('data', d => b += d); req.on('end', () => {
      try { const { pw } = JSON.parse(b); const c = read();
        if (pw !== c.password) return send(res, 401, '{"error":"密碼錯誤"}');
        send(res, 200, JSON.stringify(c));
      } catch { send(res, 400, '{"error":"bad"}'); }
    }); return;
  }
  if (url === '/api/admin/save' && req.method === 'POST') {
    let b = ''; req.on('data', d => b += d); req.on('end', () => {
      try { const { pw, content } = JSON.parse(b); const c = read();
        if (pw !== c.password) return send(res, 401, '{"error":"密碼錯誤"}');
        const n = { ...c, ...content };
        fs.writeFileSync(DATA, JSON.stringify(n, null, 2));
        send(res, 200, '{"ok":true}');
      } catch { send(res, 400, '{"error":"bad"}'); }
    }); return;
  }
  const f = url === '/' ? '/index.html' : url === '/admin' ? '/admin.html' : url;
  const p = path.join(PUB, path.normalize(f));
  if (!p.startsWith(PUB) || !fs.existsSync(p)) return send(res, 404, 'Not found', 'text/plain');
  send(res, 200, fs.readFileSync(p), types[path.extname(p)] || 'application/octet-stream');
}).listen(PORT, () => console.log(`道歉網頁 http://localhost:${PORT}  後台 http://localhost:${PORT}/admin`));
