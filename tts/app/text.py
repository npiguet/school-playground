"""What the voice is given to say (spec 2026-09-27 §4.1): the line as the game sent it, spaced plainly,
with the pronunciation fixes of respell.json applied, cut into segments the model reads well."""
from __future__ import annotations

import json
import re
from pathlib import Path

MAX_CHARS = 10_000   # one line (Kokoro plan Ruling K1; web/src/lib/dictation/script.ts MAX_LINE_CHARS)
MIN_SPEED, MAX_SPEED = 0.5, 1.5
SEGMENT_CHARS = 300  # a line up to this length is one synthesis, as in the bake-off

_SPACES = re.compile(r"[\s  ]+")
# A segment may end after a full stop, never between a sentence-ending mark and its spoken name
# (« froissées. Point. »): the next word must not be « Point » or « Points ».
_BOUNDARY = re.compile(r"(?<=\.)\s+(?!Points?\b)")


def normalise(text: str) -> str:
    """Plain single spaces: the game's French spacing (U+202F, U+00A0) means nothing to the voice."""
    return _SPACES.sub(" ", text).strip()


class Respeller:
    """Word -> respelling (Ruling K3): case-sensitive, whole words only, never inside another word or a
    hyphenated compound; after an elided article (« l'Hydre ») it applies. The longest entry wins."""

    def __init__(self, table: dict[str, str]):
        self.table = dict(table)
        words = sorted(self.table, key=len, reverse=True)
        self._re = re.compile(r"(?<![\w-])(" + "|".join(map(re.escape, words)) + r")(?![\w-])") if words else None

    @classmethod
    def load(cls, path: Path) -> "Respeller":
        table = json.loads(path.read_text(encoding="utf-8")) if path.is_file() else {}
        if not isinstance(table, dict) or not all(isinstance(k, str) and k and isinstance(v, str) for k, v in table.items()):
            raise ValueError(f"{path}: expected an object of word -> respelling strings")
        return cls(table)

    def __call__(self, text: str) -> str:
        return self._re.sub(lambda m: self.table[m.group(1)], text) if self._re else text


def segments(text: str, limit: int = SEGMENT_CHARS) -> list[str]:
    """The line cut after named full stops into pieces of at most `limit` characters, greedily; a single
    sentence longer than `limit` stays whole (the engine splits it itself)."""
    out: list[str] = []
    current = ""
    for part in _BOUNDARY.split(text):
        if current and len(current) + 1 + len(part) > limit:
            out.append(current)
            current = part
        else:
            current = f"{current} {part}" if current else part
    if current:
        out.append(current)
    return out
