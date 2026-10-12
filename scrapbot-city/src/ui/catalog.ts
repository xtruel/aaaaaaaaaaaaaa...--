// Objects & modules (modular building, increment 1): what the catalog panel, the module section of the building
// panel and the panel of a selected piece say. The rules and numbers come from the core (game/pieces.ts); this
// only puts them into words, so it has no DOM and can be tested on its own.
import { canAfford, costText } from '../game/actions';
import { BUILDINGS, MAP_W, T } from '../game/defs';
import type { BuildingType, Cost, Resource } from '../game/defs';
import { citizensLost, effectiveStats, statusInfo } from '../game/economy';
import type { EffectiveStats, StatusCause } from '../game/economy';
import { CATALOG_ORDER, MODULES, PIECES, buildingStats, buildingStatsWith, fenceMask, installedModules, isModuleKind, isPieceKind, moduleCheck, moduleNeeds, pieceRefund, pieceRefundAt, solidKind } from '../game/pieces';
import type { BuildingStats, CatalogKind, ModuleKind, PieceKind } from '../game/pieces';
import { CLEAN_EVERY, energyEffect } from '../game/sim';
import { idx, inBounds } from '../game/state';
import type { Building, GameState } from '../game/state';
import { t, tk } from '../i18n';
import type { Key } from '../i18n';
import { buildingBehind } from './pick';

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

// What the controller's Y (and R) does with `kind` in hand: turn it, say it does not turn, or, with no catalog item
// in hand, ask USA-9 for a hint (Y only). Never a hint with a catalog item in hand: a hint can use up a free one or
// cost credits.
export function turnKey(kind: CatalogKind | null | undefined): 'turn' | 'noTurn' | 'hint' {
  if (!kind) return 'hint';
  return isRotatable(kind) ? 'turn' : 'noTurn';
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

// Where a module can go, in the words of moduleCheck (which needs a building to say it): core's moduleNeeds.
export { moduleNeeds } from '../game/pieces';

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
  // already installed, or the slot taken by the other module (moduleCheck's own words)
  return { ok: false, reason: checks.find((c) => c.reason)?.reason ?? t('place.modInstalled') };
}

// Can `kind` go on this building now? moduleCheck's answer, with what is missing instead of the full price.
export function installState(s: GameState, kind: ModuleKind, b: Building): CatalogState {
  const check = moduleCheck(s, kind, b);
  if (check.ok) return { ok: true };
  return check.costOnly ? missing(s, MODULES[kind].cost) : { ok: false, reason: check.reason };
}

// ---------- numbers: nominal (full power), before -> after, and now ----------

// What a row of numbers is about. A module's rows come in this order: what it is for first, then what it costs to
// run (made / used a minute, smog, energy).
export type RowStat = 'storage' | 'homes' | 'radius' | 'output' | 'cycle' | 'made' | 'used' | 'smog' | 'energy';

export interface EffectRow {
  stat: RowStat;
  res?: Resource; // output, made, used: which resource
  before: string;
  after: string;
  now?: string; // the value the sim applies right now (only for a module installed on a building: moduleRowsOn)
}

const signed = (n: number) => `${n > 0 ? '+' : ''}${n}`;
// smog per day, as the building panel shows it (a day is 60 seconds)
const perDay = (pollution: number) => `${pollution > 0 ? '+' : ''}${(pollution * 60).toFixed(1)}`;
// seconds, to the tenth: 2, 1.5, 1.9
const secs = (n: number) => `${Math.round(n * 10) / 10}`;
// an amount a minute (per second x 60): whole above 10, else to the tenth
function perMin(perSecond: number): string {
  const n = perSecond * 60;
  return `${n >= 10 ? Math.round(n) : Math.round(n * 10) / 10}`;
}
// "180 scrap", "1 scrap" (costText would write 0 as "free")
const scrapAmount = (n: number) => tk(n === 1 ? 'cost.scrap.one' : 'cost.scrap', { n });
const resources = (cost: Readonly<Cost>) => (Object.keys(cost) as Resource[]).filter((r) => (cost[r] ?? 0) > 0);

