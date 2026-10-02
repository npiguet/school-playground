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
- **Dictation** with 3 paces, each reading the text in breath groups, every group twice, then the
  whole text once: « Pas à pas » (she taps « Suivant » after each group, one extra « Réécouter »
  a group), « Par groupes » (moves on by itself, with a pause button) and « D'un bon pas » (longer
  groups, no pause button). A French voice (Kokoro-82M) reads it, synthesised by the server in its
  second container.
- **Proofreading** — five review aids, each taken along or left at the camp before the battle (the
  choice is remembered per hero, and each aid left adds 20 % to the battle's XP bonus): *Les yeux
  d'Argus* (a spotlight over one word category at a time: verbs, nominal groups, homophones, trap
  words), *Le fil d'Ariane* (tap a verb, then its subject), *Le bouclier de Persée* (sentence by
  sentence, last to first), *La chouette d'Athéna* (a few hints) and *Les jetons de Palamède* (how
  many traps hide in the text). The copy is judged as at school, on the mistakes left in it.
- **Scan a handout** — photograph a printed page (camera or photo library), OCR it with Tesseract,
  and check the recognised text against the photo before it becomes the answer key.
- **Dictée préparée** — a text can carry the date of a class test; until that date it shows as the
  Oracle's prophecy.
- **Grimoire corrompu** — a proofreading-only mode on an already-correct text, with errors planted
  by Éris and weighted toward the player's own weak spots.
- **Bibliothèque d'Alexandrie** — adopt scored excerpts from public-domain classics
  (Wikisource/Gutenberg) into the library. This is the only feature that needs internet access
  from the server.
- **Camp and progression** — XP, Éris's lieutenants (one per error family), each with five seals
  to win (bois, bronze, argent, or, orichalque) and a painted trophy for each, Éris's recurring
  fights, drachmes to spend at Hermès's stall (the dragon's accessories, the villa and the palais,
  decor), quests from the Oracle of Delphi, a weekly goal, a break nudge after about 25 minutes of play,
  and a companion dragon that grows from the XP through six stages, from the egg to the Dragon
  ancestral (years of play).
- **Music and sounds** — each place has its own music loop, with sound effects and the dictation
  voice on three separate volume channels (see §8).

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
| Check it's healthy | open <http://localhost:38417/api/health> (answers `{"status":"ok","build":{"commit":"b68ecc8","date":"2026-09-29"}}`) |
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
  `TTS_BUILD_COMMIT`, `TTS_BUILD_DATE` on `tts`), which the build args set. `DISCORDE_ALEXANDRIA_OFFLINE_DIR` and `DISCORDE_TEST_HOOKS` are for the test
  suite only; never set them in production. `TTS_STUB` is for the test suite only.
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

## 8. World and progression

- **Scenes, not pages.** The game opens on a title scene (« Entrer »), then the heroes' shields:
  pick a hero, see them all, or forge a new one. Each place is a painted scene with labelled places
  to tap; tapping one opens its panel over the scene. A strip at the top of every scene holds the
  hero chip (opens the hero panel), the XP laurel, the purse (the drachme coin and the balance), the
  dragon and the lyre button (the sound plate: the three channels and « Ouvrir la lyre »). The first
  visit to each place is a short tour by its character, and the battle's muster has its own (the
  pace, the aids and what leaving them is worth); when a place gains something new, a hero who already saw its tour hears only the new
  steps, once (a version per tour in `settings.tours`, e.g. `"cabin:2"`). « Refaire les visites du
  camp » in the lyre replays them all, and « Le guide du camp » there explains glory and the
  dragon's stages, the seals, the drachmes, the aids and Éris's fights, with the numbers the server
  serves (`data/regles.json` and the catalogue).
- **The camp** (`#/p/:id/camp`) is the hub once a hero is picked. Its places:
  - « Le nid du dragon » — the dragon's nest: its growth and its care, « Sa teinte » (the tints)
    and « Sa parure » (the accessories it wears, bought at Hermès's stall).
  - « L'étal d'Hermès » — Hermès's stall: the purse and his three shelves, « Parures du dragon »,
    « La maison » and « Décor ».
  - « La tente des parchemins » — the library: « Tes parchemins » (the shelves, where a text is
    picked for a battle), « Le pupitre » (type or paste a text), « La lentille » (scan a handout)
    and « Le portail » (Alexandria).
  - « Le chemin de Delphes » — the temple: « La Pythie » (the Oracle's week) and « Le mur des
    quêtes ».
  - « La tente de guerre » — Éris's lieutenants on their portrait wall, « Le dossier d'Éris » and
    « Le bestiaire ».
  - « Ta cabane » (« Ta villa », « Ton palais » once bought) — « Tes trésors » (every reward),
    « Ton journal » (the hero's all-time counts, the former stats screen) and « La lyre » (the
    settings: the dictation voice's trial, the three sound channels, class, weekly goal, seal, tours,
    credits).
  - « Le sentier de la bataille » — the way to Éris herself, once she shows up.
- **What next.** At the camp, the dragon ends its greeting with the most useful next goal, first
  match wins: a name for a hatched dragon, a prophecy due within a week, an open fight against
  Éris, the first text, a lieutenant's seal within reach (its window at least 70 % complete and
  its share at target), the next stage (under a fifth of the way left), something affordable at
  Hermès's stall, the week's sealed scrolls, the weekly goal, otherwise a warm word.
- **How to earn it.** Nothing is hidden: every trophy, tint, gear, decor piece, accessory and
  house not owned says in words how to get it (an empty plinth says where its lieutenant hides and
  what the first seal asks; the trophies still to win show as silhouettes in the shelf's close
  view; the next fight names its gear). No countdown, no pressure.
- **Battles.** A text opens the battle stage (`#/p/:id/play/:textId`; the Grimoire at
  `#/p/:id/grimoire/:textId`): choose a pace and the review aids to take along, write the
  dictation, proofread it with the aids taken, then the victory (the copy's mistakes and the XP
  earned) and « Revoir » to go over each trap.
- **Oracle week** — Delphi's three scrolls reset every ISO week (Monday–Sunday, local time in
  `Europe/Zurich`, configurable via `DISCORDE_TZ`). The week's reward is shown before any scroll is
  opened (no gamble), and a chosen quest stays open until the *next* consultation actually replaces
  it, not merely when a new week begins.
