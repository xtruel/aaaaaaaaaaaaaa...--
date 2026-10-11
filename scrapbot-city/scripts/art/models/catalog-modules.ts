// Building modules of the 0.7 catalogue, increment 2: one slot per building, bolted onto a finished building. Each
// building's model calls its module's function after drawing itself, only when the module is installed, so a
// building without modules keeps exactly the voxels (and pixels) it always had. Same footprint and model height as
// the plain building: a module never makes the sprite jump.
//   recyclerMagnet  overband magnet over the Recycler's belt: a striped drum that spins while working, a red
//                   horseshoe magnet on its gantry
//   recyclerSorter  precision sorter at the head of the same belt: a shaking mesh table, three coloured trays and a
//                   small yellow picking arm (alternative to the magnet: same slot, same place)
//   factoryArm      a second, mirrored robot arm on the left of the 2PM Factory's line, working in counter-phase with
//                   the first one, its own pallet and a compressor with an exhaust (an extra smoke point)
//   podsCapsule     an extra mint housing capsule docked on the ground home's roof terrace, portholes lit at night
//   solarTracker    the Solar Array's panels on tracking mounts: posts, axles, motors and struts; tilted steeply
//                   towards the light while working, parked flat when off
//   purifierNozzle  a long lattice boom out of the Purifier's tall tank with a spray head that mists while working
import { M } from '../palette';
import { Vox, hex, mat } from '../voxel';
import { hazardBand, tank } from './common';
import { beam, crate } from './factory';

// Materials, registered on first use (see modules.ts: registering at import time would shift the ids, and so the
// per-voxel noise, of every material registered after this file, changing older sprites).
let mats: {
  magnet: number;
  magnetD: number;
  mint: number;
  mintD: number;
  trayB: number;
  trayG: number;
  boom: number;
} | null = null;
export function catalogModuleMats() {
  mats ??= {
    magnet: mat('cm-magnet', { rgb: hex('#e2364b'), jitter: 0.02 }),
    magnetD: mat('cm-magnetD', { rgb: hex('#9c1f33'), jitter: 0.02 }),
    mint: mat('cm-mint', { rgb: hex('#7fe0c8'), jitter: 0.02 }),
    mintD: mat('cm-mintD', { rgb: hex('#3a9c8e'), jitter: 0.02 }),
    trayB: mat('cm-trayB', { rgb: hex('#3a8fe0'), jitter: 0.02 }),
    trayG: mat('cm-trayG', { rgb: hex('#3faf4b'), jitter: 0.02 }),
    boom: mat('cm-boom', { rgb: hex('#ffc93a'), jitter: 0.02 }),
  };
  return mats;
}

type P3 = [number, number, number];

// ---------- Recycler: magnetic separator ----------
// The belt runs along y on the right of the green block (frame x 24..29, belt top z 7, scrap up to z 10). Just over
// the scrap a steel drum spans the belt on two short legs (one in the 1-voxel gap between the block and the belt
// frame, x 23, one on the plate's right edge, x 30); its dark bands turn a quarter of their period a frame while
// the Recycler works and stand still when it is off, and a few scraps stuck to its underside ride round with it.
// Over the drum hangs a big red horseshoe magnet, poles down, from the jib of a post standing behind it on the
// plate's right edge, clear of the magnet on screen. The U is drawn in the vertical plane that faces the camera
// (x + y constant), so it stands upright on screen and reads at 1×.
const DRUM = { y: 18, z: 12.5, r: 3.2 };
const MAGNET = { x: 27, y: 18 };
const POST = { x: 30, y: 8 };
const JIB_Z = 33;

// Inside the magnet's U: u = screen column from its centre, h = height above its poles (0..11).
function horseshoe(u: number, h: number): 'pole' | 'body' | null {
  const au = Math.abs(u + 0.5);
  if (h < 0 || h > 11) return null;
  const top = h - 5.5; // the arch's centre
  const r = top > 0 ? Math.hypot(au, top * 1.1) : au;
  if (r > 6.1 || r < 2.3) return null;
  return h < 2 ? 'pole' : 'body';
}

