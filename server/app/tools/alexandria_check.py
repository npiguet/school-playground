"""Live check of the Alexandria allowlist against the real Wikisource/Gutenberg
network: fetches every page/ebook, runs cleaning + chunking + filters, and reports
which pages are reachable and how many dictation chunks they yield.

Manual use only — the only place in this codebase allowed to touch the network at
run time outside of production. Never run from pytest.

Usage: scripts/py.sh python -m app.tools.alexandria_check
"""
from __future__ import annotations

import time
from collections import Counter
from pathlib import Path

from app.alexandria.allowlist import Work, load_allowlist
from app.alexandria.chunk import make_chunks
from app.alexandria.clean import gutenberg_text_to_paragraphs, wikisource_html_to_paragraphs
from app.alexandria.fetch import FetchError, HttpFetcher
from app.alexandria.filters import chunk_verdict
from app.lexicon import load_lexicon
from app.textutil import word_count

CONTENT_DIR = Path(__file__).resolve().parents[3] / "content"


def _count(n: int, noun: str) -> str:
    """« 1 failed page », « 3 failed pages »: a real plural, never « page(s) »."""
    return f"{n} {noun}{'' if n == 1 else 's'}"

# Be a polite anonymous client: Wikisource/Gutenberg throttle bursty anonymous
# traffic (observed HTTP 429 with no delay at all). A fixed pause between requests,
# plus a backoff-and-retry on 429/503, keeps a ~250-page run well under the limit.
REQUEST_DELAY_S = 2.0
RETRIES = 4
RETRY_BASE_DELAY_S = 8.0


def _fetch_with_retries(action):
    last_error: FetchError | None = None
    for attempt in range(RETRIES):
        try:
            return action()
        except FetchError as e:
            if not any(code in str(e) for code in ("429", "503")):
                raise
            last_error = e
            time.sleep(RETRY_BASE_DELAY_S * (attempt + 1))
    raise last_error


def _check_one(fetcher: HttpFetcher, lexicon, work: Work, label: str, source_ref) -> tuple[bool, int]:
    """Fetch+process one page (wikisource) or ebook (gutenberg). Returns (ok, accepted_chunks)."""
    try:
        if work.source == "wikisource":
            html = _fetch_with_retries(lambda: fetcher.wikisource_page(source_ref))
            paragraphs = wikisource_html_to_paragraphs(html)
        else:
            txt = _fetch_with_retries(lambda: fetcher.gutenberg_text(source_ref))
            paragraphs = gutenberg_text_to_paragraphs(txt)
    except FetchError as e:
        print(f"FAIL {work.id} {label} {e}")
        return False, 0

    words = sum(word_count(p.text) for p in paragraphs)
    chunks = make_chunks(paragraphs)
    rejected: Counter[str] = Counter()
    accepted = 0
    for chunk in chunks:
        reason = chunk_verdict(chunk, lexicon)
        if reason is None:
            accepted += 1
        else:
            rejected[reason] += 1
    print(f"OK {work.id} {label} words={words} chunks={accepted}/{len(chunks)} rejected={dict(rejected)}")
    return True, accepted


def main() -> None:
    lexicon = load_lexicon(CONTENT_DIR)
    works = load_allowlist(CONTENT_DIR)
    fetcher = HttpFetcher()

    print(f"Checking {len(works)} allowlisted works against the live network...\n")
    summary: list[str] = []
    for work in works:
        pages_ok = 0
        pages_failed = 0
        accepted_total = 0
        if work.source == "wikisource":
            for page in work.pages:
                ok, accepted = _check_one(fetcher, lexicon, work, page, page)
                pages_ok += 1 if ok else 0
                pages_failed += 0 if ok else 1
                accepted_total += accepted
                time.sleep(REQUEST_DELAY_S)
        else:
            ok, accepted = _check_one(fetcher, lexicon, work, f"ebook_id={work.ebook_id}", work.ebook_id)
            pages_ok += 1 if ok else 0
            pages_failed += 0 if ok else 1
            accepted_total += accepted
            time.sleep(REQUEST_DELAY_S)
        line = (f"== {work.id}: {pages_ok} ok / {_count(pages_failed, 'failed page')}, "
                f"{_count(accepted_total, 'accepted chunk')} total ==")
        print(line)
        summary.append(line)

    print("\n--- Summary ---")
    for line in summary:
        print(line)


if __name__ == "__main__":
    main()
