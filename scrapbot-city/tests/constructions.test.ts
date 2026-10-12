// Increment 2, G3 (docs/MODULAR-INC2.md §3b, §3c): the three constructions (concrete base, low wall, corner pillar)
// and the three decorations (tree, fountain, statue of USA-9) at the agreed prices and refunds; the placement rules
// (the base a surface like the floor, the others solid pieces like the G2 decorations); the joins of fences, walls and
// pillars with aligned gates (every mask); refunds shown == paid, the wall's scrap capped by the room in storage; saves
// (codes 10-14, the optional surfaces and varieties fields, old saves); moving a decoration (free, atomic, nothing
// counted, its turn and look kept); no effect on any number of the game; a random run that never creates a resource.
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addWaste, demolish, placeBuilding, placeCheck, placeFreeGarden, spawnJunk, spawnSludge } from '../src/game/actions';
import { MAP_H, MAP_W, SIM_STEP, T } from '../src/game/defs';
import type { BuildingType, Cost, Resource } from '../src/game/defs';
import {
  CATALOG_ORDER,
  PIECES,
  fenceMask,
  gateJoins,
  installModule,
  isMovable,
  isSolidAt,
  moveCheck,
  movePiece,
  pieceAt,
  pieceCheck,
  pieceRefund,
  pieceRefundAt,
  pieceVariety,
  pieceVarietyAt,
  placePiece,
  removeModule,
  removePieceAt,
  rotatePieceAt,
  rowCarriesOver,
  solidCode,
  solidKind,
  surfaceAt,
  surfaceCode,
  surfaceKind,
  turnsAt,
} from '../src/game/pieces';
import type { PieceKind, SolidKind } from '../src/game/pieces';
import { computeDerived, step } from '../src/game/sim';
import { idx, serialize } from '../src/game/state';
// cities where every project is discovered: these tests are about the items' own rules
import { createGame, deserialize } from './all-projects';
import type { Building, GameState } from '../src/game/state';
import { mulberry32 } from '../src/game/world';
import { t } from '../src/i18n';
import { frame } from '../src/render/iso/atlas';
import { Walkers } from '../src/render/iso/life';
import { pieceFrameOf } from '../src/render/renderer';
import { CONSTRUCTION, DECORATIONS, dozeLabel, isRowKind, pieceInfo } from '../src/ui/catalog';
import { answerEvent, think } from '../scripts/autopilot';
import type { Plan } from '../scripts/autopilot';

afterEach(() => vi.restoreAllMocks());

const FIXTURE_06 = readFileSync(new URL('./fixtures/save-0.6.json', import.meta.url), 'utf8');
const FIXTURE_07A1 = readFileSync(new URL('./fixtures/save-0.7a1.json', import.meta.url), 'utf8');

const G3 = ['base', 'wall', 'pillar', 'tree', 'fountain', 'statue'] as const;
type G3Kind = (typeof G3)[number];
const G3_SOLIDS = ['wall', 'pillar', 'tree', 'fountain', 'statue'] as const;
// every catalog piece (24 items less the 8 modules)
const ALL: PieceKind[] = ['floor', 'fence', 'gate', 'lamp', 'bench', 'planter', 'sign', 'pergola', 'cathouse', 'sculpture', ...G3];
const SOLIDS = ALL.filter((k): k is SolidKind => PIECES[k].layer === 'solid');
const MOVABLE: SolidKind[] = ['lamp', 'bench', 'planter', 'sign', 'pergola', 'cathouse', 'sculpture', 'tree', 'fountain', 'statue'];
const RES: Resource[] = ['credits', 'parts', 'scrap'];
const N = 1;
const E = 2;
const S = 4;
const W = 8;

function city(seed = 71): GameState {
  const s = createGame({ seed, cityName: 'Constructions' });
  s.res.credits = 5000;
  s.res.parts = 1000;
  s.res.scrap = 100;
  computeDerived(s);
  return s;
}

const hqOf = (s: GameState) => s.buildings.find((b) => b.type === 'hq')!;

// Free ground or grass tiles near the HQ (no building, piece, surface, junk, sludge or rubble), nearest first.
function freeTiles(s: GameState, n: number): { x: number; y: number }[] {
  const hq = hqOf(s);
  const out: { x: number; y: number }[] = [];
  for (let r = 0; r < 40 && out.length < n; r++)
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

// A free w x h area of plain ground near the HQ, cleared by hand (tests only).
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
      s.solid[i] = 0;
      s.rot[i] = 0;
      s.floor[i] = 0;
    }
  return { x, y };
}

function build(s: GameState, type: BuildingType): Building {
  for (const p of freeTiles(s, 600)) {
    if (!placeCheck(s, type, p.x, p.y).ok) continue;
    const b = placeBuilding(s, type, p.x, p.y)!;
    b.built = 1;
    b.status = 'ok';
    computeDerived(s);
    return b;
  }
  throw new Error(`no room for ${type}`);
}

const resOf = (s: GameState) => ({ ...s.res });
const delta = (a: Record<Resource, number>, b: Record<Resource, number>) => Object.fromEntries(RES.map((r) => [r, b[r] - a[r] || 0]));
const asDelta = (c: Cost, sign: 1 | -1) => Object.fromEntries(RES.map((r) => [r, sign * (c[r] ?? 0) || 0]));
const statsOf = (s: GameState) => JSON.stringify(s.stats);

