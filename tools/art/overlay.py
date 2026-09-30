"""Accessory overlays for the dragon stages: extract, check, crop (the art-overlays skill).

Runs in the segmentation venv (tools/art/seg/.venv); `extract` loads SAM 2.1, the other commands
need only Pillow and numpy.

  extract   STAGE.png RESULT.png MASK.png --out item_stage.png [--cpu] [--debug dbg.png]
            RESULT is the inpainted stage (tools/art/img2img.py --mask MASK). The overlay keeps the
            pixels that are (a) inside the slot mask, (b) changed versus STAGE, and (c) part of the
            object SAM 2.1 finds when prompted with the "novel colour" region (colours of RESULT
            found nowhere near the same place in STAGE: the item, not repainted skin). Writes an
            RGBA PNG the size of STAGE (RESULT's colours, alpha 0 elsewhere, edge softened 1 px), so
            it lines up with the stage picture pixel for pixel. --debug writes a sheet of the steps:
            stage, result with SAM's box and points, slot, changed, novel, SAM, object, novelty map.
            Also writes the sidecar <out>.json: the result's generation sidecar (prompt, seed,
            settings), the SAM points, box and mask chosen, the thresholds.
            --max-hole N fills only enclosed holes up to N px (a ring of coils: the tail seen
            between the coils stays out); --cut 'X,Y X,Y ...' (repeatable) subtracts a hand-traced
            polygon (repainted skin SAM keeps taking in).
  merge     OUT.png PART.png [PART2 ...]
            One overlay from several extracts of the same RESULT (an item SAM cannot take in one
            mask: a helmet's dome and its serpent crest, each extracted with its own points and
            --box): per pixel the part with the highest alpha. Sidecar: the parts' sidecars.
  check     STAGE_cut.png OVERLAY.png [OVERLAY2 ...] --out sheet.png
            The overlay composited on the cut-out stage, untinted and under the game's CSS tints
            (web/src/lib/world/dragon.ts TINT_FILTERS applied to the dragon only, overlay unfiltered,
            the CSS filter matrices reproduced exactly), on dark, mid and parchment grounds, plus a
            2x zoom on the overlay's area.
  crop      OVERLAY.png --webp out.webp [--manifest m.json --item ID --stage KEY] [--pixels]
            Crops to the alpha bounding box (+2 px), saves WebP (q88, alpha) and records
            {"src", "x", "y", "w", "h"} in the manifest under item -> stage. x/y/w/h are fractions
            (0-1, 5 decimals) of the overlay's (= the stage picture's) width and height, so the game
            scales them with the dragon (drachmes-shop spec section 4); --pixels records stage px
            instead. Other items and stages already in the manifest are kept.
  sheet     LT --out docs/art/accessories-LT.png
            Contact sheet of a lieutenant's set (assets/art/dragon/accessories/LT-<slot>_<stage>.png):
            a row per stage with each item zoomed on the bronze stage, and a last row with the whole
            set worn on every stage under a tint.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, str(Path(__file__).parent))

# web/src/lib/world/dragon.ts TINT_FILTERS (bronze = none).
TINTS = {
    "ecume": [("hue-rotate", 190), ("saturate", 0.9)],
    "olivier": [("hue-rotate", 70), ("saturate", 0.8)],
    "braise": [("hue-rotate", -25), ("saturate", 1.3)],
    "jade": [("hue-rotate", 120), ("saturate", 0.9)],
    "argent": [("saturate", 0), ("brightness", 1.15)],
}
GROUNDS = {"dark": (27, 20, 33), "mid": (120, 112, 104), "parchment": (236, 223, 193)}


def css_matrix(op, v):
    """The 3x3 colour matrices of the CSS Filter Effects spec (linear in sRGB values, as browsers do)."""
    if op == "hue-rotate":
        a = math.radians(v)
        c, s = math.cos(a), math.sin(a)
        return np.array([
            [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928],
            [0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283],
            [0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072]])
    if op == "saturate":
        return np.array([
            [0.213 + 0.787 * v, 0.715 - 0.715 * v, 0.072 - 0.072 * v],
            [0.213 - 0.213 * v, 0.715 + 0.285 * v, 0.072 - 0.072 * v],
            [0.213 - 0.213 * v, 0.715 - 0.715 * v, 0.072 + 0.928 * v]])
    if op == "brightness":
        return np.eye(3) * v
    raise ValueError(op)


def tint(img: Image.Image, name: str) -> Image.Image:
    """Apply a TINT_FILTERS chain to an RGBA picture (each filter clamps, like the browser)."""
    arr = np.asarray(img.convert("RGBA")).astype(np.float64)
    rgb = arr[..., :3] / 255
    for op, v in TINTS[name]:
        rgb = np.clip(rgb @ css_matrix(op, v).T, 0, 1)
    arr[..., :3] = rgb * 255
    return Image.fromarray(arr.round().astype(np.uint8), "RGBA")


def dilate(mask: np.ndarray, px: int) -> np.ndarray:
    if px <= 0:
        return mask
    im = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(2 * px + 1))
    return np.asarray(im) > 127


def erode(mask: np.ndarray, px: int) -> np.ndarray:
    if px <= 0:
        return mask
    im = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(2 * px + 1))
    return np.asarray(im) > 127


def fill_holes(mask: np.ndarray, max_px=None) -> np.ndarray:
    """Fill enclosed holes; with max_px only holes up to that size (a gap between the coils of a
    ring is a hole too, and must stay open)."""
    from scipy import ndimage
    filled = ndimage.binary_fill_holes(mask)
    if max_px is None:
        return filled
    lab, n = ndimage.label(filled & ~mask)
    if not n:
        return filled
    sizes = ndimage.sum(filled & ~mask, lab, range(1, n + 1))
    return mask | np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s <= max_px])


def keep_big(mask: np.ndarray, min_frac=0.02) -> np.ndarray:
    """Drop specks: connected parts smaller than min_frac of the largest part."""
    from scipy import ndimage
    lab, n = ndimage.label(mask)
    if n <= 1:
        return mask
    sizes = ndimage.sum(mask, lab, range(1, n + 1))
    keep = [i + 1 for i, s in enumerate(sizes) if s >= min_frac * sizes.max()]
    return np.isin(lab, keep)


def novelty(stage: np.ndarray, result: np.ndarray, box, radius=12, step=2) -> np.ndarray:
    """Per pixel of `result` inside `box`: the colour distance to the closest colour of `stage`
    within `radius` px. Repainted skin, a horn redrawn a few px away, re-hatched scales all find
    their colour nearby in the original (low novelty); the painted item (a red crest, polished
    metal, gems) does not (high novelty). Full-size array, 0 outside the box."""
    x0, y0, x1, y1 = box
    h, w = stage.shape[:2]
    X0, Y0, X1, Y1 = max(0, x0 - radius), max(0, y0 - radius), min(w, x1 + radius), min(h, y1 + radius)
    s = stage[Y0:Y1, X0:X1].astype(np.float32)
    r = result[y0:y1, x0:x1].astype(np.float32)
    best = np.full(r.shape[:2], np.inf, np.float32)
    for dy in range(-radius, radius + 1, step):
        for dx in range(-radius, radius + 1, step):
            ys, xs = y0 - Y0 + dy, x0 - X0 + dx
            if ys < 0 or xs < 0 or ys + r.shape[0] > s.shape[0] or xs + r.shape[1] > s.shape[1]:
                continue
            d = np.sqrt(((r - s[ys:ys + r.shape[0], xs:xs + r.shape[1]]) ** 2).sum(axis=2))
            np.minimum(best, d, out=best)
    out = np.zeros((h, w), np.float32)
    out[y0:y1, x0:x1] = best
    return out


def peaks(mask: np.ndarray, n: int, spacing: int):
    """Up to n well-separated interior points of a mask (distance-transform maxima)."""
    from scipy import ndimage
    dist = ndimage.distance_transform_edt(mask)
    pts = []
    for _ in range(n):
        y, x = np.unravel_index(int(dist.argmax()), dist.shape)
        if dist[y, x] < 2:
            break
        pts.append((int(x), int(y)))
        yy, xx = np.ogrid[:mask.shape[0], :mask.shape[1]]
        dist[(yy - y) ** 2 + (xx - x) ** 2 < spacing ** 2] = 0
    return pts


def extract(stage_p, result_p, mask_p, out, diff_t=28, nov_t=45, grow=2, debug=None, cpu=False,
            pos_pts=None, neg_pts=None, box_in=None, keep_white=False, max_hole=None, cuts=None):
    import segment
    segment.load(cpu)
    stage = Image.open(stage_p).convert("RGB")
    result = Image.open(result_p).convert("RGB")
    slot = np.asarray(Image.open(mask_p).convert("L")) > 127
    a, b = np.asarray(stage).astype(int), np.asarray(result).astype(int)
    changed = np.abs(a - b).max(axis=2) > diff_t
    # Changed pixels, closed and hole-filled, inside the slot: an upper bound of the item.
    changed_s = fill_holes(erode(dilate(changed, 3), 3)) & slot
    ys, xs = np.nonzero(slot)
    sb = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    # Novel colours: the item's core, never repainted skin (see novelty()).
    nov = novelty(a, b, sb)
    novel = (nov > nov_t) & dilate(slot, grow)
    novel = keep_big(dilate(erode(novel, 1), 1), 0.05)
    novel_f = fill_holes(erode(dilate(novel, 4), 4))
    if pos_pts:
        # Hand-placed points (read off a grid view of the result): the reliable route when the item
        # shares the dragon's colours (a bronze helmet on bronze scales).
        pos, neg = [tuple(p) for p in pos_pts], [tuple(p) for p in (neg_pts or [])]
        box = list(box_in) if box_in else list(sb)
    else:
        if not novel.any():
            sys.exit("nothing new was painted in the slot: check the result, or pass --pos points")
        # SAM 2.1 prompted with the novel region's box, positive points inside it and negative
        # points on repainted-but-familiar pixels.
        nys, nxs = np.nonzero(novel_f)
        pad = 8
        box = [int(max(0, nxs.min() - pad)), int(max(0, nys.min() - pad)), int(nxs.max() + pad), int(nys.max() + pad)]
        pos = peaks(novel, 5, 28)
        familiar = changed_s & (nov < 15) & ~dilate(novel_f, 6)
        neg = peaks(familiar, 3, 40)
    masks, scores = segment.sam_mask(result, box, pos + neg, [1] * len(pos) + [0] * len(neg), all_masks=True)
    if pos_pts:
        # Hand-placed points: SAM's own best score, restricted to masks that contain every point.
        # When none does, the one that breaks the fewest points (then the best score), and say which
        # points it breaks: a positive left out or a negative taken in needs a look at --debug.
        bad = [[("+", p) for p in pos if not m[p[1], p[0]]] + [("-", p) for p in neg if m[p[1], p[0]]]
               for m in masks]
        ious = [float(s) - 10 * len(b) for s, b in zip(scores, bad)]
        if all(bad):
            k = int(np.argmax(ious))
            print(f"  WARNING: no SAM mask fits every point; mask {k} breaks {bad[k]} (check --debug)")
    else:
        # Of SAM's three masks (part, object, whole) keep the one closest to the novel region
        # (IoU): SAM's own score prefers a crisp part (the crest without its helmet); the largest
        # mask takes the whole head.
        ious = [(m & novel_f).sum() / max((m | novel_f).sum(), 1) for m in masks]
    k = int(np.argmax(ious))
    print(f"box {[int(v) for v in box]} +{pos} -{neg}\n  sam iou-with-novel {[round(float(v), 2) for v in ious]} "
          f"score {[round(v, 2) for v in scores]} -> mask {k}")
    seg = masks[k]
    obj = seg & dilate(slot, grow) & dilate(changed_s, grow)
    # Holes filled, then a gap enclosed by the item that still shows the original picture (the white
    # ground inside a coiled serpent crest, a horn seen through a loop) is cut out again: it is not
    # the item (kept, it would be a white patch or an untinted horn). Any patch of 40+ px inside the
    # object nearly identical to the original (max channel difference < 8) goes; single coincident
    # pixels of an item painted in the dragon's colours stay. --max-hole: only holes up to that size
    # are filled (a ring of coils: the repainted tail between the coils must stay out, give negative
    # points on it too).
    obj = fill_holes(obj, max_hole)
    from scipy import ndimage
    same = obj & (np.abs(a - b).max(axis=2) < 8)
    lab, n = ndimage.label(same)
    if n:
        sizes = ndimage.sum(same, lab, range(1, n + 1))
        obj &= ~np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s >= 40])
    # White ground painted by the inpainting (the stage pictures stand on white): where an item stands
    # out of the silhouette (a crest), the model paints white between its parts, sometimes over a
    # small part of the dragon (a spine behind a coiled serpent). Kept, it would be a white patch on
    # the game's ground or over the dragon. Near-white, grey-neutral patches of 30+ px go (a smaller
    # specular highlight on polished metal stays); --keep-white turns it off for a white item.
    if not keep_white:
        near_white = obj & (b.min(axis=2) > 225) & (b.max(axis=2) - b.min(axis=2) < 20)
        lab, n = ndimage.label(dilate(near_white, 1) & obj)
        if n:
            sizes = ndimage.sum(near_white, lab, range(1, n + 1))
            obj &= ~np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s >= 30])
    # --cut: hand-traced polygons of what is not the item (repainted skin between the coils of a
    # ring that SAM keeps taking in), subtracted last.
    if cuts:
        from PIL import ImageDraw
        cut_im = Image.new("L", stage.size, 0)
        for poly in cuts:
            ImageDraw.Draw(cut_im).polygon([tuple(p) for p in poly], fill=255)
        obj &= ~(np.asarray(cut_im) > 127)
    # Parts under 10 % of the largest: flecks of repainted skin SAM attached to the item.
    obj = keep_big(obj, 0.10)
    # Edge: 1 px soft ramp inside the object's outline, so no repainted skin rim is kept.
    alpha = Image.fromarray((erode(obj, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    alpha = Image.fromarray(np.minimum(np.asarray(alpha), obj * 255).astype(np.uint8))
    rgba = result.convert("RGBA")
    rgba.putalpha(alpha)
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    rgba.save(out)
    gen = Path(result_p).with_suffix(".json")
    side = {"result": Path(result_p).name,
            "generation": json.loads(gen.read_text(encoding="utf-8")) if gen.exists() else None,
            "extract": {"stage": Path(stage_p).name, "slot_mask": Path(mask_p).name,
                        "pos": [list(p) for p in pos], "neg": [list(p) for p in neg], "box": [int(v) for v in box],
                        "hand_points": bool(pos_pts), "sam_mask": k, "diff": diff_t, "novelty": nov_t,
                        "grow": grow, "keep_white": keep_white, "max_hole": max_hole, "cuts": cuts}}
    Path(out).with_suffix(".json").write_text(json.dumps(side, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{out}  object {int(obj.sum())} px, slot {int(slot.sum())} px, changed {int(changed_s.sum())} px, sam {int(seg.sum())} px")
    if debug:
        pts = result.copy()
        from PIL import ImageDraw
        d = ImageDraw.Draw(pts)
        d.rectangle(box, outline=(0, 200, 255), width=2)
        for (x, y), c in [(p, (0, 220, 0)) for p in pos] + [(p, (255, 0, 0)) for p in neg]:
            d.ellipse((x - 5, y - 5, x + 5, y + 5), fill=c, outline=(0, 0, 0))
        tiles = [stage, pts] + [Image.fromarray((m * 255).astype(np.uint8)).convert("RGB")
                                for m in (slot, changed_s, novel, seg, obj)]
        tiles.append(Image.fromarray(np.clip(nov * 2, 0, 255).astype(np.uint8)).convert("RGB"))
        x0, y0, x1, y1 = sb
        pad = 60
        crop = (max(0, x0 - pad), max(0, y0 - pad), min(stage.width, x1 + pad), min(stage.height, y1 + pad))
        tiles = [t.crop(crop) for t in tiles]
        w, h = tiles[0].size
        sheet = Image.new("RGB", (w * 4, h * 2), (80, 80, 80))
        for i, t in enumerate(tiles):
            sheet.paste(t, ((i % 4) * w, (i // 4) * h))
        sheet.save(debug)


def merge(out, parts):
    arrs = [np.asarray(Image.open(p).convert("RGBA")) for p in parts]
    res = arrs[0].copy()
    for a in arrs[1:]:
        take = a[..., 3] > res[..., 3]
        res[take] = a[take]
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(res, "RGBA").save(out)
    sides = []
    for p in parts:
        sp = Path(p).with_suffix(".json")
        sides.append(json.loads(sp.read_text(encoding="utf-8")) if sp.exists() else {"part": Path(p).name})
    Path(out).with_suffix(".json").write_text(json.dumps({"merged_parts": sides}, indent=2, ensure_ascii=False) + "\n",
                                              encoding="utf-8")
    print(f"{out}  {int((res[..., 3] > 0).sum())} px from {len(parts)} parts")


def check(stage_cut_p, overlays, out, zoom_box=None):
    stage = Image.open(stage_cut_p).convert("RGBA")
    ovs = [Image.open(p).convert("RGBA") for p in overlays]
    side = 360
    variants = [("bronze", stage)] + [(n, tint(stage, n)) for n in ("ecume", "braise", "argent")]
    union = np.zeros((stage.height, stage.width), bool)
    for o in ovs:
        union |= np.asarray(o.getchannel("A")) > 0
    ys, xs = np.nonzero(union)
    pad = 70
    zb = zoom_box or (max(0, xs.min() - pad), max(0, ys.min() - pad),
                      min(stage.width, xs.max() + pad), min(stage.height, ys.max() + pad))
    zw, zh = zb[2] - zb[0], zb[3] - zb[1]
    zscale = side * 2 / max(zw, zh)
    zsize = (round(zw * zscale), round(zh * zscale))
    cols = len(variants)
    sheet = Image.new("RGB", (cols * side, len(GROUNDS) * side + zsize[1]), (60, 60, 60))
    for r, g in enumerate(GROUNDS.values()):
        for c, (name, st) in enumerate(variants):
            tile = Image.new("RGBA", stage.size, g + (255,))
            tile.alpha_composite(st)
            for o in ovs:
                tile.alpha_composite(o)
            sheet.paste(tile.convert("RGB").resize((side, side), Image.LANCZOS), (c * side, r * side))
    y = len(GROUNDS) * side
    for c, (name, st) in enumerate(variants[:2]):
        tile = Image.new("RGBA", stage.size, GROUNDS["mid"] + (255,))
        tile.alpha_composite(st)
        for o in ovs:
            tile.alpha_composite(o)
        z = tile.crop(zb).convert("RGB").resize(zsize, Image.LANCZOS)
        sheet.paste(z, (c * zsize[0], y))
    sheet.save(out)
    print(out)


STAGES = ("young", "adult", "illustre", "ancestral")
SLOTS = ("queue", "dos", "cou", "tete")  # the game's draw order (drachmes-shop spec section 4)


def sheet(lt, out, tints=("ecume", "braise", "argent", "olivier")):
    """Contact sheet of one lieutenant's set: per stage a row of the four items, each zoomed on the
    bronze stage (mid ground), then a last row with the whole set worn on every stage, each stage
    under one tint. Missing overlays are left grey."""
    from PIL import ImageDraw
    root = Path(__file__).resolve().parents[2] / "assets/art/dragon"
    cell = 300
    W, H = cell * 4, cell * (len(STAGES) + 1) + 24 * (len(STAGES) + 1)
    im = Image.new("RGB", (W, H), (40, 36, 44))
    d = ImageDraw.Draw(im)
    y = 0
    for st in STAGES:
        stage = Image.open(root / f"dragon_{st}_cut.png").convert("RGBA")
        d.text((6, y + 6), f"{lt} / {st}", fill=(236, 223, 193))
        y += 24
        for c, slot in enumerate(("cou", "queue", "dos", "tete")):
            p = root / "accessories" / f"{lt}-{slot}_{st}.png"
            if not p.exists():
                continue
            ov = Image.open(p).convert("RGBA")
            l, t, r, b = ov.getchannel("A").getbbox()
            side = max(r - l, b - t) + 80
            cx, cy = (l + r) // 2, (t + b) // 2
            box = (cx - side // 2, cy - side // 2, cx + side // 2, cy + side // 2)
            tile = Image.new("RGBA", stage.size, GROUNDS["mid"] + (255,))
            tile.alpha_composite(stage)
            tile.alpha_composite(ov)
            big = Image.new("RGBA", (stage.width + 2 * side, stage.height + 2 * side), GROUNDS["mid"] + (255,))
            big.paste(tile, (side, side))
            z = big.crop(tuple(v + side for v in box)).convert("RGB").resize((cell, cell), Image.LANCZOS)
            im.paste(z, (c * cell, y))
            d.text((c * cell + 6, y + cell - 16), slot, fill=(236, 223, 193))
        y += cell
    d.text((6, y + 6), f"{lt}: the whole set, tinted ({', '.join(tints)})", fill=(236, 223, 193))
    y += 24
    for c, (st, tn) in enumerate(zip(STAGES, tints)):
        stage = tint(Image.open(root / f"dragon_{st}_cut.png").convert("RGBA"), tn)
        tile = Image.new("RGBA", stage.size, GROUNDS["parchment"] + (255,))
        tile.alpha_composite(stage)
        for slot in SLOTS:
            p = root / "accessories" / f"{lt}-{slot}_{st}.png"
            if p.exists():
                tile.alpha_composite(Image.open(p).convert("RGBA"))
        im.paste(tile.convert("RGB").resize((cell, cell), Image.LANCZOS), (c * cell, y))
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    im.save(out)
    print(out)


def crop(overlay_p, webp, manifest=None, item=None, stage=None, quality=88, pixels=False):
    im = Image.open(overlay_p).convert("RGBA")
    bbox = im.getchannel("A").getbbox()
    if bbox is None:
        sys.exit(f"{overlay_p}: the overlay is fully transparent")
    l, t, r, b = bbox
    l, t, r, b = max(0, l - 2), max(0, t - 2), min(im.width, r + 2), min(im.height, b + 2)
    Path(webp).parent.mkdir(parents=True, exist_ok=True)
    im.crop((l, t, r, b)).save(webp, "WEBP", quality=quality, method=6)
    px = {"x": l, "y": t, "w": r - l, "h": b - t}
    if pixels:
        entry = {"src": Path(webp).name, **px}
    else:
        W, H = im.size
        entry = {"src": Path(webp).name, "x": round(l / W, 5), "y": round(t / H, 5),
                 "w": round((r - l) / W, 5), "h": round((b - t) / H, 5)}
    print(f"{webp}  {entry}  (px {px} of {im.width}x{im.height})  {Path(webp).stat().st_size / 1024:.1f} KiB")
    if manifest:
        if not item or not stage:
            sys.exit("--manifest needs --item and --stage")
        mp = Path(manifest)
        data = json.loads(mp.read_text(encoding="utf-8")) if mp.exists() else {}
        data.setdefault(item, {})[stage] = entry
        mp.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    e = sub.add_parser("extract")
    e.add_argument("stage"); e.add_argument("result"); e.add_argument("mask")
    e.add_argument("--out", required=True)
    e.add_argument("--diff", type=int, default=28, help="per-channel change that counts as painted")
    e.add_argument("--novelty", type=float, default=45, help="colour distance that counts as a new colour")
    e.add_argument("--grow", type=int, default=2, help="px the object may extend past the slot mask")
    e.add_argument("--debug")
    e.add_argument("--cpu", action="store_true", help="run the models on the CPU (Forge is using the GPU)")
    e.add_argument("--pos", nargs="+", type=lambda s: [int(v) for v in s.split(",")], metavar="X,Y",
                   help="hand-placed points on the item (stage px); skips the automatic novelty prompts")
    e.add_argument("--neg", nargs="+", type=lambda s: [int(v) for v in s.split(",")], metavar="X,Y",
                   help="hand-placed points on what is not the item (skin, horn, eye)")
    e.add_argument("--box", type=int, nargs=4, metavar=("X0", "Y0", "X1", "Y1"),
                   help="with --pos: SAM's box (default: the slot's bounding box)")
    e.add_argument("--keep-white", action="store_true",
                   help="keep near-white patches (a white item); by default painted white ground is dropped")
    e.add_argument("--max-hole", type=int, help="fill only holes up to this many px (default: all)")
    e.add_argument("--cut", action="append", metavar="'X,Y X,Y X,Y ...'",
                   type=lambda s: [[int(v) for v in p.split(",")] for p in s.split()],
                   help="a polygon (stage px) to remove from the item; repeatable")
    m = sub.add_parser("merge")
    m.add_argument("out"); m.add_argument("parts", nargs="+")
    c = sub.add_parser("check")
    c.add_argument("stage_cut"); c.add_argument("overlays", nargs="+")
    c.add_argument("--out", required=True)
    k = sub.add_parser("crop")
    k.add_argument("overlay"); k.add_argument("--webp", required=True)
    k.add_argument("--manifest"); k.add_argument("--item"); k.add_argument("--stage")
    k.add_argument("--pixels", action="store_true", help="record x/y/w/h in stage px, not fractions")
    s = sub.add_parser("sheet")
    s.add_argument("lieutenant", help="item id prefix, e.g. hydre")
    s.add_argument("--out", required=True)
    a = ap.parse_args()
    if a.cmd == "extract":
        extract(a.stage, a.result, a.mask, a.out, a.diff, a.novelty, a.grow, a.debug, a.cpu, a.pos, a.neg, a.box, a.keep_white, a.max_hole, a.cut)
    elif a.cmd == "merge":
        merge(a.out, a.parts)
    elif a.cmd == "check":
        check(a.stage_cut, a.overlays, a.out)
    elif a.cmd == "sheet":
        sheet(a.lieutenant, a.out)
    else:
        crop(a.overlay, a.webp, a.manifest, a.item, a.stage, pixels=a.pixels)


if __name__ == "__main__":
    main()
