// Increment 2, G2 (docs/MODULAR-INC2.md §3): the six decorations of the owner's brief, bench, planter, neon sign,
// pergola, Miso's house and scrap sculpture. The agreed prices, refunds, rotations and varieties; the placement rules
// (solid 1x1 pieces like the lamp); save codes 4-9; the sculpture's scrap refund, no more than the room in storage,
// shown == paid; no effect on any number of the game (a city full of decorations plays byte for byte like the same
// city without them); and a random run over all ten catalog pieces that never creates a resource.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addWaste, demolish, placeBuilding, placeCheck, placeFreeGarden, spawnJunk, spawnSludge } from '../src/game/actions';
import { MAP_H, MAP_W, SIM_STEP, T } from '../src/game/defs';
import type { BuildingType, Cost, Resource } from '../src/game/defs';
import {
  CATALOG_ORDER,
  PIECES,
  installModule,
  isSolidAt,
  normRot,
  pieceAt,
  pieceCheck,
  pieceRefund,
  pieceRefundAt,
  pieceVariety,
  placePiece,
  removeModule,
  removePieceAt,
  rotatePieceAt,
  solidCode,
  solidKind,
} from '../src/game/pieces';
import type { PieceKind, SolidKind } from '../src/game/pieces';
import { computeDerived, step } from '../src/game/sim';
import { createGame, deserialize, idx, serialize } from '../src/game/state';
import type { Building, GameState } from '../src/game/state';
import { mulberry32 } from '../src/game/world';
import { t } from '../src/i18n';
import { frame } from '../src/render/iso/atlas';
import { Walkers } from '../src/render/iso/life';
import { pieceFrameOf } from '../src/render/renderer';
import { DECORATIONS, catalogState, pieceInfo } from '../src/ui/catalog';
import { answerEvent, think } from '../scripts/autopilot';
import type { Plan } from '../scripts/autopilot';

afterEach(() => vi.restoreAllMocks());

const DECOS = ['bench', 'planter', 'sign', 'pergola', 'cathouse', 'sculpture'] as const;
type Deco = (typeof DECOS)[number];
const ALL: PieceKind[] = ['floor', 'fence', 'gate', 'lamp', ...DECOS];
const SOLIDS: SolidKind[] = ['fence', 'gate', 'lamp', ...DECOS];
const RES: Resource[] = ['credits', 'parts', 'scrap'];

function city(seed = 71): GameState {
  const s = createGame({ seed, cityName: 'Decorations' });
  s.res.credits = 5000;
  s.res.parts = 1000;
  s.res.scrap = 100;
  computeDerived(s);
  return s;
}

const hqOf = (s: GameState) => s.buildings.find((b) => b.type === 'hq')!;

// Free ground or grass tiles near the HQ (no building, piece, floor, junk, sludge or rubble), nearest first.
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
const free = (s: GameState) => s.derived.storage - s.res.scrap;

describe('the six decorations (owner-approved table)', () => {
  it('prices, refunds, rotations and varieties as agreed; solid 1x1 pieces in the Decorations with the lamp', () => {
    const table: Record<Deco, { cost: Cost; refund: Cost; rotations: number; varieties?: number }> = {
      bench: { cost: { credits: 6 }, refund: { credits: 3 }, rotations: 4 },
      planter: { cost: { credits: 5 }, refund: { credits: 2 }, rotations: 1, varieties: 2 },
      sign: { cost: { credits: 15, parts: 4 }, refund: { credits: 7, parts: 2 }, rotations: 4, varieties: 3 },
      pergola: { cost: { credits: 12 }, refund: { credits: 6 }, rotations: 2 },
      cathouse: { cost: { credits: 10 }, refund: { credits: 5 }, rotations: 4 },
      sculpture: { cost: { credits: 10, scrap: 20 }, refund: { credits: 5, scrap: 10 }, rotations: 4 },
    };
    for (const k of DECOS) {
      const want = table[k];
      expect(PIECES[k], k).toMatchObject({ kind: k, layer: 'solid', cost: want.cost, rotations: want.rotations, joins: false, decoration: true });
      expect(PIECES[k].varieties ?? 1, k).toBe(want.varieties ?? 1);
      expect(pieceRefund(k), k).toEqual(want.refund);
    }
    // the lamp is a decoration too; floor, fence and gate are constructions
    expect(ALL.filter((k) => PIECES[k].decoration)).toEqual(['lamp', ...DECOS]);
    expect(DECORATIONS).toEqual(['lamp', ...DECOS]);
    expect(CATALOG_ORDER.slice(0, 10)).toEqual(ALL);
    // nobody's numbers in the increment-1 table changed
    expect(PIECES.lamp).toMatchObject({ cost: { credits: 10, parts: 2 }, rotations: 4 });
    expect(pieceRefund('lamp')).toEqual({ credits: 5, parts: 1 });
  });

  it('saves them with the codes 4 bench .. 9 sculpture, after fence 1, gate 2, lamp 3 (append-only)', () => {
    expect(SOLIDS.map(solidCode)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 255].map(solidKind)).toEqual([null, ...SOLIDS, null, null]);
  });
});

