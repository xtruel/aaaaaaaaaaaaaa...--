// Saves through the real menus (docs/MODULAR-INC2.md §7), mouse+keyboard, debug build (and the release build for old
// saves). The hook STAGES (a full store, bots carrying a load, money, a finished Dock) and READS; every save, load,
// Continue, install, remove, demolish and confirmation is a press.
//  carry:     the bots' load with a full store survives Save / Load (pause menu) and "Save & main menu" / Load; it
//             waits for room and is counted once when it goes in
//  slots:     three manual slots and the autosave: empty slots cannot be loaded, a used one says Overwrite, the Load
//             list names the city; Continue resumes the last city played
//  fixtures:  tests/fixtures/save-0.6.json and save-0.7a1.json (as those versions wrote them) through the Load menu;
//             saved over: the original kept aside first (backup:save:<slot>:v2, byte for byte, with its slot info),
//             a second save adds no backup; loaded back the same
//  autosave:  a 0.6 autosave continued; the new day's autosave keeps the 0.6 file aside; after a reload Continue
//  tutorial:  the tutorial over an old autosave is never saved; Skip -> "Start the new city" keeps a copy first,
//             "Keep my saved city" leaves it untouched
//  storage:   a storage module removed / a Dock demolished: the loss announced before the confirmation is what
//             happens; a double click on the confirmation refunds once; the retired bots' load is kept
//  release:   the release build (no hook) loads both old saves and saves over them with the backup
// Every storage key written is a product key (saves, slot info, their backups, settings, projects, campaign...).
import { startTest } from '../lib/report.mjs';
import { launch, openGame, reload, S, settle, until, waitMenu } from '../lib/page.mjs';
import { serve } from '../lib/server.mjs';
import * as G from '../lib/game.mjs';
import { fixture, metaFor, PRODUCT_KEY, seedStorage } from '../lib/profile.mjs';

const T = await startTest({ name: 'saves', input: 'mouse', size: '1280x800' });
const server = await serve(T.cfg.debug);
const relServer = await serve(T.cfg.release);
const browser = await launch();
let page = null;
const FIX06 = fixture('save-0.6.json');
const FIX07 = fixture('save-0.7a1.json');

const ls = (page) => S(page, () => Object.fromEntries(Object.keys(localStorage).map((k) => [k.replace(/^scrapbot:/, ''), localStorage.getItem(k)])));
const keysOk = async (page, tag) => {
  const keys = await S(page, () => Object.keys(localStorage));
  const bad = keys.filter((k) => !PRODUCT_KEY.test(k));
  T.ok(`${tag}: every storage key is a product key`, bad.length === 0, bad.length ? `not product keys: ${bad.join(', ')}` : keys.sort().join(', '));
};
const owned = (page) =>
  S(page, () => {
    const s = window.scrapbot.session().s;
    const carry = s.bots.reduce((n, b) => n + b.carry, 0);
    return { scrap: s.res.scrap, carry, pending: s.scrapPending ?? 0, total: s.res.scrap + carry + (s.scrapPending ?? 0), collected: s.stats.scrapCollected, storage: s.derived.storage, bots: s.bots.length, time: s.time };
  });
const tagSession = (page) => S(page, () => (window.scrapbot.session().__e2eId = Math.random()));
const newSession = (page) => until(page, () => !!window.scrapbot?.session?.() && window.scrapbot.session().__e2eId === undefined && !document.querySelector('#game[hidden]'), null, { timeout: 20000, what: 'a new city session' });
const cityOf = (page) =>
  S(page, () => {
    const s = window.scrapbot.session().s;
    return {
      name: s.cityName,
      buildings: s.buildings.map((b) => `${b.id}:${b.type}@${b.x},${b.y}${b.modules?.length ? '+' + b.modules.join('+') : ''}`).join(' '),
      floors: Array.from(s.floor).filter((v) => v).length,
      solids: Array.from(s.solid).filter((v) => v).length,
      pending: s.scrapPending ?? 0,
      time: s.time,
    };
  });
