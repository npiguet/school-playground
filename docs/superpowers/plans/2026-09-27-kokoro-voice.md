# La Discorde — The dictation voice moves to Kokoro on the server: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The dictation (and the lyre's test line) is read by Kokoro-82M's French voice `ff_siwis`, synthesised on the server in a second compose service `tts` and played through the game's Howler mixer on the voice channel; the browser's `speechSynthesis` is removed, with no fallback: a voice that cannot be heard stops the dictation on Éris's in-universe card, which sends the player to a parent.

**Architecture:** Three layers.
- `tts/`: a small FastAPI service in its own image (`discorde-tts:<tag>`, no published port): Kokoro-82M with the model and voice baked in (ONNX if Task 1 proves parity with the PyTorch build the user listened to, else the PyTorch CPU build, behind one engine module), one worker thread with a jump-the-queue and deduplicating queue, an LRU MP3 cache in its own volume, `respell.json` pronunciation fixes, and a stub engine for e2e (`TTS_STUB=1`: silent MP3s as long as the line would take).
- `server/`: `/api/tts/speak`, `/api/tts/prepare` (both need a hero) and `/api/tts/health` proxy the service through `httpx` (already a dependency); an unreachable or unready voice is a 503.
- `web/`: the spoken form's sentence endings (bake-off variant C), `lib/dictation/voice.ts` (fetch, one silent retry, timeout, blob-URL clips, prefetch, prepare), the mixer plays a voice line (`engine.say`, a `line()` on every backend), the runner pauses on a failed line and resumes on « Réessayer », the waiting line and Éris's card, the lyre loses its voice picker. `tts.ts` and every `speechSynthesis` use go (guarded).

**Tech Stack:** Python 3.12 + FastAPI + uvicorn + numpy + soundfile (MP3 through libsndfile) in `tts/`; `kokoro-onnx` + `onnxruntime` (or `torch` CPU + `kokoro` 0.9.4, Task 1 decides); pytest in the service's own test image. Server: FastAPI + `httpx` (existing). Web: Svelte 5 (runes) + TypeScript + Vite 7, vitest 5, Howler 2.2.4 (existing), Playwright 1.63 (WebKit `desktop` and `ipad`, `chromium` for one library test). Docker Desktop + Git Bash wrapper scripts.

**Spec:** `docs/superpowers/specs/2026-09-27-kokoro-voice-design.md` (binding, every section). The parent spec `docs/superpowers/specs/2026-09-23-la-discorde-design.md` §3.3 and §4 are amended by Task 9. The scenes UI spec's audio rulings (UI5 E1–E17 in `docs/superpowers/plans/2026-09-27-ui5-audio-dialogue.md`) hold, except where this plan changes the voice itself (Rulings K below). Repo-root `CLAUDE.md` is binding for every agent: no "pre-existing" problems, zero warnings, a flaky test is a defect, no emoji.

## Dependencies and batching

