// Modular building, increments 1 and 2 (docs/MODULAR-INC1.md, docs/MODULAR-INC2.md): the rules for the catalog.
// Pieces on the map: industrial floor (a surface under everything), fence, gate and lamp (solid objects, one
// per tile, kept in s.solid and never in s.occ). Modules on buildings, one slot each: extra storage for a Bot Dock,
// a filter for a Smelter, a magnet or a sorter for a Recycler, a double arm for a 2PM Factory, a capsule for Bot
// Pods, tracking panels for a Solar Array, a nozzle for a Purifier. Everything is paid once, when the player
// confirms; checks and previews cost nothing.
// No DOM here. The data and the pure helpers (PIECES, MODULES, buildingStats...) come from piecedefs.ts and
// are re-exported, so the UI and the renderer only need this module.
import { t, tk } from '../i18n';
import { T, TILE } from './defs';
import type { Cost, Resource } from './defs';
import { canAfford, computeStorage, costText, pay, solidReason } from './actions';
import type { PlaceCheck } from './actions';
import { MODULES, PIECES, buildingStats, installedModules, isModuleKind, isPieceKind, moduleRefund, normRot, pieceRefund, solidCode, solidKind } from './piecedefs';
import type { ModuleKind, PieceKind } from './piecedefs';
import { computeDerived } from './sim';
import { buildingCenter, idx, inBounds } from './state';
import type { Building, GameState } from './state';

export * from './piecedefs';
export { demolishRefund } from './actions';
export type { PlaceCheck } from './actions';

// A refund is not income: it goes straight back, without counting toward "credits earned" goals.
function giveBack(s: GameState, cost: Cost): void {
  for (const r of Object.keys(cost) as Resource[]) s.res[r] += cost[r] ?? 0;
}

function tileFx(x: number, y: number): { x: number; y: number } {
  return { x: (x + 0.5) * TILE, y: (y + 0.5) * TILE };
}

// ---------- pieces on the map ----------

// Can `kind` be placed on tile (x, y)? Same shape as placeCheck: costOnly when only the price is missing.
// The rotation never changes the answer (any value is accepted and brought into range when placing).
export function pieceCheck(s: GameState, kind: PieceKind, x: number, y: number, _rot = 0): PlaceCheck {
  // own keys only: a stray 'constructor' or 'toString' from the UI is refused, not looked up on Object
  if (!isPieceKind(kind)) return { ok: false, reason: t('place.cannot') };
  const def = PIECES[kind];
  if (!inBounds(x, y)) return { ok: false, reason: t('place.outside') };
  const i = idx(x, y);
  if (s.occ[i] !== -1) return { ok: false, reason: t('place.occupied') };
  const tile = s.tiles[i];
  if (tile === T.JUNK) return { ok: false, reason: s.res.scrap >= s.derived.storage ? t('place.junkFull') : t('place.junk') };
  if (tile === T.SLUDGE) return { ok: false, reason: t('place.sludge') };
  if (tile === T.RUBBLE) return { ok: false, reason: t('place.rubble') };
  // only ground or grass (spec 2): any other tile code, e.g. from a damaged save, is refused
  if (tile !== T.GROUND && tile !== T.GRASS) return { ok: false, reason: t('place.cannot') };
  if (def.layer === 'surface') {
    // a fence or lamp on the tile does not stop a floor going under it
    if (s.floor[i]) return { ok: false, reason: t('place.paved') };
  } else if (s.solid[i] !== 0) {
    return { ok: false, reason: solidReason(s.solid[i]) };
  }
  if (!canAfford(s, def.cost)) return { ok: false, reason: t('place.costs', { cost: costText(def.cost) }), costOnly: true };
  return { ok: true };
}

// Buys and places one piece (one confirmation = one payment). False, and nothing paid, when pieceCheck
// says no; no message is pushed, so a dragged row can skip bad tiles quietly (show pieceCheck's reason).
export function placePiece(s: GameState, kind: PieceKind, x: number, y: number, rot = 0): boolean {
  if (!pieceCheck(s, kind, x, y, rot).ok) return false;
  const def = PIECES[kind];
  const i = idx(x, y);
  pay(s, def.cost);
  if (def.layer === 'surface') {
    s.floor[i] = 1;
    s.dirtyTiles.push(i);
  } else {
    s.solid[i] = solidCode(kind as Exclude<PieceKind, 'floor'>);
    s.rot[i] = normRot(kind, rot);
  }
  s.stats.piecesPlaced++;
  s.fx.push({ kind: 'placed', ...tileFx(x, y) });
  return true;
}

