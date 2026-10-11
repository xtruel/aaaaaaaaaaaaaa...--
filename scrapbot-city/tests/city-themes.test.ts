// City themes in the renderer (0.7, increment 2): which city gets which look, and the border scenery around it.
// Scrapbot City and free play must keep exactly the scenery they had before themes.
import { describe, expect, it } from 'vitest';
import { CITIES } from '../src/game/cities';
import { MAP_H, MAP_W } from '../src/game/defs';
import { hash2 } from '../src/game/world';
import { cityTheme, decorArt, hasFrame, themeArt } from '../src/render/iso/atlas';
import { isCanal, isRoadCol, isRoadRow, placeScenery } from '../src/render/iso/life';
import type { DecorMeta, SceneryItem } from '../src/render/iso/life';

const RING = 6; // renderer.ts

// placeScenery as it was in 0.7.0-alpha.1 (commit 704adc3), the reference for the cities without a theme
function placeSceneryBefore(seed: number, ring: number, meta: Record<string, DecorMeta>) {
  const names = Object.keys(meta).sort();
  const items: SceneryItem[] = [];
  const taken = new Set<number>();
  if (!names.length) return { items, taken };
  const key = (x: number, y: number) => (y + ring) * (MAP_W + 2 * ring) + (x + ring);
  const low = names.filter((n) => !meta[n].tall);
  const salt = (seed % 9973) + 101;
  const inRing = (x: number, y: number) => x >= -ring && y >= -ring && x < MAP_W + ring && y < MAP_H + ring && !(x >= 0 && y >= 0 && x < MAP_W && y < MAP_H);
  for (let ty = -ring; ty < MAP_H + ring; ty++)
    for (let tx = -ring; tx < MAP_W + ring; tx++) {
      if (!inRing(tx, ty)) continue;
      const h = hash2(tx, ty, salt);
      const back = tx < 0 || ty < 0;
      if (h > (back ? 0.2 : 0.11)) continue;
      const pool = back ? names : low;
      if (!pool.length) continue;
      const name = pool[Math.floor(hash2(tx, ty, salt + 1) * pool.length)];
      const m = meta[name];
      let fits = true;
      for (let y = ty; y < ty + m.d && fits; y++)
        for (let x = tx; x < tx + m.w && fits; x++) {
          if (!inRing(x, y) || taken.has(key(x, y)) || isRoadRow(y) || isRoadCol(x) || isCanal(x, y)) fits = false;
          if (x >= MAP_W && x === MAP_W && y >= 0) fits = false;
          if (y >= MAP_H && y === MAP_H && x >= 0) fits = false;
        }
      if (!fits) continue;
      const isBack = tx + m.w <= 0 || ty + m.d <= 0;
      if (m.tall && !isBack) continue;
      for (let y = ty; y < ty + m.d; y++) for (let x = tx; x < tx + m.w; x++) taken.add(key(x, y));
      const frameNames = Array.from({ length: Math.max(1, m.frames) }, (_, k) => `d/${name}/${k}`);
      items.push({ name, tx, ty, w: m.w, d: m.d, frames: m.frames, fps: m.fps, back: isBack, names: frameNames, glows: frameNames.map((n) => `${n}/g`) });
    }
  items.sort((a, b) => a.tx + a.w + a.ty + a.d - (b.tx + b.w + b.ty + b.d));
  return { items, taken };
}

const themed = (theme: string) => ({ id: theme, scenery: themeArt[theme].scenery, decor: themeArt[theme].decor });

describe('city themes in the renderer', () => {
  it('each campaign city but Scrapbot City has its theme; free play and the tutorial have none', () => {
    expect(Object.fromEntries(CITIES.map((c) => [c.id, cityTheme(c.id)]))).toEqual({ home: null, rustbay: 'rust', neon: 'neon', greenvale: 'green', company: 'corp' });
    expect(cityTheme(null)).toBeNull();
    expect(cityTheme(undefined)).toBeNull();
    expect(cityTheme('atlantis')).toBeNull();
    expect(cityTheme('constructor')).toBeNull();
    expect(cityTheme('toString')).toBeNull();
  });

  it('a city without a theme gets exactly the scenery it had before themes', () => {
    for (const seed of [2026, 4242, 0, 1, 7781, 123456, 999999]) {
      const now = placeScenery(seed, RING, decorArt);
      const before = placeSceneryBefore(seed, RING, decorArt);
      expect(now.items, `seed ${seed}`).toEqual(before.items);
      expect([...now.taken].sort((a, b) => a - b), `seed ${seed}`).toEqual([...before.taken].sort((a, b) => a - b));
      expect(placeScenery(seed, RING, decorArt, null).items).toEqual(before.items);
    }
  });

  it("a themed city's ring: its signature pieces (2 of each at least) and its own decor, every frame in the atlas", () => {
    for (const city of CITIES) {
      const theme = cityTheme(city.id);
      if (!theme) continue;
      const { items } = placeScenery(city.seed, RING, decorArt, themed(theme));
      const t = themeArt[theme];
      for (const name of Object.keys(t.scenery)) expect(items.filter((d) => d.names[0] === `sc/${theme}/${name}/0`).length, `${theme} ${name}`).toBeGreaterThanOrEqual(2);
      for (const d of items) {
        const sig = d.names[0].startsWith(`sc/${theme}/`);
        expect(sig ? Object.keys(t.scenery) : t.decor, `${theme}: ${d.names[0]}`).toContain(d.name);
        if (!sig) expect(d.names[0]).toBe(`d/${d.name}/0`);
        expect(d.names.length).toBe(Math.max(1, d.frames));
        for (const n of d.names) expect(hasFrame(n), n).toBe(true);
      }
      // the same city always gets the same ring
      expect(placeScenery(city.seed, RING, decorArt, themed(theme)).items).toEqual(items);
    }
  });

  it('themed scenery keeps off the map, the streets, the canal and the first row in front; tall pieces only behind', () => {
    for (const city of CITIES) {
      const theme = cityTheme(city.id);
      if (!theme) continue;
      const { items, taken } = placeScenery(city.seed, RING, decorArt, themed(theme));
      const seen = new Set<string>();
      let cells = 0;
      for (const d of items) {
        const meta = d.names[0].startsWith('sc/') ? themeArt[theme].scenery[d.name] : decorArt[d.name];
        for (let y = d.ty; y < d.ty + d.d; y++)
          for (let x = d.tx; x < d.tx + d.w; x++) {
            const at = `${theme} ${d.name} at ${x},${y}`;
            expect(x >= 0 && y >= 0 && x < MAP_W && y < MAP_H, at).toBe(false);
            expect(x >= -RING && y >= -RING && x < MAP_W + RING && y < MAP_H + RING, at).toBe(true);
            expect(isRoadRow(y) || isRoadCol(x) || isCanal(x, y), at).toBe(false);
            expect((x === MAP_W && y >= 0) || (y === MAP_H && x >= 0), at).toBe(false);
            expect(seen.has(`${x},${y}`), `${at} overlaps`).toBe(false);
            seen.add(`${x},${y}`);
            cells++;
          }
        if (meta.tall) expect(d.tx + d.w <= 0 || d.ty + d.d <= 0, `${theme} ${d.name} (tall) at ${d.tx},${d.ty}`).toBe(true);
        expect(d.back).toBe(d.tx + d.w <= 0 || d.ty + d.d <= 0);
      }
      expect(taken.size).toBe(cells);
    }
  });
});