describe('the three constructions and three decorations of G3 (owner-approved table, §3b)', () => {
  it('prices, refunds, layers, rotations and varieties as agreed; the base and wall rows, the pillar alone', () => {
    const table: Record<G3Kind, { layer: 'surface' | 'solid'; cost: Cost; refund: Cost; rotations: number; joins: boolean; decoration: boolean; varieties?: number }> = {
      base: { layer: 'surface', cost: { credits: 4 }, refund: { credits: 2 }, rotations: 1, joins: false, decoration: false },
      wall: { layer: 'solid', cost: { credits: 2, scrap: 4 }, refund: { credits: 1, scrap: 2 }, rotations: 2, joins: true, decoration: false },
      pillar: { layer: 'solid', cost: { credits: 6 }, refund: { credits: 3 }, rotations: 1, joins: true, decoration: false },
      tree: { layer: 'solid', cost: { credits: 8 }, refund: { credits: 4 }, rotations: 1, joins: false, decoration: true, varieties: 3 },
      fountain: { layer: 'solid', cost: { credits: 25, parts: 5 }, refund: { credits: 12, parts: 2 }, rotations: 1, joins: false, decoration: true },
      statue: { layer: 'solid', cost: { credits: 20, parts: 10 }, refund: { credits: 10, parts: 5 }, rotations: 4, joins: false, decoration: true },
    };
    for (const k of G3) {
      const want = table[k];
      expect(PIECES[k], k).toMatchObject({ kind: k, layer: want.layer, cost: want.cost, rotations: want.rotations, joins: want.joins });
      expect(!!PIECES[k].decoration, k).toBe(want.decoration);
      expect(PIECES[k].varieties ?? 1, k).toBe(want.varieties ?? 1);
      expect(pieceRefund(k), k).toEqual(want.refund);
    }
    // the catalog: base, wall and pillar in Construction, tree, fountain and statue in Decorations, all 16 pieces in it
    expect(CONSTRUCTION).toEqual(['floor', 'fence', 'gate', 'base', 'wall', 'pillar']);
    expect(DECORATIONS).toEqual(['lamp', 'bench', 'planter', 'sign', 'pergola', 'cathouse', 'sculpture', 'tree', 'fountain', 'statue']);
    expect(CATALOG_ORDER.filter((k) => ALL.includes(k as PieceKind))).toEqual(ALL);
    expect(CATALOG_ORDER).toHaveLength(24);
    // rows by dragging: floor, base, fence, wall
    expect(ALL.filter(isRowKind)).toEqual(['floor', 'fence', 'base', 'wall']);
    // only the decorations move
    expect(ALL.filter(isMovable)).toEqual(MOVABLE);
    // nobody's numbers in the earlier tables changed
    expect(PIECES.floor).toMatchObject({ layer: 'surface', cost: { credits: 3 } });
    expect(PIECES.fence).toMatchObject({ cost: { credits: 4 }, rotations: 2, joins: true });
    expect(PIECES.gate).toMatchObject({ cost: { credits: 12 }, rotations: 2, joins: true });
    expect(PIECES.sculpture).toMatchObject({ cost: { credits: 10, scrap: 20 }, rotations: 4 });
  });

  it('save codes appended: solids 10 wall, 11 pillar, 12 tree, 13 fountain, 14 statue; surfaces 1 floor, 2 base', () => {
    expect(G3_SOLIDS.map(solidCode)).toEqual([10, 11, 12, 13, 14]);
    expect(SOLIDS.map(solidCode)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect([0, 15, 255].map(solidKind)).toEqual([null, null, null]);
    expect([0, 1, 2, 3].map(surfaceKind)).toEqual([null, 'floor', 'base', null]);
    expect([surfaceCode('floor'), surfaceCode('base')]).toEqual([1, 2]);
  });
});

describe('placing the G3 pieces', () => {
  it('wall, pillar, tree, fountain and statue: like the decorations; one per tile, with what is in the way in words', () => {
    const s = city();
    const hq = hqOf(s);
    const [a, b, c] = freeTiles(s, 3);
    s.tiles[idx(b.x, b.y)] = T.GRASS;
    const first = (kind: number) => s.tiles.findIndex((v, i) => v === kind && s.occ[i] === -1);
    const at = (i: number) => ({ x: i % MAP_W, y: Math.floor(i / MAP_W) });
    const [junk, sludge, rubble] = [first(T.JUNK), first(T.SLUDGE), first(T.RUBBLE)];
    for (const k of G3_SOLIDS) {
      expect(pieceCheck(s, k, a.x, a.y).ok, k).toBe(true);
      expect(pieceCheck(s, k, b.x, b.y).ok, `${k} on grass`).toBe(true);
      expect(pieceCheck(s, k, hq.x, hq.y), k).toEqual({ ok: false, reason: t('place.occupied') });
      expect(pieceCheck(s, k, -1, 0), k).toEqual({ ok: false, reason: t('place.outside') });
      expect(pieceCheck(s, k, at(junk).x, at(junk).y).ok, k).toBe(false);
      expect(pieceCheck(s, k, at(sludge).x, at(sludge).y), k).toEqual({ ok: false, reason: t('place.sludge') });
      expect(pieceCheck(s, k, at(rubble).x, at(rubble).y), k).toEqual({ ok: false, reason: t('place.rubble') });
    }
    const names: Record<(typeof G3_SOLIDS)[number], string> = { wall: 'A low wall', pillar: 'A pillar', tree: 'A tree', fountain: 'A fountain', statue: 'A statue' };
    for (const there of G3_SOLIDS) {
      expect(placePiece(s, there, c.x, c.y, 1)).toBe(true);
      const reason = `${names[there]} is in the way: remove it first`;
      for (const k of SOLIDS) expect(pieceCheck(s, k, c.x, c.y), `${k} on ${there}`).toEqual({ ok: false, reason });
      expect(placeCheck(s, 'dock', c.x, c.y)).toEqual({ ok: false, reason });
      // a floor or a base can still go under it
      expect(pieceCheck(s, 'floor', c.x, c.y).ok).toBe(true);
      expect(pieceCheck(s, 'base', c.x, c.y).ok).toBe(true);
      expect(s.occ[idx(c.x, c.y)]).toBe(-1); // never in the buildings' occupancy
      expect(removePieceAt(s, c.x, c.y)).not.toBeNull();
    }
    // on a floor or a base is fine, and the surface stays under it
    placePiece(s, 'base', c.x, c.y);
    expect(placePiece(s, 'statue', c.x, c.y, 2)).toBe(true);
    expect(s.floor[idx(c.x, c.y)]).toBe(2);
    expect(surfaceAt(s, c.x, c.y)).toBe('base');
  });

  it('the base: a surface like the floor, one per tile, buildings go on it and it comes back after them', () => {
    const s = city();
    const hq = hqOf(s);
    const first = (kind: number) => s.tiles.findIndex((v, i) => v === kind && s.occ[i] === -1);
    const at = (i: number) => ({ x: i % MAP_W, y: Math.floor(i / MAP_W) });
    expect(pieceCheck(s, 'base', hq.x, hq.y)).toEqual({ ok: false, reason: t('place.occupied') });
    expect(pieceCheck(s, 'base', at(first(T.JUNK)).x, at(first(T.JUNK)).y).ok).toBe(false);
    expect(pieceCheck(s, 'base', at(first(T.SLUDGE)).x, at(first(T.SLUDGE)).y)).toEqual({ ok: false, reason: t('place.sludge') });
    expect(pieceCheck(s, 'base', at(first(T.RUBBLE)).x, at(first(T.RUBBLE)).y)).toEqual({ ok: false, reason: t('place.rubble') });
    const { x, y } = clearArea(s, 4, 3);
    // a solid piece on the tile does not stop a base going under it
    placePiece(s, 'lamp', x, y, 0);
    const credits = s.res.credits;
    s.dirtyTiles.length = 0;
    expect(placePiece(s, 'base', x, y)).toBe(true);
    expect(s.res.credits).toBe(credits - 4);
    expect(s.floor[idx(x, y)]).toBe(surfaceCode('base'));
    expect(s.dirtyTiles).toContain(idx(x, y));
    // one surface per tile, each says which one is there
    expect(pieceCheck(s, 'base', x, y)).toEqual({ ok: false, reason: 'This tile already has a concrete base' });
    expect(pieceCheck(s, 'floor', x, y)).toEqual({ ok: false, reason: 'This tile already has a concrete base' });
    placePiece(s, 'floor', x + 1, y);
    expect(pieceCheck(s, 'base', x + 1, y)).toEqual({ ok: false, reason: t('place.paved') });
    // the bulldozer takes the solid first, then the base (half its price)
    expect(removePieceAt(s, x, y)).toEqual({ credits: 5, parts: 1 });
    expect(removePieceAt(s, x, y)).toEqual({ credits: 2 });
    expect(removePieceAt(s, x, y)).toBeNull();
    // a building goes up on a base; the base stays under it and shows again when it is demolished
    for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) placePiece(s, 'base', x + 2 + dx, y + dy);
    expect(placeCheck(s, 'dock', x + 2, y).ok).toBe(true);
    s.dirtyTiles.length = 0;
    const dock = placeBuilding(s, 'dock', x + 2, y)!;
    expect(s.dirtyTiles).toContain(idx(x + 2, y));
    expect(s.floor[idx(x + 2, y)]).toBe(2);
    // under a building it is not removable (and the panel says so)
    expect(removePieceAt(s, x + 2, y)).toBeNull();
    expect(pieceInfo(s, idx(x + 2, y))).toMatchObject({ kind: 'base', removable: false, movable: false });
    s.dirtyTiles.length = 0;
    demolish(s, dock);
    expect(s.dirtyTiles).toContain(idx(x + 3, y + 1));
    expect([0, 1].flatMap((dx) => [0, 1].map((dy) => s.floor[idx(x + 2 + dx, y + dy)]))).toEqual([2, 2, 2, 2]);
    expect(pieceInfo(s, idx(x + 2, y))).toMatchObject({ kind: 'base', removable: true, refund: { credits: 2 } });
  });

  it('one confirmation pays once, the exact price; a refused one or a check costs nothing; the wall needs its 4 scrap', () => {
    const s = city();
    const tiles = freeTiles(s, G3.length + 1);
    G3.forEach((k, n) => {
      const before = resOf(s);
      const placed = s.stats.piecesPlaced;
      for (let c = 0; c < 3; c++) pieceCheck(s, k, tiles[n].x, tiles[n].y, c);
      expect(resOf(s)).toEqual(before);
      expect(placePiece(s, k, tiles[n].x, tiles[n].y, 1)).toBe(true);
      expect(delta(before, resOf(s)), k).toEqual(asDelta(PIECES[k].cost, -1));
      expect(s.stats.piecesPlaced).toBe(placed + 1);
      // the same tile again: refused, free
      const again = resOf(s);
      expect(placePiece(s, k, tiles[n].x, tiles[n].y, 1)).toBe(false);
      expect(resOf(s)).toEqual(again);
      expect(s.stats.piecesPlaced).toBe(placed + 1);
    });
    // 3 scrap: the wall is refused for its price (costOnly), nothing taken
    s.res.scrap = 3;
    const p = tiles[G3.length];
    expect(pieceCheck(s, 'wall', p.x, p.y)).toEqual({ ok: false, reason: t('place.costs', { cost: '2 credits + 4 scrap' }), costOnly: true });
    expect(placePiece(s, 'wall', p.x, p.y)).toBe(false);
    expect(s.res.scrap).toBe(3);
  });

  it('a dragged row carries on over its own pieces (and a wall or fence row over the gates and pillars in its line)', () => {
    const s = city();
    const { x, y } = clearArea(s, 8, 2);
    placePiece(s, 'wall', x, y, 0);
    placePiece(s, 'gate', x + 1, y, 0);
    placePiece(s, 'pillar', x + 2, y, 0);
    placePiece(s, 'fence', x + 3, y, 0);
    placePiece(s, 'lamp', x + 4, y, 0);
    placePiece(s, 'base', x, y + 1);
    placePiece(s, 'floor', x + 1, y + 1);
    expect([0, 1, 2, 3, 4, 5].map((dx) => rowCarriesOver(s, 'wall', x + dx, y))).toEqual([true, true, true, false, false, false]);
    expect([0, 1, 2, 3, 4, 5].map((dx) => rowCarriesOver(s, 'fence', x + dx, y))).toEqual([false, true, true, true, false, false]);
    expect([0, 1, 2].map((dx) => rowCarriesOver(s, 'base', x + dx, y + 1))).toEqual([true, false, false]);
    expect([0, 1, 2].map((dx) => rowCarriesOver(s, 'floor', x + dx, y + 1))).toEqual([false, true, false]);
    // a wall row across it: each tile it lays is paid once, the fence and the lamp are skipped for free
    const before = resOf(s);
    let laid = 0;
    for (let dx = 0; dx < 8; dx++) if (!rowCarriesOver(s, 'wall', x + dx, y)) laid += +placePiece(s, 'wall', x + dx, y, 0);
    expect(laid).toBe(3);
    expect(delta(before, resOf(s))).toEqual({ credits: -6, parts: 0, scrap: -12 });
  });
});

