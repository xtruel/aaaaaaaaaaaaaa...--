// Readable smog (0.7, increment 2, G0): the breakdown the sim keeps of where the smog comes from and where it goes
// (derived.air), which must add up to exactly the rate the sim applies, and the words and numbers of the smog panel
// built from it (src/ui/smog.ts).
import { describe, expect, it } from 'vitest';
import { placeBuilding, placeCheck } from '../src/game/actions';
import { BUILDINGS, BUILD_ORDER, DAY_LENGTH, SIM_STEP, T } from '../src/game/defs';
import type { BuildingType } from '../src/game/defs';
import { installModule } from '../src/game/pieces';
import { airEffect, computeDerived, step } from '../src/game/sim';
// cities where every project is discovered: these tests are about the items' own rules
import { createGame } from './all-projects';
import type { Building, GameState } from '../src/game/state';
import { airReport, perDayText } from '../src/ui/smog';

function build(s: GameState, type: BuildingType): Building {
  const hq = s.buildings[0];
  for (let r = 3; r < 30; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !placeCheck(s, type, hq.x + dx, hq.y + dy).ok) continue;
        const b = placeBuilding(s, type, hq.x + dx, hq.y + dy)!;
        b.built = 1;
        return b;
      }
  throw new Error(`no room for ${type}`);
}

// A city with every kind of source and cleaner: two Smelters (one with the filter), a Burner, a Factory, a Purifier,
// two Gardens, power and scrap to keep them going, and the sludge pools of the map.
function industrialCity(): GameState {
  const s = createGame({ seed: 71, cityName: 'Smog' });
  s.res.credits = 1e5;
  s.res.parts = 1e4;
  s.nextEventAt = 1e9;
  s.nextStormAt = 1e9;
  for (const type of ['dock', 'dock', 'solar', 'solar', 'solar', 'smelter', 'smelter', 'burner', 'factory', 'purifier', 'garden', 'garden'] as BuildingType[]) build(s, type);
  computeDerived(s);
  installModule(s, 'smelterFilter', s.buildings.find((b) => b.type === 'smelter')!);
  s.pollution = 40;
  return s;
}

function run(s: GameState, seconds: number, each?: () => void): void {
  for (let k = 0; k < seconds / SIM_STEP; k++) {
    s.res.scrap = Math.max(s.res.scrap, 50);
    s.res.parts = Math.max(s.res.parts, 500);
    step(s, SIM_STEP);
    each?.();
  }
}

function partsSum(s: GameState): number {
  const air = s.derived.air;
  return BUILD_ORDER.reduce((n, type) => n + air.byType[type], 0) + air.byType.hq + air.sludge + air.renewal;
}

