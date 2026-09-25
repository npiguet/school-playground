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

# One id per checkout, so two checkouts (e.g. two git worktrees) can run their e2e stacks side by
# side. Unset (the main checkout) keeps the historical names; STACK=b gives discorde-b everywhere:
# the compose project (its own network, where the app keeps the `discorde` alias), the app image
# tag and the node_modules volume. The npm cache volume stays shared (npm's cache is safe to share).
STACK="${STACK:-}"
if [ -n "$STACK" ]; then
  case "$STACK" in
    *[!a-z0-9_-]*) echo "STACK must use lowercase letters, digits, - or _ (got '$STACK')" >&2; exit 2 ;;
  esac
  STACK_NAME="discorde-$STACK"
else
  STACK_NAME="discorde"
fi
export COMPOSE_PROJECT_NAME="$STACK_NAME"

TTY_FLAGS=""
# No -it: nothing in this toolchain is interactive, and docker run -it fails under
# mintty (Git Bash's default terminal) with "the input device is not a TTY".

NODE_IMAGE="node:22"
# The single source of the Playwright image version (compose.e2e.yaml reads it from the
# environment). Keep it equal to @playwright/test in web/package.json.
export PLAYWRIGHT_VERSION="1.63.0"
SERVER_DEV_IMAGE="discorde-server-dev"
# Exported: compose.e2e.yaml and compose.dev.yaml substitute them.
export APP_IMAGE="$STACK_NAME:local"
export NODE_MODULES_VOLUME="$STACK_NAME-web-node_modules"
NPM_CACHE_VOLUME="discorde-npm-cache"

ensure_volumes() {
  docker volume inspect "$NPM_CACHE_VOLUME" >/dev/null 2>&1 || docker volume create "$NPM_CACHE_VOLUME" >/dev/null
  if ! docker volume inspect "$NODE_MODULES_VOLUME" >/dev/null 2>&1; then
    docker volume create "$NODE_MODULES_VOLUME" >/dev/null
    # A new stack's node_modules starts empty: install from the lockfile once.
    echo "== $NODE_MODULES_VOLUME is new: npm ci"
    docker run --rm       -v "$HOST_ROOT:/work"       -v "$NODE_MODULES_VOLUME:/work/web/node_modules"       -v "$NPM_CACHE_VOLUME:/root/.npm"       -w /work/web -e CI=true       "$NODE_IMAGE" npm ci >/dev/null
  fi
}

build_server_dev_image() {
  # Anything handed to docker/docker compose as a path uses $HOST_ROOT (or is relative
  # after `cd "$ROOT"`); $ROOT itself is only for bash's own file operations.
  docker build -q -t "$SERVER_DEV_IMAGE" -f "$HOST_ROOT/server/Dockerfile.dev" "$HOST_ROOT/server" >/dev/null
}
