// The generated atlas: every building has all its frames, animations really move, and "off" looks different
// from "working". Reads src/assets/iso/atlas.png + atlas.json exactly as the game does.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '../src/game/defs';
import type { BuildingType } from '../src/game/defs';
import { decodePNG } from '../scripts/art/png';

const meta = JSON.parse(readFileSync(new URL('../src/assets/iso/atlas.json', import.meta.url), 'utf8')) as {
  w: number;
  h: number;
  frames: Record<string, [number, number, number, number, number, number]>;
  buildings: Record<BuildingType, { frames: number; fps: number; height: number }>;
};
const atlas = decodePNG(new Uint8Array(readFileSync(new URL('../src/assets/iso/atlas.png', import.meta.url))));
const TYPES = Object.keys(BUILDINGS) as BuildingType[];

function pixels(name: string): { w: number; h: number; px: Uint8ClampedArray } {
  const f = meta.frames[name];
  if (!f) throw new Error(`missing frame ${name}`);
  const [x, y, w, h] = f;
  const px = new Uint8ClampedArray(w * h * 4);
  for (let r = 0; r < h; r++) px.set(atlas.data.subarray(((y + r) * atlas.w + x) * 4, ((y + r) * atlas.w + x + w) * 4), r * w * 4);
  return { w, h, px };
}

// share of the sprite's visible pixels that differ between two frames of the same size
function difference(a: string, b: string): number {
  const A = pixels(a);
  const B = pixels(b);
  if (A.w !== B.w || A.h !== B.h) return 1;
  let changed = 0;
  let visible = 0;
  for (let i = 0; i < A.px.length; i += 4) {
    const va = A.px[i + 3] > 0;
    const vb = B.px[i + 3] > 0;
    if (va || vb) visible++;
    if (va !== vb || Math.abs(A.px[i] - B.px[i]) + Math.abs(A.px[i + 1] - B.px[i + 1]) + Math.abs(A.px[i + 2] - B.px[i + 2]) > 24) changed++;
  }
  return changed / Math.max(1, visible);
}

describe('building sprites', () => {
  it('every building has its working frames, off frame, 4 construction stages, shadow and icon', () => {
    for (const type of TYPES) {
      const m = meta.buildings[type];
      expect(m, type).toBeTruthy();
      for (let f = 0; f < m.frames; f++) expect(meta.frames[`b/${type}/w${f}`], `${type} w${f}`).toBeTruthy();
      for (const extra of ['off', 'c0', 'c1', 'c2', 'c3', 'shadow', 'icon']) expect(meta.frames[`b/${type}/${extra}`], `${type} ${extra}`).toBeTruthy();
    }
  });

  it('anchors sit inside their frames', () => {
    for (const [name, [, , w, h, ax, ay]] of Object.entries(meta.frames)) {
      if (name.startsWith('t/edge')) continue; // slab sides hang below their tile on purpose
      expect(ax >= -1 && ax <= w + 1 && ay >= -1 && ay <= h + 40, name).toBe(true);
    }
  });

  it('animated buildings change visibly from frame to frame', () => {
    const report: string[] = [];
    for (const type of TYPES) {
      const m = meta.buildings[type];
      if (m.frames < 2) continue;
      for (let f = 0; f < m.frames; f++) {
        const d = difference(`b/${type}/w${f}`, `b/${type}/w${(f + 1) % m.frames}`);
        report.push(`${type} w${f}->w${(f + 1) % m.frames}: ${(d * 100).toFixed(1)}%`);
        expect(d, `${type} frame ${f} vs ${(f + 1) % m.frames}`).toBeGreaterThan(0.004);
      }
    }
    console.log(report.join('\n'));
  });

  it('a building that is off (no power, paused, no input) looks different from one at work', () => {
    for (const type of TYPES) {
      const d = difference(`b/${type}/off`, `b/${type}/w0`);
      expect(d, type).toBeGreaterThan(0.002);
    }
  });

  it('construction stages grow', () => {
    for (const type of TYPES) {
      const opaque = (n: string) => {
        const p = pixels(n);
        let k = 0;
        for (let i = 3; i < p.px.length; i += 4) if (p.px[i] > 0) k++;
        return k;
      };
      expect(opaque(`b/${type}/c3`), type).toBeGreaterThan(opaque(`b/${type}/c0`));
    }
  });
});

describe('characters and terrain', () => {
  it('bots exist in 4 directions for flying, carrying and working, and their frames differ', () => {
    for (const dir of ['sw', 'se', 'ne', 'nw'])
      for (const pose of ['fly', 'carry', 'work']) {
        expect(meta.frames[`bot/${dir}/${pose}/0`]).toBeTruthy();
        expect(difference(`bot/${dir}/${pose}/0`, `bot/${dir}/${pose}/1`), `${dir} ${pose}`).toBeGreaterThan(0.01);
      }
  });

  it('every terrain tile the renderer asks for exists', () => {
    const need = ['t/road/x', 't/road/y', 't/road/c', 't/edge/l/0', 't/edge/r/0', 'p/lamp/x', 'p/lamp/y'];
    for (let k = 0; k < 4; k++) need.push(`t/pave/${k}`, `t/lot/${k}`, `t/ind/${k}`, `t/mud/${k}`, `t/dirty/${k}`, `t/outer/${k}`, `p/rubble/${k}`);
    for (let m = 0; m < 16; m++) need.push(`t/sludge/${m}/0`, `t/water/${m}`);
    for (let fam = 0; fam < 3; fam++) for (let k = 0; k < 4; k++) need.push(`t/ground/${fam}/${k}`);
    for (let k = 0; k < 6; k++) need.push(`t/grass/${k}`);
    for (let size = 0; size < 3; size++) for (let k = 0; k < 4; k++) need.push(`p/junk/${size}/${k}`);
    for (const n of need) expect(meta.frames[n], n).toBeTruthy();
  });

  it('street lamps light up at night (their lens is visible, so they have a glow frame)', () => {
    for (const axis of ['x', 'y']) expect(meta.frames[`p/lamp/${axis}/g`], axis).toBeTruthy();
  });
});
