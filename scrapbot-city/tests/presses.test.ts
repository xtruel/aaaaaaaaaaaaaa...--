// The press record behind the owner's comfort rules for building (src/ui/presses.ts): the second press of a double
// press (double click, double tap, A A) is the one within 350 ms and 10 px of the press before, the map not moved.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DOUBLE_DIST, DOUBLE_PRESS, forgetPresses, lastPresses, notePress, secondPress } from '../src/ui/presses';

afterEach(() => vi.restoreAllMocks());

describe('presses', () => {
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
    now += DOUBLE_PRESS;
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
});
