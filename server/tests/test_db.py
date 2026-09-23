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
