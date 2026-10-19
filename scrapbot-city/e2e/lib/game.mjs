// The game seen through the debug build's hook (window.scrapbot): READ the city, find screen points (where a tile, a
// piece, a building is drawn), and STAGE a scene (money, a finished building placed by the game's own rules, story
// events and storms put off). The hook never presses anything: every press goes through input.mjs.
import { frames, S, settle, stableBox, until } from './page.mjs';

export const MAP_W = 56;
export const MAP_H = 36;

// ---------- reading ----------
export const read = (page) =>
  S(page, () => {
    const ses = window.scrapbot.session();
    if (!ses) return null;
    const s = ses.s;
    const { piecesPlaced, modulesInstalled, ...otherStats } = s.stats;
    return {
      credits: s.res.credits,
      parts: s.res.parts,
      scrap: s.res.scrap,
      placed: piecesPlaced ?? 0,
      mods: modulesInstalled ?? 0,
      otherStats: JSON.stringify(otherStats),
      derived: JSON.stringify(s.derived),
      world: JSON.stringify({ happiness: s.happiness, pollution: s.pollution, alignment: s.alignment, pop: s.pop, stars: s.stars, time: s.time }),
      storage: s.derived.storage,
      piece: ses.piece ? { ...ses.piece } : null,
      moving: ses.moving,
      selectedPiece: ses.selectedPiece,
      selectedId: ses.selectedId,
      bulldoze: ses.bulldoze,
      build: ses.build,
      catalog: ses.catalog,
      speed: ses.speed,
      cam: `${ses.renderer.cam.x.toFixed(2)},${ses.renderer.cam.y.toFixed(2)},${ses.renderer.zoom}`,
      modal: !!document.querySelector('#modal-root .modal'),
      smogOpen: !document.querySelector('[data-smog-panel]')?.hidden,
      padMode: document.body.classList.contains('pad-mode'),
      time: s.time,
    };
  });

export const res = (page) => S(page, () => ({ ...window.scrapbot.session().s.res }));

export const tileAt = (page, t) =>
  S(
    page,
    ([x, y]) => {
      const s = window.scrapbot.session().s;
      const i = y * 56 + x;
      return { solid: s.solid[i], rot: s.rot[i], floor: s.floor[i], variety: s.variety[i], tile: s.tiles[i], occ: s.occ[i] };
    },
    [t.x, t.y],
  );

export const frameName = (page, t) =>
  S(
    page,
    ([x, y]) => {
      const ses = window.scrapbot.session();
      return ses.renderer.pieceFrameName(ses.s, x, y, y * 56 + x);
    },
    [t.x, t.y],
  );

export const feedHas = (page, text) => S(page, (text) => [...document.querySelectorAll('[data-feed] .msg')].some((m) => (m.dataset.text ?? m.textContent).includes(text)), text);
export const feed = (page) => S(page, () => [...document.querySelectorAll('[data-feed] .msg')].map((m) => m.dataset.text ?? m.textContent));
export const clearFeed = (page) => S(page, () => document.querySelectorAll('[data-feed] .msg').forEach((m) => m.remove()));

// the piece or building panel as a player reads it
export const panelInfo = async (page) => {
  await settle(page);
  return S(page, () => {
    const p = document.querySelector('[data-inspector]');
    const rm = p.querySelector('[data-remove-piece]');
    const room = p.querySelector('[data-scrap-room]');
    return {
      open: !p.hidden,
      tag: p.querySelector('.tag')?.textContent.trim() ?? null,
      name: p.querySelector('h3')?.textContent.trim() ?? null,
      rotate: !!p.querySelector('[data-rotate]'),
      move: !!p.querySelector('[data-move-piece]'),
      done: !!p.querySelector('[data-move-done]'),
      remove: rm?.textContent.trim() ?? null,
      help: p.querySelector('.cat-help')?.textContent.trim() ?? null,
      room: room && !room.hidden ? room.textContent.trim() : '',
    };
  });
};

// is the element shown, once the interface has caught up with the city?
export async function shown(page, sel) {
  await settle(page);
  return S(page, (sel) => {
    const e = document.querySelector(sel);
    return !!e && !e.hidden && !e.closest('[hidden]') && e.getClientRects().length > 0;
  }, sel);
}

