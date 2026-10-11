// Trailer step 1: real campaign saves for the recording, made by the game's own code.
//
// For each of the five campaign cities the project's autopilot (<game>/scripts/autopilot.ts, the one `npm run balance`
// uses) plays the city with the game's simulation (<game>/src/game/sim.ts), following the game's rules: it can only
// build what placeCheck allows and pay what the city has. A snapshot taken mid-game (before the Spire, so no ending
// interrupts the recording) becomes that city's save. Each city is then played on to its end with both plans
// (green, industrial); the campaign profile keeps the stars those runs really earned, as the game does ("stars are
// never lost"). Nothing is edited by hand: no resources added, no state changed after the simulation.
//
// Bundled by record.mjs with esbuild: "@game/" points to the game checkout given with --game.
// Output (JSON on stdout): the localStorage the recording starts from, plus, per city, free spots the recorder
// can try for the "build", "decorate" and "module" scenes (checked again in the browser before use).
import { CITIES } from '@game/src/game/cities';
import { BUILDINGS, SIM_STEP } from '@game/src/game/defs';
import { step } from '@game/src/game/sim';
import { canAutosave, createGame, day, serialize } from '@game/src/game/state';
import { placeCheck } from '@game/src/game/actions';
import * as pieces from '@game/src/game/pieces';
import { answerEvent, think } from '@game/scripts/autopilot';
// Which plan's snapshot each city shows (a mix of green and industrial cities), and when to take it: a grown city
// (from 30 citizens the autopilot saves up for the Spire, so the wallet fills) with enough credits and parts for
// what the recorder does there (a Pixel Garden, a row of fences, lamps, a Smelter filter). The Spire is never
// started in a snapshot, so no ending can interrupt the recording.
const SHOW = {
  home: { plan: 'green', pop: 30, credits: 450, parts: 60 },
  rustbay: { plan: 'industrial', pop: 28, credits: 200, parts: 30 },
  neon: { plan: 'industrial', pop: 28, credits: 200, parts: 30 },
  greenvale: { plan: 'green', pop: 28, credits: 150, parts: 20 },
  company: { plan: 'industrial', pop: 28, credits: 300, parts: 40 },
};
const MAX_DAYS = 45;
const ACHIEVEMENTS = [
  'tutorial',
  'recycler',
  'citizens',
  'pop50',
  'pop100',
  'rich',
  'clean',
  'miso',
  'hint',
  'spire',
  'green',
  'industrial',
  'balanced',
  'smog',
  'cleanhands',
  'roadtrip',
  'coast',
  'superstar',
];
function newCity(city) {
  return createGame({ seed: city.seed, cityName: city.name, cityId: city.id, mods: city.mods });
}
// One run of the autopilot. `onSnap` is called once, on the first tick where `snapAt` holds and the city could be
// saved (no event waiting, no smog countdown, no ending): it sees the live state, then the run goes on to the end.
function play(city, plan, snapAt, onSnap) {
  const s = newCity(city);
  let snapped = false;
  let t = 0;
  while (!s.outcome && day(s) <= MAX_DAYS) {
    step(s, SIM_STEP);
    t += SIM_STEP;
    answerEvent(s, plan);
    if (t >= 1) {
      t = 0;
      think(s, plan);
    }
    if (!snapped && snapAt && !s.pendingEvent && !s.outcome && canAutosave(s) && snapAt(s)) {
      snapped = true;
      onSnap?.(s);
    }
    s.fx.length = 0;
    s.messages.length = 0;
    s.dirtyTiles.length = 0;
  }
  return s;
}
const hqOf = (s) => s.buildings.find((b) => b.type === 'hq');
// Tiles near the HQ, nearest first, inside a window that stays on screen at zoom 3 on a 1920x1080 window
// (screen offset from the HQ: x = (dx - dy) * 48 px, y = (dx + dy) * 24 px).
function nearHq(s, maxR) {
  const hq = hqOf(s);
  const cx = hq.x + 1.5;
  const cy = hq.y + 1.5;
  const out = [];
  for (let y = 0; y < s.tiles.length / 56; y++)
    for (let x = 0; x < 56; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const sx = (dx - dy) * 48;
      const sy = (dx + dy) * 24;
      if (Math.abs(sx) > 640 || sy < -260 || sy > 240) continue;
      const d = Math.hypot(sx, sy * 2);
      if (Math.max(Math.abs(dx), Math.abs(dy)) <= maxR) out.push({ x, y, dx, dy, d });
    }
  return out.sort((a, b) => a.d - b.d);
}
function buildSpots(s, type, n) {
  const spots = [];
  for (const p of nearHq(s, 14)) {
    if (placeCheck(s, type, p.x, p.y).ok) spots.push({ type, x: p.x, y: p.y });
    if (spots.length >= n) break;
  }
  return spots;
}
// Straight rows of free tiles for a dragged fence (along x), and single tiles for lamps.
function pieceSpots(s) {
  const check = pieces.pieceCheck;
  if (!check) return { rows: [], lamps: [] };
  const free = (x, y) => check(s, 'fence', x, y).ok;
  const rows = [];
  const lamps = [];
  const LEN = 6;
  for (const p of nearHq(s, 12)) {
    if (rows.length < 6) {
      let ok = true;
      for (let k = 0; k < LEN && ok; k++) ok = free(p.x + k, p.y) && nearHq(s, 12).some((q) => q.x === p.x + k && q.y === p.y);
      if (ok && !rows.some((r) => Math.abs(r.y - p.y) < 2 && r.x0 < p.x + LEN && p.x < r.x1 + 1)) rows.push({ x0: p.x, x1: p.x + LEN - 1, y: p.y });
    }
    if (lamps.length < 12 && check(s, 'lamp', p.x, p.y).ok) lamps.push({ x: p.x, y: p.y });
  }
  return { rows, lamps };
}
const report = [];
const storage = {};
const cities = {};
const progress = {};
for (const city of CITIES) {
  const show = SHOW[city.id] ?? { plan: 'green', pop: 22, credits: 0, parts: 0 };
  const stars = [false, false, false];
  let spireDone = false;
  let endingKind = null;
  for (const plan of ['green', 'industrial']) {
    let snapped = false;
    const snap = (live) => {
      snapped = true;
      storage[`scrapbot:save:city-${city.id}`] = serialize(live);
      storage[`scrapbot:meta:city-${city.id}`] = JSON.stringify({
        city: city.name,
        day: day(live),
        alignment: Math.round(live.alignment),
        pop: Math.floor(live.pop),
        savedAt: Date.UTC(2026, 9, 11, 12),
      });
      const hq = hqOf(live);
      const near = (type) =>
        live.buildings
          .filter((b) => b.type === type && b.built >= 1)
          .map((b) => ({ x: b.x, y: b.y, w: BUILDINGS[type].w, h: BUILDINGS[type].h, d: Math.round(Math.hypot(b.x - hq.x, b.y - hq.y)) }))
          .sort((a, b) => a.d - b.d);
      cities[city.id] = {
        name: city.name,
        plan,
        day: day(live),
        pop: Math.floor(live.pop),
        pollution: Math.round(live.pollution),
        res: { credits: Math.floor(live.res.credits), parts: Math.floor(live.res.parts), scrap: Math.floor(live.res.scrap) },
        hq: { x: hq.x, y: hq.y, w: 3, h: 3 },
        buildings: live.buildings.length,
        build: [...buildSpots(live, 'garden', 6), ...buildSpots(live, 'solar', 6)],
        ...pieceSpots(live),
        smelters: near('smelter').slice(0, 4),
        docks: near('dock').slice(0, 4),
      };
      report.push(
        `  ${city.id} snapshot (${plan}): day ${day(live)}, pop ${Math.floor(live.pop)}, smog ${Math.round(live.pollution)}%, ${live.buildings.length} buildings, credits ${Math.floor(live.res.credits)}, parts ${Math.floor(live.res.parts)}`,
      );
    };
    const end =
      plan === show.plan
        ? play(
            city,
            plan,
            (s) => s.pop >= show.pop && s.res.credits >= show.credits && s.res.parts >= show.parts && !s.buildings.some((b) => b.type === 'spire'),
            snap,
          )
        : play(city, plan);
    if (plan === show.plan && !snapped)
      throw new Error(
        `${city.id}: the ${plan} run never reached ${show.pop} citizens with ${show.credits} credits and ${show.parts} parts before its end`,
      );
    end.stars.forEach((st, i) => (stars[i] = stars[i] || !!st));
    spireDone = spireDone || !!end.spireDone;
    endingKind = end.endingKind ?? endingKind;
    report.push(
      `${city.id} ${plan}: ${end.outcome ? `${end.outcome.kind} on day ${end.outcome.day}` : `no ending in ${MAX_DAYS} days`}, stars ${end.stars.map((x) => (x ? '*' : '-')).join('')}`,
    );
  }
  progress[city.id] = { stars, spireDone, endingKind };
}
const allSpires = Object.values(progress).every((p) => p.spireDone);
storage['scrapbot:campaign'] = JSON.stringify({ version: 1, bank: { credits: 0, parts: 0 }, cities: progress, finaleSeen: allSpires });
// The player profile of someone who has played the campaign: tutorial done, achievements already earned (so no
// achievement toast covers a scene). Settings: English, sound off (the video has no sound), CRT filter off (its
// scanlines turn into moire once the video is compressed), everything else at the game's defaults.
storage['scrapbot:tutorial-done'] = '1';
storage['scrapbot:achievements'] = JSON.stringify(ACHIEVEMENTS);
storage['scrapbot:settings'] = JSON.stringify({
  sfx: 0,
  music: 0,
  crt: false,
  edgeScroll: false,
  reducedMotion: false,
  fullscreen: false,
  lang: 'en',
});
storage['scrapbot:last'] = 'city-home';
process.stdout.write(JSON.stringify({ createdAt: new Date().toISOString(), report, campaign: progress, cities, storage }, null, 1));
