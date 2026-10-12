// Increment 2, group G1 (docs/MODULAR-INC2.md §2 and §4b): the six new modules. Each one's effect measured in the
// sim equals the declared numbers, at full power (nominal) and with the power share and overtime (effective, as
// effectiveStats says); one slot per building (the Recycler's magnet and sorter exclude each other); refunds shown
// equal refunds paid; demolishing with a module; together with thrusters, overtime, a power shortage, pause and
// save/load nothing counts twice; random install / remove / demolish / save-load sequences create nothing.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { demolish, placeBuilding, placeCheck } from '../src/game/actions';
import { BOT_SPEED, BUILDINGS, MAP_H, MAP_W, SIM_STEP, T } from '../src/game/defs';
import type { BuildingType, Cost, Resource } from '../src/game/defs';
import { citizensLost, effectiveStats, scrapWaiting, statusInfo } from '../src/game/economy';
import {
  CATALOG_ORDER,
  MODULES,
  buildingStats,
  buildingStatsWith,
  demolishRefund,
  installModule,
  installedModules,
  moduleCheck,
  moduleNeeds,
  moduleRefund,
  removeModule,
} from '../src/game/pieces';
import type { ModuleKind } from '../src/game/pieces';
import { airEffect, computeDerived, step } from '../src/game/sim';
import { idx, serialize } from '../src/game/state';
// cities where every project is discovered: these tests are about the items' own rules
import { createGame, deserialize } from './all-projects';
import type { Building, GameState } from '../src/game/state';
import { OBJECTIVES } from '../src/game/story';
import { mulberry32 } from '../src/game/world';
import { t, tk } from '../src/i18n';

afterEach(() => vi.restoreAllMocks());

const NEW: ModuleKind[] = ['recyclerMagnet', 'recyclerSorter', 'factoryArm', 'podsCapsule', 'solarTracker', 'purifierNozzle'];
const ALL = Object.keys(MODULES) as ModuleKind[];

// A quiet, rich city: no events or storms, no goal rewards, no junk or sludge on the map (so nothing but the
// buildings under test moves scrap, parts or smog).
function lab(seed = 91): GameState {
  const s = createGame({ seed, cityName: 'Modules' });
  s.nextEventAt = 1e12;
  s.nextStormAt = 1e12;
  s.objective = OBJECTIVES.length;
  s.res.credits = 1e5;
  s.res.parts = 1e4;
  s.res.scrap = 0;
  for (let i = 0; i < s.tiles.length; i++) {
    if (s.tiles[i] === T.JUNK || s.tiles[i] === T.SLUDGE || s.tiles[i] === T.RUBBLE) {
      s.tiles[i] = T.GROUND;
      s.amount[i] = 0;
    }
  }
  computeDerived(s);
  return s;
}

function build(s: GameState, type: BuildingType, done = true): Building {
  const hq = s.buildings.find((b) => b.type === 'hq')!;
  for (let r = 2; r < 30; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = hq.x + dx;
        const y = hq.y + dy;
        if (!placeCheck(s, type, x, y).ok) continue;
        const b = placeBuilding(s, type, x, y)!;
        if (done) {
          b.built = 1;
          b.status = 'ok';
        }
        computeDerived(s);
        return b;
      }
  throw new Error(`no room for ${type}`);
}

const resOf = (s: GameState) => ({ ...s.res });
const add = (a: Cost, b: Cost): Cost => {
  const out: Cost = { ...a };
  for (const r of Object.keys(b) as Resource[]) out[r] = (out[r] ?? 0) + (b[r] ?? 0);
  return out;
};

// Steps the city for `seconds`, calling `each` before every step; returns how many cycles b finished.
function cycles(s: GameState, b: Building, seconds: number, each: () => void = () => {}): number {
  let n = 0;
  for (let k = 0; k < Math.round(seconds / SIM_STEP); k++) {
    each();
    step(s, SIM_STEP);
    if (b.lastWork === s.time) n++;
  }
  return n;
}