export function recyclerMagnet(v: Vox, frame: number, working: boolean): void {
  const P = catalogModuleMats();
  // the drum's legs and hubs
  for (const x of [23, 30]) {
    v.box(x, DRUM.y - 1, 3, x + 1, DRUM.y + 1, Math.ceil(DRUM.z) + 1, M.steelD);
    v.box(x, DRUM.y - 2, 3, x + 1, DRUM.y + 2, 4, M.steel); // foot
  }
  // the drum: dark bands by angle round its axis, turned while working; red flanges at its ends
  const turn = working ? frame % 4 : 0;
  for (let z = Math.floor(DRUM.z - DRUM.r - 1); z <= Math.ceil(DRUM.z + DRUM.r + 1); z++)
    for (let y = Math.floor(DRUM.y - DRUM.r - 1); y <= Math.ceil(DRUM.y + DRUM.r + 1); y++) {
      const dy = y + 0.5 - DRUM.y;
      const dz = z + 0.5 - DRUM.z;
      if (dy * dy + dz * dz > DRUM.r * DRUM.r) continue;
      const a = Math.atan2(dz, dy) + Math.PI + (turn * Math.PI) / 8;
      const band = Math.floor(a / (Math.PI / 4)) % 2;
      for (let x = 24; x < 30; x++) v.set(x, y, z, x === 24 || x === 29 ? P.magnetD : band ? M.steelL : M.steelD);
    }
  v.cylX(DRUM.y, DRUM.z, 1.4, 23, 24, M.steelL);
  v.cylX(DRUM.y, DRUM.z, 1.4, 30, 31, M.steelL);
  for (let k = 0; k < 3; k++) {
    const a = Math.PI / 2 + (k - 1) * 0.9 - (turn * Math.PI) / 8;
    const y = Math.floor(DRUM.y + Math.cos(a) * (DRUM.r + 0.5));
    const z = Math.floor(DRUM.z - Math.sin(a) * (DRUM.r + 0.5));
    v.set(25 + k * 2, y, z, k === 1 ? M.rust : M.steelL);
  }
  // the post and its jib, a hazard band round the post's foot
  v.box(POST.x, POST.y, 3, POST.x + 1, POST.y + 2, JIB_Z + 1, M.steelD);
  hazardBand(v, POST.x, POST.y, 3, POST.x + 1, POST.y + 2, 7);
  beam(v, [POST.x + 0.5, POST.y + 1, JIB_Z + 0.5], [MAGNET.x + 0.5, MAGNET.y + 0.5, JIB_Z + 0.5], 0.5, M.steel);
  v.box(POST.x, POST.y, JIB_Z + 1, POST.x + 1, POST.y + 2, JIB_Z + 2, working ? M.limeLit : M.limeD); // field light
  // the horseshoe magnet, poles 2 voxels over the drum, hanging from the jib's end by a rod
  const pz = Math.ceil(DRUM.z + DRUM.r) + 2;
  for (let z = pz; z < pz + 12; z++)
    for (let y = MAGNET.y - 8; y <= MAGNET.y + 8; y++)
      for (let x = MAGNET.x - 8; x <= MAGNET.x + 8; x++) {
        const s = x + y - (MAGNET.x + MAGNET.y);
        if (s !== 0 && s !== 1) continue;
        const kind = horseshoe(x - y - (MAGNET.x - MAGNET.y), z - pz);
        if (kind) v.set(x, y, z, kind === 'pole' ? M.white : P.magnet);
      }
  v.box(MAGNET.x, MAGNET.y, pz + 12, MAGNET.x + 1, MAGNET.y + 1, JIB_Z, M.steelL);
}

// ---------- Recycler: precision sorter ----------
// Over the head of the same belt (the module shares the magnet's slot and place): a cascade of three sieve trays
// stepping down towards the front, each with a coloured rim (pink, yellow, blue: the three grades) and a mesh floor
// with a few sorted bits on it, held by two side frames on the belt's edges. While the Recycler works the meshes
// shake (their holes shift a voxel each frame, the bits hop) and a small yellow arm on a post at the plate's right
// edge picks from the top tray and drops into the next, dipping to a different spot each frame; off, all still,
// the arm parked up.
const TIERS: { y0: number; z: number; rim: 'pink' | 'yellow' | 'blue' }[] = [
  { y0: 12, z: 19, rim: 'pink' },
  { y0: 17, z: 15, rim: 'yellow' },
  { y0: 22, z: 11, rim: 'blue' },
];
const TIER_D = 6;
const ARM_POSE: [number, number, number][] = [
  // gripper target (x, y, z) per frame
  [26, 14, 21],
  [25, 19, 18],
  [28, 15, 21],
  [27, 20, 18],
];

