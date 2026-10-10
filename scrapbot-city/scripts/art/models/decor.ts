// Scenery around the playable map (and nothing inside it): trees, containers, crates, barrels, cones, lamps,
// benches, a "BETTER ROBOTS" billboard, ruins, cranes, wind turbines. Placeholder list until it is filled in.
import { Vox } from '../voxel';

export interface DecorArt {
  name: string;
  w: number; // footprint in tiles (models are w*16 × d*16 voxels)
  d: number;
  frames: number; // animation frames (1 = static)
  fps: number;
  tall: boolean; // taller than ~10 voxels: only placed behind the map, never in front of it
  model(frame: number): Vox;
}

export const DECOR: DecorArt[] = [];
