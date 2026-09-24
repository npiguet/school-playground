"""The allowlist of public-domain works the Bibliothèque d'Alexandrie may fetch.

Public domain (spec §3.2, Swiss law: life + 70 years): author AND translator (when
there is one) must have died before PD_YEAR. An entry with an unknown death year is
rejected, never assumed public domain.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from app.levels import LEVELS

logger = logging.getLogger(__name__)

PD_YEAR = 1956
SOURCES = {"wikisource", "gutenberg"}


@dataclass(frozen=True)
class Work:
    id: str
    title: str
    author: str
    author_death: int
    translator: str | None
    translator_death: int | None
    source: str
    pages: tuple[str, ...]
    ebook_id: int | None
    level_hint: str
    note: str


@lru_cache(maxsize=4)
def load_allowlist(content_dir: Path) -> list[Work]:
    path = content_dir / "alexandria" / "works.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    works: list[Work] = []
    for entry in data.get("works", []):
        wid = entry.get("id")
        author_death = entry.get("author_death")
        translator = entry.get("translator")
        translator_death = entry.get("translator_death")
        source = entry.get("source")
        level_hint = entry.get("level_hint")
        if author_death is None or author_death >= PD_YEAR:
            logger.warning("alexandria: skipping %s (unknown or non-public-domain author death year)", wid)
            continue
        if translator and (translator_death is None or translator_death >= PD_YEAR):
            logger.warning("alexandria: skipping %s (unknown or non-public-domain translator death year)", wid)
            continue
        if source not in SOURCES:
            logger.warning("alexandria: skipping %s (unknown source %r)", wid, source)
            continue
        if level_hint not in LEVELS:
            logger.warning("alexandria: skipping %s (unknown level_hint %r)", wid, level_hint)
            continue
        works.append(Work(
            id=wid, title=entry.get("title"), author=entry.get("author"),
            author_death=author_death, translator=translator, translator_death=translator_death,
            source=source, pages=tuple(entry.get("pages", [])), ebook_id=entry.get("ebook_id"),
            level_hint=level_hint, note=entry.get("note", ""),
        ))
    return works


def credits_of(work: Work) -> str:
    from app.textutil import build_credits
    return build_credits(work.author, work.title, work.translator)
