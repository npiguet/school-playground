"""Drachmes (spec 2026-09-29 drachmes §1): the camp's spendable coin. XP is never spent; drachmes are.
Every session, quest, weekly goal, seal and Éris fight won pays some (amounts in the rules file,
`Rules.drachmes`); the balance is the sum of the `drachme_event` ledger and never goes below zero."""
from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.rules import Rules

DEFAULT_DRACHMES: dict[str, int] = {"xp_per_drachme": 10, "board": 5, "oracle": 15, "weekly": 5, "level": 10, "boss": 30}
# The session's other bonuses that pay drachmes, by the reason `apply_progression` gives them.
FLAT = ("board", "oracle", "boss", "weekly")


def session_drachmes(xp: int, rules: "Rules") -> int:
    """round(XP ÷ xp_per_drachme), halves up, in whole numbers (R3, review focus 2)."""
    d = rules.drachmes["xp_per_drachme"]
    return (2 * max(0, xp) + d) // (2 * d)


def earned_drachmes(session_xp: int, bonuses: list[dict], rules: "Rules") -> list[dict]:
    """The session's drachmes, part by part (R3): its own XP's, then one part per bonus that pays."""
    d = rules.drachmes
    parts = [{"reason": "session", "amount": session_drachmes(session_xp, rules)}]
    for b in bonuses:
        if b["reason"] in FLAT:
            parts.append({"reason": b["reason"], "amount": d[b["reason"]]})
        elif b["reason"] == "level":
            parts.append({"reason": "level", "amount": d["level"] * b["level"], "lieutenant": b["lieutenant"], "level": b["level"]})
    return [p for p in parts if p["amount"] > 0]
