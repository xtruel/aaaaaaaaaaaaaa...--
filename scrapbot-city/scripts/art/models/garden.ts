// Pixel Garden (1×1): a grass bed in a sand planter with a big round tree, a small tree, a bed of pink and
// yellow flower clumps, a wooden bench and a street lamp that glows while the garden is open. Four frames: the
// canopies lean right, back, left, back (whole crowns shift, shading intact) and a butterfly flaps over the flowers.
import { M } from '../palette';
import { hex, mat } from '../voxel';
import type { Vox } from '../voxel';
import { footprint, plate } from './common';
import type { BuildingArt } from './common';

const WOOD = mat('garden-wood', { rgb: hex('#a8794a') });
const WOOD_D = mat('garden-woodD', { rgb: hex('#5f3d25') });

// A chunky round canopy: a few overlapping balls, lighter on top, darker underneath. It is built in its own model
// so the shading only touches this crown, then stamped with 'sway' (+1 leans 2 px to the screen's right).
function canopy(v: Vox, cx: number, cy: number, cz: number, r: number, sway: number): void {
  const c = footprint(1, 1, v.h);
  c.sphere(cx, cy, cz, r, M.green);
  c.sphere(cx - r * 0.35, cy + r * 0.35, cz - r * 0.3, r * 0.68, M.green);
  c.sphere(cx + r * 0.35, cy - r * 0.35, cz - r * 0.2, r * 0.68, M.green);
  c.sphere(cx, cy, cz + r * 0.55, r * 0.62, M.green);
  // shade: light top layer, dark bottom layer
  for (let y = 0; y < c.d; y++)
    for (let x = 0; x < c.w; x++) {
      let top = -1;
      let bottom = -1;
      for (let z = 0; z < c.h; z++)
        if (c.get(x, y, z)) {
          if (bottom < 0) bottom = z;
          top = z;
        }
      if (top < 0) continue;
      c.set(x, y, top, M.greenL);
      if (bottom < top - 1) c.set(x, y, bottom, M.greenD);
    }
  v.stamp(c, sway, -sway, 0);
}

export const garden: BuildingArt = {
  frames: 4,
  fps: 4,
  model(frame, working) {
    const v = footprint(1, 1, 19);
    const f = working ? frame % 4 : 0;
    const sway = working ? [0, 1, 0, -1][f] : 0;
    plate(v);
    // grass bed inside the sand rim
    v.box(2, 2, 2, 14, 14, 3, M.green);
    // the big tree at the back
    v.box(4, 4, 3, 8, 8, 4, M.greenD); // mound
    v.box(5, 5, 3, 7, 7, 10, M.rustD);
    canopy(v, 6, 6, 12.5, 4.6, sway);
    // a small tree on the right corner
    v.box(12, 3, 3, 13, 4, 6, M.rustD);
    canopy(v, 12.5, 3.5, 7.5, 2.6, sway);
    // flower bed on the front corner: four 2×2 clumps of pink and yellow heads over dark leaves
    v.box(9, 9, 3, 14, 14, 4, M.greenD);
    const CLUMPS: [number, number, number][] = [
      [9, 12, M.pink],
      [12, 9, M.pink],
      [12, 12, M.yellow],
      [9, 9, M.yellow],
    ];
    for (const [x, y, m] of CLUMPS) v.box(x, y, 4, x + 2, y + 2, 5, m);
    // wooden bench along the front-left edge, facing the viewer: seat, a gap, then the backrest
    for (const x of [2, 9]) {
      v.box(x, 13, 3, x + 1, 14, 5, WOOD_D);
      v.box(x, 11, 3, x + 1, 12, 7, WOOD_D);
    }
    v.box(2, 12, 5, 10, 14, 6, WOOD);
    v.box(2, 11, 7, 10, 12, 9, WOOD_D);
    // street lamp on the left corner: a 2×2 head that glows while the garden is open
    v.box(2, 14, 3, 3, 15, 12, M.steelD);
    v.box(2, 13, 12, 4, 15, 14, working ? M.yellowLit : M.yellow);
    v.box(1, 12, 14, 5, 16, 15, M.steelD);
    // a butterfly over the flowers: wings open, then folded 2 voxels higher, drifting up a voxel every other beat
    if (working) {
      const z = 9 + (f >> 1);
      if (f % 2 === 0) {
        v.box(11, 10, z, 12, 12, z + 2, M.pink);
        v.box(13, 10, z, 14, 12, z + 2, M.pink);
        v.box(12, 10, z, 13, 12, z + 1, M.pinkD);
      } else v.box(12, 10, z + 2, 13, 12, z + 4, M.pink);
    }
    return v;
  },
};
