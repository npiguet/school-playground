# La Discorde

A French dictation and proofreading game for kids, set in a Greek-myth world, self-hosted
as two Docker containers (the game and its voice) and played on an iPad over plain HTTP on the
home network. The game UI is in French; this README is in English.

## 1. What it is

The player is a young demigod fighting Éris, goddess of Discord, who breaks grammatical
agreements in texts. Each hero (profile) has their own progress, dictations, proofreading tools and
rewards. The whole game is a set of painted scenes with places to tap (see §8). Main features:

- **Heroes** — several players on one server, each with a name, an emblem, a school class (5H to
  11H) and an optional 4-digit seal (not security, just to stop siblings playing on the wrong hero).
- **Les parchemins** — the shared library of texts, in the parchment tent: curated seed passages,
  texts typed or pasted at *Le pupitre*, scanned handouts (*La lentille*), and excerpts adopted from
  the Bibliothèque d'Alexandrie (*Le portail*).
- **Dictation** with 4 paces, from « Pas à pas » (one sentence at a time, unlimited replays) to
  « D'une traite » (test conditions, no replays), read aloud by the device's own French
  text-to-speech voice.
- **Proofreading** — *Les Yeux d'Argus* (a spotlight over one word category at a time: verbs,
  nominal groups, homophones, trap words), *Le Bouclier de Persée* (sentence by sentence, last to
  first), *La Chouette d'Athéna* (limited hints) and *Le Fil d'Ariane* (tap a verb, then its subject).
- **Scan a handout** — photograph a printed page (camera or photo library), OCR it with Tesseract,
  and check the recognised text against the photo before it becomes the answer key.
- **Dictée préparée** — a text can carry the date of a class test; until that date it shows as the
  Oracle's prophecy.
- **Grimoire corrompu** — a proofreading-only mode on an already-correct text, with errors planted
  by Éris and weighted toward the player's own weak spots.
- **Bibliothèque d'Alexandrie** — adopt scored excerpts from public-domain classics
  (Wikisource/Gutenberg) into the library. This is the only feature that needs internet access
  from the server.
- **Camp and progression** — XP, Éris's lieutenants (one per error family) to neutralise,
  quests from the Oracle of Delphi, a weekly goal, a break nudge after about 25 minutes of play,
  and a companion dragon that hatches and grows.
- **Music and sounds** — each place has its own music loop, with sound effects and the dictation
  voice on three separate volume channels (see §8).

## Quick start on Windows (Docker Desktop)

Run the game on your Windows PC, for trying it out or playing on the home network.

1. Start **Docker Desktop** and wait until it reports "Engine running".
2. Open **PowerShell** or **Git Bash** in the repository folder and build + start the server:

   ```bash
   docker compose up -d --build
   ```

   The first build takes several minutes (it downloads Tesseract, the large French spaCy
   language model and the voice's model, Kokoro-82M). Later builds reuse the cache. The images are
   tagged `discorde:local` and `discorde-tts:local`.
3. Open <http://localhost:8080> in Edge or Chrome. The 35 seed texts are loaded on the first start.
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
| See the logs | `docker compose logs -f` (both containers), or `docker compose logs -f tts` for the voice alone |
| Check it's healthy | open <http://localhost:8080/api/health> (answers `{"status":"ok",...}`) |
| Check the voice | open <http://localhost:8080/api/tts/health> (answers `{"voice":"ready",...}`; see "If the voice goes silent") |

Heroes, progress, custom texts and scans are stored in a Docker volume named after the folder,
e.g. `school-playground_discorde-data`, so they survive stops, rebuilds and restarts.
`docker compose down` keeps the volume; **`docker compose down -v` deletes all saved data.** The
server restarts automatically with Docker Desktop (`restart: unless-stopped`); the PC must be on
for the iPad to play.

The voice keeps every line it has made in a second volume, `…_discorde-tts-cache` (up to 2 GB);
deleting it only means the lines are made again.

## 2. Deploy on TrueNAS SCALE 25.10

The NAS runs the same two images as the PC. TrueNAS can't build them from its Apps screen, so you
build them on the PC, copy them over, and install them as a custom app from YAML.

### Build the images and copy them to the NAS

On the Windows PC with Docker Desktop, from the repo root, build with a tag that names the version
(a date works well, and makes rolling back easy):

```bash
docker build -t discorde:2026-09-27 .
docker build -t discorde-tts:2026-09-27 tts
docker save discorde:2026-09-27 discorde-tts:2026-09-27 | gzip > discorde-2026-09-27.tar.gz
```

The game's image takes about 3.2 GB on disk once loaded (mostly the `fr_core_news_lg` spaCy model and
Tesseract), and the voice's image takes about 1.3 GB (its model and the ONNX runtime); the compressed
file is much smaller. Copy the `.tar.gz` onto the NAS, e.g. into an SMB
share or with `scp`, then load it from a shell on the NAS (**System → Shell**, or SSH as the admin
user):

