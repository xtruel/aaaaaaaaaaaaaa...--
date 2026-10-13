// Modular building, increment 1 (docs/MODULAR-INC1.md, section 6.1): floor, fence, gate, lamp, the Dock
// storage module and the Smelter filter. Placement rules, paying once, free cancelling, fence joins, module
// limits, before/after numbers, refunds that never create resources, demolition with modules, saves (and 0.6
// saves), and junk that never lands on a solid piece.
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addWaste, demolish, placeBuilding, placeCheck, placeFreeGarden, spawnJunk, spawnSludge } from '../src/game/actions';
import { BUILDINGS, MAP_H, MAP_W, SIM_STEP, T } from '../src/game/defs';
import type { BuildingType, Resource } from '../src/game/defs';
import {
  CATALOG_ORDER,
  MODULES,
  PIECES,
  buildingStats,
  buildingStatsWith,
  demolishRefund,
  dragPath,
  fenceMask,
  floorAt,
  installModule,
  isSolidAt,
  moduleCheck,
  moduleRefund,
  pieceAt,
  pieceCheck,
  pieceRefund,
  placePiece,
  removeModule,
  removePieceAt,
  rotatePieceAt,
} from '../src/game/pieces';
import type { ModuleKind, PieceKind } from '../src/game/pieces';
import { computeDerived, step } from '../src/game/sim';
import { SAVE_VERSION, createGame, deserialize, idx, serialize } from '../src/game/state';
import type { Building, GameState } from '../src/game/state';
import { mulberry32 } from '../src/game/world';
import { t } from '../src/i18n';

afterEach(() => vi.restoreAllMocks());

const FIXTURE_06 = readFileSync(new URL('./fixtures/save-0.6.json', import.meta.url), 'utf8');

function city(seed = 71): GameState {
  const s = createGame({ seed, cityName: 'Pieces' });
  s.res.credits = 5000;
  s.res.parts = 1000;
  computeDerived(s);
  return s;
}

function hqOf(s: GameState): Building {
  return s.buildings.find((b) => b.type === 'hq')!;
}

// Free ground or grass tiles near the HQ (no building, piece, floor, junk, sludge or rubble), nearest first.
function freeTiles(s: GameState, n: number): { x: number; y: number }[] {
  const hq = hqOf(s);
  const out: { x: number; y: number }[] = [];
  for (let r = 0; r < 30 && out.length < n; r++)
    for (let dy = -r; dy <= r && out.length < n; dy++)
      for (let dx = -r; dx <= r && out.length < n; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = hq.x + 1 + dx;
        const y = hq.y + 1 + dy;
        if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
        const i = idx(x, y);
        if ((s.tiles[i] === T.GROUND || s.tiles[i] === T.GRASS) && s.occ[i] === -1 && !s.solid[i] && !s.floor[i]) out.push({ x, y });
      }
  return out;
}

// A free w x h area of plain ground near the HQ, cleared by hand if needed (tests only).
function clearArea(s: GameState, w: number, h: number, ox = 3, oy = 4): { x: number; y: number } {
  const hq = hqOf(s);
  const x = hq.x + ox;
  const y = hq.y + oy;
  for (let dy = 0; dy < h; dy++)
    for (let dx = 0; dx < w; dx++) {
      const i = idx(x + dx, y + dy);
      expect(s.occ[i], 'test area overlaps a building').toBe(-1);
      s.tiles[i] = T.GROUND;
      s.amount[i] = 0;
    }
  return { x, y };
}

function build(s: GameState, type: BuildingType, done = true): Building {
  for (const p of freeTiles(s, 400)) {
    if (placeCheck(s, type, p.x, p.y).ok) {
      const b = placeBuilding(s, type, p.x, p.y)!;
      if (done) {
        b.built = 1;
        b.status = 'ok';
      }
      computeDerived(s);
      return b;
    }
  }
  throw new Error(`no room for ${type}`);
}

const total = (s: GameState) => s.res.credits + s.res.parts + s.res.scrap;
const resOf = (s: GameState) => ({ ...s.res });

// What the player has plus what they could get back by removing everything (every piece, module and building
// but the HQ). Buying lowers it, removing keeps it: if it ever goes up, something paid out twice.
function wealth(s: GameState): Record<Resource, number> {
  const w = resOf(s);
  const add = (c: Partial<Record<Resource, number>>) => {
    for (const r of Object.keys(c) as Resource[]) w[r] += c[r] ?? 0;
  };
  for (let i = 0; i < s.solid.length; i++) {
    const p = pieceAt(s, i % MAP_W, Math.floor(i / MAP_W));
    if (p) add(pieceRefund(p.kind));
    if (s.floor[i]) add(pieceRefund('floor'));
  }
  for (const b of s.buildings) if (b.type !== 'hq') add(demolishRefund(s, b));
  return w;
}

