# La Discorde

A French dictation and proofreading game for kids, set in a Greek-myth world, self-hosted
as two Docker containers (the game and its voice) and played on an iPad over plain HTTP on the
home network. The game UI is in French; this README is in English.

## 1. What it is

The player is a young demigod fighting Éris, goddess of Discord, who breaks grammatical agreements in
texts: she writes a dictation read aloud by the game's voice, proofreads it with a choice of review
aids, and grows a companion dragon from the glory earned. Each hero (profile) keeps their own
progress, settings and rewards. The game is two containers (the game, a FastAPI server that also
serves the Svelte single-page app, and its voice) played in Safari on an iPad over plain HTTP on the
home network. **How to play, every place of the camp and every rule as the child sees it are in
[MANUEL.md](MANUEL.md)** (in French, written for the player); this README is the technical side.

What matters technically:

- **Heroes** — several players on one server; a hero's optional 4-digit seal is not security, it only
  stops siblings playing on the wrong hero.
- **Texts** — a shared library: 35 curated seed passages (`content/seed/`), texts typed at the desk,
  scanned handouts and Alexandria excerpts. Every text is analysed once, when it is added, by spaCy's
  French transformer model (`fr_dep_news_trf`) on the server; the grading runs in the browser
  against that annotation (accepting the 1990 spelling reform's variants, `content/reform1990.json`).
- **The voice** — Kokoro-82M's French voice in its own container (`tts/`), synthesising a line at a
  time and caching it; the game never falls back to the device's voice (§2, "If the voice goes
  silent").
- **Scans** — photos of a printed handout, OCR'd by Tesseract (French) on the server, then checked by
  the player against the photo before they become the answer key. Printed text only.
- **Bibliothèque d'Alexandrie** — scored excerpts of public-domain classics fetched from Wikisource
  and Project Gutenberg: the only feature that needs internet access from the server.
- **Grimoire corrompu** — the server plants errors in a correct text (lexicon and agreement chains),
  weighted toward the hero's weakest categories.
- **Progression** — XP, the dragon's six stages, lieutenant seals, Éris's fights, drachmes and
  Hermès's stall, the Oracle's week and quests, all decided server-side; the tunable numbers live in
  `data/regles.json` (§2, "The rules file"). §8 is the technical reference.
- **Art and sound** — painted WebP scenes and AAC music and effects, all bundled in the image (§8).

## Quick start on Windows (Docker Desktop)

Run the game on your Windows PC, for trying it out or playing on the home network.

1. Start **Docker Desktop** and wait until it reports "Engine running".
2. Open **PowerShell** in the repository folder and build + start the server:

   ```powershell
   $env:GIT_COMMIT = git rev-parse --short HEAD
   $env:BUILD_DATE = Get-Date -Format yyyy-MM-dd
   docker compose up -d --build
   ```

   The first two lines stamp the build with its commit and date, which the lyre's credits and
   `/api/health` show ("Which version is running?" in §2); without them the stamp says `unknown`
   and the game works the same. The first build takes several minutes (it downloads Tesseract, the
   French transformer spaCy language model and the voice's model, Kokoro-82M). Later builds reuse the cache. The images are
   tagged `discorde:local` and `discorde-tts:local`.
3. Open <http://localhost:38417> in Edge or Chrome. The 35 seed texts are loaded on the first start.
   The game uses port 38417 on purpose, an uncommon one, so it doesn't clash with other services.
4. **Play from the iPad** on the same Wi-Fi: find the PC's IP address (`ipconfig`, "IPv4
   Address", e.g. `192.168.1.20`) and open `http://192.168.1.20:38417` in Safari. If it doesn't
   load, allow the port through the Windows firewall once (PowerShell **as administrator**):

   ```powershell
   New-NetFirewallRule -DisplayName "La Discorde 38417" -Direction Inbound -Protocol TCP -LocalPort 38417 -Action Allow -Profile Private
   ```

   Your Wi-Fi network must be set to *Private* in Windows for this rule to apply.

Everyday commands (from the repository folder):

| What | Command |
|---|---|
| Stop the server | `docker compose stop` |
| Start it again | `docker compose start` |
| Update after pulling new code | the three lines of step 2 (the stamp, then `docker compose up -d --build`) |
| See the logs | `docker compose logs -f` (both containers), or `docker compose logs -f tts` for the voice alone |
| Check it's healthy | <http://localhost:38417/api/health> answers `{"status":"ok","build":{"commit":"b68ecc8","date":"2026-09-29"}}` |
| Check the voice | open <http://localhost:38417/api/tts/health> (answers `{"voice":"ready",...}`; see "If the voice goes silent") |

Heroes, progress, custom texts and scans are stored in a Docker volume named after the folder,
e.g. `school-playground_discorde-data`, so they survive stops, rebuilds and restarts.
`docker compose down` keeps the volume; **`docker compose down -v` deletes all saved data.** The
server restarts automatically with Docker Desktop (`restart: unless-stopped`); the PC must be on
for the iPad to play.

The voice keeps every line it has made in a second volume, `…_discorde-tts-cache` (up to 2 GB);
deleting it only means the lines are made again.

## 2. Deploy on TrueNAS SCALE 25.10

The NAS runs the same two images as the PC, with plain Docker (`docker compose` in a shell on the
NAS), not through the TrueNAS Apps screen. You build the images on the PC, copy them over, load
them, and start them with a small compose file kept next to the game's data.

### Build the images and copy them to the NAS

On the Windows PC with Docker Desktop, in PowerShell from the repo root, build with a tag that
names the version (a date works well, and makes rolling back easy), and save both images into one
`.tar` file:

```powershell
$v = "2026-09-27"
$c = git rev-parse --short HEAD
$d = Get-Date -Format yyyy-MM-dd
docker build --build-arg GIT_COMMIT=$c --build-arg BUILD_DATE=$d -t "discorde:$v" .
docker build --build-arg GIT_COMMIT=$c --build-arg BUILD_DATE=$d -t "discorde-tts:$v" tts
docker save -o "discorde-$v.tar" "discorde:$v" "discorde-tts:$v"
```

The two `--build-arg`s stamp both images with the commit and the day they were built, which the
game shows ("Which version is running?" below). Leave them out and the stamp says `unknown`; the
images work the same.

(Don't pipe `docker save` in Windows PowerShell 5.1: its pipes re-encode binary data and corrupt the
file; `-o` writes it directly.) The game's image takes about 3.9 GB on disk once loaded (mostly the
`fr_dep_news_trf` spaCy model with its CPU build of PyTorch, and Tesseract), and the voice's image
takes about 1.3 GB (its model and the ONNX runtime). Copy the `.tar` onto the NAS, into an SMB share or over SSH with Windows'
built-in `scp`:

```powershell
scp "discorde-$v.tar" admin@<nas-ip>:/mnt/<pool>/<share>/
```

then, from a shell on the NAS (**System → Shell**, or `ssh admin@<nas-ip>`), load it and point
`latest` at the new version, which is the tag the compose file runs; these commands run on the
NAS, not on Windows:

```bash
v=2026-09-27
sudo docker load -i /mnt/<pool>/<share>/discorde-$v.tar
sudo docker tag discorde:$v discorde:latest
sudo docker tag discorde-tts:$v discorde-tts:latest
sudo docker image ls 'discorde*'
```

The dated tags stay too: they are what you roll back to (see "Update to a new version").

### The game's folder and the port

- **Folder:** create a dataset for the game, e.g. `/mnt/<pool>/apps/discorde` (**Datasets → Add
  Dataset**). It holds the compose file and the game's data in `data/`: the whole
  state of the game (§4), so this dataset is what you snapshot and back up. The container runs as
  root, so no special permissions are needed.
- **Port:** the game listens on 8080 inside the container. The left-hand side of `ports` is the
  port the iPad uses: `38417`, an uncommon port picked so the game sits beside the NAS's other
  services. If something else already uses it, pick another free one (e.g. `"38418:8080"` and then
  `http://<nas-ip>:38418`); never change the right-hand `8080`.

### Start it with docker compose

In that folder, create `compose.yaml`:

```yaml
name: discorde
services:
  discorde:
    image: discorde:latest
    pull_policy: never
    container_name: discorde
    ports:
      - "38417:8080"
    volumes:
      - ./data:/data
    depends_on:
      - tts
    restart: unless-stopped
  tts:
    image: discorde-tts:latest
    pull_policy: never
    container_name: discorde-tts
    volumes:
      - tts-cache:/cache
    restart: unless-stopped
volumes:
  tts-cache:
```

Then start it (and check it's up) from a shell on the NAS:

```bash
cd /mnt/<pool>/apps/discorde
sudo docker compose up -d
sudo docker compose ps
```

This is `compose.yaml` from the repo with the build lines removed, the images taken at their
`latest` tag (the one you point at each new version after loading it), and the named data volume
swapped for the `data/` folder next to the file. The voice has
no port: only the game talks to it. Its cache is a named Docker volume (`discorde_tts-cache`;
nothing in it needs a backup). `pull_policy: never` tells Docker to use the images you loaded
instead of looking for them on Docker Hub. `restart: unless-stopped` brings both back after a NAS
reboot. Everything else comes from the images:

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
  `DISCORDE_STATIC_DIR=/app/static`, `SPACY_MODEL=fr_dep_news_trf`) describe the image's layout;
  leave them alone, like the build stamp (`DISCORDE_BUILD_COMMIT`, `DISCORDE_BUILD_DATE`, and
  `TTS_BUILD_COMMIT`, `TTS_BUILD_DATE` on `tts`), which the build args set.
  `DISCORDE_ALEXANDRIA_OFFLINE_DIR` and `DISCORDE_TEST_HOOKS` are for the test suite only; never
  set them in production. `TTS_STUB` is for the test suite only.
- **RAM:** the game's container uses about 0.95 GB once started (measured at rest, with the language
  model loaded). Analysing a new text, a scan or an Alexandria adoption runs that model again, so
  leave it some room above that. The voice's container uses about 0.59 GB at rest and up to 0.89 GB
  while it makes a dictation's lines (measured with the default `TTS_THREADS` of 4, on an AMD
  Ryzen 9 5950X, while it made the lines of the longest seed text, a sentence at a time, at the
  retired pace 4, the heaviest script there was).

