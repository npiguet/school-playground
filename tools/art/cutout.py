"""Remove the flat white background from generated character/creature/emblem art.

For every PNG given (or found under the given folders, non-recursive), writes
<name>_cut.png with an alpha channel next to the original. Files that already
end in _cut are skipped, and existing outputs are only rewritten with --force.

Method (chosen after a side-by-side evaluation on eris, echo, lethe,
dragon_adult and argus, composited on dark / mid / terracotta backgrounds at
x3 zoom; sheets in docs/art/cutout-comparison/):

  rembg model `birefnet-general` + rembg alpha matting
  (erode 4, foreground threshold 250, background threshold 5),
  nothing else.

- `isnet-general-use` (the previous default, with post_process_mask) gives a
  hard staircase edge with a 1-px white rim and jagged holes in pale areas
  (Echo's hair highlights, Lethe's mist, Argus' rim). BiRefNet's matte is soft
  and accurate; `birefnet-general-lite` / `birefnet-hrsod` were not better.
- The raw BiRefNet matte still blends the white background into 10-40 % of
  edge pixels. Alpha matting (pymatting closed-form alpha on a trimap made
  from the matte, then multilevel foreground colour estimation) brings that
  to ~0 % and keeps thin hair strands and near-white highlights. The small
  erosion (4 px) and tight thresholds (250 / 5) keep the trimap's unknown band
  narrow, so the matting only refines the edge instead of re-deciding it:
  the wider 10 / 15 px bands blurred fine strands and let pale semi-transparent
  regions (mist, ghost copies) drift.
- An explicit colour decontamination against the known white background
  ((C - (1-a)W)/a), a 1-px erosion/feather and speck removal were also tried
  on top; they over-darkened pale semi-transparent areas or added a dark rim,
  and were rejected. The output is exactly what rembg returns.

Runs on CPU inside a throwaway Docker container so nothing is installed on the
host (see tools/art/run_docker.sh, which pins the versions and caches the
~900 MB model between runs). About 15-25 s per image.
Requires: rembg[cpu]==2.0.85 pillow
"""
import argparse
import sys
from pathlib import Path

from PIL import Image
from rembg import new_session, remove

MODEL = "birefnet-general"
ALPHA_MATTING = dict(
    alpha_matting=True,
    alpha_matting_erode_size=4,
    alpha_matting_foreground_threshold=250,
    alpha_matting_background_threshold=5,
)


def targets(paths):
    for p in paths:
        p = Path(p)
        files = sorted(p.glob("*.png")) if p.is_dir() else [p]
        for f in files:
            if not f.stem.endswith("_cut"):
                yield f


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("paths", nargs="+", help="PNG files or folders")
    ap.add_argument("--model", default=MODEL, help=f"rembg model (default {MODEL})")
    ap.add_argument("--force", action="store_true", help="rewrite existing *_cut.png")
    a = ap.parse_args()

    session = new_session(a.model)
    done = 0
    for src in targets(a.paths):
        dst = src.with_name(src.stem + "_cut.png")
        if dst.exists() and not a.force:
            print(f"skip {dst} (exists)")
            continue
        img = Image.open(src).convert("RGBA")
        out = remove(img, session=session, **ALPHA_MATTING)
        out.save(dst, optimize=True)
        done += 1
        print(f"{src} -> {dst}", flush=True)
    print(f"{done} file(s) written", file=sys.stderr)


if __name__ == "__main__":
    main()
