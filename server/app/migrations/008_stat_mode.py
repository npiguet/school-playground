"""Migration 008: the stats tables gain a `mode` ('dictation' | 'grimoire') in their primary key, so
the child's own mistakes (dictations) are told apart from Éris's planted ones (Grimoire corrompu).

The existing counters are split by replaying the Grimoire sessions still on record (their result_json's
`byCategory`, on the session's Swiss day as `apply_session_to_stats` dated it). Everything the sessions
cannot explain stays in 'dictation': sessions recorded without a byCategory, sessions cascade-deleted
with their text, malformed results. A Grimoire share larger than the old counter (inconsistent data)
is clamped to it. So for every old row the new rows sum to exactly its counters: nothing is lost or
invented.

Python, not SQL, because the Swiss day needs the time zone (DST) that SQLite does not know. Runs in
db.migrate's transaction: conn.execute only (no executescript, commit, BEGIN or PRAGMA). Self-contained
on purpose (frozen): later changes to app.stats must not change what this migration did."""
from __future__ import annotations
import json
import sqlite3
from app.clock import local_day

COUNTERS = ("occurrences", "errors_in_draft", "caught", "missed", "introduced")
# byCategory's keys for each counter, as apply_session_to_stats read them when this migration was written.
RESULT_KEYS = ("opportunities", "draft", "caught", "missed", "introduced")

SCHEMA = [
    """CREATE TABLE profile_stat_new (
      profile_id      INTEGER NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
      category        TEXT NOT NULL,
      mode            TEXT NOT NULL CHECK (mode IN ('dictation', 'grimoire')),
      occurrences     INTEGER NOT NULL DEFAULT 0,
      errors_in_draft INTEGER NOT NULL DEFAULT 0,
      caught          INTEGER NOT NULL DEFAULT 0,
      missed          INTEGER NOT NULL DEFAULT 0,
      introduced      INTEGER NOT NULL DEFAULT 0,
      updated_at      TEXT NOT NULL,
      PRIMARY KEY (profile_id, category, mode))""",
    """CREATE TABLE profile_stat_day_new (
      profile_id      INTEGER NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
      day             TEXT NOT NULL,
      category        TEXT NOT NULL,
      mode            TEXT NOT NULL CHECK (mode IN ('dictation', 'grimoire')),
      occurrences     INTEGER NOT NULL DEFAULT 0,
      errors_in_draft INTEGER NOT NULL DEFAULT 0,
      caught          INTEGER NOT NULL DEFAULT 0,
      missed          INTEGER NOT NULL DEFAULT 0,
      introduced      INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (profile_id, day, category, mode))""",
]


def _count(value) -> int:
    try:
        return max(0, int(value or 0))
    except (TypeError, ValueError):
        return 0


def grimoire_shares(conn: sqlite3.Connection) -> tuple[dict, dict]:
    """The Grimoire sessions' counters per (profile, category) and per (profile, day, category)."""
    total: dict[tuple, list[int]] = {}
    by_day: dict[tuple, list[int]] = {}
    for pid, finished_at, result_json in conn.execute(
            "SELECT profile_id, finished_at, result_json FROM session WHERE mode = 'grimoire'"):
        try:
            by_category = json.loads(result_json).get("byCategory")
            day = local_day(finished_at)
        except (TypeError, ValueError, AttributeError):
            continue
        if not isinstance(by_category, dict):
            continue
        for category, c in by_category.items():
            if not isinstance(c, dict):
                continue
            vals = [_count(c.get(k)) for k in RESULT_KEYS]
            for acc, key in ((total, (pid, category)), (by_day, (pid, day, category))):
                acc[key] = [a + b for a, b in zip(acc.get(key, [0] * 5), vals)]
    return total, by_day


def split(old: tuple[int, ...], grimoire: list[int] | None) -> tuple[list[int], list[int]]:
    """(dictation, grimoire): the Grimoire share clamped to the old counters, the rest to dictation."""
    g = [min(max(0, s), o) if o > 0 else 0 for s, o in zip(grimoire or [0] * 5, old)]
    return [o - s for o, s in zip(old, g)], g


def up(conn: sqlite3.Connection) -> None:
    for statement in SCHEMA:
        conn.execute(statement)
    total, by_day = grimoire_shares(conn)
    cols = ", ".join(COUNTERS)

    for pid, category, *rest in conn.execute(f"SELECT profile_id, category, {cols}, updated_at FROM profile_stat").fetchall():
        old, updated_at = tuple(rest[:5]), rest[5]
        dictation, grimoire = split(old, total.get((pid, category)))
        has_grimoire = any(grimoire)
        if has_grimoire:
            conn.execute(f"INSERT INTO profile_stat_new(profile_id, category, mode, {cols}, updated_at) VALUES (?,?,'grimoire',?,?,?,?,?,?)",
                         (pid, category, *grimoire, updated_at))
        if any(dictation) or not has_grimoire:   # an all-zero old row is kept, as it was
            conn.execute(f"INSERT INTO profile_stat_new(profile_id, category, mode, {cols}, updated_at) VALUES (?,?,'dictation',?,?,?,?,?,?)",
                         (pid, category, *dictation, updated_at))

    for pid, day, category, *old in conn.execute(f"SELECT profile_id, day, category, {cols} FROM profile_stat_day").fetchall():
        dictation, grimoire = split(tuple(old), by_day.get((pid, day, category)))
        has_grimoire = any(grimoire)
        if has_grimoire:
            conn.execute(f"INSERT INTO profile_stat_day_new(profile_id, day, category, mode, {cols}) VALUES (?,?,?,'grimoire',?,?,?,?,?)",
                         (pid, day, category, *grimoire))
        if any(dictation) or not has_grimoire:
            conn.execute(f"INSERT INTO profile_stat_day_new(profile_id, day, category, mode, {cols}) VALUES (?,?,?,'dictation',?,?,?,?,?)",
                         (pid, day, category, *dictation))

    conn.execute("DROP TABLE profile_stat")
    conn.execute("DROP TABLE profile_stat_day")
    conn.execute("ALTER TABLE profile_stat_new RENAME TO profile_stat")
    conn.execute("ALTER TABLE profile_stat_day_new RENAME TO profile_stat_day")
