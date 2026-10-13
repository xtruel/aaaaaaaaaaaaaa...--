// USA-9's advice: reads the city and recommends the single most useful next step, aimed at the real bottleneck
// (docs/MODULAR-INC2.md §4b): no extra storage when credits are what is missing, no new Recycler without the power
// to run it and scrap to feed it.
import { bName, t } from '../i18n';
import { buildCost, canAfford, costText } from './actions';
import { BUILDINGS, IMPORT_PARTS, PARTS_RESERVE, SMOG_DANGER, T } from './defs';
import { energyGoingUp, energySpare, scrapAvailable } from './economy';
import { buildingStats } from './piecedefs';
import type { BuildingType } from './defs';
import { FREE_HINTS } from './state';
import type { GameState } from './state';

export interface Hint {
  title: string;
  text: string;
  build?: BuildingType;
  free?: boolean; // "wait for it" and rescue advice (empty or broke city) never cost a hint
}

export const HINT_BASE_PRICE = 40;
export const HINT_PRICE_STEP = 30;
export const HINT_MAX_PRICE = 300;

export function hintPrice(s: GameState): number {
  return Math.min(HINT_MAX_PRICE, HINT_BASE_PRICE + s.hints.paid * HINT_PRICE_STEP);
}

export function freeHintsLeft(s: GameState): number {
  return Math.min(FREE_HINTS, s.hints.free);
}

const count = (s: GameState, type: BuildingType) => s.buildings.filter((b) => b.type === type).length;
const has = (s: GameState, type: BuildingType) => count(s, type) > 0;

function afford(s: GameState, type: BuildingType): string {
  const cost = buildCost(s, type);
  if (canAfford(s, cost)) return t('hint.afford.yes', { cost: costText(cost) });
  // only parts missing, and credits to spare: saving up is the wrong advice, importing is the right one
  const partsShort = Math.max(0, (cost.parts ?? 0) - Math.floor(s.res.parts));
  const importCost = Math.ceil(partsShort / IMPORT_PARTS.parts) * IMPORT_PARTS.credits;
  if (partsShort > 0 && s.res.credits >= (cost.credits ?? 0) + importCost && s.res.scrap >= (cost.scrap ?? 0)) {
    return t('hint.afford.import', { cost: costText(cost) });
  }
  return t('hint.afford.no', { cost: costText(cost) });
}

// Credits are what the city lacks, rather than storage, parts or scrap: it is saving for the Spire and the credits are
// not there yet; or it sits on a pile of parts (150+) with few credits (under 400), the line the "turn parts into
// credits" advice uses; or a Bot Dock is out of reach for its credits alone.
export function creditsShort(s: GameState): boolean {
  if (s.pop >= 30 && !has(s, 'spire') && s.res.credits < (buildCost(s, 'spire').credits ?? 0)) return true;
  if (s.res.parts > 150 && s.res.credits < 400) return true;
  const dock = buildCost(s, 'dock');
  return s.res.credits < (dock.credits ?? 0) && s.res.parts >= (dock.parts ?? 0) && s.res.scrap >= (dock.scrap ?? 0);
}

// Can the city run one more Recycler? Power: its use must fit in the power to spare, `spare` (energyHeadroom): the
// power to spare now as the HUD shows it, `now`, and what the buildings going up will do to it, `going`. Scrap: one
// cycle in storage, or junk on the map for the bots (scrapAvailable).
export interface RecyclerCheck {
  power: boolean;
  scrap: boolean;
  need: number;
  spare: number;
  now: number;
  going: number;
}

export function recyclerCheck(s: GameState): RecyclerCheck {
  const need = -buildingStats({ type: 'recycler' }).energy;
  const now = energySpare(s);
  const going = energyGoingUp(s);
  const spare = now + going;
  return { power: spare >= need, scrap: scrapAvailable(s), need, spare, now, going };
}

// Power first: what to build so a new Recycler does not slow every machine down. The power to spare it names is the
// HUD's (made minus used); when the buildings going up will take some of it, it says how much, so the advice and the
// top bar never disagree.
function recyclerPower(s: GameState, rc: RecyclerCheck): Hint {
  const solarOk = canAfford(s, buildCost(s, 'solar'));
  const pick: BuildingType = s.alignment >= 0 || solarOk ? 'solar' : 'burner';
  const what = pick === 'solar' ? t('hint.power.solar') : t('hint.power.burner');
  const spare = Math.max(0, Math.floor(rc.now));
  const going = Math.round(-rc.going); // what the buildings going up will use, net of the plants going up
  return {
    title: t('hint.recyclerPower.title'),
    text:
      going > 0
        ? t('hint.recyclerPower.going', { need: rc.need, spare, going, what, afford: afford(s, pick) })
        : t('hint.recyclerPower.text', { need: rc.need, spare, what, afford: afford(s, pick) }),
    build: pick,
  };
}

// USA-9 never asks for a building that is already going up: it says to wait for it instead.
export function suggest(s: GameState): Hint {
  const hint = pick(s);
  if (hint.build && s.buildings.some((b) => b.type === hint.build && b.built < 1)) {
    return { title: t('hint.wait.title'), text: t('hint.wait.text', { name: bName(hint.build) }), free: true };
  }
  return hint;
}

