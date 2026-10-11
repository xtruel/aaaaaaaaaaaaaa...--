// @vitest-environment jsdom
// Increment 2, group G1 (docs/MODULAR-INC2.md §2 and §4b), the interface side: the building panel reads every number
// from the sim (buildingStats at full power, effectiveStats now, statusInfo for the cause) and writes nothing of its
// own; the cause of a building's state in distinct words; the module slot (the Recycler's alternatives) with its
// states, before -> after and the values now; what a removal or a demolition takes with it; "+N waiting" next to the
// scrap.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { placeBuilding, placeCheck } from '../src/game/actions';
import { BUILDINGS, MAP_H, MAP_W, SIM_STEP, T } from '../src/game/defs';
import type { BuildingType, Resource } from '../src/game/defs';
import { effectiveStats, statusInfo } from '../src/game/economy';
import type { StatusCause } from '../src/game/economy';
import { buildingStats, installModule } from '../src/game/pieces';
import type { ModuleKind } from '../src/game/pieces';
import { CLEAN_EVERY, computeDerived, step } from '../src/game/sim';
import { createGame } from '../src/game/state';
import type { Building, GameState } from '../src/game/state';
import { OBJECTIVES } from '../src/game/story';
import { LANGS, setLang, t } from '../src/i18n';
import {
  buildingDesc,
  buildingRows,
  catalogEffect,
  homesLost,
  moduleHousingDrop,
  moduleLabel,
  moduleRows,
  moduleRowsOn,
  moduleState,
  overtimeLeft,
  powerShortAfter,
  slotModules,
  statusLine,
} from '../src/ui/catalog';
import { Hud } from '../src/ui/hud';
import type { HudHandlers, HudView } from '../src/ui/hud';

vi.mock('../src/render/icons', () => ({ iconUrl: (name: string) => `icon:${name}`, toolThumb: () => '', portraitUrl: () => '', pathColor: () => 'var(--muted)' }));
vi.mock('../src/render/iso/atlas', () => ({ atlasImage: () => null, frame: () => undefined }));
vi.mock('../src/render/sprites', () => ({
  PAL: { ink: '#000', orange: '#f80', white: '#fff' },
  makeCanvas: () => [{ toDataURL: () => 'data:,' }, { fillRect: () => {}, drawImage: () => {}, fillStyle: '' }],
}));
vi.mock('../src/audio', () => ({ audio: { play: () => {} } }));

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView = () => {};
});

// A quiet, rich city: no events or storms, no goal rewards, no junk, sludge or rubble.
function lab(seed = 91): GameState {
  const s = createGame({ seed, cityName: 'Panel' });
  s.nextEventAt = 1e12;
  s.nextStormAt = 1e12;
  s.objective = OBJECTIVES.length;
  s.res.credits = 1e5;
  s.res.parts = 1e4;
  s.res.scrap = 0;
  for (let i = 0; i < s.tiles.length; i++) {
    if (s.tiles[i] === T.JUNK || s.tiles[i] === T.SLUDGE || s.tiles[i] === T.RUBBLE) {
      s.tiles[i] = T.GROUND;
      s.amount[i] = 0;
    }
  }
  computeDerived(s);
  return s;
}

function build(s: GameState, type: BuildingType, done = true): Building {
  const hq = s.buildings.find((b) => b.type === 'hq')!;
  for (let r = 2; r < 30; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = hq.x + dx;
        const y = hq.y + dy;
        if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H || !placeCheck(s, type, x, y).ok) continue;
        const b = placeBuilding(s, type, x, y)!;
        if (done) {
          b.built = 1;
          b.status = 'ok';
        }
        computeDerived(s);
        return b;
      }
  throw new Error(`no room for ${type}`);
}

// The panel's formats, written out here to compare the panel with the sim's own numbers.
const signed = (n: number) => `${n > 0 ? '+' : ''}${n}`;
const perDay = (p: number) => `${p > 0 ? '+' : ''}${(p * 60).toFixed(1)}`;
const tenth = (n: number) => `${Math.round(n * 10) / 10}`;
const perMin = (ps: number) => {
  const n = ps * 60;
  return `${n >= 10 ? Math.round(n) : Math.round(n * 10) / 10}`;
};

