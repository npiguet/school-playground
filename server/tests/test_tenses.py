"""Verb tenses of a text and the class that has learnt them (app.nlp.tenses, PER L1 26 / L1 36).

Real sentences through the test model (fr_core_news_sm, the one that mis-tags tenses most: it calls
« regarda » a participle, « fût » an adjective, « Viens » a noun), so the Lexique-first reading is
what these pin. The production parser gives the same answers (app.tools.tense_levels)."""
from pathlib import Path

import pytest

from app.nlp.annotate import annotate
from app.nlp.homophones import load_homophones
from app.nlp.tenses import (TENSES, detect_tenses, level_with_tenses, tense_forms, tense_level,
                            tense_reason)

CONTENT = Path(__file__).resolve().parents[2] / "content"


@pytest.fixture(scope="module")
def tenses_of(nlp, lexicon):
    homophones = load_homophones(CONTENT)
    return lambda text: detect_tenses(annotate(text, nlp, homophones, lexicon), lexicon)


@pytest.mark.parametrize("sentence, expected", [
    # Passé simple, 3rd person (8H) and 1st/2nd persons (9H).
    ("Le loup regarda la chèvre et partit dans la forêt.", {"passe_simple_3": 2}),
    ("Les enfants furent surpris et rentrèrent chez eux.", {"passe_simple_3": 2}),
    ("Il mit son manteau et prit son chapeau.", {"passe_simple_3": 2}),
    ("Nous allâmes au marché, puis nous rentrâmes.", {"passe_simple_12": 2}),
    ("Tu fus le premier à partir.", {"passe_simple_12": 1}),
    ("Je pris mon courage à deux mains.", {"passe_simple_12": 1}),
    # « sortis » has no présent reading (« je sors »): unambiguous.
    ("Je finis mon travail et je sortis.", {"passe_simple_12": 1}),
    # Ambiguous: présent or passé simple, so nothing.
    ("Il finit son assiette.", {}),
    ("Je finis mon assiette.", {}),
    # « vit » under voir is a passé simple (under vivre it would be a présent).
    ("Il vit un loup dans la clairière.", {"passe_simple_3": 1}),
    # Compound tenses: the auxiliary's tense.
    ("Elle a mangé une pomme.", {"passe_compose": 1}),
    ("Il a pris son chapeau.", {"passe_compose": 1}),
    ("Elle est partie très tôt.", {"passe_compose": 1}),
    ("Il s'est levé de bonne heure.", {"passe_compose": 1}),
    ("Ils avaient marché toute la nuit.", {"plus_que_parfait": 1}),
    ("Ils ne s'étaient pas encore réveillés.", {"plus_que_parfait": 1}),
    ("Quand il aura fini, il partira.", {"futur": 1, "futur_anterieur": 1}),
    ("Dès qu'il eut fini, il sortit.", {"passe_anterieur": 1, "passe_simple_3": 1}),
    ("Elle aurait voulu partir.", {"conditionnel_passe": 1}),
    ("S'il avait su, il eût agi autrement.", {"plus_que_parfait": 1, "subjonctif_pqp": 1}),
    ("La maison a été construite par mon grand-père.", {"passe_compose": 1}),
    # A passive is its auxiliary's simple tense; an adjective participle is no tense.
    ("Il fut tué par le géant.", {"passe_simple_3": 1}),
    ("La porte est fermée.", {}),
    ("Il avait les yeux fermés.", {}),
    # Subjonctif.
    ("Il faut qu'il vienne demain.", {"subjonctif": 1}),
    ("Il fallait qu'il fût là avant l'aube.", {"subjonctif_imparfait": 1}),
    ("Le fût du canon brillait au soleil.", {}),
    ("Soit tu viens, soit tu restes.", {}),
    # Futur, conditionnel, futur proche.
    ("Demain, nous irons à la mer.", {"futur": 1}),
    ("Si j'étais riche, j'achèterais un château.", {"conditionnel": 1}),
    ("Il est content et il va partir.", {}),
    # Impératif: a clause that opens on the verb, no subject.
    ("Viens ici tout de suite !", {"imperatif": 1}),
    ("Regarde la mer, mon enfant.", {"imperatif": 1}),
    ("Écoutez-moi bien, mes amis.", {"imperatif": 1}),
    ("Dépêchez-vous, les enfants !", {"imperatif": 1}),
    ("Ne regarde pas en arrière.", {"imperatif": 1}),
    ("Le roi dit : « Sois sage. »", {"imperatif": 1}),
    ("Venez-vous avec nous ?", {}),
    ("Le chat mange la souris.", {}),
    ("Nous chantons et dansons toute la nuit.", {}),
])
def test_detects_unambiguous_tenses(tenses_of, sentence, expected):
    assert tenses_of(sentence) == expected


def test_reads_a_seed_passage(nlp, lexicon):
    """Perrault's « Le Chat botté », in the seed: one « qu'il montât », one « qu'il fût » (11H), and
    « vous serez tous hachés » a passive futur simple, never a futur antérieur."""
    import json
    body = json.loads((CONTENT / "seed" / "004-perrault-chat-botte.json").read_text(encoding="utf-8"))["body"]
    forms = tense_forms(annotate(body, nlp, load_homophones(CONTENT), lexicon), lexicon)
    assert ("subjonctif_imparfait", "montât") in forms and ("subjonctif_imparfait", "fût") in forms
    assert ("passe_simple_3", "ordonna") in forms
    assert not any(key == "futur_anterieur" for key, _ in forms)
    assert ("futur", "serez") in forms


def test_every_tense_has_a_class_and_a_french_name():
    from app.levels import LEVELS
    assert all(level in LEVELS and name for level, name in TENSES.values())
    assert TENSES["passe_simple_3"] == ("8H", "passé simple")


def test_level_rule():
    assert tense_level({}) is None
    assert tense_level({"futur": 3, "passe_compose": 1}) == "7H"
    assert tense_level({"passe_simple_3": 1, "subjonctif_imparfait": 1}) == "11H"
    # The text's level is the higher of its own and its tenses'; never lowered.
    assert level_with_tenses("5H", {"passe_simple_3": 4}) == "8H"
    assert level_with_tenses("10H", {"passe_simple_3": 4}) == "10H"
    assert level_with_tenses("6H", {}) == "6H"
    # One unambiguous form is enough (MIN_OCCURRENCES); a stricter count can be asked for.
    assert level_with_tenses("5H", {"passe_simple_3": 1}) == "8H"
    assert level_with_tenses("5H", {"passe_simple_3": 1}, least=2) == "5H"


def test_reason_names_the_tenses_that_raised_the_text():
    assert tense_reason("5H", {"passe_simple_3": 2, "futur": 1}) == "passé simple"
    assert tense_reason("5H", {"passe_simple_3": 1, "plus_que_parfait": 1}) == "plus-que-parfait, passé simple"
    assert tense_reason("8H", {"passe_simple_3": 2}) is None   # already 8H: the tenses raised nothing
    assert tense_reason("5H", {}) is None
