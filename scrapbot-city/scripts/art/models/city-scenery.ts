// City themes (0.7, increment 2): signature scenery for the border ring of each themed city, the decor that suits
// it, and a suggested light. Frames sc/<theme>/<name>/<f> (+ /g where something is lit), metadata like the
// decor's ({ w, d, frames, fps, tall }) under atlas.json themes.<theme>.scenery. Like the decor, they are a little
// darker and less saturated than the buildings, with lit accents for the night.
//   rust   harbour-crane (3×2), ship-hull (3×2), container-pile (2×2), boat (1×1, low)
//   neon   billboard-tower (2×1, no text), apartment-tall (2×2), apartment-mid (2×1), vending (1×1, low)
//   green  turbines (2×2), greenhouse (2×1), tree-clump (2×2), veg-patch (1×1, low)
//   corp   corp-tower (2×2, the 2PM crown), corp-billboard (2×1, the 2PM logo), office-block (2×1), van (1×1, low)
// Materials are registered lazily, on the first model built (after every older frame), so the ids of the older
// materials, and with them every older frame's pixels, stay the same.
import { M } from '../palette';
import { Vox, hex, mat } from '../voxel';
import { hash } from './common';
import { balls, isoText, line, textW } from './decor';
import type { DecorArt } from './decor';
import type { Theme } from './city-terrain';

export interface ThemeSetup {
  // existing d/<name> scenery that suits the theme, mixed into its ring with the signature pieces
  decor: string[];
  // suggested light: day = multiply colour (255 = unchanged); night = the colour of the night veil (the game's is
  // 16, 12, 52); dark = factor on the veil's opacity
  light: { day: [number, number, number]; night: [number, number, number]; dark: number };
}

export const THEME_SETUP: Record<Theme, ThemeSetup> = {
  rust: {
    decor: ['container-rust', 'container-stack', 'scrap-car', 'tyres', 'barrels', 'ruin-wall', 'dumpster', 'tree-dead', 'crates', 'forklift'],
    light: { day: [255, 238, 214], night: [16, 30, 40], dark: 1 },
  },
  neon: {
    decor: ['billboard', 'sign', 'sign-scrap', 'cable-pole', 'pipe-run', 'dumpster', 'barrels', 'scrap-car', 'cones'],
    light: { day: [234, 226, 255], night: [30, 8, 60], dark: 1.1 },
  },
  green: {
    decor: ['tree-round', 'tree-round-2', 'tree-blossom', 'bush', 'bench', 'wind-turbine', 'crates', 'fence', 'tyres'],
    light: { day: [250, 255, 236], night: [10, 26, 46], dark: 0.9 },
  },
  corp: {
    decor: ['container', 'container-stack', 'crane', 'forklift', 'pipe-run', 'cones', 'sign', 'billboard', 'fence', 'cable-pole'],
    light: { day: [238, 242, 255], night: [34, 22, 36], dark: 1 },
  },
};

// ---------- materials (lazy) ----------

function makeMats() {
  const m = (key: string, h: string, jitter = 0.04) => mat(`sc-${key}`, { rgb: hex(h), jitter });
  const lit = (key: string, h: string, emit: number, glow?: string, flat = false) => mat(`sc-${key}`, { rgb: hex(h), emit, glow: glow ? hex(glow) : undefined, flat, jitter: 0 });
  return {
    // shared with the decor (same keys: the same materials)
    leaf: mat('decor-leaf', { rgb: hex('#3d8a4b'), jitter: 0 }),
    leafL: mat('decor-leafL', { rgb: hex('#69ad55'), jitter: 0 }),
    bark: mat('decor-bark', { rgb: hex('#5e4134'), jitter: 0.05 }),
    grass: mat('decor-grass', { rgb: hex('#2f5638'), jitter: 0.06 }),
    wood: mat('decor-wood', { rgb: hex('#c99a5e'), jitter: 0.03 }),
    woodD: mat('decor-woodD', { rgb: hex('#4a2c1a'), jitter: 0.03 }),
    // rust
    craneR: m('craneR', '#b0462b', 0.05),
    craneRD: m('craneRD', '#742d1e', 0.05),
    machine: m('machine', '#cfc8bf', 0.04),
    contTeal: m('contTeal', '#3f6e6c', 0.05),
    contTealD: m('contTealD', '#2b4c4b', 0.05),
    contOrange: m('contOrange', '#b0622f', 0.06),
    contOrangeD: m('contOrangeD', '#723d1f', 0.06),
    contBlue: m('contBlue', '#4a6390', 0.05),
    contBlueD: m('contBlueD', '#33466b', 0.05),
    hullRed: m('hullRed', '#93382b', 0.07),
    hullBlue: m('hullBlue', '#2f3d5a', 0.05),
    deck: m('deck', '#5b4a47', 0.07),
    sand: m('sand', '#4b382d', 0.06),
    sandL: m('sandL', '#5e4634', 0.06),
    boat: m('boat', '#c9c2b6', 0.04),
    // neon
    tower: m('tower', '#363149', 0.03),
    towerD: m('towerD', '#272436', 0.03),
    block: m('block', '#4a3f63', 0.03),
    blockD: m('blockD', '#382f4e', 0.03),
    panel: m('panel', '#211a36', 0),
    frame: m('frame', '#16131f', 0),
    violetLit: lit('violetLit', '#b18cff', 1),
    // lit flats: softer than the signs, so a tower of windows does not melt into one glow at night
    warmLit: lit('warmLit', '#ffcf7a', 0.5),
    winCyan: lit('winCyan', '#42e2d2', 0.5),
    winPink: lit('winPink', '#ff3d8b', 0.5),
    // green
    turbine: m('turbine', '#e2e0ea', 0.02),
    glass: mat('sc-glassG', { rgb: hex('#a8dccf'), flat: true, jitter: 0 }),
    glassPlant: mat('sc-glassPlant', { rgb: hex('#6aa884'), flat: true, jitter: 0 }),
    growLit: lit('growLit', '#b9e6d4', 0.7, '#e07cff', true),
    soil: m('soil', '#4a3a2a', 0.06),
    pine: m('pine', '#2e6b3e', 0),
    pineL: m('pineL', '#4f9a52', 0),
    pineD: m('pineD', '#1f4a2c', 0),
    spring: m('spring', '#7fb048', 0),
    springL: m('springL', '#a9d264', 0),
    springD: m('springD', '#55822f', 0),
    // corp
    curtain: m('curtain', '#3b5a8a', 0.02),
    officeLit: lit('officeLit', '#86acd8', 0.35, '#d4ecff'),
    spandrel: m('spandrel', '#c3c7d3', 0.02),
    officeWall: m('officeWall', '#8c8ba0', 0.03),
    lobbyLit: lit('lobbyLit', '#9fd8e8', 0.6, '#bff4ff', true),
    whiteLit: lit('whiteLit', '#ece8f6', 1),
    lightbox: lit('lightbox', '#f4f0fb', 0.8, '#ffffff', true),
    van: m('van', '#dedae8', 0.02),
  };
}
let MATS: ReturnType<typeof makeMats> | null = null;
const K = () => (MATS ??= makeMats());

