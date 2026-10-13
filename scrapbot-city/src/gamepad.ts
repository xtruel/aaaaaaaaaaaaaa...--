// Controller support (Steam Deck, Xbox and PlayStation pads with the browser's standard mapping).
// Menus and dialogs: D-pad or left stick moves the focus, A presses, B goes back.
// Inside a city the running GameSession takes the pad over and drives a virtual cursor.

export type PadButton = 'a' | 'b' | 'x' | 'y' | 'lb' | 'rb' | 'lt' | 'rt' | 'back' | 'start' | 'ls' | 'rs' | 'up' | 'down' | 'left' | 'right';

// Button order of the standard gamepad mapping.
const STANDARD: PadButton[] = ['a', 'b', 'x', 'y', 'lb', 'rb', 'lt', 'rt', 'back', 'start', 'ls', 'rs', 'up', 'down', 'left', 'right'];
const REPEATS: PadButton[] = ['up', 'down', 'left', 'right'];
const DEAD_ZONE = 0.22;
const REPEAT_DELAY = 0.38;
const REPEAT_EVERY = 0.11;

export interface PadFrame {
  dt: number;
  lx: number;
  ly: number;
  rx: number;
  ry: number;
  pressed: Set<PadButton>; // went down this frame, with auto-repeat for the D-pad and stick directions
  held: Set<PadButton>;
}

export interface PadTarget {
  // True when the target used the frame; false lets the menus have it (a dialog is open, for example).
  padFrame(f: PadFrame): boolean;
}

interface PadOptions {
  target: () => PadTarget | null;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])';

function deadZone(x: number, y: number): [number, number] {
  const m = Math.hypot(x, y);
  if (m < DEAD_ZONE) return [0, 0];
  const k = Math.min(1, (m - DEAD_ZONE) / (1 - DEAD_ZONE)) / m;
  return [x * k, y * k];
}

export function setPadMode(on: boolean): void {
  document.body.classList.toggle('pad-mode', on);
  // the controller takes over from a finger (src/input.ts)
  if (on) document.body.classList.remove('touch-mode');
}

export function padMode(): boolean {
  return document.body.classList.contains('pad-mode');
}

// ---------- menu navigation ----------

function scope(): HTMLElement | null {
  return document.querySelector<HTMLElement>('#modal-root .modal') ?? document.querySelector<HTMLElement>('.screen:not([hidden])');
}

function candidates(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  });
}

