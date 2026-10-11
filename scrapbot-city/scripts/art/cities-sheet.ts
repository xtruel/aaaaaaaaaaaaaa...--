// Review sheet for the city themes (0.7, increment 2), read back from the generated atlas (what the game will load):
//   npx esbuild scripts/art/cities-sheet.ts --bundle --platform=node --format=esm --outfile=<tmp>/cities.mjs --log-level=warning
//   node <tmp>/cities.mjs <out.png> [<out-3x.png> [<frames.png>]]
// 1. (out.png) the same small district (HQ, Recycler, Dock, Pods, junk, sludge, rubble, grass, the old streets with
//    their lamps, the canal behind) in each of the five campaign cities, on its ground, with its border ring, by day
//    and at midnight side by side. Scrapbot City uses the plain frames and the game's light, exactly as today; the
//    others swap every terrain frame t/<family>/... for t/<theme>/<family>/..., fill the ring from their theme's
//    scenery and decor, and use the theme's suggested light (atlas.json themes.<theme>.light);
// 2. (out-3x.png) the centre of each district at 3×, by day and at night;
// 3. (frames.png) every new theme frame at 3×, by day and at night.
// Ground and scenery are chosen with the renderer's rules (renderer.ts groundFrame / paintProp, life.ts placeScenery)
// on a 16×12 map with a 6-tile ring behind it and a 3-tile ring in front.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { blit, createImage, decodePNG, encodePNG } from './png';
import type { Image } from './png';
import { FONT } from './voxel';

const [out, out3, outFrames] = process.argv.slice(2);
if (!out) throw new Error('usage: cities-sheet <out.png> [<out-3x.png> [<frames.png>]]');
const root = process.cwd();
type RGB = [number, number, number];
interface DecorMeta {
  w: number;
  d: number;
  frames: number;
  fps: number;
  tall: boolean;
}
interface ThemeMeta {
  terrain: string[];
  scenery: Record<string, DecorMeta>;
  decor: string[];
  light: { day: RGB; night: RGB; dark: number };
}
const meta = JSON.parse(readFileSync(join(root, 'src/assets/iso/atlas.json'), 'utf8')) as {
  frames: Record<string, [number, number, number, number, number, number]>;
  decor: Record<string, DecorMeta>;
  themes: Record<string, ThemeMeta>;
};
const atlas = decodePNG(new Uint8Array(readFileSync(join(root, 'src/assets/iso/atlas.png'))));

interface Spr {
  img: Image;
  ax: number;
  ay: number;
}
const cache = new Map<string, Spr | null>();
function spr(name: string): Spr | null {
  if (cache.has(name)) return cache.get(name)!;
  const f = meta.frames[name];
  let s: Spr | null = null;
  if (f) {
    const [x, y, w, h, ax, ay] = f;
    const img = createImage(w, h);
    for (let r = 0; r < h; r++) img.data.set(atlas.data.subarray(((y + r) * atlas.w + x) * 4, ((y + r) * atlas.w + x + w) * 4), r * w * 4);
    s = { img, ax, ay };
  }
  cache.set(name, s);
  return s;
}
function need(name: string): Spr {
  const s = spr(name);
  if (!s) throw new Error(`missing frame ${name}`);
  return s;
}

