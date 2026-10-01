"""L'étal d'Hermès (spec 2026-09-29 drachmes §2-§4): what Hermès sells, at what price (`Rules.prices`),
when each item is on sale, the house an owner lives in, and the accessories the dragon wears. Pure:
the router reads the database and writes the purchase (R5, R6, R7, R8)."""
from __future__ import annotations
from typing import TYPE_CHECKING, Any
from app.world.catalog import ACCESSORY_SETS, LIEUTENANT_ORDER, SLOT_LEVEL, SLOTS, accessory_id
from app.world.dragon import stage_index

if TYPE_CHECKING:
    from app.rules import Rules

DEFAULT_PRICES: dict[str, Any] = {"accessory": {"cou": 40, "queue": 60, "dos": 90, "tete": 130}, "decor": 50, "villa": 300, "palais": 800}


def default_prices() -> dict[str, Any]:
    return {**DEFAULT_PRICES, "accessory": dict(DEFAULT_PRICES["accessory"])}


SHOP_DECOR = ("decor:amphore", "decor:chouette", "decor:mosaique", "decor:bouclier")
HOUSES: dict[str, dict[str, Any]] = {
    "house:villa": {"key": "villa", "stage": "adult", "after": None},
    "house:palais": {"key": "palais", "stage": "illustre", "after": "house:villa"},
}
# Spec §3: the walls of each house hold this many pieces of decor (web/src/lib/world/scenes/cabin.ts
# DECOR_SLOTS has one slot per piece; cabin.test.ts reads this line).
MAX_DECOR = {"cabin": 4, "villa": 6, "palais": 9}
# Spec §4: the order the overlays are drawn in, back to front.
DRAW_ORDER = ("queue", "dos", "cou", "tete")
# Each item with its article, for « Acheter la couronne de pavots pour 130 drachmes ? ».
THE: dict[str, str] = {
    "decor:amphore": "l'amphore peinte", "decor:chouette": "la chouette de marbre",
    "decor:mosaique": "la mosaïque des Muses", "decor:bouclier": "le bouclier d'apparat",
    "house:villa": "la villa", "house:palais": "le palais",
    **{accessory_id(k, s): ACCESSORY_SETS[k][s][1] for k in LIEUTENANT_ORDER for s in SLOTS},
}


def parse_accessory(rid: str) -> tuple[str, str] | None:
    if not rid.startswith("accessory:"):
        return None
    key, _, slot = rid[len("accessory:"):].partition("-")
    return (key, slot) if key in ACCESSORY_SETS and slot in SLOTS else None


def is_item(rid: str) -> bool:
    return rid in THE


def price_of(rid: str, rules: "Rules") -> int:
    acc = parse_accessory(rid)
    if acc:
        return rules.prices["accessory"][acc[1]]
    if rid in SHOP_DECOR:
        return rules.prices["decor"]
    return rules.prices[HOUSES[rid]["key"]]


def house_of(owned: set[str]) -> str:
    """The highest house owned (R8)."""
    return next((HOUSES[h]["key"] for h in ("house:palais", "house:villa") if h in owned), "cabin")


def on_sale(rid: str, *, owned: set[str], levels: dict[str, int], awake: list[str], stage: str) -> bool:
    """Whether Hermès sells the item now (R6); a re-buy is refused apart, by the router."""
    acc = parse_accessory(rid)
    if acc:
        key, slot = acc
        return key in awake and levels.get(key, 0) >= SLOT_LEVEL[slot]
    if rid in SHOP_DECOR:
        return True
    h = HOUSES[rid]
    return stage_index(stage) >= stage_index(h["stage"]) and (h["after"] is None or h["after"] in owned)


def worn(equipped: set[str]) -> list[str]:
    """The equipped accessories as the manifest's item keys ("hydre-cou"), in the draw order (R7)."""
    by_slot: dict[str, str] = {}
    for rid in sorted(equipped):
        acc = parse_accessory(rid)
        if acc:
            by_slot.setdefault(acc[1], f"{acc[0]}-{acc[1]}")
    return [by_slot[s] for s in DRAW_ORDER if s in by_slot]


def shop_catalog(rules: "Rules") -> dict[str, Any]:
    """What `/api/world` serves of the stall (R9): every item with its price and its article."""
    return {
        "slots": list(SLOTS), "slot_levels": dict(SLOT_LEVEL), "draw_order": list(DRAW_ORDER),
        "accessories": [{"id": accessory_id(k, s), "item": f"{k}-{s}", "lieutenant": k, "slot": s, "level": SLOT_LEVEL[s],
                         "price": rules.prices["accessory"][s], "the": THE[accessory_id(k, s)]}
                        for k in LIEUTENANT_ORDER for s in SLOTS],
        "decor": [{"id": d, "price": rules.prices["decor"], "the": THE[d]} for d in SHOP_DECOR],
        "houses": [{"id": h, "key": v["key"], "stage": v["stage"], "after": v["after"], "price": rules.prices[v["key"]], "the": THE[h]}
                   for h, v in HOUSES.items()],
        "max_decor": dict(MAX_DECOR),
    }
