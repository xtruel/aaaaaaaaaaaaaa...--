// Review sheet for the 0.7 increment-2 catalogue art, read back from the generated atlas (what the game will load):
//   npx esbuild scripts/art/catalog-sheet.ts --bundle --platform=node --format=esm --outfile=<tmp>/catalog.mjs --log-level=warning
//   node <tmp>/catalog.mjs <out.png>
// 1. a yard: low scrap walls, corner pillars, fences and gates joined on the same lines, a concrete base inside, by
//    day and at night, at 1× and 3×;
// 2. a plaza with every decoration (each direction or variety), on concrete and on the ground, day / night, 1× and 3×;
// 3. each building without and with its new module, by day and at night, at 1× and 3×;
// 4. every new frame at 3×, by day and at night.
// Night is drawn like the game at midnight: a dark blue veil (alpha 0.55), glow frames added on top.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { blit, createImage, decodePNG, encodePNG } from './png';
import type { Image } from './png';
import { FONT } from './voxel';

const out = process.argv[2];
if (!out) throw new Error('usage: catalog-sheet <out.png>');
const root = process.cwd();
const meta = JSON.parse(readFileSync(join(root, 'src/assets/iso/atlas.json'), 'utf8')) as {
  frames: Record<string, [number, number, number, number, number, number]>;
  variants: Record<string, { frames: number }>;
};
const atlas = decodePNG(new Uint8Array(readFileSync(join(root, 'src/assets/iso/atlas.png'))));

interface Spr {
  img: Image;
  ax: number;
  ay: number;
}
function spr(name: string): Spr | null {
  const f = meta.frames[name];
  if (!f) return null;
  const [x, y, w, h, ax, ay] = f;
  const img = createImage(w, h);
  for (let r = 0; r < h; r++) img.data.set(atlas.data.subarray(((y + r) * atlas.w + x) * 4, ((y + r) * atlas.w + x + w) * 4), r * w * 4);
  return { img, ax, ay };
}
function need(name: string): Spr {
  const s = spr(name);
  if (!s) throw new Error(`missing frame ${name}`);
  return s;
}

