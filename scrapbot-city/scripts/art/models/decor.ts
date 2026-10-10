// Scenery around the playable map (and nothing inside it): trees, containers, crates, barrels, cones, benches,
// the "BETTER ROBOTS" billboard, ruins, a construction crane, wind turbines, fences, a forklift, a wrecked car,
// pipes, a cable pole and signs. A little darker and less saturated than the buildings so the city stays the
// focus, with a neon accent here and there (billboard text, beacons, a glowing toxic drum).
import { M } from '../palette';
import { Vox, hex, mat } from '../voxel';
import { hazardBand } from './common';

export interface DecorArt {
  name: string;
  w: number; // footprint in tiles (models are w*16 × d*16 voxels)
  d: number;
  frames: number; // animation frames (1 = static)
  fps: number;
  tall: boolean; // taller than ~10 voxels: only placed behind the map, never in front of it
  model(frame: number): Vox;
}

// ---------- scenery materials (muted versions of the game palette) ----------

const LEAF = mat('decor-leaf', { rgb: hex('#3d8a4b'), jitter: 0 });
const LEAF_D = mat('decor-leafD', { rgb: hex('#285d3e'), jitter: 0 });
const LEAF_L = mat('decor-leafL', { rgb: hex('#69ad55'), jitter: 0 });
const BLOSSOM = mat('decor-blossom', { rgb: hex('#d9709f'), jitter: 0.04 });
const BLOSSOM_D = mat('decor-blossomD', { rgb: hex('#a14a78'), jitter: 0.04 });
const BLOSSOM_L = mat('decor-blossomL', { rgb: hex('#f2a3c6'), jitter: 0.03 });
const BARK = mat('decor-bark', { rgb: hex('#5e4134'), jitter: 0.05 });
const DEADWOOD = mat('decor-deadwood', { rgb: hex('#7a6862'), jitter: 0.05 });
const GRASS = mat('decor-grass', { rgb: hex('#2f5638'), jitter: 0.06 });
const DIRT = mat('decor-dirt', { rgb: hex('#4a3d45'), jitter: 0.06 });
const WOOD = mat('decor-wood', { rgb: hex('#9c6d42'), jitter: 0.04 });
const WOOD_D = mat('decor-woodD', { rgb: hex('#674329'), jitter: 0.04 });
const CONT_B = mat('decor-contB', { rgb: hex('#3d5796'), jitter: 0.02 });
const CONT_BD = mat('decor-contBD', { rgb: hex('#2a3b6b'), jitter: 0.02 });
const CONT_R = mat('decor-contR', { rgb: hex('#9e5531'), jitter: 0.05 });
const CONT_RD = mat('decor-contRD', { rgb: hex('#6b3721'), jitter: 0.05 });
const CRANE = mat('decor-crane', { rgb: hex('#deae38'), jitter: 0.02 });
const CRANE_D = mat('decor-craneD', { rgb: hex('#9e7a25'), jitter: 0.02 });
const TURBINE = mat('decor-turbine', { rgb: hex('#dcd8e8'), jitter: 0.01 });
const CAR = mat('decor-car', { rgb: hex('#4f8189'), jitter: 0.04 });
const CAR_D = mat('decor-carD', { rgb: hex('#365a64'), jitter: 0.04 });
const POLE = mat('decor-pole', { rgb: hex('#6b4c38'), jitter: 0.04 });
const DRUM_G = mat('decor-drumG', { rgb: hex('#4f7a3c'), jitter: 0.03 });
const TYRE = mat('decor-tyre', { rgb: hex('#302c3b'), jitter: 0.03 });
const DUMP = mat('decor-dump', { rgb: hex('#3c6d4c'), jitter: 0.03 });
const DUMP_D = mat('decor-dumpD', { rgb: hex('#2a4d38'), jitter: 0.03 });
const FORK = mat('decor-fork', { rgb: hex('#e0b02e'), jitter: 0.02 });
const FORK_D = mat('decor-forkD', { rgb: hex('#9c7720'), jitter: 0.02 });
const PIPE = mat('decor-pipe', { rgb: hex('#7f86a6'), jitter: 0.02 });

// ---------- helpers ----------

const tile = (w: number, d: number, h: number) => new Vox(w * 16, d * 16, h);

// A straight run of voxels from a to b, 'size' voxels thick.
function line(v: Vox, a: readonly number[], b: readonly number[], m: number, size = 1): void {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), Math.abs(b[2] - a[2])) * 2));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = Math.floor(a[0] + (b[0] - a[0]) * t);
    const y = Math.floor(a[1] + (b[1] - a[1]) * t);
    const z = Math.floor(a[2] + (b[2] - a[2]) * t);
    v.box(x, y, z, x + size, y + size, z + size, m);
  }
}

// Leafy crown from a few balls: light top layer, dark underside (like the Pixel Garden's trees).
function crown(v: Vox, balls: readonly (readonly number[])[], base: number, light: number, dark: number): void {
  for (const [x, y, z, r] of balls) v.sphere(x, y, z, r, base);
  shadeLeaves(v, base, light, dark);
}

// Leafy crown from chunky blocks with their edges knocked off (the asset sheet's cube-cluster trees).
function blocks(v: Vox, list: readonly (readonly number[])[], base: number, light: number, dark: number): void {
  for (const [x0, y0, z0, x1, y1, z1] of list)
    for (let z = z0; z < z1; z++)
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          const ex = x === x0 || x === x1 - 1 ? 1 : 0;
          const ey = y === y0 || y === y1 - 1 ? 1 : 0;
          const ez = z === z0 || z === z1 - 1 ? 1 : 0;
          if (ex + ey + ez < 2) v.set(x, y, z, base);
        }
  shadeLeaves(v, base, light, dark);
}

