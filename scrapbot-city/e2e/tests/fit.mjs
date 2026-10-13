// Does the interface fit? 8 languages x 1024x640, 1280x720, 1280x800, 1920x1080, debug build, a NEW profile (rows to
// discover carry the longest lines: goal and progress, with a best from "another city"). A LAYOUT test: panels are
// opened and tools taken by DOM clicks and the hook (no input is being tested), and everything is measured in the DOM.
//  toolbar:  no overflow; no name, price or picture spilling out of its button; the key badge over no text
//  catalog:  browsing each tab, and with a tool in hand (fence, lamp, storage module) in its tab: the panel inside the
//            window, clear of the top bar and the build bar; tabs, filters, the tool box with Done/Rotate in sight and
//            not cut; every row can be scrolled ENTIRELY into sight, nothing covers it, none of its texts is cut sideways
//  panels:   the Recycler's and the Dock's building panels: inside the window, clear of both bars, nothing cut
//            sideways; every module card's button can be scrolled into sight and is not covered
//  menu:     the build stamp in the top-left corner clear of the logo's star; the hand-lettered "Different futures,
//            same city" (when shown) clear of the path cards' labels
// One picture per language at 1024x640 (catalog with a tool) and two at 1920x1080 (en, de).
import { startTest } from '../lib/report.mjs';
import { frames, launch, openGame, S, settle, until } from '../lib/page.mjs';
import { serve } from '../lib/server.mjs';
import * as G from '../lib/game.mjs';
import { seedStorage } from '../lib/profile.mjs';

const T = await startTest({ name: 'fit', sizes: ['1024x640', '1280x720', '1280x800', '1920x1080'], langs: ['en', 'it', 'de', 'fr', 'es', 'pt', 'pl', 'nl'] });
const server = await serve(T.cfg.debug);
const browser = await launch();
let page = null;
const BEST = { version: 1, discovered: [], best: { partsMade: 60, pop: 8, creditsEarned: 4200, scrapCollected: 250, built: 9, energyProd: 20, cleaned: 5, piecesPlaced: 12, catPets: 2 } };
const TOOLS = [
  [null, 'construction'],
  [null, 'decorations'],
  [null, 'modules'],
  ['fence', 'construction'],
  ['lamp', 'decorations'],
  ['dockStorage', 'modules'],
];

// ---------- in-page measurements ----------
const toolbarFit = () => {
  const bar = document.querySelector('[data-toolbar]');
  const r = bar.getBoundingClientRect();
  const bad = [];
  if (bar.scrollWidth > bar.clientWidth + 1) bad.push('the toolbar overflows sideways');
  if (r.right > innerWidth + 0.5 || r.left < -0.5) bad.push('the toolbar goes out of the window');
  for (const b of bar.querySelectorAll('button')) {
    const q = b.getBoundingClientRect();
    const name = b.dataset.tool ?? (b.dataset.doze !== undefined ? 'doze' : b.dataset.catalog !== undefined ? 'catalog' : '?');
    for (const n of b.querySelectorAll('.tool-name, .tool-cost, .tool-plate')) {
      const nr = n.getBoundingClientRect();
      if (n.scrollWidth > n.clientWidth + 1 || nr.left < q.left + 2 || nr.right > q.right - 2 || nr.top < q.top + 1 || nr.bottom > q.bottom - 1) bad.push(`${name}: ${n.className} spills ("${n.textContent.trim().slice(0, 20)}")`);
    }
    const kbd = b.querySelector('kbd')?.getBoundingClientRect();
    if (kbd && b.classList.contains('tool-mini'))
      for (const n of b.querySelectorAll('.tool-name, .tool-cost')) {
        const range = document.createRange();
        range.selectNodeContents(n);
        for (const lr of range.getClientRects()) {
          const ix = Math.min(lr.right, kbd.right) - Math.max(lr.left, kbd.left);
          const iy = Math.min(lr.bottom, kbd.bottom) - Math.max(lr.top, kbd.top);
          if (lr.width > 1 && ix > 1 && iy > 1) bad.push(`${name}: the key badge over "${n.textContent.trim()}"`);
        }
      }
  }
  return bad;
};

