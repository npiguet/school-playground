import json
import sqlite3

from app.clock import iso_week, local_day, now_utc
from app.db import DB_FILENAME
from app.world import oracle as oracle_mod
from tests.test_sessions import FEES, make_profile, make_text
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
    # CLAUDE.md "No emoji" (UI3 Ruling A13): the lieutenants' icons are painted art on the client.
    assert all("glyph" not in lt for lt in w["lieutenants"])


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
    assert q.status_code == 201 and q.json()["goal"] == {"sessions": 3} and q.json()["reward"]["xp"] == 60
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
    # P1-3: `recommend_texts` now needs >= 60 words, so the fixture text must clear that floor
    # (FEES alone is 13 words - repeat it, as `test_boss_flow`'s long_text does).
    pid = make_profile(client, level="10H"); make_text(client, body=" ".join([FEES] * 6))
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


def test_boss_flow(client, settings):
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
    # Spec 2026-09-29 §2: the fight is judged on the copy. 6 mistakes left in 120 words (5 per 100) lose.
    lost = post(client, pid, long_text, hydre_result(draft=6, caught=0, left=6), quest_id=b["quest"]["id"], encounter="eris")["progression"]
    assert lost["boss"] == {"tier": 1, "won": False}
    assert client.get(f"/api/profiles/{pid}/quests?status=active").json()[0]["kind"] == "boss"     # nothing lost
    # A quest stored before the change (an old "too easy" draw flagged it for the Grimoire) is judged
    # by the new rule, and its legacy keys never reach the client.
    conn = sqlite3.connect(settings.data_dir / DB_FILENAME)
    legacy = {"tier": 1, "min_rate": 0.7, "min_draft": 3, "text_id": long_text, "help_stage": 3, "mode": "grimoire"}
    conn.execute("UPDATE quest SET goal_json = ? WHERE id = ?", (json.dumps(legacy), b["quest"]["id"]))
    conn.commit(); conn.close()
    assert client.post(f"/api/profiles/{pid}/boss").json()["quest"]["goal"] == {"tier": 1, "text_id": long_text}
    # A clean copy simply wins: no more "too easy" draw, even with nothing caught.
    won = post(client, pid, long_text, hydre_result(draft=0, caught=0), quest_id=b["quest"]["id"], encounter="eris")["progression"]
    assert won["boss"] == {"tier": 1, "won": True} and [r["id"] for r in won["rewards"]] == ["sandales_hermes"]
    rewards = client.get(f"/api/profiles/{pid}/rewards").json()
    assert {r["id"] for r in rewards} == {"ecaille_hydre", "voix_echo", "sandales_hermes"}
    # I2: a done boss quest can't be shelved either (only an active board quest can).
    assert client.post(f"/api/profiles/{pid}/quests/{b['quest']['id']}/shelve").status_code == 409
    rid = client.patch(f"/api/profiles/{pid}/rewards/sandales_hermes", json={"equipped": True}).json()
    assert rid["equipped"] is True


def test_camp_survives_a_concurrent_first_visit_sealing_the_oracle(client, settings, monkeypatch):
    # e2e stability (UI3a): the library tent and the camp both fetch /camp on mount, so a quick
    # tent -> camp hop sends two concurrent first-of-the-week requests. Both saw no oracle row and
    # both INSERTed: the loser hit the (profile_id, week) primary key and the camp showed
    # « Impossible de rejoindre le camp : Internal Server Error ». Replays that interleaving: the
    # other request seals the week between this one's SELECT and its INSERT.
    pid = make_profile(client)
    real = oracle_mod.compute_scrolls

    def sealed_meanwhile(conn, profile, available, neutralised):
        scrolls = real(conn, profile, available, neutralised)
        other = sqlite3.connect(settings.data_dir / DB_FILENAME)
        other.execute("INSERT INTO oracle(profile_id, week, scrolls_json) VALUES (?,?,?)",
                      (profile["id"], iso_week(local_day(now_utc())), json.dumps(scrolls)))
        other.commit(); other.close()
        return scrolls

    monkeypatch.setattr(oracle_mod, "compute_scrolls", sealed_meanwhile)
    r = client.get(f"/api/profiles/{pid}/camp")
    assert r.status_code == 200
    assert r.json()["oracle"]["status"] == "sealed"


def test_the_cabin_walls_hold_four_pieces_of_decor(client, settings):
    # UI3b ruling: four wall spots (DECOR_SLOTS); a fifth piece would hang over the first.
    pid = make_profile(client)
    decor = ["decor:lanterne", "decor:tapis", "decor:bibliotheque", "decor:trophee", "decor:fresque"]
    conn = sqlite3.connect(settings.data_dir / DB_FILENAME)
    for rid in [*decor, "sandales_hermes"]:
        conn.execute("INSERT INTO reward(profile_id, reward_id, source, granted_at) VALUES (?,?,?,?)",
                     (pid, rid, "test", "2026-09-21T12:00:00+00:00"))
    conn.commit(); conn.close()
    patch = lambda rid, on: client.patch(f"/api/profiles/{pid}/rewards/{rid}", json={"equipped": on})
    for rid in decor[:4]:
        assert patch(rid, True).status_code == 200
    full = patch("decor:fresque", True)
    assert full.status_code == 409 and full.json()["detail"] == "Les murs sont pleins\u202f: range d'abord une pièce."
    assert not next(r for r in client.get(f"/api/profiles/{pid}/rewards").json() if r["id"] == "decor:fresque")["equipped"]
    # Gear is worn, not hung; a piece already on the wall can be patched again.
    assert patch("sandales_hermes", True).json()["equipped"] is True
    assert patch("decor:tapis", True).status_code == 200
    # Putting one away frees its spot.
    assert patch("decor:tapis", False).json()["equipped"] is False
    assert patch("decor:fresque", True).json()["equipped"] is True


