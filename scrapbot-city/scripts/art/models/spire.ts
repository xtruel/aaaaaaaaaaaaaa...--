// Scrap Spire (3×3): the monument that ends a city. A tall dark tower of stacked, slightly crooked scrap tiers
// (steel, rust and purple plates, pink trims) with glowing magenta windows, tapering up to a golden crown.
// Welded scrap panels and bolted-on blocks break up the walls; two annex towers with gold lamps guard its sides.
// The crown: a gold ring on a pink cap rising into points with glowing tips, jewels, an orb and a cross (the
// 'light' beacon sits on the cross). Frames (4): a band of lamps climbs the tower's three outer edges.
// Off: windows, lamps, jewels and crown glow all dark.
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
  // a scrap block bolted onto one visible wall: face, position along the wall from the tier's start, size, material
  junk?: { face: '+x' | '+y'; at: number; w: number; h: number; z: number; m: number; stripe?: number };
}

const CX = 24;
const CY = 24;

const TIERS: Tier[] = [
  { z0: 6, z1: 30, half: 12, dx: 0, dy: 0, trim: M.pink },
  { z0: 30, z1: 50, half: 10, dx: 1, dy: 0, trim: M.rust, junk: { face: '+x', at: 13, w: 5, h: 9, z: 34, m: M.rustD, stripe: M.rust } },
  { z0: 50, z1: 68, half: 9, dx: 0, dy: 1, trim: M.pink, junk: { face: '+y', at: 1, w: 4, h: 7, z: 53, m: M.purpleD, stripe: M.purple } },
  { z0: 68, z1: 84, half: 8, dx: 1, dy: 1, trim: M.purple, junk: { face: '+x', at: 2, w: 4, h: 6, z: 72, m: M.steelD, stripe: M.steel } },
  { z0: 84, z1: 98, half: 7, dx: 0, dy: 0, trim: M.pink },
  { z0: 98, z1: 106, half: 5, dx: 0, dy: 0, trim: M.pinkD },
];

