// Field terrain: the four BUMPs, shared by the chassis physics (bridge/chassis.mjs) and the fuel physics
// (balls.js) so the robot and the balls ride the same surface. Field coordinates in metres, z up.
//
// BUMP (manual 2026, arena ch.): 73.0in wide (Y) x 44.4in deep (X, the ramp/drive direction) x 6.513in tall,
// centred between the alliance wall and the HUB on both sides of it - one pair per alliance (4 total).
// Modelled as a ramp-up-then-down "tent" profile along X: height 0 at the footprint edge, full height at
// the centre (the manual's 15 deg ramps over this depth meet almost at a point anyway).
const IN = 0.0254;
export const BUMP_HALF_DEPTH = (44.4 * IN) / 2, BUMP_HALF_WIDTH = (73.0 * IN) / 2, BUMP_HEIGHT = 6.513 * IN;
export const BUMPS = [102.15, 317.7 - 102.15].flatMap((y) => [181.56, 651.2 - 181.56].map((x) => ({ x: x * IN, y: y * IN })));

// Ground height at a field point and its slope (dz/dx, dz/dy).
export function terrainAt(x, y) {
  for (const b of BUMPS) {
    const ld = x - b.x, lw = y - b.y;
    if (Math.abs(lw) > BUMP_HALF_WIDTH || Math.abs(ld) > BUMP_HALF_DEPTH) continue;
    const z = BUMP_HEIGHT * (1 - Math.abs(ld) / BUMP_HALF_DEPTH);
    const dzdx = -Math.sign(ld) * (BUMP_HEIGHT / BUMP_HALF_DEPTH);
    return { z, dzdx, dzdy: 0 };
  }
  return { z: 0, dzdx: 0, dzdy: 0 };
}
