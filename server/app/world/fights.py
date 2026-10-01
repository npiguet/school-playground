"""Éris's fights (spec 2026-09-29 lieutenant levels §4): a ladder of conditions on seals counted
across the lieutenants awake at the hero's class, never one named lieutenant. Fight N opens when its
condition holds and fights 1 to N-1 are won; a won fight stays won (a done boss quest keeps its
number). Pure: the ladder comes from the rules file (`Rules.fights`, defaults below)."""
from __future__ import annotations
from typing import Any

MAX_FIGHTS = 20
# For each seal L: « at least 2 at L », then « all at L ».
DEFAULT_FIGHTS: list[dict[str, Any]] = [{"level": level, "count": count} for level in range(1, 6) for count in (2, "all")]


def fight_need(fight: dict[str, Any], awake: int) -> int:
    """How many lieutenants the fight asks at its seal: « all » is every one awake, and a count above
    that asks them all (a ladder written for 8H never blocks a 7H hero)."""
    return awake if fight["count"] == "all" else min(int(fight["count"]), awake)


def _missing(fight: dict[str, Any], levels: dict[str, int], awake: list[str]) -> int:
    sealed = sum(1 for k in awake if levels.get(k, 0) >= fight["level"])
    return max(0, fight_need(fight, len(awake)) - sealed)


def _first_unwon(ladder: list[dict], won: set[int]) -> tuple[int, dict] | None:
    """The first fight of the ladder not won yet (its tier, 1-based, and its entry); None when all are."""
    return next(((tier, fight) for tier, fight in enumerate(ladder, start=1) if tier not in won), None)


def open_fight(ladder: list[dict], levels: dict[str, int], awake: list[str], won: set[int]) -> int | None:
    """The first fight not won, when its condition holds (its tier, 1-based); else None."""
    first = _first_unwon(ladder, won)
    if first is None:
        return None
    tier, fight = first
    return tier if _missing(fight, levels, awake) == 0 else None


def next_fight(ladder: list[dict], levels: dict[str, int], awake: list[str], won: set[int]) -> dict | None:
    """The first fight not won while it is not open yet: its tier, its seal and how many seals it still
    asks (R8). None once it is open, and once every fight is won."""
    first = _first_unwon(ladder, won)
    if first is None:
        return None
    tier, fight = first
    missing = _missing(fight, levels, awake)
    return {"tier": tier, "level": fight["level"], "missing": missing} if missing else None
