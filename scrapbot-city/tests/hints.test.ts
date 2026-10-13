// USA-9's advice aims at the real bottleneck (docs/MODULAR-INC2.md §4b), checked on crafted cities:
// - no storage (Bot Dock) when credits are what is missing: a converter instead;
// - no new Recycler without the power to run it (energy headroom) and scrap to feed it (in storage, waiting, or junk
//   on the map for the bots);
// - a Recycler the player paused is the bottleneck, said for free (not another Recycler, not imported parts);
// - everything else as before.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { placeBuilding, placeCheck } from '../src/game/actions';
import { T } from '../src/game/defs';
import type { BuildingType } from '../src/game/defs';
import { energyGoingUp, energyHeadroom, energySpare, scrapAvailable } from '../src/game/economy';
import { creditsShort, recyclerCheck, suggest } from '../src/game/hints';
import { computeDerived } from '../src/game/sim';
import { createGame } from '../src/game/state';
import type { Building, GameState } from '../src/game/state';
import { t } from '../src/i18n';

afterEach(() => vi.restoreAllMocks());

interface Setup {
  buildings: BuildingType[];
  unfinished?: BuildingType[];
  credits: number;
  parts: number;
  scrap?: number;
  pop?: number;
  junk?: boolean; // keep the map's junk (default: none left)
  alignment?: number;
}

// A city with exactly these buildings (finished unless listed as unfinished), resources and citizens; no sludge.
function city(o: Setup): GameState {
  const s = createGame({ seed: 61, cityName: 'Hints' });
  for (let i = 0; i < s.tiles.length; i++) {
    if (s.tiles[i] === T.SLUDGE || (!o.junk && s.tiles[i] === T.JUNK)) {
      s.tiles[i] = T.GROUND;
      s.amount[i] = 0;
    }
  }
  s.res.credits = 1e6;
  s.res.parts = 1e6;
  const put = (type: BuildingType, done: boolean): Building => {
    const hq = s.buildings[0];
    for (let r = 2; r < 30; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !placeCheck(s, type, hq.x + dx, hq.y + dy).ok) continue;
          const b = placeBuilding(s, type, hq.x + dx, hq.y + dy)!;
          if (done) {
            b.built = 1;
            b.status = 'ok';
          }
          return b;
        }
    throw new Error(`no room for ${type}`);
  };
  for (const type of o.buildings) put(type, true);
  for (const type of o.unfinished ?? []) put(type, false);
  s.alignment = o.alignment ?? 0;
  s.res = { credits: o.credits, parts: o.parts, scrap: o.scrap ?? 0 };
  s.pop = o.pop ?? 0;
  computeDerived(s);
  return s;
}

const POWERED: BuildingType[] = ['solar', 'solar']; // HQ 6 + 10: plenty for the cases below

describe('no storage advice when credits are what is missing', () => {
  it('full storage, two Recyclers, saving for the Spire without the credits: a converter, not a Bot Dock', () => {
    for (const [alignment, conv] of [
      [10, 'fixlab'],
      [-10, 'smelter'],
    ] as const) {
      const s = city({ buildings: ['recycler', 'recycler', 'pods', 'pods', 'pods', 'pods', 'pods', ...POWERED], credits: 300, parts: 60, scrap: 150, pop: 30, alignment });
      expect(creditsShort(s)).toBe(true);
      const h = suggest(s);
      expect(h.title).toBe(t('hint.storageCredits.title'));
      expect(h.build).toBe(conv);
      expect(h.text).toContain('150/150');
    }
  });

  it('full storage, two Recyclers, credits under a Bot Dock price: a converter, not a Bot Dock', () => {
    const s = city({ buildings: ['recycler', 'recycler', 'pods', ...POWERED], credits: 20, parts: 60, scrap: 150, pop: 3 });
    expect(creditsShort(s)).toBe(true);
    expect(suggest(s).build).not.toBe('dock');
    expect(suggest(s).title).toBe(t('hint.storageCredits.title'));
  });

  it('full storage, two Recyclers, credits fine: the Bot Dock advice is still there', () => {
    const s = city({ buildings: ['recycler', 'recycler', 'pods', ...POWERED], credits: 1000, parts: 60, scrap: 150, pop: 3 });
    expect(creditsShort(s)).toBe(false);
    const h = suggest(s);
    expect(h.title).toBe(t('hint.storage.title'));
    expect(h.build).toBe('dock');
  });

  it('"more hands" (a Bot Dock for the junk) is skipped when credits are short, kept otherwise', () => {
    const base = { buildings: ['pods', 'pods', 'recycler', ...POWERED] as BuildingType[], parts: 60, pop: 8, junk: true };
    const rich = city({ ...base, credits: 1000 });
    expect(suggest(rich)).toMatchObject({ title: t('hint.hands.title'), build: 'dock' });
    const poor = city({ ...base, credits: 20 });
    expect(creditsShort(poor)).toBe(true);
    expect(suggest(poor).build).not.toBe('dock');
  });
});

