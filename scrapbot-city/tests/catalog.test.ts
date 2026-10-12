// The words and numbers of the Objects & modules interface (src/ui/catalog.ts): what can be bought and why
// not, the module effects before -> after, the map label, the scrap a smaller storage loses, what the
// panel of a selected piece offers, and what a bulldozer click acts on (which is also what lights up).
import { describe, expect, it } from 'vitest';
import { placeBuilding, placeCheck } from '../src/game/actions';
import { MAP_H, MAP_W, T } from '../src/game/defs';
import type { BuildingType } from '../src/game/defs';
import { installModule, placePiece } from '../src/game/pieces';
import type { CatalogKind } from '../src/game/pieces';
import { computeDerived } from '../src/game/sim';
import { createGame, idx } from '../src/game/state';
import type { Building, GameState } from '../src/game/state';
import { t } from '../src/i18n';
import {
  CONSTRUCTION,
  DECORATIONS,
  MACHINE_MODULES,
  catalogEffect,
  catalogLimit,
  catalogName,
  catalogState,
  demolishStorageDrop,
  dozeTarget,
  installState,
  isRotatable,
  isRowKind,
  moduleLabel,
  moduleRows,
  moduleStorageDrop,
  pieceInfo,
  scrapLost,
  shortfall,
} from '../src/ui/catalog';

function city(): GameState {
  const s = createGame({ seed: 71, cityName: 'Catalog' });
  s.res.credits = 5000;
  s.res.parts = 1000;
  computeDerived(s);
  return s;
}

// Plain free tiles near the HQ, nearest first.
function freeTiles(s: GameState): { x: number; y: number }[] {
  const hq = s.buildings[0];
  const out: { x: number; y: number }[] = [];
  for (let r = 2; r < 30; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = hq.x + 1 + dx;
        const y = hq.y + 1 + dy;
        if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
        const i = idx(x, y);
        if ((s.tiles[i] === T.GROUND || s.tiles[i] === T.GRASS) && s.occ[i] === -1 && !s.solid[i] && !s.floor[i]) out.push({ x, y });
      }
  return out;
}

function build(s: GameState, type: BuildingType, done = true): Building {
  for (const p of freeTiles(s)) {
    if (!placeCheck(s, type, p.x, p.y).ok) continue;
    const b = placeBuilding(s, type, p.x, p.y)!;
    if (done) b.built = 1;
    computeDerived(s);
    return b;
  }
  throw new Error(`no room for ${type}`);
}

// Three free tiles in a row along x.
function row3(s: GameState): { x: number; y: number }[] {
  for (const p of freeTiles(s)) {
    const tiles = [0, 1, 2].map((k) => ({ x: p.x + k, y: p.y }));
    if (tiles.every((q) => q.x < MAP_W && freeTiles(s).some((f) => f.x === q.x && f.y === q.y))) return tiles;
  }
  throw new Error('no free row');
}

describe('catalog wording', () => {
  it('lists the construction pieces, the decorations, then the machine modules, each with a name, effect and limit', () => {
    expect(CONSTRUCTION).toEqual(['floor', 'fence', 'gate']);
    expect(DECORATIONS).toEqual(['lamp', 'bench', 'planter', 'sign', 'pergola', 'cathouse', 'sculpture']);
    expect(MACHINE_MODULES).toEqual(['dockStorage', 'smelterFilter', 'recyclerMagnet', 'recyclerSorter', 'factoryArm', 'podsCapsule', 'solarTracker', 'purifierNozzle']);
    // every module has its name (the "slot taken by" reason uses it)
    for (const kind of MACHINE_MODULES) expect(catalogName(kind), kind).not.toMatch(/^mod\./);
    for (const kind of [...CONSTRUCTION, ...DECORATIONS, ...MACHINE_MODULES]) {
      for (const text of [catalogName(kind), catalogEffect(kind), catalogLimit(kind)]) {
        expect(text, kind).not.toMatch(/^(pc|mod|cat)\./);
        expect(text, kind).not.toMatch(/\{\w+\}/);
      }
    }
    expect(catalogLimit('fence')).toBe('1 per tile');
    expect(catalogLimit('dockStorage')).toBe('1 per Bot Dock');
  });

  it('turns only the fence, gate and lamp, and drags rows only of floor and fence', () => {
    const kinds: (CatalogKind | null)[] = ['floor', 'fence', 'gate', 'lamp', 'dockStorage', 'smelterFilter', null];
    expect(kinds.map((k) => isRotatable(k))).toEqual([false, true, true, true, false, false, false]);
    expect(kinds.map((k) => isRowKind(k))).toEqual([true, true, false, false, false, false, false]);
  });

  it('shows the module effects as the core computes them: storage 80 -> 180, smog and energy of the Smelter', () => {
    expect(moduleRows('dock', 'dockStorage')).toEqual([{ stat: 'storage', before: '80', after: '180' }]);
    expect(moduleRows('smelter', 'smelterFilter')).toEqual([
      { stat: 'smog', before: '+2.1', after: '+0.8' },
      { stat: 'energy', before: '-2', after: '-3' },
    ]);
    // one slot: the "before" is always the plain building, whatever is installed (the sorter's numbers do not
    // change when the magnet holds the slot)
    expect(moduleRows('recycler', 'recyclerSorter')[0]).toEqual({ stat: 'output', res: 'parts', before: '2', after: '3' });
    expect(catalogEffect('dockStorage')).toBe('Bot Dock storage 80 → 180 scrap');
    expect(catalogEffect('smelterFilter')).toBe('Smelter smog +2.1 → +0.8 per day, energy -2 → -3, same output');
  });

  it('labels the building a module points at in plain characters for the map font', () => {
    const s = city();
    expect(moduleLabel(build(s, 'dock'), 'dockStorage')).toBe('Storage 80 -> 180');
    expect(moduleLabel(build(s, 'smelter'), 'smelterFilter')).toBe('Smog +2.1 -> +0.8, Energy -2 -> -3');
  });
});

