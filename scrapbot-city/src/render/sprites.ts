// Procedural pixel art. Everything is drawn once into small canvases and cached.
import { BUILDINGS, TILE, T } from '../game/defs';
import type { BuildingType } from '../game/defs';
import { hash2 } from '../game/world';
import { drawPixelText } from './pixelfont';

export const PAL = {
  ink: '#0d0b16',
  night: '#16142a',
  navy: '#1f2344',
  steel: '#3b4063',
  steelL: '#5c638a',
  steelLL: '#8d95bb',
  concrete: '#6b6779',
  concreteL: '#9893a8',
  white: '#ece8f6',
  lime: '#c6f432',
  limeD: '#7da516',
  pink: '#ff3d8b',
  pinkD: '#b11a5e',
  purple: '#7c55ff',
  purpleD: '#47309a',
  sky: '#55aefc',
  cyan: '#42e2d2',
  cyanD: '#1d8f8c',
  rust: '#c9672d',
  rustD: '#7b3719',
  orange: '#ff9b2f',
  yellow: '#ffd440',
  red: '#e2364b',
  green: '#3faf4b',
  greenD: '#226a31',
  greenL: '#7fda5b',
  ground: '#2d2840',
  groundL: '#383150',
  groundD: '#221d33',
  grass: '#2b5733',
  sludge: '#86e83c',
  sludgeD: '#2c1a3c',
};

export interface Light {
  x: number;
  y: number;
  color: string;
  blink?: boolean;
}

export interface Sprite {
  canvas: HTMLCanvasElement;
  ox: number; // draw offset from the footprint's top-left corner, in px
  oy: number;
  lights: Light[];
  smoke: { x: number; y: number }[];
}

type Ctx = CanvasRenderingContext2D;

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

function px(ctx: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

// A box seen from the front/top: footprint top-left (x, y), width w, ground depth d, height h.
function box(ctx: Ctx, x: number, y: number, w: number, d: number, h: number, roof: string, wall: string, edge = PAL.ink): void {
  px(ctx, x - 1, y - h - 1, w + 2, d + 2, edge);
  px(ctx, x, y - h, w, d - h > 0 ? d - h : 1, roof);
  px(ctx, x, y + d - h, w, h, wall);
  px(ctx, x, y + d - h, w, 1, shade(roof, 0.2));
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + (amt > 0 ? (255 - c) * amt : c * amt))));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function shadow(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = 'rgba(5,4,12,0.45)';
  ctx.fillRect(x + 2, y + 2, w, h);
}

function recycleMark(ctx: Ctx, x: number, y: number, color: string, dark: string): void {
  // 9x8 pixel recycle triangle of arrows
  const rows = ['....X....', '...X.X...', '..XX.XX..', '.X.....X.', 'XX.....XX', '.........', 'XXX.X.XXX', '.XX...XX.'];
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) if (row[i] === 'X') px(ctx, x + i, y + j, 1, 1, color);
  });
  px(ctx, x + 4, y + 3, 1, 1, dark);
}

function windowsGrid(ctx: Ctx, lights: Light[], x: number, y: number, cols: number, rows: number, gx: number, gy: number, lit: string, unlit: string, seed: number): void {
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const on = hash2(i, j, seed) > 0.35;
      px(ctx, x + i * gx, y + j * gy, 2, 2, on ? lit : unlit);
      if (on) lights.push({ x: x + i * gx, y: y + j * gy, color: lit });
    }
  }
}

function concretePad(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  px(ctx, x, y, w, h, '#3a3646');
  px(ctx, x, y, w, 1, '#4a4558');
  for (let i = 0; i < w; i += 4) px(ctx, x + i, y + h - 2, 2, 2, i % 8 === 0 ? PAL.yellow : PAL.ink);
}

