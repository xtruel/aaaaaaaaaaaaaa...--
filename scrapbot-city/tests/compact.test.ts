// @vitest-environment jsdom
// The compact layout (src/compact.css: phones in landscape, any window up to 500 px high) changes nothing for windows
// from 1024x640 up: every rule of its style sheet sits inside the one media query src/ui/compact.ts names (or hides
// the compact layout's own controls), main.ts loads it after the main style sheet, and what the HUD does for it (the
// goal chip's button, the strip of the building in hand) only acts while that query matches. jsdom lays nothing out:
// the layout itself is measured in a browser (e2e/tests/phone.mjs, phone-flow.mjs).
import { readFileSync } from 'node:fs';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { BULLDOZE_RUBBLE_COST } from '../src/game/defs';
import { createGame } from '../src/game/state';
import { setLang } from '../src/i18n';
import { COMPACT_QUERY } from '../src/ui/compact';
import { Hud } from '../src/ui/hud';
import type { HudHandlers, HudView } from '../src/ui/hud';

vi.mock('../src/render/icons', () => ({ iconUrl: () => '', toolThumb: () => '', portraitUrl: () => '', pathColor: () => 'var(--muted)' }));
vi.mock('../src/render/iso/atlas', () => ({ atlasImage: () => null, frame: () => undefined }));
vi.mock('../src/render/sprites', () => ({
  PAL: { ink: '#000', orange: '#f80', white: '#fff' },
  makeCanvas: () => [{ toDataURL: () => 'data:,' }, { fillRect: () => {}, drawImage: () => {}, fillStyle: '' }],
}));
vi.mock('../src/audio', () => ({ audio: { play: () => {} } }));

const css = readFileSync('src/compact.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

describe('the compact style sheet', () => {
  it("has one media query, src/ui/compact.ts's, which no window 640 px high or more matches", () => {
    const queries = [...css.matchAll(/@media\s*([^{]+)\{/g)].map((m) => m[1].trim());
    expect(queries).toEqual([COMPACT_QUERY]);
    const most = Number(/^\(max-height: (\d+)px\)$/.exec(COMPACT_QUERY)?.[1]);
    expect(most).toBeLessThan(640);
  });

  it("outside it, only hides the compact layout's own controls", () => {
    const at = css.indexOf('@media');
    expect(css.slice(0, at).replace(/\s+/g, ' ').trim()).toBe('.obj-toggle { display: none; }');
    // the media query's block closes at the end of the file: no rule after it
    let depth = 0;
    let end = -1;
    for (let i = css.indexOf('{', at); i < css.length; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}' && --depth === 0) {
        end = i;
        break;
      }
    }
    expect(css.slice(end + 1).trim()).toBe('');
  });

  it('is loaded after the main style sheet (its rules win where both say something)', () => {
    const main = readFileSync('src/main.ts', 'utf8');
    expect(main.indexOf("import './compact.css';")).toBeGreaterThan(main.indexOf("import './style.css';"));
  });
});

// ---------- the HUD ----------
const media = { compact: false };
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView = () => {};
  window.matchMedia = ((q: string) => ({
    media: q,
    get matches() {
      return q === COMPACT_QUERY && media.compact;
    },
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  media.compact = false;
});

function setup(compact: boolean) {
  setLang('en');
  media.compact = compact;
  document.body.innerHTML = '<div class="hud"></div>';
  const s = createGame({ seed: 5, cityName: 'Strip' });
  const calls: string[] = [];
  const handlers = new Proxy({}, { get: (_, name) => (...a: unknown[]) => calls.push(`${String(name)}(${a.map((x) => JSON.stringify(x)).join(',')})`) }) as HudHandlers;
  const root = document.querySelector<HTMLElement>('.hud')!;
  const hud = new Hud(root, handlers, s);
  const view: HudView = { speed: 1, build: null, bulldoze: false, selectedId: -1, goalCard: true, piece: null, catalog: false, selectedPiece: -1 };
  const strip = () => root.querySelector<HTMLElement>('[data-build-info]')!;
  return { s, hud, root, view, calls, strip };
}

describe('the strip of the building in hand', () => {
  it('stays hidden outside the compact layout (a desktop window), whatever is in hand', () => {
    const { s, hud, view, strip } = setup(false);
    hud.update(s, { ...view, build: 'recycler' });
    expect(strip().hidden).toBe(true);
    hud.update(s, { ...view, bulldoze: true });
    expect(strip().hidden).toBe(true);
    expect(strip().innerHTML).toBe('');
  });

  it("in the compact layout names the building in hand, its path and price; its × puts it away", () => {
    const { s, hud, view, strip, calls } = setup(true);
    hud.update(s, view);
    expect(strip().hidden).toBe(true);
    hud.update(s, { ...view, build: 'recycler' });
    expect(strip().hidden).toBe(false);
    expect(strip().querySelector('.bi-title b')?.textContent).toBe('Recycler');
    expect(strip().querySelector('.bi-title .tag')?.textContent).toBeTruthy();
    expect(strip().querySelector('[data-build-cost]')?.textContent?.trim()).toBe('50');
    expect(strip().querySelector('.bi-help')?.textContent).toBe('Click a tile to place it.');
    strip().querySelector<HTMLButtonElement>('[data-build-close]')!.click();
    expect(calls).toEqual(['onBuild(null)']);
    hud.update(s, view);
    expect(strip().hidden).toBe(true);
  });

  it('names the bulldozer and what clearing rubble costs; its × puts the bulldozer away', () => {
    const { s, hud, view, strip, calls } = setup(true);
    hud.update(s, { ...view, bulldoze: true });
    expect(strip().hidden).toBe(false);
    expect(strip().textContent).toContain('Bulldoze');
    expect(strip().textContent).toContain(`${BULLDOZE_RUBBLE_COST} credits per rubble tile`);
    strip().querySelector<HTMLButtonElement>('[data-build-close]')!.click();
    expect(calls).toEqual(['onBulldoze()']);
  });

  it('is drawn again in the new language', () => {
    const { s, hud, view, strip } = setup(true);
    hud.update(s, { ...view, build: 'dock' });
    expect(strip().querySelector('.bi-title b')?.textContent).toBe('Bot Dock');
    setLang('it');
    hud.relabel();
    hud.update(s, { ...view, build: 'dock' });
    expect(strip().hidden).toBe(false);
    expect(strip().querySelector('.bi-help')?.textContent).toBe('Clicca una casella per posarlo.');
  });
});

describe("the goal chip's button", () => {
  it('opens the goal card and closes it again, as aria-expanded says, and is read as the goal\'s step', () => {
    const { s, hud, view, root } = setup(true);
    hud.update(s, view);
    const card = root.querySelector<HTMLElement>('[data-objective]')!;
    const toggle = root.querySelector<HTMLButtonElement>('[data-obj-toggle]')!;
    expect(toggle.getAttribute('aria-label')).toBe(root.querySelector('[data-obj-step]')!.textContent);
    expect(toggle.getAttribute('aria-label')).toBe('Goal 1/9');
    expect(card.classList.contains('open')).toBe(false);
    toggle.click();
    expect(card.classList.contains('open')).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    toggle.click();
    expect(card.classList.contains('open')).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });
});
