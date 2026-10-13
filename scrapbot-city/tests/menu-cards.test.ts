// @vitest-environment jsdom
// The main menu's path cards show the game's isometric pictures (G5): the menu is first drawn a few milliseconds
// before the sprite atlas is decoded, and cards painted then kept the old flat sprites of 0.5 for good. They are now
// painted when the atlas is ready (at once if it already is), and again after a language change rebuilds the menu.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const atlas = vi.hoisted(() => ({ waiting: [] as (() => void)[], ready: false }));
const painted = vi.hoisted(() => [] as string[]);

vi.mock('../src/render/iso/atlas', () => ({
  whenAtlasReady: (fn: () => void) => (atlas.ready ? fn() : atlas.waiting.push(fn)),
  atlasImage: () => null,
  frame: () => undefined,
}));
vi.mock('../src/render/menuBg', () => ({
  MenuBackground: class {
    resize(): void {}
    start(): void {}
    stop(): void {}
    setReducedMotion(): void {}
  },
  paintCardScene: (c: HTMLCanvasElement, scene: string) => painted.push(`${scene}:${c.isConnected}`),
}));
vi.mock('../src/render/icons', () => ({ iconUrl: () => '' }));
vi.mock('../src/audio', () => ({ audio: { play: () => {}, unlock: () => {} } }));

import { setLang } from '../src/i18n';
import { MainMenu } from '../src/ui/menu';

const handlers = new Proxy({}, { get: () => () => {} }) as ConstructorParameters<typeof MainMenu>[1];

beforeEach(() => {
  atlas.waiting.length = 0;
  atlas.ready = false;
  painted.length = 0;
  document.body.innerHTML = '<div id="menu"></div>';
  setLang('en');
});

describe('main menu path cards', () => {
  it('are painted when the atlas is ready, not before', () => {
    new MainMenu(document.getElementById('menu')!, handlers);
    expect(painted).toEqual([]);
    atlas.ready = true;
    for (const fn of atlas.waiting.splice(0)) fn();
    expect(painted).toEqual(['green:true', 'industrial:true', 'choices:true', 'shape:true']);
  });

  it('are painted at once when the atlas already is, also after a language change', () => {
    atlas.ready = true;
    const menu = new MainMenu(document.getElementById('menu')!, handlers);
    expect(painted).toHaveLength(4);
    setLang('it');
    menu.render();
    expect(painted).toHaveLength(8);
    expect(painted.slice(4).every((p) => p.endsWith(':true'))).toBe(true);
  });
});
