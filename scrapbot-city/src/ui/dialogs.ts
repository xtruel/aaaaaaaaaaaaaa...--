// Dialogs shared by the main menu and the in-game pause menu.
import { audio } from '../audio';
import { PATH_LABEL } from '../game/defs';
import type { GameState, OutcomeKind } from '../game/state';
import { ENDINGS, SPEAKERS } from '../game/story';
import type { StoryEvent } from '../game/story';
import { portraitUrl } from '../render/icons';
import { SLOTS, loadSettings, saveGame, saveSettings, slotMeta, unlockedEndings } from '../storage';
import type { Settings, SlotId } from '../storage';
import { closeModal, openModal } from './modal';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
}

function pathName(alignment: number): string {
  if (alignment >= 35) return 'Green';
  if (alignment <= -35) return 'Industrial';
  return 'Balanced';
}

export function openSettings(onChange: (s: Settings) => void, onBack?: () => void): void {
  const settings = loadSettings();
  const body = el('form', 'settings-form');
  body.innerHTML = `
    <label for="set-sfx">Sound effects <output data-out="sfx"></output></label>
    <input id="set-sfx" type="range" min="0" max="1" step="0.05" value="${settings.sfx}" />
    <label for="set-music">Music <output data-out="music"></output></label>
    <input id="set-music" type="range" min="0" max="1" step="0.05" value="${settings.music}" />
    <label class="check" for="set-crt"><input id="set-crt" type="checkbox" ${settings.crt ? 'checked' : ''} /> CRT scanlines</label>
    <label class="check" for="set-edge"><input id="set-edge" type="checkbox" ${settings.edgeScroll ? 'checked' : ''} /> Scroll the map at screen edges</label>
    <label class="check" for="set-motion"><input id="set-motion" type="checkbox" ${settings.reducedMotion ? 'checked' : ''} /> Reduce motion</label>
  `;
  const read = (): Settings => ({
    sfx: Number((body.querySelector('#set-sfx') as HTMLInputElement).value),
    music: Number((body.querySelector('#set-music') as HTMLInputElement).value),
    crt: (body.querySelector('#set-crt') as HTMLInputElement).checked,
    edgeScroll: (body.querySelector('#set-edge') as HTMLInputElement).checked,
    reducedMotion: (body.querySelector('#set-motion') as HTMLInputElement).checked,
  });
  const sync = () => {
    const s = read();
    body.querySelector('[data-out="sfx"]')!.textContent = `${Math.round(s.sfx * 100)}%`;
    body.querySelector('[data-out="music"]')!.textContent = `${Math.round(s.music * 100)}%`;
    saveSettings(s);
    onChange(s);
  };
  body.addEventListener('input', sync);
  body.addEventListener('change', () => audio.play('click'));
  body.addEventListener('submit', (e) => e.preventDefault());
  openModal({
    title: 'Settings',
    eyebrow: 'Options',
    body,
    actions: [{ label: 'Done', primary: true, onClick: () => (onBack ? onBack() : closeModal()) }],
  });
  sync();
}

export function openSlots(mode: 'save' | 'load', opts: { state?: GameState; onLoad?: (slot: SlotId) => void; onBack?: () => void }): void {
  const body = el('div', 'slots');
  const render = () => {
    body.innerHTML = '';
    for (const slot of SLOTS) {
      if (mode === 'save' && slot === 'auto') continue;
      const meta = slotMeta(slot);
      const row = el('div', 'slot');
      const label = slot === 'auto' ? 'Autosave' : `Slot ${slot}`;
      row.innerHTML = meta
        ? `<div><b>${label}</b><span>${meta.city} · Day ${meta.day} · ${meta.pop} citizens · ${pathName(meta.alignment)} path</span><small>${new Date(meta.savedAt).toLocaleString()}</small></div>`
        : `<div><b>${label}</b><span class="empty">Empty</span></div>`;
      const btn = el('button', 'btn btn-primary', mode === 'save' ? (meta ? 'Overwrite' : 'Save') : 'Load');
      btn.type = 'button';
      btn.disabled = mode === 'load' && !meta;
      btn.addEventListener('click', () => {
        audio.play('click');
        if (mode === 'save' && opts.state) {
          const ok = saveGame(slot, opts.state);
          audio.play(ok ? 'done' : 'error');
          if (!ok) row.querySelector('span')!.textContent = 'Saving failed: browser storage is blocked or full.';
          else render();
        } else if (mode === 'load') {
          opts.onLoad?.(slot);
        }
      });
      row.append(btn);
      body.append(row);
    }
  };
  render();
  openModal({
    title: mode === 'save' ? 'Save game' : 'Load game',
    eyebrow: 'Memory cards',
    body,
    actions: opts.onBack ? [{ label: 'Back', onClick: opts.onBack }] : undefined,
  });
}

