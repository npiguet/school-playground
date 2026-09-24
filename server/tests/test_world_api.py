from tests.test_sessions import make_profile, make_text
from tests.test_progression import hydre_result, post


def test_world_catalog(client):
    w = client.get("/api/world").json()
    assert [l["key"] for l in w["lieutenants"]] == ["hydre", "echo", "chimere", "protee", "sirenes", "lethe"]
    assert w["rewards"]["ecaille_hydre"]["name"] == "Écaille de l'Hydre" and w["mastery"] == {"min_days": 3, "min_traps": 10, "rate": 0.8}
    assert w["boss_rewards"]["1"] == "sandales_hermes" and len(w["ranks"]) == 10
    # I7: the client's French agreement (chips, "Neutralisée", "C'est celle-là", ...) derives from
    # this narrative gender - l'Hydre/Écho/la Chimère/Léthé are feminine, les Sirènes feminine
    # plural, Protée alone masculine.
    genders = {l["key"]: l["gender"] for l in w["lieutenants"]}
    assert genders == {"hydre": "f", "echo": "f", "chimere": "f", "protee": "m", "sirenes": "fp", "lethe": "f"}


def test_camp_for_new_profile(client):
    pid = make_profile(client, level="7H")
    c = client.get(f"/api/profiles/{pid}/camp").json()
    assert c["xp"] == {"total": 0, "rank": 1, "title": "Recrue du camp", "next_threshold": 150, "rank_floor": 0}
    assert c["dragon"]["stage"] == "egg" and c["dragon"]["available"] == 5 and c["dragon"]["unlocked_tints"] == ["bronze"]
    protee = next(l for l in c["lieutenants"] if l["key"] == "protee")
    assert protee["available"] is False and len(c["lieutenants"]) == 6
    assert c["oracle"]["status"] == "sealed" and c["weekly"] == {"week": c["weekly"]["week"], "target": 3, "done": 0, "reached": False}
    assert c["boss"] == {"tier_available": None, "tiers_won": [], "active_quest_id": None}


def test_dragon_patch_validation(client):
    pid = make_profile(client, level="10H")
    assert client.patch(f"/api/profiles/{pid}/dragon", json={"name": "Braise"}).json()["name"] == "Braise"
    assert client.patch(f"/api/profiles/{pid}/dragon", json={"name": ""}).status_code == 422
    assert client.patch(f"/api/profiles/{pid}/dragon", json={"tint": "ecume"}).status_code == 422   # not unlocked
    assert client.patch(f"/api/profiles/{pid}/dragon", json={"tint": "bronze"}).json()["tint"] == "bronze"


def test_board_quest_lifecycle(client):
    pid = make_profile(client, level="10H"); tid = make_text(client)
    q = client.post(f"/api/profiles/{pid}/quests", json={"target": "hydre"})
    assert q.status_code == 201 and q.json()["goal"] == {"sessions": 3, "min_rate": 0.5} and q.json()["reward"]["xp"] == 60
    assert client.post(f"/api/profiles/{pid}/quests", json={"target": "hydre"}).status_code == 409
    client.post(f"/api/profiles/{pid}/quests", json={"target": "echo"})
    r = client.post(f"/api/profiles/{pid}/quests", json={"target": "chimere"})
    assert r.status_code == 409 and "Deux quêtes" in r.json()["detail"]
    for _ in range(3): p = post(client, pid, tid, hydre_result())["progression"]
    hq = next(x for x in p["quests"] if x["target"] == "hydre")
    assert hq["completed"] is True and hq["progress"] == 3
    quests = client.get(f"/api/profiles/{pid}/quests?status=done").json()
    assert [x["target"] for x in quests] == ["hydre"]
    eq = client.get(f"/api/profiles/{pid}/quests?status=active").json()[0]
    assert client.post(f"/api/profiles/{pid}/quests/{eq['id']}/shelve").json()["status"] == "shelved"
    # I2: shelving is only for an active board quest - "nothing is ever taken away" must be
    # enforced server-side, not just by the client hiding the button.
    r4 = client.post(f"/api/profiles/{pid}/quests/{quests[0]['id']}/shelve")   # done board quest
    assert r4.status_code == 409 and "rangée" in r4.json()["detail"]
    r5 = client.post(f"/api/profiles/{pid}/quests/{eq['id']}/shelve")   # already shelved
    assert r5.status_code == 409


def test_oracle_consultation(client):
    pid = make_profile(client, level="10H")
    o = client.get(f"/api/profiles/{pid}/oracle").json()
    assert o["status"] == "sealed" and [s["key"] for s in o["scrolls"]] == ["faible", "ecole", "destin"]
    assert all(s["lieutenant"] is None for s in o["scrolls"]) and o["reward_id"] == "tint:ecume"
    assert client.post(f"/api/profiles/{pid}/oracle", json={"scroll": "ecole"}).status_code == 422
    r = client.post(f"/api/profiles/{pid}/oracle", json={"scroll": "ecole", "lieutenant": "chimere"}).json()
    assert r["quest"]["kind"] == "oracle" and r["quest"]["target"] == "chimere" and r["quest"]["reward"]["reward_id"] == "tint:ecume"
    assert r["oracle"]["status"] == "chosen" and next(s for s in r["oracle"]["scrolls"] if s["key"] == "ecole")["lieutenant"] == "chimere"
    assert client.post(f"/api/profiles/{pid}/oracle", json={"scroll": "faible"}).status_code == 409