function shadeLeaves(v: Vox, base: number, light: number, dark: number): void {
  for (let y = 0; y < v.d; y++)
    for (let x = 0; x < v.w; x++)
      for (let z = 0; z < v.h; z++) {
        if (v.get(x, y, z) !== base) continue;
        if (!v.get(x, y, z + 1)) v.set(x, y, z, light);
        else if (!v.get(x, y, z - 1) || z === 0) v.set(x, y, z, dark);
      }
}

// A wooden crate with a dark frame on its visible faces and a diagonal brace on the front-left face.
function crate(v: Vox, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, body = WOOD, frame = WOOD_D): void {
  v.box(x0, y0, z0, x1, y1, z1, body);
  // frame on the +y face, the +x face and the top
  for (let x = x0; x < x1; x++) {
    v.set(x, y1 - 1, z0, frame);
    v.set(x, y1 - 1, z1 - 1, frame);
    v.set(x, y0, z1 - 1, frame);
  }
  for (let y = y0; y < y1; y++) {
    v.set(x1 - 1, y, z0, frame);
    v.set(x1 - 1, y, z1 - 1, frame);
    v.set(x0, y, z1 - 1, frame);
  }
  for (let z = z0; z < z1; z++) {
    v.set(x0, y1 - 1, z, frame);
    v.set(x1 - 1, y1 - 1, z, frame);
    v.set(x1 - 1, y0, z, frame);
  }
  // diagonal braces
  const n = x1 - x0 - 2;
  for (let k = 0; k < n; k++) v.set(x0 + 1 + k, y1 - 1, z0 + 1 + Math.round((k * (z1 - z0 - 3)) / Math.max(1, n - 1)), frame);
  const m = y1 - y0 - 2;
  for (let k = 0; k < m; k++) v.set(x1 - 1, y0 + 1 + k, z1 - 2 - Math.round((k * (z1 - z0 - 3)) / Math.max(1, m - 1)), frame);
}

// An oil drum standing at (cx, cy) with two rings and a lid.
function drum(v: Vox, cx: number, cy: number, h: number, body: number, ring: number, lid = ring): void {
  v.cylZ(cx, cy, 2.6, 0, h, body);
  v.cylZ(cx, cy, 2.7, 2, 3, ring);
  v.cylZ(cx, cy, 2.7, h - 3, h - 2, ring);
  v.cylZ(cx, cy, 2.6, h - 1, h, ring);
  v.cylZ(cx, cy, 1.6, h - 1, h, lid);
}

// ---------- trees ----------

function treeRound(kind: 'a' | 'b' | 'blossom'): Vox {
  const v = tile(1, 1, 24);
  const [base, light, dark] = kind === 'blossom' ? [BLOSSOM, BLOSSOM_L, BLOSSOM_D] : [LEAF, LEAF_L, LEAF_D];
  v.cylZ(8, 8, 5.2, 0, 1, GRASS);
  v.box(7, 7, 0, 9, 9, 10, BARK);
  v.box(6, 7, 0, 10, 9, 1, BARK);
  v.box(7, 6, 0, 9, 10, 1, BARK);
  if (kind === 'b') {
    crown(
      v,
      [
        [8, 8, 14, 6],
        [5.2, 10.6, 11.4, 3.6],
        [10.8, 10.4, 12, 3.6],
        [8.4, 7.6, 18.6, 4],
      ],
      base,
      light,
      dark,
    );
  } else {
    blocks(
      v,
      [
        [3, 3, 9, 13, 13, 17],
        [5, 4, 16, 12, 11, 22],
        [2, 8, 7, 8, 14, 13],
        [9, 8, 8, 15, 14, 14],
        [9, 2, 12, 14, 7, 18],
      ],
      base,
      light,
      dark,
    );
  }
  if (kind === 'blossom') {
    // a few fallen petals on the grass
    v.box(11, 12, 0, 13, 13, 1, BLOSSOM);
    v.box(3, 10, 0, 4, 12, 1, BLOSSOM);
  }
  return v;
}

function treeDead(): Vox {
  const v = tile(1, 1, 22);
  v.cylZ(8, 8, 4.4, 0, 1, DIRT);
  v.box(7, 7, 0, 9, 9, 13, DEADWOOD);
  v.box(6, 7, 0, 10, 9, 1, DEADWOOD);
  v.box(7, 6, 0, 9, 10, 1, DEADWOOD);
  // main limbs (chunky) then thin twigs
  line(v, [8, 7.5, 9], [11.5, 9, 14], DEADWOOD, 2);
  line(v, [12.5, 9.5, 15], [14.5, 10, 19], DEADWOOD);
  line(v, [12.5, 9.5, 15], [14.5, 8, 16], DEADWOOD);
  line(v, [7, 8, 8], [4, 10.5, 13], DEADWOOD, 2);
  line(v, [4, 11, 14], [2, 12, 17], DEADWOOD);
  line(v, [4, 11, 14], [3, 13.5, 14], DEADWOOD);
  line(v, [7.5, 7.5, 13], [8.5, 6.5, 18], DEADWOOD, 2);
  line(v, [9, 6.5, 19], [10, 5, 21], DEADWOOD);
  line(v, [8.5, 7, 19], [6, 6, 21], DEADWOOD);
  // an old tyre swing on the right limb
  line(v, [12.5, 9.5, 14], [12.5, 9.5, 7], M.steelL);
  for (let a = 0; a < 16; a++) {
    const t = (a / 16) * Math.PI * 2;
    v.box(Math.floor(12.5 + Math.cos(t) * 2.2), 9, Math.floor(4.5 + Math.sin(t) * 2.2), Math.floor(12.5 + Math.cos(t) * 2.2) + 1, 11, Math.floor(4.5 + Math.sin(t) * 2.2) + 1, TYRE);
  }
  return v;
}

