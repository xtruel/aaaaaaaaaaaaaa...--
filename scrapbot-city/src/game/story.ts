// Narrative content: characters, choice events, objectives and endings.
// All text lives in the translation files: ev.<id>.*, obj.<id>.*, end.<kind>.*, speaker.<id>.*.
import { t, tk } from '../i18n';
import type { BuildingType, PathKind } from './defs';
import { addWaste, buildCost, costText, gain, pay, placeFreeGarden, shiftAlignment, spawnJunk, spawnSludge } from './actions';
import { day } from './state';
import type { GameState, OutcomeKind } from './state';

export type Speaker = 'usa' | 'miso' | 'corp' | 'citizens' | 'ppi';

export function speakerName(sp: Speaker): string {
  return tk(`speaker.${sp}.name`);
}

export function speakerRole(sp: Speaker): string {
  return tk(`speaker.${sp}.role`);
}

export interface EventChoice {
  path: PathKind;
  available?: (s: GameState) => boolean;
  apply: (s: GameState) => string; // returns the (translated) result line shown afterwards
}

export interface StoryEvent {
  id: string;
  speaker: Speaker;
  repeatable?: boolean;
  when: (s: GameState) => boolean;
  choices: EventChoice[];
}

export const eventTitle = (ev: StoryEvent) => tk(`ev.${ev.id}.title`);
export const eventText = (ev: StoryEvent) => tk(`ev.${ev.id}.text`);
export const choiceLabel = (ev: StoryEvent, i: number) => tk(`ev.${ev.id}.c${i + 1}`);

const has = (s: GameState, type: BuildingType) => s.buildings.some((b) => b.type === type && b.built >= 1);

export const EVENTS: StoryEvent[] = [
  {
    id: 'toxic_contract',
    speaker: 'corp',
    when: (s) => day(s) >= 2,
    choices: [
      {
        path: 'industrial',
        apply: (s) => {
          gain(s, { credits: 350 });
          spawnSludge(s, 8);
          shiftAlignment(s, -15);
          return t('ev.toxic_contract.r1');
        },
      },
      {
        path: 'green',
        apply: (s) => {
          shiftAlignment(s, 10);
          s.happyMod += 6;
          return t('ev.toxic_contract.r2');
        },
      },
    ],
  },
  {
    id: 'satellite',
    speaker: 'usa',
    when: (s) => day(s) >= 2,
    choices: [
      {
        path: 'green',
        apply: (s) => {
          gain(s, { parts: 45 });
          spawnJunk(s, 4, 10, 20);
          shiftAlignment(s, 5);
          return t('ev.satellite.r1');
        },
      },
      {
        path: 'industrial',
        apply: (s) => {
          gain(s, { credits: 220 });
          shiftAlignment(s, -5);
          return t('ev.satellite.r2');
        },
      },
    ],
  },
  {
    id: 'park_petition',
    speaker: 'citizens',
    when: (s) => has(s, 'pods') && s.pop >= 6,
    choices: [
      {
        path: 'green',
        available: (s) => s.res.credits >= 40,
        apply: (s) => {
          shiftAlignment(s, 8);
          s.happyMod += 8;
          if (!placeFreeGarden(s)) return t('ev.park_petition.r1b');
          pay(s, { credits: 40 });
          return t('ev.park_petition.r1');
        },
      },
      {
        path: 'neutral',
        apply: (s) => {
          s.happyMod -= 8;
          shiftAlignment(s, -3);
          return t('ev.park_petition.r2');
        },
      },
    ],
  },
  {
    id: 'overtime',
    speaker: 'corp',
    when: (s) => has(s, 'smelter') || has(s, 'factory'),
    choices: [
      {
        path: 'industrial',
        apply: (s) => {
          s.overtimeUntil = s.time + 60;
          shiftAlignment(s, -10);
          return t('ev.overtime.r1');
        },
      },
      {
        path: 'green',
        apply: (s) => {
          shiftAlignment(s, 5);
          s.happyMod += 4;
          return t('ev.overtime.r2');
        },
      },
    ],
  },
  {
    id: 'smog_protest',
    speaker: 'citizens',
    repeatable: true,
    when: (s) => s.pollution >= 55,
    choices: [
      {
        path: 'green',
        available: (s) => s.res.credits >= 150,
        apply: (s) => {
          pay(s, { credits: 150 });
          s.pollution = Math.max(0, s.pollution - 15);
          shiftAlignment(s, 5);
          return t('ev.smog_protest.r1');
        },
      },
      {
        path: 'industrial',
        apply: (s) => {
          s.pop *= 0.8;
          s.happyMod -= 10;
          shiftAlignment(s, -5);
          return t('ev.smog_protest.r2');
        },
      },
    ],
  },
  {
    id: 'eco_grant',
    speaker: 'ppi',
    when: (s) => s.pollution <= 30 && day(s) >= 3,
    choices: [
      {
        path: 'green',
        apply: (s) => {
          gain(s, { credits: 220, parts: 20 });
          shiftAlignment(s, 8);
          return t('ev.eco_grant.r1');
        },
      },
      {
        path: 'industrial',
        apply: (s) => {
          gain(s, { credits: 400 });
          shiftAlignment(s, -15);
          return t('ev.eco_grant.r2');
        },
      },
    ],
  },
  {
    id: 'stray_cats',
    speaker: 'miso',
    when: (s) => day(s) >= 3,
    choices: [
      {
        path: 'green',
        available: (s) => s.res.credits >= 30,
        apply: (s) => {
          pay(s, { credits: 30 });
          s.happyMod += 10;
          shiftAlignment(s, 3);
          return t('ev.stray_cats.r1');
        },
      },
      {
        path: 'neutral',
        apply: (s) => {
          s.happyMod -= 3;
          return t('ev.stray_cats.r2');
        },
      },
    ],
  },
  {
    id: 'thrusters',
    speaker: 'usa',
    // "keep the blueprints for later" really means later: the offer comes back until it is bought
    repeatable: true,
    when: (s) => s.bots.length >= 7 && s.botSpeedMul === 1,
    choices: [
      {
        path: 'neutral',
        available: (s) => s.res.parts >= 30 && s.res.credits >= 80,
        apply: (s) => {
          pay(s, { parts: 30, credits: 80 });
          s.botSpeedMul *= 1.3;
          return t('ev.thrusters.r1');
        },
      },
      {
        path: 'neutral',
        apply: () => t('ev.thrusters.r2'),
      },
    ],
  },
  {
    id: 'scrap_market',
    speaker: 'corp',
    repeatable: true,
    when: (s) => s.res.scrap >= 100,
    choices: [
      {
        path: 'industrial',
        available: (s) => s.res.scrap >= 100,
        apply: (s) => {
          pay(s, { scrap: 100 });
          gain(s, { credits: 260 });
          shiftAlignment(s, -3);
          return t('ev.scrap_market.r1');
        },
      },
      {
        path: 'green',
        apply: (s) => {
          shiftAlignment(s, 3);
          return t('ev.scrap_market.r2');
        },
      },
    ],
  },
  {
    id: 'citizen_trash_day',
    speaker: 'citizens',
    repeatable: true,
    when: (s) => s.pop >= 15,
    choices: [
      {
        path: 'neutral',
        apply: (s) => {
          for (let i = 0; i < 6; i++) addWaste(s, 10);
          return t('ev.citizen_trash_day.r1');
        },
      },
    ],
  },
];

