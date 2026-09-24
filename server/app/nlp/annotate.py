"""spaCy annotation of a reference text. Output is highlighting/explanation metadata only (spec §1.3).

Annotation v2 adds, per token, `forms` (sibling inflections from the lexicon), `sound_alikes`
(same pronunciation, different spelling) and `chains` (ids), plus a top-level `chains` list
built by app.nlp.chains. Stored annotations older than ANNOTATION_VERSION are recomputed at
startup by app.reannotate.
"""
from __future__ import annotations
from app.lexicon import Lexicon
from app.nlp.chains import build_chains
from app.nlp.homophones import Homophones

ANNOTATION_VERSION = 2
VERB_POS = {"VERB", "AUX"}
SUBJECT_DEPS = {"nsubj", "nsubj:pass"}
AUX_DEPS = {"aux", "aux:pass", "aux:tense", "cop"}
ADJ_PARTICIPLE_DEPS = {"amod", "acl", "acl:relcl"}
LEXICON_POS = {"NOUN", "ADJ", "DET", "VERB", "AUX", "PRON", "PROPN"}


def _subject_of(i: int, tokens: list[dict]) -> int | None:
    for t in tokens:
        if t["head"] == i and t["dep"] in SUBJECT_DEPS and t["i"] != i:
            return t["i"]
    return None


def _lexical_fields(t: dict, homophones: Homophones, lexicon: Lexicon | None) -> tuple[dict, list[str]]:
    if lexicon is None or t["pos"] not in LEXICON_POS:
        return {}, []
    forms = lexicon.forms_of(t["text"], lemma=t["lemma"])
    sound_alikes = [w for w in lexicon.sound_alikes(t["text"]) if w not in forms and homophones.set_of(w) is None]
    return forms, sound_alikes


def derive_all(tokens: list[dict], homophones: Homophones,
               lexicon: Lexicon | None = None) -> tuple[list[dict], list[dict]]:
    """Fill the SP1 fields (categories / homophone / subject), the v2 lexical fields (forms /
    sound_alikes) and the agreement chains on a list of raw token dicts. Pure, model-free."""
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
        forms, sound_alikes = _lexical_fields(t, homophones, lexicon)
        out.append({**t, "categories": cats, "homophone": hom, "subject": subject,
                    "forms": forms, "sound_alikes": sound_alikes, "chains": []})
    chains = build_chains(out)
    for t in out:
        t["chains"] = [c["id"] for c in chains if t["i"] in c["targets"] or t["i"] in c["controller_group"]]
    return out, chains


def derive(tokens: list[dict], homophones: Homophones, lexicon: Lexicon | None = None) -> list[dict]:
    """Token list only (SP1 entry point); see derive_all for the chains."""
    return derive_all(tokens, homophones, lexicon)[0]


def annotate(text: str, nlp, homophones: Homophones, lexicon: Lexicon | None = None) -> dict:
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
    tokens, chains = derive_all(raw, homophones, lexicon)
    sentences = [{"start": s.start_char, "end": s.end_char} for s in doc.sents]
    return {"version": ANNOTATION_VERSION, "model": nlp.meta.get("name", ""), "tokens": tokens,
            "sentences": sentences, "chains": chains}
