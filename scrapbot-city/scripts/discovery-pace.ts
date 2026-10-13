// When each project is discovered (docs/MODULAR-INC2.md §4, §6.3): the balance autopilot plays the five campaign
// cities and two free play maps, green and industrial, from a new profile, and the time each goal is first reached is
// written in game minutes (at speed 1 a game minute is a minute: a day lasts 60 s). After the Spire the city goes on as
// with the ending's "Keep building" (marked *), up to 45 minutes. The autopilot never pets the cat
// nor places catalog objects, so Miso's house (3 pets) and the corner pillar (20 objects) are the player's own doing:
// "—" here. Also the first-minutes check: how many of the decorative projects the brief names (bench, planter,
// concrete base, tree; Miso's house when the player pets the cat) are usable — discovered and affordable — by 5 and by
// 10 minutes. Math.random is seeded, so every run prints the same. Nothing here changes the game.
// Run with: npm run pace
import { buildCost, canAfford, placeBuilding, placeCheck } from '../src/game/actions';
import { CITIES } from '../src/game/cities';
import type { CityDef } from '../src/game/cities';
import { BUILDINGS, MAP_H, MAP_W, SIM_STEP, T } from '../src/game/defs';
import { CATALOG_ORDER, MODULES, PIECES, isModuleKind } from '../src/game/pieces';
import { PROJECTS, goalReached } from '../src/game/projects';
import type { ProjectKind, ProjectPhase } from '../src/game/projects';
import { step } from '../src/game/sim';
import { createGame } from '../src/game/state';
import type { GameState } from '../src/game/state';
import { answerEvent, think } from './autopilot';
import type { Plan } from './autopilot';

// the same seeded generator as the numbers harness (mulberry32), seed 42
let seed = 42;
Math.random = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const DECORATIVE: ProjectKind[] = ['bench', 'planter', 'base', 'tree', 'cathouse'];
const MAX_MINUTES = 45; // the balance check's 45 days
const PHASE_IT: Record<ProjectPhase, string> = { start: 'inizio', development: 'sviluppo', completion: 'completamento' };

interface Run {
  name: string;
  plan: Plan;
  found: Partial<Record<ProjectKind, number>>; // game seconds at the first moment the goal was reached
  usable: Partial<Record<ProjectKind, number>>; // ... and the item could also be paid for
  end: string;
  spireAt: number | null; // game seconds of the Spire's ending (then "Keep building")
  last: Record<string, number>; // the statistics at the end, for the goals never reached
}

const costOf = (k: ProjectKind) => (isModuleKind(k) ? MODULES[k].cost : PIECES[k].cost);

// A player who wants the extended nozzle puts Purifiers by the sludge: whenever one can be paid and some sludge is out
// of every Purifier's reach, on the spot whose cleaning radius covers the most of it (up to three; the autopilot alone
// builds its Purifiers near the HQ).
function purifierAtSludge(s: GameState): void {
  const def = BUILDINGS.purifier;
  const r = def.cleanRadius ?? 0;
  const near = (i: number, cx: number, cy: number) => Math.hypot((i % MAP_W) + 0.5 - cx, Math.floor(i / MAP_W) + 0.5 - cy) <= r;
  const purifiers = s.buildings.filter((b) => b.type === 'purifier');
  if (purifiers.length >= 3 || !canAfford(s, buildCost(s, 'purifier'))) return;
  const open: number[] = [];
  for (let i = 0; i < s.tiles.length; i++) if (s.tiles[i] === T.SLUDGE && !purifiers.some((b) => near(i, b.x + def.w / 2, b.y + def.h / 2))) open.push(i);
  if (!open.length) return;
  let best: { x: number; y: number; n: number } | null = null;
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      if (!placeCheck(s, 'purifier', x, y).ok) continue;
      const n = open.filter((i) => near(i, x + def.w / 2, y + def.h / 2)).length;
      if (n && (!best || n > best.n)) best = { x, y, n };
    }
  if (best) placeBuilding(s, 'purifier', best.x, best.y);
}

function run(plan: Plan, name: string, s: GameState, sludgePlayer = false): Run {
  const found: Run['found'] = {};
  const usable: Run['usable'] = {};
  let t = 0;
  let spireAt: number | null = null;
  let end = `no ending by ${MAX_MINUTES} min`;
  while (s.time < MAX_MINUTES * 60) {
    if (s.outcome) {
      // the Spire: the city keeps going (the ending's "Keep building"); smog: the city is lost
      for (const p of PROJECTS) if (found[p.kind] === undefined && goalReached(s, p.kind)) found[p.kind] = s.time;
      if (s.outcome.kind === 'smog') {
        end = `smog ${mmss(s.time)}`;
        break;
      }
      spireAt = s.time;
      end = `${s.outcome.kind} ${mmss(s.time)}`;
      s.outcome = null;
    }
    step(s, SIM_STEP);
    t += SIM_STEP;
    answerEvent(s, plan);
    if (t >= 1) {
      t = 0;
      if (sludgePlayer) purifierAtSludge(s);
      think(s, plan);
    }
    s.fx.length = 0;
    s.messages.length = 0;
    s.dirtyTiles.length = 0;
    for (const p of PROJECTS) {
      if (found[p.kind] === undefined && goalReached(s, p.kind)) found[p.kind] = s.time;
      if (found[p.kind] !== undefined && usable[p.kind] === undefined && canAfford(s, costOf(p.kind))) usable[p.kind] = s.time;
    }
  }
  const last = { pop: Math.floor(s.pop), partsMade: Math.floor(s.stats.partsMade), cleaned: s.stats.cleaned, energyProd: s.derived.energyProd, creditsEarned: Math.floor(s.stats.creditsEarned), built: s.stats.built };
  return { name, plan, found, usable, end, spireAt, last };
}

