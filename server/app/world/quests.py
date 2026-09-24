"""Quest evaluation, boss verdict and text recommendation by category density (plan Decisions 7, 8)."""
from __future__ import annotations
from app.levels import level_index


def lieutenant_totals(by_category: dict, categories: list[str]) -> dict:
    t = {"opportunities": 0, "draft": 0, "caught": 0, "missed": 0}
    for c in categories:
        row = by_category.get(c) or {}
        for k in t: t[k] += int(row.get(k, 0))
    return t


# P1-4 fix (SP3 playability, controller ruling - see plan Decision 7 addendum below): the original
# rule ("0 draft errors while the text offered >= 3 opportunities" counts) let a board/Oracle quest
# be finished in three 1-minute texts, without the monster ever tripping the player once ("Tenir
# Écho en échec" advanced on a 13-word text with no homophone error). A session must now show the
# monster actually contested the text: >= 3 opportunities always, AND either a real draft error
# (>= 1, judged on catch rate as before) or a meaningful number of occurrences even without a
# mistake (>= 6) - a short, easy text with 3-5 clean opportunities no longer farms progress.
MIN_OPPORTUNITIES = 3
MIN_OPPORTUNITIES_WITHOUT_ERROR = 6


def session_counts_for(by_category: dict, categories: list[str], min_rate: float) -> bool:
    t = lieutenant_totals(by_category, categories)
    if t["opportunities"] < MIN_OPPORTUNITIES: return False
    if t["draft"] > 0: return t["caught"] / t["draft"] >= min_rate
    return t["opportunities"] >= MIN_OPPORTUNITIES_WITHOUT_ERROR


def evaluate_boss(result: dict, min_rate: float = 0.7, min_draft: int = 3) -> str:
    """Boss verdict: 'won', 'lost' or 'too_easy' (plan Decision 8; P1-5 fix). A draft with too few
    errors to judge fairly (< min_draft) used to win the tier outright - the single biggest reward
    in the game for a fight that then exercised no proofreading at all. It is now a draw
    ('too_easy'): not a win (no XP/gear granted, the quest stays active exactly like a real loss -
    "nothing lost"), but distinct from 'lost' so the reveal can show its own encouragement
    ("reviens avec un texte plus long") instead of Éris's mocking loss line, which would not fit a
    fight she never got to fight."""
    if len(result.get("draftErrors", [])) < min_draft: return "too_easy"
    return "won" if (result.get("catchRate") or 0.0) >= min_rate else "lost"


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
    that tier does not have enough candidates."""
    idx = level_index(level)
    floor_idx = max(0, idx - 2)
    candidates = [
        r for r in rows
        if r["density"] > 0 and r["word_count"] >= MIN_RECOMMEND_WORDS and level_index(r["level"]) >= floor_idx
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
