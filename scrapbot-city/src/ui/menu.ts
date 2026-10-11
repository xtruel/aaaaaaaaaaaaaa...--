// Main menu, laid out after the key-art mockup (docs/mockup-main-menu.png).
import { audio } from '../audio';
import { LANGS, lang, t, tList, tk } from '../i18n';
import { iconUrl } from '../render/icons';
import type { IconName } from '../render/icons';
import { MenuBackground, paintCardScene } from '../render/menuBg';
import type { CardScene } from '../render/menuBg';
import { lastPlayed, slotMeta } from '../storage';
import { openCredits, openExtras, openPathInfo } from './dialogs';
import { esc } from './escape';
import { isModalOpen } from './modal';

export interface MenuHandlers {
  onNewGame(): void;
  onContinue(): void;
  onLoadGame(): void;
  onSettings(): void;
  onLanguage(): void;
  onQuit(): void;
}

const MENU_ITEMS: [string, IconName, string][] = [
  ['new', 'play', 'var(--lime)'],
  ['continue', 'energy', 'var(--yellow)'],
  ['load', 'disk', 'var(--sky)'],
  ['settings', 'gear', 'var(--orange)'],
  ['extras', 'star', 'var(--pink)'],
  ['credits', 'happy', 'var(--teal)'],
  ['quit', 'door', 'var(--purple)'],
];