const builders: Record<BuildingType, (ctx: Ctx, W: number, H: number, E: number, out: Sprite) => void> = {
  hq(ctx, W, H, E, out) {
    const y0 = E;
    concretePad(ctx, 0, y0 + 4, W, H - 4);
    shadow(ctx, 5, y0 + 8, 38, 34);
    box(ctx, 5, y0 + 8, 38, 32, 30, PAL.steel, '#454a74');
    // roof details
    px(ctx, 9, y0 - 18, 10, 6, PAL.steelL);
    px(ctx, 9, y0 - 18, 10, 1, PAL.steelLL);
    px(ctx, 24, y0 - 16, 12, 4, PAL.navy);
    for (let i = 0; i < 12; i += 2) px(ctx, 24 + i, y0 - 16, 1, 4, PAL.steelL);
    // antenna + dish
    px(ctx, 37, y0 - 30, 1, 14, PAL.steelLL);
    px(ctx, 35, y0 - 26, 5, 1, PAL.steelLL);
    out.lights.push({ x: 37, y: y0 - 31, color: PAL.red, blink: true });
    px(ctx, 37, y0 - 31, 1, 1, PAL.red);
    px(ctx, 12, y0 - 24, 6, 3, PAL.white);
    px(ctx, 14, y0 - 21, 2, 4, PAL.steelLL);
    // front wall
    const wy = y0 + 10;
    px(ctx, 5, wy, 38, 3, PAL.pink);
    px(ctx, 5, wy + 3, 38, 1, PAL.pinkD);
    windowsGrid(ctx, out.lights, 8, wy + 7, 4, 2, 4, 6, PAL.lime, PAL.navy, 7);
    windowsGrid(ctx, out.lights, 30, wy + 7, 3, 2, 4, 6, PAL.lime, PAL.navy, 9);
    // emblem panel
    px(ctx, 19, wy + 6, 11, 10, PAL.ink);
    recycleMark(ctx, 20, wy + 7, PAL.lime, PAL.ink);
    out.lights.push({ x: 24, y: wy + 9, color: PAL.lime });
    // door
    px(ctx, 20, wy + 20, 9, 10, PAL.ink);
    px(ctx, 21, wy + 21, 7, 9, '#2a2e52');
    px(ctx, 21, wy + 25, 7, 1, PAL.yellow);
    drawPixelText(ctx, 'HQ', 11, wy + 22, PAL.white);
  },

  dock(ctx, W, H, E, out) {
    const y0 = E;
    concretePad(ctx, 0, y0 + 2, W, H - 2);
    // garage at the back
    box(ctx, 3, y0 + 2, 26, 9, 9, PAL.steel, PAL.steelL);
    px(ctx, 6, y0 + 4, 8, 7, PAL.pinkD);
    for (let i = 0; i < 7; i += 2) px(ctx, 6, y0 + 4 + i, 8, 1, PAL.pink);
    px(ctx, 18, y0 + 4, 8, 3, PAL.navy);
    out.lights.push({ x: 19, y: y0 + 5, color: PAL.cyan }, { x: 23, y: y0 + 5, color: PAL.cyan });
    px(ctx, 19, y0 + 5, 1, 1, PAL.cyan);
    px(ctx, 23, y0 + 5, 1, 1, PAL.cyan);
    // landing pad
    const cx = 16;
    const cy = y0 + 21;
    px(ctx, cx - 10, cy - 7, 20, 14, PAL.ink);
    px(ctx, cx - 9, cy - 6, 18, 12, '#2c2a3a');
    px(ctx, cx - 9, cy - 6, 18, 1, PAL.lime);
    px(ctx, cx - 9, cy + 5, 18, 1, PAL.lime);
    px(ctx, cx - 9, cy - 6, 1, 12, PAL.lime);
    px(ctx, cx + 8, cy - 6, 1, 12, PAL.lime);
    // bot icon on the pad
    px(ctx, cx - 3, cy - 3, 6, 5, PAL.white);
    px(ctx, cx - 2, cy - 2, 4, 2, PAL.ink);
    px(ctx, cx - 3, cy - 5, 1, 2, PAL.white);
    px(ctx, cx + 2, cy - 5, 1, 2, PAL.white);
    for (const [lx, ly] of [
      [cx - 9, cy - 6],
      [cx + 8, cy - 6],
      [cx - 9, cy + 5],
      [cx + 8, cy + 5],
    ]) {
      out.lights.push({ x: lx, y: ly, color: PAL.lime, blink: true });
    }
  },

  recycler(ctx, W, H, E, out) {
    const y0 = E;
    concretePad(ctx, 0, y0 + 4, W, H - 4);
    shadow(ctx, 2, y0 + 6, 28, 22);
    box(ctx, 2, y0 + 6, 28, 22, 16, '#3cb486', '#2a8a66');
    px(ctx, 4, y0 - 8, 8, 4, '#2a8a66');
    px(ctx, 20, y0 - 8, 7, 3, PAL.cyanD);
    // emblem
    px(ctx, 11, y0 + 15, 11, 10, PAL.ink);
    recycleMark(ctx, 12, y0 + 16, PAL.lime, PAL.ink);
    out.lights.push({ x: 16, y: y0 + 18, color: PAL.lime });
    // conveyor
    px(ctx, 0, y0 + 26, 10, 3, PAL.ink);
    for (let i = 0; i < 10; i += 2) px(ctx, i, y0 + 27, 1, 1, PAL.steelLL);
    px(ctx, 2, y0 + 24, 2, 2, PAL.rust);
    px(ctx, 5, y0 + 23, 3, 3, PAL.steelL);
    px(ctx, 24, y0 + 18, 3, 3, PAL.lime);
    out.lights.push({ x: 25, y: y0 + 19, color: PAL.lime, blink: true });
  },

  smelter(ctx, W, H, E, out) {
    const y0 = E;
    concretePad(ctx, 0, y0 + 4, W, H - 4);
    shadow(ctx, 2, y0 + 8, 26, 20);
    box(ctx, 2, y0 + 8, 26, 20, 14, '#5a3a2e', PAL.rustD);
    // chimney
    px(ctx, 21, y0 - 18, 6, 22, PAL.ink);
    px(ctx, 22, y0 - 17, 4, 21, '#4b4a5c');
    px(ctx, 22, y0 - 12, 4, 2, PAL.yellow);
    px(ctx, 22, y0 - 6, 4, 2, PAL.yellow);
    out.smoke.push({ x: 24, y: y0 - 19 });
    // furnace mouth
    px(ctx, 6, y0 + 16, 12, 9, PAL.ink);
    px(ctx, 7, y0 + 18, 10, 7, PAL.orange);
    px(ctx, 8, y0 + 20, 8, 5, PAL.yellow);
    out.lights.push({ x: 10, y: y0 + 20, color: PAL.orange }, { x: 13, y: y0 + 21, color: PAL.yellow });
    // ingots
    px(ctx, 24, y0 + 24, 5, 2, PAL.yellow);
    px(ctx, 25, y0 + 22, 4, 2, PAL.orange);
  },

  solar(ctx, W, H, E, out) {
    const y0 = E;
    px(ctx, 0, y0 + 2, W, H - 2, '#2b2938');
    for (let j = 0; j < 2; j++) {
      for (let i = 0; i < 2; i++) {
        const x = 2 + i * 15;
        const y = y0 + 3 + j * 14;
        px(ctx, x + 2, y + 9, 1, 4, PAL.steelLL);
        px(ctx, x + 10, y + 9, 1, 4, PAL.steelLL);
        px(ctx, x - 1, y - 1, 15, 11, PAL.ink);
        px(ctx, x, y, 13, 9, '#2a5bd0');
        for (let k = 0; k < 13; k += 3) px(ctx, x + k, y, 1, 9, '#1c3f99');
        px(ctx, x, y + 4, 13, 1, '#1c3f99');
        px(ctx, x + 1, y + 1, 4, 1, PAL.sky);
        px(ctx, x + 1, y + 1, 1, 2, PAL.sky);
      }
    }
    out.lights.push({ x: 15, y: y0 + 30, color: PAL.lime, blink: true });
  },

  burner(ctx, W, H, E, out) {
    const y0 = E;
    concretePad(ctx, 0, y0 + 4, W, H - 4);
    shadow(ctx, 2, y0 + 8, 28, 20);
    box(ctx, 2, y0 + 8, 28, 20, 12, '#3a3747', '#2a2836');
    for (const cx of [6, 20]) {
      px(ctx, cx, y0 - 20, 6, 24, PAL.ink);
      px(ctx, cx + 1, y0 - 19, 4, 23, '#575466');
      px(ctx, cx + 1, y0 - 15, 4, 2, PAL.red);
      out.smoke.push({ x: cx + 3, y: y0 - 21 });
    }
    px(ctx, 9, y0 + 17, 14, 8, PAL.ink);
    px(ctx, 10, y0 + 19, 12, 6, PAL.red);
    px(ctx, 11, y0 + 21, 10, 4, PAL.orange);
    px(ctx, 13, y0 + 22, 6, 3, PAL.yellow);
    out.lights.push({ x: 12, y: y0 + 21, color: PAL.orange }, { x: 17, y: y0 + 22, color: PAL.yellow });
    drawPixelText(ctx, '2PM', 3, y0 + 9, PAL.pink);
  },

  pods(ctx, W, H, E, out) {
    const y0 = E;
    px(ctx, 0, y0 + 4, W, H - 4, '#2f2b3e');
    shadow(ctx, 2, y0 + 10, 28, 18);
    const pod = (x: number, y: number, w: number, h: number, body: string, seed: number) => {
      px(ctx, x - 1, y - 1, w + 2, h + 2, PAL.ink);
      px(ctx, x, y, w, h, body);
      px(ctx, x, y, w, 1, shade(body, 0.3));
      const lit = hash2(x, y, seed) > 0.3;
      px(ctx, x + 2, y + 3, 3, 3, PAL.ink);
      px(ctx, x + 3, y + 4, 1, 1, lit ? PAL.yellow : PAL.navy);
      if (lit) out.lights.push({ x: x + 3, y: y + 4, color: PAL.yellow });
      px(ctx, x + w - 4, y + 3, 2, 2, PAL.steelLL);
    };
    pod(3, y0 + 14, 12, 12, PAL.pink, 1);
    pod(17, y0 + 15, 12, 11, PAL.white, 2);
    pod(4, y0 + 1, 11, 11, PAL.purple, 3);
    pod(17, y0 + 3, 11, 10, PAL.pinkD, 4);
    pod(10, y0 - 10, 12, 10, PAL.sky, 5);
    // ladder
    px(ctx, 15, y0 - 2, 2, 28, PAL.steelLL);
    for (let i = 0; i < 28; i += 3) px(ctx, 15, y0 - 2 + i, 2, 1, PAL.ink);
    px(ctx, 15, y0 - 14, 1, 4, PAL.steelLL);
    out.lights.push({ x: 15, y: y0 - 15, color: PAL.pink, blink: true });
  },

  garden(ctx, W, H, E, out) {
    const y0 = E;
    px(ctx, 0, y0, W, H, '#2f6b37');
    for (let i = 0; i < 12; i++) {
      px(ctx, Math.floor(hash2(i, 1, 4) * 15), y0 + Math.floor(hash2(i, 2, 4) * 15), 1, 1, '#4f9c48');
    }
    // trunk + canopy
    px(ctx, 7, y0 + 4, 2, 8, '#5b3a22');
    px(ctx, 2, y0 - 7, 12, 10, PAL.ink);
    px(ctx, 3, y0 - 6, 10, 8, PAL.greenD);
    px(ctx, 4, y0 - 8, 8, 4, PAL.ink);
    px(ctx, 5, y0 - 7, 6, 4, PAL.green);
    px(ctx, 4, y0 - 4, 7, 4, PAL.green);
    px(ctx, 6, y0 - 6, 3, 2, PAL.greenL);
    px(ctx, 3, y0 + 11, 1, 1, PAL.pink);
    px(ctx, 12, y0 + 10, 1, 1, PAL.yellow);
    px(ctx, 11, y0 + 13, 1, 1, PAL.pink);
    // bench
    px(ctx, 10, y0 + 6, 5, 1, PAL.rust);
    px(ctx, 10, y0 + 7, 1, 2, PAL.rustD);
    px(ctx, 14, y0 + 7, 1, 2, PAL.rustD);
    out.lights.push({ x: 2, y: y0 + 2, color: PAL.yellow });
    px(ctx, 2, y0 + 2, 1, 6, PAL.steelLL);
  },

  factory(ctx, W, H, E, out) {
    const y0 = E;
    concretePad(ctx, 0, y0 + 4, W, H - 4);
    shadow(ctx, 2, y0 + 8, 44, 20);
    box(ctx, 2, y0 + 8, 44, 20, 14, '#4a4760', '#3a3850');
    // sawtooth roof
    for (let i = 0; i < 3; i++) {
      const x = 4 + i * 11;
      for (let k = 0; k < 6; k++) px(ctx, x + k, y0 - 6 - k, 10 - k, 1, k === 5 ? PAL.steelLL : PAL.steelL);
      px(ctx, x + 9, y0 - 12, 1, 7, PAL.sky);
    }
    // chimney with stripes
    px(ctx, 38, y0 - 22, 7, 28, PAL.ink);
    px(ctx, 39, y0 - 21, 5, 27, PAL.white);
    for (let i = 0; i < 27; i += 6) px(ctx, 39, y0 - 21 + i, 5, 3, PAL.pink);
    out.smoke.push({ x: 41, y: y0 - 23 });
    out.lights.push({ x: 41, y: y0 - 22, color: PAL.red, blink: true });
    // sign
    px(ctx, 6, y0 + 15, 17, 9, PAL.ink);
    px(ctx, 7, y0 + 16, 15, 7, PAL.white);
    drawPixelText(ctx, '2PM', 9, y0 + 17, PAL.pink);
    windowsGrid(ctx, out.lights, 27, y0 + 17, 3, 2, 4, 5, PAL.orange, PAL.navy, 11);
    // loading door
    px(ctx, 25, y0 + 23, 10, 5, PAL.ink);
    for (let i = 0; i < 5; i += 2) px(ctx, 25, y0 + 23 + i, 10, 1, PAL.steel);
  },

  fixlab(ctx, W, H, E, out) {
    const y0 = E;
    concretePad(ctx, 0, y0 + 4, W, H - 4);
    shadow(ctx, 2, y0 + 8, 28, 20);
    box(ctx, 2, y0 + 8, 28, 20, 14, '#2fb3b0', PAL.cyanD);
    // awning
    for (let i = 0; i < 28; i += 4) {
      px(ctx, 2 + i, y0 + 14, 2, 3, PAL.white);
      px(ctx, 4 + i, y0 + 14, 2, 3, PAL.pink);
    }
    // open garage with a bot inside
    px(ctx, 5, y0 + 18, 13, 10, PAL.ink);
    px(ctx, 9, y0 + 21, 5, 5, PAL.white);
    px(ctx, 10, y0 + 22, 3, 1, PAL.lime);
    out.lights.push({ x: 10, y: y0 + 22, color: PAL.lime }, { x: 12, y: y0 + 22, color: PAL.lime });
    // wrench sign on the roof
    px(ctx, 19, y0 - 10, 9, 9, PAL.ink);
    px(ctx, 20, y0 - 9, 7, 7, PAL.yellow);
    px(ctx, 21, y0 - 8, 2, 2, PAL.ink);
    px(ctx, 22, y0 - 7, 1, 1, PAL.yellow);
    for (let k = 0; k < 4; k++) px(ctx, 22 + k, y0 - 6 + k, 2, 1, PAL.ink);
    windowsGrid(ctx, out.lights, 21, y0 + 19, 2, 2, 4, 4, PAL.yellow, PAL.navy, 13);
  },

  purifier(ctx, W, H, E, out) {
    const y0 = E;
    concretePad(ctx, 0, y0 + 4, W, H - 4);
    shadow(ctx, 6, y0 + 4, 20, 24);
    // tower
    px(ctx, 7, y0 - 20, 18, 46, PAL.ink);
    px(ctx, 8, y0 - 19, 16, 44, PAL.white);
    px(ctx, 8, y0 - 19, 3, 44, '#c9c4d8');
    px(ctx, 21, y0 - 19, 3, 44, '#d8d3e6');
    for (let i = 0; i < 44; i += 10) px(ctx, 8, y0 - 15 + i, 16, 2, PAL.cyan);
    // fan
    px(ctx, 9, y0 - 25, 14, 6, PAL.ink);
    px(ctx, 10, y0 - 24, 12, 4, PAL.steelL);
    px(ctx, 15, y0 - 24, 2, 4, PAL.steelLL);
    px(ctx, 10, y0 - 23, 12, 1, PAL.steelLL);
    // tank
    px(ctx, 24, y0 + 10, 7, 14, PAL.ink);
    px(ctx, 25, y0 + 11, 5, 12, PAL.cyanD);
    px(ctx, 25, y0 + 11, 5, 3, PAL.cyan);
    // drop logo
    px(ctx, 14, y0 + 6, 4, 5, PAL.cyan);
    px(ctx, 15, y0 + 4, 2, 2, PAL.cyan);
    for (let i = 0; i < 4; i++) out.lights.push({ x: 12 + i * 3, y: y0 - 14, color: PAL.cyan, blink: i % 2 === 0 });
  },

  spire(ctx, W, H, E, out) {
    const y0 = E;
    // plaza
    px(ctx, 0, y0 + 2, W, H - 2, '#34304a');
    for (let i = 0; i < W; i += 6) px(ctx, i, y0 + H - 3, 3, 1, PAL.lime);
    shadow(ctx, 8, y0 + 10, 32, 34);
    // tapering layers of scrap
    const colors = [PAL.steel, PAL.rust, PAL.purple, PAL.steelL, PAL.pinkD, PAL.cyanD, PAL.steel, PAL.purpleD];
    let w = 34;
    let y = y0 + 40;
    let k = 0;
    while (w > 6) {
      const h = 9;
      const x = Math.round((W - w) / 2);
      px(ctx, x - 1, y - h - 1, w + 2, h + 2, PAL.ink);
      px(ctx, x, y - h, w, h, colors[k % colors.length]);
      px(ctx, x, y - h, w, 1, shade(colors[k % colors.length], 0.35));
      px(ctx, x, y - 2, w, 1, PAL.pink);
      for (let i = 2; i < w - 2; i += 4) {
        if (hash2(i, k, 77) > 0.4) {
          px(ctx, x + i, y - 6, 2, 2, PAL.lime);
          out.lights.push({ x: x + i, y: y - 6, color: PAL.lime });
        }
      }
      y -= h;
      w -= 4;
      k++;
    }
    // crown on top
    const cx = Math.round(W / 2);
    const top = y - 2;
    px(ctx, cx - 7, top - 7, 15, 8, PAL.ink);
    px(ctx, cx - 6, top - 3, 13, 3, PAL.lime);
    px(ctx, cx - 6, top - 6, 2, 3, PAL.lime);
    px(ctx, cx - 1, top - 7, 3, 4, PAL.lime);
    px(ctx, cx + 5, top - 6, 2, 3, PAL.lime);
    out.lights.push({ x: cx, y: top - 6, color: PAL.lime, blink: true }, { x: cx - 5, y: top - 5, color: PAL.lime }, { x: cx + 5, y: top - 5, color: PAL.lime });
  },
};

