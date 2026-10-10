// Ground tiles (32×16 diamonds) painted in world space, plus the slab sides of the map.
// Every pixel centre maps to exactly one ground point, so neighbouring diamonds tile without gaps or overlaps.
import { createImage } from '../png';
import type { Image } from '../png';
import { hex } from '../voxel';
import type { RGB } from '../voxel';
import { hash } from './common';

type Shader = (x: number, y: number) => RGB | null; // tile-local world coords in [0, 16)

function tile(shader: Shader): Image {
  const img = createImage(32, 16);
  for (let py = 0; py < 16; py++)
    for (let px = 0; px < 32; px++) {
      const X = px - 16 + 0.5;
      const Y = py + 0.5;
      const x = Y + X / 2;
      const y = Y - X / 2;
      if (x < 0 || y < 0 || x >= 16 || y >= 16) continue;
      const c = shader(x, y);
      if (!c) continue;
      const o = (py * 32 + px) * 4;
      img.data[o] = c[0];
      img.data[o + 1] = c[1];
      img.data[o + 2] = c[2];
      img.data[o + 3] = 255;
    }
  return img;
}

const cell = (x: number, y: number) => [Math.floor(x), Math.floor(y)] as const;

// specks on a 1-voxel grid: deterministic per variant
function specks(base: RGB, light: RGB, dark: RGB, density: number, salt: number): Shader {
  return (x, y) => {
    const [cx, cy] = cell(x, y);
    const h = hash(cx, cy, salt);
    if (h < density) return light;
    if (h > 1 - density) return dark;
    return base;
  };
}

const GROUND_BASES = ['#2a2539', '#2e2841', '#332c46'].map(hex);

export function groundTiles(): Record<string, Image> {
  const out: Record<string, Image> = {};
  GROUND_BASES.forEach((base, fam) => {
    for (let k = 0; k < 4; k++) {
      const sp = specks(base, hex('#3b3452'), hex('#211c30'), 0.05, 100 + fam * 10 + k);
      out[`t/ground/${fam}/${k}`] = tile((x, y) => {
        // a few pebbles (2 voxels) and a crack now and then
        const [cx, cy] = cell(x, y);
        const p = hash(Math.floor(cx / 2), Math.floor(cy / 2), 300 + fam * 10 + k);
        if (p > 0.985) return hex('#4a4360');
        if (k === 3 && Math.abs(x - y * 0.6 - 4) < 0.5 && y > 3 && y < 12) return hex('#1d1829');
        return sp(x, y);
      });
    }
  });
  return out;
}

export function grassTiles(): Record<string, Image> {
  const out: Record<string, Image> = {};
  const bases = ['#2b5733', '#285030', '#2f5f36'].map(hex);
  for (let k = 0; k < 6; k++) {
    const base = bases[k % 3];
    out[`t/grass/${k}`] = tile((x, y) => {
      const [cx, cy] = cell(x, y);
      const h = hash(cx, cy, 500 + k);
      if (h > 0.93) return hex('#4f9c48');
      if (h > 0.86) return hex('#3b7d3f');
      if (h < 0.05) return hex('#22462a');
      if (k >= 4 && h > 0.6 && h < 0.605) return hex(k === 4 ? '#ff3d8b' : '#ffd440');
      return base;
    });
  }
  return out;
}

const ASPHALT = hex('#262233');
const ASPHALT2 = hex('#2c2839');
const CURB = hex('#4b4560');
const LINE = hex('#c9a93a');

export function roadTiles(): Record<string, Image> {
  const asphalt = (x: number, y: number, salt: number): RGB => (hash(Math.floor(x), Math.floor(y), salt) > 0.9 ? ASPHALT2 : ASPHALT);
  return {
    // road running along x (a map row)
    't/road/x': tile((x, y) => (y < 1 || y >= 15 ? CURB : Math.abs(y - 8) < 0.5 && x % 8 < 4 ? LINE : asphalt(x, y, 600))),
    // road running along y (a map column)
    't/road/y': tile((x, y) => (x < 1 || x >= 15 ? CURB : Math.abs(x - 8) < 0.5 && y % 8 < 4 ? LINE : asphalt(x, y, 601))),
    // crossing: curbs only at the four corners, a zebra crossing on each side
    't/road/c': tile((x, y) => {
      const corner = (x < 1 || x >= 15) && (y < 1 || y >= 15);
      if (corner) return CURB;
      const zebra = (x < 3 || x >= 13) !== (y < 3 || y >= 13) && (x < 3 || x >= 13 ? Math.floor(y) % 3 === 0 : Math.floor(x) % 3 === 0);
      return zebra ? hex('#8d88a0') : asphalt(x, y, 602);
    }),
  };
}

