#!/usr/bin/env bash
# Build the production image, start it, run Playwright against it, tear down.
# Example: scripts/playwright.sh                                     (all e2e specs)
#          scripts/playwright.sh --config playwright.playability.config.ts
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
ensure_volumes
cd "$ROOT"
docker compose -f compose.e2e.yaml build app
set +e
docker compose -f compose.e2e.yaml run --rm -T playwright npx playwright test "$@"
status=$?
set -e
docker compose -f compose.e2e.yaml down -v --remove-orphans
exit $status
