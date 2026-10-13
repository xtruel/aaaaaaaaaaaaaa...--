// Modular building, increments 1 and 2 (docs/MODULAR-INC1.md, docs/MODULAR-INC2.md): the rules for the catalog.
// Pieces on the map: industrial floor and concrete base (surfaces under everything, s.floor), fence, gate, lamp,
// low wall, corner pillar and the decorations (solid objects, one per tile, kept in s.solid and never in s.occ).
// Decorations bought can be moved to another tile for free (movePiece). Modules on buildings, one slot each: extra storage for a Bot Dock,
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
import { MODULES, PIECES, buildingStats, installedModules, isModuleKind, isPieceKind, moduleRefund, normRot, pieceRefundAt, pieceVariety, pieceVarietyAt, solidCode, solidKind, surfaceCode, surfaceKind } from './piecedefs';
import type { ModuleKind, PieceKind, SolidKind, SurfaceKind } from './piecedefs';
import { isLocked, lockedReason } from './projects';
import type { ProjectKind } from './projects';
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
// A project not discovered yet (docs/MODULAR-INC2.md §4) is refused first, with its goal and the city's progress:
// whatever the input (click, tap, pad, a dragged row), nothing undiscovered is bought.
export function pieceCheck(s: GameState, kind: PieceKind, x: number, y: number, _rot = 0): PlaceCheck {
  if (isPieceKind(kind) && isLocked(s, kind)) return { ok: false, reason: lockedReason(s, kind as ProjectKind) };
  const spot = spotCheck(s, kind, x, y);
  if (!spot.ok) return spot;
  const def = PIECES[kind];
  if (!canAfford(s, def.cost)) return { ok: false, reason: t('place.costs', { cost: costText(def.cost) }), costOnly: true };
  return { ok: true };
}

// The tile part of pieceCheck, without the price (a piece being moved costs nothing): inside the map, ground or grass
// with no building, junk, sludge or rubble; a surface on a tile with none, a solid piece on a tile with none.
function spotCheck(s: GameState, kind: PieceKind, x: number, y: number): PlaceCheck {
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
    // a fence or lamp on the tile does not stop a floor going under it; one surface per tile
    if (s.floor[i]) return { ok: false, reason: t(surfaceKind(s.floor[i]) === 'base' ? 'place.based' : 'place.paved') };
  } else if (s.solid[i] !== 0) {
    return { ok: false, reason: solidReason(s.solid[i]) };
  }
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
    s.floor[i] = surfaceCode(kind as SurfaceKind);
    s.dirtyTiles.push(i);
  } else {
    s.solid[i] = solidCode(kind as SolidKind);
    s.rot[i] = normRot(kind, rot);
    s.variety[i] = 0; // the tile's own look (pieceVariety): what the ghost showed
  }
  s.stats.piecesPlaced++;
  s.fx.push({ kind: 'placed', ...tileFx(x, y) });
  return true;
}

// Bulldozer on a tile: removes the solid piece (fence, gate, lamp, wall, pillar, decoration) if there is one, else the
// surface, floor or base (only a bare one: not under a building, junk, sludge or rubble). Gives back half the price,
// scrap only as far as the storage has room (pieceRefundAt: what the interface shows); null when there was nothing to
// remove.
export function removePieceAt(s: GameState, x: number, y: number): Cost | null {
  if (!inBounds(x, y)) return null;
  const i = idx(x, y);
  let kind: PieceKind | null = null;
  if (s.solid[i] !== 0) {
    kind = solidKind(s.solid[i]);
    s.solid[i] = 0;
    s.rot[i] = 0;
    s.variety[i] = 0;
  } else if (s.floor[i] && s.occ[i] === -1 && (s.tiles[i] === T.GROUND || s.tiles[i] === T.GRASS)) {
    kind = surfaceKind(s.floor[i]) ?? 'floor';
    s.floor[i] = 0;
    s.dirtyTiles.push(i);
  }
  if (!kind) return null;
  const refund = pieceRefundAt(s, kind);
  giveBack(s, refund);
  s.fx.push({ kind: 'demolish', ...tileFx(x, y), text: `+${costText(refund)}` });
  return refund;
}

// Turns the piece on the tile: a gate or pergola (2 ways), a lamp, bench, sign, Miso's house, sculpture or statue (4
// directions); a fence or a wall only while it stands alone (a joined one follows its neighbours); a planter, pillar,
// tree or fountain not at all. Free. dir -1 turns the other way.
export function rotatePieceAt(s: GameState, x: number, y: number, dir: 1 | -1 = 1): boolean {
  if (!turnsAt(s, x, y)) return false;
  const p = pieceAt(s, x, y)!;
  s.rot[idx(x, y)] = normRot(p.kind, p.rot + dir);
  return true;
}

// Can the piece on the tile turn now? (a fence or wall joined to its neighbours follows them)
export function turnsAt(s: GameState, x: number, y: number): boolean {
  const p = pieceAt(s, x, y);
  if (!p || PIECES[p.kind].rotations < 2) return false;
  return !((p.kind === 'fence' || p.kind === 'wall') && fenceMask(s, x, y) !== 0);
}

// A gate along x (rotation 0) is joined by the line pieces on its E and W sides, along y (1) by those on N and S: side
// as in fenceMask, seen from the gate. A fence against the gate's flank does not reach into it.
export function gateJoins(rot: number, side: number): boolean {
  return rot & 1 ? side === 1 || side === 4 : side === 2 || side === 8;
}