export function recyclerSorter(v: Vox, frame: number, working: boolean): void {
  const P = catalogModuleMats();
  const shake = working ? frame % 2 : 0;
  // side frames: legs under the top tray's back and the bottom tray's front, a rail along the cascade between
  const top = TIERS[0];
  const bottom = TIERS[TIERS.length - 1];
  for (const x of [23, 30]) {
    v.box(x, top.y0, 3, x + 1, top.y0 + 1, top.z, M.steelD);
    v.box(x, bottom.y0 + TIER_D - 1, 3, x + 1, bottom.y0 + TIER_D, bottom.z, M.steelD);
    const n = bottom.y0 + TIER_D - top.y0;
    for (let k = 0; k < n; k++) v.set(x, top.y0 + k, Math.round(top.z - 1 - ((top.z - bottom.z) * k) / (n - 1)), M.steelD);
  }
  for (const t of TIERS) {
    const rim = t.rim === 'pink' ? M.pink : t.rim === 'yellow' ? M.yellow : P.trayB;
    const y1 = t.y0 + TIER_D;
    // floor: mesh over the belt
    v.box(23, t.y0, t.z, 31, y1, t.z + 1, M.steelD);
    for (let y = t.y0 + 1; y < y1 - 1; y++) for (let x = 24; x < 30; x++) v.set(x, y, t.z, (x + y + shake) % 2 ? M.steelL : M.steel);
    // coloured rim, two voxels high at the back and sides, low at the front where it pours into the next tray
    v.box(23, t.y0, t.z + 1, 31, t.y0 + 1, t.z + 3, rim);
    v.box(23, t.y0, t.z + 1, 24, y1, t.z + 3, rim);
    v.box(30, t.y0, t.z + 1, 31, y1, t.z + 3, rim);
    v.box(23, y1 - 1, t.z, 31, y1, t.z + 1, rim); // front lip
    // sorted bits on the mesh: they hop while shaking
    const bits = t.rim === 'pink' ? [M.rust, M.steelD, P.trayG] : t.rim === 'yellow' ? [M.steelD, M.rust] : [M.rust, M.steelD];
    bits.forEach((m, k) => v.set(25 + k * 2 + ((k + shake) % 2), t.y0 + 2 + (k % 2), t.z + 1, m));
  }
  // the picking arm: a post at the plate's right edge behind the top tray, two links, a gripper
  const sx = 30;
  const sy = 8;
  const sz = 27;
  v.box(sx, sy, 3, sx + 1, sy + 2, sz, M.steelD);
  hazardBand(v, sx, sy, 3, sx + 1, sy + 2, 7);
  v.box(sx - 1, sy, sz - 1, sx + 1, sy + 2, sz + 1, M.ink);
  const [gx, gy, gz] = working ? ARM_POSE[frame % 4] : [28, 13, 25];
  const sh: P3 = [sx, sy + 1, sz];
  const el: P3 = [(sx + gx) / 2, (sy + gy) / 2 + 1, Math.max(sz, gz) + 3];
  const gr: P3 = [gx, gy, gz + 2];
  beam(v, sh, el, 0.5, M.yellow);
  beam(v, el, gr, 0.5, M.yellow);
  v.box(Math.round(el[0]) - 1, Math.round(el[1]) - 1, Math.round(el[2]) - 1, Math.round(el[0]) + 1, Math.round(el[1]) + 1, Math.round(el[2]) + 1, M.ink);
  v.box(gx - 1, gy - 1, gz + 1, gx + 1, gy + 1, gz + 2, M.steelD);
  v.box(gx - 1, gy - 1, gz, gx, gy + 1, gz + 1, M.steelD);
  v.box(gx, gy - 1, gz, gx + 1, gy + 1, gz + 1, M.steelD);
  // status light on the post's top
  v.box(sx, sy, sz + 1, sx + 1, sy + 1, sz + 2, working ? M.limeLit : M.limeD);
}

