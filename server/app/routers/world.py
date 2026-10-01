"""World API: camp hub, dragon, quest board, Oracle, boss fights and rewards (spec §3.6; plan Task 3).

Server-authoritative: this router is the only writer of quest/oracle/dragon/reward/xp_event/mastery
state outside of app.world.progression (which runs from POST /api/sessions).
"""
from __future__ import annotations
import json
import sqlite3
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from app.clock import iso_week, local_day, now_utc
from app.db import begin_write, get_db
from app.levels import LEVELS, level_index
from app.routers.profiles import fetch_profile, to_out
from app.rules import Rules
from app.schemas import DragonPatch, OracleChoice, QuestCreate, RewardPatch
from app.textutil import word_count
from app.world import oracle as oracle_mod
from app.world.catalog import (BOSS_REWARDS, LIEUTENANT_ORDER, LIEUTENANTS, MASTERY, ORACLE_REWARDS, QUEST_BONUS,
                               REWARDS, TINTS)
from app.world.dragon import grown_stage, stage_gauge, stage_table
from app.world.mastery import lieutenants_for_level, mastery_window, tier_available
from app.world.progression import (boss_tiers_won, ensure_dragon, lieutenant_day_rows, neutralised_set, store_stage,
                                   weekly_done, xp_total)
from app.world.quests import density, recommend_texts

router = APIRouter(prefix="/api", tags=["world"])

BOSS_MESSAGE = "Éris ne se montre pas encore. Neutralise d'abord ses lieutenants."
TWO_QUESTS_MESSAGE = "Deux quêtes à la fois, c'est déjà beaucoup. Termine-en une ou range-la."
ALREADY_ACTIVE_MESSAGE = "Cette quête est déjà en cours."
TINT_LOCKED_MESSAGE = "Cette teinte n'est pas encore débloquée."
# The cabin's walls hold four pieces of decor (UI3b ruling: DECOR_SLOTS in
# web/src/lib/world/scenes/cabin.ts); a fifth would hang over the first.
MAX_DISPLAYED_DECOR = 4
WALLS_FULL_MESSAGE = "Les murs sont pleins\u202f: range d'abord une pièce."
ORACLE_ALREADY_CONSULTED = "L'Oracle a déjà parlé cette semaine. Reviens lundi."


_YEARS = {1: "dans un an", 2: "dans deux ans", 3: "dans trois ans"}


def sleeping_line(key: str, level: str | None = None) -> str:
    """A lieutenant asleep at the hero's class (UI3 Ruling B11, UI3b playability #20: when it wakes,
    in the story's words, not « une classe plus grande »): the same words as the client's
    `sleepingLine` (web/src/lib/world/eris.ts), for a quest asked of it anyway (a stale client)."""
    name = LIEUTENANTS[key]["name"]
    gender = LIEUTENANTS[key]["gender"]
    years = level_index(LIEUTENANTS[key]["min_level"]) - level_index(level) if level in LEVELS else 0
    when = _YEARS.get(years, "dans quelques années")
    if gender == "fp":
        return f"{name} dorment encore. Elles se réveilleront {when}."
    return f"{name} dort encore. {'Elle' if gender == 'f' else 'Il'} se réveillera {when}."


def _week_today() -> tuple[str, str]:
    now = now_utc(); day = local_day(now); week = iso_week(day)
    return day, week


def quest_out(conn: sqlite3.Connection, row: sqlite3.Row) -> dict:
    goal = json.loads(row["goal_json"])
    texts = goal.pop("texts", [])
    # Keys of goals stored before sub-project 1: the rule no longer reads them (spec 2026-09-29 §2).
    for legacy in ("min_rate", "min_draft", "mode", "help_stage"):
        goal.pop(legacy, None)
    progress = json.loads(row["progress_json"] or "{}")
    progress.setdefault("sessions", 0); progress.setdefault("log", [])
    reward = json.loads(row["reward_json"])
    return {"id": row["id"], "kind": row["kind"], "target": row["target"], "week": row["week"], "status": row["status"],
            "goal": goal, "progress": progress, "reward": reward, "texts": texts,
            "created_at": row["created_at"], "completed_at": row["completed_at"]}


