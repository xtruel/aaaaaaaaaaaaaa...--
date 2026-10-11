// Player-built pieces of the 0.7 catalogue, increment 2: nine decorations and three constructions, one tile each.
// Every model is 16×16 voxels with its origin on the tile's back corner, like increment 1's pieces (pieces.ts).
// Directions follow the lamp's: 0 faces +x, 1 +y, 2 −x, 3 −y (the side a sitter, a door, a face or an arm points).
//   pc/bench/<dir>                 park bench: scrap-pipe frame, wooden slats, armrests
//   pc/planter/<k>        k 0..1   raised metal planter: tulips (0) or sunflowers (1)
//   pc/sign/<motif>/<dir>          neon blade sign on a post (no text): 0 bot face, 1 recycle arrows, 2 heart; /g lit
//   pc/pergola/x, /y               a small pergola with wisteria climbing it, beams along x or y
//   pc/cathouse/<dir>              Miso's house: gable roof with a paw print, a cushion on the porch (door side)
//   pc/sculpture/<dir>             a robot welded from junk (drum torso, TV head, pipe limbs) on a concrete block
//   pc/tree/<k>           k 0..2   palm (0), cypress (1), red maple (2), each in a stone-ringed tree pit
//   pc/fountain/<f>       f 0..3   round fountain; frame 0 is the still one (reduced motion), 1..3 the jet playing
//   pc/statue/<dir>                USA-9 on a stone pedestal, lime eyes lit at night
//   t/base/<k>            k 0..3   concrete slab with a curb (ground tile, like t/floor)
//   pc/wall/<mask>, /x, /y         low wall of pressed scrap bales, joined like the fence (N1 E2 S4 W8)
//   pc/pillar/<mask>      0..15    corner pillar with stubs towards the masked sides and a lamp on top; /g lit
// Walls and pillars sit on the fence's line through the tile centre: the wall is 4 voxels thick (6..10), the
// pillar 6 (5..11) with wall-sized collars towards its neighbours; fences (panel at 8, posts 7..9) and gates
// (pillars 6..11) meet them at the tile edges.
import { M } from '../palette';
import { createImage } from '../png';
import type { Image } from '../png';
import { Vox, hex, mat } from '../voxel';
import type { RGB } from '../voxel';
import { hash, hazardBand } from './common';
import { balls, blocks, line } from './decor';

// Materials, registered on first use (registering at import time would shift the ids, and so the per-voxel noise,
// of every material registered after this file, changing older sprites).
let mats: ReturnType<typeof makeMats> | null = null;
function makeMats() {
  const m = (key: string, color: string, jitter = 0.03) => mat(`cp-${key}`, { rgb: hex(color), jitter });
  return {
    wood: m('wood', '#d39a5c'),
    woodD: m('woodD', '#7a4a2a'),
    cushion: m('cushion', '#ff7fb0', 0.02),
    cushionD: m('cushionD', '#c94f86', 0.02),
    roof: m('roof', '#d9455a'),
    roofD: m('roofD', '#9c2b45'),
    plank: m('plank', '#e7c48e'),
    plankD: m('plankD', '#b98d5b'),
    soil: m('soil', '#4a3328', 0.08),
    tulipR: m('tulipR', '#ff4d6d', 0.02),
    tulipP: m('tulipP', '#ffa3c8', 0.02),
    seed: m('seed', '#6b3f1f', 0.06),
    palm: m('palm', '#5ccf5f', 0.02),
    palmD: m('palmD', '#2e8c44', 0.02),
    trunk: m('trunk', '#b0875a', 0.04),
    trunkD: m('trunkD', '#7d5c3a', 0.04),
    coconut: m('coconut', '#6b4426'),
    cypress: m('cypress', '#2f7a50', 0.02),
    cypressL: m('cypressL', '#55a86e', 0.02),
    cypressD: m('cypressD', '#1d5139', 0.02),
    maple: m('maple', '#e0542f', 0.02),
    mapleL: m('mapleL', '#ff9a45', 0.02),
    mapleD: m('mapleD', '#a3302c', 0.02),
    bark: m('bark', '#5e4134', 0.05),
    stone: m('stone', '#aaa5bb', 0.05),
    stoneD: m('stoneD', '#7a758e', 0.05),
    plaque: m('plaque', '#d6a640', 0.02),
    water: m('water', '#3c95d8', 0.02),
    waterL: m('waterL', '#8fd8ff', 0),
    foam: m('foam', '#eafcff', 0),
    baleRust: m('baleRust', '#9c5a38', 0.08),
    baleBlue: m('baleBlue', '#56699a', 0.08),
    baleGreen: m('baleGreen', '#65804f', 0.08),
    baleGrey: m('baleGrey', '#8a869c', 0.08),
    baleRed: m('baleRed', '#9a4a52', 0.08),
    baleTan: m('baleTan', '#a8915f', 0.08),
    baleRustD: m('baleRustD', '#7a4630', 0.08),
    baleBlueD: m('baleBlueD', '#43537b', 0.08),
    baleGreenD: m('baleGreenD', '#4f6640', 0.08),
    baleGreyD: m('baleGreyD', '#6c697d', 0.08),
    baleRedD: m('baleRedD', '#7a3a44', 0.08),
    baleTanD: m('baleTanD', '#85724c', 0.08),
    strap: m('strap', '#3a3550', 0.02),
    usaBody: m('usaBody', '#3b3063', 0.02),
    usaFeet: m('usaFeet', '#7d7896', 0.02),
    usaShade: m('usaShade', '#b9b4cc', 0.02),
    vine: m('vine', '#3c8a3c', 0.04),
    wisteria: m('wisteria', '#b98cff', 0.04),
    wisteriaD: m('wisteriaD', '#7f58d0', 0.04),
    // neon: tubes lit at night, a dark tinted fill inside them
    neonFillC: m('neonFillC', '#1b4f57', 0),
    neonFillG: m('neonFillG', '#2c5a1e', 0),
    neonFillP: m('neonFillP', '#6a1f45', 0),
    lampWarm: mat('cp-lampWarm', { rgb: hex('#ffe9a8'), emit: 1, glow: hex('#ffd36b'), jitter: 0 }),
  };
}
export function catalogPieceMats() {
  mats ??= makeMats();
  return mats;
}

// ---------- shared helpers ----------

export const PIECE_DIRS = 4;

