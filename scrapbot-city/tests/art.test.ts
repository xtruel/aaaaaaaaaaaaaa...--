// The generated atlas: every building has all its frames, animations really move, and "off" looks different
// from "working". Reads src/assets/iso/atlas.png + atlas.json exactly as the game does.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '../src/game/defs';
import type { BuildingType } from '../src/game/defs';
import { decodePNG } from '../scripts/art/png';
import { mat, render } from '../scripts/art/voxel';
import type { Vox } from '../scripts/art/voxel';
import { dock } from '../scripts/art/models/dock';
import { fenceModel, gateModel } from '../scripts/art/models/pieces';
import { WALL_H, pillarPiece, wallPiece } from '../scripts/art/models/catalog-pieces';

const meta = JSON.parse(readFileSync(new URL('../src/assets/iso/atlas.json', import.meta.url), 'utf8')) as {
  w: number;
  h: number;
  frames: Record<string, [number, number, number, number, number, number]>;
  buildings: Record<BuildingType, { frames: number; fps: number; height: number; points: Record<string, [number, number][]> }>;
  variants: Record<string, { frames: number; fps: number; height: number; glow: boolean[]; points: Record<string, [number, number][]> }>;
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

// ---------- modular building, increment 1 (0.7): floor, fence, gate, lamp, Dock storage, Smelter filter ----------

const VARIANTS: [BuildingType, string][] = [
  ['dock', 'dock+dockStorage'],
  ['smelter', 'smelter+smelterFilter'],
];
const FENCE_SHAPES = ['x', 'y', ...Array.from({ length: 15 }, (_, k) => String(k + 1))];

function opaqueCount(name: string): number {
  const p = pixels(name);
  let k = 0;
  for (let i = 3; i < p.px.length; i += 4) if (p.px[i] > 0) k++;
  return k;
}

// changed pixels between two same-sized frames inside a box around (cx, cy), in frame pixels
function changedNear(a: string, b: string, cx: number, cy: number, rx: number, ry0: number, ry1: number): number {
  const A = pixels(a);
  const B = pixels(b);
  let n = 0;
  for (let y = Math.max(0, cy - ry0); y <= Math.min(A.h - 1, cy + ry1); y++)
    for (let x = Math.max(0, cx - rx); x <= Math.min(A.w - 1, cx + rx); x++) {
      const i = (y * A.w + x) * 4;
      if (Math.abs(A.px[i] - B.px[i]) + Math.abs(A.px[i + 1] - B.px[i + 1]) + Math.abs(A.px[i + 2] - B.px[i + 2]) + Math.abs(A.px[i + 3] - B.px[i + 3]) > 24) n++;
    }
  return n;
}

// Every frame of a building type (b/<type>/...: work, off, construction, icon, shadow and their glow frames),
// hashed with names, sizes and anchors.
function buildingHash(type: string): string {
  const h = createHash('sha256');
  for (const name of Object.keys(meta.frames)
    .filter((n) => n.startsWith(`b/${type}/`))
    .sort()) {
    const [, , w, hh, ax, ay] = meta.frames[name];
    h.update(`${name}:${w}x${hh}@${ax},${ay};`);
    h.update(pixels(name).px);
  }
  return h.digest('hex').slice(0, 16);
}

describe('modular building art (0.7, increment 1)', () => {
  it('every new frame exists', () => {
    const need: string[] = [];
    for (let k = 0; k < 4; k++) need.push(`t/floor/${k}`);
    for (const shape of FENCE_SHAPES) need.push(`pc/fence/${shape}`);
    for (const axis of ['x', 'y']) need.push(`pc/gate/${axis}`, `pc/gate/${axis}/g`);
    for (let dir = 0; dir < 4; dir++) need.push(`pc/lamp/${dir}`, `pc/lamp/${dir}/g`);
    for (const kind of ['floor', 'fence', 'gate', 'lamp']) need.push(`pc/${kind}/icon`);
    for (const kind of ['dockStorage', 'smelterFilter']) need.push(`mod/${kind}/icon`);
    for (const [type, variant] of VARIANTS) {
      const v = meta.variants[variant];
      expect(v, variant).toBeTruthy();
      expect(v.frames, variant).toBe(meta.buildings[type].frames);
      expect(v.fps, variant).toBe(meta.buildings[type].fps);
      for (let f = 0; f < v.frames; f++) {
        need.push(`b/${variant}/w${f}`);
        if (v.glow[f]) need.push(`b/${variant}/w${f}/g`);
      }
      need.push(`b/${variant}/off`);
    }
    for (const n of need) expect(meta.frames[n], n).toBeTruthy();
  });

  it('the fence has a frame for every neighbour mask, each one different, all lined up on the same tile', () => {
    const [, , w0, h0, ax0, ay0] = meta.frames['pc/fence/x'];
    const seen = new Map<string, string>();
    for (const shape of FENCE_SHAPES) {
      const name = `pc/fence/${shape}`;
      const [, , w, h, ax, ay] = meta.frames[name];
      expect([w, h, ax, ay], name).toEqual([w0, h0, ax0, ay0]);
      const digest = createHash('sha256').update(pixels(name).px).digest('hex');
      expect(seen.get(digest), `${name} looks like ${seen.get(digest)}`).toBeUndefined();
      seen.set(digest, name);
    }
  });

  it('building variants: work frames differ from each other and from off, and keep the plain building\'s frame', () => {
    for (const [type, variant] of VARIANTS) {
      const v = meta.variants[variant];
      for (let f = 0; f < v.frames; f++) {
        const next = (f + 1) % v.frames;
        expect(difference(`b/${variant}/w${f}`, `b/${variant}/w${next}`), `${variant} w${f} vs w${next}`).toBeGreaterThan(0.004);
        expect(difference(`b/${variant}/w${f}`, `b/${variant}/off`), `${variant} w${f} vs off`).toBeGreaterThan(0.002);
      }
      // same size and anchor as the plain building, so the renderer can swap one for the other
      for (const fr of ['w0', 'off']) expect(meta.frames[`b/${variant}/${fr}`].slice(2), `${variant} ${fr}`).toEqual(meta.frames[`b/${type}/${fr}`].slice(2));
      // and the module shows
      expect(difference(`b/${variant}/w0`, `b/${type}/w0`), variant).toBeGreaterThan(0.02);
      expect(difference(`b/${variant}/off`, `b/${type}/off`), variant).toBeGreaterThan(0.02);
    }
  });

  it("the Smelter's filter: steam point on the tower, no dark-smoke point, a fan that turns while working", () => {
    const v = meta.variants['smelter+smelterFilter'];
    expect(v.points.steam?.length).toBe(1);
    expect(v.points.smoke).toBeUndefined();
    expect(v.points.spark).toEqual(meta.buildings.smelter.points.spark);
    const [, , , , ax, ay] = meta.frames['b/smelter+smelterFilter/w0'];
    const [sx, sy] = v.points.steam[0];
    // the steam rises from the top of the tower, above the kiln and right of the chimney's smoke point
    expect(sy).toBeLessThan(-20);
    expect(sx).toBeGreaterThan(meta.buildings.smelter.points.smoke[0][0]);
    // the fan (just under the steam point) changes from each work frame to the next
    for (let f = 0; f < v.frames; f++) {
      const n = changedNear(`b/smelter+smelterFilter/w${f}`, `b/smelter+smelterFilter/w${(f + 1) % v.frames}`, ax + sx, ay + sy, 6, 1, 5);
      expect(n, `fan w${f}`).toBeGreaterThan(3);
    }
  });

  it('the plain buildings are pixel-identical to 0.6.1 (modules only draw when installed)', () => {
    // sha256 (first 16 hex) of every b/<type>/ frame: name, size, anchor and pixels, from the 0.6.1 atlas
    const expected: Record<BuildingType, string> = {
      hq: '1cd21b29af320cb6',
      dock: 'cb5b6c0d9dbe1d9f',
      recycler: 'a47bbb772c4a0f69',
      smelter: 'ef8faaa219c75487',
      solar: '541626872f33f429',
      burner: 'c4ed792caecef334',
      pods: 'c538d0d384fa6fa0',
      garden: 'c2cb1be7d5b64077',
      factory: '833b59b23b6273ab',
      fixlab: 'fd1a5a7309501479',
      purifier: 'f6a87b2c241d6a38',
      spire: 'a23746d945590539',
    };
    for (const type of TYPES) expect(buildingHash(type), type).toBe(expected[type]);
  });

  it('floor plates are flat ground tiles: same diamond and anchor as the ground, so they tile seamlessly', () => {
    const ground = pixels('t/ground/1/0');
    const [, , gw, gh, gax, gay] = meta.frames['t/ground/1/0'];
    for (let k = 0; k < 4; k++) {
      const name = `t/floor/${k}`;
      expect(meta.frames[name].slice(2), name).toEqual([gw, gh, gax, gay]);
      const p = pixels(name);
      for (let i = 3; i < p.px.length; i += 4) expect(p.px[i] > 0, `${name} alpha at ${(i - 3) / 4}`).toBe(ground.px[i] > 0);
      if (k > 0) expect(difference(name, 't/floor/0'), name).toBeGreaterThan(0.02);
    }
  });

  it("the Dock's storage silos never hide the bot face or the landing pad", () => {
    // Paint the face (the y = 12 slab of the control tower) and the pad (the roof deck x ≥ 13 and its markings) of
    // the plain model in a marker colour: the pixels that change are exactly where they show. Those pixels must be
    // the same in the model with the module as in the plain one.
    const MARK = mat('test-marker', { rgb: [255, 0, 255], jitter: 0 });
    const paint = (v: Vox, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): Vox => {
      for (let z = z0; z < z1; z++) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (v.get(x, y, z)) v.set(x, y, z, MARK);
      return v;
    };
    const regions: [string, number, number, number, number, number, number][] = [
      ['bot face', 5, 12, 18, 11, 13, 25],
      ['landing pad', 13, 11, 16, 29, 29, 18],
    ];
    for (const working of [true, false])
      for (let f = 0; f < 4; f++) {
        const plain = render(dock.model(f, working, [])).img.data;
        const withModule = render(dock.model(f, working, ['dockStorage'])).img.data;
        for (const [what, ...box] of regions) {
          const marked = render(paint(dock.model(f, working, []), ...box)).img.data;
          let shown = 0;
          let hidden = 0;
          for (let i = 0; i < plain.length; i += 4) {
            if (plain[i] === marked[i] && plain[i + 1] === marked[i + 1] && plain[i + 2] === marked[i + 2]) continue;
            shown++;
            // (the outline pass may shade an edge pixel by a step or two next to the module: not hidden)
            const delta = Math.abs(withModule[i] - plain[i]) + Math.abs(withModule[i + 1] - plain[i + 1]) + Math.abs(withModule[i + 2] - plain[i + 2]);
            if (delta > 24 || withModule[i + 3] !== plain[i + 3]) hidden++;
          }
          expect(shown, `${what} visible (working ${working}, frame ${f})`).toBeGreaterThan(20);
          expect(hidden, `${what} pixels changed by the module (working ${working}, frame ${f})`).toBe(0);
        }
      }
  });

  it('gates and lamps glow at night, and a lamp lights a pool of ground around it', () => {
    for (const name of ['pc/gate/x', 'pc/gate/y', 'pc/lamp/0', 'pc/lamp/1', 'pc/lamp/2', 'pc/lamp/3']) {
      // the glow frame is registered on the colour frame (same size, same anchor)
      expect(meta.frames[`${name}/g`].slice(2), name).toEqual(meta.frames[name].slice(2));
    }
    for (let dir = 0; dir < 4; dir++) {
      // the lens hangs ~19 voxels up (about 6 rows above the anchor even at the tile's front); glow lower down, on
      // the tile's ground rows, is the pool of light
      const name = `pc/lamp/${dir}/g`;
      const [, , , , , ay] = meta.frames[name];
      const p = pixels(name);
      let pool = 0;
      for (let y = ay + 2; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.px[(y * p.w + x) * 4 + 3] > 0) pool++;
      expect(pool, name).toBeGreaterThan(80);
      expect(opaqueCount(name), name).toBeGreaterThan(opaqueCount('p/lamp/x/g'));
    }
  });
});

// ---------- catalogue, increment 2 (0.7): six modules, nine decorations, three constructions ----------

const VARIANTS_2: [BuildingType, string, string][] = [
  ['recycler', 'recycler+recyclerMagnet', 'recyclerMagnet'],
  ['recycler', 'recycler+recyclerSorter', 'recyclerSorter'],
  ['factory', 'factory+factoryArm', 'factoryArm'],
  ['pods', 'pods+podsCapsule', 'podsCapsule'],
  ['solar', 'solar+solarTracker', 'solarTracker'],
  ['purifier', 'purifier+purifierNozzle', 'purifierNozzle'],
];
const DIRS4 = [0, 1, 2, 3];
const MASKS = Array.from({ length: 15 }, (_, k) => String(k + 1));
const PIECE_KINDS_2 = ['bench', 'planter', 'sign', 'pergola', 'cathouse', 'sculpture', 'tree', 'fountain', 'statue', 'base', 'wall', 'pillar'];

// Every decoration and construction frame of increment 2, by kind (without /g and /shadow).
function pieceFrames2(): Record<string, string[]> {
  return {
    bench: DIRS4.map((d) => `pc/bench/${d}`),
    planter: [0, 1].map((k) => `pc/planter/${k}`),
    sign: [0, 1, 2].flatMap((m) => DIRS4.map((d) => `pc/sign/${m}/${d}`)),
    pergola: ['pc/pergola/x', 'pc/pergola/y'],
    cathouse: DIRS4.map((d) => `pc/cathouse/${d}`),
    sculpture: DIRS4.map((d) => `pc/sculpture/${d}`),
    tree: [0, 1, 2].map((k) => `pc/tree/${k}`),
    fountain: DIRS4.map((f) => `pc/fountain/${f}`),
    statue: DIRS4.map((d) => `pc/statue/${d}`),
    wall: ['x', 'y', ...MASKS].map((m) => `pc/wall/${m}`),
    pillar: ['0', ...MASKS].map((m) => `pc/pillar/${m}`),
  };
}

const sha = (name: string) => createHash('sha256').update(pixels(name).px).digest('hex');

// Pixels where a variant's frame differs from the plain building's, over all its work frames and off: the module.
function moduleMask(type: string, variant: string): Uint8Array {
  const v = meta.variants[variant];
  const names = [...Array.from({ length: v.frames }, (_, f) => `w${f}`), 'off'];
  const first = pixels(`b/${type}/off`);
  const mask = new Uint8Array(first.w * first.h);
  for (const n of names) {
    const A = pixels(`b/${type}/${n}`);
    const B = pixels(`b/${variant}/${n}`);
    for (let i = 0; i < mask.length; i++) {
      const o = i * 4;
      if (Math.abs(A.px[o] - B.px[o]) + Math.abs(A.px[o + 1] - B.px[o + 1]) + Math.abs(A.px[o + 2] - B.px[o + 2]) + Math.abs(A.px[o + 3] - B.px[o + 3]) > 24) mask[i] = 1;
    }
  }
  return mask;
}
function changedIn(mask: Uint8Array, a: string, b: string): number {
  const A = pixels(a);
  const B = pixels(b);
  let n = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const o = i * 4;
    if (Math.abs(A.px[o] - B.px[o]) + Math.abs(A.px[o + 1] - B.px[o + 1]) + Math.abs(A.px[o + 2] - B.px[o + 2]) + Math.abs(A.px[o + 3] - B.px[o + 3]) > 24) n++;
  }
  return n;
}