describe('joins: fences and walls with fences, walls, pillars and aligned gates (mask N1 E2 S4 W8)', () => {
  const SIDES = [
    { bit: N, dx: 0, dy: -1, gateRot: 1 },
    { bit: E, dx: 1, dy: 0, gateRot: 0 },
    { bit: S, dx: 0, dy: 1, gateRot: 1 },
    { bit: W, dx: -1, dy: 0, gateRot: 0 },
  ];

  it('every mask 0..15 for a fence, a wall and a pillar, with each line piece as the neighbours; every frame drawn exists', () => {
    const s = city();
    const { x, y } = clearArea(s, 3, 3);
    const cx = x + 1;
    const cy = y + 1;
    let checked = 0;
    for (const centre of ['fence', 'wall', 'pillar'] as const)
      for (const nb of ['fence', 'wall', 'pillar', 'gate'] as const)
        for (let mask = 0; mask < 16; mask++) {
          clearArea(s, 3, 3);
          s.res.credits = 1000;
          s.res.scrap = 100;
          expect(placePiece(s, centre, cx, cy, 0)).toBe(true);
          for (const side of SIDES) if (mask & side.bit) expect(placePiece(s, nb, cx + side.dx, cy + side.dy, side.gateRot)).toBe(true);
          expect(fenceMask(s, cx, cy), `${centre} with ${nb} on ${mask}`).toBe(mask);
          // the neighbours that join see the centre too
          for (const side of SIDES) if (mask & side.bit && nb !== 'gate') expect(fenceMask(s, cx + side.dx, cy + side.dy) & (side.bit <= 2 ? side.bit << 2 : side.bit >> 2)).not.toBe(0);
          const name = pieceFrameOf(centre, 0, mask);
          expect(frame(name), name).toBeDefined();
          expect(frame(`${name}/shadow`), `${name}/shadow`).toBeDefined();
          if (centre === 'pillar') expect(frame(`${name}/g`), `${name}/g`).toBeDefined();
          checked++;
        }
    expect(checked).toBe(3 * 4 * 16);
    // alone, a fence or wall lies along its rotation (0 along x, 1 along y); a lone pillar stands bare
    expect(pieceFrameOf('wall', 0, 0)).toBe('pc/wall/x');
    expect(pieceFrameOf('wall', 1, 0)).toBe('pc/wall/y');
    expect(pieceFrameOf('fence', 1, 0)).toBe('pc/fence/y');
    expect(pieceFrameOf('pillar', 1, 0)).toBe('pc/pillar/0');
    for (const n of ['pc/wall/x', 'pc/wall/y', 'pc/wall/x/shadow', 'pc/wall/y/shadow']) expect(frame(n), n).toBeDefined();
  });

  it('a gate joins only along its axis: a fence or wall against its flank stands alone (increment 1\'s limit, fixed)', () => {
    expect([N, E, S, W].map((side) => gateJoins(0, side))).toEqual([false, true, false, true]);
    expect([N, E, S, W].map((side) => gateJoins(1, side))).toEqual([true, false, true, false]);
    const s = city();
    const { x, y } = clearArea(s, 3, 3);
    for (const k of ['fence', 'wall', 'pillar'] as const)
      for (const side of SIDES) {
        for (const aligned of [true, false]) {
          clearArea(s, 3, 3);
          placePiece(s, k, x + 1, y + 1, 1);
          placePiece(s, 'gate', x + 1 + side.dx, y + 1 + side.dy, aligned ? side.gateRot : 1 - side.gateRot);
          expect(fenceMask(s, x + 1, y + 1), `${k}, gate on ${side.bit} ${aligned ? '' : 'not '}aligned`).toBe(aligned ? side.bit : 0);
        }
      }
    // the case increment 1 got wrong: a fence just south of a gate along x is a lone fence along its rotation
    clearArea(s, 3, 3);
    placePiece(s, 'fence', x, y, 0);
    placePiece(s, 'gate', x + 1, y, 0);
    placePiece(s, 'fence', x + 2, y, 0);
    placePiece(s, 'fence', x + 1, y + 1, 1);
    expect(fenceMask(s, x, y)).toBe(E);
    expect(fenceMask(s, x + 2, y)).toBe(W);
    expect(fenceMask(s, x + 1, y + 1)).toBe(0);
    expect(pieceFrameOf('fence', 1, fenceMask(s, x + 1, y + 1))).toBe('pc/fence/y');
  });

  it('a mixed line joins through: wall, pillar, gate, fence; lamps and decorations never join', () => {
    const s = city();
    const { x, y } = clearArea(s, 9, 2);
    const line: SolidKind[] = ['wall', 'pillar', 'gate', 'fence', 'wall', 'lamp', 'tree', 'statue', 'wall'];
    line.forEach((k, dx) => expect(placePiece(s, k, x + dx, y, 0)).toBe(true));
    // (fenceMask answers for any tile, as for a ghost: the lamp's tile has the wall to its west, the statue's the wall to
    // its east; neither draws by it)
    expect(line.map((_, dx) => fenceMask(s, x + dx, y))).toEqual([E, E | W, E | W, E | W, W, W, 0, E, 0]);
    // a fountain beside a wall: the wall stays alone
    placePiece(s, 'fountain', x + 8, y + 1);
    expect(fenceMask(s, x + 8, y)).toBe(0);
  });

  it('a lone fence or wall turns; joined it follows its neighbours; the pillar, tree and fountain never turn, the statue 4 ways', () => {
    const s = city();
    const { x, y } = clearArea(s, 6, 2);
    placePiece(s, 'wall', x, y, 0);
    expect(turnsAt(s, x, y)).toBe(true);
    expect(rotatePieceAt(s, x, y)).toBe(true);
    expect(pieceAt(s, x, y)).toEqual({ kind: 'wall', rot: 1 });
    expect(pieceInfo(s, idx(x, y))?.rotatable).toBe(true);
    placePiece(s, 'pillar', x + 1, y);
    expect(turnsAt(s, x, y)).toBe(false);
    expect(rotatePieceAt(s, x, y)).toBe(false);
    expect(pieceInfo(s, idx(x, y))?.rotatable).toBe(false);
    for (const k of ['pillar', 'tree', 'fountain'] as const) {
      const p = { x: x + 2 + ['pillar', 'tree', 'fountain'].indexOf(k), y: y + 1 };
      placePiece(s, k, p.x, p.y, 3);
      expect(pieceAt(s, p.x, p.y)?.rot, k).toBe(0);
      expect(rotatePieceAt(s, p.x, p.y), k).toBe(false);
    }
    placePiece(s, 'statue', x + 5, y, 0);
    const dirs = [0, 1, 2, 3].map(() => {
      rotatePieceAt(s, x + 5, y);
      return pieceAt(s, x + 5, y)!.rot;
    });
    expect(dirs).toEqual([1, 2, 3, 0]);
    rotatePieceAt(s, x + 5, y, -1);
    expect(pieceAt(s, x + 5, y)!.rot).toBe(3);
  });

  it('every look of the tree, fountain and statue, and the base, is in the atlas; the statue\'s eyes glow when they face the camera', () => {
    for (const v of [0, 1, 2]) expect(frame(pieceFrameOf('tree', 0, 0, v)), `tree ${v}`).toBeDefined();
    expect([0, 1, 2].map((v) => pieceFrameOf('tree', 0, 0, v))).toEqual(['pc/tree/0', 'pc/tree/1', 'pc/tree/2']);
    for (const f of [0, 1, 2, 3]) {
      expect(pieceFrameOf('fountain', 0, 0, 0, f)).toBe(`pc/fountain/${f}`);
      expect(frame(`pc/fountain/${f}`)).toBeDefined();
      expect(frame(`pc/fountain/${f}/shadow`)).toBeDefined();
    }
    for (const d of [0, 1, 2, 3]) {
      expect(pieceFrameOf('statue', d, 0)).toBe(`pc/statue/${d}`);
      expect(frame(`pc/statue/${d}/shadow`)).toBeDefined();
    }
    expect([0, 1, 2, 3].map((d) => !!frame(`pc/statue/${d}/g`))).toEqual([true, true, false, false]);
    for (const k of [0, 1, 2, 3]) expect(frame(`t/base/${k}`), `t/base/${k}`).toBeDefined();
    for (const k of G3) expect(frame(`pc/${k}/icon`), `pc/${k}/icon`).toBeDefined();
    // the tree's look comes from the tile: fixed, in range, all three seen on a map
    const seen = new Set<number>();
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++) {
        const v = pieceVariety('tree', x, y);
        expect(v).toBe(pieceVariety('tree', x, y));
        seen.add(v);
      }
    expect([...seen].sort()).toEqual([0, 1, 2]);
  });
});

