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
