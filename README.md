# La Discorde

A French dictation and proofreading game for kids, set in a Greek-myth world, self-hosted
as a single Docker container. The game UI is in French; this README is in English.

## 1. What it is

The player is a young demigod fighting Éris, goddess of Discord, who breaks grammatical
agreements in texts. Each profile has its own library, dictations, proofreading tools and
progression. Main features:

- **Profiles** — multiple players on one server, each with a name, avatar, school level and
  an optional 4-digit code (not security, just to stop siblings playing on the wrong profile).
- **Les Parchemins** — the shared library of texts: curated seed passages, texts typed/pasted
  by a child, scanned handouts, and adoptions from the Bibliothèque d'Alexandrie.
- **Dictation** with 4 paces, from sentence-by-sentence with unlimited replays up to full
  test conditions (auto-advance, no replays), read aloud with the browser's text-to-speech.
- **Argus proofreading** (*Les Yeux d'Argus*) — spotlight passes over one word category at a
  time (verbs, nominal groups, homophones, *mots-pièges*), plus *Le Bouclier de Persée*
  (sentence-by-sentence, last to first), *La Chouette d'Athéna* (limited hints) and *Le Fil
  d'Ariane* (tap a verb then its subject).
- **Scan a handout** — photograph a printed page (camera or file upload), OCR it with
  Tesseract, and verify the recognised text against the photo before it becomes the answer key.
- **Dictée préparée** — a text can carry a due date for a class test; it appears as the
  Oracle's prophecy until the date passes.
- **Grimoire corrompu** — a proofreading-only mode on an already-correct text, with errors
  planted by Éris and weighted toward the player's own weak spots.
- **Bibliothèque d'Alexandrie** — adopt scored excerpts from public-domain classics
  (Wikisource/Gutenberg) into the personal library.
- **Camp and progression** — XP, lieutenant quests (one per error family), permanent mastery
  tracking, a weekly goal, a break nudge, and a companion dragon that grows through stages.

## Quick start on Windows (Docker Desktop)

Run the game on your Windows PC, for trying it out or playing on the home network.

1. Start **Docker Desktop** and wait until it reports "Engine running".
2. Open **PowerShell** or **Git Bash** in the repository folder and build + start the server:

   ```bash
   docker compose up -d --build
   ```

   The first build takes several minutes (it downloads the French spaCy model, ~570 MB, and
   Tesseract). Later builds reuse the cache. The image is tagged `discorde:local`.
3. Open <http://localhost:8080> in Edge or Chrome. The 35 seed texts are loaded on first start.
4. **Play from the iPad** on the same Wi-Fi: find the PC's IP address (`ipconfig`, "IPv4
   Address", e.g. `192.168.1.20`) and open `http://192.168.1.20:8080` in Safari. If it doesn't
   load, allow the port through the Windows firewall once (PowerShell **as administrator**):

   ```powershell
   New-NetFirewallRule -DisplayName "La Discorde 8080" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow -Profile Private
   ```

   Your Wi-Fi network must be set to *Private* in Windows for this rule to apply.

Everyday commands (from the repository folder):

| What | Command |
|---|---|
| Stop the server | `docker compose stop` |
| Start it again | `docker compose start` |
| Update after pulling new code | `docker compose up -d --build` |
| See the logs | `docker compose logs -f` |
| Check it's healthy | open <http://localhost:8080/api/health> |

Profiles, progress, custom texts and scans are stored in the Docker volume `discorde-data`,
so they survive stops, rebuilds and restarts. `docker compose down` keeps the volume;
**`docker compose down -v` deletes all saved data.** The server restarts automatically with
Docker Desktop (`restart: unless-stopped`); the PC must be on for the iPad to play.

## 2. Deploy on TrueNAS SCALE 25.10

### Build the image

On the Windows PC with Docker Desktop, from the repo root:

```bash
docker build -t discorde:latest .
```

Then get it onto the NAS, either by pushing to a registry the NAS can pull from, or by
transferring the image directly:

```bash
docker save discorde:latest | gzip | ssh <user>@<nas-ip> docker load
```

Alternatively, build directly on the NAS from a git checkout of this repo (`docker build -t
discorde:latest .` works the same there, given Docker/apps support).

The image is large (~3.2 GB, mostly the `fr_core_news_lg` spaCy model and Tesseract), and the
container needs **roughly 1.5–2 GB of RAM** to load that model comfortably.

### Install via YAML

In the TrueNAS SCALE UI: **Apps → Discover Apps → ⋮ → Install via YAML**, and paste:

```yaml
services:
  discorde:
    image: discorde:latest
    container_name: discorde
    ports:
      - "8080:8080"
    volumes:
      - /mnt/<pool>/<dataset>/discorde-data:/data
    environment:
      DISCORDE_DATA_DIR: /data
      DISCORDE_CONTENT_DIR: /app/content
      DISCORDE_STATIC_DIR: /app/static
      SPACY_MODEL: fr_core_news_lg
      DISCORDE_SEED: "1"
      DISCORDE_TZ: Europe/Zurich
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8080/api/health').status==200 else 1)"]
      interval: 10s
      timeout: 3s
      start_period: 90s
      retries: 5
```

Point the host-path volume at a dataset you back up (see §5); a named Docker volume works
just as well if you don't need direct filesystem access to it. `DISCORDE_SEED=1` (the
default) imports the seed passages on first start; the other environment variables shown are
also the built-in defaults and only need to be listed if you want to change one of them (a
useful one is `DISCORDE_ALEXANDRIA_OFFLINE_DIR`, for pointing Alexandria at local fixtures
instead of the network).

