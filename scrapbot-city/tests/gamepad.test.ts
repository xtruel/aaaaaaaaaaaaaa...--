// @vitest-environment jsdom
// The controller in menus and dialogs (src/gamepad.ts, menuFrame): the D-pad (or the left stick) moves the focus to
// the nearest control on that side, A presses it. Laid out here with the boxes measured in the browser (jsdom has no
// layout), so what is tested is the choice of the next control.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { menuFrame } from '../src/gamepad';
import type { PadButton } from '../src/gamepad';

type Box = [left: number, top: number, width: number, height: number];

// each element with data-box="left,top,width,height" reports that box
function layout(): void {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const b = (this as HTMLElement).dataset?.box?.split(',').map(Number) as Box | undefined;
    const [left, top, width, height] = b ?? [0, 0, 0, 0];
    return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) } as DOMRect;
  });
}
const box = (b: Box) => `data-box="${b.join(',')}"`;
const frame = (pressed: PadButton[], o: Partial<{ ry: number; dt: number }> = {}) => ({ dt: o.dt ?? 1 / 60, lx: 0, ly: 0, rx: 0, ry: o.ry ?? 0, pressed: new Set(pressed), held: new Set(pressed) });
const focused = () => (document.activeElement as HTMLElement | null)?.id || (document.activeElement as HTMLElement | null)?.dataset.act || '';

beforeEach(() => {
  Element.prototype.scrollIntoView = () => {};
});
afterEach(() => vi.restoreAllMocks());

describe('pad in dialogs', () => {
  it('Settings: down and up walk through every control, the four checkboxes included (1280x720)', () => {
    // the Settings dialog as measured at 1280x720 (en): sliders and the picker as wide as the form, checkboxes at its left
    document.body.innerHTML = `<div id="modal-root"><div class="modal" ${box([440, 100, 400, 520])}>
      <button class="modal-x" id="x" ${box([800, 110, 30, 30])}>×</button>
      <form class="modal-body">
        <select id="set-lang" ${box([460, 190, 360, 36])}><option>English</option></select>
        <input id="set-sfx" type="range" ${box([460, 260, 360, 20])} />
        <input id="set-music" type="range" ${box([460, 316, 360, 20])} />
        <input id="set-crt" type="checkbox" ${box([462, 356, 20, 20])} />
        <input id="set-edge" type="checkbox" ${box([462, 388, 20, 20])} />
        <input id="set-motion" type="checkbox" ${box([462, 420, 20, 20])} />
        <input id="set-full" type="checkbox" ${box([462, 452, 20, 20])} />
      </form>
      <div class="modal-actions"><button class="btn btn-primary" id="done" ${box([460, 520, 360, 48])}>Done</button></div>
    </div></div>`;
    layout();
    document.getElementById('set-lang')!.focus();
    const walk: string[] = [];
    for (let i = 0; i < 7; i++) {
      menuFrame(frame(['down']));
      walk.push(focused());
    }
    expect(walk).toEqual(['set-sfx', 'set-music', 'set-crt', 'set-edge', 'set-motion', 'set-full', 'done']);
    const back: string[] = [];
    for (let i = 0; i < 7; i++) {
      menuFrame(frame(['up']));
      back.push(focused());
    }
    expect(back).toEqual(['set-full', 'set-motion', 'set-edge', 'set-crt', 'set-music', 'set-sfx', 'set-lang']);
  });
});

describe('pad on the main menu', () => {
  it('up and down go through the entries in their order, the highlighted (grown) entry too (1280x720)', () => {
    // the entries as measured at 1280x720: the highlighted one is drawn larger, reaching over its neighbours
    const entries = ['new', 'continue', 'load', 'settings', 'extras', 'credits', 'quit'];
    const html = (sel: string) =>
      entries
        .map((act, i) => `<button type="button" data-act="${act}" class="${act === sel ? 'selected' : ''}" ${box(act === sel ? [40, 286 + i * 44 - 12, 330, 64] : [48, 286 + i * 44, 300, 40])}>${act}</button>`)
        .join('');
    const walk = (from: string, dir: 'up' | 'down') => {
      document.body.innerHTML = `<section class="screen menu" id="menu"><nav class="menu-list">${html(from)}</nav>
        <button type="button" class="lang-pill" ${box([1100, 20, 140, 36])}>English</button></section><div id="modal-root"></div>`;
      document.querySelector<HTMLElement>(`[data-act="${from}"]`)!.focus();
      menuFrame(frame([dir]));
      return focused();
    };
    layout();
    for (let i = 1; i < entries.length; i++) expect(walk(entries[i], 'up'), `up from ${entries[i]}`).toBe(entries[i - 1]);
    for (let i = 0; i < entries.length - 1; i++) expect(walk(entries[i], 'down'), `down from ${entries[i]}`).toBe(entries[i + 1]);
  });
});

describe('pad in a dialog taller than the window', () => {
  it('the right stick scrolls it (Extras at 1280x720: the achievements hold no control to stop on)', () => {
    document.body.innerHTML = `<div id="modal-root"><div class="modal" style="overflow-y: auto" ${box([200, 8, 880, 704])}>
      <button class="modal-x" ${box([1030, 20, 30, 30])}>×</button>
      <div class="modal-body"><ul class="ach-grid"><li>Both Ways</li><li>Superstar</li></ul></div>
      <div class="modal-actions"><button class="btn btn-primary" id="back" ${box([220, 650, 840, 48])}>Back</button></div>
    </div></div>`;
    layout();
    const modal = document.querySelector<HTMLElement>('#modal-root .modal')!;
    Object.defineProperty(modal, 'scrollHeight', { value: 1538 });
    Object.defineProperty(modal, 'clientHeight', { value: 704 });
    document.getElementById('back')!.focus();
    modal.scrollTop = 0;
    // the stick pushed down for half a second, then up for a quarter
    for (let i = 0; i < 30; i++) menuFrame(frame([], { ry: 1 }));
    expect(modal.scrollTop).toBeGreaterThan(300);
    const down = modal.scrollTop;
    for (let i = 0; i < 15; i++) menuFrame(frame([], { ry: -1 }));
    expect(modal.scrollTop).toBeLessThan(down);
    expect(modal.scrollTop).toBeGreaterThan(0);
    // the focus stays where it was
    expect(focused()).toBe('back');
  });
});
