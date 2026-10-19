// A fake iOS shell for the game in Chromium. SIMULATED: no iPhone, iPad, WKWebView or Capacitor native code runs.
// window.Capacitor is put in every page before the game (addInitScript) as the shell's bridge looks to the page:
// isNativePlatform(), getPlatform() 'ios', nativePromise(plugin, method, options), nativeCallback(...) for listeners.
// The Filesystem plugin is answered in this Node process from a folder in memory that outlives reloads (the app's
// Library/ on the device), with the semantics of the shell's plugin (@capacitor/filesystem 8.1.5 on IONFilesystemLib
// 2.0.1, as tests/fake-filesystem.ts): a write into a missing folder needs `recursive`, a rename replaces the file at
// its destination, reading what is not there fails. StatusBar and SplashScreen answer {}; the App plugin's pause and
// resume are sent by the test (appEvent).

export const CAP_INIT = () => {
  const listeners = {};
  window.__capListeners = listeners;
  window.__capCalls = [];
  window.Capacitor = {
    isNativePlatform: () => true,
    getPlatform: () => 'ios',
    nativePromise(plugin, method, options) {
      window.__capCalls.push(`${plugin}.${method}`);
      return window.__capNative(plugin, method, options ?? {});
    },
    nativeCallback(plugin, method, options, callback) {
      window.__capCalls.push(`${plugin}.${method}${options?.eventName ? `(${options.eventName})` : ''}`);
      if (method === 'addListener') (listeners[`${plugin}.${options.eventName}`] ??= []).push(callback);
      return String(window.__capCalls.length);
    },
  };
};

export class FakeShell {
  constructor() {
    this.files = new Map(); // 'LIBRARY/saves/x.json' -> text
    this.dirs = new Set(['LIBRARY', 'DOCUMENTS', 'CACHE']);
    this.calls = [];
    this.delay = {}; // method -> ms (a slow device)
  }

  async attach(ctx) {
    await ctx.exposeFunction('__capNative', (plugin, method, options) => this.native(plugin, method, options));
    await ctx.addInitScript(CAP_INIT);
  }

  read(path) {
    return this.files.get(`LIBRARY/${path}`);
  }

  list(path) {
    const dir = `LIBRARY/${path}`;
    return [...this.files.keys()].filter((f) => f.slice(0, f.lastIndexOf('/')) === dir).map((f) => f.slice(dir.length + 1)).sort();
  }

  async native(plugin, method, o) {
    this.calls.push(`${plugin}.${method}`);
    if (plugin !== 'Filesystem') return {};
    if (this.delay[method]) await new Promise((r) => setTimeout(r, this.delay[method]));
    const full = (path, dir) => `${dir ?? 'DOCUMENTS'}/${String(path).replace(/^\/+|\/+$/g, '')}`;
    const parent = (p) => p.slice(0, p.lastIndexOf('/'));
    const mkdirs = (p) => p.split('/').forEach((_, i, a) => this.dirs.add(a.slice(0, i + 1).join('/')));
    const p = full(o.path, o.directory);
    switch (method) {
      case 'readdir':
        if (!this.dirs.has(p)) throw new Error(`Folder does not exist: ${p}`);
        return {
          files: [
            ...[...this.files.keys()].filter((f) => parent(f) === p).map((f) => ({ name: f.slice(p.length + 1), type: 'file' })),
            ...[...this.dirs].filter((d) => parent(d) === p).map((d) => ({ name: d.slice(p.length + 1), type: 'directory' })),
          ],
        };
      case 'readFile':
        if (!this.files.has(p)) throw new Error(`File does not exist: ${p}`);
        return { data: this.files.get(p) };
      case 'writeFile':
        if (!this.dirs.has(parent(p))) {
          if (!o.recursive) throw new Error(`Parent folder missing: ${p}`);
          mkdirs(parent(p));
        }
        this.files.set(p, String(o.data));
        return { uri: `file:///${p}` };
      case 'mkdir':
        if (this.dirs.has(p)) throw new Error(`Directory exists: ${p}`);
        mkdirs(p);
        return {};
      case 'rename': {
        const from = full(o.from, o.directory);
        const to = full(o.to, o.toDirectory ?? o.directory);
        if (!this.files.has(from)) throw new Error(`File does not exist: ${from}`);
        if (!this.dirs.has(parent(to))) throw new Error(`Parent folder missing: ${to}`);
        this.files.set(to, this.files.get(from));
        if (from !== to) this.files.delete(from);
        return {};
      }
      default:
        throw new Error(`not in the fake: Filesystem.${method}`);
    }
  }
}

// The App plugin's event (pause: the app sent to the background; resume: back), as the shell sends it.
export const appEvent = (page, name) =>
  page.evaluate((name) => {
    for (const cb of window.__capListeners[`App.${name}`] ?? []) cb(undefined);
    return (window.__capListeners[`App.${name}`] ?? []).length;
  }, name);