const tile = (w: number, d: number, h: number) => new Vox(w * 16, d * 16, h);

// weathering: recolour some voxels of one material, decided per voxel
function weather(v: Vox, from: number, to: number, share: number, salt: number, to2?: number, share2 = 0): void {
  for (let z = 0; z < v.h; z++)
    for (let y = 0; y < v.d; y++)
      for (let x = 0; x < v.w; x++) {
        if (v.get(x, y, z) !== from) continue;
        const h = hash(x + z * 57, y, salt);
        if (to2 !== undefined && h > 1 - share2) v.set(x, y, z, to2);
        else if (h > 1 - share - share2) v.set(x, y, z, to);
      }
}

// ---------- rust: Rustbay ----------

// A ship-to-shore gantry crane, weathered red: a narrow portal on four legs, the machinery house, a truss boom
// reaching out past the legs on both sides with an A-frame and its stays, a trolley lowering a teal container
// beyond the legs. The beacon on the A-frame blinks.
function harbourCrane(frame: number): Vox {
  const k = K();
  const v = tile(3, 2, 78);
  const LX = [14, 29]; // the two leg lines along y
  for (const x of LX) {
    v.box(x - 1, 1, 0, x + 4, 31, 1, M.steelD);
    v.box(x - 1, 3, 1, x + 4, 9, 3, k.craneRD);
    v.box(x - 1, 23, 1, x + 4, 29, 3, k.craneRD);
    for (const y of [4, 25]) v.box(x, y, 3, x + 3, y + 3, 46, k.craneR);
    v.box(x, 4, 16, x + 3, 28, 18, k.craneR);
    v.box(x, 4, 42, x + 3, 28, 46, k.craneR);
    line(v, [x + 1, 7, 18], [x + 1, 24, 41], k.craneRD, 2);
  }
  for (const y of [4, 25]) v.box(14, y, 42, 32, y + 3, 46, k.craneR);
  // machinery house with a window band
  v.box(16, 8, 46, 30, 24, 53, k.machine);
  v.box(15, 7, 53, 31, 25, 54, M.steelL);
  v.box(18, 23, 49, 28, 24, 51, M.window);
  v.box(29, 10, 49, 30, 22, 51, M.window);
  // the boom: a truss along x with zigzag sides, over the house, reaching out on both sides
  const BZ = 54;
  for (const y of [13, 18]) {
    v.box(0, y, BZ, 48, y + 1, BZ + 1, k.craneR);
    v.box(0, y, BZ + 3, 48, y + 1, BZ + 4, k.craneR);
    for (let x = 0; x < 48; x++) {
      const p = x % 4;
      v.set(x, y, BZ + 1 + (p < 2 ? p : 3 - p), k.craneR);
    }
  }
  for (let x = 1; x < 48; x += 4) {
    v.box(x, 13, BZ + 3, x + 1, 19, BZ + 4, k.craneR);
    v.box(x, 13, BZ, x + 1, 19, BZ + 1, k.craneR);
  }
  // A-frame and stays
  for (const y of [14, 17]) {
    line(v, [17, y, BZ + 4], [22, y, 70], k.craneRD, 2);
    line(v, [28, y, BZ + 4], [23, y, 70], k.craneRD, 2);
  }
  v.box(21, 14, 70, 25, 19, 72, k.craneRD);
  line(v, [24, 16, 71], [47, 16, BZ + 4], M.steelL);
  line(v, [22, 16, 71], [0, 16, BZ + 4], M.steelL);
  v.box(22, 15, 72, 24, 17, 74, frame === 0 ? M.redLit : M.red);
  v.point('light', 23, 16, 74);
  // trolley out on the boom, cables, spreader and the container on its way down
  v.box(37, 13, BZ - 2, 43, 19, BZ, M.steelD);
  for (const x of [38, 41]) v.box(x, 16, 30, x + 1, 17, BZ - 2, M.ink);
  v.box(34, 12, 28, 46, 20, 30, M.yellow);
  v.box(34, 12, 18, 46, 20, 28, k.contTeal);
  for (let x = 35; x < 45; x += 2) v.paint(x, 19, 19, x + 1, 20, 27, k.contTealD);
  v.paint(45, 12, 18, 46, 20, 19, k.contTealD);
  v.paint(45, 12, 27, 46, 20, 28, k.contTealD);
  // a mooring bollard and a coil of rope on the quay
  v.cylZ(6, 24, 1.6, 0, 4, M.ink);
  v.cylZ(6, 24, 2.1, 3, 4, M.ink);
  v.cylZ(5.5, 28.5, 2.2, 0, 1, k.wood, 1);
  weather(v, k.craneR, M.rust, 0.08, 7100, M.rustD, 0.03);
  return v;
}