// ---------- 2PM Factory: double arm ----------
// The Factory's single yellow arm (front right, between the belt's end and the pallet) becomes a twin-arm robot on
// the same base plate (the factory model leaves its own arm out when this module is installed), in the brand's white
// and pink so it stands out from the old yellow arm at 1×: a taller torso with a pink 2PM band and a sensor head,
// and two articulated arms with pink joints, one each side, elbows up. While the
// Factory works the left arm takes a crate off the belt and lifts it to the torso, the right one takes it over and
// sets it on the pallet, both moving every frame; off, both arms hang parked. On the torso's back a short exhaust
// (the variant's extra 'smoke' point, after the chimney's); the 'spark' point stays where it was, on the torso.
const TORSO = { x: 38, y: 29 };
const ARM_L1 = 7;
const ARM_L2 = 7;
// gripper targets [x, z] per frame: left arm (belt side), right arm (pallet side)
const TWIN_L: [number, number][] = [
  [31, 12], // at the belt's end
  [31.5, 17], // lifting
  [34, 21], // handing over over the torso
  [31, 15], // going back down
];
const TWIN_R: [number, number][] = [
  [44, 13], // setting the crate on the stack
  [44.5, 18], // rising
  [42, 21], // taking the crate over
  [45, 17], // carrying it out
];

// Elbow of a two-link arm from a shoulder (sx, sz) to a target (tx, tz), bent upwards.
function elbowUp(sx: number, sz: number, tx: number, tz: number): [number, number] {
  const dx = tx - sx;
  const dz = tz - sz;
  const d = Math.min(ARM_L1 + ARM_L2 - 0.01, Math.hypot(dx, dz));
  const a = Math.atan2(dz, dx);
  const b = Math.acos((ARM_L1 * ARM_L1 + d * d - ARM_L2 * ARM_L2) / (2 * ARM_L1 * d));
  const e1: [number, number] = [sx + ARM_L1 * Math.cos(a + b), sz + ARM_L1 * Math.sin(a + b)];
  const e2: [number, number] = [sx + ARM_L1 * Math.cos(a - b), sz + ARM_L1 * Math.sin(a - b)];
  return e1[1] >= e2[1] ? e1 : e2;
}

export function factoryArm(v: Vox, frame: number, working: boolean): void {
  const { x: tx, y: ty } = TORSO;
  const f = frame % 4;
  // pedestal and torso
  v.cylZ(tx, ty, 2.2, 5, 8, M.dark);
  v.box(tx - 2, ty - 2, 8, tx + 2, ty + 2, 17, M.white);
  v.box(tx - 2, ty - 2, 10, tx + 2, ty + 2, 12, M.pink);
  v.box(tx - 2, ty - 2, 8, tx + 2, ty + 2, 9, M.steelL);
  // sensor head: a dark visor with a lime eye that is lit while working
  v.box(tx - 1, ty - 1, 17, tx + 1, ty + 2, 20, M.steelD);
  v.box(tx - 1, ty + 1, 18, tx + 1, ty + 2, 19, working ? M.limeLit : M.limeD);
  // exhaust on the torso's back
  v.cylZ(tx - 1.5, ty - 2.5, 0.9, 13, 20, M.dark);
  v.point('smoke', tx - 1.5, ty - 2.5, 20);
  // the two arms
  const sz = 15.5;
  const arms: { sx: number; target: [number, number]; parked: [number, number]; carry: boolean }[] = [
    { sx: tx - 2.5, target: TWIN_L[f], parked: [33, 10], carry: working && (f === 1 || f === 2) },
    { sx: tx + 2.5, target: TWIN_R[f], parked: [43, 10], carry: working && (f === 3 || f === 0) },
  ];
  for (const arm of arms) {
    const [gx, gz] = working ? arm.target : arm.parked;
    const [ex, ez] = elbowUp(arm.sx, sz, gx, gz);
    const sh: P3 = [arm.sx, ty, sz];
    const el: P3 = [ex, ty, ez];
    const gr: P3 = [gx, ty, gz];
    beam(v, sh, el, 1, M.white);
    beam(v, el, gr, 1, M.white);
    v.box(Math.round(arm.sx) - 1, ty - 1, Math.round(sz) - 1, Math.round(arm.sx) + 1, ty + 1, Math.round(sz) + 1, M.pink);
    v.box(Math.round(ex) - 1, ty - 1, Math.round(ez) - 1, Math.round(ex) + 1, ty + 1, Math.round(ez) + 1, M.pink);
    const gxi = Math.round(gx);
    const gzi = Math.round(gz);
    v.box(gxi - 2, ty - 2, gzi - 1, gxi + 2, ty + 2, gzi, M.steelD); // gripper and fingers
    v.box(gxi - 2, ty - 2, gzi - 3, gxi - 1, ty + 2, gzi - 1, M.steelD);
    v.box(gxi + 1, ty - 2, gzi - 3, gxi + 2, ty + 2, gzi - 1, M.steelD);
    if (arm.carry) crate(v, gxi - 2, ty - 2, gzi - 5, arm.sx > tx);
  }
}

