"""XP from the copy, the rereading and the bonuses (spec 2026-09-29 §4)."""
from __future__ import annotations
from dataclasses import dataclass
from app.rules import Rules
from app.world.catalog import RANKS
from app.world.measures import mistakes_per_100


def _half_up(x: float) -> int:
    return int(x + 0.5)


@dataclass(frozen=True)
class SessionXp:
    total: int
    # The victory's chips (spec §4): `text` = effort + accuracy + rereading, then each bonus's share of
    # the multiplied part; they always add up to `total`.
    parts: dict[str, int]


def pace_bonus(pace_level: int, mode: str, rules: Rules) -> float:
    """The pace's bonus; the retired pace 4 (a stale page) counts as 3; the Grimoire has none."""
    if mode == "grimoire":
        return 0.0
    return rules.pace_bonus.get(str(min(3, max(1, pace_level))), 0.0)


def _split(amount: int, weights: dict[str, float]) -> dict[str, int]:
    """`amount` shared out in proportion to `weights` by largest remainders (ties in key order), so
    the shares sum to it exactly."""
    total = sum(weights.values())
    if amount <= 0 or total <= 0:
        return {k: 0 for k in weights}
    exact = {k: amount * w / total for k, w in weights.items()}
    shares = {k: int(x) for k, x in exact.items()}
    keys = list(weights)
    order = sorted(keys, key=lambda k: (-(exact[k] - shares[k]), keys.index(k)))
    for k in order[: amount - sum(shares.values())]:
        shares[k] += 1
    return shares


def session_xp(result: dict, pace_level: int, mode: str, prophecy: bool, aids_left: int, rules: Rules) -> SessionXp:
    words = int(result.get("totalWords", 0) or 0)
    m = mistakes_per_100(result)
    effort = 10 + words / 10
    accuracy = (words / 5) * max(0.0, 1 - m / 10)
    rereading = 2 * len(result.get("caught") or [])
    base = accuracy + rereading
    bonuses = {"pace": pace_bonus(pace_level, mode, rules), "aids": rules.aid_bonus * aids_left,
               "prophecy": rules.prophecy_bonus if prophecy else 0.0}
    total = _half_up(effort + base * (1 + sum(bonuses.values())))
    text = _half_up(effort + base)
    return SessionXp(total, {"text": text, **_split(total - text, {k: base * b for k, b in bonuses.items()})})


def rank_for(total: int) -> tuple[int, str, int, int | None]:
    rank, title, floor = 1, RANKS[0][1], 0
    for i, (threshold, name) in enumerate(RANKS):
        if total >= threshold: rank, title, floor = i + 1, name, threshold
    nxt = RANKS[rank][0] if rank < len(RANKS) else None
    return rank, title, floor, nxt
