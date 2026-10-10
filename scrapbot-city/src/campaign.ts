// Campaign progress across the Scrap Coast: stars, unlocks and the shared region bank.
import { CITIES, TOTAL_STARS } from './game/cities';
import type { CityDef } from './game/cities';
import type { Resource } from './game/defs';
import type { GameState, OutcomeKind } from './game/state';
import { readKey, writeKey } from './storage';

export interface CityProgress {
  stars: boolean[];
  spireDone: boolean;
  endingKind: OutcomeKind | null;
}

export interface Campaign {
  version: 1;
  bank: Record<'credits' | 'parts', number>;
  cities: Record<string, CityProgress>;
  finaleSeen: boolean;
}

export const BANK_FEE = 0.1; // the cargo blimp keeps 10% of what you send

function fresh(): Campaign {
  return { version: 1, bank: { credits: 0, parts: 0 }, cities: {}, finaleSeen: false };
}

export function loadCampaign(): Campaign {
  const raw = readKey('campaign');
  if (!raw) return fresh();
  try {
    const c = JSON.parse(raw) as Campaign;
    return { ...fresh(), ...c, bank: { ...fresh().bank, ...c.bank } };
  } catch {
    return fresh();
  }
}

export function saveCampaign(c: Campaign): void {
  writeKey('campaign', JSON.stringify(c));
}

export function progressOf(c: Campaign, id: string): CityProgress {
  return c.cities[id] ?? { stars: [false, false, false], spireDone: false, endingKind: null };
}

export function totalStars(c: Campaign): number {
  return CITIES.reduce((n, city) => n + progressOf(c, city.id).stars.filter(Boolean).length, 0);
}

export function isUnlocked(c: Campaign, city: CityDef): boolean {
  return totalStars(c) >= city.starsToUnlock;
}

export function allSpiresDone(c: Campaign): boolean {
  return CITIES.every((city) => progressOf(c, city.id).spireDone);
}

export function allStars(c: Campaign): boolean {
  return totalStars(c) >= TOTAL_STARS;
}

// Copies a city's results into the campaign. Stars are never lost, even if the city is restarted.
export function recordCity(s: GameState): { campaign: Campaign; unlocked: CityDef[] } {
  const c = loadCampaign();
  if (!s.cityId) return { campaign: c, unlocked: [] };
  const before = CITIES.filter((city) => isUnlocked(c, city)).map((city) => city.id);
  const prev = progressOf(c, s.cityId);
  c.cities[s.cityId] = {
    stars: prev.stars.map((star, i) => star || !!s.stars[i]),
    spireDone: prev.spireDone || s.spireDone,
    endingKind: s.endingKind ?? prev.endingKind,
  };
  saveCampaign(c);
  const unlocked = CITIES.filter((city) => isUnlocked(c, city) && !before.includes(city.id));
  return { campaign: c, unlocked };
}

export function sendToBank(s: GameState, res: 'credits' | 'parts', amount: number): number {
  const c = loadCampaign();
  const sent = Math.min(amount, Math.floor(s.res[res as Resource]));
  if (sent <= 0) return 0;
  s.res[res as Resource] -= sent;
  const arrived = Math.floor(sent * (1 - BANK_FEE));
  c.bank[res] += arrived;
  saveCampaign(c);
  return arrived;
}

export function withdrawFromBank(s: GameState, res: 'credits' | 'parts', amount: number): number {
  const c = loadCampaign();
  const got = Math.min(amount, Math.floor(c.bank[res]));
  if (got <= 0) return 0;
  c.bank[res] -= got;
  s.res[res as Resource] += got;
  saveCampaign(c);
  return got;
}

export type RegionEnding = 'green' | 'industrial' | 'balanced';

export function regionEnding(c: Campaign): RegionEnding {
  let green = 0;
  let industrial = 0;
  for (const city of CITIES) {
    const kind = progressOf(c, city.id).endingKind;
    if (kind === 'green') green++;
    if (kind === 'industrial') industrial++;
  }
  if (green >= 3) return 'green';
  if (industrial >= 3) return 'industrial';
  return 'balanced';
}

export const REGION_ENDINGS: Record<RegionEnding, { title: string; text: string }> = {
  green: {
    title: 'The Green Coast',
    text: 'From Rustbay to Greenvale, the Spires are covered in moss and solar petals. The Pixel Planet Initiative puts the Scrap Coast on its posters. Miso finally has a sunny roof in every city.',
  },
  industrial: {
    title: 'The 2PM Coast',
    text: 'Five Spires, five chimneys. The coast runs on 2PM money and the blimps never land. Kurogane calls it the most profitable region on the planet. Nobody remembers what the sky looked like.',
  },
  balanced: {
    title: 'Different Futures, Same Coast',
    text: 'Some cities chose gardens, some chose foundries. The cargo blimps carry parts one way and credits the other, and the coast keeps both. Small robots, big choices.',
  },
};
