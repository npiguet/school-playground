"""The camp's what-next inputs through the API (spec 2026-09-29 explanations §1, §3)."""
from tests.test_dragon import set_stage
from tests.test_drachmes_api import camp, own, purse
from tests.test_seals_api import seal
from tests.test_sessions import make_profile


# Review focus 1 (R5): the camp counts what the purse can buy, owned pieces aside.
def test_the_camp_counts_what_the_purse_can_buy(client, settings):
    pid = make_profile(client, level="10H")
    assert camp(client, pid)["affordable"] == 0
    purse(settings, pid, 49)
    assert camp(client, pid)["affordable"] == 0                  # the decor costs 50
    purse(settings, pid, 1)
    assert camp(client, pid)["affordable"] == 4                  # the four decor pieces
    own(settings, pid, "decor:amphore")
    assert camp(client, pid)["affordable"] == 3
    seal(settings, pid, "hydre", 2)
    assert camp(client, pid)["affordable"] == 4                  # and the Hydra's collar, 40


def test_protee_sells_nothing_before_8h_and_the_villa_waits_for_the_adult(client, settings):
    pid = make_profile(client, level="7H")
    purse(settings, pid, 300); seal(settings, pid, "protee", 5)
    assert camp(client, pid)["affordable"] == 4                  # the decor only
    set_stage(settings, pid, "adult")
    assert camp(client, pid)["affordable"] == 5                  # and the villa


# Spec §3: the guide reads a seal's XP from the server.
def test_the_world_serves_the_xp_of_a_seal(client):
    assert client.get("/api/world").json()["level_xp"] == 100
