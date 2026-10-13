// @vitest-environment jsdom
// The HUD side of increment 2's decorations (G2): the Decorations section of the catalog (with the lamp), the panel
// of a selected decoration (Rotate where it turns, Remove with what it really gives back, kept up to date in place),
// and the catalog's guard against the second press of a double press after the list moved under the pointer.
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { costText } from '../src/game/actions';
import { MAP_W, T } from '../src/game/defs';
import { PIECES, pieceRefundAt, placePiece, removePieceAt } from '../src/game/pieces';
import type { PieceKind } from '../src/game/pieces';
import { computeDerived } from '../src/game/sim';
// cities where every project is discovered: these tests are about the items' own rules
import { createGame } from './all-projects';
import type { GameState } from '../src/game/state';
import { Hud } from '../src/ui/hud';
import { forgetPresses, notePress } from '../src/ui/presses';
import type { HudHandlers, HudView } from '../src/ui/hud';

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
// (the presses of one test, made on a mocked clock, are not the press before in the next: Remove and Install skip the
// second press of a double press)
afterEach(() => {
  vi.restoreAllMocks();
  forgetPresses();
});

const DECOS = ['bench', 'planter', 'sign', 'pergola', 'cathouse', 'sculpture'] as const;

function city(): GameState {
  const s = createGame({ seed: 71, cityName: 'Decorations' });
  s.res.credits = 5000;
  s.res.parts = 1000;
  s.res.scrap = 100;
  computeDerived(s);
  return s;
}

function freeTiles(s: GameState, n: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < s.tiles.length && out.length < n; i++) {
    const x = i % MAP_W;
    if (x > 2 && (s.tiles[i] === T.GROUND || s.tiles[i] === T.GRASS) && s.occ[i] === -1 && !s.solid[i]) out.push({ x, y: Math.floor(i / MAP_W) });
  }
  return out;
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

const q = (root: Element, sel: string) => root.querySelector<HTMLElement>(sel);

