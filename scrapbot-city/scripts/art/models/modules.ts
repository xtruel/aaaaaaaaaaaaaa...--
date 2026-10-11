// Building modules (0.7, increment 1): extra parts bolted onto a finished building. The building's own model
// calls these after drawing itself, only when the module is installed, so a building without modules keeps
// exactly the voxels (and pixels) it always had.
//   dockStorage   two scrap silos on the free front-left part of the Bot Dock's hangar roof
//   smelterFilter a scrubber tower beside the Smelter's chimney, piped to it, with a fan and a green light
import { M } from '../palette';
import { Vox, hex, mat } from '../voxel';
import { hazardBand, tank } from './common';

export type ModuleName = 'dockStorage' | 'smelterFilter';

// The atlas name of a building with modules: its type and the modules, sorted, joined by '+' (dock+dockStorage).
export function variantName(type: string, modules: readonly string[]): string {
  return [type, ...[...modules].sort()].join('+');
}

export function hasModule(modules: readonly string[] | undefined, kind: ModuleName): boolean {
  return !!modules && modules.includes(kind);
}

// Materials of the modules, registered on first use: registering them at import time would shift the ids (and so
// the per-voxel brightness noise) of every material registered after this file, changing older sprites.
let mats: { greenLit: number; greenOff: number; scrap: number; scrapL: number; silo: number; siloD: number } | null = null;
export function moduleMats() {
  mats ??= {
    greenLit: mat('module-green-lit', { rgb: hex('#5cf06e'), emit: 1, glow: hex('#3fdc5a'), jitter: 0 }),
    greenOff: mat('module-green-off', { rgb: hex('#1f4a2a'), jitter: 0 }),
    scrap: mat('module-scrap', { rgb: hex('#8a5a3c'), jitter: 0.12 }),
    scrapL: mat('module-scrapL', { rgb: hex('#b9b4cc'), jitter: 0.1 }),
    silo: mat('module-silo', { rgb: hex('#f29a45'), jitter: 0.03 }),
    siloD: mat('module-siloD', { rgb: hex('#a8562a'), jitter: 0.03 }),
  };
  return mats;
}

// ---------- Bot Dock: extra storage ----------
// The hangar roof is at z 16; the landing pad covers x ≥ 13 and the control tower x 4..12, y 4..12, whose bot face
// looks out of its y = 12 side. The two silos stand side by side (as seen from the camera) on a steel saddle on the
// free front-left part of the roof, every voxel above the roof with x − y ≤ −9 so that they stay left of the bot
// face (tests/art.test.ts checks that the face and the pad stay fully visible). They are round tanks, 6 voxels
// across with the corners cut, in a warm orange that stands out on the blue hangar, with hazard stripes round the
// foot. Their centres sit on voxel corners (whole numbers): a centre in the middle of a voxel leaves a lone voxel at
// exactly r on each side, a one-voxel ridge up the whole silo that reads as dark streaks. Their load goes down a
// chute into a roof hatch beside the pad and a downpipe along the front-left wall by the garage door.
const SILOS = [
  { x: 7, y: 21, top: 29 }, // the tall one, with the hopper the bots fill
  { x: 5, y: 27, top: 26 },
];
const SILO_R = 3;