const EXTRA: Record<BuildingType, number> = {
  hq: 34,
  dock: 4,
  recycler: 14,
  smelter: 24,
  solar: 4,
  burner: 26,
  pods: 18,
  garden: 10,
  factory: 26,
  fixlab: 14,
  purifier: 28,
  spire: 92,
};

const spriteCache = new Map<BuildingType, Sprite>();

export function buildingSprite(type: BuildingType): Sprite {
  const cached = spriteCache.get(type);
  if (cached) return cached;
  const def = BUILDINGS[type];
  const W = def.w * TILE;
  const H = def.h * TILE;
  const E = EXTRA[type];
  const [canvas, ctx] = makeCanvas(W, H + E);
  const sprite: Sprite = { canvas, ox: 0, oy: -E, lights: [], smoke: [] };
  builders[type](ctx, W, H, E, sprite);
  spriteCache.set(type, sprite);
  return sprite;
}

// ---------- characters ----------

const CHAR_PAL: Record<string, string> = {
  W: PAL.white,
  w: '#b9b4cc',
  K: PAL.ink,
  P: PAL.pink,
  G: PAL.lime,
  R: PAL.red,
  S: PAL.steelL,
  Y: PAL.yellow,
  D: '#2c2346',
  g: '#7d7896',
  p: PAL.pinkD,
};

