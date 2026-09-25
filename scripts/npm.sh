#!/usr/bin/env bash
# Run npm inside the node:22 container, in web/. Example: scripts/npm.sh run test
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
ensure_volumes
run_npm "$@"
