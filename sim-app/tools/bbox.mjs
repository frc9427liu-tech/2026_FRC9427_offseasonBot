import fs from 'node:fs';
for (const n of ['TE-26000','TE-26100','TE-26200','TE-26300','TE-26500','TE-26600']) {
  const m = JSON.parse(fs.readFileSync(`assets-src/${n}.json`));
  const b=[1e9,1e9,1e9,-1e9,-1e9,-1e9];
  for (const x of m) for (let i=0;i<x.pos.length;i+=3) for(let k=0;k<3;k++){b[k]=Math.min(b[k],x.pos[i+k]);b[k+3]=Math.max(b[k+3],x.pos[i+k]);}
  console.log(n, 'min', b.slice(0,3).map(v=>(v/0.0254).toFixed(1)).join(','), 'max', b.slice(3).map(v=>(v/0.0254).toFixed(1)).join(','), '(inches)');
}
