// Citizens (walk the streets, more of them as the city grows) and Miso the cat.
// Placeholders until the real models are made. Models face +y (south-west on screen), like the bots.
import { M } from '../palette';
import { Vox } from '../voxel';

export const CITIZEN_VARIANTS = 4;
export const CITIZEN_FRAMES = 2;

// A citizen 6×6 voxels wide, about 12 tall. frame 0/1 = the two walking steps.
export function citizenModel(variant: number, frame: number): Vox {
  const v = new Vox(6, 6, 13);
  const shirt = [M.pink, M.sky, M.yellow, M.green][variant % 4];
  v.box(2, 2, 0, 3, 3, 4 - (frame % 2), M.navy);
  v.box(3, 2, 0, 4, 3, 3 + (frame % 2), M.navy);
  v.box(1, 1, 4, 5, 4, 8, shirt);
  v.box(1, 1, 8, 5, 5, 12, M.white);
  return v;
}

export type CatPose = 'sit' | 'walk';
export const CAT_FRAMES = 2;

// Miso: a small black cat with a red collar and lime eyes, about 8×5×7 voxels.
export function catModel(pose: CatPose, frame: number): Vox {
  const v = new Vox(8, 8, 8);
  v.box(2, 1, 0, 6, 7, 4, M.ink);
  v.box(2, 5, 3, 6, 8, 7, M.ink);
  v.box(2, 7, 5, 3, 8, 6, M.limeLit);
  v.box(5, 7, 5, 6, 8, 6, M.limeLit);
  v.box(2, 5, 3, 6, 6, 4, M.red);
  if (pose === 'walk' && frame === 1) v.box(3, 0, 2, 5, 1, 6, M.ink);
  return v;
}
