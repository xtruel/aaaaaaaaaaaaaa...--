// City themes (0.7, increment 2): the ground of the four campaign cities after Scrapbot City.
// Every terrain family the renderer's terrain cache paints has a themed twin, same size and anchor:
//   t/<theme>/<family>/<rest>  mirrors  t/<family>/<rest>
// for ground, grass, road, pave, lot, ind, mud, dirty, water, outer and edge. The gameplay tiles that must read
// the same in every city keep their shared frames (t/sludge, p/junk, p/rubble), and so do the player's floors and
// bases (t/floor, t/base) and the street lamps (p/lamp). Scrapbot City ('home') has no theme: it keeps t/... as is.
//   rust   Rustbay            rusty sand, corroded steel plates, a grey-green storm sea in the canal
//   neon   Neon Heights       dark wet asphalt with neon reflections in the puddles, pink lane lines
//   green  Greenvale          rich soil with sprouts, lush dense grass, brick squares, a clear river with grassy banks
//   corp   2PM Company Town   clean grey concrete with painted bay lines, a mown lawn, a concrete-lined channel
// Like terrain.ts, the tiles are painted in world space on the 32×16 diamond (no voxel materials involved).
import { createImage } from '../png';
import type { Image } from '../png';
import { hex } from '../voxel';
import type { RGB } from '../voxel';
import { hash } from './common';
import { EDGE_DEPTH, tile } from './terrain';
import type { Shader } from './terrain';

export const THEMES = ['rust', 'neon', 'green', 'corp'] as const;
export type Theme = (typeof THEMES)[number];

// the families every theme provides, in the order they are listed in the atlas meta
export const THEME_FAMILIES = ['ground', 'grass', 'road', 'pave', 'lot', 'ind', 'mud', 'dirty', 'water', 'outer', 'edge'] as const;

const C = (h: string): RGB => hex(h);
const n1 = (x: number, y: number, salt: number) => hash(Math.floor(x), Math.floor(y), salt);
const n2 = (x: number, y: number, salt: number) => hash(Math.floor(x / 2), Math.floor(y / 2), salt);
// screen position inside the tile (X across, Y down), for shapes that must line up on screen (reflections)
const scrX = (x: number, y: number) => x - y;
const scrY = (x: number, y: number) => (x + y) / 2;

// specks on a 1-voxel grid
function specks(x: number, y: number, salt: number, base: RGB, light: RGB, dark: RGB, density: number): RGB {
  const h = n1(x, y, salt);
  if (h < density) return light;
  if (h > 1 - density) return dark;
  return base;
}

// A neon reflection in a puddle: a round puddle (a 2:1 ellipse on screen) that mirrors the night sky, with a
// vertical streak (on screen) of a sign's colour falling across it, bright at the top and fading down.
interface Puddle {
  cx: number;
  cy: number;
  r: number;
  streaks: [number, RGB, RGB][]; // screen X offset from the centre, bright colour, faded colour
}
function puddleAt(x: number, y: number, p: Puddle, sky: RGB, rim: RGB): RGB | null {
  const d = Math.hypot(x - p.cx, y - p.cy);
  if (d > p.r) return null;
  const X = scrX(x, y) - scrX(p.cx, p.cy);
  const Y = scrY(x, y) - scrY(p.cx, p.cy);
  for (const [sx, hi, lo] of p.streaks) if (Math.floor(X + 0.5) === sx) return Y < -0.4 ? hi : lo;
  if (d > p.r - 0.8 && Y < 0) return rim;
  return sky;
}

// ---------- shared shapes ----------

// a straight crack (as in terrain.ts)
const crack = (x: number, y: number, k: number) => Math.abs(x - y * 0.6 - 4 + k * 0.3) < 0.5 && y > 3 && y < 12;

// slabs of n voxels with 1-voxel seams
const seam = (x: number, y: number, n: number) => Math.floor(x) % n === 0 || Math.floor(y) % n === 0;

// ---------- the four themes ----------

