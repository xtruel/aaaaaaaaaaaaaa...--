# tscircuit bug backlog

Verified fixes (each has a regression test that fails on the base commit and passes with the fix),
waiting to be opened as PRs on the planned weekly schedule.

## Already pushed as branches on forks (no PR yet)
- xtruel/circuit-to-svg: fix/sch-table-edge-anchors, fix/sch-rotation-bounds-radians (check overlap with upstream PR #907 first),
  fix/sch-color-overrides, fix/pcb-fab-note-dimension-overlay, fix/pcb-inner-layer-trace-soldermask-color, fix/pcb-cutout-path-slot-width
- xtruel/footprinter: fix/sot23-8-pitch, fix/dpak-five-lead-pitch
- xtruel/circuit-json-to-kicad: fix/library-footprint-rotated-pads, fix/board-silkscreen-rect

## Stored here (no fork yet)
- core/ : lib-fixes.diff (CopperText bottom-layer flip, Battery voltage, PinHeader rightAngle, PinHeader hole/plated diameter without pitch) + tests/. Base: core/BASE_COMMIT.
  Split per bug when opening PRs (Battery.ts, CopperText.ts, PinHeader.ts; the two PinHeader fixes share one file).
- schematic-symbols/ : all-fixes.diff (avalanche diode polarity labels, mosfet_depletion_normally_on_vert size/text, battery_up/down height). Base: schematic-symbols/BASE_COMMIT.
  Snapshots in the diff were regenerated with all three fixes together; regenerate per bug (`bun run build && BUN_UPDATE_SNAPSHOTS=1 bun test tests/snapshot-svg.test.ts`).
