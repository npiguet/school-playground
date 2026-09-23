"""spaCy annotation of a reference text. Output is highlighting/explanation metadata only (spec §1.3)."""
from __future__ import annotations
from app.nlp.homophones import Homophones

ANNOTATION_VERSION = 1
VERB_POS = {"VERB", "AUX"}
SUBJECT_DEPS = {"nsubj", "nsubj:pass"}
AUX_DEPS = {"aux", "aux:pass", "aux:tense", "cop"}
ADJ_PARTICIPLE_DEPS = {"amod", "acl", "acl:relcl"}


def _subject_of(i: int, tokens: list[dict]) -> int | None:
    for t in tokens:
        if t["head"] == i and t["dep"] in SUBJECT_DEPS and t["i"] != i:
            return t["i"]
    return None


def derive(tokens: list[dict], homophones: Homophones) -> list[dict]:
    """Fill categories / homophone / subject on a list of raw token dicts (pure, model-free)."""
    out = []
    for t in tokens:
        pos, morph, dep = t["pos"], t.get("morph", {}), t["dep"]
        cats: list[str] = []
        is_verb = pos in VERB_POS
        if is_verb and morph.get("VerbForm") == "Fin":
            cats.append("verb")
        if is_verb and morph.get("VerbForm") == "Part":
            cats.append("participle")
            if dep in ADJ_PARTICIPLE_DEPS:
                cats.append("nominal_group")
        if pos in {"DET", "NOUN", "ADJ"} or (pos == "PRON" and dep == "det"):
            cats.append("nominal_group")
        hom = homophones.set_of(t["text"]) if pos != "PUNCT" else None
        if hom:
            cats.append("homophone")
        subject = None
        if "verb" in cats or "participle" in cats:
            subject = _subject_of(t["i"], tokens)
            if subject is None and dep in AUX_DEPS:
                subject = _subject_of(t["head"], tokens)
        out.append({**t, "categories": cats, "homophone": hom, "subject": subject})
    return out


def annotate(text: str, nlp, homophones: Homophones) -> dict:
    doc = nlp(text)
    raw = []
    index_map: dict[int, int] = {}
    for tok in doc:
        if tok.is_space:
            continue
        index_map[tok.i] = len(raw)
        raw.append({"i": len(raw), "text": tok.text, "start": tok.idx, "end": tok.idx + len(tok.text),
                    "lemma": tok.lemma_, "pos": tok.pos_, "morph": tok.morph.to_dict(),
                    "head": tok.head.i, "dep": tok.dep_})
    for t in raw:  # remap heads after dropping whitespace tokens
        t["head"] = index_map.get(t["head"], t["i"])
    tokens = derive(raw, homophones)
    sentences = [{"start": s.start_char, "end": s.end_char} for s in doc.sents]
    return {"version": ANNOTATION_VERSION, "model": nlp.meta.get("name", ""), "tokens": tokens, "sentences": sentences}