describe('no new Recycler without power to run it and scrap to feed it', () => {
  it('energy headroom counts what is being built: consumers take from it, Solar Arrays add to it', () => {
    const s = city({ buildings: ['pods', 'pods'], unfinished: ['recycler'], credits: 500, parts: 100 });
    expect(energyHeadroom(s)).toBe(6 - 2 - 2);
    const t2 = city({ buildings: ['pods', 'pods'], unfinished: ['recycler', 'pods', 'solar'], credits: 500, parts: 100 });
    expect(energyHeadroom(t2)).toBe(6 - 2 - 2 - 1 + 5);
    // a Burner being built counts when there is scrap to burn (as the sim counts a finished one: only with fuel)
    const t3 = city({ buildings: ['pods', 'pods'], unfinished: ['burner'], credits: 500, parts: 100 });
    expect(energyHeadroom(t3)).toBe(6 - 2);
    const t4 = city({ buildings: ['pods', 'pods'], unfinished: ['burner'], credits: 500, parts: 100, scrap: 10 });
    expect(energyHeadroom(t4)).toBe(6 - 2 + 9);
    const t5 = city({ buildings: ['pods', 'pods'], unfinished: ['burner'], credits: 500, parts: 100, junk: true });
    expect(energyHeadroom(t5)).toBe(6 - 2 + 9);
  });

  it('a Burner already going up with scrap to burn: no "power first" for another Recycler', () => {
    // HQ 6 against Recycler 2 + 3 Pods: 1 to spare now, 10 once the Burner burns (scrap in storage)
    const s = city({ buildings: ['recycler', 'pods', 'pods', 'pods'], unfinished: ['burner'], credits: 300, parts: 60, scrap: 150, pop: 3 });
    expect(s.derived.efficiency).toBe(1);
    expect(recyclerCheck(s).power).toBe(true);
    expect(suggest(s)).toMatchObject({ title: t('hint.storage.title'), build: 'recycler' });
  });

  it('"Power first" names the power to spare the HUD shows, and what the buildings going up will take of it', () => {
    // the advice's text up to "{what}", with these numbers
    const lead = (key: 'hint.recyclerPower.text' | 'hint.recyclerPower.going', p: Record<string, number>) => t(key, { ...p, what: '|', afford: '' }).split('|')[0];
    // HQ 6 against 5 Pods: the HUD shows 6 made, 5 used; 1 to spare, nothing going up
    const tight = city({ buildings: ['pods', 'pods', 'pods', 'pods', 'pods'], credits: 200, parts: 40, junk: true });
    expect([tight.derived.energyProd, tight.derived.energyUse]).toEqual([6, 5]);
    expect(energySpare(tight)).toBe(1);
    expect(energyGoingUp(tight)).toBe(0);
    const h1 = suggest(tight);
    expect(h1.title).toBe(t('hint.recyclerPower.title'));
    expect(h1.text.startsWith(lead('hint.recyclerPower.text', { need: 2, spare: 1 }))).toBe(true);
    // HQ 6 against 3 Pods: the HUD shows 6 made, 3 used, 3 to spare, enough for a Recycler's 2; but 2 more Pods are
    // going up and will use 2 of it: the advice says 3 to spare now (as the HUD) and 2 more to come, not "only 1"
    const going = city({ buildings: ['pods', 'pods', 'pods'], unfinished: ['pods', 'pods'], credits: 200, parts: 40, junk: true });
    expect([going.derived.energyProd, going.derived.energyUse]).toEqual([6, 3]);
    expect([energySpare(going), energyGoingUp(going), energyHeadroom(going)]).toEqual([3, -2, 1]);
    expect(recyclerCheck(going)).toMatchObject({ power: false, now: 3, going: -2, spare: 1 });
    const h2 = suggest(going);
    expect(h2).toMatchObject({ title: t('hint.recyclerPower.title'), build: 'solar' });
    expect(h2.text.startsWith(lead('hint.recyclerPower.going', { need: 2, spare: 3, going: 2 }))).toBe(true);
    expect(h2.text).not.toContain(lead('hint.recyclerPower.text', { need: 2, spare: 1 }));
  });

  it('scrap available: one cycle in storage or waiting, or junk on the map for the bots', () => {
    const none = city({ buildings: ['pods'], credits: 500, parts: 100 });
    expect(scrapAvailable(none)).toBe(false);
    none.res.scrap = 3;
    expect(scrapAvailable(none)).toBe(true);
    none.res.scrap = 0;
    none.scrapPending = 5;
    expect(scrapAvailable(none)).toBe(true);
    const junk = city({ buildings: ['pods'], credits: 500, parts: 100, junk: true });
    expect(scrapAvailable(junk)).toBe(true);
  });

  it('first Recycler: suggested with power and scrap; power first without headroom; never with no scrap anywhere', () => {
    const ok = city({ buildings: ['pods'], credits: 200, parts: 40, junk: true });
    expect(suggest(ok)).toMatchObject({ title: t('hint.parts.title'), build: 'recycler' });
    const noPower = city({ buildings: ['pods', 'pods', 'pods', 'pods', 'pods'], credits: 200, parts: 40, junk: true });
    expect(noPower.derived.efficiency).toBe(1);
    expect(recyclerCheck(noPower)).toMatchObject({ power: false, scrap: true, need: 2, spare: 1 });
    const h = suggest(noPower);
    expect(h).toMatchObject({ title: t('hint.recyclerPower.title'), build: 'solar' });
    expect(h.text).toContain('2');
    const noScrap = city({ buildings: ['pods'], credits: 200, parts: 40 });
    expect(suggest(noScrap)).toMatchObject({ title: t('hint.noScrap.title') });
    expect(suggest(noScrap).build).not.toBe('recycler');
  });

  it('full storage with one Recycler: a second one only with the power for it', () => {
    const ok = city({ buildings: ['recycler', 'pods', ...POWERED], credits: 300, parts: 60, scrap: 150, pop: 3 });
    expect(suggest(ok)).toMatchObject({ title: t('hint.storage.title'), build: 'recycler' });
    // HQ 6 against Recycler 2 + 3 Pods: 1 to spare
    const tight = city({ buildings: ['recycler', 'pods', 'pods', 'pods'], credits: 300, parts: 60, scrap: 150, pop: 3 });
    expect(tight.derived.efficiency).toBe(1);
    expect(suggest(tight)).toMatchObject({ title: t('hint.recyclerPower.title'), build: 'solar' });
    // leaning industrial and unable to pay a Solar Array: a Burner
    const ind = city({ buildings: ['recycler', 'pods', 'pods', 'pods'], credits: 35, parts: 10, scrap: 150, pop: 3, alignment: -20 });
    expect(suggest(ind).build).toBe('burner');
  });

  it('parts short: another Recycler only with scrap to feed it and power to run it', () => {
    const base = { buildings: ['recycler', 'pods', ...POWERED] as BuildingType[], credits: 100, parts: 10, pop: 2 };
    expect(suggest(city({ ...base, junk: true }))).toMatchObject({ title: t('hint.partsShort.title'), build: 'recycler' });
    // no scrap anywhere: the advice moves on (a Recycler would stand idle)
    const dry = suggest(city(base));
    expect(dry.build).not.toBe('recycler');
    expect(dry.title).toBe(t('hint.grow.title'));
    // scrap but no power to spare (HQ 6 + Solar 5 against Recycler 2 + Pods 1 + two Factories 8): power first
    const tight = city({ ...base, buildings: ['recycler', 'pods', 'solar', 'factory', 'factory'], junk: true });
    expect(tight.derived.efficiency).toBe(1);
    expect(suggest(tight)).toMatchObject({ title: t('hint.recyclerPower.title'), build: 'solar' });
  });

  it('saving for the Spire: "another Recycler" is only added when there is power for it', () => {
    const pods: BuildingType[] = ['pods', 'pods', 'pods', 'pods', 'pods'];
    const ok = city({ buildings: ['recycler', ...pods, ...POWERED], credits: 500, parts: 200, scrap: 150, pop: 30 });
    expect(suggest(ok).title).toBe(t('hint.spireSave.title'));
    expect(suggest(ok).text).toContain(t('hint.storage.recycler'));
    // HQ 6 + one Solar Array 5 against Recycler 2 + 5 Pods + Dock: 2 short of a new Recycler's 2
    const tight = city({ buildings: ['recycler', ...pods, 'solar', 'dock', 'dock', 'dock'], credits: 500, parts: 200, scrap: 380, pop: 30 });
    expect(tight.derived.efficiency).toBe(1);
    expect(recyclerCheck(tight).power).toBe(false);
    expect(suggest(tight).title).toBe(t('hint.spireSave.title'));
    expect(suggest(tight).text).not.toContain(t('hint.storage.recycler'));
  });
});