const PLATES = [M.rust, M.purpleD, M.steelD, M.rustD, M.steel];
const PATCH = [M.purpleD, M.navy, M.rustD, M.darkL];

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
      // patchwork: scrap panels welded onto the visible walls (drawn before the windows, which cut through them)
      if (t.z1 - t.z0 >= 12)
        for (let k = 0; k < 2; k++) {
          const pw = 4 + Math.floor(hash(ti, k, 41) * 3);
          const ph = 4 + Math.floor(hash(ti, k, 43) * 3);
          const pz = t.z0 + 4 + Math.floor(hash(ti, k, 47) * Math.max(1, t.z1 - t.z0 - ph - 7));
          const along = 2 + Math.floor(hash(ti, k, 53) * Math.max(1, x1 - x0 - pw - 4));
          const pm = PATCH[Math.floor(hash(ti, k, 59) * PATCH.length)];
          if (k === 0) v.paint(x0 + along, y1 - 1, pz, x0 + along + pw, y1, pz + ph, pm);
          else v.paint(x1 - 1, y0 + along, pz, x1, y0 + along + pw, pz + ph, pm);
        }
      if (t.junk) {
        const j = t.junk;
        // the block sticks out two voxels, with a light band across its top
        if (j.face === '+x') {
          v.box(x1, y0 + j.at, j.z, x1 + 2, y0 + j.at + j.w, j.z + j.h, j.m);
          if (j.stripe) v.box(x1, y0 + j.at, j.z + j.h - 2, x1 + 2, y0 + j.at + j.w, j.z + j.h - 1, j.stripe);
        } else {
          v.box(x0 + j.at, y1, j.z, x0 + j.at + j.w, y1 + 2, j.z + j.h, j.m);
          if (j.stripe) v.box(x0 + j.at, y1, j.z + j.h - 2, x0 + j.at + j.w, y1 + 2, j.z + j.h - 1, j.stripe);
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

    // ---- the golden crown on a pink cap: a gold ring whose walls rise into points with glowing tips (five points
    // in the silhouette), pink and cyan jewels on the band, a glowing orb on a stem at the heart
    const top = TIERS[TIERS.length - 1];
    const cz = top.z1;
    v.box(CX - 8, CY - 8, cz, CX + 8, CY + 8, cz + 2, M.pink); // cap
    v.paint(CX - 8, CY - 8, cz, CX + 8, CY + 8, cz + 1, M.pinkD);
    v.box(CX - 5, CY - 5, cz + 2, CX + 5, CY + 5, cz + 4, M.pinkD); // cushion inside the ring
    const R = 7; // the ring spans CX-R..CX+R, two voxels thick
    const glow = on ? M.yellowLit : M.yellow;
    const CORNER = [9, 3, 0]; // height above the band by distance from a point's centre
    const MID = [5, 1, 0];
    for (let t = 0; t < 2 * R; t++) {
      // points at the back, left and right corners and in the middle of the two front walls; the front corner
      // stays low so the orb shows through the notch
      const near = Math.floor(Math.abs(t - 0.5)); // distance from the wall's far corner
      const end = Math.floor(Math.abs(t - (2 * R - 1.5))); // distance from its other corner
      const mid = Math.floor(Math.abs(t - (R - 0.5)));
      for (const [x, y, front] of [
        [CX - R, CY - R + t, false], // back wall (−x), seen from inside: darker gold
        [CX - R + t, CY - R, false], // back wall (−y)
        [CX - R + t, CY + R - 2, true], // front-left wall (+y)
        [CX + R - 2, CY - R + t, true], // front-right wall (+x)
      ] as const) {
        const h = front ? Math.max(CORNER[Math.min(2, near)], MID[Math.min(2, mid)]) : CORNER[Math.min(2, Math.min(near, end))];
        const zt = cz + 6 + h;
        v.box(x, y, cz + 2, x + 2, y + 2, zt, front ? M.yellow : M.orange);
        if (h >= 6) v.box(x, y, zt - 2, x + 2, y + 2, zt, glow);
      }
    }
    v.paint(CX - R, CY + R - 2, cz + 2, CX + R, CY + R, cz + 3, M.orange); // darker rim at the foot of the band
    v.paint(CX + R - 2, CY - R, cz + 2, CX + R, CY + R, cz + 3, M.orange);
    // jewels on the two visible faces: pink either side, cyan in the middle
    for (const g of [-5, 3]) {
      v.box(CX + g, CY + R - 1, cz + 3, CX + g + 2, CY + R, cz + 5, on ? M.pinkLit : M.pinkD);
      v.box(CX + R - 1, CY + g, cz + 3, CX + R, CY + g + 2, cz + 5, on ? M.pinkLit : M.pinkD);
    }
    v.box(CX - 1, CY + R - 1, cz + 3, CX + 1, CY + R, cz + 5, on ? M.cyanLit : M.cyanD);
    v.box(CX + R - 1, CY - 1, cz + 3, CX + R, CY + 1, cz + 5, on ? M.cyanLit : M.cyanD);
    // the orb on a stem rising above the front points, a little cross on top
    v.box(CX - 1, CY - 1, cz + 4, CX + 1, CY + 1, cz + 10, M.orange);
    v.sphere(CX, CY, cz + 12, 3.2, on ? M.yellowLit : M.orange);
    v.box(CX - 1, CY - 1, cz + 15, CX + 1, CY + 1, cz + 18, M.yellow);
    v.box(CX - 2, CY - 1, cz + 16, CX + 2, CY + 1, cz + 17, M.yellow);
    v.box(CX - 1, CY - 2, cz + 16, CX + 1, CY + 2, cz + 17, M.yellow);
    v.point('light', CX, CY, cz + 18);
    return v;
  },
};
