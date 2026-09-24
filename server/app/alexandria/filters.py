"""Reject chunks unsuitable for dictation: digits, verse, heavy dialogue, too many
proper nouns, pre-1835 spelling, or too many words missing from the lexicon.
"""
from __future__ import annotations

import re

from app.alexandria.chunk import split_sentences
from app.textutil import WORD_RE

DIGIT_RE = re.compile(r"\d")
DIALOGUE_RATIO = 0.30
PROPER_NOUN_RATIO = 0.06
UNKNOWN_RATIO = 0.02


def _old_spelling_variant(word: str) -> str | None:
    if word.endswith("oient"):
        return word[:-5] + "aient"
    if word.endswith("oit"):
        return word[:-3] + "ait"
    if word.endswith("ans") or word.endswith("ens"):
        return word[:-1] + "t" + word[-1]
    return None


def _dialogue_ratio(sentences: list[str]) -> float:
    if not sentences:
        return 0.0
    dialogue_n = sum(1 for s in sentences if s.lstrip()[:1] in ("—", "«", '"') or "»" in s)
    return dialogue_n / len(sentences)


def _proper_noun_ratio(sentences: list[str]) -> float:
    total = 0
    proper = 0
    for sentence in sentences:
        tokens = list(WORD_RE.finditer(sentence))
        for idx, m in enumerate(tokens):
            total += 1
            if idx == 0:
                continue
            word = m.group(0)
            if not word[0].isupper():
                continue
            preceding = sentence[:m.start()].rstrip()
            if preceding and preceding[-1] in "«—":
                continue
            proper += 1
    return proper / total if total else 0.0


def _has_old_spelling(body: str, lexicon) -> bool:
    for m in WORD_RE.finditer(body):
        word = m.group(0).lower()
        variant = _old_spelling_variant(word)
        if variant and not lexicon.is_known(word) and lexicon.is_known(variant):
            return True
    return False


def _unknown_ratio(body: str, lexicon) -> float:
    tokens = [m.group(0) for m in WORD_RE.finditer(body)]
    if not tokens:
        return 0.0
    unknown = sum(
        1 for w in tokens
        if not w[0].isupper() and not any(ch.isdigit() for ch in w) and not lexicon.is_known(w.lower())
    )
    return unknown / len(tokens)


def chunk_verdict(chunk: dict, lexicon) -> str | None:
    body = chunk["body"]
    if DIGIT_RE.search(body):
        return "digits"
    if chunk.get("verse"):
        return "verse"
    sentences = split_sentences(body)
    if _dialogue_ratio(sentences) > DIALOGUE_RATIO:
        return "dialogue"
    if _proper_noun_ratio(sentences) > PROPER_NOUN_RATIO:
        return "proper_nouns"
    if _has_old_spelling(body, lexicon):
        return "old_spelling"
    if _unknown_ratio(body, lexicon) > UNKNOWN_RATIO:
        return "unknown_words"
    return None