// A beached cargo ship, broken amidships: red anti-fouling below a black boot-top, a dark blue topside streaked
// with rust, portholes, the white wheelhouse and the funnel at the stern, a raised bow, sand drifted at its foot.
function shipHull(): Vox {
  const k = K();
  const v = tile(3, 2, 34);
  const yc = (z: number) => 16.5 - z * 0.1;
  const deckTop = (x: number) => 16 + (x > 34 ? Math.floor((x - 34) / 3) : 0);
  for (let x = 2; x < 47; x++) {
    const bow = x > 33 ? Math.max(0, (47 - x) / 14) ** 0.75 : 1;
    const top = deckTop(x);
    for (let z = 0; z < top; z++) {
      const hw = (2.6 + 5.4 * Math.min(1, (z + 1) / 8) ** 0.6) * bow + (x > 33 ? 0.4 : 0);
      for (let y = 0; y < 32; y++) {
        if (Math.abs(y + 0.5 - yc(z)) > hw) continue;
        const mm = z === top - 1 ? k.deck : z < 6 ? k.hullRed : z === 6 ? M.hazardK : k.hullBlue;
        v.set(x, y, z, mm);
      }
    }
  }
  // rust running down from the deck edge
  for (let x = 3; x < 46; x++) {
    if (hash(x, 1, 7200) < 0.8) continue;
    const len = 2 + Math.floor(hash(x, 2, 7200) * 5);
    for (let z = deckTop(x) - 1 - len; z < deckTop(x) - 1; z++) for (let y = 0; y < 32; y++) if (v.get(x, y, z) === k.hullBlue) v.set(x, y, z, M.rust);
  }
  // portholes
  for (let x = 16; x < 40; x += 4)
    for (let y = 31; y >= 0; y--)
      if (v.get(x, y, 11)) {
        v.set(x, y, 11, M.ink);
        break;
      }
  weather(v, k.hullRed, M.rustD, 0.15, 7210);
  weather(v, k.deck, M.rust, 0.18, 7220);
  // broken amidships: the plating torn away down to the waterline, two frames standing in the gap
  for (let x = 22; x < 27; x++) {
    const floor = x === 22 || x === 26 ? 12 : 8;
    for (let z = floor; z < 20; z++) for (let y = 0; y < 32; y++) if (v.get(x, y, z)) v.set(x, y, z, 0);
    for (let y = 0; y < 32; y++) if (v.get(x, y, floor - 1)) v.set(x, y, floor - 1, M.rustD);
  }
  for (let z = 8; z < 15; z++)
    for (let y = 0; y < 32; y++) {
      const d = Math.abs(y + 0.5 - yc(z));
      if (d > 6.8 && d <= 8) v.set(24, y, z, M.rustD);
    }
  // wheelhouse, mast and funnel at the stern
  const yw = Math.round(yc(16));
  v.box(4, yw - 5, 16, 13, yw + 5, 24, k.machine);
  v.box(4, yw + 4, 20, 12, yw + 5, 22, M.window);
  v.box(12, yw - 4, 20, 13, yw + 4, 22, M.window);
  v.box(3, yw - 6, 24, 14, yw + 6, 25, M.steelL);
  weather(v, k.machine, M.rust, 0.08, 7230);
  v.box(10, yw, 25, 11, yw + 1, 32, M.steelD);
  v.box(8, yw, 30, 13, yw + 1, 31, M.steelD);
  v.cylZ(6, yw + 0.5, 2.2, 25, 30, M.rust);
  v.cylZ(6, yw + 0.5, 2.2, 29, 30, M.ink);
  // sand drifted against the hull
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 48; x++) {
      const n = hash(x >> 1, y >> 1, 7240);
      const h = n > 0.7 ? 2 : 1;
      for (let z = 0; z < h; z++) if (!v.get(x, y, z)) v.set(x, y, z, n > 0.55 ? k.sandL : k.sand);
    }
  return v;
}

// A rusty container: corrugated sides, end frame, rust eating through the paint.
function rustyContainer(v: Vox, x0: number, y0: number, z0: number, axis: 'x' | 'y', body: number, dark: number, salt: number): void {
  const L = 28;
  const Wd = 12;
  const x1 = axis === 'x' ? x0 + L : x0 + Wd;
  const y1 = axis === 'x' ? y0 + Wd : y0 + L;
  const z1 = z0 + 12;
  v.box(x0, y0, z0, x1, y1, z1, body);
  if (axis === 'x') {
    for (let x = x0 + 2; x < x1 - 2; x += 3) v.paint(x, y1 - 1, z0 + 1, x + 1, y1, z1 - 1, dark);
    v.paint(x1 - 1, y0, z0, x1, y1, z1, dark);
    v.paint(x1 - 1, y0 + 2, z0 + 1, x1, y1 - 2, z1 - 1, body);
    v.paint(x1 - 1, y0 + 5, z0 + 1, x1, y0 + 7, z1 - 1, dark);
  } else {
    for (let y = y0 + 2; y < y1 - 2; y += 3) v.paint(x1 - 1, y, z0 + 1, x1, y + 1, z1 - 1, dark);
    v.paint(x0, y1 - 1, z0, x1, y1, z1, dark);
    v.paint(x0 + 2, y1 - 1, z0 + 1, x1 - 2, y1, z1 - 1, body);
    v.paint(x0 + 5, y1 - 1, z0 + 1, x0 + 7, y1, z1 - 1, dark);
  }
  v.paint(x0, y0, z1 - 1, x1, y1, z1, dark);
  for (let z = z0; z < z1; z++)
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const c = v.get(x, y, z);
        if (c !== body && c !== dark) continue;
        const n = hash(x >> 1, (y + z * 3) >> 1, salt);
        if (n > 0.93) v.set(x, y, z, M.rustD);
        else if (n > 0.83) v.set(x, y, z, M.rust);
      }
}

