// Player and event actions that change the city: placing, demolishing, spawning junk.
import { ALIGN_BUILD_SHIFT, BUILDINGS, BULLDOZE_RUBBLE_COST, IMPORT_PARTS, MAP_H, MAP_W, RESOURCE_LABEL, T, TILE } from './defs';
import type { BuildingType, Cost, Resource } from './defs';
import { addBuilding, buildingCenter, idx, inBounds, pushMessage, removeBuilding } from './state';
import type { Building, GameState } from './state';

export function setTile(s: GameState, i: number, kind: number, amt = 0): void {
  s.tiles[i] = kind;
  s.amount[i] = amt;
  s.dirtyTiles.push(i);
}

export function isFree(s: GameState, i: number): boolean {
  return (s.tiles[i] === T.GROUND || s.tiles[i] === T.GRASS) && s.occ[i] === -1;
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

export function costText(cost: Cost): string {
  const parts = (Object.keys(cost) as Resource[]).filter((r) => (cost[r] ?? 0) > 0);
  return parts.map((r) => `${cost[r]} ${RESOURCE_LABEL[r].toLowerCase()}`).join(' + ') || 'free';
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
}

export function placeCheck(s: GameState, type: BuildingType, x: number, y: number): PlaceCheck {
  const def = BUILDINGS[type];
  if (def.minPop && s.pop < def.minPop) return { ok: false, reason: `Needs ${def.minPop} citizens` };
  if (type === 'spire' && s.buildings.some((b) => b.type === 'spire')) return { ok: false, reason: 'Only one Spire per city' };
  for (let dy = 0; dy < def.h; dy++) {
    for (let dx = 0; dx < def.w; dx++) {
      const tx = x + dx;
      const ty = y + dy;
      if (!inBounds(tx, ty)) return { ok: false, reason: 'Out of the city limits' };
      const i = idx(tx, ty);
      if (s.occ[i] !== -1) return { ok: false, reason: 'Something is already there' };
      const t = s.tiles[i];
      if (t === T.JUNK) {
        const full = s.res.scrap >= s.derived.storage;
        return { ok: false, reason: full ? 'Junk in the way, and storage is full' : 'Junk in the way: let the bots clear it' };
      }
      if (t === T.SLUDGE) return { ok: false, reason: 'Toxic sludge: a Purifier can clean it' };
      if (t === T.RUBBLE) return { ok: false, reason: 'Rubble: bulldoze it first' };
    }
  }
  const cost = buildCost(s, type);
  if (!canAfford(s, cost)) return { ok: false, reason: `Costs ${costText(cost)}` };
  return { ok: true };
}

export function placeBuilding(s: GameState, type: BuildingType, x: number, y: number): Building | null {
  const check = placeCheck(s, type, x, y);
  if (!check.ok) {
    pushMessage(s, check.reason ?? 'Cannot build here', 'bad');
    return null;
  }
  const def = BUILDINGS[type];
  pay(s, buildCost(s, type));
  const b = addBuilding(s, type, x, y);
  if (def.path === 'industrial') s.stats.industrialBuilt++;
  if (def.path === 'green') shiftAlignment(s, ALIGN_BUILD_SHIFT);
  if (def.path === 'industrial') shiftAlignment(s, -ALIGN_BUILD_SHIFT);
  const c = buildingCenter(b);
  s.fx.push({ kind: 'placed', x: c.x, y: c.y });
  return b;
}

export function refundFor(s: GameState, b: Building): Cost {
  const cost = buildCost(s, b.type);
  const share = b.built < 1 ? 0.8 : 0.5;
  const out: Cost = {};
  for (const r of Object.keys(cost) as Resource[]) out[r] = Math.floor((cost[r] ?? 0) * share);
  return out;
}

export function demolish(s: GameState, b: Building): boolean {
  if (b.type === 'hq') {
    pushMessage(s, 'The HQ stays. Where else would USA-9 sleep?', 'bad');
    return false;
  }
  const refund = refundFor(s, b);
  // a refund is not income: it must not count toward "credits earned" goals
  for (const r of Object.keys(refund) as Resource[]) s.res[r] += refund[r] ?? 0;
  // the city no longer has this building, so its pull on the path meter goes too
  const def = BUILDINGS[b.type];
  if (def.path === 'green') shiftAlignment(s, -ALIGN_BUILD_SHIFT);
  if (def.path === 'industrial') shiftAlignment(s, ALIGN_BUILD_SHIFT);
  removeBuilding(s, b);
  const c = buildingCenter(b);
  s.fx.push({ kind: 'demolish', x: c.x, y: c.y, text: `+${costText(refund)}` });
  return true;
}

export function importParts(s: GameState): boolean {
  if (s.res.credits < IMPORT_PARTS.credits) {
    pushMessage(s, `Importing parts costs ${IMPORT_PARTS.credits} credits`, 'bad');
    return false;
  }
  s.res.credits -= IMPORT_PARTS.credits;
  s.res.parts += IMPORT_PARTS.parts;
  shiftAlignment(s, -1);
  pushMessage(s, `2PM delivered ${IMPORT_PARTS.parts} parts (-${IMPORT_PARTS.credits} credits).`, 'info');
  return true;
}

export function bulldozeRubble(s: GameState, x: number, y: number): boolean {
  const i = idx(x, y);
  if (s.tiles[i] !== T.RUBBLE) return false;
  if (s.res.credits < BULLDOZE_RUBBLE_COST) {
    pushMessage(s, `Bulldozing costs ${BULLDOZE_RUBBLE_COST} credits`, 'bad');
    return false;
  }
  s.res.credits -= BULLDOZE_RUBBLE_COST;
  setTile(s, i, T.GROUND);
  s.fx.push({ kind: 'demolish', x: (x + 0.5) * TILE, y: (y + 0.5) * TILE, text: `-${BULLDOZE_RUBBLE_COST} cr` });
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
  return true;
}
