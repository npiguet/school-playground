import json
import random
from pathlib import Path
from app.corrupt import (_agreement_groups, apply_plants, candidates, category_weights, corruption_count,
                         is_reform_equivalent, load_reform, match_case, plan_corruptions, reform_canon)
from app.db import DB_FILENAME, connect
from app.lexicon import DET_GENDER, DET_NUMBER, DET_NUMBER_REVERSE, NOUN_GENDER_PAIRS
from app.nlp.annotate import annotate
from app.nlp.chains import build_chains
from app.nlp.homophones import load_homophones
from app.textutil import word_count

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
    # Il est fatigué . — « Il est fatiguée » is a real error, but « Elle est fatiguée » repairs it on
    # another word: never planted (Grimoire ambiguity)
    assert "fatiguée" not in _mutations(candidates(fatigue("Il", {"Gender": "Masc", "Number": "Sing", "Person": "3"}), lexicon, h), *AGREEMENT)
    # Elles sont parties . — « partie » has one repair (« sont » and « Elles » both stay plural), while
    # « Elles sont partis » also reads as « Ils sont partis »
    elles = _annotation([("Elles", "PRON", {"Gender": "Fem", "Number": "Plur", "Person": "3"}, 2, "nsubj"),
                         ("sont", "AUX", {"VerbForm": "Fin", "Number": "Plur", "Person": "3"}, 2, "aux:tense", "être"),
                         ("parties", "VERB", {"VerbForm": "Part", "Gender": "Fem", "Number": "Plur"}, 2, "ROOT", "partir"),
                         (".", "PUNCT", {}, 2, "punct")])
    assert _mutations(candidates(elles, lexicon, h), *AGREEMENT) == {"partie"}
    # Control — La reine est fatiguée . : « reine » has no masculine form, so « fatigué » is forced
    reine = _annotation([("La", "DET", {"Gender": "Fem", "Number": "Sing"}, 1, "det", "le"),
                         ("reine", "NOUN", {"Gender": "Fem", "Number": "Sing"}, 3, "nsubj"),
                         ("est", "AUX", SING3, 3, "aux:tense", "être"),
                         ("fatiguée", "VERB", {"VerbForm": "Part", "Gender": "Fem", "Number": "Sing"}, 3, "ROOT", "fatiguer"),
                         (".", "PUNCT", {}, 3, "punct")])
    assert {"fatigué", "fatiguées"} <= _mutations(candidates(reine, lexicon, h), *AGREEMENT)


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
    # Control — Un rocher lourd tombe . : « rocher » has no feminine, so « un rocher lourde » is a real
    # error with one repair (the determiner itself is never planted, ruling R2)
    rocher = _annotation([("Un", "DET", {"Gender": "Masc", "Number": "Sing"}, 1, "det", "un"),
                          ("rocher", "NOUN", {"Gender": "Masc", "Number": "Sing"}, 3, "nsubj"),
                          ("lourd", "ADJ", {"Gender": "Masc", "Number": "Sing"}, 1, "amod", "lourd"),
                          ("tombe", "VERB", SING3, 3, "ROOT", "tomber"),
                          (".", "PUNCT", {}, 3, "punct")])
    assert _mutations(candidates(rocher, lexicon, h), "agreement:gender") == {"lourde"}
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
    # Il croise les doigts . / leurs doigts : « le doigts », « leur doigts » are errors, but with two
    # repairs each (« le doigt », « leur doigt »): never planted (Grimoire ambiguity)
    doigts = candidates(sentence("les", "doigts", "le"), lexicon, h)
    assert _mutations(doigts, "agreement:number") == set()
    assert "leur" not in _mutations(candidates(sentence("leurs", "doigts", "leur"), lexicon, h), "homophone")
    # Control — Il croise leurs longs doigts . : « leurs » and « doigts » stay plural, « long » has one
    # repair; « leur » is a determiner, never planted (ruling R2: « ces », « mes » would repair it too)
    longs = _annotation([("Il", "PRON", {"Gender": "Masc", "Number": "Sing", "Person": "3"}, 1, "nsubj"),
                         ("croise", "VERB", SING3, 1, "ROOT", "croiser"),
                         ("leurs", "DET", {"Number": "Plur"}, 4, "det", "leur"),
                         ("longs", "ADJ", {"Gender": "Masc", "Number": "Plur"}, 4, "amod", "long"),
                         ("doigts", "NOUN", {"Gender": "Masc", "Number": "Plur"}, 1, "obj", "doigt"),
                         (".", "PUNCT", {}, 1, "punct")])
    cands = candidates(longs, lexicon, h)
    assert "leur" not in _mutations(cands, "homophone") and _mutations(cands, "agreement:number") == {"long"}


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
    # receivers still are: the adjective (the small model takes « jeunes » for the noun and « filles »
    # for its adjective), never a determiner (ruling R2)
    assert planted_on & {"jeunes", "filles"} and not planted_on & {"la", "le", "les"}, planted_on


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


# --- Grimoire focus: a lieutenant weighs its categories 3x; Léthé instead biases plant position (Decision 21) ---

