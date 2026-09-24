import json
import random
from pathlib import Path
from app.corrupt import (apply_plants, candidates, category_weights, corruption_count, is_reform_equivalent, load_reform,
                         match_case, plan_corruptions, reform_canon)
from app.db import DB_FILENAME, connect
from app.nlp.annotate import annotate
from app.nlp.chains import build_chains
from app.nlp.homophones import load_homophones

CONTENT = Path(__file__).resolve().parents[2] / "content"
BODY = ("Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent. "
        "Le vent emporte leurs chansons jusqu'au village. Les enfants sortent de leurs maisons, émerveillés. "
        "La musique descend de la forêt et la nuit est douce.")


def test_count_and_weights():
    assert corruption_count(60) == 4 and corruption_count(126) == 7 and corruption_count(400) == 12
    rows = [{"category": "agreement:verb", "errors_in_draft": 10, "caught": 2},
            {"category": "homophone", "errors_in_draft": 10, "caught": 9},
            {"category": "lexical", "errors_in_draft": 1, "caught": 0}]
    w = category_weights(rows, "10H")
    assert w["agreement:verb"] > w["homophone"]                    # weak category weighs more
    assert abs(w["lexical"] - 0.10 * 0.75) < 1e-9                  # too few samples → catch_rate 0.5
    assert "agreement:participle" not in category_weights([], "7H") and "agreement:participle" in category_weights([], "8H")


def test_match_case():
    assert match_case("Les", "la") == "La" and match_case("les", "la") == "la"


def test_candidates_and_plan_are_valid_and_deterministic(nlp, lexicon):
    h = load_homophones(CONTENT)
    reform = load_reform(CONTENT)
    annotation = annotate(BODY, nlp, h, lexicon)
    cands = candidates(annotation, lexicon, h, {"clairière"}, reform)
    assert cands["homophone"] and cands["accent"] and cands["agreement:verb"]
    for cat, items in cands.items():
        for c in items:
            assert BODY[c["start"]:c["end"]] == c["original"] and c["mutated"].lower() != c["original"].lower()
    weights = category_weights([], "10H")
    plants = plan_corruptions(BODY, annotation, lexicon, h, weights, 6, random.Random(42), {"clairière"}, reform)
    assert 3 <= len(plants) <= 6
    assert plants == sorted(plants, key=lambda p: p["start"])
    for a, b in zip(plants, plants[1:]):
        assert a["end"] <= b["start"] and b["token"] - a["token"] >= 3
    again = plan_corruptions(BODY, annotation, lexicon, h, weights, 6, random.Random(42), {"clairière"}, reform)
    assert again == plants
    corrupted = apply_plants(BODY, plants)
    assert corrupted != BODY and len(corrupted.split("\n")) == len(BODY.split("\n"))
    # every plant span is exactly what changed
    rebuilt = apply_plants(BODY, plants)
    for p in plants:
        assert p["mutated"] in rebuilt


# --- Agreement plants only where the controller really dictates the feature (final review C-1, C-2) ---

def _annotation(spec: list[tuple]) -> dict:
    """Hand-built annotation from (text, pos, morph, head, dep[, lemma]) tuples, chains via build_chains,
    so the tests do not depend on the small spaCy model's parse quality."""
    tokens, pos = [], 0
    for i, s in enumerate(spec):
        text, tag, morph, head, dep = s[:5]
        lemma = s[5] if len(s) > 5 else text.lower()
        tokens.append({"i": i, "text": text, "start": pos, "end": pos + len(text), "lemma": lemma, "pos": tag,
                       "morph": morph, "head": head, "dep": dep})
        pos += len(text) + 1
    return {"version": 2, "tokens": tokens, "chains": build_chains(tokens), "sentences": []}


def _mutations(cands: dict, *cats: str) -> set[str]:
    return {c["mutated"].lower() for cat in cats for c in cands[cat]}


AGREEMENT = ("agreement:number", "agreement:gender", "agreement:participle")
PLUR3 = {"VerbForm": "Fin", "Number": "Plur", "Person": "3", "Mood": "Ind", "Tense": "Pres"}
SING3 = {"VerbForm": "Fin", "Number": "Sing", "Person": "3", "Mood": "Ind", "Tense": "Pres"}


