// Bot Pods (2×2): housing for the citizens. Three rounded capsule homes stacked and staggered (white, pink,
// white) with round porthole windows that light up yellow at night, a capsule elevator at the back-right whose
// cab (with a little bot looking out) rides from the ground to both landings, a roof terrace with a railing, a
// potted tree, a tiny resident bot waving from the roof, a balcony on the top home, a neon heart on the side.
// Frames (12 @ 6 fps): the cab climbs 4 voxels a frame from the ground to the top landing and back; the resident
// waves; two flats switch their lights on and off at different times. Off: cab parked, every light dark, the
// resident asleep (eyes shut).
import { M } from '../palette';
import type { Vox } from '../voxel';
import { footprint, hash, hazardBand, plate } from './common';
import type { BuildingArt } from './common';

// A box with rounded vertical edges (radius r) and a softened top and bottom layer: a capsule home.
function capsule(v: Vox, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, m: number, r = 3): void {
  for (let z = z0; z < z1; z++) {
    const inset = z === z0 || z === z1 - 1 ? 1 : 0;
    const ax = x0 + inset;
    const bx = x1 - inset;
    const ay = y0 + inset;
    const by = y1 - inset;
    for (let y = ay; y < by; y++)
      for (let x = ax; x < bx; x++) {
        const dx = Math.max(0, ax + r - (x + 0.5), x + 0.5 - (bx - r));
        const dy = Math.max(0, ay + r - (y + 0.5), y + 0.5 - (by - r));
        if (dx * dx + dy * dy <= r * r + 0.01) v.set(x, y, z, m);
      }
  }
}

// Round porthole on the +y wall (outer layer y): a 6×6 ring standing one voxel proud with a round 4×4 pane
// flush in it (a recessed pane is half hidden by the ring in the iso view).
function portholeY(v: Vox, y: number, x: number, z: number, ring: number, pane: number): void {
  for (let k = 0; k < 6; k++)
    for (let j = 0; j < 6; j++) {
      const corner = (k === 0 || k === 5) && (j === 0 || j === 5);
      const inner = k >= 1 && k <= 4 && j >= 1 && j <= 4 && !((k === 1 || k === 4) && (j === 1 || j === 4));
      if (!corner) v.set(x + k, y + 1, z + j, inner ? pane : ring);
    }
}

// The same on the +x wall (outer layer x), running along +y from y.
function portholeX(v: Vox, x: number, y: number, z: number, ring: number, pane: number): void {
  for (let k = 0; k < 6; k++)
    for (let j = 0; j < 6; j++) {
      const corner = (k === 0 || k === 5) && (j === 0 || j === 5);
      const inner = k >= 1 && k <= 4 && j >= 1 && j <= 4 && !((k === 1 || k === 4) && (j === 1 || j === 4));
      if (!corner) v.set(x + 1, y + k, z + j, inner ? pane : ring);
    }
}

// A tiny resident bot (5×3 footprint, 9 tall) facing +y: red body, white head with a lime-eyed screen, pink ears.
// wave: 0 = arm down, 1 = arm up; asleep (no power): eyes shut, arm down.
function resident(v: Vox, x: number, y: number, z: number, wave: number, asleep = false): void {
  v.box(x + 1, y, z, x + 4, y + 2, z + 2, M.red);
  v.box(x, y, z + 2, x + 5, y + 3, z + 7, M.white);
  v.box(x, y, z + 2, x + 5, y + 3, z + 3, M.steelL);
  v.box(x, y + 2, z + 3, x + 5, y + 3, z + 6, M.ink);
  const eye = asleep ? M.limeD : M.limeLit;
  const eh = asleep ? 1 : 2;
  v.box(x + 1, y + 2, z + 4, x + 2, y + 3, z + 4 + eh, eye);
  v.box(x + 3, y + 2, z + 4, x + 4, y + 3, z + 4 + eh, eye);
  v.box(x, y + 1, z + 7, x + 1, y + 2, z + 9, M.pink);
  v.box(x + 4, y + 1, z + 7, x + 5, y + 2, z + 9, M.pink);
  // the right arm waves: down by the body, or raised beside the head
  if (wave) v.box(x + 5, y + 1, z + 4, x + 6, y + 2, z + 9, M.steelL);
  else v.box(x + 5, y + 1, z + 1, x + 6, y + 2, z + 4, M.steelL);
}

// Elevator cab floor (voxels above the plate) for each frame: ground, first landing (12), top landing (24), back.
const CAB = [0, 4, 8, 12, 16, 20, 24, 20, 16, 12, 8, 4];

