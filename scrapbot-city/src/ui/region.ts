// Region map of the Scrap Coast: pick a city, see its rules and stars, travel there.
import { audio } from '../audio';
import { allSpiresDone, isUnlocked, loadCampaign, progressOf, regionEnding, regionEndingText, regionEndingTitle, saveCampaign, totalStars } from '../campaign';
import { CITIES, TOTAL_STARS, cityDesc, cityTagline, cityTraits, goalText } from '../game/cities';
import { endingTitle } from '../game/story';
import { t } from '../i18n';
import type { CityDef, CityId } from '../game/cities';
import { buildingThumb, iconUrl } from '../render/icons';
import { paintRegion } from '../render/regionBg';
import { citySlot, slotMeta } from '../storage';
import { closeModal, isModalOpen, openModal } from './modal';

export interface RegionHandlers {
  onPlay(city: CityDef, restart: boolean): void;
  onBack(): void;
}

export class RegionMap {
  readonly root: HTMLElement;
  private canvas: HTMLCanvasElement;
  private selected: CityId = 'home';
  private confirmRestart = false;
  private raf = 0;
  private t = 0;

  constructor(
    root: HTMLElement,
    private handlers: RegionHandlers,
  ) {
    this.root = root;
    this.canvas = this.renderShell();
    window.addEventListener('resize', () => {
      if (!this.root.hidden) this.paint();
    });
    window.addEventListener('keydown', (e) => {
      if (this.root.hidden || isModalOpen()) return;
      if (e.key === 'Escape') this.handlers.onBack();
    });
  }

  // Header and layout; rebuilt on every visit so a language change shows up.
  private renderShell(): HTMLCanvasElement {
    this.root.innerHTML = `
      <div class="region-map" data-map>
        <canvas class="region-bg" aria-hidden="true"></canvas>
        <div class="region-nodes" data-nodes></div>
      </div>
      <header class="region-top">
        <button type="button" class="btn region-back" data-back>◀ ${t('region.back')}</button>
        <div class="region-title">
          <p class="eyebrow">${t('region.eyebrow')}</p>
          <h1>${t('region.title')}</h1>
        </div>
        <div class="region-stats">
          <span class="pill pill-star" data-total></span>
          <span class="pill" title="${t('region.bank')}"><img src="${iconUrl('credits')}" alt="${t('res.credits')}" /><b data-bank-credits></b></span>
          <span class="pill" title="${t('region.bank')}"><img src="${iconUrl('parts')}" alt="${t('res.parts')}" /><b data-bank-parts></b></span>
        </div>
      </header>
      <aside class="region-panel" data-panel></aside>
    `;
    this.root.querySelector('[data-back]')!.addEventListener('click', () => {
      audio.play('click');
      this.handlers.onBack();
    });
    return this.root.querySelector('.region-bg')!;
  }

  show(): void {
    this.root.hidden = false;
    this.confirmRestart = false;
    this.canvas = this.renderShell();
    const c = loadCampaign();
    // open on the most interesting city: the first unlocked one without its Spire
    const next = CITIES.find((city) => isUnlocked(c, city) && !progressOf(c, city.id).spireDone);
    this.selected = next?.id ?? this.selected;
    this.render();
    if (document.body.classList.contains('pad-mode')) this.root.querySelector<HTMLElement>('[data-play]')?.focus();
    const loop = (now: number) => {
      this.t = now / 1000;
      this.paint();
      this.raf = requestAnimationFrame(loop);
    };
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(loop);
    if (allSpiresDone(c) && !c.finaleSeen) this.showFinale();
  }

  hide(): void {
    this.root.hidden = true;
    cancelAnimationFrame(this.raf);
  }

  relabel(): void {
    if (this.root.hidden) return;
    this.canvas = this.renderShell();
    this.render();
  }

  private paint(): void {
    const map = this.root.querySelector<HTMLElement>('[data-map]')!;
    paintRegion(this.canvas, map.clientWidth, map.clientHeight, this.t);
  }

