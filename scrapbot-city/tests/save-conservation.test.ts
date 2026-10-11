// Owner brief §7 (saves and progression): saving and loading with no simulation step in between keeps
// scrap in storage + scrap carried by the bots + the overflow written explicitly in the save
// (scrapPending). Nothing is created, nothing is lost without a word, and the collection is counted once.
// The old demo lost the bots' load when the store was full: the first test reproduces that case.
// Storage going down (a Dock storage module taken off, a Dock demolished) keeps its explicit rule: the
// scrap above the new capacity is lost, and the confirmation says how much before it happens.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { demolish, placeBuilding, placeCheck } from '../src/game/actions';
import { BOT_CARRY, MAP_H, MAP_W, SIM_STEP } from '../src/game/defs';
import type { BuildingType } from '../src/game/defs';
import { demolishRefund, installModule, removeModule } from '../src/game/pieces';
import { computeDerived, step } from '../src/game/sim';
import { SAVE_VERSION, createGame, deserialize, serialize } from '../src/game/state';
import type { Building, GameState } from '../src/game/state';
import { demolishStorageDrop, moduleStorageDrop, scrapLost } from '../src/ui/catalog';

const FIXTURE_06 = readFileSync(new URL('./fixtures/save-0.6.json', import.meta.url), 'utf8');
const FIXTURE_07A1 = readFileSync(new URL('./fixtures/save-0.7a1.json', import.meta.url), 'utf8');

const carried = (s: GameState) => s.bots.reduce((n, b) => n + b.carry, 0);
const pending = (s: GameState) => (s as { scrapPending?: number }).scrapPending ?? 0;
// all the scrap the city owns: in storage, in the bots' hands, and waiting for room
const owned = (s: GameState) => s.res.scrap + carried(s) + pending(s);
const roundTrip = (s: GameState) => deserialize(serialize(s));

// Bots holding a full load each, waiting (idle) to unload: nothing moves them in the steps a test runs.
function loadBots(s: GameState): void {
  for (const b of s.bots) {
    b.carry = BOT_CARRY;
    b.state = 'idle';
    b.target = -1;
    b.timer = 1e6;
  }
}

// A fresh city with its HQ bots out, each carrying a full load. No events or storms during the test.
function loadedBots(seed: number): GameState {
  const s = createGame({ seed, cityName: 'Carry' });
  s.nextEventAt = 1e9;
  s.nextStormAt = 1e9;
  for (let k = 0; k < 40; k++) step(s, SIM_STEP); // derive storage, launch the bots
  expect(s.bots.length).toBeGreaterThan(0);
  loadBots(s);
  computeDerived(s);
  return s;
}

function build(s: GameState, type: BuildingType): Building {
  const hq = s.buildings[0];
  for (let r = 3; r < 30; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const x = hq.x + dx;
        const y = hq.y + dy;
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
        if (!placeCheck(s, type, x, y).ok) continue;
        const b = placeBuilding(s, type, x, y)!;
        b.built = 1;
        b.status = 'ok';
        computeDerived(s);
        return b;
      }
  throw new Error(`no room for ${type}`);
}

// A city with a Dock (its two bots out too) and money for modules.
function dockCity(seed = 61): { s: GameState; dock: Building } {
  const s = createGame({ seed, cityName: 'Dock' });
  s.nextEventAt = 1e9;
  s.nextStormAt = 1e9;
  s.res.credits = 5000;
  s.res.parts = 1000;
  computeDerived(s);
  const dock = build(s, 'dock');
  for (let k = 0; k < 10; k++) step(s, SIM_STEP);
  expect(s.bots.length).toBe(5); // HQ 3 + Dock 2
  return { s, dock };
}

