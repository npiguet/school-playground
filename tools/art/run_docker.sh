#!/usr/bin/env sh
# Run the art tools inside a throwaway python:3.12-slim container with the repo
# mounted at /work. Nothing is installed on the host. Works from Git Bash on
# Windows (MSYS_NO_PATHCONV stops the path mangling of the -v argument).
#
# Two named Docker volumes cache the pip wheels and the rembg model weights
# (birefnet-general is ~900 MB) so only the first run downloads anything.
#
#   tools/art/run_docker.sh cutout  [extra cutout.py args]   # default targets: characters dragon lieutenants emblems
#   tools/art/run_docker.sh webify  [extra webify.py args]
#   tools/art/run_docker.sh all
set -eu
REPO=$(cd "$(dirname "$0")/../.." && pwd -W 2>/dev/null || cd "$(dirname "$0")/../.." && pwd)
MODE=${1:-all}; shift || true
PINS="'rembg[cpu]==2.0.85' onnxruntime==1.30.0 pillow==12.3.0 numpy==2.5.3 scipy==1.18.1 PyMatting==1.1.16"
case "$MODE" in
  cutout) CMD="python tools/art/cutout.py assets/art/characters assets/art/dragon assets/art/lieutenants assets/art/emblems $*" ;;
  webify) CMD="python tools/art/webify.py $*" ;;
  all)    CMD="python tools/art/cutout.py assets/art/characters assets/art/dragon assets/art/lieutenants assets/art/emblems && python tools/art/webify.py" ;;
  *) echo "usage: $0 cutout|webify|all [args]" >&2; exit 2 ;;
esac
MSYS_NO_PATHCONV=1 docker run --rm -v "$REPO:/work" -w /work \
  -v art-pip-cache:/root/.cache/pip -v art-rembg-cache:/root/.rembg \
  python:3.12-slim \
  sh -c "pip install -q --root-user-action=ignore $PINS >/dev/null && $CMD"
