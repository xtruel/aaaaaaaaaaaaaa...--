// What a click on a building selects where buildings and pieces overlap on screen (docs/MAP-STUDY.md §9): a Pixel
// Garden right behind the Spire, a fence behind a Bot Dock. The building drawn under the pointer is picked first
// (what you see is what you click); then
// - with the bulldozer, which draws the buildings in front of the tile under the pointer see-through, the click goes
//   to what it shows through them on that tile: dozeTarget (src/ui/catalog.ts) decides, with buildingBehind below;
// - without it (pickAt), a second click on the selected building, on the same tile, goes to what that building hides
//   there: the building standing on the tile, else its fence, gate or lamp. The next click picks the front one again.
// The second click of a double click does not count (it would flick the selection away and back). No DOM here.
import { BUILDINGS } from '../game/defs';
import { idx, inBounds } from '../game/state';
import type { GameState } from '../game/state';
import { standsInFront } from '../render/iso/depth';

// Two presses this close (ms) are one double press: a double click, a double tap, A pressed twice. 500 ms is Windows'
// default double-click time. Its second press never counts as a press of its own: here it does not reach behind the
// building; in the building panel (src/ui/hud.ts) it does not confirm a demolition or a module's removal that came up
// where the first press was, nor buy back a module just taken off.
export const DOUBLE_PRESS_MS = 500;

function frontCovers(s: GameState, frontId: number, tx: number, ty: number): boolean {
  const b = s.buildings.find((o) => o.id === frontId);
  if (!b || !inBounds(tx, ty)) return false;
  const def = BUILDINGS[b.type];
  return standsInFront({ x0: b.x, y0: b.y, x1: b.x + def.w, y1: b.y + def.h }, { x0: tx, y0: ty, x1: tx + 1, y1: ty + 1 });
}

// The building standing on tile (tx, ty) that building frontId stands in front of: -1 when the tile is free, is part
// of frontId, or is not behind it.
export function buildingBehind(s: GameState, frontId: number, tx: number, ty: number): number {
  if (!inBounds(tx, ty)) return -1;
  const id = s.occ[idx(tx, ty)];
  return id >= 0 && id !== frontId && frontCovers(s, frontId, tx, ty) ? id : -1;
}

// The fence, gate or lamp on tile (tx, ty) that building frontId stands in front of: its tile index, else -1.
export function pieceBehind(s: GameState, frontId: number, tx: number, ty: number): number {
  if (!inBounds(tx, ty)) return -1;
  const i = idx(tx, ty);
  return s.solid[i] !== 0 && s.occ[i] === -1 && frontCovers(s, frontId, tx, ty) ? i : -1;
}

// The last click on a building: the tile under the pointer, the building drawn there, when (ms).
export interface LastPick {
  tile: number;
  id: number;
  at: number;
}

export type PickResult = { building: number; piece: -1 } | { building: -1; piece: number };

// A click (no bulldozer: see dozeTarget) whose pointer shows building `picked` over tile (tx, ty): the building or
// piece to select.
export function pickAt(
  s: GameState,
  picked: number,
  tx: number,
  ty: number,
  o: { selected: number; last: LastPick | null; now: number },
): PickResult {
  const tile = inBounds(tx, ty) ? idx(tx, ty) : -1;
  const l = o.last;
  const again = o.selected === picked && !!l && l.id === picked && l.tile === tile && o.now - l.at >= DOUBLE_PRESS_MS;
  if (again) {
    const behind = buildingBehind(s, picked, tx, ty);
    if (behind >= 0) return { building: behind, piece: -1 };
    const piece = pieceBehind(s, picked, tx, ty);
    if (piece >= 0) return { building: -1, piece };
  }
  return { building: picked, piece: -1 };
}