### The rules file (`data/regles.json`)

The scoring rules have built-in defaults, so the file is optional. To change one, create
`regles.json` in the game's `data/` folder (next to `discorde.sqlite3`) with only the keys you want
to change, then restart the game (`sudo docker compose restart discorde`): the file is read once, at
start-up. The full file with its defaults:

```json
{
  "quest_min_chances": 3, "quest_min_correct": 0.85,
  "fight_max_per_100": 4,
  "copy_belle_max_per_100": 2, "copy_correcte_max_per_100": 8,
  "aid_bonus": 0.20, "pace_bonus": {"1": 0, "2": 0.25, "3": 0.5}, "prophecy_bonus": 0.5,
  "chouette_hints": 3,
  "dragon_stages": {"hatchling": 100, "young": 1200, "adult": 5000, "illustre": 15000, "ancestral": 40000},
  "levels": {"1": {"days": 3, "chances": 12, "correct": 0.85}, "2": {"days": 4, "chances": 25, "correct": 0.88},
             "3": {"days": 6, "chances": 45, "correct": 0.91}, "4": {"days": 8, "chances": 70, "correct": 0.94},
             "5": {"days": 10, "chances": 100, "correct": 0.97}},
  "fights": [{"level": 1, "count": 2}, {"level": 1, "count": "all"}, {"level": 2, "count": 2}, {"level": 2, "count": "all"},
             {"level": 3, "count": 2}, {"level": 3, "count": "all"}, {"level": 4, "count": 2}, {"level": 4, "count": "all"},
             {"level": 5, "count": 2}, {"level": 5, "count": "all"}],
  "drachmes": {"xp_per_drachme": 10, "board": 5, "oracle": 15, "weekly": 5, "level": 10, "boss": 30},
  "prices": {"accessory": {"cou": 40, "queue": 60, "dos": 90, "tete": 130}, "decor": 50, "villa": 300, "palais": 800}
}
```

