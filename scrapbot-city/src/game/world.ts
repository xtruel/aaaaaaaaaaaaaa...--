import { MAP_H, MAP_W, T } from './defs';

export type Rng = () => number;

// Small, fast seeded PRNG so a seed always produces the same city.
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash2(x: number, y: number, salt = 0): number {
  let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export interface GeneratedMap {
  tiles: Uint8Array;
  amount: Uint16Array;
  hq: { x: number; y: number };
}

export function generateMap(seed: number): GeneratedMap {
  const rng = mulberry32(seed);
  const tiles = new Uint8Array(MAP_W * MAP_H);
  const amount = new Uint16Array(MAP_W * MAP_H);
  const hq = { x: Math.floor(MAP_W / 2) - 1, y: Math.floor(MAP_H / 2) - 1 };
  const hcx = hq.x + 1.5;
  const hcy = hq.y + 1.5;
  const distHq = (x: number, y: number) => Math.hypot(x + 0.5 - hcx, y + 0.5 - hcy);
  const set = (x: number, y: number, kind: number, amt = 0) => {
    if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return;
    tiles[y * MAP_W + x] = kind;
    amount[y * MAP_W + x] = amt;
  };

  // Grass survives in a few corners of the map.
  for (let i = 0; i < 5; i++) {
    const cx = rng() < 0.5 ? Math.floor(rng() * 10) : MAP_W - 1 - Math.floor(rng() * 10);
    const cy = Math.floor(rng() * MAP_H);
    const r = 2 + rng() * 3;
    for (let y = Math.floor(cy - r); y <= cy + r; y++) {
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        if (Math.hypot(x - cx, y - cy) < r * (0.6 + hash2(x, y, seed) * 0.5)) set(x, y, T.GRASS);
      }
    }
  }

  // Landfills: blobs of junk, richer towards their centre.
  for (let i = 0; i < 13; i++) {
    const cx = Math.floor(rng() * MAP_W);
    const cy = Math.floor(rng() * MAP_H);
    if (distHq(cx, cy) < 8) continue;
    const r = 2 + rng() * 3.5;
    for (let y = Math.floor(cy - r); y <= cy + r; y++) {
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d < r * (0.45 + rng() * 0.6)) set(x, y, T.JUNK, Math.round(10 + (1 - d / r) * 28 + rng() * 8));
      }
    }
  }

  // Loose junk everywhere.
  for (let i = 0; i < 45; i++) {
    const x = Math.floor(rng() * MAP_W);
    const y = Math.floor(rng() * MAP_H);
    if (distHq(x, y) > 5) set(x, y, T.JUNK, 8 + Math.floor(rng() * 14));
  }

  // Rubble: concrete chunks that must be bulldozed.
  for (let i = 0; i < 22; i++) {
    const cx = Math.floor(rng() * MAP_W);
    const cy = Math.floor(rng() * MAP_H);
    if (distHq(cx, cy) < 7) continue;
    const n = 1 + Math.floor(rng() * 4);
    for (let k = 0; k < n; k++) set(cx + Math.floor(rng() * 3) - 1, cy + Math.floor(rng() * 3) - 1, T.RUBBLE);
  }

  // Toxic sludge pools, far from the HQ.
  for (let i = 0; i < 3; i++) {
    let x = 0;
    let y = 0;
    for (let tries = 0; tries < 30; tries++) {
      x = 3 + Math.floor(rng() * (MAP_W - 6));
      y = 3 + Math.floor(rng() * (MAP_H - 6));
      if (distHq(x, y) > 11) break;
    }
    const len = 6 + Math.floor(rng() * 5);
    for (let k = 0; k < len; k++) {
      set(x, y, T.SLUDGE);
      x = Math.max(1, Math.min(MAP_W - 2, x + Math.floor(rng() * 3) - 1));
      y = Math.max(1, Math.min(MAP_H - 2, y + Math.floor(rng() * 3) - 1));
    }
  }

  // Clear the HQ yard, then drop a ring of starter junk so bots get busy right away.
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (distHq(x, y) < 4.5) set(x, y, T.GROUND);
    }
  }
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rng() * 0.4;
    const r = 5.5 + rng() * 2;
    set(Math.floor(hcx + Math.cos(a) * r), Math.floor(hcy + Math.sin(a) * r), T.JUNK, 10 + Math.floor(rng() * 10));
  }

  return { tiles, amount, hq };
}
