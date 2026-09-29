import json
import sqlite3

from pytest import approx

from app.db import DB_FILENAME

FEES = "Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent."


def setup(client):
    p = client.post("/api/profiles", json={"name": "Léa", "avatar": "chouette", "level": "10H"}).json()
    t = client.post("/api/texts", json={"title": "Fées", "body": FEES, "level": "8H", "source": "custom"}).json()
    return p, t


_profile_seq = [0]


def make_profile(client, level="10H", **kw):
    """SP3 helper (test_progression.py): a fresh profile at the given level, returning its id."""
    _profile_seq[0] += 1
    body = {"name": f"Joueur{_profile_seq[0]}", "avatar": "chouette", "level": level}
    body.update(kw)
    return client.post("/api/profiles", json=body).json()["id"]


def make_text(client, level="10H", **kw):
    """SP3 helper (test_progression.py): a fresh text at the given level, returning its id."""
    body = {"title": "Texte", "body": FEES, "level": level, "source": "custom"}
    body.update(kw)
    return client.post("/api/texts", json=body).json()["id"]


def make_result():
    """SP3 helper (test_progression.py): a minimal valid SessionResult with no errors."""
    return {"version": 1, "byCategory": {}, "draftErrors": [], "finalErrors": [], "caught": [], "missed": [],
            "introduced": [], "correctWords": 13, "totalWords": 13, "catchRate": None, "score": 100}


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


def post_session(client, p, t, catch_rate, **kw):
    body = {"profile_id": p["id"], "text_id": t["id"], "pace_level": 2,
            "started_at": "2026-09-23T10:00:00+00:00", "draft": "x", "final": "y",
            "result": result(catch_rate, **kw), "score": 100, "catch_rate": catch_rate}
    r = client.post("/api/sessions", json=body)
    assert r.status_code == 201, r.text
    return r.json()


def test_session_updates_stats_history_and_trap_words(client):
    p, t = setup(client)
    session = post_session(client, p, t, 0.5, lexical_expected="clairière")
    assert "progression" in session
    stats = client.get(f"/api/profiles/{p['id']}/stats").json()
    verb = next(c for c in stats["categories"] if c["category"] == "agreement:verb")
    assert verb == {"category": "agreement:verb", "occurrences": 3, "errors_in_draft": 2, "caught": 1, "missed": 1, "catch_rate": 0.5}
    # Spec 2026-09-29 §4: the session's score is its XP (the score 100 the body posts is ignored).
    xp = session["progression"]["xp"]["session"]
    assert xp != 100 and stats["totals"] == {"sessions": 1, "score": xp, "caught": 1}
    assert stats["recent_sessions"][0]["title"] == "Fées"
    assert stats["trap_words"] == [{"word": "clairière", "box": 1, "misses": 1, "last_seen": stats["trap_words"][0]["last_seen"]}]
    assert client.get(f"/api/profiles/{p['id']}/trap-words").json()[0]["word"] == "clairière"
    listed = client.get(f"/api/texts?profile_id={p['id']}").json()[0]
    assert listed["history"] == {"times_played": 1, "best_score": xp, "best_catch_rate": 0.5}
    # a later session where the trap word is present and correct promotes it
    post_session(client, p, t, 0.5)
    assert client.get(f"/api/profiles/{p['id']}/trap-words").json()[0]["box"] == 2


def grimoire_result(draft_words, final_words):
    """Éris planted `draft_words` (accent errors in the draft); the child left `final_words` wrong."""
    def err(w):
        return {"refIndex": 5, "typedIndex": 5, "expected": w, "typed": w.replace("è", "e").replace("é", "e"), "category": "accent"}
    return {"version": 1, "byCategory": {"accent": {"opportunities": 2, "draft": len(draft_words), "caught": len(draft_words) - len(final_words),
                                                    "missed": len(final_words), "introduced": 0}},
            "draftErrors": [err(w) for w in draft_words], "finalErrors": [err(w) for w in final_words],
            "caught": [], "missed": [], "introduced": [], "correctWords": 11, "totalWords": 13, "catchRate": 0.5, "score": 100}