describe('refunds: shown == paid; the wall\'s scrap no more than the room in storage', () => {
  it('base 2, pillar 3, tree 4, fountain 12 + 2 parts, statue 10 + 5 parts; the wall 1 + up to 2 scrap', () => {
    const s = city();
    const tiles = freeTiles(s, 12);
    G3.forEach((k, n) => {
      const p = tiles[n];
      placePiece(s, k, p.x, p.y, 0);
      const info = pieceInfo(s, idx(p.x, p.y))!;
      expect(info.kind).toBe(k);
      expect(info.refund).toEqual(pieceRefundAt(s, k));
      expect(dozeLabel(s, { kind: 'piece', i: idx(p.x, p.y) })).toBe(t('insp.remove', { refund: k === 'wall' ? '1 credit + 2 scrap' : { base: '2 credits', pillar: '3 credits', tree: '4 credits', fountain: '12 credits + 2 parts', statue: '10 credits + 5 parts' }[k]! }));
      const before = resOf(s);
      const paid = removePieceAt(s, p.x, p.y);
      expect(paid).toEqual(info.refund);
      expect(delta(before, resOf(s))).toEqual(asDelta(paid!, 1));
    });
    // the wall at every fill level: what pieceRefundAt, the panel and the bulldozer's label say is what is paid
    const p = tiles[8];
    for (const room of [5, 2, 1, 0]) {
      s.res.scrap = 20;
      expect(placePiece(s, 'wall', p.x, p.y, 0)).toBe(true);
      s.res.scrap = s.derived.storage - room;
      const want = { credits: 1, ...(Math.min(2, room) > 0 ? { scrap: Math.min(2, room) } : { scrap: 0 }) };
      expect(pieceRefundAt(s, 'wall')).toEqual(want);
      const info = pieceInfo(s, idx(p.x, p.y))!;
      expect(info.refund).toEqual(want);
      expect(info.scrapShort).toBe(2 - Math.min(2, room));
      const label = dozeLabel(s, { kind: 'piece', i: idx(p.x, p.y) });
      const before = resOf(s);
      const paid = removePieceAt(s, p.x, p.y)!;
      expect(paid).toEqual(want);
      expect(label).toBe(t('insp.remove', { refund: room >= 2 ? '1 credit + 2 scrap' : room === 1 ? '1 credit + 1 scrap' : '1 credit' }));
      expect(delta(before, resOf(s))).toEqual(asDelta(paid, 1));
      expect(s.res.scrap).toBeLessThanOrEqual(s.derived.storage);
    }
  });
});

