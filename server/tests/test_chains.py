from app.nlp.chains import build_chains, nominal_group


def tok(i, text, pos, morph=None, head=None, dep="dep", lemma=None):
    return {"i": i, "text": text, "start": 0, "end": 0, "lemma": lemma or text.lower(), "pos": pos,
            "morph": morph or {}, "head": i if head is None else head, "dep": dep}


def by_kind(chains, kind):
    return [c for c in chains if c["kind"] == kind]


def test_subject_verb_high_and_nominal():
    # Les fées dansent .
    t = [tok(0, "Les", "DET", {"Number": "Plur"}, 1, "det"),
         tok(1, "fées", "NOUN", {"Gender": "Fem", "Number": "Plur"}, 2, "nsubj"),
         tok(2, "dansent", "VERB", {"VerbForm": "Fin", "Number": "Plur", "Person": "3", "Mood": "Ind", "Tense": "Pres"}, 2, "ROOT"),
         tok(3, ".", "PUNCT", {}, 2, "punct")]
    chains = build_chains(t)
    sv = by_kind(chains, "subject_verb")[0]
    assert sv["controller"] == 1 and sv["targets"] == [2] and sv["controller_group"] == [0, 1]
    assert sv["confidence"] == "high" and sv["via"] is None and sv["distance"] == 1
    assert sv["features"] == {"Gender": "Fem", "Number": "Plur", "Person": "3"}
    nom = by_kind(chains, "nominal")[0]
    assert nom["controller"] == 1 and nom["targets"] == [0] and nom["confidence"] == "high"
    assert nom["features"] == {"Gender": "Fem", "Number": "Plur"}
    assert nominal_group(t, 1) == [0, 1]


def test_inconsistent_morphology_is_low():
    t = [tok(0, "Les", "DET", {"Number": "Plur"}, 1, "det"),
         tok(1, "fées", "NOUN", {"Gender": "Fem", "Number": "Plur"}, 2, "nsubj"),
         tok(2, "dansent", "VERB", {"VerbForm": "Fin", "Number": "Sing", "Person": "3"}, 2, "ROOT")]
    assert by_kind(build_chains(t), "subject_verb")[0]["confidence"] == "low"


def test_aux_targets_and_participle_etre():
    # Elles sont parties .
    t = [tok(0, "Elles", "PRON", {"Gender": "Fem", "Number": "Plur", "Person": "3"}, 2, "nsubj"),
         tok(1, "sont", "AUX", {"VerbForm": "Fin", "Number": "Plur", "Person": "3", "Mood": "Ind", "Tense": "Pres"}, 2, "aux:tense", lemma="être"),
         tok(2, "parties", "VERB", {"VerbForm": "Part", "Gender": "Fem", "Number": "Plur"}, 2, "ROOT", lemma="partir")]
    chains = build_chains(t)
    sv = by_kind(chains, "subject_verb")[0]
    assert sv["targets"] == [1] and sv["controller"] == 0 and sv["via"] == "aux" and sv["confidence"] == "high"
    pe = by_kind(chains, "participle_etre")[0]
    assert pe["targets"] == [2] and pe["controller"] == 0 and pe["confidence"] == "high"
    assert pe["features"] == {"Gender": "Fem", "Number": "Plur", "Person": "3"}


def test_participle_avoir_rules():
    # Elle a mangé la pomme .  → no_agreement, high
    t = [tok(0, "Elle", "PRON", {"Gender": "Fem", "Number": "Sing", "Person": "3"}, 2, "nsubj"),
         tok(1, "a", "AUX", {"VerbForm": "Fin", "Number": "Sing", "Person": "3", "Mood": "Ind", "Tense": "Pres"}, 2, "aux:tense", lemma="avoir"),
         tok(2, "mangé", "VERB", {"VerbForm": "Part", "Gender": "Masc", "Number": "Sing"}, 2, "ROOT", lemma="manger"),
         tok(3, "la", "DET", {"Gender": "Fem", "Number": "Sing"}, 4, "det"),
         tok(4, "pomme", "NOUN", {"Gender": "Fem", "Number": "Sing"}, 2, "obj")]
    pa = by_kind(build_chains(t), "participle_avoir")[0]
    assert pa["rule"] == "no_agreement" and pa["confidence"] == "high" and pa["targets"] == [2]
    # Il les a mangées .  → cod_before, medium, controller = les
    t = [tok(0, "Il", "PRON", {"Gender": "Masc", "Number": "Sing", "Person": "3"}, 3, "nsubj"),
         tok(1, "les", "PRON", {"Number": "Plur", "Person": "3"}, 3, "obj"),
         tok(2, "a", "AUX", {"VerbForm": "Fin", "Number": "Sing", "Person": "3", "Mood": "Ind", "Tense": "Pres"}, 3, "aux:tense", lemma="avoir"),
         tok(3, "mangées", "VERB", {"VerbForm": "Part", "Gender": "Fem", "Number": "Plur"}, 3, "ROOT", lemma="manger")]
    pa = by_kind(build_chains(t), "participle_avoir")[0]
    assert pa["rule"] == "cod_before" and pa["controller"] == 1 and pa["confidence"] == "medium"


