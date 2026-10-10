// Scenery around the playable map (and nothing inside it): trees, containers, crates, barrels, cones, benches,
// the "BETTER ROBOTS" billboard, ruins, a construction crane, wind turbines, fences, a forklift, a wrecked car,
// pipes, a cable pole and signs. A little darker and less saturated than the buildings so the city stays the
// focus, with a neon accent here and there (billboard, beacons, a glowing toxic drum, the SCRAP sign).
import { M } from '../palette';
import { FONT, Vox, hex, mat } from '../voxel';
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

// ---------- scenery materials (only the tones the game palette lacks) ----------

const LEAF = mat('decor-leaf', { rgb: hex('#3d8a4b'), jitter: 0 });
const LEAF_L = mat('decor-leafL', { rgb: hex('#69ad55'), jitter: 0 });
const BLOSSOM = mat('decor-blossom', { rgb: hex('#d9709f'), jitter: 0 });
const BLOSSOM_D = mat('decor-blossomD', { rgb: hex('#a14a78'), jitter: 0 });
const BLOSSOM_L = mat('decor-blossomL', { rgb: hex('#f2a3c6'), jitter: 0 });
const BARK = mat('decor-bark', { rgb: hex('#5e4134'), jitter: 0.05 });
const DEADWOOD = mat('decor-deadwood', { rgb: hex('#7a6862'), jitter: 0.05 });
const GRASS = mat('decor-grass', { rgb: hex('#2f5638'), jitter: 0.06 });
const DIRT = mat('decor-dirt', { rgb: hex('#4a3d45'), jitter: 0.06 });
const WOOD = mat('decor-wood', { rgb: hex('#c99a5e'), jitter: 0.03 });
const WOOD_D = mat('decor-woodD', { rgb: hex('#4a2c1a'), jitter: 0.03 });
const CONT_B = mat('decor-contB', { rgb: hex('#3d5796'), jitter: 0.02 });
const CONT_BD = mat('decor-contBD', { rgb: hex('#2a3b6b'), jitter: 0.02 });
const CONT_R = mat('decor-contR', { rgb: hex('#9e5531'), jitter: 0.05 });
const CONT_RD = mat('decor-contRD', { rgb: hex('#6b3721'), jitter: 0.05 });
const CAR = mat('decor-car', { rgb: hex('#4f8189'), jitter: 0.03 });
const CAR_D = mat('decor-carD', { rgb: hex('#365a64'), jitter: 0.03 });
const PRIMER = mat('decor-primer', { rgb: hex('#a29fb0'), jitter: 0.03 });
const POLE = mat('decor-pole', { rgb: hex('#6b4c38'), jitter: 0.04 });
const DRUM_G = mat('decor-drumG', { rgb: hex('#4f7a3c'), jitter: 0.03 });
const TYRE = mat('decor-tyre', { rgb: hex('#4b4559'), jitter: 0.03 });
const DUMP = mat('decor-dump', { rgb: hex('#3c6d4c'), jitter: 0.03 });
// backlit sign face: plain by day, softly glowing at night (dark letters stay readable on it)
const LIGHTBOX_Y = mat('decor-lightboxY', { rgb: hex('#ffd440'), emit: 0.3, glow: hex('#ffcf4a'), flat: true, jitter: 0 });

// ---------- helpers ----------

const tile = (w: number, d: number, h: number) => new Vox(w * 16, d * 16, h);

// Pixel letters (3×5 font) with the isometric shear cancelled. On the +y face every column lands half a pixel
// lower on screen than the one before it (on the +x face half a pixel higher), which tears the third column of a
// glyph off its row; lifting (or dropping) each column by the right amount keeps every glyph square on screen.
// On '+y' columns rise by up to 1 voxel above zTop, on '+x' they drop up to 1 below zTop − 4: leave that room.
// paintOnly: recolour the existing wall only (a sprayed tag on a broken wall).
function isoText(v: Vox, str: string, face: '+x' | '+y', x: number, y: number, zTop: number, m: number, paintOnly = false): void {
  let cur = 0;
  for (const ch of str.toUpperCase()) {
    const g = FONT[ch];
    if (!g) {
      cur += 2;
      continue;
    }
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 3; c++) {
        if (g[r][c] !== '#') continue;
        let px: number;
        let py: number;
        let pz: number;
        if (face === '+y') {
          const gx = x + cur;
          px = gx + c;
          py = y;
          pz = zTop - r + Math.floor((px + y) / 2) - Math.floor((gx + y) / 2);
        } else {
          const gy = y - cur;
          px = x;
          py = gy - c;
          pz = zTop - r + Math.floor((x + py) / 2) - Math.floor((x + gy) / 2);
        }
        if (!paintOnly || v.get(px, py, pz)) v.set(px, py, pz, m);
      }
    cur += 4;
  }
}

const textW = (str: string) => str.length * 4 - 1;

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

