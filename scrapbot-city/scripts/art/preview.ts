// Quick look at one model without touching the game's atlas.
//   npx esbuild scripts/art/preview.ts --bundle --platform=node --format=esm --outfile=<tmp>/preview.mjs --log-level=warning
//   node <tmp>/preview.mjs <building type[+module] | citizens | cat | decor | blimp | bots | scenery:<theme>> <out.png> [scale]
// For a building: every work frame, the "off" frame, 4 construction stages and the toolbar icon, then the
// building on a patch of ground next to the HQ (for scale) by day and with the night glow.
import { writeFileSync } from 'node:fs';
import { BUILDINGS } from '../../src/game/defs';
import type { BuildingType } from '../../src/game/defs';
import { blit, createImage, encodePNG } from './png';
import type { Image } from './png';
import { render, renderShadow } from './voxel';
import { ART } from './models/index';
import { withMist } from './models/catalog-modules';
import { DIRS, botModel, facing } from './models/bot';
import { CAT_FRAMES, CITIZEN_FRAMES, CITIZEN_VARIANTS, catModel, citizenModel } from './models/characters';
import { DECOR } from './models/decor';
import { BLIMP_FRAMES, blimpModel } from './models/blimp';
import { groundTiles } from './models/terrain';
import { THEME_SCENERY } from './models/city-scenery';
import type { Theme } from './models/city-terrain';

const [what, out, scaleArg] = process.argv.slice(2);
if (!what || !out) throw new Error('usage: preview <type|citizens|cat|decor|blimp|bots|scenery:<theme>> <out.png> [scale]');
const SCALE = Number(scaleArg ?? 3);
const BG: [number, number, number] = [46, 40, 65];

function fill(img: Image, rgb: [number, number, number]): void {
  for (let i = 0; i < img.w * img.h; i++) {
    img.data[i * 4] = rgb[0];
    img.data[i * 4 + 1] = rgb[1];
    img.data[i * 4 + 2] = rgb[2];
    img.data[i * 4 + 3] = 255;
  }
}

function row(images: Image[], gap = 8): Image {
  const w = images.reduce((n, i) => n + i.w + gap, gap);
  const h = Math.max(...images.map((i) => i.h)) + gap * 2;
  const img = createImage(w, h);
  fill(img, BG);
  let x = gap;
  for (const i of images) {
    blit(img, i, x, h - gap - i.h);
    x += i.w + gap;
  }
  return img;
}

function stack(images: Image[]): Image {
  const w = Math.max(...images.map((i) => i.w));
  const h = images.reduce((n, i) => n + i.h, 0);
  const img = createImage(w, h);
  fill(img, BG);
  let y = 0;
  for (const i of images) {
    blit(img, i, 0, y);
    y += i.h;
  }
  return img;
}

function upscale(img: Image, k: number): Image {
  const o = createImage(img.w * k, img.h * k);
  for (let y = 0; y < o.h; y++)
    for (let x = 0; x < o.w; x++) {
      const s = (Math.floor(y / k) * img.w + Math.floor(x / k)) * 4;
      const d = (y * o.w + x) * 4;
      o.data[d] = img.data[s];
      o.data[d + 1] = img.data[s + 1];
      o.data[d + 2] = img.data[s + 2];
      o.data[d + 3] = img.data[s + 3];
    }
  return o;
}

function darkenNight(img: Image, glow: Image | null, gx: number, gy: number): Image {
  const o = createImage(img.w, img.h);
  for (let i = 0; i < img.w * img.h; i++) {
    o.data[i * 4] = img.data[i * 4] * 0.45 + 16 * 0.55;
    o.data[i * 4 + 1] = img.data[i * 4 + 1] * 0.45 + 12 * 0.55;
    o.data[i * 4 + 2] = img.data[i * 4 + 2] * 0.45 + 52 * 0.55;
    o.data[i * 4 + 3] = 255;
  }
  if (glow)
    for (let y = 0; y < glow.h; y++)
      for (let x = 0; x < glow.w; x++) {
        const s = (y * glow.w + x) * 4;
        const a = glow.data[s + 3] / 255;
        if (!a) continue;
        const px = gx + x;
        const py = gy + y;
        if (px < 0 || py < 0 || px >= o.w || py >= o.h) continue;
        const d = (py * o.w + px) * 4;
        for (let c = 0; c < 3; c++) o.data[d + c] = Math.min(255, o.data[d + c] + glow.data[s + c] * a);
      }
  return o;
}

