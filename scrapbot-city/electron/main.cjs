// Desktop wrapper used for the Steam build: loads the single-file game from dist/,
// handles fullscreen and quitting, keeps saves as files (for Steam Cloud)
// and forwards achievements to Steam when steamworks.js is installed.
const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { usable } = require('./storage-utils.cjs');

let steam = null;

// A fixed folder name, so the Steam Auto-Cloud paths in docs/STEAM.md hold for every build.
app.setPath('userData', path.join(app.getPath('appData'), 'Scrapbot City'));
const saveDir = () => path.join(app.getPath('userData'), 'saves');

// One small file per storage key: save_city-home.sav, campaign.sav, settings.sav...
function fileFor(key) {
  return path.join(saveDir(), `${String(key).replace(/[^a-zA-Z0-9-]/g, '_')}.sav`);
}

function readText(file) {
  try {
    const text = fs.readFileSync(file, 'utf8');
    return text.length ? text : null;
  } catch {
    return null;
  }
}

// Write next to the file, then rename over it: a crash mid-save never leaves half a city behind.
// The previous good version stays as .bak and is used if the main file is ever missing or damaged;
// a damaged file is never copied over a good backup.
function writeAtomic(key, file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, value, 'utf8');
  if (usable(key, readText(file))) fs.copyFileSync(file, `${file}.bak`);
  fs.renameSync(tmp, file);
}

ipcMain.on('storage:get', (event, key) => {
  const file = fileFor(key);
  const main = readText(file);
  if (usable(key, main)) {
    event.returnValue = main;
    return;
  }
  const bak = readText(`${file}.bak`);
  event.returnValue = usable(key, bak) ? bak : main;
});

ipcMain.on('storage:set', (event, key, value) => {
  try {
    writeAtomic(key, fileFor(key), String(value));
    event.returnValue = true;
  } catch (err) {
    console.log(`Could not save ${key}: ${err.message}`);
    event.returnValue = false;
  }
});

ipcMain.on('storage:remove', (event, key) => {
  const file = fileFor(key);
  for (const f of [file, `${file}.bak`]) fs.rmSync(f, { force: true });
  event.returnValue = true;
});

ipcMain.on('saves:open', () => {
  fs.mkdirSync(saveDir(), { recursive: true });
  shell.openPath(saveDir());
});

// Steam is optional: outside Steam (or without steamworks.js) the game simply runs without it.
// steamworks.js is loaded at startup, before the app is ready: the overlay needs Chromium switches that
// only apply when set this early.
let steamworks = null;
try {
  steamworks = require('steamworks.js');
  steamworks.electronEnableSteamOverlay();
} catch (err) {
  console.log(`Steam not available: ${err.message}`);
}

function initSteam() {
  if (!steamworks) return;
  try {
    // App ID: an explicit one for local tests (STEAM_APP_ID or steam_appid.txt next to the exe); when the
    // Steam client starts the game it sets SteamAppId itself, and steamworks.js reads it from there.
    const appIdFile = path.join(path.dirname(app.getPath('exe')), 'steam_appid.txt');
    const fromFile = fs.existsSync(appIdFile) ? fs.readFileSync(appIdFile, 'utf8').trim() : '';
    const appId = Number(process.env.STEAM_APP_ID || process.env.SteamAppId || fromFile || 0);
    steam = steamworks.init(appId || undefined);
  } catch (err) {
    steam = null;
    console.log(`Steam not available: ${err.message}`);
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: 'Scrapbot City',
    backgroundColor: '#120b29',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  win.once('ready-to-show', () => win.show());
  // keep the game's Fullscreen setting in step with the window, however it changed (F11, OS controls)
  win.on('enter-full-screen', () => win.webContents.send('fullscreen-changed', true));
  win.on('leave-full-screen', () => win.webContents.send('fullscreen-changed', false));
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    }
  });
  // external links (credits, store page) open in the normal browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  return win;
}

ipcMain.on('fullscreen', (event, on) => {
  BrowserWindow.fromWebContents(event.sender)?.setFullScreen(Boolean(on));
});

ipcMain.on('quit', () => app.quit());

// Steam Deck in Game Mode: show Steam's floating keyboard over a text field (mode 0 = text, 3 = numbers).
// Answers false when there is no Steam to ask, so the game can carry on without it.
ipcMain.on('keyboard', (event, rect) => {
  const show = steam?.utils?.showFloatingGamepadTextInput;
  event.returnValue = typeof show === 'function';
  if (!event.returnValue) return;
  const r = rect || {};
  try {
    Promise.resolve(show(r.numeric ? 3 : 0, Math.round(r.x || 0), Math.round(r.y || 0), Math.round(r.w || 0), Math.round(r.h || 0))).catch((err) =>
      console.log(`On-screen keyboard failed: ${err.message}`),
    );
  } catch (err) {
    console.log(`On-screen keyboard failed: ${err.message}`);
  }
});

ipcMain.on('achievement', (_event, id) => {
  if (!steam) return;
  try {
    // Steamworks API names are ACH_<ID>, e.g. ACH_SPIRE (see docs/STEAM.md)
    steam.achievement.activate(`ACH_${String(id).toUpperCase()}`);
  } catch (err) {
    console.log(`Achievement ${id} failed: ${err.message}`);
  }
});

app.whenReady().then(() => {
  initSteam();
  createWindow();
});

app.on('window-all-closed', () => app.quit());
