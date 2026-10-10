// Bot Pods (2×2): housing for the citizens. Three rounded capsule homes stacked and staggered (white, pink,
// white) with round porthole windows that light up yellow at night, a glass elevator on the right whose pink
// cab rides between the floors, a roof terrace with a railing and a potted tree, a neon heart on the side.
import { M } from '../palette';
import type { Vox } from '../voxel';
import { footprint, hash, plate } from './common';
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

// Round porthole on the +y wall (outer layer y): a 6×6 ring sticking out one voxel, a 4×4 round pane.
function portholeY(v: Vox, y: number, x: number, z: number, ring: number, pane: number): void {
  for (let k = 0; k < 6; k++)
    for (let j = 0; j < 6; j++) {
      const corner = (k === 0 || k === 5) && (j === 0 || j === 5);
      if (!corner) v.set(x + k, y + 1, z + j, ring);
    }
  for (let k = 1; k < 5; k++)
    for (let j = 1; j < 5; j++) {
      const corner = (k === 1 || k === 4) && (j === 1 || j === 4);
      if (!corner) {
        v.set(x + k, y + 1, z + j, 0);
        v.set(x + k, y, z + j, pane);
      }
    }
}

// The same on the +x wall (outer layer x), running along +y from y.
function portholeX(v: Vox, x: number, y: number, z: number, ring: number, pane: number): void {
  for (let k = 0; k < 6; k++)
    for (let j = 0; j < 6; j++) {
      const corner = (k === 0 || k === 5) && (j === 0 || j === 5);
      if (!corner) v.set(x + 1, y + k, z + j, ring);
    }
  for (let k = 1; k < 5; k++)
    for (let j = 1; j < 5; j++) {
      const corner = (k === 1 || k === 4) && (j === 1 || j === 4);
      if (!corner) {
        v.set(x + 1, y + k, z + j, 0);
        v.set(x, y + k, z + j, pane);
      }
    }
}

// Elevator cab height (voxels above the plate) for each of the 8 frames: waits, rides up, waits, rides down.
const CAB = [0, 0, 4, 8, 12, 12, 8, 4];

export const pods: BuildingArt = {
  frames: 8,
  fps: 5,
  model(frame, working) {
    const v = footprint(2, 2, 44);
    plate(v);
    const f = working ? frame % 8 : 0;
    // windows: lit yellow while powered (a few stay dark), one flat switches its light on and off
    const lit = (i: number) => (!working ? M.window : hash(i, 7, 11) > 0.25 ? M.yellowLit : M.window);
    const toggle = working && f < 4 ? M.yellowLit : M.window;

    // ---- ground home: big white capsule at the front-left
    capsule(v, 3, 12, 3, 22, 29, 16, M.white, 3);
    v.paint(3, 12, 3, 22, 29, 5, M.pink); // pink skirt
    // front door with a little canopy
    v.box(14, 27, 3, 19, 29, 12, M.pinkD);
    v.box(15, 28, 3, 18, 29, 11, M.ink);
    v.box(15, 28, 3, 18, 29, 10, M.cyanD);
    v.box(16, 28, 7, 17, 29, 9, M.cyanLit);
    v.box(13, 28, 12, 20, 30, 13, M.pink);
    portholeY(v, 27, 5, 6, M.pink, lit(0));
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
    portholeX(v, 20, 6, 18, M.white, lit(2));
    // terrace on the ground home's roof: white railing along the front and right edges
    v.box(4, 27, 16, 21, 28, 18, M.steelL);
    v.box(4, 27, 18, 21, 28, 19, M.white);
    v.box(20, 21, 16, 21, 28, 18, M.steelL);
    v.box(20, 21, 18, 21, 28, 19, M.white);
    // a potted tree and a deck chair
    v.box(5, 22, 16, 9, 26, 19, M.orange);
    v.box(5, 22, 18, 9, 26, 19, M.rustD);
    v.box(6, 23, 19, 8, 25, 21, M.rustD);
    v.sphere(7, 24, 24, 3.6, M.green, 0.9);
    v.sphere(6.5, 25, 25, 2, M.greenL);
    v.box(13, 22, 16, 18, 25, 17, M.cyanD);
    v.box(13, 22, 17, 14, 25, 20, M.cyanD);

    // ---- top home: small white capsule, offset towards the front-right
    capsule(v, 8, 6, 27, 21, 18, 37, M.white, 3);
    v.paint(8, 6, 27, 21, 18, 28, M.pink);
    portholeY(v, 16, 11, 29, M.pink, lit(3));
    portholeX(v, 19, 9, 29, M.pink, lit(4));
    // roof: a little dome hatch and a dish
    v.sphere(12, 10, 37, 2.6, M.steelL, 0.8);
    v.box(16, 11, 37, 18, 13, 39, M.steel);
    v.cylZ(17, 12, 2.6, 39, 40, M.white);
    v.box(16, 11, 40, 18, 13, 41, M.pink);

    // ---- capsule elevator at the back-right: a rack column with a glass-bubble cab riding up and down
    v.box(25, 3, 3, 29, 6, 41, M.steelD); // column
    for (let z = 5; z < 40; z += 3) v.box(26, 5, z, 28, 6, z + 1, M.steelL); // rack teeth
    v.box(29, 3, 3, 30, 6, 41, M.steel);
    v.box(23, 2, 40, 30, 8, 44, M.pink); // machine house
    v.box(23, 7, 41, 30, 8, 43, M.pinkD);
    v.box(24, 3, 44, 29, 7, 45, M.white);
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
    const cz = 4 + CAB[f];
    const win = working ? M.cyanLit : M.window;
    capsule(v, 22, 5, cz, 30, 12, cz + 8, M.white, 2);
    v.paint(22, 5, cz, 30, 12, cz + 1, M.pinkD);
    v.paint(22, 5, cz + 7, 30, 12, cz + 8, M.pink);
    v.box(29, 7, cz + 2, 30, 10, cz + 6, win);
    v.box(24, 11, cz + 2, 28, 12, cz + 6, win);

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