// Leafy crown from a few soft cubes (superellipsoids: flat tops and sides, rounded corners, so the surface does not
// break into a voxel staircase), shaded in clean bands: a light cap where a lobe faces the sky, a dark band on its
// underside, the base colour between. Each lobe is [cx, cy, cz, r, rz?].
function balls(v: Vox, list: readonly (readonly number[])[], base: number, light: number, dark: number, p = 3): void {
  const inLobe = (l: readonly number[], x: number, y: number, z: number) => {
    const [cx, cy, cz, r] = l;
    const rz = l[4] ?? r;
    return Math.abs((x + 0.5 - cx) / r) ** p + Math.abs((y + 0.5 - cy) / r) ** p + Math.abs((z + 0.5 - cz) / rz) ** p <= 1;
  };
  const each = (l: readonly number[], f: (x: number, y: number, z: number) => void) => {
    const [cx, cy, cz, r] = l;
    const rz = l[4] ?? r;
    for (let z = Math.floor(cz - rz - 1); z <= Math.ceil(cz + rz + 1); z++)
      for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++)
        for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) if (inLobe(l, x, y, z)) f(x, y, z);
  };
  for (const l of list) each(l, (x, y, z) => v.set(x, y, z, base));
  const tone = new Map<number, [number, number, number, number]>();
  for (const l of list) {
    const cz = l[2];
    const rz = l[4] ?? l[3];
    each(l, (x, y, z) => {
      if (v.get(x, y, z) !== base) return;
      const k = (z * v.d + y) * v.w + x;
      if (!v.get(x, y, z + 1) && z + 0.5 >= cz + 0.35 * rz) tone.set(k, [x, y, z, light]);
      else if (tone.get(k)?.[3] !== light && z + 0.5 <= cz - 0.4 * rz && !v.get(x, y, z - 1)) tone.set(k, [x, y, z, dark]);
    });
  }
  for (const [x, y, z, m] of tone.values()) v.set(x, y, z, m);
}

// Leafy crown from chunky blocks with their edges knocked off (the asset sheet's cube-cluster trees):
// light top layer, dark bottom layer, the base colour between.
function blocks(v: Vox, list: readonly (readonly number[])[], base: number, light: number, dark: number): void {
  const inBlock = (b: readonly number[], x: number, y: number, z: number) => {
    const [x0, y0, z0, x1, y1, z1] = b;
    const edges = (x === x0 || x === x1 - 1 ? 1 : 0) + (y === y0 || y === y1 - 1 ? 1 : 0) + (z === z0 || z === z1 - 1 ? 1 : 0);
    return edges < 2;
  };
  for (const b of list)
    for (let z = b[2]; z < b[5]; z++) for (let y = b[1]; y < b[4]; y++) for (let x = b[0]; x < b[3]; x++) if (inBlock(b, x, y, z)) v.set(x, y, z, base);
  for (const pass of [dark, light])
    for (const b of list)
      for (let y = b[1]; y < b[4]; y++)
        for (let x = b[0]; x < b[3]; x++) {
          const z = pass === light ? b[5] - 1 : b[2];
          if (!inBlock(b, x, y, z) || v.get(x, y, z) === light) continue;
          if (pass === light && v.get(x, y, z + 1) && v.get(x, y, z + 1) !== light) continue;
          v.set(x, y, z, pass);
        }
}

