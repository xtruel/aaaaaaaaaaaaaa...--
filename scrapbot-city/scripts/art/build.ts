// npm run art — renders every voxel model to isometric sprites and packs them into the game's atlas.
//
// Outputs:
//   src/assets/iso/atlas.png   one texture with every frame (imported by the game, inlined in the build)
//   src/assets/iso/atlas.json  frame rectangles + anchors, building metadata (frames, fps, height, points)
//   art/sprites/*.png          every frame as its own transparent PNG (for review and hand edits)
//   art/contact-sheet.png      all frames on one labelled sheet
// Hand edits: put a PNG with the same name and size in art/overrides/ and it replaces the generated frame.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILDINGS } from '../../src/game/defs';
import type { BuildingType } from '../../src/game/defs';
import { blit, createImage, decodePNG, encodePNG } from './png';
import type { Image } from './png';
import { FONT, Vox, render, renderShadow } from './voxel';
import type { Rendered } from './voxel';
import { M } from './palette';
import { ART } from './models/index';
import { BOT_FRAMES, DIRS, botModel, facing } from './models/bot';
import type { BotPose } from './models/bot';
import { edgeTiles, grassTiles, groundStyles, groundTiles, outerTiles, roadTiles, sludgeTiles } from './models/terrain';
import { junkModel, rubbleModel } from './models/props';
import { CAT_FRAMES, CITIZEN_FRAMES, CITIZEN_VARIANTS, catModel, citizenModel } from './models/characters';
import type { CatPose } from './models/characters';
import { DECOR } from './models/decor';
import { BLIMP_FRAMES, blimpModel } from './models/blimp';

// npm runs scripts from the package root; fall back to walking up from this file
function projectRoot(): string {
  const isRoot = (dir: string) => existsSync(join(dir, 'package.json')) && existsSync(join(dir, 'src/game/defs.ts'));
  if (isRoot(process.cwd())) return process.cwd();
  let dir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  for (let k = 0; k < 5; k++) {
    if (isRoot(dir)) return dir;
    dir = resolve(dir, '..');
  }
  return process.cwd();
}
const PROJECT = projectRoot();


interface Frame {
  name: string;
  img: Image;
  ax: number;
  ay: number;
}

// A building under construction: the model cut at a height, with scaffolding poles and a hazard rail.
function construction(full: Vox, stage: number): Vox {
  const top = full.top();
  const cut = Math.round(3 + (top - 3) * (stage / 4));
  const v = new Vox(full.w, full.d, full.h);
  v.stamp(full, 0, 0, 0);
  v.clear(0, 0, Math.max(3, cut), v.w, v.d, v.h);
  const z1 = Math.min(v.h, Math.max(cut, 3) + 6);
  const poles: [number, number][] = [
    [3, 3],
    [v.w - 4, 3],
    [3, v.d - 4],
    [v.w - 4, v.d - 4],
  ];
  for (const [x, y] of poles) v.box(x, y, 3, x + 1, y + 1, z1, M.steelL);
  for (const z of [z1 - 1, Math.max(4, Math.floor((3 + z1) / 2))]) {
    v.box(3, v.d - 4, z, v.w - 3, v.d - 3, z + 1, M.hazardY);
    v.box(v.w - 4, 3, z, v.w - 3, v.d - 3, z + 1, M.hazardY);
    for (let x = 3; x < v.w - 3; x += 4) v.set(x, v.d - 4, z, M.hazardK);
    for (let y = 3; y < v.d - 3; y += 4) v.set(v.w - 4, y, z, M.hazardK);
  }
  // a pallet of parts waiting on the plate
  if (stage < 2) {
    v.box(v.w - 9, v.d - 9, 3, v.w - 5, v.d - 5, 5, M.rust);
    v.box(v.w - 8, v.d - 8, 5, v.w - 6, v.d - 6, 6, M.steelL);
  }
  return v;
}

const frames: Frame[] = [];
function add(name: string, img: Image, ax: number, ay: number): void {
  frames.push({ name, img, ax, ay });
}
function addRendered(name: string, r: Rendered, ax = r.ax, ay = r.ay): void {
  add(name, r.img, ax, ay);
  if (r.hasGlow) add(`${name}/g`, r.glow, ax, ay);
}

interface BuildingMeta {
  frames: number;
  fps: number;
  height: number;
  glow: boolean[]; // per work frame, then off
  points: Record<string, [number, number][]>; // offsets from the anchor, in pixels
}
const buildings: Partial<Record<BuildingType, BuildingMeta>> = {};

