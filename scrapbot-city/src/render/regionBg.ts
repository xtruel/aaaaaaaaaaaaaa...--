// Pixel-art map of the Scrap Coast: islands around each city, roads, sea, little details per city.
import { CITIES, ROADS } from '../game/cities';
import type { CityId } from '../game/cities';
import { hash2, mulberry32 } from '../game/world';
import { PAL, makeCanvas } from './sprites';

const BASE_H = 180;

const LAND: Record<CityId, { land: string; dark: string }> = {
  home: { land: '#7cbf55', dark: '#5a9a3d' },
  rustbay: { land: '#d0aa6c', dark: '#a8824c' },
  neon: { land: '#8d72d6', dark: '#6b52b4' },
  greenvale: { land: '#4fbf5a', dark: '#36953f' },
  company: { land: '#9592a3', dark: '#76738a' },
};

export function paintRegion(canvas: HTMLCanvasElement, width: number, height: number, t: number): void {
  const h = BASE_H;
  const w = Math.max(200, Math.round((BASE_H * width) / Math.max(1, height)));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(staticLayer(w, h), 0, 0);

  // drifting wave sparkles
  const rng = mulberry32(99);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (let k = 0; k < 40; k++) {
    const x = Math.floor((rng() * w + t * (2 + rng() * 3)) % w);
    const y = Math.floor(rng() * h);
    if (landAt(w, h, x, y)) continue;
    if (Math.floor(t * 2 + k) % 3 === 0) ctx.fillRect(x, y, 3, 1);
  }
  // cargo blimp travelling between cities
  const route = ROADS[Math.floor(t / 8) % ROADS.length];
  const a = CITIES.find((c) => c.id === route[0])!;
  const b = CITIES.find((c) => c.id === route[1])!;
  const p = (t % 8) / 8;
  const bx = Math.round(((a.map.x + (b.map.x - a.map.x) * p) / 100) * w);
  const by = Math.round(((a.map.y + (b.map.y - a.map.y) * p) / 100) * h) - 14;
  ctx.fillStyle = 'rgba(18,11,41,0.35)';
  ctx.fillRect(bx - 5, by + 16, 10, 2);
  ctx.fillStyle = PAL.ink;
  ctx.fillRect(bx - 7, by - 1, 15, 7);
  ctx.fillStyle = PAL.white;
  ctx.fillRect(bx - 6, by, 13, 5);
  ctx.fillStyle = PAL.pink;
  ctx.fillRect(bx - 6, by, 13, 1);
  ctx.fillRect(bx - 6, by + 4, 13, 1);
  ctx.fillStyle = PAL.purpleD;
  ctx.fillRect(bx - 2, by + 6, 5, 2);
}

let cache: { w: number; h: number; canvas: HTMLCanvasElement } | null = null;

function nearestCity(w: number, h: number, x: number, y: number): { id: CityId; d: number } {
  let best: CityId = 'home';
  let bestD = Infinity;
  for (const c of CITIES) {
    const dx = (x - (c.map.x / 100) * w) / h;
    const dy = (y - (c.map.y / 100) * h) / h;
    const d = Math.hypot(dx * 0.9, dy);
    if (d < bestD) {
      bestD = d;
      best = c.id;
    }
  }
  return { id: best, d: bestD };
}

function landAt(w: number, h: number, x: number, y: number): boolean {
  const { d } = nearestCity(w, h, x, y);
  const wobble = (hash2(Math.floor(x / 6), Math.floor(y / 6), 3) - 0.5) * 0.08;
  // islands around every city, plus land bridges along the roads
  if (d < 0.2 + wobble) return true;
  for (const [ia, ib] of ROADS) {
    const a = CITIES.find((c) => c.id === ia)!;
    const b = CITIES.find((c) => c.id === ib)!;
    const ax = (a.map.x / 100) * w;
    const ay = (a.map.y / 100) * h;
    const bx = (b.map.x / 100) * w;
    const by = (b.map.y / 100) * h;
    const l2 = (bx - ax) ** 2 + (by - ay) ** 2;
    const tt = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / l2));
    const dist = Math.hypot(x - (ax + tt * (bx - ax)), y - (ay + tt * (by - ay))) / h;
    if (dist < 0.05 + wobble * 0.5) return true;
  }
  return false;
}

