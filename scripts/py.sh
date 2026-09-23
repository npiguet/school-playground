#!/usr/bin/env bash
# Run any command inside the server dev image, in server/. Example: scripts/py.sh python -m app.tools.seed_check
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
build_server_dev_image
docker run --rm $TTY_FLAGS \
  -v "$HOST_ROOT:/work" \
  -w /work/server \
  -e PYTHONDONTWRITEBYTECODE=1 -e SPACY_MODEL=fr_core_news_sm \
  -e DISCORDE_CONTENT_DIR=/work/content \
  "$SERVER_DEV_IMAGE" "$@"
