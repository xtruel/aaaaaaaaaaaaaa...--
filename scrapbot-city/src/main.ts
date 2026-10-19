import '@fontsource/bungee/latin-400.css';
import '@fontsource/permanent-marker/latin-400.css';
import '@fontsource/lilita-one/latin-400.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-900.css';
import '@fontsource/silkscreen/latin-400.css';
// accented letters for Polish, Portuguese and the other European languages
import '@fontsource/bungee/latin-ext-400.css';
import '@fontsource/lilita-one/latin-ext-400.css';
import '@fontsource/nunito/latin-ext-700.css';
import '@fontsource/nunito/latin-ext-900.css';
import '@fontsource/silkscreen/latin-ext-400.css';
import './fonts.css';
import './style.css';
// phones in landscape and other short windows (up to 500 px high): see the file's header
import './compact.css';

import { achName, checkCampaign, onAchievement, syncAchievements } from './achievements';
import { forgetCityTrades } from './campaign';
import { audio } from './audio';
import * as actions from './game/actions';
import { CITIES } from './game/cities';
import type { CityDef } from './game/cities';
import * as defs from './game/defs';
import { DEFAULT_MODS } from './game/defs';
import * as hints from './game/hints';
import { createGame } from './game/state';
import { initGamepad } from './gamepad';
import { initInputMode } from './input';
import { alignScanlines } from './ui/crt';
import { loadKeyboardLayout } from './keys';
import type { GameState } from './game/state';
import { lang, setLang, t } from './i18n';
import { iconUrl } from './render/icons';
import { GameSession } from './session';
import { citySlot, clearSlot, lastPlayed, loadGame, loadSettings, migrateToFiles, saveSettings, slotMeta } from './storage';
import type { Settings, SlotId } from './storage';
import { openLanguage, openModeChooser, openSettings, openSlots } from './ui/dialogs';
import { esc } from './ui/escape';
import { MainMenu } from './ui/menu';
import { closeModal, isModalOpen, openModal } from './ui/modal';
import { RegionMap } from './ui/region';

// Present only in the desktop (Electron) build, see electron/preload.cjs.
interface DesktopBridge {
  isDesktop: boolean;
  setFullscreen(on: boolean): void;
  onFullscreenChange?(fn: (on: boolean) => void): void;
  quit(): void;
}
const desktop = (window as unknown as { scrapbotDesktop?: DesktopBridge }).scrapbotDesktop;

migrateToFiles();
let settings = loadSettings();
let session: GameSession | null = null;
setLang(settings.lang);

const app = document.getElementById('app')!;
app.innerHTML = `
  <section class="screen menu" id="menu"></section>
  <section class="screen region" id="region" hidden></section>
  <section class="screen game" id="game" hidden></section>
  <section class="screen quit" id="quit" hidden></section>
  <div id="modal-root"></div>
  <div class="toasts" id="toasts" aria-live="polite"></div>
  <div class="crt" aria-hidden="true"></div>
`;

function renderQuitScreen(): void {
  const quit = document.getElementById('quit')!;
  quit.innerHTML = `
    <p class="hand">${esc(t('quit.bye'))}</p>
    <p>${esc(t('quit.closeTab'))}</p>
    <button type="button" class="btn btn-primary" data-back>${esc(t('quit.back'))}</button>`;
  quit.querySelector('[data-back]')!.addEventListener('click', () => backToMenu());
}

function setFullscreen(on: boolean): void {
  if (desktop) {
    desktop.setFullscreen(on);
    return;
  }
  try {
    if (on && !document.fullscreenElement) void document.documentElement.requestFullscreen?.().catch(() => undefined);
    if (!on && document.fullscreenElement) void document.exitFullscreen?.().catch(() => undefined);
  } catch {
    // fullscreen is optional: some embeds refuse it
  }
}

alignScanlines();
window.addEventListener('resize', alignScanlines);

function applySettings(next: Settings): void {
  const fullscreenChanged = next.fullscreen !== settings.fullscreen;
  settings = next;
  audio.setVolumes(next.sfx, next.music);
  document.body.classList.toggle('crt-on', next.crt);
  document.body.classList.toggle('reduce-motion', next.reducedMotion);
  menu.setReducedMotion(next.reducedMotion);
  session?.applySettings(next);
  if (fullscreenChanged) setFullscreen(next.fullscreen);
  if (next.lang !== lang()) relabel(next);
}

// Switching language rebuilds every screen's text in place: nothing is restarted or lost.
function relabel(next: Settings): void {
  setLang(next.lang);
  menu.render();
  region.relabel();
  session?.relabel();
  renderQuitScreen();
}

