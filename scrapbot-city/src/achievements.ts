// Achievements: stored locally and forwarded to Steam when the desktop build provides a bridge.
import { allSpiresDone, allStars, loadCampaign, totalStars } from './campaign';
import type { GameState, OutcomeKind } from './game/state';
import type { IconName } from './render/icons';
import { readKey, writeKey } from './storage';

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  icon: IconName;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'tutorial', name: 'Bootcamp Graduate', desc: 'Finish the tutorial.', icon: 'star' },
  { id: 'recycler', name: 'Junk to Jewels', desc: 'Build your first Recycler.', icon: 'parts' },
  { id: 'citizens', name: 'Neighbours', desc: 'Welcome your first citizen.', icon: 'pop' },
  { id: 'pop50', name: 'Busy Streets', desc: 'Reach 50 citizens in one city.', icon: 'pop' },
  { id: 'pop100', name: 'Metropixel', desc: 'Reach 100 citizens in one city.', icon: 'pop' },
  { id: 'rich', name: 'Credit Score', desc: 'Earn 10,000 credits in one city.', icon: 'credits' },
  { id: 'clean', name: 'Sludge Buster', desc: 'Clean 25 sludge tiles in one city.', icon: 'leaf' },
  { id: 'miso', name: 'Cat Person', desc: 'Pet Miso 10 times.', icon: 'happy' },
  { id: 'hint', name: 'Ask the Expert', desc: 'Ask USA-9 for a hint.', icon: 'star' },
  { id: 'spire', name: 'Reach for the Sky', desc: 'Finish a Scrap Spire.', icon: 'star' },
  { id: 'green', name: 'Garden City', desc: 'Reach the Green ending.', icon: 'leaf' },
  { id: 'industrial', name: 'Megacity', desc: 'Reach the Industrial ending.', icon: 'gear' },
  { id: 'balanced', name: 'Both Ways', desc: 'Reach the Balanced ending.', icon: 'happy' },
  { id: 'smog', name: 'Learned the Hard Way', desc: 'Lose a city to the smog.', icon: 'smog' },
  { id: 'cleanhands', name: 'Clean Hands', desc: 'Finish a Spire without building any industry.', icon: 'leaf' },
  { id: 'roadtrip', name: 'Road Trip', desc: 'Unlock a second city on the Scrap Coast.', icon: 'play' },
  { id: 'coast', name: 'Coast to Coast', desc: 'Finish the Spire in all five cities.', icon: 'star' },
  { id: 'superstar', name: 'Superstar', desc: 'Earn all 15 stars.', icon: 'star' },
];

interface DesktopBridge {
  unlockAchievement?: (id: string) => void;
}

type Listener = (a: AchievementDef) => void;
let listener: Listener | null = null;

export function onAchievement(fn: Listener): void {
  listener = fn;
}

export function unlockedAchievements(): string[] {
  try {
    return JSON.parse(readKey('achievements') ?? '[]') as string[];
  } catch {
    return [];
  }
}

export function unlock(id: string): void {
  const list = unlockedAchievements();
  const def = ACHIEVEMENTS.find((a) => a.id === id);
  if (!def || list.includes(id)) return;
  writeKey('achievements', JSON.stringify([...list, id]));
  (window as unknown as { scrapbotDesktop?: DesktopBridge }).scrapbotDesktop?.unlockAchievement?.(id);
  listener?.(def);
}

// Desktop builds re-send everything on start, in case Steam was offline earlier.
export function syncAchievements(): void {
  const bridge = (window as unknown as { scrapbotDesktop?: DesktopBridge }).scrapbotDesktop;
  if (!bridge?.unlockAchievement) return;
  for (const id of unlockedAchievements()) bridge.unlockAchievement(id);
}

export function checkCity(s: GameState): void {
  const has = (t: string) => s.buildings.some((b) => b.type === t && b.built >= 1);
  if (has('recycler')) unlock('recycler');
  if (s.pop >= 1) unlock('citizens');
  if (s.pop >= 50) unlock('pop50');
  if (s.pop >= 100) unlock('pop100');
  if (s.stats.creditsEarned >= 10000) unlock('rich');
  if (s.stats.cleaned >= 25) unlock('clean');
  if (s.stats.catPets >= 10) unlock('miso');
  if (s.spireDone) {
    unlock('spire');
    if (s.stats.industrialBuilt === 0) unlock('cleanhands');
  }
}

export function checkOutcome(kind: OutcomeKind): void {
  unlock(kind);
}

export function checkCampaign(): void {
  const c = loadCampaign();
  if (totalStars(c) >= 1) unlock('roadtrip');
  if (allSpiresDone(c)) unlock('coast');
  if (allStars(c)) unlock('superstar');
}
