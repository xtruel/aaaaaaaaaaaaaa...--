// Projects to discover (docs/MODULAR-INC2.md §4): the table, discovery once and never again lost, the gate in
// pieceCheck / moduleCheck, items a city already has, the profile's data (versioned, maxima, nothing lost) and what old
// saves prove (0.6, 0.7.0-alpha.1) without inventing anything.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { placeBuilding, placeCheck } from '../src/game/actions';
import { BUILDINGS, SIM_STEP } from '../src/game/defs';
import type { BuildingType } from '../src/game/defs';
import { CATALOG_ORDER, MODULES, PIECES, installModule, isModuleKind, moduleCheck, movePiece, pieceAt, pieceCheck, placePiece, removeModule, removePieceAt, rotatePieceAt } from '../src/game/pieces';
import type { CatalogKind, ModuleKind, PieceKind } from '../src/game/pieces';
import {
  GOAL_STATS,
  PROJECTS,
  PROJECT_KINDS,
  cityProgress,
  discoverReached,
  emptyProfile,
  goalReached,
  goalText,
  goalValue,
  goalValues,
  isLocked,
  lockedReason,
  mergeProfile,
  parseProfile,
  profileBest,
  profileUnlocked,
  provenBySave,
  reachedNow,
} from '../src/game/projects';
import type { ProjectKind } from '../src/game/projects';
import { computeDerived, step } from '../src/game/sim';
import { createGame, deserialize, idx, serialize } from '../src/game/state';
import type { Building, GameState } from '../src/game/state';
import { setLang } from '../src/i18n';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE_06 = readFileSync(join(here, 'fixtures/save-0.6.json'), 'utf8');
const FIXTURE_07A1 = readFileSync(join(here, 'fixtures/save-0.7a1.json'), 'utf8');

afterEach(() => {
  vi.restoreAllMocks();
  setLang('en');
});

// the six items of increment 1: always there, never a project
const ALWAYS: CatalogKind[] = ['floor', 'fence', 'gate', 'lamp', 'dockStorage', 'smelterFilter'];

function city(seed = 7): GameState {
  const s = createGame({ seed });
  s.res.credits = 5000;
  s.res.parts = 2000;
  s.res.scrap = 100;
  computeDerived(s);
  return s;
}

// a free plain tile near the HQ where `kind` passes every check but the project's
function freeTile(s: GameState, kind: PieceKind): { x: number; y: number } {
  const hq = s.buildings[0];
  const had = s.unlocked.has(kind as ProjectKind);
  s.unlocked.add(kind as ProjectKind);
  try {
    for (let r = 3; r < 20; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const x = hq.x + dx;
          const y = hq.y + dy;
          if (pieceCheck(s, kind, x, y).ok) return { x, y };
        }
  } finally {
    if (!had) s.unlocked.delete(kind as ProjectKind);
  }
  throw new Error('no free tile');
}

// a finished building of `type` placed through the game's rules
function finished(s: GameState, type: BuildingType): Building {
  const hq = s.buildings[0];
  for (let r = 3; r < 20; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (!placeCheck(s, type, hq.x + dx, hq.y + dy).ok) continue;
        const b = placeBuilding(s, type, hq.x + dx, hq.y + dy)!;
        b.built = 1;
        b.status = 'ok';
        computeDerived(s);
        return b;
      }
  throw new Error(`no room for ${type}`);
}

