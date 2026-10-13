// @vitest-environment jsdom
// Owner brief §7: a backup before any migration. A save written by another version (0.6 and 0.7.0-alpha.1
// wrote version 2; no version or a damaged file counts as 0) is copied aside once, as it was, before this
// version first overwrites it, in the browser storage and in the desktop files alike; a second, different city of
// that version in the same slot gets a backup of its own. Backups are never removed.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SAVE_VERSION, createGame, deserialize } from '../src/game/state';
import { backupKey, citySlot, clearSlot, fingerprint, lastPlayed, loadGame, saveGame, saveVersionOf, slotMeta } from '../src/storage';
import type { SlotId } from '../src/storage';

const require = createRequire(import.meta.url);
const { usable } = require('../electron/storage-utils.cjs') as { usable: (key: string, text: string | null) => boolean };

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE_06 = readFileSync(join(here, 'fixtures/save-0.6.json'), 'utf8');
const FIXTURE_07A1 = readFileSync(join(here, 'fixtures/save-0.7a1.json'), 'utf8');
const META_06 = JSON.stringify({ city: 'Old Town', day: 4, alignment: 4, pop: 6, savedAt: 1 });

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

const ls = (key: string) => localStorage.getItem(`scrapbot:${key}`);
const backups = () => Object.keys(localStorage).filter((k) => k.startsWith('scrapbot:backup:')).sort();

// An old save in a slot, as an older version of the game left it.
function plant(slot: SlotId, raw: string, meta = META_06): void {
  localStorage.setItem(`scrapbot:save:${slot}`, raw);
  localStorage.setItem(`scrapbot:meta:${slot}`, meta);
}

