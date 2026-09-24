"""XP from effort, catch rate and self-corrections (spec §3.6; plan Decision 6)."""
from __future__ import annotations
from app.world.catalog import RANKS

PACE_MULT = {1: 1.0, 2: 1.25, 3: 1.5, 4: 2.0}


def _half_up(x: float) -> int:
    return int(x + 0.5)


def session_xp(result: dict, pace_level: int, mode: str, prophecy: bool) -> int:
    words = int(result.get("totalWords", 0))
    caught = len(result.get("caught", []))
    rate = result.get("catchRate")
    catch_bonus = 15 if not result.get("draftErrors") else _half_up(30 * (rate or 0.0))
    base = 10 + words / 10 + 5 * caught + catch_bonus
    mult = PACE_MULT.get(pace_level, 1.0) if mode == "dictation" else 1.0
    if prophecy: mult *= 1.5
    return _half_up(base * mult)


def rank_for(total: int) -> tuple[int, str, int, int | None]:
    rank, title, floor = 1, RANKS[0][1], 0
    for i, (threshold, name) in enumerate(RANKS):
        if total >= threshold: rank, title, floor = i + 1, name, threshold
    nxt = RANKS[rank][0] if rank < len(RANKS) else None
    return rank, title, floor, nxt