def test_no_gender_flip_when_the_pronoun_hides_its_gender(lexicon):
    h = load_homophones(CONTENT)
    # Vous êtes contents . — « Vous êtes contentes » is correct French
    vous = _annotation([("Vous", "PRON", {"Number": "Plur", "Person": "2"}, 2, "nsubj"),
                        ("êtes", "AUX", {"VerbForm": "Fin", "Number": "Plur", "Person": "2"}, 2, "cop", "être"),
                        ("contents", "ADJ", {"Gender": "Masc", "Number": "Plur"}, 2, "ROOT", "content"),
                        (".", "PUNCT", {}, 2, "punct")])
    assert any(c["kind"] == "attribute" and c["confidence"] == "high" for c in vous["chains"])
    assert _mutations(candidates(vous, lexicon, h), *AGREEMENT) == set()
    # Nous sommes partis . — « parties » is correct French; « parti » too (nous de modestie)
    nous = _annotation([("Nous", "PRON", {"Number": "Plur", "Person": "1"}, 2, "nsubj"),
                        ("sommes", "AUX", {"VerbForm": "Fin", "Number": "Plur", "Person": "1"}, 2, "aux:tense", "être"),
                        ("partis", "VERB", {"VerbForm": "Part", "Gender": "Masc", "Number": "Plur"}, 2, "ROOT", "partir"),
                        (".", "PUNCT", {}, 2, "punct")])
    assert _mutations(candidates(nous, lexicon, h), *AGREEMENT) == set()
    # Je suis fatigué . — « fatiguée » is correct French
    def fatigue(pron, morph):
        return _annotation([(pron, "PRON", morph, 2, "nsubj"),
                            ("est" if pron == "Il" else "suis", "AUX", {"VerbForm": "Fin", "Number": "Sing", "Person": morph["Person"]}, 2, "cop", "être"),
                            ("fatigué", "VERB", {"VerbForm": "Part", "Gender": "Masc", "Number": "Sing"}, 2, "ROOT", "fatiguer"),
                            (".", "PUNCT", {}, 2, "punct")])
    assert "fatiguée" not in _mutations(candidates(fatigue("Je", {"Number": "Sing", "Person": "1"}), lexicon, h), *AGREEMENT)
    # Controls — Il est fatigué . / Elles sont parties . : the gender flips are real errors
    assert "fatiguée" in _mutations(candidates(fatigue("Il", {"Gender": "Masc", "Number": "Sing", "Person": "3"}), lexicon, h), *AGREEMENT)
    elles = _annotation([("Elles", "PRON", {"Gender": "Fem", "Number": "Plur", "Person": "3"}, 2, "nsubj"),
                         ("sont", "AUX", {"VerbForm": "Fin", "Number": "Plur", "Person": "3"}, 2, "aux:tense", "être"),
                         ("parties", "VERB", {"VerbForm": "Part", "Gender": "Fem", "Number": "Plur"}, 2, "ROOT", "partir"),
                         (".", "PUNCT", {}, 2, "punct")])
    muts = _mutations(candidates(elles, lexicon, h), *AGREEMENT)
    assert "partis" in muts and muts <= {"partis", "partie"}


def test_indefinite_subject_plants_no_agreement_at_all(lexicon):
    h = load_homophones(CONTENT)
    # On est partis . — « parti » and « partis » are both accepted
    on = _annotation([("On", "PRON", {"Number": "Sing", "Person": "3"}, 2, "nsubj"),
                      ("est", "AUX", SING3, 2, "aux:tense", "être"),
                      ("partis", "VERB", {"VerbForm": "Part", "Gender": "Masc", "Number": "Plur"}, 2, "ROOT", "partir"),
                      (".", "PUNCT", {}, 2, "punct")])
    cands = candidates(on, lexicon, h)
    assert _mutations(cands, "agreement:verb", *AGREEMENT) == set()


