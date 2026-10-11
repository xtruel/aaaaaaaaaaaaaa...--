// Modular building, increment 1: static data for the pieces (floor, fence, gate, lamp) and the machine
// modules (Dock storage, Smelter filter), plus the pure helpers that the sim, the saves and the actions need.
// The rules that change a city (buying, removing, rotating) live in pieces.ts, which re-exports all of this:
// the UI and the renderer import from './pieces'. This file only depends on defs.ts, so state.ts, actions.ts
// and sim.ts can use it without import cycles.
import { BUILDINGS } from './defs';
import type { BuildingType, Cost, Resource } from './defs';
import type { GameState } from './state';

export type PieceKind = 'floor' | 'fence' | 'gate' | 'lamp';
export type SolidKind = Exclude<PieceKind, 'floor'>;
export type ModuleKind = 'dockStorage' | 'smelterFilter';
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
};

export const CATALOG_ORDER: CatalogKind[] = ['floor', 'fence', 'gate', 'lamp', 'dockStorage', 'smelterFilter'];

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

// The modules that really count on a building of this type: known kinds that fit it, each once, in catalog order.
export function modulesFor(type: BuildingType, list: readonly unknown[] | undefined): ModuleKind[] {
  if (!Array.isArray(list) || list.length === 0) return [];
  return (CATALOG_ORDER.filter((k) => isModuleKind(k) && MODULES[k].building === type && list.includes(k)) as ModuleKind[]);
}

export function installedModules(b: { type: BuildingType; modules?: readonly ModuleKind[] }): ModuleKind[] {
  return modulesFor(b.type, b.modules);
}

export interface BuildingStats {
  energy: number; // + produces, - consumes
  pollution: number; // per second at full power (negative = cleans the air)
  storage: number;
}

// Building numbers without modules, shared (and frozen) so the sim does not allocate for every building every step.
const BASE_STATS = Object.fromEntries(
  (Object.keys(BUILDINGS) as BuildingType[]).map((type) => {
    const def = BUILDINGS[type];
    return [type, Object.freeze({ energy: def.energy, pollution: def.pollution, storage: def.storage ?? 0 })];
  }),
) as Record<BuildingType, Readonly<BuildingStats>>;

// Effective numbers of a building of b.type if it had `modules` installed (for the before/after in the UI).
// Modules that do not fit the building, and repeats, are ignored.
export function buildingStatsWith(b: { type: BuildingType }, modules: readonly ModuleKind[]): Readonly<BuildingStats> {
  const fit = modulesFor(b.type, modules);
  const base = BASE_STATS[b.type];
  if (fit.length === 0) return base;
  let { energy, pollution, storage } = base;
  for (const k of fit) {
    const m = MODULES[k];
    storage += m.storage ?? 0;
    pollution *= m.pollutionMul ?? 1;
    energy += m.energy ?? 0;
  }
  return { energy, pollution, storage };
}

// Effective numbers of a building with the modules it has: the only source the sim uses for energy,
// pollution and storage.
export function buildingStats(b: { type: BuildingType; modules?: readonly ModuleKind[] }): Readonly<BuildingStats> {
  if (!b.modules || b.modules.length === 0) return BASE_STATS[b.type];
  return buildingStatsWith(b, b.modules);
}