// Bulldozer on a tile: removes the fence/gate/lamp if there is one, else the floor (only a bare floor: not
// under a building, junk, sludge or rubble). Gives back half the price; null when there was nothing to remove.
export function removePieceAt(s: GameState, x: number, y: number): Cost | null {
  if (!inBounds(x, y)) return null;
  const i = idx(x, y);
  let kind: PieceKind | null = null;
  if (s.solid[i] !== 0) {
    kind = solidKind(s.solid[i]);
    s.solid[i] = 0;
    s.rot[i] = 0;
  } else if (s.floor[i] && s.occ[i] === -1 && (s.tiles[i] === T.GROUND || s.tiles[i] === T.GRASS)) {
    kind = 'floor';
    s.floor[i] = 0;
    s.dirtyTiles.push(i);
  }
  if (!kind) return null;
  const refund = pieceRefund(kind);
  giveBack(s, refund);
  s.fx.push({ kind: 'demolish', ...tileFx(x, y), text: `+${costText(refund)}` });
  return refund;
}

// Turns the gate (2 ways) or lamp (4 directions) on the tile; a fence only while it stands alone (a joined
// fence follows its neighbours). Free. dir -1 turns the other way.
export function rotatePieceAt(s: GameState, x: number, y: number, dir: 1 | -1 = 1): boolean {
  const p = pieceAt(s, x, y);
  if (!p) return false;
  const n = PIECES[p.kind].rotations;
  if (n < 2) return false;
  if (p.kind === 'fence' && fenceMask(s, x, y) !== 0) return false;
  s.rot[idx(x, y)] = normRot(p.kind, p.rot + dir);
  return true;
}

function joinsAt(s: GameState, x: number, y: number): boolean {
  if (!inBounds(x, y)) return false;
  const kind = solidKind(s.solid[idx(x, y)]);
  return !!kind && PIECES[kind].joins;
}

// Which neighbours of (x, y) are fences or gates: N (y-1) = 1, E (x+1) = 2, S (y+1) = 4, W (x-1) = 8.
// Works for any tile, so a preview can show how a fence would join before it is placed.
// 0 = alone: then the fence's own rotation is used (0 = along x, 1 = along y).
export function fenceMask(s: GameState, x: number, y: number): number {
  return (joinsAt(s, x, y - 1) ? 1 : 0) | (joinsAt(s, x + 1, y) ? 2 : 0) | (joinsAt(s, x, y + 1) ? 4 : 0) | (joinsAt(s, x - 1, y) ? 8 : 0);
}

// Tiles of a drag from (x0, y0) to (x1, y1), in order, each once: a straight row, or an L with one corner
// so a single drag can turn a corner (the fences there join by themselves through fenceMask). xFirst: the
// leg along x comes first (corner at (x1, y0)), else the leg along y (corner at (x0, y1)).
export function dragPath(x0: number, y0: number, x1: number, y1: number, xFirst = true): { x: number; y: number }[] {
  [x0, y0, x1, y1] = [x0, y0, x1, y1].map(Math.round);
  const out: { x: number; y: number }[] = [];
  const leg = (ax: number, ay: number, bx: number, by: number) => {
    const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
    for (let k = 0; k <= n; k++) {
      const x = ax + Math.sign(bx - ax) * k;
      const y = ay + Math.sign(by - ay) * k;
      const last = out[out.length - 1];
      if (!last || last.x !== x || last.y !== y) out.push({ x, y });
    }
  };
  const cx = xFirst ? x1 : x0;
  const cy = xFirst ? y0 : y1;
  leg(x0, y0, cx, cy);
  leg(cx, cy, x1, y1);
  return out;
}

