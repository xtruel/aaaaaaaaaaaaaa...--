// Interactive tutorial: USA-9 points at the interface and waits for the player to try each thing.
import { audio } from '../audio';
import type { BuildingType } from '../game/defs';
import type { GameState } from '../game/state';
import { t, tk } from '../i18n';
import { localizeKeys } from '../keys';
import { portraitUrl } from '../render/icons';

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface TutorialCtx {
  s: GameState;
  cameraMoved: boolean;
  speed: number;
  hintUsed: boolean;
  hq: Box | null; // the HQ and the ground around it, in screen pixels: where the player builds
}

const overlap = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

interface Step {
  id: string; // text keys: tut.<id>.title / .text / .action
  action?: boolean;
  target?: string;
  done?: (c: TutorialCtx) => boolean;
}

const has = (s: GameState, ...types: BuildingType[]) => s.buildings.some((b) => types.includes(b.type));

const STEPS: Step[] = [
  { id: 'hi' },
  { id: 'look', action: true, done: (c) => c.cameraMoved },
  { id: 'bots', action: true, target: '[data-res="scrap"]', done: (c) => c.s.stats.scrapCollected >= 10 },
  { id: 'recycler', action: true, target: '[data-tool="recycler"]', done: (c) => has(c.s, 'recycler') },
  { id: 'resources', target: '.res-group' },
  { id: 'citizens', action: true, target: '[data-tool="pods"]', done: (c) => has(c.s, 'pods') },
  { id: 'power', action: true, target: '[data-res="energy"]', done: (c) => has(c.s, 'solar', 'burner') },
  { id: 'path', target: '.meter-path' },
  { id: 'smog', target: '.meter-smog' },
  { id: 'speed', action: true, target: '.speed', done: (c) => c.speed >= 2 },
  { id: 'hint', action: true, target: '[data-hint]', done: (c) => c.hintUsed },
  { id: 'goals', target: '[data-objective]' },
  { id: 'ready' },
];

export class Tutorial {
  private index = 0;
  private bubble: HTMLElement;
  private ring: HTMLElement;
  private rendered = -1;
  private spot = -1; // which of the candidate places the bubble sits in

  constructor(
    root: HTMLElement,
    private onFinish: (startCampaign: boolean) => void,
    private onSkip: () => void,
  ) {
    this.ring = document.createElement('div');
    this.ring.className = 'coach-ring';
    this.bubble = document.createElement('div');
    this.bubble.className = 'coach';
    this.bubble.setAttribute('role', 'dialog');
    this.bubble.setAttribute('aria-live', 'polite');
    root.append(this.ring, this.bubble);
  }

  dispose(): void {
    this.ring.remove();
    this.bubble.remove();
  }

  get active(): boolean {
    return this.index < STEPS.length;
  }

  update(ctx: TutorialCtx): void {
    if (!this.active) return;
    const step = STEPS[this.index];
    if (step.done && step.done(ctx)) {
      audio.play('done');
      this.index++;
      if (!this.active) return;
    }
    if (this.rendered !== this.index) this.render();
    this.position(ctx);
  }

  relabel(): void {
    this.rendered = -1;
  }

  private next(): void {
    audio.play('click');
    this.index++;
    if (this.active) this.render();
  }