```bash
sudo docker load -i /mnt/<pool>/<share>/discorde-2026-09-27.tar.gz
sudo docker image ls 'discorde*'
```

### Choose the data dataset and the port

- **Data:** create a dataset for the game's data, e.g. `/mnt/<pool>/apps/discorde` (**Datasets →
  Add Dataset**). It holds the whole state of the game (§4) and is what you snapshot and back up.
  The container runs as root, so no special permissions are needed on it.
- **Port:** the game listens on 8080 inside the container. The left-hand side of `ports` is the
  port the iPad uses; keep `8080` if nothing else on the NAS uses it, otherwise pick another one
  (e.g. `"8090:8080"` and then `http://<nas-ip>:8090`).

### Install via YAML

In the TrueNAS UI: **Apps → Discover Apps → ⋮ (top right) → Install via YAML**, give the app a
name (e.g. `discorde`), and paste:

```yaml
services:
  discorde:
    image: discorde:2026-09-27
    pull_policy: never
    container_name: discorde
    ports:
      - "8080:8080"
    volumes:
      - /mnt/<pool>/apps/discorde:/data
    depends_on:
      - tts
    restart: unless-stopped
  tts:
    image: discorde-tts:2026-09-27
    pull_policy: never
    container_name: discorde-tts
    volumes:
      - discorde-tts-cache:/cache
    restart: unless-stopped
volumes:
  discorde-tts-cache:
```

This is `compose.yaml` from the repo with the named data volume swapped for the dataset and the
build lines removed. The voice has no port: only the game talks to it. Its cache stays a named
volume (nothing in it needs a backup). `pull_policy: never` tells Docker to use the images you
loaded instead of looking for them on Docker Hub. Everything else comes from the images:

- **Health check:** built into the image (`GET /api/health` every 10 s, 90 s allowed for startup).
  The app shows as healthy once the language model is loaded and the seed texts are imported. The
  voice has its own (`GET /health` inside its container, 120 s allowed to load the model); the game
  starts without waiting for it.
- **Environment variables:** all have defaults, so none are needed. The ones you might change:

  | Variable | Default | What it does |
  |---|---|---|
  | `DISCORDE_TZ` | `Europe/Zurich` | Time zone for "today", the Oracle's week and the weekly goal |
  | `DISCORDE_SEED` | `1` | `1` imports the seed texts at startup (new ones only; nothing is overwritten) |
  | `DISCORDE_TTS_URL` | `http://tts:8000` | Where the game finds its voice (the `tts` service) |
  | `TTS_THREADS` | `4` | (on `tts`) CPU threads the voice may use, so the game stays responsive while a dictation is prepared |
  | `TTS_CACHE_MB` | `2048` | (on `tts`) the voice's cache size, least recently used lines dropped first |

  The others (`DISCORDE_DATA_DIR=/data`, `DISCORDE_CONTENT_DIR=/app/content`,
  `DISCORDE_STATIC_DIR=/app/static`, `SPACY_MODEL=fr_core_news_lg`) describe the image's layout;
  leave them alone. `DISCORDE_ALEXANDRIA_OFFLINE_DIR` and `DISCORDE_TEST_HOOKS` are for the test
  suite only; never set them in production. `TTS_STUB` is for the test suite only.
