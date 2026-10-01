import json
import sqlite3
from app.db import DB_FILENAME
from tests.test_sessions import make_profile, make_text, make_result   # SP1 helpers (reused/added for SP3)


def hydre_result(draft=4, caught=4, words=120, left=None):
    r = make_result()                       # SP1 helper returns a valid SessionResult dict
    r["totalWords"] = words; r["draftErrors"] = [{}] * draft; r["caught"] = [{}] * caught
    # The mistakes left in the handed-in copy: by default the draft's uncaught ones (as e2e makeResult),
    # so finalErrors and byCategory describe the same copy.
    r["finalErrors"] = [{}] * (draft - caught if left is None else left)
    r["catchRate"] = caught / draft if draft else None
    r["byCategory"] = {"agreement:verb": {"opportunities": 10, "draft": draft, "caught": caught, "missed": draft - caught, "introduced": 0}}
    return r


def post(client, pid, tid, result, day=None, **extra):
    body = {"profile_id": pid, "text_id": tid, "pace_level": 1, "started_at": "2026-09-24T10:00:00+00:00",
            "draft": "x", "final": "x", "result": result, "score": 10, "catch_rate": result["catchRate"], **extra}
    headers = {"X-Discorde-Day": day} if day else {}
    r = client.post("/api/sessions", json=body, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def test_session_grants_xp_and_reports_the_dragons_gauge(client):
    pid = make_profile(client, level="10H"); tid = make_text(client)
    p = post(client, pid, tid, hydre_result())["progression"]
    # 120 words, 0 left, 4 caught, pace 1: effort 22, accuracy 24, rereading 8 (spec 2026-09-29 §4).
    assert p["xp"]["session"] == 22 + 24 + 8 and p["xp"]["parts"] == {"text": 54, "pace": 0, "aids": 0, "prophecy": 0}
    assert p["xp"]["total_after"] == p["xp"]["session"]
    # Spec 2026-09-29 dragon growth §2: the ranks merged into the stages; no rank field is left.
    assert set(p["xp"]) == {"session", "parts", "bonuses", "total_before", "total_after", "stage_before", "stage_after", "floor", "next"}
    assert [p["xp"][k] for k in ("stage_before", "stage_after", "floor", "next")] == ["egg", "egg", 0, 100]
    assert p["dragon"] == {"stage_before": "egg", "stage_after": "egg", "needs_name": False}
    assert p["neutralised"] == [] and p["rewards"] == [] and p["boss"] is None


def test_mastery_over_three_days_grants_the_relic_and_the_dragon_hatches_from_xp(client):
    pid = make_profile(client, level="10H"); tid = make_text(client)
    p1 = post(client, pid, tid, hydre_result(), day="2026-09-21")["progression"]
    p2 = post(client, pid, tid, hydre_result(), day="2026-09-22")["progression"]
    p = post(client, pid, tid, hydre_result(), day="2026-09-23")["progression"]
    # Spec 2026-09-29 dragon growth §1: 54 then 108 XP, the egg hatches at 100; neutralising the
    # Hydra no longer grows it.
    assert p1["dragon"]["stage_after"] == "egg"
    assert p2["dragon"] == {"stage_before": "egg", "stage_after": "hatchling", "needs_name": True}
    assert p["neutralised"] == ["hydre"]
    assert [r["id"] for r in p["rewards"]] == ["ecaille_hydre"]
    assert p["dragon"] == {"stage_before": "hatchling", "stage_after": "hatchling", "needs_name": True}
    assert {"reason": "mastery", "amount": 200} in p["xp"]["bonuses"]
    # permanent: a bad day later does not undo it
    p4 = post(client, pid, tid, hydre_result(draft=6, caught=0), day="2026-09-24")["progression"]
    assert p4["neutralised"] == [] and p4["dragon"]["stage_after"] == "hatchling"


def test_same_day_sessions_count_as_one_day(client):
    pid = make_profile(client, level="10H"); tid = make_text(client)
    for _ in range(3): post(client, pid, tid, hydre_result(), day="2026-09-21")
    assert post(client, pid, tid, hydre_result(), day="2026-09-21")["progression"]["neutralised"] == []


def test_test_header_ignored_without_hook(settings, tmp_path):
    from dataclasses import replace
    from fastapi.testclient import TestClient
    from app.main import create_app
    with TestClient(create_app(replace(settings, test_hooks=False, data_dir=tmp_path / "d2"))) as c:
        pid = make_profile(c, level="10H"); tid = make_text(c)
        post(c, pid, tid, hydre_result(), day="2001-01-01")
        day = c.get(f"/api/profiles/{pid}/stats").json()  # SP1 stats do not expose days; check the DB instead
        import sqlite3
        conn = sqlite3.connect(tmp_path / "d2" / "discorde.sqlite3")
        assert conn.execute("SELECT day FROM profile_stat_day WHERE profile_id = ?", (pid,)).fetchone()[0] != "2001-01-01"


def test_weekly_done_counts_by_swiss_week_not_utc_date(client, tmp_path):
    # I4: weekly_done() must compare finished_at against the week's Swiss (Europe/Zurich) Monday
    # 00:00 boundaries in UTC, not a UTC-date substr - a session finished 00:30 local Monday
    # (22:30 UTC the previous Sunday, CEST is UTC+2 in September) belongs to the NEW week.
    import sqlite3, json as _json
    from app.world.progression import weekly_done
    pid = make_profile(client, level="10H"); tid = make_text(client)
    conn = sqlite3.connect(tmp_path / "data" / "discorde.sqlite3")
    conn.execute(
        "INSERT INTO session(profile_id, text_id, pace_level, help_stage, started_at, finished_at, draft, final, "
        "result_json, score, catch_rate) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        (pid, tid, 1, 1, "2026-09-20T22:00:00+00:00", "2026-09-20T22:30:00+00:00", "x", "x",
         _json.dumps(make_result()), 10, None))
    conn.commit()
    assert weekly_done(conn, pid, "2026-W39") == 1   # 2026-09-21 (Mon) .. 2026-09-27
    assert weekly_done(conn, pid, "2026-W38") == 0
    conn.close()


