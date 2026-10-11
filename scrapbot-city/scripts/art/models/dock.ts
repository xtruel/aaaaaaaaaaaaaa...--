// Bot Dock (2×2): blue hangar with a garage door, a control tower with the bot face, and a landing pad on
// the roof where bots touch down (lights chase around the ring). Module: extra storage silos (modules.ts).
import { M } from '../palette';
import { botFaceY, footprint, hazardBand, plate, windowsX } from './common';
import type { BuildingArt } from './common';
import { dockStorage, hasModule } from './modules';

export const dock: BuildingArt = {
  frames: 4,
  fps: 4,
  model(frame, working, modules) {
    const v = footprint(2, 2, 34);
    plate(v);
    // hangar
    v.box(3, 3, 3, 29, 29, 15, M.blue);
    v.paint(3, 3, 3, 29, 29, 5, M.blueD);
    v.box(2, 2, 15, 30, 30, 16, M.blueD);
    // garage door on the front-left wall
    v.box(5, 28, 3, 19, 30, 13, M.steelD);
    for (let z = 3; z < 12; z++) v.box(6, 29, z, 18, 30, z + 1, z % 2 ? M.steel : M.steelL);
    hazardBand(v, 5, 29, 12, 19, 30, 13);
    // windows on the right wall
    windowsX(v, 28, 6, 26, 8, 13, 5, 5, 3, 3, () => (working ? M.cyanLit : M.window));
    // landing pad on the roof
    v.box(13, 11, 16, 29, 29, 17, M.dark);
    v.cylZ(21, 20, 7.6, 17, 18, M.hazardY, 6.4);
    v.box(19, 18, 17, 20, 23, 18, M.white);
    v.box(22, 18, 17, 23, 23, 18, M.white);
    v.box(20, 20, 17, 22, 21, 18, M.white);
    const ring: [number, number][] = [
      [14, 12],
      [27, 12],
      [27, 27],
      [14, 27],
    ];
    ring.forEach(([x, y], i) => v.box(x, y, 17, x + 2, y + 2, 18, working && i === frame % 4 ? M.limeLit : M.limeD));
    // control tower with the bot face
    v.box(4, 4, 16, 12, 12, 27, M.white);
    v.box(3, 3, 27, 13, 13, 28, M.pink);
    if (working) botFaceY(v, 12, 5, 11, 18, 25, frame === 3);
    else v.box(5, 12, 18, 11, 13, 25, M.ink);
    v.box(7, 7, 28, 8, 8, 33, M.steelL);
    v.box(6, 6, 32, 9, 9, 34, working ? M.redLit : M.red);
    v.point('light', 7.5, 7.5, 34);
    v.point('pad', 21, 20, 18);
    if (hasModule(modules, 'dockStorage')) dockStorage(v, frame, working);
    return v;
  },
};
