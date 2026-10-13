// In-game DOM interface: resource bar, meters, goal, toolbar, inspector, Objects & modules panel and message feed.
import { audio } from '../audio';
import { buildCost, canAfford, costText } from '../game/actions';
import { cityById, goalText } from '../game/cities';
import { freeHintsLeft, hintPrice } from '../game/hints';
import { BUILD_ORDER, BUILDINGS, BULLDOZE_RUBBLE_COST, IMPORT_PARTS, PARTS_RESERVE, SMOG_DANGER, SMOG_LIMIT_SECONDS } from '../game/defs';
import type { BuildingType, Cost } from '../game/defs';
import { scrapWaiting } from '../game/economy';
import { MODULES, PIECES, buildingStats, demolishRefund, installedModules, isModuleKind, isPieceKind, moduleRefund } from '../game/pieces';
import type { CatalogKind, ModuleKind } from '../game/pieces';
import { isLocked, isProject } from '../game/projects';
import type { GoalStat, ProjectKind } from '../game/projects';
import { dayPhase } from '../game/sim';
import { day } from '../game/state';
import type { Building, GameState, Message } from '../game/state';
import { OBJECTIVES, objectiveHint, objectiveText, objectiveTools } from '../game/story';
import { padMode } from '../gamepad';
import { bName, pathLabel, t, tk } from '../i18n';
import { keyLabel, localizeKeys } from '../keys';
import { iconUrl, pathColor, portraitUrl, toolThumb } from '../render/icons';
import type { IconName } from '../render/icons';
import { atlasImage, frame } from '../render/iso/atlas';
import { PAL, makeCanvas } from '../render/sprites';
import {
  CATEGORIES,
  FILTERS,
  ITEM_STATE_ICON,
  ITEM_STATE_TEXT,
  buildingDesc,
  buildingRows,
  catalogCost,
  catalogEffect,
  catalogLimit,
  catalogName,
  catalogState,
  categoryCount,
  categoryItems,
  categoryName,
  categoryNote,
  categoryOf,
  demolishHousingDrop,
  filterItems,
  demolishStorageDrop,
  homesLost,
  isRotatable,
  isRowKind,
  moduleHousingDrop,
  moduleRowsOn,
  moduleState,
  moduleStorageDrop,
  overtimeLeft,
  pieceInfo,
  powerShortAfter,
  projectGoal,
  projectProgress,
  rowLabel,
  scrapLost,
  slotModules,
  statusLine,
} from './catalog';
import type { CatalogCategory, CatalogFilter, ModuleState, PieceInfo, StatusLine } from './catalog';
import { esc } from './escape';
import { fitToolNames } from './fit';
import { isModalOpen } from './modal';
import { PRESS_GUARD_MS, guarded, markSecond, secondPress } from './presses';
import { airReport, perDayText } from './smog';
import type { AirRow } from './smog';

// How long a feed line stays after it last came (ms): it fades out over the last 0.7 s.
export const MSG_LIFE_MS = 7200;

export interface HudHandlers {
  onBuild(type: BuildingType | null): void;
  onBulldoze(): void;
  onImport(): void;
  onSpeed(speed: number): void;
  onMenu(): void;
  onDemolish(id: number): void;
  onTogglePause(id: number): void;
  onCloseInspector(): void;
  onHint(): void;
  onRegion(): void;
  onCatalog(): void; // open or close the Objects & modules panel
  onPick(kind: CatalogKind | null): void; // take that catalog tool (again: put it away); null puts it away
  onRotate(): void; // turn the fence, gate or lamp in hand
  onInstall(id: number, kind: ModuleKind): void;
  onRemoveModule(id: number, kind: ModuleKind): void;
  onRotatePiece(i: number): void;
  onMovePiece(i: number): void; // start moving the selected decoration (the next press on the map says where)
  onEndMove(): void; // Done while moving: it stays where it was
  onRemovePiece(i: number): void;
  onOpenProject(kind: CatalogKind): void; // a new project's Open: the catalog opens at that item (nothing is bought)
}

export interface HudView {
  speed: number;
  build: BuildingType | null;
  bulldoze: boolean;
  selectedId: number;
  goalCard: boolean; // false while the tutorial talks, so there is one card to read at a time
  piece: { kind: CatalogKind; rot: number } | null; // the catalog tool in hand
  catalog: boolean; // the Objects & modules panel is open (it takes the building panel's place)
  selectedPiece: number; // tile index of the selected fence, gate, lamp, wall, pillar, decoration or surface; -1 none
  moving?: number; // the selected decoration is being moved (its tile index); -1 or left out: no
  best?: (stat: GoalStat) => number; // the most reached for a goal's measure in any one city (the projects profile)
  // where a press on the map is likely to come next (the mouse or the controller's cursor over the map, the last press on
  // it, a finger's last tap): a new project's notice appears clear of these points
  avoid?: { x: number; y: number }[];
}

// How long a new project's notice stays (seconds while no dialog is open).
export const NOTICE_SECONDS = 12;
// At most this many names in the notice; more read "+N".
const NOTICE_NAMES = 3;

// The cause of a building's state: its words, with an icon so it never reads by colour alone.
function statusHtml(line: StatusLine): string {
  return `<img src="${iconUrl(line.icon)}" alt="" data-status-icon /><span data-status-text>${esc(line.text)}</span>`;
}

const STATE_ICON: Record<ModuleState, IconName> = { installed: 'check', locked: 'discover', slotTaken: 'lock', available: 'plus', cantBuy: 'cross' };
const STATE_TEXT = {
  installed: 'insp.modInstalled',
  locked: 'insp.modLocked',
  slotTaken: 'insp.modSlotTaken',
  available: 'insp.modAvailable',
  cantBuy: 'insp.modCantBuy',
} as const satisfies Record<ModuleState, Parameters<typeof t>[0]>;

function stateHtml(state: ModuleState): string {
  return `<img src="${iconUrl(STATE_ICON[state])}" alt="" /><span>${esc(t(STATE_TEXT[state]))}</span>`;
}

// Physical keys (KeyboardEvent.code), so the top number row works on AZERTY and other layouts too.
const HOTKEY_CODES = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'KeyM'];
const HOTKEY_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'M'];

export function hotkeyFor(type: BuildingType): string {
  const i = BUILD_ORDER.indexOf(type);
  if (i < 0) return '';
  // letters follow the keyboard layout (the Spire's M is "," on AZERTY); the number row keeps its digits
  return HOTKEY_CODES[i].startsWith('Key') ? keyLabel(HOTKEY_CODES[i], HOTKEY_LABELS[i]) : HOTKEY_LABELS[i];
}

export function typeForHotkey(code: string): BuildingType | null {
  const numpad = code.startsWith('Numpad') ? `Digit${code.slice(6)}` : code;
  const i = HOTKEY_CODES.indexOf(numpad);
  return i >= 0 && i < BUILD_ORDER.length ? BUILD_ORDER[i] : null;
}

// The smog meter's arrow: rising or falling faster than 0.01 a second (0.6 a day).
function trend(rate: number): string {
  return rate > 0.01 ? ' ▲' : rate < -0.01 ? ' ▼' : '';
}

