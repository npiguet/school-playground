"""How many texts each class can play, before and after the verb-tense rule (app.nlp.tenses).

Run: scripts/py.sh python -m app.tools.tense_levels [--db PATH] [--least N] [--verbose]

The seed passages (content/seed) are annotated with the configured spaCy model (SPACY_MODEL; the
production image's fr_dep_news_trf gives the production answer, the dev image's fr_core_news_sm a
close one). The Bibliothèque d'Alexandrie's candidate pool is fetched from Wikisource and Gutenberg,
so offline it can only be the scrolls a database has already cached: `--db` reads the online_chunk
rows (and the texts other than the seed ones) of a discorde.sqlite3, from their stored annotation.

Prints, per class 5H...11H, the number of texts at or below that class before and after the rule,
and the tenses that raised texts most often. Not part of the app or the test suite.
"""
from __future__ import annotations

import argparse
import json
import sqlite3
from collections import Counter
from pathlib import Path

from app.config import Settings
from app.levels import LEVELS, level_index
from app.lexicon import load_lexicon
from app.nlp.tenses import MIN_OCCURRENCES, TENSES, level_with_tenses, tense_forms, tense_level


def _tenses(annotation: dict, lexicon) -> dict:
    forms = tense_forms(annotation, lexicon)
    return {"counts": dict(Counter(key for key, _ in forms)), "forms": forms}


def _seed_rows(settings: Settings, lexicon) -> list[dict]:
    from app.nlp.annotate import annotate
    from app.nlp.homophones import load_homophones
    from app.nlp.model import get_nlp
    nlp = get_nlp(settings.spacy_model)
    homophones = load_homophones(settings.content_dir)
    rows = []
    for path in sorted((Path(settings.content_dir) / "seed").glob("*.json")):
        d = json.loads(path.read_text(encoding="utf-8"))
        annotation = annotate(d["body"].strip(), nlp, homophones, lexicon)
        rows.append({"pool": "seed", "key": path.stem, "base": d["level"], **_tenses(annotation, lexicon)})
    return rows


def _db_rows(db: Path, lexicon) -> list[dict]:
    conn = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    rows = []

    def base_of(r: sqlite3.Row) -> str:
        return r["base_level"] if "base_level" in r.keys() and r["base_level"] else r["level"]

    for r in conn.execute("SELECT * FROM online_chunk ORDER BY work_id, seq"):
        rows.append({"pool": "alexandria", "key": f"{r['work_id']}#{r['seq']}", "base": base_of(r),
                     **_tenses(json.loads(r["annotation_json"]), lexicon)})
    for r in conn.execute("SELECT * FROM text WHERE source NOT IN ('seed', 'online') ORDER BY id"):
        rows.append({"pool": r["source"], "key": f"text {r['id']}", "base": base_of(r),
                     **_tenses(json.loads(r["annotation_json"]), lexicon)})
    conn.close()
    return rows


def _table(rows: list[dict], least: int) -> list[str]:
    pools = sorted({r["pool"] for r in rows}, key=lambda p: (p != "seed", p))
    head = "| Class | " + " | ".join(f"{p} before | {p} after" for p in pools)
    head += " | all before | all after |" if len(pools) > 1 else " |"
    lines = [head, "|" + "---|" * (head.count("|") - 1)]
    for level in LEVELS:
        cells = []
        for group in [[r for r in rows if r["pool"] == p] for p in pools] + ([rows] if len(pools) > 1 else []):
            before = sum(1 for r in group if level_index(r["base"]) <= level_index(level))
            after = sum(1 for r in group
                        if level_index(level_with_tenses(r["base"], r["counts"], least)) <= level_index(level))
            cells += [str(before), str(after)]
        lines.append(f"| {level} | " + " | ".join(cells) + " |")
    return lines


def _reasons(rows: list[dict], least: int) -> Counter:
    """For each raised text, the tenses at its new class (the ones that raised it)."""
    reasons: Counter = Counter()
    for r in rows:
        after = level_with_tenses(r["base"], r["counts"], least)
        if after != r["base"]:
            for k, (lv, label) in TENSES.items():
                if lv == after and r["counts"].get(k, 0) >= least:
                    reasons[label] += 1
    return reasons


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--db", type=Path, help="a discorde.sqlite3 whose cached Alexandria scrolls to count")
    parser.add_argument("--least", type=int, default=MIN_OCCURRENCES,
                        help=f"occurrences of a tense that raise a text (default {MIN_OCCURRENCES})")
    parser.add_argument("--verbose", action="store_true", help="one line per text")
    args = parser.parse_args()

    settings = Settings.from_env()
    lexicon = load_lexicon(settings.content_dir)
    rows = _seed_rows(settings, lexicon)
    if args.db:
        rows += _db_rows(args.db, lexicon)

    print(f"Texts at or below each class (model {settings.spacy_model}, a tense counts from "
          f"{args.least} unambiguous form{'s' if args.least > 1 else ''}):\n")
    print("\n".join(_table(rows, args.least)))
    raised = sum(1 for r in rows if level_with_tenses(r["base"], r["counts"], args.least) != r["base"])
    print(f"\n{raised} of {len(rows)} texts raised. Raising tenses (a text may have several):")
    for label, n in _reasons(rows, args.least).most_common():
        print(f"  {n:4d}  {label}")
    if args.verbose:
        print()
        for r in rows:
            after = level_with_tenses(r["base"], r["counts"], args.least)
            mark = " <-- raised" if after != r["base"] else ""
            print(f"{r['pool']:10s} {r['key']:40s} {r['base']:>3s} -> {after:>3s} "
                  f"(tenses {tense_level(r['counts'], args.least) or '5H'}){mark}")
            for key, form in r["forms"]:
                print(f"      {TENSES[key][1]:36s} {form}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