def test_focus_triples_the_lieutenant_categories_weight():
    rows = [{"category": "agreement:gender", "errors_in_draft": 10, "caught": 5}]
    base = category_weights(rows, "10H")
    focused = category_weights(rows, "10H", focus="chimere")
    assert abs(focused["agreement:gender"] - 3 * base["agreement:gender"]) < 1e-9
    # other categories are untouched by a chimere focus
    assert abs(focused["homophone"] - base["homophone"]) < 1e-9
    # a derived-category lieutenant (sirenes, lethe) boosts no corruption weight: no category of
    # theirs is a corruption category
    assert category_weights(rows, "10H", focus="lethe") == base


def test_focus_lethe_biases_plants_to_the_last_third(nlp, lexicon):
    h = load_homophones(CONTENT)
    reform = load_reform(CONTENT)
    text = " ".join(["Les fées dansent dans la clairière et les oiseaux les écoutent."] * 19)   # >= 200 words
    annotation = annotate(text, nlp, h, lexicon)
    weights = category_weights([], "10H")
    plants = plan_corruptions(text, annotation, lexicon, h, weights, 10, random.Random(7), set(), reform, focus="lethe")
    assert len(plants) >= 5
    threshold = 2 * len(text) / 3
    in_last_third = sum(1 for p in plants if p["start"] >= threshold)
    assert in_last_third / len(plants) >= 0.7


# --- One repair only: a plant that another word could also repair is never planted (Grimoire ambiguity) ---
# User report: « des lions et des loups » planted as « un lions et des loups ». The expected fix was
# « des lions », but « un lion et des loups » is just as correct and was graded wrong.

CIRCE = ("Quand les marins d'Ulysse débarquèrent sur l'île boisée où régnait la magicienne Circé, ils furent "
         "accueillis par des lions et des loups étrangement dociles, qui les frôlaient sans jamais montrer les crocs.")


def _plants_on(cands: dict, original: str, *cats: str) -> set[str]:
    return {c["mutated"].lower() for cat in cats for c in cands[cat] if c["original"].lower() == original}


def test_user_case_un_lions_is_never_planted(nlp, lexicon):
    h = load_homophones(CONTENT)
    annotation = annotate(CIRCE, nlp, h, lexicon)
    cands = candidates(annotation, lexicon, h, set(), load_reform(CONTENT))
    by_i = {t["i"]: t for t in annotation["tokens"]}
    before_lions = {c["mutated"].lower() for cat in cands for c in cands[cat]
                    if by_i.get(c["token"] + 1, {}).get("text") == "lions"}
    assert "un" not in before_lions
    # the same group built by hand, so the test does not hang on the small model's parse
    ann = _annotation([("Il", "PRON", {"Gender": "Masc", "Number": "Sing", "Person": "3"}, 1, "nsubj"),
                       ("voit", "VERB", SING3, 1, "ROOT", "voir"),
                       ("des", "DET", {"Number": "Plur"}, 3, "det", "un"),
                       ("lions", "NOUN", {"Gender": "Masc", "Number": "Plur"}, 1, "obj", "lion"),
                       ("et", "CCONJ", {}, 6, "cc"),
                       ("des", "DET", {"Number": "Plur"}, 6, "det", "un"),
                       ("loups", "NOUN", {"Gender": "Masc", "Number": "Plur"}, 3, "conj", "loup"),
                       (".", "PUNCT", {}, 1, "punct")])
    assert _mutations(candidates(ann, lexicon, h), *AGREEMENT, "homophone") & {"un", "une"} == set()


def _group(det: str, det_lemma: str, noun: str, noun_lemma: str, number: str, adj: tuple | None = None) -> dict:
    """Il voit <det> <noun> [<adj>] . — the nominal group as an object, so no verb agrees with it."""
    spec = [("Il", "PRON", {"Gender": "Masc", "Number": "Sing", "Person": "3"}, 1, "nsubj"),
            ("voit", "VERB", SING3, 1, "ROOT", "voir"),
            (det, "DET", {"Gender": "Masc", "Number": number}, 3, "det", det_lemma),
            (noun, "NOUN", {"Gender": "Masc", "Number": number}, 1, "obj", noun_lemma)]
    if adj:
        spec.append((adj[0], "ADJ", {"Gender": "Masc", "Number": number}, 3, "amod", adj[1]))
    return _annotation(spec + [(".", "PUNCT", {}, 1, "punct")])


def test_a_determiner_and_its_noun_alone_take_no_number_plant(lexicon):
    h = load_homophones(CONTENT)
    # « un lions », « des lion »: fixing either word leaves correct French
    assert _mutations(candidates(_group("des", "un", "lions", "lion", "Plur"), lexicon, h), *AGREEMENT) == set()
    assert _mutations(candidates(_group("un", "un", "lion", "lion", "Sing"), lexicon, h), "agreement:number") == set()
    # with an adjective, two words keep the number: « des lions féroce » and « un lion féroces » have one
    # repair; the determiner is never planted (ruling R2: « un lions féroces » also reads « les », « ces »…)
    plur = candidates(_group("des", "un", "lions", "lion", "Plur", ("féroces", "féroce")), lexicon, h)
    assert _mutations(plur, "agreement:number") == {"féroce"}
    sing = candidates(_group("un", "un", "lion", "lion", "Sing", ("féroce", "féroce")), lexicon, h)
    assert _mutations(sing, "agreement:number") == {"féroces"}
    # the small model tags some common nouns PROPN (« mer »): still a noun that can change, so
    # « mer calmes » reads as « mer calme » or as « mers calmes »
    mer = _annotation([("Il", "PRON", {"Gender": "Masc", "Number": "Sing", "Person": "3"}, 1, "nsubj"),
                       ("voit", "VERB", SING3, 1, "ROOT", "voir"),
                       ("mer", "PROPN", {"Gender": "Fem", "Number": "Sing"}, 1, "obj", "mer"),
                       ("calme", "ADJ", {"Gender": "Fem", "Number": "Sing"}, 2, "amod", "calme"),
                       (".", "PUNCT", {}, 1, "punct")])
    assert _mutations(candidates(mer, lexicon, h), "agreement:number") == set()


