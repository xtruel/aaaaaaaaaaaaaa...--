// @vitest-environment jsdom
// The iOS app's copy of the saves in files (src/platform/mirror.ts, src/platform/native.ts), on a fake Filesystem
// plugin that behaves as the shell's (tests/fake-filesystem.ts): every write and removal mirrored through a temporary
// file and a rename; at launch, keys the browser storage lost come back, the newer of two texts wins by the write
// sequence numbers, what is replaced is copied aside first, damaged files are moved aside and nothing is deleted.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGame, serialize } from '../src/game/state';
import { ASIDE, FOLDER, STATE_KEY, SaveMirror, fileName, keyOf, parseEnvelope } from '../src/platform/mirror';
import { PREFIX, removeKey, setKeyMirror, writeKey } from '../src/storage';
import { FakeFilesystem } from './fake-filesystem';

const fileOf = (fs: FakeFilesystem, key: string) => fs.read(`${FOLDER}/${fileName(key)}.json`);
const envOf = (fs: FakeFilesystem, key: string) => parseEnvelope(fileOf(fs, key) ?? '');
const aside = (fs: FakeFilesystem) => fs.list(ASIDE).map((name) => ({ name, text: fs.read(`${ASIDE}/${name}`)! }));
const local = (key: string) => localStorage.getItem(PREFIX + key);
const state = () => JSON.parse(localStorage.getItem(STATE_KEY) ?? 'null') as { next: number; seq: Record<string, number> } | null;

let clock = 1_000_000;
const now = () => clock;

// a mirror as src/storage.ts drives it: the browser storage first, then the mirror
function game(fs: FakeFilesystem) {
  const m = new SaveMirror(fs.call, localStorage, PREFIX, now);
  return {
    m,
    write(key: string, value: string) {
      localStorage.setItem(PREFIX + key, value);
      m.write(key, value);
      clock += 10;
    },
    remove(key: string) {
      localStorage.removeItem(PREFIX + key);
      m.remove(key);
      clock += 10;
    },
  };
}

beforeEach(() => {
  localStorage.clear();
  clock = 1_000_000;
});

afterEach(() => setKeyMirror(null));

describe('file names', () => {
  it('one name per key, letters, digits and - only, and back', () => {
    for (const key of ['settings', 'save:auto', 'meta:city-junkyard', 'backup:save:auto:v2:1x9z', 'campaign-damaged', 'Odd Key_ä€😀']) {
      const name = fileName(key);
      expect(name).toMatch(/^[a-z0-9_-]+$/);
      expect(keyOf(name)).toBe(key);
    }
    expect(fileName('save:auto')).toBe('save_3aauto');
    expect(keyOf('save_3aaut')).toBe('save:aut');
    expect(keyOf('bad_zz')).toBeNull();
    expect(keyOf('Upper')).toBeNull();
  });
});

