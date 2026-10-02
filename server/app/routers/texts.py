"""Texts API: list/create/read/delete texts. Reference text is always the answer key (spec §1)."""
from __future__ import annotations
import json, random, sqlite3, time
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from app.corrupt import apply_plants, category_weights, corruption_count, load_reform, plan_corruptions
from app.db import get_db
from app.deps import get_annotator
from app.lexicon import load_lexicon
from app.levels import LEVELS, level_index
from app.nlp.homophones import load_homophones
from app.routers.profiles import fetch_profile
from app.routers.scan import SCAN_ID_RE, scan_dir
from app.schemas import CorruptRequest, TextCreate, TextFull, TextHistory, TextSummaryWithHistory
from app.textutil import build_credits, has_digits, word_count

router = APIRouter(prefix="/api/texts", tags=["texts"])

EMPTY_HISTORY = TextHistory(times_played=0, best_score=None, best_catch_rate=None)

TEXT_SELECT = "SELECT t.*, p.name AS added_by_name FROM text t LEFT JOIN profile p ON p.id = t.added_by_profile_id"


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def fetch_text(db: sqlite3.Connection, text_id: int) -> sqlite3.Row:
    row = db.execute(f"{TEXT_SELECT} WHERE t.id = ?", (text_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "Text not found")
    return row


def to_summary(row: sqlite3.Row, history: TextHistory | None, data_dir: Path | None = None) -> TextSummaryWithHistory:
    scan_id: str | None = None
    photo_count = 0
    photo_path = row["photo_path"]
    if photo_path and photo_path.startswith("scans/"):
        scan_id = photo_path.split("/", 1)[1]
        if data_dir is not None:
            photo_count = len(list(scan_dir(data_dir, scan_id).glob("page-*")))
    return TextSummaryWithHistory(
        id=row["id"], title=row["title"], level=row["level"], source=row["source"],
        author=row["author"], translator=row["translator"], work=row["work"], credits=row["credits"],
        word_count=word_count(row["body"]), added_by_profile_id=row["added_by_profile_id"],
        added_by_name=row["added_by_name"], due_date=row["due_date"], created_at=row["created_at"],
        history=history, scan_id=scan_id, photo_count=photo_count)


def to_full(row: sqlite3.Row, history: TextHistory | None = None, data_dir: Path | None = None) -> TextFull:
    summary = to_summary(row, history, data_dir)
    return TextFull(**summary.model_dump(), body=row["body"], annotation=json.loads(row["annotation_json"]))


@router.get("", response_model=list[TextSummaryWithHistory])
def list_texts(request: Request, profile_id: int | None = None, db: sqlite3.Connection = Depends(get_db)):
    rows = db.execute(TEXT_SELECT).fetchall()
    history_by_text: dict[int, TextHistory] = {}
    if profile_id is not None:
        for r in db.execute(
                "SELECT text_id, COUNT(*) AS n, MAX(score) AS best_score, MAX(catch_rate) AS best_catch_rate "
                "FROM session WHERE profile_id = ? GROUP BY text_id", (profile_id,)):
            history_by_text[r["text_id"]] = TextHistory(
                times_played=r["n"], best_score=r["best_score"], best_catch_rate=r["best_catch_rate"])
    data_dir = request.app.state.settings.data_dir
    items = [
        to_summary(r, history_by_text.get(r["id"], EMPTY_HISTORY) if profile_id is not None else None, data_dir)
        for r in rows
    ]
    items.sort(key=lambda t: (level_index(t.level), t.created_at))
    return items


@router.post("", response_model=TextFull, status_code=201)
def create_text(body: TextCreate, request: Request, db: sqlite3.Connection = Depends(get_db),
                 annotate_fn=Depends(get_annotator)):
    if body.source not in ("custom", "scan"):
        raise HTTPException(422, "source must be 'custom' or 'scan'")
    if body.level not in LEVELS:
        raise HTTPException(422, "unknown level")
    text = body.body.strip()
    if word_count(text) < 5:
        # Said to the player at the pupitre and the lens (they show the server's reason as it is).
        raise HTTPException(422, "Ce texte est trop court\u202f: il faut au moins cinq mots.")
    if has_digits(text):
        raise HTTPException(422, "Écris les nombres en lettres")

    data_dir = request.app.state.settings.data_dir
    photo_path = None
    if body.source == "scan":
        if not body.scan_id or not SCAN_ID_RE.fullmatch(body.scan_id) or not scan_dir(data_dir, body.scan_id).is_dir():
            raise HTTPException(422, "Scan introuvable")
        photo_path = f"scans/{body.scan_id}"

    credits = body.credits or build_credits(body.author, body.work, body.translator)
    annotation = annotate_fn(text)
    cur = db.execute(
        """INSERT INTO text(title, body, source, level, author, translator, work, credits,
                           added_by_profile_id, due_date, photo_path, annotation_json, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (body.title.strip(), text, body.source, body.level, body.author, body.translator, body.work,
         credits, body.added_by_profile_id, body.due_date, photo_path, json.dumps(annotation, ensure_ascii=False), now()))
    db.commit()
    return to_full(fetch_text(db, cur.lastrowid), data_dir=data_dir)


@router.get("/{text_id}", response_model=TextFull)
def get_text(text_id: int, request: Request, db: sqlite3.Connection = Depends(get_db)):
    return to_full(fetch_text(db, text_id), data_dir=request.app.state.settings.data_dir)


@router.post("/{text_id}/corrupt")
def corrupt_text(text_id: int, body: CorruptRequest, request: Request, db: sqlite3.Connection = Depends(get_db)):
    row = fetch_text(db, text_id)
    profile = fetch_profile(db, body.profile_id)
    text = row["body"]
    annotation = json.loads(row["annotation_json"])
    if annotation.get("version", 1) < 2:
        # A pre-SP2 annotation has no agreement chains (only re-annotated at seed time).
        raise HTTPException(422, "Ce parchemin doit d'abord être relu par les Muses")

    settings = request.app.state.settings
    lexicon = load_lexicon(settings.content_dir)
    homophones = load_homophones(settings.content_dir)
    reform = load_reform(settings.content_dir)

    stat_rows = [dict(r) for r in db.execute(
        "SELECT category, SUM(errors_in_draft) AS errors_in_draft, SUM(caught) AS caught FROM profile_stat "
        "WHERE profile_id = ? GROUP BY category", (body.profile_id,))]   # both modes (migration 008)
    trap = {r[0] for r in db.execute(
        "SELECT word FROM trap_word WHERE profile_id = ?", (body.profile_id,))}

    weights = category_weights(stat_rows, profile["level"], body.focus)
    count = corruption_count(word_count(text))
    rng = random.Random(body.seed if body.seed is not None else time.time_ns())
    plants = plan_corruptions(text, annotation, lexicon, homophones, weights, count, rng, trap, reform, body.focus)

    if len(plants) < 3:
        raise HTTPException(422, "Éris n'a pas trouvé assez de prises dans ce texte.")

    return {"text_id": text_id, "corrupted": apply_plants(text, plants), "count": len(plants), "plants": plants}


@router.delete("/{text_id}", status_code=204)
def delete_text(text_id: int, db: sqlite3.Connection = Depends(get_db)):
    row = fetch_text(db, text_id)
    if row["source"] == "seed":
        raise HTTPException(403, "Les textes du jeu ne peuvent pas être supprimés")
    db.execute("DELETE FROM text WHERE id = ?", (text_id,))
    db.commit()
    return Response(status_code=204)