describe('catalog data (the owner-approved table)', () => {
  it('has the six items of increment 1 with the agreed prices, refunds and effects (increment 2 adds to them)', () => {
    // increment 2's decorations and G3's pieces come after the lamp (tests/decorations.test.ts,
    // tests/constructions.test.ts), its modules after the Smelter filter (tests/modules.test.ts); the first six stay as
    // they were, in that order
    const inc1 = ['floor', 'fence', 'gate', 'lamp', 'dockStorage', 'smelterFilter'];
    expect(CATALOG_ORDER.slice(0, 4)).toEqual(inc1.slice(0, 4));
    expect(CATALOG_ORDER.filter((k) => inc1.includes(k))).toEqual(inc1);
    expect(PIECES.floor).toMatchObject({ layer: 'surface', cost: { credits: 3 }, rotations: 1 });
    expect(PIECES.fence).toMatchObject({ layer: 'solid', cost: { credits: 4 }, rotations: 2, joins: true });
    expect(PIECES.gate).toMatchObject({ layer: 'solid', cost: { credits: 12 }, rotations: 2 });
    expect(PIECES.lamp).toMatchObject({ layer: 'solid', cost: { credits: 10, parts: 2 }, rotations: 4, joins: false });
    expect(MODULES.dockStorage).toMatchObject({ building: 'dock', cost: { credits: 30, parts: 15 }, limit: 1 });
    expect(MODULES.smelterFilter).toMatchObject({ building: 'smelter', cost: { credits: 45, parts: 20 }, limit: 1 });
    expect(pieceRefund('floor')).toEqual({ credits: 1 });
    expect(pieceRefund('fence')).toEqual({ credits: 2 });
    expect(pieceRefund('gate')).toEqual({ credits: 6 });
    expect(pieceRefund('lamp')).toEqual({ credits: 5, parts: 1 });
    expect(moduleRefund('dockStorage')).toEqual({ credits: 15, parts: 7 });
    expect(moduleRefund('smelterFilter')).toEqual({ credits: 22, parts: 10 });
  });

  it('without modules every building keeps its 0.6 numbers (cities play exactly as before)', () => {
    for (const type of Object.keys(BUILDINGS) as BuildingType[]) {
      const def = BUILDINGS[type];
      expect(buildingStats({ type })).toEqual({
        energy: def.energy,
        pollution: def.pollution,
        storage: def.storage ?? 0,
        housing: def.housing ?? 0,
        cycle: def.process?.time ?? 0,
        input: def.process?.input ?? {},
        output: def.process?.output ?? {},
        cleanRadius: def.cleanRadius ?? 0,
      });
      expect(buildingStats({ type, modules: [] })).toEqual(buildingStats({ type }));
    }
  });
});

