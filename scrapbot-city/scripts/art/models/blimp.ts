// The 2PM advertising blimp that drifts over the city now and then. Placeholder until the real model is made.
import { M } from '../palette';
import { Vox } from '../voxel';

export const BLIMP_FRAMES = 2;

export function blimpModel(frame: number): Vox {
  const v = new Vox(40, 14, 16);
  v.cylX(7, 9, 6, 2, 38, M.white);
  v.box(16, 6, 1, 24, 9, 4, M.pinkD);
  v.box(0, 6 + (frame % 2), 8, 3, 8 + (frame % 2), 10, M.steelL);
  return v;
}
