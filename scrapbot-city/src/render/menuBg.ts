// Animated pixel skyline behind the main menu, plus the small scenes on the path cards.
import type { BuildingType } from '../game/defs';
import { mulberry32 } from '../game/world';
import { drawPixelText } from './pixelfont';
import { PAL, botSprite, buildingSprite, catSprite, heroBotSprite, heroCatSprite, makeCanvas } from './sprites';
import { atlasImage, frame } from './iso/atlas';

const BASE_H = 200;

export class MenuBackground {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private static: HTMLCanvasElement | null = null;
  private w = 0;
  private h = BASE_H;
  private raf = 0;
  private t = 0;
  private last = 0;
  private reducedMotion = false;
  private dirty = true;
  private clouds: { x: number; y: number; w: number; speed: number }[] = [];

  // hold: true while something covers the scene (a dialog), so it can stop repainting
  constructor(
    canvas: HTMLCanvasElement,
    private hold: () => boolean = () => false,
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  setReducedMotion(v: boolean): void {
    this.reducedMotion = v;
    this.dirty = true;
  }

  start(): void {
    this.resize();
    this.last = performance.now();
    this.dirty = true;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      // a still picture (reduced motion, or blurred behind a dialog) is painted once, not 60 times a second
      const still = this.reducedMotion || this.hold();
      if (!still) this.t += dt;
      if (!still || this.dirty) {
        this.dirty = false;
        this.draw();
      }
      this.raf = requestAnimationFrame(loop);
    };
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
  }

  resize(): void {
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    this.h = BASE_H;
    this.w = Math.max(160, Math.round(BASE_H * aspect));
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    this.ctx.imageSmoothingEnabled = false;
    this.dirty = true;
    this.static = this.paintStatic();
    const rng = mulberry32(42);
    this.clouds = Array.from({ length: 7 }, () => ({
      x: rng() * this.w,
      y: 8 + rng() * 50,
      w: 16 + rng() * 34,
      speed: 2 + rng() * 4,
    }));
  }

  private paintStatic(): HTMLCanvasElement {
    const w = this.w;
    const h = this.h;
    const [c, ctx] = makeCanvas(w, h);
    const rng = mulberry32(2026);
    const p = (x: number, y: number, ww: number, hh: number, col: string) => {
      ctx.fillStyle = col;
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(ww), Math.round(hh));
    };

    // sky in dithered bands
    const bands = ['#2c47b0', '#3156c0', '#3a68cf', '#467cdc', '#5590e6', '#66a3ee', '#7ab4f2', '#8fc3f4'];
    const bandH = Math.ceil((h * 0.7) / bands.length);
    bands.forEach((col, i) => {
      p(0, i * bandH, w, bandH, col);
      if (i + 1 < bands.length) {
        ctx.fillStyle = bands[i + 1];
        for (let x = (i % 2) * 2; x < w; x += 4) ctx.fillRect(x, (i + 1) * bandH - 1, 2, 1);
      }
    });
    p(0, bands.length * bandH, w, h, '#8fc3f4');

    // pixel sun with a soft halo
    const sx = Math.round(w * 0.55);
    const sy = 34;
    for (const [r, col] of [
      [22, 'rgba(255,240,170,0.18)'],
      [16, 'rgba(255,240,170,0.28)'],
    ] as const) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    p(sx - 8, sy - 10, 16, 20, '#ffe680');
    p(sx - 10, sy - 8, 20, 16, '#ffe680');
    p(sx - 6, sy - 8, 6, 4, '#fff6c8');

    // far mega-structure and skyline (hazy blue-violet)
    const far = '#6d74c4';
    const farD = '#5c62b0';
    const cx = w * 0.6;
    for (let k = 0; k < 26; k++) {
      const bw = 6 + rng() * 14;
      const bh = 40 + rng() * 70 * (1 - Math.abs(k - 13) / 16);
      const x = cx - 90 + k * 7 + rng() * 4;
      p(x, h * 0.72 - bh, bw, bh, k % 3 ? far : farD);
      if (rng() > 0.5) p(x + bw / 2 - 1, h * 0.72 - bh - 8 - rng() * 10, 2, 12, farD);
    }
    for (let x = 0; x < w; x += 5 + rng() * 6) {
      const bh = 20 + rng() * 40;
      p(x, h * 0.74 - bh, 4 + rng() * 8, bh, rng() > 0.5 ? far : farD);
    }