def test_no_determiner_is_ever_planted_for_number_or_gender(lexicon):
    h = load_homophones(CONTENT)
    for det, lemma, noun, number, adj in (("des", "un", "lions", "Plur", ("féroces", "féroce")),
                                          ("un", "un", "rocher", "Sing", ("lourd", "lourd")),
                                          ("le", "le", "rocher", "Sing", ("lourd", "lourd"))):
        cands = candidates(_group(det, lemma, noun, noun.rstrip("s"), number, adj), lexicon, h)
        planted = {c["original"] for cat in (*AGREEMENT, "homophone") for c in cands[cat]}
        assert det not in planted, (det, planted)


def test_an_elided_determiner_carries_the_singular(lexicon):
    h = load_homophones(CONTENT)
    # L'oiseau chante . — « L'oiseau chantent » has one repair: « l' » has no plural form
    ann = _subject([("L'", "DET", {"Number": "Sing"}, 1, "det", "le"),
                    ("oiseau", "NOUN", {"Gender": "Masc", "Number": "Sing"}, 2, "nsubj", "oiseau")], "chante", "chanter", SING3)
    assert _mutations(candidates(ann, lexicon, h), "agreement:verb") == {"chantent"}


def test_a_plural_only_noun_and_a_fixed_pronoun_carry_their_number(lexicon):
    h = load_homophones(CONTENT)
    # Les gens dorment . — « gens » has no singular: « Les gens dort » has one repair
    gens = _subject([("Les", "DET", {"Number": "Plur"}, 1, "det", "le"),
                     ("gens", "NOUN", {"Gender": "Masc", "Number": "Plur"}, 2, "nsubj", "gens")], "dorment", "dormir", PLUR3)
    assert _mutations(candidates(gens, lexicon, h), "agreement:verb") == {"dort"}
    # Chacun dort . — « chacun » has no plural: « Chacun dorment » has one repair
    chacun = _subject([("Chacun", "PRON", {"Number": "Sing", "Person": "3"}, 1, "nsubj", "chacun")], "dort", "dormir", SING3)
    assert _mutations(candidates(chacun, lexicon, h), "agreement:verb") == {"dorment"}


def test_an_adjective_before_its_noun(lexicon):
    h = load_homophones(CONTENT)
    # Il voit un grand lion . — « un grands lion »: « un » and « lion » stay singular
    ann = _annotation([("Il", "PRON", {"Gender": "Masc", "Number": "Sing", "Person": "3"}, 1, "nsubj"),
                       ("voit", "VERB", SING3, 1, "ROOT", "voir"),
                       ("un", "DET", {"Gender": "Masc", "Number": "Sing"}, 4, "det", "un"),
                       ("grand", "ADJ", {"Gender": "Masc", "Number": "Sing"}, 4, "amod", "grand"),
                       ("lion", "NOUN", {"Gender": "Masc", "Number": "Sing"}, 1, "obj", "lion"),
                       (".", "PUNCT", {}, 1, "punct")])
    cands = candidates(ann, lexicon, h)
    assert "grands" in _mutations(cands, "agreement:number") and "grande" in _mutations(cands, "agreement:gender")


def test_a_proper_name_carries_its_number_only_without_a_determiner(lexicon):
    h = load_homophones(CONTENT)
    # Ulysse dort . — « Ulysse dorment » has one repair: a name alone is singular
    ulysse = _subject([("Ulysse", "PROPN", {"Gender": "Masc", "Number": "Sing"}, 1, "nsubj")], "dort", "dormir", SING3)
    assert _mutations(candidates(ulysse, lexicon, h), "agreement:verb") == {"dorment"}
    # Un Byron dort . — « des Byron dorment » is correct French: a name takes no plural mark
    byron = _subject([("Un", "DET", {"Gender": "Masc", "Number": "Sing"}, 1, "det", "un"),
                      ("Byron", "PROPN", {"Gender": "Masc", "Number": "Sing"}, 2, "nsubj")], "dort", "dormir", SING3)
    assert _mutations(candidates(byron, lexicon, h), "agreement:verb") == set()