// ---------- buildings ----------
for (const type of Object.keys(BUILDINGS) as BuildingType[]) {
  const art = ART[type];
  const def = BUILDINGS[type];
  const glow: boolean[] = [];
  let height = 0;
  for (let f = 0; f < art.frames; f++) {
    const v = art.model(f, true);
    if (v.w !== def.w * 16 || v.d !== def.h * 16) throw new Error(`${type}: model footprint ${v.w}×${v.d} does not match ${def.w * 16}×${def.h * 16}`);
    const r = render(v);
    addRendered(`b/${type}/w${f}`, r);
    glow.push(r.hasGlow);
    height = Math.max(height, r.height);
  }
  const offModel = art.model(0, false);
  const off = render(offModel);
  addRendered(`b/${type}/off`, off);
  glow.push(off.hasGlow);
  for (let stage = 0; stage < 4; stage++) addRendered(`b/${type}/c${stage}`, render(construction(offModel, stage)));
  const icon = render(art.model(0, true), { scale: 2 });
  add(`b/${type}/icon`, icon.img, icon.ax, icon.ay);
  const sh = renderShadow(offModel);
  add(`b/${type}/shadow`, sh.img, sh.ax, sh.ay);
  const points: Record<string, [number, number][]> = {};
  for (const [k, list] of Object.entries(off.points)) points[k] = list.map(([px, py]) => [px - off.ax, py - off.ay]);
  buildings[type] = { frames: art.frames, fps: art.fps, height, glow, points };
}

// ---------- bots ----------
const POSES: BotPose[] = ['fly', 'carry', 'work'];
for (const dir of DIRS)
  for (const pose of POSES)
    for (let f = 0; f < BOT_FRAMES; f++) {
      const r = render(facing(botModel(pose, f), dir));
      // anchor on the bot's ground centre (5, 5, 0)
      addRendered(`bot/${dir}/${pose}/${f}`, r, r.ax, r.ay + 5);
    }

// ---------- citizens, cat, blimp ----------
for (let v = 0; v < CITIZEN_VARIANTS; v++)
  for (const dir of DIRS)
    for (let f = 0; f < CITIZEN_FRAMES; f++) {
      const m = facing(citizenModel(v, f), dir);
      const r = render(m);
      // anchor on the ground centre of the model
      addRendered(`cit/${v}/${dir}/${f}`, r, r.ax + Math.round(m.w / 2 - m.d / 2), r.ay + Math.round((m.w + m.d) / 4));
    }
const CAT_POSES: CatPose[] = ['sit', 'walk'];
for (const dir of DIRS)
  for (const pose of CAT_POSES)
    for (let f = 0; f < CAT_FRAMES; f++) {
      const m = facing(catModel(pose, f), dir);
      const r = render(m);
      addRendered(`cat/${dir}/${pose}/${f}`, r, r.ax + Math.round(m.w / 2 - m.d / 2), r.ay + Math.round((m.w + m.d) / 4));
    }
for (let f = 0; f < BLIMP_FRAMES; f++) {
  const m = blimpModel(f);
  const r = render(m);
  addRendered(`blimp/${f}`, r, r.ax + Math.round(m.w / 2 - m.d / 2), r.ay + Math.round((m.w + m.d) / 4));
}

// ---------- scenery around the map ----------
const decor: Record<string, { w: number; d: number; frames: number; fps: number; tall: boolean }> = {};
for (const d of DECOR) {
  for (let f = 0; f < d.frames; f++) {
    const m = d.model(f);
    if (m.w !== d.w * 16 || m.d !== d.d * 16) throw new Error(`decor ${d.name}: model ${m.w}×${m.d} does not match ${d.w * 16}×${d.d * 16}`);
    addRendered(`d/${d.name}/${f}`, render(m));
  }
  decor[d.name] = { w: d.w, d: d.d, frames: d.frames, fps: d.fps, tall: d.tall };
}

// ---------- terrain ----------
const tiles = { ...groundTiles(), ...groundStyles(), ...grassTiles(), ...roadTiles(), ...sludgeTiles(), ...outerTiles() };
for (const [name, img] of Object.entries(tiles)) add(name, img, 16, 0);
for (const [name, img] of Object.entries(edgeTiles())) add(name, img, name.startsWith('t/edge/l') ? 16 : 0, -8);
for (let size = 0; size < 3; size++)
  for (let k = 0; k < 4; k++) {
    const r = render(junkModel(size, k));
    addRendered(`p/junk/${size}/${k}`, r);
  }
for (let k = 0; k < 4; k++) addRendered(`p/rubble/${k}`, render(rubbleModel(k)));

