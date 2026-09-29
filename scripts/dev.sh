#!/usr/bin/env bash
# Start the dev stack: vite on http://localhost:5173 (proxying /api) + uvicorn --reload on 8080,
# and the dictation's voice (the tts service, the real model).
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
ensure_volumes
build_server_dev_image
# The voice's image (compose.dev.yaml's tts service). Not quiet: the first build downloads the model
# (about 350 MB), and its progress shows that the script is not stuck; later builds are cached.
echo "== building the voice's image $TTS_IMAGE (the first time downloads its model, about 350 MB)"
docker build --build-arg "GIT_COMMIT=$GIT_COMMIT" --build-arg "BUILD_DATE=$BUILD_DATE" -t "$TTS_IMAGE" "$HOST_ROOT/tts"
cd "$ROOT"
exec docker compose -f compose.dev.yaml up "$@"