describe('placing pieces', () => {
  it('solid pieces: inside the map, on ground or grass, not on a building, junk, sludge, rubble or another solid', () => {
    const s = city();
    const hq = hqOf(s);
    expect(pieceCheck(s, 'fence', -1, 0, 0)).toMatchObject({ ok: false, reason: t('place.outside') });
    expect(pieceCheck(s, 'fence', MAP_W, 3, 0)).toMatchObject({ ok: false, reason: t('place.outside') });
    expect(pieceCheck(s, 'lamp', hq.x, hq.y, 0)).toMatchObject({ ok: false, reason: t('place.occupied') });
    const { x, y } = clearArea(s, 4, 1);
    s.tiles[idx(x, y)] = T.JUNK;
    s.amount[idx(x, y)] = 10;
    s.tiles[idx(x + 1, y)] = T.SLUDGE;
    s.tiles[idx(x + 2, y)] = T.RUBBLE;
    s.tiles[idx(x + 3, y)] = T.GRASS;
    expect(pieceCheck(s, 'fence', x, y, 0)).toMatchObject({ ok: false, reason: t('place.junk') });
    expect(pieceCheck(s, 'gate', x + 1, y, 0)).toMatchObject({ ok: false, reason: t('place.sludge') });
    expect(pieceCheck(s, 'lamp', x + 2, y, 0)).toMatchObject({ ok: false, reason: t('place.rubble') });
    expect(pieceCheck(s, 'fence', x + 3, y, 0).ok).toBe(true);
    expect(placePiece(s, 'fence', x + 3, y, 0)).toBe(true);
    expect(pieceCheck(s, 'lamp', x + 3, y, 0)).toMatchObject({ ok: false, reason: t('place.fence') });
    expect(placePiece(s, 'gate', x + 3, y, 0)).toBe(false);
    // the solid layer, never the building occupancy
    expect(s.occ[idx(x + 3, y)]).toBe(-1);
    expect(isSolidAt(s, idx(x + 3, y))).toBe(true);
    expect(pieceAt(s, x + 3, y)).toEqual({ kind: 'fence', rot: 0 });
  });

  it('floors: not on junk, sludge, rubble, buildings or another floor; a solid on the tile does not stop them', () => {
    const s = city();
    const hq = hqOf(s);
    const { x, y } = clearArea(s, 3, 1);
    expect(pieceCheck(s, 'floor', hq.x + 1, hq.y + 1, 0)).toMatchObject({ ok: false, reason: t('place.occupied') });
    s.tiles[idx(x, y)] = T.SLUDGE;
    expect(pieceCheck(s, 'floor', x, y, 0)).toMatchObject({ ok: false, reason: t('place.sludge') });
    expect(placePiece(s, 'lamp', x + 1, y, 3)).toBe(true);
    expect(placePiece(s, 'floor', x + 1, y, 0)).toBe(true); // under the lamp
    expect(floorAt(s, x + 1, y)).toBe(true);
    expect(pieceAt(s, x + 1, y)).toEqual({ kind: 'lamp', rot: 3 });
    expect(pieceCheck(s, 'floor', x + 1, y, 0)).toMatchObject({ ok: false, reason: t('place.paved') });
    // and a solid can go on a floor
    expect(placePiece(s, 'floor', x + 2, y, 0)).toBe(true);
    expect(placePiece(s, 'gate', x + 2, y, 1)).toBe(true);
    expect(pieceAt(s, x + 2, y)).toEqual({ kind: 'gate', rot: 1 });
  });

  it('buildings refuse tiles with a solid piece (with the reason), but build on floors, which come back when demolished', () => {
    const s = city();
    const { x, y } = clearArea(s, 4, 3);
    for (const [kind, key] of [
      ['fence', 'place.fence'],
      ['gate', 'place.gate'],
      ['lamp', 'place.lamp'],
    ] as const) {
      expect(placePiece(s, kind, x + 1, y + 1, 0)).toBe(true);
      expect(placeCheck(s, 'dock', x, y)).toMatchObject({ ok: false, reason: t(key) });
      expect(placeBuilding(s, 'dock', x, y)).toBeNull();
      expect(removePieceAt(s, x + 1, y + 1)).not.toBeNull();
    }
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) expect(placePiece(s, 'floor', x + dx, y + dy, 0)).toBe(true);
    expect(placeCheck(s, 'dock', x, y).ok).toBe(true);
    const dock = placeBuilding(s, 'dock', x, y)!;
    // a floor cannot go under a standing building, and the bulldozer on its tiles leaves the floor alone
    expect(pieceCheck(s, 'floor', x + 2, y, 0).ok).toBe(true);
    expect(removePieceAt(s, x, y)).toBeNull();
    expect(floorAt(s, x, y)).toBe(true);
    s.dirtyTiles.length = 0;
    expect(demolish(s, dock)).toBe(true);
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) expect(floorAt(s, x + dx, y + dy)).toBe(true);
    // the renderer is told to draw the uncovered floor again
    expect(s.dirtyTiles).toEqual(expect.arrayContaining([idx(x, y), idx(x + 1, y), idx(x, y + 1), idx(x + 1, y + 1)]));
  });

  it('pays once, on confirmation: checks and previews are free, a refused placement costs nothing', () => {
    const s = city();
    const { x, y } = clearArea(s, 6, 1);
    const before = resOf(s);
    for (let k = 0; k < 50; k++) {
      for (const kind of ['floor', 'fence', 'gate', 'lamp'] as PieceKind[]) pieceCheck(s, kind, x, y, k);
      fenceMask(s, x, y);
    }
    expect(resOf(s)).toEqual(before); // previewing and cancelling are free
    expect(placePiece(s, 'lamp', x, y, 0)).toBe(true);
    expect(s.res.credits).toBe(before.credits - 10);
    expect(s.res.parts).toBe(before.parts - 2);
    const after = resOf(s);
    expect(placePiece(s, 'lamp', x, y, 1)).toBe(false); // same tile again: refused, free
    expect(resOf(s)).toEqual(after);
    expect(s.stats.piecesPlaced).toBe(1);
    // a dragged row: every placed tile pays, invalid tiles are skipped for free
    s.tiles[idx(x + 2, y)] = T.RUBBLE;
    const credits = s.res.credits;
    let placed = 0;
    for (let dx = 0; dx < 6; dx++) if (placePiece(s, 'fence', x + dx, y, 0)) placed++;
    expect(placed).toBe(4); // x is taken by the lamp, x+2 is rubble
    expect(s.res.credits).toBe(credits - 4 * PIECES.fence.cost.credits!);
  });

  it('refuses unknown kinds and tile codes outside ground or grass, for free and without throwing', () => {
    const s = city();
    const { x, y } = clearArea(s, 1, 1);
    const before = resOf(s);
    for (const kind of ['constructor', 'toString', '__proto__', 'dockStorage', ''] as unknown as PieceKind[]) {
      expect(pieceCheck(s, kind, x, y, 0)).toMatchObject({ ok: false, reason: t('place.cannot') });
      expect(placePiece(s, kind, x, y, 0)).toBe(false);
    }
    const hq = hqOf(s);
    for (const kind of ['constructor', 'floor'] as unknown as ModuleKind[]) {
      expect(moduleCheck(s, kind, hq)).toMatchObject({ ok: false, reason: t('place.cannot') });
      expect(installModule(s, kind, hq)).toBe(false);
    }
    s.tiles[idx(x, y)] = 7; // not a tile kind the game knows (a damaged save)
    expect(pieceCheck(s, 'floor', x, y, 0)).toMatchObject({ ok: false, reason: t('place.cannot') });
    expect(pieceCheck(s, 'fence', x, y, 0)).toMatchObject({ ok: false, reason: t('place.cannot') });
    expect(resOf(s)).toEqual(before);
    expect(s.solid[idx(x, y)] + s.floor[idx(x, y)]).toBe(0);
  });

  it('cannot buy what it cannot afford (costOnly), and nothing is taken', () => {
    const s = city();
    const { x, y } = clearArea(s, 1, 1);
    s.res.credits = 9;
    s.res.parts = 50;
    expect(pieceCheck(s, 'lamp', x, y, 0)).toMatchObject({ ok: false, costOnly: true });
    expect(placePiece(s, 'lamp', x, y, 0)).toBe(false);
    expect(s.res).toMatchObject({ credits: 9, parts: 50 });
    s.res.credits = 10;
    s.res.parts = 1;
    expect(pieceCheck(s, 'lamp', x, y, 0).costOnly).toBe(true);
    s.res.parts = 2;
    expect(placePiece(s, 'lamp', x, y, 0)).toBe(true);
    expect(s.res).toMatchObject({ credits: 0, parts: 0 });
  });

  it('a placed piece raises a "placed" effect, floors mark their tile for redrawing', () => {
    const s = city();
    const { x, y } = clearArea(s, 2, 1);
    s.fx.length = 0;
    s.dirtyTiles.length = 0;
    placePiece(s, 'floor', x, y, 0);
    expect(s.dirtyTiles).toContain(idx(x, y));
    placePiece(s, 'fence', x + 1, y, 0);
    expect(s.fx.map((f) => f.kind)).toEqual(['placed', 'placed']);
  });

  it('pieces are decoration: no change to the path meter, happiness, buildings count or income stats', () => {
    const s = city();
    const { x, y } = clearArea(s, 4, 1);
    const snap = { alignment: s.alignment, happy: s.derived.happiness, built: s.stats.built, earned: s.stats.creditsEarned, parts: s.stats.partsMade };
    placePiece(s, 'floor', x, y, 0);
    placePiece(s, 'fence', x + 1, y, 0);
    placePiece(s, 'gate', x + 2, y, 0);
    placePiece(s, 'lamp', x + 3, y, 0);
    for (let dx = 0; dx < 4; dx++) removePieceAt(s, x + dx, y);
    removePieceAt(s, x, y);
    computeDerived(s);
    expect({ alignment: s.alignment, happy: s.derived.happiness, built: s.stats.built, earned: s.stats.creditsEarned, parts: s.stats.partsMade }).toEqual(snap);
  });
});

