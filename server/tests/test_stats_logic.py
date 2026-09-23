from app.stats import next_help_stage, argus_order, stat_key


def test_help_stage_moves_up_after_three_good_texts():
    assert next_help_stage(1, [0.8, 0.75, 0.7]) == 2
    assert next_help_stage(1, [0.8, 0.75]) == 1
    assert next_help_stage(1, [0.8, 0.6, 0.9]) == 1
    assert next_help_stage(4, [1.0, 1.0, 1.0]) == 4


def test_help_stage_moves_down_after_two_bad_texts():
    assert next_help_stage(3, [0.2, 0.3]) == 2
    assert next_help_stage(3, [0.2, 0.5]) == 3
    assert next_help_stage(1, [0.0, 0.0]) == 1


def test_stat_key():
    assert stat_key({"category": "agreement", "sub": "verb"}) == "agreement:verb"
    assert stat_key({"category": "agreement"}) == "agreement:other"
    assert stat_key({"category": "homophone", "sub": "verb_ending"}) == "homophone"


def row(cat, draft, missed):
    return {"category": cat, "errors_in_draft": draft, "missed": missed, "caught": draft - missed, "occurrences": 50}


def test_argus_order_weakest_first_with_minimum_evidence():
    assert argus_order([]) == ["verbes", "groupes_nominaux", "homophones", "mots_pieges"]
    rows = [row("agreement:verb", 10, 2), row("homophone", 8, 6), row("agreement:number", 3, 3)]
    # number has only 3 draft errors -> not enough evidence, keeps default rank
    assert argus_order(rows) == ["homophones", "verbes", "groupes_nominaux", "mots_pieges"]