describe('the table (§4)', () => {
  it('18 projects: exactly the increment-2 items, with the goal, statistic and phase of the table', () => {
    expect(PROJECT_KINDS).toHaveLength(18);
    expect(new Set(PROJECT_KINDS)).toEqual(new Set(CATALOG_ORDER.filter((k) => !ALWAYS.includes(k))));
    const table = PROJECTS.map((p) => `${p.kind} ${p.stat} ${p.target} ${p.phase}`);
    expect(table).toEqual([
      'recyclerMagnet partsMade 100 start',
      'bench pop 10 start',
      'cathouse catPets 3 start',
      'planter scrapCollected 300 start',
      'base built 10 start',
      'tree pop 20 start',
      'podsCapsule pop 30 development',
      'recyclerSorter partsMade 400 development',
      'purifierNozzle cleaned 10 development',
      'solarTracker energyProd 30 development',
      'sign built 25 development',
      'factoryArm creditsEarned 5000 development',
      'wall scrapCollected 1000 development',
      'pillar piecesPlaced 20 development',
      'pergola pop 50 completion',
      'sculpture spire 1 completion',
      'fountain creditsEarned 10000 completion',
      'statue built 40 completion',
    ]);
  });

  it('the goals in words, numbers grouped as each language writes them', () => {
    expect(goalText('fountain')).toBe('Earn 10,000 credits');
    expect(goalText('pillar')).toBe('Place 20 catalog objects (floors, fences, gates, lamps…; not the Parts resource)');
    setLang('it');
    expect(goalText('fountain')).toBe('Guadagna 10.000 crediti');
    expect(goalText('recyclerSorter')).toBe('Produci 400 pezzi');
    // the catalog objects placed are never called "pezzi" (the parts resource) in Italian
    expect(goalText('pillar')).toMatch(/^Posa 20 oggetti del catalogo/);
    expect(goalText('pillar')).not.toMatch(/^Posa 20 pezzi/);
    setLang('pl');
    expect(goalText('factoryArm')).toBe('Zarób 5000 kredytów');
    expect(goalText('fountain')).toBe('Zarób 10 000 kredytów');
  });

  it('no project needs another project: every goal is a statistic the city keeps, the catalog pieces one included', () => {
    for (const p of PROJECTS) expect(GOAL_STATS).toContain(p.stat);
    // 20 catalog objects with the increment-1 items only (always there): the corner pillar is reachable without any project
    const s = city();
    for (let i = 0; i < 20; i++) {
      const tile = freeTile(s, i % 2 ? 'fence' : 'floor');
      expect(placePiece(s, i % 2 ? 'fence' : 'floor', tile.x, tile.y)).toBe(true);
    }
    expect(s.unlocked.size).toBe(0);
    expect(discoverReached(s)).toEqual(['pillar']);
  });

  it('no goal asks for smog, for the green or the industrial path: energy counts Solar Arrays and Burners alike', () => {
    const pathBound = ['maxPollution', 'industrialBuilt', 'pollution', 'alignment', 'smog'];
    for (const p of PROJECTS) expect(pathBound).not.toContain(p.stat);
    for (const p of PROJECTS) if (p.stat === 'built') expect(p.target).toBeGreaterThan(0); // any building counts
    // 30 energy from Solar Arrays (green), and from Scrap Burners (industrial)
    const green = city();
    for (let i = 0; i < 6; i++) finished(green, 'solar');
    expect(BUILDINGS.solar.path).toBe('green');
    expect(goalValue(green, 'energyProd')).toBeGreaterThanOrEqual(30);
    expect(goalReached(green, 'solarTracker')).toBe(true);
    const ind = city(8);
    expect(BUILDINGS.burner.path).toBe('industrial');
    for (let i = 0; i < 6; i++) {
      const b = finished(ind, 'burner');
      b.fuel = 999;
    }
    computeDerived(ind);
    expect(goalValue(ind, 'energyProd')).toBeGreaterThanOrEqual(30);
    expect(goalReached(ind, 'solarTracker')).toBe(true);
  });
});

