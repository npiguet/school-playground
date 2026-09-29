"""Fetch-refresh-cache-adopt pipeline for a single allowlisted work, backed by the
online_work / online_chunk cache tables (migration 003).
"""
from __future__ import annotations

import json
import sqlite3
import time
from collections import Counter
from datetime import datetime, timezone
from typing import Callable

from app.alexandria.allowlist import Work, credits_of
from app.alexandria.chunk import make_chunks
from app.alexandria.clean import gutenberg_text_to_paragraphs, wikisource_html_to_paragraphs
from app.alexandria.fetch import FetchError
from app.alexandria.filters import chunk_verdict
from app.alexandria.score import chunk_features, level_for, score_for
from app.db import begin_write
from app.routers.texts import TEXT_SELECT


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _upsert_online_work(conn: sqlite3.Connection, work_id: str, status: str, error: str | None, stats: dict) -> None:
    conn.execute(
        """INSERT INTO online_work(id, status, error, fetched_at, stats_json) VALUES (?,?,?,?,?)
           ON CONFLICT(id) DO UPDATE SET status = excluded.status, error = excluded.error,
               fetched_at = excluded.fetched_at, stats_json = excluded.stats_json""",
        (work_id, status, error, now(), json.dumps(stats, ensure_ascii=False)))


# Accepted chunks annotated and cached per refresh (final review I-6): bounds the synchronous
# spaCy work and the cache size whatever the length of the work (a Gutenberg novel is ~1,500 chunks).
MAX_CHUNKS = 40

# Total wall-clock budget for a work's page fetches (fix round 6). `HttpFetcher` already bounds a
# single page to 20 s, but the Wikisource loop below can run 40+ pages: with no total deadline, a
# source that answers slowly (never erroring, just slow) could hold a refresh up to ~800 s - well
# past the client's 120 s REFRESH_TIMEOUT_MS. Ending noticeably below that leaves room for spaCy and
# the response itself.
FETCH_BUDGET_S = 90.0

# Total wall-clock budget for the whole refresh, fetches and spaCy together: no chunk starts being
# annotated past it. The transformer parser takes a second or more per chunk on a small CPU, so 40
# chunks after a slow fetch would outlast the client's 120 s REFRESH_TIMEOUT_MS; the chunks already
# annotated are kept and the note counts them.
REFRESH_BUDGET_S = 105.0


