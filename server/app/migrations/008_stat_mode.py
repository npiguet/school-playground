"""Migration 008: the stats tables gain a `mode` ('dictation' | 'grimoire') in their primary key, so
the child's own mistakes (dictations) are told apart from Éris's planted ones (Grimoire corrompu).

The existing counters are split by replaying the Grimoire sessions still on record: their result_json's
`byCategory`, on the Swiss day the writer dated them. The day rows are split first, each Grimoire share
clamped to its day row; the all-time row's Grimoire share is the sum of its clamped day shares, clamped
again to the all-time row. Everything the sessions cannot explain stays in 'dictation': sessions saved
without a byCategory, sessions cascade-deleted with their text, malformed results. So for every old row
the new rows sum to exactly its counters (nothing lost or invented), and wherever the day rows explain
the totals, the all-time rows per mode are the sums of the day rows per mode.

`introduced` was only stored from migration 005 on, although the client sent it before: a Grimoire
session finished before 005 was applied contributes no `introduced` (otherwise it would take the child's
own later mistakes away from 'dictation').

Python, not SQL, because the Swiss day needs the time zone (DST) that SQLite does not know. Runs in
db.migrate's transaction: conn.execute only (no executescript, commit, BEGIN or PRAGMA). Frozen on
purpose: nothing is imported from the app, the day computation included (it copies app.clock.local_day
as it was when this migration was written; test_stat_mode pins that they agree)."""
from __future__ import annotations
import json
import os
import sqlite3
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

COUNTERS = ("occurrences", "errors_in_draft", "caught", "missed", "introduced")
# byCategory's keys for each counter, as apply_session_to_stats read them when this migration was written.
RESULT_KEYS = ("opportunities", "draft", "caught", "missed", "introduced")
INTRODUCED = COUNTERS.index("introduced")
# The time zone the writer dated sessions in (app.clock.DEFAULT_TZ).
TZ = os.environ.get("DISCORDE_TZ", "Europe/Zurich")

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


def _utc(stamp: str) -> datetime:
    dt = datetime.fromisoformat(stamp)
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def swiss_day(stamp: str) -> str:
    """The session's local day, exactly as app.clock.local_day computes it for the writer."""
    return _utc(stamp).astimezone(ZoneInfo(TZ)).date().isoformat()


def _count(value) -> int:
    try:
        return max(0, int(value or 0))
    except (TypeError, ValueError):
        return 0


def introduced_since(conn: sqlite3.Connection) -> datetime | None:
    """When the server started storing `introduced`: migration 005's applied_at (UTC, written by
    db.migrate). None when it cannot be read: then no cutoff, and the day clamp alone bounds it."""
    row = conn.execute("SELECT applied_at FROM schema_version WHERE version = 5").fetchone()
    try:
        return _utc(row[0]) if row else None
    except (TypeError, ValueError):
        return None


def grimoire_by_day(conn: sqlite3.Connection) -> dict[tuple, list[int]]:
    """The Grimoire sessions' counters per (profile, day, category)."""
    cutoff = introduced_since(conn)
    by_day: dict[tuple, list[int]] = {}
    for pid, finished_at, result_json in conn.execute(
            "SELECT profile_id, finished_at, result_json FROM session WHERE mode = 'grimoire'"):
        try:
            by_category = json.loads(result_json).get("byCategory")
            day = swiss_day(finished_at)
            before_005 = cutoff is not None and _utc(finished_at) < cutoff
        except (TypeError, ValueError, AttributeError):
            continue
        if not isinstance(by_category, dict):
            continue
        for category, c in by_category.items():
            if not isinstance(c, dict):
                continue
            vals = [_count(c.get(k)) for k in RESULT_KEYS]
            if before_005:
                vals[INTRODUCED] = 0
            key = (pid, day, category)
            by_day[key] = [a + b for a, b in zip(by_day.get(key, [0] * 5), vals)]
    return by_day


def split(old: tuple[int, ...], grimoire: list[int] | None) -> tuple[list[int], list[int]]:
    """(dictation, grimoire): the Grimoire share clamped to the old counters, the rest to dictation.
    Each counter is clamped on its own: on inconsistent data (a share above the old row) the Grimoire row
    can end with caught > errors_in_draft; the sums stay exact, which is what the readers rely on."""
    g = [min(max(0, s), o) if o > 0 else 0 for s, o in zip(grimoire or [0] * 5, old)]
    return [o - s for o, s in zip(old, g)], g


def _insert(conn, table: str, keys: dict, mode: str, vals: list[int], extra: dict) -> None:
    cols = [*keys, "mode", *COUNTERS, *extra]
    conn.execute(f"INSERT INTO {table}({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))})",
                 (*keys.values(), mode, *vals, *extra.values()))


def _write(conn, table: str, keys: dict, old: tuple, grimoire: list[int] | None, extra: dict) -> list[int]:
    """Writes one old row's split; returns the Grimoire share it kept."""
    dictation, kept = split(old, grimoire)
    if any(kept):
        _insert(conn, table, keys, "grimoire", kept, extra)
    if any(dictation) or not any(kept):   # an all-zero old row is kept, as it was
        _insert(conn, table, keys, "dictation", dictation, extra)
    return kept


def up(conn: sqlite3.Connection) -> None:
    for statement in SCHEMA:
        conn.execute(statement)
    by_day = grimoire_by_day(conn)
    cols = ", ".join(COUNTERS)

    # The day rows first; the all-time Grimoire share is the sum of the day shares they kept.
    total: dict[tuple, list[int]] = {}
    for pid, day, category, *old in conn.execute(f"SELECT profile_id, day, category, {cols} FROM profile_stat_day").fetchall():
        kept = _write(conn, "profile_stat_day_new", {"profile_id": pid, "day": day, "category": category},
                      tuple(old), by_day.get((pid, day, category)), {})
        total[(pid, category)] = [a + b for a, b in zip(total.get((pid, category), [0] * 5), kept)]

    for pid, category, *rest in conn.execute(f"SELECT profile_id, category, {cols}, updated_at FROM profile_stat").fetchall():
        _write(conn, "profile_stat_new", {"profile_id": pid, "category": category}, tuple(rest[:5]),
               total.get((pid, category)), {"updated_at": rest[5]})

    conn.execute("DROP TABLE profile_stat")
    conn.execute("DROP TABLE profile_stat_day")
    conn.execute("ALTER TABLE profile_stat_new RENAME TO profile_stat")
    conn.execute("ALTER TABLE profile_stat_day_new RENAME TO profile_stat_day")