describe('catalog: the Decorations section', () => {
  it('lists the lamp and the six decorations between Construction and the modules, each with its price, effect and limit', () => {
    const { s, root, update } = setup();
    update({ catalog: true });
    const panel = q(root, '[data-catalog-panel]')!;
    // three categories (G4), one list at a time, each with its note: constructions and decorations do nothing to
    // the economy (the Construction note says so of constructions, not "Decoration")
    const tabs = [...panel.querySelectorAll('[data-cat] .cat-tab-name')].map((h) => h.textContent);
    expect(tabs).toEqual(['Construction', 'Decorations', 'Modules']);
    const notes: string[] = [];
    const lists = ['construction', 'decorations', 'modules'].map((cat) => {
      q(panel, `[data-cat="${cat}"]`)!.click();
      notes.push(q(panel, '.cat-note')!.textContent!);
      return [...panel.querySelectorAll<HTMLElement>('[data-item]')].map((b) => b.dataset.item);
    });
    expect(lists).toEqual([
      ['floor', 'fence', 'gate', 'base', 'wall', 'pillar'],
      ['lamp', ...DECOS, 'tree', 'fountain', 'statue'],
      ['dockStorage', 'smelterFilter', 'recyclerMagnet', 'recyclerSorter', 'factoryArm', 'podsCapsule', 'solarTracker', 'purifierNozzle'],
    ]);
    expect(notes).toEqual(['Construction: no effect on the economy', 'Decoration: no effect on the economy', 'One module per building, paid by the city it goes in']);
    q(panel, '[data-cat="decorations"]')!.click();
    const item = (k: string) => q(panel, `[data-item="${k}"]`)!;
    expect(item('bench').querySelector('.cat-name')!.textContent).toBe('Bench');
    expect(item('cathouse').querySelector('.cat-name')!.textContent).toBe("Miso's house");
    expect(item('sculpture').querySelector('.cat-effect')!.textContent).toContain('only if storage has room');
    expect(item('pergola').querySelector('.cat-limit')!.textContent).toBe('1 per tile');
    // the price with every resource it takes: the sculpture's scrap too
    expect(item('sculpture').querySelector('.cost-credits')!.textContent).toBe('10');
    expect(item('sculpture').querySelector('.cost-scrap')!.textContent).toBe('20');
    expect(item('sign').querySelector('.cost-parts')!.textContent).toBe('4');
    expect(item('sign').querySelector('img')).not.toBeNull();
    for (const k of DECOS) expect(item(k).classList.contains('cant'), k).toBe(false);
    // too little scrap for the sculpture: greyed out, with what is missing
    s.res.scrap = 5;
    update({ catalog: true });
    expect(item('sculpture').classList.contains('cant')).toBe(true);
    expect(item('sculpture').querySelector('.cat-reason')!.textContent).toBe('Missing 15 scrap');
    expect(item('bench').classList.contains('cant')).toBe(false);
  });

  it('the second press of a double press on an item or Done (the list moves under it) picks nothing; a press elsewhere or after a moment does', () => {
    const { root, calls, update } = setup();
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    forgetPresses();
    // a press at screen point (x, y) that lands on `el` (what the session notes for every press, then the click)
    const press = (el: HTMLElement, x: number, y: number) => {
      notePress({ t: now, x, y, cam: '', tile: '' });
      el.click();
    };
    update({ catalog: true });
    const panel = q(root, '[data-catalog-panel]')!;
    const item = (k: string) => q(panel, `[data-item="${k}"]`)!;
    q(panel, '[data-cat="decorations"]')!.click();
    press(item('bench'), 900, 300);
    // the panel is redrawn for the bench, the list moves: the second press of a double click lands on the planter
    update({ catalog: true, piece: { kind: 'bench', rot: 0 } });
    now += 60;
    press(item('planter'), 900, 300);
    expect(calls).toEqual([['onPick', 'bench']]);
    // a press somewhere else, even soon after, is meant
    now += 100;
    press(item('pergola'), 900, 420);
    expect(calls.at(-1)).toEqual(['onPick', 'pergola']);
    update({ catalog: true, piece: { kind: 'pergola', rot: 0 } });
    // Done pressed twice: the tool is put away once, the item that comes under the finger is not taken
    now += 1000;
    press(q(panel, '[data-done]')!, 950, 200);
    update({ catalog: true, piece: null });
    now += 50;
    press(item('sign'), 950, 200);
    expect(calls.at(-1)).toEqual(['onPick', null]);
    // item, a right click on the map, the same item again within 350 ms: three presses, all meant (scripted play)
    // (the tab is a press of its own, away from Done: a tab too ignores the second press of a double press)
    now += 200;
    press(q(panel, '[data-cat="construction"]')!, 300, 160);
    now += 1000;
    press(item('fence'), 900, 250);
    now += 120;
    notePress({ t: now, x: 400, y: 300, cam: '', tile: '20,20' });
    now += 150;
    press(item('fence'), 900, 250);
    expect(calls.slice(-2)).toEqual([
      ['onPick', 'fence'],
      ['onPick', 'fence'],
    ]);
    // Rotate tapped twice turns twice (the panel does not move under it)
    update({ catalog: true, piece: { kind: 'bench', rot: 0 } });
    now += 1000;
    press(q(panel, '[data-rotate]')!, 700, 220);
    now += 80;
    press(q(panel, '[data-rotate]')!, 700, 220);
    expect(calls.slice(-2)).toEqual([['onRotate'], ['onRotate']]);
    // a key long after a double click is not a double press
    now += 5000;
    item('cathouse').click();
    expect(calls.at(-1)).toEqual(['onPick', 'cathouse']);
  });
});