def test_grimoire_session_never_creates_or_resets_trap_words(client):
    p, t = setup(client)
    post_session(client, p, t, 0.5, lexical_expected="clairière")           # a real dictation miss: box 1
    trap = client.get(f"/api/profiles/{p['id']}/trap-words").json()
    assert [(w["word"], w["box"], w["misses"]) for w in trap] == [("clairière", 1, 1)]

    def grimoire(result):
        body = {"profile_id": p["id"], "text_id": t["id"], "pace_level": 2, "mode": "grimoire",
                "started_at": "2026-09-23T10:00:00+00:00", "draft": "x", "final": "y", "result": result, "score": 100, "catch_rate": 0.5}
        assert client.post("/api/sessions", json=body).status_code == 201

    # Éris plants « clairière » and « fées »; the child misses « clairière » and catches « fées »: nothing is
    # created for « fées », « clairière » is neither reset nor counted as a new miss — it just isn't promoted
    grimoire(grimoire_result(["clairière", "fées"], ["clairière"]))
    trap = client.get(f"/api/profiles/{p['id']}/trap-words").json()
    assert [(w["word"], w["box"], w["misses"]) for w in trap] == [("clairière", 1, 1)]
    # she catches the planted « clairière »: seen and correct → promoted like in a dictation
    grimoire(grimoire_result(["clairière"], []))
    trap = client.get(f"/api/profiles/{p['id']}/trap-words").json()
    assert [(w["word"], w["box"], w["misses"]) for w in trap] == [("clairière", 2, 1)]
    # category stats still count the grimoire rounds
    accent = next(c for c in client.get(f"/api/profiles/{p['id']}/stats").json()["categories"] if c["category"] == "accent")
    assert accent["errors_in_draft"] == 1 + 2 + 1


def test_missing_word_error_does_not_create_trap_word(client):
    p, t = setup(client)
    result = {"version": 1, "byCategory": {},
              "draftErrors": [
                  {"refIndex": 5, "typedIndex": None, "expected": "clairière", "typed": None,
                   "category": "lexical", "sub": "missing"},
                  {"refIndex": None, "typedIndex": 3, "expected": None, "typed": "vraiment",
                   "category": "lexical", "sub": "extra"},
              ],
              "finalErrors": [], "caught": [], "missed": [], "introduced": [],
              "correctWords": 10, "totalWords": 13, "catchRate": 0.5, "score": 100}
    body = {"profile_id": p["id"], "text_id": t["id"], "pace_level": 2,
            "started_at": "2026-09-23T10:00:00+00:00", "draft": "x", "final": "y",
            "result": result, "score": 100, "catch_rate": 0.5}
    r = client.post("/api/sessions", json=body)
    assert r.status_code == 201, r.text
    # a skipped word or line is not a spelling mistake and must not flood mots-pièges
    assert client.get(f"/api/profiles/{p['id']}/trap-words").json() == []


def test_write_then_immediate_read_sees_the_write(client):
    # Regression test: get_db opens a fresh sqlite3 connection per request, so a write
    # must be committed by the writing endpoint itself before returning. Otherwise an
    # immediate read on a different connection can miss it (see app/db.py get_db).
    p, t = setup(client)
    session = post_session(client, p, t, 0.5)
    stats = client.get(f"/api/profiles/{p['id']}/stats")
    assert stats.status_code == 200
    assert stats.json()["recent_sessions"][0]["id"] == session["id"]


def test_session_404s(client):
    p, t = setup(client)
    body = {"profile_id": 999, "text_id": t["id"], "pace_level": 1, "started_at": "x",
            "draft": "", "final": "", "result": {"version": 1}, "score": 0, "catch_rate": None}
    assert client.post("/api/sessions", json=body).status_code == 404


def body_for(p, t, **kw):
    """Sub-project 1: a session body as today's client sends it (no help stage, no score)."""
    body = {"profile_id": p["id"], "text_id": t["id"], "pace_level": 2, "started_at": "2026-09-23T10:00:00+00:00",
            "draft": "x", "final": "y", "result": result(0.5), "catch_rate": 0.5}
    body.update(kw)
    return body


