from app.nlp.retag import retag

FIN = {"Mood": "Ind", "Number": "Sing", "Person": "3", "Tense": "Pres", "VerbForm": "Fin"}


def tok(i, text, pos, morph=None, head=None, dep="dep", lemma=None):
    return {"i": i, "text": text, "start": 0, "end": 0, "lemma": lemma or text.lower(), "pos": pos,
            "morph": morph or {}, "head": i if head is None else head, "dep": dep}


def test_word_with_no_verb_reading_is_never_a_participle(lexicon):
    # « une jeune pubère filiforme »: the tagger called « pubère » a past participle (acl).
    t = [tok(0, "une", "DET", {"Gender": "Fem", "Number": "Sing"}, 1, "det"),
         tok(1, "jeune", "NOUN", {"Gender": "Fem", "Number": "Sing"}, 1, "ROOT"),
         tok(2, "pubère", "VERB", {"Gender": "Fem", "Number": "Sing", "Tense": "Past", "VerbForm": "Part"}, 1, "acl")]
    out = retag(t, lexicon)
    assert out[2]["pos"] == "ADJ"
    assert out[2]["morph"] == {"Gender": "Fem", "Number": "Sing"}
    assert out[2]["dep"] == "acl" and out[2]["head"] == 1  # the parse itself is left alone


def test_plural_adjective_takes_its_number_from_the_lexicon(lexicon):
    # « des jeunes filles pubères »
    t = [tok(0, "filles", "NOUN", {"Gender": "Fem", "Number": "Plur"}, 0, "ROOT"),
         tok(1, "pubères", "VERB", {"Tense": "Past", "VerbForm": "Part"}, 0, "acl")]
    assert retag(t, lexicon)[1]["morph"] == {"Number": "Plur"}


def test_noun_homograph_with_a_determiner_is_a_noun(lexicon):
    # « Elles leur ôtent leur estime de soi »: « leur » hangs on « estime » as its determiner.
    t = [tok(0, "Elles", "PRON", {"Number": "Plur"}, 2, "nsubj"),
         tok(1, "leur", "PRON", {}, 2, "iobj"),
         tok(2, "ôtent", "VERB", {**FIN, "Number": "Plur"}, 2, "ROOT"),
         tok(3, "leur", "DET", {"Number": "Sing", "Poss": "Yes"}, 4, "det"),
         tok(4, "estime", "VERB", FIN, 2, "obj")]
    out = retag(t, lexicon)
    assert out[4]["pos"] == "NOUN"
    assert out[4]["morph"] == {"Gender": "Fem", "Number": "Sing"}
    assert out[2]["pos"] == "VERB" and out[2]["morph"] == {**FIN, "Number": "Plur"}


def test_noun_homograph_after_a_preposition_is_a_noun(lexicon):
    # « un coup de lance »: « de » is the case marker of « lance ».
    t = [tok(0, "coup", "NOUN", {"Gender": "Masc", "Number": "Sing"}, 0, "ROOT"),
         tok(1, "de", "ADP", {}, 2, "case"),
         tok(2, "lance", "VERB", FIN, 0, "nmod")]
    assert retag(t, lexicon)[2]["pos"] == "NOUN"


def test_verb_homograph_used_as_a_verb_stays_a_verb(lexicon):
    # « Il la montre »: « la » is a clitic object, not a determiner of « montre ».
    t = [tok(0, "Il", "PRON", {"Number": "Sing", "Person": "3"}, 2, "nsubj"),
         tok(1, "la", "PRON", {"Gender": "Fem", "Number": "Sing", "Person": "3"}, 2, "obj"),
         tok(2, "montre", "VERB", FIN, 2, "ROOT")]
    out = retag(t, lexicon)
    assert out[2]["pos"] == "VERB" and out[2]["morph"] == FIN


def test_unknown_word_keeps_the_tagger_call(lexicon):
    t = [tok(0, "Il", "PRON", {}, 1, "nsubj"), tok(1, "zorglubait", "VERB", FIN, 1, "ROOT")]
    assert retag(t, lexicon)[1]["pos"] == "VERB"


def test_infinitive_is_left_alone(lexicon):
    # Only conjugated verbs and participles are re-checked; « à reculons » and infinitives are not ours.
    t = [tok(0, "sans", "ADP", {}, 1, "case"), tok(1, "trembler", "VERB", {"VerbForm": "Inf"}, 1, "ROOT")]
    assert retag(t, lexicon)[1]["pos"] == "VERB"


