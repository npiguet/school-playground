"""Bake the dragon's tinted pictures (the user's decision of 2026-10-03: "for production, we'll use the
baked tints").

Every dragon sprite (web/public/art/dragon/dragon_<stage>_cut.webp, the six stages, the egg included)
under every tint of web/src/lib/world/tintSpecs.json but the untinted bronze is written next to it as
web/public/art/dragon/dragon_<stage>_<tint>.webp: the same size, the alpha kept as it is, each opaque
or partly transparent pixel's straight colour tinted in OKLCH exactly as the CPU reference
web/src/lib/living/tint.ts tintOklch (tints.py, its numpy port); fully transparent pixels are left
alone. The game shows these files (the still pictures and the living dragon's texture); the lab's
« Teintes » sliders only preview a tint on the shader.

  tools/art/run_docker.sh bake            # (re)bake every stage x tint, write the manifest
  tools/art/run_docker.sh bake --check    # no writing: every file there, fresh, and equal to the
                                          # reference within WebP tolerance (exit 1 otherwise)

The manifest, web/src/lib/world/bakedTints.json (not under public/: the art folder is all WebP, and
the game never reads it), records per baked file its source, its tint, `hash` = sha256 of the tint's
settings line (`spec_line`) followed by the source sprite's bytes, so a changed TINT_SPECS entry or a
re-cut sprite shows as stale (web/src/lib/world/bakedTints.test.ts recomputes it), `sha256` of the
baked file itself, and a few sampled pixels (x, y, the source's decoded RGB, the baked file's decoded
RGB) that the vitest compares with tintOklch: the TypeScript reference against the real file's pixels.

Needs only numpy and Pillow (run_docker.sh's image has both).
"""
import argparse
import hashlib
import io
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from tints import REPO, TINTS, tint_array  # noqa: E402

DRAGON = REPO / "web/public/art/dragon"
MANIFEST = REPO / "web/src/lib/world/bakedTints.json"
STAGES = ("egg", "hatchling", "young", "adult", "illustre", "ancestral")
COMMAND = "tools/art/run_docker.sh bake"
# WebP quality: webify.py's default, the one the sources were saved with. Measured 2026-10-03: the 30
# baked files total 3,449,604 bytes, each within 0.95x to 1.07x of its source (5 x the six sources is
# 3,429,060 bytes).
QUALITY = 82
SAMPLES = 48
# The WebP tolerance (lossy colour, lossless alpha), from measurement on 2026-10-03 (the bake's and
# --check's printout): over the opaque pixels of each baked file against the reference, the largest
# channel error has a mean of 2.94 to 4.02 and a 99th percentile of 8 to 13; the caps leave a margin.
# The sampled pixels (flat ground) are bakedTints.test.ts's: measured at most 8, a file's mean at most
# 2.96 (its caps are there).
MEAN_MAX = 4.5
P99_MAX = 16


def fmt(v) -> str:
    """A number as JavaScript's String() writes it (1 not 1.0, 0.52 as 0.52): the hash's line must be
    the same in Python and in the vitest."""
    f = float(v)
    return str(int(f)) if f.is_integer() else repr(f)


def spec_line(spec) -> str:
    # The settings must be plain decimals (165, 0.52, -33): fmt and JavaScript's String() agree on
    # those, but not on exponent forms (1e-7 vs 1e-07, 1e21), which no tint should ever need.
    shift, chroma, lightness = spec
    return f"oklch-v1 shift {fmt(shift)} chroma {fmt(chroma)} lightness {fmt(lightness)}\n"


def source_hash(spec, source: bytes) -> str:
    return hashlib.sha256(spec_line(spec).encode("ascii") + source).hexdigest()


def rgba(data: bytes) -> np.ndarray:
    return np.asarray(Image.open(io.BytesIO(data)).convert("RGBA"))


def flat_opaque(arr: np.ndarray, r=2, spread=10) -> np.ndarray:
    """Pixels fully opaque in their (2r+1)^2 neighbourhood, whose colour varies by at most `spread` per
    channel there: flat ground, where a lossy WebP keeps a colour closest."""
    a = arr[..., 3] == 255
    rgb = arr[..., :3].astype(np.int16)
    ok = a.copy()
    lo = rgb.copy()
    hi = rgb.copy()
    h, w = a.shape
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            sl = (slice(max(0, dy), h + min(0, dy)), slice(max(0, dx), w + min(0, dx)))
            sh = (slice(max(0, -dy), h + min(0, -dy)), slice(max(0, -dx), w + min(0, -dx)))
            m = np.zeros_like(a)
            m[sh] = a[sl]
            ok &= m
            n = np.zeros_like(rgb)
            n[sh] = rgb[sl]
            lo = np.minimum(lo, np.where(m[..., None], n, lo))
            hi = np.maximum(hi, np.where(m[..., None], n, hi))
    ok &= np.all(hi - lo <= spread, -1)
    return ok


