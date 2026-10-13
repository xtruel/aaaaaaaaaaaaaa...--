// The left mouse button never pans the map (the right and middle buttons, WASD, the arrows and the screen edges do).
// A left drag of 160 px across the map in every state: nothing in hand, the catalog open, a wall (a row kind) in hand,
// a tree in hand, a planter being moved, the bulldozer. The camera does not move; with nothing in hand (or the
// catalog open) nothing is bought, selected or moved. Then the right and the middle button do pan (the control).
// Playwright mouse, debug build; the hook STAGES money and the planter, and READS.
import { startTest } from '../lib/report.mjs';
import { frames, launch, openGame, S, settle, until } from '../lib/page.mjs';
import { serve } from '../lib/server.mjs';
import * as G from '../lib/game.mjs';
import { seedStorage } from '../lib/profile.mjs';

const T = await startTest({ name: 'left-mouse', input: 'mouse', size: '1280x800', seed: 2026 });
const server = await serve(T.cfg.debug);
const browser = await launch();
let page = null;

await T.run(async () => {
  const g = await openGame(browser, server, { input: 'mouse', size: T.cfg.size, storage: seedStorage({ profile: 'all' }) });
  page = g.page;
  const { io, errors } = g;
  await G.startFreePlay(page, io, { seed: T.cfg.seed });
  await io.speed(0);
  await G.noEvents(page);
  const area = await G.freeBlock(page, 8, 5, 1);
  await G.stage(page, (a) => {
    const s = window.scrapbot.session().s;
    s.res.credits = 2000;
    s.res.parts = 200;
    s.solid[(a.y0 + 4) * 56 + a.x0 + 7] = 5; // a planter to move
  }, area);
  T.note('staged: money and a planter');
  await G.frameOn(page, { x: area.x0 + 4, y: area.y0 + 2 }, 3, -150);
  await settle(page);
  const st = () =>
    S(page, () => {
      const ses = window.scrapbot.session();
      const s = ses.s;
      return { cam: `${ses.renderer.cam.x.toFixed(2)},${ses.renderer.cam.y.toFixed(2)}`, credits: s.res.credits, placed: s.stats.piecesPlaced, solids: s.solid.reduce((a, v) => a + (v ? 1 : 0), 0), sel: ses.selectedPiece, selB: ses.selectedId, moving: ses.moving, piece: ses.piece?.kind ?? null };
    });
  const putAway = async () => {
    for (let k = 0; k < 5; k++) {
      await settle(page);
      const open = await S(page, () => {
        const ses = window.scrapbot.session();
        return !!document.querySelector('#modal-root .modal') || !!ses.piece || ses.bulldoze || ses.moving >= 0 || ses.selectedPiece >= 0 || ses.selectedId >= 0 || ses.catalog;
      });
      if (!open) return;
      await io.cancel();
    }
  };
  const a = await G.tileScreen(page, { x: area.x0 + 1, y: area.y0 + 1 });
  const b = { x: a.x + 160, y: a.y + 40 };
  const drag = async (button = 'left') => {
    await io.pace();
    await page.mouse.move(a.x, a.y, { steps: 2 });
    await page.mouse.down({ button });
    for (let k = 1; k <= 12; k++) await page.mouse.move(a.x + ((b.x - a.x) * k) / 12, a.y + ((b.y - a.y) * k) / 12);
    await page.mouse.up({ button });
    io.mark();
    await frames(page, 3);
  };
  const planter = { x: area.x0 + 7, y: area.y0 + 4 };
  for (const state of ['nothing in hand', 'the catalog open', 'a wall in hand', 'a tree in hand', 'a planter being moved', 'the bulldozer']) {
    await putAway();
    if (state === 'the catalog open') await G.openCatalog(page, io);
    if (state === 'a wall in hand' || state === 'a tree in hand') {
      const k = state === 'a wall in hand' ? 'wall' : 'tree';
      await G.catalogTab(page, io, k === 'wall' ? 'construction' : 'decorations');
      await io.press(`[data-catalog-panel] [data-item="${k}"]`);
      await until(page, (k) => window.scrapbot.session().piece?.kind === k, k, { what: `${k} in hand` });
    }
    if (state === 'a planter being moved') {
      const p = await G.piecePoint(page, planter);
      await io.at(p.x, p.y);
      await until(page, (i) => window.scrapbot.session().selectedPiece === i, planter.y * 56 + planter.x, { what: 'the planter selected' });
      await io.press('[data-inspector] [data-move-piece]');
      await until(page, (i) => window.scrapbot.session().moving === i, planter.y * 56 + planter.x, { what: 'moving' });
    }
    if (state === 'the bulldozer') {
      await io.press('[data-doze]');
      await until(page, () => window.scrapbot.session().bulldoze, null, { what: 'the bulldozer' });
    }
    const before = await st();
    await drag('left');
    const after = await st();
    T.ok(`${state}: a left drag of 160 px does not move the map`, before.cam === after.cam, `${before.cam} -> ${after.cam}`);
    if (state === 'nothing in hand' || state === 'the catalog open') T.ok(`${state}: the left drag bought, selected and moved nothing`, after.credits === before.credits && after.placed === before.placed && after.solids === before.solids && after.sel === -1 && after.selB === -1, JSON.stringify({ before, after }));
    else T.note(`${state}: the release counts as the press that says where (as with a tool in hand): credits ${(after.credits - before.credits).toFixed(0)}, ${after.placed - before.placed} placed, moving ${before.moving} -> ${after.moving}`);
  }
  await putAway();
  for (const button of ['right', 'middle']) {
    const before = await st();
    await drag(button);
    const after = await st();
    T.ok(`control: the ${button} button dragged does pan the map, buying nothing`, before.cam !== after.cam && after.credits === before.credits, `${before.cam} -> ${after.cam}`);
  }
  await T.shot(page, 'after-drags');
  T.ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
}, () => page);

await browser.close();
await server.close();
await T.finish();