describe('placing decorations', () => {
  it('like the lamp: ground or grass inside the map, not on a building, junk, sludge, rubble or another solid piece', () => {
    const s = city();
    const hq = hqOf(s);
    const [a, b, c] = freeTiles(s, 3);
    s.tiles[idx(b.x, b.y)] = T.GRASS;
    const first = (kind: number) => s.tiles.findIndex((v, i) => v === kind && s.occ[i] === -1);
    const junk = first(T.JUNK);
    const sludge = first(T.SLUDGE);
    const rubble = first(T.RUBBLE);
    const at = (i: number) => ({ x: i % MAP_W, y: Math.floor(i / MAP_W) });
    for (const k of DECOS) {
      expect(pieceCheck(s, k, a.x, a.y).ok, k).toBe(true);
      expect(pieceCheck(s, k, b.x, b.y).ok, `${k} on grass`).toBe(true);
      expect(pieceCheck(s, k, hq.x, hq.y), k).toEqual({ ok: false, reason: t('place.occupied') });
      expect(pieceCheck(s, k, -1, 0), k).toEqual({ ok: false, reason: t('place.outside') });
      expect(pieceCheck(s, k, MAP_W, MAP_H - 1), k).toEqual({ ok: false, reason: t('place.outside') });
      expect(pieceCheck(s, k, at(junk).x, at(junk).y).ok, k).toBe(false);
      expect(pieceCheck(s, k, at(sludge).x, at(sludge).y), k).toEqual({ ok: false, reason: t('place.sludge') });
      expect(pieceCheck(s, k, at(rubble).x, at(rubble).y), k).toEqual({ ok: false, reason: t('place.rubble') });
    }
    // one per tile: anything else on it says what is in the way, in its own words
    const names: Record<SolidKind, string> = {
      fence: 'A fence',
      gate: 'A gate',
      lamp: 'A lamp post',
      bench: 'A bench',
      planter: 'A planter',
      sign: 'A neon sign',
      pergola: 'A pergola',
      cathouse: "Miso's house",
      sculpture: 'A scrap sculpture',
    };
    for (const there of SOLIDS) {
      expect(placePiece(s, there, c.x, c.y, 0)).toBe(true);
      const reason = `${names[there]} is in the way: remove it first`;
      for (const k of SOLIDS) expect(pieceCheck(s, k, c.x, c.y), `${k} on ${there}`).toEqual({ ok: false, reason });
      // a building cannot go over it either, a floor can go under it
      expect(placeCheck(s, 'dock', c.x, c.y)).toEqual({ ok: false, reason });
      expect(pieceCheck(s, 'floor', c.x, c.y).ok).toBe(true);
      expect(removePieceAt(s, c.x, c.y)).not.toBeNull();
    }
    // on a floor is fine, and the floor stays under it
    placePiece(s, 'floor', c.x, c.y, 0);
    expect(placePiece(s, 'pergola', c.x, c.y, 1)).toBe(true);
    expect(s.floor[idx(c.x, c.y)]).toBe(1);
    expect(s.occ[idx(c.x, c.y)]).toBe(-1); // never in the buildings' occupancy
  });

  it('one confirmation pays once, the exact price; a refused one or a check costs nothing; the sculpture needs its 20 scrap', () => {
    const s = city();
    const tiles = freeTiles(s, DECOS.length + 2);
    DECOS.forEach((k, n) => {
      const before = resOf(s);
      const placed = s.stats.piecesPlaced;
      for (let r = 0; r < 4; r++) pieceCheck(s, k, tiles[n].x, tiles[n].y, r);
      expect(resOf(s)).toEqual(before);
      expect(placePiece(s, k, tiles[n].x, tiles[n].y, 3)).toBe(true);
      expect(delta(before, resOf(s)), k).toEqual(asDelta(PIECES[k].cost, -1));
      expect(s.stats.piecesPlaced).toBe(placed + 1);
      // the same tile again: refused, nothing paid
      const again = resOf(s);
      expect(placePiece(s, k, tiles[n].x, tiles[n].y, 0)).toBe(false);
      expect(resOf(s)).toEqual(again);
    });
    const p = tiles[DECOS.length];
    s.res.scrap = 19;
    const check = pieceCheck(s, 'sculpture', p.x, p.y);
    expect(check).toEqual({ ok: false, reason: t('place.costs', { cost: '10 credits + 20 scrap' }), costOnly: true });
    expect(catalogState(s, 'sculpture')).toEqual({ ok: false, reason: 'Missing 1 scrap' });
    expect(placePiece(s, 'sculpture', p.x, p.y, 0)).toBe(false);
    expect(s.res.scrap).toBe(19);
    s.res.scrap = 20;
    expect(placePiece(s, 'sculpture', p.x, p.y, 0)).toBe(true);
    expect(s.res.scrap).toBe(0);
    // a sign needs its parts
    s.res.parts = 3;
    expect(pieceCheck(s, 'sign', tiles[DECOS.length + 1].x, tiles[DECOS.length + 1].y).costOnly).toBe(true);
  });
});