def test_a_pronoun_parsed_into_a_nominal_group_carries_nothing(lexicon):
    h = load_homophones(CONTENT)
    # qui a bu rosée fraîche : the small model hung « bu » (as a PRON) on « rosée » — « rosée fraîches »
    # still reads as « rosées fraîches »
    ann = _annotation([("Il", "PRON", {"Gender": "Masc", "Number": "Sing", "Person": "3"}, 1, "nsubj"),
                       ("voit", "VERB", SING3, 1, "ROOT", "voir"),
                       ("bu", "PRON", {"Number": "Sing", "Person": "3"}, 3, "det", "boire"),
                       ("rosée", "NOUN", {"Gender": "Fem", "Number": "Sing"}, 1, "obj", "rosée"),
                       ("fraîche", "ADJ", {"Gender": "Fem", "Number": "Sing"}, 3, "amod", "frais"),
                       (".", "PUNCT", {}, 1, "punct")])
    assert _mutations(candidates(ann, lexicon, h), "agreement:number") == set()
    # « leur » tagged PRON but hung on the noun as its determiner: « leurs cheval » reads as « leur
    # cheval » or « leurs chevaux »
    leur = _annotation([("Il", "PRON", {"Gender": "Masc", "Number": "Sing", "Person": "3"}, 1, "nsubj"),
                        ("voit", "VERB", SING3, 1, "ROOT", "voir"),
                        ("leur", "PRON", {"Number": "Sing"}, 3, "det", "leur"),
                        ("cheval", "NOUN", {"Gender": "Masc", "Number": "Sing"}, 1, "obj", "cheval"),
                        (".", "PUNCT", {}, 1, "punct")])
    assert "leurs" not in _mutations(candidates(leur, lexicon, h), "homophone")
    # Control — Il leur parle . : the pronoun agrees with nothing, « leurs » has one repair
    parle = _annotation([("Il", "PRON", {"Gender": "Masc", "Number": "Sing", "Person": "3"}, 2, "nsubj"),
                         ("leur", "PRON", {"Number": "Plur", "Person": "3"}, 2, "iobj", "leur"),
                         ("parle", "VERB", SING3, 2, "ROOT", "parler"),
                         (".", "PUNCT", {}, 2, "punct")])
    assert "leurs" in _mutations(candidates(parle, lexicon, h), "homophone")


def test_a_noun_with_a_gender_counterpart_does_not_fix_the_gender(lexicon):
    h = load_homophones(CONTENT)

    def parties(det: str, noun: str, lemma: str, gender: str) -> dict:
        part = "parties" if gender == "Fem" else "partis"
        return _annotation([(det, "DET", {"Number": "Plur"}, 1, "det", "le"),
                            (noun, "NOUN", {"Gender": gender, "Number": "Plur"}, 3, "nsubj", lemma),
                            ("sont", "AUX", {**PLUR3, "VerbForm": "Fin"}, 3, "aux:tense", "être"),
                            (part, "VERB", {"VerbForm": "Part", "Gender": gender, "Number": "Plur"}, 3, "ROOT", "partir"),
                            (".", "PUNCT", {}, 3, "punct")])
    # Les déesses sont parties . — « Les déesses sont partis » also reads as « Les dieux sont partis »
    assert "partis" not in _mutations(candidates(parties("Les", "déesses", "déesse", "Fem"), lexicon, h), *AGREEMENT)
    # Les rois sont partis . — « parties » also reads as « Les reines sont parties »
    assert "parties" not in _mutations(candidates(parties("Les", "rois", "roi", "Masc"), lexicon, h), *AGREEMENT)
    # Les sœurs sont parties . — « partis » also reads as « Les frères sont partis » (Lexique spells « soeur »)
    assert "partis" not in _mutations(candidates(parties("Les", "sœurs", "sœur", "Fem"), lexicon, h), *AGREEMENT)
    # Control — Les fées sont parties . : « fée » has no masculine, « partis » has one repair
    assert "partis" in _mutations(candidates(parties("Les", "fées", "fée", "Fem"), lexicon, h), *AGREEMENT)
    # « une lion » also reads as « une lionne », « un grande rocher » has one repair
    assert _mutations(candidates(_group("un", "un", "lion", "lion", "Sing"), lexicon, h), "agreement:gender") == set()
    assert "lourde" in _mutations(candidates(_group("un", "un", "rocher", "rocher", "Sing", ("lourd", "lourd")),
                                             lexicon, h), "agreement:gender")


def _subject(subject: list[tuple], verb: str, lemma: str, morph: dict) -> dict:
    n = len(subject)
    return _annotation(subject + [(verb, "VERB", morph, n, "ROOT", lemma), (".", "PUNCT", {}, n, "punct")])