describe('the six modules: the owner-approved table', () => {
  it('catalog order, building, price and refund (half, rounded down)', () => {
    // right after the Smelter filter (increment 2's decorations sit between the lamp and the Dock storage)
    expect(CATALOG_ORDER.slice(CATALOG_ORDER.indexOf('smelterFilter') + 1)).toEqual(NEW);
    const table: Record<string, [BuildingType, Cost, Cost]> = {
      recyclerMagnet: ['recycler', { credits: 40, parts: 15 }, { credits: 20, parts: 7 }],
      recyclerSorter: ['recycler', { credits: 40, parts: 15 }, { credits: 20, parts: 7 }],
      factoryArm: ['factory', { credits: 90, parts: 30 }, { credits: 45, parts: 15 }],
      podsCapsule: ['pods', { credits: 35, parts: 15 }, { credits: 17, parts: 7 }],
      solarTracker: ['solar', { credits: 60, parts: 40 }, { credits: 30, parts: 20 }],
      purifierNozzle: ['purifier', { credits: 50, parts: 30 }, { credits: 25, parts: 15 }],
    };
    for (const kind of NEW) {
      const [building, cost, refund] = table[kind];
      expect(MODULES[kind]).toMatchObject({ kind, building, cost, limit: 1 });
      expect(moduleRefund(kind), kind).toEqual(refund);
      expect(moduleNeeds(kind)).not.toMatch(/^place\./);
    }
  });

  it('declared numbers before -> after, from buildingStatsWith (the only source the sim uses)', () => {
    const before = (type: BuildingType) => buildingStatsWith({ type }, []);
    const after = (type: BuildingType, kind: ModuleKind) => buildingStatsWith({ type }, [kind]);
    // Recycler (3 scrap -> 2 parts every 2 s, energy -2)
    expect(before('recycler')).toMatchObject({ cycle: 2, input: { scrap: 3 }, output: { parts: 2 }, energy: -2 });
    expect(after('recycler', 'recyclerMagnet')).toMatchObject({ cycle: 1.5, input: { scrap: 3 }, output: { parts: 2 }, energy: -4 });
    expect(after('recycler', 'recyclerSorter')).toMatchObject({ cycle: 3, input: { scrap: 3 }, output: { parts: 3 }, energy: -2 });
    // 2PM Factory (2 parts -> 30 credits every 3 s, energy -4, smog 0.06 /s)
    expect(before('factory')).toMatchObject({ cycle: 3, input: { parts: 2 }, output: { credits: 30 }, energy: -4, pollution: 0.06 });
    const arm = after('factory', 'factoryArm');
    expect(arm).toMatchObject({ cycle: 2, input: { parts: 2 }, output: { credits: 30 }, energy: -6 });
    expect(arm.pollution).toBeCloseTo(0.09, 12);
    // Bot Pods: homes 6 -> 9, energy -1 -> -2
    expect(before('pods')).toMatchObject({ housing: 6, energy: -1 });
    expect(after('pods', 'podsCapsule')).toMatchObject({ housing: 9, energy: -2 });
    // Solar Array: energy +5 -> +7
    expect(before('solar').energy).toBe(5);
    expect(after('solar', 'solarTracker').energy).toBe(7);
    // Purifier: radius 5 -> 8, energy -3 -> -4, same air cleaning
    expect(before('purifier')).toMatchObject({ cleanRadius: 5, energy: -3, pollution: -0.08 });
    expect(after('purifier', 'purifierNozzle')).toMatchObject({ cleanRadius: 8, energy: -4, pollution: -0.08 });
    // per second: magnet +33% parts and scrap; sorter same parts per second, +50% parts per scrap; arm +50% credits
    const perSec = (st: ReturnType<typeof before>, r: Resource, io: 'input' | 'output') => (st[io][r] ?? 0) / st.cycle;
    expect(perSec(after('recycler', 'recyclerMagnet'), 'parts', 'output') / perSec(before('recycler'), 'parts', 'output')).toBeCloseTo(4 / 3, 12);
    expect(perSec(after('recycler', 'recyclerMagnet'), 'scrap', 'input') / perSec(before('recycler'), 'scrap', 'input')).toBeCloseTo(4 / 3, 12);
    expect(perSec(after('recycler', 'recyclerSorter'), 'parts', 'output')).toBeCloseTo(perSec(before('recycler'), 'parts', 'output'), 12);
    expect(3 / 3 / (2 / 3)).toBeCloseTo(1.5, 12); // parts per scrap: sorter 3/3 against 2/3
    expect(perSec(arm, 'credits', 'output') / perSec(before('factory'), 'credits', 'output')).toBeCloseTo(1.5, 12);
    expect(perSec(arm, 'parts', 'input') / perSec(before('factory'), 'parts', 'input')).toBeCloseTo(1.5, 12);
    // a module never touches the numbers of any other building type, and changes nothing it does not declare
    for (const kind of NEW) {
      for (const type of Object.keys(BUILDINGS) as BuildingType[]) {
        if (type !== MODULES[kind].building) expect(buildingStatsWith({ type }, [kind])).toBe(before(type));
      }
    }
    expect(after('pods', 'podsCapsule')).toMatchObject({ storage: 0, cycle: 0, cleanRadius: 0, pollution: 0 });
    expect(after('solar', 'solarTracker')).toMatchObject({ housing: 0, storage: 0, cycle: 0, pollution: 0 });
  });
});