def test_no_gender_flip_on_an_epicene_noun(lexicon):
    h = load_homophones(CONTENT)
    # Un enfant joue . — « une enfant » is correct French
    enfant = _annotation([("Un", "DET", {"Gender": "Masc", "Number": "Sing"}, 1, "det", "un"),
                          ("enfant", "NOUN", {"Gender": "Masc", "Number": "Sing"}, 2, "nsubj"),
                          ("joue", "VERB", SING3, 2, "ROOT", "jouer"),
                          (".", "PUNCT", {}, 2, "punct")])
    cands = candidates(enfant, lexicon, h)
    assert _mutations(cands, "agreement:gender") == set()
    assert _mutations(cands, "agreement:number") == {"des"}   # number is still dictated (on the receiver, P1-5)
    # Control — Un chat dort . : « une chat » is a real error
    chat = _annotation([("Un", "DET", {"Gender": "Masc", "Number": "Sing"}, 1, "det", "un"),
                        ("chat", "NOUN", {"Gender": "Masc", "Number": "Sing"}, 2, "nsubj"),
                        ("dort", "VERB", SING3, 2, "ROOT", "dormir"),
                        (".", "PUNCT", {}, 2, "punct")])
    assert _mutations(candidates(chat, lexicon, h), "agreement:gender") == {"une"}
    # A proper noun's gender is never assumed: Marie est partie . → no « parti »
    marie = _annotation([("Marie", "PROPN", {"Gender": "Fem", "Number": "Sing"}, 2, "nsubj"),
                         ("est", "AUX", SING3, 2, "aux:tense", "être"),
                         ("partie", "VERB", {"VerbForm": "Part", "Gender": "Fem", "Number": "Sing"}, 2, "ROOT", "partir"),
                         (".", "PUNCT", {}, 2, "punct")])
    assert "parti" not in _mutations(candidates(marie, lexicon, h), "agreement:gender", "agreement:participle")


def test_no_number_flip_around_an_invariable_noun(lexicon):
    h = load_homophones(CONTENT)

    def sentence(det: str, noun: str, det_lemma: str):
        return _annotation([("Il", "PRON", {"Gender": "Masc", "Number": "Sing", "Person": "3"}, 1, "nsubj"),
                            ("croise", "VERB", SING3, 1, "ROOT", "croiser"),
                            (det, "DET", {"Number": "Plur"}, 3, "det", det_lemma),
                            (noun, "NOUN", {"Gender": "Masc", "Number": "Plur"}, 1, "obj"),
                            (".", "PUNCT", {}, 1, "punct")])

    # Il croise les bras . — « le bras » is correct French
    bras = candidates(sentence("les", "bras", "le"), lexicon, h)
    assert _mutations(bras, "agreement:number") == set()
    # Il croise leurs bras . — « leur bras » is correct French
    leurs = candidates(sentence("leurs", "bras", "leur"), lexicon, h)
    assert _mutations(leurs, "agreement:number", "homophone") == set()
    # Control — Il croise les doigts . / leurs doigts : « le doigts », « leur doigts » are real errors
    doigts = candidates(sentence("les", "doigts", "le"), lexicon, h)
    assert _mutations(doigts, "agreement:number") == {"le"}
    assert "leur" in _mutations(candidates(sentence("leurs", "doigts", "leur"), lexicon, h), "homophone")


# --- SP2 playability P1-4 / P1-5: a plant is an agreement slip, never a tense change or a new noun ---

def _codes(lexicon, word: str) -> set[str]:
    return {c for e in lexicon.lookup(word) if e.cgram.split(":")[0] in ("VER", "AUX")
            for c in e.infover.split(";") if c and c != "inf" and not c.startswith("par:")}