export function openCredits(): void {
  openModal({
    title: 'Credits',
    eyebrow: 'Qwerty3D Games',
    body: `
      <dl class="credits">
        <dt>Game design &amp; art direction</dt><dd>Qwerty3D Games</dd>
        <dt>Prototype build</dt><dd>Version 0.3 · Pixel Planet Initiative</dd>
        <dt>Music &amp; sound</dt><dd>Procedural chiptune, synthesized live</dd>
        <dt>Fonts</dt><dd>Bungee, Lilita One, Nunito, Silkscreen, Permanent Marker (SIL Open Font License)</dd>
        <dt>Head of morale</dt><dd>Miso the cat</dd>
      </dl>
      <p class="fine">© 2026 Qwerty3D. All rights reserved.</p>`,
    actions: [{ label: 'Back', primary: true, onClick: closeModal }],
  });
}

export function openExtras(): void {
  const unlocked = unlockedEndings();
  const kinds: OutcomeKind[] = ['green', 'balanced', 'industrial', 'smog'];
  const cards = kinds
    .map((k) => {
      const e = ENDINGS[k];
      const open = unlocked.includes(k);
      return `<div class="ending-card ${open ? 'open' : 'locked'} ending-${k}">
        <small>${e.subtitle}</small>
        <b>${open ? e.title : '???'}</b>
        <p>${open ? e.text : 'Finish a city to unlock this ending.'}</p>
      </div>`;
    })
    .join('');
  openModal({
    title: 'Extras',
    eyebrow: `Endings found: ${unlocked.length}/4`,
    wide: true,
    body: `
      <div class="ending-grid">${cards}</div>
      <h3 class="extras-h">How to play</h3>
      <ul class="howto">
        <li>Scrap bots collect junk on their own and bring it to the HQ or a Bot Dock.</li>
        <li>Turn scrap into <b>parts</b> (Recycler) or <b>credits</b> (Smelter). Spend both to build.</li>
        <li>Bot Pods bring citizens: they pay taxes and throw away junk, which your bots collect again.</li>
        <li>Industrial buildings pay more but raise the smog. Above 95% smog for 30 seconds the city is lost.</li>
        <li>Short on parts? The <b>+</b> next to parts imports them from 2PM for credits.</li>
        <li>Every build and every choice moves you along the path meter. Finish the Scrap Spire to see where it leads.</li>
      </ul>
      <h3 class="extras-h">Controls</h3>
      <ul class="howto keys">
        <li><kbd>WASD</kbd> / arrows / drag: move the camera</li>
        <li>Mouse wheel or <kbd>+</kbd> / <kbd>_</kbd>: zoom · <kbd>H</kbd>: back to the HQ</li>
        <li><kbd>1</kbd>–<kbd>0</kbd>, <kbd>-</kbd>: pick a building · <kbd>X</kbd>: bulldoze · right click: cancel</li>
        <li><kbd>Space</kbd>: pause · <kbd>Tab</kbd>: change speed · <kbd>Esc</kbd>: menu</li>
      </ul>`,
    actions: [{ label: 'Back', primary: true, onClick: closeModal }],
  });
}

export function openPathInfo(): void {
  openModal({
    title: 'Different futures, same city',
    eyebrow: 'Your choices',
    wide: true,
    body: `
      <div class="paths">
        <div class="path-col path-green"><b>${PATH_LABEL.green} path</b><p>Recycler, Solar Array, Pixel Garden, Fix-It Lab, Purifier. Slower money, cleaner air, happier citizens. Say no to 2PM's offers.</p></div>
        <div class="path-col path-industrial"><b>${PATH_LABEL.industrial} path</b><p>Smelter, Scrap Burner, 2PM Factory. Fast credits and cheap power, paid for in smog. Say yes to 2PM.</p></div>
      </div>
      <p>Every building and every story choice moves the path meter. When the Scrap Spire is finished, the meter decides which city you built: Green, Industrial, or something in between.</p>`,
    actions: [{ label: 'Got it', primary: true, onClick: closeModal }],
  });
}

export function openStoryEvent(ev: StoryEvent, s: GameState, onDone: (result: string) => void): void {
  const sp = SPEAKERS[ev.speaker];
  openModal({
    title: ev.title,
    eyebrow: `${sp.name} · ${sp.role}`,
    portrait: portraitUrl(ev.speaker),
    body: `<p class="story">${ev.text}</p>`,
    dismissable: false,
    className: `modal-story speaker-${ev.speaker}`,
    actions: ev.choices.map((c) => ({
      label: c.label,
      tone: c.path,
      disabled: c.available ? !c.available(s) : false,
      hint: c.path === 'neutral' ? undefined : `${PATH_LABEL[c.path]} choice`,
      onClick: () => onDone(c.apply(s)),
    })),
  });
}
