// Fix-It Lab (2×2): an L-shaped white workshop on a dark base wrapped around an open repair bay on the front
// corner. In the bay an orange robotic arm welds a bot (white head, pink ears, lime eyes) on a lift pad in front of
// the garage door. The shop front has a pink and white striped awning under a big cyan diagnostic screen, the
// right wall a neon wrench sign, and the roof a big monitor with a heartbeat trace that runs while the lab works.
import { M } from '../palette';
import type { Vox } from '../voxel';
import { footprint, hazardBand, plate } from './common';
import type { BuildingArt } from './common';

type P = [number, number, number];

// A chunky straight segment: an s×s×s brush swept from a to b.
function seg(v: Vox, a: P, b: P, s: number, m: number): void {
  const n = Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), Math.abs(b[2] - a[2])) * 2) + 1;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = Math.round(a[0] + (b[0] - a[0]) * t);
    const y = Math.round(a[1] + (b[1] - a[1]) * t);
    const z = Math.round(a[2] + (b[2] - a[2]) * t);
    v.box(x, y, z, x + s, y + s, z + s, m);
  }
}

// The bot under repair, like bot.ts: red body, white cube head, dark face screen with lime eyes, pink ears.
// (x0, y0, z0) is the back-bottom corner of the 8×8×7 head; the face looks towards +y.
function patient(v: Vox, x0: number, y0: number, z0: number, eyes: number): void {
  v.box(x0 + 2, y0 + 2, z0 - 2, x0 + 6, y0 + 6, z0, M.red);
  v.box(x0, y0, z0, x0 + 8, y0 + 8, z0 + 7, M.white);
  v.box(x0, y0, z0, x0 + 8, y0 + 8, z0 + 1, M.steelL);
  v.box(x0 + 1, y0 + 8, z0 + 2, x0 + 7, y0 + 9, z0 + 6, M.ink);
  v.box(x0 + 2, y0 + 8, z0 + 3, x0 + 3, y0 + 9, z0 + 5, eyes);
  v.box(x0 + 5, y0 + 8, z0 + 3, x0 + 6, y0 + 9, z0 + 5, eyes);
  v.box(x0, y0 + 3, z0 + 7, x0 + 2, y0 + 5, z0 + 10, M.pink);
  v.box(x0 + 6, y0 + 3, z0 + 7, x0 + 8, y0 + 5, z0 + 10, M.pink);
}

// The wrench sign glyph (6 wide, 11 tall, 2-voxel strokes), top row first: open jaw on top, ring at the bottom.
const WRENCH = ['##..##', '##..##', '######', '.####.', '..##..', '..##..', '..##..', '..##..', '.####.', '.#..#.', '.####.'];

