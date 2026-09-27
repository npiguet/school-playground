from app.lexicon import Entry, Lexicon, verb_code


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
    # a past participle under its verb's lemma, like flip_gender does (« parties » → « partie »)
    part = {"VerbForm": "Part", "Gender": "Fem", "Number": "Plur"}
    assert lexicon.flip_number("parties", "partir", part) == "partie"
    assert lexicon.flip_number("venus", "venir", {**part, "Gender": "Masc"}) == "venu"
    # a spaCy lemma the word itself does not have is ignored: « La pauvre enfant » was planted as
    # « La pauvre enfers » under the lemma « enfer »
    assert lexicon.flip_number("enfant", "enfer", {"VerbForm": "Part"}) == "enfants"


# SP2 playability P1-4: the Grimoire planted « étalaient → étala » (imparfait → passé simple) and
# « coupaient → coupe » because spaCy's tense tag was wrong; the flipped form must keep the word's
# own mood/tense/person and differ in number only.
def test_flip_number_keeps_tense_mood_and_person(lexicon):
    imp3p = {"Mood": "Ind", "Tense": "Imp", "Person": "3", "Number": "Plur", "VerbForm": "Fin"}
    assert lexicon.flip_number("étalaient", "étaler", imp3p) == "étalait"
    assert lexicon.flip_number("coupaient", "couper", {**imp3p, "Tense": "Pres"}) == "coupait"   # spaCy says Pres: wrong
    assert lexicon.flip_number("étalaient", "étaler", {**imp3p, "Tense": "Past"}) == "étalait"   # spaCy says Past: wrong
    assert lexicon.flip_number("roula", "rouler", {"Mood": "Ind", "Tense": "Pres", "Person": "3", "Number": "Sing"}) == "roulèrent"
    assert lexicon.flip_number("chantaient", "chanter", {"Number": "Plur"}) == "chantait"          # no tense at all
    assert lexicon.flip_number("mangez", "manger", {"Mood": "Imp", "Tense": "Pres", "Person": "2", "Number": "Plur"}) == "mange"
    assert lexicon.flip_number("fussent", "être", {"Mood": "Sub", "Tense": "Imp", "Person": "3", "Number": "Plur"}) == "fût"
    # a spelling the lexicon does not know as a verb is skipped, never guessed
    assert lexicon.flip_number("xylotaient", "xyloter", imp3p) is None


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


# --- Fix round 1 ---------------------------------------------------------------

def test_flip_gender_cette_next_word(lexicon):
    fem = {"Gender": "Fem", "Number": "Sing"}
    assert lexicon.flip_gender("cette", "ce", fem) == "ce"                        # no next_word: default "ce"
    assert lexicon.flip_gender("cette", "ce", fem, next_word="ami") == "cet"       # vowel-initial
    assert lexicon.flip_gender("cette", "ce", fem, next_word="homme") == "cet"     # known h muet
    assert lexicon.flip_gender("cette", "ce", fem, next_word="héros") == "ce"      # h aspiré: not in the mute-h list
    assert lexicon.flip_gender("cette", "ce", fem, next_word="table") == "ce"      # consonant-initial
    # forward direction (masculine -> "cette") is untouched by the many-to-one fix
    assert lexicon.flip_gender("ce", "ce", {}) == "cette"
    assert lexicon.flip_gender("cet", "ce", {}) == "cette"


def test_flip_gender_ambiguous_noun_skips_rather_than_guess(lexicon):
    # Lexique leaves "poste" (le poste / la poste) with a blank genre: genuinely
    # gender-ambiguous, and it is spelled the same either way. Must never guess.
    assert lexicon.flip_gender("poste", "poste", {}) is None
    assert lexicon.flip_gender("poste", "poste", {"Gender": "Masc", "Number": "Sing"}) is None


def test_flip_number_ambiguous_gender_noun_still_flips(lexicon):
    # A blank genre on a lexicon row must not make the (permissive) genre filter
    # reject an otherwise valid plural/singular match.
    assert lexicon.flip_number("poste", "poste", {"Gender": "Masc", "Number": "Sing"}) == "postes"
    assert lexicon.flip_number("postes", "poste", {"Gender": "Masc", "Number": "Plur"}) == "poste"


def test_flip_number_and_gender_prefer_entry_agreeing_with_morph(lexicon):
    # "table" is both a feminine noun (le/la table -> "table") and a homograph verb
    # form of "tabler" (VER, blank genre/nombre). Picking the wrong homograph would
    # make flip_gender's own-feature resolution see no gender at all.
    assert lexicon.flip_gender("table", "table", {"Gender": "Fem", "Number": "Sing"}) is None
    assert lexicon.is_known("table")


def _synthetic_lexicon() -> Lexicon:
    entries = [
        Entry("mange", "mAZ", "manger", "VER", "", "", "ind:pre:1s;ind:pre:3s;imp:pre:2s", 100.0),
        Entry("manges", "mAZ", "manger", "VER", "", "", "ind:pre:2s", 20.0),
        Entry("mangeons", "mAZ§", "manger", "VER", "", "", "ind:pre:1p;imp:pre:1p", 10.0),
        Entry("mangeaient", "mAZE", "manger", "VER", "", "", "ind:imp:3p", 5.0),
        Entry("manger", "mAZe", "manger", "VER", "", "", "inf", 200.0),
        Entry("mangé", "mAZe", "manger", "VER", "m", "s", "par:pas", 60.0),
        # Homograph sharing the ortho "mange" under an unrelated lemma. Its own finite
        # code (ind:imp:3s) must not leak into forms_of("mange", lemma="manger")'s
        # "finite" set, or it would wrongly make "mangeaient" (ind:imp:3p) look like a
        # sibling of "mange" (which has no imparfait forms of its own).
        Entry("mange", "mAZ", "mangelemma2", "VER", "", "", "ind:imp:3s", 1.0),
    ]
    by_ortho: dict[str, list[Entry]] = {}
    by_lemme: dict[str, list[Entry]] = {}
    by_phon: dict[str, list[Entry]] = {}
    for e in entries:
        by_ortho.setdefault(e.ortho, []).append(e)
        by_lemme.setdefault(e.lemme, []).append(e)
        by_phon.setdefault(e.phon, []).append(e)
    return Lexicon(by_ortho, by_lemme, by_phon)


def test_forms_of_finite_scoped_to_resolved_lemma():
    lex = _synthetic_lexicon()
    forms = lex.forms_of("mange", lemma="manger")
    assert "mangeons" in forms          # true sibling: same mood:tense:person, other number
    assert "mangeaient" not in forms    # only matches via the OTHER lemma's homograph if finite leaks
    assert "manger" not in forms        # infinitive excluded
