// Fixed-step simulation: economy, pollution, citizens, bots, events.
import {
  BOT_CARRY,
  BOT_COLLECT_TIME,
  BOT_SPEED,
  BUILDINGS,
  DAY_LENGTH,
  MAP_H,
  MAP_W,
  SMOG_DANGER,
  SMOG_LIMIT_SECONDS,
  T,
  TILE,
} from './defs';
import { addWaste, canAfford, costText, gain, pay, setTile, spawnJunk } from './actions';
import { bName, t, tk } from '../i18n';
import { cityById, goalText, updateStars } from './cities';
import { FREE_HINTS, buildingCenter, day, findBuilding, idx, inBounds, pushMessage } from './state';
import type { Bot, Building, GameState } from './state';
import { OBJECTIVES, endingFor, endingTitle, objectiveText, pickEvent } from './story';

const SLUDGE_EMISSION = 0.002;
// The air clears faster the dirtier it is, so every city settles at its own smog level.
const DECAY_BASE = 0.03;
const DECAY_PER_POINT = 0.0015;
const TAX_PER_CITIZEN = 0.05;
const WASTE_PER_CITIZEN = 0.012;
const WASTE_CHUNK = 6;

export function step(s: GameState, dt: number): void {
  if (s.outcome || s.pendingEvent) return;
  const dayBefore = day(s);
  s.time += dt;

  burnFuel(s, dt);
  computeDerived(s);
  const d = s.derived;
  const overtime = s.time < s.overtimeUntil ? 1.5 : 1;

  for (const b of s.buildings) {
    const def = BUILDINGS[b.type];
    if (b.built < 1) {
      updateConstruction(s, b, dt);
      continue;
    }
    if (b.paused) {
      b.status = 'idle';
    } else if (def.process) {
      runProcess(s, b, dt * d.efficiency * overtime);
    } else if (def.fuel) {
      b.status = b.fuel > 0 ? 'ok' : 'noFuel';
    } else if (def.energy < 0 && d.efficiency <= 0) {
      b.status = 'noPower';
    } else {
      b.status = 'ok';
    }
    if (def.cleanRadius && !b.paused) cleanSludge(s, b, dt * d.efficiency);
    if (b.type === 'garden') growGrass(s, b, dt);
  }

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
    s.nextEventAt = s.time + (80 + Math.random() * 50) * s.mods.eventEvery;
    const ev = pickEvent(s);
    if (ev) {
      s.pendingEvent = ev.id;
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

function burnFuel(s: GameState, dt: number): void {
  for (const b of s.buildings) {
    const fuel = BUILDINGS[b.type].fuel;
    if (!fuel || b.built < 1) continue;
    if (b.fuel <= 0 && !b.paused && s.res.scrap >= fuel.scrap) {
      s.res.scrap -= fuel.scrap;
      b.fuel += fuel.seconds;
      b.lastWork = s.time;
    }
    if (b.fuel > 0) b.fuel = Math.max(0, b.fuel - dt);
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
    if (def.energy > 0 && (!def.fuel || b.fuel > 0)) d.energyProd += def.energy;
    if (def.energy < 0 && !b.paused) d.energyUse -= def.energy;
    d.housing += def.housing ?? 0;
    d.storage += def.storage ?? 0;
    d.botTarget += def.bots ?? 0;
    happy += def.happiness ?? 0;
  }
  d.efficiency = d.energyUse === 0 ? 1 : Math.min(1, d.energyProd / d.energyUse);
  const shortage = d.efficiency < 1 ? 10 : 0;
  d.happiness = clamp(55 - s.pollution * 0.5 + Math.min(25, happy) + s.happyMod + s.mods.happiness - shortage, 0, 100);
}

function updateConstruction(s: GameState, b: Building, dt: number): void {
  const def = BUILDINGS[b.type];
  b.status = 'building';
  // The Spire is built by the whole city: it slows down without power.
  const rate = b.type === 'spire' ? Math.max(0.25, s.derived.efficiency) : 1;
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
  const p = BUILDINGS[b.type].process!;
  if (work <= 0) {
    b.status = 'noPower';
    return;
  }
  if (!canAfford(s, p.input)) {
    // Hold the finished cycle until inputs show up.
    b.status = 'noInput';
    b.timer = Math.min(b.timer + work, p.time);
    return;
  }
  b.status = 'ok';
  b.timer += work;
  if (b.timer >= p.time) {
    b.timer -= p.time;
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

function updatePollution(s: GameState, dt: number, overtime: number): void {
  let rate = 0;
  for (const b of s.buildings) {
    if (b.built < 1) continue;
    const def = BUILDINGS[b.type];
    if (def.pollution > 0) {
      if (def.fuel) {
        if (b.fuel > 0) rate += def.pollution * overtime;
      } else if (b.status === 'ok') {
        rate += def.pollution * overtime * s.derived.efficiency;
      }
    } else if (def.pollution < 0 && !b.paused) {
      const power = def.energy < 0 ? s.derived.efficiency : 1;
      rate += def.pollution * power;
    }
  }
  let sludge = 0;
  for (let i = 0; i < s.tiles.length; i++) if (s.tiles[i] === T.SLUDGE) sludge++;
  rate += sludge * SLUDGE_EMISSION;
  if (s.pollution > 0) rate -= (DECAY_BASE + s.pollution * DECAY_PER_POINT) * s.mods.decay;
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
  }
  const taxes = s.pop * TAX_PER_CITIZEN * dt;
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
  if (b.cleanTimer < 6) return;
  b.cleanTimer = 0;
  const r = def.cleanRadius ?? 0;
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
  return s.buildings.filter((b) => b.built >= 1 && (BUILDINGS[b.type].storage ?? 0) > 0);
}

function syncBots(s: GameState): void {
  const target = s.derived.botTarget;
  const homes = dropoffs(s);
  while (s.bots.length < target && homes.length > 0) {
    const home = homes[s.bots.length % homes.length];
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
    const bot = s.bots.pop()!;
    releaseClaim(s, bot);
  }
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
