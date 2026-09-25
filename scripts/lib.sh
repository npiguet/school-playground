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
# the compose project (its own network, where the app keeps the `discorde` alias), the app and
# server dev image tags and the node_modules volume. The npm cache volume stays shared (npm's cache
# is safe to share).
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
# Exported: compose.e2e.yaml and compose.dev.yaml substitute them. The server dev image is per stack
# too: two checkouts building a different server/Dockerfile.dev would otherwise retag one shared
# image between another script's build and its `docker run`.
export APP_IMAGE="$STACK_NAME:local"
export NODE_MODULES_VOLUME="$STACK_NAME-web-node_modules"
export SERVER_DEV_IMAGE="$STACK_NAME-server-dev"
NPM_CACHE_VOLUME="discorde-npm-cache"

# npm inside the node container, in web/, with this stack's node_modules and the shared cache.
run_npm() {
  docker run --rm $TTY_FLAGS \
    -v "$HOST_ROOT:/work" \
    -v "$NODE_MODULES_VOLUME:/work/web/node_modules" \
    -v "$NPM_CACHE_VOLUME:/root/.npm" \
    -w /work/web -e CI=true \
    "$NODE_IMAGE" npm "$@"
}

# An install is complete once npm has written its hidden lockfile, the last step of `npm ci`: a
# volume that merely exists (an interrupted or failed install) does not count.
node_modules_ready() {
  docker volume inspect "$NODE_MODULES_VOLUME" >/dev/null 2>&1 &&
    docker run --rm -v "$NODE_MODULES_VOLUME:/nm:ro" "$NODE_IMAGE" test -f /nm/.package-lock.json
}

# One first install per stack at a time (two scripts started together on a fresh stack): a
# mkdir lock (atomic; Git Bash has no flock) holding the owner's pid, so a lock left behind by a
# killed shell is taken over.
_LOCK_DIR="${TMPDIR:-/tmp}/discorde-install-$STACK_NAME.lock"
_lock_install() {
  local waited=0
  until mkdir "$_LOCK_DIR" 2>/dev/null; do
    local owner
    owner="$(cat "$_LOCK_DIR/pid" 2>/dev/null || true)"
    if [ -n "$owner" ] && ! kill -0 "$owner" 2>/dev/null; then
      rm -rf "$_LOCK_DIR"
      continue
    fi
    if [ "$waited" -ge 900 ]; then
      echo "timed out waiting for $_LOCK_DIR (another npm ci for $STACK_NAME)" >&2
      exit 1
    fi
    sleep 2
    waited=$((waited + 2))
  done
  echo $$ >"$_LOCK_DIR/pid"
}
_unlock_install() {
  rm -rf "$_LOCK_DIR"
}
# Interrupted mid-install: drop the partial volume (the next run installs again) and the lock.
_abort_install() {
  docker volume rm -f "$NODE_MODULES_VOLUME" >/dev/null 2>&1 || true
  _unlock_install
}

ensure_volumes() {
  docker volume inspect "$NPM_CACHE_VOLUME" >/dev/null 2>&1 || docker volume create "$NPM_CACHE_VOLUME" >/dev/null
  node_modules_ready && return 0
  _lock_install
  # Another script may have finished the install while this one waited for the lock.
  if node_modules_ready; then
    _unlock_install
    return 0
  fi
  echo "== $NODE_MODULES_VOLUME has no complete install: npm ci"
  trap '_abort_install; exit 130' INT TERM
  trap '_abort_install' EXIT
  docker volume create "$NODE_MODULES_VOLUME" >/dev/null
  if ! run_npm ci >/dev/null || ! node_modules_ready; then
    echo "npm ci failed for $NODE_MODULES_VOLUME; the partial volume was removed" >&2
    exit 1
  fi
  trap - INT TERM EXIT
  _unlock_install
}

build_server_dev_image() {
  # Anything handed to docker/docker compose as a path uses $HOST_ROOT (or is relative
  # after `cd "$ROOT"`); $ROOT itself is only for bash's own file operations.
  docker build -q -t "$SERVER_DEV_IMAGE" -f "$HOST_ROOT/server/Dockerfile.dev" "$HOST_ROOT/server" >/dev/null
}