def test_a_verb_takes_a_number_plant_only_when_its_subject_cannot_follow(lexicon):
    h = load_homophones(CONTENT)
    # Ils dorment . — « Ils dort » also reads as « Il dort »
    ils = _subject([("Ils", "PRON", {"Gender": "Masc", "Number": "Plur", "Person": "3"}, 1, "nsubj")], "dorment", "dormir", PLUR3)
    assert _mutations(candidates(ils, lexicon, h), "agreement:verb") == set()
    # Les lions dorment . — « les » and « lions » both stay plural
    lions = _subject([("Les", "DET", {"Number": "Plur"}, 1, "det", "le"),
                      ("lions", "NOUN", {"Gender": "Masc", "Number": "Plur"}, 2, "nsubj", "lion")], "dorment", "dormir", PLUR3)
    assert _mutations(candidates(lions, lexicon, h), "agreement:verb") == {"dort"}
    # Le lion et le loup dorment . — the coordination is plural whatever one word says
    coord = _subject([("Le", "DET", {"Gender": "Masc", "Number": "Sing"}, 1, "det", "le"),
                      ("lion", "NOUN", {"Gender": "Masc", "Number": "Sing"}, 5, "nsubj", "lion"),
                      ("et", "CCONJ", {}, 4, "cc"),
                      ("le", "DET", {"Gender": "Masc", "Number": "Sing"}, 4, "det", "le"),
                      ("loup", "NOUN", {"Gender": "Masc", "Number": "Sing"}, 1, "conj", "loup")], "dorment", "dormir", PLUR3)
    assert _mutations(candidates(coord, lexicon, h), "agreement:verb") == {"dort"}


def test_a_person_homophone_is_planted_only_under_a_noun_subject(lexicon):
    h = load_homophones(CONTENT)

    def parti(subject: list[tuple]) -> dict:
        n = len(subject)
        return _annotation(subject + [("est", "AUX", SING3, n + 1, "aux:tense", "être"),
                                      ("parti", "VERB", {"VerbForm": "Part", "Gender": "Masc", "Number": "Sing"}, n + 1, "ROOT", "partir"),
                                      (".", "PUNCT", {}, n + 1, "punct")])
    # Il est parti . — « Il es parti » also reads as « Tu es parti »
    il = candidates(parti([("Il", "PRON", {"Gender": "Masc", "Number": "Sing", "Person": "3"}, 2, "nsubj")]), lexicon, h)
    assert "es" not in _plants_on(il, "est", "homophone") and "et" in _plants_on(il, "est", "homophone")
    # Le lion est parti . — a noun is never « tu »: « es » has one repair
    lion = candidates(parti([("Le", "DET", {"Gender": "Masc", "Number": "Sing"}, 1, "det", "le"),
                             ("lion", "NOUN", {"Gender": "Masc", "Number": "Sing"}, 3, "nsubj", "lion")]), lexicon, h)
    assert "es" in _plants_on(lion, "est", "homophone")
    # On est parti . — « On es parti » also reads as « Tu es parti »
    on = candidates(parti([("On", "PRON", {"Number": "Sing", "Person": "3"}, 2, "nsubj")]), lexicon, h)
    assert "es" not in _plants_on(on, "est", "homophone")


def test_a_coordinated_antecedent_of_qui_is_a_plural_coordination(lexicon):
    h = load_homophones(CONTENT)
    # Il voit Pierre et Paul qui dorment . — « qui dort » has one repair: the coordination stays plural
    ann = _annotation([("Il", "PRON", {"Gender": "Masc", "Number": "Sing", "Person": "3"}, 1, "nsubj"),
                       ("voit", "VERB", SING3, 1, "ROOT", "voir"),
                       ("Pierre", "PROPN", {"Gender": "Masc", "Number": "Sing"}, 1, "obj", "Pierre"),
                       ("et", "CCONJ", {}, 4, "cc"),
                       ("Paul", "PROPN", {"Gender": "Masc", "Number": "Sing"}, 2, "conj", "Paul"),
                       ("qui", "PRON", {"PronType": "Rel"}, 6, "nsubj", "qui"),
                       ("dorment", "VERB", PLUR3, 2, "acl:relcl", "dormir"),
                       (".", "PUNCT", {}, 1, "punct")])
    groups = _agreement_groups([c for c in ann["chains"] if c["confidence"] in ("high", "medium")],
                               {t["i"]: t for t in ann["tokens"]}, lexicon)
    assert [g["conj"] for g in groups[6]] == [True] and groups[6][0]["values"]["Number"] == "Plur"
    assert _mutations(candidates(ann, lexicon, h), "agreement:verb") == {"dort"}


def test_avoir_participle_agreeing_with_a_preceding_object(lexicon):
    h = load_homophones(CONTENT)
    # Il voit les pommes qu' il a mangées . — « mangée » and « mangés » have one repair each
    que = _annotation([("Il", "PRON", {"Gender": "Masc", "Number": "Sing", "Person": "3"}, 1, "nsubj"),
                       ("voit", "VERB", SING3, 1, "ROOT", "voir"),
                       ("les", "DET", {"Number": "Plur"}, 3, "det", "le"),
                       ("pommes", "NOUN", {"Gender": "Fem", "Number": "Plur"}, 1, "obj", "pomme"),
                       ("qu'", "PRON", {"PronType": "Rel"}, 7, "obj", "que"),
                       ("il", "PRON", {"Gender": "Masc", "Number": "Sing", "Person": "3"}, 7, "nsubj"),
                       ("a", "AUX", SING3, 7, "aux:tense", "avoir"),
                       ("mangées", "VERB", {"VerbForm": "Part", "Gender": "Fem", "Number": "Plur"}, 3, "acl:relcl", "manger"),
                       (".", "PUNCT", {}, 1, "punct")])
    assert {"mangée", "mangés"} <= _mutations(candidates(que, lexicon, h), "agreement:participle")
    # Il les a mangées . — « Il les a mangée » also reads as « Il l'a mangée »: nothing planted
    clitic = _annotation([("Il", "PRON", {"Gender": "Masc", "Number": "Sing", "Person": "3"}, 3, "nsubj"),
                          ("les", "PRON", {"Number": "Plur", "Person": "3"}, 3, "obj", "le"),
                          ("a", "AUX", SING3, 3, "aux:tense", "avoir"),
                          ("mangées", "VERB", {"VerbForm": "Part", "Gender": "Fem", "Number": "Plur"}, 3, "ROOT", "manger"),
                          (".", "PUNCT", {}, 3, "punct")])
    assert _mutations(candidates(clitic, lexicon, h), "agreement:participle") == set()


