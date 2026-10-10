import '@fontsource/bungee/latin-400.css';
import '@fontsource/permanent-marker/latin-400.css';
import '@fontsource/lilita-one/latin-400.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-900.css';
import '@fontsource/silkscreen/latin-400.css';
import './style.css';

import { checkCampaign, onAchievement, syncAchievements } from './achievements';
import { audio } from './audio';
import { CITIES } from './game/cities';
import type { CityDef } from './game/cities';
import { DEFAULT_MODS } from './game/defs';
import { createGame } from './game/state';
import type { GameState } from './game/state';
import { iconUrl } from './render/icons';
import { GameSession } from './session';
import { citySlot, clearSlot, lastPlayed, loadGame, loadSettings, slotMeta } from './storage';
import type { Settings, SlotId } from './storage';
import { openModeChooser, openSettings, openSlots } from './ui/dialogs';
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

const app = document.getElementById('app')!;
app.innerHTML = `
  <section class="screen menu" id="menu"></section>
  <section class="screen region" id="region" hidden></section>
  <section class="screen game" id="game" hidden></section>
  <section class="screen quit" id="quit" hidden>
    <p class="hand">See you tomorrow,<br />scrapper.</p>
    <p>You can close this tab now.</p>
    <button type="button" class="btn btn-primary" data-back>Back to the menu</button>
  </section>
  <div id="modal-root"></div>
  <div class="toasts" id="toasts" aria-live="polite"></div>
  <div class="crt" aria-hidden="true"></div>
`;

let settings = loadSettings();
let session: GameSession | null = null;

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
  menu.show();
}

function showRegion(): void {
  hideScreens();
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
      title: 'Could not load',
      body: '<p>This save is missing or was made by an older build. Start a new city or pick another slot.</p>',
      actions: [{ label: 'OK', primary: true, onClick: closeModal }],
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
    <label for="ng-name">City name</label>
    <input id="ng-name" type="text" maxlength="24" value="Scrapbot City" autocomplete="off" />
    <label for="ng-seed">Map seed</label>
    <input id="ng-seed" type="number" min="0" max="999999" value="${seed}" />
    <p class="fine">The same seed always builds the same landfills.</p>`;
  const start = () => {
    const name = (body.querySelector('#ng-name') as HTMLInputElement).value.trim() || 'Scrapbot City';
    const s = Number((body.querySelector('#ng-seed') as HTMLInputElement).value) || seed;
    const go = () => startSession(createGame({ seed: s, cityName: name }), true);
    // free play has one autosave: never replace a city without asking
    const old = slotMeta('auto');
    if (!old) return go();
    openModal({
      title: 'Replace your city?',
      body: `<p>Your free play autosave (<b>${esc(old.city)}</b>, day ${old.day}) will be replaced by the new city. Save it to a slot first if you want to keep it.</p>`,
      actions: [
        { label: 'Start the new city', primary: true, onClick: go },
        { label: 'Back', onClick: () => freePlayDialog() },
      ],
    });
  };
  body.addEventListener('submit', (e) => {
    e.preventDefault();
    start();
  });
  openModal({
    title: 'Free play',
    eyebrow: 'Trash today, a better tomorrow',
    body,
    actions: [
      { label: 'Start building', primary: true, onClick: start },
      { label: 'Back', onClick: () => openModeChooser(modeHandlers) },
    ],
  });
}

function startTutorial(): void {
  const mods = { ...DEFAULT_MODS, startRes: { scrap: 0, parts: 60, credits: 250 } };
  startSession(createGame({ seed: 4242, cityName: 'Training Yard', tutorial: true, mods }), false);
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
  const t = toastQueue.shift();
  if (!t) {
    toastBusy = false;
    return;
  }
  toastBusy = true;
  audio.play('done');
  const root = document.getElementById('toasts')!;
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span class="toast-ico"><img src="${iconUrl(t.icon, 2)}" alt="" /></span><span><small>${t.title}</small><b>${t.text}</b></span>`;
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
  onQuit: () =>
    openModal({
      title: 'Quit Scrapbot City?',
      body: '<p>Your cities are saved automatically.</p>',
      actions: [
        {
          label: 'Quit',
          primary: true,
          onClick: () => {
            if (desktop) {
              desktop.quit();
              return;
            }
            hideScreens();
            document.getElementById('quit')!.hidden = false;
          },
        },
        { label: 'Stay', onClick: closeModal },
      ],
    }),
});

const region = new RegionMap(document.getElementById('region')!, {
  onPlay: (city, restart) => playCity(city, restart),
  onBack: () => backToMenu(),
});

document.querySelector('#quit [data-back]')!.addEventListener('click', () => backToMenu());

onAchievement((a) => showToast('Achievement unlocked', a.name, a.icon));

applySettings(settings);
if (desktop && settings.fullscreen) desktop.setFullscreen(true);
syncAchievements();
checkCampaign();
menu.show();
