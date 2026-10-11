// Purifier (2×2): a slender white tank tower (rounded, about 2.5 times as tall as it is wide, as in the reference
// sheet) on a wide pedestal, with glowing cyan bands, a sight-glass on each visible face and a blue cap carrying a
// fan; a round short tank topped by the droplet logo; pipes between them and a vented filter unit in front. While
// working the fan spins, a pulse of light climbs the bands, the water rises in the sight-glasses and the drop glows.
import { M } from '../palette';
import { footprint, plate, tank } from './common';
import type { BuildingArt } from './common';

export const purifier: BuildingArt = {
  frames: 4,
  fps: 6,
  model(frame, working) {
    const f = working ? frame % 4 : 0;
    const v = footprint(2, 2, 50);
    plate(v);
    // the tall tank: a wide pedestal with a white shoulder, then the slender column
    const tx = 20;
    const ty = 12;
    const tr = 6.5;
    tank(v, tx, ty, tr + 1.5, 3, 15, M.white);
    tank(v, tx, ty, tr + 2.1, 3, 5, M.cyanD);
    tank(v, tx, ty, tr + 2, 15, 16, M.steelL);
    tank(v, tx, ty, tr, 16, 41, M.white);
    // glowing bands: a pulse of light climbs them while working
    const bands: [number, number][] = [
      [8, tr + 1.5],
      [19, tr],
      [34, tr],
    ];
    bands.forEach(([z, r], k) => {
      const m = working ? (f === k || f === 3 ? M.cyanLit : M.screen) : M.cyanD;
      tank(v, tx, ty, r + 0.6, z, z + 2, m, r - 1);
    });
    // a sight-glass gauge on each visible face of the column: the water climbs 2 voxels per frame while working
    const level = working ? 24 + f * 2 : 25;
    const water = working ? M.cyanLit : M.cyanD;
    v.box(tx - 2, ty + 6, 21, tx + 2, ty + 7, 33, M.ink);
    v.box(tx + 6, ty - 2, 21, tx + 7, ty + 2, 33, M.ink);
    v.box(tx - 1, ty + 6, 22, tx + 1, ty + 7, 32, M.window);
    v.box(tx + 6, ty - 1, 22, tx + 7, ty + 1, 32, M.window);
    v.box(tx - 1, ty + 6, 31, tx, ty + 7, 32, M.glass); // a glint at the top of the empty tube
    v.box(tx + 6, ty - 1, 31, tx + 7, ty, 32, M.glass);
    v.box(tx - 1, ty + 6, 22, tx + 1, ty + 7, level, water);
    v.box(tx + 6, ty - 1, 22, tx + 7, ty + 1, level, water);
    // blue cap with the fan housing
    tank(v, tx, ty, tr + 0.6, 41, 43, M.blueD);
    tank(v, tx, ty, tr, 43, 45, M.blue);
    v.cylZ(tx, ty, 6.1, 45, 47, M.steelD, 4.9);
    v.cylZ(tx, ty, 5.1, 44, 45, M.ink);
    // four fan blades, a quarter of a turn every four frames
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2 + (f * Math.PI) / 8;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      for (let y = ty - 6; y < ty + 6; y++)
        for (let x = tx - 6; x < tx + 6; x++) {
          const dx = x + 0.5 - tx;
          const dy = y + 0.5 - ty;
          const t = dx * ca + dy * sa;
          const n = -dx * sa + dy * ca;
          if (t > 0.8 && t < 4.9 && n > -0.6 && n < 1.4) v.set(x, y, 45, M.steelL);
        }
    }
    v.box(tx - 1, ty - 1, 45, tx + 1, ty + 1, 46, M.white);
    // beacon on the housing rim
    v.box(tx + 3, ty - 5, 47, tx + 4, ty - 4, 49, working ? M.redLit : M.red);
    v.point('light', tx + 3.5, ty - 4.5, 49);
    // the round short tank with a cyan dome
    const sx = 9.5;
    const sy = 22.5;
    tank(v, sx, sy, 5.6, 3, 21, M.white, -1, 4);
    tank(v, sx, sy, 6.2, 3, 5, M.cyanD, -1, 4);
    tank(v, sx, sy, 6.2, 12, 14, working ? M.cyanLit : M.cyanD, 4.5, 4);
    tank(v, sx, sy, 6.2, 21, 22, M.steelL, -1, 4);
    v.sphere(sx, sy, 21.5, 4.8, M.cyanD, 0.4);
    // the droplet logo standing on top: a ball with a concave taper to a sharp tip, glowing while working
    const drop = working ? M.cyanLit : M.cyanD;
    v.sphere(sx, sy, 26.5, 3.6, drop);
    [3.2, 2.7, 2.2, 1.8, 1.4, 1.1, 0.8, 0.6].forEach((r, k) => v.cylZ(sx, sy, r, 28 + k, 29 + k, drop));
    v.paint(8, 24, 27, 10, 26, 30, M.white);
    // pipes from the short tank to the tall one
    v.cylX(22.5, 16.5, 1.2, 14, 22, M.steelL);
    v.cylY(20.5, 16.5, 1.2, 18, 24, M.steelL);
    v.cylX(22.5, 16.5, 1.7, 16, 17, M.cyanD);
    v.cylY(20.5, 16.5, 1.7, 21, 22, M.cyanD);
    // filter unit on the front corner: vents on both visible sides
    v.box(22, 22, 3, 30, 30, 12, M.white);
    v.paint(22, 22, 3, 30, 30, 5, M.cyanD);
    v.box(21, 21, 12, 31, 31, 13, M.steelL);
    for (let z = 6; z < 11; z += 2) {
      v.box(23, 29, z, 29, 30, z + 1, M.ink);
      v.box(29, 23, z, 30, 29, z + 1, M.ink);
    }
    v.box(24, 24, 13, 28, 28, 14, M.steelD);
    v.box(25, 25, 13, 27, 27, 15, working ? M.cyanLit : M.cyanD);
    v.cylY(26.5, 8.5, 1.2, 18, 22, M.steelL);
    // shrubs: the air around the purifier is clean
    v.sphere(18, 28, 5, 2.4, M.green);
    v.sphere(29, 3.5, 5, 2.2, M.green);
    v.paint(16, 26, 7, 21, 31, 8, M.greenL);
    v.paint(27, 1, 7, 32, 6, 8, M.greenL);
    return v;
  },
};
