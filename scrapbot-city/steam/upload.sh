#!/usr/bin/env bash
# Uploads the Steam build (steam/content/windows + steam/content/linux) with SteamPipe.
#
#   steam/upload.sh <steam_build_account> [--beta <branch>] [--preview] [--desc "text"]
#
#   steam/upload.sh mybuilduser --preview      dry run: checks every file, uploads nothing (logs in steam/output)
#   steam/upload.sh mybuilduser --beta beta    upload and set the build live on the "beta" branch
#   steam/upload.sh mybuilduser                upload only; set it live by hand in Steamworks > SteamPipe > Builds
#
# No password here or in any file: steamcmd asks for it, and for the Steam Guard code, the first time,
# then remembers the login on this computer. Before the first upload fill in the App ID and depot IDs in
# steam/sdk/*.vdf and run "npm run dist:steam" (steam/README.md). steamcmd is looked up in $STEAMCMD,
# then on the PATH (steamcmd, steamcmd.sh), then in steam/steamcmd/steamcmd.sh.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
generated="$here/sdk/app_build.generated.vdf"

usage() {
  # the comment block at the top of this file
  awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "${BASH_SOURCE[0]}"
}

case "${1:-}" in
  '' | -h | --help)
    usage
    exit 2
    ;;
  -*)
    echo "The first argument must be your Steam build account name (see steam/README.md)." >&2
    exit 2
    ;;
esac
user="$1"

if ! command -v node >/dev/null 2>&1; then
  echo "node was not found: it is needed for the checks (the same Node.js used for npm run dist:steam)." >&2
  exit 1
fi

steamcmd="${STEAMCMD:-}"
if [ -z "$steamcmd" ]; then
  for candidate in "$(command -v steamcmd || true)" "$(command -v steamcmd.sh || true)" "$here/steamcmd/steamcmd.sh"; do
    if [ -n "$candidate" ] && [ -x "$candidate" ]; then
      steamcmd="$candidate"
      break
    fi
  done
fi

# Checks the IDs, the content folders and the options, then writes sdk/app_build.generated.vdf.
node "$here/prepare-upload.cjs" "$@"

trap 'rm -f "$generated"' EXIT

if [ -z "$steamcmd" ] || [ ! -x "$steamcmd" ]; then
  cat >&2 <<EOF

steamcmd was not found. Install it once (steam/README.md, step 3):
  Linux:  mkdir -p "$here/steamcmd" && cd "$here/steamcmd" &&
          curl -sSL https://steamcdn-a.akamaihd.net/client/installer/steamcmd_linux.tar.gz | tar -xz
          (on 64-bit Ubuntu/Debian it also needs: sudo apt install lib32gcc-s1)
  macOS:  mkdir -p "$here/steamcmd" && cd "$here/steamcmd" &&
          curl -sSL https://steamcdn-a.akamaihd.net/client/installer/steamcmd_osx.tar.gz | tar -xz
or point STEAMCMD at it: STEAMCMD=/path/to/steamcmd.sh steam/upload.sh $user ...
EOF
  exit 1
fi

mkdir -p "$here/output"
echo
echo "Running $steamcmd"
echo "Log in as $user: steamcmd asks for the password and the Steam Guard code the first time."
echo
status=0
"$steamcmd" +login "$user" +run_app_build "$generated" +quit || status=$?

echo
if [ "$status" -eq 0 ]; then
  echo "steamcmd finished. Look above for \"Successfully finished AppID ... build (BuildID ...)\";"
  echo "the build is then listed in Steamworks > SteamPipe > Builds. Logs: steam/output"
else
  echo "steamcmd failed (exit code $status). Read the messages above and the logs in steam/output;" >&2
  echo "steam/README.md lists the usual causes." >&2
fi
exit "$status"
