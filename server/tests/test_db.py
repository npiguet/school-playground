import sqlite3
from app.db import connect, migrate


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
    # alexandria.service._begin_write issues BEGIN IMMEDIATE only while no transaction is open.
    # Pinned in connect() so a changed sqlite3 default cannot silently turn that into a no-op.
    from app.alexandria.service import _begin_write
    path = tmp_path / "tx.sqlite3"
    conn = connect(path)
    migrate(conn)
    assert conn.autocommit == sqlite3.LEGACY_TRANSACTION_CONTROL
    assert conn.isolation_level == "DEFERRED"
    assert not conn.in_transaction  # nothing open between requests' statements
    _begin_write(conn)
    assert conn.in_transaction
    other = sqlite3.connect(path, timeout=0)
    try:
        other.execute("BEGIN IMMEDIATE")
        raise AssertionError("a second writer got the lock _begin_write should hold")
    except sqlite3.OperationalError as e:
        assert "locked" in str(e)
    finally:
        other.close()
    conn.rollback()
    assert not conn.in_transaction
