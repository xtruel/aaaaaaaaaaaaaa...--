// Building blocks shared by the models: plates, windows, signs, hazard trim.
import { M } from '../palette';
import { Vox } from '../voxel';

export interface BuildingArt {
  frames: number; // animation frames while working (1 = static)
  fps: number;
  // frame index, working (powered, supplied, not paused)
  model(frame: number, working: boolean): Vox;
}

export const TILE = 16;

export function footprint(wTiles: number, hTiles: number, height: number): Vox {
  return new Vox(wTiles * TILE, hTiles * TILE, height);
}

// The sand-coloured base every building stands on (as in the asset sheet), 3 voxels thick.
export function plate(v: Vox, inset = 1, top = 3): void {
  v.box(inset, inset, 0, v.w - inset, v.d - inset, top, M.sand);
  v.box(inset, inset, 0, v.w - inset, v.d - inset, 1, M.sandD);
  // a darker seam one voxel in from the edge
  v.paint(inset + 1, inset + 1, top - 1, v.w - inset - 1, inset + 2, top, M.sandD);
  v.paint(inset + 1, inset + 1, top - 1, inset + 2, v.d - inset - 1, top, M.sandD);
}

// Yellow/black posts at the front corners of the plate.
export function bollards(v: Vox, z: number, inset = 2): void {
  for (const [x, y] of [
    [v.w - inset - 2, v.d - inset - 2],
    [inset, v.d - inset - 2],
    [v.w - inset - 2, inset],
  ]) {
    for (let k = 0; k < 5; k++) v.box(x, y, z + k, x + 2, y + 2, z + k + 1, k % 2 ? M.hazardK : M.hazardY);
  }
}

// Hazard stripes painted along an existing surface band.
export function hazardBand(v: Vox, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void {
  for (let z = z0; z < z1; z++)
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        if (!v.get(x, y, z)) continue;
        v.set(x, y, z, Math.floor((x + y + z) / 2) % 2 ? M.hazardK : M.hazardY);
      }
}

// Windows on the front-left wall (the +y face whose outer layer is at y).
export function windowsY(v: Vox, y: number, x0: number, x1: number, z0: number, z1: number, gx: number, gz: number, ww: number, wh: number, lit: (i: number, j: number) => number): void {
  let j = 0;
  for (let z = z0; z + wh <= z1; z += gz, j++) {
    let i = 0;
    for (let x = x0; x + ww <= x1; x += gx, i++) v.box(x, y, z, x + ww, y + 1, z + wh, lit(i, j));
  }
}

// Windows on the front-right wall (the +x face whose outer layer is at x).
export function windowsX(v: Vox, x: number, y0: number, y1: number, z0: number, z1: number, gy: number, gz: number, ww: number, wh: number, lit: (i: number, j: number) => number): void {
  let j = 0;
  for (let z = z0; z + wh <= z1; z += gz, j++) {
    let i = 0;
    for (let y = y0; y + ww <= y1; y += gy, i++) v.box(x, y, z, x + 1, y + ww, z + wh, lit(i, j));
  }
}

export function hash(i: number, j: number, salt: number): number {
  let h = (i * 374761393 + j * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// The recycle mark (9×8) on the +y face at outer layer y, top-left at (x, zTop).
const RECYCLE = ['....#....', '...#.#...', '..##.##..', '.#.....#.', '##.....##', '.........', '###.#.###', '.##...##.'];
export function recycleY(v: Vox, y: number, x: number, zTop: number, m: number): void {
  RECYCLE.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) if (row[c] === '#') v.set(x + c, y, zTop - r, m);
  });
}

// The bot face (two eyes on a dark screen) on the +y face.
export function botFaceY(v: Vox, y: number, x0: number, x1: number, z0: number, z1: number, blink: boolean): void {
  v.box(x0, y, z0, x1, y + 1, z1, M.ink);
  v.box(x0 + 1, y, z0 + 1, x1 - 1, y + 1, z1 - 1, M.screen);
  const w = x1 - x0;
  const eh = blink ? 1 : Math.max(2, Math.floor((z1 - z0) / 3));
  const ez = Math.floor((z0 + z1) / 2) - (blink ? 0 : 1);
  const ew = Math.max(2, Math.floor(w / 5));
  v.box(x0 + Math.floor(w * 0.22), y, ez, x0 + Math.floor(w * 0.22) + ew, y + 1, ez + eh, M.limeLit);
  v.box(x1 - Math.floor(w * 0.22) - ew, y, ez, x1 - Math.floor(w * 0.22), y + 1, ez + eh, M.limeLit);
}

export function botFaceX(v: Vox, x: number, y0: number, y1: number, z0: number, z1: number, blink: boolean): void {
  v.box(x, y0, z0, x + 1, y1, z1, M.ink);
  v.box(x, y0 + 1, z0 + 1, x + 1, y1 - 1, z1 - 1, M.screen);
  const w = y1 - y0;
  const eh = blink ? 1 : Math.max(2, Math.floor((z1 - z0) / 3));
  const ez = Math.floor((z0 + z1) / 2) - (blink ? 0 : 1);
  const ew = Math.max(2, Math.floor(w / 5));
  v.box(x, y0 + Math.floor(w * 0.22), ez, x + 1, y0 + Math.floor(w * 0.22) + ew, ez + eh, M.limeLit);
  v.box(x, y1 - Math.floor(w * 0.22) - ew, ez, x + 1, y1 - Math.floor(w * 0.22), ez + eh, M.limeLit);
}

// A plain stand-in used until a building has its own model: plate, body, roof, windows.
export function placeholder(wTiles: number, hTiles: number, height: number, body: number, roof: number): BuildingArt {
  return {
    frames: 1,
    fps: 1,
    model() {
      const v = footprint(wTiles, hTiles, height + 6);
      plate(v);
      v.box(4, 4, 3, v.w - 4, v.d - 4, height, body);
      v.box(3, 3, height, v.w - 3, v.d - 3, height + 2, roof);
      windowsY(v, v.d - 5, 7, v.w - 6, 6, height - 3, 5, 6, 2, 3, () => M.window);
      return v;
    },
  };
}