interface ThemeArt {
  ground(fam: number, k: number): Shader;
  grass(k: number): Shader;
  road(kind: 'x' | 'y' | 'c'): Shader;
  pave(k: number): Shader;
  lot(k: number): Shader;
  ind(k: number): Shader;
  mud(k: number): Shader;
  dirty(k: number): Shader;
  water: { deep: RGB; mid: RGB; line: RGB | ((cx: number, cy: number) => RGB); foam: RGB; bank: RGB; extra?: (x: number, y: number, d: number) => RGB | null };
  outer(k: number): Shader;
  edge: { strata: RGB[]; top: RGB; speck: RGB; extra?: (px: number, d: number, side: 'l' | 'r') => RGB | null };
}

// A road painter: asphalt with a dashed centre line, curbs on both sides, zebra crossings at the crossroads.
function roads(o: { asphalt: (x: number, y: number, salt: number) => RGB; curb: (x: number, y: number) => RGB; line: RGB; zebra: RGB; dash?: (x: number, y: number) => boolean }): (kind: 'x' | 'y' | 'c') => Shader {
  const dash = o.dash ?? (() => true);
  return (kind) => {
    if (kind === 'x') return (x, y) => (y < 1 || y >= 15 ? o.curb(x, y) : Math.abs(y - 8) < 0.5 && x % 8 < 4 && dash(x, y) ? o.line : o.asphalt(x, y, 600));
    if (kind === 'y') return (x, y) => (x < 1 || x >= 15 ? o.curb(x, y) : Math.abs(x - 8) < 0.5 && y % 8 < 4 && dash(y, x) ? o.line : o.asphalt(x, y, 601));
    return (x, y) => {
      if ((x < 1 || x >= 15) && (y < 1 || y >= 15)) return o.curb(x, y);
      const zebra = (x < 3 || x >= 13) !== (y < 3 || y >= 13) && (x < 3 || x >= 13 ? Math.floor(y) % 3 === 0 : Math.floor(x) % 3 === 0);
      return zebra ? o.zebra : o.asphalt(x, y, 602);
    };
  };
}

// ---------- rust: Rustbay ----------

