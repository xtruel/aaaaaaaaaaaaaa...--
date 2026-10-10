// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addBuilding, createGame } from '../src/game/state';
import type { BuildingType } from '../src/game/defs';
import type { GameState } from '../src/game/state';
import { Tutorial } from '../src/ui/tutorial';
import type { TutorialCtx } from '../src/ui/tutorial';

// jsdom has no canvas or audio: the portrait and the sounds are not what is tested here
vi.mock('../src/render/icons', () => ({ portraitUrl: () => '' }));
vi.mock('../src/audio', () => ({ audio: { play: () => {} } }));

function setup() {
  const root = document.createElement('div');
  document.body.append(root);
  const tut = new Tutorial(root, () => {}, () => {});
  const s = createGame({ seed: 7 });
  const ctx: TutorialCtx = { s, cameraMoved: false, speed: 1, hq: null };
  return { root, tut, s, ctx };
}

function build(s: GameState, type: BuildingType): void {
  const hq = s.buildings[0];
  addBuilding(s, type, hq.x + 4 + s.buildings.length * 3, hq.y);
}

const stepTitle = (root: HTMLElement) => root.querySelector('.coach-step')?.textContent;
const action = (root: HTMLElement) => root.querySelector('.coach-action')?.innerHTML ?? '';

describe('tutorial', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.body.classList.remove('pad-mode');
  });

  it('keeps the goal card back until the last step, and asks for the build tool to be put away after each build', () => {
    const { root, tut, s, ctx } = setup();
    expect(tut.update(ctx)).toBe(false);
    expect(stepTitle(root)).toContain('1/7');
    expect(tut.showsGoal).toBe(false);

    ctx.cameraMoved = true;
    expect(tut.update(ctx)).toBe(false); // looking around is not a build
    expect(stepTitle(root)).toContain('2/7');

    for (const [type, next] of [['recycler', '3/7'], ['pods', '4/7'], ['solar', '5/7']] as const) {
      expect(tut.update(ctx)).toBe(false);
      build(s, type);
      expect(tut.update(ctx)).toBe(true);
      expect(stepTitle(root)).toContain(next);
      expect(tut.showsGoal).toBe(false);
    }

    ctx.speed = 2;
    expect(tut.update(ctx)).toBe(false);
    expect(stepTitle(root)).toContain('6/7');
    expect(tut.showsGoal).toBe(false);
    root.querySelector<HTMLButtonElement>('[data-next]')!.click();
    expect(stepTitle(root)).toContain('7/7');
    expect(tut.showsGoal).toBe(true);
  });

  it('names controller buttons instead of keys in pad mode, and switches when the pad is picked up', () => {
    const { root, tut, ctx } = setup();
    tut.update(ctx);
    expect(action(root)).toContain('WASD');
    document.body.classList.add('pad-mode');
    tut.update(ctx);
    expect(action(root)).toContain('right stick');
    expect(action(root)).not.toContain('WASD');

    ctx.cameraMoved = true;
    tut.update(ctx);
    expect(action(root)).toContain('<kbd>A</kbd>');
    expect(action(root)).not.toContain('(2)');
  });
});
