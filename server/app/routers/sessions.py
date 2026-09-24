"""Sessions API: records a played dictation and updates stats, trap words and the adaptive help stage."""
from __future__ import annotations
import json, sqlite3
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from app.db import get_db
from app.routers.profiles import fetch_profile
from app.schemas import SessionCreate
from app.stats import apply_session_to_stats, next_help_stage, update_trap_words

router = APIRouter(prefix="/api/sessions", tags=["sessions"])

UP_MESSAGE = "Les Muses te font confiance : les Yeux d'Argus s'éteignent un peu."
DOWN_MESSAGE = "Éris a été retorse. Les Muses rallument les Yeux d'Argus pour t'aider."


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.post("", status_code=201)
def create_session(body: SessionCreate, db: sqlite3.Connection = Depends(get_db)):
    profile = fetch_profile(db, body.profile_id)
    text = db.execute("SELECT id, body FROM text WHERE id = ?", (body.text_id,)).fetchone()
    if text is None:
        raise HTTPException(404, "Text not found")

    finished_at = now()
    day = finished_at[:10]
    cur = db.execute(
        """INSERT INTO session(profile_id, text_id, pace_level, help_stage, mode, started_at, finished_at,
                                draft, final, result_json, score, catch_rate)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
        (body.profile_id, body.text_id, body.pace_level, body.help_stage, body.mode, body.started_at, finished_at,
         body.draft, body.final, json.dumps(body.result, ensure_ascii=False), body.score, body.catch_rate))
    session_id = cur.lastrowid

    apply_session_to_stats(db, body.profile_id, body.result, day, finished_at)
    update_trap_words(db, body.profile_id, body.result, text["body"], finished_at)

    # Grimoire corrompu sessions are deliberately weighted toward the profile's weaknesses,
    # so they never move the adaptive help stage (plan decision 8); they still feed stats and
    # trap words above. Recent-rate history for the help stage only ever looks at dictation
    # sessions, so a grimoire round never counts toward a dictation-mode change either.
    help_stage_before = profile["help_stage"]
    help_stage_after = help_stage_before
    message = None
    if body.mode != "grimoire":
        rates = [r["catch_rate"] for r in db.execute(
            "SELECT catch_rate FROM session WHERE profile_id = ? AND help_stage = ? AND mode = 'dictation' "
            "AND catch_rate IS NOT NULL ORDER BY finished_at DESC, id DESC LIMIT 3",
            (body.profile_id, help_stage_before))]
        help_stage_after = next_help_stage(help_stage_before, rates)
        if help_stage_after != help_stage_before:
            db.execute("UPDATE profile SET help_stage = ? WHERE id = ?", (help_stage_after, body.profile_id))
            message = UP_MESSAGE if help_stage_after > help_stage_before else DOWN_MESSAGE

    db.commit()
    return {"id": session_id, "help_stage_before": help_stage_before,
            "help_stage_after": help_stage_after, "help_stage_message": message}
