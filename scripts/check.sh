#!/usr/bin/env bash
# The CI-like gate: all tests + the production image builds (the game and its voice) + e2e. Must be
# green at the end of every task.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
cd "$ROOT"
echo "== server: pytest";        scripts/pytest.sh -q
echo "== tts: pytest";           scripts/tts-pytest.sh -q
# `check` is svelte-check over src, then tsc over e2e/ and the Playwright configs (tsconfig.e2e.json:
# the main tsconfig excludes e2e, and Playwright only transpiles, so nothing else type-checks them).
echo "== web: svelte-check + e2e type-check"; scripts/npm.sh run check
echo "== web: vitest";           scripts/npm.sh run test
echo "== docker build";          docker build -t "$APP_IMAGE" .
echo "== docker build tts";      docker build -t "$TTS_IMAGE" tts
echo "== e2e: playwright";       scripts/playwright.sh
# The real voice (spec 2026-09-27 §7, Kokoro plan Ruling K8): one spec against Kokoro itself.
echo "== e2e: the real voice";   TTS_STUB=0 scripts/playwright.sh --config playwright.voice.config.ts voice-real
echo "== ALL GREEN"
