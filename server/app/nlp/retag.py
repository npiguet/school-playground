"""Overrule the tagger where its part of speech or morphology is certainly wrong.

The verb spotlight and the Fil d'Ariane trust the tagger's VERB calls and its Person/Number; the
French models get some of them plainly wrong. Checked against the Lexique 3.83 lexicon:

- a word tagged VERB/AUX with no verb reading at all (« une jeune pubère filiforme ») becomes the
  adjective / noun the lexicon knows;
- a word tagged VERB/AUX that is also a noun (« leur estime de soi », « une montre », « un coup de
  lance ») becomes a noun when the parse itself treats it as one: it carries a determiner or a
  preposition (`det` / `case` child), which a conjugated verb never does;
- a subject pronoun takes its person and number from the pronoun itself (both models tag « tu »
  as first person);
- a conjugated verb whose form allows a single person/number (« retrouveras ») takes it;
- a clause-initial verb with no subject and an imperative reading (« Va voir », « Élevez-le »,
  « n'allez pas ») is marked Mood=Imp: it has no written subject to look for.

Heads and dependency labels stay as parsed. A word the lexicon does not know keeps the tagger's
call. Pure: returns new token dicts.
"""
from __future__ import annotations

from app.lexicon import SPACY_TO_LEXIQUE, Lexicon
from app.nlp.chains import SUBJECT_DEPS

VERB_POS = {"VERB", "AUX"}
CHECKED_FORMS = {"Fin", "Part"}
VERBAL_CGRAMS = {"VER", "AUX"}
NOMINAL_CHILD_DEPS = {"det", "det:poss", "case"}
# Lexique category -> UD POS, in order of preference when the word has several non-verb readings.
CGRAM_POS = {"ADJ": "ADJ", "NOM": "NOUN", "ADV": "ADV", "PRE": "ADP"}
_GENDER = {"m": "Masc", "f": "Fem"}
_NUMBER = {"s": "Sing", "p": "Plur"}
_PN = {"1s": ("1", "Sing"), "2s": ("2", "Sing"), "3s": ("3", "Sing"),
       "1p": ("1", "Plur"), "2p": ("2", "Plur"), "3p": ("3", "Plur")}
FINITE_MOODS = ("ind", "cnd", "sub")
# (Person, Number) of the subject pronouns; « vous » takes a plural verb even when it means one person.
SUBJECT_PRONOUNS = {"je": ("1", "Sing"), "j'": ("1", "Sing"), "tu": ("2", "Sing"), "il": ("3", "Sing"),
                    "elle": ("3", "Sing"), "on": ("3", "Sing"), "nous": ("1", "Plur"), "vous": ("2", "Plur"),
                    "ils": ("3", "Plur"), "elles": ("3", "Plur")}
# Words that may stand before an imperative in its own clause: « n'allez pas », « ne le dis pas ».
IMPERATIVE_LEAD = {"ne", "n'", "le", "la", "les", "l'", "lui", "leur", "nous", "vous", "y", "en", "me", "m'",
                   "te", "t'"}
CLAUSE_BOUNDARY_POS = {"PUNCT", "CCONJ"}


def _cgram(entry) -> str:
    return entry.cgram.split(":")[0]


def _new_morph(entries, morph: dict) -> dict:
    """Gender/Number of the lexicon entry that agrees best with the tagger's; the tagger's own value
    fills a feature the lexicon leaves blank (« pubère » is either gender)."""
    def score(e) -> int:
        return (_GENDER.get(e.genre) == morph.get("Gender")) + (_NUMBER.get(e.nombre) == morph.get("Number"))

    entry = max(entries, key=score)
    out = {}
    gender = _GENDER.get(entry.genre, morph.get("Gender"))
    number = _NUMBER.get(entry.nombre, morph.get("Number"))
    if gender:
        out["Gender"] = gender
    if number:
        out["Number"] = number
    return out