// Big hand-drawn versions for the menu and portraits.
const HERO_BOT = [
  '....KK........KK....',
  '...KPPK......KPPK...',
  '...KPWK......KWPK...',
  '...KPWK......KWPK...',
  '...KPWK......KWPK...',
  '...KWWK......KWWK...',
  '..KKWWKKKKKKKKWWKK..',
  '.KWWWWWWWWWWWWWWWwK.',
  '.KWWWWWWRWWWWWWWWwK.',
  '.KWWWWWRRRWWWWWWWwK.',
  '.KWWWWWRWRWWWWWWWwK.',
  '.KWKKKKKKKKKKKKKKwK.',
  '.KWKGGGKKKKKGGGKKwK.',
  '.KWKGGGKKKKKGGGKKwK.',
  '.KWKKKKKKKKKKKKKKwK.',
  '.KwWWWWWWPPWWWWWwwK.',
  '..KKKKKKKKKKKKKKKK..',
  '...KDDDRRRRRRDDDK...',
  '..KDDDRRRRRRRDDDDK..',
  '..KDgDRRRRRRRDDgDK..',
  '..KDgDDDDDDDDDDgDK..',
  '..KKKDDDDDDDDDDKKK..',
  '....KDDDKKKKDDDK....',
  '....KggK....KggK....',
  '....KKKK....KKKK....',
];

