// @vitest-environment jsdom
// The HUD side of G3 (docs/MODULAR-INC2.md §3b, §3c): the catalog rows of the six new pieces, the panel of a selected
// wall, pillar, base, tree, fountain or statue (Rotate where it turns, Move only for decorations, Remove with what it
// really gives back), and the panel while a decoration is being moved (what to do, Done; no Remove), with the guard
// against the second press of a double press on Move or Done (each takes the other's place).
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { placeBuilding, placeCheck } from '../src/game/actions';
import { MAP_W, T } from '../src/game/defs';
import { placePiece } from '../src/game/pieces';
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
afterEach(() => {
  vi.restoreAllMocks();
  forgetPresses();
  document.body.classList.remove('pad-mode');
});

function city(): GameState {
  const s = createGame({ seed: 71, cityName: 'Constructions' });
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
    if (x > 2 && (s.tiles[i] === T.GROUND || s.tiles[i] === T.GRASS) && s.occ[i] === -1 && !s.solid[i] && !s.floor[i]) out.push({ x, y: Math.floor(i / MAP_W) });
  }
  return out;
}

const HANDLERS = ['onBuild', 'onBulldoze', 'onImport', 'onSpeed', 'onMenu', 'onDemolish', 'onTogglePause', 'onCloseInspector', 'onHint', 'onRegion', 'onCatalog', 'onPick', 'onRotate', 'onInstall', 'onRemoveModule', 'onRotatePiece', 'onMovePiece', 'onEndMove', 'onRemovePiece'];

function setup(s = city()) {
  document.body.innerHTML = '<div class="hud"></div>';
  const calls: [string, ...unknown[]][] = [];
  const record =
    (name: string) =>
    (...args: unknown[]) =>
      calls.push([name, ...args]);
  const handlers = Object.fromEntries(HANDLERS.map((n) => [n, record(n)])) as unknown as HudHandlers;
  const root = document.querySelector<HTMLElement>('.hud')!;
  const hud = new Hud(root, handlers, s);
  const view: HudView = { speed: 1, build: null, bulldoze: false, selectedId: -1, goalCard: true, piece: null, catalog: false, selectedPiece: -1, moving: -1 };
  const update = (v: Partial<HudView> = {}) => hud.update(s, { ...view, ...v });
  return { s, root, calls, update, hud };
}

const q = (root: Element, sel: string) => root.querySelector<HTMLElement>(sel);

describe('catalog: the six G3 pieces', () => {
  it('base, wall and pillar under Construction, tree, fountain and statue under Decorations, each with its price and words', () => {
    const { s, root, update } = setup();
    update({ catalog: true });
    const panel = q(root, '[data-catalog-panel]')!;
    // one category at a time (G4): its tab shows its list
    const list = (cat: string) => {
      q(panel, `[data-cat="${cat}"]`)!.click();
      return [...panel.querySelectorAll<HTMLElement>('[data-item]')].map((b) => b.dataset.item);
    };
    expect(list('construction')).toEqual(['floor', 'fence', 'gate', 'base', 'wall', 'pillar']);
    expect(list('decorations')).toEqual(['lamp', 'bench', 'planter', 'sign', 'pergola', 'cathouse', 'sculpture', 'tree', 'fountain', 'statue']);
    const item = (k: string) => {
      q(panel, `[data-cat="${['tree', 'fountain', 'statue'].includes(k) ? 'decorations' : 'construction'}"]`)!.click();
      return q(panel, `[data-item="${k}"]`)!;
    };
    const want: Record<string, [string, string, string, string]> = {
      base: ['Concrete base', '4', '', ''],
      wall: ['Low wall', '2', '', '4'],
      pillar: ['Corner pillar', '6', '', ''],
      tree: ['Tree', '8', '', ''],
      fountain: ['Fountain', '25', '5', ''],
      statue: ['Statue of USA-9', '20', '10', ''],
    };
    for (const [k, [name, credits, parts, scrap]] of Object.entries(want)) {
      expect(item(k).querySelector('.cat-name')!.textContent, k).toBe(name);
      expect(item(k).querySelector('.cost-credits')?.textContent ?? '', k).toBe(credits);
      expect(item(k).querySelector('.cost-parts')?.textContent ?? '', k).toBe(parts);
      expect(item(k).querySelector('.cost-scrap')?.textContent ?? '', k).toBe(scrap);
      expect(item(k).querySelector('.cat-effect')!.textContent!.length, k).toBeGreaterThan(10);
      expect(item(k).querySelector('.cat-limit')!.textContent).toBe('1 per tile');
    }
    expect(item('fence').querySelector('.cat-effect')!.textContent).toBe('Joins up with fences, walls, pillars and gates');
    expect(item('tree').querySelector('.cat-effect')!.textContent).toContain('no effect on smog or happiness');
    // too little scrap for a wall: greyed out with what is missing
    s.res.scrap = 1;
    item('wall');
    update({ catalog: true });
    expect(item('wall').classList.contains('cant')).toBe(true);
    expect(item('wall').querySelector('.cat-reason')!.textContent).toBe('Missing 3 scrap');
  });
});

