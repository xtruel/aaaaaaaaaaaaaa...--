// The iOS app's shell, SIMULATED in Chromium (no iPad, iPhone, WKWebView or Capacitor native code runs): a fake
// window.Capacitor with platform 'ios' put in the page before the game (e2e/lib/capacitor.mjs: the Filesystem plugin
// answered from a folder kept by this test, so it outlives a relaunch; the App plugin's pause and resume sent by the
// test), the debug build, iPad sizes 1024x768, 1133x744, 1180x820 and 1376x1032 at DPR 2, CDP touch events, the
// safe-area insets of an iPad (home indicator) emulated by CDP (Emulation.setSafeAreaInsetsOverride). At each size:
//  shell:   html.ios-app, status bar hidden, App pause/resume listened to, page zoom off in the viewport, no text
//           selection or rubber band (computed style; the long-press callout is WebKit's and not checked here)
//  menu:    no Quit; touch mode from the first screen (before any touch); Settings without a Fullscreen box
//  city:    a free play city started with touches; the pause menu's tip in the touch wording; the HUD, the main menu
//           and the dialogs inside the safe area, the map under all of it
//  pinch:   two fingers spread and pinch on the map: the map zooms in and out, the page does not, nothing is bought
//  pause:   the App plugin's pause: the city saved (autosave) and paused, the save in its file; resume: running again
//  relaunch: the app left (its pagehide autosave), iOS clears the web view's storage, the app opens again with a slow
//           file system: the main menu comes up only after the saves are back (Continue offered at once), every key
//           as it was, Continue opens the same city
//  errors:  no page error, no console error
// Then once at an iPhone size in landscape (852x393, Dynamic Island insets left/right 59, bottom 21): the main menu,
// the HUD and a dialog keep out of the insets, the map runs under them. (Only the safe area: the compact layout for
// phones is not tested here.)
import { startTest } from '../lib/report.mjs';
import { frames, launch, newPage, PROBE_INIT, S, settle, sleep, until, waitMenu } from '../lib/page.mjs';
import { serve } from '../lib/server.mjs';
import { Input } from '../lib/input.mjs';
import * as G from '../lib/game.mjs';
import { seedStorage } from '../lib/profile.mjs';
import { FakeShell, appEvent } from '../lib/capacitor.mjs';

const T = await startTest({ name: 'ios-shell', input: 'touch', sizes: ['1024x768', '1133x744', '1180x820', '1376x1032'], phone: '852x393' });
const server = await serve(T.cfg.debug);
const browser = await launch();
let page = null;

// iPad: the home indicator at the bottom (status bar hidden); the largest also with a top inset
const IPAD_INSETS = { top: 0, left: 0, right: 0, bottom: 20 };
const insetsFor = (size) => (size === '1376x1032' ? { ...IPAD_INSETS, top: 24 } : IPAD_INSETS);
const PHONE_INSETS = { top: 0, left: 59, right: 59, bottom: 21 };
const fileName = (key) => [...key].map((ch) => (/[a-z0-9-]/.test(ch) ? ch : `_${ch.codePointAt(0).toString(16).padStart(2, '0')}`)).join('');
const mirrored = (shell, key) => {
  try {
    return JSON.parse(shell.read(`saves/${fileName(key)}.json`) ?? 'null');
  } catch {
    return null;
  }
};

async function openShell(size, { storage = {}, insets = null, shell = new FakeShell() } = {}) {
  const [w, h] = size.split('x').map(Number);
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(PROBE_INIT);
  await shell.attach(ctx);
  const errors = [];
  const p = await newPage(ctx, errors);
  const cdp = await ctx.newCDPSession(p);
  if (insets) await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets });
  await p.goto(server.blank);
  await p.evaluate((storage) => {
    localStorage.clear();
    for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, v);
  }, storage);
  await p.goto(server.url);
  await waitMenu(p);
  const io = new Input(p, 'touch');
  await io.attach(p);
  return { ctx, page: p, errors, io, shell, cdp, w, h };
}