def samples(base: np.ndarray, baked: np.ndarray, seed: str) -> list:
    ys, xs = np.nonzero(flat_opaque(base))
    rng = np.random.default_rng(int(hashlib.sha256(seed.encode()).hexdigest()[:8], 16))
    pick = np.sort(rng.choice(len(ys), size=min(SAMPLES, len(ys)), replace=False))
    return [[int(xs[i]), int(ys[i]), *map(int, base[ys[i], xs[i], :3]), *map(int, baked[ys[i], xs[i], :3])] for i in pick]


def errors(base: np.ndarray, baked: np.ndarray, spec) -> tuple:
    """(alpha identical, mean and 99th percentile of the largest channel error on opaque pixels)."""
    want = tint_array(base, spec)
    opaque = base[..., 3] == 255
    err = np.abs(baked[..., :3].astype(np.int16) - want[..., :3].astype(np.int16)).max(-1)[opaque]
    return bool(np.array_equal(base[..., 3], baked[..., 3])), float(err.mean()), float(np.percentile(err, 99))


def bake(quality: int) -> int:
    files = {}
    problems = []
    total = 0
    for stage in STAGES:
        src = DRAGON / f"dragon_{stage}_cut.webp"
        data = src.read_bytes()
        base = rgba(data)
        for name, spec in TINTS.items():
            out = DRAGON / f"dragon_{stage}_{name}.webp"
            buf = io.BytesIO()
            # alpha_quality 100: the alpha plane lossless, the source's exactly (--check asserts it).
            Image.fromarray(tint_array(base, spec), "RGBA").save(buf, "WEBP", quality=quality, method=6,
                                                                  alpha_quality=100)
            baked_bytes = buf.getvalue()
            out.write_bytes(baked_bytes)
            total += len(baked_bytes)
            baked = rgba(baked_bytes)
            same_alpha, mean, p99 = errors(base, baked, spec)
            print(f"{out.name}: {len(baked_bytes) / 1024:.1f} KiB (source {len(data) / 1024:.1f}), "
                  f"alpha {'kept' if same_alpha else 'CHANGED'}, error mean {mean:.2f} p99 {p99:.0f}")
            if not same_alpha or mean > MEAN_MAX or p99 > P99_MAX:
                problems.append(f"{out.name}: off the reference (alpha kept {same_alpha}, mean {mean:.2f}, p99 {p99:.0f})")
            files[out.name] = {
                "source": src.name,
                "tint": name,
                "hash": source_hash(spec, data),
                "sha256": hashlib.sha256(baked_bytes).hexdigest(),
                "samples": samples(base, baked, out.name),
            }
    if problems:
        # The pictures are written, the manifest is not: the freshness test keeps failing until a
        # bake within tolerance (a higher --quality, or a sprite that needs a look).
        for p in problems:
            print(p, file=sys.stderr)
        print("manifest not written: the bake is off the reference", file=sys.stderr)
        return 1
    manifest = {
        "about": "Baked dragon tints (tools/art/bake_tints.py): hash = sha256(spec line + source bytes).",
        "command": COMMAND,
        "quality": quality,
        "files": files,
    }
    MANIFEST.write_text(json.dumps(manifest, indent=1) + "\n", encoding="utf-8")
    print(f"{len(files)} files, {total} bytes ({total / 1e6:.2f} MB); manifest {MANIFEST.relative_to(REPO)}")
    return 0


def check() -> int:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    files = manifest["files"]
    problems = []
    for stage in STAGES:
        data = (DRAGON / f"dragon_{stage}_cut.webp").read_bytes()
        base = rgba(data)
        for name, spec in TINTS.items():
            fn = f"dragon_{stage}_{name}.webp"
            entry = files.get(fn)
            path = DRAGON / fn
            if entry is None or not path.exists():
                problems.append(f"{fn}: missing")
                continue
            baked_bytes = path.read_bytes()
            if entry["hash"] != source_hash(spec, data) or entry["sha256"] != hashlib.sha256(baked_bytes).hexdigest():
                problems.append(f"{fn}: stale")
                continue
            same_alpha, mean, p99 = errors(base, rgba(baked_bytes), spec)
            print(f"{fn}: alpha {'kept' if same_alpha else 'CHANGED'}, error mean {mean:.2f} p99 {p99:.0f}")
            if not same_alpha or mean > MEAN_MAX or p99 > P99_MAX:
                problems.append(f"{fn}: off the reference (alpha kept {same_alpha}, mean {mean:.2f}, p99 {p99:.0f})")
    extra = sorted(set(files) - {f"dragon_{s}_{n}.webp" for s in STAGES for n in TINTS})
    problems += [f"{fn}: in the manifest, no longer a stage x tint" for fn in extra]
    for p in problems:
        print(p, file=sys.stderr)
    if problems:
        print(f"re-bake: {COMMAND}", file=sys.stderr)
        return 1
    print(f"{len(files)} baked tints, fresh and equal to the reference")
    return 0


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="check the baked files, write nothing")
    ap.add_argument("--quality", type=int, default=QUALITY)
    a = ap.parse_args()
    if a.check:
        sys.exit(check())
    sys.exit(bake(a.quality))


if __name__ == "__main__":
    main()
