# La Discorde — SP1 "Foundations and core loop" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A first playable version of *La Discorde*: a Dockerised FastAPI + SQLite server with spaCy text annotation and ~30 seed passages, and a Svelte 5 SPA where a player picks a profile, picks a text from *Les Parchemins*, takes a dictation read by TTS, proofreads it with the Argus passes / Bouclier de Persée / Chouette d'Athéna, and gets a results screen with kind explanations, a score and her catch rate.

**Architecture:** Single container (multi-stage Dockerfile: `node:22` builds the SPA, `python:3.12-slim` serves it and the `/api` REST endpoints; SQLite + files in `/data`). The grading engine is a pure TypeScript module run in the browser; the server stores sessions and derives per-profile stats from the submitted per-token results. spaCy (`fr_core_news_lg`) annotates every text once when it is saved; the annotation only drives highlighting and explanations, never correctness. Every toolchain (npm, pytest, Playwright) runs through Docker wrapper scripts in `scripts/`; nothing is installed on the host.

**Tech Stack:** FastAPI, uvicorn, Python 3.12, stdlib `sqlite3` with numbered SQL migrations, spaCy 3.8 (`fr_core_news_lg` in the image, `fr_core_news_sm` in tests), pytest + httpx; Svelte 5 (runes) + TypeScript + Vite 7, vitest, Playwright 1.55 (`mcr.microsoft.com/playwright:v1.55.0-noble`); Docker Compose; TrueNAS SCALE 25.10 as deployment target.

**Spec:** `docs/superpowers/specs/2026-09-23-la-discorde-design.md` — the binding authority. Read §1, §3.1–3.5, §4, §5 (SP1) and §6 before starting any task. Where this plan and the spec disagree, the spec wins; where the spec is silent, this plan's "Decisions" section wins.

## Global Constraints

- **Language:** "The UI and all game text are in French. Code, comments, docs and commits are in English." (spec §0)
- **Pedagogy (spec §1):** "The reference text is always the answer key." NLP "never [decides] what is correct." "No red crosses, no buzzers, no lives, nothing can be lost. Mistakes are framed as Éris's sabotage. Orange rather than red."
- **Toolchain (spec §4):** "All toolchains run in Docker: `node:22` for the SPA, `python:3.12-slim` for the server and its tests, `mcr.microsoft.com/playwright` for e2e and playability screenshots. [...] Do not install software on the host. Use `.gitattributes` with `* text=auto eol=lf`. Named Docker volumes for `node_modules`." The host is Windows 11 + Docker Desktop + Git Bash; host Python is 3.14 and must not be used for the server.
- **Deployment (spec §4):** "Single container, multi-stage Dockerfile [...]. `compose.yaml` with one service, port `8080`, volume for `/data`. Target: TrueNAS SCALE 25.10." "Plain HTTP on the LAN is the baseline; everything must work without HTTPS."
- **Data (spec §4):** "Server-authoritative data. Profiles, texts, sessions and stats live in SQLite on the server." "Schema versioning with a small migration runner (numbered SQL files)."
- **Grading (spec §4):** "Grading runs client-side in a pure TypeScript module." Classification order (spec §3.5): `homophone` → `agreement` → `accent` → `punctuation_case` → `lexical`.
- **Public domain (spec §3.2):** "author and translator died before 1956 [...] If unknown → reject."
- **Texts:** "Numbers must be written as words in texts." (spec §3.3) Seed passages are 80–200 words (spec §5).
- **iPad (spec §3.3):** textarea with `autocorrect="off" autocapitalize="off" autocomplete="off" spellcheck="false"`, large font, current line visible above the on-screen keyboard; the reference text is never visible during dictation.
- **Commits:** every task commits its own work on the current branch (`grimoire`); every commit message ends with the line `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- **Verification:** before claiming a task done, run the task's test command through the wrapper scripts and paste the actual output in your report. `scripts/check.sh` must be green at the end of every task from Task 1 onward (it grows as tasks add tests).

## Decisions taken by this plan (the user was unavailable; do not re-ask)

1. **SQLite access = stdlib `sqlite3`, no ORM.** The schema is six small tables, migrations are plain SQL files anyway, and the image stays small. A thin `server/app/db.py` gives one connection per request (`sqlite3.Row` rows, WAL journal, foreign keys on).
2. **spaCy models:** production image installs `fr_core_news_lg`; the dev/test image (`server/Dockerfile.dev`) installs `fr_core_news_sm` only (15 MB, seconds to load). The model name comes from env `SPACY_MODEL`. Tests that touch the model are smoke tests on unambiguous sentences; everything else tests pure functions on hand-built token lists.
3. **Server does not re-grade in SP1.** The client submits `result_json` (per-token errors, caught/missed/introduced, opportunities); the server derives `profile_stat`, `profile_stat_day` and `trap_word` from it and stores the raw draft/final so a later re-grade is possible (spec §4 "the server stores the raw texts too").
4. **Single homophone table** at `content/homophones.json`, read by Python (annotation flags) and by TypeScript (classification) — Vite alias `@content` → `../content`.
5. **Client tokenizer ≠ spaCy tokenizer.** Both produce character offsets; the client maps its reference tokens to spaCy tokens by span overlap. This keeps grading independent from NLP.
6. **Help stage 3** shows the number of errors *at the start* of proofreading and does not refresh it (closer to class; refreshing would leak feedback on every edit). This is this plan's explicit interpretation of spec §3.4's « 4 pièges sont cachés » as "remaining at the start of proofreading" rather than a live count, because a live counter would grade every edit, contrary to §1.1's focused proofreading and §1.5's fading scaffold; the controller may overrule, in which case the only change is `initialErrors` → `$derived(grade.errors.length)` in `Proofreading.svelte`. Chouette hints per stage: 3 / 2 / 1 / 0.
7. **Pace 3 and 4 have no replays**; the player can pause. Pace 2 has 3 replays per text. Pace 1 is unlimited.
8. **Default pace by level:** 5H–6H → 1, 7H–8H → 2, 9H–11H → 3. The player can change it before every dictation.
9. **Score** = `2 × correct words + 20 × caught errors + bonus`, bonus = `round(100 × catch rate)` or 50 when the draft had no errors, then `× pace multiplier [1, 1.25, 1.5, 2]`, rounded. Never negative by construction.
10. **Routing:** a tiny in-house hash router (`#/...`), no router dependency (Svelte 5 support of third-party routers is uneven). Fonts: system serif stack, no web fonts (no external requests).
11. **PWA icon** = the golden apple of Discord on terracotta, authored as SVG and rasterised with `sharp` inside the node container (no Forge/krea2 dependency for SP1).
12. **Playwright pinned to 1.55.0** in both `web/package.json` and the Docker image tag; the two must always match. Implementers may bump both together if 1.55.0 cannot be pulled.
13. **Argus "Mots-pièges" pass** uses the profile's `trap_word` list from the server; "Verbes" includes participles only for levels ≥ 8H (client-side gating).
14. **Adaptive help stage** is computed server-side on session save from the profile's most recent sessions with a non-null catch rate (sessions with no draft errors are ignored).

## File structure

```
scripts/lib.sh                 shared bash helpers (paths, tty flags, image names)
scripts/npm.sh                 npm in node:22 (web/)
scripts/pytest.sh              pytest in the server dev image
scripts/py.sh                  any command in the server dev image
scripts/playwright.sh          e2e: build app image, run Playwright container against it
scripts/dev.sh                 docker compose -f compose.dev.yaml up (vite + uvicorn --reload)
scripts/check.sh               pytest + svelte-check + vitest + docker build + e2e
Dockerfile                     multi-stage: node build → python runtime
compose.yaml                   production (one service, 8080, /data)
compose.dev.yaml               dev: web (vite) + server (uvicorn --reload)
compose.e2e.yaml               e2e: app (built image) + playwright
README.md                      dev + deployment notes (short, grows in SP4)
content/homophones.json        homophone sets + kid-friendly hints
content/seed/NNN-slug.json     seed passages
server/requirements.txt, requirements-dev.txt, Dockerfile.dev, pytest.ini
server/app/main.py             create_app(), lifespan (migrate + seed), SPA fallback
server/app/config.py           env-driven settings
server/app/db.py               connect(), migrate(), get_db dependency
server/app/migrations/001_initial.sql
server/app/schemas.py          pydantic request/response models
server/app/security.py         PIN hashing
server/app/levels.py           LEVELS, level ordinal
server/app/nlp/homophones.py   loads content/homophones.json
server/app/nlp/model.py        get_nlp() lazy loader
server/app/nlp/annotate.py     annotate(text, nlp) -> dict ; derive_categories(tokens)
server/app/deps.py             make_annotator(settings) -> Callable[[str], dict]
server/app/textutil.py         word_count(), words(), has_digits(), build_credits()
server/app/seed.py             import_seed(conn, content_dir, nlp)
server/app/stats.py            apply_session_to_stats(), next_help_stage(), trap word updates
server/app/routers/profiles.py, texts.py, sessions.py, stats.py
server/tests/conftest.py, test_*.py, fixtures/
web/package.json, vite.config.ts, tsconfig.json, svelte.config.js, playwright.config.ts
web/index.html, public/manifest.json, public/icons/*, public/icon.svg
web/scripts/make-icons.mjs
web/src/main.ts, App.svelte, app.css (theme tokens)
web/src/lib/types.ts           shared API/domain types
web/src/lib/api.ts             fetch wrappers
web/src/lib/router.svelte.ts   hash router
web/src/lib/routes.ts          route pattern list, matchRoute()/href()
web/src/lib/levels.ts          LEVELS, AVATARS
web/src/lib/profileStore.svelte.ts   current profile ($state) + localStorage unlock cache
web/src/lib/playState.ts       PlayState type + helpers
web/src/lib/textEdit.ts        sentenceSpans() and other text-editing helpers
web/src/lib/grading/normalize.ts, tokenize.ts, align.ts, homophones.ts, classify.ts,
                    annotationMap.ts, types.ts, grade.ts, index.ts   (pure, unit-tested)
web/src/lib/dictation/segment.ts, spoken.ts, tts.ts, script.ts       (pure except tts)
web/src/lib/argus.ts           pass order + category mapping for the proofreading screen
web/src/lib/explain.ts         explanation templates (French)
web/src/screens/ProfilePicker.svelte, ProfileCreate.svelte, Settings.svelte,
                Library.svelte, TextCreate.svelte, Play.svelte, Stats.svelte
web/src/components/Dictation.svelte, Proofreading.svelte, Results.svelte,
                   WordEditor.svelte, TopBar.svelte, Avatar.svelte
web/e2e/happy-path.spec.ts, seed.spec.ts, playability.spec.ts
docs/reviews/sp1/*.png, docs/reviews/sp1/playability.md
```

Conventions used throughout:
- Levels: `['5H','6H','7H','8H','9H','10H','11H']` (French grades in a code comment: 5H=CE2, 6H=CM1, 7H=CM2, 8H=6e, 9H=5e, 10H=4e, 11H=3e).
- Avatars: `['chouette','dragon','lyre','trident','laurier','foudre']`.
- Stat category keys: `agreement:verb`, `agreement:participle`, `agreement:number`, `agreement:gender`, `agreement:other`, `homophone`, `accent`, `punctuation_case`, `lexical`.
- Timestamps: ISO 8601 UTC strings (`datetime.now(timezone.utc).isoformat()`), days as `YYYY-MM-DD`.

---

### Task 1: Docker toolchain wrappers, server and web skeletons, Dockerfile, compose, check.sh

Everything later depends on this task. At the end: `scripts/pytest.sh` runs passing tests, `scripts/npm.sh run test` runs a passing vitest test, `docker build .` produces an image that serves the SPA and `/api/health`, and `scripts/check.sh` is green.

**Files:**
- Create: `scripts/lib.sh`, `scripts/npm.sh`, `scripts/pytest.sh`, `scripts/py.sh`, `scripts/playwright.sh`, `scripts/dev.sh`, `scripts/check.sh`
- Create: `server/requirements.txt`, `server/requirements-dev.txt`, `server/Dockerfile.dev`, `server/pytest.ini`, `server/app/__init__.py`, `server/app/config.py`, `server/app/main.py`, `server/tests/__init__.py`, `server/tests/conftest.py`, `server/tests/test_health.py`
- Create: `web/package.json`, `web/vite.config.ts`, `web/tsconfig.json`, `web/svelte.config.js`, `web/index.html`, `web/src/main.ts`, `web/src/App.svelte`, `web/src/app.css`, `web/src/vite-env.d.ts`, `web/src/lib/version.ts`, `web/src/lib/version.test.ts`, `web/playwright.config.ts`, `web/e2e/smoke.spec.ts`
- Create: `Dockerfile`, `compose.yaml`, `compose.dev.yaml`, `compose.e2e.yaml`, `README.md`, `.dockerignore`, `content/homophones.json` (empty placeholder, filled in Task 3)
- Modify: `.gitignore` (add `web/node_modules/`, `server/.pytest_cache/`)

**Interfaces:**
- Produces: `scripts/npm.sh <args>` (npm inside `web/`), `scripts/pytest.sh <args>` (pytest inside `server/`), `scripts/py.sh <cmd...>` (any command inside `server/` in the dev image, with `DISCORDE_CONTENT_DIR=/work/content`), `scripts/playwright.sh [npx playwright args]`, `scripts/check.sh`, `scripts/dev.sh`.
- Produces: `server/app/main.py:create_app(settings: Settings | None = None) -> FastAPI`; `server/app/config.py:Settings` (fields `data_dir: Path`, `content_dir: Path`, `static_dir: Path`, `spacy_model: str`, `seed_on_startup: bool`) and `Settings.from_env()`.
- Produces: `GET /api/health` -> `{"status":"ok","version":"0.1.0"}`.
- Produces: Vite aliases `@content` -> `<repo>/content` and `$lib` -> `web/src/lib`.

- [ ] **Step 1: Write `scripts/lib.sh` (shared helpers)**

All scripts are bash with LF endings (enforced by `.gitattributes`). They must run from Git Bash on Windows and on Linux.

```bash
#!/usr/bin/env bash
# Shared helpers for the Docker wrapper scripts. Source this file; do not run it.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Docker Desktop on Windows wants C:/... style paths; Git Bash gives /c/....
if command -v cygpath >/dev/null 2>&1; then
  HOST_ROOT="$(cygpath -m "$ROOT")"
else
  HOST_ROOT="$ROOT"
fi
# Stop MSYS from rewriting container paths like /work/web into C:\...\work\web.
export MSYS_NO_PATHCONV=1
export COMPOSE_PROJECT_NAME=discorde

TTY_FLAGS=""
# No -it: nothing in this toolchain is interactive, and docker run -it fails under
# mintty (Git Bash's default terminal) with "the input device is not a TTY".

NODE_IMAGE="node:22"
PLAYWRIGHT_VERSION="1.55.0"
PLAYWRIGHT_IMAGE="mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble"
SERVER_DEV_IMAGE="discorde-server-dev"
APP_IMAGE="discorde:local"
NODE_MODULES_VOLUME="discorde-web-node_modules"
NPM_CACHE_VOLUME="discorde-npm-cache"

ensure_volumes() {
  for v in "$NODE_MODULES_VOLUME" "$NPM_CACHE_VOLUME"; do
    docker volume inspect "$v" >/dev/null 2>&1 || docker volume create "$v" >/dev/null
  done
}

build_server_dev_image() {
  # Anything handed to docker/docker compose as a path uses $HOST_ROOT (or is relative
  # after `cd "$ROOT"`); $ROOT itself is only for bash's own file operations.
  docker build -q -t "$SERVER_DEV_IMAGE" -f "$HOST_ROOT/server/Dockerfile.dev" "$HOST_ROOT/server" >/dev/null
}
```

- [ ] **Step 2: Write the wrapper scripts**

`scripts/npm.sh`:
```bash
#!/usr/bin/env bash
# Run npm inside the node:22 container, in web/. Example: scripts/npm.sh run test
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
ensure_volumes
docker run --rm $TTY_FLAGS \
  -v "$HOST_ROOT:/work" \
  -v "$NODE_MODULES_VOLUME:/work/web/node_modules" \
  -v "$NPM_CACHE_VOLUME:/root/.npm" \
  -w /work/web -e CI=true \
  "$NODE_IMAGE" npm "$@"
```

`scripts/py.sh`:
```bash
#!/usr/bin/env bash
# Run any command inside the server dev image, in server/. Example: scripts/py.sh python -m app.tools.seed_check
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
build_server_dev_image
docker run --rm $TTY_FLAGS \
  -v "$HOST_ROOT:/work" \
  -w /work/server \
  -e PYTHONDONTWRITEBYTECODE=1 -e SPACY_MODEL=fr_core_news_sm \
  -e DISCORDE_CONTENT_DIR=/work/content \
  "$SERVER_DEV_IMAGE" "$@"
```

`scripts/pytest.sh`:
```bash
#!/usr/bin/env bash
# Run pytest inside the server dev image. Example: scripts/pytest.sh tests/test_health.py -v
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
exec "$ROOT/scripts/py.sh" python -m pytest "$@"
```

`scripts/playwright.sh`:
```bash
#!/usr/bin/env bash
# Build the production image, start it, run Playwright against it, tear down.
# Example: scripts/playwright.sh                                     (all e2e specs)
#          scripts/playwright.sh --config playwright.playability.config.ts
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
ensure_volumes
cd "$ROOT"
docker compose -f compose.e2e.yaml build app
set +e
docker compose -f compose.e2e.yaml run --rm -T playwright npx playwright test "$@"
status=$?
set -e
docker compose -f compose.e2e.yaml down -v --remove-orphans
exit $status
```

`scripts/dev.sh`:
```bash
#!/usr/bin/env bash
# Start the dev stack: vite on http://localhost:5173 (proxying /api) + uvicorn --reload on 8080.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
ensure_volumes
build_server_dev_image
cd "$ROOT"
exec docker compose -f compose.dev.yaml up "$@"
```

`scripts/check.sh`:
```bash
#!/usr/bin/env bash
# The CI-like gate: all tests + a production image build + e2e. Must be green at the end of every task.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
cd "$ROOT"
echo "== server: pytest";        scripts/pytest.sh -q
echo "== web: svelte-check";     scripts/npm.sh run check
echo "== web: vitest";           scripts/npm.sh run test
echo "== docker build";          docker build -t "$APP_IMAGE" .
echo "== e2e: playwright";       scripts/playwright.sh
echo "== ALL GREEN"
```

Run `chmod +x scripts/*.sh`. Git on Windows does not track the bit from the filesystem, so after `git add` also run `git update-index --chmod=+x scripts/*.sh`.

- [ ] **Step 3: Server skeleton with a failing health test**

`server/requirements.txt`:
```
fastapi>=0.115,<1
uvicorn[standard]>=0.30,<1
spacy>=3.8,<3.9
```
`server/requirements-dev.txt`:
```
-r requirements.txt
pytest>=8
httpx>=0.27
```
`server/Dockerfile.dev`:
```dockerfile
FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /work/server
COPY requirements.txt requirements-dev.txt ./
RUN pip install --no-cache-dir -r requirements-dev.txt \
 && python -m spacy download fr_core_news_sm
```
`server/pytest.ini`:
```ini
[pytest]
testpaths = tests
```
`server/app/config.py`:
```python
"""Environment-driven settings. Every path has a sane default for the production image."""
from __future__ import annotations
import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    data_dir: Path = Path("/data")
    content_dir: Path = Path("/app/content")
    static_dir: Path = Path("/app/static")
    spacy_model: str = "fr_core_news_lg"
    seed_on_startup: bool = True

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            data_dir=Path(os.environ.get("DISCORDE_DATA_DIR", "/data")),
            content_dir=Path(os.environ.get("DISCORDE_CONTENT_DIR", "/app/content")),
            static_dir=Path(os.environ.get("DISCORDE_STATIC_DIR", "/app/static")),
            spacy_model=os.environ.get("SPACY_MODEL", "fr_core_news_lg"),
            seed_on_startup=os.environ.get("DISCORDE_SEED", "1") == "1",
        )
```
`server/tests/conftest.py` (grows in later tasks):
```python
import pytest
from fastapi.testclient import TestClient
from app.config import Settings
from app.main import create_app


@pytest.fixture
def settings(tmp_path):
    return Settings(data_dir=tmp_path / "data", content_dir=tmp_path / "content",
                    static_dir=tmp_path / "static", spacy_model="fr_core_news_sm",
                    seed_on_startup=False)


@pytest.fixture
def client(settings):
    with TestClient(create_app(settings)) as c:
        yield c
```
`server/tests/test_health.py`:
```python
def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "version": "0.1.0"}


def test_spa_fallback_serves_index(settings, client):
    settings.static_dir.mkdir(parents=True)
    (settings.static_dir / "index.html").write_text("<html>discorde</html>")
    assert "discorde" in client.get("/").text
    assert "discorde" in client.get("/some/deep/route").text
    assert client.get("/api/nope").status_code == 404
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `scripts/pytest.sh -v`
Expected: the dev image builds (first time takes a few minutes), then `ModuleNotFoundError: No module named 'app.main'`.

- [ ] **Step 5: Implement `server/app/main.py`**

```python
"""FastAPI application factory. Serves /api/* and falls back to the SPA's index.html."""
from __future__ import annotations
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from app.config import Settings

VERSION = "0.1.0"


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        settings.data_dir.mkdir(parents=True, exist_ok=True)
        app.state.settings = settings
        yield

    app = FastAPI(title="La Discorde", version=VERSION, lifespan=lifespan)

    @app.get("/api/health")
    def health():
        return {"status": "ok", "version": VERSION}

    # Later tasks insert app.include_router(...) lines HERE, above the /api catch-all.

    @app.get("/api/{rest:path}")
    def api_not_found(rest: str):
        raise HTTPException(status_code=404, detail="Not found")

    @app.get("/{path:path}")
    def spa(path: str):
        static = settings.static_dir.resolve()
        candidate = (static / path).resolve() if path else None
        if candidate and candidate.is_file() and str(candidate).startswith(str(static)):
            return FileResponse(candidate)
        index = static / "index.html"
        if index.is_file():
            return FileResponse(index)
        return JSONResponse({"detail": "SPA not built"}, status_code=404)

    return app


app = create_app()
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `scripts/pytest.sh -v`  Expected: `2 passed`.

- [ ] **Step 7: Web skeleton with one vitest test**

`web/package.json` (the implementer runs `scripts/npm.sh install` to create `package-lock.json`, which is committed; if npm reports a peer-dependency conflict between `vite`, `@sveltejs/vite-plugin-svelte` and `vitest`, align to the latest majors that accept each other and note it in the commit message):
```json
{
  "name": "la-discorde-web",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite --host",
    "build": "vite build",
    "preview": "vite preview",
    "check": "svelte-check --tsconfig ./tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "icons": "node scripts/make-icons.mjs"
  },
  "devDependencies": {
    "@playwright/test": "1.55.0",
    "@sveltejs/vite-plugin-svelte": "^6.0.0",
    "@tsconfig/svelte": "^5.0.4",
    "sharp": "^0.34.0",
    "svelte": "^5.0.0",
    "svelte-check": "^4.0.0",
    "typescript": "^5.6.0",
    "vite": "^7.0.0",
    "vitest": "^3.2.0"
  }
}
```
`web/vite.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';

const content = fileURLToPath(new URL('../content', import.meta.url));
const lib = fileURLToPath(new URL('./src/lib', import.meta.url));

export default defineConfig({
  plugins: [svelte()],
  resolve: { alias: { '@content': content, $lib: lib } },
  server: {
    host: true,
    port: 5173,
    fs: { allow: ['..'] },
    proxy: { '/api': process.env.API_PROXY ?? 'http://localhost:8080' },
  },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
```
`web/svelte.config.js`:
```js
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
export default { preprocess: vitePreprocess() };
```
`web/tsconfig.json`:
```json
{
  "extends": "@tsconfig/svelte/tsconfig.json",
  "compilerOptions": {
    "target": "ES2022", "module": "ESNext", "moduleResolution": "bundler",
    "strict": true, "resolveJsonModule": true, "allowJs": true, "checkJs": false,
    "isolatedModules": true, "types": ["vite/client"], "baseUrl": ".",
    "paths": { "$lib/*": ["./src/lib/*"], "@content/*": ["../content/*"] }
  },
  "include": ["src/**/*.ts", "src/**/*.svelte", "vite.config.ts"],
  "exclude": ["e2e", "node_modules"]
}
```
`web/src/vite-env.d.ts`:
```ts
/// <reference types="svelte" />
/// <reference types="vite/client" />
```
`web/index.html`:
```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>La Discorde</title>
  </head>
  <body><div id="app"></div><script type="module" src="/src/main.ts"></script></body>
</html>
```
`web/src/main.ts`:
```ts
import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
export default mount(App, { target: document.getElementById('app')! });
```
`web/src/App.svelte` (placeholder, replaced in Task 9):
```svelte
<main><h1>La Discorde</h1><p>Les Muses préparent le camp…</p></main>
```
`web/src/app.css`: `body { margin: 0; font-family: Georgia, serif; }` (the real theme comes in Task 9).
`web/src/lib/version.ts`: `export const APP_VERSION = '0.1.0';`
`web/src/lib/version.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { APP_VERSION } from './version';
describe('version', () => {
  it('is semver', () => expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/));
});
```

- [ ] **Step 8: Install and run the web checks**

Run: `scripts/npm.sh install`, then `scripts/npm.sh run test`, `scripts/npm.sh run check`, `scripts/npm.sh run build`.
Expected: 1 test passed; svelte-check reports 0 errors; `web/dist/index.html` exists on the host.

- [ ] **Step 9: Playwright config and smoke spec**

`web/playwright.config.ts`:
```ts
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/playability.spec.ts'],
  timeout: 60_000,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:8080',
    locale: 'fr-CH',
    screenshot: 'only-on-failure',
    ...devices['Desktop Safari'],
  },
});
```
`web/e2e/smoke.spec.ts`:
```ts
import { test, expect } from '@playwright/test';
test('serves the SPA and the API', async ({ page, request }) => {
  const health = await request.get('/api/health');
  expect(health.ok()).toBeTruthy();
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('La Discorde');
});
```

- [ ] **Step 10: Dockerfile, compose files, .dockerignore, README**

`.dockerignore`:
```
.git
**/node_modules
web/dist
web/test-results
web/playwright-report
data
docs
.claude
```
`content/homophones.json` placeholder (Task 3 fills it): `{"version": 1, "sets": []}`.