describe('save + load with a full store (the old demo defect)', () => {
  it('keeps the bots’ load: storage + carry + pending is the same after the round trip', () => {
    const s = loadedBots(21);
    s.res.scrap = s.derived.storage; // full
    const before = owned(s);
    expect(carried(s)).toBe(s.bots.length * BOT_CARRY);
    const loaded = roundTrip(s);
    expect(loaded.bots).toEqual([]); // bots are not saved
    expect(owned(loaded)).toBe(before);
    expect(loaded.res.scrap).toBe(s.derived.storage); // the store stays exactly full
    expect(pending(loaded)).toBe(carried(s)); // the rest is written in the save
    expect(JSON.parse(serialize(s)).scrapPending).toBe(carried(s));
  });

  it('with some room the load fills the store and only the rest waits; with room for all nothing waits', () => {
    const s = loadedBots(22);
    const cap = s.derived.storage;
    const load = carried(s);
    s.res.scrap = cap - 7;
    const some = roundTrip(s);
    expect(some.res.scrap).toBe(cap);
    expect(pending(some)).toBe(load - 7);
    expect(owned(some)).toBe(owned(s));
    s.res.scrap = 10;
    const all = roundTrip(s);
    expect(all.res.scrap).toBe(10 + load);
    expect(pending(all)).toBe(0);
    expect(owned(all)).toBe(owned(s));
  });

  it('saving does not touch the running city (its bots keep their load)', () => {
    const s = loadedBots(23);
    s.res.scrap = s.derived.storage;
    const res = { ...s.res };
    const collected = s.stats.scrapCollected;
    serialize(s);
    expect(s.res).toEqual(res);
    expect(carried(s)).toBe(s.bots.length * BOT_CARRY);
    expect(pending(s)).toBe(0);
    expect(s.stats.scrapCollected).toBe(collected);
  });

  it('a second round trip with no step in between changes nothing (no creation, no loss, no recount)', () => {
    const s = loadedBots(24);
    s.res.scrap = s.derived.storage - 3;
    const first = serialize(s);
    expect(serialize(deserialize(first))).toBe(first);
  });
});

describe('the collection is counted once', () => {
  it('what fits counts in the save; what waits counts when it goes in, as when bots unload', () => {
    const s = loadedBots(25);
    const cap = s.derived.storage;
    s.res.scrap = cap - 4;
    const base = s.stats.scrapCollected;
    const load = carried(s);

    // the running city: make room and let the bots unload
    s.res.scrap = 0;
    for (const b of s.bots) b.timer = 0;
    for (let k = 0; k < 4000 && carried(s) > 0; k++) step(s, SIM_STEP);
    expect(carried(s)).toBe(0);
    const liveCounted = s.stats.scrapCollected - base;
    expect(liveCounted).toBeGreaterThanOrEqual(load); // the bots unloaded (and may have gone for more)

    // the saved city: 4 fit (counted now), the rest waits and counts as it goes in
    const t = loadedBots(25);
    t.res.scrap = cap - 4;
    const loaded = roundTrip(t);
    expect(loaded.stats.scrapCollected).toBe(base + 4);
    expect(pending(loaded)).toBe(load - 4);
    loaded.res.scrap = cap - 6; // room for 6
    step(loaded, SIM_STEP);
    expect(loaded.res.scrap).toBe(cap);
    expect(pending(loaded)).toBe(load - 10);
    expect(loaded.stats.scrapCollected).toBe(base + 4 + 6);
    loaded.res.scrap = 0;
    step(loaded, SIM_STEP);
    expect(pending(loaded)).toBe(0);
    // every scrap the bots carried at the save counted exactly once
    expect(loaded.stats.scrapCollected).toBe(base + load);
    // and a save made right now carries nothing pending twice
    const again = roundTrip(loaded);
    expect(again.stats.scrapCollected).toBe(loaded.stats.scrapCollected);
    expect(pending(again)).toBe(0);
  });

  it('pending scrap waits while the store is full: nothing is created, nothing is lost', () => {
    const s = loadedBots(26);
    s.res.scrap = s.derived.storage;
    const loaded = roundTrip(s);
    const before = owned(loaded);
    const collected = loaded.stats.scrapCollected;
    for (let k = 0; k < 300; k++) step(loaded, SIM_STEP);
    // the HQ-only city uses no scrap: the bots wait (store full) and the pending scrap stays as it is
    expect(owned(loaded)).toBe(before);
    expect(pending(loaded)).toBe(carried(s));
    expect(loaded.stats.scrapCollected).toBe(collected);
  });
});

