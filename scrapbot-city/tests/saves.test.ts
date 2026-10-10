// Save safety: what gets written automatically, and what the desktop storage trusts.
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { SIM_STEP, SMOG_DANGER } from '../src/game/defs';
import { step } from '../src/game/sim';
import { canAutosave, createGame, deserialize, serialize } from '../src/game/state';

const require = createRequire(import.meta.url);
const { usable } = require('../electron/storage-utils.cjs') as { usable: (key: string, text: string | null) => boolean };

describe('autosave during a smog countdown', () => {
  it('is skipped while the countdown runs and allowed again once the air is clean', () => {
    const s = createGame({ seed: 11, cityName: 'Test' });
    expect(canAutosave(s)).toBe(true);
    s.pollution = 100;
    s.mods.decay = 0;
    for (let k = 0; k < 20; k++) step(s, SIM_STEP);
    expect(s.pollution).toBeGreaterThanOrEqual(SMOG_DANGER);
    expect(s.smog).toBeGreaterThan(0);
    expect(canAutosave(s)).toBe(false);
    // a save written now would bring back the countdown on retry
    const copy = deserialize(serialize(s));
    expect(copy.smog).toBeGreaterThan(0);
    // clean air: the countdown winds down (at half speed), then automatic saves resume
    s.pollution = 10;
    step(s, SIM_STEP);
    expect(canAutosave(s)).toBe(false);
    for (let k = 0; k < 2000 && s.smog > 0; k++) {
      s.pollution = 10;
      step(s, SIM_STEP);
    }
    expect(s.smog).toBe(0);
    expect(canAutosave(s)).toBe(true);
  });
});

describe('desktop storage', () => {
  it('trusts only JSON for saves, slot info, campaign and settings', () => {
    expect(usable('save:auto', '{"version":2}')).toBe(true);
    expect(usable('save:auto', '{"version":2,"til')).toBe(false); // cut short
    expect(usable('campaign', '\u0000\u0000\u0000')).toBe(false);
    expect(usable('meta:city-home', '')).toBe(false);
    expect(usable('settings', null)).toBe(false);
    // plain values are fine as they are
    expect(usable('last', 'city-home')).toBe(true);
    expect(usable('tutorial-done', '1')).toBe(true);
  });
});

describe('save contents', () => {
  it('scrap carried by bots goes into storage instead of vanishing (as far as it fits)', () => {
    const s = createGame({ seed: 21, cityName: 'Carry' });
    for (let k = 0; k < 40; k++) step(s, SIM_STEP); // derive storage, spawn bots
    expect(s.bots.length).toBeGreaterThan(0);
    s.res.scrap = 10;
    for (const b of s.bots) b.carry = 5;
    const carried = s.bots.length * 5;
    const room = s.derived.storage - s.res.scrap;
    const loaded = deserialize(serialize(s));
    expect(loaded.res.scrap).toBe(10 + Math.min(carried, room));
    // a full store keeps what it has
    s.res.scrap = s.derived.storage;
    expect(deserialize(serialize(s)).res.scrap).toBe(s.derived.storage);
  });

  it('remembers the last hint shown (asking again the same day stays free after a load)', () => {
    const s = createGame({ seed: 22, cityName: 'Hint' });
    s.hints.lastTitle = 'Build a Recycler';
    s.hints.lastDay = 3;
    const loaded = deserialize(serialize(s));
    expect(loaded.hints.lastTitle).toBe('Build a Recycler');
    expect(loaded.hints.lastDay).toBe(3);
  });

  it('loads saves from before the hint memory existed, with defaults', () => {
    const s = createGame({ seed: 23, cityName: 'Old' });
    const data = JSON.parse(serialize(s));
    delete data.hints.lastTitle;
    delete data.hints.lastDay;
    delete data.eventLast;
    delete data.warnedEmptyAt;
    const loaded = deserialize(JSON.stringify(data));
    expect(loaded.hints.lastTitle).toBe('');
    expect(loaded.hints.lastDay).toBe(0);
    expect(loaded.eventLast).toEqual({});
  });

  it('refuses a save from a newer version instead of guessing', () => {
    const s = createGame({ seed: 24, cityName: 'Future' });
    const data = JSON.parse(serialize(s));
    data.version = 3;
    expect(() => deserialize(JSON.stringify(data))).toThrow(/version/);
  });
});