const CROWN = `<svg class="crown" viewBox="0 0 24 16" aria-hidden="true"><path d="M2 14 L2 4 L7 9 L12 2 L17 9 L22 4 L22 14 Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;
const GLOBE = `<svg class="globe" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.6"/><ellipse cx="12" cy="12" rx="4.5" ry="10" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M2 12h20M4 7h16M4 17h16" stroke="currentColor" stroke-width="1.6"/></svg>`;

// "Recycle × Build" style lists: the × gets its accent colour.
const crossed = (text: string) => esc(text).replace(/×/g, '<i>×</i>');

export class MainMenu {
  readonly root: HTMLElement;
  private ui: HTMLElement;
  private bg: MenuBackground;
  private items: HTMLButtonElement[] = [];
  private focusIndex = 0;
  private handlers: MenuHandlers;

  constructor(root: HTMLElement, handlers: MenuHandlers) {
    this.root = root;
    this.handlers = handlers;
    // the animated background stays; only the interface is rebuilt when the language changes
    root.innerHTML = `
      <canvas class="menu-bg" aria-hidden="true"></canvas>
      <div class="menu-shade" aria-hidden="true"></div>
      <div class="menu-ui"></div>`;
    this.bg = new MenuBackground(root.querySelector('.menu-bg')!, isModalOpen);
    this.ui = root.querySelector('.menu-ui')!;
    this.render();
    window.addEventListener('resize', () => {
      if (!this.root.hidden) this.bg.resize();
    });
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  render(): void {
    // a language change rebuilds the menu: the highlight stays on the same entry
    const keepAct = this.items[this.focusIndex]?.dataset.act;
    const ticker = tList('menu.ticker')
      .map((line) => `<span>${esc(line)}</span><b>✦</b>`)
      .join('');
    const langName = LANGS.find((l) => l.id === lang())?.name ?? 'English';
    this.ui.innerHTML = `
      <header class="corner corner-tl">
        <div class="studio">${GLOBE}<span>Qwerty3D<br />Games</span></div>
        <p>Build_0.7.0-alpha.1<br />Oct 11 2026</p>
      </header>
      <div class="corner-right">
        <p class="corner corner-tr">Version 0.7.0-alpha.1<br />Pixel Planet Initiative<br />© 2026 Qwerty3D<br />All rights reserved</p>
        <button type="button" class="lang-pill" data-lang-open aria-label="${t('menu.language')}">${GLOBE}<span>${langName}</span></button>
      </div>
      <div class="menu-left">
        <h1 class="logo" aria-label="Scrapbot City">
          <span class="logo-star" aria-hidden="true">✦</span>
          <span class="logo-scrap" aria-hidden="true">Scrapb<span class="logo-o">o${CROWN}</span>t</span>
          <span class="logo-row" aria-hidden="true">
            <span class="logo-jp" lang="ja">スクラップボットシティ</span>
            <span class="logo-city">City<sup>™</sup></span>
          </span>
          <span class="logo-2pm" aria-hidden="true">2PM</span>
        </h1>
        <p class="pillars">${tList('menu.pillars').map(esc).join(' <i>×</i> ')}</p>
        <nav class="menu-list">
          ${MENU_ITEMS.map(
            ([act, icon, color]) => `
            <button type="button" data-act="${act}" style="--chip:${color}">
              <span class="chip" aria-hidden="true"><img src="${iconUrl(icon, 2)}" alt="" /></span>
              <span class="label">${tk(`menu.${act}`)}</span>
              <span class="go" aria-hidden="true">▶</span>
            </button>`,
          ).join('')}
        </nav>
        <p class="hand hand-left" lang="en">Trash today<br />a better<br />tomorrow ${CROWN}</p>
      </div>
      <aside class="path-cards">
        ${this.card('green', t('menu.card.green'))}
        ${this.card('industrial', t('menu.card.industrial'))}
        ${this.card('choices', t('menu.card.choices'))}
        ${this.card('shape', t('menu.card.shape'), true)}
      </aside>
      <p class="hand hand-right" lang="en">Different<br />futures<br />same city ${CROWN}</p>
      <footer class="menu-footer">
        <span class="footer-tag">${crossed(t('menu.footer'))}</span>
        <span class="stripes" aria-hidden="true"></span>
        <div class="ticker" aria-hidden="true"><div class="ticker-track">${ticker}${ticker}</div></div>
        <span class="question">${esc(t('menu.question'))} ▶</span>
      </footer>
    `;
    this.ui.querySelectorAll<HTMLCanvasElement>('canvas[data-scene]').forEach((c) => paintCardScene(c, c.dataset.scene as CardScene));
    this.ui.querySelectorAll<HTMLButtonElement>('.path-card').forEach((c) =>
      c.addEventListener('click', () => {
        audio.unlock();
        audio.play('click');
        openPathInfo();
      }),
    );
    this.ui.querySelector('[data-lang-open]')!.addEventListener('click', () => {
      audio.unlock();
      audio.play('click');
      this.handlers.onLanguage();
    });
    this.items = Array.from(this.ui.querySelectorAll<HTMLButtonElement>('.menu-list button'));
    this.items.forEach((b, i) => {
      b.addEventListener('pointerenter', () => {
        if (!b.disabled) this.setFocus(i, false);
      });
      b.addEventListener('focus', () => this.setFocus(i, false));
      b.addEventListener('click', () => this.activate(b.dataset.act!));
    });
    this.refresh();
    const kept = this.items.findIndex((b) => b.dataset.act === keepAct && !b.disabled);
    this.setFocus(kept >= 0 ? kept : Math.max(0, this.items.findIndex((b) => !b.disabled)), false, true);
  }

  private card(scene: CardScene, label: string, arrow = false): string {
    const icon: Record<CardScene, IconName> = { green: 'leaf', industrial: 'gear', choices: 'star', shape: 'pop' };
    return `<button type="button" class="path-card card-${scene}">
      <canvas data-scene="${scene}" aria-hidden="true"></canvas>
      <span class="card-label"><img src="${iconUrl(icon[scene], 2)}" alt="" />${esc(label)}${arrow ? ' <b aria-hidden="true">→</b>' : ''}</span>
    </button>`;
  }

  setReducedMotion(v: boolean): void {
    this.bg.setReducedMotion(v);
  }

  show(): void {
    this.root.hidden = false;
    this.refresh();
    this.bg.start();
    this.setFocus(this.items.findIndex((b) => !b.disabled), false);
  }

  hide(): void {
    this.root.hidden = true;
    this.bg.stop();
  }

  refresh(): void {
    const slot = lastPlayed();
    const meta = slot ? slotMeta(slot) : null;
    const cont = this.items.find((b) => b.dataset.act === 'continue')!;
    cont.disabled = !meta;
    cont.title = meta ? t('menu.saveInfo', { city: meta.city, day: meta.day }) : t('menu.noSave');
  }

  private setFocus(i: number, move: boolean, silent = false): void {
    if (i < 0) return;
    if (this.focusIndex !== i && !silent) audio.play('hover');
    this.focusIndex = i;
    this.items.forEach((b, k) => b.classList.toggle('selected', k === i));
    if (move) this.items[i].focus();
  }

  private onKey(e: KeyboardEvent): void {
    if (this.root.hidden || isModalOpen()) return;
    const enabled = this.items.map((b, i) => (b.disabled ? -1 : i)).filter((i) => i >= 0);
    const pos = enabled.indexOf(this.focusIndex);
    if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      e.preventDefault();
      this.setFocus(enabled[(pos + 1) % enabled.length], true);
    } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      this.setFocus(enabled[(pos - 1 + enabled.length) % enabled.length], true);
    } else if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') {
      // the highlighted entry works with Enter even before an arrow key gave it real focus
      const active = document.activeElement;
      if (active && active !== document.body && this.root.contains(active)) return; // a focused button clicks itself
      const b = this.items[this.focusIndex];
      if (b && !b.disabled) {
        e.preventDefault();
        b.click();
      }
    }
  }

  private activate(act: string): void {
    audio.unlock();
    audio.play('click');
    switch (act) {
      case 'new':
        this.handlers.onNewGame();
        break;
      case 'continue':
        this.handlers.onContinue();
        break;
      case 'load':
        this.handlers.onLoadGame();
        break;
      case 'settings':
        this.handlers.onSettings();
        break;
      case 'extras':
        openExtras();
        break;
      case 'credits':
        openCredits();
        break;
      case 'quit':
        this.handlers.onQuit();
        break;
    }
  }
}