const rawCity = (raw) => {
  const d = JSON.parse(raw);
  return { name: d.cityName, buildings: d.buildings.map((b) => `${b.id}:${b.type}@${b.x},${b.y}${b.modules?.length ? '+' + b.modules.join('+') : ''}`).join(' '), floors: (d.floors ?? []).length + (d.surfaces ?? []).length, solids: (d.solids ?? []).length, time: d.time, version: d.version };
};
// the sim runs (speed v, with the input) until it has advanced `sec` game seconds, then the input pauses it
async function play(page, io, v, sec) {
  const t0 = await S(page, () => window.scrapbot.session().s.time);
  await io.speed(v);
  await until(page, (t) => window.scrapbot.session().s.time >= t, t0 + sec, { timeout: 120000, what: `${sec} s of play` });
  await io.speed(0);
}
async function pauseMenuPick(page, io, text) {
  await io.pauseMenu();
  await io.menu(await G.menuButton(page, text));
}
async function open(storage, opts = {}) {
  const g = await openGame(browser, opts.server ?? server, { input: 'mouse', size: T.cfg.size, storage, hook: opts.hook ?? true });
  page = g.page;
  return g;
}

async function section(name, fn) {
  let ctx = null;
  try {
    ctx = await fn((c) => (ctx = c));
  } catch (e) {
    T.ok(`${name}: ran to its end`, false, String(e.message).split('\n').slice(0, 4).join(' / '));
    if (page) await T.shot(page, `${name}-crash`).catch(() => {});
  }
  await ctx?.close().catch(() => {});
}