  private render(): void {
    const c = loadCampaign();
    const total = totalStars(c);
    this.root.querySelector('[data-total]')!.textContent = `★ ${total}/${TOTAL_STARS}`;
    this.root.querySelector('[data-bank-credits]')!.textContent = String(Math.floor(c.bank.credits));
    this.root.querySelector('[data-bank-parts]')!.textContent = String(Math.floor(c.bank.parts));

    const nodes = this.root.querySelector<HTMLElement>('[data-nodes]')!;
    nodes.innerHTML = CITIES.map((city) => {
      const prog = progressOf(c, city.id);
      const open = isUnlocked(c, city);
      const stars = prog.stars.map((st) => `<i class="${st ? 'on' : ''}">★</i>`).join('');
      return `<button type="button" class="city-node ${open ? '' : 'locked'} ${city.id === this.selected ? 'selected' : ''}" data-city="${city.id}"
          style="left:${city.map.x}%;top:${city.map.y}%;--city:${city.color}" aria-label="${city.name}${open ? '' : ` (${t('region.locked')})`}">
        <span class="node-badge"><img src="${buildingThumb(city.icon)}" alt="" />${open ? '' : `<span class="node-lock"><img src="${iconUrl('lock', 2)}" alt="" />${city.starsToUnlock}★</span>`}</span>
        <span class="node-name">${city.name}</span>
        <span class="node-stars">${stars}</span>
      </button>`;
    }).join('');
    nodes.querySelectorAll<HTMLButtonElement>('[data-city]').forEach((b) =>
      b.addEventListener('click', () => {
        audio.play('click');
        this.selected = b.dataset.city as CityId;
        this.confirmRestart = false;
        this.render();
        // with a controller, jump straight to "Travel here" (a locked city keeps the focus on its node)
        if (document.body.classList.contains('pad-mode')) {
          (this.root.querySelector<HTMLElement>('[data-play]') ?? this.root.querySelector<HTMLElement>(`[data-city="${this.selected}"]`))?.focus();
        }
      }),
    );
    this.renderPanel();
  }

  private renderPanel(): void {
    const c = loadCampaign();
    const city = CITIES.find((x) => x.id === this.selected)!;
    const prog = progressOf(c, city.id);
    const open = isUnlocked(c, city);
    const meta = slotMeta(citySlot(city.id));
    const panel = this.root.querySelector<HTMLElement>('[data-panel]')!;
    panel.style.setProperty('--city', city.color);
    const missing = Math.max(0, city.starsToUnlock - totalStars(c));
    panel.innerHTML = `
      <div class="panel-head">
        <span class="node-badge small"><img src="${buildingThumb(city.icon)}" alt="" /></span>
        <div>
          <p class="eyebrow">${cityTagline(city)}</p>
          <h2>${city.name}</h2>
        </div>
      </div>
      <p class="panel-desc">${cityDesc(city)}</p>
      <ul class="traits">${cityTraits(city).map((trait) => `<li>${trait}</li>`).join('')}</ul>
      <h3>${t('region.starGoals')}</h3>
      <ul class="goals">${city.goals.map((_, i) => `<li class="${prog.stars[i] ? 'got' : ''}"><span class="star">★</span>${goalText(city, i)}</li>`).join('')}</ul>
      ${meta ? `<p class="panel-save">${t('region.saved', { day: meta.day, pop: meta.pop })}</p>` : ''}
      ${prog.spireDone && prog.endingKind ? `<p class="panel-save">${t('region.spireDone', { ending: endingTitle(prog.endingKind) })}</p>` : ''}
      <div class="panel-actions">
        ${
          !open
            ? `<p class="locked-note"><img src="${iconUrl('lock', 2)}" alt="" />${t('region.needStars', { n: missing, city: city.name })}</p>`
            : `<button type="button" class="btn btn-primary" data-play>${meta ? t('region.continue') : t('region.travel')} <small>${meta ? t('common.day', { n: meta.day }) : t('region.newCity')}</small></button>
               ${
                 meta
                   ? this.confirmRestart
                     ? `<button type="button" class="btn tone-danger" data-restart-yes>${t('region.restartYes')} <small>${t('region.restartHint')}</small></button>`
                     : `<button type="button" class="btn" data-restart>${t('region.restart')}</button>`
                   : ''
               }`
        }
      </div>`;
    panel.querySelector('[data-play]')?.addEventListener('click', () => {
      audio.play('click');
      this.handlers.onPlay(city, false);
    });
    panel.querySelector('[data-restart]')?.addEventListener('click', () => {
      audio.play('click');
      this.confirmRestart = true;
      this.renderPanel();
    });
    panel.querySelector('[data-restart-yes]')?.addEventListener('click', () => {
      audio.play('click');
      this.handlers.onPlay(city, true);
    });
  }

  private showFinale(): void {
    const c = loadCampaign();
    const kind = regionEnding(c);
    c.finaleSeen = true;
    saveCampaign(c);
    audio.play('event');
    openModal({
      title: regionEndingTitle(kind),
      eyebrow: t('region.finale.eyebrow'),
      wide: true,
      className: `modal-ending ending-${kind}`,
      body: `<p class="story">${regionEndingText(kind)}</p><p class="fine">${t('region.finale.note')}</p>`,
      actions: [{ label: t('region.finale.back'), primary: true, onClick: closeModal }],
    });
  }
}
