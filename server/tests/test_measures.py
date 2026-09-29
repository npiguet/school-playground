from app.world.measures import lieutenant_measure, mistakes_per_100


def test_a_lieutenants_measure_sums_its_categories_derived_ones_included():
    bc = {"agreement:number": {"opportunities": 5, "draft": 2, "caught": 1, "missed": 1, "introduced": 0},
          "agreement:verb": {"opportunities": 15, "draft": 2, "caught": 2, "missed": 0, "introduced": 1},
          "homophone": {"opportunities": 9, "missed": 4}}
    assert lieutenant_measure(bc, ["agreement:number", "agreement:verb"]) == {"chances": 20, "left": 2, "correct": 0.9}
    lethe = {"derived:lethe": {"opportunities": 4, "draft": 2, "caught": 1, "missed": 1, "introduced": 0}}
    assert lieutenant_measure(lethe, ["derived:lethe"]) == {"chances": 4, "left": 1, "correct": 0.75}


def test_a_lieutenant_without_chances_has_no_correct_share():
    assert lieutenant_measure({}, ["homophone"]) == {"chances": 0, "left": 0, "correct": None}
    assert lieutenant_measure({"homophone": {"opportunities": 0, "introduced": 1}}, ["homophone"]) == {"chances": 0, "left": 1, "correct": None}


def test_mistakes_left_per_100_words_count_every_category():
    three = [{"category": "accent"}, {"category": "punctuation_case"}, {"category": "homophone"}]
    assert mistakes_per_100({"totalWords": 150, "finalErrors": three}) == 2.0
    assert mistakes_per_100({"totalWords": 120, "finalErrors": []}) == 0.0
    assert mistakes_per_100({"totalWords": 0, "finalErrors": [{}]}) == 0.0
    assert mistakes_per_100({"version": 1}) == 0.0
