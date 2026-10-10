// Static game data: map constants, tiles, resources and building definitions.

export const TILE = 16;
export const MAP_W = 56;
export const MAP_H = 36;
export const DAY_LENGTH = 60; // sim seconds per in-game day
export const SIM_STEP = 1 / 20;

export const T = { GROUND: 0, JUNK: 1, SLUDGE: 2, RUBBLE: 3, GRASS: 4 } as const;
export type TileKind = (typeof T)[keyof typeof T];

export type Resource = 'scrap' | 'parts' | 'credits';
export type Cost = Partial<Record<Resource, number>>;
export type PathKind = 'green' | 'industrial' | 'neutral';

export type BuildingType =
  | 'hq'
  | 'dock'
  | 'recycler'
  | 'smelter'
  | 'solar'
  | 'burner'
  | 'pods'
  | 'garden'
  | 'factory'
  | 'fixlab'
  | 'purifier'
  | 'spire';

export interface Process {
  input: Cost;
  output: Cost;
  time: number; // seconds per cycle at full power
}

export interface BuildingDef {
  type: BuildingType;
  name: string;
  w: number;
  h: number;
  cost: Cost;
  path: PathKind;
  energy: number; // + produces, - consumes
  pollution: number; // per second at full power (negative = cleans the air)
  buildTime: number;
  desc: string;
  process?: Process;
  fuel?: { scrap: number; seconds: number }; // burns scrap to produce energy
  housing?: number;
  bots?: number;
  storage?: number;
  happiness?: number;
  cleanRadius?: number;
  minPop?: number;
  buildable: boolean;
}

