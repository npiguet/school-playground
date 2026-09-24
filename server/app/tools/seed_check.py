"""Annotates every content/seed/*.json with spaCy and reports token-category counts per file.

Run: scripts/py.sh python -m app.tools.seed_check

Not part of the app or the test suite: a manual tool for the person writing seed passages,
to check that every passage has enough grammar material for the Argus/Bouclier/Chouette
passes (at least 8 `verb` tokens and 15 `nominal_group` tokens). Passages below either
minimum are flagged so they can be rewritten or cut differently.
"""
from __future__ import annotations
import json
import sys
from collections import Counter
from pathlib import Path

from app.config import Settings
from app.lexicon import load_lexicon
from app.nlp.annotate import annotate
from app.nlp.homophones import load_homophones
from app.nlp.model import get_nlp
from app.textutil import word_count

MIN_VERBS = 8
MIN_NOMINAL = 15


def check_file(path: Path, nlp, homophones, lexicon) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    body = data["body"].strip()
    annotation = annotate(body, nlp, homophones, lexicon)
    counts = Counter(cat for token in annotation["tokens"] for cat in token["categories"])
    return {
        "key": path.stem,
        "level": data.get("level", "?"),
        "words": word_count(body),
        "verbs": counts["verb"],
        "participles": counts["participle"],
        "nominal": counts["nominal_group"],
        "homophones": counts["homophone"],
        "sentences": len(annotation["sentences"]),
    }


def main() -> int:
    settings = Settings.from_env()
    seed_dir = Path(settings.content_dir) / "seed"
    files = sorted(seed_dir.glob("*.json"))
    if not files:
        print(f"No seed files found in {seed_dir}")
        return 1

    nlp = get_nlp(settings.spacy_model)
    homophones = load_homophones(settings.content_dir)
    lexicon = load_lexicon(settings.content_dir)

    print(f"{'key':40s} | {'level':5s} | {'words':>5s} | {'verbs':>5s} | "
          f"{'participles':>11s} | {'nominal':>7s} | {'homophones':>10s} | {'sentences':>9s}")

    totals_by_level: dict[str, Counter] = {}
    low: list[str] = []
    for path in files:
        row = check_file(path, nlp, homophones, lexicon)
        flag = ""
        if row["verbs"] < MIN_VERBS or row["nominal"] < MIN_NOMINAL:
            flag = "  <-- LOW"
            low.append(row["key"])
        print(f"{row['key']:40s} | {row['level']:5s} | {row['words']:5d} | {row['verbs']:5d} | "
              f"{row['participles']:11d} | {row['nominal']:7d} | {row['homophones']:10d} | "
              f"{row['sentences']:9d}{flag}")
        totals = totals_by_level.setdefault(row["level"], Counter())
        totals["files"] += 1
        totals["words"] += row["words"]
        totals["verbs"] += row["verbs"]
        totals["participles"] += row["participles"]
        totals["nominal"] += row["nominal"]
        totals["homophones"] += row["homophones"]
        totals["sentences"] += row["sentences"]

    print()
    print("Totals per level:")
    for level in sorted(totals_by_level, key=lambda lvl: (len(lvl), lvl)):
        t = totals_by_level[level]
        print(f"  {level:5s} files={t['files']:3d}  words={t['words']:5d}  verbs={t['verbs']:4d}  "
              f"participles={t['participles']:4d}  nominal={t['nominal']:4d}  "
              f"homophones={t['homophones']:3d}  sentences={t['sentences']:4d}")

    if low:
        print()
        print(f"{len(low)} passage(s) below the minimum ({MIN_VERBS} verbs / {MIN_NOMINAL} nominal groups):")
        for key in low:
            print(f"  - {key}")
        return 1

    print()
    print(f"All {len(files)} passages meet the minimum ({MIN_VERBS} verbs / {MIN_NOMINAL} nominal groups).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
