"""Mastery (neutralisation) rule and boss tiers (spec §3.6; plan Decisions 3, 8, 11)."""
from __future__ import annotations
from dataclasses import dataclass
from math import ceil
from app.levels import level_index
from app.world.catalog import LIEUTENANTS, LIEUTENANT_ORDER, MASTERY


@dataclass(frozen=True)
class Window:
    days: int; traps: int; caught: int; rate: float | None; complete: bool


def lieutenants_for_level(level: str) -> list[str]:
    return [k for k in LIEUTENANT_ORDER if level_index(level) >= level_index(LIEUTENANTS[k]["min_level"])]


def mastery_window(day_rows: list[dict]) -> Window:
    days = traps = caught = 0
    for r in sorted((r for r in day_rows if r["errors_in_draft"] > 0), key=lambda r: r["day"], reverse=True):
        if days >= MASTERY["min_days"] and traps >= MASTERY["min_traps"]:
            break
        days += 1; traps += r["errors_in_draft"]; caught += r["caught"]
    complete = days >= MASTERY["min_days"] and traps >= MASTERY["min_traps"]
    return Window(days, traps, caught, caught / traps if traps else None, complete)


def is_neutralised(w: Window) -> bool:
    return w.complete and w.rate is not None and w.rate >= MASTERY["rate"]


def boss_tiers(available: int) -> dict[int, int]:
    return {1: ceil(available / 3), 2: ceil(2 * available / 3), 3: available}


def tier_available(neutralised: int, available: int, won: set[int]) -> int | None:
    for tier, need in boss_tiers(available).items():
        if tier in won: continue
        return tier if neutralised >= need else None
    return None