describe('saves', () => {
  it('every G3 kind, rotation and look round-trips; bases in `surfaces`, floors stay in `floors`', () => {
    const s = city();
    const tiles = freeTiles(s, 40);
    let n = 0;
    const next = () => tiles[n++];
    const bases = [next(), next(), next()];
    const floors = [next(), next()];
    for (const p of bases) expect(placePiece(s, 'base', p.x, p.y)).toBe(true);
    for (const p of floors) expect(placePiece(s, 'floor', p.x, p.y)).toBe(true);
    // a solid on a base too
    expect(placePiece(s, 'statue', bases[0].x, bases[0].y, 3)).toBe(true);
    for (const k of G3_SOLIDS)
      for (let r = 0; r < Math.max(2, PIECES[k].rotations); r++) {
        const p = next();
        expect(placePiece(s, k, p.x, p.y, r)).toBe(true);
      }
    s.res.scrap = 100;
    const json = serialize(s);
    const data = JSON.parse(json);
    expect(data.floors).toEqual(floors.map((p) => idx(p.x, p.y)).sort((a, b) => a - b));
    expect(data.surfaces).toEqual(bases.map((p) => [idx(p.x, p.y), 2]).sort((a, b) => a[0] - b[0]));
    expect(data.varieties).toBeUndefined(); // nothing was moved
    for (const e of data.solids) {
      expect(e).toHaveLength(3);
      expect(solidKind(e[1])).not.toBeNull();
    }
    const back = deserialize(json);
    for (const arr of ['floor', 'solid', 'rot', 'variety'] as const) expect(Array.from(back[arr]), arr).toEqual(Array.from(s[arr]));
    for (let i = 0; i < s.solid.length; i++) if (s.solid[i]) expect(pieceVarietyAt(back, i)).toBe(pieceVarietyAt(s, i));
    expect(serialize(back)).toBe(json);
    expect(Object.keys(back)).not.toContain('surfaces');
    expect(Object.keys(back)).not.toContain('varieties');
  });

  it('a city without bases or moved decorations saves as before: no `surfaces`, no `varieties`', () => {
    const s = city();
    const tiles = freeTiles(s, 12);
    ['floor', 'fence', 'gate', 'lamp', 'bench', 'planter', 'sign', 'pergola', 'cathouse', 'sculpture', 'wall', 'tree'].forEach((k, n) => placePiece(s, k as PieceKind, tiles[n].x, tiles[n].y, 1));
    const data = JSON.parse(serialize(s));
    expect('surfaces' in data).toBe(false);
    expect('varieties' in data).toBe(false);
    expect(Object.keys(data).slice(-2)).toEqual(['floors', 'solids']);
    // the same for a city with nothing at all
    const plain = JSON.parse(serialize(city()));
    expect(['floors', 'solids', 'surfaces', 'varieties'].map((k) => k in plain)).toEqual([true, true, false, false]);
  });

  it('old saves load: 0.6 and 0.7.0-alpha.1 (their floors stay floors, no bases, no kept looks)', () => {
    const old = deserialize(FIXTURE_06);
    expect(old.floor.every((v) => v === 0) && old.solid.every((v) => v === 0) && old.variety.every((v) => v === 0)).toBe(true);
    const raw = JSON.parse(FIXTURE_07A1);
    const a1 = deserialize(FIXTURE_07A1);
    for (const i of raw.floors) expect(a1.floor[i]).toBe(1);
    expect(a1.floor.reduce((n, v) => n + (v ? 1 : 0), 0)).toBe(raw.floors.length);
    expect(a1.variety.every((v) => v === 0)).toBe(true);
    for (const [i, code, r] of raw.solids) {
      expect(a1.solid[i]).toBe(code);
      expect(a1.rot[i]).toBe(r);
    }
    // saved again: the same pieces, still with no new fields
    const again = JSON.parse(serialize(a1));
    expect(again.floors).toEqual(raw.floors);
    expect(again.solids).toEqual(raw.solids);
    expect('surfaces' in again || 'varieties' in again).toBe(false);
  });

  it('a damaged `surfaces` or `varieties` field is read entry by entry: bad entries are left out', () => {
    const s = city();
    const { x, y } = clearArea(s, 6, 2);
    const hq = hqOf(s);
    placePiece(s, 'floor', x, y);
    placePiece(s, 'planter', x + 1, y);
    placePiece(s, 'tree', x + 2, y);
    placePiece(s, 'bench', x + 3, y);
    const data = JSON.parse(serialize(s));
    const i = (dx: number, dy = 0) => idx(x + dx, y + dy);
    data.surfaces = [[i(0), 2], [i(4), 2], [idx(hq.x, hq.y), 2], [i(5), 9], [i(1, 1), 'base'], 'junk', [-1, 2], [1e9, 2], [i(2, 1), 1]];
    const planterOther = 1 - pieceVariety('planter', x + 1, y);
    const treeOwn = pieceVariety('tree', x + 2, y);
    const treeOther = (treeOwn + 1) % 3;
    data.varieties = [[i(1), solidCode('planter'), planterOther], [i(2), solidCode('tree'), treeOwn], [i(3), solidCode('bench'), 1], [i(2), solidCode('sign'), treeOther], [i(1), solidCode('planter'), 7], [i(4), solidCode('tree'), 1], 'x', [i(2), solidCode('tree'), 1.5]];
    const back = deserialize(JSON.stringify(data));
    // the floor already there stays; a base under the HQ is fine (buildings stand on bases); a floor code in surfaces is a floor
    expect([back.floor[i(0)], back.floor[i(4)], back.floor[idx(hq.x, hq.y)], back.floor[i(5)], back.floor[i(1, 1)], back.floor[i(2, 1)]]).toEqual([1, 2, 2, 0, 0, 1]);
    expect(back.floor.reduce((n, v) => n + (v ? 1 : 0), 0)).toBe(4);
    // only the planter's look, which is not its tile's own, is kept; a look equal to the tile's is not written down
    expect(pieceVarietyAt(back, i(1))).toBe(planterOther);
    expect(back.variety[i(1)]).toBe(planterOther + 1);
    expect(back.variety[i(2)]).toBe(0);
    expect(pieceVarietyAt(back, i(2))).toBe(treeOwn);
    expect(back.variety[i(3)]).toBe(0);
    expect(back.variety.reduce((n, v) => n + (v ? 1 : 0), 0)).toBe(1);
  });
});

