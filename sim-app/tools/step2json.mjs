// Convert a STEP file to a compact JSON of meshes (name, color, positions, indices) using occt-import-js.
import fs from 'node:fs';
import occtimport from 'occt-import-js';

const [, , inFile, outFile] = process.argv;
const occt = await occtimport();
const buf = fs.readFileSync(inFile);
const res = occt.ReadStepFile(new Uint8Array(buf), {
  linearUnit: 'meter',
  linearDeflectionType: 'bounding_box_ratio',
  linearDeflection: 0.004,
  angularDeflection: 0.9,
});
console.log('success', res.success, 'meshes', res.meshes.length);
const out = res.meshes.map((m) => ({
  name: m.name,
  color: m.color || null,
  pos: Array.from(m.attributes.position.array, (v) => Math.round(v * 10000) / 10000),
  idx: Array.from(m.index.array),
}));
fs.writeFileSync(outFile, JSON.stringify(out));
const tris = out.reduce((a, m) => a + m.idx.length / 3, 0);
console.log('triangles', tris, 'bytes', fs.statSync(outFile).size);

