"""Quest evaluation, boss verdict and text recommendation by category density (plan Decisions 7, 8)."""
from __future__ import annotations
from app.levels import level_index


def lieutenant_totals(by_category: dict, categories: list[str]) -> dict:
    t = {"opportunities": 0, "draft": 0, "caught": 0, "missed": 0}
    for c in categories:
        row = by_category.get(c) or {}
        for k in t: t[k] += int(row.get(k, 0))
    return t


def session_counts_for(by_category: dict, categories: list[str], min_rate: float) -> bool:
    t = lieutenant_totals(by_category, categories)
    if t["draft"] > 0: return t["caught"] / t["draft"] >= min_rate
    return t["opportunities"] >= 3


def evaluate_boss(result: dict, min_rate: float = 0.7, min_draft: int = 3) -> bool:
    if len(result.get("draftErrors", [])) < min_draft: return True
    return (result.get("catchRate") or 0.0) >= min_rate


def _pron_between(tokens: list[dict], a: int, b: int) -> bool:
    return any(x["pos"] == "PRON" and x.get("dep") != "nsubj" for x in tokens[min(a, b) + 1:max(a, b)])


def sirene_like(tokens: list[dict], chains: list[dict], t: dict) -> bool:
    i = t["i"]
    if chains:
        for ch in chains:
            if ch.get("kind") != "subject_verb" or i not in ch.get("targets", []) or ch.get("confidence") == "low": continue
            c = ch["controller"]
            if ch.get("via") == "qui" or ch.get("distance", 0) >= 4 or c > i or _pron_between(tokens, c, i): return True
        return False
    s = t.get("subject")
    return s is not None and (abs(s - i) >= 4 or s > i or _pron_between(tokens, s, i))


def density(annotation: dict, word_count: int, key: str) -> float:
    tokens = annotation.get("tokens", []); chains = annotation.get("chains", [])
    if key == "lethe": return 1.0 if word_count >= 120 else 0.0
    def hit(t):
        m = t.get("morph", {}); cats = t.get("categories", [])
        if key == "hydre": return m.get("Number") == "Plur" and ("nominal_group" in cats or "verb" in cats)
        if key == "echo": return t.get("homophone") is not None
        if key == "chimere": return m.get("Gender") == "Fem" and "nominal_group" in cats
        if key == "protee": return "participle" in cats or m.get("VerbForm") == "Part"
        if key == "sirenes": return "verb" in cats and sirene_like(tokens, chains, t)
        return False
    n = sum(1 for t in tokens if hit(t))
    return 100.0 * n / word_count if word_count else 0.0


def recommend_texts(rows: list[dict], key: str, level: str, played: set[int], n: int = 3) -> list[dict]:
    ok = [r for r in rows if level_index(r["level"]) <= level_index(level) and r["density"] > 0]
    ok.sort(key=lambda r: (r["id"] in played, -r["density"], r["id"]))
    return [{"id": r["id"], "title": r["title"], "level": r["level"], "word_count": r["word_count"]} for r in ok[:n]]
