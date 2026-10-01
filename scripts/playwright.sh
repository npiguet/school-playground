#!/usr/bin/env bash
# Build the production images (the game and its voice, as its stub), start them, run Playwright
# against them, tear down.
# Example: scripts/playwright.sh                                     (all e2e specs)
#          scripts/playwright.sh --config playwright.playability.config.ts
#          STACK=b scripts/playwright.sh                             (a second stack, side by side)
#          PW_WORKERS=4 scripts/playwright.sh                        (fewer workers; 8 when unset)
#          TTS_STUB=0 scripts/playwright.sh --config playwright.voice.config.ts voice-real   (the real voice)
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
# The browsers in the image must match the @playwright/test the specs run with.
if ! grep -q "\"@playwright/test\": \"$PLAYWRIGHT_VERSION\"" "$ROOT/web/package.json"; then
  echo "PLAYWRIGHT_VERSION ($PLAYWRIGHT_VERSION, scripts/lib.sh) differs from @playwright/test in web/package.json" >&2
  exit 2
fi
# One run per stack: a second one would tear this one's containers down under it (scripts/lib.sh).
claim_stack_run
ensure_volumes
cd "$ROOT"
docker compose -f compose.e2e.yaml build app tts

# One Playwright run at a time on this machine, whatever the stack or worktree (fix round 2 of
# batch B4: two stacks at once starved WebKit's rendering, overlays froze mid-transition and the
# host crashed) — and the audio tools' ffmpeg besides (Ruling F4: its CPU burst starves the e2e
# browsers just the same). `with_playwright_lock` (scripts/lib.sh) is the one lock, shared with
# tools/audio/run_docker.sh. Only this step waits: builds, vitest, svelte-check and pytest stay
# parallel. PLAYWRIGHT_LOCK_WAIT (seconds, default 7200) bounds the wait.
set +e
# `npx playwright test "$@"`, plus the crash-only retry (Ruling F3): a test whose browser crashed
# (upstream WebKit) runs once more; any other failure never does.
with_playwright_lock docker compose -f compose.e2e.yaml run --rm -T playwright node scripts/playwright-crash-retry.mjs "$@"
status=$?
set -e
# The app container (and its log) dies with `down` below: keep the server's side of a failure (a
# 500's traceback) next to Playwright's screenshots.
if [ "$status" -ne 0 ]; then
  mkdir -p web/test-results
  docker compose -f compose.e2e.yaml logs --no-color app > web/test-results/app.log 2>&1 || true
  docker compose -f compose.e2e.yaml logs --no-color tts > web/test-results/tts.log 2>&1 || true
  echo "server logs: web/test-results/app.log, web/test-results/tts.log"
fi
docker compose -f compose.e2e.yaml down -v --remove-orphans
exit $status