def test_attribute_relative_qui_and_conj():
    # Les enfants qui jouent sont contents .
    t = [tok(0, "Les", "DET", {"Number": "Plur"}, 1, "det"),
         tok(1, "enfants", "NOUN", {"Gender": "Masc", "Number": "Plur"}, 5, "nsubj"),
         tok(2, "qui", "PRON", {"PronType": "Rel"}, 3, "nsubj"),
         tok(3, "jouent", "VERB", {"VerbForm": "Fin", "Number": "Plur", "Person": "3"}, 1, "acl:relcl"),
         tok(4, "sont", "AUX", {"VerbForm": "Fin", "Number": "Plur", "Person": "3"}, 5, "cop", lemma="être"),
         tok(5, "contents", "ADJ", {"Gender": "Masc", "Number": "Plur"}, 5, "ROOT"),
         tok(6, ".", "PUNCT", {}, 5, "punct")]
    chains = build_chains(t)
    qui = next(c for c in by_kind(chains, "subject_verb") if 3 in c["targets"])
    assert qui["via"] == "qui" and qui["via_token"] == 2 and qui["controller"] == 1 and qui["confidence"] == "medium"
    cop = next(c for c in by_kind(chains, "subject_verb") if 4 in c["targets"])
    assert cop["controller"] == 1 and cop["confidence"] == "high"
    attr = by_kind(chains, "attribute")[0]
    assert attr["targets"] == [5] and attr["controller"] == 1 and attr["confidence"] == "high"
    # Pierre et Marie chantent .
    t = [tok(0, "Pierre", "PROPN", {"Number": "Sing"}, 3, "nsubj"),
         tok(1, "et", "CCONJ", {}, 2, "cc"),
         tok(2, "Marie", "PROPN", {"Number": "Sing"}, 0, "conj"),
         tok(3, "chantent", "VERB", {"VerbForm": "Fin", "Number": "Plur", "Person": "3"}, 3, "ROOT")]
    conj = by_kind(build_chains(t), "subject_verb")[0]
    assert conj["via"] == "conj" and conj["controller_group"] == [0, 2]
    assert conj["features"]["Number"] == "Plur" and conj["confidence"] == "medium"


def test_distance_and_ids():
    t = [tok(0, "Le", "DET", {"Number": "Sing"}, 1, "det"),
         tok(1, "chat", "NOUN", {"Gender": "Masc", "Number": "Sing"}, 12, "nsubj")]
    t += [tok(i, "x", "ADV", {}, 12, "advmod") for i in range(2, 12)]
    t += [tok(12, "dort", "VERB", {"VerbForm": "Fin", "Number": "Sing", "Person": "3"}, 12, "ROOT")]
    chains = build_chains(t)
    sv = by_kind(chains, "subject_verb")[0]
    assert sv["distance"] == 11 and sv["confidence"] == "medium"
    assert [c["id"] for c in chains] == list(range(len(chains)))


