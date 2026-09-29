"""Applies a saved session to the world: XP, quests, mastery, dragon, weekly goal (spec §3.6; plan Decisions 3, 6, 7, 8, 11, 15).
Runs after app.stats.apply_session_to_stats so profile_stat_day already includes the session. Never removes anything."""
from __future__ import annotations
import json, sqlite3
from app.clock import iso_week, week_bounds_utc
from app.rules import Rules
from app.schemas import AID_KEYS
from app.world.catalog import BOSS_REWARDS, DECOR_ORDER, LIEUTENANTS, ORACLE_REWARDS, QUEST_BONUS, REWARDS
from app.world.mastery import dragon_stage, is_neutralised, lieutenants_for_level, mastery_window, boss_tiers
from app.world.quests import fight_won, session_counts_for
from app.world.xp import rank_for, session_xp


def add_xp(conn, profile_id, amount, reason, now, session_id=None, quest_id=None, week=None):
    conn.execute("INSERT INTO xp_event(profile_id, session_id, quest_id, amount, reason, week, created_at) VALUES (?,?,?,?,?,?,?)",
                 (profile_id, session_id, quest_id, amount, reason, week, now))


def xp_total(conn, profile_id) -> int:
    return conn.execute("SELECT COALESCE(SUM(amount), 0) FROM xp_event WHERE profile_id = ?", (profile_id,)).fetchone()[0]


def grant_reward(conn, profile_id, reward_id, source, now) -> bool:
    if reward_id not in REWARDS: return False
    cur = conn.execute("INSERT OR IGNORE INTO reward(profile_id, reward_id, source, granted_at) VALUES (?,?,?,?)",
                       (profile_id, reward_id, source, now))
    return cur.rowcount == 1


def lieutenant_day_rows(conn, profile_id, categories) -> list[dict]:
    marks = ",".join("?" * len(categories))
    return [dict(r) for r in conn.execute(
        f"SELECT day, SUM(errors_in_draft) AS errors_in_draft, SUM(caught) AS caught FROM profile_stat_day "
        f"WHERE profile_id = ? AND category IN ({marks}) GROUP BY day", (profile_id, *categories))]


def neutralised_set(conn, profile_id) -> set[str]:
    return {r[0] for r in conn.execute("SELECT lieutenant FROM mastery WHERE profile_id = ?", (profile_id,))}


def boss_tiers_won(conn, profile_id) -> set[int]:
    return {json.loads(r[0]).get("tier") for r in conn.execute(
        "SELECT goal_json FROM quest WHERE profile_id = ? AND kind = 'boss' AND status = 'done'", (profile_id,))}


def weekly_done(conn, profile_id, week) -> int:
    # Compares finished_at (UTC) against the week's local Monday 00:00 / next Monday 00:00,
    # converted to UTC (SP3 batch review I4): a substr-on-UTC-date comparison put sessions
    # finished 00:00-02:00 local Monday in the wrong week, since Europe/Zurich is UTC+1/+2.
    start, end = week_bounds_utc(week)
    return conn.execute("SELECT COUNT(*) FROM session WHERE profile_id = ? AND finished_at >= ? AND finished_at < ?",
                        (profile_id, start, end)).fetchone()[0]


def ensure_dragon(conn, profile_id, now) -> sqlite3.Row:
    conn.execute("INSERT OR IGNORE INTO dragon(profile_id, updated_at) VALUES (?, ?)", (profile_id, now))
    return conn.execute("SELECT * FROM dragon WHERE profile_id = ?", (profile_id,)).fetchone()


