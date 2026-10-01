import pytest
from app.world.mastery import (Window, boss_tiers, is_neutralised, lieutenants_for_level, mastery_window,
                               tier_available)
from app.rules import Rules
from app.world.xp import rank_for, session_xp
from app.world.quests import density, fight_won, quest_miss_reason, recommend_texts

R = Rules()
ODD = Rules(aid_bonus=0.33, pace_bonus={"1": 0.1, "2": 0.37, "3": 0.71}, prophecy_bonus=0.29)


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
    assert w.days == 4 and w.traps == 10 and w.rate == pytest.approx(1.0) and is_neutralised(w)


def test_window_does_not_dilute_with_older_unrelated_bad_day():
    # A legitimate minimal 3-day/10-trap window (09-20..09-22) must not be diluted by
    # folding in an older, unrelated bad day (09-15) once the window is already complete.
    w = mastery_window(rows(("2026-09-15", 5, 0), ("2026-09-20", 3, 3), ("2026-09-21", 3, 3), ("2026-09-22", 4, 4)))
    assert w.days == 3 and w.traps == 10 and w.rate == pytest.approx(1.0) and is_neutralised(w)


def test_window_no_data():
    assert mastery_window([]) == Window(days=0, traps=0, caught=0, rate=None, complete=False)


def test_boss_tiers():
    assert boss_tiers(6) == {1: 2, 2: 4, 3: 6} and boss_tiers(5) == {1: 2, 2: 4, 3: 5}
    assert tier_available(1, 6, set()) is None and tier_available(2, 6, set()) == 1
    assert tier_available(4, 6, {1}) == 2 and tier_available(6, 6, {1, 2, 3}) is None
    assert tier_available(4, 6, set()) == 1   # tiers are fought in order


def xp_result(words=150, left=3, caught=4):
    return {"totalWords": words, "finalErrors": [{}] * left, "caught": [{}] * caught}


def test_session_xp_the_worked_example():
    # Spec §4: 150 words, 3 mistakes left (m = 2), 4 caught, pace 2, two aids left:
    # effort 25, accuracy 24, rereading 8, bonus 65 % -> 25 + 32 × 1.65 = 78 XP.
    xp = session_xp(xp_result(), 2, "dictation", False, 2, R)
    assert xp.total == 78
    assert xp.parts == {"text": 57, "pace": 8, "aids": 13, "prophecy": 0}


def test_a_stale_pace_4_pays_as_pace_3_and_the_grimoire_has_no_pace_bonus():
    three = session_xp(xp_result(), 3, "dictation", False, 0, R)
    assert session_xp(xp_result(), 4, "dictation", False, 0, R) == three
    assert three.total == 73 and three.parts == {"text": 57, "pace": 16, "aids": 0, "prophecy": 0}
    grimoire = session_xp(xp_result(), 3, "grimoire", False, 0, R)
    assert grimoire.total == 57 and grimoire.parts["pace"] == 0


def test_the_prophecy_adds_its_bonus():
    xp = session_xp(xp_result(), 1, "dictation", True, 0, R)
    assert xp.total == 73 and xp.parts == {"text": 57, "pace": 0, "aids": 0, "prophecy": 16}


def test_the_bonus_never_multiplies_the_effort():
    # 15 left of 150 words is m = 10: no accuracy left, only the rereading takes the bonus.
    xp = session_xp(xp_result(left=15), 3, "dictation", True, 5, R)
    assert xp.total == 25 + 8 * 3 and xp.parts == {"text": 33, "pace": 4, "aids": 8, "prophecy": 4}
    bare = session_xp(xp_result(left=15, caught=0), 3, "dictation", True, 5, R)
    assert bare.total == 25 and bare.parts == {"text": 25, "pace": 0, "aids": 0, "prophecy": 0}


def test_the_parts_always_add_up_to_the_session_xp():
    for rules in (R, ODD):
        for words in (0, 7, 13, 120, 151, 333):
            for left in (0, 1, 4, 9):
                for caught in (0, 1, 5):
                    for pace in (1, 2, 3, 4):
                        for mode in ("dictation", "grimoire"):
                            for prophecy in (False, True):
                                for aids_left in range(6):
                                    xp = session_xp(xp_result(words, left, caught), pace, mode, prophecy, aids_left, rules)
                                    case = (words, left, caught, pace, mode, prophecy, aids_left)
                                    assert sum(xp.parts.values()) == xp.total, case
                                    assert min(xp.parts.values()) >= 0, case


def test_rank_for():
    assert rank_for(0) == (1, "Recrue du camp", 0, 150)
    assert rank_for(149) == (1, "Recrue du camp", 0, 150)
    assert rank_for(150) == (2, "Scribe des Muses", 150, 400)
    assert rank_for(9999) == (10, "Légende du camp", 8000, None)


