// The first campaign city (Scrapbot City) played to its end through the interface, with buildings only: no catalog
// object, no module. Playwright mouse, debug build (the hook READS the city to decide, as a player reads the screen;
// it never builds). A simple green "builder" player at speed 3: a Recycler, power, homes, docks by the junk, gardens
// and purifiers, then the Scrap Spire at 30 citizens. Story events are answered (the green choice), other dialogs
// closed, achievements and project notices waited out or panned away from; a tile that junk or a storm took between
// choosing it and pressing is chosen again (the old play.mjs crashed on such a modal).
// Passes when the city ends with the Spire (not a smog loss), with 0 catalog objects and 0 modules.
// This shows that the city can be finished without catalog objects; it is a scripted player, not a measure of fun or
// of a real player's time.
import { startTest } from '../lib/report.mjs';
import { launch, openGame, S, settle, until } from '../lib/page.mjs';
import { serve } from '../lib/server.mjs';
import * as G from '../lib/game.mjs';
import { seedStorage } from '../lib/profile.mjs';

const T = await startTest({ name: 'campaign-home', input: 'mouse', size: '1280x800', city: 'home', maxDays: 25, maxMinutes: 20 });
const { city, maxDays, maxMinutes } = T.cfg;
const server = await serve(T.cfg.debug);
const browser = await launch();
let page = null;

