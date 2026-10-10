// A running city: owns the game loop, input, camera, HUD and in-game dialogs.
import { checkCampaign, checkCity, checkOutcome, unlock } from './achievements';
import { audio } from './audio';
import { recordCity } from './campaign';
import { bulldozeRubble, demolish, importParts, placeBuilding } from './game/actions';
import { cityById } from './game/cities';
import { BUILDINGS, SIM_STEP, T, TILE } from './game/defs';
import type { BuildingType } from './game/defs';
import { freeHintsLeft, hintPrice, suggest } from './game/hints';
import { step } from './game/sim';
import { day, idx, inBounds, pushMessage } from './game/state';
import type { FxEvent, GameState } from './game/state';
import { ENDINGS, endingText, eventById } from './game/story';
import { portraitUrl } from './render/icons';
import { Renderer } from './render/renderer';
import { citySlot, saveGame, setLastPlayed, setTutorialDone, slotMeta, unlockEnding } from './storage';
import type { Settings, SlotId } from './storage';
import { openHint, openHintPay, openSettings, openSlots, openStoryEvent, openTrade } from './ui/dialogs';
import { Hud, typeForHotkey } from './ui/hud';
import { esc } from './ui/escape';
import { closeModal, isModalOpen, openModal } from './ui/modal';
import type { ModalAction } from './ui/modal';
import { Tutorial } from './ui/tutorial';

export interface SessionHandlers {
  onExitToMenu(): void;
  onLoadSlot(slot: SlotId): void;
  onNewGame(): void;
  onRegionMap(): void;
  onRestartCity(): void;
  onTutorialDone(startCampaign: boolean): void;
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
// WASD by physical position: ZQSD on AZERTY keyboards.
const PAN_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];

export class GameSession {
  readonly s: GameState;
  private root: HTMLElement;
  private renderer: Renderer;
  private hud: Hud;
  private handlers: SessionHandlers;
  private settings: Settings;
  private tutorial: Tutorial | null = null;
  private speed = 1;
  private lastSpeed = 1;
  private build: BuildingType | null = null;
  private bulldoze = false;
  private selectedId = -1;
  private hover: { x: number; y: number } | null = null;
  private pointer = { x: -1, y: -1, inside: false };
  private keys = new Set<string>();
  private drag: Drag | null = null;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinch: { dist: number; zoom: number } | null = null;
  private wheelAcc = 0;
  private saveFailed = false;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private hudTimer = 0;
  private checkTimer = 0;
  private lastDay = 0;
  private lastCoin = 0;
  private endingShown = false;
  private smogWarned = false;
  private cameraMoved = false;
  private hintUsed = false;
  private pausedByHide = false;
  private newlyUnlocked: string[] = [];
  private endingUnlocks: string[] = [];
  private alive = false;
  private disposers: (() => void)[] = [];

  constructor(root: HTMLElement, s: GameState, settings: Settings, handlers: SessionHandlers) {
    this.root = root;
    this.s = s;
    this.settings = settings;
    this.handlers = handlers;
    root.innerHTML = '<canvas class="world" aria-label="City map"></canvas><div class="hud"></div>';
    this.renderer = new Renderer(root.querySelector('canvas')!);
    this.hud = new Hud(
      root.querySelector('.hud')!,
      {
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
        onHint: () => this.askHint(),
        onRegion: () => openTrade(this.s, () => this.save()),
      },
      s,
    );
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
    if (this.s.tutorial) {
      this.tutorial = new Tutorial(
        this.root,
        (campaign) => this.endTutorial(true, campaign),
        () => this.endTutorial(false, false),
      );
    } else if (this.s.outcome) {
      this.showEnding();
    } else if (intro) {
      this.showIntro();
    }
    const slot = this.slot;
    if (slot) setLastPlayed(slot);
  }

  dispose(): void {
    this.alive = false;
    cancelAnimationFrame(this.raf);
    for (const d of this.disposers) d();
    this.tutorial?.dispose();
    this.root.innerHTML = '';
    this.root.hidden = true;
  }

  applySettings(settings: Settings): void {
    this.settings = settings;
  }

  // Where this city is saved: campaign cities have their own slot, the tutorial is never saved.
  private get slot(): SlotId | null {
    if (this.s.tutorial) return null;
    return this.s.cityId ? citySlot(this.s.cityId) : 'auto';
  }

