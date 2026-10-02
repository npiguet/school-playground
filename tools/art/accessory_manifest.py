"""Merge the per-lieutenant accessory manifest fragments (tools/art/overlay.py crop --manifest) into the
game's bundled manifest (spec 2026-09-29 drachmes §4, plan R16). Stdlib only; run from the repo root:
    python tools/art/accessory_manifest.py [--src assets/art/export/dragon/accessories]
It refuses a fragment that misses an item or a stage, or names an item of another lieutenant."""
import argparse
import json
from pathlib import Path

LIEUTENANTS = ["hydre", "echo", "chimere", "protee", "sirenes", "lethe"]
SLOTS = ["cou", "queue", "dos", "tete"]
STAGES = ["young", "adult", "illustre", "ancestral"]
OUT = Path("web/src/lib/world/accessories.json")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--src", default="assets/art/export/dragon/accessories")
    src = Path(ap.parse_args().src)
    out: dict = {}
    for lt in LIEUTENANTS:
        frag = json.loads((src / f"{lt}.json").read_text(encoding="utf-8"))
        stray = [k for k in frag if not k.startswith(f"{lt}-")]
        if stray:
            raise SystemExit(f"{lt}.json: {stray} belong to another lieutenant")
        for slot in SLOTS:
            item = f"{lt}-{slot}"
            if item not in frag or any(st not in frag[item] for st in STAGES):
                raise SystemExit(f"{lt}.json: {item} misses a stage (has {sorted(frag.get(item, {}))})")
            out[item] = {st: {k: frag[item][st][k] for k in ("src", "x", "y", "w", "h")} for st in STAGES}
    OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{OUT}: {len(out)} items, {sum(len(v) for v in out.values())} overlays")


if __name__ == "__main__":
    main()
