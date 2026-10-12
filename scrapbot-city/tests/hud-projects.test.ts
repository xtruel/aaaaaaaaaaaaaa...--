// @vitest-environment jsdom
// The HUD side of the projects to discover (docs/MODULAR-INC2.md §4): the catalog's categories and filters, each item's
// state in words and with an icon (to discover: goal and progress "in this city · best"; not now: why; can be bought),
// the building panel's module slot (to discover, installed, slot taken), the notice "New project: Bench" with Open,
// the badge, and the note on a kept item whose project is not discovered.
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { placeBuilding, placeCheck } from '../src/game/actions';
import { MAP_H, MAP_W } from '../src/game/defs';
import type { BuildingType } from '../src/game/defs';
import { installModule } from '../src/game/pieces';
import type { CatalogKind } from '../src/game/pieces';
import { PROJECT_KINDS } from '../src/game/projects';
import type { GoalStat } from '../src/game/projects';
import { computeDerived } from '../src/game/sim';
import { createGame } from '../src/game/state';
import type { Building, GameState } from '../src/game/state';
import { setLang } from '../src/i18n';
import { Hud, NOTICE_SECONDS } from '../src/ui/hud';
import type { HudHandlers, HudView } from '../src/ui/hud';
import { PRESS_GUARD_MS, forgetPresses } from '../src/ui/presses';

vi.mock('../src/render/icons', () => ({ iconUrl: (name: string) => `icon:${name}`, toolThumb: () => '', portraitUrl: () => '', pathColor: () => 'var(--muted)' }));
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

let now = 10_000;
beforeEach(() => {
  now = 10_000;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  forgetPresses();
  setLang('en');
});

function city(): GameState {
  const s = createGame({ seed: 71, cityName: 'Projects' });
  s.res.credits = 5000;
  s.res.parts = 1000;
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
        computeDerived(s);
        return b;
      }
  throw new Error(`no room for ${type}`);
}

function setup(s = city(), best: Partial<Record<GoalStat, number>> = {}) {
  document.body.innerHTML = '<div id="modal-root"></div><div class="hud"></div>';
  const calls: [string, ...unknown[]][] = [];
  const handlers = new Proxy({}, { get: (_t, name: string) => (...args: unknown[]) => calls.push([name, ...args]) }) as HudHandlers;
  const root = document.querySelector<HTMLElement>('.hud')!;
  const hud = new Hud(root, handlers, s);
  const view: HudView = { speed: 1, build: null, bulldoze: false, selectedId: -1, goalCard: true, piece: null, catalog: false, selectedPiece: -1, best: (st) => best[st] ?? 0 };
  const update = (v: Partial<HudView> = {}) => hud.update(s, { ...view, ...v });
  const q = (sel: string) => root.querySelector<HTMLElement>(sel);
  const rows = () => [...root.querySelectorAll<HTMLElement>('[data-catalog-panel] [data-item]')].map((b) => b.dataset.item);
  return { s, root, calls, update, hud, q, rows };
}

const stateOf = (row: HTMLElement) => ({
  state: row.dataset.state,
  label: row.querySelector('.cat-state-label')!.textContent,
  icon: row.querySelector<HTMLImageElement>('.cat-state img')!.getAttribute('src'),
});

