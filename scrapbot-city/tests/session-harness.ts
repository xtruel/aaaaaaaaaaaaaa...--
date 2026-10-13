// A city session in jsdom for tests of the pause menu, saves and the controller: the map's renderer is a stand-in (no
// canvas in jsdom), pictures and sounds are blank. Import this file before src/session.ts in a jsdom test.
import { vi } from 'vitest';
import type { GameState } from '../src/game/state';
import type { SessionHandlers } from '../src/session';
import type { Settings, SlotId } from '../src/storage';

vi.mock('../src/render/renderer', () => ({
  Renderer: class {
    zoom = 2;
    pxZoom = 2;
    cam = { x: 0, y: 0 };
    insets = { top: 0, bottom: 0 };
    labelAvoid: DOMRect[] = [];
    constructor(public canvas: HTMLCanvasElement) {}
    resize(): void {}
    paintAllTerrain(): void {}
    centerOn(): void {}
    clampCam(): void {}
    setZoom(): void {}
    panTiles(): void {}
    screenToTile(): { x: number; y: number } {
      return { x: 0, y: 0 };
    }
    screenToWorld(): { x: number; y: number } {
      return { x: 0, y: 0 };
    }
    tileToScreen(): { x: number; y: number } {
      return { x: 0, y: 0 };
    }
    pickBuilding(): number {
      return -1;
    }
    pickPiece(): number {
      return -1;
    }
    pickCat(): boolean {
      return false;
    }
    buildingScreenBox(): { left: number; top: number; right: number; bottom: number } {
      return { left: 0, top: 0, right: 0, bottom: 0 };
    }
    pieceScreenBox(): { left: number; top: number; right: number; bottom: number } {
      return { left: 0, top: 0, right: 0, bottom: 0 };
    }
    render(): void {}
    onFx(): void {}
  },
}));
vi.mock('../src/render/icons', () => ({ iconUrl: () => '', toolThumb: () => '', portraitUrl: () => '', buildingThumb: () => '', pathColor: () => 'var(--muted)' }));
vi.mock('../src/render/iso/atlas', async (orig) => ({ ...(await orig<typeof import('../src/render/iso/atlas')>()), atlasImage: () => null, frame: () => undefined }));
vi.mock('../src/render/sprites', () => ({
  PAL: { ink: '#000', orange: '#f80', white: '#fff' },
  makeCanvas: () => [{ toDataURL: () => 'data:,' }, { fillRect: () => {}, drawImage: () => {}, fillStyle: '' }],
}));
vi.mock('../src/audio', () => ({ audio: { play: () => {}, unlock: () => {}, suspend: () => {}, resume: () => {}, setMusic: () => {}, setVolumes: () => {} } }));

export const SETTINGS: Settings = { sfx: 0, music: 0, crt: false, edgeScroll: false, reducedMotion: true, fullscreen: false, lang: 'en' };

export function handlers(): SessionHandlers & Record<string, ReturnType<typeof vi.fn>> {
  return {
    onExitToMenu: vi.fn(),
    onLoadSlot: vi.fn(),
    onNewGame: vi.fn(),
    onRegionMap: vi.fn(),
    onRestartCity: vi.fn(),
    onTutorialDone: vi.fn(),
    onSettingsChanged: vi.fn(),
  } as SessionHandlers & Record<string, ReturnType<typeof vi.fn>>;
}

// the page as main.ts builds it
export function page(): HTMLElement {
  globalThis.ResizeObserver = class {
    observe(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView = () => {};
  document.body.innerHTML = '<div id="app"><section class="screen game" id="game"></section></div><div id="modal-root"></div><div class="toasts" id="toasts"></div>';
  return document.getElementById('game')!;
}

// a clock the test moves (presses apart by more than the double-press guard)
export function clock(start = 1_000_000): { tick(ms?: number): number } {
  let now = start;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  return { tick: (ms = 700) => (now += ms) };
}

// the buttons of the open dialog: [label, hint] and a press of one of them (a press of its own: the clock moves first)
export function dialogButtons(): { label: string; hint: string }[] {
  return [...document.querySelectorAll<HTMLButtonElement>('#modal-root .modal-actions .btn')].map((b) => ({ label: b.querySelector('span')?.textContent ?? '', hint: b.querySelector('small')?.textContent ?? '' }));
}

export function pressButton(c: { tick(ms?: number): number }, label: string, scope = '#modal-root'): void {
  c.tick();
  const btn = [...document.querySelectorAll<HTMLButtonElement>(`${scope} button`)].find((b) => (b.querySelector('span')?.textContent ?? b.textContent ?? '').trim() === label);
  if (!btn) throw new Error(`no button "${label}" in ${[...document.querySelectorAll(`${scope} button`)].map((b) => b.textContent?.trim()).join(' | ')}`);
  btn.click();
}

export function savedTime(slot: SlotId): number | null {
  const raw = localStorage.getItem(`scrapbot:save:${slot}`);
  return raw ? (JSON.parse(raw) as { time: number }).time : null;
}

export type { GameState };
