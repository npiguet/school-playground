"""The two measures of a copy (spec 2026-09-29 §1). Per lieutenant: the chances the text gave it and
the mistakes of its kind left in the handed-in copy. For the whole text: the mistakes left per 100
words, every category counted (accents, capitals, punctuation included), as a teacher counts."""
from __future__ import annotations


def lieutenant_measure(by_category: dict, categories: list[str]) -> dict:
    """chances = opportunities and left = missed + introduced, summed over the lieutenant's categories
    (the derived `derived:sirenes` / `derived:lethe` included); correct = (chances - left) / chances,
    None when the text gave it no chance."""
    chances = left = 0
    for c in categories:
        row = by_category.get(c) or {}
        chances += int(row.get("opportunities", 0) or 0)
        left += int(row.get("missed", 0) or 0) + int(row.get("introduced", 0) or 0)
    return {"chances": chances, "left": left, "correct": (chances - left) / chances if chances > 0 else None}


def mistakes_per_100(result: dict) -> float:
    """100 × finalErrors ÷ totalWords; 0 for a result without words (never a division by zero)."""
    words = int(result.get("totalWords", 0) or 0)
    return 100 * len(result.get("finalErrors") or []) / words if words > 0 else 0.0
