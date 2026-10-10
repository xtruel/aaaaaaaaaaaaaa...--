// Recycling HQ (3×3): dark block with a white upper floor, the bot's pink ears on the roof, the bot face on a
// big screen over the entrance, a pink 2PM sign on the side, radar and antenna.
import { M } from '../palette';
import { bollards, botFaceY, footprint, hash, plate, windowsX, windowsY } from './common';
import type { BuildingArt } from './common';

export const hq: BuildingArt = {
  frames: 4,
  fps: 2,
  model(frame) {
    const v = footprint(3, 3, 64);
    plate(v);
    bollards(v, 3);
    // ground floor: dark block with a lighter plinth
    v.box(5, 5, 3, 43, 41, 26, M.dark);
    v.paint(5, 5, 3, 43, 41, 5, M.darkL);
    // pink trim at the top of the ground floor
    v.box(4, 4, 24, 44, 42, 26, M.pink);
    v.paint(4, 4, 25, 44, 42, 26, M.pinkD);
    // entrance porch on the front-left wall
    v.box(18, 40, 3, 30, 43, 15, M.steel);
    v.box(20, 41, 3, 28, 43, 12, M.ink);
    v.box(21, 42, 3, 27, 43, 11, M.cyanLit);
    v.box(23, 42, 3, 25, 43, 11, M.screen);
    v.box(17, 40, 15, 31, 44, 16, M.steelL); // canopy
    // big screen with the bot face over the entrance
    botFaceY(v, 41, 15, 33, 16, 24, frame === 2);
    // windows either side
    const lit = (i: number, j: number) => (hash(i, j, 3) > 0.35 ? M.yellowLit : M.window);
    windowsY(v, 40, 7, 15, 8, 23, 4, 6, 2, 3, lit);
    windowsY(v, 40, 34, 42, 8, 23, 4, 6, 2, 3, (i, j) => lit(i + 5, j));
    // right wall: 2PM sign panel
    v.box(43, 11, 9, 45, 35, 21, M.pink);
    v.box(44, 12, 10, 45, 34, 20, M.pinkD);
    v.text('2PM', '+x', 44, 28, 17, M.white, true);
    windowsX(v, 42, 7, 11, 8, 23, 4, 6, 2, 3, (i, j) => lit(i + 9, j));
    windowsX(v, 42, 36, 40, 8, 23, 4, 6, 2, 3, (i, j) => lit(i + 13, j));
    // upper floor: white with a pink band and a strip of cyan windows
    v.box(9, 8, 26, 39, 37, 39, M.white);
    v.paint(9, 8, 35, 39, 37, 37, M.pink);
    for (let x = 11; x < 37; x += 3) v.box(x, 36, 29, x + 2, 37, 33, M.cyanLit);
    for (let y = 10; y < 35; y += 3) v.box(38, y, 29, 39, y + 2, 33, M.cyanLit);
    v.box(8, 7, 39, 40, 38, 40, M.steelL); // roof slab
    v.box(10, 9, 40, 38, 36, 41, M.steel);
    // the ears: pink outside, white inside, like USA-9
    for (const x of [14, 28]) {
      v.box(x, 18, 41, x + 6, 25, 57, M.pink);
      v.box(x + 1, 24, 43, x + 5, 25, 55, M.white);
      v.box(x, 18, 57, x + 6, 25, 58, M.pinkD);
    }
    // radar on the back-right corner, turning
    v.box(34, 10, 41, 36, 12, 46, M.steelL);
    const dirs: [number, number][] = [
      [1, 0],
      [1, 1],
      [0, 1],
      [-1, 1],
    ];
    const [dx, dy] = dirs[frame % 4];
    for (let k = -4; k <= 4; k++) v.box(35 + dx * k, 11 + dy * k, 46, 36 + dx * k, 12 + dy * k, 47, M.white);
    // antenna with a red light
    v.box(11, 10, 41, 12, 11, 62, M.steelL);
    v.box(10, 9, 61, 13, 12, 64, M.redLit);
    v.point('light', 11.5, 10.5, 63);
    // pipes down the back-right corner
    v.cylZ(43.5, 7.5, 1.5, 3, 26, M.steelL);
    v.cylY(43.5, 6.5, 1.2, 5, 42, M.steelD);
    return v;
  },
};
