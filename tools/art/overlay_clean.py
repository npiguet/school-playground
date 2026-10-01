"""tools/art/overlay_clean.py OVERLAY OUT (seg venv: needs scipy) [--poly "x,y x,y ..."]... [--circle x,y,r]... [--keep-poly ...] [--drop-hue green|bronze]
[--min-part N]
Hand clean-up of an extracted overlay: erase polygons / circles (stage px), optionally clip to keep-polygons,
drop pixels of a skin hue, drop specks smaller than N px, then re-soften the edge (erode 1 + 0.8 blur like
overlay.py) so a cut never leaves a hard rim."""
import argparse

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

ap = argparse.ArgumentParser()
ap.add_argument("overlay"); ap.add_argument("out")
ap.add_argument("--poly", action="append", default=[])
ap.add_argument("--keep-poly", action="append", default=[])
ap.add_argument("--circle", action="append", default=[])
ap.add_argument("--drop-hue", choices=["green", "bronze"])
ap.add_argument("--min-part", type=int, default=40)
a = ap.parse_args()

im = Image.open(a.overlay).convert("RGBA")
arr = np.asarray(im).copy()
alpha = arr[..., 3].astype(np.float64)
obj = alpha > 0
er = Image.new("L", im.size, 0)
d = ImageDraw.Draw(er)
for p in a.poly:
    d.polygon([tuple(int(v) for v in q.split(",")) for q in p.split()], fill=255)
for c in a.circle:
    x, y, r = (int(v) for v in c.split(","))
    d.ellipse([x - r, y - r, x + r, y + r], fill=255)
obj &= np.asarray(er) == 0
if a.keep_poly:
    kp = Image.new("L", im.size, 0)
    dk = ImageDraw.Draw(kp)
    for p in a.keep_poly:
        dk.polygon([tuple(int(v) for v in q.split(",")) for q in p.split()], fill=255)
    obj &= np.asarray(kp) > 0
rgb = arr[..., :3].astype(int)
r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
if a.drop_hue == "green":
    obj &= ~((g > r + 8) & (g > b + 25))
elif a.drop_hue == "bronze":
    obj &= ~((r > g) & (g > b + 30) & (r - b > 60) & (r < 200))
obj = ndimage.binary_opening(obj, iterations=1)
lab, n = ndimage.label(obj)
if n:
    sizes = ndimage.sum(obj, lab, range(1, n + 1))
    for i, s in enumerate(sizes, 1):
        if s < a.min_part:
            obj[lab == i] = False
removed = (alpha > 0) & ~obj
cut = ndimage.binary_dilation(removed, iterations=2)
core = ndimage.binary_erosion(obj, iterations=1)
soft = np.asarray(Image.fromarray((core * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))).astype(np.float64)
new_a = np.where(obj, alpha, 0)
new_a = np.where(cut & obj, np.minimum(new_a, soft), new_a)
arr[..., 3] = new_a.round().astype(np.uint8)
arr[arr[..., 3] == 0, :3] = 0
Image.fromarray(arr, "RGBA").save(a.out)
print(a.out, int((arr[..., 3] > 0).sum()), "px")
