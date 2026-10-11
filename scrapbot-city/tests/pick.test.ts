// A click on the map reaches what a building hides (docs/MAP-STUDY.md §9): the Pixel Garden right behind the Spire
// that no click could select, the fences behind a building. src/ui/pick.ts decides for a plain click, dozeTarget
// (src/ui/catalog.ts) for the bulldozer; session.click asks them with the building drawn under the pointer and the
// tile under it.
import { describe, expect, it } from 'vitest';
import { placeBuilding } from '../src/game/actions';
import { T } from '../src/game/defs';
import { placePiece } from '../src/game/pieces';
import { computeDerived } from '../src/game/sim';
import { createGame, idx } from '../src/game/state';
import { standsInFront } from '../src/render/iso/depth';
import { dozeTarget } from '../src/ui/catalog';
import { DOUBLE_PRESS_MS, buildingBehind, pickAt, pieceBehind } from '../src/ui/pick';

function spireCity() {
  const s = createGame({ seed: 91, cityName: 'Pick' });
  s.res.credits = 1e5;
  s.res.parts = 1e4;
  s.pop = 40;
  for (let y = 18; y < 28; y++) for (let x = 0; x < 9; x++) s.tiles[idx(x, y)] = T.GROUND;
  computeDerived(s);
  const spire = placeBuilding(s, 'spire', 3, 22)!;
  const garden = placeBuilding(s, 'garden', 1, 20)!;
  spire.built = 1;
  garden.built = 1;
  expect(placePiece(s, 'fence', 2, 21)).toBe(true);
  return { s, spire, garden };
}

describe('a click reaches what a building hides (map study §9)', () => {
  // the map study's case: a Pixel Garden at (1,20), right behind the Spire at (3,22); a fence at (2,21)
  it('standsInFront: a footprint hides the ground behind it on x or y, not beside or in front of it', () => {
    const spire = { x0: 3, y0: 22, x1: 6, y1: 25 };
    expect(standsInFront(spire, { x0: 1, y0: 20, x1: 2, y1: 21 })).toBe(true);
    expect(standsInFront(spire, { x0: 4, y0: 21, x1: 5, y1: 22 })).toBe(true);
    expect(standsInFront(spire, { x0: 6, y0: 25, x1: 7, y1: 26 })).toBe(false);
    expect(standsInFront(spire, { x0: 7, y0: 20, x1: 8, y1: 21 })).toBe(false); // beside: neither hides the other
    expect(standsInFront(spire, { x0: 3, y0: 26, x1: 4, y1: 27 })).toBe(false);
  });

  it('the bulldozer shows the Garden through the Spire, so its click takes the Garden', () => {
    const { s, spire, garden } = spireCity();
    const none = () => -1;
    expect(buildingBehind(s, spire.id, 1, 20)).toBe(garden.id);
    expect(dozeTarget(s, 1, 20, spire.id, none)).toEqual({ kind: 'building', id: garden.id });
    // on the Spire's own tiles, or with nothing behind, it stays the Spire
    expect(dozeTarget(s, 4, 23, spire.id, none)).toEqual({ kind: 'building', id: spire.id });
    expect(dozeTarget(s, 2, 22, spire.id, none)).toEqual({ kind: 'building', id: spire.id });
    // the fence the Spire hides at (2,21) is taken up, not the Spire (a fence, gate or lamp on the tile comes first)
    expect(dozeTarget(s, 2, 21, spire.id, none)).toEqual({ kind: 'piece', i: idx(2, 21) });
  });

  it('without the bulldozer: first click the Spire, a second click there the Garden, a third the Spire again', () => {
    const { s, spire, garden } = spireCity();
    const tile = idx(1, 20);
    const first = pickAt(s, spire.id, 1, 20, { selected: -1, last: null, now: 1000 });
    expect(first).toEqual({ building: spire.id, piece: -1 });
    const second = pickAt(s, spire.id, 1, 20, { selected: spire.id, last: { tile, id: spire.id, at: 1000 }, now: 1000 + DOUBLE_PRESS_MS + 50 });
    expect(second).toEqual({ building: garden.id, piece: -1 });
    const third = pickAt(s, spire.id, 1, 20, { selected: garden.id, last: { tile, id: spire.id, at: 1400 }, now: 2500 });
    expect(third).toEqual({ building: spire.id, piece: -1 });
    // the second click of a double click does not count, up to Windows' default double-click time (500 ms); nor does
    // a click on another tile
    expect(DOUBLE_PRESS_MS).toBe(500);
    expect(pickAt(s, spire.id, 1, 20, { selected: spire.id, last: { tile, id: spire.id, at: 1000 }, now: 1450 })).toEqual({ building: spire.id, piece: -1 });
    expect(pickAt(s, spire.id, 1, 20, { selected: spire.id, last: { tile, id: spire.id, at: 1000 }, now: 1000 + DOUBLE_PRESS_MS - 50 })).toEqual({ building: spire.id, piece: -1 });
    expect(pickAt(s, spire.id, 1, 20, { selected: spire.id, last: { tile: idx(2, 20), id: spire.id, at: 0 }, now: 5000 })).toEqual({ building: spire.id, piece: -1 });
  });

  it('a fence hidden behind the Spire: the second click selects it', () => {
    const { s, spire } = spireCity();
    const tile = idx(2, 21);
    expect(pieceBehind(s, spire.id, 2, 21)).toBe(tile);
    expect(pickAt(s, spire.id, 2, 21, { selected: spire.id, last: { tile, id: spire.id, at: 0 }, now: 5000 })).toEqual({ building: -1, piece: tile });
    // a tile in front of the Spire holds nothing it hides
    expect(pieceBehind(s, spire.id, 6, 25)).toBe(-1);
    expect(buildingBehind(s, spire.id, 6, 25)).toBe(-1);
  });
});
