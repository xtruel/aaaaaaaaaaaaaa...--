// The compact layout (src/compact.css): phones in landscape and any window up to 500 px high. The few things it
// needs from the code (the goal chip that opens on a tap, the strip naming the building in hand) follow this query;
// the style sheet's media query is the same text (tests/compact.test.ts checks it). Windows from 1024x640 up never
// match it, so nothing changes for them.
export const COMPACT_QUERY = '(max-height: 500px)';

let query: MediaQueryList | null = null;

export function compact(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  query ??= window.matchMedia(COMPACT_QUERY);
  return query.matches;
}
