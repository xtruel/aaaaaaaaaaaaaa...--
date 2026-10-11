// Modular building, increments 1 and 2: static data for the pieces (floor, fence, gate, lamp) and the machine
// modules (Dock storage and Smelter filter; magnet, sorter, double arm, capsule, tracker and nozzle), plus the pure
// helpers that the sim, the saves and the actions need.
// The rules that change a city (buying, removing, rotating) live in pieces.ts, which re-exports all of this:
// the UI and the renderer import from './pieces'. This file only depends on defs.ts, so state.ts, actions.ts
// and sim.ts can use it without import cycles.
import { BUILDINGS } from './defs';
import type { BuildingType, Cost, Resource } from './defs';
import type { GameState } from './state';

export type PieceKind = 'floor' | 'fence' | 'gate' | 'lamp';
export type SolidKind = Exclude<PieceKind, 'floor'>;
export type ModuleKind =
  | 'dockStorage'
  | 'smelterFilter'
  | 'recyclerMagnet'
  | 'recyclerSorter'
  | 'factoryArm'
  | 'podsCapsule'
  | 'solarTracker'
  | 'purifierNozzle';
export type CatalogKind = PieceKind | ModuleKind;

export interface PieceDef {
  kind: PieceKind;
  layer: 'surface' | 'solid';
  cost: Cost;
  rotations: 1 | 2 | 4;
  joins: boolean; // part of a fence line: fences next to it connect to it (fence, gate)
}

export interface ModuleDef {
  kind: ModuleKind;
  building: BuildingType;
  slot: 'side' | 'roof';
  cost: Cost;
  limit: 1;
  storage?: number; // added storage
  pollutionMul?: number; // multiplies the building's pollution
  energy?: number; // added to the building's energy (negative = consumes more)
  cycleMul?: number; // multiplies the seconds per cycle of the building's process (below 1 = faster)
  output?: Cost; // added to what one cycle of the process makes
  housing?: number; // added homes
  cleanRadius?: number; // added to the sludge-cleaning radius, in tiles (not to the 6 s between two tiles)
}

// Decorations: no happiness, resources, stars or achievements, and no pull on the green/industry meter.
export const PIECES: Record<PieceKind, PieceDef> = {
  floor: { kind: 'floor', layer: 'surface', cost: { credits: 3 }, rotations: 1, joins: false },
  // a fence follows its neighbours; its own rotation only shows while it stands alone
  fence: { kind: 'fence', layer: 'solid', cost: { credits: 4 }, rotations: 2, joins: true },
  gate: { kind: 'gate', layer: 'solid', cost: { credits: 12 }, rotations: 2, joins: true },
  lamp: { kind: 'lamp', layer: 'solid', cost: { credits: 10, parts: 2 }, rotations: 4, joins: false },
};

