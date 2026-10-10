// Desktop wrapper used for the Steam build: loads the single-file game from dist/,
// handles fullscreen and quitting, and forwards achievements to Steam when steamworks.js is installed.
const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron');
const fs = require('fs');
const path = require('path');

let steam = null;

// Steam is optional: outside Steam (or without steamworks.js) the game simply runs without it.
function initSteam() {
  try {
    const steamworks = require('steamworks.js');
    const appIdFile = path.join(path.dirname(app.getPath('exe')), 'steam_appid.txt');
    const appId = Number(process.env.STEAM_APP_ID || (fs.existsSync(appIdFile) ? fs.readFileSync(appIdFile, 'utf8').trim() : 0));
    if (!appId) return;
    steam = steamworks.init(appId);
    steamworks.electronEnableSteamOverlay();
  } catch (err) {
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
