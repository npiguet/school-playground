"""The living figures' rigs: the dragon's stages and the battle's foes (the dragon-rig skill; spec
2026-10-02 living dragon, plan Rulings R1, R6; spec 2026-10-03 living battle, plan Rulings B1-B3).

    tools/art/run_docker.sh rig grid  [--stage K]   # tools/art/rig-out/grid_<K>.png: the sprite in its frame under a 50 px grid
    tools/art/run_docker.sh rig bake  [--stage K]   # web/src/lib/living/rig/dragon_<K>.json or foe_<K>.json (the game's weights)
    tools/art/run_docker.sh rig debug [--stage K]   # tools/art/rig-out/rig_<K>.png: weights, pivots, feet box
    tools/art/run_docker.sh rig sheet               # docs/art/dragon-rig.png: the dragon stages' debug views, for the record
    tools/art/run_docker.sh rig foe-sheet           # docs/art/foe-rig.png: the foes' debug views, for the record

K is a key of tools/art/rig.json: a dragon stage (hatchling, young, adult, illustre, ancestral) or a
foe (eris, eris_flustered, hydre, chimere, echo, lethe, protee, sirenes). A foe's block names its
sprite ("sprite", repo-relative); a portrait narrower than the frame (the foes' 585 x 1024) is padded,
centred, into the 1024 frame, at (1024 - w) // 2 as web/src/lib/living/skin.ts frameOffset, so the
mesh, the margin and everything below work unchanged. Each rig has six bones in its block's key order:
four rigid ones, then chest and lift.

Per bone: its region (a polygon, several polygons, an ellipse, or the whole frame) rasterised inside
the sprite's opaque pixels, times an optional ramp (along y, or by distance from the pivot), pushed into
the transparent background by nearest-opaque-pixel fill (so mesh triangles straddling the outline move
with the part and do not shear its edge), then Gaussian-blurred. The four rigid bones are normalised so
their sum stays <= 1; everything is multiplied by (1 - pin), and every vertex inside the feet box (the
pin rectangle inset by 3 x its blur, down to the bottom) is hard-zeroed. The weights are sampled at the
65 x 65 vertices of the game's mesh: bytes[(j * 65 + i) * 6 + b], vertex (i, j) at (16 i, 16 j).
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
DRAGON_SPRITE = 'web/public/art/dragon/dragon_{key}_cut.webp'
DRAGON_STAGES = ['hatchling', 'young', 'adult', 'illustre', 'ancestral']
BAKED = REPO / 'web/src/lib/living/rig'
SCRATCH = REPO / 'tools/art/rig-out'
SHEET = REPO / 'docs/art/dragon-rig.png'
FOE_SHEET = REPO / 'docs/art/foe-rig.png'
N = 1024
GRID = 64
CELL = N // GRID
BREATH = ['chest', 'lift']
# The rigid slots' colours on the debug view: slot 0 red, 1 green, 2 blue, 3 yellow (the dragon's head,
# left wing, right wing, tail).
SLOT_COLOURS = [(255, 60, 60), (60, 200, 60), (60, 120, 255), (255, 200, 0)]
yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)


def rigs():
    data = json.loads(RIG_FILE.read_text(encoding='utf-8'))
    return {k: v for k, v in data.items() if not k.startswith('_')}


def is_dragon(key):
    return key in DRAGON_STAGES


def sprite_path(key, rig):
    return REPO / rig.get('sprite', DRAGON_SPRITE.format(key=key))


def bones_of(key, rig):
    names = list(rig['bones'])
    if len(names) != 6 or names[4:] != BREATH:
        raise SystemExit(f'{key}: six bones, four rigid ones then chest and lift, not {names}')
    return names


def source_hash(key, rig):
    canon = json.dumps(rig, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
    h = hashlib.sha256(canon.encode('utf-8'))
    h.update(b'\n')
    h.update(sprite_path(key, rig).read_bytes())
    return h.hexdigest()


def load_sprite(key, rig):
    """The sprite in the 1024 frame and its own width: a narrower portrait padded, centred."""
    im = Image.open(sprite_path(key, rig)).convert('RGBA')
    w, h = im.size
    if h != N or not 0 < w <= N:
        raise SystemExit(f'{key}: the sprite is {w} x {h}; the frame wants {N} px high and at most {N} wide')
    if w == N:
        return im, w
    frame = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    frame.paste(im, ((N - w) // 2, 0))
    return frame, w


def painted(spec):
    return 'poly' in spec or 'polys' in spec or 'ellipse' in spec or bool(spec.get('all'))


def raster(spec):
    im = Image.new('L', (N, N), 0)
    d = ImageDraw.Draw(im)
    if 'poly' in spec:
        d.polygon([tuple(p) for p in spec['poly']], fill=255)
    elif 'polys' in spec:
        for poly in spec['polys']:
            d.polygon([tuple(p) for p in poly], fill=255)
    elif 'ellipse' in spec:
        cx, cy, rx, ry = spec['ellipse']
        d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=255)
    elif 'rect' in spec:
        d.rectangle(spec['rect'], fill=255)
    elif spec.get('all'):
        d.rectangle([0, 0, N, N], fill=255)
    return np.asarray(im, np.float32) / 255


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def blur(a, r):
    return a if r <= 0 else ndimage.gaussian_filter(a.astype(np.float32), r, mode='nearest')


def feet_box(pin):
    x0, y0, x1, _ = pin['rect']
    inset = 3 * pin['blur']
    return [math.ceil((x0 + inset) / CELL) * CELL, math.ceil((y0 + inset) / CELL) * CELL, math.floor((x1 - inset) / CELL) * CELL, N]


def weight_maps(key, rig):
    sprite, width = load_sprite(key, rig)
    bones = bones_of(key, rig)
    alpha = np.asarray(sprite, np.float32)[..., 3] / 255
    opaque = alpha > 0.05
    _, (iy, ix) = ndimage.distance_transform_edt(~opaque, return_indices=True)
    pin = blur(raster(rig['pin']), rig['pin']['blur'])
    w = {}
    for name in bones:
        b = rig['bones'][name]
        if not painted(b):
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
    rigid = bones[:4]
    over = np.maximum(sum(w[k] for k in rigid), 1)
    for k in rigid:
        w[k] = w[k] / over
    return sprite, width, alpha, pin, w, bones


def vertex_bytes(w, bones, feet):
    idx = np.minimum(np.arange(GRID + 1) * CELL, N - 1)
    per = np.stack([w[k][np.ix_(idx, idx)] for k in bones], -1)  # [row j, column i, bone]
    q = np.clip(np.round(per * 255), 0, 255).astype(np.uint8)
    v = np.arange(GRID + 1) * CELL
    x0, y0, x1, _ = feet
    inside = (v[:, None] >= y0) & (v[None, :] >= x0) & (v[None, :] <= x1)
    q[inside] = 0
    return q.tobytes()


def bake(key, rig):
    _, width, _, _, w, bones = weight_maps(key, rig)
    feet = feet_box(rig['pin'])
    out = {'stage': key, 'source': source_hash(key, rig), 'grid': GRID}
    if not is_dragon(key):
        out['width'] = width
    out['pivots'] = {k: rig['bones'][k]['pivot'] for k in bones}
    out['feet'] = feet
    out['weights'] = base64.b64encode(vertex_bytes(w, bones, feet)).decode('ascii')
    BAKED.mkdir(parents=True, exist_ok=True)
    name = f'dragon_{key}.json' if is_dragon(key) else f'foe_{key}.json'
    (BAKED / name).write_text(json.dumps(out, indent=2) + '\n', encoding='utf-8')
    print(key, {k: round(float(v.max()), 3) for k, v in w.items()}, 'feet', feet)


def debug_image(key, rig):
    sprite, _, alpha, pin, w, bones = weight_maps(key, rig)
    base = np.asarray(sprite.convert('L').convert('RGB'), np.float32)
    img = base * alpha[..., None] + 255 * (1 - alpha[..., None])
    for k, c in zip(bones[:4], SLOT_COLOURS):
        a = (w[k] * 0.6)[..., None]
        img = img * (1 - a) + np.array(c, np.float32) * a
    a = (pin * 0.45)[..., None]
    img = img * (1 - a)
    out = Image.fromarray(img.clip(0, 255).astype(np.uint8))
    d = ImageDraw.Draw(out)
    font = ImageFont.load_default(size=18)
    x0, y0, x1, y1 = feet_box(rig['pin'])
    d.rectangle([x0, y0, x1, y1 - 1], outline=(220, 0, 220), width=3)
    for k in bones:
        px, py = rig['bones'][k]['pivot']
        d.ellipse([px - 9, py - 9, px + 9, py + 9], fill=(255, 255, 255), outline=(0, 0, 0), width=3)
        d.text((px + 12, py - 10), k, fill=(0, 0, 0), font=font)
    d.text((12, 10), key, fill=(0, 0, 0), font=ImageFont.load_default(size=32))
    legend = ImageFont.load_default(size=20)
    for i, (k, c) in enumerate(zip(bones[:4], SLOT_COLOURS)):
        d.text((12, 50 + 24 * i), k, fill=c, font=legend)
    return out


def grid_image(key, rig):
    sprite = load_sprite(key, rig)[0]
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
    ap.add_argument('mode', choices=['grid', 'bake', 'debug', 'sheet', 'foe-sheet'])
    ap.add_argument('--stage', help='a rig key: a dragon stage or a foe')
    args = ap.parse_args()
    all_rigs = rigs()
    if args.stage and args.stage not in all_rigs:
        raise SystemExit(f'no rig {args.stage} in {RIG_FILE.name}: {", ".join(all_rigs)}')
    keys = [args.stage] if args.stage else list(all_rigs)
    if args.mode == 'grid':
        SCRATCH.mkdir(parents=True, exist_ok=True)
        for k in keys:
            grid_image(k, all_rigs[k]).save(SCRATCH / f'grid_{k}.png')
    elif args.mode == 'bake':
        for k in keys:
            bake(k, all_rigs[k])
    elif args.mode == 'debug':
        SCRATCH.mkdir(parents=True, exist_ok=True)
        for k in keys:
            debug_image(k, all_rigs[k]).save(SCRATCH / f'rig_{k}.png')
    elif args.mode == 'sheet':
        tile = 384
        order = [s for s in DRAGON_STAGES if s in all_rigs]
        sheet = Image.new('RGB', (tile * 3, tile * 2), (255, 255, 255))
        for n, s in enumerate(order):
            sheet.paste(debug_image(s, all_rigs[s]).resize((tile, tile), Image.LANCZOS), ((n % 3) * tile, (n // 3) * tile))
        sheet.save(SHEET, optimize=True)
    else:
        # The foes' portraits, each cropped to its column of the frame (20 px either side), four a row.
        th = 512
        order = [k for k in all_rigs if not is_dragon(k)]
        tiles = []
        for k in order:
            img = debug_image(k, all_rigs[k])
            w = load_sprite(k, all_rigs[k])[1]
            x0 = max(0, (N - w) // 2 - 20)
            crop = img.crop((x0, 0, min(N, x0 + w + 40), N))
            tiles.append(crop.resize((round(crop.width * th / N), th), Image.LANCZOS))
        tw = max((t.width for t in tiles), default=1)
        rows = max(1, math.ceil(len(tiles) / 4))
        sheet = Image.new('RGB', (tw * 4, th * rows), (255, 255, 255))
        for n, t in enumerate(tiles):
            sheet.paste(t, ((n % 4) * tw, (n // 4) * th))
        sheet.save(FOE_SHEET, optimize=True)
    print('done', args.mode, keys)


if __name__ == '__main__':
    main()
