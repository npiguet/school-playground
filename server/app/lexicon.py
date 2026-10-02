"""Lexique 3.83 lexicon: lookups for inflected forms, sound-alikes and agreement flips.

Reads the vendored, trimmed derivation at content/lexique/lexique383-trimmed.tsv.gz
(see content/lexique/README.md and LICENSE.md). Used to classify irregular forms and
generate sibling inflections / sound-alikes for annotation, without shipping the full
lexicon to the browser.
"""
from __future__ import annotations

import csv
import gzip
import hashlib
import threading
from collections import OrderedDict
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from types import MappingProxyType


@dataclass(frozen=True, slots=True)
class Entry:
    ortho: str
    phon: str
    lemme: str
    cgram: str
    genre: str
    nombre: str
    infover: str
    freq: float


ELISIONS = ("l'", "d'", "qu'", "j'", "n'", "m'", "t'", "s'", "c'")

# Lexique spells the ligatures out (« soeur », « coeur », « boeufs »): every word and lemma is looked
# up folded, and a form found for a word written with the ligature is given it back (« sœurs »).
_LIGATURES = str.maketrans({"œ": "oe", "æ": "ae"})


def _fold(word: str) -> str:
    return word.lower().replace("’", "'").translate(_LIGATURES)


def _restyle(word: str, form: str) -> str:
    low = word.lower()
    if "œ" in low:
        form = form.replace("oe", "œ")
    if "æ" in low:
        form = form.replace("ae", "æ")
    return form

DET_NUMBER = {
    "le": "les", "la": "les", "un": "des", "une": "des", "ce": "ces", "cet": "ces", "cette": "ces",
    "mon": "mes", "ma": "mes", "ton": "tes", "ta": "tes", "son": "ses", "sa": "ses",
    "notre": "nos", "votre": "vos", "leur": "leurs", "au": "aux", "du": "des",
    "quel": "quels", "quelle": "quelles", "tout": "tous", "toute": "toutes",
}  # reverse direction is gender-aware, see flip_number

DET_NUMBER_REVERSE = {
    "les": ("le", "la"), "des": ("un", "une"), "ces": ("ce", "cette"), "mes": ("mon", "ma"),
    "tes": ("ton", "ta"), "ses": ("son", "sa"), "nos": ("notre", "notre"), "vos": ("votre", "votre"),
    "leurs": ("leur", "leur"), "aux": ("au", "au"), "quels": ("quel", "quel"), "quelles": ("quelle", "quelle"),
    "tous": ("tout", "tout"), "toutes": ("toute", "toute"),
}

DET_GENDER = {
    "le": "la", "un": "une", "ce": "cette", "cet": "cette", "mon": "ma", "ton": "ta", "son": "sa",
    "quel": "quelle", "quels": "quelles", "tout": "toute", "tous": "toutes",
    "nouveau": "nouvelle", "beau": "belle", "vieux": "vieille",
}  # + reverse map built below; "ce"/"cet" both flip to "cette" (many-to-one), handled specially below

# "ce" and "cet" both map to "cette" in DET_GENDER, so a naive reverse loses "ce". "cette" is
# excluded here and resolved by _masculine_demonstrative(next_word) instead.
DET_GENDER_REVERSE = {v: k for k, v in DET_GENDER.items() if k not in ("ce", "cet")}