// Every number of every building's rows against buildingStats (nominal) and effectiveStats (now).
function expectRowsFromSim(s: GameState): number {
  let checked = 0;
  for (const b of s.buildings) {
    const st = buildingStats(b);
    const eff = effectiveStats(s, b);
    const cause = statusInfo(s, b).cause;
    const waiting = cause === 'noInput' || cause === 'reserve';
    const rows = new Map(buildingRows(s, b).map((r) => [r.key, r]));
    const at = (key: string) => {
      const r = rows.get(key);
      expect(r, `${b.type} ${key}`).toBeDefined();
      checked++;
      return r!;
    };
    if (st.energy) expect([at('energy').nominal, at('energy').now]).toEqual([signed(st.energy), signed(eff.energy)]);
    if (st.pollution) expect([at('smog').nominal, at('smog').now]).toEqual([perDay(st.pollution), perDay(eff.pollution)]);
    if (st.cycle > 0) {
      const now = !Number.isFinite(eff.cycle) ? t('insp.stopped') : waiting ? t('insp.waiting') : tenth(eff.cycle);
      expect([at('cycle').nominal, at('cycle').now]).toEqual([tenth(st.cycle), now]);
      for (const r of Object.keys(st.output) as Resource[]) {
        const row = at(`made.${r}`);
        expect([row.nominal, row.now]).toEqual([perMin((st.output[r] ?? 0) / st.cycle), waiting ? '0' : perMin(eff.outputPerSecond[r] ?? 0)]);
      }
      for (const r of Object.keys(st.input) as Resource[]) {
        const row = at(`used.${r}`);
        expect([row.nominal, row.now]).toEqual([perMin((st.input[r] ?? 0) / st.cycle), waiting ? '0' : perMin(eff.inputPerSecond[r] ?? 0)]);
      }
    }
    if (st.housing) expect([at('homes').nominal, at('homes').now]).toEqual([`${st.housing}`, `${eff.housing}`]);
    // storage with its unit, as the panel always wrote it ("180 scrap")
    if (st.storage) expect([at('storage').nominal, at('storage').now]).toEqual([t('cost.scrap', { n: st.storage }), t('cost.scrap', { n: eff.storage })]);
    if (st.cleanRadius) {
      expect(at('radius').nominal).toBe(`${st.cleanRadius}`);
      expect(at('clean').now).toBe(Number.isFinite(eff.cleanEvery) ? tenth(eff.cleanEvery) : t('insp.stopped'));
    }
  }
  return checked;
}

const BUILDING_OF: Record<ModuleKind, BuildingType> = {
  dockStorage: 'dock',
  smelterFilter: 'smelter',
  recyclerMagnet: 'recycler',
  recyclerSorter: 'recycler',
  factoryArm: 'factory',
  podsCapsule: 'pods',
  solarTracker: 'solar',
  purifierNozzle: 'purifier',
};

