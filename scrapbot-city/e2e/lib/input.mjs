// The three ways a player presses things, all SIMULATED (none of this is real hardware):
//   mouse: Playwright's mouse and keyboard (CDP Input.dispatchMouseEvent / dispatchKeyEvent)
//   touch: CDP Input.dispatchTouchEvent in a context with touch (Chromium turns it into pointer, touch and click events)
//   pad:   a fake standard gamepad behind navigator.getGamepads(): buttons and sticks are set in the page and read by
//          the game's own polling once per frame, as a real pad's would be. The stick is steered by a small controller
//          in the page (it reads the game's cursor through the debug hook), so a pad test needs the debug build.
// One API for the three: at(x, y) a press on a screen point (the map), press(sel) a HUD button brought into sight
// the way that input would (wheel, finger swipe, right stick), menu(sel) a button in a dialog or a menu screen (the
// pad moves the focus with the D-pad and presses A), cancel(), rotate(), pan(), double().
import { frames, settle, sleep, stableBox, until } from './page.mjs';

export const INPUT_LABEL = {
  mouse: 'Playwright mouse+keyboard (simulated)',
  touch: 'CDP touch events (simulated)',
  pad: 'simulated Gamepad API',
};

// Two presses meant as two are at least this far apart: the game's guards take the second press of a double press
// (500 ms) for an accident, with a 100 ms margin (src/ui/presses.ts PRESS_GUARD_MS = 600).
export const PACE_MS = 700;

// ---------- the fake pad (runs in the page before the game) ----------
export const PAD_INIT = () => {
  const NAMES = ['a', 'b', 'x', 'y', 'lb', 'rb', 'lt', 'rt', 'back', 'start', 'ls', 'rs', 'up', 'down', 'left', 'right'];
  const p = { id: 'e2e simulated pad (standard mapping)', index: 0, connected: true, mapping: 'standard', timestamp: 0, buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })), axes: [0, 0, 0, 0] };
  navigator.getGamepads = () => [p, null, null, null];
  const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
  const frames = async (n) => {
    for (let i = 0; i < n; i++) await frame();
  };
  const set = (name, on) => {
    p.buttons[NAMES.indexOf(name)] = { pressed: on, touched: on, value: on ? 1 : 0 };
    p.timestamp = performance.now();
  };
  const ses = () => window.scrapbot?.session?.() ?? null;
  // the game's dead zone (src/gamepad.ts): a stick pushed `raw` moves things at ((raw - 0.22) / 0.78)
  const rawFor = (post) => (post <= 0 ? 0 : Math.min(1, 0.22 + 0.78 * post));
  window.__e2ePad = {
    pad: p,
    set,
    frames,
    // one press: held until the game's polling has seen it, released, seen released
    async tap(name, hold = 2) {
      set(name, true);
      await frames(hold + 1);
      set(name, false);
      await frames(2);
    },
    cursor() {
      const s = ses();
      return s ? { x: s.cursor.x, y: s.cursor.y } : null;
    },
    // the left stick, closed loop: the cursor (900 px/s at full tilt, speed = push² after the dead zone) is driven to
    // (x, y) a little slower as it nears, so that it never overshoots even at the game's longest frame (0.1 s)
    async steer(x, y, timeout = 10000) {
      const t0 = performance.now();
      for (;;) {
        const c = this.cursor();
        if (!c) return false;
        const dx = x - c.x;
        const dy = y - c.y;
        const d = Math.hypot(dx, dy);
        if (d < 0.75) {
          p.axes = [0, 0, 0, 0];
          await frames(2);
          const c2 = this.cursor();
          if (Math.hypot(x - c2.x, y - c2.y) < 1.5) return true;
          continue;
        }
        if (performance.now() - t0 > timeout) {
          p.axes = [0, 0, 0, 0];
          await frames(2);
          return false;
        }
        const v = Math.min(900, d * 9);
        const raw = rawFor(Math.sqrt(v / 900));
        p.axes = [(dx / d) * raw, (dy / d) * raw, 0, 0];
        await frame();
      }
    },
    // the right stick over a list that scrolls (the game scrolls it 700 px/s at full tilt, linear after the dead zone)
    // until `el` lies inside it; the cursor must already be over the list
    async scrollList(listSel, elSel, timeout = 10000) {
      const t0 = performance.now();
      for (;;) {
        const list = document.querySelector(listSel);
        const el = document.querySelector(elSel);
        if (!list || !el) return false;
        const l = list.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        // all of it in sight, or its top when it is taller than the list
        const tall = r.height > l.height;
        const done = tall ? Math.abs(r.top - l.top) < 16 : r.top >= l.top - 0.5 && r.bottom <= l.bottom + 0.5;
        if (done || performance.now() - t0 > timeout) {
          p.axes = [0, 0, 0, 0];
          await frames(2);
          return done;
        }
        // (a few px past the edge: the list moves in whole pixels, a slow push would not move it at all)
        const need = tall ? r.top - l.top : r.top < l.top ? r.top - l.top - 8 : r.bottom - l.bottom + 8;
        const v = Math.max(150, Math.min(700, Math.abs(need) * 10));
        p.axes = [0, 0, 0, Math.sign(need) * rawFor(v / 700)];
        await frame();
      }
    },
    // the right stick pans the map: until the camera has moved by (dx, dy) screen px the map's way (the map slides the
    // other way from the push), or `ms` of pushing when no target is given
    async pan(dx, dy, timeout = 10000) {
      const s = ses();
      if (!s) return false;
      const r = s.renderer;
      const goal = { x: r.cam.x - dx / r.pxZoom, y: r.cam.y - dy / r.pxZoom };
      const t0 = performance.now();
      for (;;) {
        const ex = (goal.x - r.cam.x) * r.pxZoom;
        const ey = (goal.y - r.cam.y) * r.pxZoom;
        const d = Math.hypot(ex, ey);
        if (d < 6 || performance.now() - t0 > timeout) {
          p.axes = [0, 0, 0, 0];
          await frames(2);
          return d < 12;
        }
        // 390 px/s at full tilt (PAN_SPEED 260 * 1.5)
        const v = Math.min(390, d * 6);
        const raw = rawFor(v / 390);
        p.axes = [0, 0, (ex / d) * raw, (ey / d) * raw];
        await frame();
      }
    },
  };
};


