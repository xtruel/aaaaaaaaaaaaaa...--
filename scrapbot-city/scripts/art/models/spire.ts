// Scrap Spire (3×3): the monument that ends a city. A tall dark tower of stacked, crooked scrap tiers (each one
// shoved 1-2 voxels off the axis of the one below) with steel skirt plates, glowing magenta windows and pink
// ledges, tapering up to a golden crown. Scrap sticks out of it: a hazard-striped drum bolted to the second tier,
// a crate on the third, a steel crane jib winching a crate up the right side, a radio mast on the left with a red
// beacon, and a vertical neon blade sign. Two annex towers with gold lamps guard its sides; at its foot lie the
// city's offerings: a broken bot head, a tyre and a pink crate. The crown: a gold ring on a pink cap rising into
// points with glowing tips, a cyan jewel in its front notch and a pink gem orb on a stem, a cross on top.
// Frames (4): a band of lamps climbs the tower's three outer edges with an orange tail, the neon sign's stripe
// scrolls up, and the crane winches its crate up 2 voxels a frame. Off: windows, lamps, sign, jewels, gem and
// beacon dark; the crate hangs at the bottom.
import { M } from '../palette';
import type { Vox } from '../voxel';
import { footprint, hash, hazardBand, plate } from './common';
import type { BuildingArt } from './common';

interface Tier {
  z0: number;
  z1: number;
  half: number; // half width around the tower axis
  dx: number; // crooked offset of this tier
  dy: number;
  trim: number; // ledge material at the top
  skipX?: number; // a window left out on the +x wall (scrap is bolted there)
  skipY?: number; // the same on the +y wall
}

const CX = 24;
const CY = 24;

const TIERS: Tier[] = [
  { z0: 6, z1: 30, half: 12, dx: 0, dy: 0, trim: M.pink },
  { z0: 30, z1: 50, half: 10, dx: 2, dy: 0, trim: M.rust, skipX: 1 },
  { z0: 50, z1: 68, half: 9, dx: 0, dy: 2, trim: M.pink, skipY: 0 },
  { z0: 68, z1: 84, half: 8, dx: -1, dy: 1, trim: M.purple },
  { z0: 84, z1: 98, half: 7, dx: 1, dy: 0, trim: M.pink },
  { z0: 98, z1: 106, half: 5, dx: 0, dy: 0, trim: M.pinkD },
];

