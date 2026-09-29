"""Text-prompted segmentation: Grounding DINO (box from words) + SAM 2.1 (mask from the box).

Runs in its own venv (tools/art/seg/.venv, see the art-overlays skill), never in Forge's Python:

    tools/art/seg/.venv/Scripts/python tools/art/segment.py IMAGE --prompt "golden collar" \
        --out mask.png [--debug debug.png] [--pick best|union|largest] [--box-threshold 0.3]
    tools/art/seg/.venv/Scripts/python tools/art/segment.py IMAGE --box x0 y0 x1 y1 --out mask.png

Writes a binary mask PNG (white = the object) the size of IMAGE, and prints the boxes found with
their scores. --within MASK keeps only detections whose box centre lies inside MASK (e.g. the
inpainted slot), so a "collar" prompt does not pick up the horns. Models: IDEA-Research/
grounding-dino-base and facebook/sam2.1-hiera-large (both ungated), cached by Hugging Face under
~/.cache/huggingface. GPU when free, else CPU (--cpu forces it). Run it only while Forge is idle
(it shares the GPU): wrap it in tools/art/with_lock.sh like a Forge batch.

The module also exposes load() / detect() / sam_mask() for other scripts (overlay.py, slots.py).
"""
import argparse
import sys
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageDraw

DINO = "IDEA-Research/grounding-dino-base"
SAM = "facebook/sam2.1-hiera-large"
_models = {}


def device(force_cpu=False):
    return "cuda" if torch.cuda.is_available() and not force_cpu else "cpu"


def load(force_cpu=False):
    if not _models:
        from transformers import (AutoModelForZeroShotObjectDetection, AutoProcessor, Sam2Model,
                                  Sam2Processor)
        dev = device(force_cpu)
        _models["dev"] = dev
        _models["dino_p"] = AutoProcessor.from_pretrained(DINO)
        _models["dino"] = AutoModelForZeroShotObjectDetection.from_pretrained(DINO).to(dev).eval()
        _models["sam_p"] = Sam2Processor.from_pretrained(SAM)
        _models["sam"] = Sam2Model.from_pretrained(SAM).to(dev).eval()
    return _models


def detect(img: Image.Image, prompt: str, box_threshold=0.3, text_threshold=0.25):
    """[(score, label, (x0, y0, x1, y1)), ...] best first. The prompt is lower-cased and ends with
    a dot, as Grounding DINO expects ("golden collar." or "neck. tail.")."""
    m = load()
    text = prompt.lower().strip()
    if not text.endswith("."):
        text += "."
    inputs = m["dino_p"](images=img, text=text, return_tensors="pt").to(m["dev"])
    with torch.no_grad():
        out = m["dino"](**inputs)
    res = m["dino_p"].post_process_grounded_object_detection(
        out, inputs.input_ids, threshold=box_threshold, text_threshold=text_threshold,
        target_sizes=[img.size[::-1]])[0]
    labels = res.get("text_labels", res.get("labels"))
    found = [(float(s), str(l), tuple(float(v) for v in b.tolist()))
             for s, l, b in zip(res["scores"], labels, res["boxes"])]
    return sorted(found, key=lambda f: -f[0])


def sam_mask(img: Image.Image, box, points=None, labels=None, all_masks=False):
    """Boolean mask (H, W) of the object in `box`, SAM 2.1's best-scoring of its three masks
    (all_masks=True: the three masks, small to large part, and their scores).
    Optional extra `points` [(x, y), ...] with `labels` [1 = inside, 0 = outside]."""
    m = load()
    kw = {"input_boxes": [[list(box)]]} if box is not None else {}
    if points:
        kw["input_points"] = [[[list(p) for p in points]]]
        kw["input_labels"] = [[list(labels)]]
    inputs = m["sam_p"](images=img, return_tensors="pt", **kw).to(m["dev"])
    with torch.no_grad():
        out = m["sam"](**inputs, multimask_output=True)
    masks = m["sam_p"].post_process_masks(out.pred_masks.cpu(), inputs["original_sizes"])[0]
    scores = out.iou_scores.cpu()[0, 0]
    if all_masks:
        return [masks[0, i].numpy().astype(bool) for i in range(masks.shape[1])], scores.tolist()
    best = int(scores.argmax())
    return masks[0, best].numpy().astype(bool)


