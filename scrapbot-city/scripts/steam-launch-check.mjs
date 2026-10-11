// npm run steam:launch-check -- [--exe <path>] [--out <dir>]
// Launches the packaged Linux build (release/linux-unpacked/scrapbot-city by default) WITHOUT a Steam client and
// checks what a player outside Steam (or with Steam not running) would get:
//   - the steamworks.js native module and libsteam_api.so really load in the main process (/proc/<pid>/maps);
//   - Steam init fails cleanly ("Steam not available: ..." in the log) without and with an App ID (480);
//   - the menu shows, a free-play city starts and runs, saves land in <XDG_CONFIG_HOME>/Scrapbot City/saves;
//   - the Steam-only bridges answer "no Steam" (on-screen keyboard) or do nothing (achievement), without errors;
//   - Quit closes the app with exit code 0.
// Needs a display: on a headless Linux machine run it under xvfb-run -a. Needs Playwright (devDependency or global).
// Linux only (it reads /proc). Profiles are created under --out, the player's real saves are never touched.
// It proves nothing about Windows, the Steam Deck, the Steam overlay, achievements or Cloud with a real Steam client.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (name, def) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : def);
const exe = path.resolve(opt('--exe', path.join(root, 'release', 'linux-unpacked', 'scrapbot-city')));
const out = path.resolve(opt('--out', fs.mkdtempSync(path.join(os.tmpdir(), 'scrapbot-launch-'))));
fs.mkdirSync(out, { recursive: true });

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
    return createRequire(path.join(globalRoot, 'noop.js'))('playwright');
  }
}

