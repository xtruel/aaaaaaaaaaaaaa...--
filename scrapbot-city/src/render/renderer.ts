// Isometric 2.5D renderer. The simulation grid is unchanged: this only decides how the world is drawn and
// which tile or building is under a screen point. Art comes from the generated atlas (npm run art).
//
// Layers: background → terrain cache (tiles, junk heaps, rubble) → shadows → ground marks → depth-sorted
// objects (buildings, bots, cat) → particles → placement preview → night glow → smog → floating text → blimp.
import { BUILDINGS, MAP_H, MAP_W, T, TILE } from '../game/defs';
import type { BuildingType } from '../game/defs';
import { placeCheck } from '../game/actions';
import { dayPhase } from '../game/sim';
import { idx, inBounds } from '../game/state';
import type { Bot, Building, FxEvent, GameState } from '../game/state';
import { hash2 } from '../game/world';
import { t } from '../i18n';
import { drawPixelText, pixelTextWidth } from './pixelfont';
import { PAL } from './sprites';
import { atlasImage, buildingArt, citizenVariants, decorArt, frame, opaqueAt, whenAtlasReady } from './iso/atlas';
import type { Frame } from './iso/atlas';
import { DepthSorter } from './iso/depth';
import type { DepthItem } from './iso/depth';
import { groundAt, tileAt, tileTop } from './iso/projection';
import { Walkers, isRoadCol, isRoadRow, placeScenery, ringKey } from './iso/life';
import type { SceneryItem } from './iso/life';

interface Particle {
  x: number; // iso px
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
  hoverId?: number;
  reducedMotion: boolean;
}

interface BotVis {
  z: number;
  lx: number;
  ly: number;
  dir: number; // 0 sw, 1 se, 2 ne, 3 nw
  seen: number;
}

interface Drawn {
  kind: number;
  ref: number; // building or bot id
  index: number; // position in s.buildings / s.bots this frame
  f: Frame | null;
  sx: number; // iso px of the frame's top-left corner
  sy: number;
  w: number;
  h: number;
}

const RING = 6; // decorative tiles around the playable map
const SPILL = 24; // how far a ground prop may rise above its tile
const EDGE = 18; // depth of the slab side under the map
const BOT_DIRS = ['sw', 'se', 'ne', 'nw'] as const;
const ALWAYS_ANIMATED = new Set<BuildingType>(['hq', 'dock', 'pods', 'garden', 'spire']);

const K_BUILDING = 1;
const K_BOT = 2;
const K_CAT = 3;
const K_WALKER = 4;
const K_DECOR = 5;


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