// the parts of the interface given, outside the safe area (or only sideways): their boxes
const outside = ([sels, ins, sideways]) => {
  const W = innerWidth;
  const H = innerHeight;
  const bad = [];
  for (const sel of sels)
    for (const el of document.querySelectorAll(sel)) {
      if (!el.getClientRects().length || el.closest('[hidden]')) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const out = r.left < ins.left - 0.5 || r.right > W - ins.right + 0.5 || (!sideways && (r.top < ins.top - 0.5 || r.bottom > H - ins.bottom + 0.5));
      if (out) bad.push(`${sel} ${Math.round(r.left)},${Math.round(r.top)}..${Math.round(r.right)},${Math.round(r.bottom)}`);
    }
  return bad;
};
const MENU_PARTS = ['.menu-list button', '.corner-tl', '.corner-right', '.logo', '.path-cards', '.footer-tag', '.menu-footer .question'];
const REGION_PARTS = ['.region-top > *', '.region-panel'];
const HUD_PARTS = ['.hud-top > *', '[data-toolbar]', '[data-objective]', '[data-feed] .msg', '[data-inspector]', '[data-catalog-panel]', '[data-smog-alert]', '[data-project-note]'];

// two fingers on the map, from d0 to d1 px apart around (cx, cy)
async function pinch(cdp, cx, cy, d0, d1, steps = 12) {
  const pts = (d) => [
    { x: cx - d / 2, y: cy, id: 1, radiusX: 4, radiusY: 4, force: 1 },
    { x: cx + d / 2, y: cy, id: 2, radiusX: 4, radiusY: 4, force: 1 },
  ];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(d0) });
  for (let k = 1; k <= steps; k++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(d0 + ((d1 - d0) * k) / steps) });
    await sleep(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

// New game -> Campaign: the region map, its first city's panel up
async function openRegion(io) {
  await io.menu('[data-act="new"]');
  await io.menu('#modal-root [data-mode="campaign"]');
  await io.page.waitForSelector('#region:not([hidden]) .region-top', { state: 'visible' });
  await G.answerDialogs(io.page, io);
  await settle(io.page);
}

const gameKeys = () => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('scrapbot:')).sort().map((k) => [k, localStorage.getItem(k)]));
// (a slot's info carries the time it was saved: compared without it)
const sameKeys = (a, b) => {
  const strip = (k, v) => (/^scrapbot:meta:/.test(k) ? JSON.stringify({ ...JSON.parse(v), savedAt: 0 }) : v);
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  return keys.filter((k) => a[k] === undefined || b[k] === undefined || strip(k, a[k]) !== strip(k, b[k]));
};