def test_weekly_goal_bonus_once(client):
    pid = make_profile(client, level="10H"); tid = make_text(client)
    post(client, pid, tid, hydre_result(), day="2026-09-21"); post(client, pid, tid, hydre_result(), day="2026-09-22")
    p = post(client, pid, tid, hydre_result(), day="2026-09-23")["progression"]
    assert p["weekly"] == {"target": 3, "done": 3, "reached_now": True}
    p = post(client, pid, tid, hydre_result(), day="2026-09-24")["progression"]
    assert p["weekly"]["reached_now"] is False and p["weekly"]["done"] == 4
    assert not any(b["reason"] == "weekly" for b in p["xp"]["bonuses"])


def test_prophecy_bonus_applies_strictly_before_the_due_date(client):
    # M9 / Decision 10: "before its date" - the +50 % must not apply on the due date itself.
    pid = make_profile(client, level="10H")
    tid = make_text(client, due_date="2026-09-24")
    on_due_date = post(client, pid, tid, hydre_result(), day="2026-09-24")["progression"]
    before_due_date = post(client, pid, tid, hydre_result(), day="2026-09-23")["progression"]
    assert on_due_date["xp"]["session"] == 54        # 22 + 24 + 8, no bonus
    assert before_due_date["xp"]["session"] == 70    # 22 + 32 × 1.5 (the effort takes no bonus)


def test_derived_categories_are_hidden_from_generic_stats(client):
    pid = make_profile(client, level="10H"); tid = make_text(client)
    r = hydre_result(); r["byCategory"]["derived:lethe"] = {"opportunities": 30, "draft": 2, "caught": 2, "missed": 0, "introduced": 0}
    post(client, pid, tid, r)
    stats = client.get(f"/api/profiles/{pid}/stats").json()
    assert all(not c["category"].startswith("derived:") for c in stats["categories"])
    assert stats["totals"]["caught"] == 4


def test_the_aids_left_at_the_camp_pay_their_bonus(client):
    pid = make_profile(client, level="10H"); tid = make_text(client)
    p = post(client, pid, tid, hydre_result(), aids=["argus", "ariane", "persee"])["progression"]
    assert p["xp"]["session"] == 22 + round(32 * 1.4) and p["xp"]["parts"]["aids"] == 13


def test_quests_created_before_the_new_rule_are_judged_by_it(client, settings):
    pid = make_profile(client, level="10H"); tid = make_text(client)
    q = client.post(f"/api/profiles/{pid}/quests", json={"target": "hydre"}).json()
    conn = sqlite3.connect(settings.data_dir / DB_FILENAME)
    conn.execute("UPDATE quest SET goal_json = ? WHERE id = ?", (json.dumps({"sessions": 3, "min_rate": 0.9, "texts": []}), q["id"]))
    conn.commit(); conn.close()
    # Caught 1 of 2 (the old rule's rate 0.5 < 0.9), but 9 of 10 chances right in the copy (0.9 >= 0.85).
    p = post(client, pid, tid, hydre_result(draft=2, caught=1))["progression"]
    assert next(x for x in p["quests"] if x["target"] == "hydre")["counted"] is True
    # The one mistake left is in the copy too: 120 words, m = 100/120, effort 22, accuracy 24 × (1 − m/10)
    # = 22, rereading 2.
    assert p["xp"]["session"] == 46
    assert client.get(f"/api/profiles/{pid}/quests?status=active").json()[0]["goal"] == {"sessions": 3}


def test_a_quest_session_that_does_not_count_says_why(client):
    pid = make_profile(client, level="10H"); tid = make_text(client)
    client.post(f"/api/profiles/{pid}/quests", json={"target": "hydre"})

    def hydre_quest(result):
        return next(x for x in post(client, pid, tid, result)["progression"]["quests"] if x["target"] == "hydre")

    few = hydre_result(draft=0, caught=0)
    few["byCategory"]["agreement:verb"]["opportunities"] = 2          # under quest_min_chances (3)
    assert {k: hydre_quest(few)[k] for k in ("counted", "reason")} == {"counted": False, "reason": "chances"}
    # 3 of 10 chances left in the copy: 70 % right, under quest_min_correct (85 %).
    assert {k: hydre_quest(hydre_result(draft=4, caught=1))[k] for k in ("counted", "reason")} == {"counted": False, "reason": "copy"}
    assert {k: hydre_quest(hydre_result())[k] for k in ("counted", "reason")} == {"counted": True, "reason": None}


def test_the_session_keeps_its_xp_as_its_score(client):
    pid = make_profile(client, level="10H"); tid = make_text(client)
    xp = post(client, pid, tid, hydre_result())["progression"]["xp"]["session"]
    history = next(t for t in client.get(f"/api/texts?profile_id={pid}").json() if t["id"] == tid)["history"]
    assert history["best_score"] == xp