// ---------- containers, crates, barrels ----------

function container(body: number, dark: number, label: string, labelColor: number, z0 = 0, into?: Vox): Vox {
  const v = into ?? tile(2, 1, 14);
  const x0 = 1;
  const x1 = 31;
  const y0 = 2;
  const y1 = 14;
  const z1 = z0 + 13;
  v.box(x0, y0, z0, x1, y1 - 1, z1, body);
  // corrugated walls: ribs stand out of the +y wall, 2 voxels wide every 4
  for (let x = x0 + 2; x < x1 - 2; x++) if (Math.floor((x - x0) / 2) % 2 === 1) v.box(x, y1 - 1, z0 + 1, x + 1, y1, z1 - 1, body);
  // frame: rails top and bottom, corner posts
  v.box(x0, y1 - 1, z0, x1, y1, z0 + 1, dark);
  v.box(x0, y1 - 1, z1 - 1, x1, y1, z1, dark);
  v.box(x0, y1 - 1, z0, x0 + 2, y1, z1, dark);
  v.box(x1 - 2, y1 - 1, z0, x1, y1, z1, dark);
  v.box(x1 - 1, y0, z0, x1, y1, z0 + 1, dark);
  v.box(x1 - 1, y0, z1 - 1, x1, y1, z1, dark);
  v.box(x1 - 1, y0, z0, x1, y0 + 1, z1, dark);
  // roof: a dark rim and faint ribs across
  for (let x = x0 + 2; x < x1 - 2; x += 4) v.paint(x, y0 + 1, z1 - 1, x + 1, y1 - 2, z1, dark);
  // doors on the +x end: a seam and four lock rods
  v.paint(x1 - 1, 7, z0 + 1, x1, 9, z1 - 1, dark);
  for (const y of [4, 10]) v.paint(x1 - 1, y, z0 + 1, x1, y + 1, z1 - 1, M.steelL);
  for (const y of [5, 11]) v.paint(x1 - 1, y, z0 + 5, x1, y + 1, z0 + 7, M.steelD);
  if (label) v.text(label, '+y', Math.round(16 - (label.length * 4 - 1) / 2), y1 - 1, z0 + 9, labelColor);
  return v;
}

function containerStack(): Vox {
  const v = tile(2, 1, 27);
  container(CONT_R, CONT_RD, '', M.white, 0, v);
  container(CONT_B, CONT_BD, '2PM', M.pink, 13, v);
  return v;
}

function crates(): Vox {
  const v = tile(1, 1, 11);
  // pallet
  v.box(1, 1, 0, 10, 10, 1, WOOD_D);
  crate(v, 2, 2, 1, 9, 9, 7);
  crate(v, 3, 3, 7, 8, 8, 11, WOOD, WOOD_D);
  crate(v, 9, 7, 0, 15, 13, 6, WOOD, WOOD_D);
  crate(v, 2, 10, 0, 7, 15, 5, WOOD, WOOD_D);
  // a pink 2PM shipping mark on the big crate
  v.box(4, 8, 3, 7, 9, 5, M.pinkD);
  return v;
}

function barrels(): Vox {
  const v = tile(1, 1, 9);
  drum(v, 4.5, 4.5, 8, M.rust, M.rustD);
  drum(v, 10.5, 4, 8, CONT_B, CONT_BD);
  // the toxic one: green with a hazard ring and glowing goo on top, a glowing puddle beside it
  drum(v, 5, 10.5, 8, DRUM_G, M.hazardY, M.limeLit);
  v.box(1, 13, 0, 4, 15, 1, M.limeLit);
  v.box(2, 14, 0, 6, 16, 1, M.limeLit);
  // one lying on its side
  v.cylX(11.5, 2.5, 2.6, 9, 15, M.rust);
  v.cylX(11.5, 2.5, 2.7, 10, 11, M.rustD);
  v.cylX(11.5, 2.5, 2.7, 13, 14, M.rustD);
  v.cylX(11.5, 2.5, 1.5, 14, 15, M.rustD);
  return v;
}

function cones(frame: number): Vox {
  const v = tile(1, 1, 11);
  // a striped barricade at the back with a flashing lamp
  for (const x of [2, 12]) {
    v.box(x - 1, 3, 0, x + 3, 6, 1, M.steelD);
    v.box(x, 4, 1, x + 2, 5, 7, M.steelL);
  }
  v.box(1, 4, 4, 15, 5, 7, M.hazardY);
  hazardBand(v, 1, 4, 4, 15, 5, 7);
  v.box(12, 4, 7, 14, 5, 8, M.steelD);
  v.box(12, 4, 8, 14, 6, 10, frame % 2 === 0 ? M.orangeLit : M.orange);
  // three cones
  for (const [cx, cy] of [
    [4, 11],
    [9, 13],
    [13, 9],
  ]) {
    v.box(cx - 2, cy - 2, 0, cx + 2, cy + 2, 1, M.orange);
    v.cone(cx, cy, 1, 8, 1.9, 0.7, M.orange);
    v.paint(cx - 2, cy - 2, 3, cx + 2, cy + 2, 5, M.white);
  }
  return v;
}