const HERO_CAT = [
  '.K.......K.......',
  '.KK.....KK.......',
  '.KPK...KPK.......',
  '.KKKKKKKKK.......',
  'KKKKKKKKKKK......',
  'KKGGKKKGGKK......',
  'KKGGKKKGGKK....K.',
  'KKKKKPKKKKK....K.',
  '.KKKKKKKKK....K..',
  '..RRRRRRR.....K..',
  '..RRKKKKKKKKKK...',
  '..KKKKKKKKKKKK...',
  '..KKKKKKKKKKK....',
  '..KK.KK..KK.KK...',
];

const BOT_FRAMES = [
  ['.P....P.', '.W....W.', '.WW..WW.', 'WWWWWWWW', 'WKGKKGKW', 'WKKKKKKW', 'wWWPPWWw', '.RwWWwR.', '..w..w..'],
  ['.P....P.', '.W....W.', '.WW..WW.', 'WWWWWWWW', 'WKKGKKGW', 'WKKKKKKW', 'wWWPPWWw', '.RwWWwR.', '.w....w.'],
];

const CAT_FRAMES = [
  // sitting
  ['K...K...', 'KK.KK...', 'KKKKK...', 'KGKGK..K', 'KKKKK..K', '.RRR..K.', '.KKKKKK.', '.KKKKK..'],
  // walking
  ['K...K...', 'KK.KK...', 'KKKKK...', 'KGKGK...', 'KKKKKKKK', '.RRKKKK.', '.KKKKKKK', '.K.K..K.'],
];

