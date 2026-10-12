// Projects to discover (docs/MODULAR-INC2.md §4): the 18 catalog items of increment 2 are found by reaching a goal in a
// city, campaign or free play. The goals read statistics the game already keeps, in the CURRENT city; the local profile
// (src/profile.ts, storage key 'projects') keeps the projects found and, for each measure, the most reached in any one
// city (a maximum: loading the same city again adds nothing). Once found, a project stays found.
// Everything here is pure: it reads the city and never changes the simulation. The only thing it writes is
// GameState.unlocked, which lives in memory (never in the city's save) and is filled from the profile.
// No research currency, no purchases, no chance, no real-time waits, no daily rewards; no project needs another one;
// no goal asks for smog or for the green path (energy counts Solar Arrays and Burners alike).
import { lang, t, tk } from '../i18n';
import type { CatalogKind } from './piecedefs';
import type { GameState } from './state';

export type ProjectKind =
  | 'recyclerMagnet'
  | 'bench'
  | 'cathouse'
  | 'planter'
  | 'base'
  | 'tree'
  | 'podsCapsule'
  | 'recyclerSorter'
  | 'purifierNozzle'
  | 'solarTracker'
  | 'sign'
  | 'factoryArm'
  | 'wall'
  | 'pillar'
  | 'pergola'
  | 'sculpture'
  | 'fountain'
  | 'statue';

// What a goal measures. 'spire': 1 once the Scrap Spire of the city is finished, else 0.
export type GoalStat = 'partsMade' | 'pop' | 'catPets' | 'scrapCollected' | 'built' | 'cleaned' | 'energyProd' | 'creditsEarned' | 'piecesPlaced' | 'spire';

// The pace the table promises: start (inizio), development (sviluppo), completion (completamento).
export type ProjectPhase = 'start' | 'development' | 'completion';

export interface ProjectDef {
  kind: ProjectKind;
  stat: GoalStat;
  target: number;
  phase: ProjectPhase;
}

// docs/MODULAR-INC2.md §4, in the table's order.
export const PROJECTS: readonly ProjectDef[] = [
  { kind: 'recyclerMagnet', stat: 'partsMade', target: 100, phase: 'start' },
  { kind: 'bench', stat: 'pop', target: 10, phase: 'start' },
  { kind: 'cathouse', stat: 'catPets', target: 3, phase: 'start' },
  { kind: 'planter', stat: 'scrapCollected', target: 300, phase: 'start' },
  { kind: 'base', stat: 'built', target: 10, phase: 'start' },
  { kind: 'tree', stat: 'pop', target: 20, phase: 'start' },
  { kind: 'podsCapsule', stat: 'pop', target: 30, phase: 'development' },
  { kind: 'recyclerSorter', stat: 'partsMade', target: 400, phase: 'development' },
  { kind: 'purifierNozzle', stat: 'cleaned', target: 10, phase: 'development' },
  { kind: 'solarTracker', stat: 'energyProd', target: 30, phase: 'development' },
  { kind: 'sign', stat: 'built', target: 25, phase: 'development' },
  { kind: 'factoryArm', stat: 'creditsEarned', target: 5000, phase: 'development' },
  { kind: 'wall', stat: 'scrapCollected', target: 1000, phase: 'development' },
  { kind: 'pillar', stat: 'piecesPlaced', target: 20, phase: 'development' },
  { kind: 'pergola', stat: 'pop', target: 50, phase: 'completion' },
  { kind: 'sculpture', stat: 'spire', target: 1, phase: 'completion' },
  { kind: 'fountain', stat: 'creditsEarned', target: 10000, phase: 'completion' },
  { kind: 'statue', stat: 'built', target: 40, phase: 'completion' },
];

export const PROJECT_KINDS: readonly ProjectKind[] = PROJECTS.map((p) => p.kind);
export const GOAL_STATS: readonly GoalStat[] = ['partsMade', 'pop', 'catPets', 'scrapCollected', 'built', 'cleaned', 'energyProd', 'creditsEarned', 'piecesPlaced', 'spire'];

