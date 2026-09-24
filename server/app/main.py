"""FastAPI application factory. Serves /api/* and falls back to the SPA's index.html."""
from __future__ import annotations
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from app.config import Settings
from app.db import connect, migrate, DB_FILENAME
from app.routers import profiles, texts, sessions, stats, scan, alexandria, world

VERSION = "0.1.0"


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        settings.data_dir.mkdir(parents=True, exist_ok=True)
        app.state.settings = settings
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
        yield

    app = FastAPI(title="La Discorde", version=VERSION, lifespan=lifespan)

    @app.get("/api/health")
    def health():
        return {"status": "ok", "version": VERSION}

    app.include_router(profiles.router)
    app.include_router(texts.router)
    app.include_router(sessions.router)
    app.include_router(stats.router)
    app.include_router(scan.router)
    app.include_router(alexandria.router)
    app.include_router(world.router)

    # Later tasks insert app.include_router(...) lines HERE, above the /api catch-all.

    @app.get("/api/{rest:path}")
    def api_not_found(rest: str):
        raise HTTPException(status_code=404, detail="Not found")

    @app.get("/{path:path}")
    def spa(path: str):
        static = settings.static_dir.resolve()
        candidate = (static / path).resolve() if path else None
        if candidate and candidate.is_file() and candidate.is_relative_to(static):
            return FileResponse(candidate)
        index = static / "index.html"
        if index.is_file():
            return FileResponse(index)
        return JSONResponse({"detail": "SPA not built"}, status_code=404)

    return app


app = create_app()
