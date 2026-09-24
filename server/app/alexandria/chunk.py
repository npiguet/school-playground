"""Split cleaned paragraphs into dictation-sized chunks (80-200 words, spec §5),
never crossing a sentence boundary.
"""
from __future__ import annotations

import re

from app.alexandria.clean import Paragraph
from app.textutil import word_count

ABBREVIATIONS = ("M.", "MM.", "Mme.", "Mlle.", "Mgr.", "Dr.", "St.", "Ste.", "etc.", "cf.", "p.", "chap.")

_SPLIT_RE = re.compile(
    r'(?<=[.!?…»])\s+(?=[«"(—]?\s?[A-ZÀÂÄÉÈÊËÎÏÔÖÙÛÜÇŒÆ])'
)


def split_sentences(text: str) -> list[str]:
    pieces = [p for p in _SPLIT_RE.split(text.strip()) if p]
    merged: list[str] = []
    for piece in pieces:
        if merged:
            tokens = merged[-1].split()
            last_token = tokens[-1] if tokens else ""
            if last_token in ABBREVIATIONS:
                merged[-1] = f"{merged[-1]} {piece}"
                continue
        merged.append(piece)
    return merged


def _body_of(current: list[tuple[int, str, str]]) -> str:
    parts: list[str] = []
    buf: list[str] = []
    buf_para = current[0][0]
    for para_idx, _kind, sentence in current:
        if para_idx != buf_para:
            parts.append(" ".join(buf))
            buf = []
            buf_para = para_idx
        buf.append(sentence)
    parts.append(" ".join(buf))
    return "\n\n".join(parts)


def make_chunks(paragraphs: list[Paragraph], min_words: int = 80, max_words: int = 200, target: int = 130) -> list[dict]:
    flat: list[tuple[int, str, str]] = []
    for para_idx, para in enumerate(paragraphs):
        for sentence in split_sentences(para.text):
            flat.append((para_idx, para.kind, sentence))

    chunks: list[dict] = []
    i = 0
    n = len(flat)
    while i < n:
        words = word_count(flat[i][2])
        if words > max_words:
            i += 1
            continue
        current = [flat[i]]
        current_words = words
        j = i + 1
        while j < n and current_words < target:
            next_para_idx, _next_kind, next_sentence = flat[j]
            next_words = word_count(next_sentence)
            if current_words + next_words > max_words:
                break
            if next_para_idx != current[-1][0] and current_words >= min_words:
                break
            current.append(flat[j])
            current_words += next_words
            j += 1
        if current_words < min_words:
            i = j
            continue
        chunks.append({
            "body": _body_of(current),
            "word_count": current_words,
            "sentences": [s for (_, _, s) in current],
            "verse": any(kind == "verse" for (_, kind, _) in current),
        })
        i = j
    return chunks
