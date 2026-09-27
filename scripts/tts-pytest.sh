#!/usr/bin/env bash
# Run pytest inside the voice service's test image (tts/Dockerfile, target `test`), in tts/.
# Example: scripts/tts-pytest.sh -q tests/test_text.py      scripts/tts-pytest.sh -q -m "not model"
# The run holds the machine-wide Playwright lock (scripts/lib.sh): the model tests use 4 CPU threads.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
docker build -q --target test -t "$TTS_TEST_IMAGE" "$HOST_ROOT/tts" >/dev/null
with_playwright_lock docker run --rm $TTY_FLAGS \
  -v "$HOST_ROOT/tts:/srv" -w /srv \
  -e PYTHONDONTWRITEBYTECODE=1 \
  "$TTS_TEST_IMAGE" python -m pytest "$@"