describe('older saves', () => {
  it('0.6 and 0.7.0-alpha.1 saves load with nothing pending and their scrap as it was; the next save is version 3', () => {
    for (const fixture of [FIXTURE_06, FIXTURE_07A1]) {
      const raw = JSON.parse(fixture);
      expect(raw.version).toBe(2);
      expect(raw.scrapPending).toBeUndefined();
      const s = deserialize(fixture);
      expect(s.scrapPending).toBe(0);
      expect(s.res).toEqual(raw.res);
      expect(s.stats.scrapCollected).toBe(raw.stats.scrapCollected);
      const out = JSON.parse(serialize(s));
      expect(out.version).toBe(SAVE_VERSION);
      expect(SAVE_VERSION).toBe(3);
      expect(out.scrapPending).toBe(0);
      expect(out.res).toEqual(raw.res);
    }
  });

  it('a damaged pending amount is not trusted', () => {
    const base = JSON.parse(serialize(createGame({ seed: 27 })));
    for (const bad of [-5, null, '12', 'x', true, [3], { n: 1 }]) {
      const data = { ...base, scrapPending: bad };
      expect(deserialize(JSON.stringify(data)).scrapPending, String(bad)).toBe(0);
    }
    expect(deserialize(JSON.stringify({ ...base, scrapPending: 12 })).scrapPending).toBe(12);
  });

  it('a version-1 save still loads; versions 0, missing and newer are refused', () => {
    const base = JSON.parse(serialize(createGame({ seed: 28 })));
    expect(deserialize(JSON.stringify({ ...base, version: 1 })).version).toBe(SAVE_VERSION);
    for (const v of [0, undefined, SAVE_VERSION + 1, 2.5, '3']) {
      expect(() => deserialize(JSON.stringify({ ...base, version: v })), String(v)).toThrow(/version/);
    }
  });
});

