// Trailer step 2: node scripts/trailer/record.mjs --build <dist/index.html> --saves <saves.json> --out <dir>
//   [--size 1920x1080] [--capture screencast|video] [--debug]
//
// Plays the RELEASE build of the game (the single dist/index.html, no debug hooks) in Chromium driven by Playwright
// and captures what the page shows. The only thing put in from outside is the player's storage at the start
// (saves.json: the five campaign cities pre-played by the game's own autopilot, see make-saves.mjs); after that every
// action is a real mouse click, drag or key press on the game's interface, so the footage is the game as a player
// sees it. Nothing is drawn over it. There is no sound (Playwright captures none).
//
// Capture:
//   screencast (default) — Playwright's CDP session streams the page's frames (JPEG, quality 95) with their
//                          timestamps; only the moments kept for the trailer are written (out/clips/<n>/).
//   video                — Playwright's own recordVideo (one VP8 .webm of the whole session, 25 fps, ~1 Mbit/s:
//                          lower quality); assemble.mjs cuts the kept moments out of it.
// A story event can pop up at any moment (it is part of the game): the clip it interrupts is dropped and taken
// again; the first event is kept as a clip of its own (the card, then the mouse picking the first choice).
// Output in --out: scenes.json (scenes, kept clips with their times, page errors), the frames or the .webm, and
// stills/: lossless 1920x1080 PNG screenshots of the same moments (candidates for the store's screenshots: real
// gameplay of the build being filmed, interface included); with --debug, a screenshot after each scene in debug/.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createRequire } from 'module';
import { execSync } from 'child_process';

const argv = process.argv.slice(2);
const opt = (name, def) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : def);
const build = path.resolve(opt('--build', 'dist/index.html'));
const savesFile = path.resolve(opt('--saves', 'saves.json'));
const out = path.resolve(opt('--out', 'trailer-out'));
const [W, H] = opt('--size', '1920x1080').split('x').map(Number);
const capture = opt('--capture', 'screencast');
const debug = argv.includes('--debug');
if (!fs.existsSync(build)) throw new Error(`record: ${build} not found`);
if (!['screencast', 'video'].includes(capture)) throw new Error('record: --capture is screencast or video');
const saves = JSON.parse(fs.readFileSync(savesFile, 'utf8'));
for (const d of ['raw', 'clips', 'debug', 'stills']) fs.rmSync(path.join(out, d), { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
if (debug) fs.mkdirSync(path.join(out, 'debug'), { recursive: true });
fs.mkdirSync(path.join(out, 'stills'), { recursive: true });

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
    return createRequire(path.join(globalRoot, 'noop.js'))('playwright');
  }
}
const { chromium } = await loadPlaywright();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ args: ['--force-device-scale-factor=1'] });
const context = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
  ...(capture === 'video' ? { recordVideo: { dir: path.join(out, 'raw'), size: { width: W, height: H } } } : {}),
});
await context.addInitScript((storage) => {
  if (sessionStorage.getItem('trailer-init')) return;
  sessionStorage.setItem('trailer-init', '1');
  localStorage.clear();
  for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, v);
}, saves.storage);
const page = await context.newPage();
const t0 = Date.now(); // time 0 of scenes.json (and of the .webm with --capture video)
const now = () => (Date.now() - t0) / 1000;
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