def test_subject_pronoun_person_comes_from_the_pronoun(lexicon):
    # Both French models tag « tu » as first person, which broke « tu retrouveras ».
    t = [tok(0, "tu", "PRON", {"Number": "Sing", "Person": "1"}, 1, "nsubj"),
         tok(1, "retrouveras", "VERB", {**FIN, "Tense": "Fut", "Person": "2"}, 1, "ROOT")]
    assert retag(t, lexicon)[0]["morph"] == {"Number": "Sing", "Person": "2"}
    t = [tok(0, "-ils", "PRON", {"Gender": "Masc", "Number": "Sing"}, 1, "nsubj"), tok(1, "dirent", "VERB", FIN, 1, "ROOT")]
    assert retag(t, lexicon)[0]["morph"] == {"Gender": "Masc", "Number": "Plur", "Person": "3"}


def test_verb_person_follows_the_only_reading_the_lexicon_allows(lexicon):
    # « retrouveras » can only be 2nd person singular: the tagger's 3rd person is overruled.
    t = [tok(0, "tu", "PRON", {"Number": "Sing", "Person": "2"}, 1, "nsubj"),
         tok(1, "retrouveras", "VERB", {**FIN, "Tense": "Fut"}, 1, "ROOT")]
    assert retag(t, lexicon)[1]["morph"] == {**FIN, "Tense": "Fut", "Person": "2"}
    # « montre » is 1st or 3rd person: an ambiguous form keeps the tagger's reading
    t = [tok(0, "Elle", "PRON", {"Number": "Sing", "Person": "3"}, 1, "nsubj"), tok(1, "montre", "VERB", FIN, 1, "ROOT")]
    assert retag(t, lexicon)[1]["morph"] == FIN


def test_clause_initial_verb_without_subject_is_an_imperative(lexicon):
    # « Va voir comment se porte ta mère » / « Élevez-le avec patience »
    t = [tok(0, "«", "PUNCT", {}, 1, "punct"),
         tok(1, "Élevez", "VERB", {**FIN, "Number": "Plur", "Person": "2"}, 1, "ROOT"),
         tok(2, "-le", "PRON", {}, 1, "obj")]
    out = retag(t, lexicon)[1]
    assert out["morph"]["Mood"] == "Imp" and out["morph"]["Person"] == "2" and out["morph"]["Number"] == "Plur"
    t = [tok(0, "Va", "VERB", FIN, 0, "ROOT"), tok(1, "voir", "VERB", {"VerbForm": "Inf"}, 0, "xcomp")]
    assert retag(t, lexicon)[0]["morph"]["Mood"] == "Imp"
    # « Mais n'allez pas croire »: negation and clitics may come first
    t = [tok(0, "Mais", "CCONJ", {}, 2, "cc"), tok(1, "n'", "ADV", {}, 2, "advmod"),
         tok(2, "allez", "VERB", {**FIN, "Number": "Plur", "Person": "2"}, 2, "ROOT")]
    assert retag(t, lexicon)[2]["morph"]["Mood"] == "Imp"


def test_verb_with_a_subject_or_inside_a_clause_is_not_an_imperative(lexicon):
    t = [tok(0, "Tu", "PRON", {"Number": "Sing", "Person": "2"}, 1, "nsubj"), tok(1, "vas", "VERB", FIN, 1, "ROOT")]
    assert retag(t, lexicon)[1]["morph"].get("Mood") == "Ind"
    # « comment se porte ta mère » (subject inverted and missed by the parser): not clause-initial
    t = [tok(0, "comment", "ADV", {}, 2, "advmod"), tok(1, "se", "PRON", {}, 2, "expl:pv"),
         tok(2, "porte", "VERB", FIN, 2, "ccomp")]
    assert retag(t, lexicon)[2]["morph"].get("Mood") == "Ind"
    # « Depuis quelques décennies existe un phénomène »: no imperative reading of « existe » past a noun
    t = [tok(0, "décennies", "NOUN", {}, 1, "obl"), tok(1, "existe", "VERB", FIN, 1, "ROOT")]
    assert retag(t, lexicon)[1]["morph"].get("Mood") == "Ind"


def test_input_tokens_are_not_mutated(lexicon):
    t = [tok(0, "pubère", "VERB", {"VerbForm": "Part"}, 0, "ROOT")]
    retag(t, lexicon)
    assert t[0]["pos"] == "VERB"
