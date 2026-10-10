// Tiny translation layer: t('key', { n: 3 }) looks the key up in the current language and fills {placeholders}.
import { de } from './de';
import { en } from './en';
import { es } from './es';
import { fr } from './fr';
import { it } from './it';
import { nl } from './nl';
import { pl } from './pl';
import { pt } from './pt';
import type { BuildingType, PathKind } from '../game/defs';

export type Key = keyof typeof en;
export type Dict = Record<Key, string>;

export const LANGS = [
  { id: 'en', name: 'English' },
  { id: 'it', name: 'Italiano' },
  { id: 'de', name: 'Deutsch' },
  { id: 'fr', name: 'Français' },
  { id: 'es', name: 'Español' },
  { id: 'pt', name: 'Português' },
  { id: 'pl', name: 'Polski' },
  { id: 'nl', name: 'Nederlands' },
] as const;

export type Lang = (typeof LANGS)[number]['id'];

const DICTS: Record<Lang, Dict> = { en, it, de, fr, es, pt, pl, nl };

let currentLang: Lang = 'en';
let current: Dict = en;

export function setLang(lang: Lang): void {
  currentLang = DICTS[lang] ? lang : 'en';
  current = DICTS[currentLang];
  if (typeof document !== 'undefined') document.documentElement.lang = currentLang;
}

export function lang(): Lang {
  return currentLang;
}

export function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && value in DICTS;
}

// First browser language we support, English otherwise.
export function detectLang(): Lang {
  const prefs = typeof navigator !== 'undefined' ? [...(navigator.languages ?? []), navigator.language] : [];
  for (const p of prefs) {
    const code = String(p).slice(0, 2).toLowerCase();
    if (isLang(code)) return code;
  }
  return 'en';
}

export function t(key: Key, params?: Record<string, string | number>): string {
  const text = current[key] ?? en[key] ?? key;
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
}

// For keys built at runtime (event ids, city ids, building types).
export function tk(key: string, params?: Record<string, string | number>): string {
  return t(key as Key, params);
}

export function hasKey(key: string): boolean {
  return key in en;
}

// Lists stored as "a|b|c" in the dictionaries.
export function tList(key: Key): string[] {
  return t(key).split('|');
}

export function bName(type: BuildingType): string {
  return tk(`b.${type}`);
}

export function bDesc(type: BuildingType): string {
  return tk(`b.${type}.desc`);
}

export function pathLabel(path: PathKind): string {
  return tk(`path.${path}`);
}
