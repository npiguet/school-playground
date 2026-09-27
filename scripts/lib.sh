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
    # The app image of STACK=<x>-tts would be discorde-<x>-tts:local, the voice image of STACK=<x>
    # (TTS_IMAGE below; STACK=tts: discorde-tts:local, the main checkout's voice and compose.yaml's).
    tts | *-tts)
      echo "STACK must not be 'tts' or end in '-tts' (got '$STACK'): its app image would take the name of another stack's voice image" >&2
      exit 2 ;;
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
# The dictation voice's service (tts/, Kokoro plan): its image and its test image, per stack like the
# app's. compose*.yaml read TTS_IMAGE; scripts/tts-pytest.sh builds and runs the test image.
export TTS_IMAGE="$STACK_NAME-tts:local"
TTS_TEST_IMAGE="$STACK_NAME-tts-test"
NPM_CACHE_VOLUME="discorde-npm-cache"

# The install records which package-lock.json it came from (its sha256, in the volume), so a lockfile
# that changed since (a merged dependency bump) is reinstalled rather than run against stale
# modules. A file at the root of the node_modules volume.
LOCK_STAMP=".discorde-lock.sha256"

# npm inside the node container, in web/, with this stack's node_modules and the shared cache. A
# successful `ci` or `install` stamps the volume with the lockfile it installed (`npm ci` empties
# node_modules first, stamp included), whoever ran it: ensure_volumes or `scripts/npm.sh ci`.
run_npm() {
  local stamp=""
  case "${1:-}" in ci | install | i) stamp=1 ;; esac
  docker run --rm $TTY_FLAGS \
    -v "$HOST_ROOT:/work" \
    -v "$NODE_MODULES_VOLUME:/work/web/node_modules" \
    -v "$NPM_CACHE_VOLUME:/root/.npm" \
    -w /work/web -e CI=true -e STAMP="$stamp" -e LOCK_STAMP="node_modules/$LOCK_STAMP" \
    "$NODE_IMAGE" sh -c 'npm "$@" && { [ -z "$STAMP" ] || sha256sum package-lock.json | cut -d" " -f1 >"$LOCK_STAMP"; }' npm "$@"
}

# An install is complete once npm has written its hidden lockfile, the last step of `npm ci`: a
# volume that merely exists (an interrupted or failed install) does not count. It is current when
# its stamp matches today's package-lock.json.
node_modules_ready() {
  docker volume inspect "$NODE_MODULES_VOLUME" >/dev/null 2>&1 &&
    docker run --rm -v "$HOST_ROOT/web/package-lock.json:/lock/package-lock.json:ro" -v "$NODE_MODULES_VOLUME:/nm:ro" \
      -e LOCK_STAMP="/nm/$LOCK_STAMP" "$NODE_IMAGE" sh -c 'test -f /nm/.package-lock.json &&
        [ "$(cat "$LOCK_STAMP" 2>/dev/null)" = "$(sha256sum /lock/package-lock.json | cut -d" " -f1)" ]'
}

# One install per stack at a time (two scripts started together on a fresh or stale stack): a
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
  echo "== $NODE_MODULES_VOLUME has no complete install, or one older than package-lock.json: npm ci"
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

# One CPU-heavy run at a time on this machine, whatever the stack, worktree or caller: Playwright's
# browsers (scripts/playwright.sh) and the audio tools' ffmpeg (tools/audio/run_docker.sh, Ruling
# F4) all starve each other's rendering/encoding if they overlap, so both wait on the same lock. A
# mkdir lock in the host temp dir, outside every checkout; the holder writes its PID, stack and start
# time. A holder whose PID is gone (killed, crashed) is taken over. PLAYWRIGHT_LOCK_WAIT (seconds,
# default 7200) bounds the wait. Usage: `with_playwright_lock <command> [args...]` runs the command
# while holding the lock and releases it as soon as the command finishes (whatever its exit status),
# returning that status.
PLAYWRIGHT_LOCK="${TMPDIR:-${TMP:-/tmp}}/discorde-e2e.lock"
with_playwright_lock() {
  local waited=0 said="" lock_owned=0
  local wait_max="${PLAYWRIGHT_LOCK_WAIT:-7200}"
  _playwright_lock_release() {
    if [ "$lock_owned" = 1 ] && [ "$(sed -n 1p "$PLAYWRIGHT_LOCK/owner" 2>/dev/null)" = "$$" ]; then
      rm -rf "$PLAYWRIGHT_LOCK"
    fi
    lock_owned=0
  }
  while :; do
    if mkdir "$PLAYWRIGHT_LOCK" 2>/dev/null; then
      printf '%s\n%s\n%s\n' "$$" "$STACK_NAME" "$(date '+%Y-%m-%d %H:%M:%S')" > "$PLAYWRIGHT_LOCK/owner"
      lock_owned=1
      trap _playwright_lock_release EXIT
      trap '_playwright_lock_release; exit 130' INT TERM
      break
    fi
    local pid stack started
    pid="$(sed -n 1p "$PLAYWRIGHT_LOCK/owner" 2>/dev/null || true)"
    stack="$(sed -n 2p "$PLAYWRIGHT_LOCK/owner" 2>/dev/null || true)"
    started="$(sed -n 3p "$PLAYWRIGHT_LOCK/owner" 2>/dev/null || true)"
    # No owner file a minute after its mkdir: the holder died before writing it.
    if [ -z "$pid" ] && [ -n "$(find "$PLAYWRIGHT_LOCK" -maxdepth 0 -mmin +1 2>/dev/null)" ]; then
      rm -rf "$PLAYWRIGHT_LOCK"
      continue
    fi
    if [ -n "$pid" ] && ! kill -0 "$pid" 2>/dev/null; then
      # Stale: move it aside atomically, and put it back if another taker got there first.
      local aside="$PLAYWRIGHT_LOCK.stale.$$"
      if mv "$PLAYWRIGHT_LOCK" "$aside" 2>/dev/null; then
        if [ "$(sed -n 1p "$aside/owner" 2>/dev/null)" = "$pid" ]; then
          echo "playwright lock: taking over from stack $stack (PID $pid, started $started), which is gone" >&2
          rm -rf "$aside"
        else
          mv "$aside" "$PLAYWRIGHT_LOCK" 2>/dev/null || rm -rf "$aside"
        fi
      fi
      continue
    fi
    if [ "$waited" -ge "$wait_max" ]; then
      echo "playwright lock: gave up after ${wait_max}s waiting for stack ${stack:-?} (PID ${pid:-?}, started ${started:-?}); lock: $PLAYWRIGHT_LOCK" >&2
      return 1
    fi
    if [ "$said" != "$pid" ]; then
      echo "playwright lock: waiting for the run of stack ${stack:-?} started at ${started:11:5} (PID ${pid:-?})" >&2
      said="$pid"
    fi
    sleep 5
    waited=$((waited + 5))
  done
  "$@"
  local status=$?
  _playwright_lock_release
  trap - EXIT INT TERM
  return $status
}
