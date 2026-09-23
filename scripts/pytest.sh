#!/usr/bin/env bash
# Run pytest inside the server dev image. Example: scripts/pytest.sh tests/test_health.py -v
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
exec "$ROOT/scripts/py.sh" python -m pytest "$@"