export function dockStorage(v: Vox, frame: number, working: boolean): void {
  const P = moduleMats();
  // saddle bolted to the roof, with a hazard edge over the front wall
  v.box(3, 17, 16, 12, 30, 17, M.steelD);
  hazardBand(v, 3, 29, 16, 12, 30, 17);
  for (const { x: cx, y: cy, top } of SILOS) {
    tank(v, cx, cy, SILO_R, 17, top, P.silo, -1, 2);
    // hazard stripes round the foot
    for (let z = 17; z < 19; z++)
      for (let y = Math.floor(cy - 4); y <= Math.ceil(cy + 4); y++)
        for (let x = Math.floor(cx - 4); x <= Math.ceil(cx + 4); x++)
          if (v.get(x, y, z) === P.silo) v.set(x, y, z, Math.floor((x + y + z) / 2) % 2 ? M.hazardK : M.hazardY);
    tank(v, cx, cy, SILO_R + 0.2, top - 3, top - 2, P.siloD); // seam band
    tank(v, cx, cy, SILO_R - 0.8, top, top + 1, M.steel); // shoulder
  }
  // the hopper on the tall silo: a funnel heaped with scrap
  const [a, b] = SILOS;
  v.cylZ(a.x, a.y, 1.5, a.top + 1, a.top + 2, M.steelD);
  v.cylZ(a.x, a.y, 2.9, a.top + 2, a.top + 4, M.steel, 1.8);
  v.cylZ(a.x, a.y, 1.9, a.top + 2, a.top + 3, P.scrap);
  for (let k = 0; k < 5; k++) {
    const ang = k * 1.3 + 0.4;
    v.set(Math.floor(a.x + Math.cos(ang) * 1.1), Math.floor(a.y + Math.sin(ang) * 1.1), a.top + 3, k % 3 === 0 ? P.scrapL : k % 3 === 1 ? M.rust : M.yellow);
  }
  // the squat silo: a lid with a hatch, and a level gauge on its front that rises while the Dock works
  v.cylZ(b.x, b.y, 1.4, b.top + 1, b.top + 2, M.steelD);
  const gy = Math.floor(b.y + SILO_R) - 1;
  v.box(3, gy, 19, 6, gy + 1, 25, M.ink);
  const level = working ? 1 + (frame % 4) : 2;
  v.box(4, gy, 20, 5, gy + 1, 20 + level, working ? M.limeLit : M.limeD);
  // pipe between the silos
  v.box(7, 24, 22, 8, 26, 23, M.steelL);
  // chute from the tall silo into a roof hatch beside the pad (a voxel of bare roof between the hatch and the pad's
  // deck, which starts at x = 13)
  v.cylX(a.y + 0.5, 21.5, 1.0, 10, 12, M.steelL);
  v.box(10, 20, 16, 12, 24, 18, M.steelD);
  v.box(10, 21, 18, 12, 23, 19, M.steel);
  // downpipe along the front-left wall, left of the garage door, into the hangar
  v.cylZ(3.5, 29.5, 0.9, 4, 17, M.steelL);
  v.box(3, 29, 7, 4, 31, 8, M.steelD);
  v.box(3, 29, 12, 4, 31, 13, M.steelD);
  v.box(2, 29, 3, 5, 31, 5, M.steelD); // its foot on the plate
  // beacon on the hopper rim
  v.box(Math.floor(a.x) - 3, Math.floor(a.y) - 1, a.top + 4, Math.floor(a.x) - 2, Math.floor(a.y), a.top + 6, working && frame % 2 === 0 ? M.limeLit : M.limeD);
}

// ---------- Smelter: smoke filter ----------
// The chimney stands at (11, 7) on the furnace block (roof at z 31, lip to x 21). The scrubber tower stands right
// of it at (20.5, 7) on a steel deck that rests on the furnace lip and is braced against the furnace wall. Two
// pipes carry the smoke into it: one leaves the chimney's front and runs along the tower's front, one goes straight
// across behind. White with a cyan filter band like the Purifier (clean air), a two-blade fan in a housing on top
// that turns (45° a frame) only while the Smelter works, and a green light that is lit while the filter works. The
// 'steam' point sits on the fan; the chimney's 'smoke' point is dropped (its smoke goes through the filter).
export const FILTER_TOWER = { x: 20.5, y: 7, top: 45 };

