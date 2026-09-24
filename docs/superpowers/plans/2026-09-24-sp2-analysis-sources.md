# La Discorde — SP2 "Analysis and text sources" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the analysis smarter and the text supply richer: agreement chains with confidence flags from the dependency parse (better subcategories, better explanations, the *Fil d'Ariane* tool), a vendored Lexique 3.83 lexicon (inflected forms, sound-alikes, 1990 spelling-reform variants accepted by grading), in-game scanning of printed handouts (Tesseract `fra`), the *Grimoire corrompu* proofreading-only mode with errors planted by Éris, and the *Bibliothèque d'Alexandrie* (Wikisource FR / Project Gutenberg allowlist, cleaned, filtered, chunked, scored, cached).

**Architecture:** Same single container as SP1. The server (FastAPI) gains: a lexicon module built from a trimmed Lexique 3.83 file vendored in `content/lexique/`; annotation v2 (`chains`, `forms`, `sound_alikes` per token) produced by the same spaCy pipeline and re-applied at startup to outdated texts; an OCR endpoint (Pillow + Tesseract) that stores the original photos under `/data/scans/`; a corruption engine (`/api/texts/{id}/corrupt`) that mutates a correct text using the lexicon and the homophone table, weighted by the profile's weak categories; and an `alexandria` package that fetches allowlisted works (or reads offline fixtures), cleans, chunks, filters, scores and caches them in SQLite. The client (Svelte 5) extends the pure grading engine (reform-1990 canonicalisation, lexicon forms → agreement subcategories, sound-alike lexical errors), the explanations (chain-aware templates), the proofreading screen (Fil d'Ariane), and adds three flows: scan → verify → save, Grimoire corrompu → proofreading → results, Alexandria works → scrolls → adopt. The reference text remains the only answer key; annotation and chains only decide what to highlight, classify and explain.

**Tech Stack:** FastAPI, Python 3.12, stdlib `sqlite3` + numbered SQL migrations, spaCy 3.8 (`fr_core_news_lg` in prod, `fr_core_news_sm` in tests), Pillow, pytesseract + Tesseract 5 (`tesseract-ocr-fra`, apt), httpx, python-multipart, pytest; Svelte 5 (runes) + TypeScript + Vite 7, vitest, Playwright 1.55.0 (`mcr.microsoft.com/playwright:v1.55.0-noble`); Docker Compose; TrueNAS SCALE 25.10 target.

