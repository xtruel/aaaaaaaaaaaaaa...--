// In-game DOM interface: resource bar, meters, goal, toolbar, inspector and message feed.
import { audio } from '../audio';
import { buildCost, canAfford, costText, refundFor } from '../game/actions';
import { cityById, goalText } from '../game/cities';
import { freeHintsLeft, hintPrice } from '../game/hints';
import { BUILDINGS, BUILD_ORDER, BULLDOZE_RUBBLE_COST, IMPORT_PARTS, SMOG_DANGER, SMOG_LIMIT_SECONDS } from '../game/defs';
import type { BuildingType, Cost } from '../game/defs';
import { dayPhase } from '../game/sim';
import { day } from '../game/state';
import type { Building, BuildingStatus, GameState, Message } from '../game/state';
import { OBJECTIVES, objectiveHint, objectiveText } from '../game/story';
import { bDesc, bName, pathLabel, t, tk } from '../i18n';
import { keyLabel } from '../keys';
import { buildingThumb, iconUrl, pathColor, portraitUrl } from '../render/icons';
import type { IconName } from '../render/icons';
import { esc } from './escape';

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
}

export interface HudView {
  speed: number;
  build: BuildingType | null;
  bulldoze: boolean;
  selectedId: number;
}

function statusText(b: Building): string {
  const def = BUILDINGS[b.type];
  if (b.status === 'noInput' && def.process) {
    return t('status.waiting', { what: costText(def.process.input) });
  }
  return tk(`status.${b.status satisfies BuildingStatus}`);
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


export class Hud {
  private root: HTMLElement;
  private handlers: HudHandlers;
  private el: Record<string, HTMLElement> = {};
  private toolButtons = new Map<BuildingType, HTMLButtonElement>();
  private inspectorKey = '';
  private confirmDemolish = false;
  private starsKey = '';
  private s: GameState;

  constructor(root: HTMLElement, handlers: HudHandlers, s: GameState) {
    this.root = root;
    this.handlers = handlers;
    this.s = s;
    this.build();
  }

  // After a language change: rebuild every label, keep the game state as it is.
  relabel(): void {
    this.el = {};
    this.toolButtons.clear();
    this.inspectorKey = '';
    this.starsKey = '';
    this.last = {};
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
          ${res('scrap', 'scrap', t('res.scrap'), 'var(--orange)')}
          ${res('parts', 'parts', t('res.parts'), 'var(--sky)')}
          <button type="button" class="import" data-import title="${t('hud.import', IMPORT_PARTS)}" aria-label="${t('hud.import', IMPORT_PARTS)}">+</button>
          ${res('credits', 'credits', t('res.credits'), 'var(--yellow)')}
          ${res('energy', 'energy', t('res.energy'), 'var(--teal)')}
          ${res('pop', 'pop', t('res.citizens'), 'var(--pink)')}
          ${res('happy', 'happy', t('res.happiness'), 'var(--lime)')}
        </div>
        <div class="meters">
          <div class="meter meter-smog" title="${t('hud.smog.title', { limit: SMOG_DANGER, seconds: SMOG_LIMIT_SECONDS })}">
            <span class="meter-ico"><img src="${iconUrl('smog')}" alt="" /></span>
            <span class="meter-label">${t('hud.smog')}</span>
            <div class="bar"><span data-smog-bar></span></div>
            <b data-smog></b>
          </div>
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
      <aside class="inspector" data-inspector hidden></aside>
      <div class="tooltip" data-tooltip hidden></div>
      <nav class="toolbar" data-toolbar aria-label="${t('hud.build')}"></nav>
    `;
    for (const node of this.root.querySelectorAll<HTMLElement>('[data-v],[data-cap]')) {
      const key = node.closest<HTMLElement>('[data-res]')!.dataset.res!;
      this.el[`${key}:${node.hasAttribute('data-v') ? 'v' : 'cap'}`] = node;
    }
    for (const name of ['smog-bar', 'smog', 'knob', 'day', 'time', 'objective', 'obj-step', 'obj-text', 'obj-hint', 'stars', 'hint-badge', 'feed', 'smog-alert', 'inspector', 'tooltip', 'toolbar']) {
      this.el[name] = this.root.querySelector(`[data-${name}]`)!;
    }

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
        <span class="tool-plate"><img src="${buildingThumb(type)}" alt="" /></span>
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
    const doze = document.createElement('button');
    doze.type = 'button';
    doze.className = 'tool tool-doze';
    doze.dataset.doze = '';
    doze.innerHTML = `
      <kbd>${keyLabel('KeyX', 'X')}</kbd>
      <span class="tool-plate"><img src="${iconUrl('bulldoze', 4)}" alt="" /></span>
      <span class="tool-name">${t('b.bulldoze')}</span>
      <span class="tool-cost">${costChips({ credits: BULLDOZE_RUBBLE_COST })}</span>`;
    doze.addEventListener('click', () => {
      audio.play('click');
      this.handlers.onBulldoze();
    });
    const tools = document.createElement('div');
    tools.className = 'tool-group group-tools-misc';
    tools.innerHTML = `<span class="group-label">${t('hud.group.tools')}</span><div class="group-tools"></div>`;
    tools.querySelector('.group-tools')!.append(doze);
    toolbar.append(tools);
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
      <p class="tip-desc">${esc(bDesc(type))}</p>
      <ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
      <p class="tip-cost">${costChips(buildCost(this.s, type))}</p>`;
    tip.hidden = false;
    const r = anchor.getBoundingClientRect();
    const tw = tip.offsetWidth;
    tip.style.left = `${Math.max(8, Math.min(window.innerWidth - tw - 8, r.left + r.width / 2 - tw / 2))}px`;
    tip.style.bottom = `${window.innerHeight - r.top + 8}px`;
  }

  private hideTooltip(): void {
    this.el.tooltip.hidden = true;
  }

  private msgTimers = new WeakMap<HTMLElement, number[]>();

  pushMessages(list: Message[]): void {
    const feed = this.el.feed;
    for (const m of list) {
      // the same line twice in a row becomes "text ×2" instead of pushing older news away
      const lastMsg = feed.lastElementChild as HTMLElement | null;
      let p: HTMLElement;
      if (lastMsg && lastMsg.dataset.text === m.text) {
        p = lastMsg;
        const count = Number(p.dataset.count ?? '1') + 1;
        p.dataset.count = String(count);
        p.textContent = `${m.text} ×${count}`;
        p.classList.remove('msg-out');
        for (const t of this.msgTimers.get(p) ?? []) window.clearTimeout(t);
      } else {
        p = document.createElement('p');
        p.className = `msg msg-${m.tone}`;
        p.dataset.text = m.text;
        p.textContent = m.text;
        feed.append(p);
      }
      const el = p;
      this.msgTimers.set(el, [window.setTimeout(() => el.classList.add('msg-out'), 6500), window.setTimeout(() => el.remove(), 7200)]);
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

    const pol = Math.round(s.pollution);
    set('smog', `${pol}%${d.pollutionRate > 0.01 ? ' ▲' : d.pollutionRate < -0.01 ? ' ▼' : ''}`);
    (this.el['smog-bar'] as HTMLElement).style.width = `${s.pollution}%`;
    this.el['smog-bar'].dataset.level = pol >= 75 ? 'high' : pol >= 45 ? 'mid' : 'low';
    this.el.knob.style.left = `${50 - s.alignment / 2}%`;

    set('day', t('common.day', { n: day(s) }));
    const minutes = Math.floor(dayPhase(s) * 24 * 60 + 6 * 60) % (24 * 60);
    set('time', `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`);
    this.root.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach((b) => b.classList.toggle('active', Number(b.dataset.speed) === view.speed));

    const obj = OBJECTIVES[s.objective];
    const city = cityById(s.cityId);
    this.el.objective.hidden = !obj && !city;
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

    for (const [type, btn] of this.toolButtons) {
      const def = BUILDINGS[type];
      const affordable = canAfford(s, buildCost(s, type));
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
    // Rebuild only when the buttons change; status text updates in place so clicks are never lost.
    const key = `${b.id}:${b.built >= 1}:${b.paused}:${this.confirmDemolish}`;
    if (key !== this.inspectorKey) {
      this.inspectorKey = key;
      this.renderInspector(s, b);
    }
    panel.hidden = false;
    const def = BUILDINGS[b.type];
    const status = panel.querySelector<HTMLElement>('[data-status]');
    if (status) {
      const text = statusText(b);
      if (status.textContent !== text) status.textContent = text;
      status.className = `insp-status status-${b.status}`;
    }
    const bar = panel.querySelector<HTMLElement>('[data-progress]');
    if (bar) {
      const p = b.built < 1 ? b.built : def.process ? b.timer / def.process.time : def.fuel ? Math.min(1, b.fuel / def.fuel.seconds) : 1;
      bar.style.width = `${Math.round(p * 100)}%`;
    }
  }

  private renderInspector(s: GameState, b: Building): void {
    const def = BUILDINGS[b.type];
    const rows: [string, string][] = [];
    if (def.energy) rows.push([t('insp.energy'), `${def.energy > 0 ? '+' : ''}${def.energy}`]);
    if (def.pollution) rows.push([t('insp.smog'), `${def.pollution > 0 ? '+' : ''}${(def.pollution * 60).toFixed(1)}`]);
    if (def.process) rows.push([t('insp.cycle'), `${costText(def.process.input)} → ${costText(def.process.output)}`]);
    if (def.fuel) rows.push([t('insp.fuel'), t('insp.fuelValue', { n: def.fuel.scrap, s: def.fuel.seconds })]);
    if (def.housing) rows.push([t('insp.homes'), t('insp.homesValue', { n: def.housing })]);
    if (def.storage) rows.push([t('insp.storage'), costText({ scrap: def.storage })]);
    if (def.bots) rows.push([t('insp.bots'), `+${def.bots}`]);
    if (def.happiness) rows.push([t('insp.happiness'), `+${def.happiness}`]);
    if (def.cleanRadius) rows.push([t('insp.cleans'), t('insp.cleansValue', { n: def.cleanRadius })]);
    const refund = costText(refundFor(s, b));
    const pausable = b.built >= 1 && (def.process || def.fuel || def.cleanRadius);
    const panel = this.el.inspector;
    panel.style.setProperty('--path', pathColor(b.type));
    panel.innerHTML = `
      <div class="insp-head">
        <span class="tool-plate"><img src="${buildingThumb(b.type)}" alt="" /></span>
        <div>
          <p class="tag" style="--path:${pathColor(b.type)}">${pathLabel(def.path)}</p>
          <h3>${bName(b.type)}</h3>
        </div>
        <button type="button" class="modal-x" data-close aria-label="${t('common.close')}">×</button>
      </div>
      <p class="insp-status status-${b.status}" data-status>${statusText(b)}</p>
      <div class="progress"><span data-progress></span></div>
      <dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
      <p class="insp-desc">${esc(bDesc(b.type))}</p>
      ${pausable ? `<div class="insp-actions"><button type="button" class="btn" data-pause>${b.paused ? t('insp.resume') : t('insp.pause')}</button></div>` : ''}
      ${
        b.type === 'hq'
          ? ''
          : this.confirmDemolish
            ? `<div class="insp-actions"><button type="button" class="btn tone-danger" data-confirm>${t('insp.demolishConfirm', { refund })}</button><button type="button" class="btn" data-cancel>${t('insp.keep')}</button></div>`
            : `<div class="insp-actions"><button type="button" class="btn" data-demolish>${t('insp.demolish')}</button></div>`
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