# The seed sweep's oracle (ruling R3): a brute force independent of corrupt.py. Its agreement groups come
# from the dependency parse itself (heads and relations, not the annotation's chains), its repairs
# from Lexique directly (every form of each word's lemma, the noun gender pairs, the personal
# pronouns, every determiner). A plant is ambiguous when some other word of its groups has a
# replacement after which every group agrees again; « agrees » means the words' possible feature
# values, read from Lexique, still intersect.
_PRONOUNS = {"je": ("", "s", "1"), "tu": ("", "s", "2"), "il": ("m", "s", "3"), "elle": ("f", "s", "3"),
             "on": ("", "s", "3"), "nous": ("", "p", "1"), "vous": ("", "", "2"), "ils": ("m", "p", "3"),
             "elles": ("f", "p", "3")}
_ANY = {"Gender": {"m", "f"}, "Number": {"s", "p"}, "Person": {"1", "2", "3"}}
_FEATURES = ("Gender", "Number", "Person")


_DET_VALUES = {"Number": ({*DET_NUMBER}, {*DET_NUMBER_REVERSE}),
               "Gender": ({*DET_GENDER, "cet"}, {*DET_GENDER.values(), "une", "la", "ma", "ta", "sa"})}


def _values(lexicon, t: dict, form: str, feature: str) -> set[str]:
    w = form.lower()
    if t["pos"] == "PRON":
        p = _PRONOUNS.get(w)
        if p is None:   # « cela », « qui »…: what the parse says, and they have no other form here
            parsed = t.get("morph", {}).get(feature)
            return {_MORPH_VALUE.get(parsed, parsed)} if parsed else _ANY[feature]
        v = p[_FEATURES.index(feature)]
        return {v} if v else _ANY[feature]
    if t["pos"] in {"NOUN", "PROPN"} and feature == "Person":
        return {"3"}
    if t["pos"] == "DET" and feature != "Person":
        first, second = _DET_VALUES[feature]
        names = ("s", "p") if feature == "Number" else ("m", "f")
        found = {names[0]} if w in first else set()
        found |= {names[1]} if w in second else set()
        if found:
            return found
    if w in {"l'", "l’"} and feature == "Number":
        return {"s"}
    if w == t["text"].lower() and feature != "Person":
        # A blank Lexique value on a word whose lemma has other forms (« avoine » / « avoines ») means
        # Lexique did not record it: the parse says which one this word is.
        own = _values_from_lexicon(lexicon, t, w, feature)
        parsed = t.get("morph", {}).get(feature)
        if own == _ANY[feature] and parsed in _MORPH_VALUE and (_repairs(lexicon, t) or not lexicon.lookup(w)):
            return {_MORPH_VALUE[parsed]}   # an unknown word too (« semaille »): the parse is all we have
        return own
    return _values_from_lexicon(lexicon, t, w, feature)


_MORPH_VALUE = {"Sing": "s", "Plur": "p", "Masc": "m", "Fem": "f"}


def _values_from_lexicon(lexicon, t: dict, w: str, feature: str) -> set[str]:
    finite = t.get("morph", {}).get("VerbForm") == "Fin"
    prefixes = {"NOUN": ("NOM",), "DET": ("ART", "ADJ", "PRE"), "ADJ": ("ADJ", "VER"), "VERB": ("VER", "AUX", "ADJ"),
                "AUX": ("AUX", "VER")}.get(t["pos"], ("NOM", "ADJ", "VER", "AUX", "ART"))
    known = lexicon.lookup(w)
    if not known:
        return _ANY[feature]   # a word Lexique does not know: nothing to say
    entries = [e for e in known if e.cgram.split(":")[0] in prefixes] or known
    tenses: set[str] = set()
    if finite:   # the verb's own lemma (« sommes » is also « sommer ») and its own moods and tenses
        entries = [e for e in entries if e.lemme == t["lemma"]] or entries
        tenses = {c.rsplit(":", 1)[0] for e in lexicon.lookup(t["text"]) if e.lemme == t["lemma"]
                  for c in e.infover.split(";") if c.count(":") == 2}
    out: set[str] = set()
    blank: set[str] = set()   # lemmas of rows that leave the value blank (« autres », ADJ:num)
    for e in entries:
        kind = e.cgram.split(":")[0]
        if kind in ("VER", "AUX"):
            codes = [c for c in e.infover.split(";") if c]
            if finite:
                for c in codes:
                    if (c.count(":") == 2 and c[-1] in "sp" and not c.startswith("par:")
                            and (not tenses or c.rsplit(":", 1)[0] in tenses)):
                        out |= {"Number": {c[-1]}, "Person": {c[-2]}, "Gender": _ANY["Gender"]}[feature]
                continue
            if "par:pas" not in codes:
                continue
        if feature == "Person":
            out |= _ANY["Person"]
            continue
        v = e.genre if feature == "Gender" else e.nombre
        if v:
            out.add(v)
        else:
            blank.add(e.lemme)
    if blank and not out:   # a blank row counts only when no row of the word gives the value
        for lemma in blank:
            out |= _suffix_value(lexicon, lemma, w, feature)
    return out   # empty: a form Lexique knows, but not in this role (another tense, a bare infinitive)


