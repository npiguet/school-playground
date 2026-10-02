"""Recolour a generated picture onto one metal gradient, before its cut-out.

    python tools/art/colorize.py <src.png> <dst.png>             # golden bronze, blended 0.75
    python tools/art/colorize.py <src.png> <dst.png> --blend 0.6

The painted style's "warm and cool colour variation inside every shape" puts blue, green and red
blotches on large polished metal (krea2 skill, "Silver and polished bronze get multicolour
blotches"). Mapping the luminance onto one warm golden-bronze gradient (white stays white, so the
flat background still cuts out) and blending it over the original removes them and keeps the relief
and the ink outline. Used for the treasures' decor-bouclier (its sidecar's `postprocess`).

Runs on the host (Pillow) or in the art container.
"""
import argparse

from PIL import Image, ImageOps

BRONZE = dict(black=(38, 20, 8), mid=(190, 128, 50), white=(255, 255, 255),
              blackpoint=10, midpoint=130, whitepoint=252)


def colorize(im: Image.Image, blend: float = 0.75) -> Image.Image:
    im = im.convert("RGB")
    mapped = ImageOps.colorize(ImageOps.grayscale(im), **BRONZE)
    return Image.blend(im, mapped, blend)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--blend", type=float, default=0.75, help="share of the gradient over the original (default 0.75)")
    a = ap.parse_args()
    colorize(Image.open(a.src), a.blend).save(a.dst)


if __name__ == "__main__":
    main()
