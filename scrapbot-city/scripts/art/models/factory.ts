// 2PM Factory (3×2): the corporation's money maker. A big purple hall with a pink neon "2PM" sign, a sawtooth roof
// with skylights, grey machinery on the roof, red pipes and a boiler, a striped pink/white chimney, and out front a
// short conveyor carrying crates out of the loading door to a yellow robot arm that stacks them on a pallet.
// Working = belt, crates, arm and roof fan move; sign, skylights, windows and boiler gauge lit; smoke.
// Off = everything still and unlit (only the chimney beacon stays on).
import { M } from '../palette';
import { hex, mat } from '../voxel';
import type { Vox } from '../voxel';
import { footprint, hazardBand, plate } from './common';
import type { BuildingArt } from './common';

// skylight glass: pale blue by day, a cyan glow at night
const SKY = mat('factory-skylight', { rgb: hex('#86c8ff'), emit: 0.6, glow: hex('#42e2d2'), flat: true, jitter: 0 });
// neon tube letters: white by day, glowing pink-white at night
const NEON = mat('factory-neon', { rgb: hex('#fff2f8'), emit: 0.6, glow: hex('#ffd6ea'), jitter: 0 });

// The flagship "2PM" in native 10-row neon letters (the doubled 3×5 font read as "ZFM").
const SIGN = [
  ['.####.', '##..##', '....##', '....##', '...##.', '..##..', '.##...', '##....', '######', '######'],
  ['#####.', '######', '##..##', '##..##', '######', '#####.', '##....', '##....', '##....', '##....'],
  ['##...##', '###.###', '#######', '##.#.##', '##...##', '##...##', '##...##', '##...##', '##...##', '##...##'],
];

type P3 = [number, number, number];

// A thick straight segment between two points (robot arm links).
function beam(v: Vox, a: P3, b: P3, r: number, m: number): void {
  const n = Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), Math.abs(b[2] - a[2])) * 2) + 1;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = a[0] + (b[0] - a[0]) * t;
    const y = a[1] + (b[1] - a[1]) * t;
    const z = a[2] + (b[2] - a[2]) * t;
    v.box(Math.round(x - r), Math.round(y - r), Math.round(z - r), Math.round(x + r), Math.round(y + r), Math.round(z + r), m);
  }
}

// A rust-brown crate with a pink 2PM tape band (it must pop against the sand plate and the yellow arm).
// `turned` runs the band along y instead of x, so the crates of a stack alternate and each one reads.
function crate(v: Vox, x: number, y: number, z: number, turned = false): void {
  v.box(x, y, z, x + 4, y + 4, z + 4, M.rust);
  v.paint(x, y, z, x + 4, y + 4, z + 1, M.rustD);
  if (turned) v.paint(x, y + 1, z, x + 4, y + 3, z + 4, M.pink);
  else v.paint(x + 1, y, z, x + 3, y + 4, z + 4, M.pink);
}

// Two-link arm in a vertical plane: shoulder at (0, sz), gripper target (u, z); returns the elbow (elbow up).
const L1 = 8;
const L2 = 7;
function elbow(sz: number, u: number, z: number): [number, number] {
  const du = u;
  const dz = z - sz;
  const d = Math.min(L1 + L2 - 0.01, Math.hypot(du, dz));
  const a = Math.atan2(dz, du);
  const b = Math.acos((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d));
  const e1: [number, number] = [L1 * Math.cos(a + b), sz + L1 * Math.sin(a + b)];
  const e2: [number, number] = [L1 * Math.cos(a - b), sz + L1 * Math.sin(a - b)];
  return e1[1] >= e2[1] ? e1 : e2;
}

// Gripper targets (offset along x from the arm base, height): over the end of the belt, lifting the crate,
// swung high over the pallet, setting it down on top of the stack.
const GRIP: [number, number][] = [
  [-7, 12],
  [-6, 16],
  [3, 20],
  [6, 17],
];

