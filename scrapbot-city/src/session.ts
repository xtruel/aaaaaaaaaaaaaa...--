// A running city: owns the game loop, input, camera, HUD and in-game dialogs.
import { checkCampaign, checkCity, checkOutcome, unlock } from './achievements';
import { audio } from './audio';
import { recordCity } from './campaign';
import { bulldozeRubble, demolish, packsToBuild, placeBuilding, placeCheck } from './game/actions';
import { cityById, cityDesc, cityTagline, cityTraits, goalText } from './game/cities';
import { BUILDINGS, BUILD_ORDER, T, TILE } from './game/defs';
import type { BuildingType } from './game/defs';
import { freeHintsLeft, hintPrice, suggest } from './game/hints';
import type { Hint } from './game/hints';
import { advance, computeDerived, dayPhase } from './game/sim';
import { canAutosave, day, idx, inBounds, pushMessage } from './game/state';
import type { FxEvent, GameState } from './game/state';
import { endingSubtitle, endingText, endingTitle, eventById } from './game/story';
import { padMode } from './gamepad';
import type { PadFrame, PadTarget } from './gamepad';
import { t } from './i18n';
import { localizeKeys } from './keys';
import { portraitUrl } from './render/icons';
import { Renderer } from './render/renderer';
import { citySlot, saveGame, setLastPlayed, setTutorialDone, slotMeta, unlockEnding } from './storage';
import type { Settings, SlotId } from './storage';
import { openHint, openHintPay, openImport, openSettings, openSlots, openStoryEvent, openTrade } from './ui/dialogs';
import { Hud, typeForHotkey } from './ui/hud';
import { esc } from './ui/escape';
import { closeModal, isModalOpen, openModal } from './ui/modal';
import type { ModalAction } from './ui/modal';
import { Tutorial } from './ui/tutorial';
import type { Box } from './ui/tutorial';

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
const CURSOR_SPEED = 900; // controller cursor, screen px per second at full tilt
// WASD by physical position: ZQSD on AZERTY keyboards.
const PAN_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];

export class GameSession implements PadTarget {
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
  private hoverId = -1; // building under the pointer (its visible pixels)
  private pointer = { x: -1, y: -1, inside: false };
  private keys = new Set<string>();
  private drag: Drag | null = null;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinch: { dist: number; zoom: number; mx: number; my: number } | null = null;
  private wheelAcc = 0;
  private saveFailed = false;
  private unsaved = false;
  private simDt = 0;
  private homeSlot: SlotId | null; // free play slot this city was loaded from (autosaves go back there) // the training yard kept after the tutorial, when the player keeps their free play city
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
  private pausedByHide = false;
  private newlyUnlocked: string[] = [];
  private endingUnlocks: string[] = [];
  private alive = false;
  private disposers: (() => void)[] = [];
  private held = false; // the world under an open dialog is painted once, then held
  private padCursor!: HTMLElement;
  private padOn = false;
  private hudCheckIn = 0; // seconds until the HUD's size is measured again (camera margins)
  private padHover: HTMLElement | null = null;
  private cursor = { x: 0, y: 0 };

