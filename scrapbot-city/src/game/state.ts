import { BUILDINGS, DAY_LENGTH, DEFAULT_MODS, MAP_H, MAP_W, SMOG_DANGER, T, TILE } from './defs';
import type { BuildingType, CityMods, Resource } from './defs';
import { modulesFor, normRot, solidKind } from './piecedefs';
import type { ModuleKind } from './piecedefs';
import { generateMap } from './world';

export type BuildingStatus = 'building' | 'ok' | 'idle' | 'noPower' | 'noInput' | 'noFuel' | 'reserve';

export interface Building {
  id: number;
  type: BuildingType;
  x: number;
  y: number;
  built: number; // construction progress 0..1
  timer: number; // process cycle progress in seconds
  fuel: number; // burner fuel left in seconds
  cleanTimer: number;
  status: BuildingStatus;
  paused: boolean; // production switched off by the player
  lastWork: number; // sim time of the last finished cycle, drives smoke and sparkles
  // path meter change this building really made when placed (after the ±100 clamp); demolishing undoes
  // exactly this. Missing in older saves: then the standard shift is used.
  align?: number;
  // machine modules installed (absent = none; never two of the same kind; catalog order)
  modules?: ModuleKind[];
}

export type BotState = 'idle' | 'toJunk' | 'collect' | 'toDrop';

export interface Bot {
  id: number;
  x: number;
  y: number;
  state: BotState;
  target: number; // tile index (toJunk/collect) or building id (toDrop)
  carry: number;
  timer: number;
  phase: number;
  facing: 1 | -1;
}

export interface Cat {
  x: number;
  y: number;
  tx: number;
  ty: number;
  timer: number;
  sitting: boolean;
  facing: 1 | -1;
}

export type OutcomeKind = 'smog' | 'green' | 'industrial' | 'balanced';

export interface Outcome {
  kind: OutcomeKind;
  day: number;
}

export interface Derived {
  energyProd: number;
  energyUse: number;
  efficiency: number;
  housing: number;
  storage: number;
  botTarget: number;
  happiness: number;
  pollutionRate: number;
}

export type MessageTone = 'info' | 'good' | 'bad' | 'event';

export interface Message {
  text: string;
  tone: MessageTone;
}

export type FxKind = 'collect' | 'built' | 'produce' | 'clean' | 'placed' | 'demolish' | 'storm' | 'star';

export interface FxEvent {
  kind: FxKind;
  x: number; // world px
  y: number;
  text?: string;
  color?: string;
  coins?: boolean; // produce: the output includes credits (yellow text, coin sound)
}

export interface Stats {
  scrapCollected: number;
  built: number;
  cleaned: number;
  creditsEarned: number;
  maxPollution: number;
  industrialBuilt: number;
  catPets: number;
  partsMade: number;
  piecesPlaced: number; // floors, fences, gates and lamps bought
  modulesInstalled: number;
}

export interface Hints {
  free: number; // free hints left
  paid: number; // hints bought so far (drives the price)
  nextFreeDay: number; // day a free hint recharges
  lastTitle: string; // last hint shown, and its day: asking again the same day is free
  lastDay: number;
}

export interface GameState {
  version: number;
  seed: number;
  cityName: string;
  cityId: string | null; // campaign city, null in free play
  mods: CityMods;
  tutorial: boolean;
  spireDone: boolean;
  endingKind: OutcomeKind | null; // ending reached when the Spire was finished
  stars: boolean[]; // campaign goals reached in this city
  hints: Hints;
  warnedFullAt: number; // last "storage full" warning, so it does not flood the feed
  warnedEmptyAt: number; // last "everyone left" warning
  tiles: Uint8Array;
  amount: Uint16Array; // junk per tile
  occ: Int32Array; // building id per tile or -1 (derived, not saved)
  claims: Uint8Array; // bots heading to each junk tile (derived, not saved)
  floor: Uint8Array; // industrial floor per tile: 0 none, 1 floor (stays under buildings, solids and junk)
  solid: Uint8Array; // solid piece per tile: 0 none, 1 fence, 2 gate, 3 lamp (never on a building's tiles)
  rot: Uint8Array; // rotation of the solid piece on each tile (0..3)
  buildings: Building[];
  nextId: number;
  bots: Bot[];
  cat: Cat;
  res: Record<Resource, number>;
  pop: number;
  pollution: number;
  alignment: number; // -100 industrial .. +100 green
  happyMod: number;
  time: number;
  waste: number;
  smog: number;
  nextEventAt: number;
  nextStormAt: number;
  overtimeUntil: number;
  botSpeedMul: number;
  eventsSeen: string[];
  eventLast: Record<string, number>; // event id -> game time it last came up
  objective: number;
  stats: Stats;
  outcome: Outcome | null;
  derived: Derived;
  dirtyTiles: number[];
  fx: FxEvent[];
  messages: Message[];
  pendingEvent: string | null;
}

export const SAVE_VERSION = 2;

