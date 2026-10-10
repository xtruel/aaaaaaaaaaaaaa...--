// A running city: owns the game loop, input, camera, HUD and in-game dialogs.
import { audio } from './audio';
import { bulldozeRubble, demolish, importParts, placeBuilding } from './game/actions';
import { BUILDINGS, SIM_STEP, T, TILE } from './game/defs';
import type { BuildingType } from './game/defs';
import { step } from './game/sim';
import { day, idx, inBounds, pushMessage } from './game/state';
import type { FxEvent, GameState } from './game/state';
import { ENDINGS, eventById } from './game/story';
import { portraitUrl } from './render/icons';
import { Renderer } from './render/renderer';
import { clearSlot, saveGame, unlockEnding } from './storage';
import type { Settings, SlotId } from './storage';
import { openSettings, openSlots, openStoryEvent } from './ui/dialogs';
import { Hud, typeForHotkey } from './ui/hud';
import { closeModal, isModalOpen, openModal } from './ui/modal';

export interface SessionHandlers {
  onExitToMenu(): void;
  onLoadSlot(slot: SlotId): void;
  onNewGame(): void;
  onSettingsChanged(s: Settings): void;
}

interface Drag {
  x: number;
  y: number;
  camX: number;
  camY: number;
  moved: boolean;
  button: number;
  pointerType: string;
}

const PAN_SPEED = 260; // screen px per second

export class GameSession {
  readonly s: GameState;
  private root: HTMLElement;
  private renderer: Renderer;
  private hud: Hud;
  private handlers: SessionHandlers;
  private settings: Settings;
  private speed = 1;
  private lastSpeed = 1;
  private build: BuildingType | null = null;
  private bulldoze = false;
  private selectedId = -1;
  private hover: { x: number; y: number } | null = null;
  private pointer = { x: -1, y: -1, inside: false };
  private keys = new Set<string>();
  private drag: Drag | null = null;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private hudTimer = 0;
  private lastDay = 0;
  private lastCoin = 0;
  private endingShown = false;
  private smogWarned = false;
  private alive = false;
  private disposers: (() => void)[] = [];

  constructor(root: HTMLElement, s: GameState, settings: Settings, handlers: SessionHandlers) {
    this.root = root;
    this.s = s;
    this.settings = settings;
    this.handlers = handlers;
    root.innerHTML = '<canvas class="world" aria-label="City map"></canvas><div class="hud"></div>';
    this.renderer = new Renderer(root.querySelector('canvas')!);
    this.hud = new Hud(root.querySelector('.hud')!, {
      onBuild: (t) => this.selectBuild(t),
      onBulldoze: () => this.toggleBulldoze(),
      onImport: () => audio.play(importParts(this.s) ? 'coin' : 'error'),
      onSpeed: (v) => this.setSpeed(v),
      onMenu: () => this.openPause(),
      onDemolish: (id) => this.demolishById(id),
      onTogglePause: (id) => {
        const b = this.s.buildings.find((o) => o.id === id);
        if (b) b.paused = !b.paused;
      },
      onCloseInspector: () => (this.selectedId = -1),
    });
    this.renderer.zoom = window.innerHeight >= 900 ? 3 : 2;
    this.renderer.resize();
    this.renderer.paintAllTerrain(s);
    const hq = s.buildings.find((b) => b.type === 'hq');
    if (hq) this.renderer.centerOn((hq.x + 1.5) * TILE, (hq.y + 1.5) * TILE);
    this.lastDay = day(s);
    this.bindInput();
  }

  start(intro: boolean): void {
    this.alive = true;
    this.root.hidden = false;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.alive) return;
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.frame(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    if (intro) this.showIntro();
    else if (this.s.outcome) this.showEnding();
  }

  dispose(): void {
    this.alive = false;
    cancelAnimationFrame(this.raf);
    for (const d of this.disposers) d();
    this.root.innerHTML = '';
    this.root.hidden = true;
  }

  applySettings(settings: Settings): void {
    this.settings = settings;
  }

  // ---------- loop ----------

