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

import { achName, checkCampaign, onAchievement, syncAchievements } from './achievements';
import { audio } from './audio';
import * as actions from './game/actions';
import { CITIES } from './game/cities';
import type { CityDef } from './game/cities';
import * as defs from './game/defs';
import { DEFAULT_MODS } from './game/defs';
import * as hints from './game/hints';
import { createGame } from './game/state';
import { initGamepad } from './gamepad';
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
import { closeModal, openModal } from './ui/modal';
import { RegionMap } from './ui/region';

// Present only in the desktop (Electron) build, see electron/preload.cjs.
interface DesktopBridge {
  isDesktop: boolean;
  setFullscreen(on: boolean): void;
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

function startSession(state: GameState, intro: boolean): void {
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
  });
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
  if (restart) clearSlot(slot);
  const saved = restart ? null : loadGame(slot);
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
  startSession(state, false);
}

function freePlayDialog(): void {
  const seed = Math.floor(Math.random() * 1e6);
  const body = document.createElement('form');
  body.className = 'newgame-form';
  body.innerHTML = `
    <label for="ng-name">${t('free.name')}</label>
    <input id="ng-name" type="text" maxlength="24" value="Scrapbot City" autocomplete="off" />
    <label for="ng-seed">${t('free.seed')}</label>
    <input id="ng-seed" type="number" min="0" max="999999" value="${seed}" />
    <p class="fine">${t('free.seedHint')}</p>`;
  const start = () => {
    const name = (body.querySelector('#ng-name') as HTMLInputElement).value.trim() || 'Scrapbot City';
    const s = Number((body.querySelector('#ng-seed') as HTMLInputElement).value) || seed;
    const go = () => startSession(createGame({ seed: s, cityName: name }), true);
    // free play has one autosave: never replace a city without asking
    const old = slotMeta('auto');
    if (!old) return go();
    openModal({
      title: t('free.replace.title'),
      body: `<p>${t('free.replace.body', { city: esc(old.city), day: old.day })}</p>`,
      actions: [
        { label: t('free.replace.go'), primary: true, onClick: go },
        { label: t('common.back'), onClick: () => freePlayDialog() },
      ],
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

// Achievements can unlock several at once: show them one after another.
const toastQueue: { title: string; text: string; icon: Parameters<typeof iconUrl>[0] }[] = [];
let toastBusy = false;

function showToast(title: string, text: string, icon: Parameters<typeof iconUrl>[0]): void {
  toastQueue.push({ title, text, icon });
  if (!toastBusy) nextToast();
}

function nextToast(): void {
  const next = toastQueue.shift();
  if (!next) {
    toastBusy = false;
    return;
  }
  toastBusy = true;
  audio.play('done');
  const root = document.getElementById('toasts')!;
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span class="toast-ico"><img src="${iconUrl(next.icon, 2)}" alt="" /></span><span><small>${esc(next.title)}</small><b>${esc(next.text)}</b></span>`;
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
  onSettings: () => openSettings((s) => applySettings(s)),
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
syncAchievements();
checkCampaign();
void loadKeyboardLayout();
menu.show();
