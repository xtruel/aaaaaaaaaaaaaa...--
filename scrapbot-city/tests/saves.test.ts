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
