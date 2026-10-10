// Scrapbots: a white cube head with the pink ears, a dark screen face with lime eyes, a small red body and a
// hover thruster. Four directions (rotated voxel model), and frames for flying, carrying and working.
import { M } from '../palette';
import { Vox } from '../voxel';

export type BotPose = 'fly' | 'carry' | 'work';
export const BOT_FRAMES = 2;

// Built facing +y (south-west on screen).
export function botModel(pose: BotPose, frame: number): Vox {
  const v = new Vox(10, 10, 16);
  const z0 = 3; // the body floats above the thruster flame
  // thruster flame
  const flame = frame % 2 === 0 ? 2 : 3;
  if (pose !== 'work') v.cylZ(5, 5, 1.6, z0 - flame + 1, z0 + 1, M.cyanLit);
  // body
  v.box(3, 3, z0, 7, 7, z0 + 3, M.red);
  v.box(3, 6, z0 + 1, 7, 7, z0 + 2, M.white);
  // head
  v.box(1, 1, z0 + 3, 9, 9, z0 + 10, M.white);
  v.box(1, 1, z0 + 3, 9, 9, z0 + 4, M.steelL);
  // face screen on the front (+y) with two lime eyes
  v.box(2, 9, z0 + 5, 8, 10, z0 + 9, M.ink);
  const blink = pose === 'fly' && frame === 1;
  if (blink) {
    v.box(3, 9, z0 + 6, 4, 10, z0 + 7, M.limeLit);
    v.box(6, 9, z0 + 6, 7, 10, z0 + 7, M.limeLit);
  } else {
    v.box(3, 9, z0 + 6, 4, 10, z0 + 8, M.limeLit);
    v.box(6, 9, z0 + 6, 7, 10, z0 + 8, M.limeLit);
  }
  // ears
  const wiggle = pose === 'fly' && frame === 1 ? 1 : 0;
  v.box(1, 4, z0 + 10, 3, 6, z0 + 13 + wiggle, M.pink);
  v.box(7, 4, z0 + 10, 9, 6, z0 + 13 + (1 - wiggle), M.pink);
  v.box(1, 5, z0 + 12, 3, 6, z0 + 13, M.white);
  v.box(7, 5, z0 + 12, 9, 6, z0 + 13, M.white);
  // arms
  if (pose === 'work') {
    const reach = frame % 2 === 0 ? 0 : 1;
    v.box(0, 6, z0 - 1 - reach, 1, 9, z0 + 3, M.steelL);
    v.box(9, 6, z0 - 1 - (1 - reach), 10, 9, z0 + 3, M.steelL);
    v.box(0, 8, z0 - 2 - reach, 1, 10, z0 - 1 - reach, M.yellow);
    v.box(9, 8, z0 - 2 - (1 - reach), 10, 10, z0 - 1 - (1 - reach), M.yellow);
  } else {
    v.box(0, 4, z0 + 1, 1, 6, z0 + 3, M.steelL);
    v.box(9, 4, z0 + 1, 10, 6, z0 + 3, M.steelL);
  }
  // a cube of scrap held under the body
  if (pose === 'carry') {
    // the load hangs under the body and swings; two small side thrusters keep the bot up
    v.clear(3, 3, 0, 7, 7, z0);
    const sw = frame % 2;
    v.box(3 + sw, 3, 0, 7 + sw, 7, 3, M.rust);
    v.box(4 + sw, 3, 2, 6 + sw, 5, 3, M.steelL);
    v.box(3 + sw, 6, 0, 5 + sw, 7, 2, M.rustD);
    v.box(2, 4, 1, 3, 6, 4, M.steelL);
    v.box(7, 4, 1, 8, 6, 4, M.steelL);
    v.box(0, 4, z0 - 1 - sw, 1, 6, z0 + 1, M.cyanLit);
    v.box(9, 4, z0 - 2 + sw, 10, 6, z0 + 1, M.cyanLit);
  }
  return v;
}

// Directions: model rotated so the face points along +y (sw), +x (se), −y (ne), −x (nw).
export const DIRS = ['sw', 'se', 'ne', 'nw'] as const;
export type Dir = (typeof DIRS)[number];

export function facing(v: Vox, dir: Dir): Vox {
  let out = v;
  const turns = DIRS.indexOf(dir);
  for (let k = 0; k < turns; k++) out = out.rotated();
  return out;
}
