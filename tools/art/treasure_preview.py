"""Preview the treasures in a room before the game draws them (spec 2026-10-02 house treasures).

    python tools/art/treasure_preview.py cabin --out <tmp>/cabin-full.png [--level 5] [--outline]
        [--check] [--only hydre,decor:tapis]

Reads the room (assets/art/scenes/<house>.png), its places (web/src/lib/world/scenes/
treasure-places.json), the twelve treasures (assets/art/export/treasures/, else web/public/art/
treasures/) and the trophies (web/public/art/trophies/large/trophy-<lt>-<level>.webp), and pastes
each piece with the game's maths (treasures.ts placeBox): x the centre, y the bottom edge, w the
width, art %; the image keeps its own aspect; a trophy sits TROPHY_FOOT of its height lower (its
transparent margin). Standing pieces get an ellipse like the CSS contact shadow, hanging ones a faint
drop shadow (ruling R3); the tapis none.

The three places' polygons and plaque sides are the game's own: read from web/src/lib/world/scenes/
cabin.shapes.ts (each `<HOUSE>_SHAPES` block's `points` lists and HOUSE_LABELS, in that file's
layout; the tool stops if it cannot find all nine), so --check runs on the very values the room uses.
--outline draws each piece's box and id, the places' polygons and their plaques, the HUD line, the
name plaques and the safe zone. --check prints every problem and exits 1 if there is one:
- a piece outside the frame or the 4:3 safe zone (x 12.5-87.5), or reaching above the HUD where it
  reaches lowest (71.5 px of the shortest, 640 px, art box: 11.2 %, nest.ts HUD_LINE_SHORT);
- a piece under the room's name plaque (« Ton palais », at 1280x720 and on the 640 px art box) or
  under the exit sign (« Le camp », SceneExit.svelte: 13.5 % from the stage's left, 3 % from its
  bottom; on the art box it reaches x 13.5-30.5, y 89.9-97 across 1280x720, 1180x820, 1366x1024
  and the smallest window, 1024x640);
- two pieces whose boxes overlap;
- a piece on a place's plaque or on its leader (the 16 px bronze line from the shape's edge to the
  plaque and the 10 px gold pin at the shape's edge, Hotspot.svelte), or a decor piece in a place's
  tappable box (its polygon's bounding box). The trophies and the gear stand in the cupboard, which
  is the « Tes trésors » place itself (spec 2026-10-02, the rooms' hero): they may lie inside that
  one place's box, never on a plaque.

The plaques are modelled on the 640 px art box, where they are largest in art % (Hotspot.svelte:
4 px padding, a 16 px Cinzel name, « Tes trésors » with its caption line, a 16 px leader gap):
PLAQUES gives each one's width and height, centred on its polygon's box and kept inside the safe
zone (geometry.ts plaqueShift). The name plaques, the exit sign, the plaques and the leader are
read from web/src/lib/world/scenes/treasure-checks.json, the model treasures.test.ts checks too.
"""
import argparse
import json
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

LIEUTENANTS = ["hydre", "echo", "chimere", "protee", "sirenes", "lethe"]
GEAR = ["sandales_hermes", "egide", "foudre_zeus"]
DECOR = ["decor:lanterne", "decor:tapis", "decor:bibliotheque", "decor:trophee", "decor:fresque",
         "decor:amphore", "decor:chouette", "decor:mosaique", "decor:bouclier"]
PIECES = [*LIEUTENANTS, *GEAR, *DECOR]
STANDS = {*LIEUTENANTS, *GEAR, "decor:bibliotheque", "decor:trophee", "decor:amphore", "decor:chouette"}
HANGS = {"decor:lanterne", "decor:fresque", "decor:mosaique", "decor:bouclier"}
CUPBOARD = {*LIEUTENANTS, *GEAR}
TROPHY_FOOT = 0.065
PLACES = Path("web/src/lib/world/scenes/treasure-places.json")
SHAPES = Path("web/src/lib/world/scenes/cabin.shapes.ts")
HOUSES = ["cabin", "villa", "palais"]
PLACE_IDS = ["trophies", "journal", "lyre"]
SAFE = (12.5, 87.5)
HUD_LINE = 10.0                     # 71.5 px of a 720 px art box (nest.ts HUD_LINE)
HUD_LINE_SHORT = 71.5 / 640 * 100   # the same 71.5 px of a 640 px art box (nest.ts HUD_LINE_SHORT)
# The room's fixed boxes in art % (the name plaques, the exit sign, the places' plaques and leaders):
# one model shared with treasures.test.ts, its notes in its `_doc`.
CHECKS = json.loads(Path("web/src/lib/world/scenes/treasure-checks.json").read_text(encoding="utf-8"))
NAME_PLAQUES = [(n["x"], n["y"], n["w"], n["h"]) for n in CHECKS["nameplates"]]
EXIT_SIGN = tuple(CHECKS["exitSign"][k] for k in ("x", "y", "w", "h"))
# Place id -> (width, height) of its plaque in art % of a 640 px art box, the leader's gap included.
PLAQUES = {sid: (p["w"], p["h"]) for sid, p in CHECKS["plaques"].items()}
_L = CHECKS["leaderPx"]
LEADER_LEN, PIN_H, PIN_W = _L["len"] / _L["artH"] * 100, _L["pinH"] / _L["artH"] * 100, _L["pinW"] / _L["artW"] * 100


