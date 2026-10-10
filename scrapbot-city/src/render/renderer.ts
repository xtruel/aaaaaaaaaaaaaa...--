// Draws the city at native pixel resolution; CSS scales the canvas up with crisp pixels.
import { BUILDINGS, MAP_H, MAP_W, T, TILE } from '../game/defs';
import type { BuildingType } from '../game/defs';
import { placeCheck } from '../game/actions';
import { dayPhase } from '../game/sim';
import { idx, inBounds } from '../game/state';
import type { Building, FxEvent, GameState } from '../game/state';
import { drawPixelText, pixelTextWidth } from './pixelfont';
import { PAL, botSprite, buildingSprite, catSprite, makeCanvas, paintTerrainTile } from './sprites';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  grow: number;
}

interface Floater {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

export interface ViewState {
  hover: { x: number; y: number } | null;
  build: BuildingType | null;
  bulldoze: boolean;
  selectedId: number;
  reducedMotion: boolean;
}

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private terrain: HTMLCanvasElement;
  private tctx: CanvasRenderingContext2D;
  zoom = 3;
  cam = { x: 0, y: 0 };
  viewW = 0;
  viewH = 0;
  private particles: Particle[] = [];
  private floaters: Floater[] = [];
  private clock = 0;
  private blimp = { x: -80, timer: 8 };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    [this.terrain, this.tctx] = makeCanvas(MAP_W * TILE, MAP_H * TILE);
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.viewW = Math.ceil(w / this.zoom);
    this.viewH = Math.ceil(h / this.zoom);
    this.canvas.width = this.viewW;
    this.canvas.height = this.viewH;
    this.canvas.style.width = `${this.viewW * this.zoom}px`;
    this.canvas.style.height = `${this.viewH * this.zoom}px`;
    this.ctx.imageSmoothingEnabled = false;
    this.clampCam();
  }

  setZoom(z: number, screenX = window.innerWidth / 2, screenY = window.innerHeight / 2): void {
    const nz = Math.max(2, Math.min(5, z));
    if (nz === this.zoom) return;
    const wx = this.cam.x + screenX / this.zoom;
    const wy = this.cam.y + screenY / this.zoom;
    this.zoom = nz;
    this.resize();
    this.cam.x = wx - screenX / this.zoom;
    this.cam.y = wy - screenY / this.zoom;
    this.clampCam();
  }

  centerOn(wx: number, wy: number): void {
    this.cam.x = wx - this.viewW / 2;
    this.cam.y = wy - this.viewH / 2;
    this.clampCam();
  }

  clampCam(): void {
    const mapW = MAP_W * TILE;
    const mapH = MAP_H * TILE;
    const margin = 48;
    if (this.viewW >= mapW + margin * 2) this.cam.x = (mapW - this.viewW) / 2;
    else this.cam.x = Math.max(-margin, Math.min(mapW - this.viewW + margin, this.cam.x));
    if (this.viewH >= mapH + margin * 2) this.cam.y = (mapH - this.viewH) / 2;
    else this.cam.y = Math.max(-margin, Math.min(mapH - this.viewH + margin, this.cam.y));
  }

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return { x: this.cam.x + sx / this.zoom, y: this.cam.y + sy / this.zoom };
  }

  screenToTile(sx: number, sy: number): { x: number; y: number } {
    const w = this.screenToWorld(sx, sy);
    return { x: Math.floor(w.x / TILE), y: Math.floor(w.y / TILE) };
  }

  paintAllTerrain(s: GameState): void {
    for (let i = 0; i < MAP_W * MAP_H; i++) paintTerrainTile(this.tctx, s.tiles, s.amount, MAP_W, i);
    s.dirtyTiles.length = 0;
  }

  private paintDirty(s: GameState): void {
    if (s.dirtyTiles.length === 0) return;
    // neighbours too: sludge pools merge with adjacent sludge
    const todo = new Set<number>();
    for (const i of s.dirtyTiles) {
      todo.add(i);
      const x = i % MAP_W;
      if (x > 0) todo.add(i - 1);
      if (x < MAP_W - 1) todo.add(i + 1);
      if (i >= MAP_W) todo.add(i - MAP_W);
      if (i + MAP_W < MAP_W * MAP_H) todo.add(i + MAP_W);
    }
    for (const i of todo) paintTerrainTile(this.tctx, s.tiles, s.amount, MAP_W, i);
    s.dirtyTiles.length = 0;
  }

  onFx(fx: FxEvent): void {
    switch (fx.kind) {
      case 'collect':
        for (let k = 0; k < 5; k++) this.spawn(fx.x, fx.y + 4, (Math.random() - 0.5) * 20, -10 - Math.random() * 15, 0.6, 1, PAL.concreteL, 0);
        break;
      case 'built':
      case 'placed':
        for (let k = 0; k < 18; k++) this.spawn(fx.x, fx.y, (Math.random() - 0.5) * 50, -Math.random() * 40, 0.9, 1, k % 2 ? PAL.lime : PAL.white, 0);
        if (fx.text) this.float(fx.x, fx.y - 20, fx.text, PAL.lime);
        break;
      case 'produce':
        if (fx.text) this.float(fx.x, fx.y, fx.text, fx.text.includes('cr') ? PAL.yellow : PAL.cyan);
        break;
      case 'clean':
        for (let k = 0; k < 10; k++) this.spawn(fx.x, fx.y, (Math.random() - 0.5) * 20, -15 - Math.random() * 20, 1, 1, PAL.cyan, 0);
        this.float(fx.x, fx.y - 6, 'CLEAN', PAL.cyan);
        break;
      case 'demolish':
        for (let k = 0; k < 14; k++) this.spawn(fx.x, fx.y, (Math.random() - 0.5) * 40, -Math.random() * 30, 0.8, 2, PAL.concrete, 0);
        if (fx.text) this.float(fx.x, fx.y - 8, fx.text, PAL.white);
        break;
      case 'storm':
        break;
    }
  }

  private spawn(x: number, y: number, vx: number, vy: number, life: number, size: number, color: string, grow: number): void {
    if (this.particles.length > 600) return;
    this.particles.push({ x, y, vx, vy, life, max: life, size, color, grow });
  }

  private float(x: number, y: number, text: string, color: string): void {
    this.floaters.push({ x, y, text, color, life: 1.4 });
  }

  render(s: GameState, view: ViewState, dt: number, simRunning: boolean): void {
    const ctx = this.ctx;
    this.clock += dt;
    this.paintDirty(s);
    const camX = Math.round(this.cam.x);
    const camY = Math.round(this.cam.y);

    ctx.fillStyle = '#0f0d18';
    ctx.fillRect(0, 0, this.viewW, this.viewH);
    ctx.drawImage(this.terrain, -camX, -camY);
    this.drawMapEdge(camX, camY);

    const x0 = Math.max(0, Math.floor(camX / TILE));
    const y0 = Math.max(0, Math.floor(camY / TILE));
    const x1 = Math.min(MAP_W - 1, Math.ceil((camX + this.viewW) / TILE));
    const y1 = Math.min(MAP_H - 1, Math.ceil((camY + this.viewH) / TILE));

    // sludge bubbles
    if (!view.reducedMotion) {
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          if (s.tiles[idx(tx, ty)] !== T.SLUDGE) continue;
          const p = (this.clock * 0.8 + (tx * 0.37 + ty * 0.61)) % 1;
          if (p < 0.5) {
            const bx = tx * TILE + 4 + ((tx * 5 + ty * 3) % 7) - camX;
            const by = ty * TILE + 10 - Math.floor(p * 10) - camY;
            ctx.fillStyle = '#d2ff8a';
            ctx.fillRect(bx, by, 1, 1);
          }
        }
      }
    }

    // effect radius when placing or inspecting a purifier
    const selected = s.buildings.find((b) => b.id === view.selectedId);
    if (selected && BUILDINGS[selected.type].cleanRadius) this.drawRadius(selected.x, selected.y, selected.type, camX, camY);

    // world entities, sorted by their ground line
    const items: { y: number; draw: () => void }[] = [];
    for (const b of s.buildings) {
      const def = BUILDINGS[b.type];
      items.push({ y: (b.y + def.h) * TILE, draw: () => this.drawBuilding(b, camX, camY, b.id === view.selectedId) });
    }
    for (const bot of s.bots) {
      items.push({
        y: bot.y + 6,
        draw: () => {
          const bob = view.reducedMotion ? 0 : Math.round(Math.sin(bot.phase * 6) * 1);
          const bx = Math.round(bot.x) - 4 - camX;
          const by = Math.round(bot.y) - 9 - camY;
          ctx.fillStyle = 'rgba(5,4,12,0.4)';
          ctx.fillRect(bx + 1, by + 12, 6, 2);
          ctx.drawImage(botSprite(Math.floor(bot.phase * 4) % 2, bot.facing), bx, by + bob);
          if (bot.carry > 0) {
            ctx.fillStyle = PAL.ink;
            ctx.fillRect(bx + 2, by + 8 + bob, 4, 3);
            ctx.fillStyle = PAL.rust;
            ctx.fillRect(bx + 2, by + 8 + bob, 3, 2);
          }
          if (bot.state === 'collect' && Math.floor(this.clock * 10) % 2 === 0) {
            ctx.fillStyle = PAL.lime;
            ctx.fillRect(bx + 3, by + 13, 2, 1);
          }
        },
      });
    }
    const cat = s.cat;
    items.push({
      y: cat.y + 4,
      draw: () => {
        const walking = !cat.sitting && Math.floor(this.clock * 6) % 2 === 0;
        ctx.drawImage(catSprite(walking, cat.facing), Math.round(cat.x) - 5 - camX, Math.round(cat.y) - 9 - camY);
      },
    });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw();

    // chimney smoke and machine sparkles
    if (simRunning && !view.reducedMotion) this.emitAmbient(s, dt);
    this.updateParticles(dt, camX, camY, simRunning);

    // placement ghost / hover
    if (view.hover) this.drawCursor(s, view, camX, camY);

    this.drawLighting(s, camX, camY);
    this.drawSmog(s, view.reducedMotion);
    this.drawFloaters(dt, camX, camY);
    this.drawBlimp(dt, view.reducedMotion);
  }

  private drawMapEdge(camX: number, camY: number): void {
    const ctx = this.ctx;
    ctx.strokeStyle = PAL.pinkD;
    ctx.lineWidth = 1;
    ctx.strokeRect(-camX - 0.5, -camY - 0.5, MAP_W * TILE + 1, MAP_H * TILE + 1);
  }

  private drawBuilding(b: Building, camX: number, camY: number, selected: boolean): void {
    const ctx = this.ctx;
    const def = BUILDINGS[b.type];
    const sp = buildingSprite(b.type);
    const x = b.x * TILE + sp.ox - camX;
    const y = b.y * TILE + sp.oy - camY;
    const fw = def.w * TILE;
    const fh = def.h * TILE;
    if (b.built < 1) {
      // reveal from the ground up, with scaffolding on the cut line
      const h = sp.canvas.height;
      const vis = Math.max(2, Math.floor(h * b.built));
      ctx.fillStyle = '#3a3646';
      ctx.fillRect(b.x * TILE - camX, b.y * TILE - camY, fw, fh);
      ctx.drawImage(sp.canvas, 0, h - vis, sp.canvas.width, vis, x, y + h - vis, sp.canvas.width, vis);
      const cut = y + h - vis;
      ctx.fillStyle = PAL.yellow;
      for (let i = 0; i < sp.canvas.width; i += 4) ctx.fillRect(x + i, cut, 2, 1);
      ctx.fillStyle = PAL.orange;
      ctx.fillRect(x, cut, 1, h - (cut - y));
      ctx.fillRect(x + sp.canvas.width - 1, cut, 1, h - (cut - y));
      // progress bar
      const bx = b.x * TILE - camX;
      const by = b.y * TILE + fh - 4 - camY;
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(bx + 2, by, fw - 4, 3);
      ctx.fillStyle = PAL.lime;
      ctx.fillRect(bx + 3, by + 1, Math.floor((fw - 6) * b.built), 1);
    } else {
      ctx.drawImage(sp.canvas, x, y);
      if (b.status !== 'ok') this.drawStatusIcon(b, x + sp.canvas.width - 7, y + 2);
    }
    if (selected && Math.floor(this.clock * 3) % 2 === 0) {
      ctx.strokeStyle = PAL.lime;
      ctx.strokeRect(b.x * TILE - camX - 0.5, b.y * TILE - camY - 0.5, fw + 1, fh + 1);
    }
  }

  private drawStatusIcon(b: Building, x: number, y: number): void {
    const ctx = this.ctx;
    if (Math.floor(this.clock * 2) % 2 === 1) return;
    const color = b.status === 'noPower' ? PAL.yellow : b.status === 'noFuel' ? PAL.orange : PAL.red;
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(x - 1, y - 1, 7, 7);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 5, 5);
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(x + 2, y + 1, 1, 2);
    ctx.fillRect(x + 2, y + 4, 1, 1);
  }

  private drawRadius(tx: number, ty: number, type: BuildingType, camX: number, camY: number): void {
    const def = BUILDINGS[type];
    const r = def.cleanRadius ?? 0;
    const cx = (tx + def.w / 2) * TILE - camX;
    const cy = (ty + def.h / 2) * TILE - camY;
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(66,226,210,0.5)';
    const steps = 48;
    for (let k = 0; k < steps; k++) {
      const a = (k / steps) * Math.PI * 2 + this.clock * 0.3;
      ctx.fillRect(Math.round(cx + Math.cos(a) * r * TILE), Math.round(cy + Math.sin(a) * r * TILE), 1, 1);
    }
  }

  private drawCursor(s: GameState, view: ViewState, camX: number, camY: number): void {
    const ctx = this.ctx;
    const h = view.hover!;
    if (view.build) {
      const def = BUILDINGS[view.build];
      const ox = h.x - Math.floor((def.w - 1) / 2);
      const oy = h.y - Math.floor((def.h - 1) / 2);
      const check = placeCheck(s, view.build, ox, oy);
      const sp = buildingSprite(view.build);
      ctx.globalAlpha = 0.65;
      ctx.drawImage(sp.canvas, ox * TILE + sp.ox - camX, oy * TILE + sp.oy - camY);
      ctx.globalAlpha = 1;
      for (let dy = 0; dy < def.h; dy++) {
        for (let dx = 0; dx < def.w; dx++) {
          const tx = ox + dx;
          const ty = oy + dy;
          const okTile = inBounds(tx, ty) && s.occ[idx(tx, ty)] === -1 && (s.tiles[idx(tx, ty)] === T.GROUND || s.tiles[idx(tx, ty)] === T.GRASS);
          ctx.fillStyle = okTile ? (check.ok ? 'rgba(198,244,50,0.28)' : 'rgba(255,212,64,0.28)') : 'rgba(226,54,75,0.45)';
          ctx.fillRect(tx * TILE - camX, ty * TILE - camY, TILE, TILE);
        }
      }
      if (def.cleanRadius) this.drawRadius(ox, oy, view.build, camX, camY);
      if (!check.ok && check.reason) {
        const text = check.reason.toUpperCase();
        const w = pixelTextWidth(text);
        const lx = Math.round(ox * TILE - camX + (def.w * TILE) / 2 - w / 2);
        const ly = oy * TILE - camY - 12;
        ctx.fillStyle = 'rgba(13,11,22,0.85)';
        ctx.fillRect(lx - 2, ly - 2, w + 4, 9);
        drawPixelText(ctx, text, lx, ly, PAL.red);
      }
      return;
    }
    if (!inBounds(h.x, h.y)) return;
    ctx.strokeStyle = view.bulldoze ? PAL.red : 'rgba(236,232,246,0.55)';
    ctx.strokeRect(h.x * TILE - camX + 0.5, h.y * TILE - camY + 0.5, TILE - 1, TILE - 1);
  }

  private emitAmbient(s: GameState, dt: number): void {
    for (const b of s.buildings) {
      if (b.built < 1) continue;
      const def = BUILDINGS[b.type];
      const sp = buildingSprite(b.type);
      const working = def.fuel ? b.fuel > 0 : def.process ? b.status === 'ok' : false;
      if (working && sp.smoke.length && Math.random() < dt * 6) {
        const p = sp.smoke[Math.floor(Math.random() * sp.smoke.length)];
        const dirty = s.pollution > 60 ? '#4a3c32' : '#6d6878';
        this.spawn(b.x * TILE + sp.ox + p.x, b.y * TILE + sp.oy + p.y, 4 + Math.random() * 6, -8 - Math.random() * 6, 2.6, 2, dirty, 1.4);
      }
      if ((b.type === 'recycler' || b.type === 'fixlab') && b.status === 'ok' && Math.random() < dt * 3) {
        this.spawn(b.x * TILE + 4 + Math.random() * 24, b.y * TILE + 8, 0, -12, 0.8, 1, PAL.lime, 0);
      }
      if (b.type === 'purifier' && s.derived.efficiency > 0 && Math.random() < dt * 2) {
        this.spawn(b.x * TILE + sp.ox + 16, b.y * TILE + sp.oy + 2, (Math.random() - 0.5) * 6, -10, 1.2, 1, PAL.cyan, 0);
      }
      if (b.type === 'garden' && s.pollution < 50 && Math.random() < dt * 0.4) {
        this.spawn(b.x * TILE + 8, b.y * TILE - 2, 6, 4, 2, 1, PAL.greenL, 0);
      }
    }
  }

  private updateParticles(dt: number, camX: number, camY: number, running: boolean): void {
    const ctx = this.ctx;
    const k = running ? dt : 0;
    this.particles = this.particles.filter((p) => (p.life -= k) > 0);
    for (const p of this.particles) {
      p.x += p.vx * k;
      p.y += p.vy * k;
      p.size += p.grow * k;
      ctx.globalAlpha = Math.min(1, (p.life / p.max) * 1.5);
      ctx.fillStyle = p.color;
      const sz = Math.max(1, Math.round(p.size));
      ctx.fillRect(Math.round(p.x - sz / 2) - camX, Math.round(p.y - sz / 2) - camY, sz, sz);
    }
    ctx.globalAlpha = 1;
  }

  private drawFloaters(dt: number, camX: number, camY: number): void {
    const ctx = this.ctx;
    this.floaters = this.floaters.filter((f) => (f.life -= dt) > 0);
    for (const f of this.floaters) {
      f.y -= 10 * dt;
      ctx.globalAlpha = Math.min(1, f.life);
      const w = pixelTextWidth(f.text);
      drawPixelText(ctx, f.text, Math.round(f.x - w / 2) - camX, Math.round(f.y) - camY, f.color, 1, PAL.ink);
    }
    ctx.globalAlpha = 1;
  }

  private drawLighting(s: GameState, camX: number, camY: number): void {
    const ctx = this.ctx;
    const dark = darkness(dayPhase(s));
    if (dark <= 0.01) return;
    ctx.fillStyle = `rgba(16,12,52,${dark})`;
    ctx.fillRect(0, 0, this.viewW, this.viewH);
    if (dark < 0.22) return;
    ctx.globalCompositeOperation = 'lighter';
    const blinkOn = Math.floor(this.clock * 2) % 2 === 0;
    for (const b of s.buildings) {
      if (b.built < 1) continue;
      const sp = buildingSprite(b.type);
      const bx = b.x * TILE + sp.ox - camX;
      const by = b.y * TILE + sp.oy - camY;
      if (bx > this.viewW || by > this.viewH || bx + sp.canvas.width < 0 || by + sp.canvas.height < 0) continue;
      for (const l of sp.lights) {
        if (l.blink && !blinkOn) continue;
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = l.color;
        ctx.fillRect(bx + l.x - 2, by + l.y - 2, 6, 6);
        ctx.globalAlpha = 0.9;
        ctx.fillRect(bx + l.x, by + l.y, 2, 2);
      }
    }
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = PAL.lime;
    for (const bot of s.bots) ctx.fillRect(Math.round(bot.x) - 2 - camX, Math.round(bot.y) - 5 - camY, 4, 1);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawSmog(s: GameState, reducedMotion: boolean): void {
    const ctx = this.ctx;
    const p = s.pollution / 100;
    if (p > 0.2) {
      const a = Math.pow(p, 1.6) * 0.42;
      ctx.fillStyle = `rgba(110,84,48,${a})`;
      ctx.fillRect(0, 0, this.viewW, this.viewH);
      ctx.fillStyle = `rgba(150,120,80,${a * 0.5})`;
      for (let k = 0; k < 5; k++) {
        const off = reducedMotion ? 0 : (this.clock * (6 + k * 2)) % (this.viewW + 200);
        const y = ((k * 53) % this.viewH) + Math.sin(this.clock * 0.2 + k) * 6;
        ctx.fillRect(Math.round(off - 200), Math.round(y), 260, 10 + k * 3);
      }
    }
    if (s.smog > 0) {
      const a = 0.15 + 0.15 * Math.sin(this.clock * 6);
      ctx.strokeStyle = `rgba(226,54,75,${a + 0.2})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(1.5, 1.5, this.viewW - 3, this.viewH - 3);
      ctx.lineWidth = 1;
    }
  }

  private drawBlimp(dt: number, reducedMotion: boolean): void {
    const bl = this.blimp;
    if (bl.timer > 0) {
      bl.timer -= dt;
      return;
    }
    bl.x += dt * (reducedMotion ? 30 : 14);
    if (bl.x > this.viewW + 60) {
      bl.x = -80;
      bl.timer = 35 + Math.random() * 30;
      return;
    }
    const ctx = this.ctx;
    const x = Math.round(bl.x);
    const y = Math.round(this.viewH * 0.16 + Math.sin(bl.x / 30) * 2);
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(x - 1, y - 1, 38, 14);
    ctx.fillRect(x - 6, y + 2, 6, 8);
    ctx.fillStyle = PAL.white;
    ctx.fillRect(x, y, 36, 12);
    ctx.fillStyle = PAL.pink;
    ctx.fillRect(x, y, 36, 3);
    ctx.fillRect(x, y + 9, 36, 3);
    ctx.fillStyle = PAL.pinkD;
    ctx.fillRect(x - 5, y + 3, 5, 6);
    drawPixelText(ctx, '2PM', x + 12, y + 4, PAL.ink);
    ctx.fillStyle = PAL.purpleD;
    ctx.fillRect(x + 12, y + 13, 12, 3);
    ctx.fillStyle = 'rgba(236,232,246,0.5)';
    ctx.fillRect(x - 12 - Math.floor(this.clock * 8) % 4, y + 6, 4, 1);
  }
}

export function darkness(phase: number): number {
  // phase 0 = 06:00 dawn, 0.55 = 19:12 dusk, 0.78 = midnight
  if (phase < 0.55) return Math.max(0, 0.3 - Math.sin((phase / 0.55) * Math.PI) * 0.55);
  return 0.3 + 0.25 * Math.sin(((phase - 0.55) / 0.45) * Math.PI);
}
