import { describe, expect, it } from 'vitest';
import { SIM_STEP } from '../src/game/defs';
import { step } from '../src/game/sim';
import { createGame, day } from '../src/game/state';

describe('smoke', () => {
  it('a new city runs a whole day without errors', () => {
    const s = createGame({ seed: 1 });
    for (let i = 0; i < 61 / SIM_STEP; i++) step(s, SIM_STEP);
    expect(day(s)).toBe(2);
    expect(s.res.credits).toBeGreaterThan(0);
  });
});
