// The Recycler's module slot in all five states (docs/MODULAR-INC2.md §2, §4), mouse, debug build, on the 0.6 city of
// tests/fixtures/save-0.6.json loaded from the Load menu:
//  A. a NEW profile: the save proves the magnet (211 parts made) and the planter (594 scrap): one grouped notice; the
//     magnet "Can be installed" with its price, the sorter "To discover" with goal and the city's progress, Install
//     greyed out; short of money (STAGED: 10 credits) the magnet is "Not now" with the reason; installed (paid once):
//     "Installed"; the catalog's module rows: "Not now · Already installed", a Purifier's nozzle "To discover"
//  B. every project discovered: magnet installed -> the sorter "Slot taken" with the reason, Install greyed out; the
//     magnet removed (confirmed; refund shown = refund paid) -> the sorter "Can be installed"; the sorter installed ->
//     the magnet "Slot taken".
import { startTest } from '../lib/report.mjs';
import { launch, openGame, S, settle, until } from '../lib/page.mjs';
import { serve } from '../lib/server.mjs';
import * as G from '../lib/game.mjs';
import { fixture, metaFor, seedStorage } from '../lib/profile.mjs';
import { costStr, parseCost, refundOf, sameCost } from '../lib/spec.mjs';

const T = await startTest({ name: 'module-slots', input: 'mouse', size: '1280x800' });
const server = await serve(T.cfg.debug);
const browser = await launch();
let page = null;
const FIX06 = fixture('save-0.6.json');

async function openOld(profile) {
  const g = await openGame(browser, server, { input: T.cfg.input, size: T.cfg.size, storage: seedStorage({ profile, keys: { 'save:2': FIX06, 'meta:2': metaFor(FIX06) } }) });
  page = g.page;
  await G.loadFromMenu(page, g.io, 2);
  await g.io.speed(0);
  await G.noEvents(page);
  const rec = await S(page, () => window.scrapbot.session().s.buildings.find((b) => b.type === 'recycler').id);
  return { ...g, rec };
}
async function selectRecycler(page, io, rec) {
  const d = await S(page, (id) => {
    const b = window.scrapbot.session().s.buildings.find((o) => o.id === id);
    return { x: b.x + 1, y: b.y + 1 };
  }, rec);
  await G.frameOn(page, d, 3, -160);
  await settle(page);
  const p = await G.buildingPoint(page, rec);
  await io.at(p.x, p.y);
  await until(page, (id) => window.scrapbot.session().selectedId === id, rec, { what: 'the Recycler selected' });
  await settle(page);
}
const res = (page) => G.res(page);