function containerPile(): Vox {
  const k = K();
  const v = tile(2, 2, 26);
  rustyContainer(v, 2, 3, 0, 'x', k.contTeal, k.contTealD, 7300);
  rustyContainer(v, 2, 17, 0, 'x', k.contOrange, k.contOrangeD, 7310);
  rustyContainer(v, 9, 3, 12, 'y', k.contBlue, k.contBlueD, 7320);
  // a door hanging open on the orange one
  v.clear(29, 19, 1, 30, 28, 11);
  v.box(30, 25, 1, 32, 26, 11, k.contOrangeD);
  return v;
}

// A small fishing boat on the sand, listing a little: red below, a white topside with a blue stripe, the wooden
// inside, an outboard motor at the stern and an oar across.
function boat(): Vox {
  const k = K();
  const v = tile(1, 1, 10);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (hash(x >> 1, y >> 1, 7400) > 0.45) v.set(x, y, 0, k.sand);
  const yc = (z: number) => 8 + z * 0.15;
  for (let x = 2; x < 16; x++) {
    const bow = x > 10 ? Math.max(0, (16 - x) / 6) ** 0.7 : 1;
    const top = 7 + (x > 12 ? 1 : 0);
    for (let z = 1; z < top; z++) {
      const hw = (1.6 + z * 0.6) * bow;
      for (let y = 0; y < 16; y++) {
        const d = Math.abs(y + 0.5 - yc(z));
        if (d > hw) continue;
        const inside = z > 2 && d < hw - 1 && x > 2 && bow > 0.6;
        v.set(x, y, z, inside ? k.woodD : z < 3 ? k.hullRed : z === 5 ? M.blue : k.boat);
      }
    }
  }
  v.box(6, 5, 3, 7, 12, 4, k.wood);
  v.box(0, 7, 3, 2, 10, 7, M.dark);
  v.box(1, 7, 7, 3, 10, 8, M.steel);
  line(v, [4, 4, 7], [12, 12, 6], k.wood);
  return v;
}

// ---------- neon: Neon Heights ----------

// A lattice of billboards on one pole, no words: a pink target and a cyan equaliser on the big one, a lime
// zigzag on the small one. The equaliser and the zigzag move between the two frames.
function billboardTower(frame: number): Vox {
  const k = K();
  const v = tile(2, 1, 66);
  v.box(12, 4, 0, 20, 12, 2, M.concrete);
  v.box(14, 6, 2, 18, 10, 64, M.steelD);
  for (let z = 4; z < 62; z += 4) v.box(14, 9, z, 18, 10, z + 1, M.steel);
  // the big panel (face y = 10)
  v.box(1, 8, 28, 31, 11, 46, k.frame);
  v.box(2, 10, 29, 30, 11, 45, k.panel);
  for (let z = 29; z < 45; z++)
    for (let x = 2; x < 30; x++) {
      const d = Math.hypot(x + 0.5 - 9, z + 0.5 - 37);
      if (Math.abs(d - 5.2) < 0.75 || d < 1.6) v.set(x, 10, z, M.pinkLit);
    }
  const bars = frame === 0 ? [8, 12, 5, 10, 7] : [11, 6, 13, 7, 10];
  bars.forEach((hgt, i) => v.box(17 + i * 3, 10, 31, 19 + i * 3, 11, 31 + hgt, i % 2 ? k.violetLit : M.cyanLit));
  v.box(30, 8, 29, 31, 11, 45, M.cyanLit); // lit edge on the side
  // catwalk and floodlights under it
  v.box(1, 11, 27, 31, 13, 28, M.steelD);
  for (const x of [5, 24]) v.box(x, 11, 28, x + 2, 12, 29, M.yellowLit);
  // the small panel
  v.box(5, 8, 48, 27, 11, 60, k.frame);
  v.box(6, 10, 49, 26, 11, 59, k.panel);
  for (let x = 7; x < 25; x++) {
    const p = (x + frame * 3) % 6;
    const z = 51 + (p < 3 ? p : 6 - p) * 2;
    v.box(x, 10, z, x + 1, 11, z + 2, M.limeLit);
  }
  v.box(6, 10, 49, 8, 11, 51, M.pinkLit);
  v.box(24, 10, 57, 26, 11, 59, M.pinkLit);
  v.box(15, 7, 64, 17, 9, 66, frame === 0 ? M.redLit : M.red);
  v.point('light', 16, 8, 66);
  return v;
}

// lit or dark window, decided per window
function litWindow(i: number, j: number, salt: number): number {
  const k = K();
  const h = hash(i, j, salt);
  if (h < 0.36) return k.warmLit;
  if (h < 0.43) return k.winCyan;
  if (h < 0.47) return k.winPink;
  return M.window;
}