const rust: ThemeArt = (() => {
  const plate = C('#5b4a47');
  const plateD = C('#4c3d3b');
  const rustA = C('#7b3f22');
  const rustB = C('#a0562c');
  const rivet = C('#80706a');
  const flake = C('#8a4a2a');
  // a half-buried corroded plate: steel grey-brown with rust patches, rivets in the corners, a dark sunken edge
  const buried = (x: number, y: number, x0: number, y0: number, x1: number, y1: number, salt: number): RGB | null => {
    if (x < x0 - 1 || y < y0 - 1 || x >= x1 || y >= y1) return null;
    if (x < x0 || y < y0) return C('#2a1c19');
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if ((ix === x0 || ix === x1 - 1) && (iy === y0 || iy === y1 - 1)) return rivet;
    const r = n2(x, y, salt);
    if (r > 0.82) return rustB;
    if (r > 0.55) return rustA;
    return n1(x, y, salt + 1) > 0.5 ? plate : plateD;
  };
  return {
    ground: (fam, k) => {
      const base = C(['#3d2a24', '#42302a', '#47342c'][fam]);
      return (x, y) => {
        if (k === 2) {
          const b = buried(x, y, 4 + fam, 5, 11 + fam, 10, 1600 + fam);
          if (b) return b;
        }
        if (n2(x, y, 1610 + fam * 10 + k) > 0.982) return flake;
        if (k === 3 && crack(x, y, 0)) return C('#24171a');
        // wind ripples in the sand
        if (Math.sin((x * 0.9 + y * 0.35) * 1.25 + fam * 2 + k) > 0.9) return C('#4e392e');
        return specks(x, y, 1620 + fam * 10 + k, base, C('#58402f'), C('#2a1c19'), 0.06);
      };
    },
    grass: (k) => {
      const base = C(['#3a5230', '#354b2b', '#3e5934'][k % 3]);
      return (x, y) => {
        const h = n1(x, y, 1650 + k);
        if (h > 0.93) return C('#7a9a4a');
        if (h > 0.86) return C('#56783b');
        if (h < 0.05) return C('#283e22');
        if (k >= 4 && h > 0.6 && h < 0.605) return C(k === 4 ? '#ff9b2f' : '#ffd440');
        return base;
      };
    },
    road: roads({
      asphalt: (x, y, salt) => {
        // sand blown over the asphalt along the curbs
        const edge = Math.min(y, 16 - y, x, 16 - x);
        if (edge < 3.2 && n2(x, y, salt + 50) > 0.55) return C('#4a362b');
        return n1(x, y, salt) > 0.9 ? C('#33292a') : C('#2a2224');
      },
      curb: (x, y) => (n1(x, y, 1660) > 0.8 ? C('#6e3a22') : C('#5a4136')),
      line: C('#b98a3a'),
      zebra: C('#8a7a6e'),
      dash: (a, b) => hash(Math.floor(a / 8), Math.floor(b), 1661) > 0.3, // worn away here and there
    }),
    // sidewalks of steel deck plates, rust bleeding from the seams
    pave: (k) => (x, y) => {
      const [cx, cy] = [Math.floor(x), Math.floor(y)];
      if (cx % 4 === 0 || cy % 4 === 0) return n1(x, y, 1670 + k) > 0.75 ? C('#5a2e1b') : C('#2a1f1d');
      if (cx % 4 === 1 && cy % 4 === 1) return C('#665550');
      const slab = hash(cx >> 2, cy >> 2, 1675 + k);
      if (n1(x, y, 1680 + k) > 0.9) return rustA;
      return slab > 0.5 ? C('#4e3c36') : C('#463631');
    },
    // big corroded plates, riveted along the seams
    lot: (k) => (x, y) => {
      const [cx, cy] = [Math.floor(x), Math.floor(y)];
      if (cx % 8 === 0 || cy % 8 === 0) return C('#2c2224');
      if ((cx % 8 === 1 || cy % 8 === 1) && (cx + cy) % 3 === 0) return C('#6e6466');
      if (k === 3 && Math.hypot(x - 11, y - 9) < 2.6) return C('#241c1e');
      const r = n2(x, y, 1690 + k);
      if (r > 0.88) return rustB;
      if (r > 0.68) return rustA;
      return hash(cx >> 3, cy >> 3, 1695 + k) > 0.5 ? C('#4e4446') : C('#484042');
    },
    // rust-orange deck with a tread pattern
    ind: (k) => (x, y) => {
      const [cx, cy] = [Math.floor(x), Math.floor(y)];
      if (cx % 8 === 0 || cy % 8 === 0) return C('#2e1a14');
      if (k === 1 && cy >= 6 && cy < 8) return Math.floor(cx / 2) % 2 ? C('#8a7a35') : C('#2a1f1a');
      if (cx % 3 === 1 && cy % 3 === 1) return C('#6e4029');
      return n1(x, y, 1700 + k) > 0.93 ? C('#74462e') : C('#5c3525');
    },
    // wet dark sand with oily puddles next to the sludge
    mud: (k) => (x, y) => {
      const d = Math.hypot(x - 4 - k * 3, y - 6 - (k % 2) * 4);
      if (d < 2.2) return d > 1.5 && scrY(x, y) < scrY(4 + k * 3, 6 + (k % 2) * 4) ? C('#3f5a5a') : C('#1c1517');
      return specks(x, y, 1710 + k, C('#352621'), C('#45302a'), C('#2a1d1a'), 0.1);
    },
    dirty: (k) => (x, y) => {
      const h = n1(x, y, 1720 + k);
      if (h > 0.955) return C('#a0562c');
      if (h > 0.935) return C('#6c7096');
      if (h < 0.07) return C('#231816');
      return C('#382722');
    },
    // a grey-green storm sea, whitecaps on the swell, a rusty sand bank
    water: {
      deep: C('#1b3540'),
      mid: C('#264c55'),
      line: C('#4a7c82'),
      foam: C('#c4d6cf'),
      bank: C('#4a3328'),
      extra: (x, y, d) => {
        if (d < 3.5) return null;
        const [cx, cy] = [Math.floor(x), Math.floor(y)];
        return (cx * 2 + cy * 5) % 13 === 0 && hash(cx, cy, 1730) > 0.45 ? C('#9fb8b2') : null;
      },
    },
    outer: (k) => (x, y) => {
      if (k === 1 && Math.abs(y - x * 0.5 - 5) < 0.5 && x > 2 && x < 14) return C('#140e0c');
      if (k === 2) {
        const b = buried(x, y, 6, 6, 10, 9, 1740);
        if (b) return b;
      }
      if (k === 3 && n2(x, y, 1741) > 0.96) return flake;
      return specks(x, y, 1745 + k, C('#2b1f1c'), C('#3a2a24'), C('#1c1412'), 0.07);
    },
    edge: { strata: ['#6b4632', '#583a2b', '#472f25', '#38251e', '#2a1c17'].map(C), top: C('#7d5438'), speck: C('#8f4d2b') },
  };
})();