def test_verb_plants_keep_tense_mood_and_person(lexicon):
    h = load_homophones(CONTENT)
    # Sur la plage, la princesse et ses servantes étalaient le linge . — with spaCy's wrong Past tag
    wrong_tense = {"VerbForm": "Fin", "Number": "Plur", "Person": "3", "Mood": "Ind", "Tense": "Past"}
    ann = _annotation([("La", "DET", {"Gender": "Fem", "Number": "Sing"}, 1, "det", "le"),
                       ("princesse", "NOUN", {"Gender": "Fem", "Number": "Sing"}, 5, "nsubj"),
                       ("et", "CCONJ", {}, 4, "cc"),
                       ("ses", "DET", {"Number": "Plur"}, 4, "det", "son"),
                       ("servantes", "NOUN", {"Gender": "Fem", "Number": "Plur"}, 1, "conj", "servante"),
                       ("étalaient", "VERB", wrong_tense, 5, "ROOT", "étaler"),
                       ("le", "DET", {"Gender": "Masc", "Number": "Sing"}, 7, "det", "le"),
                       ("linge", "NOUN", {"Gender": "Masc", "Number": "Sing"}, 5, "obj"),
                       (".", "PUNCT", {}, 5, "punct")])
    cands = candidates(ann, lexicon, h)
    verbs = {(c["original"], c["mutated"]) for c in cands["agreement:verb"]}
    assert verbs == {("étalaient", "étalait")}
    for original, mutated in verbs:
        # the two forms share a Lexique code up to the number letter: same mood, tense and person
        assert {c[:-1] for c in _codes(lexicon, original)} & {c[:-1] for c in _codes(lexicon, mutated)}


def test_head_noun_of_a_nominal_chain_is_never_planted(nlp, lexicon):
    h = load_homophones(CONTENT)
    annotation = annotate("Sur la plage chauffée par le soleil, les jeunes filles riaient.", nlp, h, lexicon)
    nouns = {t["text"] for t in annotation["tokens"] if t["pos"] == "NOUN"}
    assert "soleil" in nouns
    cands = candidates(annotation, lexicon, h)
    planted_on = {c["original"] for c in cands["agreement:number"]}
    assert not planted_on & nouns, planted_on
    assert {"le", "les"} & {c["original"].lower() for c in cands["agreement:number"]}   # receivers still are


# --- Never plant a spelling the grader accepts (final review I-2, I-3, I-4) ---

def test_reform_canon_mirrors_the_grader():
    reform = load_reform(CONTENT)
    assert reform is not None
    assert reform_canon("croûtes", reform) == "croutes" and reform_canon("flûtes", reform) == "flutes"
    assert reform_canon("fûmes", reform) == "fûmes" and reform_canon("eût", reform) == "eût" and reform_canon("vînmes", reform) == "vînmes"
    assert reform_canon("connaît", reform) == "connait" and reform_canon("goût", reform) == "gout"
    assert reform_canon("évènements", reform) == "événements" and reform_canon("ruissèle", reform) == "ruisselle"
    assert is_reform_equivalent("clé", "clef", reform) and is_reform_equivalent("clés", "clefs", reform)
    assert is_reform_equivalent("paie", "paye", reform) and is_reform_equivalent("essaient", "essayent", reform)
    assert is_reform_equivalent("révolver", "revolver", reform) and is_reform_equivalent("chariot", "charriot", reform)
    assert not is_reform_equivalent("fût", "fut", reform) and not is_reform_equivalent("lis", "lys", reform)
    assert not is_reform_equivalent("clé", "clef", None)
    # SP2 playability P1-1: an elided token is canonicalised behind its elision, like the grader does
    assert reform_canon("l'évènement", reform) == "l'événement" and reform_canon("d'ognons", reform) == "d'oignons"
    assert is_reform_equivalent("L'évènement", "l'événement", reform) and is_reform_equivalent("qu'il", "qu'il", reform)
    assert not is_reform_equivalent("l'eût", "l'eut", reform)


def test_accepted_spellings_are_never_planted(nlp, lexicon):
    h = load_homophones(CONTENT)
    reform = load_reform(CONTENT)
    text = ("Elle connaît le chariot et le révolver du maître. Il paie la clé avec sa paie et goûte les croûtes. "
            "Les fées dansent et les enfants essaient de chanter.")
    annotation = annotate(text, nlp, h, lexicon)
    cands = candidates(annotation, lexicon, h, {"clé", "paie"}, reform)
    planted = {(c["original"].lower(), c["mutated"].lower()) for cat in cands for c in cands[cat]}
    for original, mutated in planted:
        assert not is_reform_equivalent(original, mutated, reform), (original, mutated)
    mutations = {m for _, m in planted}
    assert not mutations & {"connait", "charriot", "revolver", "maitre", "clef", "paye", "goute", "croutes"}
    # a sound-alike of the same lemma (dansent → danse) is an agreement error, never a "lexical" plant
    lexical = {(c["original"].lower(), c["mutated"].lower()) for c in cands["lexical"]}
    for original, mutated in lexical:
        assert not {e.lemme for e in lexicon.lookup(original)} & {e.lemme for e in lexicon.lookup(mutated)}, (original, mutated)
    assert ("dansent", "danse") in {(c["original"].lower(), c["mutated"].lower()) for c in cands["agreement:verb"]}
    # the safety net is exercised: without reform data the same text would offer these plants
    unfiltered = candidates(annotation, lexicon, h, {"clé", "paie"}, None)
    assert {c["mutated"].lower() for c in unfiltered["accent"]} & {"connait", "maitre"}
    assert "charriot" in {c["mutated"].lower() for c in unfiltered["lexical"]}


