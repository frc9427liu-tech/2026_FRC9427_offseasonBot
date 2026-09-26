import { NodeIO } from '@gltf-transform/core';
const io = new NodeIO();
for (const n of ['remy','p21','p22','p23','a_sit_idle']) {
  const d = await io.read(`web/public/crowd/${n}.glb`);
  const nodes = d.getRoot().listNodes();
  const hips = nodes.filter(x=>/hips/i.test(x.getName()));
  const root = d.getRoot().listScenes()[0].listChildren().map(c=>c.getName()+' s='+c.getScale().map(v=>+v.toFixed(3)).join(','));
  console.log(n, 'hips:', hips.map(h=>h.getName()+' t='+h.getTranslation().map(v=>+v.toFixed(2)).join(',')), 'root:', root.join(' | '));
}
