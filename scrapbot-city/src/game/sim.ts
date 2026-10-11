// Fixed-step simulation: economy, pollution, citizens, bots, events.
import {
  BOT_CARRY,
  BOT_COLLECT_TIME,
  BOT_SPEED,
  BUILDINGS,
  DAY_LENGTH,
  MAP_H,
  MAP_W,
  SIM_STEP,
  SMOG_DANGER,
  SMOG_LIMIT_SECONDS,
  T,
  TILE,
} from './defs';
import type { BuildingType } from './defs';
import { addWaste, canAfford, costText, gain, partsReserve, pay, setTile, spawnJunk } from './actions';
import { bName, t, tk } from '../i18n';
import { cityById, goalText, updateStars } from './cities';
import { buildingStats } from './piecedefs';
import { FREE_HINTS, buildingCenter, day, findBuilding, idx, inBounds, pushMessage } from './state';
import type { Bot, Building, GameState } from './state';
import { OBJECTIVES, endingFor, endingTitle, objectiveText, pickEvent } from './story';

const SLUDGE_EMISSION = 0.002;
// The air clears faster the dirtier it is, so every city settles at its own smog level.
const DECAY_BASE = 0.03;
const DECAY_PER_POINT = 0.0015;
const TAX_PER_CITIZEN = 0.05;
// The HQ's small city grant: even a city with no citizens and no money can always climb back.
const BASE_INCOME = 0.25;
const WASTE_PER_CITIZEN = 0.012;
const WASTE_CHUNK = 6;
// A Purifier cleans one sludge tile every 6 s at full power (its module widens the radius, never this pace).
export const CLEAN_EVERY = 6;

export function step(s: GameState, dt: number): void {
  if (s.outcome || s.pendingEvent) return;
  const dayBefore = day(s);
  s.time += dt;

  burnFuel(s, dt);
  computeDerived(s);
  const overtime = overtimeFactor(s);

  // Recyclers go first: parts are what everything is built with, so they get the scrap before Smelters do.
  for (const b of s.buildings) if (b.type === 'recycler') tickBuilding(s, b, dt, overtime);
  for (const b of s.buildings) if (b.type !== 'recycler') tickBuilding(s, b, dt, overtime);

  updatePollution(s, dt, overtime);
  updateCitizens(s, dt);
  updateBots(s, dt, overtime);
  updateCat(s, dt);
  decayGrass(s, dt);

  if (s.time >= s.nextStormAt) {
    s.nextStormAt = s.time + (160 + Math.random() * 90) * s.mods.stormEvery;
    const n = spawnJunk(s, 10 + Math.floor(Math.random() * 5), 15, 35);
    pushMessage(s, t('msg.storm', { n }), 'event');
    s.fx.push({ kind: 'storm', x: 0, y: 0 });
  }

  if (s.time >= s.nextEventAt) {
    const ev = pickEvent(s);
    // once every story has been told, the reruns come less often
    const fresh = ev && !s.eventsSeen.includes(ev.id);
    s.nextEventAt = s.time + (80 + Math.random() * 50) * s.mods.eventEvery * (fresh ? 1 : 2);
    if (ev) {
      s.pendingEvent = ev.id;
      s.eventLast[ev.id] = s.time;
      if (!s.eventsSeen.includes(ev.id)) s.eventsSeen.push(ev.id);
    }
  }

  checkObjectives(s);
  s.stats.maxPollution = Math.max(s.stats.maxPollution, s.pollution);
  checkStars(s);
  rechargeHints(s);

  if (s.pollution >= SMOG_DANGER) {
    s.smog += dt;
    if (s.smog >= SMOG_LIMIT_SECONDS) s.outcome = { kind: 'smog', day: day(s) };
  } else {
    s.smog = Math.max(0, s.smog - dt * 0.5);
  }

  if (day(s) !== dayBefore) pushMessage(s, t('msg.newDay', { n: day(s) }), 'info');
}

// The overtime event: production, industry smog and the bots x1.5 while it lasts (60 s), else 1.
export function overtimeFactor(s: GameState): number {
  return s.time < s.overtimeUntil ? 1.5 : 1;
}