describe('removing and rotating pieces', () => {
  it('the bulldozer takes the solid piece first, then the floor, each for half its price', () => {
    const s = city();
    const { x, y } = clearArea(s, 1, 1);
    placePiece(s, 'floor', x, y, 0);
    placePiece(s, 'lamp', x, y, 2);
    const before = resOf(s);
    s.fx.length = 0;
    expect(removePieceAt(s, x, y)).toEqual({ credits: 5, parts: 1 });
    expect(pieceAt(s, x, y)).toBeNull();
    expect(floorAt(s, x, y)).toBe(true);
    expect(s.fx[0]).toMatchObject({ kind: 'demolish' });
    expect(s.fx[0].text).toMatch(/^\+/);
    s.dirtyTiles.length = 0;
    expect(removePieceAt(s, x, y)).toEqual({ credits: 1 });
    expect(floorAt(s, x, y)).toBe(false);
    expect(s.dirtyTiles).toContain(idx(x, y));
    expect(removePieceAt(s, x, y)).toBeNull(); // nothing left: nothing given
    expect(removePieceAt(s, -3, 2)).toBeNull();
    expect(s.res.credits).toBe(before.credits + 6);
    expect(s.res.parts).toBe(before.parts + 1);
    // refunds are not income
    expect(s.stats.creditsEarned).toBe(0);
  });

  it('gates turn 2 ways and lamps 4, for free; a fence turns only while it stands alone', () => {
    const s = city();
    const { x, y } = clearArea(s, 5, 1);
    placePiece(s, 'gate', x, y, 0);
    placePiece(s, 'lamp', x + 2, y, 0);
    placePiece(s, 'fence', x + 4, y, 0);
    const before = resOf(s);
    const gateRots = [1, 2, 3].map(() => (rotatePieceAt(s, x, y), pieceAt(s, x, y)!.rot));
    expect(gateRots).toEqual([1, 0, 1]);
    const lampRots = [1, 2, 3, 4].map(() => (rotatePieceAt(s, x + 2, y), pieceAt(s, x + 2, y)!.rot));
    expect(lampRots).toEqual([1, 2, 3, 0]);
    expect(rotatePieceAt(s, x + 2, y, -1)).toBe(true);
    expect(pieceAt(s, x + 2, y)!.rot).toBe(3);
    expect(rotatePieceAt(s, x + 4, y)).toBe(true); // alone
    expect(pieceAt(s, x + 4, y)!.rot).toBe(1);
    placePiece(s, 'fence', x + 3, y, 0);
    expect(rotatePieceAt(s, x + 4, y)).toBe(false); // joined: follows its neighbour
    expect(rotatePieceAt(s, x + 1, y)).toBe(false); // empty tile
    expect(s.res.credits).toBe(before.credits - 4); // only the second fence was paid
  });

  it('rotations are kept in range whatever the caller passes', () => {
    const s = city();
    const { x, y } = clearArea(s, 4, 1);
    placePiece(s, 'lamp', x, y, 7);
    placePiece(s, 'gate', x + 1, y, -1);
    placePiece(s, 'fence', x + 3, y, 5);
    expect(pieceAt(s, x, y)!.rot).toBe(3);
    expect(pieceAt(s, x + 1, y)!.rot).toBe(1);
    expect(pieceAt(s, x + 3, y)!.rot).toBe(1);
  });
});

describe('fence joins', () => {
  // N (y-1) = 1, E (x+1) = 2, S (y+1) = 4, W (x-1) = 8, over fences and gates
  it('straight runs, every corner, T joints and the cross', () => {
    const s = city();
    const { x, y } = clearArea(s, 5, 5, 3, 4);
    const at = (dx: number, dy: number) => fenceMask(s, x + dx, y + dy);
    // a filled 3 x 3 block: corners, T joints on the sides, a cross in the middle
    for (const [dx, dy] of [
      [0, 0], [1, 0], [2, 0],
      [0, 1], [1, 1], [2, 1],
      [0, 2], [1, 2], [2, 2],
    ]) expect(placePiece(s, 'fence', x + dx, y + dy, 0)).toBe(true);
    expect(at(0, 0)).toBe(2 | 4); // top-left corner: E + S
    expect(at(2, 0)).toBe(4 | 8); // top-right corner: S + W
    expect(at(2, 2)).toBe(1 | 8); // bottom-right corner: N + W
    expect(at(0, 2)).toBe(1 | 2); // bottom-left corner: N + E
    expect(at(1, 0)).toBe(2 | 4 | 8); // T
    expect(at(1, 1)).toBe(15); // cross
    // a straight run along x and its ends
    const r = clearArea(s, 5, 1, -8, 5);
    for (let dx = 0; dx < 4; dx++) placePiece(s, 'fence', r.x + dx, r.y, 0);
    expect(fenceMask(s, r.x, r.y)).toBe(2);
    expect(fenceMask(s, r.x + 1, r.y)).toBe(2 | 8);
    expect(fenceMask(s, r.x + 3, r.y)).toBe(8);
  });

  it('fences join gates, not lamps; a lone fence has mask 0 and keeps its rotation', () => {
    const s = city();
    const { x, y } = clearArea(s, 5, 2);
    placePiece(s, 'fence', x, y, 0);
    placePiece(s, 'gate', x + 1, y, 0);
    placePiece(s, 'fence', x + 2, y, 0);
    placePiece(s, 'lamp', x + 3, y, 0);
    expect(fenceMask(s, x, y)).toBe(2);
    expect(fenceMask(s, x + 2, y)).toBe(8); // the gate joins, the lamp does not
    expect(fenceMask(s, x + 1, y)).toBe(2 | 8); // a gate between two fences
    placePiece(s, 'fence', x + 4, y + 1, 1);
    expect(fenceMask(s, x + 4, y + 1)).toBe(0);
    expect(pieceAt(s, x + 4, y + 1)).toEqual({ kind: 'fence', rot: 1 });
    // the preview can ask about an empty tile: it would join the fence to its west
    expect(fenceMask(s, x + 3, y + 1)).toBe(2);
    // removing a neighbour updates the joins
    removePieceAt(s, x + 1, y);
    expect(fenceMask(s, x, y)).toBe(0);
    expect(fenceMask(s, x + 2, y)).toBe(0);
  });

  it('a drag can turn a corner: dragPath gives a row or an L, and the fences at the corner join', () => {
    expect(dragPath(2, 3, 5, 3)).toEqual([{ x: 2, y: 3 }, { x: 3, y: 3 }, { x: 4, y: 3 }, { x: 5, y: 3 }]);
    expect(dragPath(4, 4, 4, 4)).toEqual([{ x: 4, y: 4 }]);
    expect(dragPath(5, 1, 3, 3)).toEqual([{ x: 5, y: 1 }, { x: 4, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 2 }, { x: 3, y: 3 }]);
    expect(dragPath(5, 1, 3, 3, false)).toEqual([{ x: 5, y: 1 }, { x: 5, y: 2 }, { x: 5, y: 3 }, { x: 4, y: 3 }, { x: 3, y: 3 }]);
    const s = city();
    const { x, y } = clearArea(s, 4, 4);
    s.tiles[idx(x + 3, y + 2)] = T.RUBBLE; // skipped, for free
    const credits = s.res.credits;
    const path = dragPath(x, y, x + 3, y + 3);
    let placed = 0;
    for (const p of path) placed += +placePiece(s, 'fence', p.x, p.y, 0);
    expect(path).toHaveLength(7);
    expect(placed).toBe(6);
    expect(s.res.credits).toBe(credits - 6 * 4);
    expect(fenceMask(s, x + 3, y)).toBe(4 | 8); // the corner: S + W
    expect(fenceMask(s, x + 1, y)).toBe(2 | 8);
    expect(fenceMask(s, x + 3, y + 1)).toBe(1); // the rubble breaks the run below
  });

  it('works at the map edges', () => {
    const s = city();
    s.tiles[idx(0, 0)] = T.GROUND;
    s.tiles[idx(1, 0)] = T.GROUND;
    s.tiles[idx(0, 1)] = T.GROUND;
    expect(placePiece(s, 'fence', 0, 0, 0)).toBe(true);
    expect(placePiece(s, 'fence', 1, 0, 0)).toBe(true);
    expect(placePiece(s, 'fence', 0, 1, 0)).toBe(true);
    expect(fenceMask(s, 0, 0)).toBe(2 | 4);
    expect(fenceMask(s, MAP_W - 1, MAP_H - 1)).toBe(0);
  });
});

