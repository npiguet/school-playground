"""Export the painted icons to the web and build their contact sheet.

    python tools/art/icons.py webp    # assets/art/icons/<id>_cut.png -> web/public/art/icons/<id>.webp
    python tools/art/icons.py sheet   # docs/art/icons-sheet.png
    python tools/art/icons.py app     # web/public/icons/*.png (home-screen icon) from app-apple_cut.png
    python tools/art/icons.py all

The tool-* icons are made from the existing emblem cut-outs (REUSE), not
from a generation. The app icon replaces the flat SVG apple that
web/scripts/make-icons.mjs rasterised: do not run `npm run icons` again, or
it overwrites the painted PNGs.

WebP: the cut-out is trimmed to its alpha bounding box, padded to a square
with a small margin (so every icon fills its box the same way), downscaled to
256x256 and saved with alpha. Quality starts at 80 and steps down until the
file is under 25 KB (floor 50).

Contact sheet: every icon at 64 px and 128 px, on the dark UI colour and on
parchment, labelled with its id.

Runs inside the throwaway Docker container (tools/art/run_docker.sh icons).
Requires: pillow
"""
import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

SRC = Path("assets/art/icons")
# Icons made from an existing cut-out instead of a new generation (they read well at 64 px).
REUSE = {
    "tool-persee": Path("assets/art/emblems/persee_cut.png"),
    "tool-athena": Path("assets/art/emblems/athena_cut.png"),
    "tool-ariane": Path("assets/art/emblems/ariane_cut.png"),
    "tool-argus": Path("assets/art/emblems/argus_cut.png"),
}
APP_ID = "app-apple"            # home-screen icon: goes to web/public/icons, not to art/icons
APP_DST = Path("web/public/icons")
TERRACOTTA = (192, 98, 59)      # #C0623B, the manifest theme colour and the old icon's ground
DST = Path("web/public/art/icons")
SHEET = Path("docs/art/icons-sheet.png")
SIZE = 256
MARGIN = 0.06          # empty border on each side, as a fraction of the square
BUDGET = 25 * 1024
DARK = (27, 20, 33)    # Discord violet-black #1B1421
PARCHMENT = (236, 223, 193)


def sources():
    """(icon id, cut-out path) for every icon, generated ones and reused ones."""
    found = {p.stem[: -len("_cut")]: p for p in SRC.glob("*_cut.png")}
    found.pop(APP_ID, None)
    found.update(REUSE)
    return sorted(found.items())


def square(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    alpha = img.getchannel("A")
    # Bounding box of the solid object only: an opening (min then max filter) drops the few stray
    # specks the matting keeps far from the object, then everything outside the box is cleared.
    solid = alpha.point(lambda a: 255 if a > 128 else 0).filter(ImageFilter.MinFilter(9)).filter(ImageFilter.MaxFilter(9))
    l, t, r, b = solid.getbbox() or (0, 0, *img.size)
    pad = 6
    box = (max(l - pad, 0), max(t - pad, 0), min(r + pad, img.width), min(b + pad, img.height))
    img = img.crop(box)
    side = round(max(img.size) / (1 - 2 * MARGIN))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(img, ((side - img.width) // 2, (side - img.height) // 2))
    return canvas


def webp():
    DST.mkdir(parents=True, exist_ok=True)
    largest = 0
    for icon_id, src in sources():
        img = square(Image.open(src)).resize((SIZE, SIZE), Image.LANCZOS)
        dst = DST / f"{icon_id}.webp"
        for q in range(80, 45, -5):
            img.save(dst, "WEBP", quality=q, method=6)
            if dst.stat().st_size <= BUDGET:
                break
        size = dst.stat().st_size
        largest = max(largest, size)
        print(f"{dst}  q{q}  {size / 1024:.1f} KiB")
    print(f"largest: {largest / 1024:.1f} KiB")


def sheet():
    icons = sorted(DST.glob("*.webp"))
    cols, pad, label_h = 4, 12, 22
    cell_w = 2 * (128 + 64 + 3 * pad)
    cell_h = 128 + 2 * pad + label_h
    rows = (len(icons) + cols - 1) // cols
    out = Image.new("RGB", (cols * cell_w, rows * cell_h), (60, 55, 60))
    draw = ImageDraw.Draw(out)
    font = ImageFont.load_default(size=16)
    for i, path in enumerate(icons):
        x0, y0 = (i % cols) * cell_w, (i // cols) * cell_h
        icon = Image.open(path).convert("RGBA")
        for j, bg in enumerate((DARK, PARCHMENT)):
            bx = x0 + j * (cell_w // 2)
            draw.rectangle((bx, y0, bx + cell_w // 2 - 1, y0 + cell_h - 1), fill=bg)
            x = bx + pad
            for s in (128, 64):
                small = icon.resize((s, s), Image.LANCZOS)
                out.paste(small, (x, y0 + pad + (128 - s) // 2), small)
                x += s + pad
        draw.text((x0 + pad, y0 + 128 + pad + 2), path.stem, fill=PARCHMENT, font=font)
    SHEET.parent.mkdir(parents=True, exist_ok=True)
    out.save(SHEET, optimize=True)
    print(f"{SHEET}  {out.width}x{out.height}  {len(icons)} icons")


def app_icon():
    """The PWA / home-screen icon set, same names and sizes as web/scripts/make-icons.mjs wrote."""
    apple = Image.open(SRC / f"{APP_ID}_cut.png").convert("RGBA")
    apple = apple.crop(apple.getchannel("A").getbbox())

    def compose(size, fill):
        # Terracotta ground with a soft lighter centre, the painted apple at `fill` of the side.
        ground = Image.new("RGB", (size, size), TERRACOTTA)
        glow = Image.new("L", (size, size), 0)
        r = size * 0.42
        ImageDraw.Draw(glow).ellipse((size / 2 - r, size / 2 - r, size / 2 + r, size / 2 + r), fill=70)
        glow = glow.filter(ImageFilter.GaussianBlur(size * 0.12))
        ground = Image.composite(Image.new("RGB", (size, size), (222, 142, 92)), ground, glow)
        a = apple.copy()
        a.thumbnail((round(size * fill), round(size * fill)), Image.LANCZOS)
        ground.paste(a, ((size - a.width) // 2, (size - a.height) // 2), a)
        return ground

    APP_DST.mkdir(parents=True, exist_ok=True)
    # iOS and Android round the corners themselves; 0.74 keeps the apple clear of them.
    for name, size, fill in (("icon-192.png", 192, 0.74), ("icon-512.png", 512, 0.74),
                             ("apple-touch-icon.png", 180, 0.74),
                             # maskable: the apple stays inside the 80 % safe circle
                             ("icon-maskable-512.png", 512, 0.56)):
        dst = APP_DST / name
        compose(size, fill).save(dst, optimize=True)
        print(f"{dst}  {size}x{size}  {dst.stat().st_size / 1024:.1f} KiB")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("what", choices=["webp", "sheet", "app", "all"])
    a = ap.parse_args()
    if a.what in ("webp", "all"):
        webp()
    if a.what in ("sheet", "all"):
        sheet()
    if a.what in ("app", "all"):
        app_icon()


if __name__ == "__main__":
    main()