const mmss = (sec: number | undefined) => (sec === undefined ? '—' : `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`);

const runs: Run[] = [];
for (const city of CITIES as CityDef[]) {
  for (const plan of ['green', 'industrial'] as Plan[]) {
    runs.push(run(plan, city.name, createGame({ seed: city.seed, cityName: city.name, cityId: city.id, mods: city.mods })));
  }
}
for (const free of [1234, 777]) {
  for (const plan of ['green', 'industrial'] as Plan[]) runs.push(run(plan, `free ${free}`, createGame({ seed: free })));
}

// the same green runs with a Purifier put by the sludge as soon as one can be paid (for the extended nozzle)
const sludgeRuns: { name: string; start: number; run: Run }[] = [];
for (const city of CITIES as CityDef[]) {
  const s = createGame({ seed: city.seed, cityName: city.name, cityId: city.id, mods: city.mods });
  const start = s.tiles.filter((x) => x === T.SLUDGE).length;
  sludgeRuns.push({ name: city.name, start, run: run('green', city.name, s, true) });
}
for (const free of [1234, 777]) {
  const s = createGame({ seed: free });
  sludgeRuns.push({ name: `free ${free}`, start: s.tiles.filter((x) => x === T.SLUDGE).length, run: run('green', `free ${free}`, s, true) });
}

// ---------- the table: project, goal, phase, minute of discovery in each run ----------
const head = ['progetto', 'fase', ...runs.map((r) => `${r.name.split(' ')[0].slice(0, 9)} ${r.plan === 'green' ? 'V' : 'I'}`)];
const lines: string[][] = [head];
const order = CATALOG_ORDER.filter((k): k is ProjectKind => PROJECTS.some((p) => p.kind === k));
for (const p of [...PROJECTS].sort((a, b) => ['start', 'development', 'completion'].indexOf(a.phase) - ['start', 'development', 'completion'].indexOf(b.phase) || order.indexOf(a.kind) - order.indexOf(b.kind))) {
  lines.push([`${p.kind} (${p.stat} ${p.target})`, PHASE_IT[p.phase], ...runs.map((r) => `${mmss(r.found[p.kind])}${r.spireAt !== null && (r.found[p.kind] ?? 0) > r.spireAt ? '*' : ''}`)]);
}
const widths = head.map((_, i) => Math.max(...lines.map((l) => l[i].length)));
console.log('Minuto (gioco, velocità 1) in cui ogni traguardo è raggiunto la prima volta; V verde, I industriale; * dopo la Guglia (\"Continua a costruire\"); — mai entro 45 min\n');
for (const l of lines) console.log(l.map((c, i) => c.padEnd(widths[i])).join('  '));
console.log(`\nGuglia: ${runs.map((r) => `${r.name} ${r.plan}: ${r.end}`).join('; ')}`);
console.log(`a 45 min: ${runs.map((r) => `${r.name} ${r.plan}: ${Object.entries(r.last).map(([k, v]) => `${k} ${v}`).join(' ')}`).join('\n          ')}`);

// ---------- by phase: median and range of the minutes over the runs that reach it ----------
console.log('\nPer fase (minuti; mediana [min–max] sulle partite che lo raggiungono entro 45 min):');
for (const phase of ['start', 'development', 'completion'] as ProjectPhase[]) {
  for (const p of PROJECTS.filter((x) => x.phase === phase)) {
    const ts = runs.map((r) => r.found[p.kind]).filter((x): x is number => x !== undefined).sort((a, b) => a - b);
    const med = ts.length ? ts[Math.floor((ts.length - 1) / 2)] : undefined;
    const before = runs.filter((r) => r.found[p.kind] !== undefined && (r.spireAt === null || r.found[p.kind]! <= r.spireAt)).length;
    console.log(`  ${PHASE_IT[phase].padEnd(13)} ${p.kind.padEnd(15)} ${ts.length ? `${mmss(med)} [${mmss(ts[0])}–${mmss(ts[ts.length - 1])}]` : '—'.padEnd(5)} n=${ts.length}/${runs.length} (prima della Guglia ${before})`);
  }
}

// ---------- the first minutes: decorative projects usable (discovered and affordable) ----------
console.log('\nPrimi minuti: oggetti decorativi usabili (scoperti e pagabili) entro 5 e 10 minuti (senza la casetta di Miso, che chiede 3 carezze)');
for (const r of runs) {
  const by = (min: number) => DECORATIVE.filter((k) => (r.usable[k] ?? Infinity) <= min * 60);
  console.log(`  ${`${r.name} ${r.plan}`.padEnd(26)} 5 min: ${by(5).length} (${by(5).join(', ') || '—'})  10 min: ${by(10).length} (${by(10).join(', ') || '—'})  usabili a: ${DECORATIVE.filter((k) => k !== 'cathouse').map((k) => `${k} ${mmss(r.usable[k])}`).join(', ')}`);
}

console.log('\nUgello esteso (Bonifica 10 caselle di melma): partite verdi in cui il giocatore mette Purificatori accanto alla melma (fino a 3, appena pagabili)');
for (const r of sludgeRuns) {
  console.log(`  ${r.name.padEnd(18)} melma all'inizio ${String(r.start).padStart(2)}  10 bonificate a ${mmss(r.run.found.purifierNozzle)}${r.run.spireAt !== null && (r.run.found.purifierNozzle ?? 0) > r.run.spireAt ? '*' : ''}  (a 45 min: ${r.run.last.cleaned} bonificate)`);
}
