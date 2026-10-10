// Scrap Spire (3×3): the monument that ends a city. A tall dark tower of stacked, slightly crooked scrap tiers
// (steel, rust and purple plates, pink trims) with glowing magenta windows, tapering up to a golden crown.
// Two small annex towers with gold lamps guard its sides; lights chase up the tower's edges.
import { M } from '../palette';
import type { Vox } from '../voxel';
import { footprint, hash, plate } from './common';
import type { BuildingArt } from './common';

interface Tier {
  z0: number;
  z1: number;
  half: number; // half width around the tower axis
  dx: number; // crooked offset of this tier
  dy: number;
  trim: number; // ledge material at the top
}

const CX = 24;
const CY = 24;

const TIERS: Tier[] = [
  { z0: 6, z1: 30, half: 12, dx: 0, dy: 0, trim: M.pink },
  { z0: 30, z1: 50, half: 10, dx: 1, dy: 0, trim: M.rust },
  { z0: 50, z1: 68, half: 9, dx: 0, dy: 1, trim: M.pink },
  { z0: 68, z1: 84, half: 8, dx: 1, dy: 1, trim: M.purple },
  { z0: 84, z1: 98, half: 7, dx: 0, dy: 0, trim: M.pink },
  { z0: 98, z1: 106, half: 5, dx: 0, dy: 0, trim: M.pinkD },
];

const PLATES = [M.rust, M.purpleD, M.steelD, M.rustD, M.steel];

// A tall magenta window on the +y wall (outer layer y): pink frame, orange glow inside.
function windowY(v: Vox, y: number, x: number, z: number, w: number, h: number, on: boolean): void {
  v.box(x, y, z, x + w, y + 1, z + h, on ? M.pinkLit : M.pinkD);
  if (w > 2 && h > 3) v.box(x + 1, y, z + 1, x + w - 1, y + 1, z + h - 1, on ? M.orangeLit : M.window);
}

function windowX(v: Vox, x: number, y: number, z: number, w: number, h: number, on: boolean): void {
  v.box(x, y, z, x + 1, y + w, z + h, on ? M.pinkLit : M.pinkD);
  if (w > 2 && h > 3) v.box(x, y + 1, z + 1, x + 1, y + w - 1, z + h - 1, on ? M.orangeLit : M.window);
}

