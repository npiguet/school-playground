import json
import logging
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.rules import RULES_FILENAME, load_rules
from app.world.dragon import DEFAULT_STAGE_XP
from app.world.fights import DEFAULT_FIGHTS
from app.world.seals import DEFAULT_LEVELS

LEVEL_DEFAULTS = [{"days": 3, "chances": 12, "correct": 0.85}, {"days": 4, "chances": 25, "correct": 0.88},
                  {"days": 6, "chances": 45, "correct": 0.91}, {"days": 8, "chances": 70, "correct": 0.94},
                  {"days": 10, "chances": 100, "correct": 0.97}]
FIGHT_DEFAULTS = [{"level": level, "count": count} for level in range(1, 6) for count in (2, "all")]
STAGE_DEFAULTS = {"egg": 0, "hatchling": 100, "young": 1200, "adult": 5000, "illustre": 15000, "ancestral": 40000}
DEFAULTS = {"quest_min_chances": 3, "quest_min_correct": 0.85, "fight_max_per_100": 4.0, "copy_belle_max_per_100": 2.0,
            "copy_correcte_max_per_100": 8.0, "aid_bonus": 0.2, "pace_bonus": {"1": 0.0, "2": 0.25, "3": 0.5},
            "prophecy_bonus": 0.5, "chouette_hints": 3, "dragon_stages": STAGE_DEFAULTS,
            "levels": LEVEL_DEFAULTS, "fights": FIGHT_DEFAULTS}


def write(tmp_path: Path, text: str) -> Path:
    (tmp_path / RULES_FILENAME).write_text(text, encoding="utf-8")
    return tmp_path


def test_no_file_means_the_built_in_rules(tmp_path):
    assert load_rules(tmp_path).as_dict() == DEFAULTS


def test_a_partial_file_keeps_the_other_defaults(tmp_path):
    rules = load_rules(write(tmp_path, '{"fight_max_per_100": 3, "pace_bonus": {"3": 0.6}, "chouette_hints": 5}'))
    assert rules.as_dict() == {**DEFAULTS, "fight_max_per_100": 3.0, "pace_bonus": {"1": 0.0, "2": 0.25, "3": 0.6},
                               "chouette_hints": 5}


def test_a_malformed_file_is_logged_and_ignored(tmp_path, caplog):
    with caplog.at_level(logging.WARNING):
        assert load_rules(write(tmp_path, '{"aid_bonus": 0.3,')).as_dict() == DEFAULTS
        assert load_rules(write(tmp_path, "[1, 2]")).as_dict() == DEFAULTS
    assert caplog.text.count(RULES_FILENAME) >= 2


def test_a_value_of_the_wrong_type_is_logged_and_its_default_kept(tmp_path, caplog):
    text = json.dumps({"aid_bonus": "0.3", "chouette_hints": 2.5, "quest_min_chances": True, "quest_min_correct": 1.5,
                       "fight_max_per_100": -1, "prophecy_bonus": None, "pace_bonus": {"2": "x", "4": 1, "3": 0.7},
                       "copy_belle_max_per_100": 1, "surprise": 1})
    with caplog.at_level(logging.WARNING):
        rules = load_rules(write(tmp_path, text))
    assert rules.as_dict() == {**DEFAULTS, "pace_bonus": {"1": 0.0, "2": 0.25, "3": 0.7}, "copy_belle_max_per_100": 1.0}
    for key in ("aid_bonus", "chouette_hints", "quest_min_chances", "quest_min_correct", "fight_max_per_100",
                "prophecy_bonus", "pace_bonus", "surprise"):
        assert key in caplog.text, key


def test_copy_limits_out_of_order_are_logged_and_both_defaults_apply(tmp_path, caplog):
    text = json.dumps({"copy_belle_max_per_100": 9, "copy_correcte_max_per_100": 5, "aid_bonus": 0.3})
    with caplog.at_level(logging.WARNING):
        rules = load_rules(write(tmp_path, text))
    assert rules.as_dict() == {**DEFAULTS, "aid_bonus": 0.3}
    assert "copy_belle_max_per_100" in caplog.text and "copy_correcte_max_per_100" in caplog.text
    # Only one of the pair given, and above the other's default: out of order all the same.
    assert load_rules(write(tmp_path, '{"copy_belle_max_per_100": 10}')).as_dict() == DEFAULTS
    # Equal limits are in order (no « copie correcte » band, by the owner's choice).
    assert load_rules(write(tmp_path, '{"copy_belle_max_per_100": 5, "copy_correcte_max_per_100": 5}')).as_dict() == {
        **DEFAULTS, "copy_belle_max_per_100": 5.0, "copy_correcte_max_per_100": 5.0}