// ---------- street furniture ----------

function bench(): Vox {
  const v = tile(1, 1, 9);
  // cast-iron sides
  for (const x of [3, 12]) {
    v.box(x, 6, 0, x + 1, 7, 9, M.steelD);
    v.box(x, 10, 0, x + 1, 11, 4, M.steelD);
    v.box(x, 6, 3, x + 1, 11, 4, M.steelD);
  }
  // seat slats and backrest
  v.box(1, 7, 3, 15, 11, 4, WOOD);
  v.paint(1, 8, 3, 15, 9, 4, WOOD_D);
  v.paint(1, 10, 3, 15, 11, 4, WOOD_D);
  v.box(1, 6, 5, 15, 7, 9, WOOD);
  v.paint(1, 6, 6, 15, 7, 7, WOOD_D);
  // a crumpled can somebody left
  v.box(7, 13, 0, 9, 14, 2, M.pink);
  return v;
}

function billboard(): Vox {
  const v = tile(2, 1, 38);
  // concrete feet and two steel posts
  for (const x of [6, 22]) {
    v.box(x - 1, 5, 0, x + 4, 10, 2, M.concrete);
    v.box(x, 6, 2, x + 3, 9, 12, M.steel);
  }
  // panel: pink frame, white field, the slogan in glowing pink
  v.box(2, 7, 12, 30, 10, 31, M.pink);
  v.box(2, 7, 12, 30, 8, 31, M.pinkD);
  v.box(4, 9, 14, 28, 10, 29, M.white);
  v.text('BETTER', '+y', 4, 9, 27, M.pinkLit);
  v.text('ROBOTS', '+y', 4, 9, 20, M.pinkLit);
  // a 2PM tab on top
  v.box(17, 7, 31, 30, 10, 38, M.pink);
  v.text('2PM', '+y', 18, 9, 36, M.white);
  // catwalk under the panel and two spotlights
  v.box(2, 10, 11, 30, 13, 12, M.steelD);
  for (const x of [5, 12]) {
    v.box(x, 10, 31, x + 1, 13, 32, M.steelD);
    v.box(x - 1, 12, 30, x + 2, 14, 31, M.steelD);
    v.box(x, 12, 29, x + 1, 14, 30, M.yellowLit);
  }
  return v;
}

function sign(): Vox {
  const v = tile(1, 1, 11);
  for (const x of [3, 11]) v.box(x, 8, 0, x + 2, 9, 9, M.steel);
  v.box(1, 9, 3, 15, 11, 10, M.pinkD);
  v.box(2, 10, 4, 14, 11, 9, M.pink);
  v.text('2PM', '+y', 3, 10, 8, M.white);
  return v;
}

// A tall vertical warning sign reading S-C-R-A-P from top to bottom, letters glowing yellow at night.
function signScrap(): Vox {
  const v = tile(1, 1, 41);
  v.box(6, 6, 0, 10, 10, 1, M.concrete);
  v.box(7, 6, 1, 9, 8, 40, M.steelD);
  v.box(5, 8, 5, 12, 10, 38, M.hazardY);
  v.box(6, 9, 6, 11, 10, 37, M.dark);
  hazardBand(v, 5, 8, 37, 12, 10, 38);
  hazardBand(v, 5, 8, 5, 12, 10, 6);
  [...'SCRAP'].forEach((ch, i) => v.text(ch, '+y', 7, 9, 35 - i * 6, M.yellowLit));
  v.box(6, 6, 40, 10, 10, 41, M.steelD);
  return v;
}

function fence(): Vox {
  const v = tile(1, 1, 10);
  const y = 11;
  // chain-link: a diamond lattice between two rails
  for (let x = 0; x < 16; x++)
    for (let z = 1; z < 8; z++) if ((x + z) % 4 === 0 || (x - z + 64) % 4 === 0) v.set(x, y, z, M.steelL);
  v.box(0, y, 8, 16, y + 1, 9, M.steel);
  v.box(0, y, 0, 16, y + 1, 1, M.steelD);
  for (const x of [1, 13]) {
    v.box(x - 1, y - 1, 0, x + 3, y + 2, 1, M.concrete);
    v.box(x, y, 0, x + 2, y + 1, 10, M.steelD);
  }
  // a hazard plate wired to the mesh
  v.box(6, y + 1, 3, 10, y + 2, 7, M.hazardY);
  v.box(7, y + 1, 4, 9, y + 2, 6, M.hazardK);
  return v;
}

