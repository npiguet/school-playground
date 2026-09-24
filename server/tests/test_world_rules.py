import pytest
from app.world.mastery import (Window, boss_tiers, dragon_stage, is_neutralised, lieutenants_for_level, mastery_window,
                               next_stage_at, tier_available)
from app.world.xp import rank_for, session_xp
from app.world.quests import density, evaluate_boss, lieutenant_totals, recommend_texts, session_counts_for


def rows(*triples):  # (day, draft, caught)
    return [{"day": d, "errors_in_draft": e, "caught": c} for d, e, c in triples]


def test_lieutenants_for_level_drops_protee_below_8h():
    assert "protee" not in lieutenants_for_level("7H")
    assert lieutenants_for_level("8H") == ["hydre", "echo", "chimere", "protee", "sirenes", "lethe"]


def test_window_needs_three_days_and_ten_traps():
    w = mastery_window(rows(("2026-09-20", 4, 4), ("2026-09-21", 4, 4)))
    assert w.days == 2 and w.traps == 8 and not w.complete and not is_neutralised(w)
    w = mastery_window(rows(("2026-09-20", 4, 4), ("2026-09-21", 4, 4), ("2026-09-22", 4, 3)))
    assert w.complete and w.days == 3 and w.traps == 12 and w.rate == pytest.approx(11 / 12) and is_neutralised(w)


def test_window_is_the_most_recent_minimal_span_and_ignores_empty_days():
    w = mastery_window(rows(("2026-09-01", 10, 0), ("2026-09-10", 0, 0), ("2026-09-20", 5, 5), ("2026-09-21", 3, 3), ("2026-09-22", 4, 4)))
    assert w.days == 3 and w.traps == 12 and w.rate == 1.0   # the bad day on 09-01 is outside the window


def test_window_extends_until_ten_traps():
    w = mastery_window(rows(("2026-09-19", 1, 0), ("2026-09-20", 2, 2), ("2026-09-21", 2, 2), ("2026-09-22", 2, 2), ("2026-09-23", 4, 4)))
    assert w.days == 5 and w.traps == 11 and w.rate == pytest.approx(10 / 11) and is_neutralised(w)


def test_window_no_data():
    assert mastery_window([]) == Window(days=0, traps=0, caught=0, rate=None, complete=False)


def test_dragon_stage_and_tiers():
    assert dragon_stage(0, 6) == "egg" and dragon_stage(1, 6) == "hatchling" and dragon_stage(3, 6) == "young" and dragon_stage(6, 6) == "adult"
    assert dragon_stage(2, 5) == "hatchling" and dragon_stage(3, 5) == "young" and dragon_stage(5, 5) == "adult"
    assert next_stage_at(0, 6) == 1 and next_stage_at(1, 6) == 3 and next_stage_at(6, 6) is None
    assert boss_tiers(6) == {1: 2, 2: 4, 3: 6} and boss_tiers(5) == {1: 2, 2: 4, 3: 5}
    assert tier_available(1, 6, set()) is None and tier_available(2, 6, set()) == 1
    assert tier_available(4, 6, {1}) == 2 and tier_available(6, 6, {1, 2, 3}) is None
    assert tier_available(4, 6, set()) == 1   # tiers are fought in order


def result(words=100, draft=4, caught=3, rate=0.75):
    return {"totalWords": words, "catchRate": rate, "caught": [{}] * caught, "draftErrors": [{}] * draft,
            "byCategory": {"agreement:verb": {"opportunities": 12, "draft": draft, "caught": caught, "missed": draft - caught, "introduced": 0}}}


def test_session_xp():
    assert session_xp(result(), 1, "dictation", False) == 10 + 10 + 15 + 23          # 58
    assert session_xp(result(), 3, "dictation", False) == 87                          # 58 × 1.5
    assert session_xp(result(), 3, "grimoire", False) == 58                          # grimoire: no pace multiplier
    assert session_xp(result(draft=0, caught=0, rate=None), 1, "dictation", False) == 10 + 10 + 0 + 15
    assert session_xp(result(), 1, "dictation", True) == 87                          # prophecy ×1.5