describe('one slot per building', () => {
  it('the magnet and the sorter share the Recycler slot: the second is refused with the first one named', () => {
    const s = lab();
    const r = build(s, 'recycler');
    expect(installModule(s, 'recyclerMagnet', r)).toBe(true);
    const res = resOf(s);
    const check = moduleCheck(s, 'recyclerSorter', r);
    expect(check).toMatchObject({ ok: false, reason: t('place.modSlot', { name: tk('mod.recyclerMagnet') }) });
    expect(check.costOnly).toBeUndefined();
    expect(check.reason).toBe('Slot taken by Magnetic separator: remove it first');
    expect(installModule(s, 'recyclerSorter', r)).toBe(false);
    expect(moduleCheck(s, 'recyclerMagnet', r)).toMatchObject({ ok: false, reason: t('place.modInstalled') });
    expect(resOf(s)).toEqual(res);
    expect(r.modules).toEqual(['recyclerMagnet']);
    // take the magnet off: the sorter goes on
    expect(removeModule(s, 'recyclerMagnet', r)).toEqual({ credits: 20, parts: 7 });
    expect(installModule(s, 'recyclerSorter', r)).toBe(true);
    expect(r.modules).toEqual(['recyclerSorter']);
    expect(buildingStats(r).output).toEqual({ parts: 3 });
  });

  it('each module only on a finished building of its type; the reason names the building', () => {
    const s = lab();
    const types: BuildingType[] = ['recycler', 'factory', 'pods', 'solar', 'purifier', 'dock', 'smelter'];
    const all = Object.fromEntries(types.map((type) => [type, build(s, type)])) as Record<BuildingType, Building>;
    const unfinished = build(s, 'recycler', false);
    for (const kind of NEW) {
      const home = MODULES[kind].building;
      for (const type of types) {
        const check = moduleCheck(s, kind, all[type]);
        if (type === home) expect(check.ok, `${kind} on ${type}`).toBe(true);
        else expect(check, `${kind} on ${type}`).toEqual({ ok: false, reason: moduleNeeds(kind) });
      }
    }
    expect(moduleCheck(s, 'recyclerMagnet', unfinished)).toEqual({ ok: false, reason: 'Only on a finished Recycler' });
    expect(moduleNeeds('factoryArm')).toBe('Only on a finished 2PM Factory');
    expect(moduleNeeds('podsCapsule')).toBe('Only on finished Bot Pods');
    expect(moduleNeeds('solarTracker')).toBe('Only on a finished Solar Array');
    expect(moduleNeeds('purifierNozzle')).toBe('Only on a finished Purifier');
    // too poor: costOnly, nothing taken
    s.res.credits = 10;
    expect(moduleCheck(s, 'factoryArm', all.factory)).toMatchObject({ ok: false, costOnly: true });
    expect(installModule(s, 'factoryArm', all.factory)).toBe(false);
    expect(s.res.credits).toBe(10);
  });

  it('a damaged save cannot stack two modules in one slot: the first that fits stays, the rest go', () => {
    const s = lab();
    const r = build(s, 'recycler');
    const p = build(s, 'pods');
    const data = JSON.parse(serialize(s));
    data.buildings.find((b: Building) => b.id === r.id).modules = ['recyclerSorter', 'recyclerMagnet', 'recyclerSorter', 'podsCapsule'];
    data.buildings.find((b: Building) => b.id === p.id).modules = ['solarTracker', 'podsCapsule', 'podsCapsule'];
    const back = deserialize(JSON.stringify(data));
    expect(back.buildings.find((b) => b.id === r.id)!.modules).toEqual(['recyclerSorter']);
    expect(back.buildings.find((b) => b.id === p.id)!.modules).toEqual(['podsCapsule']);
    // and a list pushed by hand counts one module only, everywhere the sim looks
    r.modules = ['recyclerMagnet', 'recyclerSorter'];
    expect(installedModules(r)).toEqual(['recyclerMagnet']);
    expect(buildingStats(r)).toBe(buildingStatsWith({ type: 'recycler' }, ['recyclerMagnet']));
    expect(demolishRefund(s, r)).toEqual(add({ credits: 25 }, moduleRefund('recyclerMagnet')));
  });
});

