"""tools/art/overlay_dropcool.py (seg venv) IN OUT X0 Y0 X1 Y1 [--margin 0]: inside the box, drop overlay pixels whose red is not the
strongest channel (by --margin) and that are not bright (min channel <= 170): repainted green/teal/blue skin
or grey ground seen between red coral branches; --ink N keeps dark ink pixels (max channel < N).
Drops specks < 30 px and re-softens the cut edge. Only for a red item (coral)."""
import argparse
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ap = argparse.ArgumentParser()
ap.add_argument('inp'); ap.add_argument('out'); ap.add_argument('box', type=int, nargs=4)
ap.add_argument('--margin', type=int, default=0)
ap.add_argument('--ink', type=int, default=0, help='keep dark ink pixels (max channel below this)')
a = ap.parse_args()
im = np.asarray(Image.open(a.inp).convert('RGBA')).copy()
rgb = im[..., :3].astype(int)
r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
obj = im[..., 3] > 0
x0, y0, x1, y1 = a.box
inbox = np.zeros_like(obj); inbox[y0:y1, x0:x1] = True
cool = obj & inbox & (r <= np.maximum(g, b) + a.margin) & (rgb.min(2) <= 170) & (rgb.max(2) >= a.ink)
cool = ndimage.binary_opening(cool, iterations=1)
cool = ndimage.binary_dilation(cool, iterations=1) & inbox & obj
keep = obj & ~cool
lab, n = ndimage.label(keep)
if n:
    sizes = ndimage.sum(keep, lab, range(1, n + 1))
    for i, s in enumerate(sizes, 1):
        if s < 30:
            keep[lab == i] = False
er = ndimage.binary_erosion(keep, iterations=1)
soft = np.asarray(Image.fromarray((er * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))).astype(float)
alpha = im[..., 3].astype(float)
zone = ndimage.binary_dilation(obj & ~keep, iterations=3)
alpha = np.where(zone, np.minimum(alpha, soft), alpha)
alpha[~keep] = 0
im[..., 3] = alpha.round().astype(np.uint8)
Image.fromarray(im).save(a.out)
print('dropped', int((obj & ~keep).sum()), 'px')