  private frame(dt: number): void {
    const s = this.s;
    const modal = isModalOpen();
    const running = !modal && this.speed > 0 && !s.outcome && !s.pendingEvent;
    if (running) {
      this.acc += dt * this.speed;
      let n = 0;
      while (this.acc >= SIM_STEP && n < 16) {
        step(s, SIM_STEP);
        this.acc -= SIM_STEP;
        n++;
        if (s.pendingEvent || s.outcome) break;
      }
      if (n >= 16) this.acc = 0;
    }

    for (const fx of s.fx) this.onFx(fx);
    s.fx.length = 0;
    if (s.messages.length) {
      this.hud.pushMessages(s.messages);
      s.messages.length = 0;
    }

    if (s.smog > 0 && !this.smogWarned) {
      this.smogWarned = true;
      audio.play('alert');
    } else if (s.smog <= 0) {
      this.smogWarned = false;
    }

    if (day(s) !== this.lastDay) {
      this.lastDay = day(s);
      if (!s.outcome) saveGame('auto', s);
    }

    if (!modal && s.pendingEvent) this.showEvent();
    if (!modal && s.outcome && !this.endingShown) this.showEnding();

    if (!modal) this.panCamera(dt);
    this.updateHover();
    this.renderer.render(
      s,
      {
        hover: this.hover,
        build: this.build,
        bulldoze: this.bulldoze,
        selectedId: this.selectedId,
        reducedMotion: this.settings.reducedMotion,
      },
      dt,
      running,
    );

    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.1;
      this.hud.update(s, { speed: this.speed, build: this.build, bulldoze: this.bulldoze, selectedId: this.selectedId });
    }
  }

  private onFx(fx: FxEvent): void {
    this.renderer.onFx(fx);
    switch (fx.kind) {
      case 'collect':
        audio.play('collect');
        break;
      case 'placed':
        audio.play('build');
        break;
      case 'built':
        audio.play('done');
        break;
      case 'produce': {
        const now = performance.now();
        if (fx.text?.includes('cr') && now - this.lastCoin > 1500) {
          this.lastCoin = now;
          audio.play('coin');
        }
        break;
      }
      case 'demolish':
        audio.play('demolish');
        break;
      case 'storm':
        audio.play('alert');
        break;
      case 'clean':
        audio.play('collect');
        break;
    }
  }

  private panCamera(dt: number): void {
    let dx = 0;
    let dy = 0;
    const k = this.keys;
    if (k.has('a') || k.has('arrowleft')) dx -= 1;
    if (k.has('d') || k.has('arrowright')) dx += 1;
    if (k.has('w') || k.has('arrowup')) dy -= 1;
    if (k.has('s') || k.has('arrowdown')) dy += 1;
    if (this.settings.edgeScroll && this.pointer.inside && !this.drag) {
      const m = 14;
      if (this.pointer.x < m) dx -= 1;
      if (this.pointer.x > window.innerWidth - m) dx += 1;
      if (this.pointer.y < m) dy -= 1;
      if (this.pointer.y > window.innerHeight - m) dy += 1;
    }
    if (dx || dy) {
      const r = this.renderer;
      r.cam.x += (dx * PAN_SPEED * dt) / r.zoom;
      r.cam.y += (dy * PAN_SPEED * dt) / r.zoom;
      r.clampCam();
    }
  }

  private updateHover(): void {
    if (!this.pointer.inside || (this.drag && this.drag.moved)) {
      this.hover = this.pointer.inside && this.build ? this.hover : null;
      return;
    }
    this.hover = this.renderer.screenToTile(this.pointer.x, this.pointer.y);
  }

  // ---------- input ----------

  private listen<K extends keyof WindowEventMap>(target: Window, type: K, fn: (e: WindowEventMap[K]) => void): void;
  private listen<K extends keyof HTMLElementEventMap>(target: HTMLElement, type: K, fn: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions): void;
  private listen(target: Window | HTMLElement, type: string, fn: (e: Event) => void, opts?: AddEventListenerOptions): void {
    target.addEventListener(type, fn, opts);
    this.disposers.push(() => target.removeEventListener(type, fn, opts));
  }

  private bindInput(): void {
    const canvas = this.renderer.canvas;
    this.listen(window, 'resize', () => this.renderer.resize());
    this.listen(canvas, 'contextmenu', (e) => e.preventDefault());
    this.listen(canvas, 'pointerdown', (e) => {
      audio.unlock();
      canvas.setPointerCapture(e.pointerId);
      this.drag = {
        x: e.clientX,
        y: e.clientY,
        camX: this.renderer.cam.x,
        camY: this.renderer.cam.y,
        moved: false,
        button: e.button,
        pointerType: e.pointerType,
      };
    });
    this.listen(canvas, 'pointermove', (e) => {
      this.pointer = { x: e.clientX, y: e.clientY, inside: true };
      const d = this.drag;
      if (!d) return;
      const dist = Math.hypot(e.clientX - d.x, e.clientY - d.y);
      const canPan = d.button === 1 || d.button === 2 || !this.build || d.pointerType === 'touch';
      if (!d.moved && dist > 6 && canPan) d.moved = true;
      if (d.moved) {
        const r = this.renderer;
        r.cam.x = d.camX - (e.clientX - d.x) / r.zoom;
        r.cam.y = d.camY - (e.clientY - d.y) / r.zoom;
        r.clampCam();
      }
    });
    this.listen(canvas, 'pointerup', (e) => {
      const d = this.drag;
      this.drag = null;
      if (!d || d.moved) return;
      this.pointer = { x: e.clientX, y: e.clientY, inside: true };
      if (d.button === 2) this.cancelTool();
      else if (d.button === 0) this.click(e.clientX, e.clientY);
    });
    this.listen(canvas, 'pointerleave', () => {
      this.pointer.inside = false;
    });
    this.listen(
      canvas,
      'wheel',
      (e) => {
        e.preventDefault();
        this.renderer.setZoom(this.renderer.zoom + (e.deltaY < 0 ? 1 : -1), e.clientX, e.clientY);
      },
      { passive: false },
    );
    this.listen(window, 'keydown', (e) => this.onKeyDown(e));
    this.listen(window, 'keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    this.listen(window, 'blur', () => this.keys.clear());
    // closing the tab mid-day should not lose the day
    this.listen(window, 'pagehide', () => {
      if (!this.s.outcome) saveGame('auto', this.s);
    });
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (this.root.hidden) return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
    const key = e.key.toLowerCase();
    if (isModalOpen()) return;
    if (['w', 'a', 's', 'd', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key)) {
      this.keys.add(key);
      e.preventDefault();
      return;
    }
    const type = typeForHotkey(e.key);
    if (type && !e.ctrlKey && !e.metaKey) {
      this.selectBuild(type);
      return;
    }
    switch (key) {
      case 'escape':
        if (this.build || this.bulldoze || this.selectedId >= 0) this.cancelTool();
        else this.openPause();
        break;
      case ' ':
        e.preventDefault();
        this.setSpeed(this.speed === 0 ? this.lastSpeed || 1 : 0);
        break;
      case 'tab':
        e.preventDefault();
        this.setSpeed((this.speed % 3) + 1);
        break;
      case 'x':
        this.toggleBulldoze();
        break;
      case 'h': {
        const hq = this.s.buildings.find((b) => b.type === 'hq');
        if (hq) this.renderer.centerOn((hq.x + 1.5) * TILE, (hq.y + 1.5) * TILE);
        break;
      }
      case '+':
      case '=':
        this.renderer.setZoom(this.renderer.zoom + 1);
        break;
      case '_':
        this.renderer.setZoom(this.renderer.zoom - 1);
        break;
    }
  }

  private click(sx: number, sy: number): void {
    const s = this.s;
    const t = this.renderer.screenToTile(sx, sy);
    if (this.build) {
      const def = BUILDINGS[this.build];
      const ox = t.x - Math.floor((def.w - 1) / 2);
      const oy = t.y - Math.floor((def.h - 1) / 2);
      const b = placeBuilding(s, this.build, ox, oy);
      if (!b) audio.play('error');
      else if (this.build === 'spire') this.build = null;
      return;
    }
    if (!inBounds(t.x, t.y)) {
      this.selectedId = -1;
      return;
    }
    const i = idx(t.x, t.y);
    if (this.bulldoze) {
      if (s.tiles[i] === T.RUBBLE) {
        if (!bulldozeRubble(s, t.x, t.y)) audio.play('error');
      } else if (s.occ[i] !== -1) {
        this.selectedId = s.occ[i];
        audio.play('click');
      } else {
        pushMessage(s, 'Bulldoze clears rubble. Bots handle junk, Purifiers handle sludge.', 'info');
      }
      return;
    }
    if (s.occ[i] !== -1) {
      this.selectedId = s.occ[i];
      audio.play('click');
      return;
    }
    const w = this.renderer.screenToWorld(sx, sy);
    if (Math.hypot(w.x - s.cat.x, w.y - (s.cat.y - 4)) < 8) {
      s.happyMod = Math.min(s.happyMod + 1, 15);
      pushMessage(s, ['Miso: mrrp.', 'Miso purrs. Citizens feel a bit better.', 'Miso ignores you, as cats do.'][Math.floor(Math.random() * 3)], 'good');
      return;
    }
    this.selectedId = -1;
    if (s.tiles[i] === T.JUNK) pushMessage(s, `Junk pile: ${s.amount[i]} scrap. Your bots will get to it.`, 'info');
    else if (s.tiles[i] === T.SLUDGE) pushMessage(s, 'Toxic sludge: it slowly raises the smog. A Purifier nearby cleans it.', 'info');
    else if (s.tiles[i] === T.RUBBLE) pushMessage(s, 'Rubble: use Bulldoze (X) to clear it.', 'info');
  }

  private selectBuild(type: BuildingType | null): void {
    this.bulldoze = false;
    this.selectedId = -1;
    this.build = this.build === type ? null : type;
  }

  private toggleBulldoze(): void {
    this.build = null;
    this.bulldoze = !this.bulldoze;
  }

  private cancelTool(): void {
    this.build = null;
    this.bulldoze = false;
    this.selectedId = -1;
  }

  private setSpeed(v: number): void {
    if (v > 0) this.lastSpeed = v;
    this.speed = v;
  }

  private demolishById(id: number): void {
    const b = this.s.buildings.find((o) => o.id === id);
    if (b && demolish(this.s, b)) this.selectedId = -1;
  }

  // ---------- dialogs ----------

  private showIntro(): void {
    openModal({
      title: `Welcome to ${this.s.cityName}`,
      eyebrow: 'USA-9 · Lead scrapbot',
      portrait: portraitUrl('usa'),
      className: 'modal-story speaker-usa',
      body: `
        <p class="story">Hi boss! I'm USA-9. My bots fly out and collect junk on their own. You decide what we turn it into.</p>
        <p class="story">Recycle it for a <b class="g">green</b> future, or smelt it for quick <b class="i">profit</b>. Just keep the smog meter under 100%.</p>
        <p class="story">Finish the <b>Scrap Spire</b> and the whole city will follow the path you picked. Miso says hi.</p>`,
      actions: [{ label: "Let's go", primary: true, onClick: closeModal }],
    });
  }

  private showEvent(): void {
    const s = this.s;
    const ev = s.pendingEvent ? eventById(s.pendingEvent) : undefined;
    if (!ev) {
      s.pendingEvent = null;
      return;
    }
    audio.play('event');
    openStoryEvent(ev, s, (result) => {
      s.pendingEvent = null;
      closeModal();
      pushMessage(s, result, 'event');
    });
  }

  private showEnding(): void {
    const s = this.s;
    if (!s.outcome) return;
    this.endingShown = true;
    const e = ENDINGS[s.outcome.kind];
    unlockEnding(s.outcome.kind);
    clearSlot('auto');
    audio.play(s.outcome.kind === 'smog' ? 'alert' : 'event');
    openModal({
      title: e.title,
      eyebrow: e.subtitle,
      wide: true,
      dismissable: false,
      className: `modal-ending ending-${s.outcome.kind}`,
      body: `
        <p class="story">${e.text}</p>
        <dl class="stats">
          <dt>Days</dt><dd>${s.outcome.day}</dd>
          <dt>Citizens</dt><dd>${Math.floor(s.pop)}</dd>
          <dt>Scrap collected</dt><dd>${Math.floor(s.stats.scrapCollected)}</dd>
          <dt>Buildings</dt><dd>${s.stats.built}</dd>
          <dt>Sludge cleaned</dt><dd>${s.stats.cleaned}</dd>
          <dt>Credits earned</dt><dd>${Math.floor(s.stats.creditsEarned)}</dd>
          <dt>Path</dt><dd>${s.alignment >= 0 ? `${Math.round(s.alignment)} green` : `${Math.round(-s.alignment)} industrial`}</dd>
          <dt>Final smog</dt><dd>${Math.round(s.pollution)}%</dd>
        </dl>`,
      actions: [
        { label: 'New city', primary: true, onClick: () => this.handlers.onNewGame() },
        { label: 'Main menu', onClick: () => this.handlers.onExitToMenu() },
      ],
    });
  }

  private openPause(): void {
    const s = this.s;
    openModal({
      title: 'Paused',
      eyebrow: `${s.cityName} · Day ${day(s)}`,
      body: `<p class="pause-tip">Tip: press <kbd>H</kbd> to jump back to the HQ, <kbd>Tab</kbd> to change speed.</p>`,
      actions: [
        { label: 'Resume', primary: true, onClick: closeModal },
        { label: 'Save game', onClick: () => openSlots('save', { state: s, onBack: () => this.openPause() }) },
        { label: 'Load game', onClick: () => openSlots('load', { onLoad: (slot) => this.handlers.onLoadSlot(slot), onBack: () => this.openPause() }) },
        {
          label: 'Settings',
          onClick: () =>
            openSettings(
              (set) => this.handlers.onSettingsChanged(set),
              () => this.openPause(),
            ),
        },
        {
          label: 'Save & main menu',
          onClick: () => {
            if (!s.outcome) saveGame('auto', s);
            this.handlers.onExitToMenu();
          },
        },
      ],
    });
  }
}