// A model built facing +y, turned to face dir (0 +x, 1 +y, 2 −x, 3 −y). Vox.rotated() turns +y into +x.
export function facingDir(v: Vox, dir: number): Vox {
  const turns = [1, 0, 3, 2][dir & 3];
  let out = v;
  for (let k = 0; k < turns; k++) out = out.rotated();
  return out;
}

// A bitmap drawn upright on screen on a vertical face: '+y' is the face looking +y (an x–z plane at y; columns go
// along +x), '+x' the face looking +x (a y–z plane at x; columns go along −y). Each column is lifted or dropped
// by the half-voxel the iso projection shears it by, so rows stay level on screen (as decor.ts's isoText does).
// pick(row, col) gives the material (0 = leave). rows[0] is the top row, at zTop.
export function screenBitmap(v: Vox, face: '+x' | '+y', x: number, y: number, zTop: number, rows: number, cols: number, pick: (r: number, c: number) => number, depth = 1): void {
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < rows; r++) {
      const m = pick(r, c);
      if (!m) continue;
      const px = face === '+y' ? x + c : x;
      const py = face === '+y' ? y : y - c;
      const pz = zTop - r + Math.floor((px + py) / 2) - Math.floor((x + y) / 2);
      for (let k = 0; k < depth; k++) {
        if (face === '+y') v.set(px, py - k, pz, m);
        else v.set(px - k, py, pz, m);
      }
    }
}

// ---------- bench ----------
// Facing +y: a seat of four wooden slats on a frame of bent steel pipes (the city's scrap), a two-slat backrest on
// the −y side, pink-capped armrests at both ends.
function benchModel(): Vox {
  const P = catalogPieceMats();
  const v = new Vox(16, 16, 11);
  // pipe frame at both ends: front and back legs, a rail under the seat, the armrest
  for (const x of [2, 13]) {
    v.box(x, 11, 0, x + 1, 12, 7, M.steelL); // front leg rising into the armrest
    v.box(x, 5, 0, x + 1, 6, 10, M.steelL); // back leg rising into the backrest post
    v.box(x, 5, 3, x + 1, 12, 4, M.steelL); // rail under the seat
    v.box(x, 6, 7, x + 1, 12, 8, M.steel); // armrest
    v.box(x, 11, 7, x + 1, 12, 8, M.pink); // its end cap
    v.box(x, 5, 0, x + 1, 12, 1, M.steelD); // foot bar
  }
  // seat slats (along x), dark gaps between them
  for (let y = 6; y < 12; y++) v.box(1, y, 4, 15, y + 1, 5, (y - 6) % 3 === 2 ? P.woodD : P.wood);
  v.box(1, 11, 4, 15, 12, 5, P.wood);
  // backrest slats
  v.box(1, 5, 5, 15, 6, 7, P.wood);
  v.box(1, 5, 7, 15, 6, 8, P.woodD);
  v.box(1, 5, 8, 15, 6, 10, P.wood);
  v.box(1, 5, 10, 15, 6, 11, P.woodD);
  // a little brass plate on the backrest
  v.box(7, 6, 8, 9, 7, 9, P.plaque);
  return v;
}

export function benchPiece(dir: number): Vox {
  return facingDir(benchModel(), dir);
}

// ---------- planter ----------
// A raised planter of ribbed metal (blue-grey sheet with steel corner posts) full of soil; 0 = tulips in red and
// pink, 1 = three sunflowers, taller, their heads turned to the front.
export function planterPiece(k: number): Vox {
  const P = catalogPieceMats();
  const v = new Vox(16, 16, 20);
  v.box(2, 2, 0, 14, 14, 6, M.steel);
  for (let t = 2; t < 14; t += 2) {
    v.box(t, 13, 1, t + 1, 14, 5, M.steelL); // ribs on the two visible sides
    v.box(13, t, 1, 14, t + 1, 5, M.steelL);
  }
  for (const [x, y] of [
    [2, 2],
    [12, 2],
    [2, 12],
    [12, 12],
  ])
    v.box(x, y, 0, x + 2, y + 2, 7, M.steelD);
  v.box(3, 3, 5, 13, 13, 6, P.soil);
  if (k === 0) {
    // tulips on a staggered grid: a stem, two leaves, a cup of 2×2×2 with a notch
    const spots: [number, number, number][] = [
      [4, 4, 0],
      [8, 4, 1],
      [11, 5, 0],
      [5, 8, 1],
      [9, 8, 0],
      [4, 11, 0],
      [8, 11, 1],
      [11, 10, 1],
    ];
    for (const [x, y, c] of spots) {
      const h = 9 + Math.floor(hash(x, y, 501) * 3);
      v.box(x, y, 6, x + 1, y + 1, h, M.green);
      v.set(x + 1, y, 7, M.greenL);
      v.set(x, y + 1, 8, M.greenL);
      const m = c ? P.tulipP : P.tulipR;
      v.box(x, y, h, x + 2, y + 2, h + 2, m);
      v.set(x + 1, y + 1, h + 1, 0);
    }
    return v;
  }
  // sunflowers: tall stalks with leaves, a big yellow head (petal ring round a brown seed disc) facing +y
  const flowers: [number, number, number][] = [
    [5, 7, 16],
    [10, 5, 18],
    [9, 10, 14],
  ];
  for (const [x, y, h] of flowers) {
    v.box(x, y, 6, x + 1, y + 1, h, M.greenD);
    v.box(x - 1, y, 9, x, y + 1, 10, M.green);
    v.box(x + 1, y, 11, x + 2, y + 1, 12, M.green);
    // head in the x–z plane, one voxel in front of the stalk
    for (let dz = -2; dz <= 2; dz++)
      for (let dx = -2; dx <= 2; dx++) {
        const r = Math.abs(dx) + Math.abs(dz);
        if (r > 3) continue;
        v.set(x + dx, y + 1, h + dz, r <= 1 ? P.seed : M.yellow);
      }
    v.set(x, y + 2, h, P.seed);
  }
  // low leaves round the stalks
  v.box(3, 9, 6, 6, 12, 7, M.green);
  v.box(10, 9, 6, 13, 12, 7, M.greenL);
  return v;
}

