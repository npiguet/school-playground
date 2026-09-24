"""Grimoire corrompu: Éris plants plausible errors in a correct reference text.

Errors are planted using the lexicon (Task 1) and the annotation's agreement chains
(Task 2), weighted by the profile's weakest categories (spec §5 SP2, plan decision 8).
The reference text (before planting) remains the answer key: a plant only ever swaps in
another real, plausible spelling — never a spelling that is itself correct (an accidental
1990-reform variant of the original would grade as correct and must never be planted; see
`load_reform` / `_is_reform_pair` / `_loses_circumflex_under_reform`).

Pure, deterministic (given a `random.Random` instance) planning logic; `server/app/routers/
texts.py` wires this to sqlite (profile stats, trap words) and the stored annotation.
"""
from __future__ import annotations

import json
import re
import unicodedata
from functools import lru_cache
from pathlib import Path

from app.levels import level_index

BASE_WEIGHTS = {
    "agreement:verb": 0.20, "agreement:number": 0.15, "agreement:gender": 0.10, "agreement:participle": 0.15,
    "homophone": 0.25, "lexical": 0.10, "accent": 0.05,
}
MIN_GAP = 3  # minimum token distance between two plants

INELIGIBLE_POS = {"PROPN", "PUNCT", "SPACE"}
ACCENT_CHARS = "àâäéèêëîïôöùûüç"
_DOUBLE_LETTER_RE = re.compile(r"(ll|tt|nn|mm|rr|pp|ff)", re.IGNORECASE)
_VOWELS = "aeiouyàâäéèêëïîôöùûüœ"
_SINGLE_CONSONANT_RE = re.compile(f"[{_VOWELS}]([ltnmrpf])[{_VOWELS}]", re.IGNORECASE)
# Nouns whose circumflex the 1990 reform strips despite ending like a protected verb tense
# (see reform.ts CIRCUMFLEX_STRIP_NOUNS; kept in sync manually, both lists are short and stable).
_CIRCUMFLEX_STRIP_NOUNS = {"coût", "goût", "août", "dégoût", "ragoût", "moût", "affût", "surcoût", "gît"}
# Mirrors reform.ts CIRCUMFLEX_KEEP_RE.
_CIRCUMFLEX_KEEP_RE = re.compile(r"[îû](mes|tes)$|[îû]nt$|[^ao]ît$|ût$")


def corruption_count(word_count: int) -> int:
    return max(4, min(12, round(word_count / 18)))


def category_weights(stat_rows: list[dict], level: str) -> dict[str, float]:
    catch_rates: dict[str, float] = {}
    for r in stat_rows:
        errors = r.get("errors_in_draft", 0)
        if errors >= 3:
            catch_rates[r["category"]] = r.get("caught", 0) / errors

    weights: dict[str, float] = {}
    for cat, base in BASE_WEIGHTS.items():
        if cat == "agreement:participle" and level_index(level) < level_index("8H"):
            continue
        catch_rate = catch_rates.get(cat, 0.5)
        weights[cat] = base * (1.25 - catch_rate)
    return weights


def match_case(original: str, mutated: str) -> str:
    if original[:1].isupper():
        return mutated[:1].upper() + mutated[1:]
    return mutated


def _eligible(t: dict) -> bool:
    text = t["text"]
    if t["pos"] in INELIGIBLE_POS or len(text) < 2:
        return False
    return all(ch.isalpha() or ch in "'’" for ch in text)


def _valid(original: str, mutated: str | None) -> bool:
    return mutated is not None and mutated.lower() != original.lower()


def _next_word(by_i: dict[int, dict], i: int) -> str | None:
    nxt = by_i.get(i + 1)
    return nxt["text"] if nxt else None


def _last_accent_index(text: str) -> int | None:
    idx = None
    for i, ch in enumerate(text):
        if ch.lower() in ACCENT_CHARS:
            idx = i
    return idx


def _double_letter_flip(text: str) -> str | None:
    m = _DOUBLE_LETTER_RE.search(text)
    if m:
        return text[:m.start()] + m.group(0)[0] + text[m.end():]
    if len(text) >= 5:
        m2 = _SINGLE_CONSONANT_RE.search(text)
        if m2:
            c = m2.group(1)
            return text[:m2.start(1)] + c + c + text[m2.end(1):]
    return None


def _is_reform_pair(a: str, b: str, reform: dict | None) -> bool:
    if reform is None:
        return False
    return frozenset((a.lower(), b.lower())) in reform["pairs"]


def _loses_circumflex_under_reform(word: str, reform: dict | None) -> bool:
    if reform is None:
        return False
    w = word.lower()
    if w in reform["circumflex_protected"]:
        return False
    if w in reform["circumflex_strip_nouns"]:
        return True
    return not reform["keep_re"].search(w)


