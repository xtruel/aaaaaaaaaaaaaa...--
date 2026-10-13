// The five campaign cities from the RELEASE build (no hook), through the menus only, Playwright mouse, 1920x1080:
// a campaign profile with every city unlocked (written before the game loads), each city opened from the region map,
// its intro answered, zoomed out with "-" and framed with right-button drags, then played at speed 3 with the speed
// buttons and paused at midday (12:00-15:00 on the clock) and in the night (00:30-02:00): a picture of each.
// Checks: each city opens, its clock reaches both times, no page error or console error. The pictures are for a
// person to look at (themes, lights, nothing broken); this test does not judge them.
import { startTest } from '../lib/report.mjs';
import { frames, launch, openGame, S, until } from '../lib/page.mjs';
import { serve } from '../lib/server.mjs';
import { seedStorage } from '../lib/profile.mjs';

const T = await startTest({ name: 'cities', input: 'mouse', size: '1920x1080', cities: ['home', 'rustbay', 'neon', 'greenvale', 'company'] });
const server = await serve(T.cfg.release);
const browser = await launch();
let page = null;
const prog = (stars) => ({ stars, spireDone: true, endingKind: 'green' });
const UNLOCK = { version: 1, bank: { credits: 0, parts: 0 }, cities: { home: prog([true, true, true]), rustbay: prog([true, true, true]), neon: prog([true, true, true]), greenvale: prog([true, true, true]) }, finaleSeen: false };
const clockMin = (txt) => {
  const m = /^(\d\d):(\d\d)$/.exec(txt ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : -1;
};

await T.run(async () => {
  for (const city of T.cfg.cities) {
    const g = await openGame(browser, server, { input: 'mouse', size: T.cfg.size, hook: false, storage: seedStorage({ profile: 'new', keys: { campaign: JSON.stringify(UNLOCK) } }) });
    page = g.page;
    const { io, errors } = g;
    const hook = await S(page, () => typeof window.scrapbot);
    await io.menu('[data-act="new"]');
    await io.menu('#modal-root [data-mode="campaign"]');
    await page.waitForSelector(`#region:not([hidden]) [data-city="${city}"]`, { timeout: 20000 });
    const locked = await S(page, (c) => document.querySelector(`[data-city="${c}"]`).classList.contains('locked'), city);
    await io.menu(`[data-city="${city}"]`);
    await until(page, (c) => document.querySelector(`[data-city="${c}"]`)?.classList.contains('selected'), city, { what: `${city} selected` });
    await io.menu('[data-play]');
    await page.waitForSelector('#game:not([hidden]) [data-time]', { state: 'visible', timeout: 30000 });
    // the intro (and whatever comes with it), answered with the main button
    for (let k = 0; k < 4; k++) {
      const open = await until(page, () => !!document.querySelector('#modal-root .modal .btn-primary'), null, { soft: true, timeout: 2500 });
      if (!open) break;
      await io.menu('#modal-root .modal .btn-primary');
      await until(page, () => !document.querySelector('#modal-root .modal'), null, { soft: true, timeout: 4000 });
    }
    await io.press('[data-speed="0"]');
    const opened = await S(page, () => document.querySelector('[data-time]').textContent);
    // zoom 1 and the same framing in every city: right-drag into the top-left corner, then back by a fixed amount
    await page.mouse.move(960, 540);
    await page.keyboard.press('Minus');
    await page.keyboard.press('Minus');
    await frames(page, 3);
    const drag = async (x0, y0, x1, y1) => {
      await page.mouse.move(x0, y0);
      await page.mouse.down({ button: 'right' });
      await page.mouse.move(x1, y1, { steps: 25 });
      await page.mouse.up({ button: 'right' });
      await frames(page, 2);
    };
    await drag(450, 330, 1750, 880);
    await drag(450, 330, 1750, 880);
    await drag(1500, 800, 1500 - 784, 800 - 388);
    await page.mouse.move(960, 3);
    const seen = {};
    for (const [label, from, to] of [
      ['day', 12 * 60, 15 * 60],
      ['night', 30, 120],
    ]) {
      await io.press('[data-speed="3"]');
      await page.mouse.move(960, 3);
      let reached = null;
      const t0 = Date.now();
      while (!reached && Date.now() - t0 < 120000) {
        reached = await until(page, ([from, to]) => {
          const m = /^(\d\d):(\d\d)$/.exec(document.querySelector('[data-time]')?.textContent ?? '');
          const v = m ? Number(m[1]) * 60 + Number(m[2]) : -1;
          return (v >= from && v < to) || !!document.querySelector('#modal-root .modal') ? (document.querySelector('#modal-root .modal') ? 'dialog' : 'time') : null;
        }, [from, to], { soft: true, timeout: 60000 });
        if (reached === 'dialog') {
          // a story event on the way: its first choice
          await io.menu('#modal-root .modal-actions .btn:not(:disabled)');
          await until(page, () => !document.querySelector('#modal-root .modal'), null, { soft: true, timeout: 4000 });
          if (!(await S(page, () => document.querySelector('[data-speed="3"]').classList.contains('active')))) await io.press('[data-speed="3"]');
          reached = null;
        }
      }
      await page.click('[data-speed="0"]');
      await page.mouse.move(960, 3);
      const at = await S(page, () => `${document.querySelector('[data-day]').textContent} ${document.querySelector('[data-time]').textContent}`);
      // news lines leave after 7.2 s, paused or not: the picture without them
      await until(page, () => !document.querySelector('[data-feed]')?.children.length, null, { soft: true, timeout: 12000 });
      const m = clockMin(at.split(' ').pop());
      seen[label] = at;
      T.ok(`${city}: the clock reached the ${label} (${at})`, reached === 'time' && m >= from && m < to + 30, at);
      await T.shot(page, `${city}-${label}`);
    }
    T.ok(`${city}: opened from the region map of the release build (no hook; ${locked ? 'LOCKED' : 'unlocked'}), from ${opened}`, hook === 'undefined' && !locked);
    T.ok(`${city}: no page errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
    await g.ctx.close();
  }
}, () => page);

await browser.close();
await server.close();
await T.finish();