export const pods: BuildingArt = {
  frames: CAB.length,
  fps: 6,
  model(frame, working) {
    const v = footprint(2, 2, 46);
    plate(v);
    const f = working ? frame % CAB.length : 0;
    // windows: lit yellow while powered (a few stay dark); two flats switch their lights on and off
    const lit = (i: number) => (!working ? M.window : hash(i, 7, 11) > 0.25 ? M.yellowLit : M.window);
    const toggle = working && f < 6 ? M.yellowLit : M.window;
    const toggle2 = working && (f + 3) % 12 < 7 ? M.yellowLit : M.window;

    // ---- ground home: big white capsule at the front-left
    capsule(v, 3, 12, 3, 22, 29, 16, M.white, 3);
    v.paint(3, 12, 3, 22, 29, 5, M.pink); // pink skirt
    // front door with a little canopy
    v.box(14, 27, 3, 19, 29, 12, M.pinkD);
    v.box(15, 28, 3, 18, 29, 11, M.ink);
    v.box(15, 28, 3, 18, 29, 10, M.cyanD);
    v.box(16, 28, 7, 17, 29, 9, M.cyanLit);
    v.box(13, 28, 12, 20, 30, 13, M.pink);
    portholeY(v, 27, 5, 6, M.pink, toggle2);
    // right wall: a neon heart sign
    const HEART = ['.##...##.', '####.####', '#########', '#########', '.#######.', '..#####..', '...###...', '....#....'];
    HEART.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) if (row[c] === '#') v.set(21, 25 - c, 13 - r, working ? M.pinkLit : M.pinkD);
    });

    // ---- back storage pod (fills the silhouette behind)
    capsule(v, 3, 3, 3, 16, 13, 14, M.pinkD, 2);

    // ---- middle home: pink capsule over the back half, terrace in front of it
    capsule(v, 4, 4, 15, 22, 21, 27, M.pink, 3);
    v.paint(4, 4, 15, 22, 21, 17, M.pinkD);
    portholeY(v, 19, 6, 18, M.white, lit(1));
    portholeY(v, 19, 13, 18, M.white, toggle);
    portholeX(v, 20, 13, 18, M.white, lit(2));
    // terrace on the ground home's roof: white railing along the front and right edges
    v.box(4, 27, 16, 21, 28, 17, M.steelL);
    v.box(4, 27, 17, 21, 28, 18, M.white);
    v.box(20, 21, 16, 21, 28, 17, M.steelL);
    v.box(20, 21, 17, 21, 28, 18, M.white);
    // a potted tree and a deck chair
    v.box(5, 22, 16, 9, 26, 19, M.orange);
    v.box(5, 22, 18, 9, 26, 19, M.rustD);
    v.box(6, 23, 19, 8, 25, 21, M.rustD);
    v.sphere(7, 24, 24, 3.6, M.green, 0.9);
    v.sphere(6.5, 25, 25, 2, M.greenL);
    v.box(16, 22, 16, 20, 25, 17, M.cyanD);
    v.box(16, 22, 17, 17, 25, 20, M.cyanD);

    // ---- top home: small white capsule, offset towards the front-right
    capsule(v, 8, 6, 27, 21, 18, 37, M.white, 3);
    v.paint(8, 6, 27, 21, 18, 28, M.pink);
    portholeY(v, 16, 11, 29, M.pink, lit(3));
    portholeX(v, 19, 11, 29, M.pink, lit(4));
    // roof: a little dome hatch and a dish
    v.sphere(12, 10, 37, 2.6, M.steelL, 0.8);
    v.box(16, 11, 37, 18, 13, 39, M.steel);
    v.cylZ(17, 12, 2.6, 39, 40, M.white);
    v.box(16, 11, 40, 18, 13, 41, M.pink);
    // a resident on the roof, waving at the street
    resident(v, 9, 13, 37, working ? f % 2 : 0, !working);
    // balcony in front of the top home, on the pink roof: a white railing and a flower box
    v.box(9, 19, 27, 20, 20, 28, M.steelL);
    v.box(9, 19, 28, 20, 20, 29, M.white);
    v.box(16, 18, 27, 19, 19, 29, M.orange);
    v.box(16, 18, 29, 19, 19, 30, M.greenL);
    v.box(17, 18, 30, 18, 19, 31, M.pink);

    // ---- capsule elevator at the back-right: a rack column with a glass-bubble cab riding up and down
    v.box(25, 3, 3, 29, 6, 41, M.steelD); // column
    for (let z = 5; z < 40; z += 3) v.box(26, 5, z, 28, 6, z + 1, M.steelL); // rack teeth
    v.box(29, 3, 3, 30, 6, 41, M.steel);
    v.box(23, 2, 40, 30, 8, 44, M.pink); // machine house
    v.box(23, 7, 41, 30, 8, 43, M.pinkD);
    v.box(24, 3, 44, 29, 7, 45, M.white);
    // hazard-striped pit on the plate where the cab touches down
    hazardBand(v, 22, 4, 2, 31, 13, 3);
    // landings from the homes
    for (const [z, x] of [
      [15, 21],
      [27, 20],
    ]) {
      v.box(x, 6, z, 25, 11, z + 1, M.steel);
      v.box(x, 7, z + 1, x + 1, 10, z + 7, M.ink); // door
      v.box(x, 8, z + 1, x + 1, 9, z + 6, M.cyanD);
    }
    // the cab
    // the cab, with a bot passenger looking out of its front window
    const cz = 3 + CAB[f];
    const win = working ? M.cyanLit : M.window;
    capsule(v, 22, 5, cz, 30, 12, cz + 8, M.white, 2);
    v.paint(22, 5, cz, 30, 12, cz + 1, M.pinkD);
    v.paint(22, 5, cz + 7, 30, 12, cz + 8, M.pink);
    v.box(29, 7, cz + 2, 30, 10, cz + 6, win);
    v.box(23, 11, cz + 2, 29, 12, cz + 6, working ? M.screen : M.window);
    if (working) {
      v.box(24, 11, cz + 3, 25, 12, cz + 5, M.limeLit);
      v.box(27, 11, cz + 3, 28, 12, cz + 5, M.limeLit);
    }

    // front-right yard: a flower bed
    v.box(24, 23, 3, 30, 30, 5, M.concrete);
    v.box(25, 24, 5, 29, 29, 6, M.greenD);
    v.sphere(26.5, 25.5, 6, 1.8, M.green);
    v.box(27, 26, 6, 29, 29, 8, M.green);
    v.box(25, 27, 6, 26, 28, 8, M.pink);
    v.box(28, 24, 7, 29, 25, 8, M.yellow);
    return v;
  },
};