describe('the panel of a selected G3 piece', () => {
  it('constructions: Rotate only for a lone wall, no Move, Remove with the refund; decorations: Move', () => {
    const { s, root, calls, update } = setup();
    const tiles = freeTiles(s, 12);
    const kinds: PieceKind[] = ['base', 'wall', 'pillar', 'tree', 'fountain', 'statue'];
    const expectRefund: Record<string, string> = { base: '2 credits', wall: '1 credit + 2 scrap', pillar: '3 credits', tree: '4 credits', fountain: '12 credits + 2 parts', statue: '10 credits + 5 parts' };
    kinds.forEach((k, n) => {
      const { x, y } = tiles[n * 2];
      expect(placePiece(s, k, x, y, 1)).toBe(true);
      const i = y * MAP_W + x;
      update({ selectedPiece: i });
      const panel = q(root, '[data-inspector]')!;
      expect(panel.hidden).toBe(false);
      const deco = ['tree', 'fountain', 'statue'].includes(k);
      expect(q(panel, '.tag')!.textContent, k).toBe(deco ? 'Decorations' : 'Construction');
      expect(!!q(panel, '[data-rotate]'), k).toBe(k === 'wall' || k === 'statue');
      expect(!!q(panel, '[data-move-piece]'), k).toBe(deco);
      expect(q(panel, '[data-remove-piece]')!.textContent).toBe(`Remove (+${expectRefund[k]})`);
      if (deco) {
        expect(q(panel, '[data-move-piece]')!.textContent).toBe('Move');
        q(panel, '[data-move-piece]')!.click();
        expect(calls.at(-1)).toEqual(['onMovePiece', i]);
      }
    });
    // a wall joined to a pillar does not turn
    const rest = freeTiles(s, 200);
    const a = rest.find((t) => rest.some((u) => u.x === t.x + 1 && u.y === t.y))!;
    expect(placePiece(s, 'wall', a.x, a.y, 0)).toBe(true);
    expect(placePiece(s, 'pillar', a.x + 1, a.y)).toBe(true);
    update({ selectedPiece: a.y * MAP_W + a.x });
    expect(q(root, '[data-inspector] [data-rotate]')).toBeNull();
    // the wall's scrap: no more than storage has room for, said on the button and under it
    s.res.scrap = s.derived.storage - 1;
    update({ selectedPiece: a.y * MAP_W + a.x });
    expect(q(root, '[data-inspector] [data-remove-piece]')!.textContent).toBe('Remove (+1 credit + 1 scrap)');
    expect(q(root, '[data-inspector] [data-scrap-room]')!.textContent).toBe('Storage has room for 1 of the 2 scrap: the rest is not given back.');
  });

  it('while moving: what to do (mouse and touch, or the pad\'s buttons) and Done; no Rotate, Move or Remove', () => {
    const { s, root, calls, update } = setup();
    const [p] = freeTiles(s, 1);
    placePiece(s, 'statue', p.x, p.y, 2);
    const i = p.y * MAP_W + p.x;
    update({ selectedPiece: i });
    expect(q(root, '[data-inspector] [data-move-piece]')).not.toBeNull();
    update({ selectedPiece: i, moving: i });
    const panel = q(root, '[data-inspector]')!;
    expect(q(panel, 'h3')!.textContent).toBe('Statue of USA-9');
    expect(q(panel, '.cat-help')!.textContent).toBe('Move · Click or tap a tile to move it there: free, it keeps its direction and look.');
    expect(q(panel, '[data-rotate]')).toBeNull();
    expect(q(panel, '[data-move-piece]')).toBeNull();
    expect(q(panel, '[data-remove-piece]')).toBeNull();
    q(panel, '[data-move-done]')!.click();
    expect(calls.at(-1)).toEqual(['onEndMove']);
    // with a controller: its buttons
    document.body.classList.add('pad-mode');
    update({ selectedPiece: i, moving: i });
    expect(q(root, '[data-inspector] .cat-help')!.innerHTML).toContain('<kbd>A</kbd> moves it to the tile under the cursor, <kbd>B</kbd> leaves it where it is.');
    // the move over: the plain panel again
    document.body.classList.remove('pad-mode');
    update({ selectedPiece: i, moving: -1 });
    expect(q(root, '[data-inspector] [data-move-piece]')).not.toBeNull();
    expect(q(root, '[data-inspector] [data-remove-piece]')).not.toBeNull();
  });

  it('Move and Done take each other\'s place: the second press of a double press on one does nothing on the other', () => {
    const { s, root, calls, update } = setup();
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    forgetPresses();
    const press = (el: HTMLElement, x: number, y: number) => {
      notePress({ t: now, x, y, cam: '', tile: '' });
      el.click();
    };
    const [p] = freeTiles(s, 1);
    placePiece(s, 'tree', p.x, p.y);
    const i = p.y * MAP_W + p.x;
    update({ selectedPiece: i });
    press(q(root, '[data-move-piece]')!, 1000, 200);
    expect(calls).toEqual([['onMovePiece', i]]);
    // the panel turns into the move's: the double click's second press lands on Done
    update({ selectedPiece: i, moving: i });
    now += 80;
    press(q(root, '[data-move-done]')!, 1000, 200);
    expect(calls).toEqual([['onMovePiece', i]]);
    // a press of its own, a moment later, ends the move
    now += 900;
    press(q(root, '[data-move-done]')!, 1000, 200);
    expect(calls.at(-1)).toEqual(['onEndMove']);
    // Done pressed twice: the second press does not start a new move on the Move button that comes under it
    update({ selectedPiece: i, moving: i });
    now += 900;
    press(q(root, '[data-move-done]')!, 1000, 200);
    update({ selectedPiece: i, moving: -1 });
    now += 70;
    press(q(root, '[data-move-piece]')!, 1000, 200);
    expect(calls.filter((c) => c[0] === 'onMovePiece')).toHaveLength(1);
    expect(calls.at(-1)).toEqual(['onEndMove']);
  });

  it('a planter, tree or fountain: Remove comes where Done was when a move ends; the second press of a double press on Done takes nothing up', () => {
    const { s, root, calls, update } = setup();
    let now = 5000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    forgetPresses();
    const press = (el: HTMLElement, x: number, y: number) => {
      notePress({ t: now, x, y, cam: '', tile: '' });
      el.click();
    };
    const tiles = freeTiles(s, 6);
    (['planter', 'tree', 'fountain'] as PieceKind[]).forEach((kind, n) => {
      const { x, y } = tiles[n * 2];
      expect(placePiece(s, kind, x, y)).toBe(true);
      const i = y * MAP_W + x;
      update({ selectedPiece: i, moving: i });
      // nothing to turn: the plain panel has Move and Remove, and Remove is the button the move's Done gives way to
      now += 2000;
      press(q(root, '[data-move-done]')!, 1100, 260);
      expect(calls.at(-1)).toEqual(['onEndMove']);
      update({ selectedPiece: i, moving: -1 });
      expect(q(root, '[data-inspector] [data-rotate]'), kind).toBeNull();
      const n0 = calls.length;
      for (const ms of [80, 300, 590]) {
        now += ms;
        press(q(root, '[data-inspector] [data-remove-piece]')!, 1100, 260);
        expect(calls.length, `${kind}, second press ${ms} ms after Done`).toBe(n0);
        now -= ms;
      }
      // a press of its own takes it up
      now += 1500;
      press(q(root, '[data-inspector] [data-remove-piece]')!, 1100, 260);
      expect(calls.at(-1)).toEqual(['onRemovePiece', i]);
    });
  });

  it('a double press on the map where the panel opens: the second press lands on Remove or Install and does nothing', () => {
    const { s, root, calls, update } = setup();
    let now = 9000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    forgetPresses();
    // the first press: on the map (a tile, the map where it is), selecting the piece or the building
    const onMap = (x: number, y: number) => notePress({ t: now, x, y, cam: '1,2,3', tile: '9,9' });
    const onPanel = (el: HTMLElement, x: number, y: number, touch = false) => {
      notePress({ t: now, x, y, cam: '1,2,3', tile: '', touch });
      el.click();
    };
    const [p] = freeTiles(s, 1);
    expect(placePiece(s, 'lamp', p.x, p.y, 0)).toBe(true);
    const i = p.y * MAP_W + p.x;
    // a double click (mouse: the same spot), a double tap (a finger: 15 px off)
    for (const [dx, touch] of [
      [0, false],
      [15, true],
    ] as const) {
      now += 2000;
      onMap(1100, 300);
      update({ selectedPiece: i });
      now += 120;
      onPanel(q(root, '[data-inspector] [data-remove-piece]')!, 1100 + dx, 300, touch);
      expect(calls.some((c) => c[0] === 'onRemovePiece')).toBe(false);
    }
    // a press of its own
    now += 1000;
    onPanel(q(root, '[data-inspector] [data-remove-piece]')!, 1100, 300);
    expect(calls.at(-1)).toEqual(['onRemovePiece', i]);
    // a finished Bot Dock: Install under the second press of a double tap on the Dock buys nothing
    const hq = s.buildings[0];
    let dock = null as ReturnType<typeof placeBuilding>;
    for (let r = 3; r < 20 && !dock; r++)
      for (let dy = -r; dy <= r && !dock; dy++)
        for (let dx = -r; dx <= r && !dock; dx++) if (placeCheck(s, 'dock', hq.x + dx, hq.y + dy).ok) dock = placeBuilding(s, 'dock', hq.x + dx, hq.y + dy);
    dock!.built = 1;
    computeDerived(s);
    now += 2000;
    onMap(1130, 548);
    update({ selectedId: dock!.id, selectedPiece: -1 });
    now += 150;
    onPanel(q(root, '[data-inspector] [data-install="dockStorage"]')!, 1132, 550, true);
    expect(calls.some((c) => c[0] === 'onInstall')).toBe(false);
    // a press of its own installs
    now += 1000;
    update({ selectedId: dock!.id, selectedPiece: -1 });
    onPanel(q(root, '[data-inspector] [data-install="dockStorage"]')!, 1130, 548);
    expect(calls.at(-1)).toEqual(['onInstall', dock!.id, 'dockStorage']);
  });

  it('in Italian too', async () => {
    const { setLang } = await import('../src/i18n');
    setLang('it');
    try {
      const { s, root, update } = setup();
      const [p] = freeTiles(s, 1);
      placePiece(s, 'fountain', p.x, p.y);
      const i = p.y * MAP_W + p.x;
      update({ selectedPiece: i });
      expect(q(root, '[data-inspector] h3')!.textContent).toBe('Fontana');
      expect(q(root, '[data-inspector] [data-move-piece]')!.textContent).toBe('Sposta');
      expect(q(root, '[data-inspector] [data-remove-piece]')!.textContent).toBe('Rimuovi (+12 crediti + 2 pezzi)');
      update({ selectedPiece: i, moving: i });
      expect(q(root, '[data-inspector] .cat-help')!.textContent).toBe('Sposta · Clicca o tocca una casella per spostarlo lì: gratis, mantiene direzione e aspetto.');
      expect(q(root, '[data-inspector] [data-move-done]')!.textContent).toBe('Fatto');
    } finally {
      setLang('en');
    }
  });
});
