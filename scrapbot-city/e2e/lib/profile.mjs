// What the browser storage holds before the game loads (written on a blank page of the same origin, see page.mjs):
// settings (sound off, no CRT filter, the language under test), the tutorial marked done (unless a test is about the
// tutorial), and the projects profile:
//   profile 'new': no scrapbot:projects key (a player who never discovered anything)
//   profile 'all': every project of docs/MODULAR-INC2.md §4 discovered (the profile key the game itself writes)
//   profile {..}:  that profile object as it is
// plus any other key a test needs (an old save from tests/fixtures, a campaign).
import { readFileSync } from 'fs';
import { join } from 'path';
import { ROOT } from './build.mjs';
import { PROJECTS } from './spec.mjs';

export const SETTINGS = { sfx: 0, music: 0, crt: false, edgeScroll: false, reducedMotion: false, fullscreen: false, lang: 'en' };

export function seedStorage({ lang = 'en', settings = {}, tutorialDone = true, profile = 'new', keys = {} } = {}) {
  const out = { 'scrapbot:settings': JSON.stringify({ ...SETTINGS, lang, ...settings }) };
  if (tutorialDone) out['scrapbot:tutorial-done'] = '1';
  if (profile === 'all') out['scrapbot:projects'] = JSON.stringify({ version: 1, discovered: [...PROJECTS], best: {} });
  else if (profile && typeof profile === 'object') out['scrapbot:projects'] = JSON.stringify(profile);
  for (const [k, v] of Object.entries(keys)) out[k.startsWith('scrapbot:') ? k : `scrapbot:${k}`] = v;
  return out;
}

// tests/fixtures/<name>: an old save as the old version wrote it, byte for byte
export const fixture = (name) => readFileSync(join(ROOT, 'tests', 'fixtures', name), 'utf8');

// the slot info the menus list for a save (what the old version wrote next to it)
export function metaFor(raw, extra = {}) {
  const d = JSON.parse(raw);
  return JSON.stringify({ city: d.cityName, day: Math.floor(d.time / 60) + 1, alignment: Math.round(d.alignment), pop: Math.floor(d.pop), savedAt: 1700000000000, ...extra });
}

// storage keys the game may write (the release smoke and the saves test check that nothing else appears): the
// backups of saves (src/storage.ts) and of the projects profile (src/profile.ts) are product keys too
export const PRODUCT_KEY = /^scrapbot:(settings|last|tutorial-done|migrated|campaign|campaign-damaged|endings|achievements|projects|(save|meta):(auto|[123]|city-\w+)|backup:(save|meta):(auto|[123]|city-\w+):v\d+(:\w+)?|backup:projects:v\d+(:\w+)?)$/;