function forklift(): Vox {
  const v = tile(1, 1, 11);
  // body and counterweight
  v.box(4, 2, 1, 12, 10, 5, FORK);
  v.box(4, 1, 1, 12, 4, 6, FORK_D);
  v.box(4, 9, 4, 12, 10, 5, FORK_D);
  hazardBand(v, 4, 1, 1, 12, 2, 3);
  // wheels
  for (const [y, r] of [
    [3.5, 1.7],
    [8.5, 1.9],
  ] as const) {
    v.cylX(y, 1.6, r, 3, 4, M.ink);
    v.cylX(y, 1.6, r, 12, 13, M.ink);
    v.box(3, Math.floor(y), 1, 4, Math.floor(y) + 1, 2, M.steel);
    v.box(12, Math.floor(y), 1, 13, Math.floor(y) + 1, 2, M.steel);
  }
  // seat and steering wheel
  v.box(6, 4, 5, 10, 7, 6, M.ink);
  v.box(6, 4, 6, 10, 5, 8, M.ink);
  v.box(7, 8, 5, 9, 9, 7, M.steelD);
  // overhead guard
  for (const [x, y] of [
    [4, 3],
    [11, 3],
    [4, 9],
    [11, 9],
  ])
    v.box(x, y, 5, x + 1, y + 1, 10, M.hazardK);
  v.box(4, 3, 9, 12, 10, 10, M.hazardK);
  v.clear(6, 5, 9, 10, 8, 10);
  v.box(6, 6, 9, 10, 7, 10, M.hazardK);
  // mast and forks
  for (const x of [5, 10]) v.box(x, 10, 0, x + 1, 12, 11, M.steelD);
  v.box(5, 10, 10, 11, 12, 11, M.steelD);
  v.box(5, 11, 2, 11, 12, 6, M.steel);
  v.box(5, 12, 2, 7, 16, 3, M.steelL);
  v.box(9, 12, 2, 11, 16, 3, M.steelL);
  return v;
}

function scrapCar(): Vox {
  const v = tile(1, 1, 8);
  // lower body, sagging on the front-right corner where a wheel is missing
  v.box(1, 4, 1, 15, 12, 4, CAR);
  v.box(10, 8, 0, 15, 12, 1, CAR_D);
  v.clear(11, 4, 3, 15, 12, 4);
  v.box(11, 4, 2, 15, 12, 3, CAR);
  // cabin with a caved-in roof
  v.box(4, 5, 4, 11, 11, 7, CAR);
  v.clear(6, 6, 6, 9, 10, 7);
  v.box(4, 5, 4, 11, 11, 6, M.window);
  v.box(5, 5, 4, 10, 11, 5, CAR);
  v.box(4, 5, 4, 5, 11, 7, CAR);
  v.box(10, 5, 4, 11, 11, 7, CAR);
  v.box(4, 10, 6, 11, 11, 7, CAR);
  v.box(4, 5, 6, 11, 6, 7, CAR);
  // rust patches and an open hood showing the engine
  v.paint(1, 11, 1, 4, 12, 3, M.rustD);
  v.paint(8, 11, 2, 10, 12, 4, M.rust);
  v.paint(1, 4, 3, 3, 8, 4, M.rust);
  v.box(12, 6, 3, 14, 10, 4, M.rustD);
  v.box(11, 5, 3, 12, 11, 6, CAR_D);
  // headlights: one left, one smashed
  v.box(14, 5, 2, 15, 7, 3, M.yellow);
  v.box(14, 9, 2, 15, 11, 3, M.ink);
  // wheels (one missing) and the tyre lying in the dirt
  for (const [x, y] of [
    [2, 3],
    [2, 12],
    [11, 3],
  ]) v.box(x, y, 0, x + 3, y + 1, 3, TYRE);
  v.cylZ(12.5, 14, 2, 0, 1, TYRE, 0.9);
  return v;
}

function pipeRun(): Vox {
  const v = tile(2, 1, 11);
  // stands
  for (const x of [3, 14, 25]) {
    v.box(x - 1, 3, 0, x + 3, 14, 1, M.concrete);
    v.box(x, 4, 1, x + 2, 5, 6, M.steelD);
    v.box(x, 12, 1, x + 2, 13, 6, M.steelD);
    v.box(x, 4, 4, x + 2, 13, 5, M.steelD);
  }
  // big pipe that bends down into the ground at the right end, small pipe in front
  v.cylX(7, 7.5, 2.5, 0, 29, PIPE);
  v.cylZ(29.5, 7, 2.5, 0, 10, PIPE);
  v.box(27, 5, 5, 32, 10, 10, PIPE);
  v.cylX(11, 6.5, 1.5, 0, 32, M.rust);
  // flanges
  for (const x of [0, 10, 21]) v.cylX(7, 7.5, 3, x, x + 1, M.steelD);
  for (const x of [6, 18, 30]) v.cylX(11, 6.5, 2, x, x + 1, M.rustD);
  v.cylZ(29.5, 7, 3.1, 0, 1, M.steelD);
  // hazard band on the big pipe
  for (let x = 12; x < 20; x++) v.paint(x, 4, 4, x + 1, 11, 11, Math.floor(x / 2) % 2 ? M.hazardK : M.hazardY);
  // valve: a stub on the small pipe and a red hand wheel facing front
  v.box(19, 12, 5, 21, 14, 8, M.steelD);
  for (let x = 16; x < 25; x++)
    for (let z = 2; z < 11; z++) {
      const d = Math.hypot(x + 0.5 - 20, z + 0.5 - 6.5);
      if ((d > 2.4 && d < 3.5) || (d < 3 && (x === 19 || x === 20 || z === 6))) v.set(x, 14, z, M.red);
    }
  v.box(19, 14, 6, 21, 15, 8, M.steelL);
  return v;
}

