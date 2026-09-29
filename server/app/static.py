"""The built SPA's files, which the browser must never keep. iPad Safari (above all as a Home Screen
web app) kept a stale index.html naming the previous build's bundle, so a new build seemed not to take
effect. The game is played on the home network, where fetching a file again costs next to nothing, so
every static response is `no-store`: index.html and every route that falls back to it, Vite's hashed
/assets/, and web/public's /art/, /audio/, /fonts/, /icons/ and manifest.json alike. A new build then
shows at the next page load, with no reload tricks. The API sets its own headers (the voice's
`no-store` passes through its proxy)."""
from __future__ import annotations

from pathlib import Path

from starlette.responses import FileResponse

NO_STORE = "no-store"


def serve(file: Path) -> FileResponse:
    return FileResponse(file, headers={"Cache-Control": NO_STORE})
