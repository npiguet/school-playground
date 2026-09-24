"""Renders the OCR fixture handouts (printed-looking text, DejaVu Serif). Usage: scripts/py.sh python -m app.tools.make_scan_fixture /work/server/tests/fixtures/scan"""
from __future__ import annotations
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"
TITLE = "Dictée préparée — Les fées de la clairière"
LINES = [
    "Les fées dansent dans la clairière. Elles chantent et les oiseaux",
    "les écoutent. Le vent emporte leurs chansons jusqu'au vil-",
    "lage endormi.",
    "",
    "Les enfants du village sortent de leurs maisons. Ils écoutent,",
    "émerveillés, la musique qui descend de la forêt.",
]


def render() -> Image.Image:
    img = Image.new("RGB", (1600, 1100), "white")
    d = ImageDraw.Draw(img)
    d.text((100, 80), TITLE, font=ImageFont.truetype(FONT, 40), fill="black")
    y = 200
    body = ImageFont.truetype(FONT, 34)
    for line in LINES:
        if line:
            d.text((100, y), line, font=body, fill="black")
        y += 58
    d.text((780, 1000), "3", font=body, fill="black")     # page number: must be dropped by assemble()
    return img


def main(out: str) -> int:
    out_dir = Path(out)
    out_dir.mkdir(parents=True, exist_ok=True)
    img = render()
    img.save(out_dir / "handout.png")
    rotated = img.rotate(90, expand=True)                # stored sideways; EXIF orientation 6 = "rotate 90° CW to view"
    exif = Image.Exif()
    exif[0x0112] = 6
    rotated.save(out_dir / "handout-rotated.jpg", "JPEG", quality=90, exif=exif.tobytes())
    print("wrote", sorted(p.name for p in out_dir.iterdir()))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