export function smelterFilter(v: Vox, frame: number, working: boolean): void {
  const P = moduleMats();
  const { x: tx, y: ty } = FILTER_TOWER;
  // deck and braces
  v.box(15, 2, 29, 26, 12, 31, M.steelD);
  v.box(16, 3, 30, 25, 11, 31, M.steel);
  hazardBand(v, 15, 11, 29, 26, 12, 30);
  hazardBand(v, 25, 2, 29, 26, 12, 30);
  for (const by of [3, 10])
    for (let k = 0; k < 6; k++) v.box(20 + Math.floor(k / 1.5), by, 23 + k, 21 + Math.floor(k / 1.5), by + 1, 24 + k, M.steelD);
  // the tower: a white rounded column (flat faces, like the Purifier's tanks) with a dark foot and a cyan filter
  // band, lit while the filter works; a service hatch on the front-left side
  const top = FILTER_TOWER.top;
  tank(v, tx, ty, 3.9, 31, 33, M.steelD);
  tank(v, tx, ty, 3.4, 33, top - 2, M.white);
  tank(v, tx, ty, 3.6, 35, 37, working ? M.cyanLit : M.cyanD);
  v.box(22, 9, 32, 24, 11, 35, M.steelD);
  // the fan: a wide housing on top, a dark well, two white blades that turn 45° a frame while the Smelter works
  // (the propeller's pattern repeats every 4 frames) and stand still when it does not
  tank(v, tx, ty, 4.4, top - 2, top - 1, M.steelD);
  tank(v, tx, ty, 3.5, top - 2, top - 1, M.ink);
  tank(v, tx, ty, 4.4, top - 1, top, M.steelD, 3.5);
  const f = working ? frame % 4 : 0;
  const ang = (f * Math.PI) / 4;
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  for (let y = Math.floor(ty - 4); y <= Math.ceil(ty + 4); y++)
    for (let x = Math.floor(tx - 4); x <= Math.ceil(tx + 4); x++) {
      const dx = x + 0.5 - tx;
      const dy = y + 0.5 - ty;
      const t = dx * ca + dy * sa;
      const n = -dx * sa + dy * ca;
      if (Math.abs(t) < 3.4 && Math.abs(n) < 0.85 && dx * dx + dy * dy < 3.5 * 3.5) v.set(x, y, top - 1, M.white);
    }
  v.box(Math.floor(tx) - 1, Math.floor(ty) - 1, top - 1, Math.floor(tx) + 1, Math.floor(ty) + 1, top, M.steelL); // hub
  // pipes from the chimney into the tower: a flange on the chimney, an elbow round its front, a straight one behind
  v.cylY(12.5, 39.5, 1.1, 9, 12, M.steelL);
  v.cylX(11.5, 39.5, 1.1, 12, 19, M.steelL);
  v.cylZ(12.5, 11.5, 1.1, 39, 41, M.steelL);
  v.cylY(12.5, 39.5, 1.5, 9, 10, M.steel);
  v.cylX(11.5, 39.5, 1.5, 17, 18, M.steel);
  v.cylX(ty + 0.5, 33.5, 1.1, 14, 18, M.steelL);
  // green status light on the front, lit while the filter works
  v.box(19, 10, 38, 23, 11, 42, M.ink);
  v.box(20, 10, 39, 22, 11, 41, working ? P.greenLit : P.greenOff);
  // the chimney's smoke now goes through the filter: light steam leaves the top of the tower instead
  delete v.points.smoke;
  v.point('steam', tx, ty, FILTER_TOWER.top);
}

// ---------- catalogue icons: the module on its own ----------
// A box of a model, moved to the origin (points dropped).
export function crop(src: Vox, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): Vox {
  const out = new Vox(x1 - x0, y1 - y0, z1 - z0);
  for (let z = z0; z < z1; z++)
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const m = src.get(x, y, z);
        if (m) out.set(x - x0, y - y0, z - z0, m);
      }
  return out;
}

// The silos on a slab of the blue hangar roof, so the icon reads as "on the Dock".
export function dockStorageIcon(): Vox {
  const v = new Vox(32, 32, 34);
  v.box(2, 12, 13, 14, 31, 15, M.blue);
  v.box(2, 12, 15, 14, 31, 16, M.blueD);
  dockStorage(v, 0, true);
  return crop(v, 1, 11, 13, 15, 32, 34);
}

// The tower and its deck; the pipes end in flanges where the chimney would be.
export function smelterFilterIcon(): Vox {
  const v = new Vox(32, 32, 48);
  smelterFilter(v, 0, true);
  v.cylY(12.5, 39.5, 1.5, 9, 10, M.steel);
  v.cylX(7.5, 33.5, 1.5, 14, 15, M.steel);
  v.clear(0, 0, 0, 12, 32, 48);
  return crop(v, 11, 1, 28, 27, 13, 47);
}