| Key | What it decides |
|---|---|
| `quest_min_chances`, `quest_min_correct` | A quest session counts when the text gives the quest's lieutenant at least this many chances and at least this share of them is right in the handed-in copy |
| `fight_max_per_100` | An Éris fight is won with at most this many mistakes left per 100 words |
| `copy_belle_max_per_100`, `copy_correcte_max_per_100` | The victory's copy line and the lieutenant's fate: « belle copie » (routed) up to the first, « copie correcte » (pushed back) up to the second, « copie à reprendre » (still standing) above. The first must not be above the second: if it is, both are ignored with a warning and both defaults apply |
| `aid_bonus` | The XP bonus for each review aid left at the camp |
| `pace_bonus` | The XP bonus of each pace (`"1"` to `"3"`; a partial object keeps the other paces' defaults) |
| `prophecy_bonus` | The XP bonus of a text played before its due date |
| `chouette_hints` | The owl's hints per battle |
| `dragon_stages` | The total XP at which the dragon reaches each stage (`hatchling` to `ancestral`; the egg is always 0). A partial object keeps the other stages' defaults; the stages must rise from one to the next (whole numbers up to 1 000 000), otherwise the whole table is ignored with a warning. A lowered threshold takes effect on the next camp visit; a raised one never shrinks a dragon |
| `levels` | Each seal's window (`"1"` bois to `"5"` orichalque): `days` (days with a chance) and `chances` (whole numbers from 1), `correct` (the share right in the handed-in copies, above 0 and at most 1). A partial object keeps the other values; a wrong value is ignored with a warning. The defaults rise; a lowered value takes effect at the next session |
| `fights` | Éris's ladder, in order: each fight asks `count` lieutenants (1 to 6, or `"all"`: every one awake at the class; a count above that asks them all) at seal `level` (1 to 5) or higher. 1 to 20 fights; one wrong entry and the whole ladder is ignored with a warning (a won fight is kept by its number). The first three fights give the divine gear |
| `drachmes` | What pays drachmes: a session pays its XP ÷ `xp_per_drachme` (rounded, halves up; from 1), a board quest `board`, an Oracle quest `oracle`, the weekly goal `weekly`, a seal L `level` × L, a won Éris fight `boss` (whole numbers). A partial object keeps the other values; a wrong value is ignored with a warning. The starting grant (a tenth of the XP) was given once, by migration 007 |
| `prices` | Hermès's prices in drachmes: `accessory` (an object of `cou`, `queue`, `dos`, `tete`), `decor` (each piece), `villa`, `palais` (whole numbers). A partial object keeps the other prices; a wrong value is ignored with a warning |

A key you leave out keeps its default. A file that is not valid JSON, or a value of the wrong type
(e.g. `"0.3"` in quotes, a negative number, a share above 1), is ignored with a warning in the game's
log (`sudo docker compose logs discorde | grep regles.json`) and the defaults apply: a typo never
stops the game. The file lives in `data/`, so the backups (§4) keep it.

### Update to a new version

The data lives in `data/`, not in the container, so an update keeps everything:

1. Build, copy and load the new images under a new dated tag, and tag them `latest`, as above
   (e.g. `v=2026-10-15`).
2. Restart on them: `cd /mnt/<pool>/apps/discorde` and `sudo docker compose up -d`. Compose sees
   that `latest` now points at different images and recreates both containers; database changes
   (migrations) are applied at startup.
3. Once it's healthy and the game works, remove the previous version's dated images
   (`sudo docker image rm discorde:2026-09-27 discorde-tts:2026-09-27`). Until then, going back is
   pointing `latest` at them again and restarting:

   ```bash
   sudo docker tag discorde:2026-09-27 discorde:latest
   sudo docker tag discorde-tts:2026-09-27 discorde-tts:latest
   sudo docker compose up -d
   ```

Take a snapshot of the dataset before updating (§4) so you can roll the data back too.

### Which version is running?

To see which version the iPad runs, open the lyre's credits (the hero's cabin, « La lyre », « Merci
à ceux qui ont aidé le camp »): their last line reads e.g. « version b68ecc8 · 29 septembre 2026 »,
the commit and the day the image was built. The page reads it from the server, so it is the
server's version too; `http://<server>:38417/api/health` gives the same
(`{"status":"ok","build":{"commit":"b68ecc8","date":"2026-09-29"}}`), and
`/api/tts/health` the voice's. « version inconnue » (`unknown`) means the image was built without
the stamp's build args.