describe('what can be bought now', () => {
  it('a piece needs only its price, and says what is missing', () => {
    const s = city();
    expect(catalogState(s, 'lamp')).toEqual({ ok: true });
    s.res.credits = 7;
    s.res.parts = 0;
    expect(shortfall(s, { credits: 10, parts: 2 })).toEqual({ credits: 3, parts: 2 });
    expect(catalogState(s, 'lamp')).toEqual({ ok: false, reason: 'Missing 3 credits + 2 parts' });
    expect(catalogState(s, 'fence').ok).toBe(true);
  });

  it('a module needs a finished building of its type without it, then its price', () => {
    const s = city();
    expect(catalogState(s, 'dockStorage')).toEqual({ ok: false, reason: t('place.modDock') });
    const dock = build(s, 'dock', false);
    expect(catalogState(s, 'dockStorage')).toEqual({ ok: false, reason: t('place.modDock') });
    dock.built = 1;
    expect(catalogState(s, 'dockStorage')).toEqual({ ok: true });
    expect(installModule(s, 'dockStorage', dock)).toBe(true);
    expect(catalogState(s, 'dockStorage')).toEqual({ ok: false, reason: t('place.modInstalled') });
    // a second Dock without it makes it available again, if the city can pay
    build(s, 'dock');
    expect(catalogState(s, 'dockStorage')).toEqual({ ok: true });
    s.res.parts = 0;
    expect(catalogState(s, 'dockStorage')).toEqual({ ok: false, reason: 'Missing 15 parts' });
    expect(catalogState(s, 'smelterFilter')).toEqual({ ok: false, reason: t('place.modSmelter') });
  });

  it('the Recycler slot: the sorter is not on offer where every Recycler has the magnet, and says why', () => {
    const s = city();
    const a = build(s, 'recycler');
    const b = build(s, 'recycler');
    expect(catalogState(s, 'recyclerSorter')).toEqual({ ok: true });
    installModule(s, 'recyclerMagnet', a);
    expect(catalogState(s, 'recyclerSorter')).toEqual({ ok: true }); // the second Recycler is free
    installModule(s, 'recyclerMagnet', b);
    expect(catalogState(s, 'recyclerSorter')).toEqual({ ok: false, reason: 'Slot taken by Magnetic separator: remove it first' });
    expect(catalogState(s, 'recyclerMagnet')).toEqual({ ok: false, reason: t('place.modInstalled') });
    expect(installState(s, 'recyclerSorter', a)).toEqual({ ok: false, reason: 'Slot taken by Magnetic separator: remove it first' });
  });

  it('on one building: moduleCheck, with what is missing instead of the whole price', () => {
    const s = city();
    const dock = build(s, 'dock', false);
    expect(installState(s, 'dockStorage', dock)).toEqual({ ok: false, reason: t('place.modDock') });
    dock.built = 1;
    expect(installState(s, 'dockStorage', dock)).toEqual({ ok: true });
    expect(installState(s, 'smelterFilter', dock)).toEqual({ ok: false, reason: t('place.modSmelter') });
    s.res.credits = 20;
    expect(installState(s, 'dockStorage', dock)).toEqual({ ok: false, reason: 'Missing 10 credits' });
  });
});

describe('scrap lost with storage', () => {
  it('counts the scrap above what a smaller storage holds', () => {
    const s = city();
    const dock = build(s, 'dock');
    expect(installModule(s, 'dockStorage', dock)).toBe(true);
    computeDerived(s);
    expect(s.derived.storage).toBe(150 + 180);
    expect(moduleStorageDrop(dock, 'dockStorage')).toBe(100);
    expect(demolishStorageDrop(dock)).toBe(180);
    s.res.scrap = 300;
    expect(scrapLost(s, moduleStorageDrop(dock, 'dockStorage'))).toBe(70);
    expect(scrapLost(s, demolishStorageDrop(dock))).toBe(150);
    s.res.scrap = 200.6;
    expect(scrapLost(s, 100)).toBe(0);
    expect(scrapLost(s, 0)).toBe(0);
    // an unfinished building adds no storage yet, so demolishing it takes none away
    expect(demolishStorageDrop(build(s, 'dock', false))).toBe(0);
  });
});