def _suffix_value(lexicon, lemma: str, w: str, feature: str) -> set[str]:
    """A value Lexique left blank, read off the lemma's other forms: « autres » is the plural of
    « autre », « grande » the feminine of « grand ». Any value when the forms do not say."""
    family = {e.ortho for e in lexicon.by_lemme.get(lemma, [])}
    marks = ("s", "x") if feature == "Number" else ("e",)
    values = ("s", "p") if feature == "Number" else ("m", "f")
    if any(w.endswith(m) and w[:-len(m)] in family for m in marks):
        return {values[1]}
    if any(w + m in family for m in marks):
        return {values[0]}
    return _ANY[feature]


_ORACLE_NOMINAL_DEPS = {"det", "amod", "nummod", "det:poss"}
_ORACLE_AUX_DEPS = {"aux", "aux:tense", "aux:pass", "cop"}
_ORACLE_CLITICS = {"le", "la", "les", "l'"}


def _parse_groups(tokens: list[dict]) -> list[dict]:
    """Agreement groups read off the dependency parse: a noun with its determiners, adjectives and
    bare participles; a subject (the antecedent, through « qui ») with its finite verbs and
    auxiliaries, and with its attribute or participle under « être »; a preceding object (a clitic or
    « que ») with its participle under « avoir ». A subject with « conj » dependents is a coordination."""
    kids: dict[int, list[dict]] = {}
    for t in tokens:
        if t["head"] != t["i"]:
            kids.setdefault(t["head"], []).append(t)
    groups: dict[tuple, dict] = {}

    def group(ctrl: int, conj: bool = False) -> set[int]:
        return groups.setdefault((ctrl, conj), {"controller": ctrl, "conj": conj, "members": set()})["members"]

    def finite(t: dict) -> bool:
        return t.get("morph", {}).get("VerbForm") == "Fin"

    for n in tokens:
        if n["pos"] in {"NOUN", "PROPN"}:
            for d in kids.get(n["i"], []):
                bare_participle = (d["dep"] == "acl" and d.get("morph", {}).get("VerbForm") == "Part"
                                   and not any(a["dep"] in _ORACLE_AUX_DEPS for a in kids.get(d["i"], [])))
                if d["dep"] in _ORACLE_NOMINAL_DEPS or bare_participle:
                    group(n["i"]).add(d["i"])
    for h in tokens:
        hk = kids.get(h["i"], [])
        subject = next((s for s in hk if s["dep"] in ("nsubj", "nsubj:pass")), None)
        if subject is None:
            continue
        relative = subject["text"].lower() == "qui" and h["dep"] == "acl:relcl"
        ctrl = h["head"] if relative else subject["i"]
        members = group(ctrl, any(k["dep"] == "conj" for k in kids.get(ctrl, [])))
        auxes = [a for a in hk if a["dep"] in _ORACLE_AUX_DEPS]
        members |= {x["i"] for x in [h, *auxes] if finite(x)}
        lemmas = {a["lemma"] for a in auxes}
        if finite(h) or not auxes:
            continue
        if "être" in lemmas or any(a["dep"] == "aux:pass" for a in auxes):
            members.add(h["i"])
        elif "avoir" in lemmas:
            for o in hk:
                if o["dep"] == "obj" and o["i"] < h["i"] and o["pos"] == "PRON":
                    if o["text"].lower() in _ORACLE_CLITICS:
                        group(o["i"]).add(h["i"])
                    elif o["text"].lower() in {"que", "qu'"} and h["dep"] == "acl:relcl":
                        a = h["head"]
                        group(a, any(k["dep"] == "conj" for k in kids.get(a, []))).add(h["i"])
    return list(groups.values())


def _words(g: dict) -> set[int]:
    return g["members"] | {g["controller"]}


def _group_agrees(lexicon, g: dict, by_i: dict, forms: dict[int, str]) -> bool:
    for feature in _FEATURES:
        common = set(_ANY[feature])
        for i in _words(g):
            if i == g["controller"] and g["conj"]:
                common &= {"p"} if feature == "Number" else _ANY[feature]   # the coordination is plural
                continue
            if feature == "Gender" and i != g["controller"] and by_i[i]["pos"] == "NOUN":
                continue   # « elle est médecin »: a predicate noun keeps its own gender
            common &= _values(lexicon, by_i[i], forms.get(i, by_i[i]["text"]), feature)
        if not common:
            return False
    return True


_ALL_DETERMINERS = ({*DET_NUMBER, *DET_NUMBER.values(), *DET_NUMBER_REVERSE, *DET_GENDER, *DET_GENDER.values(), "l'"}
                    | {d for pair in DET_NUMBER_REVERSE.values() for d in pair})