describe('modules', () => {
  it('only on a finished building of the right type, one of each, paused is fine', () => {
    const s = city();
    const hq = hqOf(s);
    const dock = build(s, 'dock', false);
    const smelter = build(s, 'smelter');
    expect(moduleCheck(s, 'dockStorage', hq)).toMatchObject({ ok: false, reason: t('place.modDock') });
    expect(moduleCheck(s, 'dockStorage', smelter)).toMatchObject({ ok: false, reason: t('place.modDock') });
    expect(moduleCheck(s, 'smelterFilter', dock)).toMatchObject({ ok: false, reason: t('place.modSmelter') });
    expect(moduleCheck(s, 'dockStorage', dock)).toMatchObject({ ok: false, reason: t('place.modDock') }); // still building
    expect(installModule(s, 'dockStorage', dock)).toBe(false);
    dock.built = 1;
    smelter.paused = true;
    expect(moduleCheck(s, 'dockStorage', dock).ok).toBe(true);
    expect(installModule(s, 'dockStorage', dock)).toBe(true);
    expect(installModule(s, 'smelterFilter', smelter)).toBe(true);
    expect(moduleCheck(s, 'dockStorage', dock)).toMatchObject({ ok: false, reason: t('place.modInstalled') });
    expect(moduleCheck(s, 'smelterFilter', smelter)).toMatchObject({ ok: false, reason: t('place.modInstalled') });
    const res = resOf(s);
    expect(installModule(s, 'dockStorage', dock)).toBe(false);
    expect(resOf(s)).toEqual(res);
    expect(dock.modules).toEqual(['dockStorage']);
    expect(smelter.modules).toEqual(['smelterFilter']);
    expect(s.stats.modulesInstalled).toBe(2);
  });

  it('pays once at install; checking is free; too poor is costOnly', () => {
    const s = city();
    const dock = build(s, 'dock');
    const before = resOf(s);
    for (let k = 0; k < 20; k++) moduleCheck(s, 'dockStorage', dock);
    expect(resOf(s)).toEqual(before);
    expect(installModule(s, 'dockStorage', dock)).toBe(true);
    expect(s.res.credits).toBe(before.credits - 30);
    expect(s.res.parts).toBe(before.parts - 15);
    const smelter = build(s, 'smelter');
    s.res.credits = 44;
    expect(moduleCheck(s, 'smelterFilter', smelter)).toMatchObject({ ok: false, costOnly: true });
    expect(installModule(s, 'smelterFilter', smelter)).toBe(false);
    expect(s.res.credits).toBe(44);
  });

  it('before/after: Dock storage 80 -> 180; Smelter pollution 0.035 -> 0.014, energy -2 -> -3, same output', () => {
    expect(buildingStatsWith({ type: 'dock' }, []).storage).toBe(80);
    expect(buildingStatsWith({ type: 'dock' }, ['dockStorage']).storage).toBe(180);
    const plain = buildingStatsWith({ type: 'smelter' }, []);
    const filtered = buildingStatsWith({ type: 'smelter' }, ['smelterFilter']);
    expect(plain.pollution).toBeCloseTo(0.035, 10);
    expect(filtered.pollution).toBeCloseTo(0.014, 10);
    expect(plain.energy).toBe(-2);
    expect(filtered.energy).toBe(-3);
    // modules that do not fit, or repeats, change nothing
    expect(buildingStatsWith({ type: 'dock' }, ['smelterFilter'])).toEqual(buildingStatsWith({ type: 'dock' }, []));
    expect(buildingStatsWith({ type: 'dock' }, ['dockStorage', 'dockStorage']).storage).toBe(180);
    expect(buildingStatsWith({ type: 'hq' }, ['dockStorage', 'smelterFilter'])).toEqual(buildingStats({ type: 'hq' }));
  });

  it('the sim uses the module numbers: storage goes up at once, the filtered Smelter pollutes less and uses more power, same credits', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const make = (filter: boolean) => {
      const s = city(72);
      s.pollution = 20;
      const dock = build(s, 'dock');
      const smelter = build(s, 'smelter');
      s.res.scrap = 200;
      const storage = s.derived.storage;
      expect(installModule(s, 'dockStorage', dock)).toBe(true);
      expect(s.derived.storage).toBe(storage + 100); // immediate
      if (filter) expect(installModule(s, 'smelterFilter', smelter)).toBe(true);
      s.res.credits = 1000;
      s.res.scrap = 300;
      return s;
    };
    const plain = make(false);
    const filtered = make(true);
    for (const s of [plain, filtered]) for (let k = 0; k < 40; k++) step(s, SIM_STEP);
    expect(plain.derived.storage).toBe(150 + 180);
    expect(plain.derived.efficiency).toBe(1);
    expect(filtered.derived.efficiency).toBe(1);
    expect(filtered.derived.energyUse - plain.derived.energyUse).toBe(1);
    // the Smelter really worked in both cities, earning the same
    expect(plain.buildings.find((b) => b.type === 'smelter')!.status).toBe('ok');
    expect(filtered.res.credits).toBeCloseTo(plain.res.credits, 6);
    // (the cleaner air also decays a hair slower, hence the loose precision)
    expect(plain.derived.pollutionRate - filtered.derived.pollutionRate).toBeCloseTo(0.035 - 0.014, 3);
    expect(filtered.pollution).toBeLessThan(plain.pollution);
  });

  it('removing a module keeps the building, gives back half, and clamps scrap above the smaller storage', () => {
    const s = city();
    const dock = build(s, 'dock');
    installModule(s, 'dockStorage', dock);
    computeDerived(s);
    const cap = s.derived.storage;
    s.res.scrap = cap;
    const before = resOf(s);
    s.fx.length = 0;
    expect(removeModule(s, 'dockStorage', dock)).toEqual({ credits: 15, parts: 7 });
    expect(s.buildings).toContain(dock);
    expect(dock.modules).toBeUndefined();
    expect(s.res.credits).toBe(before.credits + 15);
    expect(s.res.parts).toBe(before.parts + 7);
    expect(s.derived.storage).toBe(cap - 100);
    expect(s.res.scrap).toBe(cap - 100);
    expect(s.fx[0]).toMatchObject({ kind: 'demolish' });
    expect(removeModule(s, 'dockStorage', dock)).toBeNull(); // only once
    expect(s.res.credits).toBe(before.credits + 15);
    // a module that does not count on this building (pushed by hand) is never refunded, as in demolishRefund
    dock.modules = ['smelterFilter'];
    expect(removeModule(s, 'smelterFilter', dock)).toBeNull();
    expect(demolishRefund(s, dock)).toEqual({ credits: 20, parts: 5 });
    expect(s.res.credits).toBe(before.credits + 15);
  });

  it('demolishing a building with modules gives back the building and its modules, shown before, and leaves no orphan', () => {
    const s = city();
    const dock = build(s, 'dock');
    const smelter = build(s, 'smelter');
    installModule(s, 'dockStorage', dock);
    installModule(s, 'smelterFilter', smelter);
    const shown = demolishRefund(s, smelter);
    // Smelter 30 credits -> 15 back; filter 45 + 20 -> 22 + 10 back
    expect(shown).toEqual({ credits: 15 + 22, parts: 10 });
    const before = resOf(s);
    expect(demolish(s, smelter)).toBe(true);
    expect(s.res.credits).toBe(before.credits + 37);
    expect(s.res.parts).toBe(before.parts + 10);
    // a stale reference cannot be demolished (or refunded) twice, and its module cannot be taken off later
    expect(demolish(s, smelter)).toBe(false);
    expect(removeModule(s, 'smelterFilter', smelter)).toBeNull();
    expect(installModule(s, 'smelterFilter', smelter)).toBe(false);
    expect(s.res.credits).toBe(before.credits + 37);
    // no module left without its building, in the city or in the save
    expect(s.buildings.find((b) => b.id === smelter.id)).toBeUndefined();
    const saved = JSON.parse(serialize(s)) as { buildings: Building[] };
    expect(saved.buildings.filter((b) => b.modules).map((b) => b.id)).toEqual([dock.id]);
    // the Dock's refund includes its storage module too
    expect(demolishRefund(s, dock)).toEqual({ credits: 20 + 15, parts: 5 + 7 });
  });
});

