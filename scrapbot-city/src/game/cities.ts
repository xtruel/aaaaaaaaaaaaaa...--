// The Scrap Coast campaign: five cities with their own rules and three star goals each.
import { t, tList, tk } from '../i18n';
import { DEFAULT_MODS } from './defs';
import type { BuildingType, CityMods } from './defs';
import type { GameState } from './state';

export type CityId = 'home' | 'rustbay' | 'neon' | 'greenvale' | 'company';

export interface StarGoal {
  check: (s: GameState) => boolean;
}

// City names are proper nouns and stay the same in every language; the rest is translated.
export interface CityDef {
  id: CityId;
  name: string;
  seed: number;
  starsToUnlock: number;
  mods: CityMods;
  goals: [StarGoal, StarGoal, StarGoal];
  map: { x: number; y: number }; // position on the region map, in % of its size
  color: string; // CSS colour token for the badge
  icon: BuildingType;
}

const mods = (m: Partial<CityMods>): CityMods => ({ ...DEFAULT_MODS, ...m });

const spireGoal: StarGoal = { check: (s) => s.spireDone };

export const cityTagline = (c: CityDef) => tk(`city.${c.id}.tagline`);
export const cityDesc = (c: CityDef) => tk(`city.${c.id}.desc`);
export const cityTraits = (c: CityDef) => tList(`city.${c.id}.traits` as Parameters<typeof tList>[0]);

export function goalText(c: CityDef, i: number): string {
  return i === 0 ? t('goal.spire') : tk(`city.${c.id}.g${i + 1}`);
}

export const CITIES: CityDef[] = [
  {
    id: 'home',
    name: 'Scrapbot City',
    seed: 2026,
    starsToUnlock: 0,
    mods: DEFAULT_MODS,
    goals: [
      spireGoal,
      { check: (s) => s.pop >= 50 },
      { check: (s) => s.spireDone && s.pollution < 40 },
    ],
    map: { x: 22, y: 58 },
    color: 'var(--lime)',
    icon: 'hq',
  },
  {
    id: 'rustbay',
    name: 'Rustbay',
    seed: 7781,
    starsToUnlock: 1,
    mods: mods({ junk: 1.6, sludge: 1, stormEvery: 0.5, rubble: 30 }),
    goals: [
      spireGoal,
      { check: (s) => s.stats.scrapCollected >= 4000 },
      { check: (s) => s.bots.length >= 20 },
    ],
    map: { x: 44, y: 76 },
    color: 'var(--sky)',
    icon: 'dock',
  },
  {
    id: 'neon',
    name: 'Neon Heights',
    seed: 3141,
    starsToUnlock: 3,
    mods: mods({ sludge: 9, eventEvery: 0.7, startRes: { scrap: 0, parts: 60, credits: 400 }, startPollution: 30 }),
    goals: [
      spireGoal,
      { check: (s) => s.stats.cleaned >= 25 },
      { check: (s) => s.pop >= 60 },
    ],
    map: { x: 52, y: 34 },
    color: 'var(--pink)',
    icon: 'purifier',
  },
  {
    id: 'greenvale',
    name: 'Greenvale',
    seed: 5150,
    starsToUnlock: 5,
    mods: mods({ junk: 0.5, grass: 16, sludge: 1, happiness: 10, industrialCost: 1.5, greenCost: 0.85, startPollution: 5 }),
    goals: [
      spireGoal,
      { check: (s) => s.endingKind === 'green' },
      { check: (s) => s.spireDone && s.stats.maxPollution <= 30 },
    ],
    map: { x: 74, y: 62 },
    color: 'var(--green)',
    icon: 'garden',
  },
  {
    id: 'company',
    name: '2PM Company Town',
    seed: 9090,
    starsToUnlock: 8,
    mods: mods({ industrialCost: 0.6, greenCost: 1.2, decay: 0.7, eventEvery: 0.8, startRes: { scrap: 0, parts: 40, credits: 600 }, startPollution: 35 }),
    goals: [
      spireGoal,
      { check: (s) => s.stats.creditsEarned >= 25000 },
      { check: (s) => s.endingKind === 'industrial' },
    ],
    map: { x: 80, y: 22 },
    color: 'var(--orange)',
    icon: 'factory',
  },
];

export const TOTAL_STARS = CITIES.length * 3;

// Road connections drawn on the region map.
export const ROADS: [CityId, CityId][] = [
  ['home', 'rustbay'],
  ['home', 'neon'],
  ['rustbay', 'greenvale'],
  ['neon', 'greenvale'],
  ['neon', 'company'],
];

export function cityById(id: string | null): CityDef | undefined {
  return CITIES.find((c) => c.id === id);
}

// Marks newly reached goals; returns the indexes earned this call.
export function updateStars(s: GameState): number[] {
  const city = cityById(s.cityId);
  if (!city) return [];
  const earned: number[] = [];
  city.goals.forEach((g, i) => {
    if (!s.stars[i] && g.check(s)) {
      s.stars[i] = true;
      earned.push(i);
    }
  });
  return earned;
}
