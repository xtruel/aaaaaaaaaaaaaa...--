import '@fontsource/bungee/latin-400.css';
import '@fontsource/permanent-marker/latin-400.css';
import '@fontsource/lilita-one/latin-400.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-900.css';
import '@fontsource/silkscreen/latin-400.css';
import './style.css';

import { audio } from './audio';
import { createGame } from './game/state';
import { GameSession } from './session';
import { loadGame, loadSettings, slotMeta } from './storage';
import type { Settings, SlotId } from './storage';
import { openSettings, openSlots } from './ui/dialogs';
import { MainMenu } from './ui/menu';
import { closeModal, openModal } from './ui/modal';

const app = document.getElementById('app')!;
app.innerHTML = `
  <section class="screen menu" id="menu"></section>
  <section class="screen game" id="game" hidden></section>
  <section class="screen quit" id="quit" hidden>
    <p class="hand">See you tomorrow,<br />scrapper.</p>
    <p>You can close this tab now.</p>
    <button type="button" class="btn btn-primary" data-back>Back to the menu</button>
  </section>
  <div id="modal-root"></div>
  <div class="crt" aria-hidden="true"></div>
`;

let settings = loadSettings();
let session: GameSession | null = null;

function applySettings(next: Settings): void {
  settings = next;
  audio.setVolumes(next.sfx, next.music);
  document.body.classList.toggle('crt-on', next.crt);
  document.body.classList.toggle('reduce-motion', next.reducedMotion);
  menu.setReducedMotion(next.reducedMotion);
  session?.applySettings(next);
}

function startSession(state: ReturnType<typeof createGame>, intro: boolean): void {
  closeModal();
  session?.dispose();
  menu.hide();
  document.getElementById('quit')!.hidden = true;
  session = new GameSession(document.getElementById('game')!, state, settings, {
    onExitToMenu: () => backToMenu(),
    onLoadSlot: (slot) => loadSlot(slot),
    onNewGame: () => newGameDialog(),
    onSettingsChanged: (s) => applySettings(s),
  });
  session.start(intro);
}

function backToMenu(): void {
  closeModal();
  session?.dispose();
  session = null;
  document.getElementById('quit')!.hidden = true;
  menu.show();
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

function newGameDialog(): void {
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
    startSession(createGame(s, name), true);
  };
  body.addEventListener('submit', (e) => {
    e.preventDefault();
    start();
  });
  openModal({
    title: 'New city',
    eyebrow: 'Trash today, a better tomorrow',
    body,
    actions: [
      { label: 'Start building', primary: true, onClick: start },
      { label: 'Back', onClick: closeModal },
    ],
  });
}

const menu = new MainMenu(document.getElementById('menu')!, {
  onNewGame: () => newGameDialog(),
  onContinue: () => {
    if (slotMeta('auto')) loadSlot('auto');
  },
  onLoadGame: () => openSlots('load', { onLoad: (slot) => loadSlot(slot) }),
  onSettings: () => openSettings((s) => applySettings(s)),
  onQuit: () =>
    openModal({
      title: 'Quit Scrapbot City?',
      body: '<p>Your last autosave stays in this browser.</p>',
      actions: [
        {
          label: 'Quit',
          primary: true,
          onClick: () => {
            closeModal();
            menu.hide();
            document.getElementById('quit')!.hidden = false;
            // Works inside a desktop wrapper (Electron/Tauri); browsers ignore it for normal tabs.
            window.close();
          },
        },
        { label: 'Stay', onClick: closeModal },
      ],
    }),
});

document.querySelector('#quit [data-back]')!.addEventListener('click', () => backToMenu());

applySettings(settings);
menu.show();
