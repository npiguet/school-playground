"""Make web-optimized WebP copies of the art assets.

Walks assets/art (skipping assets/art/web), and for every PNG writes
assets/art/web/<same relative path>.webp, downscaled so the long side is at
most --max-px (default 1024), quality --quality (default 82). Alpha is kept
for the *_cut.png sprites. Prints the total size of the web folder at the end.

Runs inside a throwaway Docker container (see tools/art/run_docker.sh).
Requires: pip install pillow
"""
import argparse
from pathlib import Path

from PIL import Image


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--src", type=Path, default=Path("assets/art"))
    ap.add_argument("--dst", type=Path, default=Path("assets/art/web"))
    ap.add_argument("--max-px", type=int, default=1024)
    ap.add_argument("--quality", type=int, default=82)
    a = ap.parse_args()

    total = 0
    for src in sorted(a.src.rglob("*.png")):
        if a.dst in src.parents:
            continue
        rel = src.relative_to(a.src).with_suffix(".webp")
        dst = a.dst / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        img = Image.open(src)
        img = img.convert("RGBA" if "A" in img.getbands() else "RGB")
        scale = a.max_px / max(img.size)
        if scale < 1:
            img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
        img.save(dst, "WEBP", quality=a.quality, method=6)
        size = dst.stat().st_size
        total += size
        print(f"{dst}  {img.width}x{img.height}  {size / 1024:.0f} KiB")
    print(f"total: {total / 1024:.0f} KiB ({total / 1024 / 1024:.2f} MiB)")


if __name__ == "__main__":
    main()