const BG: RGB = [46, 40, 65];
function fill(img: Image, rgb: RGB): void {
  for (let i = 0; i < img.w * img.h; i++) img.data.set([rgb[0], rgb[1], rgb[2], 255], i * 4);
}
function upscale(img: Image, k: number): Image {
  const o = createImage(img.w * k, img.h * k);
  for (let y = 0; y < o.h; y++)
    for (let x = 0; x < o.w; x++) {
      const s = (Math.floor(y / k) * img.w + Math.floor(x / k)) * 4;
      o.data.set(img.data.subarray(s, s + 4), (y * o.w + x) * 4);
    }
  return o;
}
function crop(img: Image, x0: number, y0: number, w: number, h: number): Image {
  const o = createImage(w, h);
  for (let y = 0; y < h; y++) o.data.set(img.data.subarray(((y0 + y) * img.w + x0) * 4, ((y0 + y) * img.w + x0 + w) * 4), y * w * 4);
  return o;
}
// alpha-blended blit
function over(dst: Image, src: Image, dx: number, dy: number, alpha = 1): void {
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++) {
      const s = (y * src.w + x) * 4;
      const a = (src.data[s + 3] / 255) * alpha;
      if (!a) continue;
      const px = dx + x;
      const py = dy + y;
      if (px < 0 || py < 0 || px >= dst.w || py >= dst.h) continue;
      const d = (py * dst.w + px) * 4;
      for (let c = 0; c < 3; c++) dst.data[d + c] = dst.data[d + c] * (1 - a) + src.data[s + c] * a;
      dst.data[d + 3] = 255;
    }
}
const LABEL_FONT: Record<string, string[]> = {
  ...FONT,
  '3': ['##.', '..#', '.#.', '..#', '##.'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '##.', '..#', '##.'],
  '6': ['.##', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '.#.', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '/': ['..#', '..#', '.#.', '#..', '#..'],
  ',': ['...', '...', '...', '.#.', '#..'],
  '.': ['...', '...', '...', '...', '.#.'],
  ':': ['...', '.#.', '...', '.#.', '...'],
  '(': ['.#.', '#..', '#..', '#..', '.#.'],
  ')': ['.#.', '..#', '..#', '..#', '.#.'],
  J: ['..#', '..#', '..#', '#.#', '.#.'],
};
function text(img: Image, str: string, x0: number, y0: number, rgb: RGB = [198, 244, 50], k = 2): void {
  let cx = x0;
  for (const ch of str.toUpperCase()) {
    const g = LABEL_FONT[ch];
    if (g)
      for (let r = 0; r < 5; r++)
        for (let c = 0; c < 3; c++) {
          if (g[r][c] !== '#') continue;
          for (let yy = 0; yy < k; yy++)
            for (let xx = 0; xx < k; xx++) {
              const px = cx + c * k + xx;
              const py = y0 + r * k + yy;
              if (px < 0 || py < 0 || px >= img.w || py >= img.h) continue;
              img.data.set([rgb[0], rgb[1], rgb[2], 255], (py * img.w + px) * 4);
            }
        }
    cx += 4 * k;
  }
}

// ---------- the game's helpers (src/game/world.ts hash2, renderer.ts valueNoise, life.ts streets) ----------
function hash2(x: number, y: number, salt = 0): number {
  let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function valueNoise(x: number, y: number, salt: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const a = hash2(x0, y0, salt);
  const b = hash2(x0 + 1, y0, salt);
  const c = hash2(x0, y0 + 1, salt);
  const d = hash2(x0 + 1, y0 + 1, salt);
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}
const isRoadRow = (ty: number) => ty % 11 === 4;
const isRoadCol = (tx: number) => ((tx % 14) + 14) % 14 === 6;
const isCanal = (tx: number, ty: number) => (ty === -3 || ty === -4) && !isRoadCol(tx);

// ---------- the district ----------
const W = 16;
const H = 12;
const RB = 6; // ring behind the map (−x, −y)
const RF = 3; // ring in front (+x, +y)
const T = { GROUND: 0, JUNK: 1, SLUDGE: 2, RUBBLE: 3, GRASS: 4 } as const;
const tiles = new Uint8Array(W * H);
const amount = new Uint16Array(W * H);
const idx = (x: number, y: number) => y * W + x;
const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
const put = (list: [number, number][], kind: number, amt = 0) => {
  for (const [x, y] of list) {
    tiles[idx(x, y)] = kind;
    amount[idx(x, y)] = amt;
  }
};
put([[1, 1], [2, 1], [1, 2], [3, 2], [2, 3], [13, 1], [14, 2], [15, 2]], T.JUNK, 40);
put([[3, 1], [0, 2], [12, 2]], T.JUNK, 20);
put([[2, 2], [14, 1]], T.JUNK, 8);
put([[12, 9], [13, 9], [12, 10], [13, 10], [14, 10], [13, 11]], T.SLUDGE);
put([[3, 10], [4, 10], [4, 9], [5, 11]], T.RUBBLE);
put([[0, 9], [1, 9], [0, 10], [1, 10], [2, 10], [0, 11], [1, 11], [2, 11], [9, 1], [10, 1], [10, 2], [11, 2]], T.GRASS);
interface Bld {
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
}
const BUILDINGS: Bld[] = [
  { type: 'hq', x: 8, y: 6, w: 3, h: 3 },
  { type: 'recycler', x: 12, y: 5, w: 2, h: 2 },
  { type: 'dock', x: 13, y: 0, w: 2, h: 2 },
  { type: 'pods', x: 2, y: 6, w: 2, h: 2 },
];
const occupied = new Set<number>();
for (const b of BUILDINGS) for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) occupied.add(idx(x, y));

const X0 = -RB;
const Y0 = -RB;
const X1 = W + RF - 1;
const Y1 = H + RF - 1;

// the renderer's groundFrame, on this little map
function groundFrame(tx: number, ty: number): string {
  const inside = inBounds(tx, ty);
  const h = hash2(tx, ty);
  if (!inside) {
    if (isCanal(tx, ty)) {
      const mask = (isCanal(tx - 1, ty) ? 1 : 0) | (isCanal(tx + 1, ty) ? 2 : 0) | (isCanal(tx, ty - 1) ? 4 : 0) | (isCanal(tx, ty + 1) ? 8 : 0);
      return `t/water/${mask}`;
    }
    if (isRoadRow(ty) && (tx < 0 || tx >= W)) return isRoadCol(tx) ? 't/road/c' : 't/road/x';
    if (isRoadCol(tx) && (ty < 0 || ty >= H)) return 't/road/y';
    return `t/outer/${Math.floor(h * 4)}`;
  }
  const tile = tiles[idx(tx, ty)];
  if (tile === T.GRASS) return `t/grass/${Math.floor(h * 6)}`;
  if (tile === T.SLUDGE) {
    const same = (dx: number, dy: number) => inBounds(tx + dx, ty + dy) && tiles[idx(tx + dx, ty + dy)] === T.SLUDGE;
    const mask = (same(-1, 0) ? 1 : 0) | (same(1, 0) ? 2 : 0) | (same(0, -1) ? 4 : 0) | (same(0, 1) ? 8 : 0);
    return `t/sludge/${mask}/0`;
  }
  const v = Math.floor(h * 4);
  const row = isRoadRow(ty);
  const col = isRoadCol(tx);
  if (tile === T.GROUND && (row || col)) return row && col ? 't/road/c' : row ? 't/road/x' : 't/road/y';
  if (tile === T.JUNK) return `t/dirty/${v}`;
  if (tile === T.RUBBLE) return `t/lot/${v}`;
  const near = (kind: number, r: number) => {
    for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) if ((x !== tx || y !== ty) && inBounds(x, y) && tiles[idx(x, y)] === kind) return true;
    return false;
  };
  if (isRoadRow(ty - 1) || isRoadRow(ty + 1) || isRoadCol(tx - 1) || isRoadCol(tx + 1)) return `t/pave/${v}`;
  if (near(T.SLUDGE, 1)) return `t/mud/${v}`;
  if (near(T.JUNK, 1)) return `t/dirty/${v}`;
  const lot = valueNoise(tx / 7, ty / 7, 21);
  if (lot < 0.26) return `t/lot/${v}`;
  if (lot > 0.78) return `t/ind/${v}`;
  const n = valueNoise(tx / 5, ty / 5, 9);
  return `t/ground/${n < 0.38 ? 0 : n < 0.62 ? 1 : 2}/${v}`;
}

