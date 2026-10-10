// Interactive tutorial: USA-9 points at the interface and waits for the player to try each thing.
import { audio } from '../audio';
import type { BuildingType } from '../game/defs';
import type { GameState } from '../game/state';
import { t, tk } from '../i18n';
import { localizeKeys } from '../keys';
import { portraitUrl } from '../render/icons';

export interface TutorialCtx {
  s: GameState;
  cameraMoved: boolean;
  speed: number;
  hintUsed: boolean;
}

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
    this.position();
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

  private position(): void {
    const step = STEPS[this.index];
    const target = step.target ? document.querySelector<HTMLElement>(`.game ${step.target}`) : null;
    const b = this.bubble;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const bw = Math.min(360, vw - 24);
    b.style.width = `${bw}px`;
    if (!target || target.offsetParent === null) {
      this.ring.hidden = true;
      b.style.left = `${(vw - bw) / 2}px`;
      b.style.top = `${Math.max(80, vh * 0.2)}px`;
      b.style.bottom = '';
      return;
    }
    const r = target.getBoundingClientRect();
    this.ring.hidden = false;
    this.ring.style.left = `${r.left - 6}px`;
    this.ring.style.top = `${r.top - 6}px`;
    this.ring.style.width = `${r.width + 12}px`;
    this.ring.style.height = `${r.height + 12}px`;
    b.style.left = `${Math.max(12, Math.min(vw - bw - 12, r.left + r.width / 2 - bw / 2))}px`;
    if (r.top + r.height / 2 < vh * 0.5) {
      b.style.top = `${Math.min(vh - b.offsetHeight - 12, r.bottom + 18)}px`;
      b.style.bottom = '';
    } else {
      b.style.top = '';
      b.style.bottom = `${Math.min(vh - b.offsetHeight - 12, vh - r.top + 18)}px`;
    }
  }
}
