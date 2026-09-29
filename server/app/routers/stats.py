"""Stats API: aggregated per-category performance, recent sessions, trap words and the Argus pass order."""
from __future__ import annotations
import json
import sqlite3
from fastapi import APIRouter, Depends
from app.db import get_db
from app.routers.profiles import fetch_profile, to_out
from app.stats import argus_order
from app.world.measures import mistakes_per_100

router = APIRouter(prefix="/api/profiles", tags=["stats"])


def _trap_words(db: sqlite3.Connection, profile_id: int) -> list[dict]:
    return [dict(r) for r in db.execute(
        "SELECT word, box, misses, last_seen FROM trap_word WHERE profile_id = ? ORDER BY misses DESC",
        (profile_id,))]


@router.get("/{profile_id}/stats")
def get_stats(profile_id: int, db: sqlite3.Connection = Depends(get_db)):
    profile = fetch_profile(db, profile_id)

    categories = []
    for r in db.execute(
            "SELECT category, occurrences, errors_in_draft, caught, missed FROM profile_stat "
            "WHERE profile_id = ? AND category NOT LIKE 'derived:%' ORDER BY category", (profile_id,)):
        row = dict(r)
        row["catch_rate"] = row["caught"] / row["errors_in_draft"] if row["errors_in_draft"] > 0 else None
        categories.append(row)

    # Spec 2026-09-29 §3: the muster's suggestion reads each defence's aids and its copy.
    recent_sessions = []
    for r in db.execute(
            "SELECT s.id, s.text_id, t.title, s.finished_at, s.score, s.catch_rate, s.pace_level, s.help_stage, s.mode, "
            "s.aids, s.result_json FROM session s JOIN text t ON t.id = s.text_id WHERE s.profile_id = ? "
            "ORDER BY s.finished_at DESC, s.id DESC LIMIT 20", (profile_id,)):
        row = dict(r)
        result = json.loads(row.pop("result_json") or "{}")
        row["aids"] = json.loads(row["aids"]) if row["aids"] is not None else None
        row["per_100"] = mistakes_per_100(result) if int(result.get("totalWords", 0) or 0) > 0 else None
        recent_sessions.append(row)

    trap_words = _trap_words(db, profile_id)

    totals_row = db.execute(
        "SELECT COUNT(*) AS sessions, COALESCE(SUM(score), 0) AS score FROM session WHERE profile_id = ?",
        (profile_id,)).fetchone()
    caught_row = db.execute(
        "SELECT COALESCE(SUM(caught), 0) AS caught FROM profile_stat WHERE profile_id = ? AND category NOT LIKE 'derived:%'",
        (profile_id,)).fetchone()

    return {
        "profile": to_out(profile),
        "categories": categories,
        "recent_sessions": recent_sessions,
        "trap_words": trap_words,
        "totals": {"sessions": totals_row["sessions"], "score": totals_row["score"], "caught": caught_row["caught"]},
        "argus_order": argus_order(categories),
    }


@router.get("/{profile_id}/trap-words")
def get_trap_words(profile_id: int, db: sqlite3.Connection = Depends(get_db)):
    fetch_profile(db, profile_id)
    return _trap_words(db, profile_id)
