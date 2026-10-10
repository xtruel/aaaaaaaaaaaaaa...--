// factory: placeholder until its own model is made (see hq.ts, recycler.ts, dock.ts for real ones).
import { M } from '../palette';
import { placeholder } from './common';
import type { BuildingArt } from './common';

export const factory: BuildingArt = placeholder(3, 2, 22, M.purple, M.purpleD);