describe('where the smog comes from and where it goes', () => {
  it('the parts add up to the rate the sim applies, step after step', () => {
    const s = industrialCity();
    let steps = 0;
    run(s, 2 * DAY_LENGTH, () => {
      steps++;
      expect(Math.abs(partsSum(s) - s.derived.pollutionRate), `step ${steps}`).toBeLessThan(1e-12);
    });
    expect(steps).toBe(2 * DAY_LENGTH * 20);
    // there was something on both sides
    expect(s.derived.air.byType.factory).toBeGreaterThan(0);
    expect(s.derived.air.byType.purifier).toBeLessThan(0);
    expect(s.derived.air.byType.garden).toBeLessThan(0);
  });

  it('each part is what its buildings put out right now (airEffect), and counts the ones that do', () => {
    const s = industrialCity();
    run(s, 10);
    const air = s.derived.air;
    for (const type of BUILD_ORDER) {
      const mine = s.buildings.filter((b) => b.type === type);
      expect(air.byType[type], type).toBeCloseTo(mine.reduce((n, b) => n + airEffect(s, b), 0), 12);
      expect(air.count[type], type).toBe(mine.filter((b) => airEffect(s, b) !== 0).length);
    }
    // the filter: the same Smelter work, 0.4 of the smog
    const [filtered, plain] = s.buildings.filter((b) => b.type === 'smelter');
    expect(filtered.modules).toEqual(['smelterFilter']);
    expect(plain.status).toBe('ok');
    expect(airEffect(s, filtered)).toBeCloseTo(airEffect(s, plain) * 0.4, 12);
    // sludge: 0.002 a second per tile; the air renews itself faster the dirtier it is
    expect(air.sludgeTiles).toBe([...s.tiles].filter((t) => t === T.SLUDGE).length);
    expect(air.sludgeTiles).toBeGreaterThan(0);
    expect(air.sludge).toBeCloseTo(air.sludgeTiles * 0.002, 12);
    expect(air.renewal).toBeLessThan(0);
  });

  it('a paused or unfinished building puts nothing in the air and is not counted', () => {
    const s = industrialCity();
    const factory = s.buildings.find((b) => b.type === 'factory')!;
    factory.paused = true;
    const purifier = s.buildings.find((b) => b.type === 'purifier')!;
    purifier.paused = true;
    const burner = s.buildings.find((b) => b.type === 'burner')!;
    burner.built = 0.1; // 2 s more of its 4 s of building
    run(s, 2);
    expect(s.derived.air.byType.factory).toBe(0);
    expect(s.derived.air.count.factory).toBe(0);
    expect(s.derived.air.byType.purifier).toBe(0);
    expect(s.derived.air.byType.burner).toBe(0);
    expect(Math.abs(partsSum(s) - s.derived.pollutionRate)).toBeLessThan(1e-12);
  });

  it('on overtime and short of power the parts still add up, each as the sim applies it', () => {
    const s = industrialCity();
    s.overtimeUntil = s.time + 30;
    // the Solar Arrays and the Burner rebuilding (4 s): the HQ alone powers half the city meanwhile
    for (const b of s.buildings) if (b.type === 'solar' || b.type === 'burner') b.built = 0;
    run(s, 1);
    expect(s.time).toBeLessThan(s.overtimeUntil);
    expect(s.derived.efficiency).toBeGreaterThan(0);
    expect(s.derived.efficiency).toBeLessThan(1);
    expect(Math.abs(partsSum(s) - s.derived.pollutionRate)).toBeLessThan(1e-12);
    // industry: ×1.5 on overtime, slowed down by the power it gets; a Purifier slowed down too, not sped up
    expect(s.derived.air.byType.factory).toBeCloseTo(0.06 * 1.5 * s.derived.efficiency, 12);
    expect(s.derived.air.byType.purifier).toBeCloseTo(-0.08 * s.derived.efficiency, 12);
    expect(airReport(s).notes).toHaveLength(2);
  });

  it('with the increment-2 modules (the double arm\'s extra smog, the nozzle) the parts still add up exactly', () => {
    const s = industrialCity();
    const factory = s.buildings.find((b) => b.type === 'factory')!;
    const purifier = s.buildings.find((b) => b.type === 'purifier')!;
    expect(installModule(s, 'factoryArm', factory)).toBe(true);
    expect(installModule(s, 'purifierNozzle', purifier)).toBe(true);
    for (const b of s.buildings.filter((o) => o.type === 'solar')) expect(installModule(s, 'solarTracker', b)).toBe(true);
    let steps = 0;
    run(s, DAY_LENGTH / 2, () => {
      steps++;
      expect(Math.abs(partsSum(s) - s.derived.pollutionRate), `step ${steps}`).toBeLessThan(1e-12);
    });
    // the arm's Factory puts 0.09 a second into the air at full power (0.06 without it); the nozzle cleans the air
    // as before (it widens the sludge radius only)
    expect(factory.status).toBe('ok');
    expect(s.derived.efficiency).toBe(1);
    expect(s.derived.air.byType.factory).toBeCloseTo(0.09, 12);
    expect(s.derived.air.byType.factory).toBe(airEffect(s, factory));
    expect(s.derived.air.byType.purifier).toBeCloseTo(-0.08, 12);
  });

  it('with the double arm (more smog) and the filter (less), on overtime and short of power, every step adds up', () => {
    const s = industrialCity();
    const factory = s.buildings.find((b) => b.type === 'factory')!;
    const [filtered, plain] = s.buildings.filter((b) => b.type === 'smelter');
    expect(filtered.modules).toEqual(['smelterFilter']);
    expect(installModule(s, 'factoryArm', factory)).toBe(true);
    expect(installModule(s, 'purifierNozzle', s.buildings.find((b) => b.type === 'purifier')!)).toBe(true);
    for (const b of s.buildings.filter((o) => o.type === 'solar')) expect(installModule(s, 'solarTracker', b)).toBe(true);
    s.overtimeUntil = s.time + 30;
    // the Solar Arrays and the Burner rebuilding (4 s): the HQ alone powers part of the city meanwhile
    for (const b of s.buildings) if (b.type === 'solar' || b.type === 'burner') b.built = 0;
    let steps = 0;
    let short = 0;
    let overtime = 0;
    let checked = 0;
    run(s, 60, () => {
      steps++;
      expect(Math.abs(partsSum(s) - s.derived.pollutionRate), `step ${steps}`).toBeLessThan(1e-12);
      if (s.derived.efficiency < 1 && s.time < s.overtimeUntil) {
        short++;
        // each part as the sim applies it: the module's stat × overtime × the power the building gets
        const eff = s.derived.efficiency;
        if (factory.status === 'ok' && filtered.status === 'ok' && plain.status === 'ok') {
          checked++;
          expect(s.derived.air.byType.factory).toBeCloseTo(0.09 * 1.5 * eff, 12);
          expect(airEffect(s, filtered)).toBeCloseTo(airEffect(s, plain) * 0.4, 12);
          expect(s.derived.air.byType.smelter).toBeCloseTo(airEffect(s, plain) * 1.4, 12);
          expect(airEffect(s, plain)).toBeCloseTo(BUILDINGS.smelter.pollution * 1.5 * eff, 12);
        }
      }
      if (s.time < s.overtimeUntil) overtime++;
    });
    expect(short).toBeGreaterThan(0);
    expect(checked).toBe(short);
    expect(overtime).toBeGreaterThan(short);
    // after the overtime, with the power back: the arm's 0.09 a second
    expect(s.time).toBeGreaterThan(s.overtimeUntil);
    expect(s.derived.efficiency).toBe(1);
    expect(factory.status).toBe('ok');
    expect(s.derived.air.byType.factory).toBeCloseTo(0.09, 12);
  });

  it('clean air: nothing to renew at 0%', () => {
    const s = createGame({ seed: 71 });
    s.pollution = 0;
    s.tiles.fill(T.GROUND);
    step(s, SIM_STEP);
    expect(s.derived.air.renewal).toBe(0);
    expect(s.derived.air.sludge).toBe(0);
    expect(s.derived.pollutionRate).toBe(0);
  });
});

