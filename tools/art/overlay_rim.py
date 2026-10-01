"""tools/art/overlay_rim.py IN OUT CX CY RX RY [INNER]: complete a round brooch whose edge the inpainting mask cut
flat: pixels inside the ellipse (stage px) with alpha < 200 are painted, inside INNER of the radius (default 0.7)
poppy red (the brooch's centre), then polished silver, the outer 1.6 px dark ink. Pass INNER 0 for a plain
silver rim. The overlay's pixels then differ from the result: build the raw as the result with the overlay's
pixels pasted in before overlay_raw.py save."""
import sys

import numpy as np
from PIL import Image

inp, out = sys.argv[1:3]
cx, cy, rx, ry = map(float, sys.argv[3:7])
inner = float(sys.argv[7]) if len(sys.argv) > 7 else 0.7
im = np.asarray(Image.open(inp).convert("RGBA")).copy()
yy, xx = np.mgrid[0:im.shape[0], 0:im.shape[1]]
r = np.sqrt(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2)
fill = (r <= 1) & (im[..., 3] < 200)
ink = r > 1 - 1.6 / min(rx, ry)
red = r < inner
im[fill & red] = [222, 52, 34, 255]
im[fill & ~red & ~ink] = [196, 198, 204, 255]
im[fill & ink] = [40, 34, 38, 255]
Image.fromarray(im).save(out)
print(out, int(fill.sum()), "px painted")