describe('measured in the sim = declared (nominal, at full power)', () => {
  it('Recycler: the magnet makes 2 parts every 1.5 s from 3 scrap; the sorter 3 parts every 3 s; plain 2 every 2 s', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const runFor = (kind: ModuleKind | null) => {
      const s = lab();
      const r = build(s, 'recycler');
      if (kind) expect(installModule(s, kind, r)).toBe(true);
      computeDerived(s);
      expect(s.derived.efficiency).toBe(1);
      const parts0 = s.res.parts;
      s.res.scrap = 100;
      let used = 0;
      const n = cycles(s, r, 60, () => {
        used += 100 - s.res.scrap;
        s.res.scrap = 100;
      });
      used += 100 - s.res.scrap;
      return { n, parts: s.res.parts - parts0, scrap: used, use: s.derived.energyUse, st: effectiveStats(s, r) };
    };
    const plain = runFor(null);
    const magnet = runFor('recyclerMagnet');
    const sorter = runFor('recyclerSorter');
    expect(Math.abs(plain.n - 30)).toBeLessThanOrEqual(1);
    expect(Math.abs(magnet.n - 40)).toBeLessThanOrEqual(1);
    expect(Math.abs(sorter.n - 20)).toBeLessThanOrEqual(1);
    expect(plain.parts).toBe(plain.n * 2);
    expect(magnet.parts).toBe(magnet.n * 2);
    expect(sorter.parts).toBe(sorter.n * 3);
    expect(plain.scrap).toBe(plain.n * 3);
    expect(magnet.scrap).toBe(magnet.n * 3);
    expect(sorter.scrap).toBe(sorter.n * 3);
    // energy -2 -> -4 with the magnet, unchanged with the sorter
    expect(magnet.use - plain.use).toBe(2);
    expect(sorter.use).toBe(plain.use);
    // effective = nominal at full power, and the per-second numbers match what was measured
    expect(magnet.st.cycle).toBe(1.5);
    expect(sorter.st.cycle).toBe(3);
    // (within one cycle's output: the last cycle of the minute may still be running)
    expect(Math.abs(magnet.st.outputPerSecond.parts! * 60 - magnet.parts)).toBeLessThanOrEqual(2);
    expect(Math.abs(sorter.st.outputPerSecond.parts! * 60 - sorter.parts)).toBeLessThanOrEqual(3);
  });

  it('2PM Factory: the double arm turns 2 parts into 30 credits every 2 s instead of 3, at 6 energy', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const runFor = (arm: boolean) => {
      const s = lab();
      const f = build(s, 'factory');
      if (arm) expect(installModule(s, 'factoryArm', f)).toBe(true);
      computeDerived(s);
      expect(s.derived.efficiency).toBe(1); // the HQ makes 6, the armed Factory uses 6
      const parts0 = s.res.parts;
      const earned0 = s.stats.creditsEarned;
      const n = cycles(s, f, 60);
      // every credit earned is the Factory's or the HQ's grant (no citizens, no goal rewards)
      const made = s.stats.creditsEarned - earned0 - 0.25 * 60;
      return { n, parts: parts0 - s.res.parts, made, use: s.derived.energyUse };
    };
    const plain = runFor(false);
    const arm = runFor(true);
    expect(Math.abs(plain.n - 20)).toBeLessThanOrEqual(1);
    expect(Math.abs(arm.n - 30)).toBeLessThanOrEqual(1);
    expect(plain.parts).toBe(plain.n * 2);
    expect(arm.parts).toBe(arm.n * 2);
    expect(plain.made).toBeCloseTo(plain.n * 30, 6);
    expect(arm.made).toBeCloseTo(arm.n * 30, 6);
    expect(arm.use - plain.use).toBe(2);
  });

  it('2PM Factory smog 0.06 -> 0.09 /s while it works; the sim adds exactly what effectiveStats says', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    for (const arm of [false, true]) {
      const s = lab();
      const f = build(s, 'factory');
      if (arm) installModule(s, 'factoryArm', f);
      s.pollution = 0; // no natural renewal in this step, no sludge on the map: the rate is the Factory's alone
      step(s, SIM_STEP);
      expect(f.status).toBe('ok');
      expect(s.derived.pollutionRate).toBeCloseTo(arm ? 0.09 : 0.06, 12);
      expect(effectiveStats(s, f).pollution).toBe(s.derived.pollutionRate);
      expect(airEffect(s, f)).toBe(s.derived.pollutionRate);
    }
  });

  it('Bot Pods: the capsule houses 9 instead of 6 (and the citizens come), at 2 energy', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const s = lab();
    s.pollution = 0;
    const plain = build(s, 'pods');
    const caps = build(s, 'pods');
    build(s, 'garden');
    installModule(s, 'podsCapsule', caps);
    // immediate: the city's homes and power follow at once
    expect(s.derived.housing).toBe(6 + 9);
    expect(s.derived.energyUse).toBe(1 + 2);
    expect(effectiveStats(s, caps).housing).toBe(9);
    expect(effectiveStats(s, plain).housing).toBe(6);
    for (let k = 0; k < 20 * 300; k++) step(s, SIM_STEP);
    expect(s.pop).toBeCloseTo(15, 6);
    // taking the capsule off: 3 homes go, and the 3 citizens with them at the next step, as citizensLost says before
    const drop = buildingStats(caps).housing - buildingStatsWith(caps, []).housing;
    expect(drop).toBe(3);
    const shown = citizensLost(s, drop);
    expect(shown).toBe(3);
    const pop = Math.floor(s.pop);
    removeModule(s, 'podsCapsule', caps);
    expect(s.derived.housing).toBe(12);
    step(s, SIM_STEP);
    expect(s.pop).toBeLessThanOrEqual(12);
    expect(pop - Math.floor(s.pop)).toBe(shown);
    expect(citizensLost(s, 0)).toBe(0);
  });

  it('Solar Array: the tracking panels make 7 instead of 5', () => {
    const s = lab();
    const a = build(s, 'solar');
    const b = build(s, 'solar');
    installModule(s, 'solarTracker', b);
    step(s, SIM_STEP);
    expect(s.derived.energyProd).toBe(6 + 5 + 7);
    expect(effectiveStats(s, a).energy).toBe(5);
    expect(effectiveStats(s, b).energy).toBe(7);
  });

  it('Purifier: the nozzle reaches sludge 8 tiles away instead of 5, still one tile every 6 s, same air cleaning', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const setup = (nozzle: boolean) => {
      const s = lab();
      const p = build(s, 'purifier');
      if (nozzle) installModule(s, 'purifierNozzle', p);
      // three pools on one line from the Purifier's centre (b.x + 1, b.y + 1): 4.5, 7.5 and 8.5 tiles away
      const cx = p.x + 1;
      const cy = p.y + 1;
      const dir = cx + 9 < MAP_W ? 1 : -1;
      const pools = [4, 7, 8].map((d) => idx(dir > 0 ? cx + d : cx - d - 1, cy));
      for (const i of pools) {
        expect(s.occ[i]).toBe(-1);
        s.tiles[i] = T.SLUDGE;
      }
      computeDerived(s);
      return { s, p, pools };
    };
    for (const nozzle of [false, true]) {
      const { s, p, pools } = setup(nozzle);
      const cleanedAt: number[] = [];
      for (let k = 0; k < 20 * 30; k++) {
        const before = s.stats.cleaned;
        step(s, SIM_STEP);
        if (s.stats.cleaned > before) cleanedAt.push(s.time);
      }
      const left = pools.filter((i) => s.tiles[i] === T.SLUDGE).length;
      if (nozzle) {
        expect(left).toBe(1); // 4.5 and 7.5 cleaned, 8.5 out of reach
        expect(s.tiles[pools[1]]).toBe(T.GROUND);
        expect(s.tiles[pools[2]]).toBe(T.SLUDGE);
      } else {
        expect(left).toBe(2); // only the 4.5 one
        expect(s.tiles[pools[1]]).toBe(T.SLUDGE);
      }
      // one tile every 6 s at full power: the pace is the same with or without the nozzle
      expect(Math.abs(cleanedAt[0] - 6)).toBeLessThanOrEqual(2 * SIM_STEP);
      if (nozzle) expect(Math.abs(cleanedAt[1] - cleanedAt[0] - 6)).toBeLessThanOrEqual(2 * SIM_STEP);
      const eff = effectiveStats(s, p);
      expect(eff.cleanRadius).toBe(nozzle ? 8 : 5);
      expect(eff.cleanEvery).toBe(6);
      expect(eff.energy).toBe(nozzle ? -4 : -3);
      // the air cleaning (-0.08 /s at full power) is the same
      expect(airEffect(s, p)).toBeCloseTo(-0.08, 12);
    }
  });
});

