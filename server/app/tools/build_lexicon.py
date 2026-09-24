"""Builds content/lexique/lexique383-trimmed.tsv.gz from the official Lexique 3.83 zip (one-off, needs network).
Usage: scripts/py.sh python -m app.tools.build_lexicon --out /work/content/lexique/lexique383-trimmed.tsv.gz [--zip /work/tmp/Lexique383.zip]
"""
from __future__ import annotations
import argparse, csv, gzip, io, sys, urllib.request, zipfile

URL = "http://www.lexique.org/databases/Lexique383/Lexique383.zip"
COLS = ["ortho", "phon", "lemme", "cgram", "genre", "nombre", "infover", "freq"]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--zip")
    a = ap.parse_args()
    data = open(a.zip, "rb").read() if a.zip else urllib.request.urlopen(URL, timeout=120).read()
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        name = next(n for n in z.namelist() if n.lower().endswith(".tsv"))
        rows = list(csv.DictReader(io.TextIOWrapper(z.open(name), encoding="utf-8"), delimiter="\t"))
    kept = []
    for r in rows:
        if " " in r["ortho"] or not r["cgram"]:
            continue
        kept.append([r["ortho"], r["phon"], r["lemme"], r["cgram"], r["genre"], r["nombre"],
                     r["infover"].rstrip(";"), f"{float(r['freqfilms2'] or 0):.2f}"])
    kept.sort(key=lambda k: (k[0], k[2], k[3]))
    with gzip.open(a.out, "wt", encoding="utf-8", compresslevel=9, newline="") as f:
        w = csv.writer(f, delimiter="\t", lineterminator="\n")
        w.writerow(COLS)
        w.writerows(kept)
    print(f"kept {len(kept)} of {len(rows)} rows -> {a.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
