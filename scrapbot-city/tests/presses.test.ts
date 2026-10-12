// The one place for the game's double-press guards (src/ui/presses.ts): its times and distances, the press record
// behind the owner's comfort rules for building (the second press of a double press, double click, double tap or
// A A, is the one within PRESS_GUARD_MS and 10 px (a finger: 24 px) of the press before, the map not moved), and no
// other file with a guard time of its own.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DOUBLE_DIST, DOUBLE_DIST_TOUCH, DOUBLE_PRESS_MS, PRESS_GUARD_MS, forgetPresses, guarded, isDouble, lastPresses, mapPress, markOffMap, markSecond, notePress, rowLaid, secondPress } from '../src/ui/presses';

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

  // The map with a tool in hand, as the session handles a press there (meantPress): note it, judge it, and a second
  // press (refused, or let through to be refused on the same tile) is marked so the next press is measured from the
  // press before it.
  const onMap = (o: { t: number; x: number; y: number; tile: string; touch?: boolean; tool?: string; bulldozer?: boolean }) => {
    notePress({ t: o.t, x: o.x, y: o.y, cam: 'c', tile: o.tile, tool: o.tool ?? 'p:bench', touch: o.touch });
    const [before, now] = lastPresses();
    const v = mapPress(before, now, !!o.bulldozer);
    if (v !== 'meant') markSecond();
    return v;
  };
  // six presses on six neighbouring tiles in a row, `gap` ms and `px` screen px apart: how many are meant (buy)
  const row = (gap: number, px: number, touch: boolean) => {
    forgetPresses();
    let n = 0;
    for (let k = 0; k < 6; k++) if (onMap({ t: 10_000 + k * gap, x: 300 + k * px, y: 400, tile: `${10 + k},5`, touch }) === 'meant') n++;
    return n;
  };

  it('taps on neighbouring tiles closer than a finger\'s reach (zoom 1: 17.9 px) are not swallowed in a chain', () => {
    // zoom 1, a finger: every other tap buys at 300 and 450 ms (the refused one does not stretch the window; it was
    // 1 of 6 when each tap was measured from the refused one before it), all six from 650 ms
    expect(row(300, 17.9, true)).toBe(3);
    expect(row(450, 17.9, true)).toBe(3);
    expect(row(650, 17.9, true)).toBe(6);
    // zoom 2 (35.8 px), and the mouse at zoom 1 (17.9 px is more than its 10 px): all six
    for (const gap of [300, 450, 650]) {
      expect(row(gap, 35.8, true), `zoom 2, ${gap} ms`).toBe(6);
      expect(row(gap, 17.9, false), `mouse, ${gap} ms`).toBe(6);
    }
  });

  it('a double tap never buys twice: across a tile edge the second is refused, on the same tile it can only be refused', () => {
    forgetPresses();
    expect(onMap({ t: 1000, x: 300, y: 400, tile: '10,5', touch: true })).toBe('meant');
    expect(onMap({ t: 1150, x: 306, y: 400, tile: '11,5', touch: true })).toBe('double');
    // a third tap close by, still within the first one's double press: refused too
    expect(onMap({ t: 1300, x: 309, y: 401, tile: '11,5', touch: true })).toBe('double');
    forgetPresses();
    expect(onMap({ t: 1000, x: 300, y: 400, tile: '10,5', touch: true })).toBe('meant');
    expect(onMap({ t: 1200, x: 303, y: 400, tile: '10,5', touch: true })).toBe('again');
    // a slow double click read late (515 ms), A A at the pad's cursor (no movement): the same
    forgetPresses();
    expect(onMap({ t: 1000, x: 300, y: 400, tile: '10,5' })).toBe('meant');
    expect(onMap({ t: 1515, x: 302, y: 400, tile: '11,5' })).toBe('double');
    // the bulldozer: never a second layer, not even on the same tile
    forgetPresses();
    expect(onMap({ t: 1000, x: 300, y: 400, tile: '10,5', tool: 'doze', bulldozer: true })).toBe('meant');
    expect(onMap({ t: 1200, x: 300, y: 400, tile: '10,5', tool: 'doze', bulldozer: true })).toBe('double');
    // another tool in hand between the two presses: two meant presses
    forgetPresses();
    expect(onMap({ t: 1000, x: 300, y: 400, tile: '10,5', tool: 'p:lamp' })).toBe('meant');
    expect(onMap({ t: 1200, x: 300, y: 400, tile: '10,5', tool: 'doze', bulldozer: true })).toBe('meant');
  });

  it('a double click whose second press slips across a tile edge lays no row of two; a row dragged out does', () => {
    // floor or fence in hand, the mouse: the first click lays a floor on 10,5; the second press, 200 ms later on the same
    // spot, slips 6 px onto 11,5 before the release (a row of two tiles, 10,5 and 11,5)
    forgetPresses();
    notePress({ t: 1000, x: 300, y: 400, cam: 'c', tile: '10,5', tool: 'p:floor' });
    notePress({ t: 1200, x: 300, y: 400, cam: 'c', tile: '10,5', tool: 'p:floor' });
    const [before, start] = lastPresses();
    expect(rowLaid(before, start, false)).toBe(false); // that press: on 10,5 it can only be refused
    // dragged out farther than a click's slip (12 px): a row, even right after a click
    expect(rowLaid(before, start, true)).toBe(true);
    // a press of its own (650 ms after the click), or one where the click was not: a row
    expect(rowLaid(before, { ...start, t: 1650 }, false)).toBe(true);
    expect(rowLaid(before, { ...start, x: 330, tile: '11,5' }, false)).toBe(true);
    // the press began on the next tile, close to the click (a double click straddling the edge): not a row either
    expect(rowLaid(before, { ...start, x: 306, tile: '11,5' }, false)).toBe(false);
  });

  it('a press that only closed the smog panel used no tile: the second press of that double press buys nothing', () => {
    forgetPresses();
    notePress({ t: 1000, x: 300, y: 400, cam: 'c', tile: '10,5', tool: 'p:bench', touch: true });
    markOffMap(); // the session: this press closed the smog panel and did nothing else
    expect(onMap({ t: 1250, x: 302, y: 401, tile: '10,5', touch: true })).toBe('double');
    // a press of its own, later, buys
    expect(onMap({ t: 1900, x: 302, y: 401, tile: '10,5', touch: true })).toBe('meant');
  });
});
