from __future__ import annotations
from typing import Any
from pydantic import BaseModel, Field, field_validator
from app.levels import LEVELS, AVATARS

PIN_RE = r"^\d{4}$"


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
    help_stage: int
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


class TextSummaryWithHistory(TextSummary):
    history: TextHistory | None = None


class TextFull(TextSummaryWithHistory):
    body: str
    annotation: dict[str, Any]


class SessionCreate(BaseModel):
    profile_id: int
    text_id: int
    pace_level: int = Field(ge=1, le=4)
    help_stage: int = Field(ge=1, le=4)
    started_at: str
    draft: str
    final: str
    result: dict[str, Any]
    score: int = Field(ge=0)
    catch_rate: float | None = Field(default=None, ge=0, le=1)
