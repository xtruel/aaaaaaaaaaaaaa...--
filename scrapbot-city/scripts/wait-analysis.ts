// Where the time goes before the Scrap Spire. Changes no game number: it only measures.
// The balance autopilot plays each campaign city on a seeded random sequence (the same run every time). Every second it
// records whether the autopilot placed something; a stretch with nothing placed is a "gap". For the saving phase before
// the Spire (enough citizens, no Spire yet, not affordable) it records why the parts come slowly: Recyclers working or
// starved, scrap supply, storage, power, and who else uses parts. Then it copies the city at the start of that phase and
// replays it with other moves, to see which ones bring the Spire sooner and what they cost.
// 0.7 (increment 2): the same tables end with one row per machine module (installed at the start of the saving phase
// on every finished building it fits, paid for), and the run ends with the moves sorted into three comparable
// configurations: strict green, industrial and hybrid (defined in the output). The rows of 0.6.1 are unchanged.
// Run with: npm run waits
import { importParts } from '../src/game/actions';
import { CITIES } from '../src/game/cities';
import { BUILDINGS, DAY_LENGTH, SIM_STEP } from '../src/game/defs';
import type { BuildingType, PathKind } from '../src/game/defs';
import { MODULES, buildingStats, installModule, moduleCheck } from '../src/game/pieces';
import type { ModuleKind } from '../src/game/pieces';
import { step } from '../src/game/sim';
import { PROJECT_KINDS } from '../src/game/projects';
import { createGame } from '../src/game/state';
import type { GameState } from '../src/game/state';
import { answerEvent, count, think, tryBuild } from './autopilot';
import type { Plan } from './autopilot';

