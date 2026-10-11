#!/usr/bin/env bash
# Gameplay trailer, end to end: build -> saves -> recording -> trailer.mp4. See scripts/trailer/README.md.
#
#   scripts/trailer/run.sh <game checkout> <output dir> [--build <index.html>] [--capture screencast|video]
#
# <game checkout>  the version to film (its src/ and scripts/autopilot.ts are read, never changed)
# <output dir>     everything goes here (keep it OUT of git: the frames take ~1-2 GB)
# --build FILE     film this dist/index.html instead of building one (e.g. the exact file shipped in the Steam build)
# Needs: Node 20+, the game's node_modules (vite, esbuild), Playwright with Chromium, ffmpeg. On a machine without
# a screen nothing else is needed (Chromium runs headless).
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
game="$(cd "${1:?usage: run.sh <game checkout> <output dir>}" && pwd)"
out="${2:?usage: run.sh <game checkout> <output dir>}"
shift 2
build=""
capture="screencast"
while [ $# -gt 0 ]; do
  case "$1" in
    --build) build="$(realpath "$2")"; shift 2 ;;
    --capture) capture="$2"; shift 2 ;;
    *) echo "run.sh: unknown option $1" >&2; exit 2 ;;
  esac
done
mkdir -p "$out"
out="$(cd "$out" && pwd)"
for tool in node ffmpeg ffprobe; do command -v "$tool" >/dev/null || { echo "run.sh: $tool not found" >&2; exit 2; }; done

if [ -z "$build" ]; then
  echo "== 1/4 release build of $game"
  (cd "$game" && npx vite build --outDir "$out/build" --emptyOutDir --logLevel warn)
  build="$out/build/index.html"
fi
echo "== 2/4 saves (the game's autopilot plays the five campaign cities)"
node "$here/saves.mjs" --game "$game" --out "$out/saves.json"
echo "== 3/4 recording $build"
node "$here/record.mjs" --build "$build" --saves "$out/saves.json" --out "$out/rec" --capture "$capture" --debug
echo "== 4/4 trailer"
node "$here/assemble.mjs" --in "$out/rec" --out "$out/trailer.mp4"
echo "done: $out/trailer.mp4 (+ .contact.jpg, .thumbnail.jpg, .json); check it frame by frame before uploading"
