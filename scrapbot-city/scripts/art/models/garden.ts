// Pixel Garden (1×1): a grass bed in a sand planter with a big round tree, a small tree, a bed of pink and
// yellow flowers, a wooden bench and a street lamp that glows at night. Two frames: the canopies sway by a voxel
// and a butterfly flutters over the flowers.
import { M } from '../palette';
import type { Vox } from '../voxel';
import { footprint, plate } from './common';
import type { BuildingArt } from './common';

// A chunky round canopy: a few overlapping balls, lighter on top, darker underneath. 'sway' leans the crown
// towards the screen's right by a voxel.
function canopy(v: Vox, cx: number, cy: number, cz: number, r: number, sway: number): void {
  const z0 = Math.max(0, Math.floor(cz - r - 1));
  const z1 = Math.min(v.h, Math.ceil(cz + r + 2));
  const s = sway * 0.5;
  v.sphere(cx + s * 0.5, cy - s * 0.5, cz, r, M.green);
  v.sphere(cx - r * 0.35, cy + r * 0.35, cz - r * 0.3, r * 0.68, M.green);
  v.sphere(cx + r * 0.35 + s, cy - r * 0.35 - s, cz - r * 0.2, r * 0.68, M.green);
  v.sphere(cx + s * 1.5, cy - s * 1.5, cz + r * 0.55, r * 0.62, M.green);
  // shade: light top layer, dark bottom layer
  for (let y = 0; y < v.d; y++)
    for (let x = 0; x < v.w; x++) {
      let top = -1;
      let bottom = -1;
      for (let z = z0; z < z1; z++)
        if (v.get(x, y, z) === M.green) {
          if (bottom < 0) bottom = z;
          top = z;
        }
      if (top < 0) continue;
      v.set(x, y, top, M.greenL);
      if (bottom < top - 1) v.set(x, y, bottom, M.greenD);
    }
}

export const garden: BuildingArt = {
  frames: 2,
  fps: 2,
  model(frame, working) {
    const v = footprint(1, 1, 19);
    const sway = working ? frame % 2 : 0;
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
    // flower bed on the front corner: pink and yellow heads scattered over leafy green
    v.box(9, 9, 3, 14, 14, 4, M.greenD);
    const FLOWERS = ['..P..', '.Y..P', 'P..Y.', '..P..', '.Y..P'];
    FLOWERS.forEach((row, j) =>
      [...row].forEach((ch, i) => {
        if (ch === '.') return;
        v.set(9 + i, 9 + j, 3, M.green);
        v.set(9 + i, 9 + j, 4, ch === 'P' ? M.pink : M.yellow);
      }),
    );
    // wooden bench along the front-left edge, facing the viewer
    for (const x of [3, 8]) {
      v.box(x, 13, 3, x + 1, 14, 5, M.steelD);
      v.box(x, 11, 3, x + 1, 12, 8, M.steelD);
    }
    v.box(2, 12, 5, 10, 14, 6, M.rust);
    v.box(2, 11, 6, 10, 12, 8, M.rustD);
    // street lamp on the left corner
    v.box(2, 14, 3, 3, 15, 12, M.steelD);
    v.box(2, 14, 12, 3, 15, 14, M.yellowLit);
    v.box(1, 13, 14, 4, 16, 15, M.steelD);
    // a butterfly over the flowers (wings open, then folded higher up)
    if (working) {
      if (frame % 2 === 0) {
        v.set(11, 11, 8, M.pink);
        v.set(12, 10, 8, M.pink);
      } else {
        v.set(12, 9, 9, M.pink);
        v.set(12, 9, 10, M.pinkD);
      }
    }
    return v;
  },
};