# Nouns whose other-gender counterpart Lexique files under another lemma, or that are another word
# altogether (masculine, feminine). « La dieu » reads as « Le dieu » or as « La déesse »: the noun's
# gender is not fixed, so a gender slip around it has two repairs (Grimoire ambiguity, ruling R1).
NOUN_GENDER_PAIRS = (
    ("dieu", "déesse"), ("roi", "reine"), ("oncle", "tante"), ("ogre", "ogresse"), ("prince", "princesse"),
    ("héros", "héroïne"), ("homme", "femme"), ("mari", "femme"), ("père", "mère"), ("frère", "sœur"),
    ("fils", "fille"), ("garçon", "fille"), ("maître", "maîtresse"), ("comte", "comtesse"),
    ("duc", "duchesse"), ("empereur", "impératrice"), ("neveu", "nièce"), ("époux", "épouse"),
    ("parrain", "marraine"), ("monsieur", "madame"), ("seigneur", "dame"), ("gendre", "bru"),
    ("papa", "maman"), ("grand-père", "grand-mère"), ("compagnon", "compagne"), ("serviteur", "servante"),
    ("tigre", "tigresse"), ("âne", "ânesse"), ("poète", "poétesse"), ("prêtre", "prêtresse"),
    ("hôte", "hôtesse"), ("abbé", "abbesse"), ("pape", "papesse"), ("damoiseau", "demoiselle"),
    ("jumeau", "jumelle"), ("vieillard", "vieille"), ("cheval", "jument"), ("bouc", "chèvre"),
    ("taureau", "vache"), ("bélier", "brebis"), ("coq", "poule"), ("cerf", "biche"), ("sanglier", "laie"),
    ("lièvre", "hase"), ("jars", "oie"), ("mâle", "femelle"), ("chanoine", "chanoinesse"),
    ("sorcier", "sorcière"), ("magicien", "magicienne"), ("berger", "bergère"), ("dauphin", "dauphine"),
    ("tsar", "tsarine"), ("chasseur", "chasseresse"), ("vengeur", "vengeresse"), ("docteur", "doctoresse"),
    ("diable", "diablesse"), ("traître", "traîtresse"), ("druide", "druidesse"), ("prophète", "prophétesse"),
    ("pauvre", "pauvresse"),
)
# Keyed as Lexique spells the lemmas it is matched against (« soeur »); the values keep the ligature.
_GENDER_PAIR_OF: dict[str, set[str]] = {}
for _m, _f in NOUN_GENDER_PAIRS:
    _GENDER_PAIR_OF.setdefault(_m.translate(_LIGATURES), set()).add(_f)
    _GENDER_PAIR_OF.setdefault(_f.translate(_LIGATURES), set()).add(_m)

# Small, deliberately conservative list of common "h muet" words (liaison applies, so the
# masculine demonstrative is "cet"). Absent from this list, an h-initial word is treated as
# "h aspiré" (no liaison, "ce"), per the ruling: "if unsure, choose 'ce' for h".
_MUTE_H_WORDS = {
    "homme", "heure", "hiver", "histoire", "horizon", "hôtel", "habit", "herbe", "huile",
    "humain", "hôpital", "habitude", "horaire",
}
_VOWELS_OR_MUTE_H = set("aeiouyàâäéèêëïîôöùûüœ")


def _masculine_demonstrative(next_word: str | None) -> str:
    """"cette" flipped to masculine: "cet" before a vowel sound (incl. mute h), else "ce"."""
    if not next_word:
        return "ce"
    w = next_word.lower().lstrip("'’")
    if not w:
        return "ce"
    if w[0] in _VOWELS_OR_MUTE_H:
        return "cet"
    if w[0] == "h" and w in _MUTE_H_WORDS:
        return "cet"
    return "ce"

SPACY_TO_LEXIQUE = {
    ("Ind", "Pres"): "ind:pre", ("Ind", "Imp"): "ind:imp", ("Ind", "Past"): "ind:pas", ("Ind", "Fut"): "ind:fut",
    ("Cnd", "Pres"): "cnd:pre", ("Sub", "Pres"): "sub:pre", ("Sub", "Imp"): "sub:imp", ("Imp", "Pres"): "imp:pre",
}

_PERSON_NUMBER = {("1", "Sing"): "1s", ("2", "Sing"): "2s", ("3", "Sing"): "3s",
                   ("1", "Plur"): "1p", ("2", "Plur"): "2p", ("3", "Plur"): "3p"}

_INFLECTED_CGRAM_PREFIXES = ("NOM", "ADJ", "VER", "AUX")

_GENDER_MAP = {"Masc": "m", "Fem": "f"}


def verb_code(morph: dict) -> str | None:
    """{"Mood":"Ind","Tense":"Pres","Person":"3","Number":"Plur"} -> "ind:pre:3p"; None when incomplete."""
    mood = morph.get("Mood")
    tense = morph.get("Tense")
    person = morph.get("Person")
    number = morph.get("Number")
    base = SPACY_TO_LEXIQUE.get((mood, tense))
    pn = _PERSON_NUMBER.get((person, number))
    if base is None or pn is None:
        return None
    return f"{base}:{pn}"