// A tall slab of flats: a grid of windows, most of them lit at night, a pink neon edge on the front corner, a
// vertical sign blade of stacked lights (no words), shops at the foot, a water tank and an antenna on the roof.
function apartmentTall(frame: number): Vox {
  const k = K();
  const v = tile(2, 2, 98);
  const TOP = 84;
  v.box(3, 3, 0, 29, 29, TOP, k.tower);
  v.box(3, 28, 1, 28, 29, 6, M.cyanLit);
  v.box(28, 3, 1, 29, 28, 6, M.pinkLit);
  v.box(3, 28, 6, 29, 29, 7, k.towerD);
  v.box(28, 3, 6, 29, 29, 7, k.towerD);
  for (let f = 0; f < 13; f++) {
    const z = 8 + f * 6;
    v.paint(3, 28, z, 29, 29, z + 1, k.towerD);
    v.paint(28, 3, z, 29, 29, z + 1, k.towerD);
    for (let i = 0; i < 6; i++) {
      const x = 5 + i * 4;
      v.box(x, 28, z + 2, x + 2, 29, z + 5, litWindow(i, f, 7500));
      v.box(28, x, z + 2, 29, x + 2, z + 5, litWindow(i, f, 7510));
      if (hash(i, f, 7520) > 0.75) v.box(x, 29, z + 1, x + 2, 30, z + 2, M.steelL);
    }
  }
  v.box(28, 28, 7, 29, 29, TOP, M.pinkLit);
  // the sign blade on the +x side
  v.box(29, 18, 24, 31, 23, 70, k.frame);
  for (let s = 0; s < 9; s++) {
    const z = 27 + s * 5;
    v.box(30, 19, z, 31, 22, z + 3, [M.cyanLit, k.violetLit, M.pinkLit][s % 3]);
  }
  // roof
  v.box(3, 3, TOP, 29, 29, TOP + 1, k.towerD);
  v.box(4, 4, TOP + 1, 28, 28, TOP + 2, k.tower);
  for (const [x, y] of [
    [7, 7],
    [12, 7],
    [7, 12],
    [12, 12],
  ])
    v.box(x, y, TOP + 2, x + 1, y + 1, TOP + 5, M.steelD);
  v.cylZ(10, 10, 3.6, TOP + 5, TOP + 11, M.rust);
  v.cylZ(10, 10, 3.6, TOP + 10, TOP + 11, M.rustD);
  v.box(22, 22, TOP + 2, 23, 23, TOP + 12, M.steelL);
  v.box(20, 22, TOP + 8, 25, 23, TOP + 9, M.steelL);
  v.box(22, 22, TOP + 12, 23, 23, TOP + 14, frame === 0 ? M.redLit : M.red);
  v.point('light', 22, 22, TOP + 14);
  return v;
}

// A mid-rise block: purple-grey walls, air conditioners under the windows, a pink neon shop band with an awning,
// a neon ring (no words) on the roof.
function apartmentMid(): Vox {
  const k = K();
  const v = tile(2, 1, 72);
  const TOP = 52;
  v.box(2, 3, 0, 30, 14, TOP, k.block);
  v.box(2, 13, 1, 30, 14, 5, M.pinkLit);
  v.box(2, 14, 5, 30, 16, 6, M.purple);
  v.box(29, 3, 1, 30, 13, 5, M.cyanLit);
  for (let f = 0; f < 7; f++) {
    const z = 7 + f * 6;
    v.paint(2, 13, z, 30, 14, z + 1, k.blockD);
    v.paint(29, 3, z, 30, 14, z + 1, k.blockD);
    for (let i = 0; i < 7; i++) {
      const x = 3 + i * 4;
      v.box(x, 13, z + 2, x + 2, 14, z + 5, litWindow(i, f, 7600));
      if (hash(i, f, 7610) > 0.6) v.box(x, 14, z + 1, x + 2, 15, z + 2, M.steelL);
    }
    for (let i = 0; i < 2; i++) v.box(29, 5 + i * 4, z + 2, 30, 7 + i * 4, z + 5, litWindow(i, f, 7620));
  }
  v.box(2, 3, TOP, 30, 14, TOP + 1, k.blockD);
  // the ring on the roof
  for (const x of [9, 22]) v.box(x, 7, TOP + 1, x + 1, 9, TOP + 5, M.steelD);
  for (let z = TOP + 4; z < TOP + 18; z++)
    for (let x = 8; x < 25; x++) {
      const d = Math.hypot(x + 0.5 - 16, z + 0.5 - (TOP + 11));
      if (Math.abs(d - 5.6) < 0.8) v.set(x, 8, z, M.pinkLit);
      else if (d < 2) v.set(x, 8, z, M.limeLit);
    }
  return v;
}

// Two vending machines, glowing, and a bin.
function vending(): Vox {
  const k = K();
  const v = tile(1, 1, 11);
  v.box(1, 5, 0, 7, 11, 11, M.pinkD);
  v.box(2, 10, 4, 6, 11, 10, M.cyanLit);
  for (let z = 5; z < 10; z += 2) for (let x = 2; x < 6; x += 2) v.set(x, 10, z, M.white);
  v.box(2, 10, 1, 6, 11, 3, M.ink);
  v.box(8, 5, 0, 14, 11, 11, M.blueD);
  v.box(9, 10, 4, 13, 11, 10, M.yellowLit);
  for (let z = 5; z < 10; z += 2) for (let x = 9; x < 13; x += 2) v.set(x, 10, z, M.pinkD);
  v.box(9, 10, 1, 13, 11, 3, M.ink);
  v.box(1, 5, 10, 7, 11, 11, k.violetLit);
  v.cylZ(14.5, 13.5, 1.4, 0, 4, M.steel);
  return v;
}

// ---------- green: Greenvale ----------

