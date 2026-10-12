// @vitest-environment jsdom
// The projects profile in storage (docs/MODULAR-INC2.md §4): key 'projects', versioned JSON through readKey/writeKey
// (so the desktop build writes it as a file Steam Cloud carries); it only grows; a text it cannot take as it is gets a
// backup before the first write over it; the maxima are per city, never summed; a loaded city fills
// GameState.unlocked from it, and what the save or the campaign proves is found (and announced) once.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { PROJECT_KINDS } from '../src/game/projects';
import { computeDerived } from '../src/game/sim';
import { createGame, deserialize, serialize } from '../src/game/state';
import { ProjectTracker, loadProfile, recordProfile, startingProjects } from '../src/profile';

const require = createRequire(import.meta.url);
const { usable } = require('../electron/storage-utils.cjs') as { usable: (key: string, text: string | null) => boolean };
const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE_06 = readFileSync(join(here, 'fixtures/save-0.6.json'), 'utf8');

const KEY = 'scrapbot:projects';
const stored = () => JSON.parse(localStorage.getItem(KEY)!);
const backups = () => Object.keys(localStorage).filter((k) => k.startsWith('scrapbot:backup:projects')).sort();

beforeEach(() => localStorage.clear());

describe('stored profile', () => {
  it('nothing is written until something is found; then { version: 1, discovered, best }', () => {
    expect(loadProfile()).toEqual({ version: 1, discovered: [], best: {} });
    recordProfile({});
    expect(localStorage.getItem(KEY)).toBeNull();
    recordProfile({ discovered: ['bench'], best: { pop: 11 } });
    expect(stored()).toEqual({ version: 1, discovered: ['bench'], best: { pop: 11 } });
  });

  it('it only grows: another writer\'s projects are kept, a maximum never goes down', () => {
    recordProfile({ discovered: ['bench'], best: { pop: 40 } });
    // another window (or the desktop file synced by Steam Cloud) added a project meanwhile
    localStorage.setItem(KEY, JSON.stringify({ version: 1, discovered: ['bench', 'tree'], best: { pop: 40, built: 3 } }));
    recordProfile({ discovered: ['planter'], best: { pop: 12 } });
    expect(stored()).toEqual({ version: 1, discovered: ['bench', 'tree', 'planter'], best: { pop: 40, built: 3 } });
  });

  it('a damaged text is copied aside before it is written over, and the projects in it are kept', () => {
    const cut = '{"version":1,"discovered":["bench","tree"],"best":{"po';
    localStorage.setItem(KEY, cut);
    expect([...loadProfile().discovered]).toEqual(['bench', 'tree']);
    recordProfile({ discovered: ['planter'] });
    expect(backups()).toEqual(['scrapbot:backup:projects:v0']);
    expect(localStorage.getItem('scrapbot:backup:projects:v0')).toBe(cut);
    expect(stored().discovered).toEqual(['bench', 'tree', 'planter']);
    // a second, different damaged text gets a backup of its own: the first one is never overwritten
    const other = '{"discovered":["wall"';
    localStorage.setItem(KEY, other);
    recordProfile({ discovered: ['base'] });
    expect(backups()).toHaveLength(2);
    expect(localStorage.getItem('scrapbot:backup:projects:v0')).toBe(cut);
    expect(Object.values(localStorage).filter((v) => v === other)).toHaveLength(1);
    expect(stored().discovered).toEqual(['wall', 'base']);
  });

  it('a profile of another version is backed up before the first write, its unknown data kept', () => {
    const v2 = JSON.stringify({ version: 2, discovered: ['bench', 'jetpack'], best: { pop: 70 }, seasons: [1] });
    localStorage.setItem(KEY, v2);
    recordProfile({ discovered: ['tree'] });
    expect(localStorage.getItem('scrapbot:backup:projects:v2')).toBe(v2);
    expect(stored()).toEqual({ version: 1, discovered: ['bench', 'jetpack', 'tree'], best: { pop: 70 }, seasons: [1] });
  });

  it('when the backup cannot be written, the old text is left alone', () => {
    localStorage.setItem(KEY, '{"version":3');
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k: string, v: string) {
      if (k.startsWith('scrapbot:backup:')) throw new Error('full');
      return setItem.call(this, k, v);
    };
    try {
      const p = recordProfile({ discovered: ['tree'] });
      expect(p.discovered).toEqual(['tree']); // in memory
    } finally {
      Storage.prototype.setItem = setItem;
    }
    expect(localStorage.getItem(KEY)).toBe('{"version":3');
  });

  it('desktop files: a damaged projects.sav is not trusted, so the previous good copy (.bak) is used', () => {
    expect(usable('projects', '{"version":1,"discovered":[]}')).toBe(true);
    expect(usable('projects', '{"version":1,"disc')).toBe(false);
    expect(usable('backup:projects:v0', '{"version":1')).toBe(false);
  });
});