// ---------- neon: Neon Heights ----------

const neon: ThemeArt = (() => {
  const pink = C('#ff3d8b');
  const pinkD = C('#8f2a5c');
  const cyan = C('#42e2d2');
  const cyanD = C('#227a7a');
  const violet = C('#7c55ff');
  const violetD = C('#463488');
  const sky = C('#2c2a48');
  const rim = C('#48466c');
  const sheen = C('#33314a');
  const PUDDLES: Record<number, Puddle[]> = {
    1: [{ cx: 6.5, cy: 9, r: 4.2, streaks: [[-2, pink, pinkD], [-1, pink, pinkD], [3, violet, violetD]] }],
    2: [{ cx: 10, cy: 6, r: 3.6, streaks: [[0, cyan, cyanD], [1, cyan, cyanD]] }],
    3: [{ cx: 4.5, cy: 11, r: 2.2, streaks: [[0, pink, pinkD]] }],
  };
  const wet = (x: number, y: number, k: number, salt: number, base: RGB, light: RGB, dark: RGB): RGB => {
    for (const p of PUDDLES[k] ?? []) {
      const c = puddleAt(x, y, p, sky, rim);
      if (c) return c;
    }
    if (n1(x, y, salt + 7) > 0.975) return sheen;
    return specks(x, y, salt, base, light, dark, 0.06);
  };
  return {
    ground: (fam, k) => {
      const base = C(['#1c1a26', '#1f1d2a', '#22202e'][fam]);
      return (x, y) => {
        if (k === 3 && crack(x, y, 1)) return C('#0f0e15');
        return wet(x, y, k, 1800 + fam * 10 + k, base, C('#2b293a'), C('#14121b'));
      };
    },
    grass: (k) => {
      const base = C(['#26503a', '#234a35', '#29583f'][k % 3]);
      return (x, y) => {
        const h = n1(x, y, 1830 + k);
        if (h > 0.93) return C('#4aa86a');
        if (h > 0.86) return C('#378052');
        if (h < 0.05) return C('#1b3a2a');
        if (k >= 4 && h > 0.6 && h < 0.605) return k === 4 ? pink : cyan;
        return base;
      };
    },
    road: roads({
      asphalt: (x, y, salt) => {
        const h = n1(x, y, salt + 10);
        if (h > 0.985) return sheen;
        return h > 0.9 ? C('#1e1b28') : C('#17151f');
      },
      curb: () => C('#3b3653'),
      line: C('#e0408a'),
      zebra: C('#9ad6dc'),
    }),
    pave: (k) => (x, y) => {
      const [cx, cy] = [Math.floor(x), Math.floor(y)];
      if (cx % 4 === 0 || cy % 4 === 0) return C('#16141e');
      const h = n1(x, y, 1840 + k);
      if (h > 0.97) return sheen;
      return hash(cx >> 2, cy >> 2, 1845 + k) > 0.55 ? C('#2f2c3f') : C('#2a2738');
    },
    lot: (k) => (x, y) => {
      if (seam(x, y, 8)) return C('#1a1823');
      if (k === 3) {
        const d = Math.hypot(x - 10, y - 9);
        if (d < 2.8) return d > 2.1 ? C('#4a3a6a') : C('#15131c');
      }
      if (k % 2 === 0 && Math.abs(y - x * 0.7 - 3 - k) < 0.5 && x > 3 && x < 13) return C('#15131c');
      return specks(x, y, 1850 + k, C('#272533'), C('#302d3e'), C('#201e2a'), 0.06);
    },
    // dark tech paving with teal joints
    ind: (k) => (x, y) => {
      const [cx, cy] = [Math.floor(x), Math.floor(y)];
      if (cx % 8 === 0 || cy % 8 === 0) return C('#1d6f74');
      if (k === 1 && cy >= 6 && cy < 8) return Math.floor(cx / 2) % 2 ? C('#b11a5e') : C('#1a1624');
      return n1(x, y, 1860 + k) > 0.93 ? C('#30285a') : C('#262040');
    },
    // black oily ground with a sickly green sheen next to the sludge
    mud: (k) => (x, y) => {
      const px = 4 + k * 3;
      const py = 6 + (k % 2) * 4;
      const d = Math.hypot(x - px, y - py);
      if (d < 2.3) return d > 1.6 && scrY(x, y) < scrY(px, py) ? C('#4f7a2a') : C('#121a14');
      return specks(x, y, 1870 + k, C('#1f2622'), C('#2a3529'), C('#161b18'), 0.1);
    },
    dirty: (k) => (x, y) => {
      const h = n1(x, y, 1880 + k);
      if (h > 0.975) return C('#b11a5e');
      if (h > 0.955) return C('#8a5030');
      if (h > 0.935) return C('#6c7096');
      if (h < 0.07) return C('#14121a');
      return C('#1f1c29');
    },
    // a black canal: the signs of the city mirrored in it as pink and cyan streaks
    water: {
      deep: C('#110f26'),
      mid: C('#191638'),
      line: (cx, cy) => (hash(cx, cy, 1890) > 0.5 ? C('#c2306f') : C('#2fa8a0')),
      foam: C('#4f4a8a'),
      bank: C('#2a2638'),
    },
    outer: (k) => (x, y) => {
      if (k === 1 && Math.abs(y - x * 0.5 - 5) < 0.5 && x > 2 && x < 14) return C('#0b0a10');
      const p = k === 2 ? puddleAt(x, y, { cx: 9, cy: 7, r: 2.2, streaks: [[0, pink, pinkD]] }, sky, rim) : k === 3 ? puddleAt(x, y, { cx: 6, cy: 10, r: 2, streaks: [[1, cyan, cyanD]] }, sky, rim) : null;
      if (p) return p;
      return specks(x, y, 1895 + k, C('#16141d'), C('#1f1d29'), C('#0e0d13'), 0.06);
    },
    // dark concrete with a teal cable duct running along it
    edge: {
      strata: ['#3b3652', '#302c44', '#272438', '#1f1c2d', '#181622'].map(C),
      top: C('#4b4568'),
      speck: C('#55507a'),
      extra: (_px, d) => (d >= 4 && d < 5 ? C('#2a8a90') : d >= 5 && d < 6 ? C('#1b4f58') : null),
    },
  };
})();