describe('the building panel reads the sim', () => {
  it('every row of every building: nominal = buildingStats, now = effectiveStats (full power, shortage, overtime, pause, waiting)', () => {
    const s = lab();
    const types: BuildingType[] = ['recycler', 'recycler', 'factory', 'factory', 'pods', 'solar', 'purifier', 'smelter', 'burner', 'fixlab', 'dock', 'garden'];
    const bs = types.map((type) => build(s, type));
    installModule(s, 'recyclerMagnet', bs[0]);
    installModule(s, 'recyclerSorter', bs[1]);
    installModule(s, 'factoryArm', bs[2]);
    installModule(s, 'podsCapsule', bs[4]);
    installModule(s, 'solarTracker', bs[5]);
    installModule(s, 'purifierNozzle', bs[6]);
    installModule(s, 'smelterFilter', bs[7]);
    s.res.scrap = 140;
    step(s, SIM_STEP);
    expect(s.derived.efficiency).toBeLessThan(1); // a shortage: consumers slowed down
    expect(expectRowsFromSim(s)).toBeGreaterThan(40);
    s.overtimeUntil = s.time + 30;
    step(s, SIM_STEP);
    expectRowsFromSim(s);
    bs[0].paused = true;
    bs[2].paused = true;
    step(s, SIM_STEP);
    expectRowsFromSim(s);
    s.res.scrap = 0;
    step(s, SIM_STEP);
    expect(bs[1].status).toBe('noInput');
    expectRowsFromSim(s);
    // enough power for everything: now = nominal
    for (let k = 0; k < 8; k++) build(s, 'solar');
    s.overtimeUntil = 0;
    s.res.scrap = 140;
    step(s, SIM_STEP);
    expect(s.derived.efficiency).toBe(1);
    expectRowsFromSim(s);
  });

  it('the parts a minute shown now are what the magnet Recycler makes in the next minute, at 80% power', () => {
    const s = lab();
    const rec = build(s, 'recycler');
    installModule(s, 'recyclerMagnet', rec);
    // consumers so that the HQ's 6 energy cover about 80% of the demand: 4 (magnet Recycler) + 3 Docks
    for (let k = 0; k < 3; k++) build(s, 'dock');
    s.res.scrap = 140;
    step(s, SIM_STEP);
    const eff = s.derived.efficiency;
    expect(eff).toBeGreaterThan(0.5);
    expect(eff).toBeLessThan(1);
    const shown = Number(buildingRows(s, rec).find((r) => r.key === 'made.parts')!.now);
    const before = s.stats.partsMade;
    for (let k = 0; k < Math.round(60 / SIM_STEP); k++) {
      s.res.scrap = 140; // plenty: the Recycler never waits for scrap
      step(s, SIM_STEP);
    }
    const made = s.stats.partsMade - before;
    // a cycle makes 2 parts: what a minute makes is the shown rate, give or take the cycle running at the edges
    expect(Math.abs(made - shown)).toBeLessThanOrEqual(2);
    expect(shown).toBeLessThan(80); // nominal 80 a minute at full power
  });

  it('module rows before -> after are the declared numbers, and an installed module shows its values now', () => {
    const want: Record<ModuleKind, Record<string, [string, string]>> = {
      dockStorage: { storage: ['80', '180'] },
      smelterFilter: { smog: ['+2.1', '+0.8'], energy: ['-2', '-3'] },
      recyclerMagnet: { cycle: ['2', '1.5'], 'made.parts': ['60', '80'], 'used.scrap': ['90', '120'], energy: ['-2', '-4'] },
      recyclerSorter: { 'output.parts': ['2', '3'], cycle: ['2', '3'], 'made.parts': ['60', '60'], 'used.scrap': ['90', '60'] },
      factoryArm: { cycle: ['3', '2'], 'made.credits': ['600', '900'], 'used.parts': ['40', '60'], smog: ['+3.6', '+5.4'], energy: ['-4', '-6'] },
      podsCapsule: { homes: ['6', '9'], energy: ['-1', '-2'] },
      solarTracker: { energy: ['+5', '+7'] },
      purifierNozzle: { radius: ['5', '8'], energy: ['-3', '-4'] },
    };
    for (const [kind, rows] of Object.entries(want) as [ModuleKind, Record<string, [string, string]>][]) {
      const got = Object.fromEntries(moduleRows(BUILDING_OF[kind], kind).map((r) => [r.res ? `${r.stat}.${r.res}` : r.stat, [r.before, r.after]]));
      expect(got, kind).toEqual(rows);
      expect(catalogEffect(kind), kind).not.toMatch(/\{|mod\./);
    }
    // installed: the values now come from effectiveStats (here a power shortage slows the armed Factory)
    const s = lab();
    const f = build(s, 'factory');
    installModule(s, 'factoryArm', f);
    build(s, 'pods');
    s.res.parts = 1e4;
    step(s, SIM_STEP);
    const eff = effectiveStats(s, f);
    expect(s.derived.efficiency).toBeLessThan(1);
    const on = Object.fromEntries(moduleRowsOn(s, f, 'factoryArm').map((r) => [r.res ? `${r.stat}.${r.res}` : r.stat, r.now]));
    expect(on).toEqual({ cycle: tenth(eff.cycle), 'made.credits': perMin(eff.outputPerSecond.credits!), 'used.parts': perMin(eff.inputPerSecond.parts!), smog: perDay(eff.pollution), energy: '-6' });
    // not installed: no values now
    expect(moduleRowsOn(s, build(s, 'recycler'), 'recyclerMagnet').every((r) => r.now === undefined)).toBe(true);
  });

  it('the map label says the effect in the map font: cycle in seconds, radius in tiles, no arrows', () => {
    const s = lab();
    expect(moduleLabel(build(s, 'recycler'), 'recyclerMagnet')).toBe('Cycle 2 -> 1.5 s, Energy -2 -> -4');
    expect(moduleLabel(build(s, 'purifier'), 'purifierNozzle')).toBe('Radius: 5 -> 8 tiles, Energy -3 -> -4');
    expect(moduleLabel(build(s, 'pods'), 'podsCapsule')).toBe('Homes 6 -> 9, Energy -1 -> -2');
    expect(moduleLabel(build(s, 'factory'), 'factoryArm')).toBe('Cycle 3 -> 2 s, Smog +3.6 -> +5.4, Energy -4 -> -6');
  });
});

// A city with one building in each of the eight states, for the cause words.
function causes(): Record<StatusCause, () => { s: GameState; b: Building }> {
  const one = (type: BuildingType, set: (s: GameState, b: Building) => void, done = true) => () => {
    const s = lab();
    const b = build(s, type, done);
    set(s, b);
    step(s, SIM_STEP);
    return { s, b };
  };
  return {
    building: one('recycler', () => {}, false),
    paused: one('recycler', (_s, b) => (b.paused = true)),
    noPower: one('recycler', (s) => s.buildings.filter((o) => o.type === 'hq').forEach((o) => (o.built = 0.5))),
    lowPower: one('recycler', (s) => {
      s.res.scrap = 140;
      for (let k = 0; k < 5; k++) build(s, 'dock');
    }),
    noInput: one('recycler', (s) => (s.res.scrap = 0)),
    reserve: one('factory', (s) => (s.res.parts = 21)),
    noFuel: one('burner', (s) => (s.res.scrap = 0)),
    ok: one('recycler', (s) => (s.res.scrap = 140)),
  };
}

describe('why a building is in its state, in words', () => {
  it('eight causes, eight different sentences and icons, in every language', () => {
    const made = Object.entries(causes()).map(([cause, f]) => [cause, f()] as const);
    for (const [cause, { s, b }] of made) expect(statusInfo(s, b).cause, cause).toBe(cause);
    for (const { id } of LANGS) {
      setLang(id);
      const lines = made.map(([, { s, b }]) => statusLine(s, b));
      expect(new Set(lines.map((l) => l.text)).size, id).toBe(8);
      for (const l of lines) expect(l.text, `${id} ${l.cause}`).not.toMatch(/^cause\.|\{/);
      expect(new Set(lines.map((l) => l.icon)).size, id).toBe(8);
    }
    setLang('en');
    const text = Object.fromEntries(made.map(([cause, { s, b }]) => [cause, statusLine(s, b).text]));
    expect(text.paused).toBe('Paused by you');
    expect(text.noPower).toBe('Stopped: not enough energy');
    expect(text.noInput).toBe('Missing materials: 3 scrap');
    expect(text.reserve).toMatch(/^Waiting: \d+ parts kept for building$/);
    expect(text.lowPower).toMatch(/^Slowed down: low energy \(\d+% power\)$/);
    expect(text.building).toMatch(/^Under construction: \d+ s left$/);
    expect(text.ok).toBe('Working normally');
  });

  it('overtime: how long it still speeds up a process or industry smog, nothing for a home or a paused building', () => {
    const s = lab();
    const f = build(s, 'factory');
    const p = build(s, 'pods');
    s.overtimeUntil = s.time + 42.3;
    expect(overtimeLeft(s, f)).toBe(43);
    expect(overtimeLeft(s, p)).toBe(0);
    // a paused Factory: overtime does nothing for it, the panel does not say it does
    f.paused = true;
    expect(overtimeLeft(s, f)).toBe(0);
    f.paused = false;
    s.overtimeUntil = 0;
    expect(overtimeLeft(s, f)).toBe(0);
  });
});

describe('the module slot', () => {
  it('the Recycler: installed / slot taken by the other / can be installed / cannot now (why)', () => {
    const s = lab();
    const a = build(s, 'recycler');
    expect(slotModules('recycler')).toEqual(['recyclerMagnet', 'recyclerSorter']);
    expect(moduleState(s, a, 'recyclerMagnet')).toEqual({ state: 'available' });
    installModule(s, 'recyclerMagnet', a);
    expect(moduleState(s, a, 'recyclerMagnet')).toEqual({ state: 'installed' });
    expect(moduleState(s, a, 'recyclerSorter')).toEqual({ state: 'slotTaken', reason: 'Slot taken by Magnetic separator: remove it first' });
    const b = build(s, 'recycler');
    const unfinished = build(s, 'recycler', false);
    s.res.credits = 30;
    expect(moduleState(s, b, 'recyclerSorter')).toEqual({ state: 'cantBuy', reason: 'Missing 10 credits' });
    expect(moduleState(s, unfinished, 'recyclerSorter')).toEqual({ state: 'cantBuy', reason: 'Only on a finished Recycler' });
  });

  it('what a removal takes with it: citizens above the homes left, and power that would fall short', () => {
    const s = lab();
    const pods = build(s, 'pods');
    installModule(s, 'podsCapsule', pods);
    s.pop = 9;
    expect(moduleHousingDrop(pods, 'podsCapsule')).toBe(3);
    expect(homesLost(s, moduleHousingDrop(pods, 'podsCapsule'))).toBe(3);
    s.pop = 6.5;
    expect(homesLost(s, 3)).toBe(0);
    // the tracking panels carry the city: taking them off leaves it short
    const sol = build(s, 'solar');
    installModule(s, 'solarTracker', sol);
    for (let k = 0; k < 5; k++) build(s, 'dock');
    computeDerived(s);
    expect(s.derived.energyProd).toBe(13);
    expect(s.derived.energyUse).toBe(7);
    expect(powerShortAfter(s, sol, [])).toBeNull(); // 11 for 7: still fine
    build(s, 'factory');
    computeDerived(s);
    expect(s.derived.energyUse).toBe(11);
    expect(powerShortAfter(s, sol, [])).toBeNull(); // 11 for 11: still covered
    build(s, 'dock');
    computeDerived(s);
    expect(powerShortAfter(s, sol, [])).toEqual({ prod: 11, use: 12 });
    expect(powerShortAfter(s, sol, null)).toEqual({ prod: 6, use: 12 }); // demolished
    // installing the magnet on a Recycler would draw 2 more
    const rec = build(s, 'recycler');
    computeDerived(s);
    expect(s.derived.energyProd).toBeLessThan(s.derived.energyUse);
    expect(powerShortAfter(s, rec, ['recyclerMagnet'])).toBeNull(); // already short: nothing new to warn about
  });
});

function hud(s: GameState) {
  document.body.innerHTML = '<div class="hud"></div>';
  const calls: unknown[][] = [];
  const handlers = new Proxy({}, { get: (_t, name) => (...args: unknown[]) => calls.push([name, ...args]) }) as unknown as HudHandlers;
  const root = document.querySelector<HTMLElement>('.hud')!;
  const h = new Hud(root, handlers, s);
  const view: HudView = { speed: 1, build: null, bulldoze: false, selectedId: -1, goalCard: true, piece: null, catalog: false, selectedPiece: -1 };
  const update = (v: Partial<HudView> = {}) => h.update(s, { ...view, ...v });
  return { root, calls, update };
}

describe('the panel in the HUD', () => {
  it('the cause in words with its icon, and the values now, follow the city in place (no rebuild, no lost click)', () => {
    const s = lab();
    const rec = build(s, 'recycler');
    s.res.scrap = 140;
    step(s, SIM_STEP);
    const { root, update } = hud(s);
    update({ selectedId: rec.id });
    const insp = root.querySelector<HTMLElement>('[data-inspector]')!;
    const status = insp.querySelector<HTMLElement>('[data-status]')!;
    expect(status.textContent).toBe('Working normally');
    expect(status.querySelector('img')!.getAttribute('src')).toBe('icon:play');
    const now = insp.querySelector<HTMLElement>('[data-now="made.parts"]')!;
    expect(now.textContent).toBe('60');
    const pause = insp.querySelector('[data-pause]');
    // a power shortage: same elements, new words and numbers
    for (let k = 0; k < 5; k++) build(s, 'dock');
    s.res.scrap = 140;
    step(s, SIM_STEP);
    update({ selectedId: rec.id });
    expect(insp.querySelector('[data-pause]')).toBe(pause);
    expect(insp.querySelector('[data-now="made.parts"]')).toBe(now);
    expect(now.textContent).toBe(buildingRows(s, rec).find((r) => r.key === 'made.parts')!.now);
    expect(Number(now.textContent)).toBeLessThan(60);
    expect(status.textContent).toMatch(/^Slowed down: low energy/);
    expect(status.className).toContain('cause-lowPower');
    expect(status.querySelector('img')!.getAttribute('src')).toBe('icon:energy');
    // out of scrap: which material is missing
    s.res.scrap = 0;
    step(s, SIM_STEP);
    update({ selectedId: rec.id });
    expect(status.textContent).toBe('Missing materials: 3 scrap');
    expect(insp.querySelector('[data-now="cycle"]')!.textContent).toBe('waiting');
    // overtime: the note says how long
    s.overtimeUntil = s.time + 20;
    update({ selectedId: rec.id });
    const ot = insp.querySelector<HTMLElement>('[data-overtime]')!;
    expect(ot.hidden).toBe(false);
    expect(ot.textContent).toBe('Overtime: production and smog ×1.5 for 20 s more, on top of any module.');
  });

  it('the Recycler slot: both modules with their state in words; the sorter greyed out while the magnet holds the slot', () => {
    const s = lab();
    const rec = build(s, 'recycler');
    installModule(s, 'recyclerMagnet', rec);
    const { root, update } = hud(s);
    update({ selectedId: rec.id });
    const insp = root.querySelector<HTMLElement>('[data-inspector]')!;
    expect(insp.querySelector('.mod-slot')!.textContent).toBe('One slot: one of these two modules at a time.');
    const magnet = insp.querySelector<HTMLElement>('[data-mod="recyclerMagnet"]')!;
    const sorter = insp.querySelector<HTMLElement>('[data-mod="recyclerSorter"]')!;
    expect(magnet.querySelector('[data-mod-state]')!.textContent).toBe('Installed');
    expect(magnet.querySelector('[data-remove]')!.textContent).toBe('Remove (+20 credits + 7 parts)');
    // installed: before -> after at full power, and now
    expect(magnet.querySelector('[data-mod-now="cycle"]')!.textContent).toBe(tenth(effectiveStats(s, rec).cycle));
    expect(sorter.querySelector('[data-mod-state]')!.textContent).toBe('Slot taken');
    expect(sorter.querySelector<HTMLButtonElement>('[data-install]')!.disabled).toBe(true);
    expect(sorter.querySelector('.cat-reason')!.textContent).toBe('Slot taken by Magnetic separator: remove it first');
    expect(sorter.querySelector('.mod-price')!.textContent).toBe('Costs 40 credits + 15 parts · refund 20 credits + 7 parts');
    expect(sorter.querySelector('.mod-fx')!.textContent).toBe('Parts per cycle2 → 3Cycle time (s)2 → 3Parts / min60 → 60Scrap used / min90 → 60');
  });

  it('a module that would leave the city short of power says so before Install; Bot Pods demolished say who moves out', () => {
    const s = lab();
    for (let k = 0; k < 2; k++) build(s, 'dock');
    const rec = build(s, 'recycler'); // 1 + 1 + 2 used of the HQ's 6
    build(s, 'dock'); // 5 of 6
    computeDerived(s);
    const { root, update } = hud(s);
    update({ selectedId: rec.id });
    const insp = root.querySelector<HTMLElement>('[data-inspector]')!;
    const warn = insp.querySelector<HTMLElement>('[data-mod="recyclerMagnet"] [data-power-warn]')!;
    expect(warn.hidden).toBe(false);
    expect(warn.textContent).toBe('Power falls short: 6 made for 7 needed, and buildings slow down.');
    const pods = build(s, 'pods');
    computeDerived(s);
    s.pop = 6;
    const clock = vi.spyOn(performance, 'now').mockReturnValue(5000);
    try {
      update({ selectedId: pods.id });
      insp.querySelector<HTMLElement>('[data-demolish]')!.click();
      update({ selectedId: pods.id });
      const loss = insp.querySelector<HTMLElement>('[data-loss]')!;
      expect(loss.hidden).toBe(false);
      expect(loss.textContent).toBe('Homes drop to 0: 6 citizens will move out.');
    } finally {
      clock.mockRestore();
    }
  });

  it('"+N waiting" next to the scrap only while scrap waits for room, explained on hover', () => {
    const s = lab();
    const { root, update } = hud(s);
    update();
    const wait = root.querySelector<HTMLElement>('[data-wait]')!;
    const chip = root.querySelector<HTMLElement>('[data-res="scrap"]')!;
    expect(wait.hidden).toBe(true);
    s.scrapPending = 12.4;
    update();
    expect(wait.hidden).toBe(false);
    expect(wait.textContent).toBe('+12 waiting');
    expect(wait.title).toMatch(/^12 scrap brought back by the bots is waiting for room in storage/);
    expect(chip.title).toBe(wait.title);
    s.scrapPending = 0;
    update();
    expect(wait.hidden).toBe(true);
    expect(chip.title).toBe('Scrap');
  });
});

describe('the declared building numbers stay as they were', () => {
  it('panels read the defs through buildingStats: a plain building shows exactly its own numbers', () => {
    const s = lab();
    for (const type of ['recycler', 'factory', 'pods', 'solar', 'purifier'] as BuildingType[]) {
      const b = build(s, type);
      const def = BUILDINGS[type];
      const rows = new Map(buildingRows(s, b).map((r) => [r.key, r.nominal]));
      expect(rows.get('energy')).toBe(signed(def.energy));
      if (def.process) expect(rows.get('cycle')).toBe(tenth(def.process.time));
      if (def.housing) expect(rows.get('homes')).toBe(`${def.housing}`);
      if (def.cleanRadius) {
        expect(rows.get('radius')).toBe(`${def.cleanRadius}`);
        expect(rows.get('clean')).toBe(tenth(CLEAN_EVERY));
      }
    }
  });
});

describe('a building\'s description says its own numbers', () => {
  // the plain buildings' words, exactly as before (the toolbar's tooltip, a building without a module)
  const PLAIN: Partial<Record<BuildingType, string>> = {
    recycler: 'Turns 3 scrap into 2 parts. Every city needs one: parts build everything.',
    dock: '+2 scrap bots and +80 scrap storage. Bots drop their loot at the nearest dock.',
    pods: 'Homes for 6 robot citizens. Citizens pay taxes and throw away junk.',
    solar: '+5 energy, zero emissions. Pricey to set up.',
    purifier: 'Scrubs the air and slowly cleans toxic sludge within 5 tiles.',
  };

  it('without a module: the plain words, in every language with no placeholder left', () => {
    setLang('en');
    for (const [type, text] of Object.entries(PLAIN)) expect(buildingDesc({ type: type as BuildingType })).toBe(text);
    try {
      for (const { id } of LANGS) {
        setLang(id);
        for (const type of Object.keys(BUILDINGS) as BuildingType[]) {
          const text = buildingDesc({ type });
          expect(text, `${id} ${type}`).not.toMatch(/[{}]/);
          if (type === 'purifier') expect(text, id).toContain('5');
        }
        const pods = buildingDesc({ type: 'pods', modules: ['podsCapsule'] });
        expect(pods, id).toContain('9');
        expect(pods, id).not.toContain('6');
      }
    } finally {
      setLang('en');
    }
  });

  it('with a module: the nozzle\'s 8 tiles, the capsule\'s 9 homes, the trackers\' +7, the sorter\'s 3 parts, +180 storage', () => {
    setLang('en');
    const s = lab();
    const on = (type: BuildingType, kind: ModuleKind) => {
      const b = build(s, type);
      expect(installModule(s, kind, b)).toBe(true);
      return buildingDesc(b);
    };
    expect(on('purifier', 'purifierNozzle')).toBe('Scrubs the air and slowly cleans toxic sludge within 8 tiles.');
    expect(on('pods', 'podsCapsule')).toBe('Homes for 9 robot citizens. Citizens pay taxes and throw away junk.');
    expect(on('solar', 'solarTracker')).toBe('+7 energy, zero emissions. Pricey to set up.');
    expect(on('recycler', 'recyclerSorter')).toBe('Turns 3 scrap into 3 parts. Every city needs one: parts build everything.');
    expect(on('recycler', 'recyclerMagnet')).toBe(PLAIN.recycler);
    expect(on('dock', 'dockStorage')).toBe('+2 scrap bots and +180 scrap storage. Bots drop their loot at the nearest dock.');
    // and the panel shows it
    const pur = s.buildings.find((b) => b.type === 'purifier')!;
    const { root, update } = hud(s);
    update({ selectedId: pur.id });
    expect(root.querySelector('[data-inspector] .insp-desc')!.textContent).toBe('Scrubs the air and slowly cleans toxic sludge within 8 tiles.');
  });
});