// A city where every consumer gets only part of its power (HQ +6 against more use).
function shortOfPower(): { s: GameState; r: Building; f: Building; p: Building; d: Building } {
  const s = lab();
  const r = build(s, 'recycler');
  const f = build(s, 'factory');
  const p = build(s, 'purifier');
  const d = build(s, 'dock');
  installModule(s, 'recyclerMagnet', r);
  installModule(s, 'factoryArm', f);
  installModule(s, 'purifierNozzle', p);
  computeDerived(s);
  return { s, r, f, p, d };
}

describe('effective values (power share, overtime, pause) = what the sim does', () => {
  it('a power shortage slows the magnet Recycler, the armed Factory and the nozzle Purifier by the same share', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const { s, r, f, p, d } = shortOfPower();
    const eff = s.derived.efficiency;
    expect(eff).toBeCloseTo(6 / (4 + 6 + 4 + 1), 12);
    const er = effectiveStats(s, r);
    const ef = effectiveStats(s, f);
    expect(er.cycle).toBeCloseTo(1.5 / eff, 12);
    expect(ef.cycle).toBeCloseTo(2 / eff, 12);
    expect(er.power).toBe(eff);
    expect(effectiveStats(s, p).cleanEvery).toBeCloseTo(6 / eff, 12);
    // measured over 2 minutes
    let fCycles = 0;
    const rCycles = cycles(s, r, 120, () => {
      s.res.scrap = 100;
      if (f.lastWork === s.time) fCycles++;
    });
    expect(Math.abs(rCycles - 120 / er.cycle)).toBeLessThanOrEqual(1);
    expect(Math.abs(fCycles - 120 / ef.cycle)).toBeLessThanOrEqual(1.5);
    expect(statusInfo(s, r).cause).toBe('lowPower');
    expect(statusInfo(s, f).cause).toBe('lowPower');
    expect(statusInfo(s, p).cause).toBe('lowPower');
    // a Dock does not slow down without power (its storage and bots do not depend on it): not "low power"
    expect(statusInfo(s, d)).toMatchObject({ cause: 'ok', power: eff });
    expect(effectiveStats(s, d).storage).toBe(80);
  });

  it('overtime: production x1.5 for 60 s on top of the module, then back; smog x1.5 too, cleaning not', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const s = lab();
    const r = build(s, 'recycler');
    const f = build(s, 'factory');
    installModule(s, 'recyclerMagnet', r);
    installModule(s, 'factoryArm', f);
    build(s, 'solar'); // HQ 6 + 5 against 10: full power
    computeDerived(s);
    expect(s.derived.efficiency).toBe(1);
    s.overtimeUntil = s.time + 60;
    const during = effectiveStats(s, r);
    expect(during.overtime).toBe(1.5);
    expect(during.overtimeLeft).toBeCloseTo(60, 9);
    expect(during.cycle).toBeCloseTo(1, 12); // 1.5 s / 1.5
    expect(effectiveStats(s, f).cycle).toBeCloseTo(2 / 1.5, 12);
    const refill = () => {
      s.res.scrap = 100;
    };
    let first = cycles(s, r, 60, refill);
    // (60 s of 0.05 s steps add up to a hair under 60: finish the overtime)
    while (s.time < s.overtimeUntil) first += cycles(s, r, SIM_STEP, refill);
    const after = effectiveStats(s, r);
    expect(after.overtime).toBe(1);
    expect(after.cycle).toBe(1.5);
    const second = cycles(s, r, 60, refill);
    expect(Math.abs(first - 60)).toBeLessThanOrEqual(1);
    expect(Math.abs(second - 40)).toBeLessThanOrEqual(1);
    // smog of the armed Factory on overtime: 0.09 x 1.5
    const t = lab();
    const g = build(t, 'factory');
    installModule(t, 'factoryArm', g);
    build(t, 'solar');
    t.overtimeUntil = t.time + 60;
    t.pollution = 0;
    step(t, SIM_STEP);
    expect(t.derived.pollutionRate).toBeCloseTo(0.09 * 1.5, 12);
    expect(effectiveStats(t, g).pollution).toBe(t.derived.pollutionRate);
  });

  it('pause: a paused building with a module uses no power, makes nothing and puts nothing in the air', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const s = lab();
    const r = build(s, 'recycler');
    const f = build(s, 'factory');
    installModule(s, 'recyclerMagnet', r);
    installModule(s, 'factoryArm', f);
    r.paused = true;
    f.paused = true;
    const parts0 = s.res.parts;
    const n = cycles(s, r, 10, () => {
      s.res.scrap = 100;
    });
    expect(n).toBe(0);
    expect(s.res.parts).toBe(parts0);
    expect(s.derived.energyUse).toBe(0);
    for (const b of [r, f]) {
      const e = effectiveStats(s, b);
      expect(e).toMatchObject({ energy: 0, pollution: 0, speed: 0, running: false, cycle: Infinity });
      expect(statusInfo(s, b).cause).toBe('paused');
    }
    // resumed: back to the module's pace at once
    r.paused = false;
    f.paused = false;
    step(s, SIM_STEP);
    expect(s.derived.energyUse).toBe(4 + 6);
  });

  it('every effective value adds up to the city totals the sim computed (energy, homes, storage, smog)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const rnd = mulberry32(5);
    for (let round = 0; round < 6; round++) {
      const s = lab(100 + round);
      const types: BuildingType[] = ['recycler', 'recycler', 'factory', 'pods', 'solar', 'purifier', 'dock', 'smelter', 'burner', 'fixlab', 'garden'];
      for (const type of types) {
        const b = build(s, type, rnd() < 0.85);
        if (b.built >= 1 && rnd() < 0.6) {
          const kinds = ALL.filter((k) => MODULES[k].building === type);
          if (kinds.length) installModule(s, kinds[Math.floor(rnd() * kinds.length)], b);
        }
        if (rnd() < 0.2) b.paused = true;
      }
      s.res.scrap = rnd() < 0.5 ? 100 : 1;
      s.res.parts = rnd() < 0.5 ? 1e4 : 21;
      if (rnd() < 0.5) s.overtimeUntil = s.time + 30;
      s.pollution = 0;
      step(s, SIM_STEP);
      const eff = s.buildings.map((b) => effectiveStats(s, b));
      const sum = (f: (e: (typeof eff)[number]) => number) => eff.reduce((a, e) => a + f(e), 0);
      expect(sum((e) => Math.max(0, e.energy))).toBe(s.derived.energyProd);
      expect(sum((e) => Math.max(0, -e.energy))).toBe(s.derived.energyUse);
      expect(sum((e) => e.housing)).toBe(s.derived.housing);
      expect(sum((e) => e.storage)).toBe(s.derived.storage);
      expect(sum((e) => e.pollution)).toBeCloseTo(s.derived.pollutionRate, 12);
    }
  });
});