def test_nan_and_infinity_are_refused(tmp_path):
    assert load_rules(write(tmp_path, '{"aid_bonus": NaN, "fight_max_per_100": Infinity}')).as_dict() == DEFAULTS


def test_an_integer_too_large_for_a_float_is_refused_and_start_up_works(settings, caplog):
    huge = "1" + "0" * 400
    text = ('{"aid_bonus": %s, "fight_max_per_100": %s, "chouette_hints": %s, "quest_min_chances": %s, '
            '"pace_bonus": {"2": %s}}' % (huge, huge, huge, huge, huge))
    assert load_rules(write(settings.data_dir.parent, text)).as_dict() == DEFAULTS
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    (settings.data_dir / RULES_FILENAME).write_text(text, encoding="utf-8")
    with caplog.at_level(logging.WARNING), TestClient(create_app(settings)) as c:
        assert c.get("/api/world").json()["rules"] == DEFAULTS
    for key in ("aid_bonus", "fight_max_per_100", "chouette_hints", "quest_min_chances", "pace_bonus"):
        assert key in caplog.text, key


def test_a_pace_bonus_that_is_not_an_object_keeps_the_built_in_one(tmp_path):
    assert load_rules(write(tmp_path, '{"pace_bonus": 0.3}')).as_dict() == DEFAULTS


def test_the_world_catalog_serves_the_rules_read_at_start_up(settings):
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    (settings.data_dir / RULES_FILENAME).write_text('{"chouette_hints": 1}', encoding="utf-8")
    with TestClient(create_app(settings)) as c:
        assert c.get("/api/world").json()["rules"] == {**DEFAULTS, "chouette_hints": 1}


def test_the_world_catalog_serves_the_defaults_without_a_file(client):
    assert client.get("/api/world").json()["rules"] == DEFAULTS


# The served example is shared with the client: web/src/lib/rules.test.ts parses the same `served`
# block as its GameRules, so the two sides cannot drift apart (seals as a list of five
# {days, chances, correct}, fights as {level, count: number | "all"}).
WORLD_RULES_EXAMPLE = Path(__file__).parent / "fixtures" / "rules" / "world_rules.json"


def test_the_world_catalog_serves_the_seals_and_fights_in_the_clients_shape(settings):
    example = json.loads(WORLD_RULES_EXAMPLE.read_text(encoding="utf-8"))
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    (settings.data_dir / RULES_FILENAME).write_text(json.dumps(example["regles"]), encoding="utf-8")
    with TestClient(create_app(settings)) as c:
        served = c.get("/api/world").json()["rules"]
    assert served == example["served"]
    assert all(set(s) == {"days", "chances", "correct"} and type(s["days"]) is int and type(s["chances"]) is int
               and type(s["correct"]) is float for s in served["levels"])
    assert all(set(f) == {"level", "count"} and type(f["level"]) is int and (f["count"] == "all" or type(f["count"]) is int)
               for f in served["fights"])


# Spec 2026-09-29 dragon growth §1: the thresholds live in the rules file, with the same fallback rules.
def test_the_built_in_stages_mirror_the_spec():
    assert DEFAULT_STAGE_XP == STAGE_DEFAULTS


def test_dragon_stages_from_the_file_keep_the_other_defaults(tmp_path):
    rules = load_rules(write(tmp_path, '{"dragon_stages": {"hatchling": 50, "ancestral": 30000}}'))
    assert rules.dragon_stages == {**STAGE_DEFAULTS, "hatchling": 50, "ancestral": 30000}
    assert rules.as_dict() == {**DEFAULTS, "dragon_stages": {**STAGE_DEFAULTS, "hatchling": 50, "ancestral": 30000}}


def test_a_wrong_dragon_stage_value_is_logged_and_its_default_kept(tmp_path, caplog):
    text = json.dumps({"dragon_stages": {"egg": 10, "hatchling": True, "young": 1200.5, "adult": -1, "dragon": 5,
                                         "ancestral": 10 ** 400, "illustre": 20000}})
    with caplog.at_level(logging.WARNING):
        rules = load_rules(write(tmp_path, text))
    assert rules.dragon_stages == {**STAGE_DEFAULTS, "illustre": 20000}
    for key in ("'egg'", "'hatchling'", "'young'", "'adult'", "'dragon'", "'ancestral'"):
        assert key in caplog.text, key