function cablePole(): Vox {
  const v = tile(1, 1, 31);
  v.box(6, 6, 0, 10, 10, 1, DIRT);
  v.box(7, 7, 0, 9, 9, 29, POLE);
  // crossarm with insulators
  v.box(7, 2, 25, 9, 14, 27, POLE);
  for (const y of [3, 7, 12]) v.box(7, y, 27, 9, y + 1, 29, M.cyanD);
  // cables sagging away along x on both sides
  for (const y of [3, 7, 12])
    for (let x = 0; x < 16; x++) {
      if (x >= 7 && x < 9) continue;
      const d = x < 7 ? 7 - x : x - 8;
      v.set(x, y, 28 - Math.round((d * d) / 14), M.ink);
    }
  // transformer can and a warning plate
  v.cylZ(10.5, 8, 1.8, 16, 22, M.steelL);
  v.cylZ(10.5, 8, 1.9, 22, 23, M.steelD);
  v.box(9, 7, 18, 10, 9, 19, M.steelD);
  v.box(7, 9, 10, 9, 10, 13, M.hazardY);
  v.box(7, 9, 11, 9, 10, 12, M.hazardK);
  // guy wire to an anchor
  line(v, [8, 8, 22], [13, 13, 1], M.steelL);
  v.box(12, 12, 0, 15, 15, 1, M.concrete);
  return v;
}

// ---------- ruins and machines ----------

function ruinWall(): Vox {
  const v = tile(2, 1, 22);
  // broken top edge of the long wall, by column
  const H = [9, 13, 17, 19, 20, 20, 18, 15, 12, 10, 10, 11, 14, 16, 16, 15, 13, 13, 11, 8, 7, 7, 9, 12, 13, 12, 10, 8];
  for (let i = 0; i < H.length; i++) {
    const x = 2 + i;
    v.box(x, 3, 0, x + 1, 6, H[i], M.concrete);
    // the outer layer chips away a voxel lower here and there
    if (i % 5 === 2) v.clear(x, 5, H[i] - 2, x + 1, 6, H[i]);
  }
  // a short side wall coming forward on the left
  for (let y = 6; y < 13; y++) v.box(2, y, 0, 5, y + 1, Math.max(3, 14 - (y - 6) * 2), M.concrete);
  // window opening
  v.clear(14, 3, 6, 19, 6, 11);
  v.box(14, 3, 5, 19, 6, 6, M.concreteL);
  // floor slab line and dirty base
  v.paint(2, 3, 0, 30, 13, 2, M.concreteL);
  v.paint(2, 5, 8, 30, 6, 9, M.concreteL);
  v.paint(4, 6, 8, 5, 13, 9, M.concreteL);
  // faded pink graffiti
  v.text('2PM', '+y', 21, 5, 7, M.pinkD);
  // rebar sticking out of the broken tops
  for (const [x, len] of [
    [4, 4],
    [7, 3],
    [10, 2],
    [16, 3],
    [24, 3],
  ]) {
    const top = H[x - 2];
    v.box(x, 4, top, x + 1, 5, top + len, M.rust);
  }
  line(v, [6, 4, 21], [8, 6, 21], M.rust);
  v.box(15, 4, 11, 16, 5, 13, M.rust);
  v.box(17, 4, 11, 18, 5, 12, M.rust);
  // rubble in front
  v.box(8, 7, 0, 12, 10, 2, M.concrete);
  v.box(9, 8, 2, 11, 10, 3, M.concreteL);
  v.box(20, 9, 0, 23, 12, 2, M.concreteL);
  v.box(25, 7, 0, 28, 9, 3, M.concrete);
  v.box(26, 9, 0, 30, 10, 1, M.concreteL);
  v.box(13, 11, 0, 15, 13, 1, M.concrete);
  return v;
}