// ---------- Bot Pods: extra housing capsule ----------
// The ground home's roof (z 16) is a terrace with a white railing along its front and right edges and a potted tree
// in its left corner. The extra capsule docks there, in front of the pink middle home, right of the tree: a mint
// capsule (the only mint on the building, so it reads as the new unit) on a steel docking frame with hazard edges,
// a collar joining it to the middle home, a round porthole on each visible side and a little roof hatch. Its panes
// are lit while the Pods are powered (yellow at night), dark when off. No motion.
export function podsCapsule(v: Vox, frame: number, working: boolean): void {
  void frame;
  const P = catalogModuleMats();
  const x0 = 10;
  const x1 = 21;
  const y0 = 20;
  const y1 = 28;
  const z0 = 17;
  const z1 = 27;
  // docking frame on the terrace
  v.box(x0, y0, 16, x1, y1, 17, M.steelD);
  for (let x = x0; x < x1; x++) v.set(x, y1 - 1, 16, Math.floor(x / 2) % 2 ? M.hazardK : M.hazardY);
  for (let y = y0; y < y1; y++) v.set(x1 - 1, y, 16, Math.floor(y / 2) % 2 ? M.hazardK : M.hazardY);
  // the capsule: rounded box, darker skirt and a light band
  for (let z = z0; z < z1; z++) {
    const inset = z === z0 || z === z1 - 1 ? 1 : 0;
    const ax = x0 + inset;
    const bx = x1 - inset;
    const ay = y0 + inset;
    const byy = y1 - inset;
    const r = 3;
    for (let y = ay; y < byy; y++)
      for (let x = ax; x < bx; x++) {
        const dx = Math.max(0, ax + r - (x + 0.5), x + 0.5 - (bx - r));
        const dy = Math.max(0, ay + r - (y + 0.5), y + 0.5 - (byy - r));
        if (dx * dx + dy * dy <= r * r + 0.01) v.set(x, y, z, z < z0 + 2 ? P.mintD : P.mint);
      }
  }
  v.paint(x0, y0, z1 - 3, x1, y1, z1 - 2, M.white);
  // collar into the middle home's front wall
  v.box(13, y0 - 1, 19, 18, y0 + 1, 24, M.steelL);
  // portholes: front (+y) and right (+x), ring white, pane lit while powered
  const pane = working ? M.yellowLit : M.window;
  const ring = M.white;
  for (let k = 0; k < 6; k++)
    for (let j = 0; j < 6; j++) {
      const corner = (k === 0 || k === 5) && (j === 0 || j === 5);
      const inner = k >= 1 && k <= 4 && j >= 1 && j <= 4 && !((k === 1 || k === 4) && (j === 1 || j === 4));
      if (corner) continue;
      v.set(x0 + 2 + k, y1, z0 + 2 + j, inner ? pane : ring);
      if (k < 5) v.set(x1, y0 + 1 + k, z0 + 2 + j, inner && k < 4 ? pane : ring);
    }
  // roof hatch with a little antenna
  v.box(x0 + 3, y0 + 2, z1, x0 + 7, y0 + 6, z1 + 1, M.steelL);
  v.box(x1 - 3, y0 + 2, z1, x1 - 2, y0 + 3, z1 + 4, M.steelD);
  v.box(x1 - 3, y0 + 2, z1 + 4, x1 - 2, y0 + 3, z1 + 5, working ? M.pinkLit : M.pinkD);
}