function spriteFromRows(rows: string[], flip: boolean): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(rows[0].length, rows.length);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = CHAR_PAL[row[x]];
      if (color) px(ctx, flip ? row.length - 1 - x : x, y, 1, 1, color);
    }
  });
  return c;
}

const charCache = new Map<string, HTMLCanvasElement>();

function cachedRows(key: string, rows: string[], flip: boolean): HTMLCanvasElement {
  const k = `${key}:${flip ? 1 : 0}`;
  let c = charCache.get(k);
  if (!c) {
    c = spriteFromRows(rows, flip);
    charCache.set(k, c);
  }
  return c;
}

export function botSprite(frame: number, facing: 1 | -1): HTMLCanvasElement {
  return cachedRows(`bot${frame}`, BOT_FRAMES[frame % BOT_FRAMES.length], facing < 0);
}

// Wraps a sprite in a 1px rim so dark characters stay readable on dark ground.
function withRim(base: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const [sil, sctx] = makeCanvas(base.width + 2, base.height + 2);
  for (const [ox, oy] of [
    [0, 1],
    [2, 1],
    [1, 0],
    [1, 2],
  ]) {
    sctx.drawImage(base, ox, oy);
  }
  sctx.globalCompositeOperation = 'source-in';
  sctx.fillStyle = color;
  sctx.fillRect(0, 0, sil.width, sil.height);
  const [out, octx] = makeCanvas(sil.width, sil.height);
  octx.drawImage(sil, 0, 0);
  octx.drawImage(base, 1, 1);
  return out;
}

function cachedRim(key: string, make: () => HTMLCanvasElement): HTMLCanvasElement {
  let c = charCache.get(key);
  if (!c) {
    c = make();
    charCache.set(key, c);
  }
  return c;
}

