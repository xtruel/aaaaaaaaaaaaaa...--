// Main menu, laid out after the key-art mockup (docs/mockup-main-menu.png).
import { audio } from '../audio';
import { iconUrl } from '../render/icons';
import type { IconName } from '../render/icons';
import { MenuBackground, paintCardScene } from '../render/menuBg';
import type { CardScene } from '../render/menuBg';
import { lastPlayed, slotMeta } from '../storage';
import { openCredits, openExtras, openPathInfo } from './dialogs';
import { isModalOpen } from './modal';

export interface MenuHandlers {
  onNewGame(): void;
  onContinue(): void;
  onLoadGame(): void;
  onSettings(): void;
  onQuit(): void;
}

const MENU_ITEMS: [string, string, IconName, string][] = [
  ['new', 'New game', 'play', 'var(--lime)'],
  ['continue', 'Continue', 'energy', 'var(--yellow)'],
  ['load', 'Load game', 'disk', 'var(--sky)'],
  ['settings', 'Settings', 'gear', 'var(--orange)'],
  ['extras', 'Extras', 'star', 'var(--pink)'],
  ['credits', 'Credits', 'happy', 'var(--teal)'],
  ['quit', 'Quit', 'door', 'var(--purple)'],
];

const TICKER = [
  'Good junk, good future',
  '2PM Corp: profit is a lifestyle',
  'Miso approves this city',
  'Recycle × build × expand × survive',
  'Pixel Planet Initiative grants now open',
  'Bots wanted: no experience needed',
]
  .map((t) => `<span>${t}</span><b>✦</b>`)
  .join('');

const CROWN = `<svg class="crown" viewBox="0 0 24 16" aria-hidden="true"><path d="M2 14 L2 4 L7 9 L12 2 L17 9 L22 4 L22 14 Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;
const GLOBE = `<svg class="globe" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.6"/><ellipse cx="12" cy="12" rx="4.5" ry="10" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M2 12h20M4 7h16M4 17h16" stroke="currentColor" stroke-width="1.6"/></svg>`;

export class MainMenu {
  readonly root: HTMLElement;
  private bg: MenuBackground;
  private items: HTMLButtonElement[] = [];
  private focusIndex = 0;
  private handlers: MenuHandlers;

  constructor(root: HTMLElement, handlers: MenuHandlers) {
    this.root = root;
    this.handlers = handlers;
    root.innerHTML = `
      <canvas class="menu-bg" aria-hidden="true"></canvas>
      <div class="menu-shade" aria-hidden="true"></div>
      <header class="corner corner-tl">
        <div class="studio">${GLOBE}<span>Qwerty3D<br />Games</span></div>
        <p>Build_0.4<br />Oct 10 2026</p>
      </header>
      <p class="corner corner-tr">Version 0.4<br />Pixel Planet Initiative<br />© 2026 Qwerty3D<br />All rights reserved</p>
      <div class="menu-left">
        <h1 class="logo" aria-label="Scrapbot City">
          <span class="logo-star" aria-hidden="true">✦</span>
          <span class="logo-scrap" aria-hidden="true">Scrapb<span class="logo-o">o${CROWN}</span>t</span>
          <span class="logo-row" aria-hidden="true">
            <span class="logo-jp">スクラップボットシティ</span>
            <span class="logo-city">City<sup>™</sup></span>
          </span>
          <span class="logo-2pm" aria-hidden="true">2PM</span>
        </h1>
        <p class="pillars">Recycle <i>×</i> Build <i>×</i> Expand <i>×</i> Survive</p>
        <nav class="menu-list" aria-label="Main menu">
          ${MENU_ITEMS.map(
            ([act, label, icon, color]) => `
            <button type="button" data-act="${act}" style="--chip:${color}">
              <span class="chip" aria-hidden="true"><img src="${iconUrl(icon, 2)}" alt="" /></span>
              <span class="label">${label}</span>
              <span class="go" aria-hidden="true">▶</span>
            </button>`,
          ).join('')}
        </nav>
        <p class="hand hand-left">Trash today<br />a better<br />tomorrow ${CROWN}</p>
      </div>
      <aside class="path-cards" aria-label="Paths">
        ${this.card('green', 'Green path')}
        ${this.card('industrial', 'Industrial path')}
        ${this.card('choices', 'Your choices')}
        ${this.card('shape', 'Shape the city', true)}
      </aside>
      <p class="hand hand-right">Different<br />futures<br />same city ${CROWN}</p>
      <footer class="menu-footer">
        <span class="footer-tag">Small robots <i>×</i> big choices</span>
        <span class="stripes" aria-hidden="true"></span>
        <div class="ticker" aria-hidden="true"><div class="ticker-track">${TICKER}${TICKER}</div></div>
        <span class="question">A clean planet or a bigger profit? ▶</span>
      </footer>
    `;
    this.bg = new MenuBackground(root.querySelector('.menu-bg')!);
    root.querySelectorAll<HTMLCanvasElement>('canvas[data-scene]').forEach((c) => paintCardScene(c, c.dataset.scene as CardScene));
    root.querySelectorAll<HTMLButtonElement>('.path-card').forEach((c) =>
      c.addEventListener('click', () => {
        audio.unlock();
        audio.play('click');
        openPathInfo();
      }),
    );

    this.items = Array.from(root.querySelectorAll<HTMLButtonElement>('.menu-list button'));
    this.items.forEach((b, i) => {
      b.addEventListener('pointerenter', () => this.setFocus(i, false));
      b.addEventListener('focus', () => this.setFocus(i, false));
      b.addEventListener('click', () => this.activate(b.dataset.act!));
    });
    window.addEventListener('resize', () => {
      if (!this.root.hidden) this.bg.resize();
    });
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  private card(scene: CardScene, label: string, arrow = false): string {
    const icon: Record<CardScene, IconName> = { green: 'leaf', industrial: 'gear', choices: 'star', shape: 'pop' };
    return `<button type="button" class="path-card card-${scene}">
      <canvas data-scene="${scene}" aria-hidden="true"></canvas>
      <span class="card-label"><img src="${iconUrl(icon[scene], 2)}" alt="" />${label}${arrow ? ' <b aria-hidden="true">→</b>' : ''}</span>
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
    cont.title = meta ? `${meta.city}, day ${meta.day}` : 'No saved city yet';
  }

  private setFocus(i: number, move: boolean): void {
    if (i < 0) return;
    if (this.focusIndex !== i) audio.play('hover');
    this.focusIndex = i;
    this.items.forEach((b, k) => b.classList.toggle('selected', k === i));
    if (move) this.items[i].focus();
  }

  private onKey(e: KeyboardEvent): void {
    if (this.root.hidden || isModalOpen()) return;
    const enabled = this.items.map((b, i) => (b.disabled ? -1 : i)).filter((i) => i >= 0);
    const pos = enabled.indexOf(this.focusIndex);
    if (e.key === 'ArrowDown' || e.key === 's') {
      e.preventDefault();
      this.setFocus(enabled[(pos + 1) % enabled.length], true);
    } else if (e.key === 'ArrowUp' || e.key === 'w') {
      e.preventDefault();
      this.setFocus(enabled[(pos - 1 + enabled.length) % enabled.length], true);
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
