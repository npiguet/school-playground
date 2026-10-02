"""Drachmes, the stall, wearing and the walls through the API (spec 2026-09-29 drachmes §1-§5)."""
import sqlite3
import threading
import time
from concurrent.futures import ThreadPoolExecutor

from app.db import DB_FILENAME
from tests.test_dragon import give_xp, set_stage
from tests.test_progression import hydre_result, post
from tests.test_seals_api import LONG, seal, won
from tests.test_sessions import make_profile, make_text

SHORT = "Ta bourse n'est pas encore assez pleine pour cet objet."
NOT_ON_SALE = "Hermès ne vend pas encore cet objet."
OWNED = "Tu l'as déjà."
HOUSE = "Ta maison n'est pas un objet à exposer."
QUEST_DECOR = ["decor:lanterne", "decor:tapis", "decor:bibliotheque", "decor:trophee", "decor:fresque"]
SHOP_DECOR = ["decor:amphore", "decor:chouette", "decor:mosaique", "decor:bouclier"]


def db(settings) -> sqlite3.Connection:
    conn = sqlite3.connect(settings.data_dir / DB_FILENAME)
    conn.row_factory = sqlite3.Row
    return conn


def purse(settings, pid, amount):
    conn = db(settings)
    conn.execute("INSERT INTO drachme_event(profile_id, amount, reason, ref, created_at) VALUES (?, ?, 'grant', NULL, 'then')",
                 (pid, amount))
    conn.commit(); conn.close()


def own(settings, pid, *ids):
    conn = db(settings)
    conn.executemany("INSERT INTO reward(profile_id, reward_id, source, granted_at) VALUES (?, ?, 'test', 'then')", [(pid, i) for i in ids])
    conn.commit(); conn.close()


def ledger(settings, pid):
    conn = db(settings)
    rows = [tuple(r) for r in conn.execute("SELECT amount, reason, ref FROM drachme_event WHERE profile_id = ? ORDER BY id", (pid,))]
    conn.close()
    return rows


def camp(client, pid):
    return client.get(f"/api/profiles/{pid}/camp").json()


def buy(client, pid, item):
    return client.post(f"/api/profiles/{pid}/purchases", json={"item": item})


def wear(client, pid, item, on=True):
    return client.patch(f"/api/profiles/{pid}/rewards/{item}", json={"equipped": on})


