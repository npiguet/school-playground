#!/usr/bin/env sh
# Run the art tools inside a throwaway python:3.12-slim container with the repo
# mounted at /work. Nothing is installed on the host. Works from Git Bash on
# Windows (MSYS_NO_PATHCONV stops the path mangling of the -v argument).
#
# Two named Docker volumes cache the pip wheels and the rembg model weights
# (birefnet-general is ~900 MB) so only the first run downloads anything.
#
#   tools/art/run_docker.sh cutout  [--force] [paths]       # no paths = default targets: characters dragon lieutenants emblems props icons
#   tools/art/run_docker.sh webify  [extra webify.py args]
#   tools/art/run_docker.sh icons   [webp|sheet|app|all]     # web/public/art/icons/*.webp (256 px), docs/art/icons-sheet.png, web/public/icons/*.png
#   tools/art/run_docker.sh all
set -eu
REPO=$(cd "$(dirname "$0")/../.." && (pwd -W 2>/dev/null || pwd))
MODE=${1:-all}; shift || true
PINS="'rembg[cpu]==2.0.85' onnxruntime==1.30.0 pillow==12.3.0 numpy==2.5.3 scipy==1.18.1 PyMatting==1.1.16"
TARGETS="assets/art/characters assets/art/dragon assets/art/lieutenants assets/art/emblems assets/art/props assets/art/icons"
# cutout: the default folders are used only when no path is given, so `cutout --force one.png`
# re-cuts that one file instead of every default folder. Options may come before or after paths.
HAS_PATH=0; SKIP=0
for arg in "$@"; do
  if [ $SKIP = 1 ]; then SKIP=0; continue; fi
  case "$arg" in --model) SKIP=1 ;; -*) ;; *) HAS_PATH=1 ;; esac
done
case "$MODE" in
  cutout) if [ $HAS_PATH = 1 ]; then CMD="python tools/art/cutout.py $*"; else CMD="python tools/art/cutout.py $TARGETS $*"; fi ;;
  webify) CMD="python tools/art/webify.py $*" ;;
  icons)  CMD="python tools/art/icons.py ${*:-all}" ;;
  all)    CMD="python tools/art/cutout.py $TARGETS && python tools/art/webify.py && python tools/art/icons.py all" ;;
  *) echo "usage: $0 cutout|webify|icons|all [args]" >&2; exit 2 ;;
esac
MSYS_NO_PATHCONV=1 docker run --rm -v "$REPO:/work" -w /work \
  -v art-pip-cache:/root/.cache/pip -v art-rembg-cache:/root/.rembg \
  python:3.12-slim \
  sh -c "pip install -q --root-user-action=ignore $PINS >/dev/null && $CMD"
