"""The stats tables' mode (migration 008): the child's own mistakes (dictation) are told apart from the
ones Éris planted (Grimoire corrompu), and every reader still sees the sum of both."""
import json
import sqlite3

import pytest

from app.db import DB_FILENAME, connect, migrate
from app.routers import texts as texts_router
from app.routers.world import small_tricks
from app.world import oracle as oracle_mod
from app.world.seals import seal_day_rows, lieutenants_for_level
from app.world.catalog import LIEUTENANTS
from tests.test_db import _db_before
from tests.test_progression import hydre_result, post
from tests.test_sessions import make_profile, make_text

COUNTERS = ("occurrences", "errors_in_draft", "caught", "missed", "introduced")
LONG = " ".join(["Les fées dansent dans la clairière et les oiseaux les écoutent."] * 16)


def by_cat(opp, draft, caught, missed, introduced=0):
    return {"opportunities": opp, "draft": draft, "caught": caught, "missed": missed, "introduced": introduced}


def add_session(conn, pid, mode, finished_at, result_json, text_id=1):
    conn.execute("INSERT INTO session(profile_id, text_id, pace_level, help_stage, mode, started_at, finished_at, draft, "
                 "final, result_json, score) VALUES (?, ?, 1, 0, ?, ?, ?, 'x', 'y', ?, 10)",
                 (pid, text_id, mode, finished_at, finished_at, result_json))


def add_old_stat(conn, pid, category, vals, updated_at="then"):
    conn.execute("INSERT INTO profile_stat(profile_id, category, occurrences, errors_in_draft, caught, missed, introduced, "
                 "updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", (pid, category, *vals, updated_at))


def add_old_day(conn, pid, day, category, vals):
    conn.execute("INSERT INTO profile_stat_day(profile_id, day, category, occurrences, errors_in_draft, caught, missed, "
                 "introduced) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", (pid, day, category, *vals))


def rows(conn, table):
    keys = "profile_id, mode, category" if table == "profile_stat" else "profile_id, mode, day, category"
    return {tuple(r[:-5]): tuple(r[-5:]) for r in conn.execute(
        f"SELECT {keys}, {', '.join(COUNTERS)} FROM {table} ORDER BY {keys}")}


def summed(conn, table):
    keys = "profile_id, category" if table == "profile_stat" else "profile_id, day, category"
    return {tuple(r[:-5]): tuple(r[-5:]) for r in conn.execute(
        f"SELECT {keys}, {', '.join(f'SUM({c})' for c in COUNTERS)} FROM {table} GROUP BY {keys}")}


@pytest.fixture
def old_db(tmp_path):
    """A database at migration 007 with a mixed history, as a hero's real play leaves it."""
    conn = _db_before(tmp_path / "old.sqlite3", 8)
    for pid, name in ((1, "Io"), (2, "Ada")):
        conn.execute("INSERT INTO profile(id, name, avatar, level, help_stage, created_at) VALUES (?, ?, 'chouette', '10H', 0, 'now')",
                     (pid, name))
    conn.execute("INSERT INTO text(id, title, body, source, level, created_at) VALUES (1, 'T', 'Un texte.', 'custom', '8H', 'now')")
    # Io: a dictation, a grimoire played at 01:30 Swiss time (the next Swiss day), a dictation from before
    # result_json carried byCategory, a grimoire with no byCategory, a malformed result.
    add_session(conn, 1, "dictation", "2026-09-01T10:00:00+00:00", json.dumps({"byCategory": {"homophone": by_cat(5, 2, 1, 1)}}))
    add_session(conn, 1, "grimoire", "2026-09-01T23:30:00+00:00", json.dumps({"byCategory": {
        "homophone": by_cat(4, 3, 2, 1, 1), "agreement:verb": by_cat(3, 2, 2, 0)}}))
    add_session(conn, 1, "dictation", "2026-09-02T08:00:00+00:00", "{}")
    add_session(conn, 1, "grimoire", "2026-09-03T08:00:00+00:00", json.dumps({"version": 1}))
    add_session(conn, 1, "grimoire", "2026-09-03T09:00:00+00:00", "not json")
    # The totals also hold a session whose text was deleted since (its row cascaded away): {1,0,0,0,0}.
    add_old_stat(conn, 1, "homophone", (15, 7, 4, 3, 1), "2026-09-03T08:00:00+00:00")
    add_old_stat(conn, 1, "agreement:verb", (3, 2, 2, 0, 0))
    add_old_stat(conn, 1, "accent", (6, 1, 1, 0, 0))
    add_old_day(conn, 1, "2026-09-01", "homophone", (5, 2, 1, 1, 0))
    add_old_day(conn, 1, "2026-09-02", "homophone", (7, 4, 2, 2, 1))
    add_old_day(conn, 1, "2026-09-02", "agreement:verb", (3, 2, 2, 0, 0))
    add_old_day(conn, 1, "2026-09-03", "homophone", (2, 1, 1, 0, 0))
    add_old_day(conn, 1, "2026-08-20", "accent", (6, 1, 1, 0, 0))
    # Ada: inconsistent data, the grimoire's counts exceed the totals; and a category with no total row.
    add_session(conn, 2, "grimoire", "2026-09-05T10:00:00+00:00", json.dumps({"byCategory": {
        "homophone": by_cat(10, 5, 5, 0), "lexical": by_cat(2, 1, 0, 1)}}))
    add_old_stat(conn, 2, "homophone", (6, 2, 3, 1, 0))
    add_old_day(conn, 2, "2026-09-05", "homophone", (6, 2, 3, 1, 0))
    conn.commit()
    yield conn
    conn.close()


