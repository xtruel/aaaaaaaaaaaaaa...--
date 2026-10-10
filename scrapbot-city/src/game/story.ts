// Narrative content: characters, choice events, objectives and endings.
import { BUILDINGS } from './defs';
import type { BuildingType, PathKind } from './defs';
import { addWaste, gain, pay, placeFreeGarden, shiftAlignment, spawnJunk, spawnSludge } from './actions';
import { day } from './state';
import type { GameState, OutcomeKind } from './state';

export type Speaker = 'usa' | 'miso' | 'corp' | 'citizens' | 'ppi';

export const SPEAKERS: Record<Speaker, { name: string; role: string }> = {
  usa: { name: 'USA-9', role: 'Lead scrapbot' },
  miso: { name: 'Miso', role: 'City cat' },
  corp: { name: 'K. Kurogane', role: '2PM Corp' },
  citizens: { name: 'Citizens', role: 'Pod council' },
  ppi: { name: 'P.P.I.', role: 'Pixel Planet Initiative' },
};

export interface EventChoice {
  label: string;
  path: PathKind;
  available?: (s: GameState) => boolean;
  apply: (s: GameState) => string; // returns the result line shown afterwards
}

export interface StoryEvent {
  id: string;
  speaker: Speaker;
  title: string;
  text: string;
  repeatable?: boolean;
  when: (s: GameState) => boolean;
  choices: EventChoice[];
}

const has = (s: GameState, type: BuildingType) => s.buildings.some((b) => b.type === type && b.built >= 1);