// ---------- capture ----------
const keep = []; // { name, start, end, dir?, frames? }
let clip = null; // the clip being captured
let lastFrame = null; // the newest frame: the first frame of a clip that starts between two frames
let frameCount = 0;
if (capture === 'screencast') {
  const cdp = await context.newCDPSession(page);
  cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    const t = metadata.timestamp - t0 / 1000;
    lastFrame = { data, t };
    frameCount++;
    if (clip) {
      const file = `f${String(clip.frames.length).padStart(6, '0')}.jpg`;
      fs.writeFileSync(path.join(clip.dir, file), Buffer.from(data, 'base64'));
      clip.frames.push({ file, t: Math.max(t, clip.start) });
    }
    await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 95, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
}
let clipSeq = 0;
function clipStart(name) {
  const start = now();
  if (capture !== 'screencast') return { name, start };
  const dir = path.join(out, 'clips', `${String(++clipSeq).padStart(2, '0')}-${name}`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  clip = { name, start, dir, frames: [] };
  if (lastFrame) {
    fs.writeFileSync(path.join(dir, 'f000000.jpg'), Buffer.from(lastFrame.data, 'base64'));
    clip.frames.push({ file: 'f000000.jpg', t: start });
  }
  return clip;
}
function clipDiscard(c) {
  clip = null;
  if (c.dir) fs.rmSync(c.dir, { recursive: true, force: true });
}
function clipEnd(c, end = now()) {
  if (capture === 'screencast') {
    clip = null;
    c.frames = c.frames.filter((f) => f.t <= end);
    keep.push({ name: c.name, start: Number(c.start.toFixed(3)), end: Number(end.toFixed(3)), dir: path.relative(out, c.dir), frames: c.frames });
  } else {
    keep.push({ name: c.name, start: Number(c.start.toFixed(3)), end: Number(end.toFixed(3)) });
  }
}

// A lossless screenshot of what is on screen now (the pointer is never drawn).
let stillSeq = 0;
const stills = [];
async function still(name) {
  const file = `${String(++stillSeq).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: path.join(out, 'stills', file) });
  stills.push({ file, at: Number(now().toFixed(2)) });
}

// ---------- dialogs that open by themselves ----------
async function modalOpen() {
  return (await page.locator('#modal-root .modal').count()) > 0;
}
// Answered with the first choice, as a player would (never during a take: there the take is dropped instead).
let inTake = false;
async function answerModals() {
  if (inTake) return 0;
  let n = 0;
  while (n < 4 && (await modalOpen())) {
    await page.locator('#modal-root .modal-actions button').first().click().catch(() => {});
    await sleep(500);
    n++;
  }
  return n;
}
// The first story event of the session is kept as a clip: the card, the mouse going to the first choice, the click.
let eventKept = false;
async function eventOrAnswer() {
  const choices = page.locator('#modal-root .modal-actions button');
  if (!eventKept && (await modalOpen()) && (await choices.count()) >= 2) {
    const c = clipStart('event');
    await sleep(1600);
    await still('event');
    const box = await choices.first().boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width * 0.4, box.y + box.height / 2, { steps: 16 });
      await sleep(700);
      await page.mouse.click(box.x + box.width * 0.4, box.y + box.height / 2);
      await sleep(700);
      eventKept = true;
      clipEnd(c);
    } else {
      clipDiscard(c);
    }
    await page.mouse.move(W - 4, H / 2);
  }
  await answerModals();
}
// One take of a scene: `fn(stopped)` acts on the game while it is captured and returns what it did (null: it did not
// happen, the take is not kept). If a dialog pops up meanwhile the take is dropped, the dialog handled, and the scene
// taken again (up to `tries` times). Returns fn's result, or null when no take was kept.
async function take(name, fn, tries = 3) {
  for (let i = 0; i < tries; i++) {
    await answerModals();
    const c = clipStart(name);
    let interrupted = false;
    let done = false;
    const watch = (async () => {
      while (!done) {
        if (!interrupted && (await modalOpen())) interrupted = true;
        await sleep(120);
      }
    })();
    let result = null;
    let error = null;
    inTake = true;
    try {
      result = await fn(() => interrupted);
    } catch (err) {
      error = err;
    }
    inTake = false;
    done = true;
    await watch;
    if (!interrupted && !error && result !== null) {
      clipEnd(c);
      return result;
    }
    clipDiscard(c);
    if (!interrupted) {
      console.warn(`  take ${name} not kept: ${error ? error.message.split('\n')[0] : 'the action did not happen'}`);
      return null;
    }
    console.log(`  take ${name}: a dialog popped up, again`);
    await eventOrAnswer();
  }
  return null;
}
// A take that just watches (and optionally does something) for `ms`.
const hold = (name, ms, during) =>
  take(name, async (stopped) => {
    const start = Date.now();
    if (during) await during(stopped);
    while (Date.now() - start < ms && !stopped()) await sleep(50);
    return {};
  });
// A click on the game's interface; a dialog in the way is handled first.
async function uiClick(selector) {
  for (let attempt = 0; ; attempt++) {
    if (inTake && (await modalOpen())) throw new Error('a dialog is open');
    await answerModals();
    try {
      await page.click(selector, { timeout: 4000 });
      return;
    } catch (err) {
      if (attempt >= 2) throw err;
    }
  }
}

const scenes = [];
async function scene(name, fn) {
  const start = now();
  console.log(`scene ${name}`);
  const info = (await fn()) ?? {};
  scenes.push({ name, start: Number(start.toFixed(2)), end: Number(now().toFixed(2)), ...info });
  if (debug) await page.screenshot({ path: path.join(out, 'debug', `${String(scenes.length).padStart(2, '0')}-${name}.png`) });
}

// ---------- the game's own controls ----------
async function toMenu() {
  await page.goto(`file://${build}`);
  await page.waitForSelector('#menu [data-act="new"]', { state: 'visible', timeout: 30000 });
  await sleep(1200);
}
async function toRegionFromMenu() {
  // direct clicks: the "New game" dialog is itself a modal, not one to answer
  await page.click('#menu [data-act="new"]');
  await page.click('[data-mode="campaign"]');
  await page.waitForSelector('[data-city]', { state: 'visible', timeout: 15000 });
  await sleep(900);
}
// The city nodes on the region map bob up and down: clicked with the mouse where they are, like a player would.
async function clickCity(id) {
  const box = await page.locator(`[data-city="${id}"]`).boundingBox();
  if (!box) throw new Error(`record: city ${id} not on the region map`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}
async function enterCity(id) {
  await clickCity(id);
  await sleep(300);
  await uiClick('[data-play]');
  await page.waitForSelector('.hud-top', { state: 'visible', timeout: 20000 });
  await sleep(800);
  await answerModals();
  await page.mouse.move(W - 4, H / 2);
}
async function pauseMenu() {
  // the HUD's Menu button opens the pause menu (Esc would first close an open panel)
  await uiClick('[data-menu]');
  await page.waitForSelector('#modal-root .modal', { timeout: 5000 });
}
async function backToRegion() {
  await pauseMenu();
  await page.locator('#modal-root .modal-actions button', { hasText: 'Region map' }).click();
  await page.waitForSelector('[data-city]', { state: 'visible', timeout: 15000 });
  await sleep(600);
}
let zoom = 3;
async function setZoom(z) {
  await answerModals();
  for (let i = 0; i < 5; i++) await page.keyboard.press('Minus');
  for (let i = 1; i < z; i++) await page.keyboard.press('Equal');
  zoom = z;
  await page.keyboard.press('KeyH');
  await sleep(250);
}
const setSpeed = (v) => uiClick(`[data-speed="${v}"]`);
const clock = () => page.evaluate(() => document.querySelector('[data-time]')?.textContent ?? '');
// Screen position of a tile's centre after KeyH (camera on the HQ), from the game's own projection and camera rule
// (render/iso/projection.ts, Renderer.centerOn and the HUD insets of Session.measureHud); checked by clicking the HQ.
async function tileToScreen(city, tx, ty) {
  const ins = await page.evaluate(() => {
    const top = document.querySelector('.hud-top');
    const bar = document.querySelector('[data-toolbar]');
    return {
      top: top?.offsetParent ? Math.max(0, Math.round(top.getBoundingClientRect().bottom)) : 0,
      bottom: bar?.offsetParent ? Math.max(0, Math.round(window.innerHeight - bar.getBoundingClientRect().top)) : 0,
      w: window.innerWidth,
      h: window.innerHeight,
    };
  });
  const T = 16;
  const viewW = Math.ceil(ins.w / zoom);
  const viewH = Math.ceil(ins.h / zoom);
  const wx = (city.hq.x + 1.5) * T;
  const wy = (city.hq.y + 1.5) * T;
  const freeMid = (ins.top / zoom + viewH - ins.bottom / zoom) / 2;
  const camX = wx - wy - viewW / 2;
  const camY = (wx + wy) / 2 - freeMid;
  const px = (tx + 0.5) * T;
  const py = (ty + 0.5) * T;
  return { x: Math.round((px - py - camX) * zoom), y: Math.round(((px + py) / 2 - camY) * zoom) };
}
const inspectorText = () =>
  page.evaluate(() => {
    const el = document.querySelector('[data-inspector]');
    return el && el.offsetParent ? el.textContent.replace(/\s+/g, ' ').trim() : '';
  });
const credits = () =>
  page.evaluate(() => Number((document.querySelector('[data-res="credits"] [data-v]')?.textContent ?? '').replace(/[^\d]/g, '')) || 0);
async function closeInspector() {
  const close = page.locator('[data-inspector] [data-close]');
  if (await close.first().isVisible().catch(() => false)) await close.first().click().catch(() => {});
  await sleep(200);
}
async function checkCamera(city) {
  await page.keyboard.press('KeyH');
  await sleep(200);
  const p = await tileToScreen(city, city.hq.x + 1, city.hq.y + 1);
  await page.mouse.click(p.x, p.y);
  await sleep(400);
  const text = await inspectorText();
  await closeInspector();
  await answerModals();
  return text.slice(0, 30);
}
// right-button drag: the game's camera pan (the left button never moves the map); paced by the clock, so a slow
// machine pans in bigger steps instead of taking longer
async function pan(dx, dy, ms, stopped = () => false) {
  const sx = W / 2;
  const sy = H / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down({ button: 'right' });
  const start = Date.now();
  for (;;) {
    const f = Math.min(1, (Date.now() - start) / ms);
    const e = f * f * (3 - 2 * f); // ease in and out
    await page.mouse.move(sx - dx * e, sy - dy * e);
    if (f >= 1 || stopped()) break;
    await sleep(30);
  }
  await page.mouse.up({ button: 'right' });
}

// ---------- scenes ----------
const C = saves.cities;
const ORDER = ['home', 'rustbay', 'neon', 'greenvale', 'company'].filter((id) => C[id]);

await scene('menu-and-region', async () => {
  await toMenu();
  await hold('menu', 2500);
  await toRegionFromMenu();
  if (await hold('region', 3600, async (stopped) => {
    for (const id of ORDER) {
      if (stopped()) return;
      await clickCity(id);
      await sleep(550);
    }
  })) await still('region');
});

for (const id of ORDER) {
  await scene(`city-${id}`, async () => {
    await enterCity(id);
    const cameraCheck = await checkCamera(C[id]);
    await setZoom(2);
    await setSpeed(2);
    await sleep(900);
    const dir = id === 'home' || id === 'greenvale' ? 1 : -1;
    const ok = await hold(`city-${id}`, 3000, (stopped) => pan(150 * dir, 40, 2800, stopped));
    if (ok) await still(`city-${id}`);
    await backToRegion();
    return { cameraCheck, clip: !!ok };
  });
}

// Building, decorations and night in the first city (Scrapbot City, green); module and smog in an industrial one.
await scene('build-decorate-night', async () => {
  await enterCity('home');
  const city = C.home;
  await setZoom(3);
  await setSpeed(1);
  const c0 = await credits();
  const used = []; // tiles taken by what this scene placed

  // build: a Pixel Garden on the first free spot of the list (the game decides; a refused click costs nothing),
  // then a few seconds at full speed while the site goes up
  const built = await take('build', async (stopped) => {
    await uiClick('[data-tool="garden"]');
    await sleep(300);
    let spot = null;
    for (const s of city.build.filter((b) => b.type === 'garden' && !used.some((u) => Math.abs(u.x - b.x) < 3 && Math.abs(u.y - b.y) < 3))) {
      if (stopped()) return null;
      // a 2x2 building is placed with its back tile under the cursor (Session.click: origin = tile - floor((w-1)/2))
      const p = await tileToScreen(city, s.x, s.y);
      const before = await credits();
      await page.mouse.move(p.x - 80, p.y - 40);
      await page.mouse.move(p.x, p.y, { steps: 10 });
      await sleep(400);
      await page.mouse.click(p.x, p.y);
      await sleep(300);
      if ((await credits()) < before) {
        spot = s;
        used.push({ x: s.x, y: s.y }, { x: s.x + 1, y: s.y + 1 });
        break;
      }
    }
    await page.keyboard.press('Escape');
    await page.mouse.move(W - 4, H / 2);
    if (!spot) return null;
    await setSpeed(3);
    await sleep(2600);
    return { ...spot };
  });
  if (built) await still('build');
  await setSpeed(1);

  // decorations: a dragged row of fences, then two lamps, from the Objects & modules panel (key O)
  // One take per fence row tried (a row the game refuses is not kept), then one take for the lamps.
  const catalogOpen = () => page.locator('[data-catalog-panel]').isVisible().catch(() => false);
  const toolInHand = async (kind) => {
    if (!(await catalogOpen())) {
      await page.keyboard.press('KeyO');
      await sleep(700);
    }
    await uiClick(`[data-item="${kind}"]`);
    await sleep(400);
  };
  let row = null;
  for (const r of city.rows) {
    if (used.some((u) => u.y >= r.y - 1 && u.y <= r.y + 2 && u.x >= r.x0 - 1 && u.x <= r.x1 + 1)) continue;
    row = await take('decorate', async (stopped) => {
      await toolInHand('fence');
      const a = await tileToScreen(city, r.x0, r.y);
      const b = await tileToScreen(city, r.x1, r.y);
      const before = await credits();
      await page.mouse.move(a.x, a.y, { steps: 8 });
      await sleep(200);
      await page.mouse.down();
      await page.mouse.move(b.x, b.y, { steps: 24 });
      await sleep(200);
      await page.mouse.up();
      await sleep(600);
      return !stopped() && (await credits()) < before ? r : null;
    });
    if (row) {
      for (let x = row.x0; x <= row.x1; x++) used.push({ x, y: row.y });
      break;
    }
  }
  const lamps = await take('decorate', async (stopped) => {
    await toolInHand('lamp');
    const placed = [];
    for (const l of city.lamps) {
      if (stopped()) return null;
      // a few tiles apart from each other and from what was just placed
      if (used.some((u) => Math.max(Math.abs(u.x - l.x), Math.abs(u.y - l.y)) < 2) || placed.some((q) => Math.max(Math.abs(q.x - l.x), Math.abs(q.y - l.y)) < 3)) continue;
      const p = await tileToScreen(city, l.x, l.y);
      const before = await credits();
      // straight to the tile: a slow glide over a lamp already standing shows the game's "in the way" warning
      await page.mouse.move(p.x, p.y, { steps: 2 });
      await sleep(300);
      await page.mouse.click(p.x, p.y);
      await sleep(350);
      if ((await credits()) < before) placed.push(l);
      if (placed.length >= 2) break;
    }
    await page.keyboard.press('Escape');
    await sleep(200);
    await page.keyboard.press('Escape');
    await page.mouse.move(W - 4, H / 2);
    await sleep(900);
    return placed.length ? placed : null;
  });
  if (lamps) used.push(...lamps);
  // tool and panel put away (Esc with nothing open would open the pause menu, so only while the panel shows)
  for (let i = 0; i < 3 && (await catalogOpen()); i++) {
    await page.keyboard.press('Escape');
    await sleep(150);
  }
  const deco = row || lamps ? { row, lamps: lamps?.length ?? 0 } : null;
  if (deco) await still('decorate');

  // night: the clock runs at full speed to the evening, then the city plays at normal speed
  await setSpeed(3);
  for (let i = 0; i < 200; i++) {
    await answerModals();
    const h = Number((await clock()).split(':')[0]);
    if (h >= 20 && h < 22) break;
    await sleep(150);
  }
  await setSpeed(1);
  await setZoom(2);
  const night = await hold('night', 5000, (stopped) => pan(-130, -30, 4800, stopped));
  if (night) await still('night');
  return { built, decorations: deco, creditsSpent: c0 - (await credits()), night: !!night };
});

await scene('module-and-smog', async () => {
  const id = ['company', 'rustbay', 'neon'].find((k) => C[k]?.smelters?.length) ?? 'company';
  const city = C[id];
  await backToRegion();
  await enterCity(id);
  await setZoom(3);
  await setSpeed(1);

  // module: a click on a Smelter (the one nearest the HQ that the click really selects), then "Install" on the
  // filter in its panel. Clicks that open another building are made before the take, off camera.
  let target = null;
  for (const sm of city.smelters) {
    for (const lift of [0, 10, 20]) {
      const p = await tileToScreen(city, sm.x + sm.w / 2 - 0.5, sm.y + sm.h / 2 - 0.5);
      await page.mouse.click(p.x, p.y - lift * zoom);
      await sleep(400);
      const ok = (await page.locator('[data-inspector] [data-install="smelterFilter"]').count()) > 0;
      await closeInspector();
      await answerModals();
      if (ok) {
        target = { ...sm, sx: p.x, sy: p.y - lift * zoom };
        break;
      }
    }
    if (target) break;
  }
  const installed = target
    ? await take('module', async (stopped) => {
        await page.mouse.move(target.sx + 200, target.sy + 120);
        await page.mouse.move(target.sx, target.sy, { steps: 12 });
        await sleep(300);
        await page.mouse.click(target.sx, target.sy);
        await sleep(800);
        const btn = page.locator('[data-inspector] [data-install="smelterFilter"]');
        if (stopped() || !(await btn.count()) || !(await btn.isEnabled())) {
          if (debug) await page.screenshot({ path: path.join(out, 'debug', 'module-not-found.png') });
          return null;
        }
        await btn.hover();
        await sleep(600);
        const before = await credits();
        await btn.click();
        await sleep(500);
        const ok = (await credits()) < before;
        await page.mouse.move(W - 4, H / 2, { steps: 6 });
        await sleep(2000);
        return ok ? { x: target.x, y: target.y } : null;
      })
    : null;
  if (installed) await still('module');
  await closeInspector();

  // smog: the clouds over the polluters, then the meter's "where it comes from" panel
  await setZoom(2);
  await setSpeed(2);
  let smogPanel = false;
  const smog = await hold('smog', 6500, async (stopped) => {
    await sleep(1800);
    const box = await page.locator('[data-smog-meter]').boundingBox();
    if (box && !stopped()) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 14 });
      await sleep(300);
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await sleep(400);
      smogPanel = await page.locator('[data-smog-panel]').isVisible().catch(() => false);
    }
  });
  if (smog) await still('smog');
  await page.keyboard.press('Escape');
  await page.mouse.move(W - 4, H / 2);
  return { city: id, installed, smog: !!smog, smogPanel };
});

