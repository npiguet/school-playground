"""The dictation's voice (spec 2026-09-27 §4.1): internal to the compose network; the game server proxies
/api/tts/* here. /speak makes a line now (ahead of the queue) unless it is cached; /prepare queues a
dictation's lines in order; /health is ready once the model is loaded (it loads in the background, so
the service answers « loading » meanwhile)."""
from __future__ import annotations

import asyncio
import logging
import threading
import time
from contextlib import asynccontextmanager
from typing import Callable

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.audio import SR, encode_mp3
from app.cache import Cache, cache_key
from app.config import Config
from app.engine import Engine, load_engine
from app.text import MAX_CHARS, MAX_SPEED, MIN_SPEED, Respeller, normalise
from app.worker import Line, Worker

VOICE = "ff_siwis"
MAX_PREPARE_LINES = 500
log = logging.getLogger("uvicorn.error")


class SpeakBody(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_CHARS)
    speed: float = Field(ge=MIN_SPEED, le=MAX_SPEED)


class PrepareBody(BaseModel):
    lines: list[SpeakBody] = Field(max_length=MAX_PREPARE_LINES)


def create_app(config: Config | None = None, engine_factory: Callable[[Config], Engine] = load_engine) -> FastAPI:
    config = config or Config.from_env()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.worker = None
        app.state.engine_id = None
        app.state.error = None
        app.state.respell = Respeller.load(config.respell_path)
        cache = Cache(config.cache_dir, config.cache_mb * 1024 * 1024)

        def boot() -> None:
            try:
                t0 = time.perf_counter()
                engine = engine_factory(config)

                def make(line: Line) -> bytes:
                    t = time.perf_counter()
                    audio = engine.synth(line.text, line.speed)
                    data = encode_mp3(audio)
                    log.info("tts: %d characters at %.2f: %.2f s of speech in %.2f s",
                             len(line.text), line.speed, len(audio) / SR, time.perf_counter() - t)
                    return data

                worker = Worker(make, cache, lambda line: cache_key(engine.model_id, VOICE, line.speed, line.text))
                worker.start()
                app.state.engine_id = engine.model_id
                app.state.worker = worker
                log.info("tts: voice ready (%s) in %.1f s", engine.model_id, time.perf_counter() - t0)
            except Exception as e:
                app.state.error = f"{type(e).__name__}: {e}"
                log.exception("tts: the voice could not load")

        threading.Thread(target=boot, name="tts-boot", daemon=True).start()
        yield
        if app.state.worker is not None:
            app.state.worker.stop()

    app = FastAPI(title="La Discorde, the voice", lifespan=lifespan)

    def worker_of(request: Request) -> Worker:
        worker = request.app.state.worker
        if worker is None:
            raise HTTPException(503, "the voice is not ready")
        return worker

    def line_of(request: Request, body: SpeakBody) -> Line:
        text = request.app.state.respell(normalise(body.text))
        if not text:
            raise HTTPException(422, "nothing to say")
        return Line(text=text, speed=round(body.speed, 3))

    @app.get("/health")
    def health(request: Request):
        state = request.app.state
        if state.worker is not None:
            return {"status": "ready", "engine": state.engine_id}
        if state.error:
            return JSONResponse({"status": "error", "detail": state.error}, status_code=503)
        return JSONResponse({"status": "loading"}, status_code=503)

    @app.post("/speak")
    async def speak(body: SpeakBody, request: Request):
        worker = worker_of(request)
        future = worker.request(line_of(request, body), urgent=True)
        try:
            data = await asyncio.wrap_future(future)
        except Exception:
            log.exception("tts: a line failed")
            raise HTTPException(500, "the voice could not say this line")
        return Response(data, media_type="audio/mpeg", headers={"Cache-Control": "no-store"})

    @app.post("/prepare", status_code=202)
    def prepare(body: PrepareBody, request: Request):
        worker = worker_of(request)
        lines = [line_of(request, b) for b in body.lines]
        for line in lines:
            worker.request(line, urgent=False)
        return {"queued": len(lines)}

    return app


app = create_app()