const BY_KIND = new Map<string, ProjectDef>(PROJECTS.map((p) => [p.kind, p]));

export function isProject(kind: unknown): kind is ProjectKind {
  return typeof kind === 'string' && BY_KIND.has(kind);
}

export function isGoalStat(stat: unknown): stat is GoalStat {
  return typeof stat === 'string' && (GOAL_STATS as readonly string[]).includes(stat);
}

export function projectDef(kind: ProjectKind): ProjectDef {
  return BY_KIND.get(kind)!;
}

// A catalog item that has to be discovered first and is not yet (the increment-1 items and the buildings never are).
export function isLocked(s: GameState, kind: CatalogKind): boolean {
  return isProject(kind) && !s.unlocked.has(kind);
}

// The city's value for a goal: whole citizens, credits and parts (the HUD shows them rounded down), the power made
// right now, 1 once the Spire is finished. A damaged number counts as 0.
export function goalValue(s: GameState, stat: GoalStat): number {
  let v: number;
  if (stat === 'spire') v = s.spireDone ? 1 : 0;
  else if (stat === 'pop') v = s.pop;
  else if (stat === 'energyProd') v = s.derived.energyProd;
  else v = (s.stats as unknown as Record<string, number>)[stat];
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

// Has this city reached the project's goal?
export function goalReached(s: GameState, kind: ProjectKind): boolean {
  const p = projectDef(kind);
  return goalValue(s, p.stat) >= p.target;
}

// A project's goal in this city: { value, target } ("120 / 400").
export function cityProgress(s: GameState, kind: ProjectKind): { value: number; target: number } {
  const p = projectDef(kind);
  return { value: Math.min(goalValue(s, p.stat), p.target), target: p.target };
}

// The projects this city has reached that are not discovered yet, in the table's order. Pure: unlocked is not touched.
export function reachedNow(s: GameState): ProjectKind[] {
  return PROJECT_KINDS.filter((k) => !s.unlocked.has(k) && goalReached(s, k));
}

// Discovers what the city has reached (reachedNow) and returns it. Only GameState.unlocked changes (in memory); a
// project already found stays found whatever the city does next. Gives nothing: no resources, no refunds.
export function discoverReached(s: GameState): ProjectKind[] {
  const found = reachedNow(s);
  for (const k of found) s.unlocked.add(k);
  return found;
}

// What a loaded city's saved data proves (its statistics, citizens, Spire; the power its finished buildings make):
// the projects whose goal it reached. Nothing else is assumed (an old save without a statistic counts it as 0).
export function provenBySave(s: GameState): ProjectKind[] {
  return PROJECT_KINDS.filter((k) => goalReached(s, k));
}

// The city's values for every measure (what the profile's maxima compare against).
export function goalValues(s: GameState): Record<GoalStat, number> {
  return Object.fromEntries(GOAL_STATS.map((st) => [st, goalValue(s, st)])) as Record<GoalStat, number>;
}

// ---------- words ----------

// "Make 400 parts", "Earn 5,000 credits": the goal in the player's language.
export function goalText(kind: ProjectKind): string {
  const p = projectDef(kind);
  return tk(`proj.goal.${p.stat}`, { n: formatCount(p.target) });
}

// Whole numbers grouped as the dictionaries write them ("5,000", "5.000", "5 000"; Spanish, Portuguese and Polish
// group from 10 000 up), the same in every browser.
const GROUPING: Record<string, { sep: string; from: number }> = {
  en: { sep: ',', from: 1000 },
  it: { sep: '.', from: 1000 },
  de: { sep: '.', from: 1000 },
  nl: { sep: '.', from: 1000 },
  fr: { sep: '\u00a0', from: 1000 },
  es: { sep: '.', from: 10000 },
  pt: { sep: '\u00a0', from: 10000 },
  pl: { sep: '\u00a0', from: 10000 },
};

export function formatCount(n: number): string {
  const v = Math.max(0, Math.floor(Number.isFinite(n) ? n : 0));
  const g = GROUPING[lang()] ?? GROUPING.en;
  return v < g.from ? String(v) : String(v).replace(/\B(?=(\d{3})+(?!\d))/g, g.sep);
}

// Why a project cannot be bought yet, with the city's progress: "Project to discover: make 400 parts (120 / 400 in
// this city)". The words pieceCheck and moduleCheck refuse with.
export function lockedReason(s: GameState, kind: ProjectKind): string {
  const p = projectDef(kind);
  if (p.stat === 'spire') return t('place.lockedSpire', { goal: goalText(kind) });
  const { value, target } = cityProgress(s, kind);
  return t('place.locked', { goal: goalText(kind), n: formatCount(value), target: formatCount(target) });
}

// ---------- the profile's data (stored by src/profile.ts) ----------

export const PROFILE_VERSION = 1;

// { version: 1, discovered: [...], best: {...} }. discovered may hold ids this build does not know (a newer build's):
// they are kept as they are. best: per measure, the most reached in any one city (never a sum across cities).
export interface ProjectsProfile {
  version: number;
  discovered: string[];
  best: Record<string, number>;
  [extra: string]: unknown;
}

export type ProfileStatus = 'empty' | 'ok' | 'damaged' | 'otherVersion';

export interface ParsedProfile {
  profile: ProjectsProfile;
  status: ProfileStatus;
  version: number; // the version written in the stored text (0: none, or it could not be read)
}

export function emptyProfile(): ProjectsProfile {
  return { version: PROFILE_VERSION, discovered: [], best: {} };
}

const goodNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

// Reads the stored text without ever losing what it holds: a damaged text still gives back every project id that can
// be found in it (ids appear only in the discovered list); a text of another version gives what it has in the known
// shape (the caller keeps a copy before writing over either: see src/profile.ts).
export function parseProfile(raw: string | null): ParsedProfile {
  if (raw === null || raw === '') return { profile: emptyProfile(), status: 'empty', version: 0 };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    data = undefined;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    const salvaged = PROJECT_KINDS.filter((k) => raw.includes(`"${k}"`));
    return { profile: { ...emptyProfile(), discovered: [...salvaged] }, status: 'damaged', version: 0 };
  }
  const d = data as Record<string, unknown>;
  const version = typeof d.version === 'number' && Number.isInteger(d.version) && d.version > 0 ? d.version : 0;
  const discovered = Array.isArray(d.discovered) ? [...new Set(d.discovered.filter((k): k is string => typeof k === 'string'))] : [];
  const best: Record<string, number> = {};
  if (d.best && typeof d.best === 'object' && !Array.isArray(d.best)) {
    for (const [k, v] of Object.entries(d.best as Record<string, unknown>)) if (goodNumber(v)) best[k] = v;
  }
  const profile: ProjectsProfile = { ...d, version: PROFILE_VERSION, discovered, best };
  return { profile, status: version === PROFILE_VERSION ? 'ok' : 'otherVersion', version };
}

// The profile with more found and higher maxima: a union of the projects (never fewer) and, for each measure, the
// higher value (never a sum). Unknown keys and ids are kept.
export function mergeProfile(base: ProjectsProfile, add: { discovered?: Iterable<string>; best?: Partial<Record<string, number>> }): ProjectsProfile {
  const discovered = [...base.discovered];
  for (const k of add.discovered ?? []) if (typeof k === 'string' && !discovered.includes(k)) discovered.push(k);
  const best = { ...base.best };
  for (const [k, v] of Object.entries(add.best ?? {})) if (goodNumber(v) && v > (best[k] ?? 0)) best[k] = v;
  return { ...base, version: PROFILE_VERSION, discovered, best };
}

// The projects of this build the profile has found.
export function profileUnlocked(p: ProjectsProfile): Set<ProjectKind> {
  return new Set(p.discovered.filter(isProject));
}

// The most reached for a measure in any one city, as the profile keeps it (0 when never).
export function profileBest(p: ProjectsProfile, stat: GoalStat): number {
  const v = p.best[stat];
  return goodNumber(v) ? Math.floor(v) : 0;
}