// ---------- hand-made overrides ----------
const safe = (name: string) => name.replace(/\//g, '_');
const overrideDir = join(PROJECT, 'art/overrides');
let overridden = 0;
if (existsSync(overrideDir)) {
  for (const f of frames) {
    const p = join(overrideDir, `${safe(f.name)}.png`);
    if (!existsSync(p)) continue;
    const img = decodePNG(new Uint8Array(readFileSync(p)));
    if (img.w !== f.img.w || img.h !== f.img.h) {
      console.warn(`override ${p}: size ${img.w}×${img.h} does not match ${f.img.w}×${f.img.h}, ignored`);
      continue;
    }
    f.img = img;
    overridden++;
  }
}

// ---------- pack ----------
const ATLAS_W = 1024;
const order = [...frames].sort((a, b) => b.img.h - a.img.h || b.img.w - a.img.w);
const placed = new Map<string, [number, number]>();
let x = 0;
let y = 0;
let shelf = 0;
for (const f of order) {
  if (x + f.img.w + 1 > ATLAS_W) {
    x = 0;
    y += shelf + 1;
    shelf = 0;
  }
  placed.set(f.name, [x, y]);
  x += f.img.w + 1;
  shelf = Math.max(shelf, f.img.h);
}
const atlasH = y + shelf;
const atlas = createImage(ATLAS_W, atlasH);
const frameMeta: Record<string, [number, number, number, number, number, number]> = {};
for (const f of frames) {
  const [fx, fy] = placed.get(f.name)!;
  blit(atlas, f.img, fx, fy);
  frameMeta[f.name] = [fx, fy, f.img.w, f.img.h, f.ax, f.ay];
}

const outDir = join(PROJECT, 'src/assets/iso');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'atlas.png'), encodePNG(atlas));
writeFileSync(join(outDir, 'atlas.json'), JSON.stringify({ w: ATLAS_W, h: atlasH, frames: frameMeta, buildings, decor }) + '\n');

// ---------- individual sprites + contact sheet ----------
const spriteDir = join(PROJECT, 'art/sprites');
if (existsSync(spriteDir)) for (const f of readdirSync(spriteDir)) if (f.endsWith('.png')) rmSync(join(spriteDir, f));
mkdirSync(spriteDir, { recursive: true });
for (const f of frames) writeFileSync(join(spriteDir, `${safe(f.name)}.png`), encodePNG(f.img));

function text(img: Image, str: string, x0: number, y0: number, rgb: [number, number, number]): void {
  let cx = x0;
  for (const ch of str.toUpperCase()) {
    const g = FONT[ch];
    if (g)
      for (let r = 0; r < 5; r++)
        for (let c = 0; c < 3; c++) {
          if (g[r][c] !== '#') continue;
          const px = cx + c;
          const py = y0 + r;
          if (px < 0 || py < 0 || px >= img.w || py >= img.h) continue;
          const o = (py * img.w + px) * 4;
          img.data[o] = rgb[0];
          img.data[o + 1] = rgb[1];
          img.data[o + 2] = rgb[2];
          img.data[o + 3] = 255;
        }
    cx += 4;
  }
}

// group frames by their first two name parts, one row per group
const groups = new Map<string, Frame[]>();
for (const f of frames) {
  if (f.name.endsWith('/g') || f.name.endsWith('/shadow')) continue;
  const key = f.name.split('/').slice(0, 2).join('/');
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key)!.push(f);
}
const SHEET_W = 1400;
const rows: { label: string; items: Frame[]; h: number }[] = [];
for (const [label, items] of groups) {
  let rowW = 0;
  let cur: Frame[] = [];
  let h = 0;
  for (const f of items) {
    if (rowW + f.img.w + 6 > SHEET_W - 80 && cur.length) {
      rows.push({ label, items: cur, h });
      cur = [];
      rowW = 0;
      h = 0;
    }
    cur.push(f);
    rowW += f.img.w + 6;
    h = Math.max(h, f.img.h);
  }
  if (cur.length) rows.push({ label, items: cur, h });
}
const sheetH = rows.reduce((n, r) => n + r.h + 10, 10);
const sheet = createImage(SHEET_W, sheetH);
for (let i = 0; i < SHEET_W * sheetH; i++) {
  sheet.data[i * 4] = 22;
  sheet.data[i * 4 + 1] = 20;
  sheet.data[i * 4 + 2] = 42;
  sheet.data[i * 4 + 3] = 255;
}
let sy = 6;
for (const row of rows) {
  text(sheet, row.label.replace('/', ' '), 4, sy, [198, 244, 50]);
  let sx = 80;
  for (const f of row.items) {
    blit(sheet, f.img, sx, sy + row.h - f.img.h);
    sx += f.img.w + 6;
  }
  sy += row.h + 10;
}
const scaled = createImage(SHEET_W * 2, sheetH * 2);
for (let py = 0; py < scaled.h; py++)
  for (let px = 0; px < scaled.w; px++) {
    const s = ((py >> 1) * SHEET_W + (px >> 1)) * 4;
    const d = (py * scaled.w + px) * 4;
    scaled.data[d] = sheet.data[s];
    scaled.data[d + 1] = sheet.data[s + 1];
    scaled.data[d + 2] = sheet.data[s + 2];
    scaled.data[d + 3] = 255;
  }
mkdirSync(join(PROJECT, 'art'), { recursive: true });
writeFileSync(join(PROJECT, 'art/contact-sheet.png'), encodePNG(scaled));

console.log(`art: ${frames.length} frames, atlas ${ATLAS_W}×${atlasH}${overridden ? `, ${overridden} hand-made overrides` : ''}`);
