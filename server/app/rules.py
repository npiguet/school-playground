"""The game's tunable rules (spec 2026-09-29 §7): `regles.json` in the game's data folder (the NAS's
`./data`), read once at start-up. Every key is optional: a missing key keeps its built-in default,
and a malformed file or a value of the wrong type is logged and ignored, so a typo never stops the
game. GET /api/world serves them to the client (the copy line, the bonuses, the owl's hints); the
dragon's stage thresholds (`dragon_stages`) are served as the world's stage table; the seals'
thresholds (`levels`) and Éris's ladder (`fights`) are read by the server only."""
from __future__ import annotations
import json
import logging
import math
from dataclasses import asdict, dataclass, field, replace
from pathlib import Path
from typing import Any, Callable
from app.world.catalog import LIEUTENANT_ORDER
from app.world.dragon import DEFAULT_STAGE_XP, STAGE_ORDER
from app.world.fights import DEFAULT_FIGHTS, MAX_FIGHTS
from app.world.seals import DEFAULT_LEVELS, MAX_LEVEL

RULES_FILENAME = "regles.json"
PACES = ("1", "2", "3")
MAX_COUNT = 1_000_000
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
    dragon_stages: dict[str, int] = field(default_factory=lambda: dict(DEFAULT_STAGE_XP))
    levels: list[dict[str, Any]] = field(default_factory=lambda: [dict(r) for r in DEFAULT_LEVELS])
    fights: list[dict[str, Any]] = field(default_factory=lambda: [dict(f) for f in DEFAULT_FIGHTS])

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def _count(v: Any) -> bool:
    # bool is an int in Python: « true » is not a count.
    # Bounded: json.loads accepts integers of any length, and none of these counts needs a huge one.
    return isinstance(v, int) and not isinstance(v, bool) and 0 <= v <= MAX_COUNT


def _number(v: Any) -> bool:
    # json.loads accepts NaN and Infinity: neither is a threshold. An int too large for a float
    # (a 400-digit literal) would make float()/isfinite() raise OverflowError: refused the same way.
    if not isinstance(v, (int, float)) or isinstance(v, bool):
        return False
    try:
        return math.isfinite(float(v)) and v >= 0
    except OverflowError:
        return False


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


def _dragon_stages(raw: Any, path: Path) -> dict[str, int] | None:
    """Spec 2026-09-29 dragon growth §1: a partial table keeps the other stages' defaults; the egg is
    always 0; a table that no longer rises is refused whole (no single key can be blamed)."""
    if not isinstance(raw, dict):
        log.warning('%s: dragon_stages must be an object like {"young": 1200}; the built-in stages apply', path)
        return None
    out = dict(DEFAULT_STAGE_XP)
    for stage, value in raw.items():
        if stage == STAGE_ORDER[0] and _count(value) and value == 0:
            continue
        if stage not in STAGE_ORDER[1:] or not _count(value):
            log.warning("%s: dragon_stages[%r] = %r is ignored (hatchling to ancestral, a whole number of XP "
                        "from 0 to %d; the egg is always 0)", path, stage, value, MAX_COUNT)
            continue
        out[stage] = value
    xps = [out[s] for s in STAGE_ORDER]
    if any(a >= b for a, b in zip(xps, xps[1:])):
        log.warning("%s: dragon_stages must rise from stage to stage (%s); the built-in stages apply", path, xps)
        return None
    return out


SEAL_KEYS = tuple(str(i) for i in range(1, MAX_LEVEL + 1))


def _levels(raw: Any, path: Path) -> list[dict[str, Any]] | None:
    """Spec 2026-09-29 lieutenant levels §1 (R2): each seal's days, chances and correct share; a wrong
    value keeps its default, the others still apply."""
    if not isinstance(raw, dict):
        log.warning('%s: levels must be an object like {"2": {"chances": 30}}; the built-in seals apply', path)
        return None
    out = [dict(r) for r in DEFAULT_LEVELS]
    for key, value in raw.items():
        if key not in SEAL_KEYS or not isinstance(value, dict):
            log.warning('%s: levels[%r] is ignored (the seals are "1" to "5", each an object like {"days": 3})', path, key)
            continue
        for name, v in value.items():
            ok = (name in ("days", "chances") and _count(v) and v >= 1) or (name == "correct" and _share(v) and v > 0)
            if not ok:
                log.warning("%s: levels[%r][%r] = %r is ignored (days and chances are whole numbers from 1, correct a "
                            "share above 0 and at most 1); its default applies", path, key, name, v)
                continue
            out[int(key) - 1][name] = float(v) if name == "correct" else v
    return out


def _fight(f: Any) -> bool:
    return (isinstance(f, dict) and set(f) == {"level", "count"} and _count(f["level"]) and 1 <= f["level"] <= MAX_LEVEL
            and (f["count"] == "all" or (_count(f["count"]) and 1 <= f["count"] <= len(LIEUTENANT_ORDER))))


def _fights(raw: Any, path: Path) -> list[dict[str, Any]] | None:
    """Spec §4 (R2): refused whole on any wrong entry: dropping one would renumber the fights after it,
    and a won fight is stored by its number."""
    if not isinstance(raw, list) or not 1 <= len(raw) <= MAX_FIGHTS or not all(_fight(f) for f in raw):
        log.warning('%s: fights must be a list of 1 to %d fights like {"level": 1, "count": 2} (a seal from 1 to %d, '
                    'a count from 1 to %d or "all"); the built-in fights apply', path, MAX_FIGHTS, MAX_LEVEL, len(LIEUTENANT_ORDER))
        return None
    return [{"level": f["level"], "count": f["count"]} for f in raw]


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
        elif key == "dragon_stages":
            stages = _dragon_stages(value, path)
            if stages is not None:
                values[key] = stages
        elif key == "levels":
            levels = _levels(value, path)
            if levels is not None:
                values[key] = levels
        elif key == "fights":
            fights = _fights(value, path)
            if fights is not None:
                values[key] = fights
        elif key in CHECKS:
            ok, cast = CHECKS[key]
            if ok(value):
                values[key] = cast(value)
            else:
                log.warning("%s: %s = %r is ignored (wrong type or out of range); its default applies", path, key, value)
        else:
            log.warning("%s: unknown key %r is ignored", path, key)
    rules = replace(Rules(), **values)
    if rules.copy_belle_max_per_100 > rules.copy_correcte_max_per_100:
        # A « belle copie » limit above the « copie correcte » one would leave no correcte copy at all:
        # the pair is one setting, so both fall back together.
        log.warning("%s: copy_belle_max_per_100 (%s) is above copy_correcte_max_per_100 (%s): both defaults apply",
                    path, rules.copy_belle_max_per_100, rules.copy_correcte_max_per_100)
        default = Rules()
        rules = replace(rules, copy_belle_max_per_100=default.copy_belle_max_per_100,
                        copy_correcte_max_per_100=default.copy_correcte_max_per_100)
    return rules
