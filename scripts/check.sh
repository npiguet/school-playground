#!/usr/bin/env bash
# The CI-like gate: all tests + a production image build + e2e. Must be green at the end of every task.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
cd "$ROOT"
echo "== server: pytest";        scripts/pytest.sh -q
# `check` is svelte-check over src, then tsc over e2e/ and the Playwright configs (tsconfig.e2e.json:
# the main tsconfig excludes e2e, and Playwright only transpiles, so nothing else type-checks them).
echo "== web: svelte-check + e2e type-check"; scripts/npm.sh run check
echo "== web: vitest";           scripts/npm.sh run test
echo "== docker build";          docker build -t "$APP_IMAGE" .
echo "== e2e: playwright";       scripts/playwright.sh
echo "== ALL GREEN"
