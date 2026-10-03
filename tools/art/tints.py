"""The dragon's tints for the art tools: the one table of settings and the numpy port of the OKLCH tint.

TINTS comes from web/src/lib/world/tintSpecs.json, the file web/src/lib/world/dragon.ts builds
TINT_SPECS from: one source of truth for the game, the lab, the baked pictures (bake_tints.py) and the
overlay previews (overlay.py). Bronze is no tint (null in the JSON) and is left out here.

tint_oklch is web/src/lib/living/tint.ts tintOklch on numpy arrays: the same steps, the same matrices,
the same 16 bisection steps on an out-of-gamut colour's chroma. Needs only numpy and Pillow.
"""
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image

REPO = Path(__file__).resolve().parents[2]
SPECS_JSON = REPO / "web/src/lib/world/tintSpecs.json"


def load_specs() -> dict:
    """{tint: (shift, chroma, lightness)} for every tint but the untinted bronze, in the JSON's order."""
    raw = json.loads(SPECS_JSON.read_text(encoding="utf-8"))
    return {k: (v["shift"], v["chroma"], v["lightness"]) for k, v in raw.items() if v is not None}


TINTS = load_specs()

_M1 = np.array([[0.4122214708, 0.5363325363, 0.0514459929], [0.2119034982, 0.6806995451, 0.1073969566],
                [0.0883024619, 0.2817188376, 0.6299787005]])
_M2 = np.array([[0.2104542553, 0.793617785, -0.0040720468], [1.9779984951, -2.428592205, 0.4505937099],
                [0.0259040371, 0.7827717662, -0.808675766]])
_N1 = np.array([[1.0, 0.3963377774, 0.2158037573], [1.0, -0.1055613458, -0.0638541728], [1.0, -0.0894841775, -1.291485548]])
_N2 = np.array([[4.0767416621, -3.3077115913, 0.2309699292], [-1.2684380046, 2.6097574011, -0.3413193965],
                [-0.0041960863, -0.7034186147, 1.707614701]])


def _lch_linear(L, C, h):
    lab = np.stack([L, C * np.cos(h), C * np.sin(h)], -1)
    return ((lab @ _N1.T) ** 3) @ _N2.T


def tint_oklch(rgb: np.ndarray, shift: float, chroma: float, lightness: float) -> np.ndarray:
    """web/src/lib/living/tint.ts tintOklch on an (..., 3) array of straight sRGB colours (0..1): the
    OKLCH hue turned, chroma and lightness scaled, an out-of-gamut colour's chroma bisected down."""
    lin = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    lab = np.cbrt(lin @ _M1.T) @ _M2.T
    L = np.clip(lab[..., 0] * lightness, 0, 1)
    C = np.hypot(lab[..., 1], lab[..., 2]) * chroma
    h = np.arctan2(lab[..., 2], lab[..., 1]) + math.radians(shift)

    def ok(c):
        lin = _lch_linear(L, c, h)
        return np.all((lin >= -1e-4) & (lin <= 1 + 1e-4), -1)

    out = ~ok(C)
    lo, hi = np.zeros_like(C), C.copy()
    for _ in range(16):
        mid = (lo + hi) / 2
        good = ok(mid)
        lo, hi = np.where(good, mid, lo), np.where(good, hi, mid)
    C = np.where(out, lo, C)
    c = np.clip(_lch_linear(L, C, h), 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def tint_array(arr: np.ndarray, spec) -> np.ndarray:
    """An (H, W, 4) uint8 straight-RGBA array under a tint's (shift, chroma, lightness): the alpha kept,
    fully transparent pixels left as they are (stillTint.ts's rule, now the bake's)."""
    out = arr.copy()
    seen = arr[..., 3] > 0
    out[seen, :3] = np.round(tint_oklch(arr[seen, :3].astype(np.float64) / 255, *spec) * 255).astype(np.uint8)
    return out


def tint(img: Image.Image, name: str) -> Image.Image:
    """Apply a tint (by name) to an RGBA picture (straight colours; the alpha kept)."""
    return Image.fromarray(tint_array(np.asarray(img.convert("RGBA")), TINTS[name]), "RGBA")
