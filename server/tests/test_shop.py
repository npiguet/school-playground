"""Drachmes and Hermès's stall, the pure rules (spec 2026-09-29 drachmes §1-§5)."""
from app.rules import Rules
from app.world.catalog import REWARDS, SLOT_LEVEL, SLOTS, accessory_id
from app.world.drachmes import earned_drachmes, session_drachmes
from app.world.shop import (DRAW_ORDER, MAX_DECOR, SHOP_DECOR, THE, house_of, is_item, on_sale, parse_accessory, price_of,
                            shop_catalog, worn)

FIVE = ["hydre", "echo", "chimere", "sirenes", "lethe"]          # 5H to 7H
SIX = ["hydre", "echo", "chimere", "protee", "sirenes", "lethe"]  # from 8H


def lv(**levels):
    return {k: levels.get(k, 0) for k in SIX}


def test_twenty_four_accessories_one_set_of_four_per_lieutenant():
    ids = [k for k in REWARDS if k.startswith("accessory:")]
    assert len(ids) == 24 and ids[:4] == ["accessory:hydre-cou", "accessory:hydre-queue", "accessory:hydre-dos", "accessory:hydre-tete"]
    assert REWARDS["accessory:lethe-tete"] == {"id": "accessory:lethe-tete", "kind": "accessory", "name": "Couronne de pavots",
                                              "desc": "Une parure de Léthé, à porter sur la tête.", "source": "L'étal d'Hermès"}
    assert REWARDS["accessory:hydre-cou"]["desc"] == "Une parure de l'Hydre, à porter au cou."
    assert REWARDS["accessory:sirenes-queue"]["name"] == "Rubans de plumes"
    assert THE["accessory:lethe-tete"] == "la couronne de pavots" and THE["accessory:sirenes-queue"] == "les rubans de plumes"
    assert THE["accessory:hydre-queue"] == "l'anneau de serpents de bronze"
    assert parse_accessory("accessory:echo-dos") == ("echo", "dos")
    assert parse_accessory("accessory:echo-aile") is None and parse_accessory("accessory:medusa-cou") is None
    assert parse_accessory("decor:tapis") is None
    assert SLOTS == ("cou", "queue", "dos", "tete") and SLOT_LEVEL == {"cou": 2, "queue": 3, "dos": 4, "tete": 5}
    assert DRAW_ORDER == ("queue", "dos", "cou", "tete")


def test_the_shop_decor_and_the_two_houses():
    assert [REWARDS[d]["name"] for d in SHOP_DECOR] == ["Amphore peinte", "Chouette de marbre", "Mosaïque des Muses", "Bouclier d'apparat"]
    assert all(REWARDS[d]["kind"] == "decor" and REWARDS[d]["source"] == "L'étal d'Hermès" for d in SHOP_DECOR)
    assert (REWARDS["house:villa"]["name"], REWARDS["house:palais"]["name"]) == ("La villa", "Le palais")
    assert REWARDS["house:villa"]["kind"] == REWARDS["house:palais"]["kind"] == "house"
    assert MAX_DECOR == {"cabin": 4, "villa": 6, "palais": 9}
    assert house_of(set()) == "cabin" and house_of({"house:villa"}) == "villa" and house_of({"house:villa", "house:palais"}) == "palais"
    assert is_item("house:villa") and is_item("decor:bouclier") and is_item("accessory:echo-cou")
    assert not is_item("decor:tapis") and not is_item("egide") and not is_item("trophy:hydre:1")


def test_no_reward_names_the_cabin_a_villa_or_palais_owner_left():
    """Spec 2026-09-29 drachmes §3 (Task 7 fix round 1): a description is read in every house."""
    assert REWARDS["decor:lanterne"]["desc"] == "Une lanterne qui éclaire ta maison."
    assert [r["id"] for r in REWARDS.values() if "cabane" in (r["name"] + r["desc"] + r["source"]).lower()] == []


def test_prices_come_from_the_rules():
    r = Rules()
    assert [price_of(accessory_id("hydre", s), r) for s in SLOTS] == [40, 60, 90, 130]
    assert (price_of("decor:amphore", r), price_of("house:villa", r), price_of("house:palais", r)) == (50, 300, 800)


