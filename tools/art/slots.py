"""Slot masks for the dragon's accessories (the art-overlays skill).

    tools/art/seg/.venv/Scripts/python tools/art/slots.py build [--stage young] [--slot cou]
    tools/art/seg/.venv/Scripts/python tools/art/slots.py sheet      # docs/art/slot-masks.png

A slot mask is the inpainting mask for one kind of item (cou = neck, queue = tail, dos = back,
tete = head) on one stage picture: white where the item may be painted. It is the stage's
silhouette (alpha of assets/art/dragon/dragon_<stage>_cut.png, or a SAM 2.1 mask when a spec gives
a "sam" box/points) cut to the slot's region, minus what an item must never cover (eyes, the near
wing when it passes in front), dilated a few pixels past the outline, plus optional "air" areas
where the item stands out from the body (a crest above the skull). The regions are hand-placed
polygons in tools/art/slots.json, drawn after looking at each picture and at Grounding DINO's
"head"/"neck" boxes: text-prompted detection finds the head and the neck well but not "back" or
"tail" (it boxes the whole dragon), so the band where an item sits is a human decision recorded in
the spec, and the pixels come from the segmentation.

Spec (tools/art/slots.json): {stage: {"_file": "assets/art/dragon/dragon_young.png",
    slot: {"region": [[x, y], ...], "sam": {"box": [x0, y0, x1, y1], "points": [[x, y]],
           "labels": [1]}, "minus": [[[x, y], ...], ...], "air": [[[x, y], ...]], "dilate": 6}}}
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).parent))
from overlay import GROUNDS, dilate  # noqa: E402

SPEC = Path("tools/art/slots.json")
OUT = Path("assets/art/dragon/slots")
SHEET = Path("docs/art/slot-masks.png")
STAGES = ["young", "adult", "illustre", "ancestral"]
SLOTS = ["cou", "queue", "dos", "tete"]
COLOURS = {"cou": (230, 60, 60), "queue": (60, 140, 230), "dos": (60, 190, 90), "tete": (240, 190, 40)}


def poly_mask(size, polys):
    im = Image.new("L", size, 0)
    d = ImageDraw.Draw(im)
    for p in polys:
        d.polygon([tuple(v) for v in p], fill=255)
    return np.asarray(im) > 127


def silhouette(png: Path) -> np.ndarray:
    cut = png.with_name(png.stem + "_cut.png")
    return np.asarray(Image.open(cut).getchannel("A")) > 128


def build(spec, stage, slot):
    s = spec[stage]
    png = Path(s["_file"])
    img = Image.open(png).convert("RGB")
    cfg = s[slot]
    if "sam" in cfg:
        import segment
        body = segment.sam_mask(img, cfg["sam"]["box"], cfg["sam"].get("points"), cfg["sam"].get("labels"))
    else:
        body = silhouette(png)
    m = body & poly_mask(img.size, [cfg["region"]])
    m = dilate(m, cfg.get("dilate", 6))
    if cfg.get("air"):
        m |= poly_mask(img.size, cfg["air"])
    if cfg.get("minus"):
        m &= ~poly_mask(img.size, cfg["minus"])
    # Parts the item must go around, not over (the horns for a helmet): one SAM 2.1 point prompt per
    # part on the stage picture, its smallest confident mask, dilated 2 px. Inside an inpainting mask
    # the model redraws them a few px away, and the redrawn copy then sits on top of the original.
    if cfg.get("minus_sam"):
        import segment
        for x, y in cfg["minus_sam"]:
            masks, scores = segment.sam_mask(img, None, [[x, y]], [1], all_masks=True)
            part = min((mk for mk, s in zip(masks, scores) if s > 0.7 and mk[y, x]), key=lambda mk: mk.sum(),
                       default=masks[int(np.argmax(scores))])
            m &= ~dilate(part, 2)
    OUT.mkdir(parents=True, exist_ok=True)
    out = OUT / f"{stage}_{slot}.png"
    Image.fromarray((m * 255).astype(np.uint8)).save(out)
    print(f"{out}  {int(m.sum())} px")


def sheet(spec):
    side = 400
    font = ImageFont.load_default(size=18)
    out = Image.new("RGB", (len(SLOTS) * side, len(STAGES) * (side + 26)), GROUNDS["dark"])
    d = ImageDraw.Draw(out)
    for r, stage in enumerate(STAGES):
        if stage not in spec:
            continue
        png = Path(spec[stage]["_file"])
        cut = Image.open(png.with_name(png.stem + "_cut.png")).convert("RGBA")
        for c, slot in enumerate(SLOTS):
            p = OUT / f"{stage}_{slot}.png"
            tile = Image.new("RGBA", cut.size, GROUNDS["parchment"] + (255,))
            tile.alpha_composite(cut)
            if p.exists():
                m = Image.open(p).convert("L")
                colour = Image.new("RGBA", cut.size, COLOURS[slot] + (255,))
                tile = Image.composite(Image.blend(tile, colour, 0.55), tile, m)
                edge = np.asarray(m) > 127
                ring = dilate(edge, 2) & ~edge
                arr = np.asarray(tile).copy()
                arr[ring] = (0, 0, 0, 255)
                tile = Image.fromarray(arr, "RGBA")
            y = r * (side + 26)
            out.paste(tile.convert("RGB").resize((side, side), Image.LANCZOS), (c * side, y + 26))
            d.text((c * side + 8, y + 4), f"{stage} / {slot}", fill=(236, 223, 193), font=font)
    SHEET.parent.mkdir(parents=True, exist_ok=True)
    out.save(SHEET, optimize=True)
    print(SHEET)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("what", choices=["build", "sheet"])
    ap.add_argument("--stage", nargs="+", default=STAGES)
    ap.add_argument("--slot", nargs="+", default=SLOTS)
    ap.add_argument("--cpu", action="store_true", help="run SAM on the CPU (Forge is using the GPU)")
    a = ap.parse_args()
    if a.cpu:
        import segment
        segment.load(True)
    spec = json.loads(SPEC.read_text(encoding="utf-8"))
    if a.what == "build":
        for stage in a.stage:
            for slot in a.slot:
                if stage in spec and slot in spec[stage]:
                    build(spec, stage, slot)
    sheet(spec)


if __name__ == "__main__":
    main()
