// Smelter (2×2): an orange kiln with dark steel trim and a glowing furnace mouth, a dark furnace block behind it
// carrying a tall chimney with a hot collar, and on the right a tilted crucible pouring molten metal into moulds
// that ride a short line to stacks of yellow ingots. Off = cold furnace: dark mouth, no pour, no glow.
import { M } from '../palette';
import type { Vox } from '../voxel';
import { footprint, hazardBand, plate } from './common';
import type { BuildingArt } from './common';

// A cup (crucible) whose axis leans towards +y by `tilt` radians, bottom centre at (cx, cy, cz).
// Walls of `wall`, filled with `melt` below the horizontal level `level` (or empty when melt is 0).
function tiltedCup(v: Vox, cx: number, cy: number, cz: number, r: number, h: number, tilt: number, wall: number, rim: number, melt: number, level: number): void {
  const ay = Math.sin(tilt);
  const az = Math.cos(tilt);
  const R = Math.ceil(r + h + 1);
  for (let z = Math.floor(cz - 2); z <= Math.ceil(cz + R); z++)
    for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y++)
      for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const dz = z + 0.5 - cz;
        const t = dy * ay + dz * az; // height along the axis
        const ry = dy - t * ay;
        const rz = dz - t * az;
        const rr = Math.sqrt(dx * dx + ry * ry + rz * rz);
        if (t < 0 || t > h || rr > r) continue;
        const shell = rr > r - 1.2 || t < 1.2;
        if (shell) v.set(x, y, z, t > h - 1.2 ? rim : wall);
        else if (melt && z + 0.5 <= level) v.set(x, y, z, melt);
      }
}

// Flame heights in the furnace mouth (each tongue takes the next one every frame), heat gauge bars per frame.
const MOUTH = [3, 8, 5, 9];
const HEAT = [1, 2, 3, 2];
// Where the molten stream falls on the casting line.
const STREAM_Y = 14;