describe('modules and the events: nothing counts twice', () => {
  it('thrusters (+30% bot speed) work the same with every module installed: no module touches the bots', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    for (const kind of ALL) expect(Object.keys(MODULES[kind]).some((k) => /bot|speed/i.test(k))).toBe(false);
    const run = (withModules: boolean) => {
      const s = lab();
      for (const type of ['recycler', 'factory', 'pods', 'solar', 'purifier', 'dock', 'smelter'] as BuildingType[]) {
        const b = build(s, type);
        const kind = ALL.find((k) => MODULES[k].building === type)!;
        if (withModules) installModule(s, kind, b);
      }
      s.botSpeedMul = 1.3;
      // one load of junk far away, so the bots fly a straight line to it
      const far = idx(MAP_W - 2, MAP_H - 2);
      s.tiles[far] = T.JUNK;
      s.amount[far] = 40;
      for (let k = 0; k < 20 * 4; k++) step(s, SIM_STEP);
      const bot = s.bots.find((b) => b.state === 'toJunk')!;
      const x0 = bot.x;
      const y0 = bot.y;
      step(s, SIM_STEP);
      return Math.hypot(bot.x - x0, bot.y - y0);
    };
    expect(run(false)).toBeCloseTo(BOT_SPEED * 1.3 * SIM_STEP, 9);
    expect(run(true)).toBeCloseTo(BOT_SPEED * 1.3 * SIM_STEP, 9);
  });

  it('save and load keep the modules and their effects exactly once', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const s = lab();
    const built: Building[] = [];
    for (const type of ['recycler', 'factory', 'pods', 'solar', 'purifier', 'dock', 'smelter'] as BuildingType[]) {
      const b = build(s, type);
      installModule(s, ALL.find((k) => MODULES[k].building === type)!, b);
      built.push(b);
    }
    const r2 = build(s, 'recycler');
    installModule(s, 'recyclerSorter', r2);
    for (let k = 0; k < 40; k++) step(s, SIM_STEP);
    let t = s;
    for (let n = 0; n < 3; n++) t = deserialize(serialize(t));
    computeDerived(t);
    computeDerived(s);
    for (const k of ['energyProd', 'energyUse', 'efficiency', 'housing', 'storage'] as const) expect(t.derived[k], k).toBe(s.derived[k]);
    for (const b of s.buildings) {
      const c = t.buildings.find((o) => o.id === b.id)!;
      expect(c.modules).toEqual(b.modules);
      expect(c.timer).toBe(b.timer);
      expect(buildingStats(c)).toBe(buildingStats(b));
      const { pollution: _a, ...eb } = effectiveStats(s, b);
      const { pollution: _b, ...ec } = effectiveStats(t, c);
      expect(ec).toEqual(eb);
    }
    expect(t.stats.modulesInstalled).toBe(s.stats.modulesInstalled);
  });

  it('switching modules mid-cycle keeps the cycle share: no parts made out of thin air', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const s = lab();
    const r = build(s, 'recycler');
    const parts0 = s.res.parts;
    let paid: Cost = {};
    let back: Cost = {};
    const seconds = 90;
    let k = 0;
    const n = cycles(s, r, seconds, () => {
      s.res.scrap = 100;
      // every few steps, swap the module (paying and refunding as the player would)
      if (++k % 7 === 0) {
        const on = installedModules(r)[0];
        if (on) back = add(back, removeModule(s, on, r)!);
        const next = (['recyclerMagnet', 'recyclerSorter', null] as const)[k % 3];
        if (next) {
          paid = add(paid, MODULES[next].cost);
          installModule(s, next, r);
        }
      }
      expect(r.timer).toBeLessThanOrEqual(buildingStats(r).cycle + 1e-9);
    });
    // the best module makes 2 parts every 1.5 s (4/3 per second): never more, whatever the swaps
    const made = s.res.parts - parts0 + (paid.parts ?? 0) - (back.parts ?? 0);
    expect(made).toBeLessThanOrEqual((seconds * 4) / 3 + 3);
    expect(n).toBeGreaterThan(30);
  });
});

