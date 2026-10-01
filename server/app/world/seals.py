"""Lieutenant levels, shown as seals (spec 2026-09-29 lieutenant levels §1): five per lieutenant, each
a material, each judged on a window of the lieutenant's days after its previous seal. The thresholds
come from the rules file (`Rules.levels`, defaults below). The window rules are pure; the readers
take a connection. On screen a level is always its material, never a number."""
from __future__ import annotations
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any
from app.clock import local_day
from app.levels import level_index
from app.world.catalog import LIEUTENANTS, LIEUTENANT_ORDER, MATERIALS

if TYPE_CHECKING:
    from app.rules import Rules

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


def lieutenants_for_level(level: str) -> list[str]:
    """The lieutenants awake at a class (Protée from 8H), in the camp's order."""
    return [k for k in LIEUTENANT_ORDER if level_index(level) >= level_index(LIEUTENANTS[k]["min_level"])]


def level_rows(conn, profile_id: int) -> dict[str, tuple[int, str]]:
    return {k: (lvl, at) for k, lvl, at in conn.execute(
        "SELECT lieutenant, level, reached_at FROM lieutenant_level WHERE profile_id = ?", (profile_id,))}


def levels_of(conn, profile_id: int) -> dict[str, int]:
    """Every lieutenant's seal, 0 before its first one. Sub-project 4's stall reads this (a lieutenant's
    seal L puts one accessory of its set on sale from L = 2)."""
    rows = level_rows(conn, profile_id)
    return {k: rows[k][0] if k in rows else 0 for k in LIEUTENANT_ORDER}


def _window(conn, profile_id: int, key: str, level: int, reached_at: str | None, rules: "Rules") -> LevelWindow:
    return level_window(seal_day_rows(conn, profile_id, LIEUTENANTS[key]["categories"]), since_day(reached_at), rules.levels[level])


def next_seal(conn, profile_id: int, key: str, level: int, reached_at: str | None, rules: "Rules") -> dict | None:
    """The window toward the next seal, for the war tent's gauges (None after the fifth)."""
    if level >= MAX_LEVEL:
        return None
    w = _window(conn, profile_id, key, level, reached_at, rules)
    return {"level": level + 1, "days": w.days, "chances": w.chances, "correct": w.correct, "complete": w.complete,
            "need": dict(rules.levels[level])}


def raise_levels(conn, profile_id: int, awake: list[str], now: str, rules: "Rules") -> list[tuple[str, int]]:
    """After a saved session (R4): each lieutenant awake at the class whose window passes gains its next
    seal, one at most. Written only over the seal before it (R5). Returns (lieutenant, new seal)."""
    rows = level_rows(conn, profile_id)
    raised = []
    for key in awake:
        level, reached_at = rows.get(key, (0, None))
        if level >= MAX_LEVEL or not reaches(_window(conn, profile_id, key, level, reached_at, rules), rules.levels[level]):
            continue
        cur = conn.execute(
            "INSERT INTO lieutenant_level(profile_id, lieutenant, level, reached_at) VALUES (?, ?, ?, ?) "
            "ON CONFLICT(profile_id, lieutenant) DO UPDATE SET level = excluded.level, reached_at = excluded.reached_at "
            "WHERE lieutenant_level.level = excluded.level - 1", (profile_id, key, level + 1, now))
        if cur.rowcount == 1:
            raised.append((key, level + 1))
    return raised