// Advances the city by realDt seconds of wall time at the given speed, in fixed SIM_STEP steps.
// Returns the leftover time to carry into the next frame. At most 16 steps run per frame (a very slow
// frame drops the rest instead of freezing the game); a pending event or an ending stops the steps.
export const MAX_STEPS_PER_FRAME = 16;
export function advance(s: GameState, acc: number, realDt: number, speed: number): number {
  acc += realDt * speed;
  let n = 0;
  while (acc >= SIM_STEP && n < MAX_STEPS_PER_FRAME) {
    step(s, SIM_STEP);
    acc -= SIM_STEP;
    n++;
    if (s.pendingEvent || s.outcome) break;
  }
  return n >= MAX_STEPS_PER_FRAME ? 0 : acc;
}

function burnFuel(s: GameState, dt: number): void {
  for (const b of s.buildings) {
    const fuel = BUILDINGS[b.type].fuel;
    if (!fuel || b.built < 1) continue;
    // burn first, then refuel in the same step: no one-step power cut at the end of every load
    if (b.fuel > 0) b.fuel = Math.max(0, b.fuel - dt);
    if (b.fuel <= 1e-9 && !b.paused && s.res.scrap >= fuel.scrap) {
      s.res.scrap -= fuel.scrap;
      b.fuel += fuel.seconds;
      b.lastWork = s.time;
    }
  }
}

export function computeDerived(s: GameState): void {
  const d = s.derived;
  d.energyProd = 0;
  d.energyUse = 0;
  d.housing = 0;
  d.storage = 0;
  d.botTarget = 0;
  let happy = 0;
  for (const b of s.buildings) {
    if (b.built < 1) continue;
    const def = BUILDINGS[b.type];
    const st = buildingStats(b); // energy, homes and storage with the module installed
    const energy = energyEffect(b);
    if (energy > 0) d.energyProd += energy;
    else if (energy < 0) d.energyUse -= energy;
    d.housing += st.housing;
    d.storage += st.storage;
    d.botTarget += def.bots ?? 0;
    happy += def.happiness ?? 0;
  }
  d.efficiency = d.energyUse === 0 ? 1 : Math.min(1, d.energyProd / d.energyUse);
  const shortage = d.efficiency < 1 ? 10 : 0;
  d.happiness = clamp(55 - s.pollution * 0.5 + Math.min(25, happy) + s.happyMod + s.mods.happiness - shortage, 0, 100);
}

// What a finished building adds to the city's power (+) or takes from it (-) right now: a plant while it runs (a
// Burner only while it has fuel), a consumer unless paused. computeDerived adds these up; the building panel shows them.
export function energyEffect(b: Building): number {
  if (b.built < 1) return 0;
  const st = buildingStats(b);
  if (st.energy > 0) return !BUILDINGS[b.type].fuel || b.fuel > 0 ? st.energy : 0;
  return st.energy < 0 && !b.paused ? st.energy : 0;
}

function tickBuilding(s: GameState, b: Building, dt: number, overtime: number): void {
  const def = BUILDINGS[b.type];
  const d = s.derived;
  if (b.built < 1) {
    updateConstruction(s, b, dt);
    return;
  }
  if (b.paused) {
    b.status = 'idle';
  } else if (def.process) {
    runProcess(s, b, dt * d.efficiency * overtime);
  } else if (def.fuel) {
    b.status = b.fuel > 0 ? 'ok' : 'noFuel';
  } else if (buildingStats(b).energy < 0 && d.efficiency <= 0) {
    b.status = 'noPower';
  } else {
    b.status = 'ok';
  }
  if (buildingStats(b).cleanRadius > 0 && !b.paused) cleanSludge(s, b, dt * d.efficiency);
  if (b.type === 'garden') growGrass(s, b, dt);
}

// How fast a building goes up (1 = its normal build time). The Spire is built by the whole city: it slows down
// without power, to a quarter at worst.
export function buildRate(s: GameState, b: Building): number {
  return b.type === 'spire' ? Math.max(0.25, s.derived.efficiency) : 1;
}

