// Shrink character glb: resize textures to 1024 and re-encode as webp, drop unused data.
import { NodeIO } from '@gltf-transform/core';
import { textureCompress, prune, dedup, weld, simplify } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'node:fs';

const [, , inFile, outFile] = process.argv;
const io = new NodeIO();
const doc = await io.read(inFile);
await MeshoptSimplifier.ready;
const ratio = Number(process.argv[4] || 1);
await doc.transform(
  dedup(),
  weld(),
  ...(ratio < 1 ? [simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.02 })] : []),
  prune(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 82 }),
);
await io.write(outFile, doc);
console.log(outFile, (fs.statSync(outFile).size / 1048576).toFixed(2), 'MB');

