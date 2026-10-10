// Dialogs shared by the main menu and the in-game pause menu.
import { ACHIEVEMENTS, unlockedAchievements } from '../achievements';
import { audio } from '../audio';
import { BANK_FEE, loadCampaign, sendToBank, withdrawFromBank } from '../campaign';
import { BUILDINGS, PATH_LABEL } from '../game/defs';
import type { Hint } from '../game/hints';
import type { GameState, OutcomeKind } from '../game/state';
import { ENDINGS, SPEAKERS, endingText } from '../game/story';
import type { StoryEvent } from '../game/story';
import { buildingThumb, iconUrl, portraitUrl } from '../render/icons';
import { SLOTS, isTutorialDone, loadSettings, saveGame, saveSettings, slotMeta, unlockedEndings } from '../storage';
import type { Settings, SlotId } from '../storage';
import { esc } from './escape';
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
    <label class="check" for="set-full"><input id="set-full" type="checkbox" ${settings.fullscreen ? 'checked' : ''} /> Fullscreen (F11)</label>
  `;
  const read = (): Settings => ({
    sfx: Number((body.querySelector('#set-sfx') as HTMLInputElement).value),
    music: Number((body.querySelector('#set-music') as HTMLInputElement).value),
    crt: (body.querySelector('#set-crt') as HTMLInputElement).checked,
    edgeScroll: (body.querySelector('#set-edge') as HTMLInputElement).checked,
    reducedMotion: (body.querySelector('#set-motion') as HTMLInputElement).checked,
    fullscreen: (body.querySelector('#set-full') as HTMLInputElement).checked,
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
        ? `<div><b>${label}</b><span>${esc(meta.city)} · Day ${meta.day} · ${meta.pop} citizens · ${pathName(meta.alignment)} path</span><small>${new Date(meta.savedAt).toLocaleString()}</small></div>`
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
        <dt>Prototype build</dt><dd>Version 0.4 · Pixel Planet Initiative</dd>
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
        <p>${open ? endingText(k, 'your city') : 'Finish a city to unlock this ending.'}</p>
      </div>`;
    })
    .join('');
  const got = unlockedAchievements();
  const achievements = ACHIEVEMENTS.map(
    (a) => `<li class="ach ${got.includes(a.id) ? 'got' : ''}">
      <span class="ach-ico"><img src="${iconUrl(a.icon, 2)}" alt="" /></span>
      <span><b>${a.name}</b><small>${a.desc}</small></span>
    </li>`,
  ).join('');
  openModal({
    title: 'Extras',
    eyebrow: `Endings ${unlocked.length}/4 · Achievements ${got.length}/${ACHIEVEMENTS.length}`,
    wide: true,
    body: `
      <div class="ending-grid">${cards}</div>
      <h3 class="extras-h">Achievements</h3>
      <ul class="ach-grid">${achievements}</ul>
      <h3 class="extras-h">How to play</h3>
      <ul class="howto">
        <li>Scrap bots collect junk on their own and bring it to the HQ or a Bot Dock.</li>
        <li>Turn scrap into <b>parts</b> (Recycler) or <b>credits</b> (Smelter). Spend both to build.</li>
        <li>Bot Pods bring citizens: they pay taxes and throw away junk, which your bots collect again.</li>
        <li>Industrial buildings pay more but raise the smog. Above 95% smog for 30 seconds the city is lost.</li>
        <li>Short on parts? The <b>+</b> next to parts imports them from 2PM for credits.</li>
        <li>Every build and every choice moves you along the path meter. Finish the Scrap Spire to see where it leads.</li>
        <li>Stuck? The light bulb asks USA-9 what to do next. Three hints per city are free.</li>
      </ul>
      <h3 class="extras-h">Controls</h3>
      <ul class="howto keys">
        <li><kbd>WASD</kbd> / arrows / drag: move the camera</li>
        <li>Mouse wheel, pinch or <kbd>+</kbd> / <kbd>-</kbd>: zoom · <kbd>H</kbd>: back to the HQ</li>
        <li><kbd>1</kbd>–<kbd>0</kbd>: pick a building · <kbd>M</kbd>: Scrap Spire · <kbd>X</kbd>: bulldoze · right click: cancel</li>
        <li><kbd>Space</kbd>: pause · <kbd>Tab</kbd>: change speed · <kbd>Q</kbd>: hint · <kbd>Esc</kbd>: menu</li>
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

export interface ModeHandlers {
  onCampaign(): void;
  onFreePlay(): void;
  onTutorial(): void;
}

export function openModeChooser(h: ModeHandlers): void {
  const learn = !isTutorialDone();
  const body = el('div', 'modes');
  body.innerHTML = `
    <button type="button" class="mode mode-campaign" data-mode="campaign">
      <span class="mode-art"><img src="${buildingThumb('spire')}" alt="" /></span>
      <span class="mode-text"><b>Campaign</b><small>Five cities on the Scrap Coast, each with its own rules. 15 stars to earn.</small></span>
    </button>
    <button type="button" class="mode mode-free" data-mode="free">
      <span class="mode-art"><img src="${buildingThumb('pods')}" alt="" /></span>
      <span class="mode-text"><b>Free play</b><small>One city, your name, any map seed. Build at your own pace.</small></span>
    </button>
    <button type="button" class="mode mode-tutorial" data-mode="tutorial">
      ${learn ? '<span class="mode-badge">Start here</span>' : ''}
      <span class="mode-art"><img src="${portraitUrl('usa')}" alt="" /></span>
      <span class="mode-text"><b>Tutorial</b><small>USA-9 shows you the ropes in about five minutes.</small></span>
    </button>`;
  body.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) =>
    b.addEventListener('click', () => {
      audio.play('click');
      const mode = b.dataset.mode;
      if (mode === 'campaign') h.onCampaign();
      else if (mode === 'free') h.onFreePlay();
      else h.onTutorial();
    }),
  );
  openModal({ title: 'New game', eyebrow: 'Pick how to play', body, wide: true });
}

export function openHint(hint: Hint, footer: string, onShow?: () => void): void {
  openModal({
    title: hint.title,
    eyebrow: 'USA-9 · Hint',
    portrait: portraitUrl('usa'),
    className: 'modal-story speaker-usa',
    body: `<p class="story">${hint.text}</p><p class="fine">${footer}</p>`,
    actions: [
      ...(hint.build && onShow ? [{ label: `Build ${BUILDINGS[hint.build].name}`, primary: true, onClick: onShow }] : []),
      { label: 'Thanks!', primary: !hint.build, onClick: closeModal },
    ],
  });
}

export function openHintPay(price: number, canPay: boolean, onPay: () => void): void {
  openModal({
    title: 'Out of free hints',
    eyebrow: 'USA-9 · Hint',
    portrait: portraitUrl('usa'),
    className: 'modal-story speaker-usa',
    body: `<p class="story">My free advice is used up for now. A fresh free hint comes back every 5 days. Or you can pay for some overtime: <b>${price} credits</b>, and the price goes up each time.</p>`,
    actions: [
      { label: canPay ? `Pay ${price} credits` : `Need ${price} credits`, primary: true, disabled: !canPay, onClick: onPay },
      { label: 'Not now', onClick: closeModal },
    ],
  });
}

export function openTrade(s: GameState, onChange: () => void): void {
  const body = el('div', 'trade');
  const render = () => {
    const c = loadCampaign();
    const row = (res: 'credits' | 'parts', amounts: number[]) => `
      <div class="trade-row">
        <span class="trade-res"><img src="${iconUrl(res)}" alt="" />${res === 'credits' ? 'Credits' : 'Parts'}</span>
        <span class="trade-have">City <b>${Math.floor(s.res[res])}</b></span>
        <span class="trade-have">Bank <b>${Math.floor(c.bank[res])}</b></span>
        <span class="trade-btns">
          ${amounts.map((a) => `<button type="button" class="btn" data-send="${res}:${a}" ${s.res[res] < a ? 'disabled' : ''}>Send ${a}</button>`).join('')}
          ${amounts.map((a) => `<button type="button" class="btn tone-neutral" data-take="${res}:${a}" ${c.bank[res] < 1 ? 'disabled' : ''}>Take ${a}</button>`).join('')}
        </span>
      </div>`;
    body.innerHTML = `
      <p>The cargo blimp carries credits and parts between the cities of the Scrap Coast. It keeps ${Math.round(BANK_FEE * 100)}% of what you send as fuel.</p>
      ${row('credits', [100, 500])}
      ${row('parts', [20, 100])}`;
    body.querySelectorAll<HTMLButtonElement>('[data-send]').forEach((b) =>
      b.addEventListener('click', () => {
        const [res, amt] = b.dataset.send!.split(':');
        const got = sendToBank(s, res as 'credits' | 'parts', Number(amt));
        audio.play(got > 0 ? 'coin' : 'error');
        onChange();
        render();
      }),
    );
    body.querySelectorAll<HTMLButtonElement>('[data-take]').forEach((b) =>
      b.addEventListener('click', () => {
        const [res, amt] = b.dataset.take!.split(':');
        const got = withdrawFromBank(s, res as 'credits' | 'parts', Number(amt));
        audio.play(got > 0 ? 'coin' : 'error');
        onChange();
        render();
      }),
    );
  };
  render();
  openModal({
    title: 'Cargo blimp',
    eyebrow: 'Region bank',
    wide: true,
    body,
    actions: [{ label: 'Done', primary: true, onClick: closeModal }],
  });
}
