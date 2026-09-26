import fs from 'node:fs';
for (const n of ['TE-26000','TE-26100','TE-26200','TE-26300','TE-26500','TE-26600']) {
  const m = JSON.parse(fs.readFileSync(`assets-src/${n}.json`));
  const c = {};
  for (const x of m) { const k = x.color ? x.color.map(v=>v.toFixed(2)).join(',') : 'none'; c[k]=(c[k]||0)+x.idx.length/3; }
  console.log(n, JSON.stringify(Object.entries(c).sort((a,b)=>b[1]-a[1]).slice(0,6)));
}
