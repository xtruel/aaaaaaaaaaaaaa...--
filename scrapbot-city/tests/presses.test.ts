// The one place for the game's double-press guards (src/ui/presses.ts): its times and distances, the press record
// behind the owner's comfort rules for building (the second press of a double press, double click, double tap or
// A A, is the one within PRESS_GUARD_MS and 10 px (a finger: 24 px) of the press before, the map not moved), and no
// other file with a guard time of its own.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DOUBLE_DIST, DOUBLE_DIST_TOUCH, DOUBLE_PRESS_MS, PRESS_GUARD_MS, forgetPresses, guarded, isDouble, lastPresses, notePress, secondPress } from '../src/ui/presses';

afterEach(() => vi.restoreAllMocks());

describe('presses', () => {
  it('one double press for the whole game: 500 ms (Windows), guarded 600 ms (a press read a frame late), 10 px, a finger 24 px', () => {
    expect(DOUBLE_PRESS_MS).toBe(500);
    expect(PRESS_GUARD_MS).toBe(600);
    expect(DOUBLE_DIST).toBe(10);
    expect(DOUBLE_DIST_TOUCH).toBe(24);
    expect(guarded(1000, 1000 + 599)).toBe(true);
    expect(guarded(1000, 1000 + 600)).toBe(false);
    const p = { t: 1000, x: 100, y: 100, cam: 'c', tile: '' };
    expect(isDouble(p, { t: 1515, x: 103, y: 104, cam: 'c' })).toBe(true); // a 500 ms double click read 15 ms late
    expect(isDouble(p, { t: 1600, x: 100, y: 100, cam: 'c' })).toBe(false); // a press of its own
    expect(isDouble(p, { t: 1100, x: 100, y: 100, cam: 'moved' })).toBe(false); // the map moved: another place
    expect(isDouble(p, { t: 1100, x: 118, y: 100, cam: 'c' })).toBe(false); // the mouse 18 px away
    expect(isDouble(p, { t: 1100, x: 118, y: 100, cam: 'c', touch: true })).toBe(true); // a finger 18 px away
  });

  it('every guard reads its time from src/ui/presses.ts: no other source file compares a press with a number of ms', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const n of readdirSync(dir)) {
        const p = join(dir, n);
        if (statSync(p).isDirectory()) walk(p);
        else if (p.endsWith('.ts')) files.push(p);
      }
    };
    walk('src');
    const own: string[] = [];
    for (const f of files) {
      if (f.endsWith(join('ui', 'presses.ts'))) continue;
      const text = readFileSync(f, 'utf8');
      // "performance.now() - x < 400", "now - l.at >= 500": a guard with its own number
      for (const m of text.matchAll(/(performance\.now\(\)|\bnow\b)\s*-\s*[\w.[\]]+\s*[<>]=?\s*\d+/g)) own.push(`${f}: ${m[0]}`);
    }
    // the coin sound's 1.5 s between two coin sounds is not a press guard
    expect(own.filter((l) => !l.includes('lastCoin'))).toEqual([]);
    // the guards themselves: the building panel, the catalog, the dialogs, the click behind a building, the map
    for (const f of ['src/ui/pick.ts', 'src/ui/hud.ts', 'src/ui/modal.ts']) expect(readFileSync(f, 'utf8'), f).toContain("from './presses'");
    expect(readFileSync('src/session.ts', 'utf8')).toContain("from './ui/presses'");
  });

  it('tells the second press of a double press from a meant one', () => {
    let now = 10000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    forgetPresses();
    const at = (x: number, y: number, cam = 'c') => notePress({ t: now, x, y, cam, tile: '' });
    expect(secondPress()).toBe(false);
    at(100, 100);
    expect(secondPress()).toBe(false); // the first press ever
    now += 80;
    at(103, 104);
    expect(secondPress()).toBe(true); // a double click, a few px off
    now += PRESS_GUARD_MS;
    at(103, 104);
    expect(secondPress()).toBe(false); // the same place a moment later
    now += 100;
    at(103 + DOUBLE_DIST, 104);
    expect(secondPress()).toBe(false); // soon, but elsewhere
    now += 100;
    at(103 + DOUBLE_DIST, 104, 'moved');
    expect(secondPress()).toBe(false); // the same screen point, but the map moved: another place
    now += 50;
    at(103 + DOUBLE_DIST, 104, 'moved');
    expect(lastPresses().map((p) => p.t)).toEqual([now - 50, now]);
    expect(secondPress()).toBe(true);
    now += 2000; // a key long after: not a press of the mouse at all
    expect(secondPress()).toBe(false);
    forgetPresses();
    expect(lastPresses().every((p) => p.t === -Infinity)).toBe(true);
  });

  it('a slow double click (up to 500 ms, read a frame late) is one; a finger\'s two taps may land further apart', () => {
    let now = 10000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    forgetPresses();
    const at = (x: number, touch = false) => notePress({ t: now, x, y: 200, cam: 'c', tile: '', touch });
    at(100);
    now += 515;
    at(102);
    expect(secondPress()).toBe(true); // a 500 ms double click, read 15 ms late
    now += 2000;
    at(100);
    now += 120;
    at(118);
    expect(secondPress()).toBe(false); // the mouse 18 px away: another place
    now += 2000;
    at(100, true);
    now += 120;
    at(118, true);
    expect(secondPress()).toBe(true); // a double tap, the second tap 18 px off
    now += 2000;
    at(100, true);
    now += 120;
    at(140, true);
    expect(secondPress()).toBe(false); // a tap 40 px away: meant
  });
});