def _retagged(t: dict, pos: str, entries) -> dict:
    morph = _new_morph(entries, t.get("morph", {})) if pos in {"ADJ", "NOUN"} else {}
    return {**t, "pos": pos, "morph": morph}


def _verb_codes(entries) -> list[str]:
    """Every « mood:tense:pn » reading of the verb entries (« ind:fut:2s »)."""
    return [c for e in entries if _cgram(e) in VERBAL_CGRAMS for c in e.infover.split(";") if c.count(":") == 2]


def _with_pn(morph: dict, pn: str) -> dict:
    person, number = _PN[pn]
    return {**morph, "Person": person, "Number": number}


def _clause_initial(tokens: list[dict], i: int) -> bool:
    j = i - 1
    while j >= 0 and tokens[j]["pos"] not in CLAUSE_BOUNDARY_POS:
        if tokens[j]["text"].lower().replace("’", "'") not in IMPERATIVE_LEAD:
            return False
        j -= 1
    return True


def _verb_morph(tokens: list[dict], t: dict, codes: list[str]) -> dict:
    morph = t.get("morph", {})
    has_subject = any(c["head"] == t["i"] and c["i"] != t["i"] and c["dep"] in SUBJECT_DEPS for c in tokens)
    imperative = sorted({c.split(":")[2] for c in codes if c.startswith("imp:")})
    if (imperative and not has_subject and t["dep"] in {"ROOT", "parataxis"}
            and _clause_initial(tokens, t["i"])):
        own = f"{morph.get('Person')}{morph.get('Number', '')[:1].lower()}"
        pn = own if own in imperative else imperative[0]
        return {**_with_pn(morph, pn), "Mood": "Imp", "Tense": "Pres"}
    base = SPACY_TO_LEXIQUE.get((morph.get("Mood"), morph.get("Tense")))
    same_tense = {c.split(":")[2] for c in codes if base and c.startswith(base + ":")}
    readings = same_tense or {c.split(":")[2] for c in codes if c.startswith(FINITE_MOODS)}
    own = f"{morph.get('Person')}{morph.get('Number', '')[:1].lower()}"
    if len(readings) == 1 and own not in readings:
        return _with_pn(morph, next(iter(readings)))
    return morph


def _subject_pronoun(t: dict) -> dict:
    word = t["text"].lower().replace("’", "'").lstrip("-")
    word = word[2:] if word.startswith("t-") else word
    pn = SUBJECT_PRONOUNS.get(word)
    if pn is None:
        return t
    return {**t, "morph": {**t.get("morph", {}), "Person": pn[0], "Number": pn[1]}}


def _retag_one(tokens: list[dict], t: dict, lexicon: Lexicon) -> dict:
    if t["pos"] == "PRON" and t["dep"] in SUBJECT_DEPS:
        return _subject_pronoun(t)
    if t["pos"] not in VERB_POS or t.get("morph", {}).get("VerbForm") not in CHECKED_FORMS:
        return t
    entries = lexicon.lookup(t["text"])
    if not entries:
        return t
    by_cgram: dict[str, list] = {}
    for e in entries:
        by_cgram.setdefault(_cgram(e), []).append(e)
    if not VERBAL_CGRAMS & by_cgram.keys():
        cgram = next((c for c in CGRAM_POS if c in by_cgram), None)
        return _retagged(t, CGRAM_POS[cgram], by_cgram[cgram]) if cgram else t
    if "NOM" in by_cgram and any(c["head"] == t["i"] and c["i"] != t["i"] and c["dep"] in NOMINAL_CHILD_DEPS
                                 for c in tokens):
        return _retagged(t, "NOUN", by_cgram["NOM"])
    if t["morph"]["VerbForm"] == "Fin":
        return {**t, "morph": _verb_morph(tokens, t, _verb_codes(entries))}
    return t


def retag(tokens: list[dict], lexicon: Lexicon) -> list[dict]:
    return [_retag_one(tokens, t, lexicon) for t in tokens]
