// Where the time goes before the Scrap Spire. Changes no game number: it only measures.
// The balance autopilot plays each campaign city on a seeded random sequence (the same run every time). Every second it
// records whether the autopilot placed something; a stretch with nothing placed is a "gap". For the saving phase before
// the Spire (enough citizens, no Spire yet, not affordable) it records why the parts come slowly: Recyclers working or
// starved, scrap supply, storage, power, and who else uses parts. Then it copies the city at the start of that phase and
// replays it with other moves, to see which ones bring the Spire sooner and what they cost.
// Run with: npm run waits
import { importParts } from '../src/game/actions';
import { CITIES } from '../src/game/cities';
import { BUILDINGS, DAY_LENGTH, SIM_STEP } from '../src/game/defs';
import { step } from '../src/game/sim';
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
      if (done) c.partsMade += BUILDINGS.recycler.process!.output.parts ?? 0;
    } else if ((b.type === 'fixlab' || b.type === 'factory') && done) {
      c.partsUsedByPlants += BUILDINGS[b.type].process!.input.parts ?? 0;
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
}

const spend = (before: GameState, after: GameState) => `${Math.round(before.res.credits - after.res.credits)} cr, ${Math.round(before.res.parts - after.res.parts)} pezzi`;

let labTarget = 0;
let currentPlan: Plan = 'green';
let powerTarget = 0;
const plant = () => (currentPlan === 'green' ? 'solar' : 'burner');
const ALTERNATIVES: Alternative[] = [
  { name: 'aspettare (il pilota automatico)', setup: () => '—' },
  {
    name: '+1 Riciclatore subito',
    setup: (s) => {
      const b = structuredClone(s);
      return tryBuild(s, 'recycler') ? spend(b, s) : 'non costruibile';
    },
  },
  {
    name: '+2 Riciclatori subito',
    setup: (s) => {
      const b = structuredClone(s);
      const n = Number(tryBuild(s, 'recycler')) + Number(tryBuild(s, 'recycler'));
      return n ? `${n} costruiti, ${spend(b, s)}` : 'non costruibili';
    },
  },
  {
    name: '+1 Bot Dock subito (più bot, più rottami)',
    setup: (s) => {
      const b = structuredClone(s);
      return tryBuild(s, 'dock') ? spend(b, s) : 'non costruibile';
    },
  },
  {
    name: '+1 centrale appena possibile (Pannello solare nel verde, Bruciatore nell\'industriale)',
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
    setup: (s) => {
      const b = structuredClone(s);
      return tryBuild(s, 'smelter') ? spend(b, s) : 'non costruibile';
    },
  },
  {
    name: '+1 Fix-It Lab appena possibile (pezzi → crediti)',
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
    setup: () => 'secondo necessità',
    policy: (s) => {
      while (s.res.parts < SPIRE.parts && s.res.credits >= SPIRE.credits + 160) if (!importParts(s)) break;
    },
  },
];

function analyse(plan: Plan, cityIndex: number): string {
  currentPlan = plan;
  const city = CITIES[cityIndex];
  rngState = city.seed;
  const s = createGame({ seed: city.seed, cityName: city.name, cityId: city.id, mods: city.mods });
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
  for (const alt of ALTERNATIVES) {
    const t = structuredClone(snapshot.state);
    rngState = snapshot.rng;
    const cost = alt.setup(t);
    const r = playToSpire(t, plan, alt.policy ?? (() => {}), DAY_LENGTH * 20, null);
    if (alt === ALTERNATIVES[0]) baseline = r.seconds;
    const diff = r.seconds - baseline;
    out.push(`| ${alt.name} | ${cost} | ${r.placed ? `${Math.round(r.seconds)} s` : `non in ${Math.round(r.seconds)} s`} | ${alt === ALTERNATIVES[0] ? '—' : `${diff <= 0 ? '' : '+'}${Math.round(diff)} s`} |`);
  }
  return out.join('\n');
}

console.log('# Attesa prima della Guglia (pilota automatico, sequenza casuale fissa; nessun numero del gioco cambiato)');
console.log('Tempi in secondi di simulazione; 1 giorno = 60 s; a velocità 3 un secondo reale vale 3 s di gioco.');
for (const plan of ['green', 'industrial'] as Plan[]) for (let i = 0; i < CITIES.length; i++) console.log(analyse(plan, i));