describe('writes', () => {
  it('every write and removal goes to the key\'s own file, through a temporary file and a rename', async () => {
    const fs = new FakeFilesystem();
    const g = game(fs);
    await g.m.restore();
    const save = serialize(createGame({ seed: 7, cityName: 'Mirror city' }));
    g.write('save:auto', save);
    g.write('meta:auto', '{"city":"Mirror city"}');
    await g.m.flush();
    expect(envOf(fs, 'save:auto')).toMatchObject({ key: 'save:auto', value: save });
    expect(envOf(fs, 'meta:auto')?.value).toBe('{"city":"Mirror city"}');
    expect(fs.list(FOLDER)).toEqual([`${fileName('meta:auto')}.json`, `${fileName('save:auto')}.json`]);
    const forSave = fs.calls.filter((c) => JSON.stringify(c.options).includes(fileName('save:auto')));
    expect(forSave.map((c) => c.method)).toEqual(['writeFile', 'rename']);
    expect(forSave[0].options).toMatchObject({ path: `saves/${fileName('save:auto')}.json.tmp`, directory: 'LIBRARY', encoding: 'utf8', recursive: true });
    expect(forSave[1].options).toMatchObject({ from: `saves/${fileName('save:auto')}.json.tmp`, to: `saves/${fileName('save:auto')}.json`, directory: 'LIBRARY' });
    // the browser storage keeps the numbers of its writes; the files carry the same
    expect(state()?.seq['save:auto']).toBe(envOf(fs, 'save:auto')?.seq);
    expect(envOf(fs, 'meta:auto')!.seq).toBeGreaterThan(envOf(fs, 'save:auto')!.seq);
    g.remove('save:auto');
    await g.m.flush();
    expect(envOf(fs, 'save:auto')).toMatchObject({ key: 'save:auto', removed: true });
    expect(envOf(fs, 'save:auto')?.value).toBeUndefined();
    expect(fs.calls.some((c) => c.method === 'deleteFile' || c.method === 'rmdir')).toBe(false);
  });

  it('writes of one key never overlap; the last one wins', async () => {
    const fs = new FakeFilesystem();
    fs.slow = true;
    const g = game(fs);
    await g.m.restore();
    for (const v of ['a', 'b', 'c', 'd']) g.write('settings', v);
    g.write('last', 'auto');
    await g.m.flush();
    expect(envOf(fs, 'settings')?.value).toBe('d');
    expect(envOf(fs, 'last')?.value).toBe('auto');
    expect(fs.overlaps).toEqual([]);
    // the first went in at once, the middle ones were overtaken by the last
    expect(fs.calls.filter((c) => c.method === 'writeFile' && String(c.options.path).startsWith('saves/settings')).length).toBe(2);
  });

  it('a write that fails is tried again by the next flush (the app going to the background)', async () => {
    const fs = new FakeFilesystem();
    const g = game(fs);
    await g.m.restore();
    fs.failWhen = (method) => method === 'rename';
    g.write('save:1', 'one');
    await g.m.flush();
    expect(fileOf(fs, 'save:1')).toBeUndefined();
    expect(g.m.failedKeys()).toEqual(['save:1']);
    fs.failWhen = null;
    await g.m.flush();
    expect(envOf(fs, 'save:1')?.value).toBe('one');
    expect(g.m.failedKeys()).toEqual([]);
  });

  it('src/storage.ts tells the mirror of every write and removal the browser storage took, and only those', () => {
    const seen: string[] = [];
    setKeyMirror({ write: (k, v) => seen.push(`write ${k}=${v}`), remove: (k) => seen.push(`remove ${k}`) });
    expect(writeKey('tutorial-done', '1')).toBe(true);
    removeKey('tutorial-done');
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(writeKey('save:2', 'x')).toBe(false);
    set.mockRestore();
    expect(seen).toEqual(['write tutorial-done=1', 'remove tutorial-done']);
    setKeyMirror(null);
    writeKey('last', 'auto');
    expect(seen.length).toBe(2);
  });
});