    // mid layer: dark towers with lit windows, cranes and billboards
    const mid = ['#2e3170', '#363a80', '#272a5e'];
    for (let x = -4; x < w; ) {
      const bw = 10 + rng() * 20;
      const bh = 30 + rng() * 60;
      const top = h * 0.82 - bh;
      p(x, top, bw, bh + 40, mid[Math.floor(rng() * mid.length)]);
      p(x, top, bw, 1, '#4a4f9a');
      for (let wy = top + 4; wy < h * 0.82; wy += 5) {
        for (let wx = x + 2; wx < x + bw - 2; wx += 4) {
          if (rng() > 0.62) p(wx, wy, 2, 2, rng() > 0.3 ? PAL.yellow : PAL.pink);
        }
      }
      if (rng() > 0.7) {
        // crane
        p(x + bw / 2, top - 30, 2, 30, PAL.rustD);
        p(x + bw / 2 - 14, top - 30, 30, 2, PAL.rust);
        p(x + bw / 2 + 12, top - 28, 1, 14, '#1b1c3a');
      }
      x += bw + rng() * 4;
    }

    // billboard with Miso: GOOD JUNK GOOD FUTURE
    const bx = Math.round(w * 0.78);
    const by = Math.round(h * 0.2);
    p(bx + 10, by + 30, 3, 50, '#1b1c3a');
    p(bx + 44, by + 30, 3, 50, '#1b1c3a');
    p(bx - 1, by - 1, 62, 34, PAL.ink);
    p(bx, by, 60, 32, '#d7f06a');
    p(bx + 2, by + 2, 56, 28, '#e8f7a0');
    // cat face
    p(bx + 5, by + 8, 18, 16, PAL.ink);
    p(bx + 6, by + 9, 16, 14, PAL.white);
    p(bx + 5, by + 4, 4, 5, PAL.ink);
    p(bx + 19, by + 4, 4, 5, PAL.ink);
    p(bx + 6, by + 5, 2, 4, PAL.white);
    p(bx + 20, by + 5, 2, 4, PAL.white);
    p(bx + 9, by + 13, 3, 3, PAL.ink);
    p(bx + 16, by + 13, 3, 3, PAL.ink);
    p(bx + 13, by + 18, 2, 1, PAL.pink);
    drawPixelText(ctx, 'GOOD', bx + 27, by + 4, PAL.ink);
    drawPixelText(ctx, 'JUNK', bx + 27, by + 10, PAL.ink);
    drawPixelText(ctx, 'GOOD', bx + 27, by + 16, PAL.ink);
    drawPixelText(ctx, 'FUTURE', bx + 27, by + 22, PAL.ink);

    // industrial scaffolding on the right
    for (let k = 0; k < 3; k++) {
      const sx = w * 0.66 + k * 22;
      const sy = h * 0.5 + k * 6;
      p(sx, sy, 2, h - sy, '#5a3a2e');
      p(sx + 14, sy, 2, h - sy, '#5a3a2e');
      for (let y = sy; y < h; y += 8) p(sx, y, 16, 2, PAL.rust);
    }

    // big wall with graffiti
    p(w * 0.66, h * 0.66, w * 0.2, h * 0.34, '#5d6aa0');
    p(w * 0.66, h * 0.66, w * 0.2, 2, '#7a87bb');
    drawPixelText(ctx, 'BETTER ROBOTS', w * 0.67, h * 0.72, '#8c99d0');
    drawPixelText(ctx, 'BRIGHTER DAYS', w * 0.67, h * 0.79, '#8c99d0');

    // foreground scrap mountain
    const fg = ['#2a2440', '#352d50', '#1f1a31'];
    for (let k = 0; k < 160; k++) {
      const x = w * 0.18 + rng() * w * 0.5;
      const peak = w * 0.38;
      const height = Math.max(0, 70 - Math.abs(x - peak) * 0.45) * (0.6 + rng() * 0.5);
      const bw = 4 + rng() * 12;
      const bh = 3 + rng() * 8;
      const y = h - height * rng();
      p(x - 1, y - 1, bw + 2, bh + 2, PAL.ink);
      p(x, y, bw, bh, rng() > 0.85 ? (rng() > 0.5 ? PAL.pinkD : PAL.rust) : fg[Math.floor(rng() * fg.length)]);
      p(x, y, bw, 1, '#4b4170');
    }
    p(0, h - 6, w, 6, '#17132a');