describe('everything else is as before', () => {
  it('smog emergency, no pods, no power plant, a full town and a power shortage keep their advice', () => {
    const smog = city({ buildings: ['recycler', 'smelter', ...POWERED], credits: 300, parts: 60 });
    smog.pollution = 85;
    expect(suggest(smog)).toMatchObject({ title: t('hint.smogEmergency.title'), build: 'purifier' });
    const noPods = city({ buildings: ['recycler'], credits: 300, parts: 60, junk: true });
    expect(suggest(noPods)).toMatchObject({ title: t('hint.pods.title'), build: 'pods' });
    const noPlant = city({ buildings: ['recycler', 'pods'], credits: 300, parts: 60, junk: true });
    expect(suggest(noPlant)).toMatchObject({ title: t('hint.addPower.title'), build: 'solar' });
    const full = city({ buildings: ['recycler', 'pods', 'garden', 'fixlab', ...POWERED], credits: 300, parts: 60, pop: 6, junk: true });
    expect(suggest(full)).toMatchObject({ title: t('hint.full.title'), build: 'pods' });
    // the power hint still comes first when the city already runs short
    const short = city({ buildings: ['recycler', 'recycler', 'factory', 'pods'], credits: 300, parts: 60 });
    expect(short.derived.efficiency).toBeLessThan(1);
    expect(suggest(short).title).toBe(t('hint.power.title'));
  });
});