describe('rotations and varieties', () => {
  it('bench, sign, Miso\'s house and sculpture turn 4 ways, the pergola 2, the planter not at all; free', () => {
    const s = city();
    const tiles = freeTiles(s, DECOS.length);
    DECOS.forEach((k, n) => {
      const { x, y } = tiles[n];
      placePiece(s, k, x, y, 0);
      const before = resOf(s);
      const seen: number[] = [pieceAt(s, x, y)!.rot];
      for (let i = 0; i < 4; i++) {
        const turned = rotatePieceAt(s, x, y, 1);
        expect(turned, k).toBe(PIECES[k].rotations > 1);
        seen.push(pieceAt(s, x, y)!.rot);
      }
      const want = { bench: [0, 1, 2, 3, 0], planter: [0, 0, 0, 0, 0], sign: [0, 1, 2, 3, 0], pergola: [0, 1, 0, 1, 0], cathouse: [0, 1, 2, 3, 0], sculpture: [0, 1, 2, 3, 0] }[k];
      expect(seen, k).toEqual(want);
      if (PIECES[k].rotations > 1) {
        rotatePieceAt(s, x, y, -1);
        expect(pieceAt(s, x, y)!.rot, k).toBe(PIECES[k].rotations - 1);
      }
      expect(resOf(s)).toEqual(before);
    });
    // whatever the caller passes ends up in range
    expect(normRot('pergola', 3)).toBe(1);
    expect(normRot('planter', 2)).toBe(0);
    expect(normRot('sculpture', -1)).toBe(3);
    expect(normRot('bench', Number.NaN)).toBe(0);
  });

  it('the planter\'s flowers and the sign\'s motif come from the tile: fixed, in range, all of them seen on a map', () => {
    const seen = { planter: new Set<number>(), sign: new Set<number>() };
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++) {
        for (const k of ['planter', 'sign'] as const) {
          const v = pieceVariety(k, x, y);
          expect(v).toBe(pieceVariety(k, x, y));
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThan(PIECES[k].varieties!);
          seen[k].add(v);
        }
        for (const k of ['bench', 'pergola', 'cathouse', 'sculpture', 'lamp', 'fence'] as const) expect(pieceVariety(k, x, y)).toBe(0);
      }
    expect([...seen.planter].sort()).toEqual([0, 1]);
    expect([...seen.sign].sort()).toEqual([0, 1, 2]);
    // neighbours do not all look the same
    const row = Array.from({ length: 12 }, (_, x) => pieceVariety('sign', x, 7));
    expect(new Set(row).size).toBe(3);
  });

  it('every look and direction the renderer draws exists in the atlas, with its shadow; the sign glows, the sculpture\'s eyes when they face the camera', () => {
    for (const k of DECOS) {
      for (let rot = 0; rot < 4; rot++)
        for (let v = 0; v < (PIECES[k].varieties ?? 1); v++) {
          const name = pieceFrameOf(k, normRot(k, rot), 0, v);
          expect(frame(name), name).toBeTruthy();
          expect(frame(`${name}/shadow`), name).toBeTruthy();
        }
      expect(frame(`pc/${k}/icon`), k).toBeTruthy();
    }
    expect(pieceFrameOf('bench', 2, 0)).toBe('pc/bench/2');
    expect(pieceFrameOf('planter', 0, 0, 1)).toBe('pc/planter/1');
    expect(pieceFrameOf('sign', 3, 0, 2)).toBe('pc/sign/2/3');
    expect(pieceFrameOf('pergola', 1, 0)).toBe('pc/pergola/y');
    expect(pieceFrameOf('cathouse', 3, 0)).toBe('pc/cathouse/3');
    expect(pieceFrameOf('sculpture', 1, 0)).toBe('pc/sculpture/1');
    for (let m = 0; m < 3; m++) for (let d = 0; d < 4; d++) expect(frame(`pc/sign/${m}/${d}/g`)).toBeTruthy();
    expect([0, 1, 2, 3].map((d) => !!frame(`pc/sculpture/${d}/g`))).toEqual([true, true, false, false]);
    // the increment-1 frames are unchanged
    expect(pieceFrameOf('lamp', 3, 0)).toBe('pc/lamp/3');
    expect(pieceFrameOf('gate', 1, 0)).toBe('pc/gate/y');
    expect(pieceFrameOf('fence', 0, 5)).toBe('pc/fence/5');
  });
});

