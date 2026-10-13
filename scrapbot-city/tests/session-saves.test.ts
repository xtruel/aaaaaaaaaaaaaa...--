// @vitest-environment jsdom
// What leaving a city saves (src/session.ts): during the smog countdown the city's save stays the one from the start
// of the day, which a city lost to smog offers to load again; the training city kept beside the player's free play
// city goes to the slot the player saves it in.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SETTINGS, clock, dialogButtons, handlers, page, pressButton, savedTime } from './session-harness';
import { createGame } from '../src/game/state';
import { GameSession } from '../src/session';
import { closeModal } from '../src/ui/modal';

beforeEach(() => {
  closeModal();
  localStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

// a city on day 2 with its autosave from the start of the day, then the smog countdown running
function smoggy(campaign: boolean) {
  const c = clock();
  const h = handlers();
  const s = createGame({ seed: 42, cityName: 'Smoggy', ...(campaign ? { cityId: 'home' } : {}) });
  const session = new GameSession(page(), s, SETTINGS, h);
  s.time = 60;
  s.pollution = 14;
  session.save();
  s.time = 64.8;
  s.pollution = 98.8;
  s.smog = 21.4;
  return { c, h, s, session };
}

describe('leaving a city during the smog countdown', () => {
  it('free play: the pause menu says the start of the day is kept, and Main menu keeps it', () => {
    const { c, h, s, session } = smoggy(false);
    expect(savedTime('auto')).toBe(60);
    (session as unknown as { openPause(): void }).openPause();
    const leave = dialogButtons().at(-1)!;
    expect(leave).toEqual({ label: 'Main menu', hint: 'smog alarm: the save from the start of the day stays' });
    pressButton(c, 'Main menu');
    expect(h.onExitToMenu).toHaveBeenCalledTimes(1);
    expect(savedTime('auto')).toBe(60);
    // the countdown over (the air cleared and the alarm wound down): Save & main menu saves again
    closeModal();
    s.pollution = 50;
    s.smog = 0;
    s.time = 90;
    (session as unknown as { openPause(): void }).openPause();
    expect(dialogButtons().at(-1)).toEqual({ label: 'Save & main menu', hint: '' });
    pressButton(c, 'Save & main menu');
    expect(savedTime('auto')).toBe(90);
    session.dispose();
  });

  it('campaign: Region map and Main menu keep the save from the start of the day', () => {
    const { c, h, session } = smoggy(true);
    expect(savedTime('city-home')).toBe(60);
    (session as unknown as { openPause(): void }).openPause();
    expect(dialogButtons().filter((b) => b.hint).map((b) => b.hint)).toEqual(['smog alarm: the save from the start of the day stays', 'smog alarm: the save from the start of the day stays']);
    pressButton(c, 'Region map');
    expect(h.onRegionMap).toHaveBeenCalledTimes(1);
    expect(savedTime('city-home')).toBe(60);
    (session as unknown as { openPause(): void }).openPause();
    pressButton(c, 'Main menu');
    expect(savedTime('city-home')).toBe(60);
    session.dispose();
  });
});