describe('discovery', () => {
  it('a goal reached discovers its project once; it stays discovered when the city falls back (never re-locked)', () => {
    const s = city();
    expect(isLocked(s, 'bench')).toBe(true);
    s.pop = 10.4;
    expect(reachedNow(s)).toEqual(['bench']);
    expect(discoverReached(s)).toEqual(['bench']);
    expect(discoverReached(s)).toEqual([]); // once
    s.pop = 2; // citizens leave
    s.pollution = 90;
    expect(discoverReached(s)).toEqual([]);
    expect(isLocked(s, 'bench')).toBe(false);
    expect(pieceCheck(s, 'bench', ...Object.values(freeTile(s, 'bench')) as [number, number]).ok).toBe(true);
  });

  it('several goals at once are discovered together, in the table order', () => {
    const s = city();
    s.pop = 25;
    s.stats.built = 12;
    s.stats.catPets = 3;
    expect(discoverReached(s)).toEqual(['bench', 'cathouse', 'base', 'tree']);
  });

  it('discovering gives nothing: resources, statistics and the whole saved city stay byte for byte the same', () => {
    const s = city();
    for (let i = 0; i < 600; i++) step(s, SIM_STEP);
    s.pop = 55;
    s.stats.partsMade = 500;
    s.stats.creditsEarned = 12000;
    const before = serialize(s);
    const random = vi.spyOn(Math, 'random');
    const found = discoverReached(s);
    goalValues(s);
    expect(found.length).toBeGreaterThan(4);
    expect(random).not.toHaveBeenCalled(); // no chance in a discovery
    expect(serialize(s)).toBe(before);
  });

  it('the Spire goal: the city finished its Spire', () => {
    const s = city();
    expect(cityProgress(s, 'sculpture')).toEqual({ value: 0, target: 1 });
    s.spireDone = true;
    expect(discoverReached(s)).toContain('sculpture');
  });

  it('values are whole and a damaged statistic counts as nothing', () => {
    const s = city();
    s.stats.creditsEarned = 4999.99;
    expect(goalValue(s, 'creditsEarned')).toBe(4999);
    expect(goalReached(s, 'factoryArm')).toBe(false);
    (s.stats as unknown as Record<string, unknown>).partsMade = 'lots';
    expect(goalValue(s, 'partsMade')).toBe(0);
    s.stats.cleaned = Number.NaN;
    expect(goalValue(s, 'cleaned')).toBe(0);
  });
});

describe('the gate: pieceCheck and moduleCheck refuse a project not discovered, whatever the input', () => {
  it('every new piece is refused with its goal and the city progress, and costs nothing; once discovered it can be bought', () => {
    const s = city();
    s.stats.built = 4;
    for (const kind of (PROJECT_KINDS as readonly CatalogKind[]).filter((k): k is PieceKind => !isModuleKind(k))) {
      const { x, y } = freeTile(s, kind);
      const check = pieceCheck(s, kind, x, y);
      expect(check.ok).toBe(false);
      expect(check.costOnly).toBeUndefined();
      expect(check.reason).toBe(lockedReason(s, kind as ProjectKind));
      expect(check.reason).toMatch(/^Project to discover: /);
      const res = { ...s.res };
      const placed = s.stats.piecesPlaced;
      expect(placePiece(s, kind, x, y)).toBe(false);
      expect(s.res).toEqual(res);
      expect(s.stats.piecesPlaced).toBe(placed);
      // nothing laid: no surface on a free tile, and no new solid piece
      if (PIECES[kind].layer === 'surface') expect(s.floor[idx(x, y)]).toBe(0);
      else expect(pieceAt(s, x, y)).toBeNull();
      s.unlocked.add(kind as ProjectKind);
      expect(pieceCheck(s, kind, x, y).ok).toBe(true);
      expect(placePiece(s, kind, x, y)).toBe(true);
    }
    expect(lockedReason(createGame({ seed: 1 }), 'base')).toBe('Project to discover: Finish 10 buildings (0 / 10 in this city)');
    s.stats.partsMade = 120;
    expect(lockedReason(s, 'recyclerSorter')).toBe('Project to discover: Make 400 parts (120 / 400 in this city)');
  });

  it('every new module is refused on its building, before any other reason; once discovered it installs', () => {
    const s = city();
    for (const kind of (PROJECT_KINDS as readonly CatalogKind[]).filter((k): k is ModuleKind => isModuleKind(k))) {
      const b = finished(s, MODULES[kind].building);
      const check = moduleCheck(s, kind, b);
      expect(check.ok).toBe(false);
      expect(check.reason).toBe(lockedReason(s, kind as ProjectKind));
      const res = { ...s.res };
      expect(installModule(s, kind, b)).toBe(false);
      expect(s.res).toEqual(res);
      expect(b.modules).toBeUndefined();
      s.unlocked.add(kind as ProjectKind);
      expect(installModule(s, kind, b)).toBe(true);
    }
  });

  it('the six increment-1 items and every building stay available in a new city', () => {
    const s = city();
    expect(s.unlocked.size).toBe(0);
    for (const kind of ALWAYS) expect(isLocked(s, kind)).toBe(false);
    for (const kind of ['floor', 'fence', 'gate', 'lamp'] as PieceKind[]) {
      const { x, y } = freeTile(s, kind);
      expect(pieceCheck(s, kind, x, y).ok).toBe(true);
    }
    expect(installModule(s, 'dockStorage', finished(s, 'dock'))).toBe(true);
    expect(installModule(s, 'smelterFilter', finished(s, 'smelter'))).toBe(true);
    for (const type of ['recycler', 'pods', 'solar', 'garden', 'factory', 'purifier'] as BuildingType[]) finished(s, type);
  });

  it('the Spire: its goal only, without the progress numbers', () => {
    expect(lockedReason(city(), 'sculpture')).toBe('Project to discover: Finish the Scrap Spire (campaign or free play)');
  });
});