// The ring, as recommended to the renderer for a themed city (life.ts placeScenery for Scrapbot City):
//  1. the theme's signature pieces first, biggest footprint first, each one `copies` times, at the first spot that
//     fits in a list of the back ring's tiles shuffled by the city's seed (tall ones only where they are behind the
//     map, like every tall piece);
//  2. then life.ts placeScenery's pass (density 0.2 behind, 0.11 in front, tall pieces only behind the map, the
//     first row in front kept clear, never on streets or the canal) with the signature pieces and the theme's decor.
// Scrapbot City skips pass 1 and draws from every decor piece, exactly as today.
interface Scenery {
  frame: string; // frame prefix: d/<name> or sc/<theme>/<name>
  tx: number;
  ty: number;
  w: number;
  d: number;
  frames: number;
}
function placeScenery(seed: number, pool: [string, DecorMeta][], signature: [string, DecorMeta][], copies: number): { items: Scenery[]; taken: Set<string> } {
  const items: Scenery[] = [];
  const taken = new Set<string>();
  const low = pool.filter(([, m]) => !m.tall);
  const salt = (seed % 9973) + 101;
  const inRing = (x: number, y: number) => x >= X0 && y >= Y0 && x <= X1 && y <= Y1 && !inBounds(x, y);
  const tryPlace = (name: string, m: DecorMeta, tx: number, ty: number): boolean => {
    for (let y = ty; y < ty + m.d; y++)
      for (let x = tx; x < tx + m.w; x++) {
        if (!inRing(x, y) || taken.has(`${x},${y}`) || isRoadRow(y) || isRoadCol(x) || isCanal(x, y)) return false;
        if (x === W && y >= 0) return false;
        if (y === H && x >= 0) return false;
      }
    const isBack = tx + m.w <= 0 || ty + m.d <= 0;
    if (m.tall && !isBack) return false;
    for (let y = ty; y < ty + m.d; y++) for (let x = tx; x < tx + m.w; x++) taken.add(`${x},${y}`);
    items.push({ frame: name, tx, ty, w: m.w, d: m.d, frames: m.frames });
    return true;
  };
  // pass 1: the signature pieces
  const spots: [number, number, number][] = [];
  for (let ty = Y0; ty <= Y1; ty++) for (let tx = X0; tx <= X1; tx++) if (inRing(tx, ty) && (tx < 0 || ty < 0)) spots.push([hash2(tx, ty, salt + 2), tx, ty]);
  spots.sort((a, b) => a[0] - b[0]);
  const sig = [...signature].sort((a, b) => b[1].w * b[1].d - a[1].w * a[1].d || (a[0] < b[0] ? -1 : 1));
  for (let c = 0; c < copies; c++)
    for (const [name, m] of sig)
      for (const [, tx, ty] of spots) if (tryPlace(name, m, tx, ty)) break;
  // pass 2: placeScenery's pass
  for (let ty = Y0; ty <= Y1; ty++)
    for (let tx = X0; tx <= X1; tx++) {
      if (!inRing(tx, ty)) continue;
      const h = hash2(tx, ty, salt);
      const back = tx < 0 || ty < 0;
      if (h > (back ? 0.2 : 0.11)) continue;
      const list = back ? pool : low;
      if (!list.length) continue;
      const [name, m] = list[Math.floor(hash2(tx, ty, salt + 1) * list.length)];
      tryPlace(name, m, tx, ty);
    }
  return { items, taken };
}

