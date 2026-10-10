// One modal at a time, rendered into #modal-root. Keyboard: Esc closes when allowed.
import { audio } from '../audio';

export interface ModalAction {
  label: string;
  primary?: boolean;
  disabled?: boolean;
  tone?: 'green' | 'industrial' | 'neutral' | 'danger';
  hint?: string;
  onClick: () => void;
}

export interface ModalOptions {
  title: string;
  eyebrow?: string;
  body: string | HTMLElement;
  portrait?: string;
  actions?: ModalAction[];
  dismissable?: boolean;
  wide?: boolean;
  className?: string;
  onClose?: () => void;
}

let current: { el: HTMLElement; opts: ModalOptions } | null = null;

// Registered before any screen's own key handler, so Esc closes the dialog and nothing else.
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !current) return;
  e.stopImmediatePropagation();
  e.preventDefault();
  if (current.opts.dismissable !== false) closeModal();
});

export function isModalOpen(): boolean {
  return current !== null;
}

export function closeModal(): void {
  if (!current) return;
  const { el, opts } = current;
  current = null;
  el.remove();
  opts.onClose?.();
}

export function openModal(opts: ModalOptions): HTMLElement {
  if (current) {
    // replace without firing the previous onClose
    current.el.remove();
    current = null;
  }
  const root = document.getElementById('modal-root')!;
  const el = document.createElement('div');
  el.className = 'modal-backdrop';
  const dialog = document.createElement('div');
  dialog.className = `modal ${opts.wide ? 'modal-wide' : ''} ${opts.className ?? ''}`;
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', opts.title);

  const head = document.createElement('div');
  head.className = 'modal-head';
  if (opts.portrait) {
    const img = document.createElement('img');
    img.className = 'portrait';
    img.src = opts.portrait;
    img.alt = '';
    head.append(img);
  }
  const titles = document.createElement('div');
  if (opts.eyebrow) {
    const eb = document.createElement('p');
    eb.className = 'eyebrow';
    eb.textContent = opts.eyebrow;
    titles.append(eb);
  }
  const h = document.createElement('h2');
  h.textContent = opts.title;
  titles.append(h);
  head.append(titles);
  if (opts.dismissable !== false) {
    const x = document.createElement('button');
    x.className = 'modal-x';
    x.type = 'button';
    x.setAttribute('aria-label', 'Close');
    x.textContent = '×';
    x.addEventListener('click', () => {
      audio.play('click');
      closeModal();
    });
    head.append(x);
  }
  dialog.append(head);

  const body = document.createElement('div');
  body.className = 'modal-body';
  if (typeof opts.body === 'string') body.innerHTML = opts.body;
  else body.append(opts.body);
  dialog.append(body);

  // Keys held when the dialog pops up (Space to pause, Enter) must not pick a story choice by accident.
  const openedAt = performance.now();
  if (opts.actions?.length) {
    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    for (const a of opts.actions) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `btn ${a.primary ? 'btn-primary' : ''} ${a.tone ? `tone-${a.tone}` : ''}`;
      b.disabled = !!a.disabled;
      b.innerHTML = `<span>${a.label}</span>${a.hint ? `<small>${a.hint}</small>` : ''}`;
      b.addEventListener('click', (e) => {
        if (e.detail === 0 && performance.now() - openedAt < 400) return;
        audio.play('click');
        a.onClick();
      });
      actions.append(b);
    }
    dialog.append(actions);
  }

  el.append(dialog);
  if (opts.dismissable !== false) {
    el.addEventListener('pointerdown', (e) => {
      if (e.target === el) closeModal();
    });
  }
  root.append(el);
  current = { el, opts };
  // Focus the dialog itself (Tab reaches the buttons) or its first text field; never pre-select a choice.
  const field = dialog.querySelector<HTMLElement>('input[type="text"], input[type="number"]');
  dialog.tabIndex = -1;
  (field ?? dialog).focus();
  return dialog;
}