export const MODULES: Record<ModuleKind, ModuleDef> = {
  // Dock storage 80 -> 180
  dockStorage: { kind: 'dockStorage', building: 'dock', slot: 'roof', cost: { credits: 30, parts: 15 }, limit: 1, storage: 100 },
  // Smelter pollution 0.035 -> 0.014 /s, energy -2 -> -3, same output
  smelterFilter: { kind: 'smelterFilter', building: 'smelter', slot: 'side', cost: { credits: 45, parts: 20 }, limit: 1, pollutionMul: 0.4, energy: -1 },
  // Increment 2 (docs/MODULAR-INC2.md §2). Every building has one slot: the Recycler's two modules exclude each other.
  // Recycler cycle 2 -> 1.5 s (+33% parts and +33% scrap per second), energy -2 -> -4
  recyclerMagnet: { kind: 'recyclerMagnet', building: 'recycler', slot: 'side', cost: { credits: 40, parts: 15 }, limit: 1, cycleMul: 0.75, energy: -2 },
  // Recycler 3 scrap -> 3 parts instead of 2 (+50% parts per scrap), cycle 2 -> 3 s (same parts per second)
  recyclerSorter: { kind: 'recyclerSorter', building: 'recycler', slot: 'side', cost: { credits: 40, parts: 15 }, limit: 1, cycleMul: 1.5, output: { parts: 1 } },
  // 2PM Factory cycle 3 -> 2 s (+50% credits and parts used per second), energy -4 -> -6, smog 0.06 -> 0.09 /s
  factoryArm: { kind: 'factoryArm', building: 'factory', slot: 'side', cost: { credits: 90, parts: 30 }, limit: 1, cycleMul: 2 / 3, energy: -2, pollutionMul: 1.5 },
  // Bot Pods homes 6 -> 9, energy -1 -> -2
  podsCapsule: { kind: 'podsCapsule', building: 'pods', slot: 'roof', cost: { credits: 35, parts: 15 }, limit: 1, housing: 3, energy: -1 },
  // Solar Array energy +5 -> +7
  solarTracker: { kind: 'solarTracker', building: 'solar', slot: 'roof', cost: { credits: 60, parts: 40 }, limit: 1, energy: 2 },
  // Purifier sludge radius 5 -> 8 tiles, energy -3 -> -4; still one tile every 6 s, same air cleaning
  purifierNozzle: { kind: 'purifierNozzle', building: 'purifier', slot: 'side', cost: { credits: 50, parts: 30 }, limit: 1, cleanRadius: 3, energy: -1 },
};

export const CATALOG_ORDER: CatalogKind[] = [
  'floor',
  'fence',
  'gate',
  'lamp',
  'dockStorage',
  'smelterFilter',
  'recyclerMagnet',
  'recyclerSorter',
  'factoryArm',
  'podsCapsule',
  'solarTracker',
  'purifierNozzle',
];

// Codes stored in GameState.solid and in saves (0 = nothing). Saved games keep these numbers: only append.
const SOLID_CODES: readonly (SolidKind | null)[] = [null, 'fence', 'gate', 'lamp'];

export function solidCode(kind: SolidKind): number {
  return SOLID_CODES.indexOf(kind);
}

export function solidKind(code: number): SolidKind | null {
  return SOLID_CODES[code] ?? null;
}

export function isPieceKind(v: unknown): v is PieceKind {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(PIECES, v);
}

export function isModuleKind(v: unknown): v is ModuleKind {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(MODULES, v);
}

// Any rotation (negative, too large, not a number) brought into 0..rotations-1.
export function normRot(kind: PieceKind, rot: number): number {
  const n = PIECES[kind].rotations;
  const r = Number.isFinite(rot) ? Math.trunc(rot) : 0;
  return ((r % n) + n) % n;
}

// True when a fence, gate or lamp stands on tile index i (citizens walk around it, junk never lands on it).
export function isSolidAt(s: GameState, i: number): boolean {
  return i >= 0 && i < s.solid.length && s.solid[i] !== 0;
}

// ---------- refunds ----------

function half(cost: Cost): Cost {
  const out: Cost = {};
  for (const r of Object.keys(cost) as Resource[]) out[r] = Math.floor((cost[r] ?? 0) * 0.5);
  return out;
}

// What removing a piece gives back: half its price, rounded down (floor 1, fence 2, gate 6, lamp 5 + 1 part).
export function pieceRefund(kind: PieceKind): Cost {
  return half(PIECES[kind].cost);
}

// What removing a module gives back: half its price, rounded down.
export function moduleRefund(kind: ModuleKind): Cost {
  return half(MODULES[kind].cost);
}

// ---------- modules and building numbers ----------

// The module that really counts on a building of this type, as a list of at most one: every building has a single
// module slot, so it is the first known kind in the list that fits the type (a damaged save cannot stack two, nor put
// the Recycler's magnet and sorter on together; extra entries and repeats are ignored).
export function modulesFor(type: BuildingType, list: readonly unknown[] | undefined): ModuleKind[] {
  if (!Array.isArray(list) || list.length === 0) return [];
  for (const k of list) if (isModuleKind(k) && MODULES[k].building === type) return [k];
  return [];
}