function fmt(n: number): string {
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k`;
  return Math.floor(n).toString();
}

function costChips(cost: Cost): string {
  const chips: string[] = [];
  if (cost.credits) chips.push(`<span class="cost cost-credits"><img src="${iconUrl('credits')}" alt="${t('res.credits')}" />${cost.credits}</span>`);
  if (cost.parts) chips.push(`<span class="cost cost-parts"><img src="${iconUrl('parts')}" alt="${t('res.parts')}" />${cost.parts}</span>`);
  if (cost.scrap) chips.push(`<span class="cost cost-scrap"><img src="${iconUrl('scrap')}" alt="${t('res.scrap')}" />${cost.scrap}</span>`);
  return chips.join('') || `<span class="cost">${t('common.free')}</span>`;
}

// A confirmation (Demolish, a module's Remove) takes no press in the first PRESS_GUARD_MS (600 ms: a 500 ms double
// press and a margin; src/ui/presses.ts, guarded) after the press that brought it up: it comes up where that button
// was, so the second press of a double click, a double tap or a double A press does not confirm it. A press of its
// own on the confirmation, later, does.

// Catalog pictures: the item's icon frame from the atlas at its own size (30×35 up to 64×32), centred in one
// 64×44 box, so the rows line up and the pixels stay crisp. Before the atlas has decoded the box stays empty.
const PIC_W = 64;
const PIC_H = 44;
const pictures = new Map<string, string>();

function catalogPicture(kind: CatalogKind): string {
  const name = isPieceKind(kind) ? `pc/${kind}/icon` : `mod/${kind}/icon`;
  const cached = pictures.get(name);
  if (cached) return cached;
  const [c, ctx] = makeCanvas(PIC_W, PIC_H);
  const img = atlasImage();
  const f = frame(name);
  if (!img || !f) return c.toDataURL();
  // a bigger icon would be scaled down to fit (none is today)
  const k = Math.min(1, PIC_W / f.w, PIC_H / f.h);
  const w = Math.round(f.w * k);
  const h = Math.round(f.h * k);
  ctx.drawImage(img, f.x, f.y, f.w, f.h, Math.round((PIC_W - w) / 2), Math.round((PIC_H - h) / 2), w, h);
  const url = c.toDataURL();
  pictures.set(name, url);
  return url;
}

// The Objects & modules button: a traffic cone in the 8×8 style of the bulldozer's icon (at toolbar size a
// lamp or a fence this small reads as a squiggle).
const CONE = ['...KK...', '..KOOK..', '..KWWK..', '.KOOOOK.', '.KWWWWK.', 'KOOOOOOK', 'KKKKKKKK', '........'];
const CONE_PAL: Record<string, string> = { K: PAL.ink, O: PAL.orange, W: PAL.white };

function coneIcon(scale: number): string {
  const key = `cone@${scale}`;
  const cached = pictures.get(key);
  if (cached) return cached;
  const [c, ctx] = makeCanvas(8 * scale, 8 * scale);
  CONE.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (!CONE_PAL[row[x]]) continue;
      ctx.fillStyle = CONE_PAL[row[x]];
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  });
  const url = c.toDataURL();
  pictures.set(key, url);
  return url;
}

export class Hud {
  private root: HTMLElement;
  private handlers: HudHandlers;
  private el: Record<string, HTMLElement> = {};
  private toolButtons = new Map<BuildingType, HTMLButtonElement>();
  private inspectorKey = '';
  private confirmDemolish = false;
  private confirmDemolishAt = 0; // when it was asked for (performance.now())
  private confirmRemove: ModuleKind | null = null; // a module whose removal waits for a second click
  private confirmRemoveAt = 0; // when it was asked for (performance.now())
  private slotChangedAt = -Infinity; // when the last module removal was confirmed (performance.now())
  private slotChangedId = -1; // on which building
  private renderedId = -1; // the building whose panel was drawn last (a piece's panel: -1)
  private catalogKey = '';
  // the catalog's category and filter (kept while the city is played), the tool in hand at its last drawing, the item
  // a new project's Open asked for (scrolled to and marked at the next drawing), the projects found in this city that
  // the catalog has not shown yet (a badge on its button, a dot on their tab) and those it is showing now
  private catCategory: CatalogCategory = 'construction';
  private catFilter: CatalogFilter = 'all';
  private catActive: CatalogKind | null = null;
  private focusKind: CatalogKind | null = null;
  private fresh = new Set<CatalogKind>();
  private seen = new Set<CatalogKind>();
  // a new project's notice: what it announces, seconds left, and when it last appeared, grew or had to move
  // (performance.now())
  private notice: { kinds: ProjectKind[]; left: number; armedAt: number } | null = null;
  // where it stands: chosen when it appears or grows (then also off the pointer), kept while nothing more comes over it
  // than when it was placed (cover), so it never runs away from a pointer going to its Open; moved (off the pointer
  // again) when a panel, the tutorial's bubble or a card comes over it
  private noticeSpot: { x: number; y: number; top: boolean; cover: number } | null = null;
  private noticeTick = 0;
  private best: (stat: GoalStat) => number = () => 0;
  // when the smog panel last closed (performance.now()): the map takes no purchase in the moments after (session)
  smogClosedAt = -Infinity;
  private starsKey = '';
  private smogOpen = false; // the smog panel (a click on the smog meter opens and closes it)
  private smogKey = '';
  private s: GameState;
  private layout = new ResizeObserver(() => {
    this.placePanels();
    fitToolNames(this.el.toolbar);
  });
  // a press anywhere but on the smog panel or its meter closes the panel (and goes on doing what it does)
  private pressOutside = (e: PointerEvent) => this.closeSmogUnless(e.target as Element | null);

  constructor(root: HTMLElement, handlers: HudHandlers, s: GameState) {
    this.root = root;
    this.handlers = handlers;
    this.s = s;
    this.build();
    document.addEventListener('pointerdown', this.pressOutside, true);
  }

  // After a language change: rebuild every label, keep the game state as it is.
  relabel(): void {
    this.el = {};
    this.toolButtons.clear();
    this.inspectorKey = '';
    this.catalogKey = '';
    this.starsKey = '';
    this.smogKey = '';
    this.last = {};
    this.build();
    this.renderNotice();
  }

  dispose(): void {
    this.layout.disconnect();
    document.removeEventListener('pointerdown', this.pressOutside, true);
    document.documentElement.style.removeProperty('--toast-top');
    document.documentElement.style.removeProperty('--note-bottom');
  }

  // The top bar wraps on narrower windows (and when income rates widen its chips), and the build bar is
  // taller or shorter with the window: the goal card, inspector, smog alert and messages sit between the two,
  // so they follow both instead of covering the clock or the build buttons.
  private placePanels(): void {
    const vw = window.innerWidth;
    const bars = [...this.root.querySelectorAll('.hud-top > *')].map((el) => el.getBoundingClientRect()).filter((r) => r.width > 0);
    // how far down the top bar reaches over the left, middle and right third of the screen
    const reach = (third: number) => Math.max(0, ...bars.filter((r) => r.right > (vw * third) / 3 && r.left < (vw * (third + 1)) / 3).map((r) => r.bottom));
    const style = this.root.style;
    style.setProperty('--top-l', `${reach(0)}px`);
    style.setProperty('--top-c', `${reach(1)}px`);
    style.setProperty('--top-r', `${reach(2)}px`);
    style.setProperty('--dock', `${window.innerHeight - this.el.toolbar.getBoundingClientRect().top}px`);
    // achievement toasts (outside the HUD) drop below the top bar and the smog alarm instead of covering them; so
    // does the smog panel, which keeps the alarm in sight
    const alarm = this.el['smog-alert'].getBoundingClientRect();
    document.documentElement.style.setProperty('--toast-top', `${Math.max(reach(1), alarm.bottom) + 10}px`);
    style.setProperty('--below-alarm', `${Math.max(reach(1), alarm.bottom) + 10}px`);
  }

  private build(): void {
    const res = (key: string, icon: IconName, label: string, color: string) => `
      <div class="res" data-res="${key}" title="${label}" style="--c:${color}">
        <span class="res-ico"><img src="${iconUrl(icon)}" alt="" /></span>
        <span class="res-label">${label}</span>
        <span class="res-num"><b data-v></b>${key === 'scrap' ? '<span class="res-sub"><small data-cap></small><small class="res-wait" data-wait hidden></small></span>' : '<small data-cap></small>'}</span>
      </div>`;
    this.root.innerHTML = `
      <div class="hud-top">
        <div class="res-group">
          ${res('scrap', 'scrap', t('res.scrap'), 'var(--orange)')}
          ${res('parts', 'parts', t('res.parts'), 'var(--sky)')}
          <button type="button" class="import" data-import title="${t('hud.import', IMPORT_PARTS)}" aria-label="${t('hud.import', IMPORT_PARTS)}">+</button>
          ${res('credits', 'credits', t('res.credits'), 'var(--yellow)')}
          ${res('energy', 'energy', t('res.energy'), 'var(--teal)')}
          ${res('pop', 'pop', t('res.citizens'), 'var(--pink)')}
          ${res('happy', 'happy', t('res.happiness'), 'var(--lime)')}
        </div>
        <div class="meters">
          <button type="button" class="meter meter-smog" data-smog-meter aria-expanded="false" aria-controls="smog-panel" title="${t('hud.smog.title', { limit: SMOG_DANGER, seconds: SMOG_LIMIT_SECONDS })} ${t('hud.smog.more')}">
            <span class="meter-ico"><img src="${iconUrl('smog')}" alt="" /></span>
            <span class="meter-label">${t('hud.smog')}</span>
            <span class="bar"><span data-smog-bar></span></span>
            <b data-smog></b>
          </button>
          <div class="meter meter-path" title="${t('hud.path.title')}">
            <span class="path-g"><img src="${iconUrl('leaf')}" alt="" />${t('hud.green')}</span>
            <div class="track"><span class="knob" data-knob></span></div>
            <span class="path-i">${t('hud.industry')}<img src="${iconUrl('gear')}" alt="" /></span>
          </div>
        </div>
        <div class="clock">
          <div class="clock-time"><b data-day></b><small data-time></small></div>
          <div class="speed" role="group" aria-label="${t('hud.speed')}">
            <button type="button" data-speed="0" aria-label="${t('hud.pause')}">❚❚</button>
            <button type="button" data-speed="1" aria-label="${t('hud.speed1')}">▶</button>
            <button type="button" data-speed="2" aria-label="${t('hud.speed2')}">▶▶</button>
            <button type="button" data-speed="3" aria-label="${t('hud.speed3')}">▶▶▶</button>
          </div>
          <button type="button" class="hint-btn" data-hint aria-label="${t('hud.hint')}" title="${t('hud.hint')} (${keyLabel('KeyQ', 'Q')})">
            <img src="${iconUrl('bulb', 2)}" alt="" /><span class="hint-badge" data-hint-badge></span>
          </button>
          ${this.s.cityId ? `<button type="button" class="region-btn" data-region aria-label="${t('hud.region')}" title="${t('hud.region')}"><img src="${iconUrl('blimp', 2)}" alt="" /></button>` : ''}
          <button type="button" class="menu-btn" data-menu>${t('hud.menu')}</button>
        </div>
      </div>
      <div class="objective" data-objective>
        <img class="obj-face" src="${portraitUrl('usa')}" alt="" />
        <div>
          <small data-obj-step></small>
          <p data-obj-text></p>
          <em data-obj-hint></em>
          <ul class="obj-stars" data-stars hidden></ul>
        </div>
      </div>
      <div class="feed" data-feed aria-live="polite"></div>
      <div class="smog-alert" data-smog-alert hidden></div>
      <aside class="smog-panel" id="smog-panel" data-smog-panel aria-label="${esc(t('hud.smog'))}" hidden>
        <div class="insp-head">
          <span class="tool-plate"><img src="${iconUrl('smog', 3)}" alt="" /></span>
          <div>
            <p class="tag" data-smog-level></p>
            <h3>${esc(t('smog.title'))}</h3>
          </div>
          <button type="button" class="modal-x" data-smog-close aria-label="${t('common.close')}">×</button>
        </div>
        <div class="air" data-smog-body></div>
      </aside>
      <aside class="inspector" data-inspector hidden></aside>
      <aside class="inspector catalog" data-catalog-panel aria-label="${esc(t('hud.catalog'))}" hidden></aside>
      <div class="proj-note" data-project-note role="status" aria-live="polite" hidden>
        <span class="proj-note-ico"><img src="${iconUrl('discover', 3)}" alt="" /></span>
        <span class="proj-note-text"><small data-note-title></small><b data-note-names></b></span>
        <button type="button" class="btn btn-primary proj-note-open" data-project-open>${esc(t('proj.open'))}</button>
      </div>
      <div class="tooltip" data-tooltip hidden></div>
      <nav class="toolbar" data-toolbar aria-label="${t('hud.build')}"></nav>
    `;
    for (const node of this.root.querySelectorAll<HTMLElement>('[data-v],[data-cap]')) {
      const key = node.closest<HTMLElement>('[data-res]')!.dataset.res!;
      this.el[`${key}:${node.hasAttribute('data-v') ? 'v' : 'cap'}`] = node;
    }
    for (const name of ['smog-bar', 'smog', 'smog-meter', 'smog-panel', 'smog-level', 'smog-body', 'knob', 'day', 'time', 'objective', 'obj-step', 'obj-text', 'obj-hint', 'stars', 'hint-badge', 'feed', 'smog-alert', 'inspector', 'catalog-panel', 'project-note', 'tooltip', 'toolbar']) {
      this.el[name] = this.root.querySelector(`[data-${name}]`)!;
    }
    this.el.wait = this.root.querySelector('[data-wait]')!; // "+N waiting" next to the scrap

    this.root.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach((b) =>
      b.addEventListener('click', () => {
        audio.play('click');
        this.handlers.onSpeed(Number(b.dataset.speed));
      }),
    );
    this.root.querySelector('[data-import]')!.addEventListener('click', () => this.handlers.onImport());
    this.root.querySelector('[data-hint]')!.addEventListener('click', () => {
      audio.play('click');
      this.handlers.onHint();
    });
    this.root.querySelector('[data-region]')?.addEventListener('click', () => {
      audio.play('click');
      this.handlers.onRegion();
    });
    this.root.querySelector('[data-menu]')!.addEventListener('click', () => {
      audio.play('click');
      this.handlers.onMenu();
    });
    // a new project's Open: the catalog at that item, nothing bought. It takes no press while the notice is just
    // appearing or growing (it lets presses through to the map then, see placeNotice), nor the second press of a
    // double press
    this.root.querySelector('[data-project-open]')!.addEventListener('click', () => {
      const n = this.notice;
      if (!n || performance.now() - n.armedAt < PRESS_GUARD_MS) return;
      if (!this.catalogSettled()) return;
      audio.play('click');
      this.notice = null;
      this.renderNotice();
      this.handlers.onOpenProject(n.kinds[0]);
    });
    this.el['smog-meter'].addEventListener('click', () => {
      audio.play('click');
      this.smogOpen = !this.smogOpen;
      this.showSmog();
    });
    this.root.querySelector('[data-smog-close]')!.addEventListener('click', () => {
      audio.play('click');
      this.closeSmog();
    });
    this.showSmog();

    const toolbar = this.el.toolbar;
    const groups = new Map<string, HTMLElement>();
    const groupFor = (type: BuildingType) => {
      const name = type === 'spire' ? 'monument' : BUILDINGS[type].path === 'green' ? 'green' : BUILDINGS[type].path === 'industrial' ? 'industry' : 'basics';
      let g = groups.get(name);
      if (!g) {
        g = document.createElement('div');
        g.className = `tool-group group-${name}`;
        g.innerHTML = `<span class="group-label">${tk(`hud.group.${name}`)}</span><div class="group-tools"></div>`;
        toolbar.append(g);
        groups.set(name, g);
      }
      return g.querySelector('.group-tools')!;
    };
    for (const type of BUILD_ORDER) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tool';
      b.dataset.tool = type;
      b.style.setProperty('--path', pathColor(type));
      b.innerHTML = `
        <kbd>${hotkeyFor(type)}</kbd>
        <span class="tool-plate"><img src="${toolThumb(type)}" alt="" /></span>
        <span class="tool-name">${bName(type)}</span>
        <span class="tool-cost">${costChips(buildCost(this.s, type))}</span>`;
      b.addEventListener('click', () => {
        audio.play('click');
        this.handlers.onBuild(type);
      });
      b.addEventListener('pointerenter', () => this.showTooltip(type, b));
      b.addEventListener('pointerleave', () => this.hideTooltip());
      b.addEventListener('focus', () => this.showTooltip(type, b));
      b.addEventListener('blur', () => this.hideTooltip());
      groupFor(type).append(b);
      this.toolButtons.set(type, b);
    }
    // The Tools column holds the bulldozer and the Objects & modules catalog as two half-height cards, one above
    // the other: the build bar keeps its width (it just fits a 1280 px window).
    const doze = document.createElement('button');
    doze.type = 'button';
    doze.className = 'tool tool-mini tool-doze';
    doze.dataset.doze = '';
    doze.innerHTML = `
      <kbd>${keyLabel('KeyX', 'X')}</kbd>
      <span class="tool-plate"><img src="${iconUrl('bulldoze', 3)}" alt="" /></span>
      <span class="tool-text">
        <span class="tool-name">${t('b.bulldoze')}</span>
        <span class="tool-cost">${costChips({ credits: BULLDOZE_RUBBLE_COST })}</span>
      </span>`;
    doze.addEventListener('click', () => {
      audio.play('click');
      this.handlers.onBulldoze();
    });
    const catalog = document.createElement('button');
    catalog.type = 'button';
    catalog.className = 'tool tool-mini tool-catalog';
    catalog.dataset.catalog = '';
    catalog.setAttribute('aria-expanded', 'false');
    catalog.innerHTML = `
      <kbd>${keyLabel('KeyO', 'O')}</kbd>
      <span class="tool-plate"><img src="${coneIcon(3)}" alt="" /></span>
      <span class="tool-text"><span class="tool-name">${esc(t('hud.catalog'))}</span></span>
      <span class="tool-badge" data-catalog-badge hidden></span>`;
    catalog.addEventListener('click', () => {
      audio.play('click');
      this.handlers.onCatalog();
    });
    const tools = document.createElement('div');
    tools.className = 'tool-group group-tools-misc';
    tools.innerHTML = `<span class="group-label">${t('hud.group.tools')}</span><div class="group-tools"></div>`;
    tools.querySelector('.group-tools')!.append(doze, catalog);
    toolbar.append(tools);
    this.updateBadge();

    this.layout.disconnect();
    for (const el of this.root.querySelectorAll('.hud-top, .hud-top > *, [data-toolbar], [data-smog-alert]')) this.layout.observe(el);
    // a long one-word name fits its card (measured again once the game's fonts are in: they change the widths)
    fitToolNames(toolbar);
    document.fonts?.ready.then(() => {
      if (toolbar.isConnected) fitToolNames(toolbar);
    });
  }

  private showTooltip(type: BuildingType, anchor: HTMLElement): void {
    const def = BUILDINGS[type];
    const lines: string[] = [];
    if (def.energy) lines.push(t('tip.energy', { n: `${def.energy > 0 ? '+' : ''}${def.energy}` }));
    if (def.pollution) lines.push(t('tip.smog', { n: `${def.pollution > 0 ? '+' : ''}${(def.pollution * 60).toFixed(1)}` }));
    if (def.process) lines.push(t('tip.cycle', { input: costText(def.process.input), output: costText(def.process.output), n: def.process.time }));
    if (def.housing) lines.push(t('tip.houses', { n: def.housing }));
    if (def.bots) lines.push(t('tip.bots', { n: def.bots }));
    if (def.happiness) lines.push(t('tip.happiness', { n: def.happiness }));
    if (def.minPop) lines.push(t('tip.needs', { n: def.minPop }));
    const tip = this.el.tooltip;
    tip.innerHTML = `
      <p class="tip-title">${bName(type)} <span class="tag" style="--path:${pathColor(type)}">${pathLabel(def.path)}</span></p>
      <p class="tip-desc">${esc(buildingDesc({ type }))}</p>
      <ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
      <p class="tip-cost">${costChips(buildCost(this.s, type))}</p>`;
    tip.hidden = false;
    const r = anchor.getBoundingClientRect();
    const tw = tip.offsetWidth;
    // above the whole build bar, so it never covers the group labels or the cards next door
    const top = this.el.toolbar.getBoundingClientRect().top;
    tip.style.left = `${Math.max(8, Math.min(window.innerWidth - tw - 8, r.left + r.width / 2 - tw / 2))}px`;
    tip.style.bottom = `${window.innerHeight - top + 8}px`;
  }

  private hideTooltip(): void {
    this.el.tooltip.hidden = true;
  }

  private msgTimers = new WeakMap<HTMLElement, number[]>();

  // The feed: a line repeated while it is still on screen (it stays MSG_LIFE_MS after its last time) shows once with a
  // count ("Storage full ×3") and comes down to the newest place, instead of a stack of copies pushing other news
  // away. Only the very same text and tone count as a repeat: a different line (another number, another name) is
  // never folded into it. Nothing waits: every line, repeated or new, shows in the frame it arrives. (The smog
  // countdown and the power warnings are not feed lines: they have places of their own.)
  pushMessages(list: Message[]): void {
    const feed = this.el.feed;
    for (const m of list) {
      const key = `${m.tone}|${m.text}`;
      let p = [...feed.children].find((c): c is HTMLElement => c instanceof HTMLElement && c.dataset.key === key) ?? null;
      if (p) {
        const count = Number(p.dataset.count ?? '1') + 1;
        p.dataset.count = String(count);
        p.querySelector('.msg-count')!.textContent = ` ×${count}`;
        p.classList.remove('msg-out');
        for (const t of this.msgTimers.get(p) ?? []) window.clearTimeout(t);
        if (p !== feed.lastElementChild) feed.append(p);
      } else {
        p = document.createElement('p');
        p.className = `msg msg-${m.tone}`;
        p.dataset.text = m.text;
        p.dataset.key = key;
        p.innerHTML = `<span class="msg-text"></span><span class="msg-count"></span>`;
        p.querySelector('.msg-text')!.textContent = m.text;
        feed.append(p);
      }
      const el = p;
      this.msgTimers.set(el, [window.setTimeout(() => el.classList.add('msg-out'), MSG_LIFE_MS - 700), window.setTimeout(() => el.remove(), MSG_LIFE_MS)]);
    }
    while (feed.children.length > 5) feed.firstElementChild!.remove();
  }

  private last: Record<string, number> = {};
  private samples: { t: number; credits: number; parts: number }[] = [];

  // Income per minute over the last ~20 seconds of game time (spending does not count).
  private rates(s: GameState): { credits: number; parts: number } {
    const now = { t: s.time, credits: s.stats.creditsEarned, parts: s.stats.partsMade };
    const lastSample = this.samples[this.samples.length - 1];
    if (!lastSample || now.t - lastSample.t >= 1 || now.t < lastSample.t) {
      if (lastSample && now.t < lastSample.t) this.samples = [];
      this.samples.push(now);
      while (this.samples.length > 20) this.samples.shift();
    }
    const first = this.samples[0];
    const span = now.t - first.t;
    if (span < 3) return { credits: 0, parts: 0 };
    return { credits: ((now.credits - first.credits) / span) * 60, parts: ((now.parts - first.parts) / span) * 60 };
  }

  // A little hop when a number goes up, so income feels like income.
  private bump(key: string, value: number): void {
    const prev = this.last[key];
    this.last[key] = value;
    if (prev === undefined || value <= prev + 0.5) return;
    const chip = this.root.querySelector<HTMLElement>(`[data-res="${key}"]`);
    if (!chip) return;
    chip.classList.remove('bump');
    void chip.offsetWidth;
    chip.classList.add('bump');
  }

  update(s: GameState, view: HudView): void {
    const d = s.derived;
    this.best = view.best ?? (() => 0);
    this.bump('scrap', Math.floor(s.res.scrap));
    this.bump('parts', Math.floor(s.res.parts));
    this.bump('credits', Math.floor(s.res.credits / 5) * 5);
    this.bump('pop', Math.floor(s.pop));
    const set = (key: string, text: string) => {
      const n = this.el[key];
      if (n && n.textContent !== text) n.textContent = text;
    };
    set('scrap:v', fmt(s.res.scrap));
    set('scrap:cap', `/${fmt(d.storage)}`);
    // scrap the bots brought back that waits for room in storage: "+N waiting", explained on hover
    const waiting = scrapWaiting(s);
    const wait = this.el.wait;
    if (wait.hidden !== waiting <= 0) wait.hidden = waiting <= 0;
    if (waiting > 0) {
      set('wait', t('hud.scrapWaiting', { n: fmt(waiting) }));
      const tip = t('hud.scrapWaiting.title', { n: fmt(waiting) });
      if (wait.title !== tip) {
        wait.title = tip;
        wait.closest<HTMLElement>('[data-res]')!.title = tip;
      }
    } else if (wait.title) {
      wait.title = '';
      wait.closest<HTMLElement>('[data-res]')!.title = t('res.scrap');
    }
    const rate = this.rates(s);
    set('parts:v', fmt(s.res.parts));
    set('parts:cap', rate.parts >= 1 ? t('hud.perMinute', { n: fmt(rate.parts) }) : '');
    set('credits:v', fmt(s.res.credits));
    set('credits:cap', rate.credits >= 1 ? t('hud.perMinute', { n: fmt(rate.credits) }) : '');
    set('energy:v', `${d.energyProd}`);
    set('energy:cap', `/${d.energyUse}`);
    set('pop:v', fmt(s.pop));
    set('pop:cap', `/${d.housing}`);
    set('happy:v', `${Math.round(d.happiness)}%`);
    set('happy:cap', '');
    this.root.querySelector('[data-res="energy"]')!.classList.toggle('warn', d.efficiency < 1);
    this.root.querySelector('[data-res="scrap"]')!.classList.toggle('warn', s.res.scrap >= d.storage);
    this.root.querySelector('[data-res="happy"]')!.classList.toggle('warn', d.happiness < 35);
    this.root.querySelector('[data-import]')!.classList.toggle('cant', s.res.credits < IMPORT_PARTS.credits);
    // out of parts with credits to spare: the import button asks to be noticed
    this.root.querySelector('[data-import]')!.classList.toggle('nudge', s.res.parts < PARTS_RESERVE && s.res.credits >= IMPORT_PARTS.credits * 2);

    const pol = Math.round(s.pollution);
    set('smog', `${pol}%${trend(d.pollutionRate)}`);
    (this.el['smog-bar'] as HTMLElement).style.width = `${s.pollution}%`;
    this.el['smog-bar'].dataset.level = pol >= 75 ? 'high' : pol >= 45 ? 'mid' : 'low';
    this.el.knob.style.left = `${50 - s.alignment / 2}%`;

    set('day', t('common.day', { n: day(s) }));
    const minutes = Math.floor(dayPhase(s) * 24 * 60 + 6 * 60) % (24 * 60);
    set('time', `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`);
    this.root.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach((b) => b.classList.toggle('active', Number(b.dataset.speed) === view.speed));

    const obj = OBJECTIVES[s.objective];
    const city = cityById(s.cityId);
    this.el.objective.hidden = (!obj && !city) || !view.goalCard;
    if (obj) {
      set('obj-step', t('hud.goal', { n: s.objective + 1, total: OBJECTIVES.length }));
      set('obj-text', objectiveText(obj));
      set('obj-hint', objectiveHint(obj, s));
    } else if (city) {
      set('obj-step', city.name);
      set('obj-text', t('hud.starGoals'));
      set('obj-hint', t('hud.starGoals.hint'));
    }
    if (city) {
      const key = s.stars.join();
      if (key !== this.starsKey) {
        this.starsKey = key;
        this.el.stars.hidden = false;
        this.el.stars.innerHTML = city.goals
          .map((_, i) => `<li class="${s.stars[i] ? 'got' : ''}"><span class="star" aria-hidden="true">★</span>${esc(goalText(city, i))}</li>`)
          .join('');
      }
    }
    const free = freeHintsLeft(s);
    set('hint-badge', free > 0 ? String(free) : `${hintPrice(s)}`);
    this.el['hint-badge'].classList.toggle('paid', free === 0);

    const alert = this.el['smog-alert'];
    alert.hidden = s.smog <= 0;
    if (s.smog > 0) set('smog-alert', t('hud.smogAlert', { limit: SMOG_DANGER, n: Math.max(0, Math.ceil(SMOG_LIMIT_SECONDS - s.smog)) }));
    if (this.smogOpen) this.updateSmog(s);

    // the goal card's next step glows on the build bar; the tutorial points at things with its own ring
    const next = s.tutorial ? [] : objectiveTools(s);
    for (const [type, btn] of this.toolButtons) {
      const def = BUILDINGS[type];
      const affordable = canAfford(s, buildCost(s, type));
      const locked = !!def.minPop && s.pop < def.minPop;
      btn.classList.toggle('cant', !affordable || locked);
      btn.classList.toggle('active', view.build === type);
      const glow = next.includes(type) && view.build !== type;
      // on a window too narrow for the whole bar, a button that starts glowing scrolls into sight
      if (glow && !btn.classList.contains('next')) btn.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
      btn.classList.toggle('next', glow);
    }
    this.root.querySelector('[data-doze]')!.classList.toggle('active', view.bulldoze);
    const catalog = this.root.querySelector('[data-catalog]')!;
    catalog.classList.toggle('active', view.catalog);
    catalog.setAttribute('aria-expanded', String(view.catalog));

    this.updateCatalog(s, view);
    this.updateInspector(s, view);
    this.updateNotice(view);
  }

  // ---------- a new project's notice ----------

  // Projects just discovered: "New project: Bench" with Open, which opens the catalog at that item (nothing is bought).
  // Several at once, or more while it shows, make one notice ("New projects (3)"). They are marked new in the catalog
  // (a badge on its button, a dot on their tab) until it has shown them.
  notifyProjects(kinds: readonly ProjectKind[]): void {
    if (!kinds.length) return;
    for (const k of kinds) this.fresh.add(k);
    const list = this.notice ? [...this.notice.kinds, ...kinds.filter((k) => !this.notice!.kinds.includes(k))] : [...kinds];
    this.notice = { kinds: list, left: NOTICE_SECONDS, armedAt: performance.now() };
    audio.play('done');
    this.renderNotice();
    // (a catalog open now shows the new state of its rows in place, without moving them: markCatalog)
    this.updateBadge();
  }

  private renderNotice(): void {
    const el = this.el['project-note'];
    if (!el) return;
    const n = this.notice;
    el.hidden = !n;
    if (!n) {
      document.documentElement.style.setProperty('--note-bottom', '0px');
      return;
    }
    const names = n.kinds.slice(0, NOTICE_NAMES).map((k) => catalogName(k));
    const more = n.kinds.length - names.length;
    el.querySelector('[data-note-title]')!.textContent = n.kinds.length === 1 ? t('proj.newOne') : t('proj.newMany', { n: n.kinds.length });
    el.querySelector('[data-note-names]')!.textContent = `${names.join(', ')}${more > 0 ? ` +${more}` : ''}`;
    el.setAttribute('aria-label', t('proj.notice', { name: n.kinds.map((k) => catalogName(k)).join(', ') }));
    el.classList.add('arming');
    this.noticeSpot = null;
  }

  // The notice counts down only while no dialog covers it (an ending, a story event: it is still there after).
  private updateNotice(view: HudView): void {
    const now = performance.now();
    const dt = Math.min(0.5, Math.max(0, (now - this.noticeTick) / 1000));
    this.noticeTick = now;
    const n = this.notice;
    if (!n) return;
    if (!isModalOpen()) n.left -= dt;
    if (n.left <= 0) {
      this.notice = null;
      this.renderNotice();
      return;
    }
    const el = this.el['project-note'];
    // just appeared or grew: presses go through it to the map (a placement aimed there is not taken by Open)
    el.classList.toggle('arming', now - n.armedAt < PRESS_GUARD_MS);
    el.classList.toggle('leaving', n.left < 0.6);
    this.placeNotice(view.avoid ?? []);
  }

  // Where the notice goes: under the top bar, or else above the build bar, wherever it covers none of what the player
  // is using: the tutorial's bubble, the side panels, the goal card, the smog alarm, the bars, an achievement and, when
  // it appears, grows or has to move, the spot under the mouse or the controller's cursor and the last press on the map
  // (so it never lands under a press about to be made). Then it stays put unless one of those comes over it; when it
  // moves for that, presses go through it for a moment, as when it appears.
  private placeNotice(avoid: { x: number; y: number }[]): void {
    const el = this.el['project-note'];
    const vw = window.innerWidth;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    // what is on screen: drawn boxes (not offsetParent, which is null for the tutorial's bubble: it is position: fixed)
    const boxes = (sel: string) =>
      [...document.querySelectorAll<HTMLElement>(sel)].filter((e) => !e.hidden && e.getClientRects().length > 0).map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0);
    const hard = [...boxes('.coach'), ...boxes('[data-inspector], [data-catalog-panel], [data-smog-panel], [data-objective], [data-smog-alert], .hud-top > *, [data-toolbar]')];
    // an achievement's toast: never a place to choose, but it does not push a notice that stands: it comes down under
    // the notice (--note-bottom), passes over its edge only while it slides in, and lets presses through
    const toasts = boxes('#toasts .toast');
    const overlap = (a: DOMRect, x: number, y: number) => Math.max(0, Math.min(a.right, x + w) - Math.max(a.left, x)) * Math.max(0, Math.min(a.bottom, y + h) - Math.max(a.top, y));
    const covered = (x: number, y: number) => hard.reduce((c, r) => c + overlap(r, x, y), 0);
    const coveredAll = (x: number, y: number) => covered(x, y) + toasts.reduce((c, r) => c + overlap(r, x, y), 0);
    // it stays put while nothing more comes over it than when it was placed (nothing, unless the screen had no room)
    const kept = this.noticeSpot;
    if (kept && covered(kept.x, kept.y) <= kept.cover) return;
    const soft = boxes('[data-feed] .msg');
    const below = parseFloat(this.root.style.getPropertyValue('--below-alarm')) || 80;
    const low = this.el.toolbar.getBoundingClientRect().top - h - 12;
    // The best place given what is on screen and the points to keep clear of: three bands (under the top bar, above the
    // build bar, between them) and, in each, the middle of every gap the panels and cards leave wide enough, then the
    // centre and the two sides.
    const choose = (presses: DOMRect[]) => {
      const spots: { x: number; y: number; top: boolean }[] = [];
      for (const [y, top] of [
        [below, true],
        [low, false],
        [Math.round((below + low) / 2), false],
      ] as const) {
        const taken = [...hard, ...toasts, ...presses].filter((r) => r.bottom > y && r.top < y + h).map((r) => [r.left, r.right] as const).sort((a, b) => a[0] - b[0]);
        let from = 8;
        for (const [l, r] of [...taken, [vw - 8, vw - 8] as const]) {
          if (l - from >= w) spots.push({ x: from + (l - from - w) / 2, y, top });
          from = Math.max(from, r + 8);
        }
        for (const x of [(vw - w) / 2, 12, vw - w - 12]) spots.push({ x, y, top });
      }
      let best = spots[0];
      let bestCost = Infinity;
      spots.forEach((p, i) => {
        const x = Math.max(8, Math.min(vw - w - 8, p.x));
        const cost = presses.reduce((c, r) => c + overlap(r, x, p.y) * 1e6, 0) + coveredAll(x, p.y) * 100 + soft.reduce((c, r) => c + overlap(r, x, p.y), 0) + i;
        if (cost < bestCost) {
          bestCost = cost;
          best = { ...p, x };
        }
      });
      return best;
    };
    // where the next press is likely: never under it if anywhere else will do
    const presses = avoid.map((p) => new DOMRect(p.x - 40, p.y - 40, 80, 80));
    const same = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.round(a.x) === Math.round(b.x) && Math.round(a.y) === Math.round(b.y);
    let best: { x: number; y: number; top: boolean };
    if (!kept) best = choose(presses);
    else {
      // something came over it. Where the screen alone puts it now: the same place (nothing better left) keeps it there;
      // another place is a move, made like an appearance: clear of the pointer and the last press, and letting presses
      // through for a moment (a press meant for the map where it lands goes to the map)
      best = choose([]);
      if (same(best, kept)) best = kept;
      else {
        best = choose(presses);
        if (!same(best, kept)) {
          if (this.notice) this.notice.armedAt = performance.now();
          el.classList.add('arming');
        }
      }
    }
    this.noticeSpot = { ...best, cover: covered(best.x, best.y) };
    el.style.left = `${Math.round(best.x)}px`;
    el.style.top = `${Math.round(best.y)}px`;
    // achievements come down under it rather than over it
    document.documentElement.style.setProperty('--note-bottom', best.top ? `${Math.round(best.y + h + 10)}px` : '0px');
  }

  // The catalog button's badge: how many projects found in this city the catalog has not shown yet.
  private updateBadge(): void {
    const badge = this.root.querySelector<HTMLElement>('[data-catalog-badge]');
    if (!badge) return;
    const n = this.fresh.size;
    badge.hidden = n === 0;
    const text = String(n);
    if (badge.textContent !== text) badge.textContent = text;
    const btn = badge.closest<HTMLElement>('[data-catalog]')!;
    const title = n ? t('cat.badge', { n }) : '';
    if ((btn.title || '') !== title) btn.title = title;
  }

  // Open on a new project's notice: the catalog shows that item, in its category, with a filter that includes it,
  // scrolled into sight and marked for a moment. Nothing is taken in hand or bought.
  focusItem(kind: CatalogKind): void {
    this.catCategory = categoryOf(kind);
    if (!filterItems(this.s, this.catCategory, this.catFilter).includes(kind)) this.catFilter = 'all';
    this.focusKind = kind;
    this.catalogKey = '';
  }

  // ---------- smog panel ----------

  // Esc, B, the panel's ×: true when the panel was open (so that press does nothing else).
  closeSmog(): boolean {
    if (!this.smogOpen) return false;
    this.smogOpen = false;
    this.showSmog();
    return true;
  }

  // A press (or the controller's A) on anything but the panel or the meter closes it. True when it did: that press
  // does nothing else (on the map it buys nothing with a tool in hand).
  closeSmogUnless(target: Element | null): boolean {
    if (this.smogOpen && !(target && (this.el['smog-panel'].contains(target) || this.el['smog-meter'].contains(target)))) return this.closeSmog();
    return false;
  }

  get smogShown(): boolean {
    return this.smogOpen;
  }

  private showSmog(): void {
    if (!this.smogOpen && !this.el['smog-panel'].hidden) this.smogClosedAt = performance.now();
    this.el['smog-panel'].hidden = !this.smogOpen;
    this.el['smog-meter'].setAttribute('aria-expanded', String(this.smogOpen));
    this.el['smog-meter'].classList.toggle('active', this.smogOpen);
    this.smogKey = '';
    if (this.smogOpen) this.updateSmog(this.s);
  }

  // Where the smog comes from and where it goes, from the sim's own breakdown; rewritten only when a number changes.
  private updateSmog(s: GameState): void {
    const r = airReport(s);
    const level = `${t('hud.smog')} ${Math.round(s.pollution)}%${trend(s.derived.pollutionRate)}`;
    if (this.el['smog-level'].textContent !== level) this.el['smog-level'].textContent = level;
    const all = [...r.sources, ...r.cleaning];
    const most = Math.max(0.1, ...all.map((row) => Math.abs(row.perDay)));
    const item = (row: AirRow) => `
      <li class="air-row ${row.perDay > 0 ? 'air-up' : 'air-down'}" data-air="${row.kind}">
        <span class="air-name">${esc(row.label)}</span>
        <span class="air-bar"><span style="width:${Math.max(4, Math.round((Math.abs(row.perDay) / most) * 100))}%"></span></span>
        <b>${perDayText(row.perDay)}</b>
      </li>`;
    const list = (rows: AirRow[]) => (rows.length ? `<ul class="air-list">${rows.map(item).join('')}</ul>` : `<p class="air-none">${t('smog.none')}</p>`);
    const net = r.net > 0.05 ? 'air-up' : r.net < -0.05 ? 'air-down' : '';
    // the lists scroll on a short window; the total and the 95% rule stay in sight under them
    const html = `
      <div class="air-scroll">
        <h4 class="cat-section air-section"><span>${t('smog.sources')}</span><span>${t('smog.perDay')}</span></h4>
        ${list(r.sources)}
        <h4 class="cat-section air-section"><span>${t('smog.cleaning')}</span></h4>
        ${list(r.cleaning)}
        ${r.cleaning.some((row) => row.kind === 'renewal') ? `<p class="air-note">${t('smog.renewal.note')}</p>` : ''}
      </div>
      <div class="air-foot">
        <p class="air-net ${net}" data-air-net><span>${t('smog.net')}</span><b>${perDayText(r.net)}${trend(s.derived.pollutionRate)}</b></p>
        ${r.notes.map((n) => `<p class="air-note air-warn">${esc(n)}</p>`).join('')}
        <p class="air-limit${r.danger ? ' danger' : ''}" data-air-limit>${esc(r.limit)}</p>
      </div>`;
    if (html === this.smogKey) return;
    this.smogKey = html;
    const body = this.el['smog-body'];
    const scrolled = body.querySelector('.air-scroll')?.scrollTop ?? 0;
    body.innerHTML = html;
    body.querySelector('.air-scroll')!.scrollTop = scrolled;
  }

  // ---------- Objects & modules ----------

  // The catalog panel. Rebuilt only when the tool in hand, the category or the filter changes, or a controller comes or
  // goes, so a click on it is never lost to a rebuild: what can be had right now (money comes in with every tax tick, a
  // Dock gets finished, a project is discovered) is written in place, and the rows stay where they are.
  private updateCatalog(s: GameState, view: HudView): void {
    const panel = this.el['catalog-panel'];
    const opening = panel.hidden && view.catalog;
    panel.hidden = !view.catalog;
    if (!view.catalog) {
      // closed: what it showed is no longer new
      if (this.seen.size) {
        for (const k of this.seen) this.fresh.delete(k);
        this.seen.clear();
        this.updateBadge();
      }
      this.catalogKey = '';
      this.catActive = null;
      return;
    }
    const active = view.piece?.kind ?? null;
    // an item taken in hand shows in its own category (the tabs can still be changed while it is held)
    if (active !== this.catActive) {
      this.catActive = active;
      if (active && categoryOf(active) !== this.catCategory) {
        this.catCategory = categoryOf(active);
        if (!filterItems(s, this.catCategory, this.catFilter).includes(active)) this.catFilter = 'all';
      }
    }
    const key = `${active}|${padMode()}|${this.catCategory}|${this.catFilter}`;
    if (key === this.catalogKey) {
      this.markCatalog(s);
      return;
    }
    const sameList = this.catalogKey.split('|').slice(2).join('|') === `${this.catCategory}|${this.catFilter}`;
    this.catalogKey = key;
    this.renderCatalog(s, active, opening || !sameList);
  }

  // An item or Done pressed redraws the panel for the new tool (the tool box above the list comes or goes, the list
  // moves): the second press of a double press there (double click, double tap, A A: soon after and close to the press
  // before, src/ui/presses.ts) would land on another item or on Done. It does nothing. (The same for a decoration's
  // Move and the Done that takes its place, and for the side panel's costly buttons that a press can bring up under
  // the next one: a piece's Remove, which comes where Done was when a move ends, and a module's Install or a piece's
  // Remove under a press on the map that selected that building or piece where its panel opens.)
  private catalogSettled(): boolean {
    if (!secondPress()) return true;
    markSecond();
    return false;
  }

  // What can be had right now, written into the list in place: each row's state (its words and its icon), why it cannot
  // be bought, a project's progress; the tabs' counts and their dot for what is new.
  private markCatalog(s: GameState): void {
    const panel = this.el['catalog-panel'];
    for (const btn of panel.querySelectorAll<HTMLElement>('[data-item]')) {
      const kind = btn.dataset.item as CatalogKind;
      const st = catalogState(s, kind);
      btn.classList.toggle('cant', !st.ok);
      if (btn.dataset.state !== st.state) {
        btn.dataset.state = st.state;
        btn.setAttribute('aria-disabled', String(st.state === 'locked'));
        const chip = btn.querySelector<HTMLElement>('[data-cat-state]')!;
        chip.className = `cat-state state-${st.state}`;
        chip.querySelector('img')!.src = iconUrl(ITEM_STATE_ICON[st.state]);
        chip.querySelector('.cat-state-label')!.textContent = t(ITEM_STATE_TEXT[st.state]);
        const goal = btn.querySelector<HTMLElement>('[data-cat-goal]');
        if (goal) goal.hidden = st.state !== 'locked';
      }
      // why not now (a project's goal has its own line, with the progress under it)
      const reason = btn.querySelector<HTMLElement>('.cat-reason')!;
      const text = st.state === 'cantBuy' ? (st.reason ?? '') : '';
      if (reason.textContent !== text) reason.textContent = text;
      reason.hidden = !text;
      const progress = btn.querySelector<HTMLElement>('[data-cat-progress]');
      if (progress) {
        const p = st.state === 'locked' && isProject(kind) ? projectProgress(s, kind, this.best) : '';
        if (progress.textContent !== p) progress.textContent = p;
        progress.hidden = !p;
      }
      if (this.fresh.has(kind)) this.seen.add(kind);
    }
    for (const tab of panel.querySelectorAll<HTMLElement>('[data-cat]')) {
      const cat = tab.dataset.cat as CatalogCategory;
      const c = categoryCount(s, cat);
      const title = t('cat.count', { n: c.found, total: c.total });
      if (tab.title !== title) tab.title = title;
      tab.classList.toggle('fresh', categoryItems(cat).some((k) => this.fresh.has(k) && !this.seen.has(k)));
    }
    for (const chip of panel.querySelectorAll<HTMLElement>('[data-filter]')) {
      const count = chip.querySelector<HTMLElement>('[data-filter-count]')!;
      const text = String(filterItems(s, this.catCategory, chip.dataset.filter as CatalogFilter).length);
      if (count.textContent !== text) count.textContent = text;
    }
  }

  // One row: picture, name and price, its state (words and icon) and why not now; a project's goal and progress; what it
  // does; the limit. markCatalog fills in what changes.
  private catalogRow(kind: CatalogKind, active: CatalogKind | null): string {
    const project = isProject(kind);
    return `
        <button type="button" class="cat-item${kind === active ? ' active' : ''}${this.fresh.has(kind) ? ' fresh' : ''}" data-item="${kind}" aria-pressed="${kind === active}">
          <span class="cat-pic"><img src="${catalogPicture(kind)}" alt="" /></span>
          <span class="cat-text">
            <span class="cat-top"><span class="cat-name">${esc(catalogName(kind))}</span><span class="tool-cost">${costChips(catalogCost(kind))}</span></span>
            <span class="cat-state" data-cat-state><img src="" alt="" /><span class="cat-state-label"></span><span class="cat-reason" hidden></span><span class="cat-limit">${esc(catalogLimit(kind))}</span></span>
            ${project ? `<span class="cat-project" data-cat-goal hidden><span class="cat-goal">${esc(projectGoal(kind))}</span> <span class="cat-progress" data-cat-progress hidden></span></span>` : ''}
            <span class="cat-effect">${esc(catalogEffect(kind))}</span>
          </span>
        </button>`;
  }

  private renderCatalog(s: GameState, active: CatalogKind | null, toTop: boolean): void {
    const panel = this.el['catalog-panel'];
    const cat = this.catCategory;
    const filter = this.catFilter;
    const items = filterItems(s, cat, filter);
    // the list scrolls on small windows: it opens at the top (and on another category or filter), and a rebuild while
    // open keeps its place
    const scrolled = toTop ? 0 : (panel.querySelector<HTMLElement>('.cat-scroll')?.scrollTop ?? 0);
    const tab = (c: CatalogCategory) => {
      const n = categoryCount(s, c);
      return `<button type="button" role="tab" class="cat-tab${c === cat ? ' on' : ''}" data-cat="${c}" aria-selected="${c === cat}" title="${esc(t('cat.count', { n: n.found, total: n.total }))}"><span class="cat-tab-name">${esc(categoryName(c))}</span></button>`;
    };
    // each filter with how many items of the category it shows
    const chip = (f: CatalogFilter) =>
      `<button type="button" class="cat-filter${f === filter ? ' on' : ''}" data-filter="${f}" aria-pressed="${f === filter}">${esc(t(`cat.filter.${f}`))} <span class="cat-count" data-filter-count>${filterItems(s, cat, f).length}</span></button>`;
    const empty = items.length ? '' : `<p class="cat-empty">${esc(t(filter === 'locked' ? 'cat.empty.locked' : 'cat.empty.available'))}</p>`;
    panel.innerHTML = `
      <div class="insp-head cat-head">
        <span class="tool-plate"><img src="${coneIcon(4)}" alt="" /></span>
        <div>
          <p class="tag">${t('hud.group.tools')}</p>
          <h3>${esc(t('hud.catalog'))}</h3>
        </div>
        <button type="button" class="modal-x" data-close aria-label="${t('common.close')}">×</button>
      </div>
      ${active ? this.toolHelp(active) : ''}
      <div class="cat-nav">
        <div class="cat-tabs" role="tablist" aria-label="${esc(t('cat.tabs'))}">${CATEGORIES.map(tab).join('')}</div>
        <div class="cat-filters" role="group" aria-label="${esc(t('cat.filters'))}">${FILTERS.map(chip).join('')}</div>
      </div>
      <div class="cat-scroll">
        <p class="cat-note">${esc(categoryNote(cat))}</p>
        <div class="cat-list">${items.map((k) => this.catalogRow(k, active)).join('')}</div>
        ${empty}
      </div>`;
    this.markCatalog(s);
    const list = panel.querySelector<HTMLElement>('.cat-scroll')!;
    list.scrollTop = scrolled;
    // the item in hand stays in sight when the tool box above the list takes its room: all of it, or from its top
    // (name and price) when the list is shorter than the item (a short window: a module's effect takes lines); the
    // item a new project's Open asked for, the same, and marked for a moment
    const focus = this.focusKind ? panel.querySelector<HTMLElement>(`[data-item="${this.focusKind}"]`) : null;
    this.focusKind = null;
    const chosen = focus ?? panel.querySelector<HTMLElement>('.cat-item.active');
    if (chosen) {
      const r = chosen.getBoundingClientRect();
      const l = list.getBoundingClientRect();
      if (r.top < l.top || r.height > l.height) list.scrollTop -= l.top - r.top;
      else if (r.bottom > l.bottom) list.scrollTop += r.bottom - l.bottom;
    }
    focus?.classList.add('focus');
    // with a tool in hand on a short window the tool box takes the head's place, with a close button of its own
    panel.classList.toggle('has-tool', !!active);
    for (const close of panel.querySelectorAll('[data-close]')) {
      close.addEventListener('click', () => {
        audio.play('click');
        this.handlers.onCatalog();
      });
    }
    for (const btn of panel.querySelectorAll<HTMLElement>('[data-item]')) {
      btn.addEventListener('click', () => {
        if (!this.catalogSettled()) return;
        audio.play('click');
        // what is in hand now, known at once: a tab pressed before the next drawing is not undone by "an item taken
        // in hand shows in its own category" (the same item again puts it away; a project still to discover is refused
        // and leaves in hand what was there)
        const kind = btn.dataset.item as CatalogKind;
        if (!isLocked(this.s, kind)) this.catActive = this.catActive === kind ? null : kind;
        this.handlers.onPick(kind);
      });
    }
    // a category or a filter: the list is drawn again at once, from its top (the tabs and chips do not move)
    for (const btn of panel.querySelectorAll<HTMLElement>('[data-cat]')) {
      btn.addEventListener('click', () => {
        if (btn.dataset.cat === this.catCategory) return;
        audio.play('click');
        this.catCategory = btn.dataset.cat as CatalogCategory;
        this.redrawCatalog();
      });
    }
    for (const btn of panel.querySelectorAll<HTMLElement>('[data-filter]')) {
      btn.addEventListener('click', () => {
        if (btn.dataset.filter === this.catFilter) return;
        audio.play('click');
        this.catFilter = btn.dataset.filter as CatalogFilter;
        this.redrawCatalog();
      });
    }
    // (Rotate tapped twice turns twice: the panel does not move under it)
    panel.querySelector('[data-rotate]')?.addEventListener('click', () => this.handlers.onRotate());
    panel.querySelector('[data-done]')?.addEventListener('click', () => {
      if (!this.catalogSettled()) return;
      audio.play('click');
      this.handlers.onPick(null);
    });
  }

  private redrawCatalog(): void {
    this.catalogKey = `${this.catActive}|${padMode()}|${this.catCategory}|${this.catFilter}`;
    this.renderCatalog(this.s, this.catActive, true);
  }

  // While a catalog tool is in hand: what to do with it (in controller buttons when a pad is in use), and the
  // buttons a finger needs (Rotate, Done).
  private toolHelp(kind: CatalogKind): string {
    const pad = padMode();
    const building = isModuleKind(kind) ? bName(MODULES[kind].building) : '';
    const what = isModuleKind(kind)
      ? t(pad ? 'cat.help.modulePad' : 'cat.help.module', { building })
      : pad
        ? t('cat.help.pad')
        : t(isRowKind(kind) ? 'cat.help.row' : 'cat.help.place');
    const turn = isRotatable(kind) ? ` <span class="cat-help-turn">${pad ? t('cat.help.rotatePad') : localizeKeys(t('cat.help.rotate'))}</span>` : '';
    return `
      <div class="cat-tool">
        <button type="button" class="modal-x cat-tool-x" data-close aria-label="${t('common.close')}">×</button>
        <p class="cat-help"><b>${esc(catalogName(kind))}</b> · ${what}${turn}</p>
        <div class="cat-tool-btns">
          ${isRotatable(kind) ? `<button type="button" class="btn btn-turn" data-rotate><span aria-hidden="true">⟳</span> ${t('cat.rotate')}</button>` : ''}
          <button type="button" class="btn" data-done>${t('common.done')}</button>
        </div>
      </div>`;
  }

  // ---------- building and piece panel ----------

  private updateInspector(s: GameState, view: HudView): void {
    const panel = this.el.inspector;
    // the catalog takes this place while it is open
    const b = view.catalog ? undefined : s.buildings.find((o) => o.id === view.selectedId);
    const piece = b || view.catalog ? null : pieceInfo(s, view.selectedPiece);
    if (!b && !piece) {
      panel.hidden = true;
      this.inspectorKey = '';
      this.renderedId = -1;
      this.confirmDemolish = false;
      this.confirmRemove = null;
      return;
    }
    panel.hidden = false;
    if (piece) {
      const moving = (view.moving ?? -1) >= 0 && view.moving === view.selectedPiece;
      const key = `piece:${view.selectedPiece}:${piece.kind}:${piece.rotatable}:${piece.removable}:${moving ? `move|${padMode()}` : ''}`;
      if (key !== this.inspectorKey) {
        this.inspectorKey = key;
        this.renderPiece(piece, view.selectedPiece, moving);
      }
      // what Remove gives back follows the storage in place (the sculpture's scrap: only as far as there is room)
      this.markPieceRefund(piece);
      return;
    }
    if (!b) return;
    if (!this.inspectorKey.startsWith(`${b.id}:`)) {
      this.confirmDemolish = false;
      this.confirmRemove = null;
    }
    // Rebuild only when the buttons or the rows change; everything that moves with the city (the cause of the state,
    // the values now, whether a module can go on: money comes in with every tax tick) is written in place, so a
    // click is never lost to a rebuild.
    const key = `${b.id}:${b.built >= 1}:${b.paused}:${this.confirmDemolish}:${this.confirmRemove}:${installedModules(b).join()}`;
    if (key !== this.inspectorKey) {
      this.inspectorKey = key;
      this.renderInspector(s, b);
    }
    const write = (el: Element | null, text: string) => {
      if (el && el.textContent !== text) el.textContent = text;
    };
    // why it is in its state, in words and with its icon
    const status = panel.querySelector<HTMLElement>('[data-status]');
    if (status) {
      const line = statusLine(s, b);
      if (status.dataset.cause !== line.cause) {
        status.dataset.cause = line.cause;
        status.className = `insp-status cause-${line.cause}`;
        status.innerHTML = statusHtml(line);
      } else {
        write(status.querySelector('[data-status-text]'), line.text);
      }
    }
    const def = BUILDINGS[b.type];
    const bar = panel.querySelector<HTMLElement>('[data-progress]');
    if (bar) {
      // (the cycle with the module installed: the magnet's 1.5 s, the sorter's 3 s)
      const p = b.built < 1 ? b.built : def.process ? b.timer / buildingStats(b).cycle : def.fuel ? Math.min(1, b.fuel / def.fuel.seconds) : 1;
      bar.style.width = `${Math.round(p * 100)}%`;
    }
    // the values now, next to the nominal ones
    for (const row of buildingRows(s, b)) {
      if (row.now !== null) write(panel.querySelector(`[data-now="${row.key}"]`), row.now);
    }
    const ot = panel.querySelector<HTMLElement>('[data-overtime]');
    if (ot) {
      const left = overtimeLeft(s, b);
      write(ot, left > 0 ? t('insp.overtime', { n: left }) : '');
      ot.hidden = left <= 0;
    }
    // each module of the slot: can it go on now (and why not), its values now once installed
    for (const card of panel.querySelectorAll<HTMLElement>('[data-mod]')) {
      const kind = card.dataset.mod as ModuleKind;
      const st = moduleState(s, b, kind);
      const chip = card.querySelector<HTMLElement>('[data-mod-state]');
      if (chip && chip.dataset.state !== st.state) {
        chip.dataset.state = st.state;
        chip.className = `mod-state state-${st.state}`;
        chip.innerHTML = stateHtml(st.state);
      }
      const btn = card.querySelector<HTMLButtonElement>('[data-install]');
      if (btn) btn.disabled = st.state !== 'available';
      const reason = card.querySelector<HTMLElement>('.cat-reason');
      if (reason) {
        write(reason, st.reason ?? '');
        reason.hidden = !st.reason;
        // a project to discover: its goal, not a refusal, then the city's progress
        reason.classList.toggle('is-goal', st.state === 'locked');
      }
      const progress = card.querySelector<HTMLElement>('[data-mod-progress]');
      if (progress) {
        write(progress, st.state === 'locked' ? projectProgress(s, kind as ProjectKind, this.best) : '');
        progress.hidden = st.state !== 'locked';
      }
      if (st.state === 'installed') {
        for (const r of moduleRowsOn(s, b, kind)) if (r.now !== undefined) write(card.querySelector(`[data-mod-now="${r.stat}${r.res ? `.${r.res}` : ''}"]`), r.now);
      }
      // installing it would leave the city short of power: said before the click
      const warn = card.querySelector<HTMLElement>('[data-power-warn]');
      if (warn) {
        const short = st.state === 'available' || st.state === 'cantBuy' ? powerShortAfter(s, b, [kind]) : null;
        write(warn, short ? t('insp.powerShort', short) : '');
        warn.hidden = !short;
      }
    }
    // a confirmation that would leave less storage than the scrap in it, fewer homes than citizens, or the city short
    // of power says so (bots keep bringing scrap and citizens keep coming, so this follows in place)
    const loss = panel.querySelector<HTMLElement>('[data-loss]');
    if (loss) {
      const lines: string[] = [];
      const kind = this.confirmRemove;
      const storageDrop = kind ? moduleStorageDrop(b, kind) : demolishStorageDrop(b);
      const lost = scrapLost(s, storageDrop);
      if (lost > 0) lines.push(t('insp.scrapLost', { n: Math.max(0, s.derived.storage - storageDrop), lost }));
      const homesDrop = kind ? moduleHousingDrop(b, kind) : demolishHousingDrop(b);
      const leaving = homesLost(s, homesDrop);
      const homesLeft = Math.max(0, s.derived.housing - homesDrop);
      if (leaving > 0) lines.push(leaving === 1 ? t('insp.homesLost.one', { n: homesLeft }) : t('insp.homesLost', { n: homesLeft, lost: leaving }));
      const short = powerShortAfter(s, b, kind ? installedModules(b).filter((k) => k !== kind) : null);
      if (short) lines.push(t('insp.powerShort', short));
      write(loss, lines.join(' '));
      loss.hidden = lines.length === 0;
    }
  }

  private renderInspector(s: GameState, b: Building): void {
    const def = BUILDINGS[b.type];
    // every number from the sim: nominal (buildingStats, with the module) and now (effectiveStats)
    const all = buildingRows(s, b);
    // what a cycle takes and makes, and the fuel, are sentences: a line each across the whole width, above the columns
    // of numbers (a cell spanning the label column too does not widen the number columns), so the labels keep their room
    const wide = all.filter((r) => r.key === 'process' || r.key === 'fuel');
    const rows = all.filter((r) => !wide.includes(r));
    const withNow = rows.some((r) => r.now !== null);
    const head = withNow ? `<dt class="rows-head"></dt><dd class="rows-head">${esc(t('insp.nominal'))}</dd><dd class="rows-head">${esc(t('insp.now'))}</dd>` : '';
    const body = rows
      .map((r) =>
        r.now === null
          ? `<dt>${esc(r.label)}</dt><dd class="span">${esc(r.nominal)}</dd>`
          : `<dt>${esc(r.label)}</dt><dd>${esc(r.nominal)}</dd><dd class="now" data-now="${r.key}">${esc(r.now)}</dd>`,
      )
      .join('');
    const lines = wide.map((r) => `<div class="insp-line"><dt>${esc(r.label)}</dt><dd>${esc(r.nominal)}</dd></div>`).join('');
    // the modules go with the building: their refunds are part of it
    const refund = costText(demolishRefund(s, b));
    const pausable = b.built >= 1 && (def.process || def.fuel || def.cleanRadius);
    const slots = slotModules(b.type);
    const line = statusLine(s, b);
    const panel = this.el.inspector;
    // another building's panel opens at its top; the same one keeps its place (a module installed down the list)
    const fresh = this.renderedId !== b.id;
    this.renderedId = b.id;
    panel.style.setProperty('--path', pathColor(b.type));
    panel.innerHTML = `
      <div class="insp-head">
        <span class="tool-plate"><img src="${toolThumb(b.type)}" alt="" /></span>
        <div>
          <p class="tag" style="--path:${pathColor(b.type)}">${pathLabel(def.path)}</p>
          <h3>${bName(b.type)}</h3>
        </div>
        <button type="button" class="modal-x" data-close aria-label="${t('common.close')}">×</button>
      </div>
      <p class="insp-status cause-${line.cause}" data-status data-cause="${line.cause}">${statusHtml(line)}</p>
      <div class="progress"><span data-progress></span></div>
      <dl class="insp-rows${withNow ? '' : ' no-now'}">${lines}${head}${body}</dl>
      <p class="insp-note" data-overtime hidden></p>
      <p class="insp-desc">${esc(buildingDesc(b))}</p>
      ${slots.length ? this.moduleSection(s, b, slots) : ''}
      ${pausable ? `<div class="insp-actions"><button type="button" class="btn" data-pause>${b.paused ? t('insp.resume') : t('insp.pause')}</button></div>` : ''}
      ${
        b.type === 'hq'
          ? ''
          : this.confirmDemolish
            ? `<p class="insp-warn" data-loss hidden></p><div class="insp-actions"><button type="button" class="btn tone-danger" data-confirm>${t('insp.demolishConfirm', { refund })}</button><button type="button" class="btn" data-cancel>${t('insp.keep')}</button></div>`
            : `<div class="insp-actions"><button type="button" class="btn" data-demolish>${t('insp.demolish')}</button></div>`
      }`;
    if (fresh) panel.scrollTop = 0;
    panel.querySelector('[data-close]')!.addEventListener('click', () => this.handlers.onCloseInspector());
    panel.querySelector('[data-pause]')?.addEventListener('click', () => {
      audio.play('click');
      this.handlers.onTogglePause(b.id);
    });
    panel.querySelector('[data-demolish]')?.addEventListener('click', () => {
      audio.play('click');
      this.confirmDemolish = true;
      this.confirmDemolishAt = performance.now();
      this.confirmRemove = null;
      this.inspectorKey = `${b.id}:`;
    });
    panel.querySelector('[data-cancel]')?.addEventListener('click', () => {
      this.confirmDemolish = false;
      this.inspectorKey = `${b.id}:`;
    });
    panel.querySelector('[data-confirm]')?.addEventListener('click', () => {
      // the building and its modules go only on a click of its own, not on the second click of a double click
      if (guarded(this.confirmDemolishAt)) return;
      this.confirmDemolish = false;
      this.handlers.onDemolish(b.id);
    });
    for (const btn of panel.querySelectorAll<HTMLButtonElement>('[data-install]')) {
      btn.addEventListener('click', () => {
        // After a removal the slot is drawn again with Install where the confirmation was: the second click of a
        // double click, a double tap or a double A press on the confirmation must not buy the module back (it
        // cost the full price for half of it back).
        // (on that building only: another building's Install is not where the confirmation was)
        if (this.slotChangedId === b.id && guarded(this.slotChangedAt)) return;
        // nor the second press of a double press on the building, on the map where this panel opens: the first press
        // selected the building and brought the panel up under the second (src/ui/presses.ts)
        if (!this.catalogSettled()) return;
        // one click, one module: the second click of a double click finds the button greyed out (it comes back
        // with the next update if the module could not go on)
        btn.disabled = true;
        this.handlers.onInstall(b.id, btn.dataset.install as ModuleKind);
      });
    }
    for (const btn of panel.querySelectorAll<HTMLElement>('[data-remove]')) {
      btn.addEventListener('click', () => {
        audio.play('click');
        this.confirmRemove = btn.dataset.remove as ModuleKind;
        this.confirmRemoveAt = performance.now();
        this.confirmDemolish = false;
        this.inspectorKey = `${b.id}:`;
      });
    }
    panel.querySelector('[data-remove-cancel]')?.addEventListener('click', () => {
      this.confirmRemove = null;
      this.inspectorKey = `${b.id}:`;
    });
    panel.querySelector<HTMLElement>('[data-remove-confirm]')?.addEventListener('click', (e) => {
      // the confirmation comes up where Remove was: the second click of a double click must not confirm it
      if (guarded(this.confirmRemoveAt)) return;
      const kind = (e.currentTarget as HTMLElement).dataset.removeConfirm as ModuleKind;
      this.confirmRemove = null;
      this.inspectorKey = `${b.id}:`;
      this.slotChangedAt = performance.now();
      this.slotChangedId = b.id;
      this.handlers.onRemoveModule(b.id, kind);
    });
  }

  // The building's module slot: one module at a time (the Recycler's magnet or sorter), each with its state.
  private moduleSection(s: GameState, b: Building, kinds: ModuleKind[]): string {
    const shared = kinds.length > 1 ? `<p class="mod-slot">${esc(t('insp.slotShared'))}</p>` : '';
    return `<h4 class="cat-section">${t('insp.modules')}</h4>${shared}${kinds.map((k) => this.moduleSlot(s, b, k)).join('')}`;
  }

  // One module of the slot: its state (installed, slot taken by the other one, can go on, cannot now and why), price
  // and refund, what it changes before → after at full power and, installed, its values now; Install (greyed out
  // with the reason) or Remove (with the refund, confirmed by a second click, saying what goes with it).
  private moduleSlot(s: GameState, b: Building, kind: ModuleKind): string {
    const def = MODULES[kind];
    const fitted = installedModules(b);
    const installed = fitted.includes(kind);
    const st = moduleState(s, b, kind);
    const fx = moduleRowsOn(s, b, kind);
    const refund = costText(moduleRefund(kind));
    const withNow = fx.some((r) => r.now !== undefined);
    const head = withNow ? `<dt class="rows-head"></dt><dd class="rows-head">${esc(t('insp.nominal'))}</dd><dd class="rows-head">${esc(t('insp.now'))}</dd>` : '';
    const rows = fx
      .map((r) => {
        const nom = `${esc(r.before)} → <b>${esc(r.after)}</b>`;
        if (!withNow) return `<dt>${esc(rowLabel(r))}</dt><dd>${nom}</dd>`;
        const now = r.now === undefined ? '' : esc(r.now);
        return `<dt>${esc(rowLabel(r))}</dt><dd>${nom}</dd><dd class="now" data-mod-now="${r.stat}${r.res ? `.${r.res}` : ''}">${now}</dd>`;
      })
      .join('');
    let actions: string;
    if (!installed) {
      actions = `
        <p class="insp-warn" data-power-warn hidden></p>
        <div class="insp-actions"><button type="button" class="btn" data-install="${kind}"${st.state === 'available' ? '' : ' disabled'}>${t('insp.install')}<span class="tool-cost">${costChips(def.cost)}</span></button></div>
        <p class="cat-reason${st.state === 'locked' ? ' is-goal' : ''}"${st.reason ? '' : ' hidden'}>${esc(st.reason ?? '')}</p>
        <p class="proj-progress" data-mod-progress${st.state === 'locked' ? '' : ' hidden'}>${st.state === 'locked' ? esc(projectProgress(s, kind as ProjectKind, this.best)) : ''}</p>`;
    } else if (this.confirmRemove === kind) {
      // a module the city had before its project was discovered: once off, it waits for the discovery to go on again
      const kept = isLocked(s, kind) ? `<p class="insp-note" data-kept-locked>${esc(t('proj.keptLocked'))}</p>` : '';
      actions = `
        <p class="insp-warn" data-loss hidden></p>${kept}
        <div class="insp-actions"><button type="button" class="btn tone-danger" data-remove-confirm="${kind}">${t('insp.remove', { refund })}</button><button type="button" class="btn" data-remove-cancel>${t('insp.keep')}</button></div>`;
    } else {
      actions = `<div class="insp-actions"><button type="button" class="btn" data-remove="${kind}">${t('insp.remove', { refund })}</button></div>`;
    }
    return `
      <div class="insp-mod${installed ? ' on' : ''}" data-mod="${kind}">
        <div class="mod-head">
          <span class="cat-pic"><img src="${catalogPicture(kind)}" alt="" /></span>
          <span class="mod-title">
            <b>${esc(catalogName(kind))}</b>
            <small>${t(def.slot === 'roof' ? 'insp.slotRoof' : 'insp.slotSide')} · <span class="mod-count">${fitted.length}/${def.limit}</span></small>
          </span>
        </div>
        <p class="mod-state state-${st.state}" data-mod-state data-state="${st.state}">${stateHtml(st.state)}</p>
        ${installed ? '' : `<p class="mod-price">${esc(t('insp.modPrice', { cost: costText(def.cost), refund }))}</p>`}
        <dl class="mod-fx${withNow ? ' with-now' : ''}">${head}${rows}</dl>
        ${actions}
      </div>`;
  }

  // A selected piece (floor, base, fence, gate, lamp, wall, pillar or decoration): what it is, that it is only for
  // looks, Rotate, Move (a decoration) and Remove with what it really gives back (markPieceRefund keeps that up to
  // date), then what it is like. The buttons come before the description, so on a short window (1024x640) they are in
  // sight without scrolling the panel. While it is being moved: what to do (in controller buttons when a pad is in use)
  // and Done, which leaves it where it is; no Remove (nothing to spend or get back during a move).
  private renderPiece(info: PieceInfo, i: number, moving = false): void {
    const panel = this.el.inspector;
    this.renderedId = -1;
    panel.scrollTop = 0;
    panel.style.setProperty('--path', 'var(--muted)');
    const head = `
      <div class="insp-head">
        <span class="tool-plate cat-plate"><img src="${catalogPicture(info.kind)}" alt="" /></span>
        <div>
          <p class="tag">${t(PIECES[info.kind].decoration ? 'cat.decorations' : 'cat.construction')}</p>
          <h3>${esc(catalogName(info.kind))}</h3>
        </div>
        <button type="button" class="modal-x" data-close aria-label="${t('common.close')}">×</button>
      </div>`;
    if (moving) {
      panel.innerHTML = `${head}
      <div class="cat-tool move-tool">
        <p class="cat-help"><b>${esc(t('insp.move'))}</b> · ${padMode() ? t('move.helpPad') : esc(t('move.help'))}</p>
        <div class="cat-tool-btns"><button type="button" class="btn" data-move-done>${t('common.done')}</button></div>
      </div>
      <p class="insp-desc piece-desc">${esc(catalogEffect(info.kind))}</p>`;
    } else {
      panel.innerHTML = `${head}
      <p class="insp-status piece-note">${t('insp.decoration')}</p>
      <div class="insp-actions">
        ${info.rotatable ? `<button type="button" class="btn btn-turn" data-rotate><span aria-hidden="true">⟳</span> ${t('cat.rotate')}</button>` : ''}
        ${info.movable ? `<button type="button" class="btn" data-move-piece>${t('insp.move')}</button>` : ''}
        ${info.removable ? `<button type="button" class="btn" data-remove-piece></button>` : ''}
      </div>
      <p class="insp-warn" data-scrap-room hidden></p>
      ${info.removable && isLocked(this.s, info.kind) ? `<p class="insp-note" data-kept-locked>${esc(t('proj.keptLocked'))}</p>` : ''}
      <p class="insp-desc piece-desc">${esc(catalogEffect(info.kind))}</p>`;
    }
    this.markPieceRefund(info);
    panel.querySelector('[data-close]')!.addEventListener('click', () => this.handlers.onCloseInspector());
    panel.querySelector('[data-rotate]')?.addEventListener('click', () => this.handlers.onRotatePiece(i));
    // Move and Done take each other's place: the second press of a double press on one would land on the other
    // (src/ui/presses.ts). It does nothing.
    panel.querySelector('[data-move-piece]')?.addEventListener('click', () => {
      if (!this.catalogSettled()) return;
      audio.play('click');
      this.handlers.onMovePiece(i);
    });
    panel.querySelector('[data-move-done]')?.addEventListener('click', () => {
      if (!this.catalogSettled()) return;
      audio.play('click');
      this.handlers.onEndMove();
    });
    // Remove takes up what was bought, for half its price: never on the second press of a double press. That press can
    // find Remove under it without meaning it: on a decoration with nothing to turn (planter, tree, fountain) Remove
    // comes where Done was when a move ends, and a piece pressed twice on the map where this panel opens has its
    // Remove brought up under the second press by the first.
    panel.querySelector('[data-remove-piece]')?.addEventListener('click', () => {
      if (!this.catalogSettled()) return;
      this.handlers.onRemovePiece(i);
    });
  }

  // Every frame, after the city's step (the session): the Remove button of the selected piece says what removing it
  // gives back at this moment, so a press on it pays exactly what it shows (removePieceAt pays pieceRefundAt, and the
  // city only changes inside a frame, never between this and a press). The rest of the panel follows update().
  refreshPieceRefund(s: GameState, selectedPiece: number): void {
    if (selectedPiece < 0 || !this.inspectorKey.startsWith(`piece:${selectedPiece}:`)) return;
    const info = pieceInfo(s, selectedPiece);
    if (info) this.markPieceRefund(info);
  }

  // The Remove button says what removing the piece gives back right now (pieceRefundAt, which is what is paid), and a
  // line under the text says how much of the sculpture's scrap storage has no room for.
  private markPieceRefund(info: PieceInfo): void {
    const panel = this.el.inspector;
    const btn = panel.querySelector<HTMLElement>('[data-remove-piece]');
    const label = t('insp.remove', { refund: costText(info.refund) });
    if (btn && btn.textContent !== label) btn.textContent = label;
    const room = panel.querySelector<HTMLElement>('[data-scrap-room]');
    if (!room) return;
    const text = info.scrapShort > 0 ? t('insp.scrapRoom', { n: info.refund.scrap ?? 0, max: (info.refund.scrap ?? 0) + info.scrapShort }) : '';
    if (room.textContent !== text) room.textContent = text;
    room.hidden = !text;
  }
}
