"""The living dragon's rigs (the dragon-rig skill; spec 2026-10-02 living dragon, plan Rulings R1, R6).

    tools/art/run_docker.sh rig grid  [--stage S]   # tools/art/rig-out/grid_<stage>.png: the sprite under a 50 px grid
    tools/art/run_docker.sh rig bake  [--stage S]   # web/src/lib/living/rig/dragon_<stage>.json (the game's weights)
    tools/art/run_docker.sh rig debug [--stage S]   # tools/art/rig-out/rig_<stage>.png: weights, pivots, feet box
    tools/art/run_docker.sh rig sheet               # docs/art/dragon-rig.png: the debug views of the authored stages, for the record

Per bone: its region (polygon, ellipse, or the whole frame) rasterised inside the sprite's opaque
pixels, times an optional ramp (along y, or by distance from the pivot), pushed into the transparent
background by nearest-opaque-pixel fill (so mesh triangles straddling the outline move with the part
and do not shear its edge), then Gaussian-blurred. The rigid bones (head, wings, tail) are normalised
so their sum stays <= 1; everything is multiplied by (1 - pin), and every vertex inside the feet box
(the pin rectangle inset by 3 x its blur, down to the bottom) is hard-zeroed. The weights are sampled
at the 65 x 65 vertices of the game's mesh: bytes[(j * 65 + i) * 6 + b], vertex (i, j) at (16 i, 16 j).
"""
import argparse
import base64
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

REPO = Path(__file__).resolve().parents[2]
RIG_FILE = REPO / 'tools/art/rig.json'
SPRITE = 'web/public/art/dragon/dragon_{stage}_cut.webp'
BAKED = REPO / 'web/src/lib/living/rig'
SCRATCH = REPO / 'tools/art/rig-out'
SHEET = REPO / 'docs/art/dragon-rig.png'
N = 1024
GRID = 64
CELL = N // GRID
BONES = ['head', 'wingL', 'wingR', 'tail', 'chest', 'lift']
RIGID = ['head', 'wingL', 'wingR', 'tail']
COLOURS = {'head': (255, 60, 60), 'wingL': (60, 200, 60), 'wingR': (60, 120, 255), 'tail': (255, 200, 0)}
yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)


def rigs():
    data = json.loads(RIG_FILE.read_text(encoding='utf-8'))
    return {k: v for k, v in data.items() if not k.startswith('_')}


def sprite_path(stage):
    return REPO / SPRITE.format(stage=stage)


def source_hash(stage, block):
    canon = json.dumps(block, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
    h = hashlib.sha256(canon.encode('utf-8'))
    h.update(b'\n')
    h.update(sprite_path(stage).read_bytes())
    return h.hexdigest()


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def raster(spec):
    im = Image.new('L', (N, N), 0)
    d = ImageDraw.Draw(im)
    if 'poly' in spec:
        d.polygon([tuple(p) for p in spec['poly']], fill=255)
    elif 'ellipse' in spec:
        cx, cy, rx, ry = spec['ellipse']
        d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=255)
    elif 'rect' in spec:
        d.rectangle(spec['rect'], fill=255)
    elif spec.get('all'):
        d.rectangle([0, 0, N, N], fill=255)
    return np.asarray(im, np.float32) / 255


def blur(a, r):
    return a if r <= 0 else ndimage.gaussian_filter(a.astype(np.float32), r, mode='nearest')


def feet_box(pin):
    x0, y0, x1, _ = pin['rect']
    inset = 3 * pin['blur']
    return [math.ceil((x0 + inset) / CELL) * CELL, math.ceil((y0 + inset) / CELL) * CELL, math.floor((x1 - inset) / CELL) * CELL, N]


def weight_maps(stage, rig):
    sprite = Image.open(sprite_path(stage)).convert('RGBA')
    alpha = np.asarray(sprite, np.float32)[..., 3] / 255
    opaque = alpha > 0.05
    _, (iy, ix) = ndimage.distance_transform_edt(~opaque, return_indices=True)
    pin = blur(raster(rig['pin']), rig['pin']['blur'])
    w = {}
    for name in BONES:
        b = rig['bones'][name]
        if not ('poly' in b or 'ellipse' in b or b.get('all')):
            w[name] = np.zeros((N, N), np.float32)
            continue
        m = raster(b)
        if 'ramp' in b:
            lo, hi = b['ramp']
            m = m * smoothstep(lo, hi, yy)
        if 'ramp_from_pivot' in b:
            px, py = b['pivot']
            r0, r1 = b['ramp_from_pivot']
            m = m * smoothstep(r0, r1, np.hypot(xx - px, yy - py))
        m = np.where(opaque, m, 0)[iy, ix]
        w[name] = np.clip(blur(m, b.get('blur', 0)), 0, 1) * (1 - pin)
    over = np.maximum(sum(w[k] for k in RIGID), 1)
    for k in RIGID:
        w[k] = w[k] / over
    return sprite, alpha, pin, w


