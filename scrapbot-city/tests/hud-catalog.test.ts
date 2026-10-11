// @vitest-environment jsdom
// The HUD side of Objects & modules: the toolbar button (the tutorial's targets still there), the catalog
// panel, the module slots of a Dock, the demolish refund with modules and the panel of a selected piece.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { placeBuilding, placeCheck } from '../src/game/actions';
import { MAP_H, MAP_W, T } from '../src/game/defs';
import type { BuildingType } from '../src/game/defs';
import { installModule, placePiece } from '../src/game/pieces';
import type { CatalogKind, ModuleKind } from '../src/game/pieces';
import { computeDerived } from '../src/game/sim';
import { createGame, idx } from '../src/game/state';
import type { Building, GameState } from '../src/game/state';
import { setLang } from '../src/i18n';
import { Hud } from '../src/ui/hud';
import type { HudHandlers, HudView } from '../src/ui/hud';

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

function city(): GameState {
  const s = createGame({ seed: 71, cityName: 'Catalog' });
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

function freeTile(s: GameState): { x: number; y: number } {
  for (let i = 0; i < MAP_W * MAP_H; i++) {
    const x = i % MAP_W;
    const y = Math.floor(i / MAP_W);
    if (x > 2 && (s.tiles[i] === T.GROUND || s.tiles[i] === T.GRASS) && s.occ[i] === -1 && !s.solid[i]) return { x, y };
  }
  throw new Error('no free tile');
}

function setup(s = city()) {
  document.body.innerHTML = '<div class="hud"></div>';
  const calls: [string, ...unknown[]][] = [];
  const record =
    (name: string) =>
    (...args: unknown[]) =>
      calls.push([name, ...args]);
  const handlers = Object.fromEntries(
    ['onBuild', 'onBulldoze', 'onImport', 'onSpeed', 'onMenu', 'onDemolish', 'onTogglePause', 'onCloseInspector', 'onHint', 'onRegion', 'onCatalog', 'onPick', 'onRotate', 'onInstall', 'onRemoveModule', 'onRotatePiece', 'onRemovePiece'].map((n) => [n, record(n)]),
  ) as unknown as HudHandlers;
  const root = document.querySelector<HTMLElement>('.hud')!;
  const hud = new Hud(root, handlers, s);
  const view: HudView = { speed: 1, build: null, bulldoze: false, selectedId: -1, goalCard: true, piece: null, catalog: false, selectedPiece: -1 };
  const update = (v: Partial<HudView> = {}) => hud.update(s, { ...view, ...v });
  return { s, root, calls, update, hud };
}

const q = (root: HTMLElement, sel: string) => root.querySelector<HTMLElement>(sel);

describe('toolbar', () => {
  it('keeps every tutorial target and adds Objects & modules (key O) next to the bulldozer', () => {
    const { root, calls, update } = setup();
    update();
    for (const sel of ['[data-tool="recycler"]', '[data-tool="pods"]', '[data-tool="solar"]', '[data-tool="burner"]', '.speed', '.meters', '[data-hint]', '[data-objective]']) {
      expect(q(root, sel), sel).not.toBeNull();
    }
    const tools = q(root, '.group-tools-misc .group-tools')!;
    expect([...tools.children].map((b) => (b as HTMLElement).dataset.doze ?? (b as HTMLElement).dataset.catalog)).toEqual(['', '']);
    const btn = q(root, '[data-catalog]')!;
    expect(btn.querySelector('kbd')!.textContent).toBe('O');
    expect(btn.textContent).toContain('Objects & modules');
    btn.click();
    expect(calls).toEqual([['onCatalog']]);
  });
});

describe('catalog panel', () => {
  it('lists construction then machine modules, takes the building panel place, and picks tools', () => {
    const { s, root, calls, update } = setup();
    update({ catalog: true, selectedId: s.buildings[0].id });
    const panel = q(root, '[data-catalog-panel]')!;
    expect(panel.hidden).toBe(false);
    expect(q(root, '[data-inspector]')!.hidden).toBe(true);
    expect(q(root, '[data-catalog]')!.classList.contains('active')).toBe(true);
    const items = [...panel.querySelectorAll<HTMLElement>('[data-item]')];
    expect(items.map((b) => b.dataset.item)).toEqual(['floor', 'fence', 'gate', 'lamp', 'bench', 'planter', 'sign', 'pergola', 'cathouse', 'sculpture', 'dockStorage', 'smelterFilter']);
    expect(panel.textContent).toContain('Construction');
    expect(panel.textContent).toContain('Decorations');
    expect(panel.textContent).toContain('Machine modules');
    // no Dock yet: the module says why it cannot be had
    const dock = items.find((b) => b.dataset.item === 'dockStorage')!;
    expect(dock.classList.contains('cant')).toBe(true);
    expect(dock.querySelector('.cat-reason')!.textContent).toBe('Only on a finished Bot Dock');
    expect(dock.textContent).toContain('80 → 180');
    expect(items[1].querySelector('.cat-limit')!.textContent).toBe('1 per tile');
    items[1].click();
    expect(calls).toEqual([['onPick', 'fence']]);
  });

  it('with a tool in hand: the item glows, Rotate shows only for pieces that turn, Done puts it away', () => {
    const { root, calls, update } = setup();
    const show = (kind: CatalogKind) => update({ catalog: true, piece: { kind, rot: 0 } });
    show('fence');
    const panel = q(root, '[data-catalog-panel]')!;
    expect(q(panel, '[data-item="fence"]')!.classList.contains('active')).toBe(true);
    q(panel, '[data-rotate]')!.click();
    q(panel, '[data-done]')!.click();
    expect(calls).toEqual([['onRotate'], ['onPick', null]]);
    show('floor');
    expect(q(panel, '[data-rotate]')).toBeNull();
    expect(q(panel, '.cat-help')!.textContent).toContain('drag');
    show('dockStorage');
    expect(q(panel, '[data-rotate]')).toBeNull();
    expect(q(panel, '.cat-help')!.textContent).toContain('Bot Dock');
  });

  it('comes back in the new language after a language switch, tool and all', () => {
    const { root, update, hud } = setup();
    update({ catalog: true, piece: { kind: 'gate', rot: 0 } });
    setLang('it');
    try {
      hud.relabel();
      update({ catalog: true, piece: { kind: 'gate', rot: 0 } });
      const panel = q(root, '[data-catalog-panel]')!;
      expect(panel.hidden).toBe(false);
      expect(panel.querySelector('h3')!.textContent).toBe('Oggetti e moduli');
      expect(q(panel, '[data-item="gate"]')!.classList.contains('active')).toBe(true);
      expect(q(root, '[data-catalog]')!.textContent).toContain('Oggetti e moduli');
    } finally {
      setLang('en');
    }
  });

  it('marks what the city cannot pay for, with what is missing', () => {
    const { s, root, update } = setup();
    s.res.credits = 5;
    s.res.parts = 0;
    update({ catalog: true });
    const lamp = q(root, '[data-item="lamp"]')!;
    expect(lamp.classList.contains('cant')).toBe(true);
    expect(lamp.querySelector('.cat-reason')!.textContent).toBe('Missing 5 credits + 2 parts');
    expect(q(root, '[data-item="fence"]')!.classList.contains('cant')).toBe(false);
  });

  it('follows the money coming in without rebuilding the list (a rebuild would lose a click)', () => {
    const { s, root, update } = setup();
    s.res.credits = 5;
    s.res.parts = 0;
    update({ catalog: true });
    const lamp = q(root, '[data-item="lamp"]')!;
    s.res.credits = 7.5;
    update({ catalog: true });
    expect(q(root, '[data-item="lamp"]')).toBe(lamp);
    expect(lamp.querySelector('.cat-reason')!.textContent).toBe('Missing 3 credits + 2 parts');
    // once the city can pay, the same row is no longer greyed out
    s.res.credits = 10;
    s.res.parts = 2;
    update({ catalog: true });
    expect(q(root, '[data-item="lamp"]')).toBe(lamp);
    expect(lamp.classList.contains('cant')).toBe(false);
    expect(lamp.querySelector<HTMLElement>('.cat-reason')!.hidden).toBe(true);
  });
});

describe('building panel modules', () => {
  it('shows the slot, before -> after, 0/1 and Install; then 1/1 and Remove with a second click', () => {
    const { s, root, calls, update } = setup();
    const dock = build(s, 'dock');
    update({ selectedId: dock.id });
    const insp = q(root, '[data-inspector]')!;
    expect(insp.hidden).toBe(false);
    const slot = q(insp, '[data-mod="dockStorage"]')!;
    expect(slot.textContent).toContain('Roof slot');
    expect(slot.querySelector('.mod-count')!.textContent).toBe('0/1');
    expect(slot.querySelector('.mod-fx')!.textContent).toBe('Storage80 → 180');
    // a double click installs once: the button greys out until the panel follows
    q(slot, '[data-install]')!.click();
    q(slot, '[data-install]')!.click();
    expect(calls).toEqual([['onInstall', dock.id, 'dockStorage' satisfies ModuleKind]]);

    expect(installModule(s, 'dockStorage', dock)).toBe(true);
    computeDerived(s);
    update({ selectedId: dock.id });
    const on = q(insp, '[data-mod="dockStorage"]')!;
    expect(on.querySelector('.mod-count')!.textContent).toBe('1/1');
    // the building rows now show the storage with the module
    expect(insp.querySelector('dl')!.textContent).toContain('180 scrap');
    const clock = vi.spyOn(performance, 'now').mockReturnValue(10_000);
    try {
      q(on, '[data-remove]')!.click();
      update({ selectedId: dock.id });
      // more scrap than the storage left would hold: the confirmation says how much goes
      s.res.scrap = 300;
      update({ selectedId: dock.id });
      const warn = q(insp, '[data-loss]')!;
      expect(warn.hidden).toBe(false);
      expect(warn.textContent).toBe('Storage drops to 230: 70 scrap will be lost.');
      expect(q(insp, '[data-remove-confirm]')!.textContent).toBe('Remove (+15 credits + 7 parts)');
      // the second click of a double click on Remove lands on the confirmation: it does not count
      clock.mockReturnValue(10_150);
      q(insp, '[data-remove-confirm]')!.click();
      expect(calls.at(-1)).toEqual(['onInstall', dock.id, 'dockStorage']);
      // a click of its own does
      clock.mockReturnValue(11_000);
      q(insp, '[data-remove-confirm]')!.click();
      expect(calls.at(-1)).toEqual(['onRemoveModule', dock.id, 'dockStorage']);
    } finally {
      clock.mockRestore();
    }
  });

  it('greys out Install with the reason, and the demolish refund counts the modules', () => {
    const { s, root, calls, update } = setup();
    const smelter = build(s, 'smelter');
    s.res.parts = 0;
    update({ selectedId: smelter.id });
    const insp = q(root, '[data-inspector]')!;
    const install = q(insp, '[data-install="smelterFilter"]') as HTMLButtonElement;
    expect(install.disabled).toBe(true);
    expect(q(insp, '[data-mod="smelterFilter"] .cat-reason')!.textContent).toBe('Missing 20 parts');
    expect(q(insp, '[data-mod="smelterFilter"] .mod-fx')!.textContent).toBe('Smog / day+2.1 → +0.8Energy-2 → -3');

    s.res.parts = 1000;
    expect(installModule(s, 'smelterFilter', smelter)).toBe(true);
    update({ selectedId: smelter.id });
    // effective numbers with the filter: energy -3, smog 0.8 a day
    expect(insp.querySelector('dl')!.textContent).toContain('-3');
    expect(insp.querySelector('dl')!.textContent).toContain('+0.8');
    const clock = vi.spyOn(performance, 'now').mockReturnValue(20_000);
    try {
      q(insp, '[data-demolish]')!.click();
      update({ selectedId: smelter.id });
      // Smelter 30 credits (half back: 15) and the filter (22 credits + 10 parts back)
      expect(q(insp, '[data-confirm]')!.textContent).toBe('Demolish (+37 credits + 10 parts)');
      // the confirmation comes up where Demolish was: the second click of a double click does not demolish
      clock.mockReturnValue(20_150);
      q(insp, '[data-confirm]')!.click();
      expect(calls.some((c) => c[0] === 'onDemolish')).toBe(false);
      expect(q(insp, '[data-confirm]')).not.toBeNull();
      // a click of its own does
      clock.mockReturnValue(21_000);
      q(insp, '[data-confirm]')!.click();
      expect(calls.at(-1)).toEqual(['onDemolish', smelter.id]);
    } finally {
      clock.mockRestore();
    }
  });

  it('follows the money a module still needs without rebuilding the panel', () => {
    const { s, root, update } = setup();
    const dock = build(s, 'dock');
    s.res.credits = 20;
    update({ selectedId: dock.id });
    const insp = q(root, '[data-inspector]')!;
    const demolish = q(insp, '[data-demolish]');
    expect(q(insp, '[data-mod="dockStorage"] .cat-reason')!.textContent).toBe('Missing 10 credits');
    s.res.credits = 26;
    update({ selectedId: dock.id });
    // the same buttons (a click on Demolish or Pause is not lost), with the new amount
    expect(q(insp, '[data-demolish]')).toBe(demolish);
    expect(q(insp, '[data-mod="dockStorage"] .cat-reason')!.textContent).toBe('Missing 4 credits');
    const install = q(insp, '[data-install="dockStorage"]') as HTMLButtonElement;
    expect(install.disabled).toBe(true);
    s.res.credits = 30;
    update({ selectedId: dock.id });
    expect(q(insp, '[data-install="dockStorage"]')).toBe(install);
    expect(install.disabled).toBe(false);
    expect(q(insp, '[data-mod="dockStorage"] .cat-reason')!.hidden).toBe(true);
  });
});

describe('selected piece panel', () => {
  it('names the piece, says it is decoration, offers Rotate (gate, lamp) and Remove with the refund', () => {
    const { s, root, calls, update } = setup();
    const p = freeTile(s);
    expect(placePiece(s, 'gate', p.x, p.y)).toBe(true);
    const i = idx(p.x, p.y);
    update({ selectedPiece: i });
    const insp = q(root, '[data-inspector]')!;
    expect(insp.hidden).toBe(false);
    expect(insp.querySelector('h3')!.textContent).toBe('Gate');
    expect(insp.textContent).toContain('Decoration: no effect on the economy');
    q(insp, '[data-rotate]')!.click();
    expect(q(insp, '[data-remove-piece]')!.textContent).toBe('Remove (+6 credits)');
    q(insp, '[data-remove-piece]')!.click();
    expect(calls).toEqual([['onRotatePiece', i], ['onRemovePiece', i]]);
    // a floor does not turn
    const f = { x: p.x, y: p.y + 1 };
    if (placePiece(s, 'floor', f.x, f.y)) {
      update({ selectedPiece: idx(f.x, f.y) });
      expect(q(insp, '[data-rotate]')).toBeNull();
      expect(q(insp, '[data-remove-piece]')!.textContent).toBe('Remove (+1 credit)');
    }
  });
});
