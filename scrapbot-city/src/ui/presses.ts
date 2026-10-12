// The one place for every double-press guard in the game (the owner's comfort rules: nothing is bought, confirmed,
// demolished or bought back by the second press of a double click, a double tap or A pressed twice). It holds the
// times and distances, and the record of the last presses anywhere in a city (a mouse button, a finger, the
// controller's A at its cursor): where, when, where the map was and the tile under them when they were on the map.
// The session writes the record; these read it or the constants:
// - the map with a tool in hand (src/session.ts, meantPress): the second press does nothing where the first did not
//   mean it (the next tile, behind a dialog or panel the first press closed, a second layer with the bulldozer);
// - the catalog (src/ui/hud.ts): the second press on an item or Done, after the list moved under it, does nothing;
// - the building panel's costly buttons (src/ui/hud.ts): a confirmation takes no press for PRESS_GUARD_MS after the
//   press that brought it up, Install none after a removal on that building;
// - a dialog's buttons (src/ui/modal.ts): a key or A held when it came up, or the second press of a double press
//   whose first opened it (2PM's offer to buy the missing parts and build), does nothing;
// - the click that reaches behind the selected building (src/ui/pick.ts) counts from DOUBLE_PRESS_MS.
// No DOM.

// Two presses this close (ms) are one double press: 500 ms is Windows' default double-click time. A second click on
// the selected building reaches what it hides from this long after the first.
export const DOUBLE_PRESS_MS = 500;

// How long (ms) a guard lasts after the press it guards against: a double press plus a margin, because the game sees
// a press a little after it happens and not always equally late (the pad is read once a frame, a click can wait for
// the frame being drawn): two presses 500 ms apart can reach it 510 ms or more apart. A press of its own, meant,
// comes later than this.
export const PRESS_GUARD_MS = DOUBLE_PRESS_MS + 100;

// A press that closed the smog panel reaches the map right after (the HUD saw it first): the map tells "this very
// press" by the panel having closed less than this long (ms) before. Only the closing, not a guard of its own.
export const SAME_PRESS_MS = 30;

// How close (screen px) the second press of a double press lands: the mouse and the pad's cursor stay put between
// the two presses; the two taps of a finger land up to about 20 px apart.
export const DOUBLE_DIST = 10;
export const DOUBLE_DIST_TOUCH = 24;

export interface Press {
  t: number; // performance.now()
  x: number; // screen px
  y: number;
  cam: string; // where the map was ('' when it does not matter)
  tile: string; // "x,y" of the tile under it on the map, '' elsewhere (a dialog, a panel)
  tool?: string; // the tool in hand when it was made (the session's; '' none)
  touch?: boolean; // made with a finger
  second?: boolean; // taken for the second press of a double press (markSecond): no double press starts from it
}

// How close two presses have to be to make a double press: a finger's reach when either was a finger.
export function doubleDist(a: Pick<Press, 'touch'>, b: Pick<Press, 'touch'>): number {
  return a.touch || b.touch ? DOUBLE_DIST_TOUCH : DOUBLE_DIST;
}

// Is `second` the second press of a double press that `first` began: soon enough after it (PRESS_GUARD_MS, a double
// press as the game reads it), close enough to it, with the map where it was?
export function isDouble(first: Press, second: Pick<Press, 't' | 'x' | 'y' | 'cam' | 'touch'>): boolean {
  return second.t - first.t < PRESS_GUARD_MS && Math.hypot(second.x - first.x, second.y - first.y) < doubleDist(first, second) && second.cam === first.cam;
}

// The map with a tool in hand (src/session.ts): what a press there is. 'meant' when it is no second press of a double
// press (or the tool in hand changed in between: a click, then the bulldozer taken and a click on the same spot, is two
// meant presses); 'again' when it is one but lands on the tile the first press used with a piece or building tool
// (there it can only be refused, with the reason); 'double' when it would do what the first press did not mean: land
// on the next tile across an edge, on the map behind a dialog or panel the first press closed (the first press's tile
// is ''), or anywhere with the bulldozer (a second layer: the floor under the fence just taken up).
export function mapPress(before: Press, now: Press, bulldozer: boolean): 'meant' | 'again' | 'double' {
  if (before.tool !== now.tool || !isDouble(before, now)) return 'meant';
  return !bulldozer && before.tile !== '' && before.tile === now.tile ? 'again' : 'double';
}

// Is a guard that started at `since` (performance.now() of the press it guards against) still on?
export function guarded(since: number, now = performance.now()): boolean {
  return now - since < PRESS_GUARD_MS;
}

const none = (): Press => ({ t: -Infinity, x: 0, y: 0, cam: '', tile: '', tool: '' });
let before = none();
let last = none();

// A press that was taken for the second press of a double press does not become "the press before": the next press
// is measured from the press that began the double press, so a refused press never stretches the window (six quick
// taps on six neighbouring tiles, each closer to the last than a finger's reach, are not swallowed one after the
// other: every other one buys).
export function notePress(p: Press): void {
  if (!last.second) before = last;
  last = p;
}

// The press being handled was the second press of a double press (refused, or let through only to be refused with
// its reason on the tile the first press used): no double press starts from it.
export function markSecond(): void {
  last.second = true;
}

// The press being handled did not act on the map (it only closed the smog panel): a press right after it, on the
// same tile, is not "the same tile the first press used".
export function markOffMap(): void {
  last.tile = '';
}

// [the press before (the last one not taken for a second press), the last press]
export function lastPresses(): [Press, Press] {
  return [before, last];
}

// Is the press being handled (the last one, a moment ago: not a key pressed long after) the second press of a double
// press, landing where the one before did?
export function secondPress(): boolean {
  if (performance.now() - last.t > 1000) return false;
  return isDouble(before, last);
}

// A city that starts afresh forgets the presses of the last one (and tests start clean).
export function forgetPresses(): void {
  before = none();
  last = none();
}