def _frozen(index: Mapping[str, Sequence[Entry]]) -> Mapping[str, tuple[Entry, ...]]:
    return MappingProxyType({k: tuple(v) for k, v in index.items()})


class Lexicon:
    """Read-only: one instance is shared by every caller (and every test) that loads the same file."""

    def __init__(self, by_ortho: Mapping[str, Sequence[Entry]], by_lemme: Mapping[str, Sequence[Entry]],
                 by_phon: Mapping[str, Sequence[Entry]]) -> None:
        self.by_ortho = _frozen(by_ortho)
        self.by_lemme = _frozen(by_lemme)
        self.by_phon = _frozen(by_phon)

    def lookup(self, word: str) -> tuple[Entry, ...]:
        w = _fold(word)
        hit = self.by_ortho.get(w)
        if hit:
            return hit
        for p in ELISIONS:
            if w.startswith(p):
                return self.by_ortho.get(w[len(p):], ())
        return ()

    def is_known(self, word: str) -> bool:
        return bool(self.lookup(word))

    def verb_codes(self, word: str) -> frozenset[str]:
        """Every verb reading of the word (VER and AUX entries, under every lemma), as Lexique codes:
        finite ones (« regarda » → ind:pas:3s) and « par:pas » for a past participle, never « inf ».
        A homograph of two verbs keeps both (« vit »: vivre ind:pre:3s and voir ind:pas:3s): the tense
        reading (app.nlp.tenses) must not trust spaCy's lemma. Empty when the word is no verb."""
        return frozenset(c for e in self.lookup(word) if e.cgram.split(":")[0] in ("VER", "AUX")
                         for c in e.infover.split(";") if c and c != "inf")

    def _candidate_lemmas(self, word: str, lemma: str | None) -> list[str]:
        """The lemma to search under: the given spaCy lemma when the lexicon knows it and it is one of
        the word's own lemmas (or the word is unknown), else every lemma of the word's own entries.
        A spaCy lemma foreign to the word (« enfant » lemmatised « enfer ») would flip it into
        another word."""
        own = sorted({e.lemme for e in self.lookup(word)})
        lemma = lemma.translate(_LIGATURES) if lemma else lemma   # spaCy says « sœur », Lexique « soeur »
        if lemma and lemma in self.by_lemme and (not own or lemma in own):
            return [lemma]
        return own

    def _own_features(self, word: str, cgram_prefixes: tuple[str, ...], morph: dict) -> tuple[str | None, str | None]:
        """Resolve (genre, nombre) for word's own entries restricted to cgram_prefixes.

        Among several candidate entries (e.g. a NOM/VER homograph), prefers the one
        agreeing with morph's Gender/Number. Lexique leaves genre blank for genuinely
        gender-ambiguous nouns (le/la poste); in that case, and whenever the chosen
        entry has no value for a feature, falls back to morph rather than guessing.
        """
        candidates = [e for e in self.lookup(word) if e.cgram.split(":")[0] in cgram_prefixes]
        morph_genre = _GENDER_MAP.get(morph.get("Gender"))
        morph_nombre = {"Sing": "s", "Plur": "p"}.get(morph.get("Number"))
        entry: Entry | None = None
        if candidates:
            def score(e: Entry) -> int:
                s = 0
                if morph_genre and e.genre == morph_genre:
                    s += 1
                if morph_nombre and e.nombre == morph_nombre:
                    s += 1
                return s
            entry = max(candidates, key=score) if len(candidates) > 1 else candidates[0]
        genre = (entry.genre if entry else "") or morph_genre
        nombre = (entry.nombre if entry else "") or morph_nombre
        return genre, nombre

    def forms_of(self, word: str, lemma: str | None = None, limit: int = 12) -> dict[str, dict]:
        w = _fold(word)
        lemmas = self._candidate_lemmas(word, lemma)
        own = self.lookup(word)
        finite = [c for e in own if e.lemme in lemmas
                  for c in e.infover.split(";") if c and c != "inf" and not c.startswith("par:")]
        # Infinitive spellings are excluded even when a homograph of a different cgram
        # (e.g. the archaic noun "le manger") shares the verb's lemma and ortho.
        infinitives = {e.ortho for l in lemmas for e in self.by_lemme.get(l, [])
                       if e.cgram.split(":")[0] in ("VER", "AUX") and e.infover == "inf"}

        candidates: list[Entry] = []
        for l in lemmas:
            for e in self.by_lemme.get(l, []):
                if e.ortho == w or e.ortho in infinitives:
                    continue
                cgram_prefix = e.cgram.split(":")[0]
                if cgram_prefix not in _INFLECTED_CGRAM_PREFIXES:
                    continue
                if e.infover == "inf":
                    continue
                if cgram_prefix in ("VER", "AUX"):
                    codes = [c for c in e.infover.split(";") if c]
                    if "par:pas" in codes:
                        candidates.append(e)
                        continue
                    if finite:
                        keep = False
                        for fc in finite:
                            fparts = fc.split(":")
                            if len(fparts) < 3 or len(fparts[-1]) < 2:
                                continue
                            f_mood_tense_person = fparts[:-1] + [fparts[-1][:-1]]
                            f_num = fparts[-1][-1]
                            for code in codes:
                                cparts = code.split(":")
                                if len(cparts) < 3 or len(cparts[-1]) < 2:
                                    continue
                                c_mood_tense_person = cparts[:-1] + [cparts[-1][:-1]]
                                c_num = cparts[-1][-1]
                                if c_mood_tense_person == f_mood_tense_person and c_num != f_num:
                                    keep = True
                                    break
                            if keep:
                                break
                        if keep:
                            candidates.append(e)
                    continue
                candidates.append(e)

        best: dict[str, Entry] = {}
        for e in candidates:
            cur = best.get(e.ortho)
            if cur is None or e.freq > cur.freq:
                best[e.ortho] = e

        result: dict[str, dict] = {}
        for e in sorted(best.values(), key=lambda e: -e.freq):
            cgram_prefix = e.cgram.split(":")[0]
            if cgram_prefix in ("VER", "AUX"):
                codes = [c for c in e.infover.split(";") if c]
                if "par:pas" in codes:
                    g = e.genre or None
                    n = e.nombre or None
                else:
                    g = None
                    n = None
                    for code in codes:
                        if code and code[-1] in ("s", "p"):
                            n = code[-1]
                            break
            else:
                g = e.genre or None
                n = e.nombre or None
            result[e.ortho] = {"g": g, "n": n}

        return {_restyle(word, form): v for form, v in list(result.items())[:limit]}

    def sound_alikes(self, word: str, min_freq: float = 0.5, limit: int = 5) -> list[str]:
        w = _fold(word)
        phons = {e.phon for e in self.lookup(word)}
        best: dict[str, float] = {}
        for p in phons:
            for e in self.by_phon.get(p, []):
                if e.ortho == w or e.freq < min_freq:
                    continue
                if e.ortho not in best or e.freq > best[e.ortho]:
                    best[e.ortho] = e.freq
        ordered = sorted(best.items(), key=lambda kv: -kv[1])
        return [_restyle(word, ortho) for ortho, _ in ordered[:limit]]

    def _flip_verb_number(self, word: str, lemma: str, morph: dict) -> str | None:
        """The same finite form in the other number, keeping mood, tense and person.

        The codes to flip are the word's OWN Lexique codes, never one built from spaCy's morph
        alone: the small model mis-tags tenses (« coupaient » as Pres, « étalaient » as Past), and
        a code taken from morph then picked « coupe » / « étala » — a tense change planted as an
        "agreement" error (SP2 playability P1-4). spaCy's morph only helps choose among the word's
        own codes (an ambiguous « mange » is 1s/3s/imperative 2s). None when the lexicon does not
        know the word as a finite verb or has no form differing only in number."""
        lemmas = self._candidate_lemmas(word, lemma)
        own_codes = sorted({c for e in self.lookup(word)
                            if e.lemme in lemmas and e.cgram.split(":")[0] in ("VER", "AUX")
                            for c in e.infover.split(";")
                            if c and c != "inf" and not c.startswith("par:") and c[-1] in "sp"})
        if not own_codes:
            return None
        number = {"Sing": "s", "Plur": "p"}.get(morph.get("Number"))
        person = morph.get("Person")
        spacy_code = verb_code(morph)
        if spacy_code in own_codes:
            codes = [spacy_code]
        else:
            codes = [c for c in own_codes if (number is None or c[-1] == number) and (person is None or c[-2] == person)]
            if not codes:
                codes = [c for c in own_codes if number is None or c[-1] == number]
            if not codes:
                codes = own_codes
        targets = {c[:-1] + ("s" if c.endswith("p") else "p") for c in codes}
        best: Entry | None = None
        for l in lemmas:
            for e in self.by_lemme.get(l, []):
                if e.cgram.split(":")[0] not in ("VER", "AUX"):
                    continue
                if targets & set(e.infover.split(";")) and (best is None or e.freq > best.freq):
                    best = e
        return best.ortho if best is not None else None

    def flip_number(self, word: str, lemma: str, morph: dict) -> str | None:
        w = _fold(word)
        result: str | None = None

        if w in DET_NUMBER:
            result = DET_NUMBER[w]
        elif w in DET_NUMBER_REVERSE:
            masc, fem = DET_NUMBER_REVERSE[w]
            result = fem if morph.get("Gender") == "Fem" else masc

        tagged_participle = morph.get("VerbForm") == "Part"
        if result is None and not tagged_participle:
            result = self._flip_verb_number(word, lemma, morph)  # « finis » tagged Part stays a participle

        if result is None:
            # Nouns, adjectives and past participles (under the verb's lemma: « parties » → « partie »).
            # A past participle is a word tagged as one, or a word the lexicon knows as a participle and
            # never as a finite form (« vu » mis-tagged finite); never a finite form whose flip failed above.
            codes = {c for e in self.lookup(word) for c in e.infover.split(";") if c}
            finite = any(c.count(":") == 2 and not c.startswith("par:") for c in codes)
            participle = "par:pas" in codes and (tagged_participle or not finite)
            kinds = ("NOM", "ADJ", "VER", "AUX") if participle else ("NOM", "ADJ")
            genre, own_nombre = self._own_features(word, kinds, morph)
            target_nombre = "p" if own_nombre == "s" else ("s" if own_nombre == "p" else None)
            if target_nombre is not None:
                lemmas = self._candidate_lemmas(word, lemma)
                best = None
                for l in lemmas:
                    for e in self.by_lemme.get(l, []):
                        cgram_prefix = e.cgram.split(":")[0]
                        if cgram_prefix not in kinds:
                            continue
                        if cgram_prefix in ("VER", "AUX") and "par:pas" not in e.infover.split(";"):
                            continue
                        if e.nombre != target_nombre:
                            continue
                        # A blank genre on the candidate means Lexique itself leaves the
                        # noun's gender ambiguous (e.g. poste/postes); treat it as a
                        # wildcard rather than excluding a valid match.
                        if genre is not None and e.genre and e.genre != genre:
                            continue
                        if best is None or e.freq > best.freq:
                            best = e
                if best is not None:
                    result = best.ortho

        if result is None or result == w:
            return None
        return _restyle(word, result)

    def flip_gender(self, word: str, lemma: str, morph: dict, next_word: str | None = None) -> str | None:
        w = _fold(word)
        result: str | None = None

        if w == "cette":
            result = _masculine_demonstrative(next_word)
        elif w in DET_GENDER:
            result = DET_GENDER[w]
        elif w in DET_GENDER_REVERSE:
            result = DET_GENDER_REVERSE[w]

        if result is None:
            genre, nombre = self._own_features(word, ("NOM", "ADJ", "VER", "AUX"), morph)
            target_genre = "f" if genre == "m" else ("m" if genre == "f" else None)
            if target_genre is not None:
                lemmas = self._candidate_lemmas(word, lemma)
                best: Entry | None = None
                for l in lemmas:
                    for e in self.by_lemme.get(l, []):
                        cgram_prefix = e.cgram.split(":")[0]
                        if cgram_prefix not in ("NOM", "ADJ", "VER", "AUX"):
                            continue
                        if cgram_prefix in ("VER", "AUX") and "par:pas" not in e.infover.split(";"):
                            continue
                        # The target gender must be a definite match: an entry with no
                        # genre at all (ambiguous noun) is never a valid gender flip.
                        if e.genre != target_genre:
                            continue
                        if nombre is not None and e.nombre and e.nombre != nombre:
                            continue
                        if best is None or e.freq > best.freq:
                            best = e
                if best is not None:
                    result = best.ortho

        if result is None or result == w:
            return None
        return _restyle(word, result)

    def gender_counterparts(self, word: str, lemma: str | None = None) -> set[str]:
        """The noun's forms in the other gender, same number: « lion » → « lionne » (one lemma in
        Lexique), « dieu » → « déesse », « rois » → « reines », « sœurs » → « frères »
        (NOUN_GENDER_PAIRS). Empty for a noun whose gender is fixed (« rocher »).

        The pair table is the only source beyond Lexique's own lemmas: suffix rules (-esse, -euse,
        -trice, -ine) pair unrelated nouns (jeune / jeunesse, riche / richesse, serpent / serpentine,
        machine / « mach »), so the real pairs are listed instead."""
        w = _fold(word)
        out: set[str] = set()
        same_lemma = self.flip_gender(word, lemma or w, {})
        if same_lemma:
            out.add(same_lemma)
        for e in self.lookup(word):
            if e.cgram.split(":")[0] != "NOM":
                continue
            for other in _GENDER_PAIR_OF.get(e.lemme.lower(), set()):
                plural = self.flip_number(other, other, {"Number": "Sing"}) or other
                if e.nombre != "p":
                    out.add(other)
                if e.nombre != "s":
                    out.add(plural)  # « fils » is both numbers: « fille » and « filles »
        return {o for o in out if _fold(o) != w}