**Spec:** `docs/superpowers/specs/2026-09-23-la-discorde-design.md` — the binding authority. Read §1, §3.2, §3.4 (Fil d'Ariane), §3.5, §4 and §5 (SP2) before starting any task. Where this plan and the spec disagree, the spec wins; where the spec is silent, this plan's "Decisions" section wins. The SP1 plan (`docs/superpowers/plans/2026-09-23-sp1-foundations-core-loop.md`) documents the code you extend; its "Decisions" remain in force unless overridden below.

## Global Constraints

- **Language:** "The UI and all game text are in French. Code, comments, docs and commits are in English." (spec §0)
- **Pedagogy (spec §1):** "The reference text is always the answer key." NLP "is used only to decide what to highlight, how to classify an error and how to explain it — never to decide what is correct. When NLP is uncertain, the game skips the feature for that word rather than risk teaching something wrong." "No red crosses, no buzzers, no lives, nothing can be lost. [...] Orange rather than red." Error mix "~60% agreement [...] ~40% lexical spelling and grammatical homophones."
- **Fil d'Ariane (spec §3.4):** "tap a verb, then its subject; checked against the dependency parse only when the parse is high-confidence."
- **Public domain (spec §3.2):** "author and translator died before 1956 (Swiss law: life + 70 years). If unknown → reject."
- **Scan (spec §3.2, §5):** "photo of a printed handout + OCR, verified by the child"; "The original photo of a scanned handout is stored in the data volume." Camera capture "uses `<input type="file" accept="image/*" capture="environment">`, which works over HTTP." Printed handouts only — never handwriting.
- **Texts:** "Numbers must be written as words in texts." (spec §3.3). Chunks from online sources are 80–200 words (spec §5).
- **Toolchain (spec §4):** "All toolchains run in Docker [...]. Do not install software on the host." Windows 11 + Docker Desktop + Git Bash; host Python 3.14 is never used for the server. Every command goes through `scripts/*.sh`.
- **Deployment (spec §4):** single container, `compose.yaml`, port `8080`, `/data` volume, TrueNAS SCALE 25.10, plain HTTP. "No external API calls at runtime except, from SP2, Wikisource/Gutenberg fetching (server-side, cached). No API keys. No trackers."
- **Tests never hit the network.** Lexicon, OCR and online-source tests use committed fixtures under `server/tests/fixtures/`.
- **Commits:** every task commits its own work on branch `grimoire`, **always with a pathspec** because parallel agents share the index (ledger ruling): `git add <paths> && git commit -m "..." -- <paths>`. End every commit message with the attribution trailer your harness gives you (e.g. `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`).
- **Verification:** before claiming a task done, run the task's test command through the wrapper scripts and paste the actual output in your report. `scripts/check.sh` is enforced at lane joins (after Task 5 + Task 10, and at Task 11) — see "Lanes".

## Decisions taken by this plan (nobody was available to ask; do not re-ask)

1. **Lexique 3.83 is vendored as a trimmed derived file**, `content/lexique/lexique383-trimmed.tsv.gz` (8 columns: `ortho phon lemme cgram genre nombre infover freq`, ~140k rows, ≈2 MB gzipped), generated by `server/app/tools/build_lexicon.py` from the official zip and committed with `content/lexique/LICENSE.md` (CC BY-SA 4.0 attribution to New, Pallier, Brysbaert & Ferrand, link to lexique.org, description of the transformation). Rationale: the official download host has been intermittently unavailable, the build must be reproducible offline, tests need the real data without network, and the derived file is small. CC BY-SA is satisfied by attribution + the derived file staying under the same licence (stated in LICENSE.md). The image copies `content/` already; no download at build.
2. **Annotation v2** adds, per token, `forms` (sibling inflections from the lexicon with `g`/`n` features), `sound_alikes` (same pronunciation, different spelling, frequent), `chains` (ids), and a top-level `chains` list. `ANNOTATION_VERSION = 2`. At startup, texts whose stored `annotation_json.version < 2` are re-annotated (bounded work: dozens of texts).
3. **Confidence is derived from internal consistency of the parse on the correct reference text**: a chain is `high` only when the parse and the morphology agree with each other (e.g. the verb's `Number` equals the subject's `Number`) and the structure is simple (distance ≤ 8 tokens, no coordination, no relative pronoun); `medium` when consistent but structurally harder (coordination, `qui`, distance > 8, participle with avoir); `low` otherwise. Fil d'Ariane uses only `high`; explanations use `high` and `medium`; `low` chains are ignored (SP1 templates apply).
4. **Irregular forms are classified client-side using the annotation's `forms` map**, not by shipping the lexicon to the browser. `forms` covers the reference token only; the typed word is looked up in it. The SP1 `GENDER_PAIRS` table remains as a fallback when there is no annotation.
5. **1990 spelling-reform variants are accepted by canonicalisation in the tokenizer** (`norm` = reform-canonical form of the normalised word; number-word hyphens canonicalised at string level with unchanged offsets). Both the traditional and the reformed spelling grade as correct; explanations always quote the reference text as written. Data: `content/reform1990.json` (explicit pairs + `-eler/-eter` stems) plus two rules in code (circumflex on i/u with a protected list; number-word hyphens).
6. **Lexical sound-alikes stay in the `lexical` category** (Écho is grammatical homophones only) with `sub: 'sound_alike'` and a dedicated explanation; they still feed mots-pièges.
7. **Scan endpoint is synchronous** (`POST /api/scan`, multipart, ≤ 5 photos, ≤ 12 MB each, JPEG/PNG/WEBP only — iPad Safari converts HEIC to JPEG for `<input type=file>`); Tesseract `--psm 6`, images EXIF-rotated, greyscale, long side resized to 2200 px, autocontrast. Originals are stored untouched under `/data/scans/<scan_id>/page-<n>.<ext>`; a text created with `source: 'scan'` and `scan_id` gets `photo_path = scans/<scan_id>`; a startup sweep deletes scan folders older than 24 h that no text references. Low-confidence words (Tesseract `conf < 60`) are returned so the verification screen can point at them.
8. **Grimoire corrompu is generated server-side** (`POST /api/texts/{id}/corrupt`), because it needs the lexicon, the annotation and the profile's stats. Plant count = `clamp(round(words / 18), 4, 12)`. Category weights = base mix (agreement 0.60: verb .20, number .15, gender .10, participle .15; homophone .25; lexical .10; accent .05) × `(1.25 − catch_rate)` (missing stats → catch_rate 0.5). Participle mutations only for levels ≥ 8H. Deterministic with an optional `seed`. The corrupted text is the session's `draft`, the original is the reference; `session.mode = 'grimoire'`, `pace_level = 1`. Grimoire sessions feed stats and trap words but **do not move the help stage** (they are deliberately weighted toward weaknesses).
9. **Alexandria allowlist is a JSON file** (`content/alexandria/works.json`) listing, per work, explicit Wikisource page titles (or a Gutenberg ebook id), author/translator death years, and a level hint. The loader rejects any entry with a missing death year or ≥ 1956. Homer/Bérard is excluded (SP1 established that no clean transcription exists on Wikisource; Leconte de Lisle is rejected by spec). Poe/Baudelaire is limited to non-gory tales.
10. **Fetching is pluggable**: `HttpFetcher` (httpx, 20 s per page, Wikimedia-compliant User-Agent, ≤ 40 pages per work) or `OfflineFetcher` (reads `<dir>/wikisource/<slug>.html` and `<dir>/gutenberg/pg<id>.txt`) selected by env `DISCORDE_ALEXANDRIA_OFFLINE_DIR`. pytest and the e2e compose use the offline fetcher on committed fixtures; a missing fixture file behaves like a network error so the graceful path is tested too. Partial success (some pages failed) keeps the fetched chunks and reports a note.
11. **Chunk levels are computed**, never below the work's `level_hint`: thresholds on mean sentence length and rare-word ratio (Task 5). Score = agreement density (chain targets per 100 words, confidence ≥ medium).
12. **Routes**: `#/p/:profileId/texts/scan`, `#/p/:profileId/grimoire/:textId`, `#/p/:profileId/alexandria`, `#/p/:profileId/alexandria/:workId`. The library FAB opens a three-entry menu (type/paste, scan, Alexandria). The Grimoire is offered on the play intro screen of any text.
13. **Deferred SP1 minors absorbed here**: pytest `TestClient` deprecation warning filter (Task 1); `Homophones.words/hint` raising `StopIteration` on unknown ids (Task 2); duplicated text JOIN SQL + missing 4000-char body test (Task 3); SPA static guard `startswith` → `Path.is_relative_to` (Task 3); non-discriminating up/down help-stage test (Task 4); Unicode hyphen U+2010 splitting tokens (Task 6).
14. **Dates** are shown Swiss-style `dd.mm.yyyy`; a text with `due_date ≥ today` is a *prophétie* (shown first in the library under `Prophéties de l'Oracle` and mentioned on the play intro). SP3's Oracle builds on this.

## Lanes (parallel execution)

Two lanes with disjoint files; the controller runs them concurrently. Within a lane, tasks are sequential.

| Lane | Tasks | Notes |
|---|---|---|
| **Server** | 1 → 2 → 3 → 4 → 5 | Task 3 (scan) may start right after Task 1 if Task 2 is still under review — it touches different files except `main.py` (rebase on the lane head before committing). |
| **Web** | 6 → 7 → 8 → 9 → 10 | Task 6 depends only on the annotation v2 *shape* (defined in "Shared contracts"), not on server code. Task 7 requires SP1 Tasks 11–12 (Proofreading/Results) to be in the tree. Tasks 9 and 10 need Tasks 4 and 5 only at e2e time. |
| **Joint** | 11 → 12 | Start after both lanes are complete. |

`scripts/check.sh` must be `== ALL GREEN` after Task 5, after Task 10, and at Task 11 (ledger ruling: enforced at lane joins).

## Shared contracts (both lanes code against these; do not drift)

### Annotation v2 (server produces, client consumes)

```jsonc
{
  "version": 2, "model": "core_news_lg",
  "tokens": [ { "i": 1, "text": "fées", "start": 4, "end": 8, "lemma": "fée", "pos": "NOUN",
      "morph": {"Gender": "Fem", "Number": "Plur"}, "head": 2, "dep": "nsubj",
      "categories": ["nominal_group"], "homophone": null, "subject": null,        // SP1 fields unchanged
      "forms": {"fée": {"g": "f", "n": "s"}},                                    // NEW: sibling inflections (≤ 12), lowercase, never the token itself
      "sound_alikes": ["fée"],                                                   // NEW: ≤ 5 frequent same-phon words, excluding forms and homophone-set members
      "chains": [0, 1] } ],                                                      // NEW: ids of chains where this token is controller or target
  "sentences": [ {"start": 0, "end": 35} ],
  "chains": [ { "id": 0, "kind": "subject_verb",      // 'subject_verb' | 'nominal' | 'attribute' | 'participle_etre' | 'participle_avoir'
      "controller": 1, "controller_group": [0, 1],    // token that dictates agreement; its det/adj group (contiguous ids, includes controller)
      "targets": [2],                                  // tokens that must agree with the controller
      "via": null,                                     // null | 'qui' | 'conj' | 'aux'
      "via_token": null,                               // the 'qui' token id when via == 'qui'
      "features": {"Number": "Plur", "Person": "3"},   // from the controller; Gender when known
      "confidence": "high",                            // 'high' | 'medium' | 'low'
      "distance": 1,                                   // |target - controller| in tokens (min over targets)
      "rule": null } ]                                 // participle_avoir only: 'no_agreement' | 'cod_before'
}
```

### API additions

| Method & path | Body → response |
|---|---|
| `POST /api/scan` (multipart, field `photos`, 1–5 files) | → `201 {scan_id, pages: [{index, text, low_confidence: [string], width, height}], text}` |
| `GET /api/scan/{scan_id}/page/{n}` | → the original photo bytes (image/*) |
| `POST /api/texts` | `TextCreate` now accepts `source: 'custom' | 'scan'` and `scan_id` (required when `scan`) |
| `POST /api/texts/{id}/corrupt` | `{profile_id, seed?}` → `200 {text_id, corrupted, count, plants: [{token, start, end, original, mutated, category}]}`; `422` when < 3 plants possible |
| `POST /api/sessions` | `SessionCreate.mode: 'dictation' | 'grimoire'` (default `'dictation'`) |
| `GET /api/alexandria/works` | → `[{id, title, author, translator, credits, level_hint, source, status: 'never'|'ok'|'error', fetched_at, error, chunk_count}]` |
| `POST /api/alexandria/works/{id}/refresh` | → `200 {status, error, chunk_count, rejected: {reason: n}}` (never 5xx on network failure) |
| `GET /api/alexandria/works/{id}/chunks?level=8H` | → `[{id, seq, level, word_count, score, preview, text_id}]` sorted by score desc |
| `POST /api/alexandria/chunks/{chunk_id}/adopt` | `{profile_id, title?}` → `201 TextFull` (source `online`) or `200 TextFull` if already adopted |

`TextSummary` gains `scan_id: string | null` (derived from `photo_path`) and `photo_count: number`. `StatsResponse.recent_sessions[].mode` is added.

## File structure

```
content/lexique/lexique383-trimmed.tsv.gz    vendored derived lexicon (Task 1)
content/lexique/LICENSE.md, README.md         attribution, build instructions
content/reform1990.json                       explicit reform pairs + -eler/-eter stems (Task 6; read by TS via @content)
content/alexandria/works.json                 allowlist (Task 5)
server/app/lexicon.py                         Lexicon class, load_lexicon(), verb_code(), DET tables (Task 1)
server/app/tools/build_lexicon.py             official zip → trimmed gz (Task 1)
server/app/nlp/chains.py                      build_chains(tokens) (Task 2)
server/app/nlp/annotate.py                    v2: forms, sound_alikes, chains (Task 2)
server/app/reannotate.py                      re-annotate outdated texts at startup (Task 2)
server/app/ocr.py                             preprocess(), assemble(), clean_ocr_text(), run_tesseract() (Task 3)
server/app/routers/scan.py                    POST /api/scan, GET page (Task 3)
server/app/tools/make_scan_fixture.py         renders the fixture handout images (Task 3)
server/app/corrupt.py                         plan_corruptions(), apply_plants(), category_weights() (Task 4)
server/app/migrations/002_session_mode.sql    (Task 4)
server/app/migrations/003_alexandria.sql      (Task 5)
server/app/alexandria/{allowlist,fetch,clean,chunk,filters,score,service}.py  (Task 5)
server/app/routers/alexandria.py              (Task 5)
server/app/tools/alexandria_check.py          live allowlist verifier (Task 5, manual use only)
server/tests/fixtures/scan/handout.png, handout-rotated.jpg
server/tests/fixtures/alexandria/wikisource/*.html, gutenberg/pg99999.txt
web/src/lib/grading/reform.ts                 reformCanon(), numberHyphensToSpaces() (Task 6)
web/src/lib/chains.ts                         chain lookup helpers for the client (Task 7)
web/src/lib/fil.ts                            Fil d'Ariane state machine (pure) (Task 7)
web/src/lib/dates.ts                          formatSwissDate(), isProphecy() (Task 8)
web/src/components/AddMenu.svelte             three-entry add menu (Task 8)
web/src/screens/ScanText.svelte               capture → verify → details (Task 8)
web/src/screens/Alexandria.svelte, AlexandriaWork.svelte  (Task 10)
web/e2e/scan.spec.ts, grimoire.spec.ts, alexandria.spec.ts, playability-sp2.spec.ts
docs/reviews/sp2/*.png, docs/reviews/sp2/playability.md
```

Conventions (unchanged from SP1): levels `['5H','6H','7H','8H','9H','10H','11H']`; stat keys `agreement:verb|participle|number|gender|other`, `homophone`, `accent`, `punctuation_case`, `lexical`; timestamps ISO 8601 UTC; days `YYYY-MM-DD`.

---

### Task 1: Lexicon — vendored Lexique 3.83, loader, inflection and sound-alike queries (server lane)

Spec §5 SP2: "Lexicon (Lexique 3.83, CC BY-SA) for inflected forms and homophones". Decision 1.

**Files:**
- Create: `server/app/tools/build_lexicon.py`, `server/app/lexicon.py`, `content/lexique/LICENSE.md`, `content/lexique/README.md`, `content/lexique/lexique383-trimmed.tsv.gz` (generated), `server/tests/test_lexicon.py`
- Modify: `.gitattributes` (add `*.gz binary`), `server/pytest.ini` (filterwarnings), `server/tests/conftest.py` (add `lexicon` fixture; copy the lexicon into the temp content dir)

**Interfaces:**
- Consumes: nothing from SP2. Lexique 3.83 columns used: `ortho, phon, lemme, cgram, genre, nombre, infover, freqfilms2`. `cgram` values include `NOM, ADJ, VER, AUX, ADV, PRE, CON, ART:def, ART:ind, ADJ:pos, ADJ:dem, ADJ:ind, ADJ:num, PRO:per, PRO:dem, PRO:rel, ...`; `genre` ∈ {`m`,`f`,``}; `nombre` ∈ {`s`,`p`,``}; `infover` is `;`-separated codes such as `ind:pre:3s`, `par:pas`, `inf`, `imp:pre:2p`.
- Produces (`server/app/lexicon.py`):
  ```python
  @dataclass(frozen=True, slots=True)
  class Entry: ortho: str; phon: str; lemme: str; cgram: str; genre: str; nombre: str; infover: str; freq: float
  ELISIONS = ("l'", "d'", "qu'", "j'", "n'", "m'", "t'", "s'", "c'")
  DET_NUMBER = {"le": "les", "la": "les", "un": "des", "une": "des", "ce": "ces", "cet": "ces", "cette": "ces", "mon": "mes", "ma": "mes",
                "ton": "tes", "ta": "tes", "son": "ses", "sa": "ses", "notre": "nos", "votre": "vos", "leur": "leurs", "au": "aux", "du": "des",
                "quel": "quels", "quelle": "quelles", "tout": "tous", "toute": "toutes"}   # reverse direction is gender-aware, see flip_number
  DET_GENDER = {"le": "la", "un": "une", "ce": "cette", "cet": "cette", "mon": "ma", "ton": "ta", "son": "sa", "quel": "quelle", "quels": "quelles",
                "tout": "toute", "tous": "toutes", "nouveau": "nouvelle", "beau": "belle", "vieux": "vieille"}   # + reverse map built in code
  SPACY_TO_LEXIQUE = {("Ind","Pres"): "ind:pre", ("Ind","Imp"): "ind:imp", ("Ind","Past"): "ind:pas", ("Ind","Fut"): "ind:fut",
                      ("Cnd","Pres"): "cnd:pre", ("Sub","Pres"): "sub:pre", ("Sub","Imp"): "sub:imp", ("Imp","Pres"): "imp:pre"}
  def verb_code(morph: dict) -> str | None            # {"Mood":"Ind","Tense":"Pres","Person":"3","Number":"Plur"} → "ind:pre:3p"; None when incomplete
  class Lexicon:
      by_ortho: dict[str, list[Entry]]; by_lemme: dict[str, list[Entry]]; by_phon: dict[str, list[Entry]]
      def lookup(self, word: str) -> list[Entry]       # lowercased; if no hit and word starts with an elision (straight or typographic apostrophe), retry on the remainder
      def is_known(self, word: str) -> bool
      def forms_of(self, word: str, lemma: str | None = None, limit: int = 12) -> dict[str, dict]
          # {ortho: {"g": "m"|"f"|None, "n": "s"|"p"|None}} — entries sharing the lemma (spaCy lemma if it exists in by_lemme, else lemmas of lookup(word));
          # cgram prefix in {NOM, ADJ, VER, AUX}; VER/AUX entries limited to participles ("par:pas") unless the word itself is finite (then same mood:tense:person, other number);
          # infinitives excluded; never the word itself; sorted by freq desc; cut at limit
      def sound_alikes(self, word: str, min_freq: float = 0.5, limit: int = 5) -> list[str]   # same phon, different ortho, freq ≥ min_freq, freq desc
      def flip_number(self, word: str, lemma: str, morph: dict) -> str | None   # DET via DET_NUMBER (reverse uses morph Gender: les→la if Fem else le); verbs via verb_code s↔p; NOM/ADJ same genre other nombre; highest freq; None if nothing or identical
      def flip_gender(self, word: str, lemma: str, morph: dict) -> str | None   # DET via DET_GENDER (+reverse); ADJ/NOM/participles same nombre other genre
  def load_lexicon(content_dir: Path) -> Lexicon      # lru_cache(maxsize=2); reads content_dir / "lexique" / "lexique383-trimmed.tsv.gz"
  ```

- [ ] **Step 1: `build_lexicon.py` and generate the vendored file**

```python
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
```
Run: `scripts/py.sh python -m app.tools.build_lexicon --out /work/content/lexique/lexique383-trimmed.tsv.gz`. Expected: `kept ~140000 of ~142000 rows`. If lexique.org is unreachable, download the zip once from the OpenLexicon mirror (`https://github.com/chrplr/openlexicon/raw/master/datasets-info/Lexique383/Lexique383.zip`) into `tmp/` (git-ignored: add `/tmp/` to `.gitignore`) and pass `--zip /work/tmp/Lexique383.zip`; record the source in `content/lexique/README.md`. The output must be < 4 MB (`ls -la`). Add `*.gz binary` to `.gitattributes`.

`content/lexique/LICENSE.md`: heading "Lexique 3.83 — derived file"; attribution "New, B., Pallier, C., Brysbaert, M., Ferrand, L. (2004). Lexique 2: A new French lexical database. *Behavior Research Methods, Instruments, & Computers*, 36(3), 516–524. Lexique 3.83, http://www.lexique.org"; licence "CC BY-SA 4.0 — https://creativecommons.org/licenses/by-sa/4.0/"; transformation statement: "`lexique383-trimmed.tsv.gz` is a derived work: rows whose `ortho` contains a space or whose `cgram` is empty were dropped; only the columns `ortho phon lemme cgram genre nombre infover freqfilms2` were kept (`freqfilms2` renamed `freq`, rounded to two decimals). This derived file is distributed under the same CC BY-SA 4.0 licence." `content/lexique/README.md`: the build command, the source used, the row count.

- [ ] **Step 2: `pytest.ini` filterwarnings and `conftest.py` fixture**

`server/pytest.ini`:
```ini
[pytest]
testpaths = tests
filterwarnings =
    ignore::DeprecationWarning:httpx.*
    ignore::DeprecationWarning:starlette.*
```
`server/tests/conftest.py` — in the `settings` fixture, after copying `homophones.json`:
```python
    (content / "lexique").mkdir()
    shutil.copy(REPO_CONTENT / "lexique" / "lexique383-trimmed.tsv.gz", content / "lexique" / "lexique383-trimmed.tsv.gz")
```
and append:
```python
@pytest.fixture(scope="session")
def lexicon():
    from app.lexicon import load_lexicon
    return load_lexicon(REPO_CONTENT)
```

- [ ] **Step 3: Write the failing tests `server/tests/test_lexicon.py`**

```python
from app.lexicon import verb_code


def test_lookup_and_known(lexicon):
    assert any(e.lemme == "cheval" and e.nombre == "p" for e in lexicon.lookup("chevaux"))
    assert lexicon.is_known("Chevaux") and lexicon.is_known("l'enfant") and lexicon.is_known("l’enfant")
    assert not lexicon.is_known("enfans") and not lexicon.is_known("xyzzy")


def test_forms_of_nouns_adjectives_participles(lexicon):
    assert lexicon.forms_of("chevaux")["cheval"] == {"g": "m", "n": "s"}
    belle = lexicon.forms_of("belle", lemma="beau")
    assert {"beau", "beaux", "belles"} <= set(belle) and belle["belles"] == {"g": "f", "n": "p"}
    assert "belle" not in belle
    mangees = lexicon.forms_of("mangées", lemma="manger")
    assert "mangé" in mangees and mangees["mangé"]["g"] == "m"
    assert "manger" not in mangees            # infinitive excluded
    assert len(lexicon.forms_of("mangées", lemma="manger", limit=3)) == 3


def test_verb_code():
    assert verb_code({"Mood": "Ind", "Tense": "Pres", "Person": "3", "Number": "Plur"}) == "ind:pre:3p"
    assert verb_code({"Mood": "Sub", "Tense": "Imp", "Person": "1", "Number": "Sing"}) == "sub:imp:1s"
    assert verb_code({"Mood": "Ind"}) is None


def test_flip_number(lexicon):
    plur = {"Mood": "Ind", "Tense": "Pres", "Person": "3", "Number": "Plur"}
    sing = {**plur, "Number": "Sing"}
    assert lexicon.flip_number("dansent", "danser", plur) == "danse"
    assert lexicon.flip_number("est", "être", sing) == "sont"
    assert lexicon.flip_number("ont", "avoir", plur) == "a"
    assert lexicon.flip_number("cheval", "cheval", {"Gender": "Masc", "Number": "Sing"}) == "chevaux"
    assert lexicon.flip_number("les", "le", {"Gender": "Fem", "Number": "Plur"}) == "la"
    assert lexicon.flip_number("les", "le", {"Gender": "Masc", "Number": "Plur"}) == "le"
    assert lexicon.flip_number("petites", "petit", {"Gender": "Fem", "Number": "Plur"}) == "petite"
    assert lexicon.flip_number("et", "et", {}) is None


def test_flip_gender(lexicon):
    assert lexicon.flip_gender("belle", "beau", {"Gender": "Fem", "Number": "Sing"}) == "beau"
    assert lexicon.flip_gender("mangée", "manger", {"Gender": "Fem", "Number": "Sing"}) == "mangé"
    assert lexicon.flip_gender("la", "le", {"Gender": "Fem"}) == "le"
    assert lexicon.flip_gender("petits", "petit", {"Gender": "Masc", "Number": "Plur"}) == "petites"
    assert lexicon.flip_gender("table", "table", {"Gender": "Fem"}) is None   # single-gender noun: nothing to flip


def test_sound_alikes(lexicon):
    assert "mère" in lexicon.sound_alikes("mer")
    assert "mer" not in lexicon.sound_alikes("mer")
    assert len(lexicon.sound_alikes("vert")) <= 5 and "verre" in lexicon.sound_alikes("vert")
```
Run: `scripts/pytest.sh tests/test_lexicon.py -v` → FAIL with `ModuleNotFoundError: No module named 'app.lexicon'`.

- [ ] **Step 4: Implement `server/app/lexicon.py`**

Write the full module following the Interfaces block. Key points:
- Parse with `csv.reader` over `gzip.open(path, "rt", encoding="utf-8", newline="")`, skip the header, build `Entry` objects (`freq=float(...)`), fill the three indices as `dict[str, list[Entry]]`. Loading takes ≈1 s.
- `lookup`: `w = word.lower().replace("’", "'")`; direct hit or, for the first elision prefix `w.startswith(p)`, `by_ortho.get(w[len(p):], [])`.
- `forms_of`: candidate lemmas = `[lemma]` if `lemma and lemma in self.by_lemme` else `sorted({e.lemme for e in self.lookup(word)})`; own entries `own = self.lookup(word)`; `finite = [c for e in own for c in e.infover.split(";") if c and c not in ("inf",) and not c.startswith("par:")]`; iterate `by_lemme[l]`: skip `e.ortho == w`, skip cgram prefix not in `{NOM, ADJ, VER, AUX}`, skip `infover == "inf"`; for VER/AUX entries keep if `"par:pas" in codes` or (`finite` and any code shares `mood:tense:person` with a finite code of the word but differs in number); features: participle/noun/adj → `g = e.genre or None, n = e.nombre or None`; finite verb → `n = "s"|"p"` from the code's last char, `g = None`. Dedupe by ortho keeping the highest freq; sort by freq desc; `dict(list(...)[:limit])`.
- `flip_number`: (1) determiners: `if w in DET_NUMBER: return DET_NUMBER[w]`; reverse table `{"les": ("le","la"), "des": ("un","une"), "ces": ("ce","cette"), "mes": ("mon","ma"), "tes": ("ton","ta"), "ses": ("son","sa"), "nos": ("notre","notre"), "vos": ("votre","votre"), "leurs": ("leur","leur"), "aux": ("au","au"), "quels": ("quel","quel"), "quelles": ("quelle","quelle"), "tous": ("tout","tout"), "toutes": ("toute","toute")}` picking index 1 when `morph.get("Gender") == "Fem"`. (2) `code = verb_code(morph)`; if not None: `target = code[:-1] + ("s" if code.endswith("p") else "p")`; search entries of the lemma (fallback: lemmas from `lookup`) with cgram in `{VER, AUX}` and `target in infover.split(";")`; highest freq. (3) NOM/ADJ: own entry's genre (or `morph` Gender mapped `Masc→m`, `Fem→f`), other `nombre`, same lemma, highest freq. Return `None` when nothing or when the result equals `w`.
- `flip_gender`: `DET_GENDER` and its reverse; else same lemma, cgram prefix in `{NOM, ADJ, VER, AUX}` (VER/AUX only participles), same `nombre` as the word's entry, other `genre`; None if nothing or identical.
- `sound_alikes`: `phons = {e.phon for e in self.lookup(word)}`; collect `by_phon[p]` entries with `ortho != w` and `freq ≥ min_freq`; unique orthos by max freq; sort desc; cut.

Run: `scripts/pytest.sh tests/test_lexicon.py -v` → 6 passed. If an assertion fails because the data genuinely lacks a form (inspect with `scripts/py.sh python -c "from app.lexicon import load_lexicon; L = load_lexicon(__import__('pathlib').Path('/work/content')); print(L.lookup('vert'))"`), pick another word from the data for that example and say so in your report; never weaken the implementation.

- [ ] **Step 5: Whole server suite and commit**

Run: `scripts/pytest.sh -q` → green (SP1 tests unaffected).
```bash
git add content/lexique server/app/lexicon.py server/app/tools/build_lexicon.py server/tests/test_lexicon.py server/tests/conftest.py server/pytest.ini .gitattributes .gitignore
git commit -m "Add vendored Lexique 3.83 lexicon with inflection and sound-alike queries" -- content/lexique server/app/lexicon.py server/app/tools/build_lexicon.py server/tests/test_lexicon.py server/tests/conftest.py server/pytest.ini .gitattributes .gitignore
```

---

### Task 2: Agreement chains with confidence, annotation v2, re-annotation at startup (server lane)

Spec §5 SP2: "Agreement chains from the dependency parse (det/amod → noun, nsubj → verb, cop + attribute, aux:pass, être + participle, conj subjects, relative *qui* antecedent) with confidence flags". Decisions 2 and 3. Shared contract "Annotation v2".

**Files:**
- Create: `server/app/nlp/chains.py`, `server/app/reannotate.py`, `server/tests/test_chains.py`, `server/tests/test_reannotate.py`
- Modify: `server/app/nlp/annotate.py`, `server/app/nlp/homophones.py` (`words`/`hint` return `[]`/`""` for unknown ids), `server/app/deps.py` (`make_annotator` loads the lexicon), `server/app/main.py` (call `reannotate_outdated` in lifespan after seed import), `server/tests/test_annotate.py` (v2 expectations), `server/app/tools/seed_check.py` (pass the lexicon to `annotate`)

**Interfaces:**
- Consumes: `Lexicon.forms_of`, `Lexicon.sound_alikes`, `load_lexicon` (Task 1); SP1 `derive`, `annotate`, `Homophones`.
- Produces (`server/app/nlp/chains.py`):
  ```python
  SUBJECT_DEPS = {"nsubj", "nsubj:pass"}; NOMINAL_DEPS = {"det", "amod", "nummod", "det:poss"}; AUX_DEPS = {"aux", "aux:pass", "aux:tense", "cop"}
  CLITIC_COD = {"le", "la", "les", "l'", "me", "te", "nous", "vous", "se", "m'", "t'", "s'"}
  def build_chains(tokens: list[dict]) -> list[dict]      # pure; tokens are dicts with i, text, lemma, pos, morph, head, dep
  def nominal_group(tokens: list[dict], noun_i: int) -> list[int]   # contiguous ids: det/amod/nummod children before the noun … noun … amod / adjectival-acl children after; stops at the first gap
  ```
- Produces (`server/app/nlp/annotate.py`): `ANNOTATION_VERSION = 2`; `annotate(text, nlp, homophones, lexicon=None)`; `derive(tokens, homophones, lexicon=None)` (still returns the token list, now with `forms`, `sound_alikes`, `chains` keys); new `derive_all(tokens, homophones, lexicon=None) -> tuple[list[dict], list[dict]]` returning `(tokens, chains)`; the `annotate` result gains `"chains": [...]`.
- Produces (`server/app/reannotate.py`): `reannotate_outdated(conn, annotate_fn, version=ANNOTATION_VERSION) -> int`.

- [ ] **Step 1: Write the failing tests `server/tests/test_chains.py`**

```python
from app.nlp.chains import build_chains, nominal_group


def tok(i, text, pos, morph=None, head=None, dep="dep", lemma=None):
    return {"i": i, "text": text, "start": 0, "end": 0, "lemma": lemma or text.lower(), "pos": pos,
            "morph": morph or {}, "head": i if head is None else head, "dep": dep}


def by_kind(chains, kind):
    return [c for c in chains if c["kind"] == kind]


def test_subject_verb_high_and_nominal():
    # Les fées dansent .
    t = [tok(0, "Les", "DET", {"Number": "Plur"}, 1, "det"),
         tok(1, "fées", "NOUN", {"Gender": "Fem", "Number": "Plur"}, 2, "nsubj"),
         tok(2, "dansent", "VERB", {"VerbForm": "Fin", "Number": "Plur", "Person": "3", "Mood": "Ind", "Tense": "Pres"}, 2, "ROOT"),
         tok(3, ".", "PUNCT", {}, 2, "punct")]
    chains = build_chains(t)
    sv = by_kind(chains, "subject_verb")[0]
    assert sv["controller"] == 1 and sv["targets"] == [2] and sv["controller_group"] == [0, 1]
    assert sv["confidence"] == "high" and sv["via"] is None and sv["distance"] == 1
    assert sv["features"] == {"Gender": "Fem", "Number": "Plur", "Person": "3"}
    nom = by_kind(chains, "nominal")[0]
    assert nom["controller"] == 1 and nom["targets"] == [0] and nom["confidence"] == "high"
    assert nom["features"] == {"Gender": "Fem", "Number": "Plur"}
    assert nominal_group(t, 1) == [0, 1]


def test_inconsistent_morphology_is_low():
    t = [tok(0, "Les", "DET", {"Number": "Plur"}, 1, "det"),
         tok(1, "fées", "NOUN", {"Gender": "Fem", "Number": "Plur"}, 2, "nsubj"),
         tok(2, "dansent", "VERB", {"VerbForm": "Fin", "Number": "Sing", "Person": "3"}, 2, "ROOT")]
    assert by_kind(build_chains(t), "subject_verb")[0]["confidence"] == "low"


def test_aux_targets_and_participle_etre():
    # Elles sont parties .
    t = [tok(0, "Elles", "PRON", {"Gender": "Fem", "Number": "Plur", "Person": "3"}, 2, "nsubj"),
         tok(1, "sont", "AUX", {"VerbForm": "Fin", "Number": "Plur", "Person": "3", "Mood": "Ind", "Tense": "Pres"}, 2, "aux:tense", lemma="être"),
         tok(2, "parties", "VERB", {"VerbForm": "Part", "Gender": "Fem", "Number": "Plur"}, 2, "ROOT", lemma="partir")]
    chains = build_chains(t)
    sv = by_kind(chains, "subject_verb")[0]
    assert sv["targets"] == [1] and sv["controller"] == 0 and sv["via"] == "aux" and sv["confidence"] == "high"
    pe = by_kind(chains, "participle_etre")[0]
    assert pe["targets"] == [2] and pe["controller"] == 0 and pe["confidence"] == "high"
    assert pe["features"] == {"Gender": "Fem", "Number": "Plur", "Person": "3"}


def test_participle_avoir_rules():
    # Elle a mangé la pomme .  → no_agreement, high
    t = [tok(0, "Elle", "PRON", {"Gender": "Fem", "Number": "Sing", "Person": "3"}, 2, "nsubj"),
         tok(1, "a", "AUX", {"VerbForm": "Fin", "Number": "Sing", "Person": "3", "Mood": "Ind", "Tense": "Pres"}, 2, "aux:tense", lemma="avoir"),
         tok(2, "mangé", "VERB", {"VerbForm": "Part", "Gender": "Masc", "Number": "Sing"}, 2, "ROOT", lemma="manger"),
         tok(3, "la", "DET", {"Gender": "Fem", "Number": "Sing"}, 4, "det"),
         tok(4, "pomme", "NOUN", {"Gender": "Fem", "Number": "Sing"}, 2, "obj")]
    pa = by_kind(build_chains(t), "participle_avoir")[0]
    assert pa["rule"] == "no_agreement" and pa["confidence"] == "high" and pa["targets"] == [2]
    # Il les a mangées .  → cod_before, medium, controller = les
    t = [tok(0, "Il", "PRON", {"Gender": "Masc", "Number": "Sing", "Person": "3"}, 3, "nsubj"),
         tok(1, "les", "PRON", {"Number": "Plur", "Person": "3"}, 3, "obj"),
         tok(2, "a", "AUX", {"VerbForm": "Fin", "Number": "Sing", "Person": "3", "Mood": "Ind", "Tense": "Pres"}, 3, "aux:tense", lemma="avoir"),
         tok(3, "mangées", "VERB", {"VerbForm": "Part", "Gender": "Fem", "Number": "Plur"}, 3, "ROOT", lemma="manger")]
    pa = by_kind(build_chains(t), "participle_avoir")[0]
    assert pa["rule"] == "cod_before" and pa["controller"] == 1 and pa["confidence"] == "medium"


def test_attribute_relative_qui_and_conj():
    # Les enfants qui jouent sont contents .
    t = [tok(0, "Les", "DET", {"Number": "Plur"}, 1, "det"),
         tok(1, "enfants", "NOUN", {"Gender": "Masc", "Number": "Plur"}, 5, "nsubj"),
         tok(2, "qui", "PRON", {"PronType": "Rel"}, 3, "nsubj"),
         tok(3, "jouent", "VERB", {"VerbForm": "Fin", "Number": "Plur", "Person": "3"}, 1, "acl:relcl"),
         tok(4, "sont", "AUX", {"VerbForm": "Fin", "Number": "Plur", "Person": "3"}, 5, "cop", lemma="être"),
         tok(5, "contents", "ADJ", {"Gender": "Masc", "Number": "Plur"}, 5, "ROOT"),
         tok(6, ".", "PUNCT", {}, 5, "punct")]
    chains = build_chains(t)
    qui = next(c for c in by_kind(chains, "subject_verb") if 3 in c["targets"])
    assert qui["via"] == "qui" and qui["via_token"] == 2 and qui["controller"] == 1 and qui["confidence"] == "medium"
    cop = next(c for c in by_kind(chains, "subject_verb") if 4 in c["targets"])
    assert cop["controller"] == 1 and cop["confidence"] == "high"
    attr = by_kind(chains, "attribute")[0]
    assert attr["targets"] == [5] and attr["controller"] == 1 and attr["confidence"] == "high"
    # Pierre et Marie chantent .
    t = [tok(0, "Pierre", "PROPN", {"Number": "Sing"}, 3, "nsubj"),
         tok(1, "et", "CCONJ", {}, 2, "cc"),
         tok(2, "Marie", "PROPN", {"Number": "Sing"}, 0, "conj"),
         tok(3, "chantent", "VERB", {"VerbForm": "Fin", "Number": "Plur", "Person": "3"}, 3, "ROOT")]
    conj = by_kind(build_chains(t), "subject_verb")[0]
    assert conj["via"] == "conj" and conj["controller_group"] == [0, 2]
    assert conj["features"]["Number"] == "Plur" and conj["confidence"] == "medium"


def test_distance_and_ids():
    t = [tok(0, "Le", "DET", {"Number": "Sing"}, 1, "det"),
         tok(1, "chat", "NOUN", {"Gender": "Masc", "Number": "Sing"}, 12, "nsubj")]
    t += [tok(i, "x", "ADV", {}, 12, "advmod") for i in range(2, 12)]
    t += [tok(12, "dort", "VERB", {"VerbForm": "Fin", "Number": "Sing", "Person": "3"}, 12, "ROOT")]
    chains = build_chains(t)
    sv = by_kind(chains, "subject_verb")[0]
    assert sv["distance"] == 11 and sv["confidence"] == "medium"
    assert [c["id"] for c in chains] == list(range(len(chains)))
```
Run: `scripts/pytest.sh tests/test_chains.py -v` → FAIL (`ModuleNotFoundError`).

- [ ] **Step 2: Implement `server/app/nlp/chains.py`**

Algorithm (pure, no spaCy objects):
1. Helpers: `children(i)` = tokens with `head == i` and index ≠ i; `fin(t)` = `pos in {VERB, AUX}` and `morph.VerbForm == "Fin"`; `part(t)` = `morph.VerbForm == "Part"`; `feat(t, keys)` = subset of `morph` for `keys` present.
2. **Nominal chains** — for each NOUN/PROPN `n`: `deps = [c for c in children(n) if c.dep in NOMINAL_DEPS or (c.dep == "acl" and part(c) and not any(a.dep in AUX_DEPS for a in children(c)))]`; skip when empty. `features = feat(n, ["Gender", "Number"])`. Consistent = every dependent agrees on every feature key it has. `confidence = "high"` if consistent, `"Number" in features` and all dependents within 4 tokens; `"medium"` if consistent and Number known; `"low"` otherwise. `controller = n.i`, `controller_group = nominal_group(tokens, n.i)`, `targets = sorted(d.i)`, `distance = min |d.i − n.i|`, `via = None`, `rule = None`.
3. **Predicates** — for each token `h` with a child `s` where `s.dep in SUBJECT_DEPS` (first such child):
   - Controller: if `s.text.lower() == "qui" and s.pos == "PRON" and h.dep == "acl:relcl"` → `controller = h.head`, `via = "qui"`, `via_token = s.i`; else `controller = s.i`, `via = None`, `via_token = None`. Conjunction: `conj = sorted(c.i for c in children(controller) if c.dep == "conj")`; if conj → `via = via or "conj"`, `controller_group = [controller] + conj`, `features = {**feat(ctrl, [Gender, Person]), "Number": "Plur"}`; else `controller_group = nominal_group(tokens, controller)` if the controller is NOUN/PROPN else `[controller]`, `features = feat(ctrl, ["Gender", "Number", "Person"])` with `Person` defaulting to `"3"` for NOUN/PROPN.
   - Finite targets: `([h.i] if fin(h) else []) + [a.i for a in children(h) if a.dep in AUX_DEPS and fin(a)]`. If non-empty → one `subject_verb` chain; `via = "aux"` when `h` is not finite itself and `via is None`. Consistent = every target with a morph Number equals `features.Number` (and Person when both present). `confidence`: `"high"` if consistent, `distance ≤ 8`, `via in (None, "aux")`, controller pos in {NOUN, PROPN, PRON} and `"Number" in features`; `"medium"` if consistent and Number known; `"low"` otherwise.
   - If `part(h)`: `aux = [a for a in children(h) if a.dep in AUX_DEPS]`, `lemmas = {a.lemma for a in aux}`. If `"être" in lemmas` or any `a.dep == "aux:pass"` → `participle_etre` chain (`targets = [h.i]`, same controller/group/features; consistent on Gender/Number of `h` vs features, missing Gender on the controller does not lower confidence; confidence rules as above). Elif `"avoir" in lemmas` → `participle_avoir`: among `children(h)` with `dep == "obj"` placed before `h`: a PRON whose lowercase text ∈ `CLITIC_COD` → `rule = "cod_before"`, controller = that pronoun, `controller_group = [it]`, `features = feat(it, [Gender, Number, Person])`, `confidence = "medium"`; a relative PRON (`que`/`qu'`, `PronType == "Rel"`) with `h.dep == "acl:relcl"` → `rule = "cod_before"`, `controller = h.head`, `via = "que"`, `via_token = it`, `confidence = "medium"`; otherwise `rule = "no_agreement"`, controller = the subject controller, `confidence = "high"` if `h` morph is Masc/Sing or lacks the keys, else `"low"`.
   - Elif `h.pos in {ADJ, NOUN}` (or `part(h)` with no aux) and any child has `dep == "cop"` → `attribute` chain (`targets = [h.i]`, consistent on Gender/Number).
4. Assign `id`s in creation order; drop chains with empty targets; `distance = min(|t − controller| for t in targets)`.

`nominal_group(tokens, noun_i)`: walk left from `noun_i − 1` while the token is a child of the noun with dep in `NOMINAL_DEPS` (or an `advmod` attached to such an adjective), stop at the first gap; walk right while the token is an `amod` child or an adjectival `acl` participle child; return the sorted contiguous ids.

Run: `scripts/pytest.sh tests/test_chains.py -v` → 6 passed.

- [ ] **Step 3: Annotation v2 in `annotate.py`, `deps.py`, `homophones.py`, `seed_check.py`; update tests**

`annotate.py`: `ANNOTATION_VERSION = 2`. New `derive_all(tokens, homophones, lexicon=None)`: compute the SP1 fields exactly as before, then for each token with `pos in {NOUN, ADJ, DET, VERB, AUX, PRON, PROPN}` and `lexicon`: `forms = lexicon.forms_of(t["text"], lemma=t["lemma"])`, `sound_alikes = [w for w in lexicon.sound_alikes(t["text"]) if w not in forms and homophones.set_of(w) is None]`; other tokens get `{}` / `[]`. Then `chains = build_chains(out)` and `t["chains"] = [c["id"] for c in chains if t["i"] in c["targets"] or t["i"] in c["controller_group"]]`. `derive(...)` = `derive_all(...)[0]` (SP1 tests keep calling it). `annotate(text, nlp, homophones, lexicon=None)` returns `{"version": 2, "model": ..., "tokens": tokens, "sentences": ..., "chains": chains}`.

`deps.py`: `make_annotator` adds `lexicon = load_lexicon(settings.content_dir)` and `lambda text: annotate(text, nlp, homophones, lexicon)`. `seed_check.py`: same wiring. `homophones.py`: `words(set_id)` → `next((s["words"] for s in self.sets if s["id"] == set_id), [])`; `hint` → `""` default.

`test_annotate.py`: give `test_annotate_with_real_model` the `lexicon` fixture and pass it; add assertions: `a["version"] == 2`; `isinstance(a["chains"], list)`; the `fées` token has `"fée" in t["forms"]`; `any(c["kind"] == "subject_verb" and c["controller"] == fees_i and dansent_i in c["targets"] for c in a["chains"])`; `dansent["chains"]` contains that chain id. Add `test_derive_without_lexicon_keeps_sp1_shape`: `derive(tokens, h)` tokens have `forms == {}`, `sound_alikes == []`, `chains` list present. (`fr_core_news_sm` caveat: if the smoke sentence parses differently, switch it to `Les enfants jouent dans le jardin.` and say so in your report.)

Run: `scripts/pytest.sh tests/test_annotate.py tests/test_chains.py tests/test_homophones.py tests/test_seed.py -v` → green.

- [ ] **Step 4: `reannotate.py`, lifespan hook, test**

```python
"""Re-annotates stored rows whose annotation predates ANNOTATION_VERSION (bounded: dozens of rows at startup)."""
from __future__ import annotations
import json, sqlite3
from typing import Callable
from app.nlp.annotate import ANNOTATION_VERSION


def _table_exists(conn: sqlite3.Connection, name: str) -> bool:
    return conn.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", (name,)).fetchone() is not None


def reannotate_outdated(conn: sqlite3.Connection, annotate_fn: Callable[[str], dict], version: int = ANNOTATION_VERSION) -> int:
    n = 0
    for table in ("text", "online_chunk"):          # online_chunk exists from Task 5 on
        if not _table_exists(conn, table):
            continue
        rows = conn.execute(
            f"SELECT id, body FROM {table} WHERE COALESCE(json_extract(annotation_json, '$.version'), 0) < ?", (version,)).fetchall()
        for r in rows:
            conn.execute(f"UPDATE {table} SET annotation_json = ? WHERE id = ?",
                         (json.dumps(annotate_fn(r["body"]), ensure_ascii=False), r["id"]))
            n += 1
    conn.commit()
    return n
```
`main.py` lifespan, inside the `if settings.seed_on_startup:` block after `import_seed(...)`: `from app.reannotate import reannotate_outdated` and `reannotate_outdated(conn, annotator)`.

`server/tests/test_reannotate.py`:
```python
import json
from app.db import connect, migrate
from app.reannotate import reannotate_outdated

INSERT = "INSERT INTO text(title, body, source, level, annotation_json, created_at) VALUES (?, ?, 'custom', '8H', ?, 'now')"


def test_reannotates_only_outdated_rows(tmp_path):
    conn = connect(tmp_path / "db.sqlite3")
    migrate(conn)
    conn.execute(INSERT, ("old", "Les fées dansent.", '{"version": 1}'))
    conn.execute(INSERT, ("new", "Il dort.", '{"version": 2}'))
    conn.execute(INSERT, ("empty", "Il dort.", "{}"))
    conn.commit()
    calls = []

    def fake(body):
        calls.append(body)
        return {"version": 2, "tokens": [], "sentences": [], "chains": []}

    assert reannotate_outdated(conn, fake, version=2) == 2
    assert sorted(calls) == ["Il dort.", "Les fées dansent."]
    assert json.loads(conn.execute("SELECT annotation_json FROM text WHERE title = 'old'").fetchone()[0])["version"] == 2
    assert reannotate_outdated(conn, fake, version=2) == 0
```
Run: `scripts/pytest.sh -q` → all green.

- [ ] **Step 5: Commit**

```bash
git add server/app/nlp/chains.py server/app/nlp/annotate.py server/app/nlp/homophones.py server/app/deps.py server/app/main.py server/app/reannotate.py server/app/tools/seed_check.py server/tests/test_chains.py server/tests/test_annotate.py server/tests/test_reannotate.py
git commit -m "Add agreement chains with confidence, lexicon forms in annotation v2, startup re-annotation" -- server/app/nlp/chains.py server/app/nlp/annotate.py server/app/nlp/homophones.py server/app/deps.py server/app/main.py server/app/reannotate.py server/app/tools/seed_check.py server/tests/test_chains.py server/tests/test_annotate.py server/tests/test_reannotate.py
```

---

### Task 3: Scan API — Pillow preprocessing, Tesseract `fra`, photo storage, Docker packages (server lane)

Spec §3.2 / §5: "photo(s) of a printed handout → preprocessing → Tesseract `fra` → the child verifies/fixes the text on screen → annotate → save (with due date option)"; "The original photo of a scanned handout is stored in the data volume." Decision 7. Absorbs deferred minors: duplicated text JOIN SQL, missing 4000-char test, `startswith` static guard.

**Files:**
- Create: `server/app/ocr.py`, `server/app/routers/scan.py`, `server/app/tools/make_scan_fixture.py`, `server/tests/fixtures/scan/handout.png`, `server/tests/fixtures/scan/handout-rotated.jpg` (both generated), `server/tests/test_ocr.py`, `server/tests/test_scan_api.py`
- Modify: `server/requirements.txt` (add `pillow>=10,<12`, `pytesseract>=0.3.10,<0.4`, `python-multipart>=0.0.9,<1`), `Dockerfile`, `server/Dockerfile.dev`, `server/app/main.py`, `server/app/routers/texts.py`, `server/app/schemas.py`, `server/tests/test_texts.py`

**Interfaces:**
- Consumes: `settings.data_dir`, `get_db`, `get_annotator`, `fetch_text`/`to_summary`/`to_full` (SP1 texts router).
- Produces (`server/app/ocr.py`):
  ```python
  MAX_SIDE = 2200; LOW_CONF = 60; TESSERACT_CONFIG = "--psm 6"
  @dataclass(frozen=True, slots=True)
  class OcrWord: text: str; conf: float; block: int; par: int; line: int; left: int; top: int; width: int; height: int
  def preprocess(data: bytes) -> Image.Image        # ImageOps.exif_transpose → convert("L") → resize so max(w,h) == MAX_SIDE (LANCZOS, up or down) → ImageOps.autocontrast(cutoff=1)
  def run_tesseract(img: Image.Image) -> list[OcrWord]   # pytesseract.image_to_data(img, lang="fra", config=TESSERACT_CONFIG, output_type=Output.DICT)
  def assemble(words: list[OcrWord]) -> tuple[str, list[str]]   # paragraphs by (block, par), lines joined, hyphenated line ends merged, digit-only lines dropped; returns (text, low-confidence words)
  def clean_ocr_text(text: str) -> str
  def ocr_page(data: bytes, ocr=run_tesseract) -> dict   # {"text", "low_confidence", "width", "height"}
  ```
- Produces (`server/app/routers/scan.py`): `router` (prefix `/api/scan`), `get_ocr(request)` dependency (`request.app.state.ocr` if set, else `run_tesseract`), `SCAN_ID_RE = re.compile(r"^[0-9a-f]{32}$")`, `scan_dir(data_dir, scan_id) -> Path`, `sweep_orphan_scans(data_dir, conn, max_age_hours=24) -> int`.
- Produces (schemas): `TextCreate.scan_id: str | None = None`; `TextSummary.scan_id: str | None`, `TextSummary.photo_count: int`.

- [ ] **Step 1: Docker packages and requirements**

`Dockerfile` (runtime stage, before `COPY server/requirements.txt`):
```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-fra \
 && rm -rf /var/lib/apt/lists/*
```
`server/Dockerfile.dev` (after `WORKDIR`): the same line plus `fonts-dejavu-core` in the package list. Add the three packages to `server/requirements.txt`. Run `scripts/py.sh tesseract --version` → prints `tesseract 5.x`; `scripts/py.sh tesseract --list-langs` → includes `fra`.

- [ ] **Step 2: Fixture generator and fixture images**

`server/app/tools/make_scan_fixture.py`:
```python
"""Renders the OCR fixture handouts (printed-looking text, DejaVu Serif). Usage: scripts/py.sh python -m app.tools.make_scan_fixture /work/server/tests/fixtures/scan"""
from __future__ import annotations
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"
TITLE = "Dictée préparée — Les fées de la clairière"
LINES = [
    "Les fées dansent dans la clairière. Elles chantent et les oiseaux",
    "les écoutent. Le vent emporte leurs chansons jusqu'au vil-",
    "lage endormi.",
    "",
    "Les enfants du village sortent de leurs maisons. Ils écoutent,",
    "émerveillés, la musique qui descend de la forêt.",
]


def render() -> Image.Image:
    img = Image.new("RGB", (1600, 1100), "white")
    d = ImageDraw.Draw(img)
    d.text((100, 80), TITLE, font=ImageFont.truetype(FONT, 40), fill="black")
    y = 200
    body = ImageFont.truetype(FONT, 34)
    for line in LINES:
        if line:
            d.text((100, y), line, font=body, fill="black")
        y += 58
    d.text((780, 1000), "3", font=body, fill="black")     # page number: must be dropped by assemble()
    return img


def main(out: str) -> int:
    out_dir = Path(out)
    out_dir.mkdir(parents=True, exist_ok=True)
    img = render()
    img.save(out_dir / "handout.png")
    rotated = img.rotate(90, expand=True)                # stored sideways; EXIF orientation 6 = "rotate 90° CW to view"
    exif = Image.Exif()
    exif[0x0112] = 6
    rotated.save(out_dir / "handout-rotated.jpg", "JPEG", quality=90, exif=exif.tobytes())
    print("wrote", sorted(p.name for p in out_dir.iterdir()))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
```
Run it; two files appear (≈ 60 KB + 150 KB).

- [ ] **Step 3: Failing tests `server/tests/test_ocr.py`**

```python
import shutil
from pathlib import Path
import pytest
from app.ocr import OcrWord, assemble, clean_ocr_text, ocr_page, preprocess

FIX = Path(__file__).parent / "fixtures" / "scan"
HAS_TESSERACT = shutil.which("tesseract") is not None


def w(text, conf=95.0, block=1, par=1, line=1):
    return OcrWord(text, conf, block, par, line, 0, 0, 10, 10)


def test_preprocess_restores_orientation_and_resizes():
    img = preprocess((FIX / "handout-rotated.jpg").read_bytes())
    assert img.mode == "L" and img.width > img.height and max(img.size) == 2200


def test_assemble_joins_lines_dehyphenates_and_drops_page_numbers():
    words = [w("Les"), w("fées", conf=40), w("dansent"), w("jusqu'au"), w("vil-"),
             w("lage", line=2), w("endormi.", line=2),
             w("Ils", par=2), w("écoutent.", par=2),
             w("3", block=2, conf=90)]
    text, low = assemble(words)
    assert text == "Les fées dansent jusqu'au village endormi.\n\nIls écoutent."
    assert low == ["fées"]


def test_clean_ocr_text():
    assert clean_ocr_text("Les fées , dansent .\n\n\n\n«Oui»   , dit-il ; non !") == "Les fées, dansent.\n\n« Oui », dit-il ; non !"
    assert clean_ocr_text("l’enfant  ") == "l'enfant"


@pytest.mark.skipif(not HAS_TESSERACT, reason="tesseract binary not installed")
def test_real_tesseract_reads_the_fixture():
    page = ocr_page((FIX / "handout.png").read_bytes())
    assert "fées dansent dans la clairière" in page["text"]
    assert "village endormi" in page["text"]            # hyphenated line end merged
    assert "\n3" not in page["text"] and not page["text"].endswith("3")
    assert page["width"] == 2200


@pytest.mark.skipif(not HAS_TESSERACT, reason="tesseract binary not installed")
def test_rotated_photo_gives_the_same_words():
    page = ocr_page((FIX / "handout-rotated.jpg").read_bytes())
    assert "clairière" in page["text"] and "émerveillés" in page["text"]
```
Run: `scripts/pytest.sh tests/test_ocr.py -v` → FAIL (module missing).

- [ ] **Step 4: Implement `server/app/ocr.py`**

- `preprocess`: `Image.open(io.BytesIO(data))`, `ImageOps.exif_transpose`, `convert("L")`, scale factor `MAX_SIDE / max(size)` with `Image.LANCZOS`, `ImageOps.autocontrast(img, cutoff=1)`.
- `run_tesseract`: build `OcrWord`s from the DICT columns `text, conf, block_num, par_num, line_num, left, top, width, height`, skipping entries with empty/whitespace text or `conf == -1`.
- `assemble`: group words by `(block, par)` in order of first appearance, then by `line`; a line's text = words joined by `" "`; drop lines whose text matches `^[\d\W]+$`; join lines inside a paragraph: if the previous line ends with `-` and the next starts with a lowercase letter → `prev[:-1] + next`, else `prev + " " + next`; paragraphs joined with `"\n\n"`; run `clean_ocr_text` at the end; low-confidence = words with `0 <= conf < LOW_CONF` whose text contains a letter, in order, deduplicated.
- `clean_ocr_text`: `’‘ʼ` → `'`; `“”„` → `"`; NBSP variants → space; `«\s*` → `« ` and `\s*»` → ` »`; remove spaces before `,` and `.`; ensure exactly one space before `; : ! ?` when preceded by a letter; collapse runs of spaces; `\n{3,}` → `\n\n`; strip each line; strip.
- `ocr_page`: `img = preprocess(data)`; `text, low = assemble(ocr(img))`; return with `img.size`.

Run: `scripts/pytest.sh tests/test_ocr.py -v` → 5 passed (the two Tesseract tests run in the dev image; if the real-OCR assertions fail on a specific word, print `page["text"]`, fix `assemble`/`clean_ocr_text` if the problem is joining, or adjust the fixture font size — Tesseract must read this synthetic image cleanly).

- [ ] **Step 5: Failing tests `server/tests/test_scan_api.py` and a 4000-char test**

```python
import os, time
from pathlib import Path
from app.ocr import OcrWord
from app.routers.scan import sweep_orphan_scans

FIX = Path(__file__).parent / "fixtures" / "scan"


def fake_ocr(img):
    return [OcrWord("Les", 95, 1, 1, 1, 0, 0, 1, 1), OcrWord("fées", 40, 1, 1, 1, 0, 0, 1, 1), OcrWord("dansent.", 95, 1, 1, 1, 0, 0, 1, 1)]


def upload(client, names):
    files = [("photos", (n, (FIX / n).read_bytes(), "image/png" if n.endswith(".png") else "image/jpeg")) for n in names]
    return client.post("/api/scan", files=files)


def test_scan_stores_photos_and_returns_text(client, settings):
    client.app.state.ocr = fake_ocr
    r = upload(client, ["handout.png", "handout-rotated.jpg"])
    assert r.status_code == 201, r.text
    d = r.json()
    assert len(d["scan_id"]) == 32 and len(d["pages"]) == 2
    assert d["pages"][0]["text"] == "Les fées dansent." and d["pages"][0]["low_confidence"] == ["fées"]
    assert d["text"] == "Les fées dansent.\n\nLes fées dansent."
    folder = settings.data_dir / "scans" / d["scan_id"]
    assert (folder / "page-1.png").read_bytes() == (FIX / "handout.png").read_bytes()   # original bytes, untouched
    assert (folder / "page-2.jpg").exists()
    page = client.get(f"/api/scan/{d['scan_id']}/page/2")
    assert page.status_code == 200 and page.headers["content-type"].startswith("image/jpeg")
    assert client.get(f"/api/scan/{d['scan_id']}/page/3").status_code == 404
    assert client.get("/api/scan/../etc/page/1").status_code in (404, 422)


def test_scan_validation(client):
    client.app.state.ocr = fake_ocr
    assert client.post("/api/scan", files=[]).status_code == 422
    assert upload(client, ["handout.png"] * 6).status_code == 422
    r = client.post("/api/scan", files=[("photos", ("x.txt", b"hello", "text/plain"))])
    assert r.status_code == 422 and "JPEG ou PNG" in r.text
    client.app.state.ocr = lambda img: []
    r = upload(client, ["handout.png"])
    assert r.status_code == 422 and "Aucun texte lisible" in r.text


def test_text_from_scan_links_photos(client, settings):
    client.app.state.ocr = fake_ocr
    scan_id = upload(client, ["handout.png"]).json()["scan_id"]
    body = {"title": "Feuille", "body": "Les fées dansent dans la clairière et les oiseaux les écoutent.", "level": "8H",
            "source": "scan", "scan_id": scan_id, "due_date": "2030-01-15"}
    r = client.post("/api/texts", json=body)
    assert r.status_code == 201, r.text
    t = r.json()
    assert t["source"] == "scan" and t["scan_id"] == scan_id and t["photo_count"] == 1 and t["due_date"] == "2030-01-15"
    listed = client.get("/api/texts").json()
    assert listed[0]["scan_id"] == scan_id
    assert client.post("/api/texts", json={**body, "scan_id": "0" * 32}).status_code == 422
    assert client.post("/api/texts", json={**body, "scan_id": None}).status_code == 422


def test_sweep_removes_only_old_unreferenced_scans(client, settings):
    client.app.state.ocr = fake_ocr
    kept = upload(client, ["handout.png"]).json()["scan_id"]
    client.post("/api/texts", json={"title": "F", "body": "Les fées dansent dans la clairière.", "level": "8H", "source": "scan", "scan_id": kept})
    old = upload(client, ["handout.png"]).json()["scan_id"]
    fresh = upload(client, ["handout.png"]).json()["scan_id"]
    scans = settings.data_dir / "scans"
    past = time.time() - 48 * 3600
    os.utime(scans / kept, (past, past))
    os.utime(scans / old, (past, past))
    from app.db import connect
    conn = connect(settings.data_dir / "discorde.sqlite3")
    assert sweep_orphan_scans(settings.data_dir, conn) == 1
    assert (scans / kept).exists() and (scans / fresh).exists() and not (scans / old).exists()
```
Append to `server/tests/test_texts.py`:
```python
def test_body_over_4000_chars_rejected(client):
    assert client.post("/api/texts", json={"title": "T", "body": "mot " * 1100, "level": "8H", "source": "custom"}).status_code == 422
```
Run: `scripts/pytest.sh tests/test_scan_api.py -v` → FAIL.

- [ ] **Step 6: Implement `routers/scan.py`, wire `texts.py`, `schemas.py`, `main.py`**

`scan.py`:
- `ALLOWED = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}`, `MAX_PHOTOS = 5`, `MAX_BYTES = 12 * 1024 * 1024`.
- `POST ""` (`status_code=201`): `photos: list[UploadFile] = File(...)`; 422 messages: `Aucune photo reçue.`, `Cinq photos au maximum.`, `Photo trop lourde (12 Mo au maximum).`, `Format d'image non pris en charge (JPEG ou PNG).`; `scan_id = uuid.uuid4().hex`; write each original to `scan_dir(data_dir, scan_id) / f"page-{n}.{ext}"`; `pages = [ {"index": n, **ocr_page(data, ocr)} ]`; `text = "\n\n".join(p["text"] for p in pages if p["text"])`; if `not text.strip()` → delete the folder and 422 `Aucun texte lisible sur cette photo. Prends-la bien à plat, en pleine lumière.`; return `{scan_id, pages, text}`. Wrap `ocr_page` in `try/except Exception` → 422 `Impossible de lire cette image.`
- `GET "/{scan_id}/page/{n}"`: 404 unless `SCAN_ID_RE.fullmatch(scan_id)`; find `page-{n}.*` in the folder; `FileResponse` with the media type from the extension.
- `sweep_orphan_scans`: referenced = `{row[0].split("/", 1)[1] for row in conn.execute("SELECT photo_path FROM text WHERE photo_path LIKE 'scans/%'")}`; for each dir in `data_dir / "scans"` (if it exists): if name not in referenced and `time.time() - dir.stat().st_mtime > max_age_hours * 3600` → `shutil.rmtree`; return the count.

`schemas.py`: `TextCreate.scan_id: str | None = None`; `TextSummary.scan_id: str | None = None`, `photo_count: int = 0`.

`texts.py`: factor `TEXT_SELECT = "SELECT t.*, p.name AS added_by_name FROM text t LEFT JOIN profile p ON p.id = t.added_by_profile_id"` and use it in `fetch_text` and `list_texts`; `to_summary(row, history, data_dir: Path | None = None)` fills `scan_id` from `photo_path` (`scans/<id>` → `<id>`) and `photo_count = len(list(scan_dir.glob("page-*")))` when `data_dir` is given (add a `request: Request` parameter to `list_texts`, `create_text` and `get_text` and pass `request.app.state.settings.data_dir`; `to_full` forwards it). `create_text`: allow `source in {"custom", "scan"}` (422 `source must be 'custom' or 'scan'`); when `scan`: `scan_id` must match `SCAN_ID_RE` and its folder must exist → `photo_path = f"scans/{scan_id}"`, else 422 `Scan introuvable`; store `photo_path` in the INSERT.

`main.py`: `app.include_router(scan.router)`; in lifespan after `migrate(conn)`: `from app.routers.scan import sweep_orphan_scans; sweep_orphan_scans(settings.data_dir, conn)`; replace the static guard with `candidate.is_relative_to(static)`.

Run: `scripts/pytest.sh -q` → all green.

- [ ] **Step 7: Build the production image and commit**

Run: `docker build -t discorde:local .` → succeeds; `docker run --rm discorde:local tesseract --list-langs` → includes `fra`. Note the image size (`docker images discorde:local`) in your report.
```bash
git add Dockerfile server/Dockerfile.dev server/requirements.txt server/app/ocr.py server/app/routers/scan.py server/app/tools/make_scan_fixture.py server/app/main.py server/app/routers/texts.py server/app/schemas.py server/tests/fixtures/scan server/tests/test_ocr.py server/tests/test_scan_api.py server/tests/test_texts.py
git commit -m "Add scan API: Pillow preprocessing, Tesseract fra OCR, stored originals, scan-sourced texts" -- Dockerfile server/Dockerfile.dev server/requirements.txt server/app/ocr.py server/app/routers/scan.py server/app/tools/make_scan_fixture.py server/app/main.py server/app/routers/texts.py server/app/schemas.py server/tests/fixtures/scan server/tests/test_ocr.py server/tests/test_scan_api.py server/tests/test_texts.py
```

---

### Task 4: Grimoire corrompu — corruption engine, `/corrupt` endpoint, session mode (server lane)

Spec §5 SP2: "*Grimoire corrompu*: proofreading-only mode on a correct text with errors planted by Éris, weighted by the profile's weaknesses." Decision 8. Absorbs deferred minor: help-stage message test discrimination.

**Files:**
- Create: `server/app/corrupt.py`, `server/app/migrations/002_session_mode.sql`, `server/tests/test_corrupt.py`
- Modify: `server/app/routers/texts.py` (corrupt endpoint), `server/app/routers/sessions.py` (mode), `server/app/routers/stats.py` (`mode` in recent sessions), `server/app/schemas.py` (`SessionCreate.mode`, `CorruptRequest`), `server/tests/test_sessions.py`

**Interfaces:**
- Consumes: `Lexicon.flip_number/flip_gender/sound_alikes` (Task 1), annotation v2 `chains` (Task 2), `Homophones.set_of/words`, `profile_stat` rows, `trap_word` rows.
- Produces (`server/app/corrupt.py`):
  ```python
  BASE_WEIGHTS = {"agreement:verb": 0.20, "agreement:number": 0.15, "agreement:gender": 0.10, "agreement:participle": 0.15,
                  "homophone": 0.25, "lexical": 0.10, "accent": 0.05}
  MIN_GAP = 3            # minimum token distance between two plants
  def corruption_count(word_count: int) -> int                     # clamp(round(word_count / 18), 4, 12)
  def category_weights(stat_rows: list[dict], level: str) -> dict[str, float]   # BASE × (1.25 − catch_rate); catch_rate = caught/errors_in_draft when errors_in_draft ≥ 3 else 0.5; drops agreement:participle below 8H
  def candidates(annotation: dict, lexicon, homophones, trap_words: set[str]) -> dict[str, list[dict]]
  def plan_corruptions(body: str, annotation: dict, lexicon, homophones, weights: dict[str, float], count: int,
                       rng: random.Random, trap_words: set[str] = frozenset()) -> list[dict]
  def apply_plants(body: str, plants: list[dict]) -> str
  def match_case(original: str, mutated: str) -> str              # capitalised original → capitalised mutation
  ```
  A plant is `{"token": i, "start": int, "end": int, "original": str, "mutated": str, "category": str}` (`category` ∈ `BASE_WEIGHTS` keys); plants are sorted by `start` and never overlap.
- Produces (API): `POST /api/texts/{text_id}/corrupt` with `CorruptRequest(profile_id: int, seed: int | None = None)` → `{"text_id", "corrupted", "count", "plants"}`; `SessionCreate.mode: Literal["dictation", "grimoire"] = "dictation"`.

- [ ] **Step 1: Migration and failing tests**

`server/app/migrations/002_session_mode.sql`:
```sql
-- SP2: proofreading-only sessions (Grimoire corrompu) are recorded with mode = 'grimoire'.
ALTER TABLE session ADD COLUMN mode TEXT NOT NULL DEFAULT 'dictation';
```
`server/tests/test_corrupt.py`:
```python
import random
from pathlib import Path
from app.corrupt import apply_plants, candidates, category_weights, corruption_count, match_case, plan_corruptions
from app.nlp.annotate import annotate
from app.nlp.homophones import load_homophones

CONTENT = Path(__file__).resolve().parents[2] / "content"
BODY = ("Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent. "
        "Le vent emporte leurs chansons jusqu'au village. Les enfants sortent de leurs maisons, émerveillés. "
        "La musique descend de la forêt et la nuit est douce.")


def test_count_and_weights():
    assert corruption_count(60) == 4 and corruption_count(126) == 7 and corruption_count(400) == 12
    rows = [{"category": "agreement:verb", "errors_in_draft": 10, "caught": 2},
            {"category": "homophone", "errors_in_draft": 10, "caught": 9},
            {"category": "lexical", "errors_in_draft": 1, "caught": 0}]
    w = category_weights(rows, "10H")
    assert w["agreement:verb"] > w["homophone"]                    # weak category weighs more
    assert abs(w["lexical"] - 0.10 * 0.75) < 1e-9                  # too few samples → catch_rate 0.5
    assert "agreement:participle" not in category_weights([], "7H") and "agreement:participle" in category_weights([], "8H")


def test_match_case():
    assert match_case("Les", "la") == "La" and match_case("les", "la") == "la"


def test_candidates_and_plan_are_valid_and_deterministic(nlp, lexicon):
    h = load_homophones(CONTENT)
    annotation = annotate(BODY, nlp, h, lexicon)
    cands = candidates(annotation, lexicon, h, {"clairière"})
    assert cands["homophone"] and cands["accent"] and cands["agreement:verb"]
    for cat, items in cands.items():
        for c in items:
            assert BODY[c["start"]:c["end"]] == c["original"] and c["mutated"].lower() != c["original"].lower()
    weights = category_weights([], "10H")
    plants = plan_corruptions(BODY, annotation, lexicon, h, weights, 6, random.Random(42), {"clairière"})
    assert 3 <= len(plants) <= 6
    assert plants == sorted(plants, key=lambda p: p["start"])
    for a, b in zip(plants, plants[1:]):
        assert a["end"] <= b["start"] and b["token"] - a["token"] >= 3
    again = plan_corruptions(BODY, annotation, lexicon, h, weights, 6, random.Random(42), {"clairière"})
    assert again == plants
    corrupted = apply_plants(BODY, plants)
    assert corrupted != BODY and len(corrupted.split("\n")) == len(BODY.split("\n"))
    # every plant span is exactly what changed
    rebuilt = apply_plants(BODY, plants)
    for p in plants:
        assert p["mutated"] in rebuilt


def test_api_corrupt_and_grimoire_session(client):
    p = client.post("/api/profiles", json={"name": "Léa", "avatar": "chouette", "level": "10H"}).json()
    t = client.post("/api/texts", json={"title": "Fées", "body": BODY, "level": "8H", "source": "custom"}).json()
    r = client.post(f"/api/texts/{t['id']}/corrupt", json={"profile_id": p["id"], "seed": 7})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["count"] == len(d["plants"]) >= 3 and d["corrupted"] != BODY
    for pl in d["plants"]:
        assert BODY[pl["start"]:pl["end"]] == pl["original"]
    assert client.post(f"/api/texts/{t['id']}/corrupt", json={"profile_id": p["id"], "seed": 7}).json() == d
    short = client.post("/api/texts", json={"title": "S", "body": "Il dort ici maintenant.", "level": "8H", "source": "custom"}).json()
    r = client.post(f"/api/texts/{short['id']}/corrupt", json={"profile_id": p["id"]})
    assert r.status_code == 422 and "Éris" in r.text
    # grimoire sessions never move the help stage, even with three perfect catch rates
    result = {"version": 1, "byCategory": {"homophone": {"opportunities": 5, "draft": 2, "caught": 2, "missed": 0, "introduced": 0}},
              "draftErrors": [], "finalErrors": [], "caught": [], "missed": [], "introduced": [], "correctWords": 30, "totalWords": 30, "catchRate": 1.0, "score": 100}
    for _ in range(3):
        s = client.post("/api/sessions", json={"profile_id": p["id"], "text_id": t["id"], "pace_level": 1, "help_stage": 1, "mode": "grimoire",
                                                "started_at": "2026-09-24T10:00:00+00:00", "draft": d["corrupted"], "final": BODY,
                                                "result": result, "score": 100, "catch_rate": 1.0}).json()
        assert s["help_stage_after"] == 1 and s["help_stage_message"] is None
    stats = client.get(f"/api/profiles/{p['id']}/stats").json()
    assert stats["recent_sessions"][0]["mode"] == "grimoire" and stats["categories"][0]["caught"] == 6
```
In `server/tests/test_sessions.py`, make the existing up/down help-stage test assert the exact messages: `assert r["help_stage_message"] == "Les Muses te font confiance : les Yeux d'Argus s'éteignent un peu."` on the upward move and `== "Éris a été retorse. Les Muses rallument les Yeux d'Argus pour t'aider."` on the downward move (import `UP_MESSAGE`/`DOWN_MESSAGE` from `app.routers.sessions`).

Run: `scripts/pytest.sh tests/test_corrupt.py -v` → FAIL.

(`fr_core_news_sm` caveat: `test_candidates_and_plan_are_valid_and_deterministic` needs at least one medium/high `subject_verb` chain from the small model's parse of `BODY`; if `cands["agreement:verb"]` is empty, print the chains, extend `BODY` with another plain `Les X verbent.` sentence rather than weakening the assertion, and say so in your report.)

- [ ] **Step 2: Implement `server/app/corrupt.py`**

Candidate rules (`candidates`), using `chains = [c for c in annotation["chains"] if c["confidence"] in ("high", "medium")]`, `tokens = annotation["tokens"]`; a token is eligible only if `pos not in {PROPN, PUNCT, SPACE}`, `len(text) ≥ 2`, `text` is letters/apostrophe only; skip a candidate when the mutation is `None` or equal to the original (case-insensitive):
- `agreement:verb`: token is a target of a `subject_verb` chain and `morph.VerbForm == "Fin"` → `lexicon.flip_number(text, lemma, morph)`.
- `agreement:number`: token is a target or controller of a `nominal` chain with pos in {DET, NOUN, ADJ} → `flip_number`.
- `agreement:gender`: token is a target of a `nominal` / `attribute` / `participle_etre` chain with pos in {DET, ADJ} (or ADJ-tagged participle) → `flip_gender`.
- `agreement:participle`: token with `VerbForm == "Part"` that is a target of any chain → `flip_number` or `flip_gender` (both tried; each non-null result is a separate candidate).
- `homophone`: `set_id = homophones.set_of(text)` → for each other member `m` in `homophones.words(set_id)` with no space and `m != text.lower()`: candidate `match_case(text, m)`. Skip when the token text contains an apostrophe (spaCy splits `c'est` into `c'`+`est`; leave those alone).
- `accent`: text contains a character in `àâäéèêëîïôöùûüç` → replace the last such character with its base letter (`unicodedata.normalize("NFD")` on that char, keep the base).
- `lexical`: (a) first `(ll|tt|nn|mm|rr|pp|ff)` → single letter; else, for words ≥ 5 letters, the first single `[ltnmrpf]` between two vowels → doubled; (b) `lexicon.sound_alikes(text)` first entry that is not in a homophone set; (c) if `text.lower() in trap_words`, append the same candidate two more times (weight ×3).
Each candidate: `{"token": i, "start": t["start"], "end": t["end"], "original": t["text"], "mutated": ..., "category": cat}`.

`plan_corruptions`: `cands = candidates(...)`; `weights = {k: v for k, v in weights.items() if cands.get(k)}`; `chosen = []`, `used_tokens = set()`; loop while `len(chosen) < count` and `weights`: `cat = rng.choices(list(weights), weights=list(weights.values()))[0]`; `pool = [c for c in cands[cat] if all(abs(c["token"] - u) >= MIN_GAP for u in used_tokens)]`; if empty → `del weights[cat]`, continue; `c = rng.choice(pool)`; append, mark the token. Return `sorted(chosen, key=start)`. `apply_plants`: replace spans from the last to the first. `match_case`: if `original[:1].isupper()` → `mutated[:1].upper() + mutated[1:]`.

Endpoint (`texts.py`): `@router.post("/{text_id}/corrupt")`: fetch text and profile (`fetch_profile` from `app.routers.profiles`), `stat_rows = [dict(r) for r in db.execute("SELECT category, errors_in_draft, caught FROM profile_stat WHERE profile_id = ?", ...)]`, `trap = {r[0] for r in db.execute("SELECT word FROM trap_word WHERE profile_id = ?", ...)}`, `weights = category_weights(stat_rows, profile["level"])`, `count = corruption_count(word_count(body))`, `rng = random.Random(body_seed if body.seed is not None else time.time_ns())`, `plants = plan_corruptions(...)`; if `len(plants) < 3` → 422 `Éris n'a pas trouvé assez de prises dans ce texte.`; return `{"text_id", "corrupted": apply_plants(...), "count": len(plants), "plants": plants}`. Lexicon and homophones come from `load_lexicon(settings.content_dir)` / `load_homophones(settings.content_dir)` (both cached).

`sessions.py`: add `mode` to the INSERT; the help-stage `SELECT` adds `AND mode = 'dictation'`; when `body.mode == "grimoire"`, skip the help-stage change entirely (`help_stage_after = help_stage_before`, `message = None`). `stats.py`: add `s.mode` to the recent-sessions SELECT. `schemas.py`: `SessionCreate.mode: Literal["dictation", "grimoire"] = "dictation"`, `class CorruptRequest(BaseModel): profile_id: int; seed: int | None = None`.

Run: `scripts/pytest.sh -q` → all green.

- [ ] **Step 3: Commit**

```bash
git add server/app/corrupt.py server/app/migrations/002_session_mode.sql server/app/routers/texts.py server/app/routers/sessions.py server/app/routers/stats.py server/app/schemas.py server/tests/test_corrupt.py server/tests/test_sessions.py
git commit -m "Add Grimoire corrompu corruption engine, /corrupt endpoint and grimoire session mode" -- server/app/corrupt.py server/app/migrations/002_session_mode.sql server/app/routers/texts.py server/app/routers/sessions.py server/app/routers/stats.py server/app/schemas.py server/tests/test_corrupt.py server/tests/test_sessions.py
```

---

### Task 5: Bibliothèque d'Alexandrie — allowlist, fetchers, cleaning, chunking, filters, scoring, cache and API (server lane)

Spec §5 SP2: "server-side fetch from Wikisource FR and Project Gutenberg from an allowlist of works (author + translator with death years), cleaning, old-spelling filter, chunking to 80–200 words, dialogue/verse/proper-noun filters, scoring by agreement density and difficulty; cached." Spec §4: "No external API calls at runtime except [...] Wikisource/Gutenberg fetching (server-side, cached)." Decisions 9–11. Two commits (pipeline, then API).

**Files:**
- Create: `content/alexandria/works.json`, `server/app/alexandria/__init__.py`, `allowlist.py`, `fetch.py`, `clean.py`, `chunk.py`, `filters.py`, `score.py`, `service.py`, `server/app/routers/alexandria.py`, `server/app/migrations/003_alexandria.sql`, `server/app/tools/alexandria_check.py`, `server/tests/fixtures/alexandria/wikisource/vingt-mille-lieues-sous-les-mers-partie-1-chapitre-1.html` (snapshot), `server/tests/fixtures/alexandria/gutenberg/pg99999.txt` (handcrafted), `server/tests/test_alexandria_pipeline.py`, `server/tests/test_alexandria_api.py`
- Modify: `server/app/config.py` (`alexandria_offline_dir`), `server/app/main.py` (router), `server/requirements.txt` (`httpx>=0.27,<1`), `server/tests/conftest.py` (copy `alexandria/works.json`; `settings` gets `alexandria_offline_dir=fixtures dir`)

**Interfaces:**
- Consumes: `Lexicon.is_known/lookup` (Task 1), `annotate` via the app annotator (Task 2), `build_credits`, `word_count`, `get_db`, `get_annotator`.
- Produces:
  ```python
  # allowlist.py
  PD_YEAR = 1956
  @dataclass(frozen=True) class Work: id: str; title: str; author: str; author_death: int; translator: str | None; translator_death: int | None;
                                       source: str; pages: tuple[str, ...]; ebook_id: int | None; level_hint: str; note: str
  def load_allowlist(content_dir: Path) -> list[Work]     # drops entries with unknown/≥ 1956 death years, unknown source or level (warning via logging)
  def credits_of(work: Work) -> str                        # build_credits(author, title, translator)
  # fetch.py
  class FetchError(Exception): ...
  WIKISOURCE_API = "https://fr.wikisource.org/w/api.php"
  GUTENBERG_URLS = ("https://www.gutenberg.org/cache/epub/{id}/pg{id}.txt", "https://www.gutenberg.org/cache/epub/{id}/pg{id}-0.txt")
  USER_AGENT = "LaDiscorde/0.2 (educational dictation game for a family LAN; no contact form) python-httpx"
  def page_slug(title: str) -> str                         # NFKD, strip accents, lowercase, [^a-z0-9]+ → '-', strip '-'
  class Fetcher(Protocol):
      def wikisource_page(self, title: str) -> str          # HTML (the API's parse.text)
      def gutenberg_text(self, ebook_id: int) -> str
  class HttpFetcher: def __init__(self, client: httpx.Client | None = None, timeout: float = 20.0)
  class OfflineFetcher: def __init__(self, root: Path)      # reads root/wikisource/<slug>.html, root/gutenberg/pg<id>.txt; FetchError when missing
  def make_fetcher(settings) -> Fetcher
  # clean.py
  @dataclass class Paragraph: text: str; kind: str          # 'prose' | 'verse'
  def wikisource_html_to_paragraphs(html: str) -> list[Paragraph]
  def gutenberg_text_to_paragraphs(txt: str) -> list[Paragraph]
  def clean_text(text: str) -> str
  # chunk.py
  def split_sentences(text: str) -> list[str]
  def make_chunks(paragraphs: list[Paragraph], min_words=80, max_words=200, target=130) -> list[dict]   # {"body", "word_count", "sentences": [..], "verse": bool}
  # filters.py
  def chunk_verdict(chunk: dict, lexicon) -> str | None     # None = accepted; else 'digits' | 'verse' | 'dialogue' | 'proper_nouns' | 'old_spelling' | 'unknown_words'
  # score.py
  LEVEL_THRESHOLDS = [("5H", 10, 0.03), ("6H", 12, 0.04), ("7H", 15, 0.05), ("8H", 18, 0.06), ("9H", 22, 0.08), ("10H", 27, 0.10)]
  def chunk_features(body: str, annotation: dict, lexicon) -> dict   # {"agreement_density", "avg_sentence_len", "rare_ratio", "chain_targets"}
  def level_for(features: dict, level_hint: str) -> str
  def score_for(features: dict) -> float                    # round(100 * agreement_density, 1)
  # service.py
  def refresh_work(conn, work, fetcher, annotate_fn, lexicon, max_pages=40) -> dict   # {"status", "error", "chunk_count", "rejected": {reason: n}}
  def list_works(conn, works) -> list[dict]; def list_chunks(conn, work_id, level=None) -> list[dict]
  def adopt_chunk(conn, chunk_id, profile_id, title=None) -> tuple[sqlite3.Row, bool]   # (text row, created)
  ```

- [ ] **Step 1: Migration, config, allowlist file**

`server/app/migrations/003_alexandria.sql`:
```sql
-- SP2: Bibliothèque d'Alexandrie cache. A work is an allowlist entry (content/alexandria/works.json); chunks are candidate passages.
CREATE TABLE online_work (
  id          TEXT PRIMARY KEY,
  status      TEXT NOT NULL CHECK (status IN ('ok', 'error')),
  error       TEXT,
  fetched_at  TEXT NOT NULL,
  stats_json  TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE online_chunk (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id         TEXT NOT NULL REFERENCES online_work(id) ON DELETE CASCADE,
  seq             INTEGER NOT NULL,
  body            TEXT NOT NULL,
  word_count      INTEGER NOT NULL,
  level           TEXT NOT NULL,
  score           REAL NOT NULL,
  features_json   TEXT NOT NULL DEFAULT '{}',
  annotation_json TEXT NOT NULL DEFAULT '{}',
  text_id         INTEGER REFERENCES text(id) ON DELETE SET NULL,
  UNIQUE (work_id, seq)
);
CREATE INDEX online_chunk_work_score ON online_chunk(work_id, score DESC);
```
`config.py`: add `alexandria_offline_dir: Path | None = None` read from `DISCORDE_ALEXANDRIA_OFFLINE_DIR` (`Path(v) if v else None`).

`content/alexandria/works.json` — schema `{"version": 1, "works": [...]}`; each work: `id, title, author, author_death, translator, translator_death, source ("wikisource"|"gutenberg"), pages (list of page titles, wikisource) | ebook_id (int, gutenberg), level_hint, note`. Ship these entries (page titles marked **verified** come from the SP1 seed import and are known to exist; the others must be checked with the tool in Step 6 and removed if they 404 — do not invent replacements):

| id | author (death) / translator (death) | source, pages | level_hint |
|---|---|---|---|
| `perrault-contes` | Charles Perrault (1703) | wikisource: `Contes_de_Perrault_(éd._1902)/Le_petit_Chaperon_rouge` **verified**, `Contes_de_Perrault_(éd._1902)/Le_maître_Chat_ou_le_Chat_botté` **verified**, `Contes_de_Perrault_(éd._1902)/Cendrillon_ou_la_petite_Pantoufle_de_verre`, `Contes_de_Perrault_(éd._1902)/La_Belle_au_bois_dormant`, `Contes_de_Perrault_(éd._1902)/Le_Petit_Poucet` | 6H |
| `andersen-soldi` | Hans Christian Andersen (1875) / David Soldi (1884) | `Contes_d’Andersen/Le_Vilain_Petit_Canard` **verified**, `Contes_d’Andersen/La_Petite_Sirène` **verified**, `Contes_d’Andersen/La_Reine_des_neiges`, `Contes_d’Andersen/Les_Habits_neufs_du_grand-duc`, `Contes_d’Andersen/La_Princesse_sur_un_pois` | 6H |
| `grimm-baudry` | Jacob et Wilhelm Grimm (1863) / Frédéric Baudry (1885) | `Contes_choisis_des_frères_Grimm/Les_Musiciens_de_Brême` **verified**, `Contes_choisis_des_frères_Grimm/Le_Vaillant_Petit_Tailleur`, `Contes_choisis_des_frères_Grimm/Les_Trois_Fileuses` | 6H |
| `carroll-bue` | Lewis Carroll (1898) / Henri Bué (1929) | `Alice_au_pays_des_merveilles/1` **verified** … `/12` | 7H |
| `daudet-moulin` | Alphonse Daudet (1897) | `Lettres_de_mon_moulin/La_chèvre_de_monsieur_Seguin` **verified**, `Lettres_de_mon_moulin/Les_étoiles` **verified**, `Lettres_de_mon_moulin/Le_secret_de_maître_Cornille`, `Lettres_de_mon_moulin/La_mule_du_pape`, `Lettres_de_mon_moulin/Installation` | 8H |
| `kipling-fabulet` | Rudyard Kipling (1936) / Louis Fabulet (1933) et Robert d'Humières (1915) | `Le_Livre_de_la_jungle_(trad._Fabulet_et_Humières)/Les_Frères_de_Mowgli` **verified**, `Le_Livre_de_la_jungle_(trad._Fabulet_et_Humières)/«_Rikki-Tikki-Tavi_»` **verified**, `Le_Livre_de_la_jungle_(trad._Fabulet_et_Humières)/La_Chasse_de_Kaa`, `Le_Livre_de_la_jungle_(trad._Fabulet_et_Humières)/Le_Phoque_blanc`, `Le_Livre_de_la_jungle_(trad._Fabulet_et_Humières)/Toomai_des_Éléphants` | 8H |
| `renard-poil-de-carotte` | Jules Renard (1910) | `Poil_de_Carotte/01` **verified**, `Poil_de_Carotte/02` … `/10` | 8H |
| `verne-vingt-mille-lieues` | Jules Verne (1905) | `Vingt_mille_lieues_sous_les_mers/Partie_1/Chapitre_1` … `/Chapitre_24` (`/Chapitre_17` **verified**) | 9H |
| `verne-tour-du-monde` | Jules Verne (1905) | `Le_Tour_du_monde_en_quatre-vingts_jours/Chapitre_1` **verified** … `/Chapitre_37` | 9H |
| `verne-centre-terre` | Jules Verne (1905) | `Voyage_au_centre_de_la_Terre/Chapitre_1` … `/Chapitre_45` (`/Chapitre_17` **verified**) | 10H |
| `sand-fadette` | George Sand (1876) | `La_Petite_Fadette/1` … `/40` (`/2` **verified**) | 9H |
| `dumas-mousquetaires` | Alexandre Dumas (1870) | `Les_Trois_Mousquetaires/Chapitre_1` **verified** … `/Chapitre_20` | 10H |
| `maupassant-contes` | Guy de Maupassant (1893) | `Contes_du_jour_et_de_la_nuit_(éd._Flammarion,_1885)/La_Parure` **verified**, `La_Maison_Tellier_(recueil,_Ollendorff_1891)/Le_Papa_de_Simon` **verified** (note: chunks are filtered, the first paragraph's grim line is rejected by the dialogue filter or must be excluded by `skip_prefix`), `Les_Contes_de_la_bécasse/La_Ficelle` | 11H |
| `topffer-genevoises` | Rodolphe Töpffer (1846) | `Le_Col_d’Anterne` **verified**, `La_Bibliothèque_de_mon_oncle` | 11H |
| `ramuz-aline` | Charles-Ferdinand Ramuz (1947) | `Aline_(Ramuz)/I` **verified** … `/X` | 11H |
| `twain-hughes` | Mark Twain (1910) / William-Little Hughes (1887) | `Les_Aventures_de_Tom_Sawyer/Chapitre_1` … `/Chapitre_10` | 9H |
| `stevenson-laurie` | Robert Louis Stevenson (1894) / André Laurie (1909) | `L’Île_au_trésor_(trad._Laurie)/Chapitre_1` … `/Chapitre_6` — if the transcription is only in the `Page:` namespace (as in SP1), drop the work and note it | 9H |
| `poe-baudelaire` | Edgar Allan Poe (1849) / Charles Baudelaire (1867) | `Histoires_extraordinaires/Le_Scarabée_d’or`, `Histoires_extraordinaires/Aventure_sans_pareille_d’un_certain_Hans_Pfaall`, `Histoires_extraordinaires/Manuscrit_trouvé_dans_une_bouteille` — carefully chosen, no murder tales | 11H |
| `gutenberg-verne-tour` | Jules Verne (1905) | gutenberg `ebook_id: 800` (verify the header title is *Le Tour du monde en quatre-vingts jours*) | 9H |
| `gutenberg-dumas-mousquetaires` | Alexandre Dumas (1870) | gutenberg `ebook_id: 13951` (verify) | 10H |

Each entry gets a `note` string for the "verify" status; the tool (Step 6) is the source of truth. Homer/Bérard is intentionally absent (Decision 9); say so in a top-level `"excluded"` list with the reason.

- [ ] **Step 2: Failing pipeline tests `server/tests/test_alexandria_pipeline.py`**

```python
from pathlib import Path
from app.alexandria.allowlist import load_allowlist
from app.alexandria.chunk import make_chunks, split_sentences
from app.alexandria.clean import Paragraph, clean_text, gutenberg_text_to_paragraphs, wikisource_html_to_paragraphs
from app.alexandria.fetch import FetchError, OfflineFetcher, page_slug
from app.alexandria.filters import chunk_verdict
from app.alexandria.score import level_for, score_for

FIX = Path(__file__).parent / "fixtures" / "alexandria"
CONTENT = Path(__file__).resolve().parents[2] / "content"
PROSE = ("Le vieux marin regardait la mer. Les vagues grises montaient lentement vers la plage, et les mouettes criaient au-dessus des rochers. "
         "Il pensait aux voyages anciens, aux tempêtes et aux ports lointains où les hommes chantaient le soir. ")


def test_allowlist_rejects_unknown_or_recent_deaths(tmp_path):
    (tmp_path / "alexandria").mkdir()
    (tmp_path / "alexandria" / "works.json").write_text('''{"version": 1, "works": [
      {"id": "ok", "title": "T", "author": "A", "author_death": 1900, "translator": "B", "translator_death": 1950, "source": "wikisource", "pages": ["P"], "level_hint": "8H", "note": ""},
      {"id": "recent", "title": "T", "author": "A", "author_death": 1900, "translator": "B", "translator_death": 1960, "source": "wikisource", "pages": ["P"], "level_hint": "8H", "note": ""},
      {"id": "unknown", "title": "T", "author": "A", "author_death": null, "translator": null, "translator_death": null, "source": "wikisource", "pages": ["P"], "level_hint": "8H", "note": ""}]}''', encoding="utf-8")
    assert [w.id for w in load_allowlist(tmp_path)] == ["ok"]


def test_shipped_allowlist_is_valid():
    works = load_allowlist(CONTENT)
    assert len(works) >= 12 and all(w.author_death < 1956 and (w.translator_death or 0) < 1956 for w in works)
    assert not any("bérard" in (w.translator or "").lower() for w in works)


def test_page_slug_and_offline_fetcher():
    assert page_slug("Vingt_mille_lieues_sous_les_mers/Partie_1/Chapitre_1") == "vingt-mille-lieues-sous-les-mers-partie-1-chapitre-1"
    assert page_slug("Contes_d’Andersen/La_Petite_Sirène") == "contes-d-andersen-la-petite-sirene"
    f = OfflineFetcher(FIX)
    assert "<p>" in f.wikisource_page("Vingt_mille_lieues_sous_les_mers/Partie_1/Chapitre_1")
    assert "START OF" in f.gutenberg_text(99999)
    try:
        f.wikisource_page("Nope")
        assert False
    except FetchError:
        pass


def test_wikisource_html_cleaning():
    html = ('<div class="mw-parser-output"><span class="pagenum">12</span><h2>Chapitre I</h2>'
            '<p>Les fées dansent<sup class="reference">[1]</sup> dans la clairière.<br/>Elles chantent.</p>'
            '<div class="poem"><p>Ô vagues,<br/>ô rochers !</p></div>'
            '<table><tr><td>ignored</td></tr></table><ol class="references"><li>note</li></ol>'
            '<p>Le vent   emporte «leurs» chansons — très-loin.</p></div>')
    paras = wikisource_html_to_paragraphs(html)
    assert [p.kind for p in paras] == ["prose", "verse", "prose"]
    assert paras[0].text == "Les fées dansent dans la clairière. Elles chantent."
    assert paras[2].text == "Le vent emporte « leurs » chansons — très loin."


def test_gutenberg_cleaning_and_verse():
    txt = (FIX / "gutenberg" / "pg99999.txt").read_text(encoding="utf-8")
    paras = gutenberg_text_to_paragraphs(txt)
    assert all("Project Gutenberg" not in p.text for p in paras)
    assert any(p.kind == "verse" for p in paras) and any(p.kind == "prose" for p in paras)


def test_clean_text_footnotes_and_quotes():
    assert clean_text("Il[2] dit (3) : « oui »… l’ami !") == "Il dit : « oui »… l'ami !"


def test_split_sentences_guards_abbreviations():
    s = split_sentences("M. Seguin n'avait jamais eu de bonheur avec ses chèvres. Il les perdait toutes ! « Où vont-elles ? » Il ne savait pas.")
    assert s == ["M. Seguin n'avait jamais eu de bonheur avec ses chèvres.", "Il les perdait toutes !", "« Où vont-elles ? »", "Il ne savait pas."]


def test_make_chunks_respects_bounds_and_sentence_boundaries():
    paras = [Paragraph(PROSE * 3, "prose"), Paragraph(PROSE * 2, "prose"), Paragraph("Fin.", "prose")]
    chunks = make_chunks(paras)
    assert chunks and all(80 <= c["word_count"] <= 200 for c in chunks)
    for c in chunks:
        assert c["body"][0].isupper() and c["body"].rstrip()[-1] in ".!?»"
    long_sentence = " ".join(["mot"] * 250) + "."
    assert make_chunks([Paragraph(long_sentence, "prose")]) == []


def test_chunk_verdicts(lexicon):
    ok = {"body": PROSE * 2, "word_count": 100, "sentences": split_sentences(PROSE * 2), "verse": False}
    assert chunk_verdict(ok, lexicon) is None
    assert chunk_verdict({**ok, "body": "En 1866, " + PROSE * 2}, lexicon) == "digits"
    assert chunk_verdict({**ok, "verse": True}, lexicon) == "verse"
    dialogue = "— Oui, dit-il. — Non, dit-elle. — Peut-être. " + PROSE
    assert chunk_verdict({**ok, "body": dialogue, "sentences": split_sentences(dialogue)}, lexicon) == "dialogue"
    old = PROSE + "Les hommes chantoient et les enfans jouoient sur la plage. "
    assert chunk_verdict({**ok, "body": old * 2}, lexicon) == "old_spelling"
    names = PROSE + "Achille, Hector, Priam, Hélène, Pâris, Ménélas, Agamemnon, Ulysse, Nestor, Ajax et Diomède parlaient. "
    assert chunk_verdict({**ok, "body": names}, lexicon) == "proper_nouns"
    gibberish = PROSE + "Le zorglub frimbait les cratouilles vlomes. "
    assert chunk_verdict({**ok, "body": gibberish}, lexicon) == "unknown_words"


def test_level_and_score():
    easy = {"agreement_density": 0.30, "avg_sentence_len": 9, "rare_ratio": 0.01, "chain_targets": 30}
    hard = {"agreement_density": 0.20, "avg_sentence_len": 30, "rare_ratio": 0.12, "chain_targets": 20}
    assert level_for(easy, "5H") == "5H" and level_for(easy, "8H") == "8H" and level_for(hard, "5H") == "11H"
    assert score_for(easy) == 30.0
```
`server/tests/fixtures/alexandria/gutenberg/pg99999.txt` (handcraft): the standard header lines ending with `*** START OF THE PROJECT GUTENBERG EBOOK TEST ***`, a title line, two prose paragraphs of ≥ 60 words each (blank-line separated; write plain French prose about the sea), a verse block of 6 short lines (< 50 chars, capitalised), another prose paragraph, then `*** END OF THE PROJECT GUTENBERG EBOOK TEST ***` and licence boilerplate.

Snapshot fixture `wikisource/vingt-mille-lieues-sous-les-mers-partie-1-chapitre-1.html`: fetch once (implementation time only, never in tests):
`scripts/py.sh python -c "import httpx,json,sys; r=httpx.get('https://fr.wikisource.org/w/api.php', params={'action':'parse','format':'json','formatversion':2,'prop':'text','disabletoc':1,'page':'Vingt_mille_lieues_sous_les_mers/Partie_1/Chapitre_1'}, headers={'User-Agent':'LaDiscorde/0.2 fixture snapshot'}, timeout=30); open('/work/server/tests/fixtures/alexandria/wikisource/vingt-mille-lieues-sous-les-mers-partie-1-chapitre-1.html','w',encoding='utf-8').write(r.json()['parse']['text'])"`. Keep it (public-domain text, CC BY-SA transcription — add a one-line `SOURCE.md` next to it with the URL and date). Must be < 300 KB.

Run: `scripts/pytest.sh tests/test_alexandria_pipeline.py -v` → FAIL.

- [ ] **Step 3: Implement the pipeline modules**

- `allowlist.py`: `json.load`; for each entry, skip (log `warning`) when `author_death is None or ≥ PD_YEAR`, or `translator` given with `translator_death None or ≥ PD_YEAR`, or `source not in {"wikisource","gutenberg"}`, or `level_hint not in LEVELS`; `pages = tuple(entry.get("pages", []))`; `lru_cache`.
- `fetch.py`: `HttpFetcher.wikisource_page`: `GET WIKISOURCE_API` with `params={"action":"parse","format":"json","formatversion":2,"prop":"text","disabletoc":1,"page":title}`, header `User-Agent`; raise `FetchError(str(e))` on `httpx.HTTPError`, non-200, missing `parse.text`, or an `error` key. `gutenberg_text`: try each URL in `GUTENBERG_URLS`, first 200 wins, decode UTF-8 (`errors="replace"`). `OfflineFetcher`: read files or raise `FetchError("fichier introuvable: ...")`. `make_fetcher(settings)`: `OfflineFetcher(settings.alexandria_offline_dir)` when set, else `HttpFetcher()`.
- `clean.py`: an `HTMLParser` subclass tracking a stack of "skipped" depth (enter skip on tags in `{"table","style","script","sup","h1","h2","h3","h4","nav","ol"}` or any element whose `class` contains one of `{"reference","references","ws-noexport","mw-editsection","pagenum","ws-summary","ws-header","ws-footer","noprint","mw-references-wrap","toc"}`), a `verse` flag while inside `div.poem`, collecting text of `<p>` (with `<br>` → `"\n"`); each collected paragraph → `clean_text`, newlines inside a paragraph → spaces; empty ones dropped. `gutenberg_text_to_paragraphs`: cut between the first line containing `*** START OF` and the first line containing `*** END OF`; split on blank lines; a block is `verse` when it has ≥ 4 lines and every line is < 50 chars and starts with an uppercase letter; otherwise join its lines with spaces. `clean_text`: `’‘ʼ` → `'`; `“”` → `"`; NBSP variants → space; remove `\[\d+\]` and `\(\d+\)`; `«\s*` → `« `, `\s*»` → ` »`; `très-` → `très `; `–` → `—`; collapse whitespace; strip.
- `chunk.py`: `ABBREVIATIONS = ("M.", "MM.", "Mme.", "Mlle.", "Mgr.", "Dr.", "St.", "Ste.", "etc.", "cf.", "p.", "chap.")`; split with `re.split(r'(?<=[.!?…])(?:(?<=[.!?…]["»’)\]])|(?<![.!?…]["»’)\]]))\s+(?=["«(—]?[A-ZÀÂÄÉÈÊËÎÏÔÖÙÛÜÇŒÆ])', text)` — simpler and acceptable: split on `(?<=[.!?…»])\s+(?=[«"(—]?[A-ZÀÂÄÉÈÊËÎÏÔÖÙÛÜÇŒÆ])`, then merge a piece back into the previous one when the previous piece ends with an abbreviation (last token ∈ `ABBREVIATIONS`) — the test above must pass exactly. `make_chunks`: flatten to `(paragraph_index, kind, sentence)`; greedy: start at `i`, add sentences while `words < target and words + next ≤ max_words`; also stop when the paragraph ends and `words ≥ min_words`; skip a single sentence longer than `max_words`; discard a trailing chunk under `min_words`; body joins sentences with `" "` inside a paragraph and `"\n\n"` across paragraphs; `verse = any kind == "verse"`.
- `filters.py`: order of checks: `digits` (any `\d`), `verse`, `dialogue` (share of sentences starting with `—`/`«`/`"` or containing `»` > 0.30), `proper_nouns` (capitalised words not at sentence start and not preceded by `«`/`—` divided by words > 0.06), `old_spelling` (a word ending `oit`/`oient` that is unknown to the lexicon while its `oi→ai` variant is known, or words ending in `ans`/`ens` unknown while `ants`/`ents` variant is known, e.g. `enfans`), `unknown_words` (unknown ratio > 0.02, skipping capitalised words, words with digits, and elided prefixes via `lexicon.lookup`). Return the first failing reason.
- `score.py`: `chain_targets = sum(len(c["targets"]) for c in annotation["chains"] if c["confidence"] in ("high","medium"))`, `agreement_density = chain_targets / words`, `avg_sentence_len = words / max(1, len(annotation["sentences"]))`, `rare_ratio` = words whose best lexicon entry has `freq < 1.0` (or unknown) / words (skip capitalised). `level_for`: first threshold row with `avg ≤ a and rare ≤ r`, else `"11H"`; then `max(level, level_hint)` by `level_index`. `score_for = round(100 * agreement_density, 1)`.

Run: `scripts/pytest.sh tests/test_alexandria_pipeline.py -v` → 11 passed. Commit the pipeline:
```bash
git add content/alexandria server/app/alexandria server/app/migrations/003_alexandria.sql server/app/config.py server/requirements.txt server/tests/fixtures/alexandria server/tests/test_alexandria_pipeline.py
git commit -m "Add Alexandria corpus pipeline: allowlist, fetchers, cleaning, chunking, filters, scoring" -- content/alexandria server/app/alexandria server/app/migrations/003_alexandria.sql server/app/config.py server/requirements.txt server/tests/fixtures/alexandria server/tests/test_alexandria_pipeline.py
```

- [ ] **Step 4: Failing API tests `server/tests/test_alexandria_api.py`**

`conftest.py`: the `settings` fixture copies `content/alexandria/works.json` into `content/alexandria/` of the temp dir and sets `alexandria_offline_dir=Path(__file__).parent / "fixtures" / "alexandria"`.
```python
import json
from pathlib import Path
from fastapi.testclient import TestClient
from app.main import create_app

WORKS = {"version": 1, "works": [
    {"id": "verne", "title": "Vingt mille lieues sous les mers", "author": "Jules Verne", "author_death": 1905, "translator": None, "translator_death": None,
     "source": "wikisource", "pages": ["Vingt_mille_lieues_sous_les_mers/Partie_1/Chapitre_1", "Vingt_mille_lieues_sous_les_mers/Partie_1/Chapitre_2"], "level_hint": "9H", "note": ""},
    {"id": "missing", "title": "Absent", "author": "X", "author_death": 1800, "translator": None, "translator_death": None,
     "source": "wikisource", "pages": ["Nope"], "level_hint": "8H", "note": ""},
    {"id": "gut", "title": "Test Gutenberg", "author": "Y", "author_death": 1800, "translator": None, "translator_death": None,
     "source": "gutenberg", "pages": [], "ebook_id": 99999, "level_hint": "8H", "note": ""}]}


def make_client(settings):
    (settings.content_dir / "alexandria" / "works.json").write_text(json.dumps(WORKS), encoding="utf-8")
    return TestClient(create_app(settings))


def test_works_listing_and_refresh_partial_and_error(settings):
    with make_client(settings) as client:
        works = client.get("/api/alexandria/works").json()
        assert [w["id"] for w in works] == ["verne", "missing", "gut"] and works[0]["status"] == "never" and works[0]["credits"] == "Jules Verne, Vingt mille lieues sous les mers"
        r = client.post("/api/alexandria/works/verne/refresh")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "ok" and d["chunk_count"] >= 2 and d["rejected"].get("digits", 0) >= 1
        assert "1 page" in d["error"]                           # partial: Chapitre_2 has no fixture → note, not failure
        r = client.post("/api/alexandria/works/missing/refresh")
        assert r.status_code == 200 and r.json()["status"] == "error" and r.json()["chunk_count"] == 0
        assert "inaccessible" in r.json()["error"]
        r = client.post("/api/alexandria/works/gut/refresh")
        assert r.status_code == 200 and r.json()["status"] == "ok" and r.json()["chunk_count"] >= 1
        assert client.post("/api/alexandria/works/unknown/refresh").status_code == 404
        works = {w["id"]: w for w in client.get("/api/alexandria/works").json()}
        assert works["verne"]["status"] == "ok" and works["missing"]["status"] == "error" and works["verne"]["chunk_count"] >= 2


def test_chunks_and_adopt(settings):
    with make_client(settings) as client:
        client.post("/api/alexandria/works/verne/refresh")
        chunks = client.get("/api/alexandria/works/verne/chunks").json()
        assert chunks == sorted(chunks, key=lambda c: -c["score"])
        c = chunks[0]
        assert 80 <= c["word_count"] <= 200 and c["level"] in ("9H", "10H", "11H") and c["text_id"] is None and len(c["preview"]) <= 140
        assert all(ch["level"] == "9H" for ch in client.get("/api/alexandria/works/verne/chunks?level=9H").json())
        p = client.post("/api/profiles", json={"name": "Léa", "avatar": "chouette", "level": "10H"}).json()
        r = client.post(f"/api/alexandria/chunks/{c['id']}/adopt", json={"profile_id": p["id"]})
        assert r.status_code == 201, r.text
        t = r.json()
        assert t["source"] == "online" and t["author"] == "Jules Verne" and t["title"].startswith("Vingt mille lieues") and t["level"] == c["level"]
        assert t["annotation"]["version"] == 2 and t["added_by_profile_id"] == p["id"]
        again = client.post(f"/api/alexandria/chunks/{c['id']}/adopt", json={"profile_id": p["id"]})
        assert again.status_code == 200 and again.json()["id"] == t["id"]
        assert client.get("/api/alexandria/works/verne/chunks").json()[0]["text_id"] == t["id"]
        assert client.post("/api/alexandria/chunks/999999/adopt", json={"profile_id": p["id"]}).status_code == 404
```
Run: `scripts/pytest.sh tests/test_alexandria_api.py -v` → FAIL.

- [ ] **Step 5: Implement `service.py`, `routers/alexandria.py`, wire `main.py`**

`service.py`:
- `refresh_work`: `pages_ok = 0`, `failed = 0`, `paragraphs = []`; for each page (wikisource) or the ebook (gutenberg), `try: fetch → paragraphs += clean(...); pages_ok += 1 except FetchError as e: failed += 1; last_error = str(e)`. If `pages_ok == 0` → upsert `online_work(status='error', error="La Bibliothèque d'Alexandrie est inaccessible pour le moment (" + last_error + ")")`, return `{"status": "error", "error": ..., "chunk_count": 0, "rejected": {}}`. Else `chunks = make_chunks(paragraphs)`; `rejected = Counter()`; for each chunk: `reason = chunk_verdict(chunk, lexicon)`; if reason → `rejected[reason] += 1`, continue; `annotation = annotate_fn(body)`; `feat = chunk_features(...)`; keep `(body, word_count, level_for(feat, work.level_hint), score_for(feat), feat, annotation)`. `DELETE FROM online_chunk WHERE work_id = ?`, insert kept rows with `seq` from 1, upsert `online_work(status='ok', error=note, fetched_at=now, stats_json={pages_ok, failed, rejected})` where `note = f"{failed} page(s) n'ont pas pu être lues." if failed else None`; commit; return the dict.
- `list_works`: LEFT JOIN of the allowlist with `online_work` and `COUNT(online_chunk)`; status `'never'` when no row.
- `list_chunks`: `SELECT id, seq, level, word_count, score, body, text_id FROM online_chunk WHERE work_id = ? [AND level = ?] ORDER BY score DESC, seq`; `preview` = first 140 characters cut at a word boundary + `…`.
- `adopt_chunk`: 404 if unknown; if `text_id` set and the text exists → `(row, False)`; else insert into `text` with `source='online'`, `title = title or f"{work.title} — rouleau {seq}"`, `body`, `level`, `author`, `translator`, `work=work.title`, `credits=credits_of(work)`, `added_by_profile_id`, `annotation_json` copied from the chunk; update `online_chunk.text_id`; commit; `(row, True)`.

`routers/alexandria.py`: prefix `/api/alexandria`; dependency `get_fetcher(request)` → `request.app.state.fetcher` if set else `make_fetcher(settings)`; `refresh` uses `get_annotator` and `load_lexicon(settings.content_dir)`; `adopt` returns `to_full(fetch_text(db, row["id"]), data_dir=...)` from `app.routers.texts` with status 201/200 via `Response`/`JSONResponse(status_code=...)`. `main.py`: `app.include_router(alexandria.router)`.

Run: `scripts/pytest.sh -q` → all green. Then the lane gate: `scripts/check.sh` → `== ALL GREEN` (the web lane may still be mid-flight; if only web tests fail for reasons outside this lane, say so in the report and re-run after Task 10).

- [ ] **Step 6: Live allowlist check tool (manual, network allowed here only)**

`server/app/tools/alexandria_check.py`: for each work in the shipped allowlist, use `HttpFetcher` to fetch every page/ebook, run cleaning + chunking + filters, and print one line per page: `OK <work> <page> words=<n> chunks=<accepted>/<total> rejected=<counter>` or `FAIL <work> <page> <error>`; a final summary per work. Run: `scripts/py.sh python -m app.tools.alexandria_check` (takes minutes). Remove from `works.json` every page that FAILs; drop a work whose accepted chunk total is 0; note the results in `content/alexandria/works.json` `note` fields (e.g. `"vérifié 2026-09-24"`). Paste the summary in your report. Re-run `scripts/pytest.sh tests/test_alexandria_pipeline.py -q` (the shipped-allowlist test) afterwards.

- [ ] **Step 7: Commit**

```bash
git add content/alexandria server/app/alexandria server/app/routers/alexandria.py server/app/main.py server/app/tools/alexandria_check.py server/tests/conftest.py server/tests/test_alexandria_api.py
git commit -m "Add Alexandria API: cached works and chunks, refresh with graceful failures, adoption into the library" -- content/alexandria server/app/alexandria server/app/routers/alexandria.py server/app/main.py server/app/tools/alexandria_check.py server/tests/conftest.py server/tests/test_alexandria_api.py
```

---

### Task 6: Grading v2 — 1990 reform acceptance, lexicon forms, sound-alikes, chain-aware subcategories (web lane)

Spec §5 SP2: "1990 spelling reform variants accepted"; "subcategory classification of agreement errors". Decisions 4–6. Absorbs deferred minor: Unicode hyphen U+2010 inside words. Depends only on the "Annotation v2" contract.

**Files:**
- Create: `content/reform1990.json`, `web/src/lib/grading/reform.ts`, `web/src/lib/grading/reform.test.ts`
- Modify: `web/src/lib/grading/types.ts`, `web/src/lib/grading/tokenize.ts` (+ `tokenize.test.ts`), `web/src/lib/grading/classify.ts` (+ `classify.test.ts`), `web/src/lib/grading/index.ts` (export reform), `web/src/lib/types.ts` (`Annotation` re-exported from `./grading/types` instead of the loose local interface)

**Interfaces:**
- Consumes: SP1 `normalizeWord`, `tokenize`, `classifyPair`, `Token`, `AnnotToken`.
- Produces (`types.ts` additions):
  ```ts
  export interface FormFeatures { g: 'm' | 'f' | null; n: 's' | 'p' | null }
  export type ChainKind = 'subject_verb' | 'nominal' | 'attribute' | 'participle_etre' | 'participle_avoir';
  export type Confidence = 'high' | 'medium' | 'low';
  export interface Chain { id: number; kind: ChainKind; controller: number; controller_group: number[]; targets: number[];
    via: 'qui' | 'conj' | 'aux' | 'que' | null; via_token: number | null; features: Record<string, string>; confidence: Confidence; distance: number;
    rule: 'no_agreement' | 'cod_before' | null }
  export interface AnnotToken { /* SP1 fields */ forms?: Record<string, FormFeatures>; sound_alikes?: string[]; chains?: number[] }
  export interface Annotation { version: number; model: string; tokens: AnnotToken[]; sentences: { start: number; end: number }[]; chains?: Chain[] }
  export type ErrorSub = AgreementSub | 'verb_ending' | 'missing' | 'extra' | 'sound_alike';
  ```
- Produces (`reform.ts`):
  ```ts
  export const NUMBER_WORDS: string[];                       // un deux trois … seize vingt vingts trente quarante cinquante soixante cent cents mille million millions milliard milliards et
  export function numberHyphensToSpaces(text: string): string; // same length as input: hyphens between two number words become spaces (case-insensitive, iterated)
  export function reformCanon(norm: string): string;         // explicit pairs → traditional spelling; -eler/-eter reform forms → doubled-consonant form; î/û → i/u unless protected
  export function isReformEquivalent(a: string, b: string): boolean; // reformCanon(a) === reformCanon(b)
  ```

- [ ] **Step 1: `content/reform1990.json`**

```json
{
  "version": 1,
  "pairs": [
    ["oignon", "ognon"], ["nénuphar", "nénufar"], ["événement", "évènement"], ["réglementaire", "règlementaire"], ["réglementation", "règlementation"],
    ["réglementer", "règlementer"], ["allégement", "allègement"], ["céleri", "cèleri"], ["crémerie", "crèmerie"], ["sécheresse", "sècheresse"],
    ["ambiguë", "ambigüe"], ["aiguë", "aigüe"], ["exiguë", "exigüe"], ["contiguë", "contigüe"], ["ambiguïté", "ambigüité"], ["ciguë", "cigüe"],
    ["chariot", "charriot"], ["imbécillité", "imbécilité"], ["combatif", "combattif"], ["combativité", "combattivité"], ["persifler", "persiffler"],
    ["boursoufler", "boursouffler"], ["boursouflure", "boursoufflure"], ["interpeller", "interpeler"], ["dentellière", "dentelière"],
    ["prunellier", "prunelier"], ["lunetier", "lunettier"], ["cahute", "cahutte"], ["week-end", "weekend"], ["porte-monnaie", "portemonnaie"],
    ["tire-bouchon", "tirebouchon"], ["chauve-souris", "chauvesouris"], ["mille-pattes", "millepattes"], ["mille-feuille", "millefeuille"],
    ["pique-nique", "piquenique"], ["cache-cache", "cachecache"], ["croque-monsieur", "croquemonsieur"], ["cow-boy", "cowboy"], ["hot-dog", "hotdog"],
    ["pop-corn", "popcorn"], ["plate-forme", "plateforme"], ["auto-stop", "autostop"], ["bas-fond", "basfond"], ["pousse-pousse", "poussepousse"],
    ["asseoir", "assoir"], ["surseoir", "sursoir"], ["joaillier", "joailler"], ["quincaillier", "quincailler"], ["serpillière", "serpillère"],
    ["révolver", "revolver"], ["saccharine", "saccarine"], ["bonhomie", "bonhommie"], ["douceâtre", "douçâtre"], ["levraut", "levreau"],
    ["relais", "relai"], ["tocade", "toquade"], ["eczéma", "exéma"], ["sorgho", "sorgo"], ["chausse-trape", "chaussetrappe"]
  ],
  "eler_eter_stems": [
    "épel", "ruissel", "étiquet", "feuillet", "nivel", "renouvel", "ficel", "chancel", "harcel", "amoncel", "cachet", "halet", "morcel",
    "volet", "attel", "détel", "ensorcel", "grommel", "musel", "dentel", "bottel", "carrel", "décachet", "craquel", "écartel", "étincel", "martel"
  ],
  "circumflex_protected": ["dû", "mûr", "sûr", "jeûne", "jeûnes", "croît", "croîs", "crû", "crûe", "crûs", "crûes", "crût"]
}
```
Pairs are `[traditional, reform]`; both spellings are accepted; the canonical form is the traditional one. `eler_eter_stems` are infinitive stems minus `er` (the last letter is the consonant that the traditional spelling doubles before a mute e: `il ruisselle` ↔ reform `il ruissèle`).

- [ ] **Step 2: Failing tests `reform.test.ts` and additions to `tokenize.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { isReformEquivalent, numberHyphensToSpaces, reformCanon } from './reform';

