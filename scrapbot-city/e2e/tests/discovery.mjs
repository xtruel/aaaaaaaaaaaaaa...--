// Projects to discover (docs/MODULAR-INC2.md §4) from a NEW profile (no scrapbot:projects key), with ONE input
// (mouse+keyboard | CDP touch | simulated Gamepad API), debug build. Every discovery but the last comes from play.
//  A. the catalog from a new profile: tabs Construction / Decorations / Modules with their counts, the filters All /
//     Available / To discover with theirs, the four row states (Can be bought, To discover with goal and progress,
//     Not now with the reason), a row to discover pressed: refused with its goal, nothing in hand, nothing paid
//  B. Miso petted three times with the input -> "New project: Miso's house", clear of the press, written to the
//     profile, nothing given; Open (Apri) -> the catalog at that row, nothing bought; then taken and placed (paid once)
//  C. a project and an achievement reached together (STAGED: 10 citizens -> the bench and "Neighbours"): with a tool in
//     hand, a press aimed at Open where it stood reaches Open: no involuntary purchase when the toast slides in
//  D. saved, the page reloaded, Load: the projects back from the profile, nothing announced again
import { startTest } from '../lib/report.mjs';
import { launch, openGame, reload, S, settle, sleep, until } from '../lib/page.mjs';
import { serve } from '../lib/server.mjs';
import * as G from '../lib/game.mjs';
import { seedStorage } from '../lib/profile.mjs';

const T = await startTest({ name: 'discovery', input: 'mouse', size: '1280x800', seed: 2026 });
const { input, size, seed } = T.cfg;
const server = await serve(T.cfg.debug);
const browser = await launch();
let page = null;

