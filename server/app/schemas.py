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