describe('backup before the first overwrite', () => {
  it('a 0.6 autosave: loads, and the first save keeps the original text aside (once)', () => {
    plant('auto', FIXTURE_06);
    expect(saveVersionOf(FIXTURE_06)).toBe(2);
    const s = loadGame('auto')!;
    expect(s.cityName).toBe('Old Town');
    expect(backups()).toEqual([]); // loading alone writes nothing
    expect(saveGame('auto', s)).toBe(true);
    expect(ls(backupKey('auto', 2))).toBe(FIXTURE_06);
    expect(ls('backup:meta:auto:v2')).toBe(META_06);
    expect(saveVersionOf(ls('save:auto')!)).toBe(SAVE_VERSION);
    // later saves leave the backup alone and add none
    s.res.credits += 100;
    expect(saveGame('auto', s)).toBe(true);
    expect(saveGame('auto', s)).toBe(true);
    expect(backups()).toEqual(['scrapbot:backup:meta:auto:v2', 'scrapbot:backup:save:auto:v2']);
    expect(ls(backupKey('auto', 2))).toBe(FIXTURE_06);
    // the backup is the old city exactly, and still loads
    expect(deserialize(ls(backupKey('auto', 2))!).res).toEqual(JSON.parse(FIXTURE_06).res);
    // backups are not slots: Continue and the slot list do not see them
    expect(lastPlayed()).toBe('auto');
    expect(slotMeta('auto')!.city).toBe('Old Town');
  });

  it('manual slots and campaign city slots too, each with its own backup', () => {
    plant('2', FIXTURE_07A1);
    plant(citySlot('home'), FIXTURE_06);
    expect(saveGame('2', loadGame('2')!)).toBe(true);
    expect(saveGame(citySlot('home'), loadGame(citySlot('home'))!)).toBe(true);
    expect(ls(backupKey('2', 2))).toBe(FIXTURE_07A1);
    expect(ls(backupKey(citySlot('home'), 2))).toBe(FIXTURE_06);
    expect(ls(backupKey('auto', 2))).toBeNull();
  });

  it('a save of this version is overwritten without a backup', () => {
    const s = createGame({ seed: 41, cityName: 'New' });
    expect(saveGame('1', s)).toBe(true);
    expect(saveGame('1', s)).toBe(true);
    expect(backups()).toEqual([]);
  });

  it('a slot written over by a new city (after the player said yes) still keeps the old one aside', () => {
    plant('auto', FIXTURE_07A1);
    expect(saveGame('auto', createGame({ seed: 42, cityName: 'Fresh' }))).toBe(true);
    expect(ls(backupKey('auto', 2))).toBe(FIXTURE_07A1);
    expect(loadGame('auto')!.cityName).toBe('Fresh');
  });

  it('no version, a damaged file or a newer version: kept aside as they are (v0, v0, v4)', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {}); // loadGame says why each one does not load
    const noVersion = JSON.stringify({ ...JSON.parse(FIXTURE_06), version: undefined });
    plant('1', noVersion);
    plant('2', '{"version":2,"til');
    const newer = JSON.stringify({ ...JSON.parse(FIXTURE_06), version: SAVE_VERSION + 1 });
    plant('3', newer);
    for (const slot of ['1', '2', '3'] as const) {
      expect(loadGame(slot)).toBeNull(); // none of them loads
      expect(saveGame(slot, createGame({ seed: 43 }))).toBe(true);
    }
    expect(ls(backupKey('1', 0))).toBe(noVersion);
    expect(ls(backupKey('2', 0))).toBe('{"version":2,"til');
    expect(ls(backupKey('3', SAVE_VERSION + 1))).toBe(newer);
  });

  it('a backup that cannot be written leaves the old save alone (the save reports failure)', () => {
    plant('auto', FIXTURE_06);
    const s = loadGame('auto')!;
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key.startsWith('scrapbot:backup:')) throw new Error('QuotaExceededError');
      return setItem.call(this, key, value);
    });
    expect(saveGame('auto', s)).toBe(false);
    expect(ls('save:auto')).toBe(FIXTURE_06);
    expect(ls('meta:auto')).toBe(META_06);
    vi.restoreAllMocks();
    expect(saveGame('auto', s)).toBe(true);
    expect(ls(backupKey('auto', 2))).toBe(FIXTURE_06);
  });

  it('a second, different city of the same old version in the same slot gets a backup of its own', () => {
    // 0.7.0-alpha.1 (a Steam beta branch) saved AlphaOne in slot 1; this version loaded and saved it
    const one = JSON.stringify({ ...JSON.parse(FIXTURE_07A1), cityName: 'AlphaOne' });
    const metaOne = JSON.stringify({ city: 'AlphaOne', day: 3, alignment: 0, pop: 2, savedAt: 1 });
    plant('1', one, metaOne);
    expect(saveGame('1', loadGame('1')!)).toBe(true);
    expect(ls(backupKey('1', 2))).toBe(one);
    // back on alpha, AlphaTwo saved in the same slot; then this version again
    const two = JSON.stringify({ ...JSON.parse(FIXTURE_07A1), cityName: 'AlphaTwo', time: 777 });
    const metaTwo = JSON.stringify({ city: 'AlphaTwo', day: 13, alignment: 0, pop: 5, savedAt: 2 });
    plant('1', two, metaTwo);
    expect(saveGame('1', loadGame('1')!)).toBe(true);
    expect(ls(backupKey('1', 2))).toBe(one);
    expect(ls(`${backupKey('1', 2)}:${fingerprint(two)}`)).toBe(two);
    expect(ls(`backup:meta:1:v2:${fingerprint(two)}`)).toBe(metaTwo);
    expect(ls('backup:meta:1:v2')).toBe(metaOne);
    // saved again, or the same text again: no third copy
    expect(saveGame('1', loadGame('1')!)).toBe(true);
    plant('1', two, metaTwo);
    expect(saveGame('1', loadGame('1')!)).toBe(true);
    expect(backups()).toHaveLength(4);
  });

  it('restarting or clearing a slot never removes its backup', () => {
    plant(citySlot('home'), FIXTURE_06);
    expect(saveGame(citySlot('home'), loadGame(citySlot('home'))!)).toBe(true);
    clearSlot(citySlot('home'));
    expect(slotMeta(citySlot('home'))).toBeNull();
    expect(ls(backupKey(citySlot('home'), 2))).toBe(FIXTURE_06);
  });
});

describe('desktop files (Electron, Steam Cloud)', () => {
  it('the backup goes through the same file store as the saves, never the browser storage', async () => {
    const files = new Map<string, string>();
    const store = {
      get: (k: string) => files.get(k) ?? null,
      set: (k: string, v: string) => (files.set(k, v), true),
      remove: (k: string) => void files.delete(k),
    };
    (window as unknown as { scrapbotDesktop?: unknown }).scrapbotDesktop = { storage: store };
    vi.resetModules();
    try {
      const desk = await import('../src/storage');
      files.set('save:auto', FIXTURE_06);
      files.set('meta:auto', META_06);
      const s = desk.loadGame('auto')!;
      expect(s.cityName).toBe('Old Town');
      expect(desk.saveGame('auto', s)).toBe(true);
      expect(files.get('backup:save:auto:v2')).toBe(FIXTURE_06);
      expect(files.get('backup:meta:auto:v2')).toBe(META_06);
      expect(saveVersionOf(files.get('save:auto')!)).toBe(SAVE_VERSION);
      expect(Object.keys(localStorage)).toEqual([]);
    } finally {
      delete (window as unknown as { scrapbotDesktop?: unknown }).scrapbotDesktop;
      vi.resetModules();
    }
  });

  it('the desktop store treats backups as JSON (a damaged one falls back to its .bak copy)', () => {
    expect(usable('backup:save:auto:v2', FIXTURE_06)).toBe(true);
    expect(usable('backup:save:auto:v2', '{"version":2,"til')).toBe(false);
    expect(usable('backup:meta:auto:v2', META_06)).toBe(true);
  });
});
