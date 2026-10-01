"""The seals' window rule (spec 2026-09-29 lieutenant levels §1). Pure, plus the day reader."""
import sqlite3

import pytest

from app.db import DB_FILENAME
from app.world.catalog import LIEUTENANTS, MATERIALS, REWARDS, trophy_id
from app.world.seals import DEFAULT_LEVELS, LevelWindow, level_window, reaches, seal_day_rows, since_day
from tests.test_progression import hydre_result, post
from tests.test_sessions import make_profile, make_text

L1, L2 = DEFAULT_LEVELS[0], DEFAULT_LEVELS[1]


def days(*rows):  # (day, chances, mistakes)
    return [{"day": d, "chances": c, "mistakes": m} for d, c, m in rows]


def test_five_seals_each_a_material():
    assert MATERIALS == ("bois", "bronze", "argent", "or", "orichalque")


def test_the_window_takes_the_newest_days_until_it_holds_the_days_and_the_chances():
    w = level_window(days(("2026-09-01", 50, 40), ("2026-09-20", 4, 0), ("2026-09-21", 4, 0), ("2026-09-22", 4, 1)), None, L1)
    assert w == LevelWindow(days=3, chances=12, mistakes=1, correct=11 / 12, complete=True)
    assert reaches(w, L1)                                   # the bad day of 09-01 is outside the window
    # Three days hold only 9 chances: the window reaches back one more day, a bad one here.
    w = level_window(days(("2026-09-01", 10, 5), ("2026-09-20", 3, 0), ("2026-09-21", 3, 0), ("2026-09-22", 3, 0)), None, L1)
    assert (w.days, w.chances, w.mistakes, w.complete) == (4, 19, 5, True) and not reaches(w, L1)


def test_a_day_without_a_chance_is_not_a_day_of_guard():
    w = level_window(days(("2026-09-20", 0, 0), ("2026-09-21", 6, 0), ("2026-09-22", 6, 0)), None, L1)
    assert (w.days, w.chances, w.complete) == (2, 12, False) and not reaches(w, L1)


def test_only_days_strictly_after_the_last_seal_count():
    rows = days(("2026-09-20", 10, 0), ("2026-09-21", 10, 0), ("2026-09-22", 10, 0), ("2026-09-23", 10, 0))
    w = level_window(rows, "2026-09-21", L2)
    assert (w.days, w.chances, w.complete) == (2, 20, False)


def test_the_last_seals_day_is_the_swiss_day():
    assert since_day("2026-09-21T23:30:00+00:00") == "2026-09-22"      # 01:30 in Zurich
    assert since_day("2026-09-22T12:00:00+00:00") == "2026-09-22" and since_day(None) is None


def test_no_chance_no_share():
    w = level_window([], None, L1)
    assert w == LevelWindow(days=0, chances=0, mistakes=0, correct=None, complete=False) and not reaches(w, L1)
    # More mistakes than chances (a category's introduced ones) never makes a negative share.
    assert level_window(days(("2026-09-22", 2, 5)), None, {"days": 1, "chances": 1, "correct": 0.5}).correct == 0.0


# Review focus 3: 22/25 and 0.88 differ in the last bit of a float; the exact share must pass.
@pytest.mark.parametrize("i,chances", [(0, 20), (1, 25), (2, 100), (3, 100), (4, 100)])
def test_each_threshold_is_reached_exactly_at_its_share(i, chances):
    need = {**DEFAULT_LEVELS[i], "days": 1, "chances": chances}
    allowed = round(chances * (1 - DEFAULT_LEVELS[i]["correct"]))
    assert reaches(level_window(days(("2026-09-22", chances, allowed)), None, need), need)
    assert not reaches(level_window(days(("2026-09-22", chances, allowed + 1)), None, need), need)


def test_a_lieutenants_days_count_its_chances_and_the_mistakes_left(client, settings):
    pid = make_profile(client, level="10H"); tid = make_text(client)
    r = hydre_result(draft=4, caught=2)
    r["byCategory"]["agreement:verb"]["introduced"] = 1
    r["byCategory"]["agreement:number"] = {"opportunities": 5, "draft": 0, "caught": 0, "missed": 0, "introduced": 0}
    r["byCategory"]["homophone"] = {"opportunities": 7, "draft": 1, "caught": 0, "missed": 1, "introduced": 0}
    post(client, pid, tid, r, day="2026-09-21")
    post(client, pid, tid, hydre_result(), day="2026-09-22")
    conn = sqlite3.connect(settings.data_dir / DB_FILENAME)
    rows = sorted(seal_day_rows(conn, pid, LIEUTENANTS["hydre"]["categories"]), key=lambda x: x["day"])
    conn.close()
    assert rows == [{"day": "2026-09-21", "chances": 15, "mistakes": 3}, {"day": "2026-09-22", "chances": 10, "mistakes": 0}]


def test_thirty_trophies_one_per_lieutenant_and_seal():
    ids = [k for k in REWARDS if k.startswith("trophy:")]
    assert len(ids) == 30 and trophy_id("hydre", 2) == "trophy:hydre:2" and ids[0] == "trophy:hydre:1"
    assert REWARDS["trophy:hydre:1"] == {"id": "trophy:hydre:1", "kind": "trophy", "name": "Écaille de l'Hydre en bois",
                                         "desc": "Un souvenir taillé dans le bois d'olivier.", "source": "Sceau de bois de l'Hydre"}
    assert REWARDS["trophy:echo:3"]["name"] == "Voix d'Écho en argent"
    assert REWARDS["trophy:sirenes:5"]["name"] == "Plume de Sirène en orichalque"
    assert REWARDS["trophy:sirenes:5"]["source"] == "Sceau d'orichalque des Sirènes"
    assert REWARDS["trophy:lethe:4"]["desc"] == "Un souvenir d'or, orné de reliefs et de pierres fines."
