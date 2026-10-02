"""The camp's what-next inputs through the API (spec 2026-09-29 explanations §1, §3)."""
from app.world.shop import SHOP_DECOR
from tests.test_dragon import set_stage
from tests.test_drachmes_api import NOT_ON_SALE, OWNED, QUEST_DECOR, buy, camp, own, purse, wear
from tests.test_seals_api import seal
from tests.test_sessions import make_profile


# Review focus 1 (R5): the camp names what the purse can buy, owned pieces aside. By id, since the
# dragon's what-next line points the stall out only for an id it has not named yet (SP4 final review I1).
def test_the_camp_counts_what_the_purse_can_buy(client, settings):
    pid = make_profile(client, level="10H")
    assert camp(client, pid)["affordable"] == []
    purse(settings, pid, 49)
    assert camp(client, pid)["affordable"] == []                       # the decor costs 50
    purse(settings, pid, 1)
    assert sorted(camp(client, pid)["affordable"]) == sorted(SHOP_DECOR)  # the four decor pieces
    own(settings, pid, "decor:amphore")
    assert len(camp(client, pid)["affordable"]) == 3
    seal(settings, pid, "hydre", 2)
    assert set(camp(client, pid)["affordable"]) == {*SHOP_DECOR[1:], "accessory:hydre-cou"}  # and the Hydra's collar, 40


def test_protee_sells_nothing_before_8h_and_the_villa_waits_for_the_adult(client, settings):
    pid = make_profile(client, level="7H")
    purse(settings, pid, 300); seal(settings, pid, "protee", 5)
    assert len(camp(client, pid)["affordable"]) == 4                  # the decor only
    set_stage(settings, pid, "adult")
    assert len(camp(client, pid)["affordable"]) == 5                  # and the villa


# SP5 fix wave (the final review's open check): `camp.affordable` agrees with the stall's own buy rules.
# Each case counts what the camp says, then asks the stall itself (POST /purchases) about the edge item.
def test_decor_counts_while_the_walls_are_full_since_the_stall_still_sells_it(client, settings):
    pid = make_profile(client, level="10H")
    own(settings, pid, *QUEST_DECOR[:4])
    for d in QUEST_DECOR[:4]:
        assert wear(client, pid, d).status_code == 200                     # the cabin's four walls are full
    purse(settings, pid, 50)
    assert len(camp(client, pid)["affordable"]) == 4                           # the four shop pieces, still for sale
    assert buy(client, pid, "decor:amphore").status_code == 201           # and the stall sells one
    assert len(camp(client, pid)["affordable"]) == 0                           # the purse is empty again


def test_a_house_owned_or_not_yet_reachable_is_not_counted(client, settings):
    pid = make_profile(client, level="10H")
    purse(settings, pid, 10_000)
    camp(client, pid)                                                     # the dragon's row comes with the first camp
    set_stage(settings, pid, "illustre")
    assert len(camp(client, pid)["affordable"]) == 5                           # the decor and the villa, not the palais
    r = buy(client, pid, "house:palais")                                  # before the villa: the stall refuses it too
    assert (r.status_code, r.json()["detail"]) == (409, NOT_ON_SALE)
    assert buy(client, pid, "house:villa").status_code == 201
    assert len(camp(client, pid)["affordable"]) == 5                           # the villa owned, the palais now on sale
    r = buy(client, pid, "house:villa")
    assert (r.status_code, r.json()["detail"]) == (409, OWNED)
    other = make_profile(client, level="10H")
    purse(settings, other, 10_000)
    camp(client, other)
    set_stage(settings, other, "young")
    assert len(camp(client, other)["affordable"]) == 4                         # a young dragon: no house at all
    assert buy(client, other, "house:villa").status_code == 409


def test_a_piece_whose_seal_is_not_won_is_not_counted(client, settings):
    pid = make_profile(client, level="10H")
    purse(settings, pid, 10_000)
    seal(settings, pid, "hydre", 2)
    assert len(camp(client, pid)["affordable"]) == 5                           # the decor and the Hydra's collar only
    r = buy(client, pid, "accessory:hydre-queue")                         # its ring waits for the silver seal (3)
    assert (r.status_code, r.json()["detail"]) == (409, NOT_ON_SALE)
    seal(settings, pid, "hydre", 5)
    assert len(camp(client, pid)["affordable"]) == 8                           # the decor and her four pieces
    assert buy(client, pid, "accessory:hydre-tete").status_code == 201
    assert len(camp(client, pid)["affordable"]) == 7


def test_protee_sells_from_8h_only_as_his_stall_shelf_shows(client, settings):
    young = make_profile(client, level="7H")
    purse(settings, young, 10_000); seal(settings, young, "protee", 2)
    assert len(camp(client, young)["affordable"]) == 4                         # asleep before 8H: the decor only
    r = buy(client, young, "accessory:protee-cou")
    assert (r.status_code, r.json()["detail"]) == (409, NOT_ON_SALE)
    old = make_profile(client, level="8H")
    purse(settings, old, 10_000); seal(settings, old, "protee", 2)
    assert len(camp(client, old)["affordable"]) == 5                           # and his collar
    assert buy(client, old, "accessory:protee-cou").status_code == 201


# Spec §3: the guide reads a seal's XP from the server.
def test_the_world_serves_the_xp_of_a_seal(client):
    assert client.get("/api/world").json()["level_xp"] == 100