## 3. Play on the iPad

Open `http://<nas-ip>:8080` in Safari.

**Add to Home Screen** (French UI): tap the **Partager** button (the square with an upward
arrow), then **« Sur l'écran d'accueil »**, then **Ajouter**.
English equivalent: tap the **Share** button (square with an up arrow) → **"Add to Home
Screen"** → **Add**.

Everything works over plain HTTP on the LAN, including camera capture for scanning handouts
(`<input type="file" capture="environment">` doesn't need a secure context). Two features
need HTTPS: the offline service-worker cache, and in-browser microphone recording. Until
HTTPS is set up (§4), record with the iPad's Voice Memos app and upload the resulting file
instead.

iPad autocorrect doesn't matter for the dictation textarea: the game disables it
(`autocorrect="off" autocapitalize="off" autocomplete="off" spellcheck="false"`). If word
suggestions still pop up above the keyboard, turn off **Predictive** text in Settings →
General → Keyboard → Predictive.

On a laptop, Edge or Chrome both work fine. Wherever you pick the reading voice (in the
game's own settings), prefer a voice whose name contains "Natural"/"Premium"/"Enhanced" — on
the iPad, download one first at **Réglages → Accessibilité → Contenu énoncé → Voix →
Français** (Settings → Accessibility → Spoken Content → Voices → French).

## 4. Optional HTTPS later

Plain HTTP is the baseline and everything except offline mode and in-browser mic recording
works without it. If you want HTTPS later:

- **Caddy** in front of the container, with your own domain and DNS-01 challenge (no port
  forwarding needed) — a couple of lines of Caddyfile reverse-proxying to `discorde:8080`.
- **Tailscale serve**, if the NAS is already on your tailnet — `tailscale serve https / http://localhost:8080`
  gives you a trusted HTTPS URL with no certificate management.

Either way, only the reverse proxy changes; the container itself keeps listening on 8080.

## 5. Backups

All state lives in the `/data` volume: the SQLite database (`discorde.sqlite3`) and the
scanned-handout photos (`scans/`). Nothing else needs backing up.

Copy it out (container stopped, or at least while idle, to get a consistent SQLite file):

```bash
docker cp discorde:/data ./discorde-data-backup
```

or, if you mounted a host path/dataset directly, back that path up with your regular TrueNAS
snapshot/replication task.

Restore by stopping the container, replacing the contents of the volume/dataset with the
backed-up copy, and starting the container again.

## 6. Development

All toolchains run in Docker; nothing needs to be installed on the host. Wrapper scripts:

- `scripts/npm.sh <args>` — npm inside `web/` (e.g. `scripts/npm.sh install`, `scripts/npm.sh run test`)
- `scripts/pytest.sh <args>` — pytest inside `server/` (e.g. `scripts/pytest.sh -v`)
- `scripts/py.sh <cmd...>` — any command inside the server dev image, in `server/`
- `scripts/playwright.sh [npx playwright args]` — builds the production image and runs the e2e suite against it
- `scripts/check.sh` — the CI-like gate: pytest + svelte-check + vitest + docker build + e2e; must be green before every commit
- `scripts/dev.sh` — starts the dev stack: Vite on `http://localhost:5173` (proxying `/api`) and `uvicorn --reload` on `8080`

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

Playwright never retries a failed test. The one exception is a test whose browser crashed: WPE
WebKit's web process crashes about once in 1 300 test executions, an upstream fault
(`docs/reviews/ui3/webkit-crash-upstream.md`). Such a test fails with « browser crashed (upstream
WebKit) » (`web/e2e/crashGuard.ts`, which every spec takes `test` from), and when that is the only
kind of failure in the run, `web/scripts/playwright-crash-retry.mjs` runs those tests once more
(with the rest of their serial group). Any other failure ends the run red, with no retry.

**Two checkouts side by side** (e.g. two git worktrees): prefix any script with `STACK=<id>`, e.g.
`STACK=b scripts/check.sh`. It gets its own compose project, app and server dev images and node_modules volume
(`discorde-b…`, `npm ci` on first use); unset, the names stay `discorde`. A second dev stack also
needs `DEV_API_PORT`/`DEV_WEB_PORT`. Two e2e runs at once share the host, so give the second one
fewer Playwright workers with `PW_WORKERS` (8 when unset), e.g. `STACK=b PW_WORKERS=4 scripts/check.sh`;
`compose.e2e.yaml` passes it into the Playwright container. `PLAYWRIGHT_VERSION` in `scripts/lib.sh` pins the e2e image.
A manual `docker compose -f compose.e2e.yaml …` needs it exported first (`source scripts/lib.sh`).
Only one Playwright run executes at a time on the machine, whatever the stack: `scripts/playwright.sh` waits on a lock in the host
temp dir (`discorde-e2e.lock`, a dead holder is taken over) for up to `E2E_LOCK_WAIT` seconds (default 7200); builds and unit tests stay parallel.

**On Windows / Git Bash:** the scripts set `MSYS_NO_PATHCONV=1` themselves before calling
`docker`/`docker compose`, to stop MSYS from rewriting container paths like `/work/web` into
`C:\...\work\web`. If you invoke `docker` directly outside the scripts, set
`MSYS_NO_PATHCONV=1` yourself first.

## 7. Content & licences

- **Seed passages** (`content/seed/`) — curated dictation texts. Every non-original passage
  is public-domain: both the original author and the translator (when there is one) died
  before 1956 (Swiss law: life + 70 years). See `content/seed/README.md` for the full source
  list, death years and editing notes.
- **Lexique 3.83** (`content/lexique/`) — the vendored, trimmed lexicon that powers word-form
  and homophone lookups is derived from Lexique 3.83 (New, Pallier, Brysbaert & Ferrand),
  licensed CC BY-SA 4.0; see `content/lexique/LICENSE.md` for attribution and how the derived
  file was built.
- **Art** — every visual asset is generated locally with Krea 2 Turbo; see
  `docs/art/style-guide.md` for the direction, palette and character sheets.
- **Public-domain rule** for any text added to the library: author and translator must both
  have died before 1956; if unknown, reject it.

## 8. Known limitations

- Runs over plain HTTP by default; offline mode and in-browser microphone recording need
  HTTPS (§4), everything else doesn't.
- Text-to-speech voice quality depends entirely on the device/browser's installed voices —
  pick an "Enhanced"/"Natural" French voice where available (§3).
- OCR (Tesseract, French) is for **printed** handouts only; it does not read handwriting.

## 9. World and progression

- **The camp is the home screen** once a profile is picked: XP/rank, the weekly goal, the
  companion dragon, and links out to Delphes' Oracle, the quest board, the bestiary, Éris's
  dossier and the cabin.
- **Oracle week** — Delphes' three scrolls reset every ISO week (Monday–Sunday, local time in
  `Europe/Zurich`, configurable via `DISCORDE_TZ`). The week's reward is shown before any
  scroll is opened (no gamble), and a chosen quest stays open until the *next* consultation
  actually replaces it, not merely when a new week begins.
- **Mastery rule** — an error family ("lieutenant") is neutralised once the player's most
  recent qualifying days reach at least 3 distinct days and 10 draft errors, with a catch rate
  of at least 80% over that window. Neutralisation is permanent: nothing is ever taken away,
  a later dip only surfaces as a suggested quest.
- **Rewards are announced in advance** — every relic, dragon tint, divine gear and cabin decor
  piece is listed in the cabin (`#/p/:id/cabane`), including how to unlock it, before it can be
  earned; nothing is a gamble.
- **`DISCORDE_TEST_HOOKS=1`** enables an `X-Discorde-Day` request header on `POST
  /api/sessions`, letting the e2e suite fast-forward the multi-day mastery and weekly-goal
  logic. It's set only in `compose.e2e.yaml` (and under pytest) — **never** set it in
  production; without it the header is ignored.
- **Art** for the camp/world screens is served from `web/public/art` (same origin, ≈1.9 MB
  total). Dragon tints are a CSS `hue-rotate` filter on one cut-out, and relics/gear/decor are
  CSS medallions — no extra art is generated for them.
- **Sound** is synthesised locally with WebAudio, no audio files shipped; mute it from
  **Réglages** or the speaker icon in the TopBar.
