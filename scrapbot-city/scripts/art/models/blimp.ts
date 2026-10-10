// The 2PM advertising blimp that drifts over the city now and then, nose towards +x (the way it flies): a white
// envelope with a pink nose cap, pink tail fins and a big "2PM" on its side (glowing at night), a small gondola
// with lit windows and a tail propeller. Two frames: the propeller turns a quarter.
import { M } from '../palette';
import { FONT, Vox } from '../voxel';

export const BLIMP_FRAMES = 2;

const W = 40;
const D = 14;
const H = 16;
const CY = 7; // envelope axis
const CZ = 9.5;
const R = 6.5;
const TAIL = 3; // envelope from x = TAIL to W
const FAT = 24; // fattest section

// Envelope radius at x: a rounded nose, a long taper towards the tail.
function radius(x: number): number {
  if (x >= FAT) {
    const u = (x - FAT) / (W - FAT);
    return u >= 1 ? 0 : R * Math.sqrt(1 - u * u);
  }
  const u = (FAT - x) / (FAT - TAIL + 1.5);
  return u >= 1 ? 0 : R * Math.pow(1 - u * u, 0.62);
}

// Letters scaled ×2 painted on the outermost voxel of the +y side.
function sideText(v: Vox, str: string, x0: number, zTop: number, m: number): void {
  let cursor = x0;
  for (const ch of str) {
    const g = FONT[ch];
    for (let row = 0; row < 5; row++)
      for (let col = 0; col < 3; col++) {
        if (g[row][col] !== '#') continue;
        for (let sx = 0; sx < 2; sx++)
          for (let sz = 0; sz < 2; sz++) {
            const x = cursor + col * 2 + sx;
            const z = zTop - row * 2 - sz;
            for (let y = D - 1; y >= CY; y--)
              if (v.get(x, y, z)) {
                v.set(x, y, z, m);
                break;
              }
          }
      }
    cursor += 8;
  }
}

export function blimpModel(frame: number): Vox {
  const v = new Vox(W, D, H);
  // envelope
  for (let x = TAIL; x < W; x++) {
    const r = radius(x + 0.5);
    for (let z = 0; z < H; z++)
      for (let y = 0; y < D; y++) if ((y + 0.5 - CY) ** 2 + (z + 0.5 - CZ) ** 2 <= r * r) v.set(x, y, z, x >= 36 ? M.pink : M.white);
  }
  // a pink belt behind the nose cap and a thin one near the tail
  v.paint(33, 0, 0, 34, D, H, M.pink);
  v.paint(8, 0, 0, 9, D, H, M.pink);
  // the 2PM ad, glowing at night
  sideText(v, '2PM', 11, 14, M.pinkLit);
  // tail fins: top, bottom and both sides, swept back
  for (let x = TAIL; x < 11; x++) {
    const k = x - TAIL; // 0 at the tail
    const top = Math.min(H, 16 - Math.max(0, k - 4));
    const zr = CZ + radius(x + 0.5) - 1;
    if (top > zr) v.box(x, 6, Math.floor(zr), x + 1, 8, top, M.pink);
    const bot = Math.max(0, 3 + Math.max(0, k - 4));
    const zb = CZ - radius(x + 0.5) + 1;
    if (bot < zb) v.box(x, 6, bot, x + 1, 8, Math.ceil(zb), M.pink);
    const reach = Math.max(0, 7 - Math.max(0, k - 3));
    v.box(x, CY - reach, 9, x + 1, CY + reach, 10, M.pink);
  }
  v.paint(TAIL, 0, 0, TAIL + 2, D, H, M.pinkD);
  // gondola with lit windows
  v.box(17, 5, 0, 27, 9, 3, M.dark);
  v.box(17, 5, 2, 27, 9, 3, M.steelD);
  for (const x of [18, 21, 24]) v.box(x, 8, 1, x + 2, 9, 2, M.cyanLit);
  v.box(26, 6, 1, 27, 8, 2, M.cyanLit);
  // tail propeller: hub and two blades, a quarter turn per frame
  v.box(0, 6, 9, 3, 8, 10, M.steelD);
  if (frame % 2 === 0) v.box(0, 6, 4, 1, 8, 15, M.steelL);
  else v.box(0, 2, 9, 1, 12, 10, M.steelL);
  v.box(0, 6, 9, 1, 8, 10, M.pink);
  return v;
}