def test_participle_avoir_relative_que_targets_antecedent():
    # la pomme qu' il a mangée
    t = [tok(0, "la", "DET", {"Gender": "Fem", "Number": "Sing"}, 1, "det"),
         tok(1, "pomme", "NOUN", {"Gender": "Fem", "Number": "Sing"}, 1, "ROOT"),
         tok(2, "qu'", "PRON", {"PronType": "Rel"}, 5, "obj"),
         tok(3, "il", "PRON", {"Gender": "Masc", "Number": "Sing", "Person": "3"}, 5, "nsubj"),
         tok(4, "a", "AUX", {"VerbForm": "Fin", "Number": "Sing", "Person": "3"}, 5, "aux:tense", lemma="avoir"),
         tok(5, "mangée", "VERB", {"VerbForm": "Part", "Gender": "Fem", "Number": "Sing"}, 1, "acl:relcl", lemma="manger")]
    pa = by_kind(build_chains(t), "participle_avoir")[0]
    assert pa["rule"] == "cod_before" and pa["controller"] == 1 and pa["controller_group"] == [0, 1]
    assert pa["via"] == "que" and pa["via_token"] == 2 and pa["confidence"] == "medium"
    assert pa["features"] == {"Gender": "Fem", "Number": "Sing", "Person": "3"}


def test_participle_avoir_marked_without_cod_is_low():
    # A feminine participle after avoir with no preceding COD contradicts the rule: never explain it.
    t = [tok(0, "Elle", "PRON", {"Gender": "Fem", "Number": "Sing", "Person": "3"}, 2, "nsubj"),
         tok(1, "a", "AUX", {"VerbForm": "Fin", "Number": "Sing", "Person": "3"}, 2, "aux:tense", lemma="avoir"),
         tok(2, "mangée", "VERB", {"VerbForm": "Part", "Gender": "Fem", "Number": "Sing"}, 2, "ROOT", lemma="manger")]
    pa = by_kind(build_chains(t), "participle_avoir")[0]
    assert pa["rule"] == "no_agreement" and pa["confidence"] == "low"


def test_passive_participle_is_etre_chain():
    # Les pommes sont mangées .
    t = [tok(0, "Les", "DET", {"Number": "Plur"}, 1, "det"),
         tok(1, "pommes", "NOUN", {"Gender": "Fem", "Number": "Plur"}, 3, "nsubj:pass"),
         tok(2, "sont", "AUX", {"VerbForm": "Fin", "Number": "Plur", "Person": "3"}, 3, "aux:pass", lemma="être"),
         tok(3, "mangées", "VERB", {"VerbForm": "Part", "Gender": "Fem", "Number": "Plur"}, 3, "ROOT", lemma="manger")]
    chains = build_chains(t)
    pe = by_kind(chains, "participle_etre")[0]
    assert pe["controller"] == 1 and pe["controller_group"] == [0, 1] and pe["confidence"] == "high"
    assert by_kind(chains, "subject_verb")[0]["targets"] == [2]
    # Number mismatch on the participle → low
    t[3]["morph"] = {"VerbForm": "Part", "Gender": "Fem", "Number": "Sing"}
    assert by_kind(build_chains(t), "participle_etre")[0]["confidence"] == "low"


def test_nominal_group_includes_adverb_and_adjectival_participle():
    # les très grandes fées épuisées dansent
    t = [tok(0, "les", "DET", {"Number": "Plur"}, 3, "det"),
         tok(1, "très", "ADV", {}, 2, "advmod"),
         tok(2, "grandes", "ADJ", {"Gender": "Fem", "Number": "Plur"}, 3, "amod"),
         tok(3, "fées", "NOUN", {"Gender": "Fem", "Number": "Plur"}, 5, "nsubj"),
         tok(4, "épuisées", "VERB", {"VerbForm": "Part", "Gender": "Fem", "Number": "Plur"}, 3, "acl"),
         tok(5, "dansent", "VERB", {"VerbForm": "Fin", "Number": "Plur", "Person": "3"}, 5, "ROOT")]
    chains = build_chains(t)
    assert nominal_group(t, 3) == [0, 1, 2, 3, 4]
    nom = by_kind(chains, "nominal")[0]
    assert nom["targets"] == [0, 2, 4] and nom["confidence"] == "high"
    assert by_kind(chains, "subject_verb")[0]["controller_group"] == [0, 1, 2, 3, 4]
    # les fées qui sont épuisées : a participle with its own auxiliary is a clause, not part of the group
    t = [tok(0, "les", "DET", {"Number": "Plur"}, 1, "det"),
         tok(1, "fées", "NOUN", {"Gender": "Fem", "Number": "Plur"}, 1, "ROOT"),
         tok(2, "qui", "PRON", {"PronType": "Rel"}, 4, "nsubj"),
         tok(3, "sont", "AUX", {"VerbForm": "Fin", "Number": "Plur", "Person": "3"}, 4, "aux:pass", lemma="être"),
         tok(4, "épuisées", "VERB", {"VerbForm": "Part", "Gender": "Fem", "Number": "Plur"}, 1, "acl:relcl")]
    assert nominal_group(t, 1) == [0, 1]
    assert by_kind(build_chains(t), "nominal")[0]["targets"] == [0]
    # the noun is still reached through `qui` for the clause's participle
    pe = by_kind(build_chains(t), "participle_etre")[0]
    assert pe["controller"] == 1 and pe["via"] == "qui" and pe["confidence"] == "medium"


