// The game played on a phone in landscape with a finger: CDP touch events in Chromium emulating the phone (isMobile, DPR
// 3, its safe area: e2e/lib/phone.mjs), one screen per run (667x375 iPhone SE, 874x402 iPhone 16 Pro), the compact
// layout (src/compact.css). Every press is a tap or a swipe of the input; the hook READS the city (and stages money
// once, after the tutorial, said in the log).
//  1. main menu -> New game -> Tutorial; the tutorial followed: the map dragged, a Recycler, Bot Pods and a Solar Array
//     built from the build bar next to the HQ, a faster speed, Next, "Keep playing here"
//  2. the goal chip opened and closed; a building's strip, its × putting it away; a Bot Dock and a Recycler built
//  3. the catalog (the Tools column's cone): a row of 3 floor tiles (a finger lays one tile per tap), a lamp turned with
//     Rotate and placed, Done, the catalog closed; the lamp selected on the map, turned from its panel, moved, removed
//  4. the Dock's panel (scrolled to its end with a swipe) and the smog panel opened and closed
//  5. Pause -> Save game -> slot 1; the page reloaded; Load game -> slot 1: the floor and the buildings back
//  6. the region map: Save & main menu -> New game -> Campaign; a city; Travel; its Pause -> Region map
import { startTest } from '../lib/report.mjs';
import { frames, launch, openGame, reload, S, settle, until } from '../lib/page.mjs';
import { serve } from '../lib/server.mjs';
import * as G from '../lib/game.mjs';
import { seedStorage } from '../lib/profile.mjs';
import { PHONE_CHECKS, SIZES, safeOf } from '../lib/phone.mjs';

const T = await startTest({ name: 'phone-flow', input: 'touch', size: '874x402' });
const { size } = T.cfg;
const server = await serve(T.cfg.debug);
const browser = await launch();
let page = null;
const shot = (name) => T.shot(page, `${name}-${size}`);
const at = (i) => ({ x: i % 56, y: Math.floor(i / 56) });

