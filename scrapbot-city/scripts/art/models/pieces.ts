// Player-built pieces (0.7, increment 1): industrial floor, fence, gate and lamp, one tile each.
//   t/floor/<k>        k 0..3   flat ground tiles (terrain cache), steel plates with rivets and hazard-striped edges
//   pc/fence/<mask>    1..15    mask of the neighbours that are fence or gate: N (y−1) 1, E (x+1) 2, S (y+1) 4, W (x−1) 8
//   pc/fence/x, /y              an isolated fence along x or y (mask 0, by rotation)
//   pc/gate/x, /y               two pillars and a sliding gate with an amber light
//   pc/lamp/<dir>      0..3     lamp whose arm points +x, +y, −x, −y; its glow frame also lights a pool on the ground
// Every model is 16×16 voxels (one tile) with its origin on the tile's back corner, like the buildings. The fence,
// the gate and the lamp share one line through the tile centre (x or y = 8), so fences meet gates and each other.
import { M } from '../palette';
import { createImage } from '../png';
import type { Image } from '../png';
import { Vox, hex } from '../voxel';
import type { RGB, Rendered } from '../voxel';
import { hash } from './common';

// ---------- industrial floor ----------

const FLOOR = {
  plate: hex('#4b5175'),
  plateL: hex('#575e86'),
  tread: hex('#727aa3'),
  treadD: hex('#3c4161'),
  seam: hex('#272a40'),
  rivet: hex('#aab2d6'),
  rivetD: hex('#2d3048'),
  bevelL: hex('#6a7299'),
  bevelD: hex('#383c58'),
  hazY: hex('#b89a35'),
  hazK: hex('#2a2433'),
  rust: hex('#7b4a35'),
  rustL: hex('#9a5d3e'),
  grate: hex('#1b1a2a'),
};

