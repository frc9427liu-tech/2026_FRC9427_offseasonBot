import { NodeIO } from '@gltf-transform/core';
const io = new NodeIO();
for (const n of ['remy','p21','p22','p23']) {
  const d = await io.read(`web/public/crowd/${n}.glb`);
  let tris=0, verts=0; const mats=new Set();
  for (const m of d.getRoot().listMeshes()) for (const p of m.listPrimitives()) { tris += (p.getIndices()?.getCount() ?? 0)/3; verts += p.getAttribute('POSITION').getCount(); mats.add(p.getMaterial()?.getName()); }
  const skin = d.getRoot().listSkins()[0];
  console.log(n, 'tris', tris, 'verts', verts, 'prims', d.getRoot().listMeshes().flatMap(m=>m.listPrimitives()).length, 'joints', skin?.listJoints().length, 'nodes(meshes)', d.getRoot().listMeshes().length);
}
const a = await io.read('web/public/crowd/a_sit_clap.glb');
const an = a.getRoot().listAnimations()[0]; console.log('anim', an.getName(), an.listChannels().length, 'channels; first joint names', an.listChannels().slice(0,3).map(c=>c.getTargetNode()?.getName()));