describe('catalog: categories, filters, states', () => {
  it('three categories, one list at a time, the caption of each (Construction no longer says "Decoration")', () => {
    const { q, rows, update } = setup();
    update({ catalog: true });
    expect([...document.querySelectorAll('.cat-tab-name')].map((e) => e.textContent)).toEqual(['Construction', 'Decorations', 'Modules']);
    expect(rows()).toEqual(['floor', 'fence', 'gate', 'base', 'wall', 'pillar']);
    expect(q('.cat-note')!.textContent).toBe('Construction: no effect on the economy');
    q('[data-cat="decorations"]')!.click();
    expect(rows()[0]).toBe('lamp');
    expect(q('.cat-note')!.textContent).toBe('Decoration: no effect on the economy');
    expect(q('[data-cat="decorations"]')!.getAttribute('aria-selected')).toBe('true');
    expect(q('[data-cat="construction"]')!.getAttribute('aria-selected')).toBe('false');
  });

  it('the three states, each with its words and its icon: to discover (goal, progress), not now (why), can be bought', () => {
    const { s, q, update } = setup(city(), { pop: 8 });
    s.pop = 6;
    update({ catalog: true });
    q('[data-cat="decorations"]')!.click();
    const bench = q('[data-item="bench"]')!;
    expect(stateOf(bench)).toEqual({ state: 'locked', label: 'To discover', icon: 'icon:discover' });
    expect(bench.getAttribute('aria-disabled')).toBe('true');
    expect(bench.querySelector('.cat-goal')!.textContent).toBe('Reach 10 citizens');
    // the city's progress, and the best reached in another city when it is higher
    expect(bench.querySelector('[data-cat-progress]')!.textContent).toBe('6 / 10 in this city · best 8');
    expect(bench.querySelector<HTMLElement>('[data-cat-goal]')!.hidden).toBe(false);
    expect(q('[data-item="tree"] [data-cat-progress]')!.textContent).toBe('6 / 20 in this city · best 8');
    const lamp = q('[data-item="lamp"]')!;
    expect(stateOf(lamp)).toEqual({ state: 'available', label: 'Can be bought', icon: 'icon:plus' });
    s.res.parts = 0;
    update({ catalog: true });
    expect(stateOf(lamp)).toEqual({ state: 'cantBuy', label: 'Not now', icon: 'icon:cross' });
    expect(lamp.querySelector('.cat-reason')!.textContent).toBe('Missing 2 parts');
    // the Spire's project: its goal, and that this city has not finished it
    expect(q('[data-item="sculpture"] [data-cat-progress]')!.textContent).toBe('Not finished in this city yet');
  });

  it('a project found while the catalog is open changes state in place: the same row, no rebuild (no click lost)', () => {
    const { s, q, update } = setup();
    update({ catalog: true });
    q('[data-cat="decorations"]')!.click();
    q('[data-filter="locked"]')!.click();
    const bench = q('[data-item="bench"]')!;
    s.unlocked.add('bench');
    update({ catalog: true });
    expect(q('[data-item="bench"]')).toBe(bench);
    expect(stateOf(bench).state).toBe('available');
    expect(bench.querySelector<HTMLElement>('[data-cat-goal]')!.hidden).toBe(true);
    expect(bench.getAttribute('aria-disabled')).toBe('false');
  });

  it('filters: All, Available (discovered, affordable or not), To discover, each with its count; remembered while playing', () => {
    const { s, q, rows, update } = setup();
    s.unlocked.add('bench');
    s.unlocked.add('tree');
    s.res.credits = 0; // money does not move items between filters
    update({ catalog: true });
    q('[data-cat="decorations"]')!.click();
    const count = (f: string) => q(`[data-filter="${f}"] [data-filter-count]`)!.textContent;
    expect([count('all'), count('available'), count('locked')]).toEqual(['10', '3', '7']);
    q('[data-filter="available"]')!.click();
    expect(rows()).toEqual(['lamp', 'bench', 'tree']);
    expect(q('[data-filter="available"]')!.getAttribute('aria-pressed')).toBe('true');
    q('[data-filter="locked"]')!.click();
    expect(rows()).toEqual(['planter', 'sign', 'pergola', 'cathouse', 'sculpture', 'fountain', 'statue']);
    q('[data-cat="modules"]')!.click();
    expect(rows()).toEqual(['recyclerMagnet', 'recyclerSorter', 'factoryArm', 'podsCapsule', 'solarTracker', 'purifierNozzle']);
    // closed and opened again: the same category and filter
    update({ catalog: false });
    update({ catalog: true });
    expect(q('.cat-tab.on')!.dataset.cat).toBe('modules');
    expect(q('.cat-filter.on')!.dataset.filter).toBe('locked');
    // all discovered: "To discover" says so
    for (const k of PROJECT_KINDS) s.unlocked.add(k);
    q('[data-cat="construction"]')!.click();
    expect(rows()).toEqual([]);
    expect(q('.cat-empty')!.textContent).toBe('Everything in here is discovered.');
  });

  it('an item taken in hand shows in its own category; picking a locked row asks the session (which refuses it)', () => {
    const { calls, q, update } = setup();
    update({ catalog: true, piece: { kind: 'lamp', rot: 0 } });
    expect(q('.cat-tab.on')!.dataset.cat).toBe('decorations');
    expect(q('[data-item="lamp"]')!.classList.contains('active')).toBe(true);
    now += 2000;
    q('[data-item="bench"]')!.click();
    expect(calls.at(-1)).toEqual(['onPick', 'bench']);
  });

  it('a tab pressed right after taking an item (before the next drawing) stays: the item in hand does not pull it back', () => {
    const { q, update } = setup();
    update({ catalog: true });
    now += 2000;
    q('[data-cat="decorations"]')!.click();
    q('[data-item="lamp"]')!.click();
    q('[data-cat="construction"]')!.click();
    update({ catalog: true, piece: { kind: 'lamp', rot: 0 } });
    expect(q('.cat-tab.on')!.dataset.cat).toBe('construction');
    // a project still to discover is refused: the lamp stays in hand, and the tab chosen after it stays too
    q('[data-cat="decorations"]')!.click();
    now += 2000;
    q('[data-item="bench"]')!.click();
    q('[data-cat="modules"]')!.click();
    update({ catalog: true, piece: { kind: 'lamp', rot: 0 } });
    expect(q('.cat-tab.on')!.dataset.cat).toBe('modules');
  });

  it('in Italian: "Da scoprire", "pezzi" for the parts, "oggetti del catalogo" for the pieces placed', () => {
    setLang('it');
    const { s, q, update } = setup();
    s.stats.partsMade = 120;
    update({ catalog: true });
    q('[data-cat="construction"]')!.click();
    expect(q('[data-item="pillar"] .cat-goal')!.textContent).toMatch(/^Posa 20 oggetti del catalogo/);
    expect(q('.cat-note')!.textContent).toBe("Costruzione: nessun effetto sull'economia");
    q('[data-cat="modules"]')!.click();
    const sorter = q('[data-item="recyclerSorter"]')!;
    expect(sorter.querySelector('.cat-state-label')!.textContent).toBe('Da scoprire');
    expect(sorter.querySelector('.cat-goal')!.textContent).toBe('Produci 400 pezzi');
    expect(sorter.querySelector('[data-cat-progress]')!.textContent).toBe('120 / 400 in questa città');
    expect([...document.querySelectorAll('.cat-filter')].map((b) => b.firstChild!.textContent!.trim())).toEqual(['Tutti', 'Disponibili', 'Da scoprire']);
  });
});