function focusEl(el: HTMLElement): void {
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function current(list: HTMLElement[]): HTMLElement | null {
  const active = document.activeElement as HTMLElement | null;
  return active && list.includes(active) ? active : null;
}

// Where the focus starts when nothing in the dialog has it yet (never on the × that closes it).
function start(list: HTMLElement[]): HTMLElement {
  return (
    list.find((el) => el.classList.contains('selected')) ??
    list.find((el) => el.classList.contains('btn-primary')) ??
    list.find((el) => !el.classList.contains('modal-x')) ??
    list[0]
  );
}

function nudgeValue(el: HTMLElement, dir: 1 | -1): boolean {
  if (el instanceof HTMLInputElement && el.type === 'range') {
    if (dir > 0) el.stepUp();
    else el.stepDown();
  } else if (el instanceof HTMLSelectElement) {
    const n = el.options.length;
    el.selectedIndex = (el.selectedIndex + dir + n) % n;
  } else {
    return false;
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function move(dir: 'up' | 'down' | 'left' | 'right'): void {
  const root = scope();
  if (!root) return;
  const list = candidates(root);
  if (!list.length) return;
  const from = current(list);
  if (!from) {
    focusEl(start(list));
    return;
  }
  // sliders and pickers take left/right as "change the value"
  if ((dir === 'left' || dir === 'right') && nudgeValue(from, dir === 'right' ? 1 : -1)) return;
  const a = from.getBoundingClientRect();
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of list) {
    if (el === from) continue;
    const r = el.getBoundingClientRect();
    // only elements that really lie on that side: "left" in a vertical list goes nowhere
    const tol = 6;
    const beyond = dir === 'up' ? r.bottom <= a.top + tol : dir === 'down' ? r.top >= a.bottom - tol : dir === 'left' ? r.right <= a.left + tol : r.left >= a.right - tol;
    if (!beyond) continue;
    const dx = r.left + r.width / 2 - ax;
    const dy = r.top + r.height / 2 - ay;
    const main = dir === 'up' ? -dy : dir === 'down' ? dy : dir === 'left' ? -dx : dx;
    // up and down: a target straight above or below (its width overlaps this one's) is in line, wherever its centre
    // is: a checkbox at the left under a slider as wide as the dialog, the dialog's wide button under the checkbox
    const inLine = (dir === 'up' || dir === 'down') && r.left < a.right && r.right > a.left;
    const cross = inLine ? 0 : dir === 'up' || dir === 'down' ? dx : dy;
    const score = main + Math.abs(cross) * 2.2;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  if (best) focusEl(best);
}

function press(): void {
  const root = scope();
  if (!root) return;
  const list = candidates(root);
  if (!list.length) return;
  const el = current(list);
  if (!el) {
    // the main menu shows its choice with .selected before anything has focus
    const sel = list.find((e) => e.classList.contains('selected'));
    if (sel) sel.click();
    else focusEl(start(list));
    return;
  }
  if (el instanceof HTMLSelectElement) {
    nudgeValue(el, 1);
    return;
  }
  if (el instanceof HTMLInputElement && (el.type === 'text' || el.type === 'number')) {
    // Steam's floating keyboard when the desktop build has Steam (Steam + X also opens it on a Deck)
    const r = el.getBoundingClientRect();
    const bridge = (window as unknown as { scrapbotDesktop?: { showKeyboard?: (rect: object) => boolean } }).scrapbotDesktop;
    const shown = bridge?.showKeyboard?.({ x: r.left, y: r.top, w: r.width, h: r.height, numeric: el.type === 'number' });
    if (!shown) move('down');
    return;
  }
  el.click();
}

function back(): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
}

export function menuFrame(f: PadFrame): void {
  for (const dir of ['up', 'down', 'left', 'right'] as const) if (f.pressed.has(dir)) move(dir);
  if (f.pressed.has('a')) press();
  if (f.pressed.has('b') || f.pressed.has('start')) back();
}

// ---------- polling ----------

const DIRS = ['up', 'down', 'left', 'right'] as const;

export function initGamepad(opts: PadOptions): void {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
  let running = false;
  let last = 0;
  let prevHeld = new Set<PadButton>();
  const timers = new Map<string, number>();

  // True on the first frame something is held, then every REPEAT_EVERY seconds after REPEAT_DELAY.
  const fires = (key: string, down: boolean, dt: number): boolean => {
    if (!down) {
      timers.delete(key);
      return false;
    }
    const t0 = timers.get(key);
    if (t0 === undefined) {
      timers.set(key, 0);
      return true;
    }
    const t1 = t0 + dt;
    timers.set(key, t1);
    return t1 >= REPEAT_DELAY && Math.floor((t1 - REPEAT_DELAY) / REPEAT_EVERY) !== Math.floor((t0 - REPEAT_DELAY) / REPEAT_EVERY);
  };

  const poll = (now: number) => {
    const pads = [...navigator.getGamepads()].filter((p): p is Gamepad => !!p && p.connected);
    if (!pads.length) {
      running = false;
      return;
    }
    const dt = Math.min(0.1, last ? (now - last) / 1000 : 0);
    last = now;
    const held = new Set<PadButton>();
    let lx = 0;
    let ly = 0;
    let rx = 0;
    let ry = 0;
    for (const p of pads) {
      p.buttons.forEach((b, i) => {
        const name = STANDARD[i];
        if (name && (b.pressed || b.value > 0.5)) held.add(name);
      });
      const [ax, ay] = deadZone(p.axes[0] ?? 0, p.axes[1] ?? 0);
      const [bx, by] = deadZone(p.axes[2] ?? 0, p.axes[3] ?? 0);
      lx += ax;
      ly += ay;
      rx += bx;
      ry += by;
    }
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    lx = clamp(lx);
    ly = clamp(ly);
    rx = clamp(rx);
    ry = clamp(ry);

    const pressed = new Set<PadButton>();
    for (const b of STANDARD) {
      const down = held.has(b);
      if (REPEATS.includes(b) ? fires(b, down, dt) : down && !prevHeld.has(b)) pressed.add(b);
    }
    prevHeld = held;

    // in menus the left stick works like the D-pad
    const menuPressed = new Set(pressed);
    const strong = Math.max(Math.abs(lx), Math.abs(ly)) > 0.5;
    const stickDir = !strong ? null : Math.abs(lx) > Math.abs(ly) ? (lx > 0 ? 'right' : 'left') : ly > 0 ? 'down' : 'up';
    for (const d of DIRS) if (fires(`stick-${d}`, stickDir === d, dt)) menuPressed.add(d);

    if (pressed.size || lx || ly || rx || ry) setPadMode(true);
    const frame: PadFrame = { dt, lx, ly, rx, ry, pressed, held };
    const target = opts.target();
    if (!target || !target.padFrame(frame)) menuFrame({ ...frame, pressed: menuPressed });
    requestAnimationFrame(poll);
  };

  const run = () => {
    if (running) return;
    running = true;
    last = 0;
    prevHeld = new Set();
    timers.clear();
    requestAnimationFrame(poll);
  };

  window.addEventListener('gamepadconnected', () => {
    setPadMode(true);
    opts.onConnect?.();
    run();
  });
  window.addEventListener('gamepaddisconnected', () => {
    const left = [...navigator.getGamepads()].some((p) => p?.connected);
    if (!left) setPadMode(false);
    opts.onDisconnect?.();
  });
  // a real mouse takes over again as soon as it moves
  window.addEventListener('pointermove', (e) => {
    if (padMode() && e.pointerType === 'mouse' && (e.movementX || e.movementY)) setPadMode(false);
  });
  // pads already connected before the page loaded show up after their first button press
  if ([...navigator.getGamepads()].some((p) => p?.connected)) run();
}
