// Does the interface fit a phone in landscape? The compact layout (src/compact.css) in 8 languages x the six iPhone
// screens of e2e/lib/phone.mjs (667x375 SE up to 956x440 Pro Max), in Chromium emulating a phone: isMobile, DPR 3, a
// touch screen (one CDP tap puts the game in touch mode, as on a phone) and the safe area of each phone (CDP
// Emulation.setSafeAreaInsetsOverride, read back in the page). A LAYOUT test, like fit.mjs: scenes are staged with the
// hook and DOM clicks and everything is measured in the DOM; each state is opened once and measured at the six sizes
// (the window resized, the safe area changed). The same layout played with CDP touch: phone-flow.mjs.
// In every state: nothing in the safe area (the Dynamic Island's side, the home indicator), no text out of its box or
// cut, no text under 11 px, every button 44x44 px to a finger and not covered, every one in a list reachable:
//  menu:     the entries, the language, the paths' labels; the build stamp clear of the logo
//  dialogs:  New game, Free play, Load, Settings, Language, Credits, Extras, the paths, Quit; in a city the intro, Pause,
//            Save, Settings, a story event, an ending (a toast over it covers none of its buttons), a hint, 2PM's parts,
//            the cargo blimp; the buttons always in sight (the body scrolls between the head and them)
//  city:     the band: one row of 44 px; the goal chip under it (opened: all of its text, above the build bar); the build
//            bar: every card, the bulldozer and Objects & modules brought into sight; the strip of each building in hand;
//            the smog alarm (its countdown) under the band with the goal chip, a strip or a building's panel
//  sheets:   the catalog in its 3 tabs and with a fence, a lamp, a storage module in hand (tabs, filters, Rotate, Done,
//            every row reachable and readable); the Recycler's, the Dock's and a kept statue's panels (its warning in
//            sight with Remove); the smog panel; never over the band or the build bar
//  others:   a new project's notice and the feed; the region map; the tutorial's bubble at its first, second, fifth
//            and last steps (clear of what it points at)
import { startTest } from '../lib/report.mjs';
import { frames, launch, openGame, S, settle, stableBox, until } from '../lib/page.mjs';
import { serve } from '../lib/server.mjs';
import * as G from '../lib/game.mjs';
import { seedStorage } from '../lib/profile.mjs';
import { PHONE_CHECKS, SIZES, safeOf } from '../lib/phone.mjs';

const T = await startTest({ name: 'phone', langs: ['en', 'it', 'de', 'fr', 'es', 'pt', 'pl', 'nl'], sizes: Object.keys(SIZES) });
const sizes = T.cfg.sizes;
const server = await serve(T.cfg.debug);
const browser = await launch();
let page = null;
let cdp = null;
let now = null;
let lang = 'en';
// a new profile with bests from "another city" (rows to discover carry their longest lines: goal and progress)
const BEST = { version: 1, discovered: [], best: { partsMade: 60, pop: 8, creditsEarned: 4200, scrapCollected: 250, built: 9, energyProd: 20, cleaned: 5, piecesPlaced: 12, catPets: 2 } };

// ---------- sizes ----------
async function resize(size) {
  if (now === size) return;
  const [w, h] = size.split('x').map(Number);
  await page.setViewportSize({ width: w, height: h });
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: safeOf(size) });
  now = size;
  await frames(page, 3);
  const got = await S(page, () => window.__phone.readSafe());
  const want = safeOf(size);
  if (['left', 'right', 'bottom'].some((k) => Math.abs(got[k] - want[k]) > 0.5)) throw new Error(`${size}: the page reads the safe area ${JSON.stringify(got)}, not ${JSON.stringify(want)}`);
}

// a state measured at every size: `check` runs in the page and returns its problems
async function atSizes(label, check, arg, shot = null) {
  const bad = [];
  for (const size of sizes) {
    await resize(size);
    const r = await S(page, check, arg);
    if (r.length) bad.push(`${size}: ${[...new Set(r)].slice(0, 3).join('; ')}`);
    if (shot && lang === 'en' && (size === '667x375' || size === '874x402')) await T.shot(page, `${shot}-${size}`);
  }
  T.ok(`${lang}: ${label}`, bad.length === 0, bad.slice(0, 3).join(' | '));
  return bad.length === 0;
}

const click = (sel) => S(page, (sel) => document.querySelector(sel).click(), sel);
// a dialog's controls take no key or DOM click in their first 600 ms (src/ui/modal.ts): a moment later (the dialog on
// screen now, as the page's probe saw it come up)
const old = () =>
  until(page, () => {
    const m = document.querySelector('#modal-root .modal');
    return !m || (window.__e2e.modal === m && performance.now() - window.__e2e.modalAt > 650);
  }, null, { what: 'the dialog to take a press' });
