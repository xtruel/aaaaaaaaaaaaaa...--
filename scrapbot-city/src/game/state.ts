import { BUILDINGS, DAY_LENGTH, MAP_H, MAP_W, T, TILE } from './defs';
import type { BuildingType, Resource } from './defs';
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

export type FxKind = 'collect' | 'built' | 'produce' | 'clean' | 'placed' | 'demolish' | 'storm';

export interface FxEvent {
  kind: FxKind;
  x: number; // world px
  y: number;
  text?: string;
  color?: string;
}

export interface Stats {
  scrapCollected: number;
  built: number;
  cleaned: number;
  creditsEarned: number;
}

export interface GameState {
  version: number;
  seed: number;
  cityName: string;
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

export const SAVE_VERSION = 1;

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

export function createGame(seed = Math.floor(Math.random() * 1e9), cityName = 'Scrapbot City'): GameState {
  const map = generateMap(seed);
  const s: GameState = {
    version: SAVE_VERSION,
    seed,
    cityName,
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
    res: { scrap: 0, parts: 40, credits: 150 },
    pop: 0,
    pollution: 15,
    alignment: 0,
    happyMod: 0,
    time: 0,
    waste: 0,
    smog: 0,
    nextEventAt: 95,
    nextStormAt: 200,
    overtimeUntil: 0,
    botSpeedMul: 1,
    eventsSeen: [],
    objective: 0,
    stats: { scrapCollected: 0, built: 0, cleaned: 0, creditsEarned: 0 },
    outcome: null,
    derived: emptyDerived(),
    dirtyTiles: [],
    fx: [],
    messages: [],
    pendingEvent: null,
  };
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

interface SaveData {
  version: number;
  seed: number;
  cityName: string;
  tiles: string;
  amount: number[];
  buildings: Building[];
  nextId: number;
  cat: Cat;
  res: Record<Resource, number>;
  pop: number;
  pollution: number;
  alignment: number;
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
}

export function serialize(s: GameState): string {
  const data: SaveData = {
    version: s.version,
    seed: s.seed,
    cityName: s.cityName,
    tiles: Array.from(s.tiles).join(''),
    amount: Array.from(s.amount),
    buildings: s.buildings,
    nextId: s.nextId,
    cat: s.cat,
    res: s.res,
    pop: s.pop,
    pollution: s.pollution,
    alignment: s.alignment,
    happyMod: s.happyMod,
    time: s.time,
    waste: s.waste,
    smog: s.smog,
    nextEventAt: s.nextEventAt,
    nextStormAt: s.nextStormAt,
    overtimeUntil: s.overtimeUntil,
    botSpeedMul: s.botSpeedMul,
    eventsSeen: s.eventsSeen,
    objective: s.objective,
    stats: s.stats,
    outcome: s.outcome,
  };
  return JSON.stringify(data);
}

export function deserialize(json: string): GameState {
  const d = JSON.parse(json) as SaveData;
  if (d.version !== SAVE_VERSION) throw new Error(`Unsupported save version ${d.version}`);
  const size = MAP_W * MAP_H;
  if (d.tiles.length !== size || d.amount.length !== size) throw new Error('Corrupted save: wrong map size');
  const tiles = new Uint8Array(size);
  for (let i = 0; i < size; i++) tiles[i] = Number(d.tiles[i]) || T.GROUND;
  const s: GameState = {
    ...d,
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
    pendingEvent: null,
  };
  for (const b of d.buildings) {
    const placed = addBuilding(s, b.type, b.x, b.y, b.id);
    Object.assign(placed, b);
  }
  s.nextId = Math.max(d.nextId, ...s.buildings.map((b) => b.id + 1));
  return s;
}
