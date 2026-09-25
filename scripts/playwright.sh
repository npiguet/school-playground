#!/usr/bin/env bash
# Build the production image, start it, run Playwright against it, tear down.
# Example: scripts/playwright.sh                                     (all e2e specs)
#          scripts/playwright.sh --config playwright.playability.config.ts
#          STACK=b scripts/playwright.sh                             (a second stack, side by side)
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
# The browsers in the image must match the @playwright/test the specs run with.
if ! grep -q "\"@playwright/test\": \"$PLAYWRIGHT_VERSION\"" "$ROOT/web/package.json"; then
  echo "PLAYWRIGHT_VERSION ($PLAYWRIGHT_VERSION, scripts/lib.sh) differs from @playwright/test in web/package.json" >&2
  exit 2
fi
ensure_volumes
cd "$ROOT"
docker compose -f compose.e2e.yaml build app

# One Playwright run at a time on this machine, whatever the stack or worktree (fix round 2 of
# batch B4: two stacks at once starved WebKit's rendering, overlays froze mid-transition and the
# host crashed). A mkdir lock in the host temp dir, outside every checkout; the holder writes its
# PID, stack and start time. A holder whose PID is gone (killed, crashed) is taken over. Only this
# step waits: builds, vitest, svelte-check and pytest stay parallel. E2E_LOCK_WAIT (seconds,
# default 7200) bounds the wait.
E2E_LOCK="${TMPDIR:-${TMP:-/tmp}}/discorde-e2e.lock"
E2E_LOCK_WAIT="${E2E_LOCK_WAIT:-7200}"
e2e_lock_owned=0
e2e_lock_release() {
  if [ "$e2e_lock_owned" = 1 ] && [ "$(sed -n 1p "$E2E_LOCK/owner" 2>/dev/null)" = "$$" ]; then
    rm -rf "$E2E_LOCK"
  fi
  e2e_lock_owned=0
}
e2e_lock_acquire() {
  local waited=0 said=""
  while :; do
    if mkdir "$E2E_LOCK" 2>/dev/null; then
      printf '%s\n%s\n%s\n' "$$" "$STACK_NAME" "$(date '+%Y-%m-%d %H:%M:%S')" > "$E2E_LOCK/owner"
      e2e_lock_owned=1
      trap e2e_lock_release EXIT
      trap 'e2e_lock_release; exit 130' INT TERM
      return 0
    fi
    local pid stack started
    pid="$(sed -n 1p "$E2E_LOCK/owner" 2>/dev/null || true)"
    stack="$(sed -n 2p "$E2E_LOCK/owner" 2>/dev/null || true)"
    started="$(sed -n 3p "$E2E_LOCK/owner" 2>/dev/null || true)"
    # No owner file a minute after its mkdir: the holder died before writing it.
    if [ -z "$pid" ] && [ -n "$(find "$E2E_LOCK" -maxdepth 0 -mmin +1 2>/dev/null)" ]; then
      rm -rf "$E2E_LOCK"
      continue
    fi
    if [ -n "$pid" ] && ! kill -0 "$pid" 2>/dev/null; then
      # Stale: move it aside atomically, and put it back if another taker got there first.
      local aside="$E2E_LOCK.stale.$$"
      if mv "$E2E_LOCK" "$aside" 2>/dev/null; then
        if [ "$(sed -n 1p "$aside/owner" 2>/dev/null)" = "$pid" ]; then
          echo "e2e lock: taking over from stack $stack (PID $pid, started $started), which is gone" >&2
          rm -rf "$aside"
        else
          mv "$aside" "$E2E_LOCK" 2>/dev/null || rm -rf "$aside"
        fi
      fi
      continue
    fi
    if [ "$waited" -ge "$E2E_LOCK_WAIT" ]; then
      echo "e2e lock: gave up after ${E2E_LOCK_WAIT}s waiting for stack ${stack:-?} (PID ${pid:-?}, started ${started:-?}); lock: $E2E_LOCK" >&2
      return 1
    fi
    if [ "$said" != "$pid" ]; then
      echo "e2e lock: waiting for the e2e run of stack ${stack:-?} started at ${started:11:5} (PID ${pid:-?})" >&2
      said="$pid"
    fi
    sleep 5
    waited=$((waited + 5))
  done
}
e2e_lock_acquire

set +e
docker compose -f compose.e2e.yaml run --rm -T playwright npx playwright test "$@"
status=$?
set -e
# The app container (and its log) dies with `down` below: keep the server's side of a failure (a
# 500's traceback) next to Playwright's screenshots.
if [ "$status" -ne 0 ]; then
  mkdir -p web/test-results
  docker compose -f compose.e2e.yaml logs --no-color app > web/test-results/app.log 2>&1 || true
  echo "server log: web/test-results/app.log"
fi
docker compose -f compose.e2e.yaml down -v --remove-orphans
exit $status
