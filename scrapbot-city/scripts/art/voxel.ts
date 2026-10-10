// Voxel models rendered to isometric pixel art.
//
// Projection (same as the game, src/render/iso/projection.ts):
//   isoX = x − y,  isoY = (x + y) / 2 − z      (1 voxel = 1 world unit, a 16-unit tile = 32×16 px)
// The view direction is (1, 1, 1): every pixel casts a ray along (−1, −1, −1) and takes the first voxel it
// meets. Sampling at pixel centres keeps the three axis crossings apart, so the result is stable and crisp.
import { createImage } from './png';
import type { Image } from './png';

export type RGB = readonly [number, number, number];

export interface Material {
  rgb: RGB;
  emit?: number; // 0..1: lit at night (glow layer) and barely shaded by day
  glow?: RGB; // glow colour if different from rgb
  jitter?: number; // per-voxel brightness noise, 0..0.12
  flat?: boolean; // ignore face shading (screens, lamps)
}

export function hex(h: string): RGB {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// ---------- material registry (shared by every model) ----------

const MATS: Material[] = [{ rgb: [0, 0, 0] }]; // index 0 = empty
const MAT_IDS = new Map<string, number>();

export function mat(key: string, m: Material): number {
  const found = MAT_IDS.get(key);
  if (found !== undefined) return found;
  MATS.push(m);
  MAT_IDS.set(key, MATS.length - 1);
  return MATS.length - 1;
}

export function material(id: number): Material {
  return MATS[id];
}

// ---------- the model ----------

export class Vox {
  readonly w: number;
  readonly d: number;
  readonly h: number;
  readonly cells: Uint16Array;
  // points of interest in model space, exported with the sprite (smoke, sparks, lights)
  readonly points: Record<string, [number, number, number][]> = {};

  constructor(w: number, d: number, h: number) {
    this.w = w;
    this.d = d;
    this.h = h;
    this.cells = new Uint16Array(w * d * h);
  }

  private i(x: number, y: number, z: number): number {
    return (z * this.d + y) * this.w + x;
  }

  inside(x: number, y: number, z: number): boolean {
    return x >= 0 && y >= 0 && z >= 0 && x < this.w && y < this.d && z < this.h;
  }

  get(x: number, y: number, z: number): number {
    return this.inside(x, y, z) ? this.cells[this.i(x, y, z)] : 0;
  }

  set(x: number, y: number, z: number, m: number): void {
    if (m === undefined || Number.isNaN(m)) throw new Error('voxel: undefined material');
    if (this.inside(x, y, z)) this.cells[this.i(x, y, z)] = m;
  }

  point(name: string, x: number, y: number, z: number): void {
    (this.points[name] ??= []).push([x, y, z]);
  }

  // Axis-aligned box, start inclusive, end exclusive.
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, m: number): this {
    if (m === undefined || Number.isNaN(m)) throw new Error('voxel: undefined material');
    for (let z = Math.max(0, z0); z < Math.min(this.h, z1); z++)
      for (let y = Math.max(0, y0); y < Math.min(this.d, y1); y++) for (let x = Math.max(0, x0); x < Math.min(this.w, x1); x++) this.cells[this.i(x, y, z)] = m;
    return this;
  }

  // Replace only voxels that already exist (paint a decal onto a surface).
  paint(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, m: number): this {
    if (m === undefined || Number.isNaN(m)) throw new Error('voxel: undefined material');
    for (let z = Math.max(0, z0); z < Math.min(this.h, z1); z++)
      for (let y = Math.max(0, y0); y < Math.min(this.d, y1); y++)
        for (let x = Math.max(0, x0); x < Math.min(this.w, x1); x++) {
          const k = this.i(x, y, z);
          if (this.cells[k]) this.cells[k] = m;
        }
    return this;
  }

  clear(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): this {
    return this.box(x0, y0, z0, x1, y1, z1, 0);
  }

  // Vertical cylinder centred on (cx, cy) (use .5 centres for odd diameters).
  cylZ(cx: number, cy: number, r: number, z0: number, z1: number, m: number, inner = -1): this {
    for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++)
      for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
        const dd = (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2;
        if (dd <= r * r && (inner < 0 || dd > inner * inner)) for (let z = z0; z < z1; z++) this.set(x, y, z, m);
      }
    return this;
  }

  // Truncated cone / tapering cylinder from radius r0 at z0 to r1 at z1.
  cone(cx: number, cy: number, z0: number, z1: number, r0: number, r1: number, m: number): this {
    for (let z = z0; z < z1; z++) {
      const r = r0 + ((r1 - r0) * (z - z0)) / Math.max(1, z1 - z0 - 1);
      this.cylZ(cx, cy, r, z, z + 1, m);
    }
    return this;
  }

  // Horizontal pipe along x (centre at y=cy, z=cz).
  cylX(cy: number, cz: number, r: number, x0: number, x1: number, m: number): this {
    for (let z = Math.floor(cz - r - 1); z <= Math.ceil(cz + r + 1); z++)
      for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++)
        if ((y + 0.5 - cy) ** 2 + (z + 0.5 - cz) ** 2 <= r * r) for (let x = x0; x < x1; x++) this.set(x, y, z, m);
    return this;
  }

  // Horizontal pipe along y (centre at x=cx, z=cz).
  cylY(cx: number, cz: number, r: number, y0: number, y1: number, m: number): this {
    for (let z = Math.floor(cz - r - 1); z <= Math.ceil(cz + r + 1); z++)
      for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++)
        if ((x + 0.5 - cx) ** 2 + (z + 0.5 - cz) ** 2 <= r * r) for (let y = y0; y < y1; y++) this.set(x, y, z, m);
    return this;
  }

  sphere(cx: number, cy: number, cz: number, r: number, m: number, squashZ = 1): this {
    for (let z = Math.floor(cz - r - 1); z <= Math.ceil(cz + r + 1); z++)
      for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++)
        for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++)
          if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 + ((z + 0.5 - cz) / squashZ) ** 2 <= r * r) this.set(x, y, z, m);
    return this;
  }

  // Gable roof over [x0,x1)×[y0,y1) starting at z, ridge along x (axis 'x') or y.
  gable(x0: number, y0: number, x1: number, y1: number, z: number, axis: 'x' | 'y', m: number, slope = 1): this {
    const span = axis === 'x' ? y1 - y0 : x1 - x0;
    const half = span / 2;
    for (let k = 0; k < Math.ceil(half / 1) * slope + 1; k++) {
      const inset = k / slope;
      if (inset >= half) break;
      if (axis === 'x') this.box(x0, Math.round(y0 + inset), z + k, x1, Math.round(y1 - inset), z + k + 1, m);
      else this.box(Math.round(x0 + inset), y0, z + k, Math.round(x1 - inset), y1, z + k + 1, m);
    }
    return this;
  }

  // Pixel letters (3×5 font) on the +y face (front-left wall, reading along +x) or the +x face (front-right wall,
  // reading along −y). The letters replace the outer layer of the wall: (x, y) is where the first letter starts.
  text(str: string, face: '+x' | '+y', x: number, y: number, zTop: number, m: number, emboss = false): this {
    let cursor = 0;
    for (const ch of str.toUpperCase()) {
      const g = FONT[ch];
      if (!g) {
        cursor += 2;
        continue;
      }
      for (let row = 0; row < 5; row++)
        for (let col = 0; col < 3; col++) {
          if (g[row][col] !== '#') continue;
          const z = zTop - row;
          if (face === '+y') {
            const xx = x + cursor + col;
            if (emboss) this.set(xx, y + 1, z, m);
            else this.set(xx, y, z, m);
          } else {
            const yy = y - cursor - col;
            if (emboss) this.set(x + 1, yy, z, m);
            else this.set(x, yy, z, m);
          }
        }
      cursor += 4;
    }
    return this;
  }

  // Rotate a quarter turn counter-clockwise around z (for 4-direction characters).
  rotated(): Vox {
    const out = new Vox(this.d, this.w, this.h);
    for (let z = 0; z < this.h; z++)
      for (let y = 0; y < this.d; y++)
        for (let x = 0; x < this.w; x++) {
          const m = this.cells[this.i(x, y, z)];
          if (m) out.set(y, this.w - 1 - x, z, m);
        }
    for (const [k, list] of Object.entries(this.points)) out.points[k] = list.map(([x, y, z]) => [y, this.w - x, z]);
    return out;
  }

  // Copy another model into this one at an offset (only its solid voxels).
  stamp(src: Vox, ox: number, oy: number, oz: number): this {
    for (let z = 0; z < src.h; z++)
      for (let y = 0; y < src.d; y++)
        for (let x = 0; x < src.w; x++) {
          const m = src.cells[(z * src.d + y) * src.w + x];
          if (m) this.set(x + ox, y + oy, z + oz, m);
        }
    for (const [k, list] of Object.entries(src.points)) for (const [x, y, z] of list) this.point(k, x + ox, y + oy, z + oz);
    return this;
  }

  // Highest solid voxel + 1 (the model's real height).
  top(): number {
    for (let z = this.h - 1; z >= 0; z--) for (let y = 0; y < this.d; y++) for (let x = 0; x < this.w; x++) if (this.cells[this.i(x, y, z)]) return z + 1;
    return 0;
  }
}

