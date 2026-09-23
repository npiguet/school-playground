#!/usr/bin/env bash
# Start the dev stack: vite on http://localhost:5173 (proxying /api) + uvicorn --reload on 8080.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
ensure_volumes
build_server_dev_image
cd "$ROOT"
exec docker compose -f compose.dev.yaml up "$@"
