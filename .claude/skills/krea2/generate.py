"""Generate images with Krea 2 Turbo through the local sd-webui-forge-neo API.

Writes <out>.png plus a sidecar <out>.json with everything needed to reproduce it.
Standard library only.
"""
import argparse
import base64
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

DEFAULT_URL = "http://127.0.0.1:7860"
DEFAULT_MODEL = "krea2_turbo-Q3_K_M.gguf"
STYLES_DIR = Path(__file__).parent / "styles"


def post(url, payload):
    req = urllib.request.Request(url, json.dumps(payload).encode("utf-8"), {"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=1800) as resp:
        return json.load(resp)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    src = p.add_mutually_exclusive_group(required=True)
    src.add_argument("--prompt")
    src.add_argument("--prompt-file", type=Path)
    p.add_argument("--style", help=f"name of a style file in {STYLES_DIR} (appended to the prompt)")
    p.add_argument("--size", default="1024x1024", help="WIDTHxHEIGHT, multiples of 16")
    p.add_argument("--seed", type=int, default=-1)
    p.add_argument("--steps", type=int, default=8)
    p.add_argument("--cfg", type=float, default=1.0)
    p.add_argument("--sampler", default="Euler")
    p.add_argument("--scheduler", default="simple")
    p.add_argument("--count", type=int, default=1, help="images to generate (seeds increment)")
    p.add_argument("--vscale", type=float, default=0.0,
                   help="NegPiP V-Scaling strength (0 = off, 1 = raw weights, up to 2); strengthens (word:weight)")
    p.add_argument("--variance", type=float, default=0.0,
                   help="Krea2 Variance cond-noise strength (0 = off, 1.2 typical) for more variety between seeds")
    p.add_argument("--model", default=DEFAULT_MODEL)
    p.add_argument("--url", default=DEFAULT_URL)
    p.add_argument("--out", type=Path, required=True, help="output .png path")
    a = p.parse_args()

    prompt = a.prompt if a.prompt else a.prompt_file.read_text(encoding="utf-8")
    prompt = prompt.strip()
    if a.style:
        prompt += "\n\n" + (STYLES_DIR / f"{a.style}.txt").read_text(encoding="utf-8").strip()
    width, height = (int(v) for v in a.size.lower().split("x"))

    a.out.parent.mkdir(parents=True, exist_ok=True)
    for i in range(a.count):
        payload = {
            "prompt": prompt,
            "steps": a.steps,
            "cfg_scale": a.cfg,
            "sampler_name": a.sampler,
            "scheduler": a.scheduler,
            "width": width,
            "height": height,
            "seed": a.seed + i if a.seed >= 0 else -1,
            "override_settings": {"sd_model_checkpoint": a.model},
            "alwayson_scripts": {
                "negpip": {"args": [a.vscale > 0, a.vscale or 1.0]},
                "krea2 variance": {"args": [a.variance > 0, 1.0, 1.0, 0.3, 0, 49, a.variance or 1.2, 1]},
            },
        }
        try:
            result = post(a.url + "/sdapi/v1/txt2img", payload)
        except urllib.error.URLError as e:
            sys.exit(f"Forge API not reachable at {a.url} ({e}). Is sd-webui-forge-neo running with --api?")

        seed = json.loads(result["info"])["seed"]
        out = a.out if a.count == 1 else a.out.with_name(f"{a.out.stem}_{i + 1}{a.out.suffix}")
        out.write_bytes(base64.b64decode(result["images"][0]))
        meta = {**payload, "seed": seed, "style": a.style}
        out.with_suffix(".json").write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"{out}  (seed {seed})")


if __name__ == "__main__":
    main()