if (process.platform !== 'linux') {
  console.error('steam-launch-check: Linux only');
  process.exit(2);
}
if (!fs.existsSync(exe)) {
  console.error(`steam-launch-check: ${exe} not found (npm run dist:steam)`);
  process.exit(2);
}
const { _electron: electron } = await loadPlaywright();
const results = [];
let failed = false;
const report = (ok, name, detail) => {
  const status = ok === null ? 'NOTE' : ok ? 'PASS' : 'FAIL';
  if (status === 'FAIL') failed = true;
  results.push({ status, name, detail });
  console.log(`${status.padEnd(5)} ${name} — ${detail}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(label, extraEnv) {
  const xdg = path.join(out, `profile-${label}`);
  fs.rmSync(xdg, { recursive: true, force: true });
  const saves = path.join(xdg, 'Scrapbot City', 'saves');
  fs.mkdirSync(saves, { recursive: true });
  // quiet settings, English, tutorial already seen: the menu opens straight away
  fs.writeFileSync(path.join(saves, 'settings.sav'), JSON.stringify({ sfx: 0, music: 0, crt: true, edgeScroll: false, reducedMotion: false, fullscreen: false, lang: 'en' }));
  fs.writeFileSync(path.join(saves, 'tutorial-done.sav'), '1');
  fs.writeFileSync(path.join(saves, 'migrated.sav'), '1');
  const env = { ...process.env, XDG_CONFIG_HOME: xdg, ...extraEnv };
  for (const k of ['SteamAppId', 'SteamGameId', 'SteamEnv', 'SteamDeck', 'STEAM_APP_ID']) if (!(k in extraEnv)) delete env[k];
  // Chromium refuses to start as root with its sandbox on: only then is it turned off (players never run as root)
  const args = process.getuid?.() === 0 ? ['--no-sandbox'] : [];

  // 1) plain start, as a launcher would do it: the main process's own log and the libraries it maps
  const plain = await new Promise((resolve) => {
    const child = spawn(exe, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let text = '';
    child.stdout.on('data', (d) => (text += d));
    child.stderr.on('data', (d) => (text += d));
    setTimeout(() => {
      let mapped = [];
      try {
        mapped = fs.readFileSync(`/proc/${child.pid}/maps`, 'utf8').split('\n').map((l) => l.split(/\s+/).slice(5).join(' '));
      } catch {
        // already gone
      }
      child.once('exit', (code, signal) => resolve({ text, mapped, code, signal }));
      child.kill('SIGTERM');
    }, 8000);
  });
  const plainMaps = [...new Set(plain.mapped.filter((f) => /steamworks|steam_api/i.test(f)).map((f) => path.relative(path.dirname(exe), f)))];
  fs.writeFileSync(path.join(out, `${label}-main.log`), plain.text);

  // 2) the same build driven by Playwright: menu, a city, the bridges, the saves, Quit
  const t0 = Date.now();
  const app = await electron.launch({ executablePath: exe, args, env, timeout: 120000 });
  const proc = app.process();
  const exited = new Promise((r) => proc.once('exit', (code, signal) => r({ code, signal })));
  const win = await app.firstWindow({ timeout: 120000 });
  const pageErrors = [];
  win.on('pageerror', (e) => pageErrors.push(e.message));
  win.on('console', (m) => m.type() === 'error' && pageErrors.push(m.text()));
  await win.waitForSelector('#menu [data-act="new"]', { state: 'visible', timeout: 60000 });
  const tMenu = Date.now() - t0;
  await sleep(1500);
  const maps = [
    ...new Set(
      fs
        .readFileSync(`/proc/${proc.pid}/maps`, 'utf8')
        .split('\n')
        .map((l) => l.split(/\s+/).slice(5).join(' '))
        .filter((f) => /steamworks|steam_api/i.test(f))
        .map((f) => path.relative(path.dirname(exe), f)),
    ),
  ];
  const version = await win.evaluate(() => (document.body.textContent.match(/Build_\d+\.\d+\.\d+(?:-[a-z]+\.\d+)?|Version \d+\.\d+\.\d+/) ?? [null])[0]);
  await win.screenshot({ path: path.join(out, `${label}-menu.png`) });

  // the Steam-only bridges, called the way the game calls them
  const bridges = await win.evaluate(() => {
    const d = window.scrapbotDesktop;
    const keyboard = d.showKeyboard({ x: 10, y: 10, w: 200, h: 30, numeric: false });
    d.unlockAchievement('tutorial');
    return { desktop: d.isDesktop === true, keyboard };
  });

  // a free-play city: the game keeps running without Steam
  await win.click('#menu [data-act="new"]');
  await win.click('[data-mode="free"]');
  await win.waitForSelector('#ng-seed', { timeout: 10000 });
  await win.fill('#ng-seed', '4242');
  await win.click('#modal-root .modal-actions .btn-primary');
  await sleep(1500);
  for (let i = 0; i < 3 && (await win.locator('#modal-root .modal').count()); i++) {
    await win.click('#modal-root .modal-actions .btn-primary').catch(() => {});
    await sleep(600);
  }
  const day0 = await win.evaluate(() => document.querySelector('[data-time]')?.textContent ?? null);
  await sleep(6000);
  const day1 = await win.evaluate(() => document.querySelector('[data-time]')?.textContent ?? null);
  // memory of the whole app (main, GPU, renderer and helper processes) with a city running
  const table = execSync('ps -eo pid=,ppid=,rss=', { encoding: 'utf8' })
    .trim()
    .split('\n')
    .map((l) => l.trim().split(/\s+/).map(Number));
  const tree = new Set([proc.pid]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const [pid, ppid] of table) if (tree.has(ppid) && !tree.has(pid)) (tree.add(pid), (grew = true));
  }
  const rssMb = Math.round(table.filter(([pid]) => tree.has(pid)).reduce((n, [, , rss]) => n + rss, 0) / 1024);
  await win.screenshot({ path: path.join(out, `${label}-city.png`) });
  await win.keyboard.press('Escape');
  await sleep(500);
  // a save from the pause menu path is not needed: the autosave on hide/quit writes the slot; storage is checked directly
  const wrote = await win.evaluate(() => window.scrapbotDesktop.storage.set('launch-check', 'ok'));
  const readBack = await win.evaluate(() => window.scrapbotDesktop.storage.get('launch-check'));
  await win.evaluate(() => window.scrapbotDesktop.storage.remove('launch-check'));
  const alive = await win.evaluate(() => 1 + 1).catch(() => null);
  await win.evaluate(() => window.scrapbotDesktop.quit()).catch(() => {});
  const exit = await Promise.race([exited, sleep(30000).then(() => null)]);
  if (!exit) await app.close().catch(() => {});
  const savesNow = fs.readdirSync(saves).sort();
  const steamLine = (plain.text.match(/Steam not available:[^\n]*/g) ?? []).join(' | ');
  const loaded = (list) => list.some((f) => /steamworksjs\.linux-x64-gnu\.node$/.test(f)) && list.some((f) => /libsteam_api\.so$/.test(f));

  report(loaded(plainMaps) && loaded(maps), `${label}: native module loaded by the packaged app`, `plain start: ${plainMaps.join(', ') || 'none'}; Playwright start: ${maps.length} files`);
  report(/Steam not available/.test(steamLine) && !/Cannot find module|invalid ELF|undefined symbol|GLIBC/.test(steamLine), `${label}: Steam init fails cleanly without a Steam client`, `log: "${steamLine || '(no line)'}"`);
  report(pageErrors.length === 0, `${label}: no errors in the page`, pageErrors.slice(0, 3).join(' | ') || 'none');
  report(true, `${label}: menu shown`, `${tMenu} ms after launch; ${version ?? 'version label not found'}; screenshot ${label}-menu.png`);
  report(bridges.desktop && bridges.keyboard === false && alive === 2, `${label}: Steam bridges without Steam`, `on-screen keyboard answers ${bridges.keyboard} (the game then uses its own input); achievement call ignored; app responsive afterwards: ${alive === 2}`);
  report(Boolean(day0) && Boolean(day1) && day0 !== day1, `${label}: a free-play city runs`, `clock ${day0} -> ${day1} after 6 s; screenshot ${label}-city.png`);
  report(null, `${label}: memory with a city running`, `${rssMb} MB resident in ${tree.size} processes (software rendering, no GPU: indicative only)`);
  report(wrote === true && readBack === 'ok' && savesNow.includes('settings.sav'), `${label}: saves folder`, `${path.relative(out, saves)}: ${savesNow.join(', ')}`);
  report(exit && exit.code === 0, `${label}: Quit closes the app`, exit ? `exit code ${exit.code}${exit.signal ? `, signal ${exit.signal}` : ''}` : 'still running after 30 s (closed by the check)');
}

await run('no-appid', {});
await run('appid-480', { STEAM_APP_ID: '480' });
fs.writeFileSync(path.join(out, 'launch-check.json'), JSON.stringify({ date: new Date().toISOString(), exe, results }, null, 2));
console.log(`\nsteam:launch-check — ${failed ? 'at least one check FAILED' : 'all checks passed'} (Linux, no Steam client); output in ${out}`);
process.exit(failed ? 1 : 0);
