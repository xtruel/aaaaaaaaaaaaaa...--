// Readable economy (docs/MODULAR-INC2.md §2 and §4b): what a building really does right now and why it is in the
// state it is in, for the building panel. Nothing here has numbers of its own: the nominal values come from
// buildingStats (full power, with the module), the effective ones from the factors the sim applies in the same step
// (the city's power share, overtime, pause, fuel) through the sim's own helpers (energyEffect, airEffect, buildRate).
// tests/modules.test.ts runs the sim and checks every value here against what it then does. No DOM.
import { partsReserve } from './actions';
import { BUILDINGS, T } from './defs';
import type { Cost, Resource } from './defs';
import { buildingStats } from './piecedefs';
import type { BuildingStats } from './piecedefs';
import { CLEAN_EVERY, airEffect, buildRate, energyEffect, overtimeFactor } from './sim';
import type { Building, BuildingStatus, GameState } from './state';

// The values the sim applies to a building right now. Same fields as BuildingStats, effective instead of nominal:
// - energy: what it adds to the city's power (+) or takes from it (-) now (0 when paused, unbuilt, or a Burner out
//   of fuel), as computeDerived counts it;
// - pollution: smog per second it adds (+) or takes away (-) now, as updatePollution counts it (industry only while
//   working, slowed by the power share, x1.5 on overtime; a Purifier slowed by the power share);
// - storage, housing: what it gives the city (0 until finished; they do not depend on power);
// - cycle: seconds a cycle takes at this speed (nominal cycle / speed; Infinity when stopped; 0 without a process);
// - input, output, cleanRadius: per cycle and in tiles, as nominal (power changes the pace, not the amounts).
export interface EffectiveStats extends BuildingStats {
  efficiency: number; // the city's power share now (power made / power used, at most 1)
  power: number; // the share of its demand this building gets: the city's efficiency for a consumer, 1 for a plant
  overtime: number; // 1.5 while the overtime event runs, else 1 (production and industry smog, not cleaning)
  overtimeLeft: number; // seconds of overtime left (0 = none)
  running: boolean; // finished, not paused (a Burner: has fuel); a process may still wait for inputs (see statusInfo)
  speed: number; // how fast its process runs: power x overtime (0 when stopped); 1 = the nominal cycle
  cleanEvery: number; // seconds between two cleaned sludge tiles now (Infinity when stopped; 0 = does not clean)
  inputPerSecond: Cost; // what the process takes per second at this speed while it has its inputs
  outputPerSecond: Cost; // what it makes per second at this speed while it has its inputs
}

function perSecond(cost: Readonly<Cost>, cycle: number): Cost {
  const out: Cost = {};
  for (const r of Object.keys(cost) as Resource[]) out[r] = cycle > 0 && Number.isFinite(cycle) ? (cost[r] ?? 0) / cycle : 0;
  return out;
}

export function effectiveStats(s: GameState, b: Building): EffectiveStats {
  const st = buildingStats(b);
  const built = b.built >= 1;
  const efficiency = s.derived.efficiency;
  const overtime = overtimeFactor(s);
  const consumer = st.energy < 0;
  const power = consumer ? efficiency : 1;
  const fuelled = !BUILDINGS[b.type].fuel || b.fuel > 0;
  const running = built && !b.paused && fuelled;
  // tickBuilding: a process gets dt x efficiency x overtime of work, sludge cleaning dt x efficiency
  const speed = running && st.cycle > 0 ? efficiency * overtime : 0;
  const cleanSpeed = built && !b.paused && st.cleanRadius > 0 ? efficiency : 0;
  const cycle = st.cycle > 0 ? (speed > 0 ? st.cycle / speed : Infinity) : 0;
  return {
    energy: energyEffect(b),
    pollution: airEffect(s, b, overtime),
    storage: built ? st.storage : 0,
    housing: built ? st.housing : 0,
    cycle,
    input: st.input,
    output: st.output,
    cleanRadius: st.cleanRadius,
    efficiency,
    power,
    overtime,
    overtimeLeft: Math.max(0, s.overtimeUntil - s.time),
    running,
    speed,
    cleanEvery: st.cleanRadius > 0 ? (cleanSpeed > 0 ? CLEAN_EVERY / cleanSpeed : Infinity) : 0,
    inputPerSecond: perSecond(st.input, cycle),
    outputPerSecond: perSecond(st.output, cycle),
  };
}

// ---------- why a building is in its state ----------

// The cause of a building's state, in distinct words for the panel:
// - building: under construction (the Spire goes up slower without power: buildRate);
// - paused: switched off by the player;
// - noPower: stopped, the city has no power to give it;
// - lowPower: working, but slowed down by a power shortage (only buildings whose work needs power: a process, or a
//   Purifier's cleaning);
// - noInput: waiting for materials (needs says which, for one cycle);
// - reserve: a Factory or Fix-It Lab leaving the last parts for building (reserve says how many);
// - noFuel: a Burner with no scrap to burn (needs: one load);
// - ok: working normally.
export type StatusCause = 'building' | 'paused' | 'noPower' | 'lowPower' | 'noInput' | 'reserve' | 'noFuel' | 'ok';

