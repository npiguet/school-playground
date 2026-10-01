"""tools/art/extmask.py STAGE SLOT DY OUT: the slot mask united with itself shifted down DY px (room for hanging bells)."""
import sys

import numpy as np
from PIL import Image

stage, slot, dy, out = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
m = np.asarray(Image.open(f"assets/art/dragon/slots/{stage}_{slot}.png").convert("L")) > 127
u = m.copy()
for k in range(1, dy + 1):
    u[k:] |= m[:-k]
Image.fromarray((u * 255).astype(np.uint8)).save(out)
print(out, int(m.sum()), "->", int(u.sum()))
