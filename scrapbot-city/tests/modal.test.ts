// @vitest-environment jsdom
// Dialogs: Esc (and the controller's B, which sends Esc) goes back one step when a dialog was opened from
// another one, never closes a dialog that asks a real question, and gives the focus back to what opened it.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { closeModal, isModalOpen, openModal } from '../src/ui/modal';

const esc = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
const title = () => document.querySelector('#modal-root h2')?.textContent ?? null;

beforeEach(() => {
  closeModal();
  document.body.innerHTML = '<div id="app"><div class="screen"><button id="opener">Menu</button></div></div><div id="modal-root"></div>';
});

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
});
