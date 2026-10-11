// Owner brief §7, as a property over long random runs (review of the saves fix): a city that keeps collecting,
// with saves and loads at random moments (often with the store full and the bots loaded, sometimes two round
// trips in a row), Docks built and demolished, storage modules put on and taken off.
// - Every scrap taken off the map is counted as collected once, or is still in flight (carried or pending).
// - A save + load with no step in between keeps storage + carried + pending, and the collection count.
// - Scrap is lost only when storage goes down, and exactly as much as the confirmation shows (scrapLost).
// On 3c90dd8 the first save with a full store and loaded bots already breaks these.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { demolish, placeBuilding, placeCheck } from '../src/game/actions';
import { MAP_H, MAP_W, SIM_STEP, T } from '../src/game/defs';
import { installModule, removeModule } from '../src/game/pieces';
import { computeDerived, step } from '../src/game/sim';
import { createGame, deserialize, serialize } from '../src/game/state';
import type { Building, GameState } from '../src/game/state';
import { mulberry32 } from '../src/game/world';
import { demolishStorageDrop, moduleStorageDrop, scrapLost } from '../src/ui/catalog';

afterEach(() => vi.restoreAllMocks());

const carried = (s: GameState) => s.bots.reduce((n, b) => n + b.carry, 0);
const owned = (s: GameState) => s.res.scrap + carried(s) + s.scrapPending;
const inFlightOrCounted = (s: GameState) => s.stats.scrapCollected + carried(s) + s.scrapPending;
const junkLeft = (s: GameState) => {
  let n = 0;
  for (let i = 0; i < s.tiles.length; i++) if (s.tiles[i] === T.JUNK) n += s.amount[i];
  return n;
};

function buildDock(s: GameState, rnd: () => number): Building | null {
  const hq = s.buildings[0];
  for (let tries = 0; tries < 400; tries++) {
    const x = hq.x + Math.floor(rnd() * 21) - 10;
    const y = hq.y + Math.floor(rnd() * 15) - 7;
    if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H || !placeCheck(s, 'dock', x, y).ok) continue;
    const b = placeBuilding(s, 'dock', x, y)!;
    b.built = 1;
    b.status = 'ok';
    computeDerived(s);
    return b;
  }
  return null;
}

describe('random runs: saves, Docks and storage modules', () => {
  const totals = { pending: 0, lost: 0, saves: 0 };
  for (const seed of [3, 11, 29, 47]) {
    it(`seed ${seed}: nothing created, the collection counted once, losses only as shown`, () => {
      const rnd = mulberry32(seed * 7 + 1);
      vi.spyOn(Math, 'random').mockImplementation(mulberry32(seed));
      let s = createGame({ seed, cityName: 'Random' });
      s.nextEventAt = 1e12; // no events or storms: the only junk is the map's own
      s.nextStormAt = 1e12;
      s.res.credits = 1e6;
      s.res.parts = 1e5;
      computeDerived(s);
      const junk0 = junkLeft(s);
      const counted0 = inFlightOrCounted(s);
      for (let k = 0; k < 6000; k++) {
        step(s, SIM_STEP);
        const r = rnd();
        if (r < 0.01) {
          if (rnd() < 0.6) s.res.scrap = s.derived.storage; // often with the store full
          const before = { owned: owned(s), counted: inFlightOrCounted(s), junk: junkLeft(s) };
          const json = serialize(s);
          let t = deserialize(json);
          if (rnd() < 0.3) t = deserialize(serialize(t)); // reloaded twice
          expect(owned(t)).toBe(before.owned);
          expect(inFlightOrCounted(t)).toBe(before.counted);
          expect(junkLeft(t)).toBe(before.junk);
          s = t;
          totals.saves++;
        } else if (r < 0.013) {
          const dock = buildDock(s, rnd);
          if (dock && rnd() < 0.6) installModule(s, 'dockStorage', dock);
        } else if (r < 0.016) {
          const docks = s.buildings.filter((b) => b.type === 'dock');
          if (docks.length) {
            const dock = docks[Math.floor(rnd() * docks.length)];
            computeDerived(s);
            if (rnd() < 0.6) s.res.scrap = s.derived.storage;
            const shown = scrapLost(s, demolishStorageDrop(dock));
            const before = owned(s);
            expect(demolish(s, dock)).toBe(true);
            expect(before - owned(s)).toBe(shown);
            totals.lost += shown;
          }
        } else if (r < 0.018) {
          const withModule = s.buildings.filter((b) => b.modules?.includes('dockStorage'));
          if (withModule.length) {
            const dock = withModule[Math.floor(rnd() * withModule.length)];
            computeDerived(s);
            const shown = scrapLost(s, moduleStorageDrop(dock, 'dockStorage'));
            const before = owned(s);
            expect(removeModule(s, 'dockStorage', dock)).not.toBeNull();
            expect(before - owned(s)).toBe(shown);
            totals.lost += shown;
          }
        } else if (r < 0.03 && rnd() < 0.2) {
          s.res.scrap = Math.floor(s.res.scrap / 3); // a city spending scrap makes room
        }
        totals.pending = Math.max(totals.pending, s.scrapPending);
        expect(inFlightOrCounted(s) - counted0).toBe(junk0 - junkLeft(s));
      }
    });
  }
  it('the runs really went through overflow, losses and many saves', () => {
    expect(totals.pending).toBeGreaterThan(0);
    expect(totals.lost).toBeGreaterThan(0);
    expect(totals.saves).toBeGreaterThan(100);
  });
});