describe('restore at launch', () => {
  it('the browser storage cleared: every key comes back from its file, a removed one does not', async () => {
    const fs = new FakeFilesystem();
    const g = game(fs);
    await g.m.restore();
    const city = serialize(createGame({ seed: 42, cityName: 'Kept' }));
    const keys: Record<string, string> = { settings: '{"lang":"it"}', 'tutorial-done': '1', 'save:auto': city, 'meta:auto': '{"city":"Kept","day":3}', last: 'auto', projects: '{"version":1,"discovered":["garden"],"best":{}}' };
    for (const [k, v] of Object.entries(keys)) g.write(k, v);
    g.write('save:2', 'restarted city');
    g.remove('save:2');
    await g.m.flush();
    localStorage.clear(); // what iOS may do to a web view's website data
    const r = await game(fs).m.restore();
    for (const [k, v] of Object.entries(keys)) expect(local(k)).toBe(v);
    expect(local('save:2')).toBeNull();
    expect(r.restored).toEqual(Object.keys(keys).sort());
    expect(r).toMatchObject({ replaced: [], kept: [], damaged: [], failed: [] });
    // the numbers are back on this side too
    expect(state()?.seq['save:auto']).toBe(envOf(fs, 'save:auto')?.seq);
    expect(aside(fs)).toEqual([]);
  });

  it('nothing to do when both sides agree; a first launch (no folder) restores nothing and mirrors what is there', async () => {
    const fs = new FakeFilesystem();
    localStorage.setItem(PREFIX + 'settings', 'S');
    const g = game(fs);
    const r = await g.m.restore();
    expect(r).toMatchObject({ restored: [], kept: ['settings'] });
    await g.m.flush();
    expect(envOf(fs, 'settings')?.value).toBe('S');
    const writes = fs.calls.filter((c) => c.method === 'writeFile').length;
    const again = await game(fs).m.restore();
    expect(again).toEqual({ restored: [], replaced: [], kept: [], damaged: [], failed: [] });
    expect(fs.calls.filter((c) => c.method === 'writeFile').length).toBe(writes);
  });

  it('both hold it, the file is newer (the browser lost its last write): the browser text is copied aside, then replaced', async () => {
    const fs = new FakeFilesystem();
    const g = game(fs);
    await g.m.restore();
    g.write('save:auto', 'day 3');
    await g.m.flush();
    const old = state()!;
    g.write('save:auto', 'day 4');
    await g.m.flush();
    // the browser storage as it was before its last write
    localStorage.setItem(PREFIX + 'save:auto', 'day 3');
    localStorage.setItem(STATE_KEY, JSON.stringify(old));
    const r = await game(fs).m.restore();
    expect(r.replaced).toEqual(['save:auto']);
    expect(local('save:auto')).toBe('day 4');
    const kept = aside(fs);
    expect(kept.length).toBe(1);
    expect(kept[0].name).toMatch(new RegExp(`^${fileName('save:auto')}\\.local-`));
    expect(parseEnvelope(kept[0].text)).toMatchObject({ key: 'save:auto', value: 'day 3' });
  });

  it('both hold it, the browser is newer (its file write was lost): the file copied aside, then rewritten', async () => {
    const fs = new FakeFilesystem();
    const g = game(fs);
    await g.m.restore();
    g.write('save:auto', 'day 3');
    await g.m.flush();
    fs.failWhen = (method) => method === 'writeFile';
    g.write('save:auto', 'day 4');
    await g.m.flush();
    fs.failWhen = null;
    expect(envOf(fs, 'save:auto')?.value).toBe('day 3');
    const m2 = game(fs).m;
    const r = await m2.restore();
    expect(r.kept).toEqual(['save:auto']);
    expect(local('save:auto')).toBe('day 4');
    await m2.flush();
    expect(envOf(fs, 'save:auto')?.value).toBe('day 4');
    const kept = aside(fs);
    expect(kept.length).toBe(1);
    expect(kept[0].name).toMatch(new RegExp(`^${fileName('save:auto')}\\.file-`));
    expect(parseEnvelope(kept[0].text)?.value).toBe('day 3');
  });

  it('a browser text with no number (its numbers lost) is taken as the newer; the file goes aside', async () => {
    const fs = new FakeFilesystem();
    const g = game(fs);
    await g.m.restore();
    g.write('campaign', 'file text');
    await g.m.flush();
    localStorage.setItem(PREFIX + 'campaign', 'browser text');
    localStorage.removeItem(STATE_KEY);
    const m2 = game(fs).m;
    expect((await m2.restore()).kept).toEqual(['campaign']);
    await m2.flush();
    expect(local('campaign')).toBe('browser text');
    expect(envOf(fs, 'campaign')?.value).toBe('browser text');
    expect(parseEnvelope(aside(fs)[0].text)?.value).toBe('file text');
  });

  it('a copy aside that cannot be written leaves both as they are', async () => {
    const fs = new FakeFilesystem();
    const g = game(fs);
    await g.m.restore();
    g.write('save:auto', 'day 3');
    await g.m.flush();
    const old = state()!;
    g.write('save:auto', 'day 4');
    await g.m.flush();
    localStorage.setItem(PREFIX + 'save:auto', 'day 3');
    localStorage.setItem(STATE_KEY, JSON.stringify(old));
    fs.failWhen = (method, o) => method === 'writeFile' && String(o.path).startsWith(ASIDE);
    const r = await game(fs).m.restore();
    expect(r.failed).toEqual(['save:auto']);
    expect(local('save:auto')).toBe('day 3');
    expect(envOf(fs, 'save:auto')?.value).toBe('day 4');
  });
});

describe('removals', () => {
  it('removed in the browser after its file was written (the file write lost): it stays removed, the text goes aside', async () => {
    const fs = new FakeFilesystem();
    const g = game(fs);
    await g.m.restore();
    g.write('save:city-junk', 'old city');
    await g.m.flush();
    fs.failWhen = () => true;
    g.remove('save:city-junk');
    await g.m.flush();
    fs.failWhen = null;
    expect(envOf(fs, 'save:city-junk')?.value).toBe('old city');
    const m2 = game(fs).m;
    const r = await m2.restore();
    expect(r.kept).toEqual(['save:city-junk']);
    expect(local('save:city-junk')).toBeNull();
    await m2.flush();
    expect(envOf(fs, 'save:city-junk')?.removed).toBe(true);
    expect(parseEnvelope(aside(fs)[0].text)?.value).toBe('old city');
  });

  it('a removal in the file newer than the browser text: the text is copied aside, then removed', async () => {
    const fs = new FakeFilesystem();
    const g = game(fs);
    await g.m.restore();
    g.write('meta:3', 'slot 3');
    await g.m.flush();
    const old = state()!;
    g.remove('meta:3');
    await g.m.flush();
    localStorage.setItem(PREFIX + 'meta:3', 'slot 3');
    localStorage.setItem(STATE_KEY, JSON.stringify(old));
    const r = await game(fs).m.restore();
    expect(r.replaced).toEqual(['meta:3']);
    expect(local('meta:3')).toBeNull();
    expect(parseEnvelope(aside(fs)[0].text)?.value).toBe('slot 3');
  });
});