await T.run(async () => {
  const g = await openGame(browser, server, { input, size, storage: seedStorage({ profile: 'new' }) });
  page = g.page;
  const { io, errors } = g;
  const W = g.size.w;
  const read = () =>
    S(page, () => {
      const ses = window.scrapbot.session();
      const s = ses?.s;
      const n = document.querySelector('[data-project-note]');
      const badge = document.querySelector('[data-catalog-badge]');
      return {
        res: s ? { ...s.res } : null,
        unlocked: s ? [...s.unlocked].sort() : [],
        placed: s?.stats.piecesPlaced,
        pets: s?.stats.catPets,
        piece: ses?.piece?.kind ?? null,
        catalog: ses?.catalog,
        tab: document.querySelector('.cat-tab.on')?.dataset.cat ?? null,
        filter: document.querySelector('.cat-filter.on')?.dataset.filter ?? null,
        focus: document.querySelector('.cat-item.focus')?.dataset.item ?? null,
        rows: [...document.querySelectorAll('[data-catalog-panel] [data-item]')].map((b) => b.dataset.item),
        note: n && !n.hidden ? { label: n.getAttribute('aria-label'), title: n.querySelector('[data-note-title]').textContent, names: n.querySelector('[data-note-names]').textContent, arming: n.classList.contains('arming'), rect: n.getBoundingClientRect().toJSON() } : null,
        feed: [...document.querySelectorAll('[data-feed] .msg')].map((m) => m.dataset.text ?? m.textContent),
        profile: localStorage.getItem('scrapbot:projects'),
        badge: badge && !badge.hidden ? badge.textContent : '',
        cursor: ses ? { ...ses.cursor } : null,
      };
    });
  const nav = async () => {
    await settle(page);
    return S(page, () => ({
      tabs: [...document.querySelectorAll('[data-catalog-panel] [data-cat]')].map((t) => ({ cat: t.dataset.cat, text: t.textContent.trim(), title: t.title, on: t.classList.contains('on') })),
      filters: [...document.querySelectorAll('[data-catalog-panel] [data-filter]')].map((f) => f.textContent.trim().replace(/\s+/g, ' ')),
      note: document.querySelector('[data-catalog-panel] .cat-note')?.textContent.trim(),
    }));
  };
  const near = (p, r, m = 40) => p && r && p.x >= r.left - m && p.x <= r.right + m && p.y >= r.top - m && p.y <= r.bottom + m;

  let st = await read();
  T.ok('new profile: no scrapbot:projects key before any city', st.profile === null, String(st.profile));
  await G.startFreePlay(page, io, { seed });
  await G.padWake(page, io);
  await io.speed(0);
  await G.noEvents(page);
  st = await read();
  T.ok('free play from a new profile: nothing discovered; the clock paused with the input', st.unlocked.length === 0);

  // ---------- A. the catalog ----------
  await G.openCatalog(page, io);
  let n = await nav();
  T.ok('three tabs Construction / Decorations / Modules, Construction first', n.tabs.map((t) => t.text).join('|') === 'Construction|Decorations|Modules' && n.tabs[0].on, JSON.stringify(n.tabs));
  T.ok('the tabs count what is discovered: 3 of 6, 1 of 10, 2 of 8', n.tabs.map((t) => t.title).join('|') === '3 of 6 discovered|1 of 10 discovered|2 of 8 discovered', n.tabs.map((t) => t.title).join('|'));
  T.ok('filters with counts: All 6, Available 3, To discover 3', n.filters.join('|') === 'All 6|Available 3|To discover 3', n.filters.join('|'));
  T.ok('caption "Construction: no effect on the economy"', n.note === 'Construction: no effect on the economy', n.note);
  const floor = await G.rowInfo(page, 'floor');
  T.ok('floor: "Can be bought" with its icon', floor.state === 'available' && floor.label === 'Can be bought' && floor.icon, JSON.stringify(floor));
  await io.reveal('[data-catalog-panel] [data-item="base"]');
  const base = await G.rowInfo(page, 'base');
  T.ok('concrete base: "To discover" + icon, goal "Finish 10 buildings", "0 / 10 in this city"', base.state === 'locked' && base.label === 'To discover' && base.icon && base.goal === 'Finish 10 buildings' && base.progress === '0 / 10 in this city' && base.disabled === 'true', JSON.stringify(base));
  await G.catalogTab(page, io, 'construction', 'locked');
  st = await read();
  T.ok('To discover (pressed with the input): base, wall, pillar', st.rows.join() === 'base,wall,pillar' && st.filter === 'locked', st.rows.join());
  await G.catalogTab(page, io, 'construction', 'available');
  st = await read();
  T.ok('Available: floor, fence, gate', st.rows.join() === 'floor,fence,gate', st.rows.join());
  await G.catalogTab(page, io, 'decorations', 'all');
  st = await read();
  n = await nav();
  T.ok('Decorations: ten rows, lamp first; All 10 / Available 1 / To discover 9; caption', st.rows.length === 10 && st.rows[0] === 'lamp' && n.filters.join('|') === 'All 10|Available 1|To discover 9' && n.note === 'Decoration: no effect on the economy', `${st.rows.join()} ${n.filters.join('|')} ${n.note}`);
  const bench0 = await G.rowInfo(page, 'bench');
  T.ok('bench: "To discover", goal "Reach 10 citizens", "0 / 10 in this city"', bench0.state === 'locked' && bench0.goal === 'Reach 10 citizens' && bench0.progress === '0 / 10 in this city', JSON.stringify(bench0));
  await T.shot(page, 'catalog-decorations-new-profile');
  await G.catalogTab(page, io, 'modules', 'all');
  const dock = await G.rowInfo(page, 'dockStorage');
  const magnet = await G.rowInfo(page, 'recyclerMagnet');
  T.ok('Modules: storage module "Not now" + icon + the reason (no finished Dock)', dock.state === 'cantBuy' && dock.label === 'Not now' && dock.icon && /Dock/.test(dock.reason ?? ''), JSON.stringify(dock));
  T.ok('magnetic separator: "To discover", "Make 100 parts", "0 / 100 in this city"', magnet.state === 'locked' && magnet.goal === 'Make 100 parts' && magnet.progress === '0 / 100 in this city', JSON.stringify(magnet));
  // a row to discover pressed: refused with its goal
  await G.catalogTab(page, io, 'decorations', 'all');
  const r0 = await read();
  await io.press('[data-catalog-panel] [data-item="bench"]');
  await settle(page);
  st = await read();
  T.ok('a row to discover (bench) pressed: nothing in hand, nothing paid, its goal in the news', st.piece === null && JSON.stringify(st.res) === JSON.stringify(r0.res) && st.feed.some((f) => f.startsWith('Project to discover: Reach 10 citizens (0 / 10 in this city)')), `${st.piece} | ${st.feed.at(-1)}`);
  await io.cancel();
  await until(page, () => !window.scrapbot.session().catalog, null, { what: 'the catalog closed' });

  // ---------- B. Miso ----------
  const cat = await S(page, () => {
    const s = window.scrapbot.session().s;
    return { x: Math.floor(s.cat.x / 16), y: Math.floor(s.cat.y / 16) };
  });
  await G.frameOn(page, cat, 3);
  await settle(page);
  const catPoint = () =>
    S(page, () => {
      const ses = window.scrapbot.session();
      const r = ses.renderer;
      const c = r.worldToScreen(ses.s.cat.x, ses.s.cat.y);
      const hit = (x, y) => r.pickBuilding(x, y) === -2 && document.elementFromPoint(x, y) === r.canvas;
      for (let dy = -40; dy <= 20; dy++)
        for (let dx = -30; dx <= 30; dx++) {
          const x = Math.round(c.x + dx);
          const y = Math.round(c.y + dy);
          let all = true;
          for (let a = -2; a <= 2 && all; a++) for (let b = -2; b <= 2 && all; b++) all = hit(x + a, y + b);
          if (all) return { x, y };
        }
      return null;
    });
  const cp = await catPoint();
  T.ok('Miso found on screen (a point on its own pixels)', !!cp, JSON.stringify(cp));
  for (let k = 1; k <= 3; k++) {
    const b = await read();
    await io.at(cp.x, cp.y);
    st = await until(page, (n) => window.scrapbot.session().s.stats.catPets === n, b.pets + 1, { soft: true, timeout: 4000 });
    st = await read();
    T.ok(`pet ${k} (${io.label} on the cat): catPets ${b.pets} -> ${st.pets}, nothing bought`, st.pets === b.pets + 1 && st.res.credits === b.res.credits);
  }
  await until(page, () => !document.querySelector('[data-project-note]').hidden, null, { soft: true, timeout: 4000 });
  await settle(page);
  st = await read();
  T.ok("Miso's house discovered at the 3rd pet and written to the profile", st.unlocked.includes('cathouse') && JSON.parse(st.profile ?? '{}').discovered?.includes('cathouse'), st.profile);
  T.ok('the notice "New project: Miso\'s house"', st.note?.label === "New project: Miso's house" && st.note.title === 'New project' && st.note.names === "Miso's house", JSON.stringify(st.note));
  T.ok('the notice stands clear of the press on the cat (40 px)' + (io.pad ? ' and of the pad cursor' : ''), !near(io.lastAt, st.note?.rect) && (!io.pad || !near(st.cursor, st.note?.rect)), `${JSON.stringify(io.lastAt)} vs ${JSON.stringify(st.note?.rect)}`);
  T.ok('badge on Objects & modules: 1', st.badge === '1', st.badge);
  await T.shot(page, 'notice-miso');
  // Open (Apri)
  await until(page, () => !document.querySelector('[data-project-note]').classList.contains('arming'), null, { what: 'the notice armed' });
  const bO = await read();
  await io.press('[data-project-open]');
  await until(page, () => window.scrapbot.session().catalog, null, { what: 'the catalog opened by Open' });
  await settle(page);
  st = await read();
  T.ok("Open: the catalog at Miso's house (Decorations, marked); nothing in hand, nothing paid; the notice gone", st.tab === 'decorations' && st.focus === 'cathouse' && st.piece === null && JSON.stringify(st.res) === JSON.stringify(bO.res) && st.note === null, `${st.tab} ${st.focus} ${st.piece} ${JSON.stringify(st.note)}`);
  const ch = await G.rowInfo(page, 'cathouse');
  T.ok('the row: "Can be bought"', ch.state === 'available' && ch.label === 'Can be bought', JSON.stringify(ch));
  await T.shot(page, 'open-at-cathouse');
  // buy it
  await io.press('[data-catalog-panel] [data-item="cathouse"]');
  await until(page, () => window.scrapbot.session().piece?.kind === 'cathouse', null, { what: "Miso's house in hand" });
  const hq = await S(page, () => {
    const h = window.scrapbot.session().s.buildings.find((b) => b.type === 'hq');
    return { x: h.x, y: h.y };
  });
  await G.frameOn(page, { x: hq.x + 1, y: hq.y + 1 }, W >= 1200 ? 3 : 2);
  const fb = await G.freeBlock(page, 1, 1, 1);
  const spot = { x: fb.x0, y: fb.y0 };
  await G.inView(page, io, [spot]);
  const sp = await G.tileScreen(page, spot);
  const bP = await read();
  await io.hover(sp.x, sp.y);
  await io.at(sp.x, sp.y);
  await until(page, (i) => window.scrapbot.session().s.solid[i] === 8, spot.y * 56 + spot.x, { soft: true, timeout: 4000 });
  st = await read();
  T.ok("Miso's house bought and placed with the input: 10 credits, once", (await G.tileAt(page, spot)).solid === 8 && Math.abs(bP.res.credits - st.res.credits - 10) < 1e-6 && st.placed === 1, `${bP.res.credits - st.res.credits} ${st.placed}`);

  // ---------- C. a project and an achievement at once, a tool in hand ----------
  const fa = await G.freeBlock(page, 1, 1, 1);
  const aim = { x: fa.x0, y: fa.y0 };
  await G.inView(page, io, [aim]);
  const ap = await G.tileScreen(page, aim);
  await io.hover(ap.x, ap.y);
  await G.stage(page, () => (window.scrapbot.session().s.pop = 10));
  T.note('staged: 10 citizens (the bench project and the "Neighbours" achievement together)');
  await until(page, () => !document.querySelector('[data-project-note]').hidden && !document.querySelector('[data-project-note]').classList.contains('arming'), null, { what: 'the bench notice, armed' });
  const toast = await until(page, () => !!document.querySelector('#toasts .toast'), null, { soft: true, timeout: 3000 });
  const bT = await read();
  T.ok('the bench discovered, its notice up; an achievement toast came with it', bT.unlocked.includes('bench') && /Bench/.test(bT.note?.label ?? '') && !!toast, `${bT.note?.label} toast ${!!toast}`);
  // the player aims at Open where it stands the moment it can be pressed, and presses there a hand's move later
  // (250 ms: the scenario of the G4 fix, the toast must not push the notice away from under the press)
  const op = await S(page, () => {
    const r = document.querySelector('[data-project-open]').getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  });
  await io.hover(op.x, op.y);
  await sleep(250);
  await io.at(op.x, op.y);
  await settle(page);
  st = await read();
  T.ok('a press aimed at the notice\'s Open while the toast came in reached Open: nothing bought, the catalog at the bench', st.placed === bT.placed && Math.abs(st.res.credits - bT.res.credits) < 1e-6 && st.focus === 'bench', JSON.stringify({ placed: [bT.placed, st.placed], focus: st.focus }));
  await T.shot(page, 'open-at-bench-after-toast');
  await io.cancel();

  // ---------- D. save, reload, Load ----------
  const prof = await S(page, () => localStorage.getItem('scrapbot:projects'));
  await G.saveFromPause(page, io, 1);
  await reload(page, io);
  st = await read();
  T.ok('page reloaded: the profile still there, unchanged', st.profile !== null && JSON.parse(st.profile).discovered.includes('cathouse') && JSON.parse(st.profile).discovered.includes('bench'), st.profile);
  await G.loadFromMenu(page, io, 1);
  await io.speed(0);
  await settle(page);
  st = await read();
  T.ok('slot 1 loaded: the projects back from the profile, nothing announced again, no badge', st.unlocked.join() === 'bench,cathouse' && st.note === null && st.badge === '', `${st.unlocked} ${JSON.stringify(st.note)} ${st.badge}`);
  T.ok('loading the city wrote nothing new to the profile', (await S(page, () => localStorage.getItem('scrapbot:projects'))) === prof || JSON.parse(await S(page, () => localStorage.getItem('scrapbot:projects'))).discovered.join() === JSON.parse(prof).discovered.join());
  T.ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
}, () => page);

await browser.close();
await server.close();
await T.finish();
