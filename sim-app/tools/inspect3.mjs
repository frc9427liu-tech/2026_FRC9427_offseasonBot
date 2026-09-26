import { NodeIO } from '@gltf-transform/core';
const io = new NodeIO();
for (const n of ['remy','p21','p22','p23']) {
  const d = await io.read(`web/public/crowd/${n}.glb`);
  console.log(n, d.getRoot().listMaterials().map(m => m.getName()+'['+m.getBaseColorFactor().map(v=>+v.toFixed(2)).join(',')+(m.getBaseColorTexture()?' tex':'')+']').join(', '));
}