// A repeatable event waits at least this long (game seconds, 4 days) before it can come back.
const RERUN_GAP = 240;

export function pickEvent(s: GameState): StoryEvent | null {
  const recent = (e: StoryEvent) => s.time - (s.eventLast[e.id] ?? -Infinity) < RERUN_GAP;
  const pool = EVENTS.filter((e) => (e.repeatable ? !recent(e) : !s.eventsSeen.includes(e.id)) && e.when(s));
  if (pool.length === 0) return null;
  // Prefer events the player has not seen yet.
  const fresh = pool.filter((e) => !s.eventsSeen.includes(e.id));
  const list = fresh.length > 0 ? fresh : pool;
  return list[Math.floor(Math.random() * list.length)];
}

export function eventById(id: string): StoryEvent | undefined {
  return EVENTS.find((e) => e.id === id);
}

export interface Objective {
  id: string;
  done: (s: GameState) => boolean;
  reward?: { credits?: number; parts?: number };
  tools?: (s: GameState) => BuildingType[]; // the build buttons that move this goal forward right now
}

// More citizens only need more homes once every home is taken.
const homesFull = (s: GameState): BuildingType[] => (s.pop >= s.derived.housing ? ['pods'] : []);
// Alignment past this counts as a clear path: the money goal then points at that path's buildings only.
const CLEAR_PATH = 15;

export const OBJECTIVES: Objective[] = [
  { id: 'collect', done: (s) => s.stats.scrapCollected >= 25, reward: { credits: 40 } },
  { id: 'recycler', done: (s) => has(s, 'recycler'), reward: { parts: 15 }, tools: () => ['recycler'] },
  { id: 'pods', done: (s) => has(s, 'pods'), reward: { credits: 40 }, tools: () => ['pods'] },
  { id: 'power', done: (s) => has(s, 'solar') || has(s, 'burner'), reward: { parts: 20 }, tools: () => ['solar', 'burner'] },
  { id: 'pop10', done: (s) => s.pop >= 10, reward: { credits: 60 }, tools: homesFull },
  {
    id: 'money',
    done: (s) => has(s, 'fixlab') || has(s, 'smelter') || has(s, 'factory'),
    reward: { credits: 80 },
    tools: (s) => (s.alignment >= CLEAR_PATH ? ['fixlab'] : s.alignment <= -CLEAR_PATH ? ['smelter', 'factory'] : ['fixlab', 'smelter', 'factory']),
  },
  { id: 'pop30', done: (s) => s.pop >= 30, reward: { credits: 120 }, tools: homesFull },
  { id: 'spireStart', done: (s) => s.buildings.some((b) => b.type === 'spire'), tools: () => ['spire'] },
  { id: 'spireDone', done: (s) => s.spireDone },
];

// What the goal card asks the player to build next. Nothing while one of those is already going up:
// the next step is under way, and a second one would only cost money.
export function objectiveTools(s: GameState): BuildingType[] {
  const tools = OBJECTIVES[s.objective]?.tools?.(s) ?? [];
  return s.buildings.some((b) => b.built < 1 && tools.includes(b.type)) ? [] : tools;
}

export function objectiveText(o: Objective): string {
  return tk(`obj.${o.id}`);
}

export function objectiveHint(o: Objective, s: GameState): string {
  return tk(`obj.${o.id}.hint`, { cost: costText(buildCost(s, 'spire')) });
}

export function endingTitle(kind: OutcomeKind): string {
  return tk(`end.${kind}.title`);
}

export function endingSubtitle(kind: OutcomeKind): string {
  return tk(`end.${kind}.subtitle`);
}

export function endingText(kind: OutcomeKind, cityName: string): string {
  return tk(`end.${kind}.text`, { city: cityName });
}

export function endingFor(s: GameState): OutcomeKind {
  if (s.alignment >= 35) return 'green';
  if (s.alignment <= -35) return 'industrial';
  return 'balanced';
}