@lru_cache(maxsize=16)
def _file_digest(resolved: str, size: int, mtime_ns: int) -> str:
    """The content hash of one file version (size and mtime are in the key so an edit rehashes)."""
    with open(resolved, "rb") as f:
        return hashlib.file_digest(f, "sha256").hexdigest()


_lexicons: OrderedDict[str, Lexicon] = OrderedDict()
_LEXICONS_KEPT = 4   # the real one plus a test's small hand-written ones, without evicting it
_lexicons_lock = threading.Lock()


def load_lexicon(content_dir: Path) -> Lexicon:
    """The lexicon of content_dir/lexique, built once per distinct file content and shared read-only.

    Keyed on the file's content hash, not on content_dir: every server test copies the same file into
    its own tmp_path, and a build is ~1M objects (the process's largest allocate-and-free burst, see
    the segfault report). A test that needs another lexicon writes another file, or builds a Lexicon."""
    path = Path(content_dir) / "lexique" / "lexique383-trimmed.tsv.gz"
    resolved = path.resolve()
    st = resolved.stat()
    digest = _file_digest(str(resolved), st.st_size, st.st_mtime_ns)
    with _lexicons_lock:   # two cold requests at once build it once, not twice
        lexicon = _lexicons.get(digest)
        if lexicon is None:
            lexicon = _build_lexicon(resolved)
            _lexicons[digest] = lexicon
            while len(_lexicons) > _LEXICONS_KEPT:
                _lexicons.popitem(last=False)
        _lexicons.move_to_end(digest)
        return lexicon


def _build_lexicon(path: Path) -> Lexicon:
    by_ortho: dict[str, list[Entry]] = {}
    by_lemme: dict[str, list[Entry]] = {}
    by_phon: dict[str, list[Entry]] = {}
    with gzip.open(path, "rt", encoding="utf-8", newline="") as f:
        reader = csv.reader(f, delimiter="\t")
        next(reader)  # header
        for row in reader:
            ortho, phon, lemme, cgram, genre, nombre, infover, freq = row
            entry = Entry(ortho=ortho, phon=phon, lemme=lemme, cgram=cgram, genre=genre,
                          nombre=nombre, infover=infover, freq=float(freq))
            by_ortho.setdefault(entry.ortho, []).append(entry)
            by_lemme.setdefault(entry.lemme, []).append(entry)
            by_phon.setdefault(entry.phon, []).append(entry)
    return Lexicon(by_ortho, by_lemme, by_phon)
