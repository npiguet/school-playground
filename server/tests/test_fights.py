"""Éris's ladder (spec 2026-09-29 lieutenant levels §4): counts across the lieutenants awake."""
from app.world.fights import DEFAULT_FIGHTS, fight_need, next_fight, open_fight

FIVE = ["hydre", "echo", "chimere", "sirenes", "lethe"]          # 5H to 7H
SIX = ["hydre", "echo", "chimere", "protee", "sirenes", "lethe"]  # from 8H


def lv(**levels):
    return {k: levels.get(k, 0) for k in SIX}


def test_the_ladder_counts_seals_across_lieutenants():
    assert open_fight(DEFAULT_FIGHTS, lv(hydre=1), FIVE, set()) is None
    assert next_fight(DEFAULT_FIGHTS, lv(hydre=1), FIVE, set()) == {"tier": 1, "level": 1, "missing": 1}
    assert open_fight(DEFAULT_FIGHTS, lv(hydre=1, lethe=2), FIVE, set()) == 1      # a higher seal counts too
    assert next_fight(DEFAULT_FIGHTS, lv(hydre=1, lethe=2), FIVE, set()) is None


def test_a_fight_opens_only_when_every_earlier_one_is_won():
    bronze = lv(hydre=2, echo=2, chimere=2, sirenes=2, lethe=2)
    assert open_fight(DEFAULT_FIGHTS, bronze, FIVE, set()) == 1
    assert open_fight(DEFAULT_FIGHTS, bronze, FIVE, {1}) == 2
    assert open_fight(DEFAULT_FIGHTS, bronze, FIVE, {1, 2, 3}) == 4
    assert open_fight(DEFAULT_FIGHTS, bronze, FIVE, {1, 2, 3, 4}) is None
    assert next_fight(DEFAULT_FIGHTS, bronze, FIVE, {1, 2, 3, 4}) == {"tier": 5, "level": 3, "missing": 2}


# Review focus 4: Protée wakes at 8H at level 0; the fights already won stay won.
def test_all_means_every_lieutenant_awake_at_the_class():
    wood = lv(hydre=1, echo=1, chimere=1, sirenes=1, lethe=1)
    assert open_fight(DEFAULT_FIGHTS, wood, FIVE, {1}) == 2
    assert open_fight(DEFAULT_FIGHTS, wood, SIX, {1}) is None
    assert next_fight(DEFAULT_FIGHTS, wood, SIX, {1}) == {"tier": 2, "level": 1, "missing": 1}
    assert open_fight(DEFAULT_FIGHTS, wood, SIX, {1, 2}) is None
    assert next_fight(DEFAULT_FIGHTS, wood, SIX, {1, 2}) == {"tier": 3, "level": 2, "missing": 2}


def test_a_count_above_the_lieutenants_awake_asks_them_all():
    assert fight_need({"level": 1, "count": 6}, 5) == 5 and fight_need({"level": 1, "count": "all"}, 6) == 6
    assert fight_need({"level": 1, "count": 2}, 5) == 2
    assert open_fight([{"level": 1, "count": 6}], lv(hydre=1, echo=1, chimere=1, sirenes=1, lethe=1), FIVE, set()) == 1


def test_every_fight_won_leaves_nothing_to_open():
    top = lv(**{k: 5 for k in SIX})
    won = set(range(1, 11))
    assert open_fight(DEFAULT_FIGHTS, top, SIX, won) is None and next_fight(DEFAULT_FIGHTS, top, SIX, won) is None
    # A ladder shortened in the rules file after more fights were won: nothing left either.
    assert open_fight(DEFAULT_FIGHTS[:4], top, SIX, won) is None and next_fight(DEFAULT_FIGHTS[:4], top, SIX, won) is None