// A building's numbers at full power, as the rows show them. made / used: per minute at the nominal cycle (the
// cycle's amounts over its seconds: a change of unit, the same numbers the sim runs).
function nominal(st: Readonly<BuildingStats>, stat: RowStat, res?: Resource): string {
  switch (stat) {
    case 'storage':
      return `${st.storage}`;
    case 'homes':
      return `${st.housing}`;
    case 'radius':
      return `${st.cleanRadius}`;
    case 'output':
      return `${st.output[res!] ?? 0}`;
    case 'cycle':
      return secs(st.cycle);
    case 'made':
      return perMin(st.cycle > 0 ? (st.output[res!] ?? 0) / st.cycle : 0);
    case 'used':
      return perMin(st.cycle > 0 ? (st.input[res!] ?? 0) / st.cycle : 0);
    case 'smog':
      return perDay(st.pollution);
    case 'energy':
      return signed(st.energy);
  }
}

// The same number as the sim applies it right now (effectiveStats). A process holding its cycle for materials or for
// the parts reserve makes and uses nothing at the moment: its cycle "waits".
function current(eff: EffectiveStats, waiting: boolean, stat: RowStat, res?: Resource): string | undefined {
  const stopped = t('insp.stopped');
  switch (stat) {
    case 'storage':
      return `${eff.storage}`;
    case 'homes':
      return `${eff.housing}`;
    case 'radius':
    case 'output':
      return undefined; // power changes the pace, not the reach or the amounts
    case 'cycle':
      if (!Number.isFinite(eff.cycle)) return stopped;
      return waiting ? t('insp.waiting') : secs(eff.cycle);
    case 'made':
      return waiting ? '0' : perMin(eff.outputPerSecond[res!] ?? 0);
    case 'used':
      return waiting ? '0' : perMin(eff.inputPerSecond[res!] ?? 0);
    case 'smog':
      return perDay(eff.pollution);
    case 'energy':
      return signed(eff.energy);
  }
}

function waitingNow(s: GameState, b: Building): boolean {
  const cause = statusInfo(s, b).cause;
  return cause === 'noInput' || cause === 'reserve';
}

// The rows that differ between two sets of numbers; a change of cycle or output also shows what is made and used a
// minute, even when it stays the same (the sorter: same parts a minute, less scrap).
function rows(before: Readonly<BuildingStats>, after: Readonly<BuildingStats>): EffectRow[] {
  const out: EffectRow[] = [];
  const add = (stat: RowStat, res?: Resource) => out.push({ stat, ...(res ? { res } : {}), before: nominal(before, stat, res), after: nominal(after, stat, res) });
  if (before.storage !== after.storage) add('storage');
  if (before.housing !== after.housing) add('homes');
  if (before.cleanRadius !== after.cleanRadius) add('radius');
  const outs = [...new Set([...resources(before.output), ...resources(after.output)])];
  for (const r of outs) if ((before.output[r] ?? 0) !== (after.output[r] ?? 0)) add('output', r);
  const process = before.cycle > 0 || after.cycle > 0;
  const paced = process && (before.cycle !== after.cycle || out.some((o) => o.stat === 'output'));
  if (before.cycle !== after.cycle) add('cycle');
  if (paced) {
    for (const r of outs) add('made', r);
    for (const r of new Set([...resources(before.input), ...resources(after.input)])) add('used', r);
  }
  if (before.pollution !== after.pollution) add('smog');
  if (before.energy !== after.energy) add('energy');
  return out;
}

// What a module changes on a building of `type`, before -> after at full power. One slot per building: the "before"
// is always the building without modules, whatever another module would do in the same slot.
export function moduleRows(type: BuildingType, kind: ModuleKind): EffectRow[] {
  return rows(buildingStatsWith({ type }, []), buildingStatsWith({ type }, [kind]));
}

// moduleRows for a module on a building; installed there, each row also has its value now (effectiveStats).
export function moduleRowsOn(s: GameState, b: Building, kind: ModuleKind): EffectRow[] {
  const list = moduleRows(b.type, kind);
  if (!installedModules(b).includes(kind)) return list;
  const eff = effectiveStats(s, b);
  const waiting = waitingNow(s, b);
  return list.map((r) => {
    const now = current(eff, waiting, r.stat, r.res);
    return now === undefined ? r : { ...r, now };
  });
}