`Dockerfile`:
```dockerfile
# Stage 1: build the SPA
FROM node:22 AS web
WORKDIR /work
COPY content/homophones.json content/homophones.json
COPY web/package.json web/package-lock.json web/
RUN cd web && npm ci --ignore-scripts
COPY web web
RUN cd web && npm run build

# Stage 2: python runtime serving API + SPA
FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PIP_DISABLE_PIP_VERSION_CHECK=1 \
    DISCORDE_DATA_DIR=/data DISCORDE_STATIC_DIR=/app/static \
    DISCORDE_CONTENT_DIR=/app/content SPACY_MODEL=fr_core_news_lg
WORKDIR /app
COPY server/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt \
 && python -m spacy download fr_core_news_lg
COPY server/app app
COPY content content
COPY --from=web /work/web/dist static
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=90s --retries=5 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8080/api/health').status==200 else 1)"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
```
(`npm ci --ignore-scripts` skips sharp's binary postinstall, only needed by `npm run icons` in the dev container.)

`compose.yaml` (production; what is pasted into TrueNAS "Install via YAML"):
```yaml
services:
  discorde:
    image: discorde:local
    build: .
    container_name: discorde
    ports: ["8080:8080"]
    volumes: ["discorde-data:/data"]
    restart: unless-stopped
volumes:
  discorde-data:
```
`compose.dev.yaml`:
```yaml
services:
  server:
    image: discorde-server-dev
    working_dir: /work/server
    command: uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload
    environment:
      DISCORDE_DATA_DIR: /data
      DISCORDE_CONTENT_DIR: /work/content
      DISCORDE_STATIC_DIR: /nonexistent
      SPACY_MODEL: fr_core_news_sm
    volumes: [".:/work", "discorde-dev-data:/data"]
    ports: ["8080:8080"]
  web:
    image: node:22
    working_dir: /work/web
    command: npm run dev
    environment: { API_PROXY: "http://server:8080" }
    volumes: [".:/work", "discorde-web-node_modules:/work/web/node_modules"]
    ports: ["5173:5173"]
    depends_on: [server]
volumes:
  discorde-dev-data:
  discorde-web-node_modules:
    external: true
```
`compose.e2e.yaml`:
```yaml
services:
  app:
    build: .
    image: discorde:local
    environment: { DISCORDE_DATA_DIR: /tmp/data }
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8080/api/health').status==200 else 1)"]
      interval: 5s
      timeout: 3s
      retries: 30
      start_period: 20s
  playwright:
    image: mcr.microsoft.com/playwright:v1.55.0-noble
    working_dir: /work/web
    environment: { BASE_URL: "http://app:8080", CI: "true" }
    volumes: [".:/work", "discorde-web-node_modules:/work/web/node_modules"]
    depends_on:
      app: { condition: service_healthy }
    ipc: host
volumes:
  discorde-web-node_modules:
    external: true
```
`README.md`: title, one paragraph, a "Development" section listing the wrapper scripts and `scripts/dev.sh` (vite on 5173, API on 8080), and a "Deployment on TrueNAS SCALE 25.10" section: build on a machine with Docker (`docker build -t discorde:local .`), `docker save discorde:local | gzip > discorde.tar.gz`, copy to the NAS, `docker load -i discorde.tar.gz`, then Apps → Discover → ⋮ → *Install via YAML* with the contents of `compose.yaml`; the `discorde-data` volume holds the SQLite database. Keep it short; SP4 completes it.

- [ ] **Step 11: Build the image and run the whole gate**

Run: `docker build -t discorde:local .` (the `fr_core_news_lg` download is ~570 MB; only the first build pays). Then `scripts/playwright.sh`. Expected: the smoke spec passes against the built image. Then `scripts/check.sh`. Expected: last line `== ALL GREEN`.

If Playwright cannot reach `http://app:8080`, run `docker compose -f compose.e2e.yaml ps` and check the `app` service is healthy; the model load may take up to a minute on first start.

- [ ] **Step 12: Commit**

```bash
git add -A
git update-index --chmod=+x scripts/*.sh
git commit -m "Scaffold Docker toolchain, server and web skeletons

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: SQLite database, migration runner, profiles API

**Files:**
- Create: `server/app/db.py`, `server/app/migrations/001_initial.sql`, `server/app/security.py`, `server/app/levels.py`, `server/app/schemas.py`, `server/app/routers/__init__.py`, `server/app/routers/profiles.py`
- Modify: `server/app/main.py` (run migrations in lifespan, include router)
- Test: `server/tests/test_db.py`, `server/tests/test_profiles.py`

**Interfaces:**
- Consumes: `create_app(settings)`, `Settings.data_dir`.
- Produces: `app/db.py`: `connect(path: Path) -> sqlite3.Connection` (WAL, foreign keys, `row_factory=sqlite3.Row`), `migrate(conn) -> int` (returns the schema version), `get_db(request) -> Iterator[sqlite3.Connection]` FastAPI dependency (one connection per request, commits on success, closes always). The connection is opened on `request.app.state.settings.data_dir / "discorde.sqlite3"`.
- Produces: `app/security.py`: `hash_pin(pin: str) -> str`, `verify_pin(pin: str, stored: str) -> bool`.
- Produces: `app/levels.py`: `LEVELS = ["5H","6H","7H","8H","9H","10H","11H"]`, `level_index(level) -> int`.
- Produces: `app/schemas.py`: `ProfileCreate(name: str, avatar: str, level: str, pin: str | None)`, `ProfileOut(id, name, avatar, level, has_pin: bool, help_stage: int, created_at, settings: dict)`, `ProfilePatch(name?, avatar?, level?, pin?: str | None, settings?: dict)`.
- Produces: REST endpoints (all JSON):
  - `GET /api/profiles` -> `ProfileOut[]` ordered by `created_at`.
  - `POST /api/profiles` -> 201 `ProfileOut`. 409 if the name exists (case-insensitive). 422 if level not in `LEVELS`, avatar not in the avatar list, name empty/>30 chars, or pin not exactly 4 digits.
  - `GET /api/profiles/{id}` -> `ProfileOut` (404 if missing).
  - `PATCH /api/profiles/{id}` -> `ProfileOut`. `pin: ""` removes the PIN.
  - `DELETE /api/profiles/{id}` -> 204 (cascades sessions/stats/trap words).
  - `POST /api/profiles/{id}/verify-pin` body `{"pin": "1234"}` -> `{"ok": true|false}` (`ok: true` when the profile has no PIN).
- Produces: tables `profile`, `text`, `session`, `profile_stat`, `profile_stat_day`, `trap_word`, `schema_version` (exact columns below; later tasks rely on them).

- [ ] **Step 1: Write failing migration tests**

`server/tests/test_db.py`:
```python
import sqlite3
from app.db import connect, migrate


def table_names(conn):
    return {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}


def test_migrate_creates_schema(tmp_path):
    conn = connect(tmp_path / "t.sqlite3")
    version = migrate(conn)
    assert version >= 1
    assert {"profile", "text", "session", "profile_stat", "profile_stat_day", "trap_word", "schema_version"} <= table_names(conn)
    assert conn.execute("PRAGMA foreign_keys").fetchone()[0] == 1
    assert conn.execute("PRAGMA journal_mode").fetchone()[0] == "wal"


def test_migrate_is_idempotent(tmp_path):
    conn = connect(tmp_path / "t.sqlite3")
    v1 = migrate(conn)
    v2 = migrate(conn)
    assert v1 == v2
    assert conn.execute("SELECT COUNT(*) FROM schema_version").fetchone()[0] == v1


def test_profile_delete_cascades(tmp_path):
    conn = connect(tmp_path / "t.sqlite3")
    migrate(conn)
    conn.execute("INSERT INTO profile(id, name, avatar, level, created_at) VALUES (1, 'A', 'chouette', '8H', 'now')")
    conn.execute("INSERT INTO trap_word(profile_id, word, box, last_seen, misses) VALUES (1, 'maison', 1, 'now', 1)")
    conn.execute("DELETE FROM profile WHERE id = 1")
    assert conn.execute("SELECT COUNT(*) FROM trap_word").fetchone()[0] == 0
```

- [ ] **Step 2: Run to verify failure**

Run: `scripts/pytest.sh tests/test_db.py -v`  Expected: `ModuleNotFoundError: No module named 'app.db'`.

- [ ] **Step 3: Write the migration and `db.py`**

`server/app/migrations/001_initial.sql`:
```sql
-- Initial schema (spec §4 "Data model"). Levels are Swiss HarmoS: 5H=CE2, 6H=CM1, 7H=CM2, 8H=6e, 9H=5e, 10H=4e, 11H=3e.
CREATE TABLE profile (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  avatar        TEXT NOT NULL DEFAULT 'chouette',
  level         TEXT NOT NULL,
  pin_hash      TEXT,
  help_stage    INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL,
  settings_json TEXT NOT NULL DEFAULT '{}'
);
CREATE UNIQUE INDEX profile_name_nocase ON profile(name COLLATE NOCASE);

CREATE TABLE text (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  title               TEXT NOT NULL,
  body                TEXT NOT NULL,
  source              TEXT NOT NULL CHECK (source IN ('seed','custom','scan','online')),
  seed_key            TEXT UNIQUE,
  level               TEXT NOT NULL,
  author              TEXT,
  translator          TEXT,
  work                TEXT,
  credits             TEXT,
  added_by_profile_id INTEGER REFERENCES profile(id) ON DELETE SET NULL,
  due_date            TEXT,
  photo_path          TEXT,
  annotation_json     TEXT NOT NULL DEFAULT '{}',
  created_at          TEXT NOT NULL
);

CREATE TABLE session (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id  INTEGER NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  text_id     INTEGER NOT NULL REFERENCES text(id) ON DELETE CASCADE,
  pace_level  INTEGER NOT NULL,
  help_stage  INTEGER NOT NULL,
  started_at  TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  draft       TEXT NOT NULL,
  final       TEXT NOT NULL,
  result_json TEXT NOT NULL,
  score       INTEGER NOT NULL,
  catch_rate  REAL
);
CREATE INDEX session_profile_finished ON session(profile_id, finished_at);
CREATE INDEX session_profile_text ON session(profile_id, text_id);

CREATE TABLE profile_stat (
  profile_id      INTEGER NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  category        TEXT NOT NULL,
  occurrences     INTEGER NOT NULL DEFAULT 0,
  errors_in_draft INTEGER NOT NULL DEFAULT 0,
  caught          INTEGER NOT NULL DEFAULT 0,
  missed          INTEGER NOT NULL DEFAULT 0,
  updated_at      TEXT NOT NULL,
  PRIMARY KEY (profile_id, category)
);

CREATE TABLE profile_stat_day (
  profile_id      INTEGER NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  day             TEXT NOT NULL,
  category        TEXT NOT NULL,
  occurrences     INTEGER NOT NULL DEFAULT 0,
  errors_in_draft INTEGER NOT NULL DEFAULT 0,
  caught          INTEGER NOT NULL DEFAULT 0,
  missed          INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (profile_id, day, category)
);

CREATE TABLE trap_word (
  profile_id INTEGER NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  word       TEXT NOT NULL,
  box        INTEGER NOT NULL DEFAULT 1,
  last_seen  TEXT NOT NULL,
  misses     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (profile_id, word)
);
```

`server/app/db.py`:
```python
"""SQLite access: one connection per request, numbered SQL migrations in app/migrations."""
from __future__ import annotations
import sqlite3
from pathlib import Path
from typing import Iterator
from fastapi import Request

MIGRATIONS_DIR = Path(__file__).parent / "migrations"
DB_FILENAME = "discorde.sqlite3"


def connect(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def migrate(conn: sqlite3.Connection) -> int:
    conn.execute("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)")
    current = conn.execute("SELECT COALESCE(MAX(version), 0) FROM schema_version").fetchone()[0]
    for path in sorted(MIGRATIONS_DIR.glob("*.sql")):
        version = int(path.name.split("_", 1)[0])
        if version <= current:
            continue
        conn.executescript(path.read_text(encoding="utf-8"))
        conn.execute("INSERT INTO schema_version(version, applied_at) VALUES (?, datetime('now'))", (version,))
        conn.commit()
        current = version
    return current


def db_path(request: Request) -> Path:
    return request.app.state.settings.data_dir / DB_FILENAME


def get_db(request: Request) -> Iterator[sqlite3.Connection]:
    conn = connect(db_path(request))
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()
```
In `main.py` lifespan, after creating `data_dir`: `conn = connect(settings.data_dir / DB_FILENAME); migrate(conn); conn.close()`.

- [ ] **Step 4: Run to verify the DB tests pass**

Run: `scripts/pytest.sh tests/test_db.py -v`  Expected: 3 passed.

- [ ] **Step 5: Write failing profile API tests**

`server/tests/test_profiles.py`:
```python
def test_create_and_list_profile(client):
    r = client.post("/api/profiles", json={"name": "Léa", "avatar": "chouette", "level": "10H", "pin": None})
    assert r.status_code == 201, r.text
    p = r.json()
    assert p["name"] == "Léa" and p["level"] == "10H" and p["has_pin"] is False and p["help_stage"] == 1
    assert "pin_hash" not in p
    assert [x["id"] for x in client.get("/api/profiles").json()] == [p["id"]]


def test_duplicate_name_is_409(client):
    client.post("/api/profiles", json={"name": "Léa", "avatar": "chouette", "level": "10H"})
    assert client.post("/api/profiles", json={"name": "léa", "avatar": "dragon", "level": "8H"}).status_code == 409


def test_validation(client):
    bad = [
        {"name": "", "avatar": "chouette", "level": "10H"},
        {"name": "A", "avatar": "unicorn", "level": "10H"},
        {"name": "A", "avatar": "chouette", "level": "12H"},
        {"name": "A", "avatar": "chouette", "level": "10H", "pin": "12"},
        {"name": "A", "avatar": "chouette", "level": "10H", "pin": "abcd"},
    ]
    for body in bad:
        assert client.post("/api/profiles", json=body).status_code == 422, body


def test_pin_flow(client):
    p = client.post("/api/profiles", json={"name": "Max", "avatar": "dragon", "level": "6H", "pin": "1234"}).json()
    assert p["has_pin"] is True
    assert client.post(f"/api/profiles/{p['id']}/verify-pin", json={"pin": "0000"}).json() == {"ok": False}
    assert client.post(f"/api/profiles/{p['id']}/verify-pin", json={"pin": "1234"}).json() == {"ok": True}
    client.patch(f"/api/profiles/{p['id']}", json={"pin": ""})
    assert client.get(f"/api/profiles/{p['id']}").json()["has_pin"] is False
    assert client.post(f"/api/profiles/{p['id']}/verify-pin", json={"pin": "9999"}).json() == {"ok": True}


def test_patch_settings_and_delete(client):
    p = client.post("/api/profiles", json={"name": "Max", "avatar": "dragon", "level": "6H"}).json()
    r = client.patch(f"/api/profiles/{p['id']}", json={"settings": {"voice": "Thomas"}, "level": "7H"})
    assert r.json()["settings"] == {"voice": "Thomas"} and r.json()["level"] == "7H"
    assert client.delete(f"/api/profiles/{p['id']}").status_code == 204
    assert client.get(f"/api/profiles/{p['id']}").status_code == 404
```

- [ ] **Step 6: Run to verify failure**

Run: `scripts/pytest.sh tests/test_profiles.py -v`  Expected: all fail with 404 (no router yet).

- [ ] **Step 7: Implement levels, security, schemas, router**

`server/app/levels.py`:
```python
"""Swiss HarmoS levels. French equivalents: 5H=CE2, 6H=CM1, 7H=CM2, 8H=6e, 9H=5e, 10H=4e, 11H=3e."""
LEVELS = ["5H", "6H", "7H", "8H", "9H", "10H", "11H"]
AVATARS = ["chouette", "dragon", "lyre", "trident", "laurier", "foudre"]


def level_index(level: str) -> int:
    return LEVELS.index(level)
```
`server/app/security.py`:
```python
"""PIN hashing. Not a security boundary (spec §3.1), just enough not to store the digits."""
import hashlib, os

ITERATIONS = 50_000


def hash_pin(pin: str) -> str:
    salt = os.urandom(8).hex()
    digest = hashlib.pbkdf2_hmac("sha256", pin.encode(), salt.encode(), ITERATIONS).hex()
    return f"{salt}${digest}"


def verify_pin(pin: str, stored: str) -> bool:
    salt, digest = stored.split("$", 1)
    candidate = hashlib.pbkdf2_hmac("sha256", pin.encode(), salt.encode(), ITERATIONS).hex()
    return hashlib.compare_digest(candidate, digest)
```
`server/app/schemas.py` (profiles part; later tasks append):
```python
from __future__ import annotations
from typing import Any
from pydantic import BaseModel, Field, field_validator
from app.levels import LEVELS, AVATARS

PIN_RE = r"^\d{4}$"


class ProfileCreate(BaseModel):
    name: str = Field(min_length=1, max_length=30)
    avatar: str
    level: str
    pin: str | None = Field(default=None, pattern=PIN_RE)

    @field_validator("level")
    @classmethod
    def _level(cls, v: str) -> str:
        if v not in LEVELS:
            raise ValueError("unknown level")
        return v

    @field_validator("avatar")
    @classmethod
    def _avatar(cls, v: str) -> str:
        if v not in AVATARS:
            raise ValueError("unknown avatar")
        return v


class ProfilePatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=30)
    avatar: str | None = None
    level: str | None = None
    pin: str | None = None   # "" clears the PIN; must otherwise match PIN_RE (checked in the router)
    settings: dict[str, Any] | None = None


class ProfileOut(BaseModel):
    id: int
    name: str
    avatar: str
    level: str
    has_pin: bool
    help_stage: int
    created_at: str
    settings: dict[str, Any]


class PinCheck(BaseModel):
    pin: str
```
`server/app/routers/profiles.py`:
```python
import json, re, sqlite3
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Response
from app.db import get_db
from app.levels import LEVELS, AVATARS
from app.schemas import ProfileCreate, ProfilePatch, ProfileOut, PinCheck, PIN_RE
from app.security import hash_pin, verify_pin

router = APIRouter(prefix="/api/profiles", tags=["profiles"])


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def to_out(row: sqlite3.Row) -> ProfileOut:
    return ProfileOut(id=row["id"], name=row["name"], avatar=row["avatar"], level=row["level"],
                      has_pin=row["pin_hash"] is not None, help_stage=row["help_stage"],
                      created_at=row["created_at"], settings=json.loads(row["settings_json"] or "{}"))


def fetch_profile(db: sqlite3.Connection, profile_id: int) -> sqlite3.Row:
    row = db.execute("SELECT * FROM profile WHERE id = ?", (profile_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "Profile not found")
    return row


@router.get("", response_model=list[ProfileOut])
def list_profiles(db: sqlite3.Connection = Depends(get_db)):
    return [to_out(r) for r in db.execute("SELECT * FROM profile ORDER BY created_at, id")]


@router.post("", response_model=ProfileOut, status_code=201)
def create_profile(body: ProfileCreate, db: sqlite3.Connection = Depends(get_db)):
    try:
        cur = db.execute(
            "INSERT INTO profile(name, avatar, level, pin_hash, created_at) VALUES (?,?,?,?,?)",
            (body.name.strip(), body.avatar, body.level, hash_pin(body.pin) if body.pin else None, now()))
    except sqlite3.IntegrityError:
        raise HTTPException(409, "Ce nom est déjà pris")
    return to_out(fetch_profile(db, cur.lastrowid))


@router.get("/{profile_id}", response_model=ProfileOut)
def get_profile(profile_id: int, db: sqlite3.Connection = Depends(get_db)):
    return to_out(fetch_profile(db, profile_id))


@router.patch("/{profile_id}", response_model=ProfileOut)
def patch_profile(profile_id: int, body: ProfilePatch, db: sqlite3.Connection = Depends(get_db)):
    row = fetch_profile(db, profile_id)
    updates: dict[str, object] = {}
    if body.name is not None: updates["name"] = body.name.strip()
    if body.avatar is not None:
        if body.avatar not in AVATARS: raise HTTPException(422, "unknown avatar")
        updates["avatar"] = body.avatar
    if body.level is not None:
        if body.level not in LEVELS: raise HTTPException(422, "unknown level")
        updates["level"] = body.level
    if body.pin is not None:
        if body.pin == "": updates["pin_hash"] = None
        elif re.fullmatch(PIN_RE, body.pin): updates["pin_hash"] = hash_pin(body.pin)
        else: raise HTTPException(422, "pin must be 4 digits")
    if body.settings is not None:
        merged = {**json.loads(row["settings_json"] or "{}"), **body.settings}
        updates["settings_json"] = json.dumps(merged, ensure_ascii=False)
    if updates:
        sets = ", ".join(f"{k} = ?" for k in updates)
        try:
            db.execute(f"UPDATE profile SET {sets} WHERE id = ?", (*updates.values(), profile_id))
        except sqlite3.IntegrityError:
            raise HTTPException(409, "Ce nom est déjà pris")
    return to_out(fetch_profile(db, profile_id))


@router.delete("/{profile_id}", status_code=204)
def delete_profile(profile_id: int, db: sqlite3.Connection = Depends(get_db)):
    fetch_profile(db, profile_id)
    db.execute("DELETE FROM profile WHERE id = ?", (profile_id,))
    return Response(status_code=204)


@router.post("/{profile_id}/verify-pin")
def check_pin(profile_id: int, body: PinCheck, db: sqlite3.Connection = Depends(get_db)):
    row = fetch_profile(db, profile_id)
    if row["pin_hash"] is None:
        return {"ok": True}
    return {"ok": verify_pin(body.pin, row["pin_hash"])}
```
Register it in `main.py` (above the `/api/{rest:path}` catch-all): `from app.routers import profiles` … `app.include_router(profiles.router)`.

- [ ] **Step 8: Run all server tests**

Run: `scripts/pytest.sh -v`  Expected: all pass (health 2 + db 3 + profiles 5).

- [ ] **Step 9: Commit**

```bash
git add server
git commit -m "Add SQLite migrations and profiles API

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Homophone table and spaCy annotation module

The annotation is stored as JSON on each text and drives the Argus passes and the explanations. It never decides correctness (spec §1.3).

**Files:**
- Modify: `content/homophones.json` (replace the placeholder)
- Create: `server/app/nlp/__init__.py`, `server/app/nlp/homophones.py`, `server/app/nlp/model.py`, `server/app/nlp/annotate.py`
- Test: `server/tests/test_homophones.py`, `server/tests/test_annotate.py`
- Modify: `server/tests/conftest.py` (session-scoped `nlp` fixture)

**Interfaces:**
- Produces: `content/homophones.json` with shape `{"version": 1, "sets": [{"id": "a", "words": ["a","à","as"], "hint": "…"}, …]}`. `id` is the first word of the set. Words are lower-case, apostrophes are straight (`'`), and multi-word homophones are excluded. Both Python and TypeScript (Task 7) read this file.
- Produces: `app/nlp/homophones.py`: `class Homophones` with `set_of(word: str) -> str | None` (lower-cases, unifies `’` to `'`), `words(set_id) -> list[str]`, `hint(set_id) -> str`; `load_homophones(content_dir: Path) -> Homophones` (cached per path).
- Produces: `app/nlp/model.py`: `get_nlp(model_name: str)` — loads once per process (`functools.lru_cache`) with `spacy.load(model_name, exclude=["ner"])`.
- Produces: `app/nlp/annotate.py`: `annotate(text: str, nlp, homophones: Homophones) -> dict` returning
  ```json
  {"version": 1, "model": "<nlp.meta name>",
   "tokens": [{"i": 0, "text": "Les", "start": 0, "end": 3, "lemma": "le", "pos": "DET",
               "morph": {"Definite": "Def", "Gender": "Masc", "Number": "Plur", "PronType": "Art"},
               "head": 1, "dep": "det", "categories": ["nominal_group"], "homophone": null, "subject": null}],
   "sentences": [{"start": 0, "end": 34}]}
  ```
  and the pure helper `derive(tokens: list[dict], homophones: Homophones) -> list[dict]` that fills `categories`, `homophone` and `subject` from `pos`/`morph`/`dep`/`head`/`text` (tested without a model). Whitespace tokens are dropped; punctuation tokens are kept with `categories: []`.
- Category rules (exact):
  - `verb`: `pos in {"VERB","AUX"}` and `morph.get("VerbForm") == "Fin"`.
  - `participle`: `pos in {"VERB","AUX"}` and `morph.get("VerbForm") == "Part"`. If additionally `dep in {"amod","acl","acl:relcl"}`, also `nominal_group`.
  - `nominal_group`: `pos in {"DET","NOUN","ADJ"}` or (`pos == "PRON"` and `dep == "det"`).
  - `homophone`: `homophones.set_of(text)` is not None → field `homophone` = set id and category `homophone` added.
  - `subject`: for tokens with `verb`/`participle`: index of the first token whose `head == i` and `dep in {"nsubj","nsubj:pass"}`; if none and `dep in {"aux","aux:pass","aux:tense","cop"}`, the same lookup on the token's head; else `null`.

- [ ] **Step 1: Write `content/homophones.json`**

Write all sets below (hints in French, kid-friendly, each one a replacement trick a teacher would give). Keep exactly this structure; add no multi-word entries.

```json
{
  "version": 1,
  "sets": [
    {"id": "a", "words": ["a", "à", "as"], "hint": "« a » (et « as ») peut se remplacer par « avait » : « il avait » → « a ». Sinon, c'est « à » avec un accent."},
    {"id": "et", "words": ["et", "est", "es"], "hint": "« est » peut se remplacer par « était ». « et » veut dire « et puis »."},
    {"id": "ces", "words": ["ces", "ses", "c'est", "s'est", "sais", "sait"], "hint": "« ses » = les siens (« ses livres » → « son livre »). « ces » = ceux-là (« ces livres » → « ce livre »). « c'est » = « cela est ». « s'est » est suivi d'un participe passé (« il s'est levé »)."},
    {"id": "son", "words": ["son", "sont"], "hint": "« sont » peut se remplacer par « étaient ». « son » = le sien."},
    {"id": "on", "words": ["on", "ont"], "hint": "« ont » peut se remplacer par « avaient ». « on » peut se remplacer par « il »."},
    {"id": "ou", "words": ["ou", "où"], "hint": "« ou » peut se remplacer par « ou bien ». « où » indique un lieu ou un moment."},
    {"id": "leur", "words": ["leur", "leurs"], "hint": "Devant un verbe, « leur » ne prend jamais de s (« il leur parle »). Devant un nom, il s'accorde avec le nom (« leurs chevaux »)."},
    {"id": "la", "words": ["la", "l'a", "là", "l'as"], "hint": "« l'a » peut se remplacer par « l'avait ». « là » indique un lieu (« ici ou là »). « la » est un article ou un pronom."},
    {"id": "ce", "words": ["ce", "se", "ceux"], "hint": "« se » est toujours devant un verbe (« il se lave » → « je me lave »). « ce » est devant un nom ou dans « ce qui / ce que »."},
    {"id": "peu", "words": ["peu", "peut", "peux"], "hint": "« peut » et « peux » peuvent se remplacer par « pouvait » / « pouvais ». « peu » = pas beaucoup."},
    {"id": "quel", "words": ["quel", "quelle", "quels", "quelles", "qu'elle", "qu'elles"], "hint": "« qu'elle » peut se remplacer par « qu'il ». « quel(le)(s) » s'accorde avec le nom qui suit."},
    {"id": "mes", "words": ["mes", "mais", "met", "mets", "m'est", "m'es"], "hint": "« mais » = pourtant. « mes » = les miens. « met / mets » viennent du verbe mettre."},
    {"id": "ni", "words": ["ni", "n'y"], "hint": "« n'y » = « ne … y » (« il n'y va pas » → « il y va »). « ni » relie deux négations."},
    {"id": "si", "words": ["si", "s'y"], "hint": "« s'y » = « se … y » (« il s'y rend » → « je m'y rends »)."},
    {"id": "dans", "words": ["dans", "d'en"], "hint": "« d'en » = « de … en » (« il vient d'en manger »). « dans » = à l'intérieur de."},
    {"id": "sans", "words": ["sans", "s'en", "cent", "sang"], "hint": "« s'en » = « se … en » (« il s'en va » → « je m'en vais »). « sans » = le contraire de « avec »."},
    {"id": "ma", "words": ["ma", "m'a", "m'as"], "hint": "« m'a » peut se remplacer par « m'avait ». « ma » = la mienne."},
    {"id": "ta", "words": ["ta", "t'a", "t'as"], "hint": "« t'a » peut se remplacer par « t'avait ». « ta » = la tienne."},
    {"id": "sa", "words": ["sa", "ça", "çà"], "hint": "« ça » peut se remplacer par « cela ». « sa » = la sienne."},
    {"id": "quand", "words": ["quand", "quant", "qu'en"], "hint": "« quand » = à quel moment. « quant à » = en ce qui concerne. « qu'en » = « que … en »."},
    {"id": "tout", "words": ["tout", "tous"], "hint": "« tous » se dit devant un nom au pluriel (« tous les jours »). « tout » devant un adjectif ou un nom singulier."},
    {"id": "notre", "words": ["notre", "nôtre"], "hint": "« le nôtre » a un accent et un article devant. « notre maison » n'a pas d'accent."},
    {"id": "votre", "words": ["votre", "vôtre"], "hint": "« le vôtre » a un accent et un article devant. « votre maison » n'a pas d'accent."},
    {"id": "près", "words": ["près", "prêt"], "hint": "« près » = pas loin. « prêt » = préparé (« prête » au féminin)."},
    {"id": "dont", "words": ["dont", "donc"], "hint": "« donc » = par conséquent. « dont » remplace « de qui / de quoi »."},
    {"id": "foi", "words": ["foi", "foie", "fois"], "hint": "« une fois, deux fois » ; « le foie » est un organe ; « la foi » est la croyance."},
    {"id": "voie", "words": ["voie", "voix", "vois", "voit"], "hint": "« vois / voit » viennent du verbe voir. « la voix » chante ; « la voie » est un chemin."},
    {"id": "ver", "words": ["ver", "vers", "vert", "verre", "vair"], "hint": "« vert » est une couleur ; « le verre » se boit ; « vers » = en direction de ; « un ver » de terre."},
    {"id": "cour", "words": ["cour", "cours", "court"], "hint": "« court » vient du verbe courir (« il court ») ou veut dire petit ; « la cour » de l'école ; « le cours »."},
    {"id": "cette", "words": ["cette", "sept"], "hint": "« cette » est devant un nom féminin ; « sept » est un nombre."},
    {"id": "davantage", "words": ["davantage", "d'avantage", "d'avantages"], "hint": "« davantage » = plus. « d'avantage(s) » = de bénéfice(s)."}
  ]
}
```

- [ ] **Step 2: Failing tests for the loader and `derive`**

`server/tests/test_homophones.py`:
```python
from pathlib import Path
from app.nlp.homophones import load_homophones

CONTENT = Path(__file__).resolve().parents[2] / "content"


def test_loads_repo_table():
    h = load_homophones(CONTENT)
    assert h.set_of("à") == "a"
    assert h.set_of("A") == "a"
    assert h.set_of("c’est") == "ces"      # typographic apostrophe unified
    assert h.set_of("maison") is None
    assert "sont" in h.words("son")
    assert "étaient" in h.hint("son")


def test_words_are_unique_across_sets():
    h = load_homophones(CONTENT)
    seen = set()
    for s in h.sets:
        for w in s["words"]:
            assert w not in seen, w
            seen.add(w)
```
`server/tests/test_annotate.py`:
```python
from pathlib import Path
import pytest
from app.nlp.annotate import annotate, derive
from app.nlp.homophones import load_homophones

CONTENT = Path(__file__).resolve().parents[2] / "content"


def tok(i, text, pos, morph=None, head=None, dep="dep"):
    return {"i": i, "text": text, "start": 0, "end": 0, "lemma": text.lower(), "pos": pos,
            "morph": morph or {}, "head": i if head is None else head, "dep": dep}


def test_derive_categories_and_subject():
    h = load_homophones(CONTENT)
    tokens = [
        tok(0, "Les", "DET", {"Number": "Plur"}, head=1, dep="det"),
        tok(1, "fées", "NOUN", {"Gender": "Fem", "Number": "Plur"}, head=3, dep="nsubj"),
        tok(2, "ont", "AUX", {"VerbForm": "Fin", "Number": "Plur"}, head=3, dep="aux:tense"),
        tok(3, "dansé", "VERB", {"VerbForm": "Part"}, head=3, dep="ROOT"),
        tok(4, "à", "ADP", {}, head=6, dep="case"),
        tok(5, "la", "DET", {"Gender": "Fem"}, head=6, dep="det"),
        tok(6, "fête", "NOUN", {"Gender": "Fem"}, head=3, dep="obl"),
        tok(7, "épuisées", "VERB", {"VerbForm": "Part", "Number": "Plur"}, head=1, dep="acl"),
        tok(8, ".", "PUNCT", {}, head=3, dep="punct"),
    ]
    out = derive(tokens, h)
    cats = {t["text"]: set(t["categories"]) for t in out}
    assert cats["Les"] == {"nominal_group"}
    assert cats["fées"] == {"nominal_group"}
    assert cats["ont"] == {"verb", "homophone"}
    assert cats["dansé"] == {"participle"}
    assert cats["à"] == {"homophone"}
    assert cats["la"] == {"nominal_group", "homophone"}
    assert cats["épuisées"] == {"participle", "nominal_group"}
    assert cats["."] == set()
    by = {t["text"]: t for t in out}
    assert by["à"]["homophone"] == "a" and by["fête"]["homophone"] is None
    assert by["dansé"]["subject"] == 1          # nsubj child of the participle
    assert by["ont"]["subject"] == 1            # aux borrows the head's subject
    assert by["épuisées"]["subject"] is None


def test_annotate_with_real_model(nlp):
    h = load_homophones(CONTENT)
    a = annotate("Les fées dansent dans la clairière. Il a chanté.", nlp, h)
    assert a["version"] == 1 and a["model"]
    texts = [t["text"] for t in a["tokens"]]
    assert "dansent" in texts and "." in texts and " " not in texts
    first = a["tokens"][0]
    assert first["text"] == "Les" and first["start"] == 0 and first["end"] == 3
    assert "nominal_group" in first["categories"]
    dansent = next(t for t in a["tokens"] if t["text"] == "dansent")
    assert dansent["pos"] in {"VERB", "AUX"}
    a_tok = next(t for t in a["tokens"] if t["text"] == "a")
    assert a_tok["homophone"] == "a"
    assert len(a["sentences"]) == 2 and a["sentences"][0]["start"] == 0
    # every token span must slice the original text exactly
    text = "Les fées dansent dans la clairière. Il a chanté."
    for t in a["tokens"]:
        assert text[t["start"]:t["end"]] == t["text"]
```
Add to `server/tests/conftest.py`:
```python
@pytest.fixture(scope="session")
def nlp():
    from app.nlp.model import get_nlp
    return get_nlp("fr_core_news_sm")
```
and make the `settings` fixture copy the real homophone table into the temporary content dir (every later API test that annotates a text needs it):
```python
import shutil
from pathlib import Path

REPO_CONTENT = Path(__file__).resolve().parents[2] / "content"


@pytest.fixture
def settings(tmp_path):
    content = tmp_path / "content"
    content.mkdir()
    shutil.copy(REPO_CONTENT / "homophones.json", content / "homophones.json")
    return Settings(data_dir=tmp_path / "data", content_dir=content,
                    static_dir=tmp_path / "static", spacy_model="fr_core_news_sm",
                    seed_on_startup=False)
```

- [ ] **Step 3: Run to verify failure**

Run: `scripts/pytest.sh tests/test_homophones.py tests/test_annotate.py -v`  Expected: `ModuleNotFoundError: app.nlp`.

- [ ] **Step 4: Implement the three modules**

`server/app/nlp/homophones.py`:
```python
"""Loads content/homophones.json, the single homophone table shared with the web client."""
from __future__ import annotations
import json
from functools import lru_cache
from pathlib import Path


def normalize_word(word: str) -> str:
    return word.lower().replace("’", "'").replace("ʼ", "'")


class Homophones:
    def __init__(self, data: dict):
        self.sets: list[dict] = data["sets"]
        self._index: dict[str, str] = {}
        for s in self.sets:
            for w in s["words"]:
                self._index[normalize_word(w)] = s["id"]

    def set_of(self, word: str) -> str | None:
        return self._index.get(normalize_word(word))

    def words(self, set_id: str) -> list[str]:
        return next(s["words"] for s in self.sets if s["id"] == set_id)

    def hint(self, set_id: str) -> str:
        return next(s["hint"] for s in self.sets if s["id"] == set_id)


@lru_cache(maxsize=4)
def load_homophones(content_dir: Path) -> Homophones:
    with open(Path(content_dir) / "homophones.json", encoding="utf-8") as f:
        return Homophones(json.load(f))
```
`server/app/nlp/model.py`:
```python
"""Lazy, process-wide spaCy model loader."""
from functools import lru_cache
import spacy


@lru_cache(maxsize=2)
def get_nlp(model_name: str):
    return spacy.load(model_name, exclude=["ner"])
```
`server/app/nlp/annotate.py`:
```python
"""spaCy annotation of a reference text. Output is highlighting/explanation metadata only (spec §1.3)."""
from __future__ import annotations
from app.nlp.homophones import Homophones

ANNOTATION_VERSION = 1
VERB_POS = {"VERB", "AUX"}
SUBJECT_DEPS = {"nsubj", "nsubj:pass"}
AUX_DEPS = {"aux", "aux:pass", "aux:tense", "cop"}
ADJ_PARTICIPLE_DEPS = {"amod", "acl", "acl:relcl"}


def _subject_of(i: int, tokens: list[dict]) -> int | None:
    for t in tokens:
        if t["head"] == i and t["dep"] in SUBJECT_DEPS and t["i"] != i:
            return t["i"]
    return None


def derive(tokens: list[dict], homophones: Homophones) -> list[dict]:
    """Fill categories / homophone / subject on a list of raw token dicts (pure, model-free)."""
    out = []
    for t in tokens:
        pos, morph, dep = t["pos"], t.get("morph", {}), t["dep"]
        cats: list[str] = []
        is_verb = pos in VERB_POS
        if is_verb and morph.get("VerbForm") == "Fin":
            cats.append("verb")
        if is_verb and morph.get("VerbForm") == "Part":
            cats.append("participle")
            if dep in ADJ_PARTICIPLE_DEPS:
                cats.append("nominal_group")
        if pos in {"DET", "NOUN", "ADJ"} or (pos == "PRON" and dep == "det"):
            cats.append("nominal_group")
        hom = homophones.set_of(t["text"]) if pos != "PUNCT" else None
        if hom:
            cats.append("homophone")
        subject = None
        if "verb" in cats or "participle" in cats:
            subject = _subject_of(t["i"], tokens)
            if subject is None and dep in AUX_DEPS:
                subject = _subject_of(t["head"], tokens)
        out.append({**t, "categories": cats, "homophone": hom, "subject": subject})
    return out


def annotate(text: str, nlp, homophones: Homophones) -> dict:
    doc = nlp(text)
    raw = []
    index_map: dict[int, int] = {}
    for tok in doc:
        if tok.is_space:
            continue
        index_map[tok.i] = len(raw)
        raw.append({"i": len(raw), "text": tok.text, "start": tok.idx, "end": tok.idx + len(tok.text),
                    "lemma": tok.lemma_, "pos": tok.pos_, "morph": tok.morph.to_dict(),
                    "head": tok.head.i, "dep": tok.dep_})
    for t in raw:  # remap heads after dropping whitespace tokens
        t["head"] = index_map.get(t["head"], t["i"])
    tokens = derive(raw, homophones)
    sentences = [{"start": s.start_char, "end": s.end_char} for s in doc.sents]
    return {"version": ANNOTATION_VERSION, "model": nlp.meta.get("name", ""), "tokens": tokens, "sentences": sentences}
```

- [ ] **Step 5: Run tests**

Run: `scripts/pytest.sh -v`  Expected: all pass. If `test_annotate_with_real_model` fails only on the `pos` of "dansent" with `fr_core_news_sm`, change the sentence to "Les enfants mangent une pomme." (the assertion must hold with the small model; do not weaken it to accept non-verbs).

- [ ] **Step 6: Commit**

```bash
git add content/homophones.json server
git commit -m "Add homophone table and spaCy annotation module

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Texts API and seed import

**Files:**
- Create: `server/app/deps.py`, `server/app/routers/texts.py`, `server/app/seed.py`, `server/app/textutil.py`
- Modify: `server/app/schemas.py` (text models), `server/app/main.py` (router, seed on startup)
- Test: `server/tests/test_texts.py`, `server/tests/test_seed.py`, `server/tests/test_seed_files.py`, `server/tests/fixtures/seed/001-test-fees.json`, `server/tests/fixtures/seed/002-test-loup.json`

**Interfaces:**
- Consumes: `get_db`, `annotate(text, nlp, homophones)`, `load_homophones`, `get_nlp`, `LEVELS`.
- Produces: `app/deps.py:get_annotator(request) -> Callable[[str], dict]` (loads the model named by `settings.spacy_model` on first use, stores it on `app.state.nlp`).
- Produces: `app/textutil.py`: `word_count(body: str) -> int` (count of regex `[^\W\d_]+(?:['’-][^\W\d_]+)*` matches), `words(body) -> list[str]` (same, lower-cased), `has_digits(body) -> bool`, `build_credits(author, work, translator) -> str` (`"Alphonse Daudet, Lettres de mon moulin"`, `"Homère, L'Odyssée, trad. Victor Bérard"`).
- Produces: seed file schema (`content/seed/NNN-slug.json`, `NNN` three digits; `seed_key` = file stem):
  ```json
  {"title": "…", "author": "Alphonse Daudet", "author_death": 1897,
   "translator": null, "translator_death": null, "work": "Lettres de mon moulin", "year": 1869,
   "level": "8H", "original": false, "source_url": "https://fr.wikisource.org/wiki/…",
   "license_note": "Domaine public : auteur mort en 1897.", "body": "…"}
  ```
  Original passages written for the game use `"original": true`, `"author": "Les Muses de la Discorde"`, `"author_death": null`, `"source_url": null`.
- Produces: `app/seed.py:import_seed(conn, content_dir: Path, annotate_fn) -> int` (inserts missing seed texts, returns how many were inserted; idempotent).
- Produces: schemas `TextCreate(title: str[1..120], body: str, level: str, source: "custom", author?, translator?, work?, credits?, added_by_profile_id?: int, due_date?: "YYYY-MM-DD")`, `TextSummary(id, title, level, source, author, translator, work, credits, word_count, added_by_profile_id, added_by_name, due_date, created_at, history: {times_played, best_score, best_catch_rate} | None)`, `TextFull(TextSummary + body + annotation: dict)`.
- Produces endpoints:
  - `GET /api/texts?profile_id=<id>` -> `TextSummary[]` ordered by `level` index then `created_at`; `history` filled when `profile_id` is given (from `session`), else `null`. (The `session` table exists since Task 2; until Task 5 it is simply empty.)
  - `POST /api/texts` -> 201 `TextFull`. 422 when: body has fewer than 5 words, more than 4000 characters, contains digits (detail `"Écris les nombres en lettres"`), level unknown, source is not `custom`.
  - `GET /api/texts/{id}` -> `TextFull`, 404 if missing.
  - `DELETE /api/texts/{id}` -> 204; 403 for `source == "seed"`.

- [ ] **Step 1: Failing tests**

`server/tests/fixtures/seed/001-test-fees.json` (test fixture, ~90 words, original text; write real French, no digits):
```json
{
  "title": "Les fées de la clairière",
  "author": "Les Muses de la Discorde", "author_death": null,
  "translator": null, "translator_death": null,
  "work": "Textes originaux", "year": 2026, "level": "7H", "original": true,
  "source_url": null, "license_note": "Texte original écrit pour le jeu.",
  "body": "Les fées dansent dans la clairière quand la lune se lève. Elles chantent des airs anciens que les oiseaux écoutent en silence. Une petite renarde, cachée sous les fougères, observe leurs robes légères qui tournent et brillent. Les étoiles, elles aussi, semblent battre la mesure. Quand le vent se glisse entre les branches, les lanternes vacillent, mais aucune ne s'éteint. Au matin, les fées disparaissent, et seules leurs traces argentées restent sur l'herbe mouillée. La renarde rentre chez elle, la tête pleine de musique, et rêve toute la journée des pas qu'elle a vus."
}
```
`002-test-loup.json`: same shape, `"level": "6H"`, another ~90-word original text about a wolf who counts the sheep and loses count (write it; imparfait + passé simple; no digits).

`server/tests/test_texts.py`:
```python
FEES = "Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent."


def make_profile(client, name="Léa", level="10H"):
    return client.post("/api/profiles", json={"name": name, "avatar": "chouette", "level": level}).json()


def test_create_custom_text_is_annotated(client):
    p = make_profile(client)
    r = client.post("/api/texts", json={"title": "Fées", "body": FEES, "level": "8H", "source": "custom",
                                        "added_by_profile_id": p["id"]})
    assert r.status_code == 201, r.text
    t = r.json()
    assert t["word_count"] == 13 and t["added_by_name"] == "Léa" and t["source"] == "custom"
    assert t["annotation"]["version"] == 1 and len(t["annotation"]["tokens"]) > 10
    assert t["history"] is None
    full = client.get(f"/api/texts/{t['id']}").json()
    assert full["body"] == FEES


def test_list_orders_by_level_and_fills_history(client):
    p = make_profile(client)
    a = client.post("/api/texts", json={"title": "A", "body": FEES, "level": "10H", "source": "custom"}).json()
    b = client.post("/api/texts", json={"title": "B", "body": FEES, "level": "6H", "source": "custom"}).json()
    ids = [t["id"] for t in client.get("/api/texts").json()]
    assert ids == [b["id"], a["id"]]
    listed = client.get(f"/api/texts?profile_id={p['id']}").json()
    assert listed[0]["history"] == {"times_played": 0, "best_score": None, "best_catch_rate": None}


def test_validation(client):
    base = {"title": "T", "body": FEES, "level": "8H", "source": "custom"}
    assert client.post("/api/texts", json={**base, "body": "Trop court."}).status_code == 422
    r = client.post("/api/texts", json={**base, "body": "Il y a 3 chats qui dorment ici."})
    assert r.status_code == 422 and "nombres en lettres" in r.text
    assert client.post("/api/texts", json={**base, "source": "seed"}).status_code == 422
    assert client.post("/api/texts", json={**base, "level": "3H"}).status_code == 422


def test_delete_custom_but_not_seed(client, settings):
    t = client.post("/api/texts", json={"title": "T", "body": FEES, "level": "8H", "source": "custom"}).json()
    assert client.delete(f"/api/texts/{t['id']}").status_code == 204
    assert client.get(f"/api/texts/{t['id']}").status_code == 404

    from app.db import connect
    conn = connect(settings.data_dir / "discorde.sqlite3")
    conn.execute(
        "INSERT INTO text(title, body, source, seed_key, level, created_at) "
        "VALUES ('S', 'x y z', 'seed', '999-s', '8H', 'now')"
    )
    conn.commit()
    seed_id = conn.execute("SELECT id FROM text WHERE seed_key = '999-s'").fetchone()[0]
    assert client.delete(f"/api/texts/{seed_id}").status_code == 403
```
`server/tests/test_seed.py`:
```python
import shutil
from pathlib import Path
from app.db import connect, migrate
from app.seed import import_seed

FIXTURES = Path(__file__).parent / "fixtures" / "seed"


def fake_annotate(text):
    return {"version": 1, "model": "fake", "tokens": [], "sentences": []}


def test_import_seed_is_idempotent(tmp_path):
    content = tmp_path / "content"
    shutil.copytree(FIXTURES, content / "seed")
    conn = connect(tmp_path / "db.sqlite3"); migrate(conn)
    assert import_seed(conn, content, fake_annotate) == 2
    assert import_seed(conn, content, fake_annotate) == 0
    rows = conn.execute("SELECT seed_key, source, credits, level FROM text ORDER BY seed_key").fetchall()
    assert [r["seed_key"] for r in rows] == ["001-test-fees", "002-test-loup"]
    assert rows[0]["source"] == "seed" and rows[0]["credits"] == "Les Muses de la Discorde, Textes originaux"
    assert rows[0]["level"] == "7H"


def test_startup_imports_seed(tmp_path, settings):
    from fastapi.testclient import TestClient
    from app.main import create_app
    from dataclasses import replace
    shutil.copytree(FIXTURES, settings.content_dir / "seed")
    shutil.copy(Path(__file__).resolve().parents[2] / "content" / "homophones.json", settings.content_dir)
    s = replace(settings, seed_on_startup=True)
    with TestClient(create_app(s)) as c:
        titles = [t["title"] for t in c.get("/api/texts").json()]
    assert "Les fées de la clairière" in titles
```
`server/tests/test_seed_files.py` (validates the real `content/seed/` directory; passes vacuously until Task 6 adds files, and then guards them):
```python
import json, re
from pathlib import Path
import pytest
from app.levels import LEVELS
from app.textutil import word_count, has_digits

SEED_DIR = Path(__file__).resolve().parents[2] / "content" / "seed"
FILES = sorted(SEED_DIR.glob("*.json")) if SEED_DIR.exists() else []
REQUIRED = {"title", "author", "author_death", "translator", "translator_death", "work", "year",
            "level", "original", "source_url", "license_note", "body"}


@pytest.mark.parametrize("path", FILES, ids=[p.stem for p in FILES])
def test_seed_file_is_valid(path):
    assert re.fullmatch(r"\d{3}-[a-z0-9-]+", path.stem), "file name must be NNN-slug"
    d = json.loads(path.read_text(encoding="utf-8"))
    assert REQUIRED <= set(d), REQUIRED - set(d)
    assert d["level"] in LEVELS
    assert 80 <= word_count(d["body"]) <= 200, word_count(d["body"])
    assert not has_digits(d["body"]), "numbers must be written as words"
    if d["original"]:
        assert d["author"] == "Les Muses de la Discorde"
    else:
        assert isinstance(d["author_death"], int) and d["author_death"] < 1956
        assert d["source_url"], "non-original passages must cite their source"
        if d["translator"]:
            assert isinstance(d["translator_death"], int) and d["translator_death"] < 1956


def test_titles_unique():
    titles = [json.loads(p.read_text(encoding="utf-8"))["title"] for p in FILES]
    assert len(titles) == len(set(titles))
```

- [ ] **Step 2: Run to verify failure**

Run: `scripts/pytest.sh tests/test_texts.py tests/test_seed.py tests/test_seed_files.py -v`  Expected: import errors for `app.seed`, `app.textutil`; 404s for texts.

- [ ] **Step 3: Implement**

`server/app/textutil.py`:
```python
import re
WORD_RE = re.compile(r"[^\W\d_]+(?:['’-][^\W\d_]+)*")


def words(body: str) -> list[str]:
    return [m.group(0).lower() for m in WORD_RE.finditer(body)]


def word_count(body: str) -> int:
    return len(WORD_RE.findall(body))


def has_digits(body: str) -> bool:
    return any(ch.isdigit() for ch in body)


def build_credits(author: str | None, work: str | None, translator: str | None) -> str:
    parts = [p for p in [author, work] if p]
    s = ", ".join(parts)
    if translator:
        s += f", trad. {translator}"
    return s
```
`server/app/deps.py`:
```python
from typing import Callable
from fastapi import Request
from app.nlp.annotate import annotate
from app.nlp.homophones import load_homophones
from app.nlp.model import get_nlp


def make_annotator(settings) -> Callable[[str], dict]:
    nlp = get_nlp(settings.spacy_model)
    homophones = load_homophones(settings.content_dir)
    return lambda text: annotate(text, nlp, homophones)


def get_annotator(request: Request) -> Callable[[str], dict]:
    if not hasattr(request.app.state, "annotator"):
        request.app.state.annotator = make_annotator(request.app.state.settings)
    return request.app.state.annotator
```
`server/app/seed.py`:
```python
"""Imports content/seed/*.json into the text table (source='seed'), skipping already-imported keys."""
from __future__ import annotations
import json, sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable
from app.textutil import build_credits


def import_seed(conn: sqlite3.Connection, content_dir: Path, annotate_fn: Callable[[str], dict]) -> int:
    seed_dir = Path(content_dir) / "seed"
    if not seed_dir.is_dir():
        return 0
    existing = {r[0] for r in conn.execute("SELECT seed_key FROM text WHERE seed_key IS NOT NULL")}
    inserted = 0
    for path in sorted(seed_dir.glob("*.json")):
        key = path.stem
        if key in existing:
            continue
        d = json.loads(path.read_text(encoding="utf-8"))
        conn.execute(
            """INSERT INTO text(title, body, source, seed_key, level, author, translator, work, credits,
                               annotation_json, created_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (d["title"], d["body"].strip(), "seed", key, d["level"], d.get("author"), d.get("translator"),
             d.get("work"), build_credits(d.get("author"), d.get("work"), d.get("translator")),
             json.dumps(annotate_fn(d["body"].strip()), ensure_ascii=False),
             datetime.now(timezone.utc).isoformat()))
        inserted += 1
    conn.commit()
    return inserted
```
In `main.py` lifespan, after `migrate`: `if settings.seed_on_startup: from app.deps import make_annotator; from app.seed import import_seed; import_seed(conn, settings.content_dir, make_annotator(settings))` — and set `app.state.annotator` to that annotator so the model is loaded once.

Schemas to append to `schemas.py`:
```python
class TextCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    body: str = Field(min_length=1, max_length=4000)
    level: str
    source: str = "custom"
    author: str | None = None
    translator: str | None = None
    work: str | None = None
    credits: str | None = None
    added_by_profile_id: int | None = None
    due_date: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")


class TextHistory(BaseModel):
    times_played: int
    best_score: int | None
    best_catch_rate: float | None


class TextSummary(BaseModel):
    id: int
    title: str
    level: str
    source: str
    author: str | None
    translator: str | None
    work: str | None
    credits: str | None
    word_count: int
    added_by_profile_id: int | None
    added_by_name: str | None
    due_date: str | None
    created_at: str


class TextSummaryWithHistory(TextSummary):
    history: TextHistory | None = None


class TextFull(TextSummaryWithHistory):
    body: str
    annotation: dict[str, Any]
```
`server/app/routers/texts.py`: implement the four endpoints. Key points:
- `POST`: validate (`source != "custom"` → 422; `level not in LEVELS` → 422; `word_count(body) < 5` → 422; `has_digits(body)` → `HTTPException(422, "Écris les nombres en lettres")`), `credits = body.credits or build_credits(author, work, translator)`, `annotation_json = json.dumps(annotate_fn(body.strip()), ensure_ascii=False)`.
- List query:
  ```sql
  SELECT t.*, p.name AS added_by_name FROM text t LEFT JOIN profile p ON p.id = t.added_by_profile_id
  ```
  then sort in Python by `(level_index(level), created_at)`. History per text when `profile_id` is given:
  ```sql
  SELECT text_id, COUNT(*) AS n, MAX(score) AS best_score, MAX(catch_rate) AS best_catch_rate
  FROM session WHERE profile_id = ? GROUP BY text_id
  ```
  Texts without a session get `{"times_played": 0, "best_score": None, "best_catch_rate": None}`.
- `DELETE` returns 403 with detail `"Les textes du jeu ne peuvent pas être supprimés"` for seed texts.
Register the router in `main.py` above the catch-all.

- [ ] **Step 4: Run the server tests**

Run: `scripts/pytest.sh -v`  Expected: all pass (`test_seed_files` reports 1 test — `test_titles_unique` — or is collected empty for the parametrized one; both are fine).

- [ ] **Step 5: Manual smoke through the dev image**

Run: `scripts/py.sh python -c "from app.textutil import word_count; print(word_count('Les fées dansent.'))"` → `3`.

- [ ] **Step 6: Commit**

```bash
git add server
git commit -m "Add texts API and seed import

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Sessions, stats, adaptive help stage, trap words API

**Files:**
- Create: `server/app/stats.py`, `server/app/routers/sessions.py`, `server/app/routers/stats.py`
- Modify: `server/app/schemas.py`, `server/app/main.py`
- Test: `server/tests/test_stats_logic.py`, `server/tests/test_sessions.py`

**Interfaces:**
- Consumes: tables from Task 2, `words()` from `app/textutil.py`.
- Produces: the **session result contract** that the TypeScript grading engine (Task 7) must emit as `result` (the server validates only the keys it uses):
  ```json
  {"version": 1,
   "byCategory": {"agreement:verb": {"opportunities": 12, "draft": 2, "caught": 1, "missed": 1, "introduced": 0}},
   "draftErrors": [{"refIndex": 3, "typedIndex": 3, "expected": "dansent", "typed": "danse", "category": "agreement", "sub": "verb"}],
   "finalErrors": [], "caught": [], "missed": [], "introduced": [],
   "correctWords": 95, "totalWords": 100, "catchRate": 0.5, "score": 320}
  ```
  Stat key of an error = `agreement:<sub or 'other'>` for `category == "agreement"`, else the category itself. `byCategory` keys are stat keys.
- Produces: `app/stats.py`:
  - `stat_key(error: dict) -> str`
  - `apply_session_to_stats(conn, profile_id: int, result: dict, day: str, now: str) -> None` (upserts `profile_stat` and `profile_stat_day` by adding `opportunities`, `draft`→`errors_in_draft`, `caught`, `missed`).
  - `update_trap_words(conn, profile_id: int, result: dict, reference_body: str, now: str) -> None` (rules below).
  - `next_help_stage(current: int, recent_rates: list[float]) -> int` — `recent_rates` = catch rates (most recent first) of sessions played **at the current stage**, nulls excluded, including the session being saved. Up (max 4) when `len >= 3 and all(r >= 0.7 for r in recent_rates[:3])`; down (min 1) when `len >= 2 and all(r <= 0.3 for r in recent_rates[:2])`; else unchanged.
  - `argus_order(category_rows) -> list[str]` returning a permutation of `["verbes", "groupes_nominaux", "homophones", "mots_pieges"]`: pass buckets `verbes` = `agreement:verb`+`agreement:participle`, `groupes_nominaux` = `agreement:number`+`agreement:gender`+`agreement:other`, `homophones` = `homophone`, `mots_pieges` = `lexical`+`accent`; miss ratio = `missed / errors_in_draft` when `errors_in_draft >= 5`, else `-1`; sort by ratio descending, stable on the default order.
  - Trap word rules: every error in `draftErrors ∪ finalErrors` with `category in {"lexical","accent"}` and a non-null `expected` that matches `WORD_RE` → upsert `(profile_id, word=expected.lower())` with `misses += 1`, `box = 1`, `last_seen = now`. Then every existing trap word of the profile that occurs in `words(reference_body)` and is not in that error set → `box = min(5, box + 1)`, `last_seen = now`.
- Produces endpoints:
  - `POST /api/sessions` body `SessionCreate(profile_id, text_id, pace_level: 1..4, help_stage: 1..4, started_at, draft, final, result: dict, score: int >= 0, catch_rate: float | None)` -> 201 `{"id", "help_stage_before", "help_stage_after", "help_stage_message": str | null}`; 404 if profile or text missing. Messages: up → `"Les Muses te font confiance : les Yeux d'Argus s'éteignent un peu."`, down → `"Éris a été retorse. Les Muses rallument les Yeux d'Argus pour t'aider."`
  - `GET /api/profiles/{id}/stats` -> `{"profile": ProfileOut, "categories": [{"category", "occurrences", "errors_in_draft", "caught", "missed", "catch_rate": float | null}], "recent_sessions": [{"id","text_id","title","finished_at","score","catch_rate","pace_level","help_stage"}] (last 20), "trap_words": [{"word","box","misses","last_seen"}] (ordered by misses desc), "totals": {"sessions", "score", "caught"}, "argus_order": [...]}`
  - `GET /api/profiles/{id}/trap-words` -> `[{"word","box","misses","last_seen"}]`.

- [ ] **Step 1: Failing pure-logic tests**

`server/tests/test_stats_logic.py`:
```python
from app.stats import next_help_stage, argus_order, stat_key


def test_help_stage_moves_up_after_three_good_texts():
    assert next_help_stage(1, [0.8, 0.75, 0.7]) == 2
    assert next_help_stage(1, [0.8, 0.75]) == 1
    assert next_help_stage(1, [0.8, 0.6, 0.9]) == 1
    assert next_help_stage(4, [1.0, 1.0, 1.0]) == 4


def test_help_stage_moves_down_after_two_bad_texts():
    assert next_help_stage(3, [0.2, 0.3]) == 2
    assert next_help_stage(3, [0.2, 0.5]) == 3
    assert next_help_stage(1, [0.0, 0.0]) == 1


def test_stat_key():
    assert stat_key({"category": "agreement", "sub": "verb"}) == "agreement:verb"
    assert stat_key({"category": "agreement"}) == "agreement:other"
    assert stat_key({"category": "homophone", "sub": "verb_ending"}) == "homophone"


def row(cat, draft, missed):
    return {"category": cat, "errors_in_draft": draft, "missed": missed, "caught": draft - missed, "occurrences": 50}


def test_argus_order_weakest_first_with_minimum_evidence():
    assert argus_order([]) == ["verbes", "groupes_nominaux", "homophones", "mots_pieges"]
    rows = [row("agreement:verb", 10, 2), row("homophone", 8, 6), row("agreement:number", 3, 3)]
    # number has only 3 draft errors -> not enough evidence, keeps default rank
    assert argus_order(rows) == ["homophones", "verbes", "groupes_nominaux", "mots_pieges"]
```

- [ ] **Step 2: Run to verify failure**

Run: `scripts/pytest.sh tests/test_stats_logic.py -v`  Expected: `ModuleNotFoundError: app.stats`.

- [ ] **Step 3: Implement `app/stats.py`**

```python
"""Per-profile statistics derived from submitted session results (spec §3.4 help stages, §3.5 mots-pièges)."""
from __future__ import annotations
import sqlite3
from app.textutil import words, WORD_RE

DEFAULT_ARGUS = ["verbes", "groupes_nominaux", "homophones", "mots_pieges"]
PASS_BUCKETS = {
    "verbes": {"agreement:verb", "agreement:participle"},
    "groupes_nominaux": {"agreement:number", "agreement:gender", "agreement:other"},
    "homophones": {"homophone"},
    "mots_pieges": {"lexical", "accent"},
}
TRAP_CATEGORIES = {"lexical", "accent"}


def stat_key(error: dict) -> str:
    if error.get("category") == "agreement":
        return f"agreement:{error.get('sub') or 'other'}"
    return error["category"]


def next_help_stage(current: int, recent_rates: list[float]) -> int:
    if len(recent_rates) >= 3 and all(r >= 0.7 for r in recent_rates[:3]):
        return min(4, current + 1)
    if len(recent_rates) >= 2 and all(r <= 0.3 for r in recent_rates[:2]):
        return max(1, current - 1)
    return current


def argus_order(category_rows: list[dict]) -> list[str]:
    totals = {k: {"draft": 0, "missed": 0} for k in DEFAULT_ARGUS}
    for r in category_rows:
        for bucket, keys in PASS_BUCKETS.items():
            if r["category"] in keys:
                totals[bucket]["draft"] += r["errors_in_draft"]
                totals[bucket]["missed"] += r["missed"]
    def ratio(b):
        t = totals[b]
        return t["missed"] / t["draft"] if t["draft"] >= 5 else -1.0
    return sorted(DEFAULT_ARGUS, key=lambda b: -ratio(b))


def apply_session_to_stats(conn: sqlite3.Connection, profile_id: int, result: dict, day: str, now: str) -> None:
    for key, c in result.get("byCategory", {}).items():
        vals = (c.get("opportunities", 0), c.get("draft", 0), c.get("caught", 0), c.get("missed", 0))
        conn.execute("""INSERT INTO profile_stat(profile_id, category, occurrences, errors_in_draft, caught, missed, updated_at)
                        VALUES (?,?,?,?,?,?,?)
                        ON CONFLICT(profile_id, category) DO UPDATE SET
                          occurrences = occurrences + excluded.occurrences,
                          errors_in_draft = errors_in_draft + excluded.errors_in_draft,
                          caught = caught + excluded.caught, missed = missed + excluded.missed,
                          updated_at = excluded.updated_at""", (profile_id, key, *vals, now))
        conn.execute("""INSERT INTO profile_stat_day(profile_id, day, category, occurrences, errors_in_draft, caught, missed)
                        VALUES (?,?,?,?,?,?,?)
                        ON CONFLICT(profile_id, day, category) DO UPDATE SET
                          occurrences = occurrences + excluded.occurrences,
                          errors_in_draft = errors_in_draft + excluded.errors_in_draft,
                          caught = caught + excluded.caught, missed = missed + excluded.missed""",
                     (profile_id, day, key, *vals))


def update_trap_words(conn: sqlite3.Connection, profile_id: int, result: dict, reference_body: str, now: str) -> None:
    errors = result.get("draftErrors", []) + result.get("finalErrors", [])
    missed_words = {e["expected"].lower() for e in errors
                    if e.get("category") in TRAP_CATEGORIES and e.get("expected") and WORD_RE.fullmatch(e["expected"])}
    for w in missed_words:
        conn.execute("""INSERT INTO trap_word(profile_id, word, box, last_seen, misses) VALUES (?,?,1,?,1)
                        ON CONFLICT(profile_id, word) DO UPDATE SET misses = misses + 1, box = 1, last_seen = excluded.last_seen""",
                     (profile_id, w, now))
    present = set(words(reference_body)) - missed_words
    for r in conn.execute("SELECT word, box FROM trap_word WHERE profile_id = ?", (profile_id,)).fetchall():
        if r["word"] in present:
            conn.execute("UPDATE trap_word SET box = ?, last_seen = ? WHERE profile_id = ? AND word = ?",
                         (min(5, r["box"] + 1), now, profile_id, r["word"]))
```

- [ ] **Step 4: Run the logic tests**

Run: `scripts/pytest.sh tests/test_stats_logic.py -v`  Expected: 4 passed.

- [ ] **Step 5: Failing API tests**

`server/tests/test_sessions.py`:
```python
FEES = "Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent."


def setup(client):
    p = client.post("/api/profiles", json={"name": "Léa", "avatar": "chouette", "level": "10H"}).json()
    t = client.post("/api/texts", json={"title": "Fées", "body": FEES, "level": "8H", "source": "custom"}).json()
    return p, t


def result(catch_rate, caught=1, missed=1, lexical_expected=None):
    errs = [{"refIndex": 2, "typedIndex": 2, "expected": "dansent", "typed": "danse", "category": "agreement", "sub": "verb"},
            {"refIndex": 7, "typedIndex": 7, "expected": "chantent", "typed": "chante", "category": "agreement", "sub": "verb"}]
    if lexical_expected:
        errs.append({"refIndex": 5, "typedIndex": 5, "expected": lexical_expected, "typed": "clairiere", "category": "accent"})
    return {"version": 1,
            "byCategory": {"agreement:verb": {"opportunities": 3, "draft": 2, "caught": caught, "missed": missed, "introduced": 0},
                           "accent": {"opportunities": 2, "draft": 1 if lexical_expected else 0, "caught": 0, "missed": 1 if lexical_expected else 0, "introduced": 0}},
            "draftErrors": errs, "finalErrors": errs[1:], "caught": errs[:1], "missed": errs[1:], "introduced": [],
            "correctWords": 11, "totalWords": 13, "catchRate": catch_rate, "score": 100}


def post_session(client, p, t, catch_rate, help_stage=None, **kw):
    body = {"profile_id": p["id"], "text_id": t["id"], "pace_level": 2,
            "help_stage": help_stage or client.get(f"/api/profiles/{p['id']}").json()["help_stage"],
            "started_at": "2026-09-23T10:00:00+00:00", "draft": "x", "final": "y",
            "result": result(catch_rate, **kw), "score": 100, "catch_rate": catch_rate}
    r = client.post("/api/sessions", json=body)
    assert r.status_code == 201, r.text
    return r.json()


def test_session_updates_stats_history_and_trap_words(client):
    p, t = setup(client)
    post_session(client, p, t, 0.5, lexical_expected="clairière")
    stats = client.get(f"/api/profiles/{p['id']}/stats").json()
    verb = next(c for c in stats["categories"] if c["category"] == "agreement:verb")
    assert verb == {"category": "agreement:verb", "occurrences": 3, "errors_in_draft": 2, "caught": 1, "missed": 1, "catch_rate": 0.5}
    assert stats["totals"] == {"sessions": 1, "score": 100, "caught": 1}
    assert stats["recent_sessions"][0]["title"] == "Fées"
    assert stats["trap_words"] == [{"word": "clairière", "box": 1, "misses": 1, "last_seen": stats["trap_words"][0]["last_seen"]}]
    assert client.get(f"/api/profiles/{p['id']}/trap-words").json()[0]["word"] == "clairière"
    listed = client.get(f"/api/texts?profile_id={p['id']}").json()[0]
    assert listed["history"] == {"times_played": 1, "best_score": 100, "best_catch_rate": 0.5}
    # a later session where the trap word is present and correct promotes it
    post_session(client, p, t, 0.5)
    assert client.get(f"/api/profiles/{p['id']}/trap-words").json()[0]["box"] == 2


def test_help_stage_adapts(client):
    p, t = setup(client)
    assert post_session(client, p, t, 0.8)["help_stage_after"] == 1
    assert post_session(client, p, t, 0.9)["help_stage_after"] == 1
    r = post_session(client, p, t, 0.7)
    assert (r["help_stage_before"], r["help_stage_after"]) == (1, 2)
    assert "Muses" in r["help_stage_message"]
    assert client.get(f"/api/profiles/{p['id']}").json()["help_stage"] == 2
    # sessions at the previous stage do not count toward the next change
    r = post_session(client, p, t, 0.1)
    assert r["help_stage_after"] == 2
    r = post_session(client, p, t, 0.2)
    assert (r["help_stage_before"], r["help_stage_after"]) == (2, 1)
    assert "Argus" in r["help_stage_message"]


def test_null_catch_rate_is_ignored_for_adaptation(client):
    p, t = setup(client)
    post_session(client, p, t, 0.8); post_session(client, p, t, 0.8)
    assert post_session(client, p, t, None)["help_stage_after"] == 1
    assert post_session(client, p, t, 0.8)["help_stage_after"] == 2


def test_session_404s(client):
    p, t = setup(client)
    body = {"profile_id": 999, "text_id": t["id"], "pace_level": 1, "help_stage": 1, "started_at": "x",
            "draft": "", "final": "", "result": {"version": 1}, "score": 0, "catch_rate": None}
    assert client.post("/api/sessions", json=body).status_code == 404
```

- [ ] **Step 6: Run to verify failure, then implement the routers**

Run: `scripts/pytest.sh tests/test_sessions.py -v`  Expected: 404s.

Append to `schemas.py`:
```python
class SessionCreate(BaseModel):
    profile_id: int
    text_id: int
    pace_level: int = Field(ge=1, le=4)
    help_stage: int = Field(ge=1, le=4)
    started_at: str
    draft: str
    final: str
    result: dict[str, Any]
    score: int = Field(ge=0)
    catch_rate: float | None = Field(default=None, ge=0, le=1)
```
`server/app/routers/sessions.py`: `POST /api/sessions`:
1. `fetch_profile` (404) and `SELECT id, body FROM text` (404).
2. `now = utc iso`, `day = now[:10]`; insert the session row (`finished_at = now`, `result_json = json.dumps(body.result)`).
3. `apply_session_to_stats(db, profile_id, body.result, day, now)`; `update_trap_words(db, profile_id, body.result, text_body, now)`.
4. `rates = [r["catch_rate"] for r in db.execute("SELECT catch_rate FROM session WHERE profile_id = ? AND help_stage = ? AND catch_rate IS NOT NULL ORDER BY finished_at DESC, id DESC LIMIT 3", (profile_id, profile.help_stage))]`; `after = next_help_stage(profile.help_stage, rates)`; if changed, `UPDATE profile SET help_stage = ?`.
5. Return `{id, help_stage_before, help_stage_after, help_stage_message}`.

`server/app/routers/stats.py`: `GET /api/profiles/{id}/stats` and `GET /api/profiles/{id}/trap-words` as specified (`catch_rate = caught / errors_in_draft` if `errors_in_draft > 0` else `None`; `recent_sessions` joins `text.title`). Register both routers in `main.py`.

- [ ] **Step 7: Run the whole server suite, then check.sh**

Run: `scripts/pytest.sh -v` → all pass. Run: `scripts/check.sh` → `== ALL GREEN`.

- [ ] **Step 8: Commit**

```bash
git add server
git commit -m "Add sessions, stats, adaptive help stage and trap words API

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Seed content — about thirty public-domain passages

This task needs web access (WebFetch/WebSearch). **Fetch the real text from fr.wikisource.org or gutenberg.org; do not reconstruct classic passages from memory.** Memory-written "Daudet" is not Daudet. Only the six original myth passages are written by the implementer, in careful French.

**Files:**
- Create: `content/seed/001-….json` … `content/seed/0NN-….json` (the passage table in Step 2 is authoritative: 35 entries, #30–35 originals, plus one more original per dropped Bérard passage; treat "30–34 files" and the per-level spread below as indicative only — floor is ≥ 30 files after any drops, and T9/T13 only require ≥ 25 seed texts; schema from Task 4)
- Create: `server/app/tools/__init__.py`, `server/app/tools/seed_check.py`
- Create: `content/seed/README.md` (sources, one line per file, plus the public-domain rule)

**Interfaces:**
- Consumes: seed file schema (Task 4), `test_seed_files.py` (validates every file: name `NNN-slug`, 80–200 words, no digits, deaths < 1956, unique titles).
- Produces: the shipped library. Titles are shown to the player as-is, so they are French and short (≤ 60 chars), e.g. `"La chèvre de monsieur Seguin — la montagne"`.

- [ ] **Step 1: Verify the public-domain data for every author and translator**

For each name below, fetch the French Wikipedia page and record the death year in the JSON. **Author and translator must both have died before 1956** (spec §3.2: Swiss law, life + 70 years); if a death year cannot be confirmed, drop that passage. Expected years (verify, do not trust): Alphonse Daudet 1897; Guy de Maupassant 1893; Jules Verne 1905; Alexandre Dumas 1870; Jules Renard 1910; Victor Hugo 1885; George Sand 1876; Rodolphe Töpffer 1846; Charles-Ferdinand Ramuz 1947; Charles Perrault 1703; Victor Bérard (translator of Homer) 1931; Louis Fabulet 1933 and Robert d'Humières 1915 (Kipling); André Laurie = Paschal Grousset 1909 (Stevenson); Henri Bué (Carroll) 1929; Frédéric Baudry 1885 (Grimm); David Soldi 1884 (Andersen). Homer, Grimm, Andersen, Kipling, Stevenson, Carroll as original authors are all long dead (Kipling 1936, Stevenson 1894, Carroll 1898, Andersen 1875, Wilhelm Grimm 1859).

- [ ] **Step 2: Fetch and cut the passages**

Target list (level in brackets; adjust ±1 level if the fetched passage is clearly easier/harder; aim for a spread across levels — indicative only, the table's per-passage levels win over any target total):

| # | Author / translator | Work | Passage hint | Level |
|---|---|---|---|---|
| 1 | Perrault | Le Petit Chaperon rouge | the walk through the wood | 5H |
| 2 | Andersen, trad. Soldi | Le Vilain Petit Canard | the hatching, the ugly one | 5H |
| 3 | Andersen, trad. Soldi | La Petite Sirène | the palace under the sea | 6H |
| 4 | Perrault | Le Chat botté | the cat's plan | 6H |
| 5 | Grimm, trad. Baudry | Les Musiciens de Brême | the animals meet | 6H |
| 6 | Carroll, trad. Bué | Alice au pays des merveilles | falling down the hole | 7H |
| 7 | Renard | Histoires naturelles | a short animal portrait (narrative, not list) | 7H |
| 8 | Daudet | La chèvre de M. Seguin | Blanquette in the mountain | 7H |
| 9 | Daudet | La chèvre de M. Seguin | the night and the wolf | 8H |
| 10 | Daudet | Les Étoiles (Lettres de mon moulin) | the shepherd's night | 8H |
| 11 | Kipling, trad. Fabulet & d'Humières | Le Livre de la jungle | Mowgli and the wolves | 8H |
| 12 | Kipling, trad. Fabulet & d'Humières | Le Livre de la jungle | Rikki-Tikki-Tavi's garden | 8H |
| 13 | Renard | Poil de Carotte | a narrative scene | 8H |
| 14 | Stevenson, trad. Laurie | L'Île au trésor | the old sailor at the inn | 9H |
| 15 | Verne | Vingt mille lieues sous les mers | under the sea | 9H |
| 16 | Verne | Le Tour du monde en quatre-vingts jours | Fogg's habits | 9H |
| 17 | Maupassant | Le Papa de Simon | Simon at the river | 9H |
| 18 | Sand | La Petite Fadette | the twins | 9H |
| 19 | Homère, trad. Bérard | L'Odyssée | Polyphème's cave | 9H |
| 20 | Homère, trad. Bérard | L'Odyssée | Nausicaa and the washing | 10H |
| 21 | Homère, trad. Bérard | L'Odyssée | Circé's island | 10H |
| 22 | Verne | Voyage au centre de la Terre | the descent | 10H |
| 23 | Dumas | Les Trois Mousquetaires | d'Artagnan's arrival | 10H |
| 24 | Hugo | Les Misérables | Cosette and the doll | 10H |
| 25 | Sand | La Mare au diable | the ploughing scene | 10H |
| 26 | Maupassant | La Parure | the ball, the lost necklace | 11H |
| 27 | Hugo | Notre-Dame de Paris | the cathedral, a descriptive paragraph | 11H |
| 28 | Töpffer | Nouvelles genevoises | an alpine walk | 11H |
| 29 | Ramuz | Derborence or Aline | a narrative paragraph (no dialect) | 11H |
| 30–35 (+36, 37, … if Bérard passages are dropped) | Les Muses de la Discorde (original) | Textes originaux | see Step 3 | 5H–10H |

Rules for cutting:
- 80–200 words, cut at sentence boundaries, verbatim otherwise. Do not modernise spelling, but avoid passages with pre-1835 spelling (`étoit`, `enfans`), heavy dialogue, verse, or many proper nouns. If a Perrault text on Wikisource is in old spelling, take a modernised edition on Wikisource or drop it.
- Prefer passages **rich in agreement chains**: plural subjects far from their verb, feminine plural adjectives, past participles with être, relative *qui*. Mix present, imparfait and passé simple across the set.
- Numbers must be written as words; if a passage contains a digit, either spell it out (`quatre-vingts`) or choose another cut.
- Use typographic apostrophes as in the source or straight ones; the client normalises both. Use `«` `»` for quotes when the source does. Paragraphs are separated by `\n\n`.
- `source_url` = the exact Wikisource/Gutenberg page. `license_note` = `"Domaine public : auteur mort en 1897."` or `"Domaine public : auteur mort en 1936, traducteurs morts en 1933 et 1915."`
- For Bérard's Odyssey: search fr.wikisource.org for "Odyssée Bérard"; if his translation is not available online, **do not** fall back to Leconte de Lisle's (his Hellenised proper names — "Akhilleus" and the like — are unsuitable for this game). Instead, drop the affected Odyssey passage(s) (#19–21) and write one additional original myth passage per dropped passage (same style and rules as Step 3, at a comparable level) to keep the file count at or above the floor in Step 3; say so in `content/seed/README.md`.

- [ ] **Step 3: Write the original myth passages (French, careful, proofread twice)**

Six originals, one each at 5H, 6H, 7H, 8H, 9H, 10H, 90–150 words, narrative, plenty of plural subjects and feminine agreements, no dialogue longer than one line, no digits. Subjects: (30) *La pomme d'or* — Éris throws the golden apple at the wedding of Thétis and Pélée (5H); (31) *Le dragon des Muses* — how the Muses entrust a dragon egg to young heroes (6H); (32) *Argus aux cent yeux* — the guardian whose eyes never all sleep (7H); (33) *Le fil d'Ariane* — Thésée in the labyrinth (8H); (34) *Le bouclier de Persée* — the polished shield and Méduse (9H); (35) *La chouette d'Athéna* — the owl that sees in the dark (10H). If Step 2 dropped any Bérard/Odyssey passage (#19–21), write one further original myth passage per drop (numbered #36, #37, … in the same style, at 9H or 10H to replace the level(s) lost) instead of substituting Leconte de Lisle. The style is warm and vivid, never scholarly. Example for #30 (use it as written, then proofread it once more):

> Au mariage de Thétis et de Pélée, tous les dieux étaient invités, sauf une : Éris, la déesse de la Discorde. Furieuse, elle s'approcha sans bruit de la grande table. Les invités riaient, les coupes brillaient, les musiciennes jouaient des airs joyeux. Alors Éris lança une pomme d'or au milieu des plats. Sur la pomme, quelques mots étaient gravés : « À la plus belle. » Aussitôt, trois déesses tendirent la main. Héra, Athéna et Aphrodite se regardèrent, les yeux pleins de colère. Les rires cessèrent, les musiciennes s'arrêtèrent, et les dieux, embarrassés, baissèrent la tête. Éris, cachée derrière une colonne, souriait. Sa pomme avait réussi : la dispute était semée, et elle ne s'arrêterait plus.

- [ ] **Step 4: Write `seed_check.py` and run it**

`server/app/tools/seed_check.py` loads every `content/seed/*.json`, annotates it with the model from `SPACY_MODEL`, and prints one line per file: `key | level | words | verbs | participles | nominal | homophones | sentences`, then totals per level. Run: `scripts/py.sh python -m app.tools.seed_check`. Use it to check that every passage has at least 8 `verb` tokens and 15 `nominal_group` tokens; replace passages that do not.

- [ ] **Step 5: Validate**

Run: `scripts/pytest.sh tests/test_seed_files.py -v` → one PASS per file. Run: `scripts/check.sh` → `== ALL GREEN` (the e2e image now contains the seed; the smoke test still passes).

- [ ] **Step 6: Commit**

```bash
git add content/seed server/app/tools
git commit -m "Add seed passages with credits and levels

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Grading engine (pure TypeScript) with thorough unit tests

This is the heart of the game (spec §3.5). Pure functions, no DOM, no Svelte. Every rule below has a test; write the tests first, file by file, and keep them green as you go. The Python server relies on the `SessionResult` shape from Task 5 — do not rename its fields.

**Files:**
- Create: `web/src/lib/grading/types.ts`, `normalize.ts`, `tokenize.ts`, `align.ts`, `homophones.ts`, `classify.ts`, `annotationMap.ts`, `grade.ts`, `index.ts`
- Test: `web/src/lib/grading/normalize.test.ts`, `tokenize.test.ts`, `align.test.ts`, `classify.test.ts`, `annotationMap.test.ts`, `grade.test.ts`

**Interfaces:**
- Consumes: `content/homophones.json` via `import table from '@content/homophones.json'` (shape from Task 3); annotation JSON shape from Task 3.
- Produces (`types.ts`, all exported):
  ```ts
  export type Category = 'homophone' | 'agreement' | 'accent' | 'punctuation_case' | 'lexical';
  export type AgreementSub = 'number' | 'gender' | 'verb' | 'participle';
  export type ErrorSub = AgreementSub | 'verb_ending' | 'missing' | 'extra';
  export interface Token { text: string; norm: string; caseNorm: string; start: number; end: number; kind: 'word' | 'punct' }
  export interface AlignedPair { refIndex: number | null; typedIndex: number | null }
  export interface TokenError {
    refIndex: number | null; typedIndex: number | null;
    expected: string | null; typed: string | null;
    category: Category; sub?: ErrorSub; homophoneSet?: string;
    anchor: number; // refIndex of the nearest preceding aligned reference token (-1 at start); used to key extra words
  }
  export interface AnnotToken { i: number; text: string; start: number; end: number; lemma: string; pos: string;
    morph: Record<string, string>; head: number; dep: string; categories: string[]; homophone: string | null; subject: number | null }
  export interface Annotation { version: number; model: string; tokens: AnnotToken[]; sentences: { start: number; end: number }[] }
  export interface GradeResult { refTokens: Token[]; typedTokens: Token[]; pairs: AlignedPair[]; errors: TokenError[]; correctWords: number; totalWords: number }
  export type StatKey = 'agreement:verb' | 'agreement:participle' | 'agreement:number' | 'agreement:gender' | 'agreement:other' | 'homophone' | 'accent' | 'punctuation_case' | 'lexical';
  // Single source of truth for ArgusPass too (Task 11's argus.ts and Task 9's types.ts import/re-export this — do not redeclare it).
  export type ArgusPass = 'verbes' | 'groupes_nominaux' | 'homophones' | 'mots_pieges';
  export interface CategoryStat { opportunities: number; draft: number; caught: number; missed: number; introduced: number }
  export interface SessionResult { version: 1; byCategory: Partial<Record<StatKey, CategoryStat>>; draftErrors: TokenError[]; finalErrors: TokenError[];
    caught: TokenError[]; missed: TokenError[]; introduced: TokenError[]; correctWords: number; totalWords: number; catchRate: number | null; score: number }
  ```
- Produces (functions):
  - `normalize.ts`: `normalizeWord(s): string` (lower-case, `’`/`ʼ`/`‘` → `'`, `“”„` → `"`, `œ`→`oe`, `æ`→`ae`, NBSP → space, trim), `caseNormalizeWord(s)` (same without lower-casing), `stripDiacritics(s)` (NFD, remove `\p{M}`, `ç`→`c` is implied by NFD+strip).
  - `tokenize.ts`: `tokenize(text): Token[]` — words = `/[\p{L}\p{N}]+(?:['’ʼ-][\p{L}\p{N}]+)*/gu` (elided clitics stay attached: `l'enfant`, `c'est`, `aujourd'hui`, `peut-être`, `dit-il` are one token each); every other non-space character is a `punct` token, except that runs of `.` (`...`) form one token and `…` is one token. Whitespace (incl. NBSP) produces no token.
  - `homophones.ts`: `homophoneSetOf(norm: string): string | undefined`, `homophoneHint(setId): string`, `HOMOPHONE_SETS`.
  - `align.ts`: `alignTokens(ref: Token[], typed: Token[]): AlignedPair[]` — Needleman–Wunsch; costs: equal norm & kind 0; word↔word substitution 0.6 if `similar` else 1.2; punct↔punct substitution 0.5; word↔punct 3; gap 1. `similar(a, b)` = same homophone set, or `1 - levenshtein(a.norm, b.norm) / max(len) >= 0.5`. Traceback ties: diagonal first, then "missing" (ref unpaired), then "extra".
  - `classify.ts`: `classifyPair(ref: Token | null, typed: Token | null, annot: AnnotToken | undefined, anchor: number): TokenError | null` and helpers `isVerbEndingHomophone(r, t)`, `isAgreement(r, t)`, `agreementSub(r, t, annot)`.
  - `annotationMap.ts`: `mapAnnotation(refTokens: Token[], annotation: Annotation | null): (AnnotToken | undefined)[]` (largest span overlap wins; ties → first), `refCategories(annot: AnnotToken | undefined): string[]`.
  - `grade.ts`: `gradeText(reference, typed, annotation): GradeResult`, `errorKey(e: TokenError): string` (`r<refIndex>` or `x<anchor>:<typed norm>`), `gradeSession(reference, draft, final, annotation, { paceLevel }): SessionResult`, `computeScore(correctWords, caughtCount, catchRate, paceLevel): number`, `statKey(e: TokenError): StatKey` (`agreement:${sub ?? 'other'}` or the category; the one implementation — Task 12's `explain.ts` imports and re-exports this as `statKeyOf` rather than recomputing it).
  - `index.ts` re-exports everything.

**Classification rules (exact, applied in this order to a word↔word pair with `r = ref.norm`, `t = typed.norm`):**
0. `r === t`: if `ref.caseNorm === typed.caseNorm` → correct (return null), else `punctuation_case` (case only).
1. `homophone`: `homophoneSetOf(r)` defined and equals `homophoneSetOf(t)` → `{category: 'homophone', homophoneSet}`. Else `isVerbEndingHomophone(r, t)` → `{category: 'homophone', sub: 'verb_ending'}` where: ending classes `INF = ['er']`, `IMP = ['ez']`, `PP = ['é', 'ée', 'és', 'ées']`, `PAST = ['ai', 'ais', 'ait', 'aient']`; true when there exist endings `a` (of `r`) and `b` (of `t`) from these classes such that `r.slice(0, -a.length) === t.slice(0, -b.length)`, that common stem has length ≥ 2, and `class(a) !== class(b)`. (`mangé/manger` → stem `mang`, PP vs INF; `manger/mangez` → stem `mang`, INF vs IMP; `chantait/chanté` → stem `chant`, PAST vs PP; `mangés/mangé` → same class → false.)
2. `agreement`: `GENDER_PAIRS` (`le/la, un/une, ce/cette, cet/cette, mon/ma, ton/ta, son/sa, ceux/celles, celui/celle, tout/toute, tous/toutes, nouveau/nouvelle, beau/belle, vieux/vieille`) → `sub: 'gender'`. Else `isAgreement(r, t)`: there exist `a ≠ b` in `ENDINGS = ['', 's', 'x', 'e', 'es', 'nt', 'ent', 'é', 'ée', 'és', 'ées', 'ai', 'ais', 'ait', 'aient', 'a', 'as', 'ons', 'ez', 'er']` with `r` ending in `a`, `t` ending in `b`, equal stems after removing them, and stem length ≥ 1. (`dansent/danse` → stem `danse` via `nt`/``; `chantais/chantait` → stem `chant`; `a/as` → stem `a`; `chevaux/chevals` → no pair → lexical, a known limitation.) Sub from annotation: `pos ∈ {VERB, AUX}` → `morph.VerbForm === 'Part' ? 'participle' : 'verb'`; `pos ∈ {DET, NOUN, ADJ, PRON}` → remove one trailing `s` or `x` from each whole word, equal → `'number'` else `'gender'`; no annotation or other POS → `sub` undefined.
3. `accent`: `stripDiacritics(r) === stripDiacritics(t)`.
4. `punctuation_case`: handled in rule 0 for words; for punct↔punct pairs with different norm; for unpaired punct tokens (missing or extra punctuation).
5. `lexical`: everything else; unpaired words → `sub: 'missing'` (typed null) or `'extra'` (ref null); a word↔punct pair (should not occur) → lexical.

**Score (decision 9):** `computeScore = Math.round((2 * correctWords + 20 * caught + bonus) * [1, 1.25, 1.5, 2][paceLevel - 1])`, `bonus = catchRate === null ? 50 : Math.round(100 * catchRate)`.

**Opportunities per stat key** (from the mapped annotation over reference tokens): `agreement:verb` = tokens with category `verb`; `agreement:participle` = `participle`; `agreement:number` and `agreement:gender` = `nominal_group` (each); `agreement:other` = 0; `homophone` = `homophone`; `accent` = word tokens whose `norm !== stripDiacritics(norm)`; `punctuation_case` = punct tokens + words whose first character is upper-case; `lexical` = all word tokens.

- [ ] **Step 1: `normalize.test.ts` and `normalize.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { normalizeWord, caseNormalizeWord, stripDiacritics } from './normalize';

describe('normalizeWord', () => {
  it('lower-cases and unifies apostrophes and quotes', () => {
    expect(normalizeWord('C’est')).toBe("c'est");
    expect(normalizeWord('Cʼest')).toBe("c'est");
    expect(normalizeWord('“')).toBe('"');
    expect(normalizeWord('”')).toBe('"');
  });
  it('unifies ligatures', () => {
    expect(normalizeWord('cœur')).toBe('coeur');
    expect(normalizeWord('Œuvre')).toBe('oeuvre');
    expect(normalizeWord('ex æquo')).toBe('ex aequo');
  });
  it('turns non-breaking spaces into spaces and trims', () => {
    expect(normalizeWord(' mot ')).toBe('mot');
  });
  it('keeps accents (accents are graded separately)', () => {
    expect(normalizeWord('élève')).toBe('élève');
  });
});

describe('caseNormalizeWord', () => {
  it('keeps case but unifies the rest', () => {
    expect(caseNormalizeWord('Cœur’s')).toBe("Coeur's");
  });
});

describe('stripDiacritics', () => {
  it('removes accents and cedilla', () => {
    expect(stripDiacritics('élève')).toBe('eleve');
    expect(stripDiacritics('garçon')).toBe('garcon');
    expect(stripDiacritics('où')).toBe('ou');
    expect(stripDiacritics('a')).toBe('a');
  });
});
```
Implementation:
```ts
const APOSTROPHES = /[’ʼ‘′]/g;
const DQUOTES = /[“”„″]/g;
const NBSP = /[\u00A0\u202F\u2007]/g; // no-break, narrow no-break, figure space — written as escapes, not literal invisible characters

export function caseNormalizeWord(s: string): string {
  return s.replace(APOSTROPHES, "'").replace(DQUOTES, '"').replace(NBSP, ' ')
    .replace(/œ/g, 'oe').replace(/Œ/g, 'Oe').replace(/æ/g, 'ae').replace(/Æ/g, 'Ae').trim();
}
export function normalizeWord(s: string): string { return caseNormalizeWord(s).toLowerCase(); }
export function stripDiacritics(s: string): string { return s.normalize('NFD').replace(/\p{M}/gu, ''); }
```
Run: `scripts/npm.sh run test -- normalize` → fails, then passes after implementation.

- [ ] **Step 2: `tokenize.test.ts` and `tokenize.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { tokenize } from './tokenize';

const texts = (s: string) => tokenize(s).map((t) => t.text);
const kinds = (s: string) => tokenize(s).map((t) => t.kind);

describe('tokenize', () => {
  it('splits words and punctuation', () => {
    expect(texts("L'enfant a dit : « Bonjour ! »")).toEqual(["L'enfant", 'a', 'dit', ':', '«', 'Bonjour', '!', '»']);
    expect(kinds('Oui, non.')).toEqual(['word', 'punct', 'word', 'punct']);
  });
  it('keeps elisions, hyphens and typographic apostrophes inside words', () => {
    expect(texts("aujourd’hui peut-être dit-il c'est")).toEqual(['aujourd’hui', 'peut-être', 'dit-il', "c'est"]);
  });
  it('groups ellipses and treats dashes as punctuation', () => {
    expect(texts('Bon... enfin… — oui')).toEqual(['Bon', '...', 'enfin', '…', '—', 'oui']);
  });
  it('records exact offsets and normalised forms', () => {
    const t = tokenize('Les fées dansent.');
    expect(t[1]).toMatchObject({ text: 'fées', norm: 'fées', start: 4, end: 8, kind: 'word' });
    expect(t[3]).toMatchObject({ text: '.', start: 16, end: 17, kind: 'punct' });
    expect(tokenize('Œuf')[0].norm).toBe('oeuf');
  });
  it('ignores whitespace and returns nothing for blank input', () => {
    expect(tokenize('  \n\t ')).toEqual([]);
  });
});
```
Implementation: a single regex `/[\p{L}\p{N}]+(?:['’ʼ-][\p{L}\p{N}]+)*|\.{2,}|…|[^\s\p{L}\p{N}]/gu`, `kind = /^[\p{L}\p{N}]/u.test(text) ? 'word' : 'punct'`, `norm = normalizeWord(text)`, `caseNorm = caseNormalizeWord(text)`.

- [ ] **Step 3: `homophones.ts` (thin loader) and `align.test.ts` / `align.ts`**

`homophones.ts`:
```ts
import table from '@content/homophones.json';
export interface HomophoneSet { id: string; words: string[]; hint: string }
export const HOMOPHONE_SETS: HomophoneSet[] = (table as { sets: HomophoneSet[] }).sets;
const index = new Map<string, string>();
for (const s of HOMOPHONE_SETS) for (const w of s.words) index.set(w, s.id);
export function homophoneSetOf(norm: string): string | undefined { return index.get(norm); }
export function homophoneHint(setId: string): string { return HOMOPHONE_SETS.find((s) => s.id === setId)?.hint ?? ''; }
```
(Add `declare module '*.json'` in `vite-env.d.ts` only if svelte-check complains; `resolveJsonModule` is on.)

`align.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { tokenize } from './tokenize';
import { alignTokens } from './align';

const pairs = (ref: string, typed: string) =>
  alignTokens(tokenize(ref), tokenize(typed)).map((p) => [p.refIndex, p.typedIndex]);

describe('alignTokens', () => {
  it('aligns identical texts one to one', () => {
    expect(pairs('Les chats dorment.', 'Les chats dorment.')).toEqual([[0, 0], [1, 1], [2, 2], [3, 3]]);
  });
  it('pairs a misspelled word with its reference', () => {
    expect(pairs('les chats dorment', 'les chat dorment')).toEqual([[0, 0], [1, 1], [2, 2]]);
  });
  it('detects a missing word', () => {
    expect(pairs('le chat noir dort', 'le chat dort')).toEqual([[0, 0], [1, 1], [2, null], [3, 2]]);
  });
  it('detects an extra word', () => {
    expect(pairs('le chat dort', 'le petit chat dort')).toEqual([[0, 0], [null, 1], [1, 1], [2, 2]]);
  });
  it('never pairs a word with punctuation', () => {
    expect(pairs('Bonjour, Marie', 'Bonjour Marie')).toEqual([[0, 0], [1, null], [2, 1]]);
    expect(pairs('Il dort.', 'Il dort !')).toEqual([[0, 0], [1, 1], [2, 2]]);
  });
  it('prefers substituting a similar word over a gap pair', () => {
    expect(pairs('les fées dansent', 'les fée danse')).toEqual([[0, 0], [1, 1], [2, 2]]);
  });
  it('pairs homophones even when they look different', () => {
    expect(pairs("il s'est levé", 'il ses levé')).toEqual([[0, 0], [1, 1], [2, 2]]);
  });
  it('handles an empty typed text', () => {
    expect(pairs('a b', '')).toEqual([[0, null], [1, null]]);
  });
});
```
Implementation notes: build `(n+1)×(m+1)` cost matrix with the costs from the Interfaces block; traceback from `(n, m)` choosing, on equal cost, diagonal, then up (ref unpaired), then left (typed unpaired). Include a small `levenshtein(a, b)` in `align.ts` (export it; `classify.ts` does not need it).

- [ ] **Step 4: `classify.test.ts` and `classify.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { tokenize } from './tokenize';
import { classifyPair, isAgreement, isVerbEndingHomophone } from './classify';
import type { AnnotToken } from './types';

const tok = (s: string) => tokenize(s)[0];
const annot = (pos: string, morph: Record<string, string> = {}): AnnotToken =>
  ({ i: 0, text: '', start: 0, end: 0, lemma: '', pos, morph, head: 0, dep: '', categories: [], homophone: null, subject: null });
const cls = (ref: string, typed: string, a?: AnnotToken) => classifyPair(tok(ref), tok(typed), a, -1);

describe('rule 0: identical and case', () => {
  it('returns null for a correct word', () => expect(cls('chat', 'chat')).toBeNull());
  it('ignores ligature and apostrophe variants', () => {
    expect(cls('cœur', 'coeur')).toBeNull();
    expect(cls('c’est', "c'est")).toBeNull();
  });
  it('flags a case-only difference as punctuation_case', () => {
    expect(cls('Marie', 'marie')).toMatchObject({ category: 'punctuation_case', expected: 'Marie', typed: 'marie' });
  });
});

describe('rule 1: homophones come first', () => {
  it.each([['à', 'a'], ['a', 'à'], ['est', 'et'], ["c'est", 'ses'], ['sont', 'son'], ['où', 'ou'], ["l'a", 'la'], ['peut', 'peu'], ["qu'elle", 'quelle']])(
    '%s vs %s', (r, t) => expect(cls(r, t)).toMatchObject({ category: 'homophone', homophoneSet: expect.any(String) }));
  it('wins over the accent rule (a/à)', () => expect(cls('à', 'a')?.category).toBe('homophone'));
  it('wins over the agreement rule (son/sont, leur/leurs)', () => {
    expect(cls('sont', 'son')?.category).toBe('homophone');
    expect(cls('leurs', 'leur')?.category).toBe('homophone');
  });
  it('detects -é / -er / -ez / -ait confusions as verb_ending homophones', () => {
    expect(cls('mangé', 'manger')).toMatchObject({ category: 'homophone', sub: 'verb_ending' });
    expect(cls('manger', 'mangez')).toMatchObject({ category: 'homophone', sub: 'verb_ending' });
    expect(cls('chantait', 'chanté')).toMatchObject({ category: 'homophone', sub: 'verb_ending' });
    expect(isVerbEndingHomophone('mangés', 'mangé')).toBe(false); // same class -> agreement
    expect(isVerbEndingHomophone('mer', 'mé')).toBe(false);       // prefix too short
  });
});

describe('rule 2: agreement', () => {
  it('same stem, inflectional ending differs', () => {
    expect(isAgreement('dansent', 'danse')).toBe(true);
    expect(isAgreement('chats', 'chat')).toBe(true);
    expect(isAgreement('jolie', 'joli')).toBe(true);
    expect(isAgreement('mangées', 'mangé')).toBe(true);
    expect(isAgreement('a', 'as')).toBe(true);
    expect(isAgreement('beaux', 'beau')).toBe(true);
    expect(isAgreement('chevaux', 'chevals')).toBe(false); // irregular plural -> lexical (known limitation)
    expect(isAgreement('maison', 'mison')).toBe(false);
    expect(isAgreement('chat', 'chaton')).toBe(false);
  });
  it('subclassifies with the annotation', () => {
    expect(cls('dansent', 'danse', annot('VERB', { VerbForm: 'Fin' }))).toMatchObject({ category: 'agreement', sub: 'verb' });
    expect(cls('chantais', 'chantait', annot('VERB', { VerbForm: 'Fin' }))).toMatchObject({ category: 'agreement', sub: 'verb' });
    expect(cls('mangées', 'mangé', annot('VERB', { VerbForm: 'Part' }))).toMatchObject({ category: 'agreement', sub: 'participle' });
    expect(cls('chats', 'chat', annot('NOUN'))).toMatchObject({ category: 'agreement', sub: 'number' });
    expect(cls('jolies', 'jolis', annot('ADJ'))).toMatchObject({ category: 'agreement', sub: 'gender' });
    expect(cls('jolie', 'joli', annot('ADJ'))).toMatchObject({ category: 'agreement', sub: 'gender' });
    expect(cls('les', 'le', annot('DET'))).toMatchObject({ category: 'agreement', sub: 'number' });
    expect(cls('dansent', 'danse')).toMatchObject({ category: 'agreement' });
    expect(cls('dansent', 'danse')?.sub).toBeUndefined();
  });
  it('knows irregular gender pairs', () => {
    expect(cls('la', 'le', annot('DET'))).toMatchObject({ category: 'agreement', sub: 'gender' });
    expect(cls('belle', 'beau')).toMatchObject({ category: 'agreement', sub: 'gender' });
  });
});

describe('rule 3: accent', () => {
  it('identical after removing diacritics', () => {
    expect(cls('élève', 'eleve')).toMatchObject({ category: 'accent' });
    expect(cls('garçon', 'garcon')).toMatchObject({ category: 'accent' });
    expect(cls('forêt', 'foret')).toMatchObject({ category: 'accent' });
  });
  it('stays conservative when accents and endings both differ', () => {
    expect(cls('élèves', 'eleve')?.category).toBe('lexical'); // stems differ once accents differ: not agreement, not accent
  });
});

describe('rule 4: punctuation', () => {
  it('different punctuation', () => expect(cls('.', '!')).toMatchObject({ category: 'punctuation_case' }));
  it('missing punctuation', () => expect(classifyPair(tok(','), null, undefined, 3)).toMatchObject({ category: 'punctuation_case', typed: null, expected: ',' }));
  it('extra punctuation', () => expect(classifyPair(null, tok(';'), undefined, 3)).toMatchObject({ category: 'punctuation_case', expected: null, typed: ';' }));
});

describe('rule 5: lexical', () => {
  it('everything else', () => expect(cls('maison', 'mison')).toMatchObject({ category: 'lexical' }));
  it('missing word', () => expect(classifyPair(tok('noir'), null, undefined, 1)).toMatchObject({ category: 'lexical', sub: 'missing', anchor: 1 }));
  it('extra word', () => expect(classifyPair(null, tok('petit'), undefined, 0)).toMatchObject({ category: 'lexical', sub: 'extra', anchor: 0 }));
});
```
Note on the "élèves vs eleve" case: no rule matches (`stripDiacritics` gives `eleves` ≠ `eleve`, and the common prefix `"` `l` `è`… stops at the accent) → lexical. That is the intended, conservative behaviour.

Implement `classify.ts` exactly per the rule list. Key helper (used by both `isAgreement` and `isVerbEndingHomophone`):
```ts
/** Returns the common stem when r ends with `a`, t ends with `b`, and the remainders are equal; else null. */
function stemIf(r: string, t: string, a: string, b: string): string | null {
  if (!r.endsWith(a) || !t.endsWith(b)) return null;
  const rs = r.slice(0, r.length - a.length), ts = t.slice(0, t.length - b.length);
  return rs === ts ? rs : null;
}
```
`isAgreement` loops over all ordered pairs `(a, b)` of `ENDINGS` with `a !== b` and returns true on the first `stemIf(r, t, a, b)` with length ≥ 1. `isVerbEndingHomophone` loops over the four classes' endings and returns true on the first stem of length ≥ 2 whose two endings come from different classes.

- [ ] **Step 5: `annotationMap.test.ts` and `annotationMap.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { tokenize } from './tokenize';
import { mapAnnotation } from './annotationMap';
import type { Annotation } from './types';

const a = (i: number, text: string, start: number, pos: string, categories: string[]): Annotation['tokens'][number] =>
  ({ i, text, start, end: start + text.length, lemma: text, pos, morph: {}, head: i, dep: 'dep', categories, homophone: null, subject: null });

describe('mapAnnotation', () => {
  it('maps client tokens to spaCy tokens by span overlap, largest overlap wins', () => {
    const text = "L'enfant dort.";
    const annotation: Annotation = { version: 1, model: 't', sentences: [], tokens: [
      a(0, "L'", 0, 'DET', ['nominal_group']), a(1, 'enfant', 2, 'NOUN', ['nominal_group']),
      a(2, 'dort', 9, 'VERB', ['verb']), a(3, '.', 13, 'PUNCT', [])] };
    const mapped = mapAnnotation(tokenize(text), annotation);
    expect(mapped.map((m) => m?.text)).toEqual(['enfant', 'dort', '.']);
  });
  it('returns undefined entries without annotation or when spans do not overlap', () => {
    expect(mapAnnotation(tokenize('a b'), null)).toEqual([undefined, undefined]);
    const annotation: Annotation = { version: 1, model: 't', sentences: [], tokens: [a(0, 'zzz', 40, 'X', [])] };
    expect(mapAnnotation(tokenize('a b'), annotation)).toEqual([undefined, undefined]);
  });
});
```

- [ ] **Step 6: `grade.test.ts` and `grade.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { gradeText, gradeSession, computeScore, errorKey } from './grade';
import type { Annotation } from './types';

import { tokenize } from './tokenize';
import type { AnnotToken } from './types';

const REF = 'Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.';
// Hand-built annotation: one entry per client token of REF, in order (offsets come from the tokenizer, so
// the client and "spaCy" spans coincide exactly in this test).
// Tokens: Les fées dansent dans la clairière . Elles chantent et les oiseaux les écoutent .
function ann(): Annotation {
  const spec: [string, string[], Record<string, string>?, Partial<AnnotToken>?][] = [
    ['DET', ['nominal_group']], ['NOUN', ['nominal_group']],
    ['VERB', ['verb'], { VerbForm: 'Fin', Number: 'Plur' }, { subject: 1 }],
    ['ADP', ['homophone'], {}, { homophone: 'dans' }], ['DET', ['nominal_group', 'homophone'], {}, { homophone: 'la' }],
    ['NOUN', ['nominal_group']], ['PUNCT', []],
    ['PRON', []], ['VERB', ['verb'], { VerbForm: 'Fin' }, { subject: 7 }], ['CCONJ', ['homophone'], {}, { homophone: 'et' }],
    ['DET', ['nominal_group']], ['NOUN', ['nominal_group']], ['PRON', []], ['VERB', ['verb'], { VerbForm: 'Fin' }, { subject: 11 }], ['PUNCT', []],
  ];
  const tokens: AnnotToken[] = tokenize(REF).map((t, i) => ({
    i, text: t.text, start: t.start, end: t.end, lemma: t.norm, pos: spec[i][0], morph: spec[i][2] ?? {},
    head: i, dep: 'dep', categories: spec[i][1], homophone: null, subject: null, ...(spec[i][3] ?? {}),
  }));
  return { version: 1, model: 'test', tokens, sentences: [] };
}
// Opportunity counts implied by this annotation: verb 3, nominal_group 6, homophone 3,
// words with diacritics 3 (fées, clairière, écoutent), words 13.

describe('gradeText', () => {
  it('finds no errors on a perfect text', () => {
    const g = gradeText(REF, REF, ann());
    expect(g.errors).toEqual([]);
    expect(g.totalWords).toBe(13);
    expect(g.correctWords).toBe(13);
    expect(gradeText("cœur d’or", "coeur d'or", null).errors).toEqual([]);
  });
  it('classifies each wrong token with the reference index', () => {
    const typed = 'Les fée danse dans la clairiere. Elles chantent est les oiseaux les écoute.';
    const g = gradeText(REF, typed, ann());
    expect(g.errors.map((e) => [e.expected, e.typed, e.category, e.sub])).toEqual([
      ['fées', 'fée', 'agreement', 'number'],
      ['dansent', 'danse', 'agreement', 'verb'],
      ['clairière', 'clairiere', 'accent', undefined],
      ['et', 'est', 'homophone', undefined],
      ['écoutent', 'écoute', 'agreement', 'verb'],
    ]);
    expect(g.errors[0].refIndex).toBe(1);
    expect(g.correctWords).toBe(8);
  });
  it('reports missing and extra words with anchors', () => {
    const g = gradeText('le chat noir dort', 'le petit chat dort', null);
    expect(g.errors.map((e) => [e.category, e.sub, e.expected, e.typed, e.anchor])).toEqual([
      ['lexical', 'extra', null, 'petit', 0],
      ['lexical', 'missing', 'noir', null, 1],
    ]);
  });
});

describe('errorKey', () => {
  it('keys reference-anchored errors by refIndex and extra words by anchor and text', () => {
    const g = gradeText('le chat noir dort', 'le petit chat dort', null);
    expect(g.errors.map(errorKey)).toEqual(['x0:petit', 'r2']);
  });
});

describe('computeScore', () => {
  it('follows the formula and pace multiplier', () => {
    expect(computeScore(10, 0, null, 1)).toBe(70);          // 20 + 50 bonus
    expect(computeScore(10, 2, 0.5, 1)).toBe(110);          // 20 + 40 + 50
    expect(computeScore(10, 2, 0.5, 4)).toBe(220);
    expect(computeScore(0, 0, 0, 2)).toBe(0);
  });
});

describe('gradeSession', () => {
  const draft = 'Les fée danse dans la clairiere. Elles chantent est les oiseaux les écoutent.';
  it('splits draft errors into caught, missed and introduced', () => {
    const final = 'Les fées dansent dans la clairiere. Elles chante est les oiseaux les écoutent.';
    const s = gradeSession(REF, draft, final, ann(), { paceLevel: 2 });
    expect(s.draftErrors).toHaveLength(4);
    expect(s.caught.map((e) => e.expected)).toEqual(['fées', 'dansent']);
    expect(s.missed.map((e) => e.expected)).toEqual(['clairière', 'et']);
    expect(s.introduced.map((e) => e.expected)).toEqual(['chantent']);
    expect(s.catchRate).toBeCloseTo(0.5);
    expect(s.finalErrors).toHaveLength(3);
    expect(s.correctWords).toBe(10);
    expect(s.score).toBe(computeScore(10, 2, 0.5, 2));
    expect(s.byCategory['agreement:verb']).toEqual({ opportunities: 3, draft: 1, caught: 1, missed: 0, introduced: 1 });
    expect(s.byCategory['agreement:number']).toEqual({ opportunities: 6, draft: 1, caught: 1, missed: 0, introduced: 0 });
    expect(s.byCategory['homophone']).toEqual({ opportunities: 3, draft: 1, caught: 0, missed: 1, introduced: 0 });
    expect(s.byCategory['accent']).toEqual({ opportunities: 3, draft: 1, caught: 0, missed: 1, introduced: 0 });
    expect(s.byCategory['lexical']?.opportunities).toBe(13);
    expect(s.version).toBe(1);
  });
  it('returns a null catch rate when the draft had no errors', () => {
    const s = gradeSession(REF, REF, REF, ann(), { paceLevel: 1 });
    expect(s.catchRate).toBeNull();
    expect(s.caught).toEqual([]);
    expect(s.score).toBe(computeScore(13, 0, null, 1));
  });
  it('counts a wrong word changed into another wrong word as missed', () => {
    const final = draft.replace('danse ', 'dansant ');
    const s = gradeSession(REF, draft, final, ann(), { paceLevel: 1 });
    expect(s.missed.some((e) => e.expected === 'dansent' && e.typed === 'dansant')).toBe(true);
    expect(s.caught.map((e) => e.expected)).not.toContain('dansent');
  });
});
```
Implementation outline for `grade.ts`:
```ts
export function gradeText(reference: string, typed: string, annotation: Annotation | null): GradeResult {
  const refTokens = tokenize(reference), typedTokens = tokenize(typed);
  const pairs = alignTokens(refTokens, typedTokens);
  const annots = mapAnnotation(refTokens, annotation);
  const errors: TokenError[] = []; let anchor = -1;
  for (const p of pairs) {
    const ref = p.refIndex === null ? null : refTokens[p.refIndex];
    const t = p.typedIndex === null ? null : typedTokens[p.typedIndex];
    const e = classifyPair(ref, t, p.refIndex === null ? undefined : annots[p.refIndex], anchor);
    if (e) { e.refIndex = p.refIndex; e.typedIndex = p.typedIndex; errors.push(e); }
    if (p.refIndex !== null) anchor = p.refIndex;
  }
  const totalWords = refTokens.filter((x) => x.kind === 'word').length;
  const wrongRef = new Set(errors.filter((e) => e.refIndex !== null).map((e) => e.refIndex));
  const correctWords = refTokens.filter((x, i) => x.kind === 'word' && !wrongRef.has(i)).length;
  return { refTokens, typedTokens, pairs, errors, correctWords, totalWords };
}
```
`gradeSession`: grade draft and final; build maps by `errorKey`; `caught` = draft errors whose key is absent from final; `missed` = draft errors whose key is present in final, **copied from the draft error object** with `typed` (and `typedIndex`) overwritten from the matching final error (category/sub stay those of the draft error, so per-key `draft === caught + missed` always holds, even when a wrong word is re-typed into a *different* wrong word); `introduced` = final errors whose key is absent from draft; `catchRate = draftErrors.length ? caught.length / draftErrors.length : null`; `byCategory` from opportunities + counting each list by `statKey(e)` (`agreement:${sub ?? 'other'}` or the category).

- [ ] **Step 7: `index.ts`, full run, svelte-check**

`index.ts` re-exports all modules. Run: `scripts/npm.sh run test` → all grading tests pass. Run: `scripts/npm.sh run check` → 0 errors.

- [ ] **Step 8: Commit**

```bash
git add web/src/lib/grading web/src/vite-env.d.ts
git commit -m "Add grading engine with alignment, classification and catch rate

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Dictation support modules — segmentation, spoken punctuation, TTS wrapper, pace script

Pure TypeScript except `tts.ts`, which wraps `speechSynthesis` and is tested with a fake. Spec §3.3.

**Files:**
- Create: `web/src/lib/dictation/segment.ts`, `spoken.ts`, `tts.ts`, `script.ts`, `index.ts`
- Test: `web/src/lib/dictation/segment.test.ts`, `spoken.test.ts`, `tts.test.ts`, `script.test.ts`

**Interfaces:**
- Consumes: `tokenize()` from `$lib/grading/tokenize`.
- Produces (`segment.ts`):
  - `interface Sentence { text: string; start: number; end: number; newParagraph: boolean }`
  - `splitSentences(text: string): Sentence[]` — a sentence ends at a run of `.`, `!`, `?`, `…` optionally followed by closing `»`, `"`, `”`, `)`, then whitespace or end of text; **no split** when the word before a single `.` is one of `M`, `MM`, `Mme`, `Mlle`, `St`, `Ste`, or when the next non-space character is a lower-case letter (mid-sentence ellipsis). A blank line (`\n\s*\n`) always ends a sentence and marks the next one `newParagraph: true`. `text` is trimmed; `start`/`end` index the original string.
  - `countWords(s: string): number` (tokens of kind `word`).
  - `splitChunks(sentence: string): string[]` — split after a word ending with `,`, `;`, `:`, `—`, `–` or `»`, and before a word starting with `«` or `—`; then merge every chunk with fewer than 3 words into the previous chunk (into the next one if it is the first); then split any chunk with more than 10 words at the whitespace closest to its middle (repeat until all chunks have ≤ 10 words). Never splits inside a word.
- Produces (`spoken.ts`): `spokenForm(chunk: string, opts?: { newParagraph?: boolean }): string` with the punctuation names: `,` virgule · `.` point · `;` point-virgule · `:` deux-points · `?` point d'interrogation · `!` point d'exclamation · `…` / `...` points de suspension · `«` ouvrez les guillemets · `»` fermez les guillemets · `(` ouvrez la parenthèse · `)` fermez la parenthèse · `—` / `–` / lone `-` tiret · `"` guillemet · `'` apostrophe (only when it is a lone punct token; apostrophes inside words are never spoken). Hyphens inside words are not spoken. Algorithm: walk the tokens; words are appended with a space; a punctuation name is appended as `, <name>, `; at the end, a trailing `, ` is removed and a final `.` is added; `newParagraph` prefixes `À la ligne. `.
- Produces (`tts.ts`):
  - `ttsAvailable(): boolean`
  - `waitForVoices(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]>` (resolves immediately when `getVoices()` is non-empty, else on `voiceschanged` or timeout)
  - `listFrenchVoices(voices = speechSynthesis.getVoices()): SpeechSynthesisVoice[]` — `lang` starting with `fr`, ordered: names matching `/natural|premium|enhanced|amélior/i` first, then `fr-CH`, then `fr-FR`, then the rest, each group alphabetical by name.
  - `pickVoice(voices: SpeechSynthesisVoice[], preferredName?: string | null): SpeechSynthesisVoice | undefined` — the voice whose `name === preferredName`, else `listFrenchVoices(voices)[0]`.
  - `speak(text: string, opts: { rate: number; voice?: SpeechSynthesisVoice | null }): Promise<void>` — cancels anything queued, creates a `SpeechSynthesisUtterance` (`lang = voice?.lang ?? 'fr-FR'`, `rate`, `pitch = 1`), resolves on `end` or `error`; if `speechSynthesis` is missing, resolves after `Math.max(300, text.length * 30)` ms so the game still advances. Reads `globalThis.speechSynthesis` at call time (never cached at import) so Playwright can stub it.
  - `cancelSpeech(): void`
  - `unlockSpeech(): void` — iOS Safari only lets `speechSynthesis` start from a user gesture; this speaks an empty utterance synchronously (`speechSynthesis.speak(new SpeechSynthesisUtterance(''))`) and must be called directly inside the tap handler that starts the dictation. No-op when TTS is unavailable.
- Produces (`script.ts`):
  ```ts
  export type Pace = 1 | 2 | 3 | 4;
  export const PACE_RATES: Record<Pace, number> = { 1: 0.75, 2: 0.85, 3: 0.9, 4: 1.0 };
  export const PACE_LABELS: Record<Pace, { title: string; description: string }> = {
    1: { title: 'Pas à pas', description: 'Une phrase à la fois, lentement. Tu réécoutes autant que tu veux.' },
    2: { title: 'Par groupes', description: 'Des groupes de mots, trois réécoutes pour tout le texte.' },
    3: { title: 'Comme en classe', description: 'Chaque groupe est lu deux fois, puis on enchaîne.' },
    4: { title: "Comme à l'examen", description: 'Lecture entière, dictée, relecture finale. Pas de réécoute.' },
  };
  export interface Chunk { text: string; spoken: string; sentenceIndex: number; newParagraph: boolean }
  export interface DictationPlan { sentences: Sentence[]; chunks: Chunk[]; full: string }
  export type Step =
    | { kind: 'say'; text: string; spoken: string; rate: number; label: 'full' | 'sentence' | 'chunk'; index: number; repeat: 1 | 2 }
    | { kind: 'wait'; ms: number }
    | { kind: 'manual'; index: number }
    | { kind: 'done' };
  export type SayStep = Extract<Step, { kind: 'say' }>; // Task 10's runner.ts imports this for RunnerState.lastSay
  export function buildPlan(text: string): DictationPlan;
  export function buildScript(plan: DictationPlan, pace: Pace): Step[];
  export function replayLimit(pace: Pace): number;        // 1: Infinity, 2: 3, 3: 0, 4: 0
  export function pauseMs(chunkText: string): number;     // Math.max(3000, 1800 * countWords(chunkText))
  export function defaultPace(level: string): Pace;       // 5H,6H -> 1; 7H,8H -> 2; else 3
  ```
  Script shapes: pace 1 = per sentence `say(sentence, 0.75, 'sentence', i, 1)`, `manual(i)`; pace 2 = per chunk `say(chunk, 0.85, 'chunk', i, 1)`, `manual(i)`; pace 3 = per chunk `say(…, 0.9, 'chunk', i, 1)`, `wait(600)`, `say(…, 0.9, 'chunk', i, 2)`, `wait(pauseMs)`; pace 4 = `say(full, 1.0, 'full', 0, 1)`, `wait(2000)`, then the pace-3 sequence per chunk, then `wait(1000)`, `say(full, 0.95, 'full', 0, 2)`. Every script ends with `{ kind: 'done' }`. The `spoken` field of a `say` step is `spokenForm(text, { newParagraph })` for chunks/sentences and the concatenation of the sentence spoken forms for `full`.

- [ ] **Step 1: `segment.test.ts` then `segment.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { splitSentences, splitChunks, countWords } from './segment';

describe('splitSentences', () => {
  it('splits on terminal punctuation followed by space', () => {
    const s = splitSentences('Il pleut. Elle sort ! Pourquoi ? Parce que.');
    expect(s.map((x) => x.text)).toEqual(['Il pleut.', 'Elle sort !', 'Pourquoi ?', 'Parce que.']);
    expect(s[1]).toMatchObject({ start: 10, end: 21, newParagraph: false });
  });
  it('keeps closing quotes with the sentence', () => {
    expect(splitSentences('Il dit : « Viens ici. » Elle vint.').map((x) => x.text)).toEqual(['Il dit : « Viens ici. »', 'Elle vint.']);
  });
  it('does not split on abbreviations or mid-sentence ellipses', () => {
    expect(splitSentences('La chèvre de M. Seguin broutait. Elle rêvait… et partit.').map((x) => x.text))
      .toEqual(['La chèvre de M. Seguin broutait.', 'Elle rêvait… et partit.']);
  });
  it('treats blank lines as boundaries and flags paragraphs', () => {
    const s = splitSentences('Fin du premier\n\nDébut du second. Suite.');
    expect(s.map((x) => [x.text, x.newParagraph])).toEqual([['Fin du premier', false], ['Début du second.', true], ['Suite.', false]]);
  });
  it('returns nothing for blank text', () => expect(splitSentences('  ')).toEqual([]));
});

describe('splitChunks', () => {
  it('splits at punctuation and merges tiny pieces', () => {
    expect(splitChunks('Le loup, affamé, arriva près de la bergerie.')).toEqual(['Le loup, affamé,', 'arriva près de la bergerie.']);
  });
  it('splits long runs near the middle', () => {
    const s = 'un deux trois quatre cinq six sept huit neuf dix onze douze treize quatorze';
    const chunks = splitChunks(s);
    expect(chunks).toEqual(['un deux trois quatre cinq six sept', 'huit neuf dix onze douze treize quatorze']);
    expect(chunks.join(' ')).toBe(s);
  });
  it('keeps short quoted speech attached', () => {
    expect(splitChunks('Il dit : « Viens ici. »')).toEqual(['Il dit : « Viens ici. »']);
  });
  it('never exceeds ten words per chunk', () => {
    const s = Array.from({ length: 33 }, (_, i) => `mot${i}`).join(' ');
    for (const c of splitChunks(s)) expect(countWords(c)).toBeLessThanOrEqual(10);
  });
});
```
Run: `scripts/npm.sh run test -- segment` → fail → implement → pass.

- [ ] **Step 2: `spoken.test.ts` then `spoken.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { spokenForm } from './spoken';

describe('spokenForm', () => {
  it('speaks commas and the final period', () => {
    expect(spokenForm('Le loup, affamé, arriva.')).toBe('Le loup, virgule, affamé, virgule, arriva, point.');
  });
  it('speaks colons, quotes and exclamation marks like a teacher', () => {
    expect(spokenForm('Il dit : « Viens ici ! »'))
      .toBe("Il dit, deux-points, ouvrez les guillemets, Viens ici, point d'exclamation, fermez les guillemets.");
  });
  it('speaks ellipses and question marks', () => {
    expect(spokenForm('Pourquoi… pourquoi ?')).toBe("Pourquoi, points de suspension, pourquoi, point d'interrogation.");
  });
  it('never speaks apostrophes or hyphens inside words', () => {
    expect(spokenForm("L'enfant a dit peut-être.")).toBe("L'enfant a dit peut-être, point.");
  });
  it('announces new paragraphs', () => {
    expect(spokenForm('Il partit.', { newParagraph: true })).toBe('À la ligne. Il partit, point.');
  });
  it('adds a final period to a chunk without terminal punctuation', () => {
    expect(spokenForm('Le loup, affamé,')).toBe('Le loup, virgule, affamé, virgule.');
  });
});
```

- [ ] **Step 3: `tts.test.ts` then `tts.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { listFrenchVoices, pickVoice, speak, ttsAvailable, unlockSpeech } from './tts';

const v = (name: string, lang: string) => ({ name, lang, default: false, localService: true, voiceURI: name }) as SpeechSynthesisVoice;

describe('listFrenchVoices', () => {
  it('keeps only French voices, best first', () => {
    const voices = [v('Zoe', 'fr-FR'), v('Alex', 'en-US'), v('Thomas', 'fr-FR'), v('Amélie (Enhanced)', 'fr-CA'), v('Léa', 'fr-CH')];
    expect(listFrenchVoices(voices).map((x) => x.name)).toEqual(['Amélie (Enhanced)', 'Léa', 'Thomas', 'Zoe']);
  });
  it('picks the preferred voice by name, else the best French one', () => {
    const voices = [v('Zoe', 'fr-FR'), v('Thomas', 'fr-FR')];
    expect(pickVoice(voices, 'Zoe')?.name).toBe('Zoe');
    expect(pickVoice(voices, 'Nope')?.name).toBe('Thomas');
    expect(pickVoice([], null)).toBeUndefined();
  });
});

describe('speak', () => {
  let spoken: { text: string; rate: number }[];
  beforeEach(() => {
    spoken = [];
    class FakeUtterance { text: string; rate = 1; lang = ''; voice: unknown = null; pitch = 1; onend: null | (() => void) = null; onerror: null | (() => void) = null; constructor(t: string) { this.text = t; } }
    (globalThis as any).SpeechSynthesisUtterance = FakeUtterance;
    (globalThis as any).speechSynthesis = {
      speak: (u: any) => { spoken.push({ text: u.text, rate: u.rate }); setTimeout(() => u.onend?.(), 5); },
      cancel: vi.fn(), getVoices: () => [], addEventListener: () => {}, removeEventListener: () => {},
    };
  });
  afterEach(() => { delete (globalThis as any).speechSynthesis; delete (globalThis as any).SpeechSynthesisUtterance; });
  it('resolves when the utterance ends and cancels the queue first', async () => {
    expect(ttsAvailable()).toBe(true);
    await speak('Bonjour, virgule.', { rate: 0.85 });
    expect(spoken).toEqual([{ text: 'Bonjour, virgule.', rate: 0.85 }]);
    expect((globalThis as any).speechSynthesis.cancel).toHaveBeenCalled();
  });
  it('resolves after a delay when TTS is unavailable', async () => {
    delete (globalThis as any).speechSynthesis;
    expect(ttsAvailable()).toBe(false);
    const t0 = Date.now();
    await speak('abc', { rate: 1 });
    expect(Date.now() - t0).toBeGreaterThanOrEqual(250);
  });
  it('unlockSpeech speaks an empty utterance synchronously and is a no-op without TTS', () => {
    unlockSpeech();
    expect(spoken).toEqual([{ text: '', rate: 1 }]);
    delete (globalThis as any).speechSynthesis;
    expect(() => unlockSpeech()).not.toThrow();
  });
});
```

- [ ] **Step 4: `script.test.ts` then `script.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { buildPlan, buildScript, replayLimit, pauseMs, defaultPace } from './script';

const TEXT = 'Le loup, affamé, arriva près de la bergerie. Les brebis dormaient.';

describe('buildPlan', () => {
  it('produces sentences and chunks with spoken forms', () => {
    const plan = buildPlan(TEXT);
    expect(plan.sentences).toHaveLength(2);
    expect(plan.chunks.map((c) => c.text)).toEqual(['Le loup, affamé,', 'arriva près de la bergerie.', 'Les brebis dormaient.']);
    expect(plan.chunks[0].spoken).toBe('Le loup, virgule, affamé, virgule.');
    expect(plan.chunks.map((c) => c.sentenceIndex)).toEqual([0, 0, 1]);
  });
});

describe('buildScript', () => {
  const plan = buildPlan(TEXT);
  it('pace 1: one sentence, then wait for the player', () => {
    const kinds = buildScript(plan, 1).map((s) => s.kind);
    expect(kinds).toEqual(['say', 'manual', 'say', 'manual', 'done']);
    const first = buildScript(plan, 1)[0];
    expect(first).toMatchObject({ kind: 'say', label: 'sentence', rate: 0.75, index: 0, repeat: 1 });
  });
  it('pace 2: one chunk, then wait', () => {
    expect(buildScript(plan, 2).map((s) => s.kind)).toEqual(['say', 'manual', 'say', 'manual', 'say', 'manual', 'done']);
    expect(buildScript(plan, 2)[0]).toMatchObject({ label: 'chunk', rate: 0.85 });
  });
  it('pace 3: each chunk twice, then a pause proportional to its length', () => {
    const steps = buildScript(plan, 3);
    expect(steps.slice(0, 4)).toEqual([
      expect.objectContaining({ kind: 'say', repeat: 1, rate: 0.9 }), { kind: 'wait', ms: 600 },
      expect.objectContaining({ kind: 'say', repeat: 2 }), { kind: 'wait', ms: pauseMs('Le loup, affamé,') },
    ]);
    expect(steps.at(-1)).toEqual({ kind: 'done' });
    expect(steps.filter((s) => s.kind === 'manual')).toHaveLength(0);
  });
  it('pace 4: full reading, chunks twice, final full reading', () => {
    const steps = buildScript(plan, 4);
    expect(steps[0]).toMatchObject({ kind: 'say', label: 'full', rate: 1.0, repeat: 1 });
    expect(steps[1]).toEqual({ kind: 'wait', ms: 2000 });
    expect(steps.at(-2)).toMatchObject({ kind: 'say', label: 'full', rate: 0.95, repeat: 2 });
    expect(steps.at(-1)).toEqual({ kind: 'done' });
  });
});

describe('parameters', () => {
  it('replay limits and pauses', () => {
    expect(replayLimit(1)).toBe(Infinity); expect(replayLimit(2)).toBe(3); expect(replayLimit(3)).toBe(0); expect(replayLimit(4)).toBe(0);
    expect(pauseMs('un deux')).toBe(3600); expect(pauseMs('un')).toBe(3000);
  });
  it('default pace by level', () => {
    expect(defaultPace('5H')).toBe(1); expect(defaultPace('8H')).toBe(2); expect(defaultPace('10H')).toBe(3);
  });
});
```

- [ ] **Step 5: `index.ts`, full test run, svelte-check, commit**

Run: `scripts/npm.sh run test` and `scripts/npm.sh run check` → green.

```bash
git add web/src/lib/dictation
git commit -m "Add dictation segmentation, spoken punctuation, TTS wrapper and pace scripts

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: SPA foundation — theme, router, API client, profiles, library, add-text, settings, PWA

Svelte 5 with runes (`$state`, `$derived`, `$effect`, `$props`). All UI text in French. iPad-first: touch targets ≥ 48 px, base font 18 px, layouts that work at 1180×820 and 820×1180 and on a laptop.

**Files:**
- Create: `web/src/app.css` (replace), `web/src/App.svelte` (replace), `web/src/lib/routes.ts`, `web/src/lib/router.svelte.ts`, `web/src/lib/api.ts`, `web/src/lib/types.ts`, `web/src/lib/profileStore.svelte.ts`, `web/src/lib/levels.ts`
- Create: `web/src/components/TopBar.svelte`, `Avatar.svelte`, `PinGate.svelte`, `LevelSelect.svelte`
- Create: `web/src/screens/ProfilePicker.svelte`, `ProfileCreate.svelte`, `Library.svelte`, `TextCreate.svelte`, `Settings.svelte`, `Stats.svelte` (placeholder until Task 12), `Play.svelte` (placeholder until Task 10)
- Create: `web/public/manifest.json`, `web/public/icon.svg`, `web/public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`, `web/scripts/make-icons.mjs`
- Modify: `web/index.html` (manifest, theme-color, apple meta tags)
- Test: `web/src/lib/routes.test.ts`, `web/src/lib/levels.test.ts`, `web/e2e/profiles.spec.ts`

**Interfaces:**
- Consumes: API endpoints from Tasks 2, 4, 5; `listFrenchVoices`, `pickVoice`, `waitForVoices`, `speak` from Task 8.
- Produces (`types.ts`, mirrors the server schemas): `Profile { id; name; avatar; level; has_pin; help_stage; created_at; settings: { voice?: string } }`, `TextSummary { id; title; level; source; author; translator; work; credits; word_count; added_by_profile_id; added_by_name; due_date; created_at; history: { times_played; best_score; best_catch_rate } | null }`, `TextFull extends TextSummary { body; annotation: Annotation }`, `SessionCreate`, `SessionCreated { id; help_stage_before; help_stage_after; help_stage_message: string | null }`, `StatsResponse { profile; categories: CategoryRow[]; recent_sessions; trap_words: TrapWord[]; totals; argus_order: ArgusPass[] }`, `TrapWord { word; box; misses; last_seen }`. `types.ts` re-exports `ArgusPass` from `./grading/types` (`export type { ArgusPass } from './grading/types';`) rather than redeclaring it.
- Produces (`api.ts`): `class ApiError extends Error { status: number; detail: string }`; `api.profiles.list() / create(body) / get(id) / patch(id, body) / verifyPin(id, pin) / stats(id) / trapWords(id)`; `api.texts.list(profileId?) / create(body) / get(id)`; `api.sessions.create(body)`. All return parsed JSON; non-2xx throws `ApiError` with `detail` from the JSON body (`detail` may be a string or a pydantic error list — flatten to a string).
- Produces (`routes.ts`): `type RouteName = 'profiles' | 'profile-new' | 'library' | 'text-new' | 'play' | 'stats' | 'settings'`; `interface Route { name: RouteName; params: Record<string, string> }`; `matchRoute(hash: string): Route` (patterns: `/` → profiles, `/profiles/new`, `/p/:profileId/camp` → library, `/p/:profileId/texts/new` → text-new, `/p/:profileId/play/:textId` → play, `/p/:profileId/stats`, `/p/:profileId/settings`; anything else → profiles); `href(name, params)` builder.
- Produces (`router.svelte.ts`): `export const router = $state({ route: matchRoute(location.hash) })`, `startRouter()`, `navigate(path: string)` (sets `location.hash`).
- Produces (`profileStore.svelte.ts`): `export const profileStore = $state<{ current: Profile | null; loading: boolean }>(...)`; `loadProfile(id: number): Promise<Profile>` (fetches, stores, persists id in `localStorage['discorde.profileId']`); `isUnlocked(id)` / `markUnlocked(id)` (sessionStorage `discorde.unlocked`, JSON array of ids); `clearProfile()`.
- Produces (`levels.ts`): `LEVELS`, `AVATARS`, `AVATAR_GLYPHS: Record<Avatar, string>` (`chouette` → `🦉`, `dragon` → `🐉`, `lyre` → `🎵`, `trident` → `🔱`, `laurier` → `🌿`, `foudre` → `⚡`), `levelIndex(level)`, `levelLabel(level)` (`"10H"`), `includesParticiplesInVerbPass(level): boolean` (`levelIndex >= levelIndex('8H')`).
- Produces (CSS custom properties on `:root`): `--marble: #F4EFE6; --marble-dark: #E8E0D2; --ink: #2B2A28; --ink-soft: #5C5854; --terracotta: #C0623B; --terracotta-dark: #9A4B2C; --olive: #6B7A3A; --aegean: #2C6E8F; --aegean-light: #D8E8EF; --gold: #C9A227; --orange: #E07B2A; --orange-light: #FBE5D2; --radius: 14px; --font-display: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif; --font-body: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;` plus utility classes `.btn`, `.btn-primary`, `.btn-ghost`, `.card`, `.chip`, `.chip-active`, `.screen` (max-width 1100 px, padding 16 px, `min-height: 100dvh`, safe-area insets), `.muted`, `.orange` (never red anywhere).

- [ ] **Step 1: Pure helpers with tests (`routes.ts`, `levels.ts`)**

`routes.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { matchRoute, href } from './routes';

describe('matchRoute', () => {
  it('matches every screen', () => {
    expect(matchRoute('')).toEqual({ name: 'profiles', params: {} });
    expect(matchRoute('#/')).toEqual({ name: 'profiles', params: {} });
    expect(matchRoute('#/profiles/new')).toEqual({ name: 'profile-new', params: {} });
    expect(matchRoute('#/p/3/camp')).toEqual({ name: 'library', params: { profileId: '3' } });
    expect(matchRoute('#/p/3/texts/new')).toEqual({ name: 'text-new', params: { profileId: '3' } });
    expect(matchRoute('#/p/3/play/12')).toEqual({ name: 'play', params: { profileId: '3', textId: '12' } });
    expect(matchRoute('#/p/3/stats')).toEqual({ name: 'stats', params: { profileId: '3' } });
    expect(matchRoute('#/p/3/settings')).toEqual({ name: 'settings', params: { profileId: '3' } });
    expect(matchRoute('#/nope/zzz')).toEqual({ name: 'profiles', params: {} });
  });
  it('builds hrefs', () => {
    expect(href('play', { profileId: '3', textId: '12' })).toBe('#/p/3/play/12');
    expect(href('profiles')).toBe('#/');
  });
});
```
`levels.test.ts`: `levelIndex('5H') === 0`, `levelIndex('11H') === 6`, `includesParticiplesInVerbPass('7H') === false`, `('8H') === true`.
Run: `scripts/npm.sh run test -- routes levels` → fail → implement → pass.

- [ ] **Step 2: Theme, router, API client, profile store**

`router.svelte.ts`:
```ts
import { matchRoute, type Route } from './routes';
export const router = $state<{ route: Route }>({ route: matchRoute(typeof location === 'undefined' ? '' : location.hash) });
export function startRouter() {
  window.addEventListener('hashchange', () => { router.route = matchRoute(location.hash); });
}
export function navigate(path: string) { location.hash = path.startsWith('#') ? path : '#' + path; }
```
`api.ts` core:
```ts
export class ApiError extends Error { constructor(public status: number, public detail: string) { super(detail); } }
async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const d = (data as { detail?: unknown }).detail;
    throw new ApiError(res.status, typeof d === 'string' ? d : Array.isArray(d) ? d.map((e: { msg?: string }) => e.msg ?? '').join('; ') : res.statusText);
  }
  return data as T;
}
```
`App.svelte` switches on `router.route.name` and renders the screen component, passing `params`. Screens under `/p/:profileId/...` are wrapped by a `ProfileGate` logic inside `App.svelte`: `loadProfile(id)`; if `has_pin && !isUnlocked(id)` render `<PinGate profile onUnlocked={...}/>` instead of the screen. `main.ts` calls `startRouter()` before mounting.

- [ ] **Step 3: Screens (French copy below is normative; adjust wording only if it reads badly)**

`ProfilePicker.svelte`: heading `La Discorde`, subtitle `Choisis ton héros`. Grid of `.card` buttons: `<Avatar avatar size=72/>`, name (display font), level chip. Last card: `<button type="button" class="card">+ Nouveau héros</button>` → `#/profiles/new` (a real `<button>`, not an `<a>`, so `getByRole('button')` in the e2e specs finds it). Empty state: `Aucun héros pour l'instant. Crée le tien !`. Tap → `navigate(href('library', { profileId }))` (the gate handles the PIN).

`PinGate.svelte` (props `profile`, `onUnlocked`): title `Code de {name}`, one `<input inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off">` (large digits), auto-submit at 4 digits via `api.profiles.verifyPin`; wrong → message in orange `Ce n'est pas le bon code. Réessaie.` and clear; right → `markUnlocked(id)`, `onUnlocked()`. Link `Changer de héros` → `#/`.

`ProfileCreate.svelte`: form `Nouveau héros`: `Ton prénom` (text, maxlength 30, `autocapitalize="words"`), `Ton avatar` (6 `Avatar` radio buttons), `Ton niveau` (`LevelSelect`, hint `HarmoS, comme à l'école`), `Un code à quatre chiffres (facultatif)` with hint `Pour que ton frère ou ta sœur ne joue pas sur ton profil.` (`inputmode="numeric"`, maxlength 4). Submit `Rejoindre le camp` → `api.profiles.create` → `markUnlocked`, navigate to library. `ApiError` 409 → `Ce nom est déjà pris.`; other → `Les Muses n'ont pas pu créer ce héros : {detail}`.

`TopBar.svelte` (props `profile`, `title?`): left: `Avatar` + name; centre: title; right: links `Progrès` (`stats`), `Réglages` (`settings`), `Changer de héros` (`clearProfile()` then `#/`). Collapses to icons + labels under 700 px width.

`Library.svelte` (`Les Parchemins`): loads `api.texts.list(profileId)`. Subtitle `Choisis un texte à protéger des dés-accords d'Éris.` Level filter chips: `Tous` + one per level; default selection `Tous`. Two sections when `Tous`: `À ton niveau ({level})` then `Autres parchemins` (sorted by level then title). Text card: title (display font), credits line (`{credits}` or `Ajouté par {added_by_name}` for custom), chips `{level}` and `≈ {word_count} mots`, history line `Jamais joué` / `Joué {n}× · meilleur taux de pièges déjoués {pct} %` (`best_catch_rate` null → `Joué {n}×`). Tap → play route. Floating button `<button type="button">+ Ajouter un texte</button>` → text-new (a real `<button>`, not an `<a>`, so `getByRole('button')` in the e2e specs finds it). Loading: `Les Muses déroulent les parchemins…`. Error: `Impossible de lire les parchemins : {detail}`.

`TextCreate.svelte` (`Nouveau parchemin`): fields `Titre`, `Texte` (textarea 12 rows with `autocorrect="off" autocapitalize="sentences" spellcheck="true"` — spellcheck is fine here, this is the parent/child entering a reference), `Niveau`, optional `Auteur`, `Œuvre`, `Traducteur`. Live word count `{n} mots` (`countWords`), hint `Entre quatre-vingts et deux cents mots, nombres écrits en lettres.` Submit `Sauvegarder dans les Parchemins` → `api.texts.create({ ..., source: 'custom', added_by_profile_id })` → navigate to library. 422 detail shown as-is (server already says `Écris les nombres en lettres`).

`Settings.svelte` (`Réglages`): section `Voix de la dictée`: `<select>` of `listFrenchVoices(await waitForVoices())`, preselect `profile.settings.voice`; button `Écouter un essai` → `speak("Bonjour ! Je lirai tes dictées. Virgule, point.", { rate: 0.9, voice })`; if no French voice: `Aucune voix française trouvée sur cet appareil. Sur iPad : Réglages → Accessibilité → Contenu énoncé → Voix → Français.` Section `Niveau` (`LevelSelect`). Section `Code`: `Nouveau code (quatre chiffres)` + button `Retirer le code`. `Enregistrer` → `api.profiles.patch(id, { settings: { voice }, level, pin? })` → toast `C'est noté.`

`Play.svelte` placeholder: loads the text and shows `<h1>{title}</h1><p>La dictée arrive au prochain chapitre.</p>` (Task 10 replaces it). `Stats.svelte` placeholder: `Tes progrès arrivent bientôt.` (Task 12 replaces it).

- [ ] **Step 4: PWA manifest and icons**

`web/public/manifest.json`:
```json
{ "name": "La Discorde", "short_name": "Discorde", "lang": "fr", "start_url": "/", "scope": "/", "display": "standalone",
  "background_color": "#F4EFE6", "theme_color": "#C0623B",
  "icons": [ { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
             { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
             { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" } ] }
```
`web/index.html` head additions: `<link rel="manifest" href="/manifest.json">`, `<meta name="theme-color" content="#C0623B">`, `<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">`, `<meta name="apple-mobile-web-app-capable" content="yes">`, `<meta name="apple-mobile-web-app-status-bar-style" content="default">`, `<meta name="apple-mobile-web-app-title" content="La Discorde">`.
`web/public/icon.svg` (512×512): rounded square (`rx=96`) filled `#C0623B`; the golden apple of Discord: circle `cx=256 cy=290 r=150` fill `#E1B93A` with a lighter highlight ellipse `#F3D97A`, a stem (`stroke #6B4A1E width 14`) and an olive leaf (`#6B7A3A`) at the top; a thin marble-white (`#F4EFE6`) ring at `r=232` `stroke-width=10` `opacity=.5`.
`web/scripts/make-icons.mjs` with `sharp`: render `public/icon.svg` to `public/icons/icon-192.png` (192), `public/icons/icon-512.png` (512), `public/icons/apple-touch-icon.png` (180), and `public/icons/icon-maskable-512.png` (the SVG scaled to 80 % centred on a `#C0623B` 512×512 background) — outputs land under `public/icons/`, matching the Files list, `manifest.json` and `index.html`. Run `scripts/npm.sh run icons` and commit the PNGs. If `sharp` fails to load its binary in the container, run `scripts/npm.sh rebuild sharp` once.

- [ ] **Step 5: E2E for profiles and library**

`web/e2e/profiles.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

const unique = () => 'Héros' + Date.now().toString().slice(-6);

test('create a profile and reach the library with seed texts', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Nouveau héros/ }).click();
  await page.getByLabel('Ton prénom').fill(unique());
  await page.getByLabel('Ton niveau').selectOption('10H');
  await page.getByRole('button', { name: 'Rejoindre le camp' }).click();
  await expect(page.getByRole('heading', { name: 'Les Parchemins' })).toBeVisible();
  expect(await page.locator('[data-testid="text-card"]').count()).toBeGreaterThanOrEqual(25);
});

test('a profile with a code asks for it', async ({ page }) => {
  const name = unique();
  await page.goto('/#/profiles/new');
  await page.getByLabel('Ton prénom').fill(name);
  await page.getByLabel(/Un code à quatre chiffres/).fill('1234');
  await page.getByRole('button', { name: 'Rejoindre le camp' }).click();
  await expect(page.getByRole('heading', { name: 'Les Parchemins' })).toBeVisible();
  await page.getByRole('link', { name: 'Changer de héros' }).click();
  await page.getByRole('button', { name: new RegExp(name) }).click();
  await page.getByLabel(/Code de/).fill('0000');
  await expect(page.getByText("Ce n'est pas le bon code")).toBeVisible();
  await page.getByLabel(/Code de/).fill('1234');
  await expect(page.getByRole('heading', { name: 'Les Parchemins' })).toBeVisible();
});
```
Give text cards `data-testid="text-card"`. Note `sessionStorage` is per Playwright page context, so "Changer de héros" followed by picking the profile again must ask for the code (`clearProfile()` also removes the id from the unlocked list).

- [ ] **Step 6: Run the gate**

Run: `scripts/npm.sh run check` (0 errors), `scripts/npm.sh run test`, then `scripts/check.sh` → `== ALL GREEN`. Also open `scripts/dev.sh` once and load `http://localhost:5173` in a desktop browser to eyeball the picker, the form and the library at a narrow window (≈ 820 px) and a wide one.

- [ ] **Step 7: Commit**

```bash
git add web
git commit -m "Add SPA foundation: theme, router, profiles, library, add-text, settings, PWA

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Dictation screen — intro, pace selection, TTS runner, keyboard-safe typing

Spec §3.3. The reference text is never visible during dictation. TTS must start inside a tap handler (iOS Safari requirement).

**Files:**
- Create: `web/src/lib/dictation/runner.ts`, `web/src/lib/playState.ts`, `web/src/components/Dictation.svelte`, `web/src/components/PaceSelect.svelte`
- Modify: `web/src/screens/Play.svelte` (replace placeholder; phases `intro` → `dictation` → `proofreading` → `results`; the last two render placeholders `<p>Relecture au prochain chapitre.</p>` until Tasks 11–12)
- Test: `web/src/lib/dictation/runner.test.ts`, `web/src/lib/playState.test.ts`

**Interfaces:**
- Consumes: `buildPlan`, `buildScript`, `replayLimit`, `PACE_LABELS`, `PACE_RATES`, `defaultPace`, `speak`, `cancelSpeech`, `ttsAvailable`, `waitForVoices`, `pickVoice` (Task 8); `api.texts.get`, `profileStore` (Task 9).
- Produces (`runner.ts`):
  ```ts
  export type RunnerStatus = 'idle' | 'playing' | 'waiting' | 'paused' | 'finished';
  export interface RunnerState { index: number; status: RunnerStatus; lastSay: SayStep | null; replaysLeft: number; done: number; total: number }
  export interface RunnerDeps { pace: Pace; speak: (spoken: string, rate: number) => Promise<void>; sleep: (ms: number) => Promise<void>; onChange: (s: RunnerState) => void }
  export function createRunner(steps: Step[], deps: RunnerDeps): { start(): void; next(): void; replay(): void; pause(): void; resume(): void; stop(): void; state(): RunnerState }
  ```
  Behaviour: `start()` runs steps from 0; `say` awaits `speak` (unless stopped/paused meanwhile); `wait` awaits `sleep`; `manual` sets `status = 'waiting'` and stops the loop until `next()`; `done` sets `finished`. `replay()` re-speaks `lastSay` when `replaysLeft > 0` (decrementing; `Infinity` for pace 1) and only while `waiting`. `pause()` cancels the current utterance (`status = 'paused'`), `resume()` re-runs from the current step. `total` = number of `say` steps with `repeat === 1`, `done` = how many of those have been spoken. `stop()` aborts everything (used on unmount). iOS gesture requirement: `Play.svelte` calls `unlockSpeech()` (Task 8) synchronously inside the `Commencer la dictée` tap handler before switching phase; the runner itself starts from the Dictation component's `onMount`, which is fine once speech is unlocked.
- Produces (`playState.ts`):
  ```ts
  export type Phase = 'intro' | 'dictation' | 'proofreading' | 'results';
  export interface PlayState { version: 1; profileId: number; textId: number; phase: Phase; pace: Pace; startedAt: string;
    draft: string; current: string; hintsUsed: number; revealedKeys: string[]; passIndex: number; bouclier: boolean; submitted: boolean; sessionId: number | null }
  export function playKey(profileId: number, textId: number): string;          // `discorde.play.${profileId}.${textId}`
  export function loadPlayState(profileId, textId): PlayState | null;           // null when absent, corrupt, or version mismatch
  export function savePlayState(s: PlayState): void;
  export function clearPlayState(profileId, textId): void;
  export function newPlayState(profileId, textId, pace): PlayState;
  ```
  All storage access wrapped in try/catch (private mode).
- Produces (`Dictation.svelte` props): `plan: DictationPlan`, `pace: Pace`, `voice: SpeechSynthesisVoice | null`, `text: string` (bindable, the draft being typed), `onFinish: () => void`.

- [ ] **Step 1: `runner.test.ts` then `runner.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { createRunner } from './runner';
import type { Step } from './script';

const say = (i: number, repeat: 1 | 2 = 1): Step => ({ kind: 'say', text: `t${i}`, spoken: `s${i}`, rate: 0.85, label: 'chunk', index: i, repeat });
const flush = () => new Promise((r) => setTimeout(r, 0));

function harness(steps: Step[], pace: 1 | 2 | 3 | 4) {
  const spoken: string[] = []; const states: string[] = [];
  const runner = createRunner(steps, {
    pace, speak: async (s) => { spoken.push(s); }, sleep: async () => {},
    onChange: (st) => states.push(st.status),
  });
  return { runner, spoken, states };
}

describe('createRunner', () => {
  it('speaks, waits for the player on manual steps, and finishes', async () => {
    const { runner, spoken } = harness([say(0), { kind: 'manual', index: 0 }, say(1), { kind: 'manual', index: 1 }, { kind: 'done' }], 2);
    runner.start(); await flush();
    expect(spoken).toEqual(['s0']);
    expect(runner.state()).toMatchObject({ status: 'waiting', done: 1, total: 2, replaysLeft: 3 });
    runner.next(); await flush();
    expect(spoken).toEqual(['s0', 's1']);
    runner.next(); await flush();
    expect(runner.state().status).toBe('finished');
  });
  it('replays the last utterance within the limit', async () => {
    const { runner, spoken } = harness([say(0), { kind: 'manual', index: 0 }, { kind: 'done' }], 2);
    runner.start(); await flush();
    runner.replay(); await flush(); runner.replay(); await flush(); runner.replay(); await flush(); runner.replay(); await flush();
    expect(spoken).toEqual(['s0', 's0', 's0', 's0']);
    expect(runner.state().replaysLeft).toBe(0);
  });
  it('pace 1 has unlimited replays', async () => {
    const { runner } = harness([say(0), { kind: 'manual', index: 0 }, { kind: 'done' }], 1);
    runner.start(); await flush();
    expect(runner.state().replaysLeft).toBe(Infinity);
  });
  it('runs automatic paces to the end and can pause/resume', async () => {
    let release: (() => void) | null = null;
    const spoken: string[] = [];
    const runner = createRunner([say(0), { kind: 'wait', ms: 600 }, say(0, 2), { kind: 'wait', ms: 3000 }, say(1), { kind: 'done' }], {
      pace: 3, speak: (s) => { spoken.push(s); return new Promise<void>((r) => { release = r; }); },
      sleep: async () => {}, onChange: () => {},
    });
    runner.start(); await flush();
    expect(spoken).toEqual(['s0']);
    runner.pause(); release!(); await flush();
    expect(runner.state().status).toBe('paused');
    runner.resume(); await flush();
    expect(spoken).toEqual(['s0', 's0']); // the paused utterance is repeated
    release!(); await flush(); release!(); await flush(); release!(); await flush();
    expect(runner.state().status).toBe('finished');
  });
});
```

- [ ] **Step 2: `playState.test.ts` then `playState.ts`**

Tests: `newPlayState(1, 2, 2)` has `phase 'intro'`, `draft ''`, `hintsUsed 0`, `submitted false`; save then load round-trips; `loadPlayState` returns null for a missing key and for corrupt JSON (`localStorage.setItem(key, '{')`); `clearPlayState` removes. Use a minimal in-memory `localStorage` stub on `globalThis` in `beforeEach`.

- [ ] **Step 3: `PaceSelect.svelte`, `Dictation.svelte`, `Play.svelte`**

`Play.svelte`: loads `api.texts.get(textId)` and `api.profiles.trapWords(profileId)` (for Task 11) and `api.profiles.stats(profileId)` (for `argus_order`, Task 11; store them in component state now). Restores `loadPlayState` (if `phase !== 'results'` show banner `Tu reprends là où tu t'étais arrêtée.` with a `Recommencer` button that clears state). Phases:

- `intro`: title, credits (`{credits}`), chips level and `≈ {word_count} mots`; `<PaceSelect bind:pace/>` (4 `.card` radios with `PACE_LABELS`, default `defaultPace(profile.level)`), a line `Les récompenses augmentent avec le rythme.`; TTS note when `!ttsAvailable()`: `Cet appareil ne sait pas lire à voix haute. La dictée avancera toute seule, sans son.`; voice resolution: `pickVoice(await waitForVoices(), profile.settings.voice)`. Button `Commencer la dictée` → **first** calls `unlockSpeech()` synchronously in the click handler (iOS gesture rule), then sets `startedAt` and `phase = 'dictation'`; the Dictation component calls `runner.start()` in `onMount`.
- `dictation`: `<Dictation plan pace voice bind:text={state.draft} onFinish={() => { state.phase = 'proofreading'; state.current = state.draft; save(); }} />`.
- `proofreading` / `results`: placeholders until Tasks 11 and 12.

`Dictation.svelte`:
- Layout: a column sized to the visual viewport: `style="height: var(--vvh)"`, where an `$effect` sets `document.documentElement.style.setProperty('--vvh', `${visualViewport?.height ?? innerHeight}px`)` on `visualViewport` `resize`/`scroll` events (removed on destroy). Rows: compact header (title + `Groupe {done} sur {total}` / `Phrase {done} sur {total}` / `Lecture complète`), a status line with a pulsing dot (`Écoute…` while `playing`, `À toi d'écrire.` while `waiting`, `En pause.` while `paused`, `C'est fini ! Relis ton texte quand tu es prête.` when `finished`), the controls row, and the textarea taking the remaining height (`flex: 1; min-height: 0`).
- Textarea: `<textarea lang="fr" autocorrect="off" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="Écris ici ce que tu entends…" bind:value={text}>` with `font-size: 22px; line-height: 1.6; font-family: var(--font-body); padding: 16px;` and on `input` keep the caret visible (`el.scrollTop = el.scrollHeight` when the caret is at the end).
- Controls: pace 1–2: `Réécouter` (shows `({replaysLeft})` for pace 2; disabled at 0 or unless `waiting`) and `Suivant` (enabled when `waiting`); pace 3–4: `Pause` / `Reprendre`. All paces: `J'ai fini d'écrire` appears when `status === 'finished'` (and for pace 1–2 also when the last manual step is reached, i.e. `done === total`). Clicking it calls `cancelSpeech()` then `onFinish()`.
- Runner wiring: `createRunner(buildScript(plan, pace), { pace, speak: (s, r) => speak(s, { rate: r, voice }), sleep, onChange: (s) => (runnerState = s) })`; `onMount(() => runner.start())`; `onDestroy(() => runner.stop())`.
- Never render `plan` text anywhere in the DOM (no hidden chunk text, no `title` attributes with the sentence).

- [ ] **Step 4: Manual check in the dev stack, then the gate**

Run `scripts/dev.sh`, open `http://localhost:5173`, play a seed text at pace 1 and 3 in a desktop browser (Chrome/Edge have French voices; the runner also works silently without). Verify: no reference text visible, `Suivant` advances, `Réécouter` counts down at pace 2, `Pause` works at pace 3, `J'ai fini d'écrire` reaches the placeholder. Then `scripts/check.sh` → `== ALL GREEN`.

- [ ] **Step 5: Commit**

```bash
git add web
git commit -m "Add dictation screen with pace runner and keyboard-safe typing

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Proofreading screen — Argus passes, help stages, Bouclier de Persée, Chouette d'Athéna, inline editing

Spec §3.4. This is the main game. The player's text is the only text on screen; the reference is used silently for spotlight mapping, hints and the stage-3 count.

**Files:**
- Create: `web/src/lib/argus.ts`, `web/src/lib/textEdit.ts`, `web/src/components/Proofreading.svelte`, `web/src/components/WordEditor.svelte`, `web/src/components/TokenText.svelte`
- Modify: `web/src/screens/Play.svelte` (wire the `proofreading` phase)
- Test: `web/src/lib/argus.test.ts`, `web/src/lib/textEdit.test.ts`

**Interfaces:**
- Consumes: `gradeText`, `tokenize`, `errorKey`, `homophoneSetOf` (Task 7); `splitSentences` (Task 8); `includesParticiplesInVerbPass` (Task 9); `PlayState` (Task 10); `argus_order` and trap words from the API.
- Produces (`argus.ts`):
  ```ts
  export type { ArgusPass } from './grading/types'; // single source of truth; do not redeclare here
  export const ARGUS_PASSES: ArgusPass[] = ['verbes', 'groupes_nominaux', 'homophones', 'mots_pieges'];
  export const ARGUS_LABELS: Record<ArgusPass, { title: string; hint: string }> = {
    verbes: { title: 'Verbes', hint: 'Pour chaque verbe, cherche son sujet : singulier ou pluriel ?' },
    groupes_nominaux: { title: 'Groupes nominaux', hint: "Déterminant, nom, adjectif : ils s'accordent ensemble." },
    homophones: { title: 'Homophones', hint: 'a ou à ? et ou est ? Remplace par un autre mot pour vérifier.' },
    mots_pieges: { title: 'Mots-pièges', hint: "Les mots qui t'ont déjà piégée. Regarde chaque lettre." },
  };
  export const HINTS_PER_STAGE: Record<1 | 2 | 3 | 4, number> = { 1: 3, 2: 2, 3: 1, 4: 0 };
  /** For each typed token, the set of passes that light it. */
  export function typedPassSets(grade: GradeResult, annotation: Annotation | null, trapWords: string[], level: string): Set<ArgusPass>[];
  export function orderPasses(order: ArgusPass[] | undefined): ArgusPass[]; // validates/completes to a permutation of ARGUS_PASSES
  ```
  Rules for `typedPassSets`: for a typed token aligned to reference token `r` with mapped annotation `a`: `verb` → `verbes`; `participle` → `verbes` only when `includesParticiplesInVerbPass(level)`; `nominal_group` → `groupes_nominaux`; `homophone` → `homophones`; `r.norm ∈ trapWords` or `typed.norm ∈ trapWords` → `mots_pieges`. Unaligned typed words: `homophoneSetOf(norm)` defined → `homophones`; `norm ∈ trapWords` → `mots_pieges`. Punctuation tokens get an empty set.
- Produces (`textEdit.ts`): `replaceSpan(text: string, start: number, end: number, replacement: string): string` — replaces `[start, end)`; when `replacement.trim() === ''` also removes one adjacent space (the following one if present, else the preceding one) and never leaves a double space; `sentenceSpans(text): { start: number; end: number }[]` (from `splitSentences`).
- Produces (`Proofreading.svelte` props): `reference: TextFull`, `state: PlayState` (bindable; uses `current`, `hintsUsed`, `revealedKeys`, `passIndex`, `bouclier`), `helpStage: 1 | 2 | 3 | 4`, `argusOrder: ArgusPass[]`, `trapWords: string[]`, `level: string`, `onDone: () => void`.
- Produces (`TokenText.svelte` props): `text: string`, `passSets: Set<ArgusPass>[]`, `activePass: ArgusPass | null`, `dim: boolean` (stage 1 only), `hintedTokenIndexes: Set<number>`, `range: { start: number; end: number } | null` (Bouclier: render only this span), `onEditToken: (index: number) => void`. Renders the exact original string as a sequence of `<button class="tok">` for tokens and plain text for the gaps (so whitespace/newlines are preserved; `white-space: pre-wrap`). Classes: `lit` (active pass and token in set), `dim` (dim mode and token not in set), `hint` (in `hintedTokenIndexes`), `punct`.

- [ ] **Step 1: `argus.test.ts`, `textEdit.test.ts`, then implementations**

`argus.test.ts` (reuse the hand-built annotation approach from `grade.test.ts`, copied locally — do not import test files):
```ts
import { describe, it, expect } from 'vitest';
import { gradeText, tokenize } from '$lib/grading';
import { typedPassSets, orderPasses } from './argus';
import type { Annotation, AnnotToken } from '$lib/grading/types';

const REF = 'Les fées ont dansé. Il a chanté.';
function ann(): Annotation {
  const spec: [string, string[]][] = [
    ['DET', ['nominal_group']], ['NOUN', ['nominal_group']], ['AUX', ['verb']], ['VERB', ['participle']], ['PUNCT', []],
    ['PRON', []], ['AUX', ['verb', 'homophone']], ['VERB', ['participle']], ['PUNCT', []],
  ];
  const tokens: AnnotToken[] = tokenize(REF).map((t, i) => ({ i, text: t.text, start: t.start, end: t.end, lemma: t.norm, pos: spec[i][0],
    morph: {}, head: i, dep: 'dep', categories: spec[i][1], homophone: spec[i][1].includes('homophone') ? 'a' : null, subject: null }));
  return { version: 1, model: 't', tokens, sentences: [] };
}
const sets = (typed: string, level: string, traps: string[] = []) =>
  typedPassSets(gradeText(REF, typed, ann()), ann(), traps, level).map((s) => [...s].sort());

describe('typedPassSets', () => {
  it('maps categories through the alignment', () => {
    expect(sets('Les fée ont dansé. Il a chanté.', '10H')).toEqual([
      ['groupes_nominaux'], ['groupes_nominaux'], ['verbes'], ['verbes'], [], [], ['homophones', 'verbes'], ['verbes'], []]);
  });
  it('excludes participles from the verb pass below 8H', () => {
    expect(sets(REF, '7H')[3]).toEqual([]);
    expect(sets(REF, '8H')[3]).toEqual(['verbes']);
  });
  it('lights trap words and unaligned homophones', () => {
    expect(sets(REF, '10H', ['fées'])[1]).toEqual(['groupes_nominaux', 'mots_pieges']);
    expect(sets('Les fées ont dansé à. Il a chanté.', '10H')[4]).toEqual(['homophones']); // extra "à"
  });
});

describe('orderPasses', () => {
  it('accepts a full order and completes a partial or invalid one', () => {
    expect(orderPasses(['homophones', 'verbes', 'groupes_nominaux', 'mots_pieges'])).toEqual(['homophones', 'verbes', 'groupes_nominaux', 'mots_pieges']);
    expect(orderPasses(['homophones'])).toEqual(['homophones', 'verbes', 'groupes_nominaux', 'mots_pieges']);
    expect(orderPasses(undefined)).toEqual(['verbes', 'groupes_nominaux', 'homophones', 'mots_pieges']);
  });
});
```
`textEdit.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { replaceSpan, sentenceSpans } from './textEdit';

describe('replaceSpan', () => {
  it('replaces a word', () => expect(replaceSpan('les chat dorment', 4, 8, 'chats')).toBe('les chats dorment'));
  it('can insert several words', () => expect(replaceSpan('le dort', 3, 7, 'chat noir dort')).toBe('le chat noir dort'));
  it('removes a word and one adjacent space', () => {
    expect(replaceSpan('le petit chat', 3, 8, '')).toBe('le chat');
    expect(replaceSpan('le chat', 3, 7, '')).toBe('le');
    expect(replaceSpan('chat noir', 0, 4, '')).toBe('noir');
  });
  it('removes punctuation cleanly', () => expect(replaceSpan('oui, non', 3, 4, '')).toBe('oui non'));
});

describe('sentenceSpans', () => {
  it('returns spans in reading order', () => {
    expect(sentenceSpans('Il dort. Elle lit.')).toEqual([{ start: 0, end: 8 }, { start: 9, end: 18 }]);
  });
});
```
Run `scripts/npm.sh run test -- argus textEdit` → fail → implement → pass.

- [ ] **Step 2: `TokenText.svelte` and `WordEditor.svelte`**

`WordEditor.svelte` (props `value: string`, `onCommit: (v: string) => void`, `onCancel: () => void`): an inline `<input lang="fr" autocorrect="off" autocapitalize="off" autocomplete="off" spellcheck="false">` sized to the content (`size = max(3, value.length + 2)`), focused and selected on mount, commit on Enter or on the `OK` button, cancel on Escape; blur commits. Below it, a tiny hint `Vide = supprimer le mot`.

`TokenText.svelte`: as specified in Interfaces. Tokens are `<button type="button" class="tok …">` with `aria-label="Modifier « {text} »"`; punctuation buttons are narrower but still ≥ 44 px tall. Font 22 px, line-height 1.9 (tap space), display font for the body of the text? No — body text uses `--font-body` for legibility; display font is for headings only.

- [ ] **Step 3: `Proofreading.svelte`**

State: `state.current` (bindable), `grade = $derived(gradeText(reference.body, state.current, reference.annotation))`, `passSets = $derived(typedPassSets(grade, reference.annotation, trapWords, level))`, `passes = orderPasses(argusOrder)`, `activePass = $derived(helpStage <= 2 ? passes[state.passIndex] : null)`, `hintsLeft = HINTS_PER_STAGE[helpStage] - state.hintsUsed`, `initialErrorCount` computed once from the draft when the phase starts (store in `state` as `initialErrors: number` — add this optional field to `PlayState` in `playState.ts`).

Layout (top to bottom):
1. Header: `Relecture` + subtitle by stage: stage 1 `Les Yeux d'Argus éclairent une catégorie à la fois.`; stage 2 `Relis une catégorie à la fois, comme Argus te l'a appris.`; stage 3 `{n} pièges sont cachés dans ce texte.` (n = `initialErrors`; when 0: `Éris n'a rien trouvé à saboter cette fois. Relis une dernière fois, puis valide.`); stage 4 `À toi de jouer. Valide quand tu es sûre.`
2. Stage 1–2: pass chips in `passes` order; the active one highlighted; below, `ARGUS_LABELS[activePass].hint`. Buttons `Passe suivante` (until the last pass) — at stage 1 the text is dimmed outside the active category (`dim = helpStage === 1`).
3. Tools row: chip `Bouclier de Persée` (toggle `state.bouclier`): when on, a sentence navigator `Phrase {k} sur {n} — en partant de la fin`, buttons `Phrase précédente` (towards the start) / `Phrase suivante`, and `TokenText` gets `range = sentenceSpans(current)[k]`; starts at the last sentence. Chip `Chouette d'Athéna ({hintsLeft})` hidden at stage 4 or when `hintsLeft === 0`: picks the first error of `grade.errors` (in pair order) whose `errorKey` is not in `state.revealedKeys`; adds its key, `hintsUsed++`; highlights `typedIndex` (or, for a missing word, the typed token following the anchor) and shows `La chouette a repéré un piège ici.` (missing word: `Il manque un mot près d'ici.`). If no error remains: `La chouette ne voit plus aucun piège.` (the hint is not consumed).
4. The text (`TokenText`), with `WordEditor` rendered in place of the token being edited; committing calls `replaceSpan` and updates `state.current` (which re-derives everything). A `Modifier tout le texte` toggle swaps `TokenText` for a full textarea (same attributes as the dictation textarea) for big edits.
5. Footer: `J'ai terminé ma relecture` (always available) → `onDone()`. Before calling, if `helpStage <= 2 && state.passIndex < passes.length - 1`, show a confirm line `Il reste des passes à faire. Valider quand même ?` with `Oui, valider` / `Continuer la relecture`.

The layout uses the same `--vvh` trick as the dictation screen so the editor input stays above the keyboard; the text area scrolls (`overflow: auto`).

Persist `state` on every change (`$effect` → `savePlayState`).

- [ ] **Step 4: Wire into `Play.svelte`, manual check, gate**

`phase === 'proofreading'`: `<Proofreading reference bind:state helpStage={profile.help_stage} argusOrder={stats.argus_order} trapWords={trapWords.map(t => t.word)} level={profile.level} onDone={() => { state.phase = 'results'; save(); }} />`. Results stays a placeholder.

Run `scripts/dev.sh`; play a text; check: dimming at stage 1, chips order, editing a word updates the text without losing layout, Bouclier navigation, Chouette highlights a real error and refuses when none, `Modifier tout le texte` round-trips. Then `scripts/check.sh` → `== ALL GREEN`.

- [ ] **Step 5: Commit**

```bash
git add web
git commit -m "Add proofreading screen with Argus passes, help stages, Bouclier and Chouette

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Results screen with explanations, session submission, stats page

Spec §3.5 and §1.6: orange, never red; specific, kind explanations; Éris frames the mistakes.

**Files:**
- Create: `web/src/lib/explain.ts`, `web/src/components/Results.svelte`
- Modify: `web/src/screens/Play.svelte` (results phase + submission), `web/src/screens/Stats.svelte` (replace placeholder)
- Test: `web/src/lib/explain.test.ts`

**Interfaces:**
- Consumes: `gradeSession`, `mapAnnotation`, `homophoneHint`, `TokenError`, `SessionResult` (Task 7); `api.sessions.create`, `api.profiles.stats` (Task 9); `PlayState` (Task 10).
- Produces (`explain.ts`):
  ```ts
  export type { StatKey } from './grading/types'; // single source of truth; do not redeclare here
  export const CATEGORY_LABELS: Record<StatKey, string> = {
    'agreement:verb': "Accord du verbe avec son sujet (L'Hydre)", 'agreement:number': "Accord en nombre (L'Hydre)",
    'agreement:gender': 'Accord en genre (La Chimère)', 'agreement:participle': 'Participes passés (Protée)',
    'agreement:other': 'Accords', homophone: 'Homophones (Écho)', accent: 'Accents', punctuation_case: 'Majuscules et ponctuation', lexical: 'Orthographe des mots' };
  export { statKey as statKeyOf } from './grading/grade'; // re-export, one implementation
  export interface ExplainContext { refTokens: Token[]; annots: (AnnotToken | undefined)[]; annotation: Annotation | null }
  export function explain(e: TokenError, ctx: ExplainContext): { title: string; text: string };
  export function erisLine(catchRate: number | null, draftErrors: number, introduced: number): string;
  ```
  Templates (`E` = expected, `T` = typed, quotes are `« »`):
  - homophone with set: `« T » ou « E » ? Ici il faut « E ». {hint from homophones.json}`; `verb_ending`: `« T » ou « E » ? Après un mot comme « avoir » ou « être », c'est un participe (-é) ; quand on peut remplacer par « vendre », c'est l'infinitif (-er). Ici : « E ».`
  - agreement:verb with subject (`annots[e.refIndex].subject` → reference token text `S`, number from `morph.Number`): `« E » s'accorde avec son sujet « S » → {pluriel|singulier} → terminaison « {ending} »` where `ending` = the part of `E` after the longest common prefix with `T` (fallback: last two letters); without subject: `Le verbe « E » s'accorde avec son sujet. Cherche qui fait l'action.`
  - agreement:number: `« E » s'accorde avec « H »` where `H` = the head token's text when `annots[refIndex].head` points to a NOUN, else `avec le nom qu'il accompagne`, + ` → {pluriel|singulier}`.
  - agreement:gender: same with `→ {féminin|masculin}` (from `morph.Gender` of the reference token).
  - agreement:participle: `Participe passé « E » : avec être, il s'accorde avec le sujet ; avec avoir, seulement si le complément est placé avant.`
  - agreement:other: `« E » doit s'accorder. Regarde le mot avec lequel il va.`
  - accent: `Un accent change tout : « E », pas « T ».`
  - punctuation_case, missing punct: `Il manque « E » ici.`; extra: `« T » est en trop.`; case: `Majuscule ou minuscule : « E ».`
  - lexical missing: `Un mot a disparu : « E ».`; extra: `Un mot en trop : « T ».`; else: `Ce mot s'écrit « E ». Il rejoint tes mots-pièges pour t'entraîner.`
  - `title` = `CATEGORY_LABELS[statKeyOf(e)]`.
  - `erisLine`: `draftErrors === 0` → `Pfff. Tu n'as rien laissé passer pendant la dictée. Je reviendrai.`; `catchRate >= 0.8` → `Impossible ! Tu as déjoué presque tous mes pièges. Ça ne se reproduira pas.`; `>= 0.5` → `Hmpf. La moitié de mes pièges, déjoués. J'en cacherai mieux la prochaine fois.`; `> 0` → `Ha ! Mes pièges tiennent encore. Mais tu commences à voir clair…`; `0` → `Mes pièges sont restés bien cachés. Cette fois.`; if `introduced > 0`, append ` (Et j'en ai glissé {n} pendant ta relecture. Sournois, je sais.)`.

- [ ] **Step 1: `explain.test.ts` then `explain.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { gradeText, tokenize, mapAnnotation } from '$lib/grading';
import { explain, erisLine, statKeyOf } from './explain';
import type { Annotation, AnnotToken } from '$lib/grading/types';

const REF = 'Les fées dansent dans la clairière.';
function ann(): Annotation {
  const spec: [string, string[], Record<string, string>?, Partial<AnnotToken>?][] = [
    ['DET', ['nominal_group'], { Number: 'Plur' }, { head: 1, dep: 'det' }], ['NOUN', ['nominal_group'], { Gender: 'Fem', Number: 'Plur' }, { head: 2, dep: 'nsubj' }],
    ['VERB', ['verb'], { VerbForm: 'Fin', Number: 'Plur' }, { subject: 1 }], ['ADP', ['homophone'], {}, { homophone: 'dans' }],
    ['DET', ['nominal_group', 'homophone'], { Gender: 'Fem' }, { head: 5, homophone: 'la' }], ['NOUN', ['nominal_group'], { Gender: 'Fem' }], ['PUNCT', []],
  ];
  const tokens: AnnotToken[] = tokenize(REF).map((t, i) => ({ i, text: t.text, start: t.start, end: t.end, lemma: t.norm, pos: spec[i][0],
    morph: spec[i][2] ?? {}, head: i, dep: 'dep', categories: spec[i][1], homophone: null, subject: null, ...(spec[i][3] ?? {}) }));
  return { version: 1, model: 't', tokens, sentences: [] };
}
function ctxFor(typed: string) {
  const g = gradeText(REF, typed, ann());
  return { g, ctx: { refTokens: g.refTokens, annots: mapAnnotation(g.refTokens, ann()), annotation: ann() } };
}

describe('explain', () => {
  it('uses the subject for verb agreement', () => {
    const { g, ctx } = ctxFor('Les fées danse dans la clairière.');
    expect(explain(g.errors[0], ctx)).toEqual({ title: "Accord du verbe avec son sujet (L'Hydre)",
      text: '« dansent » s\'accorde avec son sujet « fées » → pluriel → terminaison « nt »' });
  });
  it('uses the head noun for number agreement', () => {
    const { g, ctx } = ctxFor('Le fées dansent dans la clairière.');
    expect(explain(g.errors[0], ctx).text).toBe('« Les » s\'accorde avec « fées » → pluriel');
  });
  it('explains homophones with the table hint', () => {
    const { g, ctx } = ctxFor('Les fées dansent dans là clairière.');
    expect(explain(g.errors[0], ctx).text).toMatch(/^« là » ou « la » \? Ici il faut « la »\. /);
    expect(statKeyOf(g.errors[0])).toBe('homophone');
  });
  it('explains missing words and accents', () => {
    const { g, ctx } = ctxFor('Les fées dansent dans la clairiere');
    expect(explain(g.errors[0], ctx).text).toBe('Un accent change tout : « clairière », pas « clairiere ».');
    expect(explain(g.errors[1], ctx).text).toBe('Il manque « . » ici.');
  });
});

describe('erisLine', () => {
  it('never blames the player', () => {
    expect(erisLine(null, 0, 0)).toMatch(/reviendrai/);
    expect(erisLine(1, 4, 0)).toMatch(/Impossible/);
    expect(erisLine(0.5, 4, 1)).toMatch(/Sournois/);
    expect(erisLine(0, 4, 0)).toMatch(/bien cachés/);
  });
});
```

- [ ] **Step 2: `Results.svelte`**

Props: `reference: TextFull`, `result: SessionResult`, `finalText: string`, `helpMessage: string | null`, `submitError: string | null`, `onReplay`, `onLibrary`.

Sections:
1. Heading `Relecture terminée` + Éris's line in a `.card` with a small label `Éris, agacée :` (italic, orange border).
2. Hero stats: `Pièges déjoués : {caught} sur {draft} ({pct} %)` (or `Texte parfait dès la dictée !` when `draft === 0`), `Score : {score}`, `Mots justes : {correctWords} / {totalWords}`. When `introduced.length > 0`: `Éris a profité de la relecture pour glisser {n} nouveau(x) piège(s). Ça arrive : regarde-les ci-dessous.`
3. `helpMessage` banner when present (olive background).
4. Text view: `finalText` rendered with tokens; final errors → `.err` (orange underline, `text-decoration-thickness: 3px`); caught errors → `.caught` (olive dotted underline). Tap a token → popover: for `.err`: `Attendu : « E »` + explanation text; for `.caught`: `Tu avais écrit « T », tu as corrigé en « E ». Bravo !`; missing words → a small orange `▢` inserted after the anchor token, tap → `Mot oublié : « E »`.
5. `Ce qu'Éris a tenté` grouped by `CATEGORY_LABELS` (draft + introduced errors, each with its explanation; caught ones marked `déjoué ✓`).
6. Buttons `Rejouer ce texte` and `Retour aux Parchemins`.
Nothing red; `--orange` for errors, `--olive` for caught.

- [ ] **Step 3: `Play.svelte` results phase and submission**

When `phase` becomes `results`: `result = gradeSession(reference.body, state.draft, state.current, reference.annotation, { paceLevel: state.pace })`; if `!state.submitted`, `api.sessions.create({ profile_id, text_id, pace_level: state.pace, help_stage: profile.help_stage, started_at: state.startedAt, draft: state.draft, final: state.current, result, score: result.score, catch_rate: result.catchRate })` → on success `state.submitted = true; state.sessionId = id; helpMessage = help_stage_message; save()`; on failure keep `submitted = false` and show `Les Muses n'ont pas pu noter cette partie ({detail}). Réessayer` with a retry button. `Rejouer ce texte` → `clearPlayState` + `phase = 'intro'`; `Retour aux Parchemins` → `clearPlayState` + navigate to library. Also refresh `profileStore` after submission so the new `help_stage` is used next time.

- [ ] **Step 4: `Stats.svelte`**

`Tes progrès` — subtitle `Ce qu'Éris note dans son dossier « Ses points faibles »… et ce qu'elle préfère taire.` Loads `api.profiles.stats(profileId)`.
- Card `Aide des Muses : niveau {help_stage} sur 4` with the stage description (`1 — Les Yeux d'Argus éclairent chaque catégorie.`, `2 — Les passes sont nommées, sans lumière.`, `3 — Seul le nombre de pièges est annoncé.`, `4 — Comme en classe : à toi de jouer.`).
- Table `Par catégorie`: label (`CATEGORY_LABELS`), `Pièges rencontrés` (`errors_in_draft`), `Déjoués` (`caught`), `Taux` (`catch_rate` as `{pct} %` or `—`). Only categories with `errors_in_draft > 0`; empty state `Éris n'a encore rien noté. Joue un texte !`
- `Mots-pièges`: chips `{word}` with `box` shown as `boîte {box}`; empty: `Aucun mot-piège pour l'instant.`
- `Dernières parties`: list `{title} · {finished_at as dd.mm} · {score} pts · {pct} %`.
- `Totaux`: `{sessions} parties · {score} points · {caught} pièges déjoués`.

- [ ] **Step 5: Manual check and gate**

Run `scripts/dev.sh`, play a full loop with deliberate errors in the draft, fix some in proofreading, check the results (explanations, tap reveals, Éris's line), the stats page, and that replaying works. Then `scripts/check.sh` → `== ALL GREEN`.

- [ ] **Step 6: Commit**

```bash
git add web
git commit -m "Add results screen with explanations, session submission and stats page

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Integration — Playwright happy path through the whole loop, image build verification

Spec §6.1. The e2e suite runs against the production image (`scripts/playwright.sh` builds it and starts it with an empty `/tmp/data`, so the seed import runs at startup).

**Files:**
- Create: `web/e2e/helpers.ts`, `web/e2e/happy-path.spec.ts`, `web/e2e/seed.spec.ts`
- Modify: `README.md` (add "Running the checks" with `scripts/check.sh`), `web/playwright.config.ts` only if a longer timeout is needed (the app's first model load is already covered by the compose healthcheck)

**Interfaces:**
- Consumes: every screen from Tasks 9–12; `data-testid`s: `text-card` (library), add the following in this task where missing: `pace-option-<n>` on pace cards, `dictation-textarea`, `btn-next` (`Suivant`), `btn-finish-writing` (`J'ai fini d'écrire`), `btn-next-pass` (`Passe suivante`), `btn-done-proofreading` (`J'ai terminé ma relecture`), `tok-<index>` on proofreading tokens, `word-editor` input, `results-catch-rate`, `results-score`, `btn-back-library`.
- Produces: `stubSpeech(page)` helper installed with `page.addInitScript` **before** navigation:
  ```ts
  import type { Page } from '@playwright/test';

  export async function stubSpeech(page: Page) {
    await page.addInitScript(() => {
      class U { text: string; rate = 1; lang = ''; voice: unknown = null; pitch = 1; onend: null | ((e: unknown) => void) = null; onerror: null | ((e: unknown) => void) = null; constructor(t: string) { this.text = t; } }
      const spoken: string[] = [];
      (window as any).__spoken = spoken;
      (window as any).SpeechSynthesisUtterance = U;
      (window as any).speechSynthesis = {
        speaking: false, pending: false, paused: false,
        speak(u: U) { spoken.push(u.text); setTimeout(() => u.onend?.({}), 20); },
        cancel() {}, pause() {}, resume() {},
        getVoices() { return [{ name: 'Stub fr', lang: 'fr-FR', default: true, localService: true, voiceURI: 'stub' }]; },
        addEventListener() {}, removeEventListener() {},
      };
    });
  }
  ```

- [ ] **Step 1: `seed.spec.ts` — the image serves the SPA, the API, the manifest and the seed**

```ts
import { test, expect } from '@playwright/test';

test('image serves API, SPA assets, PWA files and seed texts', async ({ request }) => {
  expect((await request.get('/api/health')).ok()).toBeTruthy();
  expect((await request.get('/manifest.json')).ok()).toBeTruthy();
  expect((await request.get('/icons/icon-192.png')).ok()).toBeTruthy();
  const texts = await (await request.get('/api/texts')).json();
  expect(texts.length).toBeGreaterThanOrEqual(25);
  const seed = texts.filter((t: { source: string }) => t.source === 'seed');
  expect(seed.length).toBeGreaterThanOrEqual(25);
  expect(seed.some((t: { credits: string }) => /trad\. /.test(t.credits))).toBeTruthy();
  const full = await (await request.get(`/api/texts/${seed[0].id}`)).json();
  expect(full.annotation.tokens.length).toBeGreaterThan(50);
  expect(full.annotation.model).toBe('core_news_lg');
});
```
(`nlp.meta.name` for `fr_core_news_lg` is `core_news_lg`; if the assertion shows a different string, assert on that exact string instead — the point is that the production image uses the large model.)

- [ ] **Step 2: `happy-path.spec.ts`**

```ts
import { test, expect } from '@playwright/test';
import { stubSpeech } from './helpers';

const REF = 'Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.';
const DRAFT = 'Les fées danse dans la clairière. Elles chante et les oiseaux les écoutent.';

test('create profile → add text → dictation → proofreading → results → stats', async ({ page }) => {
  await stubSpeech(page);
  const name = 'Test' + Date.now().toString().slice(-6);

  // Profile
  await page.goto('/');
  await page.getByRole('button', { name: /Nouveau héros/ }).click();
  await page.getByLabel('Ton prénom').fill(name);
  await page.getByLabel('Ton niveau').selectOption('10H');
  await page.getByRole('button', { name: 'Rejoindre le camp' }).click();
  await expect(page.getByRole('heading', { name: 'Les Parchemins' })).toBeVisible();

  // Custom text
  await page.getByRole('button', { name: /Ajouter un texte/ }).click();
  await page.getByLabel('Titre').fill('Les fées ' + name);
  await page.getByLabel('Texte').fill(REF);
  await page.getByRole('button', { name: /Sauvegarder/ }).click();
  await expect(page.getByRole('heading', { name: 'Les Parchemins' })).toBeVisible();
  await page.locator('[data-testid="text-card"]', { hasText: 'Les fées ' + name }).click();

  // Dictation, pace 1 (two sentences)
  await page.getByTestId('pace-option-1').click();
  await page.getByRole('button', { name: 'Commencer la dictée' }).click();
  const ta = page.getByTestId('dictation-textarea');
  await expect(page.locator('body')).not.toContainText('clairière'); // reference never shown
  await expect(page.getByTestId('btn-next')).toBeEnabled();
  await ta.fill('Les fées danse dans la clairière.');
  await page.getByTestId('btn-next').click();
  await expect(page.getByTestId('btn-finish-writing')).toBeVisible();
  await ta.fill(DRAFT);
  expect(await page.evaluate(() => (window as any).__spoken.length)).toBeGreaterThanOrEqual(2);
  await page.getByTestId('btn-finish-writing').click();

  // Proofreading: stage 1 with Argus passes; fix one of the two errors
  await expect(page.getByRole('heading', { name: 'Relecture', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Verbes', exact: true })).toBeVisible();
  const danse = page.locator('[data-testid^="tok-"]', { hasText: /^danse$/ });
  await danse.click();
  await page.getByTestId('word-editor').fill('dansent');
  await page.getByTestId('word-editor').press('Enter');
  await expect(page.locator('[data-testid^="tok-"]', { hasText: /^dansent$/ })).toBeVisible();
  await page.getByTestId('btn-done-proofreading').click();
  const confirm = page.getByRole('button', { name: 'Oui, valider' });
  if (await confirm.isVisible()) await confirm.click();

  // Results
  await expect(page.getByRole('heading', { name: 'Relecture terminée' })).toBeVisible();
  await expect(page.getByTestId('results-catch-rate')).toContainText('1 sur 2');
  await expect(page.getByTestId('results-catch-rate')).toContainText('50 %');
  await expect(page.getByTestId('results-score')).not.toContainText('NaN');
  await expect(page.getByText(/chantent/).first()).toBeVisible();

  // Stats reflect the session
  await page.getByTestId('btn-back-library').click();
  await page.getByRole('link', { name: 'Progrès' }).click();
  await expect(page.getByText(/1 parties?/).first()).toBeVisible();
  await expect(page.getByText("Accord du verbe avec son sujet (L'Hydre)").first()).toBeVisible();
});
```
Assertions on `results-catch-rate` require that element's text to be `Pièges déjoués : 1 sur 2 (50 %)`.

- [ ] **Step 3: Run the e2e suite and the whole gate**

Run: `scripts/playwright.sh` → 5 tests pass (smoke, profiles ×2, seed, happy path). If a selector fails, add the missing `data-testid` in the component rather than loosening the assertion. Then `scripts/check.sh` → `== ALL GREEN`.

- [ ] **Step 4: Verify the production compose file the way TrueNAS would run it**

Run: `docker compose -f compose.yaml up -d --build`, wait for `docker compose ps` to show `healthy`, `curl -s http://localhost:8080/api/health`, open `http://localhost:8080` in a browser (profile picker renders), then `docker compose -f compose.yaml down` (keep the `discorde-data` volume). Note the result in the commit message.

- [ ] **Step 5: Commit**

```bash
git add web README.md
git commit -m "Add end-to-end happy path and image verification

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: Playability review at iPad viewports

Spec §6.2. This task **reports**; it does not fix. The controller triages the findings afterwards.

**Files:**
- Create: `web/playwright.playability.config.ts`, `web/e2e/playability.spec.ts`
- Create: `docs/reviews/sp1/*.png` (screenshots), `docs/reviews/sp1/playability.md`

**Interfaces:**
- Consumes: `stubSpeech` and the `data-testid`s from Task 13; `scripts/playwright.sh --config playwright.playability.config.ts`.

- [ ] **Step 1: Playability config**

`web/playwright.playability.config.ts`:
```ts
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', testMatch: ['**/playability.spec.ts'], timeout: 120_000, retries: 0, reporter: [['list']], workers: 1,
  use: { baseURL: process.env.BASE_URL ?? 'http://localhost:8080', locale: 'fr-CH', ...devices['iPad Pro 11'], hasTouch: true },
  projects: [
    { name: 'ipad-landscape', use: { ...devices['iPad Pro 11 landscape'], viewport: { width: 1180, height: 820 } } },
    { name: 'ipad-portrait', use: { ...devices['iPad Pro 11'], viewport: { width: 820, height: 1180 } } },
  ],
});
```
(If the `devices['iPad Pro 11']` descriptor is not available in 1.55, use `defaultBrowserType: 'webkit'`, `isMobile: true`, `hasTouch: true`, `deviceScaleFactor: 2` and the explicit viewport.)

- [ ] **Step 2: `playability.spec.ts` — walk every screen and screenshot it**

Both projects run against the same live container, so profile names must be unique per project (otherwise the second project's profile creation gets 409 `Ce nom est déjà pris`): use `` `Léa-${testInfo.project.name}` `` for the main profile and `` `Max-${testInfo.project.name}` `` for the PIN profile in Step 17 (`PinGate` title `Code de {name}` still matches `/Code de/`).

One test per project that: creates a profile (`` `Léa-${testInfo.project.name}` ``, 10H, no PIN), and saves `docs/reviews/sp1/<project>-NN-<screen>.png` (`page.screenshot({ path: `/work/docs/reviews/sp1/${project}-01-profiles.png`, fullPage: true })`) for: `01-profiles`, `02-profile-new` (form filled), `03-library`, `04-text-new`, `05-play-intro`, `06-dictation-listening` (right after start), `07-dictation-typing` (with a draft containing 3 planted errors typed into the textarea, at pace 1 after `Suivant`), `08-proofreading-verbes` (stage 1 first pass), `09-proofreading-gn` (after `Passe suivante`), `10-proofreading-edit` (word editor open), `11-bouclier` (Bouclier on), `12-chouette` (after one hint), `13-results`, `14-results-explanation` (after tapping an error), `15-stats`, `16-settings`, `17-pin-gate` (create a second profile, `` `Max-${testInfo.project.name}` ``, with a PIN and come back to it). Use a seed text (the first card) for the full loop so the review sees real content; type a draft made from the reference body fetched through `request.get('/api/texts/{id}')` with three deliberate errors (`replace(/ent\b/, 'e')` on the first verb ending, one `à`→`a`, one accent dropped) — the draft is derived in the test, never shown by the app.

Run: `scripts/playwright.sh --config playwright.playability.config.ts` → 2 tests pass and 34 PNGs exist under `docs/reviews/sp1/`.

- [ ] **Step 3: Look at every screenshot and write `docs/reviews/sp1/playability.md`**

Open each PNG with the Read tool (it renders images). Structure of the report (in English, quoting French UI text verbatim):
1. **Setup**: image built from commit `<sha>`, viewports, the walk performed.
2. **Screen-by-screen notes** (both orientations): what works, what is cramped/unclear/broken; keyboard-safe layout judged from the portrait dictation screenshot (the textarea must not be pushed under where an on-screen keyboard would sit: bottom ~40 % of the portrait viewport).
3. **As a 13-year-old fantasy fan**: first impression, tone of Éris and the Muses, is anything babyish or preachy, does she want to play again, are the tools (Argus, Bouclier, Chouette) cool or just buttons, is the proofreading the part she remembers.
4. **As a game designer**: friction (taps to reach the dictation, dead ends, unclear affordances), clarity (does she know what to do at every step), fun (agency, mastery moments, reveal of caught errors), tone (no blame, orange not red), pacing (dictation length, chunk pauses, proofreading duration), feedback (results screen legibility, explanations quality, score meaning), and the key question: **is proofreading the core of the game, or does the dictation dominate?**
5. **Prioritised findings**: a table `P0 (blocks play) / P1 (hurts the core loop) / P2 (polish)`, each with screen, evidence (screenshot file), and a concrete suggested fix. Also list what should *not* change.
6. **Spec conformance spot-checks**: reference never visible during dictation; no red; help stages visible; textarea attributes present (verify with `page.getAttribute` in the spec and mention the result).

- [ ] **Step 4: Commit**

```bash
git add web/playwright.playability.config.ts web/e2e/playability.spec.ts docs/reviews/sp1
git commit -m "Add SP1 playability review with iPad screenshots

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Self-review notes (written by the planner)

- **Spec coverage.** §3.1 profiles (Tasks 2, 9), §3.2 library/credits/history/public-domain (Tasks 4, 6, 9), §3.3 TTS voices, spoken punctuation, chunks, 4 paces, textarea attributes, keyboard-safe layout, reference hidden (Tasks 8, 10), §3.4 Argus passes with weakest-first order, help stages 1–4 with adaptive rules, Bouclier, Chouette (Tasks 5, 11), §3.5 normalisation, alignment, classification order, caught/missed/introduced, results with explanations and subject, score never negative, mots-pièges Leitner (Tasks 5, 7, 12), §4 single container, compose, 8080, `/data`, plain HTTP, server-authoritative, client-side grading, server-side annotation, seed import at startup, migrations, repository layout, toolchain in Docker (Tasks 1–4), §5 SP1 list incl. PWA manifest/icon and basic stats page (Tasks 9, 12), §6 quality gates (Tasks 13, 14). Not in SP1 by spec: Fil d'Ariane, scan/OCR, online sources, agreement chains with confidence, rewards/XP, dragon, camp hub, social — all listed under SP2–SP4.
- **Known simplifications, recorded as decisions:** server derives stats without re-grading (decision 3); irregular plurals/genders outside `GENDER_PAIRS` classify as `lexical` (SP2's lexicon fixes this); stage-3 count is static (decision 6); trap-word promotion is server-side from the reference body.
- **Type consistency checked:** `SessionResult`/`byCategory` keys (Task 5 ↔ Task 7 ↔ Task 12), `TokenError.anchor` (Task 7 ↔ 11 ↔ 12), `ArgusPass` names (Task 5 `argus_order` ↔ Task 11), `PlayState` fields (Task 10 ↔ 11 ↔ 12; Task 11 adds optional `initialErrors`), `Step`/`Pace` (Task 8 ↔ 10), `Sentence.newParagraph` (Task 8), `data-testid`s (Task 13 ↔ 14).