// ---------- neon sign ----------
// A post on a little footing with an arm towards dir; the sign hangs under the arm (a blade sign: its board lies
// along the arm, so whichever way it points one of its faces looks at the camera), a dark board in a steel frame
// with the motif in neon tubes on both faces: lit tubes outline it, a dark tint fills it. The motif is drawn upright
// on screen on the visible face.
const MOTIFS: { rows: string[]; tube: 'c' | 'g' | 'p' }[] = [
  {
    // bot face: ears, head, two eyes, a mouth
    rows: ['.#.....#.', '.#.....#.', '#########', '#ooooooo#', '#o##o##o#', '#o##o##o#', '#ooooooo#', '#oo###oo#', '#########'],
    tube: 'c',
  },
  {
    // recycle arrows (the plant's mark)
    rows: ['....#....', '...#.#...', '..##.##..', '.#.....#.', '##.....##', '.........', '###.#.###', '.##...##.', '.........'],
    tube: 'g',
  },
  {
    // heart
    rows: ['.##...##.', '#oo#.#oo#', '#ooo#ooo#', '#ooooooo#', '.#ooooo#.', '..#ooo#..', '...#o#...', '....#....', '.........'],
    tube: 'p',
  },
];
export const SIGN_MOTIFS = MOTIFS.length;
const SIGN_H = 26;

export function signPiece(motif: number, dir: number): Vox {
  const P = catalogPieceMats();
  const v = new Vox(16, 16, SIGN_H + 1);
  const { rows, tube } = MOTIFS[motif];
  const lit = tube === 'c' ? M.cyanLit : tube === 'g' ? M.limeLit : M.pinkLit;
  const fill = tube === 'c' ? P.neonFillC : tube === 'g' ? P.neonFillG : P.neonFillP;
  const d = dir & 3;
  const along: 'x' | 'y' = d === 0 || d === 2 ? 'x' : 'y';
  const sgn = d === 0 || d === 1 ? 1 : -1;
  // the post stands on the side opposite the arm
  const px = along === 'x' ? (sgn > 0 ? 2 : 12) : 7;
  const py = along === 'y' ? (sgn > 0 ? 2 : 12) : 7;
  v.box(px - 1, py - 1, 0, px + 3, py + 3, 1, M.concrete);
  v.box(px, py, 1, px + 2, py + 2, SIGN_H, M.steelD);
  v.box(px, py, SIGN_H - 1, px + 2, py + 2, SIGN_H, M.steel);
  // arm and the board's frame: along the arm 12 voxels, 2 thick, 16 tall under the arm. The motif is drawn upright on
  // screen, so its columns step up (on a +y face) or down (on a +x face) by half a voxel each: 9 rows plus 4 of
  // step need 13 of the board's 14 inner rows.
  const a0 = sgn > 0 ? 4 : 0;
  const a1 = sgn > 0 ? 16 : 12;
  const zb = 6;
  const zt = 22;
  if (along === 'x') {
    v.box(a0, 7, SIGN_H - 3, a1, 9, SIGN_H - 2, M.steel);
    v.box(a0, 7, zb, a1, 9, zt, M.steelD);
    v.box(a0 + 1, 7, zb + 1, a1 - 1, 9, zt - 1, M.navy);
    for (const hx of [a0 + 2, a1 - 3]) v.box(hx, 7, zt, hx + 1, 9, SIGN_H - 3, M.steelD); // hangers
    // motif on the +y face (y 8) and the −y face (y 7)
    const x0 = a0 + 2 - 1 + Math.floor((a1 - a0 - 2 - 9) / 2) + 1;
    for (const fy of [8, 7])
      screenBitmap(v, '+y', x0, fy, zb + 1 + 8 + (Math.floor((x0 + fy) / 2) - Math.floor((x0 + 8) / 2)), 9, 9, (r, c) => (rows[r][c] === '#' ? lit : rows[r][c] === 'o' ? fill : 0));
  } else {
    v.box(7, a0, SIGN_H - 3, 9, a1, SIGN_H - 2, M.steel);
    v.box(7, a0, zb, 9, a1, zt, M.steelD);
    v.box(7, a0 + 1, zb + 1, 9, a1 - 1, zt - 1, M.navy);
    for (const hy of [a0 + 2, a1 - 3]) v.box(7, hy, zt, 9, hy + 1, SIGN_H - 3, M.steelD);
    // motif on the +x face (x 8) reading towards −y, and the −x face (x 7)
    const y0 = a1 - 2 - Math.floor((a1 - a0 - 2 - 9) / 2) - 1;
    for (const fx of [8, 7])
      screenBitmap(v, '+x', fx, y0, zt - 2 + (Math.floor((fx + y0) / 2) - Math.floor((8 + y0) / 2)), 9, 9, (r, c) => (rows[r][c] === '#' ? lit : rows[r][c] === 'o' ? fill : 0));
  }
  return v;
}

// ---------- pergola ----------
// Four posts, two beams along the axis, slats across them; wisteria climbs the two front posts and spills over the
// top in purple clusters. The frame, the vines and the hanging clusters are built along x and turned for y, but the
// leafy crown on the slats is laid out in the final orientation, always in a row across the screen (x − y): turned
// with the frame, its lobes lined up down the screen on the y pergola and read as a tree standing on the roof.
export function pergolaPiece(axis: 'x' | 'y'): Vox {
  const P = catalogPieceMats();
  const v = new Vox(16, 16, 22);
  const H = 17;
  for (const x of [2, 12]) for (const y of [2, 12]) v.box(x, y, 0, x + 2, y + 2, H, P.woodD);
  for (const x of [2, 12]) for (const y of [2, 12]) v.box(x - 1, y - 1, 0, x + 3, y + 3, 1, M.concrete);
  // beams along x (turned for y below), slats across
  for (const y of [2, 12]) v.box(0, y, H, 16, y + 2, H + 2, P.wood);
  for (let x = 1; x < 16; x += 3) v.box(x, 1, H + 2, x + 1, 15, H + 3, P.woodD);
  // climbing plants up the two front posts (y 12) and over the top
  for (const x of [2, 12])
    for (let z = 1; z < H; z++) {
      const s = Math.floor(hash(x, z, 801) * 4);
      v.set(x + (s & 1 ? 2 : -1), 12 + (s >> 1), z, P.vine);
      if (z % 3 === 0) v.set(x + (s & 1 ? -1 : 2), 13, z, M.green);
    }
  // hanging wisteria clusters under the slats (stamped over the crown below, so their tops stay purple)
  const hang = new Vox(16, 16, 22);
  for (const [x, y, len] of [
    [4, 14, 5],
    [7, 14, 4],
    [10, 14, 6],
    [14, 10, 5],
    [14, 6, 4],
    [5, 3, 3],
  ] as const)
    for (let k = 0; k < len; k++) {
      hang.set(x, y, H - k, k % 2 ? P.wisteriaD : P.wisteria);
      if (k < len - 2) hang.set(x + 1, y, H - k, P.wisteria);
    }
  const out = axis === 'x' ? v : v.rotated();
  // the crown: three lobes across the screen, the first over the side the vines climb
  const lobes =
    axis === 'x'
      ? [
          [4, 13, H + 2, 3, 2],
          [12, 4, H + 2.5, 3, 2],
          [8, 9, H + 3, 3.5, 1.6],
        ]
      : [
          [13, 4, H + 2, 3, 2],
          [4, 12, H + 2.5, 3, 2],
          [9, 8, H + 3, 3.5, 1.6],
        ];
  balls(out, lobes, M.green, M.greenL, M.greenD);
  out.stamp(axis === 'x' ? hang : hang.rotated(), 0, 0, 0);
  return out;
}