// One slender white turbine: tower with a green foot, nacelle towards the front, three blades (green tips) in the
// rotor plane y = ry, turning 30° per frame.
function turbine(v: Vox, cx: number, cy: number, hub: number, len: number, ry: number, frame: number, phase: number): void {
  const k = K();
  v.cylZ(cx, cy, 3.2, 0, 2, M.concrete);
  v.cone(cx, cy, 2, hub, 2.1, 1.2, k.turbine);
  v.cylZ(cx, cy, 2.3, 2, 6, M.green);
  v.box(cx - 2, cy - 2, hub - 2, cx + 2, ry, hub + 2, k.turbine);
  v.box(cx - 2, cy - 2, hub + 1, cx + 2, ry, hub + 2, M.steelL);
  v.box(cx - 1, cy - 2, hub + 2, cx + 1, cy, hub + 3, frame < 2 ? M.redLit : M.red);
  v.point('light', cx, cy - 1, hub + 3);
  for (let b = 0; b < 3; b++) {
    const a = Math.PI / 2 + (frame * Math.PI) / 6 + phase + (b * 2 * Math.PI) / 3;
    const c = Math.cos(a);
    const s = Math.sin(a);
    for (let z = Math.floor(hub - len - 1); z < Math.ceil(hub + len + 1); z++)
      for (let x = 0; x < v.w; x++) {
        const dx = x + 0.5 - cx;
        const dz = z + 0.5 - hub;
        const t = dx * c + dz * s;
        const p = Math.abs(-dx * s + dz * c);
        if (t < 0.5 || t > len) continue;
        if (p > (t < 6 ? 1.2 : 0.75)) continue;
        v.set(x, ry, z, t > len - 3.2 ? M.green : k.turbine);
      }
  }
  v.box(cx - 1, ry, hub - 1, cx + 1, ry + 1, hub + 1, M.steelL);
  v.box(cx - 1, ry + 1, hub - 1, cx + 1, ry + 2, hub + 1, M.green);
}

function turbines(frame: number): Vox {
  const v = tile(2, 2, 88);
  // the tall one at the back, the short one in front: their rotors stay apart on screen
  turbine(v, 16, 5, 74, 12.5, 10, frame, 0);
  turbine(v, 18, 21, 40, 10, 27, frame, Math.PI / 4);
  return v;
}

// A glasshouse: white frame, glass walls and roof, plants pressed against the lower panes, grow lights that
// glow violet at night behind some panes, a water butt.
function greenhouse(): Vox {
  const k = K();
  const v = tile(2, 1, 18);
  v.box(1, 2, 0, 31, 14, 2, M.concreteL);
  v.box(2, 3, 2, 30, 13, 10, k.glass);
  v.paint(2, 3, 2, 30, 13, 5, k.glassPlant);
  for (let x = 2; x < 30; x += 4) if (hash(x, 0, 7700) > 0.4) v.paint(x + 1, 12, 5, x + 4, 13, 9, k.growLit);
  for (let y = 3; y < 13; y += 4) if (hash(y, 1, 7700) > 0.3) v.paint(29, y + 1, 5, 30, y + 4, 9, k.growLit);
  v.gable(2, 3, 30, 13, 10, 'x', k.glass);
  for (let x = 2; x <= 30; x += 4) {
    const xx = Math.min(29, x);
    v.paint(xx, 12, 2, xx + 1, 13, 10, M.white);
    v.paint(xx, 3, 10, xx + 1, 13, 18, M.white);
  }
  for (let y = 3; y <= 13; y += 4) v.paint(29, Math.min(12, y), 2, 30, Math.min(12, y) + 1, 10, M.white);
  v.paint(2, 12, 9, 30, 13, 10, M.white);
  v.paint(29, 3, 9, 30, 13, 10, M.white);
  v.paint(2, 12, 5, 30, 13, 6, M.white);
  v.paint(29, 3, 5, 30, 13, 6, M.white);
  v.paint(2, 7, 15, 30, 9, 16, M.white);
  // door on the +x end
  v.box(29, 6, 2, 30, 10, 9, M.white);
  v.box(29, 7, 2, 30, 9, 8, k.glass);
  // water butt
  v.cylZ(29.5, 14.5, 1.5, 0, 5, M.blueD);
  v.cylZ(29.5, 14.5, 1.5, 4, 5, M.blue);
  return v;
}

// A copse: a big round tree, a fresh spring-green one, two conifers and flowering bushes on a grassy mound.
function treeClump(): Vox {
  const k = K();
  const v = tile(2, 2, 36);
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      const d = Math.hypot(x + 0.5 - 16, y + 0.5 - 16);
      if (d < 14.5 + hash(x, y, 7800) * 1.5) v.set(x, y, 0, k.grass);
    }
  const trunk = (x: number, y: number, h: number) => v.box(x, y, 1, x + 2, y + 2, h, k.bark);
  // the big round tree
  trunk(10, 10, 14);
  balls(v, [[11, 11, 21, 6.5], [7.5, 13.5, 17, 4.5], [14.5, 7.5, 18, 4.5], [11, 11, 27, 4.5]], k.leaf, k.leafL, M.greenD);
  // conifers
  const pine = (cx: number, cy: number, s: number) => {
    v.box(Math.floor(cx), Math.floor(cy), 1, Math.floor(cx) + 1, Math.floor(cy) + 1, 5, k.bark);
    const z = (t: number) => 4 + Math.round(t * s);
    v.cone(cx, cy, 4, z(9), 5 * s, 2 * s, k.pine);
    v.cone(cx, cy, z(7), z(15), 3.8 * s, 1.4 * s, k.pine);
    v.cone(cx, cy, z(13), z(21), 2.6 * s, 0.6, k.pine);
    for (let z = 4; z < v.h; z++)
      for (let y = 0; y < 32; y++)
        for (let x = 0; x < 32; x++) {
          if (v.get(x, y, z) !== k.pine) continue;
          if (!v.get(x, y, z + 1)) v.set(x, y, z, k.pineL);
          else if (!v.get(x, y, z - 1)) v.set(x, y, z, k.pineD);
        }
  };
  pine(24.5, 8.5, 1.1);
  pine(7.5, 24.5, 0.8);
  // the spring tree
  trunk(21, 22, 9);
  balls(v, [[22, 23, 15, 5.2], [19, 25.5, 12, 3.6], [25, 20.5, 13, 3.6]], k.spring, k.springL, k.springD);
  // bushes with flowers
  balls(v, [[15, 27, 2.5, 3], [28, 15, 2.5, 2.6]], k.leaf, k.leafL, M.greenD, 2.2);
  for (const [x, y, z] of [
    [14, 26, 5],
    [16, 28, 4],
    [27, 14, 4],
    [29, 16, 3],
  ])
    v.set(x, y, z, M.pink);
  return v;
}

