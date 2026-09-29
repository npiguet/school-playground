"""The game's tunable rules (spec 2026-09-29 §7): `regles.json` in the game's data folder (the NAS's
`./data`), read once at start-up. Every key is optional: a missing key keeps its built-in default,
and a malformed file or a value of the wrong type is logged and ignored, so a typo never stops the
game. GET /api/world serves them to the client (the copy line, the bonuses, the owl's hints)."""
from __future__ import annotations
import json
import logging
import math
from dataclasses import asdict, dataclass, field, replace
from pathlib import Path
from typing import Any, Callable

RULES_FILENAME = "regles.json"
PACES = ("1", "2", "3")
log = logging.getLogger("uvicorn.error")


def _default_pace_bonus() -> dict[str, float]:
    return {"1": 0.0, "2": 0.25, "3": 0.5}


@dataclass(frozen=True)
class Rules:
    quest_min_chances: int = 3
    quest_min_correct: float = 0.85
    fight_max_per_100: float = 4.0
    copy_belle_max_per_100: float = 2.0
    copy_correcte_max_per_100: float = 8.0
    aid_bonus: float = 0.20
    pace_bonus: dict[str, float] = field(default_factory=_default_pace_bonus)
    prophecy_bonus: float = 0.5
    chouette_hints: int = 3

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def _count(v: Any) -> bool:
    # bool is an int in Python: « true » is not a count.
    return isinstance(v, int) and not isinstance(v, bool) and v >= 0


def _number(v: Any) -> bool:
    # json.loads accepts NaN and Infinity: neither is a threshold.
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) and v >= 0


def _share(v: Any) -> bool:
    return _number(v) and v <= 1


CHECKS: dict[str, tuple[Callable[[Any], bool], Callable[[Any], Any]]] = {
    "quest_min_chances": (_count, int),
    "quest_min_correct": (_share, float),
    "fight_max_per_100": (_number, float),
    "copy_belle_max_per_100": (_number, float),
    "copy_correcte_max_per_100": (_number, float),
    "aid_bonus": (_number, float),
    "prophecy_bonus": (_number, float),
    "chouette_hints": (_count, int),
}


def _pace_bonus(raw: Any, path: Path) -> dict[str, float] | None:
    if not isinstance(raw, dict):
        log.warning('%s: pace_bonus must be an object like {"2": 0.25}; the built-in one applies', path)
        return None
    out = _default_pace_bonus()
    for pace, value in raw.items():
        if pace not in PACES or not _number(value):
            log.warning("%s: pace_bonus[%r] = %r is ignored (paces 1 to 3, a number >= 0)", path, pace, value)
            continue
        out[pace] = float(value)
    return out


def load_rules(data_dir: Path) -> Rules:
    path = data_dir / RULES_FILENAME
    if not path.is_file():
        return Rules()
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, ValueError) as e:
        log.warning("%s is unreadable (%s): the built-in rules apply", path, e)
        return Rules()
    if not isinstance(raw, dict):
        log.warning("%s must hold a JSON object: the built-in rules apply", path)
        return Rules()
    values: dict[str, Any] = {}
    for key, value in raw.items():
        if key == "pace_bonus":
            pace = _pace_bonus(value, path)
            if pace is not None:
                values[key] = pace
        elif key in CHECKS:
            ok, cast = CHECKS[key]
            if ok(value):
                values[key] = cast(value)
            else:
                log.warning("%s: %s = %r is ignored (wrong type or out of range); its default applies", path, key, value)
        else:
            log.warning("%s: unknown key %r is ignored", path, key)
    return replace(Rules(), **values)