  save(): void {
    const slot = this.slot;
    if (!slot || this.s.outcome?.kind === 'smog') return;
    const ok = saveGame(slot, this.s);
    if (!ok && !this.saveFailed) pushMessage(this.s, 'Saving failed: browser storage is full or blocked. Your progress may be lost.', 'bad');
    this.saveFailed = !ok;
    if (!ok) return;
    setLastPlayed(slot);
    if (this.s.cityId) recordCity(this.s);
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
      if (!s.outcome) this.save();
    }

    this.checkTimer -= dt;
    if (this.checkTimer <= 0) {
      this.checkTimer = 1;
      if (!s.tutorial) checkCity(s);
    }

    if (!modal && s.pendingEvent) this.showEvent();
    // The ending dialog cannot be dismissed: if another dialog replaced it and was closed, show it again.
    if (!modal && s.outcome) this.showEnding();

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
      this.tutorial?.update({ s, cameraMoved: this.cameraMoved, speed: this.speed, hintUsed: this.hintUsed });
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
      case 'star': {
        audio.play('event');
        const { unlocked } = recordCity(this.s);
        for (const city of unlocked) {
          this.newlyUnlocked.push(city.name);
          pushMessage(this.s, `New city unlocked on the Scrap Coast: ${city.name}!`, 'event');
        }
        checkCampaign();
        break;
      }
    }
  }

  private panCamera(dt: number): void {
    let dx = 0;
    let dy = 0;
    const k = this.keys;
    if (k.has('KeyA') || k.has('ArrowLeft')) dx -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) dx += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) dy -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) dy += 1;
    if (this.settings.edgeScroll && this.pointer.inside && !this.drag) {
      const m = 14;
      if (this.pointer.x < m) dx -= 1;
      if (this.pointer.x > window.innerWidth - m) dx += 1;
      if (this.pointer.y < m) dy -= 1;
      if (this.pointer.y > window.innerHeight - m) dy += 1;
    }
    if (dx || dy) {
      const r = this.renderer;
      r.cam.x += (dx * PAN_SPEED * dt) / r.pxZoom;
      r.cam.y += (dy * PAN_SPEED * dt) / r.pxZoom;
      r.clampCam();
      this.cameraMoved = true;
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
  private listen<K extends keyof DocumentEventMap>(target: Document, type: K, fn: (e: DocumentEventMap[K]) => void): void;
  private listen<K extends keyof HTMLElementEventMap>(target: HTMLElement, type: K, fn: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions): void;
  private listen(target: Window | Document | HTMLElement, type: string, fn: (e: Event) => void, opts?: AddEventListenerOptions): void {
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
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size >= 2) {
        // second finger: pinch to zoom, and the first finger's tap is cancelled
        const [a, b] = [...this.pointers.values()];
        this.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.renderer.zoom };
        this.drag = null;
        return;
      }
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
      if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pinch && this.pointers.size >= 2) {
        const [a, b] = [...this.pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const target = Math.round(this.pinch.zoom * (dist / Math.max(1, this.pinch.dist)));
        if (target !== this.renderer.zoom) this.renderer.setZoom(target, (a.x + b.x) / 2, (a.y + b.y) / 2);
        this.cameraMoved = true;
        return;
      }
      const d = this.drag;
      if (!d) return;
      const dist = Math.hypot(e.clientX - d.x, e.clientY - d.y);
      const canPan = d.button === 1 || d.button === 2 || !this.build || d.pointerType === 'touch';
      if (!d.moved && dist > 6 && canPan) d.moved = true;
      if (d.moved) {
        const r = this.renderer;
        r.cam.x = d.camX - (e.clientX - d.x) / r.pxZoom;
        r.cam.y = d.camY - (e.clientY - d.y) / r.pxZoom;
        r.clampCam();
        this.cameraMoved = true;
      }
    });
    const release = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinch = null;
    };
    this.listen(canvas, 'pointerup', (e) => {
      release(e);
      const d = this.drag;
      this.drag = null;
      if (!d || d.moved) return;
      this.pointer = { x: e.clientX, y: e.clientY, inside: true };
      if (d.button === 2) this.cancelTool();
      else if (d.button === 0) this.click(e.clientX, e.clientY);
    });
    this.listen(canvas, 'pointercancel', (e) => {
      release(e);
      this.drag = null;
    });
    this.listen(canvas, 'pointerleave', () => {
      this.pointer.inside = false;
    });
    this.listen(
      canvas,
      'wheel',
      (e) => {
        e.preventDefault();
        // Trackpads send many small deltas: add them up so one gesture is one zoom step.
        // Mostly-sideways swipes are ignored; Ctrl+wheel is a trackpad pinch.
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
        const unit = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1;
        this.wheelAcc += e.deltaY * unit * (e.ctrlKey ? 4 : 1);
        if (Math.abs(this.wheelAcc) < 90) return;
        this.renderer.setZoom(this.renderer.zoom + (this.wheelAcc < 0 ? 1 : -1), e.clientX, e.clientY);
        this.wheelAcc = 0;
        this.cameraMoved = true;
      },
      { passive: false },
    );
    this.listen(window, 'keydown', (e) => this.onKeyDown(e));
    this.listen(window, 'keyup', (e) => {
      this.keys.delete(e.code);
      if (e.key === 'Meta') this.keys.clear();
    });
    this.listen(window, 'blur', () => this.keys.clear());
    // closing the tab or window mid-day should not lose the day
    this.listen(window, 'pagehide', () => this.save());
    // pause while the game is hidden (alt-tab, minimised window), resume when it comes back
    this.listen(document, 'visibilitychange', () => {
      if (document.hidden) {
        audio.suspend();
        if (this.speed > 0) {
          this.pausedByHide = true;
          this.setSpeed(0);
        }
        this.save();
      } else {
        audio.resume();
        if (this.pausedByHide) {
          this.pausedByHide = false;
          this.setSpeed(this.lastSpeed || 1);
        }
      }
    });
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (this.root.hidden) return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
    if (isModalOpen()) return;
    // Shortcuts like Cmd+S or Ctrl+Tab belong to the system (macOS never sends key-up while Cmd is held).
    if (e.ctrlKey || e.metaKey || e.altKey) {
      this.keys.clear();
      return;
    }
    const code = e.code;
    if (PAN_KEYS.includes(code)) {
      this.keys.add(code);
      e.preventDefault();
      return;
    }
    // Holding a toggle key must not flip it back and forth.
    if (e.repeat) return;
    const type = typeForHotkey(code);
    if (type) {
      this.selectBuild(type);
      return;
    }
    switch (code) {
      case 'Escape':
        if (this.build || this.bulldoze || this.selectedId >= 0) this.cancelTool();
        else this.openPause();
        break;
      case 'Space':
        e.preventDefault();
        this.setSpeed(this.speed === 0 ? this.lastSpeed || 1 : 0);
        break;
      case 'Tab':
        if (e.shiftKey) return; // Shift+Tab opens the Steam overlay
        e.preventDefault();
        this.setSpeed((this.speed % 3) + 1);
        break;
      case 'KeyX':
        this.toggleBulldoze();
        break;
      case 'KeyQ':
        this.askHint();
        break;
      case 'KeyH': {
        const hq = this.s.buildings.find((b) => b.type === 'hq');
        if (hq) this.renderer.centerOn((hq.x + 1.5) * TILE, (hq.y + 1.5) * TILE);
        break;
      }
      case 'Equal':
      case 'NumpadAdd':
      case 'BracketRight':
        this.renderer.setZoom(this.renderer.zoom + 1);
        break;
      case 'Minus':
      case 'NumpadSubtract':
      case 'BracketLeft':
        this.renderer.setZoom(this.renderer.zoom - 1);
        break;
    }
  }

  private click(sx: number, sy: number): void {
    const s = this.s;
    if (s.outcome) return;
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
      s.stats.catPets++;
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
    if (v > 0) this.pausedByHide = false;
  }

  private demolishById(id: number): void {
    const b = this.s.buildings.find((o) => o.id === id);
    if (b && demolish(this.s, b)) this.selectedId = -1;
  }

  // ---------- hints ----------

  private askHint(): void {
    if (isModalOpen()) return;
    const s = this.s;
    this.hintUsed = true;
    unlock('hint');
    if (freeHintsLeft(s) > 0) {
      s.hints.free--;
      this.showHint(s.hints.free > 0 ? `Free hints left in this city: ${s.hints.free}.` : 'That was your last free hint for now. A new one comes back every 5 days.');
      return;
    }
    const price = hintPrice(s);
    audio.play('click');
    openHintPay(price, s.res.credits >= price, () => {
      s.res.credits -= price;
      s.hints.paid++;
      this.showHint(`Paid ${price} credits. The next hint costs ${hintPrice(s)}.`);
    });
  }

  private showHint(footer: string): void {
    const hint = suggest(this.s);
    audio.play('event');
    openHint(hint, footer, () => {
      closeModal();
      if (!hint.build) return;
      this.build = null;
      this.selectBuild(hint.build);
      const btn = this.root.querySelector<HTMLElement>(`[data-tool="${hint.build}"]`);
      btn?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
      btn?.classList.add('flash');
      window.setTimeout(() => btn?.classList.remove('flash'), 1800);
    });
  }

  // ---------- tutorial ----------

  private endTutorial(finished: boolean, startCampaign: boolean): void {
    const s = this.s;
    this.tutorial = null;
    s.tutorial = false;
    s.nextEventAt = s.time + 60;
    s.nextStormAt = s.time + 200;
    setTutorialDone();
    if (finished) unlock('tutorial');
    if (startCampaign) {
      this.handlers.onTutorialDone(true);
      return;
    }
    pushMessage(s, finished ? 'Tutorial complete! This city is yours now: it saves like any free play city.' : 'Tutorial skipped. The light bulb (Q) asks USA-9 for advice.', 'good');
    this.save();
  }

  // ---------- dialogs ----------

  private showIntro(): void {
    const s = this.s;
    const city = cityById(s.cityId);
    if (city) {
      openModal({
        title: city.name,
        eyebrow: city.tagline,
        portrait: portraitUrl('usa'),
        className: 'modal-story speaker-usa',
        body: `
          <p class="story">${city.desc}</p>
          <ul class="traits">${city.traits.map((t) => `<li>${t}</li>`).join('')}</ul>
          <ul class="goals">${city.goals.map((g, i) => `<li class="${s.stars[i] ? 'got' : ''}"><span class="star">★</span>${g.text}</li>`).join('')}</ul>`,
        actions: [{ label: "Let's build", primary: true, onClick: closeModal }],
      });
      return;
    }
    openModal({
      title: `Welcome to ${s.cityName}`,
      eyebrow: 'USA-9 · Lead scrapbot',
      portrait: portraitUrl('usa'),
      className: 'modal-story speaker-usa',
      body: `
        <p class="story">Hi boss! I'm USA-9. My bots fly out and collect junk on their own. You decide what we turn it into.</p>
        <p class="story">Recycle it for a <b class="g">green</b> future, or smelt it for quick <b class="i">profit</b>. Just keep the smog meter low.</p>
        <p class="story">Finish the <b>Scrap Spire</b> and the whole city will follow the path you picked. Stuck? Click the light bulb. Miso says hi.</p>`,
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
    const kind = s.outcome.kind;
    const e = ENDINGS[kind];
    const city = cityById(s.cityId);
    if (!this.endingShown) {
      // results are recorded once, even if the dialog is shown again
      this.endingShown = true;
      unlockEnding(kind);
      checkOutcome(kind);
      checkCity(s);
      if (kind !== 'smog' && s.cityId) {
        const { unlocked } = recordCity(s);
        checkCampaign();
        this.endingUnlocks = [...this.newlyUnlocked, ...unlocked.map((c) => c.name)];
        this.newlyUnlocked = [];
      }
      audio.play(kind === 'smog' ? 'alert' : 'event');
    }
    const unlockedNote = this.endingUnlocks.length ? `<p class="unlock-note">New on the Scrap Coast: <b>${this.endingUnlocks.join(', ')}</b></p>` : '';
    // A lost city keeps its last autosave (from the start of the day), so the player can retry from there.
    const retrySlot = kind === 'smog' && this.slot && slotMeta(this.slot) ? this.slot : null;
    const stars = city
      ? `<ul class="goals">${city.goals.map((g, i) => `<li class="${s.stars[i] ? 'got' : ''}"><span class="star">★</span>${g.text}</li>`).join('')}</ul>`
      : '';
    // After a Spire ending the city can keep going; clearing the outcome lets the sim run again.
    const keepBuilding = () => {
      s.outcome = null;
      this.endingShown = false;
      this.endingUnlocks = [];
      closeModal();
      this.save();
    };
    const leave = (fn: () => void) => () => {
      if (kind !== 'smog') s.outcome = null;
      this.save();
      fn();
    };
    let actions: ModalAction[];
    if (kind === 'smog') {
      const retry: ModalAction[] = retrySlot
        ? [{ label: 'Load the last autosave', primary: true, hint: 'start of the day', onClick: () => this.handlers.onLoadSlot(retrySlot) }]
        : [];
      actions = s.cityId
        ? [
            ...retry,
            { label: 'Restart this city', primary: !retrySlot, hint: 'stars stay', onClick: () => this.handlers.onRestartCity() },
            { label: 'Region map', onClick: () => this.handlers.onRegionMap() },
          ]
        : [
            ...retry,
            { label: 'New city', primary: !retrySlot, onClick: () => this.handlers.onNewGame() },
            { label: 'Main menu', onClick: () => this.handlers.onExitToMenu() },
          ];
    } else if (s.cityId) {
      actions = [
        { label: 'Region map', primary: true, onClick: leave(() => this.handlers.onRegionMap()) },
        { label: 'Keep building here', hint: 'earn the stars you missed', onClick: keepBuilding },
      ];
    } else {
      actions = [
        { label: 'Keep building', primary: true, onClick: keepBuilding },
        { label: 'New city', onClick: leave(() => this.handlers.onNewGame()) },
        { label: 'Main menu', onClick: leave(() => this.handlers.onExitToMenu()) },
      ];
    }
    openModal({
      title: e.title,
      eyebrow: `${s.cityName} · ${e.subtitle}`,
      wide: true,
      dismissable: false,
      className: `modal-ending ending-${kind}`,
      body: `
        <p class="story">${endingText(kind, esc(s.cityName))}</p>
        ${stars}
        ${unlockedNote}
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
      actions,
    });
  }

  private openPause(): void {
    const s = this.s;
    const settings = {
      label: 'Settings',
      onClick: () =>
        openSettings(
          (set) => this.handlers.onSettingsChanged(set),
          () => this.openPause(),
        ),
    };
    let actions: ModalAction[];
    if (s.tutorial) {
      actions = [
        { label: 'Resume', primary: true, onClick: closeModal },
        settings,
        {
          label: 'Skip the tutorial',
          onClick: () => {
            closeModal();
            this.tutorial?.dispose();
            this.endTutorial(false, false);
          },
        },
        { label: 'Main menu', hint: 'the tutorial is not saved', onClick: () => this.handlers.onExitToMenu() },
      ];
    } else if (s.cityId) {
      actions = [
        { label: 'Resume', primary: true, onClick: closeModal },
        {
          label: 'Region map',
          hint: 'this city is saved',
          onClick: () => {
            this.save();
            this.handlers.onRegionMap();
          },
        },
        settings,
        {
          label: 'Main menu',
          hint: 'this city is saved',
          onClick: () => {
            this.save();
            this.handlers.onExitToMenu();
          },
        },
      ];
    } else {
      actions = [
        { label: 'Resume', primary: true, onClick: closeModal },
        { label: 'Save game', onClick: () => openSlots('save', { state: s, onBack: () => this.openPause() }) },
        { label: 'Load game', onClick: () => openSlots('load', { onLoad: (slot) => this.handlers.onLoadSlot(slot), onBack: () => this.openPause() }) },
        settings,
        {
          label: 'Save & main menu',
          onClick: () => {
            this.save();
            this.handlers.onExitToMenu();
          },
        },
      ];
    }
    openModal({
      title: 'Paused',
      eyebrow: `${s.cityName} · Day ${day(s)}`,
      body: `<p class="pause-tip">Tip: <kbd>Q</kbd> asks USA-9 for a hint, <kbd>H</kbd> jumps back to the HQ, <kbd>Tab</kbd> changes speed.</p>`,
      actions,
    });
  }
}
