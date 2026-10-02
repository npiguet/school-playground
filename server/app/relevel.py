"""Applies the verb-tense rule (app.nlp.tenses) to every stored text and Alexandria scroll at start-up.

Each row's tenses are read again from its stored annotation (no spaCy, no network: dozens of rows,
a lexicon lookup per word), so a better reading or a changed rule reaches the texts already in the
library. The level is recomputed from the row's own level (`base_level`, migration 009): raised to
its hardest tense's class, never below its own level, so a level chosen by hand above the rule stays.
"""
from __future__ import annotations

import json
import sqlite3

from app.lexicon import Lexicon
from app.nlp.tenses import detect_tenses, level_with_tenses

LEVELLED_TABLES = ("text", "online_chunk")


def tenses_json(counts: dict[str, int]) -> str:
    return json.dumps(counts, ensure_ascii=False, sort_keys=True)


def relevel_texts(conn: sqlite3.Connection, lexicon: Lexicon) -> int:
    """Re-read every row's tenses and level; returns the number of rows whose level changed."""
    changed = 0
    for table in LEVELLED_TABLES:
        rows = conn.execute(
            f"SELECT id, level, base_level, tenses_json, annotation_json FROM {table}").fetchall()
        for r in rows:
            base = r["base_level"] or r["level"]
            counts = detect_tenses(json.loads(r["annotation_json"] or "{}"), lexicon)
            stored = tenses_json(counts)
            level = level_with_tenses(base, counts)
            if (level, base, stored) != (r["level"], r["base_level"], r["tenses_json"]):
                conn.execute(f"UPDATE {table} SET level = ?, base_level = ?, tenses_json = ? WHERE id = ?",
                             (level, base, stored, r["id"]))
                changed += level != r["level"]
    conn.commit()
    return changed