const ROW_LABEL: Record<Exclude<RowStat, 'output' | 'made' | 'used'>, Key> = {
  storage: 'insp.storage',
  homes: 'insp.homes',
  radius: 'insp.radius',
  cycle: 'insp.cycleTime',
  smog: 'insp.smog',
  energy: 'insp.energy',
};

export function rowLabel(row: { stat: RowStat; res?: Resource }): string {
  if (row.stat === 'output' || row.stat === 'made' || row.stat === 'used') return tk(`insp.${row.stat}.${row.res ?? 'parts'}`);
  return t(ROW_LABEL[row.stat]);
}

// One line for the catalog: "Bot Dock storage 80 → 180 scrap". The numbers come from moduleRows: {stat0} before,
// {stat1} after ({made0} / {made1} for the first resource made, {used0} / {used1} for the first used); {every}: the
// seconds between two sludge tiles a Purifier cleans.
export function catalogEffect(kind: CatalogKind): string {
  if (isPieceKind(kind)) return tk(`pc.${kind}.effect`);
  const v: Record<string, string> = { every: secs(CLEAN_EVERY) };
  for (const r of moduleRows(MODULES[kind].building, kind)) {
    if (`${r.stat}0` in v) continue;
    v[`${r.stat}0`] = r.before;
    v[`${r.stat}1`] = r.after;
  }
  return tk(`mod.${kind}.effect`, v);
}

export function catalogLimit(kind: CatalogKind): string {
  return isPieceKind(kind) ? t('cat.limitTile') : tk(`mod.${kind}.limit`);
}

// The text shown on the map next to a building a module would go on: "Storage 80 -> 180", "Cycle 2 -> 1.5 s,
// Energy -2 -> -4". The map's pixel font has no arrow, so it is written with "->". What is made and used a minute
// stays in the panel (the label would get too long to read over the map).
export function moduleLabel(b: Building, kind: ModuleKind): string {
  const one = (r: EffectRow) => {
    const change = `${r.before} -> ${r.after}`;
    if (r.stat === 'smog') return `${t('hud.smog')} ${change}`;
    if (r.stat === 'cycle') return `${t('insp.cycle')} ${change} s`;
    if (r.stat === 'radius') return t('insp.cleansValue', { n: change });
    return `${rowLabel(r)} ${change}`;
  };
  return moduleRows(b.type, kind)
    .filter((r) => r.stat !== 'made' && r.stat !== 'used')
    .map(one)
    .join(', ');
}

// ---------- the building panel: nominal and now, and why ----------

// A building's description with its own numbers (buildingStats): a module changes what the words say, the nozzle's 8
// tiles, the capsule's 9 homes, the trackers' +7, the sorter's 3 parts, the extra storage's +180. Without a building
// (the toolbar's tooltip), the plain building's numbers.
export function buildingDesc(b: Pick<Building, 'type'> & Partial<Pick<Building, 'modules'>>): string {
  const st = buildingStats(b);
  return tk(`b.${b.type}.desc`, {
    scrap: st.input.scrap ?? 0,
    parts: st.output.parts ?? 0,
    storage: st.storage,
    homes: st.housing,
    energy: st.energy,
    radius: st.cleanRadius,
  });
}


export interface PanelRow {
  key: string; // what the row shows ('energy', 'made.parts'...): the panel writes "now" into it in place
  label: string;
  nominal: string; // at full power, with the module installed (buildingStats)
  now: string | null; // what the sim applies right now (effectiveStats); null: does not change with power or state
}