interface City {
  id: string;
  name: string;
  seed: number;
  theme: string | null;
}
const CITIES: City[] = [
  { id: 'home', name: 'Scrapbot City', seed: 2026, theme: null },
  { id: 'rustbay', name: 'Rustbay', seed: 7781, theme: 'rust' },
  { id: 'neon', name: 'Neon Heights', seed: 3141, theme: 'neon' },
  { id: 'greenvale', name: 'Greenvale', seed: 5150, theme: 'green' },
  { id: 'company', name: '2PM Company Town', seed: 9090, theme: 'corp' },
];
const HOME_LIGHT = { day: [255, 255, 255] as RGB, night: [16, 12, 52] as RGB, dark: 1 };

const TOP = 150; // room above the back corner for tall scenery
const SW = (X1 - X0 + Y1 - Y0 + 2) * 16;
const SH = (X1 - X0 + Y1 - Y0 + 2) * 8 + TOP + 30;
// screen position of a tile's top corner; the ring's left corner lands on x = 0
const at = (tx: number, ty: number) => ({ X: (tx - ty - (X0 - Y1 - 1)) * 16, Y: TOP + (tx + ty - X0 - Y0) * 8 });

function district(city: City, night: boolean): Image {
  const theme = city.theme;
  const tm = theme ? meta.themes[theme] : null;
  const light = tm ? tm.light : HOME_LIGHT;
  const themed = (name: string) => {
    if (!theme || !name.startsWith('t/')) return name;
    const fam = name.split('/')[1];
    return tm!.terrain.includes(fam) ? `t/${theme}/${name.slice(2)}` : name;
  };
  const img = createImage(SW, SH);
  fill(img, [15, 13, 24]);
  const blitT = (name: string, tx: number, ty: number) => {
    const s = need(themed(name));
    const p = at(tx, ty);
    blit(img, s.img, p.X - s.ax, p.Y - s.ay);
  };
  const signature: [string, DecorMeta][] = theme ? Object.entries(tm!.scenery).map(([n, m]) => [`sc/${theme}/${n}`, m]) : [];
  const pool: [string, DecorMeta][] = theme
    ? [...signature, ...tm!.decor.map((n) => [`d/${n}`, meta.decor[n]] as [string, DecorMeta])]
    : Object.keys(meta.decor)
        .sort()
        .map((n) => [`d/${n}`, meta.decor[n]] as [string, DecorMeta]);
  const sc = placeScenery(city.seed, pool, signature, 2);
  // ground, back to front
  for (let k = X0 + Y0; k <= X1 + Y1; k++)
    for (let tx = Math.max(X0, k - Y1); tx <= Math.min(X1, k - Y0); tx++) {
      const ty = k - tx;
      if (inBounds(tx, ty) && tiles[idx(tx, ty)] === T.SLUDGE) {
        const n = valueNoise(tx / 5, ty / 5, 9);
        blitT(`t/ground/${n < 0.38 ? 0 : n < 0.62 ? 1 : 2}/0`, tx, ty);
      }
      blitT(groundFrame(tx, ty), tx, ty);
    }
  // the map border: a thin dotted pink line (renderer.ts paintMapBorder), drawn under the props
  {
    const dot = solid(2, 1, [177, 26, 94]);
    const run = (from: { X: number; Y: number }, steps: number, sx: number) => {
      for (let k = 0; k < steps; k++) if (k % 4 < 2) over(img, dot, from.X + sx * 2 * k - (sx < 0 ? 2 : 0), from.Y + k, 0.55);
    };
    run(at(0, 0), W * 8, 1);
    run(at(0, H), W * 8, 1);
    run(at(0, 0), H * 8, -1);
    run(at(W, 0), H * 8, -1);
  }
  // props: junk, rubble (inside: the gameplay tiles; outside: scattered scrap)
  for (let k = X0 + Y0; k <= X1 + Y1; k++)
    for (let tx = Math.max(X0, k - Y1); tx <= Math.min(X1, k - Y0); tx++) {
      const ty = k - tx;
      const h = hash2(tx, ty, 31);
      if (!inBounds(tx, ty)) {
        const behind = tx < 0 || ty < 0;
        const near = tx >= W ? tx - W : ty >= H ? ty - H : 99;
        if (isRoadRow(ty) || isRoadCol(tx) || isCanal(tx, ty) || sc.taken.has(`${tx},${ty}`)) continue;
        if (h > 0.9 && (behind || near >= 1)) blitT(`p/junk/${Math.floor(hash2(tx, ty, 32) * 3)}/${Math.floor(hash2(tx, ty, 33) * 4)}`, tx, ty);
        else if (h > 0.82) blitT(`p/rubble/${Math.floor(hash2(tx, ty, 34) * 4)}`, tx, ty);
        continue;
      }
      const i = idx(tx, ty);
      if (occupied.has(i)) continue;
      if (tiles[i] === T.JUNK) {
        const a = amount[i];
        blitT(`p/junk/${a < 15 ? 0 : a < 35 ? 1 : 2}/${Math.floor(h * 4)}`, tx, ty);
      } else if (tiles[i] === T.RUBBLE) blitT(`p/rubble/${Math.floor(h * 4)}`, tx, ty);
    }
  for (let tx = X0; tx <= X1; tx++) blitT(`t/edge/l/${(tx & 1) as 0 | 1}`, tx, Y1);
  for (let ty = Y0; ty <= Y1; ty++) blitT(`t/edge/r/${(ty & 1) as 0 | 1}`, X1, ty);
  // building shadows
  for (const b of BUILDINGS) {
    const s = need(`b/${b.type}/shadow`);
    const p = at(b.x, b.y);
    for (let y = 0; y < s.img.h; y++)
      for (let x = 0; x < s.img.w; x++) {
        if (!s.img.data[(y * s.img.w + x) * 4 + 3]) continue;
        const px = p.X - s.ax + x;
        const py = p.Y - s.ay + y;
        if (px < 0 || py < 0 || px >= img.w || py >= img.h) continue;
        const o = (py * img.w + px) * 4;
        for (let c = 0; c < 3; c++) img.data[o + c] *= 0.66;
      }
  }
  // street lamps every fifth tile on the curbs (not where a building or junk stands)
  const lamps: { tx: number; ty: number; axis: 'x' | 'y' }[] = [];
  for (let ty = Y0; ty <= Y1; ty++)
    for (let tx = X0; tx <= X1; tx++) {
      const row = isRoadRow(ty);
      const col = isRoadCol(tx);
      if (row === col || isCanal(tx, ty)) continue;
      if (inBounds(tx, ty) && (occupied.has(idx(tx, ty)) || tiles[idx(tx, ty)] !== T.GROUND)) continue;
      if (row && ((tx % 5) + 5) % 5 === 2) lamps.push({ tx, ty, axis: 'x' });
      if (col && ((ty % 5) + 5) % 5 === 2) lamps.push({ tx, ty, axis: 'y' });
    }
  // objects back to front: buildings, scenery, lamps
  const objs: { tx: number; ty: number; w: number; d: number; frame: string }[] = [
    ...BUILDINGS.map((b) => ({ tx: b.x, ty: b.y, w: b.w, d: b.h, frame: `b/${b.type}/w0` })),
    ...sc.items.map((s) => ({ tx: s.tx, ty: s.ty, w: s.w, d: s.d, frame: `${s.frame}/0` })),
    ...lamps.map((l) => ({ tx: l.tx, ty: l.ty, w: 1, d: 1, frame: `p/lamp/${l.axis}` })),
  ];
  objs.sort((a, b) => a.tx + a.w + a.ty + a.d - (b.tx + b.w + b.ty + b.d) || a.tx - b.tx);
  for (const o of objs) {
    const s = need(o.frame);
    const p = at(o.tx, o.ty);
    over(img, s.img, p.X - s.ax, p.Y - s.ay);
  }
  // light
  if (!night) {
    const [r, g, b] = light.day;
    for (let i = 0; i < img.w * img.h; i++) {
      img.data[i * 4] = (img.data[i * 4] * r) / 255;
      img.data[i * 4 + 1] = (img.data[i * 4 + 1] * g) / 255;
      img.data[i * 4 + 2] = (img.data[i * 4 + 2] * b) / 255;
    }
    return img;
  }
  // midnight, as drawLighting: the veil, then the glow frames added at (dark − 0.15) × 2.2
  const dark = Math.min(0.9, 0.55 * light.dark);
  const [vr, vg, vb] = light.night;
  for (let i = 0; i < img.w * img.h; i++) {
    const o = i * 4;
    img.data[o] = img.data[o] * (1 - dark) + vr * dark;
    img.data[o + 1] = img.data[o + 1] * (1 - dark) + vg * dark;
    img.data[o + 2] = img.data[o + 2] * (1 - dark) + vb * dark;
  }
  const ga = Math.min(1, (dark - 0.15) * 2.2);
  const add = (name: string, tx: number, ty: number, a: number) => {
    const g = spr(name);
    if (!g) return;
    const p = at(tx, ty);
    for (let y = 0; y < g.img.h; y++)
      for (let x = 0; x < g.img.w; x++) {
        const s = (y * g.img.w + x) * 4;
        const al = (g.img.data[s + 3] / 255) * a;
        if (!al) continue;
        const px = p.X - g.ax + x;
        const py = p.Y - g.ay + y;
        if (px < 0 || py < 0 || px >= img.w || py >= img.h) continue;
        const d = (py * img.w + px) * 4;
        for (let c = 0; c < 3; c++) img.data[d + c] = Math.min(255, img.data[d + c] + g.img.data[s + c] * al);
      }
  };
  for (const o of objs) if (!o.frame.startsWith('p/lamp')) add(`${o.frame}/g`, o.tx, o.ty, ga);
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) if (tiles[idx(tx, ty)] === T.SLUDGE) add('t/sludge/15/0', tx, ty, ga * 0.35);
  for (const l of lamps) {
    add(`p/lamp/${l.axis}/g`, l.tx, l.ty, ga);
    const cx = l.axis === 'x' ? 3 : 9;
    const cy = l.axis === 'x' ? 9 : 3;
    const p = at(l.tx, l.ty);
    const px = Math.round(p.X + cx - cy);
    const py = Math.round(p.Y + (cx + cy) / 2);
    const POOL = [5, 10, 14, 16, 14, 10, 5];
    for (let r = 0; r < POOL.length; r++) for (let x = px - POOL[r]; x < px + POOL[r]; x++) {
      const yy = py - 3 + r;
      if (x < 0 || yy < 0 || x >= img.w || yy >= img.h) continue;
      const d = (yy * img.w + x) * 4;
      img.data[d] = Math.min(255, img.data[d] + 255 * 0.12 * ga);
      img.data[d + 1] = Math.min(255, img.data[d + 1] + 212 * 0.12 * ga);
      img.data[d + 2] = Math.min(255, img.data[d + 2] + 64 * 0.12 * ga);
    }
  }
  return img;
}
function solid(w: number, h: number, rgb: RGB): Image {
  const o = createImage(w, h);
  fill(o, rgb);
  return o;
}