describe('the smog panel', () => {
  it('lists the sources and the cleaning biggest first, per day, with the sim total', () => {
    const s = industrialCity();
    run(s, 10);
    const r = airReport(s);
    expect(r.sources.every((row) => row.perDay > 0)).toBe(true);
    expect(r.cleaning.every((row) => row.perDay < 0)).toBe(true);
    for (const list of [r.sources, r.cleaning]) {
      const sizes = list.map((row) => Math.abs(row.perDay));
      expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
    }
    expect(r.sources.map((row) => row.kind).sort()).toEqual(['burner', 'factory', 'sludge', 'smelter']);
    expect(r.cleaning.map((row) => row.kind).sort()).toEqual(['garden', 'purifier', 'renewal']);
    expect(r.sources.find((row) => row.kind === 'smelter')!.label).toBe('Smelter ×2');
    expect(r.cleaning.find((row) => row.kind === 'garden')!.label).toBe('Pixel Garden ×2');
    expect(r.cleaning.find((row) => row.kind === 'renewal')!.label).toBe('Natural air renewal');
    expect(r.sources.find((row) => row.kind === 'sludge')!.label).toBe(`Toxic sludge (${s.derived.air.sludgeTiles} tiles)`);
    // per day = per second × 60; the rows add up to the total
    expect(r.net).toBe(s.derived.pollutionRate * DAY_LENGTH);
    expect(r.sources.find((row) => row.kind === 'factory')!.perDay).toBeCloseTo(s.derived.air.byType.factory * 60, 12);
    const sum = [...r.sources, ...r.cleaning].reduce((n, row) => n + row.perDay, 0);
    expect(sum).toBeCloseTo(r.net, 9);
    expect(r.limit).toBe('Above 95% for 30 seconds the city is lost.');
    expect(r.danger).toBe(false);
    expect(r.notes).toEqual([]);
  });

  it('says why the numbers are what they are: overtime, a power shortage, the countdown', () => {
    const s = industrialCity();
    run(s, 2);
    s.overtimeUntil = s.time + 42.5;
    s.derived.efficiency = 0.8;
    s.smog = 7.2;
    const r = airReport(s);
    expect(r.notes).toEqual(['Overtime: industry smog ×1.5 for 43s more.', 'Power at 80%: industry and Purifiers work slower.']);
    expect(r.danger).toBe(true);
    expect(r.limit).toBe('Above 95%: the city is lost in 23s!');
  });

  it('writes a day of smog as the building panel does', () => {
    expect(perDayText(2.1)).toBe('+2.1');
    expect(perDayText(0.035 * 60)).toBe('+2.1');
    expect(perDayText(-0.6)).toBe('-0.6');
    expect(perDayText(-0.04)).toBe('0.0');
    expect(perDayText(0)).toBe('0.0');
  });
});
