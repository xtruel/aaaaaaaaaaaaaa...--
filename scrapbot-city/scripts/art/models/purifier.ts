// Purifier (2×2): a tall white tank (rounded square, as in the reference sheet) with glowing cyan bands, tall
// windows and a blue cap carrying a big fan; a round short tank topped by the droplet logo; pipes between them and
// a vented filter unit in front. While working the fan spins, a pulse of light climbs the bands and the droplet glows.
import { M } from '../palette';
import type { Vox } from '../voxel';
import { footprint, plate } from './common';
import type { BuildingArt } from './common';

// A rounded tank: a squircle prism (|dx|^p + |dy|^p <= r^p) centred on (cx, cy). p = 6 gives flat walls that
// read clean and white in the iso light, with rounded corners; p = 2 is a plain cylinder. 'inner' > 0 keeps only
// the shell outside that radius.
function tank(v: Vox, cx: number, cy: number, r: number, z0: number, z1: number, m: number, inner = -1, p = 6): void {
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++)
    for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
      const d = Math.abs(x + 0.5 - cx) ** p + Math.abs(y + 0.5 - cy) ** p;
      if (d <= r ** p && (inner < 0 || d > inner ** p)) for (let z = z0; z < z1; z++) v.set(x, y, z, m);
    }
}

export const purifier: BuildingArt = {
  frames: 4,
  fps: 6,
  model(frame, working) {
    const f = working ? frame % 4 : 0;
    const v = footprint(2, 2, 46);
    plate(v);
    // the tall tank: a wide base with a white shoulder, then the narrower column
    const tx = 20;
    const ty = 12;
    const tr = 7.5;
    tank(v, tx, ty, tr + 1.5, 3, 15, M.white);
    tank(v, tx, ty, tr + 2.1, 3, 5, M.cyanD);
    tank(v, tx, ty, tr + 2, 15, 16, M.steelL);
    tank(v, tx, ty, tr, 16, 37, M.white);
    // glowing bands: a pulse of light climbs them while working
    const bands: [number, number][] = [
      [8, tr + 1.5],
      [19, tr],
      [31, tr],
    ];
    bands.forEach(([z, r], k) => {
      const m = working ? (f === k || f === 3 ? M.cyanLit : M.screen) : M.cyanD;
      tank(v, tx, ty, r + 0.6, z, z + 2, m, r - 1);
    });
    // tall glass windows on both visible faces of the column
    for (const d of [-3, 2]) {
      v.box(tx + d, ty + 7, 22, tx + d + 2, ty + 8, 29, M.ink);
      v.box(tx + 7, ty + d, 22, tx + 8, ty + d + 2, 29, M.ink);
      v.box(tx + d, ty + 7, 23, tx + d + 2, ty + 8, 28, M.glass);
      v.box(tx + 7, ty + d, 23, tx + 8, ty + d + 2, 28, M.glass);
    }
    // blue cap with the fan housing
    tank(v, tx, ty, tr + 0.6, 37, 39, M.blueD);
    tank(v, tx, ty, tr, 39, 41, M.blue);
    v.cylZ(tx, ty, 6.6, 41, 43, M.steelD, 5.4);
    v.cylZ(tx, ty, 5.6, 40, 41, M.ink);
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
          if (t > 0.8 && t < 5.4 && n > -0.6 && n < 1.4) v.set(x, y, 41, M.steelL);
        }
    }
    v.box(tx - 1, ty - 1, 41, tx + 1, ty + 1, 42, M.white);
    // beacon on the housing rim
    v.box(tx + 4, ty - 5, 43, tx + 5, ty - 4, 45, M.redLit);
    v.point('light', tx + 4.5, ty - 4.5, 45);
    // the round short tank with a cyan dome
    const sx = 9.5;
    const sy = 22.5;
    tank(v, sx, sy, 5.6, 3, 21, M.white, -1, 2);
    tank(v, sx, sy, 6.2, 3, 5, M.cyanD, -1, 2);
    tank(v, sx, sy, 6.2, 12, 14, working ? M.cyanLit : M.cyanD, 4.5, 2);
    tank(v, sx, sy, 6.2, 21, 22, M.steelL, -1, 2);
    v.sphere(sx, sy, 21.5, 4.8, M.cyanD, 0.4);
    // the droplet logo standing on top: a ball tapering to a point, glowing while working
    const drop = working ? M.cyanLit : M.sky;
    v.sphere(sx, sy, 26.5, 3.6, drop);
    v.cone(sx, sy, 28, 34, 3.1, 0.5, drop);
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
