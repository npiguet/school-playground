"""SQLite access: one connection per request, numbered migrations (SQL, or Python for data) in app/migrations."""
from __future__ import annotations
import importlib.util
import sqlite3
from pathlib import Path
from typing import Callable, Iterator
from fastapi import Request

MIGRATIONS_DIR = Path(__file__).parent / "migrations"
DB_FILENAME = "discorde.sqlite3"
# How long a statement waits for another connection's write lock before "database is locked"
# (Task S). Python's default, 5 s, was reached in an e2e run while the app was starved of CPU: a
# PATCH and a GET /camp failed together with a 500. Waiting is always better than failing here: the
# writers are short, and the players are one family.
BUSY_TIMEOUT_S = 30


def connect(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    # Transaction control pinned explicitly (fix round 5): the code base commits by hand and relies
    # on the legacy implicit BEGIN (DEFERRED) before a write; `begin_write` (below) then takes the
    # write lock early with its own BEGIN IMMEDIATE when `in_transaction` is False.
    # A different default (autocommit=False opens a transaction on connect and after every commit,
    # autocommit=True never does) would silently turn that BEGIN IMMEDIATE into a no-op.
    conn = sqlite3.connect(path, timeout=BUSY_TIMEOUT_S, check_same_thread=False, isolation_level="DEFERRED",
                           autocommit=sqlite3.LEGACY_TRANSACTION_CONTROL)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def begin_write(conn: sqlite3.Connection) -> None:
    """Take SQLite's write lock now, so the reads that follow and the writes they decide cannot be
    interleaved with another request's writes (the default deferred transaction only locks at the
    first write, after the reads). Joins a transaction already open on this connection instead.
    Used by the Alexandria refresh, by one accessory per slot (world.py's PATCH /rewards), and by Hermès's stall, so two purchases cannot overdraw the purse (POST /purchases)."""
    if not conn.in_transaction:
        conn.execute("BEGIN IMMEDIATE")


def _migrations() -> list[tuple[int, Path]]:
    """The numbered migrations, in order: `NNN_name.sql`, or `NNN_name.py` for a data migration that
    needs Python (migration 008 computes Swiss days); one file per number."""
    files = [p for p in MIGRATIONS_DIR.iterdir() if p.suffix in (".sql", ".py") and p.name[:1].isdigit()]
    numbered = sorted((int(p.name.split("_", 1)[0]), p) for p in files)
    for (v1, p1), (v2, p2) in zip(numbered, numbered[1:]):
        if v1 == v2:   # the second would be skipped silently, as already applied
            raise RuntimeError(f"Two migrations share the number {v1:03d}: {p1.name} and {p2.name}")
    return numbered


def _load_python_migration(path: Path) -> Callable[[sqlite3.Connection], None]:
    """A Python migration's `up(conn)`. It runs inside the migration's transaction, so it uses
    conn.execute only: no executescript (it commits first), no commit, no BEGIN, no PRAGMA."""
    spec = importlib.util.spec_from_file_location(f"app_migration_{path.stem}", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.up


def migrate(conn: sqlite3.Connection, upto: int | None = None) -> int:
    """Runs the migrations not applied yet, up to `upto` included when given (tests build older schemas).
    Each migration opens and commits its own transaction, so the connection must have none open: a
    caller's pending writes would be committed with (or rolled back by) a migration. At start-up there
    is none (connect() runs only PRAGMAs); any other caller gets a RuntimeError instead."""
    if conn.in_transaction:
        raise RuntimeError("migrate() needs a connection without an open transaction: commit or roll back first")
    conn.execute("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)")
    current = conn.execute("SELECT COALESCE(MAX(version), 0) FROM schema_version").fetchone()[0]
    for version, path in _migrations():
        if version <= current:
            continue
        if upto is not None and version > upto:
            break
        # One transaction per migration, its version row included: a migration that fails (or a process
        # killed in the middle) leaves the database as it was before it, and the next start runs it
        # again. executescript() alone commits statement by statement. No migration may hold its own
        # BEGIN/COMMIT or a PRAGMA that cannot run in a transaction.
        try:
            if path.suffix == ".sql":
                conn.executescript(f"BEGIN;\n{path.read_text(encoding='utf-8')}\n"
                                   f"INSERT INTO schema_version(version, applied_at) VALUES ({version}, datetime('now'));\nCOMMIT;")
            else:
                up = _load_python_migration(path)
                conn.execute("BEGIN")   # none is open: checked on entry, and each migration commits its own
                up(conn)
                conn.execute("INSERT INTO schema_version(version, applied_at) VALUES (?, datetime('now'))", (version,))
                conn.commit()
        except BaseException:
            if conn.in_transaction:
                conn.rollback()
            raise
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
