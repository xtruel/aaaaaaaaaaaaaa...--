// The Scrap Coast campaign: five cities with their own rules and three star goals each.
import { DEFAULT_MODS } from './defs';
import type { BuildingType, CityMods } from './defs';
import type { GameState } from './state';

export type CityId = 'home' | 'rustbay' | 'neon' | 'greenvale' | 'company';

export interface StarGoal {
  text: string;
  check: (s: GameState) => boolean;
}

export interface CityDef {
  id: CityId;
  name: string;
  tagline: string;
  desc: string;
  traits: string[];
  seed: number;
  starsToUnlock: number;
  mods: CityMods;
  goals: [StarGoal, StarGoal, StarGoal];
  map: { x: number; y: number }; // position on the region map, in % of its size
  color: string; // CSS colour token for the badge
  icon: BuildingType;
}

const mods = (m: Partial<CityMods>): CityMods => ({ ...DEFAULT_MODS, ...m });

const spireGoal: StarGoal = { text: 'Finish the Scrap Spire', check: (s) => s.spireDone };

export const CITIES: CityDef[] = [
  {
    id: 'home',
    name: 'Scrapbot City',
    tagline: 'Where it all starts',
    desc: 'Landfills, a lonely HQ and a cat. A fair place to learn how junk becomes a city.',
    traits: ['Balanced rules', 'Three toxic pools'],
    seed: 2026,
    starsToUnlock: 0,
    mods: DEFAULT_MODS,
    goals: [
      spireGoal,
      { text: 'Reach 50 citizens', check: (s) => s.pop >= 50 },
      { text: 'Smog under 40% with the Spire done', check: (s) => s.spireDone && s.pollution < 40 },
    ],
    map: { x: 22, y: 58 },
    color: 'var(--lime)',
    icon: 'hq',
  },
  {
    id: 'rustbay',
    name: 'Rustbay',
    tagline: 'A harbour of shipwrecks',
    desc: 'Every tide brings more scrap. Plenty to collect, and junk storms hit twice as often.',
    traits: ['Junk ×1.6', 'Junk storms ×2', 'Few toxic pools'],
    seed: 7781,
    starsToUnlock: 1,
    mods: mods({ junk: 1.6, sludge: 1, stormEvery: 0.5, rubble: 30 }),
    goals: [
      spireGoal,
      { text: 'Collect 4,000 scrap', check: (s) => s.stats.scrapCollected >= 4000 },
      { text: 'Run a fleet of 20 scrap bots', check: (s) => s.bots.length >= 20 },
    ],
    map: { x: 44, y: 76 },
    color: 'var(--sky)',
    icon: 'dock',
  },
  {
    id: 'neon',
    name: 'Neon Heights',
    tagline: 'Glittering towers, toxic basements',
    desc: 'Rich and busy, built on top of leaking labs. 2PM calls often. Start with money, fight the sludge.',
    traits: ['Toxic pools ×3', 'Start: 400 credits', 'Story events more often'],
    seed: 3141,
    starsToUnlock: 3,
    mods: mods({ sludge: 9, eventEvery: 0.7, startRes: { scrap: 0, parts: 60, credits: 400 }, startPollution: 30 }),
    goals: [
      spireGoal,
      { text: 'Clean 25 sludge tiles', check: (s) => s.stats.cleaned >= 25 },
      { text: 'Reach 60 citizens', check: (s) => s.pop >= 60 },
    ],
    map: { x: 52, y: 34 },
    color: 'var(--pink)',
    icon: 'purifier',
  },
  {
    id: 'greenvale',
    name: 'Greenvale',
    tagline: 'The last green valley',
    desc: 'Grass everywhere and very little junk. Citizens are happy here, and industry is expensive.',
    traits: ['Junk ×0.5', 'Lots of grass', 'Happiness +10', 'Industry costs ×1.5'],
    seed: 5150,
    starsToUnlock: 5,
    mods: mods({ junk: 0.5, grass: 16, sludge: 1, happiness: 10, industrialCost: 1.5, greenCost: 0.85, startPollution: 5 }),
    goals: [
      spireGoal,
      { text: 'Reach the Garden City ending', check: (s) => s.endingKind === 'green' },
      { text: 'Never let smog pass 30%', check: (s) => s.spireDone && s.stats.maxPollution <= 30 },
    ],
    map: { x: 74, y: 62 },
    color: 'var(--green)',
    icon: 'garden',
  },
  {
    id: 'company',
    name: '2PM Company Town',
    tagline: "Kurogane's model city",
    desc: 'Factories are cheap, credits flow, and the air never quite clears. Profit fast, or breathe.',
    traits: ['Industry costs ×0.6', 'Smog clears slower', 'Start: 600 credits'],
    seed: 9090,
    starsToUnlock: 8,
    mods: mods({ industrialCost: 0.6, greenCost: 1.2, decay: 0.7, eventEvery: 0.8, startRes: { scrap: 0, parts: 40, credits: 600 }, startPollution: 35 }),
    goals: [
      spireGoal,
      { text: 'Earn 25,000 credits', check: (s) => s.stats.creditsEarned >= 25000 },
      { text: 'Reach the 2PM Megacity ending', check: (s) => s.endingKind === 'industrial' },
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