await T.run(async () => {
  // ---------- A. a new profile ----------
  {
    const { io, errors, rec } = await openOld('new');
    await settle(page);
    const note = await S(page, () => {
      const n = document.querySelector('[data-project-note]');
      return n && !n.hidden ? { title: n.querySelector('[data-note-title]').textContent, label: n.getAttribute('aria-label') } : null;
    });
    T.ok('the 0.6 city loaded on a new profile: magnet and planter proven by its data, one grouped notice', note?.title === 'New projects (2)' && note.label === 'New project: Magnetic separator, Planter', JSON.stringify(note));
    await selectRecycler(page, io, rec);
    let mg = await G.slotInfo(page, 'recyclerMagnet');
    let so = await G.slotInfo(page, 'recyclerSorter');
    T.ok('magnet: "Can be installed" + icon, price shown (40 credits + 15 parts), Install enabled', mg?.state === 'available' && mg.label === 'Can be installed' && mg.icon && mg.install === true && /40 credits \+ 15 parts/.test(mg.price ?? ''), JSON.stringify(mg));
    T.ok('sorter: "To discover" + icon, goal "Make 400 parts", progress "2xx / 400 in this city", Install greyed out', so?.state === 'locked' && so.label === 'To discover' && so.icon && so.reason === 'Make 400 parts' && /^2\d\d \/ 400 in this city$/.test(so.progress ?? '') && so.install === false, JSON.stringify(so));
    await io.reveal('[data-inspector] [data-mod="recyclerSorter"]');
    await T.shot(page, 'slot-available-and-to-discover');
    // short of money: Not now
    const keep = await res(page);
    await G.stage(page, () => (window.scrapbot.session().s.res.credits = 10));
    T.note('staged: 10 credits (to see the slot short of money)');
    mg = await G.slotInfo(page, 'recyclerMagnet');
    T.ok('magnet with 10 credits: "Not now" + icon, the reason says what is missing, Install greyed out', mg?.state === 'cantBuy' && mg.label === 'Not now' && mg.icon && /credits/.test(mg.reason ?? '') && mg.install === false, JSON.stringify(mg));
    await G.stage(page, (c) => (window.scrapbot.session().s.res.credits = c), keep.credits);
    T.note('staged: the credits put back');
    await settle(page);
    // install
    const b0 = await res(page);
    await io.press('[data-inspector] [data-install="recyclerMagnet"]');
    await until(page, (id) => window.scrapbot.session().s.buildings.find((b) => b.id === id).modules?.includes('recyclerMagnet'), rec, { what: 'the magnet installed' });
    const b1 = await res(page);
    mg = await G.slotInfo(page, 'recyclerMagnet');
    so = await G.slotInfo(page, 'recyclerSorter');
    T.ok('Install (one press): "Installed" + icon, paid 40 credits + 15 parts once', mg?.state === 'installed' && mg.label === 'Installed' && mg.icon && Math.abs(b0.credits - b1.credits - 40) < 1e-6 && Math.abs(b0.parts - b1.parts - 15) < 1e-6, `${JSON.stringify(mg)} paid ${b0.credits - b1.credits} / ${b0.parts - b1.parts}`);
    T.ok('the sorter is still "To discover" (a project, not the slot, holds it back)', so?.state === 'locked', JSON.stringify(so));
    await io.cancel();
    // the catalog's module rows
    await G.catalogTab(page, io, 'modules');
    const rowMg = await G.rowInfo(page, 'recyclerMagnet');
    const rowNz = await G.rowInfo(page, 'purifierNozzle');
    const rowDk = await G.rowInfo(page, 'dockStorage');
    T.ok('catalog: magnet row "Not now · Already installed"; nozzle "To discover" with its goal; storage module "Can be bought" (a finished Dock)', rowMg.state === 'cantBuy' && /Already installed/.test(rowMg.reason ?? '') && rowNz.state === 'locked' && !!rowNz.goal && rowDk.state === 'available', JSON.stringify({ rowMg, rowNz: rowNz.goal, rowDk: rowDk.state }));
    await T.shot(page, 'catalog-modules');
    T.ok('A: no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
    await page.context().close();
  }
  // ---------- B. every project discovered ----------
  {
    const { io, errors, rec } = await openOld('all');
    await selectRecycler(page, io, rec);
    let mg = await G.slotInfo(page, 'recyclerMagnet');
    let so = await G.slotInfo(page, 'recyclerSorter');
    T.ok('every project discovered: magnet and sorter "Can be installed"', mg?.state === 'available' && so?.state === 'available', `${mg?.state} ${so?.state}`);
    await io.press('[data-inspector] [data-install="recyclerMagnet"]');
    await until(page, (id) => window.scrapbot.session().s.buildings.find((b) => b.id === id).modules?.includes('recyclerMagnet'), rec, { what: 'the magnet installed' });
    so = await G.slotInfo(page, 'recyclerSorter');
    T.ok('magnet installed: the sorter "Slot taken" + icon, "Slot taken by Magnetic separator: remove it first", Install greyed out', so?.state === 'slotTaken' && so.label === 'Slot taken' && so.icon && so.reason === 'Slot taken by Magnetic separator: remove it first' && so.install === false, JSON.stringify(so));
    await io.reveal('[data-inspector] [data-mod="recyclerSorter"]');
    await T.shot(page, 'slot-taken');
    // remove the magnet: Remove, then its confirmation
    mg = await G.slotInfo(page, 'recyclerMagnet');
    await io.press('[data-inspector] [data-remove="recyclerMagnet"]');
    await page.waitForSelector('[data-inspector] [data-remove-confirm="recyclerMagnet"]', { timeout: 5000 });
    const label = await S(page, () => document.querySelector('[data-inspector] [data-remove-confirm="recyclerMagnet"]').textContent.trim());
    const b0 = await res(page);
    await io.press('[data-inspector] [data-remove-confirm="recyclerMagnet"]');
    await until(page, (id) => !window.scrapbot.session().s.buildings.find((b) => b.id === id).modules?.includes('recyclerMagnet'), rec, { what: 'the magnet removed' });
    const b1 = await res(page);
    const paid = { credits: b1.credits - b0.credits, parts: b1.parts - b0.parts, scrap: b1.scrap - b0.scrap };
    T.ok(`the magnet removed (Remove, then "${label}"): ${costStr(refundOf('recyclerMagnet'))} back, as shown`, sameCost(parseCost(label), refundOf('recyclerMagnet')) && sameCost(paid, parseCost(label)), JSON.stringify(paid));
    mg = await G.slotInfo(page, 'recyclerMagnet');
    so = await G.slotInfo(page, 'recyclerSorter');
    T.ok('the slot free again: both "Can be installed"', mg?.state === 'available' && so?.state === 'available', `${mg?.state} ${so?.state}`);
    await io.press('[data-inspector] [data-install="recyclerSorter"]');
    await until(page, (id) => window.scrapbot.session().s.buildings.find((b) => b.id === id).modules?.includes('recyclerSorter'), rec, { what: 'the sorter installed' });
    mg = await G.slotInfo(page, 'recyclerMagnet');
    so = await G.slotInfo(page, 'recyclerSorter');
    T.ok('the sorter installed: "Installed"; the magnet "Slot taken by Precision sorter: remove it first"', so?.state === 'installed' && mg?.state === 'slotTaken' && mg.reason === 'Slot taken by Precision sorter: remove it first', `${JSON.stringify(so)} ${JSON.stringify(mg)}`);
    T.ok('B: no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  }
}, () => page);

await browser.close();
await server.close();
await T.finish();