// Automatic saves skip a running smog countdown: the retry offered after a smog loss loads the last
// autosave, so it must be a moment the city can still recover from.
export function canAutosave(s: GameState): boolean {
  return s.smog <= 0 && s.pollution < SMOG_DANGER;
}

export function idx(x: number, y: number): number {
  return y * MAP_W + x;
}

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
}

export function buildingCenter(b: Building): { x: number; y: number } {
  const def = BUILDINGS[b.type];
  return { x: (b.x + def.w / 2) * TILE, y: (b.y + def.h / 2) * TILE };
}

export function emptyDerived(): Derived {
  return {
    energyProd: 0,
    energyUse: 0,
    efficiency: 1,
    housing: 0,
    storage: 0,
    botTarget: 0,
    happiness: 50,
    pollutionRate: 0,
  };
}

export interface NewGameOptions {
  seed?: number;
  cityName?: string;
  cityId?: string | null;
  mods?: CityMods;
  tutorial?: boolean;
}

export const FREE_HINTS = 3;

export function createGame(opts: NewGameOptions = {}): GameState {
  const seed = opts.seed ?? Math.floor(Math.random() * 1e9);
  const mods = opts.mods ?? DEFAULT_MODS;
  const map = generateMap(seed, mods);
  const s: GameState = {
    version: SAVE_VERSION,
    seed,
    cityName: opts.cityName ?? 'Scrapbot City',
    cityId: opts.cityId ?? null,
    mods,
    tutorial: opts.tutorial ?? false,
    spireDone: false,
    endingKind: null,
    stars: [false, false, false],
    hints: { free: FREE_HINTS, paid: 0, nextFreeDay: 6, lastTitle: '', lastDay: 0 },
    warnedFullAt: -999,
    warnedEmptyAt: -999,
    tiles: map.tiles,
    amount: map.amount,
    occ: new Int32Array(MAP_W * MAP_H).fill(-1),
    claims: new Uint8Array(MAP_W * MAP_H),
    floor: new Uint8Array(MAP_W * MAP_H),
    solid: new Uint8Array(MAP_W * MAP_H),
    rot: new Uint8Array(MAP_W * MAP_H),
    buildings: [],
    nextId: 1,
    bots: [],
    cat: {
      x: (map.hq.x + 4) * TILE,
      y: (map.hq.y + 3) * TILE,
      tx: (map.hq.x + 4) * TILE,
      ty: (map.hq.y + 3) * TILE,
      timer: 2,
      sitting: true,
      facing: -1,
    },
    res: { ...mods.startRes },
    pop: 0,
    pollution: mods.startPollution,
    alignment: 0,
    happyMod: 0,
    time: 0,
    waste: 0,
    smog: 0,
    nextEventAt: 95 * mods.eventEvery,
    nextStormAt: 200 * mods.stormEvery,
    overtimeUntil: 0,
    botSpeedMul: 1,
    eventsSeen: [],
    eventLast: {},
    objective: 0,
    stats: { scrapCollected: 0, built: 0, cleaned: 0, creditsEarned: 0, maxPollution: mods.startPollution, industrialBuilt: 0, catPets: 0, partsMade: 0, piecesPlaced: 0, modulesInstalled: 0 },
    outcome: null,
    derived: emptyDerived(),
    dirtyTiles: [],
    fx: [],
    messages: [],
    pendingEvent: null,
  };
  if (s.tutorial) {
    // no surprises while learning: events and storms start after the tutorial
    s.nextEventAt = 1e9;
    s.nextStormAt = 1e9;
  }
  const hq = addBuilding(s, 'hq', map.hq.x, map.hq.y);
  hq.built = 1;
  hq.status = 'ok';
  return s;
}

export function addBuilding(s: GameState, type: BuildingType, x: number, y: number, id = s.nextId++): Building {
  const def = BUILDINGS[type];
  const b: Building = {
    id,
    type,
    x,
    y,
    built: 0,
    timer: 0,
    fuel: 0,
    cleanTimer: 0,
    status: 'building',
    paused: false,
    lastWork: -99,
  };
  s.buildings.push(b);
  for (let dy = 0; dy < def.h; dy++) {
    for (let dx = 0; dx < def.w; dx++) {
      const i = idx(x + dx, y + dy);
      s.occ[i] = b.id;
      if (s.floor[i]) s.dirtyTiles.push(i); // the floor under it is covered now
    }
  }
  return b;
}

export function removeBuilding(s: GameState, b: Building): void {
  const def = BUILDINGS[b.type];
  s.buildings = s.buildings.filter((o) => o.id !== b.id);
  for (let dy = 0; dy < def.h; dy++) {
    for (let dx = 0; dx < def.w; dx++) {
      const i = idx(b.x + dx, b.y + dy);
      s.occ[i] = -1;
      if (s.floor[i]) s.dirtyTiles.push(i); // the floor under it shows again
    }
  }
}

export function findBuilding(s: GameState, id: number): Building | undefined {
  return s.buildings.find((b) => b.id === id);
}

export function day(s: GameState): number {
  return Math.floor(s.time / DAY_LENGTH) + 1;
}