function staticLayer(w: number, h: number): HTMLCanvasElement {
  if (cache && cache.w === w && cache.h === h) return cache.canvas;
  const [c, ctx] = makeCanvas(w, h);
  const p = (x: number, y: number, ww: number, hh: number, col: string) => {
    ctx.fillStyle = col;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(ww), Math.round(hh));
  };
  const land = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) land[y * w + x] = landAt(w, h, x, y) ? 1 : 0;
  const isLand = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && land[y * w + x] === 1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (isLand(x, y)) {
        const { id } = nearestCity(w, h, x, y);
        const shore = !isLand(x - 1, y) || !isLand(x + 1, y) || !isLand(x, y - 1) || !isLand(x, y + 1);
        const nearShore = !isLand(x - 2, y) || !isLand(x + 2, y) || !isLand(x, y - 2) || !isLand(x, y + 2);
        const n = hash2(x, y, 5);
        p(x, y, 1, 1, shore ? PAL.ink : nearShore ? '#f2d48a' : n > 0.86 ? LAND[id].dark : LAND[id].land);
      } else {
        // sea: deeper further from land, with a dithered shallow band
        let near = false;
        for (let k = 3; k <= 6 && !near; k += 3) near = isLand(x - k, y) || isLand(x + k, y) || isLand(x, y - k) || isLand(x, y + k);
        const deep = (x + y) % 2 === 0 ? '#2a63c9' : '#2d68cf';
        p(x, y, 1, 1, near ? ((x + y) % 2 === 0 ? '#4b8de6' : '#3f80dd') : deep);
      }
    }
  }

  // roads
  for (const [ia, ib] of ROADS) {
    const a = CITIES.find((cc) => cc.id === ia)!;
    const b = CITIES.find((cc) => cc.id === ib)!;
    const ax = (a.map.x / 100) * w;
    const ay = (a.map.y / 100) * h;
    const bx = (b.map.x / 100) * w;
    const by = (b.map.y / 100) * h;
    const steps = Math.ceil(Math.hypot(bx - ax, by - ay));
    for (let k = 0; k < steps; k++) {
      const x = ax + ((bx - ax) * k) / steps;
      const y = ay + ((by - ay) * k) / steps;
      p(x - 1, y - 1, 3, 3, '#3a3150');
      if (Math.floor(k / 3) % 2 === 0) p(x, y, 1, 1, PAL.yellow);
    }
  }

  // little details around each city
  const rng = mulberry32(2026);
  for (let k = 0; k < 260; k++) {
    const x = Math.floor(rng() * w);
    const y = Math.floor(rng() * h);
    if (!isLand(x, y) || !isLand(x + 3, y + 3) || !isLand(x - 2, y)) continue;
    const { id, d } = nearestCity(w, h, x, y);
    if (d < 0.07) continue;
    switch (id) {
      case 'greenvale':
      case 'home':
        p(x, y + 2, 1, 2, '#5b3a22');
        p(x - 1, y - 1, 3, 3, id === 'home' ? '#3f8a3a' : '#2f7a36');
        break;
      case 'rustbay':
        p(x, y, 3, 2, PAL.rust);
        p(x + 1, y - 1, 1, 1, PAL.steelL);
        break;
      case 'neon':
        p(x, y - 3, 2, 5, '#4a3790');
        p(x, y - 3, 1, 1, rng() > 0.5 ? PAL.pink : PAL.cyan);
        break;
      case 'company':
        p(x, y - 4, 2, 6, '#55525f');
        p(x - 1, y - 6, 3, 2, 'rgba(120,110,110,0.7)');
        break;
    }
  }
  // shipwrecks off Rustbay
  for (let k = 0; k < 5; k++) {
    const x = Math.floor(((38 + k * 3.5) / 100) * w);
    const y = Math.floor(0.93 * h) - (k % 2) * 4;
    if (isLand(x, y)) continue;
    p(x, y, 6, 2, PAL.rustD);
    p(x + 2, y - 3, 1, 3, PAL.steelL);
  }

  cache = { w, h, canvas: c };
  return c;
}
