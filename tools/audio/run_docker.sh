#!/usr/bin/env sh
# Runs tools/audio/process.py in a throwaway container with ffmpeg (image discorde-audio-tools, built
# once from tools/audio/Dockerfile); nothing is installed on the host. Works from Git Bash on
# Windows (MSYS_NO_PATHCONV, exported by scripts/lib.sh, stops the path mangling of the -v argument).
# Holds the machine-wide Playwright lock while ffmpeg runs, releasing it right after: its CPU burst
# starves the e2e browsers (Rulings W-e, F4). `with_playwright_lock` is the same lock helper
# scripts/playwright.sh uses (scripts/lib.sh); do not copy the lock logic here.
#
#   tools/audio/run_docker.sh measure assets/audio/staging/<file>   # duration, loudness, true peak
#   tools/audio/run_docker.sh build [slot ...]                       # all slots when none given
#   tools/audio/run_docker.sh credits                                # rewrites ASSETS-LICENSES.md's sound section
set -eu
REPO=$(cd "$(dirname "$0")/../.." && (pwd -W 2>/dev/null || pwd))
IMAGE=discorde-audio-tools:1
docker image inspect "$IMAGE" >/dev/null 2>&1 || docker build -t "$IMAGE" "$REPO/tools/audio"
# shellcheck source=../../scripts/lib.sh
. "$(dirname "$0")/../../scripts/lib.sh"
with_playwright_lock docker run --rm -v "$REPO:/work" -w /work "$IMAGE" python tools/audio/process.py "$@"