const modal = () => S(page, () => !!document.querySelector('#modal-root .modal'));
// a dialog opened: measured once it stands still (it pops in)
const opened = async (what) => {
  await until(page, (w) => !!document.querySelector(`#modal-root ${w}`), what, { what });
  await stableBox(page, '#modal-root .modal');
};
// every dialog closed with a finger on its × (a dialog opened from another one goes back to it first), as a phone
// player does (a key would leave touch mode)
let io = null;
const escape = async () => {
  for (let k = 0; k < 4 && (await modal()); k++) {
    // (a dialog pops in: its × is pressed where it stands still)
    await stableBox(page, '#modal-root .modal');
    const x = await S(page, () => {
      const m = document.querySelector('#modal-root .modal');
      const b = m.querySelector('.modal-x');
      if (!b) return null;
      window.__e2eClosing = m;
      const r = b.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    });
    if (!x) throw new Error('a dialog with no ×');
    await io.at(x.x, x.y);
    // closed, or replaced by the one it came from
    await until(page, () => document.querySelector('#modal-root .modal') !== window.__e2eClosing, null, { what: 'the dialog closed' });
    await frames(page, 2);
  }
};

// ---------- in-page checks ----------
const MENU = () => {
  const P = window.__phone;
  const m = document.getElementById('menu');
  const out = [];
  for (const b of m.querySelectorAll('.menu-list button')) if (P.vis(b)) out.push(...P.inSafe(b), ...P.hit44(b));
  const pill = m.querySelector('[data-lang-open]');
  out.push(...P.inSafe(pill), ...P.hit44(pill));
  for (const c of m.querySelectorAll('.path-card')) if (P.vis(c)) out.push(...P.inSafe(c), ...P.hit44(c));
  for (const el of m.querySelectorAll('.corner-tl, .footer-tag, .logo')) if (P.vis(el)) out.push(...P.inSafe(el));
  // the build stamp clear of the logo's star (as fit.mjs)
  const star = m.querySelector('.logo-star').getBoundingClientRect();
  const r = document.createRange();
  r.selectNodeContents(m.querySelector('.corner-tl p'));
  for (const q of r.getClientRects()) if (q.width > 1 && Math.min(q.right, star.right) - Math.max(q.left, star.left) > 1 && Math.min(q.bottom, star.bottom) - Math.max(q.top, star.top) > 1) out.push('the build stamp under the logo star');
  // the menu's entries clear of the footer
  const foot = m.querySelector('.menu-footer').getBoundingClientRect();
  for (const b of m.querySelectorAll('.menu-list button, .path-card')) if (P.vis(b) && b.getBoundingClientRect().bottom > foot.top + 0.5) out.push(`${P.name(b)} over the footer`);
  // (the logo is a drawing: its letters lean out of their boxes on purpose)
  return [...out, ...P.spills(m, [m.querySelector('.logo')]), ...P.small(m)];
};

const DIALOG = () => {
  const P = window.__phone;
  const m = document.querySelector('#modal-root .modal');
  if (!m) return ['no dialog'];
  const out = [...P.inSafe(m, 'the dialog')];
  const M = m.getBoundingClientRect();
  const H = m.querySelector('.modal-head').getBoundingClientRect();
  if (H.top < M.top - 0.5 || H.bottom > M.bottom + 0.5) out.push('its head out of sight');
  const x = m.querySelector('.modal-head .modal-x');
  if (x) out.push(...P.hit44(x, 'its ×'));
  for (const b of m.querySelectorAll('.modal-actions > button')) {
    const r = b.getBoundingClientRect();
    if (r.top < M.top - 0.5 || r.bottom > M.bottom + 0.5 || r.left < M.left - 0.5 || r.right > M.right + 0.5) out.push(`"${b.textContent.trim().slice(0, 20)}" out of sight`);
    out.push(...P.hit44(b));
  }
  const body = m.querySelector('.modal-body');
  for (const c of body.querySelectorAll('button, select, input, label.check')) {
    if (!P.vis(c) || (c.tagName === 'INPUT' && c.type === 'checkbox')) continue;
    out.push(...P.reach(c), ...P.hit44(c));
  }
  body.scrollTop = 0;
  return [...out, ...P.spills(m), ...P.small(m)];
};

const BAND = () => {
  const P = window.__phone;
  const out = [];
  const top = document.querySelector('.hud-top');
  const R = top.getBoundingClientRect();
  out.push(...P.inSafe(top, 'the band'));
  if (R.height > 52) out.push(`the band ${Math.round(R.height)} px high`);
  if (top.scrollWidth > top.clientWidth + 1) out.push('the band overflows sideways');
  for (const c of top.querySelectorAll('.res-group, .meters, .clock, .res')) {
    const r = c.getBoundingClientRect();
    if (r.right > R.right + 0.5 || r.left < R.left - 0.5 || r.top < R.top - 0.5 || r.bottom > R.bottom + 0.5) out.push(`${P.name(c)} out of the band`);
  }
  for (const b of document.querySelectorAll('[data-import], [data-speed], [data-menu], [data-hint], [data-region]')) out.push(...P.inSafe(b), ...P.hit44(b));
  // (the smog meter is pressed anywhere on the meters' block: its level and bar over the path)
  const smog = document.querySelector('[data-smog-meter]');
  out.push(...P.inSafe(smog), ...P.hit44(smog, P.name(smog), smog.closest('.meters')));
  for (const b of document.querySelectorAll('[data-hint], [data-region]')) if (b.getBoundingClientRect().top < R.bottom) out.push(`${P.name(b)} on the band`);
  const goal = document.querySelector('[data-objective]');
  if (P.vis(goal)) {
    const g = goal.getBoundingClientRect();
    out.push(...P.inSafe(goal, 'the goal chip'), ...P.hit44(goal.querySelector('[data-obj-toggle]'), 'the goal chip'));
    if (g.top < R.bottom) out.push('the goal chip on the band');
    for (const b of document.querySelectorAll('[data-hint], [data-region]')) out.push(...P.overlap(goal, b));
    out.push(...P.spills(goal, [goal.querySelector('[data-obj-text]')]), ...P.small(goal));
  }
  return [...out, ...P.spills(top), ...P.small(top)];
};