describe('moving decorations (§3c): free, atomic, nothing counted; turn and look kept', () => {
  it('only the decorations move; constructions, surfaces, buildings and empty tiles never do (with the reason)', () => {
    const s = city();
    const { x, y } = clearArea(s, 9, 2);
    const kinds: PieceKind[] = ['fence', 'gate', 'wall', 'pillar'];
    kinds.forEach((k, n) => placePiece(s, k, x + n, y, 0));
    placePiece(s, 'floor', x + 4, y);
    placePiece(s, 'base', x + 5, y);
    const hq = hqOf(s);
    const json = serialize(s);
    for (const [fx, fy] of [[x, y], [x + 1, y], [x + 2, y], [x + 3, y], [x + 4, y], [x + 5, y], [x + 6, y], [hq.x, hq.y], [-1, 0]]) {
      expect(moveCheck(s, fx, fy, x + 7, y + 1)).toEqual({ ok: false, reason: 'Only decorations can be moved' });
      expect(movePiece(s, fx, fy, x + 7, y + 1)).toBe(false);
    }
    expect(serialize(s)).toBe(json);
    for (const k of kinds) expect(pieceInfo(s, idx(x + kinds.indexOf(k), y))?.movable, k).toBe(false);
  });

  it('every decoration moves for free, keeps its turn, counts nothing; the surfaces under both tiles stay', () => {
    const s = city();
    const { x, y } = clearArea(s, MOVABLE.length, 3);
    placePiece(s, 'base', x, y);
    placePiece(s, 'floor', x + 1, y + 2);
    MOVABLE.forEach((k, n) => {
      const rot = PIECES[k].rotations - 1;
      expect(placePiece(s, k, x + n, y, rot)).toBe(true);
      expect(pieceInfo(s, idx(x + n, y))?.movable, k).toBe(true);
      const res = resOf(s);
      const stats = statsOf(s);
      expect(moveCheck(s, x + n, y, x + n, y + 2)).toEqual({ ok: true });
      expect(movePiece(s, x + n, y, x + n, y + 2), k).toBe(true);
      expect(resOf(s), k).toEqual(res);
      expect(statsOf(s), k).toBe(stats);
      expect(pieceAt(s, x + n, y)).toBeNull();
      expect([s.solid[idx(x + n, y)], s.rot[idx(x + n, y)], s.variety[idx(x + n, y)]]).toEqual([0, 0, 0]);
      expect(pieceAt(s, x + n, y + 2), k).toEqual({ kind: k, rot });
    });
    expect(s.floor[idx(x, y)]).toBe(2);
    expect(s.floor[idx(x + 1, y + 2)]).toBe(1);
    expect(s.stats.piecesPlaced).toBe(2 + MOVABLE.length);
  });

  it('a destination the piece could not be placed on changes nothing at all, with pieceCheck\'s reason (no price)', () => {
    const s = city();
    const { x, y } = clearArea(s, 3, 2);
    const hq = hqOf(s);
    placePiece(s, 'sculpture', x, y, 2);
    placePiece(s, 'wall', x + 1, y, 0);
    const first = (kind: number) => s.tiles.findIndex((v, i) => v === kind && s.occ[i] === -1);
    const at = (i: number) => ({ x: i % MAP_W, y: Math.floor(i / MAP_W) });
    const targets = [at(first(T.JUNK)), at(first(T.SLUDGE)), at(first(T.RUBBLE)), { x: hq.x, y: hq.y }, { x: -1, y: 3 }, { x: MAP_W, y: 0 }, { x: x + 1, y }];
    // no money at all: the price never matters for a move
    s.res = { credits: 0, parts: 0, scrap: 0 };
    const json = serialize(s);
    for (const p of targets) {
      const want = pieceCheck(s, 'sculpture', p.x, p.y);
      expect(want.ok).toBe(false);
      expect(want.costOnly).toBeUndefined();
      expect(moveCheck(s, x, y, p.x, p.y), JSON.stringify(p)).toEqual(want);
      expect(movePiece(s, x, y, p.x, p.y)).toBe(false);
      expect(serialize(s)).toBe(json);
    }
    // its own tile: nothing to move
    expect(moveCheck(s, x, y, x, y)).toEqual({ ok: false, reason: 'It is already here' });
    expect(movePiece(s, x, y, x, y)).toBe(false);
    // and a free tile works though the city could not buy a sculpture now
    expect(pieceCheck(s, 'sculpture', x + 2, y).costOnly).toBe(true);
    expect(movePiece(s, x, y, x + 2, y + 1)).toBe(true);
    expect(pieceAt(s, x + 2, y + 1)).toEqual({ kind: 'sculpture', rot: 2 });
    expect(s.res).toEqual({ credits: 0, parts: 0, scrap: 0 });
  });

  it('a planter, sign or tree keeps its look; written down only where its new tile would give another one', () => {
    const s = city();
    for (const k of ['planter', 'sign', 'tree'] as const) {
      const tiles = freeTiles(s, 400);
      // a tile and two destinations: one whose own look differs, one whose own look is the same
      const from = tiles[0];
      const v = pieceVariety(k, from.x, from.y);
      const other = tiles.find((p) => pieceVariety(k, p.x, p.y) !== v)!;
      const same = tiles.slice(1).find((p) => p !== other && pieceVariety(k, p.x, p.y) === v)!;
      expect(placePiece(s, k, from.x, from.y, 1)).toBe(true);
      const i0 = idx(from.x, from.y);
      const i1 = idx(other.x, other.y);
      const i2 = idx(same.x, same.y);
      const frameBefore = pieceFrameOf(k, s.rot[i0], 0, pieceVarietyAt(s, i0));
      expect(movePiece(s, from.x, from.y, other.x, other.y)).toBe(true);
      expect(pieceVarietyAt(s, i1), k).toBe(v);
      expect(s.variety[i1]).toBe(v + 1);
      expect(pieceFrameOf(k, s.rot[i1], 0, pieceVarietyAt(s, i1))).toBe(frameBefore);
      // saved and loaded: still the same look
      const data = JSON.parse(serialize(s));
      expect(data.varieties).toEqual([[i1, solidCode(k), v]]);
      const back = deserialize(JSON.stringify(data));
      expect(pieceVarietyAt(back, i1)).toBe(v);
      // on to a tile that gives the same look: nothing written down
      expect(movePiece(s, other.x, other.y, same.x, same.y)).toBe(true);
      expect(pieceVarietyAt(s, i2)).toBe(v);
      expect(s.variety[i1]).toBe(0);
      expect(s.variety[i2]).toBe(0);
      expect('varieties' in JSON.parse(serialize(s))).toBe(false);
      // moved away again and removed: the kept look goes with it; a new one on that tile has the tile's own
      expect(movePiece(s, same.x, same.y, other.x, other.y)).toBe(true);
      expect(s.variety[i1]).toBe(v + 1);
      expect(removePieceAt(s, other.x, other.y)).not.toBeNull();
      expect(s.variety[i1]).toBe(0);
      placePiece(s, k, other.x, other.y, 0);
      expect(pieceVarietyAt(s, i1)).toBe(pieceVariety(k, other.x, other.y));
      removePieceAt(s, other.x, other.y);
    }
    expect(s.variety.every((v) => v === 0)).toBe(true);
  });
});

