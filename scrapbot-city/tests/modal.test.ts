// @vitest-environment jsdom
// Dialogs: Esc (and the controller's B, which sends Esc) goes back one step when a dialog was opened from
// another one, never closes a dialog that asks a real question, and gives the focus back to what opened it. Its
// buttons take no key press and no second press of a double press right after it came up (src/ui/presses.ts).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeModal, isModalOpen, openModal } from '../src/ui/modal';
import { PRESS_GUARD_MS, forgetPresses, notePress } from '../src/ui/presses';

const esc = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
const title = () => document.querySelector('#modal-root h2')?.textContent ?? null;

beforeEach(() => {
  closeModal();
  document.body.innerHTML = '<div id="app"><div class="screen"><button id="opener">Menu</button></div></div><div id="modal-root"></div>';
});

afterEach(() => vi.restoreAllMocks());

describe('dialogs', () => {
  it('Esc on a dialog with a Back step goes back instead of closing everything', () => {
    const pause = () => openModal({ title: 'Paused', body: '' });
    pause();
    openModal({ title: 'Settings', body: '', onBack: pause });
    esc();
    expect(title()).toBe('Paused');
    esc();
    expect(isModalOpen()).toBe(false);
  });

  it('the × button and the backdrop also go back one step', () => {
    const pause = () => openModal({ title: 'Paused', body: '' });
    pause();
    openModal({ title: 'Save game', body: '', onBack: pause });
    (document.querySelector('#modal-root .modal-x') as HTMLButtonElement).click();
    expect(title()).toBe('Paused');
    openModal({ title: 'Save game', body: '', onBack: pause });
    const backdrop = document.querySelector('#modal-root .modal-backdrop')!;
    backdrop.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(title()).toBe('Paused');
  });

  it('a dialog with two real choices ignores Esc, the × and the backdrop', () => {
    const onClose = vi.fn();
    openModal({ title: 'Replace your city?', body: '', dismissable: false, onClose, actions: [{ label: 'Keep', onClick: closeModal }] });
    esc();
    document.querySelector('#modal-root .modal-backdrop')!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(title()).toBe('Replace your city?');
    expect(document.querySelector('#modal-root .modal-x')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closing the last dialog gives the focus back to the button that opened it', () => {
    const opener = document.getElementById('opener') as HTMLButtonElement;
    opener.focus();
    openModal({ title: 'Paused', body: '' });
    // a second dialog replaces the first: the opener is still the menu button
    openModal({ title: 'Settings', body: '' });
    expect(opener.closest('.screen')!.hasAttribute('inert') || (opener.closest('.screen') as HTMLElement).inert).toBeTruthy();
    closeModal();
    expect(document.activeElement).toBe(opener);
  });

  it('a button takes no key or A press, and no second press of a double press, in its first 600 ms; a press of its own works', () => {
    let now = 50_000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    forgetPresses();
    const buy = vi.fn();
    const press = (x: number, y: number) => notePress({ t: now, x, y, cam: 'c', tile: '' });
    // the first press of a double click on the map opens 2PM's offer to buy the missing parts and build
    press(400, 300);
    openModal({ title: '2PM', body: '', actions: [{ label: 'Buy and build', primary: true, onClick: buy }] });
    const btn = document.querySelector<HTMLButtonElement>('#modal-root .modal-actions .btn')!;
    // the second click, 450 ms later, a few px off, lands on the offer's button: nothing bought
    now += 450;
    press(403, 302);
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 2 }));
    expect(buy).not.toHaveBeenCalled();
    // the controller's A (or Enter) pressed again 550 ms after it came up: a click with no pointer (detail 0)
    now += 100;
    btn.click();
    expect(buy).not.toHaveBeenCalled();
    // a press of its own elsewhere first, then on the button, even soon: meant
    now += 20;
    press(150, 600);
    now += 20;
    press(400, 300);
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    expect(buy).toHaveBeenCalledTimes(1);
    // and A after the guard
    openModal({ title: '2PM', body: '', actions: [{ label: 'Buy and build', primary: true, onClick: buy }] });
    now += PRESS_GUARD_MS;
    document.querySelector<HTMLButtonElement>('#modal-root .modal-actions .btn')!.click();
    expect(buy).toHaveBeenCalledTimes(2);
  });
});