def _complete_quest(conn, q, profile_id, now, bonuses, rewards):
    reward = json.loads(q["reward_json"])
    conn.execute("UPDATE quest SET status = 'done', completed_at = ? WHERE id = ?", (now, q["id"]))
    add_xp(conn, profile_id, reward["xp"], q["kind"], now, quest_id=q["id"], week=q["week"])
    bonuses.append({"reason": q["kind"], "amount": reward["xp"]})
    if reward.get("reward_id") and grant_reward(conn, profile_id, reward["reward_id"], f"quest:{q['id']}", now):
        r = REWARDS[reward["reward_id"]]; rewards.append({"id": r["id"], "kind": r["kind"], "name": r["name"]})
    if q["kind"] == "board":
        done = conn.execute("SELECT COUNT(*) FROM quest WHERE profile_id = ? AND kind = 'board' AND status = 'done'", (profile_id,)).fetchone()[0]
        if done % 2 == 0 and (done // 2) <= len(DECOR_ORDER):
            rid = DECOR_ORDER[done // 2 - 1]
            if grant_reward(conn, profile_id, rid, f"board:{done}", now):
                r = REWARDS[rid]; rewards.append({"id": rid, "kind": r["kind"], "name": r["name"]})


def apply_progression(conn, profile, session_id, body, result, day, now, prophecy, rules: Rules) -> dict:
    pid = profile["id"]; level = profile["level"]; week = iso_week(day)
    mode = getattr(body, "mode", "dictation")
    total_before = xp_total(conn, pid)
    rank_before = rank_for(total_before)[0]
    bonuses: list[dict] = []; rewards: list[dict] = []
    # 1. session XP (spec 2026-09-29 §4): a page opened before the aids sends none, and leaves none.
    aids = getattr(body, "aids", None)
    aids_left = len(AID_KEYS) - len(aids) if aids is not None else 0
    xp = session_xp(result, body.pace_level, mode, prophecy, aids_left, rules)
    add_xp(conn, pid, xp.total, "session", now, session_id=session_id, week=week)
    # 2. quests
    quest_out = []; boss_out = None
    by_cat = result.get("byCategory", {})
    for q in conn.execute("SELECT * FROM quest WHERE profile_id = ? AND status = 'active' ORDER BY id", (pid,)).fetchall():
        goal = json.loads(q["goal_json"]); progress = json.loads(q["progress_json"] or "{}")
        progress.setdefault("sessions", 0); progress.setdefault("log", [])
        if q["kind"] == "boss":
            if body.quest_id != q["id"]: continue
            won = fight_won(result, rules)
            progress["log"].append({"session_id": session_id, "ok": won})
            boss_out = {"tier": goal["tier"], "won": won}
            if won: _complete_quest(conn, q, pid, now, bonuses, rewards)
            conn.execute("UPDATE quest SET progress_json = ? WHERE id = ?", (json.dumps(progress), q["id"]))
            quest_out.append({"id": q["id"], "kind": "boss", "target": "eris", "counted": won, "progress": 1 if won else 0, "goal": 1,
                              "completed": won, "reward_id": json.loads(q["reward_json"]).get("reward_id")})
            continue
        cats = LIEUTENANTS[q["target"]]["categories"]
        ok = session_counts_for(by_cat, cats, rules)
        if ok: progress["sessions"] += 1
        progress["log"].append({"session_id": session_id, "ok": ok})
        completed = progress["sessions"] >= goal["sessions"]
        conn.execute("UPDATE quest SET progress_json = ? WHERE id = ?", (json.dumps(progress), q["id"]))
        if completed: _complete_quest(conn, q, pid, now, bonuses, rewards)
        quest_out.append({"id": q["id"], "kind": q["kind"], "target": q["target"], "counted": ok, "progress": progress["sessions"],
                          "goal": goal["sessions"], "completed": completed, "reward_id": json.loads(q["reward_json"]).get("reward_id")})
    # 3. mastery (permanent)
    available = lieutenants_for_level(level)
    already = neutralised_set(conn, pid)
    newly = []
    for key in available:
        if key in already: continue
        if is_neutralised(mastery_window(lieutenant_day_rows(conn, pid, LIEUTENANTS[key]["categories"]))):
            conn.execute("INSERT INTO mastery(profile_id, lieutenant, neutralised_at) VALUES (?,?,?)", (pid, key, now))
            newly.append(key)
            add_xp(conn, pid, QUEST_BONUS["mastery"], "mastery", now, session_id=session_id, week=week)
            bonuses.append({"reason": "mastery", "amount": QUEST_BONUS["mastery"]})
            rid = LIEUTENANTS[key]["relic"]
            if grant_reward(conn, pid, rid, f"mastery:{key}", now):
                r = REWARDS[rid]; rewards.append({"id": rid, "kind": r["kind"], "name": r["name"]})
    # 4. dragon stage is stored MONOTONICALLY: a new lieutenant unlock (e.g. Protée at 8H) can raise
    # `available` for an already-neutralised profile, but the stored stage never goes down for it.
    dragon = ensure_dragon(conn, pid, now)
    stage_before = dragon["stage"]
    n = len(already | set(newly))
    computed = dragon_stage(n, len(available))
    stage_after = max(stage_before, computed, key=lambda s: ["egg", "hatchling", "young", "adult"].index(s))
    if stage_after != stage_before:
        conn.execute("UPDATE dragon SET stage = ?, hatched_at = COALESCE(hatched_at, ?), updated_at = ? WHERE profile_id = ?",
                     (stage_after, now, now, pid))
    needs_name = stage_after != "egg" and dragon["name"] is None
    # 5. weekly goal
    target = int(json.loads(profile["settings_json"] or "{}").get("weekly_goal", 3))
    done = weekly_done(conn, pid, week)
    reached_now = False
    if done >= target and conn.execute("SELECT 1 FROM xp_event WHERE profile_id = ? AND reason = 'weekly' AND week = ?", (pid, week)).fetchone() is None:
        add_xp(conn, pid, QUEST_BONUS["weekly"], "weekly", now, week=week)
        bonuses.append({"reason": "weekly", "amount": QUEST_BONUS["weekly"]}); reached_now = True
    total_after = xp_total(conn, pid)
    rank_after, title_after, _, _ = rank_for(total_after)
    return {"xp": {"session": xp.total, "parts": xp.parts, "bonuses": bonuses, "total_before": total_before, "total_after": total_after,
                   "rank_before": rank_before, "rank_after": rank_after, "title_after": title_after},
            "quests": quest_out, "neutralised": newly, "rewards": rewards,
            "dragon": {"stage_before": stage_before, "stage_after": stage_after, "needs_name": needs_name},
            "weekly": {"target": target, "done": done, "reached_now": reached_now}, "boss": boss_out,
            "encounter": body.encounter}
