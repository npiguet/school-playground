"""SQLite access: one connection per request, numbered SQL migrations in app/migrations."""
from __future__ import annotations
import sqlite3
from pathlib import Path
from typing import Iterator
from fastapi import Request

MIGRATIONS_DIR = Path(__file__).parent / "migrations"
DB_FILENAME = "discorde.sqlite3"


def connect(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def migrate(conn: sqlite3.Connection) -> int:
    conn.execute("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)")
    current = conn.execute("SELECT COALESCE(MAX(version), 0) FROM schema_version").fetchone()[0]
    for path in sorted(MIGRATIONS_DIR.glob("*.sql")):
        version = int(path.name.split("_", 1)[0])
        if version <= current:
            continue
        conn.executescript(path.read_text(encoding="utf-8"))
        conn.execute("INSERT INTO schema_version(version, applied_at) VALUES (?, datetime('now'))", (version,))
        conn.commit()
        current = version
    return current


def db_path(request: Request) -> Path:
    return request.app.state.settings.data_dir / DB_FILENAME


def get_db(request: Request) -> Iterator[sqlite3.Connection]:
    # The commit() after yield is a safety net, not the primary commit point: FastAPI
    # runs the code after `yield` while tearing down the dependency's AsyncExitStack,
    # which is not guaranteed to finish before the response reaches the client (our
    # endpoints are sync `def`s dispatched to a worker thread, so the ordering between
    # "response sent" and "generator resumed" is not fixed). A write followed
    # immediately by a read (e.g. in a test, or two quick requests from the client) can
    # therefore see the pre-write state if the endpoint relies on this implicit commit.
    # Every endpoint that writes (INSERT/UPDATE/DELETE) must call conn.commit() itself
    # before returning.
    conn = connect(db_path(request))
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()