def dragon_out(conn: sqlite3.Connection, profile: sqlite3.Row, now: str, rules: Rules) -> dict:
    pid = profile["id"]
    dragon = ensure_dragon(conn, pid, now)
    available = lieutenants_for_level(profile["level"])
    n = len(neutralised_set(conn, pid))
    # Spec 2026-09-29 dragon growth §1: the stage follows the total XP and never goes down; a stage
    # caught up here (a threshold lowered in regles.json) is stored.
    stage = grown_stage(dragon["stage"], xp_total(conn, pid), rules.dragon_stages)
    if stage != dragon["stage"]:
        store_stage(conn, pid, stage, now)
    owned = {r[0] for r in conn.execute("SELECT reward_id FROM reward WHERE profile_id = ?", (pid,))}
    unlocked_tints = ["bronze"] + [t for t in TINTS[1:] if f"tint:{t}" in owned]
    return {"name": dragon["name"], "tint": dragon["tint"], "stage": stage, "neutralised": n, "available": len(available),
            "unlocked_tints": unlocked_tints}


def lieutenant_states(conn: sqlite3.Connection, profile: sqlite3.Row) -> list[dict]:
    pid = profile["id"]
    available = set(lieutenants_for_level(profile["level"]))
    neutralised_rows = {r["lieutenant"]: r["neutralised_at"] for r in
                        conn.execute("SELECT lieutenant, neutralised_at FROM mastery WHERE profile_id = ?", (pid,))}
    out = []
    for key in LIEUTENANT_ORDER:
        cats = LIEUTENANTS[key]["categories"]
        marks = ",".join("?" * len(cats))
        row = conn.execute(f"SELECT SUM(errors_in_draft) t, SUM(caught) c, SUM(missed) m, MAX(day) last FROM profile_stat_day "
                           f"WHERE profile_id = ? AND category IN ({marks})", (pid, *cats)).fetchone()
        traps, caught, missed = row["t"] or 0, row["c"] or 0, row["m"] or 0
        last_day = row["last"]
        window = mastery_window(lieutenant_day_rows(conn, pid, cats))
        neutralised = key in neutralised_rows
        bestiary_unlocked = neutralised or conn.execute(
            "SELECT 1 FROM quest WHERE profile_id = ? AND kind IN ('board','oracle') AND target = ? AND status = 'done' LIMIT 1",
            (pid, key)).fetchone() is not None
        active_quest = conn.execute(
            "SELECT id FROM quest WHERE profile_id = ? AND kind IN ('board','oracle') AND target = ? AND status = 'active' LIMIT 1",
            (pid, key)).fetchone()
        out.append({
            "key": key, "name": LIEUTENANTS[key]["name"], "categories": cats,
            "available": key in available, "neutralised": neutralised, "neutralised_at": neutralised_rows.get(key),
            "window": {"days": window.days, "traps": window.traps, "caught": window.caught, "rate": window.rate, "complete": window.complete},
            "all_time": {"traps": traps, "caught": caught, "missed": missed, "rate": (caught / traps) if traps else None},
            "last_day": last_day, "bestiary_unlocked": bestiary_unlocked, "active_quest_id": active_quest["id"] if active_quest else None,
        })
    return out


def xp_block(conn: sqlite3.Connection, pid: int, stage: str, rules: Rules) -> dict:
    """The HUD's gauge (spec 2026-09-29 dragon growth §2): the total XP, the dragon's stage's floor and
    the next stage's threshold (None at the top). From the stored stage (R3), so a stage grown before
    its XP reads an empty gauge, never a negative one."""
    floor, nxt = stage_gauge(stage, rules.dragon_stages)
    return {"total": xp_total(conn, pid), "floor": floor, "next": nxt}


def prophecies(conn: sqlite3.Connection, day: str) -> list[dict]:
    d0 = date.fromisoformat(day)
    rows = conn.execute("SELECT id, title, due_date FROM text WHERE due_date IS NOT NULL AND due_date >= ? ORDER BY due_date", (day,)).fetchall()
    return [{"text_id": r["id"], "title": r["title"], "due_date": r["due_date"],
             "days_left": (date.fromisoformat(r["due_date"]) - d0).days} for r in rows]


def small_tricks(conn: sqlite3.Connection, pid: int) -> dict:
    cats = ("accent", "lexical", "punctuation_case")
    marks = ",".join("?" * len(cats))
    row = conn.execute(f"SELECT SUM(errors_in_draft) t, SUM(caught) c FROM profile_stat WHERE profile_id = ? AND category IN ({marks})",
                       (pid, *cats)).fetchone()
    return {"traps": row["t"] or 0, "caught": row["c"] or 0}


