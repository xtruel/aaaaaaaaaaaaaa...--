// Production timing: the same game time gives the same production at 1x, 2x and 3x, at any frame rate.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BUILDINGS, SIM_STEP } from '../src/game/defs';
import type { BuildingType } from '../src/game/defs';
import { placeBuilding, placeCheck } from '../src/game/actions';
import { MAX_STEPS_PER_FRAME, advance, step } from '../src/game/sim';
import { createGame } from '../src/game/state';
import type { GameState } from '../src/game/state';
import { mulberry32 } from '../src/game/world';

afterEach(() => vi.restoreAllMocks());

// A small working city with every kind of producer, built through the game's own rules.
function city(): GameState {
  const s = createGame({ seed: 4242, cityName: 'Timing' });
  s.res.credits = 1e5;
  s.res.parts = 1e4;
  s.res.scrap = 400;
  const hq = s.buildings.find((b) => b.type === 'hq')!;
  const plan: BuildingType[] = ['recycler', 'recycler', 'smelter', 'burner', 'solar', 'solar', 'factory', 'fixlab', 'pods', 'pods', 'dock', 'purifier'];
  for (const type of plan) {
    let done = false;
    for (let r = 2; r < 16 && !done; r++)
      for (let dy = -r; dy <= r && !done; dy++)
        for (let dx = -r; dx <= r && !done; dx++) if (placeCheck(s, type, hq.x + dx, hq.y + dy).ok && placeBuilding(s, type, hq.x + dx, hq.y + dy)) done = true;
  }
  for (const b of s.buildings) b.built = 1;
  s.fx.length = 0;
  s.messages.length = 0;
  return s;
}

// Plays `seconds` of game time with frames of `frameDt` real seconds at `speed`; returns every production
// event (game time, text) up to that time, and the number of steps.
function play(speed: number, frameDt: number, seconds: number): { events: string[]; steps: number; time: number } {
  const rng = mulberry32(99);
  vi.spyOn(Math, 'random').mockImplementation(() => rng());
  const s = city();
  s.nextEventAt = 1e9; // no story events: they pause the game for a choice
  s.nextStormAt = 1e9;
  const events: string[] = [];
  let acc = 0;
  let guard = 0;
  while (s.time < seconds && guard++ < 1e6) {
    acc = advance(s, acc, frameDt, speed);
    for (const fx of s.fx) if (fx.kind === 'produce') events.push(`${s.time.toFixed(2)} ${fx.text}`);
    s.fx.length = 0;
    s.messages.length = 0;
  }
  vi.restoreAllMocks();
  return { events: events.filter((e) => Number(e.split(' ')[0]) < seconds - 1), steps: Math.round(s.time / SIM_STEP), time: s.time };
}

describe('production timing', () => {
  it('is identical at 1x, 2x and 3x and at 144, 60, 30 and 10 fps', () => {
    const T = 90;
    const base = play(1, 1 / 60, T);
    expect(base.events.length).toBeGreaterThan(40);
    for (const [speed, fps] of [
      [2, 60],
      [3, 60],
      [3, 30],
      [1, 144],
      [3, 10],
      [2, 4],
    ]) {
      const run = play(speed, 1 / fps, T);
      // the event log can only differ by the timestamp precision of the frame that crossed it
      expect(run.events.map((e) => e.split(' ').slice(1).join(' '))).toEqual(base.events.map((e) => e.split(' ').slice(1).join(' ')));
    }
  });

  it('a recycler finishes a cycle every process.time seconds of game time', () => {
    const p = BUILDINGS.recycler.process!;
    const rng = mulberry32(5);
    vi.spyOn(Math, 'random').mockImplementation(() => rng());
    const s = createGame({ seed: 7, cityName: 'One recycler' });
    s.res.scrap = 300;
    s.res.credits = 1e4;
    const hq = s.buildings.find((b) => b.type === 'hq')!;
    let b = null;
    for (let r = 2; r < 10 && !b; r++) for (let dx = -r; dx <= r && !b; dx++) if (placeCheck(s, 'recycler', hq.x + dx, hq.y + r).ok) b = placeBuilding(s, 'recycler', hq.x + dx, hq.y + r);
    expect(b).not.toBeNull();
    b!.built = 1;
    s.nextEventAt = 1e9;
    s.nextStormAt = 1e9;
    const T = 60;
    let cycles = 0;
    for (let k = 0; k < T / SIM_STEP; k++) {
      step(s, SIM_STEP);
      cycles += s.fx.filter((f) => f.kind === 'produce').length;
      s.fx.length = 0;
    }
    // efficiency can slow it down (power), never speed it up
    expect(cycles).toBeLessThanOrEqual(Math.floor(T / p.time));
    expect(cycles).toBeGreaterThanOrEqual(Math.floor((T / p.time) * 0.5));
  });

  it('max speed with slow frames (0.25 s) loses no game time', () => {
    const s = createGame({ seed: 3, cityName: 'Slow' });
    s.nextEventAt = 1e9;
    s.nextStormAt = 1e9;
    let acc = 0;
    for (let k = 0; k < 40; k++) acc = advance(s, acc, 0.25, 3);
    // 40 frames x 0.25 s x 3 = 30 game seconds, all of them simulated (15 steps per frame, under the cap)
    expect(0.25 * 3).toBeLessThan(MAX_STEPS_PER_FRAME * SIM_STEP);
    expect(s.time).toBeCloseTo(30, 1);
  });
});

describe('Scrap Burner fuel', () => {
  it('never drops power between two loads while there is scrap', () => {
    const rng = mulberry32(8);
    vi.spyOn(Math, 'random').mockImplementation(() => rng());
    const s = createGame({ seed: 12, cityName: 'Burner' });
    s.res.credits = 1e4;
    s.res.parts = 1e3;
    s.res.scrap = 300;
    const hq = s.buildings.find((b) => b.type === 'hq')!;
    let b = null;
    for (let r = 2; r < 10 && !b; r++) for (let dx = -r; dx <= r && !b; dx++) if (placeCheck(s, 'burner', hq.x + dx, hq.y + r).ok) b = placeBuilding(s, 'burner', hq.x + dx, hq.y + r);
    b!.built = 1;
    s.nextEventAt = 1e9;
    s.nextStormAt = 1e9;
    let dropouts = 0;
    for (let k = 0; k < 4000; k++) {
      s.res.scrap = Math.max(s.res.scrap, 100);
      step(s, SIM_STEP);
      if (k > 5 && b!.status !== 'ok') dropouts++;
    }
    expect(dropouts).toBe(0);
  });
});