const GOAL_OPEN = () => {
  const P = window.__phone;
  const goal = document.querySelector('[data-objective]');
  if (!goal.classList.contains('open')) return ['the goal chip did not open'];
  const out = [...P.inSafe(goal, 'the opened goal')];
  const text = goal.querySelector('[data-obj-text]');
  if (text.scrollWidth > text.clientWidth + 1) out.push('the goal still cut');
  const bar = document.querySelector('[data-toolbar]').getBoundingClientRect();
  if (goal.getBoundingClientRect().bottom > bar.top) out.push('the opened goal over the build bar');
  return [...out, ...P.spills(goal), ...P.small(goal)];
};

const TOOLBAR = () => {
  const P = window.__phone;
  const out = [];
  const bar = document.querySelector('[data-toolbar]');
  out.push(...P.inSafe(bar, 'the build bar'));
  const B = bar.getBoundingClientRect();
  if (B.height > 84) out.push(`the build bar ${Math.round(B.height)} px high`);
  const cards = [...bar.querySelectorAll('button.tool')];
  if (cards.length !== 13) out.push(`${cards.length} cards, not 13 (11 buildings, the bulldozer, Objects & modules)`);
  for (const c of cards) {
    out.push(...P.reach(c), ...P.hit44(c));
    const r = c.getBoundingClientRect();
    for (const n of c.querySelectorAll('.tool-cost, .tool-plate')) {
      const q = n.getBoundingClientRect();
      if (q.left < r.left - 0.5 || q.right > r.right + 0.5 || q.top < r.top - 0.5 || q.bottom > r.bottom + 0.5) out.push(`${P.name(c)}: ${n.className} out of its card`);
    }
  }
  // the Tools column in sight at both ends of the bar
  for (const x of [0, bar.scrollWidth]) {
    bar.scrollLeft = x;
    for (const t of bar.querySelectorAll('[data-doze], [data-catalog]')) {
      const r = t.getBoundingClientRect();
      if (r.left < B.left || r.right > B.right) out.push(`${P.name(t)} out of sight with the bar scrolled to ${x ? 'its end' : 'its start'}`);
      out.push(...P.covered(t));
    }
  }
  bar.scrollLeft = 0;
  return [...out, ...P.spills(bar), ...P.small(bar)];
};

const STRIP = () => {
  const P = window.__phone;
  const el = document.querySelector('[data-build-info]');
  if (!P.vis(el)) return ['no strip for the building in hand'];
  const out = [...P.inSafe(el, 'the strip')];
  const band = document.querySelector('.hud-top').getBoundingClientRect();
  const bar = document.querySelector('[data-toolbar]').getBoundingClientRect();
  const r = el.getBoundingClientRect();
  if (r.top < band.bottom || r.bottom > bar.top) out.push('the strip not between the band and the build bar');
  for (const b of document.querySelectorAll('[data-hint], [data-region]')) out.push(...P.overlap(el, b));
  out.push(...P.hit44(el.querySelector('[data-build-close]'), "the strip's ×"));
  return [...out, ...P.spills(el), ...P.small(el)];
};

// a sheet (the catalog, a building's or a piece's panel, the smog panel): in the safe area, under the band, the build
// bar clear of it (the bar gives the right-hand sheets its room; the smog panel stays above it)
const SHEET = (sel) => {
  const P = window.__phone;
  const p = document.querySelector(sel);
  if (!P.vis(p)) return [`no ${sel}`];
  const out = [...P.inSafe(p, sel)];
  const R = p.getBoundingClientRect();
  const band = document.querySelector('.hud-top').getBoundingClientRect();
  const bar = document.querySelector('[data-toolbar]').getBoundingClientRect();
  if (R.top < band.bottom) out.push(`${sel} on the band`);
  if (R.bottom > bar.top + 0.5 && R.right > bar.left + 0.5 && R.left < bar.right - 0.5) out.push(`${sel} over the build bar`);
  const x = p.querySelector('.modal-x:not(.cat-tool-x)') ?? p.querySelector('.cat-tool-x');
  if (x && P.vis(x)) out.push(...P.hit44(x, `${sel}'s ×`));
  return [...out, ...P.spills(p), ...P.small(p)];
};