function updateConstruction(s: GameState, b: Building, dt: number): void {
  const def = BUILDINGS[b.type];
  b.status = 'building';
  const rate = buildRate(s, b);
  b.built = Math.min(1, b.built + (dt * rate) / Math.max(0.1, def.buildTime));
  if (b.built >= 1) {
    b.status = 'ok';
    s.stats.built++;
    const c = buildingCenter(b);
    s.fx.push({ kind: 'built', x: c.x, y: c.y, text: bName(b.type) });
    if (b.type === 'spire') {
      s.spireDone = true;
      s.endingKind = endingFor(s);
      s.outcome = { kind: s.endingKind, day: day(s) };
      pushMessage(s, t('msg.spireDone', { title: endingTitle(s.endingKind) }), 'good');
    } else {
      pushMessage(s, t('msg.online', { name: bName(b.type) }), 'good');
    }
  }
}

function runProcess(s: GameState, b: Building, work: number): void {
  const p = buildingStats(b); // seconds, input and output of a cycle, with the module installed
  if (work <= 0) {
    b.status = 'noPower';
    return;
  }
  const keep = p.input.parts ? partsReserve(s) : 0;
  if (!canAfford(s, p.input) || s.res.parts - (p.input.parts ?? 0) < keep) {
    // Hold the finished cycle until inputs show up (parts makers leave a reserve for building).
    b.status = canAfford(s, p.input) ? 'reserve' : 'noInput';
    b.timer = Math.min(b.timer + work, p.cycle);
    return;
  }
  b.status = 'ok';
  b.timer += work;
  if (b.timer >= p.cycle) {
    b.timer -= p.cycle;
    pay(s, p.input);
    gain(s, p.output);
    b.lastWork = s.time;
    const c = buildingCenter(b);
    const out = Object.entries(p.output)
      .map(([k, v]) => `+${v} ${k === 'credits' ? t('fx.cr') : k === 'parts' ? t('fx.parts') : tk(`res.${k}`)}`)
      .join(' ');
    s.fx.push({ kind: 'produce', x: c.x, y: c.y - 10, text: out, coins: !!p.output.credits });
  }
}

// What a building puts into the air (+) or takes out of it (-) per second right now: industry while it runs (slower
// without enough power, faster on overtime), a Burner while it has fuel, a Purifier or a Garden unless paused.
// updatePollution adds these up; the smog panel and the clouds on the map show the same numbers.
export function airEffect(s: GameState, b: Building, overtime = overtimeFactor(s)): number {
  if (b.built < 1) return 0;
  const st = buildingStats(b); // a Smelter filter lowers the Smelter's pollution
  if (st.pollution > 0) {
    if (BUILDINGS[b.type].fuel) return b.fuel > 0 ? st.pollution * overtime : 0;
    return b.status === 'ok' ? st.pollution * overtime * s.derived.efficiency : 0;
  }
  if (st.pollution < 0 && !b.paused) {
    const power = st.energy < 0 ? s.derived.efficiency : 1;
    return st.pollution * power;
  }
  return 0;
}

const BUILDING_TYPES = Object.keys(BUILDINGS) as BuildingType[];

function updatePollution(s: GameState, dt: number, overtime: number): void {
  // the same sum as always, in the same order; each part is also kept in derived.air for the smog panel
  const air = s.derived.air;
  for (const type of BUILDING_TYPES) {
    air.byType[type] = 0;
    air.count[type] = 0;
  }
  let rate = 0;
  for (const b of s.buildings) {
    const effect = airEffect(s, b, overtime);
    if (effect === 0) continue;
    rate += effect;
    air.byType[b.type] += effect;
    air.count[b.type]++;
  }
  let sludge = 0;
  for (let i = 0; i < s.tiles.length; i++) if (s.tiles[i] === T.SLUDGE) sludge++;
  air.sludgeTiles = sludge;
  air.sludge = sludge * SLUDGE_EMISSION;
  rate += air.sludge;
  air.renewal = s.pollution > 0 ? -((DECAY_BASE + s.pollution * DECAY_PER_POINT) * s.mods.decay) : 0;
  rate += air.renewal;
  s.derived.pollutionRate = rate;
  s.pollution = clamp(s.pollution + rate * dt, 0, 100);
}

