// @vitest-environment jsdom
// The smog panel in the HUD (0.7, increment 2, G0): the smog meter opens it, a click anywhere else, its × or
// closeSmog (Esc, B) closes it, and it shows the sim's own breakdown and the 95% rule, with the countdown while it
// runs. The meter keeps its bar, number and arrow, and the alarm stays.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { placeBuilding, placeCheck } from '../src/game/actions';
import { SIM_STEP } from '../src/game/defs';
import type { BuildingType } from '../src/game/defs';
import { computeDerived, step } from '../src/game/sim';
import { createGame } from '../src/game/state';
import type { GameState } from '../src/game/state';
import { setLang } from '../src/i18n';
import { Hud } from '../src/ui/hud';
import type { HudHandlers, HudView } from '../src/ui/hud';
import { airReport, perDayText } from '../src/ui/smog';

// jsdom has no canvas, images or audio: the pictures and the sounds are not what is tested here
vi.mock('../src/render/icons', () => ({ iconUrl: () => '', toolThumb: () => '', portraitUrl: () => '', pathColor: () => 'var(--muted)' }));
vi.mock('../src/render/iso/atlas', () => ({ atlasImage: () => null, frame: () => undefined }));
vi.mock('../src/render/sprites', () => ({
  PAL: { ink: '#000', orange: '#f80', white: '#fff' },
  makeCanvas: () => [{ toDataURL: () => 'data:,' }, { fillRect: () => {}, drawImage: () => {}, fillStyle: '' }],
}));
vi.mock('../src/audio', () => ({ audio: { play: () => {} } }));

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView = () => {};
});

function smoggyCity(): GameState {
  const s = createGame({ seed: 71, cityName: 'Smog' });
  s.res.credits = 1e5;
  s.res.parts = 1e4;
  s.nextEventAt = 1e9;
  s.nextStormAt = 1e9;
  const hq = s.buildings[0];
  for (const type of ['solar', 'solar', 'smelter', 'burner', 'factory', 'purifier', 'garden'] as BuildingType[]) {
    let done = false;
    for (let r = 3; r < 30 && !done; r++)
      for (let dy = -r; dy <= r && !done; dy++)
        for (let dx = -r; dx <= r && !done; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !placeCheck(s, type, hq.x + dx, hq.y + dy).ok) continue;
          placeBuilding(s, type, hq.x + dx, hq.y + dy)!.built = 1;
          done = true;
        }
  }
  s.pollution = 62;
  for (let k = 0; k < 100; k++) {
    s.res.scrap = Math.max(s.res.scrap, 50);
    step(s, SIM_STEP);
  }
  computeDerived(s);
  return s;
}

function setup(s = smoggyCity()) {
  document.body.innerHTML = '<div class="hud"></div><div class="elsewhere"></div>';
  const handlers = new Proxy({}, { get: () => () => {} }) as HudHandlers;
  const root = document.querySelector<HTMLElement>('.hud')!;
  const hud = new Hud(root, handlers, s);
  const view: HudView = { speed: 1, build: null, bulldoze: false, selectedId: -1, goalCard: true, piece: null, catalog: false, selectedPiece: -1 };
  const update = () => hud.update(s, view);
  update();
  const meter = root.querySelector<HTMLButtonElement>('[data-smog-meter]')!;
  const panel = root.querySelector<HTMLElement>('[data-smog-panel]')!;
  return { s, root, hud, update, meter, panel };
}

const press = (el: Element) => el.dispatchEvent(new Event('pointerdown', { bubbles: true }));

