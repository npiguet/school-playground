"""Clear small enclosed white holes that background removal kept opaque in a cut-out.

    python tools/art/clear_holes.py assets/art/characters/hermes_cut.png [--max-area 2000] [--box X0 Y0 X1 Y1] [--dry-run]

BiRefNet + matting removes the white background around a figure but can keep a small white gap that
is enclosed by the figure (e.g. between a hand, a staff and a coiled snake). This finds connected
regions of near-white, low-saturation, opaque pixels (min channel >= 225, max-min <= 18) with an
area of at most --max-area px, and makes them transparent, with alpha scaled by how white each pixel
is so the 1-2 px anti-aliased edge stays soft. Large white areas (a white chiton, wings) are never
touched because they exceed --max-area; check the printed boxes and use --dry-run first.
On pale or silver subjects (a marble owl, a silver coin) small white highlights look exactly like
holes (the dry run lists dozens): restrict it with --box x0 y0 x1 y1 to the hole you saw, or skip it.
Requires: pillow, numpy, scipy (host Python has them; so does the art container).
"""
import argparse
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("image", type=Path)
    ap.add_argument("--max-area", type=int, default=2000)
    ap.add_argument("--min-area", type=int, default=20)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--box", type=int, nargs=4, metavar=("X0", "Y0", "X1", "Y1"),
                    help="only look for holes inside this box (px)")
    a = ap.parse_args()
    img = np.asarray(Image.open(a.image).convert("RGBA")).copy()
    rgb = img[..., :3].astype(int)
    lo, hi = rgb.min(2), rgb.max(2)
    white = (lo >= 225) & (hi - lo <= 18) & (img[..., 3] > 200)
    if a.box:
        x0, y0, x1, y1 = a.box
        inside = np.zeros_like(white)
        inside[y0:y1, x0:x1] = True
        white &= inside
    labels, n = ndimage.label(white)
    cleared = 0
    for i, sl in enumerate(ndimage.find_objects(labels), start=1):
        region = labels[sl] == i
        area = int(region.sum())
        if not a.min_area <= area <= a.max_area:
            continue
        ys, xs = sl
        print(f"hole {area} px at x {xs.start}-{xs.stop} y {ys.start}-{ys.stop}")
        # grow by 3 px to take in the anti-aliased rim, scaling alpha by whiteness there
        grown = ndimage.binary_dilation(labels == i, iterations=3)
        whiteness = np.clip((lo - 110) / 90.0, 0, 1)
        alpha = img[..., 3].astype(float)
        alpha[grown] = alpha[grown] * (1 - whiteness[grown])
        img[..., 3] = alpha.round().astype(np.uint8)
        cleared += 1
    print(f"{cleared} hole(s) cleared")
    if cleared and not a.dry_run:
        Image.fromarray(img).save(a.image)


if __name__ == "__main__":
    main()
