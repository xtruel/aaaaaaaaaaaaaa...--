// Interactive tutorial: USA-9 points at the interface and waits for the player to try each thing.
// Short on purpose: five things to do, one thing to read, then the goal card takes over.
import { audio } from '../audio';
import { SMOG_DANGER } from '../game/defs';
import type { BuildingType } from '../game/defs';
import type { GameState } from '../game/state';
import { t } from '../i18n';
import { inputKind, inputText } from '../input';
import type { InputKind } from '../input';
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
  hq: Box | null; // the HQ and the ground around it, in screen pixels: where the player builds
}

const overlap = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

interface Step {
  id: string; // text keys: tut.<id>.title / .text / .action, plus .actionPad / .textPad naming controller buttons
  action?: boolean;
  target?: string; // selector inside the game screen; every match gets a ring
  done?: (c: TutorialCtx) => boolean;
  builds?: boolean; // done by placing a building
}

const has = (s: GameState, ...types: BuildingType[]) => s.buildings.some((b) => types.includes(b.type));

const STEPS: Step[] = [
  { id: 'hi', action: true, done: (c) => c.cameraMoved },
  { id: 'recycler', action: true, builds: true, target: '[data-tool="recycler"]', done: (c) => has(c.s, 'recycler') },
  { id: 'citizens', action: true, builds: true, target: '[data-tool="pods"]', done: (c) => has(c.s, 'pods') },
  { id: 'power', action: true, builds: true, target: '[data-tool="solar"], [data-tool="burner"]', done: (c) => has(c.s, 'solar', 'burner') },
  { id: 'speed', action: true, target: '.speed', done: (c) => c.speed >= 2 },
  { id: 'path', target: '.meters' },
  { id: 'ready', target: '[data-hint], [data-objective]' },
];

export class Tutorial {
  private index = 0;
  private bubble: HTMLElement;
  private rings: HTMLElement[] = [];
  private rendered = -1;
  private renderedInput: InputKind = 'mouse'; // whose lines were shown: picking up the pad, a finger or the mouse swaps them
  private spot = -1; // which of the candidate places the bubble sits in

  constructor(
    private root: HTMLElement,
    private onFinish: (startCampaign: boolean) => void,
    private onSkip: () => void,
  ) {
    this.bubble = document.createElement('div');
    this.bubble.className = 'coach';
    this.bubble.setAttribute('role', 'dialog');
    this.bubble.setAttribute('aria-live', 'polite');
    root.append(this.bubble);
  }

  dispose(): void {
    for (const ring of this.rings) ring.remove();
    this.bubble.remove();
  }

  get active(): boolean {
    return this.index < STEPS.length;
  }

  // The goal card waits until the last step, which introduces it: one card to read at a time.
  get showsGoal(): boolean {
    return !this.active || STEPS[this.index].id === 'ready';
  }

