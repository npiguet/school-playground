from app.lexicon import verb_code


def test_lookup_and_known(lexicon):
    assert any(e.lemme == "cheval" and e.nombre == "p" for e in lexicon.lookup("chevaux"))
    assert lexicon.is_known("Chevaux") and lexicon.is_known("l'enfant") and lexicon.is_known("l’enfant")
    assert not lexicon.is_known("enfans") and not lexicon.is_known("xyzzy")


def test_forms_of_nouns_adjectives_participles(lexicon):
    assert lexicon.forms_of("chevaux")["cheval"] == {"g": "m", "n": "s"}
    belle = lexicon.forms_of("belle", lemma="beau")
    assert {"beau", "beaux", "belles"} <= set(belle) and belle["belles"] == {"g": "f", "n": "p"}
    assert "belle" not in belle
    mangees = lexicon.forms_of("mangées", lemma="manger")
    assert "mangé" in mangees and mangees["mangé"]["g"] == "m"
    assert "manger" not in mangees            # infinitive excluded
    assert len(lexicon.forms_of("mangées", lemma="manger", limit=3)) == 3


def test_verb_code():
    assert verb_code({"Mood": "Ind", "Tense": "Pres", "Person": "3", "Number": "Plur"}) == "ind:pre:3p"
    assert verb_code({"Mood": "Sub", "Tense": "Imp", "Person": "1", "Number": "Sing"}) == "sub:imp:1s"
    assert verb_code({"Mood": "Ind"}) is None


def test_flip_number(lexicon):
    plur = {"Mood": "Ind", "Tense": "Pres", "Person": "3", "Number": "Plur"}
    sing = {**plur, "Number": "Sing"}
    assert lexicon.flip_number("dansent", "danser", plur) == "danse"
    assert lexicon.flip_number("est", "être", sing) == "sont"
    assert lexicon.flip_number("ont", "avoir", plur) == "a"
    assert lexicon.flip_number("cheval", "cheval", {"Gender": "Masc", "Number": "Sing"}) == "chevaux"
    assert lexicon.flip_number("les", "le", {"Gender": "Fem", "Number": "Plur"}) == "la"
    assert lexicon.flip_number("les", "le", {"Gender": "Masc", "Number": "Plur"}) == "le"
    assert lexicon.flip_number("petites", "petit", {"Gender": "Fem", "Number": "Plur"}) == "petite"
    assert lexicon.flip_number("et", "et", {}) is None


def test_flip_gender(lexicon):
    assert lexicon.flip_gender("belle", "beau", {"Gender": "Fem", "Number": "Sing"}) == "beau"
    assert lexicon.flip_gender("mangée", "manger", {"Gender": "Fem", "Number": "Sing"}) == "mangé"
    assert lexicon.flip_gender("la", "le", {"Gender": "Fem"}) == "le"
    assert lexicon.flip_gender("petits", "petit", {"Gender": "Masc", "Number": "Plur"}) == "petites"
    assert lexicon.flip_gender("table", "table", {"Gender": "Fem"}) is None   # single-gender noun: nothing to flip


def test_sound_alikes(lexicon):
    assert "mère" in lexicon.sound_alikes("mer")
    assert "mer" not in lexicon.sound_alikes("mer")
    assert len(lexicon.sound_alikes("vert")) <= 5 and "verre" in lexicon.sound_alikes("vert")