describe('a selected piece', () => {
  it('turns a gate, a lamp and a fence that stands alone; floors can be taken up when bare', () => {
    const s = city();
    const [a, b, c] = row3(s);
    expect(pieceInfo(s, idx(a.x, a.y))).toBeNull();
    expect(placePiece(s, 'fence', a.x, a.y)).toBe(true);
    expect(pieceInfo(s, idx(a.x, a.y))).toMatchObject({ kind: 'fence', x: a.x, y: a.y, rotatable: true, removable: true });
    expect(placePiece(s, 'gate', b.x, b.y)).toBe(true);
    // joined to the gate, the fence follows it and no longer turns on its own
    expect(pieceInfo(s, idx(a.x, a.y))).toMatchObject({ kind: 'fence', rotatable: false });
    expect(pieceInfo(s, idx(b.x, b.y))).toMatchObject({ kind: 'gate', rotatable: true });
    expect(placePiece(s, 'floor', c.x, c.y)).toBe(true);
    expect(pieceInfo(s, idx(c.x, c.y))).toMatchObject({ kind: 'floor', rotatable: false, removable: true });
    // a lamp on the floor is what the tile shows and what gets selected
    expect(placePiece(s, 'lamp', c.x, c.y)).toBe(true);
    expect(pieceInfo(s, idx(c.x, c.y))).toMatchObject({ kind: 'lamp', rotatable: true });
    expect(pieceInfo(s, -1)).toBeNull();
    expect(pieceInfo(s, MAP_W * MAP_H)).toBeNull();
  });

  it('a floor under a building cannot be taken up from its panel', () => {
    const s = city();
    const p = freeTiles(s).find((q) => placeCheck(s, 'garden', q.x, q.y).ok)!;
    expect(placePiece(s, 'floor', p.x, p.y)).toBe(true);
    expect(placeBuilding(s, 'garden', p.x, p.y)).not.toBeNull();
    expect(pieceInfo(s, idx(p.x, p.y))).toMatchObject({ kind: 'floor', removable: false });
  });
});

describe('bulldozer target', () => {
  // `picked` is the building drawn under the pointer (-1 none, -2 the cat), `drawn` the piece drawn there
  const none = () => -1;

  it('a fence, gate or lamp on the tile under the pointer wins over the building drawn in front of it', () => {
    const s = city();
    const b = build(s, 'pods');
    // the tile right behind the building's north corner: the building can hide it entirely
    const behind = { x: b.x, y: b.y - 1 };
    expect(s.occ[idx(behind.x, behind.y)]).toBe(-1);
    expect(dozeTarget(s, behind.x, behind.y, b.id, none)).toEqual({ kind: 'building', id: b.id });
    for (const kind of ['fence', 'gate', 'lamp'] as const) {
      expect(placePiece(s, kind, behind.x, behind.y)).toBe(true);
      expect(dozeTarget(s, behind.x, behind.y, b.id, none), kind).toEqual({ kind: 'piece', i: idx(behind.x, behind.y) });
      s.solid[idx(behind.x, behind.y)] = 0;
    }
    // so is rubble (since 0.6); a bare floor is not hidden by the building: the building is the target
    s.tiles[idx(behind.x, behind.y)] = T.RUBBLE;
    expect(dozeTarget(s, behind.x, behind.y, b.id, none)).toEqual({ kind: 'rubble', i: idx(behind.x, behind.y) });
    s.tiles[idx(behind.x, behind.y)] = T.GROUND;
    expect(placePiece(s, 'floor', behind.x, behind.y)).toBe(true);
    expect(dozeTarget(s, behind.x, behind.y, b.id, none)).toEqual({ kind: 'building', id: b.id });
  });

  it('then a piece drawn under the pointer, then what lies on the tile', () => {
    const s = city();
    const b = build(s, 'pods');
    const [a, c] = row3(s);
    expect(placePiece(s, 'lamp', a.x, a.y)).toBe(true);
    // the lamp's head drawn over the next tile: the lamp is taken up, the cat is never bulldozed
    expect(dozeTarget(s, c.x, c.y, -1, () => idx(a.x, a.y))).toEqual({ kind: 'piece', i: idx(a.x, a.y) });
    expect(dozeTarget(s, c.x, c.y, -2, none)).toEqual({ kind: 'nothing', i: idx(c.x, c.y) });
    // a building's own tile, even where none of its pixels is drawn
    expect(dozeTarget(s, b.x, b.y, -1, none)).toEqual({ kind: 'building', id: b.id });
    expect(placePiece(s, 'floor', c.x, c.y)).toBe(true);
    expect(dozeTarget(s, c.x, c.y, -1, none)).toEqual({ kind: 'piece', i: idx(c.x, c.y) });
    // a floor covered by junk cannot be taken up: nothing to do there
    s.tiles[idx(c.x, c.y)] = T.JUNK;
    expect(dozeTarget(s, c.x, c.y, -1, none)).toEqual({ kind: 'nothing', i: idx(c.x, c.y) });
    expect(dozeTarget(s, -3, 4, -1, none)).toEqual({ kind: 'nothing', i: -1 });
  });
});
