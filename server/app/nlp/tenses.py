"""The verb tenses a text uses, and the class that has learnt them (Plan d'études romand).

A text's class must not ask a child for a tense she has not been taught: the PER introduces the
tenses year by year (L1 26 for 5H-8H, L1 36 for 9H-11H), and a text's level is the higher of its
own level and the class that introduces its hardest tense (`level_with_tenses`). Présent, imparfait
and futur proche are 5H, so they never raise anything.

Only an unambiguous form counts. It is read from the stored annotation (no spaCy when texts are
re-levelled) and from the Lexique first, because the tagger is not reliable on tenses: the small
model tags « regarda » as a participle, « fût » as an adjective, « Viens » as a noun (app.lexicon).

- A simple tense: every verb reading the Lexique gives the form under its lemma is that one tense.
  « regarda », « prit », « fut » are passé simple; « il finit » (présent or passé simple) and « je
  mange » (indicatif, subjonctif or impératif) count for nothing. A form the Lexique also knows as
  another word (« fût » the cask, « soit » the conjunction) counts only when the tagger calls it a
  verb or a subject pronoun stands before it (« qu'il fût »).
- The passé simple's person comes from the same readings: « fut », « furent » are 3rd person (8H),
  « fus », « finîmes » 1st or 2nd (9H, « à toutes les personnes »).
- A compound tense is a past participle and its auxiliary: the participle's `aux:tense` child, or
  else the form of avoir (of être, for the verbs that take it and the pronominal ones) just before
  it, past the negation and the adverbs. Its tense is the auxiliary's Lexique tense: « a » passé
  composé, « avait » plus-que-parfait, « eut » passé antérieur, « eût » subjonctif plus-que-parfait.
  A passive (« fut tué », « la porte est fermée ») is its auxiliary's simple tense.
- The impératif is never unambiguous in the Lexique (« mange », « venez » are also indicatif), so it
  is read from the sentence: a form with an imperative reading that opens its clause (or that the
  parser makes a clause head) with no subject and no subject pronoun before it.
"""
from __future__ import annotations

from app.levels import level_index
from app.lexicon import Lexicon
from app.nlp.chains import SUBJECT_DEPS

# Each tense key: the class that introduces it (PER, research of 2026-10-02) and its French name, as
# the player sees it on a scroll's tag. Ordered from the earliest class to the latest.
TENSES: dict[str, tuple[str, str]] = {
    "futur": ("6H", "futur simple"),
    "conditionnel": ("6H", "conditionnel présent"),
    "passe_compose": ("7H", "passé composé"),
    "imperatif": ("7H", "impératif"),
    "plus_que_parfait": ("8H", "plus-que-parfait"),
    "futur_anterieur": ("8H", "futur antérieur"),
    "subjonctif": ("8H", "subjonctif présent"),
    "passe_simple_3": ("8H", "passé simple"),
    "passe_simple_12": ("9H", "passé simple (je, tu, nous, vous)"),
    "passe_anterieur": ("9H", "passé antérieur"),
    "conditionnel_passe": ("9H", "conditionnel passé"),
    "subjonctif_passe": ("9H", "subjonctif passé"),
    "subjonctif_imparfait": ("11H", "subjonctif imparfait"),
    "subjonctif_pqp": ("11H", "subjonctif plus-que-parfait"),
}

# How many unambiguous forms of a tense a text needs before that tense sets its class. One: a
# dictation asks the child to write every verb, so a single passé simple is already a form she was
# never taught. Only unambiguous forms count (above), which keeps a lone mis-read from counting.
MIN_OCCURRENCES = 1

_SIMPLE = {"ind:fut": "futur", "cnd:pre": "conditionnel", "sub:pre": "subjonctif",
           "sub:imp": "subjonctif_imparfait"}
_COMPOUND = {"ind:pre": "passe_compose", "ind:imp": "plus_que_parfait", "ind:pas": "passe_anterieur",
             "ind:fut": "futur_anterieur", "cnd:pre": "conditionnel_passe", "sub:pre": "subjonctif_passe",
             "sub:imp": "subjonctif_pqp", "imp:pre": "imperatif"}