function titled(label: string, img: Image, sub = ''): Image {
  const o = createImage(Math.max(img.w, 400), img.h + 22);
  fill(o, BG);
  text(o, label, 4, 4);
  if (sub) text(o, sub, 8 + (label.length + 2) * 8, 4, [200, 196, 220]);
  blit(o, img, 0, 22);
  return o;
}
function pair(a: Image, b: Image, gap = 8): Image {
  const o = createImage(a.w + b.w + gap, Math.max(a.h, b.h));
  fill(o, BG);
  blit(o, a, 0, 0);
  blit(o, b, a.w + gap, 0);
  return o;
}
function stack(parts: Image[], gap = 6): Image {
  const w = Math.max(...parts.map((p) => p.w));
  const h = parts.reduce((n, p) => n + p.h + gap, 0);
  const o = createImage(w, h);
  fill(o, BG);
  let y = 0;
  for (const p of parts) {
    blit(o, p, 0, y);
    y += p.h + gap;
  }
  return o;
}

const scenes = CITIES.map((c) => ({ city: c, day: district(c, false), night: district(c, true) }));
const label = (c: City) => `${c.name} - ${c.theme ? `theme ${c.theme}` : 'no theme (as today)'}`;
const sheet = stack(scenes.map((s) => titled(label(s.city), pair(s.day, s.night), 'day / midnight')));
writeFileSync(out, encodePNG(sheet));
console.log(`cities sheet ${sheet.w}×${sheet.h} → ${out}`);

