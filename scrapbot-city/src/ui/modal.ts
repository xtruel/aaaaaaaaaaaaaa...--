// One modal at a time, rendered into #modal-root. Keyboard: Esc closes when allowed.
import { audio } from '../audio';
import { t } from '../i18n';
import { dialogKeyRefused, dialogPointerRefused, guarded, markSecond, secondPress } from './presses';
import type { DialogPresses, Press } from './presses';

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
  // a dialog opened from another one (Settings from Pause): Esc, B, × and the backdrop go back one step
  onBack?: () => void;
  // it comes up by itself (a story event, an ending), not from a press: a press that began right after is no answer
  unprompted?: boolean;
}

// The last press of a mouse button or a finger anywhere, seen before any handler: the press that opens a dialog is
// known when the dialog comes up, on the main menu and the region map too (no city keeps a record there).
let down: Press & { refused?: boolean } = { t: -Infinity, x: 0, y: 0, cam: '', tile: '' };
window.addEventListener(
  'pointerdown',
  (e) => {
    down = { t: performance.now(), x: e.clientX, y: e.clientY, cam: '', tile: '', touch: e.pointerType === 'touch' };
  },
  { capture: true },
);

const CONTROLS = 'button, input, select, textarea, label, a[href]';
// (the × only closes, which is always free: it is not guarded)
const controlOf = (target: EventTarget | null): HTMLElement | null => {
  const c = target instanceof Element ? target.closest<HTMLElement>(CONTROLS) : null;
  return c?.classList.contains('modal-x') ? null : c;
};
// the same control across a redraw (the cargo blimp's rows and the save slots are drawn again after each press, a
// slot's Save then reads Overwrite): its id or data, else its words
function keyOf(c: HTMLElement): string {
  const named = `${c.id}@${c.getAttribute('for') ?? ''}:${Object.entries(c.dataset).join(';')}`;
  return `${c.tagName}#${named === '@:' ? (c.textContent?.trim() ?? '') : named}`;
}

// The owner's comfort rules on every control of a dialog, its actions and those in its body (a save slot, a setting,
// the cargo blimp's Send and Take): see dialogPointerRefused and dialogKeyRefused (src/ui/presses.ts). A press of a
// mouse button or a finger is refused where it begins (a slider or a checkbox would change before any click), and its
// click with it; a key or A where it clicks.
function guardPresses(dialog: HTMLElement, d: DialogPresses): void {
  dialog.addEventListener(
    'pointerdown',
    (e) => {
      if (!controlOf(e.target) || !dialogPointerRefused(d, down)) return;
      down.refused = true;
      e.preventDefault();
    },
    { capture: true },
  );
  // a finger moves a slider from its touch, not its pointer
  dialog.addEventListener(
    'touchstart',
    (e) => {
      if (down.refused && controlOf(e.target)) e.preventDefault();
    },
    { capture: true, passive: false },
  );
  // a label passes its click on to its checkbox, at once: that click was checked as the label's
  let viaLabel: HTMLElement | null = null;
  dialog.addEventListener(
    'click',
    (e) => {
      const c = controlOf(e.target);
      if (!c) return;
      const now = performance.now();
      if (viaLabel && e.target === viaLabel) return;
      const refused =
        e.detail === 0
          ? dialogKeyRefused(d, keyOf(c), now)
          : !!down.refused || dialogPointerRefused(d, down) || (guarded(d.openedAt, now) && secondPress());
      if (refused) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.detail !== 0) markSecond();
        return;
      }
      d.taken = { press: e.detail === 0 ? null : down, t: now, key: keyOf(c) };
      const label = c instanceof HTMLLabelElement ? c : null;
      if (label?.control) {
        viaLabel = label.control as HTMLElement;
        window.setTimeout(() => (viaLabel = null));
      }
    },
    { capture: true },
  );
}

let current: { el: HTMLElement; opts: ModalOptions } | null = null;
// what had the focus before the first dialog opened: it gets it back when the last one closes
let opener: HTMLElement | null = null;

function dismiss(): void {
  if (!current || current.opts.dismissable === false) return;
  if (current.opts.onBack) current.opts.onBack();
  else closeModal();
}

// Registered before any screen's own key handler, so Esc closes the dialog and nothing else.
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !current) return;
  e.stopImmediatePropagation();
  e.preventDefault();
  dismiss();
});

export function isModalOpen(): boolean {
  return current !== null;
}

// While a dialog is open everything behind it is inert: Tab, the keyboard and screen readers stay in the
// dialog (the HUD behind an ending or a story event cannot be reached).
function setBackgroundInert(on: boolean): void {
  for (const screen of document.querySelectorAll<HTMLElement>('#app > .screen')) screen.inert = on;
}

export function closeModal(): void {
  if (!current) return;
  const { el, opts } = current;
  current = null;
  el.remove();
  setBackgroundInert(false);
  opts.onClose?.();
  if (!current) {
    const back = opener;
    opener = null;
    if (back?.isConnected && !back.closest('[inert]') && !(back as HTMLButtonElement).disabled) back.focus();
  }
}

export function openModal(opts: ModalOptions): HTMLElement {
  if (current) {
    // replace without firing the previous onClose
    current.el.remove();
    current = null;
  } else {
    const active = document.activeElement;
    opener = active instanceof HTMLElement && active !== document.body ? active : null;
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
    x.setAttribute('aria-label', t('common.close'));
    x.textContent = '×';
    x.addEventListener('click', () => {
      audio.play('click');
      dismiss();
    });
    head.append(x);
  }
  dialog.append(head);

  const body = document.createElement('div');
  body.className = 'modal-body';
  if (typeof opts.body === 'string') body.innerHTML = opts.body;
  else body.append(opts.body);
  dialog.append(body);

  // Keys held when the dialog pops up (Space to pause, Enter, the pad's A) must not pick a story choice by accident,
  // nor the second press of a double press whose first press opened it (a building tool with only parts missing opens
  // 2PM's offer to buy them and build: the second click, tap or A must not buy): for PRESS_GUARD_MS
  // (src/ui/presses.ts) a control takes no key press and no second press of a double press (guardPresses). A press of
  // its own works.
  const openedAt = performance.now();
  guardPresses(dialog, { openedAt, opener: guarded(down.t, openedAt) ? down : null, unprompted: !!opts.unprompted, taken: null });
  if (opts.actions?.length) {
    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    for (const a of opts.actions) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `btn ${a.primary ? 'btn-primary' : ''} ${a.tone ? `tone-${a.tone}` : ''}`;
      b.disabled = !!a.disabled;
      b.innerHTML = `<span>${a.label}</span>${a.hint ? `<small>${a.hint}</small>` : ''}`;
      b.addEventListener('click', () => {
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
      if (e.target === el) dismiss();
    });
  }
  root.append(el);
  current = { el, opts };
  setBackgroundInert(true);
  // Focus the dialog itself (Tab reaches the buttons) or its first text field; never pre-select a story choice.
  // With a controller, ordinary dialogs start on their main button so one press of A answers them
  // (the guard above still swallows a press that was meant for the screen behind).
  const field = dialog.querySelector<HTMLElement>('input[type="text"], input[type="number"]');
  dialog.tabIndex = -1;
  const pad = document.body.classList.contains('pad-mode') && opts.dismissable !== false;
  // forms (settings) start on their first control, other dialogs on their main button
  const padPick = pad ? dialog.querySelector<HTMLElement>('.modal-body select, .modal-body input, .modal-actions .btn-primary:not(:disabled)') : null;
  (field ?? padPick ?? dialog).focus();
  return dialog;
}
