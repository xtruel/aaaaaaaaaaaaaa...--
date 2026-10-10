import { BUILDINGS, DAY_LENGTH, DEFAULT_MODS, MAP_H, MAP_W, T, TILE } from './defs';
import type { BuildingType, CityMods, Resource } from './defs';
import { generateMap } from './world';

export type BuildingStatus = 'building' | 'ok' | 'idle' | 'noPower' | 'noInput' | 'noFuel';

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
}

export interface Hints {
  free: number; // free hints left
  paid: number; // hints bought so far (drives the price)
  nextFreeDay: number; // day a free hint recharges
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
  tiles: Uint8Array;
  amount: Uint16Array; // junk per tile
  occ: Int32Array; // building id per tile or -1 (derived, not saved)
  claims: Uint8Array; // bots heading to each junk tile (derived, not saved)
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
    hints: { free: FREE_HINTS, paid: 0, nextFreeDay: 6 },
    warnedFullAt: -999,
    tiles: map.tiles,
    amount: map.amount,
    occ: new Int32Array(MAP_W * MAP_H).fill(-1),
    claims: new Uint8Array(MAP_W * MAP_H),
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
    objective: 0,
    stats: { scrapCollected: 0, built: 0, cleaned: 0, creditsEarned: 0, maxPollution: mods.startPollution, industrialBuilt: 0, catPets: 0, partsMade: 0 },
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
      s.occ[idx(x + dx, y + dy)] = b.id;
    }
  }
  return b;
}

export function removeBuilding(s: GameState, b: Building): void {
  const def = BUILDINGS[b.type];
  s.buildings = s.buildings.filter((o) => o.id !== b.id);
  for (let dy = 0; dy < def.h; dy++) {
    for (let dx = 0; dx < def.w; dx++) {
      s.occ[idx(b.x + dx, b.y + dy)] = -1;
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
type SaveData = Omit<GameState, 'tiles' | 'amount' | 'occ' | 'claims' | 'bots' | 'derived' | 'dirtyTiles' | 'fx' | 'messages'> & {
  tiles: string;
  amount: number[];
};

export function serialize(s: GameState): string {
  const { tiles, amount, occ: _occ, claims: _claims, bots: _bots, derived: _derived, dirtyTiles: _dirty, fx: _fx, messages: _messages, ...rest } = s;
  const data: SaveData = { ...rest, tiles: Array.from(tiles).join(''), amount: Array.from(amount) };
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
  const s: GameState = {
    ...base,
    ...(d as Omit<SaveData, 'tiles' | 'amount'>),
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
  }
  s.nextId = Math.max(d.nextId, ...s.buildings.map((b) => b.id + 1));
  return s;
}