// ---------- 3×5 pixel font for voxel signs ----------

export const FONT: Record<string, string[]> = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'],
  N: ['##.', '#.#', '#.#', '#.#', '#.#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  Q: ['.#.', '#.#', '#.#', '##.', '.##'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  W: ['#.#', '#.#', '###', '###', '#.#'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['##.', '..#', '.#.', '#..', '###'],
  '9': ['###', '#.#', '###', '..#', '##.'],
  '-': ['...', '...', '###', '...', '...'],
  '+': ['...', '.#.', '###', '.#.', '...'],
};

// ---------- rendering ----------

export interface Rendered {
  img: Image; // colour
  glow: Image; // emissive pixels + halo (night layer), may be empty
  ax: number; // anchor: pixel of model point (0, 0, 0)
  ay: number;
  height: number; // model height in voxels
  points: Record<string, [number, number][]>; // points of interest in sprite pixels
  hasGlow: boolean;
}

const FACE_TOP = 0;
const FACE_LEFT = 1; // +y face: front-left wall
const FACE_RIGHT = 2; // +x face: front-right wall

const INK: RGB = [16, 12, 28];
const SHADOW_TINT: RGB = [40, 26, 84];

function hash3(x: number, y: number, z: number, salt: number): number {
  let h = (x * 374761393 + y * 668265263 + z * 2246822519 + salt * 3266489917) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export interface RenderOptions {
  outline?: boolean; // dark 1px silhouette outline (default true)
  innerLines?: boolean; // dark lines where a near surface overlaps a far one (default true)
  ao?: boolean;
  scale?: number; // 2 = half-size sprite (toolbar icons): one ray every 2 iso pixels
}

export function render(v: Vox, opts: RenderOptions = {}): Rendered {
  const outline = opts.outline ?? true;
  const innerLines = opts.innerLines ?? true;
  const useAO = opts.ao ?? true;
  const S = opts.scale ?? 1;
  const X0 = -v.d - S;
  const Y0 = -v.h - S;
  const W = Math.ceil((v.w + v.d + 2 * S) / S);
  const H = Math.ceil((v.h + Math.ceil((v.w + v.d) / 2) + 2 * S) / S);
  const img = createImage(W, H);
  const glow = createImage(W, H);
  const depth = new Float32Array(W * H).fill(-1e9);
  const face = new Int8Array(W * H).fill(-1);
  const emissive = new Uint8Array(W * H);
  const glowRgb: RGB[] = new Array(W * H);
  let hasGlow = false;

  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const Xc = X0 + px * S + 0.5;
      const Yc = Y0 + py * S + 0.5;
      const c = Xc / 2 + Yc; // along the ray: y = x − Xc, z = x − c
      // start beyond the far corner on every axis
      let x = Math.max(v.w, v.d + Xc, v.h + c) + 0.001;
      let ix = Math.floor(x);
      let iy = Math.floor(x - Xc);
      let iz = Math.floor(x - c);
      let hit = 0;
      let hitFace = -1;
      for (let guard = 0; guard < 4 * (v.w + v.d + v.h) + 16; guard++) {
        // next boundary below the current position on each axis, expressed as an x value
        const bx = ix;
        const by = iy + Xc;
        const bz = iz + c;
        if (bx >= by && bx >= bz) {
          x = bx;
          ix--;
          hitFace = FACE_RIGHT;
        } else if (by >= bz) {
          x = by;
          iy--;
          hitFace = FACE_LEFT;
        } else {
          x = bz;
          iz--;
          hitFace = FACE_TOP;
        }
        if (ix < 0 || iy < 0 || iz < 0) break;
        if (ix < v.w && iy < v.d && iz < v.h) {
          const m = v.cells[(iz * v.d + iy) * v.w + ix];
          if (m) {
            hit = m;
            break;
          }
        }
      }
      if (!hit) continue;
      const k = py * W + px;
      const M = MATS[hit];
      let r = M.rgb[0];
      let g = M.rgb[1];
      let b = M.rgb[2];
      const jit = M.jitter ?? 0.04;
      if (jit) {
        const n = Math.floor(hash3(ix, iy, iz, hit) * 3) - 1; // -1, 0, +1
        const f = 1 + n * jit;
        r *= f;
        g *= f;
        b *= f;
      }
      let shade = hitFace === FACE_TOP ? 1 : hitFace === FACE_LEFT ? 0.8 : 0.6;
      if (M.flat) shade = hitFace === FACE_TOP ? 1 : 0.92;
      else if (M.emit) shade = 0.85 + shade * 0.15;
      // ambient occlusion: solid neighbours around the cell in front of the face
      if (useAO && !M.emit && !M.flat) {
        const nx = ix + (hitFace === FACE_RIGHT ? 1 : 0);
        const ny = iy + (hitFace === FACE_LEFT ? 1 : 0);
        const nz = iz + (hitFace === FACE_TOP ? 1 : 0);
        let occ = 0;
        const s = (a: number, bb: number, cc: number, wgt: number) => {
          if (v.get(a, bb, cc)) occ += wgt;
        };
        if (hitFace === FACE_TOP) {
          s(nx - 1, ny, nz, 1);
          s(nx + 1, ny, nz, 1);
          s(nx, ny - 1, nz, 1);
          s(nx, ny + 1, nz, 1);
          s(nx - 1, ny - 1, nz, 0.5);
          s(nx + 1, ny + 1, nz, 0.5);
          s(nx - 1, ny + 1, nz, 0.5);
          s(nx + 1, ny - 1, nz, 0.5);
        } else if (hitFace === FACE_LEFT) {
          s(nx - 1, ny, nz, 1);
          s(nx + 1, ny, nz, 1);
          s(nx, ny, nz + 1, 1);
          s(nx, ny, nz - 1, nz > 0 ? 1 : 0);
        } else {
          s(nx, ny - 1, nz, 1);
          s(nx, ny + 1, nz, 1);
          s(nx, ny, nz + 1, 1);
          s(nx, ny, nz - 1, nz > 0 ? 1 : 0);
        }
        const level = occ >= 2.5 ? 2 : occ >= 1 ? 1 : 0;
        shade *= level === 2 ? 0.76 : level === 1 ? 0.88 : 1;
      }
      r *= shade;
      g *= shade;
      b *= shade;
      if (!M.emit && !M.flat && hitFace !== FACE_TOP) {
        // cool, purple-ish shadows instead of grey ones
        const t = hitFace === FACE_RIGHT ? 0.2 : 0.08;
        r = r * (1 - t) + SHADOW_TINT[0] * t;
        g = g * (1 - t) + SHADOW_TINT[1] * t;
        b = b * (1 - t) + SHADOW_TINT[2] * t;
      }
      const o = k * 4;
      img.data[o] = r;
      img.data[o + 1] = g;
      img.data[o + 2] = b;
      img.data[o + 3] = 255;
      depth[k] = ix + iy + iz;
      face[k] = hitFace;
      if (M.emit) {
        emissive[k] = Math.round(M.emit * 255);
        glowRgb[k] = M.glow ?? M.rgb;
        hasGlow = true;
      }
    }
  }

  // edge highlights: the top edge of every wall, and the convex vertical corner between the two walls
  const lighten = (k: number, f: number) => {
    const o = k * 4;
    for (let ch = 0; ch < 3; ch++) img.data[o + ch] = Math.min(255, img.data[o + ch] * f + 6);
  };
  const darken = (k: number, f: number) => {
    const o = k * 4;
    for (let ch = 0; ch < 3; ch++) img.data[o + ch] = img.data[o + ch] * f + INK[ch] * (1 - f);
  };
  const mark = new Uint8Array(W * H);
  for (let py = 0; py < H - 1; py++)
    for (let px = 0; px < W; px++) {
      const k = py * W + px;
      if (face[k] !== FACE_TOP || emissive[k]) continue;
      const below = k + W;
      if (face[below] >= 1 && Math.abs(depth[below] - depth[k]) <= 2) mark[k] = 1;
    }
  for (let py = 0; py < H; py++)
    for (let px = 0; px < W - 1; px++) {
      const k = py * W + px;
      if (face[k] !== FACE_LEFT || emissive[k]) continue;
      if (face[k + 1] === FACE_RIGHT && Math.abs(depth[k + 1] - depth[k]) <= 1) mark[k] = 2;
    }
  for (let k = 0; k < W * H; k++) if (mark[k]) lighten(k, mark[k] === 1 ? 1.16 : 1.1);

  // inner contour lines where a near surface overlaps a far one (comic look, keeps shapes readable)
  if (innerLines) {
    const far = new Uint8Array(W * H);
    for (let py = 0; py < H; py++)
      for (let px = 0; px < W; px++) {
        const k = py * W + px;
        if (face[k] < 0) continue;
        const dk = depth[k];
        const near = (q: number) => face[q] >= 0 && depth[q] - dk > 5 * S;
        if ((px > 0 && near(k - 1)) || (px < W - 1 && near(k + 1)) || (py > 0 && near(k - W)) || (py < H - 1 && near(k + W))) far[k] = 1;
      }
    for (let k = 0; k < W * H; k++) if (far[k] && !emissive[k]) darken(k, 0.55);
  }

  // silhouette outline
  if (outline) {
    const add: number[] = [];
    for (let py = 0; py < H; py++)
      for (let px = 0; px < W; px++) {
        const k = py * W + px;
        if (face[k] >= 0) continue;
        if ((px > 0 && face[k - 1] >= 0) || (px < W - 1 && face[k + 1] >= 0) || (py > 0 && face[k - W] >= 0) || (py < H - 1 && face[k + W] >= 0)) add.push(k);
      }
    for (const k of add) {
      const o = k * 4;
      img.data[o] = INK[0];
      img.data[o + 1] = INK[1];
      img.data[o + 2] = INK[2];
      img.data[o + 3] = 255;
    }
  }

  // glow layer: emissive pixels plus a 2px halo
  if (hasGlow) {
    for (let py = 0; py < H; py++)
      for (let px = 0; px < W; px++) {
        const k = py * W + px;
        if (!emissive[k]) continue;
        const [gr, gg, gb] = glowRgb[k];
        const e = emissive[k] / 255;
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++) {
            const qx = px + dx;
            const qy = py + dy;
            if (qx < 0 || qy < 0 || qx >= W || qy >= H) continue;
            const dist = Math.abs(dx) + Math.abs(dy);
            const a = dist === 0 ? 1 : dist === 1 ? 0.5 : dist === 2 ? 0.22 : 0;
            if (!a) continue;
            const o = (qy * W + qx) * 4;
            const na = Math.round(a * e * 255);
            if (na > glow.data[o + 3]) {
              glow.data[o] = gr;
              glow.data[o + 1] = gg;
              glow.data[o + 2] = gb;
              glow.data[o + 3] = na;
            }
          }
      }
  }

  const points: Record<string, [number, number][]> = {};
  for (const [name, list] of Object.entries(v.points)) points[name] = list.map(([x, y, z]) => [Math.round((x - y - X0) / S), Math.round(((x + y) / 2 - z - Y0) / S)]);
  return { img, glow, ax: Math.round(-X0 / S), ay: Math.round(-Y0 / S), height: v.top(), points, hasGlow };
}

