// Isometric projection and draw order: the math the renderer, the mouse and the controller rely on.
import { describe, expect, it } from 'vitest';
import { TILE } from '../src/game/defs';
import { groundAt, isoX, isoY, tileAt, tileCenter, tileTop, diamondHalfWidth } from '../src/render/iso/projection';
import { DepthSorter, compareDepth } from '../src/render/iso/depth';
import type { DepthItem } from '../src/render/iso/depth';

describe('projection', () => {
  it('round-trips ground points', () => {
    for (let k = 0; k < 500; k++) {
      const x = ((k * 37) % 900) + 0.25;
      const y = ((k * 53) % 580) + 0.75;
      const g = groundAt(isoX(x, y), isoY(x, y));
      expect(g.x).toBeCloseTo(x, 9);
      expect(g.y).toBeCloseTo(y, 9);
    }
  });

  it('a tile is a 32x16 diamond with its top vertex at tileTop', () => {
    const top = tileTop(3, 5);
    expect(top).toEqual({ X: (3 - 5) * TILE, Y: ((3 + 5) * TILE) / 2 });
    const c = tileCenter(3, 5);
    expect(c.Y - top.Y).toBe(TILE / 2);
    // the four vertices
    expect(tileTop(4, 5).X - top.X).toBe(TILE);
    expect(tileTop(3, 6).X - top.X).toBe(-TILE);
    expect(tileTop(4, 6).Y - top.Y).toBe(TILE);
  });

  it('finds the right tile for every pixel centre, at every zoom', () => {
    // each pixel centre of every tile diamond maps back to that tile; the diamonds tile the plane exactly
    for (const [tx, ty] of [
      [0, 0],
      [7, 3],
      [55, 35],
      [20, 30],
    ]) {
      const top = tileTop(tx, ty);
      let pixels = 0;
      for (let row = 0; row < 16; row++) {
        const half = diamondHalfWidth(row);
        for (let px = 16 - half; px < 16 + half; px++) {
          const X = top.X - 16 + px + 0.5;
          const Y = top.Y + row + 0.5;
          expect(tileAt(X, Y)).toEqual({ x: tx, y: ty });
          pixels++;
        }
      }
      expect(pixels).toBe(256); // 32x16 / 2: no gaps, no overlaps
    }
    // a screen point at any zoom: screen = (iso - cam) * zoom, so iso = cam + screen / zoom
    for (const zoom of [1, 2, 3, 4, 5]) {
      const cam = { x: -123.4, y: 77.7 };
      for (let tx = 0; tx < 56; tx += 5)
        for (let ty = 0; ty < 36; ty += 5) {
          const c = tileCenter(tx, ty);
          const sx = (c.X - cam.x) * zoom;
          const sy = (c.Y - cam.y) * zoom;
          expect(tileAt(cam.x + sx / zoom, cam.y + sy / zoom)).toEqual({ x: tx, y: ty });
        }
    }
  });

  it('diamond rows widen by 4 px to 30 px and narrow again', () => {
    const widths = Array.from({ length: 16 }, (_, r) => diamondHalfWidth(r) * 2);
    expect(widths).toEqual([2, 6, 10, 14, 18, 22, 26, 30, 30, 26, 22, 18, 14, 10, 6, 2]);
  });
});

function box(x0: number, y0: number, x1: number, y1: number, z0: number, z1: number, ref: number): DepthItem {
  // screen rectangle from the projected corners
  const xs = [isoX(x0, y1), isoX(x1, y0)];
  const ys = [isoY(x0, y0, z1), isoY(x1, y1, z0)];
  return { x0, x1, y0, y1, z0, z1, sx0: xs[0], sx1: xs[1], sy0: ys[0], sy1: ys[1], kind: 0, ref, mark: 0 };
}

function sortAll(items: DepthItem[]): number[] {
  const sorter = new DepthSorter();
  sorter.begin();
  for (const it of items) Object.assign(sorter.add(), it);
  const out: DepthItem[] = [];
  const n = sorter.sort(out);
  return out.slice(0, n).map((i) => i.ref);
}

describe('depth sorting', () => {
  it('draws a big building behind a small one in front of its edge (where x + y sorting fails)', () => {
    const T = TILE;
    // HQ 3x3 at (0,0); garden 1x1 at (3,0): the garden is in front on the x axis
    const hq = box(0, 0, 3 * T, 3 * T, 0, 57, 1);
    const garden = box(3 * T, 0, 4 * T, T, 0, 12, 2);
    expect(compareDepth(hq, garden)).toBe(1);
    expect(sortAll([garden, hq])).toEqual([1, 2]);
    // the naive key (far corner x + y) would put the garden first
    expect(3 * T + 3 * T > 4 * T + T).toBe(true);
  });

  it('a bot flying above a roof is drawn after the building, a bot behind it before', () => {
    const T = TILE;
    const b = box(2 * T, 2 * T, 4 * T, 4 * T, 0, 30, 1);
    const above = box(2.5 * T, 2.5 * T, 2.5 * T + 8, 2.5 * T + 8, 36, 50, 2);
    const behind = box(1 * T, 2.5 * T, 1 * T + 8, 2.5 * T + 8, 10, 24, 3);
    expect(sortAll([above, b, behind])).toEqual([3, 1, 2]);
  });

  it('handles many items without losing any', () => {
    const items: DepthItem[] = [];
    for (let k = 0; k < 300; k++) {
      const x = (k % 20) * TILE;
      const y = Math.floor(k / 20) * TILE;
      items.push(box(x, y, x + TILE - 1, y + TILE - 1, 0, 10 + (k % 7), k));
    }
    const order = sortAll(items);
    expect(order.length).toBe(300);
    expect(new Set(order).size).toBe(300);
    // every pair that shares an edge is ordered back to front
    const pos = new Map(order.map((r, i) => [r, i]));
    for (let k = 0; k < 300; k++) {
      if (k % 20 < 19) expect(pos.get(k)!).toBeLessThan(pos.get(k + 1)!);
      if (k + 20 < 300) expect(pos.get(k)!).toBeLessThan(pos.get(k + 20)!);
    }
  });
});