// a side panel (catalog or building panel): inside the window, clear of the top bar and the build bar
const sideBox = (sel) => {
  const P = document.querySelector(sel).getBoundingClientRect();
  const bad = [];
  if (P.left < -0.5 || P.top < -0.5 || P.right > innerWidth + 0.5 || P.bottom > innerHeight + 0.5) bad.push(`${sel} goes out of the window`);
  const bar = document.querySelector('[data-toolbar]').getBoundingClientRect();
  if (P.bottom > bar.top + 0.5 && P.right > bar.left && P.left < bar.right) bad.push(`${sel} over the build bar (${Math.round(P.bottom)} > ${Math.round(bar.top)})`);
  for (const t of [...document.querySelectorAll('.hud-top > *')].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0)) if (t.bottom > P.top + 0.5 && t.right > P.left + 0.5 && t.left < P.right - 0.5 && t.top < P.bottom) bad.push(`${sel} under the top bar`);
  if (document.documentElement.scrollWidth > innerWidth + 1) bad.push('the page scrolls sideways');
  return bad;
};

const catalogFit = () => {
  const bad = [];
  const panel = document.querySelector('[data-catalog-panel]');
  const P = panel.getBoundingClientRect();
  const cut = (el, box) => {
    if (el.hidden || !el.getClientRects().length) return false;
    const range = document.createRange();
    range.selectNodeContents(el);
    return [...range.getClientRects()].some((q) => q.width > 0 && (q.right > box.right + 1 || q.left < box.left - 1));
  };
  for (const el of panel.querySelectorAll('.cat-tab, .cat-filter, .cat-tool-btns .btn, .cat-help')) {
    const q = el.getBoundingClientRect();
    if (!(q.width > 0 && q.top >= P.top - 0.5 && q.bottom <= P.bottom + 0.5)) bad.push(`not in sight: ${el.className}`);
    if (el.scrollWidth > el.clientWidth + 1 || cut(el, q)) bad.push(`cut: ${el.className} "${el.textContent.trim().slice(0, 24)}"`);
  }
  if (panel.classList.contains('has-tool') && !panel.querySelector('[data-done]')) bad.push('no Done with a tool in hand');
  const list = panel.querySelector('.cat-scroll');
  const L = list.getBoundingClientRect();
  const heights = [];
  for (const row of list.querySelectorAll('[data-item]')) {
    list.scrollTop = 0;
    const R0 = row.getBoundingClientRect();
    list.scrollTop = R0.top - L.top + (R0.height > L.height ? 0 : -(L.height - R0.height) / 2);
    const R = row.getBoundingClientRect();
    heights.push(Math.round(R.height));
    if (R.height > L.height + 0.5) bad.push(`${row.dataset.item}: row ${Math.round(R.height)} px > visible list ${Math.round(L.height)} px`);
    else if (R.top < L.top - 0.5 || R.bottom > L.bottom + 0.5) bad.push(`${row.dataset.item}: cannot be scrolled fully into sight`);
    const at = document.elementFromPoint(R.left + R.width / 2, Math.min(L.bottom - 2, R.top + Math.min(R.height / 2, 20)));
    if (!at || !row.contains(at)) bad.push(`${row.dataset.item}: covered by ${at?.className ?? 'nothing'}`);
    for (const el of row.querySelectorAll('.cat-name, .cat-state-label, .cat-reason, .cat-goal, .cat-progress, .cat-effect, .cat-limit, .tool-cost')) {
      if (el.hidden || !el.getClientRects().length) continue;
      if (el.scrollWidth > el.clientWidth + 1 || cut(el, R)) bad.push(`${row.dataset.item}: ${el.className} cut`);
    }
  }
  list.scrollTop = 0;
  return { bad, visList: Math.round(L.height), rows: heights.length, tallest: Math.max(0, ...heights) };
};

