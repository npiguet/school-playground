"""Preview the nest's dragon on a nest painting exactly as the game places it.

SceneLayer: x = the layer's centre, y = its bottom edge, w = its width, all in art % of the 16:9
frame; the sprite is square, so its height is w x 16/9 in % of the frame's height. Draws, on top:
the feet line (green) across the layer's width, the hotspot ellipse (yellow), the growth sheet's
band (cyan), the HUD line at 10 % (red), the 4:3 safe zone x 12.5-87.5 (white) and the dialogue dock
x 27-87.5, y 80-100 (magenta); --grid adds a 5 % grid with labels every 10 % for measuring
landmarks (docs/art/scenes.md).

  python tools/art/nest_preview.py --painting assets/art/scenes/nest_adult.png --stage adult \
      --x 44 --y 81.2 --w 40 --ellipse 44,40,15,22 --sheet right --out <scratch>/adult.png
"""
import argparse
from pathlib import Path

from PIL import Image, ImageDraw

SHEET = {"left": (13.5, 19.0), "right": (68.5, 19.0)}  # x, w (art %), rods included: nest.ts SHEET_X
SHEET_TOP, SHEET_BOTTOM = 18.0, 45.0  # the sheet's top (nest.ts SHEET_TOP) and its usual bottom
HUD_LINE = 10.0  # nest.ts HUD_LINE
SAFE = (12.5, 87.5)
DOCK = (27.0, 80.0, 87.5, 100.0)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--painting", type=Path, required=True)
    ap.add_argument("--stage", required=True, choices=["egg", "hatchling", "young", "adult", "illustre", "ancestral"])
    ap.add_argument("--x", type=float, required=True)
    ap.add_argument("--y", type=float, required=True)
    ap.add_argument("--w", type=float, required=True)
    ap.add_argument("--ellipse", help="cx,cy,rx,ry in art %%")
    ap.add_argument("--sheet", choices=["left", "right"])
    ap.add_argument("--grid", action="store_true")
    ap.add_argument("--out", type=Path, required=True)
    a = ap.parse_args()

    bg = Image.open(a.painting).convert("RGBA")
    W, H = bg.size
    px = lambda v: v / 100 * W  # noqa: E731
    py = lambda v: v / 100 * H  # noqa: E731
    sprite = Image.open(f"web/public/art/dragon/dragon_{a.stage}_cut.webp").convert("RGBA")
    side = round(px(a.w))
    sprite = sprite.resize((side, side), Image.LANCZOS)
    left, top = round(px(a.x - a.w / 2)), round(py(a.y)) - side
    layer = Image.new("RGBA", bg.size, (0, 0, 0, 0))
    layer.paste(sprite, (left, top))  # paste accepts a negative top (a head above the frame shows)
    out = Image.alpha_composite(bg, layer)

    d = ImageDraw.Draw(out)
    if a.grid:
        for g in range(5, 100, 5):
            col = (255, 255, 255, 140) if g % 10 == 0 else (255, 255, 255, 60)
            d.line([(px(g), 0), (px(g), H)], fill=col, width=1)
            d.line([(0, py(g)), (W, py(g))], fill=col, width=1)
            if g % 10 == 0:
                d.text((px(g) + 3, 3), str(g), fill=(255, 255, 255, 255))
                d.text((3, py(g) + 3), str(g), fill=(255, 255, 255, 255))
    d.line([(px(SAFE[0]), 0), (px(SAFE[0]), H)], fill=(255, 255, 255, 255), width=3)
    d.line([(px(SAFE[1]), 0), (px(SAFE[1]), H)], fill=(255, 255, 255, 255), width=3)
    d.line([(0, py(HUD_LINE)), (W, py(HUD_LINE))], fill=(230, 40, 40, 255), width=3)
    d.rectangle([px(DOCK[0]), py(DOCK[1]), px(DOCK[2]), py(DOCK[3]) - 1], outline=(220, 0, 220, 255), width=3)
    d.line([(px(a.x - a.w / 2), py(a.y)), (px(a.x + a.w / 2), py(a.y))], fill=(40, 230, 40, 255), width=4)
    if a.ellipse:
        cx, cy, rx, ry = (float(v) for v in a.ellipse.split(","))
        d.ellipse([px(cx - rx), py(cy - ry), px(cx + rx), py(cy + ry)], outline=(255, 220, 0, 255), width=4)
    if a.sheet:
        sx, sw = SHEET[a.sheet]
        d.rectangle([px(sx), py(SHEET_TOP), px(sx + sw), py(SHEET_BOTTOM)], outline=(0, 220, 255, 255), width=4)
    a.out.parent.mkdir(parents=True, exist_ok=True)
    out.convert("RGB").save(a.out)
    print(a.out)


if __name__ == "__main__":
    main()
