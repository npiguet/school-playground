"""Pure text helpers shared by validation and seed import."""
from __future__ import annotations
import re

WORD_RE = re.compile(r"[^\W\d_]+(?:['’-][^\W\d_]+)*")


def words(body: str) -> list[str]:
    return [m.group(0).lower() for m in WORD_RE.finditer(body)]


def word_count(body: str) -> int:
    return len(WORD_RE.findall(body))


def has_digits(body: str) -> bool:
    return any(ch.isdigit() for ch in body)


def build_credits(author: str | None, work: str | None, translator: str | None) -> str:
    parts = [p for p in [author, work] if p]
    s = ", ".join(parts)
    if translator:
        s += f", trad. {translator}"
    return s