def text_rows_with_density(conn: sqlite3.Connection, key: str) -> list[dict]:
    rows = []
    for r in conn.execute("SELECT id, title, level, body, annotation_json FROM text"):
        annotation = json.loads(r["annotation_json"])
        wc = word_count(r["body"])
        rows.append({"id": r["id"], "title": r["title"], "level": r["level"], "word_count": wc,
                     "density": density(annotation, wc, key)})
    return rows


def create_quest(conn: sqlite3.Connection, profile: sqlite3.Row, kind: str, target: str, week: str | None,
                 goal: dict, reward: dict, now: str) -> dict:
    cur = conn.execute(
        "INSERT INTO quest(profile_id, kind, target, week, goal_json, reward_json, created_at) VALUES (?,?,?,?,?,?,?)",
        (profile["id"], kind, target, week, json.dumps(goal, ensure_ascii=False), json.dumps(reward, ensure_ascii=False), now))
    row = conn.execute("SELECT * FROM quest WHERE id = ?", (cur.lastrowid,)).fetchone()
    return quest_out(conn, row)


def create_board_quest(conn: sqlite3.Connection, profile: sqlite3.Row, target: str, now: str) -> dict:
    if target not in LIEUTENANTS:
        raise HTTPException(422, "unknown lieutenant")
    if target not in lieutenants_for_level(profile["level"]):
        raise HTTPException(409, sleeping_line(target, profile["level"]))
    pid = profile["id"]
    active = conn.execute("SELECT target FROM quest WHERE profile_id = ? AND kind = 'board' AND status = 'active'", (pid,)).fetchall()
    if any(r["target"] == target for r in active):
        raise HTTPException(409, ALREADY_ACTIVE_MESSAGE)
    if len(active) >= 2:
        raise HTTPException(409, TWO_QUESTS_MESSAGE)
    played = {r[0] for r in conn.execute("SELECT DISTINCT text_id FROM session WHERE profile_id = ?", (pid,))}
    texts = recommend_texts(text_rows_with_density(conn, target), target, profile["level"], played)
    goal = {"sessions": 3, "texts": texts}
    reward = {"xp": QUEST_BONUS["board"], "reward_id": None, "bestiary": True}
    return create_quest(conn, profile, "board", target, None, goal, reward, now)


def _pick_boss_text(conn: sqlite3.Connection, profile: sqlite3.Row) -> int | None:
    level = profile["level"]
    idx = level_index(level)
    allowed_levels = {level} | ({LEVELS[idx - 1]} if idx > 0 else set())
    played = {r[0] for r in conn.execute("SELECT DISTINCT text_id FROM session WHERE profile_id = ?", (profile["id"],))}
    candidates = []
    for r in conn.execute("SELECT id, level, body FROM text"):
        wc = word_count(r["body"])
        if wc >= 150 and r["level"] in allowed_levels:
            candidates.append((r["id"], wc, r["id"] in played))
    if not candidates:
        for r in conn.execute("SELECT id, level, body FROM text"):
            wc = word_count(r["body"])
            if wc >= 150:
                candidates.append((r["id"], wc, r["id"] in played))
    if not candidates:
        return None
    candidates.sort(key=lambda c: (c[2], -c[1], c[0]))
    return candidates[0][0]


def create_boss_quest(conn: sqlite3.Connection, profile: sqlite3.Row, now: str) -> tuple[dict, bool]:
    pid = profile["id"]
    available = lieutenants_for_level(profile["level"])
    neutralised = neutralised_set(conn, pid)
    won = boss_tiers_won(conn, pid)
    tier = tier_available(len(neutralised), len(available), won)
    if tier is None:
        raise HTTPException(409, BOSS_MESSAGE)
    existing = conn.execute("SELECT * FROM quest WHERE profile_id = ? AND kind = 'boss' AND status = 'active'", (pid,)).fetchone()
    if existing is not None:
        goal = json.loads(existing["goal_json"])
        return {"quest": quest_out(conn, existing), "text_id": goal["text_id"], "tier": goal["tier"]}, False
    text_id = _pick_boss_text(conn, profile)
    if text_id is None:
        raise HTTPException(409, "Éris ne trouve pas de texte assez long pour ce combat.")
    goal = {"tier": tier, "text_id": text_id}
    reward = {"xp": QUEST_BONUS["boss"], "reward_id": BOSS_REWARDS[tier], "bestiary": False}
    quest = create_quest(conn, profile, "boss", "eris", None, goal, reward, now)
    return {"quest": quest, "text_id": text_id, "tier": tier}, True