def house_shapes(house: str, src: Path = SHAPES) -> dict:
    """{place: {"points": [[x, y], ...], "labelPos": "above" | "below"}} of one house, read from
    cabin.shapes.ts: `export const <HOUSE>_SHAPES = { <place>: { kind: 'polygon', points: [...] }, ...}`
    and `HOUSE_LABELS = { <house>: { <place>: '<side>', ... }, ... }`."""
    ts = src.read_text(encoding="utf-8")
    block = re.search(rf"export const {house.upper()}_SHAPES = \{{(.*?)\}} satisfies ShapeMap;", ts, re.S)
    labels = re.search(rf"^\s*{house}: \{{([^}}]*)\}}", ts.split("export const HOUSE_LABELS", 1)[-1], re.M)
    if not block or not labels:
        sys.exit(f"{src}: no {house.upper()}_SHAPES block or no HOUSE_LABELS.{house} line")
    sides = dict(re.findall(r"(\w+): '(above|below)'", labels.group(1)))
    out = {}
    for pid in PLACE_IDS:
        m = re.search(rf"\b{pid}: \{{ kind: 'polygon', points: (\[\[.*?\]\]) \}}", block.group(1))
        if not m or pid not in sides:
            sys.exit(f"{src}: {house}'s {pid} has no polygon or no plaque side")
        out[pid] = {"points": json.loads(m.group(1)), "labelPos": sides[pid]}
    return out


def piece_file(pid: str, level: int) -> Path:
    if pid in LIEUTENANTS:
        return Path(f"web/public/art/trophies/large/trophy-{pid}-{level}.webp")
    name = pid.replace(":", "-")
    staged = Path(f"assets/art/export/treasures/{name}.webp")
    return staged if staged.exists() else Path(f"web/public/art/treasures/{name}.webp")


def place_box(p: dict, aspect: float, foot: float) -> tuple[float, float, float, float]:
    """(x, y, w, h) in art %: treasures.ts placeBox."""
    h = p["w"] * aspect * 16 / 9
    return (p["x"] - p["w"] / 2, p["y"] - h * (1 - foot), p["w"], h)


def hit(a, b) -> bool:
    return a[0] < b[0] + b[2] and b[0] < a[0] + a[2] and a[1] < b[1] + b[3] and b[1] < a[1] + a[3]


def shape_box(shape) -> tuple[float, float, float, float]:
    xs = [p[0] for p in shape["points"]]
    ys = [p[1] for p in shape["points"]]
    return (min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys))


def plaque(sid: str, shape) -> tuple[float, float, float, float]:
    bx, by, bw, bh = shape_box(shape)
    w, h = PLAQUES[sid]
    left = bx + bw / 2 + shape.get("labelDx", 0) * bw / 100 - w / 2
    left = min(max(left, SAFE[0]), SAFE[1] - w)
    return (left, by - h, w, h) if shape["labelPos"] == "above" else (left, by + bh, w, h)


def leader(shape) -> tuple[float, float, float, float]:
    """The leader and its pin: from the pin's far side, at the shape's edge, to the plaque."""
    bx, by, bw, bh = shape_box(shape)
    x = bx + bw / 2 - PIN_W / 2
    if shape["labelPos"] == "above":
        return (x, by - LEADER_LEN, PIN_W, LEADER_LEN + PIN_H)
    return (x, by + bh - PIN_H, PIN_W, LEADER_LEN + PIN_H)