function pickLanguage(): void {
  openLanguage((l) => {
    closeModal();
    const next = { ...settings, lang: l };
    saveSettings(next);
    applySettings(next);
    // the menu was rebuilt in the new language: the language button keeps the focus
    const pill = document.querySelector<HTMLElement>('[data-lang-open]');
    if (pill?.offsetParent) pill.focus();
  });
}

function hideScreens(): void {
  closeModal();
  session?.dispose();
  session = null;
  menu.hide();
  region.hide();
  document.getElementById('quit')!.hidden = true;
}

function startSession(state: GameState, intro: boolean, fromSlot: SlotId | null = null): void {
  hideScreens();
  session = new GameSession(document.getElementById('game')!, state, settings, {
    onExitToMenu: () => backToMenu(),
    onLoadSlot: (slot) => loadSlot(slot),
    onNewGame: () => openModeChooser(modeHandlers),
    onRegionMap: () => showRegion(),
    onRestartCity: () => {
      const city = CITIES.find((c) => c.id === state.cityId);
      if (city) playCity(city, true);
    },
    onTutorialDone: (campaign) => (campaign ? showRegion() : backToMenu()),
    onSettingsChanged: (s) => applySettings(s),
  }, fromSlot);
  session.start(intro);
}

function backToMenu(): void {
  hideScreens();
  audio.setMusic('menu');
  menu.show();
}

function showRegion(): void {
  hideScreens();
  audio.setMusic('region');
  region.show();
}

function playCity(city: CityDef, restart: boolean): void {
  const slot = citySlot(city.id);
  if (restart) {
    clearSlot(slot);
    forgetCityTrades(city.id);
  }
  const saved = restart ? null : loadGame(slot);
  // a save that exists but cannot be read (damaged, or from a newer version) is never silently replaced
  if (!restart && !saved && slotMeta(slot)) {
    openModal({
      title: t('load.failed.title'),
      body: `<p>${t('load.failed.body')}</p>`,
      actions: [{ label: t('common.ok'), primary: true, onClick: closeModal }],
    });
    return;
  }
  const state = saved ?? createGame({ seed: city.seed, cityName: city.name, cityId: city.id, mods: city.mods });
  startSession(state, !saved);
}

function loadSlot(slot: SlotId): void {
  const state = loadGame(slot);
  if (!state) {
    openModal({
      title: t('load.failed.title'),
      body: `<p>${t('load.failed.body')}</p>`,
      actions: [{ label: t('common.ok'), primary: true, onClick: closeModal }],
    });
    return;
  }
  // a manual free play slot keeps receiving this city's autosaves (it never replaces the 'auto' city)
  startSession(state, false, slot === 'auto' || slot.startsWith('city-') ? null : slot);
}

function freePlayDialog(prevName = 'Scrapbot City', prevSeed = Math.floor(Math.random() * 1e6)): void {
  const seed = prevSeed;
  const body = document.createElement('form');
  body.className = 'newgame-form';
  body.innerHTML = `
    <label for="ng-name">${t('free.name')}</label>
    <input id="ng-name" type="text" maxlength="24" value="${esc(prevName)}" autocomplete="off" />
    <label for="ng-seed">${t('free.seed')}</label>
    <input id="ng-seed" type="number" min="0" max="999999" value="${seed}" />
    <p class="fine">${t('free.seedHint')}</p>
    <button type="submit" hidden></button>`;
  const start = () => {
    const name = (body.querySelector('#ng-name') as HTMLInputElement).value.trim() || 'Scrapbot City';
    // 0 is a valid seed: fall back to the random one only when the field is empty or not a number
    const raw = (body.querySelector('#ng-seed') as HTMLInputElement).value.trim();
    const s = raw !== '' && Number.isFinite(Number(raw)) ? Math.max(0, Math.floor(Number(raw))) : seed;
    const go = () => startSession(createGame({ seed: s, cityName: name }), true);
    // free play has one autosave: never replace a city without asking
    const old = slotMeta('auto');
    if (!old) return go();
    openModal({
      title: t('free.replace.title'),
      body: `<p>${t('free.replace.body', { city: esc(old.city), day: old.day })}</p>`,
      actions: [
        { label: t('free.replace.go'), primary: true, onClick: go },
        { label: t('common.back'), onClick: () => freePlayDialog(name, s) },
      ],
      onBack: () => freePlayDialog(name, s),
    });
  };
  body.addEventListener('submit', (e) => {
    e.preventDefault();
    start();
  });
  openModal({
    title: t('free.title'),
    eyebrow: t('free.eyebrow'),
    body,
    actions: [
      { label: t('free.start'), primary: true, onClick: start },
      { label: t('common.back'), onClick: () => openModeChooser(modeHandlers) },
    ],
    onBack: () => openModeChooser(modeHandlers),
  });
}

