"""Export the 30 lieutenant trophies to the web and build their contact sheet.

    python tools/art/trophies.py webp    # assets/art/trophies/trophy-<lt>-<L>_cut.png ->
                                         #   assets/art/export/trophies/trophy-<lt>-<L>.webp (256 px)
                                         #   assets/art/export/trophies/large/trophy-<lt>-<L>.webp (512 px)
    python tools/art/trophies.py sheet   # docs/art/trophies-sheet.png
    python tools/art/trophies.py all

Same treatment as the icons (tools/art/icons.py): trimmed to the object, padded to a square with a
6 % margin, downscaled with alpha. The 256 px copies start at quality 80 and step down until under
25 KB; the 512 px close-up copies start at 82 and step down until under 60 KB (floor 50).

Contact sheet: one row per lieutenant, one column per level, each trophy at 128 and 64 px, on the
dark UI colour, a mid grey and parchment.

Runs on the host (Pillow) or in the art container (tools/art/run_docker.sh has Pillow too).
"""
import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from icons import DARK, PARCHMENT, square

SRC = Path("assets/art/trophies")
# Staged export: the code task that wires the trophies moves them into web/public/art/trophies/
# (the web tests fail on art files there that the code does not reference yet).
DST = Path("assets/art/export/trophies")
SHEET = Path("docs/art/trophies-sheet.png")
LIEUTENANTS = ["hydre", "echo", "chimere", "protee", "sirenes", "lethe"]
LEVELS = [1, 2, 3, 4, 5]
MID = (118, 110, 104)
SIZES = ((DST, 256, 80, 25 * 1024), (DST / "large", 512, 82, 60 * 1024))


def src(lt, level):
    return SRC / f"trophy-{lt}-{level}_cut.png"


def webp():
    for lt in LIEUTENANTS:
        for level in LEVELS:
            sq = square(Image.open(src(lt, level)))
            for folder, size, q0, budget in SIZES:
                folder.mkdir(parents=True, exist_ok=True)
                img = sq.resize((size, size), Image.LANCZOS)
                dst = folder / f"trophy-{lt}-{level}.webp"
                for q in range(q0, 45, -5):
                    img.save(dst, "WEBP", quality=q, method=6)
                    if dst.stat().st_size <= budget:
                        break
                print(f"{dst}  q{q}  {dst.stat().st_size / 1024:.1f} KiB")
    total = sum(p.stat().st_size for p in DST.rglob("*.webp"))
    print(f"total: {total / 1024:.1f} KiB")


def sheet():
    pad, label_w = 10, 90
    cell = 128 + 64 + 3 * pad
    band_w = label_w + len(LEVELS) * cell
    rows_h = 128 + 2 * pad
    out = Image.new("RGB", (band_w, 3 * len(LIEUTENANTS) * rows_h), DARK)
    draw = ImageDraw.Draw(out)
    font = ImageFont.load_default(size=16)
    y = 0
    for bg, fg in ((DARK, PARCHMENT), (MID, PARCHMENT), (PARCHMENT, DARK)):
        for lt in LIEUTENANTS:
            draw.rectangle((0, y, band_w - 1, y + rows_h - 1), fill=bg)
            draw.text((pad, y + rows_h // 2 - 8), lt, fill=fg, font=font)
            for i, level in enumerate(LEVELS):
                icon = Image.open(DST / f"trophy-{lt}-{level}.webp").convert("RGBA")
                x = label_w + i * cell + pad
                for s in (128, 64):
                    small = icon.resize((s, s), Image.LANCZOS)
                    out.paste(small, (x, y + pad + (128 - s) // 2), small)
                    x += s + pad
            y += rows_h
    SHEET.parent.mkdir(parents=True, exist_ok=True)
    out.save(SHEET, optimize=True)
    print(f"{SHEET}  {out.width}x{out.height}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("what", choices=["webp", "sheet", "all"])
    a = ap.parse_args()
    if a.what in ("webp", "all"):
        webp()
    if a.what in ("sheet", "all"):
        sheet()


if __name__ == "__main__":
    main()
