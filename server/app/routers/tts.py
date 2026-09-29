"""The dictation's voice (spec 2026-09-27 §4.2): /api/tts/* proxies the `tts` service (DISCORDE_TTS_URL).
Speaking and preparing need a hero, like the other play endpoints (her id in the body, as
POST /api/sessions takes it: Kokoro plan Ruling K4). The voice's own answer passes through; a voice
that cannot be reached is a 503, and so is one still loading (its own 503)."""
from __future__ import annotations

import logging
import sqlite3

import httpx
from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.db import get_db
from app.routers.profiles import fetch_profile

router = APIRouter(prefix="/api/tts", tags=["tts"])
log = logging.getLogger("uvicorn.error")
UNREACHABLE = {"detail": "the voice cannot be reached"}
# The voice's own limits (tts/app/text.py MAX_CHARS, MIN_SPEED, MAX_SPEED; tts/app/main.py
# MAX_PREPARE_LINES), checked here too (final review M1): a body past them is a 422 before the game
# server holds it, sizes a timeout from it, or sends it on.
MAX_CHARS = 10_000
MIN_SPEED, MAX_SPEED = 0.5, 1.5
MAX_PREPARE_LINES = 500


class PrepareLine(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_CHARS)
    speed: float = Field(ge=MIN_SPEED, le=MAX_SPEED)


class SpeakBody(PrepareLine):
    profile_id: int


class PrepareBody(BaseModel):
    profile_id: int
    lines: list[PrepareLine] = Field(max_length=MAX_PREPARE_LINES)


def speak_timeout(text: str) -> float:
    """Longer than the browser's own wait (voice.ts fetchTimeoutMs: 20 s + 50 ms a character): the
    browser, not the proxy, decides when a line is late."""
    return 30.0 + 0.05 * len(text)


def _forward(request: Request, path: str, payload: dict, timeout: float) -> Response:
    client: httpx.Client = request.app.state.tts_client
    try:
        r = client.post(path, json=payload, timeout=httpx.Timeout(timeout, connect=3.0))
    except httpx.HTTPError as e:
        log.warning("tts proxy: the voice cannot be reached (%s)", e)
        return JSONResponse(UNREACHABLE, status_code=503)
    # The voice's own caching instructions pass through too (it sends `no-store` with every line).
    headers = {"Cache-Control": r.headers["cache-control"]} if "cache-control" in r.headers else None
    return Response(r.content, status_code=r.status_code, media_type=r.headers.get("content-type"),
                    headers=headers)


@router.post("/speak")
def speak(body: SpeakBody, request: Request, db: sqlite3.Connection = Depends(get_db)):
    fetch_profile(db, body.profile_id)
    return _forward(request, "/speak", {"text": body.text, "speed": body.speed}, speak_timeout(body.text))


@router.post("/prepare")
def prepare(body: PrepareBody, request: Request, db: sqlite3.Connection = Depends(get_db)):
    fetch_profile(db, body.profile_id)
    return _forward(request, "/prepare", {"lines": [line.model_dump() for line in body.lines]}, 10.0)


@router.get("/health")
def health(request: Request):
    """For the README's troubleshooting (Ruling K9): is the voice there, which one, and which build."""
    client: httpx.Client = request.app.state.tts_client
    try:
        r = client.get("/health", timeout=httpx.Timeout(3.0))
    except httpx.HTTPError:
        return JSONResponse({"voice": "unreachable"}, status_code=503)
    try:
        body = r.json()
    except ValueError:
        body = None
    if not isinstance(body, dict):   # not the voice's health answer (not a JSON object): an error
        return JSONResponse({"voice": "error"}, status_code=503)
    # The voice's build stamp (its image's GIT_COMMIT and BUILD_DATE), when it sent one shaped like one.
    build = body.get("build")
    stamp = {"build": build} if _is_stamp(build) else {}
    if r.status_code == 200:
        return {"voice": "ready", "engine": body.get("engine"), **stamp}
    return JSONResponse({"voice": "loading" if body.get("status") == "loading" else "error", **stamp}, status_code=503)


def _is_stamp(build: object) -> bool:
    return (isinstance(build, dict) and set(build) == {"commit", "date"}
            and all(isinstance(v, str) for v in build.values()))