- **Seals (lieutenant levels)** — each error family ("lieutenant") has five seals, each a material:
  bois, bronze, argent, or, orichalque. Seal L+1 is judged on the days after seal L was won (Swiss
  days with at least one chance for that lieutenant, newest first) until the window holds enough
  days and chances; it is won when the share right in the handed-in copies reaches the target:
  3 days / 12 chances / 85 %, 4 / 25 / 88 %, 6 / 45 / 91 %, 8 / 70 / 94 %, 10 / 100 / 97 %
  (`levels` in `data/regles.json`). One seal per lieutenant per session; a seal is never lost.
  Seal L pays 100 × L XP and the lieutenant's trophy in that material (the cabin's shelf). A
  lieutenant neutralised before this rule became its wooden seal, and its relic its wooden trophy
  (migration 006; the old `mastery` table is kept but no longer written).
- **Éris's fights** — a ladder of ten by default (`fights` in `data/regles.json`): for each seal,
  « at least 2 lieutenants at this seal », then « all of them », counted over the lieutenants awake
  at the hero's class (Protée from 8H). A fight opens when its condition holds and every earlier one
  is won; won fights stay won. Each pays 300 XP; the first three also give the Sandales d'Hermès,
  the Égide and the Foudre de Zeus.
- **Drachmes and Hermès's stall** — XP is never spent; drachmes are. A session pays its XP ÷ 10
  (rounded, halves up), a board quest 5, an Oracle quest 15, the weekly goal 5, a seal L 10 × L, an
  Éris fight won 30 (`drachmes` in `data/regles.json`); every hero started with a tenth of the XP
  already won (migration 007). The balance is the sum of a ledger (`drachme_event`) and never goes
  below zero. Hermès's stall, painted into the camp, sells the dragon's accessories (one set of four
  per lieutenant, each piece on sale from its lieutenant's seal: cou bronze, queue argent, dos or,
  tête orichalque; Protée's from 8H), the villa (from the adult dragon) and the palais (from the
  illustre dragon, after the villa), and four pieces of decor, at the prices in `prices`.
- **The house and the parure** — the cabin place shows the highest house owned, each room with more
  wall slots for decor (cabin 4, villa 6, palais 9). The nest's care dresses the dragon: one piece
  per slot or none, drawn over the tinted dragon in its own colours, from the young dragon on. The
  overlays and their manifest come from the art track (`tools/art/overlay.py crop`, then
  `python tools/art/accessory_manifest.py` writes `web/src/lib/world/accessories.json`).
- **Dragon growth** — the dragon's stage follows the hero's total XP: Œuf (0), Dragonnet (100),
  Jeune dragon (1 200), Dragon adulte (5 000), Dragon illustre (15 000), Dragon ancestral (40 000),
  thresholds in `data/regles.json`. A stage is never lost: a raised threshold or a restored backup
  keeps the stage already reached, and a dragon grown before this rule keeps its stage. The HUD's
  laurel shows the way to the next stage; the XP ranks are gone. A growth the hero has not seen on
  a victory (a lowered threshold, the catch-up after an update) is revealed once at the camp, with
  the naming field for an unnamed dragon; the stage last seen is the hero's
  `settings.dragon_seen_stage`.
- **Rewards are announced in advance** — every trophy, dragon tint, divine gear and piece of decor
  (the accessories and the houses are at Hermès's stall) is on the cabin's trophy shelf
  (`#/p/:id/cabane?panel=tresors`) with how to win it, before it can be earned; nothing is a gamble. A lieutenant's empty plinth there says what its first seal asks; the
  bronze to orichalque trophies stand on the shelf once won (silhouettes in its close view until
  then), and the war tent's portrait of each lieutenant says what its next seal asks.
- **Art and sound** are served from the same origin: `web/public/art` (WebP, about 8.1 MB) and
  `web/public/audio` (15 AAC `.m4a` files, about 4.9 MB), played through Howler. Dragon tints are a
  CSS `hue-rotate` filter on one cut-out; the accessories it wears are drawn over it unfiltered.
  The sound settings are saved per hero on the server (and remembered on the device for the title
  scene, before a hero is picked).
- **`DISCORDE_TEST_HOOKS=1`** enables an `X-Discorde-Day` request header on `POST /api/sessions`,
  letting the e2e suite fast-forward the multi-day seals and weekly-goal logic. It's set only in
  `compose.e2e.yaml` (and under pytest) — **never** set it in production; without it the header is
  ignored.
