"""Seals and fights through the API (spec 2026-09-29 lieutenant levels §1, §4, §5)."""
import json
import sqlite3

from app.db import DB_FILENAME
from app.rules import RULES_FILENAME
from app.world import oracle as oracle_mod
from app.world.seals import lieutenants_for_level
from tests.test_progression import hydre_result, post
from tests.test_sessions import make_profile, make_text
from fastapi.testclient import TestClient
from app.main import create_app

BOSS_MESSAGE = "Éris ne se montre pas encore. Gagne d'abord d'autres sceaux sur ses lieutenants."
LONG = " ".join(["Les fées dansent dans la clairière et les oiseaux les écoutent."] * 16)   # ≥ 150 words


def db(settings) -> sqlite3.Connection:
    conn = sqlite3.connect(settings.data_dir / DB_FILENAME)
    conn.row_factory = sqlite3.Row
    return conn


def seal(settings, pid, key, level, reached_at="2026-09-01T12:00:00+00:00"):
    conn = db(settings)
    conn.execute("INSERT OR REPLACE INTO lieutenant_level(profile_id, lieutenant, level, reached_at) VALUES (?, ?, ?, ?)",
                 (pid, key, level, reached_at))
    conn.commit(); conn.close()


def won(settings, pid, *tiers):
    conn = db(settings)
    for t in tiers:
        conn.execute("INSERT INTO quest(profile_id, kind, target, status, goal_json, reward_json, created_at, completed_at) "
                     "VALUES (?, 'boss', 'eris', 'done', ?, '{\"xp\": 300}', 'then', 'then')", (pid, json.dumps({"tier": t, "text_id": 1})))
    conn.commit(); conn.close()


def stat_days(settings, pid, category, days, chances, mistakes=0, draft=0, caught=0):
    conn = db(settings)
    conn.executemany("INSERT INTO profile_stat_day(profile_id, day, category, occurrences, errors_in_draft, caught, missed) "
                     "VALUES (?, ?, ?, ?, ?, ?, ?)", [(pid, d, category, chances, draft, caught, mistakes) for d in days])
    conn.commit(); conn.close()


def camp(client, pid):
    return client.get(f"/api/profiles/{pid}/camp").json()


def hydre(c):
    return next(l for l in c["lieutenants"] if l["key"] == "hydre")


def test_three_days_of_guard_win_the_hydras_wooden_seal(client, settings):
    pid = make_profile(client, level="10H"); tid = make_text(client)
    p1 = post(client, pid, tid, hydre_result(), day="2026-09-21")["progression"]
    p2 = post(client, pid, tid, hydre_result(), day="2026-09-22")["progression"]
    assert p1["levels"] == [] and p2["levels"] == []                      # 2 days: the window is not full
    p = post(client, pid, tid, hydre_result(), day="2026-09-23")["progression"]
    assert p["levels"] == [{"lieutenant": "hydre", "level": 1, "reward_id": "trophy:hydre:1"}]
    assert {"reason": "level", "amount": 100, "lieutenant": "hydre", "level": 1} in p["xp"]["bonuses"]
    assert all(b["reason"] != "mastery" for b in p["xp"]["bonuses"])
    assert p["rewards"] == [{"id": "trophy:hydre:1", "kind": "trophy", "name": "Écaille de l'Hydre en bois"}]
    assert "neutralised" not in p
    c = camp(client, pid)
    h = hydre(c)
    assert (h["level"], h["level_reached_at"]) == (1, "2026-09-23T12:00:00+00:00")
    assert h["next"] == {"level": 2, "days": 0, "chances": 0, "correct": None, "complete": False,
                         "need": {"days": 4, "chances": 25, "correct": 0.88}}
    assert h["bestiary_unlocked"] is True
    conn = db(settings)
    assert conn.execute("SELECT COUNT(*) FROM mastery").fetchone()[0] == 0   # no longer written
    conn.close()


def test_a_lieutenant_serves_only_what_the_client_reads(client):
    # SP2 open item, closed in SP5 Task 6: the all-time counts and the last day were served but never read.
    pid = make_profile(client, level="10H"); tid = make_text(client)
    post(client, pid, tid, hydre_result(), day="2026-09-21")
    assert set(hydre(camp(client, pid))) == {"key", "name", "categories", "available", "level", "level_reached_at",
                                             "next", "bestiary_unlocked", "active_quest_id"}