def test_rank_for():
    assert rank_for(0) == (1, "Recrue du camp", 0, 150)
    assert rank_for(149) == (1, "Recrue du camp", 0, 150)
    assert rank_for(150) == (2, "Scribe des Muses", 150, 400)
    assert rank_for(9999) == (10, "Légende du camp", 8000, None)


def test_lieutenant_totals_and_session_counts():
    bc = {"agreement:number": {"opportunities": 5, "draft": 2, "caught": 1, "missed": 1, "introduced": 0},
          "agreement:verb": {"opportunities": 7, "draft": 2, "caught": 1, "missed": 1, "introduced": 0}}
    assert lieutenant_totals(bc, ["agreement:number", "agreement:verb"]) == {"opportunities": 12, "draft": 4, "caught": 2, "missed": 2}
    assert session_counts_for(bc, ["agreement:number", "agreement:verb"], 0.5) is True
    assert session_counts_for(bc, ["agreement:number", "agreement:verb"], 0.6) is False
    assert session_counts_for({"homophone": {"opportunities": 3, "draft": 0, "caught": 0, "missed": 0, "introduced": 0}}, ["homophone"], 0.5) is True
    assert session_counts_for({"homophone": {"opportunities": 2, "draft": 0, "caught": 0, "missed": 0, "introduced": 0}}, ["homophone"], 0.5) is False
    assert session_counts_for({}, ["homophone"], 0.5) is False


def test_evaluate_boss():
    assert evaluate_boss(result(draft=5, caught=4, rate=0.8)) is True
    assert evaluate_boss(result(draft=5, caught=3, rate=0.6)) is False
    assert evaluate_boss(result(draft=2, caught=0, rate=0.0)) is True     # fewer than 3 traps: nothing to sabotage


def tok(i, pos, **kw):
    t = {"i": i, "text": "x", "start": 0, "end": 1, "lemma": "x", "pos": pos, "morph": {}, "head": i, "dep": "dep",
         "categories": [], "homophone": None, "subject": None}
    t.update(kw); return t


def test_density():
    ann = {"version": 1, "tokens": [tok(0, "DET", categories=["nominal_group"], morph={"Number": "Plur"}),
                                    tok(1, "NOUN", categories=["nominal_group"], morph={"Number": "Plur", "Gender": "Fem"}),
                                    tok(2, "VERB", categories=["verb"], morph={"Number": "Plur"}, subject=1),
                                    tok(3, "ADP", homophone="a_à", categories=["homophone"]),
                                    tok(4, "VERB", morph={"VerbForm": "Part"}, categories=["participle"])]}
    assert density(ann, 50, "hydre") == pytest.approx(6.0)       # tokens 0,1,2 plural → 3 per 50 words
    assert density(ann, 50, "echo") == pytest.approx(2.0)
    assert density(ann, 50, "chimere") == pytest.approx(2.0)     # one feminine nominal token
    assert density(ann, 50, "protee") == pytest.approx(2.0)
    assert density(ann, 50, "sirenes") == 0.0                    # v1: subject at distance 1, no qui
    assert density(ann, 50, "lethe") == 0.0 and density(ann, 130, "lethe") == 1.0


def test_recommend_texts_prefers_level_unplayed_and_density():
    rows_ = [{"id": 1, "title": "a", "level": "10H", "word_count": 100, "density": 4.0},
             {"id": 2, "title": "b", "level": "10H", "word_count": 100, "density": 9.0},
             {"id": 3, "title": "c", "level": "11H", "word_count": 100, "density": 9.0},   # above level: excluded
             {"id": 4, "title": "d", "level": "9H", "word_count": 100, "density": 6.0},
             {"id": 5, "title": "e", "level": "10H", "word_count": 100, "density": 7.0}]
    assert [r["id"] for r in recommend_texts(rows_, "hydre", "10H", played={2}, n=3)] == [5, 4, 1]
    assert [r["id"] for r in recommend_texts(rows_, "hydre", "10H", played=set(), n=2)] == [2, 5]