_TENSE_AUX_DEPS = {"aux:tense", "aux"}
_VERB_POS = {"VERB", "AUX"}
_PARTICIPLE_POS = {"VERB", "AUX", "ADJ"}   # the small model tags « l'avait choisie » ADJ
_VERB_CGRAMS = ("VER", "AUX")
# The verbs whose compound tenses take être (« elle est partie »); with any other verb, être and a
# participle are a passive (« la porte est fermée »), unless the verb is pronominal (« il s'est levé »).
_ETRE_VERBS = {
    "aller", "venir", "revenir", "devenir", "parvenir", "survenir", "intervenir", "arriver", "partir",
    "repartir", "naître", "mourir", "décéder", "tomber", "retomber", "rester", "entrer", "rentrer",
    "sortir", "ressortir", "monter", "remonter", "descendre", "redescendre", "retourner", "passer",
    "apparaître",
}
_REFLEXIVE = {"me", "m'", "te", "t'", "se", "s'", "nous", "vous"}
_SUBJECT_PRONOUNS = {"je", "j'", "tu", "il", "elle", "on", "nous", "vous", "ils", "elles"}
# The negation and the object clitics, that may stand between a subject pronoun and its verb.
_CLITICS = {"ne", "n'", "me", "m'", "te", "t'", "se", "s'", "le", "la", "les", "l'", "lui", "leur", "y", "en"}
# What may stand between an auxiliary and its participle (« il n'avait pas encore fini »).
_BETWEEN_AUX = _CLITICS | {
    "pas", "plus", "jamais", "point", "rien", "guère", "bien", "déjà", "tout", "toujours", "encore",
    "souvent", "beaucoup", "trop", "vite", "enfin", "aussi", "même", "longtemps", "presque", "peut-être",
    "mieux", "mal", "sûrement", "vraiment", "ainsi", "alors", "donc",
}
_CLAUSE_OPENERS = {"«", "»", "—", "–", "-", ":", ";", "!", "?", ".", "…", '"', "(", "“", "”"}
_INVERTED = {"-je", "-tu", "-il", "-elle", "-on", "-ils", "-elles", "-t-il", "-t-elle", "-t-on"}


def _low(text: str) -> str:
    return text.lower().replace("’", "'")


def _finite(codes: frozenset[str]) -> set[str]:
    return {c for c in codes if c.count(":") == 2 and not c.startswith("par:")}


def _tenses(finite: set[str]) -> set[str]:
    return {c.rsplit(":", 1)[0] for c in finite}


class _Text:
    """One annotated text: its tokens, each token's children and Lexique verb readings."""

    def __init__(self, annotation: dict, lexicon: Lexicon) -> None:
        self.tokens: list[dict] = annotation.get("tokens", [])
        self.lexicon = lexicon
        self.children: dict[int, list[dict]] = {}
        for t in self.tokens:
            if t["head"] != t["i"]:
                self.children.setdefault(t["head"], []).append(t)
        starts = {s["start"] for s in annotation.get("sentences", [])}
        self.sentence_first = {t["i"] for t in self.tokens if t.get("start") in starts}
        self._codes: dict[int, frozenset[str]] = {}

    def codes(self, t: dict) -> frozenset[str]:
        if t["i"] not in self._codes:
            self._codes[t["i"]] = self.word_codes(t["text"], t.get("lemma"))
        return self._codes[t["i"]]

    def word_codes(self, word: str, lemma: str | None) -> frozenset[str]:
        """The form's verb readings. A form of avoir or être reads its AUX entries (plus the VER
        entries' impératif, « sois », « ayez »): Lexique files a homograph of another verb under
        être's VER entry (« étaient » there is also étayer's présent and subjonctif)."""
        codes = self.lexicon.verb_codes(word, lemma)
        entries = self.lexicon.lookup(word)
        aux = {c for e in entries if e.cgram == "AUX" for c in e.infover.split(";") if c and c != "inf"}
        verb_lemmas = {e.lemme for e in entries if e.cgram.split(":")[0] in _VERB_CGRAMS}
        if aux and verb_lemmas <= {"avoir", "être"}:
            return frozenset(aux | {c for c in codes if c.startswith("imp:")})
        return codes

    def kids(self, t: dict) -> list[dict]:
        return self.children.get(t["i"], [])

    def verb_only(self, t: dict) -> bool:
        """The Lexique knows the word as a verb and as nothing else."""
        entries = self.lexicon.lookup(t["text"])
        return bool(entries) and all(e.cgram.split(":")[0] in _VERB_CGRAMS for e in entries)

    def before(self, t: dict, skip: set[str]) -> dict | None:
        """The token before t past the words in `skip` (and inverted pronouns « -il »), within its sentence."""
        j = t["i"] - 1
        while j >= 0 and j + 1 not in self.sentence_first and (
                _low(self.tokens[j]["text"]) in skip or self.tokens[j]["text"].startswith("-")):
            j -= 1
        if j < 0 or j + 1 in self.sentence_first:
            return None
        return self.tokens[j]

    def after_subject_pronoun(self, t: dict) -> bool:
        prev = self.before(t, _CLITICS)
        return prev is not None and _low(prev["text"]) in _SUBJECT_PRONOUNS

    def auxiliary_lemma(self, t: dict) -> str | None:
        """« avoir » or « être » when t is a finite form of one of them (never a participle « eu », « été »)."""
        lemmas = {e.lemme for e in self.lexicon.lookup(t["text"])} & {"avoir", "être"}
        if len(lemmas) != 1:
            return None
        (lemma,) = lemmas
        return lemma if _finite(self.word_codes(t["text"], lemma)) else None