@lru_cache(maxsize=2)
def load_reform(content_dir: Path) -> dict | None:
    """1990 spelling-reform data (content/reform1990.json), used only to avoid planting a
    mutation that is itself an accepted spelling of the original word. Returns None (no
    filtering) when the file is absent, e.g. in test content directories that don't need it."""
    path = Path(content_dir) / "reform1990.json"
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        return None
    return {
        "pairs": {frozenset((a.lower(), b.lower())) for a, b in data.get("pairs", [])},
        "circumflex_protected": {w.lower() for w in data.get("circumflex_protected", [])},
        "circumflex_strip_nouns": _CIRCUMFLEX_STRIP_NOUNS,
        "keep_re": _CIRCUMFLEX_KEEP_RE,
    }


def candidates(annotation: dict, lexicon, homophones, trap_words: set[str] = frozenset(),
               reform: dict | None = None) -> dict[str, list[dict]]:
    tokens = annotation["tokens"]
    by_i = {t["i"]: t for t in tokens}
    chains = [c for c in annotation["chains"] if c["confidence"] in ("high", "medium")]
    out: dict[str, list[dict]] = {cat: [] for cat in BASE_WEIGHTS}

    def add(cat: str, t: dict, mutated: str | None) -> None:
        if _valid(t["text"], mutated):
            out[cat].append({"token": t["i"], "start": t["start"], "end": t["end"],
                              "original": t["text"], "mutated": mutated, "category": cat})

    for c in chains:
        if c["kind"] == "subject_verb":
            for ti in c["targets"]:
                t = by_i[ti]
                if _eligible(t) and t.get("morph", {}).get("VerbForm") == "Fin":
                    add("agreement:verb", t, lexicon.flip_number(t["text"], t["lemma"], t.get("morph", {})))

        if c["kind"] == "nominal":
            for ti in [c["controller"], *c["targets"]]:
                t = by_i[ti]
                if _eligible(t) and t["pos"] in {"DET", "NOUN", "ADJ"}:
                    add("agreement:number", t, lexicon.flip_number(t["text"], t["lemma"], t.get("morph", {})))

        if c["kind"] in {"nominal", "attribute", "participle_etre"}:
            for ti in c["targets"]:
                t = by_i[ti]
                is_participle = t.get("morph", {}).get("VerbForm") == "Part"
                if _eligible(t) and (t["pos"] in {"DET", "ADJ"} or is_participle):
                    next_word = _next_word(by_i, t["i"])
                    add("agreement:gender", t,
                        lexicon.flip_gender(t["text"], t["lemma"], t.get("morph", {}), next_word))

        for ti in c["targets"]:
            t = by_i[ti]
            if _eligible(t) and t.get("morph", {}).get("VerbForm") == "Part":
                next_word = _next_word(by_i, t["i"])
                add("agreement:participle", t, lexicon.flip_number(t["text"], t["lemma"], t.get("morph", {})))
                add("agreement:participle", t,
                    lexicon.flip_gender(t["text"], t["lemma"], t.get("morph", {}), next_word))

    for t in tokens:
        if not _eligible(t):
            continue
        text = t["text"]

        if "'" not in text and "’" not in text:
            set_id = homophones.set_of(text)
            if set_id:
                for m in homophones.words(set_id):
                    if " " not in m and m != text.lower():
                        add("homophone", t, match_case(text, m))

        accent_idx = _last_accent_index(text)
        if accent_idx is not None:
            base = unicodedata.normalize("NFD", text[accent_idx])[0]
            mutated = text[:accent_idx] + base + text[accent_idx + 1:]
            if not (text[accent_idx].lower() in "îû" and _loses_circumflex_under_reform(text, reform)):
                add("accent", t, mutated)

        lex_candidates: list[str] = []
        double_mutation = _double_letter_flip(text)
        if double_mutation:
            lex_candidates.append(double_mutation)
        sound_alikes = [w for w in lexicon.sound_alikes(text) if homophones.set_of(w) is None]
        if sound_alikes:
            lex_candidates.append(sound_alikes[0])
        lex_candidates = [m for m in lex_candidates if not _is_reform_pair(text, m, reform)]
        reps = 3 if text.lower() in trap_words else 1
        for mutated in lex_candidates:
            for _ in range(reps):
                add("lexical", t, mutated)

    return out


def plan_corruptions(body: str, annotation: dict, lexicon, homophones, weights: dict[str, float], count: int,
                      rng, trap_words: set[str] = frozenset(), reform: dict | None = None) -> list[dict]:
    cands = candidates(annotation, lexicon, homophones, trap_words, reform)
    weights = {k: v for k, v in weights.items() if cands.get(k)}
    chosen: list[dict] = []
    used_tokens: set[int] = set()
    while len(chosen) < count and weights:
        cat = rng.choices(list(weights), weights=list(weights.values()))[0]
        pool = [c for c in cands[cat] if all(abs(c["token"] - u) >= MIN_GAP for u in used_tokens)]
        if not pool:
            del weights[cat]
            continue
        c = rng.choice(pool)
        chosen.append(c)
        used_tokens.add(c["token"])
    return sorted(chosen, key=lambda p: p["start"])


def apply_plants(body: str, plants: list[dict]) -> str:
    result = body
    for p in sorted(plants, key=lambda p: p["start"], reverse=True):
        result = result[:p["start"]] + p["mutated"] + result[p["end"]:]
    return result