function isWorking(s: GameState, b: Building): boolean {
  if (b.built < 1 || b.paused) return false;
  if (b.type === 'solar') return dayPhase(s) < 0.58 && s.derived.efficiency > 0;
  if (b.type === 'burner') return b.fuel > 0;
  return b.status === 'ok';
}

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  zoom = 3;
  cam = { x: 0, y: 0 }; // top-left of the view, in iso pixels
  viewW = 0;
  viewH = 0;
  private dpr = 1;
  private scale = 3;
  private clock = 0;
  private particles: Particle[] = [];
  private floaters: Floater[] = [];
  private blimp = { x: 0, y: 0, active: false, timer: 20 };
  private shake = 0; // seconds of camera shake left (demolition, storms)
  private walkers = new Walkers();
  private scenery: SceneryItem[] = [];
  private sceneryTaken = new Set<number>();
  private catVis = { lx: 0, ly: 0, dir: 0 };
  // buildings seen last frame, to animate the ones that disappear (demolished)
  private known = new Map<number, { type: BuildingType; x: number; y: number; built: number }>();
  private seen = new Set<number>();
  private collapsing: { type: BuildingType; x: number; y: number; t: number }[] = [];

  // terrain cache
  private terrain: HTMLCanvasElement;
  private tctx: CanvasRenderingContext2D;
  private tox: number; // iso coords of the cache's top-left pixel
  private toy: number;
  private terrainState: GameState | null = null;
  private terrainPainted = false;

  // shadows are drawn opaque into their own layer, then blended once
  private shadow: HTMLCanvasElement;
  private sctx: CanvasRenderingContext2D;

  private sorter = new DepthSorter();
  private order: DepthItem[] = [];
  private drawn: Drawn[] = [];
  private drawnCount = 0;
  private bots = new Map<number, BotVis>();
  private tileHeight = new Float32Array(MAP_W * MAP_H);

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.tox = -(MAP_H + 2 * RING) * TILE;
    this.toy = -RING * TILE - SPILL;
    const w = (MAP_W + MAP_H + 4 * RING) * TILE;
    const h = ((MAP_W + MAP_H + 2 * RING) * TILE) / 2 + RING * TILE + SPILL + EDGE + 4;
    this.terrain = document.createElement('canvas');
    this.terrain.width = w;
    this.terrain.height = h;
    this.tctx = this.terrain.getContext('2d')!;
    this.tctx.imageSmoothingEnabled = false;
    this.shadow = document.createElement('canvas');
    this.sctx = this.shadow.getContext('2d')!;
    whenAtlasReady(() => {
      if (this.terrainState) this.paintAllTerrain(this.terrainState);
    });
  }

  // Each art pixel covers a whole number of device pixels, so the art stays crisp at 125% / 150% scaling too.
  get pxZoom(): number {
    return this.scale / this.dpr;
  }

  resize(): void {
    this.dpr = Math.max(1, window.devicePixelRatio || 1);
    this.scale = Math.max(1, Math.round(this.zoom * this.dpr));
    this.viewW = Math.ceil((window.innerWidth * this.dpr) / this.scale);
    this.viewH = Math.ceil((window.innerHeight * this.dpr) / this.scale);
    this.canvas.width = this.viewW;
    this.canvas.height = this.viewH;
    this.canvas.style.width = `${(this.viewW * this.scale) / this.dpr}px`;
    this.canvas.style.height = `${(this.viewH * this.scale) / this.dpr}px`;
    this.ctx.imageSmoothingEnabled = false;
    this.shadow.width = this.viewW;
    this.shadow.height = this.viewH;
    this.clampCam();
  }

  setZoom(z: number, screenX = window.innerWidth / 2, screenY = window.innerHeight / 2): void {
    const nz = Math.max(1, Math.min(5, z));
    if (nz === this.zoom) return;
    const ix = this.cam.x + screenX / this.pxZoom;
    const iy = this.cam.y + screenY / this.pxZoom;
    this.zoom = nz;
    this.resize();
    this.cam.x = ix - screenX / this.pxZoom;
    this.cam.y = iy - screenY / this.pxZoom;
    this.clampCam();
  }

  // Centre the view on a world point (ground level).
  centerOn(wx: number, wy: number): void {
    this.cam.x = wx - wy - this.viewW / 2;
    this.cam.y = (wx + wy) / 2 - this.viewH / 2;
    this.clampCam();
  }

  clampCam(): void {
    // the map diamond's bounding box in iso pixels, with a margin
    const x0 = -MAP_H * TILE;
    const x1 = MAP_W * TILE;
    const y0 = 0;
    const y1 = ((MAP_W + MAP_H) * TILE) / 2;
    const m = 64;
    if (this.viewW >= x1 - x0 + m * 2) this.cam.x = (x0 + x1 - this.viewW) / 2;
    else this.cam.x = Math.max(x0 - m, Math.min(x1 - this.viewW + m, this.cam.x));
    if (this.viewH >= y1 - y0 + m * 2) this.cam.y = (y0 + y1 - this.viewH) / 2;
    else this.cam.y = Math.max(y0 - m, Math.min(y1 - this.viewH + m, this.cam.y));
  }

  // Shift the camera by whole tiles (controller D-pad).
  panTiles(dx: number, dy: number): void {
    this.cam.x += (dx - dy) * TILE;
    this.cam.y += ((dx + dy) * TILE) / 2;
    this.clampCam();
  }

  // ---------- coordinates ----------

  // Ground point under a screen point (CSS px).
  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return groundAt(this.cam.x + sx / this.pxZoom, this.cam.y + sy / this.pxZoom);
  }

  screenToTile(sx: number, sy: number): { x: number; y: number } {
    return tileAt(this.cam.x + sx / this.pxZoom, this.cam.y + sy / this.pxZoom);
  }

  // Screen point (CSS px) of a world point.
  worldToScreen(wx: number, wy: number, wz = 0): { x: number; y: number } {
    return { x: (wx - wy - this.cam.x) * this.pxZoom, y: ((wx + wy) / 2 - wz - this.cam.y) * this.pxZoom };
  }

  tileToScreen(tx: number, ty: number): { x: number; y: number } {
    return this.worldToScreen((tx + 0.5) * TILE, (ty + 0.5) * TILE);
  }

  // The building drawn under a screen point (its visible pixels, nearest first), or -1.
  pickBuilding(sx: number, sy: number): number {
    const ix = Math.floor(this.cam.x + sx / this.pxZoom);
    const iy = Math.floor(this.cam.y + sy / this.pxZoom);
    for (let k = this.drawnCount - 1; k >= 0; k--) {
      const d = this.drawn[k];
      if (ix < d.sx || iy < d.sy || ix >= d.sx + d.w || iy >= d.sy + d.h) continue;
      if (d.f && !opaqueAt(d.f, ix - d.sx, iy - d.sy)) continue;
      if (d.kind === K_BUILDING) return d.ref;
      if (d.kind === K_CAT) return -2;
      return -1; // something else (a bot) is in front
    }
    return -1;
  }

  pickCat(sx: number, sy: number): boolean {
    return this.pickBuilding(sx, sy) === -2;
  }

  // Screen box (CSS px) covering a building's sprite.
  buildingScreenBox(b: Building): { left: number; top: number; right: number; bottom: number } {
    const f = frame(`b/${b.type}/off`);
    const top = tileTop(b.x, b.y);
    const ax = f ? f.ax : 0;
    const ay = f ? f.ay : 0;
    const w = f ? f.w : BUILDINGS[b.type].w * TILE * 2;
    const h = f ? f.h : BUILDINGS[b.type].h * TILE;
    const z = this.pxZoom;
    return { left: (top.X - ax - this.cam.x) * z, top: (top.Y - ay - this.cam.y) * z, right: (top.X - ax + w - this.cam.x) * z, bottom: (top.Y - ay + h - this.cam.y) * z };
  }

  // ---------- terrain cache ----------

  paintAllTerrain(s: GameState): void {
    this.terrainState = s;
    s.dirtyTiles.length = 0;
    if (!atlasImage()) {
      this.terrainPainted = false;
      return;
    }
    const sc = placeScenery(s.seed, RING, decorArt);
    this.scenery = sc.items;
    this.sceneryTaken = sc.taken;
    const ctx = this.tctx;
    ctx.clearRect(0, 0, this.terrain.width, this.terrain.height);
    const tx0 = -RING;
    const ty0 = -RING;
    const tx1 = MAP_W + RING - 1;
    const ty1 = MAP_H + RING - 1;
    for (let k = tx0 + ty0; k <= tx1 + ty1; k++) {
      for (let tx = Math.max(tx0, k - ty1); tx <= Math.min(tx1, k - ty0); tx++) this.paintGround(s, tx, k - tx);
    }
    this.paintMapBorder();
    for (let k = tx0 + ty0; k <= tx1 + ty1; k++) {
      for (let tx = Math.max(tx0, k - ty1); tx <= Math.min(tx1, k - ty0); tx++) this.paintProp(s, tx, k - tx);
    }
    // slab sides under the two front edges
    for (let tx = tx0; tx <= tx1; tx++) this.blitT(`t/edge/l/${(tx & 1) as 0 | 1}`, tx, ty1);
    for (let ty = ty0; ty <= ty1; ty++) this.blitT(`t/edge/r/${(ty & 1) as 0 | 1}`, tx1, ty);
    this.terrainPainted = true;
  }

  private blitT(name: string, tx: number, ty: number): void {
    const f = frame(name);
    const img = atlasImage();
    if (!f || !img) return;
    const top = tileTop(tx, ty);
    this.tctx.drawImage(img, f.x, f.y, f.w, f.h, top.X - f.ax - this.tox, top.Y - f.ay - this.toy, f.w, f.h);
  }

  private groundFrame(s: GameState, tx: number, ty: number): string {
    const inside = tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H;
    const h = hash2(tx, ty);
    if (!inside) {
      if (isRoadRow(ty) && tx >= -RING && tx < MAP_W + RING && (tx < 0 || tx >= MAP_W)) return isRoadCol(tx) ? 't/road/c' : 't/road/x';
      if (isRoadCol(tx) && (ty < 0 || ty >= MAP_H)) return 't/road/y';
      return `t/outer/${Math.floor(h * 4)}`;
    }
    const i = idx(tx, ty);
    const tile = s.tiles[i];
    if (tile === T.GRASS) return `t/grass/${Math.floor(h * 6)}`;
    if (tile === T.SLUDGE) {
      const same = (dx: number, dy: number) => inBounds(tx + dx, ty + dy) && s.tiles[idx(tx + dx, ty + dy)] === T.SLUDGE;
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
      for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) if ((x !== tx || y !== ty) && inBounds(x, y) && s.tiles[idx(x, y)] === kind) return true;
      return false;
    };
    // sidewalks along the old streets
    if (isRoadRow(ty - 1) || isRoadRow(ty + 1) || isRoadCol(tx - 1) || isRoadCol(tx + 1)) return `t/pave/${v}`;
    if (near(T.SLUDGE, 1)) return `t/mud/${v}`;
    if (near(T.JUNK, 1)) return `t/dirty/${v}`;
    const lot = valueNoise(tx / 7, ty / 7, 21);
    if (lot < 0.26) return `t/lot/${v}`;
    if (lot > 0.78) return `t/ind/${v}`;
    const n = valueNoise(tx / 5, ty / 5, 9);
    const fam = n < 0.38 ? 0 : n < 0.62 ? 1 : 2;
    return `t/ground/${fam}/${v}`;
  }

  private paintGround(s: GameState, tx: number, ty: number): void {
    // sludge pools show the ground at their very edge
    const inside = tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H;
    if (inside && s.tiles[idx(tx, ty)] === T.SLUDGE) {
      const n = valueNoise(tx / 5, ty / 5, 9);
      this.blitT(`t/ground/${n < 0.38 ? 0 : n < 0.62 ? 1 : 2}/0`, tx, ty);
    }
    this.blitT(this.groundFrame(s, tx, ty), tx, ty);
  }

  private paintProp(s: GameState, tx: number, ty: number): void {
    const inside = tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H;
    const h = hash2(tx, ty, 31);
    if (!inside) {
      // scattered scrap and rubble outside the fence (low props only on the front side)
      const behind = tx < 0 || ty < 0;
      const near = tx >= MAP_W ? tx - MAP_W : ty >= MAP_H ? ty - MAP_H : 99;
      if (isRoadRow(ty) || isRoadCol(tx) || this.sceneryTaken.has(ringKey(tx, ty, RING))) return;
      if (h > 0.9 && (behind || near >= 1)) this.blitT(`p/junk/${Math.floor(hash2(tx, ty, 32) * 3)}/${Math.floor(hash2(tx, ty, 33) * 4)}`, tx, ty);
      else if (h > 0.82) this.blitT(`p/rubble/${Math.floor(hash2(tx, ty, 34) * 4)}`, tx, ty);
      return;
    }
    const i = idx(tx, ty);
    const tile = s.tiles[i];
    if (tile === T.JUNK) {
      const amt = s.amount[i];
      const size = amt < 15 ? 0 : amt < 35 ? 1 : 2;
      this.blitT(`p/junk/${size}/${Math.floor(h * 4)}`, tx, ty);
    } else if (tile === T.RUBBLE) this.blitT(`p/rubble/${Math.floor(h * 4)}`, tx, ty);
  }

  // A thin dotted line around the playable area.
  private paintMapBorder(): void {
    const ctx = this.tctx;
    ctx.fillStyle = 'rgba(177,26,94,0.55)';
    const corner = (tx: number, ty: number) => tileTop(tx, ty);
    const a = corner(0, 0);
    const b = corner(MAP_W, 0);
    const c = corner(MAP_W, MAP_H);
    const d = corner(0, MAP_H);
    const run = (from: { X: number; Y: number }, steps: number, sx: number) => {
      for (let k = 0; k < steps; k++) if (k % 4 < 2) ctx.fillRect(from.X + sx * 2 * k - (sx < 0 ? 2 : 0) - this.tox, from.Y + k - this.toy, 2, 1);
    };
    run(a, (MAP_W * TILE) / 2, 1);
    run(d, (MAP_W * TILE) / 2, 1);
    run(a, (MAP_H * TILE) / 2, -1);
    run(b, (MAP_H * TILE) / 2, -1);
    void c;
  }

  private paintDirty(s: GameState): void {
    if (s.dirtyTiles.length === 0 || !this.terrainPainted) return;
    const ctx = this.tctx;
    const done = new Set<number>();
    for (const i of s.dirtyTiles) {
      if (done.has(i)) continue;
      done.add(i);
      const tx = i % MAP_W;
      const ty = Math.floor(i / MAP_W);
      // the tile and its 8 neighbours (their ground style depends on it), plus anything rising over them
      const top = tileTop(tx, ty);
      const rx = top.X - TILE * 3 - this.tox;
      const ry = top.Y - TILE - SPILL - this.toy;
      const rw = TILE * 6;
      const rh = TILE * 3 + SPILL;
      ctx.save();
      ctx.beginPath();
      ctx.rect(rx, ry, rw, rh);
      ctx.clip();
      ctx.clearRect(rx, ry, rw, rh);
      const near: [number, number][] = [];
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) near.push([tx + dx, ty + dy]);
      near.sort((p, q) => p[0] + p[1] - (q[0] + q[1]));
      for (const [x, y] of near) if (x >= -RING && y >= -RING && x < MAP_W + RING && y < MAP_H + RING) this.paintGround(s, x, y);
      this.paintMapBorder();
      for (const [x, y] of near) if (x >= -RING && y >= -RING && x < MAP_W + RING && y < MAP_H + RING) this.paintProp(s, x, y);
      ctx.restore();
    }
    s.dirtyTiles.length = 0;
  }

  // ---------- effects ----------

  onFx(fx: FxEvent): void {
    const X = fx.x - fx.y;
    const Y = (fx.x + fx.y) / 2;
    switch (fx.kind) {
      case 'collect':
        for (let k = 0; k < 6; k++) this.spawn(X, Y - 4, (Math.random() - 0.5) * 24, -12 - Math.random() * 16, 0.6, 1, k % 2 ? PAL.rust : PAL.concreteL, 0);
        break;
      case 'built':
      case 'placed':
        for (let k = 0; k < 22; k++) this.spawn(X + (Math.random() - 0.5) * 30, Y - Math.random() * 10, (Math.random() - 0.5) * 50, -Math.random() * 45, 0.9, 1, k % 3 === 0 ? PAL.white : k % 3 === 1 ? PAL.lime : PAL.sky, 0);
        for (let k = 0; k < 8; k++) this.spawn(X + (Math.random() - 0.5) * 36, Y + 4, (Math.random() - 0.5) * 20, -4 - Math.random() * 6, 1.4, 3, '#8f8a9e', 2.5);
        if (fx.text) this.float(X, Y - 40, fx.text, PAL.lime);
        break;
      case 'produce':
        if (fx.text) this.float(X, Y - 28, fx.text, fx.coins ? PAL.yellow : PAL.cyan);
        break;
      case 'clean':
        for (let k = 0; k < 10; k++) this.spawn(X, Y, (Math.random() - 0.5) * 20, -15 - Math.random() * 20, 1, 1, PAL.cyan, 0);
        this.float(X, Y - 10, t('fx.clean'), PAL.cyan);
        break;
      case 'demolish':
        this.shake = Math.max(this.shake, 0.25);
        for (let k = 0; k < 16; k++) this.spawn(X + (Math.random() - 0.5) * 30, Y - Math.random() * 20, (Math.random() - 0.5) * 44, -Math.random() * 34, 0.9, 2, k % 2 ? PAL.concrete : PAL.rust, 0);
        for (let k = 0; k < 10; k++) this.spawn(X + (Math.random() - 0.5) * 40, Y + 2, (Math.random() - 0.5) * 24, -3 - Math.random() * 8, 1.8, 4, '#77718a', 3);
        if (fx.text) this.float(X, Y - 16, fx.text, PAL.white);
        break;
      case 'storm':
        this.shake = Math.max(this.shake, 0.6);
        break;
    }
  }

  private spawn(x: number, y: number, vx: number, vy: number, life: number, size: number, color: string, grow: number): void {
    if (this.particles.length > 700) return;
    this.particles.push({ x, y, vx, vy, life, max: life, size, color, grow });
  }

  private float(x: number, y: number, text: string, color: string): void {
    this.floaters.push({ x, y, text, color, life: 1.4 });
  }

  // ---------- frame ----------

  render(s: GameState, view: ViewState, dt: number, simRunning: boolean): void {
    const ctx = this.ctx;
    this.clock += dt;
    ctx.fillStyle = '#0f0d18';
    ctx.fillRect(0, 0, this.viewW, this.viewH);
    const img = atlasImage();
    if (!img) return;
    if (!this.terrainPainted || this.terrainState !== s) this.paintAllTerrain(s);
    this.paintDirty(s);
    let camX = Math.round(this.cam.x);
    let camY = Math.round(this.cam.y);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      if (!view.reducedMotion) {
        const a = this.shake > 0.3 ? 2 : 1;
        camX += Math.round((Math.random() - 0.5) * 2 * a);
        camY += Math.round((Math.random() - 0.5) * 2 * a);
      }
    }
    this.trackRemovals(s, view.reducedMotion);

    ctx.drawImage(this.terrain, this.tox - camX, this.toy - camY);
    if (!view.reducedMotion) this.drawSludgeBubbles(s, camX, camY);
    this.drawBackScenery(camX, camY, img, view.reducedMotion);

    this.updateTileHeights(s);
    if (simRunning) this.walkers.update(s, dt, Math.max(1, citizenVariants()));
    this.updateBlimp(s, dt, simRunning && !view.reducedMotion);
    this.collect(s, view, camX, camY);
    this.drawShadows(s, camX, camY);
    this.drawGroundMarks(s, view, camX, camY);
    this.drawObjects(s, view, camX, camY, img);
    this.drawCollapsing(dt, camX, camY, img);
    this.drawBlimp(camX, camY, img);

    if (simRunning && !view.reducedMotion) this.emitAmbient(s, dt);
    this.updateParticles(dt, camX, camY, simRunning);
    if (view.hover && view.build) this.drawPlacement(s, view, camX, camY, img);
    this.drawSelection(s, view, camX, camY);

    this.drawLighting(s, camX, camY, img);
    this.drawSmog(s, view.reducedMotion);
    this.drawFloaters(dt, camX, camY);
  }

  private updateTileHeights(s: GameState): void {
    const th = this.tileHeight;
    th.fill(0);
    for (const b of s.buildings) {
      const def = BUILDINGS[b.type];
      const hgt = (buildingArt[b.type]?.height ?? 20) * Math.min(1, b.built);
      for (let y = b.y; y < b.y + def.h; y++) for (let x = b.x; x < b.x + def.w; x++) if (inBounds(x, y)) th[idx(x, y)] = hgt;
    }
  }

  private heightNear(wx: number, wy: number): number {
    const tx = Math.floor(wx / TILE);
    const ty = Math.floor(wy / TILE);
    let m = 0;
    for (let y = ty - 1; y <= ty + 1; y++) for (let x = tx - 1; x <= tx + 1; x++) if (inBounds(x, y)) m = Math.max(m, this.tileHeight[idx(x, y)]);
    return m;
  }

  // Build the list of visible objects with their world boxes, then sort them for drawing.
  private collect(s: GameState, view: ViewState, camX: number, camY: number): void {
    const sorter = this.sorter;
    sorter.begin();
    const vx0 = camX - 8;
    const vy0 = camY - 8;
    const vx1 = camX + this.viewW + 8;
    const vy1 = camY + this.viewH + 8;
    for (let k = 0; k < s.buildings.length; k++) {
      const b = s.buildings[k];
      const def = BUILDINGS[b.type];
      const f = frame(this.buildingFrameName(s, b));
      if (!f) continue;
      const top = tileTop(b.x, b.y);
      const sx = top.X - f.ax;
      const sy = top.Y - f.ay;
      if (sx > vx1 || sy > vy1 || sx + f.w < vx0 || sy + f.h < vy0) continue;
      const it = sorter.add();
      it.x0 = b.x * TILE;
      it.x1 = (b.x + def.w) * TILE;
      it.y0 = b.y * TILE;
      it.y1 = (b.y + def.h) * TILE;
      it.z0 = 0;
      it.z1 = Math.max(4, (buildingArt[b.type]?.height ?? 20) * Math.min(1, Math.max(0.15, b.built)));
      it.sx0 = sx;
      it.sy0 = sy;
      it.sx1 = sx + f.w;
      it.sy1 = sy + f.h;
      it.kind = K_BUILDING;
      it.ref = k;
    }
    // bots: altitude and heading are purely visual, kept here and never saved
    const now = this.clock;
    for (let k = 0; k < s.bots.length; k++) {
      const bot = s.bots[k];
      const vis = this.botVis(s, bot, now, view.reducedMotion);
      const X = bot.x - bot.y;
      const Y = (bot.x + bot.y) / 2 - vis.z;
      if (X + 12 < vx0 || X - 12 > vx1 || Y + 8 < vy0 || Y - 24 > vy1) continue;
      const it = sorter.add();
      it.x0 = bot.x - 4;
      it.x1 = bot.x + 4;
      it.y0 = bot.y - 4;
      it.y1 = bot.y + 4;
      it.z0 = vis.z;
      it.z1 = vis.z + 14;
      it.sx0 = X - 10;
      it.sy0 = Y - 20;
      it.sx1 = X + 10;
      it.sy1 = Y + 4;
      it.kind = K_BOT;
      it.ref = k;
    }
    if (this.bots.size > s.bots.length + 16) for (const [id, v] of this.bots) if (v.seen < now - 1) this.bots.delete(id);
    // Miso the cat
    {
      const cat = s.cat;
      const cv = this.catVis;
      const mx = cat.x - cv.lx;
      const my = cat.y - cv.ly;
      if (Math.abs(mx) + Math.abs(my) > 0.02) cv.dir = Math.abs(mx) > Math.abs(my) ? (mx > 0 ? 1 : 3) : my > 0 ? 0 : 2;
      cv.lx = cat.x;
      cv.ly = cat.y;
      const it = sorter.add();
      const X = cat.x - cat.y;
      const Y = (cat.x + cat.y) / 2;
      it.x0 = cat.x - 3;
      it.x1 = cat.x + 3;
      it.y0 = cat.y - 3;
      it.y1 = cat.y + 3;
      it.z0 = 0;
      it.z1 = 8;
      it.sx0 = X - 10;
      it.sy0 = Y - 14;
      it.sx1 = X + 10;
      it.sy1 = Y + 4;
      it.kind = K_CAT;
      it.ref = 0;
    }
    // citizens
    for (let k = 0; k < this.walkers.list.length; k++) {
      const w = this.walkers.list[k];
      const X = w.x - w.y;
      const Y = (w.x + w.y) / 2;
      if (X + 8 < vx0 || X - 8 > vx1 || Y + 4 < vy0 || Y - 20 > vy1) continue;
      const it = sorter.add();
      it.x0 = w.x - 2;
      it.x1 = w.x + 2;
      it.y0 = w.y - 2;
      it.y1 = w.y + 2;
      it.z0 = 0;
      it.z1 = 13;
      it.sx0 = X - 8;
      it.sy0 = Y - 18;
      it.sx1 = X + 8;
      it.sy1 = Y + 4;
      it.kind = K_WALKER;
      it.ref = k;
    }
    // scenery in front of the map
    for (let k = 0; k < this.scenery.length; k++) {
      const d = this.scenery[k];
      if (d.back) continue;
      const f = frame(`d/${d.name}/0`);
      if (!f) continue;
      const top = tileTop(d.tx, d.ty);
      const sx = top.X - f.ax;
      const sy = top.Y - f.ay;
      if (sx > vx1 || sy > vy1 || sx + f.w < vx0 || sy + f.h < vy0) continue;
      const it = sorter.add();
      it.x0 = d.tx * TILE;
      it.x1 = (d.tx + d.w) * TILE;
      it.y0 = d.ty * TILE;
      it.y1 = (d.ty + d.d) * TILE;
      it.z0 = 0;
      it.z1 = 12;
      it.sx0 = sx;
      it.sy0 = sy;
      it.sx1 = sx + f.w;
      it.sy1 = sy + f.h;
      it.kind = K_DECOR;
      it.ref = k;
    }
  }

  private botVis(s: GameState, bot: Bot, now: number, reduced: boolean): BotVis {
    let v = this.bots.get(bot.id);
    if (!v) {
      v = { z: 16, lx: bot.x, ly: bot.y, dir: 0, seen: now };
      this.bots.set(bot.id, v);
    }
    const dt = Math.min(0.1, Math.max(0, now - v.seen));
    v.seen = now;
    const mx = bot.x - v.lx;
    const my = bot.y - v.ly;
    if (Math.abs(mx) + Math.abs(my) > 0.05) v.dir = Math.abs(mx) > Math.abs(my) ? (mx > 0 ? 1 : 3) : my > 0 ? 0 : 2;
    v.lx = bot.x;
    v.ly = bot.y;
    const under = this.heightNear(bot.x, bot.y);
    let target = Math.max(16, under + 6);
    if (bot.state === 'collect') target = 4;
    else if (bot.state === 'toDrop') {
      const drop = s.buildings.find((b) => b.id === bot.target);
      if (drop) {
        const def = BUILDINGS[drop.type];
        const cx = (drop.x + def.w / 2) * TILE;
        const cy = (drop.y + def.h / 2) * TILE;
        if (Math.hypot(cx - bot.x, cy - 6 - bot.y) < 18) target = (buildingArt[drop.type]?.height ?? 20) * 0.55 + 2;
      }
    }
    const bob = reduced || bot.state === 'collect' ? 0 : Math.sin(bot.phase * 5) * 1.5;
    const speed = 40 * dt;
    v.z += Math.max(-speed, Math.min(speed, target + bob - v.z));
    return v;
  }

  private buildingFrameName(s: GameState, b: Building): string {
    const art = buildingArt[b.type];
    if (b.built < 1) return `b/${b.type}/c${Math.min(3, Math.floor(b.built * 4))}`;
    if (!art) return `b/${b.type}/off`;
    const animate = ALWAYS_ANIMATED.has(b.type) ? !b.paused : isWorking(s, b);
    if (!animate) return `b/${b.type}/off`;
    const f = Math.floor(this.clock * art.fps + b.id * 0.37) % art.frames;
    return `b/${b.type}/w${f}`;
  }

  private drawShadows(s: GameState, camX: number, camY: number): void {
    const img = atlasImage()!;
    const sc = this.sctx;
    sc.clearRect(0, 0, this.viewW, this.viewH);
    for (const b of s.buildings) {
      if (b.built < 0.5) continue;
      const f = frame(`b/${b.type}/shadow`);
      if (!f) continue;
      const top = tileTop(b.x, b.y);
      const x = top.X - f.ax - camX;
      const y = top.Y - f.ay - camY;
      if (x > this.viewW || y > this.viewH || x + f.w < 0 || y + f.h < 0) continue;
      sc.drawImage(img, f.x, f.y, f.w, f.h, x, y, f.w, f.h);
    }
    sc.fillStyle = '#080514';
    for (const bot of s.bots) {
      const v = this.bots.get(bot.id);
      const z = v ? v.z : 16;
      const X = Math.round(bot.x - bot.y) - camX;
      const Y = Math.round((bot.x + bot.y) / 2) - camY;
      const w = z > 12 ? 5 : 7;
      sc.fillRect(X - (w >> 1), Y - 1, w, 2);
      sc.fillRect(X - (w >> 1) + 1, Y - 2, w - 2, 4);
    }
    for (const w of this.walkers.list) {
      const X = Math.round(w.x - w.y) - camX;
      const Y = Math.round((w.x + w.y) / 2) - camY;
      sc.fillRect(X - 2, Y - 1, 5, 2);
    }
    if (this.blimp.active) {
      const X = Math.round(this.blimp.x - this.blimp.y) - camX;
      const Y = Math.round((this.blimp.x + this.blimp.y) / 2) - camY;
      sc.fillRect(X - 16, Y - 3, 32, 6);
      sc.fillRect(X - 12, Y - 5, 24, 10);
    }
    const dark = darkness(dayPhase(s));
    this.ctx.globalAlpha = Math.max(0.12, 0.34 - dark * 0.4);
    this.ctx.drawImage(this.shadow, 0, 0);
    this.ctx.globalAlpha = 1;
  }

  private drawSludgeBubbles(s: GameState, camX: number, camY: number): void {
    const ctx = this.ctx;
    const a = tileAt(camX, camY);
    const b = tileAt(camX + this.viewW, camY + this.viewH);
    const c = tileAt(camX + this.viewW, camY);
    const d = tileAt(camX, camY + this.viewH);
    const x0 = Math.max(0, a.x);
    const x1 = Math.min(MAP_W - 1, b.x);
    const y0 = Math.max(0, c.y);
    const y1 = Math.min(MAP_H - 1, d.y);
    ctx.fillStyle = '#d2ff8a';
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++) {
        if (s.tiles[idx(tx, ty)] !== T.SLUDGE) continue;
        const p = (this.clock * 0.8 + (tx * 0.37 + ty * 0.61)) % 1;
        if (p > 0.5) continue;
        const top = tileTop(tx, ty);
        const ox = ((tx * 5 + ty * 3) % 13) - 6;
        ctx.fillRect(top.X + ox - camX, top.Y + 9 - Math.floor(p * 6) - camY, 1, 1);
      }
  }

  // Footprint fills and outlines on the ground (pixel-exact, no anti-aliasing).
  private footprintRows(x0: number, y0: number, x1: number, y1: number, camX: number, camY: number, fn: (row: number, left: number, right: number, first: boolean, last: boolean) => void): void {
    // world rect [x0,x1)×[y0,y1) on the ground; iso rows from the top vertex to the bottom vertex
    const top = (x0 + y0) / 2;
    const bottom = (x1 + y1) / 2;
    for (let Y = Math.floor(top); Y < Math.ceil(bottom); Y++) {
      const yc = Y + 0.5;
      const lo = Math.max(2 * (x0 - yc), 2 * (yc - y1));
      const hi = Math.min(2 * (x1 - yc), 2 * (yc - y0));
      const pl = Math.ceil(lo - 0.5 + 1e-6);
      const pr = Math.floor(hi - 0.5 - 1e-6);
      if (pr < pl) continue;
      fn(Y - camY, pl - camX, pr - camX, Y === Math.floor(top), Y === Math.ceil(bottom) - 1);
    }
  }

  private fillFootprint(tx: number, ty: number, w: number, h: number, color: string, camX: number, camY: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    this.footprintRows(tx * TILE, ty * TILE, (tx + w) * TILE, (ty + h) * TILE, camX, camY, (y, l, r) => ctx.fillRect(l, y, r - l + 1, 1));
  }

  private outlineFootprint(tx: number, ty: number, w: number, h: number, color: string, camX: number, camY: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    this.footprintRows(tx * TILE, ty * TILE, (tx + w) * TILE, (ty + h) * TILE, camX, camY, (y, l, r, first, last) => {
      if (first || last) ctx.fillRect(l, y, r - l + 1, 1);
      else {
        ctx.fillRect(l, y, 2, 1);
        ctx.fillRect(r - 1, y, 2, 1);
      }
    });
  }

  private drawGroundMarks(s: GameState, view: ViewState, camX: number, camY: number): void {
    const selected = view.selectedId >= 0 ? s.buildings.find((b) => b.id === view.selectedId) : undefined;
    if (selected && BUILDINGS[selected.type].cleanRadius) this.drawRadius(selected.x, selected.y, selected.type, camX, camY);
    const h = view.hover;
    if (!h || view.build) return;
    if (view.hoverId !== undefined && view.hoverId >= 0) return; // the building itself gets highlighted
    if (!inBounds(h.x, h.y)) return;
    this.outlineFootprint(h.x, h.y, 1, 1, view.bulldoze ? PAL.red : 'rgba(236,232,246,0.6)', camX, camY);
  }

  private drawObjects(s: GameState, view: ViewState, camX: number, camY: number, img: HTMLImageElement): void {
    const ctx = this.ctx;
    const n = this.sorter.sort(this.order);
    this.drawnCount = 0;
    for (let k = 0; k < n; k++) {
      const it = this.order[k];
      if (it.kind === K_BUILDING) this.drawBuilding(s, s.buildings[it.ref], it.ref, camX, camY, img, view);
      else if (it.kind === K_BOT) this.drawBot(s.bots[it.ref], it.ref, camX, camY, img, view.reducedMotion);
      else if (it.kind === K_CAT) {
        const cat = s.cat;
        const walking = !cat.sitting;
        const fr = walking ? Math.floor(this.clock * 6) % 2 : 0;
        const f = frame(`cat/${BOT_DIRS[this.catVis.dir]}/${walking ? 'walk' : 'sit'}/${fr}`);
        if (!f) continue;
        const sx = Math.round(cat.x - cat.y) - f.ax;
        const sy = Math.round((cat.x + cat.y) / 2) - f.ay;
        ctx.drawImage(img, f.x, f.y, f.w, f.h, sx - camX, sy - camY, f.w, f.h);
        this.pushDrawn(K_CAT, 0, 0, f, sx, sy, f.w, f.h);
      } else if (it.kind === K_WALKER) {
        const w = this.walkers.list[it.ref];
        const f = frame(`cit/${w.variant}/${BOT_DIRS[w.dir]}/${view.reducedMotion ? 0 : Math.floor(this.clock * 4 + w.id) % 2}`);
        if (!f) continue;
        const sx = Math.round(w.x - w.y) - f.ax;
        const sy = Math.round((w.x + w.y) / 2) - f.ay;
        ctx.drawImage(img, f.x, f.y, f.w, f.h, sx - camX, sy - camY, f.w, f.h);
      } else if (it.kind === K_DECOR) {
        this.drawScenery(this.scenery[it.ref], camX, camY, img, view.reducedMotion);
      }
    }
  }

  private trackRemovals(s: GameState, reduced: boolean): void {
    const seen = this.seen;
    seen.clear();
    for (const b of s.buildings) {
      seen.add(b.id);
      const k = this.known.get(b.id);
      if (k) k.built = b.built;
      else this.known.set(b.id, { type: b.type, x: b.x, y: b.y, built: b.built });
    }
    if (this.known.size === seen.size) return;
    for (const [id, k] of this.known) {
      if (seen.has(id)) continue;
      this.known.delete(id);
      // a new game or a loaded save replaces the whole list: only animate single removals
      if (!reduced && this.terrainState === s && this.known.size > 0 && k.built >= 1) this.collapsing.push({ type: k.type, x: k.x, y: k.y, t: 0 });
    }
  }

  // A demolished building sinks into its plate in a cloud of dust.
  private drawCollapsing(dt: number, camX: number, camY: number, img: HTMLImageElement): void {
    if (!this.collapsing.length) return;
    const ctx = this.ctx;
    const DUR = 0.7;
    for (const c of this.collapsing) {
      c.t += dt;
      const f = frame(`b/${c.type}/off`);
      if (!f) continue;
      const def = BUILDINGS[c.type];
      const top = tileTop(c.x, c.y);
      const k = Math.min(1, c.t / DUR);
      const sink = Math.round(k * k * (f.ay + 4));
      const ground = f.ay + ((def.w + def.h) * TILE) / 2; // bottom vertex row
      const visible = Math.max(0, ground - sink);
      if (visible > 0) {
        const shake = Math.round(Math.sin(c.t * 60) * (1 - k) * 1.5);
        ctx.globalAlpha = 1 - k * 0.6;
        ctx.drawImage(img, f.x, f.y, f.w, visible, top.X - f.ax - camX + shake, top.Y - f.ay + sink - camY, f.w, visible);
        ctx.globalAlpha = 1;
      }
      if (Math.random() < 0.8) {
        const mid = top.X + ((def.w - def.h) * TILE) / 2;
        const y = top.Y + ((def.w + def.h) * TILE) / 4;
        this.spawn(mid + (Math.random() - 0.5) * def.w * 22, y + (Math.random() - 0.3) * 10, (Math.random() - 0.5) * 20, -4 - Math.random() * 10, 1.2, 3, '#857f96', 3);
      }
    }
    this.collapsing = this.collapsing.filter((c) => c.t < 0.7);
  }

  private drawScenery(d: SceneryItem, camX: number, camY: number, img: HTMLImageElement, reduced: boolean): void {
    const fr = d.frames > 1 && !reduced ? Math.floor(this.clock * d.fps + d.tx * 0.37 + d.ty * 0.61) % d.frames : 0;
    const f = frame(`d/${d.name}/${fr}`);
    if (!f) return;
    const top = tileTop(d.tx, d.ty);
    const x = top.X - f.ax - camX;
    const y = top.Y - f.ay - camY;
    if (x > this.viewW || y > this.viewH || x + f.w < 0 || y + f.h < 0) return;
    this.ctx.drawImage(img, f.x, f.y, f.w, f.h, x, y, f.w, f.h);
  }

  // Scenery behind the map never covers anything on it: drawn right after the ground.
  private drawBackScenery(camX: number, camY: number, img: HTMLImageElement, reduced: boolean): void {
    for (const d of this.scenery) if (d.back) this.drawScenery(d, camX, camY, img, reduced);
  }

  // The 2PM blimp crosses the sky now and then, high above everything, with its shadow on the ground.
  private updateBlimp(s: GameState, dt: number, running: boolean): void {
    const b = this.blimp;
    if (!running) return;
    if (!b.active) {
      b.timer -= dt;
      if (b.timer > 0) return;
      b.active = true;
      b.x = -RING * TILE - 80;
      b.y = (6 + Math.floor(hash2(Math.floor(this.clock), s.seed) * (MAP_H - 12))) * TILE;
      return;
    }
    b.x += dt * 14;
    if (b.x > (MAP_W + RING) * TILE + 80) {
      b.active = false;
      b.timer = 45 + hash2(Math.floor(this.clock), 3) * 40;
    }
  }

  private drawBlimp(camX: number, camY: number, img: HTMLImageElement): void {
    const b = this.blimp;
    if (!b.active) return;
    const f = frame(`blimp/${Math.floor(this.clock * 6) % 2}`);
    if (!f) return;
    const X = Math.round(b.x - b.y) - f.ax;
    const Y = Math.round((b.x + b.y) / 2 - 92) - f.ay;
    this.ctx.drawImage(img, f.x, f.y, f.w, f.h, X - camX, Y - camY, f.w, f.h);
  }

  private pushDrawn(kind: number, ref: number, index: number, f: Frame | null, sx: number, sy: number, w: number, h: number): void {
    let d = this.drawn[this.drawnCount];
    if (!d) {
      d = { kind, ref, index, f, sx, sy, w, h };
      this.drawn.push(d);
    } else {
      d.kind = kind;
      d.ref = ref;
      d.index = index;
      d.f = f;
      d.sx = sx;
      d.sy = sy;
      d.w = w;
      d.h = h;
    }
    this.drawnCount++;
  }

  private drawBuilding(s: GameState, b: Building, idxOf: number, camX: number, camY: number, img: HTMLImageElement, view: ViewState): void {
    const ctx = this.ctx;
    const f = frame(this.buildingFrameName(s, b));
    if (!f) return;
    const top = tileTop(b.x, b.y);
    const sx = top.X - f.ax;
    const sy = top.Y - f.ay;
    const x = sx - camX;
    const y = sy - camY;
    ctx.drawImage(img, f.x, f.y, f.w, f.h, x, y, f.w, f.h);
    this.pushDrawn(K_BUILDING, b.id, idxOf, f, sx, sy, f.w, f.h);
    if (b.built < 1) {
      // scaffolding frames come from the art; add the progress bar and a welding bot on the cut
      const def = BUILDINGS[b.type];
      const bw = 24;
      const bottom = top.Y + ((def.w + def.h) * TILE) / 2;
      const midX = top.X + ((def.w - def.h) * TILE) / 2;
      const bx = Math.round(midX - bw / 2) - camX;
      const by = Math.round(bottom) + 3 - camY;
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(bx - 1, by - 1, bw + 2, 4);
      ctx.fillStyle = PAL.lime;
      ctx.fillRect(bx, by, Math.max(1, Math.floor(bw * b.built)), 2);
      const wf = frame(`bot/sw/work/${Math.floor(this.clock * 6) % 2}`);
      const art = buildingArt[b.type];
      if (wf && art) {
        const stage = Math.min(3, Math.floor(b.built * 4));
        const zz = 3 + (art.height - 3) * ((stage + 1) / 4) + 2;
        const wy = (top.Y + bottom) / 2;
        ctx.drawImage(img, wf.x, wf.y, wf.w, wf.h, Math.round(midX - wf.ax) - camX, Math.round(wy - zz - wf.ay) - camY, wf.w, wf.h);
        if (!view.reducedMotion && Math.random() < 0.5) this.spawn(midX + (Math.random() - 0.5) * 8, wy - zz + 2, (Math.random() - 0.5) * 30, -Math.random() * 20, 0.35, 1, Math.random() < 0.5 ? PAL.yellow : PAL.white, 0);
      }
      return;
    }
    // hover highlight: a soft white rim drawn by re-blitting the sprite brighter would cost a canvas; a marker is enough
    if (view.hoverId === b.id && view.selectedId !== b.id) {
      ctx.globalAlpha = 0.18;
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(img, f.x, f.y, f.w, f.h, x, y, f.w, f.h);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    if (b.status !== 'ok' && b.status !== 'idle') this.drawStatusIcon(b, x + Math.round(f.w / 2) - 3, y - 2);
    else if (b.paused) this.drawStatusIcon(b, x + Math.round(f.w / 2) - 3, y - 2);
  }

  private drawBot(bot: Bot, idxOf: number, camX: number, camY: number, img: HTMLImageElement, reduced: boolean): void {
    const v = this.bots.get(bot.id);
    if (!v) return;
    const pose = bot.state === 'collect' ? 'work' : bot.carry > 0 ? 'carry' : 'fly';
    const fr = reduced ? 0 : Math.floor(this.clock * (pose === 'work' ? 8 : 6) + bot.id) % 2;
    const name = `bot/${BOT_DIRS[v.dir]}/${pose}/${fr}`;
    const f = frame(name);
    if (!f) return;
    const X = Math.round(bot.x - bot.y);
    const Y = Math.round((bot.x + bot.y) / 2 - v.z);
    const sx = X - f.ax;
    const sy = Y - f.ay;
    this.ctx.drawImage(img, f.x, f.y, f.w, f.h, sx - camX, sy - camY, f.w, f.h);
    this.pushDrawn(K_BOT, bot.id, idxOf, f, sx, sy, f.w, f.h);
    if (pose === 'work' && !reduced && Math.random() < 0.3) this.spawn(X + (Math.random() - 0.5) * 6, Y + 2, (Math.random() - 0.5) * 24, -Math.random() * 18, 0.3, 1, Math.random() < 0.5 ? PAL.yellow : PAL.lime, 0);
  }

  private drawStatusIcon(b: Building, x: number, y: number): void {
    const ctx = this.ctx;
    if (Math.floor(this.clock * 2) % 2 === 1) return;
    const color = b.paused ? PAL.steelLL : b.status === 'noPower' ? PAL.yellow : b.status === 'noFuel' ? PAL.orange : PAL.red;
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(x - 1, y - 1, 7, 7);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 5, 5);
    ctx.fillStyle = PAL.ink;
    if (b.paused) {
      ctx.fillRect(x + 1, y + 1, 1, 3);
      ctx.fillRect(x + 3, y + 1, 1, 3);
    } else {
      ctx.fillRect(x + 2, y + 1, 1, 2);
      ctx.fillRect(x + 2, y + 4, 1, 1);
    }
  }

  private drawRadius(tx: number, ty: number, type: BuildingType, camX: number, camY: number): void {
    const def = BUILDINGS[type];
    const r = (def.cleanRadius ?? 0) * TILE;
    const cx = (tx + def.w / 2) * TILE;
    const cy = (ty + def.h / 2) * TILE;
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(66,226,210,0.7)';
    const steps = 72;
    for (let k = 0; k < steps; k++) {
      const a = (k / steps) * Math.PI * 2 + this.clock * 0.3;
      const wx = cx + Math.cos(a) * r;
      const wy = cy + Math.sin(a) * r;
      ctx.fillRect(Math.round(wx - wy) - camX, Math.round((wx + wy) / 2) - camY, 1, 1);
    }
  }

  private drawPlacement(s: GameState, view: ViewState, camX: number, camY: number, img: HTMLImageElement): void {
    const ctx = this.ctx;
    const h = view.hover!;
    const type = view.build!;
    const def = BUILDINGS[type];
    const ox = h.x - Math.floor((def.w - 1) / 2);
    const oy = h.y - Math.floor((def.h - 1) / 2);
    const check = placeCheck(s, type, ox, oy);
    for (let dy = 0; dy < def.h; dy++)
      for (let dx = 0; dx < def.w; dx++) {
        const tx = ox + dx;
        const ty = oy + dy;
        const okTile = inBounds(tx, ty) && s.occ[idx(tx, ty)] === -1 && (s.tiles[idx(tx, ty)] === T.GROUND || s.tiles[idx(tx, ty)] === T.GRASS);
        this.fillFootprint(tx, ty, 1, 1, okTile ? (check.ok ? 'rgba(198,244,50,0.35)' : 'rgba(255,212,64,0.35)') : 'rgba(226,54,75,0.5)', camX, camY);
      }
    const f = frame(`b/${type}/off`);
    if (f) {
      const top = tileTop(ox, oy);
      ctx.globalAlpha = check.ok ? 0.7 : 0.45;
      ctx.drawImage(img, f.x, f.y, f.w, f.h, top.X - f.ax - camX, top.Y - f.ay - camY, f.w, f.h);
      ctx.globalAlpha = 1;
    }
    this.outlineFootprint(ox, oy, def.w, def.h, check.ok ? PAL.lime : PAL.yellow, camX, camY);
    if (def.cleanRadius) this.drawRadius(ox, oy, type, camX, camY);
    if (!check.ok && check.reason) {
      const text = check.reason;
      const w = pixelTextWidth(text);
      const top = tileTop(ox, oy);
      const fh = f ? f.ay : 40;
      const lx = Math.round(top.X - w / 2) - camX;
      const ly = Math.round(top.Y - fh - 12) - camY;
      ctx.fillStyle = 'rgba(13,11,22,0.85)';
      ctx.fillRect(lx - 2, ly - 2, w + 4, 9);
      drawPixelText(ctx, text, lx, ly, PAL.red);
    }
  }

  private drawSelection(s: GameState, view: ViewState, camX: number, camY: number): void {
    if (view.selectedId < 0) return;
    const b = s.buildings.find((o) => o.id === view.selectedId);
    if (!b) return;
    const def = BUILDINGS[b.type];
    if (Math.floor(this.clock * 3) % 3 !== 2) this.outlineFootprint(b.x, b.y, def.w, def.h, view.bulldoze ? PAL.red : PAL.lime, camX, camY);
    // a bouncing marker over the roof
    const f = frame(`b/${b.type}/off`);
    if (!f) return;
    const top = tileTop(b.x, b.y);
    const mx = Math.round(top.X + ((def.w - def.h) * TILE) / 2) - camX;
    const my = Math.round(top.Y - f.ay - 6 + Math.sin(this.clock * 5) * 2) - camY;
    const ctx = this.ctx;
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(mx - 4, my - 1, 9, 4);
    ctx.fillRect(mx - 3, my + 3, 7, 1);
    ctx.fillRect(mx - 2, my + 4, 5, 1);
    ctx.fillRect(mx - 1, my + 5, 3, 1);
    ctx.fillStyle = view.bulldoze ? PAL.red : PAL.lime;
    ctx.fillRect(mx - 3, my, 7, 2);
    ctx.fillRect(mx - 2, my + 2, 5, 1);
    ctx.fillRect(mx - 1, my + 3, 3, 1);
    ctx.fillRect(mx, my + 4, 1, 1);
  }

  private emitAmbient(s: GameState, dt: number): void {
    for (const b of s.buildings) {
      if (b.built < 1) continue;
      const art = buildingArt[b.type];
      if (!art) continue;
      const working = isWorking(s, b);
      const top = tileTop(b.x, b.y);
      const smoke = art.points.smoke;
      if (working && smoke && Math.random() < dt * 6) {
        const p = smoke[Math.floor(Math.random() * smoke.length)];
        const dirty = s.pollution > 60 ? '#4a3c32' : '#6d6878';
        this.spawn(top.X + p[0], top.Y + p[1], 4 + Math.random() * 6, -8 - Math.random() * 6, 2.6, 2, dirty, 1.4);
      }
      const spark = art.points.spark;
      if (working && spark && Math.random() < dt * 3) {
        const p = spark[0];
        this.spawn(top.X + p[0] + (Math.random() - 0.5) * 6, top.Y + p[1], (Math.random() - 0.5) * 10, -12 - Math.random() * 8, 0.8, 1, PAL.lime, 0);
      }
      if (b.type === 'purifier' && s.derived.efficiency > 0 && Math.random() < dt * 2) {
        const def = BUILDINGS[b.type];
        this.spawn(top.X + ((def.w - def.h) * TILE) / 2, top.Y - (art.height - 4), (Math.random() - 0.5) * 6, -10, 1.2, 1, PAL.cyan, 0);
      }
      if (b.type === 'garden' && s.pollution < 50 && Math.random() < dt * 0.4) {
        this.spawn(top.X, top.Y + 2, 6, 4, 2, 1, PAL.greenL, 0);
      }
    }
  }

  private updateParticles(dt: number, camX: number, camY: number, running: boolean): void {
    const ctx = this.ctx;
    const k = running ? dt : 0;
    let w = 0;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.life -= k;
      if (p.life <= 0) continue;
      this.particles[w++] = p;
    }
    this.particles.length = w;
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
    let w = 0;
    for (let i = 0; i < this.floaters.length; i++) {
      const f = this.floaters[i];
      f.life -= dt;
      if (f.life > 0) this.floaters[w++] = f;
    }
    this.floaters.length = w;
    for (const f of this.floaters) {
      f.y -= 10 * dt;
      ctx.globalAlpha = Math.min(1, f.life);
      const tw = pixelTextWidth(f.text);
      drawPixelText(ctx, f.text, Math.round(f.x - tw / 2) - camX, Math.round(f.y) - camY, f.color, 1, PAL.ink);
    }
    ctx.globalAlpha = 1;
  }

  private drawLighting(s: GameState, camX: number, camY: number, img: HTMLImageElement): void {
    const ctx = this.ctx;
    const dark = darkness(dayPhase(s));
    if (dark <= 0.01) return;
    ctx.fillStyle = `rgba(16,12,52,${dark})`;
    ctx.fillRect(0, 0, this.viewW, this.viewH);
    if (dark < 0.2) return;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, (dark - 0.15) * 2.2);
    const blinkOn = Math.floor(this.clock * 2) % 2 === 0;
    for (let k = 0; k < this.drawnCount; k++) {
      const d = this.drawn[k];
      if (d.kind !== K_BUILDING || !d.f) continue;
      const b = s.buildings[d.index];
      if (!b || b.id !== d.ref || b.built < 1) continue;
      const g = frame(`${this.buildingFrameName(s, b)}/g`);
      if (g) ctx.drawImage(img, g.x, g.y, g.w, g.h, d.sx - camX, d.sy - camY, g.w, g.h);
      // blinking beacons from the model's light points
      const art = buildingArt[b.type];
      if (blinkOn && art?.points.light) {
        const top = tileTop(b.x, b.y);
        ctx.fillStyle = PAL.red;
        for (const p of art.points.light) ctx.fillRect(top.X + p[0] - 2 - camX, top.Y + p[1] - 2 - camY, 4, 4);
      }
    }
    for (let k = 0; k < this.drawnCount; k++) {
      const d = this.drawn[k];
      if (d.kind !== K_BOT || !d.f) continue;
      const bot = s.bots[d.index];
      const v = bot && bot.id === d.ref ? this.bots.get(bot.id) : undefined;
      if (!bot || !v) continue;
      const pose = bot.state === 'collect' ? 'work' : bot.carry > 0 ? 'carry' : 'fly';
      const g = frame(`bot/${BOT_DIRS[v.dir]}/${pose}/0/g`);
      if (g) ctx.drawImage(img, g.x, g.y, g.w, g.h, d.sx - camX, d.sy - camY, g.w, g.h);
    }
    for (const d of this.scenery) {
      const fr = d.frames > 1 ? Math.floor(this.clock * d.fps + d.tx * 0.37 + d.ty * 0.61) % d.frames : 0;
      const g = frame(`d/${d.name}/${fr}/g`);
      if (!g) continue;
      const top = tileTop(d.tx, d.ty);
      const x = top.X - g.ax - camX;
      const y = top.Y - g.ay - camY;
      if (x > this.viewW || y > this.viewH || x + g.w < 0 || y + g.h < 0) continue;
      ctx.drawImage(img, g.x, g.y, g.w, g.h, x, y, g.w, g.h);
    }
    if (this.blimp.active) {
      const g = frame(`blimp/${Math.floor(this.clock * 6) % 2}/g`);
      if (g) ctx.drawImage(img, g.x, g.y, g.w, g.h, Math.round(this.blimp.x - this.blimp.y) - g.ax - camX, Math.round((this.blimp.x + this.blimp.y) / 2 - 92) - g.ay - camY, g.w, g.h);
    }
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

}

export function darkness(phase: number): number {
  // phase 0 = 06:00 dawn, 0.55 = 19:12 dusk, 0.78 = midnight
  if (phase < 0.55) return Math.max(0, 0.3 - Math.sin((phase / 0.55) * Math.PI) * 0.55);
  return 0.3 + 0.25 * Math.sin(((phase - 0.55) / 0.45) * Math.PI);
}