- **RAM:** the container uses about 1.1 GB once started (measured at rest, with the language model
  loaded). Analysing a new text, a scan or an Alexandria adoption runs that model again, so leave it
  some room above that.

### Update to a new version

The data lives in the dataset, not in the container, so an update keeps everything:

1. Build and load the new images under a new tag, as above (e.g. `discorde:2026-10-15` and
   `discorde-tts:2026-10-15`).
2. **Apps → discorde → Edit**, change both `image:` lines to the new tag and save. TrueNAS recreates
   the containers on the new images; database changes (migrations) are applied at startup.
3. Once it's healthy and the game works, remove the old images (`sudo docker image rm
   discorde:2026-09-27 discorde-tts:2026-09-27`). Until then, going back is the same edit with the
   old tag.

Take a snapshot of the dataset before updating (§4) so you can roll the data back too.

### If the voice goes silent

The game never falls back to the device's own voice. When it cannot get a line from its voice, the
dictation stops on a card where Éris boasts that she has silenced it and asks the player to fetch a
parent. The card's small line says why:

- « voix : serveur injoignable » — the game could not reach its voice: the `tts` container is stopped,
  still starting (loading the model takes a few seconds, up to a minute or two on a slow NAS), or the
  network between the two containers is down;
- « voix : erreur du serveur » — the voice answered with an error (see its logs).

Then:

1. Open `http://<server>:8080/api/tts/health`. `{"voice":"ready","engine":"kokoro-82m-v1.0-onnx-direct"}`
   means the voice is fine again: tap « Réessayer » on the card. `{"voice":"loading"}`: wait a minute
   and try again. `{"voice":"unreachable"}`: the container is not running. `{"voice":"error"}`: it
   could not load its model; its logs say why.
2. Check the container: on TrueNAS, **Apps → discorde**, the `tts` container's state (restart the app
   if it is stopped or crash-looping); with Docker Desktop, `docker compose ps` and
   `docker compose restart tts`.
3. Read its logs: TrueNAS, the app's **Logs** for the `tts` container; Docker Desktop,
   `docker compose logs --tail 100 tts`. A line such as `tts: 84 characters at 0.90: 6.10 s of speech
   in 1.30 s` is a line made; `the voice could not load` is followed by the reason.
4. Once the health answers `ready`, « Réessayer » on the card carries on where the dictation stopped,
   with everything typed so far. « Retour au camp » keeps the draft too: the dictation resumes from the
   text's parchment later.

## 3. Play on the iPad

Open `http://<nas-ip>:8080` in Safari.

**Add to Home Screen** (the iPad in French): tap the **Partager** button (the square with an
upward arrow, at the top right of Safari), then **« Sur l'écran d'accueil »**, then **Ajouter**.
English equivalent: **Share** → **"Add to Home Screen"** → **Add**.

The game then has its own icon, named « La Discorde », and opens full screen without Safari's
address bar, like an app. It is made for landscape: held upright, the iPad shows « Tourne ton
iPad ».

Everything works over plain HTTP on the LAN, including taking a photo of a handout with the
camera for a scan (the file picker's camera doesn't need a secure page).

**The dictation voice.** The game reads dictations with the iPad's own French voice, so its quality
depends on the voices installed. Download a good one first: **Réglages → Accessibilité → Contenu
énoncé → Voix → Français** (Settings → Accessibility → Spoken Content → Voices → French), and pick
one marked "Enhanced"/"Premium" (« améliorée »). Then choose it in the game: in the hero's cabin,
tap **« La lyre »** and pick it under « La voix de la dictée » (« Écouter un essai » plays a sample,
« Enregistrer » saves it for that hero). If no French voice is installed, the lyre says so and
repeats that path.

**The keyboard.** The game turns off autocorrect, capitals and spell-check in the dictation and
proofreading fields. If word suggestions still show above the keyboard, turn off predictive text:
**Réglages → Général → Clavier → Prédiction** (Settings → General → Keyboard → Predictive).

**Sound.**

- The iPad only lets a page make sound after a tap: the title page is silent until « Entrer », and
  after a reload or coming back to the game the sound returns with the first tap anywhere.
