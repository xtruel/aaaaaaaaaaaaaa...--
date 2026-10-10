// localStorage helpers. Storage can be blocked (private mode, sandboxed frames), so every access is guarded.
import { deserialize, day, serialize } from './game/state';
import type { GameState, OutcomeKind } from './game/state';

const PREFIX = 'scrapbot:';

export function readKey(key: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function writeKey(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(PREFIX + key, value);
    return true;
  } catch {
    return false;
  }
}

export interface Settings {
  sfx: number;
  music: number;
  crt: boolean;
  edgeScroll: boolean;
  reducedMotion: boolean;
  fullscreen: boolean;
}

export function loadSettings(): Settings {
  const defaults: Settings = {
    sfx: 0.6,
    music: 0.35,
    crt: true,
    edgeScroll: false,
    reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    fullscreen: false,
  };
  const raw = readKey('settings');
  if (!raw) return defaults;
  try {
    return { ...defaults, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return defaults;
  }
}

export function saveSettings(s: Settings): void {
  writeKey('settings', JSON.stringify(s));
}

// Free play uses the autosave and three manual slots; each campaign city has its own slot.
export type SlotId = 'auto' | '1' | '2' | '3' | `city-${string}`;
export const SLOTS: SlotId[] = ['auto', '1', '2', '3'];

export function citySlot(cityId: string): SlotId {
  return `city-${cityId}`;
}

// What "Continue" resumes.
export function setLastPlayed(slot: SlotId): void {
  writeKey('last', slot);
}

export function lastPlayed(): SlotId | null {
  const slot = readKey('last') as SlotId | null;
  if (slot && slotMeta(slot)) return slot;
  // saves from before "last played" existed: fall back to the free play autosave
  return slotMeta('auto') ? 'auto' : null;
}

export function isTutorialDone(): boolean {
  return readKey('tutorial-done') === '1';
}

export function setTutorialDone(): void {
  writeKey('tutorial-done', '1');
}

export interface SlotMeta {
  city: string;
  day: number;
  alignment: number;
  pop: number;
  savedAt: number;
}

export function saveGame(slot: SlotId, s: GameState): boolean {
  const meta: SlotMeta = {
    city: s.cityName,
    day: day(s),
    alignment: Math.round(s.alignment),
    pop: Math.floor(s.pop),
    savedAt: Date.now(),
  };
  return writeKey(`save:${slot}`, serialize(s)) && writeKey(`meta:${slot}`, JSON.stringify(meta));
}

export function clearSlot(slot: SlotId): void {
  try {
    window.localStorage.removeItem(`${PREFIX}save:${slot}`);
    window.localStorage.removeItem(`${PREFIX}meta:${slot}`);
  } catch {
    // storage blocked: nothing to clear
  }
}

export function slotMeta(slot: SlotId): SlotMeta | null {
  const raw = readKey(`meta:${slot}`);
  if (!raw || !readKey(`save:${slot}`)) return null;
  try {
    return JSON.parse(raw) as SlotMeta;
  } catch {
    return null;
  }
}

export function loadGame(slot: SlotId): GameState | null {
  const raw = readKey(`save:${slot}`);
  if (!raw) return null;
  try {
    return deserialize(raw);
  } catch (err) {
    console.warn('Could not load save', slot, err);
    return null;
  }
}

export function unlockedEndings(): OutcomeKind[] {
  const raw = readKey('endings');
  if (!raw) return [];
  try {
    return JSON.parse(raw) as OutcomeKind[];
  } catch {
    return [];
  }
}

export function unlockEnding(kind: OutcomeKind): void {
  const list = unlockedEndings();
  if (!list.includes(kind)) writeKey('endings', JSON.stringify([...list, kind]));
}