describe('refunds: the sculpture\'s scrap, no more than the room in storage, shown == paid', () => {
  it('pieceRefundAt is half the price, the scrap capped by the free storage at that moment', () => {
    const s = city();
    expect(s.derived.storage).toBe(150);
    s.res.scrap = 100;
    expect(pieceRefundAt(s, 'sculpture')).toEqual({ credits: 5, scrap: 10 });
    s.res.scrap = 147;
    expect(pieceRefundAt(s, 'sculpture')).toEqual({ credits: 5, scrap: 3 });
    s.res.scrap = 150;
    expect(pieceRefundAt(s, 'sculpture')).toEqual({ credits: 5, scrap: 0 });
    s.res.scrap = 170; // above storage (never in play): nothing, not a negative amount
    expect(pieceRefundAt(s, 'sculpture')).toEqual({ credits: 5, scrap: 0 });
    s.res.scrap = 145.5;
    expect(pieceRefundAt(s, 'sculpture')).toEqual({ credits: 5, scrap: 4 });
    // the other pieces have no scrap: always half the price
    for (const k of ALL.filter((k) => k !== 'sculpture')) expect(pieceRefundAt(s, k), k).toEqual(pieceRefund(k));
  });

  it('removing pays exactly what pieceRefundAt and the panel (pieceInfo) say, at every fill level; a refund is not income', () => {
    const s = city();
    const dock = build(s, 'dock');
    installModule(s, 'dockStorage', dock);
    computeDerived(s);
    expect(s.derived.storage).toBe(330);
    const tiles = freeTiles(s, 40);
    let n = 0;
    for (const fill of [0, 100, 315, 321, 325, 329, 330]) {
      for (const k of DECOS) {
        const { x, y } = tiles[n++ % tiles.length];
        removePieceAt(s, x, y);
        s.res.scrap = 200;
        placePiece(s, k, x, y, n);
        s.res.scrap = fill;
        const shown = pieceInfo(s, idx(x, y))!;
        const promised = pieceRefundAt(s, k);
        expect(shown.refund).toEqual(promised);
        expect(shown.scrapShort).toBe((pieceRefund(k).scrap ?? 0) - (promised.scrap ?? 0));
        const before = resOf(s);
        const stats = { ...s.stats };
        const paid = removePieceAt(s, x, y);
        expect(paid, `${k} at ${fill}`).toEqual(promised);
        expect(delta(before, resOf(s))).toEqual(asDelta(promised, 1));
        expect(s.res.scrap).toBeLessThanOrEqual(s.derived.storage);
        expect(s.stats).toEqual(stats); // not collected scrap, not earned credits
        expect(pieceAt(s, x, y)).toBeNull();
      }
    }
    // the scrap of a full store: none back, and the rest is lost, not kept anywhere
    s.res.scrap = s.derived.storage;
    const { x, y } = tiles[0];
    removePieceAt(s, x, y);
    s.res.scrap = 0;
    placePiece(s, 'sculpture', x, y, 0); // (refused: no scrap)
    s.res.scrap = 20;
    placePiece(s, 'sculpture', x, y, 0);
    s.res.scrap = s.derived.storage;
    const pending = s.scrapPending;
    expect(removePieceAt(s, x, y)).toEqual({ credits: 5, scrap: 0 });
    expect(s.scrapPending).toBe(pending);
  });

  it('the bulldozer\'s floating text says what was paid', () => {
    const s = city();
    const { x, y } = freeTiles(s, 1)[0];
    placePiece(s, 'sculpture', x, y, 0);
    s.res.scrap = s.derived.storage - 4;
    s.fx.length = 0;
    removePieceAt(s, x, y);
    expect(s.fx.at(-1)).toMatchObject({ kind: 'demolish', text: '+5 credits + 4 scrap' });
  });
});

