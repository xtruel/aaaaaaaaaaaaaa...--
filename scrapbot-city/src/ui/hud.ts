// In-game DOM interface: resource bar, meters, goal, toolbar, inspector and message feed.
import { audio } from '../audio';
import { costText, refundFor } from '../game/actions';
import { BUILDINGS, BUILD_ORDER, BULLDOZE_RUBBLE_COST, IMPORT_PARTS, PATH_LABEL, SMOG_DANGER, SMOG_LIMIT_SECONDS } from '../game/defs';
import type { BuildingType, Cost } from '../game/defs';
import { dayPhase } from '../game/sim';
import { day } from '../game/state';
import type { Building, BuildingStatus, GameState, Message } from '../game/state';
import { OBJECTIVES } from '../game/story';
import { buildingThumb, iconUrl, pathColor, portraitUrl } from '../render/icons';
import type { IconName } from '../render/icons';

export interface HudHandlers {
  onBuild(type: BuildingType | null): void;
  onBulldoze(): void;
  onImport(): void;
  onSpeed(speed: number): void;
  onMenu(): void;
  onDemolish(id: number): void;
  onTogglePause(id: number): void;
  onCloseInspector(): void;
}

export interface HudView {
  speed: number;
  build: BuildingType | null;
  bulldoze: boolean;
  selectedId: number;
}

const STATUS_TEXT: Record<BuildingStatus, string> = {
  building: 'Under construction',
  ok: 'Working',
  idle: 'Paused',
  noPower: 'No power: build energy',
  noInput: 'Waiting for input',
  noFuel: 'No fuel: needs scrap',
};

const HOTKEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-'];

export function hotkeyFor(type: BuildingType): string {
  return HOTKEYS[BUILD_ORDER.indexOf(type)] ?? '';
}

export function typeForHotkey(key: string): BuildingType | null {
  const i = HOTKEYS.indexOf(key);
  return i >= 0 && i < BUILD_ORDER.length ? BUILD_ORDER[i] : null;
}

