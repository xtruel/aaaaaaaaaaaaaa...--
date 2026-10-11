// Isometric 2.5D renderer. The simulation grid is unchanged: this only decides how the world is drawn and
// which tile or building is under a screen point. Art comes from the generated atlas (npm run art).
//
// Layers: background → terrain cache (tiles, industrial floors, junk heaps, rubble) → shadows → ground marks →
// depth-sorted objects (buildings, fences/gates/lamps, bots, cat) → particles → placement preview → night glow →
// smog → floating text → blimp.
import { BUILDINGS, MAP_H, MAP_W, T, TILE } from '../game/defs';
import type { BuildingType, Cost, Resource } from '../game/defs';
import { costText, placeCheck } from '../game/actions';
import type { PlaceCheck } from '../game/actions';
import { MODULES, PIECES, fenceMask, installedModules, isModuleKind, isPieceKind, moduleCheck, pieceCheck, solidKind } from '../game/pieces';
import type { CatalogKind, ModuleKind, PieceKind, SolidKind } from '../game/pieces';
import { dayPhase } from '../game/sim';
import { idx, inBounds } from '../game/state';
import type { Bot, Building, FxEvent, GameState } from '../game/state';
import { hash2 } from '../game/world';
import { t } from '../i18n';
import { drawPixelText, pixelTextWidth } from './pixelfont';
import { PAL } from './sprites';
import { atlasImage, buildingArt, citizenVariants, cityTheme, decorArt, frame, opaqueAt, themeArt, themedFrame, variantArt, variantKey, whenAtlasReady } from './iso/atlas';
import type { BuildingArtMeta, Frame } from './iso/atlas';
import { DepthSorter } from './iso/depth';
import type { DepthItem } from './iso/depth';
import { groundAt, tileAt, tileTop } from './iso/projection';
import { Walkers, isCanal, isRoadCol, isRoadRow, placeScenery, ringKey } from './iso/life';
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
  img: HTMLCanvasElement; // the outlined text, drawn once (see textSprite)
  life: number;
}

const MAX_FLOATERS = 48;

export interface ViewState {
  hover: { x: number; y: number } | null;
  build: BuildingType | null;
  bulldoze: boolean;
  selectedId: number;
  hoverId?: number;
  reducedMotion: boolean;
  // modular building: the catalog tool, the selected fence/gate/lamp/floor (tile index, -1 none), the tiles of a row
  // being dragged, and the text the interface wants next to the ghost (a module's effect; shown while the piece or
  // module can go there, else the core's reason is shown); left out = none
  piece?: { kind: CatalogKind; rot: number } | null;
  selectedPiece?: number;
  pieceRow?: { x: number; y: number }[] | null;
  pieceLabel?: string | null;
}

interface BotVis {
  z: number;
  carry: number; // last carried amount, to notice an unload
  lx: number;
  ly: number;
  dir: number; // 0 sw, 1 se, 2 ne, 3 nw
  seen: number;
}