def problems_of(boxes: dict, shapes: dict) -> list[str]:
    out = []
    ids = list(boxes)
    for i, pid in enumerate(ids):
        b = boxes[pid]
        if b[0] < SAFE[0] or b[0] + b[2] > SAFE[1] or b[1] < HUD_LINE_SHORT or b[1] + b[3] > 100:
            out.append(f"{pid} outside the frame, the safe zone or under the HUD: {tuple(round(v, 2) for v in b)}")
        if any(hit(b, n) for n in NAME_PLAQUES):
            out.append(f"{pid} under the room's name")
        if hit(b, EXIT_SIGN):
            out.append(f"{pid} under the exit sign")
        for other in ids[i + 1:]:
            if hit(b, boxes[other]):
                out.append(f"{pid} overlaps {other}")
        for sid, s in shapes.items():
            if hit(b, plaque(sid, s)):
                out.append(f"{pid} on {sid}'s plaque")
            if hit(b, leader(s)):
                out.append(f"{pid} on {sid}'s leader")
            if hit(b, shape_box(s)) and not (sid == "trophies" and pid in CUPBOARD):
                out.append(f"{pid} in {sid}'s box")
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("house", choices=["cabin", "villa", "palais"])
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--level", type=int, default=5)
    ap.add_argument("--outline", action="store_true")
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--only", help="comma-separated piece ids to paste (default: all)")
    a = ap.parse_args()
    room = Image.open(f"assets/art/scenes/{a.house}.png").convert("RGBA")
    W, H = room.size
    places = json.loads(PLACES.read_text(encoding="utf-8"))[a.house]
    missing = [pid for pid in PIECES if pid not in places]
    only = set(a.only.split(",")) if a.only else None
    boxes = {}
    for pid, p in sorted(places.items(), key=lambda kv: kv[1]["y"]):
        img = Image.open(piece_file(pid, a.level)).convert("RGBA")
        foot = TROPHY_FOOT if pid in LIEUTENANTS else 0
        bx, by, bw, bh = place_box(p, img.height / img.width, foot)
        boxes[pid] = (bx, by, bw, bh)
        if only is not None and pid not in only:
            continue
        size = (round(bw * W / 100), round(bh * H / 100))
        left, top = round(bx * W / 100), round(by * H / 100)
        sprite = img.resize(size, Image.LANCZOS)
        if pid in STANDS:
            sw = size[0] * (0.44 if pid in LIEUTENANTS else 0.76)
            sh = sw / 6
            cx, cy = left + size[0] / 2, top + size[1] * (1 - foot)
            shadow = Image.new("RGBA", room.size, (0, 0, 0, 0))
            ImageDraw.Draw(shadow).ellipse([cx - sw / 2, cy - sh / 2, cx + sw / 2, cy + sh / 2], fill=(20, 12, 6, 115))
            room = Image.alpha_composite(room, shadow.filter(ImageFilter.GaussianBlur(sh / 3)))
        elif pid in HANGS:
            alpha = sprite.getchannel("A").point(lambda v: v * 70 // 255)
            drop = Image.new("RGBA", sprite.size, (20, 12, 6, 0))
            drop.putalpha(alpha)
            layer = Image.new("RGBA", room.size, (0, 0, 0, 0))
            layer.alpha_composite(drop, (left + max(2, size[0] // 40), top + max(3, size[1] // 30)))
            room = Image.alpha_composite(room, layer.filter(ImageFilter.GaussianBlur(4)))
        room.alpha_composite(sprite, (left, top))
    d = ImageDraw.Draw(room)
    font = ImageFont.load_default(size=18)
    to_px = lambda b: [b[0] * W / 100, b[1] * H / 100, (b[0] + b[2]) * W / 100, (b[1] + b[3]) * H / 100]
    if a.outline:
        for pid, b in boxes.items():
            d.rectangle(to_px(b), outline=(255, 255, 0, 255), width=2)
            d.text((b[0] * W / 100 + 3, b[1] * H / 100 + 3), pid, fill=(255, 255, 0, 255), font=font, stroke_width=2, stroke_fill=(0, 0, 0, 255))
        for n in [*NAME_PLAQUES, EXIT_SIGN]:
            d.rectangle(to_px(n), outline=(255, 80, 80, 255), width=2)
        d.line([(0, HUD_LINE_SHORT * H / 100), (W, HUD_LINE_SHORT * H / 100)], fill=(255, 80, 80, 255), width=2)
        for x in SAFE:
            d.line([(x * W / 100, 0), (x * W / 100, H)], fill=(0, 200, 255, 255), width=2)
    shapes = house_shapes(a.house)
    for sid, s in shapes.items() if a.outline else ():
        d.polygon([(x * W / 100, y * H / 100) for x, y in s["points"]], outline=(0, 255, 120, 255), width=3)
        d.rectangle(to_px(plaque(sid, s)), outline=(255, 120, 0, 255), width=2)
        d.text((plaque(sid, s)[0] * W / 100 + 3, plaque(sid, s)[1] * H / 100 + 3), sid, fill=(255, 120, 0, 255), font=font, stroke_width=2, stroke_fill=(0, 0, 0, 255))
    a.out.parent.mkdir(parents=True, exist_ok=True)
    room.convert("RGB").save(a.out)
    print(a.out)
    if not a.check:
        return
    problems = [f"{pid} has no place" for pid in missing] + problems_of(boxes, shapes)
    for p in problems:
        print("PROBLEM", p)
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
