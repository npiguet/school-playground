"""Imports content/seed/*.json into the text table (source='seed'), skipping already-imported keys."""
from __future__ import annotations
import json, sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable
from app.textutil import build_credits


def import_seed(conn: sqlite3.Connection, content_dir: Path, annotate_fn: Callable[[str], dict]) -> int:
    seed_dir = Path(content_dir) / "seed"
    if not seed_dir.is_dir():
        return 0
    existing = {r[0] for r in conn.execute("SELECT seed_key FROM text WHERE seed_key IS NOT NULL")}
    inserted = 0
    for path in sorted(seed_dir.glob("*.json")):
        key = path.stem
        if key in existing:
            continue
        d = json.loads(path.read_text(encoding="utf-8"))
        body = d["body"].strip()
        conn.execute(
            """INSERT INTO text(title, body, source, seed_key, level, author, translator, work, credits,
                               annotation_json, created_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (d["title"], body, "seed", key, d["level"], d.get("author"), d.get("translator"),
             d.get("work"), build_credits(d.get("author"), d.get("work"), d.get("translator")),
             json.dumps(annotate_fn(body), ensure_ascii=False),
             datetime.now(timezone.utc).isoformat()))
        inserted += 1
    conn.commit()
    return inserted
