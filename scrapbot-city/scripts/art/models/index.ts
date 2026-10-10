// Every building type's art, by type. Each model lives in its own file.
import type { BuildingType } from '../../../src/game/defs';
import type { BuildingArt } from './common';
import { burner } from './burner';
import { dock } from './dock';
import { factory } from './factory';
import { fixlab } from './fixlab';
import { garden } from './garden';
import { hq } from './hq';
import { pods } from './pods';
import { purifier } from './purifier';
import { recycler } from './recycler';
import { smelter } from './smelter';
import { solar } from './solar';
import { spire } from './spire';

export const ART: Record<BuildingType, BuildingArt> = { hq, dock, recycler, smelter, solar, burner, pods, garden, factory, fixlab, purifier, spire };
