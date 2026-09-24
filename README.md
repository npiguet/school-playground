# La Discorde

A French dictation game for kids, playable on an iPad, self-hosted as a single Docker
container.

## Development

All toolchains run in Docker; nothing needs to be installed on the host. Wrapper scripts:

- `scripts/npm.sh <args>` — npm inside `web/` (e.g. `scripts/npm.sh install`, `scripts/npm.sh run test`)
- `scripts/pytest.sh <args>` — pytest inside `server/` (e.g. `scripts/pytest.sh -v`)
- `scripts/py.sh <cmd...>` — any command inside the server dev image, in `server/`
- `scripts/playwright.sh [npx playwright args]` — builds the production image and runs the e2e suite against it
- `scripts/check.sh` — the CI-like gate: pytest + svelte-check + vitest + docker build + e2e; must be green before every commit
- `scripts/dev.sh` — starts the dev stack: Vite on `http://localhost:5173` (proxying `/api`) and `uvicorn --reload` on `8080`

## Running the checks

`scripts/check.sh` is the full gate and must be green before every commit: server pytest,
`svelte-check`, `vitest`, a production Docker image build, then the Playwright e2e suite run
against that built image (`scripts/playwright.sh`, which brings up the image with an empty
`/tmp/data` so the seed import runs at startup, and tears the stack down afterwards). Run it
from the repo root:

```bash
scripts/check.sh
```

To run only the e2e suite (e.g. while iterating on a spec): `scripts/playwright.sh`. Pass
extra `npx playwright test` arguments through, e.g. `scripts/playwright.sh e2e/seed.spec.ts`.

## SP2 features

**Scanner une feuille** — the "Scanner une feuille" entry of the add-text menu photographs a
printed handout (one photo per page, JPEG/PNG/WEBP) and reads it with Tesseract OCR. Handwriting
is not supported — printed handouts only. The child must verify the OCR text against the photo
before saving: it becomes the answer key, so an uncorrected OCR mistake would otherwise be graded
as always correct. Low-confidence words are flagged for a closer look. The original photos are
kept in the data volume alongside the text.

**Bibliothèque d'Alexandrie** — the "Bibliothèque d'Alexandrie" entry lets a child adopt scored
excerpts ("rouleaux") from public-domain classics (Wikisource/Gutenberg) into their own library.
Refreshing a work's excerpts needs Internet access on the *server* (not the child's device);
results are cached under `/data` so a later refresh failure still leaves the previously fetched
excerpts available. Tests and e2e never hit the network: set `DISCORDE_ALEXANDRIA_OFFLINE_DIR` to
a directory of `wikisource/<slug>.html` / `gutenberg/pg<id>.txt` fixtures (see
`server/tests/fixtures/alexandria/` and `compose.e2e.yaml`) to read from disk instead.

**Lexique 3.83** — the vendored, trimmed lexicon (`content/lexique/lexique383-trimmed.tsv.gz`)
that powers word-form and homophone lookups is derived from Lexique 3.83 (New, Pallier, Brysbaert
& Ferrand), licensed CC BY-SA 4.0; see `content/lexique/LICENSE.md` for attribution and how the
derived file was built.

## Deployment on TrueNAS SCALE 25.10

Build the image on a machine with Docker:

```bash
docker build -t discorde:local .
docker save discorde:local | gzip > discorde.tar.gz
```

Copy `discorde.tar.gz` to the NAS, then:

```bash
docker load -i discorde.tar.gz
```

In the TrueNAS SCALE UI: Apps → Discover → ⋮ → *Install via YAML*, and paste the contents
of `compose.yaml`. The `discorde-data` volume holds the SQLite database.
