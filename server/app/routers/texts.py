"""Texts API: list/create/read/delete texts. Reference text is always the answer key (spec §1)."""
from __future__ import annotations
import json, sqlite3
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Response
from app.db import get_db
from app.deps import get_annotator
from app.levels import LEVELS, level_index
from app.schemas import TextCreate, TextFull, TextHistory, TextSummaryWithHistory
from app.textutil import build_credits, has_digits, word_count

router = APIRouter(prefix="/api/texts", tags=["texts"])

EMPTY_HISTORY = TextHistory(times_played=0, best_score=None, best_catch_rate=None)


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def fetch_text(db: sqlite3.Connection, text_id: int) -> sqlite3.Row:
    row = db.execute(
        "SELECT t.*, p.name AS added_by_name FROM text t "
        "LEFT JOIN profile p ON p.id = t.added_by_profile_id WHERE t.id = ?",
        (text_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "Text not found")
    return row


def to_summary(row: sqlite3.Row, history: TextHistory | None) -> TextSummaryWithHistory:
    return TextSummaryWithHistory(
        id=row["id"], title=row["title"], level=row["level"], source=row["source"],
        author=row["author"], translator=row["translator"], work=row["work"], credits=row["credits"],
        word_count=word_count(row["body"]), added_by_profile_id=row["added_by_profile_id"],
        added_by_name=row["added_by_name"], due_date=row["due_date"], created_at=row["created_at"],
        history=history)


def to_full(row: sqlite3.Row, history: TextHistory | None = None) -> TextFull:
    summary = to_summary(row, history)
    return TextFull(**summary.model_dump(), body=row["body"], annotation=json.loads(row["annotation_json"]))


@router.get("", response_model=list[TextSummaryWithHistory])
def list_texts(profile_id: int | None = None, db: sqlite3.Connection = Depends(get_db)):
    rows = db.execute(
        "SELECT t.*, p.name AS added_by_name FROM text t "
        "LEFT JOIN profile p ON p.id = t.added_by_profile_id").fetchall()
    history_by_text: dict[int, TextHistory] = {}
    if profile_id is not None:
        for r in db.execute(
                "SELECT text_id, COUNT(*) AS n, MAX(score) AS best_score, MAX(catch_rate) AS best_catch_rate "
                "FROM session WHERE profile_id = ? GROUP BY text_id", (profile_id,)):
            history_by_text[r["text_id"]] = TextHistory(
                times_played=r["n"], best_score=r["best_score"], best_catch_rate=r["best_catch_rate"])
    items = [
        to_summary(r, history_by_text.get(r["id"], EMPTY_HISTORY) if profile_id is not None else None)
        for r in rows
    ]
    items.sort(key=lambda t: (level_index(t.level), t.created_at))
    return items


@router.post("", response_model=TextFull, status_code=201)
def create_text(body: TextCreate, db: sqlite3.Connection = Depends(get_db),
                 annotate_fn=Depends(get_annotator)):
    if body.source != "custom":
        raise HTTPException(422, "source must be 'custom'")
    if body.level not in LEVELS:
        raise HTTPException(422, "unknown level")
    text = body.body.strip()
    if word_count(text) < 5:
        raise HTTPException(422, "text is too short")
    if has_digits(text):
        raise HTTPException(422, "Écris les nombres en lettres")
    credits = body.credits or build_credits(body.author, body.work, body.translator)
    annotation = annotate_fn(text)
    cur = db.execute(
        """INSERT INTO text(title, body, source, level, author, translator, work, credits,
                           added_by_profile_id, due_date, annotation_json, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
        (body.title.strip(), text, body.source, body.level, body.author, body.translator, body.work,
         credits, body.added_by_profile_id, body.due_date, json.dumps(annotation, ensure_ascii=False), now()))
    return to_full(fetch_text(db, cur.lastrowid))


@router.get("/{text_id}", response_model=TextFull)
def get_text(text_id: int, db: sqlite3.Connection = Depends(get_db)):
    return to_full(fetch_text(db, text_id))


@router.delete("/{text_id}", status_code=204)
def delete_text(text_id: int, db: sqlite3.Connection = Depends(get_db)):
    row = fetch_text(db, text_id)
    if row["source"] == "seed":
        raise HTTPException(403, "Les textes du jeu ne peuvent pas être supprimés")
    db.execute("DELETE FROM text WHERE id = ?", (text_id,))
    return Response(status_code=204)
