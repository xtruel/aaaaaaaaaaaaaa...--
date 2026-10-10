// Dialogs shared by the main menu and the in-game pause menu.
import { ACHIEVEMENTS, achDesc, achName, unlockedAchievements } from '../achievements';
import { audio } from '../audio';
import { BANK_FEE, loadCampaign, sendToBank, withdrawFromBank } from '../campaign';
import { importParts } from '../game/actions';
import { IMPORT_PARTS } from '../game/defs';
import type { Hint } from '../game/hints';
import type { GameState, OutcomeKind } from '../game/state';
import { choiceLabel, endingSubtitle, endingText, endingTitle, eventText, eventTitle, speakerName, speakerRole } from '../game/story';
import type { StoryEvent } from '../game/story';
import { LANGS, bName, lang, t } from '../i18n';
import { localizeKeys } from '../keys';
import type { Key, Lang } from '../i18n';
import { buildingThumb, iconUrl, portraitUrl } from '../render/icons';
import { isTutorialDone, openSavesFolder, saveGame, saveSettings, slotMeta, SLOTS, unlockedEndings } from '../storage';
import type { Settings, SlotId } from '../storage';
import { esc } from './escape';
import { closeModal, openModal } from './modal';
import type { ModalAction } from './modal';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
}

function pathName(alignment: number): string {
  if (alignment >= 35) return t('path.green');
  if (alignment <= -35) return t('path.industrial');
  return t('path.balanced');
}

// Shows the settings in use (not a fresh read: with blocked storage that would show the defaults).
export function openSettings(current: Settings, onChange: (s: Settings) => void, onBack?: () => void): void {
  const settings = current;
  const body = el('form', 'settings-form');
  body.innerHTML = `
    <label for="set-lang">${t('settings.language')}</label>
    <select id="set-lang">${LANGS.map((l) => `<option value="${l.id}" ${l.id === lang() ? 'selected' : ''}>${l.name}</option>`).join('')}</select>
    <label for="set-sfx">${t('settings.sfx')} <output data-out="sfx"></output></label>
    <input id="set-sfx" type="range" min="0" max="1" step="0.05" value="${settings.sfx}" />
    <label for="set-music">${t('settings.music')} <output data-out="music"></output></label>
    <input id="set-music" type="range" min="0" max="1" step="0.05" value="${settings.music}" />
    <label class="check" for="set-crt"><input id="set-crt" type="checkbox" ${settings.crt ? 'checked' : ''} /> ${t('settings.crt')}</label>
    <label class="check" for="set-edge"><input id="set-edge" type="checkbox" ${settings.edgeScroll ? 'checked' : ''} /> ${t('settings.edge')}</label>
    <label class="check" for="set-motion"><input id="set-motion" type="checkbox" ${settings.reducedMotion ? 'checked' : ''} /> ${t('settings.motion')}</label>
    <label class="check" for="set-full"><input id="set-full" type="checkbox" ${settings.fullscreen ? 'checked' : ''} /> ${t('settings.fullscreen')}</label>
    ${openSavesFolder ? `<button type="button" class="btn btn-small" data-saves>${t('settings.openSaves')}</button>` : ''}
  `;
  body.querySelector('[data-saves]')?.addEventListener('click', () => {
    audio.play('click');
    openSavesFolder?.();
  });
  const read = (): Settings => ({
    sfx: Number((body.querySelector('#set-sfx') as HTMLInputElement).value),
    music: Number((body.querySelector('#set-music') as HTMLInputElement).value),
    crt: (body.querySelector('#set-crt') as HTMLInputElement).checked,
    edgeScroll: (body.querySelector('#set-edge') as HTMLInputElement).checked,
    reducedMotion: (body.querySelector('#set-motion') as HTMLInputElement).checked,
    fullscreen: (body.querySelector('#set-full') as HTMLInputElement).checked,
    lang: (body.querySelector('#set-lang') as HTMLSelectElement).value as Lang,
  });
  const outputs = (s: Settings) => {
    body.querySelector('[data-out="sfx"]')!.textContent = `${Math.round(s.sfx * 100)}%`;
    body.querySelector('[data-out="music"]')!.textContent = `${Math.round(s.music * 100)}%`;
  };
  const sync = () => {
    const s = read();
    outputs(s);
    saveSettings(s);
    const relabel = s.lang !== lang();
    onChange(s);
    // reopen in the new language, with the picker still focused
    if (relabel) {
      openSettings(s, onChange, onBack);
      document.getElementById('set-lang')?.focus();
    }
  };
  body.addEventListener('input', sync);
  body.addEventListener('change', () => audio.play('click'));
  body.addEventListener('submit', (e) => e.preventDefault());
  openModal({
    title: t('settings.title'),
    eyebrow: t('settings.eyebrow'),
    body,
    actions: [{ label: t('common.done'), primary: true, onClick: () => (onBack ? onBack() : closeModal()) }],
  });
  // opening only shows the values; nothing is saved or applied until the player changes something
  outputs(settings);
}

