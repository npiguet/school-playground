"""Re-annotates stored rows whose annotation predates ANNOTATION_VERSION (bounded: dozens of rows at startup)."""
from __future__ import annotations
import json
import sqlite3
from typing import Callable
from app.nlp.annotate import ANNOTATION_VERSION

ANNOTATED_TABLES = ("text", "online_chunk")  # online_chunk exists from Task 5 on


def _table_exists(conn: sqlite3.Connection, name: str) -> bool:
    return conn.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", (name,)).fetchone() is not None


def reannotate_outdated(conn: sqlite3.Connection, annotate_fn: Callable[[str], dict],
                        version: int = ANNOTATION_VERSION) -> int:
    """Recompute annotation_json for every row whose stored version is below `version`; returns the row count."""
    n = 0
    for table in ANNOTATED_TABLES:
        if not _table_exists(conn, table):
            continue
        rows = conn.execute(
            f"SELECT id, body FROM {table} WHERE COALESCE(json_extract(annotation_json, '$.version'), 0) < ?",
            (version,)).fetchall()
        for r in rows:
            conn.execute(f"UPDATE {table} SET annotation_json = ? WHERE id = ?",
                         (json.dumps(annotate_fn(r["body"]), ensure_ascii=False), r["id"]))
            n += 1
    conn.commit()
    return n