export const fixlab: BuildingArt = {
  frames: 4,
  fps: 6,
  model(frame, working) {
    const f = working ? frame % 4 : 0;
    const v = footprint(2, 2, 37);
    plate(v);
    const H = 21; // roof level
    // the L: back block and left wing, white walls on a dark base, white roof with a light rim
    const blocks: [number, number, number, number][] = [
      [3, 3, 29, 14],
      [3, 14, 14, 29],
    ];
    for (const [x0, y0, x1, y1] of blocks) {
      v.box(x0, y0, 3, x1, y1, H, M.white);
      v.paint(x0, y0, 3, x1, y1, 6, M.dark);
      v.paint(x0, y0, 6, x1, y1, 7, M.steelL);
      v.box(x0, y0, H, x1, y1, H + 1, M.steelL);
    }
    v.box(4, 4, H, 28, 13, H + 1, M.white);
    v.box(4, 4, H, 13, 28, H + 1, M.white);
    // repair bay floor with hazard edges on the open sides
    v.box(14, 14, 3, 30, 30, 4, M.dark);
    hazardBand(v, 14, 29, 3, 30, 30, 4);
    hazardBand(v, 29, 14, 3, 30, 29, 4);
    // garage door in the back block (facing the bay): dark recess, door rolled up
    v.clear(16, 11, 4, 28, 14, 15);
    v.box(16, 10, 4, 28, 11, 15, M.ink);
    v.box(16, 11, 3, 28, 14, 4, M.dark);
    v.box(16, 11, 13, 28, 14, 15, M.steelL);
    v.paint(16, 11, 14, 28, 14, 15, M.steel);
    v.box(18, 10, 7, 21, 11, 11, working ? M.cyanLit : M.window); // a screen inside
    // diagnostic screens on the left wing's bay wall: bars that flicker while working
    for (let i = 0; i < 3; i++) {
      const y0 = 15 + i * 4;
      v.box(13, y0, 9, 14, y0 + 4, 17, M.ink);
      const lit = working && (i + f) % 3 !== 0;
      v.box(13, y0 + 1, 10, 14, y0 + 3, 16, lit ? M.cyanLit : working ? M.screen : M.window);
    }
    // shop front (left wing, front-left wall): door and window under a striped awning, big screen above
    v.box(5, 28, 3, 9, 29, 11, M.ink);
    v.box(6, 28, 3, 8, 29, 10, working ? M.cyanLit : M.window);
    v.box(10, 28, 6, 13, 29, 11, M.window);
    for (let k = 0; k < 3; k++)
      for (let x = 3; x < 14; x++) v.set(x, 29 + k, 12 - (k === 2 ? 1 : 0), Math.floor((x - 3) / 2) % 2 ? M.white : M.pink);
    v.box(4, 28, 13, 13, 29, 20, M.ink);
    v.box(5, 28, 14, 12, 29, 19, working ? M.screen : M.window);
    if (working)
      for (let r = 0; r < 3; r++) {
        const len = 2 + ((r * 2 + f * 3) % 5);
        v.box(6, 28, 17 - r * 2, 6 + len, 29, 18 - r * 2, M.cyanLit);
      }
    // right wall: neon wrench sign and a window
    v.box(28, 3, 8, 29, 11, 21, M.ink);
    v.box(28, 4, 9, 29, 10, 20, M.navy);
    WRENCH.forEach((row, r) => {
      for (let c = 0; c < 6; c++) if (row[c] === '#') v.set(28, 9 - c, 19 - r, working ? M.yellowLit : M.yellow);
    });
    // lift pad (its ring glows while working) and the bot
    v.cylZ(22, 22, 5.2, 3, 5, M.steel);
    v.cylZ(22, 22, 5.2, 4, 5, working ? M.cyanLit : M.cyanD, 4);
    patient(v, 18, 18, 7, working ? M.limeLit : M.limeD);
    v.box(25, 21, 9, 26, 24, 12, M.ink); // its side hatch is open
    v.box(25, 22, 10, 26, 23, 11, M.orange);
    // orange robotic arm on the bay's back-right corner: the welding torch circles over the bot's head
    const tips: P[] = [
      [21, 20, 15],
      [23, 22, 15],
      [21, 24, 15],
      [20, 22, 15],
    ];
    const tip = tips[f];
    v.box(24, 14, 3, 29, 19, 5, M.steelD);
    v.cylZ(26.5, 16.5, 2.2, 5, 6, M.yellow);
    v.box(25, 15, 6, 28, 18, 8, M.steelD); // shoulder
    const elbow: P = [24, 17, 18 + (f % 2)];
    seg(v, [26, 16, 8], elbow, 2, M.orange);
    v.box(elbow[0] - 1, elbow[1] - 1, elbow[2], elbow[0] + 2, elbow[1] + 2, elbow[2] + 3, M.steelD);
    const wrist: P = [tip[0] + 1, tip[1] - 1, tip[2] + 3];
    seg(v, [elbow[0], elbow[1], elbow[2] + 1], wrist, 2, M.orange);
    v.box(wrist[0] - 1, wrist[1], wrist[2] - 1, wrist[0] + 1, wrist[1] + 2, wrist[2] + 1, M.steelD); // torch head
    v.box(tip[0], tip[1], tip[2] + 1, tip[0] + 1, tip[1] + 1, wrist[2] - 1, M.steelL); // nozzle
    if (working) v.set(tip[0], tip[1], tip[2], f % 2 ? M.fire : M.yellowLit);
    v.point('spark', 21.5, 22.5, 15);
    // roof: a diagnostic monitor whose heartbeat runs 4 voxels per frame, and a skylight on the left wing
    v.box(12, 6, H + 1, 14, 8, H + 3, M.steelD);
    v.box(22, 6, H + 1, 24, 8, H + 3, M.steelD);
    v.box(9, 5, H + 3, 27, 8, H + 14, M.steelD);
    v.box(9, 5, H + 14, 27, 9, H + 15, M.yellow);
    v.box(9, 8, H + 3, 27, 9, H + 14, M.ink);
    v.box(10, 8, H + 4, 26, 9, H + 13, working ? M.screen : M.window);
    if (working) {
      v.box(10, 8, H + 7, 26, 9, H + 8, M.cyanLit);
      const sx = 11 + f * 4;
      v.box(sx, 8, H + 8, sx + 2, 9, H + 12, M.limeLit);
      v.box(sx + 2, 8, H + 5, sx + 3, 9, H + 7, M.limeLit);
    }
    v.box(5, 16, H + 1, 12, 25, H + 2, M.steelL);
    v.box(6, 17, H + 1, 11, 24, H + 2, M.glass);
    return v;
  },
};