function pick(s: GameState): Hint {
  const d = s.derived;
  const leansGreen = s.alignment >= 0;
  const industry = s.buildings.filter((b) => BUILDINGS[b.type].path === 'industrial' && !b.paused);
  const sludge = s.tiles.reduce((n, tile) => n + (tile === T.SLUDGE ? 1 : 0), 0);
  let junk = 0;
  for (let i = 0; i < s.tiles.length; i++) if (s.tiles[i] === T.JUNK) junk += s.amount[i];
  const smog = Math.round(s.pollution);

  if (s.pollution >= SMOG_DANGER - 15) {
    if (industry.length > 0) {
      return { title: t('hint.smogEmergency.title'), text: t('hint.smogEmergency.text', { n: smog }), build: 'purifier' };
    }
    return { title: t('hint.clearAir.title'), text: t('hint.clearAir.text', { n: smog, afford: afford(s, 'purifier') }), build: 'purifier' };
  }

  // a city that has emptied out, or spent everything: the way back is demolishing and pausing
  if (s.pop < 1 && d.housing > 0 && d.happiness < 35) {
    return { title: t('hint.ghost.title'), text: t('hint.ghost.text', { happy: Math.round(d.happiness), smog }), free: true };
  }
  // (with citizens around, taxes refill the coffers on their own: no need to tear anything down)
  if (s.res.credits < 30 && s.res.parts < 10 && s.pop < 3 && s.buildings.length > 3) {
    return { title: t('hint.broke.title'), text: t('hint.broke.text', { credits: Math.floor(s.res.credits), parts: Math.floor(s.res.parts) }), free: true };
  }

  if (!has(s, 'recycler')) {
    const rc = recyclerCheck(s);
    if (!rc.scrap) return { title: t('hint.noScrap.title'), text: t('hint.noScrap.text'), build: 'pods' };
    if (!rc.power) return recyclerPower(s, rc);
    return { title: t('hint.parts.title'), text: t('hint.parts.text', { afford: afford(s, 'recycler') }), build: 'recycler' };
  }

  // every Recycler paused by the player, with no pile of parts: that pause is what keeps parts from coming in, and
  // undoing it costs nothing (not another Recycler, not imported parts, not more scrap)
  const recyclers = s.buildings.filter((b) => b.type === 'recycler' && b.built >= 1);
  if (recyclers.length > 0 && recyclers.every((b) => b.paused) && s.res.parts < 150) {
    return { title: t('hint.recyclerPaused.title'), text: t('hint.recyclerPaused.text', { n: Math.floor(s.res.parts), resume: t('insp.resume') }), free: true };
  }

  // rich in credits but out of parts (the industrial trap): import, don't wait
  if (s.res.parts < PARTS_RESERVE + 5 && s.res.credits >= IMPORT_PARTS.credits * 3) {
    return {
      title: t('hint.import.title'),
      text: t('hint.import.text', { n: Math.floor(s.res.parts), parts: IMPORT_PARTS.parts, credits: IMPORT_PARTS.credits, reserve: PARTS_RESERVE }),
    };
  }

  if (d.efficiency < 1) {
    const solarOk = canAfford(s, buildCost(s, 'solar'));
    const pick: BuildingType = leansGreen || solarOk ? 'solar' : 'burner';
    return {
      title: t('hint.power.title'),
      text: t('hint.power.text', {
        use: d.energyUse,
        prod: d.energyProd,
        what: pick === 'solar' ? t('hint.power.solar') : t('hint.power.burner'),
        afford: afford(s, pick),
      }),
      build: pick,
    };
  }

  // a pile of parts and few credits: more Recyclers would only make it worse, a converter helps
  const converter: BuildingType = leansGreen ? 'fixlab' : 'factory';
  if (s.res.parts > 150 && s.res.credits < 400 && count(s, converter) < 4) {
    return {
      title: t('hint.convert.title'),
      text: t(leansGreen ? 'hint.convert.fixlab' : 'hint.convert.factory', { n: Math.floor(s.res.parts), afford: afford(s, converter) }),
      build: converter,
    };
  }

  // full storage only matters while parts are short; with a pile of parts it is fine
  if (s.res.scrap >= d.storage * 0.9 && s.res.parts < 150) {
    // (the scrap is right there; a second Recycler still needs the power to run)
    const rc = recyclerCheck(s);
    if (count(s, 'recycler') <= 1 && !rc.power) return recyclerPower(s, rc);
    // more storage does not help a city that is short of credits: something that turns the scrap into credits does
    if (count(s, 'recycler') > 1 && creditsShort(s)) {
      const conv: BuildingType = leansGreen ? 'fixlab' : 'smelter';
      return {
        title: t('hint.storageCredits.title'),
        text: t(conv === 'fixlab' ? 'hint.storageCredits.fixlab' : 'hint.storageCredits.smelter', { n: Math.floor(s.res.scrap), cap: d.storage, afford: afford(s, conv) }),
        build: conv,
      };
    }
    const pick: BuildingType = count(s, 'recycler') <= 1 ? 'recycler' : 'dock';
    return {
      title: t('hint.storage.title'),
      text: t('hint.storage.text', {
        n: Math.floor(s.res.scrap),
        cap: d.storage,
        what: pick === 'recycler' ? t('hint.storage.recycler') : t('hint.storage.dock'),
      }),
      build: pick,
    };
  }

  if (!has(s, 'pods')) {
    return { title: t('hint.pods.title'), text: t('hint.pods.text', { afford: afford(s, 'pods') }), build: 'pods' };
  }

  // same order as the goal card: power comes right after the first pods
  if (!has(s, 'solar') && !has(s, 'burner')) {
    const pick: BuildingType = leansGreen ? 'solar' : 'burner';
    return {
      title: t('hint.addPower.title'),
      text: t('hint.addPower.text', { what: pick === 'solar' ? t('hint.power.solar') : t('hint.power.burner'), afford: afford(s, pick) }),
      build: pick,
    };
  }

  if (d.happiness < 40) {
    return { title: t('hint.happy.title'), text: t('hint.happy.text', { n: Math.round(d.happiness) }), build: 'garden' };
  }

  // the goals come first: 30 citizens means the Spire, 10 citizens means a money maker
  const spire = s.buildings.find((b) => b.type === 'spire');
  if (!spire && s.pop >= 30) {
    const cost = buildCost(s, 'spire');
    const missing = {
      credits: Math.max(0, (cost.credits ?? 0) - Math.floor(s.res.credits)),
      parts: Math.max(0, (cost.parts ?? 0) - Math.floor(s.res.parts)),
    };
    if (missing.credits === 0 && missing.parts === 0) {
      return { title: t('hint.spireReady.title'), text: t('hint.spireReady.text'), build: 'spire' };
    }
    const partsMakersOn = s.buildings.some((b) => (b.type === 'factory' || b.type === 'fixlab') && !b.paused);
    let extra = missing.parts > 0 && partsMakersOn ? ` ${t('hint.spireSave.parts')}` : '';
    if (missing.credits > 0 && s.res.parts > 150) extra += ` ${t('hint.spireSave.credits')}`;
    // waiting on parts with a full scrap store: a second Recycler doubles the pace, if there is power to run it
    if (missing.parts > 0 && s.res.scrap >= d.storage * 0.9 && recyclerCheck(s).power) extra += ` ${t('hint.storage.recycler')}`;
    return { title: t('hint.spireSave.title'), text: t('hint.spireSave.text', { cost: costText(missing) }) + extra };
  }

  if (s.pop >= 10 && !has(s, 'fixlab') && !has(s, 'smelter') && !has(s, 'factory')) {
    const pick: BuildingType = leansGreen ? 'fixlab' : 'smelter';
    return {
      title: t('hint.money.title'),
      text: pick === 'fixlab' ? t('hint.money.fixlab', { afford: afford(s, 'fixlab') }) : t('hint.money.smelter', { afford: afford(s, 'smelter') }),
      build: pick,
    };
  }

  if (s.pop >= d.housing - 1) {
    return {
      title: t('hint.full.title'),
      text: t('hint.full.text', { pop: Math.floor(s.pop), homes: d.housing, afford: afford(s, 'pods') }),
      build: 'pods',
    };
  }

  // sludge can wait until the city stands on its feet and the Purifier is affordable
  if (sludge > 0 && !has(s, 'purifier') && s.pop >= 10 && canAfford(s, buildCost(s, 'purifier'))) {
    return { title: t('hint.sludge.title'), text: t('hint.sludge.text', { n: sludge, afford: afford(s, 'purifier') }), build: 'purifier' };
  }

  // (a Dock is storage too: not the advice when credits are what is missing)
  if (junk > 300 && s.pop >= 6 && s.bots.length < 5 + s.pop / 4 && !creditsShort(s)) {
    return { title: t('hint.hands.title'), text: t('hint.hands.text', { junk, bots: s.bots.length, afford: afford(s, 'dock') }), build: 'dock' };
  }

  if (s.res.parts < 25 && count(s, 'recycler') < 3) {
    const rc = recyclerCheck(s);
    // no scrap to feed it: another Recycler would stand idle, so this advice is skipped
    if (rc.scrap && !rc.power) return recyclerPower(s, rc);
    if (rc.scrap) {
      return { title: t('hint.partsShort.title'), text: t('hint.partsShort.text', { n: Math.floor(s.res.parts), afford: afford(s, 'recycler') }), build: 'recycler' };
    }
  }

  if (spire && spire.built < 1) {
    return { title: t('hint.spireBuilding.title'), text: t('hint.spireBuilding.text') };
  }

  if (s.pop < 30) {
    return { title: t('hint.grow.title'), text: t('hint.grow.text', { pop: Math.floor(s.pop) }), build: 'pods' };
  }

  return { title: t('hint.good.title'), text: t('hint.good.text') };
}
