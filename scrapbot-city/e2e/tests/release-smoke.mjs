// The release build (what players get), Playwright mouse+keyboard:
//  the file: no test hook (the debug build of the same checkout has it: the search works), no source map, no
//  external script/style/image, fonts embedded, no console.log/debug/info
//  the page: window.scrapbot undefined, no game object on window; every main-menu dialog opens and closes (New game's
//  mode chooser, Load, Settings, Extras, Credits, the language picker -> Italiano and back, Quit -> Stay); a free play
//  city: its intro, the pause menu, the catalog; letter, digit and F keys never change the resources; no request
//  leaves the machine; no page error, console error or warning; only product storage keys
import { readFileSync } from 'fs';
import { join } from 'path';
import { startTest } from '../lib/report.mjs';
import { launch, openGame, S, settle, until } from '../lib/page.mjs';
import { serve } from '../lib/server.mjs';
import * as G from '../lib/game.mjs';
import { PRODUCT_KEY, seedStorage } from '../lib/profile.mjs';
import { HOOK_MARKER } from '../lib/build.mjs';

const T = await startTest({ name: 'release-smoke', input: 'mouse', size: '1280x800' });
const server = await serve(T.cfg.release);
const browser = await launch();
let page = null;

await T.run(async () => {
  // ---------- the file ----------
  const dist = readFileSync(join(T.cfg.release, 'index.html'), 'utf8');
  const debug = readFileSync(join(T.cfg.debug, 'index.html'), 'utf8');
  T.ok('control: the debug build carries the test hook (window.scrapbot = { session, ... })', HOOK_MARKER.test(debug));
  T.ok('the release build carries no test hook', !HOOK_MARKER.test(dist) && !/Object\.assign\(window\s*,\s*\{\s*scrapbot/.test(dist));
  T.ok('no source map reference', !/sourceMappingURL/.test(dist));
  const ext = dist.match(/<(script|link|img|iframe)[^>]+(src|href)=["']https?:[^>]*>/gi) ?? [];
  T.ok('no <script>, <link>, <img> or <iframe> pointing at the network', ext.length === 0, ext.join(' | '));
  const fonts = (dist.match(/url\(data:font\/woff2;base64,/g) ?? []).length;
  T.ok('fonts embedded in the file (woff2), none fetched', fonts > 0 && !/fonts\.googleapis|fonts\.gstatic/.test(dist), `${fonts} embedded fonts`);
  const noisy = (dist.match(/console\.(log|debug|info|trace)\(/g) ?? []).length;
  T.ok('no console.log / debug / info / trace calls', noisy === 0, `${noisy}`);

  // ---------- the page ----------
  const g = await openGame(browser, server, { input: 'mouse', size: T.cfg.size, hook: false, storage: seedStorage({ profile: 'new' }) });
  page = g.page;
  const { io, errors } = g;
  const requests = [];
  const warnings = [];
  page.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith(server.base) && !/^(data|blob|about):/.test(u)) requests.push(u);
  });
  page.on('console', (m) => {
    if (m.type() === 'warning') warnings.push(m.text().slice(0, 200));
  });
  T.ok('window.scrapbot is undefined', await S(page, () => typeof window.scrapbot === 'undefined'));
  const blank = await g.ctx.newPage();
  await blank.goto(server.blank);
  const base = await blank.evaluate(() => Object.getOwnPropertyNames(window));
  await blank.close();
  const extra = (await S(page, () => Object.getOwnPropertyNames(window))).filter((k) => !base.includes(k) && !k.startsWith('__e2e'));
  T.ok('no game object put on window (compared with a blank page of the same origin)', extra.length === 0, extra.join(', '));
  const menu = await S(page, () => [...document.querySelectorAll('#menu [data-act]')].map((b) => `${b.dataset.act}${b.disabled ? '(off)' : ''}`).join(' '));
  T.ok('main menu: New game, Continue (off: nothing saved), Load game, Settings, Extras, Credits, Quit', menu === 'new continue(off) load settings extras credits quit', menu);
  await T.shot(page, 'main-menu');

  // every dialog of the main menu opens, and closes
  const closeWith = async (how) => {
    if (how === 'esc') {
      await io.pace();
      await page.keyboard.press('Escape');
      io.mark();
    } else await io.menu(how);
    await until(page, () => !document.querySelector('#modal-root .modal'), null, { what: 'the dialog closed' });
  };
  const dialog = async (act, check, how = 'esc') => {
    await io.menu(`[data-act="${act}"]`);
    await page.waitForSelector('#modal-root .modal', { state: 'visible' });
    await settle(page);
    const title = await G.stableBox(page, '#modal-root .modal').then(() => S(page, () => document.querySelector('#modal-root .modal h2')?.textContent ?? ''));
    const ok = await check();
    T.ok(`main menu: ${act} opens "${title}"${ok === true ? '' : ` (${ok})`} and closes`, ok === true, String(ok));
    if (act === 'new') await T.shot(page, 'mode-chooser');
    await closeWith(how);
  };
  await dialog('new', async () => ((await S(page, () => [...document.querySelectorAll('#modal-root [data-mode]')].map((b) => b.dataset.mode).join())) === 'campaign,free,tutorial' ? true : 'modes missing'));
  await dialog('load', async () => ((await S(page, () => document.querySelectorAll('#modal-root [data-slot]:disabled').length)) === 4 ? true : 'slots not all empty'), '#modal-root .modal-x');
  await dialog('settings', async () => ((await S(page, () => !!document.querySelector('#modal-root .modal input, #modal-root .modal select'))) ? true : 'no controls'));
  await dialog('extras', async () => true);
  await dialog('credits', async () => true);
  await dialog('quit', async () => ((await S(page, () => document.querySelector('#modal-root .modal h2')?.textContent)) === 'Quit Scrapbot City?' ? true : 'not the quit question'), '#modal-root .modal-actions > button:nth-child(2)');
  T.ok('Quit -> Stay: still on the main menu', await S(page, () => !document.querySelector('#menu').hidden));
  // the language: Italiano and back
  await io.menu('[data-lang-open]');
  await io.menu('#modal-root [data-lang="it"]');
  await until(page, () => document.querySelector('[data-act="new"] .label')?.textContent === 'Nuova partita', null, { soft: true, timeout: 5000 });
  const it = await S(page, () => [...document.querySelectorAll('#menu [data-act] .label')].map((l) => l.textContent).join(' | '));
  T.ok('language -> Italiano: the menu reads in Italian at once', /^Nuova partita/.test(it), it);
  await T.shot(page, 'menu-italiano');
  await io.menu('[data-lang-open]');
  await io.menu('#modal-root [data-lang="en"]');
  await until(page, () => document.querySelector('[data-act="new"] .label')?.textContent === 'New game', null, { what: 'English again' });
  T.ok('language -> English again', true);

  // ---------- a free play city ----------
  await io.menu('[data-act="new"]');
  await io.menu('#modal-root [data-mode="free"]');
  await page.waitForSelector('#ng-seed', { state: 'visible' });
  await page.fill('#ng-seed', '12345');
  await io.menu('#modal-root .modal-actions .btn-primary');
  await page.waitForSelector('#game:not([hidden]) .hud [data-toolbar]', { state: 'visible', timeout: 20000 });
  await page.waitForSelector('#modal-root .modal', { state: 'visible', timeout: 10000 });
  const intro = await S(page, () => document.querySelector('#modal-root .modal h2')?.textContent ?? '');
  T.ok('a free play city opens with USA-9\'s welcome', /^Welcome to/.test(intro), intro);
  await io.menu('#modal-root .modal-actions .btn-primary');
  await until(page, () => !document.querySelector('#modal-root .modal'), null, { what: 'the welcome answered' });
  await io.press('[data-speed="0"]');
  await until(page, () => document.querySelector('[data-speed="0"]').classList.contains('active'), null, { what: 'paused' });
  const hud = () => S(page, () => Object.fromEntries(['scrap', 'parts', 'credits'].map((k) => [k, document.querySelector(`.hud [data-res="${k}"] [data-v]`)?.textContent ?? null])));
  const h0 = await hud();
  T.ok('the HUD shows the starting resources (0 scrap, 40 parts, 150 credits)', h0.scrap === '0' && h0.parts === '40' && h0.credits === '150', JSON.stringify(h0));
  await io.pauseMenu();
  const pause = await S(page, () => [...document.querySelectorAll('#modal-root .modal-actions > button')].map((b) => b.textContent.trim()));
  T.ok('the pause menu: Resume, Save game, Load game, Settings, Save & main menu', pause.join('|') === 'Resume|Save game|Load game|Settings|Save & main menu', pause.join('|'));
  await io.menu(await G.menuButton(page, 'Resume'));
  await until(page, () => !document.querySelector('#modal-root .modal'), null, { what: 'resumed' });
  await io.press('[data-catalog]');
  await page.waitForSelector('[data-catalog-panel]:not([hidden]) [data-item]', { timeout: 5000 });
  const rows = await S(page, () => [...document.querySelectorAll('[data-catalog-panel] [data-item]')].map((b) => `${b.dataset.item}:${b.dataset.state}`).join(' '));
  T.ok('the catalog opens on Construction: floor, fence, gate can be bought; base, wall, pillar to discover (new profile)', rows === 'floor:available fence:available gate:available base:locked wall:locked pillar:locked', rows);
  await T.shot(page, 'release-city-catalog');
  await io.press('[data-catalog-panel] .cat-head [data-close]');
  // keys: none may change the resources
  const keys = [];
  for (let c = 65; c <= 90; c++) keys.push(`Key${String.fromCharCode(c)}`);
  for (let d = 0; d <= 9; d++) keys.push(`Digit${d}`);
  keys.push('F1', 'F2', 'F3', 'F4', 'F6', 'F7', 'F8', 'F9', 'F10', 'Backquote', 'Backslash', 'Slash', 'Period', 'Comma', 'Semicolon', 'Quote', 'Insert', 'Delete', 'Home', 'End', 'PageUp', 'PageDown', 'Equal', 'Minus', 'BracketLeft', 'BracketRight', 'Enter', 'Space', 'Tab');
  const changed = [];
  let pressed = 0;
  for (const code of keys) {
    for (const shift of [false, true]) {
      if (code === 'Tab' && shift) continue;
      await page.keyboard.press(shift ? `Shift+${code}` : code);
      pressed++;
      // close what the key opened (a hint, a tool, the pause menu) so the next key reaches the game
      for (let i = 0; i < 3; i++) {
        await settle(page);
        const open = await S(page, () => !!document.querySelector('#modal-root .modal') || !!document.querySelector('[data-tool].active, [data-doze].active') || !document.querySelector('[data-catalog-panel]').hidden);
        if (!open) break;
        await page.keyboard.press('Escape');
      }
      // Space / Tab change the speed: back to paused before reading
      if (!(await S(page, () => document.querySelector('[data-speed="0"]').classList.contains('active')))) await page.click('[data-speed="0"]');
      const h = await hud();
      if (h.scrap !== h0.scrap || h.parts !== h0.parts || h.credits !== h0.credits) changed.push(`${shift ? 'Shift+' : ''}${code}: ${JSON.stringify(h)}`);
    }
  }
  T.ok(`${pressed} key presses (letters, digits, F-keys, symbols, with and without Shift) never change the resources`, changed.length === 0, changed.slice(0, 4).join(' | '));
  const storage = await S(page, () => Object.keys(localStorage));
  const bad = storage.filter((k) => !PRODUCT_KEY.test(k));
  T.ok('only product keys in the storage', bad.length === 0, bad.length ? bad.join(', ') : storage.join(', '));
  T.ok('no request left the machine', requests.length === 0, requests.slice(0, 5).join(' | '));
  T.ok('no page error, console error or warning', errors.length === 0 && warnings.length === 0, [...errors, ...warnings].slice(0, 4).join(' | '));
}, () => page);

await browser.close();
await server.close();
await T.finish();
