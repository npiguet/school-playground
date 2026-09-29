"""img2img and inpainting with Krea 2 Turbo through the local Forge Neo API (stdlib only).

    python tools/art/img2img.py --init assets/art/dragon/dragon_young.png --prompt-file p.txt \
        --style discorde-inked-clean --denoise 0.7 --seed 700 --count 4 --out /tmp/x.png
    python tools/art/img2img.py --init stage.png --mask slot.png --prompt-file item.txt \
        --denoise 0.85 --seed 4242 --out /tmp/item.png           # inpainting (white = repaint)

Defaults are the settings proven in the art-overlays skill: Euler/Simple, CFG 1, steps
max(9, round(8/denoise)), mask blur 4, inpainting_fill 1 (original), "only masked" with padding 48,
NegPiP V-scale 1.0. Every call passes the krea2_turbo-Q3_K_M checkpoint (Forge's own Krea default
is a forbidden fine-tune) and waits until Forge is idle first. Writes <out>.png + sidecar <out>.json
(with --count N: <stem>_1.png ... and the seed incremented).
"""
import argparse
import base64
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

URL = "http://127.0.0.1:7860"
MODEL = "krea2_turbo-Q3_K_M.gguf"
STYLES = Path(__file__).resolve().parents[2] / ".claude/skills/krea2/styles"


def wait_idle(url, max_down=600):
    down, said = 0, False
    while True:
        try:
            with urllib.request.urlopen(url + "/sdapi/v1/progress?skip_current_image=true", timeout=30) as r:
                state = json.load(r)
            down = 0
            if not state.get("state", {}).get("job_count"):
                return
            if not said:
                print("Forge is busy; waiting until it is idle...", file=sys.stderr)
                said = True
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            down += 10
            if down > max_down:
                sys.exit(f"Forge API not reachable at {url}")
        time.sleep(10)


def b64(path):
    return base64.b64encode(Path(path).read_bytes()).decode()


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    src = p.add_mutually_exclusive_group(required=True)
    src.add_argument("--prompt")
    src.add_argument("--prompt-file", type=Path)
    p.add_argument("--style")
    p.add_argument("--init", type=Path, required=True, help="the picture to start from (RGB PNG)")
    p.add_argument("--mask", type=Path, help="inpainting mask, white = repaint (same size as --init)")
    p.add_argument("--denoise", type=float, default=0.85)
    p.add_argument("--steps", type=int, default=0, help="0 = max(9, round(8/denoise))")
    p.add_argument("--seed", type=int, default=-1)
    p.add_argument("--count", type=int, default=1)
    p.add_argument("--mask-blur", type=int, default=4)
    p.add_argument("--fill", type=int, default=1, help="inpainting_fill: 0 fill, 1 original, 2 latent noise, 3 nothing")
    p.add_argument("--padding", type=int, default=48, help="'only masked' padding in px")
    p.add_argument("--whole", action="store_true", help="inpaint at whole-picture resolution instead of 'only masked'")
    p.add_argument("--soft", action="store_true", help="enable the Soft Inpainting script (default args)")
    p.add_argument("--vscale", type=float, default=1.0)
    p.add_argument("--url", default=URL)
    p.add_argument("--out", type=Path, required=True)
    a = p.parse_args()

    prompt = (a.prompt if a.prompt else a.prompt_file.read_text(encoding="utf-8")).strip()
    if a.style:
        prompt += "\n\n" + (STYLES / f"{a.style}.txt").read_text(encoding="utf-8").strip()
    from struct import unpack
    head = a.init.read_bytes()[16:24]
    width, height = unpack(">II", head)
    steps = a.steps or max(9, round(8 / a.denoise))
    a.out.parent.mkdir(parents=True, exist_ok=True)
    for i in range(a.count):
        payload = {
            "prompt": prompt, "init_images": [b64(a.init)], "denoising_strength": a.denoise,
            "steps": steps, "cfg_scale": 1.0, "sampler_name": "Euler", "scheduler": "Simple",
            "width": width, "height": height, "seed": a.seed + i if a.seed >= 0 else -1,
            "override_settings": {"sd_model_checkpoint": MODEL},
            "alwayson_scripts": {"negpip": {"args": [a.vscale > 0, a.vscale or 1.0]}},
        }
        if a.mask:
            payload.update({"mask": b64(a.mask), "mask_blur": a.mask_blur, "inpainting_fill": a.fill,
                            "inpaint_full_res": not a.whole, "inpaint_full_res_padding": a.padding,
                            "inpainting_mask_invert": 0})
            if a.soft:
                payload["alwayson_scripts"]["soft inpainting"] = {"args": [True, 1, 0.5, 4, 0, 0.5, 2]}
        wait_idle(a.url)
        req = urllib.request.Request(a.url + "/sdapi/v1/img2img", json.dumps(payload).encode(),
                                     {"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=1800) as r:
            result = json.load(r)
        seed = json.loads(result["info"])["seed"]
        out = a.out if a.count == 1 else a.out.with_name(f"{a.out.stem}_{i + 1}{a.out.suffix}")
        out.write_bytes(base64.b64decode(result["images"][0]))
        meta = {k: v for k, v in payload.items() if k not in ("init_images", "mask")}
        meta.update({"seed": seed, "style": a.style, "init": str(a.init), "mask_file": str(a.mask) if a.mask else None})
        out.with_suffix(".json").write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"{out}  (seed {seed})")


if __name__ == "__main__":
    main()