// ---------- Miso's house ----------
// Facing +y: a little wooden house on a raised floor, a red gable roof (ridge along y) with a white paw print on
// the slope that faces the camera, a round-topped door in the +y gable, a pink cushion on the porch in front of it,
// a fish cut-out over the door and a food bowl by the porch.
// The paw is painted after the house is turned (catHousePiece), always on the camera's slope and always on the same
// voxel parity: the projection works in half voxels, so a one-voxel toe on a roof step shows its lit top on one
// parity and only its shaded riser on the other (painted in the model, the paw read as a ring in two directions
// and as a dot in the other two). Rows from the ridge down: four toes in an arc, then a round pad over steps 2..0.
const PAW = ['.#.#.', '#...#', '.###.', '#####', '.###.'];
const PAW_K = 4; // the roof step of the paw's top row (step 0 is the eave, 6 the ridge, whose top hides step 5)
function catHouseModel(): Vox {
  const P = catalogPieceMats();
  const v = new Vox(16, 16, 15);
  v.box(2, 2, 0, 14, 13, 1, P.woodD); // floor
  v.box(3, 3, 1, 13, 12, 8, P.plank); // walls
  for (let z = 2; z < 8; z += 2) {
    v.paint(3, 11, z, 13, 12, z + 1, P.plankD); // plank seams on the visible walls
    v.paint(12, 3, z, 13, 12, z + 1, P.plankD);
  }
  // gable roof: ridge along y over x 8, slopes down to x 2 and x 14, overhanging front and back
  for (let k = 0; k < 7; k++) {
    v.box(2 + k, 2, 8 + k, 3 + k, 14, 9 + k, k === 6 ? P.roofD : P.roof);
    v.box(13 - k, 2, 8 + k, 14 - k, 14, 9 + k, k === 6 ? P.roofD : P.roof);
  }
  // gable ends: fill the triangle on the walls' planes
  for (let k = 0; k < 6; k++) {
    v.box(3 + k, 3, 8 + k, 13 - k, 12, 9 + k, P.plank);
  }
  // door: a round-topped opening in the +y gable
  v.box(6, 11, 1, 10, 12, 6, M.ink);
  v.box(7, 11, 6, 9, 12, 7, M.ink);
  // fish over the door
  v.box(6, 12, 9, 9, 13, 10, M.sky);
  v.set(9, 12, 9, M.sky);
  v.set(10, 12, 10, M.sky);
  v.set(10, 12, 8, M.sky);
  v.set(6, 12, 9, M.ink);
  // porch with a cushion, a bowl beside it
  v.box(5, 12, 0, 11, 15, 1, P.woodD);
  v.box(6, 12, 1, 10, 15, 2, P.cushion);
  v.box(6, 14, 1, 10, 15, 2, P.cushionD);
  v.set(7, 13, 2, P.cushion);
  v.set(8, 13, 2, P.cushion);
  v.cylZ(12.5, 14, 1.4, 0, 2, M.steelL);
  v.cylZ(12.5, 14, 0.9, 1, 2, M.orange);
  return v;
}

export function catHousePiece(dir: number): Vox {
  const v = facingDir(catHouseModel(), dir);
  // the slope facing the camera: +x (x = 13 − k) when the ridge runs along y (dirs 1, 3), +y (y = 13 − k) when it
  // runs along x (dirs 0, 2); step k is at z 8 + k. Columns 6..10 along the ridge, the middle of the roof.
  const alongY = (dir & 1) === 1;
  PAW.forEach((row, r) =>
    [...row].forEach((ch, c) => {
      if (ch !== '#') return;
      const k = PAW_K - r;
      if (alongY) v.set(13 - k, 6 + c, 8 + k, M.white);
      else v.set(6 + c, 13 - k, 8 + k, M.white);
    }),
  );
  return v;
}