await T.run(async () => {
  for (const size of T.cfg.sizes) {
    const ins = insetsFor(size);
    T.note(`${size}: DPR 2, CDP touch, emulated safe-area insets ${JSON.stringify(ins)}`);
    const g = await openShell(size, { storage: seedStorage({ profile: 'new' }), insets: ins });
    page = g.page;
    const { io, shell, errors, cdp } = g;

    // ---------- the shell ----------
    const look = await S(page, () => {
      const h = getComputedStyle(document.documentElement);
      const b = getComputedStyle(document.body);
      return {
        ios: document.documentElement.classList.contains('ios-app'),
        viewport: document.querySelector('meta[name="viewport"]').content,
        select: b.userSelect,
        overscroll: h.overscrollBehaviorY,
        touchAction: h.touchAction,
        calls: window.__capCalls,
      };
    });
    T.ok(`${size}: the game took the iOS shell (html.ios-app); status bar hidden; App pause and resume listened to`, look.ios && look.calls.includes('StatusBar.hide') && look.calls.includes('App.addListener(pause)') && look.calls.includes('App.addListener(resume)'), look.calls.join(' '));
    T.ok(`${size}: no page zoom (viewport maximum-scale=1, user-scalable=no; touch-action pan only)`, /maximum-scale=1/.test(look.viewport) && /user-scalable=no/.test(look.viewport) && look.touchAction === 'pan-x pan-y', `${look.viewport}; ${look.touchAction}`);
    T.ok(`${size}: no text selection, no rubber band (computed style)`, look.select === 'none' && look.overscroll === 'none', JSON.stringify(look));

    // ---------- the main menu ----------
    const menu = await S(page, () => [...document.querySelectorAll('#menu [data-act]')].map((b) => b.dataset.act).join(' '));
    T.ok(`${size}: main menu without Quit`, menu === 'new continue load settings extras credits', menu);
    T.ok(`${size}: touch mode from the first screen, before any touch`, await S(page, () => document.body.classList.contains('touch-mode')));
    const menuOut = await S(page, outside, [MENU_PARTS, ins, false]);
    T.ok(`${size}: main menu inside the safe area`, menuOut.length === 0, menuOut.slice(0, 4).join('; '));
    await T.shot(page, `${size}-main-menu`);
    await io.menu('[data-act="settings"]');
    const settingsBoxes = await S(page, () => [...document.querySelectorAll('#modal-root input[type="checkbox"]')].map((b) => b.id).join(' '));
    T.ok(`${size}: Settings without the Fullscreen box (desktop only)`, !settingsBoxes.includes('set-full') && settingsBoxes.includes('set-crt'), settingsBoxes);
    const dialogOut = await S(page, outside, [['#modal-root .modal'], ins, false]);
    T.ok(`${size}: a dialog inside the safe area`, dialogOut.length === 0, dialogOut.join('; '));
    await io.menu('#modal-root .modal-actions .btn-primary');
    await until(page, () => !document.querySelector('#modal-root .modal'), null, { what: 'Settings closed' });
    // the campaign's region map
    await openRegion(io);
    const regionOut = await S(page, outside, [REGION_PARTS, ins, false]);
    T.ok(`${size}: the region map's bar and city panel inside the safe area`, regionOut.length === 0, regionOut.slice(0, 4).join('; '));
    await T.shot(page, `${size}-region`);
    await io.menu('#region [data-back]');
    await page.waitForSelector('#menu:not([hidden]) [data-act="new"]', { state: 'visible' });

    // ---------- a city ----------
    await G.startFreePlay(page, io, { seed: 2026, name: `Pad ${size}` });
    await G.noEvents(page);
    await io.pauseMenu();
    const tip = await S(page, () => document.querySelector('#modal-root .pause-tip')?.textContent ?? '');
    T.ok(`${size}: the pause menu's tip names the touch controls`, /finger/.test(tip) && !/\bTab\b/.test(tip), tip);
    await io.menu(await G.menuButton(page, 'Resume'));
    await until(page, () => !document.querySelector('#modal-root .modal'), null, { what: 'the pause menu closed' });
    await io.speed(1);
    await settle(page);
    const hudOut = await S(page, outside, [HUD_PARTS, ins, false]);
    const map = await S(page, () => {
      const r = document.querySelector('#game canvas.world').getBoundingClientRect();
      return r.left <= 0 && r.top <= 0 && r.right >= innerWidth && r.bottom >= innerHeight;
    });
    T.ok(`${size}: the HUD inside the safe area, the map under all the screen`, hudOut.length === 0 && map, hudOut.slice(0, 4).join('; '));
    await T.shot(page, `${size}-city`);

    // ---------- pinch ----------
    const before = await S(page, () => ({ zoom: window.scrapbot.session().renderer.zoom, res: { ...window.scrapbot.session().s.res }, n: window.scrapbot.session().s.buildings.length }));
    const spot = await G.freeRect(page);
    const cx = Math.round((spot.left + spot.right) / 2);
    const cy = Math.round((spot.top + spot.bottom) / 2);
    await io.pace();
    await pinch(cdp, cx, cy, 80, 320);
    await frames(page, 3);
    const zIn = await S(page, () => window.scrapbot.session().renderer.zoom);
    await io.pace();
    await pinch(cdp, cx, cy, 320, 60);
    await frames(page, 3);
    const after = await S(page, () => ({ zoom: window.scrapbot.session().renderer.zoom, n: window.scrapbot.session().s.buildings.length, scale: window.visualViewport?.scale ?? 1, credits: window.scrapbot.session().s.res.credits }));
    T.ok(`${size}: two fingers zoom the map in (${before.zoom} -> ${zIn}) and out (-> ${after.zoom}); the page stays at scale 1; nothing built`, zIn > before.zoom && after.zoom < zIn && after.scale === 1 && after.n === before.n, JSON.stringify({ before, zIn, after }));

    // ---------- the App plugin's pause and resume ----------
    const was = await S(page, () => localStorage.getItem('scrapbot:meta:auto'));
    const n = await appEvent(page, 'pause');
    await until(page, (was) => window.scrapbot.session().speed === 0 && localStorage.getItem('scrapbot:meta:auto') !== was, was, { what: 'the pause event to save and pause the city' });
    const saved = await S(page, () => localStorage.getItem('scrapbot:save:auto'));
    T.ok(`${size}: App pause (${n} listener): the city saved in the autosave slot and paused`, !!saved && JSON.parse(saved).cityName === `Pad ${size}`);
    const t0 = Date.now();
    while (mirrored(shell, 'save:auto')?.value !== saved && Date.now() - t0 < 10000) await sleep(50);
    T.ok(`${size}: ...and that save is in its file (Library/saves), through a temporary file and a rename`, mirrored(shell, 'save:auto')?.value === saved && !shell.list('saves').some((f) => f.endsWith('.tmp')), shell.list('saves').join(' '));
    await appEvent(page, 'resume');
    await until(page, () => window.scrapbot.session().speed === 1, null, { what: 'resume to start the clock again' });
    T.ok(`${size}: App resume: the city runs again at its speed`, true);
    // paused again (as the app going to the background) and every key in its file
    await appEvent(page, 'pause');
    await until(page, () => window.scrapbot.session().speed === 0, null, { what: 'paused' });
    const city = await S(page, () => {
      const s = window.scrapbot.session().s;
      return { name: s.cityName, time: s.time, buildings: s.buildings.length, credits: Math.round(s.res.credits) };
    });
    const local = await S(page, gameKeys);
    const t1 = Date.now();
    const behind = () => Object.entries(local).filter(([k, v]) => mirrored(shell, k.slice(9))?.value !== v).map(([k]) => k);
    while (behind().length && Date.now() - t1 < 10000) await sleep(50);
    T.ok(`${size}: every key of the browser storage has its file (${Object.keys(local).length} keys)`, behind().length === 0, behind().join(' '));

    // ---------- relaunch after iOS cleared the web view's storage ----------
    await page.goto(server.blank); // the app leaves (pagehide: the game's own autosave)
    const left = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('scrapbot:')).sort().map((k) => [k, localStorage.getItem(k)])));
    await page.evaluate(() => localStorage.clear());
    shell.delay.readdir = 1500; // a slow file system: the game must wait for its saves
    const t2 = Date.now();
    await page.goto(server.url);
    const early = await S(page, () => document.querySelectorAll('#menu [data-act]').length);
    await waitMenu(page);
    const waited = Date.now() - t2;
    delete shell.delay.readdir;
    const cont = await S(page, () => !document.querySelector('[data-act="continue"]').disabled);
    T.ok(`${size}: relaunch with the storage cleared: the main menu only once the saves are back (${waited} ms, none drawn before), Continue offered at once`, early === 0 && waited >= 1500 && cont, JSON.stringify({ early, waited, cont }));
    const back = await S(page, gameKeys);
    const diff = sameKeys(left, back);
    T.ok(`${size}: every key back as it was (${Object.keys(back).length} keys; a slot's save time aside)`, diff.length === 0, diff.join(' '));
    await T.shot(page, `${size}-relaunch-menu`);
    const restored = await S(page, () => {
      const d = JSON.parse(localStorage.getItem('scrapbot:save:auto'));
      return { name: d.cityName, time: d.time, buildings: d.buildings.length, credits: Math.round(d.res.credits) };
    });
    await io.menu('[data-act="continue"]');
    await until(page, () => !!window.scrapbot?.session?.() && !document.querySelector('#menu:not([hidden])'), null, { timeout: 20000, what: 'Continue to open the city' });
    await G.cityStarted(page, io);
    const again = await S(page, () => {
      const s = window.scrapbot.session().s;
      return { name: s.cityName, time: s.time, buildings: s.buildings.length };
    });
    // (the save is the city as it was left, paused; the city Continue opens runs on from that time)
    T.ok(`${size}: Continue opens the same city (the restored save: name, time, buildings, credits as left)`, JSON.stringify(restored) === JSON.stringify(city) && again.name === city.name && again.buildings === city.buildings && again.time >= city.time - 1e-9, JSON.stringify({ city, restored, again }));
    await T.shot(page, `${size}-relaunch-city`);
    T.ok(`${size}: no page errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
    await g.ctx.close();
  }

  // ---------- an iPhone in landscape: the safe area only ----------
  const size = T.cfg.phone;
  T.note(`${size}: DPR 2, CDP touch, emulated safe-area insets ${JSON.stringify(PHONE_INSETS)} (Dynamic Island in landscape)`);
  const g = await openShell(size, { storage: seedStorage({ profile: 'new' }), insets: PHONE_INSETS });
  page = g.page;
  const menuOut = await S(page, outside, [MENU_PARTS, PHONE_INSETS, true]);
  T.ok(`${size}: main menu clear of the side insets`, menuOut.length === 0, menuOut.slice(0, 4).join('; '));
  const band = await S(page, () => {
    const r = document.querySelector('.menu-footer').getBoundingClientRect();
    return { left: r.left, right: r.right };
  });
  T.ok(`${size}: the menu footer's band still runs from edge to edge`, band.left <= 0 && band.right >= g.w, JSON.stringify(band));
  await T.shot(page, `${size}-main-menu`);
  await openRegion(g.io);
  const regionOut = await S(page, outside, [REGION_PARTS, PHONE_INSETS, true]);
  T.ok(`${size}: the region map's bar and city panel clear of the side insets`, regionOut.length === 0, regionOut.slice(0, 4).join('; '));
  await T.shot(page, `${size}-region`);
  await g.io.menu('#region [data-back]');
  await page.waitForSelector('#menu:not([hidden]) [data-act="new"]', { state: 'visible' });
  await G.startFreePlay(page, g.io, { seed: 2026 });
  await G.noEvents(page);
  await settle(page);
  const hudOut = await S(page, outside, [['.hud-top > *', '[data-toolbar]', '[data-objective]'], PHONE_INSETS, true]);
  const bar = await S(page, () => document.querySelector('[data-toolbar]').getBoundingClientRect().bottom);
  T.ok(`${size}: the HUD clear of the side insets and the build bar above the home indicator`, hudOut.length === 0 && bar <= g.h - PHONE_INSETS.bottom + 0.5, `${hudOut.slice(0, 4).join('; ')} bar bottom ${bar}`);
  await T.shot(page, `${size}-city`);
  await g.io.pauseMenu();
  const dialogOut = await S(page, outside, [['#modal-root .modal'], PHONE_INSETS, true]);
  T.ok(`${size}: a dialog clear of the side insets`, dialogOut.length === 0, dialogOut.join('; '));
  await T.shot(page, `${size}-pause`);
  T.ok(`${size}: no page errors`, g.errors.length === 0, g.errors.slice(0, 3).join(' | '));
  await g.ctx.close();
}, () => page);

await browser.close();
await server.close();
await T.finish();