export class Input {
  constructor(page, kind) {
    if (!INPUT_LABEL[kind]) throw new Error(`unknown input ${kind}`);
    this.page = page;
    this.kind = kind;
    this.label = INPUT_LABEL[kind];
    this.last = 0;
    this.cdp = null;
    this.lastAt = null; // the last screen point pressed
  }

  async attach(page) {
    this.page = page;
    if (this.kind === 'touch') this.cdp = await page.context().newCDPSession(page);
  }

  get mouse() {
    return this.kind === 'mouse';
  }
  get touch() {
    return this.kind === 'touch';
  }
  get pad() {
    return this.kind === 'pad';
  }

  // ---------- timing ----------
  async pace(ms = PACE_MS) {
    const gap = Date.now() - this.last;
    if (gap < ms) await sleep(ms - gap);
  }
  mark() {
    this.last = Date.now();
  }

  // ---------- raw presses (no pacing) ----------
  async touchDown(x, y) {
    await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }] });
  }
  async touchUp() {
    await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  async rawPress(x, y, { hold = 40, steer = true } = {}) {
    this.lastAt = { x, y };
    const page = this.page;
    if (this.mouse) {
      await page.mouse.move(x, y);
      await page.mouse.down();
      if (hold) await sleep(hold);
      await page.mouse.up();
    } else if (this.touch) {
      await this.touchDown(x, y);
      if (hold) await sleep(hold);
      await this.touchUp();
    } else {
      if (steer) await this.steer(x, y);
      await page.evaluate(() => window.__e2ePad.tap('a'));
    }
  }

  // the pad's cursor to a screen point (the left stick); mouse: the pointer moves there; touch: nothing (no hover)
  async hover(x, y) {
    if (this.mouse) {
      await this.page.mouse.move(x, y, { steps: 3 });
      await frames(this.page, 2);
    } else if (this.pad) await this.steer(x, y);
  }
  async steer(x, y) {
    const ok = await this.page.evaluate(([x, y]) => window.__e2ePad.steer(x, y), [x, y]);
    if (!ok) throw new Error(`pad cursor could not be steered to ${Math.round(x)},${Math.round(y)}`);
  }

  // ---------- one deliberate press ----------
  // on a screen point (the map): a click, a tap, or the pad's cursor steered there and A
  async at(x, y, { pace = true } = {}) {
    if (pace) await this.pace();
    await this.rawPress(x, y);
    this.mark();
    await frames(this.page, 2);
  }

  // two presses `gap` ms apart (press to press), the second `d` px away: a double click, a double tap, A A
  async double(x, y, { gap = 90, d = { x: 0, y: 0 } } = {}) {
    await this.pace();
    if (this.pad) {
      await this.steer(x, y);
      if (d.x || d.y) {
        await this.page.evaluate(() => window.__e2ePad.tap('a', 1));
        await this.steer(x + d.x, y + d.y);
        await this.page.evaluate(() => window.__e2ePad.tap('a', 1));
      } else {
        await this.page.evaluate(async (gap) => {
          const P = window.__e2ePad;
          const t0 = performance.now();
          await P.tap('a', 1);
          while (performance.now() - t0 < gap) await P.frames(1);
          await P.tap('a', 1);
        }, gap);
      }
    } else {
      const t0 = Date.now();
      await this.rawPress(x, y, { hold: 30 });
      const left = gap - (Date.now() - t0);
      if (left > 0) await sleep(left);
      await this.rawPress(x + d.x, y + d.y, { hold: 30 });
    }
    this.mark();
    await frames(this.page, 3);
  }

  // ---------- the interface ----------
  // the list an element scrolls in (the catalog's .cat-scroll, the building panel), if it does not fit in it now
  scrollNeed(sel) {
    return this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return { missing: true };
      let list = el.parentElement;
      while (list && !(list.scrollHeight > list.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(list).overflowY))) list = list.parentElement;
      if (!list || list === document.documentElement || list === document.body) return null;
      const l = list.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const tall = r.height > l.height;
      if (tall ? Math.abs(r.top - l.top) < 16 : r.top >= l.top - 0.5 && r.bottom <= l.bottom + 0.5) return null;
      const need = tall ? r.top - l.top : r.top < l.top ? r.top - l.top - 6 : r.bottom - l.bottom + 6;
      if (!list.id && !list.dataset.e2eList) list.dataset.e2eList = String(Math.random()).slice(2, 8);
      const lsel = list.id ? `#${list.id}` : `[data-e2e-list="${list.dataset.e2eList}"]`;
      return { need, lsel, x: l.left + l.width / 2, y: l.top + Math.min(l.height / 2, 80), top: l.top, bottom: l.bottom, height: l.height };
    }, sel);
  }

  // a card of a bar that scrolls sideways (the build bar on a phone), if it is not all in sight: how far, and where to
  // swipe (what stays put at the bar's end, its sticky Tools column, covers that end)
  scrollNeedX(sel) {
    return this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return { missing: true };
      let bar = el.parentElement;
      while (bar && !(bar.scrollWidth > bar.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(bar).overflowX))) bar = bar.parentElement;
      if (!bar || bar === document.documentElement || bar === document.body) return null;
      const b = bar.getBoundingClientRect();
      let right = b.right - 2;
      for (const c of bar.querySelectorAll('*')) if (!c.contains(el) && getComputedStyle(c).position === 'sticky') right = Math.min(right, c.getBoundingClientRect().left);
      const left = b.left + 2;
      const r = el.getBoundingClientRect();
      if (r.left >= left - 0.5 && r.right <= right + 0.5) return null;
      if (!bar.dataset.e2eList) bar.dataset.e2eList = String(Math.random()).slice(2, 8);
      return { need: r.left < left ? r.left - left - 6 : r.right - right + 6, lsel: `[data-e2e-list="${bar.dataset.e2eList}"]`, y: b.top + b.height / 2, from: left + 12, to: right - 12 };
    }, sel);
  }

  // bring an element of a scrolling list into sight with this input: the mouse wheel, a finger swipe, the right stick
  // (a bar that scrolls sideways: the wheel or a finger)
  async reveal(sel) {
    for (let k = 0; k < 40; k++) {
      const v = await this.scrollNeed(sel);
      if (v?.missing) throw new Error(`no ${sel} on the page`);
      if (!v) {
        const h = await this.scrollNeedX(sel);
        if (!h || h.missing) return;
        if (this.mouse) {
          await this.page.mouse.move((h.from + h.to) / 2, h.y);
          await this.page.mouse.wheel(Math.sign(h.need) * Math.min(240, Math.ceil(Math.abs(h.need)) + 2), 0);
        } else if (this.touch) {
          // (a finger's first ~15 px do not scroll: the swipe is longer by that much)
          const d = Math.min(h.to - h.from, Math.ceil(Math.abs(h.need)) + 24);
          await this.swipe(h.need > 0 ? h.to : h.from, h.y, h.need > 0 ? -d : d, 0, 12);
        } else throw new Error(`the pad cannot scroll ${sel} sideways into sight`);
        await until(
          this.page,
          (lsel) => {
            const l = document.querySelector(lsel);
            if (!l) return true;
            const w = (window.__e2eScrollX ??= {});
            const same = w[lsel] === l.scrollLeft;
            w[lsel] = l.scrollLeft;
            w.n = same ? (w.n ?? 0) + 1 : 0;
            return w.n >= 4;
          },
          h.lsel,
          { what: 'the bar to stop scrolling' },
        );
        continue;
      }
      if (this.mouse) {
        await this.page.mouse.move(v.x, v.y);
        await this.page.mouse.wheel(0, Math.sign(v.need) * Math.min(160, Math.ceil(Math.abs(v.need)) + 2));
      } else if (this.touch) {
        // a finger's first ~15 px do not scroll (the touch slop): the swipe is longer by that much
        const d = Math.min(v.height - 30, Math.ceil(Math.abs(v.need)) + 24);
        const y0 = v.need > 0 ? v.bottom - 10 : v.top + 10;
        await this.swipe(v.x, y0, 0, v.need > 0 ? -d : d, 12);
      } else {
        await this.steer(v.x, v.y);
        await this.page.evaluate(([l, e]) => window.__e2ePad.scrollList(l, e), [v.lsel, sel]);
      }
      // until the list stands still (a wheel or a fling may scroll smoothly over several frames)
      await until(
        this.page,
        (lsel) => {
          const l = document.querySelector(lsel);
          if (!l) return true;
          const w = (window.__e2eScroll ??= {});
          const same = w[lsel] === l.scrollTop;
          w[lsel] = l.scrollTop;
          w.n = same ? (w.n ?? 0) + 1 : 0;
          return w.n >= 4;
        },
        v.lsel,
        { what: 'the list to stop scrolling' },
      );
    }
    throw new Error(`could not bring ${sel} into sight`);
  }

  // a point inside the element that a press there reaches (the element itself or a child of it under the point)
  // (an achievement toast sliding over it for a moment is waited out)
  async pointOf(sel) {
    const box = await stableBox(this.page, sel);
    const find = ([sel, box]) => {
      const el = document.querySelector(sel);
      if (!el) return { covered: 'missing' };
      // (an element that keeps moving: the part it always covers)
      const r = box.moving ? { left: box.x, top: box.y, width: box.width, height: box.height } : el.getBoundingClientRect();
      const tries = [
        [0.5, 0.5],
        [0.5, 0.3],
        [0.3, 0.5],
        [0.7, 0.5],
        [0.5, 0.7],
        [0.25, 0.25],
        [0.75, 0.75],
      ];
      for (const [fx, fy] of tries) {
        const x = r.left + r.width * fx;
        const y = r.top + Math.min(r.height * fy, 40);
        const at = document.elementFromPoint(x, y);
        if (at && (at === el || el.contains(at))) return { x: Math.round(x), y: Math.round(y) };
      }
      return { covered: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.outerHTML.slice(0, 120) ?? 'nothing' };
    };
    // (polled for up to ~6 s: a toast leaves after 2.9 s)
    let p = null;
    const t0 = Date.now();
    do {
      p = await this.page.evaluate(find, [sel, box]);
      if (!p.covered) break;
      await frames(this.page, 3);
    } while (Date.now() - t0 < 6000);
    if (p.covered) throw new Error(`${sel} is covered by ${p.covered}`);
    return p;
  }

  // a button of the interface pressed with this input (brought into sight first)
  async press(sel, { pace = true } = {}) {
    // (mouse and touch: paced before the element is measured, so nothing moves between measuring and pressing)
    if (pace && !this.pad) await this.pace();
    await settle(this.page);
    await this.page.waitForSelector(sel, { state: 'attached', timeout: 15000 });
    await this.reveal(sel);
    const p = await this.pointOf(sel);
    if (this.pad) {
      await this.steer(p.x, p.y);
      if (pace) await this.pace();
      // the cursor is over it (nothing slid in between)
      const ok = await this.page.evaluate(([sel, x, y]) => {
        const el = document.querySelector(sel);
        const at = document.elementFromPoint(x, y);
        return !!el && !!at && (at === el || el.contains(at));
      }, [sel, p.x, p.y]);
      if (!ok) throw new Error(`pad cursor not over ${sel}`);
    }
    await this.rawPress(p.x, p.y, { steer: false });
    this.mark();
    await frames(this.page, 2);
  }

  // a button in a dialog or on a menu screen: mouse and touch press it; the pad moves the focus there with the D-pad
  // (the game's menu navigation) and presses A once the dialog is old enough to take a press (src/ui/modal.ts)
  async menu(sel) {
    await this.page.waitForSelector(sel, { state: 'visible', timeout: 15000 });
    if (!this.pad) return this.press(sel);
    await this.pace();
    let stuck = false;
    for (let k = 0; k < 30; k++) {
      const at = await this.page.evaluate(
        ([sel, stuck]) => {
          const target = document.querySelector(sel);
          const a = document.activeElement;
          if (a && (a === target || target.contains(a))) return { here: true };
          const t = target.getBoundingClientRect();
          const none = !a || a === document.body || a.classList.contains('modal');
          if (none) return { here: false, dir: 'down', from: '' };
          const r = a.getBoundingClientRect();
          const dx = t.left + t.width / 2 - (r.left + r.width / 2);
          const dy = t.top + t.height / 2 - (r.top + r.height / 2);
          const vertical = Math.abs(dy) > 8 && !(stuck && Math.abs(dx) > 8);
          return { here: false, dir: vertical ? (dy > 0 ? 'down' : 'up') : dx > 0 ? 'right' : 'left', from: a.outerHTML.slice(0, 100) };
        },
        [sel, stuck],
      );
      if (at.here) break;
      if (k === 29) throw new Error(`the pad could not move the focus to ${sel}`);
      await this.page.evaluate((d) => window.__e2ePad.tap(d), at.dir);
      stuck = (await this.page.evaluate(() => document.activeElement?.outerHTML.slice(0, 100) ?? '')) === at.from;
    }
    // a dialog's buttons take no A in their first 600 ms
    await until(this.page, () => !window.__e2e.modal || performance.now() - window.__e2e.modalAt > 650, null, { what: 'the dialog to take a press' });
    await this.page.evaluate(() => window.__e2ePad.tap('a'));
    this.mark();
    await frames(this.page, 2);
  }

  async key(key) {
    await this.page.keyboard.press(key);
    await frames(this.page, 2);
  }

  // ---------- what each input does for the common gestures ----------
  // put the tool away / end a move / close a panel: Esc, the panel's Done or ×, B
  async cancel() {
    await this.pace();
    if (this.mouse) await this.page.keyboard.press('Escape');
    else if (this.pad) await this.page.evaluate(() => window.__e2ePad.tap('b'));
    else {
      const what = await this.page.evaluate(() => {
        const vis = (sel) => {
          const e = document.querySelector(sel);
          return !!e && e.getClientRects().length > 0 && !e.closest('[hidden]');
        };
        if (vis('[data-inspector] [data-move-done]')) return '[data-inspector] [data-move-done]';
        if (vis('[data-catalog-panel] [data-done]')) return '[data-catalog-panel] [data-done]';
        if (vis('[data-inspector] [data-close]')) return '[data-inspector] [data-close]';
        if (vis('[data-catalog-panel] .cat-head [data-close]')) return '[data-catalog-panel] .cat-head [data-close]';
        // (on a phone: the × of the strip of the building in hand)
        if (vis('[data-build-info] [data-build-close]')) return '[data-build-info] [data-build-close]';
        if (document.querySelector('[data-doze].active, [data-doze][aria-pressed="true"]')) return '[data-doze]';
        return null;
      });
      if (what) await this.press(what, { pace: false });
    }
    this.mark();
    await frames(this.page, 2);
  }

  // turn the piece in hand: R, the catalog's Rotate button, Y; a selected piece (where = its panel): R, or the panel's
  // Rotate button (the pad's Y with nothing in hand asks USA-9 for a hint, src/session.ts padFrame)
  async rotate(where = '[data-catalog-panel]') {
    if (this.mouse) await this.key('KeyR');
    else if (this.pad && where === '[data-catalog-panel]') {
      await this.page.evaluate(() => window.__e2ePad.tap('y'));
      await frames(this.page, 2);
    } else await this.press(`${where} [data-rotate]`, { pace: false });
  }

  // a pan of the map by (dx, dy) screen px from the point (x, y) on the map: the right mouse button dragged (the left
  // one never pans), one finger swiped, the right stick pushed
  async pan(dx, dy, at, { button = 'right' } = {}) {
    await this.pace();
    if (this.mouse) {
      await this.page.mouse.move(at.x, at.y);
      await this.page.mouse.down({ button });
      for (let k = 1; k <= 12; k++) await this.page.mouse.move(at.x + (dx * k) / 12, at.y + (dy * k) / 12);
      await this.page.mouse.up({ button });
    } else if (this.touch) await this.swipe(at.x, at.y, dx, dy, 12);
    else {
      await this.steer(at.x, at.y);
      const ok = await this.page.evaluate(([dx, dy]) => window.__e2ePad.pan(dx, dy), [dx, dy]);
      if (!ok) throw new Error('the right stick did not pan the map');
    }
    this.mark();
    await frames(this.page, 3);
  }

  async swipe(x, y, dx, dy, steps = 10) {
    await this.touchDown(x, y);
    for (let k = 1; k <= steps; k++) {
      await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (dx * k) / steps, y: y + (dy * k) / steps, id: 1, radiusX: 4, radiusY: 4, force: 1 }] });
      await sleep(16);
    }
    await this.touchUp();
  }

  // the pause menu: the menu button, or Start
  async pauseMenu() {
    if (this.pad) {
      await this.pace();
      await this.page.evaluate(() => window.__e2ePad.tap('start'));
      this.mark();
    } else await this.press('[data-menu]');
    await this.page.waitForSelector('#modal-root .modal', { state: 'visible', timeout: 10000 });
  }

  // the clock: the speed buttons, or Back (pause / go on) and the left stick's press (1x -> 2x -> 3x)
  async speed(v) {
    const now = () => this.page.evaluate(() => window.scrapbot.session().speed);
    if ((await now()) === v) return;
    if (!this.pad) await this.press(`[data-speed="${v}"]`);
    else {
      if (v === 0 || (await now()) === 0) await this.page.evaluate(() => window.__e2ePad.tap('back'));
      for (let k = 0; k < 4 && v > 0 && (await now()) !== v; k++) await this.page.evaluate(() => window.__e2ePad.tap('ls'));
    }
    await until(this.page, (v) => window.scrapbot.session().speed === v, v, { what: `speed ${v}` });
  }

  // pad only: one D-pad step / button
  async padButton(name) {
    await this.page.evaluate((n) => window.__e2ePad.tap(n), name);
    await frames(this.page, 1);
  }
}