def test_a_session_records_the_aids_taken_and_the_hero_keeps_them(client, settings):
    p, t = setup(client)
    r = client.post("/api/sessions", json=body_for(p, t, aids=["palamede", "argus"]))
    assert r.status_code == 201, r.text
    assert client.get(f"/api/profiles/{p['id']}").json()["settings"]["aids"] == ["argus", "palamede"]
    conn = sqlite3.connect(settings.data_dir / DB_FILENAME)
    assert json.loads(conn.execute("SELECT aids FROM session WHERE id = ?", (r.json()["id"],)).fetchone()[0]) == ["argus", "palamede"]
    conn.close()
    assert client.post("/api/sessions", json=body_for(p, t, aids=[])).status_code == 201
    assert client.get(f"/api/profiles/{p['id']}").json()["settings"]["aids"] == []


def test_unknown_or_repeated_aids_are_refused(client):
    p, t = setup(client)
    for aids in (["argus", "argus"], ["loupe"], "argus"):
        assert client.post("/api/sessions", json=body_for(p, t, aids=aids)).status_code == 422, aids


def test_a_page_opened_before_the_aids_still_saves_its_session(client, settings):
    p, t = setup(client)
    client.patch(f"/api/profiles/{p['id']}", json={"settings": {"aids": ["ariane"]}})
    r = client.post("/api/sessions", json=body_for(p, t, help_stage=3, score=120))
    assert r.status_code == 201, r.text
    assert client.get(f"/api/profiles/{p['id']}").json()["settings"]["aids"] == ["ariane"]
    conn = sqlite3.connect(settings.data_dir / DB_FILENAME)
    assert conn.execute("SELECT aids FROM session WHERE id = ?", (r.json()["id"],)).fetchone()[0] is None
    conn.close()


def test_the_help_stage_is_gone_but_its_columns_stay(client, settings):
    p, t = setup(client)
    r = client.post("/api/sessions", json=body_for(p, t, aids=["argus"], help_stage=4))
    assert r.status_code == 201 and set(r.json()) == {"id", "progression"}
    assert "help_stage" not in client.get(f"/api/profiles/{p['id']}").json()
    assert "help_stage" not in client.get(f"/api/profiles/{p['id']}/stats").json()["recent_sessions"][0]
    conn = sqlite3.connect(settings.data_dir / DB_FILENAME)
    assert conn.execute("SELECT help_stage FROM session WHERE id = ?", (r.json()["id"],)).fetchone()[0] == 0
    assert conn.execute("SELECT help_stage FROM profile WHERE id = ?", (p["id"],)).fetchone()[0] == 1
    conn.close()


def test_recent_sessions_carry_the_aids_and_the_mistakes_left_per_100(client):
    p, t = setup(client)
    client.post("/api/sessions", json=body_for(p, t, aids=["athena"]))
    client.post("/api/sessions", json=body_for(p, t, help_stage=1, score=5))
    recent = client.get(f"/api/profiles/{p['id']}/stats").json()["recent_sessions"]
    # result(): one mistake left in 13 words
    assert [(s["aids"], s["per_100"]) for s in recent] == [(None, approx(100 / 13)), (["athena"], approx(100 / 13))]


def test_the_stats_keep_the_mistakes_introduced_while_proofreading(client, settings):
    p, t = setup(client)
    res = result(0.5)
    res["byCategory"]["agreement:verb"]["introduced"] = 2
    assert client.post("/api/sessions", json=body_for(p, t, result=res)).status_code == 201
    conn = sqlite3.connect(settings.data_dir / DB_FILENAME)
    assert conn.execute("SELECT introduced FROM profile_stat WHERE category = 'agreement:verb'").fetchone()[0] == 2
    assert conn.execute("SELECT introduced FROM profile_stat_day WHERE category = 'agreement:verb'").fetchone()[0] == 2
    conn.close()