await T.run(async () => {
  const g = await openGame(browser, server, { size, input: 'touch', dpr: 3, mobile: true, insets: SIZES[size].insets, storage: seedStorage({ tutorialDone: false, profile: 'all' }) });
  page = g.page;
  const { io, errors } = g;
  const safe = async (when) => {
    await S(page, PHONE_CHECKS);
    const got = await S(page, () => window.__phone.readSafe());
    const want = safeOf(size);
    T.ok(`${when}: the page reads the phone's safe area ${JSON.stringify(want)}`, ['left', 'right', 'bottom'].every((k) => Math.abs(got[k] - want[k]) < 0.5), JSON.stringify(got));
  };
  await safe('start');

  // a building put down with the input: its card on the build bar (swiped into sight), then a tap on a free spot next
  // to the HQ brought into sight by real pans (a finger's drag) clear of the HUD and the tutorial's bubble
  async function build(type) {
    const n0 = await S(page, (type) => window.scrapbot.session().s.buildings.filter((b) => b.type === type).length, type);
    await io.press(`[data-tool="${type}"]`);
    await until(page, (type) => window.scrapbot.session().build === type, type, { what: `the ${type} tool in hand` });
    const spot = await S(page, (type) => {
      const s = window.scrapbot.session().s;
      const A = window.scrapbot.actions;
      const d = window.scrapbot.defs.BUILDINGS[type];
      const hq = s.buildings.find((b) => b.type === 'hq');
      for (let r = 3; r < 14; r++)
        for (let dy = -r; dy <= r; dy++)
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            if (A.placeCheck(s, type, hq.x + dx, hq.y + dy).ok) return { x: hq.x + dx + Math.floor((d.w - 1) / 2), y: hq.y + dy + Math.floor((d.h - 1) / 2) };
          }
      return null;
    }, type);
    if (!spot) throw new Error(`no room for a ${type}`);
    const p = await G.bringClear(page, io, spot);
    await io.at(p.x, p.y);
    return until(page, ([type, n0]) => window.scrapbot.session().s.buildings.filter((b) => b.type === type).length > n0, [type, n0], { soft: true, timeout: 5000, what: `a ${type} built` });
  }
  const step = (n) => until(page, (n) => new RegExp(`\\b${n}/7`).test(document.querySelector('.coach-step')?.textContent ?? ''), n, { timeout: 15000, what: `the tutorial's step ${n}`, soft: true });

  // ---------- 1. main menu -> New game -> Tutorial, followed with a finger ----------
  await shot('menu');
  await io.menu('[data-act="new"]');
  await io.menu('#modal-root [data-mode="tutorial"]');
  await until(page, () => !!window.scrapbot?.session?.() && !!document.querySelector('.coach'), null, { timeout: 20000, what: 'the tutorial' });
  T.ok('the tutorial from the main menu, with taps', (await step(1)) !== null && (await S(page, () => document.body.classList.contains('touch-mode'))));
  await G.noEvents(page);
  await shot('tutorial-1');
  // step 1: the map dragged with one finger, from a point of the map nothing covers
  const free = await S(page, () => {
    const c = window.scrapbot.session().renderer.canvas;
    for (let y = innerHeight * 0.7; y > 70; y -= 8) for (let x = innerWidth * 0.5; x < innerWidth - 90; x += 16) if (document.elementFromPoint(x, y) === c && document.elementFromPoint(x - 90, y - 40) === c) return { x: Math.round(x), y: Math.round(y) };
    return null;
  });
  await io.pan(-90, -40, free);
  T.ok('tutorial 1: the map dragged with one finger', (await step(2)) !== null);
  await shot('tutorial-2');
  T.ok('tutorial 2: the Recycler built from the build bar next to the HQ', !!(await build('recycler')) && (await step(3)) !== null);
  T.ok('tutorial 3: Bot Pods built', !!(await build('pods')) && (await step(4)) !== null);
  T.ok('tutorial 4: a Solar Array built', !!(await build('solar')) && (await step(5)) !== null);
  await shot('tutorial-5');
  await io.speed(2);
  T.ok('tutorial 5: a faster speed tapped', (await step(6)) !== null);
  await io.press('.coach [data-next]');
  T.ok('tutorial 6: Next', (await step(7)) !== null);
  await shot('tutorial-7');
  await io.press('.coach [data-stay]');
  await until(page, () => !document.querySelector('.coach') && !window.scrapbot.session().s.tutorial, null, { what: 'the tutorial done' });
  await io.speed(0);
  T.ok('tutorial 7: "Keep playing here": a free play city, saved in the autosave', await S(page, () => !!localStorage.getItem('scrapbot:save:auto')));

  // ---------- 2. the goal chip, a strip, a Bot Dock and a Recycler ----------
  await G.stage(page, () => {
    const s = window.scrapbot.session().s;
    s.res.credits = 2000;
    s.res.parts = 300;
    s.res.scrap = 60;
  });
  T.note('staged after the tutorial: 2000 credits, 300 parts, 60 scrap (the buildings and items are bought with them)');
  await io.press('[data-obj-toggle]');
  const opened = await until(page, () => document.querySelector('[data-objective]').classList.contains('open'), null, { soft: true, what: 'the goal opened' });
  await shot('goal-open');
  await io.press('[data-obj-toggle]');
  T.ok('the goal chip opened and closed with taps', !!opened && (await S(page, () => !document.querySelector('[data-objective]').classList.contains('open'))));
  await io.press('[data-tool="factory"]');
  const strip = await until(page, () => !document.querySelector('[data-build-info]').hidden && document.querySelector('.bi-title b')?.textContent, null, { soft: true, what: 'the strip' });
  await shot('strip');
  await io.press('[data-build-close]');
  T.ok(`the strip names the building in hand ("${strip}") and its × puts it away`, strip === '2PM Factory' && (await until(page, () => !window.scrapbot.session().build && document.querySelector('[data-build-info]').hidden, null, { soft: true })) !== null);
  T.ok('a Bot Dock built', !!(await build('dock')));
  T.ok('a Recycler built', !!(await build('recycler')));
  await io.cancel();
  await until(page, () => !window.scrapbot.session().build, null, { what: 'the tool put away' });
  await shot('built');

  // ---------- 3. the catalog: a row of floor, a lamp; the lamp turned, moved, removed ----------
  await G.openCatalog(page, io);
  await G.catalogTab(page, io, 'construction');
  await io.press('[data-catalog-panel] [data-item="floor"]');
  await until(page, () => window.scrapbot.session().piece?.kind === 'floor', null, { what: 'the floor in hand' });
  const row = await G.freeBlock(page, 4, 3, 1);
  const tiles = [0, 1, 2].map((k) => ({ x: row.x0 + k, y: row.y0 }));
  for (const t of tiles) {
    const p = await G.bringClear(page, io, t);
    await io.at(p.x, p.y);
  }
  const floors = await S(page, (tiles) => tiles.map((t) => window.scrapbot.session().s.floor[t.y * 56 + t.x]), tiles);
  T.ok('a row of 3 floor tiles laid with 3 taps', floors.every((f) => f === 1), JSON.stringify(floors));
  await shot('floor');
  await G.catalogTab(page, io, 'decorations');
  await io.press('[data-catalog-panel] [data-item="lamp"]');
  await until(page, () => window.scrapbot.session().piece?.kind === 'lamp', null, { what: 'the lamp in hand' });
  const r0 = await S(page, () => window.scrapbot.session().piece.rot);
  await io.rotate('[data-catalog-panel]');
  const r1 = await until(page, (r0) => window.scrapbot.session().piece.rot !== r0 && window.scrapbot.session().piece.rot, r0, { soft: true });
  const lamp = { x: row.x0 + 1, y: row.y0 + 2 };
  const pl = await G.bringClear(page, io, lamp);
  await io.at(pl.x, pl.y);
  const placed = await until(page, (i) => window.scrapbot.session().s.solid[i] === 3, lamp.y * 56 + lamp.x, { soft: true, what: 'the lamp placed' });
  T.ok(`a lamp turned with Rotate (${r0} -> ${r1}) and placed with a tap`, !!placed && r1 === (r0 + 1) % 4 && (await S(page, (i) => window.scrapbot.session().s.rot[i], lamp.y * 56 + lamp.x)) === r1);
  await shot('lamp');
  await io.cancel(); // Done
  await until(page, () => !window.scrapbot.session().piece, null, { what: 'the lamp put away' });
  await io.cancel(); // the catalog's ×
  T.ok("Done put the lamp away, the catalog's × closed it", (await until(page, () => !window.scrapbot.session().catalog, null, { soft: true })) !== null);
  // the lamp selected with a tap on it, turned from its panel, moved, removed
  await G.bringClear(page, io, lamp);
  const lp = await G.piecePoint(page, lamp);
  if (!lp) throw new Error('no point on the lamp');
  await io.at(lp.x, lp.y);
  const sel = await until(page, (i) => window.scrapbot.session().selectedPiece === i && !document.querySelector('[data-inspector]').hidden, lamp.y * 56 + lamp.x, { soft: true });
  await shot('lamp-panel');
  await io.press('[data-inspector] [data-rotate]');
  const r2 = await until(page, ([i, r]) => window.scrapbot.session().s.rot[i] !== r && window.scrapbot.session().s.rot[i], [lamp.y * 56 + lamp.x, r1], { soft: true });
  T.ok(`the lamp selected with a tap and turned from its panel (${r1} -> ${r2})`, !!sel && r2 === (r1 + 1) % 4);
  await io.press('[data-inspector] [data-move-piece]');
  await until(page, () => window.scrapbot.session().moving >= 0, null, { what: 'moving' });
  const dest = { x: lamp.x + 1, y: lamp.y };
  const pd = await G.bringClear(page, io, dest);
  await io.at(pd.x, pd.y);
  const moved = await until(page, ([a, b]) => window.scrapbot.session().s.solid[b] === 3 && !window.scrapbot.session().s.solid[a], [lamp.y * 56 + lamp.x, dest.y * 56 + dest.x], { soft: true, what: 'the lamp moved' });
  T.ok('the lamp moved one tile with Move and a tap', !!moved);
  await shot('lamp-moved');
  const credits = await S(page, () => window.scrapbot.session().s.res.credits);
  await io.press('[data-inspector] [data-remove-piece]');
  const removed = await until(page, (i) => !window.scrapbot.session().s.solid[i], dest.y * 56 + dest.x, { soft: true, what: 'the lamp removed' });
  T.ok('the lamp removed from its panel (half its price back)', !!removed && (await S(page, () => window.scrapbot.session().s.res.credits)) === credits + 5);

  // ---------- 4. a building's panel, the smog panel ----------
  const dock = await S(page, () => window.scrapbot.session().s.buildings.find((b) => b.type === 'dock').id);
  const dockTile = await S(page, (id) => {
    const b = window.scrapbot.session().s.buildings.find((o) => o.id === id);
    return { x: b.x + 1, y: b.y + 1 };
  }, dock);
  await G.bringClear(page, io, dockTile);
  const dp = await G.buildingPoint(page, dock);
  if (!dp) throw new Error('no point on the Dock');
  await io.at(dp.x, dp.y);
  const panel = await until(page, (id) => window.scrapbot.session().selectedId === id && !document.querySelector('[data-inspector]').hidden, dock, { soft: true });
  await shot('dock-panel');
  // its last button brought into sight with a swipe of the panel
  await io.reveal('[data-inspector] [data-demolish]');
  const inSight = await S(page, () => {
    const p = document.querySelector('[data-inspector]').getBoundingClientRect();
    const b = document.querySelector('[data-inspector] [data-demolish]').getBoundingClientRect();
    return b.top >= p.top - 0.5 && b.bottom <= p.bottom + 0.5;
  });
  await io.cancel(); // its ×
  T.ok("the Dock's panel opened with a tap on it, scrolled to Demolish with a swipe, closed with its ×", !!panel && inSight && (await until(page, () => document.querySelector('[data-inspector]').hidden, null, { soft: true })) !== null);
  await io.press('[data-smog-meter]');
  const smog = await until(page, () => !document.querySelector('[data-smog-panel]').hidden, null, { soft: true });
  await shot('smog');
  await io.press('[data-smog-close]');
  T.ok('the smog panel opened from the band and closed with its ×', !!smog && (await until(page, () => document.querySelector('[data-smog-panel]').hidden, null, { soft: true })) !== null);

  // ---------- 5. Pause -> Save game -> slot 1, the page reloaded, Load ----------
  const before = await S(page, () => {
    const s = window.scrapbot.session().s;
    return { buildings: s.buildings.map((b) => b.type).sort().join(','), floor: s.floor.filter((f) => f === 1).length };
  });
  await io.pauseMenu();
  await shot('pause');
  await io.menu(await G.menuButton(page, 'Save game'));
  await io.menu('#modal-root [data-slot="1"]');
  await until(page, () => !!localStorage.getItem('scrapbot:save:1'), null, { what: 'slot 1 written' });
  await shot('saved');
  await io.menu(await G.menuButton(page, 'Back'));
  await io.menu(await G.menuButton(page, 'Resume'));
  T.ok('Pause -> Save game -> slot 1 -> Back -> Resume, with taps', (await until(page, () => !document.querySelector('#modal-root .modal'), null, { soft: true })) !== null && (await S(page, () => !!localStorage.getItem('scrapbot:save:1'))));
  await reload(page, io);
  await safe('after the reload');
  await G.loadFromMenu(page, io, 1);
  await shot('loaded');
  const after = await S(page, () => {
    const s = window.scrapbot.session().s;
    return { buildings: s.buildings.map((b) => b.type).sort().join(','), floor: s.floor.filter((f) => f === 1).length };
  });
  T.ok('the page reloaded, Load game -> slot 1: the same buildings and floor', JSON.stringify(after) === JSON.stringify(before), `${JSON.stringify(before)} / ${JSON.stringify(after)}`);

  // ---------- 6. the region map ----------
  await io.pauseMenu();
  await io.menu(await G.menuButton(page, 'Save & main menu'));
  await until(page, () => !document.getElementById('menu').hidden, null, { what: 'the main menu' });
  await io.menu('[data-act="new"]');
  await io.menu('#modal-root [data-mode="campaign"]');
  await until(page, () => !document.getElementById('region').hidden, null, { what: 'the region map' });
  await frames(page, 5);
  await shot('region');
  await io.press('#region [data-city="home"]');
  await io.press('#region [data-play]');
  await until(page, () => !!window.scrapbot?.session?.()?.s.cityId, null, { timeout: 20000, what: 'the campaign city' });
  await G.cityStarted(page, io);
  await G.noEvents(page);
  await io.pauseMenu();
  await io.menu(await G.menuButton(page, 'Region map'));
  T.ok('the region map from the main menu (New game -> Campaign), a city entered with Travel, back with Pause -> Region map', (await until(page, () => !document.getElementById('region').hidden, null, { soft: true, timeout: 20000 })) !== null);
  await shot('region-again');
  await settle(page).catch(() => {});
  T.ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
}, () => page);

await browser.close();
await server.close();
await T.finish();