describe('saves', () => {
  it('every decoration in every direction round-trips with its code, rotation and look', () => {
    const s = city();
    const tiles = freeTiles(s, 30);
    const placed: { x: number; y: number; k: Deco; rot: number }[] = [];
    let n = 0;
    for (const k of DECOS)
      for (let rot = 0; rot < PIECES[k].rotations; rot++) {
        const { x, y } = tiles[n++];
        s.res.scrap = 100;
        expect(placePiece(s, k, x, y, rot)).toBe(true);
        placed.push({ x, y, k, rot });
      }
    const json = serialize(s);
    const data = JSON.parse(json) as { solids: [number, number, number][] };
    expect(data.solids.map(([, code]) => code).sort()).toEqual(placed.map((p) => solidCode(p.k)).sort());
    const back = deserialize(json);
    for (const p of placed) {
      expect(pieceAt(back, p.x, p.y), `${p.k} ${p.rot}`).toEqual({ kind: p.k, rot: p.rot });
      expect(pieceVariety(p.k, p.x, p.y)).toBe(pieceVariety(p.k, p.x, p.y));
    }
    expect(back.stats.piecesPlaced).toBe(s.stats.piecesPlaced);
    expect(serialize(deserialize(json))).toBe(json);
  });

  it('a damaged save keeps rotations in range and never puts a decoration on a building, junk, sludge or rubble', () => {
    const s = city();
    const hq = hqOf(s);
    const [a, b] = freeTiles(s, 2);
    const junk = s.tiles.findIndex((v, i) => v === T.JUNK && s.occ[i] === -1);
    const data = JSON.parse(serialize(s));
    data.solids = [[idx(a.x, a.y), 7, 3], [idx(b.x, b.y), 5, 2], [idx(hq.x, hq.y), 4, 0], [junk, 9, 0], [idx(0, 1), 10, 0]];
    const back = deserialize(JSON.stringify(data));
    expect(pieceAt(back, a.x, a.y)).toEqual({ kind: 'pergola', rot: 1 });
    expect(pieceAt(back, b.x, b.y)).toEqual({ kind: 'planter', rot: 0 });
    expect(back.solid[idx(hq.x, hq.y)]).toBe(0);
    expect(back.solid[junk]).toBe(0);
    expect(back.solid[idx(0, 1)]).toBe(0); // 10 is not a piece of this version
  });
});

