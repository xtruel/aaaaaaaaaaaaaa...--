// @vitest-environment jsdom
// Browser storage: slots, metadata and what happens with damaged or newer saves.
import { beforeEach, describe, expect, it } from 'vitest';
import { SAVE_VERSION, createGame } from '../src/game/state';
import { citySlot, loadGame, saveGame, slotMeta } from '../src/storage';

beforeEach(() => localStorage.clear());

describe('slots', () => {
  it('round-trips a city through a slot', () => {
    const s = createGame({ seed: 31, cityName: 'Slot city' });
    s.res.credits = 1234;
    expect(saveGame('2', s)).toBe(true);
    expect(slotMeta('2')?.city).toBe('Slot city');
    expect(loadGame('2')?.res.credits).toBe(1234);
  });

  it('a damaged or newer save does not load, but its slot still shows it exists (so it is never replaced silently)', () => {
    const s = createGame({ seed: 32, cityName: 'Harbor', cityId: 'home' });
    const slot = citySlot('home');
    saveGame(slot, s);
    const raw = JSON.parse(localStorage.getItem('scrapbot:save:city-home')!);
    raw.version = SAVE_VERSION + 1;
    localStorage.setItem('scrapbot:save:city-home', JSON.stringify(raw));
    expect(loadGame(slot)).toBeNull();
    expect(slotMeta(slot)).not.toBeNull();
    localStorage.setItem('scrapbot:save:city-home', '{"version":2,"til');
    expect(loadGame(slot)).toBeNull();
    expect(slotMeta(slot)).not.toBeNull();
  });
});