def test_a_lieutenant_asleep_at_the_heros_class_cannot_be_challenged(client):
    # Final review I1: the war tent's sheet, the dossier and the quest wall all show Protée asleep for
    # a 7H hero; a stale client (or a deep link to its portrait) must not start a quest against it.
    pid = make_profile(client, level="7H")
    r = client.post(f"/api/profiles/{pid}/quests", json={"target": "protee"})
    assert r.status_code == 409
    assert r.json()["detail"] == "Protée dort encore. Il se réveillera dans un an."
    assert client.get(f"/api/profiles/{pid}/quests?status=active").json() == []
    # Awake from 8H on.
    older = make_profile(client, level="8H")
    assert client.post(f"/api/profiles/{older}/quests", json={"target": "protee"}).status_code == 201


def test_a_sleeping_lieutenant_says_when_it_wakes_in_the_clients_words():
    # UI3b playability #20: the same sentences as eris.ts `sleepingLine` (eris.test.ts).
    from app.routers.world import sleeping_line
    assert sleeping_line("protee", "5H") == "Protée dort encore. Il se réveillera dans trois ans."
    assert sleeping_line("protee", "6H") == "Protée dort encore. Il se réveillera dans deux ans."
    assert sleeping_line("sirenes", "5H") == "Les Sirènes dorment encore. Elles se réveilleront dans quelques années."
    assert sleeping_line("hydre") == "L'Hydre dort encore. Elle se réveillera dans quelques années."


def test_a_reward_that_left_the_catalog_is_skipped_not_a_500(client, settings):
    # Final review M18: a reward id still in the DB but gone from REWARDS.
    pid = make_profile(client)
    conn = sqlite3.connect(settings.data_dir / DB_FILENAME)
    for rid, on in [("decor:retired", 1), ("decor:lanterne", 0)]:
        conn.execute("INSERT INTO reward(profile_id, reward_id, source, granted_at, equipped) VALUES (?,?,?,?,?)",
                     (pid, rid, "test", "2026-09-21T12:00:00+00:00", on))
    conn.commit(); conn.close()
    listed = client.get(f"/api/profiles/{pid}/rewards")
    assert listed.status_code == 200 and [r["id"] for r in listed.json()] == ["decor:lanterne"]
    assert client.patch(f"/api/profiles/{pid}/rewards/decor:lanterne", json={"equipped": True}).json()["equipped"] is True
    assert client.patch(f"/api/profiles/{pid}/rewards/decor:retired", json={"equipped": False}).status_code == 404


def test_two_pieces_hung_at_once_cannot_both_take_the_last_spot(client, settings, monkeypatch):
    # Final review M18: the count and the update were two steps; two PATCHes at once could both
    # count three pieces and both hang theirs. Each request here pauses right after its count until
    # the other has counted too (or a second has passed): without the write lock both would count
    # three; with it, the second only counts once the first has committed.
    import threading
    from app.db import connect
    from app.routers import world
    from app.schemas import RewardPatch

    pid = make_profile(client)
    decor = ["decor:lanterne", "decor:tapis", "decor:bibliotheque", "decor:trophee", "decor:fresque"]
    conn = sqlite3.connect(settings.data_dir / DB_FILENAME)
    for i, rid in enumerate(decor):
        conn.execute("INSERT INTO reward(profile_id, reward_id, source, granted_at, equipped) VALUES (?,?,?,?,?)",
                     (pid, rid, "test", "2026-09-21T12:00:00+00:00", int(i < 3)))
    conn.commit(); conn.close()

    counted = threading.Barrier(2)
    real = world._displayed_decor

    def count_then_wait(c, profile_id):
        n = real(c, profile_id)
        try:
            counted.wait(timeout=1)
        except threading.BrokenBarrierError:
            pass
        return n

    monkeypatch.setattr(world, "_displayed_decor", count_then_wait)
    results: dict[str, int] = {}

    def hang(rid: str) -> None:
        c = connect(settings.data_dir / DB_FILENAME)
        try:
            world.patch_reward(pid, rid, RewardPatch(equipped=True), db=c)
            results[rid] = 200
        except world.HTTPException as e:
            results[rid] = e.status_code
        finally:
            c.close()

    threads = [threading.Thread(target=hang, args=(rid,)) for rid in decor[3:]]
    for t in threads: t.start()
    for t in threads: t.join(timeout=60)
    assert sorted(results.values()) == [200, 409]
    on_walls = [r["id"] for r in client.get(f"/api/profiles/{pid}/rewards").json() if r["equipped"]]
    assert len(on_walls) == 4