def test_migration_008_splits_the_counters_by_mode_and_keeps_every_sum(old_db):
    before_stat, before_day = summed(old_db, "profile_stat"), summed(old_db, "profile_stat_day")
    assert migrate(old_db) >= 8
    assert summed(old_db, "profile_stat") == before_stat
    assert summed(old_db, "profile_stat_day") == before_day
    assert rows(old_db, "profile_stat") == {
        (1, "dictation", "accent"): (6, 1, 1, 0, 0),
        (1, "dictation", "homophone"): (11, 4, 2, 2, 0),        # s1 + the old dictation + the unexplained grimoire + deleted
        (1, "grimoire", "agreement:verb"): (3, 2, 2, 0, 0),     # no empty dictation row beside it
        (1, "grimoire", "homophone"): (4, 3, 2, 1, 1),
        (2, "dictation", "homophone"): (0, 0, 0, 1, 0),         # clamped: the grimoire cannot exceed the total
        (2, "grimoire", "homophone"): (6, 2, 3, 0, 0),
    }
    assert rows(old_db, "profile_stat_day") == {
        (1, "dictation", "2026-08-20", "accent"): (6, 1, 1, 0, 0),
        (1, "dictation", "2026-09-01", "homophone"): (5, 2, 1, 1, 0),
        (1, "dictation", "2026-09-02", "homophone"): (3, 1, 0, 1, 0),
        (1, "dictation", "2026-09-03", "homophone"): (2, 1, 1, 0, 0),   # a grimoire without byCategory stays here
        (1, "grimoire", "2026-09-02", "agreement:verb"): (3, 2, 2, 0, 0),   # 23:30 UTC is the next Swiss day
        (1, "grimoire", "2026-09-02", "homophone"): (4, 3, 2, 1, 1),
        (2, "dictation", "2026-09-05", "homophone"): (0, 0, 0, 1, 0),
        (2, "grimoire", "2026-09-05", "homophone"): (6, 2, 3, 0, 0),
    }
    assert {r[0] for r in old_db.execute("SELECT updated_at FROM profile_stat WHERE profile_id = 1 AND category = 'homophone'")} \
        == {"2026-09-03T08:00:00+00:00"}


def test_migration_008_runs_once(old_db):
    version = migrate(old_db)
    after = rows(old_db, "profile_stat"), rows(old_db, "profile_stat_day")
    assert migrate(old_db) == version
    assert (rows(old_db, "profile_stat"), rows(old_db, "profile_stat_day")) == after


