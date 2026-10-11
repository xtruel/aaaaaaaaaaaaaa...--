// Objects & modules (modular building, increment 1): what the catalog panel, the module section of the building
// panel and the panel of a selected piece say. The rules and numbers come from the core (game/pieces.ts); this
// only puts them into words, so it has no DOM and can be tested on its own.
import { canAfford, costText } from '../game/actions';
import { MAP_W, T } from '../game/defs';
import type { BuildingType, Cost, Resource } from '../game/defs';
import { CATALOG_ORDER, MODULES, PIECES, buildingStats, buildingStatsWith, fenceMask, installedModules, isModuleKind, isPieceKind, moduleCheck, pieceRefund, pieceRefundAt, solidKind } from '../game/pieces';
import type { BuildingStats, CatalogKind, ModuleKind, PieceKind } from '../game/pieces';
import { idx, inBounds } from '../game/state';
import type { Building, GameState } from '../game/state';
import { t, tk } from '../i18n';
import type { Key } from '../i18n';

// The catalog's sections: Construction (floor, fence, gate), Decorations (the lamp and increment 2's six) and
// Machine modules, each in catalog order.
export const CONSTRUCTION = CATALOG_ORDER.filter((k): k is PieceKind => isPieceKind(k) && !PIECES[k].decoration);
export const DECORATIONS = CATALOG_ORDER.filter((k): k is PieceKind => isPieceKind(k) && !!PIECES[k].decoration);
export const MACHINE_MODULES = CATALOG_ORDER.filter(isModuleKind);

export function catalogName(kind: CatalogKind): string {
  return tk(isPieceKind(kind) ? `pc.${kind}` : `mod.${kind}`);
}

export function catalogCost(kind: CatalogKind): Cost {
  return isPieceKind(kind) ? PIECES[kind].cost : MODULES[kind].cost;
}

// Fence (alone), gate, lamp and the decorations with directions turn; the floor, the planter and the modules do not.
export function isRotatable(kind: CatalogKind | null | undefined): boolean {
  return isPieceKind(kind) && PIECES[kind].rotations > 1;
}

// Floors and fences can be laid in a row with a mouse drag.
export function isRowKind(kind: CatalogKind | null | undefined): boolean {
  return kind === 'floor' || kind === 'fence';
}

// The part of a price the city cannot pay yet.
export function shortfall(s: GameState, cost: Cost): Cost {
  const out: Cost = {};
  for (const r of Object.keys(cost) as Resource[]) {
    const miss = Math.ceil((cost[r] ?? 0) - s.res[r]);
    if (miss > 0) out[r] = miss;
  }
  return out;
}

// Where a module can go, in the words of moduleCheck (which needs a building to say it).
const NEEDS: Record<ModuleKind, Key> = { dockStorage: 'place.modDock', smelterFilter: 'place.modSmelter' };

export function moduleNeeds(kind: ModuleKind): string {
  return t(NEEDS[kind]);
}

export interface CatalogState {
  ok: boolean;
  reason?: string; // why it cannot be bought or used right now
}

function missing(s: GameState, cost: Cost): CatalogState {
  return { ok: false, reason: t('cat.missing', { cost: costText(shortfall(s, cost)) }) };
}

// Can the item be bought somewhere in this city now? A piece needs its price; a module also needs a finished
// building of its type that does not have it yet.
export function catalogState(s: GameState, kind: CatalogKind): CatalogState {
  const cost = catalogCost(kind);
  if (isPieceKind(kind)) return canAfford(s, cost) ? { ok: true } : missing(s, cost);
  const targets = s.buildings.filter((b) => b.type === MODULES[kind].building && b.built >= 1);
  if (!targets.length) return { ok: false, reason: moduleNeeds(kind) };
  const checks = targets.map((b) => moduleCheck(s, kind, b));
  if (checks.some((c) => c.ok)) return { ok: true };
  if (checks.some((c) => c.costOnly)) return missing(s, cost);
  return { ok: false, reason: t('place.modInstalled') };
}

// Can `kind` go on this building now? moduleCheck's answer, with what is missing instead of the full price.
export function installState(s: GameState, kind: ModuleKind, b: Building): CatalogState {
  const check = moduleCheck(s, kind, b);
  if (check.ok) return { ok: true };
  return check.costOnly ? missing(s, MODULES[kind].cost) : { ok: false, reason: check.reason };
}

// ---------- numbers before -> after ----------

export interface EffectRow {
  stat: 'storage' | 'smog' | 'energy';
  before: string;
  after: string;
}

const signed = (n: number) => `${n > 0 ? '+' : ''}${n}`;
// smog per day, as the building panel shows it (a day is 60 seconds)
const perDay = (pollution: number) => `${pollution > 0 ? '+' : ''}${(pollution * 60).toFixed(1)}`;

function rows(before: Readonly<BuildingStats>, after: Readonly<BuildingStats>): EffectRow[] {
  const out: EffectRow[] = [];
  if (before.storage !== after.storage) out.push({ stat: 'storage', before: `${before.storage}`, after: `${after.storage}` });
  if (before.pollution !== after.pollution) out.push({ stat: 'smog', before: perDay(before.pollution), after: perDay(after.pollution) });
  if (before.energy !== after.energy) out.push({ stat: 'energy', before: signed(before.energy), after: signed(after.energy) });
  return out;
}

// What a module changes on a building of `type` that has the `others` modules too: the rows that differ.
export function moduleRows(type: BuildingType, kind: ModuleKind, others: readonly ModuleKind[] = []): EffectRow[] {
  const rest = others.filter((k) => k !== kind);
  return rows(buildingStatsWith({ type }, rest), buildingStatsWith({ type }, [...rest, kind]));
}

