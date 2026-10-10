// Things that make the city feel alive but are not part of the simulation (never saved, no effect on play):
// citizens walking the old streets, and the scenery around the playable map.
import { MAP_H, MAP_W, T, TILE } from '../../game/defs';
import { idx, inBounds } from '../../game/state';
import type { GameState } from '../../game/state';
import { hash2 } from '../../game/world';

export const isRoadRow = (ty: number) => ty % 11 === 4;
// a canal runs behind the map, two tiles wide (bridges where the old streets cross it)
export const isCanal = (tx: number, ty: number) => (ty === -3 || ty === -4) && !isRoadCol(tx);
export const isRoadCol = (tx: number) => ((tx % 14) + 14) % 14 === 6;

// ---------- citizens ----------

export interface Walker {
  id: number;
  tx: number; // tile being left
  ty: number;
  nx: number; // tile being walked to
  ny: number;
  t: number; // 0..1 between the two
  lane: number; // -1 / +1: which side of the street
  variant: number;
  x: number; // world position (computed)
  y: number;
  dir: number; // 0 sw (+y), 1 se (+x), 2 ne (-y), 3 nw (-x)
}

const SPEED = 0.45; // tiles per second
const MAX_WALKERS = 16;

function walkable(s: GameState, tx: number, ty: number): boolean {
  if (!inBounds(tx, ty)) return false;
  if (!isRoadRow(ty) && !isRoadCol(tx)) return false;
  const i = idx(tx, ty);
  return s.tiles[i] === T.GROUND && s.occ[i] === -1;
}

export class Walkers {
  list: Walker[] = [];
  private nextId = 1;
  private seed = 1;

  update(s: GameState, dt: number, variants: number): void {
    const want = Math.min(MAX_WALKERS, Math.floor(s.pop / 4));
    while (this.list.length > want) this.list.pop();
    if (this.list.length < want) this.spawn(s, variants);
    for (const w of this.list) {
      if (!walkable(s, w.nx, w.ny)) {
        // a building went up on the street: turn back
        const tx = w.tx;
        const ty = w.ty;
        w.tx = w.nx;
        w.ty = w.ny;
        w.nx = tx;
        w.ny = ty;
        w.t = 1 - w.t;
      }
      w.t += dt * SPEED;
      while (w.t >= 1) {
        w.t -= 1;
        this.turn(s, w);
      }
      const dx = w.nx - w.tx;
      const dy = w.ny - w.ty;
      w.dir = dx > 0 ? 1 : dx < 0 ? 3 : dy > 0 ? 0 : 2;
      // walk on the side of the street, not on the centre line
      const px = (w.tx + 0.5 + dx * w.t) * TILE + (dy !== 0 ? w.lane * 4.5 : 0);
      const py = (w.ty + 0.5 + dy * w.t) * TILE + (dx !== 0 ? w.lane * 4.5 : 0);
      w.x = px;
      w.y = py;
    }
  }

  private rand(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  private spawn(s: GameState, variants: number): void {
    // start on a street near the middle of the city
    const hq = s.buildings.find((b) => b.type === 'hq');
    const cx = hq ? hq.x + 1 : MAP_W / 2;
    const cy = hq ? hq.y + 1 : MAP_H / 2;
    for (let tries = 0; tries < 60; tries++) {
      const tx = Math.round(cx + (this.rand() - 0.5) * 30);
      const ty = Math.round(cy + (this.rand() - 0.5) * 20);
      if (!walkable(s, tx, ty)) continue;
      const dirs: [number, number][] = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];
      const open = dirs.filter(([dx, dy]) => walkable(s, tx + dx, ty + dy));
      if (!open.length) continue;
      const [dx, dy] = open[Math.floor(this.rand() * open.length)];
      const id = this.nextId++;
      this.list.push({ id, tx, ty, nx: tx + dx, ny: ty + dy, t: this.rand(), lane: this.rand() < 0.5 ? -1 : 1, variant: Math.floor(hash2(id, 7) * variants), x: 0, y: 0, dir: 0 });
      return;
    }
  }

  private turn(s: GameState, w: Walker): void {
    const dx = w.nx - w.tx;
    const dy = w.ny - w.ty;
    w.tx = w.nx;
    w.ty = w.ny;
    const options: [number, number][] = [];
    const straight = walkable(s, w.tx + dx, w.ty + dy);
    for (const [ox, oy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      if (ox === -dx && oy === -dy) continue;
      if (walkable(s, w.tx + ox, w.ty + oy)) options.push([ox, oy]);
    }
    let next: [number, number];
    if (straight && (options.length === 1 || this.rand() < 0.7)) next = [dx, dy];
    else if (options.length) next = options[Math.floor(this.rand() * options.length)];
    else next = [-dx, -dy];
    w.nx = w.tx + next[0];
    w.ny = w.ty + next[1];
    if (!walkable(s, w.nx, w.ny)) {
      w.nx = w.tx;
      w.ny = w.ty;
    }
  }
}

// ---------- scenery around the map ----------

export interface DecorMeta {
  w: number;
  d: number;
  frames: number;
  fps: number;
  tall: boolean;
}

export interface SceneryItem {
  name: string;
  tx: number;
  ty: number;
  w: number;
  d: number;
  frames: number;
  fps: number;
  back: boolean; // entirely behind the map on one axis: drawn before everything on the map
}

// Deterministic per city: the same seed always gives the same surroundings.
export function placeScenery(seed: number, ring: number, meta: Record<string, DecorMeta>): { items: SceneryItem[]; taken: Set<number> } {
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
          // keep the first row in front of the map clear, so nothing hides the city's edge
          if (x >= MAP_W && x === MAP_W && y >= 0) fits = false;
          if (y >= MAP_H && y === MAP_H && x >= 0) fits = false;
        }
      if (!fits) continue;
      // tall scenery only where it is behind the whole map on an axis
      const isBack = tx + m.w <= 0 || ty + m.d <= 0;
      if (m.tall && !isBack) continue;
      for (let y = ty; y < ty + m.d; y++) for (let x = tx; x < tx + m.w; x++) taken.add(key(x, y));
      items.push({ name, tx, ty, w: m.w, d: m.d, frames: m.frames, fps: m.fps, back: isBack });
    }
  items.sort((a, b) => a.tx + a.w + a.ty + a.d - (b.tx + b.w + b.ty + b.d));
  return { items, taken };
}

export function ringKey(x: number, y: number, ring: number): number {
  return (y + ring) * (MAP_W + 2 * ring) + (x + ring);
}