// ---------- Solar Array: tracking panels ----------
// The four fixed panels are replaced by four panels on tracking mounts (the solar model leaves its own panels out
// when this module is installed): a post on the gravel bed, an axle along x through the panel's middle with a
// yellow motor at its right end, and a strut from the post to the panel's underside. While working the panels
// tilt steeply towards the light (front-left) and a glint runs across them; when off they park flat.
const TRACKERS: [number, number][] = [
  [9, 8],
  [23, 8],
  [9, 20],
  [23, 20],
];
const PIVOT_Z = 13;
const TRACK_YAW = Math.PI / 2; // facing +y, towards the light

// A panel w wide and d deep centred on (cx, cy, cz): its face turned by 'yaw' round z (0 = facing +x, π/2 = +y)
// and tilted up by 'tilt' from the horizontal. A cross bar and rim of dark steel underneath.
function trackerPanel(v: Vox, cx: number, cy: number, cz: number, w: number, d: number, yaw: number, tilt: number, glint: number): void {
  const hx = Math.cos(yaw);
  const hy = Math.sin(yaw);
  const n = [hx * Math.sin(tilt), hy * Math.sin(tilt), Math.cos(tilt)];
  const a = [-hy, hx, 0]; // across the panel (its width)
  const b = [hx * Math.cos(tilt), hy * Math.cos(tilt), -Math.sin(tilt)]; // down the slope (its depth)
  const half = (Math.abs(n[0]) + Math.abs(n[1]) + Math.abs(n[2])) / 2; // a tunnel-free digital plane
  const R = Math.ceil(Math.max(w, d) / 2) + 2;
  for (let z = Math.floor(cz - R); z <= Math.ceil(cz + R); z++)
    for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y++)
      for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) {
        const rx = x + 0.5 - cx;
        const ry = y + 0.5 - cy;
        const rz = z + 0.5 - cz;
        const u = rx * a[0] + ry * a[1] + w / 2;
        const t = rx * b[0] + ry * b[1] + rz * b[2] + d / 2;
        const nn = rx * n[0] + ry * n[1] + rz * n[2];
        if (u < 0 || u > w || t < 0 || t > d) continue;
        if (nn > half || nn <= -half) {
          if (nn <= -half && nn > -3 * half && (u < 1 || u > w - 1 || t < 1 || t > d - 1 || Math.abs(t - d / 2) < 0.6)) v.set(x, y, z, M.steelD);
          continue;
        }
        let m = M.blue;
        const edge = u < 1 || u > w - 1 || t < 1 || t > d - 1;
        const shine = Math.floor(u) - Math.floor(d - t) - glint;
        if (edge) m = M.white;
        else if (shine >= 0 && shine <= 1) m = M.sky;
        else if (shine === 2) m = M.glass;
        else if (Math.floor(u) === Math.floor(w / 2) || Math.floor(t) % 3 === 0) m = M.blueD;
        v.set(x, y, z, m);
      }
}

export function solarTracker(v: Vox, frame: number, working: boolean): void {
  const tilt = working ? (56 * Math.PI) / 180 : 0;
  const g = working ? -6 + (frame % 4) * 5 : -40;
  TRACKERS.forEach(([cx, cy], k) => {
    // post on a footing, a fork at its top holding the axle
    v.box(cx - 2, cy - 2, 4, cx + 2, cy + 2, 5, M.concrete);
    v.box(cx - 1, cy - 1, 5, cx + 1, cy + 1, PIVOT_Z - 2, M.steelL);
    v.box(cx - 2, cy - 1, PIVOT_Z - 3, cx + 2, cy + 1, PIVOT_Z - 2, M.steelD);
    trackerPanel(v, cx, cy, PIVOT_Z + 0.5, 10, 9, TRACK_YAW, tilt, g - [0, 5, 3, 8][k]);
    // axle and a yellow drive at its right end, with a status light that blinks while it tracks
    v.box(cx - 5, cy - 1, PIVOT_Z - 1, cx + 5, cy + 1, PIVOT_Z + 1, M.steelL);
    v.box(cx + 5, cy - 2, PIVOT_Z - 2, cx + 8, cy + 2, PIVOT_Z + 2, M.yellow);
    v.box(cx + 7, cy - 1, PIVOT_Z - 1, cx + 8, cy + 1, PIVOT_Z + 1, M.steelD);
    v.box(cx + 5, cy + 1, PIVOT_Z, cx + 6, cy + 2, PIVOT_Z + 1, working && (frame + k) % 4 < 2 ? M.limeLit : M.limeD);
    // a strut from the post's foot to the panel's raised back while it is tilted
    if (working) for (let s = 0; s < 5; s++) v.set(cx - 3, cy - Math.floor(s / 2), 5 + s, M.steelD);
  });
}