describe('reformCanon', () => {
  it('maps explicit reform pairs to the traditional spelling', () => {
    expect(reformCanon('ognon')).toBe('oignon');
    expect(reformCanon('oignon')).toBe('oignon');
    expect(reformCanon('évènement')).toBe('événement');
    expect(reformCanon('weekend')).toBe('week-end');
  });
  it('drops the circumflex on i and u except protected words and verb endings', () => {
    expect(reformCanon('maître')).toBe('maitre');
    expect(reformCanon('coût')).toBe('cout');
    expect(reformCanon('dû')).toBe('dû');
    expect(reformCanon('sûr')).toBe('sûr');
    expect(reformCanon('fûmes')).toBe('fûmes');
    expect(reformCanon('fût')).toBe('fût');
    expect(reformCanon('vînt')).toBe('vînt');
    expect(reformCanon('île')).toBe('ile');
    expect(reformCanon('tête')).toBe('tête'); // ê untouched
  });
  it('folds -eler/-eter reform forms onto the doubled consonant', () => {
    expect(reformCanon('ruissèle')).toBe('ruisselle');
    expect(reformCanon('ruissèlent')).toBe('ruissellent');
    expect(reformCanon('étiquète')).toBe('étiquette');
    expect(reformCanon('appèle')).toBe('appèle'); // appeler is not in the list: unchanged
  });
  it('isReformEquivalent', () => {
    expect(isReformEquivalent('maître', 'maitre')).toBe(true);
    expect(isReformEquivalent('sur', 'sûr')).toBe(false);
  });
});