describe('a paused Recycler', () => {
  const base = { buildings: ['recycler', 'solar', 'pods', 'dock'] as BuildingType[], parts: 10, scrap: 80, pop: 3, junk: true };
  const paused = (o: Partial<Setup> = {}) => {
    const s = city({ ...base, credits: 300, ...o });
    for (const b of s.buildings) if (b.type === 'recycler') b.paused = true;
    computeDerived(s);
    return s;
  };

  it('every Recycler paused and parts short: resume it, for free (not another Recycler, not imported parts)', () => {
    for (const credits of [300, 600]) {
      const hint = suggest(paused({ credits }));
      expect(hint, `${credits} credits`).toMatchObject({ title: t('hint.recyclerPaused.title'), free: true });
      expect(hint.build).toBeUndefined();
      expect(hint.text).toContain(t('insp.resume'));
    }
    // two Recyclers, one still running: the advice is as before
    const one = city({ ...base, buildings: ['recycler', 'recycler', 'solar', 'solar', 'pods', 'dock'], credits: 300 });
    one.buildings.find((b) => b.type === 'recycler')!.paused = true;
    expect(suggest(one).title).not.toBe(t('hint.recyclerPaused.title'));
  });

  it('a Recycler running, or paused on a pile of parts: the advice is as before', () => {
    expect(suggest(city({ ...base, credits: 300 })).title).not.toBe(t('hint.recyclerPaused.title'));
    expect(suggest(city({ ...base, credits: 600 })).title).toBe(t('hint.import.title'));
    expect(suggest(paused({ parts: 200 })).title).not.toBe(t('hint.recyclerPaused.title'));
  });
});