// Every number of a building's panel: nominal from buildingStats, now from effectiveStats, nothing of its own.
export function buildingRows(s: GameState, b: Building): PanelRow[] {
  const def = BUILDINGS[b.type];
  const st = buildingStats(b);
  const eff = effectiveStats(s, b);
  const waiting = waitingNow(s, b);
  const out: PanelRow[] = [];
  const add = (stat: RowStat, res?: Resource) =>
    out.push({ key: res ? `${stat}.${res}` : stat, label: rowLabel({ stat, res }), nominal: nominal(st, stat, res), now: current(eff, waiting, stat, res) ?? null });
  if (st.energy) add('energy');
  if (st.pollution) add('smog');
  if (st.cycle > 0) {
    out.push({ key: 'process', label: t('insp.cycle'), nominal: `${costText(st.input)} → ${costText(st.output)}`, now: null });
    add('cycle');
    for (const r of resources(st.output)) add('made', r);
    for (const r of resources(st.input)) add('used', r);
  }
  if (def.fuel) out.push({ key: 'fuel', label: t('insp.fuel'), nominal: t('insp.fuelValue', { n: def.fuel.scrap, s: def.fuel.seconds }), now: null });
  if (st.housing) add('homes');
  // storage in scrap, with its unit ("180 scrap"), as the panel always wrote it; across both columns, like the bots:
  // power does not change it (until the building is finished it gives none, which its state already says)
  if (st.storage) out.push({ key: 'storage', label: rowLabel({ stat: 'storage' }), nominal: scrapAmount(st.storage), now: null });
  if (def.bots) out.push({ key: 'bots', label: t('insp.bots'), nominal: `+${def.bots}`, now: null });
  if (def.happiness) out.push({ key: 'happiness', label: t('insp.happiness'), nominal: `+${def.happiness}`, now: null });
  if (st.cleanRadius) {
    add('radius');
    // one sludge tile every 6 s at full power (effectiveStats.cleanEvery: slower with less power, never with a module)
    out.push({
      key: 'clean',
      label: t('insp.cleanEvery'),
      nominal: secs(CLEAN_EVERY),
      now: Number.isFinite(eff.cleanEvery) ? secs(eff.cleanEvery) : t('insp.stopped'),
    });
  }
  return out;
}

export type CauseIcon = 'wrench' | 'pause' | 'nopower' | 'energy' | 'wait' | 'lock' | 'scrap' | 'play';

export interface StatusLine {
  cause: StatusCause;
  text: string; // the cause in words (distinct for each cause)
  icon: CauseIcon; // drawn next to the words: the state never reads by colour alone
}

const CAUSE_ICON: Record<StatusCause, CauseIcon> = {
  building: 'wrench',
  paused: 'pause',
  noPower: 'nopower',
  lowPower: 'energy',
  noInput: 'wait',
  reserve: 'lock',
  noFuel: 'scrap',
  ok: 'play',
};

// Why the building is in its state, in words: statusInfo's cause and its details.
export function statusLine(s: GameState, b: Building): StatusLine {
  const info = statusInfo(s, b);
  const n = (v: number) => Math.max(0, Math.ceil(v));
  let text: string;
  switch (info.cause) {
    case 'building':
      text = t('cause.building', { n: n(info.buildLeft ?? 0) });
      break;
    case 'lowPower':
      text = t('cause.lowPower', { n: Math.round(info.power * 100) });
      break;
    case 'noInput':
      text = t('cause.noInput', { what: costText(info.needs ?? {}) });
      break;
    case 'reserve':
      text = t('cause.reserve', { n: info.reserve ?? 0 });
      break;
    case 'noFuel':
      text = t('cause.noFuel', { what: costText(info.needs ?? {}) });
      break;
    default:
      text = tk(`cause.${info.cause}`);
  }
  return { cause: info.cause, text, icon: CAUSE_ICON[info.cause] };
}

// Overtime, while it runs, for a building it speeds up (a process; industry smog): how long is left. 0 otherwise, and
// for a building that is not running (paused, or a Burner out of fuel): overtime does nothing for it.
export function overtimeLeft(s: GameState, b: Building): number {
  const eff = effectiveStats(s, b);
  if (eff.overtime <= 1 || !eff.running) return 0;
  const st = buildingStats(b);
  return st.cycle > 0 || st.pollution > 0 ? Math.ceil(eff.overtimeLeft) : 0;
}

// ---------- a module on one building: its state ----------

// Installed; the slot taken by the other module (the Recycler's magnet and sorter); can go on now; cannot now (why).
export type ModuleState = 'installed' | 'slotTaken' | 'available' | 'cantBuy';

export function moduleState(s: GameState, b: Building, kind: ModuleKind): { state: ModuleState; reason?: string } {
  const fitted = installedModules(b);
  if (fitted.includes(kind)) return { state: 'installed' };
  const check = installState(s, kind, b);
  if (check.ok) return { state: 'available' };
  return { state: fitted.length ? 'slotTaken' : 'cantBuy', reason: check.reason };
}

