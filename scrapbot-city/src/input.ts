// The input the player is using now, so that every text telling how to do something names its controls: keyboard and
// mouse, touch, or the controller. The controller while it is in use (pad mode, src/gamepad.ts: its first press or
// stick, until the mouse moves); touch from a finger's touch until the mouse moves or presses, or a key is pressed;
// keyboard and mouse otherwise. A help text in the dictionary has the keyboard-and-mouse wording under its key and
// the other two under the same key + "Touch" / + "Pad" (tests/input-help.test.ts lists them all).
import { padMode, setPadMode } from './gamepad';
import { hasKey, tk } from './i18n';
import { localizeKeys } from './keys';

export type InputKind = 'mouse' | 'touch' | 'pad';

export function touchMode(): boolean {
  return typeof document !== 'undefined' && document.body.classList.contains('touch-mode');
}

export function setTouchMode(on: boolean): void {
  document.body.classList.toggle('touch-mode', on);
  // a finger on the screen takes over from the controller (whose next press takes over again)
  if (on && padMode()) setPadMode(false);
}

export function inputKind(): InputKind {
  if (typeof document === 'undefined') return 'mouse';
  return padMode() ? 'pad' : touchMode() ? 'touch' : 'mouse';
}

// The dictionary key of help text `key` for an input: `${key}Pad` / `${key}Touch` when the dictionary has it, the key
// itself otherwise (the keyboard-and-mouse wording, or a text that fits every input).
export function inputKey(key: string, kind: InputKind = inputKind()): string {
  if (kind === 'pad' && hasKey(`${key}Pad`)) return `${key}Pad`;
  if (kind === 'touch' && hasKey(`${key}Touch`)) return `${key}Touch`;
  return key;
}

// Help text `key` for the input in use (or `kind`). Keyboard wordings name keys in the player's keyboard layout;
// controller and touch wordings never go through that rewrite (their A, B, X, Y are buttons, not keys).
export function inputText(key: string, params?: Record<string, string | number>, kind: InputKind = inputKind()): string {
  const k = inputKey(key, kind);
  const text = tk(k, params);
  return k === key && kind !== 'pad' ? localizeKeys(text) : text;
}

// Help texts placed in the page with data-input-help="key" (a dialog's tip, the intro) follow the input as it changes.
export function refreshInputHelp(root: ParentNode = document): void {
  for (const el of root.querySelectorAll<HTMLElement>('[data-input-help]')) {
    const html = inputText(el.dataset.inputHelp!);
    if (el.innerHTML !== html) el.innerHTML = html;
  }
}

let started = false;

export function initInputMode(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType === 'touch' || e.pointerType === 'pen') setTouchMode(true);
      else if (e.pointerType === 'mouse' && touchMode()) setTouchMode(false);
    },
    { capture: true },
  );
  window.addEventListener('pointermove', (e) => {
    if (touchMode() && e.pointerType === 'mouse' && (e.movementX || e.movementY)) setTouchMode(false);
  });
  window.addEventListener(
    'keydown',
    () => {
      if (touchMode()) setTouchMode(false);
    },
    { capture: true },
  );
  // whatever switched the input (these listeners or the controller's), the help texts on screen follow
  let last = inputKind();
  new MutationObserver(() => {
    const now = inputKind();
    if (now === last) return;
    last = now;
    refreshInputHelp();
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
}