    // CRT with a smiley
    const tx = Math.round(w * 0.42);
    const ty = Math.round(h - 40);
    p(tx - 1, ty - 1, 32, 26, PAL.ink);
    p(tx, ty, 30, 24, '#b8b2c8');
    p(tx + 3, ty + 3, 24, 17, PAL.ink);
    p(tx + 9, ty + 7, 2, 3, PAL.lime);
    p(tx + 19, ty + 7, 2, 3, PAL.lime);
    p(tx + 8, ty + 14, 14, 1, PAL.lime);
    p(tx + 7, ty + 13, 1, 1, PAL.lime);
    p(tx + 22, ty + 13, 1, 1, PAL.lime);

    // a flat rock on the summit for USA-9 and Miso
    const rx = Math.round(w * 0.29);
    p(rx - 1, h - 63, 98, 8, PAL.ink);
    p(rx, h - 62, 96, 6, '#3d3463');
    p(rx, h - 62, 96, 1, '#5b4f8f');

    return c;
  }

  private draw(): void {
    const ctx = this.ctx;
    if (!this.static) return;
    ctx.drawImage(this.static, 0, 0);
    this.drawHeroes();
    // clouds drift behind the city
    for (const cl of this.clouds) {
      const x = ((cl.x + this.t * cl.speed) % (this.w + 80)) - 40;
      ctx.fillStyle = 'rgba(236,240,255,0.85)';
      ctx.fillRect(Math.round(x), Math.round(cl.y), Math.round(cl.w), 4);
      ctx.fillRect(Math.round(x + cl.w * 0.2), Math.round(cl.y - 3), Math.round(cl.w * 0.5), 3);
      ctx.fillStyle = 'rgba(180,200,240,0.7)';
      ctx.fillRect(Math.round(x + 2), Math.round(cl.y + 4), Math.round(cl.w - 4), 1);
    }
    // the 2PM blimp
    const bx = Math.round(((this.t * 6) % (this.w + 100)) - 50);
    const by = Math.round(26 + Math.sin(this.t * 0.6) * 2);
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(bx - 1, by - 1, 42, 16);
    ctx.fillStyle = PAL.white;
    ctx.fillRect(bx, by, 40, 14);
    ctx.fillStyle = PAL.pink;
    ctx.fillRect(bx, by, 40, 3);
    ctx.fillRect(bx, by + 11, 40, 3);
    ctx.fillStyle = PAL.pinkD;
    ctx.fillRect(bx - 6, by + 3, 6, 8);
    drawPixelText(ctx, '2PM', bx + 14, by + 5, PAL.ink);
    ctx.fillStyle = 'rgba(236,240,255,0.6)';
    for (let k = 1; k < 5; k++) ctx.fillRect(bx - 8 - k * 7, by + 8 + Math.round(Math.sin(this.t * 2 + k) * 2), 4, 2);
    // blinking light on the crane
    if (Math.floor(this.t * 2) % 2 === 0) {
      ctx.fillStyle = PAL.red;
      ctx.fillRect(Math.round(this.w * 0.62), Math.round(this.h * 0.35), 1, 1);
    }
    this.drawSparks();
  }

  private drawHeroes(): void {
    const ctx = this.ctx;
    const bot = heroBotSprite();
    const cat = heroCatSprite(-1);
    const baseY = this.h - 62;
    const x = Math.round(this.w * 0.3);
    const bob = Math.round(Math.sin(this.t * 2.2) * 1.5);
    ctx.fillStyle = 'rgba(13,8,30,0.45)';
    ctx.fillRect(x + 6, baseY - 3, 34, 3);
    ctx.drawImage(bot, x, baseY - bot.height * 2 + bob, bot.width * 2, bot.height * 2);
    // chest badge, and the visor blinks now and then
    drawPixelText(ctx, '2PM', x + 15, baseY - 16 + bob, PAL.white);
    if (Math.floor(this.t * 10) % 37 === 0) {
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(x + 8, baseY - bot.height * 2 + 26 + bob, 26, 4);
    }
    const tail = Math.floor(this.t * 3) % 2;
    ctx.drawImage(cat, x + 48, baseY - cat.height * 2 + tail, cat.width * 2, cat.height * 2 - tail);
  }

  private drawSparks(): void {
    const ctx = this.ctx;
    const colors = [PAL.lime, PAL.pink, PAL.cyan, PAL.yellow];
    for (let k = 0; k < 18; k++) {
      const life = (this.t * 0.25 + k * 0.137) % 1;
      const x = this.w * 0.2 + ((k * 97) % Math.round(this.w * 0.45)) + Math.sin(this.t + k) * 4;
      const y = this.h - 20 - life * 120;
      ctx.globalAlpha = 1 - life;
      ctx.fillStyle = colors[k % colors.length];
      ctx.fillRect(Math.round(x), Math.round(y), k % 3 === 0 ? 2 : 1, k % 3 === 0 ? 2 : 1);
    }
    ctx.globalAlpha = 1;
  }
}

