3 verified fixes, mixed in one diff (split when opening PRs):
1. lib/math/arc-utils.ts - scale too-small arc radii like SVG (C609652 pin-1 notch). Changes tests/arc-utils-semicircle.test.ts expectations. New test tests/c609652-silkscreen-notch-arc.test.ts.
2. lib/websafe/generate-footprint-tsx.ts - emit strokeWidth on silkscreenpath/silkscreencircle. ~45 snapshot files change (stroke-width only). New test tests/silkscreen-stroke-width-tsx.test.ts. 3D snapshots need regenerating with network.
3. lib/schemas/package-detail-shape-schema.ts - TEXT size from fontSize column (10-mil units) instead of stroke*2.54. New test tests/convert-to-soup-tests/silkscreen-text-font-size.test.ts. C9900017879-to-ts-rotation.snap.svg mixes changes from 2 and 3.
