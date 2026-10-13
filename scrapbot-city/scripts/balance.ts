// Headless balance check: an autopilot plays a Green and an Industrial city and prints how each run goes.
// Run with: npm run balance
import { CITIES } from '../src/game/cities';
import type { CityDef } from '../src/game/cities';
import { BUILDINGS, DAY_LENGTH, SIM_STEP } from '../src/game/defs';
import type { BuildingType } from '../src/game/defs';
import { step } from '../src/game/sim';
import { createGame, day } from '../src/game/state';
import { answerEvent, count, think } from './autopilot';
import type { Plan } from './autopilot';

function run(plan: Plan, seed: number, city?: CityDef): void {
  const s = city ? createGame({ seed: city.seed, cityName: city.name, cityId: city.id, mods: city.mods }) : createGame({ seed });
  const log: string[] = [];
  const milestones = new Map<string, number>();
  const mark = (k: string, cond: boolean) => {
    if (cond && !milestones.has(k)) milestones.set(k, day(s));
  };
  const maxDays = 45;
  let t = 0;
  while (!s.outcome && day(s) <= maxDays) {
    step(s, SIM_STEP);
    t += SIM_STEP;
    answerEvent(s, plan);
    if (t >= 1) {
      t = 0;
      think(s, plan);
    }
    mark('pop10', s.pop >= 10);
    mark('pop30', s.pop >= 30);
    mark('spire', s.buildings.some((b) => b.type === 'spire'));
    s.fx.length = 0;
    s.messages.length = 0;
    s.dirtyTiles.length = 0;
    if (Math.round(s.time / SIM_STEP) % Math.round((DAY_LENGTH * 4) / SIM_STEP) === 0) {
      log.push(
        `  day ${String(day(s)).padStart(2)}  pop ${s.pop.toFixed(0).padStart(3)}  smog ${s.pollution.toFixed(0).padStart(3)}%  happy ${s.derived.happiness.toFixed(0).padStart(3)}  cr ${s.res.credits.toFixed(0).padStart(5)}  parts ${s.res.parts.toFixed(0).padStart(4)}  scrap ${s.res.scrap.toFixed(0).padStart(4)}  bots ${s.bots.length}  align ${s.alignment.toFixed(0)}`,
      );
    }
  }
  const junkLeft = Array.from(s.amount).reduce((a, b) => a + b, 0);
  const stars = city ? ` stars ${s.stars.map((x) => (x ? '★' : '☆')).join('')}` : '';
  console.log(`\n[${plan}] ${city ? city.name : `seed ${seed}`} -> ${s.outcome ? `${s.outcome.kind} on day ${s.outcome.day}` : `no ending after ${maxDays} days`}${stars}`);
  console.log(log.join('\n'));
  console.log(`  milestones: ${[...milestones].map(([k, v]) => `${k}@d${v}`).join(', ')}`);
  console.log(`  buildings: ${Object.keys(BUILDINGS).map((k) => `${k}:${count(s, k as BuildingType)}`).filter((x) => !x.endsWith(':0')).join(' ')}`);
  console.log(`  junk left on map: ${junkLeft}, events seen: ${s.eventsSeen.join(', ')}`);
}

for (const seed of [1234, 777]) {
  run('green', seed);
  run('industrial', seed);
}
for (const city of CITIES) {
  run('green', city.seed, city);
  run('industrial', city.seed, city);
}