// a module card in the building panel
export const slotInfo = async (page, kind) => {
  await settle(page);
  return S(
    page,
    (kind) => {
      const c = document.querySelector(`[data-inspector] [data-mod="${kind}"]`);
      if (!c) return null;
      const chip = c.querySelector('[data-mod-state]');
      const vis = (sel) => {
        const e = c.querySelector(sel);
        return e && !e.hidden ? e.textContent.trim() : null;
      };
      const inst = c.querySelector('[data-install]');
      return {
        state: chip?.dataset.state ?? null,
        label: chip?.textContent.trim() ?? null,
        icon: !!chip?.querySelector('img')?.getAttribute('src'),
        reason: vis('.cat-reason'),
        progress: vis('[data-mod-progress]'),
        install: inst ? !inst.disabled : null,
        installText: inst?.textContent.trim() ?? null,
        remove: c.querySelector('[data-remove]')?.textContent.trim() ?? null,
        confirm: c.querySelector('[data-remove-confirm]')?.textContent.trim() ?? null,
        price: c.querySelector('.mod-price')?.textContent.trim() ?? null,
      };
    },
    kind,
  );
};

// a catalog row as a player reads it
export const rowInfo = async (page, kind) => {
  await settle(page);
  return S(
    page,
    (kind) => {
      const b = document.querySelector(`[data-catalog-panel] [data-item="${kind}"]`);
      if (!b) return null;
      const c = (cls) => Number(b.querySelector(`.cost-${cls}`)?.textContent.trim() || 0);
      const vis = (sel) => {
        const e = b.querySelector(sel);
        return e && !e.hidden && e.getClientRects().length ? e.textContent.trim() : null;
      };
      const r = b.getBoundingClientRect();
      const l = document.querySelector('[data-catalog-panel] .cat-scroll').getBoundingClientRect();
      const img = b.querySelector('.cat-state img');
      return {
        name: b.querySelector('.cat-name')?.textContent.trim(),
        cost: { credits: c('credits'), parts: c('parts'), scrap: c('scrap') },
        state: b.dataset.state,
        label: vis('.cat-state-label'),
        icon: !!img && (img.getAttribute('src') ?? '').length > 30 && img.getBoundingClientRect().width > 0,
        goal: vis('.cat-goal'),
        progress: vis('[data-cat-progress]'),
        reason: vis('.cat-reason'),
        disabled: b.getAttribute('aria-disabled'),
        inSight: r.top >= l.top - 1 && r.bottom <= l.bottom + 1,
        pic: !!b.querySelector('.cat-pic img')?.getAttribute('src'),
      };
    },
    kind,
  );
};

// ---------- screen geometry ----------
export const tileScreen = (page, t) => S(page, ([x, y]) => window.scrapbot.session().renderer.tileToScreen(x, y), [t.x, t.y]);

// the part of the screen where the map shows (left of an open side panel, between the top bar and the toolbar)
export const freeRect = (page) =>
  S(page, () => {
    const r = window.scrapbot.session().renderer;
    let right = innerWidth - 16;
    for (const sel of ['[data-inspector]', '[data-catalog-panel]', '[data-smog-panel]']) {
      const el = document.querySelector(sel);
      if (el && !el.hidden) {
        const b = el.getBoundingClientRect();
        if (b.width && b.left > innerWidth * 0.4) right = Math.min(right, b.left - 24);
      }
    }
    const cx = right / 2;
    let top = 0;
    while (top < innerHeight && document.elementFromPoint(cx, top) !== r.canvas) top += 4;
    let bottom = innerHeight - 1;
    while (bottom > 0 && document.elementFromPoint(cx, bottom) !== r.canvas) bottom -= 4;
    return { left: 40, right, top: top + 50, bottom: bottom - 40 };
  });

// the middle of the free part of the screen
export async function home(page) {
  const f = await freeRect(page);
  return { x: Math.round((f.left + f.right) / 2), y: Math.round((f.top + f.bottom) / 2) };
}

// is the map itself under this point and the points around it (no HUD over it)?
export const clearAt = (page, p, spread = 14) =>
  S(
    page,
    ([x, y, d]) => {
      const c = window.scrapbot.session().renderer.canvas;
      for (const [dx, dy] of [[0, 0], [-d, -d / 2], [d, -d / 2], [-d, d / 2], [d, d / 2], [0, -2 * d]]) if (document.elementFromPoint(x + dx, y + dy) !== c) return false;
      return true;
    },
    [p.x, p.y, spread],
  );