export function installedModules(b: { type: BuildingType; modules?: readonly ModuleKind[] }): ModuleKind[] {
  return modulesFor(b.type, b.modules);
}

// The numbers of a building at full power, with its module: the only source the sim uses for them.
export interface BuildingStats {
  energy: number; // + produces, - consumes
  pollution: number; // per second at full power (negative = cleans the air)
  storage: number;
  housing: number; // homes (citizens)
  cycle: number; // seconds per process cycle at full power (0 = no process)
  input: Readonly<Cost>; // what one cycle takes ({} without a process)
  output: Readonly<Cost>; // what one cycle makes ({} without a process)
  cleanRadius: number; // sludge-cleaning radius in tiles (0 = does not clean sludge)
}

const NO_COST: Readonly<Cost> = Object.freeze({});

// Building numbers without modules, shared (and frozen) so the sim does not allocate for every building every step.
const BASE_STATS = Object.fromEntries(
  (Object.keys(BUILDINGS) as BuildingType[]).map((type) => {
    const def = BUILDINGS[type];
    const p = def.process;
    const stats: BuildingStats = {
      energy: def.energy,
      pollution: def.pollution,
      storage: def.storage ?? 0,
      housing: def.housing ?? 0,
      cycle: p ? p.time : 0,
      input: p ? Object.freeze({ ...p.input }) : NO_COST,
      output: p ? Object.freeze({ ...p.output }) : NO_COST,
      cleanRadius: def.cleanRadius ?? 0,
    };
    return [type, Object.freeze(stats)];
  }),
) as Record<BuildingType, Readonly<BuildingStats>>;

// Numbers of a building of b.type if it had `modules` installed (for the before/after in the UI). Only the one
// module that fits the slot counts (see modulesFor).
export function buildingStatsWith(b: { type: BuildingType }, modules: readonly ModuleKind[]): Readonly<BuildingStats> {
  const fit = modulesFor(b.type, modules);
  return fit.length ? withModule(b.type, fit[0]) : BASE_STATS[b.type];
}

// One frozen object per building type and module (there are only a handful), so the sim does not allocate either.
const MODULE_STATS = new Map<string, Readonly<BuildingStats>>();

function withModule(type: BuildingType, kind: ModuleKind): Readonly<BuildingStats> {
  const key = `${type}+${kind}`;
  const known = MODULE_STATS.get(key);
  if (known) return known;
  const base = BASE_STATS[type];
  const m = MODULES[kind];
  let output = base.output;
  if (base.cycle > 0 && m.output) {
    const more: Cost = { ...output };
    for (const r of Object.keys(m.output) as Resource[]) more[r] = (more[r] ?? 0) + (m.output[r] ?? 0);
    output = Object.freeze(more);
  }
  const stats: Readonly<BuildingStats> = Object.freeze({
    energy: base.energy + (m.energy ?? 0),
    pollution: base.pollution * (m.pollutionMul ?? 1),
    storage: base.storage + (m.storage ?? 0),
    housing: base.housing + (m.housing ?? 0),
    cycle: base.cycle * (base.cycle > 0 ? (m.cycleMul ?? 1) : 1),
    input: base.input,
    output,
    cleanRadius: base.cleanRadius + (m.cleanRadius ?? 0),
  });
  MODULE_STATS.set(key, stats);
  return stats;
}

// Numbers of a building with the module it has: the only source the sim uses for energy, pollution, storage,
// homes, the process cycle (seconds, input, output) and the sludge-cleaning radius.
export function buildingStats(b: { type: BuildingType; modules?: readonly ModuleKind[] }): Readonly<BuildingStats> {
  if (!b.modules || b.modules.length === 0) return BASE_STATS[b.type];
  return buildingStatsWith(b, b.modules);
}
