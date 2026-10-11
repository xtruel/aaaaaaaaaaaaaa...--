// Player and event actions that change the city: placing, demolishing, spawning junk.
import { t, tk } from '../i18n';
import { ALIGN_BUILD_SHIFT, BUILDINGS, BULLDOZE_RUBBLE_COST, IMPORT_PARTS, MAP_H, MAP_W, PARTS_RESERVE, T, TILE } from './defs';
import type { BuildingType, Cost, Resource } from './defs';
import { buildingStats, installedModules, moduleRefund, solidKind } from './piecedefs';
import { addBuilding, buildingCenter, idx, inBounds, pushMessage, removeBuilding } from './state';
import type { Building, GameState } from './state';

export function setTile(s: GameState, i: number, kind: number, amt = 0): void {
  s.tiles[i] = kind;
  s.amount[i] = amt;
  s.dirtyTiles.push(i);
}

// Plain ground or grass with no building and no fence, gate or lamp: where junk, sludge, waste and a
// gifted garden may appear (a floor does not matter).
export function isFree(s: GameState, i: number): boolean {
  return (s.tiles[i] === T.GROUND || s.tiles[i] === T.GRASS) && s.occ[i] === -1 && s.solid[i] === 0;
}

export function canAfford(s: GameState, cost: Cost): boolean {
  return (Object.keys(cost) as Resource[]).every((r) => s.res[r] >= (cost[r] ?? 0));
}

export function pay(s: GameState, cost: Cost): void {
  for (const r of Object.keys(cost) as Resource[]) s.res[r] -= cost[r] ?? 0;
}

export function gain(s: GameState, cost: Cost): void {
  for (const r of Object.keys(cost) as Resource[]) {
    s.res[r] += cost[r] ?? 0;
    if (r === 'credits') s.stats.creditsEarned += cost[r] ?? 0;
    if (r === 'parts') s.stats.partsMade += cost[r] ?? 0;
  }
}

// "12 credits + 1 part": an amount of exactly 1 takes the singular (cost.<resource>.one). Every other amount keeps
// the plural key; in Polish 2–4 and 5+ take the same word for all three (części, złomu, kr).
export function costText(cost: Cost): string {
  const parts = (Object.keys(cost) as Resource[]).filter((r) => (cost[r] ?? 0) > 0);
  return parts.map((r) => tk(cost[r] === 1 ? `cost.${r}.one` : `cost.${r}`, { n: cost[r] ?? 0 })).join(' + ') || t('common.free');
}

export function shiftAlignment(s: GameState, delta: number): void {
  s.alignment = Math.max(-100, Math.min(100, s.alignment + delta));
}

// Building price in this city: campaign cities make green or industrial buildings cheaper or pricier.
export function buildCost(s: GameState, type: BuildingType): Cost {
  const def = BUILDINGS[type];
  const mul = def.path === 'industrial' ? s.mods.industrialCost : def.path === 'green' ? s.mods.greenCost : 1;
  const out: Cost = {};
  for (const r of Object.keys(def.cost) as Resource[]) out[r] = Math.round((def.cost[r] ?? 0) * mul);
  return out;
}

export interface PlaceCheck {
  ok: boolean;
  reason?: string;
  costOnly?: boolean; // the spot is fine, only the price is not
}

// Why nothing can be built on a tile holding a fence, gate or lamp (solid code as in GameState.solid).
export function solidReason(code: number): string {
  const kind = solidKind(code);
  return kind === 'fence' ? t('place.fence') : kind === 'gate' ? t('place.gate') : kind === 'lamp' ? t('place.lamp') : t('place.occupied');
}

export function placeCheck(s: GameState, type: BuildingType, x: number, y: number): PlaceCheck {
  const def = BUILDINGS[type];
  if (def.minPop && s.pop < def.minPop) return { ok: false, reason: t('place.needs', { n: def.minPop }) };
  if (type === 'spire' && s.buildings.some((b) => b.type === 'spire')) return { ok: false, reason: t('place.oneSpire') };
  for (let dy = 0; dy < def.h; dy++) {
    for (let dx = 0; dx < def.w; dx++) {
      const tx = x + dx;
      const ty = y + dy;
      if (!inBounds(tx, ty)) return { ok: false, reason: t('place.outside') };
      const i = idx(tx, ty);
      if (s.occ[i] !== -1) return { ok: false, reason: t('place.occupied') };
      if (s.solid[i] !== 0) return { ok: false, reason: solidReason(s.solid[i]) };
      const tile = s.tiles[i];
      if (tile === T.JUNK) {
        const full = s.res.scrap >= s.derived.storage;
        return { ok: false, reason: full ? t('place.junkFull') : t('place.junk') };
      }
      if (tile === T.SLUDGE) return { ok: false, reason: t('place.sludge') };
      if (tile === T.RUBBLE) return { ok: false, reason: t('place.rubble') };
    }
  }
  const cost = buildCost(s, type);
  if (!canAfford(s, cost)) return { ok: false, reason: t('place.costs', { cost: costText(cost) }), costOnly: true };
  return { ok: true };
}