await scene('end-menu', async () => {
  await pauseMenu();
  await page.locator('#modal-root .modal-actions button', { hasText: 'Main menu' }).click();
  await page.waitForSelector('#menu [data-act="new"]', { state: 'visible', timeout: 15000 });
  await sleep(600);
  await hold('end-menu', 2200);
});

const video = capture === 'video' ? page.video() : null;
await context.close();
await browser.close();
const meta = {
  build,
  buildSha256: crypto.createHash('sha256').update(fs.readFileSync(build)).digest('hex'),
  size: `${W}x${H}`,
  capture,
  raw: video ? path.relative(out, await video.path()) : null,
  framesReceived: frameCount,
  scenes,
  keep,
  stills,
  errors,
};
fs.writeFileSync(path.join(out, 'scenes.json'), JSON.stringify(meta, null, 1));
const total = keep.reduce((n, k) => n + (k.end - k.start), 0);
console.log(`record: ${keep.length} clips, ${total.toFixed(1)} s kept; ${capture === 'screencast' ? `${frameCount} frames received in ${now().toFixed(0)} s` : meta.raw}; page errors: ${errors.length ? errors.join(' | ') : 'none'}`);
for (const s of scenes) console.log(`  ${s.name} ${s.start}-${s.end}s ${JSON.stringify(Object.fromEntries(Object.entries(s).filter(([k]) => !['name', 'start', 'end'].includes(k))))}`);
for (const k of keep) console.log(`  clip ${k.name}: ${(k.end - k.start).toFixed(2)} s${k.frames ? `, ${k.frames.length} frames (${(k.frames.length / Math.max(0.01, k.end - k.start)).toFixed(1)} fps)` : ''}`);
const missing = ['menu', 'region', ...ORDER.map((id) => `city-${id}`), 'build', 'decorate', 'night', 'module', 'smog'].filter((n) => !keep.some((k) => k.name === n));
if (missing.length) console.warn(`record: WARNING, scenes not captured: ${missing.join(', ')}`);
