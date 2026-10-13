// @vitest-environment jsdom
// The region map's "Restart this city" asks "Yes, start over" in the same place: the second press of a double click,
// a double tap or A A on Restart (any input: no city keeps a record of presses here) must not erase the city's save;
// a press of its own, after the guard (src/ui/presses.ts), starts it over as designed.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PRESS_GUARD_MS } from '../src/ui/presses';
import { RegionMap } from '../src/ui/region';

// jsdom has no canvas, images or audio: the pictures and the sounds are not what is tested here
vi.mock('../src/render/icons', () => ({ iconUrl: () => '', buildingThumb: () => '', portraitUrl: () => '' }));
vi.mock('../src/render/regionBg', () => ({ paintRegion: () => {} }));
vi.mock('../src/audio', () => ({ audio: { play: () => {} } }));

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '<section id="region" hidden></section><div id="modal-root"></div>';
  // Scrapbot City saved on day 9
  localStorage.setItem('scrapbot:save:city-home', JSON.stringify({ version: 3, time: 500 }));
  localStorage.setItem('scrapbot:meta:city-home', JSON.stringify({ city: 'Scrapbot City', day: 9, alignment: 0, pop: 12, savedAt: 1 }));
});

afterEach(() => vi.restoreAllMocks());

describe('region map', () => {
  it('a double press on Restart this city does not confirm the restart; a press of its own does', () => {
    let now = 20_000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const onPlay = vi.fn();
    const map = new RegionMap(document.getElementById('region')!, { onPlay, onBack: () => {} });
    map.show();
    const q = (sel: string) => document.querySelector<HTMLButtonElement>(`#region ${sel}`);
    for (const gap of [120, 300, 500, 550]) {
      q('[data-restart]')!.click();
      expect(q('[data-restart-yes]')).not.toBeNull();
      // the confirmation took the focus where Restart was: the second click, tap or A lands on it
      now += gap;
      q('[data-restart-yes]')!.click();
      expect(onPlay).not.toHaveBeenCalled();
      // back to the city's panel (another city picked and this one again)
      q('[data-city="home"]')!.click();
      now += 1000;
    }
    q('[data-restart]')!.click();
    now += PRESS_GUARD_MS;
    q('[data-restart-yes]')!.click();
    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(onPlay.mock.calls[0][1]).toBe(true);
    map.hide();
  });
});
