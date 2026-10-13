// Solar Array (2×2): four big blue panels tilted 45° towards the light on steel stands over a dark gravel bed (the
// sawtooth array of the reference sheet), a short yellow junction post between them and a battery bank whose lime
// bars charge up. While working a sun glint sweeps diagonally across the panels; off, the glass goes flat.
import { M } from '../palette';
import type { Vox } from '../voxel';
import { footprint, plate } from './common';
import type { BuildingArt } from './common';
import { solarTracker } from './catalog-modules';
import { hasModule } from './modules';

// A panel tilted 45° to face +y (towards the light): the surface rises one voxel per row towards −y. 'glint'
// shifts the diagonal sun reflection across the cells (large negative values push it off the panel).
function panel(v: Vox, x0: number, y0: number, x1: number, y1: number, z0: number, glint: number): void {
  const zAt = (y: number) => z0 + (y1 - 1 - y);
  // stands: short posts at the front edge, tall ones at the back
  for (const x of [x0 + 1, x1 - 3]) {
    v.box(x, y1 - 3, 3, x + 2, y1 - 2, zAt(y1 - 3) - 1, M.steelD);
    v.box(x, y0 + 1, 3, x + 2, y0 + 2, zAt(y0 + 1) - 1, M.steelD);
  }
  const mid = Math.floor((x0 + x1) / 2);
  for (let y = y0; y < y1; y++) {
    const z = zAt(y);
    v.box(x0, y, z - 1, x1, y + 1, z, M.steelD); // frame underneath
    for (let x = x0; x < x1; x++) {
      const edge = x === x0 || x === x1 - 1 || y === y0 || y === y1 - 1;
      const shine = x - x0 - (y1 - 1 - y) - glint;
      let m = M.blue;
      if (edge) m = M.white;
      else if (shine >= 0 && shine <= 1) m = M.sky;
      else if (shine === 2) m = M.glass;
      else if (x === mid || (y - y0) % 3 === 0) m = M.blueD;
      v.set(x, y, z, m);
    }
  }
}

export const solar: BuildingArt = {
  frames: 4,
  fps: 6,
  model(frame, working, modules) {
    const v = footprint(2, 2, 20);
    plate(v);
    // dark gravel bed under the panels
    v.box(2, 2, 3, 30, 27, 4, M.dark);
    // four panels; the glint runs from the back-left panel to the front-right one
    const g = working ? -6 + frame * 5 : -40;
    // with the tracking module the panels stand on its mounts instead (catalog-modules.ts)
    if (hasModule(modules, 'solarTracker')) solarTracker(v, frame, working);
    else {
      panel(v, 3, 3, 15, 12, 6, g);
      panel(v, 17, 3, 29, 12, 6, g - 5);
      panel(v, 3, 15, 15, 24, 6, g - 3);
      panel(v, 17, 15, 29, 24, 6, g - 8);
    }
    // short yellow junction post in the middle with a status lamp
    v.box(15, 12, 3, 17, 15, 13, M.yellow);
    v.box(15, 12, 13, 17, 15, 14, M.steelD);
    v.box(15, 13, 14, 17, 15, 16, working ? M.limeLit : M.limeD);
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
