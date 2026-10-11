// Saves and settings. The desktop build keeps them as files (synced by Steam Cloud); the browser build
// uses localStorage, which can be blocked (private mode, sandboxed frames), so every access is guarded.
import { SAVE_VERSION, deserialize, day, serialize } from './game/state';
import { detectLang, isLang } from './i18n';
import type { Lang } from './i18n';
import type { GameState, OutcomeKind } from './game/state';

const PREFIX = 'scrapbot:';

interface FileStore {
  get(key: string): string | null;
  set(key: string, value: string): boolean;
  remove(key: string): void;
}

const desktop = (window as unknown as { scrapbotDesktop?: { storage?: FileStore; openSaves?: () => void } }).scrapbotDesktop;
const files = desktop?.storage ?? null;

export function readKey(key: string): string | null {
  try {
    return files ? files.get(key) : window.localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function writeKey(key: string, value: string): boolean {
  try {
    if (files) return files.set(key, value);
    window.localStorage.setItem(PREFIX + key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string): void {
  try {
    if (files) files.remove(key);
    else window.localStorage.removeItem(PREFIX + key);
  } catch {
    // storage blocked: nothing to remove
  }
}

// Desktop builds before 0.5 kept everything in the browser storage: copy it to files once.
export function migrateToFiles(): void {
  if (!files || readKey('migrated') === '1') return;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k?.startsWith(PREFIX)) continue;
      const key = k.slice(PREFIX.length);
      const value = window.localStorage.getItem(k);
      if (value !== null && readKey(key) === null) writeKey(key, value);
    }
  } catch {
    // no old storage to copy
  }
  writeKey('migrated', '1');
}

// Desktop only: shows the saves folder in the file manager.
export const openSavesFolder: (() => void) | null = desktop?.openSaves ?? null;

export interface Settings {
  sfx: number;
  music: number;
  crt: boolean;
  edgeScroll: boolean;
  reducedMotion: boolean;
  fullscreen: boolean;
  lang: Lang;
}

export function loadSettings(): Settings {
  const defaults: Settings = {
    sfx: 0.6,
    music: 0.35,
    crt: true,
    edgeScroll: false,
    reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    fullscreen: false,
    lang: detectLang(),
  };
  const raw = readKey('settings');
  if (!raw) return defaults;
  try {
    const saved = { ...defaults, ...(JSON.parse(raw) as Partial<Settings>) };
    if (!isLang(saved.lang)) saved.lang = defaults.lang;
    return saved;
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

// The save format version written in a stored save (0 when it has none or cannot be read).
export function saveVersionOf(raw: string): number {
  try {
    const v = (JSON.parse(raw) as { version?: unknown } | null)?.version;
    return typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : 0;
  } catch {
    return 0;
  }
}

export function backupKey(slot: SlotId, version: number): string {
  return `backup:save:${slot}:v${version}`;
}

// Before this version first overwrites a save written by another one (0.6 and 0.7.0-alpha.1 wrote version 2;
// a save with no version or a damaged one counts as 0), the original text is copied aside, once per slot and
// version, with its slot info: backup:save:<slot>:v<n> and backup:meta:<slot>:v<n>. Backups are never removed
// or overwritten. False when the copy could not be written: the old save is then left alone.
function backupBeforeOverwrite(slot: SlotId): boolean {
  const raw = readKey(`save:${slot}`);
  if (raw === null) return true;
  const version = saveVersionOf(raw);
  if (version === SAVE_VERSION) return true;
  const key = backupKey(slot, version);
  if (readKey(key) !== null) return true;
  if (!writeKey(key, raw)) return false;
  const meta = readKey(`meta:${slot}`);
  if (meta !== null) writeKey(`backup:meta:${slot}:v${version}`, meta);
  return true;
}

export function saveGame(slot: SlotId, s: GameState): boolean {
  if (!backupBeforeOverwrite(slot)) return false;
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
  removeKey(`save:${slot}`);
  removeKey(`meta:${slot}`);
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