  // True right after a step the player finished by placing a building (the caller puts the build tool away).
  update(ctx: TutorialCtx): boolean {
    if (!this.active) return false;
    const step = STEPS[this.index];
    const done = !!step.done && step.done(ctx);
    if (done) {
      audio.play('done');
      this.index++;
    }
    if (this.active) {
      if (this.rendered !== this.index) this.render();
      else if (this.renderedInput !== inputKind()) this.syncInput();
      this.position(ctx);
    }
    return done && !!step.builds;
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
    this.renderedInput = inputKind();
    this.spot = -1;
    const step = STEPS[this.index];
    const last = this.index === STEPS.length - 1;
    // the lines that say how to do something name the controls of the input in use: keys in the player's keyboard
    // layout and the mouse, a finger, or the controller's buttons (A, Y, L3...)
    const text = (part: string) => this.line(part);
    this.bubble.innerHTML = `
      <img class="coach-face" src="${portraitUrl('usa')}" alt="" />
      <div class="coach-body">
        <p class="coach-step">${t('tut.step', { n: this.index + 1, total: STEPS.length })}</p>
        <h3 data-coach="title">${text('title')}</h3>
        <p data-coach="text">${text('text')}</p>
        ${step.action ? `<p class="coach-action"><span class="dot"></span><span data-coach="action">${text('action')}</span></p>` : ''}
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

  // A line of the step on screen, in the words of the input last shown.
  private line(part: string): string {
    return inputText(`tut.${STEPS[this.index].id}.${part}`, { limit: SMOG_DANGER }, this.renderedInput);
  }

  // The player switched input (the mouse after a finger, the pad): the lines are rewritten in place and the buttons
  // stay (a bubble rebuilt between a press and its release would lose the click on Next).
  private syncInput(): void {
    this.renderedInput = inputKind();
    for (const el of this.bubble.querySelectorAll<HTMLElement>('[data-coach]')) {
      const html = this.line(el.dataset.coach!);
      if (el.innerHTML !== html) el.innerHTML = html;
    }
  }

  private ring(i: number): HTMLElement {
    while (this.rings.length <= i) {
      const ring = document.createElement('div');
      ring.className = 'coach-ring';
      this.root.append(ring);
      this.rings.push(ring);
    }
    return this.rings[i];
  }

  // The bubble goes where it hides the least of what the player needs: the things it points at,
  // the ground around the HQ (where they are asked to build), the goal card and the build bar.
  private position(ctx: TutorialCtx): void {
    const step = STEPS[this.index];
    const targets = step.target ? [...this.root.querySelectorAll<HTMLElement>(step.target)].filter((el) => el.offsetParent !== null) : [];
    const b = this.bubble;
    // between the HUD's sides: the window's, or in the iOS app the safe area's (src/style.css)
    const hud = this.root.querySelector('.hud')?.getBoundingClientRect();
    const frame = hud && hud.width > 0 ? hud : new DOMRect(0, 0, window.innerWidth, window.innerHeight);
    const vw = frame.right;
    const vh = window.innerHeight;
    const bw = Math.min(360, frame.width - 24);
    b.style.width = `${bw}px`;
    b.style.bottom = '';
    const bh = b.offsetHeight;
    const avoid: { box: Box; weight: number }[] = [];
    const add = (el: Element | null, weight: number) => {
      if (el && (el as HTMLElement).offsetParent !== null) avoid.push({ box: el.getBoundingClientRect(), weight });
    };
    add(this.root.querySelector('[data-objective]'), 1);
    add(this.root.querySelector('[data-toolbar]'), 0.6);
    add(this.root.querySelector('.hud-top'), 0.3);
    add(this.root.querySelector('[data-feed]'), 0.5);
    if (ctx.hq) avoid.push({ box: ctx.hq, weight: step.action ? 3 : 1 });

    const at = (left: number, top: number): Box => {
      const l = Math.max(frame.left + 12, Math.min(vw - bw - 12, left));
      const t = Math.max(frame.top + 8, Math.min(vh - bh - 8, top));
      return { left: l, top: t, right: l + bw, bottom: t + bh };
    };
    const spots: Box[] = [];
    targets.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const ring = this.ring(i);
      ring.style.left = `${r.left - 6}px`;
      ring.style.top = `${r.top - 6}px`;
      ring.style.width = `${r.width + 12}px`;
      ring.style.height = `${r.height + 12}px`;
      avoid.push({ box: { left: r.left - 8, top: r.top - 8, right: r.right + 8, bottom: r.bottom + 8 }, weight: 4 });
      const cx = r.left + r.width / 2 - bw / 2;
      spots.push(at(cx, r.bottom + 18), at(cx, r.top - 18 - bh), at(r.right + 18, r.top), at(r.left - 18 - bw, r.top));
    });
    this.rings.forEach((ring, i) => (ring.hidden = i >= targets.length));
    const toolbarTop = this.root.querySelector('[data-toolbar]')?.getBoundingClientRect().top ?? vh;
    spots.push(at(frame.left + 12, toolbarTop - bh - 14), at(vw - bw - 12, toolbarTop - bh - 14), at((frame.left + vw - bw) / 2, Math.max(80, vh * 0.2)));
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