# Review focus 3.
def test_an_accessory_is_on_sale_from_its_lieutenants_seal():
    kw = dict(owned=set(), awake=SIX, stage="young")
    assert on_sale("accessory:hydre-cou", levels=lv(hydre=2), **kw)
    assert not on_sale("accessory:hydre-queue", levels=lv(hydre=2), **kw)
    assert not on_sale("accessory:hydre-cou", levels=lv(hydre=1), **kw)
    assert on_sale("accessory:hydre-tete", levels=lv(hydre=5), **kw)
    # Protée's set appears from 8H: asleep at the class, nothing of his is sold, whatever the store says.
    assert not on_sale("accessory:protee-cou", levels=lv(protee=5), owned=set(), awake=FIVE, stage="young")
    assert on_sale("decor:amphore", levels={}, owned=set(), awake=FIVE, stage="egg")


def test_the_houses_follow_the_dragon_and_each_other():
    kw = dict(levels={}, awake=SIX)
    assert not on_sale("house:villa", owned=set(), stage="young", **kw)
    assert on_sale("house:villa", owned=set(), stage="adult", **kw)
    assert not on_sale("house:palais", owned=set(), stage="ancestral", **kw)         # after the villa
    assert not on_sale("house:palais", owned={"house:villa"}, stage="adult", **kw)
    assert on_sale("house:palais", owned={"house:villa"}, stage="illustre", **kw)


# Review focus 4.
def test_the_worn_pieces_in_the_draw_order():
    assert worn({"accessory:lethe-tete", "accessory:hydre-cou", "accessory:echo-queue", "decor:tapis"}) == ["echo-queue", "hydre-cou", "lethe-tete"]
    assert worn(set()) == []


def test_the_shop_catalog_served_to_the_client():
    c = shop_catalog(Rules())
    assert c["accessories"][0] == {"id": "accessory:hydre-cou", "item": "hydre-cou", "lieutenant": "hydre", "slot": "cou", "level": 2,
                                   "price": 40, "the": "le collier d'écailles vertes"}
    assert len(c["accessories"]) == 24 and [d["id"] for d in c["decor"]] == list(SHOP_DECOR)
    assert c["decor"][0] == {"id": "decor:amphore", "price": 50, "the": "l'amphore peinte"}
    assert c["houses"] == [{"id": "house:villa", "key": "villa", "stage": "adult", "after": None, "price": 300, "the": "la villa"},
                           {"id": "house:palais", "key": "palais", "stage": "illustre", "after": "house:villa", "price": 800,
                            "the": "le palais"}]
    assert c["slots"] == ["cou", "queue", "dos", "tete"] and c["draw_order"] == ["queue", "dos", "cou", "tete"]
    assert c["slot_levels"] == {"cou": 2, "queue": 3, "dos": 4, "tete": 5} and c["max_decor"] == {"cabin": 4, "villa": 6, "palais": 9}


# Review focus 2: Python's round() gives round(2.5) == 2; the purse rounds halves up.
def test_a_session_pays_its_xp_divided_by_ten_rounded_half_up():
    r = Rules()
    assert [session_drachmes(x, r) for x in (0, 4, 5, 25, 44, 45, 318)] == [0, 0, 1, 3, 4, 5, 32]


def test_every_source_pays_its_drachmes():
    bonuses = [{"reason": "board", "amount": 60}, {"reason": "oracle", "amount": 150}, {"reason": "boss", "amount": 300},
               {"reason": "weekly", "amount": 40}, {"reason": "level", "amount": 200, "lieutenant": "hydre", "level": 2},
               {"reason": "mystery", "amount": 9}]
    assert earned_drachmes(54, bonuses, Rules()) == [
        {"reason": "session", "amount": 5}, {"reason": "board", "amount": 5}, {"reason": "oracle", "amount": 15},
        {"reason": "boss", "amount": 30}, {"reason": "weekly", "amount": 5},
        {"reason": "level", "amount": 20, "lieutenant": "hydre", "level": 2}]
    assert earned_drachmes(3, [], Rules()) == []                                    # a zero part is no part