function crane(frame: number): Vox {
  const v = tile(2, 2, 69);
  const on = frame % 2 === 0;
  // footing
  v.box(8, 8, 0, 24, 24, 3, M.concrete);
  hazardBand(v, 8, 23, 1, 24, 24, 3);
  hazardBand(v, 23, 8, 1, 24, 24, 3);
  // lattice mast (5×5)
  const X0 = 13;
  const Y0 = 13;
  const S = 5;
  const ZT = 54;
  for (const [x, y] of [
    [X0, Y0],
    [X0 + S - 1, Y0],
    [X0, Y0 + S - 1],
    [X0 + S - 1, Y0 + S - 1],
  ])
    v.box(x, y, 3, x + 1, y + 1, ZT, CRANE);
  for (let z = 3, k = 0; z + 6 <= ZT; z += 6, k++) {
    // rungs
    v.box(X0, Y0, z, X0 + S, Y0 + 1, z + 1, CRANE);
    v.box(X0, Y0 + S - 1, z, X0 + S, Y0 + S, z + 1, CRANE);
    v.box(X0, Y0, z, X0 + 1, Y0 + S, z + 1, CRANE);
    v.box(X0 + S - 1, Y0, z, X0 + S, Y0 + S, z + 1, CRANE);
    // zigzag diagonals on the four faces
    const up = k % 2 === 0;
    for (let s = 0; s < 6; s++) {
      const a = Math.round((s * (S - 1)) / 5);
      const p = up ? a : S - 1 - a;
      v.set(X0 + p, Y0 + S - 1, z + s, CRANE);
      v.set(X0 + S - 1, Y0 + p, z + s, CRANE);
      v.set(X0 + p, Y0, z + s, CRANE);
      v.set(X0, Y0 + p, z + s, CRANE);
    }
  }
  // vertical 2PM banner on the mast (letters stacked, read top to bottom)
  v.box(X0, Y0 + S, 21, X0 + S, Y0 + S + 1, 43, M.pink);
  v.box(X0, Y0 + S, 21, X0 + S, Y0 + S + 1, 22, M.pinkD);
  v.box(X0, Y0 + S, 42, X0 + S, Y0 + S + 1, 43, M.pinkD);
  v.text('2', '+y', X0 + 1, Y0 + S, 40, M.white);
  v.text('P', '+y', X0 + 1, Y0 + S, 34, M.white);
  v.text('M', '+y', X0 + 1, Y0 + S, 28, M.white);
  // turntable and cab
  v.box(12, 12, ZT, 19, 19, ZT + 2, M.steelD);
  v.box(18, 13, 48, 23, 19, ZT, M.white);
  v.box(18, 13, ZT - 1, 23, 19, ZT, CRANE_D);
  v.box(22, 14, 50, 23, 18, 53, M.glass);
  v.box(19, 18, 50, 22, 19, 53, M.glass);
  // jib towards +x: a box truss with zigzag sides
  const JZ = ZT + 2;
  for (const y of [13, 17]) {
    v.box(13, y, JZ, 32, y + 1, JZ + 1, CRANE);
    v.box(13, y, JZ + 3, 32, y + 1, JZ + 4, CRANE);
    for (let x = 13; x < 32; x++) {
      const p = x % 6;
      const z = p < 3 ? p : 6 - p;
      v.set(x, y, JZ + z, CRANE);
    }
  }
  for (let x = 14; x < 32; x += 3) {
    v.box(x, 13, JZ + 3, x + 1, 18, JZ + 4, CRANE);
    v.box(x, 13, JZ, x + 1, 18, JZ + 1, CRANE);
  }
  // counter-jib towards −x with its concrete counterweights
  v.box(1, 13, JZ, 13, 18, JZ + 1, CRANE_D);
  v.box(1, 13, JZ + 1, 13, 14, JZ + 3, CRANE);
  v.box(1, 17, JZ + 1, 13, 18, JZ + 3, CRANE);
  v.box(1, 12, JZ - 6, 7, 19, JZ, M.concrete);
  v.paint(1, 12, JZ - 3, 7, 19, JZ - 2, M.concreteL);
  // tower head and the pendant lines
  for (const [x, y] of [
    [13, 13],
    [17, 13],
    [13, 17],
    [17, 17],
  ])
    line(v, [x, y, JZ], [15, 15, 65], CRANE);
  v.box(15, 15, 64, 17, 17, 66, CRANE_D);
  line(v, [16, 15, 65], [31, 15, JZ + 3], M.steelL);
  line(v, [15, 15, 65], [1, 15, JZ + 3], M.steelL);
  // beacon
  v.box(15, 15, 66, 17, 17, 68, on ? M.redLit : M.red);
  v.box(30, 15, JZ + 4, 32, 17, JZ + 5, on ? M.redLit : M.red);
  v.point('light', 16, 16, 68);
  // trolley, hook and a bundle of beams
  v.box(24, 13, JZ - 1, 28, 18, JZ, M.steelD);
  v.box(25, 15, 41, 26, 16, JZ - 1, M.ink);
  v.box(26, 15, 41, 27, 16, JZ - 1, M.ink);
  v.box(24, 14, 38, 28, 17, 41, M.hazardY);
  hazardBand(v, 24, 14, 38, 28, 17, 41);
  v.box(25, 15, 36, 27, 16, 38, M.steelD);
  line(v, [26, 15, 36], [21, 15, 33], M.ink);
  line(v, [26, 15, 36], [31, 15, 33], M.ink);
  v.box(20, 13, 30, 32, 15, 33, M.rust);
  v.box(20, 15, 30, 32, 18, 32, M.rustD);
  return v;
}

function windTurbine(frame: number): Vox {
  const v = tile(2, 1, 57);
  const cx = 16;
  const cy = 7;
  // base and tower
  v.cylZ(cx, cy, 3.6, 0, 2, M.concrete);
  v.cylZ(cx, cy, 3.6, 1, 2, M.sandD);
  v.cone(cx, cy, 2, 40, 2.3, 1.3, TURBINE);
  v.paint(15, 8, 2, 17, 10, 6, M.steelD);
  // nacelle pointing to the front-left, a red light on top
  v.box(14, 3, 38, 18, 11, 43, TURBINE);
  v.box(14, 3, 38, 18, 4, 43, M.steelL);
  v.box(16, 4, 43, 18, 6, 44, M.redLit);
  // hub and pink nose
  v.box(15, 11, 39, 17, 13, 42, TURBINE);
  v.box(15, 13, 39, 17, 14, 41, M.pink);
  // three blades turning 30° per frame (120° symmetry: four frames make a seamless loop)
  const hx = 16;
  const hz = 40.5;
  const L = 14.2;
  for (let k = 0; k < 3; k++) {
    const a = Math.PI / 2 + (frame * Math.PI) / 6 + (k * 2 * Math.PI) / 3;
    const c = Math.cos(a);
    const s = Math.sin(a);
    for (let z = 24; z < 57; z++)
      for (let x = 0; x < 32; x++) {
        const dx = x + 0.5 - hx;
        const dz = z + 0.5 - hz;
        const t = dx * c + dz * s;
        const p = Math.abs(-dx * s + dz * c);
        if (t < 1.2 || t > L) continue;
        const hw = t < 6 ? 1.05 : 0.72;
        if (p > hw) continue;
        v.set(x, 12, z, t > L - 3.6 ? M.pink : TURBINE);
      }
  }
  v.point('light', 17, 5, 44);
  return v;
}

// ---------- small extras ----------

