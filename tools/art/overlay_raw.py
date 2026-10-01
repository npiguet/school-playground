"""Keep the generated picture and the item mask next to an accessory overlay, so the mask can be repainted
by hand and the overlay rebuilt (the art-overlays skill).

  save     OVERLAY.png RESULT.png INPAINT_MASK.png
           Writes <overlay>_raw.png (RESULT, the inpainted stage picture, cropped) and <overlay>_mask.png (the
           overlay's alpha, white = item, same crop). The crop is the inpainting mask's box united with the
           item's box, padded 24 px, so every pixel the model painted is kept. Checks that every item pixel of
           the overlay equals RESULT (refuses a wrong RESULT) and records the crop in the overlay's sidecar
           <overlay>.json as "raw_crop": [x0, y0, x1, y1] (stage px).
  rebuild  OVERLAY.png [--size 1024x1024]
           After the mask was repainted: the overlay again = <overlay>_raw.png with <overlay>_mask.png as
           alpha, pasted at raw_crop's (x0, y0) on a transparent picture the stage's size.

Pillow + numpy only (host python or the seg venv).
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image


def stem(p: Path) -> Path:
    return p.with_suffix("")


def save(overlay, result, inpaint_mask, pad=24):
    ov_p = Path(overlay)
    ov = np.asarray(Image.open(ov_p).convert("RGBA"))
    raw = np.asarray(Image.open(result).convert("RGB"))
    item = ov[..., 3] > 0
    if raw.shape[:2] != item.shape or np.abs(raw[item].astype(int) - ov[..., :3][item].astype(int)).max() != 0:
        sys.exit(f"{result} is not the picture {overlay} was extracted from")
    m = np.asarray(Image.open(inpaint_mask).convert("L")) > 127
    ys, xs = np.nonzero(m | item)
    H, W = item.shape
    x0, y0 = max(0, int(xs.min()) - pad), max(0, int(ys.min()) - pad)
    x1, y1 = min(W, int(xs.max()) + pad + 1), min(H, int(ys.max()) + pad + 1)
    s = stem(ov_p)
    Image.fromarray(raw[y0:y1, x0:x1]).save(f"{s}_raw.png", optimize=True)
    Image.fromarray(ov[y0:y1, x0:x1, 3]).save(f"{s}_mask.png", optimize=True)
    sp = ov_p.with_suffix(".json")
    side = json.loads(sp.read_text(encoding="utf-8")) if sp.exists() else {}
    side["raw_crop"] = [x0, y0, x1, y1]
    side["raw_crop_note"] = ("<item>_raw.png = the inpainted result cropped to raw_crop (stage px x0, y0, x1, y1); "
                             "<item>_mask.png = the overlay's alpha over the same crop (white = item). After "
                             "repainting the mask: python tools/art/overlay_raw.py rebuild <item>.png")
    sp.write_text(json.dumps(side, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(s, [x0, y0, x1, y1])


def rebuild(overlay, size):
    ov_p = Path(overlay)
    s = stem(ov_p)
    x0, y0, x1, y1 = json.loads(ov_p.with_suffix(".json").read_text(encoding="utf-8"))["raw_crop"]
    raw = Image.open(f"{s}_raw.png").convert("RGB")
    mask = Image.open(f"{s}_mask.png").convert("L")
    if raw.size != (x1 - x0, y1 - y0) or mask.size != raw.size:
        sys.exit("raw / mask size does not match raw_crop")
    piece = raw.convert("RGBA")
    piece.putalpha(mask)
    arr = np.asarray(piece).copy()
    arr[arr[..., 3] == 0, :3] = 0
    out = Image.new("RGBA", size, (0, 0, 0, 0))
    out.paste(Image.fromarray(arr, "RGBA"), (x0, y0))
    out.save(ov_p)
    print(ov_p, int((np.asarray(out)[..., 3] > 0).sum()), "px")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("save")
    s.add_argument("overlay"); s.add_argument("result"); s.add_argument("inpaint_mask")
    r = sub.add_parser("rebuild")
    r.add_argument("overlay")
    r.add_argument("--size", default="1024x1024")
    a = ap.parse_args()
    if a.cmd == "save":
        save(a.overlay, a.result, a.inpaint_mask)
    else:
        rebuild(a.overlay, tuple(int(v) for v in a.size.split("x")))


if __name__ == "__main__":
    main()