def test_candidates_tolerate_an_annotation_without_chains(lexicon):
    h = load_homophones(CONTENT)
    tokens = _annotation([("Les", "DET", {"Number": "Plur"}, 1, "det", "le"), ("fées", "NOUN", {"Gender": "Fem", "Number": "Plur"}, 2, "nsubj", "fée"),
                          ("dansent", "VERB", PLUR3, 2, "ROOT", "danser")])["tokens"]
    cands = candidates({"version": 1, "tokens": tokens}, lexicon, h)
    assert cands["accent"] and not any(cands[cat] for cat in ("agreement:verb", *AGREEMENT))


def test_api_corrupt_and_grimoire_session(client, settings):
    p = client.post("/api/profiles", json={"name": "Léa", "avatar": "chouette", "level": "10H"}).json()
    t = client.post("/api/texts", json={"title": "Fées", "body": BODY, "level": "8H", "source": "custom"}).json()
    r = client.post(f"/api/texts/{t['id']}/corrupt", json={"profile_id": p["id"], "seed": 7})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["count"] == len(d["plants"]) >= 3 and d["corrupted"] != BODY
    for pl in d["plants"]:
        assert BODY[pl["start"]:pl["end"]] == pl["original"]
    assert client.post(f"/api/texts/{t['id']}/corrupt", json={"profile_id": p["id"], "seed": 7}).json() == d
    # 5 words (the create_text minimum) but only 2 non-punctuation tokens can ever be MIN_GAP
    # apart, so plan_corruptions can never reach 3 plants regardless of the random seed.
    short = client.post("/api/texts", json={"title": "S", "body": "Il dort ici et maintenant.", "level": "8H", "source": "custom"}).json()
    r = client.post(f"/api/texts/{short['id']}/corrupt", json={"profile_id": p["id"]})
    assert r.status_code == 422 and "Éris" in r.text
    # grimoire sessions never move the help stage, even with three perfect catch rates
    result = {"version": 1, "byCategory": {"homophone": {"opportunities": 5, "draft": 2, "caught": 2, "missed": 0, "introduced": 0}},
              "draftErrors": [], "finalErrors": [], "caught": [], "missed": [], "introduced": [], "correctWords": 30, "totalWords": 30, "catchRate": 1.0, "score": 100}
    for _ in range(3):
        s = client.post("/api/sessions", json={"profile_id": p["id"], "text_id": t["id"], "pace_level": 1, "help_stage": 1, "mode": "grimoire",
                                                "started_at": "2026-09-24T10:00:00+00:00", "draft": d["corrupted"], "final": BODY,
                                                "result": result, "score": 100, "catch_rate": 1.0}).json()
        assert s["help_stage_after"] == 1 and s["help_stage_message"] is None
    stats = client.get(f"/api/profiles/{p['id']}/stats").json()
    assert stats["recent_sessions"][0]["mode"] == "grimoire" and stats["categories"][0]["caught"] == 6
    # a pre-SP2 annotation (no chains) is refused politely instead of crashing
    conn = connect(settings.data_dir / DB_FILENAME)
    conn.execute("UPDATE text SET annotation_json = ? WHERE id = ?", (json.dumps({"version": 1, "tokens": []}), t["id"]))
    conn.commit()
    conn.close()
    r = client.post(f"/api/texts/{t['id']}/corrupt", json={"profile_id": p["id"], "seed": 7})
    assert r.status_code == 422 and "Muses" in r.text
