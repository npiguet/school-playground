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