describe('a city and the profile', () => {
  it('a new city starts with the profile\'s projects (in memory only), campaign or free play', () => {
    recordProfile({ discovered: ['bench', 'statue'] });
    const free = createGame({ seed: 5 });
    computeDerived(free);
    const t1 = new ProjectTracker(free);
    expect([...free.unlocked].sort()).toEqual(['bench', 'statue']);
    expect(t1.foundAtStart).toEqual([]);
    const camp = createGame({ seed: 6, cityId: 'home' });
    computeDerived(camp);
    new ProjectTracker(camp);
    expect([...camp.unlocked].sort()).toEqual(['bench', 'statue']);
    expect(serialize(camp)).not.toMatch(/statue/);
  });

  it('a campaign city whose Spire is done (as the campaign profile records it) proves the sculpture', () => {
    localStorage.setItem('scrapbot:campaign', JSON.stringify({ version: 1, bank: { credits: 0, parts: 0 }, cities: { home: { stars: [true, false, false], spireDone: true, endingKind: 'green' } }, finaleSeen: false }));
    const start = startingProjects();
    expect(start.found).toEqual(['sculpture']);
    expect(stored().discovered).toEqual(['sculpture']);
    // once: the next start finds it in the profile
    expect(startingProjects().found).toEqual([]);
  });

  it('loading a 0.6 save finds what its data proves, once; loading it again adds nothing and sums nothing', () => {
    const load = () => {
      const s = deserialize(FIXTURE_06);
      computeDerived(s);
      return s;
    };
    const s = load();
    const res = { ...s.res };
    const tracker = new ProjectTracker(s);
    expect(tracker.foundAtStart).toEqual(['recyclerMagnet', 'planter']);
    expect(s.res).toEqual(res);
    tracker.flush();
    const first = stored();
    expect(first.discovered).toEqual(['recyclerMagnet', 'planter']);
    expect(first.best).toMatchObject({ partsMade: 211, scrapCollected: 594, pop: 6, built: 6 });
    const again = load();
    const t2 = new ProjectTracker(again);
    t2.flush();
    expect(t2.foundAtStart).toEqual([]);
    expect(stored()).toEqual(first); // the same maxima, not 422 parts
    expect(t2.bestOf('partsMade')).toBe(211);
  });

  it('the maxima are per city: a second city with less keeps the first one\'s best; more raises it', () => {
    const a = createGame({ seed: 1 });
    computeDerived(a);
    const ta = new ProjectTracker(a);
    a.stats.partsMade = 260;
    expect(ta.check(a)).toEqual(['recyclerMagnet']);
    ta.flush();
    const b = createGame({ seed: 2 });
    computeDerived(b);
    const tb = new ProjectTracker(b);
    expect(b.unlocked.has('recyclerMagnet')).toBe(true); // found in city A, so in B from the start
    b.stats.partsMade = 120;
    expect(tb.check(b)).toEqual([]);
    tb.flush();
    expect(stored().best.partsMade).toBe(260); // not 380
    expect(tb.bestOf('partsMade')).toBe(260);
    // 260 + 120 would pass 300, but nothing adds up across cities: the sorter (400) needs 400 in one city
    b.stats.partsMade = 399;
    expect(tb.check(b)).toEqual([]);
    b.stats.partsMade = 400;
    expect(tb.check(b)).toEqual(['recyclerSorter']);
    tb.flush();
    expect(stored().best.partsMade).toBe(400);
  });

  it('a discovery is written at once; it stays when the city that found it is lost or not saved', () => {
    const s = createGame({ seed: 3, tutorial: true });
    computeDerived(s);
    const t = new ProjectTracker(s);
    s.stats.catPets = 3;
    expect(t.check(s)).toEqual(['cathouse']);
    expect(stored().discovered).toEqual(['cathouse']);
    const next = createGame({ seed: 4 });
    computeDerived(next);
    new ProjectTracker(next);
    expect(next.unlocked.has('cathouse')).toBe(true);
  });

  it('all 18 found: the profile lists them all', () => {
    recordProfile({ discovered: PROJECT_KINDS });
    const s = createGame({ seed: 9 });
    computeDerived(s);
    new ProjectTracker(s);
    expect(s.unlocked.size).toBe(18);
  });
});