describe('no resources out of thin air', () => {
  it('place / remove / install / remove / demolish, in any order, never raises any resource', () => {
    const did = { placed: 0, removed: 0, installed: 0, uninstalled: 0, demolished: 0 };
    for (let seed = 1; seed <= 6; seed++) {
      const rng = mulberry32(seed * 7919);
      const s = city(80 + seed);
      s.res.scrap = 60;
      const area = clearArea(s, 8, 6, -11, 4);
      const tiles = [...freeTiles(s, 60), ...Array.from({ length: 48 }, (_, k) => ({ x: area.x + (k % 8), y: area.y + Math.floor(k / 8) }))];
      const start = resOf(s);
      let max = resOf(s);
      let worth = wealth(s);
      const pick = <V>(list: V[]): V => list[Math.floor(rng() * list.length)];
      for (let n = 0; n < 600; n++) {
        const op = Math.floor(rng() * 9);
        const p = pick(tiles);
        const others = s.buildings.filter((b) => b.type !== 'hq');
        if (op <= 1) did.placed += +placePiece(s, pick(['floor', 'fence', 'gate', 'lamp'] as PieceKind[]), p.x, p.y, Math.floor(rng() * 4));
        else if (op === 2) did.removed += +!!removePieceAt(s, p.x, p.y);
        else if (op === 3) rotatePieceAt(s, p.x, p.y);
        else if (op === 4 && others.length < 6) {
          const type = pick(['dock', 'smelter'] as BuildingType[]);
          if (placeCheck(s, type, p.x, p.y).ok) placeBuilding(s, type, p.x, p.y)!.built = rng() < 0.7 ? 1 : 0.5;
        } else if (op === 5 && others.length) did.installed += +installModule(s, pick(['dockStorage', 'smelterFilter'] as ModuleKind[]), pick(others));
        else if (op === 6 && others.length) {
          // mostly a module that is there, sometimes one that is not
          const fitted = others.filter((b) => b.modules?.length);
          const b = fitted.length && rng() < 0.8 ? pick(fitted) : pick(others);
          did.uninstalled += +!!removeModule(s, b.modules?.length ? pick(b.modules) : pick(['dockStorage', 'smelterFilter'] as ModuleKind[]), b);
        }
        else if (op === 7 && others.length) did.demolished += +demolish(s, pick(others));
        else if (op === 8 && others.length) {
          // stale references: a building already gone must not pay out again
          const gone = pick(others);
          demolish(s, gone);
          demolish(s, gone);
          removeModule(s, pick(['dockStorage', 'smelterFilter'] as ModuleKind[]), gone);
        }
        const now = wealth(s);
        for (const r of Object.keys(start) as Resource[]) {
          expect(now[r], `seed ${seed} step ${n} op ${op} wealth ${r}`).toBeLessThanOrEqual(worth[r] + 1e-9);
          expect(s.res[r], `seed ${seed} step ${n} ${r}`).toBeLessThanOrEqual(start[r] + 1e-9);
          expect(s.res[r]).toBeGreaterThanOrEqual(0);
        }
        // invariants: no solid on a building, modules only where they fit, never twice
        for (const b of s.buildings) {
          const def = BUILDINGS[b.type];
          for (let dy = 0; dy < def.h; dy++) for (let dx = 0; dx < def.w; dx++) expect(s.solid[idx(b.x + dx, b.y + dy)]).toBe(0);
          if (b.modules) {
            expect(new Set(b.modules).size).toBe(b.modules.length);
            for (const m of b.modules) expect(MODULES[m].building).toBe(b.type);
          }
        }
        worth = now;
        max = { scrap: Math.max(max.scrap, s.res.scrap), parts: Math.max(max.parts, s.res.parts), credits: Math.max(max.credits, s.res.credits) };
      }
      expect(max).toEqual(start);
      // take everything apart: still no more than the city started with
      for (const b of s.buildings.filter((o) => o.type !== 'hq')) demolish(s, b);
      for (const p of tiles) while (removePieceAt(s, p.x, p.y));
      expect(total(s)).toBeLessThanOrEqual(start.credits + start.parts + start.scrap);
      expect(s.solid.every((v) => v === 0) && s.floor.every((v) => v === 0)).toBe(true);
    }
    // the random runs really exercised every action
    for (const [k, v] of Object.entries(did)) expect(v, k).toBeGreaterThan(3);
  });
});

