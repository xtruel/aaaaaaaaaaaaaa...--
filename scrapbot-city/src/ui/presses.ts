// The last two presses anywhere in a city (a mouse button, a finger, the controller's A at its cursor): where, when,
// where the map was and the tile under them when they were on the map. The session writes them; the session (on the
// map) and the HUD (the catalog) use them to tell the second press of a double press (double click, double tap, A A)
// from a press that is meant (the owner's comfort rules for building: nothing bought or picked by accident). No DOM.

export interface Press {
  t: number; // performance.now()
  x: number; // screen px
  y: number;
  cam: string; // where the map was ('' when it does not matter)
  tile: string; // "x,y" of the tile under it on the map, '' elsewhere (a dialog, a panel)
  tool?: string; // the tool in hand when it was made (the session's; '' none)
}

// A press this soon after the one before (ms) and this close to it (screen px) is the second press of a double press.
export const DOUBLE_PRESS = 350;
export const DOUBLE_DIST = 10;

const none = (): Press => ({ t: -Infinity, x: 0, y: 0, cam: '', tile: '', tool: '' });
let before = none();
let last = none();

export function notePress(p: Press): void {
  before = last;
  last = p;
}

// [the press before, the last press]
export function lastPresses(): [Press, Press] {
  return [before, last];
}

// Is the press being handled (the last one, a moment ago: not a key pressed long after) the second press of a double
// press, landing where the one before did?
export function secondPress(): boolean {
  if (performance.now() - last.t > 1000) return false;
  return last.t - before.t < DOUBLE_PRESS && Math.hypot(last.x - before.x, last.y - before.y) < DOUBLE_DIST && last.cam === before.cam;
}

// A city that starts afresh forgets the presses of the last one (and tests start clean).
export function forgetPresses(): void {
  before = none();
  last = none();
}