const BG: [number, number, number] = [46, 40, 65];
function fill(img: Image, rgb: [number, number, number]): void {
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
// alpha-blended blit (the atlas has half-transparent pixels: the Purifier's mist)
function over(dst: Image, src: Image, dx: number, dy: number): void {
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++) {
      const s = (y * src.w + x) * 4;
      const a = src.data[s + 3] / 255;
      if (!a) continue;
      const px = dx + x;
      const py = dy + y;
      if (px < 0 || py < 0 || px >= dst.w || py >= dst.h) continue;
      const d = (py * dst.w + px) * 4;
      for (let c = 0; c < 3; c++) dst.data[d + c] = src.data[s + c] * a + dst.data[d + c] * (1 - a);
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
  Z: ['###', '..#', '.#.', '#..', '###'],
  '(': ['.#.', '#..', '#..', '#..', '.#.'],
  ')': ['.#.', '..#', '..#', '..#', '.#.'],
};
function text(img: Image, str: string, x0: number, y0: number, rgb: [number, number, number] = [198, 244, 50], k = 2): void {
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

// ---------- night ----------
const DARK = 0.55;
const GLOW_A = Math.min(1, (DARK - 0.15) * 2.2);
function veil(img: Image): void {
  for (let i = 0; i < img.w * img.h; i++) {
    const o = i * 4;
    if (!img.data[o + 3]) continue;
    img.data[o] = img.data[o] * (1 - DARK) + 16 * DARK;
    img.data[o + 1] = img.data[o + 1] * (1 - DARK) + 12 * DARK;
    img.data[o + 2] = img.data[o + 2] * (1 - DARK) + 52 * DARK;
  }
}
function addGlow(dst: Image, g: Image, dx: number, dy: number): void {
  for (let y = 0; y < g.h; y++)
    for (let x = 0; x < g.w; x++) {
      const s = (y * g.w + x) * 4;
      const a = (g.data[s + 3] / 255) * GLOW_A;
      if (!a) continue;
      const px = dx + x;
      const py = dy + y;
      if (px < 0 || py < 0 || px >= dst.w || py >= dst.h) continue;
      const d = (py * dst.w + px) * 4;
      for (let c = 0; c < 3; c++) dst.data[d + c] = Math.min(255, dst.data[d + c] + g.data[s + c] * a);
    }
}
function shade(dst: Image, sh: Image, dx: number, dy: number, k = 0.62): void {
  for (let y = 0; y < sh.h; y++)
    for (let x = 0; x < sh.w; x++) {
      if (!sh.data[(y * sh.w + x) * 4 + 3]) continue;
      const px = dx + x;
      const py = dy + y;
      if (px < 0 || py < 0 || px >= dst.w || py >= dst.h) continue;
      const d = (py * dst.w + px) * 4;
      for (let c = 0; c < 3; c++) dst.data[d + c] *= k;
    }
}

// ---------- a little map ----------
interface Item {
  tx: number;
  ty: number;
  w: number;
  h: number;
  frame: string;
}
function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
// Draws the map (W×H tiles) by day and at night, side by side: ground, surfaces, shadows, items back to front, glows.
function scene(W: number, H: number, surfaces: Map<string, string>, items: Item[], top = 60): Image {
  const ox = H * 16 + 8;
  const w = (W + H) * 16 + 16;
  const h = ((W + H) * 16) / 2 + top + 8;
  const draw = (night: boolean): Image => {
    const img = createImage(w, h);
    fill(img, [15, 13, 24]);
    const at = (tx: number, ty: number) => ({ X: ox + (tx - ty) * 16, Y: top + ((tx + ty) * 16) / 2 });
    for (let ty = 0; ty < H; ty++)
      for (let tx = 0; tx < W; tx++) {
        const k = Math.floor(hash(tx, ty) * 4);
        const surf = surfaces.get(`${tx},${ty}`);
        const t = need(surf ? `t/${surf}/${k}` : `t/ground/1/${k}`);
        const p = at(tx, ty);
        blit(img, t.img, p.X - t.ax, p.Y - t.ay);
      }
    for (const it of items) {
      const s = spr(it.frame.startsWith('b/') ? `${it.frame.split('/').slice(0, 2).join('/')}/shadow` : `${it.frame}/shadow`);
      if (!s) continue;
      const p = at(it.tx, it.ty);
      shade(img, s.img, p.X - s.ax, p.Y - s.ay);
    }
    const order = [...items].sort((a, b) => a.tx + a.w + a.ty + a.h - (b.tx + b.w + b.ty + b.h) || a.tx - b.tx);
    for (const it of order) {
      const s = need(it.frame);
      const p = at(it.tx, it.ty);
      over(img, s.img, p.X - s.ax, p.Y - s.ay);
    }
    if (!night) return img;
    veil(img);
    for (const it of order) {
      const g = spr(`${it.frame}/g`);
      if (!g) continue;
      const p = at(it.tx, it.ty);
      addGlow(img, g.img, p.X - g.ax, p.Y - g.ay);
    }
    return img;
  };
  const day = draw(false);
  const night = draw(true);
  const both = createImage(day.w * 2 + 8, day.h);
  fill(both, BG);
  blit(both, day, 0, 0);
  blit(both, night, day.w + 8, 0);
  return both;
}

// ---------- the yard: walls, pillars, fences, gates ----------
type Solid = 'fence' | 'wall' | 'gate' | 'pillar';
function yard(): Image {
  const W = 14;
  const H = 11;
  const solid = new Map<string, Solid>();
  const rot = new Map<string, number>();
  const set = (x: number, y: number, k: Solid, r = 0) => {
    solid.set(`${x},${y}`, k);
    rot.set(`${x},${y}`, r);
  };
  // outer ring: walls on two sides, fences on the others, pillars at the corners and where the kind changes
  for (let x = 1; x <= 10; x++) {
    set(x, 1, 'wall');
    set(x, 9, x < 6 ? 'wall' : 'fence');
  }
  for (let y = 1; y <= 9; y++) {
    set(1, y, 'wall');
    set(10, y, y < 5 ? 'fence' : 'wall');
  }
  for (const [x, y] of [
    [1, 1],
    [10, 1],
    [1, 9],
    [10, 9],
    [6, 9],
    [10, 5],
  ])
    set(x, y, 'pillar');
  set(3, 9, 'gate', 0); // a gate in the wall, front-left side
  set(8, 9, 'gate', 0); // a gate in the fence
  set(10, 3, 'gate', 1); // a gate on the front-right side
  // a partition: a wall with a T on the ring, a pillar in the middle, a fence beyond
  for (let y = 2; y <= 4; y++) set(5, y, 'wall');
  set(5, 5, 'pillar');
  for (let y = 6; y <= 8; y++) set(5, y, 'fence');
  // free-standing bits: an isolated wall each way, a 2-tile wall ending on a pillar, a lone pillar
  set(12, 2, 'wall', 0);
  set(12, 4, 'wall', 1);
  set(12, 6, 'wall');
  set(12, 7, 'wall');
  set(12, 8, 'pillar');
  set(12, 10, 'pillar');
  const surfaces = new Map<string, string>();
  for (let y = 2; y <= 8; y++) for (let x = 2; x <= 9; x++) if (x !== 5) surfaces.set(`${x},${y}`, x < 5 ? 'base' : 'floor');
  const kindAt = (x: number, y: number) => solid.get(`${x},${y}`);
  // a neighbour joins if it is a fence, a wall or a pillar, or a gate lined up with this side
  const joins = (x: number, y: number, side: 'ns' | 'ew') => {
    const k = kindAt(x, y);
    if (k === 'fence' || k === 'wall' || k === 'pillar') return true;
    if (k === 'gate') return side === 'ew' ? (rot.get(`${x},${y}`) ?? 0) === 0 : (rot.get(`${x},${y}`) ?? 0) === 1;
    return false;
  };
  const items: Item[] = [];
  for (const [key, kind] of solid) {
    const [x, y] = key.split(',').map(Number);
    const r = rot.get(key) ?? 0;
    const mask = (joins(x, y - 1, 'ns') ? 1 : 0) | (joins(x + 1, y, 'ew') ? 2 : 0) | (joins(x, y + 1, 'ns') ? 4 : 0) | (joins(x - 1, y, 'ew') ? 8 : 0);
    let frame: string;
    if (kind === 'gate') frame = `pc/gate/${r ? 'y' : 'x'}`;
    else if (kind === 'pillar') frame = `pc/pillar/${mask & ~0}`;
    else frame = mask ? `pc/${kind}/${mask}` : `pc/${kind}/${r ? 'y' : 'x'}`;
    items.push({ tx: x, ty: y, w: 1, h: 1, frame });
  }
  return scene(W, H, surfaces, items, 40);
}

// ---------- the plaza: every decoration ----------
function plaza(): Image {
  const W = 13;
  const H = 9;
  const surfaces = new Map<string, string>();
  for (let y = 1; y <= 7; y++) for (let x = 1; x <= 11; x++) if ((x + y) % 7 !== 0) surfaces.set(`${x},${y}`, 'base');
  const items: Item[] = [];
  const put = (x: number, y: number, frame: string) => items.push({ tx: x, ty: y, w: 1, h: 1, frame });
  // row by row, back to front
  for (let k = 0; k < 3; k++) put(1 + k * 2, 1, `pc/tree/${k}`);
  for (let d = 0; d < 4; d++) put(7 + d, 1, `pc/statue/${d}`);
  for (let d = 0; d < 4; d++) put(1 + d * 2, 3, `pc/bench/${d}`);
  put(9, 3, 'pc/fountain/2');
  put(11, 3, 'pc/fountain/0');
  for (let d = 0; d < 4; d++) put(1 + d, 5, `pc/cathouse/${d}`);
  for (let d = 0; d < 4; d++) put(6 + d, 5, `pc/sculpture/${d}`);
  put(11, 5, 'pc/planter/0');
  put(12, 5, 'pc/planter/1');
  for (let m = 0; m < 3; m++) for (let d = 0; d < 4; d++) put(1 + m * 4 + d, 7, `pc/sign/${m}/${d}`);
  put(0, 3, 'pc/pergola/x');
  put(12, 1, 'pc/pergola/y');
  return scene(W, H, surfaces, items, 50);
}

// ---------- buildings without and with their module ----------
// One small scene per module: the plain building and, beside it, the same building with the module, on a strip of
// concrete; work frame 1 (so moving parts show mid-motion).
function buildings(): Image[] {
  const pairs: [string, string, number, number][] = [
    ['recycler', 'recycler+recyclerMagnet', 2, 2],
    ['recycler', 'recycler+recyclerSorter', 2, 2],
    ['factory', 'factory+factoryArm', 3, 2],
    ['pods', 'pods+podsCapsule', 2, 2],
    ['solar', 'solar+solarTracker', 2, 2],
    ['purifier', 'purifier+purifierNozzle', 2, 2],
  ];
  return pairs.map(([plain, variant, w, h]) => {
    const surfaces = new Map<string, string>();
    for (let x = 0; x < 2 * w + 3; x++) surfaces.set(`${x},${h + 1}`, 'base');
    const items: Item[] = [
      { tx: 1, ty: 1, w, h, frame: `b/${plain}/w1` },
      { tx: w + 2, ty: 1, w, h, frame: `b/${variant}/w1` },
    ];
    return scene(2 * w + 3, h + 2, surfaces, items, 70);
  });
}

// Every new frame at 3×: by day on the left of each pair, at night on the right.
function frames(): Image[] {
  const isNew = (n: string) =>
    (/^pc\/(bench|planter|sign|pergola|cathouse|sculpture|tree|fountain|statue|wall|pillar|base)\//.test(n) || n.startsWith('t/base/') || /^mod\/(recyclerMagnet|recyclerSorter|factoryArm|podsCapsule|solarTracker|purifierNozzle)\//.test(n) || /^b\/[a-z]+\+(recyclerMagnet|recyclerSorter|factoryArm|podsCapsule|solarTracker|purifierNozzle)\//.test(n)) &&
    !n.endsWith('/g') &&
    !n.endsWith('/shadow');
  const names = Object.keys(meta.frames).filter(isNew);
  const groups = new Map<string, string[]>();
  for (const n of names) {
    const key = n.endsWith('/icon') ? 'icons' : n.split('/').slice(0, 2).join('/');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(n);
  }
  const rows: Image[] = [];
  const MAXW = 1900;
  for (const [label, list] of groups) {
    list.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
    const cells: Image[] = [];
    for (const n of list) {
      const s = need(n);
      const day = createImage(s.img.w + 4, s.img.h + 4);
      fill(day, [52, 46, 74]);
      over(day, s.img, 2, 2);
      const night = createImage(day.w, day.h);
      fill(night, [52, 46, 74]);
      over(night, s.img, 2, 2);
      veil(night);
      const g = spr(`${n}/g`);
      if (g) addGlow(night, g.img, 2 + s.ax - g.ax, 2 + s.ay - g.ay);
      const pair = createImage(day.w * 2 + 2, day.h);
      blit(pair, day, 0, 0);
      blit(pair, night, day.w + 2, 0);
      const big = upscale(pair, 3);
      const lab = n.replace(/^b\//, '');
      const cell = createImage(Math.max(big.w, lab.length * 8 + 4), big.h + 14);
      fill(cell, BG);
      text(cell, lab, 0, 0, [220, 220, 240]);
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
      text(r, label, 4, 2);
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
  return rows;
}

function titled(label: string, img: Image): Image {
  const o = createImage(Math.max(img.w, 400), img.h + 18);
  fill(o, BG);
  text(o, label, 4, 3);
  blit(o, img, 0, 18);
  return o;
}

const which = process.argv[3] ?? 'all';
const parts: Image[] = [];
if (which === 'all' || which === 'yard') {
  const y1 = yard();
  parts.push(titled('YARD: WALLS, PILLARS, FENCES, GATES, BASE 1X - DAY / NIGHT', y1), titled('YARD 3X - DAY / NIGHT', upscale(y1, 3)));
}
if (which === 'all' || which === 'plaza') {
  const p1 = plaza();
  parts.push(titled('PLAZA: EVERY DECORATION 1X - DAY / NIGHT', p1), titled('PLAZA 3X - DAY / NIGHT', upscale(p1, 3)));
}
if (which === 'all' || which === 'buildings') {
  const b1 = buildings();
  const grid = (list: Image[], k: number): Image => {
    const cols = 2;
    const cw = Math.max(...list.map((i) => i.w)) * k + 8;
    const ch = Math.max(...list.map((i) => i.h)) * k + 8;
    const g = createImage(cw * cols, ch * Math.ceil(list.length / cols));
    fill(g, BG);
    list.forEach((img, i) => blit(g, k > 1 ? upscale(img, k) : img, (i % cols) * cw, Math.floor(i / cols) * ch));
    return g;
  };
  parts.push(titled('EACH BUILDING WITHOUT AND WITH ITS MODULE 1X - DAY / NIGHT', grid(b1, 1)), titled('SAME 3X', grid(b1, 3)));
}
if (which === 'all' || which === 'frames') parts.push(...frames());
const W = Math.max(...parts.map((p) => p.w));
const H = parts.reduce((n, p) => n + p.h + 6, 0);
const sheet = createImage(W, H);
fill(sheet, BG);
let y = 0;
for (const p of parts) {
  blit(sheet, p, 0, y);
  y += p.h + 6;
}
writeFileSync(out, encodePNG(sheet));
console.log(`catalog sheet ${sheet.w}×${sheet.h} → ${out}`);