const panelFit = () => {
  const bad = [];
  const p = document.querySelector('[data-inspector]');
  const P = p.getBoundingClientRect();
  for (const n of p.querySelectorAll('*')) {
    if (n.closest('[hidden]') || !n.getClientRects().length) continue;
    const r = n.getBoundingClientRect();
    if (r.width && (r.right > P.right + 0.5 || r.left < P.left - 0.5)) bad.push(`outside sideways: ${n.className || n.tagName} "${n.textContent.trim().slice(0, 20)}"`);
    if (/^(B|SPAN|SMALL|H3|DT|DD|P)$/.test(n.tagName) && n.scrollWidth > n.clientWidth + 1 && getComputedStyle(n).overflowX !== 'visible') bad.push(`clipped: ${n.className || n.tagName} "${n.textContent.trim().slice(0, 20)}"`);
  }
  // every button of the panel can be scrolled into sight, and nothing covers it there
  for (const b of p.querySelectorAll('button[data-install], button[data-remove], button[data-demolish], button[data-pause]')) {
    b.scrollIntoView({ block: 'nearest' });
    const r = b.getBoundingClientRect();
    const Q = p.getBoundingClientRect();
    if (r.top < Q.top - 0.5 || r.bottom > Q.bottom + 0.5) bad.push(`${b.outerHTML.slice(0, 40)} not reachable`);
    const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (!at || !(at === b || b.contains(at))) bad.push(`${b.outerHTML.slice(0, 40)} covered by ${at?.className ?? 'nothing'}`);
  }
  p.scrollTop = 0;
  return { bad: [...new Set(bad)], scrolls: p.scrollHeight - p.clientHeight };
};

// the main menu: the corner stamp's lines, the logo's star, the hand-lettered text, the path cards' labels
const menuFit = () => {
  const bad = [];
  const lines = (el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    return [...r.getClientRects()].filter((q) => q.width > 1 && q.height > 1);
  };
  const hit = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
  const star = document.querySelector('.logo-star').getBoundingClientRect();
  for (const l of lines(document.querySelector('.corner-tl p'))) if (hit(l, star)) bad.push('the build stamp under the logo star');
  const hand = document.querySelector('.hand-right');
  if (getComputedStyle(hand).display !== 'none')
    for (const h of lines(hand)) for (const label of document.querySelectorAll('.path-card .card-label')) for (const l of lines(label)) if (hit(h, l)) bad.push(`"Different futures" over "${label.textContent.trim()}"`);
  return [...new Set(bad)];
};