// One line for the catalog: "Bot Dock storage 80 → 180 scrap".
export function catalogEffect(kind: CatalogKind): string {
  if (isPieceKind(kind)) return tk(`pc.${kind}.effect`);
  const v = Object.fromEntries(moduleRows(MODULES[kind].building, kind).flatMap((r) => [[`${r.stat}0`, r.before], [`${r.stat}1`, r.after]]));
  return tk(`mod.${kind}.effect`, v);
}

export function catalogLimit(kind: CatalogKind): string {
  return isPieceKind(kind) ? t('cat.limitTile') : tk(`mod.${kind}.limit`);
}

const ROW_LABEL: Record<EffectRow['stat'], Key> = { storage: 'insp.storage', smog: 'insp.smog', energy: 'insp.energy' };

export function rowLabel(row: EffectRow): string {
  return t(ROW_LABEL[row.stat]);
}

// The text shown on the map next to a building a module would go on: "Storage 80 -> 180". The map's pixel font
// has no arrow, so it is written with "->".
export function moduleLabel(b: Building, kind: ModuleKind): string {
  const short: Record<EffectRow['stat'], Key> = { storage: 'insp.storage', smog: 'hud.smog', energy: 'insp.energy' };
  return moduleRows(b.type, kind, installedModules(b))
    .map((r) => `${t(short[r.stat])} ${r.before} -> ${r.after}`)
    .join(', ');
}

// ---------- scrap lost with storage ----------

// Scrap that goes when the city's storage drops by `drop` (removing a storage module, demolishing a Dock):
// what is above the new capacity is lost, as computeStorage does.
export function scrapLost(s: GameState, drop: number): number {
  if (drop <= 0) return 0;
  return Math.max(0, Math.floor(s.res.scrap - Math.max(0, s.derived.storage - drop)));
}

// How much storage taking `kind` off b removes.
export function moduleStorageDrop(b: Building, kind: ModuleKind): number {
  const now = buildingStats(b).storage;
  return now - buildingStatsWith(b, installedModules(b).filter((k) => k !== kind)).storage;
}

// How much storage demolishing b removes (an unfinished building adds none yet).
export function demolishStorageDrop(b: Building): number {
  return b.built >= 1 ? buildingStats(b).storage : 0;
}

// ---------- a selected piece ----------

export interface PieceInfo {
  kind: PieceKind;
  x: number;
  y: number;
  rotatable: boolean; // gate, lamp, a fence that stands alone, the decorations with directions
  removable: boolean;
  refund: Cost; // what Remove gives back now: pieceRefundAt, which removePieceAt pays
  scrapShort: number; // scrap of the refund that storage has no room for (the sculpture's), 0 when it all fits
}

// The solid piece on tile index i, else its floor: what the panel of a selected piece shows.
export function pieceInfo(s: GameState, i: number): PieceInfo | null {
  if (i < 0 || i >= s.solid.length) return null;
  const x = i % MAP_W;
  const y = Math.floor(i / MAP_W);
  const solid = solidKind(s.solid[i]);
  const money = (kind: PieceKind) => {
    const refund = pieceRefundAt(s, kind);
    return { refund, scrapShort: (pieceRefund(kind).scrap ?? 0) - (refund.scrap ?? 0) };
  };
  if (solid) {
    const rotatable = PIECES[solid].rotations > 1 && !(solid === 'fence' && fenceMask(s, x, y) !== 0);
    return { kind: solid, x, y, rotatable, removable: true, ...money(solid) };
  }
  if (!s.floor[i]) return null;
  // removePieceAt only takes up a bare floor (not under a building, junk, sludge or rubble)
  const removable = s.occ[i] === -1 && (s.tiles[i] === T.GROUND || s.tiles[i] === T.GRASS);
  return { kind: 'floor', x, y, rotatable: false, removable, ...money('floor') };
}

// ---------- the bulldozer ----------

// What a bulldozer click acts on: a building (selected: its panel demolishes it), rubble (cleared), a fence, gate,
// lamp or bare floor (taken up), or nothing (the tile index, -1 off the map). Worked out from what is drawn under
// the pointer (`picked`: the building whose pixels are there, else -1, or -2 for the cat; `drawnPiece`: the fence,
// gate or lamp drawn there, else a piece or floor on the tile, else -1) and the ground tile under it. The click and
// the highlight under the pointer both come from here, so what is highlighted is what the click does. A building
// drawn there is the target unless the ground tile holds rubble or a fence, gate or lamp: a building in front can
// hide those entirely (the bulldozer draws it see-through), and they are cleared instead.
export type DozeTarget = { kind: 'building'; id: number } | { kind: 'rubble' | 'piece' | 'nothing'; i: number };

export function dozeTarget(s: GameState, tx: number, ty: number, picked: number, drawnPiece: () => number): DozeTarget {
  const ground = inBounds(tx, ty) ? idx(tx, ty) : -1;
  const hidden = ground >= 0 && s.occ[ground] === -1 && (s.tiles[ground] === T.RUBBLE || s.solid[ground] !== 0);
  if (picked >= 0 && !hidden) return { kind: 'building', id: picked };
  const piece = drawnPiece();
  if (piece >= 0) return { kind: 'piece', i: piece };
  if (ground < 0) return { kind: 'nothing', i: -1 };
  if (s.tiles[ground] === T.RUBBLE) return { kind: 'rubble', i: ground };
  if (s.occ[ground] !== -1) return { kind: 'building', id: s.occ[ground] };
  return { kind: pieceInfo(s, ground)?.removable ? 'piece' : 'nothing', i: ground };
}