def test_the_mode_is_part_of_the_key_and_only_takes_the_two_modes(tmp_path):
    conn = connect(tmp_path / "t.sqlite3"); migrate(conn)
    pk = {r["name"]: r["pk"] for r in conn.execute("PRAGMA table_info(profile_stat)") if r["pk"]}
    pk_day = {r["name"] for r in conn.execute("PRAGMA table_info(profile_stat_day)") if r["pk"]}
    assert set(pk) == {"profile_id", "category", "mode"} and pk_day == {"profile_id", "day", "category", "mode"}
    conn.execute("INSERT INTO profile(id, name, avatar, level, help_stage, created_at) VALUES (1, 'Io', 'chouette', '10H', 0, 'now')")
    with pytest.raises(sqlite3.IntegrityError):
        conn.execute("INSERT INTO profile_stat(profile_id, mode, category, updated_at) VALUES (1, 'boss', 'homophone', 'now')")
    with pytest.raises(sqlite3.IntegrityError):
        conn.execute("INSERT INTO profile_stat_day(profile_id, day, category) VALUES (1, '2026-09-01', 'homophone')")


def test_a_migration_that_fails_leaves_the_database_at_007(old_db, monkeypatch):
    import app.db as db_mod
    real = db_mod._load_python_migration

    def broken(path):
        up = real(path)

        def fail(conn):
            up(conn)
            raise RuntimeError("killed")
        return fail
    monkeypatch.setattr(db_mod, "_load_python_migration", broken)
    before = summed(old_db, "profile_stat")
    with pytest.raises(RuntimeError):
        migrate(old_db)
    assert old_db.execute("SELECT MAX(version) FROM schema_version").fetchone()[0] == 7
    assert "mode" not in {r["name"] for r in old_db.execute("PRAGMA table_info(profile_stat)")}
    assert summed(old_db, "profile_stat") == before
    monkeypatch.undo()
    assert migrate(old_db) >= 8 and summed(old_db, "profile_stat") == before


def db(settings):
    conn = sqlite3.connect(settings.data_dir / DB_FILENAME); conn.row_factory = sqlite3.Row
    return conn


def test_a_session_writes_into_the_row_of_its_mode(client, settings):
    pid = make_profile(client); tid = make_text(client)
    post(client, pid, tid, hydre_result(draft=4, caught=3), day="2026-09-21")
    post(client, pid, tid, hydre_result(draft=6, caught=5), day="2026-09-21", mode="grimoire")
    post(client, pid, tid, hydre_result(draft=2, caught=2), day="2026-09-21", mode="grimoire")
    conn = db(settings)
    assert rows(conn, "profile_stat") == {(pid, "dictation", "agreement:verb"): (10, 4, 3, 1, 0),
                                          (pid, "grimoire", "agreement:verb"): (20, 8, 7, 1, 0)}
    assert rows(conn, "profile_stat_day") == {(pid, "dictation", "2026-09-21", "agreement:verb"): (10, 4, 3, 1, 0),
                                              (pid, "grimoire", "2026-09-21", "agreement:verb"): (20, 8, 7, 1, 0)}
    conn.close()


def test_the_stats_endpoint_sums_both_modes_and_shows_the_split(client):
    pid = make_profile(client); tid = make_text(client)
    post(client, pid, tid, hydre_result(draft=4, caught=3))
    post(client, pid, tid, hydre_result(draft=6, caught=5), mode="grimoire")
    stats = client.get(f"/api/profiles/{pid}/stats").json()
    assert stats["categories"] == [{
        "category": "agreement:verb", "occurrences": 20, "errors_in_draft": 10, "caught": 8, "missed": 2, "catch_rate": 0.8,
        "by_mode": {"dictation": {"occurrences": 10, "errors_in_draft": 4, "caught": 3, "missed": 1, "introduced": 0},
                    "grimoire": {"occurrences": 10, "errors_in_draft": 6, "caught": 5, "missed": 1, "introduced": 0}}}]
    assert stats["totals"]["caught"] == 8


# Every reader keeps today's behaviour: hero A's history is split across both modes, hero B holds the
# same totals in one mode; each reader must answer the same for both.
SPLIT = [  # (day, category, dictation counters, grimoire counters); 2 + 2 draft errors: under 3 per mode, 4 summed
    ("2026-09-01", "agreement:verb", (10, 2, 0, 2, 1), (10, 2, 1, 1, 0)),
    ("2026-09-01", "homophone", (8, 3, 3, 0, 0), (6, 3, 0, 3, 0)),
    ("2026-09-02", "agreement:verb", (5, 1, 1, 0, 0), (12, 5, 4, 1, 0)),
    ("2026-09-02", "accent", (4, 2, 2, 0, 0), (2, 2, 0, 2, 0)),
    ("2026-09-03", "lexical", (0, 0, 0, 0, 0), (3, 2, 1, 1, 1)),
]


