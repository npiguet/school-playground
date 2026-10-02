from __future__ import annotations
from typing import Any, Literal
from pydantic import BaseModel, Field, field_validator
from app.levels import LEVELS, AVATARS

PIN_RE = r"^\d{4}$"
# Spec 2026-09-29 §3: the five review aids, in the camp's order.
AID_KEYS = ("argus", "ariane", "persee", "athena", "palamede")


class ProfileCreate(BaseModel):
    name: str = Field(min_length=1, max_length=30)
    avatar: str
    level: str
    pin: str | None = Field(default=None, pattern=PIN_RE)

    @field_validator("level")
    @classmethod
    def _level(cls, v: str) -> str:
        if v not in LEVELS:
            raise ValueError("unknown level")
        return v

    @field_validator("avatar")
    @classmethod
    def _avatar(cls, v: str) -> str:
        if v not in AVATARS:
            raise ValueError("unknown avatar")
        return v


class ProfilePatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=30)
    avatar: str | None = None
    level: str | None = None
    pin: str | None = None   # "" clears the PIN; must otherwise match PIN_RE (checked in the router)
    settings: dict[str, Any] | None = None


class ProfileOut(BaseModel):
    id: int
    name: str
    avatar: str
    level: str
    has_pin: bool
    created_at: str
    settings: dict[str, Any]


class PinCheck(BaseModel):
    pin: str


class TextCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    body: str = Field(min_length=1, max_length=4000)
    level: str
    source: str = "custom"
    author: str | None = None
    translator: str | None = None
    work: str | None = None
    credits: str | None = None
    added_by_profile_id: int | None = None
    due_date: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    scan_id: str | None = None


class TextHistory(BaseModel):
    times_played: int
    best_score: int | None
    best_catch_rate: float | None


class TextSummary(BaseModel):
    id: int
    title: str
    level: str
    source: str
    author: str | None
    translator: str | None
    work: str | None
    credits: str | None
    word_count: int
    added_by_profile_id: int | None
    added_by_name: str | None
    due_date: str | None
    created_at: str
    scan_id: str | None = None
    photo_count: int = 0
    # The verb tenses that raised the text above its own level, in French (« passé simple »); None
    # when its tenses raised nothing (app.nlp.tenses.tense_reason).
    tense_reason: str | None = None


class TextSummaryWithHistory(TextSummary):
    history: TextHistory | None = None


class TextFull(TextSummaryWithHistory):
    body: str
    annotation: dict[str, Any]


class SessionCreate(BaseModel):
    profile_id: int
    text_id: int
    # 1-3 since the pace redesign (2026-09-27); 4, the retired pace, stays valid for a page opened
    # before it (its session is not lost), as the rows recorded at 4 stay in the history and stats.
    pace_level: int = Field(ge=1, le=4)
    # Sub-project 1 removed the adaptive help stage and the client-side score: a page opened before
    # the change still sends them, accepted and ignored (the session's score is its XP, server-side).
    help_stage: int | None = None
    mode: Literal["dictation", "grimoire"] = "dictation"
    started_at: str
    draft: str
    final: str
    result: dict[str, Any]
    score: int | None = None
    catch_rate: float | None = Field(default=None, ge=0, le=1)
    encounter: str | None = None
    quest_id: int | None = None
    # The review aids taken along (spec 2026-09-29 §3); None from a page opened before them.
    aids: list[str] | None = None

    @field_validator("aids")
    @classmethod
    def _aids(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return v
        if any(a not in AID_KEYS for a in v):
            raise ValueError("unknown aid")
        if len(set(v)) != len(v):
            raise ValueError("an aid listed twice")
        return [a for a in AID_KEYS if a in v]


class CorruptRequest(BaseModel):
    profile_id: int
    seed: int | None = None
    focus: str | None = None


class DragonPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=20)
    tint: str | None = None


class QuestCreate(BaseModel):
    target: str


class OracleChoice(BaseModel):
    scroll: Literal["faible", "ecole", "destin"]
    lieutenant: str | None = None


class RewardPatch(BaseModel):
    equipped: bool


class Purchase(BaseModel):
    """Spec 2026-09-29 drachmes §2: one item of Hermès's stall, by its reward id."""
    item: str = Field(min_length=1, max_length=64)