- **Silent mode mutes the music and the sound effects.** Check it's off: open Control Centre (swipe
  down from the top-right corner) and make sure the bell is not crossed out; older iPads have a
  switch on the side instead. Whether the dictation voice still speaks in silent mode is up to the
  iPad.
- Each hero has three volumes, for the music, the sound effects and the voice, each with its own
  « Sourdine » (mute): in the lyre under « Les sons du camp », or from the lyre button at the top
  of every scene. On the iPad the voice's slider has no effect (iPadOS ignores it): use the iPad's
  volume buttons for the voice. With the voice muted, nothing is read aloud and someone has to read
  the dictation to the player.

## 4. Backups

All state lives in `/data` (the dataset on TrueNAS, the Docker volume on the PC):

- `discorde.sqlite3` — the database: heroes, progress, texts, rewards, settings. It runs in WAL
  mode, so while the game is running there may also be `discorde.sqlite3-wal` and
  `discorde.sqlite3-shm` next to it; they are part of the database.
- `scans/` — the photos of scanned handouts, one folder per scan.

Nothing else needs backing up: the seed texts, art and sounds are in the image.

**TrueNAS snapshots** are the simplest backup. Add a **Data Protection → Periodic Snapshot Task**
on the game's dataset (e.g. daily, kept for a few weeks), and a replication or cloud-sync task if
you want a copy off the NAS. A ZFS snapshot captures the whole dataset at one instant, so the
database in it is consistent even while the game runs (SQLite recovers from it like from a power
cut).

**A copy of the database file** while the game runs: don't copy `discorde.sqlite3` alone (it can
miss what's still in the `-wal` file). Let SQLite write a consistent copy, then take that:

```bash
sudo docker exec discorde python -c "import sqlite3; s = sqlite3.connect('/data/discorde.sqlite3'); d = sqlite3.connect('/data/discorde-backup.sqlite3'); s.backup(d); d.close()"
```

`discorde-backup.sqlite3` then sits in the dataset, next to the database. Or stop the app first
(**Apps → discorde → Stop**) and copy the whole folder: once stopped, the files are consistent.

On the Windows PC, the same `docker exec` command works (without `sudo`; in Git Bash run
`export MSYS_NO_PATHCONV=1` first), and `docker cp discorde:/data ./discorde-data-backup` copies
the whole volume out.

**Restore:**

1. Stop the app.
2. Either roll the dataset back to a snapshot (**Datasets → the dataset → Snapshots → Rollback**;
   this discards everything written after it), or replace the files: put the saved database back
   as `discorde.sqlite3`, **delete any `discorde.sqlite3-wal` and `discorde.sqlite3-shm`** left
   from the current database, and put back `scans/`.
3. Start the app.

## 5. Development

Everything runs in Docker; nothing else needs installing on the host but **Docker Desktop**. On
Windows, run the scripts from **Git Bash** (it comes with Git for Windows). Wrapper scripts:

- `scripts/npm.sh <args>` — npm inside `web/` (e.g. `scripts/npm.sh run test`). The first run
  installs `node_modules` into a Docker volume, and again whenever `web/package-lock.json` changes.
- `scripts/pytest.sh <args>` — pytest inside `server/` (e.g. `scripts/pytest.sh -v`)
- `scripts/tts-pytest.sh <args>` — pytest inside the voice service's test image (`tts/`), model
  included (`-m "not model"` skips the tests that load it)
- `scripts/py.sh <cmd...>` — any command inside the server dev image, in `server/`
- `scripts/dev.sh` — the dev stack: Vite on <http://localhost:5173> (hot reload, proxying `/api`)
  and `uvicorn --reload` on port 8080, and the voice (`tts`, the real model). It uses the small
  spaCy model (`fr_core_news_sm`) and its own data volume, separate from the game's. Stop the
  quick-start container first, or set `DEV_API_PORT`, since both want port 8080.
- `scripts/playwright.sh [npx playwright args]` — builds the production images, starts them with an
  empty data folder (so the seed import runs) and the voice as its stub (silent lines as long as
  the real ones, no model), runs the Playwright e2e suite against them, and tears them down. E.g.
  `scripts/playwright.sh e2e/seed.spec.ts`. On a failure, the servers' logs are saved to
  `web/test-results/app.log` and `tts.log`.