await T.run(async () => {
  const summary = {};
  for (const lang of T.cfg.langs) {
    const [w0, h0] = T.cfg.sizes[0].split('x').map(Number);
    const g = await openGame(browser, server, { input: 'mouse', size: `${w0}x${h0}`, storage: seedStorage({ lang, profile: BEST }) });
    page = g.page;
    const { io, errors } = g;
    for (const size of T.cfg.sizes) {
      const [w, h] = size.split('x').map(Number);
      await page.setViewportSize({ width: w, height: h });
      await page.mouse.move(2, 2);
      await frames(page, 3);
      const bad = await S(page, menuFit);
      T.ok(`${size} ${lang}: main menu: the build stamp clear of the logo, the hand-lettered text clear of the cards`, bad.length === 0, bad.join('; '));
    }
    await page.setViewportSize({ width: w0, height: h0 });
    // the city by the menus (setup: mouse), then: paused, money, a finished Dock and Recycler (module tools and panels)
    await G.startFreePlay(page, io, { seed: 777 });
    await S(page, () => window.scrapbot.session().setSpeed(0));
    await G.noEvents(page);
    const B = await G.placeFinished(page, ['dock', 'recycler']);
    await G.stage(page, () => {
      const s = window.scrapbot.session().s;
      s.res.credits = 5000;
      s.res.parts = 900;
      s.res.scrap = 100;
    });
    for (const size of T.cfg.sizes) {
      const [w, h] = size.split('x').map(Number);
      await page.setViewportSize({ width: w, height: h });
      // the mouse rests on the map's left edge (over the toolbar it would bring up a building's tooltip)
      await page.mouse.move(4, Math.round(h * 0.45));
      await frames(page, 3);
      await settle(page);
      const tag = `${size} ${lang}`;
      const bar = await S(page, toolbarFit);
      T.ok(`${tag}: toolbar fits`, bar.length === 0, bar.slice(0, 4).join('; '));
      const catBad = [];
      const lists = [];
      for (const [tool, cat] of TOOLS) {
        await S(page, ([tool, cat]) => {
          const ses = window.scrapbot.session();
          if (!ses.catalog) document.querySelector('[data-catalog]').click();
        }, [tool, cat]);
        await settle(page);
        await S(page, (cat) => {
          document.querySelector(`[data-catalog-panel] [data-cat="${cat}"]`)?.click();
          document.querySelector('[data-catalog-panel] [data-filter="all"]')?.click();
        }, cat);
        await settle(page);
        if (tool) {
          await S(page, (k) => document.querySelector(`[data-catalog-panel] [data-item="${k}"]`).click(), tool);
          await until(page, (k) => window.scrapbot.session().piece?.kind === k, tool, { what: `${tool} in hand` });
          await settle(page);
        }
        const side = await S(page, sideBox, '[data-catalog-panel]');
        const r = await S(page, catalogFit);
        lists.push(`${tool ?? cat}: list ${r.visList}px, tallest row ${r.tallest}px`);
        for (const b of [...side, ...r.bad]) catBad.push(`${tool ? `tool ${tool}` : `browse ${cat}`}: ${b}`);
        if (tool === 'dockStorage' && size === '1024x640') await T.shot(page, `catalog-tool-${lang}-${size}`);
        if (tool === 'lamp' && size === '1920x1080' && (lang === 'en' || lang === 'de')) await T.shot(page, `catalog-tool-${lang}-${size}`);
        if (tool) {
          await S(page, () => document.querySelector('[data-catalog-panel] [data-done]')?.click());
          await until(page, () => !window.scrapbot.session().piece, null, { what: 'the tool put away' });
        }
      }
      T.ok(`${tag}: catalog fits, browsing the 3 tabs and with a tool in hand (every row reachable and readable)`, catBad.length === 0, catBad.slice(0, 4).join('; '));
      T.note(`${tag}: ${lists.join('; ')}`);
      await S(page, () => {
        if (window.scrapbot.session().catalog) document.querySelector('[data-catalog]').click();
      });
      const panelBad = [];
      for (const [type, id] of [['recycler', B.recycler[0]], ['dock', B.dock[0]]]) {
        await S(page, (id) => window.scrapbot.session().selectBuilding(id), id);
        await until(page, () => !document.querySelector('[data-inspector]').hidden, null, { what: `the ${type} panel` });
        await settle(page);
        const side = await S(page, sideBox, '[data-inspector]');
        const r = await S(page, panelFit);
        for (const b of [...side, ...r.bad]) panelBad.push(`${type}: ${b}`);
        if (type === 'recycler' && size === '1024x640' && lang === 'de') await T.shot(page, `recycler-panel-${lang}-${size}`);
      }
      await S(page, () => window.scrapbot.session().selectBuilding(-1));
      T.ok(`${tag}: the Recycler's and the Dock's panels fit (inside, clear of the bars, every button reachable)`, panelBad.length === 0, panelBad.slice(0, 4).join('; '));
      summary[tag] = { toolbar: bar.length, catalog: catBad.length, panels: panelBad.length };
    }
    T.ok(`${lang}: no page errors`, errors.length === 0, errors.slice(0, 2).join(' | '));
    await g.ctx.close();
  }
}, () => page);

await browser.close();
await server.close();
await T.finish();