def test_nominal_mismatch_and_far_dependent():
    # une fées → det disagrees with the noun → low
    t = [tok(0, "une", "DET", {"Gender": "Fem", "Number": "Sing"}, 1, "det"),
         tok(1, "fées", "NOUN", {"Gender": "Fem", "Number": "Plur"}, 1, "ROOT")]
    assert by_kind(build_chains(t), "nominal")[0]["confidence"] == "low"
    # dependent more than 4 tokens away → medium
    t = [tok(0, "les", "DET", {"Number": "Plur"}, 1, "det"),
         tok(1, "fées", "NOUN", {"Gender": "Fem", "Number": "Plur"}, 1, "ROOT")]
    t += [tok(i, "x", "ADV", {}, 1, "advmod") for i in range(2, 7)]
    t += [tok(7, "belles", "ADJ", {"Gender": "Fem", "Number": "Plur"}, 1, "amod")]
    nom = by_kind(build_chains(t), "nominal")[0]
    assert nom["targets"] == [0, 7] and nom["confidence"] == "medium"


def test_controller_without_number_is_low_and_no_subject_means_no_chain():
    t = [tok(0, "on", "PRON", {"Person": "3"}, 1, "nsubj"),
         tok(1, "dort", "VERB", {"VerbForm": "Fin", "Number": "Sing", "Person": "3"}, 1, "ROOT")]
    assert by_kind(build_chains(t), "subject_verb")[0]["confidence"] == "low"
    t = [tok(0, "Dormir", "VERB", {"VerbForm": "Inf"}, 0, "ROOT"), tok(1, ".", "PUNCT", {}, 0, "punct")]
    assert build_chains(t) == []


def test_noun_attribute_checks_number_only():
    # Elle est médecin .  → predicate nouns do not inflect for gender: never present a gender rule
    t = [tok(0, "Elle", "PRON", {"Gender": "Fem", "Number": "Sing", "Person": "3"}, 2, "nsubj"),
         tok(1, "est", "AUX", {"VerbForm": "Fin", "Number": "Sing", "Person": "3"}, 2, "cop", lemma="être"),
         tok(2, "médecin", "NOUN", {"Gender": "Masc", "Number": "Sing"}, 2, "ROOT"),
         tok(3, ".", "PUNCT", {}, 2, "punct")]
    attr = by_kind(build_chains(t), "attribute")[0]
    assert attr["targets"] == [2] and attr["controller"] == 0 and attr["confidence"] == "high"
    assert attr["features"] == {"Number": "Sing"}
    # Elles sont médecin → Number mismatch is still caught
    t[0]["morph"] = {"Gender": "Fem", "Number": "Plur", "Person": "3"}
    assert by_kind(build_chains(t), "attribute")[0]["confidence"] == "low"
    # an adjective attribute keeps the gender check: Elle est content → low
    t[0]["morph"] = {"Gender": "Fem", "Number": "Sing", "Person": "3"}
    t[2] = tok(2, "content", "ADJ", {"Gender": "Masc", "Number": "Sing"}, 2, "ROOT")
    adj = by_kind(build_chains(t), "attribute")[0]
    assert adj["confidence"] == "low" and adj["features"] == {"Gender": "Fem", "Number": "Sing", "Person": "3"}


def _no_high(chains):
    return all(c["confidence"] != "high" for c in chains)