// a point on a placed piece's own pixels (the renderer's alpha mask), with its neighbours 2 px around on it too;
// fromBottom scans up from the foot (an animated piece whose top changes: the fountain's jet)
export const piecePoint = (page, t, fromBottom = true) =>
  S(
    page,
    ([x, y, fromBottom]) => {
      const ses = window.scrapbot.session();
      const r = ses.renderer;
      const i = y * 56 + x;
      const box = r.pieceScreenBox(i);
      if (!box) return null;
      const hit = (px, py) => r.pickPiece(px, py) === i && r.pickBuilding(px, py) === -1 && document.elementFromPoint(px, py) === r.canvas;
      const rows = [];
      for (let sy = Math.round(box.top); sy < box.bottom; sy += 1) rows.push(sy);
      if (fromBottom) rows.reverse();
      for (const sy of rows)
        for (let sx = Math.round(box.left); sx < box.right; sx += 1) {
          let all = true;
          for (let dy = -2; dy <= 2 && all; dy++) for (let dx = -2; dx <= 2 && all; dx++) all = hit(sx + dx, sy + dy);
          if (all) return { x: sx, y: sy };
        }
      return null;
    },
    [t.x, t.y, fromBottom],
  );

// a point on a building's visible pixels (what a press there selects), clear of the HUD, 3 px of margin all round
export const buildingPoint = (page, id) =>
  S(
    page,
    (id) => {
      const ses = window.scrapbot.session();
      const r = ses.renderer;
      const b = ses.s.buildings.find((o) => o.id === id);
      if (!b) return null;
      const box = r.buildingScreenBox(b);
      const hit = (x, y) => r.pickBuilding(x, y) === id && document.elementFromPoint(x, y) === r.canvas;
      for (let y = Math.round(box.top + (box.bottom - box.top) * 0.35); y < box.bottom; y += 3)
        for (let x = Math.round(box.left + (box.right - box.left) * 0.3); x < box.left + (box.right - box.left) * 0.7; x += 3) {
          let all = true;
          for (let dy = -3; dy <= 3 && all; dy++) for (let dx = -3; dx <= 3 && all; dx++) all = hit(x + dx, y + dy);
          if (all) return { x, y };
        }
      return null;
    },
    id,
  );

// ---------- staging (the hook changes the city: always said so in the test's ledger) ----------
export const stage = (page, fn, arg) => S(page, fn, arg);

// story events and storms put off for the length of a test that is not about them
export const noEvents = (page) =>
  S(page, () => {
    const s = window.scrapbot.session().s;
    s.nextEventAt = 1e9;
    s.nextStormAt = 1e9;
  });

// the camera framed on a tile (setup only: the tests' own camera moves are real pans)
export const frameOn = (page, t, zoom = null, shiftX = 0) =>
  S(
    page,
    ([x, y, z, sx]) => {
      const r = window.scrapbot.session().renderer;
      if (z) r.setZoom(z);
      r.centerOn((x + 0.5) * 16, (y + 0.5) * 16);
      r.cam.x += sx / r.pxZoom;
      r.clampCam();
    },
    [t.x, t.y, zoom, shiftX],
  );

// finished buildings put down by the game's own rule (placeBuilding pays as a player would; built = 1 skips the wait),
// nearest the HQ outside `avoid` (a rectangle of tiles kept free); the money spent is put back by the caller's staging
export const placeFinished = (page, types, avoid = null) =>
  S(
    page,
    ([types, avoid]) => {
      const ses = window.scrapbot.session();
      const s = ses.s;
      const A = window.scrapbot.actions;
      const hq = s.buildings.find((b) => b.type === 'hq');
      const pop0 = s.pop;
      const res0 = { ...s.res };
      s.pop = 999; // the population minimum some buildings have is lifted while placing them
      s.res.credits = 1e6; // and their price is put back afterwards: staging, not a purchase
      s.res.parts = 1e5;
      const ids = {};
      for (const type of types) {
        let placed = null;
        for (let r = 3; r < 40 && !placed; r++)
          for (let dy = -r; dy <= r && !placed; dy++)
            for (let dx = -r; dx <= r && !placed; dx++) {
              if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
              const x = hq.x + dx;
              const y = hq.y + dy;
              if (avoid && x >= avoid.x0 - 4 && x <= avoid.x1 + 2 && y >= avoid.y0 - 4 && y <= avoid.y1 + 2) continue;
              if (!A.placeCheck(s, type, x, y).ok) continue;
              placed = A.placeBuilding(s, type, x, y);
            }
        if (!placed) {
          s.pop = pop0;
          Object.assign(s.res, res0);
          return { error: `no room for ${type}` };
        }
        placed.built = 1;
        placed.status = 'ok';
        (ids[type] ??= []).push(placed.id);
      }
      s.pop = pop0;
      s.res.credits = res0.credits;
      s.res.parts = res0.parts;
      s.res.scrap = res0.scrap;
      return ids;
    },
    [types, avoid],
  );