def test_the_next_seal_counts_only_days_after_the_last(client):
    pid = make_profile(client, level="10H"); tid = make_text(client)
    for day in ("2026-09-21", "2026-09-22", "2026-09-23"):
        post(client, pid, tid, hydre_result(), day=day)
    assert post(client, pid, tid, hydre_result(), day="2026-09-23")["progression"]["levels"] == []   # the same day
    for day in ("2026-09-24", "2026-09-25", "2026-09-26"):
        assert post(client, pid, tid, hydre_result(), day=day)["progression"]["levels"] == []        # 3 days of 4
    p = post(client, pid, tid, hydre_result(), day="2026-09-27")["progression"]
    assert p["levels"] == [{"lieutenant": "hydre", "level": 2, "reward_id": "trophy:hydre:2"}]
    assert {"reason": "level", "amount": 200, "lieutenant": "hydre", "level": 2} in p["xp"]["bonuses"]


# Review focus 1: a long clean history before the deploy gives the first seal only.
def test_one_session_raises_a_lieutenant_by_one_seal_at_most(client, settings):
    pid = make_profile(client, level="10H"); tid = make_text(client)
    stat_days(settings, pid, "agreement:verb", [f"2026-09-{d:02d}" for d in range(1, 11)], 20)
    assert post(client, pid, tid, hydre_result(), day="2026-09-30")["progression"]["levels"] == [
        {"lieutenant": "hydre", "level": 1, "reward_id": "trophy:hydre:1"}]
    assert post(client, pid, tid, hydre_result(), day="2026-09-30")["progression"]["levels"] == []
    assert hydre(camp(client, pid))["level"] == 1


def test_a_seal_is_never_skipped_by_the_store(client, settings, monkeypatch):
    # R5: seal L+1 is written only over seal L. A request that read « no seal yet » while another one
    # wrote seal 3 changes nothing, and reports nothing.
    from app.rules import Rules
    from app.world import seals
    pid = make_profile(client, level="10H")
    stat_days(settings, pid, "agreement:verb", ["2026-09-01", "2026-09-02", "2026-09-03"], 10)
    seal(settings, pid, "hydre", 3)
    monkeypatch.setattr(seals, "level_rows", lambda conn, profile_id: {})    # the stale read
    conn = db(settings)
    assert seals.raise_levels(conn, pid, ["hydre"], "2026-09-04T12:00:00+00:00", Rules()) == []
    assert conn.execute("SELECT level FROM lieutenant_level WHERE profile_id = ?", (pid,)).fetchone()[0] == 3
    conn.close()


def test_a_seal_is_never_lost(client):
    pid = make_profile(client, level="10H"); tid = make_text(client)
    for day in ("2026-09-21", "2026-09-22", "2026-09-23"):
        post(client, pid, tid, hydre_result(), day=day)
    post(client, pid, tid, hydre_result(draft=8, caught=0, left=8), day="2026-09-24")
    h = hydre(camp(client, pid))
    assert h["level"] == 1 and h["next"]["correct"] == 0.2


def test_the_fifth_seal_has_no_next_window(client, settings):
    """The camp's « a seal within reach » (spec 2026-09-29 explanations §1, R3) relies on it."""
    pid = make_profile(client, level="10H")
    seal(settings, pid, "hydre", 4)
    assert hydre(camp(client, pid))["next"]["level"] == 5
    seal(settings, pid, "hydre", 5)
    h = hydre(camp(client, pid))
    assert (h["level"], h["next"]) == (5, None)


def test_the_seals_thresholds_come_from_the_rules_file(settings):
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    (settings.data_dir / RULES_FILENAME).write_text('{"levels": {"1": {"days": 1, "chances": 5}}}', encoding="utf-8")
    with TestClient(create_app(settings)) as c:
        pid = make_profile(c, level="10H"); tid = make_text(c)
        assert post(c, pid, tid, hydre_result(), day="2026-09-21")["progression"]["levels"][0]["level"] == 1
        assert hydre(camp(c, pid))["next"]["need"] == {"days": 4, "chances": 25, "correct": 0.88}


def test_protee_is_judged_only_from_8h(client, settings):
    pid = make_profile(client, level="7H"); tid = make_text(client)
    stat_days(settings, pid, "agreement:participle", ["2026-09-01", "2026-09-02", "2026-09-03"], 10)
    assert post(client, pid, tid, hydre_result(), day="2026-09-10")["progression"]["levels"] == []
    assert client.patch(f"/api/profiles/{pid}", json={"level": "8H"}).status_code == 200
    assert post(client, pid, tid, hydre_result(), day="2026-09-11")["progression"]["levels"] == [
        {"lieutenant": "protee", "level": 1, "reward_id": "trophy:protee:1"}]