// Toxic sludge pools: the rim follows the open sides (mask bits: 1 = −x, 2 = +x, 4 = −y, 8 = +y neighbour is sludge).
export function sludgeTiles(): Record<string, Image> {
  const out: Record<string, Image> = {};
  const rim = hex('#4d2f66');
  const mid = hex('#5fb52f');
  const core = hex('#86e83c');
  const hi = hex('#d2ff8a');
  for (let mask = 0; mask < 16; mask++)
    for (let f = 0; f < 2; f++) {
      out[`t/sludge/${mask}/${f}`] = tile((x, y) => {
        const dl = mask & 1 ? 99 : x;
        const dr = mask & 2 ? 99 : 16 - x;
        const du = mask & 4 ? 99 : y;
        const dd = mask & 8 ? 99 : 16 - y;
        let d = Math.min(dl, dr, du, dd);
        // rounded outer corners
        const cx = Math.min(dl, dr);
        const cy = Math.min(du, dd);
        if (cx < 4 && cy < 4) d = Math.min(d, 4 - Math.hypot(4 - cx, 4 - cy));
        if (d < 0.6) return null; // ground shows through at the very edge
        if (d < 2) return rim;
        if (d < 3.5) return mid;
        const [ix, iy] = cell(x, y);
        const b = hash(ix >> 1, iy >> 1, 700 + f);
        if (b > 0.92) return hi;
        return core;
      });
    }
  return out;
}

// Wasteland outside the playable area: darker and cracked.
export function outerTiles(): Record<string, Image> {
  const out: Record<string, Image> = {};
  for (let k = 0; k < 4; k++) {
    const sp = specks(hex('#211d2e'), hex('#2c2740'), hex('#17141f'), 0.06, 800 + k);
    out[`t/outer/${k}`] = tile((x, y) => {
      if (k === 1 && Math.abs(y - x * 0.5 - 5) < 0.5 && x > 2 && x < 14) return hex('#120f19');
      if (k === 2 && Math.abs(x + y - 16) < 0.5 && x > 4 && x < 12) return hex('#120f19');
      return sp(x, y);
    });
  }
  return out;
}

// The slab's sides under the front edges of the map: earth strata. 'l' hangs under a tile's +y edge (front-left
// side, lit), 'r' under its +x edge (front-right side, in shadow).
export const EDGE_DEPTH = 18;
export function edgeTiles(): Record<string, Image> {
  const strata = ['#4a3a52', '#3d3047', '#33283d', '#2a2034', '#211a2b'].map(hex);
  const make = (side: 'l' | 'r', salt: number): Image => {
    const img = createImage(16, 8 + EDGE_DEPTH);
    for (let py = 0; py < img.h; py++)
      for (let px = 0; px < 16; px++) {
        // the top edge runs along the tile edge: down-right for 'l' (along +x), up-right for 'r' (along −y)
        const edgeY = side === 'l' ? (px + 0.5) / 2 : 8 - (px + 0.5) / 2;
        const d = py + 0.5 - edgeY;
        if (d < 0 || d >= EDGE_DEPTH) continue;
        let c = strata[Math.min(strata.length - 1, Math.floor((d / EDGE_DEPTH) * strata.length))];
        if (d < 1) c = hex('#5a4864');
        if (hash(px >> 1, Math.floor(d / 2), salt) > 0.9) c = hex('#55476a');
        const f = side === 'l' ? 0.92 : 0.7;
        const o = (py * 16 + px) * 4;
        img.data[o] = c[0] * f;
        img.data[o + 1] = c[1] * f;
        img.data[o + 2] = c[2] * f;
        img.data[o + 3] = 255;
      }
    return img;
  };
  return { 't/edge/l/0': make('l', 900), 't/edge/l/1': make('l', 901), 't/edge/r/0': make('r', 902), 't/edge/r/1': make('r', 903) };
}