| Task | Title | Needs | Independent of |
|---|---|---|---|
| 1 | ONNX parity proof (`tools/tts/parity`) | — | 2, 4, 6, 7 |
| 2 | The `tts` service, engine-neutral, with the stub (`tts/`, `scripts/tts-pytest.sh`) | — | 1, 4, 6, 7 |
| 3 | The real engine (Task 1's verdict), the model baked in | 1, 2 | 4, 6, 7, 8 |
| 4 | The game server's proxy (`/api/tts/*`) | — | 1, 2, 3, 6, 7, 8 |
| 5 | The stacks (prod, e2e, dev), the gate's builds, the README's deployment and troubleshooting | 2, 3, 4 | 6, 7, 8 |
| 6 | The spoken form's sentence endings, the script's unique lines | — | 1, 2, 3, 4, 5, 7 |
| 7 | Voice lines through the mixer (`engine.say`, backends' `line()`) | — | 1, 2, 3, 4, 5, 6 |
| 8 | `voice.ts`, the runner's failure and « Réessayer », the copy | 6, 7 | 1–5 |
| 9 | The game switches to the server voice (UI, e2e, the real-voice spec, credits, spec amendment) | 5, 8 | — |
| 10 | The full gate, the voice walk (paces, container stopped and started), memory, README figures | 1–9 | — |

**Suggested two-at-a-time batches** (no file is written by both tasks of a batch): **B1** 1 ‖ 2 · **B2** 4 ‖ 6 · **B3** 3 ‖ 7 · **B4** 5 ‖ 8 · **B5** 9 · **B6** 10. All in the main checkout on branch `scenes` (`STACK` unset). Only Tasks 1, 3, 5, 6, 9 and 10 take the machine-wide Playwright lock (Tasks 1 and 3 through `tools/tts/run_docker.sh` / heavy container runs, the others through `scripts/playwright.sh`); a run that waits on the lock is queued, not hung.

## Global Constraints

- **Voice (spec §2):** Kokoro-82M, voice `ff_siwis` alone, French pipeline (espeak-ng `fr-fr`, the PyTorch package's `lang_code='f'`). Pace = Kokoro's own `speed`: `PACE_RATES` `{1: 0.75, 2: 0.85, 3: 0.9, 4: 1.0}` and pace 4's final reading at `0.95`. No time stretch, no blend, no other voice.
- **No fallback (spec §2, §5.1):** nothing in `web/src` uses `speechSynthesis`/`SpeechSynthesisUtterance` once Task 9 lands (guarded). The only silent path is the muted voice channel, which waits the line's length (`speechMs`, 65 ms a character ÷ rate, at least 300 ms).
- **Service (spec §4.1):** image `discorde-tts:<tag>`, service `tts`, internal port 8000, no published port; `TTS_THREADS` default 4; MP3, 24 kHz mono, no silence trimmed or added; cache `/cache` in volume `discorde-tts-cache`, `TTS_CACHE_MB` default 2048, least recently used evicted, file name `sha256(model, voice, speed, respelled text, format version).mp3`; one worker thread; `/speak` jumps the queue; one job per line; `respell.json` ships as `{}`; `/speak`, `/prepare` (202), `/health`; `speed` 0.5–1.5, a line at most `MAX_CHARS` characters (Ruling K1: 10 000), else 422; `TTS_STUB=1` e2e only.
- **Game server (spec §4.2):** `DISCORDE_TTS_URL` (default `http://tts:8000`); `/api/tts/speak` and `/api/tts/prepare` need a hero (`profile_id` in the body, Ruling K4); status and body pass through; unreachable or unready → **503**; `GET /api/health` unchanged; `GET /api/tts/health` for troubleshooting. Nothing is recorded when a text is saved.
- **Game (spec §5):** the voice plays through Howler on the voice channel: its gain and mute apply, the music ducks, effects wait. Retry once silently on a network error, a 5xx or a timeout of `20 000 + 50 × characters` ms; then Éris's card. Waiting line after 400 ms. The next line's fetch starts when the current one starts playing. `prepare` sends the script's unique `say` lines in script order when the dictation starts.
- **Copy:** every French string of this plan is used verbatim. Content lines (`content/dialogue/*.json`) are authored with plain spaces (the loader's `frenchSpacing()` adds U+202F before « : ; ! ? » and inside « guillemets »); strings in code carry ` ` themselves (`frenchSpacing.test.ts`). In-world register for a 13-year-old (no school, admin or technical words in her copy; the parent's cause line is the one technical line, by spec); no guilt wording (`manqué|raté|perdu`); nothing agrees with the player; Éris is feminine and targets her own tricks, never the player's ability (`FORBIDDEN`, `erisSelfMasculine`); the content test's length limit (170) and three variants per key.
- **No emoji** anywhere the player can see (CLAUDE.md, `noEmoji.test.ts`): the card uses words and Éris's painted portrait, nothing else.
- **Toolchain:** no Node, no host Python, pip, sed or awk. Everything runs in Docker through `scripts/` (and `tools/tts/run_docker.sh` for the parity proof), from the repo root in Git Bash:
  - `scripts/tts-pytest.sh -q [files]` (the voice service's tests, its own image; Task 2 creates it);
  - `scripts/pytest.sh -q [files]` (server);
  - `scripts/npm.sh run test -- <files>` (vitest), `scripts/npm.sh run check` (svelte-check + e2e tsc: `0 errors and 0 warnings`);
  - `scripts/playwright.sh <spec-filter> [--project=<name>] [--repeat-each=3]`; `TTS_STUB=0 scripts/playwright.sh --config playwright.voice.config.ts voice-real` (Task 9);
  - `PW_WORKERS=4 scripts/check.sh` (the full gate, must end `== ALL GREEN`);
  - `tools/tts/run_docker.sh parity` (Task 1), `tools/tts/voice_walk.sh` (Task 10).
  Never run Docker, Playwright or pytest outside these wrappers (Task 5's and Task 10's measurement commands are given verbatim and source `scripts/lib.sh` first).
- **Playwright runs are serialised machine-wide** (`with_playwright_lock`, `scripts/lib.sh`). A queued run is not a hang; never break the lock.
- **Long commands run in the foreground** (the gate, the e2e runs, the parity proof, the voice walk); never background them to poll.
- **Testing rules:** per task, the focused tests; every new or changed e2e spec with `--repeat-each=3`; every touched but unchanged-in-intent spec once; a full `PW_WORKERS=4 scripts/check.sh` in Tasks 5, 9 and 10. The crash-only retry (`web/scripts/playwright-crash-retry.mjs`) retries a named "browser crashed" failure once; any other failure is real. A flake is a defect: root-cause it. Test output and `svelte-check`: zero errors **and zero warnings** (pytest warnings included).
- **Git:** never `git stash`, `git reset`, `git checkout`, `git restore` of tracked work, `git clean`, or any history rewrite; never `git add -A` or `git add .`. Always `git add <paths> && git commit -m "..." -- <paths>` with explicit pathspecs (a deleted file is named too). Every commit message ends with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. `assets/tts-bakeoff/` stays uncommitted (gitignored).
- **Verification:** paste each command's real output (counts included) into the task report. A failing, flaky or warning test anywhere is yours to fix or to report as an open item, never "pre-existing" (CLAUDE.md).

## Review Focus

1. **Pace 4's full reading of a long text** (a 1 170-character seed text is about 1 600 spoken characters; a 4 000-character custom text can pass 5 000): the voice must accept it (not a 422), the model must read it in segments without splitting a mark from its name, and the first line's wait shows the waiting line under a timeout that grows with the line. Tests: Task 2 (`test_the_limits_themselves_are_accepted`, `segments` tests), Task 6 (`every seed text's longest line fits the voice`), Task 10 (time to the first line on the longest seed text at pace 4).
2. **A pause, « Quitter » or the page leaving while a line is still on its way:** the late clip must never play over what follows, and its blob URL must be freed. Tests: Task 8 (`never plays a line cancelled while it was coming`, `dispose() frees every clip…`).
3. **« Réessayer » while the voice is still down or still loading** (a restarted container answers 503 until the model is loaded): the card comes back with its cause, never a stuck dictation. Tests: Task 8 runner (`a retry that fails again silences again`), Task 9 e2e (the 503 → retry → 503 → retry → plays sequence).
4. **« Réécouter » when the voice fails:** the card shows; « Réessayer » replays without spending another replay and returns to « À toi d'écrire. ». Test: Task 8 runner (`a failed replay silences…`).
5. **A line whose end never comes** (the iPad locks mid-line, the context is interrupted): the dictation must go on and the music come back up. Test: Task 7 (`a line whose end never comes is over after its watchdog`).

## Rulings taken by this plan (the spec is silent or ambiguous; do not re-ask)

- **K1 Line limit 10 000 characters, not 1 000.** The spec's « at most 1 000 characters » would refuse pace 4's full reading (`plan.full`) of most seed texts (the longest body is 1 170 characters, about 1 600 spoken) and of any text up to the server's 4 000-character body limit. `MAX_CHARS = 10_000` in `tts/app/text.py`, mirrored by `MAX_LINE_CHARS` in `web/src/lib/dictation/script.ts` (a vitest pins that every seed text fits). The model reads a long line in segments of at most 300 characters (`segments()`, Task 2), cut only after a full stop that is not followed by « Point »/« Points », so a mark and its name are never apart; a line of 300 characters or fewer is one synthesis, exactly as in the bake-off.
- **K2 The endings are the bake-off's variant C exactly** (`tools/tts/round2.ts`, which the user listened to): `. ? ! …` (and `...`, said as `…`) are kept as the mark and followed by their capitalised name wherever they are in the chunk (« Viens ici ! Point d'exclamation, fermez les guillemets. »); `;` and `:` are kept as the mark followed by their name in lower case (« chèvre ; point-virgule, et ») — the spec's own examples « ; point-virgule, » and « : deux-points, » are variant C's form; the comma, guillemets, parentheses, tirets and apostrophes keep today's « , name, » form. The mark sits against the word for « . » and « … », after a plain space for « ? ! ; : » (the voice does not read typography; this string is never shown). A mark with no unit before it is said by its name alone. After « À la ligne. » the first unit is capitalised when it is a punctuation name (« À la ligne. Tiret, Déjà ! Point d'exclamation, … »).
- **K3 Pronunciation fixes are case-sensitive, whole words only** (never inside a word or a hyphenated compound; after an elided article they apply: « l'Hydre »). The cache key hashes the respelled text, so an edit to `respell.json` changes the key of exactly the lines it touches.
- **K4 « Require a profile » = `profile_id` in the JSON body**, as `POST /api/sessions` takes it (there is no auth header in this game): an unknown hero is a 404 and the voice is never called; a missing one is a 422.
- **K5 The waiting line shows for any line more than 400 ms late**, not only the first (later lines are prefetched, so in practice it is the first line or a line after a manual step's long pause). Its variants live in `content/dialogue/battle.json` as `battle.voice.wait` (speaker `pythia`), picked by the selector (no immediate repeat); Éris's gloat is `battle.voice.lost` (speaker `eris`). The card's other lines are UI copy in `lib/battle/lines.ts` (`VOICE_LOST`, Ruling E11 of UI5: UI copy stays in code).
- **K6 Failure classes.** A 503, a network error or the timeout's abort → `unreachable` (« voix : serveur injoignable »); any other 5xx → `server` (« voix : erreur du serveur »). A 4xx is not retried and counts as `server` (it is a bug on our side, the parent line cannot be more precise).
- **K7 Clips carry no duration from the server.** `VoiceClip.ms` is the browser's estimate (`speechMs`); Howler's own `end` event ends a line, with a watchdog at `2 × ms + 3 s`. In every e2e page the recording backend ends a line 20 ms after it starts (the former `stubSpeech` did the same), so the suite keeps its speed; the stub service still returns MP3s of the right length (spec §4.1) for a real browser on a stub stack.
- **K8 The real-voice e2e run.** One compose file: `compose.e2e.yaml`'s `tts` reads `TTS_STUB` (default `1`); `check.sh` runs a second, small Playwright invocation `TTS_STUB=0 scripts/playwright.sh --config playwright.voice.config.ts voice-real`. (A compose profile would need two services answering as `tts`.) The voice config matches `voice-*.spec.ts`; the main config ignores them.
- **K9 `/api/tts/health`** answers `{"voice": "ready", "engine": "<model id>"}` (200), or 503 with `{"voice": "loading" | "error" | "unreachable"}`; the real-voice spec asserts the engine is not `stub`.
- **K10 The lyre** keeps « La voix de la dictée » with « Écouter un essai » only (no picker, no « Aucune voix française » note); the note « Sur iPad, seuls les boutons de l'appareil règlent le volume de la voix. » goes (the voice is Web Audio now, its slider works on the iPad); its credits gain the voice. `profile.settings.voice` leaves the web types and the save body; the server keeps whatever is stored (settings are merged shallowly).
- **K11 The muster's « Cet appareil ne sait pas lire à voix haute… » note goes** with `ttsAvailable()`: no device lacks the voice any more.
- **K12 A resumed dictation prepares from its resumed unit** (`sayLines(steps.slice(resumeAt))`). A muted voice prepares and prefetches nothing.
- **K13 MP3 through soundfile** (libsndfile ≥ 1.1 in the soundfile wheel, `format="MP3"`); if the wheel lacks MP3 (`test_mp3_is_available` fails), `lameenc` instead (code in Task 2).
- **K14 Before the unlock** (a reload straight into a resumed dictation before any tap), a voice line is silent and takes its estimated length, as a muted one does; the first tap anywhere unlocks as today (Ruling E3b).

## File map

| File | Responsibility | Task |
|---|---|---|
| `tools/tts/parity/Dockerfile`, `tools/tts/parity.py`, `tools/tts/parity.json`, `tools/tts/run_docker.sh`, `tools/tts/README.md` | the ONNX parity proof and its verdict | 1 |
| `tts/{Dockerfile,.dockerignore,requirements.txt,requirements-dev.txt,pytest.ini,respell.json}`, `tts/app/{__init__,config,text,cache,worker,audio,engine,main}.py`, `tts/tests/{__init__,conftest,test_text,test_cache,test_worker,test_audio,test_api}.py`, `scripts/tts-pytest.sh`, `scripts/lib.sh` | the voice service, engine-neutral | 2 |
| `tts/app/kokoro.py`, `tts/Dockerfile`, `tts/requirements.txt`, `tts/tests/test_model.py` | the real engine | 3 |
| `server/app/routers/tts.py`, `server/app/config.py`, `server/app/main.py`, `server/tests/test_tts_proxy.py` | the proxy | 4 |
| `compose.yaml`, `compose.e2e.yaml`, `compose.dev.yaml`, `scripts/check.sh`, `scripts/playwright.sh`, `scripts/dev.sh`, `web/e2e/smoke.spec.ts`, `README.md` (§ quick start, §2, §5) | the stacks, the gate, deployment docs | 5 |
| `web/src/lib/dictation/{spoken,script}.ts` (+ tests), `tools/tts/README.md` | the endings, `sayLines`, `MAX_LINE_CHARS` | 6 |
| `web/src/lib/audio/{engine,recordingBackend,howlerBackend,lazyBackend,voice,audio.svelte}.ts` (+ tests) | voice lines through the mixer | 7 |
| `web/src/lib/dictation/{voice,runner}.ts` (+ tests), `content/dialogue/battle.json`, `web/src/lib/dialogue/{types.ts,content.test.ts}`, `web/src/lib/battle/lines.ts`, `web/src/components/battle/DictationPhase.svelte` (one line) | the voice client, failure and retry, the copy | 8 |
| `web/src/components/battle/{DictationPhase,MusterPhase,VoiceLostCard}.svelte`, `web/src/screens/Play.svelte`, `web/src/components/places/cabin/LyrePanel.svelte`, `web/src/lib/dictation/{tts.ts,tts.test.ts}` (deleted), `web/src/lib/dictation/index.ts`, `web/src/lib/audio/{voice,engine}.ts`, `web/src/lib/types.ts`, `web/src/lib/battle/lines.ts`, `web/src/audioGuards.test.ts`, `web/e2e/*` (migration, `scenes-voice.spec.ts`, `voice-real.spec.ts`), `web/playwright.config.ts`, `web/playwright.voice.config.ts`, `web/tsconfig.e2e.json`, `scripts/check.sh`, `README.md` (§1, §3, §7), `ASSETS-LICENSES.md`, `docs/superpowers/specs/2026-09-23-la-discorde-design.md` | the switch | 9 |
| `tools/tts/voice_walk.sh`, `web/e2e/voice-walk.spec.ts`, `README.md` (memory) | the walk and the figures | 10 |

---

### Task 1: ONNX parity proof — `kokoro-onnx` against the PyTorch `kokoro` package on the bake-off lines

**Files:**
- Create: `tools/tts/parity/Dockerfile`, `tools/tts/parity.py`, `tools/tts/parity.json` (written by the run, committed)
- Modify: `tools/tts/run_docker.sh` (a `parity` command and its usage line), `tools/tts/README.md` (a « Parity » section)

**Interfaces:**
- Consumes: `tools/tts/lines.json` (`lines.<id>.spoken`, `slowRate`), `tools/tts/round2.json` (`sentences.<id>.variants.C`, `paces`), the `discorde-tts-bakeoff-cache` volume (the bake-off's Hugging Face cache at `/cache/hf`; renamed in Task 1's fix round 2 so it never shares the service's line cache, `discorde-tts-cache`), `with_playwright_lock` (`scripts/lib.sh`).
- Produces: `tools/tts/parity.json` with `verdict` ∈ `"onnx" | "onnx-misaki" | "torch"` (Task 3 reads it), `versions` (the exact package versions that ran), `files` (each model file: `url`, `sha256`, `bytes`; Task 3's Dockerfile checksums come from here), `criteria`, `noise_floor` and a row per line.

- [ ] **Step 1: The parity image**

`tools/tts/parity/Dockerfile`:

```dockerfile
# Kokoro-82M parity proof (Kokoro plan, Task 1): the PyTorch package the user listened to in the
# bake-off (tools/tts/kokoro/Dockerfile) and the ONNX build (kokoro-onnx + onnxruntime), side by side.
FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends espeak-ng && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir torch==2.8.0 --index-url https://download.pytorch.org/whl/cpu \
 && pip install --no-cache-dir "kokoro==0.9.4" "misaki[en]==0.9.4" soundfile "kokoro-onnx==0.4.9" "onnxruntime==1.22.1"
WORKDIR /work
```

If a pin does not resolve, take the newest release of the same major (`pip index versions <pkg>` inside `python:3.12-slim`, run with `docker run --rm python:3.12-slim pip index versions kokoro-onnx`), write it into this Dockerfile, and name the change in the report. The versions that ran are recorded in `parity.json` either way.

- [ ] **Step 2: The proof script**

`tools/tts/parity.py`:

```python
"""Kokoro ONNX parity proof (spec 2026-09-27-kokoro-voice-design §4.1, plan Task 1): kokoro-onnx against
the PyTorch kokoro package (the build the user listened to in the bake-off) on the bake-off lines. Runs
in tools/tts/parity/'s container (run_docker.sh parity), never on the host.

For each line: the phonemes each build makes (compared over the model's vocabulary), the audio length,
and a spectral similarity against the PyTorch render. Kokoro's decoder draws noise, so PyTorch is not
even identical to itself: the similarity of two PyTorch renders with different seeds is the noise floor,
and ONNX passes when it is as close to PyTorch as PyTorch is to itself (within SIM_MARGIN).

Verdicts:
- onnx: every line's phonemes equal and its audio passes -> the service runs kokoro-onnx with its own
  phonemiser;
- onnx-misaki: some phonemes differ, but ONNX fed PyTorch's own phonemes (misaki's espeak G2P) passes on
  every line -> the service runs kokoro-onnx on misaki's phonemes;
- torch: otherwise -> the service runs the PyTorch CPU build.

Writes assets/tts-bakeoff/parity/<build>-<line>.wav (for listening; not committed) and
tools/tts/parity.json (committed)."""
from __future__ import annotations

import hashlib
import importlib.metadata as md
import json
import os
import time
import urllib.request
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "assets/tts-bakeoff/parity"
CACHE = Path(os.environ.get("TTS_CACHE", "/cache"))
THREADS = int(os.environ.get("TTS_THREADS", "4"))
SR = 24000
VOICE = "ff_siwis"
ONNX_BASE = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0"
ONNX_FILES = ["kokoro-v1.0.onnx", "voices-v1.0.bin"]
HF_REPO = "hexgrad/Kokoro-82M"
HF_FILES = ["kokoro-v1_0.pth", "config.json", "voices/ff_siwis.pt"]
MAX_LEN_DIFF_S = 0.05      # or MAX_LEN_DIFF_REL of the PyTorch length, whichever is larger
MAX_LEN_DIFF_REL = 0.02
SIM_MARGIN = 0.02
SIM_FLOOR_CAP = 0.97       # a floor above this (a deterministic decoder) is capped here


def lines() -> list[dict]:
    r1 = json.loads((ROOT / "tools/tts/lines.json").read_text(encoding="utf-8"))
    r2 = json.loads((ROOT / "tools/tts/round2.json").read_text(encoding="utf-8"))
    out = [{"id": k, "text": v["spoken"], "speed": 1.0} for k, v in r1["lines"].items()]
    out.append({"id": "a-slow", "text": r1["lines"]["a"]["spoken"], "speed": r1["slowRate"]})
    for k, s in r2["sentences"].items():
        out.append({"id": f"r2-{k}-C", "text": s["variants"]["C"], "speed": 1.0})
    for pace in r2["paces"]:
        out.append({"id": f"r2-a-C-{pace}", "text": r2["sentences"]["a"]["variants"]["C"], "speed": pace})
    return out


def sha256(p: Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def download(url: str, dest: Path) -> Path:
    if not dest.is_file():
        dest.parent.mkdir(parents=True, exist_ok=True)
        print(f"  fetching {url}", flush=True)
        req = urllib.request.Request(url, headers={"User-Agent": "discorde-tts-parity"})
        with urllib.request.urlopen(req, timeout=600) as r:
            tmp = dest.with_suffix(dest.suffix + ".part")
            tmp.write_bytes(r.read())
            tmp.rename(dest)
    return dest


def write_wav(path: Path, audio: np.ndarray) -> None:
    a = np.clip(np.asarray(audio, dtype=np.float32).reshape(-1), -1.0, 1.0)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((a * 32767).astype("<i2").tobytes())


def logspec(x: np.ndarray) -> np.ndarray:
    n, hop = 1024, 256
    x = np.asarray(x, dtype=np.float32)
    if len(x) < n:
        x = np.pad(x, (0, n - len(x)))
    frames = 1 + (len(x) - n) // hop
    idx = np.arange(n)[None, :] + hop * np.arange(frames)[:, None]
    mag = np.abs(np.fft.rfft(x[idx] * np.hanning(n).astype(np.float32), axis=1))
    return np.log(mag + 1e-5)


def similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Mean per-frame correlation of the two log spectrograms, over the shorter length (1 = same)."""
    m = min(len(a), len(b))
    A, B = logspec(a[:m]), logspec(b[:m])
    A = A - A.mean(axis=1, keepdims=True)
    B = B - B.mean(axis=1, keepdims=True)
    num = (A * B).sum(axis=1)
    den = np.sqrt((A * A).sum(axis=1) * (B * B).sum(axis=1)) + 1e-9
    return float((num / den).mean())


def vocab_only(ps: str, vocab) -> str:
    return "".join(c for c in " ".join(ps.split()) if c in vocab)


def torch_build():
    import torch
    from huggingface_hub import snapshot_download
    from kokoro import KPipeline

    torch.set_num_threads(THREADS)
    pipe = KPipeline(lang_code="f", repo_id=HF_REPO)
    local = Path(snapshot_download(HF_REPO, allow_patterns=HF_FILES))

    def synth(text: str, speed: float, seed: int):
        torch.manual_seed(seed)
        audio, ph = [], []
        for r in pipe(text, voice=VOICE, speed=speed):
            audio.append(r.audio.numpy())
            ph.append(r.phonemes)
        return np.concatenate(audio), ph

    files = {f: {"url": f"https://huggingface.co/{HF_REPO}/resolve/main/{f}", "sha256": sha256(local / f),
                 "bytes": (local / f).stat().st_size} for f in HF_FILES}
    return synth, pipe.model.vocab, files


def onnx_build():
    import onnxruntime as ort
    from kokoro_onnx import Kokoro

    paths = [download(f"{ONNX_BASE}/{f}", CACHE / "onnx" / f) for f in ONNX_FILES]
    opts = ort.SessionOptions()
    opts.intra_op_num_threads = THREADS
    opts.inter_op_num_threads = 1
    session = ort.InferenceSession(str(paths[0]), sess_options=opts, providers=["CPUExecutionProvider"])
    k = Kokoro.from_session(session, str(paths[1]))

    def from_phonemes(ps: str, speed: float) -> np.ndarray:
        # trim=False: spec §4.1, no silence removed beyond what Kokoro produces. (A kokoro-onnx without a
        # `trim` parameter does not trim: drop the argument then, and say so in the report.)
        audio, sr = k.create(ps, voice=VOICE, speed=speed, lang="fr-fr", is_phonemes=True, trim=False)
        assert sr == SR, sr
        return np.asarray(audio, dtype=np.float32).reshape(-1)

    def synth(text: str, speed: float):
        ps = k.tokenizer.phonemize(text, lang="fr-fr")
        return from_phonemes(ps, speed), ps

    files = {p.name: {"url": f"{ONNX_BASE}/{p.name}", "sha256": sha256(p), "bytes": p.stat().st_size} for p in paths}
    return synth, from_phonemes, files


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    t_synth, vocab, hf_files = torch_build()
    o_synth, o_from_ph, onnx_files = onnx_build()
    t_synth("Bonjour, virgule, les enfants. Point.", 1.0, 0)   # warm-up, not timed
    o_synth("Bonjour, virgule, les enfants. Point.", 1.0)
    rows = []
    for line in lines():
        lid, text, speed = line["id"], line["text"], line["speed"]
        t = time.perf_counter(); ta, tph = t_synth(text, speed, 0); t_gen = time.perf_counter() - t
        tb, _ = t_synth(text, speed, 1)
        t = time.perf_counter(); oa, oph = o_synth(text, speed); o_gen = time.perf_counter() - t
        fed = np.concatenate([o_from_ph(p, speed) for p in tph])
        for name, audio in (("torch", ta), ("onnx", oa), ("onnx-fed", fed)):
            write_wav(OUT / f"{name}-{lid}.wav", audio)
        t_s, o_s, f_s = len(ta) / SR, len(oa) / SR, len(fed) / SR
        tol = max(MAX_LEN_DIFF_S, MAX_LEN_DIFF_REL * t_s)
        floor = similarity(tb, ta)
        need = min(floor, SIM_FLOOR_CAP) - SIM_MARGIN
        row = {
            "id": lid, "speed": speed, "chars": len(text),
            "phonemes_torch": " | ".join(tph), "phonemes_onnx": oph,
            "phonemes_equal": vocab_only(" ".join(tph), vocab) == vocab_only(oph, vocab),
            "torch_s": round(t_s, 3), "onnx_s": round(o_s, 3), "onnx_fed_s": round(f_s, 3),
            "noise_floor": round(floor, 4), "needed": round(need, 4),
            "similarity": round(similarity(oa, ta), 4), "similarity_fed": round(similarity(fed, ta), 4),
            "torch_rtf": round(t_gen / t_s, 3), "onnx_rtf": round(o_gen / o_s, 3),
        }
        row["onnx_ok"] = row["phonemes_equal"] and abs(o_s - t_s) <= tol and row["similarity"] >= need
        row["onnx_fed_ok"] = abs(f_s - t_s) <= tol and row["similarity_fed"] >= need
        rows.append(row)
        print(f"  {lid:14} phonemes {'=' if row['phonemes_equal'] else '≠'}  len {t_s:6.2f}/{o_s:6.2f}/{f_s:6.2f} s"
              f"  sim {row['similarity']:.3f}/{row['similarity_fed']:.3f} (need {need:.3f})"
              f"  ok {row['onnx_ok']}/{row['onnx_fed_ok']}", flush=True)
    if all(r["onnx_ok"] for r in rows):
        verdict = "onnx"
    elif all(r["onnx_fed_ok"] for r in rows):
        verdict = "onnx-misaki"
    else:
        verdict = "torch"
    result = {
        "verdict": verdict,
        "versions": {p: md.version(p) for p in ("torch", "kokoro", "misaki", "kokoro-onnx", "onnxruntime", "soundfile")},
        "threads": THREADS,
        "criteria": {"max_len_diff_s": MAX_LEN_DIFF_S, "max_len_diff_rel": MAX_LEN_DIFF_REL,
                     "sim_margin": SIM_MARGIN, "sim_floor_cap": SIM_FLOOR_CAP},
        "files": {"onnx": onnx_files, "torch": hf_files},
        "lines": rows,
    }
    (ROOT / "tools/tts/parity.json").write_text(json.dumps(result, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"== verdict: {verdict}", flush=True)


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: The command**

In `tools/tts/run_docker.sh`, add to the usage block at the top (it is printed by `sed -n '2,9p'`, so keep the usage within lines 2–9: replace the `round2-bake` usage line with two lines only if they still fit, otherwise shorten the comment lines around it):

```bash
#   tools/tts/run_docker.sh parity      # Kokoro plan Task 1: kokoro-onnx vs PyTorch kokoro -> parity.json
```

and a case before `*)`:

```bash
  parity)
    # Kokoro plan, Task 1 (parity.py): the ONNX build against the PyTorch one, at the service's thread count.
    image=$(image_for parity)
    with_playwright_lock docker run --rm --cpuset-cpus "$CPUS" \
      -e TTS_THREADS=4 -e OMP_NUM_THREADS=4 -e MKL_NUM_THREADS=4 \
      -e HF_HOME=/cache/hf -e TTS_CACHE=/cache -e PYTHONUNBUFFERED=1 \
      -v "$CACHE_VOLUME:/cache" -v "$REPO:/work" -w /work "$image" python tools/tts/parity.py
    ;;
```

- [ ] **Step 4: Run it**

Run: `tools/tts/run_docker.sh parity`
Expected: one line per bake-off line (13 lines: `a`, `b1`, `b2`, `c`, `a-slow`, `r2-{a,q,x,el,sc,co}-C`, `r2-a-C-0.75`, `r2-a-C-0.85`), then `== verdict: <onnx|onnx-misaki|torch>`; `tools/tts/parity.json` written; `assets/tts-bakeoff/parity/*.wav` for listening. Paste the table and the verdict into the report. A crash or an exception is a failure of this step (fix the script, never the criteria). The controller may offer the user a listening pass on `assets/tts-bakeoff/parity/{torch,onnx}-r2-*-C.wav`; the verdict stands on the criteria either way.

- [ ] **Step 5: Document it**

Append to `tools/tts/README.md`:

```markdown
## Parity: ONNX against PyTorch (Kokoro plan, Task 1)

The game's voice service (`tts/`) runs Kokoro-82M. `parity.py` checks that the ONNX build (`kokoro-onnx`
+ onnxruntime, no PyTorch) speaks like the PyTorch `kokoro` package the bake-off used: the same phonemes
(over the model's vocabulary), the same length (within 50 ms or 2 %), and a spectrogram as close to
PyTorch's as two PyTorch renders with different seeds are to each other (Kokoro's decoder draws noise),
within 0.02. `parity.json` holds the verdict, the versions that ran, each model file's sha256 (the
service's Dockerfile checks them) and a row per line; the samples land in `assets/tts-bakeoff/parity/`.

    tools/tts/run_docker.sh parity

Verdict: **<verdict>** (<one sentence: what differed, if anything, and which build the service uses>).
```

Replace `<verdict>` and the sentence with the run's result (this is the step's output, not a placeholder left in the file).

- [ ] **Step 6: Commit**

```bash
git add tools/tts/parity/Dockerfile tools/tts/parity.py tools/tts/parity.json tools/tts/run_docker.sh tools/tts/README.md
git commit -m "Kokoro Task 1: ONNX parity proof against the PyTorch build on the bake-off lines (verdict in tools/tts/parity.json)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- tools/tts/parity/Dockerfile tools/tts/parity.py tools/tts/parity.json tools/tts/run_docker.sh tools/tts/README.md
```

---

### Task 2: The `tts` service, engine-neutral, with the stub

**Files:**
- Create: `tts/Dockerfile`, `tts/.dockerignore`, `tts/requirements.txt`, `tts/requirements-dev.txt`, `tts/pytest.ini`, `tts/respell.json`
- Create: `tts/app/__init__.py` (empty), `tts/app/config.py`, `tts/app/text.py`, `tts/app/cache.py`, `tts/app/worker.py`, `tts/app/audio.py`, `tts/app/engine.py`, `tts/app/main.py`
- Create: `tts/tests/__init__.py` (empty), `tts/tests/conftest.py`, `tts/tests/test_text.py`, `tts/tests/test_cache.py`, `tts/tests/test_worker.py`, `tts/tests/test_audio.py`, `tts/tests/test_api.py`
- Create: `scripts/tts-pytest.sh`; Modify: `scripts/lib.sh`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces (Task 3 and Task 4 rely on these exact names):
  - `app.engine.Engine` (Protocol: `model_id: str`, `synth(text: str, speed: float) -> np.ndarray` float32 mono at 24 kHz), `StubEngine` (`model_id = "stub"`), `load_engine(config: Config) -> Engine` (imports `app.kokoro.KokoroEngine(model_dir: Path, threads: int)` when not stubbed: Task 3 writes it).
  - `app.text`: `MAX_CHARS = 10_000`, `MIN_SPEED = 0.5`, `MAX_SPEED = 1.5`, `SEGMENT_CHARS = 300`, `normalise(text) -> str`, `Respeller(table)` / `Respeller.load(path)` / `__call__(text) -> str`, `segments(text, limit=SEGMENT_CHARS) -> list[str]`.
  - `app.audio`: `SR = 24000`, `STUB_MS_PER_CHAR = 65`, `stub_ms(text, speed) -> int`, `silence(ms) -> np.ndarray`, `encode_mp3(samples) -> bytes`.
  - `app.cache`: `FORMAT_VERSION = 1`, `cache_key(model, voice, speed, text) -> str`, `Cache(root, limit_bytes)` with `path(key)`, `get(key) -> bytes | None`, `put(key, data)`.
  - `app.worker`: `Line(text: str, speed: float)`, `Worker(make, cache, key)` with `start()`, `stop()`, `request(line, urgent: bool) -> concurrent.futures.Future[bytes]`, `pending() -> list[str]`.
  - `app.main.create_app(config: Config | None = None, engine_factory=load_engine) -> FastAPI`, `VOICE = "ff_siwis"`, `MAX_PREPARE_LINES = 500`; HTTP: `POST /speak {text, speed}` → `audio/mpeg`; `POST /prepare {lines: [{text, speed}]}` → 202 `{"queued": n}`; `GET /health` → 200 `{"status": "ready", "engine": <model_id>}` or 503 `{"status": "loading"}` / `{"status": "error", "detail": …}`.
  - `scripts/lib.sh`: `TTS_IMAGE` (exported, `$STACK_NAME-tts:local`), `TTS_TEST_IMAGE` (`$STACK_NAME-tts-test`). `scripts/tts-pytest.sh [pytest args]`.
  - `tts/Dockerfile` stages `base` (dependencies, later the model), `test` (base + pytest), `runtime` (last, the default: base + the app).

- [ ] **Step 1: The toolchain wrapper and the image**

In `scripts/lib.sh`, after the `export SERVER_DEV_IMAGE=…` line:

```bash
# The dictation voice's service (tts/, Kokoro plan): its image and its test image, per stack like the
# app's. compose*.yaml read TTS_IMAGE; scripts/tts-pytest.sh builds and runs the test image.
export TTS_IMAGE="$STACK_NAME-tts:local"
TTS_TEST_IMAGE="$STACK_NAME-tts-test"
```

`scripts/tts-pytest.sh` (make it executable: `git add --chmod=+x` at commit time):

```bash
#!/usr/bin/env bash
# Run pytest inside the voice service's test image (tts/Dockerfile, target `test`), in tts/.
# Example: scripts/tts-pytest.sh -q tests/test_text.py      scripts/tts-pytest.sh -q -m "not model"
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
docker build -q --target test -t "$TTS_TEST_IMAGE" "$HOST_ROOT/tts" >/dev/null
docker run --rm $TTY_FLAGS \
  -v "$HOST_ROOT/tts:/srv" -w /srv \
  -e PYTHONDONTWRITEBYTECODE=1 \
  "$TTS_TEST_IMAGE" python -m pytest "$@"
```

`tts/Dockerfile`:

```dockerfile
# syntax=docker/dockerfile:1.7
# The dictation's voice (spec 2026-09-27-kokoro-voice-design §4.1): Kokoro-82M behind a small FastAPI
# app, internal to the compose network (no published port). Stages: `base` (dependencies and, from the
# Kokoro plan's Task 3, the model), `test` (base + pytest, scripts/tts-pytest.sh mounts tts/ at /srv),
# `runtime` (the default target: base + the app).
FROM python:3.12-slim AS base
ENV PYTHONUNBUFFERED=1 PIP_DISABLE_PIP_VERSION_CHECK=1 \
    TTS_CACHE_DIR=/cache TTS_MODEL_DIR=/models TTS_RESPELL=/srv/respell.json
WORKDIR /srv
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

FROM base AS test
COPY requirements-dev.txt ./
RUN pip install --no-cache-dir -r requirements-dev.txt

FROM base AS runtime
COPY app app
COPY respell.json ./
VOLUME ["/cache"]
EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=3s --start-period=120s --retries=5 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health').status==200 else 1)"
# --timeout-keep-alive 75: the root Dockerfile's reason (a pooled keep-alive socket racing the server's
# close); here the pooled client is the game server's httpx.Client.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--timeout-keep-alive", "75"]
```

`tts/.dockerignore`:

```
**/__pycache__
.pytest_cache
tests
```

`tts/requirements.txt`:

```
fastapi>=0.115,<1
uvicorn[standard]>=0.30,<1
numpy>=2,<3
soundfile>=0.13,<0.14
```

`tts/requirements-dev.txt`:

```
pytest>=8
httpx>=0.27
```

`tts/pytest.ini`:

```ini
[pytest]
testpaths = tests
markers =
    model: needs the real Kokoro model baked into the image (tts/Dockerfile, Kokoro plan Task 3)
filterwarnings =
    ignore::DeprecationWarning:httpx.*
    ignore::DeprecationWarning:starlette.*
    ignore:Using .httpx. with .starlette\.testclient. is deprecated
```

`tts/respell.json`:

```json
{}
```

- [ ] **Step 2: Write the failing tests**

`tts/tests/conftest.py`:

```python
import time

import pytest
from fastapi.testclient import TestClient

from app.audio import silence, stub_ms
from app.config import Config
from app.main import create_app


@pytest.fixture
def config(tmp_path):
    (tmp_path / "respell.json").write_text("{}", encoding="utf-8")
    return Config(stub=True, threads=1, cache_dir=tmp_path / "cache", cache_mb=64,
                  respell_path=tmp_path / "respell.json", model_dir=tmp_path / "models")


def wait_ready(client, timeout: float = 10.0) -> None:
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        if client.get("/health").status_code == 200:
            return
        time.sleep(0.02)
    raise AssertionError(f"the voice never got ready: {client.get('/health').json()}")


class SpyEngine:
    """Says silence like the stub, and writes down what it was given."""
    model_id = "spy"

    def __init__(self, ms: int | None = None, fail: int = 0):
        self.said: list[tuple[str, float]] = []
        self.ms = ms
        self.fail = fail

    def synth(self, text: str, speed: float):
        self.said.append((text, speed))
        if self.fail:
            self.fail -= 1
            raise RuntimeError("the model tripped")
        return silence(self.ms if self.ms is not None else stub_ms(text, speed))


@pytest.fixture
def client(config):
    with TestClient(create_app(config)) as c:
        wait_ready(c)
        yield c
```

`tts/tests/test_text.py`:

```python
import pytest

from app.text import MAX_CHARS, Respeller, normalise, segments


def test_the_voice_hears_plain_single_spaces():
    assert normalise("Bonjour ! Je lirai tes  dictées.\n") == "Bonjour ! Je lirai tes dictées."


def test_respells_whole_words_only():
    r = Respeller({"Seguin": "Segin", "ail": "aille"})
    assert r("Monsieur Seguin cueille de l'ail.") == "Monsieur Segin cueille de l'aille."
    assert r("Le travail et les ailes, l'ail-des-ours.") == "Le travail et les ailes, l'ail-des-ours."


def test_respelling_is_case_sensitive():
    assert Respeller({"Seguin": "Segin"})("seguin") == "seguin"


def test_the_longest_entry_wins():
    r = Respeller({"Saint": "Sin", "Saint-Exupéry": "Sainte-Xupéri"})
    assert r("Saint-Exupéry et Saint Louis") == "Sainte-Xupéri et Sin Louis"


def test_an_empty_table_changes_nothing(tmp_path):
    (tmp_path / "r.json").write_text("{}", encoding="utf-8")
    assert Respeller.load(tmp_path / "r.json")("Un matin. Point.") == "Un matin. Point."
    assert Respeller.load(tmp_path / "missing.json")("x") == "x"


def test_a_malformed_table_is_refused(tmp_path):
    (tmp_path / "r.json").write_text('{"a": 1}', encoding="utf-8")
    with pytest.raises(ValueError):
        Respeller.load(tmp_path / "r.json")


def test_a_short_line_is_one_segment():
    assert segments("Un matin, virgule, l'œuf se fendit. Point.") == ["Un matin, virgule, l'œuf se fendit. Point."]


def test_a_long_line_is_cut_after_a_named_full_stop_only():
    sentence = "Le loup, virgule, arriva près de la bergerie. Point."
    text = " ".join([sentence] * 12)
    parts = segments(text, limit=120)
    assert " ".join(parts) == text
    assert all(len(p) <= 120 for p in parts)
    assert all(p.endswith("Point.") for p in parts)


def test_a_mark_and_its_name_are_never_apart():
    a, b = "A" * 50 + ". Point.", "B" * 50 + " ? Point d'interrogation."
    assert segments(f"{a} {b}", limit=60) == [a, b]
    ellipsis = "C" * 50 + "… Points de suspension."
    assert segments(f"{ellipsis} {a}", limit=60) == [ellipsis, a]


def test_an_overlong_sentence_stays_whole():
    text = "mot " * 100 + "fin. Point."
    assert segments(text, limit=50) == [text]


def test_the_limit_is_ten_thousand_characters():
    # Kokoro plan Ruling K1: pace 4's full reading of a 4 000-character text (web MAX_LINE_CHARS).
    assert MAX_CHARS == 10_000
```

`tts/tests/test_cache.py`:

```python
import os

from app import cache as cache_mod
from app.cache import Cache, cache_key


def test_the_key_names_everything_that_changes_the_sound():
    base = cache_key("m", "ff_siwis", 1.0, "Un matin. Point.")
    assert base == cache_key("m", "ff_siwis", 1.0, "Un matin. Point.")
    assert len(base) == 64
    others = {cache_key("m2", "ff_siwis", 1.0, "Un matin. Point."), cache_key("m", "af_heart", 1.0, "Un matin. Point."),
              cache_key("m", "ff_siwis", 0.9, "Un matin. Point."), cache_key("m", "ff_siwis", 1.0, "Un soir. Point.")}
    assert base not in others and len(others) == 4
    assert cache_key("m", "v", 0.9, "x") == cache_key("m", "v", 0.9000001, "x")


def test_the_format_version_changes_the_key(monkeypatch):
    before = cache_key("m", "v", 1.0, "x")
    monkeypatch.setattr(cache_mod, "FORMAT_VERSION", cache_mod.FORMAT_VERSION + 1)
    assert cache_key("m", "v", 1.0, "x") != before


def test_a_line_comes_back_as_it_went_in(tmp_path):
    c = Cache(tmp_path, limit_bytes=1000)
    assert c.get("k") is None
    c.put("k", b"mp3")
    assert c.get("k") == b"mp3"
    assert c.path("k") == tmp_path / "k.mp3"
    assert list(tmp_path.glob("*.part")) == []


def test_the_least_recently_used_lines_go_first(tmp_path):
    c = Cache(tmp_path, limit_bytes=250)
    c.put("a", b"x" * 100)
    os.utime(c.path("a"), (1000, 1000))
    c.put("b", b"x" * 100)
    os.utime(c.path("b"), (1001, 1001))
    c.put("c", b"x" * 100)          # 300 > 250: « a », the oldest, goes
    assert c.get("a") is None
    os.utime(c.path("c"), (2000, 2000))
    assert c.get("b") == b"x" * 100  # read now: the most recent
    c.put("d", b"x" * 100)          # « c » is now the oldest
    assert c.get("c") is None
    assert c.get("b") is not None and c.get("d") is not None


def test_what_an_earlier_run_left_counts(tmp_path):
    for k in "abc":
        (tmp_path / f"{k}.mp3").write_bytes(b"x" * 100)
        os.utime(tmp_path / f"{k}.mp3", (1000 + ord(k), 1000 + ord(k)))
    (tmp_path / "z.part").write_bytes(b"half")
    c = Cache(tmp_path, limit_bytes=250)
    assert not (tmp_path / "z.part").exists()
    c.put("d", b"x" * 100)
    assert sorted(p.stem for p in tmp_path.glob("*.mp3")) == ["c", "d"]
```

`tts/tests/test_worker.py`:

```python
import threading

from app.cache import Cache
from app.worker import Line, Worker


def blocking():
    """A `make` that holds its first line until released; every line after it goes straight through."""
    started, release, made = threading.Event(), threading.Event(), []

    def make(line: Line) -> bytes:
        made.append(line.text)
        started.set()
        release.wait(5)
        return b"mp3:" + line.text.encode()

    return make, started, release, made


def worker(tmp_path, make):
    w = Worker(make, Cache(tmp_path, 10_000_000), key=lambda line: f"{line.speed}|{line.text}")
    w.start()
    return w


def test_lines_are_made_one_at_a_time_in_order(tmp_path):
    make, started, release, made = blocking()
    w = worker(tmp_path, make)
    futures = [w.request(Line(t, 1.0), urgent=False) for t in "ABC"]
    started.wait(5)
    assert w.pending() == ["B", "C"]
    release.set()
    assert [f.result(5) for f in futures] == [b"mp3:A", b"mp3:B", b"mp3:C"]
    assert made == ["A", "B", "C"]
    w.stop()


def test_a_line_asked_for_now_jumps_the_queue(tmp_path):
    make, started, release, made = blocking()
    w = worker(tmp_path, make)
    w.request(Line("A", 1.0), urgent=False)
    started.wait(5)
    w.request(Line("B", 1.0), urgent=False)
    w.request(Line("C", 1.0), urgent=False)
    d = w.request(Line("D", 1.0), urgent=True)
    assert w.pending() == ["D", "B", "C"]
    c = w.request(Line("C", 1.0), urgent=True)   # already queued: moves to the front
    assert w.pending() == ["C", "D", "B"]
    release.set()
    c.result(5), d.result(5)
    w.stop()
    assert made[:3] == ["A", "C", "D"]


def test_two_requests_for_one_line_share_one_job(tmp_path):
    make, started, release, made = blocking()
    w = worker(tmp_path, make)
    w.request(Line("A", 1.0), urgent=False)
    started.wait(5)
    first = w.request(Line("B", 1.0), urgent=False)
    again = w.request(Line("B", 1.0), urgent=True)
    running = w.request(Line("A", 1.0), urgent=True)   # being made: the same job too
    assert again is first
    release.set()
    assert first.result(5) == b"mp3:B" and running.result(5) == b"mp3:A"
    w.stop()
    assert made == ["A", "B"]


def test_a_cached_line_needs_no_job(tmp_path):
    make, _, release, made = blocking()
    release.set()
    w = worker(tmp_path, make)
    assert w.request(Line("A", 1.0), urgent=True).result(5) == b"mp3:A"
    assert w.request(Line("A", 1.0), urgent=True).result(5) == b"mp3:A"
    assert made == ["A"]
    w.stop()


def test_a_failed_line_is_tried_again_when_asked_again(tmp_path):
    calls = []

    def make(line: Line) -> bytes:
        calls.append(line.text)
        if len(calls) == 1:
            raise RuntimeError("tripped")
        return b"ok"

    w = worker(tmp_path, make)
    failed = w.request(Line("A", 1.0), urgent=True)
    assert isinstance(failed.exception(5), RuntimeError)
    assert w.request(Line("A", 1.0), urgent=True).result(5) == b"ok"
    w.stop()
```

`tts/tests/test_audio.py`:

```python
import io

import numpy as np
import soundfile as sf

from app.audio import SR, encode_mp3, silence, stub_ms


def test_mp3_is_available():
    assert "MP3" in sf.available_formats()


def test_an_mp3_keeps_the_length_rate_and_single_channel():
    t = np.linspace(0, 2, 2 * SR, endpoint=False, dtype=np.float32)
    info = sf.info(io.BytesIO(encode_mp3(0.3 * np.sin(2 * np.pi * 220 * t))))
    assert info.samplerate == 24000 and info.channels == 1
    assert abs(info.duration - 2.0) <= 0.15


def test_the_stub_takes_as_long_as_the_line_would():
    # web/src/lib/dictation/voice.ts: 65 ms a character, divided by the rate, at least 300 ms.
    assert stub_ms("x" * 100, 1.0) == 6500
    assert stub_ms("x" * 100, 0.75) == round(6500 / 0.75)
    assert stub_ms("abc", 1.0) == 300
    assert len(silence(1500)) == int(1.5 * SR)
```

`tts/tests/test_api.py`:

```python
import io
import threading

import pytest
import soundfile as sf
from fastapi.testclient import TestClient

from app.audio import stub_ms
from app.main import MAX_PREPARE_LINES, create_app
from tests.conftest import SpyEngine, wait_ready


def test_health_says_ready_and_names_its_engine(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ready", "engine": "stub"}


def test_speak_returns_a_silent_mp3_as_long_as_the_line(client):
    text = "Un matin, virgule, l'œuf se fendit. Point."
    for speed in (1.0, 0.75):
        r = client.post("/speak", json={"text": text, "speed": speed})
        assert r.status_code == 200
        assert r.headers["content-type"] == "audio/mpeg"
        info = sf.info(io.BytesIO(r.content))
        assert info.samplerate == 24000 and info.channels == 1
        assert abs(info.duration * 1000 - stub_ms(text, speed)) <= 150


def test_a_line_is_made_once_then_served_from_the_cache(config):
    spy = SpyEngine()
    with TestClient(create_app(config, engine_factory=lambda c: spy)) as c:
        wait_ready(c)
        a = c.post("/speak", json={"text": "Un matin. Point.", "speed": 0.9}).content
        b = c.post("/speak", json={"text": "Un matin. Point.", "speed": 0.9}).content
    assert a == b and spy.said == [("Un matin. Point.", 0.9)]
    assert len(list(config.cache_dir.glob("*.mp3"))) == 1
    with TestClient(create_app(config, engine_factory=lambda c: spy)) as c:   # a restart keeps the cache
        wait_ready(c)
        c.post("/speak", json={"text": "Un matin. Point.", "speed": 0.9})
    assert len(spy.said) == 1


def test_prepare_queues_the_lines_in_order(config):
    spy = SpyEngine(ms=50)
    lines = [{"text": f"Phrase {i}. Point.", "speed": 0.85} for i in range(3)]
    with TestClient(create_app(config, engine_factory=lambda c: spy)) as c:
        wait_ready(c)
        r = c.post("/prepare", json={"lines": lines})
        assert r.status_code == 202 and r.json() == {"queued": 3}
        for line in lines:   # each one is cached once made: /speak then needs no new synthesis
            assert c.post("/speak", json=line).status_code == 200
    assert [t for t, _ in spy.said] == [line["text"] for line in lines]


def test_respelling_and_plain_spaces_reach_the_voice(config):
    config.respell_path.write_text('{"Seguin": "Segin"}', encoding="utf-8")
    spy = SpyEngine(ms=50)
    with TestClient(create_app(config, engine_factory=lambda c: spy)) as c:
        wait_ready(c)
        c.post("/speak", json={"text": "Bonjour ! monsieur Seguin. Point.", "speed": 1.0})
    assert spy.said == [("Bonjour ! monsieur Segin. Point.", 1.0)]


@pytest.mark.parametrize("body", [
    {"text": "", "speed": 1.0}, {"text": "   ", "speed": 1.0}, {"text": "a" * 10_001, "speed": 1.0},
    {"text": "a", "speed": 0.49}, {"text": "a", "speed": 1.51}, {"text": "a"}, {"speed": 1.0},
])
def test_speak_refuses_what_it_cannot_say(client, body):
    assert client.post("/speak", json=body).status_code == 422


def test_the_limits_themselves_are_accepted(config):
    # Review Focus 1: pace 4's full reading of a long text is one line of several thousand characters.
    spy = SpyEngine(ms=50)
    with TestClient(create_app(config, engine_factory=lambda c: spy)) as c:
        wait_ready(c)
        for body in ({"text": "a" * 10_000, "speed": 1.0}, {"text": "a", "speed": 0.5}, {"text": "a", "speed": 1.5}):
            assert c.post("/speak", json=body).status_code == 200


def test_prepare_refuses_a_bad_line_or_too_many(client):
    assert client.post("/prepare", json={"lines": [{"text": "a", "speed": 2.0}]}).status_code == 422
    many = [{"text": f"l{i}", "speed": 1.0} for i in range(MAX_PREPARE_LINES + 1)]
    assert client.post("/prepare", json={"lines": many}).status_code == 422


def test_a_voice_still_loading_answers_503(config):
    gate = threading.Event()

    def slow_factory(c):
        gate.wait(5)
        return SpyEngine(ms=50)

    with TestClient(create_app(config, engine_factory=slow_factory)) as c:
        r = c.get("/health")
        assert r.status_code == 503 and r.json() == {"status": "loading"}
        assert c.post("/speak", json={"text": "a", "speed": 1.0}).status_code == 503
        assert c.post("/prepare", json={"lines": []}).status_code == 503
        gate.set()
        wait_ready(c)
        assert c.post("/speak", json={"text": "a", "speed": 1.0}).status_code == 200


def test_a_voice_that_cannot_load_says_so(config):
    def broken(c):
        raise RuntimeError("no model here")

    with TestClient(create_app(config, engine_factory=broken)) as c:
        for _ in range(500):
            r = c.get("/health")
            if r.json()["status"] != "loading":
                break
        assert r.status_code == 503
        assert r.json() == {"status": "error", "detail": "RuntimeError: no model here"}


def test_a_line_that_fails_is_a_500_and_is_tried_again_next_time(config):
    spy = SpyEngine(ms=50, fail=1)
    with TestClient(create_app(config, engine_factory=lambda c: spy)) as c:
        wait_ready(c)
        assert c.post("/speak", json={"text": "a", "speed": 1.0}).status_code == 500
        assert c.post("/speak", json={"text": "a", "speed": 1.0}).status_code == 200
```

(The error-state test polls `/health` without sleeping: the failing factory returns at once, so a few hundred requests are ample; if it proves flaky, poll with `wait`-style `time.monotonic()` as `wait_ready` does.)

- [ ] **Step 3: Run the tests to see them fail**

Run: `scripts/tts-pytest.sh -q`
Expected: collection errors (`ModuleNotFoundError: No module named 'app.config'` and the like).

- [ ] **Step 4: Write the implementation**

`tts/app/config.py`:

```python
"""The voice service's environment (spec 2026-09-27 §4.1)."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Config:
    stub: bool
    threads: int
    cache_dir: Path
    cache_mb: int
    respell_path: Path
    model_dir: Path

    @classmethod
    def from_env(cls) -> "Config":
        return cls(
            stub=os.environ.get("TTS_STUB") == "1",
            threads=max(1, int(os.environ.get("TTS_THREADS", "4"))),
            cache_dir=Path(os.environ.get("TTS_CACHE_DIR", "/cache")),
            cache_mb=max(1, int(os.environ.get("TTS_CACHE_MB", "2048"))),
            respell_path=Path(os.environ.get("TTS_RESPELL", "/srv/respell.json")),
            model_dir=Path(os.environ.get("TTS_MODEL_DIR", "/models")),
        )
```

`tts/app/text.py`:

```python
"""What the voice is given to say (spec 2026-09-27 §4.1): the line as the game sent it, spaced plainly,
with the pronunciation fixes of respell.json applied, cut into segments the model reads well."""
from __future__ import annotations

import json
import re
from pathlib import Path

MAX_CHARS = 10_000   # one line (Kokoro plan Ruling K1; web/src/lib/dictation/script.ts MAX_LINE_CHARS)
MIN_SPEED, MAX_SPEED = 0.5, 1.5
SEGMENT_CHARS = 300  # a line up to this length is one synthesis, as in the bake-off

_SPACES = re.compile(r"[\s  ]+")
# A segment may end after a full stop, never between a sentence-ending mark and its spoken name
# (« froissées. Point. »): the next word must not be « Point » or « Points ».
_BOUNDARY = re.compile(r"(?<=\.)\s+(?!Points?\b)")


def normalise(text: str) -> str:
    """Plain single spaces: the game's French spacing (U+202F, U+00A0) means nothing to the voice."""
    return _SPACES.sub(" ", text).strip()


class Respeller:
    """Word -> respelling (Ruling K3): case-sensitive, whole words only, never inside another word or a
    hyphenated compound; after an elided article (« l'Hydre ») it applies. The longest entry wins."""

    def __init__(self, table: dict[str, str]):
        self.table = dict(table)
        words = sorted(self.table, key=len, reverse=True)
        self._re = re.compile(r"(?<![\w-])(" + "|".join(map(re.escape, words)) + r")(?![\w-])") if words else None

    @classmethod
    def load(cls, path: Path) -> "Respeller":
        table = json.loads(path.read_text(encoding="utf-8")) if path.is_file() else {}
        if not isinstance(table, dict) or not all(isinstance(k, str) and k and isinstance(v, str) for k, v in table.items()):
            raise ValueError(f"{path}: expected an object of word -> respelling strings")
        return cls(table)

    def __call__(self, text: str) -> str:
        return self._re.sub(lambda m: self.table[m.group(1)], text) if self._re else text


def segments(text: str, limit: int = SEGMENT_CHARS) -> list[str]:
    """The line cut after named full stops into pieces of at most `limit` characters, greedily; a single
    sentence longer than `limit` stays whole (the engine splits it itself)."""
    out: list[str] = []
    current = ""
    for part in _BOUNDARY.split(text):
        if current and len(current) + 1 + len(part) > limit:
            out.append(current)
            current = part
        else:
            current = f"{current} {part}" if current else part
    if current:
        out.append(current)
    return out
```

`tts/app/audio.py`:

```python
"""Audio out of the voice: MP3, 24 kHz mono (spec 2026-09-27 §4.1), and the stub's silence."""
from __future__ import annotations

import io

import numpy as np
import soundfile as sf

SR = 24000
STUB_MS_PER_CHAR = 65  # web/src/lib/dictation/voice.ts SPEECH_MS_PER_CHAR


def stub_ms(text: str, speed: float) -> int:
    """How long the stub's silence lasts: what the game waits for a muted line (voice.ts speechMs)."""
    return max(300, round(len(text) * STUB_MS_PER_CHAR / speed))


def silence(ms: int) -> np.ndarray:
    return np.zeros(int(SR * ms / 1000), dtype=np.float32)


def encode_mp3(samples: np.ndarray) -> bytes:
    """MP3 through libsndfile (the soundfile wheel bundles one with MPEG support, Ruling K13)."""
    buf = io.BytesIO()
    audio = np.clip(np.asarray(samples, dtype=np.float32).reshape(-1), -1.0, 1.0)
    sf.write(buf, audio, SR, format="MP3", subtype="MPEG_LAYER_III")
    return buf.getvalue()
```

If `test_mp3_is_available` fails (the wheel's libsndfile has no MP3), add `lameenc>=1.8,<2` to `requirements.txt` and use instead:

```python
import lameenc


def encode_mp3(samples: np.ndarray) -> bytes:
    enc = lameenc.Encoder()
    enc.set_bit_rate(64)
    enc.set_in_sample_rate(SR)
    enc.set_channels(1)
    enc.set_quality(2)
    pcm = (np.clip(np.asarray(samples, dtype=np.float32).reshape(-1), -1.0, 1.0) * 32767).astype("<i2").tobytes()
    return bytes(enc.encode(pcm) + enc.flush())
```

(and drop `test_mp3_is_available`'s assertion in favour of the round-trip test, which decodes with soundfile's MP3 reader or, if that is missing too, checks the frame header `data[:3] == b"ID3" or data[0] == 0xFF`). Say which one shipped in the report.

`tts/app/cache.py`:

```python
"""The line cache (spec 2026-09-27 §4.1): one MP3 per line in /cache (its own volume, no backup needed),
named by what changes the sound; the least recently used go first once past TTS_CACHE_MB."""
from __future__ import annotations

import hashlib
import json
import os
import threading
from pathlib import Path

FORMAT_VERSION = 1  # bump when the MP3s change for the same inputs (bitrate, encoder, trimming)


def cache_key(model: str, voice: str, speed: float, text: str) -> str:
    raw = json.dumps([model, voice, round(speed, 3), text, FORMAT_VERSION], ensure_ascii=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


class Cache:
    def __init__(self, root: Path, limit_bytes: int):
        self.root = root
        self.limit = limit_bytes
        self._lock = threading.Lock()
        root.mkdir(parents=True, exist_ok=True)
        for part in root.glob("*.part"):   # a write cut short by a stop
            part.unlink(missing_ok=True)
        self._total = sum(f.stat().st_size for f in root.glob("*.mp3"))

    def path(self, key: str) -> Path:
        return self.root / f"{key}.mp3"

    def get(self, key: str) -> bytes | None:
        p = self.path(key)
        try:
            data = p.read_bytes()
            os.utime(p)   # most recently used = newest mtime (atime is unreliable on noatime mounts)
        except FileNotFoundError:
            return None
        return data

    def put(self, key: str, data: bytes) -> None:
        p = self.path(key)
        tmp = p.with_suffix(".part")
        with self._lock:
            old = p.stat().st_size if p.exists() else 0
            tmp.write_bytes(data)
            os.replace(tmp, p)
            self._total += len(data) - old
            if self._total > self.limit:
                self._evict(keep=p)

    def _evict(self, keep: Path) -> None:
        files = []
        for f in self.root.glob("*.mp3"):
            if f == keep:
                continue
            try:
                files.append((f.stat().st_mtime, f))
            except FileNotFoundError:
                continue
        for _, f in sorted(files):
            if self._total <= self.limit:
                break
            try:
                size = f.stat().st_size
                f.unlink()
            except FileNotFoundError:
                continue
            self._total -= size
```

`tts/app/worker.py`:

```python
"""One worker thread makes the lines one at a time (spec 2026-09-27 §4.1): a line asked for now goes to
the front of the queue, and two requests for the same line share one job."""
from __future__ import annotations

import threading
from collections import deque
from concurrent.futures import Future
from dataclasses import dataclass, field
from typing import Callable

from app.cache import Cache


@dataclass(frozen=True)
class Line:
    text: str    # normalised and respelled
    speed: float


@dataclass(eq=False)
class _Job:
    key: str
    line: Line
    future: Future = field(default_factory=Future)


class Worker:
    def __init__(self, make: Callable[[Line], bytes], cache: Cache, key: Callable[[Line], str]):
        self._make, self._cache, self._key = make, cache, key
        self._queue: deque[_Job] = deque()
        self._jobs: dict[str, _Job] = {}
        self._cv = threading.Condition()
        self._stopping = False
        self._thread = threading.Thread(target=self._run, name="tts-worker", daemon=True)

    def start(self) -> None:
        self._thread.start()

    def stop(self) -> None:
        with self._cv:
            self._stopping = True
            self._cv.notify_all()
        self._thread.join(timeout=5)

    def request(self, line: Line, urgent: bool) -> Future:
        k = self._key(line)
        data = self._cache.get(k)
        if data is not None:
            done: Future = Future()
            done.set_result(data)
            return done
        with self._cv:
            job = self._jobs.get(k)
            if job is None:
                job = _Job(k, line)
                self._jobs[k] = job
                if urgent:
                    self._queue.appendleft(job)
                else:
                    self._queue.append(job)
                self._cv.notify()
            elif urgent and job in self._queue:
                self._queue.remove(job)
                self._queue.appendleft(job)
            return job.future

    def pending(self) -> list[str]:
        with self._cv:
            return [j.line.text for j in self._queue]

    def _run(self) -> None:
        while True:
            with self._cv:
                while not self._queue and not self._stopping:
                    self._cv.wait()
                if self._stopping:
                    return
                job = self._queue.popleft()
            try:
                data = self._make(job.line)
                self._cache.put(job.key, data)
                job.future.set_result(data)
            except BaseException as e:  # the request that waits on it answers 500; the next one tries again
                job.future.set_exception(e)
            finally:
                with self._cv:
                    self._jobs.pop(job.key, None)
```

`tts/app/engine.py`:

```python
"""The engine seam (Kokoro plan Tasks 2-3): the stub for e2e, or Kokoro (app/kokoro.py, the one module
that knows which Kokoro build runs: tools/tts/parity.json's verdict)."""
from __future__ import annotations

from typing import Protocol

import numpy as np

from app.audio import silence, stub_ms
from app.config import Config


class Engine(Protocol):
    model_id: str  # part of the cache key

    def synth(self, text: str, speed: float) -> np.ndarray:
        """The line, spoken: float32 mono at 24 kHz."""
        ...


class StubEngine:
    """TTS_STUB=1 (e2e only, spec §4.1): silence as long as the line would take, at once, no model."""
    model_id = "stub"

    def synth(self, text: str, speed: float) -> np.ndarray:
        return silence(stub_ms(text, speed))


def load_engine(config: Config) -> Engine:
    if config.stub:
        return StubEngine()
    from app.kokoro import KokoroEngine
    return KokoroEngine(config.model_dir, config.threads)
```

`tts/app/main.py`:

```python
"""The dictation's voice (spec 2026-09-27 §4.1): internal to the compose network; the game server proxies
/api/tts/* here. /speak makes a line now (ahead of the queue) unless it is cached; /prepare queues a
dictation's lines in order; /health is ready once the model is loaded (it loads in the background, so
the service answers « loading » meanwhile)."""
from __future__ import annotations

import asyncio
import logging
import threading
import time
from contextlib import asynccontextmanager
from typing import Callable

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.audio import SR, encode_mp3
from app.cache import Cache, cache_key
from app.config import Config
from app.engine import Engine, load_engine
from app.text import MAX_CHARS, MAX_SPEED, MIN_SPEED, Respeller, normalise
from app.worker import Line, Worker

VOICE = "ff_siwis"
MAX_PREPARE_LINES = 500
log = logging.getLogger("uvicorn.error")


class SpeakBody(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_CHARS)
    speed: float = Field(ge=MIN_SPEED, le=MAX_SPEED)


class PrepareBody(BaseModel):
    lines: list[SpeakBody] = Field(max_length=MAX_PREPARE_LINES)


def create_app(config: Config | None = None, engine_factory: Callable[[Config], Engine] = load_engine) -> FastAPI:
    config = config or Config.from_env()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.worker = None
        app.state.engine_id = None
        app.state.error = None
        app.state.respell = Respeller.load(config.respell_path)
        cache = Cache(config.cache_dir, config.cache_mb * 1024 * 1024)

        def boot() -> None:
            try:
                t0 = time.perf_counter()
                engine = engine_factory(config)

                def make(line: Line) -> bytes:
                    t = time.perf_counter()
                    audio = engine.synth(line.text, line.speed)
                    data = encode_mp3(audio)
                    log.info("tts: %d characters at %.2f: %.2f s of speech in %.2f s",
                             len(line.text), line.speed, len(audio) / SR, time.perf_counter() - t)
                    return data

                worker = Worker(make, cache, lambda line: cache_key(engine.model_id, VOICE, line.speed, line.text))
                worker.start()
                app.state.engine_id = engine.model_id
                app.state.worker = worker
                log.info("tts: voice ready (%s) in %.1f s", engine.model_id, time.perf_counter() - t0)
            except Exception as e:
                app.state.error = f"{type(e).__name__}: {e}"
                log.exception("tts: the voice could not load")

        threading.Thread(target=boot, name="tts-boot", daemon=True).start()
        yield
        if app.state.worker is not None:
            app.state.worker.stop()

    app = FastAPI(title="La Discorde, the voice", lifespan=lifespan)

    def worker_of(request: Request) -> Worker:
        worker = request.app.state.worker
        if worker is None:
            raise HTTPException(503, "the voice is not ready")
        return worker

    def line_of(request: Request, body: SpeakBody) -> Line:
        text = request.app.state.respell(normalise(body.text))
        if not text:
            raise HTTPException(422, "nothing to say")
        return Line(text=text, speed=round(body.speed, 3))

    @app.get("/health")
    def health(request: Request):
        state = request.app.state
        if state.worker is not None:
            return {"status": "ready", "engine": state.engine_id}
        if state.error:
            return JSONResponse({"status": "error", "detail": state.error}, status_code=503)
        return JSONResponse({"status": "loading"}, status_code=503)

    @app.post("/speak")
    async def speak(body: SpeakBody, request: Request):
        worker = worker_of(request)
        future = worker.request(line_of(request, body), urgent=True)
        try:
            data = await asyncio.wrap_future(future)
        except Exception:
            log.exception("tts: a line failed")
            raise HTTPException(500, "the voice could not say this line")
        return Response(data, media_type="audio/mpeg", headers={"Cache-Control": "no-store"})

    @app.post("/prepare", status_code=202)
    def prepare(body: PrepareBody, request: Request):
        worker = worker_of(request)
        lines = [line_of(request, b) for b in body.lines]
        for line in lines:
            worker.request(line, urgent=False)
        return {"queued": len(lines)}

    return app


app = create_app()
```

- [ ] **Step 5: Run the tests**

Run: `scripts/tts-pytest.sh -q`
Expected: every test passes, `0 warnings` in the summary (paste the counts). A `PytestUnhandledThreadExceptionWarning` or a `ResourceWarning` is a failure of this step: fix its cause.

- [ ] **Step 6: The runtime image starts in stub mode**

Run: `source scripts/lib.sh && docker build -q -t "$TTS_IMAGE" tts && docker run --rm -e TTS_STUB=1 -e TTS_CACHE_DIR=/tmp/cache "$TTS_IMAGE" python -c "import app.main; from app.engine import load_engine; from app.config import Config; from app.audio import encode_mp3; e = load_engine(Config.from_env()); print(e.model_id, len(encode_mp3(e.synth('Un matin. Point.', 1.0))))"`
Expected: `stub <bytes>` — the runtime stage (no test dependencies) imports the app and encodes a line. The HTTP path itself is Task 5's smoke test, in the e2e stack.

- [ ] **Step 7: Commit**

```bash
git add --chmod=+x scripts/tts-pytest.sh
git add scripts/lib.sh tts/Dockerfile tts/.dockerignore tts/requirements.txt tts/requirements-dev.txt tts/pytest.ini tts/respell.json tts/app tts/tests
git commit -m "Kokoro Task 2: the voice service, engine-neutral (cache, queue, respelling, validation, stub) and its test wrapper

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- scripts/tts-pytest.sh scripts/lib.sh tts/Dockerfile tts/.dockerignore tts/requirements.txt tts/requirements-dev.txt tts/pytest.ini tts/respell.json tts/app tts/tests
```

---

### Task 3: The real engine — Task 1's verdict, the model baked into the image

**Files:**
- Create: `tts/app/kokoro.py`, `tts/tests/test_model.py`
- Modify: `tts/Dockerfile` (the `base` stage: the engine's packages and the model files), `tts/requirements.txt`

**Interfaces:**
- Consumes: `tools/tts/parity.json` (`verdict`, `versions`, `files.onnx.*.sha256` or `files.torch.*.sha256`) from Task 1; `app.engine.load_engine` (imports `app.kokoro.KokoroEngine(model_dir: Path, threads: int)`), `app.text.segments`, `app.audio.SR`, `app.audio.encode_mp3` from Task 2.
- Produces: `app.kokoro.KokoroEngine` with `model_id` `"kokoro-82m-v1.0-onnx-direct"` (`app.kokoro.MODEL_ID`; the verdict was `onnx-direct`, Task 3 addendum and lane S2 fix round, Ruling 1: the other variants below were not built) and `synth(text, speed) -> np.ndarray`; the runtime and test images carry the model under `/models`. Nothing outside `tts/app/kokoro.py`, `tts/Dockerfile` and `tts/requirements.txt` depends on the verdict.

- [ ] **Step 1: Write the failing model tests**

`tts/tests/test_model.py`:

```python
"""The real voice (Kokoro plan Task 3). Needs the model baked into the image: `-m "not model"` skips it."""
import io
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf
from fastapi.testclient import TestClient

from app.audio import SR, encode_mp3
from app.config import Config
from app.main import create_app
from tests.conftest import wait_ready

pytestmark = pytest.mark.model
LINE = "Un matin, virgule, l'œuf se fendit en craquant. Point."


@pytest.fixture(scope="module")
def engine():
    from app.kokoro import KokoroEngine
    return KokoroEngine(Path("/models"), threads=4)


def test_one_line_is_real_speech_of_a_plausible_length(engine):
    audio = engine.synth(LINE, 1.0)
    seconds = len(audio) / SR
    assert audio.dtype == np.float32 and audio.ndim == 1
    assert len(LINE) * 0.03 <= seconds <= len(LINE) * 0.15, seconds
    assert float(np.sqrt(np.mean(audio ** 2))) > 0.01   # not silence
    info = sf.info(io.BytesIO(encode_mp3(audio)))
    assert info.samplerate == 24000 and abs(info.duration - seconds) <= 0.15


def test_a_slower_pace_is_a_longer_line(engine):
    assert len(engine.synth(LINE, 0.75)) > len(engine.synth(LINE, 1.0)) * 1.15


def test_a_long_line_is_read_in_segments(engine):
    text = " ".join(["Le loup, virgule, arriva près de la bergerie. Point."] * 8)   # > 300 characters
    audio = engine.synth(text, 1.0)
    assert len(audio) / SR > 8 * 2.0


def test_the_service_speaks_with_the_real_voice(tmp_path):
    (tmp_path / "respell.json").write_text("{}", encoding="utf-8")
    config = Config(stub=False, threads=4, cache_dir=tmp_path / "cache", cache_mb=64,
                    respell_path=tmp_path / "respell.json", model_dir=Path("/models"))
    with TestClient(create_app(config)) as c:
        wait_ready(c, timeout=120)
        assert c.get("/health").json()["engine"].startswith("kokoro-82m-v1.0")
        r = c.post("/speak", json={"text": LINE, "speed": 0.9})
        assert r.status_code == 200 and r.headers["content-type"] == "audio/mpeg"
        assert sf.info(io.BytesIO(r.content)).duration > 1.0
```

- [ ] **Step 2: Run them to see them fail**

Run: `scripts/tts-pytest.sh -q tests/test_model.py`
Expected: FAIL (`ModuleNotFoundError: No module named 'app.kokoro'`, `/models` missing).

- [ ] **Step 3: The engine module, by verdict**

Read `tools/tts/parity.json`'s `verdict`. Write `tts/app/kokoro.py` from the matching variant, and nothing else of the others.

**Verdict `onnx`** (or `onnx-misaki`, with the two marked lines):

```python
"""Kokoro-82M, the one module that knows which build runs (tools/tts/parity.json: verdict "<verdict>",
Kokoro plan Task 1). ONNX through onnxruntime, no PyTorch; the model and the voices are baked into the
image under /models (tts/Dockerfile)."""
from __future__ import annotations

from pathlib import Path

import numpy as np

from app.audio import SR
from app.text import segments

VOICE = "ff_siwis"


class KokoroEngine:
    model_id = "kokoro-82m-v1.0-onnx"  # onnx-misaki: "kokoro-82m-v1.0-onnx-misaki"

    def __init__(self, model_dir: Path, threads: int):
        import onnxruntime as ort
        from kokoro_onnx import Kokoro

        opts = ort.SessionOptions()
        opts.intra_op_num_threads = threads  # TTS_THREADS: the game server stays responsive meanwhile
        opts.inter_op_num_threads = 1
        session = ort.InferenceSession(str(model_dir / "kokoro-v1.0.onnx"), sess_options=opts,
                                       providers=["CPUExecutionProvider"])
        self._kokoro = Kokoro.from_session(session, str(model_dir / "voices-v1.0.bin"))
        # onnx-misaki only: the PyTorch package's own French G2P (misaki's espeak fallback, lang_code 'f').
        # from misaki import espeak
        # self._g2p = espeak.EspeakG2P(language="fr-fr")

    def _phonemes(self, text: str) -> str:
        return self._kokoro.tokenizer.phonemize(text, lang="fr-fr")
        # onnx-misaki: ps, _ = self._g2p(text); return ps

    def synth(self, text: str, speed: float) -> np.ndarray:
        parts = []
        for segment in segments(text):
            # trim=False: no silence removed beyond what Kokoro produces (spec §4.1; the same call as
            # tools/tts/parity.py, so the service speaks exactly as the proof measured).
            audio, sr = self._kokoro.create(self._phonemes(segment), voice=VOICE, speed=speed, lang="fr-fr",
                                            is_phonemes=True, trim=False)
            assert sr == SR, sr
            parts.append(np.asarray(audio, dtype=np.float32).reshape(-1))
        return np.concatenate(parts)
```

For `onnx-misaki`, uncomment the two misaki lines, use the misaki branch of `_phonemes`, and set `model_id = "kokoro-82m-v1.0-onnx-misaki"`. Delete the comments that do not apply, so the file reads as one build.

**Verdict `torch`:**

```python
"""Kokoro-82M, the one module that knows which build runs (tools/tts/parity.json: verdict "torch",
Kokoro plan Task 1: the ONNX build did not match). The PyTorch CPU build, as the bake-off ran it
(lang_code 'f'); the weights, config and voice are baked into the image under /models."""
from __future__ import annotations

from pathlib import Path

import numpy as np

from app.text import segments


class KokoroEngine:
    model_id = "kokoro-82m-v1.0-torch"

    def __init__(self, model_dir: Path, threads: int):
        import torch
        from kokoro import KModel, KPipeline

        torch.set_num_threads(threads)  # TTS_THREADS: the game server stays responsive meanwhile
        self._torch = torch
        model = KModel(repo_id="hexgrad/Kokoro-82M", config=str(model_dir / "config.json"),
                       model=str(model_dir / "kokoro-v1_0.pth")).eval()
        self._pipe = KPipeline(lang_code="f", repo_id="hexgrad/Kokoro-82M", model=model)
        self._voice = self._pipe.load_voice(str(model_dir / "ff_siwis.pt"))

    def synth(self, text: str, speed: float) -> np.ndarray:
        parts = []
        with self._torch.inference_mode():
            for segment in segments(text):
                for r in self._pipe(segment, voice=self._voice, speed=speed):
                    if r.audio is not None:
                        parts.append(r.audio.numpy().astype(np.float32).reshape(-1))
        return np.concatenate(parts)
```

- [ ] **Step 4: The image and the requirements, by verdict**

Append to `tts/requirements.txt` the exact versions `parity.json` recorded under `versions`:
- `onnx`: `kokoro-onnx==<versions.kokoro-onnx>` and `onnxruntime==<versions.onnxruntime>`;
- `onnx-misaki`: the same two, plus `misaki==<versions.misaki>` (no `[en]` extra: only its espeak G2P is used);
- `torch`: `kokoro==<versions.kokoro>` and `misaki==<versions.misaki>`; torch comes from the CPU index in the Dockerfile.

In `tts/Dockerfile`'s `base` stage, after the `pip install` line, add the model (the `# syntax=` line at the top already allows `ADD --checksum`). The checksums are `parity.json`'s `files.onnx.<name>.sha256` (or `files.torch.<name>.sha256`):

`onnx` / `onnx-misaki`:

```dockerfile
# Kokoro-82M v1.0, ONNX export and voices (kokoro-onnx release model-files-v1.0), checked against the
# sha256 the parity proof measured (tools/tts/parity.json).
ADD --checksum=sha256:<files.onnx.kokoro-v1.0.onnx.sha256> \
    https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx /models/kokoro-v1.0.onnx
ADD --checksum=sha256:<files.onnx.voices-v1.0.bin.sha256> \
    https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin /models/voices-v1.0.bin
```

`torch` (and install torch before the requirements):

```dockerfile
# espeak-ng for misaki's French G2P, as in the bake-off image (tools/tts/kokoro/Dockerfile).
RUN apt-get update && apt-get install -y --no-install-recommends espeak-ng && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir torch==<versions.torch> --index-url https://download.pytorch.org/whl/cpu
# (then the existing COPY requirements.txt / pip install lines)
ADD --checksum=sha256:<files.torch.kokoro-v1_0.pth.sha256> https://huggingface.co/hexgrad/Kokoro-82M/resolve/main/kokoro-v1_0.pth /models/kokoro-v1_0.pth
ADD --checksum=sha256:<files.torch.config.json.sha256> https://huggingface.co/hexgrad/Kokoro-82M/resolve/main/config.json /models/config.json
ADD --checksum=sha256:<files.torch.voices/ff_siwis.pt.sha256> https://huggingface.co/hexgrad/Kokoro-82M/resolve/main/voices/ff_siwis.pt /models/ff_siwis.pt
ENV HF_HUB_OFFLINE=1
```

The `<…>` above are copied from `parity.json` (the file Task 1 committed), not invented.

- [ ] **Step 5: Run the tests**

Run: `scripts/tts-pytest.sh -q`
Expected: every test passes, the four `model` tests included, `0 warnings` (paste the counts and the durations `pytest --durations=5` prints if you add it once).

- [ ] **Step 6: The runtime image loads the model**

Run: `source scripts/lib.sh && docker build -t "$TTS_IMAGE" tts && docker image ls "$TTS_IMAGE"`
Expected: the build succeeds (the checksums match); note the image size in the report (Task 5 writes it into the README).

- [ ] **Step 7: Commit**

```bash
git add tts/app/kokoro.py tts/tests/test_model.py tts/Dockerfile tts/requirements.txt
git commit -m "Kokoro Task 3: the real voice (<verdict> build per tools/tts/parity.json), the model baked into the image

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- tts/app/kokoro.py tts/tests/test_model.py tts/Dockerfile tts/requirements.txt
```

(`<verdict>` in the message: the actual verdict.)

---

### Task 4: The game server's proxy — `/api/tts/speak`, `/api/tts/prepare`, `/api/tts/health`

**Files:**
- Create: `server/app/routers/tts.py`, `server/tests/test_tts_proxy.py`
- Modify: `server/app/config.py` (`tts_url`), `server/app/main.py` (the client on `app.state`, the router)

**Interfaces:**
- Consumes: the `tts` service's HTTP contract (Task 2's Interfaces: `/speak`, `/prepare`, `/health` and their answers); `fetch_profile` (`app.routers.profiles`), `get_db` (`app.db`).
- Produces: `POST /api/tts/speak {profile_id: int, text: str, speed: float}` → the service's status and body (`audio/mpeg` on 200); `POST /api/tts/prepare {profile_id: int, lines: [{text, speed}]}` → the service's (202 `{"queued": n}`); unknown hero 404, missing `profile_id` 422; unreachable 503 `{"detail": "the voice cannot be reached"}`; `GET /api/tts/health` → 200 `{"voice": "ready", "engine": <id>}` or 503 `{"voice": "loading" | "error" | "unreachable"}`. `Settings.tts_url` (env `DISCORDE_TTS_URL`, default `http://tts:8000`); `app.state.tts_client: httpx.Client` (tests replace it).

- [ ] **Step 1: Write the failing tests**

`server/tests/test_tts_proxy.py`:

```python
"""The voice proxy (spec 2026-09-27 §4.2): /api/tts/* in front of the `tts` service."""
import json

import httpx
import pytest

from app.config import Settings


def hero(client) -> int:
    r = client.post("/api/profiles", json={"name": "Voix", "avatar": "chouette", "level": "10H"})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def voice(client, handler) -> list[httpx.Request]:
    """Replaces the service with `handler`; returns the requests it receives."""
    seen: list[httpx.Request] = []

    def record(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return handler(request)

    client.app.state.tts_client = httpx.Client(transport=httpx.MockTransport(record), base_url="http://tts:8000")
    return seen


def mp3(_):
    return httpx.Response(200, content=b"ID3fake", headers={"content-type": "audio/mpeg"})


def down(request):
    raise httpx.ConnectError("no route to tts", request=request)


def test_speak_passes_the_line_to_the_voice_and_the_mp3_back(client):
    seen = voice(client, mp3)
    r = client.post("/api/tts/speak", json={"profile_id": hero(client), "text": "Un matin. Point.", "speed": 0.75})
    assert r.status_code == 200
    assert r.content == b"ID3fake" and r.headers["content-type"] == "audio/mpeg"
    assert [(q.method, q.url.path) for q in seen] == [("POST", "/speak")]
    assert json.loads(seen[0].content) == {"text": "Un matin. Point.", "speed": 0.75}


@pytest.mark.parametrize("status", [422, 500])
def test_the_voice_s_own_answers_pass_through(client, status):
    voice(client, lambda _: httpx.Response(status, json={"detail": "from the voice"}))
    r = client.post("/api/tts/speak", json={"profile_id": hero(client), "text": "x", "speed": 1.0})
    assert r.status_code == status and r.json() == {"detail": "from the voice"}


def test_a_voice_still_loading_is_a_503(client):
    voice(client, lambda _: httpx.Response(503, json={"detail": "the voice is not ready"}))
    r = client.post("/api/tts/speak", json={"profile_id": hero(client), "text": "x", "speed": 1.0})
    assert r.status_code == 503


@pytest.mark.parametrize("error", [httpx.ConnectError, httpx.ReadTimeout])
def test_a_voice_that_cannot_be_reached_is_a_503(client, error):
    def fail(request):
        raise error("down", request=request)

    voice(client, fail)
    pid = hero(client)
    r = client.post("/api/tts/speak", json={"profile_id": pid, "text": "x", "speed": 1.0})
    assert r.status_code == 503 and r.json() == {"detail": "the voice cannot be reached"}
    r = client.post("/api/tts/prepare", json={"profile_id": pid, "lines": []})
    assert r.status_code == 503


def test_speaking_needs_a_hero(client):
    seen = voice(client, mp3)
    assert client.post("/api/tts/speak", json={"profile_id": 999_999, "text": "x", "speed": 1.0}).status_code == 404
    assert client.post("/api/tts/speak", json={"text": "x", "speed": 1.0}).status_code == 422
    assert client.post("/api/tts/prepare", json={"profile_id": 999_999, "lines": []}).status_code == 404
    assert client.post("/api/tts/prepare", json={"lines": []}).status_code == 422
    assert seen == []


def test_prepare_forwards_the_lines_in_order(client):
    seen = voice(client, lambda _: httpx.Response(202, json={"queued": 2}))
    lines = [{"text": "Un. Point.", "speed": 0.9}, {"text": "Deux. Point.", "speed": 0.9}]
    r = client.post("/api/tts/prepare", json={"profile_id": hero(client), "lines": lines})
    assert r.status_code == 202 and r.json() == {"queued": 2}
    assert seen[0].url.path == "/prepare" and json.loads(seen[0].content) == {"lines": lines}


@pytest.mark.parametrize("answer, status, body", [
    (lambda _: httpx.Response(200, json={"status": "ready", "engine": "kokoro-82m-v1.0-onnx"}), 200,
     {"voice": "ready", "engine": "kokoro-82m-v1.0-onnx"}),
    (lambda _: httpx.Response(503, json={"status": "loading"}), 503, {"voice": "loading"}),
    (lambda _: httpx.Response(503, json={"status": "error", "detail": "RuntimeError: x"}), 503, {"voice": "error"}),
    (down, 503, {"voice": "unreachable"}),
])
def test_the_voice_s_health(client, answer, status, body):
    voice(client, answer)
    r = client.get("/api/tts/health")
    assert r.status_code == status and r.json() == body


def test_the_game_s_health_stays_about_the_game(client):
    voice(client, down)
    assert client.get("/api/health").status_code == 200


def test_the_voice_s_address_comes_from_the_environment(monkeypatch):
    assert Settings.from_env().tts_url == "http://tts:8000"
    monkeypatch.setenv("DISCORDE_TTS_URL", "http://voice.lan:9000")
    assert Settings.from_env().tts_url == "http://voice.lan:9000"
```

- [ ] **Step 2: Run them to see them fail**

Run: `scripts/pytest.sh -q tests/test_tts_proxy.py`
Expected: FAIL (404 on `/api/tts/*`, `AttributeError: … tts_url`).

- [ ] **Step 3: Write the implementation**

`server/app/config.py`: add the field `tts_url: str = "http://tts:8000"` after `test_hooks`, and in `from_env` the argument `tts_url=os.environ.get("DISCORDE_TTS_URL", "http://tts:8000"),`.

`server/app/routers/tts.py`:

```python
"""The dictation's voice (spec 2026-09-27 §4.2): /api/tts/* proxies the `tts` service (DISCORDE_TTS_URL).
Speaking and preparing need a hero, like the other play endpoints (her id in the body, as
POST /api/sessions takes it: Kokoro plan Ruling K4). The voice's own answer passes through; a voice
that cannot be reached is a 503, and so is one still loading (its own 503)."""
from __future__ import annotations

import logging
import sqlite3

import httpx
from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.db import get_db
from app.routers.profiles import fetch_profile

router = APIRouter(prefix="/api/tts", tags=["tts"])
log = logging.getLogger("uvicorn.error")
UNREACHABLE = {"detail": "the voice cannot be reached"}


class SpeakBody(BaseModel):
    profile_id: int
    text: str
    speed: float


class PrepareLine(BaseModel):
    text: str
    speed: float


class PrepareBody(BaseModel):
    profile_id: int
    lines: list[PrepareLine]


def speak_timeout(text: str) -> float:
    """Longer than the browser's own wait (voice.ts fetchTimeoutMs: 20 s + 50 ms a character): the
    browser, not the proxy, decides when a line is late."""
    return 30.0 + 0.05 * len(text)


def _forward(request: Request, path: str, payload: dict, timeout: float) -> Response:
    client: httpx.Client = request.app.state.tts_client
    try:
        r = client.post(path, json=payload, timeout=httpx.Timeout(timeout, connect=3.0))
    except httpx.HTTPError as e:
        log.warning("tts proxy: the voice cannot be reached (%s)", e)
        return JSONResponse(UNREACHABLE, status_code=503)
    return Response(r.content, status_code=r.status_code, media_type=r.headers.get("content-type"))


@router.post("/speak")
def speak(body: SpeakBody, request: Request, db: sqlite3.Connection = Depends(get_db)):
    fetch_profile(db, body.profile_id)
    return _forward(request, "/speak", {"text": body.text, "speed": body.speed}, speak_timeout(body.text))


@router.post("/prepare")
def prepare(body: PrepareBody, request: Request, db: sqlite3.Connection = Depends(get_db)):
    fetch_profile(db, body.profile_id)
    return _forward(request, "/prepare", {"lines": [line.model_dump() for line in body.lines]}, 10.0)


@router.get("/health")
def health(request: Request):
    """For the README's troubleshooting (Ruling K9): is the voice there, and which one."""
    client: httpx.Client = request.app.state.tts_client
    try:
        r = client.get("/health", timeout=httpx.Timeout(3.0))
    except httpx.HTTPError:
        return JSONResponse({"voice": "unreachable"}, status_code=503)
    try:
        body = r.json()
    except ValueError:
        body = {}
    if r.status_code == 200:
        return {"voice": "ready", "engine": body.get("engine")}
    return JSONResponse({"voice": "loading" if body.get("status") == "loading" else "error"}, status_code=503)
```

`server/app/main.py`:
- `import httpx` at the top; `from app.routers import profiles, texts, sessions, stats, scan, alexandria, world, tts`.
- In `lifespan`, before `yield`: `app.state.tts_client = httpx.Client(base_url=settings.tts_url)` (with the comment `# The dictation's voice (Kokoro plan Task 4): one pooled client for /api/tts/*.`); after `yield`: `app.state.tts_client.close()`.
- `app.include_router(tts.router)` after `app.include_router(world.router)`, above the `/api` catch-all.

- [ ] **Step 4: Run the tests**

Run: `scripts/pytest.sh -q tests/test_tts_proxy.py` — Expected: PASS.
Run: `scripts/pytest.sh -q` — Expected: PASS, `0 warnings`-clean summary as before (paste the counts).

- [ ] **Step 5: Commit**

```bash
git add server/app/routers/tts.py server/tests/test_tts_proxy.py server/app/config.py server/app/main.py
git commit -m "Kokoro Task 4: /api/tts/speak, /prepare and /health proxy the voice service (a hero required, 503 when unreachable)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- server/app/routers/tts.py server/tests/test_tts_proxy.py server/app/config.py server/app/main.py
```

---

### Task 5: The stacks, the gate's builds, and the README's deployment and troubleshooting

**Files:**
- Modify: `compose.yaml`, `compose.e2e.yaml`, `compose.dev.yaml`, `scripts/check.sh`, `scripts/playwright.sh`, `scripts/dev.sh`, `web/e2e/smoke.spec.ts`, `README.md` (the quick start, §2, §5)

**Interfaces:**
- Consumes: `TTS_IMAGE`, `TTS_TEST_IMAGE`, `scripts/tts-pytest.sh` (Task 2); the model in the image (Task 3); `/api/tts/health` (Task 4).
- Produces: the `tts` service in every stack (prod: volume `discorde-tts-cache`; e2e: `TTS_STUB` from the environment, default `1`; dev: the real voice, no stub switch, preflight ruling #10); the playwright container waits for a healthy `tts`; `check.sh` steps `== tts: pytest` and `== docker build tts`; `playwright.sh` builds `app tts` and saves `web/test-results/tts.log` on a failure. Task 9 adds the real-voice step to `check.sh` after the e2e step.

- [ ] **Step 1: The e2e smoke test (failing)**

Append to `web/e2e/smoke.spec.ts`:

```ts
// Kokoro plan Task 5: the e2e stack runs the voice's stub (TTS_STUB=1), reached through the game server.
test('the voice is reached through the game server, as its stub', async ({ request }) => {
  const res = await request.get('/api/tts/health');
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ voice: 'ready', engine: 'stub' });
});
```

Run: `scripts/playwright.sh smoke --project=desktop`
Expected: FAIL (`/api/tts/health` answers 503 `{"voice":"unreachable"}`: there is no `tts` in the stack yet).

- [ ] **Step 2: The stacks**

`compose.yaml`:

```yaml
services:
  discorde:
    image: discorde:local
    build: .
    container_name: discorde
    ports: ["8080:8080"]
    volumes: ["discorde-data:/data"]
    # The voice (spec 2026-09-27 §6): started with the game, but no health condition, so the game
    # starts even while the voice is still loading its model.
    depends_on: [tts]
    restart: unless-stopped
  tts:
    image: discorde-tts:local
    build: tts
    container_name: discorde-tts
    # Every line it has made (no backup needed: each one can be made again).
    volumes: ["discorde-tts-cache:/cache"]
    restart: unless-stopped
volumes:
  discorde-data:
  discorde-tts-cache:
```

`compose.e2e.yaml`: under `services:` after `app`, add:

```yaml
  # The dictation's voice (Kokoro plan): the stub (silent MP3s, no model) unless TTS_STUB=0, as the
  # real-voice run does (scripts/check.sh, Ruling K8). The app reaches it as http://tts:8000.
  tts:
    build: ./tts
    image: ${TTS_IMAGE:-discorde-tts:local}
    environment: { TTS_STUB: "${TTS_STUB:-1}", TTS_THREADS: "4" }
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health').status==200 else 1)"]
      interval: 2s
      timeout: 3s
      retries: 90
```

In `app`, add `depends_on: [tts]`; in `playwright.depends_on`, add `tts: { condition: service_healthy }` next to `app`.

`compose.dev.yaml` (the dev server needs no `depends_on`: it starts on its own, and reaches the voice as `http://tts:8000` once it is up); add a service:

```yaml
  tts:
    image: ${TTS_IMAGE:-discorde-tts:local}
    # The real voice by default; TTS_STUB=1 scripts/dev.sh for silent lines without the model.
    environment: { TTS_STUB: "${TTS_STUB:-0}", TTS_THREADS: "4" }
    volumes: ["discorde-dev-tts-cache:/cache"]
```

and `discorde-dev-tts-cache:` under `volumes:`.

`scripts/dev.sh`: after `build_server_dev_image`, add `docker build -q -t "$TTS_IMAGE" "$HOST_ROOT/tts" >/dev/null` with the comment `# The voice's image (compose.dev.yaml's tts service).`, and in the header comment add `TTS_STUB=1 scripts/dev.sh: the voice's stub (silent lines, no model).`

`scripts/playwright.sh`:
- header: add `#          TTS_STUB=0 scripts/playwright.sh --config playwright.voice.config.ts voice-real   (the real voice)`;
- `docker compose -f compose.e2e.yaml build app` → `docker compose -f compose.e2e.yaml build app tts`;
- in the failure block, after the app log line: `docker compose -f compose.e2e.yaml logs --no-color tts > web/test-results/tts.log 2>&1 || true`, and the echo becomes `echo "server logs: web/test-results/app.log, web/test-results/tts.log"`.

`scripts/check.sh`:

```bash
echo "== server: pytest";        scripts/pytest.sh -q
echo "== tts: pytest";           scripts/tts-pytest.sh -q
# `check` is svelte-check over src, then tsc over e2e/ and the Playwright configs (tsconfig.e2e.json:
# the main tsconfig excludes e2e, and Playwright only transpiles, so nothing else type-checks them).
echo "== web: svelte-check + e2e type-check"; scripts/npm.sh run check
echo "== web: vitest";           scripts/npm.sh run test
echo "== docker build";          docker build -t "$APP_IMAGE" .
echo "== docker build tts";      docker build -t "$TTS_IMAGE" tts
echo "== e2e: playwright";       scripts/playwright.sh
echo "== ALL GREEN"
```

- [ ] **Step 3: Run the smoke test**

Run: `scripts/playwright.sh smoke --repeat-each=3`
Expected: PASS on `desktop` (the smoke spec is a `desktop` spec).

- [ ] **Step 4: Measure the image**

Run: `source scripts/lib.sh && for i in "$TTS_IMAGE" "$APP_IMAGE"; do docker image ls --format '{{.Repository}}:{{.Tag}} {{.Size}}' "$i"; done` (`docker image ls` takes one reference at a time)
Expected: both sizes (paste them; the README below uses them).

- [ ] **Step 5: The README**

Edit `README.md` (English, as the rest):

1. Opening paragraph: « self-hosted as a single Docker container » → « self-hosted as two Docker containers (the game and its voice) ».
2. **Quick start**, step 2's note: « The first build takes several minutes (it downloads Tesseract and the large French spaCy language model). Later builds reuse the cache. The image is tagged `discorde:local`. » → « The first build takes several minutes (it downloads Tesseract, the large French spaCy language model and the voice's model, Kokoro-82M). Later builds reuse the cache. The images are tagged `discorde:local` and `discorde-tts:local`. » Everyday commands table: add the row `| Check the voice | open <http://localhost:8080/api/tts/health> (answers `{"voice":"ready",...}`; see "If the voice goes silent") |` and change « See the logs » to `docker compose logs -f` (both containers) `, or `docker compose logs -f tts` for the voice alone`. After the volume paragraph add: « The voice keeps every line it has made in a second volume, `…_discorde-tts-cache` (up to 2 GB); deleting it only means the lines are made again. »
3. **§2**: « The NAS runs the same image as the PC. » → « The NAS runs the same two images as the PC. » Build commands:

   ```bash
   docker build -t discorde:2026-09-27 .
   docker build -t discorde-tts:2026-09-27 tts
   docker save discorde:2026-09-27 discorde-tts:2026-09-27 | gzip > discorde-2026-09-27.tar.gz
   ```

   The size sentence: add « the voice's image takes about <Step 4's size> (its model and the ONNX runtime) ». `docker image ls discorde` → `docker image ls 'discorde*'`. The YAML:

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

   The sentence after it: « This is `compose.yaml` from the repo with the named data volume swapped for the dataset and the build lines removed. The voice has no port: only the game talks to it. Its cache stays a named volume (nothing in it needs a backup). » Health check bullet: add « The voice has its own (`GET /health` inside its container, 120 s allowed to load the model); the game starts without waiting for it. » Environment table: add rows `| DISCORDE_TTS_URL | http://tts:8000 | Where the game finds its voice (the `tts` service) |`, `| TTS_THREADS | 4 | (on `tts`) CPU threads the voice may use, so the game stays responsive while a dictation is prepared |`, `| TTS_CACHE_MB | 2048 | (on `tts`) the voice's cache size, least recently used lines dropped first |`, and « `TTS_STUB` is for the test suite only. » next to the other test-only variables. Update section: « Build and load the new images under a new tag » and « change both `image:` lines ».
4. **§2, a new subsection at its end, « ### If the voice goes silent »**:

   ```markdown
   ### If the voice goes silent

   The game never falls back to the device's own voice. When it cannot get a line from its voice, the
   dictation stops on a card where Éris boasts that she has silenced it and asks the player to fetch a
   parent. The card's small line says why:

   - « voix : serveur injoignable » — the game could not reach its voice: the `tts` container is stopped,
     still starting (loading the model takes up to a minute or two), or the network between the two
     containers is down;
   - « voix : erreur du serveur » — the voice answered with an error (see its logs).

   Then:

   1. Open `http://<server>:8080/api/tts/health`. `{"voice":"ready","engine":"kokoro-82m-v1.0-onnx-direct"}` means the
      voice is fine again: tap « Réessayer » on the card. `{"voice":"loading"}`: wait a minute and try
      again. `{"voice":"unreachable"}`: the container is not running. `{"voice":"error"}`: it could not load
      its model; its logs say why.
   2. Check the container: on TrueNAS, **Apps → discorde**, the `tts` container's state (restart the app
      if it is stopped or crash-looping); with Docker Desktop, `docker compose ps` and
      `docker compose restart tts`.
   3. Read its logs: TrueNAS, the app's **Logs** for the `tts` container; Docker Desktop,
      `docker compose logs --tail 100 tts`. A line such as `tts: 84 characters at 0.90: 6.10 s of speech
      in 1.30 s` is a line made; `the voice could not load` is followed by the reason.
   4. Once the health answers `ready`, « Réessayer » on the card carries on where the dictation stopped,
      with everything typed so far. « Retour au camp » keeps the draft too: the dictation resumes from the
      text's parchment later.
   ```

5. **§5 Development**: add a bullet after `scripts/pytest.sh`: « `scripts/tts-pytest.sh <args>` — pytest inside the voice service's test image (`tts/`), model included (`-m "not model"` skips the tests that load it) ». `scripts/dev.sh` bullet: add « and the voice (`tts`, the real model; `TTS_STUB=1` for silent lines) ». `scripts/playwright.sh` bullet: « builds the production images, starts them … (the voice as its stub: silent lines as long as the real ones, no model) … On a failure, the servers' logs are saved to `web/test-results/app.log` and `tts.log`. » `scripts/check.sh` bullet: « server pytest, the voice's pytest, `svelte-check`…, vitest, both production image builds, then the e2e suite (`scripts/playwright.sh`) ». Two-checkouts paragraph: « its own compose project, app image, voice image, server dev image and `node_modules` volume ».

- [ ] **Step 6: The gate**

Run: `PW_WORKERS=4 scripts/check.sh`
Expected: `== ALL GREEN`, with the new `== tts: pytest` (model tests included) and `== docker build tts` steps; e2e as before plus the smoke test (the dictation still uses the browser voice's stub until Task 9).

- [ ] **Step 7: Commit**

```bash
git add compose.yaml compose.e2e.yaml compose.dev.yaml scripts/check.sh scripts/playwright.sh scripts/dev.sh web/e2e/smoke.spec.ts README.md
git commit -m "Kokoro Task 5: the voice in every stack (prod, e2e stub, dev), the gate builds and tests it, the README deploys and troubleshoots it

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- compose.yaml compose.e2e.yaml compose.dev.yaml scripts/check.sh scripts/playwright.sh scripts/dev.sh web/e2e/smoke.spec.ts README.md
```

---

### Task 6: The spoken form's sentence endings, and the script's unique lines

**Files:**
- Modify: `web/src/lib/dictation/spoken.ts`, `web/src/lib/dictation/spoken.test.ts`, `web/src/lib/dictation/script.ts`, `web/src/lib/dictation/script.test.ts`, `tools/tts/README.md` (one note)

**Interfaces:**
- Consumes: `tokenize` (`$lib/grading/tokenize`), `splitSentences`/`splitChunks` (unchanged).
- Produces: `spokenForm(chunk, opts?)` (same signature, Ruling K2's endings); in `script.ts`: `interface SayLine { spoken: string; rate: number }`, `sayLines(steps: Step[]): SayLine[]` (each distinct `spoken`+`rate` once, in first-said order), `MAX_LINE_CHARS = 10_000`.

- [ ] **Step 1: Write the failing tests**

Replace the body of `describe('spokenForm', …)` in `web/src/lib/dictation/spoken.test.ts` with:

```ts
describe('spokenForm', () => {
  // Spec 2026-09-27 §2, bake-off variant C (Ruling K2): a sentence-ending mark is kept and followed by
  // its capitalised name; « ; » and « : » are kept, their name in lower case; the rest as before.
  it('keeps a final full stop and says its name after it', () => {
    expect(spokenForm('Le loup, affamé, arriva.')).toBe('Le loup, virgule, affamé, virgule, arriva. Point.');
  });
  it('does the same for every sentence-ending mark, wherever it is', () => {
    expect(spokenForm('Est-ce que tu sais leurs noms, berger ?')).toBe("Est-ce que tu sais leurs noms, virgule, berger ? Point d'interrogation.");
    expect(spokenForm('Que la campagne était belle !')).toBe("Que la campagne était belle ! Point d'exclamation.");
    expect(spokenForm("Jamais je n'en avais tant vu…")).toBe("Jamais je n'en avais tant vu… Points de suspension.");
    expect(spokenForm('Pourquoi… pourquoi ?')).toBe("Pourquoi… Points de suspension, pourquoi ? Point d'interrogation.");
    expect(spokenForm('Et puis...')).toBe('Et puis… Points de suspension.');
  });
  it('keeps « ; » and « : » before their name, in lower case', () => {
    expect(spokenForm('Il dit : « Viens ici ! »'))
      .toBe("Il dit : deux-points, ouvrez les guillemets, Viens ici ! Point d'exclamation, fermez les guillemets.");
    expect(spokenForm('dit la petite chèvre ; et elle')).toBe('dit la petite chèvre ; point-virgule, et elle.');
  });
  it('reads the bake-off sentences exactly as the user heard them (round2.json, variant C)', () => {
    expect(spokenForm("Un matin, l'œuf se fendit en craquant, et un petit dragon aux écailles vertes en sortit, les ailes encore froissées."))
      .toBe("Un matin, virgule, l'œuf se fendit en craquant, virgule, et un petit dragon aux écailles vertes en sortit, virgule, les ailes encore froissées. Point.");
    expect(spokenForm('Sur la pomme, quelques mots étaient gravés : « À la plus belle. »'))
      .toBe('Sur la pomme, virgule, quelques mots étaient gravés : deux-points, ouvrez les guillemets, À la plus belle. Point, fermez les guillemets.');
  });
  it('capitalises a punctuation name right after « À la ligne. », never a word', () => {
    expect(spokenForm("— Déjà ! dit la petite chèvre ; et elle s'arrêta fort étonnée.", { newParagraph: true }))
      .toBe("À la ligne. Tiret, Déjà ! Point d'exclamation, dit la petite chèvre ; point-virgule, et elle s'arrêta fort étonnée. Point.");
    expect(spokenForm('Il partit.', { newParagraph: true })).toBe('À la ligne. Il partit. Point.');
    expect(spokenForm('Mme Loisel dansait.', { newParagraph: true })).toBe('À la ligne. madame Loisel dansait. Point.');
  });
  it('keeps the comma, the guillemets and the tiret as they were', () => {
    expect(spokenForm('Le loup, affamé,')).toBe('Le loup, virgule, affamé, virgule.');
  });
  it('never speaks apostrophes or hyphens inside words', () => {
    expect(spokenForm("L'enfant a dit peut-être.")).toBe("L'enfant a dit peut-être. Point.");
  });
  it('leaves the abbreviations alone: « M. » is « monsieur », « Mme » « madame »', () => {
    expect(spokenForm('Elle rencontra M. Seguin.')).toBe('Elle rencontra monsieur Seguin. Point.');
    expect(spokenForm('Mme Loisel dansait.')).toBe('madame Loisel dansait. Point.');
  });
});
```

Append to `web/src/lib/dictation/script.test.ts` (and add `sayLines, MAX_LINE_CHARS` to its import from `./script`, plus `import { readdirSync, readFileSync } from 'node:fs';` at the top):

```ts
describe('sayLines (spec 2026-09-27 §5.2: what the dictation sends ahead)', () => {
  const plan = buildPlan(TEXT);
  it('lists each line once, in the order the script first says it, at its pace', () => {
    expect(sayLines(buildScript(plan, 1))).toEqual(plan.sentences.map((s) => ({ spoken: spokenForm(s.text, { newParagraph: s.newParagraph }), rate: 0.75 })));
    expect(sayLines(buildScript(plan, 2))).toEqual(plan.chunks.map((c) => ({ spoken: c.spoken, rate: 0.85 })));
    // Pace 3 reads each chunk twice: once in the list.
    expect(sayLines(buildScript(plan, 3))).toEqual(plan.chunks.map((c) => ({ spoken: c.spoken, rate: 0.9 })));
  });
  it('keeps pace 4's two full readings apart: they are said at different rates', () => {
    expect(sayLines(buildScript(plan, 4))).toEqual([
      { spoken: plan.full, rate: 1.0 },
      ...plan.chunks.map((c) => ({ spoken: c.spoken, rate: 0.9 })),
      { spoken: plan.full, rate: 0.95 },
    ]);
  });
});

describe('the voice's limit (Kokoro plan Ruling K1)', () => {
  it("fits every seed text's longest line, pace 4's full reading", () => {
    expect(MAX_LINE_CHARS).toBe(10_000); // tts/app/text.py MAX_CHARS
    for (const f of readdirSync('../content/seed').filter((n) => n.endsWith('.json'))) {
      const body = (JSON.parse(readFileSync(`../content/seed/${f}`, 'utf-8')) as { body: string }).body;
      expect(buildPlan(body).full.length, f).toBeLessThanOrEqual(MAX_LINE_CHARS);
    }
  });
});
```

(`spokenForm` must be imported in `script.test.ts` too: `import { spokenForm } from './spoken';`.)

- [ ] **Step 2: Run them to see them fail**

Run: `scripts/npm.sh run test -- src/lib/dictation/spoken.test.ts src/lib/dictation/script.test.ts`
Expected: FAIL (the old « , point. » endings; `sayLines` / `MAX_LINE_CHARS` not exported).

- [ ] **Step 3: Write the implementation**

`web/src/lib/dictation/spoken.ts`: replace the header comment, the `Unit` interface and the body of `spokenForm` (keep `PUNCT_NAMES`, `ABBREVIATION_WORDS`, `ABBREVIATION_WITH_PERIOD` as they are):

```ts
// Turns a chunk of text into the words a teacher would say aloud while dictating, the punctuation said
// by name. Spec §3.3; the Kokoro voice's endings (spec 2026-09-27 §2, bake-off variant C, Kokoro plan
// Ruling K2): a mark that ends a sentence (. ? ! …) is kept as the mark itself and followed by its name,
// capitalised - « froissées. Point. », « berger ? Point d'interrogation. » - so the voice closes the
// sentence before naming it; « ; » and « : » are kept too, their name in lower case - « chèvre ;
// point-virgule, »; the comma and every other mark are said as before - « , virgule, ». This string is
// the voice's input, never shown: the space before « ? ! ; : » is a plain one.
import { tokenize } from '$lib/grading/tokenize';
```

```ts
/** Marks that end a sentence: the mark, then its capitalised name. */
const CLOSING = new Set(['.', '?', '!', '…', '...']);
/** Marks kept before their name, in lower case (they do not end the sentence). */
const KEPT = new Set([';', ':']);
const SPACE = ' ';

type Unit = { kind: 'word'; text: string } | { kind: 'name'; text: string } | { kind: 'mark'; mark: string; text: string };

const capitalise = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export function spokenForm(chunk: string, opts?: { newParagraph?: boolean }): string {
  const tokens = tokenize(chunk);
  const units: Unit[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.kind === 'word') {
      if (ABBREVIATION_WORDS[t.text]) {
        units.push({ kind: 'word', text: ABBREVIATION_WORDS[t.text] });
        continue;
      }
      const expanded = ABBREVIATION_WITH_PERIOD[t.text];
      if (expanded && tokens[i + 1]?.kind === 'punct' && tokens[i + 1].text === '.') {
        units.push({ kind: 'word', text: expanded });
        i++; // swallow the abbreviation period, it is not spoken as "point"
        continue;
      }
      units.push({ kind: 'word', text: t.text });
    } else {
      const name = PUNCT_NAMES[t.text];
      if (!name) continue; // Unknown punctuation tokens are silently skipped (never spoken).
      if (CLOSING.has(t.text)) units.push({ kind: 'mark', mark: t.text === '...' ? '…' : t.text, text: capitalise(name) });
      else if (KEPT.has(t.text)) units.push({ kind: 'mark', mark: t.text, text: name });
      else units.push({ kind: 'name', text: name });
    }
  }

  // Words next to each other are joined by a space; a name is set off by commas, as an aside; a kept
  // mark sits against the word before it (« . », « … ») or after a space (« ? ! ; : »), then its name.
  // A mark with nothing before it is said by its name alone.
  let out = '';
  units.forEach((u, i) => {
    if (i > 0) {
      const prev = units[i - 1];
      if (u.kind === 'mark') out += (u.mark === '.' || u.mark === '…' ? '' : SPACE) + u.mark + SPACE;
      else out += prev.kind === 'word' && u.kind === 'word' ? SPACE : ', ';
    }
    out += u.text;
  });
  out += '.';

  if (opts?.newParagraph) out = 'À la ligne. ' + (units[0] && units[0].kind !== 'word' ? capitalise(out) : out);
  return out;
}
```

`web/src/lib/dictation/script.ts`: after the `SayStep` type, add:

```ts
/** One line the voice says: its spoken form and its rate (the cache and the prefetch key on both). */
export interface SayLine {
  spoken: string;
  rate: number;
}

/** The voice's limit on one line (tts/app/text.py MAX_CHARS, Kokoro plan Ruling K1): pace 4's full
 *  reading of the longest text must fit. */
export const MAX_LINE_CHARS = 10_000;

/** The lines a script says, each once, in the order it first says them (spec 2026-09-27 §5.2: what the
 *  dictation sends ahead to be recorded). */
export function sayLines(steps: Step[]): SayLine[] {
  const seen = new Set<string>();
  const out: SayLine[] = [];
  for (const s of steps) {
    if (s.kind !== 'say') continue;
    const key = `${s.rate}|${s.spoken}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ spoken: s.spoken, rate: s.rate });
  }
  return out;
}
```

`tools/tts/README.md`, under « Round 2 »: add the sentence « Since the Kokoro plan's Task 6 the game's `spokenForm` produces variant C itself; `round2.json` is the frozen record of what the user listened to: do not regenerate it with `round2.ts`. »

- [ ] **Step 4: Run the tests**

Run: `scripts/npm.sh run test -- src/lib/dictation` — Expected: PASS (paste counts; `tts.test.ts` still passes: it does not pin the endings).
Run: `scripts/npm.sh run test` — Expected: PASS (the guards, `frenchSpacing.test.ts` included: no string literal in `spoken.ts` carries a space before « ? ! ; : »).
Run: `scripts/npm.sh run check` — Expected: `0 errors and 0 warnings`.
Run once: `scripts/playwright.sh scenes-battle-play scenes-audio happy-path world` — Expected: PASS (these read the spoken lines with `toContain`, unaffected by the endings; any spec that pins an old « , point. » form is updated to the new one and named in the report).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/dictation/spoken.ts web/src/lib/dictation/spoken.test.ts web/src/lib/dictation/script.ts web/src/lib/dictation/script.test.ts tools/tts/README.md
git commit -m "Kokoro Task 6: the voice closes each sentence before naming its mark (bake-off variant C); the script's unique lines

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/lib/dictation/spoken.ts web/src/lib/dictation/spoken.test.ts web/src/lib/dictation/script.ts web/src/lib/dictation/script.test.ts tools/tts/README.md
```

(Add any e2e spec the last run made you update.)

---

### Task 7: Voice lines through the mixer

**Files:**
- Modify: `web/src/lib/audio/engine.ts`, `engine.test.ts`, `recordingBackend.ts`, `howlerBackend.ts`, `howlerBackend.test.ts`, `lazyBackend.ts`, `lazyBackend.test.ts`, `voice.ts`, `audio.svelte.ts`, `audio.svelte.test.ts`

**Interfaces:**
- Consumes: `gainOf`, `AudioSettings` (`settings.ts`), `withAudio`, `audio()` (`audio.svelte.ts`), `audioSettings` (`store.svelte.ts`).
- Produces (Task 8 and Task 9 rely on these):
  - `engine.ts`: `interface VoiceClip { url: string; text: string; ms: number }`, `interface LineHandle { ended: Promise<void>; stop(): void; volume(gain: number): void }`, `AudioBackend.line(clip: VoiceClip, gain: number): LineHandle`, `silentLine(ms: number): LineHandle`, `engine.say(clip: VoiceClip): LineHandle`.
  - `recordingBackend.ts`: `RECORDED_LINE_MS = 20`, `Recorded.lines: { text: string; gain: number; ms: number; stopped: boolean }[]`.
  - `howlerBackend.ts`: `lineWatchdogMs(ms: number): number` (`2 × ms + 3000`).
  - `lib/audio/voice.ts`: `playLine(clip: VoiceClip): LineHandle`, `voiceMuted(): boolean` (kept); `voiceGain`/`voiceSpeaking` stay until Task 9 removes them with `tts.ts`.
  - `audio.svelte.ts`: `AudioProbe.lines(): { text: string; gain: number }[]` (e2e reads `window.__discordeAudio.lines()`).

- [ ] **Step 1: Write the failing tests**

Append to `web/src/lib/audio/engine.test.ts` (add `vi, afterEach` to the vitest import, and `RECORDED_LINE_MS` to the `recordingBackend` import):

```ts
describe('the voice channel (spec 2026-09-27 §5.1: the dictation plays through the mixer)', () => {
  afterEach(() => vi.useRealTimers());
  const clip = (text = 'Un matin. Point.', ms = 1000) => ({ url: `blob:${text}`, text, ms });

  it('plays a line at the voice gain, the music ducked under it until it ends', async () => {
    vi.useFakeTimers();
    const { backend, engine } = setup();
    engine.unlock();
    engine.scene('camp');
    engine.setSettings(with_({ voice: { volume: 0.4 } }));
    const line = engine.say(clip());
    expect(backend.log.lines).toEqual([{ text: 'Un matin. Point.', gain: 0.4, ms: 1000, stopped: false }]);
    expect(engine.snapshot()).toMatchObject({ ducks: ['voice'], voiceSpeaking: true });
    await vi.advanceTimersByTimeAsync(RECORDED_LINE_MS);
    await line.ended;
    expect(engine.snapshot()).toMatchObject({ ducks: [], voiceSpeaking: false });
  });

  it('drops effects while a line plays (Ruling E6)', () => {
    const { backend, engine } = setup();
    engine.unlock();
    engine.say(clip());
    engine.sfx('tap');
    expect(backend.log.sfx).toEqual([]);
  });

  it('says one line at a time: a new line stops the last, whose late end leaves the music down', async () => {
    vi.useFakeTimers();
    const { backend, engine } = setup();
    engine.unlock();
    engine.say(clip('Un.'));
    const second = engine.say(clip('Deux.'));
    expect(backend.log.lines.map((l) => [l.text, l.stopped])).toEqual([['Un.', true], ['Deux.', false]]);
    await Promise.resolve();
    expect(engine.snapshot().ducks).toEqual(['voice']);
    await vi.advanceTimersByTimeAsync(RECORDED_LINE_MS);
    await second.ended;
    expect(engine.snapshot().ducks).toEqual([]);
  });

  it("applies the voice channel to the line playing: a new volume at once, silence when muted", () => {
    const { backend, engine } = setup();
    engine.unlock();
    engine.say(clip());
    engine.setSettings(with_({ voice: { volume: 0.25 } }));
    expect(backend.log.lines[0].gain).toBe(0.25);
    engine.setSettings(with_({ voice: { muted: true } }));
    expect(backend.log.lines[0].gain).toBe(0);
  });

  it('before the unlock, a line is silent and takes its length (Ruling K14)', async () => {
    vi.useFakeTimers();
    const { backend, engine } = setup();
    let over = false;
    void engine.say(clip('Un.', 800)).ended.then(() => (over = true));
    expect(backend.log.lines).toEqual([]);
    expect(engine.snapshot().ducks).toEqual([]);
    await vi.advanceTimersByTimeAsync(799);
    expect(over).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(over).toBe(true);
  });
});
```

In `web/src/lib/audio/howlerBackend.test.ts`, extend `FakeHowl`: add the constructor option types `format?: string[]; volume?: number`, and a method

```ts
    stop() {
      this.calls.push('stop');
      return this;
    }
```

then append:

```ts
describe('a voice line (spec 2026-09-27 §5.1)', () => {
  beforeEach(() => void (made.length = 0));
  afterEach(() => vi.useRealTimers());
  const clip = { url: 'blob:abc', text: 'Un matin. Point.', ms: 2000 };

  it('plays the fetched MP3 once through Web Audio, at the gain, and is over at its end', async () => {
    const b = howlerBackend();
    const line = b.line(clip, 0.6);
    const h = made.at(-1)!;
    expect(h.opts).toMatchObject({ src: ['blob:abc'], format: ['mp3'], volume: 0.6 });
    expect(h.opts.html5).toBeUndefined();
    expect(h.calls).toEqual(['play']);
    h.emit('end');
    await line.ended;
    expect(h.calls).toContain('unload');
  });

  it('stops at once, and follows the channel while it plays', async () => {
    const b = howlerBackend();
    const line = b.line(clip, 0.6);
    const h = made.at(-1)!;
    line.volume(0.3);
    expect(h.calls).toContain('volume 0.3');
    line.stop();
    await line.ended;
    expect(h.calls.slice(-2)).toEqual(['stop', 'unload']);
  });

  it('a line whose end never comes is over after its watchdog (the iPad locked mid-line)', async () => {
    vi.useFakeTimers();
    const b = howlerBackend();
    let over = false;
    void b.line(clip, 1).ended.then(() => (over = true));
    await vi.advanceTimersByTimeAsync(lineWatchdogMs(2000) - 1);
    expect(over).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(over).toBe(true);
    expect(lineWatchdogMs(2000)).toBe(7000);
  });

  it('a clip that cannot load is skipped, never thrown', async () => {
    const b = howlerBackend();
    const line = b.line(clip, 1);
    made.at(-1)!.emit('loaderror');
    await line.ended;
    expect(made.at(-1)!.calls).toContain('unload');
  });
});
```

(import `lineWatchdogMs` next to `howlerBackend`; if the file's existing tests already reset `made` in a `beforeEach`, reuse it instead of adding one.)

Append to `web/src/lib/audio/lazyBackend.test.ts`:

```ts
describe('a voice line before and after Howler arrives', () => {
  it('is silent at its length until Howler is there, then played by it', async () => {
    vi.useFakeTimers();
    const { real, open, lazy } = deferred();
    let over = false;
    void lazy.line({ url: 'blob:1', text: 'Un.', ms: 500 }, 1).ended.then(() => (over = true));
    await vi.advanceTimersByTimeAsync(500);
    expect(over).toBe(true);
    expect(real.log.lines).toEqual([]);
    open();
    await vi.advanceTimersByTimeAsync(0);
    lazy.line({ url: 'blob:2', text: 'Deux.', ms: 500 }, 0.5);
    expect(real.log.lines.map((l) => [l.text, l.gain])).toEqual([['Deux.', 0.5]]);
    vi.useRealTimers();
  });
});
```

In `web/src/lib/audio/audio.svelte.test.ts`, where the e2e probe is checked (the `__discordeAudioStub` test), add: `expect(typeof w.__discordeAudio!.lines).toBe('function'); expect(w.__discordeAudio!.lines()).toEqual([]);` (adapt the variable names to that test's own).

- [ ] **Step 2: Run them to see them fail**

Run: `scripts/npm.sh run test -- src/lib/audio`
Expected: FAIL (`engine.say is not a function`, `line` missing on the backends).

- [ ] **Step 3: Write the implementation**

`engine.ts`:
- Header comment: replace « and the voice (speechSynthesis, played elsewhere) only signalled here, » with « and the dictation's voice (a line at a time, fetched from the server by lib/dictation/voice.ts), » — the rest of the sentence stays.
- After `AudioBackend`'s `state()`, add to the interface:

```ts
  /** Plays one line of the dictation's voice once, at `gain` (spec 2026-09-27 §5.1). `ended` resolves
   *  when it ends, is stopped, or cannot be played (a line is never an error of the mixer). */
  line(clip: VoiceClip, gain: number): LineHandle;
```

- Above `AudioBackend`:

```ts
/** A line of the dictation's voice: its audio (a blob URL of the server's MP3), its text (the e2e
 *  recorder writes it down) and its estimated length (voice.ts `speechMs`: a silent line's length and the
 *  Howler backend's watchdog, Ruling K7). */
export interface VoiceClip {
  url: string;
  text: string;
  ms: number;
}
export interface LineHandle {
  ended: Promise<void>;
  stop(): void;
  volume(gain: number): void;
}

/** A line nobody hears (before the unlock, Ruling K14; Howler not there yet): it takes its length. */
export function silentLine(ms: number): LineHandle {
  let done!: () => void;
  const ended = new Promise<void>((resolve) => (done = resolve));
  const timer = setTimeout(done, ms);
  return {
    ended,
    stop() {
      clearTimeout(timer);
      done();
    },
    volume() {},
  };
}
```

- In `createEngine`, next to `const ducks`: `let line: LineHandle | null = null;`.
- In `setSettings`: after `settings = next;` add `line?.volume(gainOf(settings.voice));`.
- Add the method after `voice(speaking)`:

```ts
    /** One line of the dictation's voice (spec 2026-09-27 §5.1): at the voice channel's gain, the music
     *  ducked and effects held while it plays; a new line stops the last. Before the unlock it is
     *  silent and takes its length (Ruling K14). */
    say(clip: VoiceClip): LineHandle {
      line?.stop();
      if (!unlocked) return silentLine(clip.ms);
      const h = backend.line(clip, gainOf(settings.voice));
      line = h;
      duck('voice', true);
      void h.ended.then(() => {
        // A stopped line ending late must not let the music up under the next one.
        if (line === h) {
          line = null;
          duck('voice', false);
        }
      });
      return h;
    },
```

`recordingBackend.ts`: `import type { AudioBackend, ContextState, LineHandle, VoiceClip } from './engine';`; add to `Recorded` the field `lines: { text: string; gain: number; ms: number; stopped: boolean }[];` and `lines: []` to the initial log; export

```ts
/** How long a recorded line lasts: the former speechSynthesis stub's 20 ms (Ruling K7), so the e2e
 *  suite keeps its pace; the line's real length is written down in `ms`. */
export const RECORDED_LINE_MS = 20;
```

and the method:

```ts
    line(clip: VoiceClip, gain: number): LineHandle {
      const l = { text: clip.text, gain, ms: clip.ms, stopped: false };
      log.lines.push(l);
      let done!: () => void;
      const ended = new Promise<void>((resolve) => (done = resolve));
      const timer = setTimeout(done, RECORDED_LINE_MS);
      return {
        ended,
        stop() {
          l.stopped = true;
          clearTimeout(timer);
          done();
        },
        volume(g) {
          l.gain = g;
        },
      };
    },
```

`howlerBackend.ts`: import `LineHandle`, `VoiceClip` types; export

```ts
/** A line's end event that never comes (the iPad locked or interrupted mid-line): given up after twice
 *  its estimated length and 3 s more, so the dictation goes on and the music comes back up. */
export const lineWatchdogMs = (ms: number): number => ms * 2 + 3000;
```

and add to the returned backend:

```ts
    line(clip, gain): LineHandle {
      // Web Audio (never html5: iOS ignores a media element's volume, audioGuards.test.ts). A blob URL
      // has no extension: the format says what it is.
      const h = new Howl({ src: [clip.url], format: ['mp3'], volume: gain });
      let done!: () => void;
      const ended = new Promise<void>((resolve) => (done = resolve));
      let over = false;
      const finish = () => {
        if (over) return;
        over = true;
        clearTimeout(watchdog);
        h.unload();
        done();
      };
      const skipped = () => {
        missing(clip.url);
        finish();
      };
      h.once('end', finish);
      h.once('loaderror', skipped);
      h.once('playerror', skipped);
      const watchdog = setTimeout(finish, lineWatchdogMs(clip.ms));
      h.play();
      return {
        ended,
        stop() {
          if (!over) h.stop();
          finish();
        },
        volume(g) {
          if (!over) h.volume(g);
        },
      };
    },
```

`lazyBackend.ts`: import `silentLine` (value) and the two types from `./engine`; add `line(clip, gain) { return backend ? backend.line(clip, gain) : silentLine(clip.ms); },` with the comment `// A line asked before Howler arrived is silent at its length (short, and late is worse than never).`

`lib/audio/voice.ts`: replace the header comment with « The dictation's voice on the mixer (spec 2026-09-27 §5.1): each line plays on the voice channel through `playLine`; a muted voice fetches and plays nothing (lib/dictation/voice.ts waits the line's length instead). » and add:

```ts
import { silentLine, type LineHandle, type VoiceClip } from './engine';

/** Plays one line of the dictation's voice (the music ducks under it, effects wait). A mixer that throws
 *  plays it silently at its length: the dictation goes on. */
export function playLine(clip: VoiceClip): LineHandle {
  let handle: LineHandle | null = null;
  withAudio((e) => (handle = e.say(clip)));
  return handle ?? silentLine(clip.ms);
}
```

(`voiceGain`, `voiceMuted`, `voiceSpeaking` stay for now: `tts.ts` still uses them until Task 9.)

`audio.svelte.ts`: add to `AudioProbe` `/** The voice lines played, oldest first (e2e: spokenLines). */ lines(): { text: string; gain: number }[];` and in the probe object `lines: () => recorder.log.lines.map((l) => ({ text: l.text, gain: l.gain })),`.

- [ ] **Step 4: Run the tests**

Run: `scripts/npm.sh run test -- src/lib/audio` — Expected: PASS (paste counts).
Run: `scripts/npm.sh run test` — Expected: PASS (every guard: `audioGuards` sees no `html5: true` and no `new Audio(`).
Run: `scripts/npm.sh run check` — Expected: `0 errors and 0 warnings`.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/audio/engine.ts web/src/lib/audio/engine.test.ts web/src/lib/audio/recordingBackend.ts web/src/lib/audio/howlerBackend.ts web/src/lib/audio/howlerBackend.test.ts web/src/lib/audio/lazyBackend.ts web/src/lib/audio/lazyBackend.test.ts web/src/lib/audio/voice.ts web/src/lib/audio/audio.svelte.ts web/src/lib/audio/audio.svelte.test.ts
git commit -m "Kokoro Task 7: the mixer plays a voice line on the voice channel (gain, mute, duck, watchdog; recorded in e2e)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/lib/audio/engine.ts web/src/lib/audio/engine.test.ts web/src/lib/audio/recordingBackend.ts web/src/lib/audio/howlerBackend.ts web/src/lib/audio/howlerBackend.test.ts web/src/lib/audio/lazyBackend.ts web/src/lib/audio/lazyBackend.test.ts web/src/lib/audio/voice.ts web/src/lib/audio/audio.svelte.ts web/src/lib/audio/audio.svelte.test.ts
```

---

### Task 8: `voice.ts`, the runner's failure and « Réessayer », the copy

**Files:**
- Create: `web/src/lib/dictation/voice.ts`, `web/src/lib/dictation/voice.test.ts`
- Modify: `web/src/lib/dictation/runner.ts`, `runner.test.ts`, `content/dialogue/battle.json`, `web/src/lib/dialogue/types.ts`, `web/src/lib/dialogue/content.test.ts`, `web/src/lib/battle/lines.ts`, `web/src/components/battle/DictationPhase.svelte` (its initial `runnerState` only)

**Interfaces:**
- Consumes: `SayLine`, `Step`, `buildPlan`, `buildScript` (Task 6); `VoiceClip`, `LineHandle` (`lib/audio/engine`), `playLine`, `voiceMuted` (`lib/audio/voice`, Task 7); `sayKey` (`lib/dialogue/select`).
- Produces (Task 9 relies on these):
  - `lib/dictation/voice.ts`: `SPEECH_MS_PER_CHAR = 65`, `speechMs(text, rate)`, `SLOW_MS = 400`, `fetchTimeoutMs(spoken)` (`20_000 + 50 × length`), `MAX_PREPARE_LINES = 500`, `type VoiceFailure = 'unreachable' | 'server'`, `class VoiceError extends Error { failure: VoiceFailure; retryable: boolean }`, `interface SpeakOpts { next?: SayLine | null; onSlow?(): void; onStart?(): void }`, `interface VoiceDeps { profileId; fetch?; play?; muted?; toUrl?; revoke? }`, `interface Voice { speak(spoken, rate, opts?): Promise<void>; prefetch(line: SayLine): void; prepare(lines: SayLine[]): void; cancel(): void; dispose(): void }`, `createVoice(deps: VoiceDeps): Voice`.
  - `runner.ts`: `RunnerStatus` gains `'silenced'`; `RunnerState.failure: VoiceFailure | null`; `RunnerDeps.speak: (spoken: string, rate: number, next: SayLine | null) => Promise<void>`; the runner's `retry()`.
  - Content keys `battle.voice.wait` (speaker `pythia`), `battle.voice.lost` (speaker `eris`); `DIALOGUE_KEYS` includes both.
  - `lib/battle/lines.ts`: `DICTATION.status.silenced`, `VOICE_LOST = { askParent, retry, toCamp, cause: { unreachable, server } }`.

- [ ] **Step 1: Write the failing tests**

`web/src/lib/dictation/voice.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createVoice, fetchTimeoutMs, SLOW_MS, SPEECH_MS_PER_CHAR, speechMs, VoiceError } from './voice';
import type { LineHandle, VoiceClip } from '../audio/engine';

type Call = { url: string; body: { profile_id: number; text?: string; speed?: number; lines?: unknown[] } };
type Respond = (call: Call, n: number, init: RequestInit) => Promise<Response> | Response;

const ok = () => new Response(new Blob(['mp3']), { status: 200, headers: { 'Content-Type': 'audio/mpeg' } });
const status = (s: number) => new Response(JSON.stringify({ detail: 'x' }), { status: s });
const hang: Respond = (_c, _n, init) =>
  new Promise((_, reject) => init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));