def oracle_out(conn: sqlite3.Connection, profile: sqlite3.Row, row: dict, day: str) -> dict:
    scrolls_json = json.loads(row["scrolls_json"])
    chosen = row["chosen"]
    quest = None
    if row["quest_id"] is not None:
        qrow = conn.execute("SELECT * FROM quest WHERE id = ?", (row["quest_id"],)).fetchone()
        if qrow is not None:
            quest = quest_out(conn, qrow)
    scrolls = []
    for s in oracle_mod.scroll_meta():
        key = s["key"]
        lieutenant = None
        if key == chosen:
            lieutenant = quest["target"] if quest is not None else scrolls_json.get(key)
        scrolls.append({**s, "lieutenant": lieutenant})
    # Once a scroll is chosen, the reward line must name *this* quest's reward, not next week's
    # (SP3 batch review M3) — oracle_reward_for() is recomputed from the done count, which already
    # advanced once this quest completes.
    reward_id = quest["reward"]["reward_id"] if quest is not None else oracle_mod.oracle_reward_for(conn, profile["id"])
    return {"week": row["week"], "status": "chosen" if chosen else "sealed", "reward_id": reward_id,
            "scrolls": scrolls, "quest": quest, "prophecies": prophecies(conn, day)}


def consult(conn: sqlite3.Connection, profile: sqlite3.Row, week: str, scroll: str, lieutenant: str | None, now: str) -> tuple[dict, dict]:
    pid = profile["id"]
    row = conn.execute("SELECT * FROM oracle WHERE profile_id = ? AND week = ?", (pid, week)).fetchone()
    scrolls_json = json.loads(row["scrolls_json"])
    if scroll == "ecole":
        if not lieutenant or lieutenant not in LIEUTENANTS:
            raise ValueError("Il faut choisir un monstre.")
        target = lieutenant
    else:
        if lieutenant is not None and lieutenant not in LIEUTENANTS:
            raise ValueError("unknown lieutenant")
        target = scrolls_json[scroll]
    # Decision 7: the previous week's Oracle quest is "replaced quietly at the next consultation",
    # not at the Monday seal (SP3 batch review I3) — so it stays open until the player actually
    # opens a new scroll, here.
    conn.execute("UPDATE quest SET status = 'expired' WHERE profile_id = ? AND kind = 'oracle' AND status = 'active' AND week <> ?",
                 (pid, week))
    played = {r[0] for r in conn.execute("SELECT DISTINCT text_id FROM session WHERE profile_id = ?", (pid,))}
    texts = recommend_texts(text_rows_with_density(conn, target), target, profile["level"], played)
    reward = {"xp": QUEST_BONUS["oracle"], "reward_id": oracle_mod.oracle_reward_for(conn, pid), "bestiary": True}
    goal = {"sessions": 3, "texts": texts}
    quest = create_quest(conn, profile, "oracle", target, week, goal, reward, now)
    conn.execute("UPDATE oracle SET chosen = ?, quest_id = ?, consulted_at = ? WHERE profile_id = ? AND week = ?",
                 (scroll, quest["id"], now, pid, week))
    updated = dict(conn.execute("SELECT * FROM oracle WHERE profile_id = ? AND week = ?", (pid, week)).fetchone())
    return updated, quest


# --- Endpoints ---------------------------------------------------------

@router.get("/world")
def get_world(request: Request):
    return {
        "lieutenants": [{"key": k, **LIEUTENANTS[k]} for k in LIEUTENANT_ORDER],
        "rewards": REWARDS,
        # Spec 2026-09-29 dragon growth §2: the dragon's stages, their names and XP (from the rules file).
        "stages": stage_table(request.app.state.rules.dragon_stages),
        "tints": TINTS,
        "oracle_rewards": ORACLE_REWARDS,
        "boss_rewards": {str(k): v for k, v in BOSS_REWARDS.items()},
        "mastery": MASTERY,
        "quest_bonus": QUEST_BONUS,
        # Spec 2026-09-29 §7: what the client needs of the rules file (the copy line, the bonuses, the owl).
        "rules": request.app.state.rules.as_dict(),
    }


