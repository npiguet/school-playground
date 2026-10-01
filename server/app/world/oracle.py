"""Consultation de l'Oracle: three sealed scrolls, one choice per ISO week (spec §3.6; plan Decision 9)."""
from __future__ import annotations
import json
from app.world.catalog import LIEUTENANTS, ORACLE_REWARDS

SCROLLS = [
    {"key": "faible", "title": "Le point faible", "hint": "Le monstre qui te piège le plus souvent en ce moment."},
    {"key": "ecole", "title": "Ce qui arrive à l'école", "hint": "Choisis le monstre qui ressemble à ce que ta classe étudie."},
    {"key": "destin", "title": "Le choix du destin", "hint": "Un monstre que tu n'as pas affronté depuis longtemps."},
]


def scroll_meta() -> list[dict]:
    return [dict(s) for s in SCROLLS]


def compute_scrolls(conn, profile, available, levels) -> dict:
    """R10 (spec 2026-09-29 lieutenant levels §5): lowest seal first. The weak point is chosen among the
    awake lieutenants at the lowest seal; fate among the others, by seal, then the longest unseen."""
    pid = profile["id"]
    low = min(levels.get(k, 0) for k in available)
    candidates = [k for k in available if levels.get(k, 0) == low]
    rates, last = {}, {}
    for k in available:
        cats = LIEUTENANTS[k]["categories"]; marks = ",".join("?" * len(cats))
        row = conn.execute(f"SELECT SUM(errors_in_draft) d, SUM(caught) c, SUM(missed) m, MAX(day) last FROM profile_stat_day "
                           f"WHERE profile_id = ? AND category IN ({marks})", (pid, *cats)).fetchone()
        d, c, m = row["d"] or 0, row["c"] or 0, row["m"] or 0
        rates[k] = (c / d if d >= 5 else None, m); last[k] = row["last"] or ""
    with_rate = [k for k in candidates if rates[k][0] is not None]
    if with_rate: faible = min(with_rate, key=lambda k: (rates[k][0], candidates.index(k)))
    elif any(rates[k][1] for k in candidates): faible = max(candidates, key=lambda k: rates[k][1])
    else: faible = candidates[0]
    others = sorted((k for k in available if k != faible), key=lambda k: (levels.get(k, 0), last[k], available.index(k)))
    return {"faible": faible, "destin": others[0] if others else faible}


def oracle_reward_for(conn, profile_id) -> str | None:
    n = conn.execute("SELECT COUNT(*) FROM quest WHERE profile_id = ? AND kind = 'oracle' AND status = 'done'", (profile_id,)).fetchone()[0]
    return ORACLE_REWARDS[n] if n < len(ORACLE_REWARDS) else None


def get_or_seal(conn, profile, week, available, levels, now) -> dict:
    row = conn.execute("SELECT * FROM oracle WHERE profile_id = ? AND week = ?", (profile["id"], week)).fetchone()
    if row is None:
        scrolls = compute_scrolls(conn, profile, available, levels)
        # OR IGNORE: two first visits of the week can race here (the library tent and the camp both
        # fetch /camp on mount). Whichever sealed first wins; the other reads that row back below
        # instead of failing on the (profile_id, week) key with a 500.
        conn.execute("INSERT OR IGNORE INTO oracle(profile_id, week, scrolls_json) VALUES (?,?,?)",
                     (profile["id"], week, json.dumps(scrolls)))
        # The previous week's still-active oracle quest is expired inside consult() (world.py),
        # not here (plan Decision 7 "replaced quietly at the next consultation"; SP3 batch
        # review I3) — sealing a new week must not retire a quest the player hasn't replaced yet.
        row = conn.execute("SELECT * FROM oracle WHERE profile_id = ? AND week = ?", (profile["id"], week)).fetchone()
    return dict(row)
