// The player's projects profile (docs/MODULAR-INC2.md §4): which of the 18 projects have been discovered, and for each
// goal's measure the most reached in any one city. Stored under the key 'projects' as versioned JSON
// { version: 1, discovered: [...], best: {...} } through readKey/writeKey, so the desktop build keeps it as a file
// (projects.sav) that Steam Cloud carries with the saves.
// It is only ever added to: a project once found stays found, a maximum only goes up. Nothing stored is lost: a text
// that cannot be read, or one written by another version, is copied aside (backup:projects:...) before the first write
// over it, and whatever can be read from it is kept.
import { loadCampaign } from './campaign';
import { GOAL_STATS, discoverReached, goalValue, mergeProfile, parseProfile, profileBest, profileUnlocked } from './game/projects';
import type { GoalStat, ProjectKind, ProjectsProfile } from './game/projects';
import type { GameState } from './game/state';
import { readKey, writeKey } from './storage';

export const PROFILE_KEY = 'projects';

// A short fingerprint of a text, so two different damaged texts get two backups.
function fingerprint(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

// Copies a profile text this version cannot take as it is (damaged, or another version) aside, once per text:
// backup:projects:v<version> (v0: damaged or without a version), or with a fingerprint when that key holds another
// text already. Backups are never overwritten or removed. False when the copy could not be made.
function backupProfile(raw: string, version: number): boolean {
  const plain = `backup:${PROFILE_KEY}:v${version}`;
  for (const key of [plain, `${plain}:${fingerprint(raw)}`]) {
    const there = readKey(key);
    if (there === raw) return true;
    if (there === null) return writeKey(key, raw);
  }
  return false;
}

// What the profile holds now (an empty one when there is none or storage is blocked).
export function loadProfile(): ProjectsProfile {
  return parseProfile(readKey(PROFILE_KEY)).profile;
}

// Adds projects found and maxima reached to the stored profile: what is stored is read again first and only grows
// (union of the projects, the higher of each maximum), so another window or an older copy never takes anything away.
// Returns the profile as it is now (in memory too when it could not be written).
export function recordProfile(add: { discovered?: Iterable<string>; best?: Partial<Record<GoalStat, number>> }): ProjectsProfile {
  const raw = readKey(PROFILE_KEY);
  const parsed = parseProfile(raw);
  const next = mergeProfile(parsed.profile, add);
  // nothing new: the stored text is not touched (not even rewritten in another form)
  if (JSON.stringify(next) === JSON.stringify(parsed.profile)) return next;
  // a text that is not a version-1 profile is kept aside before it is first written over; without that copy it is
  // left alone (the game goes on with the projects in memory)
  if (raw !== null && raw !== '' && parsed.status !== 'ok' && !backupProfile(raw, parsed.version)) return next;
  writeKey(PROFILE_KEY, JSON.stringify(next));
  return next;
}

// The campaign cities whose Spire is finished, as the campaign profile records them (old saves included): they prove
// the Spire goal without loading the city.
export function campaignSpireDone(): boolean {
  try {
    return Object.values(loadCampaign().cities ?? {}).some((c) => !!c && c.spireDone === true);
  } catch {
    return false;
  }
}

// The projects a new or loaded city starts with: the profile's, plus what the campaign profile proves (a finished
// Spire). Anything proven here that the profile did not have yet is written to it and returned as `found`.
export function startingProjects(): { unlocked: Set<ProjectKind>; profile: ProjectsProfile; found: ProjectKind[] } {
  let profile = loadProfile();
  const unlocked = profileUnlocked(profile);
  const found: ProjectKind[] = [];
  if (!unlocked.has('sculpture') && campaignSpireDone()) {
    unlocked.add('sculpture');
    found.push('sculpture');
    profile = recordProfile({ discovered: found, best: { spire: 1 } });
  }
  return { unlocked, profile, found };
}

// One city's watch over its projects (the session keeps one): fills GameState.unlocked from the profile when the city
// starts or is loaded, then, as the city's statistics change, discovers what it reaches and raises the profile's maxima.
// It only reads the city: no Math.random, nothing in the simulation changes (only s.unlocked, in memory). The found
// projects are written to the profile at once; the maxima when the city is saved or left (flush), and with a discovery.
export class ProjectTracker {
  profile: ProjectsProfile;
  // what the city's statistics prove at the start (a loaded save: its stats, citizens, Spire; the campaign profile's
  // finished Spires) and the profile did not have yet: announced like any discovery
  readonly foundAtStart: ProjectKind[];
  private best: Partial<Record<GoalStat, number>> = {};
  private dirty = false;

  constructor(s: GameState) {
    const start = startingProjects();
    s.unlocked = start.unlocked;
    this.profile = start.profile;
    this.foundAtStart = [...start.found, ...this.check(s)];
  }

  // The projects the city has just reached (in the table's order), discovered now. The city's values also raise the
  // maxima kept in memory.
  check(s: GameState): ProjectKind[] {
    for (const stat of GOAL_STATS) {
      const v = goalValue(s, stat);
      if (v > Math.max(this.best[stat] ?? 0, profileBest(this.profile, stat))) {
        this.best[stat] = v;
        this.dirty = true;
      }
    }
    const found = discoverReached(s);
    if (found.length) this.flush(found);
    return found;
  }

  // Writes what is new (found projects, higher maxima) to the stored profile.
  flush(found: readonly ProjectKind[] = []): void {
    if (!found.length && !this.dirty) return;
    this.profile = recordProfile({ discovered: found, best: this.best });
    this.dirty = false;
  }

  // The most reached for a measure in any one city: the profile's, or this city's if higher.
  bestOf(stat: GoalStat): number {
    return Math.max(profileBest(this.profile, stat), this.best[stat] ?? 0);
  }
}
