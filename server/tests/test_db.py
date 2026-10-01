import sqlite3
from app.db import MIGRATIONS_DIR, connect, migrate


def table_names(conn):
    return {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}


def test_migrate_creates_schema(tmp_path):
    conn = connect(tmp_path / "t.sqlite3")
    version = migrate(conn)
    assert version >= 1
    assert {"profile", "text", "session", "profile_stat", "profile_stat_day", "trap_word", "schema_version"} <= table_names(conn)
    assert conn.execute("PRAGMA foreign_keys").fetchone()[0] == 1
    assert conn.execute("PRAGMA journal_mode").fetchone()[0] == "wal"


def test_migrate_is_idempotent(tmp_path):
    conn = connect(tmp_path / "t.sqlite3")
    v1 = migrate(conn)
    v2 = migrate(conn)
    assert v1 == v2
    assert conn.execute("SELECT COUNT(*) FROM schema_version").fetchone()[0] == v1


def test_profile_delete_cascades(tmp_path):
    conn = connect(tmp_path / "t.sqlite3")
    migrate(conn)
    conn.execute("INSERT INTO profile(id, name, avatar, level, created_at) VALUES (1, 'A', 'chouette', '8H', 'now')")
    conn.execute("INSERT INTO trap_word(profile_id, word, box, last_seen, misses) VALUES (1, 'maison', 1, 'now', 1)")
    conn.execute("DELETE FROM profile WHERE id = 1")
    assert conn.execute("SELECT COUNT(*) FROM trap_word").fetchone()[0] == 0


def test_migration_004_creates_world_tables(tmp_path):
    conn = connect(tmp_path / "x.sqlite3")
    assert migrate(conn) >= 4
    assert {"quest", "oracle", "dragon", "reward", "xp_event", "mastery"} <= table_names(conn)
    cols = {r[1] for r in conn.execute("PRAGMA table_info(session)")}
    assert {"encounter", "quest_id"} <= cols


def test_connect_pins_legacy_transaction_control_so_begin_immediate_takes_the_write_lock(tmp_path):
    # Fix round 5: the code base commits by hand on the legacy implicit-BEGIN model, and
    # app.db.begin_write issues BEGIN IMMEDIATE only while no transaction is open.
    # Pinned in connect() so a changed sqlite3 default cannot silently turn that into a no-op.
    from app.db import begin_write
    path = tmp_path / "tx.sqlite3"
    conn = connect(path)
    migrate(conn)
    assert conn.autocommit == sqlite3.LEGACY_TRANSACTION_CONTROL
    assert conn.isolation_level == "DEFERRED"
    assert not conn.in_transaction  # nothing open between requests' statements
    begin_write(conn)
    assert conn.in_transaction
    other = sqlite3.connect(path, timeout=0)
    try:
        other.execute("BEGIN IMMEDIATE")
        raise AssertionError("a second writer got the lock begin_write should hold")
    except sqlite3.OperationalError as e:
        assert "locked" in str(e)
    finally:
        other.close()
    conn.rollback()
    assert not conn.in_transaction


def test_a_write_waits_out_a_lock_held_longer_than_sqlites_default(tmp_path):
    # Task S (seen in an e2e run: PATCH /profiles and GET /camp both 500 "database is locked" at
    # once, while the app was starved of CPU): Python's default 5 s busy timeout turned a slow
    # writer into a player-visible error. A write now waits up to BUSY_TIMEOUT_S for the lock.
    import threading, time
    from app.db import BUSY_TIMEOUT_S
    assert BUSY_TIMEOUT_S >= 30
    path = tmp_path / "t.sqlite3"
    first = connect(path)
    migrate(first)
    first.execute("INSERT INTO profile(id, name, avatar, level, created_at) VALUES (1, 'A', 'chouette', '8H', 'now')")
    first.commit()
    second = connect(path)
    assert second.execute("PRAGMA busy_timeout").fetchone()[0] == BUSY_TIMEOUT_S * 1000
    first.execute("BEGIN IMMEDIATE")
    first.execute("UPDATE profile SET level = '9H' WHERE id = 1")
    release = threading.Timer(5.5, first.commit)
    release.start()
    started = time.monotonic()
    second.execute("UPDATE profile SET name = 'B' WHERE id = 1")
    second.commit()
    assert time.monotonic() - started >= 5.0
    release.join()
    assert tuple(second.execute("SELECT name, level FROM profile WHERE id = 1").fetchone()) == ("B", "9H")


def _db_before(path, version):
    """A database as the game left it before migration `version`: the earlier migrations only."""
    conn = connect(path)
    conn.execute("CREATE TABLE schema_version (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)")
    for f in sorted(MIGRATIONS_DIR.glob("*.sql")):
        v = int(f.name.split("_", 1)[0])
        if v >= version:
            break
        conn.executescript(f.read_text(encoding="utf-8"))
        conn.execute("INSERT INTO schema_version(version, applied_at) VALUES (?, 'then')", (v,))
    conn.commit()
    return conn


