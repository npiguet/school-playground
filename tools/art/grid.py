"""Draw an art-% grid over a scene picture, for measuring places (docs/art/scenes.md).

    python tools/art/grid.py assets/art/scenes/cabin.png --out <tmp>/cabin-grid.png
    python tools/art/grid.py assets/art/scenes/cabin.png --out <tmp>/cabin-left.png --crop 10 10 40 60 --scale 2

Lines every 1 % (faint) and every 5 % (strong), the iPad safe zone (x 12.5 and 87.5, cyan), the
HUD's bottom edge (red: 10 % on a 720 px art box, nest.ts HUD_LINE; dashed red: 11.2 % on the
shortest, 640 px, art box, nest.ts HUD_LINE_SHORT), the room's name plaque (x 43-57, y 9.5-15.6 at
1280x720, red box) and the dialogue dock (x 27-87.5, y 80-100, orange box). With --crop (art % of
the whole picture) the crop is cut after drawing and enlarged --scale times; the 5 % lines are
labelled along the crop's top and left edges, in art % of the whole picture.
"""
import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HUD_LINE = 10.0                     # nest.ts HUD_LINE: 71.5 px of a 720 px art box
HUD_LINE_SHORT = 71.5 / 640 * 100   # nest.ts HUD_LINE_SHORT: the same 71.5 px on a 640 px art box


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("src", type=Path)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--crop", type=float, nargs=4, metavar=("X0", "Y0", "X1", "Y1"), default=(0, 0, 100, 100))
    ap.add_argument("--scale", type=float, default=1.0)
    a = ap.parse_args()
    img = Image.open(a.src).convert("RGBA")
    W, H = img.size
    px = lambda x: x * W / 100
    py = lambda y: y * H / 100
    over = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(over)
    for i in range(101):
        strong = i % 5 == 0
        c, w = ((255, 255, 255, 170), 2) if strong else ((255, 255, 255, 60), 1)
        d.line([(px(i), 0), (px(i), H)], fill=c, width=w)
        d.line([(0, py(i)), (W, py(i))], fill=c, width=w)
    for x in (12.5, 87.5):
        d.line([(px(x), 0), (px(x), H)], fill=(0, 200, 255, 230), width=3)
    d.line([(0, py(HUD_LINE)), (W, py(HUD_LINE))], fill=(255, 80, 80, 230), width=3)
    for x in range(0, W, 24):
        d.line([(x, py(HUD_LINE_SHORT)), (x + 12, py(HUD_LINE_SHORT))], fill=(255, 80, 80, 230), width=3)
    d.rectangle([px(43), py(9.5), px(57), py(15.6)], outline=(255, 80, 80, 230), width=3)
    d.rectangle([px(27), py(80), px(87.5), py(100)], outline=(255, 160, 0, 230), width=3)
    out = Image.alpha_composite(img, over)
    x0, y0, x1, y1 = a.crop
    out = out.crop((round(px(x0)), round(py(y0)), round(px(x1)), round(py(y1))))
    out = out.resize((round(out.width * a.scale), round(out.height * a.scale)), Image.LANCZOS).convert("RGB")
    d = ImageDraw.Draw(out)
    font = ImageFont.load_default(size=18)
    sx, sy = out.width / (x1 - x0), out.height / (y1 - y0)
    for i in range(0, 101, 5):
        if x0 <= i <= x1:
            d.text(((i - x0) * sx + 3, 3), str(i), fill=(255, 255, 0), font=font, stroke_width=2, stroke_fill=(0, 0, 0))
        if y0 <= i <= y1:
            d.text((3, (i - y0) * sy + 3), str(i), fill=(255, 255, 0), font=font, stroke_width=2, stroke_fill=(0, 0, 0))
    a.out.parent.mkdir(parents=True, exist_ok=True)
    out.save(a.out)
    print(a.out, out.size)


if __name__ == "__main__":
    main()