// ---------- scrap sculpture ----------
// Facing +y: a robot welded from junk on a concrete block: tyre feet, pipe legs, an oil-drum torso with a gear on its
// chest, a box TV for a head (dark screen, two lime eyes lit at night, a bent antenna), one arm down and one raised
// with a yellow wrench.
function sculptureModel(): Vox {
  const v = new Vox(16, 16, 27);
  v.box(3, 3, 0, 13, 13, 3, M.concrete);
  v.box(3, 3, 2, 13, 13, 3, M.concreteL);
  hazardBand(v, 3, 12, 0, 13, 13, 1);
  // feet: two tyres lying flat
  for (const x of [5.5, 10.5]) {
    v.cylZ(x, 8, 2.1, 3, 5, M.dark);
    v.cylZ(x, 8, 1, 4, 5, M.steelD);
  }
  // legs: pipes
  v.box(5, 7, 5, 7, 9, 10, M.steelL);
  v.box(10, 7, 5, 12, 9, 10, M.steelL);
  v.box(5, 7, 7, 7, 9, 8, M.steelD); // knee clamps
  v.box(10, 7, 7, 12, 9, 8, M.steelD);
  // torso: an oil drum, two rings, a gear on the chest
  v.cylZ(8.5, 8, 3.3, 10, 18, M.rust);
  v.cylZ(8.5, 8, 3.45, 11, 12, M.rustD);
  v.cylZ(8.5, 8, 3.45, 16, 17, M.rustD);
  v.cylZ(8.5, 8, 2.2, 18, 19, M.steelD);
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    v.set(Math.floor(8.5 + Math.cos(a) * 1.6), 11, Math.floor(14 + Math.sin(a) * 1.6), M.yellow);
  }
  v.set(8, 11, 14, M.steelD);
  // head: a box TV with a screen and two eyes on its front, a dial on its side, an antenna
  v.box(5, 5, 19, 12, 11, 24, M.steelL);
  v.box(5, 5, 23, 12, 11, 24, M.steel);
  v.box(6, 10, 20, 11, 11, 23, M.ink);
  v.box(7, 10, 21, 8, 11, 23, M.limeLit);
  v.box(9, 10, 21, 10, 11, 23, M.limeLit);
  v.box(11, 7, 21, 12, 9, 23, M.orange); // dial
  line(v, [7, 7, 24], [6, 6, 26], M.steelD);
  v.set(5, 5, 26, M.red);
  // arms: left (−x) hanging pipe with a claw, right (+x) raised holding a wrench
  v.box(3, 7, 12, 5, 9, 17, M.steelL);
  v.box(3, 7, 11, 5, 9, 12, M.steelD);
  v.box(12, 7, 16, 14, 9, 18, M.steelL);
  v.box(13, 7, 18, 15, 9, 22, M.steelL);
  v.box(13, 7, 22, 15, 9, 23, M.steelD);
  v.box(14, 7, 23, 15, 9, 26, M.yellow); // wrench handle
  v.box(13, 7, 25, 16, 9, 26, M.yellow);
  v.set(14, 7, 26, M.yellow);
  return v;
}

export function sculpturePiece(dir: number): Vox {
  return facingDir(sculptureModel(), dir);
}

// ---------- trees ----------
// Each in a pit ringed with stones; about two tiles tall. 0: a palm (ringed curving trunk, a crown of drooping
// fronds, coconuts), 1: a cypress (a tall dark-green spindle), 2: a red maple (a forked trunk under flat layered
// tiers of red and orange leaves). All unlike the Pixel Garden's bushy crown and the round, pine, blossom and dead
// trees of the scenery.
function treePit(v: Vox): void {
  const P = catalogPieceMats();
  v.cylZ(8, 8, 5.4, 0, 1, P.stoneD);
  v.cylZ(8, 8, 4.4, 0, 1, P.soil);
  for (let k = 0; k < 10; k++) {
    const a = (k * Math.PI * 2) / 10;
    v.set(Math.floor(8 + Math.cos(a) * 4.9), Math.floor(8 + Math.sin(a) * 4.9), 1, k % 2 ? P.stone : P.stoneD);
  }
}

export const TREE_KINDS = 3;

export function treePiece(k: number): Vox {
  const P = catalogPieceMats();
  const v = new Vox(16, 16, 32);
  treePit(v);
  if (k === 0) {
    // trunk: a gentle curve, a ring every two voxels
    let top: [number, number, number] = [8, 8, 0];
    for (let z = 0; z < 25; z++) {
      const x = 7 + Math.round((z / 25) ** 2 * 1.6);
      v.box(x, 7, z, x + 2, 9, z + 1, z % 2 ? P.trunk : P.trunkD);
      top = [x + 1, 8, z];
    }
    const [tx, ty, tz] = top;
    // six fronds: a rib arching up and out, then drooping, leaflets hanging from it; gaps between the fronds
    for (let f = 0; f < 6; f++) {
      const a = (f * Math.PI) / 3 + 0.5;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      for (let st = 0; st <= 16; st++) {
        const r = st * 0.45;
        const x = tx + ca * r;
        const y = ty + sa * r;
        const z = tz + 2 + r * 0.9 - (r * r) / 4.5;
        v.set(Math.floor(x), Math.floor(y), Math.floor(z), st > 12 ? P.palmD : P.palm);
        if (st > 3 && st % 3 === 0) {
          v.set(Math.floor(x - sa * 0.9), Math.floor(y + ca * 0.9), Math.floor(z - 1), P.palmD);
          v.set(Math.floor(x + sa * 0.9), Math.floor(y - ca * 0.9), Math.floor(z - 1), P.palmD);
        }
      }
    }
    v.box(tx - 1, ty - 1, tz, tx + 1, ty + 1, tz + 3, P.palm);
    for (const [cx, cy] of [
      [tx, ty + 1],
      [tx + 1, ty],
      [tx - 1, ty + 1],
    ])
      v.set(cx, cy, tz - 1, P.coconut);
    return v;
  }
  if (k === 1) {
    // cypress: a spindle of soft lobes, narrow at the foot and the tip
    v.box(7, 7, 0, 9, 9, 5, P.bark);
    const lobes: number[][] = [];
    for (let z = 5; z < 30; z += 3) {
      const t = (z - 5) / 25;
      const r = 1.8 + Math.sin(Math.PI * Math.min(1, t * 1.15)) * 2.6;
      lobes.push([8 + (hash(z, 1, 601) - 0.5), 8 + (hash(z, 2, 601) - 0.5), z + 1.5, r, 2.4]);
    }
    balls(v, lobes, P.cypress, P.cypressL, P.cypressD);
    return v;
  }
  // red maple: forked trunk, flat tiers
  v.box(7, 7, 0, 9, 9, 9, P.bark);
  line(v, [8, 8, 8], [4.5, 9, 13], P.bark, 2);
  line(v, [8, 8, 8], [11.5, 6.5, 15], P.bark, 2);
  line(v, [8, 8, 12], [9, 11, 18], P.bark, 1);
  blocks(
    v,
    [
      [1, 4, 12, 9, 13, 16],
      [8, 1, 14, 15, 10, 18],
      [4, 7, 18, 13, 15, 22],
      [5, 3, 22, 12, 11, 26],
      [7, 6, 26, 10, 10, 28],
    ],
    P.maple,
    P.mapleL,
    P.mapleD,
  );
  return v;
}

// ---------- fountain ----------
// A round stone basin with water, a stone column carrying a small bowl, and the jet: frame 0 is still (a calm
// bubbling crown on the bowl), frames 1..3 a jet rising and falling with drops arcing into the basin and a ring of
// ripples spreading on the water.
export const FOUNTAIN_FRAMES = 4;

