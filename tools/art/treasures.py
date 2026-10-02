"""Export the twelve room treasures (spec 2026-10-02 house treasures) and build their contact sheet.

    python tools/art/treasures.py webp    # assets/art/treasures/<id>_cut.png -> assets/art/export/treasures/<id>.webp
    python tools/art/treasures.py sheet   # docs/art/treasures-sheet.png
    python tools/art/treasures.py all

WebP: trimmed to the solid object (the icons' opening filter drops stray matting specks) with 4 px of
air, so the piece's base is its image's bottom edge (the room's `y`); the long side downscaled to
768 px for the big pieces (672 px for the mosaic, whose fine tiles reach the 90 KiB budget only at q50
at 768 px), 512 px for the others; alpha kept. Quality starts at 82 and steps
down by 4 until the file is under its budget, floor 50: a piece still over budget at q50 is an
error (exit 1), never kept silently. Each line printed gives the size and the aspect (height / width).

Contact sheet: the twelve pieces at one common scale (REAL_CM, the width of each piece in
centimetres) beside a bronze trophy for reference, on the dark UI colour, a mid grey and parchment.

Runs on the host (Pillow) or in the art container (tools/art/run_docker.sh has Pillow too).
"""
import argparse
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

from icons import DARK, PARCHMENT, save_webp

SRC = Path("assets/art/treasures")
# Staged export: the code task that wires the treasures moves them into web/public/art/treasures/.
DST = Path("assets/art/export/treasures")
SHEET = Path("docs/art/treasures-sheet.png")
TROPHY = Path("web/public/art/trophies/large/trophy-hydre-2.webp")
TROPHY_CM = 22          # a trophy statuette's height in centimetres, base included
TROPHY_FILL = 0.87      # its share of the 512 px box (6.5 % transparent margin above and below)
MID = (118, 110, 104)
BIG = (768, 90 * 1024)
SMALL = (512, 50 * 1024)
MOSAIC = (672, 90 * 1024)   # its tiles are all fine detail: 90.5 KiB at q50 at 768 px, about q62 at 672
QUALITIES = list(range(82, 49, -4)) + [50]   # 82, 78, ..., 54, 50
# id -> ((long side px, budget bytes), real width in cm for the contact sheet's common scale).
PIECES = {
    "decor-lanterne": (SMALL, 22),
    "decor-tapis": (BIG, 220),
    "decor-bibliotheque": (BIG, 110),
    "decor-trophee": (SMALL, 30),
    "decor-fresque": (BIG, 160),
    "decor-amphore": (SMALL, 40),
    "decor-chouette": (SMALL, 25),
    "decor-mosaique": (MOSAIC, 100),
    "decor-bouclier": (SMALL, 80),
    "sandales_hermes": (SMALL, 28),
    "egide": (SMALL, 80),
    "foudre_zeus": (SMALL, 25),
}
# REAL_CM is only the contact sheet's scale (one centimetre = the same number of pixels for every
# piece, so their relative sizes can be judged). The game never reads it: each piece is sized to its
# place in each room, measured in house treasures Task 5 into web/src/lib/world/scenes/treasure-places.json
# (that measurement starts from these widths as a first guess and caps each to its painted fixture,
# so a room's place, not this table, is the piece's size).
REAL_CM = {k: cm for k, (_, cm) in PIECES.items()}


def trim(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    solid = img.getchannel("A").point(lambda a: 255 if a > 128 else 0).filter(ImageFilter.MinFilter(9)).filter(ImageFilter.MaxFilter(9))
    l, t, r, b = solid.getbbox() or (0, 0, *img.size)
    pad = 4
    return img.crop((max(l - pad, 0), max(t - pad, 0), min(r + pad, img.width), min(b + pad, img.height)))


def webp() -> bool:
    DST.mkdir(parents=True, exist_ok=True)
    total, over = 0, []
    for pid, ((long_px, budget), _) in PIECES.items():
        img = trim(Image.open(SRC / f"{pid}_cut.png"))
        scale = long_px / max(img.size)
        if scale < 1:
            img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
        dst = DST / f"{pid}.webp"
        q, size, ok = save_webp(img, dst, budget, QUALITIES)
        total += size
        flag = ""
        if not ok:
            over.append(pid)
            flag = f"  OVER BUDGET ({budget / 1024:.0f} KiB) at q{q}: removed"
        print(f"{dst}  {img.width}x{img.height}  aspect {img.height / img.width:.4f}  q{q}  {size / 1024:.1f} KiB{flag}")
    print(f"total: {total / 1024:.1f} KiB")
    if over:
        print(f"error: over budget at the q{QUALITIES[-1]} floor: {', '.join(over)}", file=sys.stderr)
        return False
    return True


def sheet(px_per_cm: float = 2.4):
    pad, label_h = 16, 22
    font = ImageFont.load_default(size=16)
    items = []
    for pid, cm in REAL_CM.items():
        img = Image.open(DST / f"{pid}.webp").convert("RGBA")
        w = round(cm * px_per_cm)
        items.append((pid, img.resize((w, round(w * img.height / img.width)), Image.LANCZOS)))
    trophy = Image.open(TROPHY).convert("RGBA")
    side = round(TROPHY_CM * px_per_cm / TROPHY_FILL)
    items.append(("trophy (scale)", trophy.resize((side, side), Image.LANCZOS)))
    width = 2400

    def col(pid, img):   # a column is as wide as its piece or its label, whichever is wider
        return max(img.width, round(font.getlength(pid)))

    rows, row, x = [], [], pad
    for it in items:
        if row and x + col(*it) + pad > width:
            rows.append(row)
            row, x = [], pad
        row.append(it)
        x += col(*it) + pad
    rows.append(row)
    band_h = sum(max(i.height for _, i in r) + label_h + 2 * pad for r in rows)
    out = Image.new("RGB", (width, 3 * band_h), DARK)
    draw = ImageDraw.Draw(out)
    y = 0
    for bg, fg in ((DARK, PARCHMENT), (MID, PARCHMENT), (PARCHMENT, DARK)):
        draw.rectangle((0, y, width - 1, y + band_h - 1), fill=bg)
        for r in rows:
            h = max(i.height for _, i in r)
            x = pad
            for pid, img in r:
                c = col(pid, img)
                out.paste(img, (x + (c - img.width) // 2, y + pad + h - img.height), img)   # bottoms aligned: one floor line
                draw.text((x, y + pad + h + 4), pid, fill=fg, font=font)
                x += c + pad
            y += h + label_h + 2 * pad
    SHEET.parent.mkdir(parents=True, exist_ok=True)
    out.save(SHEET, optimize=True)
    print(f"{SHEET}  {out.width}x{out.height}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("what", choices=["webp", "sheet", "all"])
    a = ap.parse_args()
    if a.what in ("webp", "all") and not webp():
        sys.exit(1)
    if a.what in ("sheet", "all"):
        sheet()


if __name__ == "__main__":
    main()