def _pre_005_db(path):
    """A database as the game left it before sub-project 1: migrations 001-004 only."""
    return _db_before(path, 5)


def test_migration_005_upgrades_a_pre_005_database_in_place(tmp_path):
    conn = _pre_005_db(tmp_path / "old.sqlite3")
    conn.execute("INSERT INTO profile(id, name, avatar, level, help_stage, created_at) VALUES (1, 'Io', 'chouette', '8H', 3, 'now')")
    conn.execute("INSERT INTO text(id, title, body, source, level, created_at) VALUES (1, 'T', 'Un texte.', 'custom', '8H', 'now')")
    conn.execute("INSERT INTO session(profile_id, text_id, pace_level, help_stage, started_at, finished_at, draft, final, "
                 "result_json, score, catch_rate) VALUES (1, 1, 2, 3, 'a', 'b', 'x', 'y', '{}', 40, 0.5)")
    conn.execute("INSERT INTO profile_stat(profile_id, category, occurrences, errors_in_draft, caught, missed, updated_at) "
                 "VALUES (1, 'homophone', 5, 2, 1, 1, 'now')")
    conn.execute("INSERT INTO profile_stat_day(profile_id, day, category, occurrences) VALUES (1, '2026-09-01', 'homophone', 5)")
    conn.commit()
    assert migrate(conn) >= 5
    s = conn.execute("SELECT help_stage, score, aids FROM session").fetchone()
    assert (s["help_stage"], s["score"], s["aids"]) == (3, 40, None)
    assert conn.execute("SELECT help_stage FROM profile").fetchone()[0] == 3        # the column stays
    assert conn.execute("SELECT introduced FROM profile_stat").fetchone()[0] == 0
    assert conn.execute("SELECT introduced FROM profile_stat_day").fetchone()[0] == 0


# Spec 2026-09-29 lieutenant levels §3 (review focus 5).
def test_migration_006_turns_each_neutralised_lieutenant_into_its_wooden_seal(tmp_path):
    conn = _db_before(tmp_path / "old.sqlite3", 6)
    for pid, name in ((1, "Io"), (2, "Ada")):
        conn.execute("INSERT INTO profile(id, name, avatar, level, help_stage, created_at) VALUES (?, ?, 'chouette', '8H', 0, 'now')",
                     (pid, name))
    conn.executemany("INSERT INTO mastery(profile_id, lieutenant, neutralised_at) VALUES (?, ?, ?)",
                     [(1, "hydre", "2026-09-10T08:00:00+00:00"), (1, "echo", "2026-09-12T18:30:00+00:00")])
    conn.executemany("INSERT INTO reward(profile_id, reward_id, source, granted_at, equipped) VALUES (?, ?, ?, ?, ?)",
                     [(1, "ecaille_hydre", "mastery:hydre", "2026-09-10T08:00:01+00:00", 1),
                      (1, "sandales_hermes", "quest:4", "2026-09-15T10:00:00+00:00", 1),
                      (2, "plume_sirene", "mastery:sirenes", "2026-09-11T10:00:00+00:00", 0)])   # no mastery row (by hand)
    conn.executemany("INSERT INTO xp_event(profile_id, amount, reason, created_at) VALUES (?, ?, ?, ?)",
                     [(1, 200, "mastery", "2026-09-10T08:00:00+00:00"), (1, 54, "session", "2026-09-10T08:00:00+00:00")])
    conn.commit()
    assert migrate(conn) >= 6
    assert [tuple(r) for r in conn.execute(
        "SELECT profile_id, lieutenant, level, reached_at FROM lieutenant_level ORDER BY profile_id, lieutenant")] == [
        (1, "echo", 1, "2026-09-12T18:30:00+00:00"), (1, "hydre", 1, "2026-09-10T08:00:00+00:00")]
    assert [tuple(r) for r in conn.execute(
        "SELECT profile_id, reward_id, source, granted_at, equipped FROM reward ORDER BY profile_id, reward_id")] == [
        (1, "sandales_hermes", "quest:4", "2026-09-15T10:00:00+00:00", 1),
        (1, "trophy:echo:1", "level:echo:1", "2026-09-12T18:30:00+00:00", 0),       # its relic row was missing
        (1, "trophy:hydre:1", "level:hydre:1", "2026-09-10T08:00:01+00:00", 1)]
    assert conn.execute("SELECT COUNT(*) FROM mastery").fetchone()[0] == 2           # kept, no longer written
    assert conn.execute("SELECT SUM(amount) FROM xp_event WHERE profile_id = 1").fetchone()[0] == 254
    assert migrate(conn) >= 6                                                        # idempotent
    assert conn.execute("SELECT COUNT(*) FROM lieutenant_level").fetchone()[0] == 2