export function fountainPiece(frame: number): Vox {
  const P = catalogPieceMats();
  const v = new Vox(16, 16, 24);
  const cx = 8;
  const cy = 8;
  const f = frame & 3;
  v.cylZ(cx, cy, 7.4, 0, 4, P.stone);
  v.cylZ(cx, cy, 7.4, 3, 4, P.stoneD, 6.3); // the rim's top
  v.cylZ(cx, cy, 6.3, 1, 4, 0);
  v.cylZ(cx, cy, 6.3, 1, 2, P.water); // water surface at z 1
  v.cylZ(cx, cy, 6.3, 1, 2, P.waterL, 5.6); // a light line along the rim
  // ripples: a light ring stepping out with the frame (none when still)
  if (f > 0) {
    const r = 1.8 + f * 1.3;
    v.cylZ(cx, cy, r + 0.55, 1, 2, P.waterL, r - 0.45);
  }
  v.cylZ(cx, cy, 1.5, 1, 9, P.stone); // column
  v.cylZ(cx, cy, 3.5, 9, 11, P.stone); // bowl
  v.cylZ(cx, cy, 3.6, 10, 11, P.stoneD, 2.6);
  v.cylZ(cx, cy, 2.6, 10, 11, P.water);
  // the jet: a column of water with a foam crown, its height changing each frame
  const jet = [4, 8, 11, 7][f];
  v.box(cx - 1, cy - 1, 11, cx + 1, cy + 1, 11 + jet, P.waterL);
  v.box(cx - 1, cy - 1, 11 + jet, cx + 1, cy + 1, 12 + jet, P.foam);
  if (f === 0) {
    // still: a bubbling crown on the bowl
    for (const [x, y] of [
      [cx - 2, cy],
      [cx + 1, cy - 2],
      [cx, cy + 1],
    ])
      v.set(x, y, 11, P.foam);
  } else {
    // drops arcing out from the top of the jet towards the basin
    const t = f / 3;
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4 + f * 0.4;
      const rr = 1.6 + t * 4;
      const z = Math.round(11 + jet - t * t * (jet + 4));
      v.set(Math.floor(cx + Math.cos(a) * rr), Math.floor(cy + Math.sin(a) * rr), Math.max(2, z), k % 2 ? P.foam : P.waterL);
    }
  }
  return v;
}

// ---------- statue of USA-9 ----------
// The mascot as in the portrait art: a wide white head with a grey shade on its right, a dark visor with two lime
// eyes, a pink mouth light, tall ears (pink inside, white outside) from the top corners, a dark body with a red chest
// panel, short legs, grey feet; on a two-step stone pedestal with a gold plaque on its front. Facing +y, turned for
// the other directions. The eyes are lit at night.
function statueModel(): Vox {
  const P = catalogPieceMats();
  const v = new Vox(16, 16, 31);
  // pedestal: a plinth, a block with a gold plaque (a lime bolt on it, no text), a cornice
  v.box(2, 2, 0, 14, 14, 2, P.stoneD);
  v.box(3, 3, 2, 13, 13, 7, P.stone);
  v.box(2, 2, 7, 14, 14, 8, P.stoneD);
  v.box(6, 13, 3, 10, 14, 6, P.plaque);
  v.box(7, 13, 4, 9, 14, 5, M.limeD);
  const z0 = 8;
  // feet and short legs
  for (const x of [5, 9]) {
    v.box(x, 6, z0, x + 2, 11, z0 + 1, P.usaFeet);
    v.box(x, 7, z0 + 1, x + 2, 10, z0 + 3, P.usaBody);
  }
  // body with a big red chest panel, arms by its sides
  v.box(4, 6, z0 + 3, 12, 11, z0 + 8, P.usaBody);
  v.box(5, 10, z0 + 4, 11, 11, z0 + 7, M.red);
  v.box(11, 6, z0 + 4, 12, 10, z0 + 7, M.red);
  v.box(3, 7, z0 + 3, 4, 10, z0 + 7, P.usaBody);
  v.box(12, 7, z0 + 3, 13, 10, z0 + 7, P.usaBody);
  v.box(3, 7, z0 + 3, 4, 10, z0 + 4, P.usaFeet);
  v.box(12, 7, z0 + 3, 13, 10, z0 + 4, P.usaFeet);
  // head: white, wider than the body, grey on the right side and underneath
  const hz = z0 + 8;
  v.box(3, 5, hz, 13, 12, hz + 7, M.white);
  v.box(12, 5, hz, 13, 12, hz + 7, P.usaShade);
  v.box(3, 5, hz, 13, 12, hz + 1, P.usaShade);
  // visor with two lime eyes, a pink mouth light under it, a red chevron on the forehead
  v.box(4, 11, hz + 2, 12, 12, hz + 5, M.ink);
  v.box(5, 11, hz + 3, 7, 12, hz + 5, M.limeLit);
  v.box(9, 11, hz + 3, 11, 12, hz + 5, M.limeLit);
  v.box(7, 11, hz + 1, 9, 12, hz + 2, M.pink);
  v.box(7, 11, hz + 6, 9, 12, hz + 7, M.red);
  v.set(7, 11, hz + 5, M.red);
  v.set(8, 11, hz + 5, M.red);
  // ears from the head's top corners: tall blades, pink outside, white inside, dark tips
  for (const x of [3, 11]) {
    v.box(x, 7, hz + 7, x + 2, 10, hz + 13, M.pink);
    v.box(x + (x < 8 ? 1 : 0), 8, hz + 7, x + (x < 8 ? 2 : 1), 10, hz + 12, M.white);
    v.box(x, 7, hz + 13, x + 2, 10, hz + 14, M.ink);
  }
  return v;
}

export function statuePiece(dir: number): Vox {
  return facingDir(statueModel(), dir);
}

// ---------- concrete base (ground tile) ----------

const BASE = {
  slab: hex('#857f92'),
  slabL: hex('#928ca0'),
  slabD: hex('#76708a'),
  curb: hex('#b2adc0'),
  edge: hex('#3b3750'),
  joint: hex('#625d74'),
  rim: hex('#4b475e'),
  cover: hex('#6e6982'),
  stain: hex('#5c5868'),
};

function groundTile(shader: (x: number, y: number) => RGB): Image {
  const img = createImage(32, 16);
  for (let py = 0; py < 16; py++)
    for (let px = 0; px < 32; px++) {
      const X = px - 16 + 0.5;
      const Y = py + 0.5;
      const x = Y + X / 2;
      const y = Y - X / 2;
      if (x < 0 || y < 0 || x >= 16 || y >= 16) continue;
      const c = shader(x, y);
      const o = (py * 32 + px) * 4;
      img.data[o] = c[0];
      img.data[o + 1] = c[1];
      img.data[o + 2] = c[2];
      img.data[o + 3] = 255;
    }
  return img;
}