export function openLanguage(onPick: (l: Lang) => void): void {
  const body = el('div', 'langs');
  body.innerHTML = LANGS.map((l) => `<button type="button" class="lang-btn ${l.id === lang() ? 'active' : ''}" data-lang="${l.id}" lang="${l.id}">${l.name}</button>`).join('');
  body.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((b) =>
    b.addEventListener('click', () => {
      audio.play('click');
      onPick(b.dataset.lang as Lang);
    }),
  );
  openModal({ title: t('menu.language'), eyebrow: 'Language · Sprache · Langue · Idioma · Lingua · Język · Taal', body });
}

export function openSlots(mode: 'save' | 'load', opts: { state?: GameState; onLoad?: (slot: SlotId) => void; onBack?: () => void }): void {
  const body = el('div', 'slots');
  const render = () => {
    body.innerHTML = '';
    for (const slot of SLOTS) {
      if (mode === 'save' && slot === 'auto') continue;
      const meta = slotMeta(slot);
      const row = el('div', 'slot');
      const label = slot === 'auto' ? t('slots.auto') : t('slots.slot', { n: slot });
      row.innerHTML = meta
        ? `<div><b>${label}</b><span>${t('slots.meta', { city: esc(meta.city), day: meta.day, pop: meta.pop, path: pathName(meta.alignment) })}</span><small>${new Date(meta.savedAt).toLocaleString(lang())}</small></div>`
        : `<div><b>${label}</b><span class="empty">${t('slots.empty')}</span></div>`;
      const btn = el('button', 'btn btn-primary', mode === 'save' ? (meta ? t('slots.overwrite') : t('slots.doSave')) : t('slots.doLoad'));
      btn.type = 'button';
      btn.disabled = mode === 'load' && !meta;
      btn.addEventListener('click', () => {
        audio.play('click');
        if (mode === 'save' && opts.state) {
          const ok = saveGame(slot, opts.state);
          audio.play(ok ? 'done' : 'error');
          if (!ok) row.querySelector('span')!.textContent = t('slots.failed');
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
    title: mode === 'save' ? t('slots.save') : t('slots.load'),
    eyebrow: t('slots.eyebrow'),
    body,
    actions: opts.onBack ? [{ label: t('common.back'), onClick: opts.onBack }] : undefined,
  });
}

export function openCredits(): void {
  openModal({
    title: t('credits.title'),
    eyebrow: 'Qwerty3D Games',
    body: `
      <dl class="credits">
        <dt>${t('credits.design')}</dt><dd>Qwerty3D Games</dd>
        <dt>${t('credits.build')}</dt><dd>0.5.1 · Pixel Planet Initiative</dd>
        <dt>${t('credits.music')}</dt><dd>${t('credits.musicValue')}</dd>
        <dt>${t('credits.fonts')}</dt><dd>Bungee, Lilita One, Nunito, Silkscreen, Permanent Marker, DotGothic16 (SIL Open Font License)</dd>
        <dt>${t('credits.morale')}</dt><dd>${t('credits.moraleValue')}</dd>
      </dl>
      <p class="fine">${t('credits.rights')}</p>`,
    actions: [{ label: t('common.back'), primary: true, onClick: closeModal }],
  });
}

export function openExtras(): void {
  const unlocked = unlockedEndings();
  const kinds: OutcomeKind[] = ['green', 'balanced', 'industrial', 'smog'];
  const cards = kinds
    .map((k) => {
      const open = unlocked.includes(k);
      return `<div class="ending-card ${open ? 'open' : 'locked'} ending-${k}">
        <small>${endingSubtitle(k)}</small>
        <b>${open ? endingTitle(k) : '???'}</b>
        <p>${open ? endingText(k, t('end.yourCity')) : t('extras.locked')}</p>
      </div>`;
    })
    .join('');
  const got = unlockedAchievements();
  const achievements = ACHIEVEMENTS.map(
    (a) => `<li class="ach ${got.includes(a.id) ? 'got' : ''}">
      <span class="ach-ico"><img src="${iconUrl(a.icon, 2)}" alt="" /></span>
      <span><b>${achName(a)}</b><small>${achDesc(a)}</small></span>
    </li>`,
  ).join('');
  const list = (prefix: string, n: number) =>
    Array.from({ length: n }, (_, i) => `<li>${t(`${prefix}.${i + 1}` as Key)}</li>`).join('');
  openModal({
    title: t('extras.title'),
    eyebrow: t('extras.eyebrow', { e: unlocked.length, a: got.length, total: ACHIEVEMENTS.length }),
    wide: true,
    body: `
      <div class="ending-grid">${cards}</div>
      <h3 class="extras-h">${t('extras.achievements')}</h3>
      <ul class="ach-grid">${achievements}</ul>
      <h3 class="extras-h">${t('extras.howto')}</h3>
      <ul class="howto">${list('extras.howto', 7)}</ul>
      <h3 class="extras-h">${t('extras.controls')}</h3>
      <ul class="howto keys">${localizeKeys(list('extras.controls', 4))}<li>${t('extras.controls.pad')}</li><li>${t('extras.controls.pad2')}</li></ul>`,
    actions: [{ label: t('common.back'), primary: true, onClick: closeModal }],
  });
}

export function openPathInfo(): void {
  openModal({
    title: t('paths.title'),
    eyebrow: t('paths.eyebrow'),
    wide: true,
    body: `
      <div class="paths">
        <div class="path-col path-green"><b>${t('paths.green')}</b><p>${t('paths.green.desc')}</p></div>
        <div class="path-col path-industrial"><b>${t('paths.industrial')}</b><p>${t('paths.industrial.desc')}</p></div>
      </div>
      <p>${t('paths.footer')}</p>`,
    actions: [{ label: t('paths.ok'), primary: true, onClick: closeModal }],
  });
}

export function openStoryEvent(ev: StoryEvent, s: GameState, onDone: (result: string) => void): void {
  openModal({
    title: eventTitle(ev),
    eyebrow: `${speakerName(ev.speaker)} · ${speakerRole(ev.speaker)}`,
    portrait: portraitUrl(ev.speaker),
    body: `<p class="story">${eventText(ev)}</p>`,
    dismissable: false,
    className: `modal-story speaker-${ev.speaker}`,
    actions: ev.choices.map((c, i) => ({
      label: choiceLabel(ev, i),
      tone: c.path,
      disabled: c.available ? !c.available(s) : false,
      hint: c.path === 'green' ? t('path.choice.green') : c.path === 'industrial' ? t('path.choice.industrial') : undefined,
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
      <span class="mode-text"><b>${t('modes.campaign')}</b><small>${t('modes.campaign.desc')}</small></span>
    </button>
    <button type="button" class="mode mode-free" data-mode="free">
      <span class="mode-art"><img src="${buildingThumb('pods')}" alt="" /></span>
      <span class="mode-text"><b>${t('modes.free')}</b><small>${t('modes.free.desc')}</small></span>
    </button>
    <button type="button" class="mode mode-tutorial" data-mode="tutorial">
      ${learn ? `<span class="mode-badge">${t('modes.startHere')}</span>` : ''}
      <span class="mode-art"><img src="${portraitUrl('usa')}" alt="" /></span>
      <span class="mode-text"><b>${t('modes.tutorial')}</b><small>${t('modes.tutorial.desc')}</small></span>
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
  openModal({ title: t('modes.title'), eyebrow: t('modes.eyebrow'), body, wide: true });
}

export function openHint(hint: Hint, footer: string, onShow?: () => void): void {
  openModal({
    title: hint.title,
    eyebrow: t('hint.eyebrow'),
    portrait: portraitUrl('usa'),
    className: 'modal-story speaker-usa',
    body: `<p class="story">${hint.text}</p><p class="fine">${footer}</p>`,
    actions: [
      ...(hint.build && onShow ? [{ label: t('hint.build', { name: bName(hint.build) }), primary: true, onClick: onShow }] : []),
      { label: t('common.thanks'), primary: !hint.build, onClick: closeModal },
    ],
  });
}

export function openHintPay(price: number, canPay: boolean, onPay: () => void): void {
  openModal({
    title: t('hint.pay.title'),
    eyebrow: t('hint.eyebrow'),
    portrait: portraitUrl('usa'),
    className: 'modal-story speaker-usa',
    body: `<p class="story">${t('hint.pay.text', { n: price })}</p>`,
    actions: [
      { label: canPay ? t('hint.pay.button', { n: price }) : t('hint.pay.need', { n: price }), primary: true, disabled: !canPay, onClick: onPay },
      { label: t('common.notNow'), onClick: closeModal },
    ],
  });
}

// 2PM sells parts in packs. `need` offers to buy exactly what a building is missing and build it.
export function openImport(s: GameState, opts: { need?: { packs: number; onBuild: () => void }; onDone?: () => void }): void {
  const buy = (packs: number) => {
    if (!importParts(s, packs)) return audio.play('error');
    audio.play('coin');
    closeModal();
    opts.onDone?.();
  };
  const actions: ModalAction[] = [];
  if (opts.need) {
    const { packs, onBuild } = opts.need;
    actions.push({
      label: t('import.missing', { n: packs * IMPORT_PARTS.parts }),
      hint: t('import.cost', { n: packs * IMPORT_PARTS.credits }),
      primary: true,
      onClick: () => {
        if (!importParts(s, packs)) return audio.play('error');
        closeModal();
        onBuild();
      },
    });
  }
  for (const packs of [1, 5, 10]) {
    actions.push({
      label: t('import.buy', { n: packs * IMPORT_PARTS.parts }),
      hint: t('import.cost', { n: packs * IMPORT_PARTS.credits }),
      primary: !opts.need && packs === 1,
      tone: 'industrial',
      disabled: s.res.credits < packs * IMPORT_PARTS.credits,
      onClick: () => buy(packs),
    });
  }
  openModal({
    title: t('import.title'),
    eyebrow: t('import.eyebrow'),
    portrait: portraitUrl('corp'),
    className: 'modal-story speaker-corp',
    body: `<p class="story">${t('import.text', { have: Math.floor(s.res.parts), parts: IMPORT_PARTS.parts, credits: IMPORT_PARTS.credits })}</p>`,
    actions,
  });
}

export function openTrade(s: GameState, onChange: () => void): void {
  const body = el('div', 'trade');
  const render = () => {
    const c = loadCampaign();
    const row = (res: 'credits' | 'parts', amounts: number[]) => `
      <div class="trade-row">
        <span class="trade-res"><img src="${iconUrl(res)}" alt="" />${res === 'credits' ? t('res.credits') : t('res.parts')}</span>
        <span class="trade-have">${t('trade.city')} <b>${Math.floor(s.res[res])}</b></span>
        <span class="trade-have">${t('trade.bank')} <b>${Math.floor(c.bank[res])}</b></span>
        <span class="trade-btns">
          ${amounts.map((a) => `<button type="button" class="btn" data-send="${res}:${a}" ${s.res[res] < a ? 'disabled' : ''}>${t('trade.send', { n: a })}</button>`).join('')}
          ${amounts.map((a) => `<button type="button" class="btn tone-neutral" data-take="${res}:${a}" ${c.bank[res] < 1 ? 'disabled' : ''}>${t('trade.take', { n: a })}</button>`).join('')}
        </span>
      </div>`;
    body.innerHTML = `
      <p>${t('trade.intro', { fee: Math.round(BANK_FEE * 100) })}</p>
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
    title: t('trade.title'),
    eyebrow: t('trade.eyebrow'),
    wide: true,
    body,
    actions: [{ label: t('common.done'), primary: true, onClick: closeModal }],
  });
}