describe('numberHyphensToSpaces', () => {
  it('keeps length and only touches hyphens between number words', () => {
    expect(numberHyphensToSpaces('vingt-et-un chats')).toBe('vingt et un chats');
    expect(numberHyphensToSpaces('deux-cent-mille')).toBe('deux cent mille');
    expect(numberHyphensToSpaces('Vingt-Deux')).toBe('Vingt Deux');
    expect(numberHyphensToSpaces('porte-monnaie et un-deux')).toBe('porte-monnaie et un deux');
    expect(numberHyphensToSpaces('grand-père')).toBe('grand-père');
  });
});
```
`tokenize.test.ts` additions:
```ts
it('canonicalises reform spellings in norm but keeps the original text', () => {
  const t = tokenize('Le maître arrive.')[1];
  expect(t.text).toBe('maître');
  expect(t.norm).toBe('maitre');
});
it('splits hyphenated number words but not other compounds, with exact offsets', () => {
  const toks = tokenize('vingt-et-un porte-monnaie');
  expect(toks.map((t) => t.text)).toEqual(['vingt', 'et', 'un', 'porte-monnaie']);
  expect(toks[2]).toMatchObject({ start: 9, end: 11 });
});
it('keeps a Unicode hyphen inside a word', () => {
  expect(tokenize('grand‐père').map((t) => t.text)).toEqual(['grand‐père']);
});
```
Run: `scripts/npm.sh run test -- reform tokenize` → FAIL.

- [ ] **Step 3: Implement `reform.ts` and update `tokenize.ts`**

`reform.ts`: import `table from '@content/reform1990.json'`; build `toTraditional = new Map<string, string>()` with `pairs` (`reform → traditional`, and `traditional → traditional`); build `elerRegexes: { re: RegExp; repl: (m) => string }[]` — for each stem `S` with consonant `c = S.at(-1)` and base `b = S.slice(0, -1)`: reform pattern `^${escape(b.replace(/e$/, 'è'))}${c}(e|es|ent|era|eras|erai|erons|erez|eront|erais|erait|eraient)$` → `${b}${c}${c}$1`. `CIRCUMFLEX_PROTECTED = new Set(table.circumflex_protected)`; `VERB_ENDING = /[îû](mes|tes|t)$/`. `reformCanon(norm)`: `if (toTraditional.has(norm)) return toTraditional.get(norm)!`; for each eler regex, if it matches return the replacement; if `!CIRCUMFLEX_PROTECTED.has(norm) && !VERB_ENDING.test(norm)` → `norm.replace(/î/g, 'i').replace(/û/g, 'u')`; else `norm`. `NUMBER_WORDS` as listed; `numberHyphensToSpaces`: `const re = new RegExp(`(^|[^\\p{L}])(${NUMBER_WORDS.join('|')})-(?=(${NUMBER_WORDS.join('|')})(?![\\p{L}]))`, 'giu')`; loop `while (true) { const next = text.replace(re, '$1$2 '); if (next === text) return text; text = next; }`.

`tokenize.ts`: `const split = numberHyphensToSpaces(text)`; run `TOKEN_RE` (inner class becomes `['’ʼ‐-]`) on `split`; for each match take `raw = text.slice(start, end)`; `norm = reformCanon(normalizeWord(raw))`, `caseNorm = caseNormalizeWord(raw)`, `text: raw`. `index.ts`: `export * from './reform'`.

Run: `scripts/npm.sh run test -- reform tokenize` → green. Run the whole suite (`scripts/npm.sh run test`) — SP1 tests must stay green (normalisation of `œ`/apostrophes is untouched; `norm` only changes for reform-affected words).

- [ ] **Step 4: Failing `classify.test.ts` additions, then `classify.ts`**

```ts
import { tokenize } from './tokenize';
import type { AnnotToken } from './types';
const tk = (w: string) => tokenize(w)[0];
function ann(pos: string, morph: Record<string, string>, extra: Partial<AnnotToken> = {}): AnnotToken {
  return { i: 0, text: '', start: 0, end: 0, lemma: '', pos, morph, head: 0, dep: 'dep', categories: [], homophone: null, subject: null, ...extra };
}
describe('classify v2', () => {
  it('accepts 1990 reform spellings as correct', () => {
    expect(classifyPair(tk('maître'), tk('maitre'), undefined, -1)).toBeNull();
    expect(classifyPair(tk('oignon'), tk('ognon'), undefined, -1)).toBeNull();
    expect(classifyPair(tk('ruisselle'), tk('ruissèle'), undefined, -1)).toBeNull();
    expect(classifyPair(tk('dû'), tk('du'), undefined, -1)).toMatchObject({ category: 'accent' });
  });
  it('uses lexicon forms for irregular agreement and picks the subcategory from features', () => {
    const chevaux = ann('NOUN', { Gender: 'Masc', Number: 'Plur' }, { forms: { cheval: { g: 'm', n: 's' } } });
    expect(classifyPair(tk('chevaux'), tk('cheval'), chevaux, -1)).toMatchObject({ category: 'agreement', sub: 'number' });
    const belle = ann('ADJ', { Gender: 'Fem', Number: 'Sing' }, { forms: { beau: { g: 'm', n: 's' }, belles: { g: 'f', n: 'p' }, beaux: { g: 'm', n: 'p' } } });
    expect(classifyPair(tk('belle'), tk('beau'), belle, -1)).toMatchObject({ category: 'agreement', sub: 'gender' });
    expect(classifyPair(tk('belle'), tk('belles'), belle, -1)).toMatchObject({ category: 'agreement', sub: 'number' });
    expect(classifyPair(tk('belle'), tk('beaux'), belle, -1)).toMatchObject({ category: 'agreement', sub: 'number' });
    const parties = ann('VERB', { VerbForm: 'Part', Gender: 'Fem', Number: 'Plur' }, { forms: { parti: { g: 'm', n: 's' } } });
    expect(classifyPair(tk('parties'), tk('parti'), parties, -1)).toMatchObject({ category: 'agreement', sub: 'participle' });
    const vont = ann('VERB', { VerbForm: 'Fin', Number: 'Plur' }, { forms: { va: { g: null, n: 's' } } });
    expect(classifyPair(tk('vont'), tk('va'), vont, -1)).toMatchObject({ category: 'agreement', sub: 'verb' });
  });
  it('marks lexicon sound-alikes as lexical with a sub, still after homophone sets', () => {
    const mere = ann('NOUN', { Gender: 'Fem', Number: 'Sing' }, { sound_alikes: ['mer', 'maire'] });
    expect(classifyPair(tk('mère'), tk('mer'), mere, -1)).toMatchObject({ category: 'lexical', sub: 'sound_alike' });
    const a = ann('AUX', { VerbForm: 'Fin' }, { sound_alikes: ['à'] });
    expect(classifyPair(tk('a'), tk('à'), a, -1)).toMatchObject({ category: 'homophone' });
  });
});
```
`classify.ts` changes: (1) after Rule 1 (homophones) and before `isGenderPair`: `if (annot?.forms && Object.prototype.hasOwnProperty.call(annot.forms, t))` → return agreement with `sub: formsSub(annot, t)` where `formsSub`: VERB/AUX with `morph.VerbForm === 'Part'` → `'participle'`; VERB/AUX → `'verb'`; else `rf = { g: annot.morph.Gender === 'Fem' ? 'f' : annot.morph.Gender === 'Masc' ? 'm' : null, n: annot.morph.Number === 'Plur' ? 'p' : annot.morph.Number === 'Sing' ? 's' : null }`, `tf = annot.forms[t]`; `if (rf.n && tf.n && rf.n !== tf.n) return 'number'`; `if (rf.g && tf.g && rf.g !== tf.g) return 'gender'`; else `agreementSub(r, t, annot)`. (2) Before the final lexical return: `if (annot?.sound_alikes?.includes(t))` → `{ category: 'lexical', sub: 'sound_alike', ... }`. Nothing else changes (Rule 0 already compares `norm`, which is now reform-canonical).

Run: `scripts/npm.sh run test` → all green; `scripts/npm.sh run check` → no errors (fix the `Annotation` typing in `web/src/lib/types.ts` by re-exporting `Annotation` from `./grading/types`; SP1 screens that cast `annotation` keep compiling).

- [ ] **Step 5: Commit**

```bash
git add content/reform1990.json web/src/lib/grading web/src/lib/types.ts
git commit -m "Grading v2: accept 1990 reform spellings, lexicon forms for agreement subcategories, sound-alike lexical errors" -- content/reform1990.json web/src/lib/grading web/src/lib/types.ts
```

---

### Task 7: Chain-aware explanations and the Fil d'Ariane tool (web lane)

Spec §3.4: "Fil d'Ariane (from sub-project 2): tap a verb, then its subject; checked against the dependency parse only when the parse is high-confidence." Spec §3.5: explanations "using the subject from the annotation when available". Spec §1.3: when uncertain, skip. Requires SP1 Tasks 11–12 (`Proofreading.svelte`, `TokenText.svelte`, `Results.svelte`, `explain.ts`) in the tree.

**Files:**
- Create: `web/src/lib/chains.ts`, `web/src/lib/chains.test.ts`, `web/src/lib/fil.ts`, `web/src/lib/fil.test.ts`
- Modify: `web/src/lib/explain.ts` (+ `explain.test.ts`), `web/src/lib/grading/types.ts` (`SessionResult.tools?`), `web/src/lib/playState.ts` (`fil?`), `web/src/components/TokenText.svelte` (fil classes; also add `data-testid="tok-{piece.index}"` to the token `<button>` — Task 11/12's e2e specs locate tokens by `[data-testid^="tok-"]`, and the current SP1 draft only sets `aria-label`), `web/src/components/WordEditor.svelte` (add `data-testid="word-editor"` on the `<input>` — needed by Task 11's `grimoire.spec.ts`, not present in the current SP1 draft), `web/src/components/Proofreading.svelte` (Fil mode; also add `data-testid="btn-done-proofreading"` on the "J'ai terminé ma relecture" button), `web/src/components/Results.svelte` (threads line; also add `data-testid="results-catch-rate"` on the hero-line catch-rate paragraph and `data-testid="btn-back-library"` on "Retour aux Parchemins" — all consumed by Tasks 9/11/12 but absent from the current SP1 draft), `web/src/screens/Play.svelte` (`tools` in the submitted result; pass `level` and `body` to explanations)

*Pre-flight note:* as of this plan's writing, SP1 Tasks 11–12 are still in progress in the tree (`Results.svelte`/`explain.ts` uncommitted) and do **not** yet carry the `tok-<i>`, `word-editor`, `btn-done-proofreading`, `btn-back-library` or `results-catch-rate` test ids that Tasks 7, 9, 11 and 12 assume. Since this task already touches every file involved, add them here rather than assuming they pre-exist; if SP1 lands them first, these additions are a no-op.

**Interfaces:**
- Consumes: `Annotation`, `Chain`, `AnnotToken`, `mapAnnotation`, `GradeResult.pairs` (Task 6 / SP1); `levelIndex` (`$lib/levels`); SP1 `explain(e, ctx)`, `PlayState`, `TokenText` props.
- Produces (`chains.ts`):
  ```ts
  export const KIND_PRIORITY: ChainKind[] = ['subject_verb', 'participle_etre', 'participle_avoir', 'attribute', 'nominal'];
  export function chainsOf(annotation: Annotation | null, annotIndex: number): Chain[];              // target or controller_group member
  export function explainChain(annotation: Annotation | null, annotIndex: number, min: 'high' | 'medium' = 'medium'): Chain | undefined; // best chain where the token is a TARGET
  export function groupText(annotation: Annotation, chain: Chain, body: string): string;            // body slice over controller_group (via 'conj': texts joined with ' et ')
  export function numberWord(features: Record<string, string>): 'pluriel' | 'singulier' | null;
  export function genderWord(features: Record<string, string>): 'féminin' | 'masculin' | null;
  export function featureWords(features: Record<string, string>): string;                          // "féminin pluriel" | "pluriel" | "féminin" | ""
  ```
- Produces (`fil.ts`):
  ```ts
  export type FilStep = 'idle' | 'pick-verb' | 'pick-subject' | 'done';
  export interface FilState { step: FilStep; verbRef: number | null; chainId: number | null; attempts: number; message: string; drawn: number; correct: number; highlightVerb: number | null; highlightSubject: number[] }  // indexes are annotation token ids
  export const FIL_START = "Touche un verbe, puis son sujet.";
  export function filStart(prev?: { drawn: number; correct: number }): FilState;
  export function filExit(state: FilState): FilState;
  export function filTap(state: FilState, annotIndex: number | undefined, annotation: Annotation, body: string): FilState;
  ```
- Produces (types): `SessionResult.tools?: { hints: number; threadsDrawn: number; threadsCorrect: number }`; `PlayState.fil?: { drawn: number; correct: number }`; `ExplainContext.level?: string; body?: string`.

- [ ] **Step 1: Failing tests `chains.test.ts` and `fil.test.ts`**

Shared fixture (copy into both test files; never import test files): the annotated sentence `Les fées qui chantent dansent.` — tokens `[Les DET, fées NOUN, qui PRON, chantent VERB, dansent VERB, . PUNCT]` with offsets from `tokenize`, `categories` `['nominal_group']` for `Les`/`fées`, `['verb']` for `chantent`/`dansent`, `[]` otherwise, `morph.VerbForm = 'Fin'` on both verbs, `chains` per token = the ids below where the token is a target or in a `controller_group`; chains:
```ts
const CHAINS: Chain[] = [
  { id: 0, kind: 'nominal', controller: 1, controller_group: [0, 1], targets: [0], via: null, via_token: null, features: { Gender: 'Fem', Number: 'Plur' }, confidence: 'high', distance: 1, rule: null },
  { id: 1, kind: 'subject_verb', controller: 1, controller_group: [0, 1], targets: [3], via: 'qui', via_token: 2, features: { Gender: 'Fem', Number: 'Plur', Person: '3' }, confidence: 'medium', distance: 2, rule: null },
  { id: 2, kind: 'subject_verb', controller: 1, controller_group: [0, 1], targets: [4], via: null, via_token: null, features: { Gender: 'Fem', Number: 'Plur', Person: '3' }, confidence: 'high', distance: 3, rule: null },
];
```
`chains.test.ts`: `chainsOf(ann, 1)` has ids `[0,1,2]`; `explainChain(ann, 3)` is chain 1 and `explainChain(ann, 3, 'high')` is undefined; `explainChain(ann, 4)` is chain 2; `explainChain(ann, 0)` is chain 0 (a target of the nominal chain); `groupText(ann, CHAINS[2], BODY) === 'Les fées'`; `featureWords({Gender:'Fem', Number:'Plur'}) === 'féminin pluriel'`, `numberWord({}) === null`.

`fil.test.ts`:
```ts
it('walks verb → subject and counts a correct thread', () => {
  let s = filStart();
  expect(s.step).toBe('pick-verb');
  s = filTap(s, 0, ANN, BODY);                       // "Les" is not a verb
  expect(s.step).toBe('pick-verb'); expect(s.message).toMatch(/ne semble pas être un verbe/);
  s = filTap(s, 3, ANN, BODY);                       // "chantent": verb but only a medium chain
  expect(s.step).toBe('pick-verb'); expect(s.message).toMatch(/s'emmêle/);
  s = filTap(s, 4, ANN, BODY);                       // "dansent": high chain
  expect(s.step).toBe('pick-subject'); expect(s.highlightVerb).toBe(4); expect(s.message).toBe('Verbe : « dansent ». Maintenant, touche son sujet.');
  s = filTap(s, 0, ANN, BODY);                       // "Les" belongs to the subject group → correct
  expect(s.step).toBe('done'); expect(s.correct).toBe(1); expect(s.drawn).toBe(1);
  expect(s.highlightSubject).toEqual([0, 1]);
  expect(s.message).toBe('Le fil est tendu : « dansent » ↔ « Les fées » (pluriel). Vérifie la terminaison du verbe.');
});
it('reveals the subject after two wrong taps and counts the thread as drawn but not correct', () => {
  let s = filTap(filStart(), 4, ANN, BODY);
  s = filTap(s, 3, ANN, BODY);
  expect(s.step).toBe('pick-subject'); expect(s.attempts).toBe(1); expect(s.message).toMatch(/Le fil ne tient pas/);
  s = filTap(s, 5, ANN, BODY);
  expect(s.step).toBe('done'); expect(s.drawn).toBe(1); expect(s.correct).toBe(0);
  expect(s.message).toBe('Le fil te guide : le sujet de « dansent », c\'est « Les fées » (pluriel).');
});
it('tapping the verb again cancels; unaligned taps and exit', () => {
  let s = filTap(filStart(), 4, ANN, BODY);
  s = filTap(s, 4, ANN, BODY);
  expect(s.step).toBe('pick-verb');
  s = filTap(s, undefined, ANN, BODY);
  expect(s.message).toMatch(/ne s'accroche pas/);
  expect(filExit(s).step).toBe('idle');
  expect(filStart({ drawn: 2, correct: 1 })).toMatchObject({ drawn: 2, correct: 1, step: 'pick-verb', message: FIL_START });
});
```
Run: `scripts/npm.sh run test -- chains fil` → FAIL.

- [ ] **Step 2: Implement `chains.ts` and `fil.ts`**

`fil.ts` rules (messages verbatim):
- `pick-verb`: `annotIndex === undefined` → message `Le fil d'Ariane ne s'accroche pas à ce mot. Cherche un verbe conjugué.`; token = `annotation.tokens[annotIndex]`; if `!token.categories.includes('verb')` → `Ce mot ne semble pas être un verbe conjugué. Cherche un mot qui dit ce que fait quelqu'un.`; `chain = explainChain(annotation, annotIndex, 'high')`; if `!chain || chain.kind !== 'subject_verb'` → `Le fil d'Ariane s'emmêle sur ce verbe. Essaie un autre verbe.`; else → `{ step: 'pick-subject', verbRef: annotIndex, chainId: chain.id, attempts: 0, highlightVerb: annotIndex, highlightSubject: [], message: `Verbe : « ${token.text} ». Maintenant, touche son sujet.` }`.
- `pick-subject`: `annotIndex === state.verbRef` → `filStart({drawn, correct})`; `chain` by id; `group = groupText(...)`, `num = numberWord(chain.features) ?? 'singulier'`; correct when `annotIndex !== undefined && (chain.controller_group.includes(annotIndex) || annotIndex === chain.via_token)` → `step 'done'`, `drawn+1`, `correct+1`, `highlightSubject = chain.controller_group`, message `Le fil est tendu : « ${verb} » ↔ « ${group} » (${num}). Vérifie la terminaison du verbe.` (when `chain.via === 'qui'` prefix with `« qui » reprend « ${group} ». `); wrong and `attempts + 1 < 2` → `attempts+1`, message `Le fil ne tient pas. Le sujet, c'est qui fait l'action de « ${verb} ». Réessaie.`; wrong at the second attempt → `step 'done'`, `drawn+1`, `highlightSubject = chain.controller_group`, message `Le fil te guide : le sujet de « ${verb} », c'est « ${group} » (${num}).`
- `done`: any tap → `filTap(filStart({drawn, correct}), annotIndex, ...)`.

Run: `scripts/npm.sh run test -- chains fil` → green.

- [ ] **Step 3: Explanations v2 — failing `explain.test.ts` additions, then `explain.ts`**

Extend `ExplainContext` with `level?: string` and `body?: string`. `explain.ts` already declares its own module-local `numberWord(n: string | undefined)` / `genderWord(g: string | undefined)` (single morph-value signature, used by the SP1 fallback templates) — importing `chains.ts`'s same-named `numberWord(features)` / `genderWord(features)` would be a duplicate-identifier error, so import them aliased: `import { numberWord as chainNumberWord, genderWord as chainGenderWord, featureWords, explainChain, groupText } from './chains'`, and use `chainNumberWord`/`chainGenderWord`/`featureWords` only in the new chain-based branches below (the existing local `numberWord`/`genderWord` keep serving the SP1 `e.sub === 'verb'`/`number`/`gender` fallback paths unchanged). New behaviour in `explain(e, ctx)` for `e.category === 'agreement'` with `e.refIndex !== null`, `annot = ctx.annots[e.refIndex]`, `chain = explainChain(ctx.annotation, annot.i)` (medium+), `E = e.expected`, `T = e.typed`, `ending` = part of `E` after the longest common prefix with `T` (fallback: last two letters), `NP = groupText(ctx.annotation, chain, ctx.body ?? ctx.refTokens.map(t => t.text).join(' '))`:
- `subject_verb`: `via === 'qui'` → `« E » s'accorde avec « qui », qui reprend « NP » → {pluriel|singulier} → terminaison « ending »`; `via === 'conj'` → `« E » a plusieurs sujets : « NP » → pluriel → terminaison « ending »`; else `« E » s'accorde avec son sujet « NP » → {pluriel|singulier} → terminaison « ending »`.
- `attribute` → `« E » est attribut du sujet « NP » → {featureWords}`.
- `participle_etre` → `Avec « être », le participe « E » s'accorde avec le sujet « NP » → {featureWords}`.
- `participle_avoir` (only when `ctx.level` is given and `levelIndex(ctx.level) >= levelIndex('9H')`): `rule === 'no_agreement'` → `Avec « avoir », le participe « E » ne s'accorde pas avec le sujet : aucun complément n'est placé avant → « E »`; `rule === 'cod_before'` → `Avec « avoir », le participe « E » s'accorde avec le complément « NP » placé avant → {featureWords}`.
- `nominal` → `« E » s'accorde avec le nom « {controller token text} » → {featureWords}`.
- No chain, low confidence, or a kind gated out → the SP1 templates exactly as before (SP1 tests keep passing: their fixtures have no `chains`).
- New lexical sub: `e.sub === 'sound_alike'` → `« T » se prononce comme « E », mais ici c'est « E ». Il rejoint tes mots-pièges.`

Tests (fixture: `Les fées qui chantent dansent.` with the CHAINS above, plus a second fixture `Elles sont parties.` with a `participle_etre` chain, and `Elle les a mangées.` with a `participle_avoir` `cod_before` chain, controller = `les`):
```ts
expect(explain(err('Les fées qui chante dansent.'), ctx).text).toBe('« chantent » s\'accorde avec « qui », qui reprend « Les fées » → pluriel → terminaison « nt »');
expect(explain(err('Les fées qui chantent danse.'), ctx).text).toBe('« dansent » s\'accorde avec son sujet « Les fées » → pluriel → terminaison « nt »');
expect(explain(err('Le fées qui chantent dansent.'), ctx).text).toBe('« Les » s\'accorde avec le nom « fées » → féminin pluriel');
expect(explain(errParties('Elles sont partie.'), ctxParties).text).toBe('Avec « être », le participe « parties » s\'accorde avec le sujet « Elles » → féminin pluriel');
expect(explain(errMangees('Elle les a mangé.'), { ...ctxMangees, level: '10H' }).text).toBe('Avec « avoir », le participe « mangées » s\'accorde avec le complément « les » placé avant → pluriel');
expect(explain(errMangees('Elle les a mangé.'), { ...ctxMangees, level: '8H' }).text).toBe('Participe passé « mangées » : avec être, il s\'accorde avec le sujet ; avec avoir, seulement si le complément est placé avant.');
expect(explain(soundAlikeErr, ctx).text).toBe('« mer » se prononce comme « mère », mais ici c\'est « mère ». Il rejoint tes mots-pièges.');
```
(Build `err(...)` helpers with `gradeText(REF, typed, ann)` and `ctx = { refTokens, annots: mapAnnotation(...), annotation, body: REF }` as in the SP1 test file.) Run: `scripts/npm.sh run test -- explain` → green after implementation; the SP1 explain tests must still pass unchanged.

- [ ] **Step 4: Proofreading integration, Results line, Play wiring**

`playState.ts`: add optional `fil?: { drawn: number; correct: number }` to `PlayState` (no version bump; missing → `{0,0}`). `grading/types.ts`: `SessionResult.tools?: {...}`.

`TokenText.svelte`: new props `filVerb: number | null = null`, `filSubjects: Set<number> = new Set()` (typed token indexes); classes `fil-verb` (`outline: 3px solid var(--aegean); border-radius: 6px`) and `fil-subject` (`text-decoration: underline; text-decoration-color: var(--gold); text-decoration-thickness: 3px`).

`Proofreading.svelte`:
- State: `let fil = $state<FilState>(filExit(filStart(state.fil)))` (idle, counters restored). Chip `Fil d'Ariane` (`data-testid="btn-fil"`, in the tools row next to Bouclier/Chouette) → `fil = filStart({ drawn: fil.drawn, correct: fil.correct })`; while `fil.step !== 'idle'`, a panel shows `fil.message` (`data-testid="fil-message"`) and a `Quitter le fil` button (`data-testid="btn-fil-exit"`) → `fil = filExit(fil)`.
- Index mapping: `refByAnnot = $derived(new Map(annots.flatMap((a, r) => (a ? [[a.i, r]] : []))))`, `typedByRef = $derived(new Map(grade.pairs.filter(p => p.refIndex !== null && p.typedIndex !== null).map(p => [p.refIndex!, p.typedIndex!])))`, `refByTyped` the inverse. Token tap while `fil.step !== 'idle'`: `annotIndex = annots[refByTyped.get(typedIndex)]?.i` (undefined when unaligned) → `fil = filTap(fil, annotIndex, reference.annotation, reference.body)`; then `state.fil = { drawn: fil.drawn, correct: fil.correct }` (persisted by the existing `$effect`). Highlights: `filVerb = typedByRef.get(refByAnnot.get(fil.highlightVerb))`, `filSubjects = new Set(fil.highlightSubject.map(a => typedByRef.get(refByAnnot.get(a))).filter(x => x !== undefined))`.
- The mode never edits text; tapping a token in Fil mode does not open the `WordEditor`.

`Results.svelte`: after the hero stats, when `result.tools && result.tools.threadsDrawn > 0`: `Fils d'Ariane tendus : {threadsCorrect} sur {threadsDrawn}` (`data-testid="results-threads"`). Explanations get `level={profile.level}` and `body={reference.body}` in their `ExplainContext` (Results receives `level` as a new prop from Play).

`Play.svelte`: before `api.sessions.create`, set `result.tools = { hints: state.hintsUsed, threadsDrawn: state.fil?.drawn ?? 0, threadsCorrect: state.fil?.correct ?? 0 }`.

Manual check in `scripts/dev.sh`: play a seed text to proofreading, activate the Fil, tap a verb then its subject, see the gold underline and the message; results show the threads line. Then `scripts/npm.sh run check` and `scripts/npm.sh run test` → green.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/chains.ts web/src/lib/chains.test.ts web/src/lib/fil.ts web/src/lib/fil.test.ts web/src/lib/explain.ts web/src/lib/explain.test.ts web/src/lib/grading/types.ts web/src/lib/playState.ts web/src/components/TokenText.svelte web/src/components/Proofreading.svelte web/src/components/Results.svelte web/src/screens/Play.svelte
git commit -m "Add chain-aware explanations and the Fil d'Ariane proofreading tool" -- web/src/lib/chains.ts web/src/lib/chains.test.ts web/src/lib/fil.ts web/src/lib/fil.test.ts web/src/lib/explain.ts web/src/lib/explain.test.ts web/src/lib/grading/types.ts web/src/lib/playState.ts web/src/components/TokenText.svelte web/src/components/Proofreading.svelte web/src/components/Results.svelte web/src/screens/Play.svelte
```

---

### Task 8: Scan flow, add menu, prophecies (due dates), new routes (web lane)

Spec §3.2: sources `scan`; "A text can carry a due date (a *dictée préparée* for a class test) → it becomes the Oracle's prophecy until the date passes"; §4: `<input type="file" accept="image/*" capture="environment">`. Decisions 7, 12, 14. Codes against the Task 3 API contract.

**Files:**
- Create: `web/src/lib/dates.ts`, `web/src/lib/dates.test.ts`, `web/src/components/AddMenu.svelte`, `web/src/screens/ScanText.svelte`
- Modify: `web/src/lib/routes.ts` (+ `routes.test.ts`), `web/src/lib/api.ts`, `web/src/lib/types.ts`, `web/src/App.svelte`, `web/src/screens/Library.svelte`, `web/src/screens/Play.svelte` (prophecy line on the intro)

**Interfaces:**
- Consumes: `POST /api/scan`, `GET /api/scan/{id}/page/{n}`, `POST /api/texts` with `source: 'scan'`, `scan_id`, `due_date` (Task 3); SP1 `TopBar`, `LevelSelect`, `navigate`, `href`.
- Produces:
  ```ts
  // routes.ts — new RouteNames and patterns
  'text-scan'       ['p', {param:'profileId'}, 'texts', 'scan']        href → `#/p/${profileId}/texts/scan`
  'grimoire'        ['p', {param:'profileId'}, 'grimoire', {param:'textId'}]   href → `#/p/${profileId}/grimoire/${textId}`
  'alexandria'      ['p', {param:'profileId'}, 'alexandria']           href → `#/p/${profileId}/alexandria`
  'alexandria-work' ['p', {param:'profileId'}, 'alexandria', {param:'workId'}]  href → `#/p/${profileId}/alexandria/${workId}`
  // dates.ts
  export function formatSwissDate(iso: string): string;        // '2026-10-03' → '03.10.2026'
  export function isProphecy(dueDate: string | null, today = new Date()): boolean;  // due_date ≥ today (local date, YYYY-MM-DD compare)
  export function todayIso(d = new Date()): string;            // local YYYY-MM-DD
  // types.ts
  export interface ScanPage { index: number; text: string; low_confidence: string[]; width: number; height: number }
  export interface ScanResult { scan_id: string; pages: ScanPage[]; text: string }
  TextSummary gains scan_id: string | null; photo_count: number;  TextCreateBody gains scan_id?: string | null
  // api.ts
  api.scan = { upload: (files: File[]) => Promise<ScanResult>, pageUrl: (scanId: string, n: number) => string }
  ```
  `AddMenu.svelte` props: `profileId: number`, `open: boolean` (bindable). `ScanText.svelte` props: `profile: Profile`.

- [ ] **Step 1: Failing tests (`dates.test.ts`, `routes.test.ts` additions)**

```ts
// dates.test.ts
import { describe, it, expect } from 'vitest';
import { formatSwissDate, isProphecy, todayIso } from './dates';
describe('dates', () => {
  it('formats Swiss style', () => expect(formatSwissDate('2026-10-03')).toBe('03.10.2026'));
  it('todayIso is local YYYY-MM-DD', () => expect(todayIso(new Date(2026, 8, 24, 23, 30))).toBe('2026-09-24'));
  it('prophecy while the due date has not passed', () => {
    const today = new Date(2026, 8, 24);
    expect(isProphecy('2026-09-24', today)).toBe(true);
    expect(isProphecy('2026-09-25', today)).toBe(true);
    expect(isProphecy('2026-09-23', today)).toBe(false);
    expect(isProphecy(null, today)).toBe(false);
  });
});
```
`routes.test.ts`: add cases `matchRoute('#/p/3/texts/scan')` → `{name:'text-scan', params:{profileId:'3'}}`; `'#/p/3/grimoire/12'` → grimoire with textId; `'#/p/3/alexandria'` and `'#/p/3/alexandria/verne-tour-du-monde'`; and the four `href` outputs. Run: `scripts/npm.sh run test -- dates routes` → FAIL. Implement `dates.ts` and the `routes.ts` patterns/`href` cases → green.

- [ ] **Step 2: `api.ts`, `types.ts`**

`api.scan.upload(files)`: `const fd = new FormData(); for (const f of files) fd.append('photos', f, f.name); const res = await fetch('/api/scan', { method: 'POST', body: fd });` — same error handling as `request()` (extract `detail`); returns `ScanResult`. `pageUrl` → `/api/scan/${scanId}/page/${n}`. Extend the types as in Interfaces.

- [ ] **Step 3: `AddMenu.svelte` and Library changes**

`AddMenu.svelte`: when `open`, a bottom sheet (`position: fixed; bottom: 0; left: 0; right: 0; background: #fff; border-radius: var(--radius) var(--radius) 0 0; padding: 16px; box-shadow: 0 -2px 12px rgba(43,42,40,.25)`) with heading `Ajouter un parchemin` and three `.card` buttons (each ≥ 56 px tall, icon + title + one-line subtitle):
- `data-testid="menu-add-type"` — `Taper ou coller un texte` / `Un texte que tu as sous la main.` → `navigate(href('text-new', {profileId}))`
- `data-testid="menu-add-scan"` — `Scanner une feuille` / `Prends en photo une feuille imprimée (pas de manuscrit).` → `href('text-scan')`
- `data-testid="menu-add-alexandria"` — `Bibliothèque d'Alexandrie` / `Des textes classiques recopiés pour toi.` → `href('alexandria')`
plus a `Fermer` ghost button; tapping the dimmed backdrop closes it.

`Library.svelte`: the FAB (`data-testid="btn-add-text"`) now toggles `menuOpen` and renders `<AddMenu profileId={profile.id} bind:open={menuOpen} />`. Card chips: `source === 'scan'` → chip `Scanné` (olive border); `source === 'online'` → chip `Alexandrie` (aegean border); `isProphecy(t.due_date)` → gold chip `Prophétie : {formatSwissDate(due_date)}` (`data-testid="chip-prophecy"`). New section at the top of the `Tous` view: `Prophéties de l'Oracle` listing texts with `isProphecy(due_date)` sorted by `due_date` (rendered with the same `textCard` snippet; they are excluded from the two sections below); subtitle `Les dictées préparées pour l'école, à réviser avant le jour dit.`; the section is omitted when empty.

- [ ] **Step 4: `ScanText.svelte`**

Three steps in one screen (`TopBar title="Scanner une feuille"`), state `step: 'capture' | 'verify' | 'details'`:
1. **capture**: explanation card `Prends la feuille imprimée en photo, bien à plat et en pleine lumière. Une photo par page. L'écriture à la main ne marche pas.`; `<input type="file" accept="image/*" capture="environment" multiple data-testid="scan-input">` styled as a big `.btn-primary` label `Prendre une photo` (a second label `Choisir dans les photos` uses the same input without `capture` — two inputs, same handler); thumbnails of the chosen files (`URL.createObjectURL`, revoked on destroy) with `Retirer` buttons; button `Lire le texte` (`data-testid="btn-scan-read"`, disabled without files) → `api.scan.upload(files)`; spinner text `Les scribes déchiffrent la feuille…`; on error `p.orange` with the detail (`Aucun texte lisible…` from the server) and the option to retake.
2. **verify**: heading `Vérifie le texte avec la feuille`; layout `grid-template-columns: 1fr 1fr` in landscape (`min-width: 900px`), stacked in portrait: left, the photo(s) from `api.scan.pageUrl` (zoomable via `object-fit: contain; max-height: 70vh`), right, `<textarea data-testid="scan-textarea" lang="fr" autocorrect="off" autocapitalize="sentences" spellcheck="false" rows="14">` bound to `text`; above it, when any `low_confidence` word exists: `À vérifier : ` followed by chips of the words (`data-testid="scan-low-confidence"`); word counter `{n} mots`; hint `Corrige chaque mot qui diffère de la feuille : ce texte devient la clé de correction.`; buttons `Reprendre une photo` and `Le texte est juste` (`data-testid="btn-scan-verified"`, disabled under 5 words).
3. **details**: `Titre` (`data-testid="scan-title"`, required), `LevelSelect`, `Dictée pour le` (`<input type="date" data-testid="scan-due-date">`, optional, `min={todayIso()}`; helper `Si c'est une dictée préparée, indique la date du test : elle devient une prophétie de l'Oracle.`), optional `Auteur`/`Œuvre`; `Sauvegarder dans les Parchemins` (`data-testid="btn-scan-save"`) → `api.texts.create({ title, body: text.trim(), level, source: 'scan', scan_id, due_date: dueDate || null, author, work, added_by_profile_id: profile.id })` → `navigate(href('library'))`. Errors (`ApiError.detail`) shown in orange (e.g. `Écris les nombres en lettres`).

`App.svelte`: route `text-scan` → `<ScanText profile={gateProfile} />`. `Play.svelte` intro: when `isProphecy(text.due_date)`: line `Dictée préparée pour le {formatSwissDate(due_date)} — la prophétie de l'Oracle.` (`data-testid="play-prophecy"`); when `text.photo_count > 0`: a `Voir la feuille` toggle showing the photo(s) via `api.scan.pageUrl(text.scan_id, n)` **only on the intro screen** (never during dictation — the reference must stay hidden: the photo is the reference).

Manual check with `scripts/dev.sh` in a desktop browser: upload `server/tests/fixtures/scan/handout.png` through the input, verify, save with a due date, see the `Prophéties de l'Oracle` section. Then `scripts/npm.sh run check` and `scripts/npm.sh run test` → green.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/dates.ts web/src/lib/dates.test.ts web/src/lib/routes.ts web/src/lib/routes.test.ts web/src/lib/api.ts web/src/lib/types.ts web/src/App.svelte web/src/components/AddMenu.svelte web/src/screens/ScanText.svelte web/src/screens/Library.svelte web/src/screens/Play.svelte
git commit -m "Add scan flow (capture, verify, save with due date), add menu, prophecies and SP2 routes" -- web/src/lib/dates.ts web/src/lib/dates.test.ts web/src/lib/routes.ts web/src/lib/routes.test.ts web/src/lib/api.ts web/src/lib/types.ts web/src/App.svelte web/src/components/AddMenu.svelte web/src/screens/ScanText.svelte web/src/screens/Library.svelte web/src/screens/Play.svelte
```

---

### Task 9: Grimoire corrompu — proofreading-only mode in the client (web lane)

Spec §5 SP2: "proofreading-only mode on a correct text with errors planted by Éris". Decision 8. Codes against the Task 4 API contract.

**Files:**
- Modify: `web/src/lib/api.ts`, `web/src/lib/types.ts`, `web/src/lib/playState.ts` (+ `playState.test.ts`), `web/src/lib/explain.ts` (+ `explain.test.ts`: `erisLine` grimoire variant), `web/src/App.svelte`, `web/src/screens/Play.svelte`, `web/src/components/Proofreading.svelte` (`mode` prop for the header), `web/src/components/Results.svelte` (mode wording), `web/src/screens/Stats.svelte` (mode chip in recent sessions)

**Interfaces:**
- Consumes: `POST /api/texts/{id}/corrupt`, `SessionCreate.mode`, `recent_sessions[].mode` (Task 4).
- Produces:
  ```ts
  export type PlayMode = 'dictation' | 'grimoire';
  export interface Plant { token: number; start: number; end: number; original: string; mutated: string; category: string }
  export interface CorruptResult { text_id: number; corrupted: string; count: number; plants: Plant[] }
  api.texts.corrupt = (id: number, body: { profile_id: number; seed?: number }) => Promise<CorruptResult>
  PlayState gains mode: PlayMode (default 'dictation') and plants?: Plant[];  playKey(profileId, textId, mode = 'dictation') → `discorde.play.${profileId}.${textId}` for dictation, `discorde.play.${profileId}.${textId}.grimoire` for grimoire
  // loadPlayState, savePlayState and clearPlayState each gain a `mode: PlayMode = 'dictation'` parameter and forward it to playKey
  // (savePlayState/clearPlayState read it off `state.mode`/the passed argument rather than a new param where the state is already in hand);
  // newPlayState(profileId, textId, pace, mode: PlayMode = 'dictation') sets `mode` on the returned state.
  SessionCreate (types.ts) gains mode: PlayMode
  export function erisLine(catchRate: number | null, draftErrors: number, introduced: number, mode: PlayMode = 'dictation'): string
  ```

- [ ] **Step 1: Failing tests**

`playState.test.ts`: `newPlayState(1, 2, 1, 'grimoire')` has `mode 'grimoire'` and is saved under `playKey(1, 2, 'grimoire')`; a saved dictation state does not shadow a grimoire one (both keys coexist). `explain.test.ts`: `erisLine(1, 5, 0, 'grimoire')` → `'Quoi ?! Tu as trouvé tous mes dés-accords dans ce grimoire. Je le corromprai mieux la prochaine fois.'`; `erisLine(0.5, 4, 0, 'grimoire')` → `'Hmpf. La moitié de mes dés-accords retrouvés. Le grimoire garde encore quelques secrets…'`; `erisLine(0, 4, 0, 'grimoire')` → `'Mes dés-accords sont restés bien cachés dans ce grimoire. Cette fois.'`; `erisLine(0.9, 10, 2, 'grimoire')` ends with ` (Et j'en ai glissé 2 pendant ta relecture. Sournois, je sais.)`; dictation strings unchanged. Run `scripts/npm.sh run test -- playState explain` → FAIL, implement, → green (grimoire thresholds: `≥ 0.8` → the "Quoi ?!" line, `≥ 0.5`, `> 0` → `'Ha ! Quelques dés-accords retrouvés. Le grimoire commence à se réparer.'`, `0`).

- [ ] **Step 2: Play flow**

`App.svelte`: route `grimoire` → `<Play profile={gateProfile} textId={route.params.textId} mode="grimoire" />`; `Play.svelte` prop `mode: PlayMode = 'dictation'` and uses `loadPlayState(profileId, textId, mode)` / `newPlayState(..., mode)`.

Intro screen, dictation mode: below `Commencer la dictée`, a secondary `.btn` `Grimoire corrompu` (`data-testid="btn-grimoire"`) → `navigate(href('grimoire', {profileId, textId}))`; subtitle `Éris a déjà recopié ce texte… avec ses dés-accords. Pas de dictée : relis et répare.`

Intro screen, grimoire mode: heading `Grimoire corrompu`, credits, chips; text `Éris a recopié ce parchemin en y semant ses dés-accords. Pas de dictée cette fois : retrouve-les et répare-les.`; no pace selector (`pace = 1`); button `Ouvrir le grimoire` (`data-testid="btn-open-grimoire"`) → `api.texts.corrupt(textId, { profile_id })` (spinner `Éris corrompt le grimoire…`) → `state.draft = corrupted; state.current = corrupted; state.plants = plants; state.phase = 'proofreading'; state.startedAt = now; save()`. On `ApiError` 422 show the detail (`Éris n'a pas trouvé assez de prises dans ce texte.`) with `Retour aux Parchemins`.

Proofreading: prop `mode`; header title `Grimoire corrompu` and subtitle prefix `Éris a corrompu ce grimoire. ` before the stage sentence (stage 3 count uses `initialErrors`, which equals the plant count unless alignment differs — the count comes from `gradeText` as in SP1, never from `plants`). Results: `erisLine(..., mode)`; label `Dés-accords retrouvés : {caught} sur {draft} ({pct} %)` instead of `Pièges déjoués` in grimoire mode (same `data-testid="results-catch-rate"`); session submission uses `mode`, `pace_level: 1`; `Rejouer ce texte` in grimoire mode re-runs `corrupt` (new plants). Stats: recent sessions show a small chip `Grimoire` when `mode === 'grimoire'`.

Manual check in `scripts/dev.sh`: open a seed text, `Grimoire corrompu`, see the corrupted text in proofreading, fix a few, finish, results and stats. `scripts/npm.sh run check` + `scripts/npm.sh run test` → green.

- [ ] **Step 3: Commit**

```bash
git add web/src/lib/api.ts web/src/lib/types.ts web/src/lib/playState.ts web/src/lib/playState.test.ts web/src/lib/explain.ts web/src/lib/explain.test.ts web/src/App.svelte web/src/screens/Play.svelte web/src/components/Proofreading.svelte web/src/components/Results.svelte web/src/screens/Stats.svelte
git commit -m "Add Grimoire corrompu mode: corrupted text proofreading with Éris's planted errors" -- web/src/lib/api.ts web/src/lib/types.ts web/src/lib/playState.ts web/src/lib/playState.test.ts web/src/lib/explain.ts web/src/lib/explain.test.ts web/src/App.svelte web/src/screens/Play.svelte web/src/components/Proofreading.svelte web/src/components/Results.svelte web/src/screens/Stats.svelte
```

---

### Task 10: Bibliothèque d'Alexandrie screens (web lane)

Spec §2: "the Library of Alexandria (online texts)"; §5 SP2: offered in the game as scrolls; network failures handled gracefully. Codes against the Task 5 API contract.

**Files:**
- Create: `web/src/screens/Alexandria.svelte`, `web/src/screens/AlexandriaWork.svelte`
- Modify: `web/src/lib/api.ts`, `web/src/lib/types.ts`, `web/src/App.svelte`

**Interfaces:**
- Consumes: `GET /api/alexandria/works`, `POST .../refresh`, `GET .../chunks?level=`, `POST /api/alexandria/chunks/{id}/adopt` (Task 5); `TopBar`, `LEVELS`, `href`, `navigate`.
- Produces:
  ```ts
  export interface AlexandriaWork { id: string; title: string; author: string; translator: string | null; credits: string; level_hint: string; source: string; status: 'never' | 'ok' | 'error'; fetched_at: string | null; error: string | null; chunk_count: number }
  export interface AlexandriaChunk { id: number; seq: number; level: string; word_count: number; score: number; preview: string; text_id: number | null }
  export interface RefreshResult { status: 'ok' | 'error'; error: string | null; chunk_count: number; rejected: Record<string, number> }
  api.alexandria = { works: () => Promise<AlexandriaWork[]>, refresh: (id: string) => Promise<RefreshResult>, chunks: (id: string, level?: string) => Promise<AlexandriaChunk[]>, adopt: (chunkId: number, body: { profile_id: number; title?: string }) => Promise<TextFull> }
  ```

- [ ] **Step 1: `Alexandria.svelte` (works)**

`TopBar title="Bibliothèque d'Alexandrie"`; intro `Les scribes d'Alexandrie recopient des œuvres anciennes. Choisis une œuvre, puis un rouleau à ajouter aux Parchemins.`; grid of `.card` buttons (`data-testid="work-card"`) with `title`, `credits` (muted), chips: `niveau {level_hint}`, status: `never` → `Pas encore recopié`, `ok` → `{chunk_count} rouleaux`, `error` → orange `Hors d'atteinte`. Tap → `navigate(href('alexandria-work', {profileId, workId}))`. Loading/error states as in Library (`Les Muses cherchent les scribes…`).

- [ ] **Step 2: `AlexandriaWork.svelte` (scrolls)**

Loads the work (from `api.alexandria.works()` filtered by id) and `api.alexandria.chunks(id)`. Header: title, credits, `Les traducteurs et auteurs sont dans le domaine public.` muted line. Button `Recopier depuis la Bibliothèque` (`data-testid="btn-refresh-work"`; `Recopier à nouveau` when `status === 'ok'`) → `api.alexandria.refresh(id)` with spinner `Les scribes recopient… (cela peut prendre une minute)`; result: `status === 'error'` → orange banner (`data-testid="alexandria-error"`) `La Bibliothèque d'Alexandrie est hors d'atteinte pour le moment. {error} Les rouleaux déjà recopiés restent disponibles.` — no exception surfaces; `ok` with `error` note → olive banner with the note; then reload chunks. Level filter chips (`Tous` + `LEVELS`, re-query with `level`). Chunk cards (`data-testid="chunk-card"`): `Rouleau {seq}` · chip `{level}` · `≈ {word_count} mots` · stars `★` × `clamp(round(score / 8), 1, 5)` (title attribute `Richesse en accords : {score}`) · `preview` in italics · button `Ajouter aux Parchemins` (`data-testid="btn-adopt"`) or, when `text_id` set, muted `Déjà dans les Parchemins` + `Jouer` link to `href('play', {profileId, textId})`. Adopt → `api.alexandria.adopt(chunk.id, { profile_id })` → inline confirmation `Rouleau ajouté aux Parchemins.` with `Jouer maintenant` (`data-testid="btn-adopt-play"`) and `Continuer à fouiller`. Empty state when `status === 'ok'` and no chunks: `Les scribes n'ont trouvé aucun passage assez propre dans cette œuvre (dialogues, vers, vieux français…).`

`App.svelte`: routes `alexandria` and `alexandria-work` → the two screens.

Manual check with `scripts/dev.sh` (the dev server has network; a real refresh of `daudet-moulin` should work) and with `DISCORDE_ALEXANDRIA_OFFLINE_DIR=/work/server/tests/fixtures/alexandria` set in `compose.dev.yaml` temporarily to see the error path. `scripts/npm.sh run check` + `scripts/npm.sh run test` → green. Then the web lane gate: `scripts/check.sh` → `== ALL GREEN` (requires the server lane to be complete; if it is not, run it again at Task 11).

- [ ] **Step 3: Commit**

```bash
git add web/src/screens/Alexandria.svelte web/src/screens/AlexandriaWork.svelte web/src/lib/api.ts web/src/lib/types.ts web/src/App.svelte
git commit -m "Add Bibliothèque d'Alexandrie screens: works, scrolls, refresh with graceful failures, adoption" -- web/src/screens/Alexandria.svelte web/src/screens/AlexandriaWork.svelte web/src/lib/api.ts web/src/lib/types.ts web/src/App.svelte
```

---

### Task 11: Integration — Playwright e2e for scan, Grimoire corrompu and Alexandria (network stubbed), full gate (joint)

Spec §6.1. Runs against the production image via `scripts/playwright.sh` (compose.e2e.yaml). The Alexandria network is stubbed with the offline fixture directory (Decision 10); the scan uses the fixture image through the real Tesseract in the image.

**Files:**
- Create: `web/e2e/scan.spec.ts`, `web/e2e/grimoire.spec.ts`, `web/e2e/alexandria.spec.ts`
- Modify: `compose.e2e.yaml` (offline fixtures), `web/e2e/helpers.ts` (`createProfile`, `createText` helpers), `README.md` (SP2 features: scan tips, Alexandria offline mode, lexicon licence pointer)

**Interfaces:**
- Consumes: `data-testid`s from Tasks 7–10: `btn-add-text`, `menu-add-scan`, `scan-input`, `btn-scan-read`, `scan-textarea`, `scan-low-confidence`, `btn-scan-verified`, `scan-title`, `scan-due-date`, `btn-scan-save`, `chip-prophecy`, `play-prophecy`, `btn-grimoire`, `btn-open-grimoire`, `btn-fil`, `fil-message`, `btn-fil-exit`, `results-catch-rate`, `results-threads`, `work-card`, `btn-refresh-work`, `alexandria-error`, `chunk-card`, `btn-adopt`, `btn-adopt-play`; SP1's `stubSpeech`, `text-card`, `tok-<i>`, `word-editor`, `btn-done-proofreading`, `btn-back-library`.
- Produces (`helpers.ts`): `createProfile(page, name, level)` (UI flow, returns to the library) and `createText(request, body)` (`POST /api/texts`, returns the JSON).

- [ ] **Step 1: compose and helpers**

`compose.e2e.yaml` `app` service: add `environment: { DISCORDE_DATA_DIR: /tmp/data, DISCORDE_ALEXANDRIA_OFFLINE_DIR: /fixtures/alexandria }` and `volumes: ["./server/tests/fixtures:/fixtures:ro"]`. Helpers as specified (profile creation mirrors `profiles.spec.ts`).

- [ ] **Step 2: `scan.spec.ts`**

```ts
import { test, expect } from '@playwright/test';
import { createProfile } from './helpers';

test('scan a printed handout, verify, save as a prophecy', async ({ page }) => {
  await createProfile(page, 'Scan' + Date.now().toString().slice(-6), '9H');
  await page.getByTestId('btn-add-text').click();
  await page.getByTestId('menu-add-scan').click();
  await page.getByTestId('scan-input').first().setInputFiles('/work/server/tests/fixtures/scan/handout.png');
  await page.getByTestId('btn-scan-read').click();
  const ta = page.getByTestId('scan-textarea');
  await expect(ta).toHaveValue(/fées dansent dans la clairière/, { timeout: 60_000 });
  await expect(ta).toHaveValue(/village endormi/);          // hyphenated line end merged
  // the child removes the handout's title line: the saved body is the dictation text only
  const value = await ta.inputValue();
  await ta.fill(value.split('\n\n').filter((p) => !p.startsWith('Dictée')).join('\n\n'));
  await page.getByTestId('btn-scan-verified').click();
  await page.getByTestId('scan-title').fill('Feuille des fées');
  await page.getByTestId('scan-due-date').fill('2035-06-30');
  await page.getByTestId('btn-scan-save').click();
  await expect(page.getByRole('heading', { name: 'Les Parchemins' })).toBeVisible();
  const card = page.locator('[data-testid="text-card"]', { hasText: 'Feuille des fées' });
  await expect(card).toContainText('Scanné');
  await expect(card.getByTestId('chip-prophecy')).toContainText('30.06.2035');
  await expect(page.getByRole('heading', { name: "Prophéties de l'Oracle" })).toBeVisible();
  await card.click();
  await expect(page.getByTestId('play-prophecy')).toContainText('30.06.2035');
  await page.getByRole('button', { name: 'Voir la feuille' }).click();
  await expect(page.locator('img[src*="/api/scan/"]')).toBeVisible();
});
```

- [ ] **Step 3: `grimoire.spec.ts`**

```ts
import { test, expect } from '@playwright/test';
import { createProfile, createText, stubSpeech } from './helpers';

const BODY = 'Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent. Le vent emporte leurs chansons jusqu\'au village. Les enfants sortent de leurs maisons, émerveillés. La musique descend de la forêt et la nuit est douce.';

test('Grimoire corrompu: planted errors, Fil d\'Ariane, results and stats', async ({ page, request }) => {
  await stubSpeech(page);
  await createProfile(page, 'Grim' + Date.now().toString().slice(-6), '10H');
  const t = await createText(request, { title: 'Fées grimoire', body: BODY, level: '8H', source: 'custom' });
  await page.locator('[data-testid="text-card"]', { hasText: 'Fées grimoire' }).click();
  await page.getByTestId('btn-grimoire').click();
  await expect(page.getByRole('heading', { name: 'Grimoire corrompu' })).toBeVisible();
  await page.getByTestId('btn-open-grimoire').click();
  await expect(page.getByRole('heading', { name: 'Grimoire corrompu' })).toBeVisible();
  await expect(page.getByText(/Éris a corrompu ce grimoire/)).toBeVisible();
  // the shown text differs from the original
  const shown = (await page.locator('[data-testid^="tok-"]').allTextContents()).join(' ');
  expect(shown).not.toBe(BODY);
  // Fil d'Ariane on a verb
  await page.getByTestId('btn-fil').click();
  await expect(page.getByTestId('fil-message')).toContainText('Touche un verbe');
  const dansent = page.locator('[data-testid^="tok-"]', { hasText: /^danse(nt)?$/ }).first();
  await dansent.click();
  const msg = await page.getByTestId('fil-message').textContent();
  if (/Maintenant, touche son sujet/.test(msg ?? '')) {
    await page.locator('[data-testid^="tok-"]', { hasText: /^fées?$/ }).first().click();
    await expect(page.getByTestId('fil-message')).toContainText('Le fil est tendu');
  }
  await page.getByTestId('btn-fil-exit').click();
  // fix one planted error if "danse" was planted, else just finish
  const danse = page.locator('[data-testid^="tok-"]', { hasText: /^danse$/ });
  if (await danse.count()) {
    await danse.first().click();
    await page.getByTestId('word-editor').fill('dansent');
    await page.getByTestId('word-editor').press('Enter');
  }
  await page.getByTestId('btn-done-proofreading').click();
  const confirm = page.getByRole('button', { name: 'Oui, valider' });
  if (await confirm.isVisible()) await confirm.click();
  await expect(page.getByTestId('results-catch-rate')).toContainText(/Dés-accords retrouvés : \d+ sur \d+/);
  const m = /sur (\d+)/.exec((await page.getByTestId('results-catch-rate').textContent()) ?? '');
  expect(Number(m?.[1])).toBeGreaterThanOrEqual(3);
  await page.getByTestId('btn-back-library').click();
  await page.getByRole('link', { name: 'Progrès' }).click();
  await expect(page.getByText('Grimoire').first()).toBeVisible();
  expect(t.id).toBeGreaterThan(0);
});
```

- [ ] **Step 4: `alexandria.spec.ts`**

```ts
import { test, expect } from '@playwright/test';
import { createProfile } from './helpers';

test('Alexandria: refresh from offline fixtures, graceful failure, adopt a scroll', async ({ page }) => {
  await createProfile(page, 'Alex' + Date.now().toString().slice(-6), '9H');
  await page.getByTestId('btn-add-text').click();
  await page.getByTestId('menu-add-alexandria').click();
  await expect(page.getByRole('heading', { name: "Bibliothèque d'Alexandrie" })).toBeVisible();
  expect(await page.getByTestId('work-card').count()).toBeGreaterThanOrEqual(10);
  // a work without fixtures fails gracefully
  await page.locator('[data-testid="work-card"]', { hasText: 'Lettres de mon moulin' }).click();
  await page.getByTestId('btn-refresh-work').click();
  await expect(page.getByTestId('alexandria-error')).toContainText("hors d'atteinte", { timeout: 60_000 });
  await page.goBack();
  // the Verne work has one fixture page
  await page.locator('[data-testid="work-card"]', { hasText: 'Vingt mille lieues' }).click();
  await page.getByTestId('btn-refresh-work').click();
  await expect(page.getByTestId('chunk-card').first()).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId('chunk-card').first()).toContainText(/Rouleau \d+/);
  await page.getByTestId('btn-adopt').first().click();
  await expect(page.getByText('Rouleau ajouté aux Parchemins.')).toBeVisible();
  await page.getByTestId('btn-adopt-play').click();
  await expect(page.getByRole('button', { name: 'Commencer la dictée' })).toBeVisible();
  await expect(page.getByText(/Jules Verne/)).toBeVisible();
});
```
(`Lettres de mon moulin` must be a work in the shipped allowlist; if Task 5's live check removed it, pick another work whose pages have no fixture and update the `hasText`.)

- [ ] **Step 5: Run everything**

`scripts/playwright.sh` → all specs pass (SP1's 5 + these 3). Then `scripts/check.sh` → `== ALL GREEN`. Then, as SP1 did, verify the production compose: `docker compose -f compose.yaml up -d --build`, wait for `healthy`, `curl -s http://localhost:8080/api/health`, `curl -s http://localhost:8080/api/alexandria/works | head -c 300`, `docker compose -f compose.yaml down`. Note the image size in the commit message.

`README.md` additions (short): "Scanner une feuille" (printed handouts only, one photo per page, JPEG/PNG), "Bibliothèque d'Alexandrie" (needs Internet on the server; cached in `/data`; `DISCORDE_ALEXANDRIA_OFFLINE_DIR` for tests), "Lexique 3.83 (CC BY-SA)" pointer to `content/lexique/LICENSE.md`.

- [ ] **Step 6: Commit**

```bash
git add web/e2e/scan.spec.ts web/e2e/grimoire.spec.ts web/e2e/alexandria.spec.ts web/e2e/helpers.ts compose.e2e.yaml README.md
git commit -m "Add SP2 end-to-end tests: scan with fixture image, Grimoire corrompu, Alexandria with stubbed network" -- web/e2e/scan.spec.ts web/e2e/grimoire.spec.ts web/e2e/alexandria.spec.ts web/e2e/helpers.ts compose.e2e.yaml README.md
```

---

### Task 12: Playability review of SP2 at iPad viewports (joint)

Spec §6.2. This task **reports**; it does not fix. The controller triages the findings afterwards.

**Files:**
- Create: `web/e2e/playability-sp2.spec.ts`, `docs/reviews/sp2/*.png`, `docs/reviews/sp2/playability.md`
- Modify: `web/playwright.playability.config.ts` (`testMatch: ['**/playability.spec.ts', '**/playability-sp2.spec.ts']`)

**Interfaces:**
- Consumes: SP1's playability config and `stubSpeech`; the Task 11 helpers and `data-testid`s.

- [ ] **Step 1: `playability-sp2.spec.ts`**

One test per project (`ipad-landscape` 1180×820, `ipad-portrait` 820×1180), profile `` `Ariane-${testInfo.project.name}` `` (10H), saving `docs/reviews/sp2/<project>-NN-<screen>.png` (`fullPage: true`) for:
`01-add-menu` (menu open), `02-scan-capture`, `03-scan-verify` (after OCR of the fixture, with the photo and textarea visible), `04-scan-details` (title and due date filled), `05-library-prophecy` (the prophecy section and chips), `06-play-intro-prophecy` (with `Voir la feuille` open), `07-grimoire-intro`, `08-grimoire-proofreading` (stage 1, first pass), `09-fil-pick-verb` (Fil active, message visible), `10-fil-thread` (after tapping verb then subject), `11-grimoire-results` (`Dés-accords retrouvés`, threads line), `12-results-chain-explanation` (an agreement error tapped, chain-based text visible — use a dictation session on a seed text with a draft that breaks one verb agreement, as SP1's playability did, so the explanation names the subject), `13-alexandria-works`, `14-alexandria-error` (Lettres de mon moulin refresh failure banner), `15-alexandria-chunks` (Verne scrolls), `16-alexandria-adopted` (confirmation with `Jouer maintenant`). Also record in the spec's console output: the `autocorrect`/`spellcheck` attributes of the scan textarea, and whether any element uses a red colour (`getComputedStyle` scan for `rgb(2[0-9][0-9], 0, 0)`-like values on `.orange`/`.err` elements — must be none).

Run: `scripts/playwright.sh --config playwright.playability.config.ts` → 4 tests pass (SP1's 2 + these 2), 32 new PNGs under `docs/reviews/sp2/`.

- [ ] **Step 2: Look at every screenshot and write `docs/reviews/sp2/playability.md`**

Open each PNG with the Read tool. Report structure (English, quoting French UI text verbatim):
1. **Setup**: image built from commit `<sha>`, viewports, the walk performed.
2. **Screen-by-screen notes** (both orientations): scan capture/verify (is the photo legible next to the textarea in portrait? are low-confidence chips useful?), prophecy visibility, Grimoire intro and proofreading (does it feel like a mode of its own?), Fil d'Ariane (is the two-tap flow discoverable? does the thread feel rewarding?), chain explanations (are they clearer than SP1's?), Alexandria (do works/scrolls read as a library, does the failure banner reassure?).
3. **As a 13-year-old fantasy fan**: is the Grimoire corrompu fun or homework? Is Éris's voice consistent across the new lines? Does Alexandria feel like a real place? Is scanning a handout something she would do before a test? Which of the three additions would she talk about?
4. **As a game designer**: friction (taps from the library to a corrupted grimoire / to a scanned text), clarity (is it clear that the child is the answer key when verifying a scan?), fun (Fil d'Ariane as a mechanic vs. a checkbox), tone (no blame, orange not red, low-confidence words framed as "à vérifier"), pacing (refresh wait time, OCR wait time, how the spinners read), feedback (results wording in grimoire mode, threads line), and the key question: **does the Grimoire corrompu make proofreading the core game more than the dictation does?**
5. **Prioritised findings**: table `P0 (blocks play) / P1 (hurts the core loop) / P2 (polish)`, each with screen, evidence (screenshot file), and a concrete suggested fix. Also list what should *not* change.
6. **Spec conformance spot-checks**: reference never visible during dictation (also for scanned texts: the photo is only on the intro); Fil d'Ariane only reacts to high-confidence chains (evidence: the `s'emmêle` message on a medium chain); no red; scan textarea attributes; Alexandria never crashes on network failure; public-domain credits shown on adopted scrolls.

- [ ] **Step 3: Commit**

```bash
git add web/playwright.playability.config.ts web/e2e/playability-sp2.spec.ts docs/reviews/sp2
git commit -m "Add SP2 playability review with iPad screenshots" -- web/playwright.playability.config.ts web/e2e/playability-sp2.spec.ts docs/reviews/sp2
```

---

## Self-review notes (written by the planner)

- **Spec coverage.** §5 SP2 bullet 1 (chains with confidence: det/amod → noun, nsubj → verb, cop + attribute, aux:pass, être + participle, conj subjects, relative *qui*) → Task 2 (`build_chains` covers each construction with a dedicated test); subcategory classification → Task 6 (`forms` features) and Task 7 (chain kinds); better explanations → Task 7; Fil d'Ariane high-confidence only → Task 7 (`explainChain(..., 'high')` in `filTap`). Bullet 2 (Lexique 3.83, inflected forms, homophones, 1990 reform) → Tasks 1, 2, 6. Bullet 3 (scan: preprocessing, Tesseract `fra`, verification, annotate, save, due date → Oracle prophecy, original photo stored) → Tasks 3, 8. Bullet 4 (Grimoire corrompu weighted by weaknesses) → Tasks 4, 9. Bullet 5 (Wikisource/Gutenberg allowlist with death years, cleaning, old-spelling filter, 80–200-word chunks, dialogue/verse/proper-noun filters, agreement-density scoring, cache) → Tasks 5, 10; digits filter and network-failure handling → Task 5 (`digits` verdict, `status: 'error'` path) and Task 10 (banner). §3.2 sources `scan`/`online`, credits, replayability (adopted and scanned texts are ordinary `text` rows) → Tasks 3, 5, 8. §4 "cached", "no API keys", single container, plain HTTP → Tasks 3, 5 (apt packages, no new services). §6 gates → Tasks 11, 12. Task 12 checks the scanned photo is never shown during dictation (§3.3).
- **Placeholder scan:** no TBD/TODO; every code step has code or exact rules; the allowlist marks entries to *verify with the tool* rather than inventing page titles — the tool and the removal rule are specified (Task 5 Step 6).
- **Type consistency checked:** Annotation v2 field names (`forms`, `sound_alikes`, `chains`, `controller_group`, `targets`, `via`, `via_token`, `features`, `confidence`, `distance`, `rule`) identical in Task 2 (Python), Task 6 (`Chain`, `AnnotToken`), Task 7 (`chains.ts`, `fil.ts`); `ErrorSub 'sound_alike'` in Task 6 ↔ Task 7 template; `SessionCreate.mode` in Task 4 ↔ Task 9; `scan_id`/`photo_count` in Task 3 ↔ Task 8; Alexandria response shapes in Task 5 ↔ Task 10; `data-testid`s in Tasks 7–10 ↔ Tasks 11–12; `playKey(profileId, textId, mode)` in Task 9 ↔ `Play.svelte`; `ExplainContext.level/body` in Task 7 ↔ Results/Play wiring.
- **Known simplifications recorded as decisions:** reform canonicalisation lives in `norm` (Decision 5), so explanations always quote `.text`; Grimoire sessions do not move the help stage (Decision 8); chunk levels are heuristic and never below the hint (Decision 11); `participle_avoir` explanations are gated to ≥ 9H client-side; the Grimoire e2e tolerates whichever tokens Éris chose (assertions on counts, not on specific plants).