describe('a city keeps what it has (only buying waits for the discovery)', () => {
  it('pieces and a module of undiscovered projects in a loaded city stay; they turn, move, come off; buying again is refused', () => {
    const s = city();
    for (const k of PROJECT_KINDS) s.unlocked.add(k);
    const bench = freeTile(s, 'bench');
    expect(placePiece(s, 'bench', bench.x, bench.y, 1)).toBe(true);
    const base = freeTile(s, 'base');
    expect(placePiece(s, 'base', base.x, base.y)).toBe(true);
    const rec = finished(s, 'recycler');
    expect(installModule(s, 'recyclerMagnet', rec)).toBe(true);
    const loaded = deserialize(serialize(s));
    expect(loaded.unlocked.size).toBe(0);
    expect(pieceAt(loaded, bench.x, bench.y)).toEqual({ kind: 'bench', rot: 1 });
    expect(loaded.floor[idx(base.x, base.y)]).toBe(2);
    const lrec = loaded.buildings.find((b) => b.id === rec.id)!;
    expect(lrec.modules).toEqual(['recyclerMagnet']);
    computeDerived(loaded);
    // turn, move: free, allowed
    expect(rotatePieceAt(loaded, bench.x, bench.y)).toBe(true);
    const to = freeTile(loaded, 'bench');
    expect(movePiece(loaded, bench.x, bench.y, to.x, to.y)).toBe(true);
    // take off: refunded as usual
    expect(removePieceAt(loaded, to.x, to.y)).toEqual({ credits: 3 });
    expect(removeModule(loaded, 'recyclerMagnet', lrec)).toEqual({ credits: 20, parts: 7 });
    // buying again waits for the discovery
    expect(pieceCheck(loaded, 'bench', to.x, to.y).reason).toMatch(/^Project to discover/);
    expect(moduleCheck(loaded, 'recyclerMagnet', lrec).reason).toMatch(/^Project to discover/);
  });

  it('the projects are never written into the city save, and a save cannot bring any', () => {
    const s = city();
    for (const k of PROJECT_KINDS) s.unlocked.add(k);
    const json = serialize(s);
    expect(json).not.toMatch(/unlocked/);
    const hacked = JSON.parse(json);
    hacked.unlocked = [...PROJECT_KINDS];
    const loaded = deserialize(JSON.stringify(hacked));
    expect(loaded.unlocked).toBeInstanceOf(Set);
    expect(loaded.unlocked.size).toBe(0);
  });
});