- `scripts/check.sh` — the gate, which must be green before every commit: server pytest, the
  voice's pytest, `svelte-check` plus a type-check of the e2e specs, vitest, both production image
  builds, then the e2e suite (`scripts/playwright.sh`). Run it from the repo root.

**Playwright never retries a failed test**, with one exception: a test whose browser crashed. WPE
WebKit's web process crashes about once in 1 300 test executions, an upstream fault
(`docs/reviews/ui3/webkit-crash-upstream.md`). Such a test fails with « browser crashed (upstream
WebKit) » (`web/e2e/crashGuard.ts`; a Playwright worker or browser segfault counts too), and when
crashes are the only failures of the run, `web/scripts/playwright-crash-retry.mjs` runs those tests
once more (with the rest of their serial group). Any other failure ends the run red, with no retry.

**One Playwright run at a time.** `scripts/playwright.sh` waits on a machine-wide lock
(`discorde-e2e.lock` in the host temp dir; a holder that died is taken over) for up to
`PLAYWRIGHT_LOCK_WAIT` seconds (default 7200). The audio tool (`tools/audio/run_docker.sh`, which
rebuilds the sound files) takes the same lock while ffmpeg runs. Builds and unit tests stay
parallel.

**Two checkouts side by side** (e.g. two git worktrees): prefix any script with `STACK=<id>`, e.g.
`STACK=b scripts/check.sh`. That checkout gets its own compose project, app image, voice image,
server dev image and `node_modules` volume (`discorde-b…`); unset, the names stay `discorde`. The
scripts refuse `STACK=tts` and any id ending in `-tts`: that stack's app image would take the name of
another stack's voice image (`discorde-tts:local` is the main checkout's). A second dev stack also
needs `DEV_API_PORT`/`DEV_WEB_PORT`. Two e2e runs can't overlap (see the lock), but a run is
lighter with fewer workers: `PW_WORKERS` sets them (8 when unset), e.g.
`STACK=b PW_WORKERS=4 scripts/check.sh`. `PLAYWRIGHT_VERSION` in `scripts/lib.sh` pins the e2e
image and must equal `@playwright/test` in `web/package.json`; a manual `docker compose -f
compose.e2e.yaml …` needs it exported first (`source scripts/lib.sh`).

**On Windows / Git Bash:** the scripts set `MSYS_NO_PATHCONV=1` themselves before calling
`docker`/`docker compose`, to stop MSYS from rewriting container paths like `/work/web` into
`C:\...\work\web`. If you invoke `docker` directly outside the scripts, set `MSYS_NO_PATHCONV=1`
yourself first.

## 6. Content & licences

- **Seed passages** (`content/seed/`) — 35 curated dictation texts. Every non-original passage is
  public-domain: both the original author and the translator (when there is one) died before 1956
  (Swiss law: life + 70 years). See `content/seed/README.md` for the full source list, death years
  and editing notes.
- **Lexique 3.83** (`content/lexique/`) — the vendored, trimmed lexicon that powers word-form and
  homophone lookups is derived from Lexique 3.83 (New, Pallier, Brysbaert & Ferrand), licensed
  CC BY-SA 4.0; see `content/lexique/LICENSE.md` for attribution and how the derived file was built.
- **Art** — every image is generated locally with Krea 2 Turbo; see `docs/art/style-guide.md` for
  the direction, palette and character sheets.
- **Sounds** — every music loop and sound effect is CC0 (public domain dedication), credited anyway
  with its source, author and changes in `ASSETS-LICENSES.md`. `tools/audio/` fetches, checks and
  processes them.
- **Fonts** — Cinzel, Alegreya and Literata, self-hosted under the SIL Open Font License 1.1
  (`ASSETS-LICENSES.md`, licence text next to the files in `web/public/fonts/`).
- **Public-domain rule** for any text added to the library, seed or Alexandria: author and
  translator must both have died before 1956; if unknown, reject it.

The game shows these credits to players in the lyre (« Merci à ceux qui ont aidé le camp »).