  constructor(root: HTMLElement, s: GameState, settings: Settings, handlers: SessionHandlers, fromSlot: SlotId | null = null) {
    this.root = root;
    this.s = s;
    this.homeSlot = fromSlot;
    // stats shown by the HUD and used by hints are ready before the first step (paused, intro dialog, pending event)
    computeDerived(s);
    this.settings = settings;
    this.handlers = handlers;
    root.innerHTML = `<canvas class="world" aria-label="${t('hud.map')}"></canvas><div class="hud"></div><div class="pad-cursor" aria-hidden="true" hidden></div>`;
    this.padCursor = root.querySelector('.pad-cursor')!;
    this.renderer = new Renderer(root.querySelector('canvas')!);
    this.hud = new Hud(
      root.querySelector('.hud')!,
      {
        onBuild: (t) => this.selectBuild(t),
        onBulldoze: () => this.toggleBulldoze(),
        onImport: () => openImport(this.s, {}),
        onSpeed: (v) => this.setSpeed(v),
        onMenu: () => this.openPause(),
        onDemolish: (id) => this.demolishById(id),
        onTogglePause: (id) => {
          const b = this.s.buildings.find((o) => o.id === id);
          if (b) b.paused = !b.paused;
        },
        onCloseInspector: () => (this.selectedId = -1),
        onHint: () => this.askHint(),
        onRegion: () => openTrade(this.s, () => this.autosave()),
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
      const raw = Math.max(0, (now - this.last) / 1000);
      this.last = now;
      // animations take at most a 0.1 s step; the simulation catches up on up to 0.25 s of a slow frame
      this.simDt = Math.min(0.25, raw);
      this.frame(Math.min(0.1, raw));
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
    this.hud.dispose();
    this.tutorial?.dispose();
    this.root.innerHTML = '';
    this.root.hidden = true;
  }

  applySettings(settings: Settings): void {
    this.settings = settings;
  }

  relabel(): void {
    this.root.querySelector('canvas.world')?.setAttribute('aria-label', t('hud.map'));
    this.hud.relabel();
    this.tutorial?.relabel();
  }

  // Where this city is saved: campaign cities have their own slot, the tutorial is never saved.
  private get slot(): SlotId | null {
    if (this.s.tutorial || this.unsaved) return null;
    if (this.s.cityId) return citySlot(this.s.cityId);
    return this.homeSlot ?? 'auto';
  }

  // Automatic saves (new day, window closed) skip a running smog countdown, see canAutosave.
  private autosave(): void {
    if (!canAutosave(this.s)) return;
    this.save();
  }

  save(): void {
    const slot = this.slot;
    if (!slot || this.s.outcome?.kind === 'smog') return;
    const ok = saveGame(slot, this.s);
    if (!ok && !this.saveFailed) pushMessage(this.s, t('msg.saveFailed'), 'bad');
    this.saveFailed = !ok;
    if (!ok) return;
    setLastPlayed(slot);
    if (this.s.cityId) recordCity(this.s);
  }

  // ---------- loop ----------

  // The top bar and the build toolbar cover the map: the camera gets matching margins (see clampCam).
  private measureHud(): void {
    const top = this.root.querySelector<HTMLElement>('.hud-top');
    const bar = this.root.querySelector<HTMLElement>('[data-toolbar]');
    const insets = {
      top: top?.offsetParent ? Math.max(0, Math.round(top.getBoundingClientRect().bottom)) : 0,
      bottom: bar?.offsetParent ? Math.max(0, Math.round(window.innerHeight - bar.getBoundingClientRect().top)) : 0,
    };
    const r = this.renderer;
    if (insets.top === r.insets.top && insets.bottom === r.insets.bottom) return;
    r.insets = insets;
    r.clampCam();
  }

  private frame(dt: number): void {
    const s = this.s;
    const modal = isModalOpen();
    this.hudCheckIn -= dt;
    if (this.hudCheckIn <= 0) {
      this.hudCheckIn = 0.5;
      this.measureHud();
    }
    // controller unplugged: its cursor and the placement ghost under it go away
    if (this.padOn && !padMode()) {
      this.padOn = false;
      this.padCursor.hidden = true;
      this.pointer.inside = false;
    }
    const running = !modal && this.speed > 0 && !s.outcome && !s.pendingEvent;
    if (running) {
      this.acc = advance(s, this.acc, this.simDt, this.speed);
    } else {
      computeDerived(s);
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
      if (!s.outcome) this.autosave();
    }

    this.checkTimer -= dt;
    if (this.checkTimer <= 0) {
      this.checkTimer = 1;
      if (!s.tutorial) checkCity(s);
      // the soundtrack follows the clock: "Neon Hum" from 20:00 to 05:00
      const hour = (dayPhase(s) * 24 + 6) % 24;
      audio.setMusic(hour >= 20 || hour < 5 ? 'night' : 'day');
    }

    if (!modal && s.pendingEvent) this.showEvent();
    // The ending dialog cannot be dismissed: if another dialog replaced it and was closed, show it again.
    if (!modal && s.outcome) this.showEnding();

    if (!modal) this.panCamera(dt);
    this.updateHover();
    // behind a dialog the world is paused and blurred: paint it once and let the GPU rest
    const hold = modal && this.held;
    this.held = modal;
    if (!hold) {
      this.renderer.render(
        s,
        {
          hover: this.hover,
          build: this.build,
          bulldoze: this.bulldoze,
          selectedId: this.selectedId,
          hoverId: this.hoverId,
          reducedMotion: this.settings.reducedMotion,
        },
        dt,
        running,
      );
    }

    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.1;
      const goalCard = !this.tutorial || this.tutorial.showsGoal;
      this.hud.update(s, { speed: this.speed, build: this.build, bulldoze: this.bulldoze, selectedId: this.selectedId, goalCard });
      // a tutorial step done by placing a building puts the build tool away, so the next step starts clean
      // instead of with a red "already there" ghost on the building just placed
      if (this.tutorial?.update({ s, cameraMoved: this.cameraMoved, speed: this.speed, hq: this.hqBox() })) this.cancelTool();
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
        if (fx.coins && now - this.lastCoin > 1500) {
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
          pushMessage(this.s, t('msg.cityUnlocked', { city: city.name }), 'event');
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
    if (this.settings.edgeScroll && this.pointer.inside && !this.drag && !padMode()) {
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
      this.hoverId = -1;
      return;
    }
    this.hover = this.renderer.screenToTile(this.pointer.x, this.pointer.y);
    this.hoverId = this.build ? -1 : this.renderer.pickBuilding(this.pointer.x, this.pointer.y);
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
    this.listen(window, 'resize', () => {
      this.renderer.resize();
      this.held = false;
    });
    this.listen(canvas, 'contextmenu', (e) => e.preventDefault());
    this.listen(canvas, 'pointerdown', (e) => {
      audio.unlock();
      canvas.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size >= 2) {
        // second finger: pinch to zoom, and the first finger's tap is cancelled
        const [a, b] = [...this.pointers.values()];
        this.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.renderer.zoom, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
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
      // a press that began before a dialog opened (a story event, an ending) must not pan or build behind it
      if (isModalOpen()) {
        this.drag = null;
        this.pinch = null;
        this.pointers.clear();
        return;
      }
      if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pinch && this.pointers.size >= 2) {
        // two fingers: their distance zooms, their midpoint drags the map along
        const [a, b] = [...this.pointers.values()];
        const r = this.renderer;
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const target = Math.round(this.pinch.zoom * (dist / Math.max(1, this.pinch.dist)));
        if (target !== r.zoom) r.setZoom(target, mx, my);
        r.cam.x += (this.pinch.mx - mx) / r.pxZoom;
        r.cam.y += (this.pinch.my - my) / r.pxZoom;
        r.clampCam();
        this.pinch.mx = mx;
        this.pinch.my = my;
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
    // Returns true when the lifted finger ended a pinch: the finger still down goes on dragging the map.
    const release = (e: PointerEvent): boolean => {
      const pinching = this.pinch !== null;
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinch = null;
      if (pinching && this.pointers.size === 1) {
        const [p] = [...this.pointers.values()];
        const r = this.renderer;
        this.drag = { x: p.x, y: p.y, camX: r.cam.x, camY: r.cam.y, moved: true, button: 0, pointerType: 'touch' };
      }
      return pinching;
    };
    this.listen(canvas, 'pointerup', (e) => {
      if (release(e)) return;
      const d = this.drag;
      this.drag = null;
      if (!d || d.moved || isModalOpen()) return;
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
    this.listen(window, 'pagehide', () => this.autosave());
    // pause while the game is hidden (alt-tab, minimised window), resume when it comes back
    this.listen(document, 'visibilitychange', () => {
      if (document.hidden) {
        audio.suspend();
        if (this.speed > 0) {
          this.pausedByHide = true;
          this.setSpeed(0);
        }
        this.autosave();
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
      case 'KeyH':
      case 'Home': {
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
    const tile = this.renderer.screenToTile(sx, sy);
    if (this.build) {
      const type = this.build;
      const def = BUILDINGS[type];
      const ox = tile.x - Math.floor((def.w - 1) / 2);
      const oy = tile.y - Math.floor((def.h - 1) / 2);
      // only parts missing, and credits to cover them: offer to buy them from 2PM and build right here
      const packs = packsToBuild(s, type);
      if (packs > 0 && placeCheck(s, type, ox, oy).costOnly) {
        openImport(s, {
          need: {
            packs,
            onBuild: () => {
              if (placeBuilding(s, type, ox, oy) && type === 'spire') this.build = null;
            },
          },
        });
        return;
      }
      const b = placeBuilding(s, type, ox, oy);
      if (!b) audio.play('error');
      else if (type === 'spire') this.build = null;
      return;
    }
    // what you see is what you click: a building's roof or walls select it even over another tile
    const picked = this.renderer.pickBuilding(sx, sy);
    if (picked >= 0 && !(this.bulldoze && inBounds(tile.x, tile.y) && s.tiles[idx(tile.x, tile.y)] === T.RUBBLE && s.occ[idx(tile.x, tile.y)] === -1)) {
      this.selectedId = picked;
      audio.play('click');
      return;
    }
    if (picked === -2 && !this.bulldoze) {
      this.petCat();
      return;
    }
    if (!inBounds(tile.x, tile.y)) {
      this.selectedId = -1;
      return;
    }
    const i = idx(tile.x, tile.y);
    if (this.bulldoze) {
      if (s.tiles[i] === T.RUBBLE) {
        if (!bulldozeRubble(s, tile.x, tile.y)) audio.play('error');
      } else if (s.occ[i] !== -1) {
        this.selectedId = s.occ[i];
        audio.play('click');
      } else {
        pushMessage(s, t('msg.bulldozeHelp'), 'info');
      }
      return;
    }
    if (s.occ[i] !== -1) {
      this.selectedId = s.occ[i];
      audio.play('click');
      return;
    }
    const w = this.renderer.screenToWorld(sx, sy);
    if (Math.hypot(w.x - s.cat.x, w.y - s.cat.y) < 6) {
      this.petCat();
      return;
    }
    this.selectedId = -1;
    if (s.tiles[i] === T.JUNK) pushMessage(s, t(s.res.scrap >= s.derived.storage ? 'msg.junkInfoFull' : 'msg.junkInfo', { n: s.amount[i] }), 'info');
    else if (s.tiles[i] === T.SLUDGE) pushMessage(s, t('msg.sludgeInfo'), 'info');
    else if (s.tiles[i] === T.RUBBLE) pushMessage(s, t('msg.rubbleInfo'), 'info');
  }

  private petCat(): void {
    const s = this.s;
    s.happyMod = Math.min(s.happyMod + 1, 15);
    s.stats.catPets++;
    pushMessage(s, t((['msg.miso1', 'msg.miso2', 'msg.miso3'] as const)[Math.floor(Math.random() * 3)]), 'good');
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

  // The HQ and two tiles around it, in screen pixels (the tutorial keeps its bubble off this area).
  private hqBox(): Box | null {
    const hq = this.s.buildings.find((b) => b.type === 'hq');
    if (!hq) return null;
    const box = this.renderer.buildingScreenBox(hq);
    const m = 24;
    return { left: box.left - m, top: box.top - m, right: box.right + m, bottom: box.bottom + m };
  }

  // ---------- controller ----------

  // A virtual cursor stands in for the mouse. Returns false while a dialog has the pad.
  padFrame(f: PadFrame): boolean {
    if (!this.alive || this.root.hidden || isModalOpen()) {
      this.padCursor.hidden = true;
      return false;
    }
    if (!padMode()) {
      this.padCursor.hidden = true;
      this.padOn = false;
      return true;
    }
    const r = this.renderer;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const c = this.cursor;
    if (!this.padOn) {
      this.padOn = true;
      c.x = this.pointer.inside ? this.pointer.x : w / 2;
      c.y = this.pointer.inside ? this.pointer.y : h / 2;
    }

    // left stick moves the cursor (faster the further it is pushed); pushing against an edge scrolls
    const mag = Math.hypot(f.lx, f.ly);
    c.x += f.lx * mag * CURSOR_SPEED * f.dt;
    c.y += f.ly * mag * CURSOR_SPEED * f.dt;
    let px = f.rx;
    let py = f.ry;
    if ((c.x < 1 && f.lx < 0) || (c.x > w - 2 && f.lx > 0)) px += f.lx;
    if ((c.y < 1 && f.ly < 0) || (c.y > h - 2 && f.ly > 0)) py += f.ly;
    c.x = Math.max(0, Math.min(w - 1, c.x));
    c.y = Math.max(0, Math.min(h - 1, c.y));
    if (px || py) {
      r.cam.x += (px * PAN_SPEED * 1.5 * f.dt) / r.pxZoom;
      r.cam.y += (py * PAN_SPEED * 1.5 * f.dt) / r.pxZoom;
      r.clampCam();
      this.cameraMoved = true;
    }

    // D-pad: one tile at a time along the grid axes, turned 45° for the isometric view (up = north-east,
    // right = south-east, down = south-west, left = north-west), so every tile can be reached;
    // the map scrolls when the cursor nears the HUD
    for (const [dir, dx, dy] of [
      ['up', 0, -1],
      ['down', 0, 1],
      ['left', -1, 0],
      ['right', 1, 0],
    ] as const) {
      if (!f.pressed.has(dir)) continue;
      const tile = r.screenToTile(c.x, c.y);
      // the cursor stops at the map's edge (it may come back in from outside)
      if (inBounds(tile.x, tile.y) && !inBounds(tile.x + dx, tile.y + dy)) continue;
      const toScreen = () => r.tileToScreen(tile.x + dx, tile.y + dy);
      let p = toScreen();
      // near the screen's edge or under the HUD (toolbar, objective card): the map moves one tile instead,
      // so the new tile lands where the cursor was
      const covered = () => document.elementFromPoint(p.x, p.y) !== r.canvas;
      if (p.x < w * 0.15 || p.x > w * 0.85 || p.y < h * 0.18 || p.y > h * 0.75 || covered()) {
        r.panTiles(dx, dy);
        this.cameraMoved = true;
        p = toScreen();
      }
      c.x = Math.max(0, Math.min(w - 1, p.x));
      c.y = Math.max(0, Math.min(h - 1, p.y));
    }

    const el = document.elementFromPoint(c.x, c.y) as HTMLElement | null;
    const overMap = el === r.canvas;
    this.pointer = { x: c.x, y: c.y, inside: overMap };
    // over the HUD the cursor focuses buttons, which also shows the build tooltips
    const btn = overMap ? null : (el?.closest<HTMLElement>('button') ?? null);
    if (btn !== this.padHover) {
      if (this.padHover && document.activeElement === this.padHover) this.padHover.blur();
      this.padHover = btn;
      btn?.focus({ preventScroll: true });
    }
    this.padCursor.hidden = false;
    this.padCursor.classList.toggle('building', !!this.build || this.bulldoze);
    this.padCursor.style.transform = `translate(${Math.round(c.x)}px, ${Math.round(c.y)}px)`;

    const p = f.pressed;
    if (p.has('a')) {
      audio.unlock();
      if (overMap) this.click(c.x, c.y);
      else (btn ?? el)?.click();
    }
    if (p.has('b') && (this.build || this.bulldoze || this.selectedId >= 0)) this.cancelTool();
    if (p.has('x')) this.toggleBulldoze();
    if (p.has('y')) this.askHint();
    if (p.has('lb') || p.has('rb')) {
      const dir = p.has('rb') ? 1 : -1;
      const n = BUILD_ORDER.length;
      const i = this.build ? BUILD_ORDER.indexOf(this.build) : dir > 0 ? -1 : n;
      this.selectBuild(BUILD_ORDER[(i + dir + n) % n]);
      audio.play('click');
    }
    if (p.has('lt') || p.has('rt')) {
      r.setZoom(r.zoom + (p.has('rt') ? 1 : -1), c.x, c.y);
      this.cameraMoved = true;
    }
    if (p.has('back')) this.setSpeed(this.speed === 0 ? this.lastSpeed || 1 : 0);
    if (p.has('ls')) this.setSpeed((this.speed % 3) + 1);
    if (p.has('rs')) {
      const hq = this.s.buildings.find((b) => b.type === 'hq');
      if (hq) r.centerOn((hq.x + 1.5) * TILE, (hq.y + 1.5) * TILE);
    }
    if (p.has('start')) this.openPause();
    return true;
  }

  // ---------- hints ----------

  private askHint(): void {
    if (isModalOpen()) return;
    const s = this.s;
    unlock('hint');
    // asking twice for the same thing on the same day, or being told to wait, costs nothing
    const next = suggest(s);
    const title = next.title;
    if (next.free || (title === s.hints.lastTitle && day(s) === s.hints.lastDay)) {
      this.showHint(t('hint.repeat'), next);
      return;
    }
    // only a hint that is actually shown counts as "asked today" (declining the paid one does not)
    const remember = () => {
      s.hints.lastTitle = title;
      s.hints.lastDay = day(s);
    };
    if (freeHintsLeft(s) > 0) {
      s.hints.free--;
      remember();
      this.showHint(s.hints.free > 0 ? t('hint.freeLeft', { n: s.hints.free }) : t('hint.lastFree'), next);
      return;
    }
    const price = hintPrice(s);
    audio.play('click');
    openHintPay(price, s.res.credits >= price, () => {
      s.res.credits -= price;
      s.hints.paid++;
      remember();
      // the advice paid for is the one chosen before paying (paying must not change it)
      this.showHint(t('hint.paid', { n: price, next: hintPrice(s) }), next);
    });
  }

  private showHint(footer: string, hint: Hint = suggest(this.s)): void {
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
    pushMessage(s, finished ? t('msg.tutorialDone') : padMode() ? t('msg.tutorialSkippedPad') : localizeKeys(t('msg.tutorialSkipped')), 'good');
    // free play has one autosave: the training yard never replaces a city without asking
    const old = slotMeta('auto');
    if (!old) {
      this.save();
      return;
    }
    // until the player answers, nothing is saved (closing the window now keeps the old city)
    this.unsaved = true;
    openModal({
      title: t('free.replace.title'),
      body: `<p>${t('free.replace.body', { city: esc(old.city), day: old.day })}</p>`,
      // two real choices: Esc, B or a click outside must not leave the saved city exposed to the next autosave
      dismissable: false,
      actions: [
        {
          label: t('free.replace.go'),
          primary: true,
          onClick: () => {
            closeModal();
            this.unsaved = false;
            this.save();
          },
        },
        {
          label: t('tut.keepOld'),
          onClick: () => {
            closeModal();
            this.unsaved = true;
            pushMessage(s, t('msg.tutorialNotSaved'), 'info');
          },
        },
      ],
    });
  }

  // ---------- dialogs ----------

  private showIntro(): void {
    const s = this.s;
    const city = cityById(s.cityId);
    if (city) {
      openModal({
        title: city.name,
        eyebrow: cityTagline(city),
        portrait: portraitUrl('usa'),
        className: 'modal-story speaker-usa',
        body: `
          <p class="story">${cityDesc(city)}</p>
          <ul class="traits">${cityTraits(city).map((trait) => `<li>${trait}</li>`).join('')}</ul>
          <ul class="goals">${city.goals.map((_, i) => `<li class="${s.stars[i] ? 'got' : ''}"><span class="star">★</span>${goalText(city, i)}</li>`).join('')}</ul>`,
        actions: [{ label: t('intro.build'), primary: true, onClick: closeModal }],
      });
      return;
    }
    openModal({
      title: t('intro.title', { city: s.cityName }),
      eyebrow: t('intro.eyebrow'),
      portrait: portraitUrl('usa'),
      className: 'modal-story speaker-usa',
      body: `
        <p class="story">${t('intro.p1')}</p>
        <p class="story">${t('intro.p2')}</p>
        <p class="story">${t('intro.p3')}</p>`,
      actions: [{ label: t('intro.go'), primary: true, onClick: closeModal }],
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
    const unlockedNote = this.endingUnlocks.length ? `<p class="unlock-note">${t('end.unlocked', { cities: this.endingUnlocks.join(', ') })}</p>` : '';
    // A lost city keeps its last autosave (from the start of the day), so the player can retry from there.
    const retrySlot = kind === 'smog' && this.slot && slotMeta(this.slot) ? this.slot : null;
    const stars = city
      ? `<ul class="goals">${city.goals.map((_, i) => `<li class="${s.stars[i] ? 'got' : ''}"><span class="star">★</span>${goalText(city, i)}</li>`).join('')}</ul>`
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
        ? [{ label: t('end.loadAutosave'), primary: true, hint: t('end.loadAutosave.hint'), onClick: () => this.handlers.onLoadSlot(retrySlot) }]
        : [];
      actions = s.cityId
        ? [
            ...retry,
            { label: t('end.restart'), primary: !retrySlot, hint: t('end.restart.hint'), onClick: () => this.handlers.onRestartCity() },
            { label: t('end.regionMap'), onClick: () => this.handlers.onRegionMap() },
          ]
        : [
            ...retry,
            { label: t('end.newCity'), primary: !retrySlot, onClick: () => this.handlers.onNewGame() },
            { label: t('end.mainMenu'), onClick: () => this.handlers.onExitToMenu() },
          ];
    } else if (s.cityId) {
      actions = [
        { label: t('end.regionMap'), primary: true, onClick: leave(() => this.handlers.onRegionMap()) },
        { label: t('end.keepHere'), hint: t('end.keepHere.hint'), onClick: keepBuilding },
      ];
    } else {
      actions = [
        { label: t('end.keep'), primary: true, onClick: keepBuilding },
        { label: t('end.newCity'), onClick: leave(() => this.handlers.onNewGame()) },
        { label: t('end.mainMenu'), onClick: leave(() => this.handlers.onExitToMenu()) },
      ];
    }
    openModal({
      title: endingTitle(kind),
      eyebrow: `${s.cityName} · ${endingSubtitle(kind)}`,
      wide: true,
      dismissable: false,
      className: `modal-ending ending-${kind}`,
      body: `
        <p class="story">${endingText(kind, esc(s.cityName))}</p>
        ${stars}
        ${unlockedNote}
        <dl class="stats">
          <dt>${t('end.days')}</dt><dd>${s.outcome.day}</dd>
          <dt>${t('end.citizens')}</dt><dd>${Math.floor(s.pop)}</dd>
          <dt>${t('end.scrap')}</dt><dd>${Math.floor(s.stats.scrapCollected)}</dd>
          <dt>${t('end.buildings')}</dt><dd>${s.stats.built}</dd>
          <dt>${t('end.sludge')}</dt><dd>${s.stats.cleaned}</dd>
          <dt>${t('end.credits')}</dt><dd>${Math.floor(s.stats.creditsEarned)}</dd>
          <dt>${t('end.path')}</dt><dd>${s.alignment >= 0 ? t('end.pathGreen', { n: Math.round(s.alignment) }) : t('end.pathIndustrial', { n: Math.round(-s.alignment) })}</dd>
          <dt>${t('end.smog')}</dt><dd>${Math.round(s.pollution)}%</dd>
        </dl>`,
      actions,
    });
  }

  private openPause(): void {
    const s = this.s;
    const settings = {
      label: t('menu.settings'),
      onClick: () =>
        openSettings(
          this.settings,
          (set) => this.handlers.onSettingsChanged(set),
          () => this.openPause(),
        ),
    };
    let actions: ModalAction[];
    if (s.tutorial) {
      actions = [
        { label: t('pause.resume'), primary: true, onClick: closeModal },
        settings,
        {
          label: t('pause.skipTutorial'),
          onClick: () => {
            closeModal();
            this.tutorial?.dispose();
            this.endTutorial(false, false);
          },
        },
        { label: t('pause.mainMenu'), hint: t('pause.tutorialNotSaved'), onClick: () => this.handlers.onExitToMenu() },
      ];
    } else if (s.cityId) {
      actions = [
        { label: t('pause.resume'), primary: true, onClick: closeModal },
        {
          label: t('pause.region'),
          hint: t('pause.saved'),
          onClick: () => {
            this.save();
            this.handlers.onRegionMap();
          },
        },
        settings,
        {
          label: t('pause.mainMenu'),
          hint: t('pause.saved'),
          onClick: () => {
            this.save();
            this.handlers.onExitToMenu();
          },
        },
      ];
    } else {
      actions = [
        { label: t('pause.resume'), primary: true, onClick: closeModal },
        { label: t('pause.save'), onClick: () => openSlots('save', { state: s, onBack: () => this.openPause() }) },
        { label: t('pause.load'), onClick: () => openSlots('load', { onLoad: (slot) => this.handlers.onLoadSlot(slot), onBack: () => this.openPause() }) },
        settings,
        {
          label: t('pause.saveMenu'),
          onClick: () => {
            this.save();
            this.handlers.onExitToMenu();
          },
        },
      ];
    }
    openModal({
      title: t('pause.title'),
      eyebrow: t('pause.eyebrow', { city: s.cityName, day: day(s) }),
      body: `<p class="pause-tip">${localizeKeys(t('pause.tip'))}</p>`,
      actions,
    });
  }
}