describe('catalogue art, increment 2 (0.7)', () => {
  it('every frame of 0.7.0-alpha.1 is unchanged (names, sizes, anchors, pixels)', () => {
    // the frames this increment adds; everything else is the 0.7.0-alpha.1 atlas
    const isNew = (n: string) =>
      /^b\/[a-z]+\+(recyclerMagnet|recyclerSorter|factoryArm|podsCapsule|solarTracker|purifierNozzle)\//.test(n) ||
      /^mod\/(recyclerMagnet|recyclerSorter|factoryArm|podsCapsule|solarTracker|purifierNozzle)\//.test(n) ||
      /^pc\/(bench|planter|sign|pergola|cathouse|sculpture|tree|fountain|statue|base|wall|pillar)\//.test(n) ||
      n.startsWith('t/base/');
    const h = createHash('sha256');
    const old = Object.keys(meta.frames)
      .filter((n) => !isNew(n))
      .sort();
    for (const name of old) {
      const [, , w, hh, ax, ay] = meta.frames[name];
      h.update(`${name}:${w}x${hh}@${ax},${ay};`);
      h.update(pixels(name).px);
    }
    // 574 frames; sha256 (first 16 hex) computed the same way on the 0.7.0-alpha.1 atlas (commit db5a4ed)
    expect(old.length).toBe(574);
    expect(h.digest('hex').slice(0, 16)).toBe('8d997167023092ba');
  });

  it('every new frame exists', () => {
    const need: string[] = [];
    for (const list of Object.values(pieceFrames2())) for (const n of list) need.push(n, `${n}/shadow`);
    for (let k = 0; k < 4; k++) need.push(`t/base/${k}`);
    for (const m of [0, 1, 2]) for (const d of DIRS4) need.push(`pc/sign/${m}/${d}/g`);
    for (const m of ['0', ...MASKS]) need.push(`pc/pillar/${m}/g`);
    for (const kind of PIECE_KINDS_2) need.push(`pc/${kind}/icon`);
    for (const [type, variant, kind] of VARIANTS_2) {
      need.push(`mod/${kind}/icon`, `b/${variant}/off`, `b/${variant}/shadow`);
      const v = meta.variants[variant];
      expect(v, variant).toBeTruthy();
      expect(v.frames, variant).toBe(meta.buildings[type].frames);
      expect(v.fps, variant).toBe(meta.buildings[type].fps);
      for (let f = 0; f < v.frames; f++) {
        need.push(`b/${variant}/w${f}`);
        if (v.glow[f]) need.push(`b/${variant}/w${f}/g`);
      }
      if (v.glow[v.frames]) need.push(`b/${variant}/off/g`);
    }
    for (const n of need) expect(meta.frames[n], n).toBeTruthy();
  });

  it('module variants keep the plain building\'s frame size and anchor, and the module shows', () => {
    for (const [type, variant] of VARIANTS_2) {
      const v = meta.variants[variant];
      for (const fr of [...Array.from({ length: v.frames }, (_, f) => `w${f}`), 'off']) {
        expect(meta.frames[`b/${variant}/${fr}`].slice(2), `${variant} ${fr}`).toEqual(meta.frames[`b/${type}/${fr}`].slice(2));
        const g = meta.frames[`b/${variant}/${fr}/g`];
        if (g) expect(g.slice(2), `${variant} ${fr}/g`).toEqual(meta.frames[`b/${variant}/${fr}`].slice(2));
      }
      expect(difference(`b/${variant}/w0`, `b/${type}/w0`), variant).toBeGreaterThan(0.02);
      expect(difference(`b/${variant}/off`, `b/${type}/off`), variant).toBeGreaterThan(0.02);
    }
  });

  it('module work frames differ from off, and the moving modules move from frame to frame', () => {
    const report: string[] = [];
    for (const [type, variant, kind] of VARIANTS_2) {
      const v = meta.variants[variant];
      const mask = moduleMask(type, variant);
      let area = 0;
      for (const m of mask) area += m;
      expect(area, `${variant} module area`).toBeGreaterThan(60);
      for (let f = 0; f < v.frames; f++) {
        const off = changedIn(mask, `b/${variant}/w${f}`, `b/${variant}/off`);
        expect(off, `${variant} w${f} vs off`).toBeGreaterThan(3);
        if (kind === 'podsCapsule') continue; // the capsule has no motion: its windows are lit while working
        const next = changedIn(mask, `b/${variant}/w${f}`, `b/${variant}/w${(f + 1) % v.frames}`);
        report.push(`${variant} w${f}->w${(f + 1) % v.frames}: ${next} px in the module`);
        expect(next, `${variant} w${f} vs w${(f + 1) % v.frames}`).toBeGreaterThan(4);
      }
    }
    console.log(report.join('\n'));
  });

  it('variant points: the base building\'s points stay, the double arm adds a smoke point, the nozzle a mist point', () => {
    const base = meta.buildings;
    expect(meta.variants['recycler+recyclerMagnet'].points).toEqual(base.recycler.points);
    expect(meta.variants['recycler+recyclerSorter'].points).toEqual(base.recycler.points);
    expect(meta.variants['pods+podsCapsule'].points).toEqual(base.pods.points);
    expect(meta.variants['solar+solarTracker'].points).toEqual(base.solar.points);
    const fa = meta.variants['factory+factoryArm'].points;
    expect(fa.smoke.length).toBe(base.factory.points.smoke.length + 1);
    expect(fa.smoke[0]).toEqual(base.factory.points.smoke[0]);
    expect(fa.light).toEqual(base.factory.points.light);
    expect(fa.spark).toEqual(base.factory.points.spark);
    const pn = meta.variants['purifier+purifierNozzle'].points;
    expect(pn.light).toEqual(base.purifier.points.light);
    expect(pn.mist?.length).toBe(1);
    // the mist point is the spray head at the far end of the boom, left of the tall tank and high up
    expect(pn.mist[0][0]).toBeLessThan(-15);
    expect(pn.mist[0][1]).toBeLessThan(-15);
  });

  it('decorations: a distinct frame for each direction or variety, a shadow, glow where something is lit', () => {
    for (const [kind, list] of Object.entries(pieceFrames2())) {
      const seen = new Map<string, string>();
      const [, , w0, h0, ax0, ay0] = meta.frames[list[0]];
      for (const n of list) {
        const d = sha(n);
        expect(seen.get(d), `${n} looks like ${seen.get(d)}`).toBeUndefined();
        seen.set(d, n);
        // every frame of a kind is registered on the same tile the same way
        if (kind !== 'sign' || n.split('/')[2] === list[0].split('/')[2]) expect(meta.frames[n].slice(2), n).toEqual([w0, h0, ax0, ay0]);
        const g = meta.frames[`${n}/g`];
        if (g) expect(g.slice(2), `${n}/g`).toEqual(meta.frames[n].slice(2));
      }
    }
    // the fountain's still frame (0) and its jet animation (1..3)
    for (let f = 1; f < 4; f++) expect(difference('pc/fountain/0', `pc/fountain/${f}`), `fountain ${f}`).toBeGreaterThan(0.03);
    // lit: the neon signs and the pillars' lamps glow at night (their glow frame has light in it)
    for (const n of ['pc/sign/0/1', 'pc/sign/1/1', 'pc/sign/2/1', 'pc/pillar/0', 'pc/pillar/15']) expect(opaqueCount(`${n}/g`), n).toBeGreaterThan(20);
  });

  it('no piece sprite, glow or shadow reaches 64 px from its tile (the renderer culls pieces by that distance)', () => {
    for (const [name, [, , w, h, ax, ay]] of Object.entries(meta.frames)) {
      if (!name.startsWith('pc/') || name.endsWith('/icon')) continue;
      expect(Math.max(ax, w - ax, ay, h - ay), name).toBeLessThan(64);
    }
  });

  it('catalogue icons fit the 64×44 picture box at 1×', () => {
    for (const kind of PIECE_KINDS_2) {
      const [, , w, h] = meta.frames[`pc/${kind}/icon`];
      expect(w <= 64 && h <= 44, `${kind} ${w}×${h}`).toBe(true);
    }
    for (const [, , kind] of VARIANTS_2) {
      const [, , w, h] = meta.frames[`mod/${kind}/icon`];
      expect(w <= 64 && h <= 44, `${kind} ${w}×${h}`).toBe(true);
    }
  });

  it('concrete base slabs are ground tiles like the floor, and look unlike it', () => {
    const ground = pixels('t/ground/1/0');
    const [, , gw, gh, gax, gay] = meta.frames['t/ground/1/0'];
    for (let k = 0; k < 4; k++) {
      const name = `t/base/${k}`;
      expect(meta.frames[name].slice(2), name).toEqual([gw, gh, gax, gay]);
      const p = pixels(name);
      for (let i = 3; i < p.px.length; i += 4) expect(p.px[i] > 0, `${name} alpha at ${(i - 3) / 4}`).toBe(ground.px[i] > 0);
      expect(difference(name, `t/floor/${k}`), name).toBeGreaterThan(0.5);
      if (k > 0) expect(difference(name, 't/base/0'), name).toBeGreaterThan(0.02);
    }
  });

  it('walls and pillars have a frame for every mask, all lined up with the fence', () => {
    for (const kind of ['wall', 'pillar', 'fence']) {
      const shapes = kind === 'pillar' ? ['0', ...MASKS] : ['x', 'y', ...MASKS];
      const [, , w0, h0, ax0, ay0] = meta.frames[`pc/${kind}/${shapes[0]}`];
      const seen = new Map<string, string>();
      for (const s of shapes) {
        const name = `pc/${kind}/${s}`;
        expect(meta.frames[name].slice(2), name).toEqual([w0, h0, ax0, ay0]);
        const d = sha(name);
        expect(seen.get(d), `${name} looks like ${seen.get(d)}`).toBeUndefined();
        seen.set(d, name);
      }
      // the same anchor as the fence: all of them stand on the tile the same way
      expect(ax0, kind).toBe(meta.frames['pc/fence/x'][4]);
    }
  });

  it('walls, pillars, fences and gates meet on the same line at every tile edge', () => {
    // the cross-section each piece shows on a tile edge it joins: walls and pillars span 6..10 across the line, the
    // fence's panel (8) and the gate's pillars (6..11) lie on it; heights: wall ≥ 6, pillar stub = wall height 7
    const section = (v: Vox, edge: 'n' | 'e' | 's' | 'w') => {
      const across: number[] = [];
      let top = 0;
      for (let t = 0; t < 16; t++)
        for (let z = 0; z < v.h; z++) {
          const [x, y] = edge === 'e' ? [15, t] : edge === 'w' ? [0, t] : edge === 's' ? [t, 15] : [t, 0];
          if (v.get(x, y, z)) {
            if (!across.includes(t)) across.push(t);
            top = Math.max(top, z + 1);
          }
        }
      return { lo: Math.min(...across), hi: Math.max(...across) + 1, top };
    };
    const bit = { n: 1, e: 2, s: 4, w: 8 } as const;
    for (const edge of ['n', 'e', 's', 'w'] as const)
      for (let mask = 1; mask < 16; mask++) {
        if (!(mask & bit[edge])) continue;
        const wall = section(wallPiece(mask), edge);
        const pillar = section(pillarPiece(mask), edge);
        const fence = section(fenceModel(mask), edge);
        expect([wall.lo, wall.hi], `wall ${mask} ${edge}`).toEqual([6, 10]);
        expect([pillar.lo, pillar.hi], `pillar ${mask} ${edge}`).toEqual([6, 10]);
        expect(pillar.top, `pillar ${mask} ${edge}`).toBe(WALL_H);
        expect(wall.top, `wall ${mask} ${edge}`).toBeGreaterThanOrEqual(6);
        expect(fence.lo >= 6 && fence.hi <= 10, `fence ${mask} ${edge} ${fence.lo}..${fence.hi}`).toBe(true);
      }
    // gates: along x they meet their neighbours on the E and W edges, along y on N and S
    for (const [axis, edges] of [
      ['x', ['e', 'w']],
      ['y', ['n', 's']],
    ] as const)
      for (const edge of edges) {
        const gate = section(gateModel(axis), edge);
        expect(gate.lo >= 6 && gate.hi <= 11 && gate.lo <= 8 && gate.hi > 8, `gate ${axis} ${edge} ${gate.lo}..${gate.hi}`).toBe(true);
      }
    // isolated walls run along their rotation
    expect(section(wallPiece('x'), 'e').lo).toBe(6);
    expect(section(wallPiece('y'), 's').lo).toBe(6);
  });
});