const CATALOG = () => {
  const P = window.__phone;
  const panel = document.querySelector('[data-catalog-panel]');
  const out = [];
  const R = panel.getBoundingClientRect();
  for (const el of panel.querySelectorAll('.cat-tab, .cat-filter, .cat-tool-btns .btn, .cat-tool-x')) {
    if (!P.vis(el)) continue;
    const q = el.getBoundingClientRect();
    if (q.top < R.top - 0.5 || q.bottom > R.bottom + 0.5) out.push(`${P.name(el)} out of sight`);
    out.push(...P.hit44(el));
  }
  if (panel.classList.contains('has-tool') && !panel.querySelector('[data-done]')) out.push('no Done with a tool in hand');
  const help = panel.querySelector('.cat-help');
  if (help && P.vis(help)) {
    const q = help.getBoundingClientRect();
    if (q.top < R.top - 0.5 || q.bottom > R.bottom + 0.5) out.push('the tool help out of sight');
  }
  const list = panel.querySelector('.cat-scroll');
  for (const row of list.querySelectorAll('[data-item]')) out.push(...P.reach(row, row.dataset.item), ...P.hit44(row, row.dataset.item));
  list.scrollTop = 0;
  return out;
};

const PANEL = () => {
  const P = window.__phone;
  const p = document.querySelector('[data-inspector]');
  const out = [];
  for (const b of p.querySelectorAll('button')) if (P.vis(b) && !b.classList.contains('modal-x')) out.push(...P.reach(b), ...P.hit44(b));
  // a kept piece of a project not discovered yet: its warning in sight with Remove (as fit.mjs)
  const note = p.querySelector('[data-kept-locked]');
  const rm = p.querySelector('[data-remove-piece]');
  if (note && rm) {
    rm.scrollIntoView({ block: 'nearest' });
    const Q = p.getBoundingClientRect();
    const r = note.getBoundingClientRect();
    if (r.top < Q.top - 0.5 || r.bottom > Q.bottom + 0.5) out.push('Remove in sight, its warning not');
  }
  p.scrollTop = 0;
  return out;
};

const SMOG = () => {
  const P = window.__phone;
  const p = document.querySelector('[data-smog-panel]');
  const out = [];
  const R = p.getBoundingClientRect();
  const bar = document.querySelector('[data-toolbar]').getBoundingClientRect();
  if (R.bottom > bar.top + 0.5) out.push('the smog panel over the build bar');
  for (const el of p.querySelectorAll('[data-air-net], [data-air-limit]')) {
    const q = el.getBoundingClientRect();
    if (q.top < R.top - 0.5 || q.bottom > R.bottom + 0.5) out.push(`${P.name(el)} out of sight`);
  }
  return out;
};

// the smog alarm (the 95% countdown): in the safe area, over nothing of the HUD (the goal chip and the strip come
// down under it), its words not cut
const ALARM = () => {
  const P = window.__phone;
  const a = document.querySelector('[data-smog-alert]');
  if (!P.vis(a)) return ['no smog alarm'];
  const out = [...P.inSafe(a, 'the smog alarm')];
  for (const o of document.querySelectorAll('.hud-top, [data-objective], [data-hint], [data-region], [data-inspector], [data-catalog-panel], [data-toolbar], [data-build-info]')) out.push(...P.overlap(a, o));
  return [...out, ...P.spills(a), ...P.small(a)];
};

const NOTICE = () => {
  const P = window.__phone;
  const n = document.querySelector('[data-project-note]');
  if (!P.vis(n)) return ['no notice'];
  const out = [...P.inSafe(n, 'the notice')];
  for (const o of document.querySelectorAll('.hud-top, [data-objective], [data-hint], [data-region], [data-toolbar], [data-inspector], [data-catalog-panel]')) out.push(...P.overlap(n, o));
  // (it lets presses through for a moment after it appears: measured once it takes them)
  if (!n.classList.contains('arming')) out.push(...P.hit44(n.querySelector('[data-project-open]'), 'Open'));
  const feed = document.querySelector('[data-feed]');
  for (const msg of feed.querySelectorAll('.msg')) if (P.vis(msg)) out.push(...P.inSafe(msg, 'a message'), ...P.overlap(msg, document.querySelector('[data-toolbar]')));
  return [...out, ...P.spills(n), ...P.small(n), ...P.spills(feed), ...P.small(feed)];
};

// a toast over the ending (one made here, as the game makes them: over a dialog it is "below")
const TOAST = () => {
  const root = document.getElementById('toasts');
  root.classList.add('below');
  const t = document.createElement('div');
  t.className = 'toast';
  t.dataset.e2eToast = '';
  t.innerHTML = '<span class="toast-ico"></span><span><small>Achievement unlocked</small><b>Garden City</b></span>';
  root.append(t);
};
const ENDING_TOAST = () => {
  const P = window.__phone;
  const t = document.querySelector('[data-e2e-toast]');
  const out = [...P.inSafe(t, 'the toast')];
  for (const b of document.querySelectorAll('#modal-root .modal-actions > button, #modal-root .modal-x')) out.push(...P.overlap(t, b, `the toast over "${b.textContent.trim().slice(0, 20)}"`));
  return [...out, ...P.small(t)];
};