// The fence, gate or lamp on a tile (not the floor: see floorAt).
export function pieceAt(s: GameState, x: number, y: number): { kind: PieceKind; rot: number } | null {
  if (!inBounds(x, y)) return null;
  const i = idx(x, y);
  const kind = solidKind(s.solid[i]);
  return kind ? { kind, rot: s.rot[i] } : null;
}

export function floorAt(s: GameState, x: number, y: number): boolean {
  return inBounds(x, y) && s.floor[idx(x, y)] !== 0;
}

// ---------- modules on buildings ----------

const NEEDS: Record<ModuleKind, () => string> = {
  dockStorage: () => t('place.modDock'),
  smelterFilter: () => t('place.modSmelter'),
  recyclerMagnet: () => t('place.modRecycler'),
  recyclerSorter: () => t('place.modRecycler'),
  factoryArm: () => t('place.modFactory'),
  podsCapsule: () => t('place.modPods'),
  solarTracker: () => t('place.modSolar'),
  purifierNozzle: () => t('place.modPurifier'),
};

// Where a module can go, in words: "Only on a finished Recycler".
export function moduleNeeds(kind: ModuleKind): string {
  return isModuleKind(kind) ? NEEDS[kind]() : t('place.cannot');
}

// Can `kind` be installed on b? Only on a finished building of the right type (paused is fine) whose single module
// slot is free: the same module again is "already installed", another one (the Recycler's magnet and sorter share
// the slot) is "slot taken by X: remove it first". costOnly when only the price is missing.
export function moduleCheck(s: GameState, kind: ModuleKind, b: Building): PlaceCheck {
  if (!isModuleKind(kind)) return { ok: false, reason: t('place.cannot') };
  const def = MODULES[kind];
  if (!s.buildings.includes(b) || b.type !== def.building || b.built < 1) return { ok: false, reason: NEEDS[kind]() };
  const fitted = installedModules(b);
  if (fitted.includes(kind)) return { ok: false, reason: t('place.modInstalled') };
  if (fitted.length) return { ok: false, reason: t('place.modSlot', { name: tk(`mod.${fitted[0]}`) }) };
  if (!canAfford(s, def.cost)) return { ok: false, reason: t('place.costs', { cost: costText(def.cost) }), costOnly: true };
  return { ok: true };
}

// A module that changes the length of a cycle keeps the cycle's progress as a share: a Recycler 1 s into its 2 s
// cycle is 0.75 s into the magnet's 1.5 s one (the progress bar does not jump, and no work is made up or lost).
function keepCycleShare(b: Building, before: number): void {
  const after = buildingStats(b).cycle;
  if (before > 0 && after > 0 && after !== before) b.timer = Math.min(after, (b.timer * after) / before);
}

// The city's numbers (power, homes, storage) follow a module at once, not at the next step.
function refreshCity(s: GameState): void {
  computeDerived(s);
  computeStorage(s);
}

// Buys and installs a module (paid once). The effect is immediate.
export function installModule(s: GameState, kind: ModuleKind, b: Building): boolean {
  if (!moduleCheck(s, kind, b).ok) return false;
  const cycle = buildingStats(b).cycle;
  pay(s, MODULES[kind].cost);
  b.modules = [kind];
  keepCycleShare(b, cycle);
  s.stats.modulesInstalled++;
  refreshCity(s);
  s.fx.push({ kind: 'placed', ...buildingCenter(b) });
  return true;
}

// Takes a module off (the building stays) and gives back half its price. Scrap above the storage that is
// left is lost, as when a Dock is demolished; citizens above the homes that are left move out at the next step,
// as when Bot Pods are demolished. Null when the module is not there.
export function removeModule(s: GameState, kind: ModuleKind, b: Building): Cost | null {
  // only a module that really counts on this building (as in demolishRefund) is refunded
  if (!s.buildings.includes(b) || !b.modules || !installedModules(b).includes(kind)) return null;
  const cycle = buildingStats(b).cycle;
  delete b.modules; // one slot: nothing else can be on it
  keepCycleShare(b, cycle);
  const refund = moduleRefund(kind);
  giveBack(s, refund);
  refreshCity(s);
  s.fx.push({ kind: 'demolish', ...buildingCenter(b), text: `+${costText(refund)}` });
  return refund;
}
