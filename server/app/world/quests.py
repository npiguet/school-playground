"""Quest evaluation, boss verdict and text recommendation by category density (plan Decisions 7, 8)."""
from __future__ import annotations
from app.levels import level_index
from app.rules import Rules
from app.world.measures import lieutenant_measure, mistakes_per_100


def quest_miss_reason(by_category: dict, categories: list[str], rules: Rules) -> str | None:
    """Why a quest session does not count, None when it does (spec 2026-09-29 §2): `"chances"` when
    the text gave the target lieutenant too few chances, `"copy"` when too many of its mistakes are
    left in the handed-in copy. The victory says which, in the camp's voice."""
    m = lieutenant_measure(by_category, categories)
    if m["chances"] < rules.quest_min_chances or m["correct"] is None:
        return "chances"
    return None if m["correct"] >= rules.quest_min_correct else "copy"


def fight_won(result: dict, rules: Rules) -> bool:
    """Spec 2026-09-29 §2: an Éris fight is won on the whole copy, at most `fight_max_per_100` mistakes
    left per 100 words. A clean copy simply wins (the old "too easy" draw is gone)."""
    return mistakes_per_100(result) <= rules.fight_max_per_100


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


MIN_RECOMMEND_WORDS = 60  # P1-3: a text too short barely offers the category a chance to appear.


def recommend_texts(rows: list[dict], key: str, level: str, played: set[int], n: int = 3) -> list[dict]:
    """Texts for a quest board / lieutenant page / Oracle quest card (plan Decision 7; P1-3 fix).
    Ranking by density alone sent a 10H player 5H/6H texts: too easy, and often too short to ever
    meet the monster. Now: never below `level - 2` (a hard floor - "she will notice she is being
    sent to 5H texts"), never under MIN_RECOMMEND_WORDS words, and prefer level distance <= 1 from
    the player's own level, widening to <= 2 and then to any (still floor-limited) level only if
    that tier does not have enough candidates. Never a text holding a verb tense her class has not
    learnt yet (`tense_level`, app.nlp.tenses): a passé simple is no quest for a 7H."""
    idx = level_index(level)
    floor_idx = max(0, idx - 2)
    candidates = [
        r for r in rows
        if r["density"] > 0 and r["word_count"] >= MIN_RECOMMEND_WORDS and level_index(r["level"]) >= floor_idx
        and (r.get("tense_level") is None or level_index(r["tense_level"]) <= idx)
    ]

    def sort_key(r: dict) -> tuple:
        return (r["id"] in played, -r["density"], r["id"])

    def distance(r: dict) -> int:
        return abs(level_index(r["level"]) - idx)

    chosen: list[dict] = []
    chosen_ids: set[int] = set()
    for max_distance in (1, 2, None):
        pool = [r for r in candidates if r["id"] not in chosen_ids and (max_distance is None or distance(r) <= max_distance)]
        pool.sort(key=sort_key)
        for r in pool:
            if len(chosen) >= n: break
            chosen.append(r); chosen_ids.add(r["id"])
        if len(chosen) >= n: break

    return [{"id": r["id"], "title": r["title"], "level": r["level"], "word_count": r["word_count"]} for r in chosen]