await T.run(async () => {
  // ---------- carry ----------
  await section('carry', async (keep) => {
    const { ctx, io, errors } = await open(seedStorage({ profile: 'all' }));
    keep(ctx);
    await G.startFreePlay(page, io, { seed: 1234, name: 'UI City' });
    await until(page, () => window.scrapbot.session().s.bots.length >= 3, null, { timeout: 20000, what: 'three bots' });
    await io.speed(0);
    await G.stage(page, () => {
      const s = window.scrapbot.session().s;
      for (const b of s.bots) Object.assign(b, { carry: 5, state: 'idle', target: -1, timer: 1e6 });
      s.res.scrap = s.derived.storage;
      s.nextEventAt = 1e9;
      s.nextStormAt = 1e9;
    });
    T.note('carry: staged a full store and every bot holding 5 scrap');
    const before = await owned(page);
    await tagSession(page);
    await pauseMenuPick(page, io, 'Save game');
    await io.menu('#modal-root [data-slot="1"]');
    await until(page, () => !!localStorage.getItem('scrapbot:save:1'), null, { what: 'slot 1 written' });
    const saved = JSON.parse((await ls(page))['save:1']);
    T.ok('Save (pause menu, slot 1) writes the bots\' load as scrapPending, version 3', saved.version === 3 && saved.res.scrap + (saved.scrapPending ?? 0) === before.total, `store ${before.scrap}/${before.storage} + carry ${before.carry} -> saved ${saved.res.scrap} + pending ${saved.scrapPending}`);
    await io.menu(await G.menuButton(page, 'Back'));
    await io.menu(await G.menuButton(page, 'Load game'));
    await io.menu('#modal-root [data-slot="1"]');
    await newSession(page);
    await tagSession(page);
    await io.speed(0);
    const after = await owned(page);
    T.ok('Load (pause menu, slot 1): store + carried + pending is what it was', after.total === before.total, `${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
    T.ok('the collection count did not move (the store was full)', after.collected === before.collected, `${before.collected} -> ${after.collected}`);
    await G.noEvents(page);
    await play(page, io, 3, 3);
    const waited = await owned(page);
    T.ok('with the store still full the pending scrap waits (an HQ-only city uses no scrap)', waited.total === before.total && waited.pending === before.carry, JSON.stringify(waited));
    await G.stage(page, () => (window.scrapbot.session().s.res.scrap -= 20));
    T.note('carry: staged 20 scrap taken out of the store (room for the waiting load)');
    const roomed = await owned(page);
    await play(page, io, 1, 1);
    const filled = await owned(page);
    const went = roomed.pending - filled.pending;
    T.ok('room appears: the pending scrap goes in and counts as collected once', went === Math.min(20, roomed.pending) && filled.collected - roomed.collected === filled.scrap - roomed.scrap, `pending ${roomed.pending} -> ${filled.pending}, scrap ${roomed.scrap} -> ${filled.scrap}, collected ${roomed.collected} -> ${filled.collected}`);
    const exit = await owned(page);
    await pauseMenuPick(page, io, 'Save & main menu');
    await waitMenu(page);
    await G.loadFromMenu(page, io, 1);
    await io.speed(0);
    const again = await owned(page);
    T.ok('"Save & main menu" saved back into slot 1; Load from the main menu: the same total and count', again.total === exit.total && again.collected === exit.collected, `${JSON.stringify(exit)} -> ${JSON.stringify(again)}`);
    await keysOk(page, 'carry');
    T.ok('carry: no page errors', errors.length === 0, errors.join(' | '));
    return ctx;
  });

  // ---------- slots and Continue ----------
  await section('slots', async (keep) => {
    const { ctx, io, errors } = await open(seedStorage({ profile: 'all' }));
    keep(ctx);
    await io.menu('[data-act="load"]');
    const empty = await S(page, () => [...document.querySelectorAll('#modal-root [data-slot]')].map((b) => ({ slot: b.dataset.slot, disabled: b.disabled })));
    T.ok('a new player: Load lists the autosave and 3 slots, all empty and not loadable', empty.length === 4 && empty.every((e) => e.disabled), JSON.stringify(empty));
    T.ok('Continue is not offered', await S(page, () => document.querySelector('[data-act="continue"]').disabled));
    // (the Load dialog of the main menu closes with its x)
    await io.menu('#modal-root .modal-x');
    await until(page, () => !document.querySelector('#modal-root .modal'), null, { what: 'the Load dialog closed' });
    await G.startFreePlay(page, io, { seed: 77, name: 'Slot Town' });
    await io.speed(0);
    await pauseMenuPick(page, io, 'Save game');
    const labels0 = await S(page, () => Object.fromEntries([...document.querySelectorAll('#modal-root [data-slot]')].map((b) => [b.dataset.slot, b.textContent.trim()])));
    await io.menu('#modal-root [data-slot="2"]');
    await until(page, () => !!localStorage.getItem('scrapbot:save:2'), null, { what: 'slot 2 written' });
    await settle(page);
    const labels1 = await S(page, () => Object.fromEntries([...document.querySelectorAll('#modal-root [data-slot]')].map((b) => [b.dataset.slot, b.textContent.trim()])));
    T.ok('Save game: empty slots say Save; once written, slot 2 says Overwrite (the autosave is not offered)', labels0['1'] === 'Save' && labels0['2'] === 'Save' && !('auto' in labels0) && labels1['2'] === 'Overwrite', `${JSON.stringify(labels0)} -> ${JSON.stringify(labels1)}`);
    const row = await S(page, () => document.querySelector('#modal-root .slot:has([data-slot="2"])')?.textContent.replace(/\s+/g, ' ') ?? '');
    T.ok('the slot names the city and its day', /Slot Town · day \d+/.test(row), row);
    await io.menu(await G.menuButton(page, 'Back'));
    await io.menu(await G.menuButton(page, 'Save & main menu'));
    await waitMenu(page);
    T.ok('back on the menu: Continue offered', !(await S(page, () => document.querySelector('[data-act="continue"]').disabled)));
    await reload(page, io);
    await io.menu('[data-act="continue"]');
    await until(page, () => !!window.scrapbot?.session?.(), null, { timeout: 20000, what: 'Continue' });
    await G.cityStarted(page, io);
    const c = await cityOf(page);
    T.ok('after a reload, Continue resumes the last city played (Slot Town)', c.name === 'Slot Town', c.name);
    await keysOk(page, 'slots');
    T.ok('slots: no page errors', errors.length === 0, errors.join(' | '));
    return ctx;
  });

  // ---------- fixtures ----------
  await section('fixtures', async (keep) => {
    const { ctx, io, errors } = await open(seedStorage({ profile: 'all', keys: { 'save:1': FIX06, 'meta:1': metaFor(FIX06), 'save:2': FIX07, 'meta:2': metaFor(FIX07), last: '1' } }));
    keep(ctx);
    let first = true;
    for (const [slot, raw, tag] of [['1', FIX06, '0.6'], ['2', FIX07, '0.7.0-alpha.1']]) {
      const want = rawCity(raw);
      if (first) await io.menu('[data-act="load"]');
      else await pauseMenuPick(page, io, 'Load game');
      first = false;
      const label = await S(page, (slot) => document.querySelector(`#modal-root .slot:has([data-slot="${slot}"])`)?.textContent.replace(/\s+/g, ' ') ?? '', slot);
      T.ok(`${tag} save: the Load menu lists it in slot ${slot}`, label.includes(want.name), label);
      if (slot === '1') await T.shot(page, 'load-menu-old-saves');
      await io.menu(`#modal-root [data-slot="${slot}"]`);
      await newSession(page);
      await tagSession(page);
      await G.cityStarted(page, io);
      await io.speed(0);
      const got = await cityOf(page);
      T.ok(`${tag} save loads: name, buildings, modules, floors and pieces as saved; nothing pending`, got.name === want.name && got.buildings === want.buildings && got.floors === want.floors && got.solids === want.solids && got.pending === 0 && got.time - want.time < 5, `${got.buildings.split(' ').length} buildings, floors ${got.floors}, solids ${got.solids}`);
      const before = await ls(page);
      T.ok(`${tag}: loading alone writes no backup of it and leaves the old save as it was`, before[`save:${slot}`] === raw && !Object.keys(before).some((k) => k.startsWith(`backup:save:${slot}:`)), Object.keys(before).join(','));
      await pauseMenuPick(page, io, 'Save game');
      const ow = await S(page, (slot) => document.querySelector(`#modal-root [data-slot="${slot}"]`).textContent.trim(), slot);
      await io.menu(`#modal-root [data-slot="${slot}"]`);
      await until(page, (slot) => JSON.parse(localStorage.getItem(`scrapbot:save:${slot}`)).version === 3, slot, { what: `slot ${slot} saved over` });
      const st = await ls(page);
      T.ok(`${tag}: "${ow}" keeps the original aside first (backup:save:${slot}:v2 = the old file byte for byte, with its slot info), then writes version 3`, st[`backup:save:${slot}:v2`] === raw && st[`backup:meta:${slot}:v2`] === metaFor(raw) && JSON.parse(st[`save:${slot}`]).version === 3, `backup ${st[`backup:save:${slot}:v2`]?.length ?? 'missing'} chars (file ${raw.length})`);
      await io.menu(`#modal-root [data-slot="${slot}"]`);
      await settle(page);
      const st2 = await ls(page);
      T.ok(`${tag}: a second save leaves the backup as it was and adds none`, st2[`backup:save:${slot}:v2`] === raw && Object.keys(st2).filter((k) => k.startsWith('backup:')).length === Object.keys(st).filter((k) => k.startsWith('backup:')).length, Object.keys(st2).filter((k) => k.startsWith('backup:')).join(', '));
      await io.menu(await G.menuButton(page, 'Back'));
      await io.menu(await G.menuButton(page, 'Load game'));
      await io.menu(`#modal-root [data-slot="${slot}"]`);
      await newSession(page);
      await tagSession(page);
      await io.speed(0);
      const back = await cityOf(page);
      T.ok(`${tag}: the city saved by this version loads back the same`, back.buildings === got.buildings && back.floors === got.floors && back.solids === got.solids, `${back.buildings.split(' ').length} buildings`);
    }
    const st = await ls(page);
    T.ok('the tutorial flag and the settings of the old storage are untouched', st['tutorial-done'] === '1' && JSON.parse(st.settings).lang === 'en');
    await keysOk(page, 'fixtures');
    T.ok('fixtures: no page errors', errors.length === 0, errors.join(' | '));
    return ctx;
  });

  // ---------- autosave ----------
  await section('autosave', async (keep) => {
    const { ctx, io, errors } = await open(seedStorage({ profile: 'all', keys: { 'save:auto': FIX06, 'meta:auto': metaFor(FIX06), last: 'auto' } }));
    keep(ctx);
    const want = rawCity(FIX06);
    await io.menu('[data-act="continue"]');
    await until(page, () => !!window.scrapbot?.session?.(), null, { timeout: 20000, what: 'Continue' });
    await G.cityStarted(page, io);
    const got = await cityOf(page);
    T.ok('Continue loads the 0.6 autosave', got.name === want.name && got.buildings === want.buildings, got.name);
    const st0 = await ls(page);
    T.ok('loading alone writes no backup and leaves the 0.6 autosave as it was', st0['save:auto'] === FIX06 && !Object.keys(st0).some((k) => k.startsWith('backup:save')), Object.keys(st0).join(','));
    const day0 = Math.floor(got.time / 60) + 1;
    await G.noEvents(page);
    await io.speed(3);
    await until(page, (d) => Math.floor(window.scrapbot.session().s.time / 60) + 1 > d && JSON.parse(localStorage.getItem('scrapbot:save:auto')).version === 3, day0, { timeout: 120000, what: 'the next day and its autosave' });
    await io.speed(0);
    const st = await ls(page);
    const auto = JSON.parse(st['save:auto']);
    T.ok('the new day\'s autosave writes version 3 and keeps the 0.6 file aside (backup:save:auto:v2)', auto.version === 3 && Math.floor(auto.time / 60) + 1 > day0 && st['backup:save:auto:v2'] === FIX06, `autosave day ${Math.floor(auto.time / 60) + 1}`);
    await reload(page, io);
    await io.menu('[data-act="continue"]');
    await until(page, () => !!window.scrapbot?.session?.(), null, { timeout: 20000, what: 'Continue' });
    await G.cityStarted(page, io);
    const re = await cityOf(page);
    T.ok('after a reload, Continue resumes the autosave (the same city, the new day)', re.name === want.name && Math.floor(re.time / 60) + 1 === Math.floor(auto.time / 60) + 1, `day ${Math.floor(re.time / 60) + 1}`);
    T.ok('the backup survives the reload', (await ls(page))['backup:save:auto:v2'] === FIX06);
    await keysOk(page, 'autosave');
    T.ok('autosave: no page errors', errors.length === 0, errors.join(' | '));
    return ctx;
  });

  // ---------- the tutorial over an old autosave ----------
  for (const choice of ['Start the new city', 'Keep my saved city']) {
    await section(`tutorial (${choice})`, async (keep) => {
      const { ctx, io, errors } = await open(seedStorage({ profile: 'all', tutorialDone: false, keys: { 'save:auto': FIX06, 'meta:auto': metaFor(FIX06), last: 'auto' } }));
      keep(ctx);
      await io.menu('[data-act="new"]');
      await io.menu('#modal-root [data-mode="tutorial"]');
      await until(page, () => window.scrapbot?.session?.()?.s.tutorial === true, null, { timeout: 20000, what: 'the tutorial' });
      await settle(page);
      const st0 = await ls(page);
      T.ok(`tutorial (${choice}): the tutorial city is never saved while it runs`, st0['save:auto'] === FIX06 && !Object.keys(st0).some((k) => k.startsWith('backup:') || (k.startsWith('save:') && k !== 'save:auto')), Object.keys(st0).join(','));
      await io.pauseMenu();
      await io.menu(await G.menuButton(page, 'Skip the tutorial'));
      await page.waitForSelector('#modal-root .modal .modal-actions', { timeout: 10000 });
      const title = await S(page, () => document.querySelector('#modal-root .modal h2')?.textContent);
      await io.menu(await G.menuButton(page, choice));
      await settle(page);
      const st = await ls(page);
      T.ok(`tutorial (${choice}): skipping it ("${title}") sets the tutorial flag`, st['tutorial-done'] === '1');
      if (choice === 'Start the new city') {
        const auto = JSON.parse(st['save:auto']);
        T.ok('"Start the new city": the 0.6 autosave is copied aside first (backup:save:auto:v2), then replaced', auto.version === 3 && st['backup:save:auto:v2'] === FIX06, `autosave "${auto.cityName}" v${auto.version}`);
      } else T.ok('"Keep my saved city": the 0.6 autosave untouched, nothing backed up or written', st['save:auto'] === FIX06 && !Object.keys(st).some((k) => k.startsWith('backup:')), Object.keys(st).join(','));
      await keysOk(page, `tutorial (${choice})`);
      T.ok(`tutorial (${choice}): no page errors`, errors.length === 0, errors.join(' | '));
      return ctx;
    });
  }

  // ---------- storage going down: the warning is what happens ----------
  await section('storage', async (keep) => {
    const { ctx, io, errors } = await open(seedStorage({ profile: 'all' }));
    keep(ctx);
    await G.startFreePlay(page, io, { seed: 1234, name: 'Dock Yard' });
    await io.speed(0);
    await G.noEvents(page);
    const B = await G.placeFinished(page, ['dock']);
    const dockId = B.dock[0];
    await G.stage(page, () => {
      const s = window.scrapbot.session().s;
      s.res.credits = 2000;
      s.res.parts = 500;
    });
    T.note('storage: staged a finished Dock and money');
    await io.speed(3);
    await until(page, () => window.scrapbot.session().s.bots.length >= 5, null, { timeout: 30000, what: 'the Dock\'s bots' });
    await io.speed(0);
    const select = async () => {
      const d = await S(page, (id) => {
        const b = window.scrapbot.session().s.buildings.find((o) => o.id === id);
        return { x: b.x + 1, y: b.y + 1 };
      }, dockId);
      await G.frameOn(page, d, 3, -160);
      await settle(page);
      const p = await G.buildingPoint(page, dockId);
      await io.at(p.x, p.y);
      await until(page, (id) => window.scrapbot.session().selectedId === id, dockId, { what: 'the Dock selected' });
    };
    await select();
    const c0 = await G.res(page);
    await io.press('[data-inspector] [data-install="dockStorage"]');
    await until(page, (id) => window.scrapbot.session().s.buildings.find((b) => b.id === id).modules?.includes('dockStorage'), dockId, { what: 'the module installed' });
    const st1 = await owned(page);
    const c1 = await G.res(page);
    T.ok('Install (Dock panel): storage 230 -> 330, paid 30 credits + 15 parts once', st1.storage === 330 && Math.round(c0.credits - c1.credits) === 30 && Math.round(c0.parts - c1.parts) === 15, `storage ${st1.storage}, paid ${Math.round(c0.credits - c1.credits)} / ${Math.round(c0.parts - c1.parts)}`);
    const fill = () =>
      G.stage(page, () => {
        const s = window.scrapbot.session().s;
        for (const b of s.bots) Object.assign(b, { carry: 5, state: 'idle', target: -1, timer: 1e6 });
        s.res.scrap = s.derived.storage;
      });
    await fill();
    T.note('storage: staged a full store and loaded bots');
    const o0 = await owned(page);
    await io.press('[data-inspector] [data-remove="dockStorage"]');
    await page.waitForSelector('[data-inspector] [data-remove-confirm]', { timeout: 5000 });
    await settle(page);
    const w = await S(page, () => ({ loss: document.querySelector('[data-inspector] [data-loss]:not([hidden])')?.textContent ?? '', btn: document.querySelector('[data-inspector] [data-remove-confirm]').textContent }));
    await T.shot(page, 'storage-loss-warning');
    const m = /drops to (\d+): (\d+) scrap/.exec(w.loss);
    const rf = /\+(\d+) credits \+ (\d+) parts/.exec(w.btn);
    await io.press('[data-inspector] [data-remove-confirm]');
    await until(page, (id) => !window.scrapbot.session().s.buildings.find((b) => b.id === id).modules?.includes('dockStorage'), dockId, { what: 'the module removed' });
    const o1 = await owned(page);
    const c2 = await G.res(page);
    T.ok('Remove shows "Storage drops to N: L scrap will be lost." before the confirmation', !!m, `"${w.loss}" / "${w.btn}"`);
    T.ok('after the confirmation the storage is N and exactly L scrap went (what was shown is what happened)', m && o1.storage === Number(m[1]) && o0.scrap - o1.scrap === Number(m[2]), `shown ${m?.[1]} / ${m?.[2]}; storage ${o0.storage} -> ${o1.storage}, scrap ${o0.scrap} -> ${o1.scrap}`);
    T.ok('the refund in the button is what came back, once', rf && Math.round(c2.credits - c1.credits) === Number(rf[1]) && Math.round(c2.parts - c1.parts) === Number(rf[2]), `"${w.btn}" -> +${Math.round(c2.credits - c1.credits)} / +${Math.round(c2.parts - c1.parts)}`);
    T.ok('the bots\' load is not part of the loss', o1.carry === o0.carry, `${o0.carry} -> ${o1.carry}`);
    await io.press('[data-inspector] [data-install="dockStorage"]');
    await until(page, (id) => window.scrapbot.session().s.buildings.find((b) => b.id === id).modules?.includes('dockStorage'), dockId, { what: 'the module installed again' });
    await fill();
    const o2 = await owned(page);
    const c3 = await G.res(page);
    await io.press('[data-inspector] [data-demolish]');
    await page.waitForSelector('[data-inspector] [data-confirm]', { timeout: 5000 });
    await settle(page);
    const w2 = await S(page, () => ({ loss: document.querySelector('[data-inspector] [data-loss]:not([hidden])')?.textContent ?? '', btn: document.querySelector('[data-inspector] [data-confirm]').textContent }));
    const m2 = /drops to (\d+): (\d+) scrap/.exec(w2.loss);
    const rf2 = /\+(\d+) credits \+ (\d+) parts/.exec(w2.btn);
    // a double click on the confirmation (paced like a deliberate first press)
    await io.pace();
    await io.reveal('[data-inspector] [data-confirm]');
    const cp = await io.pointOf('[data-inspector] [data-confirm]');
    await io.double(cp.x, cp.y, { gap: 120 });
    await until(page, (id) => !window.scrapbot.session().s.buildings.some((b) => b.id === id), dockId, { what: 'the Dock demolished' });
    const o3 = await owned(page);
    const c4 = await G.res(page);
    T.ok('Demolish: the confirmation shows the storage left, the scrap lost and the refund with the module (35 credits + 12 parts)', !!m2 && !!rf2 && rf2[1] === '35' && rf2[2] === '12', `"${w2.loss}" / "${w2.btn}"`);
    T.ok('storage and scrap after = the numbers shown', m2 && o3.storage === Number(m2[1]) && o2.scrap - o3.scrap === Number(m2[2]), `storage ${o2.storage} -> ${o3.storage}, scrap ${o2.scrap} -> ${o3.scrap}`);
    T.ok('a double click on the confirmation refunds once', rf2 && Math.round(c4.credits - c3.credits) === Number(rf2[1]) && Math.round(c4.parts - c3.parts) === Number(rf2[2]), `+${Math.round(c4.credits - c3.credits)} / +${Math.round(c4.parts - c3.parts)}`);
    await io.speed(1);
    await until(page, () => window.scrapbot.session().s.bots.length === 3, null, { timeout: 15000, what: 'the Dock\'s two bots retired' });
    await io.speed(0);
    const o4 = await owned(page);
    T.ok('the two retired bots\' load is kept (pending), not lost', o4.total === o3.total && o4.pending === 10, JSON.stringify(o4));
    await tagSession(page);
    await pauseMenuPick(page, io, 'Save game');
    await io.menu('#modal-root [data-slot="3"]');
    await until(page, () => !!localStorage.getItem('scrapbot:save:3'), null, { what: 'slot 3 written' });
    await io.menu(await G.menuButton(page, 'Back'));
    await io.menu(await G.menuButton(page, 'Load game'));
    await io.menu('#modal-root [data-slot="3"]');
    await newSession(page);
    await io.speed(0);
    const o5 = await owned(page);
    const saved = JSON.parse((await ls(page))['save:3']);
    T.ok('save + load after the demolition: no module without its building, scrap + carried + pending unchanged', !saved.buildings.some((b) => b.modules?.length) && !saved.buildings.some((b) => b.id === dockId) && o5.total === o4.total, `pending ${saved.scrapPending}; total ${o4.total} -> ${o5.total}`);
    await keysOk(page, 'storage');
    T.ok('storage: no page errors', errors.length === 0, errors.join(' | '));
    return ctx;
  });

  // ---------- the release build ----------
  await section('release', async (keep) => {
    const { ctx, io, errors } = await open(seedStorage({ profile: 'all', keys: { 'save:1': FIX06, 'meta:1': metaFor(FIX06), 'save:2': FIX07, 'meta:2': metaFor(FIX07), last: '2' } }), { server: relServer, hook: false });
    keep(ctx);
    T.ok('release: no test hook in the page', !(await S(page, () => 'scrapbot' in window)));
    let first = true;
    for (const [slot, raw, tag] of [['1', FIX06, '0.6'], ['2', FIX07, '0.7.0-alpha.1']]) {
      if (first) await io.menu('[data-act="load"]');
      else await pauseMenuPick(page, io, 'Load game');
      first = false;
      await io.menu(`#modal-root [data-slot="${slot}"]`);
      await page.waitForSelector('#game:not([hidden]) .hud [data-speed="0"]', { timeout: 20000 });
      await io.press('[data-speed="0"]');
      await pauseMenuPick(page, io, 'Save game');
      await io.menu(`#modal-root [data-slot="${slot}"]`);
      await until(page, (slot) => JSON.parse(localStorage.getItem(`scrapbot:save:${slot}`)).version === 3, slot, { what: `slot ${slot} saved over` });
      await io.menu(await G.menuButton(page, 'Back'));
      await io.menu(await G.menuButton(page, 'Resume'));
      const st = await ls(page);
      const re = rawCity(st[`save:${slot}`]);
      const want = rawCity(raw);
      T.ok(`release: the ${tag} save loads through the Load menu and is saved back the same city (name, buildings, modules, pieces)`, re.name === want.name && re.buildings === want.buildings && re.floors === want.floors && re.solids === want.solids && re.time >= want.time, `${re.name}: ${re.buildings.split(' ').length} buildings`);
      T.ok(`release: saving over it keeps the ${tag} file aside (backup:save:${slot}:v2) and writes version 3`, st[`backup:save:${slot}:v2`] === raw && re.version === 3);
    }
    await T.shot(page, 'release-07a1-city');
    await keysOk(page, 'release');
    T.ok('release: no page errors', errors.length === 0, errors.join(' | '));
    return ctx;
  });
}, () => page);

await browser.close();
await server.close();
await relServer.close();
await T.finish();