export const smelter: BuildingArt = {
  frames: 4,
  fps: 6,
  model(frame, working) {
    const v = footprint(2, 2, 48);
    const f = working ? frame : 0;
    plate(v);

    // ---------- furnace block at the back, carrying the chimney ----------
    v.box(3, 3, 3, 20, 11, 29, M.steelD);
    v.box(2, 2, 29, 21, 12, 30, M.steel);
    v.box(4, 4, 30, 19, 10, 31, M.steelD);
    // glowing vents on its front wall, above the kiln
    [6, 10, 14].forEach((x, k) => v.box(x, 10, 24, x + 2, 11, 27, working ? ((k + f) % 3 ? M.orangeLit : M.fire) : M.ink));

    // ---------- kiln: the orange body ----------
    v.box(3, 11, 3, 19, 28, 22, M.orange);
    v.paint(3, 11, 3, 19, 28, 5, M.rustD); // sooty base
    v.paint(3, 11, 17, 19, 28, 18, M.rust); // seam
    v.box(2, 10, 22, 20, 29, 23, M.rust); // roof lip
    v.box(4, 12, 23, 18, 27, 24, M.orange);
    v.box(6, 17, 24, 12, 23, 25, M.steelD); // charging hatch on the roof
    v.box(7, 18, 24, 11, 22, 25, M.steel);
    v.box(8, 19, 25, 10, 21, 26, M.steelD); // its handle
    v.box(18, 27, 3, 20, 29, 22, M.steelD); // front corner post

    // furnace mouth on the front-left wall (outer layer y = 28): a dark firebox inside a steel frame, so the
    // flame tongues read against it
    v.box(7, 24, 4, 16, 27, 16, M.rustD); // lining
    v.box(7, 27, 4, 16, 29, 16, M.steelD); // frame, standing out of the wall
    v.box(8, 25, 5, 15, 26, 15, M.ink); // back wall
    v.clear(8, 26, 5, 15, 29, 15); // the opening
    v.box(8, 27, 14, 9, 29, 15, M.steelD); // rounded arch corners
    v.box(14, 27, 14, 15, 29, 15, M.steelD);
    if (working) {
      // flames: tongues that take the next height every frame
      for (let k = 0; k < 4; k++) {
        const x = 8 + k * 2;
        const h = MOUTH[(k + f) % 4];
        v.box(x, 26, 5, Math.min(15, x + 2), 28, 5 + h, M.orangeLit);
        v.box(x, 27, 5, Math.min(15, x + 2), 28, 4 + h, M.fire);
      }
    } else {
      v.box(8, 26, 4, 15, 28, 5, M.ink); // cold hearth
      v.box(9, 26, 5, 14, 28, 7, M.rustD); // cold slag
    }
    hazardBand(v, 7, 28, 15, 16, 29, 16);

    // access door and a heat gauge on the right wall (outer layer x = 18)
    v.box(18, 19, 3, 20, 26, 13, M.steelD);
    v.box(19, 20, 3, 20, 25, 12, M.steel);
    v.box(19, 21, 8, 20, 24, 10, M.window);
    // heat gauge: three bars that rise and fall with the fire
    v.box(18, 13, 8, 20, 18, 16, M.steelD);
    const heat = working ? HEAT[f] : 0;
    for (let k = 0; k < 3; k++) v.box(19, 14, 9 + k * 2, 20, 17, 11 + k * 2, k < heat ? (k === 2 ? M.redLit : M.orangeLit) : M.ink);

    // ---------- chimney ----------
    const cx = 11;
    const cy = 7;
    v.cylZ(cx, cy, 4.8, 31, 34, M.orange); // hot collar
    v.cylZ(cx, cy, 3.7, 31, 46, M.dark);
    v.cylZ(cx, cy, 3.7, 37, 38, M.darkL);
    v.cylZ(cx, cy, 4.3, 45, 47, M.dark); // rim
    v.cylZ(cx, cy, 2.7, 46, 47, working ? M.orangeLit : M.ink);
    v.point('smoke', cx, cy, 47);

    // ---------- crucible on a pedestal (back right), tilted towards the front ----------
    v.box(21, 4, 3, 29, 11, 13, M.steelD);
    v.box(20, 3, 13, 30, 12, 14, M.steel);
    hazardBand(v, 21, 4, 11, 29, 11, 13);
    v.box(20, 6, 14, 22, 9, 19, M.steel); // pivot posts
    v.box(28, 6, 14, 30, 9, 19, M.steel);
    tiltedCup(v, 25, 6.5, 13.5, 4.2, 8, 0.6, M.steelL, M.white, working ? M.fire : M.rustD, 19.5);

    // ---------- mould line running to the front ----------
    v.box(21, 12, 3, 30, 22, 5, M.steelD);
    v.box(21, 12, 5, 22, 22, 6, M.steel);
    v.box(29, 12, 5, 30, 22, 6, M.steel);
    // a continuous casting chain: 6-long moulds between 2-wide dividers, moving 2 voxels per frame towards the
    // front. Empty before the stream, molten under it, cooling just past it, set gold at the end of the line.
    for (let y = 12; y < 22; y++) {
      const p = (((y - 12 - f * 2) % 8) + 8) % 8;
      const start = y - p; // where this mould's divider begins; its tray is start + 2 .. start + 7
      if (p < 2) {
        v.box(22, y, 5, 29, y + 1, 7, M.steel); // divider
        continue;
      }
      v.box(22, y, 5, 29, y + 1, 6, M.steel);
      v.box(22, y, 6, 23, y + 1, 7, M.steel);
      v.box(28, y, 6, 29, y + 1, 7, M.steel);
      let fill = M.steelD; // empty: not under the stream yet (or the line is stopped)
      if (working && start + 8 > STREAM_Y) fill = start < 16 ? M.orangeLit : start < 18 ? M.orange : M.yellow;
      v.box(23, y, 6, 28, y + 1, 7, fill);
    }
    // the molten stream from the lip into the moulds
    if (working) for (let z = 7; z < 19; z++) v.box(25, STREAM_Y, z, 27, STREAM_Y + 1, z + 1, (z + f * 2) % 4 < 2 ? M.fire : M.orangeLit);
    v.point('spark', 26, 15, 8);

    // ---------- stacks of ingots at the front ----------
    // a pyramid of bars on a pallet: 3, 2, 1, with a gap between the bars of each layer
    v.box(21, 23, 3, 30, 30, 4, M.rustD);
    const bar = (x: number, z: number) => v.box(x, 24, z, x + 2, 29, z + 2, M.yellow);
    for (const x of [21, 24, 27]) bar(x, 4);
    for (const x of [22.5, 25.5]) bar(Math.floor(x), 6);
    bar(24, 8);

    // status light on the kiln corner
    v.box(18, 27, 18, 20, 29, 20, working ? M.limeLit : M.steel);
    return v;
  },
};
