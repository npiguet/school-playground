#!/usr/bin/env bash
# Run npm inside the node:22 container, in web/. Example: scripts/npm.sh run test
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
ensure_volumes
docker run --rm $TTY_FLAGS \
  -v "$HOST_ROOT:/work" \
  -v "$NODE_MODULES_VOLUME:/work/web/node_modules" \
  -v "$NPM_CACHE_VOLUME:/root/.npm" \
  -w /work/web -e CI=true \
  "$NODE_IMAGE" npm "$@"