describe('junk, sludge and rubble never land on a solid piece', () => {
  it('storms, waste, sludge and gifted gardens skip fences, gates and lamps (but junk may cover a floor)', () => {
    const s = city(73);
    // homes, so citizens' waste has somewhere to come from
    build(s, 'pods');
    build(s, 'pods');
    // solid pieces on almost all the free ground of the map, floor on the rest
    const solids: number[] = [];
    const floors: number[] = [];
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++) {
        const i = idx(x, y);
        if (s.occ[i] !== -1 || (s.tiles[i] !== T.GROUND && s.tiles[i] !== T.GRASS)) continue;
        if ((x + y) % 5 === 0) {
          placePiece(s, 'floor', x, y, 0);
          floors.push(i);
        } else {
          s.res.credits = 1000;
          s.res.parts = 1000;
          expect(placePiece(s, pick3(x, y), x, y, 0)).toBe(true);
          solids.push(i);
        }
      }
    expect(solids.length).toBeGreaterThan(500);
    for (let k = 0; k < 40; k++) {
      spawnJunk(s, 30, 15, 35);
      spawnJunk(s, 10, 5, 10, { x: 20, y: 15, r: 10 });
      spawnSludge(s, 8);
      placeFreeGarden(s);
      addWaste(s, 6);
    }
    for (const i of solids) {
      expect(s.tiles[i] === T.GROUND || s.tiles[i] === T.GRASS, `tile ${i} became ${s.tiles[i]}`).toBe(true);
      expect(s.occ[i]).toBe(-1);
      expect(isSolidAt(s, i)).toBe(true);
    }
    // the floors took junk: the floor is still there under it, and shows again once the bots clear it
    const covered = floors.filter((i) => s.tiles[i] === T.JUNK);
    expect(covered.length).toBeGreaterThan(0);
    for (const i of covered) expect(s.floor[i]).toBe(1);
  });

  it('bots clearing junk from a floor leave the floor', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const s = city(74);
    const { x, y } = clearArea(s, 1, 1, 2, -2);
    placePiece(s, 'floor', x, y, 0);
    s.tiles[idx(x, y)] = T.JUNK;
    s.amount[idx(x, y)] = 5;
    for (let k = 0; k < 20 * 60 && s.tiles[idx(x, y)] === T.JUNK; k++) step(s, SIM_STEP);
    expect(s.tiles[idx(x, y)]).toBe(T.GROUND);
    expect(floorAt(s, x, y)).toBe(true);
  });

  it('a new map has no pieces', () => {
    const s = createGame({ seed: 75 });
    expect(s.solid.every((v) => v === 0)).toBe(true);
    expect(s.floor.every((v) => v === 0)).toBe(true);
    expect(s.stats.piecesPlaced).toBe(0);
    expect(s.stats.modulesInstalled).toBe(0);
  });
});

function pick3(x: number, y: number): PieceKind {
  return (['fence', 'gate', 'lamp'] as const)[(x * 7 + y * 3) % 3];
}