// a w x h block of free ground with a free ring round it, nearest the HQ
export const freeBlock = (page, w, h, ring = 1) =>
  S(
    page,
    ([w, h, ring]) => {
      const s = window.scrapbot.session().s;
      const hq = s.buildings.find((b) => b.type === 'hq');
      const free = (x, y) => x >= 0 && y >= 0 && x < 56 && y < 36 && (s.tiles[y * 56 + x] === 0 || s.tiles[y * 56 + x] === 4) && s.occ[y * 56 + x] === -1 && !s.solid[y * 56 + x] && !s.floor[y * 56 + x];
      let best = Infinity;
      let area = null;
      for (let y0 = ring; y0 + h + ring <= 36; y0++)
        for (let x0 = ring; x0 + w + ring <= 56; x0++) {
          const d = Math.hypot(x0 + w / 2 - hq.x, y0 + h / 2 - hq.y);
          if (d >= best) continue;
          let good = true;
          for (let y = y0 - ring; y < y0 + h + ring && good; y++) for (let x = x0 - ring; x < x0 + w + ring && good; x++) good = free(x, y);
          if (good) {
            best = d;
            area = { x0, y0, x1: x0 + w - 1, y1: y0 + h - 1 };
          }
        }
      return area;
    },
    [w, h, ring],
  );

// ---------- getting into a city with the input ----------

// every dialog that is up answered with its main button (an intro, a welcome), with the input
export async function answerDialogs(page, io, { max = 4 } = {}) {
  const seen = [];
  for (let k = 0; k < max; k++) {
    const title = await S(page, () => {
      const m = document.querySelector('#modal-root .modal');
      if (!m || !m.querySelector('.modal-actions .btn-primary:not(:disabled)')) return null;
      window.__e2eAnswered = m;
      return m.querySelector('h2')?.textContent ?? '';
    });
    if (title === null) break;
    seen.push(title);
    await io.menu('#modal-root .modal .modal-actions .btn-primary:not(:disabled)');
    await until(page, () => document.querySelector('#modal-root .modal') !== window.__e2eAnswered, null, { timeout: 8000, what: `the dialog "${title}" to close` });
  }
  return seen;
}

// the main menu -> New game -> Free play -> seed -> Start, with the input (the seed itself is typed with the keyboard:
// setup); the city's intro answered. Returns the dialog titles seen.
export async function startFreePlay(page, io, { seed = 2026, name = null, replace = true } = {}) {
  await io.menu('[data-act="new"]');
  await io.menu('#modal-root [data-mode="free"]');
  await page.waitForSelector('#ng-seed', { state: 'visible' });
  if (name !== null) await page.fill('#ng-name', name);
  await page.fill('#ng-seed', String(seed));
  await S(page, () => (window.__e2eFreeDialog = document.querySelector('#modal-root .modal')));
  await io.menu('#modal-root .modal-actions .btn-primary');
  // free play has one autosave: "Replace your city?" when there is one
  const next = await until(page, () => (window.scrapbot?.session?.() ? 'city' : document.querySelector('#modal-root .modal') && document.querySelector('#modal-root .modal') !== window.__e2eFreeDialog ? 'ask' : null), null, { timeout: 20000, what: 'the city or the replace question' });
  if (next === 'ask') {
    if (!replace) return null;
    await io.menu('#modal-root .modal-actions .btn-primary');
  }
  await until(page, () => !!window.scrapbot?.session?.(), null, { timeout: 20000, what: 'the free play city' });
  return cityStarted(page, io);
}

// after a city opened: its first dialog (the intro) answered with the input, the HUD up
export async function cityStarted(page, io) {
  await page.waitForSelector('#game:not([hidden]) .hud [data-toolbar]', { state: 'visible', timeout: 20000 });
  // the intro comes up with the city or a moment after it
  await until(page, () => !!document.querySelector('#modal-root .modal') || window.scrapbot.session().s.time > 0.3, null, { timeout: 5000, soft: true });
  const seen = await answerDialogs(page, io);
  await frames(page, 2);
  return seen;
}

