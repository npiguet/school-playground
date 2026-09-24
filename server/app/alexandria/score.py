"""Level and score of an accepted chunk, from its agreement chains (annotation v2)."""
from __future__ import annotations

from app.levels import LEVELS, level_index
from app.textutil import WORD_RE

LEVEL_THRESHOLDS = [("5H", 10, 0.03), ("6H", 12, 0.04), ("7H", 15, 0.05), ("8H", 18, 0.06),
                     ("9H", 22, 0.08), ("10H", 27, 0.10)]

_HIGH_MEDIUM = ("high", "medium")


def chunk_features(body: str, annotation: dict, lexicon) -> dict:
    words = len(WORD_RE.findall(body))
    chains = annotation.get("chains", [])
    chain_targets = sum(len(c["targets"]) for c in chains if c["confidence"] in _HIGH_MEDIUM)
    agreement_density = chain_targets / words if words else 0.0
    sentences = annotation.get("sentences", [])
    avg_sentence_len = words / max(1, len(sentences))
    tokens = [m.group(0) for m in WORD_RE.finditer(body)]
    rare_candidates = [w for w in tokens if not w[0].isupper()]
    if rare_candidates:
        rare = sum(1 for w in rare_candidates if _is_rare(w, lexicon))
        rare_ratio = rare / len(rare_candidates)
    else:
        rare_ratio = 0.0
    return {
        "agreement_density": agreement_density,
        "avg_sentence_len": avg_sentence_len,
        "rare_ratio": rare_ratio,
        "chain_targets": chain_targets,
    }


def _is_rare(word: str, lexicon) -> bool:
    entries = lexicon.lookup(word)
    if not entries:
        return True
    return max(e.freq for e in entries) < 1.0


def level_for(features: dict, level_hint: str) -> str:
    level = "11H"
    for name, max_avg, max_rare in LEVEL_THRESHOLDS:
        if features["avg_sentence_len"] <= max_avg and features["rare_ratio"] <= max_rare:
            level = name
            break
    if level_index(level) < level_index(level_hint):
        level = level_hint
    return level


def score_for(features: dict) -> float:
    return round(100 * features["agreement_density"], 1)