The game tells browsers not to cache it (`Cache-Control: no-store` on the page and every file), so
a new version shows at the next page load, with no reload tricks needed. Should the iPad ever still
show an older version than `/api/health` names, reload the page in Safari, or, for the Home Screen
icon, close the game from the app switcher and open it again; as a last resort remove the icon and
add it to the Home Screen again (§3).

### If the voice goes silent

The game never falls back to the device's own voice. When it cannot get a line from its voice, the
dictation stops on a card where Éris boasts that she has silenced it; the card asks the player to
tap « Réessayer », then to fetch a parent if the voice stays silent. The card's small line says why:

- « voix : serveur injoignable » — the game could not reach its voice: the `tts` container is
  stopped, still starting (loading the model takes a few seconds, up to a minute or two on a slow
  NAS), or the network between the two containers is down;
- « voix : erreur du serveur » — the voice answered with an error (see its logs).

Then:

1. Open `http://<server>:38417/api/tts/health`.
   `{"voice":"ready","engine":"kokoro-82m-v1.0-onnx-direct","build":{...}}` means the voice is fine again (`build`
   names the voice's version, see "Which version is running?"): tap
   « Réessayer » on the card. `{"voice":"loading"}`: wait a minute and try again.
   `{"voice":"unreachable"}`: the container is not running. `{"voice":"error"}`: it could not load
   its model; its logs say why.
2. Check the container: `docker compose ps` in the game's folder (with `sudo` on the NAS), and
   `docker compose restart tts` if it is stopped or crash-looping.
3. Read its logs: `docker compose logs --tail 100 tts` (with `sudo` on the NAS). A line such as
   `tts: 104 characters at 1.00: 6.25 s of speech in 1.53 s` is a line made; `the voice could not
   load` is followed by the reason.
4. Once the health answers `ready`, « Réessayer » on the card carries on where the dictation
   stopped, with everything typed so far. « Retour au camp » keeps the draft too: the dictation
   resumes from the text's parchment later.

A slow server can bring up the card too. The game waits 8 s plus 30 ms a character for a line
(about 9 to 10 s for a sentence) and asks once more before the card. A very slow server (an
overloaded NAS, or a CPU far slower than a desktop's) can take longer than that to make a sentence,
and the card then says « serveur injoignable » although the voice is running; « Réessayer » usually
works then, since the voice finished the line meanwhile and kept it in its cache.

## 3. Play on the iPad

Open `http://<nas-ip>:38417` in Safari.

**Add to Home Screen** (the iPad in French): tap the **Partager** button (the square with an
upward arrow, at the top right of Safari), then **« Sur l'écran d'accueil »**, then **Ajouter**.
English equivalent: **Share** → **"Add to Home Screen"** → **Add**.

The game then has its own icon, named « La Discorde », and opens full screen without Safari's
address bar, like an app. It is made for landscape: held upright, the iPad shows « Tourne ton
iPad ».

Everything works over plain HTTP on the LAN, including taking a photo of a handout with the
camera for a scan (the file picker's camera doesn't need a secure page).

**The dictation voice.** The server reads the dictations with Kokoro-82M's French voice: nothing
needs installing on the iPad. « Écouter un essai » in the lyre (the hero's cabin, **« La lyre »**)
plays a sample. If the voice cannot be reached, the dictation stops on a card from Éris asking the
player to try again, then to fetch a parent; its small line names the cause (§2, "If the voice goes
silent").

**The keyboard.** The game turns off autocorrect, capitals and spell-check in the dictation and
proofreading fields. If word suggestions still show above the keyboard, turn off predictive text:
**Réglages → Général → Clavier → Prédiction** (Settings → General → Keyboard → Predictive).

**Sound.**

- The iPad only lets a page make sound after a tap: the title page is silent until « Entrer », and
  after a reload or coming back to the game the sound returns with the first tap anywhere.
- **Silent mode mutes all the game's sound: the music, the effects and the dictation voice.** They
  all play through the same Web Audio context (Howler; the voice is never an HTML media element),
  which the iPad silences when the bell is crossed out or the side switch is on. Check it's off:
  open Control Centre (swipe down from the top-right corner) and make sure the bell is not crossed
  out; older iPads have a switch on the side instead.
- Each hero has three volumes, for the music, the sound effects and the voice, each with its own
  « Sourdine » (mute): in the lyre under « Les sons du camp », or from the lyre button at the top
  of every scene. Every slider works on the iPad, the voice's included. With the voice muted,
  nothing is read aloud and someone has to read the dictation to the player.

## 4. Backups

All state lives in `/data` (the `data/` folder in the game's dataset on the NAS, the Docker volume
on the PC):

- `discorde.sqlite3` — the database: heroes, progress, texts, rewards, settings. It runs in WAL
  mode, so while the game is running there may also be `discorde.sqlite3-wal` and
  `discorde.sqlite3-shm` next to it; they are part of the database.
- `scans/` — the photos of scanned handouts, one folder per scan.
- `regles.json` — the scoring rules, only if you created one (§2, "The rules file").

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

`discorde-backup.sqlite3` then sits in `data/`, next to the database. Or stop the game first
(`sudo docker compose stop` in its folder) and copy the whole `data/` folder: once stopped, the
files are consistent; `sudo docker compose start` starts it again.

On the Windows PC, in PowerShell (no `sudo`), make the same consistent copy, or copy the whole
volume out:

```powershell
docker exec discorde python -c "import sqlite3; s = sqlite3.connect('/data/discorde.sqlite3'); d = sqlite3.connect('/data/discorde-backup.sqlite3'); s.backup(d); d.close()"
docker cp discorde:/data .\discorde-data-backup
```

**Restore:**

1. Stop the game: `sudo docker compose stop` in its folder.
2. Either roll the dataset back to a snapshot (**Datasets → the dataset → Snapshots → Rollback**;
   this discards everything written after it), or replace the files in `data/`: put the saved
   database back as `discorde.sqlite3`, **delete any `discorde.sqlite3-wal` and
   `discorde.sqlite3-shm`** left from the current database, and put back `scans/` (and
   `regles.json` if you had one).
3. Start it again: `sudo docker compose start`.

## 5. Development

Everything runs in Docker; nothing else needs installing on the host but **Docker Desktop**. The
wrapper scripts are shell scripts, so on Windows they run from **Git Bash** (it comes with Git for
Windows), not PowerShell; the commands in this section are Git Bash commands. Wrapper scripts:

- `scripts/npm.sh <args>` — npm inside `web/` (e.g. `scripts/npm.sh run test`). The first run
  installs `node_modules` into a Docker volume, and again whenever `web/package-lock.json` changes.
- `scripts/pytest.sh <args>` — pytest inside `server/` (e.g. `scripts/pytest.sh -v`)
- `scripts/tts-pytest.sh <args>` — pytest inside the voice service's test image (`tts/`), model
  included (`-m "not model"` skips the tests that load it)
- `scripts/py.sh <cmd...>` — any command inside the server dev image, in `server/`
- `scripts/dev.sh` — the dev stack: Vite on <http://localhost:5173> (hot reload, proxying `/api`)
  and `uvicorn --reload` on port 8080, and the voice (`tts`, the real model). It uses the small
  spaCy model (`fr_core_news_sm`) and its own data volume, separate from the game's. It runs
  beside the quick-start container (that one is on 38417); set `DEV_API_PORT` if 8080 is taken.
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
parallel. A second run on the **same** `STACK` is refused at once (exit 3, before any docker
step), since it would tear the first one's containers down; a lock left by a run that died is
taken over. `scripts/test_run_guard.sh` checks these guards without docker (run it from anywhere;
it prints one `ok`/`FAIL` line per check and exits 0 when all pass).

**Two checkouts side by side** (e.g. two git worktrees): prefix any script with `STACK=<id>`, e.g.
`STACK=b scripts/check.sh`. That checkout gets its own compose project, app image, voice image,
server dev image and `node_modules` volume (`discorde-b…`); unset, the names stay `discorde`. The
scripts refuse `STACK=tts` and any id ending in `-tts`: that stack's app image would take the name
of another stack's voice image (`discorde-tts:local` is the main checkout's). A second dev stack
also needs `DEV_API_PORT`/`DEV_WEB_PORT`. Two e2e runs can't overlap (see the lock), but a run is
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
- **The dictation voice** — Kokoro-82M (Apache-2.0) with its French voice `ff_siwis`, trained on the
  SIWIS French speech data (CC BY 4.0); credited in `ASSETS-LICENSES.md`.
- **Public-domain rule** for any text added to the library, seed or Alexandria: author and
  translator must both have died before 1956; if unknown, reject it.

The game shows these credits to players in the lyre (« Merci à ceux qui ont aidé le camp »).

## 7. Known limitations

- Plain HTTP only, on the home network. There is no HTTPS and no offline mode: the iPad needs to
  reach the server to play.
- The scenes' tilt parallax (the picture shifting as the iPad tilts) probably stays off on the
  iPad: Safari only gives motion sensors to HTTPS pages. Dragging a finger across a scene still
  moves it.
- The dictation voice needs the server's `tts` container. The first line of a dictation comes in
  about a second, a long text included, since no line is longer than a sentence (1.8 to 2.1 s on
  the longest seed text, 0.5 to 1.1 s on a short one, on the same Ryzen 9 5950X as the RAM figures
  in §2; a short line shows while it comes).
- OCR (Tesseract, French) is for **printed** handouts only; it does not read handwriting.
- Alexandria needs the server to reach Wikisource and Project Gutenberg; everything else works
  without internet.

## 8. World and progression (technical reference)

What each place does and every rule as the player meets them are in [MANUEL.md](MANUEL.md); this
section is what a developer needs. The default numbers below are the rules file's (§2), which the
server applies and serves (`GET /api/world`: `rules`, `stages`, `shop`, `quest_bonus`, `level_xp`);
the client reads them there, so a changed rules file reaches every screen and « Le guide du camp ».

### Routes

A tiny hash router (`web/src/lib/routes.ts`); every place is a painted scene and its panels are
overlays (`web/src/lib/world/places.ts`), so a deep link, a reload and Back reopen the same overlay.

| Route | Scene and overlay |
|---|---|
| `#/` (`?panel=tous`), `#/profiles/new` | Title scene: the heroes' shields, all heroes, the forge |
| `#/p/:id/camp` (`?panel=heros`, `?panel=etal`) | The camp hub; the hero panel, Hermès's stall |
| `#/p/:id/tente-parchemins`, `/parchemins`, `/texts/new`, `/texts/scan`, `/alexandria[/:workId]` | Library tent and its panels |
| `#/p/:id/temple`, `/delphes`, `/quetes` | Delphi; the Pythia (Oracle week, prophecies), the quest wall |
| `#/p/:id/tente-de-guerre`, `/dossier`, `/bestiaire[/:key]`, `/monstres/:key` | War tent; dossier, bestiary, a lieutenant's portrait |
| `#/p/:id/dragon` (`?panel=soin`) | The nest; the dragon's care (name, tint, parure) |
| `#/p/:id/cabane` (`?panel=tresors`, `heros`, `guide`), `/stats`, `/settings` | The house; trophies, hero, guide, journal, lyre |
| `#/p/:id/play/:textId`, `#/p/:id/grimoire/:textId` | The battle stage (dictation or Grimoire) |
| `#/p/:id/eris` | Éris's lair (starts or resumes the open fight) |

`play` and `grimoire` take `?quest=`, `?encounter=` (a lieutenant, or `eris`) and `?focus=` (the
lieutenant the Grimoire's plants aim at, from its portrait); `?panel=revoir` opens the « Revoir »
scroll inside the same battle (`battleKey` ignores `panel`).

### Per-hero settings (`profile.settings_json`)

A JSON object; `PATCH /api/profiles/{id}` merges the keys it is given into it.

- `tours` — the place tours seen: a bare id is version 1, `"id:N"` version N (`web/src/lib/tours/`).
  A tour's version is the newest `since` of its steps in `content/dialogue/*.json`, so a hero who saw
  an older version hears only the newer steps, once. The lyre's replay sets `tours: []` (and
  `onboarded: false`; a legacy `onboarded: true` counts as version 1 of the camp's tour).
- `dragon_seen_stage` — the stage the hero last saw. The server writes it when a session grows the
  dragon (the victory shows it); the camp reveals once any growth beyond it (a lowered threshold, a
  catch-up) and writes it.
- `shop_seen` — the stall item ids the dragon's what-next line has already named, so it names the
  stall only for an item newly affordable (`camp.affordable`, `nextStep.ts`).
- `aids` — the review aids taken along last time (`argus`, `ariane`, `persee`, `athena`, `palamede`),
  written by the server with each session and pre-selected at the next muster.
- `audio` — `{music, sfx, voice}`, each `{volume: 0..1, muted}`; a legacy `mute: true` mutes music
  and effects. Before a hero is picked, the title scene uses the device's last values (local storage).
- `weekly_goal` — texts per week, 2 to 5 (3 when unset).

### Server-side rules

All tunable numbers are in the rules file (§2, "The rules file"). Fixed in code: a session's XP
(`server/app/world/xp.py`: effort 10 + words ÷ 10, accuracy words ÷ 5 × max(0, 1 − mistakes per 100
÷ 10), rereading 2 per trap caught; the pace, aid and prophecy bonuses multiply accuracy + rereading
only), the quest and fight XP (`QUEST_BONUS` in `catalog.py`: board 60, Oracle 150, weekly goal 40,
Éris fight 300), a seal's XP (`LEVEL_XP` × L, 100), the board quests' decor every second quest done,
the Oracle's six rewards in order, and the stall's catalogue (`server/app/world/shop.py`: accessories
on sale from seals 2 to 5 by slot, the villa from the adult dragon, the palais from the illustre one
after the villa, 4 / 6 / 9 wall slots for cabin / villa / palais).

### Seals: the window algorithm

`server/app/world/seals.py`. Per lieutenant and per Swiss day (`profile_stat_day`, summed over the
lieutenant's categories and both modes, dictation and Grimoire), `chances` = the opportunities the texts gave it and `mistakes` = its
mistakes left in the handed-in copies (missed + introduced). Seal L+1 is judged on the days strictly
after the day seal L was won (none for the first), newest first, taken until the window holds
`levels[L].days` days **and** `levels[L].chances` chances; it is won when that window is complete and
(chances − mistakes) ÷ chances ≥ `correct` (with a 1e-9 tolerance). After each saved session, every
lieutenant awake at the hero's class (Protée from 8H) gains at most one seal, written only over the
seal before it (`lieutenant_level`), paying `LEVEL_XP` × L XP, `drachmes.level` × L drachmes and the
trophy `trophy:<lieutenant>:<L>`. A seal is never lost. The war tent's gauges and the what-next line
(« within reach »: window at least 70 % full in days and chances, share at target) read the same
window from `/camp` (`lieutenants[].next`).

### Éris's fights: the ladder

`server/app/world/fights.py`. `fights` is an ordered list of `{level, count}` (default: for each seal
1 to 5, `count` 2 then `"all"`). Counts are over the lieutenants awake at the hero's class; `"all"`, or
a count above that number, asks every one of them. Fight N opens when its condition holds and fights 1
to N−1 are won (a won fight is a `boss` quest `done`, stored by its tier number, so it stays won
whatever the ladder says later). `POST /api/profiles/{id}/boss` starts the open fight (or returns the
one already under way) on a text of at least 150 words at the hero's class or the one below, least
played first, then longest. The fight is won with at most `fight_max_per_100` mistakes left per 100
words; its muster offers no pace below the class's default one (`defaultPace`). Each win pays `QUEST_BONUS["boss"]` XP and
`drachmes.boss`; tiers 1 to 3 also give the divine gear (`BOSS_REWARDS`: `sandales_hermes`, `egide`,
`foudre_zeus`).

### Migrations 006 to 008, the drachme ledger and the stats' mode

Migrations run at start-up (`server/app/migrations/`), each in one transaction with its
`schema_version` row: `NNN_name.sql`, or `NNN_name.py` (a function `up(conn)`, for a data migration
that needs Python; it uses `conn.execute` only, never `executescript`, a commit, `BEGIN` or a `PRAGMA`).

- **006 (seals)** creates `lieutenant_level`: every lieutenant neutralised under the old rule became
  seal 1 (bois), won when it was neutralised, and its relic became its wooden trophy. The old
  `mastery` table is kept but no longer written; XP is untouched.
- **007 (drachmes)** creates `drachme_event` (`profile_id`, `amount`, `reason`, `ref`, `created_at`)
  and gives every hero a one-off starting grant of a tenth of the XP already won (rounded down, none
  under 10 XP).
- **008 (stats' mode, `008_stat_mode.py`)** adds `mode` (`dictation` | `grimoire`) to the primary key
  of `profile_stat` (`profile_id`, `category`, `mode`) and `profile_stat_day` (`profile_id`, `day`,
  `category`, `mode`), so the child's own mistakes (dictations) are told apart from the ones Éris
  planted (Grimoire corrompu, whose « draft errors » are hers). The tables are rebuilt and their
  counters split by replaying the Grimoire sessions still on record (`result_json.byCategory`, on the
  session's Swiss day of `finished_at`). Whatever those sessions cannot explain stays in `dictation`:
  sessions recorded without `byCategory`, sessions deleted with their text, malformed results. A
  Grimoire share above the old counter (inconsistent data) is clamped to it. For every old row, the new
  rows sum exactly to its counters; an all-zero dictation remainder beside a Grimoire row is not kept.

The balance is the ledger's sum. `reason` is `grant`, `session` (round(session XP ÷ `xp_per_drachme`),
halves up), `board`, `oracle`, `weekly`, `level`, `boss` (one row per part, `ref` = `session:<id>`) or
`purchase` (negative, `ref` = the item). `POST /api/profiles/{id}/purchases` reads the balance and
writes the purchase under one write lock, so concurrent purchases never overdraw it.

A saved session adds its `byCategory` counts into the rows of its own `mode`. Every reader sums both
modes, so the game plays as before: the seals and the fights they open, the Oracle's weak point,
Éris's aim in the Grimoire (`POST /api/texts/{id}/corrupt`), the camp's small tricks, the journal and
the Argus pass order. `GET /api/profiles/{id}/stats` keeps each category's counters as that sum and
adds `by_mode` (`dictation` and `grimoire`, each with `occurrences`, `errors_in_draft`, `caught`,
`missed`, `introduced`); nothing in the game shows the split yet.

### The accessory overlays

The dragon's accessories are transparent overlays drawn over the tinted dragon, unfiltered, back to
front in the draw order `queue`, `dos`, `cou`, `tete`, from the young dragon on. Pipeline (the
`art-overlays` skill has the details):

1. `tools/art/overlay.py extract` cuts a painted accessory out of an inpainted stage picture with the
   slot's mask; `overlay.py crop <overlay> --webp <file> --manifest <fragment> --item <lt>-<slot>
   --stage <stage>` writes its WebP crop to `web/public/art/dragon/accessories/` and its box (x, y, w,
   h as fractions of the stage picture) into the lieutenant's fragment,
   `assets/art/export/dragon/accessories/<lieutenant>.json`.
2. `python tools/art/accessory_manifest.py` merges the six fragments into
   `web/src/lib/world/accessories.json`, refusing a fragment that misses an item or a stage (young,
   adult, illustre, ancestral) or names another lieutenant's item.

The server serves the worn pieces as the manifest's item keys (`dragon.worn`, e.g. `hydre-cou`), one
per slot.

### Art and sound

Art and sound are served from the same origin, bundled in the image: `web/public/art` (WebP, about
8.1 MB) and `web/public/audio` (15 AAC `.m4a` files, about 4.9 MB), played through Howler
(`web/src/lib/world/readmeSizes.test.ts` checks both figures). Dragon tints are a CSS `hue-rotate`
filter on one cut-out per stage. Every static file is sent with `Cache-Control: no-store`
(`server/app/static.py`, §2 "Which version is running?").

### `DISCORDE_TEST_HOOKS`

`DISCORDE_TEST_HOOKS=1` enables an `X-Discorde-Day` request header on `POST /api/sessions`, letting the
e2e suite fast-forward the multi-day seals and weekly-goal logic. It's set only in `compose.e2e.yaml`
(and under pytest) — **never** set it in production; without it the header is ignored.
