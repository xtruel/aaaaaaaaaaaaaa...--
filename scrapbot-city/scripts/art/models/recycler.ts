// Recycler (2×2): green plant with the recycle mark, a dark hopper where bots drop scrap, a conveyor that
// carries junk up the side (moves only while the machine works) and crusher rollers on the roof.
import { M } from '../palette';
import { footprint, plate, recycleY } from './common';
import type { BuildingArt } from './common';

const SCRAP = [M.rust, M.steelL, M.rustD, M.pinkD, M.steel];

export const recycler: BuildingArt = {
  frames: 4,
  fps: 6,
  model(frame, working) {
    const v = footprint(2, 2, 40);
    plate(v);
    // hopper tower at the back
    v.box(4, 4, 3, 14, 13, 28, M.steelD);
    v.box(3, 3, 28, 15, 14, 32, M.steel);
    v.box(5, 5, 30, 13, 12, 32, M.ink);
    v.box(5, 5, 30, 13, 12, 31, M.rustD); // scrap inside the mouth
    v.paint(4, 4, 22, 14, 13, 24, M.hazardY);
    // main green block
    v.box(3, 11, 3, 23, 29, 20, M.green);
    v.paint(3, 11, 3, 23, 29, 5, M.greenD);
    v.box(2, 10, 20, 24, 30, 22, M.greenD); // roof lip
    v.box(4, 12, 22, 22, 28, 23, M.green);
    // the recycle mark on a white plate
    v.box(8, 29, 6, 19, 30, 17, M.white);
    recycleY(v, 29, 9, 15, working ? M.limeLit : M.greenD);
    // side door on the right wall
    v.box(22, 14, 3, 23, 20, 12, M.ink);
    v.box(22, 15, 3, 23, 19, 11, M.steelD);
    // conveyor up the right side: frame, belt, rollers
    const shift = working ? frame * 2 : 0;
    v.box(24, 4, 3, 30, 29, 7, M.steelD);
    v.box(24, 4, 7, 25, 29, 9, M.steel);
    v.box(29, 4, 7, 30, 29, 9, M.steel);
    for (let y = 4; y < 29; y++) v.box(25, y, 7, 29, y + 1, 8, (y + shift) % 4 < 2 ? M.ink : M.dark);
    for (let y = 6; y < 29; y += 5) v.cylX(y + 0.5, 5.5, 1, 24, 30, M.steelL);
    // scrap riding the belt
    for (let k = 0; k < 5; k++) {
      const y = 27 - ((k * 5 + shift) % 24);
      const m = SCRAP[k % SCRAP.length];
      v.box(25 + (k % 2), y, 8, 27 + (k % 2), y + 2, 9 + (k % 3 === 0 ? 2 : 1), m);
    }
    // chute from the belt into the hopper
    v.box(14, 4, 24, 26, 8, 26, M.steel);
    // crusher rollers on the roof, turning while working
    for (const [cx, mm] of [
      [9.5, M.yellow],
      [16.5, M.orange],
    ] as const) {
      v.cylY(cx, 26, 2.6, 14, 26, mm);
      const tooth = working ? frame % 2 : 0;
      for (let y = 14 + tooth; y < 26; y += 2) v.box(Math.floor(cx) - 3, y, 25, Math.floor(cx) + 4, y + 1, 26, M.steelD);
    }
    // status light
    v.box(20, 26, 22, 22, 28, 25, working ? M.limeLit : M.steelD);
    v.point('light', 21, 27, 25);
    v.point('spark', 10, 10, 31);
    return v;
  },
};