// ---------- Purifier: extended nozzle ----------
// A slewing collar round the tall tank, under its cap, carries a long yellow lattice boom that reaches out over the
// short tank to the plate's left corner, high above the droplet, held up by a stay from the cap; at its tip a spray
// head (cyan, lit while working). The boom runs along x − y, i.e. straight across the screen, so it reads as long.
// While working the head sprays a light mist: soft, half-transparent specks under it, falling a little further
// each frame (withMist, applied to the rendered work frames); off, the head is dark and the air clear. The 'mist'
// point sits at the head. Every other point of the Purifier (its beacon 'light') stays.
const NOZZLE: P3 = [2, 30, 41];
const BOOM_ROOT: P3 = [14, 16, 39];

export function purifierNozzle(v: Vox, frame: number, working: boolean): void {
  void frame;
  const P = catalogModuleMats();
  // collar round the tall tank and a hinge block on its front-left side
  tank(v, 20, 12, 7.2, 37, 39, M.steelD);
  v.box(13, 15, 37, 17, 19, 41, M.steel);
  // lattice boom: two chords with a zig-zag between them, rising gently towards the tip
  const [ax, ay, az] = BOOM_ROOT;
  const [bx, by, bz] = NOZZLE;
  const n = 32;
  let prev = -1;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = Math.floor(ax + (bx - ax) * t);
    const y = Math.floor(ay + (by - ay) * t);
    const z = Math.floor(az + (bz - az) * t);
    v.set(x, y, z + 3, P.boom); // top chord
    v.set(x, y, z, P.boom); // bottom chord
    const k = Math.floor(t * 8);
    if (k !== prev) {
      prev = k;
      v.set(x, y, z + (k % 2 ? 1 : 2), M.steelD); // lacing
    }
  }
  // stay from the top of the cap to the boom's middle
  const mid: P3 = [(ax + bx) / 2, (ay + by) / 2, (az + bz) / 2 + 3];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    v.set(Math.floor(17 + (mid[0] - 17) * t), Math.floor(13 + (mid[1] - 13) * t), Math.floor(47 + (mid[2] - 47) * t), M.steelL);
  }
  // spray head: a steel nozzle block with a cyan ring under it
  const hx = Math.floor(bx);
  const hy = Math.floor(by);
  const hz = Math.floor(bz);
  v.box(hx - 1, hy - 1, hz - 1, hx + 2, hy + 2, hz + 4, M.steel);
  v.box(hx - 1, hy - 1, hz + 4, hx + 2, hy + 2, hz + 5, M.steelD);
  v.box(hx - 1, hy - 1, hz - 2, hx + 2, hy + 2, hz - 1, working ? M.cyanLit : M.cyanD);
  v.box(hx, hy, hz - 3, hx + 1, hy + 1, hz - 2, M.steelD);
  v.point('mist', bx + 0.5, by + 0.5, bz - 3);
}

// The mist under the spray head of a working frame: pale cyan-white specks, half transparent, in a cone that widens
// downwards; each speck falls 2 px a frame and wraps round, so the 4 frames loop. The specks are drawn over the
// colour frame only (no glow: mist is not a light).
export function withMist<T extends { img: { w: number; h: number; data: Uint8ClampedArray }; points: Record<string, [number, number][]> }>(r: T, frame: number): T {
  const p = r.points.mist?.[0];
  if (!p) return r;
  const [mx, my] = p;
  const img = r.img;
  const H = 22;
  for (let k = 0; k < 34; k++) {
    const h1 = Math.sin(k * 12.9898) * 43758.5453;
    const h2 = Math.sin(k * 78.233) * 24634.6345;
    const r1 = h1 - Math.floor(h1);
    const r2 = h2 - Math.floor(h2);
    const dy = Math.floor((r1 * H + frame * 2) % H) + 1;
    const spread = 1 + dy * 0.45;
    const dx = Math.round((r2 * 2 - 1) * spread);
    const x = mx + dx;
    const y = my + dy;
    if (x < 0 || y < 0 || x >= img.w || y >= img.h) continue;
    const o = (y * img.w + x) * 4;
    const a = Math.round(255 * (0.75 - (dy / H) * 0.45));
    const c = k % 3 ? [191, 244, 240] : [239, 255, 253];
    // over the sprite: blend; over empty pixels: the speck itself
    const da = img.data[o + 3] / 255;
    const sa = a / 255;
    const oa = sa + da * (1 - sa);
    for (let ch = 0; ch < 3; ch++) img.data[o + ch] = Math.round((c[ch] * sa + img.data[o + ch] * da * (1 - sa)) / Math.max(oa, 1e-6));
    img.data[o + 3] = Math.round(oa * 255);
  }
  return r;
}