function updateCitizens(s: GameState, dt: number): void {
  const d = s.derived;
  s.happyMod = approach(s.happyMod, 0, dt * 0.08);
  if (s.pop > d.housing) s.pop = d.housing;
  if (d.happiness >= 35 && s.pop < d.housing) {
    s.pop = Math.min(d.housing, s.pop + dt * 0.25 * (d.happiness / 100));
  } else if (d.happiness < 25) {
    s.pop = Math.max(0, s.pop - dt * 0.06);
    // the city has emptied: say so (once a day) and point at USA-9, who knows the way back
    if (s.pop < 1 && d.housing > 0 && s.time - s.warnedEmptyAt > DAY_LENGTH) {
      s.warnedEmptyAt = s.time;
      pushMessage(s, t('msg.ghost'), 'bad');
    }
  }
  const taxes = (s.pop * TAX_PER_CITIZEN + BASE_INCOME) * dt;
  s.res.credits += taxes;
  s.stats.creditsEarned += taxes;
  s.waste += s.pop * WASTE_PER_CITIZEN * dt;
  while (s.waste >= WASTE_CHUNK) {
    s.waste -= WASTE_CHUNK;
    addWaste(s, WASTE_CHUNK);
  }
}

function cleanSludge(s: GameState, b: Building, dt: number): void {
  const def = BUILDINGS[b.type];
  b.cleanTimer += dt;
  if (b.cleanTimer < CLEAN_EVERY) return;
  b.cleanTimer = 0;
  const r = buildingStats(b).cleanRadius; // the nozzle widens the reach, the pace stays one tile every 6 s
  const cx = b.x + def.w / 2;
  const cy = b.y + def.h / 2;
  let best = -1;
  let bestD = Infinity;
  for (let y = Math.floor(cy - r); y <= cy + r; y++) {
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      if (!inBounds(x, y)) continue;
      const i = idx(x, y);
      if (s.tiles[i] !== T.SLUDGE) continue;
      const dd = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (dd <= r && dd < bestD) {
        best = i;
        bestD = dd;
      }
    }
  }
  if (best >= 0) {
    setTile(s, best, T.GROUND);
    s.stats.cleaned++;
    s.fx.push({ kind: 'clean', x: ((best % MAP_W) + 0.5) * TILE, y: (Math.floor(best / MAP_W) + 0.5) * TILE });
  }
}

function growGrass(s: GameState, b: Building, dt: number): void {
  if (s.pollution > 45 || Math.random() > dt * 0.5) return;
  const x = b.x + Math.floor(Math.random() * 5) - 2;
  const y = b.y + Math.floor(Math.random() * 5) - 2;
  if (!inBounds(x, y)) return;
  const i = idx(x, y);
  if (s.tiles[i] === T.GROUND) setTile(s, i, T.GRASS);
}

function decayGrass(s: GameState, dt: number): void {
  if (s.pollution < 70 || Math.random() > dt * 4) return;
  const i = Math.floor(Math.random() * MAP_W * MAP_H);
  if (s.tiles[i] === T.GRASS) setTile(s, i, T.GROUND);
}

function checkStars(s: GameState): void {
  const city = cityById(s.cityId);
  for (const i of updateStars(s)) {
    pushMessage(s, t('msg.star', { goal: city ? goalText(city, i) : '' }), 'good');
    s.fx.push({ kind: 'star', x: 0, y: 0, text: String(i) });
  }
}

// A free hint comes back every few days, up to the starting amount.
function rechargeHints(s: GameState): void {
  if (day(s) < s.hints.nextFreeDay) return;
  s.hints.nextFreeDay = day(s) + 5;
  if (s.hints.free < FREE_HINTS) {
    s.hints.free++;
    pushMessage(s, t('msg.freeHint'), 'info');
  }
}

function checkObjectives(s: GameState): void {
  // A goal the player went past (30 citizens without ever building a money maker) is skipped,
  // so the goal card never stays stuck on step 6 while the city is already finished.
  // The early teaching goals are never skipped: they complete on their own within seconds.
  const milestone = OBJECTIVES.findIndex((o) => o.id === 'pop30');
  const passed = () => OBJECTIVES.some((o, i) => i > s.objective && i >= milestone && o.done(s));
  while (s.objective < OBJECTIVES.length - 1 && !OBJECTIVES[s.objective].done(s) && passed()) s.objective++;
  const obj = OBJECTIVES[s.objective];
  if (!obj || !obj.done(s)) return;
  s.objective++;
  if (obj.reward) {
    gain(s, obj.reward);
    pushMessage(s, t('msg.goalReward', { goal: objectiveText(obj), reward: costText(obj.reward) }), 'good');
  } else {
    pushMessage(s, t('msg.goal', { goal: objectiveText(obj) }), 'good');
  }
}

