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
