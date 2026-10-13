// A piece hidden behind a building (docs/MAP-STUDY.md §9, src/ui/pick.ts), with ONE input, debug build: a fence
// bought with the input on a tile, then (STAGED, by the game's own rule) a Fix-It Lab built right in front of it.
// What you see is what you press: the first press there selects the Lab drawn there; a second press on the same spot
// (a press of its own, not the second of a double press) reaches the fence behind it and shows it through the Lab;
// the next press picks the Lab again; the bulldozer pressed there takes the fence up (+2 credits).
// (This replaces the old hidden-fence probe, whose "the first click selects the fence" was not the rule.)
import { startTest } from '../lib/report.mjs';
import { launch, openGame, S, settle, until } from '../lib/page.mjs';
import { serve } from '../lib/server.mjs';
import * as G from '../lib/game.mjs';
import { seedStorage } from '../lib/profile.mjs';

const T = await startTest({ name: 'covered', input: 'mouse', size: '1280x800', seed: 777 });
const { input, size, seed } = T.cfg;
const server = await serve(T.cfg.debug);
const browser = await launch();
let page = null;

await T.run(async () => {
  const g = await openGame(browser, server, { input, size, storage: seedStorage({ profile: 'all' }) });
  page = g.page;
  const { io, errors } = g;
  await G.startFreePlay(page, io, { seed });
  await G.padWake(page, io);
  await io.speed(0);
  await G.noEvents(page);
  await G.stage(page, () => {
    const s = window.scrapbot.session().s;
    s.res.credits = 3000;
    s.res.parts = 800;
  });
  // a 2x2 spot for the Lab with a free tile behind its back corner
  const plan = await S(page, () => {
    const s = window.scrapbot.session().s;
    const A = window.scrapbot.actions;
    const hq = s.buildings.find((b) => b.type === 'hq');
    const free = (x, y) => x >= 0 && y >= 0 && x < 56 && y < 36 && s.occ[y * 56 + x] === -1 && (s.tiles[y * 56 + x] === 0 || s.tiles[y * 56 + x] === 4) && !s.solid[y * 56 + x];
    for (let r = 4; r < 16; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = hq.x + dx;
          const y = hq.y + dy;
          if (!A.placeCheck(s, 'fixlab', x, y).ok || !free(x, y - 1) || !free(x - 1, y - 1) || !free(x - 1, y)) continue;
          return { lab: { x, y }, fence: { x, y: y - 1 } };
        }
    return null;
  });
  if (!plan) throw new Error('no spot for the Lab and the fence');
  const F = plan.fence;
  const fi = F.y * 56 + F.x;
  // the fence, bought with the input
  await G.frameOn(page, F, 3, -150);
  await G.catalogTab(page, io, 'construction');
  await io.press('[data-catalog-panel] [data-item="fence"]');
  await until(page, () => window.scrapbot.session().piece?.kind === 'fence', null, { what: 'fence in hand' });
  await G.inView(page, io, [F]);
  const pf = await G.tileScreen(page, F);
  await io.hover(pf.x, pf.y);
  await io.at(pf.x, pf.y);
  await until(page, (i) => window.scrapbot.session().s.solid[i] === 1, fi, { what: 'the fence placed' });
  await io.cancel();
  await io.cancel();
  await until(page, () => !window.scrapbot.session().catalog && !window.scrapbot.session().piece, null, { what: 'catalog closed' });
  // the Lab in front of it (staged with the game's rule, finished)
  const lab = await S(page, (p) => {
    const s = window.scrapbot.session().s;
    const A = window.scrapbot.actions;
    const b = A.placeBuilding(s, 'fixlab', p.x, p.y);
    b.built = 1;
    b.status = 'ok';
    return b.id;
  }, plan.lab);
  T.note('staged: a finished Fix-It Lab placed right in front of the fence');
  await G.frameOn(page, F, 3, -150);
  await settle(page);
  // a point over the fence's tile where the Lab is drawn
  const p = await S(page, ([x, y, lab]) => {
    const r = window.scrapbot.session().renderer;
    const c = r.tileToScreen(x, y);
    for (let d = 0; d < 12; d++)
      for (const [dx, dy] of [[0, -d], [d, 0], [-d, 0], [0, d]]) {
        const px = Math.round(c.x + dx);
        const py = Math.round(c.y + dy);
        if (r.screenToTile(px, py).x === x && r.screenToTile(px, py).y === y && r.pickBuilding(px, py) === lab && document.elementFromPoint(px, py) === r.canvas) return { x: px, y: py };
      }
    return null;
  }, [F.x, F.y, lab]);
  T.ok('the Lab is drawn over the fence\'s tile (a point there picks the Lab)', !!p, JSON.stringify(p));
  const credits0 = (await G.res(page)).credits;
  await io.at(p.x, p.y);
  const first = await until(page, (lab) => window.scrapbot.session().selectedId === lab, lab, { soft: true, timeout: 4000 });
  T.ok(`a press there (${io.label}) selects the Lab drawn there`, first !== null);
  await io.at(p.x, p.y);
  const second = await until(page, (i) => window.scrapbot.session().selectedPiece === i, fi, { soft: true, timeout: 4000 });
  const info = await G.panelInfo(page);
  T.ok('a second press on the same spot, a press of its own, reaches the fence behind it: its panel', second !== null && info.name === 'Fence', JSON.stringify(info));
  await T.shot(page, 'fence-behind-selected');
  await io.at(p.x, p.y);
  const third = await until(page, (lab) => window.scrapbot.session().selectedId === lab, lab, { soft: true, timeout: 4000 });
  T.ok('the next press picks the Lab again', third !== null);
  await io.cancel();
  // the bulldozer there
  if (io.pad) await io.padButton('x');
  else await io.press('[data-doze]');
  await until(page, () => window.scrapbot.session().bulldoze, null, { what: 'the bulldozer' });
  await io.hover(p.x, p.y);
  await io.at(p.x, p.y);
  const gone = await until(page, (i) => window.scrapbot.session().s.solid[i] === 0, fi, { soft: true, timeout: 4000 });
  const credits1 = (await G.res(page)).credits;
  T.ok('the bulldozer pressed there takes the fence up (+2 credits); the Lab stands', gone !== null && Math.abs(credits1 - credits0 - 2) < 1e-6 && (await S(page, (lab) => window.scrapbot.session().s.buildings.some((b) => b.id === lab), lab)), `credits ${credits0} -> ${credits1}`);
  await io.cancel();
  T.ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
}, () => page);

await browser.close();
await server.close();
await T.finish();