function fmt(n: number): string {
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k`;
  return Math.floor(n).toString();
}

function costChips(cost: Cost): string {
  const chips: string[] = [];
  if (cost.credits) chips.push(`<span class="cost cost-credits"><img src="${iconUrl('credits')}" alt="credits" />${cost.credits}</span>`);
  if (cost.parts) chips.push(`<span class="cost cost-parts"><img src="${iconUrl('parts')}" alt="parts" />${cost.parts}</span>`);
  if (cost.scrap) chips.push(`<span class="cost cost-scrap"><img src="${iconUrl('scrap')}" alt="scrap" />${cost.scrap}</span>`);
  return chips.join('') || '<span class="cost">free</span>';
}

function esc(text: string): string {
  return text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

export class Hud {
  private root: HTMLElement;
  private handlers: HudHandlers;
  private el: Record<string, HTMLElement> = {};
  private toolButtons = new Map<BuildingType, HTMLButtonElement>();
  private inspectorKey = '';
  private confirmDemolish = false;

  constructor(root: HTMLElement, handlers: HudHandlers) {
    this.root = root;
    this.handlers = handlers;
    this.build();
  }

  private build(): void {
    const res = (key: string, icon: IconName, label: string, color: string) => `
      <div class="res" data-res="${key}" title="${label}" style="--c:${color}">
        <span class="res-ico"><img src="${iconUrl(icon)}" alt="" /></span>
        <span class="res-label">${label}</span>
        <b data-v></b><small data-cap></small>
      </div>`;
    this.root.innerHTML = `
      <div class="hud-top">
        <div class="res-group">
          ${res('scrap', 'scrap', 'Scrap', 'var(--orange)')}
          ${res('parts', 'parts', 'Parts', 'var(--sky)')}
          <button type="button" class="import" data-import title="Import ${IMPORT_PARTS.parts} parts from 2PM for ${IMPORT_PARTS.credits} credits (industrial)" aria-label="Import ${IMPORT_PARTS.parts} parts from 2PM for ${IMPORT_PARTS.credits} credits">+</button>
          ${res('credits', 'credits', 'Credits', 'var(--yellow)')}
          ${res('energy', 'energy', 'Energy', 'var(--teal)')}
          ${res('pop', 'pop', 'Citizens', 'var(--pink)')}
          ${res('happy', 'happy', 'Happiness', 'var(--lime)')}
        </div>
        <div class="meters">
          <div class="meter meter-smog" title="City-wide pollution. Above ${SMOG_DANGER}% for ${SMOG_LIMIT_SECONDS} seconds the city is lost.">
            <span class="meter-ico"><img src="${iconUrl('smog')}" alt="" /></span>
            <span class="meter-label">Smog</span>
            <div class="bar"><span data-smog-bar></span></div>
            <b data-smog></b>
          </div>
          <div class="meter meter-path" title="Your path so far. Green choices push left, industrial choices push right.">
            <span class="path-g"><img src="${iconUrl('leaf')}" alt="" />Green</span>
            <div class="track"><span class="knob" data-knob></span></div>
            <span class="path-i">Industry<img src="${iconUrl('gear')}" alt="" /></span>
          </div>
        </div>
        <div class="clock">
          <div class="clock-time"><b data-day></b><small data-time></small></div>
          <div class="speed" role="group" aria-label="Game speed">
            <button type="button" data-speed="0" aria-label="Pause">❚❚</button>
            <button type="button" data-speed="1" aria-label="Normal speed">▶</button>
            <button type="button" data-speed="2" aria-label="Fast">▶▶</button>
            <button type="button" data-speed="3" aria-label="Fastest">▶▶▶</button>
          </div>
          <button type="button" class="menu-btn" data-menu aria-label="Pause menu">Menu</button>
        </div>
      </div>
      <div class="objective" data-objective>
        <img class="obj-face" src="${portraitUrl('usa')}" alt="" />
        <div>
          <small data-obj-step></small>
          <p data-obj-text></p>
          <em data-obj-hint></em>
        </div>
      </div>
      <div class="feed" data-feed aria-live="polite"></div>
      <div class="smog-alert" data-smog-alert hidden></div>
      <aside class="inspector" data-inspector hidden></aside>
      <div class="tooltip" data-tooltip hidden></div>
      <nav class="toolbar" data-toolbar aria-label="Build"></nav>
    `;
    for (const node of this.root.querySelectorAll<HTMLElement>('[data-v],[data-cap]')) {
      const key = node.closest<HTMLElement>('[data-res]')!.dataset.res!;
      this.el[`${key}:${node.hasAttribute('data-v') ? 'v' : 'cap'}`] = node;
    }
    for (const name of ['smog-bar', 'smog', 'knob', 'day', 'time', 'objective', 'obj-step', 'obj-text', 'obj-hint', 'feed', 'smog-alert', 'inspector', 'tooltip', 'toolbar']) {
      this.el[name] = this.root.querySelector(`[data-${name}]`)!;
    }

    this.root.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach((b) =>
      b.addEventListener('click', () => {
        audio.play('click');
        this.handlers.onSpeed(Number(b.dataset.speed));
      }),
    );
    this.root.querySelector('[data-import]')!.addEventListener('click', () => this.handlers.onImport());
    this.root.querySelector('[data-menu]')!.addEventListener('click', () => {
      audio.play('click');
      this.handlers.onMenu();
    });

    const toolbar = this.el.toolbar;
    const groups = new Map<string, HTMLElement>();
    const groupFor = (type: BuildingType) => {
      const name = type === 'spire' ? 'Monument' : BUILDINGS[type].path === 'green' ? 'Green' : BUILDINGS[type].path === 'industrial' ? 'Industry' : 'Basics';
      let g = groups.get(name);
      if (!g) {
        g = document.createElement('div');
        g.className = `tool-group group-${name.toLowerCase()}`;
        g.innerHTML = `<span class="group-label">${name}</span><div class="group-tools"></div>`;
        toolbar.append(g);
        groups.set(name, g);
      }
      return g.querySelector('.group-tools')!;
    };
    for (const type of BUILD_ORDER) {
      const def = BUILDINGS[type];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tool';
      b.style.setProperty('--path', pathColor(type));
      b.innerHTML = `
        <kbd>${hotkeyFor(type)}</kbd>
        <span class="tool-plate"><img src="${buildingThumb(type)}" alt="" /></span>
        <span class="tool-name">${def.name}</span>
        <span class="tool-cost">${costChips(def.cost)}</span>`;
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
    const doze = document.createElement('button');
    doze.type = 'button';
    doze.className = 'tool tool-doze';
    doze.dataset.doze = '';
    doze.innerHTML = `
      <kbd>X</kbd>
      <span class="tool-plate"><img src="${iconUrl('bulldoze', 4)}" alt="" /></span>
      <span class="tool-name">Bulldoze</span>
      <span class="tool-cost">${costChips({ credits: BULLDOZE_RUBBLE_COST })}</span>`;
    doze.addEventListener('click', () => {
      audio.play('click');
      this.handlers.onBulldoze();
    });
    const tools = document.createElement('div');
    tools.className = 'tool-group group-tools-misc';
    tools.innerHTML = '<span class="group-label">Tools</span><div class="group-tools"></div>';
    tools.querySelector('.group-tools')!.append(doze);
    toolbar.append(tools);
  }

  private showTooltip(type: BuildingType, anchor: HTMLElement): void {
    const def = BUILDINGS[type];
    const lines: string[] = [];
    if (def.energy) lines.push(`${def.energy > 0 ? '+' : ''}${def.energy} energy`);
    if (def.pollution > 0) lines.push(`+${(def.pollution * 60).toFixed(1)} smog / day`);
    if (def.pollution < 0) lines.push(`${(def.pollution * 60).toFixed(1)} smog / day`);
    if (def.process) lines.push(`${costText(def.process.input)} → ${costText(def.process.output)} every ${def.process.time}s`);
    if (def.housing) lines.push(`Houses ${def.housing} citizens`);
    if (def.bots) lines.push(`+${def.bots} scrap bots`);
    if (def.happiness) lines.push(`+${def.happiness} happiness`);
    if (def.minPop) lines.push(`Needs ${def.minPop} citizens`);
    const tip = this.el.tooltip;
    tip.innerHTML = `
      <p class="tip-title">${def.name} <span class="tag" style="--path:${pathColor(type)}">${PATH_LABEL[def.path]}</span></p>
      <p class="tip-desc">${esc(def.desc)}</p>
      <ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
      <p class="tip-cost">${costChips(def.cost)}</p>`;
    tip.hidden = false;
    const r = anchor.getBoundingClientRect();
    const tw = tip.offsetWidth;
    tip.style.left = `${Math.max(8, Math.min(window.innerWidth - tw - 8, r.left + r.width / 2 - tw / 2))}px`;
    tip.style.bottom = `${window.innerHeight - r.top + 8}px`;
  }

  private hideTooltip(): void {
    this.el.tooltip.hidden = true;
  }

  pushMessages(list: Message[]): void {
    const feed = this.el.feed;
    for (const m of list) {
      const p = document.createElement('p');
      p.className = `msg msg-${m.tone}`;
      p.textContent = m.text;
      feed.append(p);
      window.setTimeout(() => p.classList.add('msg-out'), 6500);
      window.setTimeout(() => p.remove(), 7200);
    }
    while (feed.children.length > 5) feed.firstElementChild!.remove();
  }

  private last: Record<string, number> = {};

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
    set('parts:v', fmt(s.res.parts));
    set('parts:cap', '');
    set('credits:v', fmt(s.res.credits));
    set('credits:cap', '');
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

    const pol = Math.round(s.pollution);
    set('smog', `${pol}%${d.pollutionRate > 0.01 ? ' ▲' : d.pollutionRate < -0.01 ? ' ▼' : ''}`);
    (this.el['smog-bar'] as HTMLElement).style.width = `${s.pollution}%`;
    this.el['smog-bar'].dataset.level = pol >= 75 ? 'high' : pol >= 45 ? 'mid' : 'low';
    this.el.knob.style.left = `${50 - s.alignment / 2}%`;

    set('day', `Day ${day(s)}`);
    const minutes = Math.floor(dayPhase(s) * 24 * 60 + 6 * 60) % (24 * 60);
    set('time', `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`);
    this.root.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach((b) => b.classList.toggle('active', Number(b.dataset.speed) === view.speed));

    const obj = OBJECTIVES[s.objective];
    this.el.objective.hidden = !obj;
    if (obj) {
      set('obj-step', `Goal ${s.objective + 1}/${OBJECTIVES.length}`);
      set('obj-text', obj.text);
      set('obj-hint', obj.hint);
    }

    const alert = this.el['smog-alert'];
    alert.hidden = s.smog <= 0;
    if (s.smog > 0) set('smog-alert', `Smog over ${SMOG_DANGER}%! The city chokes in ${Math.max(0, Math.ceil(SMOG_LIMIT_SECONDS - s.smog))}s. Cut industry or build Purifiers.`);

    for (const [type, btn] of this.toolButtons) {
      const def = BUILDINGS[type];
      const affordable = (Object.keys(def.cost) as (keyof typeof def.cost)[]).every((r) => s.res[r] >= (def.cost[r] ?? 0));
      const locked = !!def.minPop && s.pop < def.minPop;
      btn.classList.toggle('cant', !affordable || locked);
      btn.classList.toggle('active', view.build === type);
    }
    this.root.querySelector('[data-doze]')!.classList.toggle('active', view.bulldoze);

    this.updateInspector(s, view.selectedId);
  }

  private updateInspector(s: GameState, id: number): void {
    const panel = this.el.inspector;
    const b = s.buildings.find((o) => o.id === id);
    if (!b) {
      panel.hidden = true;
      this.inspectorKey = '';
      this.confirmDemolish = false;
      return;
    }
    if (!this.inspectorKey.startsWith(`${b.id}:`)) this.confirmDemolish = false;
    const key = `${b.id}:${b.status}:${this.confirmDemolish}`;
    if (key !== this.inspectorKey) {
      this.inspectorKey = key;
      this.renderInspector(b);
    }
    panel.hidden = false;
    const def = BUILDINGS[b.type];
    const bar = panel.querySelector<HTMLElement>('[data-progress]');
    if (bar) {
      const p = b.built < 1 ? b.built : def.process ? b.timer / def.process.time : def.fuel ? Math.min(1, b.fuel / def.fuel.seconds) : 1;
      bar.style.width = `${Math.round(p * 100)}%`;
    }
  }

  private renderInspector(b: Building): void {
    const def = BUILDINGS[b.type];
    const rows: [string, string][] = [];
    if (def.energy) rows.push(['Energy', `${def.energy > 0 ? '+' : ''}${def.energy}`]);
    if (def.pollution) rows.push(['Smog / day', `${def.pollution > 0 ? '+' : ''}${(def.pollution * 60).toFixed(1)}`]);
    if (def.process) rows.push(['Cycle', `${costText(def.process.input)} → ${costText(def.process.output)}`]);
    if (def.fuel) rows.push(['Fuel', `${def.fuel.scrap} scrap / ${def.fuel.seconds}s`]);
    if (def.housing) rows.push(['Homes', `${def.housing} citizens`]);
    if (def.storage) rows.push(['Storage', `${def.storage} scrap`]);
    if (def.bots) rows.push(['Bots', `+${def.bots}`]);
    if (def.happiness) rows.push(['Happiness', `+${def.happiness}`]);
    if (def.cleanRadius) rows.push(['Cleans sludge', `${def.cleanRadius} tiles`]);
    const refund = costText(refundFor(b));
    const pausable = b.built >= 1 && (def.process || def.fuel || def.cleanRadius);
    const panel = this.el.inspector;
    panel.style.setProperty('--path', pathColor(b.type));
    panel.innerHTML = `
      <div class="insp-head">
        <span class="tool-plate"><img src="${buildingThumb(b.type)}" alt="" /></span>
        <div>
          <p class="tag" style="--path:${pathColor(b.type)}">${PATH_LABEL[def.path]}</p>
          <h3>${def.name}</h3>
        </div>
        <button type="button" class="modal-x" data-close aria-label="Close">×</button>
      </div>
      <p class="insp-status status-${b.status}">${STATUS_TEXT[b.status]}</p>
      <div class="progress"><span data-progress></span></div>
      <dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
      <p class="insp-desc">${esc(def.desc)}</p>
      ${pausable ? `<div class="insp-actions"><button type="button" class="btn" data-pause>${b.paused ? 'Resume production' : 'Pause production'}</button></div>` : ''}
      ${
        b.type === 'hq'
          ? ''
          : this.confirmDemolish
            ? `<div class="insp-actions"><button type="button" class="btn tone-danger" data-confirm>Demolish (+${refund})</button><button type="button" class="btn" data-cancel>Keep</button></div>`
            : `<div class="insp-actions"><button type="button" class="btn" data-demolish>Demolish</button></div>`
      }`;
    panel.querySelector('[data-close]')!.addEventListener('click', () => this.handlers.onCloseInspector());
    panel.querySelector('[data-pause]')?.addEventListener('click', () => {
      audio.play('click');
      this.handlers.onTogglePause(b.id);
    });
    panel.querySelector('[data-demolish]')?.addEventListener('click', () => {
      audio.play('click');
      this.confirmDemolish = true;
      this.inspectorKey = `${b.id}:`;
    });
    panel.querySelector('[data-cancel]')?.addEventListener('click', () => {
      this.confirmDemolish = false;
      this.inspectorKey = `${b.id}:`;
    });
    panel.querySelector('[data-confirm]')?.addEventListener('click', () => {
      this.confirmDemolish = false;
      this.handlers.onDemolish(b.id);
    });
  }
}