def vertex_bytes(w, feet):
    idx = np.minimum(np.arange(GRID + 1) * CELL, N - 1)
    per = np.stack([w[k][np.ix_(idx, idx)] for k in BONES], -1)  # [row j, column i, bone]
    q = np.clip(np.round(per * 255), 0, 255).astype(np.uint8)
    v = np.arange(GRID + 1) * CELL
    x0, y0, x1, _ = feet
    inside = (v[:, None] >= y0) & (v[None, :] >= x0) & (v[None, :] <= x1)
    q[inside] = 0
    return q.tobytes()


def bake(stage, rig):
    _, _, _, w = weight_maps(stage, rig)
    feet = feet_box(rig['pin'])
    out = {
        'stage': stage,
        'source': source_hash(stage, rig),
        'grid': GRID,
        'pivots': {k: rig['bones'][k]['pivot'] for k in BONES},
        'feet': feet,
        'weights': base64.b64encode(vertex_bytes(w, feet)).decode('ascii'),
    }
    BAKED.mkdir(parents=True, exist_ok=True)
    (BAKED / f'dragon_{stage}.json').write_text(json.dumps(out, indent=2) + '\n', encoding='utf-8')
    print(stage, {k: round(float(v.max()), 3) for k, v in w.items()}, 'feet', feet)


def debug_image(stage, rig):
    sprite, alpha, pin, w = weight_maps(stage, rig)
    base = np.asarray(sprite.convert('L').convert('RGB'), np.float32)
    img = base * alpha[..., None] + 255 * (1 - alpha[..., None])
    for k, c in COLOURS.items():
        a = (w[k] * 0.6)[..., None]
        img = img * (1 - a) + np.array(c, np.float32) * a
    a = (pin * 0.45)[..., None]
    img = img * (1 - a)
    out = Image.fromarray(img.clip(0, 255).astype(np.uint8))
    d = ImageDraw.Draw(out)
    font = ImageFont.load_default(size=18)
    x0, y0, x1, y1 = feet_box(rig['pin'])
    d.rectangle([x0, y0, x1, y1 - 1], outline=(220, 0, 220), width=3)
    for k in BONES:
        px, py = rig['bones'][k]['pivot']
        d.ellipse([px - 9, py - 9, px + 9, py + 9], fill=(255, 255, 255), outline=(0, 0, 0), width=3)
        d.text((px + 12, py - 10), k, fill=(0, 0, 0), font=font)
    d.text((12, 10), stage, fill=(0, 0, 0), font=ImageFont.load_default(size=32))
    return out


def grid_image(stage):
    sprite = Image.open(sprite_path(stage)).convert('RGBA')
    out = Image.new('RGB', (N, N), (255, 255, 255))
    out.paste(sprite, (0, 0), sprite)
    d = ImageDraw.Draw(out)
    font = ImageFont.load_default(size=14)
    for v in range(0, N + 1, 50):
        strong = v % 100 == 0
        colour = (90, 90, 200) if strong else (190, 190, 230)
        d.line([(v, 0), (v, N)], fill=colour, width=1)
        d.line([(0, v), (N, v)], fill=colour, width=1)
        if strong:
            d.text((v + 2, 2), str(v), fill=(40, 40, 160), font=font)
            d.text((2, v + 2), str(v), fill=(40, 40, 160), font=font)
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('mode', choices=['grid', 'bake', 'debug', 'sheet'])
    ap.add_argument('--stage')
    args = ap.parse_args()
    all_rigs = rigs()
    stages = [args.stage] if args.stage else list(all_rigs)
    if args.mode == 'grid':
        SCRATCH.mkdir(parents=True, exist_ok=True)
        for s in stages:
            grid_image(s).save(SCRATCH / f'grid_{s}.png')
    elif args.mode == 'bake':
        for s in stages:
            bake(s, all_rigs[s])
    elif args.mode == 'debug':
        SCRATCH.mkdir(parents=True, exist_ok=True)
        for s in stages:
            debug_image(s, all_rigs[s]).save(SCRATCH / f'rig_{s}.png')
    else:
        tile = 384
        order = [s for s in ['hatchling', 'young', 'adult', 'illustre', 'ancestral'] if s in all_rigs]
        sheet = Image.new('RGB', (tile * 3, tile * 2), (255, 255, 255))
        for n, s in enumerate(order):
            sheet.paste(debug_image(s, all_rigs[s]).resize((tile, tile), Image.LANCZOS), ((n % 3) * tile, (n // 3) * tile))
        sheet.save(SHEET, optimize=True)
    print('done', args.mode, stages)


if __name__ == '__main__':
    main()