def test_a_quest_session_counts_on_the_final_text():
    def bc(opportunities, missed=0, introduced=0):
        return {"homophone": {"opportunities": opportunities, "draft": 5, "caught": 5 - missed, "missed": missed, "introduced": introduced}}

    assert quest_miss_reason(bc(3), ["homophone"], R) is None                        # 3 chances, all right
    assert quest_miss_reason(bc(2), ["homophone"], R) is not None                       # too few chances
    assert quest_miss_reason(bc(20, missed=3), ["homophone"], R) is None             # 85 % exactly
    assert quest_miss_reason(bc(20, missed=2, introduced=2), ["homophone"], R) is not None   # 80 %: introduced count too
    assert quest_miss_reason({}, ["homophone"], R) is not None
    assert quest_miss_reason(bc(3), ["homophone"], Rules(quest_min_chances=4)) is not None
    assert quest_miss_reason(bc(20, missed=3), ["homophone"], Rules(quest_min_correct=0.9)) is not None
    # Why not: too few chances, or too many mistakes left in the copy.
    assert quest_miss_reason(bc(3), ["homophone"], R) is None
    assert quest_miss_reason(bc(2), ["homophone"], R) == "chances"
    assert quest_miss_reason({}, ["homophone"], R) == "chances"
    assert quest_miss_reason({}, ["homophone"], Rules(quest_min_chances=0)) == "chances"   # no chance at all
    assert quest_miss_reason(bc(20, missed=2, introduced=2), ["homophone"], R) == "copy"


def test_a_fight_is_won_on_the_whole_text():
    assert fight_won({"totalWords": 100, "finalErrors": [{}] * 4}, R) is True
    assert fight_won({"totalWords": 100, "finalErrors": [{}] * 5}, R) is False
    assert fight_won({"totalWords": 150, "finalErrors": [], "draftErrors": []}, R) is True    # a clean copy simply wins
    assert fight_won({"totalWords": 100, "finalErrors": [{}] * 4}, Rules(fight_max_per_100=3)) is False


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
    # P1-3 fix: level distance <= 1 from the player (10H) is preferred, in both directions - 11H
    # (id 3) is no longer excluded for being above level, it competes on density like the rest.
    rows_ = [{"id": 1, "title": "a", "level": "10H", "word_count": 100, "density": 4.0},
             {"id": 2, "title": "b", "level": "10H", "word_count": 100, "density": 9.0},
             {"id": 3, "title": "c", "level": "11H", "word_count": 100, "density": 9.0},
             {"id": 4, "title": "d", "level": "9H", "word_count": 100, "density": 6.0},
             {"id": 5, "title": "e", "level": "10H", "word_count": 100, "density": 7.0}]
    assert [r["id"] for r in recommend_texts(rows_, "hydre", "10H", played={2}, n=3)] == [3, 5, 4]
    assert [r["id"] for r in recommend_texts(rows_, "hydre", "10H", played=set(), n=2)] == [2, 3]


def test_recommend_texts_never_goes_below_level_minus_two():
    # P1-3: a 10H player must never be sent to a 7H text (level - 3) even if nothing closer exists;
    # 8H (level - 2) is the floor and is used as a last resort.
    rows_ = [{"id": 1, "title": "too low", "level": "7H", "word_count": 100, "density": 9.0},
             {"id": 2, "title": "floor", "level": "8H", "word_count": 100, "density": 5.0}]
    out = [r["id"] for r in recommend_texts(rows_, "hydre", "10H", played=set(), n=3)]
    assert out == [2]


def test_recommend_texts_enforces_minimum_length():
    # P1-3: density alone let a 13-word text with one hit "count" as a perfect recommendation -
    # too short to reliably meet the monster at all. word_count < 60 is excluded outright.
    rows_ = [{"id": 1, "title": "tiny", "level": "10H", "word_count": 13, "density": 30.0},
             {"id": 2, "title": "long enough", "level": "10H", "word_count": 60, "density": 5.0}]
    assert [r["id"] for r in recommend_texts(rows_, "hydre", "10H", played=set(), n=3)] == [2]


def test_recommend_texts_widens_from_one_step_to_two_then_any():
    # P1-3: the preference tiers only widen when the closer tier is short of `n` candidates.
    rows_ = [{"id": 1, "title": "near", "level": "10H", "word_count": 100, "density": 5.0},   # distance 0
             {"id": 2, "title": "two steps", "level": "8H", "word_count": 100, "density": 9.0}]  # distance 2
    assert [r["id"] for r in recommend_texts(rows_, "hydre", "10H", played=set(), n=2)] == [1, 2]
