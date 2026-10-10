// Ground props drawn into the terrain layer: junk heaps (3 sizes) and rubble.
import { M } from '../palette';
import { Vox, hex, mat } from '../voxel';
import { hash } from './common';

const HEAP = mat('heap', { rgb: hex('#4a3d55'), jitter: 0.1 });
const HEAP_D = mat('heapD', { rgb: hex('#362c42'), jitter: 0.08 });
const CRT = mat('crt', { rgb: hex('#a9a3b8'), jitter: 0.03 });
const SHEET = mat('sheet', { rgb: hex('#b9b4cc'), jitter: 0.05 });
const SCRAP = [M.rust, M.rustD, M.steel, M.steelL, SHEET, M.pinkD, M.purple, M.rust, M.yellow, M.cyanD, M.orange, M.blue];

// Junk heaps the bots collect: bigger and brighter with more scrap left in them.
export function junkModel(size: number, variant: number): Vox {
  const v = new Vox(16, 16, 14);
  const r = (k: number) => hash(variant * 31 + k, size * 17 + 3, 4000 + k);
  const radius = [4.6, 6, 7.4][size];
  const peak = [2, 4, 6][size];
  // the mound, a little lopsided
  const ox = 8 + (r(90) - 0.5) * 1.2;
  const oy = 8 + (r(91) - 0.5) * 1.2;
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x + 0.5 - ox, y + 0.5 - oy) / radius;
      if (d >= 1) continue;
      const h = Math.max(1, Math.round(peak * (1 - d * d) + (r(x * 16 + y) - 0.5) * 1.2));
      for (let z = 0; z < h; z++) v.set(x, y, z, z === 0 ? HEAP_D : HEAP);
    }
  const height = (x: number, y: number) => {
    let z = 0;
    while (z < v.h && v.get(x, y, z)) z++;
    return z;
  };
  // scrap on the surface: plates, bars, crates, barrels, bright bits
  const n = [5, 10, 15][size];
  for (let k = 0; k < n; k++) {
    const a = r(k) * Math.PI * 2;
    const dist = r(k + 20) * radius * 0.85;
    const x = Math.round(ox + Math.cos(a) * dist);
    const y = Math.round(oy + Math.sin(a) * dist);
    const z = Math.max(0, height(x, y) - 1);
    const m = SCRAP[Math.floor(r(k + 40) * SCRAP.length)];
    const kind = r(k + 60);
    if (kind < 0.3) v.box(x - 1, y - 1, z, x + 1 + (k % 2), y + 1, z + 2, m);
    else if (kind < 0.45) v.box(x - 2, y, z, x + 2, y + 2, z + 1, SHEET);
    else if (kind < 0.58) v.box(x, y - 2, z, x + 1, y + 3, z + 1, M.steelL);
    else if (kind < 0.7 && size > 0) v.cylZ(x + 0.5, y + 0.5, 1.5, z, z + 3, k % 2 ? M.rust : M.blue);
    else if (kind < 0.8 && size > 0) v.box(x - 1, y - 1, z, x + 2, y + 2, z + 3, M.rustD);
    else v.box(x, y, z, x + 1, y + 1, z + 1, [M.pink, M.limeLit, M.cyanLit, M.yellow][k % 4]);
  }
  // big heaps get a landmark: an old monitor or a tyre
  if (size === 2) {
    if (variant % 2 === 0) {
      const z = height(8, 9) - 1;
      v.box(6, 8, z, 11, 11, z + 4, CRT);
      v.box(7, 10, z + 1, 10, 11, z + 3, M.ink);
      v.set(8, 10, z + 2, M.limeLit);
    } else {
      const z = height(9, 7);
      v.cylZ(9, 7, 2.6, Math.max(0, z - 1), z + 1, M.ink, 1.2);
    }
  }
  return v;
}

export function rubbleModel(variant: number): Vox {
  const v = new Vox(16, 16, 9);
  const r = (k: number) => hash(variant * 13 + k, 7, 4500 + k);
  // broken slabs, tilted by stacking, with rebar sticking out
  const blocks = 3 + Math.floor(r(1) * 3);
  for (let k = 0; k < blocks; k++) {
    const x = 1 + Math.floor(r(k + 10) * 9);
    const y = 1 + Math.floor(r(k + 20) * 9);
    const w = 4 + Math.floor(r(k + 30) * 4);
    const d = 3 + Math.floor(r(k + 40) * 3);
    const h = 2 + Math.floor(r(k + 50) * 3);
    v.box(x, y, 0, Math.min(15, x + w), Math.min(15, y + d), h, k % 2 ? M.concrete : M.concreteL);
    v.box(x, y, h - 1, Math.min(15, x + w), y + 1, h, M.concrete);
    if (r(k + 60) > 0.4) v.box(x + 1, y + 1, h, x + 2, y + 2, h + 3, M.rust);
  }
  for (let k = 0; k < 6; k++) v.set(Math.floor(r(k + 70) * 15), Math.floor(r(k + 80) * 15), 0, M.concreteL);
  return v;
}

// Street lamps on the curbs of the old streets ('x' = street along x, lamp on its front curb; 'y' = along y).
// They stand on buildable tiles: the game hides one as soon as a building covers its tile.
export function lampModel(axis: 'x' | 'y'): Vox {
  const v = new Vox(16, 16, 24);
  const [px, py] = axis === 'x' ? [3, 14] : [14, 3];
  v.box(px - 1, py - 1, 0, px + 2, py + 2, 1, M.steelD); // foot
  v.box(px, py, 1, px + 1, py + 1, 20, M.steel);
  // arm over the street and the lamp head
  if (axis === 'x') {
    v.box(px, py - 4, 19, px + 1, py, 20, M.steel);
    v.box(px - 1, py - 6, 18, px + 2, py - 3, 19, M.steelD);
    v.box(px, py - 5, 17, px + 1, py - 4, 18, M.yellowLit);
  } else {
    v.box(px - 4, py, 19, px, py + 1, 20, M.steel);
    v.box(px - 6, py - 1, 18, px - 3, py + 2, 19, M.steelD);
    v.box(px - 5, py, 17, px - 4, py + 1, 18, M.yellowLit);
  }
  // a pink 2PM banner on every lamp
  v.box(axis === 'x' ? px + 1 : px, axis === 'x' ? py : py + 1, 10, axis === 'x' ? px + 2 : px + 1, axis === 'x' ? py + 1 : py + 2, 15, M.pink);
  return v;
}
