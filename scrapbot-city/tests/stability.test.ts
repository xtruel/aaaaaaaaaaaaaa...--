// Long-running stability: a full city plays 40 game days at maximum speed, story events answered as they
// come, saved and reloaded every few days. Nothing may turn NaN or negative, nothing may grow without bound,
// and a reload must carry on exactly where the save left off.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BUILDINGS, DAY_LENGTH, MAP_H, MAP_W, SIM_STEP } from '../src/game/defs';
import type { BuildingType } from '../src/game/defs';
import { placeBuilding, placeCheck } from '../src/game/actions';
import { advance, computeDerived } from '../src/game/sim';
import { EVENTS, eventById } from '../src/game/story';
import { createGame, day, deserialize, serialize } from '../src/game/state';
import type { GameState } from '../src/game/state';
import { mulberry32 } from '../src/game/world';

afterEach(() => vi.restoreAllMocks());

function build(s: GameState, plan: BuildingType[]): void {
  const hq = s.buildings.find((b) => b.type === 'hq')!;
  for (const type of plan) {
    let done = false;
    for (let r = 2; r < 20 && !done; r++)
      for (let dy = -r; dy <= r && !done; dy++)
        for (let dx = -r; dx <= r && !done; dx++) if (placeCheck(s, type, hq.x + dx, hq.y + dy).ok && placeBuilding(s, type, hq.x + dx, hq.y + dy)) done = true;
  }
}

function checkInvariants(s: GameState, label: string): void {
  for (const [k, v] of Object.entries(s.res)) {
    expect(Number.isFinite(v), `${label} res.${k} = ${v}`).toBe(true);
    expect(v, `${label} res.${k}`).toBeGreaterThanOrEqual(-1e-6);
  }
  for (const k of ['pop', 'pollution', 'alignment', 'happyMod', 'time', 'waste', 'smog'] as const) expect(Number.isFinite(s[k]), `${label} ${k} = ${s[k]}`).toBe(true);
  const { air, ...derived } = s.derived;
  for (const [k, v] of Object.entries(derived)) expect(Number.isFinite(v), `${label} derived.${k} = ${v}`).toBe(true);
  // the smog breakdown too
  const parts: [string, number][] = [...Object.entries(air.byType), ...Object.entries(air.count), ['sludge', air.sludge], ['renewal', air.renewal]];
  for (const [k, v] of parts) expect(Number.isFinite(v), `${label} derived.air.${k} = ${v}`).toBe(true);
  expect(s.alignment).toBeGreaterThanOrEqual(-100);
  expect(s.alignment).toBeLessThanOrEqual(100);
  expect(s.pollution).toBeGreaterThanOrEqual(0);
  expect(s.res.scrap, `${label} scrap over storage`).toBeLessThanOrEqual(s.derived.storage + 1e-6);
  expect(s.pop, `${label} pop over housing`).toBeLessThanOrEqual(s.derived.housing + 1e-6);
  // bots: as many as the docks allow (a few may still be on their way home to be retired)
  expect(s.bots.length, `${label} bots`).toBeLessThanOrEqual(s.derived.botTarget + 4);
  for (const b of s.bots) {
    expect(Number.isFinite(b.x) && Number.isFinite(b.y), `${label} bot ${b.id} position`).toBe(true);
    expect(b.x >= -64 && b.y >= -64 && b.x <= MAP_W * 16 + 64 && b.y <= MAP_H * 16 + 64, `${label} bot ${b.id} off the map`).toBe(true);
  }
  for (const b of s.buildings) {
    expect(Number.isFinite(b.timer) && Number.isFinite(b.fuel) && Number.isFinite(b.cleanTimer), `${label} ${b.type} ${b.id}`).toBe(true);
    expect(b.built).toBeGreaterThanOrEqual(0);
    expect(b.built).toBeLessThanOrEqual(1);
  }
  // occupancy matches the building list
  let occupied = 0;
  for (let i = 0; i < s.occ.length; i++) if (s.occ[i] >= 0) occupied++;
  const cells = s.buildings.reduce((n, b) => n + BUILDINGS[b.type].w * BUILDINGS[b.type].h, 0);
  expect(occupied, `${label} occupancy`).toBe(cells);
  // claims are counts of bots heading to a tile: never more than there are bots
  let claims = 0;
  for (let i = 0; i < s.claims.length; i++) claims += s.claims[i];
  expect(claims, `${label} claims`).toBeLessThanOrEqual(s.bots.length);
  expect(s.eventsSeen.length).toBeLessThanOrEqual(EVENTS.length);
  expect(new Set(s.eventsSeen).size).toBe(s.eventsSeen.length);
}

// Plays until `toDay`, answering story events with rotating choices, draining what the UI would drain.
function playTo(s: GameState, toDay: number, answer: { n: number }): void {
  let acc = 0;
  let guard = 0;
  while (day(s) < toDay && !s.outcome && guard++ < 2e6) {
    acc = advance(s, acc, 1 / 60, 3);
    if (s.pendingEvent) {
      const ev = eventById(s.pendingEvent)!;
      const open = ev.choices.filter((c) => !c.available || c.available(s));
      const choice = open[answer.n++ % open.length];
      choice.apply(s);
      s.pendingEvent = null;
    }
    // the renderer and HUD consume these every frame
    s.fx.length = 0;
    s.messages.length = 0;
    s.dirtyTiles.length = 0;
  }
}

describe('long-running simulation', () => {
  it('a full city runs 40 days at max speed with saves every 5 days and stays sane', () => {
    const rng = mulberry32(2024);
    vi.spyOn(Math, 'random').mockImplementation(() => rng());
    let s = createGame({ seed: 777, cityName: 'Marathon' });
    s.res.credits = 4000;
    s.res.parts = 600;
    build(s, ['recycler', 'recycler', 'solar', 'solar', 'pods', 'pods', 'dock', 'garden', 'garden', 'fixlab', 'smelter', 'factory', 'purifier', 'pods', 'solar']);
    const answer = { n: 0 };
    const started = performance.now();
    for (let d = 5; d <= 40 && !s.outcome; d += 5) {
      playTo(s, d, answer);
      checkInvariants(s, `day ${day(s)}`);
      // save and carry on from the loaded copy, as a player quitting and coming back would
      const text = serialize(s);
      const copy = deserialize(text);
      expect(serialize(copy), `day ${day(s)} round trip`).toBe(text);
      expect(copy.buildings.length).toBe(s.buildings.length);
      expect(copy.res.credits).toBeCloseTo(s.res.credits, 6);
      s = copy;
      computeDerived(s); // runtime-only, rebuilt by the session when a save is opened
      checkInvariants(s, `day ${day(s)} after load`);
    }
    const ms = performance.now() - started;
    // 40 days = 48 000 steps: a slow simulation would show up here first
    expect(ms, 'simulation time').toBeLessThan(20000);
    expect(s.time).toBeGreaterThanOrEqual(DAY_LENGTH * 35);
    expect(s.stats.built).toBeGreaterThan(0);
    expect(s.stats.scrapCollected).toBeGreaterThan(100);
  }, 60000);

  it('a city left alone with nothing but its HQ does not drift into NaN or negatives', () => {
    const rng = mulberry32(5);
    vi.spyOn(Math, 'random').mockImplementation(() => rng());
    const s = createGame({ seed: 31, cityName: 'Idle' });
    const answer = { n: 1 };
    playTo(s, 25, answer);
    checkInvariants(s, 'idle city');
    expect(Math.round(s.time / SIM_STEP)).toBeGreaterThan(0);
  }, 60000);
});
