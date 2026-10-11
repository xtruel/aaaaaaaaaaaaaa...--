// A running city: owns the game loop, input, camera, HUD and in-game dialogs.
import { checkCampaign, checkCity, checkOutcome, unlock } from './achievements';
import { audio } from './audio';
import { recordCity } from './campaign';
import { bulldozeRubble, demolish, packsToBuild, placeBuilding, placeCheck } from './game/actions';
import { cityById, cityDesc, cityTagline, cityTraits, goalText } from './game/cities';
import { BUILDINGS, BUILD_ORDER, MAP_H, MAP_W, T, TILE } from './game/defs';
import type { BuildingType } from './game/defs';
import { freeHintsLeft, hintPrice, suggest } from './game/hints';
import type { Hint } from './game/hints';
import { dragPath, floorAt, installModule, isModuleKind, isPieceKind, moduleCheck, normRot, pieceAt, pieceCheck, placePiece, removeModule, removePieceAt, rotatePieceAt } from './game/pieces';
import type { CatalogKind, ModuleKind } from './game/pieces';
import { advance, computeDerived, dayPhase } from './game/sim';
import { canAutosave, day, idx, inBounds, pushMessage } from './game/state';
import type { Building, FxEvent, GameState } from './game/state';
import { endingSubtitle, endingText, endingTitle, eventById } from './game/story';
import { padMode } from './gamepad';
import type { PadFrame, PadTarget } from './gamepad';
import { t } from './i18n';
import { localizeKeys } from './keys';
import { portraitUrl } from './render/icons';
import { Renderer } from './render/renderer';
import { citySlot, saveGame, setLastPlayed, setTutorialDone, slotMeta, unlockEnding } from './storage';
import type { Settings, SlotId } from './storage';
import { isRotatable, isRowKind, moduleLabel, moduleNeeds, pieceInfo } from './ui/catalog';
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
  far?: boolean; // a left-button drag that went too far to count as a click
  button: number;
  pointerType: string;
}

// A row of floor or fence dragged out with the left mouse button: ghosts while dragging, bought on release.
interface Row {
  x: number; // tile where the drag began
  y: number;
  xFirst: boolean | null; // which leg of an L comes first: set by the first move away from the start tile
  tiles: { x: number; y: number }[];
}

const PAN_SPEED = 260; // screen px per second
const CURSOR_SPEED = 900; // controller cursor, screen px per second at full tilt
const PANEL_SCROLL = 700; // right stick over a side panel that scrolls, px per second
// WASD by physical position: ZQSD on AZERTY keyboards.
const PAN_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];