export function pushMessage(s: GameState, text: string, tone: MessageTone = 'info'): void {
  s.messages.push({ text, tone });
}

// ---------- save / load ----------

// Everything except the map arrays (stored compactly) and runtime-only data.
// Pieces (0.7) are stored sparsely: `floors` lists the floored tile indexes, `solids` the [index, kind, rot]
// of every fence/gate/lamp (kind as in GameState.solid). Both are optional: 0.6 saves have neither.
type SaveData = Omit<GameState, 'tiles' | 'amount' | 'occ' | 'claims' | 'floor' | 'solid' | 'rot' | 'bots' | 'derived' | 'dirtyTiles' | 'fx' | 'messages'> & {
  tiles: string;
  amount: number[];
  floors?: number[];
  solids?: [number, number, number][];
};

export function serialize(s: GameState): string {
  const { tiles, amount, occ: _occ, claims: _claims, floor, solid, rot, bots: _bots, derived: _derived, dirtyTiles: _dirty, fx: _fx, messages: _messages, ...rest } = s;
  // bots are not saved: the scrap they carry goes into storage (as far as it fits) instead of vanishing
  const carried = s.bots.reduce((n, b) => n + b.carry, 0);
  const room = Math.max(0, (s.derived.storage || 0) - s.res.scrap);
  const res = { ...rest.res, scrap: rest.res.scrap + Math.min(carried, room) };
  const floors: number[] = [];
  const solids: [number, number, number][] = [];
  for (let i = 0; i < floor.length; i++) {
    if (floor[i]) floors.push(i);
    if (solid[i]) solids.push([i, solid[i], rot[i]]);
  }
  const data: SaveData = { ...rest, res, tiles: Array.from(tiles).join(''), amount: Array.from(amount), floors, solids };
  return JSON.stringify(data);
}

export function deserialize(json: string): GameState {
  const d = JSON.parse(json) as Partial<SaveData> & { version: number; tiles: string; amount: number[]; buildings: Building[]; nextId: number };
  if (d.version !== 1 && d.version !== SAVE_VERSION) throw new Error(`Unsupported save version ${d.version}`);
  const size = MAP_W * MAP_H;
  if (d.tiles.length !== size || d.amount.length !== size) throw new Error('Corrupted save: wrong map size');
  const tiles = new Uint8Array(size);
  for (let i = 0; i < size; i++) tiles[i] = Number(d.tiles[i]) || T.GROUND;
  // Start from a fresh city so fields added in newer versions get sane defaults.
  const base = createGame({ seed: 1 });
  const spireDone = d.spireDone ?? d.buildings.some((b) => b.type === 'spire' && b.built >= 1);
  const { floors, solids, ...saved } = d;
  const s: GameState = {
    ...base,
    ...(saved as Omit<SaveData, 'tiles' | 'amount' | 'floors' | 'solids'>),
    version: SAVE_VERSION,
    mods: { ...DEFAULT_MODS, ...(d.mods ?? {}) },
    stats: { ...base.stats, maxPollution: d.pollution ?? 0, ...(d.stats ?? {}) },
    hints: { ...base.hints, ...(d.hints ?? {}) },
    stars: d.stars ?? [false, false, false],
    spireDone,
    endingKind: d.endingKind ?? (d.outcome && d.outcome.kind !== 'smog' ? d.outcome.kind : null),
    tiles,
    amount: Uint16Array.from(d.amount),
    occ: new Int32Array(size).fill(-1),
    claims: new Uint8Array(size),
    floor: new Uint8Array(size),
    solid: new Uint8Array(size),
    rot: new Uint8Array(size),
    buildings: [],
    bots: [],
    derived: emptyDerived(),
    dirtyTiles: [],
    fx: [],
    messages: [],
    // an event dialog that was open when the game was saved comes back on load
    pendingEvent: d.pendingEvent ?? null,
  };
  for (const b of d.buildings) {
    const placed = addBuilding(s, b.type, b.x, b.y, b.id);
    Object.assign(placed, { paused: false }, b);
    // only modules that fit this building, each once (a hand-edited save cannot stack two filters)
    const modules = modulesFor(placed.type, placed.modules);
    if (modules.length) placed.modules = modules;
    else delete placed.modules;
  }
  s.nextId = Math.max(d.nextId, ...s.buildings.map((b) => b.id + 1));
  const valid = (i: unknown): i is number => Number.isInteger(i) && (i as number) >= 0 && (i as number) < size;
  if (Array.isArray(floors)) for (const i of floors) if (valid(i)) s.floor[i] = 1;
  if (Array.isArray(solids)) {
    for (const entry of solids) {
      if (!Array.isArray(entry)) continue;
      const [i, code, r] = entry;
      const kind = solidKind(Number(code));
      // a solid piece never shares a tile with a building, junk, sludge or rubble (only ground or grass)
      if (!valid(i) || !kind || s.occ[i] !== -1 || (s.tiles[i] !== T.GROUND && s.tiles[i] !== T.GRASS)) continue;
      s.solid[i] = Number(code);
      s.rot[i] = normRot(kind, Number(r));
    }
  }
  return s;
}