const REGION = () => {
  const P = window.__phone;
  const r = document.getElementById('region');
  const out = [];
  for (const el of r.querySelectorAll('[data-back], .region-title, .region-stats .pill, [data-panel]')) out.push(...P.inSafe(el));
  out.push(...P.hit44(r.querySelector('[data-back]')));
  for (const n of r.querySelectorAll('[data-city]')) out.push(...P.inSafe(n.querySelector('.node-badge'), n.dataset.city), ...P.covered(n.querySelector('.node-badge'), n.dataset.city), ...P.hit44(n, n.dataset.city));
  const panel = r.querySelector('[data-panel]');
  const play = panel.querySelector('[data-play]');
  if (play) {
    const q = play.getBoundingClientRect();
    const Q = panel.getBoundingClientRect();
    if (q.top < Q.top - 0.5 || q.bottom > Q.bottom + 0.5) out.push('Travel out of sight in its panel');
    out.push(...P.hit44(play));
  }
  // the map's cities clear of the panel and the header
  for (const n of r.querySelectorAll('[data-city] .node-badge')) for (const o of r.querySelectorAll('[data-panel], .region-top > *')) out.push(...P.overlap(n, o));
  return [...out, ...P.spills(r), ...P.small(r)];
};

const BUBBLE = () => {
  const P = window.__phone;
  const b = document.querySelector('.coach');
  if (!P.vis(b)) return ['no bubble'];
  const out = [...P.inSafe(b, 'the bubble')];
  for (const btn of b.querySelectorAll('button')) out.push(...P.hit44(btn));
  for (const ring of document.querySelectorAll('.coach-ring')) if (P.vis(ring)) out.push(...P.overlap(b, ring, 'the bubble over what it points at'));
  return [...out, ...P.spills(b), ...P.small(b)];
};

