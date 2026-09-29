"""FastAPI application factory. Serves /api/* and falls back to the SPA's index.html."""
from __future__ import annotations
import mimetypes
from contextlib import asynccontextmanager
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from app.alexandria.flights import AnnotationLimiter, RefreshFlights
from app.config import Settings
from app.db import connect, migrate, DB_FILENAME
from app.routers import profiles, texts, sessions, stats, scan, alexandria, world, tts
from app.static import serve

VERSION = "0.1.0"

# The slim base image's system mime.types doesn't map .webp (SP3's dragon/lieutenant art, served
# straight off disk by the SPA catch-all below via FileResponse's mimetypes-guessed content type),
# so it fell back to application/octet-stream. Registered explicitly so /art/**/*.webp serves as
# image/webp regardless of the container's system mime database.
mimetypes.add_type("image/webp", ".webp")
# Same story for the self-hosted UI fonts (scenes UI spec §2.7, web/public/fonts/*.woff2).
mimetypes.add_type("font/woff2", ".woff2")
# UI5 (scenes UI spec §7, Ruling E16): the camp's sounds (web/public/audio/**/*.m4a, AAC). Without it
# the slim image served them as application/octet-stream.
mimetypes.add_type("audio/mp4", ".m4a")


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        settings.data_dir.mkdir(parents=True, exist_ok=True)
        app.state.settings = settings
        # One in-flight refresh per Alexandria work (flights.py). The fetch/orchestration limiter is
        # sized well past the fixed allowlist's work count (fix round 6) so different works' fetches
        # never queue behind each other; only the CPU-bound spaCy step is tightly bounded, via its
        # own small limiter, shared across every concurrently-fetching refresh.
        app.state.alexandria_refreshes = RefreshFlights(max_concurrent=32)
        app.state.alexandria_annotation_limiter = AnnotationLimiter(max_concurrent=2)
        conn = connect(settings.data_dir / DB_FILENAME)
        migrate(conn)
        from app.routers.scan import sweep_orphan_scans
        sweep_orphan_scans(settings.data_dir, conn)
        if settings.seed_on_startup:
            from app.deps import make_annotator
            from app.reannotate import reannotate_outdated
            from app.seed import import_seed
            annotator = make_annotator(settings)
            app.state.annotator = annotator
            import_seed(conn, settings.content_dir, annotator)
            reannotate_outdated(conn, annotator)
        conn.close()
        # The dictation's voice (Kokoro plan Task 4): one pooled client for /api/tts/*. trust_env=False: the
        # hop stays inside the compose network, whatever HTTP_PROXY Docker Desktop injects.
        app.state.tts_client = httpx.Client(base_url=settings.tts_url, trust_env=False)
        yield
        app.state.tts_client.close()

    app = FastAPI(title="La Discorde", version=VERSION, lifespan=lifespan)

    # The build stamp (README troubleshooting; the lyre's credits read it here, so the page and the
    # server always name the same build).
    @app.get("/api/health")
    def health():
        return {"status": "ok", "build": {"commit": settings.build_commit, "date": settings.build_date}}

    app.include_router(profiles.router)
    app.include_router(texts.router)
    app.include_router(sessions.router)
    app.include_router(stats.router)
    app.include_router(scan.router)
    app.include_router(alexandria.router)
    app.include_router(world.router)
    app.include_router(tts.router)

    # Later tasks insert app.include_router(...) lines HERE, above the /api catch-all.

    @app.get("/api/{rest:path}")
    def api_not_found(rest: str):
        raise HTTPException(status_code=404, detail="Not found")

    # Nothing it serves is kept by the browser (app/static.py).
    @app.get("/{path:path}")
    def spa(path: str):
        static = settings.static_dir.resolve()
        candidate = (static / path).resolve() if path else None
        if candidate and candidate.is_file() and candidate.is_relative_to(static):
            return serve(candidate)
        index = static / "index.html"
        if index.is_file():
            return serve(index)
        return JSONResponse({"detail": "SPA not built"}, status_code=404)

    return app


app = create_app()
