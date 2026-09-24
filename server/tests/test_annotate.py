from pathlib import Path
import pytest
from app.nlp.annotate import annotate, derive, derive_all
from app.nlp.homophones import load_homophones

CONTENT = Path(__file__).resolve().parents[2] / "content"


def tok(i, text, pos, morph=None, head=None, dep="dep"):
    return {"i": i, "text": text, "start": 0, "end": 0, "lemma": text.lower(), "pos": pos,
            "morph": morph or {}, "head": i if head is None else head, "dep": dep}


def test_derive_categories_and_subject():
    h = load_homophones(CONTENT)
    tokens = [
        tok(0, "Les", "DET", {"Number": "Plur"}, head=1, dep="det"),
        tok(1, "fées", "NOUN", {"Gender": "Fem", "Number": "Plur"}, head=3, dep="nsubj"),
        tok(2, "ont", "AUX", {"VerbForm": "Fin", "Number": "Plur"}, head=3, dep="aux:tense"),
        tok(3, "dansé", "VERB", {"VerbForm": "Part"}, head=3, dep="ROOT"),
        tok(4, "à", "ADP", {}, head=6, dep="case"),
        tok(5, "la", "DET", {"Gender": "Fem"}, head=6, dep="det"),
        tok(6, "fête", "NOUN", {"Gender": "Fem"}, head=3, dep="obl"),
        tok(7, "épuisées", "VERB", {"VerbForm": "Part", "Number": "Plur"}, head=1, dep="acl"),
        tok(8, ".", "PUNCT", {}, head=3, dep="punct"),
    ]
    out = derive(tokens, h)
    cats = {t["text"]: set(t["categories"]) for t in out}
    assert cats["Les"] == {"nominal_group"}
    assert cats["fées"] == {"nominal_group"}
    assert cats["ont"] == {"verb", "homophone"}
    assert cats["dansé"] == {"participle"}
    assert cats["à"] == {"homophone"}
    assert cats["la"] == {"nominal_group", "homophone"}
    assert cats["épuisées"] == {"participle", "nominal_group"}
    assert cats["."] == set()
    by = {t["text"]: t for t in out}
    assert by["à"]["homophone"] == "a" and by["fête"]["homophone"] is None
    assert by["dansé"]["subject"] == 1          # nsubj child of the participle
    assert by["ont"]["subject"] == 1            # aux borrows the head's subject
    assert by["épuisées"]["subject"] is None


# SP2 playability P1-3: a word with its own auxiliary is a participle (Protée), never a noun-group
# member, even when the tagger called it ADJ; a participle with an auxiliary in a relative clause
# (« la fée qui a chanté ») is not adjectival either.
def test_derive_participle_with_own_auxiliary_even_when_tagged_adj():
    h = load_homophones(CONTENT)
    tokens = [
        tok(0, "Athéna", "PROPN", {}, head=3, dep="nsubj"),
        tok(1, "l'", "PRON", {"Number": "Sing"}, head=3, dep="obj"),
        tok(2, "avait", "AUX", {"VerbForm": "Fin", "Number": "Sing"}, head=3, dep="aux:tense"),
        tok(3, "choisie", "ADJ", {"Gender": "Masc", "Number": "Sing"}, head=3, dep="ROOT"),
        tok(4, "la", "DET", {"Gender": "Fem"}, head=5, dep="det"),
        tok(5, "fée", "NOUN", {"Gender": "Fem", "Number": "Sing"}, head=3, dep="obl"),
        tok(6, "qui", "PRON", {}, head=8, dep="nsubj"),
        tok(7, "a", "AUX", {"VerbForm": "Fin", "Number": "Sing"}, head=8, dep="aux:tense"),
        tok(8, "chanté", "VERB", {"VerbForm": "Part"}, head=5, dep="acl:relcl"),
        tok(9, "fatiguée", "ADJ", {"Gender": "Fem", "Number": "Sing"}, head=5, dep="amod"),
    ]
    cats = {t["text"]: set(t["categories"]) for t in derive(tokens, h)}
    assert cats["choisie"] == {"participle"}
    assert cats["chanté"] == {"participle"}
    assert cats["fatiguée"] == {"nominal_group"}
    assert cats["avait"] == {"verb"} and cats["a"] == {"verb", "homophone"}


