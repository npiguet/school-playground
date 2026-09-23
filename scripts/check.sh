#!/usr/bin/env bash
# The CI-like gate: all tests + a production image build + e2e. Must be green at the end of every task.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
cd "$ROOT"
echo "== server: pytest";        scripts/pytest.sh -q
echo "== web: svelte-check";     scripts/npm.sh run check
echo "== web: vitest";           scripts/npm.sh run test
echo "== docker build";          docker build -t "$APP_IMAGE" .
echo "== e2e: playwright";       scripts/playwright.sh
echo "== ALL GREEN"