export function placeBuilding(s: GameState, type: BuildingType, x: number, y: number): Building | null {
  const check = placeCheck(s, type, x, y);
  if (!check.ok) {
    pushMessage(s, check.reason ?? t('place.cannot'), 'bad');
    return null;
  }
  const def = BUILDINGS[type];
  pay(s, buildCost(s, type));
  const b = addBuilding(s, type, x, y);
  if (def.path === 'industrial') s.stats.industrialBuilt++;
  const before = s.alignment;
  if (def.path === 'green') shiftAlignment(s, ALIGN_BUILD_SHIFT);
  if (def.path === 'industrial') shiftAlignment(s, -ALIGN_BUILD_SHIFT);
  b.align = s.alignment - before;
  const c = buildingCenter(b);
  s.fx.push({ kind: 'placed', x: c.x, y: c.y });
  return b;
}

// Storage left after a building or a storage module goes: clamp the scrap to it.
export function computeStorage(s: GameState): void {
  let storage = 0;
  for (const o of s.buildings) if (o.built >= 1) storage += buildingStats(o).storage;
  s.derived.storage = storage;
  s.res.scrap = Math.min(s.res.scrap, storage);
}

// What demolishing gives back for the building alone (its modules: see demolishRefund).
export function refundFor(s: GameState, b: Building): Cost {
  const cost = buildCost(s, b.type);
  const share = b.built < 1 ? 0.8 : 0.5;
  const out: Cost = {};
  for (const r of Object.keys(cost) as Resource[]) out[r] = Math.floor((cost[r] ?? 0) * share);
  return out;
}

// What demolishing really gives back: the building plus every module on it (the modules go with it).
// The demolish confirmation shows this.
export function demolishRefund(s: GameState, b: Building): Cost {
  const out = refundFor(s, b);
  for (const m of installedModules(b)) {
    const back = moduleRefund(m);
    for (const r of Object.keys(back) as Resource[]) out[r] = (out[r] ?? 0) + (back[r] ?? 0);
  }
  return out;
}

export function demolish(s: GameState, b: Building): boolean {
  // a building already gone (a stale reference) gives nothing back a second time
  if (!s.buildings.includes(b)) return false;
  if (b.type === 'hq') {
    pushMessage(s, t('msg.hqStays'), 'bad');
    return false;
  }
  const refund = demolishRefund(s, b);
  // a refund is not income: it must not count toward "credits earned" goals
  for (const r of Object.keys(refund) as Resource[]) s.res[r] += refund[r] ?? 0;
  // the city no longer has this building, so its pull on the path meter goes too: exactly the pull it
  // had (a shift swallowed by the ±100 limit is not given back twice)
  const def = BUILDINGS[b.type];
  const pull = b.align ?? (def.path === 'green' ? ALIGN_BUILD_SHIFT : def.path === 'industrial' ? -ALIGN_BUILD_SHIFT : 0);
  shiftAlignment(s, -pull);
  removeBuilding(s, b);
  // scrap above the storage that is left is lost (it used to stay over the cap and stop the bots)
  computeStorage(s);
  const c = buildingCenter(b);
  s.fx.push({ kind: 'demolish', x: c.x, y: c.y, text: `+${costText(refund)}` });
  return true;
}

// Buys parts from 2PM in packs of IMPORT_PARTS.parts; every pack nudges the city toward Industry.
export function importParts(s: GameState, packs = 1): boolean {
  const credits = IMPORT_PARTS.credits * packs;
  if (packs < 1 || s.res.credits < credits) {
    pushMessage(s, t('msg.importCost', { n: credits }), 'bad');
    return false;
  }
  s.res.credits -= credits;
  s.res.parts += IMPORT_PARTS.parts * packs;
  shiftAlignment(s, -packs);
  pushMessage(s, t('msg.imported', { parts: IMPORT_PARTS.parts * packs, credits }), 'info');
  return true;
}

// Parts that Factories and Fix-It Labs leave alone. Normally a small reserve for building; once the city
// has 30 citizens and the credits for the Spire, they save up the Spire's parts too, so it can be built.
export function partsReserve(s: GameState): number {
  if (s.pop >= 30 && !s.buildings.some((b) => b.type === 'spire')) {
    const cost = buildCost(s, 'spire');
    if (s.res.credits >= (cost.credits ?? 0)) return Math.max(PARTS_RESERVE, cost.parts ?? 0);
  }
  return PARTS_RESERVE;
}

