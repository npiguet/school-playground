"""Lieutenant levels, shown as seals (spec 2026-09-29 lieutenant levels §1): five per lieutenant, each
a material, each judged on a window of the lieutenant's days after its previous seal. The thresholds
come from the rules file (`Rules.levels`, defaults below). The window rules are pure; the readers
take a connection. On screen a level is always its material, never a number."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Any
from app.clock import local_day
from app.world.catalog import MATERIALS

MAX_LEVEL = len(MATERIALS)
LEVEL_XP = 100   # seal L pays LEVEL_XP × L (spec §1)
DEFAULT_LEVELS: list[dict[str, Any]] = [
    {"days": 3, "chances": 12, "correct": 0.85},
    {"days": 4, "chances": 25, "correct": 0.88},
    {"days": 6, "chances": 45, "correct": 0.91},
    {"days": 8, "chances": 70, "correct": 0.94},
    {"days": 10, "chances": 100, "correct": 0.97},
]
# A share of whole counts can land a hair under a threshold written as a decimal (22/25 against 0.88).
EPSILON = 1e-9


@dataclass(frozen=True)
class LevelWindow:
    days: int
    chances: int
    mistakes: int
    correct: float | None
    complete: bool


def since_day(reached_at: str | None) -> str | None:
    """The Swiss day a seal was won (R3): only the days after it count for the next one."""
    return local_day(reached_at) if reached_at else None


def level_window(day_rows: list[dict], since: str | None, need: dict[str, Any]) -> LevelWindow:
    """The most recent days with a chance, strictly after `since`, newest first, until the window holds
    `need["days"]` days and `need["chances"]` chances (spec §1)."""
    days = chances = mistakes = 0
    rows = sorted((r for r in day_rows if r["chances"] > 0 and (since is None or r["day"] > since)),
                  key=lambda r: r["day"], reverse=True)
    for r in rows:
        if days >= need["days"] and chances >= need["chances"]:
            break
        days += 1; chances += r["chances"]; mistakes += r["mistakes"]
    complete = days >= need["days"] and chances >= need["chances"]
    correct = max(0.0, (chances - mistakes) / chances) if chances else None
    return LevelWindow(days, chances, mistakes, correct, complete)


def reaches(w: LevelWindow, need: dict[str, Any]) -> bool:
    return w.complete and w.correct is not None and w.correct >= need["correct"] - EPSILON


def seal_day_rows(conn, profile_id: int, categories: list[str]) -> list[dict]:
    """Per Swiss day, the chances the texts gave the lieutenant (the opportunities) and the mistakes
    of its kind left in the handed-in copies (missed + introduced), sub-project 1's measure."""
    marks = ",".join("?" * len(categories))
    return [{"day": d, "chances": c or 0, "mistakes": m or 0} for d, c, m in conn.execute(
        f"SELECT day, SUM(occurrences), SUM(missed + introduced) FROM profile_stat_day "
        f"WHERE profile_id = ? AND category IN ({marks}) GROUP BY day", (profile_id, *categories))]
