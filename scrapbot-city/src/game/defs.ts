// Static game data: map constants, tiles, resources and building definitions.
// Names and descriptions live in the translation files (keys b.<type> and b.<type>.desc).

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

// Rules that make each city of the campaign play differently. Free play uses DEFAULT_MODS.
export interface CityMods {
  junk: number; // landfill amount on the map
  sludge: number; // toxic pools on the map
  grass: number; // surviving grass patches
  rubble: number; // rubble clusters
  stormEvery: number; // junk storm interval (lower = more storms)
  eventEvery: number; // story event interval
  decay: number; // how fast the air clears by itself
  industrialCost: number;
  greenCost: number;
  happiness: number; // flat bonus
  startRes: Record<Resource, number>;
  startPollution: number;
}

export const DEFAULT_MODS: CityMods = {
  junk: 1,
  sludge: 3,
  grass: 5,
  rubble: 22,
  stormEvery: 1,
  eventEvery: 1,
  decay: 1,
  industrialCost: 1,
  greenCost: 1,
  happiness: 0,
  startRes: { scrap: 0, parts: 40, credits: 150 },
  startPollution: 15,
};

export interface Process {
  input: Cost;
  output: Cost;
  time: number; // seconds per cycle at full power
}

export interface BuildingDef {
  type: BuildingType;
  w: number;
  h: number;
  cost: Cost;
  path: PathKind;
  energy: number; // + produces, - consumes
  pollution: number; // per second at full power (negative = cleans the air)
  buildTime: number;
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
    w: 3,
    h: 3,
    cost: {},
    path: 'neutral',
    energy: 6,
    pollution: 0,
    buildTime: 0,
    bots: 3,
    storage: 150,
    buildable: false,
  },
  dock: {
    type: 'dock',
    w: 2,
    h: 2,
    cost: { credits: 40, parts: 10 },
    path: 'neutral',
    energy: -1,
    pollution: 0,
    buildTime: 4,
    bots: 2,
    storage: 80,
    buildable: true,
  },
  recycler: {
    type: 'recycler',
    w: 2,
    h: 2,
    // credits only: the one building that makes parts must never be out of reach for lack of parts
    cost: { credits: 50 },
    path: 'neutral',
    energy: -2,
    pollution: 0,
    buildTime: 5,
    process: { input: { scrap: 3 }, output: { parts: 2 }, time: 2 },
    buildable: true,
  },
  smelter: {
    type: 'smelter',
    w: 2,
    h: 2,
    cost: { credits: 30 },
    path: 'industrial',
    energy: -2,
    pollution: 0.035,
    buildTime: 4,
    process: { input: { scrap: 3 }, output: { credits: 9 }, time: 1.6 },
    buildable: true,
  },
  solar: {
    type: 'solar',
    w: 2,
    h: 2,
    cost: { credits: 40, parts: 35 },
    path: 'green',
    energy: 5,
    pollution: 0,
    buildTime: 5,
    buildable: true,
  },
  burner: {
    type: 'burner',
    w: 2,
    h: 2,
    cost: { credits: 30, parts: 5 },
    path: 'industrial',
    energy: 9,
    pollution: 0.045,
    buildTime: 4,
    fuel: { scrap: 1, seconds: 3 },
    buildable: true,
  },
  pods: {
    type: 'pods',
    w: 2,
    h: 2,
    cost: { credits: 50, parts: 20 },
    path: 'neutral',
    energy: -1,
    pollution: 0,
    buildTime: 5,
    housing: 6,
    buildable: true,
  },
  garden: {
    type: 'garden',
    w: 1,
    h: 1,
    cost: { credits: 20, parts: 4 },
    path: 'green',
    energy: 0,
    pollution: -0.02,
    buildTime: 3,
    happiness: 4,
    buildable: true,
  },
  factory: {
    type: 'factory',
    w: 3,
    h: 2,
    cost: { credits: 120, parts: 30 },
    path: 'industrial',
    energy: -4,
    pollution: 0.06,
    buildTime: 7,
    process: { input: { parts: 2 }, output: { credits: 30 }, time: 3 },
    buildable: true,
  },
  fixlab: {
    type: 'fixlab',
    w: 2,
    h: 2,
    cost: { credits: 50, parts: 70 },
    path: 'green',
    energy: -2,
    pollution: 0,
    buildTime: 6,
    process: { input: { parts: 2 }, output: { credits: 15 }, time: 3 },
    happiness: 3,
    buildable: true,
  },
  purifier: {
    type: 'purifier',
    w: 2,
    h: 2,
    cost: { credits: 70, parts: 50 },
    path: 'green',
    energy: -3,
    pollution: -0.08,
    buildTime: 6,
    cleanRadius: 5,
    buildable: true,
  },
  spire: {
    type: 'spire',
    w: 3,
    h: 3,
    cost: { credits: 1200, parts: 350 },
    path: 'neutral',
    energy: -6,
    pollution: 0,
    buildTime: 90,
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

export const ALIGN_BUILD_SHIFT = 4; // alignment change when placing a green/industrial building
export const SMOG_LIMIT_SECONDS = 30; // seconds above SMOG_DANGER before game over
export const SMOG_DANGER = 95;
// 2PM sells parts. Priced above what a Factory earns per part, so importing never prints money.
export const IMPORT_PARTS = { parts: 10, credits: 160 };
// Factories and Fix-It Labs never use the last parts: there is always enough left to build with.
export const PARTS_RESERVE = 20;
export const BULLDOZE_RUBBLE_COST = 15;
export const BOT_SPEED = 30; // px per second
export const BOT_CARRY = 5;
export const BOT_COLLECT_TIME = 1.2;