// the darker underside of each ledge trim
function under(trim: number): number {
  return trim === M.pink ? M.pinkD : trim === M.rust ? M.rustD : trim === M.purple ? M.purpleD : M.dark;
}

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
    const f = on ? frame % 4 : 0;
    // ---- plinth: a dark stepped base with a pink edge
    v.box(5, 5, 3, 43, 43, 6, M.darkL);
    v.box(5, 42, 5, 43, 43, 6, M.pinkD);
    v.box(42, 5, 5, 43, 43, 6, M.pinkD);

    // ---- the tiers
    let lamp = 0; // running lamp counter from the foot of the tower to the top, so the chase never jumps
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
      // a skirt of steel plates bolted round the foot of the tier: one even 2-tall band, 6-voxel plates
      // alternating steel and dark steel with a dark seam between them
      if (t.z1 - t.z0 >= 12) {
        const plates = (n: number, put: (a: number, b: number, m: number) => void) => {
          for (let a = 2, k = 0; a < n - 2; a += 7, k++) {
            put(a, Math.min(n - 2, a + 6), k % 2 ? M.steelD : M.steel);
            if (a + 6 < n - 2) put(a + 6, a + 7, M.dark);
          }
        };
        plates(x1 - x0, (a, b, m) => v.box(x0 + a, y1, t.z0, x0 + b, y1 + 1, t.z0 + 2, m));
        plates(y1 - y0, (a, b, m) => v.box(x1, y0 + a, t.z0, x1 + 1, y0 + b, t.z0 + 2, m));
      }
      // ledge at the top of the tier, one voxel proud, its lower row in the trim's darker shade
      v.box(x0 - 1, y0 - 1, t.z1 - 2, x1 + 1, y1 + 1, t.z1, t.trim);
      v.paint(x0 - 1, y0 - 1, t.z1 - 2, x1 + 1, y1 + 1, t.z1 - 1, under(t.trim));
      // windows: one or two tall glowing windows per visible wall
      const span = x1 - x0;
      const ww = t.half >= 9 ? 4 : t.half >= 7 ? 3 : 2;
      const wh = t.z1 - t.z0 >= 18 ? 9 : t.z1 - t.z0 >= 12 ? 6 : 3;
      const count = t.half >= 9 ? 2 : 1;
      const gap = Math.floor((span - count * ww) / (count + 1));
      const wz = t.z0 + Math.floor((t.z1 - t.z0 - 2 - wh) / 2);
      for (let i = 0; i < count; i++) {
        if (t.skipY !== i) windowY(v, y1 - 1, x0 + gap + i * (ww + gap), wz, ww, wh, on && hash(ti, i, 3) > 0.15);
        if (t.skipX !== i) windowX(v, x1 - 1, y0 + gap + i * (ww + gap), wz, ww, wh, on && hash(ti, i, 4) > 0.15);
      }
      // chase lights on the three outer edges: a lamp every 4 voxels; one band in four is lit yellow with an
      // orange tail below it, and the band climbs one lamp per frame
      for (let z = t.z0 + 1; z + 2 <= t.z1 - 2; z += 4, lamp++) {
        const band = lamp % 4;
        const m = !on ? M.darkL : band === f ? M.yellowLit : band === (f + 3) % 4 ? M.orangeLit : M.darkL;
        v.box(x1 - 1, y1 - 1, z, x1 + 1, y1 + 1, z + 2, m);
        v.box(x0 - 1, y1 - 1, z, x0 + 1, y1 + 1, z + 2, m);
        v.box(x1 - 1, y0 - 1, z, x1 + 1, y0 + 1, z + 2, m);
      }
    });

    // ---- scrap bolted onto the tower
    // tier 1, right wall: a rusty drum lying along the wall with a hazard-striped band, on two steel brackets
    v.box(35, 25, 34, 38, 27, 36, M.steelD);
    v.box(35, 30, 34, 38, 32, 36, M.steelD);
    v.cylY(36, 38.5, 2.6, 24, 33, M.rust);
    v.cylY(36, 38.5, 1.4, 32, 33, M.rustD); // the dark lid on its front end
    hazardBand(v, 36, 24, 38, 39, 33, 40);
    // tier 2, front-left wall: a flat purple crate with a lighter lid band, on a steel bracket
    v.box(17, 35, 55, 25, 37, 59, M.purpleD);
    v.box(17, 35, 58, 25, 37, 59, M.purple);
    v.box(19, 35, 53, 23, 36, 55, M.steelD);

    // ---- neon blade sign standing on tier 1's roof against tier 2's right wall: a pink frame with a cyan stripe
    // whose dark notches scroll upwards
    {
      const sx0 = 33;
      const sx1 = 37;
      const sz0 = 50;
      const sz1 = 64;
      v.box(sx0, 31, sz0, sx1, 33, sz1, on ? M.pinkLit : M.pinkD);
      v.box(sx0, 32, sz0, sx1, 33, sz0 + 1, M.pinkD);
      v.box(sx0, 32, sz1 - 1, sx1, 33, sz1, M.pinkD);
      for (let z = sz0 + 1; z < sz1 - 1; z++) {
        const lit = on && (((z - f) % 4) + 4) % 4 < 2;
        v.box(sx0 + 1, 32, z, sx1 - 1, 33, z + 1, lit ? M.cyanLit : on ? M.cyanD : M.window);
      }
    }

    // ---- crane jib out of tier 3 toward +x, winching a hazard-striped crate up past the right side (2 voxels a
    // frame); it hangs clear of the tower against the sky
    v.box(31, 20, 76, 46, 22, 78, M.steelL);
    v.box(31, 20, 75, 46, 22, 76, M.steelD);
    v.box(31, 20, 78, 34, 22, 80, M.steelD); // counter-weight block at the root
    v.box(43, 20, 73, 46, 22, 75, M.steelD); // pulley block
    {
      const cz = 60 + 2 * f; // crate bottom
      v.box(44, 20, cz + 4, 45, 21, 73, M.steelD); // the cable
      v.box(42, 19, cz, 46, 23, cz + 4, M.yellow);
      hazardBand(v, 42, 19, cz, 46, 23, cz + 3);
      v.box(42, 19, cz + 3, 46, 23, cz + 4, M.steelL);
    }

    // ---- radio mast on tier 3's left corner, a red beacon on top (lit while the city stands)
    v.box(14, 32, 84, 16, 34, 112, M.steelL);
    for (let z = 87; z < 110; z += 5) v.box(14, 32, z, 16, 34, z + 1, M.steelD);
    v.box(12, 32, 104, 18, 34, 106, M.steelL); // cross bar
    v.box(14, 32, 112, 16, 34, 114, on ? M.redLit : M.red);
    v.point('light', 15, 33, 114);

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

    // ---- offerings on the front corner of the plinth: a broken bot head (tipped over, its screen dead or
    // flickering), a tyre lying flat and a small pink crate
    v.box(36, 37, 6, 41, 42, 10, M.white);
    v.box(37, 37, 10, 42, 42, 11, M.white); // the top layer slipped sideways: the head lies askew
    v.box(36, 41, 7, 41, 42, 10, M.ink); // face: a dark frame, the screen and two dead lime eyes
    v.box(38, 41, 7, 39, 42, 10, on ? M.screen : M.window);
    v.box(37, 41, 8, 38, 42, 10, M.limeD);
    v.box(39, 41, 8, 40, 42, 10, M.limeD);
    v.box(37, 37, 11, 39, 39, 12, M.pink); // ears
    v.box(40, 37, 11, 42, 39, 12, M.pink);
    v.cylZ(40, 33.5, 2.5, 6, 8, M.ink, 1.2);
    v.box(32, 38, 6, 35, 41, 9, M.pink);
    v.box(32, 38, 8, 35, 41, 9, M.pinkD);

    // ---- the golden crown on a pink cap: a gold ring whose walls rise into points with glowing tips (five points
    // in the silhouette), pink jewels on the band, a cyan jewel in the front notch, a pink gem orb at the heart
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
    // pink jewels on the two visible faces
    for (const g of [-5, 3]) {
      v.box(CX + g, CY + R - 1, cz + 3, CX + g + 2, CY + R, cz + 5, on ? M.pinkLit : M.pinkD);
      v.box(CX + R - 1, CY + g, cz + 3, CX + R, CY + g + 2, cz + 5, on ? M.pinkLit : M.pinkD);
    }
    // a cyan jewel filling the low front notch
    v.box(CX + R - 3, CY + R - 3, cz + 3, CX + R, CY + R, cz + 6, on ? M.cyanLit : M.cyanD);
    // the pink gem orb on a gold stem rising above the front points, a white glint on it, a cross on top
    v.box(CX - 1, CY - 1, cz + 4, CX + 1, CY + 1, cz + 10, M.yellow);
    v.sphere(CX, CY, cz + 12, 3.2, on ? M.pinkLit : M.pinkD);
    v.paint(CX - 1, CY + 1, cz + 14, CX + 1, CY + 2, cz + 15, M.white); // glint on its upper left (the lit side)
    v.box(CX - 1, CY - 1, cz + 15, CX + 1, CY + 1, cz + 18, M.yellow);
    v.box(CX - 2, CY - 1, cz + 16, CX + 2, CY + 1, cz + 17, M.yellow);
    v.box(CX - 1, CY - 2, cz + 16, CX + 1, CY + 2, cz + 17, M.yellow);
    v.point('light', CX, CY, cz + 18);
    return v;
  },
};
