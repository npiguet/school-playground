"""Imports content/seed/*.json into the text table (source='seed'), skipping already-imported keys."""
from __future__ import annotations
import json, sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable
from app.lexicon import Lexicon
from app.nlp.tenses import detect_tenses, level_with_tenses
from app.relevel import tenses_json
from app.textutil import build_credits


def import_seed(conn: sqlite3.Connection, content_dir: Path, annotate_fn: Callable[[str], dict],
                lexicon: Lexicon | None = None) -> int:
    """The file's level is the text's own level (base_level); with a lexicon, the stored level is
    raised to its verb tenses' class here, else by app.relevel at the next start-up."""
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
        annotation = annotate_fn(body)
        counts = detect_tenses(annotation, lexicon) if lexicon is not None else {}
        conn.execute(
            """INSERT INTO text(title, body, source, seed_key, level, base_level, tenses_json, author, translator,
                               work, credits, annotation_json, created_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (d["title"], body, "seed", key, level_with_tenses(d["level"], counts), d["level"], tenses_json(counts),
             d.get("author"), d.get("translator"), d.get("work"),
             build_credits(d.get("author"), d.get("work"), d.get("translator")),
             json.dumps(annotation, ensure_ascii=False),
             datetime.now(timezone.utc).isoformat()))
        inserted += 1
    conn.commit()
    return inserted