def _is_participle(text: _Text, t: dict) -> bool:
    if any(c["dep"] in _TENSE_AUX_DEPS for c in text.kids(t)):
        return True
    codes = text.codes(t)
    # « plus » (plaire) and « tu » (taire) are participles too, never in « je n'ai plus », « as-tu ».
    if "par:pas" not in codes or t["pos"] not in _PARTICIPLE_POS:
        return False
    # « pris », « mis », « dit » are also finite forms: a subject pronoun just before (« je pris »)
    # or the tagger (VerbForm) says which.
    if not _finite(codes):
        return True
    return t.get("morph", {}).get("VerbForm") != "Fin" and not text.after_subject_pronoun(t)


def _is_reflexive(t: dict | None) -> bool:
    """A reflexive pronoun: « se », « me », « te »; « nous », « vous » unless they are the subject
    (« vous vous êtes levés », not « vous serez hachés »)."""
    if t is None:
        return False
    word = _low(t["text"])
    return word in _REFLEXIVE and (word not in ("nous", "vous") or t["dep"] not in SUBJECT_DEPS)


def _auxiliary(text: _Text, p: dict) -> dict | None:
    """The auxiliary of participle p's compound tense; None for a participle without one, or a passive."""
    kids = [c for c in text.kids(p) if text.auxiliary_lemma(c)]
    aux = next((c for c in kids if c["dep"] in _TENSE_AUX_DEPS), None) \
        or next((c for c in kids if c["dep"] == "aux:pass"), None) \
        or text.before(p, _BETWEEN_AUX)
    if aux is None:
        return None
    lemma = text.auxiliary_lemma(aux)
    if lemma == "avoir":
        return aux
    if lemma == "être":
        # A compound tense of a verb that takes être, or of a pronominal verb; else a passive
        # (« la porte est fermée », « vous serez hachés »), whatever the parser called the auxiliary.
        verbs = {p.get("lemma")} | {e.lemme for e in text.lexicon.lookup(p["text"])
                                    if e.cgram.split(":")[0] in _VERB_CGRAMS}
        if verbs & _ETRE_VERBS or _is_reflexive(text.before(aux, _BETWEEN_AUX - _REFLEXIVE)):
            return aux
    return None


def _compound_key(text: _Text, aux: dict) -> str | None:
    lemma = text.auxiliary_lemma(aux)
    tenses = _tenses(_finite(text.word_codes(aux["text"], lemma)))
    if len(tenses) > 1:
        tenses.discard("imp:pre")   # « aie », « ayez » as auxiliaries are subjonctif
    return _COMPOUND.get(next(iter(tenses))) if len(tenses) == 1 else None


def _passe_simple(finite: set[str]) -> str:
    # The person is the code's last character but one; a form that may be 3rd person counts as 3rd.
    return "passe_simple_3" if any(c[-2] == "3" for c in finite) else "passe_simple_12"