function harness(o: { respond?: Respond; muted?: boolean } = {}) {
  const calls: Call[] = [];
  const played: VoiceClip[] = [];
  const handles: { end: () => void; stopped: boolean }[] = [];
  const revoked: string[] = [];
  const muted = { on: o.muted ?? false };
  let made = 0;
  const voice = createVoice({
    profileId: 7,
    fetch: async (url, init) => {
      const call = { url, body: JSON.parse(String(init.body)) } as Call;
      calls.push(call);
      return o.respond ? o.respond(call, calls.length, init) : ok();
    },
    play: (clip): LineHandle => {
      played.push(clip);
      let end!: () => void;
      const ended = new Promise<void>((r) => (end = r));
      const h = { end, stopped: false };
      handles.push(h);
      return { ended, stop: () => ((h.stopped = true), end()), volume: () => {} };
    },
    muted: () => muted.on,
    toUrl: () => `blob:${++made}`,
    revoke: (u) => revoked.push(u),
  });
  return { voice, calls, played, handles, revoked, muted };
}
const speaks = (calls: Call[]) => calls.filter((c) => c.url === '/api/tts/speak').map((c) => c.body.text);

afterEach(() => vi.useRealTimers());

describe('the voice on the server (spec 2026-09-27 §5)', () => {
  it("fetches the line for this hero and plays it on the voice channel, resolving at its end", async () => {
    const { voice, calls, played, handles } = harness();
    let done = false;
    const p = voice.speak('Un matin. Point.', 0.75).then(() => (done = true));
    await vi.waitFor(() => expect(played).toHaveLength(1));
    expect(calls).toEqual([{ url: '/api/tts/speak', body: { profile_id: 7, text: 'Un matin. Point.', speed: 0.75 } }]);
    expect(played[0]).toEqual({ url: 'blob:1', text: 'Un matin. Point.', ms: speechMs('Un matin. Point.', 0.75) });
    expect(done).toBe(false);
    handles[0].end();
    await p;
    expect(done).toBe(true);
  });

  it("a muted voice fetches nothing and waits the line's length", async () => {
    vi.useFakeTimers();
    const { voice, calls, played } = harness({ muted: true });
    let done = false;
    void voice.speak('x'.repeat(10), 0.75).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(speechMs('x'.repeat(10), 0.75) - 1);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
    expect(calls).toEqual([]);
    expect(played).toEqual([]);
  });

  it('says when a line is late (400 ms), then when it starts', async () => {
    vi.useFakeTimers();
    const said: string[] = [];
    const { voice } = harness({ respond: () => new Promise((r) => setTimeout(() => r(ok()), 1000)) });
    void voice.speak('Un.', 1, { onSlow: () => said.push('slow'), onStart: () => said.push('start') });
    await vi.advanceTimersByTimeAsync(SLOW_MS - 1);
    expect(said).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(said).toEqual(['slow']);
    await vi.advanceTimersByTimeAsync(1000);
    expect(said).toEqual(['slow', 'start']);
  });

  it('is not late when the line comes quickly', async () => {
    vi.useFakeTimers();
    const said: string[] = [];
    const { voice } = harness();
    void voice.speak('Un.', 1, { onSlow: () => said.push('slow'), onStart: () => said.push('start') });
    await vi.advanceTimersByTimeAsync(SLOW_MS * 3);
    expect(said).toEqual(['start']);
  });

  it('tries a failed line once more, silently', async () => {
    const { voice, calls, played, handles } = harness({ respond: (_c, n) => (n === 1 ? status(500) : ok()) });
    const p = voice.speak('Un.', 1);
    await vi.waitFor(() => expect(played).toHaveLength(1));
    handles[0].end();
    await p;
    expect(speaks(calls)).toEqual(['Un.', 'Un.']);
  });

  it.each([
    [() => status(503), 'unreachable'],
    [() => status(500), 'server'],
    [() => status(502), 'server'],
    [() => Promise.reject(new TypeError('Failed to fetch')), 'unreachable'],
  ] as [Respond, string][])('fails after the retry with its cause (%#)', async (respond, failure) => {
    const { voice, calls, played } = harness({ respond });
    await expect(voice.speak('Un.', 1)).rejects.toMatchObject({ name: 'VoiceError', failure });
    expect(speaks(calls)).toEqual(['Un.', 'Un.']);
    expect(played).toEqual([]);
  });

  it('gives up on a line that never comes after its timeout, twice: « unreachable »', async () => {
    vi.useFakeTimers();
    const { voice, calls } = harness({ respond: hang });
    let failure: unknown = null;
    void voice.speak('Un.', 1).catch((e: VoiceError) => (failure = e.failure));
    await vi.advanceTimersByTimeAsync(fetchTimeoutMs('Un.'));
    expect(speaks(calls)).toEqual(['Un.', 'Un.']);
    await vi.advanceTimersByTimeAsync(fetchTimeoutMs('Un.'));
    expect(failure).toBe('unreachable');
    expect(fetchTimeoutMs('x'.repeat(100))).toBe(25_000);
  });

  it('does not try again a line the server refused (4xx): « server »', async () => {
    const { voice, calls } = harness({ respond: () => status(422) });
    await expect(voice.speak('Un.', 1)).rejects.toMatchObject({ failure: 'server' });
    expect(speaks(calls)).toEqual(['Un.']);
  });

  it('never plays a line cancelled while it was coming (a pause, « Quitter »)', async () => {
    vi.useFakeTimers();
    const { voice, played } = harness({ respond: () => new Promise((r) => setTimeout(() => r(ok()), 1000)) });
    let done = false;
    void voice.speak('Un.', 1).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(500);
    voice.cancel();
    await vi.advanceTimersByTimeAsync(1000);
    expect(done).toBe(true);
    expect(played).toEqual([]);
  });

  it('cancel() stops the line playing', async () => {
    const { voice, played, handles } = harness();
    const p = voice.speak('Un.', 1);
    await vi.waitFor(() => expect(played).toHaveLength(1));
    voice.cancel();
    await p;
    expect(handles[0].stopped).toBe(true);
  });

  it('fetches the next line once this one plays; the next line and a replay come from memory', async () => {
    const { voice, calls, played, handles } = harness();
    const first = voice.speak('Un.', 0.9, { next: { spoken: 'Deux.', rate: 0.9 } });
    await vi.waitFor(() => expect(played).toHaveLength(1));
    await vi.waitFor(() => expect(speaks(calls)).toEqual(['Un.', 'Deux.']));
    handles[0].end();
    await first;
    const second = voice.speak('Deux.', 0.9);
    await vi.waitFor(() => expect(played).toHaveLength(2));
    handles[1].end();
    await second;
    const again = voice.speak('Un.', 0.9);
    await vi.waitFor(() => expect(played).toHaveLength(3));
    handles[2].end();
    await again;
    expect(speaks(calls)).toEqual(['Un.', 'Deux.']);
  });

  it('asks again next time for a line that failed', async () => {
    let down = true;
    const { voice, calls, played, handles } = harness({ respond: () => (down ? status(503) : ok()) });
    await expect(voice.speak('Un.', 1)).rejects.toBeInstanceOf(VoiceError);
    down = false;
    const p = voice.speak('Un.', 1);
    await vi.waitFor(() => expect(played).toHaveLength(1));
    handles[0].end();
    await p;
    expect(speaks(calls)).toEqual(['Un.', 'Un.', 'Un.']);
  });

  it('dispose() frees every clip, and a clip landing after it is freed at once and never played', async () => {
    vi.useFakeTimers();
    let n = 0;
    const { voice, played, handles, revoked } = harness({ respond: () => (++n === 1 ? ok() : new Promise((r) => setTimeout(() => r(ok()), 1000))) });
    const p = voice.speak('Un.', 1);
    await vi.waitFor(() => expect(played).toHaveLength(1));
    handles[0].end();
    await p;
    void voice.speak('Deux.', 1);
    voice.dispose();
    expect(revoked).toEqual(['blob:1']);
    await vi.advanceTimersByTimeAsync(1000);
    expect(revoked).toEqual(['blob:1', 'blob:2']);
    expect(played).toHaveLength(1);
  });

  it('sends the lines ahead, in order, for this hero; a muted voice sends nothing', async () => {
    const { voice, calls, muted } = harness();
    voice.prepare([{ spoken: 'Un.', rate: 0.9 }, { spoken: 'Deux.', rate: 0.9 }]);
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual({ url: '/api/tts/prepare', body: { profile_id: 7, lines: [{ text: 'Un.', speed: 0.9 }, { text: 'Deux.', speed: 0.9 }] } });
    muted.on = true;
    voice.prepare([{ spoken: 'Trois.', rate: 0.9 }]);
    voice.prefetch({ spoken: 'Trois.', rate: 0.9 });
    await new Promise((r) => setTimeout(r, 0));
    expect(calls).toHaveLength(1);
  });

  it("waits what a voice takes for a muted line: 65 ms a character, divided by the rate, at least 300 ms", () => {
    expect(SPEECH_MS_PER_CHAR).toBe(65);
    expect(speechMs('abc', 1)).toBe(300);
    expect(speechMs('x'.repeat(100), 0.75)).toBeCloseTo((100 * 65) / 0.75);
  });
});
```

Append to `web/src/lib/dictation/runner.test.ts`:

```ts
describe('when the voice fails (spec 2026-09-27 §5.3)', () => {
  const failing = (failure: 'unreachable' | 'server') => Object.assign(new Error('voice'), { failure });

  it('passes the next line to be fetched ahead, then none after the last', async () => {
    const nexts: (string | null)[] = [];
    const runner = createRunner([say(0), { kind: 'wait', ms: 600 }, say(0, 2), { kind: 'wait', ms: 3000 }, say(1), { kind: 'done' }], {
      pace: 3, speak: async (_s, _r, next) => void nexts.push(next?.spoken ?? null), sleep: async () => {}, cancel: () => {}, onChange: () => {},
    });
    runner.start();
    await flush();
    expect(nexts).toEqual(['s0', 's1', null]);
  });

  it('pauses on the line it could not say, with the cause; « Réessayer » says it and carries on', async () => {
    let down = true;
    const spoken: string[] = [];
    const runner = createRunner([say(0), { kind: 'manual', index: 0 }, say(1), { kind: 'manual', index: 1 }, { kind: 'done' }], {
      pace: 2,
      speak: async (s) => {
        if (down) throw failing('unreachable');
        spoken.push(s);
      },
      sleep: async () => {}, cancel: () => {}, onChange: () => {},
    });
    runner.start();
    await flush();
    expect(runner.state()).toMatchObject({ status: 'silenced', failure: 'unreachable', index: 0, done: 0 });
    down = false;
    runner.retry();
    await flush();
    expect(spoken).toEqual(['s0']);
    expect(runner.state()).toMatchObject({ status: 'waiting', failure: null, done: 1 });
  });

  it('a retry that fails again silences again, with the new cause (Review Focus 3)', async () => {
    const causes: ('unreachable' | 'server')[] = ['unreachable', 'server'];
    const runner = createRunner([say(0), { kind: 'manual', index: 0 }, { kind: 'done' }], {
      pace: 2, speak: async () => { throw failing(causes.shift() ?? 'server'); }, sleep: async () => {}, cancel: () => {}, onChange: () => {},
    });
    runner.start();
    await flush();
    expect(runner.state()).toMatchObject({ status: 'silenced', failure: 'unreachable' });
    runner.retry();
    await flush();
    expect(runner.state()).toMatchObject({ status: 'silenced', failure: 'server' });
  });

  it('a failed replay silences; « Réessayer » replays without spending a replay, then waits (Review Focus 4)', async () => {
    let down = false;
    const spoken: string[] = [];
    const runner = createRunner([say(0), { kind: 'manual', index: 0 }, { kind: 'done' }], {
      pace: 2,
      speak: async (s) => {
        if (down) throw failing('server');
        spoken.push(s);
      },
      sleep: async () => {}, cancel: () => {}, onChange: () => {},
    });
    runner.start();
    await flush();
    down = true;
    runner.replay();
    await flush();
    expect(runner.state()).toMatchObject({ status: 'silenced', failure: 'server', replaysLeft: 2 });
    down = false;
    runner.retry();
    await flush();
    expect(spoken).toEqual(['s0', 's0']);
    expect(runner.state()).toMatchObject({ status: 'waiting', failure: null, replaysLeft: 2 });
  });

  it('a pause wins over a failure that lands after it; a stopped runner says nothing more', async () => {
    let fail!: () => void;
    const states: string[] = [];
    const runner = createRunner([say(0), { kind: 'wait', ms: 600 }, say(0, 2), { kind: 'done' }], {
      pace: 3,
      speak: () => new Promise<void>((_, reject) => (fail = () => reject(failing('unreachable')))),
      sleep: async () => {}, cancel: () => {}, onChange: (s) => states.push(s.status),
    });
    runner.start();
    await flush();
    runner.pause();
    fail();
    await flush();
    expect(runner.state().status).toBe('paused');
    runner.stop();
    expect(states.at(-1)).toBe('paused');
  });
});
```

In `web/src/lib/dialogue/content.test.ts`, the last test's regex becomes `/dictation\/(tts|voice)|speechSynthesis|speak\(/`.

- [ ] **Step 2: Run them to see them fail**

Run: `scripts/npm.sh run test -- src/lib/dictation src/lib/dialogue`
Expected: FAIL (`./voice` missing, `retry` missing, `failure` missing).

- [ ] **Step 3: The copy**

`content/dialogue/battle.json`, two keys after `battle.explain` (plain spaces; the loader spaces them):

```json
    "battle.voice.wait": [
      { "speaker": "pythia", "text": "La voix de la Pythie s'éclaircit…" },
      { "speaker": "pythia", "text": "La Pythie reprend son souffle…" },
      { "speaker": "pythia", "text": "Les vapeurs de Delphes montent. La voix arrive…" }
    ],
    "battle.voice.lost": [
      { "speaker": "eris", "text": "Chut ! J'ai fait taire la voix de la Pythie. Plus un mot ne sortira de Delphes." },
      { "speaker": "eris", "text": "La voix s'est tue ? C'est mon œuvre, et j'en suis très fière." },
      { "speaker": "eris", "text": "Un petit sort sur la voix, et la voilà muette. Je suis ravie de mon coup !" }
    ]
```

`web/src/lib/dialogue/types.ts`: add `'battle.voice.wait', 'battle.voice.lost'` at the end of the `battle.*` keys in `DIALOGUE_KEYS`.

`web/src/lib/battle/lines.ts`:
- `DICTATION.status` gains `silenced: "La voix s'est tue.",` (after `paused`).
- After the Dictation fence, a new fence:

```ts
// ===== The voice (Kokoro plan, Task 8) =====
/** Éris's card when the voice cannot be heard (spec 2026-09-27 §5.3). Her gloat is the content key
 *  `battle.voice.lost`; the waiting line is `battle.voice.wait` (Ruling K5). The cause is for the parent. */
export const VOICE_LOST = {
  askParent: 'Appelle un parent : lui seul peut rompre ce sortilège.',
  retry: 'Réessayer',
  toCamp: 'Retour au camp',
  cause: {
    unreachable: 'voix : serveur injoignable',
    server: 'voix : erreur du serveur',
  },
} as const;
```

- [ ] **Step 4: `voice.ts`**

`web/src/lib/dictation/voice.ts`:

```ts
// The dictation's voice (spec 2026-09-27 §5): Kokoro on the server. Each line is fetched from
// /api/tts/speak (the game server proxies the `tts` service), kept as a blob URL for replays and the
// next line, and played by `playLine` on the voice channel (the music ducks, effects wait). A muted
// voice fetches nothing and waits the line's length. A failed fetch - a network error, a 5xx, or no
// answer within 20 s + 50 ms a character - is tried once more, silently; then speak() rejects with a
// VoiceError, which the runner turns into Éris's card (§5.3). There is no other voice (§2).
import { playLine, voiceMuted } from '../audio/voice';
import type { LineHandle, VoiceClip } from '../audio/engine';
import type { SayLine } from './script';

/**
 * How fast a voice speaks French at rate 1: 65 ms a character of the spoken form (its spaces and its
 * said punctuation included), divided by the line's rate. What a muted voice waits instead of the line
 * (UI5 Ruling E7b) and each clip's estimated length (Ruling K7). Calibrated in UI5 fix wave A.
 */
export const SPEECH_MS_PER_CHAR = 65;

/** How long a French voice takes to say `text` at `rate`, in ms (at least 300). */
export function speechMs(text: string, rate: number): number {
  return Math.max(300, (text.length * SPEECH_MS_PER_CHAR) / rate);
}

/** A line not back after this long shows the waiting line (§5.2). */
export const SLOW_MS = 400;
/** How long a line may take to come (§5.3). */
export const fetchTimeoutMs = (spoken: string): number => 20_000 + 50 * spoken.length;
/** The voice service's limit on one prepare (tts/app/main.py MAX_PREPARE_LINES). */
export const MAX_PREPARE_LINES = 500;

/** Ruling K6: `unreachable` (503, the network, the timeout) or `server` (any other error answer). */
export type VoiceFailure = 'unreachable' | 'server';

export class VoiceError extends Error {
  constructor(
    readonly failure: VoiceFailure,
    readonly retryable = true,
  ) {
    super(`voice: ${failure}`);
    this.name = 'VoiceError';
  }
}

export interface SpeakOpts {
  /** The line said after this one: fetched once this one starts playing (§5.2). */
  next?: SayLine | null;
  /** The line is more than SLOW_MS late. */
  onSlow?: () => void;
  /** The line starts playing. */
  onStart?: () => void;
}

export interface VoiceDeps {
  profileId: number;
  fetch?: (url: string, init: RequestInit) => Promise<Response>;
  play?: (clip: VoiceClip) => LineHandle;
  muted?: () => boolean;
  toUrl?: (blob: Blob) => string;
  revoke?: (url: string) => void;
}

export interface Voice {
  /** Says a line; resolves when it has been played (or cancelled); rejects with a VoiceError. */
  speak(spoken: string, rate: number, opts?: SpeakOpts): Promise<void>;
  prefetch(line: SayLine): void;
  /** Sends a dictation's lines ahead to be recorded, in order (fire and forget). */
  prepare(lines: SayLine[]): void;
  /** Stops the line playing; a line still coming will not play. */
  cancel(): void;
  /** The dictation (or the lyre) is gone: every clip is freed. */
  dispose(): void;
}

export function createVoice(deps: VoiceDeps): Voice {
  const doFetch = deps.fetch ?? ((url: string, init: RequestInit) => fetch(url, init));
  const play = deps.play ?? playLine;
  const muted = deps.muted ?? voiceMuted;
  const toUrl = deps.toUrl ?? ((blob: Blob) => URL.createObjectURL(blob));
  const revoke = deps.revoke ?? ((url: string) => URL.revokeObjectURL(url));
  const clips = new Map<string, Promise<VoiceClip>>();
  const urls = new Set<string>();
  let generation = 0;
  let current: LineHandle | null = null;
  let disposed = false;

  const post = (body: unknown): RequestInit => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  async function attempt(line: SayLine): Promise<VoiceClip> {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), fetchTimeoutMs(line.spoken));
    try {
      const res = await doFetch('/api/tts/speak', {
        ...post({ profile_id: deps.profileId, text: line.spoken, speed: line.rate }),
        signal: abort.signal,
      });
      if (res.status === 503) throw new VoiceError('unreachable');
      if (res.status >= 500) throw new VoiceError('server');
      if (!res.ok) throw new VoiceError('server', false);
      const url = toUrl(await res.blob());
      if (disposed) {
        revoke(url);
        throw new VoiceError('unreachable', false);
      }
      urls.add(url);
      return { url, text: line.spoken, ms: speechMs(line.spoken, line.rate) };
    } catch (e) {
      if (e instanceof VoiceError) throw e;
      throw new VoiceError('unreachable'); // the network, or the timeout's abort
    } finally {
      clearTimeout(timer);
    }
  }

  function load(line: SayLine): Promise<VoiceClip> {
    const key = `${line.rate}|${line.spoken}`;
    const known = clips.get(key);
    if (known) return known;
    const made = attempt(line).catch((e: VoiceError) => (e.retryable && !disposed ? attempt(line) : Promise.reject(e)));
    clips.set(key, made);
    // A line that failed is asked for again next time.
    made.catch(() => {
      if (clips.get(key) === made) clips.delete(key);
    });
    return made;
  }

  function prefetch(line: SayLine): void {
    if (disposed || muted()) return;
    load(line).catch(() => undefined); // its own speak() reports the failure, if it still fails then
  }

  function cancel(): void {
    generation++;
    current?.stop();
    current = null;
  }

  return {
    async speak(spoken, rate, opts = {}) {
      cancel();
      const token = generation;
      if (muted()) {
        await new Promise((resolve) => setTimeout(resolve, speechMs(spoken, rate)));
        return;
      }
      const slow = setTimeout(() => {
        if (token === generation) opts.onSlow?.();
      }, SLOW_MS);
      let clip: VoiceClip;
      try {
        clip = await load({ spoken, rate });
      } catch (e) {
        if (token !== generation || disposed) return; // cancelled meanwhile: nobody waits for it
        throw e;
      } finally {
        clearTimeout(slow);
      }
      if (token !== generation || disposed) return;
      opts.onStart?.();
      const handle = play(clip);
      current = handle;
      if (opts.next) prefetch(opts.next);
      await handle.ended;
      if (current === handle) current = null;
    },
    prefetch,
    prepare(lines) {
      if (disposed || muted() || lines.length === 0) return;
      const body = { profile_id: deps.profileId, lines: lines.slice(0, MAX_PREPARE_LINES).map((l) => ({ text: l.spoken, speed: l.rate })) };
      void doFetch('/api/tts/prepare', post(body)).catch(() => undefined);
    },
    cancel,
    dispose() {
      disposed = true;
      cancel();
      for (const url of urls) revoke(url);
      urls.clear();
      clips.clear();
    },
  };
}
```

- [ ] **Step 5: The runner**

`web/src/lib/dictation/runner.ts`:
- Header: « speaks `say` steps » → « speaks `say` steps (through the server's voice, spec 2026-09-27), », and add « A line the voice could not say pauses the runner (`silenced`) until `retry()`. » Replace « without the Web Speech API » with « without the voice ».
- Imports: `import { replayLimit, type Pace, type SayLine, type SayStep, type Step } from './script';` and `import type { VoiceFailure } from './voice';`.
- `export type RunnerStatus = 'idle' | 'playing' | 'waiting' | 'paused' | 'silenced' | 'finished';`
- `RunnerState` gains `/** Spec 2026-09-27 §5.3: why the voice fell silent (the card's cause line), while `silenced`. */ failure: VoiceFailure | null;`
- `RunnerDeps.speak: (spoken: string, rate: number, next: SayLine | null) => Promise<void>;` with the comment `// \`next\`: the line said after this one, fetched ahead once this one plays (null after the last).`
- Helpers above `createRunner`:

```ts
/** The line said after step `index`, for the voice to fetch ahead (null: none left). */
function nextSay(steps: Step[], index: number): SayLine | null {
  for (let i = index + 1; i < steps.length; i++) {
    const s = steps[i];
    if (s.kind === 'say') return { spoken: s.spoken, rate: s.rate };
  }
  return null;
}

/** The cause a failed line carries (voice.ts's VoiceError), `server` when it carries none. */
function failureOf(e: unknown): VoiceFailure {
  const f = (e as { failure?: unknown } | null)?.failure;
  return f === 'unreachable' || f === 'server' ? f : 'server';
}
```

- State: `let failure: VoiceFailure | null = null;` and `let silencedBy: 'loop' | 'replay' | null = null;`; `snapshot()` returns `{ index, status, lastSay, replaysLeft, done, total, resumeAt, failure }`.
- In `runLoop`, the say branch's `await deps.speak(step.spoken, step.rate);` becomes:

```ts
        try {
          await deps.speak(step.spoken, step.rate, nextSay(steps, index));
        } catch (e) {
          if (stopped || paused) return;
          silence(e, 'loop'); // the same step is said again on retry()
          return;
        }
```

- Inside `createRunner`, the functions:

```ts
  function silence(e: unknown, by: 'loop' | 'replay') {
    failure = failureOf(e);
    silencedBy = by;
    status = 'silenced';
    emit();
  }

  function sayAgain() {
    const say = lastSay!;
    deps.speak(say.spoken, say.rate, null).catch((e) => {
      if (stopped || status !== 'waiting') return;
      silence(e, 'replay');
    });
  }
```