// A patch of ground with the HQ and the building side by side, drawn in the right order.
function scene(type: BuildingType, frame: number, night: boolean, modules: string[] = []): Image {
  const tiles = groundTiles();
  const tileImg = (k: number) => tiles[`t/ground/1/${k % 4}`];
  const W = 9;
  const H = 6;
  const ox = H * 16 + 8;
  const oy = 70;
  const img = createImage((W + H) * 16 + 16, ((W + H) * 16) / 2 + oy + 10);
  fill(img, [15, 13, 24]);
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) blit(img, tileImg(tx * 7 + ty), ox + (tx - ty) * 16 - 16, oy + ((tx + ty) * 16) / 2);
  const place = (t: BuildingType, tx: number, ty: number, f: number, mods: string[] = []) => {
    const m = ART[t].model(f, true, mods);
    const sh = renderShadow(m);
    const r = render(m);
    const X = ox + (tx - ty) * 16;
    const Y = oy + ((tx + ty) * 16) / 2;
    // shadow at 35%
    for (let y = 0; y < sh.img.h; y++)
      for (let x = 0; x < sh.img.w; x++) {
        if (!sh.img.data[(y * sh.img.w + x) * 4 + 3]) continue;
        const px = X - sh.ax + x;
        const py = Y - sh.ay + y;
        if (px < 0 || py < 0 || px >= img.w || py >= img.h) continue;
        const d = (py * img.w + px) * 4;
        for (let c = 0; c < 3; c++) img.data[d + c] *= 0.66;
      }
    return { r, X, Y };
  };
  const hq = place('hq', 1, 1, 0);
  const def = BUILDINGS[type];
  const b = place(type, 5, 1, frame, modules);
  void def;
  // the HQ (x 1..3) is behind the building (x 5..) on the x axis: draw it first
  blit(img, hq.r.img, hq.X - hq.r.ax, hq.Y - hq.r.ay);
  blit(img, b.r.img, b.X - b.r.ax, b.Y - b.r.ay);
  if (!night) return img;
  const merged = createImage(img.w, img.h);
  merged.data.set(img.data);
  let n = darkenNight(merged, hq.r.hasGlow ? hq.r.glow : null, hq.X - hq.r.ax, hq.Y - hq.r.ay);
  if (b.r.hasGlow) {
    const tmp = n;
    n = createImage(tmp.w, tmp.h);
    n.data.set(tmp.data);
    for (let y = 0; y < b.r.glow.h; y++)
      for (let x = 0; x < b.r.glow.w; x++) {
        const s = (y * b.r.glow.w + x) * 4;
        const a = b.r.glow.data[s + 3] / 255;
        if (!a) continue;
        const px = b.X - b.r.ax + x;
        const py = b.Y - b.r.ay + y;
        if (px < 0 || py < 0 || px >= n.w || py >= n.h) continue;
        const d = (py * n.w + px) * 4;
        for (let c = 0; c < 3; c++) n.data[d + c] = Math.min(255, n.data[d + c] + b.r.glow.data[s + c] * a);
      }
  }
  return n;
}

let sheet: Image;
const [baseType, ...mods] = what.split('+');
if (baseType in BUILDINGS) {
  // <type> or <type>+<module>[+<module>]: the building with those modules installed
  const type = baseType as BuildingType;
  const art = ART[type];
  const frames: Image[] = [];
  for (let f = 0; f < art.frames; f++) frames.push((mods.includes('purifierNozzle') ? withMist(render(art.model(f, true, mods)), f) : render(art.model(f, true, mods))).img);
  frames.push(render(art.model(0, false, mods)).img);
  const icon = render(art.model(0, true, mods), { scale: 2 }).img;
  sheet = stack([upscale(row([...frames, icon]), SCALE), upscale(row([scene(type, 0, false, mods), scene(type, 0, true, mods)]), 2)]);
} else if (what === 'citizens') {
  const imgs: Image[] = [];
  for (let v = 0; v < CITIZEN_VARIANTS; v++) for (const d of DIRS) for (let f = 0; f < CITIZEN_FRAMES; f++) imgs.push(render(facing(citizenModel(v, f), d)).img);
  sheet = upscale(row(imgs, 4), SCALE + 1);
} else if (what === 'cat') {
  const imgs: Image[] = [];
  for (const d of DIRS) for (const p of ['sit', 'walk'] as const) for (let f = 0; f < CAT_FRAMES; f++) imgs.push(render(facing(catModel(p, f), d)).img);
  imgs.push(render(facing(botModel('fly', 0), 'sw')).img); // a bot for scale
  sheet = upscale(row(imgs, 4), SCALE + 1);
} else if (what === 'bots') {
  const imgs: Image[] = [];
  for (const d of DIRS) for (const p of ['fly', 'carry', 'work'] as const) imgs.push(render(facing(botModel(p, 0), d)).img);
  sheet = upscale(row(imgs, 4), SCALE + 1);
} else if (what === 'decor') {
  const rows: Image[] = [];
  let cur: Image[] = [];
  for (const d of DECOR) {
    for (let f = 0; f < d.frames; f++) cur.push(render(d.model(f)).img);
    if (cur.length >= 8) {
      rows.push(row(cur));
      cur = [];
    }
  }
  if (cur.length) rows.push(row(cur));
  sheet = upscale(stack(rows.length ? rows : [row([createImage(8, 8)])]), SCALE);
} else if (what.startsWith('scenery:')) {
  // scenery:<rust|neon|green|corp>: a city theme's border scenery, every frame by day and at night
  const list = THEME_SCENERY[what.slice(8) as Theme];
  if (!list) throw new Error(`unknown theme in ${what}`);
  const imgs: Image[] = [];
  for (const d of list)
    for (let f = 0; f < d.frames; f++) {
      const r = render(d.model(f));
      const day = createImage(r.img.w, r.img.h);
      fill(day, BG);
      blit(day, r.img, 0, 0);
      imgs.push(day, darkenNight(day, r.hasGlow ? r.glow : null, 0, 0));
    }
  sheet = upscale(row(imgs), SCALE);
} else if (what === 'blimp') {
  const imgs: Image[] = [];
  for (let f = 0; f < BLIMP_FRAMES; f++) imgs.push(render(blimpModel(f)).img);
  sheet = upscale(row(imgs), SCALE);
} else throw new Error(`unknown preview target ${what}`);

writeFileSync(out, encodePNG(sheet));
console.log(`preview ${what}: ${sheet.w}×${sheet.h} → ${out}`);