// 10x10 including the rim.
export function catSprite(walking: boolean, facing: 1 | -1): HTMLCanvasElement {
  return cachedRim(`catRim:${walking ? 1 : 0}:${facing}`, () => withRim(spriteFromRows(CAT_FRAMES[walking ? 1 : 0], facing > 0), '#7a71a8'));
}

export function heroBotSprite(): HTMLCanvasElement {
  return cachedRim('heroBot', () => withRim(spriteFromRows(HERO_BOT, false), '#ffffff'));
}

export function heroCatSprite(facing: 1 | -1 = -1): HTMLCanvasElement {
  return cachedRim(`heroCat:${facing}`, () => withRim(spriteFromRows(HERO_CAT, facing > 0), '#8d82c8'));
}

// ---------- terrain ----------

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
const isRoadCol = (tx: number) => tx % 14 === 6;

function paintGround(ctx: Ctx, x: number, y: number, tx: number, ty: number, h: number): void {
  const n = valueNoise(tx / 5, ty / 5, 9);
  px(ctx, x, y, TILE, TILE, n < 0.38 ? '#29243b' : n < 0.62 ? PAL.ground : '#332a43');
  for (let k = 0; k < 6; k++) {
    const gx = Math.floor(hash2(tx * 5 + k, ty, 3) * 16);
    const gy = Math.floor(hash2(tx, ty * 5 + k, 4) * 16);
    px(ctx, x + gx, y + gy, 1, 1, k % 2 ? PAL.groundL : PAL.groundD);
  }
  const row = isRoadRow(ty);
  const col = isRoadCol(tx);
  if (row || col) {
    // the old street grid, half buried
    px(ctx, x, y, TILE, TILE, '#231e35');
    if (row) {
      px(ctx, x, y, TILE, 1, '#3b3452');
      px(ctx, x, y + 15, TILE, 1, '#3b3452');
    }
    if (col) {
      px(ctx, x, y, 1, TILE, '#3b3452');
      px(ctx, x + 15, y, 1, TILE, '#3b3452');
    }
    if (row && !col) for (let k = 1; k < 16; k += 6) px(ctx, x + k, y + 7, 3, 1, '#8a7a35');
    if (col && !row) for (let k = 1; k < 16; k += 6) px(ctx, x + 7, y + k, 1, 3, '#8a7a35');
    if (h > 0.7) px(ctx, x + 3 + Math.floor(h * 8), y + 4, 3, 1, PAL.groundD);
    return;
  }
  if (h < 0.08) {
    const cy = y + 4 + Math.floor(h * 80);
    for (let k = 0; k < 7; k++) px(ctx, x + 3 + k, cy + (k % 3 === 0 ? 1 : 0), 1, 1, PAL.groundD);
  } else if (h > 0.95) {
    px(ctx, x + 5, y + 7, 5, 3, '#1a1724');
    px(ctx, x + 6, y + 7, 2, 1, '#3d2f5c');
  }
}

export function paintTerrainTile(ctx: Ctx, tiles: Uint8Array, amount: Uint16Array, w: number, i: number): void {
  const tx = i % w;
  const ty = Math.floor(i / w);
  const x = tx * TILE;
  const y = ty * TILE;
  const t = tiles[i];
  const h = hash2(tx, ty);

  if (t === T.GRASS) {
    const n = valueNoise(tx / 3, ty / 3, 5);
    px(ctx, x, y, TILE, TILE, n > 0.5 ? PAL.grass : '#285030');
    for (let k = 0; k < 10; k++) {
      const gx = Math.floor(hash2(tx * 7 + k, ty, 1) * 15);
      const gy = Math.floor(hash2(tx, ty * 7 + k, 2) * 15);
      px(ctx, x + gx, y + gy, 1, 2, k % 3 === 0 ? '#4f9c48' : '#3b7d3f');
    }
    if (h > 0.85) px(ctx, x + 4 + Math.floor(h * 8), y + 6, 1, 1, h > 0.93 ? PAL.pink : PAL.yellow);
    return;
  }

  paintGround(ctx, x, y, tx, ty, h);

  if (t === T.RUBBLE) {
    const blocks = 2 + Math.floor(h * 2);
    for (let k = 0; k < blocks; k++) {
      const bx = x + 1 + Math.floor(hash2(tx, ty, 10 + k) * 9);
      const by = y + 3 + Math.floor(hash2(tx, ty, 20 + k) * 8);
      const bw = 4 + Math.floor(hash2(tx, ty, 30 + k) * 3);
      px(ctx, bx - 1, by - 1, bw + 2, 6, PAL.ink);
      px(ctx, bx, by, bw, 4, PAL.concrete);
      px(ctx, bx, by, bw, 1, PAL.concreteL);
      px(ctx, bx + bw - 1, by - 3, 1, 3, PAL.rust);
    }
    return;
  }

  if (t === T.SLUDGE) {
    const h2 = Math.floor(tiles.length / w);
    const same = (dx: number, dy: number) => {
      const nx = tx + dx;
      const ny = ty + dy;
      return nx >= 0 && ny >= 0 && nx < w && ny < h2 && tiles[ny * w + nx] === T.SLUDGE;
    };
    const l = same(-1, 0) ? 0 : 1;
    const r = same(1, 0) ? 0 : 1;
    const u = same(0, -1) ? 0 : 1;
    const d = same(0, 1) ? 0 : 1;
    // purple rim, toxic body, bright core; open sides merge with neighbouring sludge
    px(ctx, x + l, y + u, TILE - l - r, TILE - u - d, '#4d2f66');
    px(ctx, x + l * 3, y + u * 3, TILE - (l + r) * 3, TILE - (u + d) * 3, '#5fb52f');
    px(ctx, x + l * 5, y + u * 5, TILE - (l + r) * 5, TILE - (u + d) * 5, PAL.sludge);
    if (l && u) px(ctx, x + 3, y + 3, 1, 1, '#4d2f66');
    if (r && u) px(ctx, x + 12, y + 3, 1, 1, '#4d2f66');
    if (l && d) px(ctx, x + 3, y + 12, 1, 1, '#4d2f66');
    if (r && d) px(ctx, x + 12, y + 12, 1, 1, '#4d2f66');
    px(ctx, x + 5 + Math.floor(h * 5), y + 6, 2, 1, '#d2ff8a');
    if (h > 0.5) px(ctx, x + 9, y + 10, 1, 1, '#d2ff8a');
    return;
  }

  if (t === T.JUNK) paintJunk(ctx, x, y, amount[i], tx, ty);
}

