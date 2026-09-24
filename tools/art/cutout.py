"""Remove the flat white background from generated character/creature/emblem art.

For every PNG given (or found under the given folders, non-recursive), writes
<name>_cut.png with an alpha channel next to the original. Files that already
end in _cut are skipped, and existing outputs are only rewritten with --force.

Runs inside a throwaway Docker container so nothing is installed on the host
(see tools/art/run_docker.sh). Requires: pip install "rembg[cpu]" pillow
"""
import argparse
import sys
from pathlib import Path

from PIL import Image
from rembg import new_session, remove


def targets(paths):
    for p in paths:
        p = Path(p)
        files = sorted(p.glob("*.png")) if p.is_dir() else [p]
        for f in files:
            if not f.stem.endswith("_cut"):
                yield f


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("paths", nargs="+", help="PNG files or folders")
    ap.add_argument("--model", default="isnet-general-use",
                    help="rembg model (u2net, isnet-general-use, ...)")
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
        # post_process_mask smooths the matte a bit; alpha matting is off on purpose:
        # the sources have a clean flat white background so the plain matte is enough.
        out = remove(img, session=session, post_process_mask=True)
        out.save(dst, optimize=True)
        done += 1
        print(f"{src} -> {dst}")
    print(f"{done} file(s) written", file=sys.stderr)


if __name__ == "__main__":
    main()