// Packs of parts needed to build `type` when parts are the only thing missing and the credits cover them; else 0.
export function packsToBuild(s: GameState, type: BuildingType): number {
  const cost = buildCost(s, type);
  const short = Math.max(0, (cost.parts ?? 0) - Math.floor(s.res.parts));
  if (short === 0 || s.res.scrap < (cost.scrap ?? 0)) return 0;
  const packs = Math.ceil(short / IMPORT_PARTS.parts);
  return s.res.credits >= (cost.credits ?? 0) + packs * IMPORT_PARTS.credits ? packs : 0;
}

export function bulldozeRubble(s: GameState, x: number, y: number): boolean {
  const i = idx(x, y);
  if (s.tiles[i] !== T.RUBBLE) return false;
  if (s.res.credits < BULLDOZE_RUBBLE_COST) {
    pushMessage(s, t('msg.bulldozeCost', { n: BULLDOZE_RUBBLE_COST }), 'bad');
    return false;
  }
  s.res.credits -= BULLDOZE_RUBBLE_COST;
  setTile(s, i, T.GROUND);
  s.fx.push({ kind: 'demolish', x: (x + 0.5) * TILE, y: (y + 0.5) * TILE, text: `-${BULLDOZE_RUBBLE_COST} ${t('fx.cr')}` });
  return true;
}

function randomFreeTile(s: GameState, near?: { x: number; y: number; r: number }): number {
  for (let tries = 0; tries < 60; tries++) {
    const x = near ? Math.round(near.x + (Math.random() * 2 - 1) * near.r) : Math.floor(Math.random() * MAP_W);
    const y = near ? Math.round(near.y + (Math.random() * 2 - 1) * near.r) : Math.floor(Math.random() * MAP_H);
    if (!inBounds(x, y)) continue;
    const i = idx(x, y);
    if (isFree(s, i)) return i;
  }
  return -1;
}

export function spawnJunk(s: GameState, count: number, min: number, max: number, near?: { x: number; y: number; r: number }): number {
  let spawned = 0;
  for (let k = 0; k < count; k++) {
    const i = randomFreeTile(s, near);
    if (i < 0) continue;
    setTile(s, i, T.JUNK, min + Math.floor(Math.random() * (max - min + 1)));
    spawned++;
  }
  return spawned;
}

export function addWaste(s: GameState, amt: number): void {
  const homes = s.buildings.filter((b) => b.type === 'pods' && b.built >= 1);
  const home = homes[Math.floor(Math.random() * homes.length)];
  if (!home) return;
  const near = { x: home.x + 1, y: home.y + 1, r: 4 };
  for (let tries = 0; tries < 12; tries++) {
    const x = Math.round(near.x + (Math.random() * 2 - 1) * near.r);
    const y = Math.round(near.y + (Math.random() * 2 - 1) * near.r);
    if (!inBounds(x, y)) continue;
    const i = idx(x, y);
    if (s.tiles[i] === T.JUNK && s.amount[i] < 60) {
      s.amount[i] += amt;
      s.dirtyTiles.push(i);
      return;
    }
    if (isFree(s, i)) {
      setTile(s, i, T.JUNK, amt);
      return;
    }
  }
}

export function spawnSludge(s: GameState, count: number): number {
  let x = Math.floor(Math.random() * MAP_W);
  let y = Math.floor(Math.random() * MAP_H);
  let spawned = 0;
  for (let k = 0; k < count * 4 && spawned < count; k++) {
    const i = idx(x, y);
    if (isFree(s, i)) {
      setTile(s, i, T.SLUDGE);
      spawned++;
    }
    x = Math.max(0, Math.min(MAP_W - 1, x + Math.floor(Math.random() * 3) - 1));
    y = Math.max(0, Math.min(MAP_H - 1, y + Math.floor(Math.random() * 3) - 1));
  }
  return spawned;
}

// Returns false when there is no free tile near the pods (the caller then refunds).
export function placeFreeGarden(s: GameState): boolean {
  const homes = s.buildings.filter((b) => b.type === 'pods');
  const home = homes[Math.floor(Math.random() * homes.length)];
  const hq = s.buildings.find((b) => b.type === 'hq');
  const anchor = home ?? hq;
  if (!anchor) return false;
  const i = randomFreeTile(s, { x: anchor.x + 1, y: anchor.y + 1, r: 5 });
  if (i < 0) return false;
  const b = addBuilding(s, 'garden', i % MAP_W, Math.floor(i / MAP_W));
  b.built = 0.5;
  b.align = 0; // a gift: it never moved the path meter, so demolishing it does not either
  return true;
}