function startTutorial(): void {
  const mods = { ...DEFAULT_MODS, startRes: { scrap: 0, parts: 60, credits: 250 } };
  startSession(createGame({ seed: 4242, cityName: t('tut.city'), tutorial: true, mods }), false);
}

const modeHandlers = {
  onCampaign: () => showRegion(),
  onFreePlay: () => freePlayDialog(),
  onTutorial: () => startTutorial(),
};

// Achievements can unlock several at once: show them one after another. The same toast again while it shows or
// waits its turn is not queued twice: it shows once, with a count.
type Toast = { title: string; text: string; icon: Parameters<typeof iconUrl>[0]; count: number; el?: HTMLElement };
const toastQueue: Toast[] = [];
let toastNow: Toast | null = null;

function showToast(title: string, text: string, icon: Parameters<typeof iconUrl>[0]): void {
  const same = [toastNow, ...toastQueue].find((x) => x && x.title === title && x.text === text);
  if (same) {
    same.count++;
    const c = same.el?.querySelector('.toast-count');
    if (c) c.textContent = ` ×${same.count}`;
    return;
  }
  toastQueue.push({ title, text, icon, count: 1 });
  if (!toastNow) nextToast();
}

function nextToast(): void {
  const next = toastQueue.shift();
  toastNow = next ?? null;
  if (!next) return;
  audio.play('done');
  const root = document.getElementById('toasts')!;
  // over a dialog (an ending, a story event) the toast goes to the bottom, clear of the dialog's title
  root.classList.toggle('below', isModalOpen());
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span class="toast-ico"><img src="${iconUrl(next.icon, 2)}" alt="" /></span><span><small>${esc(next.title)}</small><b>${esc(next.text)}<span class="toast-count">${next.count > 1 ? ` ×${next.count}` : ''}</span></b></span>`;
  next.el = el;
  root.append(el);
  window.setTimeout(() => el.classList.add('out'), 2400);
  window.setTimeout(() => {
    el.remove();
    nextToast();
  }, 2900);
}

const menu = new MainMenu(document.getElementById('menu')!, {
  onNewGame: () => openModeChooser(modeHandlers),
  onContinue: () => {
    const slot = lastPlayed();
    if (slot) loadSlot(slot);
  },
  onLoadGame: () => openSlots('load', { onLoad: (slot) => loadSlot(slot) }),
  onSettings: () => openSettings(settings, (s) => applySettings(s)),
  onLanguage: () => pickLanguage(),
  onQuit: () =>
    openModal({
      title: t('quit.title'),
      body: `<p>${t('quit.body')}</p>`,
      actions: [
        {
          label: t('quit.quit'),
          primary: true,
          onClick: () => {
            if (desktop) {
              desktop.quit();
              return;
            }
            hideScreens();
            audio.setMusic(null);
            document.getElementById('quit')!.hidden = false;
          },
        },
        { label: t('quit.stay'), onClick: closeModal },
      ],
    }),
});

const region = new RegionMap(document.getElementById('region')!, {
  onPlay: (city, restart) => playCity(city, restart),
  onBack: () => backToMenu(),
});

renderQuitScreen();

onAchievement((a) => showToast(t('ach.toast'), achName(a), a.icon));

initInputMode();
initGamepad({
  target: () => session,
  onConnect: () => showToast(t('pad.connected'), t('pad.help'), 'play'),
  onDisconnect: () => showToast(t('pad.disconnected'), '', 'play'),
});

// Development server only (npm run dev): playtest scripts and the browser console can look inside the game.
if (import.meta.env.DEV) {
  Object.assign(window, { scrapbot: { session: () => session, actions, defs, hints } });
}

applySettings(settings);
if (desktop && settings.fullscreen) desktop.setFullscreen(true);

// Fullscreen can also change outside the settings (F11, the browser's Esc, window controls): follow it,
// so the checkbox and the next launch match what the player sees.
function fullscreenChanged(on: boolean): void {
  // an open Settings dialog shows it too, or its next change would re-apply the old checkbox
  const box = document.querySelector<HTMLInputElement>('#set-full');
  if (box) box.checked = on;
  if (on === settings.fullscreen) return;
  settings = { ...settings, fullscreen: on };
  saveSettings(settings);
  session?.applySettings(settings);
}
desktop?.onFullscreenChange?.(fullscreenChanged);
if (!desktop) document.addEventListener('fullscreenchange', () => fullscreenChanged(!!document.fullscreenElement));
syncAchievements();
checkCampaign();
void loadKeyboardLayout();
menu.show();