// ---------- bots ----------

function dropoffs(s: GameState): Building[] {
  return s.buildings.filter((b) => b.built >= 1 && buildingStats(b).storage > 0);
}

function syncBots(s: GameState): void {
  const target = s.derived.botTarget;
  const homes = dropoffs(s);
  while (s.bots.length < target && homes.length > 0) {
    // each home launches its own share of bots (the HQ 3, every Dock 2...), so a new Dock's bots leave from it
    const home = homeFor(homes, s.bots.length);
    const c = buildingCenter(home);
    s.bots.push({
      id: s.nextId++,
      x: c.x,
      y: c.y,
      state: 'idle',
      target: -1,
      carry: 0,
      timer: Math.random(),
      phase: Math.random() * 10,
      facing: 1,
    });
  }
  while (s.bots.length > target) {
    // retire an empty idle bot first; the load of a loaded one is unloaded (unloadPending: into storage as far
    // as it fits, the rest waits for room) instead of vanishing
    let k = s.bots.findIndex((b) => b.state === 'idle' && b.carry === 0);
    if (k < 0) k = s.bots.length - 1;
    const bot = s.bots.splice(k, 1)[0];
    releaseClaim(s, bot);
    if (bot.carry > 0) s.scrapPending += bot.carry;
  }
}

// Scrap waiting for room (from a save made while the bots carried more than storage held, or from a retired
// bot) goes in as soon as there is room, and counts as collected then, as a bot unloading does.
function unloadPending(s: GameState): void {
  if (!(s.scrapPending > 0)) return;
  const dep = Math.min(s.scrapPending, Math.max(0, s.derived.storage - s.res.scrap));
  if (dep <= 0) return;
  s.res.scrap += dep;
  s.scrapPending -= dep;
  s.stats.scrapCollected += dep;
}

function homeFor(homes: Building[], k: number): Building {
  let n = k;
  const total = homes.reduce((sum, h) => sum + (BUILDINGS[h.type].bots ?? 0), 0);
  if (total > 0) {
    n = k % total;
    for (const h of homes) {
      const share = BUILDINGS[h.type].bots ?? 0;
      if (n < share) return h;
      n -= share;
    }
  }
  return homes[k % homes.length];
}

function releaseClaim(s: GameState, bot: Bot): void {
  if ((bot.state === 'toJunk' || bot.state === 'collect') && bot.target >= 0 && s.claims[bot.target] > 0) {
    s.claims[bot.target]--;
  }
}

function findJunk(s: GameState, bot: Bot): number {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < s.tiles.length; i++) {
    if (s.tiles[i] !== T.JUNK) continue;
    if (s.claims[i] * BOT_CARRY >= s.amount[i]) continue;
    const dx = ((i % MAP_W) + 0.5) * TILE - bot.x;
    const dy = (Math.floor(i / MAP_W) + 0.5) * TILE - bot.y;
    const dd = dx * dx + dy * dy;
    if (dd < bestD) {
      bestD = dd;
      best = i;
    }
  }
  return best;
}

function nearestDrop(s: GameState, bot: Bot): Building | undefined {
  let best: Building | undefined;
  let bestD = Infinity;
  for (const b of dropoffs(s)) {
    const c = buildingCenter(b);
    const dd = (c.x - bot.x) ** 2 + (c.y - bot.y) ** 2;
    if (dd < bestD) {
      bestD = dd;
      best = b;
    }
  }
  return best;
}

function moveTo(bot: Bot, tx: number, ty: number, dist: number): boolean {
  const dx = tx - bot.x;
  const dy = ty - bot.y;
  const len = Math.hypot(dx, dy);
  if (Math.abs(dx) > 0.5) bot.facing = dx > 0 ? 1 : -1;
  if (len <= dist) {
    bot.x = tx;
    bot.y = ty;
    return true;
  }
  bot.x += (dx / len) * dist;
  bot.y += (dy / len) * dist;
  return false;
}