interface Drawn {
  kind: number;
  ref: number; // building or bot id, tile index of a piece
  index: number; // position in s.buildings / s.bots this frame (a piece: its tile index)
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
const K_LAMP = 6;
const K_PIECE = 7;
const POOL = [5, 10, 14, 16, 14, 10, 5]; // half-widths of a lamp's light pool, row by row
// The light of a city without a theme (atlas.ts ThemeArtMeta.light): no daylight multiply ('' or 'r,g,b'), the night
// veil's colour, a factor on its opacity.
const GAME_LIGHT = { day: '', veil: '16,12,52', dark: 1 };

// Player-built pieces (0.7): how tall the solid ones stand (voxels; draw order, bots fly over them), and their
// frames: a fence by the mask of its fence/gate neighbours (alone: along x or y by its rotation), a gate by its
// rotation (0 along x, 1 along y), a lamp by the direction of its arm (0 +x, 1 +y, 2 −x, 3 −y).
const PIECE_H: Record<SolidKind, number> = { fence: 10, gate: 12, lamp: 22 };
const PIECE_REACH = 64; // no piece's sprite or shadow reaches this far (px) from its tile: farther off-view ones are skipped early
const FENCE_FRAMES = Array.from({ length: 16 }, (_, mask) => `pc/fence/${mask}`);
const GATE_FRAMES = ['pc/gate/x', 'pc/gate/y'];
const LAMP_FRAMES = [0, 1, 2, 3].map((dir) => `pc/lamp/${dir}`);
const FLOOR_FRAMES = [0, 1, 2, 3].map((k) => `t/floor/${k}`);
const GHOST_OK = 'rgba(198,244,50,0.35)';
const GHOST_BAD = 'rgba(226,54,75,0.5)';

function pieceFrameOf(kind: SolidKind, rot: number, mask: number): string {
  if (kind === 'fence') return mask ? FENCE_FRAMES[mask] : rot & 1 ? 'pc/fence/y' : 'pc/fence/x';
  if (kind === 'gate') return GATE_FRAMES[rot & 1];
  return LAMP_FRAMES[rot & 3];
}

// Which of the four plates a floor tile shows: fixed per tile, so a laid floor looks like its preview.
function floorFrameOf(tx: number, ty: number): string {
  return FLOOR_FRAMES[Math.floor(hash2(tx, ty, 47) * 4)];
}

// A floor shows unless something covers it: a building standing on it, or junk, sludge or rubble on the tile.
function floorShown(s: GameState, i: number): boolean {
  return s.floor[i] !== 0 && s.occ[i] === -1 && (s.tiles[i] === T.GROUND || s.tiles[i] === T.GRASS);
}

// The old streets' lamps stand on their curb tiles until a building, junk or a player's piece takes the tile.
function streetLampShown(s: GameState, tx: number, ty: number): boolean {
  if (!inBounds(tx, ty)) return true;
  const i = idx(tx, ty);
  return s.occ[i] === -1 && s.solid[i] === 0 && s.tiles[i] === T.GROUND;
}

// Can the resources pay `n` times this cost? (a dragged row is paid tile by tile)
function affords(res: Record<Resource, number>, cost: Cost, n: number): boolean {
  return (Object.keys(cost) as Resource[]).every((r) => res[r] >= (cost[r] ?? 0) * n);
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

// Frame names per building type (or variant with modules, e.g. 'dock+dockStorage'), built once: the renderer asks
// for them several times per building per frame.
interface BuildingNames {
  c: string[];
  off: string;
  w: string[];
  shadow: string;
}
const buildingNames = new Map<string, BuildingNames>();
function namesOf(type: string, frames: number): BuildingNames {
  let n = buildingNames.get(type);
  if (!n || n.w.length !== frames) {
    n = {
      c: [0, 1, 2, 3].map((k) => `b/${type}/c${k}`),
      off: `b/${type}/off`,
      w: Array.from({ length: frames }, (_, k) => `b/${type}/w${k}`),
      shadow: `b/${type}/shadow`,
    };
    buildingNames.set(type, n);
  }
  return n;
}

// The art a building is drawn with: the variant with its installed modules when the atlas has one, else its own
// type. Same frame size and anchor either way, so installing a module never moves the building. Cached per modules
// list (installing or removing a module gives the building a new list).
const artKeys = new WeakMap<readonly ModuleKind[], string>();
function artKey(b: Building): string {
  const m = b.modules;
  if (!m || m.length === 0) return b.type;
  let k = artKeys.get(m);
  if (k === undefined) {
    const v = variantKey(b.type, m);
    k = variantArt[v] ? v : b.type;
    artKeys.set(m, k);
  }
  return k;
}
function artOf(b: Building): BuildingArtMeta | undefined {
  const k = artKey(b);
  return k === b.type ? buildingArt[b.type] : variantArt[k];
}
const glowNames = new Map<string, string>();
function glowOf(name: string): string {
  let g = glowNames.get(name);
  if (!g) {
    g = `${name}/g`;
    glowNames.set(name, g);
  }
  return g;
}
const shadowNames = new Map<string, string>();
function shadowOf(name: string): string {
  let g = shadowNames.get(name);
  if (!g) {
    g = `${name}/shadow`;
    shadowNames.set(name, g);
  }
  return g;
}

// What a catalog tool would lay on one tile this frame.
interface Ghost {
  x: number;
  y: number;
  ok: boolean;
  reason?: string;
}

// A module tool over a building: the building, whether the module fits its type, the check, and the art of the
// building with the module (null when no preview of it is drawn).
interface ModulePreview {
  b: Building;
  fits: boolean;
  check: PlaceCheck;
  ghost: string | null;
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
  private lamps: { tx: number; ty: number; axis: 'x' | 'y' }[] = [];
  // short flashes on buildings: a production cycle ends, construction completes
  private pulses: { x: number; y: number; id: number; t: number; dur: number; kind: 'produce' | 'built' }[] = [];
  // the area being placed or hovered: buildings in front of it are drawn see-through
  private focus: { x0: number; x1: number; y0: number; y1: number; sx0: number; sy0: number; sx1: number; sy1: number } | null = null;
  // adaptive quality: drops the costliest extras when frames get slow, restores them when it is fast again
  quality: 'high' | 'low' = 'high';
  private frameAvg = 16; // average interval between frames (ms)
  private workAvg = 2; // average time render() itself takes (ms)
  private displayMs = Infinity; // the display's own frame interval (a low percentile of recent intervals)
  private intervals = new Float32Array(120);
  private intervalCount = 0;
  private lastWork = 0;
  private slowFor = 0;
  private fastFor = 0;
  private walkers = new Walkers();
  private scenery: SceneryItem[] = [];
  private sceneryTaken = new Set<number>();
  private catVis = { lx: 0, ly: 0, dir: 0 };
  // buildings seen last frame, to animate the ones that disappear (demolished); key: the art they were drawn with
  private known = new Map<number, { type: BuildingType; key: string; x: number; y: number; built: number }>();
  private seen = new Set<number>();
  private collapsing: { type: BuildingType; key: string; x: number; y: number; t: number }[] = [];
  // pieces as they were at the end of the last frame: one laid or removed since then gets a light effect
  private lastSolid = new Uint8Array(MAP_W * MAP_H);
  private lastFloor = new Uint8Array(MAP_W * MAP_H);
  // the catalog tool this frame: the ghosts of the pieces it would lay, the tiles of those that fences join (real
  // fences next to them are drawn joined, as they will be), and the building a module tool points at
  private ghosts: Ghost[] = [];
  private ghostJoin = new Set<number>();
  private ghostRow = new Set<number>(); // every ghost of a fence or gate row: the refused ones join each other
  private ghostSeen = new Set<number>();
  private modulePreview: ModulePreview | null = null;
  private reduced = false; // reduced motion, this frame
  private pieceNames: string[] = new Array<string>(MAP_W * MAP_H).fill(''); // frame of each visible piece this frame

  // terrain cache
  private terrain: HTMLCanvasElement;
  private tctx: CanvasRenderingContext2D;
  private tox: number; // iso coords of the cache's top-left pixel
  private toy: number;
  private terrainState: GameState | null = null;
  private terrainPainted = false;
  // the city's theme (atlas.ts cityTheme), set with the terrain: its ground, its border scenery and its light
  private theme: string | null = null;
  private light = GAME_LIGHT;

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

  // Centre the view on a world point (ground level), in the part of the screen the HUD leaves free.
  centerOn(wx: number, wy: number): void {
    this.cam.x = wx - wy - this.viewW / 2;
    this.cam.y = (wx + wy) / 2 - this.freeMid();
    this.clampCam();
  }

  // Vertical middle (view px) of the screen between the top bar and the build toolbar.
  private freeMid(): number {
    return (this.insets.top / this.pxZoom + this.viewH - this.insets.bottom / this.pxZoom) / 2;
  }

  // Screen space covered by the HUD (CSS px), set by the session: the camera may scroll the map's edges
  // clear of the top bar and the build toolbar, so every tile can be shown over bare map.
  insets = { top: 0, bottom: 0 };
  // More of the HUD that words on the map keep clear of (screen rectangles, CSS px), set by the session: an open
  // side panel (the catalog stays open while a piece or module tool is in hand) and the goal card.
  labelAvoid: { left: number; top: number; right: number; bottom: number }[] = [];

  clampCam(): void {
    // The centre of the part of the screen the HUD leaves free may go anywhere over the map diamond's bounding box
    // (iso pixels) plus a margin: at every zoom the player can bring any edge of the map, and the scenery around
    // it, to the middle of the screen. (The map used to be locked in the centre whenever it nearly fitted.)
    const x0 = -MAP_H * TILE;
    const x1 = MAP_W * TILE;
    const y0 = 0;
    const y1 = ((MAP_W + MAP_H) * TILE) / 2;
    const m = 3 * TILE;
    const freeMid = this.freeMid();
    const cx = Math.max(x0 - m, Math.min(x1 + m, this.cam.x + this.viewW / 2));
    const cy = Math.max(y0 - m, Math.min(y1 + m, this.cam.y + freeMid));
    this.cam.x = cx - this.viewW / 2;
    this.cam.y = cy - freeMid;
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
      // bots, citizens, scenery and pieces never take a click here: what is behind them stays clickable (a fence
      // in front of a building does not hide it; pieces are found by pickPiece)
    }
    return -1;
  }

  // The fence, gate or lamp drawn under a screen point (its visible pixels, nearest first), else the tile under the
  // point when it holds a piece or a visible floor: its tile index, or -1. A building drawn in front of the point
  // covers what is behind it (pickBuilding is asked first).
  pickPiece(sx: number, sy: number): number {
    const ix = Math.floor(this.cam.x + sx / this.pxZoom);
    const iy = Math.floor(this.cam.y + sy / this.pxZoom);
    for (let k = this.drawnCount - 1; k >= 0; k--) {
      const d = this.drawn[k];
      if (ix < d.sx || iy < d.sy || ix >= d.sx + d.w || iy >= d.sy + d.h) continue;
      if (d.f && !opaqueAt(d.f, ix - d.sx, iy - d.sy)) continue;
      if (d.kind === K_PIECE) return d.ref;
      if (d.kind === K_BUILDING) return -1;
    }
    const s = this.terrainState;
    const tile = this.screenToTile(sx, sy);
    if (!s || !inBounds(tile.x, tile.y)) return -1;
    const i = idx(tile.x, tile.y);
    return s.solid[i] !== 0 || floorShown(s, i) ? i : -1;
  }

  // Screen box (CSS px) covering the piece on a tile: the sprite of a fence, gate or lamp, else the tile.
  pieceScreenBox(i: number): { left: number; top: number; right: number; bottom: number } {
    const tx = i % MAP_W;
    const ty = Math.floor(i / MAP_W);
    const top = tileTop(tx, ty);
    const z = this.pxZoom;
    const s = this.terrainState;
    const f = s && inBounds(tx, ty) && s.solid[i] !== 0 ? frame(this.pieceFrameName(s, tx, ty, i)) : undefined;
    if (f) return { left: (top.X - f.ax - this.cam.x) * z, top: (top.Y - f.ay - this.cam.y) * z, right: (top.X - f.ax + f.w - this.cam.x) * z, bottom: (top.Y - f.ay + f.h - this.cam.y) * z };
    return { left: (top.X - TILE - this.cam.x) * z, top: (top.Y - this.cam.y) * z, right: (top.X + TILE - this.cam.x) * z, bottom: (top.Y + TILE - this.cam.y) * z };
  }

  // The frame of the fence, gate or lamp on a tile. A fence joins its fence and gate neighbours, and the ghosts of
  // the ones being laid next to it.
  private pieceFrameName(s: GameState, tx: number, ty: number, i: number): string {
    const kind = solidKind(s.solid[i]) ?? 'fence';
    if (kind !== 'fence') return pieceFrameOf(kind, s.rot[i], 0);
    return pieceFrameOf(kind, s.rot[i], this.joinMask(s, tx, ty, this.ghostJoin));
  }

  // fenceMask, plus the ghosts in `g` (tile indexes) next to the tile
  private joinMask(s: GameState, tx: number, ty: number, g: Set<number>): number {
    let m = fenceMask(s, tx, ty);
    if (g.size) {
      if (ty > 0 && g.has(idx(tx, ty - 1))) m |= 1;
      if (tx < MAP_W - 1 && g.has(idx(tx + 1, ty))) m |= 2;
      if (ty < MAP_H - 1 && g.has(idx(tx, ty + 1))) m |= 4;
      if (tx > 0 && g.has(idx(tx - 1, ty))) m |= 8;
    }
    return m;
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
    const theme = (this.theme = cityTheme(s.cityId));
    const look = theme ? themeArt[theme] : null;
    this.light = look ? { day: look.light.day.some((c) => c < 255) ? look.light.day.join(',') : '', veil: look.light.night.join(','), dark: look.light.dark } : GAME_LIGHT;
    const sc = placeScenery(s.seed, RING, decorArt, theme && look ? { id: theme, scenery: look.scenery, decor: look.decor } : null);
    this.scenery = sc.items;
    this.sceneryTaken = sc.taken;
    // street lamps every fifth tile on the curbs of the old streets (not on crossings, not on the canal):
    // enough to light the streets at night without a forest of poles by day
    this.lamps = [];
    for (let ty = -RING; ty < MAP_H + RING; ty++)
      for (let tx = -RING; tx < MAP_W + RING; tx++) {
        const row = isRoadRow(ty);
        const col = isRoadCol(tx);
        if (row === col || isCanal(tx, ty)) continue;
        if (row && ((tx % 5) + 5) % 5 === 2) this.lamps.push({ tx, ty, axis: 'x' });
        if (col && ((ty % 5) + 5) % 5 === 2) this.lamps.push({ tx, ty, axis: 'y' });
      }
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

  // Terrain cache only: a themed city paints its twin of every t/ frame it has one of.
  private blitT(name: string, tx: number, ty: number): void {
    const f = frame(themedFrame(name, this.theme));
    const img = atlasImage();
    if (!f || !img) return;
    const top = tileTop(tx, ty);
    this.tctx.drawImage(img, f.x, f.y, f.w, f.h, top.X - f.ax - this.tox, top.Y - f.ay - this.toy, f.w, f.h);
  }

  private groundFrame(s: GameState, tx: number, ty: number): string {
    const inside = tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H;
    const h = hash2(tx, ty);
    if (!inside) {
      if (isCanal(tx, ty)) {
        const mask = (isCanal(tx - 1, ty) ? 1 : 0) | (isCanal(tx + 1, ty) ? 2 : 0) | (isCanal(tx, ty - 1) ? 4 : 0) | (isCanal(tx, ty + 1) ? 8 : 0);
        return `t/water/${mask}`;
      }
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
    // industrial floor laid by the player; the tile is repainted (s.dirtyTiles) when a building goes up on it or
    // is demolished, and when junk lands on it or is collected
    if (inside && floorShown(s, idx(tx, ty))) this.blitT(floorFrameOf(tx, ty), tx, ty);
  }

  private paintProp(s: GameState, tx: number, ty: number): void {
    const inside = tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H;
    const h = hash2(tx, ty, 31);
    if (!inside) {
      // scattered scrap and rubble outside the fence (low props only on the front side)
      const behind = tx < 0 || ty < 0;
      const near = tx >= MAP_W ? tx - MAP_W : ty >= MAP_H ? ty - MAP_H : 99;
      if (isRoadRow(ty) || isRoadCol(tx) || isCanal(tx, ty) || this.sceneryTaken.has(ringKey(tx, ty, RING))) return;
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

  // The changed tiles are repainted together: each one's area is cleared, then everything that can reach into those
  // areas is painted once, in the same order as paintAllTerrain. A row of floors laid at once (or a storm's junk)
  // then costs about one repaint of the ground it covers, not one repaint per tile.
  private paintDirty(s: GameState): void {
    if (s.dirtyTiles.length === 0 || !this.terrainPainted) return;
    const ctx = this.tctx;
    const done = new Set<number>();
    const near = new Set<number>(); // tiles to paint, by (y + RING) * RING_W + x + RING
    const RING_W = MAP_W + 2 * RING;
    ctx.save();
    ctx.beginPath();
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
      ctx.clearRect(rx, ry, rw, rh);
      ctx.rect(rx, ry, rw, rh);
      for (let y = Math.max(-RING, ty - 4); y <= Math.min(MAP_H + RING - 1, ty + 4); y++)
        for (let x = Math.max(-RING, tx - 4); x <= Math.min(MAP_W + RING - 1, tx + 4); x++) near.add((y + RING) * RING_W + x + RING);
    }
    ctx.clip();
    const order = Array.from(near, (k) => [(k % RING_W) - RING, Math.floor(k / RING_W) - RING]);
    order.sort((p, q) => p[0] + p[1] - (q[0] + q[1]) || p[0] - q[0]);
    for (const [x, y] of order) this.paintGround(s, x, y);
    this.paintMapBorder();
    for (const [x, y] of order) this.paintProp(s, x, y);
    ctx.restore();
    s.dirtyTiles.length = 0;
  }

  // ---------- effects ----------

  onFx(fx: FxEvent): void {
    const X = fx.x - fx.y;
    const Y = (fx.x + fx.y) / 2;
    if (this.isPieceFx(fx)) {
      // a floor, fence, gate or lamp laid or removed: a dragged row lays dozens of them, so a small puff, no shake
      const laid = fx.kind === 'placed';
      for (let k = 0; k < 5; k++) this.spawn(X + (Math.random() - 0.5) * 14, Y - Math.random() * 6, (Math.random() - 0.5) * 24, -Math.random() * 22, 0.6, 1, laid ? (k % 2 ? PAL.white : PAL.lime) : k % 2 ? PAL.concrete : PAL.rust, 0);
      for (let k = 0; k < 2; k++) this.spawn(X + (Math.random() - 0.5) * 16, Y + 3, (Math.random() - 0.5) * 10, -2 - Math.random() * 4, 1, 2, '#8f8a9e', 1.5);
      if (fx.text) this.float(X, Y - 16, fx.text, PAL.white);
      return;
    }
    switch (fx.kind) {
      case 'collect':
        for (let k = 0; k < 6; k++) this.spawn(X, Y - 4, (Math.random() - 0.5) * 24, -12 - Math.random() * 16, 0.6, 1, k % 2 ? PAL.rust : PAL.concreteL, 0);
        break;
      case 'built':
      case 'placed':
        if (fx.kind === 'built') this.pulses.push({ x: fx.x, y: fx.y, id: -1, t: 0, dur: 0.7, kind: 'built' });
        for (let k = 0; k < 22; k++) this.spawn(X + (Math.random() - 0.5) * 30, Y - Math.random() * 10, (Math.random() - 0.5) * 50, -Math.random() * 45, 0.9, 1, k % 3 === 0 ? PAL.white : k % 3 === 1 ? PAL.lime : PAL.sky, 0);
        for (let k = 0; k < 8; k++) this.spawn(X + (Math.random() - 0.5) * 36, Y + 4, (Math.random() - 0.5) * 20, -4 - Math.random() * 6, 1.4, 3, '#8f8a9e', 2.5);
        if (fx.text) this.float(X, Y - 40, fx.text, PAL.lime);
        break;
      case 'produce':
        if (fx.text) this.float(X, Y - 28, fx.text, fx.coins ? PAL.yellow : PAL.cyan);
        // the sim reports the centre 10 units up: the building is the one under (x, y + 10)
        this.pulses.push({ x: fx.x, y: fx.y + 10, id: -1, t: 0, dur: 0.3, kind: 'produce' });
        for (let k = 0; k < 5; k++) this.spawn(X + (Math.random() - 0.5) * 14, Y - 20, (Math.random() - 0.5) * 10, -18 - Math.random() * 14, 0.7, 1, fx.coins ? PAL.yellow : PAL.cyan, 0);
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

  // Was this 'placed' / 'demolish' effect a piece laid or removed? The core puts those at the centre of a tile
  // without a building (a building's own effects, and its modules', are at its centre, on one of its tiles), where
  // a floor or a fence/gate/lamp has appeared or gone since the last frame.
  private isPieceFx(fx: FxEvent): boolean {
    const s = this.terrainState;
    if (!s || (fx.kind !== 'placed' && fx.kind !== 'demolish')) return false;
    const tx = Math.floor(fx.x / TILE);
    const ty = Math.floor(fx.y / TILE);
    if (!inBounds(tx, ty) || fx.x !== (tx + 0.5) * TILE || fx.y !== (ty + 0.5) * TILE) return false;
    const i = idx(tx, ty);
    return s.occ[i] === -1 && (s.solid[i] !== this.lastSolid[i] || s.floor[i] !== this.lastFloor[i]);
  }

  private spawn(x: number, y: number, vx: number, vy: number, life: number, size: number, color: string, grow: number): void {
    if (this.particles.length > 700) return;
    this.particles.push({ x, y, vx, vy, life, max: life, size, color, grow });
  }

  private float(x: number, y: number, text: string, color: string): void {
    // at high speed a big city makes dozens a second: the oldest go first
    if (this.floaters.length >= MAX_FLOATERS) this.floaters.shift();
    this.floaters.push({ x, y, img: this.textSprite(text, color), life: 1.4 });
  }

  // Floating texts repeat ("+2 PARTS", "+9 CR"): each text and colour is drawn once, outline included,
  // into a small canvas, then blitted (one drawImage instead of hundreds of 1-pixel rectangles).
  private textCache = new Map<string, HTMLCanvasElement>();
  private textSprite(text: string, color: string): HTMLCanvasElement {
    const key = `${color}|${text}`;
    let c = this.textCache.get(key);
    if (!c) {
      if (this.textCache.size >= 256) this.textCache.clear();
      c = document.createElement('canvas');
      c.width = pixelTextWidth(text) + 2;
      c.height = 7;
      drawPixelText(c.getContext('2d')!, text, 1, 1, color, 1, PAL.ink);
      this.textCache.set(key, c);
    }
    return c;
  }

  // ---------- frame ----------

  render(s: GameState, view: ViewState, dt: number, simRunning: boolean): void {
    const started = performance.now();
    this.renderFrame(s, view, dt, simRunning);
    // what the effects that come before the next frame are compared with (isPieceFx)
    this.lastSolid.set(s.solid);
    this.lastFloor.set(s.floor);
    this.lastWork = performance.now() - started;
  }

  private renderFrame(s: GameState, view: ViewState, dt: number, simRunning: boolean): void {
    const ctx = this.ctx;
    this.clock += dt;
    this.reduced = view.reducedMotion;
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
    this.adaptQuality(dt);
    this.planPreview(s, view);
    this.updateFocus(view);
    this.resolvePulses(s, dt);

    // only the visible part of the terrain cache is copied
    {
      const sx = Math.max(0, camX - this.tox);
      const sy = Math.max(0, camY - this.toy);
      const sw = Math.min(this.terrain.width - sx, this.viewW - Math.max(0, this.tox - camX));
      const sh = Math.min(this.terrain.height - sy, this.viewH - Math.max(0, this.toy - camY));
      if (sw > 0 && sh > 0) ctx.drawImage(this.terrain, sx, sy, sw, sh, Math.max(0, this.tox - camX), Math.max(0, this.toy - camY), sw, sh);
    }
    if (!view.reducedMotion && this.quality === 'high') {
      this.drawSludgeBubbles(s, camX, camY);
      this.drawWaterGlints(camX, camY);
    }
    this.drawBackScenery(camX, camY, img, view.reducedMotion);

    this.updateTileHeights(s);
    if (simRunning) this.walkers.update(s, dt, Math.max(1, citizenVariants()));
    this.updateBlimp(s, dt, simRunning && !view.reducedMotion);
    this.collect(s, view, camX, camY);
    if (this.quality === 'high') this.drawShadows(s, camX, camY);
    this.drawGroundMarks(s, view, camX, camY);
    this.drawObjects(s, view, camX, camY, img);
    this.drawCollapsing(dt, camX, camY, img);
    this.drawBlimp(camX, camY, img);

    if (simRunning && !view.reducedMotion) this.emitAmbient(s, dt);
    this.updateParticles(dt, camX, camY, simRunning);
    if (view.hover && view.build) this.drawPlacement(s, view, camX, camY, img);
    else if (view.piece) this.drawPiecePreview(s, view, camX, camY, img);
    this.drawSelection(s, view, camX, camY);

    this.drawLighting(s, camX, camY, img);
    this.drawSmog(s, view.reducedMotion);
    this.drawFloaters(dt, camX, camY);
  }

  // Quality follows how busy the frames are, measured against the display's own rate (a 30 or 40 Hz screen,
  // like the Steam Deck's 40 Hz mode, is not "slow"): when frames come 35% later than the display allows, or
  // drawing takes over 70% of a frame, for 2 s, the shadow layer, water glints and ambient particles go; they
  // come back after 6 s of frames on time with drawing under 40% of a frame.
  private adaptQuality(dt: number): void {
    if (dt <= 0 || dt > 0.25) return; // a hidden tab or a long pause says nothing about speed
    const ms = dt * 1000;
    this.frameAvg += (ms - this.frameAvg) * 0.05;
    this.workAvg += (this.lastWork - this.workAvg) * 0.05;
    // the display's rate: the 25th percentile of the last 120 intervals, so a stray early frame does not
    // make a 40 Hz screen look like a 60 Hz one that is struggling, and slow frames do not hide the real rate
    this.intervals[this.intervalCount++ % this.intervals.length] = ms;
    if (this.intervalCount % 30 === 0) {
      const n = Math.min(this.intervals.length, this.intervalCount);
      const sorted = Array.from(this.intervals.subarray(0, n)).sort((a, b) => a - b);
      const p25 = Math.max(4, sorted[Math.floor(n * 0.25)]);
      // falls at once, rises slowly (about 1% a second): a screen seldom changes its rate, slow frames do.
      // If dropping the extras does not speed the frames up, the estimate catches up and they come back.
      this.displayMs = this.displayMs === Infinity ? p25 : Math.min(p25, this.displayMs * 1.005);
    }
    const slow = this.frameAvg > this.displayMs * 1.35 || this.workAvg > this.displayMs * 0.7;
    const fast = this.frameAvg < this.displayMs * 1.12 && this.workAvg < this.displayMs * 0.4;
    if (slow) {
      this.slowFor += dt;
      this.fastFor = 0;
      if (this.slowFor > 2) this.quality = 'low';
    } else if (fast) {
      this.fastFor += dt;
      this.slowFor = 0;
      if (this.fastFor > 6) this.quality = 'high';
    } else {
      // in between: neither verdict builds up
      this.slowFor = Math.max(0, this.slowFor - dt);
      this.fastFor = Math.max(0, this.fastFor - dt);
    }
  }

  private updateFocus(view: ViewState): void {
    if (!view.build && this.ghosts.length && view.piece && isPieceKind(view.piece.kind)) {
      // pieces being laid, one or a dragged row: the box around their ghosts
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const g of this.ghosts) {
        x0 = Math.min(x0, g.x);
        y0 = Math.min(y0, g.y);
        x1 = Math.max(x1, g.x + 1);
        y1 = Math.max(y1, g.y + 1);
      }
      const kind = view.piece.kind;
      const height = kind === 'floor' ? 4 : PIECE_H[kind];
      this.focus = {
        x0: x0 * TILE,
        x1: x1 * TILE,
        y0: y0 * TILE,
        y1: y1 * TILE,
        sx0: (x0 - y1) * TILE,
        sx1: (x1 - y0) * TILE,
        sy0: ((x0 + y0) * TILE) / 2 - height,
        sy1: ((x1 + y1) * TILE) / 2,
      };
      return;
    }
    const h = view.hover;
    if (!h || !(view.build || view.bulldoze || (view.hoverId ?? -1) < 0)) {
      this.focus = null;
      if (!h) return;
    }
    let x0 = h.x;
    let y0 = h.y;
    let w = 1;
    let d = 1;
    if (view.build) {
      const def = BUILDINGS[view.build];
      w = def.w;
      d = def.h;
      x0 = h.x - Math.floor((def.w - 1) / 2);
      y0 = h.y - Math.floor((def.h - 1) / 2);
    } else if (!view.bulldoze) {
      this.focus = null; // plain hovering: no see-through, buildings stay solid
      return;
    }
    const height = view.build ? (buildingArt[view.build]?.height ?? 20) : 4;
    this.focus = {
      x0: x0 * TILE,
      x1: (x0 + w) * TILE,
      y0: y0 * TILE,
      y1: (y0 + d) * TILE,
      sx0: (x0 - (y0 + d)) * TILE,
      sx1: (x0 + w - y0) * TILE,
      sy0: ((x0 + y0) * TILE) / 2 - height,
      sy1: ((x0 + w + y0 + d) * TILE) / 2,
    };
  }

  // Is this building in front of the area being placed, and covering it on screen?
  private coversFocus(b: Building, sx: number, sy: number, w: number, h: number): boolean {
    const f = this.focus;
    if (!f) return false;
    if (sx >= f.sx1 || sy >= f.sy1 || sx + w <= f.sx0 || sy + h <= f.sy0) return false;
    const def = BUILDINGS[b.type];
    const bx0 = b.x * TILE;
    const by0 = b.y * TILE;
    const bx1 = (b.x + def.w) * TILE;
    const by1 = (b.y + def.h) * TILE;
    const focusBehind = f.x1 <= bx0 || f.y1 <= by0;
    const buildingBehind = bx1 <= f.x0 || by1 <= f.y0;
    return focusBehind && !buildingBehind;
  }

  private resolvePulses(s: GameState, dt: number): void {
    let w = 0;
    for (let i = 0; i < this.pulses.length; i++) {
      const p = this.pulses[i];
      if (p.id < 0) {
        const tx = Math.floor(p.x / TILE);
        const ty = Math.floor(p.y / TILE);
        p.id = inBounds(tx, ty) ? s.occ[idx(tx, ty)] : -1;
        if (p.id < 0) continue;
      }
      p.t += dt;
      if (p.t < p.dur) this.pulses[w++] = p;
    }
    this.pulses.length = w;
  }

  private pulseOf(id: number): { t: number; dur: number; kind: 'produce' | 'built' } | null {
    for (const p of this.pulses) if (p.id === id) return p;
    return null;
  }

  private updateTileHeights(s: GameState): void {
    const th = this.tileHeight;
    th.fill(0);
    for (const b of s.buildings) {
      const def = BUILDINGS[b.type];
      const hgt = (artOf(b)?.height ?? 20) * Math.min(1, b.built);
      for (let y = b.y; y < b.y + def.h; y++) for (let x = b.x; x < b.x + def.w; x++) if (inBounds(x, y)) th[idx(x, y)] = hgt;
    }
    // the bots fly over the lamps too (never on a building's tiles)
    for (let i = 0; i < th.length; i++) {
      const kind = s.solid[i] ? solidKind(s.solid[i]) : null;
      if (kind) th[i] = PIECE_H[kind];
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
      it.z1 = Math.max(4, (artOf(b)?.height ?? 20) * Math.min(1, Math.max(0.15, b.built)));
      it.sx0 = sx;
      it.sy0 = sy;
      it.sx1 = sx + f.w;
      it.sy1 = sy + f.h;
      it.kind = K_BUILDING;
      it.ref = k;
    }
    // fences, gates and lamps: one tile each, as tall as their art
    for (let i = 0; i < s.solid.length; i++) {
      const kind = s.solid[i] ? solidKind(s.solid[i]) : null;
      if (!kind) continue;
      const tx = i % MAP_W;
      const ty = (i - tx) / MAP_W;
      const top = tileTop(tx, ty);
      if (top.X + PIECE_REACH < vx0 || top.X - PIECE_REACH > vx1 || top.Y + PIECE_REACH < vy0 || top.Y - PIECE_REACH > vy1) continue;
      const name = this.pieceFrameName(s, tx, ty, i);
      const f = frame(name);
      if (!f) continue;
      const sx = top.X - f.ax;
      const sy = top.Y - f.ay;
      if (sx > vx1 || sy > vy1 || sx + f.w < vx0 || sy + f.h < vy0) continue;
      this.pieceNames[i] = name;
      const it = sorter.add();
      it.x0 = tx * TILE;
      it.x1 = it.x0 + TILE;
      it.y0 = ty * TILE;
      it.y1 = it.y0 + TILE;
      it.z0 = 0;
      it.z1 = PIECE_H[kind];
      it.sx0 = sx;
      it.sy0 = sy;
      it.sx1 = sx + f.w;
      it.sy1 = sy + f.h;
      it.kind = K_PIECE;
      it.ref = i;
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
      const f = frame(d.names[0]);
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
    // street lamps, only where no building or piece stands
    for (let k = 0; k < this.lamps.length; k++) {
      const l = this.lamps[k];
      if (!streetLampShown(s, l.tx, l.ty)) continue;
      const f = frame(`p/lamp/${l.axis}`);
      if (!f) break;
      const top = tileTop(l.tx, l.ty);
      const sx = top.X - f.ax;
      const sy = top.Y - f.ay;
      if (sx > vx1 || sy > vy1 || sx + f.w < vx0 || sy + f.h < vy0) continue;
      const it = sorter.add();
      it.x0 = l.tx * TILE + (l.axis === 'x' ? 2 : 13);
      it.x1 = it.x0 + 3;
      it.y0 = l.ty * TILE + (l.axis === 'x' ? 13 : 2);
      it.y1 = it.y0 + 3;
      it.z0 = 0;
      it.z1 = 20;
      it.sx0 = sx;
      it.sy0 = sy;
      it.sx1 = sx + f.w;
      it.sy1 = sy + f.h;
      it.kind = K_LAMP;
      it.ref = k;
    }
  }

  private botVis(s: GameState, bot: Bot, now: number, reduced: boolean): BotVis {
    let v = this.bots.get(bot.id);
    if (!v) {
      v = { z: 16, lx: bot.x, ly: bot.y, dir: 0, seen: now, carry: bot.carry };
      this.bots.set(bot.id, v);
    }
    const dt = Math.min(0.1, Math.max(0, now - v.seen));
    v.seen = now;
    const mx = bot.x - v.lx;
    const my = bot.y - v.ly;
    if (Math.abs(mx) + Math.abs(my) > 0.05) v.dir = Math.abs(mx) > Math.abs(my) ? (mx > 0 ? 1 : 3) : my > 0 ? 0 : 2;
    v.lx = bot.x;
    v.ly = bot.y;
    if (v.carry > 0 && bot.carry < v.carry && bot.state !== 'collect' && !reduced) {
      // dropped its load into a hopper: a little burst of scrap falling into the roof
      const X = bot.x - bot.y;
      const Y = (bot.x + bot.y) / 2 - v.z + 2;
      for (let k = 0; k < 6; k++) this.spawn(X + (Math.random() - 0.5) * 6, Y, (Math.random() - 0.5) * 16, 6 + Math.random() * 14, 0.45, 1, k % 2 ? PAL.rust : PAL.steelLL, 0);
    }
    v.carry = bot.carry;
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
    if (b.built < 1) {
      const n = namesOf(b.type, buildingArt[b.type]?.frames ?? 1);
      return n.c[Math.min(3, Math.floor(b.built * 4))];
    }
    return this.finishedFrameName(s, b, artKey(b));
  }

  // The frame of a finished building drawn with the art `key`: its own type, or a variant with modules
  // (b/dock+dockStorage/w2).
  private finishedFrameName(s: GameState, b: Building, key: string): string {
    const art = key === b.type ? buildingArt[b.type] : variantArt[key];
    const n = namesOf(key, art?.frames ?? 1);
    if (!art) return n.off;
    // always-animated buildings (radar, lights, elevators) still go dark without power or when paused
    const animate = ALWAYS_ANIMATED.has(b.type) ? !b.paused && b.status !== 'noPower' : isWorking(s, b);
    if (!animate) return n.off;
    // reduced motion: the modules' moving parts (the filter's fan, the silo's gauge) stand still, and so does a
    // building while a module is previewed on it, so that the preview stays on it
    if (this.reduced && (key !== b.type || this.modulePreview?.b === b)) return n.w[0];
    const f = Math.floor(this.clock * art.fps + b.id * 0.37) % art.frames;
    return n.w[f];
  }

  private drawShadows(s: GameState, camX: number, camY: number): void {
    const img = atlasImage()!;
    const sc = this.sctx;
    sc.clearRect(0, 0, this.viewW, this.viewH);
    for (const b of s.buildings) {
      if (b.built < 0.5) continue;
      const f = frame(namesOf(artKey(b), artOf(b)?.frames ?? 1).shadow);
      if (!f) continue;
      const top = tileTop(b.x, b.y);
      const x = top.X - f.ax - camX;
      const y = top.Y - f.ay - camY;
      if (x > this.viewW || y > this.viewH || x + f.w < 0 || y + f.h < 0) continue;
      sc.drawImage(img, f.x, f.y, f.w, f.h, x, y, f.w, f.h);
    }
    for (let i = 0; i < s.solid.length; i++) {
      if (!s.solid[i] || !solidKind(s.solid[i])) continue;
      const tx = i % MAP_W;
      const ty = (i - tx) / MAP_W;
      const top = tileTop(tx, ty);
      if (top.X + PIECE_REACH < camX || top.X - PIECE_REACH > camX + this.viewW || top.Y + PIECE_REACH < camY || top.Y - PIECE_REACH > camY + this.viewH) continue;
      const f = frame(shadowOf(this.pieceFrameName(s, tx, ty, i)));
      if (!f) continue;
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

  // Little glints drifting on the canal.
  private drawWaterGlints(camX: number, camY: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(190,210,255,0.8)';
    for (let tx = -RING; tx < MAP_W + RING; tx++)
      for (const ty of [-4, -3]) {
        if (!isCanal(tx, ty)) continue;
        const top = tileTop(tx, ty);
        const x = top.X - camX;
        const y = top.Y - camY;
        if (x < -20 || x > this.viewW + 20 || y < -20 || y > this.viewH + 20) continue;
        const p = (this.clock * 0.5 + tx * 0.29 + ty * 0.53) % 1;
        if (p > 0.6) continue;
        const gx = Math.round(x - 8 + p * 16);
        const gy = Math.round(y + 8 - p * 4 + ((tx * 3) % 3));
        ctx.fillRect(gx, gy, 2, 1);
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

  private outlineWorldRect(x0: number, y0: number, x1: number, y1: number, color: string, camX: number, camY: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    this.footprintRows(x0, y0, x1, y1, camX, camY, (y, l, r, first, last) => {
      if (first || last) ctx.fillRect(l, y, r - l + 1, 1);
      else {
        ctx.fillRect(l, y, 2, 1);
        ctx.fillRect(r - 1, y, 2, 1);
      }
    });
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
    if (view.piece?.kind === 'floor') this.drawFloorGhosts(camX, camY);
    const h = view.hover;
    // a catalog tool shows its own preview (drawPiecePreview)
    if (!h || view.build || view.piece) return;
    if (view.hoverId !== undefined && view.hoverId >= 0) return; // the building itself gets highlighted
    if (!inBounds(h.x, h.y)) return;
    this.outlineFootprint(h.x, h.y, 1, 1, view.bulldoze ? PAL.red : 'rgba(236,232,246,0.6)', camX, camY);
  }

  // Floors being laid lie on the ground under everything that stands: drawn with the ground marks. A refused tile
  // only turns red, so what is in the way (junk, a floor already there) stays in view.
  private drawFloorGhosts(camX: number, camY: number): void {
    const img = atlasImage();
    const ctx = this.ctx;
    for (const g of this.ghosts) {
      const f = frame(floorFrameOf(g.x, g.y));
      if (f && img && g.ok) {
        const top = tileTop(g.x, g.y);
        ctx.globalAlpha = 0.8;
        ctx.drawImage(img, f.x, f.y, f.w, f.h, top.X - f.ax - camX, top.Y - f.ay - camY, f.w, f.h);
        ctx.globalAlpha = 1;
      }
      this.fillFootprint(g.x, g.y, 1, 1, g.ok ? GHOST_OK : GHOST_BAD, camX, camY);
      this.outlineFootprint(g.x, g.y, 1, 1, g.ok ? PAL.lime : PAL.red, camX, camY);
    }
  }

  private drawObjects(s: GameState, view: ViewState, camX: number, camY: number, img: HTMLImageElement): void {
    const ctx = this.ctx;
    const n = this.sorter.sort(this.order);
    this.drawnCount = 0;
    for (let k = 0; k < n; k++) {
      const it = this.order[k];
      if (it.kind === K_BUILDING) this.drawBuilding(s, s.buildings[it.ref], it.ref, camX, camY, img, view);
      else if (it.kind === K_PIECE) {
        const f = frame(this.pieceNames[it.ref]);
        if (!f) continue;
        ctx.drawImage(img, f.x, f.y, f.w, f.h, it.sx0 - camX, it.sy0 - camY, f.w, f.h);
        this.pushDrawn(K_PIECE, it.ref, it.ref, f, it.sx0, it.sy0, f.w, f.h);
      } else if (it.kind === K_BOT) this.drawBot(s.bots[it.ref], it.ref, camX, camY, img, view.reducedMotion);
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
      } else if (it.kind === K_LAMP) {
        const l = this.lamps[it.ref];
        const f = frame(`p/lamp/${l.axis}`);
        if (!f) continue;
        const top = tileTop(l.tx, l.ty);
        ctx.drawImage(img, f.x, f.y, f.w, f.h, top.X - f.ax - camX, top.Y - f.ay - camY, f.w, f.h);
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
      if (k) {
        k.built = b.built;
        k.key = artKey(b);
      } else this.known.set(b.id, { type: b.type, key: artKey(b), x: b.x, y: b.y, built: b.built });
    }
    if (this.known.size === seen.size) return;
    for (const [id, k] of this.known) {
      if (seen.has(id)) continue;
      this.known.delete(id);
      // a new game or a loaded save replaces the whole list: only animate single removals
      if (!reduced && this.terrainState === s && this.known.size > 0 && k.built >= 1) this.collapsing.push({ type: k.type, key: k.key, x: k.x, y: k.y, t: 0 });
    }
  }

  // A demolished building sinks into its plate in a cloud of dust.
  private drawCollapsing(dt: number, camX: number, camY: number, img: HTMLImageElement): void {
    if (!this.collapsing.length) return;
    const ctx = this.ctx;
    const DUR = 0.7;
    for (const c of this.collapsing) {
      c.t += dt;
      const f = frame(`b/${c.key}/off`);
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
    const f = frame(d.names[fr]);
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
    // a building standing in front of the spot being built on turns see-through, so the spot stays readable
    const seeThrough = this.coversFocus(b, sx, sy, f.w, f.h);
    if (seeThrough) ctx.globalAlpha = 0.35;
    ctx.drawImage(img, f.x, f.y, f.w, f.h, x, y, f.w, f.h);
    if (seeThrough) ctx.globalAlpha = 1;
    this.pushDrawn(K_BUILDING, b.id, idxOf, f, sx, sy, f.w, f.h);
    // a module tool over it: the building as it will look with the module, faint, over itself (same size and
    // anchor, so only the module shows), in the building's place in the draw order
    const mp = this.modulePreview;
    if (mp && mp.b === b && mp.ghost) {
      const g = frame(this.finishedFrameName(s, b, mp.ghost));
      if (g) {
        ctx.globalAlpha = mp.check.ok ? 0.6 : 0.35;
        ctx.drawImage(img, g.x, g.y, g.w, g.h, top.X - g.ax - camX, top.Y - g.ay - camY, g.w, g.h);
        ctx.globalAlpha = 1;
      }
    }
    // a short flash when a production cycle ends, a longer one (and a ring on the ground) when it is finished
    const pulse = this.pulseOf(b.id);
    if (pulse && !view.reducedMotion) {
      const k = 1 - pulse.t / pulse.dur;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (pulse.kind === 'built' ? 0.55 : 0.22) * k;
      ctx.drawImage(img, f.x, f.y, f.w, f.h, x, y, f.w, f.h);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      if (pulse.kind === 'built') {
        const def = BUILDINGS[b.type];
        const grow = Math.round((1 - k) * 10);
        this.outlineWorldRect(b.x * TILE - grow, b.y * TILE - grow, (b.x + def.w) * TILE + grow, (b.y + def.h) * TILE + grow, k > 0.5 ? PAL.lime : PAL.white, camX, camY);
      }
    }
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
    // (not while a catalog tool is in hand: a click then lays or installs, and the preview shows where)
    if (view.hoverId === b.id && view.selectedId !== b.id && !view.piece) {
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
    } else if (b.status === 'noPower') {
      // a lightning bolt: no power reads apart from a missing input at a glance
      ctx.fillRect(x + 3, y, 1, 1);
      ctx.fillRect(x + 2, y + 1, 2, 1);
      ctx.fillRect(x + 1, y + 2, 3, 1);
      ctx.fillRect(x + 1, y + 3, 2, 1);
      ctx.fillRect(x + 1, y + 4, 1, 1);
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
        // a fence, gate or lamp blocks its tile as a building does (placeCheck): that tile shows red too
        const okTile = inBounds(tx, ty) && s.occ[idx(tx, ty)] === -1 && s.solid[idx(tx, ty)] === 0 && (s.tiles[idx(tx, ty)] === T.GROUND || s.tiles[idx(tx, ty)] === T.GRASS);
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
      const top = tileTop(ox, oy);
      this.drawLabel(check.reason, top.X - camX, top.Y - (f ? f.ay : 40) - 12 - camY, PAL.red);
    }
  }

  // A line of words on the map in a dark box, centred on x (view px) with its top at y: why a placement is refused,
  // a module's effect. Kept inside the view, clear of the top bar and the build toolbar (insets): at a high zoom the
  // label of a building in the middle of the screen would otherwise sit under the top bar. A label under an open
  // side panel or the goal card (labelAvoid) moves out of it the shortest way: beside it, above or below it.
  private drawLabel(text: string, x: number, y: number, color: string): void {
    const ctx = this.ctx;
    const z = this.pxZoom;
    const w = pixelTextWidth(text);
    // (the box spans ly - 2 to ly + 7; the view is rounded up to whole art pixels, so keep one more off the bottom)
    const top = Math.ceil(this.insets.top / z) + 2;
    const bottom = this.viewH - Math.ceil(this.insets.bottom / z) - 8;
    const right = this.viewW - w - 2;
    let lx = Math.max(2, Math.min(right, Math.round(x - w / 2)));
    let ly = Math.max(top, Math.min(bottom, Math.round(y)));
    // the HUD rectangles in view px, one art pixel of air around them
    const boxes = this.labelAvoid.map((r) => ({ l: Math.floor(r.left / z) - 1, t: Math.floor(r.top / z) - 1, r: Math.ceil(r.right / z) + 1, b: Math.ceil(r.bottom / z) + 1 }));
    const under = (px: number, py: number) => boxes.find((o) => px + w + 2 > o.l && px - 2 < o.r && py + 7 > o.t && py - 2 < o.b);
    // beside, above or below a rectangle, still inside the view
    const out = (px: number, py: number, o: (typeof boxes)[number]) =>
      [
        { x: o.l - w - 2, y: py },
        { x: o.r + 2, y: py },
        { x: px, y: o.t - 7 },
        { x: px, y: o.b + 2 },
      ].filter((m) => m.x >= 2 && m.x <= right && m.y >= top && m.y <= bottom);
    const first = under(lx, ly);
    if (first) {
      // the nearest spot clear of everything; one step out of the way may land on the other rectangle
      let best: { x: number; y: number } | null = null;
      let bestD = Infinity;
      for (const m of out(lx, ly, first)) {
        const next = under(m.x, m.y);
        for (const n of next ? out(m.x, m.y, next) : [m]) {
          const d = Math.abs(n.x - lx) + Math.abs(n.y - ly);
          if (d < bestD && !under(n.x, n.y)) {
            best = n;
            bestD = d;
          }
        }
      }
      if (best) {
        lx = best.x;
        ly = best.y;
      }
    }
    ctx.fillStyle = 'rgba(13,11,22,0.85)';
    ctx.fillRect(lx - 2, ly - 2, w + 4, 9);
    drawPixelText(ctx, text, lx, ly, color);
  }

  // What the catalog tool would do this frame, worked out before anything is drawn (real fences join the ghosts):
  // a ghost per tile for a piece (the pointer's tile, or every tile of a dragged row), or the building a module
  // tool points at.
  private planPreview(s: GameState, view: ViewState): void {
    this.ghosts.length = 0;
    this.ghostJoin.clear();
    this.ghostRow.clear();
    this.modulePreview = null;
    const tool = view.piece;
    if (!tool || view.build) return;
    if (isModuleKind(tool.kind)) {
      this.modulePreview = this.planModule(s, view, tool.kind);
      return;
    }
    if (!isPieceKind(tool.kind)) return;
    const kind = tool.kind;
    const def = PIECES[kind];
    const dragged = !!view.pieceRow && view.pieceRow.length > 0;
    const row = dragged ? view.pieceRow! : view.hover ? [view.hover] : [];
    const seen = this.ghostSeen;
    seen.clear();
    let laid = 0;
    for (const p of row) {
      const key = (p.y + 1024) * 4096 + p.x + 1024; // each tile once, inside the map or not
      if (seen.has(key)) continue;
      seen.add(key);
      const inside = inBounds(p.x, p.y);
      const i = inside ? idx(p.x, p.y) : -1;
      // a dragged row passing over the same piece already there (a fence row: over a gate too) just carries on: no
      // ghost on it
      if (dragged && inside) {
        const there = solidKind(s.solid[i]);
        if (kind === 'floor' ? s.floor[i] !== 0 : there === kind || (kind === 'fence' && there === 'gate')) continue;
      }
      let check = pieceCheck(s, kind, p.x, p.y, tool.rot);
      // each tile of a row is paid when it is laid: past what the money covers, the ghosts say so
      if (check.ok && !affords(s.res, def.cost, laid + 1)) check = { ok: false, reason: t('place.costs', { cost: costText(def.cost) }), costOnly: true };
      if (check.ok) laid++;
      this.ghosts.push({ x: p.x, y: p.y, ok: check.ok, reason: check.reason });
      if (def.joins && inside) {
        this.ghostRow.add(i);
        if (check.ok) this.ghostJoin.add(i);
      }
    }
  }

  // The building under the pointer for a module tool: the one whose pixels are hovered, else the one on the tile.
  private planModule(s: GameState, view: ViewState, kind: ModuleKind): ModulePreview | null {
    const id = view.hoverId ?? -1;
    let b = id >= 0 ? s.buildings.find((o) => o.id === id) : undefined;
    if (!b && view.hover && inBounds(view.hover.x, view.hover.y)) {
      const occ = s.occ[idx(view.hover.x, view.hover.y)];
      if (occ >= 0) b = s.buildings.find((o) => o.id === occ);
    }
    if (!b) return null;
    const fits = MODULES[kind].building === b.type;
    const check = moduleCheck(s, kind, b);
    let ghost: string | null = null;
    if (fits && (check.ok || check.costOnly)) {
      const key = variantKey(b.type, [...installedModules(b), kind]);
      if (variantArt[key]) ghost = key;
    }
    return { b, fits, check, ghost };
  }

  private drawPiecePreview(s: GameState, view: ViewState, camX: number, camY: number, img: HTMLImageElement): void {
    const tool = view.piece!;
    const mp = this.modulePreview;
    if (mp) {
      // only a building the module fits is outlined; on any other one the reason says where it goes
      const def = BUILDINGS[mp.b.type];
      if (mp.fits) this.outlineFootprint(mp.b.x, mp.b.y, def.w, def.h, mp.check.ok ? PAL.lime : mp.check.costOnly ? PAL.yellow : PAL.red, camX, camY);
      // the interface's label (the module's effect) while the module can go on; otherwise why not ("Already
      // installed", "Only on a finished Bot Dock", the price), even when the interface passed its effect
      const text = mp.check.ok ? view.pieceLabel || null : mp.check.reason;
      const f = frame(namesOf(mp.b.type, buildingArt[mp.b.type]?.frames ?? 1).off);
      const top = tileTop(mp.b.x, mp.b.y);
      if (text) this.drawLabel(text, top.X + ((def.w - def.h) * TILE) / 2 - camX, top.Y - (f ? f.ay : 40) - 12 - camY, mp.fits && mp.check.ok ? PAL.lime : PAL.red);
      return;
    }
    if (!isPieceKind(tool.kind) || !this.ghosts.length) return;
    const kind = tool.kind;
    const ctx = this.ctx;
    if (kind !== 'floor') {
      for (const g of this.ghosts) this.fillFootprint(g.x, g.y, 1, 1, g.ok ? GHOST_OK : GHOST_BAD, camX, camY);
      // back to front, so the nearer ghosts of a row cover the farther ones
      const order = this.ghosts.slice().sort((a, b) => a.x + a.y - (b.x + b.y));
      for (const g of order) {
        this.outlineFootprint(g.x, g.y, 1, 1, g.ok ? PAL.lime : PAL.red, camX, camY);
        const f = frame(this.ghostFrameName(s, kind, tool.rot, g));
        if (!f) continue;
        const top = tileTop(g.x, g.y);
        ctx.globalAlpha = g.ok ? 0.75 : 0.45;
        ctx.drawImage(img, f.x, f.y, f.w, f.h, top.X - f.ax - camX, top.Y - f.ay - camY, f.w, f.h);
        ctx.globalAlpha = 1;
      }
    }
    // one label: on the pointer's tile (the end of a dragged row), or on the first tile that will be skipped; the
    // interface's text only over a ghost that will be laid (a refused one says why)
    const h = view.hover;
    const at = (h && this.ghosts.find((g) => g.x === h.x && g.y === h.y)) || this.ghosts[this.ghosts.length - 1];
    const bad = at.ok ? this.ghosts.find((g) => !g.ok) : at;
    const label = at.ok && view.pieceLabel ? { g: at, text: view.pieceLabel } : bad?.reason ? { g: bad, text: bad.reason } : null;
    if (!label) return;
    const f = kind === 'floor' ? undefined : frame(this.ghostFrameName(s, kind, tool.rot, label.g));
    const top = tileTop(label.g.x, label.g.y);
    this.drawLabel(label.text, top.X - camX, top.Y - (f ? f.ay : 0) - 12 - camY, label.g.ok ? PAL.lime : PAL.red);
  }

  // The frame of a ghost: a fence joins the real fences and gates around it and the ghosts of its row that will be
  // laid, exactly as it will look (a refused one joins the whole row, so the row still reads as one); alone, it lies
  // along its rotation. A gate and a lamp follow the tool's rotation.
  private ghostFrameName(s: GameState, kind: Exclude<PieceKind, 'floor'>, rot: number, g: Ghost): string {
    if (kind !== 'fence' || !inBounds(g.x, g.y)) return pieceFrameOf(kind, rot, 0);
    return pieceFrameOf(kind, rot, this.joinMask(s, g.x, g.y, g.ok ? this.ghostJoin : this.ghostRow));
  }

  private drawSelection(s: GameState, view: ViewState, camX: number, camY: number): void {
    const color = view.bulldoze ? PAL.red : PAL.lime;
    const blink = Math.floor(this.clock * 3) % 3 !== 2;
    // a selected fence, gate, lamp or floor (while it is there): the same blinking outline and marker as a building
    const i = view.selectedPiece ?? -1;
    if (i >= 0 && i < s.solid.length && (s.solid[i] !== 0 || floorShown(s, i))) {
      const tx = i % MAP_W;
      const ty = (i - tx) / MAP_W;
      if (blink) this.outlineFootprint(tx, ty, 1, 1, color, camX, camY);
      const f = s.solid[i] !== 0 ? frame(this.pieceFrameName(s, tx, ty, i)) : undefined;
      const top = tileTop(tx, ty);
      this.drawMarker(top.X - camX, top.Y - (f ? f.ay : 0) - camY, color);
    }
    if (view.selectedId < 0) return;
    const b = s.buildings.find((o) => o.id === view.selectedId);
    if (!b) return;
    const def = BUILDINGS[b.type];
    if (blink) this.outlineFootprint(b.x, b.y, def.w, def.h, color, camX, camY);
    // a marker over the roof
    const f = frame(`b/${b.type}/off`);
    if (!f) return;
    const top = tileTop(b.x, b.y);
    this.drawMarker(top.X + ((def.w - def.h) * TILE) / 2 - camX, top.Y - f.ay - camY, color);
  }

  // The selection marker: a small arrow pointing down at (x, y) (view px). It bobs, except with reduced motion.
  private drawMarker(x: number, y: number, color: string): void {
    const mx = Math.round(x);
    const my = Math.round(y - 6 + (this.reduced ? 0 : Math.sin(this.clock * 5) * 2));
    const ctx = this.ctx;
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(mx - 4, my - 1, 9, 4);
    ctx.fillRect(mx - 3, my + 3, 7, 1);
    ctx.fillRect(mx - 2, my + 4, 5, 1);
    ctx.fillRect(mx - 1, my + 5, 3, 1);
    ctx.fillStyle = color;
    ctx.fillRect(mx - 3, my, 7, 2);
    ctx.fillRect(mx - 2, my + 2, 5, 1);
    ctx.fillRect(mx - 1, my + 3, 3, 1);
    ctx.fillRect(mx, my + 4, 1, 1);
  }

  private emitAmbient(s: GameState, dt: number): void {
    if (this.quality === 'high') {
      const dark = darkness(dayPhase(s));
      const vx = Math.round(this.cam.x);
      const vy = Math.round(this.cam.y);
      // scraps of paper and leaves blown along the streets (more of them in a dirty city)
      if (Math.random() < dt * (0.8 + s.pollution / 50)) {
        const X = vx + Math.random() * this.viewW;
        const Y = vy + this.viewH * (0.2 + Math.random() * 0.7);
        const col = s.pollution > 50 ? '#8a7f6a' : Math.random() < 0.5 ? '#b9b4cc' : PAL.greenL;
        this.spawn(X, Y, 14 + Math.random() * 10, -2 + Math.random() * 3, 2.2, 1, col, 0);
      }
      // fireflies over the gardens at night
      if (dark > 0.35)
        for (const b of s.buildings) {
          if (b.type !== 'garden' || b.built < 1 || Math.random() > dt * 0.8) continue;
          const top = tileTop(b.x, b.y);
          this.spawn(top.X + (Math.random() - 0.5) * 20, top.Y + 4 + Math.random() * 8, (Math.random() - 0.5) * 6, -3 - Math.random() * 4, 1.6, 1, PAL.lime, 0);
        }
    }
    for (const b of s.buildings) {
      if (b.built < 1) continue;
      // with modules, the variant's points: a Smelter with the filter has no smoke, its tower lets out steam
      const art = artOf(b);
      if (!art) continue;
      const working = isWorking(s, b);
      const top = tileTop(b.x, b.y);
      const smoke = art.points.smoke;
      if (working && smoke && Math.random() < dt * 6) {
        const p = smoke[Math.floor(Math.random() * smoke.length)];
        const dirty = s.pollution > 60 ? '#4a3c32' : '#6d6878';
        this.spawn(top.X + p[0], top.Y + p[1], 4 + Math.random() * 6, -8 - Math.random() * 6, 2.6, 2, dirty, 1.4);
      }
      // light, thin steam, much sparser than smoke
      const steam = art.points.steam;
      if (working && steam && Math.random() < dt * 2) {
        const p = steam[0];
        this.spawn(top.X + p[0] + (Math.random() - 0.5) * 3, top.Y + p[1], 2 + Math.random() * 4, -9 - Math.random() * 5, 1.6, 1, Math.random() < 0.5 ? '#e4e2ee' : '#c3c0d4', 1.2);
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
      const x = Math.round(f.x - f.img.width / 2) - camX;
      const y = Math.round(f.y) - 1 - camY;
      if (x > this.viewW || y > this.viewH || x + f.img.width < 0 || y + f.img.height < 0) continue;
      ctx.globalAlpha = Math.min(1, f.life);
      ctx.drawImage(f.img, x, y);
    }
    ctx.globalAlpha = 1;
  }

  private drawLighting(s: GameState, camX: number, camY: number, img: HTMLImageElement): void {
    const ctx = this.ctx;
    const light = this.light;
    const night = darkness(dayPhase(s));
    // a themed city's daylight fades out as its night veil comes in (gone at midnight, darkness 0.55; under 2% it
    // changes no colour by a whole level)
    const daylight = 1 - night / 0.55;
    if (light.day && daylight > 0.02) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = `rgba(${light.day},${daylight})`;
      ctx.fillRect(0, 0, this.viewW, this.viewH);
      ctx.globalCompositeOperation = 'source-over';
    }
    const dark = Math.min(0.9, night * light.dark);
    if (dark <= 0.01) return;
    ctx.fillStyle = `rgba(${light.veil},${dark})`;
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
      const g = frame(glowOf(this.buildingFrameName(s, b)));
      if (g) ctx.drawImage(img, g.x, g.y, g.w, g.h, d.sx - camX, d.sy - camY, g.w, g.h);
      // blinking beacons from the model's light points
      const art = artOf(b);
      if (blinkOn && art?.points.light) {
        const top = tileTop(b.x, b.y);
        ctx.fillStyle = PAL.red;
        for (const p of art.points.light) ctx.fillRect(top.X + p[0] - 2 - camX, top.Y + p[1] - 2 - camY, 4, 4);
      }
    }
    // placed gates and lamps: the gate's amber light; the lamp's lens and the pool of light it throws on the ground,
    // both in its glow frame (so no street-lamp pool here: it would light the ground twice)
    for (let k = 0; k < this.drawnCount; k++) {
      const d = this.drawn[k];
      if (d.kind !== K_PIECE) continue;
      const g = frame(glowOf(this.pieceNames[d.ref]));
      if (!g) continue;
      const tx = d.ref % MAP_W;
      const top = tileTop(tx, (d.ref - tx) / MAP_W);
      ctx.drawImage(img, g.x, g.y, g.w, g.h, top.X - g.ax - camX, top.Y - g.ay - camY, g.w, g.h);
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
    // toxic sludge glows faintly in the dark
    {
      const a = tileAt(camX, camY);
      const b = tileAt(camX + this.viewW, camY + this.viewH);
      const c = tileAt(camX + this.viewW, camY);
      const d = tileAt(camX, camY + this.viewH);
      const prev = ctx.globalAlpha;
      ctx.globalAlpha = prev * 0.35;
      for (let ty = Math.max(0, c.y); ty <= Math.min(MAP_H - 1, d.y); ty++)
        for (let tx = Math.max(0, a.x); tx <= Math.min(MAP_W - 1, b.x); tx++) {
          if (s.tiles[idx(tx, ty)] !== T.SLUDGE) continue;
          const f = frame('t/sludge/15/0');
          if (!f) break;
          const top = tileTop(tx, ty);
          ctx.drawImage(img, f.x, f.y, f.w, f.h, top.X - f.ax - camX, top.Y - f.ay - camY, f.w, f.h);
        }
      ctx.globalAlpha = prev;
    }
    // street lamps: the lamp head glows and throws a pool of light on the street
    {
      const lf = frame('p/lamp/x/g');
      const lg = frame('p/lamp/y/g');
      for (const l of this.lamps) {
        if (!streetLampShown(s, l.tx, l.ty)) continue;
        const top = tileTop(l.tx, l.ty);
        const x = top.X - camX;
        const y = top.Y - camY;
        if (x < -40 || x > this.viewW + 40 || y < -40 || y > this.viewH + 40) continue;
        const g = l.axis === 'x' ? lf : lg;
        if (g) ctx.drawImage(img, g.x, g.y, g.w, g.h, top.X - g.ax - camX, top.Y - g.ay - camY, g.w, g.h);
        // the pool: a small diamond of warm light under the head
        const cx = l.axis === 'x' ? 3 : 9;
        const cy = l.axis === 'x' ? 9 : 3;
        const px = Math.round(top.X + cx - cy) - camX;
        const py = Math.round(top.Y + (cx + cy) / 2) - camY;
        ctx.fillStyle = 'rgba(255,212,64,0.12)';
        for (let r = 0; r < POOL.length; r++) ctx.fillRect(px - POOL[r], py - 3 + r, POOL[r] * 2, 1);
      }
    }
    for (const d of this.scenery) {
      const fr = d.frames > 1 ? Math.floor(this.clock * d.fps + d.tx * 0.37 + d.ty * 0.61) % d.frames : 0;
      const g = frame(d.glows[fr]);
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
