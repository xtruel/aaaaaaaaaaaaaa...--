// Double-press guards (src/ui/presses.ts: the second press of a double click, a double tap or A A within 600 ms does
// nothing it was not meant for), with ONE input (mouse+keyboard | CDP touch | simulated Gamepad API), debug build.
// Two presses `gap` ms apart (120 and 450 ms), at the same spot, on:
//  - a module's Remove: the module stays, its confirmation is up
//  - Demolish: the building stays, its confirmation is up
//  - a module's Remove confirmation (after a deliberate Remove): removed once, never bought back by the second press
//    (it lands where Install comes up); a deliberate Install afterwards works
//  - mouse and touch: the removal confirmed, then Install pressed where it is drawn `gap` ms later: not bought back
//  - a decoration being moved: Done pressed twice ends the move and does not remove it (Remove comes where Done was);
//    Move pressed twice starts the move and nothing else
// The hook STAGES (money, a finished Recycler and Solar Arrays, three decorations on free tiles) and READS.
import { startTest } from '../lib/report.mjs';
import { launch, openGame, S, settle, until } from '../lib/page.mjs';
import { serve } from '../lib/server.mjs';
import * as G from '../lib/game.mjs';
import { seedStorage } from '../lib/profile.mjs';

const T = await startTest({ name: 'double-press', input: 'mouse', size: '1280x800', seed: 2026, gaps: [120, 450] });
const { input, size, seed, gaps } = T.cfg;
const server = await serve(T.cfg.debug);
const browser = await launch();
let page = null;
const KIND = 'recyclerMagnet';