- `replay()` ends with `sayAgain();` instead of `void deps.speak(lastSay.spoken, lastSay.rate);`.
- New method after `resume()`:

```ts
    /** « Réessayer » on Éris's card: the line the voice could not say, again (a replay's without
     *  spending another replay), then on as before. */
    retry() {
      if (stopped || status !== 'silenced') return;
      failure = null;
      const by = silencedBy;
      silencedBy = null;
      if (by === 'replay') {
        status = 'waiting';
        emit();
        sayAgain();
      } else {
        void runLoop();
      }
    },
```

`web/src/components/battle/DictationPhase.svelte`: the initial `runnerState` literal gains `failure: null,` (nothing else in this task).

- [ ] **Step 6: Run the tests**

Run: `scripts/npm.sh run test -- src/lib/dictation src/lib/dialogue src/lib/battle` — Expected: PASS (paste counts: the content test sees the two new keys with three lines each, Éris's lines pass `FORBIDDEN` and `erisSelfMasculine`, the typography and length rules).
Run: `scripts/npm.sh run test` — Expected: PASS (every guard: `noEmoji`, `registerGuard`, `noGuilt`, `frenchSpacing`, `formPlural`).
Run: `scripts/npm.sh run check` — Expected: `0 errors and 0 warnings`.

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/dictation/voice.ts web/src/lib/dictation/voice.test.ts web/src/lib/dictation/runner.ts web/src/lib/dictation/runner.test.ts content/dialogue/battle.json web/src/lib/dialogue/types.ts web/src/lib/dialogue/content.test.ts web/src/lib/battle/lines.ts web/src/components/battle/DictationPhase.svelte
git commit -m "Kokoro Task 8: the voice client (fetch, one silent retry, timeout, prefetch, prepare), the runner's silence and « Réessayer », the waiting line and Éris's card copy

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/lib/dictation/voice.ts web/src/lib/dictation/voice.test.ts web/src/lib/dictation/runner.ts web/src/lib/dictation/runner.test.ts content/dialogue/battle.json web/src/lib/dialogue/types.ts web/src/lib/dialogue/content.test.ts web/src/lib/battle/lines.ts web/src/components/battle/DictationPhase.svelte
```

---

### Task 9: The game switches to the server voice

**Files:**
- Create: `web/src/components/battle/VoiceLostCard.svelte`, `web/e2e/scenes-voice.spec.ts`, `web/e2e/voice-real.spec.ts`, `web/playwright.voice.config.ts`
- Delete: `web/src/lib/dictation/tts.ts`, `web/src/lib/dictation/tts.test.ts`
- Modify: `web/src/components/battle/DictationPhase.svelte`, `web/src/components/battle/MusterPhase.svelte`, `web/src/screens/Play.svelte`, `web/src/components/places/cabin/LyrePanel.svelte`, `web/src/lib/dictation/index.ts`, `web/src/lib/audio/voice.ts`, `web/src/lib/audio/engine.ts` (the unused `voice()` signal), `web/src/lib/audio/engine.test.ts` (its tests of `voice()`), `web/src/lib/types.ts`, `web/src/lib/battle/lines.ts` (`MUSTER.noVoice`), `web/src/audioGuards.test.ts`
- Modify (e2e): `web/e2e/helpers.ts`, `grimoire.spec.ts`, `happy-path.spec.ts`, `playability-ui3.spec.ts`, `playability-ui4.spec.ts`, `playability-ui5.spec.ts`, `scenes-audio.spec.ts`, `scenes-battle-play.spec.ts`, `scenes-battle-victory.spec.ts`, `scenes-battle.spec.ts`, `scenes-cabin.spec.ts`, `world.spec.ts`; `web/playwright.config.ts`, `web/tsconfig.e2e.json`
- Modify: `scripts/check.sh` (the real-voice step), `README.md` (§1, §3, §7), `ASSETS-LICENSES.md`, `docs/superpowers/specs/2026-09-23-la-discorde-design.md` (§3.3, §4)

**Interfaces:**
- Consumes: everything Task 8 produces (`createVoice`, `VoiceError`, `VoiceFailure`, `runner.retry()`, `RunnerState.failure`, `DICTATION.status.silenced`, `VOICE_LOST`, keys `battle.voice.*`), `sayLines` (Task 6), `AudioProbe.lines()` (Task 7), the stacks (Task 5), `/api/tts/health`'s `engine` (Task 4).
- Produces: `DictationPhase` props `profileId: number` and `onLeaveToCamp: () => void` (no `voice` prop); `VoiceLostCard` props `failure: VoiceFailure`, `onRetry: () => void`, `onLeave?: () => void`; test ids `voice-lost` (`data-failure`), `voice-lost-eris` (`data-key`), `voice-lost-eris-text`, `voice-lost-cause`, `btn-voice-retry`, `btn-voice-camp`; e2e helpers `spokenLines(page): Promise<{ text: string; gain: number }[]>`, `spokenVolumes(page)` (from the lines), `variantsOf(key): string[]` (`stubSpeech` is deleted); `playwright.voice.config.ts` (matches `voice-*.spec.ts`, used by Task 10 too).

- [ ] **Step 1: The card**

`web/src/components/battle/VoiceLostCard.svelte`:

```svelte
<script lang="ts">
  // Éris's card when the voice cannot be heard (spec 2026-09-27 §5.3): she gloats in-fiction, the card
  // sends the player to a parent, and a small line names the cause for that parent. « Réessayer » asks
  // for the same line again; the way back to the camp (the dictation only) leaves as « Quitter » does,
  // the draft kept. The lyre's trial uses the short form: no way back (the lyre is an overlay).
  import { untrack } from 'svelte';
  import { sayKey } from '../../lib/dialogue/select';
  import { VOICE_LOST } from '../../lib/battle/lines';
  import { focusOnMount } from '../../lib/battle/focus';
  import type { VoiceFailure } from '../../lib/dictation/voice';

  let { failure, onRetry, onLeave }: { failure: VoiceFailure; onRetry: () => void; onLeave?: () => void } = $props();

  // Picked once, when the card opens (UI5 Ruling E14: a pick never lives in a $derived).
  const line = untrack(() => sayKey('battle.voice.lost'));
</script>

<div class="kit-note voice-lost" data-tone="eris" role="alert" data-testid="voice-lost" data-failure={failure}>
  <p class="eris" data-testid="voice-lost-eris" data-key={line.key}>
    <img class="portrait" src={line.portrait} alt="" style:filter={line.portraitFilter ?? null} />
    <span><strong>{line.name}</strong> <span data-testid="voice-lost-eris-text">{line.text}</span></span>
  </p>
  <p class="ask">{VOICE_LOST.askParent}</p>
  <p class="cause" data-testid="voice-lost-cause">{VOICE_LOST.cause[failure]}</p>
  <div class="actions">
    <button type="button" class="kit-bronze" data-testid="btn-voice-retry" onclick={onRetry} use:focusOnMount>{VOICE_LOST.retry}</button>
    {#if onLeave}
      <button type="button" class="kit-bronze is-quiet" data-testid="btn-voice-camp" onclick={onLeave}>{VOICE_LOST.toCamp}</button>
    {/if}
  </div>
</div>

<style>
  .voice-lost {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .voice-lost p {
    margin: 0;
  }
  .eris {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .portrait {
    flex: none;
    width: 56px;
    height: 56px;
    object-fit: contain;
  }
  .ask {
    font-weight: 600;
  }
  /* The parent's line: small, but readable (it is what a parent reads out when asking for help). */
  .cause {
    font-size: 14px;
    font-style: italic;
    color: var(--ink-soft);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
</style>
```

Check `DialogueLine` (`lib/scene/types.ts`) for the frame's field names before relying on `portrait`, `portraitFilter` and `name`; use what it declares.

- [ ] **Step 2: The dictation**

`web/src/components/battle/DictationPhase.svelte`:
- Imports: drop `import { cancelSpeech, speak } from '../../lib/dictation/tts';`; import `sayLines` next to `buildScript`; add `import { createVoice } from '../../lib/dictation/voice';`, `import { sayKey } from '../../lib/dialogue/select';`, `import VoiceLostCard from './VoiceLostCard.svelte';`.
- Props: remove `voice` (and its type line); add `profileId: number;` (with `/** The hero the voice speaks for (/api/tts/* needs her, Ruling K4). */`) and `onLeaveToCamp: () => void;` (with `/** Éris's card's way back to the camp (spec 2026-09-27 §5.3). */`) to the destructuring and the type.
- Before the runner:

```ts
  // The server's voice (spec 2026-09-27 §5): one per dictation, its clips freed when it ends.
  const voice = untrack(() => createVoice({ profileId }));
  // §5.2: the waiting line while a line is more than 400 ms late (null: the runner's own status).
  let voiceWait = $state<string | null>(null);
  const steps = untrack(() => buildScript(plan, pace));
```

- `createRunner(buildScript(plan, pace), {` → `createRunner(steps, {`; its deps:

```ts
        speak: (spoken, rate, next) =>
          voice
            .speak(spoken, rate, {
              next,
              onSlow: () => (voiceWait = sayKey('battle.voice.wait').text),
              onStart: () => (voiceWait = null),
            })
            .finally(() => (voiceWait = null)),
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        cancel: () => voice.cancel(),
```

- `onMount`: before `runner.start();`: `// §5.2 and Ruling K12: the lines from the unit this dictation starts at, sent ahead in order.` then `voice.prepare(sayLines(steps.slice(runner.state().resumeAt)));`.
- `onDestroy`: `runner.stop(); voice.dispose();` (drop the `cancelSpeech()` belt: `dispose()` stops the line).
- `statusText`: `$derived(voiceWait ?? DICTATION.status[runnerState.status])`.
- `finish()` and `confirmedQuit()`: `cancelSpeech()` → `voice.cancel()`.
- Markup: right after the `{#if confirmQuit}…{/if}` block:

```svelte
  {#if runnerState.status === 'silenced'}
    <VoiceLostCard failure={runnerState.failure ?? 'server'} onRetry={() => runner.retry()} onLeave={onLeaveToCamp} />
  {/if}
```

- CSS: `.seal[data-status='paused']` → `.seal[data-status='paused'], .seal[data-status='silenced']`.
- Header comment: add « The voice is Kokoro on the server (spec 2026-09-27): a late line shows the waiting line, a silenced one Éris's card. »

`web/src/screens/Play.svelte`:
- Drop the `pickVoice, unlockSpeech, waitForVoices` import, `let voice = $state<SpeechSynthesisVoice | null>(null);`, and the two lines `const voices = await waitForVoices(); voice = pickVoice(…) ?? null;` in `load()`.
- `continueSession()`: body `showResumeBanner = false;`; its comment becomes « Tapped from the resume banner. The tap itself unlocks the audio (lib/audio/gestures.ts), the voice included. »
- `startDictation()`: drop `unlockSpeech();` and replace its two-line comment with « The tap on « Commencer la dictée » unlocks the audio (lib/audio/gestures.ts): the voice plays through it. »
- After `quitDictation()`:

```ts
  // Spec 2026-09-27 §5.3: Éris's card's way back to the camp leaves as « Quitter » does (the draft kept
  // behind the resume ribbon), then goes home.
  function leaveDictationForCamp() {
    quitDictation();
    go(href('camp', { profileId: String(profile.id) }));
  }
```

- `<DictationPhase …>`: `{voice}` → `profileId={profile.id}` and add `onLeaveToCamp={leaveDictationForCamp}`.

`web/src/components/battle/MusterPhase.svelte`: drop the `ttsAvailable` import and the `{#if !ttsAvailable()}…{/if}` block (Ruling K11). `web/src/lib/battle/lines.ts`: drop `MUSTER.noVoice` (grep `noVoice` across `web/` first; nothing else may use it).

- [ ] **Step 3: The lyre**

`web/src/components/places/cabin/LyrePanel.svelte`:
- Header comment: « the dictation voice, » → « the dictation voice's trial, »; « the voice's select wears the parchment look with no label over it, » goes.
- Imports: drop `listFrenchVoices, pickVoice, speak, waitForVoices`; add `import { onDestroy } from 'svelte';` (next to `untrack`), `import { createVoice, VoiceError, type VoiceFailure } from '../../../lib/dictation/voice';`, `import VoiceLostCard from '../../battle/VoiceLostCard.svelte';`.
- Drop `voices`, `voiceName`, `loadVoices()` and its call.
- Add:

```ts
  // The trial line (Ruling K10): the server's voice, like the dictation; the same card when it fails.
  const TRIAL = 'Bonjour ! Je lirai tes dictées. Virgule, point.';
  const voice = untrack(() => createVoice({ profileId: profile.id }));
  onDestroy(() => voice.dispose());
  let trying = $state(false);
  let trialFailure = $state<VoiceFailure | null>(null);

  async function tryVoice() {
    trying = true;
    trialFailure = null;
    try {
      await voice.speak(TRIAL, 0.9);
    } catch (e) {
      trialFailure = e instanceof VoiceError ? e.failure : 'server';
    } finally {
      trying = false;
    }
  }
```

- `save()`: the body's type becomes `{ settings: { weekly_goal?: number }; level: string; pin?: string }` and `settings: { weekly_goal: Number(weeklyGoal) }`.
- The section « La voix de la dictée » becomes:

```svelte
    <section>
      <h3 class="kit-section">La voix de la dictée</h3>
      <!-- Final review M7: a muted voice says nothing; the trial waits for it (the note below says why). -->
      <button type="button" class="kit-bronze is-quiet" data-testid="lyre-try-voice" disabled={audioSettings.voice.muted || trying} onclick={tryVoice}
        >Écouter un essai</button
      >
      {#if trialFailure}
        <VoiceLostCard failure={trialFailure} onRetry={tryVoice} />
      {/if}
    </section>
```

- Drop `<p class="note">Sur iPad, seuls les boutons de l'appareil règlent le volume de la voix.</p>` and its comment, and the `.note` CSS rule if nothing else uses it.
- Credits: after the fonts' line add `<p>La voix de la dictée est celle de Kokoro, offerte par ses auteurs sous la licence Apache 2.0, apprise sur les enregistrements français SIWIS, offerts sous la licence Creative Commons Attribution 4.0.</p>`.

`web/src/lib/types.ts`: drop `voice?: string;` from `ProfileSettings` (the server keeps the stored field; nothing reads it, Ruling K10).

- [ ] **Step 4: `tts.ts` goes, the guard comes**

Delete `web/src/lib/dictation/tts.ts` and `tts.test.ts` (`git rm`). `web/src/lib/dictation/index.ts`: `export * from './tts';` → `export * from './voice';`.

`web/src/lib/audio/voice.ts`: drop `voiceGain` and `voiceSpeaking` (and the now unused imports) once `grep -rn "voiceGain\|voiceSpeaking" web/src` shows no user. `web/src/lib/audio/engine.ts`: drop the `voice(speaking)` method if `grep -rn "\.voice(" web/src` shows no user outside tests, and the tests in `engine.test.ts` that call `engine.voice(…)` move to `engine.say` (the ducking they pin is covered by Task 7's tests: delete the duplicates, keep any assertion Task 7 does not make, rewritten on `say`). `snapshot().voiceSpeaking` stays (e2e reads it).

Append to `web/src/audioGuards.test.ts`'s `describe`:

```ts
  it('never speaks through the browser: the voice is Kokoro on the server, with no fallback (spec 2026-09-27 §2, §5.1)', () => {
    expect(files.filter((f) => /speechSynthesis|SpeechSynthesis/.test(readFileSync(f, 'utf-8')))).toEqual([]);
  });
```

The guard reads comments too: rewrite every remaining comment that names `speechSynthesis` in `web/src` (e.g. `lib/audio/engine.ts`, `lib/audio/settings.ts`, `components/places/cabin/LyrePanel.svelte`, `lib/dialogue/content.test.ts` is a test file and exempt) to name « the voice » instead. `grep -rn "speechSynthesis\|SpeechSynthesis\|tts\.ts\|dictation/tts" web/src` must print nothing but test files.

- [ ] **Step 5: The e2e migration**

`web/e2e/helpers.ts`:
- Delete `stubSpeech` and its comment.
- `spokenVolumes` and a new helper:

```ts
/** The dictation's voice lines the (recording) mixer played, oldest first (Kokoro plan: the voice is the
 *  server's, played through the mixer; e2e records it, Ruling K7). */
export async function spokenLines(page: Page): Promise<{ text: string; gain: number }[]> {
  return page.evaluate(
    () => (window as unknown as { __discordeAudio?: { lines(): { text: string; gain: number }[] } }).__discordeAudio?.lines() ?? [],
  );
}

/** The voice channel's gain for each line played, oldest first. */
export async function spokenVolumes(page: Page): Promise<number[]> {
  return (await spokenLines(page)).map((l) => l.gain);
}
```

- After `CONTENT_LINES`:

```ts
/** A dialogue key's variants as the page shows them (French spacing applied). */
export function variantsOf(key: string): string[] {
  return (CONTENT_LINES[key] ?? []).map((l) => frenchSpacing(l.text));
}
```

- The `installKeyboardSim` comment: « Like stubSpeech's speechSynthesis, `window.visualViewport` … is replaced » → « `window.visualViewport` … is replaced ».

Every spec: remove the `stubSpeech` import and every `await stubSpeech(page)` / `test.beforeEach(async ({ page }) => stubSpeech(page));` line (a `beforeEach` left empty goes). Replace the reads of the old stub:
- `page.evaluate(() => (window as any).__spoken.length)` → `(await spokenLines(page)).length` (in `expect.poll` callbacks: `async () => (await spokenLines(page)).length`);
- `((window as any).__spoken as string[]).at(-1) ?? ''` → `(await spokenLines(page)).at(-1)?.text ?? ''`;
- `((window as any).__spoken as string[]).slice(n).find((s) => s.trim() !== '') ?? ''` → `(await spokenLines(page)).slice(n)[0]?.text ?? ''` (the recorder has no empty unlock line);
- `world.spec.ts`: `const spokenCount = async (page: Page) => (await spokenLines(page)).length;`;
- `scenes-audio.spec.ts`: `said(page)` → `spokenLines(page)` with `.map((l) => ({ text: l.text, volume: l.gain }))` where the test reads `volume` (or read `gain` directly); its comment « (tts.ts, SPEECH_MS_PER_CHAR) » → « (voice.ts, SPEECH_MS_PER_CHAR) »;
- `happy-path.spec.ts`: `expect((await spokenLines(page)).length).toBeGreaterThanOrEqual(2);`.

`scenes-cabin.spec.ts`, the lyre test: drop the two assertions on `getByLabel('Voix de la dictée')` / `label[for="voice"]` and the `toContainText("Sur iPad, seuls les boutons…")`; add `await expect(lyre.getByTestId('lyre-try-voice')).toBeVisible();`, `await expect(lyre.locator('select')).toHaveCount(0);` and, after the credits open, `await expect(lyre.getByTestId('lyre-credits')).toContainText('Kokoro');`.

Run `grep -rn "stubSpeech\|__spoken\|speechSynthesis" web/e2e` — it must print nothing.

- [ ] **Step 6: The new e2e specs**

`web/e2e/scenes-voice.spec.ts`:

```ts
// The dictation's voice on the server (spec 2026-09-27 §5): the lines sent ahead, the waiting line,
// Éris's card when the voice is silenced (a route stands in for a stopped `tts` container), « Réessayer »,
// the way back to the camp, and the lyre's trial. The e2e stack runs `tts` as its stub (TTS_STUB=1).
import type { APIRequestContext, Page, Route, TestInfo } from '@playwright/test';
import { test, expect } from './crashGuard';
import { createProfileApi, createText, expectBattle, expectCamp, heroNamer, spokenLines, tap, uniqueName, variantsOf } from './helpers';
import { frenchSpacing } from '../src/lib/text/french';

const heroName = heroNamer('Voix');
const BODY = 'Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.';
const WRITE = "À toi d'écrire.";

async function startDictation(page: Page, request: APIRequestContext, testInfo: TestInfo, pace: 1 | 2 | 3 | 4) {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const text = await createText(request, { title: uniqueName('Voix'), body: BODY, level: '10H' });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'muster');
  const sheet = page.getByTestId('battle-parchment');
  await tap(sheet.getByTestId(`pace-option-${pace}`), testInfo);
  await tap(sheet.getByRole('button', { name: 'Commencer la dictée' }), testInfo);
  await expectBattle(page, 'dictation');
  return { id, textId: text.id as number };
}

/** Answers /api/tts/speak with `status` while `down()` says so, else lets it through; counts the asks. */
async function voiceDown(page: Page, status: number, down: () => boolean) {
  const asked = { n: 0 };
  await page.route('**/api/tts/speak', (route: Route) => {
    asked.n++;
    return down() ? route.fulfill({ status, contentType: 'application/json', body: '{"detail":"voice down"}' }) : route.continue();
  });
  return asked;
}

test('the whole script is sent ahead once, each line once, in script order (spec §5.2)', async ({ page, request }, testInfo) => {
  const prepared = page.waitForRequest((r) => r.url().endsWith('/api/tts/prepare'));
  const { id } = await startDictation(page, request, testInfo, 3);
  const body = (await prepared).postDataJSON() as { profile_id: number; lines: { text: string; speed: number }[] };
  expect(body.profile_id).toBe(id);
  expect(body.lines.length).toBeGreaterThan(1);
  expect(new Set(body.lines.map((l) => l.text)).size).toBe(body.lines.length);
  expect(body.lines.every((l) => l.speed === 0.9)).toBe(true);
  expect(body.lines[0].text).toContain('Les fées dansent');
});

test('a line slow to come shows the waiting line until it plays (spec §5.2)', async ({ page, request }, testInfo) => {
  let held = true;
  await page.route('**/api/tts/speak', async (route) => {
    if (held) {
      held = false;
      await new Promise((r) => setTimeout(r, 1500));
    }
    await route.continue();
  });
  await startDictation(page, request, testInfo, 1);
  const status = page.getByTestId('dictation-status');
  await expect.poll(async () => variantsOf('battle.voice.wait').includes(((await status.textContent()) ?? '').trim())).toBe(true);
  await expect(status).toHaveText(WRITE);
  expect((await spokenLines(page))[0].text).toContain('Les fées dansent');
});

test("a silenced voice stops on Éris's card; « Réessayer » carries on with the draft kept, even after failing again (spec §5.3)", async ({ page, request }, testInfo) => {
  let down = true;
  const asked = await voiceDown(page, 503, () => down);
  await startDictation(page, request, testInfo, 1);
  const card = page.getByTestId('voice-lost');
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute('data-failure', 'unreachable');
  expect(asked.n).toBe(2); // one silent retry
  await expect(card.getByTestId('voice-lost-cause')).toHaveText(frenchSpacing('voix : serveur injoignable'));
  await expect(card.getByTestId('voice-lost-eris')).toHaveAttribute('data-key', 'battle.voice.lost');
  expect(variantsOf('battle.voice.lost')).toContain(((await card.getByTestId('voice-lost-eris-text').textContent()) ?? '').trim());
  await expect(page.getByTestId('dictation-status')).toHaveText("La voix s'est tue.");
  await page.getByTestId('dictation-textarea').fill('Les fées');
  // Review Focus 3: still down, « Réessayer » brings the card back, never a stuck dictation.
  await tap(card.getByTestId('btn-voice-retry'), testInfo);
  await expect.poll(() => asked.n).toBe(4);
  await expect(page.getByTestId('voice-lost')).toBeVisible();
  down = false;
  await tap(page.getByTestId('btn-voice-retry'), testInfo);
  await expect(page.getByTestId('voice-lost')).toHaveCount(0);
  await expect(page.getByTestId('dictation-status')).toHaveText(WRITE);
  await expect(page.getByTestId('dictation-textarea')).toHaveValue('Les fées');
  expect((await spokenLines(page))[0].text).toContain('Les fées dansent');
});

test("a voice that answers with an error names it for the parent: « erreur du serveur »", async ({ page, request }, testInfo) => {
  await voiceDown(page, 500, () => true);
  await startDictation(page, request, testInfo, 2);
  await expect(page.getByTestId('voice-lost')).toHaveAttribute('data-failure', 'server');
  await expect(page.getByTestId('voice-lost-cause')).toHaveText(frenchSpacing('voix : erreur du serveur'));
});

test('« Retour au camp » leaves the dictation as « Quitter » does: the draft waits behind the ribbon', async ({ page, request }, testInfo) => {
  await voiceDown(page, 503, () => true);
  const { id, textId } = await startDictation(page, request, testInfo, 1);
  await page.getByTestId('dictation-textarea').fill('Les fées');
  await tap(page.getByTestId('btn-voice-camp'), testInfo);
  await expectCamp(page);
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await page.goto(`/#/p/${id}/play/${textId}`);
  await expectBattle(page, 'muster');
  await expect(page.getByTestId('battle-parchment')).toContainText("Ton brouillon t'attend là où tu l'avais laissé.");
});

test("the lyre's trial speaks through the server; silenced, it shows the card's short form", async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  let down = true;
  await voiceDown(page, 503, () => down);
  await page.goto(`/#/p/${id}/settings`);
  const lyre = page.getByTestId('overlay-lyre');
  await lyre.getByTestId('lyre-try-voice').click();
  const card = lyre.getByTestId('voice-lost');
  await expect(card).toBeVisible();
  await expect(card.getByTestId('btn-voice-camp')).toHaveCount(0);
  down = false;
  await card.getByTestId('btn-voice-retry').click();
  await expect.poll(async () => (await spokenLines(page)).at(-1)?.text ?? '').toContain('Je lirai tes dictées');
  await expect(lyre.getByTestId('voice-lost')).toHaveCount(0);
});
```

(Whether `desktop` or `ipad` taps the lyre with `click()` — the lyre tests in `scenes-audio.spec.ts` click too — follow that file's precedent. The ribbon text is `MUSTER.resume`; if the muster shows it elsewhere than inside `battle-parchment`, assert on the testid the existing resume tests use — read `scenes-battle-play.spec.ts`'s resume test first.)

`web/playwright.voice.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

// The real voice (spec 2026-09-27 §7, Kokoro plan Ruling K8): specs against the non-stub `tts`
// (Kokoro loaded), run with TTS_STUB=0 by scripts/check.sh (`voice-real`) and tools/tts/voice_walk.sh
// (`voice-walk`). One worker: every line is really synthesised on the CPU.
export default defineConfig({
  testDir: './e2e',
  testMatch: ['**/voice-*.spec.ts'],
  timeout: 240_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  // The same stall budget as playwright.config.ts (its `expect` comment says why).
  expect: { timeout: 15_000 },
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:8080',
    locale: 'fr-CH',
    screenshot: 'only-on-failure',
    ...devices['Desktop Safari'],
  },
});
```

`web/playwright.config.ts`: `testIgnore: ['**/playability*.spec.ts', '**/voice-*.spec.ts'],` and add to its header comment « The real-voice specs (voice-*.spec.ts) only run through playwright.voice.config.ts. » `web/tsconfig.e2e.json`: add `"playwright.voice.config.ts"` to `include`.

`web/e2e/voice-real.spec.ts`:

```ts
// The real voice (spec 2026-09-27 §7): Kokoro, not the stub, reads a dictation's first line. Run by
// scripts/check.sh with TTS_STUB=0 through playwright.voice.config.ts.
import { test, expect } from './crashGuard';
import { createProfileApi, createText, expectBattle, spokenLines, uniqueName } from './helpers';

test("Kokoro reads a dictation's first line", async ({ page, request }) => {
  const health = await request.get('/api/tts/health');
  expect(health.status()).toBe(200);
  const { voice, engine } = (await health.json()) as { voice: string; engine: string };
  expect(voice).toBe('ready');
  expect(engine).toMatch(/^kokoro-82m-v1\.0-/);
  const id = await createProfileApi(request, uniqueName('Kokoro'));
  const text = await createText(request, { title: uniqueName('Kokoro'), body: 'Le renard court dans la forêt. Il cherche sa tanière.', level: '10H' });
  const speak = page.waitForResponse((r) => r.url().endsWith('/api/tts/speak'), { timeout: 120_000 });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'muster');
  const sheet = page.getByTestId('battle-parchment');
  await sheet.getByTestId('pace-option-1').click();
  await sheet.getByRole('button', { name: 'Commencer la dictée' }).click();
  await expectBattle(page, 'dictation');
  const res = await speak;
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toBe('audio/mpeg');
  // About 3 s of speech: an MP3 of that length is several kilobytes, whatever the encoder's bitrate.
  expect((await res.body()).length).toBeGreaterThan(4_000);
  await expect.poll(async () => (await spokenLines(page)).length, { timeout: 60_000 }).toBe(1);
  expect((await spokenLines(page))[0].text).toBe('Le renard court dans la forêt. Point.');
  await expect(page.getByTestId('dictation-status')).toHaveText("À toi d'écrire.", { timeout: 60_000 });
});
```

`scripts/check.sh`: after `echo "== e2e: playwright"…`, add:

```bash
# The real voice (spec 2026-09-27 §7, Kokoro plan Ruling K8): one spec against Kokoro itself.
echo "== e2e: the real voice";   TTS_STUB=0 scripts/playwright.sh --config playwright.voice.config.ts voice-real
```

- [ ] **Step 7: The docs**

`README.md`:
- §1, the dictation bullet: « read aloud by the device's own French text-to-speech voice. » → « read aloud by a French voice (Kokoro-82M) that the server synthesises in its second container. »
- §3, « **The dictation voice.** » paragraph, replaced by: « **The dictation voice.** The server reads the dictations with Kokoro-82M's French voice: nothing needs installing on the iPad. « Écouter un essai » in the lyre (the hero's cabin, **« La lyre »**) plays a sample. If the voice cannot be reached, the dictation stops on a card from Éris asking the player to fetch a parent; its small line names the cause (§2, "If the voice goes silent"). »
- §3 Sound: « Whether the dictation voice still speaks in silent mode is up to the iPad. » → « The dictation voice plays through the game's own audio too, so silent mode mutes it as well. »; « On the iPad the voice's slider has no effect (iPadOS ignores it): use the iPad's volume buttons for the voice. » → « Every slider works on the iPad, the voice's included. »
- §7: delete the two voice limitations (device voice quality; the voice slider on the iPad) and add « The dictation voice needs the server's `tts` container: the first line of a long text at « D'une traite » can take several seconds to come (a short line shows while it does). »
- §6, the licences list: add « **The dictation voice** — Kokoro-82M (Apache-2.0) with its French voice `ff_siwis`, trained on the SIWIS French speech data (CC BY 4.0); credited in `ASSETS-LICENSES.md`. »

`ASSETS-LICENSES.md`, after the Alexandria section (outside the `audio:start/end` markers, which `tools/audio` regenerates):

```markdown
## The dictation voice (spec 2026-09-27)

The `tts` image bakes in Kokoro-82M and its French voice; they are downloaded at build time
(`tts/Dockerfile`, each file checked against the sha256 in `tools/tts/parity.json`), not shipped in
this repository. The lyre's credits name them to the players.

| Component | Source | Author | Licence |
|---|---|---|---|
| Kokoro-82M v1.0 (model weights) | [hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) | hexgrad | [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0) |
| Voice `ff_siwis` | trained on the [SIWIS French Speech Synthesis Database](https://datashare.ed.ac.uk/handle/10283/2353) | Pierre-Edouard Honnet, Alexandros Lazaridis, Philip N. Garner, Junichi Yamagishi (Idiap Research Institute, University of Edinburgh) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| <the build's runtime row, by verdict> | | | |
| espeak-ng (French phonemes) | [espeak-ng](https://github.com/espeak-ng/espeak-ng) | the eSpeak NG contributors | [GPL-3.0-or-later](https://www.gnu.org/licenses/gpl-3.0.html) |
```

The runtime row, by `tools/tts/parity.json`'s verdict: `onnx` → `| ONNX export and voices (kokoro-onnx, release model-files-v1.0) and the kokoro-onnx package | [thewh1teagle/kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx) | thewh1teagle | [MIT](https://opensource.org/licenses/MIT) |` plus `| ONNX Runtime | [microsoft/onnxruntime](https://github.com/microsoft/onnxruntime) | Microsoft | [MIT](https://opensource.org/licenses/MIT) |`; `onnx-misaki` → the same two rows and `| misaki (French G2P) | [hexgrad/misaki](https://github.com/hexgrad/misaki) | hexgrad | [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0) |`; `torch` → `| kokoro and misaki packages | [hexgrad/kokoro](https://github.com/hexgrad/kokoro) | hexgrad | [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0) |` and `| PyTorch (CPU) | [pytorch/pytorch](https://github.com/pytorch/pytorch) | the PyTorch contributors | [BSD-3-Clause](https://opensource.org/licenses/BSD-3-Clause) |`. Check each author and licence on its source page while writing (the SIWIS authors on the datashare page), and correct the row if the page says otherwise.

`docs/superpowers/specs/2026-09-23-la-discorde-design.md`:
- §3.3, the first bullet becomes: « Audio from the server: Kokoro-82M's French voice `ff_siwis`, synthesised by a second container (`tts`) and played through the game's audio on the voice channel; no browser voice and no fallback (amended by `2026-09-27-kokoro-voice-design.md`). Punctuation is spoken (« virgule », « point d'interrogation », « deux-points », « ouvrez les guillemets »…), as a teacher would; a sentence-ending mark is kept and followed by its capitalised name (« …froissées. Point. »). Numbers must be written as words in texts. »
- §4 diagram: `│ - TTS (speechSynthesis)       │` → `│ - audio (Howler), the voice   │`; below the server box, add a second box:

```
                                            ┌──────────────────────────────────┐
                                            │ tts: Kokoro-82M (FastAPI, CPU)   │
                                            │ internal only, /cache volume     │
                                            └──────────────────────────────────┘
```

  (the server box's column, joined by a `│ - /api/tts/* → tts:8000          │` line inside the server box).
- §4 bullets: « **Single container**, multi-stage Dockerfile (…). `compose.yaml` with one service, port `8080`, volume for `/data`. » → « **Two containers**: the game (multi-stage Dockerfile: node build of the SPA → python runtime serving it, port `8080`, volume for `/data`) and its voice (`tts/`, Kokoro-82M, internal only, volume `discorde-tts-cache`), both in `compose.yaml` (amended by `2026-09-27-kokoro-voice-design.md`). »

- [ ] **Step 8: Run**

Run: `scripts/npm.sh run test` — Expected: PASS (paste counts; `audioGuards` with the new guard, `content.test`, every guard).
Run: `scripts/npm.sh run check` — Expected: `0 errors and 0 warnings` (svelte-check and the e2e type-check, the voice config included).
Run: `scripts/playwright.sh scenes-voice --repeat-each=3` — Expected: PASS on `desktop` and `ipad` (18 × 2 executions).
Run once: `scripts/playwright.sh scenes-audio scenes-battle-play scenes-battle-victory scenes-battle scenes-cabin grimoire happy-path world smoke` — Expected: PASS.
Run: `TTS_STUB=0 scripts/playwright.sh --config playwright.voice.config.ts voice-real --repeat-each=3` — Expected: PASS (3 executions).
Run: `PW_WORKERS=4 scripts/check.sh` — Expected: `== ALL GREEN`, with `== e2e: the real voice` passing.

- [ ] **Step 9: Commit**

```bash
git rm web/src/lib/dictation/tts.ts web/src/lib/dictation/tts.test.ts
git add web/src/components/battle/VoiceLostCard.svelte web/src/components/battle/DictationPhase.svelte web/src/components/battle/MusterPhase.svelte web/src/screens/Play.svelte web/src/components/places/cabin/LyrePanel.svelte web/src/lib/dictation/index.ts web/src/lib/audio/voice.ts web/src/lib/audio/engine.ts web/src/lib/audio/engine.test.ts web/src/lib/types.ts web/src/lib/battle/lines.ts web/src/audioGuards.test.ts web/e2e web/playwright.config.ts web/playwright.voice.config.ts web/tsconfig.e2e.json scripts/check.sh README.md ASSETS-LICENSES.md docs/superpowers/specs/2026-09-23-la-discorde-design.md
git commit -m "Kokoro Task 9: the dictation and the lyre speak with the server's voice; Éris's card, the waiting line, e2e on the stub and one spec on the real voice; speechSynthesis removed and guarded

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/lib/dictation/tts.ts web/src/lib/dictation/tts.test.ts web/src/components/battle/VoiceLostCard.svelte web/src/components/battle/DictationPhase.svelte web/src/components/battle/MusterPhase.svelte web/src/screens/Play.svelte web/src/components/places/cabin/LyrePanel.svelte web/src/lib/dictation/index.ts web/src/lib/audio/voice.ts web/src/lib/audio/engine.ts web/src/lib/audio/engine.test.ts web/src/lib/types.ts web/src/lib/battle/lines.ts web/src/audioGuards.test.ts web/e2e web/playwright.config.ts web/playwright.voice.config.ts web/tsconfig.e2e.json scripts/check.sh README.md ASSETS-LICENSES.md docs/superpowers/specs/2026-09-23-la-discorde-design.md
```

(Any other file the greps of Steps 4–5 made you touch is named in both lists.)

---

### Task 10: The full gate, the voice walk, memory, and the README's figures

**Files:**
- Create: `tools/tts/voice_walk.sh`, `web/e2e/voice-walk.spec.ts`
- Modify: `README.md` (the memory figures), `tools/tts/README.md` (how to run the walk)

**Interfaces:**
- Consumes: the whole feature (Tasks 1–9); `playwright.voice.config.ts` (matches `voice-*.spec.ts`), `spokenLines`, `createText`, `createProfileApi`, `expectBattle` (helpers); `with_playwright_lock`, `ensure_volumes` (`scripts/lib.sh`).
- Produces: the walk (`tools/tts/voice_walk.sh`: the e2e stack with `TTS_STUB=0`, the spec, `tts` stopped and started on the spec's markers in `web/.cache/voice-walk/`, memory sampled every 2 s); measured memory at rest and at peak for both containers in `README.md`; the user's listening checklist in the report.

- [ ] **Step 1: The gate**

Run: `PW_WORKERS=4 scripts/check.sh`
Expected: `== ALL GREEN`: pytest (server, the proxy), the voice's pytest (model tests included), svelte-check `0 errors and 0 warnings`, vitest (every guard, `audioGuards`' no-`speechSynthesis`), both image builds, Playwright `desktop`, `ipad` (`scenes-voice` among them) and `chromium`, then `== e2e: the real voice`. No crash retry, or name the crashed test. Fix anything red at its cause, and run the gate again until it is green in one run.

- [ ] **Step 2: The walk's spec**

`web/e2e/voice-walk.spec.ts`:

```ts
// The voice walk (Kokoro plan Task 10), run only by tools/tts/voice_walk.sh, against the real voice:
// each pace's first lines, pace 4 on the longest seed text (the time to its first line), and the card
// when the `tts` container is really stopped, then « Réessayer » once it is back. The script stops and
// starts the container when this spec writes a marker file (web/.cache/voice-walk/, outside
// test-results, which Playwright empties at the start of a run).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { APIRequestContext, Page } from '@playwright/test';
import { test, expect } from './crashGuard';
import { createProfileApi, createText, expectBattle, spokenLines, uniqueName } from './helpers';
import { frenchSpacing } from '../src/lib/text/french';

const MARKS = '.cache/voice-walk';
const SHORT = 'Le renard court dans la forêt. Il cherche sa tanière. La nuit tombe sur la colline.';
test.skip(!process.env.VOICE_WALK, 'run by tools/tts/voice_walk.sh');
test.describe.configure({ mode: 'serial' });

async function start(page: Page, request: APIRequestContext, body: string, pace: 1 | 2 | 3 | 4) {
  const id = await createProfileApi(request, uniqueName('Marche'));
  const text = await createText(request, { title: uniqueName('Marche'), body, level: '10H' });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'muster');
  const sheet = page.getByTestId('battle-parchment');
  await sheet.getByTestId(`pace-option-${pace}`).click();
  await sheet.getByRole('button', { name: 'Commencer la dictée' }).click();
  await expectBattle(page, 'dictation');
  return Date.now();
}
const lines = async (page: Page) => (await spokenLines(page)).length;
/** A figure for the report: an annotation, and a line on stdout (the list reporter prints it). */
function note(testInfo: { annotations: { type: string; description?: string }[] }, type: string, description: string) {
  testInfo.annotations.push({ type, description });
  console.log(`[voice walk] ${type}: ${description}`);
}
const mark = (name: string) => {
  mkdirSync(MARKS, { recursive: true });
  writeFileSync(`${MARKS}/${name}`, '');
};

for (const pace of [1, 2, 3, 4] as const) {
  test(`pace ${pace}: the real voice reads its first lines`, async ({ page, request }, testInfo) => {
    const t0 = await start(page, request, SHORT, pace);
    await expect.poll(() => lines(page), { timeout: 120_000 }).toBeGreaterThan(0);
    note(testInfo, `pace ${pace}, first line`, `${Date.now() - t0} ms`);
    if (pace <= 2) {
      await expect(page.getByTestId('btn-next')).toBeEnabled({ timeout: 60_000 });
      await page.getByTestId('btn-next').click();
    }
    await expect.poll(() => lines(page), { timeout: 120_000 }).toBeGreaterThan(1);
    note(testInfo, `pace ${pace}, lines`, (await spokenLines(page)).map((l) => l.text).join(' / '));
  });
}

test('pace 4 on the longest seed text: the time to its first line (Review Focus 1)', async ({ page, request }, testInfo) => {
  test.setTimeout(300_000);
  const body = (JSON.parse(readFileSync('../content/seed/007-renard-mouches-eau.json', 'utf-8')) as { body: string }).body;
  const t0 = await start(page, request, body, 4);
  await expect.poll(() => lines(page), { timeout: 240_000 }).toBeGreaterThan(0);
  note(testInfo, 'first line (longest text, pace 4)', `${Date.now() - t0} ms`);
});

test("the card when the voice's container stops, and « Réessayer » once it is back", async ({ page, request }) => {
  test.setTimeout(600_000);
  await start(page, request, SHORT, 1);
  await expect(page.getByTestId('dictation-status')).toHaveText("À toi d'écrire.", { timeout: 120_000 });
  mark('stop-tts');
  await expect.poll(async () => (await request.get('/api/tts/health')).status(), { timeout: 180_000 }).toBe(503);
  // The second sentence was fetched ahead while the first played: it plays; the third cannot come.
  await page.getByTestId('btn-next').click();
  await expect(page.getByTestId('btn-next')).toBeEnabled({ timeout: 120_000 });
  await page.getByTestId('btn-next').click();
  await expect(page.getByTestId('voice-lost')).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId('voice-lost-cause')).toHaveText(frenchSpacing('voix : serveur injoignable'));
  mark('start-tts');
  await expect.poll(async () => (await request.get('/api/tts/health')).status(), { timeout: 300_000 }).toBe(200);
  await page.getByTestId('btn-voice-retry').click();
  await expect(page.getByTestId('voice-lost')).toHaveCount(0);
  await expect.poll(() => lines(page), { timeout: 120_000 }).toBe(3);
  await expect(page.getByTestId('dictation-status')).toHaveText("À toi d'écrire.", { timeout: 120_000 });
});
```

- [ ] **Step 3: The walk's script**

`tools/tts/voice_walk.sh` (executable):

```bash
#!/usr/bin/env bash
# The voice walk (Kokoro plan, Task 10): the e2e stack with the real voice (TTS_STUB=0), then
# web/e2e/voice-walk.spec.ts; the `tts` container is stopped and started when the spec writes its
# marker files (web/.cache/voice-walk/stop-tts, start-tts), and both containers' memory is sampled
# every 2 s (memory-rest.txt once the stack is healthy, memory-samples.txt meanwhile). Holds the
# machine-wide Playwright lock throughout (scripts/lib.sh). Logs: web/.cache/voice-walk/{app,tts}.log.
#
#   tools/tts/voice_walk.sh
set -euo pipefail
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=../../scripts/lib.sh
source "$HERE/../../scripts/lib.sh"
cd "$ROOT"
export TTS_STUB=0
MARKS=web/.cache/voice-walk
E2E=(docker compose -f compose.e2e.yaml)
rm -rf "$MARKS"
mkdir -p "$MARKS"
ensure_volumes
"${E2E[@]}" build app tts

sample() {
  docker stats --no-stream --format '{{.Name}} {{.MemUsage}}' $("${E2E[@]}" ps -q app tts) 2>/dev/null || true
}

walk() {
  "${E2E[@]}" up -d --wait app tts
  sample > "$MARKS/memory-rest.txt"
  ( while [ ! -f "$MARKS/done" ]; do sample >> "$MARKS/memory-samples.txt"; sleep 2; done ) &
  local sampler=$!
  ( until [ -f "$MARKS/stop-tts" ] || [ -f "$MARKS/done" ]; do sleep 1; done
    [ -f "$MARKS/done" ] || "${E2E[@]}" stop tts
    until [ -f "$MARKS/start-tts" ] || [ -f "$MARKS/done" ]; do sleep 1; done
    [ -f "$MARKS/done" ] || "${E2E[@]}" start tts ) &
  local watcher=$!
  set +e
  "${E2E[@]}" run --rm -T -e VOICE_WALK=1 playwright npx playwright test --config playwright.voice.config.ts voice-walk
  local status=$?
  set -e
  touch "$MARKS/done"
  wait "$sampler" "$watcher" 2>/dev/null || true
  "${E2E[@]}" logs --no-color app > "$MARKS/app.log" 2>&1 || true
  "${E2E[@]}" logs --no-color tts > "$MARKS/tts.log" 2>&1 || true
  return $status
}

trap 'touch "$MARKS/done"; "${E2E[@]}" down -v --remove-orphans >/dev/null 2>&1 || true' EXIT
set +e
with_playwright_lock walk
status=$?
set -e
echo "== memory at rest ($MARKS/memory-rest.txt)"
cat "$MARKS/memory-rest.txt"
echo "== memory samples: $MARKS/memory-samples.txt ($(wc -l < "$MARKS/memory-samples.txt") lines)"
exit $status
```

`tools/tts/README.md`: add « ## The voice walk (Kokoro plan, Task 10) » with the command, what it checks, and where the memory files and logs land (three sentences, from the script's header).

- [ ] **Step 4: Run the walk**

Run: `tools/tts/voice_walk.sh`
Expected: 6 tests passed (pace 1–4, the longest text, the stopped container); the `[voice walk]` lines on stdout give each pace's time to its first line and the longest text's; `memory-rest.txt` has both containers. Read `web/.cache/voice-walk/memory-samples.txt` (the Read tool) and note each container's peak. Read `tts.log`'s `tts: N characters at R: S s of speech in T s` lines: report the real-time factor and the real ms per character at each rate (Kokoro's pace against `SPEECH_MS_PER_CHAR = 65`; an observation for the user, not a change). A failure is fixed at its cause and the walk run again.

- [ ] **Step 5: The README's figures**

`README.md` §2, the **RAM** bullet: « the container uses about 1.1 GB once started (…) » becomes two figures from Step 4: « The game's container uses about <app at rest> once started (measured at rest, with the language model loaded) … The voice's container uses about <tts at rest> at rest and up to <tts peak> while it makes a dictation's lines (measured; `TTS_THREADS` does not change it much). » Also, in §7's new voice limitation, replace « can take several seconds » with the measured figure: « took about <N> s in our measurements (the longest seed text) ». Round to two significant figures; say "measured on <CPU of this machine>" once.

- [ ] **Step 6: Commit**

```bash
git add --chmod=+x tools/tts/voice_walk.sh
git add web/e2e/voice-walk.spec.ts README.md tools/tts/README.md
git commit -m "Kokoro Task 10: the voice walk (every pace on the real voice, the container stopped and started, « Réessayer »), memory measured, README figures

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- tools/tts/voice_walk.sh web/e2e/voice-walk.spec.ts README.md tools/tts/README.md
```

- [ ] **Step 7: The report, with the user's checklist**

Report the gate's summary, the walk's six results with their timings, the memory table (rest and peak for both containers), the real-time factor and ms per character, and this listening checklist for the user on the iPad (things no e2e can hear):
1. A dictation at each pace: the voice is clear and French, each sentence ends with « Point. » after the sentence's own cadence; the slow paces are slower, not stretched.
2. The music sits low under the voice; an effect never talks over it.
3. The voice's slider in the lyre changes its volume; « Sourdine » on the voice: nothing is read, the dictation keeps its pace.
4. Silent mode on: the voice is silent like the music.
5. Lock the iPad mid-line and unlock: the dictation goes on (the line is given up after a few seconds at worst).
6. « Écouter un essai » in the lyre.
7. Stop the `tts` container in TrueNAS during a dictation: Éris's card, « voix : serveur injoignable »; start it again: « Réessayer » carries on.
8. The waiting line on the first line of a long text at « D'une traite ».

---

## Self-review

**1. Spec coverage.**
- §1 (why; no fallback): Tasks 8–9 (the voice client, the switch), Task 9's guard (`audioGuards`: no `speechSynthesis` in `web/src`).
- §2 voice `ff_siwis` alone: Task 1 (parity on `ff_siwis`), Task 3 (`VOICE`), Task 2 (`VOICE` in the cache key). Pace through Kokoro's `speed`: Task 6 keeps `PACE_RATES` and 0.95 in the script; Task 8 sends `rate` as `speed`; Task 3's `test_a_slower_pace_is_a_longer_line`. Punctuation variant C and « À la ligne. »: Task 6 (tests from `round2.json`'s variant C, Ruling K2). No fallback: Task 9. Own container: Tasks 2, 5. Licences credited: Task 9 (`ASSETS-LICENSES.md`, the lyre's credits, README §6).
- §3 scope (the dictation and the lyre's test line; dialogue stays text): Task 9 (DictationPhase, LyrePanel); dialogue untouched (`content.test`'s "never spoken" test extended to `voice`).
- §4.1 the service: directory, Dockerfile, FastAPI, image name, compose service, no port (Tasks 2, 5); ONNX + parity proof + PyTorch fallback (Tasks 1, 3); `TTS_THREADS` (Tasks 2, 3); MP3 24 kHz mono, no trimming (Task 2 `encode_mp3`, `trim=False` in Tasks 1, 3); cache, key, LRU, `TTS_CACHE_MB`, volume (Tasks 2, 5); queue, jump, dedupe (Task 2 worker tests); `respell.json` empty, word-boundary-safe, in the key (Task 2, K3); endpoints (Task 2); limits (Task 2, K1); stub (Task 2, same cache and queue paths: `test_speak_returns_a_silent_mp3_as_long_as_the_line`).
- §4.2 the proxy, `DISCORDE_TTS_URL`, a profile required, pass-through, 503, `/api/health` unchanged, `/api/tts/health`, nothing recorded at save: Task 4 (every one has its test; nothing touches `texts.py`).
- §5.1 playback: `voice.ts` shape (`speak`, `cancelSpeech` → `cancel`, `prepare`) Task 8; Howler on the voice channel, gain and mute, duck, effects wait: Task 7; muted voice: Tasks 7–8; removed `tts.ts`, voice picker, `settings.voice` in the UI: Task 9; unlock: Task 9 (Play's comments; Ruling K14 for the rare case).
- §5.2 prepare in script order (Tasks 6, 8, 9 + e2e), the 400 ms waiting line (Tasks 8, 9 + e2e, K5), the next line fetched when the previous starts playing (Task 8 test, runner's `next`).
- §5.3 retry once, timeout `20 s + 50 ms/char` (Task 8), the card with Éris's gloat, the parent line, « Réessayer », the way back, the draft kept (Tasks 8–9 + e2e), the two cause lines (Task 8 copy, K6), the lyre's short form (Task 9 + e2e), house copy rules (content test, guards).
- §6 compose, `depends_on` without condition (Task 5); README: second image, TrueNAS YAML, memory measured (Tasks 5, 10), troubleshooting (Task 5); `ASSETS-LICENSES.md` (Task 9); parent spec amended (Task 9).
- §7 testing: every tts pytest listed (Tasks 2, 3), game server pytest (Task 4), vitest (Tasks 6, 7, 8), e2e on the stub, existing specs migrated, new specs, one real-model spec in `check.sh` (Tasks 5, 9), guards (Tasks 8, 9), the gate builds both images (Task 5).

**2. Placeholder scan.** The deliberate read-then-fill points, each with its source named: Task 1's package pins (newest of the major if a pin fails, recorded in `parity.json`), Task 1's README verdict sentence (the run's output), Task 3's variant choice, requirement pins and `ADD --checksum` values (copied from the committed `parity.json`), Task 5's image sizes, Task 9's `ASSETS-LICENSES.md` runtime row (by verdict, each alternative written out) and author/licence check on the source pages, Task 10's memory and timing figures (measured). The UI code names `DialogueLine`'s frame fields and the muster's ribbon testid as read-first checks. No "TBD", no "similar to Task N".

**3. Type consistency.** `SayLine` (Task 6) is the type of `SpeakOpts.next`, `Voice.prefetch`/`prepare` (Task 8), `RunnerDeps.speak`'s `next` and `nextSay` (Task 8), and `sayLines`' result (Task 6) that DictationPhase passes to `prepare` (Task 9). `VoiceClip`/`LineHandle`/`silentLine` (Task 7) are what `voice.ts` plays (Task 8) and every backend returns. `VoiceFailure` (Task 8) types `RunnerState.failure`, `VoiceLostCard`'s `failure` and `VOICE_LOST.cause`'s keys (Tasks 8–9). `speechMs`/`SPEECH_MS_PER_CHAR` move from `tts.ts` to `voice.ts` (Task 8) before `tts.ts` goes (Task 9). The service's `MAX_CHARS` (Task 2) = `MAX_LINE_CHARS` (Task 6) = 10 000; `MAX_PREPARE_LINES` 500 on both sides (Tasks 2, 8); `stub_ms` (Task 2) = `speechMs` (Task 8). `/api/tts/health`'s `{voice, engine}` (Task 4) is what the smoke spec (Task 5), the real-voice spec (Task 9) and the README (Task 5) read; `engine` ids come from `StubEngine.model_id` (Task 2) and `KokoroEngine.model_id` (Task 3). Test ids of Task 9's card are the ones its e2e and Task 10's walk use. `TTS_IMAGE` (Task 2) is what `compose.e2e.yaml`/`compose.dev.yaml`/`check.sh` read (Task 5).

**4. Review Focus.** Five uncovered-by-spec inputs listed above, each with its test in the owning task (Tasks 2, 6, 10 for long lines; Task 8 for the late clip after a cancel or dispose; Tasks 8–9 for a retry that fails again; Task 8 for the failed replay; Task 7 for the lost end event).
