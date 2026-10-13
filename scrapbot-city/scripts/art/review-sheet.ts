// Review sheet for the 0.7 increment-1 art, read back from the generated atlas (what the game will load):
//   npx esbuild scripts/art/review-sheet.ts --bundle --platform=node --format=esm --outfile=<tmp>/sheet.mjs --log-level=warning
//   node <tmp>/sheet.mjs <out.png>
// 1. a fenced yard (corners, a T, a cross, run ends, a gate, lamps in the 4 directions, industrial floor) by day and
//    at night, at 1× and 3×;
// 2. the Bot Dock and the Smelter without and with their module, by day and at night, at 1× and 3×;
// 3. every new frame at 3×, by day and at night.
// Night is drawn like the game at midnight: a dark blue veil (alpha 0.55), glow frames added on top at 0.88.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { blit, createImage, decodePNG, encodePNG } from './png';
import type { Image } from './png';
import { FONT } from './voxel';

const out = process.argv[2];
if (!out) throw new Error('usage: review-sheet <out.png>');
const root = process.cwd();
const meta = JSON.parse(readFileSync(join(root, 'src/assets/iso/atlas.json'), 'utf8')) as {
  frames: Record<string, [number, number, number, number, number, number]>;
  buildings: Record<string, { frames: number }>;
  variants: Record<string, { frames: number; points: Record<string, [number, number][]> }>;
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
// the voxel font lacks some digits and signs the labels need
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
// Draws the map (W×H tiles) by day and at night, side by side: ground, floors, shadows, items back to front, glows.
function scene(W: number, H: number, floors: Set<string>, items: Item[], top = 60): Image {
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
        const t = need(floors.has(`${tx},${ty}`) ? `t/floor/${k}` : `t/ground/1/${k}`);
        const p = at(tx, ty);
        blit(img, t.img, p.X - t.ax, p.Y - t.ay);
      }
    for (const it of items) {
      // buildings: b/<type or variant>/shadow; pieces: <frame>/shadow
      const s = spr(it.frame.startsWith('b/') ? `${it.frame.split('/').slice(0, 2).join('/')}/shadow` : `${it.frame}/shadow`);
      if (!s) continue;
      const p = at(it.tx, it.ty);
      shade(img, s.img, p.X - s.ax, p.Y - s.ay);
    }
    const order = [...items].sort((a, b) => a.tx + a.w + a.ty + a.h - (b.tx + b.w + b.ty + b.h) || a.tx - b.tx);
    for (const it of order) {
      const s = need(it.frame);
      const p = at(it.tx, it.ty);
      blit(img, s.img, p.X - s.ax, p.Y - s.ay);
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

// The yard: a fence ring with a gate on its front-left side, a partition with a T and a cross, a free-standing
// run, the floor inside, a lamp facing each way.
function yard(): Image {
  const W = 12;
  const H = 9;
  const solid = new Map<string, 'fence' | 'gate' | 'lamp'>();
  const rot = new Map<string, number>();
  const set = (x: number, y: number, k: 'fence' | 'gate' | 'lamp', r = 0) => {
    solid.set(`${x},${y}`, k);
    rot.set(`${x},${y}`, r);
  };
  for (let x = 1; x <= 8; x++) {
    set(x, 1, 'fence');
    set(x, 7, 'fence');
  }
  for (let y = 1; y <= 7; y++) {
    set(1, y, 'fence');
    set(8, y, 'fence');
  }
  for (let y = 1; y <= 7; y++) set(5, y, 'fence'); // partition: T at both ends
  for (let x = 5; x <= 8; x++) set(x, 4, 'fence'); // a cross in the middle of the partition
  set(3, 7, 'gate', 0); // gate in the front-left side
  set(8, 2, 'gate', 1); // gate in the front-right side
  set(10, 2, 'fence', 0); // isolated along x
  set(10, 4, 'fence', 1); // isolated along y
  set(10, 6, 'fence');
  set(11, 6, 'fence'); // a 2-tile run
  set(3, 3, 'lamp', 0);
  set(3, 5, 'lamp', 1);
  set(7, 3, 'lamp', 2);
  set(7, 6, 'lamp', 3);
  const floors = new Set<string>();
  for (let y = 2; y <= 6; y++) for (let x = 2; x <= 7; x++) if (x !== 5) floors.add(`${x},${y}`);
  const isJoin = (x: number, y: number) => {
    const k = solid.get(`${x},${y}`);
    return k === 'fence' || k === 'gate';
  };
  const items: Item[] = [];
  for (const [key, kind] of solid) {
    const [x, y] = key.split(',').map(Number);
    const r = rot.get(key) ?? 0;
    let frame: string;
    if (kind === 'lamp') frame = `pc/lamp/${r}`;
    else if (kind === 'gate') frame = `pc/gate/${r ? 'y' : 'x'}`;
    else {
      const mask = (isJoin(x, y - 1) ? 1 : 0) | (isJoin(x + 1, y) ? 2 : 0) | (isJoin(x, y + 1) ? 4 : 0) | (isJoin(x - 1, y) ? 8 : 0);
      frame = mask ? `pc/fence/${mask}` : `pc/fence/${r ? 'y' : 'x'}`;
    }
    items.push({ tx: x, ty: y, w: 1, h: 1, frame });
  }
  return scene(W, H, floors, items, 40);
}

function buildings(): Image {
  // along the screen's horizontal (x up, y down), so that none hides another
  const W = 12;
  const H = 12;
  const floors = new Set<string>();
  const items: Item[] = [
    { tx: 0, ty: 9, w: 2, h: 2, frame: 'b/dock/w0' },
    { tx: 3, ty: 6, w: 2, h: 2, frame: 'b/dock+dockStorage/w0' },
    { tx: 6, ty: 3, w: 2, h: 2, frame: 'b/smelter/w0' },
    { tx: 9, ty: 0, w: 2, h: 2, frame: 'b/smelter+smelterFilter/w0' },
  ];
  for (const it of items) for (let k = -1; k <= 2; k++) floors.add(`${it.tx + k},${it.ty + 2}`);
  return scene(W, H, floors, items, 70);
}

// Every new frame at 3×: by day on the left of each pair, at night on the right.
function frames(): Image[] {
  const names = Object.keys(meta.frames).filter((n) => (n.startsWith('pc/') || n.startsWith('mod/') || n.startsWith('t/floor') || n.includes('+')) && !n.endsWith('/g') && !n.endsWith('/shadow'));
  const groups = new Map<string, string[]>();
  for (const n of names) {
    const key = n.startsWith('b/') ? n.split('/').slice(0, 2).join('/') : n.endsWith('/icon') ? 'icons' : n.split('/').slice(0, 2).join('/');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(n);
  }
  const rows: Image[] = [];
  const MAXW = 1500;
  for (const [label, list] of groups) {
    list.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
    const cells: Image[] = [];
    for (const n of list) {
      const s = need(n);
      const day = createImage(s.img.w + 4, s.img.h + 4);
      fill(day, [52, 46, 74]);
      blit(day, s.img, 2, 2);
      const night = createImage(day.w, day.h);
      fill(night, [52, 46, 74]);
      blit(night, s.img, 2, 2);
      veil(night);
      const g = spr(`${n}/g`);
      if (g) addGlow(night, g.img, 2 + s.ax - g.ax, 2 + s.ay - g.ay);
      const pair = createImage(day.w * 2 + 2, day.h);
      blit(pair, day, 0, 0);
      blit(pair, night, day.w + 2, 0);
      const big = upscale(pair, 3);
      const cell = createImage(Math.max(big.w, n.length * 8 + 4), big.h + 14);
      fill(cell, BG);
      text(cell, n.replace(/^b\//, ''), 0, 0, [220, 220, 240]);
      blit(cell, big, 0, 14);
      cells.push(cell);
    }
    // wrap into rows
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

const y1 = yard();
const b1 = buildings();
const parts: Image[] = [
  titled('YARD 1X - DAY / NIGHT', y1),
  titled('YARD 3X - DAY / NIGHT', upscale(y1, 3)),
  titled('DOCK, DOCK+STORAGE, SMELTER, SMELTER+FILTER 1X - DAY / NIGHT', b1),
  titled('SAME 3X', upscale(b1, 3)),
  ...frames(),
];
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
console.log(`review sheet ${sheet.w}×${sheet.h} → ${out}`);