await T.run(async () => {
  const g = await openGame(browser, server, { input: 'mouse', size: T.cfg.size, storage: seedStorage({ profile: 'new' }) });
  page = g.page;
  const { io, errors } = g;
  const t0 = Date.now();
  const log = [];
  const say = (s) => {
    log.push(s);
    console.log(`  [${Math.round((Date.now() - t0) / 1000)} s] ${s}`);
  };
  // ---------- the campaign, the first city ----------
  await io.menu('[data-act="new"]');
  await io.menu('#modal-root [data-mode="campaign"]');
  await page.waitForSelector(`#region:not([hidden]) [data-city="${city}"]`, { timeout: 20000 });
  await io.menu(`[data-city="${city}"]`);
  await io.menu('[data-play]');
  await until(page, () => !!window.scrapbot?.session?.(), null, { timeout: 20000, what: 'the city' });
  const intro = await G.cityStarted(page, io);
  T.ok(`campaign: ${city} opens with its intro`, intro.length > 0, intro.join(' | '));
  await T.shot(page, 'start');

  const state = () =>
    S(page, () => {
      const ses = window.scrapbot.session();
      const s = ses.s;
      const d = s.derived;
      const count = {};
      for (const b of s.buildings) count[b.type] = (count[b.type] ?? 0) + 1;
      return {
        day: Math.floor(s.time / 60) + 1,
        pop: s.pop,
        res: { ...s.res },
        pollution: s.pollution,
        energyProd: d.energyProd,
        energyUse: d.energyUse,
        housing: d.housing,
        storage: d.storage,
        count,
        outcome: s.outcome?.kind ?? null,
        pendingEvent: s.pendingEvent,
        stars: [...s.stars],
        spireDone: s.spireDone,
        sludge: Array.from(s.tiles).filter((t) => t === 2).length,
        modal: !!document.querySelector('#modal-root .modal'),
        modalClass: document.querySelector('#modal-root .modal')?.className ?? '',
        modalTitle: document.querySelector('#modal-root .modal h2')?.textContent ?? '',
        build: ses.build,
        speed: ses.speed,
        pieces: { placed: s.stats.piecesPlaced ?? 0, modules: s.stats.modulesInstalled ?? 0, floors: Array.from(s.floor).filter((v) => v).length, solids: Array.from(s.solid).filter((v) => v).length },
      };
    });
  const affordable = (type) =>
    S(page, (type) => {
      const s = window.scrapbot.session().s;
      const { canAfford, buildCost } = window.scrapbot.actions;
      const def = window.scrapbot.defs.BUILDINGS[type];
      return canAfford(s, buildCost(s, type)) && !(def.minPop && s.pop < def.minPop);
    }, type);
  const findSpot = (type, near) =>
    S(page, ([type, near]) => {
      const s = window.scrapbot.session().s;
      const { placeCheck } = window.scrapbot.actions;
      const def = window.scrapbot.defs.BUILDINGS[type];
      const hq = s.buildings.find((b) => b.type === 'hq');
      let cx = hq.x;
      let cy = hq.y;
      if (near === 'junk') {
        let best = Infinity;
        for (let i = 0; i < s.tiles.length; i++) {
          if (s.tiles[i] !== 1) continue;
          const x = i % 56;
          const y = Math.floor(i / 56);
          const d = Math.hypot(x - hq.x, y - hq.y);
          if (d > 6 && d < best) {
            best = d;
            cx = x;
            cy = y;
          }
        }
      }
      for (let r = 1; r < 30; r++)
        for (let dy = -r; dy <= r; dy++)
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            const x = cx + dx;
            const y = cy + dy;
            if (placeCheck(s, type, x, y).ok) return { x, y, tx: x + Math.floor((def.w - 1) / 2), ty: y + Math.floor((def.h - 1) / 2) };
          }
      return null;
    }, [type, near]);
  const stillOk = (type, spot) => S(page, ([type, x, y]) => window.scrapbot.actions.placeCheck(window.scrapbot.session().s, type, x, y).ok, [type, spot.x, spot.y]);
  let fails = 0;
  let placed = 0;
  // one building placed through the toolbar and a press on the map; false when it did not happen (tried again later)
  async function place(type, near = 'hq') {
    for (let attempt = 0; attempt < 3; attempt++) {
      const spot = await findSpot(type, near);
      if (!spot) return false;
      if ((await state()).modal) return false;
      if ((await S(page, () => window.scrapbot.session().build)) !== type) await io.press(`[data-tool="${type}"]`);
      try {
        await G.inView(page, io, [{ x: spot.tx, y: spot.ty }]);
      } catch {
        continue;
      }
      // between choosing the tile and the press: junk landed, a storm, a notice over it? choose again
      if (!(await stillOk(type, spot))) {
        say(`${type}: the tile (${spot.x},${spot.y}) was taken meanwhile (junk, a storm): chosen again`);
        continue;
      }
      const p = await G.tileScreen(page, { x: spot.tx, y: spot.ty });
      if (!(await G.clearAt(page, p, 6))) {
        await io.pan(-80, 50, await G.home(page));
        continue;
      }
      const n0 = await S(page, () => window.scrapbot.session().s.buildings.length);
      await io.hover(p.x, p.y);
      await io.at(p.x, p.y);
      const got = await until(page, (n0) => (window.scrapbot.session().s.buildings.length > n0 ? 'built' : document.querySelector('#modal-root .modal') ? 'dialog' : null), n0, { soft: true, timeout: 3000 });
      if (got === 'dialog' && (await S(page, () => !!document.querySelector('#modal-root .speaker-corp')))) {
        // 2PM's offer: buy the missing parts and build here
        await io.menu('#modal-root .modal-actions .btn-primary');
        await until(page, (n0) => window.scrapbot.session().s.buildings.length > n0, n0, { soft: true, timeout: 3000 });
      }
      const built = (await S(page, () => window.scrapbot.session().s.buildings.length)) > n0;
      // the tool put away with a right click on the map
      if (type !== 'spire' && !(await S(page, () => !!document.querySelector('#modal-root .modal')))) {
        const h = await G.home(page);
        await io.pace();
        await page.mouse.click(h.x, h.y, { button: 'right' });
        io.mark();
      }
      if (built) {
        placed++;
        return true;
      }
    }
    fails++;
    return false;
  }
  // a dialog (a story event, an ending) can come up at any moment of a placement: the placement stops there and the
  // main loop answers the dialog first (the old play.mjs crashed on that)
  async function placeSafe(type, near) {
    try {
      return await place(type, near);
    } catch (e) {
      if (await S(page, () => !!document.querySelector('#modal-root .modal'))) {
        say(`${type}: a dialog came up during the placement, answered first`);
        return false;
      }
      fails++;
      say(`${type}: placement interrupted (${String(e.message).split('\n')[0].slice(0, 120)})`);
      return false;
    }
  }
  const tryBuild = async (type, near) => ((await affordable(type)) ? placeSafe(type, near) : false);
  async function think(st) {
    const c = (t) => st.count[t] ?? 0;
    if (st.pop >= 30 && !c('spire')) {
      if (await tryBuild('spire')) return say('the Scrap Spire placed');
      if (st.pollution > 50 && c('purifier') < 3) await tryBuild('purifier');
      if (st.res.parts > 150 && st.res.credits < 400 && c('fixlab') < 4) await tryBuild('fixlab');
      if (st.res.scrap >= st.storage * 0.9 && c('recycler') < 3) await tryBuild('recycler');
      return;
    }
    if (!c('recycler')) return void (await tryBuild('recycler'));
    if (st.energyUse + 2 > st.energyProd && (await tryBuild('solar'))) return;
    if (st.res.scrap > st.storage * 0.7 && (await tryBuild(c('recycler') <= c('fixlab') ? 'recycler' : 'fixlab'))) return;
    if (st.pop >= st.housing - 2 && (await tryBuild('pods'))) return;
    if (c('dock') < 1 + Math.floor(st.pop / 10) && (await tryBuild('dock', 'junk'))) return;
    if ((st.pollution > 25 || st.sludge > 0) && c('purifier') < 2 && (await tryBuild('purifier'))) return;
    if (c('garden') < 3 + st.pop / 6 && (await tryBuild('garden'))) return;
    if (st.res.parts > 70 && c('fixlab') < 2) await tryBuild('fixlab');
  }

  await io.speed(3);
  let ending = null;
  let lastShot = 0;
  for (;;) {
    const st = await state();
    if ((Date.now() - t0) / 60000 > maxMinutes || st.day > maxDays) {
      say(`stopped: day ${st.day}, ${((Date.now() - t0) / 60000).toFixed(1)} min`);
      break;
    }
    if (st.day - lastShot >= 5) {
      lastShot = st.day;
      await T.shot(page, `day-${String(st.day).padStart(2, '0')}`);
    }
    if (st.modal) {
      if (st.modalClass.includes('modal-ending')) {
        ending = { kind: st.outcome, day: st.day, stars: st.stars, spireDone: st.spireDone };
        say(`the ending: ${st.outcome} on day ${st.day}, stars ${st.stars}`);
        await T.shot(page, `ending-${st.outcome}`);
        break;
      }
      if (st.pendingEvent) {
        const green = await S(page, () => !!document.querySelector('#modal-root .modal-actions .btn.tone-green:not(:disabled)'));
        say(`story event "${st.modalTitle}": ${green ? 'the green choice' : 'the first choice'}`);
        await io.menu(green ? '#modal-root .modal-actions .btn.tone-green:not(:disabled)' : '#modal-root .modal-actions .btn:not(:disabled)');
      } else {
        say(`dialog "${st.modalTitle}" closed`);
        await io.menu('#modal-root .modal-actions .btn:not(:disabled)');
      }
      await until(page, () => !document.querySelector('#modal-root .modal'), null, { soft: true, timeout: 4000 });
      if ((await S(page, () => window.scrapbot.session().speed)) !== 3 && !(await S(page, () => !!document.querySelector('#modal-root .modal')))) await io.speed(3);
      continue;
    }
    if (st.outcome) {
      await settle(page);
      continue;
    }
    await think(st);
    if ((await S(page, () => window.scrapbot.session().speed)) !== 3 && !(await S(page, () => !!document.querySelector('#modal-root .modal')))) await io.speed(3);
    // a little play before the next decision (2 game seconds, or a dialog)
    const tg = await S(page, () => window.scrapbot.session().s.time);
    await until(page, (tg) => window.scrapbot.session().s.time >= tg + 2 || !!document.querySelector('#modal-root .modal') || !!window.scrapbot.session().s.outcome, tg, { soft: true, timeout: 20000 });
  }
  const end = await state();
  const mins = ((Date.now() - t0) / 60000).toFixed(1);
  T.note(`${placed} buildings placed by the player, ${fails} placements given up (tried again later); ${mins} min of wall time at speed 3; day ${end.day}`);
  T.ok(`the city ends with the Spire (not a smog loss)`, !!ending && ending.kind !== 'smog' && end.spireDone, JSON.stringify(ending));
  T.ok('no catalog object and no module was used (0 placed, 0 installed, no floor, no piece on the map)', end.pieces.placed === 0 && end.pieces.modules === 0 && end.pieces.floors === 0 && end.pieces.solids === 0, JSON.stringify(end.pieces));
  T.ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
}, () => page);

await browser.close();
await server.close();
await T.finish();
