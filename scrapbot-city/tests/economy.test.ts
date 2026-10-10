// @vitest-environment jsdom
// Economy edge cases found by the audit: region bank exploits, the path meter, storage after demolition, bots.
import { beforeEach, describe, expect, it } from 'vitest';
import { canTrade, forgetCityTrades, loadCampaign, saveCampaign, sendToBank, withdrawFromBank } from '../src/campaign';
import { demolish, placeBuilding, placeCheck, placeFreeGarden } from '../src/game/actions';
import { SIM_STEP } from '../src/game/defs';
import type { BuildingType } from '../src/game/defs';
import { step } from '../src/game/sim';
import { createGame, deserialize, serialize } from '../src/game/state';
import type { Building, GameState } from '../src/game/state';
import { EVENTS } from '../src/game/story';

beforeEach(() => localStorage.clear());

function placeNear(s: GameState, type: BuildingType): Building {
  const hq = s.buildings.find((b) => b.type === 'hq')!;
  for (let r = 2; r < 16; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) if (placeCheck(s, type, hq.x + dx, hq.y + dy).ok) return placeBuilding(s, type, hq.x + dx, hq.y + dy)!;
  throw new Error(`no room for ${type}`);
}

function rich(cityId: string | null = null): GameState {
  const s = createGame({ seed: 51, cityName: 'Bank', cityId });
  s.res.credits = 5000;
  s.res.parts = 1000;
  return s;
}

describe('region bank', () => {
  it('"Restart this city" takes back what the old run put in the bank (no money printing)', () => {
    const run1 = rich('home');
    sendToBank(run1, 'credits', 1000);
    expect(loadCampaign().bank.credits).toBe(900);
    forgetCityTrades('home'); // the player restarts the city: it gets its starting money again
    expect(loadCampaign().bank.credits).toBe(0);
    const run2 = rich('home');
    sendToBank(run2, 'credits', 500);
    expect(loadCampaign().bank.credits).toBe(450);
  });

  it('money another city already took leaves the bank below zero, and then nothing can be taken', () => {
    const home = rich('home');
    sendToBank(home, 'parts', 100); // 90 arrive
    const rustbay = rich('rustbay');
    expect(withdrawFromBank(rustbay, 'parts', 90)).toBe(90);
    forgetCityTrades('home');
    expect(loadCampaign().bank.parts).toBe(-90);
    expect(withdrawFromBank(rustbay, 'parts', 20)).toBe(0);
  });

  it('a city that took more than it gave owes nothing when restarted', () => {
    const c = loadCampaign();
    c.bank.credits = 300;
    saveCampaign(c);
    const home = rich('home');
    withdrawFromBank(home, 'credits', 200);
    forgetCityTrades('home');
    expect(loadCampaign().bank.credits).toBe(100);
  });

  it('no trades while the city chokes in smog (or after losing to it)', () => {
    const s = rich('home');
    s.smog = 5;
    expect(canTrade(s)).toBe(false);
    expect(sendToBank(s, 'credits', 100)).toBe(0);
    expect(loadCampaign().bank.credits).toBe(0);
    s.smog = 0;
    s.outcome = { kind: 'smog', day: 3 };
    expect(withdrawFromBank(s, 'credits', 100)).toBe(0);
  });
});

describe('path meter', () => {
  it('demolishing gives back only the shift the building really made (at the ±100 limit)', () => {
    const s = rich();
    s.alignment = 98;
    const g = placeNear(s, 'solar'); // green: +4, clamped to +2
    expect(s.alignment).toBe(100);
    expect(g.align).toBe(2);
    g.built = 1;
    demolish(s, g);
    expect(s.alignment).toBe(98);
    s.alignment = -99;
    const f = placeNear(s, 'smelter'); // industrial: -4, clamped to -1
    expect(f.align).toBe(-1);
    demolish(s, f);
    expect(s.alignment).toBe(-99);
  });

  it('a free garden never moved the meter, so demolishing it does not either', () => {
    const s = rich();
    placeNear(s, 'pods');
    s.alignment = 10;
    expect(placeFreeGarden(s)).toBe(true);
    const gift = s.buildings[s.buildings.length - 1];
    expect(gift.align).toBe(0);
    demolish(s, gift);
    expect(s.alignment).toBe(10);
  });

  it('buildings from older saves (no stored shift) still undo the standard shift', () => {
    const s = rich();
    const g = placeNear(s, 'garden');
    const data = JSON.parse(serialize(s));
    for (const b of data.buildings) delete b.align;
    const loaded = deserialize(JSON.stringify(data));
    const before = loaded.alignment;
    demolish(loaded, loaded.buildings.find((b) => b.id === g.id)!);
    expect(loaded.alignment).toBe(before - 4);
  });
});

describe('storage and bots', () => {
  it('demolishing a storage building drops the scrap that no longer fits', () => {
    const s = rich();
    const dock = placeNear(s, 'dock');
    dock.built = 1;
    for (let k = 0; k < 5; k++) step(s, SIM_STEP);
    const full = s.derived.storage;
    s.res.scrap = full;
    demolish(s, dock);
    expect(s.res.scrap).toBeLessThan(full);
    expect(s.res.scrap).toBeLessThanOrEqual(s.derived.storage);
  });

  it('a new Dock launches its own bots, and retiring bots keeps their scrap', () => {
    const s = rich();
    for (let k = 0; k < 5; k++) step(s, SIM_STEP);
    const hqBots = s.bots.length;
    const dock = placeNear(s, 'dock');
    dock.built = 1;
    step(s, SIM_STEP);
    const fromDock = s.bots.slice(hqBots);
    expect(fromDock.length).toBe(2);
    const c = { x: (dock.x + 1) * 16, y: (dock.y + 1) * 16 };
    for (const b of fromDock) expect(Math.hypot(b.x - c.x, b.y - c.y)).toBeLessThan(20);
    // demolish the dock: two bots retire; a loaded one leaves its scrap in storage
    for (const b of s.bots) {
      b.state = 'toDrop';
      b.carry = 6;
    }
    s.res.scrap = 0;
    demolish(s, dock);
    step(s, SIM_STEP);
    expect(s.bots.length).toBe(hqBots);
    expect(s.res.scrap).toBeGreaterThanOrEqual(12);
  });

  it('the thrusters offer comes back until it is bought', () => {
    const ev = EVENTS.find((e) => e.id === 'thrusters')!;
    expect(ev.repeatable).toBe(true);
    const s = rich();
    s.bots = Array.from({ length: 8 }, (_, i) => ({ id: i, x: 0, y: 0, state: 'idle' as const, target: -1, carry: 0, timer: 0, phase: 0, facing: 1 as const }));
    expect(ev.when!(s)).toBe(true);
    s.botSpeedMul = 1.3; // bought
    expect(ev.when!(s)).toBe(false);
  });
});
