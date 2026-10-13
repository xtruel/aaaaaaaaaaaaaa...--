// @vitest-environment jsdom
// Dialogs: Esc (and the controller's B, which sends Esc) goes back one step when a dialog was opened from
// another one, never closes a dialog that asks a real question, and gives the focus back to what opened it. Its
// buttons take no key press and no second press of a double press right after it came up (src/ui/presses.ts), nor
// do the controls in its body (a save slot, a setting, the cargo blimp's Send), nor does a dialog that came up by itself
// (a story event) take a press that began before the player could see it.
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

  // a press of the mouse at (x, y): its pointerdown (the dialog sees where it began) and its click on `target`
  const pressOn = (target: Element, x: number, y: number) => {
    target.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
    return target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1, clientX: x, clientY: y }));
  };

  it('a double press on the pause menu\'s Save game does not overwrite the save slot drawn under it; a press of its own does', () => {
    let now = 80_000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    forgetPresses();
    const save = vi.fn();
    const slots = () => {
      const body = document.createElement('div');
      body.innerHTML = '<button type="button" data-slot="2">Overwrite</button>';
      body.querySelector('button')!.addEventListener('click', save);
      openModal({ title: 'Save game', body });
    };
    openModal({ title: 'Paused', body: '', actions: [{ label: 'Save game', onClick: slots }] });
    pressOn(document.querySelector('#modal-root .modal-actions .btn')!, 782, 416);
    expect(title()).toBe('Save game');
    // the second click of the double click, 250 ms later, on slot 2's Overwrite now under the pointer
    now += 250;
    pressOn(document.querySelector('#modal-root [data-slot="2"]')!, 783, 416);
    expect(save).not.toHaveBeenCalled();
    // a touch double tap lands a little further off: still the same double press
    openModal({ title: 'Paused', body: '', actions: [{ label: 'Save game', onClick: slots }] });
    now += 2000;
    const tap = (target: Element, x: number, y: number) => {
      target.dispatchEvent(Object.assign(new MouseEvent('pointerdown', { bubbles: true, clientX: x, clientY: y }), { pointerType: 'touch' }));
      target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1, clientX: x, clientY: y }));
    };
    tap(document.querySelector('#modal-root .modal-actions .btn')!, 782, 416);
    now += 400;
    tap(document.querySelector('#modal-root [data-slot="2"]')!, 798, 422);
    expect(save).not.toHaveBeenCalled();
    // a press of its own, later: saved
    now += 700;
    pressOn(document.querySelector('#modal-root [data-slot="2"]')!, 783, 416);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('a control in a dialog\'s body takes one press of a double press: the cargo blimp sends once (mouse, finger, A A)', () => {
    let now = 90_000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    forgetPresses();
    let sent = 0;
    const body = document.createElement('div');
    // drawn again after each press, as openTrade does
    const render = () => {
      body.innerHTML = '<button type="button" data-send="credits:100">Send 100</button><button type="button" data-take="credits:100">Take 100</button>';
      body.querySelector('[data-send]')!.addEventListener('click', () => {
        sent++;
        render();
      });
    };
    render();
    openModal({ title: 'Cargo blimp', body, actions: [{ label: 'Done', primary: true, onClick: closeModal }] });
    const send = () => document.querySelector('#modal-root [data-send]')!;
    now += 3000;
    pressOn(send(), 680, 401);
    now += 150;
    pressOn(send(), 680, 401);
    expect(sent).toBe(1);
    // a second click 500 ms after the first, read a little late: still one double press
    now += 2000;
    pressOn(send(), 680, 401);
    now += 560;
    pressOn(send(), 681, 402);
    expect(sent).toBe(2);
    // the pad's A twice on the focused Send (clicks with no pointer)
    now += 2000;
    (send() as HTMLButtonElement).click();
    now += 200;
    (send() as HTMLButtonElement).click();
    expect(sent).toBe(3);
    // A on Send again after the guard, and A on another control right away: both meant
    now += 700;
    (send() as HTMLButtonElement).click();
    expect(sent).toBe(4);
    // two presses of their own, far apart on the screen, in quick succession: both meant
    now += 700;
    pressOn(send(), 680, 401);
    now += 300;
    pressOn(send(), 300, 120);
    expect(sent).toBe(6);
  });

  it('the second press of the double press on Settings toggles no setting under it; a press of its own does', () => {
    let now = 100_000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    forgetPresses();
    const settings = () => {
      const body = document.createElement('form');
      body.innerHTML = '<label class="check" for="set-motion"><input id="set-motion" type="checkbox" /> Reduce motion</label>';
      openModal({ title: 'Settings', body });
    };
    openModal({ title: 'Paused', body: '', actions: [{ label: 'Settings', onClick: settings }] });
    pressOn(document.querySelector('#modal-root .modal-actions .btn')!, 640, 533);
    const box = () => document.querySelector<HTMLInputElement>('#set-motion')!;
    now += 250;
    pressOn(document.querySelector('#modal-root label.check')!, 641, 533);
    expect(box().checked).toBe(false);
    // on the checkbox itself
    now += 100;
    pressOn(box(), 640, 534);
    expect(box().checked).toBe(false);
    // a press of its own on the label (the label passes it on to its checkbox): toggled once
    now += 700;
    pressOn(document.querySelector('#modal-root label.check')!, 641, 533);
    expect(box().checked).toBe(true);
    // Space on the checkbox right after (a click with no pointer, another control than the label): toggled back
    now += 100;
    box().click();
    expect(box().checked).toBe(false);
  });

  it('a dialog that came up by itself takes no press that began before the player could see it; a press of its own works', () => {
    let now = 110_000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    forgetPresses();
    const fund = vi.fn();
    const event = (unprompted: boolean) =>
      openModal({ title: 'Park petition', body: '', dismissable: false, unprompted, actions: [{ label: 'Fund a park (40 cr)', onClick: fund }, { label: 'Maybe next quarter', onClick: closeModal }] });
    // the player presses on the map every 0.8 s; the story event comes up between two presses
    document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 300, clientY: 300 }));
    now += 700;
    event(true);
    const choice = () => document.querySelector('#modal-root .modal-actions .btn')!;
    for (const after of [84, 203, 353, 504]) {
      now += after - (after === 84 ? 0 : [84, 203, 353, 504][[84, 203, 353, 504].indexOf(after) - 1]);
      pressOn(choice(), 640, 459);
    }
    expect(fund).not.toHaveBeenCalled();
    expect(title()).toBe('Park petition');
    now += 200;
    pressOn(choice(), 640, 459);
    expect(fund).toHaveBeenCalledTimes(1);
    // a dialog the player opened takes a quick press of its own (not a double press) at once
    now += 700;
    event(false);
    now += 200;
    pressOn(choice(), 640, 459);
    expect(fund).toHaveBeenCalledTimes(2);
  });
});