describe('refunds shown = refunds paid; demolishing with a module', () => {
  it('removing each module gives back exactly moduleRefund, the building stays, and the effect goes at once', () => {
    const s = lab();
    for (const kind of NEW) {
      const b = build(s, MODULES[kind].building);
      const plain = { ...s.derived };
      const before = resOf(s);
      expect(installModule(s, kind, b)).toBe(true);
      for (const r of Object.keys(before) as Resource[]) expect(s.res[r]).toBe(before[r] - (MODULES[kind].cost[r] ?? 0));
      const shown = moduleRefund(kind);
      const mid = resOf(s);
      expect(removeModule(s, kind, b)).toEqual(shown);
      for (const r of Object.keys(mid) as Resource[]) expect(s.res[r]).toBe(mid[r] + (shown[r] ?? 0));
      expect(s.buildings).toContain(b);
      expect(b.modules).toBeUndefined();
      expect(removeModule(s, kind, b)).toBeNull(); // once
      for (const k of ['energyProd', 'energyUse', 'housing', 'storage'] as const) expect(s.derived[k], `${kind} ${k}`).toBe(plain[k]);
    }
  });

  it('demolishing a building with a module pays the building and the module back, as shown before; no orphan', () => {
    const s = lab();
    for (const kind of NEW) {
      const b = build(s, MODULES[kind].building);
      installModule(s, kind, b);
      const shown = demolishRefund(s, b);
      const half = (c: Cost): Cost => Object.fromEntries(Object.entries(c).map(([r, v]) => [r, Math.floor((v ?? 0) * 0.5)]));
      expect(shown).toEqual(add(half(BUILDINGS[b.type].cost), moduleRefund(kind)));
      const before = resOf(s);
      expect(demolish(s, b)).toBe(true);
      for (const r of Object.keys(before) as Resource[]) expect(s.res[r], `${kind} ${r}`).toBe(before[r] + (shown[r] ?? 0));
      expect(demolish(s, b)).toBe(false);
      expect(removeModule(s, kind, b)).toBeNull();
      expect(installModule(s, kind, b)).toBe(false);
      expect(s.res).toEqual({ ...before, ...Object.fromEntries((Object.keys(before) as Resource[]).map((r) => [r, before[r] + (shown[r] ?? 0)])) });
    }
    const saved = JSON.parse(serialize(s)) as { buildings: Building[] };
    expect(saved.buildings.filter((b) => b.modules)).toEqual([]);
  });
});

