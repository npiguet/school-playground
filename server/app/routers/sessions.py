"""Sessions API: records a played dictation and updates stats, trap words and the adaptive help stage."""
from __future__ import annotations
import json, re, sqlite3
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from app.clock import local_day
from app.db import get_db
from app.routers.profiles import fetch_profile
from app.schemas import SessionCreate
from app.stats import apply_session_to_stats, next_help_stage, update_trap_words
from app.world.progression import apply_progression

router = APIRouter(prefix="/api/sessions", tags=["sessions"])

UP_MESSAGE = "Les Muses te font confiance\u202f: les Yeux d'Argus s'éteignent un peu."
DOWN_MESSAGE = "Éris a été retorse. Les Muses rallument les Yeux d'Argus pour t'aider."


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.post("", status_code=201)
def create_session(body: SessionCreate, request: Request, db: sqlite3.Connection = Depends(get_db),
                    x_discorde_day: str | None = Header(default=None)):
    settings = request.app.state.settings
    profile = fetch_profile(db, body.profile_id)
    text = db.execute("SELECT id, body, due_date FROM text WHERE id = ?", (body.text_id,)).fetchone()
    if text is None:
        raise HTTPException(404, "Text not found")

    finished_at = now()
    day = local_day(finished_at)
    if settings.test_hooks and x_discorde_day and re.fullmatch(r"\d{4}-\d{2}-\d{2}", x_discorde_day):
        day = x_discorde_day; finished_at = f"{day}T12:00:00+00:00"
    cur = db.execute(
        """INSERT INTO session(profile_id, text_id, pace_level, help_stage, mode, started_at, finished_at,
                                draft, final, result_json, score, catch_rate, encounter, quest_id, aids)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (body.profile_id, body.text_id, body.pace_level, body.help_stage or 0, body.mode, body.started_at, finished_at,
         body.draft, body.final, json.dumps(body.result, ensure_ascii=False), body.score or 0, body.catch_rate,
         body.encounter, body.quest_id, json.dumps(body.aids) if body.aids is not None else None))
    session_id = cur.lastrowid

    # Spec 2026-09-29 §3: the hero's choice of aids is remembered and pre-selected next time (plan
    # Ruling R1: written with the session; a page opened before the aids leaves it alone).
    if body.aids is not None:
        remembered = {**json.loads(profile["settings_json"] or "{}"), "aids": body.aids}
        db.execute("UPDATE profile SET settings_json = ? WHERE id = ?", (json.dumps(remembered, ensure_ascii=False), body.profile_id))

    grimoire = body.mode == "grimoire"
    apply_session_to_stats(db, body.profile_id, body.result, day, finished_at)
    # In the Grimoire the draft errors are Éris's plants, not the child's mistakes: they feed the
    # category stats but never create or reset a mot-piège (a trap word is planted 3× more often,
    # so counting plants as misses would pin it in box 1 forever).
    update_trap_words(db, body.profile_id, body.result, text["body"], finished_at, record_misses=not grimoire)

    # Grimoire corrompu sessions are deliberately weighted toward the profile's weaknesses,
    # so they never move the adaptive help stage (plan decision 8); they still feed stats
    # above. Recent-rate history for the help stage only ever looks at dictation sessions,
    # so a grimoire round never counts toward a dictation-mode change either.
    help_stage_before = profile["help_stage"]
    help_stage_after = help_stage_before
    message = None
    if not grimoire:
        rates = [r["catch_rate"] for r in db.execute(
            "SELECT catch_rate FROM session WHERE profile_id = ? AND help_stage = ? AND mode = 'dictation' "
            "AND encounter IS NULL AND catch_rate IS NOT NULL ORDER BY finished_at DESC, id DESC LIMIT 3",
            (body.profile_id, help_stage_before))]
        help_stage_after = next_help_stage(help_stage_before, rates)
        if help_stage_after != help_stage_before:
            db.execute("UPDATE profile SET help_stage = ? WHERE id = ?", (help_stage_after, body.profile_id))
            message = UP_MESSAGE if help_stage_after > help_stage_before else DOWN_MESSAGE

    prophecy = bool(text["due_date"]) and text["due_date"] > day   # Decision 10: "before its date" (SP3 batch review M9)
    progression = apply_progression(db, profile, session_id, body, body.result, day, finished_at, prophecy)

    db.commit()
    return {"id": session_id, "help_stage_before": help_stage_before,
            "help_stage_after": help_stage_after, "help_stage_message": message,
            "progression": progression}