def test_oracle_quest_has_recommended_texts(client):
    # I5: Oracle quests carry three recommended texts, exactly like board quests (Decision 7) -
    # otherwise the week's centrepiece quest has no « play » entry point on its QuestCard.
    pid = make_profile(client, level="10H"); make_text(client)
    r = client.post(f"/api/profiles/{pid}/oracle", json={"scroll": "faible"}).json()
    assert r["quest"]["target"] == "hydre" and len(r["quest"]["texts"]) > 0


def test_oracle_quest_survives_the_weekly_seal_until_next_consultation(client, tmp_path):
    # I3: Decision 7 says the previous week's Oracle quest is "replaced quietly at the next
    # consultation", not retired by opening the camp on a new week.
    import sqlite3
    pid = make_profile(client, level="10H")
    r = client.post(f"/api/profiles/{pid}/oracle", json={"scroll": "faible"}).json()
    quest_id = r["quest"]["id"]
    conn = sqlite3.connect(tmp_path / "data" / "discorde.sqlite3")
    conn.execute("UPDATE oracle SET week = '2020-W01' WHERE profile_id = ?", (pid,))
    conn.execute("UPDATE quest SET week = '2020-W01' WHERE id = ?", (quest_id,))
    conn.commit(); conn.close()
    # Opening the camp seals a brand-new week's oracle row; last week's quest must stay active.
    camp = client.get(f"/api/profiles/{pid}/camp").json()
    q = next(x for x in camp["quests"] if x["id"] == quest_id)
    assert q["status"] == "active"
    # Only consulting a new scroll retires it.
    client.post(f"/api/profiles/{pid}/oracle", json={"scroll": "destin"})
    conn = sqlite3.connect(tmp_path / "data" / "discorde.sqlite3")
    status = conn.execute("SELECT status FROM quest WHERE id = ?", (quest_id,)).fetchone()[0]
    conn.close()
    assert status == "expired"


def test_oracle_faible_and_destin_pick_sensible_monsters(client):
    pid = make_profile(client, level="10H"); tid = make_text(client)
    r = hydre_result(draft=6, caught=1)
    r["byCategory"]["homophone"] = {"opportunities": 5, "draft": 5, "caught": 5, "missed": 0, "introduced": 0}
    post(client, pid, tid, r, day="2026-09-01")
    o = client.post(f"/api/profiles/{pid}/oracle", json={"scroll": "faible"}).json()
    assert o["quest"]["target"] == "hydre"
    # destin: a never-practised lieutenant, not the weak one
    assert o["oracle"]["scrolls"][2]["lieutenant"] is None       # still sealed (not chosen)


def test_boss_requires_tier(client):
    pid = make_profile(client, level="10H")
    assert client.post(f"/api/profiles/{pid}/boss").status_code == 409


def test_boss_flow(client):
    pid = make_profile(client, level="10H")
    long_text = make_text(client, body=" ".join(["Les fées dansent dans la clairière et les oiseaux les écoutent."] * 16))   # ≥ 150 words
    # neutralise hydre and echo via the test clock
    for key, cat in (("hydre", "agreement:verb"), ("echo", "homophone")):
        for day in ("2026-09-21", "2026-09-22", "2026-09-23"):
            r = hydre_result(); r["byCategory"] = {cat: {"opportunities": 10, "draft": 4, "caught": 4, "missed": 0, "introduced": 0}}
            post(client, pid, long_text, r, day=day)
    camp = client.get(f"/api/profiles/{pid}/camp").json()
    assert camp["boss"]["tier_available"] == 1 and camp["dragon"]["stage"] == "hatchling"
    b = client.post(f"/api/profiles/{pid}/boss").json()
    # Decision 8: clamp(profile.help_stage + 1, 2, 4) - the profile's adaptive help_stage is 2
    # after the neutralisation prep sessions, so the boss fight starts one stage above it, at 3.
    assert b["tier"] == 1 and b["text_id"] == long_text and b["help_stage"] == 3 and b["quest"]["kind"] == "boss"
    assert client.post(f"/api/profiles/{pid}/boss").json()["quest"]["id"] == b["quest"]["id"]   # idempotent while active
    lost = post(client, pid, long_text, hydre_result(draft=5, caught=2), quest_id=b["quest"]["id"], encounter="eris", help_stage=3)["progression"]
    assert lost["boss"] == {"tier": 1, "won": False}
    assert client.get(f"/api/profiles/{pid}/quests?status=active").json()[0]["kind"] == "boss"     # nothing lost
    won = post(client, pid, long_text, hydre_result(draft=5, caught=4), quest_id=b["quest"]["id"], encounter="eris", help_stage=3)["progression"]
    assert won["boss"] == {"tier": 1, "won": True} and [r["id"] for r in won["rewards"]] == ["sandales_hermes"]
    rewards = client.get(f"/api/profiles/{pid}/rewards").json()
    assert {r["id"] for r in rewards} == {"ecaille_hydre", "voix_echo", "sandales_hermes"}
    # I2: a done boss quest can't be shelved either (only an active board quest can).
    assert client.post(f"/api/profiles/{pid}/quests/{b['quest']['id']}/shelve").status_code == 409
    rid = client.patch(f"/api/profiles/{pid}/rewards/sandales_hermes", json={"equipped": True}).json()
    assert rid["equipped"] is True