// Does the piece on (x, y) join the tile on its side `side` (1 N, 2 E, 4 S, 8 W, seen from the piece)? Fences, walls
// and pillars join every side; a gate only along its axis; nothing else joins.
function joinsTowards(s: GameState, x: number, y: number, side: number): boolean {
  if (!inBounds(x, y)) return false;
  const i = idx(x, y);
  const kind = solidKind(s.solid[i]);
  if (!kind || !PIECES[kind].joins) return false;
  return kind !== 'gate' || gateJoins(s.rot[i], side);
}

// Which neighbours of (x, y) a fence, wall or pillar there joins: N (y-1) = 1, E (x+1) = 2, S (y+1) = 4, W (x-1) = 8.
// They join fences, walls, pillars and the gates that line up with the tile (a gate along x on the E or W side, along
// y on the N or S side). Works for any tile, so a preview can show how a piece would join before it is placed.
// 0 = alone: then a fence's or wall's own rotation is used (0 = along x, 1 = along y); a pillar stands bare.
export function fenceMask(s: GameState, x: number, y: number): number {
  return (joinsTowards(s, x, y - 1, 4) ? 1 : 0) | (joinsTowards(s, x + 1, y, 8) ? 2 : 0) | (joinsTowards(s, x, y + 1, 1) ? 4 : 0) | (joinsTowards(s, x - 1, y, 2) ? 8 : 0);
}

// Does a dragged row of `kind` carry on over what is already on this tile, neither laying nor skipping it? Over the
// same piece (a floor row over floors, a base row over bases), and a fence or wall row over the gates and pillars
// in its line too.
export function rowCarriesOver(s: GameState, kind: PieceKind, x: number, y: number): boolean {
  if (!isPieceKind(kind) || !inBounds(x, y)) return false;
  const i = idx(x, y);
  if (PIECES[kind].layer === 'surface') return s.floor[i] === surfaceCode(kind as SurfaceKind);
  const there = solidKind(s.solid[i]);
  return !!there && (there === kind || (PIECES[kind].joins && (there === 'gate' || there === 'pillar')));
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

// The solid piece on a tile, fence, gate, lamp, wall, pillar or decoration (not a surface: see floorAt, surfaceAt).
export function pieceAt(s: GameState, x: number, y: number): { kind: PieceKind; rot: number } | null {
  if (!inBounds(x, y)) return null;
  const i = idx(x, y);
  const kind = solidKind(s.solid[i]);
  return kind ? { kind, rot: s.rot[i] } : null;
}

// Is there a surface (floor or base) on the tile?
export function floorAt(s: GameState, x: number, y: number): boolean {
  return inBounds(x, y) && s.floor[idx(x, y)] !== 0;
}

// The surface on a tile: 'floor', 'base' or null.
export function surfaceAt(s: GameState, x: number, y: number): SurfaceKind | null {
  return inBounds(x, y) ? surfaceKind(s.floor[idx(x, y)]) : null;
}

// ---------- moving decorations (docs/MODULAR-INC2.md §3c) ----------

// Only the decorations move (lamp, bench, planter, sign, pergola, Miso's house, sculpture, tree, fountain, statue);
// constructions, modules and buildings stay where they are.
export function isMovable(kind: PieceKind | null | undefined): boolean {
  return isPieceKind(kind) && !!PIECES[kind].decoration;
}

// Can the decoration on (fromX, fromY) move to (toX, toY)? The rules of pieceCheck for its kind, without the price:
// a move costs nothing. Not to its own tile (nothing would move).
export function moveCheck(s: GameState, fromX: number, fromY: number, toX: number, toY: number): PlaceCheck {
  const p = pieceAt(s, fromX, fromY);
  if (!p || !isMovable(p.kind)) return { ok: false, reason: t('move.only') };
  if (fromX === toX && fromY === toY) return { ok: false, reason: t('move.same') };
  return spotCheck(s, p.kind, toX, toY);
}

// Moves the decoration on (fromX, fromY) to (toX, toY), all at once or not at all: false, and nothing changed, when
// moveCheck says no. Nothing is paid or given back and no counter moves (stats.piecesPlaced stays: it was bought
// once); its rotation and its look (a planter's flowers, a sign's motif, a tree) go with it.
export function movePiece(s: GameState, fromX: number, fromY: number, toX: number, toY: number): boolean {
  if (!moveCheck(s, fromX, fromY, toX, toY).ok) return false;
  const from = idx(fromX, fromY);
  const to = idx(toX, toY);
  const kind = solidKind(s.solid[from])!;
  const look = pieceVarietyAt(s, from);
  s.solid[to] = s.solid[from];
  s.rot[to] = s.rot[from];
  // the look is written down only where the new tile would give another one
  s.variety[to] = (PIECES[kind].varieties ?? 1) > 1 && look !== pieceVariety(kind, toX, toY) ? look + 1 : 0;
  s.solid[from] = 0;
  s.rot[from] = 0;
  s.variety[from] = 0;
  s.fx.push({ kind: 'placed', ...tileFx(toX, toY) });
  return true;
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

// Can `kind` be installed on b? Only a discovered module (a project not found yet is refused with its goal), only on a
// finished building of the right type (paused is fine) whose single module slot is free: the same module again is
// "already installed", another one (the Recycler's magnet and sorter share the slot) is "slot taken by X: remove it
// first". costOnly when only the price is missing. (A module a loaded city already has stays on it, found or not:
// only buying one is refused.)
export function moduleCheck(s: GameState, kind: ModuleKind, b: Building): PlaceCheck {
  if (!isModuleKind(kind)) return { ok: false, reason: t('place.cannot') };
  if (isLocked(s, kind)) return { ok: false, reason: lockedReason(s, kind as ProjectKind) };
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