// ---------- green: Greenvale ----------

const green: ThemeArt = (() => {
  const sprout = C('#3f7a3f');
  const sproutD = C('#2f5f36');
  const moss = C('#2f5a33');
  return {
    // rich soil with sprouts, stones and a clover patch
    ground: (fam, k) => {
      const base = C(['#33291f', '#382d22', '#3c3125'][fam]);
      return (x, y) => {
        if (k === 3) {
          const d = Math.hypot(x - 6 - fam * 2, y - 8);
          if (d < 2.4) return n1(x, y, 1900 + fam) > 0.7 ? C('#4f9c48') : C('#356b3a');
        }
        if (n2(x, y, 1905 + fam * 10 + k) > (k === 2 ? 0.95 : 0.985)) return C('#5c5448');
        const h = n1(x, y, 1910 + fam * 10 + k);
        if (h > (k === 1 ? 0.9 : 0.95)) return sprout;
        if (h > (k === 1 ? 0.86 : 0.93)) return sproutD;
        return specks(x, y, 1940 + fam * 10 + k, base, C('#4a3c2c'), C('#261e17'), 0.06);
      };
    },
    // lush and dense: more blades, brighter, flowers on half the tiles
    grass: (k) => {
      const base = C(['#2e6a36', '#2a6232', '#33733b'][k % 3]);
      return (x, y) => {
        const h = n1(x, y, 1970 + k);
        if (h > 0.88) return C('#64bf55');
        if (h > 0.74) return C('#479a4a');
        if (h < 0.07) return C('#225029');
        if (k >= 3 && h > 0.6 && h < 0.612) return C(k === 3 ? '#ece8f6' : k === 4 ? '#ff3d8b' : '#ffd440');
        return base;
      };
    },
    road: roads({
      asphalt: (x, y, salt) => (n1(x, y, salt + 20) > 0.9 ? C('#333238') : C('#2c2b30')),
      curb: (x, y) => (n1(x, y, 1980) > 0.6 ? sprout : C('#5e5a52')),
      line: C('#d8d4c4'),
      zebra: C('#bdb8aa'),
    }),
    // a stone path, moss in the seams
    pave: (k) => (x, y) => {
      const [cx, cy] = [Math.floor(x), Math.floor(y)];
      if (cx % 4 === 0 || cy % 4 === 0) return n1(x, y, 1985 + k) > 0.5 ? moss : C('#2b2a22');
      if (n1(x, y, 1990 + k) > 0.96) return C('#4f9c48');
      return hash(cx >> 2, cy >> 2, 1995 + k) > 0.55 ? C('#4b463f') : C('#45403a');
    },
    // an old concrete lot, cracked and overgrown
    lot: (k) => (x, y) => {
      if (seam(x, y, 8)) return moss;
      if (k % 2 === 0 && Math.abs(y - x * 0.7 - 3 - k) < 0.5 && x > 3 && x < 13) return sprout;
      if (k === 3 && Math.hypot(x - 11, y - 9) < 2.2) return C('#356b3a');
      return specks(x, y, 2000 + k, C('#4a4740'), C('#55524a'), C('#3e3b35'), 0.06);
    },
    // terracotta brick paving, running bond
    ind: (k) => (x, y) => {
      const [cx, cy] = [Math.floor(x), Math.floor(y)];
      const row = Math.floor(cy / 2);
      const off = row % 2 ? 2 : 0;
      if (cy % 2 === 0 || (cx + off) % 4 === 0) return C('#35231c');
      const b = hash((cx + off) >> 2, row, 2010 + k);
      return b > 0.8 ? C('#7a4834') : b < 0.2 ? C('#57321f') : C('#6b3f2e');
    },
    // dark wet mud with puddles mirroring the sky
    mud: (k) => (x, y) => {
      const px = 4 + k * 3;
      const py = 6 + (k % 2) * 4;
      const d = Math.hypot(x - px, y - py);
      if (d < 2.2) return d > 1.5 && scrY(x, y) < scrY(px, py) ? C('#4a6a8c') : C('#1b1a22');
      return specks(x, y, 2020 + k, C('#2f241d'), C('#3d2f25'), C('#231a15'), 0.1);
    },
    dirty: (k) => (x, y) => {
      const h = n1(x, y, 2030 + k);
      if (h > 0.97) return sprout;
      if (h > 0.95) return C('#8a5030');
      if (h > 0.93) return C('#6c7096');
      if (h < 0.07) return C('#211a14');
      return C('#2f271f');
    },
    // a clear river between grassy banks, reeds at the water's edge
    water: {
      deep: C('#1c4a63'),
      mid: C('#2a6a84'),
      line: C('#5aa6c2'),
      foam: C('#b8e4ec'),
      bank: C('#3b6b38'),
      extra: (x, y, d) => (d >= 1.5 && d < 2.5 && n1(x, y, 2040) > 0.6 ? C('#5e8a3a') : d < 0.7 ? C('#2f5a33') : null),
    },
    // meadow outside the valley: darker than the playable grass
    outer: (k) => (x, y) => {
      if (k === 1 && Math.hypot(x - 8, y - 7) < 2.6) return specks(x, y, 2050, C('#2c2219'), C('#3a2d22'), C('#211913'), 0.1);
      if (k === 2 && n1(x, y, 2051) > 0.985) return C('#d9709f');
      if (k === 3 && n1(x, y, 2052) > 0.985) return C('#ece8f6');
      return specks(x, y, 2055 + k, C('#1f2d1e'), C('#2b4228'), C('#162114'), 0.1);
    },
    // soil strata under a lip of grass, stones and roots
    edge: {
      strata: ['#4d3c2c', '#413225', '#36291f', '#2c211a', '#221a14'].map(C),
      top: C('#3f7a3f'),
      speck: C('#5c5448'),
      extra: (px, d) => (d < 0.7 ? C('#4f9c48') : d < 2 ? (px % 3 === 1 && d < 2.6 ? C('#2f5f36') : C('#3f7a3f')) : null),
    },
  };
})();

