// How much each animation frame differs from the next, rendered in memory (does not touch the atlas).
//   npx esbuild scripts/art/check-frames.ts --bundle --platform=node --format=esm --outfile=<tmp>/check.mjs --log-level=warning
//   node <tmp>/check.mjs [building type | all]
// Same measure as tests/art.test.ts: share of visible pixels that change. The test requires > 0.4% between
// consecutive working frames and > 0.2% between "off" and frame 0; aim for 2% or more so motion reads in game.
import { BUILDINGS } from '../../src/game/defs';
import type { BuildingType } from '../../src/game/defs';
import type { Image } from './png';
import { render } from './voxel';
import { ART } from './models/index';

function difference(A: Image, B: Image): number {
  if (A.w !== B.w || A.h !== B.h) return 1;
  let changed = 0;
  let visible = 0;
  for (let i = 0; i < A.data.length; i += 4) {
    const va = A.data[i + 3] > 0;
    const vb = B.data[i + 3] > 0;
    if (va || vb) visible++;
    if (va !== vb || Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2]) > 24) changed++;
  }
  return changed / Math.max(1, visible);
}

const arg = process.argv[2] ?? 'all';
const types = arg === 'all' ? (Object.keys(BUILDINGS) as BuildingType[]) : [arg as BuildingType];
let bad = 0;
for (const type of types) {
  const art = ART[type];
  const frames = Array.from({ length: art.frames }, (_, f) => render(art.model(f, true)).img);
  const off = render(art.model(0, false)).img;
  const steps = frames.map((img, f) => difference(img, frames[(f + 1) % frames.length]));
  const offDiff = difference(off, frames[0]);
  const weak = (art.frames > 1 && steps.some((d) => d <= 0.004)) || offDiff <= 0.002;
  if (weak) bad++;
  console.log(
    `${weak ? 'WEAK' : 'ok  '} ${type.padEnd(9)} frames ${art.frames} @ ${art.fps} fps  steps ${steps.map((d) => `${(d * 100).toFixed(1)}%`).join(' ')}  off-vs-work ${(offDiff * 100).toFixed(1)}%`,
  );
}
process.exitCode = bad ? 1 : 0;
