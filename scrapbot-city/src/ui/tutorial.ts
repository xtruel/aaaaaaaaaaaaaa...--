// Interactive tutorial: USA-9 points at the interface and waits for the player to try each thing.
import { audio } from '../audio';
import type { BuildingType } from '../game/defs';
import type { GameState } from '../game/state';
import { portraitUrl } from '../render/icons';

export interface TutorialCtx {
  s: GameState;
  cameraMoved: boolean;
  speed: number;
  hintUsed: boolean;
}

interface Step {
  title: string;
  text: string;
  action?: string;
  target?: string;
  done?: (c: TutorialCtx) => boolean;
}

const has = (s: GameState, ...types: BuildingType[]) => s.buildings.some((b) => types.includes(b.type));

const STEPS: Step[] = [
  {
    title: 'Hi boss!',
    text: "I'm USA-9, lead scrapbot. This is the Training Yard: let's turn some junk into a city. I'll show you the basics in a few minutes.",
  },
  {
    title: 'Look around',
    text: 'The map is bigger than your screen. Junk piles, rubble and toxic sludge are everywhere.',
    action: 'Drag the map, or use WASD / arrow keys. The mouse wheel zooms.',
    done: (c) => c.cameraMoved,
  },
  {
    title: 'Bots work on their own',
    text: 'See the little white bots? They fly to junk piles and bring the scrap back to the HQ. You never have to tell them.',
    action: 'Wait until your bots collect 10 scrap.',
    target: '[data-res="scrap"]',
    done: (c) => c.s.stats.scrapCollected >= 10,
  },
  {
    title: 'Build a Recycler',
    text: 'Scrap alone builds nothing. A Recycler turns it into parts, and parts build everything else.',
    action: 'Click the Recycler (or press 2), then click an empty spot near the HQ. Green squares mean OK.',
    target: '[data-tool="recycler"]',
    done: (c) => has(c.s, 'recycler'),
  },
  {
    title: 'Your resources',
    text: 'Scrap, parts and credits pay for buildings. Energy, citizens and happiness keep the city alive. A red number means trouble.',
    target: '.res-group',
  },
  {
    title: 'Citizens',
    text: 'Bot Pods bring citizens. They pay taxes every second, and they throw away junk that your bots collect again.',
    action: 'Build Bot Pods (press 3).',
    target: '[data-tool="pods"]',
    done: (c) => has(c.s, 'pods'),
  },
  {
    title: 'Power up',
    text: 'Machines need energy: the number shows made / used. Without enough power everything slows down. Solar is clean but pricey, the Scrap Burner is cheap and smoky.',
    action: 'Build a Solar Array (4) or a Scrap Burner (9).',
    target: '[data-res="energy"]',
    done: (c) => has(c.s, 'solar', 'burner'),
  },
  {
    title: 'Green or Industry?',
    text: 'Every building and every story choice pushes this meter. When you finish the Scrap Spire, it decides what kind of city you built.',
    target: '.meter-path',
  },
  {
    title: 'Watch the smog',
    text: 'Industry and toxic sludge raise the smog, gardens and Purifiers lower it. Above 95% for 30 seconds the city is lost.',
    target: '.meter-smog',
  },
  {
    title: 'Time controls',
    text: 'You can pause to plan, or speed things up when you are just waiting for money.',
    action: 'Switch to a faster speed (or press Tab).',
    target: '.speed',
    done: (c) => c.speed >= 2,
  },
  {
    title: 'Ask me anything',
    text: 'Stuck? I read the whole city and tell you what to build next. Your first 3 hints in every city are free, then they cost credits.',
    action: 'Click the light bulb.',
    target: '[data-hint]',
    done: (c) => c.hintUsed,
  },
  {
    title: 'Follow the goals',
    text: 'This card always shows your next goal and gives a small reward. The last goal is the Scrap Spire: it completes the city.',
    target: '[data-objective]',
  },
  {
    title: "You're ready!",
    text: 'That is everything you need. The Scrap Coast has five cities waiting, each with its own rules and three stars to earn.',
  },
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
        <p class="coach-step">Tutorial · ${this.index + 1}/${STEPS.length}</p>
        <h3>${step.title}</h3>
        <p>${step.text}</p>
        ${step.action ? `<p class="coach-action"><span class="dot"></span>${step.action}</p>` : ''}
        <div class="coach-buttons">
          ${
            last
              ? '<button type="button" class="btn btn-primary" data-campaign>Start the campaign</button><button type="button" class="btn" data-stay>Keep playing here</button>'
              : `${step.done ? '' : '<button type="button" class="btn btn-primary" data-next>Next</button>'}<button type="button" class="coach-skip" data-skip>Skip tutorial</button>`
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
