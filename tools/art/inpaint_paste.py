"""composite.py ORIG RESULT SEGMASK INPAINTMASK OUT [grow]
Paste only the segmented object from an inpaint result onto the untouched original: alpha = the
segmentation mask grown by `grow` px and feathered 1.5 px, clipped to the inpaint mask. Prints the
diff inside/outside the inpaint mask so pixel identity outside can be verified."""
import sys
import numpy as np
from PIL import Image, ImageFilter

orig_p, res_p, seg_p, inp_p, out_p = sys.argv[1:6]
grow = int(sys.argv[6]) if len(sys.argv) > 6 else 2
orig = Image.open(orig_p).convert("RGB")
res = Image.open(res_p).convert("RGB")
seg = Image.open(seg_p).convert("L").point(lambda v: 255 if v > 127 else 0)
if grow:
    seg = seg.filter(ImageFilter.MaxFilter(2 * grow + 1))
alpha = np.asarray(seg.filter(ImageFilter.GaussianBlur(1.5))).astype(float) / 255
inp = np.asarray(Image.open(inp_p).convert("L")) > 127
alpha *= inp
o = np.asarray(orig).astype(float)
r = np.asarray(res).astype(float)
out = (o * (1 - alpha[..., None]) + r * alpha[..., None]).round().clip(0, 255).astype(np.uint8)
Image.fromarray(out).save(out_p)
d = np.abs(out.astype(int) - o.astype(int)).sum(2)
print(f"changed px {(d > 0).sum()}, outside the inpaint mask: {(d[~inp] > 0).sum()} px, max {d[~inp].max()}")
ys, xs = np.nonzero(d > 0)
W, H = orig.size
print(f"changed bbox px x {xs.min()}-{xs.max()} y {ys.min()}-{ys.max()}; fractions x {xs.min()/W:.3f}-{(xs.max()+1)/W:.3f} y {ys.min()/H:.3f}-{(ys.max()+1)/H:.3f}")
