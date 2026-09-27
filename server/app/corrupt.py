"""Grimoire corrompu: Éris plants plausible errors in a correct reference text.

Errors are planted using the lexicon (Task 1) and the annotation's agreement chains
(Task 2), weighted by the profile's weakest categories (spec §5 SP2, plan decision 8).
The reference text (before planting) remains the answer key: a plant only ever swaps in
another real, plausible spelling — never a spelling that is itself correct (spec §1.3):

- a 1990-reform variant or an accepted doublet of the original would grade as correct, so
  every candidate is checked with `is_reform_equivalent` (server-side mirror of the grader's
  `reformCanon`, same data file content/reform1990.json);
- an agreement flip is planted only when the chain's controller really dictates the flipped
  feature: never a gender flip under « je/tu/nous/vous » or an epicene noun (« une enfant »),
  never a number flip on the determiner of an invariable noun (« le bras » / « les bras »),
  nothing at all under « on » / « ce » (final review C-1, C-2). When in doubt, skip;
- an agreement slip is planted only when the original is its one single-word repair: « un lions »
  (from « des lions ») also reads as « un lion », so it is never planted (see `_one_repair`).

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
from app.nlp.chains import INDEFINITE_SUBJECTS, NOMINAL_POS
from app.world.catalog import LIEUTENANTS

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

# Mirrors reform.ts (CIRCUMFLEX_KEEP_RE, ELER_ENDINGS, AYER_ENDINGS — see there for the rationale);
# the word lists come from content/reform1990.json so both sides read the same data.
_CIRCUMFLEX_KEEP_RE = re.compile(r"(^|[^o])[îû]n?(mes|tes)$|[îû]nt$|[^ao]ît$|ût$")
_ELER_ENDINGS = "(e|es|ent|era|eras|erai|erons|erez|eront|erais|erait|eraient)"
_AYER_ENDINGS = "(e|es|ent|era|eras|erai|erons|erez|eront|erais|erait|erions|eriez|eraient)"

# Pronoun subjects whose written form reveals their gender. Any other pronoun controller (je, tu,
# nous, vous, a clitic « les »…) leaves the target's gender undetermined — « Nous sommes parties »
# is correct French — so no gender flip may be planted on its targets (final review C-1).
GENDERED_PRONOUNS = {"il": "Masc", "ils": "Masc", "elle": "Fem", "elles": "Fem"}
# « vous » de politesse and « nous » de modestie take a singular attribute or participle
# (« Vous êtes venu »): the pronoun's form does not dictate the number of such targets.
NUMBER_AMBIGUOUS_PRONOUNS = {"nous", "vous"}
_LEXIQUE_GENDER = {"m": "Masc", "f": "Fem"}
NUMBER, GENDER = frozenset({"Number"}), frozenset({"Gender"})


def corruption_count(word_count: int) -> int:
    return max(4, min(12, round(word_count / 18)))


def category_weights(stat_rows: list[dict], level: str, focus: str | None = None) -> dict[str, float]:
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
    # Grimoire focus (plan Decision 21): « le Grimoire de l'Hydre » leans hard on that lieutenant's
    # categories. Derived categories (sirenes, lethe) are not corruption categories, so focusing them
    # boosts no weight here — lethe instead biases *where* plants land, in plan_corruptions below.
    if focus in LIEUTENANTS:
        for c in LIEUTENANTS[focus]["categories"]:
            if c in weights:
                weights[c] *= 3
    return weights


def match_case(original: str, mutated: str) -> str:
    if original[:1].isupper():
        return mutated[:1].upper() + mutated[1:]
    return mutated


def _lower(text: str) -> str:
    return text.lower().replace("’", "'")


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


@lru_cache(maxsize=2)
def load_reform(content_dir: Path) -> dict | None:
    """1990 spelling-reform data (content/reform1990.json), used only to avoid planting a
    mutation that is itself an accepted spelling of the original word. Returns None (no
    filtering) when the file is absent."""
    path = Path(content_dir) / "reform1990.json"
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        return None
    to_traditional: dict[str, str] = {}
    for traditional, variant in data.get("pairs", []) + data.get("variants", []):
        to_traditional[variant.lower()] = traditional.lower()
        to_traditional[traditional.lower()] = traditional.lower()
    rules: list[tuple[re.Pattern, str]] = []
    for stem in data.get("eler_eter_stems", []):
        consonant, base = stem[-1], stem[:-1]
        accented = re.sub("e$", "è", base)
        rules.append((re.compile(f"^{re.escape(accented)}{consonant}{_ELER_ENDINGS}$"), f"{base}{consonant}{consonant}\\1"))
    for stem in data.get("ayer_stems", []):
        rules.append((re.compile(f"^{re.escape(stem)}i{_AYER_ENDINGS}$"), f"{stem}y\\1"))
    return {
        "to_traditional": to_traditional,
        "rules": rules,
        "circumflex_protected": {w.lower() for w in data.get("circumflex_protected", [])},
        "circumflex_strip_words": {w.lower() for w in data.get("circumflex_strip_words", [])},
        "keep_re": _CIRCUMFLEX_KEEP_RE,
    }


# Mirrors reform.ts ELISION_RE (SP2 playability P1-1): an elided token is canonicalised on the
# part after the apostrophe, the elision itself is kept.
_ELISION_RE = re.compile(r"^(l|d|qu|j|n|m|t|s|c|jusqu|lorsqu|puisqu|quoiqu)'(.+)$")


def reform_canon(word: str, reform: dict) -> str:
    """Server-side mirror of reform.ts `reformCanon`: the spelling a word is graded under."""
    w = _lower(word)
    elided = _ELISION_RE.match(w)
    if elided:
        return f"{elided.group(1)}'{reform_canon(elided.group(2), reform)}"
    explicit = reform["to_traditional"].get(w)
    if explicit is not None:
        return explicit
    if len(w) > 1 and w[-1] in "sx":
        stem = reform["to_traditional"].get(w[:-1])
        if stem is not None:
            return stem + w[-1]
    for pattern, replacement in reform["rules"]:
        if pattern.search(w):
            return pattern.sub(replacement, w)
    if w not in reform["circumflex_strip_words"] and (w in reform["circumflex_protected"] or reform["keep_re"].search(w)):
        return w
    return w.replace("î", "i").replace("û", "u")


def is_reform_equivalent(a: str, b: str, reform: dict | None) -> bool:
    """True when the grader accepts `a` and `b` as the same word (1990 reform variant or accepted
    doublet): such a mutation is correct French and must never be planted."""
    if reform is None:
        return False
    return reform_canon(a, reform) == reform_canon(b, reform)


def _controller_gender(c: dict, by_i: dict[int, dict], lexicon) -> str | None:
    """The gender the chain's controller imposes on its targets, or None when it is unknown or
    ambiguous — then the flipped form may well be correct French and nothing is planted."""
    if c.get("via") == "conj":
        return None  # « Marie et Pierre sont partis »: masculine wins whatever the first conjunct says
    ctrl = by_i[c["controller"]]
    gender = c["features"].get("Gender")
    if gender is None:
        return None
    if ctrl["pos"] == "PRON":
        return gender if GENDERED_PRONOUNS.get(_lower(ctrl["text"])) == gender else None
    if ctrl["pos"] == "NOUN":
        # The parse and the lexicon must agree, and the lexicon must know a single gender:
        # Lexique leaves it blank for epicene nouns (enfant, élève) and lists both for le/la poste.
        genres = {e.genre for e in lexicon.lookup(ctrl["text"]) if e.cgram.split(":")[0] == "NOM"}
        if len(genres) == 1 and _LEXIQUE_GENDER.get(next(iter(genres))) == gender:
            return gender
    return None


def _flips_number(t: dict, lexicon) -> bool:
    return lexicon.flip_number(t["text"], t["lemma"], t.get("morph", {})) is not None


def _under_invariable_noun(t: dict, by_i: dict[int, dict], lexicon) -> bool:
    """A determiner whose head noun does not change between singular and plural (bras, souris,
    prix, voix…): « leur bras » and « leurs bras » are both correct (final review C-2)."""
    head = by_i.get(t["head"])
    return (head is not None and head["i"] != t["i"] and head["pos"] == "NOUN"
            and not _flips_number(head, lexicon))


def _differ_only_by_s(a: str, b: str) -> bool:
    return a.lower().rstrip("s") == b.lower().rstrip("s")


# --- One repair only (Grimoire ambiguity) ---
# A planted agreement slip must have exactly one single-word repair: the original. After the plant, the
# other words of the agreement group still carry the original value; when only one of them carries it
# and it could change too, it offers a second repair: « un lions » reads as « des lions » or as « un
# lion ». A plant is kept only when the original value is carried by a word that cannot change (the
# fixed gender of « rocher », the person of a noun subject, the plural of a coordination) or by at
# least two words. A word that marks no value (« bras », « féroce » for gender) carries nothing.

def _agreement_groups(chains: list[dict], by_i: dict[int, dict], lexicon) -> dict[int, list[dict]]:
    """The agreement groups each token belongs to: a controller with the targets of all its chains
    (its determiners and adjectives, its verbs, attributes and participles). A coordinated subject is
    a group of its own, whose plural the coordination imposes."""
    groups: dict[tuple[int, bool], dict] = {}
    for c in chains:
        if c.get("rule") == "no_agreement":
            continue  # « ils ont mangé »: the participle agrees with no word, its only repair is itself
        conj = c.get("via") == "conj"
        g = groups.setdefault((c["controller"], conj), {"controller": c["controller"], "conj": conj,
                                                         "members": set(), "values": {}})
        g["members"].update(c["targets"])
        # a nominal chain records no person, a predicate noun's chain no gender: merge them all
        for feature, value in (("Number", c["features"].get("Number")), ("Person", c["features"].get("Person")),
                               ("Gender", _controller_gender(c, by_i, lexicon))):
            if g["values"].get(feature) is None:
                g["values"][feature] = value
    of_token: dict[int, list[dict]] = {}
    for g in groups.values():
        for i in g["members"] | {g["controller"]}:
            of_token.setdefault(i, []).append(g)
    return of_token


AGREEING_POS = {"DET", "ADJ", "VERB", "AUX", "NOUN"}


def _carrier(g: dict, t: dict, feature: str, by_i: dict[int, dict], lexicon) -> str | None:
    """How `t` carries the group's value of `feature`: "fixed" (it cannot change), "flip" (another
    form of it carries the other value) or None (it marks no value)."""
    morph = t.get("morph", {})
    if t["i"] == g["controller"]:
        if g["conj"]:
            return "fixed" if feature == "Number" or t["pos"] in NOMINAL_POS else "flip"
        if t["pos"] not in NOMINAL_POS:
            return "flip"  # « il » → « elle », « ils », « tu »
        if feature == "Person":
            return "fixed"
        if feature == "Number":
            if _flips_number(t, lexicon):
                return "flip"  # a common noun, even one the small model tagged PROPN (« la mer »)
            if t["pos"] == "PROPN" and not any(by_i[i]["pos"] == "DET" for i in g["members"]):
                return "fixed"  # « Ulysse » alone is singular; « des Byron » takes no plural mark
            return None
        return "flip" if lexicon.flip_gender(t["text"], t["lemma"], morph) else "fixed"
    if t["pos"] not in AGREEING_POS or morph.get(feature) != g["values"][feature]:
        return None  # a pronoun the parse hung on a noun (« a bu la rosée ») agrees with nothing
    if morph.get("VerbForm") == "Fin" and not any(e.cgram.split(":")[0] in ("VER", "AUX")
                                                   for e in lexicon.lookup(t["text"])):
        return None  # a noun the parse took for a verb (« front »): its plural is no verb agreement
    if feature == "Person":
        return "flip" if morph.get("VerbForm") == "Fin" else None
    flip = lexicon.flip_number if feature == "Number" else lexicon.flip_gender
    return "flip" if flip(t["text"], t["lemma"], morph) else None


def _one_repair(t: dict, features: set[str], groups: list[dict], by_i: dict[int, dict], lexicon) -> bool:
    """True when changing `features` of `t` leaves the original as the only single-word repair."""
    for g in groups:
        for feature in features:
            if g["values"][feature] is None:
                return False
            carriers = [c for i in g["members"] | {g["controller"]} if i != t["i"]
                        if (c := _carrier(g, by_i[i], feature, by_i, lexicon))]
            if "fixed" not in carriers and len(carriers) < 2:
                return False
    return True


def _swap_features(t: dict, mutated: str, next_word: str | None, lexicon) -> set[str]:
    """The agreement features a homophone swap changes: « leurs » → « leur » (number), « quel » →
    « quelles » (gender and number), « est » → « es » (person). Empty for another word (« et »)."""
    morph = t.get("morph", {})
    m = mutated.lower()
    features = set()
    if lexicon.flip_number(t["text"], t["lemma"], morph) == m:
        features.add("Number")
    if lexicon.flip_gender(t["text"], t["lemma"], morph, next_word) == m:
        features.add("Gender")
    if features or not {e.lemme for e in lexicon.lookup(t["text"])} & {e.lemme for e in lexicon.lookup(m)}:
        return features
    return {"Person"} if morph.get("VerbForm") == "Fin" else {"Number", "Gender"}


def candidates(annotation: dict, lexicon, homophones, trap_words: set[str] = frozenset(),
               reform: dict | None = None) -> dict[str, list[dict]]:
    tokens = annotation["tokens"]
    by_i = {t["i"]: t for t in tokens}
    chains = [c for c in annotation.get("chains", []) if c["confidence"] in ("high", "medium")]
    out: dict[str, list[dict]] = {cat: [] for cat in BASE_WEIGHTS}
    groups = _agreement_groups(chains, by_i, lexicon)

    def add(cat: str, t: dict, mutated: str | None, features: set[str] = frozenset()) -> None:
        if features:
            if t["i"] in groups:
                if not _one_repair(t, features, groups[t["i"]], by_i, lexicon):
                    return
            elif cat == "homophone" and t["pos"] in {"DET", "ADJ", "VERB", "AUX"}:
                return  # a word that agrees with some other word, but no chain says which: skip
        if _valid(t["text"], mutated) and not is_reform_equivalent(t["text"], mutated, reform):
            out[cat].append({"token": t["i"], "start": t["start"], "end": t["end"],
                              "original": t["text"], "mutated": mutated, "category": cat})

    for c in chains:
        ctrl = by_i[c["controller"]]
        ctrl_low = _lower(ctrl["text"])
        if ctrl_low in INDEFINITE_SUBJECTS:
            continue  # « on est parti(s) », « ce sont des fées »: both agreements are accepted French
        gender = _controller_gender(c, by_i, lexicon)
        number_dictated = ctrl_low not in NUMBER_AMBIGUOUS_PRONOUNS

        if c["kind"] == "subject_verb":
            for ti in c["targets"]:
                t = by_i[ti]
                if _eligible(t) and t.get("morph", {}).get("VerbForm") == "Fin":
                    add("agreement:verb", t, lexicon.flip_number(t["text"], t["lemma"], t.get("morph", {})), NUMBER)

        # An invariable head noun (bras, souris, prix…) makes « le bras » / « les bras » both correct:
        # no number flip anywhere in its group. The head noun itself is never planted either:
        # « par le soleils » changes what the noun says, not an agreement — only the receivers
        # (determiner, adjectives) are planted, so the explanation can name the noun they follow
        # (SP2 playability P1-5).
        if c["kind"] == "nominal" and _flips_number(ctrl, lexicon):
            for ti in c["targets"]:
                t = by_i[ti]
                if _eligible(t) and t["pos"] in {"DET", "ADJ"}:
                    add("agreement:number", t, lexicon.flip_number(t["text"], t["lemma"], t.get("morph", {})), NUMBER)

        if c["kind"] in {"nominal", "attribute", "participle_etre"} and gender is not None:
            for ti in c["targets"]:
                t = by_i[ti]
                is_participle = t.get("morph", {}).get("VerbForm") == "Part"
                if _eligible(t) and (t["pos"] in {"DET", "ADJ"} or is_participle):
                    next_word = _next_word(by_i, t["i"])
                    add("agreement:gender", t,
                        lexicon.flip_gender(t["text"], t["lemma"], t.get("morph", {}), next_word), GENDER)

        for ti in c["targets"]:
            t = by_i[ti]
            if _eligible(t) and t.get("morph", {}).get("VerbForm") == "Part":
                next_word = _next_word(by_i, t["i"])
                if number_dictated:
                    add("agreement:participle", t, lexicon.flip_number(t["text"], t["lemma"], t.get("morph", {})), NUMBER)
                if gender is not None:
                    add("agreement:participle", t,
                        lexicon.flip_gender(t["text"], t["lemma"], t.get("morph", {}), next_word), GENDER)

    for t in tokens:
        if not _eligible(t):
            continue
        text = t["text"]

        if "'" not in text and "’" not in text:
            set_id = homophones.set_of(text)
            if set_id:
                skip_s_only = t["pos"] == "DET" and _under_invariable_noun(t, by_i, lexicon)
                for m in homophones.words(set_id):
                    if " " in m or m == text.lower():
                        continue
                    if skip_s_only and _differ_only_by_s(text, m):
                        continue  # « leurs bras » vs « leur bras »
                    add("homophone", t, match_case(text, m), _swap_features(t, m, _next_word(by_i, t["i"]), lexicon))

        accent_idx = _last_accent_index(text)
        if accent_idx is not None:
            base = unicodedata.normalize("NFD", text[accent_idx])[0]
            add("accent", t, text[:accent_idx] + base + text[accent_idx + 1:])

        lex_candidates: list[str] = []
        double_mutation = _double_letter_flip(text)
        if double_mutation:
            lex_candidates.append(double_mutation)
        # A sound-alike sharing a lemma with the original (dansent → danse, fées → fée) is an
        # agreement error, not a lexical one: never planted here (final review I-4).
        lemmas = {e.lemme for e in lexicon.lookup(text)}
        sound_alikes = [w for w in lexicon.sound_alikes(text)
                        if homophones.set_of(w) is None and not lemmas & {e.lemme for e in lexicon.lookup(w)}]
        if sound_alikes:
            lex_candidates.append(sound_alikes[0])
        reps = 3 if text.lower() in trap_words else 1
        for mutated in lex_candidates:
            for _ in range(reps):
                add("lexical", t, mutated)

    return out


def plan_corruptions(body: str, annotation: dict, lexicon, homophones, weights: dict[str, float], count: int,
                      rng, trap_words: set[str] = frozenset(), reform: dict | None = None,
                      focus: str | None = None) -> list[dict]:
    cands = candidates(annotation, lexicon, homophones, trap_words, reform)
    weights = {k: v for k, v in weights.items() if cands.get(k)}
    chosen: list[dict] = []
    used_tokens: set[int] = set()
    # Léthé's technique is positional, not categorical (plan Decision 21): when focused, prefer
    # plants in the last third of the text, falling back to the whole pool if none qualify there.
    last_third = 2 * len(body) / 3
    while len(chosen) < count and weights:
        cat = rng.choices(list(weights), weights=list(weights.values()))[0]
        pool = [c for c in cands[cat] if all(abs(c["token"] - u) >= MIN_GAP for u in used_tokens)]
        if not pool:
            del weights[cat]
            continue
        if focus == "lethe":
            biased = [c for c in pool if c["start"] >= last_third]
            pool = biased or pool
        c = rng.choice(pool)
        chosen.append(c)
        used_tokens.add(c["token"])
    return sorted(chosen, key=lambda p: p["start"])


def apply_plants(body: str, plants: list[dict]) -> str:
    result = body
    for p in sorted(plants, key=lambda p: p["start"], reverse=True):
        result = result[:p["start"]] + p["mutated"] + result[p["end"]:]
    return result