// ---------- catalogue icons: the module on its own ----------
// A box of a model, moved to the origin (points dropped).
function crop(src: Vox, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): Vox {
  const out = new Vox(x1 - x0, y1 - y0, z1 - z0);
  for (let z = z0; z < z1; z++)
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const m = src.get(x, y, z);
        if (m) out.set(x - x0, y - y0, z - z0, m);
      }
  return out;
}

// The magnet over a stub of belt.
export function recyclerMagnetIcon(): Vox {
  const v = new Vox(32, 32, 32);
  v.box(24, 12, 3, 30, 25, 7, M.steelD);
  v.box(24, 12, 7, 25, 25, 9, M.steel);
  v.box(29, 12, 7, 30, 25, 9, M.steel);
  for (let y = 12; y < 25; y++) v.box(25, y, 7, 29, y + 1, 8, y % 4 < 2 ? M.ink : M.dark);
  v.box(23, 12, 2, 31, 25, 3, M.sand);
  recyclerMagnet(v, 0, true);
  return crop(v, 22, 11, 2, 32, 26, 30);
}

export function recyclerSorterIcon(): Vox {
  const v = new Vox(32, 32, 32);
  v.box(24, 16, 3, 30, 30, 7, M.steelD);
  v.box(24, 16, 7, 25, 30, 9, M.steel);
  v.box(29, 16, 7, 30, 30, 9, M.steel);
  for (let y = 16; y < 30; y++) v.box(25, y, 7, 29, y + 1, 8, y % 4 < 2 ? M.ink : M.dark);
  v.box(22, 16, 2, 32, 30, 3, M.sand);
  recyclerSorter(v, 1, true);
  return crop(v, 21, 15, 2, 32, 30, 24);
}

// The twin-arm robot on its base plate, arms out to the belt's end and the pallet.
export function factoryArmIcon(): Vox {
  const v = new Vox(48, 32, 24);
  v.box(28, 24, 2, 48, 32, 3, M.sand);
  v.box(35, 26, 3, 41, 31, 5, M.steelD);
  v.box(41, 23, 3, 47, 31, 4, M.rustD);
  factoryArm(v, 0, true);
  delete v.points.smoke;
  return crop(v, 28, 23, 2, 48, 32, 23);
}

export function podsCapsuleIcon(): Vox {
  const v = new Vox(32, 32, 34);
  v.box(8, 18, 14, 23, 30, 16, M.white);
  v.box(8, 18, 14, 23, 30, 15, M.pink);
  podsCapsule(v, 0, true);
  return crop(v, 7, 17, 14, 24, 31, 33);
}

// The two back trackers on a strip of the gravel bed.
export function solarTrackerIcon(): Vox {
  const v = new Vox(32, 32, 20);
  v.box(2, 2, 3, 30, 14, 4, M.dark);
  solarTracker(v, 0, true);
  return crop(v, 1, 1, 3, 31, 15, 20);
}

// The boom and its spray head on the collar of a stub of the tall tank, with a puff of mist under the head.
export function purifierNozzleIcon(): Vox {
  const v = new Vox(32, 32, 50);
  tank(v, 20, 12, 6.5, 30, 41, M.white);
  tank(v, 20, 12, 6.6, 41, 43, M.blueD);
  tank(v, 20, 12, 6.5, 43, 45, M.blue);
  purifierNozzle(v, 0, true);
  for (const [x, y, z] of [
    [2, 30, 36],
    [1, 29, 34],
    [3, 31, 33],
    [2, 28, 31],
    [0, 30, 31],
  ])
    v.set(x, y, z, M.white);
  return crop(v, 0, 4, 30, 27, 32, 47);
}