describe('random install / remove / demolish / save-load: no resource created', () => {
  // What the player has plus what demolishing everything (modules included) would give back: buying lowers it,
  // removing and demolishing keep it, saving and loading keep it. If it ever goes up, something paid out twice.
  function wealth(s: GameState): Record<Resource, number> {
    const w = resOf(s);
    for (const b of s.buildings) {
      if (b.type === 'hq') continue;
      const back = demolishRefund(s, b);
      for (const r of Object.keys(back) as Resource[]) w[r] += back[r] ?? 0;
    }
    return w;
  }
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    it(`seed ${seed}`, () => {
      const rng = mulberry32(seed * 104729);
      let s = lab(200 + seed);
      s.res.credits = 4000;
      s.res.parts = 1500;
      const start = wealth(s);
      let worth = start;
      const did = { installed: 0, removed: 0, refused: 0, demolished: 0, saves: 0 };
      const pick = <V>(list: V[]): V => list[Math.floor(rng() * list.length)];
      const types: BuildingType[] = ['recycler', 'factory', 'pods', 'solar', 'purifier', 'dock', 'smelter'];
      for (let n = 0; n < 500; n++) {
        const op = Math.floor(rng() * 8);
        const others = s.buildings.filter((b) => b.type !== 'hq');
        if (op === 0 && others.length < 9) {
          const b = build(s, pick(types), rng() < 0.8);
          void b;
        } else if (op <= 2 && others.length) {
          const b = pick(others);
          const kind = pick(ALL);
          const res = resOf(s);
          if (installModule(s, kind, b)) {
            did.installed++;
            for (const r of Object.keys(res) as Resource[]) expect(s.res[r]).toBe(res[r] - (MODULES[kind].cost[r] ?? 0));
          } else {
            did.refused++;
            expect(resOf(s)).toEqual(res);
          }
        } else if (op === 3 && others.length) {
          const fitted = others.filter((b) => b.modules?.length);
          const b = fitted.length && rng() < 0.8 ? pick(fitted) : pick(others);
          const kind = b.modules?.length && rng() < 0.9 ? b.modules[0] : pick(ALL);
          const res = resOf(s);
          const back = removeModule(s, kind, b);
          if (back) {
            did.removed++;
            expect(back).toEqual(moduleRefund(kind));
            for (const r of Object.keys(res) as Resource[]) expect(s.res[r]).toBe(res[r] + (back[r] ?? 0));
          } else expect(resOf(s)).toEqual(res);
        } else if (op === 4 && others.length) {
          const b = pick(others);
          const shown = demolishRefund(s, b);
          const res = resOf(s);
          if (demolish(s, b)) {
            did.demolished++;
            for (const r of ['credits', 'parts'] as Resource[]) expect(s.res[r]).toBe(res[r] + (shown[r] ?? 0));
          }
          // a stale reference pays nothing a second time
          expect(demolish(s, b)).toBe(false);
          expect(removeModule(s, pick(ALL), b)).toBeNull();
        } else if (op === 5) {
          s = deserialize(serialize(s));
          computeDerived(s);
          did.saves++;
        } else if (op === 6 && others.length) {
          const b = pick(others);
          if (b.built < 1) b.built = 1;
          b.paused = rng() < 0.3;
        }
        const now = wealth(s);
        for (const r of Object.keys(start) as Resource[]) {
          expect(now[r], `step ${n} op ${op} ${r}`).toBeLessThanOrEqual(worth[r] + 1e-9);
          expect(s.res[r]).toBeGreaterThanOrEqual(0);
        }
        for (const b of s.buildings) {
          if (!b.modules) continue;
          expect(b.modules.length).toBe(1);
          expect(MODULES[b.modules[0]].building).toBe(b.type);
          expect(b.built).toBeGreaterThanOrEqual(1);
        }
        worth = now;
      }
      for (const [k, v] of Object.entries(did)) expect(v, k).toBeGreaterThan(3);
      // take it all apart: never more than the city started with
      for (const b of s.buildings.filter((o) => o.type !== 'hq')) demolish(s, b);
      for (const r of Object.keys(start) as Resource[]) expect(s.res[r]).toBeLessThanOrEqual(start[r] + 1e-9);
    });
  }
});

describe('why a building is in its state (statusInfo)', () => {
  it('names each cause in distinct words: building, paused, no power, low power, materials (which), reserve, fuel, ok', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const s = lab();
    const site = build(s, 'pods', false);
    const r = build(s, 'recycler');
    const f = build(s, 'factory');
    const burner = build(s, 'burner');
    const dock = build(s, 'dock');
    s.res.scrap = 0; // the Recycler and the Burner have nothing to work with
    s.res.parts = 21; // the Factory would go under the reserve of 20
    step(s, SIM_STEP);
    expect(statusInfo(s, site)).toMatchObject({ cause: 'building', status: 'building' });
    expect(statusInfo(s, site).buildLeft).toBeCloseTo((1 - site.built) * BUILDINGS.pods.buildTime, 9);
    expect(statusInfo(s, r)).toMatchObject({ cause: 'noInput', needs: { scrap: 3 } });
    expect(statusInfo(s, f)).toMatchObject({ cause: 'reserve', reserve: 20 });
    expect(statusInfo(s, burner)).toMatchObject({ cause: 'noFuel', needs: { scrap: 1 } });
    // the sorter still takes 3 scrap a cycle
    installModule(s, 'recyclerSorter', r);
    s.res.scrap = 0;
    step(s, SIM_STEP);
    expect(statusInfo(s, r)).toMatchObject({ cause: 'noInput', needs: { scrap: 3 } });
    r.paused = true;
    step(s, SIM_STEP);
    expect(statusInfo(s, r).cause).toBe('paused');
    r.paused = false;
    s.res.scrap = 100;
    s.res.parts = 1e4;
    step(s, SIM_STEP);
    expect(statusInfo(s, dock).cause).toBe('ok');
    build(s, 'solar');
    step(s, SIM_STEP);
    expect(s.derived.efficiency).toBe(1);
    expect(statusInfo(s, r)).toMatchObject({ cause: 'ok', power: 1 });
    expect(statusInfo(s, f)).toMatchObject({ cause: 'ok' });
    // the sim's own noPower (no power at all) is its own cause
    r.status = 'noPower';
    expect(statusInfo(s, r).cause).toBe('noPower');
  });

  it('the Spire under construction goes slower without power, and says how long is left', () => {
    const s = lab();
    s.pop = 30;
    const spire = build(s, 'spire', false);
    computeDerived(s);
    const info = statusInfo(s, spire);
    expect(info.cause).toBe('building');
    const rate = Math.max(0.25, s.derived.efficiency);
    expect(info.buildLeft).toBeCloseTo(((1 - spire.built) * BUILDINGS.spire.buildTime) / rate, 9);
  });
});

describe('scrap waiting for room', () => {
  it('scrapWaiting shows the pending scrap in whole units, and 0 for a damaged value', () => {
    const s = lab();
    expect(scrapWaiting(s)).toBe(0);
    s.scrapPending = 17;
    expect(scrapWaiting(s)).toBe(17);
    s.scrapPending = 4.9999999999;
    expect(scrapWaiting(s)).toBe(5);
    s.scrapPending = Number.NaN;
    expect(scrapWaiting(s)).toBe(0);
    s.scrapPending = -3;
    expect(scrapWaiting(s)).toBe(0);
  });
});
