"""Contact sheet of the dragon's six stages (egg to ancestral) on dark, mid and parchment grounds.

    python tools/art/stages_sheet.py [--out docs/art/progression-stages.png]

Reads assets/art/dragon/dragon_<stage>_cut.png. Needs Pillow only (host Python or the seg venv).
"""
import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

STAGES = ["egg", "hatchling", "young", "adult", "illustre", "ancestral"]
GROUNDS = [(27, 20, 33), (120, 112, 104), (236, 223, 193)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="docs/art/progression-stages.png")
    ap.add_argument("--cell", type=int, default=320)
    a = ap.parse_args()
    cell, label = a.cell, 28
    font = ImageFont.load_default(size=20)
    sheet = Image.new("RGB", (cell * len(STAGES), label + cell * len(GROUNDS)), GROUNDS[0])
    d = ImageDraw.Draw(sheet)
    for c, stage in enumerate(STAGES):
        cut = Image.open(Path(f"assets/art/dragon/dragon_{stage}_cut.png")).convert("RGBA")
        cut = cut.resize((cell, cell), Image.LANCZOS)
        d.text((c * cell + 10, 4), stage, fill=(236, 223, 193), font=font)
        for r, g in enumerate(GROUNDS):
            tile = Image.new("RGBA", (cell, cell), g + (255,))
            tile.alpha_composite(cut)
            sheet.paste(tile.convert("RGB"), (c * cell, label + r * cell))
    sheet.save(a.out, optimize=True)
    print(a.out)


if __name__ == "__main__":
    main()
