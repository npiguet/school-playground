"""The dragon's six stages, grown from total XP (spec 2026-09-29 dragon growth §1-§2). Pure: the
thresholds come from the rules file (`Rules.dragon_stages`, defaults below)."""
from __future__ import annotations

STAGE_ORDER = ("egg", "hatchling", "young", "adult", "illustre", "ancestral")
STAGE_NAMES = {"egg": "Œuf", "hatchling": "Dragonnet", "young": "Jeune dragon", "adult": "Dragon adulte",
               "illustre": "Dragon illustre", "ancestral": "Dragon ancestral"}
DEFAULT_STAGE_XP = {"egg": 0, "hatchling": 100, "young": 1200, "adult": 5000, "illustre": 15000, "ancestral": 40000}


def stage_index(stage: str | None) -> int:
    """A stage's place in the order; an unknown stored one (a hand-edited row) ranks below the egg."""
    return STAGE_ORDER.index(stage) if stage in STAGE_ORDER else -1


def stage_for_xp(total: int, thresholds: dict[str, int]) -> str:
    stage = STAGE_ORDER[0]
    for s in STAGE_ORDER:
        if total >= thresholds[s]:
            stage = s
    return stage


def grown_stage(stored: str | None, total: int, thresholds: dict[str, int]) -> str:
    """stored = max(stored, stage for the XP): a raised threshold or a restored backup never shrinks it."""
    computed = stage_for_xp(total, thresholds)
    return stored if stage_index(stored) > stage_index(computed) else computed


def stage_gauge(stage: str, thresholds: dict[str, int]) -> tuple[int, int | None]:
    """The gauge's floor (the stage's own threshold) and the next stage's threshold (None at the top)."""
    i = STAGE_ORDER.index(stage)
    nxt = thresholds[STAGE_ORDER[i + 1]] if i + 1 < len(STAGE_ORDER) else None
    return thresholds[stage], nxt


def stage_table(thresholds: dict[str, int]) -> list[dict]:
    """What GET /api/world serves in place of the old ranks: every stage, its name and its XP."""
    return [{"key": s, "name": STAGE_NAMES[s], "xp": thresholds[s]} for s in STAGE_ORDER]