describe('the panel of a selected decoration', () => {
  it('says what it is and that it is only for looks; Rotate only where it turns; Remove with its refund', () => {
    const { s, root, calls, update } = setup();
    const tiles = freeTiles(s, DECOS.length);
    DECOS.forEach((k, n) => {
      const { x, y } = tiles[n];
      expect(placePiece(s, k, x, y, 1)).toBe(true);
      const i = y * MAP_W + x;
      update({ selectedPiece: i });
      const panel = q(root, '[data-inspector]')!;
      expect(panel.hidden).toBe(false);
      expect(q(panel, '.tag')!.textContent).toBe('Decorations');
      expect(q(panel, '.piece-note')!.textContent).toBe('Decoration: no effect on the economy');
      expect(!!q(panel, '[data-rotate]'), k).toBe(PIECES[k].rotations > 1);
      expect(q(panel, '[data-remove-piece]')!.textContent).toBe(`Remove (+${costText(pieceRefundAt(s, k))})`);
      q(panel, '[data-remove-piece]')!.click();
      q(panel, '[data-rotate]')?.click();
      expect(calls.slice(-1 - (PIECES[k].rotations > 1 ? 1 : 0))[0]).toEqual(['onRemovePiece', i]);
    });
    // a floor, fence or gate is a construction
    const [f] = freeTiles(s, 1);
    placePiece(s, 'gate', f.x, f.y, 0);
    update({ selectedPiece: f.y * MAP_W + f.x });
    expect(q(root, '[data-inspector] .tag')!.textContent).toBe('Construction');
  });

  it('the sculpture: Remove follows the room in storage in place, says how much scrap cannot come back, and pays exactly that', () => {
    const { s, root, update } = setup();
    const [p] = freeTiles(s, 1);
    placePiece(s, 'sculpture', p.x, p.y, 0);
    const i = p.y * MAP_W + p.x;
    s.res.scrap = 100; // room for all 10
    update({ selectedPiece: i });
    const panel = q(root, '[data-inspector]')!;
    const btn = q(panel, '[data-remove-piece]')!;
    const room = q(panel, '[data-scrap-room]')!;
    expect(btn.textContent).toBe('Remove (+5 credits + 10 scrap)');
    expect(room.hidden).toBe(true);
    // the bots fill the store: the same button, its words changed
    s.res.scrap = s.derived.storage - 3;
    update({ selectedPiece: i });
    expect(q(panel, '[data-remove-piece]')).toBe(btn);
    expect(btn.textContent).toBe('Remove (+5 credits + 3 scrap)');
    expect(room.hidden).toBe(false);
    expect(room.textContent).toBe('Storage has room for 3 of the 10 scrap: the rest is not given back.');
    const before = { ...s.res };
    expect(removePieceAt(s, p.x, p.y)).toEqual({ credits: 5, scrap: 3 });
    expect([s.res.credits - before.credits, s.res.parts - before.parts, s.res.scrap - before.scrap]).toEqual([5, 0, 3]);
    // full: no scrap back at all
    s.res.scrap = 20;
    placePiece(s, 'sculpture', p.x, p.y, 0);
    s.res.scrap = s.derived.storage;
    update({ selectedPiece: i });
    expect(q(panel, '[data-remove-piece]')!.textContent).toBe('Remove (+5 credits)');
    expect(q(panel, '[data-scrap-room]')!.textContent).toBe('Storage has room for 0 of the 10 scrap: the rest is not given back.');
  });

  it('the Remove button follows the storage every frame, not only every 100 ms: a press pays what it shows then', () => {
    const { s, root, update, hud } = setup();
    const [p] = freeTiles(s, 1);
    placePiece(s, 'sculpture', p.x, p.y, 0);
    const i = p.y * MAP_W + p.x;
    s.res.scrap = s.derived.storage - 10;
    update({ selectedPiece: i });
    const btn = q(root, '[data-remove-piece]')!;
    expect(btn.textContent).toBe('Remove (+5 credits + 10 scrap)');
    // a bot unloads 6 scrap in the next frame; the HUD's own update is up to 100 ms away: the frame's refresh
    // (session.frame, after the city's step) writes the button at once
    s.res.scrap += 6;
    hud.refreshPieceRefund(s, i);
    expect(q(root, '[data-remove-piece]')).toBe(btn);
    expect(btn.textContent).toBe('Remove (+5 credits + 4 scrap)');
    // the press then pays exactly that
    const before = { ...s.res };
    const paid = removePieceAt(s, p.x, p.y)!;
    expect(`Remove (+${costText(paid)})`).toBe(btn.textContent);
    expect([s.res.credits - before.credits, s.res.scrap - before.scrap]).toEqual([5, 4]);
    // another tile, or the panel showing something else: the refresh writes nothing
    placePiece(s, 'sculpture', p.x, p.y, 0);
    update({ selectedPiece: i });
    const text = btn.isConnected ? btn.textContent : q(root, '[data-remove-piece]')!.textContent;
    s.res.scrap = 0;
    hud.refreshPieceRefund(s, i + 1);
    expect(q(root, '[data-remove-piece]')!.textContent).toBe(text);
  });

  it('in Italian too', async () => {
    const { setLang } = await import('../src/i18n');
    setLang('it');
    try {
      const { s, root, update } = setup();
      const [p] = freeTiles(s, 1);
      placePiece(s, 'cathouse' as PieceKind, p.x, p.y, 2);
      update({ selectedPiece: p.y * MAP_W + p.x });
      expect(q(root, '[data-inspector] h3')!.textContent).toBe('Casetta di Miso');
      expect(q(root, '[data-inspector] .tag')!.textContent).toBe('Decorazioni');
      expect(q(root, '[data-inspector] [data-remove-piece]')!.textContent).toBe('Rimuovi (+5 crediti)');
    } finally {
      setLang('en');
    }
  });
});
