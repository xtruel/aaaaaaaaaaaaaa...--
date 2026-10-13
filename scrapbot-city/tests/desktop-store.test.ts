// @vitest-environment jsdom
// The desktop build's saves as files (electron/file-store.cjs, the store electron/main.cjs serves to the page): a
// damaged file is read as its .bak (the copy before the last write), and is first copied aside as it is
// (<file>.damaged-<n>), never overwritten: what it held is never lost. The projects profile adds the projects that can
// be read from a damaged projects.sav to its .bak, so the latest discovery is not locked again (as the browser build's
// salvage does), and keeps the damaged text as a backup before writing over it. Simulated: the store runs in Node on a
// temporary folder, the page's storage.ts reaches it through a stand-in for preload.cjs's bridge; not Electron itself.
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
interface Store {
  fileFor(key: string): string;
  get(key: string): string | null;
  getDamaged(key: string): string | null;
  set(key: string, value: string): boolean;
  remove(key: string): boolean;
}
const { createFileStore } = require('../electron/file-store.cjs') as { createFileStore: (dir: () => string) => Store };

let dir = '';
let store: Store;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'scrapbot-saves-'));
  store = createFileStore(() => dir);
  localStorage.clear();
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  delete (window as unknown as { scrapbotDesktop?: unknown }).scrapbotDesktop;
  vi.resetModules();
});

const profile = (ids: string[]) => JSON.stringify({ version: 1, discovered: ids, best: { pop: 12 } });
const files = () => readdirSync(dir).sort();
// a file cut short outside the game (a crash of the disk, a sync gone wrong)
const cut = (key: string, after: string) => {
  const text = readFileSync(store.fileFor(key), 'utf8');
  const damaged = text.slice(0, text.indexOf(after) + after.length);
  writeFileSync(store.fileFor(key), damaged);
  return damaged;
};

describe('desktop file store', () => {
  it('a damaged file is read as its .bak, and is kept aside first, once, never overwritten', () => {
    store.set('projects', profile(['bench']));
    store.set('projects', profile(['bench', 'planter']));
    store.set('projects', profile(['bench', 'planter', 'tree']));
    const damaged = cut('projects', '"tree"');
    expect(store.get('projects')).toBe(profile(['bench', 'planter']));
    expect(store.getDamaged('projects')).toBe(damaged);
    // read again and again (the game reads often): one copy
    store.get('projects');
    store.get('projects');
    expect(files()).toEqual(['projects.sav', 'projects.sav.bak', 'projects.sav.damaged-1']);
    expect(readFileSync(join(dir, 'projects.sav.damaged-1'), 'utf8')).toBe(damaged);
    // the next write replaces the main file; the good .bak and the damaged copy stay
    store.set('projects', profile(['bench', 'planter', 'tree', 'wall']));
    expect(store.getDamaged('projects')).toBeNull();
    expect(readFileSync(join(dir, 'projects.sav.bak'), 'utf8')).toBe(profile(['bench', 'planter']));
    expect(readFileSync(join(dir, 'projects.sav.damaged-1'), 'utf8')).toBe(damaged);
    // another damaged text later: a copy of its own
    const again = cut('projects', '"wall"');
    store.get('projects');
    expect(readFileSync(join(dir, 'projects.sav.damaged-2'), 'utf8')).toBe(again);
    expect(readFileSync(join(dir, 'projects.sav.damaged-1'), 'utf8')).toBe(damaged);
  });

  it('a save and the campaign alike: the damaged text is kept before the .bak is played on', () => {
    store.set('save:auto', JSON.stringify({ version: 3, time: 240 }));
    store.set('save:auto', JSON.stringify({ version: 3, time: 480 }));
    const damaged = cut('save:auto', '"time"');
    expect(store.get('save:auto')).toBe(JSON.stringify({ version: 3, time: 240 }));
    expect(readFileSync(join(dir, 'save_auto.sav.damaged-1'), 'utf8')).toBe(damaged);
    store.set('campaign', JSON.stringify({ bank: { credits: 0 } }));
    store.set('campaign', JSON.stringify({ bank: { credits: 450 } }));
    const camp = cut('campaign', '"credits"');
    store.get('campaign');
    expect(readFileSync(join(dir, 'campaign.sav.damaged-1'), 'utf8')).toBe(camp);
    // a damaged file with no good .bak is given as it is (the game's own salvage and backups take it from there)
    writeFileSync(store.fileFor('endings'), '["gre');
    expect(store.get('endings')).toBe('["gre');
    expect(files().filter((f) => f.startsWith('endings'))).toEqual(['endings.sav']);
  });

  it('the projects profile keeps what the damaged projects.sav proves: the latest discovery is not locked again', async () => {
    (window as unknown as { scrapbotDesktop?: unknown }).scrapbotDesktop = { storage: store };
    vi.resetModules();
    const { loadProfile, recordProfile } = await import('../src/profile');
    recordProfile({ discovered: ['bench'], best: { pop: 12 } });
    recordProfile({ discovered: ['planter'] });
    recordProfile({ discovered: ['tree'] });
    const damaged = cut('projects', '"tree"');
    expect([...loadProfile().discovered]).toEqual(['bench', 'planter', 'tree']);
    // the maxima of the .bak are kept too
    expect(loadProfile().best).toEqual({ pop: 12 });
    // the next write (a city saved, a maximum raised): all three, and the damaged text kept as a backup
    recordProfile({ best: { pop: 13 } });
    expect(JSON.parse(store.get('projects')!)).toEqual({ version: 1, discovered: ['bench', 'planter', 'tree'], best: { pop: 13 } });
    expect(store.get('backup:projects:v0')).toBe(damaged);
    expect(Object.keys(localStorage)).toEqual([]);
  });
});