// Light concrete with a raised curb along its front edges, a dark joint where two slabs meet, aggregate speckles;
// inside, k = 0 plain, 1 an expansion joint across, 2 a round drain cover, 3 a crack and an oil stain.
export function baseTiles(): Record<string, Image> {
  const out: Record<string, Image> = {};
  for (let k = 0; k < 4; k++) {
    out[`t/base/${k}`] = groundTile((x, y) => {
      const ix = Math.floor(x);
      const iy = Math.floor(y);
      // whole-voxel bands (a 2:1 stair of 2-pixel steps on screen), only two of them so the edges do not turn into
      // a lace of alternating lines: a dark joint along the back edges, the curb's lit top along the front ones;
      // side by side the slabs read as raised blocks with a curb between them
      if (x < 1 || y < 1) return BASE.edge;
      if (x >= 15 || y >= 15) return BASE.curb;
      const n = hash(ix, iy, 3100 + k);
      let c = n > 0.93 ? BASE.slabL : n < 0.05 ? BASE.slabD : BASE.slab;
      if (k === 1 && Math.floor(x) === 8) c = BASE.joint;
      if (k === 2) {
        const d = Math.hypot(x - 8, y - 8);
        if (d < 3.2) c = d > 2.5 ? BASE.rim : (ix + iy) % 2 ? BASE.cover : BASE.rim;
      }
      if (k === 3) {
        if (Math.abs(y - 4 - (x - 3) * 0.55 - Math.sin(x * 1.3) * 0.6) < 0.45 && x > 3 && x < 11) c = BASE.joint;
        const d = Math.hypot(x - 10.5, y - 10.5);
        if (d < 2 + hash(ix, iy, 3200) * 0.9) c = BASE.stain;
      }
      return c;
    });
  }
  return out;
}

// A 2×2 patch of the four slabs: the base's catalogue icon (64×32, anchor on the top corner).
export function baseIcon(tiles: Record<string, Image>): { img: Image; ax: number; ay: number } {
  const img = createImage(64, 32);
  const put = (src: Image, ox: number, oy: number) => {
    for (let y = 0; y < src.h; y++)
      for (let x = 0; x < src.w; x++) {
        const s = (y * src.w + x) * 4;
        if (!src.data[s + 3]) continue;
        img.data.set(src.data.subarray(s, s + 4), ((oy + y) * img.w + ox + x) * 4);
      }
  };
  put(tiles['t/base/0'], 16, 0);
  put(tiles['t/base/1'], 32, 8);
  put(tiles['t/base/2'], 0, 8);
  put(tiles['t/base/3'], 16, 16);
  return { img, ax: 32, ay: 0 };
}

// ---------- low wall of pressed scrap ----------

export const WALL_H = 7;
const WALL_A = 6; // the wall spans 6..10 across its line
const WALL_B = 10;

// The colour of a pressed bale: a run along x or y is cut into 4-voxel bales (the upper course offset by 2, like
// bricks), each pressed from one kind of scrap; the hub where runs meet is a grey bale.
function baleOf(run: 'x' | 'y' | 'hub', along: number, course: number, layer: number): number {
  const P = catalogPieceMats();
  const list = [P.baleRust, P.baleBlue, P.baleGreen, P.baleGrey, P.baleRed, P.baleTan];
  const dark = [P.baleRustD, P.baleBlueD, P.baleGreenD, P.baleGreyD, P.baleRedD, P.baleTanD];
  const k = run === 'hub' ? (course ? 3 : 0) : Math.floor(hash(Math.floor((along + course * 2) / 4), course + (run === 'x' ? 0 : 7), 911) * list.length);
  // a pressed bale shows its squashed layers: every other voxel row a shade darker
  return layer % 2 ? dark[k] : list[k];
}

// Fill one voxel of wall: the bale's colour, a scattered fleck of other scrap, a dark seam at each bale's start.
function wallVoxel(v: Vox, x: number, y: number, z: number, run: 'x' | 'y' | 'hub'): void {
  const P = catalogPieceMats();
  const course = z < 3 ? 0 : 1;
  const along = run === 'x' ? x : y;
  let m = baleOf(run, along, course, z);
  const seam = run !== 'hub' && (along + course * 2) % 4 === 0;
  if (seam) m = P.strap;
  else if (hash(x * 3 + y, z, 913) > 0.86) m = [M.steelL, M.rust, M.yellow, P.baleBlue][Math.floor(hash(x, y + z, 917) * 4)];
  v.set(x, y, z, m);
}

export type WallShape = number | 'x' | 'y';

