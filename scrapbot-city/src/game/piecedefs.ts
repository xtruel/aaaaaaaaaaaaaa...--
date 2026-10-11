// Modular building, increment 1: static data for the pieces (floor, fence, gate, lamp) and the machine
// modules (Dock storage, Smelter filter), plus the pure helpers that the sim, the saves and the actions need.
// Increment 2 (G2) adds six decorations: bench, planter, neon sign, pergola, Miso's house, scrap sculpture.
// The rules that change a city (buying, removing, rotating) live in pieces.ts, which re-exports all of this:
// the UI and the renderer import from './pieces'. This file only depends on defs.ts and world.ts (which only
// depends on defs.ts), so state.ts, actions.ts and sim.ts can use it without import cycles.
import { BUILDINGS } from './defs';
import type { BuildingType, Cost, Resource } from './defs';
import type { GameState } from './state';
import { hash2 } from './world';

export type PieceKind = 'floor' | 'fence' | 'gate' | 'lamp' | 'bench' | 'planter' | 'sign' | 'pergola' | 'cathouse' | 'sculpture';
export type SolidKind = Exclude<PieceKind, 'floor'>;
export type ModuleKind = 'dockStorage' | 'smelterFilter';
export type CatalogKind = PieceKind | ModuleKind;

export interface PieceDef {
  kind: PieceKind;
  layer: 'surface' | 'solid';
  cost: Cost;
  rotations: 1 | 2 | 4;
  joins: boolean; // part of a fence line: fences next to it connect to it (fence, gate)
  decoration?: true; // in the catalog's Decorations (the lamp and the increment-2 decorations); else Construction
  varieties?: number; // looks chosen by the tile (planter flowers, sign motif): see pieceVariety
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
  lamp: { kind: 'lamp', layer: 'solid', cost: { credits: 10, parts: 2 }, rotations: 4, joins: false, decoration: true },
  // increment 2 (docs/MODULAR-INC2.md §3): solid 1x1 decorations, refund half the price (the sculpture's scrap only as
  // far as the storage has room: pieceRefundAt). Directions as the lamp's: 0 +x, 1 +y, 2 -x, 3 -y; the pergola 0
  // along x, 1 along y.
  bench: { kind: 'bench', layer: 'solid', cost: { credits: 6 }, rotations: 4, joins: false, decoration: true },
  planter: { kind: 'planter', layer: 'solid', cost: { credits: 5 }, rotations: 1, joins: false, decoration: true, varieties: 2 },
  sign: { kind: 'sign', layer: 'solid', cost: { credits: 15, parts: 4 }, rotations: 4, joins: false, decoration: true, varieties: 3 },
  pergola: { kind: 'pergola', layer: 'solid', cost: { credits: 12 }, rotations: 2, joins: false, decoration: true },
  cathouse: { kind: 'cathouse', layer: 'solid', cost: { credits: 10 }, rotations: 4, joins: false, decoration: true },
  sculpture: { kind: 'sculpture', layer: 'solid', cost: { credits: 10, scrap: 20 }, rotations: 4, joins: false, decoration: true },
};

export const MODULES: Record<ModuleKind, ModuleDef> = {
  // Dock storage 80 -> 180
  dockStorage: { kind: 'dockStorage', building: 'dock', slot: 'roof', cost: { credits: 30, parts: 15 }, limit: 1, storage: 100 },
  // Smelter pollution 0.035 -> 0.014 /s, energy -2 -> -3, same output
  smelterFilter: { kind: 'smelterFilter', building: 'smelter', slot: 'side', cost: { credits: 45, parts: 20 }, limit: 1, pollutionMul: 0.4, energy: -1 },
};

export const CATALOG_ORDER: CatalogKind[] = [
  'floor',
  'fence',
  'gate',
  'lamp',
  'bench',
  'planter',
  'sign',
  'pergola',
  'cathouse',
  'sculpture',
  'dockStorage',
  'smelterFilter',
];

// Codes stored in GameState.solid and in saves (0 = nothing). Saved games keep these numbers: only append
// (docs/MODULAR-INC2.md §3: 4 bench ... 9 sculpture; 10..14 are taken by increment 2's G3 pieces).
const SOLID_CODES: readonly (SolidKind | null)[] = [null, 'fence', 'gate', 'lamp', 'bench', 'planter', 'sign', 'pergola', 'cathouse', 'sculpture'];

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

// Which look a piece with varieties has on tile (x, y): the planter's flowers (0 tulips, 1 sunflowers), the sign's
// motif (0 bot face, 1 recycle arrows, 2 heart). Fixed by the tile, so the ghost shows what will stand there and a
// save needs nothing more; 0 for the other pieces.
const VARIETY_SALT: Partial<Record<PieceKind, number>> = { planter: 53, sign: 59 };

export function pieceVariety(kind: PieceKind, x: number, y: number): number {
  const n = PIECES[kind]?.varieties ?? 1;
  return n > 1 ? Math.min(n - 1, Math.floor(hash2(x, y, VARIETY_SALT[kind] ?? 61) * n)) : 0;
}

// True when a solid piece (fence, gate, lamp or decoration) stands on tile index i (citizens walk around it, junk
// never lands on it).
export function isSolidAt(s: GameState, i: number): boolean {
  return i >= 0 && i < s.solid.length && s.solid[i] !== 0;
}

// ---------- refunds ----------

function half(cost: Cost): Cost {
  const out: Cost = {};
  for (const r of Object.keys(cost) as Resource[]) out[r] = Math.floor((cost[r] ?? 0) * 0.5);
  return out;
}

// What removing a piece gives back at most: half its price, rounded down (floor 1, fence 2, gate 6, lamp 5 + 1 part,
// bench 3, planter 2, sign 7 + 2 parts, pergola 6, Miso's house 5, sculpture 5 + 10 scrap). The catalog's figure.
export function pieceRefund(kind: PieceKind): Cost {
  return half(PIECES[kind].cost);
}

// What removing a piece of `kind` really gives back in this city now: pieceRefund, with the scrap (the sculpture's)
// no more than the room left in storage. removePieceAt pays exactly this and the interface shows exactly this.
export function pieceRefundAt(s: GameState, kind: PieceKind): Cost {
  const out = pieceRefund(kind);
  if (out.scrap !== undefined) out.scrap = Math.max(0, Math.min(out.scrap, Math.floor((s.derived.storage || 0) - s.res.scrap)));
  return out;
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