function bush(): Vox {
  const v = tile(1, 1, 8);
  v.cylZ(8, 8, 5.6, 0, 1, GRASS);
  crown(
    v,
    [
      [5.6, 6.4, 3, 3.4],
      [10.4, 7.6, 3, 3.6],
      [7.6, 11, 2.6, 3.2],
    ],
    LEAF,
    LEAF_L,
    LEAF_D,
  );
  // a few pink flowers
  v.box(4, 9, 5, 5, 10, 6, M.pink);
  v.box(11, 10, 5, 12, 11, 6, M.pink);
  v.box(9, 4, 6, 10, 5, 7, M.pink);
  return v;
}

function tyres(): Vox {
  const v = tile(1, 1, 9);
  for (let k = 0; k < 4; k++) {
    v.cylZ(6, 6, 3.4, k * 2, k * 2 + 2, TYRE, 1.6);
    v.cylZ(6, 6, 3.5, k * 2 + 1, k * 2 + 2, M.steelD, 3);
  }
  // one leaning against the stack, one flat on the ground
  for (let a = 0; a < 24; a++) {
    const t = (a / 24) * Math.PI * 2;
    const x = Math.floor(12 + Math.cos(t) * 2.7);
    const z = Math.floor(3 + Math.sin(t) * 2.7);
    v.box(x, 6, z, x + 1, 8, z + 1, TYRE);
  }
  v.cylZ(6, 12, 3.2, 0, 2, TYRE, 1.5);
  return v;
}

function dumpster(): Vox {
  const v = tile(1, 1, 10);
  v.box(2, 4, 1, 14, 12, 8, DUMP);
  v.box(2, 4, 1, 14, 12, 2, DUMP_D);
  // slanted lid, open a crack, with scrap poking out
  v.box(2, 4, 8, 14, 9, 9, DUMP_D);
  v.box(2, 8, 8, 14, 12, 9, DUMP_D);
  v.box(5, 6, 9, 8, 8, 10, M.rust);
  v.box(9, 5, 9, 11, 7, 10, M.steelL);
  // side lift pockets and wheels
  v.box(14, 5, 4, 15, 11, 5, M.steelD);
  for (const [x, y] of [
    [3, 11],
    [12, 11],
    [12, 4],
  ]) v.box(x, y, 0, x + 1, y + 1, 1, M.ink);
  // a lime recycle stripe
  v.box(4, 12, 4, 12, 13, 6, M.limeD);
  return v;
}

export const DECOR: DecorArt[] = [
  { name: 'tree-round', w: 1, d: 1, frames: 1, fps: 1, tall: true, model: () => treeRound('a') },
  { name: 'tree-round-2', w: 1, d: 1, frames: 1, fps: 1, tall: true, model: () => treeRound('b') },
  { name: 'tree-blossom', w: 1, d: 1, frames: 1, fps: 1, tall: true, model: () => treeRound('blossom') },
  { name: 'tree-dead', w: 1, d: 1, frames: 1, fps: 1, tall: true, model: treeDead },
  { name: 'container', w: 2, d: 1, frames: 1, fps: 1, tall: true, model: () => container(CONT_B, CONT_BD, '2PM', M.white) },
  { name: 'container-rust', w: 2, d: 1, frames: 1, fps: 1, tall: true, model: () => container(CONT_R, CONT_RD, 'SCRAP', M.concreteL) },
  { name: 'container-stack', w: 2, d: 1, frames: 1, fps: 1, tall: true, model: containerStack },
  { name: 'crates', w: 1, d: 1, frames: 1, fps: 1, tall: false, model: crates },
  { name: 'barrels', w: 1, d: 1, frames: 1, fps: 1, tall: false, model: barrels },
  { name: 'cones', w: 1, d: 1, frames: 2, fps: 2, tall: false, model: cones },
  { name: 'bench', w: 1, d: 1, frames: 1, fps: 1, tall: false, model: bench },
  { name: 'billboard', w: 2, d: 1, frames: 1, fps: 1, tall: true, model: billboard },
  { name: 'ruin-wall', w: 2, d: 1, frames: 1, fps: 1, tall: true, model: ruinWall },
  { name: 'crane', w: 2, d: 2, frames: 2, fps: 2, tall: true, model: crane },
  { name: 'wind-turbine', w: 2, d: 1, frames: 4, fps: 6, tall: true, model: windTurbine },
  { name: 'fence', w: 1, d: 1, frames: 1, fps: 1, tall: false, model: fence },
  { name: 'forklift', w: 1, d: 1, frames: 1, fps: 1, tall: false, model: forklift },
  { name: 'scrap-car', w: 1, d: 1, frames: 1, fps: 1, tall: false, model: scrapCar },
  { name: 'pipe-run', w: 2, d: 1, frames: 1, fps: 1, tall: false, model: pipeRun },
  { name: 'cable-pole', w: 1, d: 1, frames: 1, fps: 1, tall: true, model: cablePole },
  { name: 'sign', w: 1, d: 1, frames: 1, fps: 1, tall: false, model: sign },
  { name: 'sign-scrap', w: 1, d: 1, frames: 1, fps: 1, tall: true, model: signScrap },
  { name: 'bush', w: 1, d: 1, frames: 1, fps: 1, tall: false, model: bush },
  { name: 'tyres', w: 1, d: 1, frames: 1, fps: 1, tall: false, model: tyres },
  { name: 'dumpster', w: 1, d: 1, frames: 1, fps: 1, tall: false, model: dumpster },
];