// ---------- corp: 2PM Company Town ----------

const corp: ThemeArt = (() => {
  const white = C('#a4a4ae');
  const yellow = C('#b39a3c');
  return {
    // clean concrete slabs, painted lines: a parking bay line, a yellow walkway line, an oil stain
    ground: (fam, k) => {
      const base = C(['#393943', '#3d3d47', '#41414b'][fam]);
      return (x, y) => {
        if (seam(x, y, 8)) return C('#2e2e37');
        if (k === 1 && x >= 2 && x < 3 && y > 1 && y < 15) return white;
        if (k === 2 && y >= 11 && y < 12) return yellow;
        if (k === 3 && Math.hypot(x - 11, y - 5) < 2.2) return C('#2f2f37');
        return specks(x, y, 2100 + fam * 10 + k, base, C('#46464f'), C('#33333c'), 0.05);
      };
    },
    // a mown lawn: stripes along the mower's runs
    grass: (k) => (x, y) => {
      const h = n1(x, y, 2140 + k);
      if (h > 0.97) return C('#4f9c48');
      if (h < 0.03) return C('#24482a');
      if (k >= 4 && h > 0.6 && h < 0.604) return C('#ece8f6');
      const band = Math.floor(x / 4) % 2;
      return band ? C('#36693d') : C('#2c5934');
    },
    road: roads({
      asphalt: (x, y, salt) => (n1(x, y, salt + 30) > 0.92 ? C('#292931') : C('#23232b')),
      curb: () => C('#70707c'),
      line: C('#dcdce4'),
      zebra: C('#cfcfd8'),
    }),
    pave: (k) => (x, y) => {
      const [cx, cy] = [Math.floor(x), Math.floor(y)];
      if (cx % 4 === 0 || cy % 4 === 0) return C('#3a3a44');
      return hash(cx >> 2, cy >> 2, 2150 + k) > 0.5 ? C('#55555f') : C('#4f4f5a');
    },
    // a car park: white bay lines across the slabs
    lot: (k) => (x, y) => {
      const [cx, cy] = [Math.floor(x), Math.floor(y)];
      if (cy % 8 === 0) return C('#34343d');
      if (cx % 8 === 4 && cy % 8 !== 7) return C('#b4b4be');
      if (k === 3 && Math.hypot(x - 10, y - 10) < 2.4) return C('#2e2e36');
      return specks(x, y, 2160 + k, C('#44444e'), C('#4b4b55'), C('#3d3d46'), 0.05);
    },
    // grey epoxy floor with yellow markings
    ind: (k) => (x, y) => {
      const [cx, cy] = [Math.floor(x), Math.floor(y)];
      if (cx % 8 === 0 || cy % 8 === 0) return C('#2c2c36');
      if (k === 1 && cy >= 6 && cy < 8) return Math.floor((cx + cy) / 2) % 2 ? C('#c9a93a') : C('#26222e');
      if (k === 2 && cx === 4) return C('#c9a93a');
      return n1(x, y, 2170 + k) > 0.94 ? C('#43434f') : C('#3b3b47');
    },
    mud: (k) => (x, y) => {
      const px = 4 + k * 3;
      const py = 6 + (k % 2) * 4;
      const d = Math.hypot(x - px, y - py);
      if (d < 2.3) return d > 1.6 && scrY(x, y) < scrY(px, py) ? C('#4a3a6a') : C('#1f1f25');
      return specks(x, y, 2180 + k, C('#33333b'), C('#3b3b44'), C('#2a2a31'), 0.1);
    },
    dirty: (k) => (x, y) => {
      const h = n1(x, y, 2190 + k);
      if (h > 0.96) return C('#8a5030');
      if (h > 0.935) return C('#6c7096');
      if (h < 0.06) return C('#22222a');
      return C('#30303a');
    },
    // a concrete-lined channel
    water: {
      deep: C('#1f3450'),
      mid: C('#29466a'),
      line: C('#4f6f99'),
      foam: C('#7d91b0'),
      bank: C('#6e6e7a'),
      extra: (_x, _y, d) => (d < 0.7 ? C('#8a8a96') : null),
    },
    outer: (k) => (x, y) => {
      if (seam(x, y, 8)) return C('#232329');
      if (k === 1 && x >= 4 && x < 5 && y > 1 && y < 15) return C('#55555f');
      if (k === 2 && y >= 9 && y < 10) return C('#58502f');
      if (k === 3 && crack(x, y, 0)) return C('#1a1a1f');
      return specks(x, y, 2200 + k, C('#2a2a31'), C('#33333b'), C('#212127'), 0.06);
    },
    // a concrete retaining wall with form joints and a hazard band along the top
    edge: {
      strata: ['#55555f', '#4d4d57', '#46464f', '#3f3f48', '#383840'].map(C),
      top: C('#8a8a94'),
      speck: C('#5f5f69'),
      extra: (px, d) => {
        if (d < 1) return null;
        if (d < 3) return Math.floor((px + Math.floor(d) * 2) / 3) % 2 ? C('#c9a93a') : C('#26222e');
        if (px % 8 === 0) return C('#34343c');
        return null;
      },
    },
  };
})();