describe('storage going down: the explicit rule, and the numbers shown are what happens', () => {
  // What the confirmation shows (hud.ts: insp.scrapLost) for a storage drop: the storage left and the scrap lost.
  const shown = (s: GameState, drop: number) => ({ n: Math.max(0, s.derived.storage - drop), lost: scrapLost(s, drop) });

  it('taking the Dock storage module off: the scrap over the smaller store goes, as shown; refund once; bots keep their load', () => {
    const { s, dock } = dockCity();
    expect(installModule(s, 'dockStorage', dock)).toBe(true);
    computeDerived(s);
    loadBots(s);
    s.res.scrap = s.derived.storage; // 330, full
    const warn = shown(s, moduleStorageDrop(dock, 'dockStorage'));
    expect(warn).toEqual({ n: 230, lost: 100 });
    const credits = s.res.credits;
    const parts = s.res.parts;
    const load = carried(s);
    expect(removeModule(s, 'dockStorage', dock)).toEqual({ credits: 15, parts: 7 });
    expect(s.derived.storage).toBe(warn.n);
    expect(330 - s.res.scrap).toBe(warn.lost);
    expect(s.res.credits).toBe(credits + 15);
    expect(s.res.parts).toBe(parts + 7);
    expect(removeModule(s, 'dockStorage', dock)).toBeNull(); // no second refund
    expect(s.res.credits).toBe(credits + 15);
    // the bots' load is not part of the loss: it is still theirs, and a save keeps it (pending)
    expect(carried(s)).toBe(load);
    const loaded = roundTrip(s);
    expect(owned(loaded)).toBe(s.res.scrap + load);
    expect(loaded.buildings.find((b) => b.id === dock.id)!.modules).toBeUndefined();
  });

  it('nothing over the smaller store: nothing is lost and no warning is shown', () => {
    const { s, dock } = dockCity();
    expect(installModule(s, 'dockStorage', dock)).toBe(true);
    computeDerived(s);
    s.res.scrap = 200;
    expect(shown(s, moduleStorageDrop(dock, 'dockStorage')).lost).toBe(0);
    removeModule(s, 'dockStorage', dock);
    expect(s.res.scrap).toBe(200);
  });

  for (const withModule of [false, true]) {
    it(`demolishing a Dock ${withModule ? 'with' : 'without'} its storage module: loss as shown, refund once, no orphan module, the retired bots' load kept`, () => {
      const { s, dock } = dockCity();
      if (withModule) expect(installModule(s, 'dockStorage', dock)).toBe(true);
      computeDerived(s);
      loadBots(s);
      const cap = s.derived.storage;
      expect(cap).toBe(withModule ? 330 : 230);
      s.res.scrap = cap;
      const warn = shown(s, demolishStorageDrop(dock));
      expect(warn).toEqual({ n: 150, lost: cap - 150 });
      const refund = demolishRefund(s, dock);
      expect(refund).toEqual(withModule ? { credits: 35, parts: 12 } : { credits: 20, parts: 5 });
      const credits = s.res.credits;
      const parts = s.res.parts;
      const load = carried(s);
      expect(demolish(s, dock)).toBe(true);
      expect(s.derived.storage).toBe(warn.n);
      expect(cap - s.res.scrap).toBe(warn.lost);
      expect(s.res.credits).toBe(credits + refund.credits!);
      expect(s.res.parts).toBe(parts + refund.parts!);
      // a stale reference: no second refund, and its module cannot be taken off for another one
      expect(demolish(s, dock)).toBe(false);
      expect(removeModule(s, 'dockStorage', dock)).toBeNull();
      expect(s.res.credits).toBe(credits + refund.credits!);
      expect(s.res.parts).toBe(parts + refund.parts!);
      // the Dock's two bots retire at the next step: their load waits for room instead of vanishing
      const stored = s.res.scrap;
      step(s, SIM_STEP);
      expect(s.bots.length).toBe(3);
      expect(s.res.scrap + carried(s) + pending(s)).toBe(stored + load);
      expect(pending(s)).toBe(2 * BOT_CARRY);
      // the save: no module without its building, and the city's scrap all there
      const saved = JSON.parse(serialize(s)) as { buildings: Building[]; scrapPending: number };
      expect(saved.buildings.some((b) => b.id === dock.id)).toBe(false);
      expect(saved.buildings.filter((b) => b.modules)).toEqual([]);
      const loaded = deserialize(JSON.stringify(saved));
      expect(owned(loaded)).toBe(stored + load);
      // room again (a new Dock): the waiting scrap goes in and counts as collected once
      const collected = loaded.stats.scrapCollected;
      loaded.res.credits = 5000;
      computeDerived(loaded);
      build(loaded, 'dock');
      step(loaded, SIM_STEP);
      expect(pending(loaded)).toBe(0);
      expect(loaded.stats.scrapCollected).toBe(collected + saved.scrapPending);
      expect(owned(loaded)).toBe(stored + load);
    });
  }

  it('a module installed, saved and loaded is removed once, with the same numbers as before the save', () => {
    const { s, dock } = dockCity();
    expect(installModule(s, 'dockStorage', dock)).toBe(true);
    computeDerived(s);
    s.res.scrap = 300;
    const loaded = roundTrip(s);
    computeDerived(loaded);
    const ldock = loaded.buildings.find((b) => b.id === dock.id)!;
    expect(ldock.modules).toEqual(['dockStorage']);
    const warn = shown(loaded, moduleStorageDrop(ldock, 'dockStorage'));
    expect(warn).toEqual({ n: 230, lost: 70 });
    const credits = loaded.res.credits;
    expect(removeModule(loaded, 'dockStorage', ldock)).toEqual({ credits: 15, parts: 7 });
    expect(removeModule(loaded, 'dockStorage', ldock)).toBeNull();
    expect(loaded.res.credits).toBe(credits + 15);
    expect(loaded.res.scrap).toBe(230);
    expect(loaded.derived.storage).toBe(230);
  });
});