export const EVENTS: StoryEvent[] = [
  {
    id: 'toxic_contract',
    speaker: 'corp',
    title: 'A generous offer',
    text: '2PM Corp would like to "temporarily store" a few barrels in your east lot. They glow a little. 350 credits, no questions asked.',
    when: (s) => day(s) >= 2,
    choices: [
      {
        label: 'Take the money',
        path: 'industrial',
        apply: (s) => {
          gain(s, { credits: 350 });
          spawnSludge(s, 8);
          shiftAlignment(s, -15);
          return '+350 credits. The barrels leak by morning. New sludge somewhere in the city.';
        },
      },
      {
        label: 'No toxic dumping here',
        path: 'green',
        apply: (s) => {
          shiftAlignment(s, 10);
          s.happyMod += 6;
          return 'Kurogane smiles thinly and leaves. The pods cheer.';
        },
      },
    ],
  },
  {
    id: 'satellite',
    speaker: 'usa',
    title: 'Something fell from the sky',
    text: 'A dead satellite just crashed next to the landfill! Its solar cells still work. We could strip it ourselves, or 2PM will pay cash for the whole thing.',
    when: (s) => day(s) >= 2,
    choices: [
      {
        label: 'Salvage it (+45 parts)',
        path: 'green',
        apply: (s) => {
          gain(s, { parts: 45 });
          spawnJunk(s, 4, 10, 20);
          shiftAlignment(s, 5);
          return '+45 parts. The leftovers are scattered around for the bots.';
        },
      },
      {
        label: 'Sell it to 2PM (+220 cr)',
        path: 'industrial',
        apply: (s) => {
          gain(s, { credits: 220 });
          shiftAlignment(s, -5);
          return '+220 credits. A 2PM truck hauls it away before lunch.';
        },
      },
    ],
  },
  {
    id: 'park_petition',
    speaker: 'citizens',
    title: 'Petition #001',
    text: 'We sort junk all day. Could we get somewhere green to recharge? Even a small park would help.',
    when: (s) => has(s, 'pods') && s.pop >= 6,
    choices: [
      {
        label: 'Fund a park (40 cr)',
        path: 'green',
        available: (s) => s.res.credits >= 40,
        apply: (s) => {
          shiftAlignment(s, 8);
          s.happyMod += 8;
          if (!placeFreeGarden(s)) return 'There is no free spot near the pods, so the council keeps the money. They are happy you said yes.';
          pay(s, { credits: 40 });
          return 'A Pixel Garden sprouts next to the pods.';
        },
      },
      {
        label: 'Maybe next quarter',
        path: 'neutral',
        apply: (s) => {
          s.happyMod -= 8;
          shiftAlignment(s, -3);
          return 'The council files the petition under "later". Nobody is happy.';
        },
      },
    ],
  },
  {
    id: 'overtime',
    speaker: 'corp',
    title: 'Overtime Mode',
    text: 'Our shareholders love your output. Switch on Overtime Mode and every machine in town runs at 150% for a full day.',
    when: (s) => has(s, 'smelter') || has(s, 'factory'),
    choices: [
      {
        label: 'Run Overtime',
        path: 'industrial',
        apply: (s) => {
          s.overtimeUntil = s.time + 60;
          shiftAlignment(s, -10);
          return 'Production x1.5 for one day. So is the smoke.';
        },
      },
      {
        label: 'Bots need rest',
        path: 'green',
        apply: (s) => {
          shiftAlignment(s, 5);
          s.happyMod += 4;
          return 'USA-9 gives you a thumbs up. Do robots have thumbs?';
        },
      },
    ],
  },
  {
    id: 'smog_protest',
    speaker: 'citizens',
    title: 'The air tastes like circuits',
    text: 'The smog is getting into our joints. We want air filters, and we want them now!',
    repeatable: true,
    when: (s) => s.pollution >= 55,
    choices: [
      {
        label: 'Install filters (150 cr)',
        path: 'green',
        available: (s) => s.res.credits >= 150,
        apply: (s) => {
          pay(s, { credits: 150 });
          s.pollution = Math.max(0, s.pollution - 15);
          shiftAlignment(s, 5);
          return 'Pollution -15%. The protest turns into a block party.';
        },
      },
      {
        label: 'Ignore them',
        path: 'industrial',
        apply: (s) => {
          s.pop *= 0.8;
          s.happyMod -= 10;
          shiftAlignment(s, -5);
          return 'One citizen in five packs up and leaves town.';
        },
      },
    ],
  },
  {
    id: 'eco_grant',
    speaker: 'ppi',
    title: 'Clean city grant',
    text: 'Your air quality qualifies for a Pixel Planet Initiative grant. Please spend it on the city. We will check.',
    when: (s) => s.pollution <= 30 && day(s) >= 3,
    choices: [
      {
        label: 'Accept the grant',
        path: 'green',
        apply: (s) => {
          gain(s, { credits: 220, parts: 20 });
          shiftAlignment(s, 8);
          return '+220 credits, +20 parts. The Initiative adds you to its newsletter.';
        },
      },
      {
        label: 'Put it in 2PM stock',
        path: 'industrial',
        apply: (s) => {
          gain(s, { credits: 400 });
          shiftAlignment(s, -15);
          return '+400 credits. The Initiative will not call again.';
        },
      },
    ],
  },
  {
    id: 'stray_cats',
    speaker: 'miso',
    title: 'Mrrp!',
    text: 'Miso is back, and she brought friends. Five very small, very loud friends.',
    when: (s) => day(s) >= 3,
    choices: [
      {
        label: 'Adopt them (30 cr)',
        path: 'green',
        available: (s) => s.res.credits >= 30,
        apply: (s) => {
          pay(s, { credits: 30 });
          s.happyMod += 10;
          shiftAlignment(s, 3);
          return 'The pods now have cats. Happiness is up.';
        },
      },
      {
        label: 'Not now, Miso',
        path: 'neutral',
        apply: (s) => {
          s.happyMod -= 3;
          return 'Miso stares at you for a very long time.';
        },
      },
    ],
  },
  {
    id: 'thrusters',
    speaker: 'usa',
    title: 'Blueprints in the junk',
    text: 'I found thruster blueprints in a crushed vending machine! With 30 parts and 80 credits every bot flies 30% faster.',
    when: (s) => s.bots.length >= 7,
    choices: [
      {
        label: 'Upgrade the thrusters',
        path: 'neutral',
        available: (s) => s.res.parts >= 30 && s.res.credits >= 80,
        apply: (s) => {
          pay(s, { parts: 30, credits: 80 });
          s.botSpeedMul *= 1.3;
          return 'Zoom. Bots are 30% faster.';
        },
      },
      {
        label: 'Keep the blueprints for later',
        path: 'neutral',
        apply: () => 'USA-9 tucks the blueprints behind one ear.',
      },
    ],
  },
  {
    id: 'scrap_market',
    speaker: 'corp',
    title: 'Scrap price spike',
    text: 'Scrap prices are spiking on the 2PM exchange. We will buy 100 scrap for 260 credits. Today only.',
    repeatable: true,
    when: (s) => s.res.scrap >= 100,
    choices: [
      {
        label: 'Sell 100 scrap',
        path: 'industrial',
        available: (s) => s.res.scrap >= 100,
        apply: (s) => {
          pay(s, { scrap: 100 });
          gain(s, { credits: 260 });
          shiftAlignment(s, -3);
          return '+260 credits.';
        },
      },
      {
        label: 'Keep it to recycle',
        path: 'green',
        apply: (s) => {
          shiftAlignment(s, 3);
          return 'Good junk, good future.';
        },
      },
    ],
  },
  {
    id: 'citizen_trash_day',
    speaker: 'citizens',
    title: 'Spring cleaning',
    text: 'Every pod cleaned out its closets at once. There is junk on every corner. Good news for the bots?',
    repeatable: true,
    when: (s) => s.pop >= 15,
    choices: [
      {
        label: 'Send the bots',
        path: 'neutral',
        apply: (s) => {
          for (let i = 0; i < 6; i++) addWaste(s, 10);
          return 'Six fresh piles of junk near the pods.';
        },
      },
    ],
  },
];

