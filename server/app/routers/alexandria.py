"""Bibliothèque d'Alexandrie API: browse the allowlist, refresh a work's cache, adopt
a scored chunk into the library (spec §5, SP2)."""
from __future__ import annotations

import sqlite3

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.alexandria.allowlist import Work, load_allowlist
from app.alexandria.fetch import make_fetcher
from app.alexandria.service import adopt_chunk, list_chunks, list_works, refresh_work
from app.db import get_db
from app.deps import get_annotator
from app.lexicon import load_lexicon
from app.routers.texts import to_full

router = APIRouter(prefix="/api/alexandria", tags=["alexandria"])


class AdoptRequest(BaseModel):
    profile_id: int
    title: str | None = None


def get_fetcher(request: Request):
    fetcher = getattr(request.app.state, "fetcher", None)
    if fetcher is not None:
        return fetcher
    return make_fetcher(request.app.state.settings)


def _works(request: Request) -> list[Work]:
    return load_allowlist(request.app.state.settings.content_dir)


def _work_or_404(works: list[Work], work_id: str) -> Work:
    work = next((w for w in works if w.id == work_id), None)
    if work is None:
        raise HTTPException(404, "Œuvre inconnue")
    return work


@router.get("/works")
def get_works(request: Request, db: sqlite3.Connection = Depends(get_db)):
    return list_works(db, _works(request))


@router.post("/works/{work_id}/refresh")
def refresh(work_id: str, request: Request, db: sqlite3.Connection = Depends(get_db),
            fetcher=Depends(get_fetcher), annotate_fn=Depends(get_annotator)):
    work = _work_or_404(_works(request), work_id)
    settings = request.app.state.settings
    lexicon = load_lexicon(settings.content_dir)
    return refresh_work(db, work, fetcher, annotate_fn, lexicon)


@router.get("/works/{work_id}/chunks")
def get_chunks(work_id: str, request: Request, level: str | None = None,
               db: sqlite3.Connection = Depends(get_db)):
    _work_or_404(_works(request), work_id)
    return list_chunks(db, work_id, level)


@router.post("/chunks/{chunk_id}/adopt")
def adopt(chunk_id: int, body: AdoptRequest, request: Request, db: sqlite3.Connection = Depends(get_db)):
    row, created = adopt_chunk(db, chunk_id, body.profile_id, _works(request), title=body.title)
    if row is None:
        raise HTTPException(404, "Rouleau inconnu")
    full = to_full(row, data_dir=request.app.state.settings.data_dir)
    return JSONResponse(status_code=201 if created else 200, content=full.model_dump(mode="json"))
