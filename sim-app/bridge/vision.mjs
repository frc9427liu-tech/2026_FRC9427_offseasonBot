// Limelight simulation: what each Limelight the robot code uses would publish to NetworkTables, from the
// simulated robot pose and the real AprilTag layout. The code localizes itself exactly as on the field
// (LimelightHelpers reads these topics and feeds addVisionMeasurement); nothing in the robot project changes.
//   /<name>/botpose_orb_wpiblue  MegaTag2: [x, y, z, roll, pitch, yaw, latency ms, tagCount, tagSpan, avgDist,
//                                 avgArea, then per tag: id, txnc, tync, ta, distToCamera, distToRobot, ambiguity]
//   /<name>/botpose_wpiblue      MegaTag1, same layout
//   /<name>/tv, /<name>/tid      target valid / primary tag id
import fs from 'node:fs';
import path from 'node:path';
import { TAGS } from '../web/src/tagdata.js';

const IN = 0.0254;
const TAG_POSES = TAGS.map(([id, x, y, z, rot]) => ({ id, x: x * IN, y: y * IN, z: z * IN, nx: Math.cos((rot * Math.PI) / 180), ny: Math.sin((rot * Math.PI) / 180) }));

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (p.endsWith('.java')) out.push(p);
  }
  return out;
}

// Limelight table names the code talks to: string literals starting with "limelight" (the LimelightHelpers
// default name is "limelight"; teams rename theirs, e.g. "limelight-up").
export function findLimelights(projectDir) {
  const src = path.join(projectDir, 'src', 'main', 'java');
  if (!fs.existsSync(src)) return [];
  const names = new Set();
  for (const f of walk(src)) {
    if (/LimelightHelpers\.java$/.test(f)) continue;   // the helper's own docs/defaults, not a camera in use
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/"(limelight[\w-]*)"/g)) names.add(m[1]);
  }
  return [...names];
}

// cam: robot-frame mount {x, y, z, yawDeg} and optics {hfovDeg, vfovDeg, maxDist}
export function visibleTags(pose, cam) {
  const c = Math.cos(pose.theta), s = Math.sin(pose.theta);
  const cx = pose.x + cam.x * c - cam.y * s, cy = pose.y + cam.x * s + cam.y * c, cz = cam.z;
  const heading = pose.theta + (cam.yawDeg * Math.PI) / 180;
  const out = [];
  for (const t of TAG_POSES) {
    const dx = t.x - cx, dy = t.y - cy, dz = t.z - cz;
    const flat = Math.hypot(dx, dy), dist = Math.hypot(flat, dz);
    if (dist > cam.maxDist || dist < 0.3) continue;
    let tx = Math.atan2(dy, dx) - heading; tx = Math.atan2(Math.sin(tx), Math.cos(tx));
    const ty = Math.atan2(dz, flat);
    if (Math.abs(tx) > ((cam.hfovDeg / 2) * Math.PI) / 180 || Math.abs(ty) > ((cam.vfovDeg / 2) * Math.PI) / 180) continue;
    // the tag's printed face has to point back at the camera (a tag seen almost edge-on isn't detected)
    const facing = -(t.nx * dx + t.ny * dy) / flat;
    if (facing < 0.26) continue;   // > ~75 deg off-axis
    const area = Math.min(100, (0.2064 * 0.2064 * facing) / (dist * dist * 0.35) * 100);   // % of image, rough
    out.push({ id: t.id, tx: (-tx * 180) / Math.PI, ty: (ty * 180) / Math.PI, ta: area, dist, x: t.x, y: t.y });
  }
  return out;
}

// NT values for one camera this frame. robotYawDeg: the orientation the code itself sent (MegaTag2 uses it).
export function limelightFrame(name, pose, cam, robotYawDeg) {
  const tags = visibleTags(pose, cam);
  const n = tags.length;
  const latency = 25 + Math.random() * 10;
  // MegaTag pose error grows with distance and shrinks with more tags
  const avgDist = n ? tags.reduce((a, t) => a + t.dist, 0) / n : 0;
  const sigma = n ? (0.01 + 0.01 * avgDist * avgDist) / Math.sqrt(n) : 0;
  const g = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2 * sigma;
  let span = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) span = Math.max(span, Math.hypot(tags[i].x - tags[j].x, tags[i].y - tags[j].y));
  const avgArea = n ? tags.reduce((a, t) => a + t.ta, 0) / n : 0;
  const fid = tags.flatMap((t) => [t.id, t.tx, t.ty, t.ta, t.dist, t.dist, n > 1 ? 0.05 : 0.2]);
  const x = n ? pose.x + g() : 0, y = n ? pose.y + g() : 0;
  const trueYaw = (pose.theta * 180) / Math.PI;
  const mt2 = [x, y, 0, 0, 0, n ? robotYawDeg : 0, latency, n, span, avgDist, avgArea, ...fid];
  const mt1 = [x, y, 0, 0, 0, n ? trueYaw + g() * 20 : 0, latency, n, span, avgDist, avgArea, ...fid];
  const primary = n ? tags.reduce((a, t) => (t.ta > a.ta ? t : a)) : null;
  return [
    { topic: `/${name}/botpose_orb_wpiblue`, type: 'double[]', value: mt2, latency },
    { topic: `/${name}/botpose_wpiblue`, type: 'double[]', value: mt1, latency },
    { topic: `/${name}/tv`, type: 'double', value: n ? 1 : 0 },
    { topic: `/${name}/tid`, type: 'double', value: primary ? primary.id : -1 },
    { topic: `/${name}/tx`, type: 'double', value: primary ? primary.tx : 0 },
    { topic: `/${name}/ty`, type: 'double', value: primary ? primary.ty : 0 },
    { topic: `/${name}/ta`, type: 'double', value: primary ? primary.ta : 0 },
  ];
}