def sam_point_masks(img: Image.Image, points, batch=64):
    """SAM 2.1 masks for many single-point prompts at once: (masks bool [N, 3, H, W], scores [N, 3]),
    the three levels of each point (part, object, whole). One image embedding for all points."""
    m = load()
    emb_inputs = m["sam_p"](images=img, return_tensors="pt").to(m["dev"])
    with torch.no_grad():
        emb = m["sam"].get_image_embeddings(emb_inputs["pixel_values"])
    all_masks, all_scores = [], []
    for i in range(0, len(points), batch):
        chunk = points[i:i + batch]
        inputs = m["sam_p"](images=img, input_points=[[[list(p)] for p in chunk]],
                            input_labels=[[[1] for _ in chunk]], return_tensors="pt").to(m["dev"])
        with torch.no_grad():
            out = m["sam"](input_points=inputs["input_points"], input_labels=inputs["input_labels"],
                           image_embeddings=emb, multimask_output=True)
        masks = m["sam_p"].post_process_masks(out.pred_masks.cpu(), emb_inputs["original_sizes"])[0]
        all_masks.append(masks.numpy().astype(bool))
        all_scores.append(out.iou_scores.cpu()[0].numpy())
    return np.concatenate(all_masks), np.concatenate(all_scores)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("image", type=Path)
    ap.add_argument("--prompt", help="what to find, e.g. 'golden collar'")
    ap.add_argument("--box", type=float, nargs=4, help="skip Grounding DINO: segment inside this box")
    ap.add_argument("--within", type=Path, help="keep detections whose box centre is inside this mask")
    ap.add_argument("--pick", choices=["best", "union", "largest"], default="best")
    ap.add_argument("--box-threshold", type=float, default=0.3)
    ap.add_argument("--text-threshold", type=float, default=0.25)
    ap.add_argument("--cpu", action="store_true")
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--debug", type=Path, help="write the picture with the boxes and the mask tinted")
    a = ap.parse_args()
    load(a.cpu)
    img = Image.open(a.image).convert("RGB")
    if a.box:
        boxes = [(1.0, "box", tuple(a.box))]
    else:
        boxes = detect(img, a.prompt, a.box_threshold, a.text_threshold)
        if a.within:
            w = np.array(Image.open(a.within).convert("L")) > 127
            boxes = [b for b in boxes if w[int((b[2][1] + b[2][3]) / 2), int((b[2][0] + b[2][2]) / 2)]]
    for s, l, b in boxes:
        print(f"{s:.2f} {l!r} {[round(v) for v in b]}")
    if not boxes:
        sys.exit("nothing found")
    if a.pick == "best":
        boxes = boxes[:1]
    masks = [sam_mask(img, b) for _, _, b in boxes]
    if a.pick == "largest":
        masks = [max(masks, key=lambda mk: mk.sum())]
    mask = np.logical_or.reduce(masks)
    a.out.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray((mask * 255).astype(np.uint8)).save(a.out)
    print(f"{a.out}  {int(mask.sum())} px")
    if a.debug:
        dbg = img.copy()
        tint = Image.new("RGB", img.size, (255, 0, 160))
        dbg = Image.composite(Image.blend(dbg, tint, 0.5), dbg, Image.fromarray((mask * 255).astype(np.uint8)))
        d = ImageDraw.Draw(dbg)
        for s, l, b in boxes:
            d.rectangle(b, outline=(0, 200, 255), width=3)
            d.text((b[0] + 4, b[1] + 4), f"{l} {s:.2f}", fill=(0, 0, 0))
        dbg.save(a.debug)


if __name__ == "__main__":
    main()