export interface StatusInfo {
  cause: StatusCause;
  status: BuildingStatus; // b.status, as the sim set it in the last step
  needs?: Cost; // noInput: what one cycle takes that the city is short of; noFuel: one load of fuel
  reserve?: number; // reserve: parts the Factories and Fix-It Labs keep for building
  power: number; // the share of its demand the building gets (1 = full power)
  buildLeft?: number; // building: seconds left at the current pace
}

// Which part of `cost` the city cannot pay now; all of it when nothing is short any more (the last step found it
// short, and the resources moved since: the panel still names what the building waits for).
function shortOf(s: GameState, cost: Readonly<Cost>): Cost {
  const out: Cost = {};
  for (const r of Object.keys(cost) as Resource[]) if (s.res[r] < (cost[r] ?? 0)) out[r] = cost[r];
  return Object.keys(out).length ? out : { ...cost };
}

export function statusInfo(s: GameState, b: Building): StatusInfo {
  const st = buildingStats(b);
  const power = st.energy < 0 ? s.derived.efficiency : 1;
  const base = { status: b.status, power };
  if (b.built < 1) {
    const rate = buildRate(s, b);
    const left = ((1 - b.built) * Math.max(0.1, BUILDINGS[b.type].buildTime)) / rate;
    return { ...base, cause: 'building', power: b.type === 'spire' ? s.derived.efficiency : power, buildLeft: left };
  }
  if (b.paused) return { ...base, cause: 'paused' };
  switch (b.status) {
    case 'noPower':
      return { ...base, cause: 'noPower' };
    case 'noInput':
      return { ...base, cause: 'noInput', needs: shortOf(s, st.input) };
    case 'reserve':
      return { ...base, cause: 'reserve', reserve: partsReserve(s) };
    case 'noFuel': {
      const fuel = BUILDINGS[b.type].fuel;
      return { ...base, cause: 'noFuel', needs: { scrap: fuel ? fuel.scrap : 0 } };
    }
    default: {
      // the power share slows a process and a Purifier's cleaning; homes, storage and bots do not slow down
      const slowed = power < 1 && (st.cycle > 0 || st.cleanRadius > 0);
      return { ...base, cause: slowed ? 'lowPower' : 'ok' };
    }
  }
}

// ---------- scrap waiting for room ----------

// Scrap the bots brought back that did not fit in storage (s.scrapPending): it goes in, and counts as collected, as
// soon as there is room. The HUD shows it as "+N waiting" next to the scrap counter. Whole units.
export function scrapWaiting(s: GameState): number {
  return Number.isFinite(s.scrapPending) && s.scrapPending > 0 ? Math.floor(s.scrapPending + 1e-9) : 0;
}

// Whole citizens who move out when the city's homes drop by `drop` (taking a capsule off, demolishing Bot Pods): the
// ones above the homes that are left go at the next step (updateCitizens), as the confirmation should say.
export function citizensLost(s: GameState, drop: number): number {
  if (!(drop > 0)) return 0;
  const left = Math.max(0, s.derived.housing - drop);
  return Math.max(0, Math.floor(s.pop) - Math.floor(Math.min(s.pop, left)));
}

// ---------- what the advice needs to know ----------

// Power to spare right now, as the HUD shows it (power made / power used): made minus used.
export function energySpare(s: GameState): number {
  return s.derived.energyProd - s.derived.energyUse;
}

// What the buildings under construction will do to the power to spare once finished: minus what the consumers will
// use, plus what the power plants will make: a Solar Array always, a Burner when there is scrap to burn (as the sim
// counts a finished one: only while it has fuel).
export function energyGoingUp(s: GameState): number {
  let going = 0;
  let fuel: boolean | null = null; // scrap for the Burners being built (looked up once, only if there is one)
  for (const b of s.buildings) {
    if (b.built >= 1 || b.paused) continue;
    const e = buildingStats(b).energy;
    const burns = BUILDINGS[b.type].fuel;
    if (e < 0 || !burns) going += e;
    else if ((fuel ??= scrapToCome(s, burns.scrap))) going += e;
  }
  return going;
}

// Power to spare for a new consumer: the power to spare now (the HUD's) and what the buildings going up will do to it.
export function energyHeadroom(s: GameState): number {
  return energySpare(s) + energyGoingUp(s);
}

// `need` scrap in storage (or waiting for room), or junk on the map that the bots can fetch (they fly anywhere, from
// the HQ or a Dock).
function scrapToCome(s: GameState, need: number): boolean {
  if (s.res.scrap + Math.max(0, s.scrapPending || 0) >= need) return true;
  if (s.bots.length === 0 && s.derived.botTarget <= 0) return false;
  for (let i = 0; i < s.tiles.length; i++) if (s.tiles[i] === T.JUNK && s.amount[i] > 0) return true;
  return false;
}

// Scrap a new Recycler could work on: one cycle's worth in storage (or waiting for room), or junk on the map.
export function scrapAvailable(s: GameState): boolean {
  return scrapToCome(s, buildingStats({ type: 'recycler' }).input.scrap ?? 0);
}
