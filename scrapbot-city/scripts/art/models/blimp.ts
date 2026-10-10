// The 2PM advertising blimp that drifts over the city now and then, nose towards +x (the way it flies): a long
// white envelope with a pink nose cap and swept pink tail fins, a flat pink ad panel with "2PM" on its side (the
// panel glows at night, its rim of bulbs chases), a gondola with lit cyan windows hanging under the hull and a
// tail propeller.
// Two frames: the propeller turns a quarter and the bulbs around the ad panel chase.
import { M } from '../palette';
import { FONT, Vox, hex, mat } from '../voxel';

export const BLIMP_FRAMES = 2;

const BAND = mat('blimp-band', { rgb: hex('#ff3d8b'), emit: 0.4, glow: hex('#ff5c9e'), jitter: 0 });
// the lettering on the ad panel: lit from inside, crisp white by day and glowing at night
const LETTER = mat('blimp-letter', { rgb: hex('#fff7fc'), emit: 0.6, glow: hex('#ffd6ea'), flat: true, jitter: 0 });

const W = 52;
const D = 14;
const H = 21;
const CY = 7; // envelope axis
const CZ = 14.5;
const R = 6.5;
const TAIL = 3; // envelope from x = TAIL to W
const BODY0 = 14; // straight mid-section from BODY0 to BODY1
const BODY1 = 37;
const ZC = Math.floor(CZ); // the voxel row just under the axis

// Envelope radius at x: a tail cone, a straight body (flat planes on screen, no stair-step stripes), a round nose.
function radius(x: number): number {
  if (x < TAIL) return 0;
  if (x < BODY0) return 1.5 + ((R - 1.5) * (x - TAIL)) / (BODY0 - TAIL);
  if (x <= BODY1) return R;
  const u = (x - BODY1) / (W - BODY1);
  return u >= 1 ? 0 : R * Math.sqrt(1 - u * u);
}

// Cross-sections are slightly squared off (superellipse) so the side and the top read as clean faces.
function inside(y: number, z: number, r: number): boolean {
  if (r <= 0) return false;
  const p = 4;
  return Math.abs((y + 0.5 - CY) / r) ** p + Math.abs((z + 0.5 - CZ) / r) ** p <= 1;
}

// Pixel letters with the isometric shear cancelled (as in decor.ts): on the +y face each column is lifted so the
// glyph stays square on screen. Columns rise up to 1 voxel above zTop.
function isoTextY(v: Vox, str: string, x: number, y: number, zTop: number, m: number): void {
  let cur = 0;
  for (const ch of str.toUpperCase()) {
    const g = FONT[ch];
    if (!g) {
      cur += 2;
      continue;
    }
    const gx = x + cur;
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 3; c++) if (g[r][c] === '#') v.set(gx + c, y, zTop - r + Math.floor((gx + c + y) / 2) - Math.floor((gx + y) / 2), m);
    cur += 4;
  }
}

export function blimpModel(frame: number): Vox {
  const v = new Vox(W, D, H);
  // envelope
  for (let x = TAIL; x < W; x++) {
    const r = radius(x + 0.5);
    for (let z = 0; z < H; z++) for (let y = 0; y < D; y++) if (inside(y, z, r)) v.set(x, y, z, x >= W - 4 ? M.pink : M.white);
  }
  // pink belts behind the nose cap and in front of the tail
  v.paint(W - 5, 0, 0, W - 4, D, H, M.pinkD);
  v.paint(BODY0 - 1, 0, 0, BODY0, D, H, M.pinkD);
  // the ad panel: flat, one voxel proud of the hull, pink trim rows, white 2PM, a rim of chasing bulbs
  const P0 = 17;
  const P1 = 37;
  v.box(P0, D - 1, ZC - 3, P1, D, ZC + 5, BAND);
  v.box(P0, D - 1, ZC - 3, P1, D, ZC - 2, M.pinkD);
  v.box(P0, D - 1, ZC + 4, P1, D, ZC + 5, M.pinkD);
  for (let x = P0; x < P1; x += 2) {
    const lit = ((x - P0) / 2 + frame) % 2 === 0 ? M.yellowLit : M.pinkD;
    v.set(x, D - 1, ZC - 3, lit);
    v.set(x + 1, D - 1, ZC + 4, lit);
  }
  isoTextY(v, '2PM', 21, D - 1, ZC + 2, LETTER);
  // tail fins: top and bottom swept back, side fins 2 thick reaching out sideways
  for (let x = TAIL; x < TAIL + 8; x++) {
    const k = x - TAIL; // 0 at the tail
    const top = H - Math.max(0, k - 2);
    v.box(x, CY - 1, ZC, x + 1, CY + 1, top, M.pink);
    const bot = Math.max(0, ZC - 9 + Math.max(0, k - 2));
    v.box(x, CY - 1, bot, x + 1, CY + 1, ZC, M.pink);
    const reach = Math.max(2, 7 - Math.max(0, k - 3));
    v.box(x, CY - reach, ZC - 1, x + 1, CY + reach, ZC + 1, M.pink);
  }
  v.paint(TAIL, 0, 0, TAIL + 1, D, H, M.pinkD);
  // gondola under the hull with lit windows, hung on two struts
  v.box(20, 5, 0, 32, 10, 4, M.dark);
  v.box(20, 5, 3, 32, 10, 4, M.steelD);
  v.box(32, 6, 0, 34, 9, 3, M.dark);
  for (const x of [22, 30]) v.box(x, 6, 4, x + 1, 8, 9, M.steelD);
  for (const x of [21, 24, 27]) v.box(x, 9, 1, x + 2, 10, 3, M.cyanLit);
  v.box(33, 6, 1, 34, 9, 2, M.cyanLit);
  // tail propeller: hub and two blades, a quarter turn per frame
  v.box(0, CY - 1, ZC, TAIL, CY + 1, ZC + 1, M.steelD);
  if (frame % 2 === 0) v.box(0, CY - 1, ZC - 5, 1, CY + 1, ZC + 6, M.steelL);
  else v.box(0, CY - 5, ZC, 1, CY + 5, ZC + 1, M.steelL);
  v.box(0, CY - 1, ZC, 1, CY + 1, ZC + 1, M.pink);
  return v;
}