// A wooden crate: chunky dark frame (2-voxel corner posts on the visible edges, rails top and bottom) and one
// dark plank band across the middle of each visible face.
function crate(v: Vox, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void {
  v.box(x0, y0, z0, x1, y1, z1, WOOD);
  // rails along the visible bottom edges and around the whole top
  v.box(x0, y1 - 1, z0, x1, y1, z0 + 1, WOOD_D);
  v.box(x1 - 1, y0, z0, x1, y1, z0 + 1, WOOD_D);
  v.box(x0, y0, z1 - 1, x1, y1, z1, WOOD_D);
  v.box(x0 + 1, y0 + 1, z1 - 1, x1 - 1, y1 - 1, z1, WOOD);
  // corner posts, 2 wide on each visible face
  v.box(x0, y1 - 1, z0, x0 + 2, y1, z1, WOOD_D);
  v.box(x1 - 2, y1 - 1, z0, x1, y1, z1, WOOD_D);
  v.box(x1 - 1, y0, z0, x1, y0 + 2, z1, WOOD_D);
  v.box(x1 - 1, y1 - 2, z0, x1, y1, z1, WOOD_D);
  // the plank band across the middle
  const h = z1 - z0 - 2;
  if (h >= 3) {
    const zb = z0 + 1 + Math.floor((h - 1) / 2);
    const n = h % 2 ? 1 : 2;
    v.box(x0, y1 - 1, zb, x1, y1, zb + n, WOOD_D);
    v.box(x1 - 1, y0, zb, x1, y1, zb + n, WOOD_D);
  }
}

// An oil drum standing at (cx, cy): two raised rings and a lid.
function drum(v: Vox, cx: number, cy: number, h: number, body: number, ring: number, lid = ring): void {
  v.cylZ(cx, cy, 2.6, 0, h, body);
  v.cylZ(cx, cy, 2.75, 2, 3, ring);
  v.cylZ(cx, cy, 2.75, h - 3, h - 2, ring);
  v.cylZ(cx, cy, 1.7, h - 1, h, lid);
}

// ---------- trees ----------

function treeRound(kind: 'a' | 'b' | 'blossom'): Vox {
  const v = tile(1, 1, 24);
  if (kind === 'a') {
    // a cluster of chunky leaf cubes (the asset sheet's tree) on a short trunk with a root flare
    v.cylZ(8, 8, 6, 0, 1, GRASS);
    v.box(7, 7, 0, 9, 9, 10, BARK);
    v.box(6, 7, 0, 10, 9, 2, BARK);
    v.box(7, 6, 0, 9, 10, 2, BARK);
    v.box(5, 7, 0, 11, 9, 1, BARK);
    v.box(7, 5, 0, 9, 11, 1, BARK);
    blocks(
      v,
      [
        [3, 3, 8, 13, 13, 15],
        [5, 5, 14, 11, 11, 20],
        [8, 9, 9, 15, 15, 14],
        [1, 8, 11, 7, 14, 16],
        [9, 2, 12, 15, 8, 18],
      ],
      LEAF,
      LEAF_L,
      M.greenD,
    );
    return v;
  }
  if (kind === 'b') {
    // a pine: square tiers stepping in towards the top, dark under each overhang, lit on top
    v.cylZ(8, 8, 5.2, 0, 1, GRASS);
    v.box(7, 7, 0, 9, 9, 7, BARK);
    v.box(6, 7, 0, 10, 9, 1, BARK);
    v.box(7, 6, 0, 9, 10, 1, BARK);
    blocks(
      v,
      [
        [5, 5, 9, 11, 11, 11],
        [5, 5, 13, 11, 11, 15],
        [6, 6, 17, 10, 10, 19],
      ],
      LEAF,
      LEAF,
      LEAF,
    );
    blocks(
      v,
      [
        [2, 2, 5, 14, 14, 9],
        [3, 3, 10, 13, 13, 13],
        [4, 4, 14, 12, 12, 17],
        [5, 5, 18, 11, 11, 21],
        [7, 7, 21, 9, 9, 24],
      ],
      LEAF,
      LEAF_L,
      M.greenD,
    );
    return v;
  }
  // a cherry tree: a wide soft pink crown on a forked trunk
  v.cylZ(8, 8, 5.4, 0, 1, GRASS);
  v.box(7, 7, 0, 9, 9, 10, BARK);
  v.box(6, 7, 0, 10, 9, 1, BARK);
  v.box(7, 6, 0, 9, 10, 1, BARK);
  line(v, [7.5, 8, 8], [5, 9, 11], BARK, 2);
  line(v, [8, 8, 8], [11, 9.5, 11], BARK, 2);
  balls(
    v,
    [
      [8, 8, 14, 5.6, 4],
      [4.5, 10, 12, 3.4, 2.8],
      [11.5, 10.5, 12.5, 3.4, 2.8],
      [10.5, 5, 15, 3.4, 3],
      [7.5, 7.5, 18.5, 3.8, 2.6],
    ],
    BLOSSOM,
    BLOSSOM_L,
    BLOSSOM_D,
  );
  // a few fallen petals on the grass
  v.box(11, 12, 0, 13, 13, 1, BLOSSOM_L);
  v.box(3, 10, 0, 4, 12, 1, BLOSSOM_L);
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
  // a couple of stones
  v.box(11, 11, 0, 13, 13, 2, M.concrete);
  v.box(3, 4, 0, 5, 5, 1, M.concrete);
  return v;
}

function bush(): Vox {
  const v = tile(1, 1, 8);
  v.cylZ(8, 8, 5.6, 0, 1, GRASS);
  balls(
    v,
    [
      [5.6, 6.4, 3, 3.4],
      [10.4, 7.6, 3, 3.6],
      [7.6, 11, 2.6, 3.2],
    ],
    LEAF,
    LEAF_L,
    M.greenD,
  );
  // a few pink flowers
  v.box(4, 9, 5, 6, 10, 6, M.pink);
  v.box(11, 10, 5, 13, 11, 6, M.pink);
  v.box(9, 4, 6, 11, 5, 7, M.pink);
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
  // roof: faint ribs across
  for (let x = x0 + 2; x < x1 - 2; x += 4) v.paint(x, y0 + 1, z1 - 1, x + 1, y1 - 2, z1, dark);
  // doors on the +x end: a seam and four lock rods
  v.paint(x1 - 1, 7, z0 + 1, x1, 9, z1 - 1, dark);
  for (const y of [4, 10]) v.paint(x1 - 1, y, z0 + 1, x1, y + 1, z1 - 1, M.steelL);
  for (const y of [5, 11]) v.paint(x1 - 1, y, z0 + 5, x1, y + 1, z0 + 7, M.steelD);
  if (label) {
    // a stencilled plate behind the letters so they read on the corrugation
    const w = textW(label);
    const lx = Math.round(16 - w / 2);
    v.box(lx - 1, y1 - 1, z0 + 3, lx + w + 1, y1, z0 + 11, dark);
    isoText(v, label, '+y', lx, y1 - 1, z0 + 9, labelColor);
  }
  return v;
}

function containerStack(): Vox {
  const v = tile(2, 1, 27);
  container(CONT_R, CONT_RD, '', M.white, 0, v);
  container(CONT_B, CONT_BD, '2PM', M.pink, 13, v);
  return v;
}

function crates(): Vox {
  const v = tile(1, 1, 12);
  crate(v, 1, 3, 0, 9, 11, 7);
  crate(v, 2, 4, 7, 7, 9, 12);
  crate(v, 10, 9, 0, 15, 14, 5);
  // a yellow stencil on the big crate
  v.box(4, 10, 2, 6, 11, 4, M.hazardY);
  return v;
}

function barrels(): Vox {
  const v = tile(1, 1, 9);
  drum(v, 4.5, 4.5, 8, M.rust, M.rustD);
  drum(v, 10.5, 4, 8, CONT_B, CONT_BD);
  // the toxic one: green with a hazard band and glowing goo on top, a glowing puddle beside it
  v.cylZ(5, 10.5, 2.6, 0, 8, DRUM_G);
  v.cylZ(5, 10.5, 2.75, 3, 5, M.hazardY);
  v.cylZ(5, 10.5, 2.6, 7, 8, M.limeD);
  v.cylZ(5, 10.5, 1.7, 7, 8, M.limeLit);
  v.box(1, 14, 0, 5, 16, 1, M.limeLit);
  // one lying on its side
  v.cylX(11.5, 2.5, 2.6, 9, 15, M.rust);
  v.cylX(11.5, 2.5, 2.75, 10, 11, M.rustD);
  v.cylX(11.5, 2.5, 2.75, 13, 14, M.rustD);
  v.cylX(11.5, 2.5, 1.6, 14, 15, M.rustD);
  return v;
}

// A stack of two painted tyres used as a planter, and one standing on its edge in front with a steel hubcap.
function tyres(): Vox {
  const v = tile(1, 1, 11);
  const tyre = (cx: number, cy: number, z: number, paint: number) => {
    v.cylZ(cx, cy, 3.1, z, z + 1, M.dark, 2);
    v.cylZ(cx, cy, 3.6, z + 1, z + 2, TYRE, 2);
    v.cylZ(cx, cy, 3.1, z + 2, z + 3, TYRE, 2);
    v.cylZ(cx, cy, 3.6, z + 1, z + 3, paint, 2.5);
  };
  tyre(4.5, 10, 0, M.yellow);
  tyre(4.5, 10, 3, M.pink);
  v.cylZ(4.5, 10, 2, 0, 5, DIRT);
  // the plant
  balls(v, [[4.5, 10, 7.5, 2.8]], LEAF, LEAF_L, M.greenD);
  v.box(3, 11, 8, 5, 12, 9, M.pink);
  v.box(5, 8, 9, 7, 9, 10, M.pink);
  // the standing tyre
  for (let x = 7; x < 16; x++)
    for (let z = 0; z < 9; z++) {
      const d = Math.hypot(x + 0.5 - 11.5, z + 0.5 - 3.8);
      if (d > 3.8 || d <= 1.4) continue;
      v.box(x, 12, z, x + 1, 14, z + 1, d > 3 ? M.dark : d > 2.2 ? TYRE : M.steelL);
    }
  return v;
}

function cones(frame: number): Vox {
  const v = tile(1, 1, 10);
  // a striped barricade at the back with a flashing lamp
  for (const x of [2, 12]) {
    v.box(x, 2, 0, x + 2, 7, 1, M.steelD);
    v.box(x, 4, 1, x + 2, 5, 7, M.steelL);
  }
  v.box(1, 5, 3, 15, 6, 7, M.hazardY);
  hazardBand(v, 1, 5, 3, 15, 6, 7);
  v.box(12, 4, 7, 14, 6, 8, M.steelD);
  v.box(12, 4, 8, 14, 6, 10, frame % 2 === 0 ? M.orangeLit : M.orange);
  // two big cones in front
  for (const [cx, cy] of [
    [4.5, 11.5],
    [11.5, 12.5],
  ]) {
    const x = Math.floor(cx);
    const y = Math.floor(cy);
    v.box(x - 2, y - 2, 0, x + 3, y + 3, 1, M.orange);
    v.cone(cx, cy, 1, 9, 2.2, 0.5, M.orange);
    v.paint(x - 2, y - 2, 4, x + 3, y + 3, 6, M.white);
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
  return v;
}

// The brand's billboard: cyan neon "BETTER ROBOTS" on a dark weathered panel in a pink frame, the 2PM tab on top.
function billboard(): Vox {
  const v = tile(2, 1, 38);
  // concrete feet and two steel posts
  for (const x of [6, 22]) {
    v.box(x - 1, 4, 0, x + 4, 9, 2, M.concrete);
    v.box(x, 5, 2, x + 3, 8, 12, M.steel);
  }
  // panel: pink frame, dark field, neon letters
  v.box(1, 6, 11, 31, 9, 31, M.pink);
  v.box(1, 6, 11, 31, 7, 31, M.pinkD);
  v.box(3, 8, 13, 29, 9, 29, M.dark);
  isoText(v, 'BETTER', '+y', 4, 8, 26, M.cyanLit);
  isoText(v, 'ROBOTS', '+y', 4, 8, 19, M.cyanLit);
  // rust running down from the top of the frame
  for (const x of [9, 24]) v.box(x, 8, 28, x + 1, 9, 31, M.rustD);
  v.box(9, 8, 29, 11, 9, 31, M.rustD);
  // the 2PM tab on top
  v.box(18, 6, 31, 31, 9, 38, M.pink);
  v.box(18, 6, 31, 31, 7, 38, M.pinkD);
  isoText(v, '2PM', '+y', 19, 8, 36, M.white);
  // catwalk under the panel with three floodlights aimed at it
  v.box(1, 9, 10, 31, 12, 11, M.steelD);
  for (const x of [5, 15, 25]) {
    v.box(x, 10, 11, x + 2, 12, 12, M.steelD);
    v.box(x, 10, 12, x + 2, 11, 13, M.yellowLit);
  }
  return v;
}

function sign(): Vox {
  const v = tile(1, 1, 11);
  for (const x of [3, 11]) v.box(x, 8, 0, x + 2, 9, 10, M.steel);
  v.box(0, 9, 2, 15, 11, 11, M.pinkD);
  v.box(1, 10, 3, 14, 11, 10, M.pink);
  isoText(v, '2PM', '+y', 2, 10, 8, M.white);
  return v;
}

// A tall vertical warning sign reading S-C-R-A-P from top to bottom on a backlit yellow face.
function signScrap(): Vox {
  const v = tile(1, 1, 41);
  v.box(6, 5, 0, 10, 9, 1, M.concrete);
  v.box(7, 6, 1, 9, 8, 40, M.steelD);
  v.box(5, 8, 5, 12, 10, 38, M.dark);
  v.box(6, 9, 6, 11, 10, 37, LIGHTBOX_Y);
  [...'SCRAP'].forEach((ch, i) => isoText(v, ch, '+y', 7, 9, 35 - i * 6, M.ink));
  hazardBand(v, 5, 8, 37, 12, 10, 38);
  hazardBand(v, 5, 8, 5, 12, 10, 6);
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

// Side-on to the front-left: a yellow body with a counterweight at the back, a thin black cage, black tyres
// sticking out below and two steel forks to the +x.
function forklift(): Vox {
  const v = tile(1, 1, 12);
  // body and counterweight, a dark skirt along the bottom
  v.box(2, 4, 1, 12, 11, 6, M.yellow);
  v.box(1, 4, 1, 5, 11, 8, M.yellow);
  v.box(1, 4, 1, 12, 11, 2, M.sandD);
  v.box(1, 4, 7, 5, 11, 8, M.orange);
  // wheels with grey hubs
  for (const x of [4.5, 10]) {
    v.cylY(x, 2, 2.2, 3, 4, M.ink);
    v.cylY(x, 2, 2.2, 11, 12, M.ink);
    v.box(Math.floor(x), 11, 1, Math.floor(x) + 1, 12, 3, M.steelL);
  }
  // seat and steering wheel
  v.box(6, 6, 6, 8, 9, 7, M.darkL);
  v.box(6, 6, 7, 7, 9, 9, M.darkL);
  v.box(10, 7, 6, 11, 8, 8, M.steelD);
  v.box(9, 6, 8, 11, 9, 9, M.steelD);
  // overhead guard: four thin black posts and two roof rails, an orange lamp on top
  for (const [x, y] of [
    [3, 4],
    [3, 10],
    [11, 4],
    [11, 10],
  ])
    v.box(x, y, 6, x + 1, y + 1, 11, M.ink);
  v.box(3, 4, 10, 12, 5, 11, M.ink);
  v.box(3, 10, 10, 12, 11, 11, M.ink);
  v.box(3, 9, 11, 5, 11, 12, M.orange);
  // mast, carriage and forks
  v.box(12, 5, 1, 13, 6, 11, M.ink);
  v.box(12, 9, 1, 13, 10, 11, M.ink);
  v.box(12, 5, 10, 13, 10, 11, M.ink);
  v.box(13, 5, 2, 14, 10, 4, M.steelD);
  v.box(13, 5, 1, 16, 7, 2, M.steelL);
  v.box(13, 8, 1, 16, 10, 2, M.steelL);
  return v;
}

function scrapCar(): Vox {
  const v = tile(1, 1, 9);
  // body, nose towards +x, dropped on the front-right corner where a wheel is missing
  v.box(1, 4, 1, 15, 11, 4, CAR);
  v.box(1, 4, 1, 15, 11, 2, CAR_D);
  v.clear(11, 4, 1, 15, 11, 4);
  v.box(11, 4, 0, 15, 11, 3, CAR);
  v.box(11, 4, 0, 15, 11, 1, CAR_D);
  // cabin with side windows, a cracked windscreen and a dented roof
  v.box(4, 5, 4, 11, 10, 8, CAR);
  v.box(5, 9, 5, 7, 10, 7, M.window);
  v.box(8, 9, 5, 10, 10, 7, M.window);
  v.box(10, 6, 5, 11, 9, 7, M.window);
  v.box(10, 7, 6, 11, 8, 7, M.steelL);
  v.clear(6, 6, 7, 9, 8, 8);
  // a primer-grey replacement door
  v.paint(7, 10, 1, 10, 11, 4, PRIMER);
  v.paint(7, 9, 4, 10, 10, 5, PRIMER);
  // rust, the open bonnet with the engine showing, one headlight left
  v.paint(1, 10, 1, 4, 11, 3, M.rustD);
  v.paint(1, 4, 3, 3, 9, 4, M.rust);
  v.box(12, 5, 2, 15, 10, 3, M.rustD);
  v.box(12, 6, 3, 14, 9, 4, M.steelD);
  v.box(11, 4, 3, 12, 11, 6, CAR_D);
  v.box(14, 4, 1, 15, 6, 2, M.yellow);
  // wheels (the front-right one lies in the dirt)
  for (const [x, y] of [
    [3, 3],
    [3, 11],
    [12, 3],
  ]) {
    v.cylY(x + 0.5, 1.5, 1.7, y, y + 1, M.dark);
    v.set(x, y, 1, M.steelL);
  }
  v.cylZ(12.5, 14, 2.2, 0, 1, M.dark, 0.9);
  return v;
}

function pipeRun(): Vox {
  const v = tile(2, 1, 11);
  // stands
  for (const x of [3, 14]) {
    v.box(x - 1, 3, 0, x + 3, 14, 1, M.concrete);
    v.box(x, 4, 1, x + 2, 5, 6, M.steelD);
    v.box(x, 12, 1, x + 2, 13, 6, M.steelD);
    v.box(x, 4, 4, x + 2, 13, 5, M.steelD);
  }
  v.box(21, 10, 0, 25, 14, 1, M.concrete);
  v.box(22, 12, 1, 24, 13, 6, M.steelD);
  // big pipe with a rounded elbow at the right end that drops into a concrete collar in the ground
  v.cylX(7, 7.5, 2.5, 0, 26, M.steelL);
  v.sphere(28, 7, 7.5, 2.6, M.steelL);
  v.cylZ(28, 7, 2.5, 0, 7, M.steelL);
  v.cylZ(28, 7, 3.6, 0, 1, M.concrete);
  v.cylZ(28, 7, 3.1, 1, 2, M.steelD);
  v.cylZ(28, 7, 3.1, 4, 5, M.steelD);
  // small rusty pipe in front
  v.cylX(11, 6.5, 1.5, 0, 32, M.rust);
  // flanges
  for (const x of [0, 10, 21]) v.cylX(7, 7.5, 3, x, x + 1, M.steelD);
  for (const x of [6, 18, 30]) v.cylX(11, 6.5, 2, x, x + 1, M.rustD);
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

// A wooden utility pole with two crossarms, glass insulators, a transformer can and its cable running down into a
// ground box.
function cablePole(): Vox {
  const v = tile(1, 1, 37);
  v.box(6, 6, 0, 10, 10, 1, M.concrete);
  v.box(7, 7, 0, 9, 9, 35, POLE);
  v.box(7, 7, 35, 9, 9, 36, M.steelD);
  // two crossarms set across the view (along x − y) so they read as a T on screen, insulators on their ends
  for (const [z, n] of [
    [31, 6],
    [26, 4],
  ]) {
    for (let k = -n; k <= n; k++) v.box(8 + k, 7 - k, z - 1, 9 + k, 9 - k, z + 1, POLE);
    for (const k of [-n, n]) v.box(8 + k, 7 - k, z + 1, 9 + k, 9 - k, z + 3, M.white);
  }
  // loose drop cables hanging from the upper arm's ends
  for (const k of [-6, 6]) {
    const x = 8 + k;
    const y = 8 - k;
    for (let dz = 0; dz < 7; dz++) v.set(x + (dz > 3 ? Math.sign(-k) : 0), y + (dz > 3 ? Math.sign(k) : 0), 29 - dz, M.darkL);
  }
  // transformer can, its cable down the pole, the ground box and a warning plate
  v.cylZ(10.5, 8, 2, 17, 23, M.steelL);
  v.cylZ(10.5, 8, 2.1, 23, 24, M.steelD);
  v.box(9, 7, 20, 10, 9, 21, M.steelD);
  v.box(9, 9, 1, 10, 10, 18, M.darkL);
  v.box(9, 9, 0, 13, 13, 4, M.steelD);
  v.box(10, 12, 1, 12, 13, 3, M.hazardY);
  v.box(7, 9, 11, 9, 10, 14, M.hazardY);
  v.box(7, 9, 12, 9, 10, 13, M.hazardK);
  return v;
}

// A green skip with its lid swung open against the back and scrap sticking out of the dark inside.
function dumpster(): Vox {
  const v = tile(1, 1, 12);
  v.box(2, 4, 1, 14, 12, 8, DUMP);
  v.box(2, 4, 1, 14, 12, 2, M.greenD);
  v.box(1, 3, 7, 15, 13, 8, M.greenD);
  // the open top: a dark hollow inside the rim
  v.clear(3, 5, 4, 13, 11, 8);
  v.box(3, 5, 3, 13, 11, 4, M.dark);
  v.paint(3, 4, 4, 13, 5, 7, M.dark);
  v.paint(2, 5, 4, 3, 11, 7, M.dark);
  // the lid, hinged at the back and leaning back
  v.box(2, 3, 8, 14, 5, 9, M.greenD);
  v.box(2, 2, 9, 14, 4, 11, M.greenD);
  v.box(2, 1, 11, 14, 3, 12, M.greenD);
  // scrap at different heights
  line(v, [4, 6, 4], [7, 9, 10], M.rust, 2);
  v.box(9, 6, 4, 12, 7, 10, M.steelL);
  v.cylY(10.5, 7.5, 1.6, 8, 10, M.dark);
  // side lift pockets and wheels
  v.box(14, 5, 4, 15, 11, 5, M.steelD);
  for (const [x, y] of [
    [3, 11],
    [12, 11],
    [12, 4],
  ])
    v.box(x, y, 0, x + 1, y + 1, 1, M.ink);
  // a lime recycle stripe
  v.box(4, 12, 3, 12, 13, 5, M.limeD);
  return v;
}

// ---------- ruins and machines ----------

function ruinWall(): Vox {
  const v = tile(2, 1, 24);
  // a long wall, 3 thick, with a broken top stepping in 2-voxel blocks
  const H = [10, 15, 19, 20, 18, 14, 9, 11, 15, 16, 13, 11, 8, 9];
  H.forEach((h, i) => v.box(2 + i * 2, 3, 0, 4 + i * 2, 6, h, M.concrete));
  // a side wall coming forward at the left end, broken lower towards the front
  for (let y = 6; y < 13; y++) v.box(2, y, 0, 5, y + 1, 14 - (y - 6) * 2, M.concrete);
  // prefab panels, grime at the base, the floor slab line, a faded 2PM pink band from better days
  for (let x = 2; x < 30; x += 8) v.paint(x, 5, 2, x + 4, 6, 12, M.concreteL);
  v.paint(2, 3, 0, 30, 13, 2, M.darkL);
  v.paint(2, 5, 12, 30, 6, 13, M.concreteL);
  v.paint(4, 6, 12, 5, 13, 13, M.concreteL);
  v.paint(2, 5, 13, 30, 6, 15, M.pinkD);
  v.paint(4, 6, 13, 5, 13, 15, M.pinkD);
  isoText(v, '2PM', '+y', 6, 5, 19, M.pinkD, true);
  // two window openings with sills, dark inside
  for (const x of [9, 19]) {
    v.clear(x, 3, 5, x + 4, 6, 10);
    v.box(x, 3, 4, x + 4, 5, 5, M.dark);
    v.paint(x - 1, 3, 5, x, 6, 10, M.dark);
    v.box(x - 1, 5, 4, x + 5, 7, 5, M.concreteL);
  }
  // rebar sticking out of the broken tops
  for (const [x, len] of [
    [4, 3],
    [8, 4],
    [12, 3],
    [17, 3],
    [21, 2],
    [26, 3],
  ]) {
    const top = H[Math.floor((x - 2) / 2)];
    v.box(x, 4, top, x + 1, 5, top + len, M.rust);
  }
  v.box(8, 4, 23, 10, 5, 24, M.rust); // one bent over
  // rubble in front
  v.box(10, 8, 0, 14, 11, 2, M.concrete);
  v.box(11, 9, 2, 13, 11, 3, M.concrete);
  v.box(20, 9, 0, 23, 12, 2, M.darkL);
  v.box(25, 7, 0, 28, 10, 3, M.concrete);
  v.box(26, 10, 0, 30, 11, 1, M.darkL);
  return v;
}

// A tower crane: the trolley runs out along the jib and back, the load of beams sways, the beacons blink.
function crane(frame: number): Vox {
  const v = tile(2, 2, 73);
  const on = frame < 2;
  const o = [0, 1, 2, 1][frame];
  const dy = [0, 0, 1, 0][frame];
  // footing with hazard stripes
  v.box(8, 8, 0, 24, 24, 3, M.concrete);
  hazardBand(v, 8, 23, 1, 24, 24, 3);
  hazardBand(v, 23, 8, 1, 24, 24, 3);
  // lattice mast (5×5)
  const X0 = 13;
  const Y0 = 13;
  const S = 5;
  const ZT = 58;
  for (const [x, y] of [
    [X0, Y0],
    [X0 + S - 1, Y0],
    [X0, Y0 + S - 1],
    [X0 + S - 1, Y0 + S - 1],
  ])
    v.box(x, y, 3, x + 1, y + 1, ZT, M.yellow);
  for (let z = 3, k = 0; z + 6 <= ZT; z += 6, k++) {
    // rungs
    v.box(X0, Y0, z, X0 + S, Y0 + 1, z + 1, M.yellow);
    v.box(X0, Y0 + S - 1, z, X0 + S, Y0 + S, z + 1, M.yellow);
    v.box(X0, Y0, z, X0 + 1, Y0 + S, z + 1, M.yellow);
    v.box(X0 + S - 1, Y0, z, X0 + S, Y0 + S, z + 1, M.yellow);
    // zigzag diagonals on the four faces
    const up = k % 2 === 0;
    for (let s = 0; s < 6; s++) {
      const a = Math.round((s * (S - 1)) / 5);
      const p = up ? a : S - 1 - a;
      v.set(X0 + p, Y0 + S - 1, z + s, M.yellow);
      v.set(X0 + S - 1, Y0 + p, z + s, M.yellow);
      v.set(X0 + p, Y0, z + s, M.yellow);
      v.set(X0, Y0 + p, z + s, M.yellow);
    }
  }
  // vertical 2PM banner on the mast (letters stacked, read top to bottom)
  v.box(X0, Y0 + S, 13, X0 + S, Y0 + S + 1, 35, M.pink);
  v.box(X0, Y0 + S, 13, X0 + S, Y0 + S + 1, 14, M.pinkD);
  v.box(X0, Y0 + S, 34, X0 + S, Y0 + S + 1, 35, M.pinkD);
  isoText(v, '2', '+y', X0 + 1, Y0 + S, 32, M.white);
  isoText(v, 'P', '+y', X0 + 1, Y0 + S, 26, M.white);
  isoText(v, 'M', '+y', X0 + 1, Y0 + S, 20, M.white);
  // turntable and cab
  v.box(12, 12, ZT, 19, 19, ZT + 2, M.steelD);
  v.box(18, 13, ZT - 6, 23, 19, ZT, M.white);
  v.box(18, 13, ZT - 1, 23, 19, ZT, M.orange);
  v.box(22, 14, ZT - 4, 23, 18, ZT - 1, M.glass);
  v.box(19, 18, ZT - 4, 22, 19, ZT - 1, M.glass);
  // jib towards +x: a box truss with zigzag sides
  const JZ = ZT + 2;
  for (const y of [13, 17]) {
    v.box(13, y, JZ, 32, y + 1, JZ + 1, M.yellow);
    v.box(13, y, JZ + 3, 32, y + 1, JZ + 4, M.yellow);
    for (let x = 13; x < 32; x++) {
      const p = x % 6;
      v.set(x, y, JZ + (p < 3 ? p : 6 - p), M.yellow);
    }
  }
  for (let x = 14; x < 32; x += 3) {
    v.box(x, 13, JZ + 3, x + 1, 18, JZ + 4, M.yellow);
    v.box(x, 13, JZ, x + 1, 18, JZ + 1, M.yellow);
  }
  // counter-jib towards −x with its concrete counterweights
  v.box(1, 13, JZ, 13, 18, JZ + 1, M.orange);
  v.box(1, 13, JZ + 1, 13, 14, JZ + 3, M.yellow);
  v.box(1, 17, JZ + 1, 13, 18, JZ + 3, M.yellow);
  v.box(1, 12, JZ - 6, 7, 19, JZ, M.concrete);
  v.paint(1, 12, JZ - 3, 7, 19, JZ - 2, M.concreteL);
  // tower head and the pendant lines
  const AZ = JZ + 9;
  for (const [x, y] of [
    [13, 13],
    [17, 13],
    [13, 17],
    [17, 17],
  ])
    line(v, [x, y, JZ], [15, 15, AZ], M.yellow);
  v.box(15, 15, AZ - 1, 17, 17, AZ + 1, M.orange);
  line(v, [16, 15, AZ], [31, 15, JZ + 3], M.steelL);
  line(v, [15, 15, AZ], [1, 15, JZ + 3], M.steelL);
  // blinking beacons on the tower head and the jib tip
  v.box(15, 15, AZ + 1, 17, 17, AZ + 3, on ? M.redLit : M.red);
  v.box(30, 15, JZ + 4, 32, 17, JZ + 5, on ? M.redLit : M.red);
  v.point('light', 16, 16, AZ + 3);
  // trolley running along the jib, the hook and a bundle of beams swaying under it
  const HZ = 36; // hook block bottom
  v.box(23 + o, 13, JZ - 1, 27 + o, 18, JZ, M.steelD);
  v.box(24 + o, 15, HZ + 5, 25 + o, 16, JZ - 1, M.ink);
  v.box(25 + o, 15, HZ + 5, 26 + o, 16, JZ - 1, M.ink);
  v.box(23 + o, 14, HZ + 2, 27 + o, 17, HZ + 5, M.hazardY);
  hazardBand(v, 23 + o, 14, HZ + 2, 27 + o, 17, HZ + 5);
  v.box(24 + o, 15, HZ, 26 + o, 16, HZ + 2, M.steelD);
  line(v, [25 + o, 15 + dy, HZ], [20 + o, 15 + dy, HZ - 3], M.ink);
  line(v, [25 + o, 15 + dy, HZ], [29 + o, 15 + dy, HZ - 3], M.ink);
  v.box(19 + o, 13 + dy, HZ - 6, 30 + o, 15 + dy, HZ - 3, M.rust);
  v.box(19 + o, 15 + dy, HZ - 6, 30 + o, 18 + dy, HZ - 4, M.rustD);
  return v;
}

// A wind turbine taller than anything in the city: the rotor turns in front of the tower (well clear of it on
// screen), the beacon on the nacelle blinks.
function windTurbine(frame: number): Vox {
  const v = tile(2, 1, 75);
  const cx = 16;
  const cy = 4;
  const HUB = 58;
  // base and tower
  v.cylZ(cx, cy, 3.6, 0, 2, M.concrete);
  v.cylZ(cx, cy, 3.6, 1, 2, M.sandD);
  v.cone(cx, cy, 2, HUB, 2.3, 1.3, M.concreteL);
  v.paint(15, 5, 2, 17, 7, 6, M.steelD);
  v.paint(14, 0, 30, 19, 8, 32, M.pink);
  // nacelle pointing to the front-left, the beacon on top
  v.box(14, 2, HUB - 2, 18, 14, HUB + 2, M.steel);
  v.box(14, 2, HUB + 1, 18, 14, HUB + 2, M.steelD);
  v.box(16, 2, HUB + 2, 18, 4, HUB + 3, frame < 2 ? M.redLit : M.red);
  // three blades turning 30° per frame (120° symmetry: four frames make a seamless loop)
  const L = 14.8;
  for (let k = 0; k < 3; k++) {
    const a = Math.PI / 2 + (frame * Math.PI) / 6 + (k * 2 * Math.PI) / 3;
    const c = Math.cos(a);
    const s = Math.sin(a);
    for (let z = HUB - 17; z < HUB + 17; z++)
      for (let x = 0; x < 32; x++) {
        const dx = x + 0.5 - cx;
        const dz = z + 0.5 - HUB;
        const t = dx * c + dz * s;
        const p = Math.abs(-dx * s + dz * c);
        if (t < 0.5 || t > L) continue;
        if (p > (t < 7 ? 1.25 : 0.8)) continue;
        v.set(x, 14, z, t > L - 3.6 ? M.pink : M.white);
      }
  }
  // hub and pink nose
  v.box(15, 14, HUB - 1, 17, 15, HUB + 1, M.steelL);
  v.box(15, 15, HUB - 1, 17, 16, HUB + 1, M.pink);
  v.point('light', 17, 3, HUB + 3);
  return v;
}

export const DECOR: DecorArt[] = [
  { name: 'tree-round', w: 1, d: 1, frames: 1, fps: 1, tall: true, model: () => treeRound('a') },
  { name: 'tree-round-2', w: 1, d: 1, frames: 1, fps: 1, tall: true, model: () => treeRound('b') },
  { name: 'tree-blossom', w: 1, d: 1, frames: 1, fps: 1, tall: true, model: () => treeRound('blossom') },
  { name: 'tree-dead', w: 1, d: 1, frames: 1, fps: 1, tall: true, model: treeDead },
  { name: 'bush', w: 1, d: 1, frames: 1, fps: 1, tall: false, model: bush },
  { name: 'container', w: 2, d: 1, frames: 1, fps: 1, tall: true, model: () => container(CONT_B, CONT_BD, '2PM', M.white) },
  { name: 'container-rust', w: 2, d: 1, frames: 1, fps: 1, tall: true, model: () => container(CONT_R, CONT_RD, 'SCRAP', M.white) },
  { name: 'container-stack', w: 2, d: 1, frames: 1, fps: 1, tall: true, model: containerStack },
  { name: 'crates', w: 1, d: 1, frames: 1, fps: 1, tall: false, model: crates },
  { name: 'barrels', w: 1, d: 1, frames: 1, fps: 1, tall: false, model: barrels },
  { name: 'tyres', w: 1, d: 1, frames: 1, fps: 1, tall: false, model: tyres },
  { name: 'cones', w: 1, d: 1, frames: 2, fps: 2, tall: false, model: cones },
  { name: 'bench', w: 1, d: 1, frames: 1, fps: 1, tall: false, model: bench },
  { name: 'billboard', w: 2, d: 1, frames: 1, fps: 1, tall: true, model: billboard },
  { name: 'sign', w: 1, d: 1, frames: 1, fps: 1, tall: false, model: sign },
  { name: 'sign-scrap', w: 1, d: 1, frames: 1, fps: 1, tall: true, model: signScrap },
  { name: 'fence', w: 1, d: 1, frames: 1, fps: 1, tall: false, model: fence },
  { name: 'forklift', w: 1, d: 1, frames: 1, fps: 1, tall: false, model: forklift },
  { name: 'scrap-car', w: 1, d: 1, frames: 1, fps: 1, tall: false, model: scrapCar },
  { name: 'pipe-run', w: 2, d: 1, frames: 1, fps: 1, tall: false, model: pipeRun },
  { name: 'cable-pole', w: 1, d: 1, frames: 1, fps: 1, tall: true, model: cablePole },
  { name: 'dumpster', w: 1, d: 1, frames: 1, fps: 1, tall: false, model: dumpster },
  { name: 'ruin-wall', w: 2, d: 1, frames: 1, fps: 1, tall: true, model: ruinWall },
  { name: 'crane', w: 2, d: 2, frames: 4, fps: 4, tall: true, model: crane },
  { name: 'wind-turbine', w: 2, d: 1, frames: 4, fps: 6, tall: true, model: windTurbine },
];
