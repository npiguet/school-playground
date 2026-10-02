#!/usr/bin/env bash
# The voice walk (Kokoro plan, Task 10): the e2e stack with the real voice (TTS_STUB=0), then
# web/e2e/voice-walk.spec.ts; the `tts` container is stopped and started when the spec writes its
# marker files (web/.cache/voice-walk/stop-tts, start-tts), and both containers' memory is sampled
# about every 4 s: `docker stats --no-stream` takes about 2 s itself, then a 2 s sleep
# (memory-rest.txt once the stack is healthy, memory-samples.txt meanwhile). Holds the
# machine-wide Playwright lock throughout (scripts/lib.sh). Logs: web/.cache/voice-walk/{app,tts}.log.
#
#   tools/tts/voice_walk.sh
set -euo pipefail
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=../../scripts/lib.sh
source "$HERE/../../scripts/lib.sh"
cd "$ROOT"
export TTS_STUB=0
MARKS=web/.cache/voice-walk
E2E=(docker compose -f compose.e2e.yaml)
rm -rf "$MARKS"
mkdir -p "$MARKS"
ensure_volumes
"${E2E[@]}" build app tts

sample() {
  # shellcheck disable=SC2046 # one argument per container id
  docker stats --no-stream --format '{{.Name}} {{.MemUsage}}' $("${E2E[@]}" ps -q app tts) 2>/dev/null || true
}

walk() {
  local status=0
  if "${E2E[@]}" up -d --wait app tts; then
    sample > "$MARKS/memory-rest.txt"
    ( while [ ! -f "$MARKS/done" ]; do sample >> "$MARKS/memory-samples.txt"; sleep 2; done ) &
    local sampler=$!
    ( until [ -f "$MARKS/stop-tts" ] || [ -f "$MARKS/done" ]; do sleep 1; done
      [ -f "$MARKS/done" ] || "${E2E[@]}" stop tts
      until [ -f "$MARKS/start-tts" ] || [ -f "$MARKS/done" ]; do sleep 1; done
      [ -f "$MARKS/done" ] || "${E2E[@]}" start tts ) &
    local watcher=$!
    "${E2E[@]}" run --rm -T -e VOICE_WALK=1 playwright npx playwright test --config playwright.voice.config.ts voice-walk || status=$?
    touch "$MARKS/done"
    wait "$sampler" "$watcher" 2>/dev/null || true
  else
    status=1
  fi
  "${E2E[@]}" logs --no-color app > "$MARKS/app.log" 2>&1 || true
  "${E2E[@]}" logs --no-color tts > "$MARKS/tts.log" 2>&1 || true
  # Here, inside the lock, not only in the EXIT trap (which with_playwright_lock keeps and hands
  # back, so it runs again at exit, harmlessly): the stack must be down before the lock is released.
  "${E2E[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
  return $status
}

# Only for an exit before the lock is taken (a failed build); walk() tears the stack down itself.
trap 'touch "$MARKS/done"; "${E2E[@]}" down -v --remove-orphans >/dev/null 2>&1 || true' EXIT
set +e
with_playwright_lock walk
status=$?
set -e
echo "== memory at rest ($MARKS/memory-rest.txt)"
cat "$MARKS/memory-rest.txt" 2>/dev/null || echo "(none: the stack did not come up)"
echo "== memory samples: $MARKS/memory-samples.txt ($(cat "$MARKS/memory-samples.txt" 2>/dev/null | wc -l) lines)"
exit $status
