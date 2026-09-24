"""Lexique 3.83 lexicon: lookups for inflected forms, sound-alikes and agreement flips.

Reads the vendored, trimmed derivation at content/lexique/lexique383-trimmed.tsv.gz
(see content/lexique/README.md and LICENSE.md). Used to classify irregular forms and
generate sibling inflections / sound-alikes for annotation, without shipping the full
lexicon to the browser.
"""
from __future__ import annotations

import csv
import gzip
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


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
}  # + reverse map built below

DET_GENDER_REVERSE = {v: k for k, v in DET_GENDER.items()}

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


class Lexicon:
    def __init__(self, by_ortho: dict[str, list[Entry]], by_lemme: dict[str, list[Entry]],
                 by_phon: dict[str, list[Entry]]) -> None:
        self.by_ortho = by_ortho
        self.by_lemme = by_lemme
        self.by_phon = by_phon

    def lookup(self, word: str) -> list[Entry]:
        w = word.lower().replace("’", "'")
        hit = self.by_ortho.get(w)
        if hit:
            return hit
        for p in ELISIONS:
            if w.startswith(p):
                return self.by_ortho.get(w[len(p):], [])
        return []

    def is_known(self, word: str) -> bool:
        return bool(self.lookup(word))

    def forms_of(self, word: str, lemma: str | None = None, limit: int = 12) -> dict[str, dict]:
        w = word.lower().replace("’", "'")
        if lemma and lemma in self.by_lemme:
            lemmas = [lemma]
        else:
            lemmas = sorted({e.lemme for e in self.lookup(word)})
        own = self.lookup(word)
        finite = [c for e in own for c in e.infover.split(";") if c and c != "inf" and not c.startswith("par:")]
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

        return dict(list(result.items())[:limit])

    def sound_alikes(self, word: str, min_freq: float = 0.5, limit: int = 5) -> list[str]:
        w = word.lower().replace("’", "'")
        phons = {e.phon for e in self.lookup(word)}
        best: dict[str, float] = {}
        for p in phons:
            for e in self.by_phon.get(p, []):
                if e.ortho == w or e.freq < min_freq:
                    continue
                if e.ortho not in best or e.freq > best[e.ortho]:
                    best[e.ortho] = e.freq
        ordered = sorted(best.items(), key=lambda kv: -kv[1])
        return [ortho for ortho, _ in ordered[:limit]]

    def flip_number(self, word: str, lemma: str, morph: dict) -> str | None:
        w = word.lower().replace("’", "'")
        result: str | None = None

        if w in DET_NUMBER:
            result = DET_NUMBER[w]
        elif w in DET_NUMBER_REVERSE:
            masc, fem = DET_NUMBER_REVERSE[w]
            result = fem if morph.get("Gender") == "Fem" else masc

        if result is None:
            code = verb_code(morph)
            if code is not None:
                target = code[:-1] + ("s" if code.endswith("p") else "p")
                lemmas = [lemma] if lemma and lemma in self.by_lemme else sorted({e.lemme for e in self.lookup(word)})
                best: Entry | None = None
                for l in lemmas:
                    for e in self.by_lemme.get(l, []):
                        if e.cgram.split(":")[0] not in ("VER", "AUX"):
                            continue
                        if target in e.infover.split(";"):
                            if best is None or e.freq > best.freq:
                                best = e
                if best is not None:
                    result = best.ortho

        if result is None:
            own = self.lookup(word)
            own_entry = next((e for e in own if e.cgram.split(":")[0] in ("NOM", "ADJ")), None)
            genre = None
            if own_entry is not None:
                genre = own_entry.genre or None
            elif morph.get("Gender") in _GENDER_MAP:
                genre = _GENDER_MAP[morph["Gender"]]
            own_nombre = own_entry.nombre if own_entry is not None else morph.get("Number")
            if own_nombre in ("Sing",):
                own_nombre = "s"
            elif own_nombre in ("Plur",):
                own_nombre = "p"
            target_nombre = "p" if own_nombre == "s" else ("s" if own_nombre == "p" else None)
            if target_nombre is not None:
                lemmas = [lemma] if lemma and lemma in self.by_lemme else sorted({e.lemme for e in self.lookup(word)})
                best = None
                for l in lemmas:
                    for e in self.by_lemme.get(l, []):
                        if e.cgram.split(":")[0] not in ("NOM", "ADJ"):
                            continue
                        if e.nombre != target_nombre:
                            continue
                        if genre is not None and (e.genre or None) != genre:
                            continue
                        if best is None or e.freq > best.freq:
                            best = e
                if best is not None:
                    result = best.ortho

        if result is None or result == w:
            return None
        return result

    def flip_gender(self, word: str, lemma: str, morph: dict) -> str | None:
        w = word.lower().replace("’", "'")
        result: str | None = None

        if w in DET_GENDER:
            result = DET_GENDER[w]
        elif w in DET_GENDER_REVERSE:
            result = DET_GENDER_REVERSE[w]

        if result is None:
            own = self.lookup(word)
            own_entry = next((e for e in own if e.cgram.split(":")[0] in ("NOM", "ADJ", "VER", "AUX")), None)
            nombre = None
            if own_entry is not None:
                nombre = own_entry.nombre or None
            elif morph.get("Number") in ("Sing", "Plur"):
                nombre = "s" if morph["Number"] == "Sing" else "p"
            genre = None
            if own_entry is not None:
                genre = own_entry.genre or None
            elif morph.get("Gender") in _GENDER_MAP:
                genre = _GENDER_MAP[morph["Gender"]]
            target_genre = "f" if genre == "m" else ("m" if genre == "f" else None)
            if target_genre is not None:
                lemmas = [lemma] if lemma and lemma in self.by_lemme else sorted({e.lemme for e in self.lookup(word)})
                best: Entry | None = None
                for l in lemmas:
                    for e in self.by_lemme.get(l, []):
                        cgram_prefix = e.cgram.split(":")[0]
                        if cgram_prefix not in ("NOM", "ADJ", "VER", "AUX"):
                            continue
                        if cgram_prefix in ("VER", "AUX") and "par:pas" not in e.infover.split(";"):
                            continue
                        if e.genre != target_genre:
                            continue
                        if nombre is not None and (e.nombre or None) != nombre:
                            continue
                        if best is None or e.freq > best.freq:
                            best = e
                if best is not None:
                    result = best.ortho

        if result is None or result == w:
            return None
        return result


@lru_cache(maxsize=2)
def load_lexicon(content_dir: Path) -> Lexicon:
    path = content_dir / "lexique" / "lexique383-trimmed.tsv.gz"
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
