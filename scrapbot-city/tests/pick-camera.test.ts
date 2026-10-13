// @vitest-environment jsdom
// The map is drawn with the camera on whole art pixels (Renderer.render rounds it); a right-button pan leaves the
// camera between two art pixels (it moves by screen px / zoom). What a press picks (a piece, a building) and the tile
// under the pointer are read with the camera as drawn, so the outer art pixel of a sprite takes the press that lands on
// it. jsdom has no canvas: the renderer runs on a context that draws nothing, with one sprite placed as drawn.
import { beforeAll, describe, expect, it } from 'vitest';
import { tileAt } from '../src/render/iso/projection';
import { Renderer } from '../src/render/renderer';

beforeAll(() => {
  const ctx = new Proxy({} as Record<string, unknown>, { get: (t, k: string) => (k in t ? t[k] : () => undefined), set: (t, k: string, v) => ((t[k] = v), true) });
  HTMLCanvasElement.prototype.getContext = (() => ctx) as unknown as HTMLCanvasElement['getContext'];
});

const K_PIECE = 7;

describe('picking with the camera between two art pixels', () => {
  it('a piece takes a press on every art pixel drawn for it, at zoom 4 and 5, wherever the pan left the camera', () => {
    for (const zoom of [4, 5]) {
      for (const frac of [0, 0.25, 0.5, 0.75, 0.9]) {
        const r = new Renderer(document.createElement('canvas'));
        r.zoom = zoom;
        r.resize();
        const R = r as unknown as { drawn: unknown[]; drawnCount: number };
        // a 6x8 art-pixel sprite (no transparent pixels) at iso pixel (200, 300), piece on tile index 1234
        R.drawn = [{ kind: K_PIECE, ref: 1234, index: 0, f: null, sx: 200, sy: 300, w: 6, h: 8 }];
        R.drawnCount = 1;
        r.cam.x = 100 + frac;
        r.cam.y = 50 + frac;
        const z = r.pxZoom;
        // where render puts the sprite: the camera rounded to whole art pixels
        const left = (200 - Math.round(r.cam.x)) * z;
        const top = (300 - Math.round(r.cam.y)) * z;
        const at = `zoom ${zoom}, camera +${frac}`;
        // the drawn sprite's first and last screen pixels, both ways: the piece
        for (const [x, y] of [
          [left, top],
          [left + 6 * z - 1, top + 8 * z - 1],
          [left, top + 8 * z - 1],
        ])
          expect(r.pickPiece(x + 0.5, y + 0.5), `${at} at ${x},${y}`).toBe(1234);
        // just outside it: nothing
        expect(r.pickPiece(left - 0.5, top + 0.5), at).toBe(-1);
        expect(r.pickPiece(left + 6 * z + 0.5, top + 0.5), at).toBe(-1);
        // the tile under a point is the one drawn there (its ground at the rounded camera), and back again
        const sx = 333.5;
        const sy = 222.5;
        expect(r.screenToTile(sx, sy), at).toEqual(tileAt(Math.round(r.cam.x) + sx / z, Math.round(r.cam.y) + sy / z));
        const t = r.screenToTile(sx, sy);
        const c = r.tileToScreen(t.x, t.y);
        expect(r.screenToTile(c.x, c.y), at).toEqual(t);
      }
    }
  });
});