export function wallPiece(shape: WallShape): Vox {
  const P = catalogPieceMats();
  const v = new Vox(16, 16, WALL_H + 1);
  let n = false;
  let e = false;
  let s = false;
  let w = false;
  const ends: ('n' | 'e' | 's' | 'w')[] = [];
  if (shape === 'x') {
    e = w = true;
    ends.push('w', 'e');
  } else if (shape === 'y') {
    n = s = true;
    ends.push('n', 's');
  } else {
    n = !!(shape & 1);
    e = !!(shape & 2);
    s = !!(shape & 4);
    w = !!(shape & 8);
    // a single neighbour: the wall runs right across the tile and ends on the far side
    if (n && !e && !s && !w) (s = true), ends.push('s');
    else if (e && !n && !s && !w) (w = true), ends.push('w');
    else if (s && !n && !e && !w) (n = true), ends.push('n');
    else if (w && !n && !e && !s) (e = true), ends.push('e');
  }
  const xRun = e || w;
  const yRun = n || s;
  const hubRun: 'x' | 'y' | 'hub' = xRun && !yRun ? 'x' : yRun && !xRun ? 'y' : 'hub';
  // bale heights: two courses of 3, the upper bales a voxel taller or not by hash (an uneven, hand-stacked top)
  const top = (run: 'x' | 'y' | 'hub', along: number) => (run === 'hub' ? WALL_H : 6 + (hash(Math.floor((along + 2) / 4), run === 'x' ? 3 : 5, 919) > 0.5 ? 1 : 0));
  const fill = (x0: number, y0: number, x1: number, y1: number, run: 'x' | 'y' | 'hub') => {
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const h = top(run, run === 'y' ? y : x);
        for (let z = 0; z < h; z++) wallVoxel(v, x, y, z, run);
      }
  };
  if (w) fill(0, WALL_A, WALL_A, WALL_B, 'x');
  if (e) fill(WALL_B, WALL_A, 16, WALL_B, 'x');
  if (n) fill(WALL_A, 0, WALL_B, WALL_A, 'y');
  if (s) fill(WALL_A, WALL_B, WALL_B, 16, 'y');
  fill(WALL_A, WALL_A, WALL_B, WALL_B, hubRun);
  // steel straps binding the bales: a band along the top edge of each visible face
  if (xRun) v.paint(0, WALL_B - 1, 2, 16, WALL_B, 3, P.strap);
  if (yRun) v.paint(WALL_B - 1, 0, 2, WALL_B, 16, 3, P.strap);
  // an end where a run stops in this tile: a steel end plate with hazard stripes
  for (const end of ends) {
    if (end === 'w') v.box(0, WALL_A, 0, 1, WALL_B, WALL_H, M.steelD);
    if (end === 'e') v.box(15, WALL_A, 0, 16, WALL_B, WALL_H, M.steelD);
    if (end === 'n') v.box(WALL_A, 0, 0, WALL_B, 1, WALL_H, M.steelD);
    if (end === 's') v.box(WALL_A, 15, 0, WALL_B, 16, WALL_H, M.steelD);
  }
  for (const end of ends) {
    if (end === 'e') hazardBand(v, 15, WALL_A, WALL_H - 2, 16, WALL_B, WALL_H);
    if (end === 's') hazardBand(v, WALL_A, 15, WALL_H - 2, WALL_B, 16, WALL_H);
  }
  return v;
}

// ---------- corner pillar ----------
// A 6×6 column of stacked concrete blocks on a plinth, a stepped steel cap and a round lamp on top (lit at night).
// Towards each side in the mask a stub reaches the tile edge on the shared line: a concrete collar as wide and as
// high as the wall (4 × 7) with a steel strap, so a wall runs straight into it and a fence's panel (on the line, 10
// high) ends against it.
export const PILLAR_H = 14;

export function pillarPiece(mask: number): Vox {
  const P = catalogPieceMats();
  const v = new Vox(16, 16, PILLAR_H + 6);
  // stubs: concrete collars as thick and as high as the wall, a steel strap round them, a bolt plate at the end
  const stub = (x0: number, y0: number, x1: number, y1: number) => {
    v.box(x0, y0, 0, x1, y1, WALL_H - 1, M.concrete);
    v.box(x0, y0, WALL_H - 1, x1, y1, WALL_H, M.concreteL);
    v.paint(x0, y0, 3, x1, y1, 4, M.steelD);
  };
  if (mask & 1) stub(WALL_A, 0, WALL_B, 5);
  if (mask & 2) stub(11, WALL_A, 16, WALL_B);
  if (mask & 4) stub(WALL_A, 11, WALL_B, 16);
  if (mask & 8) stub(0, WALL_A, 5, WALL_B);
  // plinth, column of blocks (alternating shades every 3), hazard band, cap
  v.box(4, 4, 0, 12, 12, 2, M.concrete);
  for (let z = 2; z < PILLAR_H - 1; z++) v.box(5, 5, z, 11, 11, z + 1, Math.floor((z - 2) / 3) % 2 ? M.concrete : M.concreteL);
  v.paint(5, 5, 2, 11, 11, 4, M.hazardY);
  hazardBand(v, 5, 5, 2, 11, 11, 4);
  v.box(4, 4, PILLAR_H - 1, 12, 12, PILLAR_H, M.steelD);
  // a stepped cap and the lamp: a warm round globe on a short stem, a little lid
  v.box(5, 5, PILLAR_H, 11, 11, PILLAR_H + 1, M.steel);
  v.box(7, 7, PILLAR_H + 1, 9, 9, PILLAR_H + 2, M.steelD);
  v.sphere(8, 8, PILLAR_H + 3.6, 2.1, P.lampWarm);
  return v;
}

// ---------- catalogue icons ----------

// A wall corner seen from outside: two runs meeting at the front corner, with their end plates.
export function wallIcon(): Vox {
  const v = new Vox(32, 32, WALL_H + 1);
  v.stamp(wallPiece(6), 0, 0, 0); // E + S: the corner
  v.stamp(wallPiece('x'), 16, 0, 0);
  v.stamp(wallPiece('y'), 0, 16, 0);
  return cropBox(v, WALL_A, WALL_A, 0, 26, 26, WALL_H + 1);
}

// A pillar with stubs on its two visible sides.
export function pillarIcon(): Vox {
  return pillarPiece(2 | 4);
}

// A box of a model, moved to the origin.
export function cropBox(src: Vox, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): Vox {
  const out = new Vox(x1 - x0, y1 - y0, z1 - z0);
  for (let z = z0; z < z1; z++)
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const m = src.get(x, y, z);
        if (m) out.set(x - x0, y - y0, z - z0, m);
      }
  return out;
}

// A model cropped to fit the catalogue's 64×44 picture box at 1×: to its content in x and y, then, if still too
// tall, without its lowest layers (a pedestal or a tree pit is the part to lose).
export function fitIcon(v: Vox, maxW = 64, maxH = 44): Vox {
  let x0 = v.w;
  let y0 = v.d;
  let x1 = 0;
  let y1 = 0;
  for (let z = 0; z < v.h; z++)
    for (let y = 0; y < v.d; y++)
      for (let x = 0; x < v.w; x++)
        if (v.get(x, y, z)) {
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x + 1);
          y1 = Math.max(y1, y + 1);
        }
  // keep x0 + y0 even: the projection works in half voxels, and an odd shift would break the half-voxel steps that
  // keep a sign's motif (or any upright shape) square on screen
  if ((x0 + y0) % 2) {
    if (x0 > 0) x0--;
    else y0--;
  }
  const top = v.top();
  const size = (zr: number) => [x1 - x0 + (y1 - y0) + 2, zr + Math.ceil((x1 - x0 + (y1 - y0)) / 2) + 2];
  let z0 = 0;
  while (z0 < top && (size(top - z0)[1] > maxH || size(top - z0)[0] > maxW)) z0++;
  return cropBox(v, x0, y0, z0, x1, y1, top);
}
