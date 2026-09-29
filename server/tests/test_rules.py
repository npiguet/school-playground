import json
import logging
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import create_app
from app.rules import RULES_FILENAME, load_rules

DEFAULTS = {"quest_min_chances": 3, "quest_min_correct": 0.85, "fight_max_per_100": 4.0, "copy_belle_max_per_100": 2.0,
            "copy_correcte_max_per_100": 8.0, "aid_bonus": 0.2, "pace_bonus": {"1": 0.0, "2": 0.25, "3": 0.5},
            "prophecy_bonus": 0.5, "chouette_hints": 3}


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


def test_nan_and_infinity_are_refused(tmp_path):
    assert load_rules(write(tmp_path, '{"aid_bonus": NaN, "fight_max_per_100": Infinity}')).as_dict() == DEFAULTS


def test_a_pace_bonus_that_is_not_an_object_keeps_the_built_in_one(tmp_path):
    assert load_rules(write(tmp_path, '{"pace_bonus": 0.3}')).as_dict() == DEFAULTS


def test_the_world_catalog_serves_the_rules_read_at_start_up(settings):
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    (settings.data_dir / RULES_FILENAME).write_text('{"chouette_hints": 1}', encoding="utf-8")
    with TestClient(create_app(settings)) as c:
        assert c.get("/api/world").json()["rules"] == {**DEFAULTS, "chouette_hints": 1}


def test_the_world_catalog_serves_the_defaults_without_a_file(client):
    assert client.get("/api/world").json()["rules"] == DEFAULTS
