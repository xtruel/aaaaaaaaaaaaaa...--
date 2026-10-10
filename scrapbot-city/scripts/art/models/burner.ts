// Scrap Burner (2×2): a dark grey power plant that burns scrap. A tall red stack with a glowing top (and a
// smaller twin), a red furnace front where flames flicker behind a grate, a hopper heaped with scrap on the roof
// and the 2PM logo on the side. Working = it has fuel: flames, hot stacks, smoke. Off = cold grate, dark stacks.
import { M } from '../palette';
import { footprint, hazardBand, plate } from './common';
import type { BuildingArt } from './common';

const SCRAP = [M.rust, M.steelL, M.rustD, M.steel, M.orange, M.pinkD, M.rust, M.steelL];

export const burner: BuildingArt = {
  frames: 4,
  fps: 8,
  model(frame, working) {
    const v = footprint(2, 2, 52);
    const f = working ? frame : 0;
    plate(v);

    // ---------- main block ----------
    v.box(3, 3, 3, 28, 24, 19, M.darkL);
    v.paint(3, 3, 3, 28, 24, 5, M.dark);
    v.box(2, 2, 19, 29, 25, 21, M.concrete); // roof lip
    v.box(4, 4, 21, 27, 23, 22, M.dark);

    // 2PM logo on the right wall (outer layer x = 27)
    v.box(27, 6, 7, 29, 21, 17, M.pink);
    v.box(28, 7, 8, 29, 20, 16, M.pinkD);
    v.text('2PM', '+x', 28, 19, 14, M.white, true);

    // ---------- furnace front: red frame, grate, flames ----------
    v.box(4, 24, 3, 21, 29, 15, M.red);
    v.paint(4, 24, 3, 21, 29, 5, M.rustD);
    v.box(3, 23, 15, 22, 30, 16, M.rustD); // top lip
    v.box(4, 24, 16, 21, 29, 17, M.red);
    // the firebox behind the grate (outer layer y = 28)
    v.box(6, 25, 5, 19, 28, 13, working ? M.orangeLit : M.ink);
    v.clear(6, 26, 6, 19, 29, 13);
    if (working) {
      for (let k = 0; k < 7; k++) {
        const x = 6 + k * 2;
        const h = 2 + ((k * 5 + f * 3) % 5);
        v.box(x, 26, 6, Math.min(19, x + 2), 28, 6 + h, M.fire);
      }
    } else v.box(7, 26, 6, 18, 28, 8, M.rustD); // ash
    // grate: a frame and vertical bars
    v.box(6, 28, 12, 19, 29, 13, M.ink);
    v.box(6, 28, 5, 19, 29, 6, M.ink);
    for (let x = 6; x < 19; x += 3) v.box(x, 28, 5, x + 1, 29, 13, M.ink);
    hazardBand(v, 4, 28, 3, 21, 29, 5);

    // ---------- the big red stack (back) and its small twin ----------
    const cx = 10.5;
    const cy = 10.5;
    v.cylZ(cx, cy, 6.6, 22, 25, M.concrete); // collar
    v.cylZ(cx, cy, 5.2, 22, 48, M.red);
    v.cylZ(cx, cy, 5.2, 30, 31, M.pinkD);
    v.cylZ(cx, cy, 5.2, 41, 44, working ? M.orangeLit : M.rustD); // glowing band
    v.cylZ(cx, cy, 5.7, 48, 50, M.dark); // rim
    v.cylZ(cx, cy, 3.9, 49, 50, working ? M.orangeLit : M.ink);
    if (working) v.cylZ(cx, cy, 2.4, 49, 50, M.fire);
    v.point('smoke', cx, cy, 50);
    const sx = 21.5;
    const sy = 6.5;
    v.cylZ(sx, sy, 3.6, 22, 24, M.concrete);
    v.cylZ(sx, sy, 2.6, 22, 37, M.red);
    v.cylZ(sx, sy, 2.6, 32, 34, working ? M.orangeLit : M.rustD);
    v.cylZ(sx, sy, 3.1, 37, 38, M.dark);
    v.cylZ(sx, sy, 1.6, 37, 38, working ? M.fire : M.ink);
    v.point('smoke', sx, sy, 38);

    // ---------- hopper heaped with scrap (front right of the roof) ----------
    const hx = 22;
    const hy = 16;
    v.box(hx - 2, hy - 2, 22, hx + 2, hy + 2, 25, M.steelD); // neck
    for (let k = 0; k < 4; k++) v.box(hx - 3 - k, hy - 3 - k, 25 + k, hx + 3 + k, hy + 3 + k, 26 + k, M.steelL);
    v.box(hx - 7, hy - 7, 29, hx + 7, hy + 7, 31, M.steel); // rim
    hazardBand(v, hx - 7, hy - 7, 29, hx + 7, hy + 7, 30);
    v.box(hx - 6, hy - 6, 30, hx + 6, hy + 6, 31, M.ink);
    // the heap: bigger chunks in the middle
    for (let k = 0; k < 16; k++) {
      const i = k % 4;
      const j = Math.floor(k / 4);
      const x = hx - 6 + i * 3;
      const y = hy - 6 + j * 3;
      const centre = (i === 1 || i === 2) && (j === 1 || j === 2);
      const h = 1 + ((k * 7) % 3) + (centre ? 2 : 0);
      v.box(x, y, 30, x + 3 - ((k >> 1) % 2), y + 3 - (k % 2), 31 + h, SCRAP[(k * 3) % SCRAP.length]);
    }

    // ---------- transformer at the front corner: the power goes out from here ----------
    v.box(22, 25, 3, 29, 30, 10, M.steelD);
    for (let x = 23; x < 29; x += 2) v.box(x, 29, 4, x + 1, 30, 9, M.steel); // cooling fins
    v.box(28, 26, 4, 29, 29, 9, M.steel);
    for (const [ix, iy] of [
      [23.5, 27.5],
      [27, 27.5],
    ]) {
      v.cylZ(ix, iy, 1.1, 10, 14, M.white);
      v.cylZ(ix, iy, 1.6, 11, 12, M.steelL);
      v.box(Math.floor(ix), Math.floor(iy), 14, Math.floor(ix) + 1, Math.floor(iy) + 1, 15, working ? M.cyanLit : M.steel);
    }
    // energy meter on the right wall: lights chase upwards while the burner makes power
    v.box(27, 20, 6, 29, 24, 19, M.dark);
    for (let k = 0; k < 4; k++) v.box(28, 21, 7 + k * 3, 29, 23, 9 + k * 3, working && k <= f ? M.limeLit : M.ink);
    return v;
  },
};
