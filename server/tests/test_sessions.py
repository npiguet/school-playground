FEES = "Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent."


def setup(client):
    p = client.post("/api/profiles", json={"name": "Léa", "avatar": "chouette", "level": "10H"}).json()
    t = client.post("/api/texts", json={"title": "Fées", "body": FEES, "level": "8H", "source": "custom"}).json()
    return p, t


def result(catch_rate, caught=1, missed=1, lexical_expected=None):
    errs = [{"refIndex": 2, "typedIndex": 2, "expected": "dansent", "typed": "danse", "category": "agreement", "sub": "verb"},
            {"refIndex": 7, "typedIndex": 7, "expected": "chantent", "typed": "chante", "category": "agreement", "sub": "verb"}]
    if lexical_expected:
        errs.append({"refIndex": 5, "typedIndex": 5, "expected": lexical_expected, "typed": "clairiere", "category": "accent"})
    return {"version": 1,
            "byCategory": {"agreement:verb": {"opportunities": 3, "draft": 2, "caught": caught, "missed": missed, "introduced": 0},
                           "accent": {"opportunities": 2, "draft": 1 if lexical_expected else 0, "caught": 0, "missed": 1 if lexical_expected else 0, "introduced": 0}},
            "draftErrors": errs, "finalErrors": errs[1:], "caught": errs[:1], "missed": errs[1:], "introduced": [],
            "correctWords": 11, "totalWords": 13, "catchRate": catch_rate, "score": 100}


def post_session(client, p, t, catch_rate, help_stage=None, **kw):
    body = {"profile_id": p["id"], "text_id": t["id"], "pace_level": 2,
            "help_stage": help_stage or client.get(f"/api/profiles/{p['id']}").json()["help_stage"],
            "started_at": "2026-09-23T10:00:00+00:00", "draft": "x", "final": "y",
            "result": result(catch_rate, **kw), "score": 100, "catch_rate": catch_rate}
    r = client.post("/api/sessions", json=body)
    assert r.status_code == 201, r.text
    return r.json()


def test_session_updates_stats_history_and_trap_words(client):
    p, t = setup(client)
    post_session(client, p, t, 0.5, lexical_expected="clairière")
    stats = client.get(f"/api/profiles/{p['id']}/stats").json()
    verb = next(c for c in stats["categories"] if c["category"] == "agreement:verb")
    assert verb == {"category": "agreement:verb", "occurrences": 3, "errors_in_draft": 2, "caught": 1, "missed": 1, "catch_rate": 0.5}
    assert stats["totals"] == {"sessions": 1, "score": 100, "caught": 1}
    assert stats["recent_sessions"][0]["title"] == "Fées"
    assert stats["trap_words"] == [{"word": "clairière", "box": 1, "misses": 1, "last_seen": stats["trap_words"][0]["last_seen"]}]
    assert client.get(f"/api/profiles/{p['id']}/trap-words").json()[0]["word"] == "clairière"
    listed = client.get(f"/api/texts?profile_id={p['id']}").json()[0]
    assert listed["history"] == {"times_played": 1, "best_score": 100, "best_catch_rate": 0.5}
    # a later session where the trap word is present and correct promotes it
    post_session(client, p, t, 0.5)
    assert client.get(f"/api/profiles/{p['id']}/trap-words").json()[0]["box"] == 2


def test_help_stage_adapts(client):
    p, t = setup(client)
    assert post_session(client, p, t, 0.8)["help_stage_after"] == 1
    assert post_session(client, p, t, 0.9)["help_stage_after"] == 1
    r = post_session(client, p, t, 0.7)
    assert (r["help_stage_before"], r["help_stage_after"]) == (1, 2)
    assert "Muses" in r["help_stage_message"]
    assert client.get(f"/api/profiles/{p['id']}").json()["help_stage"] == 2
    # sessions at the previous stage do not count toward the next change
    r = post_session(client, p, t, 0.1)
    assert r["help_stage_after"] == 2
    r = post_session(client, p, t, 0.2)
    assert (r["help_stage_before"], r["help_stage_after"]) == (2, 1)
    assert "Argus" in r["help_stage_message"]


def test_null_catch_rate_is_ignored_for_adaptation(client):
    p, t = setup(client)
    post_session(client, p, t, 0.8); post_session(client, p, t, 0.8)
    assert post_session(client, p, t, None)["help_stage_after"] == 1
    assert post_session(client, p, t, 0.8)["help_stage_after"] == 2


def test_session_404s(client):
    p, t = setup(client)
    body = {"profile_id": 999, "text_id": t["id"], "pace_level": 1, "help_stage": 1, "started_at": "x",
            "draft": "", "final": "", "result": {"version": 1}, "score": 0, "catch_rate": None}
    assert client.post("/api/sessions", json=body).status_code == 404