// a pad wakes up with its first press: B (with nothing in hand it does nothing in a city)
export async function padWake(page, io) {
  if (!io.pad) return;
  await io.padButton('b');
  await until(page, () => document.body.classList.contains('pad-mode'), null, { what: 'pad mode' });
}

// the catalog panel open (the toolbar's Objects & modules button), with the input
export async function openCatalog(page, io) {
  if (await S(page, () => window.scrapbot.session().catalog)) return;
  await io.press('[data-catalog]');
  await until(page, () => window.scrapbot.session().catalog && !document.querySelector('[data-catalog-panel]').hidden, null, { what: 'the catalog panel' });
}

// a tab (and the filter All) of the catalog, with the input
export async function catalogTab(page, io, cat, filter = 'all') {
  await openCatalog(page, io);
  if (!(await S(page, (c) => document.querySelector(`[data-catalog-panel] [data-cat="${c}"]`)?.classList.contains('on'), cat))) {
    await io.press(`[data-catalog-panel] [data-cat="${cat}"]`);
    await until(page, (c) => document.querySelector(`[data-catalog-panel] [data-cat="${c}"]`)?.classList.contains('on'), cat, { what: `the ${cat} tab` });
  }
  if (filter && !(await S(page, (f) => document.querySelector(`[data-catalog-panel] [data-filter="${f}"]`)?.classList.contains('on'), filter))) {
    await io.press(`[data-catalog-panel] [data-filter="${filter}"]`);
    await until(page, (f) => document.querySelector(`[data-catalog-panel] [data-filter="${f}"]`)?.classList.contains('on'), filter, { what: `the ${filter} filter` });
  }
}

// the pause menu -> Save game -> slot n -> Back -> Resume, with the input
export async function saveFromPause(page, io, slot) {
  await io.pauseMenu();
  await io.menu(await menuButton(page, 'Save game'));
  await io.menu(`#modal-root [data-slot="${slot}"]`);
  await until(page, (slot) => !!localStorage.getItem(`scrapbot:save:${slot}`), String(slot), { what: `slot ${slot} written` });
  const raw = await S(page, (slot) => localStorage.getItem(`scrapbot:save:${slot}`), String(slot));
  await io.menu(await menuButton(page, 'Back'));
  await io.menu(await menuButton(page, 'Resume'));
  await until(page, () => !document.querySelector('#modal-root .modal'), null, { what: 'the pause menu closed' });
  return raw;
}

// a dialog's button by its words, as a selector the pad's focus can be checked against
export async function menuButton(page, text) {
  await page.waitForSelector('#modal-root .modal-actions > button', { state: 'visible' });
  const i = await S(page, (text) => [...document.querySelectorAll('#modal-root .modal-actions > button')].findIndex((b) => b.textContent.trim().startsWith(text)), text);
  if (i < 0) throw new Error(`no dialog button "${text}": ${await S(page, () => [...document.querySelectorAll('#modal-root .modal-actions > button')].map((b) => b.textContent.trim()).join(' | '))}`);
  return `#modal-root .modal-actions > button:nth-child(${i + 1})`;
}

// the main menu -> Load game -> slot n (a new session), with the input
export async function loadFromMenu(page, io, slot) {
  await io.menu('[data-act="load"]');
  await io.menu(`#modal-root [data-slot="${slot}"]`);
  await until(page, () => !!window.scrapbot?.session?.() && !document.querySelector('#menu:not([hidden])'), null, { timeout: 20000, what: `slot ${slot} loaded` });
  return cityStarted(page, io);
}

export { stableBox };

