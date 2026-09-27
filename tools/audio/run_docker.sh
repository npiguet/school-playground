#!/usr/bin/env bash
# Runs tools/audio/process.py in a throwaway container with ffmpeg (image discorde-audio-tools, built
# from tools/audio/Dockerfile); nothing is installed on the host. Works from Git Bash on
# Windows (MSYS_NO_PATHCONV, exported by scripts/lib.sh, stops the path mangling of the -v argument).
# Bash, not sh (final review M14): scripts/lib.sh uses BASH_SOURCE, pipefail and local.
# Holds the machine-wide Playwright lock while ffmpeg runs, releasing it right after: its CPU burst
# starves the e2e browsers (Rulings W-e, F4). `with_playwright_lock` is the same lock helper
# scripts/playwright.sh uses (scripts/lib.sh); do not copy the lock logic here.
#
#   tools/audio/run_docker.sh fetch                                  # downloads the sources, checks their sha256
#   tools/audio/run_docker.sh measure assets/audio/staging/<file>   # duration, loudness, true peak
#   tools/audio/run_docker.sh build [slot ...]                       # all slots when none given
#   tools/audio/run_docker.sh credits                                # rewrites ASSETS-LICENSES.md's sound section
set -eu
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO=$(cd "$HERE/../.." && (pwd -W 2>/dev/null || pwd))
# Final review I6: the tag is the Dockerfile's own hash, so a changed Dockerfile (a new pin) builds a
# new image instead of reusing the old one.
IMAGE=discorde-audio-tools:$(sha256sum "$HERE/Dockerfile" | cut -c1-12)
docker image inspect "$IMAGE" >/dev/null 2>&1 || docker build -t "$IMAGE" "$REPO/tools/audio"
# shellcheck source=../../scripts/lib.sh
source "$HERE/../../scripts/lib.sh"
#   tools/audio/run_docker.sh analyze <file ...>                     # band shares, onsets, flicker, periodicity
#   tools/audio/run_docker.sh --sources <json> --out <dir> fetch|build   # a staging round (candidates):
#       another sources file, built into <dir> (+ measurements.json); web/public/audio untouched
cmd=""
skip=0
for a in "$@"; do
  if [ "$skip" = 1 ]; then skip=0; continue; fi
  case "$a" in --sources|--out) skip=1 ;; *) cmd="$a"; break ;; esac
done
if [ "$cmd" = "fetch" ]; then
  # Network only, no ffmpeg: no need to hold the Playwright lock.
  docker run --rm -v "$REPO:/work" -w /work "$IMAGE" python tools/audio/process.py "$@"
else
  with_playwright_lock docker run --rm -v "$REPO:/work" -w /work "$IMAGE" python tools/audio/process.py "$@"
fi