_OE = str.maketrans({"œ": "oe", "æ": "ae"})   # Lexique spells « soeur »
_PAIRS: dict[str, set[str]] = {}
for _m, _f in NOUN_GENDER_PAIRS:
    _PAIRS.setdefault(_m.translate(_OE), set()).add(_f.translate(_OE))
    _PAIRS.setdefault(_f.translate(_OE), set()).add(_m.translate(_OE))


_KINDS = {"NOUN": ("NOM",), "PROPN": ("NOM",), "ADJ": ("ADJ", "VER"), "VERB": ("VER", "AUX"),
          "AUX": ("AUX", "VER"), "PRON": ("PRO",), "DET": ("ART", "ADJ", "PRO")}


def _repairs(lexicon, t: dict) -> set[str]:
    """Every word a reader could put in `t`'s place and still write the same word, in the same role:
    the forms of its Lexique lemma (a noun's other nouns, a verb's other verb forms), of its gender
    counterpart, another personal pronoun, another determiner."""
    w = t["text"].lower().translate(_OE)
    if t["pos"] == "PRON" and w in _PRONOUNS:
        return set(_PRONOUNS) - {w}
    if t["pos"] == "DET" and t["dep"] in ("det", "det:poss"):
        return _ALL_DETERMINERS - {w}
    kinds = _KINDS.get(t["pos"], ("NOM", "ADJ", "VER", "AUX", "PRO", "ART"))
    lemmas = {e.lemme for e in lexicon.lookup(w) if e.cgram.split(":")[0] in kinds}
    lemmas |= {other for lemma in set(lemmas) for other in _PAIRS.get(lemma, set())}
    return {e.ortho for lemma in lemmas for e in lexicon.by_lemme.get(lemma, [])
            if e.cgram.split(":")[0] in kinds} - {w}


_DET_PAIRS = ({frozenset(p) for p in DET_NUMBER.items()} | {frozenset(p) for p in DET_GENDER.items()}
              | {frozenset((k, v)) for k, pair in DET_NUMBER_REVERSE.items() for v in pair})


def _same_word(lexicon, t: dict, mutated: str) -> bool:
    """Another form of the same word (« leurs » / « leur », « est » / « es »), not another word that
    sounds alike (« ses » / « ces »)."""
    lemmas = {e.lemme for e in lexicon.lookup(t["text"])} & {e.lemme for e in lexicon.lookup(mutated)}
    return bool(lemmas) or frozenset((t["text"].lower(), mutated.lower())) in _DET_PAIRS


def _ambiguous(lexicon, groups: list[dict], by_i: dict, cand: dict) -> bool:
    w = cand["token"]
    mine = [g for g in groups if w in _words(g)]
    if mine and all(_group_agrees(lexicon, g, by_i, {w: cand["mutated"]}) for g in mine):
        return True   # the plant breaks no agreement at all: nothing tells the reader it is wrong
    for g in mine:
        for u in _words(g) - {w}:
            if u == g["controller"] and g["conj"]:
                continue
            for alt in _repairs(lexicon, by_i[u]):
                forms = {w: cand["mutated"], u: alt}
                touched = [x for x in groups if {w, u} & _words(x)]
                if all(_group_agrees(lexicon, x, by_i, forms) for x in touched):
                    return True
    return False


def test_no_seed_text_offers_an_ambiguous_plant(nlp, lexicon):
    h = load_homophones(CONTENT)
    reform = load_reform(CONTENT)
    bad = []
    for path in sorted((CONTENT / "seed").glob("*.json")):
        body = json.loads(path.read_text(encoding="utf-8"))["body"]
        annotation = annotate(body, nlp, h, lexicon)
        by_i = {t["i"]: t for t in annotation["tokens"]}
        groups = _parse_groups(annotation["tokens"])
        cands = candidates(annotation, lexicon, h, set(), reform)
        for cat in (*AGREEMENT, "agreement:verb", "homophone"):
            for c in cands[cat]:
                if cat == "homophone" and not _same_word(lexicon, by_i[c["token"]], c["mutated"]):
                    continue  # « sa » → « ça » swaps in another word: no agreement to repair elsewhere
                if _ambiguous(lexicon, groups, by_i, c):
                    bad.append((path.name, cat, c["original"], c["mutated"], by_i[c["token"] + 1]["text"]))
    assert bad == []


def test_every_seed_text_reaches_its_plant_budget(nlp, lexicon):
    """The one-repair rule and the determiner ruling shrink the pools: every seed text must still
    give Éris her full `corruption_count`, whatever the seed."""
    h = load_homophones(CONTENT)
    reform = load_reform(CONTENT)
    weights = category_weights([], "10H")
    short = []
    for path in sorted((CONTENT / "seed").glob("*.json")):
        body = json.loads(path.read_text(encoding="utf-8"))["body"]
        annotation = annotate(body, nlp, h, lexicon)
        count = corruption_count(word_count(body))
        for seed in range(10):
            plants = plan_corruptions(body, annotation, lexicon, h, weights, count, random.Random(seed), set(), reform)
            if len(plants) < count:
                short.append((path.name, seed, len(plants), count))
    assert short == []
