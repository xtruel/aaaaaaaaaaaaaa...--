// localStorage helpers. Storage can be blocked (private mode, sandboxed frames), so every access is guarded.
import { deserialize, day, serialize } from './game/state';
import type { GameState, OutcomeKind } from './game/state';

const PREFIX = 'scrapbot:';

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): boolean {
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
}

export function loadSettings(): Settings {
  const defaults: Settings = {
    sfx: 0.6,
    music: 0.35,
    crt: true,
    edgeScroll: false,
    reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  };
  const raw = read('settings');
  if (!raw) return defaults;
  try {
    return { ...defaults, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return defaults;
  }
}

export function saveSettings(s: Settings): void {
  write('settings', JSON.stringify(s));
}

export type SlotId = 'auto' | '1' | '2' | '3';
export const SLOTS: SlotId[] = ['auto', '1', '2', '3'];

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
  return write(`save:${slot}`, serialize(s)) && write(`meta:${slot}`, JSON.stringify(meta));
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
  const raw = read(`meta:${slot}`);
  if (!raw || !read(`save:${slot}`)) return null;
  try {
    return JSON.parse(raw) as SlotMeta;
  } catch {
    return null;
  }
}

export function loadGame(slot: SlotId): GameState | null {
  const raw = read(`save:${slot}`);
  if (!raw) return null;
  try {
    return deserialize(raw);
  } catch (err) {
    console.warn('Could not load save', slot, err);
    return null;
  }
}

export function unlockedEndings(): OutcomeKind[] {
  const raw = read('endings');
  if (!raw) return [];
  try {
    return JSON.parse(raw) as OutcomeKind[];
  } catch {
    return [];
  }
}

export function unlockEnding(kind: OutcomeKind): void {
  const list = unlockedEndings();
  if (!list.includes(kind)) write('endings', JSON.stringify([...list, kind]));
}
