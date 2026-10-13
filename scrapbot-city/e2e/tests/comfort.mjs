// The owner's comfort rules over all 24 catalog items, with ONE input (mouse+keyboard | CDP touch | simulated Gamepad
// API), debug build, a test profile with every project discovered, the clock paused with the input.
// Per item: the price in its row, in sight, before buying; taken in hand (nothing paid); a pan with the tool in hand
// (mouse: right and middle drag; finger swipe; right stick) moves the map, buys nothing, the tool stays; pieces: one
// press = one placement charged once, the tool stays; a double press straddling a tile edge buys one; with the smog
// panel open a press on the map only closes it, the next press buys; modules: a double press on the building
// installs once; cancelling (right click | Done | B) is free.
// Then, with a decoration in hand: a story event answered with a double press buys nothing; the smog panel's x pressed
// twice buys nothing; a double press on a catalog row gives that row's item.
// The hook READS state and STAGES: money, finished buildings, the yard cleared between items (no resource moves), the
// camera framed on the yard, the story event.
import { startTest } from '../lib/report.mjs';
import { frames, launch, openGame, S, settle, until } from '../lib/page.mjs';
import { serve } from '../lib/server.mjs';
import * as G from '../lib/game.mjs';
import { Ledger } from '../lib/ledger.mjs';
import { ITEMS, KINDS, ZERO, costStr, isModule, neg, sameCost } from '../lib/spec.mjs';
import { seedStorage } from '../lib/profile.mjs';

const T = await startTest({ name: 'comfort', input: 'mouse', size: '1280x800', seed: 2026 });
const { input, size, seed } = T.cfg;
const server = await serve(T.cfg.debug);
const browser = await launch();
let page = null;
const rowSel = (k) => `[data-catalog-panel] [data-item="${k}"]`;

