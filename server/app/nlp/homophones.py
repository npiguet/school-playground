"""Loads content/homophones.json, the single homophone table shared with the web client."""
from __future__ import annotations
import json
from functools import lru_cache
from pathlib import Path


def normalize_word(word: str) -> str:
    return word.lower().replace("’", "'").replace("ʼ", "'")


class Homophones:
    def __init__(self, data: dict):
        self.sets: list[dict] = data["sets"]
        self._index: dict[str, str] = {}
        for s in self.sets:
            for w in s["words"]:
                self._index[normalize_word(w)] = s["id"]

    def set_of(self, word: str) -> str | None:
        return self._index.get(normalize_word(word))

    def words(self, set_id: str) -> list[str]:
        return next((s["words"] for s in self.sets if s["id"] == set_id), [])

    def hint(self, set_id: str) -> str:
        return next((s["hint"] for s in self.sets if s["id"] == set_id), "")


@lru_cache(maxsize=4)
def load_homophones(content_dir: Path) -> Homophones:
    with open(Path(content_dir) / "homophones.json", encoding="utf-8") as f:
        return Homophones(json.load(f))
