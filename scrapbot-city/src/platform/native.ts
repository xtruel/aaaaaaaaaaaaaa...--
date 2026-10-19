// The App Store build: the same single-file game inside a native iOS shell (Capacitor 8: capacitor.config.ts, ios/,
// docs/APPSTORE.md). Everything here is inert unless the page runs in that shell, on iOS (window.Capacitor of the
// shell, isNativePlatform() and getPlatform() 'ios'): on the web and on the desktop startNative only calls boot, and
// nothing is put on window.
//
// In the shell, window.Capacitor is the bridge the native side injects before the page loads; the plugins are called
// through it the way @capacitor/core's own plugin proxies call them on iOS (nativePromise, and nativeCallback for
// listeners). @capacitor/core itself is not imported: it would put a window.Capacitor in the web and desktop builds.
import { setTouchMode } from '../input';
import { PREFIX, setKeyMirror } from '../storage';
import { SaveMirror } from './mirror';

interface Bridge {
  isNativePlatform?(): boolean;
  getPlatform?(): string;
  nativePromise?(plugin: string, method: string, options?: object): Promise<unknown>;
  nativeCallback?(plugin: string, method: string, options: object, callback: (data: unknown, error?: unknown) => void): unknown;
}

function iosBridge(): Bridge | null {
  if (typeof window === 'undefined') return null;
  try {
    const cap = (window as unknown as { Capacitor?: Bridge }).Capacitor;
    return cap?.isNativePlatform?.() === true && cap.getPlatform?.() === 'ios' && typeof cap.nativePromise === 'function' ? cap : null;
  } catch {
    return null;
  }
}

const bridge = iosBridge();

// True only in the iOS app.
export const nativeIOS = bridge !== null;

// Restoring the saves takes well under a second; past this the game starts without the copy (nothing is lost: the
// files stay as they are for the next launch, see SaveMirror.abandon).
const RESTORE_TIMEOUT_MS = 10000;

const call = (plugin: string, method: string, options: object = {}): Promise<unknown> => bridge!.nativePromise!(plugin, method, options);

function listen(plugin: string, event: string, fn: () => void): void {
  try {
    bridge?.nativeCallback?.(plugin, 'addListener', { eventName: event }, (_data, error) => {
      if (!error) fn();
    });
  } catch {
    // no events from the shell: the page's own visibilitychange still pauses the game and saves it
  }
}

const lifecycle = new Set<{ pause: () => void; resume: () => void }>();

// The iOS app sent to the background (pause) and back (resume), from the shell's App plugin. Returns the function that
// stops listening. Nothing is called on the web or on the desktop.
export function onAppPause(pause: () => void, resume: () => void): () => void {
  if (!bridge) return () => undefined;
  const entry = { pause, resume };
  lifecycle.add(entry);
  return () => {
    lifecycle.delete(entry);
  };
}

let mirror: SaveMirror | null = null;

// A touch screen and no mouse or trackpad attached (a pointing device on an iPad, or the Mac, reports a fine pointer).
function touchOnly(): boolean {
  try {
    return navigator.maxTouchPoints > 0 && !window.matchMedia('(any-pointer: fine)').matches;
  } catch {
    return false;
  }
}

async function restoreSaves(): Promise<void> {
  const m = new SaveMirror((method, options) => call('Filesystem', method, options), window.localStorage, PREFIX);
  let timer = 0;
  const late = new Promise<null>((resolve) => (timer = window.setTimeout(() => resolve(null), RESTORE_TIMEOUT_MS)));
  const report = await Promise.race([m.restore().catch(() => null), late]);
  window.clearTimeout(timer);
  // (given up: the game's writes still get their sequence numbers, no file is touched until the next launch)
  if (!report) m.abandon();
  mirror = m;
  setKeyMirror(m);
}

// Starts the game: at once on the web and on the desktop; in the iOS app once the saves are back from their copy in
// files (before the game reads any of them), with the app's look and lifecycle set up first.
export function startNative(boot: () => void): void {
  if (!bridge) {
    boot();
    return;
  }
  document.documentElement.classList.add('ios-app');
  // no page zoom: two fingers zoom the map (src/session.ts), never the page
  document.querySelector('meta[name="viewport"]')?.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
  // a finger is the only input: every text names the touch controls from the first screen (a mouse or a trackpad
  // still switches to the mouse wordings as it moves, src/input.ts)
  if (touchOnly()) setTouchMode(true);
  // (Info.plist hides it from the launch on: this keeps it hidden)
  void call('StatusBar', 'hide').catch(() => undefined);
  // the app sent to the background: the game saves and pauses as for a hidden tab, and the copy in files is brought
  // up to date (every write starts at once; this tries again any that failed)
  listen('App', 'pause', () => {
    for (const l of lifecycle) l.pause();
    void mirror?.flush();
  });
  listen('App', 'resume', () => {
    for (const l of lifecycle) l.resume();
    void mirror?.flush();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) void mirror?.flush();
  });
  let started = false;
  const go = (): void => {
    if (started) return;
    started = true;
    boot();
  };
  void restoreSaves().then(go, go);
}
