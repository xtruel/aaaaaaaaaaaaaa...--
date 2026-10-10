// Achievements: stored locally and forwarded to Steam when the desktop build provides a bridge.
import { allSpiresDone, allStars, loadCampaign, totalStars } from './campaign';
import { tk } from './i18n';
import type { GameState, OutcomeKind } from './game/state';
import type { IconName } from './render/icons';
import { readKey, writeKey } from './storage';

export interface AchievementDef {
  id: string;
  icon: IconName;
}

export const achName = (a: AchievementDef) => tk(`ach.${a.id}.name`);
export const achDesc = (a: AchievementDef) => tk(`ach.${a.id}.desc`);

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'tutorial', icon: 'star' },
  { id: 'recycler', icon: 'parts' },
  { id: 'citizens', icon: 'pop' },
  { id: 'pop50', icon: 'pop' },
  { id: 'pop100', icon: 'pop' },
  { id: 'rich', icon: 'credits' },
  { id: 'clean', icon: 'leaf' },
  { id: 'miso', icon: 'happy' },
  { id: 'hint', icon: 'star' },
  { id: 'spire', icon: 'star' },
  { id: 'green', icon: 'leaf' },
  { id: 'industrial', icon: 'gear' },
  { id: 'balanced', icon: 'happy' },
  { id: 'smog', icon: 'smog' },
  { id: 'cleanhands', icon: 'leaf' },
  { id: 'roadtrip', icon: 'play' },
  { id: 'coast', icon: 'star' },
  { id: 'superstar', icon: 'star' },
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
