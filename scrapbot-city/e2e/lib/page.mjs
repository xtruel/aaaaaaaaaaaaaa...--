// Browser, pages and waits. Every wait here is on the game's state or the DOM (polled once per animation frame), never
// a fixed sleep: on a loaded machine the same test only gets slower. The one exception is the input's pacing
// (input.mjs): the game's double-press guards are measured in milliseconds, so two presses meant as two must be
// that far apart.
import { chromium } from './playwright.mjs';
import { Input, PAD_INIT } from './input.mjs';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// In every page, before the game's own scripts: when the current dialog appeared (a controller's A, like a key, is
// ignored by a dialog's buttons for its first 600 ms: src/ui/modal.ts).
// In a debug build it also counts the city interface's redraws (the HUD is redrawn every 0.1 s of play, not every
// frame): a test reads the interface only once it has caught up with the city (settle). Counting wraps the HUD's
// update without changing what it does.
export const PROBE_INIT = () => {
  const probe = { modalAt: 0, modal: null, hudTicks: 0 };
  window.__e2e = probe;
  const tick = () => {
    const m = document.querySelector('#modal-root .modal');
    if (m !== probe.modal) {
      probe.modal = m;
      probe.modalAt = performance.now();
    }
    const ses = window.scrapbot?.session?.();
    if (ses?.hud && !ses.hud.__e2eCounted) {
      const h = ses.hud;
      const update = h.update;
      h.update = function (...a) {
        const r = update.apply(this, a);
        probe.hudTicks++;
        return r;
      };
      h.__e2eCounted = true;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

export async function launch() {
  return chromium.launch();
}

export const S = (page, fn, arg) => page.evaluate(fn, arg);

// n animation frames of the page (the game handles a frame's input and redraws its interface once per frame)
export const frames = (page, n = 2) =>
  page.evaluate(
    (n) =>
      new Promise((res) => {
        let k = 0;
        const f = () => (++k >= n ? res() : requestAnimationFrame(f));
        requestAnimationFrame(f);
      }),
    n,
  );

// Polls fn(arg) in the page once per frame until it returns something truthy; returns that value. On timeout: throws
// with `what` (or returns null with { soft: true }).
export async function until(page, fn, arg, { timeout = 15000, what = 'a condition', soft = false } = {}) {
  try {
    const h = await page.waitForFunction(fn, arg, { timeout, polling: 'raf' });
    const v = await h.jsonValue().catch(() => true);
    await h.dispose().catch(() => {});
    return v;
  } catch (e) {
    if (soft) return null;
    throw new Error(`timed out after ${timeout} ms waiting for ${what}: ${String(e.message).split('\n')[0]}`);
  }
}

// The city's interface has caught up with the city: two redraws of the HUD since now (debug build), else 3 frames.
export async function settle(page) {
  const n0 = await page.evaluate(() => (window.scrapbot?.session?.() && !document.querySelector('#game[hidden]') ? window.__e2e?.hudTicks ?? null : null));
  if (n0 === null) return frames(page, 3);
  await until(page, (n0) => !window.scrapbot?.session?.() || window.__e2e.hudTicks >= n0 + 2, n0, { what: 'the interface to catch up' });
}

// The box of an element once it stands still (a dialog pops in, a panel slides): the same for 3 frames and 200 ms.
// An element that never stops (a bobbing city on the region map, a pulsing button) gives, after 1.5 s, the part of
// the screen it covered on every frame meanwhile: a press there reaches it whatever its phase.
export async function stableBox(page, sel, { timeout = 8000 } = {}) {
  await page.evaluate((sel) => delete (window.__e2eStable ??= {})[sel], sel);
  return until(
    page,
    (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      const key = [r.left, r.top, r.width, r.height].map((v) => Math.round(v * 2)).join(',');
      const w = (window.__e2eStable ??= {});
      const now = performance.now();
      let s = w[sel];
      if (!s) s = w[sel] = { key, n: 0, t: now, t0: now, i: { l: r.left, t: r.top, r: r.right, b: r.bottom } };
      if (s.key === key) s.n++;
      else Object.assign(s, { key, n: 1, t: now });
      s.i = { l: Math.max(s.i.l, r.left), t: Math.max(s.i.t, r.top), r: Math.min(s.i.r, r.right), b: Math.min(s.i.b, r.bottom) };
      if (s.n >= 3 && now - s.t >= 200) return { x: r.left, y: r.top, width: r.width, height: r.height };
      if (now - s.t0 > 1500 && s.i.r - s.i.l > 4 && s.i.b - s.i.t > 4) return { x: s.i.l, y: s.i.t, width: s.i.r - s.i.l, height: s.i.b - s.i.t, moving: true };
      return null;
    },
    sel,
    { timeout, what: `${sel} to stand still on screen` },
  );
}

// A phone's safe area as iOS reports it (env(safe-area-inset-*)), emulated by Chromium for this page (CDP
// Emulation.setSafeAreaInsetsOverride, Chromium 136+): { top, left, right, bottom } in CSS px. Kept across reloads.
export async function safeArea(page, insets) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, left: 0, right: 0, bottom: 0, ...insets } });
  return cdp;
}

// A new browser context and page for one game: storage written on a blank page of the same origin first (no marker
// left), the pad faked when the input is a pad, page errors and console errors collected. `mobile` emulates a phone's
// browser (Chromium's isMobile: the page's viewport meta, overlay scrollbars); `insets` its safe area (safeArea).
export async function openGame(browser, server, { size = '1280x800', input = 'mouse', storage = {}, hook = true, dpr = 1, mobile = false, insets = null } = {}) {
  const [w, h] = size.split('x').map(Number);
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: input === 'touch', isMobile: mobile, deviceScaleFactor: dpr });
  await ctx.addInitScript(PROBE_INIT);
  if (input === 'pad') await ctx.addInitScript(PAD_INIT);
  const errors = [];
  const page = await newPage(ctx, errors);
  if (insets) await safeArea(page, insets);
  await page.goto(server.blank);
  await page.evaluate((storage) => {
    localStorage.clear();
    sessionStorage.clear();
    for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, v);
  }, storage);
  await page.goto(server.url);
  await waitMenu(page, { hook });
  const io = new Input(page, input);
  await io.attach(page);
  return { ctx, page, errors, io, size: { w, h } };
}

export async function newPage(ctx, errors) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text().slice(0, 300)}`);
  });
  return page;
}

// The main menu is up and the game ready (with the hook in a debug build).
export async function waitMenu(page, { hook = true, timeout = 30000 } = {}) {
  await page.waitForSelector('#menu:not([hidden]) [data-act="new"]', { state: 'visible', timeout });
  if (hook) await until(page, () => !!window.scrapbot, null, { timeout, what: 'the debug hook window.scrapbot' });
  await until(page, () => document.fonts.status === 'loaded', null, { timeout, what: 'the fonts' });
  await stableBox(page, '[data-act="new"]');
}

// The page reloaded (F5): the same storage, the main menu again.
export async function reload(page, io, { hook = true } = {}) {
  await page.reload();
  await waitMenu(page, { hook });
  await io.attach(page);
}

export const modalOpen = (page) => S(page, () => !!document.querySelector('#modal-root .modal'));
export const modalTitle = (page) => S(page, () => document.querySelector('#modal-root .modal h2')?.textContent ?? '');