def test_an_egg_at_zero_is_accepted_quietly(tmp_path, caplog):
    with caplog.at_level(logging.WARNING):
        assert load_rules(write(tmp_path, '{"dragon_stages": {"egg": 0}}')).dragon_stages == STAGE_DEFAULTS
    assert caplog.text == ""


def test_dragon_stages_that_do_not_rise_are_refused_whole(tmp_path, caplog):
    with caplog.at_level(logging.WARNING):
        assert load_rules(write(tmp_path, '{"dragon_stages": {"young": 6000}}')).dragon_stages == STAGE_DEFAULTS
        assert load_rules(write(tmp_path, '{"dragon_stages": {"hatchling": 0}}')).dragon_stages == STAGE_DEFAULTS
        assert load_rules(write(tmp_path, '{"dragon_stages": {"illustre": 5000, "aid_bonus": 1}}')).dragon_stages == STAGE_DEFAULTS
    assert caplog.text.count("must rise") == 3


def test_dragon_stages_that_are_not_an_object_keep_the_built_in_ones(tmp_path):
    assert load_rules(write(tmp_path, '{"dragon_stages": [100, 1200], "chouette_hints": 2}')).as_dict() == {**DEFAULTS, "chouette_hints": 2}


# Spec 2026-09-29 lieutenant levels §1, §4: the seals' thresholds and Éris's ladder live in the rules file.
def test_the_built_in_seals_and_fights_mirror_the_spec():
    assert DEFAULT_LEVELS == LEVEL_DEFAULTS and DEFAULT_FIGHTS == FIGHT_DEFAULTS and len(FIGHT_DEFAULTS) == 10


def test_levels_from_the_file_keep_the_other_defaults(tmp_path):
    rules = load_rules(write(tmp_path, '{"levels": {"2": {"chances": 30}, "5": {"days": 12, "correct": 0.95}}}'))
    expected = [dict(r) for r in LEVEL_DEFAULTS]
    expected[1]["chances"] = 30
    expected[4].update(days=12, correct=0.95)
    assert rules.levels == expected
    assert rules.as_dict() == {**DEFAULTS, "levels": expected}


def test_a_wrong_level_value_is_logged_and_its_default_kept(tmp_path, caplog):
    text = json.dumps({"levels": {"1": {"days": 0, "chances": True, "correct": 1.5, "speed": 3, "correct ": 1},
                                  "2": {"correct": 0}, "3": [4], "6": {"days": 3}, "4": {"days": 9}}})
    with caplog.at_level(logging.WARNING):
        rules = load_rules(write(tmp_path, text))
    expected = [dict(r) for r in LEVEL_DEFAULTS]
    expected[3]["days"] = 9
    assert rules.levels == expected
    for bit in ("'days'", "'chances'", "'correct'", "'speed'", "'correct '", "'2'", "'3'", "'6'"):
        assert bit in caplog.text, bit
    # One warning per wrong value: seal 1's days, chances, correct, speed and « correct  », seal 2's
    # correct, seal 3 (a list) and seal 6 (no such seal).
    assert len([r for r in caplog.records if r.levelno == logging.WARNING]) == 8


def test_levels_that_are_not_an_object_keep_the_built_in_ones(tmp_path):
    assert load_rules(write(tmp_path, '{"levels": [3, 4], "chouette_hints": 2}')).as_dict() == {**DEFAULTS, "chouette_hints": 2}


def test_a_fight_ladder_from_the_file_replaces_the_built_in_one(tmp_path):
    rules = load_rules(write(tmp_path, '{"fights": [{"level": 1, "count": 3}, {"level": 2, "count": "all"}]}'))
    assert rules.fights == [{"level": 1, "count": 3}, {"level": 2, "count": "all"}]


@pytest.mark.parametrize("ladder", [
    "[]", '{"level": 1, "count": 2}', '[{"level": 6, "count": 2}]', '[{"level": 1, "count": 7}]',
    '[{"level": 1, "count": 0}]', '[{"level": 1, "count": "tous"}]', '[{"level": true, "count": 2}]',
    '[{"level": 1, "count": 2, "reward": "egide"}]', '[{"level": 1}]', '[{"level": 1, "count": 2}, 3]',
    json.dumps([{"level": 1, "count": 2}] * 21),
])
def test_a_wrong_fight_ladder_is_refused_whole(tmp_path, caplog, ladder):
    with caplog.at_level(logging.WARNING):
        rules = load_rules(write(tmp_path, '{"fights": %s, "chouette_hints": 2}' % ladder))
    assert rules.fights == FIGHT_DEFAULTS and rules.chouette_hints == 2
    assert "fights must be a list" in caplog.text