const ART: Record<Theme, ThemeArt> = { rust, neon, green, corp };

// ---------- frames ----------

function waterTiles(theme: Theme): Record<string, Image> {
  const w = ART[theme].water;
  const out: Record<string, Image> = {};
  for (let mask = 0; mask < 16; mask++) {
    out[`t/${theme}/water/${mask}`] = tile((x, y) => {
      const dl = mask & 1 ? 99 : x;
      const dr = mask & 2 ? 99 : 16 - x;
      const du = mask & 4 ? 99 : y;
      const dd = mask & 8 ? 99 : 16 - y;
      const d = Math.min(dl, dr, du, dd);
      const e = w.extra?.(x, y, d);
      if (e) return e;
      if (d < 1.5) return w.bank;
      if (d < 2.5) return w.foam;
      const [cx, cy] = [Math.floor(x), Math.floor(y)];
      if ((cx + cy * 3) % 11 === 0 && hash(cx, cy, 1500) > 0.4) return typeof w.line === 'function' ? w.line(cx, cy) : w.line;
      return d < 5 ? w.mid : w.deep;
    });
  }
  return out;
}

// The ground tiles of a theme (32×16, anchored like t/ground: 16, 0).
export function themeTiles(theme: Theme): Record<string, Image> {
  const a = ART[theme];
  const out: Record<string, Image> = {};
  for (let fam = 0; fam < 3; fam++) for (let k = 0; k < 4; k++) out[`t/${theme}/ground/${fam}/${k}`] = tile(a.ground(fam, k));
  for (let k = 0; k < 6; k++) out[`t/${theme}/grass/${k}`] = tile(a.grass(k));
  for (const kind of ['x', 'y', 'c'] as const) out[`t/${theme}/road/${kind}`] = tile(a.road(kind));
  for (const fam of ['pave', 'lot', 'ind', 'mud', 'dirty'] as const) for (let k = 0; k < 4; k++) out[`t/${theme}/${fam}/${k}`] = tile(a[fam](k));
  Object.assign(out, waterTiles(theme));
  for (let k = 0; k < 4; k++) out[`t/${theme}/outer/${k}`] = tile(a.outer(k));
  return out;
}