describe('smog meter', () => {
  it('is a button that opens and closes the panel, and keeps its bar, number and arrow', () => {
    setLang('en');
    const { s, meter, panel, hud } = setup();
    expect(meter.tagName).toBe('BUTTON');
    expect(meter.querySelector('[data-smog]')!.textContent).toBe(`62%${s.derived.pollutionRate > 0.01 ? ' ▲' : s.derived.pollutionRate < -0.01 ? ' ▼' : ''}`);
    expect(meter.querySelector<HTMLElement>('[data-smog-bar]')!.style.width).toBe(`${s.pollution}%`);
    expect(meter.title).toContain('Above 95% for 30 seconds the city is lost.');
    expect(panel.hidden).toBe(true);
    expect(meter.getAttribute('aria-expanded')).toBe('false');
    meter.click();
    expect(panel.hidden).toBe(false);
    expect(meter.getAttribute('aria-expanded')).toBe('true');
    expect(hud.smogShown).toBe(true);
    meter.click();
    expect(panel.hidden).toBe(true);
  });

  it('shows where the smog comes from and where it goes, with the sim total and the 95% rule', () => {
    setLang('en');
    const { s, meter, panel } = setup();
    meter.click();
    const r = airReport(s);
    const rows = [...panel.querySelectorAll<HTMLElement>('[data-air]')];
    expect(rows.map((row) => row.dataset.air)).toEqual([...r.sources, ...r.cleaning].map((row) => row.kind));
    expect(rows.map((row) => row.dataset.air)).toEqual(expect.arrayContaining(['smelter', 'burner', 'factory', 'sludge', 'purifier', 'garden', 'renewal']));
    expect(rows[0].querySelector('b')!.textContent).toBe(perDayText(r.sources[0].perDay));
    expect(panel.querySelector('[data-air-net] b')!.textContent).toContain(perDayText(s.derived.pollutionRate * 60));
    expect(panel.textContent).toContain('Sources');
    expect(panel.textContent).toContain('Cleaning');
    expect(panel.textContent).toContain('Natural air renewal');
    expect(panel.querySelector('[data-air-limit]')!.textContent).toBe('Above 95% for 30 seconds the city is lost.');
    expect(panel.querySelector('[data-smog-level]')!.textContent).toMatch(/^Smog 62%/);
  });

  it('closes with its ×, with closeSmog (Esc, B) and with a press anywhere else, but not inside it', () => {
    setLang('en');
    const { root, hud, meter, panel } = setup();
    meter.click();
    press(panel.querySelector('[data-air]')!);
    expect(panel.hidden).toBe(false);
    panel.querySelector<HTMLElement>('[data-smog-close]')!.click();
    expect(panel.hidden).toBe(true);
    expect(hud.closeSmog()).toBe(false); // nothing to close: Esc goes on to the tool, the catalog, the menu
    meter.click();
    expect(hud.closeSmog()).toBe(true);
    expect(panel.hidden).toBe(true);
    meter.click();
    press(document.querySelector('.elsewhere')!);
    expect(panel.hidden).toBe(true);
    meter.click();
    press(root.querySelector('[data-toolbar]')!);
    expect(panel.hidden).toBe(true);
    // a press on the meter itself leaves the toggling to its click
    meter.click();
    press(meter);
    expect(panel.hidden).toBe(false);
    // the controller's A on something else
    hud.closeSmogUnless(root.querySelector('[data-menu]'));
    expect(panel.hidden).toBe(true);
    hud.dispose();
    meter.click();
    press(document.querySelector('.elsewhere')!);
    expect(panel.hidden).toBe(false); // after dispose the page no longer listens
  });

  it('counts down with the alarm while the smog is over 95%, and follows the numbers while open', () => {
    setLang('it');
    const { s, root, meter, panel, update } = setup();
    meter.click();
    s.pollution = 97;
    s.smog = 12.4;
    update();
    const limit = panel.querySelector<HTMLElement>('[data-air-limit]')!;
    expect(limit.textContent).toBe('Sopra il 95%: la città è perduta tra 18s!');
    expect(limit.classList.contains('danger')).toBe(true);
    expect(root.querySelector<HTMLElement>('[data-smog-alert]')!.hidden).toBe(false);
    expect(panel.querySelector('[data-smog-level]')!.textContent).toMatch(/^Smog 97%/);
    expect(panel.textContent).toContain('Fonti');
    expect(panel.textContent).toContain("Ricambio d'aria naturale");
    setLang('en');
  });

  it('stays open through a change of language', () => {
    setLang('en');
    const { s, hud, root } = setup();
    root.querySelector<HTMLButtonElement>('[data-smog-meter]')!.click();
    setLang('de');
    hud.relabel();
    hud.update(s, { speed: 1, build: null, bulldoze: false, selectedId: -1, goalCard: true, piece: null, catalog: false, selectedPiece: -1 });
    const panel = root.querySelector<HTMLElement>('[data-smog-panel]')!;
    expect(panel.hidden).toBe(false);
    expect(panel.textContent).toContain('Quellen');
    expect(root.querySelector('[data-smog-meter]')!.getAttribute('aria-expanded')).toBe('true');
    setLang('en');
  });
});