if (out3) {
  // the centre of each district at 3×: the HQ, the Recycler, the Pods, the junk and the sludge, plus the back ring
  const c = at(6, 4);
  const cw = 300;
  const ch = 210;
  const x0 = Math.max(0, c.X - cw / 2 - 40);
  const y0 = Math.max(0, c.Y - ch / 2 - 40);
  const parts = scenes.map((s) => titled(label(s.city), pair(upscale(crop(s.day, x0, y0, cw, ch), 3), upscale(crop(s.night, x0, y0, cw, ch), 3), 12), 'day / midnight, 3x'));
  const big = stack(parts);
  writeFileSync(out3, encodePNG(big));
  console.log(`cities 3× sheet ${big.w}×${big.h} → ${out3}`);
}

if (outFrames) {
  // every theme frame at 3×, day on the left of each pair, midnight on the right (with the theme's veil)
  const rows: Image[] = [];
  const MAXW = 1800;
  for (const theme of Object.keys(meta.themes)) {
    const light = meta.themes[theme].light;
    const groups = new Map<string, string[]>();
    for (const n of Object.keys(meta.frames)) {
      if (!(n.startsWith(`t/${theme}/`) || n.startsWith(`sc/${theme}/`)) || n.endsWith('/g')) continue;
      const key = n.startsWith('sc/') ? n.split('/').slice(0, 3).join('/') : n.split('/').slice(0, 3).join('/');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(n);
    }
    for (const [lab, list] of groups) {
      list.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
      const cells: Image[] = [];
      for (const n of list) {
        const s = need(n);
        const mk = (night: boolean) => {
          const o = createImage(s.img.w + 4, s.img.h + 4);
          fill(o, [52, 46, 74]);
          blit(o, s.img, 2, 2);
          if (night) {
            const dark = Math.min(0.9, 0.55 * light.dark);
            for (let i = 0; i < o.w * o.h; i++)
              for (let ch = 0; ch < 3; ch++) o.data[i * 4 + ch] = o.data[i * 4 + ch] * (1 - dark) + light.night[ch] * dark;
            const g = spr(`${n}/g`);
            if (g) {
              const ga = Math.min(1, (dark - 0.15) * 2.2);
              for (let y = 0; y < g.img.h; y++)
                for (let x = 0; x < g.img.w; x++) {
                  const si = (y * g.img.w + x) * 4;
                  const al = (g.img.data[si + 3] / 255) * ga;
                  if (!al) continue;
                  const px = 2 + s.ax - g.ax + x;
                  const py = 2 + s.ay - g.ay + y;
                  if (px < 0 || py < 0 || px >= o.w || py >= o.h) continue;
                  const d = (py * o.w + px) * 4;
                  for (let ch = 0; ch < 3; ch++) o.data[d + ch] = Math.min(255, o.data[d + ch] + g.img.data[si + ch] * al);
                }
            }
          }
          return o;
        };
        const big = upscale(pair(mk(false), mk(true), 2), 3);
        const cell = createImage(Math.max(big.w, n.length * 8 + 4), big.h + 14);
        fill(cell, BG);
        text(cell, n, 0, 0, [220, 220, 240]);
        blit(cell, big, 0, 14);
        cells.push(cell);
      }
      let cur: Image[] = [];
      let curW = 0;
      const flush = () => {
        if (!cur.length) return;
        const h = Math.max(...cur.map((c) => c.h)) + 10;
        const r = createImage(MAXW, h + 16);
        fill(r, BG);
        text(r, lab, 4, 2);
        let x = 4;
        for (const c of cur) {
          blit(r, c, x, 16);
          x += c.w + 12;
        }
        rows.push(r);
        cur = [];
        curW = 0;
      };
      for (const c of cells) {
        if (curW + c.w + 12 > MAXW - 8) flush();
        cur.push(c);
        curW += c.w + 12;
      }
      flush();
    }
  }
  const fs = stack(rows);
  writeFileSync(outFrames, encodePNG(fs));
  console.log(`theme frames sheet ${fs.w}×${fs.h} → ${outFrames}`);
}