const JUNK_COLORS = [PAL.rust, PAL.rustD, PAL.steel, PAL.steelL, PAL.concrete, PAL.pinkD, PAL.purpleD, '#8a5a3a'];

function paintJunk(ctx: Ctx, x: number, y: number, amt: number, tx: number, ty: number): void {
  const size = Math.min(1, amt / 40);
  const r = (k: number) => hash2(tx * 31 + k, ty * 17 - k, 50 + k);
  const cx = x + 8;
  const base = y + 14;
  const mw = Math.round(5 + size * 3);
  const mh = Math.round(2 + size * 5);
  // the heap itself
  for (let row = 0; row <= mh; row++) {
    const half = Math.round(mw * Math.sqrt(1 - (row / (mh + 1)) ** 2));
    px(ctx, cx - half, base - row, half * 2, 1, row === 0 ? '#14111d' : row === 1 ? '#1a1626' : '#221d31');
  }
  const n = 2 + Math.round(size * 5);
  for (let k = 0; k < n; k++) {
    const kind = r(k);
    const ox = Math.round(cx + (r(k + 10) - 0.5) * mw * 1.6);
    const oy = Math.round(base - 1 - r(k + 20) * mh);
    const color = JUNK_COLORS[Math.floor(r(k + 30) * JUNK_COLORS.length)];
    if (kind < 0.36) {
      const w = 3 + Math.floor(r(k + 40) * 4);
      px(ctx, ox - (w >> 1), oy - 2, w, 2, color);
      px(ctx, ox - (w >> 1), oy - 2, w, 1, shade(color, 0.3));
      px(ctx, ox - (w >> 1), oy, w, 1, PAL.ink);
    } else if (kind < 0.54) {
      const w = 5 + Math.floor(r(k + 40) * 4);
      px(ctx, ox - (w >> 1), oy - 1, w, 1, PAL.steelLL);
      px(ctx, ox - (w >> 1), oy, w, 1, PAL.ink);
    } else if (kind < 0.68) {
      px(ctx, ox - 2, oy - 4, 4, 4, '#121019');
      px(ctx, ox - 1, oy - 3, 2, 2, '#3a3646');
    } else if (kind < 0.84) {
      px(ctx, ox - 1, oy - 4, 3, 4, PAL.rust);
      px(ctx, ox - 1, oy - 3, 3, 1, PAL.rustD);
      px(ctx, ox - 1, oy - 4, 3, 1, shade(PAL.rust, 0.3));
    } else {
      px(ctx, ox, oy - 2, 2, 2, [PAL.pink, PAL.lime, PAL.cyan, PAL.yellow][Math.floor(r(k + 50) * 4)]);
    }
  }
  if (amt >= 25 && r(99) > 0.86) {
    const tvx = x + 4 + Math.floor(r(98) * 5);
    const tvy = base - mh - 5;
    px(ctx, tvx - 1, tvy - 1, 8, 7, PAL.ink);
    px(ctx, tvx, tvy, 6, 5, '#a9a3b8');
    px(ctx, tvx + 1, tvy + 1, 4, 3, PAL.ink);
    px(ctx, tvx + 2, tvy + 2, 1, 1, PAL.lime);
  }
}
