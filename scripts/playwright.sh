#!/usr/bin/env bash
# Build the production image, start it, run Playwright against it, tear down.
# Example: scripts/playwright.sh                                     (all e2e specs)
#          scripts/playwright.sh --config playwright.playability.config.ts
#          STACK=b scripts/playwright.sh                             (a second stack, side by side)
#          PW_WORKERS=4 scripts/playwright.sh                        (fewer workers; 8 when unset)
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
# The browsers in the image must match the @playwright/test the specs run with.
if ! grep -q "\"@playwright/test\": \"$PLAYWRIGHT_VERSION\"" "$ROOT/web/package.json"; then
  echo "PLAYWRIGHT_VERSION ($PLAYWRIGHT_VERSION, scripts/lib.sh) differs from @playwright/test in web/package.json" >&2
  exit 2
fi
ensure_volumes
cd "$ROOT"
docker compose -f compose.e2e.yaml build app
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