// The point of the map nearest (x, y) that nothing covers for a finger's width round it (`margin` px every way: a
// tap that close to a button can go to the button, as Chromium's touch adjustment and iOS's fat-finger hit testing
// do), inside the screen's safe part (`inset` px from its sides): on a phone the HUD leaves the map in pieces (the
// band, the goal, the build bar, the tutorial's bubble), and a finger can press any of them.
const MAP_CLEAR = ([x, y, margin]) => {
  const c = window.scrapbot.session().renderer.canvas;
  const d = margin * 0.7;
  return [[0, 0], [-margin, 0], [margin, 0], [0, -margin], [0, margin], [-d, -d], [d, -d], [-d, d], [d, d], [0, -margin - 14]].every(([dx, dy]) => document.elementFromPoint(x + dx, y + dy) === c);
};
export const clearSpotNear = (page, p, { inset = 70, margin = 24 } = {}) =>
  S(
    page,
    ([x, y, inset, margin, clear]) => {
      const free = (0, eval)(`(${clear})`);
      let best = null;
      for (let py = 40; py < innerHeight - 30; py += 8)
        for (let px = inset; px < innerWidth - inset; px += 8) {
          const d = Math.hypot(px - x, py - y);
          if ((!best || d < best.d) && free([px, py, margin])) best = { x: px, y: py, d };
        }
      return best;
    },
    [p.x, p.y, inset, margin, MAP_CLEAR.toString()],
  );

// A tile brought where a finger (or the mouse, the pad) can press it: real pans of the input drag it to the nearest
// clear spot of the map (clearSpotNear). Returns its screen point.
export async function bringClear(page, io, t, onPan = null) {
  for (let k = 0; k < 8; k++) {
    const p = await tileScreen(page, t);
    const inside = await S(page, ([x, y]) => x >= 69.5 && x <= innerWidth - 69.5 && y >= 39.5 && y <= innerHeight - 29.5, [p.x, p.y]);
    if (inside && (await S(page, MAP_CLEAR, [p.x, p.y, 24]))) return { x: Math.round(p.x), y: Math.round(p.y) };
    const spot = await clearSpotNear(page, p);
    if (!spot) throw new Error('no part of the map is clear of the interface');
    // the drag starts on a clear spot near the one it goes to, so the finger is on the map; it is never shorter than
    // a pan (a shorter one would be a tap: with a tool in hand, a purchase)
    let dx = Math.round(Math.max(-260, Math.min(260, spot.x - p.x)));
    let dy = Math.round(Math.max(-160, Math.min(160, spot.y - p.y)));
    if (Math.hypot(dx, dy) < 24) {
      const k = 24 / Math.max(1, Math.hypot(dx, dy));
      dx = Math.round(dx * k) || 24;
      dy = Math.round(dy * k);
    }
    const from = await clearSpotNear(page, { x: spot.x - dx, y: spot.y - dy });
    await io.pan(dx, dy, { x: from.x, y: from.y });
    if (onPan) await onPan(`pan by ${dx},${dy}`);
  }
  throw new Error(`tile ${JSON.stringify(t)} not brought clear of the interface`);
}

// Brings tiles (or screen-point getters) into the free part of the screen with REAL pans of the input (right-button
// drag, finger swipe, right stick). onPan(label) is called after each pan (the ledger checks that a pan buys nothing).
// Returns the number of pans made; throws when the tiles cannot be brought into sight.
export async function inView(page, io, tiles, onPan = null) {
  if (tiles.some((t) => !Number.isFinite(t?.x) || !Number.isFinite(t?.y))) throw new Error(`inView: not tiles: ${JSON.stringify(tiles)}`);
  let pans = 0;
  for (let k = 0; k < 8; k++) {
    const f = await freeRect(page);
    const pts = await Promise.all(tiles.map((t) => tileScreen(page, t)));
    let good = true;
    for (const p of pts) if (!(p.x > f.left && p.x < f.right && p.y > f.top && p.y < f.bottom && (await clearAt(page, p)))) good = false;
    if (good) return pans;
    const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
    const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    const h = { x: Math.round((f.left + f.right) / 2), y: Math.round((f.top + f.bottom) / 2) };
    const mx = (f.right - f.left) * 0.4;
    const my = (f.bottom - f.top) * 0.4;
    const dx = Math.round(Math.max(-mx, Math.min(mx, h.x - cx)));
    const dy = Math.round(Math.max(-my, Math.min(my, h.y - cy)));
    // the pan starts on the map, where nothing is drawn over it, a little off the middle
    const at = { x: Math.round(h.x - dx / 2), y: Math.round(h.y - dy / 2) };
    await io.pan(dx, dy, at);
    pans++;
    if (onPan) await onPan(`pan by ${dx},${dy} (${io.mouse ? 'right-button drag' : io.touch ? 'finger swipe' : 'right stick'})`);
  }
  throw new Error(`tiles ${JSON.stringify(tiles)} not brought into sight`);
}