// A vegetable patch: ridged soil, cabbages, carrot tops, tomato canes, a watering can.
function vegPatch(): Vox {
  const k = K();
  const v = tile(1, 1, 8);
  v.box(1, 1, 0, 15, 15, 1, k.soil);
  for (const y of [2, 6, 10]) v.box(1, y, 1, 15, y + 3, 2, k.soil);
  for (let x = 2; x < 14; x += 3) {
    v.sphere(x + 1, 3.5, 2.8, 1.5, M.greenL, 0.8);
    v.set(x + 1, 3, 4, M.green);
  }
  for (let x = 2; x < 15; x += 2) {
    v.box(x, 7, 2, x + 1, 8, 4, M.green);
    v.set(x, 8, 2, M.orange);
  }
  for (let x = 3; x < 14; x += 4) {
    v.box(x, 11, 2, x + 1, 12, 7, k.wood);
    v.box(x - 1, 11, 4, x + 2, 12, 6, M.green);
    v.set(x + 1, 12, 4, M.red);
    v.set(x - 1, 12, 5, M.red);
  }
  v.box(13, 13, 1, 15, 15, 3, M.blue);
  v.box(12, 13, 2, 13, 14, 3, M.blue);
  return v;
}

// ---------- corp: 2PM Company Town ----------

// "2PM" in letters 7 rows tall (as on the Scrap Burner), drawn at scale s on the +y face with the iso shear
// cancelled in each glyph (as decor.ts isoText): each glyph needs s × its width / 2 voxels of room above zTop.
const LOGO = [
  ['.#.', '#.#', '..#', '.#.', '#..', '#..', '###'],
  ['##.', '#.#', '#.#', '##.', '#..', '#..', '#..'],
  ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
];
function logoY(v: Vox, x: number, y: number, zTop: number, s: number, m: number): number {
  let gx = x;
  for (const g of LOGO) {
    const w = g[0].length;
    for (let r = 0; r < 7; r++)
      for (let c = 0; c < w; c++) {
        if (g[r][c] !== '#') continue;
        for (let dx = 0; dx < s; dx++)
          for (let dz = 0; dz < s; dz++) {
            const px = gx + c * s + dx;
            const lift = Math.floor((px + y) / 2) - Math.floor((gx + y) / 2);
            v.set(px, y, zTop - r * s - dz + lift, m);
          }
      }
    gx += (w + 1) * s;
  }
  return gx - s - x;
}

// The 2PM headquarters tower: a glass curtain wall with white spandrels, offices lit at night, a lit lobby on a
// concrete podium, the pink 2PM crown on two sides, an antenna with a beacon.
function corpTower(frame: number): Vox {
  const k = K();
  const v = tile(2, 2, 126);
  const TOP = 104;
  v.box(2, 2, 0, 30, 30, 10, M.concrete);
  v.box(2, 29, 2, 30, 30, 8, k.lobbyLit);
  v.box(29, 2, 2, 30, 30, 8, k.lobbyLit);
  for (let x = 4; x < 30; x += 4) v.box(x, 29, 2, x + 1, 30, 8, M.steelL);
  for (let y = 4; y < 30; y += 4) v.box(29, y, 2, 30, y + 1, 8, M.steelL);
  v.box(2, 29, 8, 30, 30, 10, M.pink);
  v.box(29, 2, 8, 30, 30, 10, M.pink);
  v.box(6, 6, 10, 26, 26, TOP, k.curtain);
  for (let f = 0; f < 15; f++) {
    const z = 12 + f * 6;
    v.paint(6, 25, z, 26, 26, z + 1, k.spandrel);
    v.paint(25, 6, z, 26, 26, z + 1, k.spandrel);
    for (let i = 0; i < 5; i++) {
      const x = 6 + i * 4;
      if (hash(i, f, 7900) < 0.42) v.paint(x + 1, 25, z + 1, x + 4, 26, z + 6, k.officeLit);
      if (hash(i, f, 7910) < 0.42) v.paint(25, x + 1, z + 1, 26, x + 4, z + 6, k.officeLit);
    }
  }
  for (let x = 6; x <= 26; x += 4) v.paint(Math.min(25, x), 25, 10, Math.min(25, x) + 1, 26, TOP, M.steelL);
  for (let y = 6; y <= 26; y += 4) v.paint(25, Math.min(25, y), 10, 26, Math.min(25, y) + 1, TOP, M.steelL);
  // the crown: pink 2PM on both visible sides
  v.box(7, 7, TOP, 25, 25, TOP + 10, M.steelD);
  v.box(8, 24, TOP + 1, 24, 25, TOP + 10, M.pinkLit);
  isoText(v, '2PM', '+y', 8 + Math.floor((16 - textW('2PM')) / 2), 24, TOP + 7, k.whiteLit);
  v.box(24, 8, TOP + 1, 25, 24, TOP + 10, M.pinkLit);
  isoText(v, '2PM', '+x', 24, 23 - Math.floor((16 - textW('2PM')) / 2), TOP + 8, k.whiteLit);
  v.box(6, 6, TOP + 10, 26, 26, TOP + 11, M.steelL);
  v.box(15, 15, TOP + 11, 17, 17, TOP + 20, M.steelL);
  v.box(15, 15, TOP + 20, 17, 17, TOP + 22, frame === 0 ? M.redLit : M.red);
  v.point('light', 16, 16, TOP + 22);
  return v;
}

