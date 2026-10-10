// Solar Array (2×2): four blue panels tilted towards the light on stands over a dark gravel bed, a small wind
// turbine rising between them (the rotor turns while working) and a battery bank whose lime bars charge up.
import { M } from '../palette';
import type { Vox } from '../voxel';
import { footprint, plate } from './common';
import type { BuildingArt } from './common';

// A panel tilted to face +y (towards the light): the surface rises one voxel every two towards −y.
function panel(v: Vox, x0: number, y0: number, x1: number, y1: number, z0: number): void {
  const zAt = (y: number) => z0 + Math.floor((y1 - 1 - y) / 2);
  // stands: short posts at the front edge, tall ones at the back
  for (const x of [x0 + 1, x1 - 3]) {
    v.box(x, y1 - 3, 4, x + 2, y1 - 2, zAt(y1 - 3) - 1, M.steelD);
    v.box(x, y0 + 1, 4, x + 2, y0 + 2, zAt(y0 + 1) - 1, M.steelD);
  }
  const mid = Math.floor((x0 + x1) / 2);
  for (let y = y0; y < y1; y++) {
    const z = zAt(y);
    v.box(x0, y, z - 1, x1, y + 1, z, M.steelD); // frame underneath
    for (let x = x0; x < x1; x++) {
      const edge = x === x0 || x === x1 - 1 || y === y0 || y === y1 - 1;
      const shine = x - x0 - (y1 - 1 - y);
      let m = M.blue;
      if (edge) m = M.white;
      else if (x === mid) m = M.blueD;
      else if (shine >= 1 && shine <= 2) m = M.sky;
      else if (shine === 3) m = M.glass;
      v.set(x, y, z, m);
    }
  }
}

// Three blades facing the camera: they turn in the vertical plane x + y = c through the hub (hx, hy, hz),
// two voxel layers thick so the diagonal stays solid. Angle in radians, 0 = pointing to the screen's right.
function rotor(v: Vox, hx: number, hy: number, hz: number, R: number, angle: number): void {
  const c0 = hx + hy;
  const r = Math.ceil(R) + 1;
  for (let k = 0; k < 3; k++) {
    const a = angle + (k * 2 * Math.PI) / 3;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    for (let z = Math.floor(hz - r); z <= Math.ceil(hz + r); z++)
      for (let x = Math.floor(hx - r); x <= Math.ceil(hx + r); x++)
        for (const c of [c0 - 1, c0]) {
          const y = c - x;
          // position in the rotor plane: u along (1, −1) / √2 (screen right), w up
          const u = (x + 0.5 - (y + 0.5) - (hx - hy)) / Math.SQRT2;
          const w = z + 0.5 - hz;
          const t = u * ca + w * sa;
          const n = Math.abs(-u * sa + w * ca);
          if (t < 1 || t > R) continue;
          if (n > (t < R * 0.55 ? 1.25 : 0.85)) continue;
          v.set(x, y, z, t > R - 2.6 ? M.pink : M.white);
        }
  }
}

export const solar: BuildingArt = {
  frames: 4,
  fps: 6,
  model(frame, working) {
    const v = footprint(2, 2, 41);
    plate(v);
    // dark gravel bed under the panels
    v.box(2, 2, 3, 30, 27, 4, M.dark);
    // four panels around the turbine
    panel(v, 3, 3, 14, 12, 7);
    panel(v, 18, 3, 29, 12, 7);
    panel(v, 3, 16, 14, 25, 7);
    panel(v, 18, 16, 29, 25, 7);
    // wind turbine in the middle: footing, mast, nacelle, hub and the red beacon
    const hz = 30;
    v.box(14, 13, 3, 18, 17, 5, M.yellow);
    v.box(15, 14, 5, 17, 16, hz - 1, M.steelL);
    v.box(14, 13, hz - 2, 17, 16, hz + 1, M.white);
    v.box(14, 13, hz + 1, 17, 16, hz + 2, M.steelL);
    v.box(16, 16, hz - 2, 18, 18, hz + 1, M.pink); // hub, facing the camera
    v.box(14, 13, hz + 2, 15, 14, hz + 4, M.redLit);
    v.point('light', 14.5, 13.5, hz + 4);
    const angle = Math.PI / 2 - (working ? frame : 0) * (Math.PI / 6);
    rotor(v, 17, 17, hz - 0.5, 10.5, angle);
    // battery bank along the front edge: a yellow bolt and four lime bars that fill up while charging
    v.box(13, 26, 3, 30, 30, 10, M.steelD);
    v.box(13, 26, 10, 30, 30, 11, M.steelL);
    v.box(30, 27, 5, 31, 29, 8, M.steelL); // + terminal
    v.box(14, 29, 4, 30, 30, 10, M.ink);
    const BOLT = ['..#', '.#.', '###', '.#.', '#..'];
    BOLT.forEach((row, r) => {
      for (let c = 0; c < 3; c++) if (row[c] === '#') v.set(15 + c, 29, 9 - r, M.yellow);
    });
    for (let k = 0; k < 4; k++) {
      const on = working && k <= frame % 4;
      v.box(19 + k * 3, 29, 5, 21 + k * 3, 30, 9, on ? M.limeLit : M.limeD);
    }
    return v;
  },
};
