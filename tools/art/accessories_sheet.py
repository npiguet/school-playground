"""tools/art/accessories_sheet.py LT OUT (run from the repo root): contact sheet of <lt>'s accessories: 4 item rows (zoom on the item, bronze stage) x 4
stages, then all four worn on the bronze stage, then all four on a tinted stage (ecume, braise, argent, jade)."""
import sys
from pathlib import Path
from PIL import Image, ImageDraw
sys.path.insert(0, "tools/art")
from overlay import tint

lt, out = sys.argv[1], sys.argv[2]
STAGES = ["young", "adult", "illustre", "ancestral"]
SLOTS = ["cou", "queue", "dos", "tete"]  # rows; the game draws queue, dos, cou, tete
ORDER = ["queue", "dos", "cou", "tete"]
TINTS = ["ecume", "braise", "argent", "jade"]
C = 300
G = (236, 223, 193)
A = Path("assets/art/dragon")
sheet = Image.new("RGB", (C * 4 + 90, C * 6 + 30), (40, 36, 44))
d = ImageDraw.Draw(sheet)
for j, st in enumerate(STAGES):
    d.text((90 + j * C + 6, 8), st, fill=(255, 255, 255))
    cut = Image.open(A / f"dragon_{st}_cut.png").convert("RGBA")
    ovs = {s: Image.open(A / "accessories" / f"{lt}-{s}_{st}.png").convert("RGBA") for s in SLOTS
           if (A / "accessories" / f"{lt}-{s}_{st}.png").exists()}
    for i, s in enumerate(SLOTS):
        if s not in ovs:
            d.text((90 + j * C + 100, 30 + i * C + C // 2), "not made yet", fill=(255, 255, 255))
            continue
        tile = Image.new("RGBA", cut.size, G + (255,))
        tile.alpha_composite(cut)
        tile.alpha_composite(ovs[s])
        l, t, r, b = ovs[s].getchannel("A").getbbox()
        cx, cy, h = (l + r) / 2, (t + b) / 2, max(r - l, b - t) / 2 + 40
        big = Image.new("RGBA", (tile.width + 400, tile.height + 400), G + (255,))
        big.paste(tile, (200, 200))
        z = big.crop((round(cx - h) + 200, round(cy - h) + 200, round(cx + h) + 200, round(cy + h) + 200)).convert("RGB").resize((C, C), Image.LANCZOS)
        sheet.paste(z, (90 + j * C, 30 + i * C))
    for k, base in enumerate([cut, tint(cut, TINTS[j])]):
        tile = Image.new("RGBA", cut.size, G + (255,))
        tile.alpha_composite(base)
        for s in ORDER:
            if s in ovs:
                tile.alpha_composite(ovs[s])
        sheet.paste(tile.convert("RGB").resize((C, C), Image.LANCZOS), (90 + j * C, 30 + (4 + k) * C))
for i, name in enumerate(SLOTS + ["all, bronze", "all, tinted"]):
    d.text((6, 30 + i * C + C // 2), name, fill=(255, 255, 255))
for j, tn in enumerate(TINTS):
    d.text((90 + j * C + 6, 30 + 5 * C + 6), tn, fill=(40, 36, 44))
sheet.save(out)
print(out)