// Ground shadow of a model: an opaque mask (the game draws all shadows into one layer at low alpha).
// The light comes from the front-left and above, so shadows fall to the right of the building.
export const LIGHT = { x: -0.4, y: 0.7, z: 1.6 };

export function renderShadow(v: Vox, maxLen = 40): { img: Image; ax: number; ay: number } {
  const top = v.top();
  const len = Math.min(maxLen, Math.ceil((top * Math.hypot(LIGHT.x, LIGHT.y)) / LIGHT.z));
  // ground region that can be shadowed: footprint grown towards +x and −y
  const gx0 = 0;
  const gx1 = v.w + Math.ceil(len * 0.6);
  const gy0 = -len;
  const gy1 = v.d;
  const X0 = gx0 - gy1 - 1;
  const X1 = gx1 - gy0 + 1;
  const Y0 = Math.floor((gx0 + gy0) / 2) - 1;
  const Y1 = Math.ceil((gx1 + gy1) / 2) + 1;
  const W = X1 - X0;
  const H = Y1 - Y0;
  const img = createImage(W, H);
  const step = 0.5;
  const n = Math.hypot(LIGHT.x, LIGHT.y, LIGHT.z);
  const lx = (LIGHT.x / n) * step;
  const ly = (LIGHT.y / n) * step;
  const lz = (LIGHT.z / n) * step;
  for (let py = 0; py < H; py++)
    for (let px = 0; px < W; px++) {
      const X = X0 + px + 0.5;
      const Y = Y0 + py + 0.5;
      let x = Y + X / 2;
      let y = Y - X / 2;
      if (x < gx0 || x >= gx1 || y < gy0 || y >= gy1) continue;
      let z = 0.5;
      let lit = true;
      for (let s = 0; s < 400 && z < top; s++) {
        x += lx;
        y += ly;
        z += lz;
        if (v.get(Math.floor(x), Math.floor(y), Math.floor(z))) {
          lit = false;
          break;
        }
      }
      if (lit) continue;
      const o = (py * W + px) * 4;
      img.data[o] = 8;
      img.data[o + 1] = 5;
      img.data[o + 2] = 20;
      img.data[o + 3] = 255;
    }
  return { img, ax: -X0, ay: -Y0 };
}