def _looks_imperative(text: _Text, t: dict) -> bool:
    if any(c["dep"] in SUBJECT_DEPS for c in text.kids(t)):
        return False
    tokens = text.tokens
    nxt = _low(tokens[t["i"] + 1]["text"]) if t["i"] + 1 < len(tokens) else ""
    if nxt in _INVERTED:
        return False
    if nxt in ("-nous", "-vous"):   # « Venez-vous ? » asks, « Dépêchez-vous ! » orders
        end = next((x["text"] for x in tokens[t["i"]:] if x["text"] in (".", "!", "?", "…")), "")
        if end == "?":
            return False
    prev = text.before(t, _CLITICS)   # « Ne regarde pas »: the negation opens the clause too
    if prev is not None:
        if _low(prev["text"]) in _SUBJECT_PRONOUNS:
            return False
        if _low(prev["text"]) not in _CLAUSE_OPENERS:
            # Mid-clause: only the parser can tell an order from a verb whose subject is elsewhere.
            return t["pos"] in _VERB_POS and t["dep"] in ("ROOT", "parataxis")
    return t["pos"] in _VERB_POS or text.verb_only(t)


def tense_forms(annotation: dict, lexicon: Lexicon) -> list[tuple[str, str]]:
    """Every unambiguous form of a tense above 5H in the annotated text, in text order, as (tense
    key, the form as written: « regarda », « avait marché »)."""
    text = _Text(annotation, lexicon)
    found: list[tuple[int, str, str]] = []

    auxiliaries: set[int] = set()
    participles: set[int] = set()
    for t in text.tokens:
        if t["pos"] == "PUNCT" or not _is_participle(text, t):
            continue
        participles.add(t["i"])
        aux = _auxiliary(text, t)
        if aux is not None and aux["i"] not in auxiliaries:   # « a été construite »: one tense, two participles
            auxiliaries.add(aux["i"])
            key = _compound_key(text, aux)
            if key is not None:
                found.append((aux["i"], key, f"{aux['text']} {t['text']}"))

    for t in text.tokens:
        if t["i"] in auxiliaries or t["i"] in participles:
            continue   # a passive's auxiliary is a verb of its own: « fut tué », « serez hachés »
        finite = _finite(text.codes(t))
        if not finite:
            continue
        if not (text.verb_only(t) or text.after_subject_pronoun(t)
                or (t["pos"] in _VERB_POS and any(c["dep"] in SUBJECT_DEPS for c in text.kids(t)))):
            continue   # « le fût », « soit... soit »: another word the Lexique also knows
        tenses = _tenses(finite)
        key: str | None = None
        if len(tenses) == 1:
            (tense,) = tenses
            if tense == "ind:pas":
                key = _passe_simple(finite)
            elif tense == "imp:pre":
                key = "imperatif" if _looks_imperative(text, t) else None
            else:
                key = _SIMPLE.get(tense)
        elif "imp:pre" in tenses and tenses <= {"imp:pre", "ind:pre", "sub:pre"} and _looks_imperative(text, t):
            key = "imperatif"
        if key is not None:
            found.append((t["i"], key, t["text"]))
    return [(key, form) for _, key, form in sorted(found)]


def detect_tenses(annotation: dict, lexicon: Lexicon) -> dict[str, int]:
    """How many unambiguous forms of each tense above 5H the annotated text holds (TENSES' keys)."""
    counts: dict[str, int] = {}
    for key, _ in tense_forms(annotation, lexicon):
        counts[key] = counts.get(key, 0) + 1
    return dict(sorted(counts.items()))


def _counted(counts: dict[str, int], least: int) -> list[str]:
    return [k for k in TENSES if counts.get(k, 0) >= least]


def tense_level(counts: dict[str, int], least: int = MIN_OCCURRENCES) -> str | None:
    """The class that introduces the text's hardest tense (counted `least` times or more); None when
    all its tenses are 5H ones."""
    keys = _counted(counts, least)
    return max((TENSES[k][0] for k in keys), key=level_index) if keys else None


def level_with_tenses(base_level: str, counts: dict[str, int], least: int = MIN_OCCURRENCES) -> str:
    """The text's level: its own level (chosen by hand, or by the Alexandria scoring) raised to the
    class of its hardest tense, never lowered."""
    tl = tense_level(counts, least)
    return tl if tl is not None and level_index(tl) > level_index(base_level) else base_level


def tense_reason(base_level: str, counts: dict[str, int], least: int = MIN_OCCURRENCES) -> str | None:
    """The tenses that raised the text above its own level, in French (« passé simple »); None when
    its tenses raised nothing."""
    tl = tense_level(counts, least)
    if tl is None or level_index(tl) <= level_index(base_level):
        return None
    return ", ".join(TENSES[k][1] for k in _counted(counts, least) if TENSES[k][0] == tl)