def test_impersonal_il_never_high():
    # Il pleut .
    t = [tok(0, "Il", "PRON", {"Gender": "Masc", "Number": "Sing", "Person": "3"}, 1, "nsubj"),
         tok(1, "pleut", "VERB", {"VerbForm": "Fin", "Number": "Sing", "Person": "3"}, 1, "ROOT", lemma="pleuvoir")]
    chains = build_chains(t)
    assert chains and _no_high(chains)
    # Il y a des fées .
    t = [tok(0, "Il", "PRON", {"Gender": "Masc", "Number": "Sing", "Person": "3"}, 2, "nsubj"),
         tok(1, "y", "PRON", {}, 2, "expl:comp"),
         tok(2, "a", "VERB", {"VerbForm": "Fin", "Number": "Sing", "Person": "3"}, 2, "ROOT", lemma="avoir"),
         tok(3, "des", "DET", {"Number": "Plur"}, 4, "det"),
         tok(4, "fées", "NOUN", {"Gender": "Fem", "Number": "Plur"}, 2, "obj")]
    assert _no_high(by_kind(build_chains(t), "subject_verb"))
    # Il a fallu partir .  → participle_avoir must not be high either
    t = [tok(0, "Il", "PRON", {"Gender": "Masc", "Number": "Sing", "Person": "3"}, 2, "nsubj"),
         tok(1, "a", "AUX", {"VerbForm": "Fin", "Number": "Sing", "Person": "3"}, 2, "aux:tense", lemma="avoir"),
         tok(2, "fallu", "VERB", {"VerbForm": "Part", "Gender": "Masc", "Number": "Sing"}, 2, "ROOT", lemma="falloir"),
         tok(3, "partir", "VERB", {"VerbForm": "Inf"}, 2, "xcomp")]
    assert _no_high(build_chains(t))
    # a personal « il » stays high
    t = [tok(0, "Il", "PRON", {"Gender": "Masc", "Number": "Sing", "Person": "3"}, 1, "nsubj"),
         tok(1, "dort", "VERB", {"VerbForm": "Fin", "Number": "Sing", "Person": "3"}, 1, "ROOT", lemma="dormir")]
    assert by_kind(build_chains(t), "subject_verb")[0]["confidence"] == "high"


def test_on_and_ce_never_high():
    # On dansait .  (« on » may stand for « nous »: participles and attributes can be plural)
    t = [tok(0, "On", "PRON", {"Number": "Sing", "Person": "3"}, 1, "nsubj"),
         tok(1, "dansait", "VERB", {"VerbForm": "Fin", "Number": "Sing", "Person": "3"}, 1, "ROOT")]
    sv = by_kind(build_chains(t), "subject_verb")[0]
    assert sv["confidence"] == "medium"
    # On est partis .
    t = [tok(0, "On", "PRON", {"Number": "Sing", "Person": "3"}, 2, "nsubj"),
         tok(1, "est", "AUX", {"VerbForm": "Fin", "Number": "Sing", "Person": "3"}, 2, "aux:tense", lemma="être"),
         tok(2, "partis", "VERB", {"VerbForm": "Part", "Gender": "Masc", "Number": "Plur"}, 2, "ROOT", lemma="partir")]
    assert _no_high(build_chains(t))
    # C' est une fée .  and  Ce sont des fées .  (the verb agrees with the attribute, not with « ce »)
    t = [tok(0, "C'", "PRON", {"Number": "Sing", "Person": "3"}, 3, "nsubj"),
         tok(1, "est", "AUX", {"VerbForm": "Fin", "Number": "Sing", "Person": "3"}, 3, "cop", lemma="être"),
         tok(2, "une", "DET", {"Gender": "Fem", "Number": "Sing"}, 3, "det"),
         tok(3, "fée", "NOUN", {"Gender": "Fem", "Number": "Sing"}, 3, "ROOT")]
    chains = build_chains(t)
    assert by_kind(chains, "subject_verb") and by_kind(chains, "attribute")
    assert _no_high(c for c in chains if c["kind"] != "nominal")
    t = [tok(0, "Ce", "PRON", {"Number": "Sing", "Person": "3"}, 3, "nsubj"),
         tok(1, "sont", "AUX", {"VerbForm": "Fin", "Number": "Plur", "Person": "3"}, 3, "cop", lemma="être"),
         tok(2, "des", "DET", {"Number": "Plur"}, 3, "det"),
         tok(3, "fées", "NOUN", {"Gender": "Fem", "Number": "Plur"}, 3, "ROOT")]
    assert _no_high(c for c in build_chains(t) if c["kind"] != "nominal")
