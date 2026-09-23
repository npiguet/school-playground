#!/usr/bin/env bash
# Shared helpers for the Docker wrapper scripts. Source this file; do not run it.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Docker Desktop on Windows wants C:/... style paths; Git Bash gives /c/....
if command -v cygpath >/dev/null 2>&1; then
  HOST_ROOT="$(cygpath -m "$ROOT")"
else
  HOST_ROOT="$ROOT"
fi
# Stop MSYS from rewriting container paths like /work/web into C:\...\work\web.
export MSYS_NO_PATHCONV=1
export COMPOSE_PROJECT_NAME=discorde

TTY_FLAGS=""
# No -it: nothing in this toolchain is interactive, and docker run -it fails under
# mintty (Git Bash's default terminal) with "the input device is not a TTY".

NODE_IMAGE="node:22"
PLAYWRIGHT_VERSION="1.55.0"
PLAYWRIGHT_IMAGE="mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble"
SERVER_DEV_IMAGE="discorde-server-dev"
APP_IMAGE="discorde:local"
NODE_MODULES_VOLUME="discorde-web-node_modules"
NPM_CACHE_VOLUME="discorde-npm-cache"

ensure_volumes() {
  for v in "$NODE_MODULES_VOLUME" "$NPM_CACHE_VOLUME"; do
    docker volume inspect "$v" >/dev/null 2>&1 || docker volume create "$v" >/dev/null
  done
}

build_server_dev_image() {
  # Anything handed to docker/docker compose as a path uses $HOST_ROOT (or is relative
  # after `cd "$ROOT"`); $ROOT itself is only for bash's own file operations.
  docker build -q -t "$SERVER_DEV_IMAGE" -f "$HOST_ROOT/server/Dockerfile.dev" "$HOST_ROOT/server" >/dev/null
}