await T.run(async () => {
  const g = await openGame(browser, server, { input, size, storage: seedStorage({ profile: 'all' }) });
  page = g.page;
  const { io, errors } = g;
  await G.startFreePlay(page, io, { seed });
  await G.padWake(page, io);
  await io.speed(0);
  await G.noEvents(page);
  const yard = await G.freeBlock(page, 6, 2, 1);
  const B = await G.placeFinished(page, ['recycler', 'solar', 'solar', 'solar', 'solar'], yard);
  const rec = B.recycler[0];
  await G.stage(page, () => {
    const s = window.scrapbot.session().s;
    s.res.credits = 3000;
    s.res.parts = 800;
  });
  // three decorations, staged on free tiles two apart: planter (5), tree (12), bench (4)
  const DECO = [
    ['planter', 5, { x: yard.x0, y: yard.y0 }],
    ['tree', 12, { x: yard.x0 + 2, y: yard.y0 }],
    ['bench', 4, { x: yard.x0 + 4, y: yard.y0 }],
  ];
  await S(page, (list) => {
    const s = window.scrapbot.session().s;
    for (const [, code, t] of list) {
      s.solid[t.y * 56 + t.x] = code;
      s.rot[t.y * 56 + t.x] = 0;
    }
  }, DECO);
  T.note('staged: 3000 credits, 800 parts, a finished Recycler and 4 Solar Arrays, a planter, a tree and a bench');
  // every click the page gets, with when and on what
  await S(page, () => {
    window.__e2eClicks = [];
    document.addEventListener('click', (e) => window.__e2eClicks.push({ t: e.timeStamp, el: e.target.closest('button')?.outerHTML.slice(0, 70) ?? e.target.tagName }), true);
  });
  const clicks = () => S(page, () => window.__e2eClicks.splice(0));
  const mods = () => S(page, (id) => [...(window.scrapbot.session().s.buildings.find((b) => b.id === id)?.modules ?? [])], rec);
  const exists = () => S(page, (id) => window.scrapbot.session().s.buildings.some((b) => b.id === id), rec);
  const res = () => G.res(page);

  async function openPanel() {
    if (await S(page, (id) => window.scrapbot.session().selectedId === id, rec)) return;
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
  // two presses `gap` ms apart on an interface button, as this input makes them
  async function twice(sel, gap) {
    await io.pace();
    await settle(page);
    await io.reveal(sel);
    const p = await io.pointOf(sel);
    if (io.pad) await io.steer(p.x, p.y);
    await clicks();
    await io.double(p.x, p.y, { gap });
    await settle(page);
    const c = await clicks();
    return { gap: c.length >= 2 ? Math.round(c[1].t - c[0].t) : null, n: c.length, on: c.map((x) => x.el) };
  }

  await openPanel();
  await io.press(`[data-inspector] [data-install="${KIND}"]`);
  await until(page, (id) => window.scrapbot.session().s.buildings.find((b) => b.id === id).modules?.includes('recyclerMagnet'), rec, { what: 'the magnet installed' });
  T.ok('a deliberate press on Install installs the magnet', (await mods()).includes(KIND));

  for (const gap of gaps) {
    // 1. Remove twice
    await openPanel();
    let r = await twice(`[data-inspector] [data-remove="${KIND}"]`, gap);
    const kept = (await mods()).includes(KIND);
    const confirm = await G.shown(page, '[data-inspector] [data-remove-confirm]');
    T.ok(`Remove pressed twice ${gap} ms apart: the module stays, its confirmation is up`, kept && confirm, `${r.n} clicks, ${r.gap} ms: ${r.on.join(' | ')}`);
    await io.press('[data-inspector] [data-remove-cancel]');
    // 2. Demolish twice
    r = await twice('[data-inspector] [data-demolish]', gap);
    T.ok(`Demolish pressed twice ${gap} ms apart: the building stays, its confirmation is up`, (await exists()) && (await G.shown(page, '[data-inspector] [data-confirm]')), `${r.n} clicks, ${r.gap} ms: ${r.on.join(' | ')}`);
    await io.press('[data-inspector] [data-cancel]');
    // 3. a deliberate Remove, then its confirmation pressed twice
    await io.press(`[data-inspector] [data-remove="${KIND}"]`);
    await page.waitForSelector('[data-inspector] [data-remove-confirm]');
    const before = await res();
    r = await twice('[data-inspector] [data-remove-confirm]', gap);
    const after = await res();
    const m = await mods();
    T.ok(`a deliberate Remove, then its confirmation pressed twice ${gap} ms apart: removed once, not bought back`, !m.includes(KIND) && after.credits >= before.credits, `${r.n} clicks, ${r.gap} ms; credits ${Math.round(before.credits)} -> ${Math.round(after.credits)}`);
    T.note(`the second press landed on: ${r.on[1] ?? 'nothing'}`);
    await io.press(`[data-inspector] [data-install="${KIND}"]`);
    await until(page, (id) => window.scrapbot.session().s.buildings.find((b) => b.id === id).modules?.includes('recyclerMagnet'), rec, { soft: true, timeout: 4000 });
    T.ok('a deliberate Install afterwards works', (await mods()).includes(KIND));
    if (!io.pad) {
      // 4. the removal confirmed, then Install pressed where it is drawn, `gap` ms after the confirmation
      await io.press(`[data-inspector] [data-remove="${KIND}"]`);
      await page.waitForSelector('[data-inspector] [data-remove-confirm]');
      await io.pace();
      await settle(page);
      const cp = await io.pointOf('[data-inspector] [data-remove-confirm]');
      await clicks();
      const t0 = Date.now();
      await io.rawPress(cp.x, cp.y, { hold: 30 });
      const ip = await until(page, (k) => {
        const e = document.querySelector(`[data-inspector] [data-install="${k}"]`);
        if (!e) return null;
        const r = e.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
      }, KIND, { timeout: 3000, what: 'Install drawn again' });
      const left = gap - (Date.now() - t0);
      if (left > 0) await new Promise((res) => setTimeout(res, left));
      const b4 = await res();
      await io.rawPress(ip.x, ip.y, { hold: 30 });
      io.mark();
      await settle(page);
      const c = await clicks();
      const a4 = await res();
      T.ok(`removal confirmed, Install pressed where it is drawn ${gap} ms later: not bought back`, !(await mods()).includes(KIND) && a4.credits >= b4.credits, `${c.length >= 2 ? Math.round(c[1].t - c[0].t) : '?'} ms, on ${c[1]?.el}`);
      await io.press(`[data-inspector] [data-install="${KIND}"]`);
      await until(page, (id) => window.scrapbot.session().s.buildings.find((b) => b.id === id).modules?.includes('recyclerMagnet'), rec, { what: 'installed again' });
    }
  }
  await T.shot(page, 'recycler-panel');
  await io.cancel();
  await until(page, () => document.querySelector('[data-inspector]').hidden, null, { soft: true, timeout: 4000 });

  // ---------- decorations: Done and Move pressed twice ----------
  for (const [kind, code, t] of DECO) {
    const i = t.y * 56 + t.x;
    await G.inView(page, io, [t]);
    const p = await G.piecePoint(page, t);
    await io.at(p.x, p.y);
    const sel = await until(page, (i) => window.scrapbot.session().selectedPiece === i, i, { soft: true, timeout: 4000 });
    T.ok(`${kind}: selected with a press on it`, sel !== null);
    await io.press('[data-inspector] [data-move-piece]');
    await until(page, (i) => window.scrapbot.session().moving === i, i, { what: `${kind} moving` });
    const b = await res();
    let r = await twice('[data-inspector] [data-move-done]', 120);
    const a = await res();
    const st = await S(page, (i) => ({ moving: window.scrapbot.session().moving, solid: window.scrapbot.session().s.solid[i] }), i);
    T.ok(`${kind}: Done pressed twice ends the move and leaves it there (not removed, nothing paid back)`, st.moving === -1 && st.solid === code && a.credits === b.credits, `${r.n} clicks, ${r.gap} ms: ${r.on.join(' | ')}`);
    r = await twice('[data-inspector] [data-move-piece]', 120);
    const st2 = await S(page, (i) => ({ moving: window.scrapbot.session().moving, solid: window.scrapbot.session().s.solid[i] }), i);
    T.ok(`${kind}: Move pressed twice: moving, nothing else changed`, st2.moving === i && st2.solid === code && (await res()).credits === a.credits, `${r.n} clicks, ${r.gap} ms: ${r.on.join(' | ')}`);
    await io.cancel();
    await io.cancel();
    await until(page, () => document.querySelector('[data-inspector]').hidden && window.scrapbot.session().selectedPiece < 0, null, { soft: true, timeout: 4000 });
  }
  T.ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
}, () => page);

await browser.close();
await server.close();
await T.finish();