// The slab sides of a theme (16×26, anchored like t/edge: l at 16, −8; r at 0, −8).
export function themeEdges(theme: Theme): Record<string, Image> {
  const e = ART[theme].edge;
  const make = (side: 'l' | 'r', salt: number): Image => {
    const img = createImage(16, 8 + EDGE_DEPTH);
    for (let py = 0; py < img.h; py++)
      for (let px = 0; px < 16; px++) {
        const edgeY = side === 'l' ? (px + 0.5) / 2 : 8 - (px + 0.5) / 2;
        const d = py + 0.5 - edgeY;
        if (d < 0 || d >= EDGE_DEPTH) continue;
        let c = e.strata[Math.min(e.strata.length - 1, Math.floor((d / EDGE_DEPTH) * e.strata.length))];
        if (d < 1) c = e.top;
        else if (hash(px >> 1, Math.floor(d / 2), salt) > 0.9) c = e.speck;
        c = e.extra?.(px, d, side) ?? c;
        const f = side === 'l' ? 0.92 : 0.7;
        const o = (py * 16 + px) * 4;
        img.data[o] = c[0] * f;
        img.data[o + 1] = c[1] * f;
        img.data[o + 2] = c[2] * f;
        img.data[o + 3] = 255;
      }
    return img;
  };
  return { [`t/${theme}/edge/l/0`]: make('l', 900), [`t/${theme}/edge/l/1`]: make('l', 901), [`t/${theme}/edge/r/0`]: make('r', 902), [`t/${theme}/edge/r/1`]: make('r', 903) };
}