## 7. Known limitations

- Plain HTTP only, on the home network. There is no HTTPS and no offline mode: the iPad needs to
  reach the server to play.
- The scenes' tilt parallax (the picture shifting as the iPad tilts) probably stays off on the
  iPad: Safari only gives motion sensors to HTTPS pages. Dragging a finger across a scene still
  moves it.
- Text-to-speech voice quality depends entirely on the device's installed voices — pick an
  "Enhanced" French voice where available (§3).
- On the iPad the voice's volume slider does nothing; the device's volume buttons set it (§3).
- OCR (Tesseract, French) is for **printed** handouts only; it does not read handwriting.
- Alexandria needs the server to reach Wikisource and Project Gutenberg; everything else works
  without internet.

## 8. World and progression

- **Scenes, not pages.** The game opens on a title scene (« Entrer »), then the heroes' shields:
  pick a hero, see them all, or forge a new one. Each place is a painted scene with labelled places
  to tap; tapping one opens its panel over the scene. A strip at the top of every scene holds the
  hero chip (opens the hero panel), the XP laurel, the dragon and the lyre button (the sound plate:
  the three channels and « Ouvrir la lyre »). The first visit to each place is a short tour by its
  character; « Refaire les visites du camp » in the lyre replays them.
- **The camp** (`#/p/:id/camp`) is the hub once a hero is picked. Its places:
  - « Le nid du dragon » — the dragon's nest: its growth and care (tints).
  - « La tente des parchemins » — the library: « Tes parchemins » (the shelves, where a text is
    picked for a battle), « Le pupitre » (type or paste a text), « La lentille » (scan a handout)
    and « Le portail » (Alexandria).
  - « Le chemin de Delphes » — the temple: « La Pythie » (the Oracle's week) and « Le mur des
    quêtes ».
  - « La tente de guerre » — Éris's lieutenants on their portrait wall, « Le dossier d'Éris » and
    « Le bestiaire ».
  - « Ta cabane » — « Tes trésors » (every reward), « Ton journal » (the hero's all-time counts, the
    former stats screen) and « La lyre » (the settings: dictation voice, the three sound channels,
    class, weekly goal, seal, tours, credits).
  - « Le sentier de la bataille » — the way to Éris herself, once she shows up.
- **Battles.** A text opens the battle stage (`#/p/:id/play/:textId`; the Grimoire at
  `#/p/:id/grimoire/:textId`): choose a pace, write the dictation, proofread it with the heroes'
  tools, then the victory count and « Revoir » to go over each trap.
- **Oracle week** — Delphi's three scrolls reset every ISO week (Monday–Sunday, local time in
  `Europe/Zurich`, configurable via `DISCORDE_TZ`). The week's reward is shown before any scroll is
  opened (no gamble), and a chosen quest stays open until the *next* consultation actually replaces
  it, not merely when a new week begins.
- **Mastery rule** — an error family ("lieutenant") is neutralised once the player's most recent
  qualifying days reach at least 3 distinct days and 10 draft errors, with a catch rate of at least
  80% over that window. Neutralisation is permanent: nothing is ever taken away, a later dip only
  surfaces as a suggested quest.
- **Rewards are announced in advance** — every relic, dragon tint, divine gear and cabin decor piece
  is on the cabin's trophy shelf (`#/p/:id/cabane?panel=tresors`) with how to win it, before it can
  be earned; nothing is a gamble.
- **Art and sound** are served from the same origin: `web/public/art` (WebP, about 5.2 MB) and
  `web/public/audio` (14 AAC `.m4a` files, about 3.8 MB), played through Howler. Dragon tints are a
  CSS `hue-rotate` filter on one cut-out. The sound settings are saved per hero on the server (and
  remembered on the device for the title scene, before a hero is picked).
- **`DISCORDE_TEST_HOOKS=1`** enables an `X-Discorde-Day` request header on `POST /api/sessions`,
  letting the e2e suite fast-forward the multi-day mastery and weekly-goal logic. It's set only in
  `compose.e2e.yaml` (and under pytest) — **never** set it in production; without it the header is
  ignored.