def test_derive_without_lexicon_keeps_sp1_shape():
    h = load_homophones(CONTENT)
    tokens = [
        tok(0, "Les", "DET", {"Number": "Plur"}, head=1, dep="det"),
        tok(1, "fées", "NOUN", {"Gender": "Fem", "Number": "Plur"}, head=2, dep="nsubj"),
        tok(2, "dansent", "VERB", {"VerbForm": "Fin", "Number": "Plur", "Person": "3"}, head=2, dep="ROOT"),
    ]
    out = derive(tokens, h)
    assert [t["text"] for t in out] == ["Les", "fées", "dansent"]
    for t in out:
        assert t["forms"] == {} and t["sound_alikes"] == [] and isinstance(t["chains"], list)
    assert out[1]["chains"] and out[2]["chains"]  # noun and verb belong to a chain even without a lexicon


def test_derive_all_with_lexicon(lexicon):
    h = load_homophones(CONTENT)
    tokens = [
        tok(0, "Les", "DET", {"Number": "Plur"}, head=1, dep="det"),
        tok(1, "fées", "NOUN", {"Gender": "Fem", "Number": "Plur"}, head=2, dep="nsubj"),
        tok(2, "dansent", "VERB", {"VerbForm": "Fin", "Number": "Plur", "Person": "3"}, head=2, dep="ROOT"),
        tok(3, ".", "PUNCT", {}, head=2, dep="punct"),
    ]
    tokens[1]["lemma"] = "fée"
    tokens[2]["lemma"] = "danser"
    out, chains = derive_all(tokens, h, lexicon)
    fees, dansent, dot = out[1], out[2], out[3]
    assert fees["forms"] == {"fée": {"g": "f", "n": "s"}}
    assert "fées" not in fees["sound_alikes"] and "fée" not in fees["sound_alikes"]  # never the token or a form
    assert len(fees["sound_alikes"]) <= 5
    assert all(h.set_of(w) is None for w in fees["sound_alikes"])
    assert "danse" in dansent["forms"]
    assert dot["forms"] == {} and dot["sound_alikes"] == [] and dot["chains"] == []
    sv = next(c for c in chains if c["kind"] == "subject_verb")
    assert sv["id"] in fees["chains"] and sv["id"] in dansent["chains"] and sv["id"] in out[0]["chains"]
    assert [c["id"] for c in chains] == list(range(len(chains)))


def test_annotate_with_real_model(nlp, lexicon):
    h = load_homophones(CONTENT)
    a = annotate("Les fées dansent dans la clairière. Il a chanté.", nlp, h, lexicon)
    assert a["version"] == 3 and a["model"]
    assert isinstance(a["chains"], list)
    fees = next(t for t in a["tokens"] if t["text"] == "fées")
    assert "fée" in fees["forms"]
    dansent = next(t for t in a["tokens"] if t["text"] == "dansent")
    assert any(c["kind"] == "subject_verb" and c["controller"] == fees["i"] and dansent["i"] in c["targets"]
               for c in a["chains"])
    sv = next(c for c in a["chains"] if c["kind"] == "subject_verb" and dansent["i"] in c["targets"])
    assert sv["id"] in dansent["chains"]
    texts = [t["text"] for t in a["tokens"]]
    assert "dansent" in texts and "." in texts and " " not in texts
    first = a["tokens"][0]
    assert first["text"] == "Les" and first["start"] == 0 and first["end"] == 3
    assert "nominal_group" in first["categories"]
    dansent = next(t for t in a["tokens"] if t["text"] == "dansent")
    assert dansent["pos"] in {"VERB", "AUX"}
    a_tok = next(t for t in a["tokens"] if t["text"] == "a")
    assert a_tok["homophone"] == "a"
    assert len(a["sentences"]) == 2 and a["sentences"][0]["start"] == 0
    # every token span must slice the original text exactly
    text = "Les fées dansent dans la clairière. Il a chanté."
    for t in a["tokens"]:
        assert text[t["start"]:t["end"]] == t["text"]