def refresh_work(conn: sqlite3.Connection, work: Work, fetcher, annotate_fn, lexicon, max_pages: int = 40,
                 max_chunks: int = MAX_CHUNKS, fetch_budget_s: float = FETCH_BUDGET_S,
                 refresh_budget_s: float = REFRESH_BUDGET_S,
                 clock: Callable[[], float] = time.monotonic) -> dict:
    started = clock()
    pages_ok = 0
    failed = 0
    last_error: str | None = None
    stopped_early = False
    paragraphs = []

    if work.source == "wikisource":
        deadline = clock() + fetch_budget_s
        for title in work.pages[:max_pages]:
            if clock() >= deadline:
                # The pages already read are kept; the rest are simply never attempted (not an
                # error to report per page - one note for the whole refresh, below).
                stopped_early = True
                break
            try:
                html = fetcher.wikisource_page(title)
                paragraphs.extend(wikisource_html_to_paragraphs(html))
                pages_ok += 1
            except FetchError as e:
                failed += 1
                last_error = str(e)
    else:  # gutenberg: a single fetch, already bounded by the fetcher's own per-request timeout
        try:
            txt = fetcher.gutenberg_text(work.ebook_id)
            paragraphs.extend(gutenberg_text_to_paragraphs(txt))
            pages_ok += 1
        except FetchError as e:
            failed += 1
            last_error = str(e)

    if pages_ok == 0:
        if stopped_early:
            error = "La Bibliothèque d'Alexandrie est inaccessible pour le moment (délai dépassé)"
        else:
            error = f"La Bibliothèque d'Alexandrie est inaccessible pour le moment ({last_error})"
        _upsert_online_work(conn, work.id, "error", error, {"pages_ok": 0, "failed": failed})
        conn.commit()
        return {"status": "error", "error": error, "chunk_count": 0, "rejected": {}}

    chunks = make_chunks(paragraphs)
    rejected: Counter[str] = Counter()
    kept: list[tuple[str, int, str, float, dict, dict]] = []
    truncated = 0  # clean chunks beyond the cap: cheap to count, only the kept ones are annotated
    for chunk in chunks:
        reason = chunk_verdict(chunk, lexicon)
        if reason is not None:
            rejected[reason] += 1
            continue
        if len(kept) >= max_chunks or clock() - started >= refresh_budget_s:
            truncated += 1
            continue
        annotation = annotate_fn(chunk["body"])
        features = chunk_features(chunk["body"], annotation, lexicon)
        level = level_for(features, work.level_hint)
        score = score_for(features)
        kept.append((chunk["body"], chunk["word_count"], level, score, features, annotation))

    notes = []
    if failed:
        # Player-visible (the work's note): a real plural, never « page(s) » (playability #10).
        notes.append("Les scribes n'ont pas pu lire une page." if failed == 1
                     else f"Les scribes n'ont pas pu lire {failed} pages.")
    if stopped_early:
        notes.append("Le jour a baissé et les scribes ont posé leurs calames\u202f: la suite de l'œuvre attend d'être recopiée.")
    if truncated:
        scrolls = "un rouleau" if len(kept) == 1 else f"{len(kept)} rouleaux"
        notes.append(f"Les scribes se sont arrêtés après {scrolls}\u202f: la suite de l'œuvre n'a pas été recopiée.")
    note = " ".join(notes) or None
    stats = {"pages_ok": pages_ok, "failed": failed, "rejected": dict(rejected), "truncated": truncated,
             "stopped_early": stopped_early}
    # A scroll adopted into the library keeps its link across a refresh (matched by body), so
    # « Demander une nouvelle copie » never offers the same passage a second time. The links are read under
    # the write lock (fix round 4): read outside it, an adopt (or a text deletion) committed by
    # another request between this snapshot and the rewrite below was silently undone (the link
    # reset to NULL, the passage offered again) or wrote back a deleted text's id (foreign key
    # failure, a 500 on refresh).
    begin_write(conn)
    linked = {r["body"]: r["text_id"] for r in conn.execute(
        "SELECT body, text_id FROM online_chunk WHERE work_id = ? AND text_id IS NOT NULL", (work.id,))}
    # online_chunk.work_id is a foreign key: the online_work row must exist first.
    _upsert_online_work(conn, work.id, "ok", note, stats)
    # Upsert by (work_id, seq) rather than delete-then-insert (fix round 3): re-fetching a static
    # external source reliably reproduces the same seq order, so a plain delete+insert only ever
    # churned every chunk's autoincrement id for no reason - and under a concurrent refresh of the
    # same work (two players, or two clients, refreshing "Vingt mille lieues" at once, a real
    # scenario), it silently invalidated a chunk_id another in-flight request already had in hand:
    # its adopt() would 404 ("Rouleau inconnu") a moment later. Upserting in place keeps a seq's id
    # stable across a refresh, so a concurrent adopt() of that same chunk still resolves.
    conn.execute("DELETE FROM online_chunk WHERE work_id = ? AND seq > ?", (work.id, len(kept)))
    for seq, (body, word_count, level, score, features, annotation) in enumerate(kept, start=1):
        conn.execute(
            """INSERT INTO online_chunk(work_id, seq, body, word_count, level, score, features_json, annotation_json, text_id)
               VALUES (?,?,?,?,?,?,?,?,?)
               ON CONFLICT(work_id, seq) DO UPDATE SET
                 body = excluded.body, word_count = excluded.word_count, level = excluded.level,
                 score = excluded.score, features_json = excluded.features_json,
                 annotation_json = excluded.annotation_json, text_id = excluded.text_id""",
            (work.id, seq, body, word_count, level, score,
             json.dumps(features, ensure_ascii=False), json.dumps(annotation, ensure_ascii=False), linked.get(body)))
    conn.commit()
    return {"status": "ok", "error": note, "chunk_count": len(kept), "rejected": dict(rejected)}


