// USA-9's advice: reads the city and recommends the single most useful next step.
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

const count = (s: GameState, t: BuildingType) => s.buildings.filter((b) => b.type === t).length;
const has = (s: GameState, t: BuildingType) => count(s, t) > 0;

function afford(s: GameState, t: BuildingType): string {
  const cost = buildCost(s, t);
  return canAfford(s, cost) ? `You can afford it right now (${costText(cost)}).` : `It costs ${costText(cost)}: save up a little first.`;
}

export function suggest(s: GameState): Hint {
  const d = s.derived;
  const leansGreen = s.alignment >= 0;
  const industry = s.buildings.filter((b) => BUILDINGS[b.type].path === 'industrial' && !b.paused);
  const sludge = s.tiles.reduce((n, t) => n + (t === T.SLUDGE ? 1 : 0), 0);
  let junk = 0;
  for (let i = 0; i < s.tiles.length; i++) if (s.tiles[i] === T.JUNK) junk += s.amount[i];

  if (s.pollution >= SMOG_DANGER - 15) {
    if (industry.length > 0) {
      return {
        title: 'Smog emergency!',
        text: `Smog is at ${Math.round(s.pollution)}%. Select your Smelters, Burners or Factories and press "Pause production" until the air clears. A Purifier helps for good.`,
        build: 'purifier',
      };
    }
    return { title: 'Clear the air', text: `Smog is at ${Math.round(s.pollution)}%. Build a Purifier and a few Pixel Gardens. ${afford(s, 'purifier')}`, build: 'purifier' };
  }

  if (!has(s, 'recycler')) {
    return { title: 'Make parts first', text: `Almost everything needs parts, and only a Recycler makes them from scrap. ${afford(s, 'recycler')}`, build: 'recycler' };
  }

  if (d.efficiency < 1) {
    const solarOk = canAfford(s, buildCost(s, 'solar'));
    const pick: BuildingType = leansGreen || solarOk ? 'solar' : 'burner';
    return {
      title: 'Not enough power',
      text: `Your machines need ${d.energyUse} energy but you make ${d.energyProd}, so everything runs slower. ${pick === 'solar' ? 'A Solar Array adds 5 clean energy.' : 'A Scrap Burner adds 9 energy, but it burns scrap and smokes.'} ${afford(s, pick)}`,
      build: pick,
    };
  }

  if (s.res.scrap >= d.storage * 0.9) {
    const pick: BuildingType = count(s, 'recycler') <= 1 ? 'recycler' : 'dock';
    return {
      title: 'Storage is full',
      text: `Your bots are waiting with full arms: scrap storage is ${Math.floor(s.res.scrap)}/${d.storage}. ${pick === 'recycler' ? 'Another Recycler turns it into parts faster.' : 'A Bot Dock adds storage and two more bots.'}`,
      build: pick,
    };
  }

  if (!has(s, 'pods')) {
    return { title: 'Bring in citizens', text: `Bot Pods house 6 citizens. They pay taxes every second, and their trash becomes your scrap. ${afford(s, 'pods')}`, build: 'pods' };
  }

  if (d.happiness < 40) {
    return {
      title: 'Citizens are unhappy',
      text: `Happiness is ${Math.round(d.happiness)}%. Below 35% nobody moves in, below 25% people leave. Pixel Gardens are the cheapest fix; lowering the smog helps the most.`,
      build: 'garden',
    };
  }

  if (s.pop >= d.housing - 1) {
    return { title: 'The pods are full', text: `${Math.floor(s.pop)} citizens, ${d.housing} homes. More Bot Pods means more taxes. ${afford(s, 'pods')}`, build: 'pods' };
  }

  if (sludge > 0 && !has(s, 'purifier') && s.res.credits >= 60) {
    return { title: 'Toxic sludge', text: `${sludge} tiles of sludge keep pushing the smog up and block building. A Purifier cleans every pool within 5 tiles. ${afford(s, 'purifier')}`, build: 'purifier' };
  }

  if (!has(s, 'fixlab') && !has(s, 'smelter') && !has(s, 'factory')) {
    const pick: BuildingType = leansGreen ? 'fixlab' : 'smelter';
    return {
      title: 'Make money',
      text:
        pick === 'fixlab'
          ? `Taxes alone are slow. A Fix-It Lab turns parts into credits without any smoke. ${afford(s, 'fixlab')}`
          : `Taxes alone are slow. A Smelter turns scrap straight into credits, with some smoke. ${afford(s, 'smelter')}`,
      build: pick,
    };
  }

  if (junk > 300 && s.bots.length < 5 + s.pop / 4) {
    return { title: 'More hands', text: `There are about ${junk} scrap lying around and only ${s.bots.length} bots. A Bot Dock adds two bots and extra storage. ${afford(s, 'dock')}`, build: 'dock' };
  }

  if (s.res.parts < 25 && count(s, 'recycler') < 3) {
    return { title: 'Parts are short', text: `Only ${Math.floor(s.res.parts)} parts left. Another Recycler keeps construction going. ${afford(s, 'recycler')}`, build: 'recycler' };
  }

  const spire = s.buildings.find((b) => b.type === 'spire');
  if (!spire && s.pop >= 30) {
    const cost = buildCost(s, 'spire');
    const needCredits = Math.max(0, (cost.credits ?? 0) - Math.floor(s.res.credits));
    const needParts = Math.max(0, (cost.parts ?? 0) - Math.floor(s.res.parts));
    if (needCredits === 0 && needParts === 0) {
      return { title: 'Build the Scrap Spire!', text: 'You have everything you need. The Spire takes 90 seconds and needs steady power. Where will your choices take this city?', build: 'spire' };
    }
    return {
      title: 'Save up for the Spire',
      text: `You still need ${needCredits} credits and ${needParts} parts. Stop building extras for a while and let the money pile up.`,
    };
  }

  if (spire && spire.built < 1) {
    return { title: 'Keep the lights on', text: 'The Spire is going up. It builds slower without enough energy, so keep power above what you use.' };
  }

  if (s.pop < 30) {
    return { title: 'Grow the city', text: `The Spire needs 30 citizens and you have ${Math.floor(s.pop)}. Add Bot Pods, keep people happy with gardens, and keep the smog low.`, build: 'pods' };
  }

  return { title: 'Looking good, boss', text: 'Your city runs smoothly. Work on the star goals of this city, or try a different path next time.' };
}