export type CardScene = 'green' | 'industrial' | 'choices' | 'shape';

export function paintCardScene(canvas: HTMLCanvasElement, scene: CardScene): void {
  const w = 96;
  const h = 40;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  // the half-size isometric sprites, like the toolbar (the menu paints the cards once the atlas is decoded; the old
  // flat art only if it never is)
  const img = atlasImage();
  const draw = (type: BuildingType, x: number, groundY: number) => {
    const f = frame(`b/${type}/icon`);
    if (img && f) {
      ctx.drawImage(img, f.x, f.y, f.w, f.h, x, groundY - f.h + 2, f.w, f.h);
      return;
    }
    const sp = buildingSprite(type);
    ctx.drawImage(sp.canvas, x, groundY - sp.canvas.height);
  };
  // a bot or the cat as the map shows them, at the buildings' half size (every other pixel, still hard-edged)
  const sprite = (name: string, x: number, y: number): boolean => {
    const f = frame(name);
    if (!img || !f) return false;
    ctx.drawImage(img, f.x, f.y, f.w, f.h, x, y, Math.round(f.w / 2), Math.round(f.h / 2));
    return true;
  };
  const fill = (col: string, y = 0, hh = h) => {
    ctx.fillStyle = col;
    ctx.fillRect(0, y, w, hh);
  };
  switch (scene) {
    case 'green':
      fill('#7cc8f0');
      fill('#2f6b37', 28, 12);
      draw('garden', 6, 38);
      draw('solar', 26, 40);
      draw('garden', 60, 38);
      draw('recycler', 66, 44);
      break;
    case 'industrial':
      fill('#4a2a4a');
      fill('#ff9b2f', 0, 6);
      fill('#2a2433', 30, 10);
      draw('factory', 2, 42);
      draw('smelter', 54, 42);
      draw('burner', 74, 44);
      break;
    case 'choices': {
      fill('#3b2f6a');
      ctx.fillStyle = '#2f6b37';
      ctx.fillRect(0, 30, w / 2, 10);
      ctx.fillStyle = '#5a3a2e';
      ctx.fillRect(w / 2, 30, w / 2, 10);
      // scales
      ctx.fillStyle = PAL.white;
      ctx.fillRect(47, 6, 2, 24);
      ctx.fillRect(30, 8, 36, 2);
      ctx.fillRect(40, 30, 16, 2);
      ctx.fillStyle = PAL.green;
      ctx.fillRect(26, 18, 12, 3);
      ctx.fillStyle = PAL.orange;
      ctx.fillRect(58, 16, 12, 3);
      ctx.fillStyle = PAL.white;
      ctx.fillRect(31, 10, 1, 8);
      ctx.fillRect(64, 10, 1, 6);
      break;
    }
    case 'shape':
      fill('#8a6fd0');
      fill('#3a3550', 26, 14);
      ctx.fillStyle = PAL.yellow;
      for (let x = 0; x < w; x += 8) ctx.fillRect(x, 33, 4, 1);
      draw('pods', 2, 34);
      draw('dock', 60, 40);
      // two bots flying over the road, Miso sitting on it
      if (!sprite('bot/se/carry/0', 38, 9)) ctx.drawImage(botSprite(0, 1), 40, 26);
      if (!sprite('bot/sw/fly/1', 50, 14)) ctx.drawImage(botSprite(1, -1), 50, 30);
      if (!sprite('cat/se/sit/0', 45, 29)) ctx.drawImage(catSprite(true, 1), 84, 30);
      break;
  }
}