function updateBots(s: GameState, dt: number, overtime: number): void {
  syncBots(s);
  unloadPending(s);
  const speed = BOT_SPEED * s.botSpeedMul * overtime * dt;
  const storage = s.derived.storage;
  for (const bot of s.bots) {
    bot.phase += dt;
    switch (bot.state) {
      case 'idle': {
        bot.timer -= dt;
        if (bot.timer > 0) break;
        if (bot.carry > 0) {
          const drop = nearestDrop(s, bot);
          if (drop) {
            bot.state = 'toDrop';
            bot.target = drop.id;
          }
          bot.timer = 1;
          break;
        }
        if (s.res.scrap >= storage) {
          bot.timer = 1.5;
          break;
        }
        const t = findJunk(s, bot);
        if (t >= 0) {
          s.claims[t]++;
          bot.state = 'toJunk';
          bot.target = t;
        } else {
          bot.timer = 2;
        }
        break;
      }
      case 'toJunk': {
        if (s.tiles[bot.target] !== T.JUNK) {
          releaseClaim(s, bot);
          bot.state = 'idle';
          bot.timer = 0.2;
          break;
        }
        const tx = ((bot.target % MAP_W) + 0.5) * TILE;
        const ty = (Math.floor(bot.target / MAP_W) + 0.5) * TILE - 4;
        if (moveTo(bot, tx, ty, speed)) {
          bot.state = 'collect';
          bot.timer = BOT_COLLECT_TIME;
        }
        break;
      }
      case 'collect': {
        bot.timer -= dt;
        if (bot.timer > 0) break;
        releaseClaim(s, bot);
        const i = bot.target;
        if (s.tiles[i] === T.JUNK) {
          const take = Math.min(BOT_CARRY, s.amount[i]);
          s.amount[i] -= take;
          bot.carry = take;
          s.dirtyTiles.push(i);
          if (s.amount[i] <= 0) setTile(s, i, T.GROUND);
          s.fx.push({ kind: 'collect', x: bot.x, y: bot.y });
        }
        bot.state = 'idle';
        bot.timer = 0;
        break;
      }
      case 'toDrop': {
        const drop = findBuilding(s, bot.target);
        if (!drop || drop.built < 1) {
          bot.state = 'idle';
          bot.timer = 0.3;
          break;
        }
        const c = buildingCenter(drop);
        if (moveTo(bot, c.x, c.y - 6, speed)) {
          const space = Math.max(0, storage - s.res.scrap);
          const dep = Math.min(space, bot.carry);
          s.res.scrap += dep;
          bot.carry -= dep;
          s.stats.scrapCollected += dep;
          bot.state = 'idle';
          bot.timer = bot.carry > 0 ? 2 : 0.3;
          if (bot.carry > 0 && s.time - s.warnedFullAt > 45) {
            s.warnedFullAt = s.time;
            pushMessage(s, t('msg.storageFull'), 'bad');
          }
        }
        break;
      }
    }
  }
}

function updateCat(s: GameState, dt: number): void {
  const cat = s.cat;
  cat.timer -= dt;
  if (cat.sitting) {
    if (cat.timer <= 0) {
      const hq = s.buildings.find((b) => b.type === 'hq');
      const ox = hq ? (hq.x + 1.5) * TILE : (MAP_W * TILE) / 2;
      const oy = hq ? (hq.y + 1.5) * TILE : (MAP_H * TILE) / 2;
      cat.tx = clamp(ox + (Math.random() * 2 - 1) * 9 * TILE, TILE, (MAP_W - 1) * TILE);
      cat.ty = clamp(oy + (Math.random() * 2 - 1) * 6 * TILE, TILE, (MAP_H - 1) * TILE);
      cat.sitting = false;
    }
    return;
  }
  const dx = cat.tx - cat.x;
  const dy = cat.ty - cat.y;
  const len = Math.hypot(dx, dy);
  const stepLen = 14 * dt;
  if (Math.abs(dx) > 0.5) cat.facing = dx > 0 ? 1 : -1;
  if (len <= stepLen) {
    cat.x = cat.tx;
    cat.y = cat.ty;
    cat.sitting = true;
    cat.timer = 3 + Math.random() * 6;
  } else {
    cat.x += (dx / len) * stepLen;
    cat.y += (dy / len) * stepLen;
  }
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function approach(v: number, target: number, amt: number): number {
  if (v > target) return Math.max(target, v - amt);
  return Math.min(target, v + amt);
}

export function dayPhase(s: GameState): number {
  return (s.time % DAY_LENGTH) / DAY_LENGTH;
}