// One 32×16 ground diamond painted in tile-local world coordinates (same mapping as terrain.ts).
function floorTile(shader: (x: number, y: number) => RGB): Image {
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

// The four variants share the plate border (a half-voxel hazard band on every edge, striped on the world diagonal
// with a period that divides 16, so neighbouring tiles continue each other's stripes), a bevel and four corner
// rivets; inside, k = 0 diamond tread, 1 tread split by a riveted weld seam, 2 smooth plate with a bolted
// hatch, 3 tread with a drain grate and a rust stain.
export function floorTiles(): Record<string, Image> {
  const out: Record<string, Image> = {};
  for (let k = 0; k < 4; k++) {
    out[`t/floor/${k}`] = floorTile((x, y) => {
      const ix = Math.floor(x);
      const iy = Math.floor(y);
      // the hazard edge is half a voxel (one pixel) wide, so two plates side by side share a two-pixel band
      if (x < 0.5 || y < 0.5 || x >= 15.5 || y >= 15.5) return Math.floor((x + y) / 2) & 1 ? FLOOR.hazK : FLOOR.hazY;
      // bevel: edges facing the light (+y, −x) bright, the others dark
      if (y >= 14.5 || x < 1.5) return FLOOR.bevelL;
      if (y < 1.5 || x >= 14.5) return FLOOR.bevelD;
      // corner rivets, with a dark pixel on their shadow side
      for (const [rx, ry] of [
        [2, 2],
        [12, 2],
        [2, 12],
        [12, 12],
      ])
        if (ix === rx && iy === ry) return FLOOR.rivet;
        else if (ix === rx + 1 && iy === ry) return FLOOR.rivetD;
      const tread = (): RGB => {
        const u = ix % 4;
        const w = iy % 4;
        const flip = ((ix >> 2) + (iy >> 2)) & 1;
        if (!flip && w === 3 && (u === 0 || u === 1)) return FLOOR.tread;
        if (flip && u === 3 && (w === 0 || w === 1)) return FLOOR.tread;
        if (!flip && w === 3 && u === 2) return FLOOR.treadD;
        if (flip && u === 3 && w === 2) return FLOOR.treadD;
        return hash(ix, iy, 2200 + k) > 0.93 ? FLOOR.plateL : FLOOR.plate;
      };
      if (k === 1) {
        if (iy === 8) return FLOOR.seam;
        if (iy === 7 && ix % 3 === 1 && ix > 2 && ix < 13) return FLOOR.rivet;
      }
      if (k === 2) {
        // bolted inspection hatch in the middle of a smooth plate
        if (ix >= 5 && ix <= 10 && iy >= 5 && iy <= 10) {
          if (ix === 5 || ix === 10 || iy === 5 || iy === 10) return FLOOR.seam;
          if ((ix === 6 || ix === 9) && (iy === 6 || iy === 9)) return FLOOR.rivet;
          return FLOOR.plateL;
        }
        if (Math.abs(x - y * 0.5 - 6) < 0.6 && y > 9 && y < 13) return FLOOR.bevelD; // a scuff
        return hash(ix, iy, 2300) > 0.95 ? FLOOR.plateL : FLOOR.plate;
      }
      if (k === 3) {
        // drain grate and a rust stain spreading from it
        if (ix >= 5 && ix <= 10 && iy >= 6 && iy <= 9) return ix === 5 || ix === 10 || iy === 6 || iy === 9 ? FLOOR.seam : ix % 2 ? FLOOR.grate : FLOOR.bevelD;
        const d = Math.hypot(x - 10.5, y - 11);
        if (d < 2.6 + hash(ix, iy, 2400) * 1.2) return d < 1.6 ? FLOOR.rustL : FLOOR.rust;
      }
      return tread();
    });
  }
  return out;
}

// A 2×2 patch of the four variants: the floor's catalogue icon (64×32, anchor on the top corner).
export function floorIcon(tiles: Record<string, Image>): { img: Image; ax: number; ay: number } {
  const img = createImage(64, 32);
  const put = (src: Image, ox: number, oy: number) => {
    for (let y = 0; y < src.h; y++)
      for (let x = 0; x < src.w; x++) {
        const s = (y * src.w + x) * 4;
        if (!src.data[s + 3]) continue;
        const d = ((oy + y) * img.w + ox + x) * 4;
        img.data.set(src.data.subarray(s, s + 4), d);
      }
  };
  put(tiles['t/floor/0'], 16, 0);
  put(tiles['t/floor/1'], 32, 8);
  put(tiles['t/floor/2'], 0, 8);
  put(tiles['t/floor/3'], 16, 16);
  return { img, ax: 32, ay: 0 };
}

// ---------- fence ----------

export const FENCE_H = 10;

// A run of palisade from a to b (exclusive) along x on the line y = at, or along y on the line x = at: rails at
// the bottom and the top, a bar on every even voxel (even in world space too, since tiles are 16 wide, so the
// rhythm runs on from tile to tile).
function panel(v: Vox, axis: 'x' | 'y', a: number, b: number, at = 8): void {
  for (let t = a; t < b; t++) {
    const [x, y] = axis === 'x' ? [t, at] : [at, t];
    v.set(x, y, 1, M.steelD);
    v.set(x, y, FENCE_H - 1, M.steel);
    if (t % 2 === 0) for (let z = 2; z < FENCE_H - 1; z++) v.set(x, y, z, M.steelL);
  }
}

// A post (2×2) with a hazard cap, its back corner at (x, y).
function post(v: Vox, x: number, y: number, h = FENCE_H + 1): void {
  v.box(x, y, 0, x + 2, y + 2, h - 1, M.steelD);
  v.box(x, y, h - 1, x + 2, y + 2, h, M.hazardY);
}

// A danger sign (yellow plate, black "!") hung on the visible side of a run on the line `at`, centred at t along it.
function sign(v: Vox, axis: 'x' | 'y', t: number, at = 8): void {
  for (let k = -1; k <= 1; k++)
    for (let z = 3; z < 8; z++) {
      const m = k === 0 && z !== 4 ? M.ink : M.yellow;
      if (axis === 'x') v.set(t + k, at + 1, z, m);
      else v.set(at + 1, t - k, z, m);
    }
}

export type FenceShape = number | 'x' | 'y';

export function fenceModel(shape: FenceShape): Vox {
  const v = new Vox(16, 16, FENCE_H + 2);
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
    // a single neighbour: the fence runs right across the tile and ends in a post on the far side
    if (n && !e && !s && !w) (s = true), ends.push('s');
    else if (e && !n && !s && !w) (w = true), ends.push('w');
    else if (s && !n && !e && !w) (n = true), ends.push('n');
    else if (w && !n && !e && !s) (e = true), ends.push('e');
  }
  if (w) panel(v, 'x', 0, 8);
  if (e) panel(v, 'x', 8, 16);
  if (n) panel(v, 'y', 0, 8);
  if (s) panel(v, 'y', 8, 16);
  post(v, 7, 7);
  for (const end of ends) {
    if (end === 'w') post(v, 0, 7);
    if (end === 'e') post(v, 14, 7);
    if (end === 'n') post(v, 7, 0);
    if (end === 's') post(v, 7, 14);
  }
  // a danger sign where a run ends, on the half by the end post
  const end = ends[0];
  if (end === 'w') sign(v, 'x', 4);
  if (end === 'e') sign(v, 'x', 11);
  if (end === 'n') sign(v, 'y', 4);
  if (end === 's') sign(v, 'y', 11);
  return v;
}