// A unipole billboard with the 2PM logo, big and white on pink, a cyan bar under it, backlit at night.
function corpBillboard(): Vox {
  const k = K();
  const v = tile(2, 1, 50);
  v.box(12, 4, 0, 20, 12, 2, M.concrete);
  v.cylZ(16, 8, 1.8, 2, 26, M.steel);
  v.box(1, 7, 25, 31, 10, 49, M.steelD);
  v.box(2, 9, 26, 30, 10, 48, M.pink);
  logoY(v, 3, 9, 42, 2, k.lightbox);
  v.box(3, 9, 27, 29, 10, 28, M.cyanLit);
  v.box(1, 10, 24, 31, 13, 25, M.steelD);
  for (const x of [5, 15, 25]) v.box(x, 11, 25, x + 2, 12, 26, M.yellowLit);
  return v;
}

// An office block: pale grey with ribbon windows (some offices lit), a lit lobby under a pink canopy, the 2PM
// plate at the top, plant on the roof.
function officeBlock(): Vox {
  const k = K();
  const v = tile(2, 1, 54);
  const TOP = 48;
  v.box(2, 2, 0, 30, 14, TOP, k.officeWall);
  v.box(2, 13, 1, 30, 14, 5, k.lobbyLit);
  v.box(29, 2, 1, 30, 13, 5, k.lobbyLit);
  v.box(11, 14, 5, 21, 16, 6, M.pink);
  for (let f = 0; f < 6; f++) {
    const z = 6 + f * 6;
    v.paint(2, 13, z + 1, 30, 14, z + 4, k.curtain);
    v.paint(29, 2, z + 1, 30, 14, z + 4, k.curtain);
    for (let i = 0; i < 7; i++) {
      const x = 2 + i * 4;
      if (hash(i, f, 7950) < 0.45) v.paint(x + 1, 13, z + 1, x + 4, 14, z + 4, k.officeLit);
      v.paint(x, 13, z + 1, x + 1, 14, z + 4, k.spandrel);
    }
    for (let i = 0; i < 3; i++) {
      const y = 2 + i * 4;
      if (hash(i, f, 7960) < 0.45) v.paint(29, y + 1, z + 1, 30, y + 4, z + 4, k.officeLit);
      v.paint(29, y, z + 1, 30, y + 1, z + 4, k.spandrel);
    }
  }
  v.box(16, 13, 42, 29, 14, 48, M.pink);
  isoText(v, '2PM', '+y', 17, 13, 46, M.white);
  v.box(2, 2, TOP, 30, 14, TOP + 1, M.concrete);
  v.box(5, 4, TOP + 1, 12, 10, TOP + 5, M.steel);
  v.cylZ(8.5, 7, 1.8, TOP + 5, TOP + 6, M.steelD);
  v.box(17, 5, TOP + 1, 22, 10, TOP + 4, M.steelL);
  return v;
}

// A 2PM delivery van: white, a pink band, cab at the front (+x).
function van(): Vox {
  const k = K();
  const v = tile(1, 1, 10);
  v.box(1, 4, 1, 15, 12, 9, k.van);
  v.clear(12, 4, 7, 15, 12, 9);
  v.clear(14, 4, 6, 15, 12, 7);
  v.box(14, 5, 4, 15, 11, 6, M.glass);
  v.box(12, 11, 4, 14, 12, 7, M.glass);
  v.paint(1, 11, 3, 12, 12, 5, M.pink);
  v.paint(1, 4, 8, 12, 12, 9, M.steelL);
  for (const x of [3.5, 12.5]) {
    v.cylY(x, 1.5, 1.6, 3, 13, M.ink);
    v.cylY(x, 1.5, 0.8, 12, 13, M.steelL);
  }
  v.box(14, 5, 2, 15, 6, 3, M.yellowLit);
  v.box(14, 10, 2, 15, 11, 3, M.yellowLit);
  return v;
}

export const THEME_SCENERY: Record<Theme, DecorArt[]> = {
  rust: [
    { name: 'harbour-crane', w: 3, d: 2, frames: 2, fps: 1, tall: true, model: harbourCrane },
    { name: 'ship-hull', w: 3, d: 2, frames: 1, fps: 1, tall: true, model: shipHull },
    { name: 'container-pile', w: 2, d: 2, frames: 1, fps: 1, tall: true, model: containerPile },
    { name: 'boat', w: 1, d: 1, frames: 1, fps: 1, tall: false, model: boat },
  ],
  neon: [
    { name: 'billboard-tower', w: 2, d: 1, frames: 2, fps: 2, tall: true, model: billboardTower },
    { name: 'apartment-tall', w: 2, d: 2, frames: 2, fps: 1, tall: true, model: apartmentTall },
    { name: 'apartment-mid', w: 2, d: 1, frames: 1, fps: 1, tall: true, model: apartmentMid },
    { name: 'vending', w: 1, d: 1, frames: 1, fps: 1, tall: false, model: vending },
  ],
  green: [
    { name: 'turbines', w: 2, d: 2, frames: 4, fps: 6, tall: true, model: turbines },
    { name: 'greenhouse', w: 2, d: 1, frames: 1, fps: 1, tall: true, model: greenhouse },
    { name: 'tree-clump', w: 2, d: 2, frames: 1, fps: 1, tall: true, model: treeClump },
    { name: 'veg-patch', w: 1, d: 1, frames: 1, fps: 1, tall: false, model: vegPatch },
  ],
  corp: [
    { name: 'corp-tower', w: 2, d: 2, frames: 2, fps: 1, tall: true, model: corpTower },
    { name: 'corp-billboard', w: 2, d: 1, frames: 1, fps: 1, tall: true, model: corpBillboard },
    { name: 'office-block', w: 2, d: 1, frames: 1, fps: 1, tall: true, model: officeBlock },
    { name: 'van', w: 1, d: 1, frames: 1, fps: 1, tall: false, model: van },
  ],
};
