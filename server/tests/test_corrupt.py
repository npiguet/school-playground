import random
from pathlib import Path
from app.corrupt import apply_plants, candidates, category_weights, corruption_count, match_case, plan_corruptions
from app.nlp.annotate import annotate
from app.nlp.homophones import load_homophones

CONTENT = Path(__file__).resolve().parents[2] / "content"
BODY = ("Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent. "
        "Le vent emporte leurs chansons jusqu'au village. Les enfants sortent de leurs maisons, émerveillés. "
        "La musique descend de la forêt et la nuit est douce.")


def test_count_and_weights():
    assert corruption_count(60) == 4 and corruption_count(126) == 7 and corruption_count(400) == 12
    rows = [{"category": "agreement:verb", "errors_in_draft": 10, "caught": 2},
            {"category": "homophone", "errors_in_draft": 10, "caught": 9},
            {"category": "lexical", "errors_in_draft": 1, "caught": 0}]
    w = category_weights(rows, "10H")
    assert w["agreement:verb"] > w["homophone"]                    # weak category weighs more
    assert abs(w["lexical"] - 0.10 * 0.75) < 1e-9                  # too few samples → catch_rate 0.5
    assert "agreement:participle" not in category_weights([], "7H") and "agreement:participle" in category_weights([], "8H")


def test_match_case():
    assert match_case("Les", "la") == "La" and match_case("les", "la") == "la"


def test_candidates_and_plan_are_valid_and_deterministic(nlp, lexicon):
    h = load_homophones(CONTENT)
    annotation = annotate(BODY, nlp, h, lexicon)
    cands = candidates(annotation, lexicon, h, {"clairière"})
    assert cands["homophone"] and cands["accent"] and cands["agreement:verb"]
    for cat, items in cands.items():
        for c in items:
            assert BODY[c["start"]:c["end"]] == c["original"] and c["mutated"].lower() != c["original"].lower()
    weights = category_weights([], "10H")
    plants = plan_corruptions(BODY, annotation, lexicon, h, weights, 6, random.Random(42), {"clairière"})
    assert 3 <= len(plants) <= 6
    assert plants == sorted(plants, key=lambda p: p["start"])
    for a, b in zip(plants, plants[1:]):
        assert a["end"] <= b["start"] and b["token"] - a["token"] >= 3
    again = plan_corruptions(BODY, annotation, lexicon, h, weights, 6, random.Random(42), {"clairière"})
    assert again == plants
    corrupted = apply_plants(BODY, plants)
    assert corrupted != BODY and len(corrupted.split("\n")) == len(BODY.split("\n"))
    # every plant span is exactly what changed
    rebuilt = apply_plants(BODY, plants)
    for p in plants:
        assert p["mutated"] in rebuilt


def test_api_corrupt_and_grimoire_session(client):
    p = client.post("/api/profiles", json={"name": "Léa", "avatar": "chouette", "level": "10H"}).json()
    t = client.post("/api/texts", json={"title": "Fées", "body": BODY, "level": "8H", "source": "custom"}).json()
    r = client.post(f"/api/texts/{t['id']}/corrupt", json={"profile_id": p["id"], "seed": 7})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["count"] == len(d["plants"]) >= 3 and d["corrupted"] != BODY
    for pl in d["plants"]:
        assert BODY[pl["start"]:pl["end"]] == pl["original"]
    assert client.post(f"/api/texts/{t['id']}/corrupt", json={"profile_id": p["id"], "seed": 7}).json() == d
    # 5 words (the create_text minimum) but only 2 non-punctuation tokens can ever be MIN_GAP
    # apart, so plan_corruptions can never reach 3 plants regardless of the random seed.
    short = client.post("/api/texts", json={"title": "S", "body": "Il dort ici et maintenant.", "level": "8H", "source": "custom"}).json()
    r = client.post(f"/api/texts/{short['id']}/corrupt", json={"profile_id": p["id"]})
    assert r.status_code == 422 and "Éris" in r.text
    # grimoire sessions never move the help stage, even with three perfect catch rates
    result = {"version": 1, "byCategory": {"homophone": {"opportunities": 5, "draft": 2, "caught": 2, "missed": 0, "introduced": 0}},
              "draftErrors": [], "finalErrors": [], "caught": [], "missed": [], "introduced": [], "correctWords": 30, "totalWords": 30, "catchRate": 1.0, "score": 100}
    for _ in range(3):
        s = client.post("/api/sessions", json={"profile_id": p["id"], "text_id": t["id"], "pace_level": 1, "help_stage": 1, "mode": "grimoire",
                                                "started_at": "2026-09-24T10:00:00+00:00", "draft": d["corrupted"], "final": BODY,
                                                "result": result, "score": 100, "catch_rate": 1.0}).json()
        assert s["help_stage_after"] == 1 and s["help_stage_message"] is None
    stats = client.get(f"/api/profiles/{p['id']}/stats").json()
    assert stats["recent_sessions"][0]["mode"] == "grimoire" and stats["categories"][0]["caught"] == 6