export function pickEvent(s: GameState): StoryEvent | null {
  const pool = EVENTS.filter((e) => (e.repeatable || !s.eventsSeen.includes(e.id)) && e.when(s));
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
  text: string;
  hint: string;
  done: (s: GameState) => boolean;
  reward?: { credits?: number; parts?: number };
}

export const OBJECTIVES: Objective[] = [
  {
    text: 'Let your bots collect 25 scrap',
    hint: 'Scrap bots fly to junk piles on their own.',
    done: (s) => s.stats.scrapCollected >= 25,
    reward: { credits: 40 },
  },
  {
    text: 'Build a Recycler',
    hint: 'It turns scrap into parts, and parts build everything.',
    done: (s) => has(s, 'recycler'),
    reward: { parts: 15 },
  },
  {
    text: 'Build Bot Pods',
    hint: 'Citizens pay taxes, and they also make junk.',
    done: (s) => has(s, 'pods'),
    reward: { credits: 40 },
  },
  {
    text: 'Add power: Solar Array or Scrap Burner',
    hint: 'Solar is clean but pricey. The Burner is cheap and smoky.',
    done: (s) => has(s, 'solar') || has(s, 'burner'),
    reward: { parts: 20 },
  },
  {
    text: 'Reach 10 citizens',
    hint: 'Citizens move in when they are happy. Keep the smog down.',
    done: (s) => s.pop >= 10,
    reward: { credits: 60 },
  },
  {
    text: 'Build a money maker',
    hint: 'Fix-It Lab (green), or a Smelter or 2PM Factory (industrial).',
    done: (s) => has(s, 'fixlab') || has(s, 'smelter') || has(s, 'factory'),
    reward: { credits: 80 },
  },
  {
    text: 'Reach 30 citizens',
    hint: 'The Scrap Spire needs a real city behind it.',
    done: (s) => s.pop >= 30,
    reward: { credits: 120 },
  },
  {
    text: 'Start the Scrap Spire',
    hint: `${BUILDINGS.spire.cost.credits} credits and ${BUILDINGS.spire.cost.parts} parts.`,
    done: (s) => s.buildings.some((b) => b.type === 'spire'),
  },
  {
    text: 'Finish the Scrap Spire',
    hint: 'What the city becomes depends on your choices so far.',
    done: (s) => s.spireDone,
  },
];

export interface Ending {
  title: string;
  subtitle: string;
  text: string;
}

export const ENDINGS: Record<OutcomeKind, Ending> = {
  green: {
    title: 'The Garden City',
    subtitle: 'Green Path ending',
    text: 'Moss climbs the Scrap Spire and solar petals open at dawn. The landfills are parks now, and the bots spend their weekends planting trees. 2PM moved its headquarters somewhere less "difficult". Nobody misses it.',
  },
  industrial: {
    title: 'The 2PM Megacity',
    subtitle: 'Industrial Path ending',
    text: 'The Spire glows orange over a skyline of chimneys. Credits pour in, the blimps never land, and Kurogane named a tower after you. The sky is a little brown, but the quarterly numbers have never looked better.',
  },
  balanced: {
    title: 'Different Futures, Same City',
    subtitle: 'Balanced ending',
    text: 'Half garden, half foundry. The Spire hums with recycled power and 2PM money in equal parts. {city} did not pick a side. It picked itself.',
  },
  smog: {
    title: 'Smog Over',
    subtitle: 'The city choked',
    text: 'The smog sat on {city} for too long. Citizens packed up their pods, the bots powered down, and Miso went looking for a cleaner roof. Trash today... maybe a better tomorrow, next time.',
  },
};

export function endingText(kind: OutcomeKind, cityName: string): string {
  return ENDINGS[kind].text.replace('{city}', cityName);
}

export function endingFor(s: GameState): OutcomeKind {
  if (s.alignment >= 35) return 'green';
  if (s.alignment <= -35) return 'industrial';
  return 'balanced';
}
