"""The dragon grows from total XP (spec 2026-09-29 dragon growth §1, §4)."""
import sqlite3

from fastapi.testclient import TestClient

from app.db import DB_FILENAME
from app.main import create_app
from app.rules import RULES_FILENAME
from app.world.dragon import (DEFAULT_STAGE_XP, STAGE_ORDER, grown_stage, stage_for_xp, stage_gauge, stage_index,
                              stage_table)
from tests.test_progression import hydre_result, post
from tests.test_sessions import make_profile, make_text

STAGES = [{"key": "egg", "name": "Œuf", "xp": 0}, {"key": "hatchling", "name": "Dragonnet", "xp": 100},
          {"key": "young", "name": "Jeune dragon", "xp": 1200}, {"key": "adult", "name": "Dragon adulte", "xp": 5000},
          {"key": "illustre", "name": "Dragon illustre", "xp": 15000},
          {"key": "ancestral", "name": "Dragon ancestral", "xp": 40000}]


def db(settings) -> sqlite3.Connection:
    return sqlite3.connect(settings.data_dir / DB_FILENAME)


def give_xp(settings, pid: int, amount: int) -> None:
    conn = db(settings)
    conn.execute("INSERT INTO xp_event(profile_id, amount, reason, created_at) VALUES (?, ?, 'session', ?)",
                 (pid, amount, "2026-09-30T10:00:00+00:00"))
    conn.commit(); conn.close()


def set_stage(settings, pid: int, stage: str) -> None:
    conn = db(settings)
    conn.execute("UPDATE dragon SET stage = ? WHERE profile_id = ?", (stage, pid))
    conn.commit(); conn.close()


def stored(settings, pid: int) -> tuple:
    conn = db(settings)
    row = conn.execute("SELECT stage, hatched_at FROM dragon WHERE profile_id = ?", (pid,)).fetchone()
    conn.close()
    return row


def app_with_rules(settings, text: str) -> TestClient:
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    (settings.data_dir / RULES_FILENAME).write_text(text, encoding="utf-8")
    return TestClient(create_app(settings))


def test_six_stages_on_a_rising_curve():
    assert STAGE_ORDER == ("egg", "hatchling", "young", "adult", "illustre", "ancestral")
    t = DEFAULT_STAGE_XP
    assert [stage_for_xp(x, t) for x in (0, 99, 100, 1199, 1200, 4999, 5000, 14999, 15000, 39999, 40000, 10 ** 6)] == [
        "egg", "egg", "hatchling", "hatchling", "young", "young", "adult", "adult", "illustre", "illustre",
        "ancestral", "ancestral"]
    assert stage_table(t) == STAGES


def test_the_stage_never_goes_down_and_an_unknown_stored_stage_gives_way():
    t = DEFAULT_STAGE_XP
    assert grown_stage("adult", 300, t) == "adult"
    assert grown_stage("hatchling", 16000, t) == "illustre"
    assert stage_index("dragonnet") == -1 and grown_stage("dragonnet", 0, t) == "egg"
    assert grown_stage(None, 150, t) == "hatchling"


def test_the_gauge_runs_from_the_stage_to_the_next_and_is_open_at_the_top():
    t = DEFAULT_STAGE_XP
    assert stage_gauge("egg", t) == (0, 100)
    assert stage_gauge("adult", t) == (5000, 15000)
    assert stage_gauge("ancestral", t) == (40000, None)


def test_the_world_serves_the_stage_table(client):
    assert client.get("/api/world").json()["stages"] == STAGES


def test_a_session_hatches_the_egg_at_100_xp_and_reports_the_gauge(client, settings):
    pid = make_profile(client, level="10H"); tid = make_text(client)
    first = post(client, pid, tid, hydre_result(), day="2026-09-21")["progression"]     # 54 XP
    assert first["dragon"]["stage_after"] == "egg" and (first["xp"]["floor"], first["xp"]["next"]) == (0, 100)
    assert stored(settings, pid) == ("egg", None)
    second = post(client, pid, tid, hydre_result(), day="2026-09-22")["progression"]    # 108 XP
    assert second["dragon"] == {"stage_before": "egg", "stage_after": "hatchling", "needs_name": True}
    assert [second["xp"][k] for k in ("stage_before", "stage_after", "floor", "next")] == ["egg", "hatchling", 100, 1200]
    stage, hatched_at = stored(settings, pid)      # the session path writes hatched_at when the dragon hatches
    assert stage == "hatchling" and hatched_at is not None