@router.get("/profiles/{profile_id}/camp")
def get_camp(profile_id: int, request: Request, db: sqlite3.Connection = Depends(get_db)):
    profile = fetch_profile(db, profile_id)
    now = now_utc(); day = local_day(now); week = iso_week(day)
    pid = profile["id"]
    available = lieutenants_for_level(profile["level"])
    neutralised = neutralised_set(db, pid)
    oracle_row = oracle_mod.get_or_seal(db, profile, week, available, neutralised, now)
    db.commit()
    full_oracle = oracle_out(db, profile, oracle_row, day)
    quests = [quest_out(db, r) for r in
             db.execute("SELECT * FROM quest WHERE profile_id = ? AND status = 'active' ORDER BY id DESC", (pid,))]
    target = int(json.loads(profile["settings_json"] or "{}").get("weekly_goal", 3))
    done = weekly_done(db, pid, week)
    won = boss_tiers_won(db, pid)
    tier_avail = tier_available(len(neutralised), len(available), won)
    active_boss = db.execute("SELECT id FROM quest WHERE profile_id = ? AND kind = 'boss' AND status = 'active'", (pid,)).fetchone()
    rewards_count = db.execute("SELECT COUNT(*) FROM reward WHERE profile_id = ?", (pid,)).fetchone()[0]
    rules = request.app.state.rules
    dragon = dragon_out(db, profile, now, rules)   # may persist a caught-up stage (see dragon_out)
    db.commit()
    return {
        "profile": to_out(profile), "xp": xp_block(db, pid, dragon["stage"], rules), "dragon": dragon,
        "lieutenants": lieutenant_states(db, profile), "quests": quests,
        "oracle": {"week": full_oracle["week"], "status": full_oracle["status"], "reward_id": full_oracle["reward_id"]},
        "prophecies": full_oracle["prophecies"],
        "weekly": {"week": week, "target": target, "done": done, "reached": done >= target},
        "boss": {"tier_available": tier_avail, "tiers_won": sorted(won), "active_quest_id": active_boss["id"] if active_boss else None},
        "rewards_count": rewards_count, "small_tricks": small_tricks(db, pid),
    }


@router.patch("/profiles/{profile_id}/dragon")
def patch_dragon(profile_id: int, body: DragonPatch, request: Request, db: sqlite3.Connection = Depends(get_db)):
    profile = fetch_profile(db, profile_id)
    now = now_utc()
    ensure_dragon(db, profile_id, now)
    updates: dict[str, object] = {}
    if body.name is not None:
        updates["name"] = body.name
    if body.tint is not None:
        current = dragon_out(db, profile, now, request.app.state.rules)
        if body.tint not in TINTS or body.tint not in current["unlocked_tints"]:
            raise HTTPException(422, TINT_LOCKED_MESSAGE)
        updates["tint"] = body.tint
    if updates:
        sets = ", ".join(f"{k} = ?" for k in updates)
        db.execute(f"UPDATE dragon SET {sets}, updated_at = ? WHERE profile_id = ?", (*updates.values(), now, profile_id))
    result = dragon_out(db, profile, now, request.app.state.rules)
    db.commit()
    return result


@router.get("/profiles/{profile_id}/quests")
def get_quests(profile_id: int, status: str | None = None, db: sqlite3.Connection = Depends(get_db)):
    fetch_profile(db, profile_id)
    if status == "active":
        cond = "status = 'active'"
    elif status == "done":
        cond = "status = 'done'"
    else:
        cond = "status IN ('active','done')"
    rows = db.execute(f"SELECT * FROM quest WHERE profile_id = ? AND {cond} ORDER BY id DESC LIMIT 50", (profile_id,)).fetchall()
    return [quest_out(db, r) for r in rows]


@router.post("/profiles/{profile_id}/quests", status_code=201)
def post_quest(profile_id: int, body: QuestCreate, db: sqlite3.Connection = Depends(get_db)):
    profile = fetch_profile(db, profile_id)
    q = create_board_quest(db, profile, body.target, now_utc())
    db.commit()
    return q


@router.post("/profiles/{profile_id}/quests/{quest_id}/shelve")
def shelve_quest(profile_id: int, quest_id: int, db: sqlite3.Connection = Depends(get_db)):
    fetch_profile(db, profile_id)
    row = db.execute("SELECT * FROM quest WHERE id = ? AND profile_id = ?", (quest_id, profile_id)).fetchone()
    if row is None:
        raise HTTPException(404, "Quest not found")
    if row["status"] != "active" or row["kind"] != "board":
        raise HTTPException(409, "Seule une quête du mur en cours peut être rangée.")
    db.execute("UPDATE quest SET status = 'shelved' WHERE id = ?", (quest_id,))
    db.commit()
    row = db.execute("SELECT * FROM quest WHERE id = ?", (quest_id,)).fetchone()
    return quest_out(db, row)


