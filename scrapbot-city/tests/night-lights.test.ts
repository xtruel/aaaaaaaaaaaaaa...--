// @vitest-environment jsdom
// Night lights and what stands in front of them (G3 review): a piece's light (a lamp's lens and pool, a sign's neon, a
// statue's eyes, a pillar's lamp) and a building's glow do not shine through a piece drawn in front of them (a tree, a
// statue, a fountain); a piece's light still does not shine through a building in front. With nothing in front, or in
// a city without pieces, every light is drawn straight onto the city as before. The renderer's lights pass runs on a
// recording 2D context (jsdom has no canvas): what is drawn where, and with which composite operation, is checked.
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MAP_W } from '../src/game/defs';
import { createGame } from '../src/game/state';
import type { GameState } from '../src/game/state';
import { frame } from '../src/render/iso/atlas';
import type { Frame } from '../src/render/iso/atlas';
import { tileTop } from '../src/render/iso/projection';
import { Renderer } from '../src/render/renderer';

interface Call {
  name: string;
  args: unknown[];
  op: string;
  alpha: number;
  canvas: HTMLCanvasElement;
}
const calls: Call[] = [];

function fakeContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const state: Record<string, unknown> = { globalCompositeOperation: 'source-over', globalAlpha: 1, fillStyle: '', imageSmoothingEnabled: false };
  return new Proxy(state, {
    get(t, k: string) {
      if (k in t) return t[k];
      return (...args: unknown[]) => {
        calls.push({ name: k, args, op: t.globalCompositeOperation as string, alpha: t.globalAlpha as number, canvas });
        if (k === 'getImageData' || k === 'createImageData') return { data: new Uint8ClampedArray(4), width: 1, height: 1 };
        if (k === 'measureText') return { width: 0 };
        if (k === 'createLinearGradient' || k === 'createRadialGradient') return { addColorStop: () => {} };
        return undefined;
      };
    },
    set(t, k: string, v) {
      t[k] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

beforeAll(() => {
  const ctxs = new WeakMap<HTMLCanvasElement, CanvasRenderingContext2D>();
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement) {
    if (!ctxs.has(this)) ctxs.set(this, fakeContext(this));
    return ctxs.get(this)!;
  } as unknown as HTMLCanvasElement['getContext'];
});
beforeEach(() => {
  calls.length = 0;
});

const K_BUILDING = 1;
const K_PIECE = 7;
const CODE = { lamp: 3, sign: 6, pillar: 11, tree: 12, fountain: 13, statue: 14 } as const;
const NAME: Record<string, (rot: number) => string> = {
  lamp: (r) => `pc/lamp/${r}`,
  sign: (r) => `pc/sign/0/${r}`,
  pillar: () => 'pc/pillar/0',
  tree: () => 'pc/tree/0',
  fountain: () => 'pc/fountain/0',
  statue: (r) => `pc/statue/${r}`,
};

type Drawn = { kind: number; ref: number; index: number; f: Frame | null; sx: number; sy: number; w: number; h: number };

// A renderer whose last frame drew `items` in this order (pieces on their tiles, buildings where they stand).
function scene(s: GameState, items: ({ piece: keyof typeof CODE; x: number; y: number; rot?: number } | { building: number })[]) {
  const r = new Renderer(document.createElement('canvas'));
  const R = r as unknown as { drawn: Drawn[]; drawnCount: number; pieceNames: string[]; buildingFrameName(s: GameState, b: unknown): string };
  R.drawn = [];
  for (const it of items) {
    if ('piece' in it) {
      const i = it.y * MAP_W + it.x;
      s.solid[i] = CODE[it.piece];
      s.rot[i] = it.rot ?? 0;
      const name = NAME[it.piece](it.rot ?? 0);
      R.pieceNames[i] = name;
      const f = frame(name)!;
      const top = tileTop(it.x, it.y);
      R.drawn.push({ kind: K_PIECE, ref: i, index: i, f, sx: top.X - f.ax, sy: top.Y - f.ay, w: f.w, h: f.h });
    } else {
      const k = it.building;
      const b = s.buildings[k];
      const f = frame(R.buildingFrameName(s, b))!;
      const top = tileTop(b.x, b.y);
      R.drawn.push({ kind: K_BUILDING, ref: b.id, index: k, f, sx: top.X - f.ax, sy: top.Y - f.ay, w: f.w, h: f.h });
    }
  }
  R.drawnCount = R.drawn.length;
  return { r, R, main: (r as unknown as { canvas: HTMLCanvasElement }).canvas };
}

const glow = (name: string) => frame(`${name}/g`)!;
// drawImage calls of a source frame (its atlas x, y)
const blits = (f: Frame, where?: (c: Call) => boolean) => calls.filter((c) => c.name === 'drawImage' && c.args[1] === f.x && c.args[2] === f.y && (!where || where(c)));

describe('the pieces\' lights and what stands in front of them', () => {
  it('a lamp with nothing in front: its glow straight onto the city; a lamp behind a tree: on the layer, the tree erasing it', () => {
    const s = createGame({ seed: 5 });
    const { r, main } = scene(s, [
      { piece: 'lamp', x: 10, y: 20 },
      { piece: 'lamp', x: 30, y: 20 },
      { piece: 'tree', x: 11, y: 21 },
    ]);
    (r as unknown as { lightPieces: number[] }).lightPieces = [0, 1, 2];
    (r as unknown as { drawPieceLights(s: GameState, x: number, y: number, img: unknown): void }).drawPieceLights(s, 0, 0, {});
    const g = glow('pc/lamp/0');
    const tree = frame('pc/tree/0')!;
    // the lone lamp: one blit on the city's own canvas
    expect(blits(g, (c) => c.canvas === main)).toHaveLength(1);
    // the lamp behind the tree: drawn on the layer (lighter), the tree drawn after it as an eraser (destination-out)
    const onLayer = blits(g, (c) => c.canvas !== main);
    expect(onLayer).toHaveLength(1);
    expect(onLayer[0].op).toBe('lighter');
    const erase = blits(tree, (c) => c.canvas === onLayer[0].canvas);
    expect(erase).toHaveLength(1);
    expect(erase[0].op).toBe('destination-out');
    expect(calls.indexOf(erase[0])).toBeGreaterThan(calls.indexOf(onLayer[0]));
    // and the layer goes onto the city
    expect(calls.some((c) => c.canvas === main && c.name === 'drawImage' && c.args[0] === onLayer[0].canvas)).toBe(true);
  });

  it('a tree drawn BEHIND a lamp does not erase it (only what is in front cuts a light)', () => {
    const s = createGame({ seed: 5 });
    const { r, main } = scene(s, [
      { piece: 'tree', x: 9, y: 19 },
      { piece: 'lamp', x: 10, y: 20 },
    ]);
    (r as unknown as { lightPieces: number[] }).lightPieces = [0, 1];
    (r as unknown as { drawPieceLights(s: GameState, x: number, y: number, img: unknown): void }).drawPieceLights(s, 0, 0, {});
    expect(blits(glow('pc/lamp/0'), (c) => c.canvas === main)).toHaveLength(1);
    expect(blits(frame('pc/tree/0')!)).toHaveLength(0);
  });

  it('a sign, a facing statue and a pillar behind a tree, a statue or a fountain are cut; the pieces in front keep their own lights', () => {
    const s = createGame({ seed: 5 });
    const { r, main } = scene(s, [
      { piece: 'sign', x: 10, y: 20, rot: 0 },
      { piece: 'statue', x: 20, y: 20, rot: 0 },
      { piece: 'pillar', x: 30, y: 20 },
      { piece: 'tree', x: 11, y: 21 },
      { piece: 'tree', x: 21, y: 21 },
      { piece: 'statue', x: 31, y: 21, rot: 1 },
    ]);
    (r as unknown as { lightPieces: number[] }).lightPieces = [0, 1, 2, 3, 4, 5];
    (r as unknown as { drawPieceLights(s: GameState, x: number, y: number, img: unknown): void }).drawPieceLights(s, 0, 0, {});
    for (const name of ['pc/sign/0/0', 'pc/statue/0', 'pc/pillar/0']) expect(blits(glow(name), (c) => c.canvas === main), name).toHaveLength(0);
    // the statue in front (facing the camera) has its own eyes straight on the city
    expect(blits(glow('pc/statue/1'), (c) => c.canvas === main)).toHaveLength(1);
  });
});

describe('a yard of lamps and fences costs what it did', () => {
  it('a lamp, a fence or a pillar in front of a lamp is too low to reach its light: every lamp drawn straight onto the city', () => {
    const s = createGame({ seed: 5 });
    s.time = Math.floor(s.time / 60) * 60 + 0.78 * 60;
    const items: { piece: keyof typeof CODE; x: number; y: number }[] = [];
    for (let y = 18; y < 24; y++) for (let x = 8; x < 16; x++) items.push({ piece: y % 3 === 0 ? 'pillar' : 'lamp', x, y });
    const { r, main } = scene(s, items);
    const R = r as unknown as { terrainState: GameState; drawLighting(s: GameState, x: number, y: number, img: unknown): void; viewW: number; viewH: number };
    R.terrainState = s;
    R.viewW = 400;
    R.viewH = 300;
    R.drawLighting(s, 0, 0, {});
    const lamps = items.filter((it) => it.piece === 'lamp').length;
    expect(blits(glow('pc/lamp/0'), (c) => c.canvas === main)).toHaveLength(lamps);
    expect(calls.some((c) => c.op === 'destination-out')).toBe(false);
  });
});

describe('a building\'s glow and the pieces in front of it', () => {
  function night(s: GameState) {
    s.time = Math.floor(s.time / 60) * 60 + 0.78 * 60;
  }
  const drawLighting = (r: Renderer, s: GameState) => {
    const R = r as unknown as { terrainState: GameState; drawLighting(s: GameState, x: number, y: number, img: unknown): void; viewW: number; viewH: number };
    R.terrainState = s;
    R.viewW = 400;
    R.viewH = 300;
    R.drawLighting(s, 0, 0, {});
  };

  it('no piece: the glow straight onto the city, as it always was', () => {
    const s = createGame({ seed: 5 });
    night(s);
    const { r, R, main } = scene(s, [{ building: 0 }]);
    drawLighting(r, s);
    const g = frame(`${R.buildingFrameName(s, s.buildings[0])}/g`);
    expect(g, "the HQ has a glow frame").toBeDefined();
    expect(blits(g!, (c) => c.canvas === main)).toHaveLength(1);
    expect(blits(g!, (c) => c.canvas !== main)).toHaveLength(0);
  });

  it('a tree in front of the building: its glow goes through the layer, erased by the tree; a tree behind it does not matter', () => {
    const s = createGame({ seed: 5 });
    night(s);
    const hq = s.buildings[0];
    const { r, R, main } = scene(s, [{ piece: 'tree', x: hq.x - 1, y: hq.y - 1 }, { building: 0 }, { piece: 'tree', x: hq.x + 3, y: hq.y + 3 }]);
    const g = frame(`${R.buildingFrameName(s, hq)}/g`);
    expect(g, 'the HQ has a glow frame').toBeDefined();
    // the front tree's box is moved over the building's glow (where the frame of a tree in front of it would be)
    const d = R.drawn[2];
    d.sx = R.drawn[1].sx + R.drawn[1].w / 2 - d.w / 2;
    d.sy = R.drawn[1].sy + R.drawn[1].h - d.h;
    drawLighting(r, s);
    expect(blits(g!, (c) => c.canvas === main)).toHaveLength(0);
    const onLayer = blits(g!, (c) => c.canvas !== main);
    expect(onLayer).toHaveLength(1);
    const tree = frame('pc/tree/0')!;
    const erase = blits(tree, (c) => c.canvas === onLayer[0].canvas);
    expect(erase).toHaveLength(1);
    expect(erase[0].op).toBe('destination-out');
  });
});