// The modules a building's slot can take (the Recycler: two, one at a time).
export function slotModules(type: BuildingType): ModuleKind[] {
  return MACHINE_MODULES.filter((k) => MODULES[k].building === type);
}

// ---------- what goes when storage, homes or power drop ----------

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

// How many homes taking `kind` off b removes (the capsule: 3), and demolishing b (none while unfinished).
export function moduleHousingDrop(b: Building, kind: ModuleKind): number {
  if (b.built < 1) return 0;
  return buildingStats(b).housing - buildingStatsWith(b, installedModules(b).filter((k) => k !== kind)).housing;
}

export function demolishHousingDrop(b: Building): number {
  return b.built >= 1 ? buildingStats(b).housing : 0;
}

// Citizens who move out when the homes drop by `drop`: the core's citizensLost.
export function homesLost(s: GameState, drop: number): number {
  return citizensLost(s, drop);
}

// The city's power made and used if b had the `modules` instead of its own (null: b demolished): the totals the sim
// counted, with b's share (the sim's own energyEffect) swapped for the one it would have.
export function powerWith(s: GameState, b: Building, modules: ModuleKind[] | null): { prod: number; use: number } {
  let prod = s.derived.energyProd;
  let use = s.derived.energyUse;
  const now = energyEffect(b);
  const after = modules === null ? 0 : energyEffect({ ...b, modules });
  if (now > 0) prod -= now;
  else use += now;
  if (after > 0) prod += after;
  else use -= after;
  return { prod, use };
}

// When a change on b (another module set, or demolition: null) would leave the city short of power while it is not
// short now: the power made and needed after it. Null when the power still covers everything (or was short anyway).
export function powerShortAfter(s: GameState, b: Building, modules: ModuleKind[] | null): { prod: number; use: number } | null {
  if (s.derived.energyProd < s.derived.energyUse) return null;
  const p = powerWith(s, b, modules);
  return p.prod < p.use ? p : null;
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
// the highlight under the pointer both come from here, so what is highlighted is what the click does. The bulldozer
// works on the ground tile under the pointer and draws the buildings in front of it see-through, so a building
// drawn there is the target unless that tile holds rubble or a fence, gate or lamp (a building in front can hide
// those entirely: they are cleared instead) or another building standing behind it (a Pixel Garden right behind the
// Spire: the Garden, shown through the Spire, is the target; src/ui/pick.ts).
export type DozeTarget = { kind: 'building'; id: number } | { kind: 'rubble' | 'piece' | 'nothing'; i: number };

export function dozeTarget(s: GameState, tx: number, ty: number, picked: number, drawnPiece: () => number): DozeTarget {
  const ground = inBounds(tx, ty) ? idx(tx, ty) : -1;
  const hidden = ground >= 0 && s.occ[ground] === -1 && (s.tiles[ground] === T.RUBBLE || s.solid[ground] !== 0);
  if (picked >= 0 && !hidden) {
    const behind = buildingBehind(s, picked, tx, ty);
    return { kind: 'building', id: behind >= 0 ? behind : picked };
  }
  const piece = drawnPiece();
  if (piece >= 0) return { kind: 'piece', i: piece };
  if (ground < 0) return { kind: 'nothing', i: -1 };
  if (s.tiles[ground] === T.RUBBLE) return { kind: 'rubble', i: ground };
  if (s.occ[ground] !== -1) return { kind: 'building', id: s.occ[ground] };
  return { kind: pieceInfo(s, ground)?.removable ? 'piece' : 'nothing', i: ground };
}

// What the bulldozer shows above the piece or floor its click would take up: what removing it gives back right now
// (pieceRefundAt: the sculpture's scrap only as far as storage has room, as removePieceAt pays), in the words of the
// panel's Remove: "Remove (+5 credits + 4 scrap)". Null for a building, rubble, nothing, or a floor it cannot take up.
export function dozeLabel(s: GameState, target: DozeTarget): string | null {
  if (target.kind !== 'piece') return null;
  const info = pieceInfo(s, target.i);
  return info?.removable ? t('insp.remove', { refund: costText(info.refund) }) : null;
}