def list_works(conn: sqlite3.Connection, works: list[Work]) -> list[dict]:
    result = []
    for work in works:
        row = conn.execute("SELECT * FROM online_work WHERE id = ?", (work.id,)).fetchone()
        count = conn.execute("SELECT COUNT(*) FROM online_chunk WHERE work_id = ?", (work.id,)).fetchone()[0]
        result.append({
            "id": work.id, "title": work.title, "author": work.author, "translator": work.translator,
            "credits": credits_of(work), "level_hint": work.level_hint, "source": work.source,
            "status": row["status"] if row else "never",
            "fetched_at": row["fetched_at"] if row else None,
            "error": row["error"] if row else None,
            "chunk_count": count,
        })
    return result


def _preview(body: str, limit: int = 140) -> str:
    if len(body) <= limit:
        return body
    cut = body[:limit]
    idx = cut.rfind(" ")
    cut = cut[:idx] if idx > 0 else cut[:limit - 1]
    return cut.rstrip() + "…"


def list_chunks(conn: sqlite3.Connection, work_id: str, level: str | None = None) -> list[dict]:
    query = "SELECT id, seq, level, word_count, score, body, text_id FROM online_chunk WHERE work_id = ?"
    params: list = [work_id]
    if level:
        query += " AND level = ?"
        params.append(level)
    query += " ORDER BY score DESC, seq"
    rows = conn.execute(query, params).fetchall()
    return [{
        "id": r["id"], "seq": r["seq"], "level": r["level"], "word_count": r["word_count"],
        "score": r["score"], "preview": _preview(r["body"]), "text_id": r["text_id"],
    } for r in rows]


def adopt_chunk(conn: sqlite3.Connection, chunk_id: int, profile_id: int, works: list[Work],
                 title: str | None = None) -> tuple[sqlite3.Row | None, bool]:
    # Check-then-create under the write lock (fix round 4): two players adopting the same scroll at
    # once used to both read text_id NULL, both create a text and both get 201 - the passage adopted
    # twice, one copy unlinked from its scroll. Now exactly one creates it; the other gets it back.
    begin_write(conn)
    chunk = conn.execute("SELECT * FROM online_chunk WHERE id = ?", (chunk_id,)).fetchone()
    if chunk is None:
        conn.rollback()
        return None, False

    if chunk["text_id"] is not None:
        existing = conn.execute(f"{TEXT_SELECT} WHERE t.id = ?", (chunk["text_id"],)).fetchone()
        if existing is not None:
            conn.rollback()
            return existing, False

    work = next((w for w in works if w.id == chunk["work_id"]), None)
    if work is None:
        conn.rollback()
        return None, False

    final_title = (title or "").strip() or f"{work.title} — rouleau {chunk['seq']}"
    cur = conn.execute(
        """INSERT INTO text(title, body, source, level, author, translator, work, credits,
                           added_by_profile_id, annotation_json, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
        (final_title, chunk["body"], "online", chunk["level"], work.author, work.translator, work.title,
         credits_of(work), profile_id, chunk["annotation_json"], now()))
    conn.execute("UPDATE online_chunk SET text_id = ? WHERE id = ?", (cur.lastrowid, chunk_id))
    conn.commit()
    text_row = conn.execute(f"{TEXT_SELECT} WHERE t.id = ?", (cur.lastrowid,)).fetchone()
    return text_row, True