describe('decorations have no effect on any number of the game', () => {
  // A seeded run of the autopilot, as npm run balance plays it; `deco` = the tiles that get a decoration first.
  function run(plan: Plan, seed: number, days: number, deco: { i: number; k: Deco; rot: number }[], touched?: Set<number>): { json: string; log: string[] } {
    const rnd = mulberry32(seed * 31 + 7);
    vi.spyOn(Math, 'random').mockImplementation(rnd);
    const s = createGame({ seed });
    for (const d of deco) {
      // bought, then the money and the counter put back: the two cities start with the same resources
      const res = resOf(s);
      const placed = s.stats.piecesPlaced;
      s.res.credits += 100;
      s.res.parts += 10;
      s.res.scrap = Math.min(s.derived.storage || 150, s.res.scrap + 20);
      expect(placePiece(s, d.k, d.i % MAP_W, Math.floor(d.i / MAP_W), d.rot), `${d.k} at ${d.i}`).toBe(true);
      s.res = res;
      s.stats.piecesPlaced = placed;
    }
    const start = Uint8Array.from(s.tiles);
    const log: string[] = [];
    let t = 0;
    let steps = 0;
    while (!s.outcome && s.time < days * 60) {
      step(s, SIM_STEP);
      steps++;
      t += SIM_STEP;
      answerEvent(s, plan);
      if (t >= 1) {
        t = 0;
        think(s, plan);
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
    // the decorations themselves are the only difference allowed: take them off before comparing
    for (const d of deco) {
      expect(s.solid[d.i], `decoration at ${d.i} still there`).toBe(solidCode(d.k));
      s.solid[d.i] = 0;
      s.rot[d.i] = 0;
    }
    vi.restoreAllMocks();
    return { json: serialize(s), log };
  }

  for (const [plan, seed] of [
    ['green', 1234],
    ['industrial', 777],
  ] as const) {
    it(`a ${plan} city with dozens of decorations plays byte for byte like the same city without them (seed ${seed}, 16 days)`, () => {
      const touched = new Set<number>();
      const plain = run(plan, seed, 16, [], touched);
      // dozens of decorations on ground the plain city never used (never junk, sludge, a building...), all six kinds in
      // every direction, many on the old streets where the citizens walk
      const s0 = createGame({ seed });
      const spots: number[] = [];
      for (let i = 0; i < s0.tiles.length && spots.length < 60; i += 7) {
        if (touched.has(i) || s0.occ[i] !== -1 || (s0.tiles[i] !== T.GROUND && s0.tiles[i] !== T.GRASS)) continue;
        spots.push(i);
      }
      expect(spots.length).toBeGreaterThanOrEqual(48);
      const deco = spots.map((i, n) => ({ i, k: DECOS[n % DECOS.length], rot: Math.floor(n / DECOS.length) % 4 }));
      const decorated = run(plan, seed, 16, deco);
      // (the run ends with the Spire when the autopilot gets there first)
      expect(decorated.log.length).toBeGreaterThan(5);
      expect(decorated.log).toEqual(plain.log);
      expect(decorated.json).toBe(plain.json);
    });
  }
});

describe('junk never lands on a decoration; citizens walk around them; bots are not stopped', () => {
  it('storms, waste, sludge and gifted gardens skip every solid piece', () => {
    const s = city(73);
    build(s, 'pods');
    build(s, 'pods');
    const solids: number[] = [];
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++) {
        const i = idx(x, y);
        if (s.occ[i] !== -1 || (s.tiles[i] !== T.GROUND && s.tiles[i] !== T.GRASS) || (x + y) % 4 === 0) continue;
        s.res.credits = 1000;
        s.res.parts = 1000;
        s.res.scrap = 100;
        expect(placePiece(s, SOLIDS[(x * 7 + y * 3) % SOLIDS.length], x, y, x + y)).toBe(true);
        solids.push(i);
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
  });

  it('citizens never walk onto a decoration laid on their street', () => {
    const s = createGame({ seed: 4242 });
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
        if (placePiece(s, DECOS[laid % DECOS.length], x, y, laid)) {
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

  it('bots keep collecting over a city covered in decorations', () => {
    vi.spyOn(Math, 'random').mockImplementation(mulberry32(5));
    const s = city(74);
    let n = 0;
    for (const { x, y } of freeTiles(s, 200)) {
      s.res.scrap = 100;
      placePiece(s, DECOS[n++ % DECOS.length], x, y, n);
    }
    s.res.scrap = 0;
    const collected = s.stats.scrapCollected;
    for (let k = 0; k < 60 * 20; k++) step(s, SIM_STEP);
    expect(s.stats.scrapCollected - collected).toBeGreaterThan(20);
  });
});

describe('random place / remove / rotate / save-load over all ten catalog pieces', () => {
  it('never creates a resource: each placement costs its price, each removal pays what was shown, nothing else moves', () => {
    const did = { placed: 0, removed: 0, rotated: 0, saved: 0, capped: 0 };
    for (let seed = 1; seed <= 5; seed++) {
      const rng = mulberry32(seed * 104729);
      let s = city(90 + seed);
      s.res.scrap = 140;
      const tiles = freeTiles(s, 50);
      const pick = <V>(list: readonly V[]): V => list[Math.floor(rng() * list.length)];
      const start = resOf(s);
      // what the player has plus the half-price of everything on the map: buying lowers it, removing never raises it
      const worth = () => {
        const w = resOf(s);
        for (let i = 0; i < s.solid.length; i++) {
          const p = pieceAt(s, i % MAP_W, Math.floor(i / MAP_W));
          if (p) for (const r of RES) w[r] += pieceRefund(p.kind)[r] ?? 0;
          if (s.floor[i]) w.credits += pieceRefund('floor').credits ?? 0;
        }
        return w;
      };
      let dock: Building | null = null;
      let last = worth();
      for (let n = 0; n < 700; n++) {
        const op = Math.floor(rng() * 10);
        const p = pick(tiles);
        const before = resOf(s);
        if (op <= 2) {
          const k = pick(ALL);
          const ok = pieceCheck(s, k, p.x, p.y).ok;
          expect(placePiece(s, k, p.x, p.y, Math.floor(rng() * 4))).toBe(ok);
          expect(delta(before, resOf(s))).toEqual(ok ? asDelta(PIECES[k].cost, -1) : asDelta({}, 1));
          did.placed += +ok;
        } else if (op <= 4) {
          // what the panel of the piece there shows (a floor under a building cannot be taken up)
          const info = pieceInfo(s, idx(p.x, p.y));
          const promised = info?.removable ? info.refund : null;
          if (promised) expect(promised).toEqual(pieceRefundAt(s, info!.kind));
          if (info?.kind === 'sculpture' && (promised!.scrap ?? 0) < 10) did.capped++;
          const paid = removePieceAt(s, p.x, p.y);
          expect(paid).toEqual(promised);
          expect(delta(before, resOf(s))).toEqual(asDelta(paid ?? {}, 1));
          did.removed += +!!paid;
        } else if (op === 5) {
          did.rotated += +rotatePieceAt(s, p.x, p.y, rng() < 0.5 ? 1 : -1);
          expect(resOf(s)).toEqual(before);
        } else if (op === 6) {
          // save and load (nothing moves; the counters and every piece come back)
          const json = serialize(s);
          s = deserialize(json);
          computeDerived(s);
          dock = s.buildings.find((b) => b.type === 'dock') ?? null;
          expect(resOf(s)).toEqual(before);
          expect(serialize(s)).toBe(json);
          did.saved++;
        } else if (op === 7) {
          // the room in storage changes: a Dock with or without its storage module, or scrap brought by the bots
          if (!dock || !s.buildings.includes(dock)) {
            dock = build(s, 'dock');
            dock.built = 1;
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
        } else if (op === 8) {
          // bots bring scrap back: the store fills (the only way in for scrap, and it is counted as collected)
          s.res.scrap = Math.min(s.derived.storage, s.res.scrap + Math.floor(rng() * 60));
        } else {
          // the free room in storage is what the sculpture's refund may use
          expect(pieceRefundAt(s, 'sculpture').scrap).toBe(Math.max(0, Math.min(10, Math.floor(free(s)))));
        }
        const now = worth();
        for (const r of RES) {
          // (the Dock and the bots' scrap are the test's own doing: the worth is compared from there on)
          if (op === 7 || op === 8) continue;
          expect(now[r], `seed ${seed} step ${n} op ${op} ${r}`).toBeLessThanOrEqual(last[r] + 1e-9);
          if (r !== 'scrap') expect(s.res[r], `seed ${seed} step ${n} ${r}`).toBeLessThanOrEqual(start[r] + 1e-9);
          expect(s.res[r]).toBeGreaterThanOrEqual(0);
        }
        expect(s.res.scrap).toBeLessThanOrEqual(s.derived.storage + 1e-9);
        last = now;
        // never a piece on a building, never two on a tile
        for (const b of s.buildings) expect(isSolidAt(s, b.y * MAP_W + b.x)).toBe(false);
      }
      // take everything up (the test's free Dock first, its refund left out): credits and parts end below the start
      if (dock && s.buildings.includes(dock)) {
        const keep = resOf(s);
        demolish(s, dock);
        s.res.credits = keep.credits;
        s.res.parts = keep.parts;
      }
      for (const q of tiles) while (removePieceAt(s, q.x, q.y));
      expect(s.res.credits).toBeLessThanOrEqual(start.credits);
      expect(s.res.parts).toBeLessThanOrEqual(start.parts);
      expect(s.solid.every((v) => v === 0) && s.floor.every((v) => v === 0)).toBe(true);
    }
    for (const [k, v] of Object.entries(did)) expect(v, k).toBeGreaterThan(5);
  });
});