await T.run(async () => {
  const g = await openGame(browser, server, { input, size, storage: seedStorage({ profile: 'all' }) });
  page = g.page;
  const { io, errors } = g;
  const W = g.size.w;
  await G.startFreePlay(page, io, { seed });
  await G.padWake(page, io);
  await io.speed(0);
  await G.noEvents(page);
  const yard = await G.freeBlock(page, 6, 6, 1);
  if (!yard) throw new Error('no free yard');
  const B = await G.placeFinished(page, ['dock', 'smelter', 'recycler', 'recycler', 'factory', 'pods', 'solar', 'purifier'], yard);
  if (B.error) throw new Error(B.error);
  await G.stage(page, () => {
    const s = window.scrapbot.session().s;
    s.res.credits = 9000;
    s.res.parts = 900;
    s.res.scrap = 120;
  });
  const BID = { dockStorage: B.dock[0], smelterFilter: B.smelter[0], recyclerMagnet: B.recycler[0], recyclerSorter: B.recycler[1], factoryArm: B.factory[0], podsCapsule: B.pods[0], solarTracker: B.solar[0], purifierNozzle: B.purifier[0] };
  // every press the game records (its notePress), with the game's own clock: a double press is told by it
  await S(page, () => {
    window.__e2ePresses = [];
    const tap = () => {
      const ses = window.scrapbot.session();
      if (ses.__e2eTapped) return;
      const orig = ses.notePress.bind(ses);
      ses.notePress = (x, y, onMap, touch) => {
        window.__e2ePresses.push({ t: performance.now(), x, y, onMap });
        return orig(x, y, onMap, touch);
      };
      ses.__e2eTapped = true;
    };
    tap();
  });
  const shift = Math.round(W / 2 - 440);
  const frameYard = () => G.frameOn(page, { x: yard.x0 + 3, y: yard.y0 + 3 }, 3, shift);
  const clearYard = () =>
    S(page, (y) => {
      const s = window.scrapbot.session().s;
      for (let yy = y.y0; yy <= y.y1; yy++)
        for (let xx = y.x0; xx <= y.x1; xx++) {
          const i = yy * 56 + xx;
          s.solid[i] = 0;
          s.floor[i] = 0;
          s.rot[i] = 0;
          s.variety[i] = 0;
          s.dirtyTiles.push(i);
        }
    }, yard);
  await frameYard();
  const L = new Ledger(T, page);
  await L.start('staged: 9000 credits, 900 parts, 120 scrap; 8 finished buildings; events off');
  const read = () => G.read(page);
  const bought = (a, b) => b.placed - a.placed + (b.mods - a.mods);
  const d = (a, b) => ({ credits: +(b.credits - a.credits).toFixed(3), parts: +(b.parts - a.parts).toFixed(3), scrap: +(b.scrap - a.scrap).toFixed(3) });
  const scr = (t) => G.tileScreen(page, t);
  const presses = () => S(page, () => window.__e2ePresses.slice(-2).map((p) => ({ ...p })));
  const panName = io.mouse ? 'right and middle drag' : io.touch ? 'finger swipe' : 'right stick';
  const cancelName = io.mouse ? 'right click' : io.touch ? 'Done' : 'B';

  // a pan with the tool in hand (mouse: the right button, then the middle one)
  async function panWithTool(at) {
    if (io.mouse) {
      await io.pan(-120, -60, at, { button: 'right' });
      await io.pan(-100, -50, at, { button: 'middle' });
    } else await io.pan(-120, -60, at);
  }
  async function cancelTool() {
    if (io.mouse) {
      // a right click on the map (the pointer is there)
      const p = await G.home(page);
      await io.pace();
      await page.mouse.click(p.x, p.y, { button: 'right' });
      io.mark();
      await frames(page, 2);
    } else await io.cancel();
    await until(page, () => !window.scrapbot.session().piece, null, { what: 'the tool put away' });
  }

  await G.openCatalog(page, io);
  for (const k of KINDS) {
    const it = ITEMS[k];
    await clearYard();
    await frameYard();
    await L.staged(`${k}: the yard cleared, the camera framed on it`);
    // the price in sight before the press that picks it
    await G.catalogTab(page, io, it.cat);
    await io.reveal(rowSel(k));
    const row = await G.rowInfo(page, k);
    await io.press(rowSel(k));
    await until(page, (k) => window.scrapbot.session().piece?.kind === k, k, { what: `${k} in hand` });
    let a = await read();
    T.ok(`${k}: price ${costStr(it.cost)} in its row, in sight, before buying; picked, nothing paid`, sameCost(row.cost, it.cost) && row.inSight && a.piece?.kind === k, JSON.stringify({ row, piece: a.piece }));
    await L.step(`${k}: picked`, ZERO);
    // a pan with the tool in hand
    const T1 = { x: yard.x0 + 1, y: yard.y0 + 1 };
    a = await read();
    await panWithTool(await scr({ x: yard.x0 + 2, y: yard.y0 + 2 }));
    let b = await read();
    T.ok(`${k}: a pan (${panName}) moves the map, buys nothing, the tool stays`, b.cam !== a.cam && bought(a, b) === 0 && b.piece?.kind === k, `cam ${a.cam} -> ${b.cam}, bought ${bought(a, b)}`);
    await L.step(`${k}: pan with the tool in hand`, ZERO);
    await frameYard();
    await L.staged(`${k}: the camera framed on the yard again`);
    if (!isModule(k)) {
      // one press, one charge, the tool stays
      const q1 = await scr(T1);
      await io.hover(q1.x, q1.y);
      await io.at(q1.x, q1.y);
      await until(page, ([i, layer, code]) => (layer === 'surface' ? window.scrapbot.session().s.floor[i] === code : window.scrapbot.session().s.solid[i] === code), [T1.y * 56 + T1.x, it.layer, it.code], { soft: true, timeout: 4000 });
      b = await L.step(`${k}: one press`, neg(it.cost), { placed: 1 });
      T.ok(`${k}: one press = one placement charged once; the tool stays`, b.piece?.kind === k);
      // a double press straddling the edge between two free tiles
      const c2 = await scr({ x: yard.x0 + 3, y: yard.y0 + 1 });
      const c3 = await scr({ x: yard.x0 + 4, y: yard.y0 + 1 });
      const off = io.touch ? 8 : 3;
      const len = Math.hypot(c3.x - c2.x, c3.y - c2.y);
      const ux = (c3.x - c2.x) / len;
      const uy = (c3.y - c2.y) / len;
      const mx = (c2.x + c3.x) / 2;
      const my = (c2.y + c3.y) / 2;
      const P = { x: Math.round(mx - ux * off), y: Math.round(my - uy * off) };
      const Q = { x: Math.round(mx + ux * off), y: Math.round(my + uy * off) };
      const tiles = await S(page, ([P, Q]) => {
        const r = window.scrapbot.session().renderer;
        return [r.screenToTile(P.x, P.y), r.screenToTile(Q.x, Q.y)];
      }, [P, Q]);
      await io.hover(P.x, P.y);
      await io.double(P.x, P.y, { gap: 90, d: { x: Q.x - P.x, y: Q.y - P.y } });
      const pr = await presses();
      const m = pr.length === 2 ? { dt: Math.round(pr[1].t - pr[0].t), px: +Math.hypot(pr[1].x - pr[0].x, pr[1].y - pr[0].y).toFixed(1) } : null;
      b = await L.step(`${k}: a double press across a tile edge`, neg(it.cost), { placed: 1 });
      const across = tiles[0].x !== tiles[1].x || tiles[0].y !== tiles[1].y;
      T.ok(`${k}: a double press straddling a tile edge (${JSON.stringify(tiles)}, as the game recorded it: ${m ? `${m.dt} ms, ${m.px} px apart` : '?'}) buys one`, across && m && m.dt < 600, JSON.stringify(m));
      // the smog panel open: a press on the map only closes it; the next press buys
      const T4 = { x: yard.x0 + 1, y: yard.y0 + 4 };
      await io.press('[data-smog-meter]');
      const open = await until(page, () => !document.querySelector('[data-smog-panel]').hidden, null, { soft: true, timeout: 4000 });
      a = await read();
      const q4 = await scr(T4);
      await io.at(q4.x, q4.y);
      await settle(page);
      b = await read();
      T.ok(`${k}: with the smog panel open, a press on the map closes it and buys nothing`, open !== null && !b.smogOpen && bought(a, b) === 0, JSON.stringify({ open, smog: b.smogOpen, n: bought(a, b) }));
      await L.step(`${k}: the press that closed the smog panel`, ZERO);
      await io.at(q4.x, q4.y);
      await until(page, ([i, layer, code]) => (layer === 'surface' ? window.scrapbot.session().s.floor[i] === code : window.scrapbot.session().s.solid[i] === code), [T4.y * 56 + T4.x, it.layer, it.code], { soft: true, timeout: 4000 });
      await L.step(`${k}: then the next press buys one`, neg(it.cost), { placed: 1 });
    } else {
      // modules: a double press on the building installs once, charged once, the tool stays
      const id = BID[k];
      await S(page, (id) => {
        const ses = window.scrapbot.session();
        const b = ses.s.buildings.find((o) => o.id === id);
        const r = ses.renderer;
        r.setZoom(3);
        r.centerOn((b.x + 1) * 16, (b.y + 1) * 16);
        r.cam.x += (innerWidth / 2 - 440) / r.pxZoom;
        r.clampCam();
      }, id);
      await L.staged(`${k}: the camera framed on the ${it.building}`);
      const p = await G.buildingPoint(page, id);
      if (!p) throw new Error(`no point on the ${it.building}`);
      await io.hover(p.x, p.y);
      await io.double(p.x, p.y, { gap: 90, d: { x: 2, y: 1 } });
      await until(page, ([id, k]) => window.scrapbot.session().s.buildings.find((b) => b.id === id)?.modules?.includes(k), [id, k], { soft: true, timeout: 4000 });
      b = await L.step(`${k}: a double press on the ${it.building}`, neg(it.cost), { mods: 1, world: false });
      T.ok(`${k}: a double press on the building installs once, charged once; the tool stays`, b.piece?.kind === k);
    }
    // cancelling is free
    a = await read();
    await cancelTool();
    b = await read();
    T.ok(`${k}: cancelling (${cancelName}) is free and puts the tool away`, !b.piece && bought(a, b) === 0 && sameCost(d(a, b), ZERO));
    await L.step(`${k}: tool put away`, ZERO);
  }
  await T.shot(page, 'after-24');

  // ---------- dialogs and panels with a decoration in hand ----------
  await clearYard();
  await frameYard();
  await L.staged('the yard cleared, the camera framed');
  await G.catalogTab(page, io, 'decorations');
  await io.press(rowSel('bench'));
  await until(page, () => window.scrapbot.session().piece?.kind === 'bench', null, { what: 'bench in hand' });
  {
    // a story event comes up; its answer pressed twice (the second press lands on the map behind it)
    const t = await scr({ x: yard.x0 + 2, y: yard.y0 + 2 });
    await io.hover(t.x, t.y);
    const a = await read();
    await S(page, () => (window.scrapbot.session().s.pendingEvent = 'satellite'));
    await page.waitForSelector('#modal-root .modal .modal-actions .btn:not(:disabled)', { timeout: 8000 });
    await until(page, () => performance.now() - window.__e2e.modalAt > 650, null, { what: 'the story dialog to take a press' });
    await T.shot(page, 'story-event');
    if (io.pad) {
      // the pad: A A (the first A puts the focus on the first answer, the second presses it)
      await io.double(t.x, t.y, { gap: 90 });
    } else {
      const btn = await io.pointOf('#modal-root .modal-actions .btn:not(:disabled)');
      await io.double(btn.x, btn.y, { gap: 90 });
    }
    await until(page, () => !document.querySelector('#modal-root .modal'), null, { soft: true, timeout: 4000 });
    const b = await read();
    const pr = await presses();
    const second = pr.length === 2 ? (pr[1].onMap ? 'on the map' : 'on the dialog') : 'not seen';
    T.ok(`a story event answered with a double press (${io.pad ? 'A A' : `the second press ${second}`}): the dialog closed, nothing bought`, !b.modal && bought(a, b) === 0, JSON.stringify({ modal: b.modal, n: bought(a, b), presses: pr.map((p) => ({ dt: Math.round(p.t - pr[0].t), onMap: p.onMap })) }));
    await L.step('story event answered with a double press (its own effect recorded, not checked)', null, { world: false });
  }
  {
    // the smog panel's x pressed twice: closed, nothing bought
    await io.press('[data-smog-meter]');
    await until(page, () => !document.querySelector('[data-smog-panel]').hidden, null, { what: 'the smog panel' });
    const x = await io.pointOf('[data-smog-panel] [data-smog-close]');
    if (io.pad) await io.steer(x.x, x.y);
    const a = await read();
    await io.double(x.x, x.y, { gap: 90 });
    await settle(page);
    const b = await read();
    const under = await S(page, ([x, y]) => (document.elementFromPoint(x, y) === window.scrapbot.session().renderer.canvas ? 'the map' : 'the interface'), [x.x, x.y]);
    T.ok(`the smog panel's x pressed twice (the second press on ${under}): closed, nothing bought`, a.smogOpen && !b.smogOpen && bought(a, b) === 0, JSON.stringify({ was: a.smogOpen, now: b.smogOpen, n: bought(a, b) }));
    await L.step('smog panel closed with a double press', ZERO);
  }
  {
    // a double press on a catalog row: that row's item, not the one the redrawn list puts under the pointer
    await cancelTool();
    await G.catalogTab(page, io, 'decorations');
    await io.reveal(rowSel('planter'));
    const p = await io.pointOf(rowSel('planter'));
    if (io.pad) await io.steer(p.x, p.y);
    await io.double(p.x, p.y, { gap: 90 });
    await settle(page);
    const b = await read();
    T.ok('a double press on the planter row: the planter in hand', b.piece?.kind === 'planter', JSON.stringify(b.piece));
    await L.step('double press on a catalog row', ZERO);
    await cancelTool();
  }
  await L.close();
  T.ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
}, () => page);

await browser.close();
await server.close();
await T.finish();