describe('the G3 pieces have no effect on any number of the game', () => {
  // A seeded run of the autopilot, as npm run balance plays it, with pieces laid first (and decorations moved at
  // a few moments of the run); `touched`: the tiles the plain city uses (junk, sludge, buildings).
  function run(plan: Plan, seed: number, days: number, pieces: { i: number; k: PieceKind; rot: number }[], moves: { at: number; from: number; to: number }[], touched?: Set<number>): { json: string; log: string[] } {
    const rnd = mulberry32(seed * 31 + 7);
    vi.spyOn(Math, 'random').mockImplementation(rnd);
    const s = createGame({ seed });
    for (const d of pieces) {
      // bought, then the money and the counter put back: the two cities start with the same resources
      const res = resOf(s);
      const placed = s.stats.piecesPlaced;
      s.res.credits += 100;
      s.res.parts += 20;
      s.res.scrap = Math.min(s.derived.storage || 150, s.res.scrap + 20);
      expect(placePiece(s, d.k, d.i % MAP_W, Math.floor(d.i / MAP_W), d.rot), `${d.k} at ${d.i}`).toBe(true);
      s.res = res;
      s.stats.piecesPlaced = placed;
    }
    const start = Uint8Array.from(s.tiles);
    const log: string[] = [];
    let t = 0;
    let steps = 0;
    let moved = 0;
    while (!s.outcome && s.time < days * 60) {
      step(s, SIM_STEP);
      steps++;
      t += SIM_STEP;
      answerEvent(s, plan);
      if (t >= 1) {
        t = 0;
        think(s, plan);
      }
      for (const m of moves) {
        if (m.at !== steps) continue;
        const check = moveCheck(s, m.from % MAP_W, Math.floor(m.from / MAP_W), m.to % MAP_W, Math.floor(m.to / MAP_W));
        expect(check, `move at step ${steps} from ${m.from} to ${m.to}`).toEqual({ ok: true });
        moved += +movePiece(s, m.from % MAP_W, Math.floor(m.from / MAP_W), m.to % MAP_W, Math.floor(m.to / MAP_W));
      }
      s.fx.length = 0;
      s.messages.length = 0;
      s.dirtyTiles.length = 0;
      if (touched) for (let i = 0; i < s.tiles.length; i++) if (s.tiles[i] !== start[i] || s.occ[i] !== -1) touched.add(i);
      if (steps % 1200 === 0) {
        const d = s.derived;
        log.push(`${s.time.toFixed(2)} pop ${s.pop} smog ${s.pollution} happy ${d.happiness} align ${s.alignment} res ${JSON.stringify(s.res)} stars ${s.stars} energy ${d.energyProd}/${d.energyUse} stats ${JSON.stringify(s.stats)}`);
      }
    }
    expect(moved).toBe(moves.length);
    // the pieces themselves are the only difference allowed: take them off before comparing
    s.solid.fill(0);
    s.rot.fill(0);
    s.variety.fill(0);
    s.floor.fill(0);
    vi.restoreAllMocks();
    return { json: serialize(s), log };
  }

  for (const [plan, seed] of [
    ['green', 4321],
    ['industrial', 99],
  ] as const) {
    it(`a ${plan} city with walls, pillars, bases, trees, fountains and statues (some moved) plays byte for byte like the same city without them (seed ${seed}, 16 days)`, () => {
      const touched = new Set<number>();
      const plain = run(plan, seed, 16, [], [], touched);
      const s0 = createGame({ seed });
      const spots: number[] = [];
      for (let i = 0; i < s0.tiles.length && spots.length < 72; i += 5) {
        if (touched.has(i) || s0.occ[i] !== -1 || (s0.tiles[i] !== T.GROUND && s0.tiles[i] !== T.GRASS)) continue;
        spots.push(i);
      }
      expect(spots.length).toBeGreaterThanOrEqual(60);
      const kinds = G3_SOLIDS;
      const pieces = spots.slice(0, 50).map((i, n) => ({ i, k: kinds[n % kinds.length] as PieceKind, rot: Math.floor(n / kinds.length) % 4 }));
      // bases anywhere the plain city might build or drop junk later: a surface is never in the way
      for (let i = 3; i < s0.tiles.length; i += 13) if (s0.occ[i] === -1 && (s0.tiles[i] === T.GROUND || s0.tiles[i] === T.GRASS) && !spots.slice(0, 50).includes(i)) pieces.push({ i, k: 'base', rot: 0 });
      // decorations moved during the run, onto spots the plain city never uses
      const decos = pieces.filter((p) => isMovable(p.k));
      const moves = decos.slice(0, 8).map((p, n) => ({ at: 300 + n * 600, from: p.i, to: spots[50 + n] }));
      const decorated = run(plan, seed, 16, pieces, moves);
      expect(decorated.log.length).toBeGreaterThan(5);
      expect(decorated.log).toEqual(plain.log);
      expect(decorated.json).toBe(plain.json);
    });
  }
});

describe('junk never lands on the G3 solids; citizens walk around them; bots are not stopped', () => {
  it('storms, waste, sludge and gifted gardens skip every wall, pillar, tree, fountain and statue (a base may be covered)', () => {
    const s = city(73);
    build(s, 'pods');
    const solids: number[] = [];
    const bases: number[] = [];
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++) {
        const i = idx(x, y);
        if (s.occ[i] !== -1 || (s.tiles[i] !== T.GROUND && s.tiles[i] !== T.GRASS)) continue;
        s.res.credits = 1000;
        s.res.parts = 1000;
        s.res.scrap = 100;
        if ((x + y) % 3 === 0) {
          expect(placePiece(s, 'base', x, y)).toBe(true);
          bases.push(i);
        } else {
          expect(placePiece(s, G3_SOLIDS[(x * 7 + y * 3) % G3_SOLIDS.length], x, y, x + y)).toBe(true);
          solids.push(i);
        }
      }
    for (let k = 0; k < 40; k++) {
      spawnJunk(s, 30, 15, 35);
      spawnSludge(s, 8);
      placeFreeGarden(s);
      addWaste(s, 6);
    }
    for (const i of solids) {
      expect(s.tiles[i] === T.GROUND || s.tiles[i] === T.GRASS, `tile ${i} became ${s.tiles[i]}`).toBe(true);
      expect(s.occ[i]).toBe(-1);
      expect(isSolidAt(s, i)).toBe(true);
    }
    // the bases stay under whatever came (as the floor does)
    for (const i of bases) expect(s.floor[i]).toBe(2);
  });

  it('citizens never walk onto a wall, pillar, tree, fountain or statue laid on their street', () => {
    const s = createGame({ seed: 4243 });
    s.pop = 64;
    s.res.credits = 1e6;
    s.res.parts = 1e6;
    const walkers = new Walkers();
    let laid = 0;
    let onPiece = 0;
    const since = new Map<number, number>();
    for (let f = 0; f < 1200; f++) {
      walkers.update(s, 1 / 30, 4);
      if (f % 15 === 0) {
        const w = walkers.list[f % Math.max(1, walkers.list.length)];
        const [x, y] = w && f % 30 === 0 ? [w.nx, w.ny] : [(f * 7) % MAP_W, 4 + 11 * ((f >> 4) % 3)];
        s.res.scrap = 100;
        if (placePiece(s, G3_SOLIDS[laid % G3_SOLIDS.length], x, y, laid)) {
          since.set(idx(x, y), f);
          laid++;
        }
      }
      for (const w of walkers.list) {
        const i = idx(Math.floor(w.x / 16), Math.floor(w.y / 16));
        if (isSolidAt(s, i) && f - (since.get(i) ?? -1e9) > 37) onPiece++;
      }
    }
    expect(laid).toBeGreaterThan(30);
    expect(onPiece).toBe(0);
  });

  it('bots keep collecting over a city covered in walls and trees', () => {
    vi.spyOn(Math, 'random').mockImplementation(mulberry32(6));
    const s = city(74);
    let n = 0;
    for (const { x, y } of freeTiles(s, 200)) {
      s.res.scrap = 100;
      placePiece(s, G3_SOLIDS[n++ % G3_SOLIDS.length], x, y, n);
    }
    s.res.scrap = 0;
    const collected = s.stats.scrapCollected;
    for (let k = 0; k < 60 * 20; k++) step(s, SIM_STEP);
    expect(s.stats.scrapCollected - collected).toBeGreaterThan(20);
  });
});