// ---------- the test ----------
await T.run(async () => {
  for (lang of T.cfg.langs) {
    now = null;
    const first = sizes[0];
    const g = await openGame(browser, server, { size: first, input: 'touch', dpr: 3, mobile: true, insets: SIZES[first].insets, storage: seedStorage({ lang, tutorialDone: false, profile: BEST }) });
    page = g.page;
    io = g.io;
    const { errors } = g;
    cdp = await page.context().newCDPSession(page);
    now = first;
    await S(page, PHONE_CHECKS);
    for (const [name, fn] of Object.entries({ __phone_sheet: SHEET, __phone_catalog: CATALOG, __phone_panel: PANEL, __phone_smog: SMOG, __phone_alarm: ALARM, __phone_band: BAND, __phone_strip: STRIP })) await S(page, ([name, src]) => (window[name] = (0, eval)(`(${src})`)), [name, fn.toString()]);
    // one tap on the menu's sky: touch mode, as a phone starts (the keyboard's key badges go)
    await io.at(Math.round(g.size.w * 0.55), 12);
    await until(page, () => document.body.classList.contains('touch-mode'), null, { what: 'touch mode' });

    // ---------- the main menu and its dialogs ----------
    await atSizes('main menu: the entries, the language, the paths in the safe area, 44 px, nothing cut', MENU, null, 'menu');
    const fromMenu = [
      ['New game', '[data-act="new"]', null],
      ['Free play', '[data-act="new"]', '#modal-root [data-mode="free"]'],
      ['Load game', '[data-act="load"]', null],
      ['Settings', '[data-act="settings"]', null],
      ['Language', '[data-lang-open]', null],
      ['Credits', '[data-act="credits"]', null],
      ['Extras', '[data-act="extras"]', null],
      ['the paths', '.path-card', null],
      ['Quit', '[data-act="quit"]', null],
    ];
    for (const [label, sel, then] of fromMenu) {
      if (!(await S(page, (sel) => !!document.querySelector(sel)?.getClientRects().length, sel))) {
        T.note(`${lang}: no ${label} on this menu`);
        continue;
      }
      await click(sel);
      await opened('.modal');
      if (then) {
        await old();
        await click(then);
        await opened('#ng-seed');
      }
      await atSizes(`dialog "${label}": in the safe area, head and buttons in sight, 44 px, reachable, nothing cut`, DIALOG, null, label === 'Settings' || label === 'Free play' ? `dialog-${label.replace(/\s/g, '-')}` : null);
      await escape();
      await until(page, () => !document.querySelector('#modal-root .modal'), null, { what: `${label} closed` });
    }

    // ---------- a free play city ----------
    await click('[data-act="new"]');
    await until(page, () => !!document.querySelector('#modal-root [data-mode="free"]'), null, { what: 'new game' });
    await old();
    await click('#modal-root [data-mode="free"]');
    await until(page, () => !!document.querySelector('#ng-seed'), null, { what: 'free play' });
    await page.fill('#ng-seed', '777');
    await old();
    await click('#modal-root .modal-actions .btn-primary');
    await until(page, () => !!window.scrapbot?.session?.() && !!document.querySelector('#modal-root .modal'), null, { timeout: 20000, what: 'the intro' });
    await opened('.modal');
    await S(page, () => {
      const ses = window.scrapbot.session();
      ses.setSpeed(0);
      ses.s.nextEventAt = 1e9;
      ses.s.nextStormAt = 1e9;
    });
    await atSizes('dialog "the intro"', DIALOG);
    await old();
    await click('#modal-root .modal-actions .btn-primary');
    await until(page, () => !document.querySelector('#modal-root .modal'), null, { what: 'the intro closed' });
    const B = await G.placeFinished(page, ['dock', 'recycler']);
    const statue = await S(page, () => {
      const s = window.scrapbot.session().s;
      s.res.credits = 15200;
      s.res.parts = 900;
      s.res.scrap = 100;
      const hq = s.buildings.find((b) => b.type === 'hq');
      for (let d = 4; d < 20; d++) {
        const i = (hq.y + 5) * 56 + hq.x + d;
        if ((s.tiles[i] === 0 || s.tiles[i] === 4) && s.occ[i] === -1 && !s.solid[i]) {
          s.solid[i] = 14;
          s.rot[i] = 0;
          return i;
        }
      }
      return -1;
    });
    T.note(`${lang}: staged a Dock and a Recycler, 15200 credits, 900 parts, 100 scrap, a statue (not discovered) at ${statue}`);
    await atSizes('the band (one row of 44 px buttons) and the goal chip under it', BAND, null, 'city');
    await click('[data-obj-toggle]');
    await atSizes('the goal chip opened: all of it, above the build bar', GOAL_OPEN, null, 'goal-open');
    await click('[data-obj-toggle]');
    // the smog alarm, staged (the countdown of a city at 97%): alone, with a building in hand, with a building's panel
    await S(page, () => {
      const s = window.scrapbot.session().s;
      s.pollution = 97;
      s.smog = 4;
    });
    await until(page, () => !document.querySelector('[data-smog-alert]').hidden, null, { what: 'the smog alarm' });
    await atSizes('the smog alarm under the band, the goal chip under it: nothing covered, nothing cut', (sel) => [...window.__phone_alarm(), ...window.__phone_band()], null, 'alarm');
    await click('[data-tool="purifier"]');
    await until(page, () => !document.querySelector('[data-build-info]').hidden, null, { what: 'the strip' });
    await atSizes('the smog alarm with the strip of a building in hand under it', () => [...window.__phone_alarm(), ...window.__phone_strip()]);
    await click('[data-build-close]');
    await S(page, (id) => window.scrapbot.session().selectBuilding(id), B.dock[0]);
    await until(page, () => !document.querySelector('[data-inspector]').hidden, null, { what: 'the Dock panel' });
    await atSizes("the smog alarm with a building's panel open: left of it", () => [...window.__phone_alarm(), ...window.__phone_sheet('[data-inspector]')], null, 'alarm-panel');
    await S(page, () => {
      const ses = window.scrapbot.session();
      ses.selectBuilding(-1);
      ses.s.pollution = 15;
      ses.s.smog = 0;
    });
    await until(page, () => document.querySelector('[data-smog-alert]').hidden, null, { what: 'the alarm gone' });
    await atSizes('the build bar: every card, the bulldozer and Objects & modules brought into sight, 44 px', TOOLBAR);
    const stripBad = [];
    const types = await S(page, () => [...document.querySelectorAll('[data-toolbar] [data-tool]')].map((b) => b.dataset.tool));
    for (const type of [...types, 'doze']) {
      await click(type === 'doze' ? '[data-doze]' : `[data-tool="${type}"]`);
      await until(page, () => !document.querySelector('[data-build-info]').hidden, null, { what: `the strip of ${type}` });
      for (const size of sizes) {
        await resize(size);
        const r = await S(page, STRIP);
        if (r.length) stripBad.push(`${type} ${size}: ${r.slice(0, 2).join('; ')}`);
        if (lang === 'en' && type === 'factory' && (size === '667x375' || size === '874x402')) await T.shot(page, `strip-${type}-${size}`);
      }
      await click('[data-build-close]');
      await until(page, () => document.querySelector('[data-build-info]').hidden, null, { what: `${type} put away` });
    }
    T.ok(`${lang}: the strip of each of the ${types.length} buildings and the bulldozer in hand: between the band and the bar, × 44 px, nothing cut`, types.length === 11 && stripBad.length === 0, stripBad.slice(0, 3).join(' | '));

    // the catalog: its tabs browsed, then a tool in hand in each
    await click('[data-catalog]');
    await until(page, () => !document.querySelector('[data-catalog-panel]').hidden, null, { what: 'the catalog' });
    for (const [tool, cat] of [[null, 'construction'], [null, 'decorations'], [null, 'modules'], ['fence', 'construction'], ['lamp', 'decorations'], ['dockStorage', 'modules']]) {
      await S(page, (cat) => {
        document.querySelector(`[data-catalog-panel] [data-cat="${cat}"]`)?.click();
        document.querySelector('[data-catalog-panel] [data-filter="all"]')?.click();
      }, cat);
      await settle(page);
      if (tool) {
        await click(`[data-catalog-panel] [data-item="${tool}"]`);
        await until(page, (k) => window.scrapbot.session().piece?.kind === k, tool, { what: `${tool} in hand` });
        await settle(page);
      }
      await atSizes(`the catalog ${tool ? `with ${tool} in hand` : `browsing ${cat}`}: a sheet clear of the band and the bar, tabs, filters, tool buttons, every row reachable`, (sel) => [...window.__phone_sheet(sel), ...window.__phone_catalog()], '[data-catalog-panel]', tool === 'lamp' ? 'catalog-lamp' : null);
      if (tool) {
        await click('[data-catalog-panel] [data-done]');
        await until(page, () => !window.scrapbot.session().piece, null, { what: 'the tool put away' });
      }
    }
    await click('[data-catalog]');
    // the building and piece panels
    for (const [label, how] of [['the Recycler', ['b', B.recycler[0]]], ['the Dock', ['b', B.dock[0]]], ['a kept statue', ['p', statue]]]) {
      await S(page, ([k, id]) => (k === 'b' ? window.scrapbot.session().selectBuilding(id) : window.scrapbot.session().selectPiece(id)), how);
      await until(page, () => !document.querySelector('[data-inspector]').hidden, null, { what: label });
      await settle(page);
      await atSizes(`${label}'s panel: a sheet, every button reachable, 44 px, nothing cut`, () => [...window.__phone_sheet('[data-inspector]'), ...window.__phone_panel()], null, label === 'the Dock' ? 'panel-dock' : null);
    }
    await S(page, () => window.scrapbot.session().selectPiece(-1));
    await click('[data-smog-meter]');
    await atSizes('the smog panel: a sheet above the build bar, its total and its rule in sight', () => [...window.__phone_sheet('[data-smog-panel]'), ...window.__phone_smog()], null, 'smog');
    await click('[data-smog-close]');
    // a new project's notice and the feed
    await S(page, () => {
      const ses = window.scrapbot.session();
      ses.hud.notifyProjects(['bench', 'planter']);
      ses.hud.pushMessages([{ text: 'Storage full: build a Bot Dock to keep more scrap', tone: 'bad' }, { text: 'Goal done: +40 credits', tone: 'good' }, { text: 'A storm is coming', tone: 'event' }]);
    });
    // (placed afresh at each size: a phone's screen does not change size under a notice)
    const noticeBad = [];
    for (const size of sizes) {
      await resize(size);
      await S(page, () => window.scrapbot.session().hud.notifyProjects(['bench']));
      await until(page, () => !document.querySelector('[data-project-note]').classList.contains('arming'), null, { what: 'the notice' });
      const r = await S(page, NOTICE);
      if (r.length) noticeBad.push(`${size}: ${[...new Set(r)].slice(0, 3).join('; ')}`);
      if (lang === 'en' && (size === '667x375' || size === '874x402')) await T.shot(page, `notice-${size}`);
    }
    T.ok(`${lang}: a new project's notice and the feed: in the safe area, clear of the HUD, Open 44 px`, noticeBad.length === 0, noticeBad.slice(0, 3).join(' | '));
    await S(page, () => window.scrapbot.session().hud.notifyProjects([]));
    // the dialogs of a city: Pause, its Save and its Settings (each goes back to Pause), the hint, 2PM's parts
    const button = (i) => S(page, (i) => [...document.querySelectorAll('#modal-root .modal-actions > button')].at(i).click(), i);
    await click('[data-menu]');
    await opened('.modal');
    await atSizes('dialog "Pause"', DIALOG, null, 'pause');
    await old();
    await button(1);
    await opened('[data-slot="1"]');
    await atSizes('dialog "Save game"', DIALOG, null, 'save');
    await old();
    await button(-1);
    await until(page, () => !document.querySelector('#modal-root [data-slot]') && !!document.querySelector('#modal-root .modal'), null, { what: 'back to Pause' });
    await old();
    await button(3);
    await opened('#set-lang');
    await atSizes('dialog "Settings" in a city', DIALOG);
    // (Esc on Settings goes back to Pause, Esc again closes it)
    await escape();
    await until(page, () => !document.querySelector('#modal-root .modal'), null, { what: 'Pause closed' });
    for (const [label, sel] of [['the hint', '[data-hint]'], ["2PM's parts", '[data-import]']]) {
      await click(sel);
      await opened('.modal');
      await atSizes(`dialog "${label}"`, DIALOG);
      await escape();
      await until(page, () => !document.querySelector('#modal-root .modal'), null, { what: `${label} closed` });
    }
    // a story event (unprompted: no ×), an ending with a toast over it
    await S(page, () => (window.scrapbot.session().s.pendingEvent = 'toxic_contract'));
    await opened('.modal-story');
    await atSizes('dialog "a story event"', DIALOG, null, 'event');
    await old();
    await S(page, () => document.querySelector('#modal-root .modal-actions button:not(:disabled)').click());
    await until(page, () => !document.querySelector('#modal-root .modal'), null, { what: 'the event answered' });
    await S(page, () => {
      const ses = window.scrapbot.session();
      ses.s.outcome = { kind: 'green', day: 12 };
      ses.showEnding();
    });
    await opened('.modal-ending');
    await atSizes('dialog "an ending"', DIALOG, null, 'ending');
    await S(page, TOAST);
    await page.waitForTimeout(500); // (it slides in)
    await atSizes('a toast over the ending: in the safe area, over none of its buttons', ENDING_TOAST);
    await S(page, () => {
      document.querySelector('[data-e2e-toast]').remove();
      document.getElementById('toasts').classList.remove('below');
    });
    await old();
    await S(page, () => document.querySelectorAll('#modal-root .modal-actions > button')[0].click());
    await until(page, () => !document.querySelector('#modal-root .modal'), null, { what: 'keep building' });

    // ---------- the tutorial ----------
    await S(page, () => window.scrapbot.session().openPause());
    await until(page, () => !!document.querySelector('#modal-root .modal'), null, { what: 'pause' });
    await old();
    await S(page, () => [...document.querySelectorAll('#modal-root .modal-actions > button')].at(-1).click());
    await until(page, () => !document.getElementById('menu').hidden, null, { what: 'the main menu' });
    await click('[data-act="new"]');
    await until(page, () => !!document.querySelector('#modal-root [data-mode="tutorial"]'), null, { what: 'new game' });
    await old();
    await click('#modal-root [data-mode="tutorial"]');
    await until(page, () => !!document.querySelector('.coach'), null, { timeout: 20000, what: 'the tutorial' });
    await S(page, () => window.scrapbot.session().setSpeed(0));
    await atSizes("the tutorial's bubble, step 1", BUBBLE, null, 'tutorial-1');
    await S(page, () => (window.scrapbot.session().cameraMoved = true));
    await until(page, () => /2\//.test(document.querySelector('.coach-step')?.textContent ?? ''), null, { what: 'step 2' });
    await atSizes("the tutorial's bubble, step 2 (the Recycler)", BUBBLE, null, 'tutorial-2');
    await S(page, () => {
      const ses = window.scrapbot.session();
      const s = ses.s;
      const A = window.scrapbot.actions;
      const hq = s.buildings.find((b) => b.type === 'hq');
      for (const type of ['recycler', 'pods', 'solar']) {
        let done = false;
        for (let r = 3; r < 14 && !done; r++)
          for (let dy = -r; dy <= r && !done; dy++)
            for (let dx = -r; dx <= r && !done; dx++)
              if (A.placeCheck(s, type, hq.x + dx, hq.y + dy).ok) {
                const b = A.placeBuilding(s, type, hq.x + dx, hq.y + dy);
                if (b) {
                  b.built = 1;
                  done = true;
                }
              }
      }
    });
    await until(page, () => /5\//.test(document.querySelector('.coach-step')?.textContent ?? ''), null, { what: 'step 5' });
    await atSizes("the tutorial's bubble, step 5 (the speed)", BUBBLE, null, 'tutorial-5');
    await S(page, () => window.scrapbot.session().setSpeed(2));
    await until(page, () => !!document.querySelector('.coach [data-next]'), null, { what: 'step 6' });
    await old();
    await click('.coach [data-next]');
    await until(page, () => !!document.querySelector('.coach [data-campaign]'), null, { what: 'step 7' });
    await S(page, () => window.scrapbot.session().setSpeed(0));
    await atSizes("the tutorial's bubble, step 7 (the hint and the goal)", BUBBLE, null, 'tutorial-7');

    // ---------- the region map and a campaign city ----------
    await click('.coach [data-campaign]');
    await until(page, () => !document.getElementById('region').hidden, null, { timeout: 20000, what: 'the region map' });
    await frames(page, 5);
    await atSizes('the region map: the header, the cities and the panel in the safe area, Travel in sight, 44 px', REGION, null, 'region');
    await click('#region [data-play]');
    await until(page, () => !!window.scrapbot?.session?.()?.s.cityId && !!document.querySelector('#modal-root .modal'), null, { timeout: 20000, what: 'the campaign city' });
    await opened('.modal');
    await S(page, () => {
      const ses = window.scrapbot.session();
      ses.setSpeed(0);
      ses.s.nextEventAt = 1e9;
      ses.s.nextStormAt = 1e9;
    });
    await atSizes('dialog "a campaign city\'s intro"', DIALOG);
    await old();
    await click('#modal-root .modal-actions .btn-primary');
    await until(page, () => !document.querySelector('#modal-root .modal'), null, { what: 'the intro closed' });
    await atSizes('a campaign city: the band, the hint and the cargo blimp, the goal chip', BAND, null, 'campaign');
    await click('[data-obj-toggle]');
    await atSizes("a campaign city's goal opened (its star goals)", GOAL_OPEN);
    await click('[data-obj-toggle]');
    await click('[data-region]');
    await opened('.modal');
    await atSizes('dialog "the cargo blimp"', DIALOG, null, 'trade');
    await escape();
    T.ok(`${lang}: no page errors`, errors.length === 0, errors.slice(0, 2).join(' | '));
    await g.ctx.close();
  }
}, () => page);

await browser.close();
await server.close();
await T.finish();
