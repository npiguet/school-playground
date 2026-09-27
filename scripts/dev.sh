#!/usr/bin/env bash
# Start the dev stack: vite on http://localhost:5173 (proxying /api) + uvicorn --reload on 8080,
# and the dictation's voice (the tts service, the real model).
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
ensure_volumes
build_server_dev_image
# The voice's image (compose.dev.yaml's tts service).
docker build -q -t "$TTS_IMAGE" "$HOST_ROOT/tts" >/dev/null
cd "$ROOT"
exec docker compose -f compose.dev.yaml up "$@"
