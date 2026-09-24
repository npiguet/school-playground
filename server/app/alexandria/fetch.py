"""Fetching pages from Wikisource FR or Project Gutenberg — pluggable so tests never
hit the network (Decision 10): OfflineFetcher reads committed fixtures instead.
"""
from __future__ import annotations

import re
import unicodedata
from pathlib import Path
from typing import Protocol

import httpx

WIKISOURCE_API = "https://fr.wikisource.org/w/api.php"
GUTENBERG_URLS = (
    "https://www.gutenberg.org/cache/epub/{id}/pg{id}.txt",
    "https://www.gutenberg.org/cache/epub/{id}/pg{id}-0.txt",
)
USER_AGENT = "LaDiscorde/0.2 (educational dictation game for a family LAN; no contact form) python-httpx"


class FetchError(Exception):
    """A page or ebook could not be fetched, offline or online."""


def page_slug(title: str) -> str:
    decomposed = unicodedata.normalize("NFKD", title)
    without_accents = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9]+", "-", without_accents.lower()).strip("-")


class Fetcher(Protocol):
    def wikisource_page(self, title: str) -> str: ...
    def gutenberg_text(self, ebook_id: int) -> str: ...


class HttpFetcher:
    def __init__(self, client: httpx.Client | None = None, timeout: float = 20.0) -> None:
        # Every request carries `timeout` (connect + read) so a stalled source can never hang a
        # refresh for longer than that per page; Gutenberg answers some ebook URLs with a 302.
        self.client = client or httpx.Client(follow_redirects=True)
        self.timeout = timeout

    def wikisource_page(self, title: str) -> str:
        try:
            resp = self.client.get(
                WIKISOURCE_API,
                params={"action": "parse", "format": "json", "formatversion": 2,
                        "prop": "text", "disabletoc": 1, "page": title},
                headers={"User-Agent": USER_AGENT}, timeout=self.timeout,
            )
        except httpx.HTTPError as e:
            raise FetchError(str(e)) from e
        if resp.status_code != 200:
            raise FetchError(f"HTTP {resp.status_code} pour la page « {title} »")
        try:
            data = resp.json()
        except ValueError as e:
            raise FetchError(f"réponse invalide de Wikisource: {e}") from e
        if "error" in data:
            raise FetchError(str(data["error"]))
        text = data.get("parse", {}).get("text")
        if text is None:
            raise FetchError(f"page « {title} » introuvable sur Wikisource")
        return text

    def gutenberg_text(self, ebook_id: int) -> str:
        last_error: str | None = None
        for template in GUTENBERG_URLS:
            url = template.format(id=ebook_id)
            try:
                resp = self.client.get(url, headers={"User-Agent": USER_AGENT}, timeout=self.timeout)
            except httpx.HTTPError as e:
                last_error = str(e)
                continue
            if resp.status_code == 200:
                return resp.content.decode("utf-8", errors="replace")
            last_error = f"HTTP {resp.status_code}"
        raise FetchError(f"ebook Gutenberg {ebook_id} introuvable ({last_error})")


class OfflineFetcher:
    """Reads committed fixtures instead of the network. Used by tests and, in
    production, when DISCORDE_ALEXANDRIA_OFFLINE_DIR is set (Decision 10)."""

    def __init__(self, root: Path) -> None:
        self.root = root

    def wikisource_page(self, title: str) -> str:
        path = self.root / "wikisource" / f"{page_slug(title)}.html"
        if not path.is_file():
            raise FetchError(f"fichier introuvable: {path}")
        return path.read_text(encoding="utf-8")

    def gutenberg_text(self, ebook_id: int) -> str:
        path = self.root / "gutenberg" / f"pg{ebook_id}.txt"
        if not path.is_file():
            raise FetchError(f"fichier introuvable: {path}")
        return path.read_text(encoding="utf-8")


def make_fetcher(settings) -> Fetcher:
    if settings.alexandria_offline_dir:
        return OfflineFetcher(settings.alexandria_offline_dir)
    return HttpFetcher()