// The part of the HUD under a point that scrolls and has more to show (a long side panel), or null.
function scrollableAt(el: Element | null): HTMLElement | null {
  for (let n = el instanceof HTMLElement ? el : null; n && !n.classList.contains('hud'); n = n.parentElement) {
    if (n.scrollHeight > n.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(n).overflowY)) return n;
  }
  return null;
}

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
  // Objects & modules: the catalog tool in hand (exclusive with build and bulldoze), the turn each piece had
  // last (kept when it is picked again), the open panel, the selected piece and a row being dragged
  private piece: { kind: CatalogKind; rot: number } | null = null;
  private pieceRot: Partial<Record<CatalogKind, number>> = {};
  private catalog = false;
  private selectedPiece = -1; // tile index of the selected fence, gate, lamp or floor
  private row: Row | null = null;
  private rotAcc = 0; // Shift+wheel, added up like the zoom
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
        onCloseInspector: () => {
          this.selectedId = -1;
          this.selectedPiece = -1;
        },
        onHint: () => this.askHint(),
        onRegion: () => openTrade(this.s, () => this.autosave()),
        onCatalog: () => this.toggleCatalog(),
        onPick: (kind) => this.pickItem(kind),
        onRotate: () => this.rotateTool(1),
        onInstall: (id, kind) => this.install(id, kind),
        onRemoveModule: (id, kind) => {
          const b = this.s.buildings.find((o) => o.id === id);
          if (b) removeModule(this.s, kind, b);
        },
        onRotatePiece: (i) => this.rotatePiece(i, 1),
        onRemovePiece: (i) => {
          // only the piece still selected: the second click of a double click, on the button before the panel
          // follows, must not take up the floor under a lamp just removed
          if (i === this.selectedPiece && removePieceAt(this.s, i % MAP_W, Math.floor(i / MAP_W))) this.selectedPiece = -1;
        },
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
    // words on the map (a module's effect, why a piece cannot go there) also keep clear of an open side panel and
    // of the goal card; on a narrow window both sit across the bottom
    r.labelAvoid = [...this.root.querySelectorAll<HTMLElement>('[data-inspector], [data-catalog-panel], [data-objective]')]
      .filter((el) => el.offsetParent)
      .map((el) => el.getBoundingClientRect());
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
    this.updateRow();
    // a piece taken up meanwhile (bulldozer, a removal elsewhere) is no longer selected
    if (this.selectedPiece >= 0 && !pieceInfo(s, this.selectedPiece)) this.selectedPiece = -1;
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
          piece: this.piece,
          selectedPiece: this.selectedPiece,
          pieceRow: this.row && this.row.tiles.length > 1 ? this.row.tiles : null,
          pieceLabel: this.pieceLabel(),
        },
        dt,
        running,
      );
    }

    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.1;
      const goalCard = !this.tutorial || this.tutorial.showsGoal;
      this.hud.update(s, {
        speed: this.speed,
        build: this.build,
        bulldoze: this.bulldoze,
        selectedId: this.selectedId,
        goalCard,
        piece: this.piece,
        catalog: this.catalog,
        selectedPiece: this.selectedPiece,
      });
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
      this.hover = this.pointer.inside && (this.build || this.piece) ? this.hover : null;
      this.hoverId = -1;
      return;
    }
    this.hover = this.renderer.screenToTile(this.pointer.x, this.pointer.y);
    // with a building or a piece in hand the ghost is what counts; a module goes on the building pointed at
    const placing = this.build || (this.piece && !isModuleKind(this.piece.kind));
    this.hoverId = placing ? -1 : this.renderer.pickBuilding(this.pointer.x, this.pointer.y);
  }

  // The dragged row follows the tile under the pointer (also while the keys move the map), up to the map's edge.
  private updateRow(): void {
    const r = this.row;
    if (!r || !this.hover) return;
    const x = Math.max(0, Math.min(MAP_W - 1, this.hover.x));
    const y = Math.max(0, Math.min(MAP_H - 1, this.hover.y));
    // back on the start tile, the next move chooses again which way the row goes first
    if (x === r.x && y === r.y) r.xFirst = null;
    else if (r.xFirst === null) r.xFirst = Math.abs(x - r.x) >= Math.abs(y - r.y);
    r.tiles = dragPath(r.x, r.y, x, y, r.xFirst ?? true);
  }

  // Next to the building the module tool points at: what the module would change there. Null lets the
  // renderer show moduleCheck's reason instead (wrong building, already installed, too expensive).
  private pieceLabel(): string | null {
    const p = this.piece;
    if (!p || !isModuleKind(p.kind) || !this.pointer.inside || !this.hover) return null;
    const b = this.moduleTarget(this.pointer.x, this.pointer.y);
    return b && moduleCheck(this.s, p.kind, b).ok ? moduleLabel(b, p.kind) : null;
  }

  // The building a module would go on: the one drawn under the point, else the one standing on that tile.
  private moduleTarget(sx: number, sy: number): Building | null {
    const s = this.s;
    let id = this.renderer.pickBuilding(sx, sy);
    if (id < 0) {
      const tile = this.renderer.screenToTile(sx, sy);
      id = inBounds(tile.x, tile.y) ? s.occ[idx(tile.x, tile.y)] : -1;
    }
    return id >= 0 ? (s.buildings.find((b) => b.id === id) ?? null) : null;
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
      // with floor or fence in hand the left mouse button drags out a row (a finger still moves the map)
      this.row = null;
      if (e.button === 0 && e.pointerType === 'mouse' && isRowKind(this.piece?.kind) && !isModalOpen()) {
        const tile = this.renderer.screenToTile(e.clientX, e.clientY);
        if (inBounds(tile.x, tile.y)) this.row = { x: tile.x, y: tile.y, xFirst: null, tiles: [tile] };
      }
    });
    this.listen(canvas, 'pointermove', (e) => {
      this.pointer = { x: e.clientX, y: e.clientY, inside: true };
      // a press that began before a dialog opened (a story event, an ending) must not pan or build behind it
      if (isModalOpen()) {
        this.drag = null;
        this.row = null;
        this.pinch = null;
        this.pointers.clear();
        return;
      }
      // the right button pressed while the left one is down (a chord) cancels, as a right click does: a row
      // being dragged is not bought on release
      if (e.pointerType === 'mouse' && e.button === 2 && this.drag?.button === 0) {
        this.cancelTool();
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
      // The left mouse button selects and builds, it never moves the map: the right or middle button does
      // (as do WASD, the arrows and the screen edges). A finger or a pen has no other button, so it pans.
      const canPan = d.button === 1 || d.button === 2 || d.pointerType !== 'mouse';
      if (!d.moved && dist > 6 && canPan) d.moved = true;
      if (!canPan && dist > 12) d.far = true;
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
      if (this.row) {
        // the row ends on the tile under the release point
        this.hover = this.renderer.screenToTile(e.clientX, e.clientY);
        this.updateRow();
      }
      const row = this.row;
      this.row = null;
      if (!d || d.moved || isModalOpen()) return;
      // a left-button drag with no tool in hand is not a click (it used to move the map; now it does nothing)
      if (d.far && !this.build && !this.bulldoze && !this.piece) return;
      this.pointer = { x: e.clientX, y: e.clientY, inside: true };
      if (d.button === 2) this.cancelTool();
      else if (d.button === 0 && row && row.tiles.length > 1) this.layRow(row.tiles);
      else if (d.button === 0) this.click(e.clientX, e.clientY);
    });
    this.listen(canvas, 'pointercancel', (e) => {
      release(e);
      this.drag = null;
      this.row = null;
    });
    this.listen(canvas, 'pointerleave', () => {
      this.pointer.inside = false;
    });
    this.listen(
      canvas,
      'wheel',
      (e) => {
        e.preventDefault();
        const unit = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1;
        // Shift+wheel turns the fence, gate or lamp in hand (or the selected one). Many browsers send a
        // Shift+wheel sideways, so either axis counts; small trackpad steps add up like the zoom's.
        if (e.shiftKey && this.canRotate()) {
          const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
          this.rotAcc += delta * unit;
          if (Math.abs(this.rotAcc) < 50) return;
          this.rotate(this.rotAcc > 0 ? 1 : -1);
          this.rotAcc = 0;
          return;
        }
        // Trackpads send many small deltas: add them up so one gesture is one zoom step.
        // Mostly-sideways swipes are ignored; Ctrl+wheel is a trackpad pinch.
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
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
        // one thing at a time: the tool or selection, then the Objects & modules panel, then the menu
        if (this.hasTool()) this.cancelTool();
        else if (this.catalog) this.closeCatalog();
        else this.openPause();
        break;
      case 'KeyO':
        this.toggleCatalog();
        break;
      case 'KeyR':
        this.rotate(e.shiftKey ? -1 : 1);
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
    if (this.piece) {
      this.usePiece(sx, sy);
      return;
    }
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
      this.selectBuilding(picked);
      audio.play('click');
      return;
    }
    if (picked === -2 && !this.bulldoze) {
      this.petCat();
      return;
    }
    // then a fence, gate or lamp drawn there (else a floor): a click selects it, the bulldozer takes it up
    const piece = this.renderer.pickPiece(sx, sy);
    if (piece >= 0) {
      if (!this.bulldoze) {
        this.selectPiece(piece);
        audio.play('click');
        return;
      }
      if (removePieceAt(s, piece % MAP_W, Math.floor(piece / MAP_W))) return;
    }
    if (!inBounds(tile.x, tile.y)) {
      this.selectBuilding(-1);
      return;
    }
    const i = idx(tile.x, tile.y);
    if (this.bulldoze) {
      if (s.tiles[i] === T.RUBBLE) {
        if (!bulldozeRubble(s, tile.x, tile.y)) audio.play('error');
      } else if (s.occ[i] !== -1) {
        this.selectBuilding(s.occ[i]);
        audio.play('click');
      } else if (!removePieceAt(s, tile.x, tile.y)) {
        // nothing to take up (a fence, gate or lamp, else a bare floor, goes with half its price back)
        pushMessage(s, t('msg.bulldozeHelp'), 'info');
      }
      return;
    }
    if (s.occ[i] !== -1) {
      this.selectBuilding(s.occ[i]);
      audio.play('click');
      return;
    }
    const w = this.renderer.screenToWorld(sx, sy);
    if (Math.hypot(w.x - s.cat.x, w.y - s.cat.y) < 6) {
      this.petCat();
      return;
    }
    this.selectBuilding(-1);
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
    this.piece = null;
    this.row = null;
    this.selectedId = -1;
    this.selectedPiece = -1;
    this.build = this.build === type ? null : type;
  }

  private toggleBulldoze(): void {
    this.build = null;
    this.piece = null;
    this.row = null;
    this.bulldoze = !this.bulldoze;
  }

  private hasTool(): boolean {
    return !!this.build || this.bulldoze || !!this.piece || this.selectedId >= 0 || this.selectedPiece >= 0;
  }

  // Esc, right click, B: put the tool away and drop the selection. Nothing is paid for a ghost.
  private cancelTool(): void {
    this.build = null;
    this.bulldoze = false;
    this.piece = null;
    this.row = null;
    this.selectedId = -1;
    this.selectedPiece = -1;
    // a left-button press still held ends here too, so its release neither buys nor selects (the other buttons
    // and a finger go on moving the map)
    if (this.drag?.button === 0 && this.drag.pointerType === 'mouse') this.drag = null;
  }

  // A building (or nothing: -1) takes the right-hand panel, so the catalog closes.
  private selectBuilding(id: number): void {
    this.selectedId = id;
    this.selectedPiece = -1;
    if (id >= 0) this.closeCatalog();
  }

  private selectPiece(i: number): void {
    this.selectedId = -1;
    this.selectedPiece = i;
    this.closeCatalog();
  }

  // ---------- Objects & modules ----------

  // The panel sits where the building panel does: opening it closes that one.
  private toggleCatalog(): void {
    if (this.catalog) {
      this.closeCatalog();
      return;
    }
    this.catalog = true;
    this.selectedId = -1;
    this.selectedPiece = -1;
  }

  // Closing the panel puts its tool away too (the Rotate button a finger needs goes with it).
  private closeCatalog(): void {
    this.catalog = false;
    this.piece = null;
    this.row = null;
  }

  // Taking an item from the catalog: its tool replaces the building or bulldozer tool; the same item again,
  // or null, puts it away.
  private pickItem(kind: CatalogKind | null): void {
    if (!kind || this.piece?.kind === kind) {
      this.piece = null;
      this.row = null;
      return;
    }
    this.build = null;
    this.bulldoze = false;
    this.selectedId = -1;
    this.selectedPiece = -1;
    this.catalog = true;
    this.piece = { kind, rot: this.pieceRot[kind] ?? 0 };
  }

  // One confirmation (click, tap, A) buys one piece or installs one module, paid on the spot.
  private usePiece(sx: number, sy: number): void {
    const s = this.s;
    const { kind, rot } = this.piece!;
    if (isModuleKind(kind)) {
      const b = this.moduleTarget(sx, sy);
      const check = b ? moduleCheck(s, kind, b) : { ok: false, reason: moduleNeeds(kind) };
      if (b && check.ok) installModule(s, kind, b);
      else this.refuse(check.reason);
      return;
    }
    const tile = this.renderer.screenToTile(sx, sy);
    const check = pieceCheck(s, kind, tile.x, tile.y, rot);
    if (check.ok) placePiece(s, kind, tile.x, tile.y, rot);
    else this.refuse(check.reason);
  }

  // A dragged row: each tile is a purchase of its own, made in order; a tile that is taken, or that the money
  // no longer covers, is skipped and costs nothing. A row carries on over the same piece already there (a fence
  // row over its fences and gates, as the map shows it, with no ghost): those tiles are neither laid nor skipped.
  private layRow(tiles: { x: number; y: number }[]): void {
    const s = this.s;
    const p = this.piece;
    if (!p || !isPieceKind(p.kind)) return;
    const kind = p.kind;
    const there = (q: { x: number; y: number }) => {
      if (kind === 'floor') return floorAt(s, q.x, q.y);
      const k = pieceAt(s, q.x, q.y)?.kind;
      return k === kind || (kind === 'fence' && k === 'gate');
    };
    const todo = tiles.filter((q) => !there(q));
    if (!todo.length) return;
    let laid = 0;
    for (const tile of todo) if (placePiece(s, kind, tile.x, tile.y, p.rot)) laid++;
    if (laid === 0) this.refuse(pieceCheck(s, kind, todo[0].x, todo[0].y).reason);
    else if (laid < todo.length) pushMessage(s, t('msg.rowPartial', { n: laid, total: todo.length }), 'info');
  }

  private install(id: number, kind: ModuleKind): void {
    const b = this.s.buildings.find((o) => o.id === id);
    if (!b) return;
    const check = moduleCheck(this.s, kind, b);
    if (check.ok) installModule(this.s, kind, b);
    else this.refuse(check.reason);
  }

  private refuse(reason?: string): void {
    audio.play('error');
    pushMessage(this.s, reason ?? t('place.cannot'), 'bad');
  }

  private canRotate(): boolean {
    return isRotatable(this.piece?.kind) || !!pieceInfo(this.s, this.selectedPiece)?.rotatable;
  }

  // R, Shift+wheel: turns the fence, gate or lamp in hand, else the selected one on the map.
  private rotate(dir: 1 | -1): void {
    if (!this.rotateTool(dir) && this.selectedPiece >= 0) this.rotatePiece(this.selectedPiece, dir);
  }

  private rotateTool(dir: 1 | -1): boolean {
    const p = this.piece;
    if (!p || !isPieceKind(p.kind) || !isRotatable(p.kind)) return false;
    p.rot = normRot(p.kind, p.rot + dir);
    this.pieceRot[p.kind] = p.rot;
    audio.play('click');
    return true;
  }

  private rotatePiece(i: number, dir: 1 | -1): void {
    const info = pieceInfo(this.s, i);
    if (info?.rotatable && rotatePieceAt(this.s, info.x, info.y, dir)) audio.play('click');
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
    // over a side panel taller than the window (the catalog on a small screen), the right stick scrolls it
    const list = f.rx || f.ry ? scrollableAt(document.elementFromPoint(c.x, c.y)) : null;
    if (list) {
      list.scrollTop += f.ry * PANEL_SCROLL * f.dt;
      px = 0;
      py = 0;
    }
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
    this.padCursor.classList.toggle('building', !!this.build || this.bulldoze || !!this.piece);
    this.padCursor.style.transform = `translate(${Math.round(c.x)}px, ${Math.round(c.y)}px)`;

    const p = f.pressed;
    if (p.has('a')) {
      audio.unlock();
      if (overMap) this.click(c.x, c.y);
      else (btn ?? el)?.click();
    }
    if (p.has('b')) {
      if (this.hasTool()) this.cancelTool();
      else if (this.catalog) this.closeCatalog();
    }
    if (p.has('x')) this.toggleBulldoze();
    // Y turns the fence, gate or lamp in hand; otherwise it asks USA-9 for a hint
    if (p.has('y') && !this.rotateTool(1)) this.askHint();
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
