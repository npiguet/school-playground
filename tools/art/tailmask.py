"""tools/art/tailmask.py STAGE X0 Y0 X1 Y1 DY OUT: a queue inpainting mask limited to the tail inside a box (the
stage cut-out's silhouette inside the box, dilated 6 px), united with itself shifted down DY px (room for a
hanging charm). Use when the stock queue slot's edge crosses the tail: a band painted there ends on the slot's
cut edge, short of the tail's outline (Lethe illustre/ancestral). Run from the repo root."""
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

st, x0, y0, x1, y1, dy, out = sys.argv[1], *map(int, sys.argv[2:7]), sys.argv[7]
sil = np.asarray(Image.open(f"assets/art/dragon/dragon_{st}_cut.png").convert("RGBA"))[..., 3] > 128
r = np.zeros_like(sil)
r[y0:y1, x0:x1] = True
m = ndimage.binary_dilation(sil & r, iterations=6)
u = m.copy()
for k in range(1, dy + 1):
    u[k:] |= m[:-k]
Image.fromarray((u * 255).astype(np.uint8)).save(out)
print(out, int(m.sum()), "->", int(u.sum()))
