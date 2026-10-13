// @vitest-environment jsdom
// The message feed groups repeats (G5): the same line again while it is still on screen shows once with a count and
// comes down to the newest place, instead of a stack of copies pushing other news out; a different line (another
// text, another number, another tone) is never folded into it; nothing waits: every line is in the feed as soon as
// it is pushed. A line stays MSG_LIFE_MS after its last time.
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createGame } from '../src/game/state';
import type { Message } from '../src/game/state';
import { setLang } from '../src/i18n';
import { Hud, MSG_LIFE_MS } from '../src/ui/hud';
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

afterEach(() => vi.useRealTimers());

function setup() {
  setLang('en');
  vi.useFakeTimers();
  document.body.innerHTML = '<div class="hud"></div>';
  const s = createGame({ seed: 5, cityName: 'Feed' });
  const handlers = new Proxy({}, { get: () => () => {} }) as HudHandlers;
  const root = document.querySelector<HTMLElement>('.hud')!;
  const hud = new Hud(root, handlers, s);
  const view: HudView = { speed: 1, build: null, bulldoze: false, selectedId: -1, goalCard: true, piece: null, catalog: false, selectedPiece: -1 };
  hud.update(s, view);
  const lines = () => [...root.querySelectorAll<HTMLElement>('[data-feed] .msg')].map((p) => p.textContent);
  const push = (...m: Message[]) => hud.pushMessages(m);
  return { lines, push };
}

const bad = (text: string): Message => ({ text, tone: 'bad' });
const info = (text: string): Message => ({ text, tone: 'info' });

describe('message feed', () => {
  it('a line repeated in a row shows once with a count', () => {
    const { lines, push } = setup();
    push(bad('Not enough credits'), bad('Not enough credits'));
    push(bad('Not enough credits'));
    expect(lines()).toEqual(['Not enough credits ×3']);
  });

  it('a repeat between other lines is folded into its first copy, which comes down to the newest place', () => {
    const { lines, push } = setup();
    push(bad('Not enough credits'), info('Day 2'), bad('Not enough credits'), bad('Tile occupied'), info('Day 2'));
    expect(lines()).toEqual(['Not enough credits ×2', 'Tile occupied', 'Day 2 ×2']);
  });

  it('never folds a different line: another number, another word, another tone', () => {
    const { lines, push } = setup();
    push(info('Junk pile: 30 scrap'), info('Junk pile: 31 scrap'), bad('Storage full'), info('Storage full'));
    expect(lines()).toEqual(['Junk pile: 30 scrap', 'Junk pile: 31 scrap', 'Storage full', 'Storage full']);
  });

  it('a burst of repeats does not push a different line out (the feed holds five)', () => {
    const { lines, push } = setup();
    push(info('Dock online'), info('Day 3'));
    for (let k = 0; k < 12; k++) push(bad('Not enough credits'));
    expect(lines()).toEqual(['Dock online', 'Day 3', 'Not enough credits ×12']);
  });

  it('nothing waits: a line is in the feed the moment it is pushed, repeated or not', () => {
    const { lines, push } = setup();
    push(bad('Storage full'));
    expect(lines()).toEqual(['Storage full']);
    vi.advanceTimersByTime(100);
    push(bad('Storage full'));
    expect(lines()).toEqual(['Storage full ×2']);
  });

  it('a line lasts MSG_LIFE_MS after its last time; a repeat later than that starts again at one', () => {
    const { lines, push } = setup();
    push(bad('Storage full'));
    vi.advanceTimersByTime(MSG_LIFE_MS - 1000);
    push(bad('Storage full'));
    vi.advanceTimersByTime(MSG_LIFE_MS - 1000);
    expect(lines()).toEqual(['Storage full ×2']);
    vi.advanceTimersByTime(1000);
    expect(lines()).toEqual([]);
    push(bad('Storage full'));
    expect(lines()).toEqual(['Storage full']);
  });

  it('a repeat brings back a line that was fading out', () => {
    const { push } = setup();
    push(bad('Storage full'));
    vi.advanceTimersByTime(MSG_LIFE_MS - 300);
    const p = document.querySelector<HTMLElement>('[data-feed] .msg')!;
    expect(p.classList.contains('msg-out')).toBe(true);
    push(bad('Storage full'));
    expect(p.classList.contains('msg-out')).toBe(false);
    expect(p.isConnected).toBe(true);
  });
});
