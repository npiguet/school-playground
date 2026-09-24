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