def test_the_oracle_looks_at_the_lowest_seals_first(client, settings):
    # R10: the Hydra's catch rate is the worst, but she has a seal; Écho has none.
    pid = make_profile(client, level="10H")
    stat_days(settings, pid, "agreement:verb", ["2026-09-01"], 10, draft=10, caught=1)
    stat_days(settings, pid, "homophone", ["2026-09-01"], 10, draft=10, caught=5)
    seal(settings, pid, "hydre", 1)
    conn = db(settings)
    profile = conn.execute("SELECT * FROM profile WHERE id = ?", (pid,)).fetchone()
    levels = {"hydre": 1, "echo": 0, "chimere": 0, "protee": 0, "sirenes": 0, "lethe": 0}
    assert oracle_mod.compute_scrolls(conn, profile, lieutenants_for_level("10H"), levels) == {"faible": "echo", "destin": "chimere"}
    conn.close()


def test_the_first_fight_opens_at_two_wooden_seals(client, settings):
    pid = make_profile(client, level="10H")
    assert camp(client, pid)["boss"] == {"tier_available": None, "tiers_won": [], "active_quest_id": None, "fights": 10,
                                         "next": {"tier": 1, "level": 1, "missing": 2}}
    seal(settings, pid, "hydre", 1)
    assert camp(client, pid)["boss"]["next"] == {"tier": 1, "level": 1, "missing": 1}
    r = client.post(f"/api/profiles/{pid}/boss")
    assert r.status_code == 409 and r.json()["detail"] == BOSS_MESSAGE
    seal(settings, pid, "lethe", 3)
    b = camp(client, pid)["boss"]
    assert (b["tier_available"], b["next"]) == (1, None)


# Review focus 4.
def test_won_fights_stay_won_when_protee_wakes(client, settings):
    pid = make_profile(client, level="7H")
    for key in ("hydre", "echo", "chimere", "sirenes", "lethe"):
        seal(settings, pid, key, 1)
    won(settings, pid, 1, 2)
    b = camp(client, pid)["boss"]
    assert (b["tier_available"], b["tiers_won"], b["next"]) == (None, [1, 2], {"tier": 3, "level": 2, "missing": 2})
    assert client.patch(f"/api/profiles/{pid}", json={"level": "8H"}).status_code == 200
    b = camp(client, pid)["boss"]
    assert (b["tier_available"], b["tiers_won"], b["next"]) == (None, [1, 2], {"tier": 3, "level": 2, "missing": 2})
    seal(settings, pid, "hydre", 2); seal(settings, pid, "echo", 2)
    assert camp(client, pid)["boss"]["tier_available"] == 3


def test_the_fights_after_the_third_pay_xp_only(client, settings):
    pid = make_profile(client, level="10H"); long_text = make_text(client, body=LONG)
    for key in ("hydre", "echo", "chimere", "protee", "sirenes", "lethe"):
        seal(settings, pid, key, 2)
    won(settings, pid, 1, 2, 3)
    b = client.post(f"/api/profiles/{pid}/boss").json()
    assert b["tier"] == 4 and b["quest"]["reward"] == {"xp": 300, "reward_id": None, "bestiary": False}
    p = post(client, pid, long_text, hydre_result(draft=0, caught=0), quest_id=b["quest"]["id"], encounter="eris")["progression"]
    assert p["boss"] == {"tier": 4, "won": True} and p["rewards"] == [] and {"reason": "boss", "amount": 300} in p["xp"]["bonuses"]
    c = camp(client, pid)["boss"]
    assert c["tiers_won"] == [1, 2, 3, 4] and c["next"] == {"tier": 5, "level": 3, "missing": 2}


# Review of plan Task 2: a fight already started stays open, whatever the ladder says now.
def test_an_active_boss_quest_is_returned_even_when_its_fight_would_not_open(client, settings):
    pid = make_profile(client, level="10H"); long_text = make_text(client, body=LONG)
    for key in ("hydre", "echo", "chimere", "protee", "sirenes"):
        seal(settings, pid, key, 1)
    won(settings, pid, 1, 2)
    conn = db(settings)
    qid = conn.execute("INSERT INTO quest(profile_id, kind, target, status, goal_json, reward_json, created_at) "
                       "VALUES (?, 'boss', 'eris', 'active', ?, ?, 'then')",
                       (pid, json.dumps({"tier": 3, "text_id": long_text}),
                        json.dumps({"xp": 300, "reward_id": "foudre_zeus", "bestiary": False}))).lastrowid
    conn.commit(); conn.close()
    assert camp(client, pid)["boss"]["tier_available"] is None                # fight III asks two seals of bronze
    r = client.post(f"/api/profiles/{pid}/boss")
    assert r.status_code == 200 and r.json()["quest"]["id"] == qid and r.json()["tier"] == 3
    assert camp(client, pid)["boss"]["active_quest_id"] == qid
