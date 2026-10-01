"""tools/art/overlay_whitefringe.py (seg venv) IN OUT X0 Y0 X1 Y1 [--min 200] [--px 2] [--sat N]: inside the box, make transparent the
near-white pixels (min channel > --min) that lie within --px of the overlay's transparent outside (white ground left
around parts that stand in the air), then re-soften that edge. Peels up to 3 times, so a rim 3 x --px deep goes.

Items with white parts of their own (white-tipped feathers, pearls): peel only the outer rim, gently, and only
neutral white: `--px 1 --sat 45` (a pixel also needs max - min channel < 45, so tinted highlights stay). Never run it
over a whole white-tipped item with the default --px 2 if the tips touch the outline: it eats them. Sirènes plumes
(2026-10-01) used `--px 1 --sat 45` on a box around the plume only."""
import argparse
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ap = argparse.ArgumentParser()
ap.add_argument('inp'); ap.add_argument('out'); ap.add_argument('box', type=int, nargs=4)
ap.add_argument('--min', type=int, default=200); ap.add_argument('--px', type=int, default=2)
ap.add_argument('--sat', type=int, default=None, help='also require max-min channel spread < SAT (neutral white only)')
a = ap.parse_args()
im = np.asarray(Image.open(a.inp).convert('RGBA')).copy()
obj = im[..., 3] > 0
x0, y0, x1, y1 = a.box
inbox = np.zeros_like(obj); inbox[y0:y1, x0:x1] = True
white = im[..., :3].min(2) > a.min
if a.sat is not None:
    rgb = im[..., :3].astype(int)
    white &= (rgb.max(2) - rgb.min(2)) < a.sat
total = 0
for _ in range(3):  # peel: a white rim several px deep goes in steps
    near = ndimage.binary_dilation(~obj, iterations=a.px)
    drop = obj & inbox & near & white
    if not drop.any():
        break
    total += int(drop.sum())
    obj = obj & ~drop
er = ndimage.binary_erosion(obj, iterations=1)
soft = np.asarray(Image.fromarray((er * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))).astype(float)
alpha = im[..., 3].astype(float)
zone = inbox & ndimage.binary_dilation(~obj, iterations=3)
alpha = np.where(zone, np.minimum(alpha, soft), alpha)
alpha[~obj] = 0
im[..., 3] = alpha.round().astype(np.uint8)
Image.fromarray(im).save(a.out)
print('dropped', total, 'white rim px')