@router.get("/profiles/{profile_id}/oracle")
def get_oracle(profile_id: int, db: sqlite3.Connection = Depends(get_db)):
    profile = fetch_profile(db, profile_id)
    now = now_utc(); day = local_day(now); week = iso_week(day)
    available = lieutenants_for_level(profile["level"])
    neutralised = neutralised_set(db, profile["id"])
    row = oracle_mod.get_or_seal(db, profile, week, available, neutralised, now)
    db.commit()
    return oracle_out(db, profile, row, day)


@router.post("/profiles/{profile_id}/oracle", status_code=201)
def post_oracle(profile_id: int, body: OracleChoice, db: sqlite3.Connection = Depends(get_db)):
    profile = fetch_profile(db, profile_id)
    now = now_utc(); day = local_day(now); week = iso_week(day)
    available = lieutenants_for_level(profile["level"])
    neutralised = neutralised_set(db, profile["id"])
    row = oracle_mod.get_or_seal(db, profile, week, available, neutralised, now)
    if row["chosen"] is not None:
        raise HTTPException(409, ORACLE_ALREADY_CONSULTED)
    try:
        oracle_row, quest = consult(db, profile, week, body.scroll, body.lieutenant, now)
    except ValueError as e:
        raise HTTPException(422, str(e))
    db.commit()
    return {"oracle": oracle_out(db, profile, oracle_row, day), "quest": quest}


@router.post("/profiles/{profile_id}/boss")
def post_boss(profile_id: int, response: Response, db: sqlite3.Connection = Depends(get_db)):
    profile = fetch_profile(db, profile_id)
    data, created = create_boss_quest(db, profile, now_utc())
    db.commit()
    response.status_code = 201 if created else 200
    return data


@router.get("/profiles/{profile_id}/rewards")
def get_rewards(profile_id: int, db: sqlite3.Connection = Depends(get_db)):
    fetch_profile(db, profile_id)
    rows = db.execute("SELECT reward_id, granted_at, equipped FROM reward WHERE profile_id = ? ORDER BY granted_at", (profile_id,)).fetchall()
    # A reward id that has left the catalog is skipped, never a 500 (final review M18).
    return [{**REWARDS[r["reward_id"]], "granted_at": r["granted_at"], "equipped": bool(r["equipped"])}
            for r in rows if r["reward_id"] in REWARDS]


def _kind(reward_id: str) -> str | None:
    return REWARDS.get(reward_id, {}).get("kind")


def _displayed_decor(conn: sqlite3.Connection, profile_id: int) -> int:
    """How many pieces of decor hang on the cabin's walls (a stale catalog id counts as none)."""
    rows = conn.execute("SELECT reward_id FROM reward WHERE profile_id = ? AND equipped = 1", (profile_id,)).fetchall()
    return sum(1 for r in rows if _kind(r["reward_id"]) == "decor")


@router.patch("/profiles/{profile_id}/rewards/{reward_id}")
def patch_reward(profile_id: int, reward_id: str, body: RewardPatch, db: sqlite3.Connection = Depends(get_db)):
    fetch_profile(db, profile_id)
    if reward_id not in REWARDS:
        raise HTTPException(404, "Reward not found")
    # The count and the update are one transaction under the write lock (final review M18): two
    # PATCHes at once cannot both see three pieces on the walls and hang a fifth.
    begin_write(db)
    row = db.execute("SELECT * FROM reward WHERE profile_id = ? AND reward_id = ?", (profile_id, reward_id)).fetchone()
    if row is None:
        db.rollback()
        raise HTTPException(404, "Reward not found")
    if body.equipped and not row["equipped"] and _kind(reward_id) == "decor":
        if _displayed_decor(db, profile_id) >= MAX_DISPLAYED_DECOR:
            db.rollback()
            raise HTTPException(409, WALLS_FULL_MESSAGE)
    db.execute("UPDATE reward SET equipped = ? WHERE profile_id = ? AND reward_id = ?", (int(body.equipped), profile_id, reward_id))
    db.commit()
    row = db.execute("SELECT * FROM reward WHERE profile_id = ? AND reward_id = ?", (profile_id, reward_id)).fetchone()
    return {**REWARDS[reward_id], "granted_at": row["granted_at"], "equipped": bool(row["equipped"])}
