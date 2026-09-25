"""Export the overlay art (immersion wave, Ruling W3) to web/public/art.

    python tools/art/uiart.py webp    # assets/art/... -> web/public/art/... (TABLE below)
    python tools/art/uiart.py sheet   # docs/art/ui-art-sheet.png: each file on parchment and dark wood

A `tile` entry is made seamless first: shifted by half its size so the old
edges meet in the middle, then the original is blended back over a feathered
cross, which hides the seam without a visible mirror. Quality starts at 82 and
steps down until the file is under its budget (floor 50); a file that still
does not fit fails loudly instead of shipping over budget.

Runs inside the throwaway Docker container (tools/art/run_docker.sh uiart).
Requires: pillow
"""
import argparse
import io
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

WEB = Path("web/public/art")
# source -> (published path, long side in px, budget in KB, tile)
TABLE = {
    "assets/art/textures/parchment.png": ("textures/parchment.webp", 512, 90, True),
    "assets/art/textures/wood_board.png": ("textures/wood_board.webp", 1280, 150, False),
    "assets/art/ui/scroll_rolled_cut.png": ("ui/scroll_rolled.webp", 640, 45, False),
}


def seamless(img: Image.Image) -> Image.Image:
    w, h = img.size
    hw, hh = w // 2, h // 2
    shifted = Image.new(img.mode, (w, h))
    shifted.paste(img.crop((hw, hh, w, h)), (0, 0))
    shifted.paste(img.crop((0, hh, hw, h)), (w - hw, 0))
    shifted.paste(img.crop((hw, 0, w, hh)), (0, h - hh))
    shifted.paste(img.crop((0, 0, hw, hh)), (w - hw, h - hh))
    # `shifted` tiles seamlessly but has a seam cross in its middle; cover that cross with the
    # original (whose middle is seamless), feathered so no edge shows.
    mask = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(mask)
    band = max(8, w // 10)
    d.rectangle((hw - band, 0, hw + band, h), fill=255)
    d.rectangle((0, hh - band, w, hh + band), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(band / 2))
    return Image.composite(img, shifted, mask)


def export(src: Path, dst: Path, max_px: int, max_kb: int, tile: bool) -> None:
    img = Image.open(src)
    img = img.convert("RGBA" if "A" in img.getbands() else "RGB")
    if tile:
        img = seamless(img)
    scale = max_px / max(img.size)
    if scale < 1:
        img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    for q in range(82, 49, -4):
        buf = io.BytesIO()
        img.save(buf, "WEBP", quality=q, method=6)
        if buf.tell() <= max_kb * 1024:
            dst.write_bytes(buf.getvalue())
            print(f"{dst}  {img.width}x{img.height}  q{q}  {buf.tell() / 1024:.0f} KiB")
            return
    raise SystemExit(f"{dst}: over {max_kb} KB even at quality 50")


def sheet() -> None:
    rows = []
    for _, (rel, _px, _kb, tile) in TABLE.items():
        p = WEB / rel
        if not p.exists():
            continue
        img = Image.open(p).convert("RGBA")
        if tile:  # a 2x2 repeat shows any seam
            rep = Image.new("RGBA", (img.width * 2, img.height * 2))
            for x in (0, img.width):
                for y in (0, img.height):
                    rep.paste(img, (x, y))
            img = rep
        rows.append(img)
    out = Image.new("RGB", (1100, 340 * max(1, len(rows))), (243, 230, 200))
    for i, img in enumerate(rows):
        img.thumbnail((500, 320))
        for x, ground in ((10, (243, 230, 200)), (560, (59, 39, 21))):
            cell = Image.new("RGB", (520, 330), ground)
            cell.paste(img, (10, 5), img)
            out.paste(cell, (x, 340 * i + 5))
    out.save("docs/art/ui-art-sheet.png")
    print("docs/art/ui-art-sheet.png")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("mode", choices=["webp", "sheet"])
    a = ap.parse_args()
    if a.mode == "webp":
        for src, (rel, px, kb, tile) in TABLE.items():
            if Path(src).exists():
                export(Path(src), WEB / rel, px, kb, tile)
            else:
                print(f"skip {src} (not generated)")
    else:
        sheet()