describe('notice: "New project: Bench" with Open', () => {
  it('shows the project, opens the catalog at it on Open (nothing bought), and goes after a while', () => {
    const { calls, q, hud, update } = setup();
    update();
    const note = q('[data-project-note]')!;
    expect(note.hidden).toBe(true);
    hud.notifyProjects(['bench']);
    update();
    expect(note.hidden).toBe(false);
    expect(note.querySelector('[data-note-title]')!.textContent).toBe('New project');
    expect(note.querySelector('[data-note-names]')!.textContent).toBe('Bench');
    expect(note.getAttribute('aria-label')).toBe('New project: Bench');
    // just appeared: presses go through it (pointer-events: none) and Open does nothing
    expect(note.classList.contains('arming')).toBe(true);
    q('[data-project-open]')!.click();
    expect(calls.filter((c) => c[0] === 'onOpenProject')).toEqual([]);
    now += PRESS_GUARD_MS + 10;
    update();
    expect(note.classList.contains('arming')).toBe(false);
    q('[data-project-open]')!.click();
    expect(calls.filter((c) => c[0] === 'onOpenProject')).toEqual([['onOpenProject', 'bench']]);
    expect(calls.some((c) => c[0] === 'onPick' || c[0] === 'onInstall')).toBe(false);
    expect(note.hidden).toBe(true);
    // a new one goes by itself after NOTICE_SECONDS (counted only while no dialog is open)
    hud.notifyProjects(['tree']);
    update();
    document.querySelector('#modal-root')!.innerHTML = '<div class="modal-backdrop"></div>';
    now += (NOTICE_SECONDS + 5) * 1000;
    for (let i = 0; i < 40; i++) update();
    expect(note.hidden).toBe(false);
    document.querySelector('#modal-root')!.innerHTML = '';
    for (let i = 0; i < 40; i++) {
      now += 500;
      update();
    }
    expect(note.hidden).toBe(true);
  });

  it('several at once, or more while it shows, make one notice; Open goes to the first', () => {
    const { calls, q, hud, update } = setup();
    hud.notifyProjects(['bench', 'cathouse']);
    update();
    hud.notifyProjects(['base', 'tree']);
    update();
    const note = q('[data-project-note]')!;
    expect(note.querySelector('[data-note-title]')!.textContent).toBe('New projects (4)');
    expect(note.querySelector('[data-note-names]')!.textContent).toBe("Bench, Miso's house, Concrete base +1");
    expect(note.getAttribute('aria-label')).toBe("New project: Bench, Miso's house, Concrete base, Tree");
    now += PRESS_GUARD_MS + 10;
    update();
    q('[data-project-open]')!.click();
    expect(calls.filter((c) => c[0] === 'onOpenProject')).toEqual([['onOpenProject', 'bench']]);
  });

  it('the badge counts what the catalog has not shown yet; Open shows the item in its category, marked', () => {
    const { s, q, hud, update } = setup();
    s.unlocked.add('bench');
    s.unlocked.add('recyclerMagnet');
    hud.notifyProjects(['bench', 'recyclerMagnet']);
    update();
    const badge = q('[data-catalog-badge]')!;
    expect(badge.hidden).toBe(false);
    expect(badge.textContent).toBe('2');
    // the session opens the catalog at the item (onOpenProject)
    hud.focusItem('recyclerMagnet' as CatalogKind);
    update({ catalog: true });
    expect(q('.cat-tab.on')!.dataset.cat).toBe('modules');
    expect(q('[data-item="recyclerMagnet"]')!.classList.contains('focus')).toBe(true);
    expect(q('[data-item="recyclerMagnet"]')!.classList.contains('fresh')).toBe(true);
    // the bench's tab has a dot until it is shown
    expect(q('[data-cat="decorations"]')!.classList.contains('fresh')).toBe(true);
    q('[data-cat="decorations"]')!.click();
    update({ catalog: true });
    expect(q('[data-cat="decorations"]')!.classList.contains('fresh')).toBe(false);
    update({ catalog: false });
    expect(badge.hidden).toBe(true);
  });

  it('stands clear of the tutorial bubble (position: fixed, so it has no offsetParent), also when the bubble comes over it', () => {
    const { q, hud, update } = setup();
    const coach = document.createElement('div');
    coach.className = 'coach';
    coach.style.position = 'fixed';
    document.body.append(coach);
    // the layout jsdom does not do: a 1024 px wide window, the build bar from y 600, the bubble over the band under the
    // top bar from x 300 (the notice's first choice there is its middle, x 312..712)
    const rects = new Map<Element, DOMRect>([
      [q('[data-toolbar]')!, new DOMRect(0, 600, 1024, 168)],
      [coach, new DOMRect(300, 60, 710, 240)],
    ]);
    const box = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      return rects.get(this) ?? new DOMRect(0, 0, 0, 0);
    });
    const drawn = vi.spyOn(Element.prototype, 'getClientRects').mockImplementation(function (this: Element) {
      const r = rects.get(this);
      return (r ? [r] : []) as unknown as DOMRectList;
    });
    try {
      const note = q('[data-project-note]')!;
      Object.defineProperty(note, 'offsetWidth', { value: 400 });
      Object.defineProperty(note, 'offsetHeight', { value: 56 });
      const at = () => new DOMRect(parseFloat(note.style.left), parseFloat(note.style.top), 400, 56);
      const clear = (a: DOMRect, b: DOMRect) => a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;
      hud.notifyProjects(['bench']);
      update();
      expect(note.hidden).toBe(false);
      expect(clear(at(), rects.get(coach)!)).toBe(true);
      // the next tutorial step puts the bubble where the notice stands: the notice moves off it
      const was = at();
      rects.set(coach, new DOMRect(was.left - 10, was.top - 10, 420, 200));
      update();
      expect(clear(at(), rects.get(coach)!)).toBe(true);
    } finally {
      box.mockRestore();
      drawn.mockRestore();
      coach.remove();
    }
  });
});