def test_the_weeks_bonus_counts_toward_the_stage(settings):
    # R2: the stage is grown after every XP of the session. Same day, so no seal: 54, 108,
    # then 162 + the week's 40 = 202 crosses a hatchling threshold of 200 only thanks to the week.
    with app_with_rules(settings, '{"dragon_stages": {"hatchling": 200}}') as c:
        pid = make_profile(c, level="10H"); tid = make_text(c)
        for _ in range(2):
            assert post(c, pid, tid, hydre_result(), day="2026-09-21")["progression"]["dragon"]["stage_after"] == "egg"
        p = post(c, pid, tid, hydre_result(), day="2026-09-21")["progression"]
        assert {"reason": "weekly", "amount": 40} in p["xp"]["bonuses"] and p["xp"]["total_after"] == 3 * 54 + 40
        assert p["dragon"]["stage_after"] == "hatchling"


def test_thresholds_come_from_the_rules_file_and_the_world_serves_them(settings):
    with app_with_rules(settings, '{"dragon_stages": {"hatchling": 50, "ancestral": 30000}}') as c:
        assert [s["xp"] for s in c.get("/api/world").json()["stages"]] == [0, 50, 1200, 5000, 15000, 30000]
        pid = make_profile(c, level="10H"); tid = make_text(c)
        p = post(c, pid, tid, hydre_result())["progression"]
        assert p["dragon"]["stage_after"] == "hatchling" and (p["xp"]["floor"], p["xp"]["next"]) == (50, 1200)


# Spec §4: an existing profile keeps its stored stage (here one grown under the rules before).
def test_a_stored_adult_stays_adult_with_little_xp(client, settings):
    pid = make_profile(client, level="10H"); tid = make_text(client)
    client.get(f"/api/profiles/{pid}/camp")            # creates the dragon's row
    set_stage(settings, pid, "adult")
    p = post(client, pid, tid, hydre_result())["progression"]
    assert p["dragon"] == {"stage_before": "adult", "stage_after": "adult", "needs_name": True}
    assert [p["xp"][k] for k in ("stage_before", "stage_after", "floor", "next")] == ["adult", "adult", 5000, 15000]
    assert client.get(f"/api/profiles/{pid}/camp").json()["dragon"]["stage"] == "adult"
    assert stored(settings, pid)[0] == "adult"


def test_a_profile_with_16000_xp_reads_illustre(client, settings):
    pid = make_profile(client, level="10H")
    give_xp(settings, pid, 16000)
    assert client.get(f"/api/profiles/{pid}/camp").json()["dragon"]["stage"] == "illustre"
    stage, hatched_at = stored(settings, pid)
    assert stage == "illustre" and hatched_at is not None


def test_a_raised_threshold_never_shrinks_the_stage(settings):
    with TestClient(create_app(settings)) as c:
        pid = make_profile(c, level="10H"); tid = make_text(c)
        give_xp(settings, pid, 1300)
        assert c.get(f"/api/profiles/{pid}/camp").json()["dragon"]["stage"] == "young"
    with app_with_rules(settings, '{"dragon_stages": {"young": 3000}}') as c:
        assert c.get(f"/api/profiles/{pid}/camp").json()["dragon"]["stage"] == "young"
        p = post(c, pid, tid, hydre_result())["progression"]
        assert p["dragon"]["stage_after"] == "young" and (p["xp"]["floor"], p["xp"]["next"]) == (3000, 5000)


def test_an_unknown_stored_stage_is_replaced_by_the_stage_for_the_xp(client, settings):
    pid = make_profile(client, level="10H"); tid = make_text(client)
    client.get(f"/api/profiles/{pid}/camp")
    set_stage(settings, pid, "dragonnet")               # a hand-edited row
    p = post(client, pid, tid, hydre_result())["progression"]
    assert p["dragon"]["stage_before"] == "egg" and p["dragon"]["stage_after"] == "egg"
    assert stored(settings, pid) == ("egg", None)


def test_a_hand_edited_stage_normalised_to_egg_clears_hatched_at(client, settings):
    pid = make_profile(client, level="10H"); tid = make_text(client)
    client.get(f"/api/profiles/{pid}/camp")
    conn = db(settings)
    conn.execute("UPDATE dragon SET stage = 'dragonnet', hatched_at = '2026-09-01T10:00:00+00:00' WHERE profile_id = ?", (pid,))
    conn.commit(); conn.close()
    post(client, pid, tid, hydre_result())
    assert stored(settings, pid) == ("egg", None)


def test_the_camp_gauge_follows_the_stored_stage(client, settings):
    # R3: a stage grown before (under the old rules) reads an empty gauge on its own scale.
    pid = make_profile(client, level="10H")
    client.get(f"/api/profiles/{pid}/camp")
    set_stage(settings, pid, "adult"); give_xp(settings, pid, 300)
    assert client.get(f"/api/profiles/{pid}/camp").json()["xp"] == {"total": 300, "floor": 5000, "next": 15000}
    give_xp(settings, pid, 40000)
    c = client.get(f"/api/profiles/{pid}/camp").json()
    assert c["dragon"]["stage"] == "ancestral" and c["xp"] == {"total": 40300, "floor": 40000, "next": None}