def fill(settings, pid, split):
    conn = db(settings)
    for day, cat, dic, gri in SPLIT:
        modes = [("dictation", dic), ("grimoire", gri)] if split else [("dictation", tuple(a + b for a, b in zip(dic, gri)))]
        for mode, vals in modes:
            conn.execute("INSERT INTO profile_stat_day(profile_id, mode, day, category, occurrences, errors_in_draft, caught, missed, "
                         "introduced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", (pid, mode, day, cat, *vals))
            conn.execute("INSERT INTO profile_stat(profile_id, mode, category, occurrences, errors_in_draft, caught, missed, introduced, "
                         "updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'then') ON CONFLICT(profile_id, category, mode) DO UPDATE SET "
                         "occurrences = occurrences + excluded.occurrences, errors_in_draft = errors_in_draft + excluded.errors_in_draft, "
                         "caught = caught + excluded.caught, missed = missed + excluded.missed, introduced = introduced + excluded.introduced",
                         (pid, mode, cat, *vals))
    conn.commit(); conn.close()


@pytest.fixture
def twins(client, settings):
    a, b = make_profile(client), make_profile(client)
    fill(settings, a, split=True); fill(settings, b, split=False)
    return a, b


def test_the_readers_of_the_stats_sum_both_modes(client, settings, twins, monkeypatch):
    a, b = twins
    conn = db(settings)
    for key, lt in LIEUTENANTS.items():
        assert seal_day_rows(conn, a, lt["categories"]) == seal_day_rows(conn, b, lt["categories"])
    assert small_tricks(conn, a) == small_tricks(conn, b) == {"traps": 6, "caught": 3}
    levels = {k: 0 for k in LIEUTENANTS}
    profile = lambda pid: conn.execute("SELECT * FROM profile WHERE id = ?", (pid,)).fetchone()
    available = lieutenants_for_level("10H")
    assert oracle_mod.compute_scrolls(conn, profile(a), available, levels) == \
        oracle_mod.compute_scrolls(conn, profile(b), available, levels)
    conn.close()

    def strip(stats):
        return {"categories": [{k: v for k, v in c.items() if k != "by_mode"} for c in stats["categories"]],
                "caught": stats["totals"]["caught"], "argus_order": stats["argus_order"]}
    sa, sb = (client.get(f"/api/profiles/{p}/stats").json() for p in (a, b))
    assert strip(sa) == strip(sb)
    assert next(c for c in sa["categories"] if c["category"] == "agreement:verb")["errors_in_draft"] == 10

    ca, cb = (client.get(f"/api/profiles/{p}/camp").json() for p in (a, b))
    for key in ("lieutenants", "small_tricks", "boss"):
        assert ca[key] == cb[key]

    # Éris aims at the weak spots from the summed rows (3 draft errors needed: only the sum reaches it).
    seen = []
    real = texts_router.category_weights
    monkeypatch.setattr(texts_router, "category_weights",
                        lambda rows, *args: seen.append(sorted(rows, key=lambda r: r["category"])) or real(rows, *args))
    tid = make_text(client, body=LONG)
    for pid in (a, b):
        r = client.post(f"/api/texts/{tid}/corrupt", json={"profile_id": pid, "seed": 7})
        assert r.status_code == 200, r.text
    assert seen[0] == seen[1] and {"category": "agreement:verb", "errors_in_draft": 10, "caught": 6} in seen[0]


def test_a_seal_is_judged_on_both_modes_as_before(client):
    a, b = make_profile(client), make_profile(client); tid = make_text(client)
    for day, mode in (("2026-09-21", "grimoire"), ("2026-09-22", "dictation")):
        post(client, a, tid, hydre_result(), day=day, mode=mode)
        post(client, b, tid, hydre_result(), day=day)
    pa = post(client, a, tid, hydre_result(), day="2026-09-23", mode="grimoire")["progression"]
    pb = post(client, b, tid, hydre_result(), day="2026-09-23")["progression"]
    assert pa["levels"] == pb["levels"] == [{"lieutenant": "hydre", "level": 1, "reward_id": "trophy:hydre:1"}]