// Seeded Math.random with a state that can be saved and restored, so every replay starts from the same luck.
let rngState = 1;
Math.random = () => {
  rngState = (rngState + 0x6d2b79f5) | 0;
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const SPIRE = BUILDINGS.spire.cost as { credits: number; parts: number };
const hasSpire = (s: GameState) => s.buildings.some((b) => b.type === 'spire');
const saving = (s: GameState) => s.pop >= 30 && !hasSpire(s);
const fmt = (sec: number) => `${Math.round(sec)} s (${(sec / DAY_LENGTH).toFixed(1)} giorni; ${Math.round(sec / 60)} min a 1×, ${Math.round(sec / 180)} min a 3×)`;

interface Cause {
  seconds: number;
  recyclerWorking: number; // share of Recycler-time spent producing
  recyclerNoScrap: number;
  recyclerNoPower: number;
  scrapEmpty: number; // share of time with less scrap in stock than one Recycler cycle needs
  storageFull: number; // bots cannot unload
  powerShort: number; // efficiency below 1
  partsMade: number;
  partsUsedByPlants: number; // Fix-It Labs and Factories turning parts into credits
  creditsShort: number; // share of time the credits (not the parts) were the missing half
  recyclers: number;
}

function newCause(): Cause {
  return { seconds: 0, recyclerWorking: 0, recyclerNoScrap: 0, recyclerNoPower: 0, scrapEmpty: 0, storageFull: 0, powerShort: 0, partsMade: 0, partsUsedByPlants: 0, creditsShort: 0, recyclers: 0 };
}

// One simulation step plus the bookkeeping of the saving phase.
function tick(s: GameState, plan: Plan, c: Cause | null): void {
  step(s, SIM_STEP);
  answerEvent(s, plan);
  s.fx.length = 0;
  s.messages.length = 0;
  s.dirtyTiles.length = 0;
  if (!c) return;
  c.seconds += SIM_STEP;
  let rec = 0;
  for (const b of s.buildings) {
    if (b.built < 1) continue;
    const done = b.lastWork === s.time;
    if (b.type === 'recycler') {
      rec++;
      if (b.status === 'ok') c.recyclerWorking += SIM_STEP;
      else if (b.status === 'noInput') c.recyclerNoScrap += SIM_STEP;
      else if (b.status === 'noPower') c.recyclerNoPower += SIM_STEP;
      // (per cycle with the module installed: the sorter makes 3)
      if (done) c.partsMade += buildingStats(b).output.parts ?? 0;
    } else if ((b.type === 'fixlab' || b.type === 'factory') && done) {
      c.partsUsedByPlants += buildingStats(b).input.parts ?? 0;
    }
  }
  c.recyclers = Math.max(c.recyclers, rec);
  if (s.res.scrap < 3) c.scrapEmpty += SIM_STEP;
  if (s.res.scrap >= s.derived.storage - 1) c.storageFull += SIM_STEP;
  if (s.derived.efficiency < 1) c.powerShort += SIM_STEP;
  if (s.res.credits < SPIRE.credits) c.creditsShort += SIM_STEP;
}

// Plays until the Spire is placed (or a time limit); policy runs every second before the autopilot.
function playToSpire(s: GameState, plan: Plan, policy: (s: GameState) => void, limit: number, c: Cause | null): { seconds: number; placed: boolean } {
  const start = s.time;
  let acc = 0;
  while (!hasSpire(s) && !s.outcome && s.time - start < limit) {
    tick(s, plan, c);
    acc += SIM_STEP;
    if (acc >= 1) {
      acc = 0;
      policy(s);
      think(s, plan);
    }
  }
  return { seconds: s.time - start, placed: hasSpire(s) };
}

interface Alternative {
  name: string;
  setup: (s: GameState) => string; // one-off move at the start of the saving phase; returns what it cost
  policy?: (s: GameState) => void; // repeated move every second
  // which path the move belongs to: 'plan' = the plan's own (a power plant: Solar Array when green, Burner when
  // industrial); a module takes its building's path. Sorts the rows into the three configurations at the end.
  path: PathKind | 'plan';
  module?: ModuleKind;
}

const spend = (before: GameState, after: GameState) => `${Math.round(before.res.credits - after.res.credits)} cr, ${Math.round(before.res.parts - after.res.parts)} pezzi`;

let labTarget = 0;
let currentPlan: Plan = 'green';
let powerTarget = 0;
const plant = () => (currentPlan === 'green' ? 'solar' : 'burner');
const ALTERNATIVES: Alternative[] = [
  { name: 'aspettare (il pilota automatico)', setup: () => '—', path: 'neutral' },
  {
    name: '+1 Riciclatore subito',
    path: 'neutral',
    setup: (s) => {
      const b = structuredClone(s);
      return tryBuild(s, 'recycler') ? spend(b, s) : 'non costruibile';
    },
  },
  {
    name: '+2 Riciclatori subito',
    path: 'neutral',
    setup: (s) => {
      const b = structuredClone(s);
      const n = Number(tryBuild(s, 'recycler')) + Number(tryBuild(s, 'recycler'));
      return n ? `${n} costruiti, ${spend(b, s)}` : 'non costruibili';
    },
  },
  {
    name: '+1 Bot Dock subito (più bot, più rottami)',
    path: 'neutral',
    setup: (s) => {
      const b = structuredClone(s);
      return tryBuild(s, 'dock') ? spend(b, s) : 'non costruibile';
    },
  },
  {
    name: '+1 centrale appena possibile (Pannello solare nel verde, Bruciatore nell\'industriale)',
    path: 'plan',
    setup: (s) => {
      powerTarget = count(s, plant()) + 1;
      return currentPlan === 'green' ? '40 cr e 35 pezzi' : '30 cr e 5 pezzi';
    },
    policy: (s) => {
      if (count(s, plant()) < powerTarget) tryBuild(s, plant());
    },
  },
  {
    name: '+1 Fonderia subito (rottami in più → crediti, inquina)',
    path: 'industrial',
    setup: (s) => {
      const b = structuredClone(s);
      return tryBuild(s, 'smelter') ? spend(b, s) : 'non costruibile';
    },
  },
  {
    name: '+1 Fix-It Lab appena possibile (pezzi → crediti)',
    path: 'green',
    setup: (s) => {
      labTarget = count(s, 'fixlab') + 1;
      return 'quando bastano 50 cr e 70 pezzi';
    },
    policy: (s) => {
      if (count(s, 'fixlab') < labTarget) tryBuild(s, 'fixlab');
    },
  },
  {
    name: 'fermare Fix-It Lab e Fabbriche (non consumano pezzi)',
    path: 'neutral',
    setup: (s) => {
      let n = 0;
      for (const b of s.buildings) if (b.type === 'fixlab' || b.type === 'factory') (b.paused = true), n++;
      return n ? `${n} in pausa, meno crediti in entrata` : 'nessuno da fermare';
    },
    policy: (s) => {
      for (const b of s.buildings) if (b.type === 'fixlab' || b.type === 'factory') b.paused = true;
    },
  },
  {
    name: 'comprare pezzi da 2PM con i crediti in più',
    // every pack nudges the city toward Industry: not a strictly green move
    path: 'industrial',
    setup: () => 'secondo necessità',
    policy: (s) => {
      while (s.res.parts < SPIRE.parts && s.res.credits >= SPIRE.credits + 160) if (!importParts(s)) break;
    },
  },
];

// ---------- 0.7: machine modules ----------

const MODULE_IT: Record<ModuleKind, string> = {
  dockStorage: 'Deposito aggiuntivo',
  smelterFilter: 'Filtro antismog',
  recyclerMagnet: 'Separatore magnetico',
  recyclerSorter: 'Selezionatore di precisione',
  factoryArm: 'Braccio doppio',
  podsCapsule: 'Capsula abitativa',
  solarTracker: 'Pannelli orientabili',
  purifierNozzle: 'Ugello esteso',
};
const BUILDING_IT: Partial<Record<BuildingType, string>> = {
  dock: 'Bot Dock',
  smelter: 'Fonderia',
  recycler: 'Riciclatore',
  factory: 'Fabbrica 2PM',
  pods: 'Capsule Bot',
  solar: 'Campo Solare',
  purifier: 'Purificatore',
};
const NONE_IT: Partial<Record<BuildingType, string>> = {
  dock: 'nessun Bot Dock completato',
  smelter: 'nessuna Fonderia completata',
  recycler: 'nessun Riciclatore completato',
  factory: 'nessuna Fabbrica 2PM completata',
  pods: 'nessuna Capsule Bot completata',
  solar: 'nessun Campo Solare completato',
  purifier: 'nessun Purificatore completato',
};

// Installs `kind` on every finished building it fits, paying for each, in the order the city built them; says what
// it cost, or why not one could go on (then the row is "non installabile").
function installEverywhere(s: GameState, kind: ModuleKind): { cost: string; installed: number } {
  const targets = s.buildings.filter((b) => b.type === MODULES[kind].building && b.built >= 1);
  const before = structuredClone(s.res);
  let installed = 0;
  let poor = false;
  for (const b of targets) {
    if (installModule(s, kind, b)) installed++;
    else if (moduleCheck(s, kind, b).costOnly) poor = true;
  }
  if (!installed) {
    const why = !targets.length ? NONE_IT[MODULES[kind].building] : poor ? 'risorse insufficienti' : 'slot già occupato';
    return { cost: `non installabile (${why})`, installed };
  }
  const cost = `${Math.round(before.credits - s.res.credits)} cr, ${Math.round(before.parts - s.res.parts)} pezzi`;
  return { cost: installed < targets.length ? `${installed} su ${targets.length}, ${cost}` : `${installed}×, ${cost}`, installed };
}

const MODULE_ROWS: Alternative[] = (Object.keys(MODULES) as ModuleKind[]).map((kind) => ({
  name: `modulo ${MODULE_IT[kind]} su ogni ${BUILDING_IT[MODULES[kind].building]} (0.7)`,
  path: BUILDINGS[MODULES[kind].building].path,
  module: kind,
  setup: (s: GameState) => installEverywhere(s, kind).cost,
}));

// ---------- 0.7: comparable configurations ----------

type Config = 'verde rigoroso' | 'industriale' | 'ibrido';
// A move in a city of the green plan is strictly green when it is green or neutral; in the industrial plan it is
// industrial when it is industrial or neutral; a move of the other path makes a hybrid trial.
function configOf(plan: Plan, alt: Alternative): Config {
  const own = plan === 'green' ? 'green' : 'industrial';
  if (alt.path === 'plan' || alt.path === 'neutral' || alt.path === own) return plan === 'green' ? 'verde rigoroso' : 'industriale';
  return 'ibrido';
}

interface Measured {
  city: string;
  plan: Plan;
  alt: Alternative;
  config: Config;
  cost: string;
  seconds: number;
  placed: boolean;
  diff: number | null; // seconds against waiting; null when the module could not be installed
}
const MEASURED: Measured[] = [];

function analyse(plan: Plan, cityIndex: number): string {
  currentPlan = plan;
  const city = CITIES[cityIndex];
  rngState = city.seed;
  const s = createGame({ seed: city.seed, cityName: city.name, cityId: city.id, mods: city.mods });
  // the module rows measure what each module does to the waits: as a player who has discovered every project (the
  // projects only decide what can be bought, never what it does; docs/MODULAR-INC2.md §4)
  for (const k of PROJECT_KINDS) s.unlocked.add(k);
  // 1. The whole city up to the Spire: gaps between placements.
  const gaps: { start: number; len: number; saving: boolean }[] = [];
  let lastPlace = 0;
  let acc = 0;
  let snapshot: { state: GameState; rng: number } | null = null;
  let total = 0;
  while (!hasSpire(s) && !s.outcome && s.time < DAY_LENGTH * 40) {
    tick(s, plan, null);
    acc += SIM_STEP;
    if (acc >= 1) {
      acc = 0;
      if (!snapshot && saving(s) && (s.res.credits < SPIRE.credits || s.res.parts < SPIRE.parts)) snapshot = { state: structuredClone(s), rng: rngState };
      const before = s.buildings.length;
      think(s, plan);
      if (s.buildings.length > before) {
        const len = s.time - lastPlace;
        gaps.push({ start: lastPlace, len, saving: saving(s) || hasSpire(s) });
        lastPlace = s.time;
      }
    }
  }
  total = s.time;
  const longest = gaps.reduce((a, g) => (g.len > a.len ? g : a), { start: 0, len: 0, saving: false });
  const long = gaps.filter((g) => g.len >= 30);
  const out: string[] = [];
  out.push(`\n### ${city.name} — percorso ${plan === 'green' ? 'verde' : 'industriale'}`);
  out.push(`Guglia piazzata dopo ${fmt(total)}.`);
  out.push(`Tratti di almeno 30 s senza piazzare nulla: ${long.length}, in tutto ${fmt(long.reduce((a, g) => a + g.len, 0))} (${((long.reduce((a, g) => a + g.len, 0) / total) * 100).toFixed(0)}% del tempo).`);
  out.push(`Attesa consecutiva più lunga: ${fmt(longest.len)}, dal secondo ${Math.round(longest.start)}${longest.saving ? ', cioè il risparmio per la Guglia' : ''}.`);
  if (!snapshot) {
    out.push('La città non ha una fase di risparmio: aveva già tutto quando ha raggiunto 30 abitanti.');
    return out.join('\n');
  }
  // 2. Causes during the saving phase, on the autopilot's own run from the snapshot.
  const base = structuredClone(snapshot.state);
  rngState = snapshot.rng;
  const c = newCause();
  playToSpire(base, plan, () => {}, DAY_LENGTH * 20, c);
  const sh = (x: number) => `${((x / Math.max(1e-9, c.seconds)) * 100).toFixed(0)}%`;
  const rt = Math.max(1e-9, c.seconds * Math.max(1, c.recyclers));
  out.push(`Fase di risparmio (da ${Math.round(snapshot.state.time)} s, ${Math.round(snapshot.state.res.credits)} cr e ${Math.round(snapshot.state.res.parts)} pezzi): ${fmt(c.seconds)}.`);
  out.push(
    `Cause: Riciclatori (${c.recyclers}) al lavoro ${((c.recyclerWorking / rt) * 100).toFixed(0)}% del tempo, fermi senza rottami ${((c.recyclerNoScrap / rt) * 100).toFixed(0)}%, senza corrente ${((c.recyclerNoPower / rt) * 100).toFixed(0)}%; ` +
      `magazzino rottami vuoto ${sh(c.scrapEmpty)}, pieno ${sh(c.storageFull)}; energia insufficiente ${sh(c.powerShort)}; ` +
      `pezzi prodotti ${c.partsMade}, consumati da Fix-It Lab/Fabbriche ${c.partsUsedByPlants}; mancavano anche i crediti per ${sh(c.creditsShort)} del tempo.`,
  );
  // 3. Alternatives from the same moment and the same luck.
  out.push('| Mossa all\'inizio del risparmio | Costo | Guglia piazzata dopo | Rispetto ad aspettare |');
  out.push('|---|---|---|---|');
  let baseline = 0;
  for (const alt of [...ALTERNATIVES, ...MODULE_ROWS]) {
    const t = structuredClone(snapshot.state);
    rngState = snapshot.rng;
    const cost = alt.setup(t);
    const config = configOf(plan, alt);
    if (alt.module && cost.startsWith('non installabile')) {
      // nothing went on: the city plays exactly as waiting, so the row only says why
      out.push(`| ${alt.name} | ${cost} | — | — |`);
      MEASURED.push({ city: city.name, plan, alt, config, cost, seconds: baseline, placed: true, diff: null });
      continue;
    }
    const r = playToSpire(t, plan, alt.policy ?? (() => {}), DAY_LENGTH * 20, null);
    if (alt === ALTERNATIVES[0]) baseline = r.seconds;
    const diff = r.seconds - baseline;
    out.push(`| ${alt.name} | ${cost} | ${r.placed ? `${Math.round(r.seconds)} s` : `non in ${Math.round(r.seconds)} s`} | ${alt === ALTERNATIVES[0] ? '—' : `${diff <= 0 ? '' : '+'}${Math.round(diff)} s`} |`);
    MEASURED.push({ city: city.name, plan, alt, config, cost, seconds: r.seconds, placed: r.placed, diff: alt === ALTERNATIVES[0] ? 0 : diff });
  }
  return out.join('\n');
}

console.log('# Attesa prima della Guglia (pilota automatico, sequenza casuale fissa; nessun numero del gioco cambiato)');
console.log('Tempi in secondi di simulazione; 1 giorno = 60 s; a velocità 3 un secondo reale vale 3 s di gioco.');
for (const plan of ['green', 'industrial'] as Plan[]) for (let i = 0; i < CITIES.length; i++) console.log(analyse(plan, i));
console.log(configurations());

function signed(n: number): string {
  return `${n <= 0 ? '' : '+'}${Math.round(n)} s`;
}

// The same measurements, sorted into the three configurations, and the modules city by city.
function configurations(): string {
  const out: string[] = [];
  const planIt = (p: Plan) => (p === 'green' ? 'verde' : 'industriale');
  out.push('\n## 0.7: moduli e configurazioni (stesse partite delle tabelle sopra)');
  out.push('Definizioni comparabili, uguali per tutte le città:');
  out.push('- **Misura**: secondi dall\'inizio della fase di risparmio alla Guglia piazzata, sulla stessa copia della città e con la stessa sequenza casuale; una mossa è «conveniente» se arriva almeno 20 s prima di aspettare (sotto i 20–30 s è rumore).');
  out.push('- **Verde rigoroso**: città del percorso verde del pilota (Campo Solare, Giardini, Fix-It Lab, Purificatori, più gli edifici neutri: Riciclatori, Bot Dock, Capsule Bot) con mosse solo verdi o neutre: nessuna Fonderia, Bruciatore o Fabbrica, nessun pezzo importato da 2PM; moduli solo su edifici verdi o neutri.');
  out.push('- **Industriale**: città del percorso industriale del pilota (Fonderie, Bruciatori, Fabbriche, pezzi importati da 2PM, più gli edifici neutri) con mosse industriali o neutre.');
  out.push('- **Ibrido**: una città di un percorso con una mossa dell\'altro (verde + Fonderia o pezzi importati; industriale + Fix-It Lab).');
  out.push('- **Moduli**: installati all\'inizio della fase di risparmio su ogni edificio compatibile già completato, pagandoli con le risorse della città; «non installabile» quando la città non ha quell\'edificio completato o non può pagarlo (la partita resta quella di «aspettare»).');
  const runs = [...new Set(MEASURED.map((m) => `${m.city}|${m.plan}`))];
  for (const config of ['verde rigoroso', 'industriale', 'ibrido'] as Config[]) {
    out.push(`\n### ${config}`);
    out.push('| Città — percorso | Mosse provate | Migliore mossa | Rispetto ad aspettare | Mosse convenienti (≥ 20 s) |');
    out.push('|---|---|---|---|---|');
    for (const run of runs) {
      const [city, plan] = run.split('|') as [string, Plan];
      const rows = MEASURED.filter((m) => m.city === city && m.plan === plan && m.config === config && m.alt !== ALTERNATIVES[0] && m.diff !== null);
      if (!rows.length) continue;
      const best = rows.reduce((a, m) => ((m.diff ?? 0) < (a.diff ?? 0) ? m : a));
      const good = rows.filter((m) => Math.round(m.diff ?? 0) <= -20).map((m) => `${m.alt.module ? MODULE_IT[m.alt.module] : m.alt.name} ${signed(m.diff ?? 0)}`);
      out.push(`| ${city} — ${planIt(plan)} | ${rows.length} | ${best.alt.module ? `modulo ${MODULE_IT[best.alt.module]}` : best.alt.name} | ${signed(best.diff ?? 0)} | ${good.length ? good.join('; ') : 'nessuna'} |`);
    }
  }
  out.push('\n### Moduli, città per città (rispetto ad aspettare; — = non installabile)');
  out.push(`| Modulo | ${runs.map((r) => `${r.split('|')[0]} ${planIt(r.split('|')[1] as Plan)}`).join(' | ')} | Aiuta (≥ 20 s) / peggiora (≥ 20 s) |`);
  out.push(`|---|${runs.map(() => '---').join('|')}|---|`);
  for (const kind of Object.keys(MODULES) as ModuleKind[]) {
    const cells = runs.map((run) => {
      const [city, plan] = run.split('|');
      const m = MEASURED.find((x) => x.city === city && x.plan === plan && x.alt.module === kind)!;
      return m.diff === null ? '—' : m.placed ? signed(m.diff) : `non in ${Math.round(m.seconds)} s`;
    });
    // (rounded as shown in the tables)
    const diffs = MEASURED.filter((x) => x.alt.module === kind && x.diff !== null).map((x) => Math.round(x.diff ?? 0));
    const helps = diffs.filter((d) => d <= -20).length;
    const hurts = diffs.filter((d) => d >= 20).length;
    out.push(`| ${MODULE_IT[kind]} (${BUILDING_IT[MODULES[kind].building]}) | ${cells.join(' | ')} | ${helps} / ${hurts} su ${diffs.length} installabili |`);
  }
  return out.join('\n');
}