describe('saves', () => {
  it('a 0.6 save loads unchanged, with no pieces and no modules', () => {
    const s = deserialize(FIXTURE_06);
    const raw = JSON.parse(FIXTURE_06);
    expect(s.cityName).toBe('Old Town');
    expect(s.buildings.map((b) => b.type)).toEqual(raw.buildings.map((b: Building) => b.type));
    expect(s.res).toEqual(raw.res);
    expect(s.floor.length).toBe(MAP_W * MAP_H);
    expect(s.solid.length).toBe(MAP_W * MAP_H);
    expect(s.rot.length).toBe(MAP_W * MAP_H);
    expect(s.floor.every((v) => v === 0) && s.solid.every((v) => v === 0) && s.rot.every((v) => v === 0)).toBe(true);
    expect(s.buildings.every((b) => b.modules === undefined)).toBe(true);
    expect(s.stats.piecesPlaced).toBe(0);
    expect(s.stats.modulesInstalled).toBe(0);
    expect(s.stats.scrapCollected).toBe(raw.stats.scrapCollected);
    expect(Object.keys(s)).not.toContain('floors');
    expect(Object.keys(s)).not.toContain('solids');
    // and it plays on with the same numbers as before
    computeDerived(s);
    expect(s.derived.storage).toBe(150 + 80);
    for (let k = 0; k < 100; k++) step(s, SIM_STEP);
    expect(Number.isFinite(s.res.credits)).toBe(true);
  });

  it('a 0.6 city can buy pieces and modules, and the save round-trips them', () => {
    const s = deserialize(FIXTURE_06);
    computeDerived(s);
    const dock = s.buildings.find((b) => b.type === 'dock')!;
    const smelter = s.buildings.find((b) => b.type === 'smelter')!;
    expect(installModule(s, 'dockStorage', dock)).toBe(true);
    expect(installModule(s, 'smelterFilter', smelter)).toBe(true);
    const tiles = freeTiles(s, 6);
    expect(placePiece(s, 'floor', tiles[0].x, tiles[0].y, 0)).toBe(true);
    expect(placePiece(s, 'floor', tiles[1].x, tiles[1].y, 0)).toBe(true);
    expect(placePiece(s, 'fence', tiles[1].x, tiles[1].y, 1)).toBe(true);
    expect(placePiece(s, 'gate', tiles[2].x, tiles[2].y, 1)).toBe(true);
    expect(placePiece(s, 'lamp', tiles[3].x, tiles[3].y, 3)).toBe(true);
    const json = serialize(s);
    const data = JSON.parse(json);
    expect(data.version).toBe(SAVE_VERSION);
    expect(data.floors).toEqual([idx(tiles[0].x, tiles[0].y), idx(tiles[1].x, tiles[1].y)].sort((a, b) => a - b));
    expect(data.solids).toHaveLength(3);
    expect(data.floor).toBeUndefined();
    expect(data.solid).toBeUndefined();
    const back = deserialize(json);
    expect(Array.from(back.floor)).toEqual(Array.from(s.floor));
    expect(Array.from(back.solid)).toEqual(Array.from(s.solid));
    expect(Array.from(back.rot)).toEqual(Array.from(s.rot));
    expect(pieceAt(back, tiles[1].x, tiles[1].y)).toEqual({ kind: 'fence', rot: 1 });
    expect(pieceAt(back, tiles[3].x, tiles[3].y)).toEqual({ kind: 'lamp', rot: 3 });
    expect(back.buildings.find((b) => b.id === dock.id)!.modules).toEqual(['dockStorage']);
    expect(back.buildings.find((b) => b.id === smelter.id)!.modules).toEqual(['smelterFilter']);
    expect(back.buildings.filter((b) => b.modules).length).toBe(2);
    expect(back.stats.piecesPlaced).toBe(5);
    expect(back.stats.modulesInstalled).toBe(2);
    computeDerived(back);
    expect(back.derived.storage).toBe(150 + 180);
    // a second round trip changes nothing
    expect(serialize(deserialize(json))).toBe(json);
  });

  it('a damaged save cannot stack modules, put them on the wrong building or put pieces under buildings', () => {
    const s = city();
    const dock = build(s, 'dock');
    const hq = hqOf(s);
    // (1, 0) is plain ground, so the lamp entry below is valid apart from its rotation
    s.tiles[idx(1, 0)] = T.GROUND;
    s.amount[idx(1, 0)] = 0;
    const data = JSON.parse(serialize(s));
    data.buildings.find((b: Building) => b.id === dock.id).modules = ['dockStorage', 'dockStorage', 'smelterFilter', 'warpDrive'];
    data.buildings.find((b: Building) => b.id === hq.id).modules = ['dockStorage'];
    data.floors = [idx(hq.x, hq.y), -1, 1e9, 'x', 3.5];
    // (code 250 is no piece: 4-9 are increment 2's decorations, 10-14 are taken for its constructions)
    data.solids = [[idx(hq.x, hq.y), 1, 0], [idx(0, 0), 250, 0], [idx(1, 0), 3, 6], 'junk', [-5, 1, 0]];
    const back = deserialize(JSON.stringify(data));
    expect(back.buildings.find((b) => b.id === dock.id)!.modules).toEqual(['dockStorage']);
    expect(back.buildings.find((b) => b.id === hq.id)!.modules).toBeUndefined();
    expect(back.floor[idx(hq.x, hq.y)]).toBe(1); // a floor under a building is fine
    expect(back.solid[idx(hq.x, hq.y)]).toBe(0);
    expect(back.solid[idx(0, 0)]).toBe(0);
    expect(pieceAt(back, 1, 0)).toEqual({ kind: 'lamp', rot: 2 });
    expect(back.floor.reduce((n, v) => n + v, 0)).toBe(1);
    expect(back.solid.reduce((n, v) => n + (v ? 1 : 0), 0)).toBe(1);
  });

  it('a damaged save cannot put a solid piece on junk, sludge or rubble (a floor under junk is fine)', () => {
    const s = city();
    const first = (kind: number) => s.tiles.findIndex((v, i) => v === kind && s.occ[i] === -1);
    const [junk, sludge, rubble] = [first(T.JUNK), first(T.SLUDGE), first(T.RUBBLE)];
    expect(Math.min(junk, sludge, rubble)).toBeGreaterThanOrEqual(0);
    const data = JSON.parse(serialize(s));
    data.solids = [[junk, 1, 0], [sludge, 2, 0], [rubble, 3, 0]];
    data.floors = [junk];
    const back = deserialize(JSON.stringify(data));
    expect([junk, sludge, rubble].map((i) => back.solid[i])).toEqual([0, 0, 0]);
    expect(back.floor[junk]).toBe(1);
  });
});