// ---------- gate ----------

export const GATE_H = 12;

// Built along x and turned for y: steel pillars at both ends of the tile, a yellow sliding gate on a
// ground track between them (frame, bars, a diagonal brace, a striped kick plate), an amber light on the right
// pillar. Yellow and taller than the grey fence, so the way in shows at a glance.
export function gateModel(axis: 'x' | 'y'): Vox {
  const v = new Vox(16, 16, GATE_H + 1);
  // ground track
  v.box(0, 7, 0, 16, 10, 1, M.steelD);
  v.box(1, 8, 0, 15, 9, 1, M.ink);
  // the gate leaf
  for (let x = 3; x < 13; x++) {
    v.box(x, 8, 1, x + 1, 9, 3, Math.floor((x + 1) / 2) % 2 ? M.hazardK : M.hazardY); // kick plate
    if (x % 2 === 0) for (let z = 3; z < GATE_H - 2; z++) v.set(x, 8, z, M.steelL);
    v.set(x, 8, 3, M.yellow);
    v.set(x, 8, GATE_H - 2, M.yellow);
  }
  v.box(3, 8, 1, 4, 9, GATE_H - 1, M.yellow); // stiles
  v.box(12, 8, 1, 13, 9, GATE_H - 1, M.yellow);
  for (let k = 0; k < 7; k++) v.set(4 + Math.floor(k * 1.3), 8, 4 + k, M.yellow); // diagonal brace
  v.box(5, 9, 5, 7, 10, 7, M.steelD); // handle
  // pillars: dark steel, hazard stripes round the foot (on all four sides, so the faces the camera sees are striped
  // in both orientations once the model is turned for y), a yellow band under the cap
  for (const px of [0, 13]) {
    v.box(px, 6, 0, px + 3, 11, GATE_H - 1, M.steelD);
    v.box(px, 6, GATE_H - 3, px + 3, 11, GATE_H - 2, M.yellow);
    v.box(px, 6, GATE_H - 1, px + 3, 11, GATE_H, M.steelL);
    for (let z = 0; z < 4; z++) {
      for (let x = px; x < px + 3; x++)
        for (const y of [6, 10]) v.set(x, y, z, Math.floor((x + z) / 2) % 2 ? M.hazardK : M.hazardY);
      for (let y = 6; y < 11; y++)
        for (const x of [px, px + 2]) v.set(x, y, z, Math.floor((y + z) / 2) % 2 ? M.hazardK : M.hazardY);
    }
  }
  // amber light on the right pillar (glows at night)
  v.box(14, 7, GATE_H, 16, 9, GATE_H + 1, M.orangeLit);
  return axis === 'x' ? v : v.rotated();
}

// ---------- lamp ----------

export const LAMP_H = 22;
const LAMP_DIRS: [number, number][] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

// Where the light falls: the ground under the head, in tile voxels.
export function lampHead(dir: number): [number, number] {
  const [dx, dy] = LAMP_DIRS[dir & 3];
  return [8 + dx * 5, 8 + dy * 5];
}

