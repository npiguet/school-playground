from pathlib import Path
import pytest
from app.nlp.annotate import annotate, derive
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


def test_annotate_with_real_model(nlp):
    h = load_homophones(CONTENT)
    a = annotate("Les fées dansent dans la clairière. Il a chanté.", nlp, h)
    assert a["version"] == 1 and a["model"]
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
