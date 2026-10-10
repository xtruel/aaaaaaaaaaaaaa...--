// Campaign progress across the Scrap Coast: stars, unlocks and the shared region bank.
import { CITIES, TOTAL_STARS } from './game/cities';
import type { CityDef } from './game/cities';
import type { Resource } from './game/defs';
import type { GameState, OutcomeKind } from './game/state';
import { tk } from './i18n';
import { readKey, writeKey } from './storage';

export interface CityProgress {
  stars: boolean[];
  spireDone: boolean;
  endingKind: OutcomeKind | null;
  // what this city has put into the bank so far, minus what it took out (see forgetCityTrades)
  sent?: Record<'credits' | 'parts', number>;
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
    // damaged: keep a copy aside (once) before the next save replaces it
    if (!readKey('campaign-damaged')) writeKey('campaign-damaged', raw);
    console.warn('Campaign progress could not be read; a copy was kept as campaign-damaged');
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
    ...prev,
    stars: prev.stars.map((star, i) => star || !!s.stars[i]),
    spireDone: prev.spireDone || s.spireDone,
    endingKind: s.endingKind ?? prev.endingKind,
  };
  saveCampaign(c);
  const unlocked = CITIES.filter((city) => isUnlocked(c, city) && !before.includes(city.id));
  return { campaign: c, unlocked };
}

// Trades are refused while the city is choking (smog countdown or lost to smog): a lost city's credits
// must not survive in the bank while the city itself is reloaded from before.
export function canTrade(s: GameState): boolean {
  return s.smog <= 0 && s.outcome?.kind !== 'smog';
}

function ledger(c: Campaign, cityId: string | null): Record<'credits' | 'parts', number> | null {
  if (!cityId) return null;
  const p = (c.cities[cityId] = progressOf(c, cityId));
  p.sent ??= { credits: 0, parts: 0 };
  return p.sent;
}

export function sendToBank(s: GameState, res: 'credits' | 'parts', amount: number): number {
  if (!canTrade(s)) return 0;
  const c = loadCampaign();
  const sent = Math.min(amount, Math.floor(s.res[res as Resource]));
  if (sent <= 0) return 0;
  s.res[res as Resource] -= sent;
  const arrived = Math.floor(sent * (1 - BANK_FEE));
  c.bank[res] += arrived;
  const l = ledger(c, s.cityId);
  if (l) l[res] += arrived;
  saveCampaign(c);
  return arrived;
}

export function withdrawFromBank(s: GameState, res: 'credits' | 'parts', amount: number): number {
  if (!canTrade(s)) return 0;
  const c = loadCampaign();
  const got = Math.min(amount, Math.floor(c.bank[res]));
  if (got <= 0) return 0;
  c.bank[res] -= got;
  s.res[res as Resource] += got;
  const l = ledger(c, s.cityId);
  if (l) l[res] -= got;
  saveCampaign(c);
  return got;
}

// "Restart this city" starts it again with its starting money: what the old run put into the bank goes
// with it (the bank may go below zero, and then nothing can be taken out until it is paid back).
// Without this, restart + send would print money.
export function forgetCityTrades(cityId: string): void {
  const c = loadCampaign();
  const p = c.cities[cityId];
  if (!p?.sent) return;
  for (const res of ['credits', 'parts'] as const) c.bank[res] -= Math.max(0, p.sent[res]);
  p.sent = { credits: 0, parts: 0 };
  saveCampaign(c);
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

export function regionEndingTitle(kind: RegionEnding): string {
  return tk(`region.end.${kind}.title`);
}

export function regionEndingText(kind: RegionEnding): string {
  return tk(`region.end.${kind}.text`);
}
