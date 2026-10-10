// The 2PM advertising blimp that drifts over the city now and then, nose towards +x (the way it flies): a white
// envelope with a pink nose cap and pink tail fins, a pink ad band with "2PM" on its side (the band glows at night,
// the letters stay readable on it), a small gondola with lit windows and a tail propeller.
// Two frames: the propeller turns a quarter.
import { M } from '../palette';
import { Vox, hex, mat } from '../voxel';

export const BLIMP_FRAMES = 2;

const BAND = mat('blimp-band', { rgb: hex('#ff3d8b'), emit: 0.4, glow: hex('#ff5c9e'), jitter: 0 });

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

// Cross-sections are slightly squared off (superellipse) so the side and the top read as clean faces.
function inside(y: number, z: number, r: number): boolean {
  if (r <= 0) return false;
  const p = 3;
  return Math.abs((y + 0.5 - CY) / r) ** p + Math.abs((z + 0.5 - CZ) / r) ** p <= 1;
}

// The outermost voxel on the +y side at (x, z).
function sideY(v: Vox, x: number, z: number): number {
  for (let y = D - 1; y >= CY; y--) if (v.get(x, y, z)) return y;
  return -1;
}

export function blimpModel(frame: number): Vox {
  const v = new Vox(W, D, H);
  // envelope
  for (let x = TAIL; x < W; x++) {
    const r = radius(x + 0.5);
    for (let z = 0; z < H; z++) for (let y = 0; y < D; y++) if (inside(y, z, r)) v.set(x, y, z, x >= 36 ? M.pink : M.white);
  }
  // pink belts behind the nose cap and near the tail
  v.paint(33, 0, 0, 34, D, H, M.pinkD);
  v.paint(9, 0, 0, 10, D, H, M.pinkD);
  // the ad band along the side with white 2PM letters
  for (let x = 13; x < 30; x++)
    for (let z = 6; z < 13; z++) {
      const y = sideY(v, x, z);
      if (y >= 0) v.set(x, y, z, BAND);
    }
  for (let x = 13; x < 30; x++) {
    const y = sideY(v, x, 6);
    if (y >= 0) v.set(x, y, 6, M.pinkD);
  }
  // letters painted onto the band (outermost layer), 3×5 font
  const tmp = new Vox(W, 1, H);
  tmp.text('2PM', '+y', 16, 0, 11, M.white);
  for (let x = 0; x < W; x++)
    for (let z = 0; z < H; z++) {
      if (!tmp.get(x, 0, z)) continue;
      const y = sideY(v, x, z);
      if (y >= 0) v.set(x, y, z, M.white);
    }
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
  v.paint(TAIL, 0, 0, TAIL + 1, D, H, M.pinkD);
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
