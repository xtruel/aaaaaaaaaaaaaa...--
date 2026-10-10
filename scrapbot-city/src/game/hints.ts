// USA-9's advice: reads the city and recommends the single most useful next step.
import { t } from '../i18n';
import { buildCost, canAfford, costText } from './actions';
import { BUILDINGS, SMOG_DANGER, T } from './defs';
import type { BuildingType } from './defs';
import { FREE_HINTS } from './state';
import type { GameState } from './state';

export interface Hint {
  title: string;
  text: string;
  build?: BuildingType;
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
  return canAfford(s, cost) ? t('hint.afford.yes', { cost: costText(cost) }) : t('hint.afford.no', { cost: costText(cost) });
}

export function suggest(s: GameState): Hint {
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

  if (!has(s, 'recycler')) {
    return { title: t('hint.parts.title'), text: t('hint.parts.text', { afford: afford(s, 'recycler') }), build: 'recycler' };
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

  if (s.res.scrap >= d.storage * 0.9) {
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

  if (d.happiness < 40) {
    return { title: t('hint.happy.title'), text: t('hint.happy.text', { n: Math.round(d.happiness) }), build: 'garden' };
  }

  if (s.pop >= d.housing - 1) {
    return {
      title: t('hint.full.title'),
      text: t('hint.full.text', { pop: Math.floor(s.pop), homes: d.housing, afford: afford(s, 'pods') }),
      build: 'pods',
    };
  }

  if (sludge > 0 && !has(s, 'purifier') && s.res.credits >= 60) {
    return { title: t('hint.sludge.title'), text: t('hint.sludge.text', { n: sludge, afford: afford(s, 'purifier') }), build: 'purifier' };
  }

  if (!has(s, 'fixlab') && !has(s, 'smelter') && !has(s, 'factory')) {
    const pick: BuildingType = leansGreen ? 'fixlab' : 'smelter';
    return {
      title: t('hint.money.title'),
      text: pick === 'fixlab' ? t('hint.money.fixlab', { afford: afford(s, 'fixlab') }) : t('hint.money.smelter', { afford: afford(s, 'smelter') }),
      build: pick,
    };
  }

  if (junk > 300 && s.bots.length < 5 + s.pop / 4) {
    return { title: t('hint.hands.title'), text: t('hint.hands.text', { junk, bots: s.bots.length, afford: afford(s, 'dock') }), build: 'dock' };
  }

  if (s.res.parts < 25 && count(s, 'recycler') < 3) {
    return { title: t('hint.partsShort.title'), text: t('hint.partsShort.text', { n: Math.floor(s.res.parts), afford: afford(s, 'recycler') }), build: 'recycler' };
  }

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
    return { title: t('hint.spireSave.title'), text: t('hint.spireSave.text', { cost: costText(missing) }) };
  }

  if (spire && spire.built < 1) {
    return { title: t('hint.spireBuilding.title'), text: t('hint.spireBuilding.text') };
  }

  if (s.pop < 30) {
    return { title: t('hint.grow.title'), text: t('hint.grow.text', { pop: Math.floor(s.pop) }), build: 'pods' };
  }

  return { title: t('hint.good.title'), text: t('hint.good.text') };
}