  private render(): void {
    this.rendered = this.index;
    this.spot = -1;
    const step = STEPS[this.index];
    const last = this.index === STEPS.length - 1;
    this.bubble.innerHTML = `
      <img class="coach-face" src="${portraitUrl('usa')}" alt="" />
      <div class="coach-body">
        <p class="coach-step">${t('tut.step', { n: this.index + 1, total: STEPS.length })}</p>
        <h3>${tk(`tut.${step.id}.title`)}</h3>
        <p>${tk(`tut.${step.id}.text`)}</p>
        ${step.action ? `<p class="coach-action"><span class="dot"></span>${localizeKeys(tk(`tut.${step.id}.action`))}</p>` : ''}
        <div class="coach-buttons">
          ${
            last
              ? `<button type="button" class="btn btn-primary" data-campaign>${t('tut.campaign')}</button><button type="button" class="btn" data-stay>${t('tut.stay')}</button>`
              : `${step.done ? '' : `<button type="button" class="btn btn-primary" data-next>${t('common.next')}</button>`}<button type="button" class="coach-skip" data-skip>${t('tut.skip')}</button>`
          }
        </div>
      </div>`;
    this.bubble.querySelector('[data-next]')?.addEventListener('click', () => this.next());
    this.bubble.querySelector('[data-skip]')?.addEventListener('click', () => {
      this.index = STEPS.length;
      this.dispose();
      this.onSkip();
    });
    this.bubble.querySelector('[data-campaign]')?.addEventListener('click', () => {
      this.index = STEPS.length;
      this.dispose();
      this.onFinish(true);
    });
    this.bubble.querySelector('[data-stay]')?.addEventListener('click', () => {
      this.index = STEPS.length;
      this.dispose();
      this.onFinish(false);
    });
  }

  // The bubble goes where it hides the least of what the player needs: the thing it points at,
  // the ground around the HQ (where they are asked to build), the goal card and the build bar.
  private position(ctx: TutorialCtx): void {
    const step = STEPS[this.index];
    const target = step.target ? document.querySelector<HTMLElement>(`.game ${step.target}`) : null;
    const b = this.bubble;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const bw = Math.min(360, vw - 24);
    b.style.width = `${bw}px`;
    b.style.bottom = '';
    const bh = b.offsetHeight;
    const avoid: { box: Box; weight: number }[] = [];
    const add = (el: Element | null, weight: number) => {
      if (el && (el as HTMLElement).offsetParent !== null) avoid.push({ box: el.getBoundingClientRect(), weight });
    };
    add(document.querySelector('.game [data-objective]'), 1);
    add(document.querySelector('.game [data-toolbar]'), 0.6);
    add(document.querySelector('.game .hud-top'), 0.3);
    add(document.querySelector('.game [data-feed]'), 0.5);
    if (ctx.hq) avoid.push({ box: ctx.hq, weight: step.action ? 3 : 1 });

    const shown = !!target && target.offsetParent !== null;
    this.ring.hidden = !shown;
    const r = shown ? target!.getBoundingClientRect() : null;
    if (r) {
      this.ring.style.left = `${r.left - 6}px`;
      this.ring.style.top = `${r.top - 6}px`;
      this.ring.style.width = `${r.width + 12}px`;
      this.ring.style.height = `${r.height + 12}px`;
      avoid.push({ box: { left: r.left - 8, top: r.top - 8, right: r.right + 8, bottom: r.bottom + 8 }, weight: 4 });
    }
    const at = (left: number, top: number): Box => {
      const l = Math.max(12, Math.min(vw - bw - 12, left));
      const t = Math.max(8, Math.min(vh - bh - 8, top));
      return { left: l, top: t, right: l + bw, bottom: t + bh };
    };
    const toolbarTop = document.querySelector('.game [data-toolbar]')?.getBoundingClientRect().top ?? vh;
    const spots: Box[] = [];
    if (r) {
      const cx = r.left + r.width / 2 - bw / 2;
      spots.push(at(cx, r.bottom + 18), at(cx, r.top - 18 - bh), at(r.right + 18, r.top), at(r.left - 18 - bw, r.top));
    }
    spots.push(at(12, toolbarTop - bh - 14), at(vw - bw - 12, toolbarTop - bh - 14), at((vw - bw) / 2, Math.max(80, vh * 0.2)));
    const cost = (c: Box) => avoid.reduce((sum, a) => sum + overlap(c, a.box) * a.weight, 0);
    let best = 0;
    for (let i = 1; i < spots.length; i++) if (cost(spots[i]) < cost(spots[best])) best = i;
    // stay put unless the new place is clearly better, so the bubble does not hop while the map scrolls
    if (this.spot >= 0 && this.spot < spots.length && cost(spots[this.spot]) <= cost(spots[best]) + bw * 40) best = this.spot;
    this.spot = best;
    b.style.left = `${spots[best].left}px`;
    b.style.top = `${spots[best].top}px`;
  }
}