def test_a_session_pays_drachmes_and_the_camp_shows_the_purse(client):
    pid = make_profile(client, level="10H"); tid = make_text(client)
    assert camp(client, pid)["drachmes"] == 0 and camp(client, pid)["house"] == "cabin"
    p = post(client, pid, tid, hydre_result(), day="2026-09-21")["progression"]
    d = p["drachmes"]
    assert d["parts"][0] == {"reason": "session", "amount": (2 * p["xp"]["session"] + 10) // 20}
    assert d["earned"] == sum(x["amount"] for x in d["parts"]) == d["balance"]
    assert camp(client, pid)["drachmes"] == d["balance"]


def test_a_seal_and_the_week_pay_their_drachmes(client, settings):
    pid = make_profile(client, level="10H"); tid = make_text(client)
    post(client, pid, tid, hydre_result(), day="2026-09-21")
    post(client, pid, tid, hydre_result(), day="2026-09-22")
    p = post(client, pid, tid, hydre_result(), day="2026-09-23")["progression"]      # the Hydra's wooden seal, the week's third
    assert {"reason": "level", "amount": 10, "lieutenant": "hydre", "level": 1} in p["drachmes"]["parts"]
    assert {"reason": "weekly", "amount": 5} in p["drachmes"]["parts"]
    rows = ledger(settings, pid)
    last_session = [ref for _a, reason, ref in rows if reason == "session"][-1]
    assert last_session.startswith("session:")
    assert {ref for _a, reason, ref in rows if reason in ("level", "weekly")} == {last_session}


def assert_paid_by_last_session(settings, pid, reason):
    """SP4 final review M9c: a bonus's ledger row names the session that paid it (`session:<id>`)."""
    rows = ledger(settings, pid)
    last_session = [ref for _a, r, ref in rows if r == "session"][-1]
    assert last_session.startswith("session:")
    assert [ref for _a, r, ref in rows if r == reason] == [last_session]


def test_a_board_quest_pays_five(client, settings):
    pid = make_profile(client, level="10H"); tid = make_text(client)
    assert client.post(f"/api/profiles/{pid}/quests", json={"target": "hydre"}).status_code == 201
    for day in ("2026-09-21", "2026-09-22"):
        post(client, pid, tid, hydre_result(), day=day)
    p = post(client, pid, tid, hydre_result(), day="2026-09-22")["progression"]
    assert {"reason": "board", "amount": 5} in p["drachmes"]["parts"]
    assert_paid_by_last_session(settings, pid, "board")


def test_an_oracle_quest_pays_fifteen(client, settings):
    pid = make_profile(client, level="10H"); tid = make_text(client)
    assert client.post(f"/api/profiles/{pid}/oracle", json={"scroll": "ecole", "lieutenant": "hydre"}).status_code == 201
    for day in ("2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25"):
        p = post(client, pid, tid, hydre_result(), day=day)["progression"]
        if any(part["reason"] == "oracle" for part in p["drachmes"]["parts"]):
            break
    assert {"reason": "oracle", "amount": 15} in p["drachmes"]["parts"]
    assert_paid_by_last_session(settings, pid, "oracle")


def test_a_won_fight_pays_thirty(client, settings):
    pid = make_profile(client, level="10H"); long_text = make_text(client, body=LONG)
    for key in ("hydre", "echo", "chimere", "protee", "sirenes", "lethe"):
        seal(settings, pid, key, 2)
    won(settings, pid, 1, 2, 3)
    b = client.post(f"/api/profiles/{pid}/boss").json()
    p = post(client, pid, long_text, hydre_result(draft=0, caught=0), quest_id=b["quest"]["id"], encounter="eris")["progression"]
    assert {"reason": "boss", "amount": 30} in p["drachmes"]["parts"]
    assert_paid_by_last_session(settings, pid, "boss")


def test_buying_takes_the_price_and_grants_the_piece(client, settings):
    pid = make_profile(client, level="10H")
    purse(settings, pid, 100); seal(settings, pid, "hydre", 2)
    r = buy(client, pid, "accessory:hydre-cou")
    assert r.status_code == 201
    body = r.json()
    assert body["drachmes"] == 60
    assert {k: body["reward"][k] for k in ("id", "kind", "name", "equipped")} == {
        "id": "accessory:hydre-cou", "kind": "accessory", "name": "Collier d'écailles vertes", "equipped": False}
    assert ledger(settings, pid) == [(100, "grant", None), (-40, "purchase", "accessory:hydre-cou")]
    assert camp(client, pid)["drachmes"] == 60
    assert "accessory:hydre-cou" in {x["id"] for x in client.get(f"/api/profiles/{pid}/rewards").json()}


def test_a_purchase_is_refused_when_short_not_on_sale_owned_or_unknown(client, settings):
    pid = make_profile(client, level="10H")
    purse(settings, pid, 50); seal(settings, pid, "hydre", 2)
    for item in ("accessory:hydre-queue", "house:villa", "accessory:echo-cou"):
        r = buy(client, pid, item)
        assert (r.status_code, r.json()["detail"]) == (409, NOT_ON_SALE), item
    assert buy(client, pid, "accessory:hydre-cou").status_code == 201                   # 50 - 40 = 10
    r = buy(client, pid, "accessory:hydre-cou")
    assert (r.status_code, r.json()["detail"]) == (409, OWNED)
    r = buy(client, pid, "decor:amphore")
    assert (r.status_code, r.json()["detail"]) == (409, SHORT)
    for item in ("decor:nope", "egide", "trophy:hydre:1", "decor:tapis"):
        assert buy(client, pid, item).status_code == 404, item
    assert camp(client, pid)["drachmes"] == 10


# Review focus 3: the stored stage decides, and the palais comes after the villa.
def test_the_houses_in_order_on_the_stored_stage(client, settings):
    pid = make_profile(client, level="10H")
    camp(client, pid)                                                         # the camp hatches the dragon's row
    purse(settings, pid, 2000); set_stage(settings, pid, "adult")            # stored ahead of the XP (sub-project 3)
    assert buy(client, pid, "house:palais").json()["detail"] == NOT_ON_SALE
    assert buy(client, pid, "house:villa").status_code == 201
    assert camp(client, pid)["house"] == "villa"
    assert buy(client, pid, "house:palais").json()["detail"] == NOT_ON_SALE     # adult, not illustre
    give_xp(settings, pid, 15000)
    assert buy(client, pid, "house:palais").status_code == 201
    assert camp(client, pid)["house"] == "palais" and camp(client, pid)["drachmes"] == 900


def test_protees_set_is_not_sold_before_8h(client, settings):
    pid = make_profile(client, level="7H")
    purse(settings, pid, 200); seal(settings, pid, "protee", 5)                # by hand: Protée sleeps at 7H
    assert buy(client, pid, "accessory:protee-cou").json()["detail"] == NOT_ON_SALE
    assert client.patch(f"/api/profiles/{pid}", json={"level": "8H"}).status_code == 200
    assert buy(client, pid, "accessory:protee-cou").status_code == 201


def hold_first_purchase(monkeypatch, until: threading.Event) -> threading.Event:
    """The first purchase to read the balance (under its write lock) waits there until `until` is set,
    so what races it really overlaps it (SP4 final review M9b). Returns the event set once it holds."""
    from app.routers import world
    real = world.balance
    holding = threading.Event()

    def balance_then_hold(conn, profile_id):
        n = real(conn, profile_id)
        if not holding.is_set():
            holding.set()
            assert until.wait(timeout=10), "the racing request never started"
            time.sleep(0.1)          # and reached the write lock
        return n

    monkeypatch.setattr(world, "balance", balance_then_hold)
    return holding


# Review focus 1: the balance is read and the purchase written under one write lock. The first purchase
# holds the lock until the three others are inside their own purchase: the race is forced, not hoped for.
def test_purchases_racing_never_overdraw(client, settings, monkeypatch):
    from app.routers import world
    pid = make_profile(client, level="10H")
    purse(settings, pid, 100)
    for key in ("hydre", "echo", "chimere", "lethe"):
        seal(settings, pid, key, 2)
    items = [f"accessory:{k}-cou" for k in ("hydre", "echo", "chimere", "lethe")]
    others_waiting = threading.Event()
    calls = []
    real_begin = world.begin_write

    def begin_and_count(conn):
        calls.append(conn)
        if len(calls) == 4:
            others_waiting.set()
        real_begin(conn)

    monkeypatch.setattr(world, "begin_write", begin_and_count)
    holding = hold_first_purchase(monkeypatch, others_waiting)
    with ThreadPoolExecutor(max_workers=4) as ex:
        first = ex.submit(buy, client, pid, items[0])
        assert holding.wait(timeout=10)
        rest = [ex.submit(buy, client, pid, item) for item in items[1:]]
        codes = [first.result().status_code, *(f.result().status_code for f in rest)]
    assert others_waiting.is_set()                       # all four were inside a purchase at once
    assert sorted(codes) == [201, 201, 409, 409]
    assert camp(client, pid)["drachmes"] == 20 and sum(a for a, _r, _ref in ledger(settings, pid)) == 20


def test_a_session_and_a_purchase_posted_together_keep_the_ledger_whole(client, settings, monkeypatch):
    from app.routers import sessions
    pid = make_profile(client, level="10H"); tid = make_text(client)
    purse(settings, pid, 50)
    seal(settings, pid, "hydre", 2)
    session_started = threading.Event()
    real_fetch = sessions.fetch_profile

    def fetch_and_tell(conn, profile_id):
        row = real_fetch(conn, profile_id)
        session_started.set()
        return row

    monkeypatch.setattr(sessions, "fetch_profile", fetch_and_tell)
    holding = hold_first_purchase(monkeypatch, session_started)
    with ThreadPoolExecutor(max_workers=2) as ex:
        sale = ex.submit(buy, client, pid, "accessory:hydre-cou")
        assert holding.wait(timeout=10)                  # the purchase holds the write lock...
        session = ex.submit(lambda: post(client, pid, tid, hydre_result(), day="2026-09-21"))
        assert sale.result().status_code == 201          # ...while the session is under way
        earned = session.result()["progression"]["drachmes"]["earned"]
    assert session_started.is_set()
    rows = ledger(settings, pid)
    assert sum(a for a, _r, _ref in rows) == 50 + earned - 40
    assert camp(client, pid)["drachmes"] == 50 + earned - 40 >= 0
    running = 0
    for amount, _reason, _ref in rows:
        running += amount
        assert running >= 0


# Review focus 4.
def test_one_accessory_per_slot(client, settings):
    pid = make_profile(client, level="10H")
    own(settings, pid, "accessory:hydre-cou", "accessory:echo-cou", "accessory:lethe-tete")
    assert wear(client, pid, "accessory:hydre-cou").status_code == 200
    assert wear(client, pid, "accessory:lethe-tete").status_code == 200
    assert camp(client, pid)["dragon"]["worn"] == ["hydre-cou", "lethe-tete"]
    assert wear(client, pid, "accessory:echo-cou").status_code == 200                 # a swap
    assert camp(client, pid)["dragon"]["worn"] == ["echo-cou", "lethe-tete"]
    equipped = {x["id"]: x["equipped"] for x in client.get(f"/api/profiles/{pid}/rewards").json()}
    assert equipped["accessory:hydre-cou"] is False and equipped["accessory:echo-cou"] is True
    assert wear(client, pid, "accessory:echo-cou", on=False).status_code == 200       # « Rien »
    assert camp(client, pid)["dragon"]["worn"] == ["lethe-tete"]
    assert wear(client, pid, "accessory:chimere-cou").status_code == 404              # only what is owned
    assert client.patch(f"/api/profiles/{pid}/dragon", json={"tint": "bronze"}).json()["worn"] == ["lethe-tete"]


def test_a_house_is_not_put_on_display(client, settings):
    pid = make_profile(client, level="10H")
    own(settings, pid, "house:villa")
    r = wear(client, pid, "house:villa")
    assert (r.status_code, r.json()["detail"]) == (409, HOUSE)


# Spec 2026-10-02 house treasures: no display limit, in any house. Each house on its own (a hero
# per house), so the villa and the palais are tested as themselves, not as a cabin moved into.
def test_every_house_displays_all_nine_pieces(client, settings):
    for houses in ([], ["house:villa"], ["house:villa", "house:palais"]):
        pid = make_profile(client, level="10H")
        own(settings, pid, *houses, *QUEST_DECOR, *SHOP_DECOR)
        assert camp(client, pid)["house"] == ("palais" if len(houses) == 2 else "villa" if houses else "cabin")
        for d in [*QUEST_DECOR, *SHOP_DECOR]:
            r = wear(client, pid, d)
            assert (r.status_code, r.json()["equipped"]) == (200, True), (houses, d)
        assert sum(1 for x in client.get(f"/api/profiles/{pid}/rewards").json() if x["kind"] == "decor" and x["equipped"]) == 9


# SP4 final review M5: the cabin's « N trésors » counts what the trophy shelf shows (gear, decor, tints,
# trophies), never the dragon's parure or the house.
def test_the_camp_counts_only_the_treasures_the_shelf_shows(client, settings):
    pid = make_profile(client, level="10H")
    own(settings, pid, "house:villa", "accessory:hydre-cou", "accessory:echo-tete")
    assert camp(client, pid)["rewards_count"] == 0
    own(settings, pid, "decor:amphore", "egide", "tint:jade", "trophy:hydre:1")
    assert camp(client, pid)["rewards_count"] == 4