export const spire: BuildingArt = {
  frames: 4,
  fps: 6,
  model(frame, working) {
    const v = footprint(3, 3, 124);
    plate(v);
    const on = working;
    // ---- plinth: a dark stepped base with a pink edge
    v.box(5, 5, 3, 43, 43, 6, M.darkL);
    v.box(5, 42, 5, 43, 43, 6, M.pinkD);
    v.box(42, 5, 5, 43, 43, 6, M.pinkD);

    // ---- the tiers
    TIERS.forEach((t, ti) => {
      const x0 = CX - t.half + t.dx;
      const x1 = CX + t.half + t.dx;
      const y0 = CY - t.half + t.dy;
      const y1 = CY + t.half + t.dy;
      v.box(x0, y0, t.z0, x1, y1, t.z1, M.dark);
      // corner columns in lighter steel
      for (const [cx, cy] of [
        [x1 - 2, y1 - 2],
        [x0, y1 - 2],
        [x1 - 2, y0],
      ])
        v.box(cx, cy, t.z0, cx + 2, cy + 2, t.z1, M.darkL);
      // a skirt of scrap plates bolted round the foot of the tier (the "layers" of the spire)
      if (t.z1 - t.z0 >= 12) {
        let k = 0;
        for (let x = x0 + 2; x < x1 - 2; k++) {
          const pw = Math.min(x1 - 2 - x, 3 + Math.floor(hash(ti, k, 5) * 4));
          const ph = 2 + Math.floor(hash(ti, k, 13) * 2);
          v.box(x, y1, t.z0, x + pw, y1 + 1, t.z0 + ph, PLATES[Math.floor(hash(ti, k, 9) * PLATES.length)]);
          x += pw;
        }
        for (let y = y0 + 2; y < y1 - 2; k++) {
          const pw = Math.min(y1 - 2 - y, 3 + Math.floor(hash(ti, k, 5) * 4));
          const ph = 2 + Math.floor(hash(ti, k, 13) * 2);
          v.box(x1, y, t.z0, x1 + 1, y + pw, t.z0 + ph, PLATES[Math.floor(hash(ti, k, 9) * PLATES.length)]);
          y += pw;
        }
      }
      // ledge at the top of the tier, one voxel proud
      v.box(x0 - 1, y0 - 1, t.z1 - 2, x1 + 1, y1 + 1, t.z1, t.trim);
      v.paint(x0 - 1, y0 - 1, t.z1 - 2, x1 + 1, y1 + 1, t.z1 - 1, t.trim === M.pink ? M.pinkD : M.rustD);
      // windows: one or two tall glowing windows per visible wall
      const span = x1 - x0;
      const ww = t.half >= 9 ? 4 : t.half >= 7 ? 3 : 2;
      const wh = t.z1 - t.z0 >= 18 ? 9 : t.z1 - t.z0 >= 12 ? 6 : 3;
      const count = t.half >= 9 ? 2 : 1;
      const gap = Math.floor((span - count * ww) / (count + 1));
      const wz = t.z0 + Math.floor((t.z1 - t.z0 - 2 - wh) / 2);
      for (let i = 0; i < count; i++) {
        windowY(v, y1 - 1, x0 + gap + i * (ww + gap), wz, ww, wh, on && hash(ti, i, 3) > 0.15);
        windowX(v, x1 - 1, y0 + gap + i * (ww + gap), wz, ww, wh, on && hash(ti, i, 4) > 0.15);
      }
      // chase lights on the three outer edges: every 4 voxels a lamp; one band in four is lit and climbs
      for (let z = t.z0 + 1; z + 2 <= t.z1 - 2; z += 4) {
        const band = Math.floor(z / 4) % 4;
        const m = on && band === frame % 4 ? M.yellowLit : M.darkL;
        v.box(x1 - 1, y1 - 1, z, x1 + 1, y1 + 1, z + 2, m);
        v.box(x0 - 1, y1 - 1, z, x0 + 1, y1 + 1, z + 2, m);
        v.box(x1 - 1, y0 - 1, z, x1 + 1, y0 + 1, z + 2, m);
      }
    });

    // ---- grand entrance on the front-left wall, steps down to the plaza
    v.box(19, 36, 6, 30, 39, 20, M.purpleD);
    v.box(20, 38, 6, 29, 39, 18, M.pinkD);
    v.box(21, 38, 6, 28, 39, 17, M.ink);
    v.box(22, 38, 6, 27, 39, 16, on ? M.pinkLit : M.window);
    v.box(23, 38, 6, 26, 39, 15, on ? M.orangeLit : M.window);
    v.box(18, 36, 20, 31, 40, 21, M.pink);
    for (let k = 0; k < 3; k++) v.box(19 - k, 39 + k, 3 + (2 - k), 30 + k, 40 + k, 6 - k, M.steel);

    // ---- annex towers on the left and right corners
    for (const [ax, ay] of [
      [4, 33],
      [33, 4],
    ]) {
      const S = 11;
      v.box(ax, ay, 3, ax + S, ay + S, 20, M.purpleD);
      v.paint(ax, ay, 3, ax + S, ay + S, 6, M.dark);
      v.box(ax, ay, 20, ax + S, ay + S, 22, M.pink);
      v.paint(ax, ay, 20, ax + S, ay + S, 21, M.pinkD);
      v.box(ax + 1, ay + 1, 22, ax + S - 1, ay + S - 1, 23, M.dark);
      // a window on each visible wall
      windowY(v, ay + S - 1, ax + 4, 9, 3, 7, on);
      windowX(v, ax + S - 1, ay + 4, 9, 3, 7, on);
      // a gold lamp on a short post
      v.box(ax + 4, ay + 4, 23, ax + 7, ay + 7, 26, M.steelD);
      v.box(ax + 3, ay + 3, 26, ax + 8, ay + 8, 27, M.yellow);
      v.box(ax + 4, ay + 4, 27, ax + 7, ay + 7, 30, on ? M.yellowLit : M.yellow);
      v.box(ax + 3, ay + 3, 30, ax + 8, ay + 8, 31, M.yellow);
      v.box(ax + 5, ay + 5, 31, ax + 6, ay + 6, 33, M.yellow);
    }

    // ---- a heap of scrap offerings on the front corner of the plinth
    const HEAP = [M.rust, M.steelL, M.rustD, M.purple, M.steel, M.pinkD];
    v.sphere(39, 39, 6, 4, M.rustD, 0.7);
    for (let k = 0; k < 9; k++) {
      const hx = 35 + Math.floor(hash(k, 1, 31) * 6);
      const hy = 35 + Math.floor(hash(k, 2, 31) * 6);
      const hz = 6 + Math.floor(hash(k, 3, 31) * 2);
      v.box(hx, hy, hz, hx + 2, hy + 2, hz + 2, HEAP[k % HEAP.length]);
    }
    v.box(38, 38, 8, 40, 40, 11, M.steelL);

    // ---- the golden crown
    const top = TIERS[TIERS.length - 1];
    const cz = top.z1;
    v.box(CX - 7, CY - 7, cz, CX + 7, CY + 7, cz + 2, M.pinkD); // collar
    v.box(CX - 8, CY - 8, cz + 2, CX + 8, CY + 8, cz + 6, M.yellow); // band
    v.box(CX - 6, CY - 6, cz + 5, CX + 6, CY + 6, cz + 6, on ? M.yellowLit : M.orange); // glowing inside
    v.paint(CX - 8, CY - 8, cz + 2, CX + 8, CY + 8, cz + 3, M.orange);
    // jewels on the band
    for (const g of [-5, 0, 5]) {
      v.box(CX + g - 1, CY + 7, cz + 3, CX + g + 1, CY + 8, cz + 5, on ? M.pinkLit : M.pinkD);
      v.box(CX + 7, CY + g - 1, cz + 3, CX + 8, CY + g + 1, cz + 5, on ? M.pinkLit : M.pinkD);
    }
    // points: tall at the corners, shorter in the middles
    for (const [px, py, h] of [
      [-8, -8, 7],
      [6, -8, 7],
      [-8, 6, 7],
      [6, 6, 7],
      [-1, -8, 5],
      [-1, 6, 5],
      [-8, -1, 5],
      [6, -1, 5],
    ]) {
      v.box(CX + px, CY + py, cz + 6, CX + px + 2, CY + py + 2, cz + 6 + h, M.yellow);
      v.box(CX + px, CY + py, cz + 6 + h, CX + px + 2, CY + py + 2, cz + 7 + h, on ? M.yellowLit : M.yellow);
    }
    // the orb at the heart of the crown
    v.sphere(CX, CY, cz + 10, 3.2, on ? M.yellowLit : M.orange);
    v.point('light', CX, CY, cz + 14);
    return v;
  },
};
