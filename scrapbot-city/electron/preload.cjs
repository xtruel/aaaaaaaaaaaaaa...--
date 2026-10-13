// The only bridge between the game page and the desktop shell: window.scrapbotDesktop.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('scrapbotDesktop', {
  isDesktop: true,
  setFullscreen: (on) => ipcRenderer.send('fullscreen', Boolean(on)),
  onFullscreenChange: (fn) => ipcRenderer.on('fullscreen-changed', (_event, on) => fn(Boolean(on))),
  quit: () => ipcRenderer.send('quit'),
  unlockAchievement: (id) => ipcRenderer.send('achievement', String(id)),
  // saves as files in the user folder, synced by Steam Cloud (see electron/main.cjs)
  storage: {
    get: (key) => ipcRenderer.sendSync('storage:get', String(key)),
    getDamaged: (key) => ipcRenderer.sendSync('storage:getDamaged', String(key)),
    set: (key, value) => ipcRenderer.sendSync('storage:set', String(key), String(value)),
    remove: (key) => ipcRenderer.sendSync('storage:remove', String(key)),
  },
  openSaves: () => ipcRenderer.send('saves:open'),
  showKeyboard: (rect) => ipcRenderer.sendSync('keyboard', rect),
});
