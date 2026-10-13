// The 24 catalog items end to end with ONE input (mouse+keyboard | CDP touch | simulated Gamepad API), on the debug
// build, a test profile with every project discovered. Free play, the clock paused with the input.
//  1. the 16 pieces: the row's price in sight before buying, taken from the catalog, turned in hand (when it turns),
//     placed with one press (charged once, the tool stays), the tool put away (free); mouse also drags a row of 3 fences
//  2. the 8 modules: taken from the catalog and installed with one press on their finished building
//  3. each piece selected with a press on it: its panel (tag, name, Rotate iff it turns, Move iff a decoration, Remove
//     with its refund); the gate and the statue turned again from the panel
//  4. the 10 decorations moved one tile (free; turn and look kept); one move cancelled, one refused destination
//  5. saved from the pause menu (slot 1), the page RELOADED, Load from the main menu: every piece, turn, look, surface,
//     module and counter back
//  6. every piece removed from its panel and every module from its building's panel (refund shown = refund paid), the
//     floor with the bulldozer; the ledger closes.
// The hook READS state and STAGES only (money, finished buildings, events off, the first camera framing): every press,
// pan and turn is the input under test.
import { startTest } from '../lib/report.mjs';
import { frames, launch, openGame, reload, S, until } from '../lib/page.mjs';
import { serve } from '../lib/server.mjs';
import * as G from '../lib/game.mjs';
import { Ledger } from '../lib/ledger.mjs';
import { ITEMS, MODULE_KINDS, PIECE_KINDS, TAG, ZERO, costStr, neg, parseCost, refundOf, sameCost } from '../lib/spec.mjs';
import { seedStorage } from '../lib/profile.mjs';

const T = await startTest({ name: 'items', input: 'mouse', size: '1280x800', seed: 2026 });
const { input, size, seed } = T.cfg;
const server = await serve(T.cfg.debug);
const browser = await launch();
let page = null;

const rowSel = (k) => `[data-catalog-panel] [data-item="${k}"]`;
const idx = (t) => t.y * 56 + t.x;
const norm = (f) => String(f).replace(/fountain\/[123]$/, 'fountain/*');
const how = { mouse: 'mouse', touch: 'finger', pad: 'pad' }[input];

