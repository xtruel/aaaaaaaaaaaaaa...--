// The only bridge between the game page and the desktop shell: window.scrapbotDesktop.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('scrapbotDesktop', {
  isDesktop: true,
  setFullscreen: (on) => ipcRenderer.send('fullscreen', Boolean(on)),
  quit: () => ipcRenderer.send('quit'),
  unlockAchievement: (id) => ipcRenderer.send('achievement', String(id)),
});