// A post on a concrete footing, an arm towards dir (0 +x, 1 +y, 2 −x, 3 −y) and a floodlight head whose lens is a
// lit band under the head, flush with its sides, so it shows from the camera whichever way the arm points.
export function pieceLampModel(dir: number): Vox {
  const v = new Vox(16, 16, LAMP_H + 1);
  const [dx] = LAMP_DIRS[dir & 3];
  v.box(5, 5, 0, 11, 11, 2, M.concrete);
  v.box(5, 5, 1, 11, 11, 2, M.concreteL);
  for (let k = 5; k < 11; k++) {
    v.set(k, 10, 1, Math.floor(k / 2) % 2 ? M.hazardK : M.hazardY);
    v.set(10, k, 1, Math.floor(k / 2) % 2 ? M.hazardK : M.hazardY);
  }
  v.box(7, 7, 2, 9, 9, 4, M.steelD);
  v.box(7, 7, 4, 9, 9, LAMP_H - 1, M.steel);
  v.box(7, 7, 12, 9, 9, 13, M.steelD);
  v.box(7, 7, LAMP_H - 1, 9, 9, LAMP_H, M.steelD);
  // arm from the pole to the head
  const [hx, hy] = lampHead(dir);
  if (dx) v.box(Math.min(9, hx + 2), 7, LAMP_H - 2, Math.max(7, hx - 2), 9, LAMP_H - 1, M.steel);
  else v.box(7, Math.min(9, hy + 2), LAMP_H - 2, 9, Math.max(7, hy - 2), LAMP_H - 1, M.steel);
  // head: a hood over a lens two voxels deep
  v.box(hx - 2, hy - 2, LAMP_H - 2, hx + 2, hy + 2, LAMP_H, M.steelD);
  v.box(hx - 2, hy - 2, LAMP_H - 1, hx + 2, hy + 2, LAMP_H, M.steel);
  v.box(hx - 2, hy - 2, LAMP_H - 4, hx + 2, hy + 2, LAMP_H - 2, M.yellowLit);
  return v;
}

// Adds a pool of lamp light on the ground to a rendered sprite's glow layer: three bands, brightest under the head,
// growing the frame (both layers, same anchor) when the pool reaches past it. gx, gy: ground point in voxels.
export function withLightPool(r: Rendered, gx: number, gy: number, radius: number, rgb: RGB = hex('#ffd440')): Rendered {
  const toPx = (x: number, y: number): [number, number] => [r.ax + (x - y), r.ay + (x + y) / 2];
  const span = radius * Math.SQRT2;
  const [cx, cy] = toPx(gx, gy);
  const left = Math.max(0, Math.ceil(-(cx - span)));
  const right = Math.max(0, Math.ceil(cx + span - r.img.w));
  const top = Math.max(0, Math.ceil(-(cy - span / 2)));
  const bottom = Math.max(0, Math.ceil(cy + span / 2 - r.img.h));
  const W = r.img.w + left + right;
  const H = r.img.h + top + bottom;
  const grow = (src: Image): Image => {
    const out = createImage(W, H);
    for (let y = 0; y < src.h; y++) out.data.set(src.data.subarray(y * src.w * 4, (y + 1) * src.w * 4), ((y + top) * W + left) * 4);
    return out;
  };
  const img = grow(r.img);
  const glow = grow(r.glow);
  const ax = r.ax + left;
  const ay = r.ay + top;
  for (let py = 0; py < H; py++)
    for (let px = 0; px < W; px++) {
      const X = px + 0.5 - ax;
      const Y = py + 0.5 - ay;
      const x = Y + X / 2;
      const y = Y - X / 2;
      const d = Math.hypot(x - gx, y - gy) / radius;
      if (d >= 1) continue;
      const a = d < 0.45 ? 0.3 : d < 0.75 ? 0.19 : 0.1;
      const o = (py * W + px) * 4;
      if (glow.data[o + 3] >= a * 255) continue;
      glow.data[o] = rgb[0];
      glow.data[o + 1] = rgb[1];
      glow.data[o + 2] = rgb[2];
      glow.data[o + 3] = Math.round(a * 255);
    }
  const points: Record<string, [number, number][]> = {};
  for (const [k, list] of Object.entries(r.points)) points[k] = list.map(([x, y]) => [x + left, y + top]);
  return { ...r, img, glow, ax, ay, points, hasGlow: true };
}

// ---------- catalogue icons ----------

// A fence corner seen from outside: two runs meeting at a post at the front, end posts and a sign.
export function fenceIcon(): Vox {
  const v = new Vox(18, 18, FENCE_H + 2);
  panel(v, 'x', 1, 15, 15);
  panel(v, 'y', 1, 15, 15);
  post(v, 14, 14);
  post(v, 0, 14);
  post(v, 14, 0);
  sign(v, 'x', 8, 15);
  return v;
}

// The gate with a stub of fence on each side.
export function gateIcon(): Vox {
  const v = new Vox(24, 16, GATE_H + 1);
  v.stamp(gateModel('x'), 4, 0, 0);
  panel(v, 'x', 0, 4);
  panel(v, 'x', 20, 24);
  return v;
}

export function lampIcon(): Vox {
  return pieceLampModel(1);
}