await T.run(async () => {
  const g = await openGame(browser, server, { input, size, storage: seedStorage({ profile: 'all' }) });
  page = g.page;
  const { io, errors } = g;
  const W = g.size.w;

  // ---------- the city ----------
  await G.startFreePlay(page, io, { seed });
  await G.padWake(page, io);
  await io.speed(0);
  T.ok('free play city from the menus, the clock paused with the input', (await G.read(page)).speed === 0);
  await G.noEvents(page);
  const blk = await G.freeBlock(page, 8, 9, 1);
  if (!blk) throw new Error('no 8 x 9 block of free ground');
  const B = await G.placeFinished(page, ['dock', 'smelter', 'recycler', 'recycler', 'factory', 'pods', 'solar', 'purifier'], blk);
  if (B.error) throw new Error(B.error);
  await G.stage(page, () => {
    const s = window.scrapbot.session().s;
    s.res.credits = 9000;
    s.res.parts = 900;
    s.res.scrap = 100;
  });
  const BID = { dockStorage: B.dock[0], smelterFilter: B.smelter[0], recyclerMagnet: B.recycler[0], recyclerSorter: B.recycler[1], factoryArm: B.factory[0], podsCapsule: B.pods[0], solarTracker: B.solar[0], purifierNozzle: B.purifier[0] };
  await G.frameOn(page, { x: blk.x0 + 4, y: blk.y0 + 4 }, 2, Math.round((W / 2 - Math.min(400, W * 0.36)) / 2));
  const L = new Ledger(T, page);
  await L.start('staged: 9000 credits, 900 parts, 100 scrap; 8 finished buildings; events off');
  const onPan = (label) => L.step(label, ZERO);

  // the 16 pieces on every other tile of every other row; each decoration moves one tile right
  const POS = {};
  PIECE_KINDS.forEach((k, i) => (POS[k] = { x: blk.x0 + (i % 4) * 2, y: blk.y0 + Math.floor(i / 4) * 2 }));
  const DEST = Object.fromEntries(PIECE_KINDS.filter((k) => ITEMS[k].move).map((k) => [k, { x: POS[k].x + 1, y: POS[k].y }]));
  const at = { ...POS };

  const placedOn = (t, k) =>
    S(
      page,
      ([x, y, layer, code]) => {
        const s = window.scrapbot.session().s;
        const i = y * 56 + x;
        return layer === 'surface' ? s.floor[i] === code : s.solid[i] === code;
      },
      [t.x, t.y, ITEMS[k].layer, ITEMS[k].code],
    );

  async function pick(k) {
    const it = ITEMS[k];
    await G.catalogTab(page, io, it.cat);
    await io.reveal(rowSel(k));
    const row = await G.rowInfo(page, k);
    T.ok(`${k}: row "${it.name}" shows ${costStr(it.cost)}, "Can be bought", in sight before buying`, row && row.name === it.name && sameCost(row.cost, it.cost) && row.state === 'available' && row.inSight && row.pic, JSON.stringify(row));
    await io.press(rowSel(k));
    await until(page, (k) => window.scrapbot.session().piece?.kind === k, k, { what: `${k} in hand` });
    await L.step(`${k}: taken in hand from its row`, ZERO);
  }

  async function putAway() {
    await io.cancel();
    await until(page, () => !window.scrapbot.session().piece, null, { what: 'the tool put away' });
    await L.step('tool put away', ZERO);
  }

  // ---------- 1. the 16 pieces ----------
  await G.openCatalog(page, io);
  for (const k of PIECE_KINDS) {
    const it = ITEMS[k];
    await pick(k);
    let rot = null;
    if (it.rots > 1) {
      const r0 = (await G.read(page)).piece.rot;
      rot = (r0 + 1) % it.rots;
      await io.rotate();
      const got = await until(page, (w) => window.scrapbot.session().piece?.rot === w, rot, { soft: true, timeout: 4000 });
      T.ok(`${k}: turned in hand ${r0} -> ${rot} (${io.mouse ? 'R' : io.touch ? 'the Rotate button' : 'Y'})`, got !== null);
      await L.step(`${k}: turned in hand`, ZERO);
    }
    const t = POS[k];
    await G.inView(page, io, [t], onPan);
    const p = await G.tileScreen(page, t);
    await io.hover(p.x, p.y);
    await io.at(p.x, p.y);
    const ok = await until(page, ([x, y, layer, code]) => {
      const s = window.scrapbot.session().s;
      const i = y * 56 + x;
      return layer === 'surface' ? s.floor[i] === code : s.solid[i] === code;
    }, [t.x, t.y, it.layer, it.code], { soft: true, timeout: 4000 });
    const r = await L.step(`${k}: placed with one press (${how})`, neg(it.cost), { placed: 1 });
    const ta = await G.tileAt(page, t);
    T.ok(`${k}: stands on (${t.x},${t.y})${rot !== null ? ` turned ${rot}` : ''}; the tool stays in hand`, !!ok && r.piece?.kind === k && (rot === null || ta.rot === rot), JSON.stringify({ ta, piece: r.piece }));
    await putAway();
  }
  if (io.mouse) {
    // a row of 3 fences dragged with the left button: 3 laid, 3 paid
    await pick('fence');
    const a = { x: blk.x0, y: blk.y0 + 8 };
    const b = { x: blk.x0 + 2, y: blk.y0 + 8 };
    await G.inView(page, io, [a, b], onPan);
    const pa = await G.tileScreen(page, a);
    const pb = await G.tileScreen(page, b);
    await io.pace();
    await page.mouse.move(pa.x, pa.y, { steps: 3 });
    await page.mouse.down();
    for (let s = 1; s <= 12; s++) await page.mouse.move(pa.x + ((pb.x - pa.x) * s) / 12, pa.y + ((pb.y - pa.y) * s) / 12);
    await page.mouse.up();
    io.mark();
    await frames(page, 3);
    await L.step('a row of 3 fences dragged with the left button: 3 laid', neg({ credits: 12 }), { placed: 3 });
    await putAway();
  }

  // ---------- 2. the 8 modules ----------
  const bInfo = (id) =>
    S(page, (id) => {
      const b = window.scrapbot.session().s.buildings.find((o) => o.id === id);
      const d = window.scrapbot.defs.BUILDINGS[b.type];
      return { type: b.type, x: b.x + Math.floor(d.w / 2), y: b.y + Math.floor(d.h / 2), modules: [...(b.modules ?? [])] };
    }, id);
  async function aimAt(id) {
    const bi = await bInfo(id);
    await G.inView(page, io, [{ x: bi.x, y: bi.y }], onPan);
    let p = await G.buildingPoint(page, id);
    if (!p) {
      await io.pan(-60, 40, await G.home(page));
      await L.step('pan (to uncover the building)', ZERO);
      p = await G.buildingPoint(page, id);
    }
    if (!p) throw new Error(`no point on building ${id} in sight`);
    return p;
  }
  for (const m of MODULE_KINDS) {
    await pick(m);
    const id = BID[m];
    const p = await aimAt(id);
    await io.hover(p.x, p.y);
    await io.at(p.x, p.y);
    const ok = await until(page, ([id, m]) => window.scrapbot.session().s.buildings.find((b) => b.id === id)?.modules?.includes(m), [id, m], { soft: true, timeout: 4000 });
    const r = await L.step(`${m}: installed with one press on its ${ITEMS[m].building}`, neg(ITEMS[m].cost), { mods: 1, world: false });
    T.ok(`${m}: on the ${ITEMS[m].building}; the tool stays in hand`, !!ok && r.piece?.kind === m, JSON.stringify(r.piece));
    await putAway();
  }
  // close the catalog
  await io.cancel();
  await until(page, () => !window.scrapbot.session().catalog, null, { what: 'the catalog closed' });
  await G.inView(page, io, [POS.floor, POS.statue], onPan);
  await T.shot(page, 'placed-all');

  // ---------- 3. + 4. select every piece; move the decorations ----------
  async function select(t, surface) {
    await G.inView(page, io, [t], onPan);
    const p = surface ? await G.tileScreen(page, t) : await G.piecePoint(page, t);
    if (!p) throw new Error(`no point on the piece at ${t.x},${t.y}`);
    await io.at(p.x, p.y);
    return (await until(page, (i) => window.scrapbot.session().selectedPiece === i && !document.querySelector('[data-inspector]').hidden, idx(t), { soft: true, timeout: 4000 })) !== null;
  }
  async function closePanel() {
    if (!(await G.shown(page, '[data-inspector]'))) return;
    await io.cancel();
    await until(page, () => document.querySelector('[data-inspector]').hidden && window.scrapbot.session().selectedPiece < 0 && window.scrapbot.session().selectedId < 0, null, { what: 'the panel closed' });
  }
  for (const k of PIECE_KINDS) {
    const it = ITEMS[k];
    const t = at[k];
    const sel = await select(t, it.layer === 'surface');
    const info = await G.panelInfo(page);
    const want = refundOf(k);
    T.ok(`${k}: selected with a press on it; panel "${TAG[it.cat]}" / "${it.name}", Rotate ${it.rots > 1 ? 'shown' : 'absent'}, Move ${it.move ? 'shown' : 'absent'}, Remove (+${costStr(want)})`, sel && info.open && info.tag === TAG[it.cat] && info.name === it.name && info.rotate === it.rots > 1 && info.move === !!it.move && sameCost(parseCost(info.remove), want), JSON.stringify(info));
    await L.step(`${k}: selected`, ZERO);
    if (k === 'gate' || k === 'statue') {
      const r0 = (await G.tileAt(page, t)).rot;
      await io.rotate('[data-inspector]');
      const want2 = (r0 + 1) % it.rots;
      const got = await until(page, ([i, w]) => window.scrapbot.session().s.rot[i] === w, [idx(t), want2], { soft: true, timeout: 4000 });
      T.ok(`${k}: turned again from its panel (${io.mouse ? 'R' : 'the panel\'s Rotate'}) ${r0} -> ${want2}, free`, got !== null);
      await L.step(`${k}: turned from its panel`, ZERO);
    }
    if (it.move) {
      const look0 = norm(await G.frameName(page, t));
      const t0 = await G.tileAt(page, t);
      if (k === 'bench') {
        // a move started and cancelled: it stays, still selected
        await io.press('[data-inspector] [data-move-piece]');
        await until(page, (i) => window.scrapbot.session().moving === i, idx(t), { what: 'moving' });
        await io.cancel();
        const st = await until(page, (i) => window.scrapbot.session().moving === -1 && window.scrapbot.session().selectedPiece === i, idx(t), { soft: true, timeout: 4000 });
        T.ok(`bench: a move cancelled (${io.mouse ? 'Esc' : io.touch ? 'Done' : 'B'}): it stays, still selected`, st !== null && (await G.tileAt(page, t)).solid === it.code);
        await L.step('bench: move cancelled', ZERO);
      }
      await io.press('[data-inspector] [data-move-piece]');
      const mv = await until(page, (i) => window.scrapbot.session().moving === i, idx(t), { soft: true, timeout: 4000 });
      const pi = await G.panelInfo(page);
      T.ok(`${k}: Move: moving; the panel says what to do and offers Done (no Remove, Rotate or Move)`, mv !== null && pi.done && !pi.remove && !pi.rotate && !pi.move, JSON.stringify(pi));
      if (k === 'tree') {
        // a refused destination: the fountain's tile
        await G.clearFeed(page);
        await G.inView(page, io, [at.fountain], onPan);
        const pf = await G.tileScreen(page, at.fountain);
        await io.hover(pf.x, pf.y);
        await io.at(pf.x, pf.y);
        const refused = await until(page, () => [...document.querySelectorAll('[data-feed] .msg')].some((m) => (m.dataset.text ?? m.textContent).includes('A fountain is in the way')), null, { soft: true, timeout: 4000 });
        const still = await G.read(page);
        T.ok('tree: onto the fountain: refused ("A fountain is in the way"), still moving, still in place', refused !== null && still.moving === idx(t) && (await G.tileAt(page, t)).solid === it.code);
        await L.step('tree: refused destination', ZERO);
      }
      const d = DEST[k];
      await G.inView(page, io, [d], onPan);
      const pd = await G.tileScreen(page, d);
      await io.hover(pd.x, pd.y);
      await io.at(pd.x, pd.y);
      const moved = await until(page, ([i, code]) => window.scrapbot.session().s.solid[i] === code, [idx(d), it.code], { soft: true, timeout: 4000 });
      const r = await L.step(`${k}: moved one tile (free, nothing counted)`, ZERO);
      const t1 = await G.tileAt(page, d);
      const look1 = norm(await G.frameName(page, d));
      T.ok(`${k}: moved to (${d.x},${d.y}): same turn (${t0.rot}) and look (${look0}), old tile empty, selected there`, moved !== null && t1.rot === t0.rot && look1 === look0 && (await G.tileAt(page, t)).solid === 0 && r.moving === -1 && r.selectedPiece === idx(d), JSON.stringify({ t1, look0, look1, moving: r.moving, sel: r.selectedPiece }));
      at[k] = d;
    }
    await closePanel();
  }
  await G.inView(page, io, [POS.floor, DEST.statue], onPan);
  await T.shot(page, 'after-moves');

  // ---------- 5. save, reload, Load ----------
  const capture = () =>
    S(page, () => {
      const ses = window.scrapbot.session();
      const s = ses.s;
      const list = [];
      for (let i = 0; i < s.solid.length; i++) if (s.solid[i]) list.push(`${i}:${s.solid[i]}:${s.rot[i]}:${s.variety[i]}:${ses.renderer.pieceFrameName(s, i % 56, Math.floor(i / 56), i).replace(/fountain\/[123]$/, 'fountain/*')}`);
      const surf = [];
      for (let i = 0; i < s.floor.length; i++) if (s.floor[i]) surf.push(`${i}:${s.floor[i]}`);
      const mods = s.buildings.filter((b) => b.modules?.length).map((b) => `${b.id}:${b.type}:${b.modules.join('+')}`).sort();
      return { res: { ...s.res }, placed: s.stats.piecesPlaced, installed: s.stats.modulesInstalled, list, surf, mods };
    });
  const saved = await capture();
  const raw = await G.saveFromPause(page, io, 1);
  const file = JSON.parse(raw);
  T.ok(`slot 1 written from the pause menu (${io.label}): version 3, ${saved.list.length} pieces, ${saved.surf.length} surfaces, ${saved.mods.length} buildings with a module`, file.version === 3 && (file.solids ?? []).length === saved.list.length && (file.surfaces ?? []).length + (file.floors ?? []).length === saved.surf.length && file.buildings.filter((b) => b.modules?.length).length === saved.mods.length, JSON.stringify({ version: file.version, solids: file.solids?.length, surfaces: file.surfaces?.length, floors: file.floors?.length }));
  await reload(page, io);
  // the city's resources on its first frame (it runs until the input pauses it)
  await S(page, () => {
    window.__e2eFirst = null;
    const tick = () => {
      const ses = window.scrapbot?.session?.();
      if (ses && !window.__e2eFirst) window.__e2eFirst = { res: { ...ses.s.res }, time: ses.s.time };
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await G.loadFromMenu(page, io, 1);
  await io.speed(0);
  await G.noEvents(page);
  const first = await S(page, () => window.__e2eFirst);
  const loaded = await capture();
  const diff = saved.list.filter((x, i) => loaded.list[i] !== x);
  T.ok(`page reloaded, Load from the main menu (${io.label}): all ${saved.list.length} pieces back with kind, turn, kept look and frame; all ${saved.surf.length} surfaces; every module`, diff.length === 0 && loaded.list.length === saved.list.length && loaded.surf.join() === saved.surf.join() && loaded.mods.join() === saved.mods.join(), diff.slice(0, 4).join(' | ') + ` mods ${loaded.mods.join(' ')}`);
  T.ok('after Load: catalog objects placed and modules installed counters as saved', loaded.placed === saved.placed && loaded.installed === saved.installed, `${saved.placed}/${saved.installed} -> ${loaded.placed}/${loaded.installed}`);
  T.ok('after Load: resources on the first frame as saved (credits, parts, scrap within one sim step)', first && Math.abs(first.res.credits - file.res.credits) < 1 && Math.abs(first.res.parts - file.res.parts) < 1 && Math.abs(first.res.scrap - file.res.scrap) < 1 && Math.abs(file.res.credits - saved.res.credits) < 1e-6, JSON.stringify({ saved: saved.res, file: file.res, first }));
  await L.staged('loaded from slot 1 (the city ran until the input paused it)');
  await G.frameOn(page, { x: blk.x0 + 4, y: blk.y0 + 4 }, 2, Math.round((W / 2 - Math.min(400, W * 0.36)) / 2));
  await T.shot(page, 'after-load');

  // ---------- 6. remove everything ----------
  for (const k of PIECE_KINDS) {
    const it = ITEMS[k];
    const t = at[k];
    const want = refundOf(k);
    if (k === 'floor') {
      // the bulldozer
      if (io.pad) await io.padButton('x');
      else await io.press('[data-doze]');
      await until(page, () => window.scrapbot.session().bulldoze, null, { what: 'the bulldozer in hand' });
      await L.step('bulldozer taken', ZERO);
      await G.inView(page, io, [t], onPan);
      const p = await G.tileScreen(page, t);
      await io.hover(p.x, p.y);
      await io.at(p.x, p.y);
      const gone = await until(page, (i) => !window.scrapbot.session().s.floor[i], idx(t), { soft: true, timeout: 4000 });
      await L.step(`floor: taken up with the bulldozer (+${costStr(want)})`, want);
      T.ok('floor: the bulldozer took it up', gone !== null);
      await io.cancel();
      await until(page, () => !window.scrapbot.session().bulldoze, null, { what: 'the bulldozer put away' });
      continue;
    }
    const sel = await select(t, it.layer === 'surface');
    const info = await G.panelInfo(page);
    const shown = parseCost(info.remove);
    await io.press('[data-inspector] [data-remove-piece]');
    const gone = await until(page, ([i, layer]) => (layer === 'surface' ? !window.scrapbot.session().s.floor[i] : !window.scrapbot.session().s.solid[i]), [idx(t), it.layer], { soft: true, timeout: 4000 });
    const before = L.last;
    const r = await L.step(`${k}: removed from its panel (+${costStr(want)})`, want);
    const paid = { credits: r.credits - before.credits, parts: r.parts - before.parts, scrap: r.scrap - before.scrap };
    T.ok(`${k}: Remove said +${costStr(shown)} and paid exactly that; the tile is empty`, sel && gone !== null && sameCost(shown, want) && sameCost(paid, shown), JSON.stringify({ label: info.remove, paid }));
    await closePanel();
  }
  for (const m of MODULE_KINDS) {
    const id = BID[m];
    const p = await aimAt(id);
    await io.at(p.x, p.y);
    await until(page, (id) => window.scrapbot.session().selectedId === id && !document.querySelector('[data-inspector]').hidden, id, { what: `the ${m} building selected` });
    if (m === 'dockStorage') await T.shot(page, 'module-panel');
    await io.press(`[data-inspector] [data-remove="${m}"]`);
    await page.waitForSelector(`[data-inspector] [data-remove-confirm="${m}"]`, { timeout: 5000 });
    const label = await S(page, (m) => document.querySelector(`[data-inspector] [data-remove-confirm="${m}"]`).textContent.trim(), m);
    const shown = parseCost(label);
    await io.press(`[data-inspector] [data-remove-confirm="${m}"]`);
    const gone = await until(page, ([id, m]) => !window.scrapbot.session().s.buildings.find((b) => b.id === id)?.modules?.includes(m), [id, m], { soft: true, timeout: 4000 });
    const before = L.last;
    const want = refundOf(m);
    const r = await L.step(`${m}: removed from the ${ITEMS[m].building}'s panel (+${costStr(want)})`, want, { world: false });
    const paid = { credits: r.credits - before.credits, parts: r.parts - before.parts, scrap: r.scrap - before.scrap };
    T.ok(`${m}: the confirmation said "${label}" and paid exactly that`, gone !== null && sameCost(shown, want) && sameCost(paid, shown), JSON.stringify({ label, paid }));
    await closePanel();
  }
  if (io.mouse) {
    // the dragged fence row: the bulldozer, three presses
    await io.press('[data-doze]');
    for (let x = 0; x < 3; x++) {
      const t = { x: blk.x0 + x, y: blk.y0 + 8 };
      await G.inView(page, io, [t], onPan);
      const p = await G.piecePoint(page, t);
      await io.at(p.x, p.y);
      await until(page, (i) => !window.scrapbot.session().s.solid[i], idx(t), { soft: true, timeout: 4000 });
      await L.step(`fence of the row (${t.x},${t.y}) bulldozed`, { credits: 2 });
    }
    await io.cancel();
  }
  const left = await S(page, (b) => {
    const s = window.scrapbot.session().s;
    let n = 0;
    for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1 + 1; x++) n += s.solid[y * 56 + x] || s.floor[y * 56 + x] ? 1 : 0;
    return n;
  }, blk);
  const mods = await S(page, () => window.scrapbot.session().s.buildings.filter((b) => b.modules?.length).length);
  T.ok('the block is empty again and no building carries a module', left === 0 && mods === 0, `pieces left ${left}, buildings with a module ${mods}`);
  await L.close();
  await T.shot(page, 'end');
  T.ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
}, () => page);

await browser.close();
await server.close();
await T.finish();