export const factory: BuildingArt = {
  frames: 4,
  fps: 6,
  model(frame, working) {
    const v = footprint(3, 2, 52);
    const f = working ? frame : 0;
    plate(v);

    // ---------- the hall ----------
    v.box(3, 3, 3, 36, 23, 21, M.purple);
    v.paint(3, 3, 3, 36, 23, 5, M.purpleD);
    v.box(2, 2, 21, 37, 24, 22, M.purpleD); // cornice
    v.box(3, 3, 22, 36, 23, 23, M.purple);

    // pink neon sign with a big 2PM on the facade (outer layer y = 22)
    // (lit only while the factory runs: off means stopped or without power)
    v.box(4, 22, 7, 28, 24, 20, working ? M.pinkLit : M.pink);
    v.box(5, 23, 8, 27, 24, 19, M.pinkD);
    let sx = 6; // letters flush with the panel: crisp shapes
    for (const g of SIGN) {
      g.forEach((row, r) => {
        for (let c = 0; c < row.length; c++) if (row[c] === '#') v.set(sx + c, 23, 18 - r, working ? NEON : M.white);
      });
      sx += g[0].length + 1;
    }

    // loading door the belt comes out of
    v.box(28, 22, 3, 36, 24, 14, M.steelD);
    v.box(29, 21, 3, 35, 24, 12, M.ink);

    // windows along the right wall (outer layer x = 35)
    for (let y = 5; y < 20; y += 4) v.box(35, y, 11, 36, y + 2, 16, working ? M.yellowLit : M.window);

    // ---------- sawtooth roof: purple slopes (gentle, so they face the view) and skylights facing the front ----------
    for (const y0 of [3, 9, 15]) {
      for (let k = 0; k < 6; k++) v.box(3, y0 + k, 23, 26, y0 + k + 1, 24 + Math.floor(k / 2), k < 5 ? M.purple : M.purpleD);
      v.box(3, y0 + 6, 23, 26, y0 + 7, 28, M.purpleD);
      v.box(4, y0 + 6, 24, 25, y0 + 7, 27, working ? SKY : M.glass);
      for (let x = 9; x < 25; x += 5) v.box(x, y0 + 6, 24, x + 1, y0 + 7, 27, M.purpleD);
    }

    // ---------- grey machinery on the roof ----------
    v.box(26, 3, 23, 36, 13, 30, M.concreteL); // big unit with a fan on top
    v.box(28, 13, 24, 34, 14, 28, M.steel);
    for (let z = 25; z < 28; z += 2) v.box(29, 13, z, 33, 14, z + 1, M.ink); // vents
    v.cylZ(31, 8, 4.8, 30, 31, M.steel); // fan shroud
    // 4-blade fan on a dark disc, turned a quarter of its 90° symmetry per frame (4 orientations)
    const th = (f * Math.PI) / 8;
    for (let y = 3; y < 13; y++)
      for (let x = 26; x < 36; x++) {
        const dx = x + 0.5 - 31;
        const dy = y + 0.5 - 8;
        if (Math.hypot(dx, dy) > 3.9) continue;
        let blade = false;
        for (let k = 0; k < 4; k++) {
          const p = th + (k * Math.PI) / 2;
          const along = dx * Math.cos(p) + dy * Math.sin(p);
          const across = -dx * Math.sin(p) + dy * Math.cos(p);
          if (along > 0 && Math.abs(across) < 0.75) blade = true;
        }
        v.set(x, y, 30, blade ? M.steelL : M.ink);
      }
    v.box(30, 7, 30, 32, 9, 31, M.steelD); // hub
    v.box(28, 15, 23, 34, 21, 27, M.steel); // smaller box with a red pipe up to the big unit
    v.box(29, 16, 27, 33, 20, 28, M.steelD);
    v.cylY(33.5, 26.5, 1.2, 10, 18, M.red);

    // ---------- red boiler and pipes beside the right wall ----------
    v.box(37, 10, 3, 47, 23, 5, M.steelD); // machine bed
    v.cylZ(42, 16, 4.2, 5, 18, M.red);
    v.cylZ(42, 16, 4.2, 5, 7, M.pinkD);
    v.cylZ(42, 16, 4.2, 12, 13, M.pinkD);
    v.cylZ(42, 16, 3.2, 18, 19, M.steelD);
    v.cylZ(42, 16, 1.6, 19, 22, M.steelL); // valve
    v.box(40, 15, 22, 45, 17, 23, M.red);
    v.cylX(19.5, 14.5, 1.3, 35, 39, M.red); // into the hall
    v.cylX(12.5, 9.5, 1.3, 35, 40, M.red);
    v.cylZ(36.5, 8.5, 1.3, 3, 27, M.red); // riser to the roof machinery
    v.cylX(8.5, 26.5, 1.3, 33, 37, M.red);
    // pressure gauge on the boiler's right side
    v.box(46, 13, 7, 47, 19, 13, M.steel);
    v.box(46, 14, 8, 47, 18, 12, working ? M.cyanLit : M.window);

    // ---------- striped chimney (back right) ----------
    const cx = 42;
    const cy = 5.5;
    v.cylZ(cx, cy, 4.2, 3, 7, M.steelD);
    for (let z = 7; z < 46; z++) v.cylZ(cx, cy, 3.2, z, z + 1, Math.floor((z - 7) / 4) % 2 ? M.white : M.pink);
    v.cylZ(cx, cy, 3.8, 46, 48, M.dark);
    v.cylZ(cx, cy, 2.2, 47, 48, M.ink);
    v.cylX(cy + 0.5, 10.5, 1.3, 36, cx, M.red); // flue from the hall
    v.point('smoke', cx, cy, 48);
    v.box(44, 7, 48, 46, 9, 50, M.redLit); // beacon on the rim
    v.point('light', 45, 8, 50);

    // ---------- short conveyor out of the door ----------
    v.box(28, 23, 3, 34, 31, 6, M.steelD);
    v.box(28, 23, 6, 29, 31, 7, M.steel);
    v.box(33, 23, 6, 34, 31, 7, M.steel);
    for (let y = 22; y < 31; y++) v.box(29, y, 6, 33, y + 1, 7, (y - f * 2 + 64) % 4 < 2 ? M.ink : M.dark);
    // crates ride the belt towards the front, 2 voxels per frame: one comes out of the door while the arm picks
    // up the one that reached the end
    crate(v, 29, 19 + f * 2, 7);
    if (!working || frame === 0) crate(v, 29, 27, 7);
    v.box(28, 22, 3, 29, 24, 14, M.steelD); // the door frame hides the part still inside
    v.box(35, 22, 3, 36, 24, 14, M.steelD);
    v.box(28, 22, 12, 36, 24, 14, M.steelD);
    hazardBand(v, 28, 23, 12, 36, 24, 14);

    // ---------- robot arm and pallet (front right corner) ----------
    const bx = 38;
    const by = 29;
    const sz = 12;
    v.box(35, 26, 3, 41, 31, 5, M.steelD); // base plate
    v.cylZ(bx, by, 2.2, 5, 8, M.dark);
    v.box(bx - 2, by - 2, 8, bx + 2, by + 2, sz, M.yellow);
    const [gu, gz] = GRIP[working ? frame : 0];
    const [eu, ez] = elbow(sz, gu, gz);
    const sh: P3 = [bx, by, sz];
    const el: P3 = [bx + eu, by, ez];
    const gr: P3 = [bx + gu, by, gz];
    beam(v, sh, el, 1, M.yellow);
    beam(v, el, gr, 1, M.yellow);
    const ex = Math.round(el[0]);
    const ez0 = Math.round(el[2]);
    v.box(bx - 1, by - 1, sz - 1, bx + 1, by + 1, sz + 1, M.ink); // shoulder joint
    v.box(ex - 1, by - 1, ez0 - 1, ex + 1, by + 1, ez0 + 1, M.ink); // elbow joint
    v.box(gr[0] - 2, by - 2, gz - 1, gr[0] + 2, by + 2, gz, M.steelD); // gripper and its fingers
    v.box(gr[0] - 2, by - 2, gz - 3, gr[0] - 1, by + 2, gz - 1, M.steelD);
    v.box(gr[0] + 1, by - 2, gz - 3, gr[0] + 2, by + 2, gz - 1, M.steelD);
    if (working && frame > 0) crate(v, gr[0] - 2, by - 2, gz - 5); // the crate in its grip
    // pallet with a stack of crates (clear of the arm's base plate)
    v.box(41, 23, 3, 47, 31, 4, M.rustD);
    crate(v, 42, 23, 4);
    crate(v, 42, 27, 4, true);
    crate(v, 42, 23, 8, true);
    crate(v, 42, 27, 8);
    // front yard: a painted walkway line and a few pink 2PM barrels by the corner
    v.paint(3, 26, 2, 27, 27, 3, M.hazardY);
    for (const [x, y, m] of [
      [5.5, 29, M.pink],
      [9, 29, M.pinkD],
      [6, 25.5, M.steelL],
    ] as const) {
      v.cylZ(x, y, 1.7, 3, 8, m);
      v.cylZ(x, y, 1.7, 5, 6, M.ink);
    }
    v.point('spark', 38, 29, 13); // the arm's shoulder joint
    return v;
  },
};