describe('building panel: the module slot of a project', () => {
  it('to discover: words and icon, goal and progress, Install greyed out; discovered: can be installed', () => {
    const { s, q, update } = setup(city(), { partsMade: 60 });
    const rec = build(s, 'recycler');
    s.stats.partsMade = 40;
    update({ selectedId: rec.id });
    const magnet = q('[data-mod="recyclerMagnet"]')!;
    const chip = magnet.querySelector<HTMLElement>('[data-mod-state]')!;
    expect(chip.dataset.state).toBe('locked');
    expect(chip.textContent).toBe('To discover');
    expect(chip.querySelector('img')!.getAttribute('src')).toBe('icon:discover');
    expect(magnet.querySelector<HTMLButtonElement>('[data-install]')!.disabled).toBe(true);
    const reason = magnet.querySelector<HTMLElement>('.cat-reason')!;
    expect(reason.textContent).toBe('Make 100 parts');
    expect(reason.classList.contains('is-goal')).toBe(true);
    expect(magnet.querySelector('[data-mod-progress]')!.textContent).toBe('40 / 100 in this city · best 60');
    // the price and what it does are there to read
    expect(magnet.querySelector('.mod-price')!.textContent).toContain('40 credits + 15 parts');
    s.unlocked.add('recyclerMagnet');
    update({ selectedId: rec.id });
    expect(chip.dataset.state).toBe('available');
    expect(magnet.querySelector<HTMLButtonElement>('[data-install]')!.disabled).toBe(false);
    expect(magnet.querySelector<HTMLElement>('[data-mod-progress]')!.hidden).toBe(true);
    expect(reason.hidden).toBe(true);
  });

  it('installed, the slot taken by the other one; a kept module of an undiscovered project warns before Remove', () => {
    const { s, q, root, update } = setup();
    const rec = build(s, 'recycler');
    s.unlocked.add('recyclerMagnet');
    s.unlocked.add('recyclerSorter');
    expect(installModule(s, 'recyclerMagnet', rec)).toBe(true);
    // a loaded city kept it although this profile has not discovered it
    s.unlocked.delete('recyclerMagnet');
    update({ selectedId: rec.id });
    expect(q('[data-mod="recyclerMagnet"] [data-mod-state]')!.dataset.state).toBe('installed');
    expect(q('[data-mod="recyclerSorter"] [data-mod-state]')!.dataset.state).toBe('slotTaken');
    expect(q('[data-mod="recyclerSorter"] .cat-reason')!.textContent).toBe('Slot taken by Magnetic separator: remove it first');
    q('[data-remove="recyclerMagnet"]')!.click();
    update({ selectedId: rec.id });
    expect(root.querySelector('[data-kept-locked]')!.textContent).toBe('Not discovered yet: once removed, it cannot be bought again until you discover it.');
  });
});