export const BUILDINGS: Record<BuildingType, BuildingDef> = {
  hq: {
    type: 'hq',
    name: 'Scrap HQ',
    w: 3,
    h: 3,
    cost: {},
    path: 'neutral',
    energy: 6,
    pollution: 0,
    buildTime: 0,
    desc: 'Your base. Stores scrap, launches 3 scrap bots and runs a small generator.',
    bots: 3,
    storage: 150,
    buildable: false,
  },
  dock: {
    type: 'dock',
    name: 'Bot Dock',
    w: 2,
    h: 2,
    cost: { credits: 40, parts: 10 },
    path: 'neutral',
    energy: -1,
    pollution: 0,
    buildTime: 4,
    desc: '+2 scrap bots and +80 scrap storage. Bots drop their loot at the nearest dock.',
    bots: 2,
    storage: 80,
    buildable: true,
  },
  recycler: {
    type: 'recycler',
    name: 'Recycler',
    w: 2,
    h: 2,
    cost: { credits: 40, parts: 10 },
    path: 'neutral',
    energy: -2,
    pollution: 0,
    buildTime: 5,
    desc: 'Turns 3 scrap into 2 parts. Every city needs one: parts build everything.',
    process: { input: { scrap: 3 }, output: { parts: 2 }, time: 2 },
    buildable: true,
  },
  smelter: {
    type: 'smelter',
    name: 'Smelter',
    w: 2,
    h: 2,
    cost: { credits: 30 },
    path: 'industrial',
    energy: -2,
    pollution: 0.035,
    buildTime: 4,
    desc: 'Melts 3 scrap into ingots worth 7 credits. Cheap and fast, but it smokes.',
    process: { input: { scrap: 3 }, output: { credits: 7 }, time: 1.6 },
    buildable: true,
  },
  solar: {
    type: 'solar',
    name: 'Solar Array',
    w: 2,
    h: 2,
    cost: { credits: 60, parts: 20 },
    path: 'green',
    energy: 5,
    pollution: 0,
    buildTime: 5,
    desc: '+5 energy, zero emissions. Pricey to set up.',
    buildable: true,
  },
  burner: {
    type: 'burner',
    name: 'Scrap Burner',
    w: 2,
    h: 2,
    cost: { credits: 30, parts: 5 },
    path: 'industrial',
    energy: 9,
    pollution: 0.045,
    buildTime: 4,
    desc: '+9 energy while it has fuel. Burns 1 scrap every 3 seconds.',
    fuel: { scrap: 1, seconds: 3 },
    buildable: true,
  },
  pods: {
    type: 'pods',
    name: 'Bot Pods',
    w: 2,
    h: 2,
    cost: { credits: 50, parts: 20 },
    path: 'neutral',
    energy: -1,
    pollution: 0,
    buildTime: 5,
    desc: 'Homes for 6 robot citizens. Citizens pay taxes and throw away junk.',
    housing: 6,
    buildable: true,
  },
  garden: {
    type: 'garden',
    name: 'Pixel Garden',
    w: 1,
    h: 1,
    cost: { credits: 20, parts: 4 },
    path: 'green',
    energy: 0,
    pollution: -0.02,
    buildTime: 3,
    desc: 'A tiny park. Cleans a bit of air and makes citizens happier.',
    happiness: 4,
    buildable: true,
  },
  factory: {
    type: 'factory',
    name: '2PM Factory',
    w: 3,
    h: 2,
    cost: { credits: 120, parts: 30 },
    path: 'industrial',
    energy: -4,
    pollution: 0.06,
    buildTime: 7,
    desc: 'Assembles 2 parts into gadgets worth 30 credits. Big profit, big smog.',
    process: { input: { parts: 2 }, output: { credits: 30 }, time: 3 },
    buildable: true,
  },
  fixlab: {
    type: 'fixlab',
    name: 'Fix-It Lab',
    w: 2,
    h: 2,
    cost: { credits: 90, parts: 40 },
    path: 'green',
    energy: -2,
    pollution: 0,
    buildTime: 6,
    desc: 'Repairs 2 parts into refurbished bots worth 15 credits. Citizens love it.',
    process: { input: { parts: 2 }, output: { credits: 15 }, time: 3 },
    happiness: 3,
    buildable: true,
  },
  purifier: {
    type: 'purifier',
    name: 'Purifier',
    w: 2,
    h: 2,
    cost: { credits: 100, parts: 30 },
    path: 'green',
    energy: -3,
    pollution: -0.08,
    buildTime: 6,
    desc: 'Scrubs the air and slowly cleans toxic sludge within 5 tiles.',
    cleanRadius: 5,
    buildable: true,
  },
  spire: {
    type: 'spire',
    name: 'Scrap Spire',
    w: 3,
    h: 3,
    cost: { credits: 1200, parts: 350 },
    path: 'neutral',
    energy: -6,
    pollution: 0,
    buildTime: 90,
    desc: 'The monument that decides what Scrapbot City becomes. Needs 30 citizens.',
    minPop: 30,
    buildable: true,
  },
};

export const BUILD_ORDER: BuildingType[] = [
  'dock',
  'recycler',
  'pods',
  'solar',
  'garden',
  'fixlab',
  'purifier',
  'smelter',
  'burner',
  'factory',
  'spire',
];

export const RESOURCE_LABEL: Record<Resource, string> = {
  scrap: 'Scrap',
  parts: 'Parts',
  credits: 'Credits',
};

export const PATH_LABEL: Record<PathKind, string> = {
  green: 'Green',
  industrial: 'Industrial',
  neutral: 'Neutral',
};

export const ALIGN_BUILD_SHIFT = 4; // alignment change when placing a green/industrial building
export const SMOG_LIMIT_SECONDS = 30; // seconds above SMOG_DANGER before game over
export const SMOG_DANGER = 95;
// 2PM sells parts. Priced above what a Factory earns per part, so importing never prints money.
export const IMPORT_PARTS = { parts: 10, credits: 160 };
export const BULLDOZE_RUBBLE_COST = 15;
export const BOT_SPEED = 30; // px per second
export const BOT_CARRY = 5;
export const BOT_COLLECT_TIME = 1.2;