describe('old saves: what their data proves, nothing invented', () => {
  it('0.6: 211 parts made and 594 scrap collected prove the magnetic separator and the planter, and nothing else', () => {
    const s = deserialize(FIXTURE_06);
    computeDerived(s);
    expect(s.stats.partsMade).toBe(211);
    expect(provenBySave(s)).toEqual(['recyclerMagnet', 'planter']);
    const res = { ...s.res };
    const stats = { ...s.stats };
    expect(discoverReached(s)).toEqual(['recyclerMagnet', 'planter']);
    expect(s.res).toEqual(res); // no reward, no refund
    expect(s.stats).toEqual(stats);
    // the rest shows the city's own progress
    expect(cityProgress(s, 'recyclerSorter')).toEqual({ value: 211, target: 400 });
    expect(cityProgress(s, 'bench')).toEqual({ value: 6, target: 10 });
  });

  it('0.7.0-alpha.1: 35 catalog objects placed prove the corner pillar only (its few parts made prove nothing)', () => {
    const s = deserialize(FIXTURE_07A1);
    computeDerived(s);
    expect(s.stats.piecesPlaced).toBe(35);
    expect(provenBySave(s)).toEqual(['pillar']);
  });

  it('a save without the newer statistics (0.5) counts them as 0, not as reached', () => {
    const old = JSON.parse(FIXTURE_06);
    delete old.stats.partsMade;
    delete old.stats.catPets;
    delete old.stats.piecesPlaced;
    const s = deserialize(JSON.stringify(old));
    computeDerived(s);
    expect(goalValue(s, 'partsMade')).toBe(0);
    expect(goalValue(s, 'piecesPlaced')).toBe(0);
    expect(provenBySave(s)).toEqual(['planter']);
  });

  it('a save with a finished Spire proves the scrap sculpture', () => {
    const old = JSON.parse(FIXTURE_06);
    old.spireDone = true;
    const s = deserialize(JSON.stringify(old));
    computeDerived(s);
    expect(provenBySave(s)).toContain('sculpture');
  });
});

describe('the profile data: { version: 1, discovered, best }', () => {
  it('reads an empty, a good, a damaged and another version without losing anything it holds', () => {
    expect(parseProfile(null)).toEqual({ profile: emptyProfile(), status: 'empty', version: 0 });
    const good = parseProfile(JSON.stringify({ version: 1, discovered: ['bench', 'tree', 'bench'], best: { pop: 22, built: 7.5, bad: -3, worse: 'x' } }));
    expect(good.status).toBe('ok');
    expect(good.profile.discovered).toEqual(['bench', 'tree']);
    expect(good.profile.best).toEqual({ pop: 22, built: 7.5 });
    expect([...profileUnlocked(good.profile)]).toEqual(['bench', 'tree']);
    expect(profileBest(good.profile, 'built')).toBe(7);
    // cut short (a crash mid-write): every project id in it survives
    const cut = parseProfile('{"version":1,"discovered":["bench","planter","wa');
    expect(cut.status).toBe('damaged');
    expect(cut.profile.discovered).toEqual(['bench', 'planter']);
    // a newer version: what it has in the known shape, unknown keys and ids kept
    const newer = parseProfile(JSON.stringify({ version: 2, discovered: ['bench', 'hoverboard'], best: { pop: 9 }, extra: { a: 1 } }));
    expect(newer.status).toBe('otherVersion');
    expect(newer.version).toBe(2);
    expect(newer.profile.discovered).toEqual(['bench', 'hoverboard']);
    expect(newer.profile.extra).toEqual({ a: 1 });
    expect([...profileUnlocked(newer.profile)]).toEqual(['bench']);
    expect(parseProfile('[1,2]').status).toBe('damaged');
    expect(parseProfile('"bench"').profile.discovered).toEqual(['bench']);
  });

  it('merging only adds: the union of the projects and, per measure, the maximum (never a sum)', () => {
    let p = emptyProfile();
    p = mergeProfile(p, { discovered: ['bench'], best: { pop: 12, partsMade: 260 } });
    // the same city loaded again with the same numbers adds nothing
    p = mergeProfile(p, { discovered: ['bench'], best: { pop: 12, partsMade: 260 } });
    expect(p).toEqual({ version: 1, discovered: ['bench'], best: { pop: 12, partsMade: 260 } });
    // another city with less: the maximum stays; more: it goes up; never 260 + 120
    p = mergeProfile(p, { best: { partsMade: 120, pop: 30 } });
    expect(p.best).toEqual({ pop: 30, partsMade: 260 });
    p = mergeProfile(p, { discovered: ['tree', 'futureThing'], best: { partsMade: Number.NaN } });
    expect(p.discovered).toEqual(['bench', 'tree', 'futureThing']);
    expect(p.best.partsMade).toBe(260);
  });
});