describe('random place / remove / rotate / move / save-load over all 16 catalog pieces', () => {
  it('never creates a resource: placing costs its price, removing pays what was shown, moving and turning are free', () => {
    const did = { placed: 0, removed: 0, rotated: 0, moved: 0, refusedMoves: 0, saved: 0, capped: 0 };
    for (let seed = 1; seed <= 5; seed++) {
      const rng = mulberry32(seed * 7919);
      let s = city(110 + seed);
      s.res.scrap = 140;
      const tiles = freeTiles(s, 60);
      const pick = <V>(list: readonly V[]): V => list[Math.floor(rng() * list.length)];
      const start = resOf(s);
      // what the player has plus the half-price of everything on the map: buying lowers it, removing never raises it
      const worth = () => {
        const w = resOf(s);
        for (let i = 0; i < s.solid.length; i++) {
          const p = pieceAt(s, i % MAP_W, Math.floor(i / MAP_W));
          if (p) for (const r of RES) w[r] += pieceRefund(p.kind)[r] ?? 0;
          const surface = surfaceKind(s.floor[i]);
          if (surface) w.credits += pieceRefund(surface).credits ?? 0;
        }
        return w;
      };
      let dock: Building | null = null;
      let last = worth();
      for (let n = 0; n < 900; n++) {
        const op = Math.floor(rng() * 11);
        const p = pick(tiles);
        const before = resOf(s);
        const placedBefore = s.stats.piecesPlaced;
        if (op <= 2) {
          const k = pick(ALL);
          const ok = pieceCheck(s, k, p.x, p.y).ok;
          expect(placePiece(s, k, p.x, p.y, Math.floor(rng() * 4))).toBe(ok);
          expect(delta(before, resOf(s))).toEqual(ok ? asDelta(PIECES[k].cost, -1) : asDelta({}, 1));
          expect(s.stats.piecesPlaced).toBe(placedBefore + +ok);
          did.placed += +ok;
        } else if (op <= 4) {
          const info = pieceInfo(s, idx(p.x, p.y));
          const promised = info?.removable ? info.refund : null;
          if (promised) expect(promised).toEqual(pieceRefundAt(s, info!.kind));
          if (info?.kind === 'wall' && (promised!.scrap ?? 0) < 2) did.capped++;
          const paid = removePieceAt(s, p.x, p.y);
          expect(paid).toEqual(promised);
          expect(delta(before, resOf(s))).toEqual(asDelta(paid ?? {}, 1));
          did.removed += +!!paid;
        } else if (op === 5) {
          did.rotated += +rotatePieceAt(s, p.x, p.y, rng() < 0.5 ? 1 : -1);
          expect(resOf(s)).toEqual(before);
        } else if (op <= 7) {
          // a move, valid or not: free, nothing counted, all or nothing
          const q = pick(tiles);
          const from = pieceAt(s, p.x, p.y);
          const look = from ? pieceVarietyAt(s, idx(p.x, p.y)) : -1;
          const check = moveCheck(s, p.x, p.y, q.x, q.y);
          const json = serialize(s);
          const stats = statsOf(s);
          const moved = movePiece(s, p.x, p.y, q.x, q.y);
          expect(moved).toBe(check.ok);
          expect(resOf(s)).toEqual(before);
          expect(statsOf(s)).toBe(stats);
          if (moved) {
            expect(pieceAt(s, q.x, q.y)).toEqual(from);
            expect(pieceVarietyAt(s, idx(q.x, q.y))).toBe(look);
            expect(pieceAt(s, p.x, p.y)).toBeNull();
            did.moved++;
          } else {
            expect(serialize(s)).toBe(json);
            did.refusedMoves++;
          }
        } else if (op === 8) {
          const json = serialize(s);
          s = deserialize(json);
          computeDerived(s);
          dock = s.buildings.find((b) => b.type === 'dock') ?? null;
          expect(resOf(s)).toEqual(before);
          expect(serialize(s)).toBe(json);
          did.saved++;
        } else if (op === 9) {
          // the room in storage changes: a Dock with or without its storage module
          if (!dock || !s.buildings.includes(dock)) {
            dock = build(s, 'dock');
            s.res.credits = before.credits; // (the Dock is free in this test: only its storage matters)
            s.res.parts = before.parts;
            computeDerived(s);
          } else if (rng() < 0.5) {
            if (dock.modules?.length) removeModule(s, 'dockStorage', dock);
            else installModule(s, 'dockStorage', dock);
            s.res.credits = before.credits;
            s.res.parts = before.parts;
            s.res.scrap = Math.min(s.res.scrap, before.scrap);
            computeDerived(s);
          } else {
            demolish(s, dock);
            s.res.credits = before.credits;
            s.res.parts = before.parts;
            dock = null;
          }
          expect(s.res.scrap).toBeLessThanOrEqual(before.scrap);
        } else {
          // bots bring scrap back: the store fills (the only way in for scrap)
          s.res.scrap = Math.min(s.derived.storage, s.res.scrap + Math.floor(rng() * 60));
        }
        const now = worth();
        if (op !== 9 && op !== 10)
          for (const r of RES) {
            expect(now[r], `seed ${seed} step ${n} op ${op} ${r}`).toBeLessThanOrEqual(last[r] + 1e-9);
            if (r !== 'scrap') expect(s.res[r], `seed ${seed} step ${n} ${r}`).toBeLessThanOrEqual(start[r] + 1e-9);
          }
        for (const r of RES) expect(s.res[r]).toBeGreaterThanOrEqual(0);
        expect(s.res.scrap).toBeLessThanOrEqual(s.derived.storage + 1e-9);
        last = now;
        // never a solid piece on a building's tile, never a look kept for a tile without a piece with looks
        for (const b of s.buildings) expect(isSolidAt(s, idx(b.x, b.y))).toBe(false);
        for (let i = 0; i < s.variety.length; i++) if (s.variety[i]) expect(PIECES[solidKind(s.solid[i])!]?.varieties ?? 1).toBeGreaterThan(1);
      }
      if (dock && s.buildings.includes(dock)) {
        const keep = resOf(s);
        demolish(s, dock);
        s.res.credits = keep.credits;
        s.res.parts = keep.parts;
      }
      for (const q of tiles) while (removePieceAt(s, q.x, q.y));
      expect(s.res.credits).toBeLessThanOrEqual(start.credits);
      expect(s.res.parts).toBeLessThanOrEqual(start.parts);
      expect(s.solid.every((v) => v === 0) && s.floor.every((v) => v === 0) && s.variety.every((v) => v === 0)).toBe(true);
    }
    for (const [k, v] of Object.entries(did)) expect(v, k).toBeGreaterThan(5);
  });
});
