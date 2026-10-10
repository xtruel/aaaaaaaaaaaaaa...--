// Scrap Burner (2×2): a dark grey power plant that burns scrap. A tall red stack with a glowing top (and a
// smaller twin), a red furnace front where flames leap behind a grate, a hopper heaped with scrap on the roof,
// a transformer with cyan insulators and the 2PM logo with an energy meter on the side.
// Working = it has fuel: flames jump in the firebox and out of the stack, hot segments chase round the stack band,
// the meter fills, smoke. Off = cold grate with ash, dark stacks, dark insulators and meter.
import { M } from '../palette';
import { footprint, hazardBand, plate } from './common';
import type { BuildingArt } from './common';

const SCRAP = [M.rust, M.steelL, M.rustD, M.steel, M.orange, M.pinkD, M.rust, M.steelL];

// "2PM" in letters 7 rows tall (the 3×5 house font reads as "ZFM" on the side wall).
const LOGO = [
  ['.#.', '#.#', '..#', '.#.', '#..', '#..', '###'],
  ['##.', '#.#', '#.#', '##.', '#..', '#..', '#..'],
  ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
];

// Flame heights in the firebox: each tongue takes the next height every frame, so the fire visibly jumps.
const TONGUES = [3, 8, 4, 6];
// Flame tongues licking out of the big stack, swapping sides every frame.
const STACK_FLAME: [number, number][] = [
  [3, 1],
  [1, 4],
  [4, 2],
  [2, 3],
];

export const burner: BuildingArt = {
  frames: 4,
  fps: 8,
  model(frame, working) {
    const v = footprint(2, 2, 56);
    const f = working ? frame : 0;
    plate(v);

    // ---------- main block ----------
    v.box(3, 3, 3, 28, 24, 19, M.darkL);
    v.paint(3, 3, 3, 28, 24, 5, M.dark);
    v.box(2, 2, 19, 29, 25, 21, M.concrete); // roof lip
    v.box(4, 4, 21, 27, 23, 22, M.dark);

    // 2PM logo on the right wall (outer layer x = 27), in 7-row letters so the 2 and the P read
    v.box(27, 3, 6, 29, 19, 18, M.pink);
    v.box(28, 4, 7, 29, 18, 17, M.pinkD);
    let ly = 17; // the +x face reads along −y
    for (const g of LOGO) {
      g.forEach((row, r) => {
        for (let c = 0; c < row.length; c++) if (row[c] === '#') v.set(28, ly - c, 15 - r, M.white);
      });
      ly -= g[0].length + 1;
    }

    // energy meter beside it: a steel-framed gauge whose 4 bars fill up while the burner makes power
    v.box(27, 19, 6, 29, 24, 19, M.steel);
    v.box(28, 20, 7, 29, 23, 18, M.ink);
    for (let k = 0; k < 4; k++) v.box(28, 20, 7 + k * 3, 29, 23, 9 + k * 3, working && k <= f ? M.limeLit : M.dark);

    // ---------- furnace front: red frame, grate, flames ----------
    v.box(4, 24, 3, 21, 29, 15, M.red);
    v.paint(4, 24, 3, 21, 29, 5, M.rustD);
    v.box(3, 23, 15, 22, 30, 16, M.rustD); // top lip
    v.box(4, 24, 16, 21, 29, 17, M.red);
    // the firebox (outer layer y = 28): always dark inside, so the flames read against it
    v.box(6, 25, 5, 19, 28, 14, M.ink);
    v.clear(7, 26, 6, 18, 29, 14);
    if (working) {
      v.box(7, 26, 5, 18, 28, 6, M.orangeLit); // embers
      for (let k = 0; k < 4; k++) {
        const x = 7 + k * 3;
        const h = TONGUES[(k + f) % 4];
        v.box(x, 26, 6, x + 2, 28, 6 + h, M.orangeLit); // tongue
        v.box(x, 27, 6, x + 2, 28, 5 + h, M.fire); // its hot core in front
      }
    } else v.box(7, 26, 6, 18, 28, 8, M.rustD); // ash
    // a low fire grate the flames rise from
    v.box(6, 28, 5, 19, 29, 6, M.ink);
    for (const x of [9, 12, 15]) v.box(x, 28, 5, x + 1, 29, 9, M.ink);
    hazardBand(v, 4, 28, 3, 21, 29, 5);

    // ---------- the big red stack (back) and its small twin ----------
    const cx = 9.5;
    const cy = 9.5;
    v.cylZ(cx, cy, 6.6, 22, 25, M.concrete); // collar
    v.cylZ(cx, cy, 5.2, 22, 48, M.red);
    v.cylZ(cx, cy, 5.2, 30, 31, M.pinkD);
    v.cylZ(cx, cy, 5.2, 41, 44, working ? M.orangeLit : M.rustD); // glowing band
    if (working)
      // hot segments chasing round the band
      for (let z = 41; z < 44; z++)
        for (let y = 3; y < 17; y++)
          for (let x = 3; x < 17; x++) {
            if (!v.get(x, y, z)) continue;
            const s = Math.floor((Math.atan2(y + 0.5 - cy, x + 0.5 - cx) + Math.PI) / (Math.PI / 4)) % 8;
            if ((s - f + 8) % 4 === 0) v.set(x, y, z, M.fire);
          }
    v.cylZ(cx, cy, 5.7, 48, 50, M.dark); // rim
    v.cylZ(cx, cy, 3.9, 49, 50, working ? M.orangeLit : M.ink);
    if (working) {
      v.cylZ(cx, cy, 2.4, 49, 50, M.fire);
      const [ta, tb] = STACK_FLAME[f];
      v.box(8, 10, 50, 10, 12, 50 + ta, M.fire);
      v.box(10, 8, 50, 12, 10, 50 + tb, M.orangeLit);
    }
    v.point('smoke', cx, cy, 50);
    const sx = 21.5;
    const sy = 6.5;
    v.cylZ(sx, sy, 3.6, 22, 24, M.concrete);
    v.cylZ(sx, sy, 2.6, 22, 37, M.red);
    v.cylZ(sx, sy, 2.6, 32, 34, working ? (f % 2 ? M.fire : M.orangeLit) : M.rustD);
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
    for (const ix of [24, 27]) {
      v.cylZ(ix, 28, 1.0, 10, 14, M.white); // insulator
      v.cylZ(ix, 28, 1.6, 11, 12, M.steelL); // its skirt
      v.box(ix - 1, 27, 14, ix + 1, 29, 15, working ? M.cyanLit : M.steel); // cap
    }
    return v;
  },
};