describe('damaged and unfinished files', () => {
  it('a damaged file is moved aside as it is (never deleted); the browser text, if any, is written again', async () => {
    const fs = new FakeFilesystem();
    const g = game(fs);
    await g.m.restore();
    g.write('save:auto', 'good');
    g.write('save:1', 'one');
    await g.m.flush();
    const cut = fileOf(fs, 'save:auto')!.slice(0, 20);
    fs.files.set(`LIBRARY/${FOLDER}/${fileName('save:auto')}.json`, cut);
    fs.files.set(`LIBRARY/${FOLDER}/${fileName('save:1')}.json`, JSON.stringify({ scrapbot: 'save-mirror', v: 1, key: 'save:2', seq: 5, at: 0, value: 'x' }));
    localStorage.removeItem(PREFIX + 'save:1');
    const m2 = game(fs).m;
    const r = await m2.restore();
    expect(r.damaged).toEqual([`${fileName('save:1')}.json`, `${fileName('save:auto')}.json`]);
    expect(r.kept).toEqual(['save:auto']);
    expect(local('save:auto')).toBe('good');
    expect(local('save:1')).toBeNull();
    await m2.flush();
    expect(envOf(fs, 'save:auto')?.value).toBe('good');
    const moved = aside(fs);
    expect(moved.map((f) => f.text)).toContain(cut);
    expect(moved.every((f) => f.name.includes('.damaged-'))).toBe(true);
    // files that are not the mirror's are left alone
    fs.files.set(`LIBRARY/${FOLDER}/notes.txt`, 'hello');
    fs.files.set(`LIBRARY/${FOLDER}/Upper.json`, 'hello');
    const before = fs.calls.length;
    await game(fs).m.restore();
    expect(fs.calls.slice(before).filter((c) => c.method === 'rename')).toEqual([]);
    expect(fs.read(`${FOLDER}/notes.txt`)).toBe('hello');
  });

  it('an unreadable file is moved aside too', async () => {
    const fs = new FakeFilesystem();
    const g = game(fs);
    await g.m.restore();
    g.write('endings', '["green"]');
    await g.m.flush();
    localStorage.clear();
    fs.failWhen = (method) => method === 'readFile';
    const r = await game(fs).m.restore();
    fs.failWhen = null;
    expect(r.damaged).toEqual([`${fileName('endings')}.json`]);
    expect(local('endings')).toBeNull();
    expect(aside(fs).map((f) => parseEnvelope(f.text)?.value)).toEqual(['["green"]']);
  });

  it('a write cut between its temporary file and the rename: a complete temporary file newer than the file is used', async () => {
    const fs = new FakeFilesystem();
    const g = game(fs);
    await g.m.restore();
    g.write('save:auto', 'day 1');
    await g.m.flush();
    fs.failWhen = (method) => method === 'rename';
    g.write('save:auto', 'day 2');
    await g.m.flush();
    fs.failWhen = null;
    expect(fs.list(FOLDER)).toEqual([`${fileName('save:auto')}.json`, `${fileName('save:auto')}.json.tmp`]);
    localStorage.clear();
    const m2 = game(fs).m;
    const r = await m2.restore();
    expect(r.restored).toEqual(['save:auto']);
    expect(local('save:auto')).toBe('day 2');
    await m2.flush();
    expect(fs.list(FOLDER)).toEqual([`${fileName('save:auto')}.json`]);
    expect(envOf(fs, 'save:auto')?.value).toBe('day 2');
  });

  it('a temporary file cut short is moved aside; the last complete file is used', async () => {
    const fs = new FakeFilesystem();
    const g = game(fs);
    await g.m.restore();
    g.write('save:auto', 'day 1');
    await g.m.flush();
    fs.files.set(`LIBRARY/${FOLDER}/${fileName('save:auto')}.json.tmp`, '{"scrapbot":"save-mirror","v":1,"key":"sa');
    localStorage.clear();
    const r = await game(fs).m.restore();
    expect(r.restored).toEqual(['save:auto']);
    expect(local('save:auto')).toBe('day 1');
    expect(r.damaged).toEqual([`${fileName('save:auto')}.json.tmp`]);
    expect(aside(fs).length).toBe(1);
  });
});

describe('a restore given up', () => {
  it('touches nothing more; the game\'s writes still get numbers, newer than the files at the next launch', async () => {
    const fs = new FakeFilesystem();
    const g = game(fs);
    await g.m.restore();
    g.write('save:auto', 'day 1');
    await g.m.flush();
    const m2 = new SaveMirror(fs.call, localStorage, PREFIX, now);
    m2.abandon();
    const before = fs.calls.length;
    localStorage.setItem(PREFIX + 'save:auto', 'day 2');
    m2.write('save:auto', 'day 2');
    clock += 10;
    await m2.flush();
    expect(fs.calls.length).toBe(before);
    expect(envOf(fs, 'save:auto')?.value).toBe('day 1');
    const r = await game(fs).m.restore();
    expect(r.kept).toEqual(['save:auto']);
    expect(local('save:auto')).toBe('day 2');
  });
});
