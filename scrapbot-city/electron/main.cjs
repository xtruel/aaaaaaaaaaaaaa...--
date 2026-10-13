// Desktop wrapper used for the Steam build: loads the single-file game from dist/,
// handles fullscreen and quitting, keeps saves as files (for Steam Cloud)
// and forwards achievements to Steam when steamworks.js is installed.
const { app, BrowserWindow, Menu, ipcMain, session, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { createFileStore } = require('./file-store.cjs');

let steam = null;

// A fixed folder name, so the Steam Auto-Cloud paths in docs/STEAM.md hold for every build.
app.setPath('userData', path.join(app.getPath('appData'), 'Scrapbot City'));
const saveDir = () => path.join(app.getPath('userData'), 'saves');

// Saves as files (see file-store.cjs).
const files = createFileStore(saveDir);

ipcMain.on('storage:get', (event, key) => {
  event.returnValue = files.get(key);
});

ipcMain.on('storage:getDamaged', (event, key) => {
  event.returnValue = files.getDamaged(key);
});

ipcMain.on('storage:set', (event, key, value) => {
  event.returnValue = files.set(key, value);
});

ipcMain.on('storage:remove', (event, key) => {
  event.returnValue = files.remove(key);
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

// Steam Deck (Steam sets SteamDeck=1 there): start fullscreen unless the player turned fullscreen off on this
// device before. That choice lives in a small file outside saves/, so Steam Cloud never carries it to a PC.
const onSteamDeck = process.env.SteamDeck === '1';
const deckFile = () => path.join(app.getPath('userData'), 'steam-deck.json');
function deckWindowed() {
  try {
    return JSON.parse(fs.readFileSync(deckFile(), 'utf8')).windowed === true;
  } catch {
    return false;
  }
}
function rememberDeckWindowed(windowed) {
  if (deckWindowed() === windowed) return;
  try {
    fs.mkdirSync(path.dirname(deckFile()), { recursive: true });
    fs.writeFileSync(deckFile(), JSON.stringify({ windowed }));
  } catch (err) {
    console.log(`Could not save the Steam Deck window mode: ${err.message}`);
  }
}

// Window icon on Linux (Windows takes it from the .exe, set by scripts/after-pack.cjs).
const linuxIcon = path.join(__dirname, 'icon.png');

function createWindow() {
  const deckFullscreen = onSteamDeck && !deckWindowed();
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    fullscreen: deckFullscreen,
    title: 'Scrapbot City',
    backgroundColor: '#120b29',
    autoHideMenuBar: true,
    ...(process.platform === 'linux' && fs.existsSync(linuxIcon) ? { icon: linuxIcon } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // no red underlines under city names (the spell checker itself is switched off in app.whenReady)
      spellcheck: false,
    },
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  win.once('ready-to-show', () => win.show());
  // keep the game's Fullscreen setting in step with the window, however it changed (F11, OS controls)
  let closing = false;
  win.on('close', () => (closing = true));
  win.on('enter-full-screen', () => {
    win.webContents.send('fullscreen-changed', true);
    if (onSteamDeck) rememberDeckWindowed(false);
  });
  win.on('leave-full-screen', () => {
    win.webContents.send('fullscreen-changed', false);
    if (onSteamDeck && !closing) rememberDeckWindowed(true);
  });
  // the window went fullscreen before the page could listen: tell the game once it has loaded
  if (deckFullscreen) win.webContents.once('did-finish-load', () => win.webContents.send('fullscreen-changed', win.isFullScreen()));
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
  // event.returnValue only sends the answer back: Electron's getter reads it as undefined, so keep our own copy
  const ok = typeof show === 'function';
  event.returnValue = ok;
  if (!ok) return;
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
  // The game never goes online. Electron's spell checker would download a dictionary from Google at the first
  // start: an empty language list stops that download (turning the checker off alone does not).
  try {
    session.defaultSession.setSpellCheckerLanguages([]);
    session.defaultSession.setSpellCheckerEnabled(false);
  } catch (err) {
    console.log(`Spell checker settings: ${err.message}`);
  }
  initSteam();
  createWindow();
});

app.on('window-all-closed', () => app.quit());
