# The dictation voice: Kokoro on the server

Date: 2026-09-27. Status: design approved in conversation, awaiting spec review.

## 1. Why

The dictation is read by the browser's Web Speech API. On the iPad and the laptop it is hard to
understand, and it has picked an English voice for French text. A reading the player cannot
follow makes the core game unplayable. The browser voice is removed entirely: there is no fallback.

A CPU bake-off (`tools/tts/`, samples in the gitignored `assets/tts-bakeoff/`) compared Piper,
Kokoro-82M, Chatterbox, XTTS-v2 and F5-TTS. The user chose Kokoro-82M: the best quality for its
cost. It makes speech about 5 times faster than real time on a Ryzen 9 5950X, and the server has a
Ryzen 7 9700.

## 2. Decisions (from the user)

- **Voice:** Kokoro-82M, voice `ff_siwis` alone. It is the only French Kokoro voice; no community
  French voice exists. Blends and other voices added an accent.
- **Pace:** the voice's rate is Kokoro's own `speed`, not a time stretch. Since the pace redesign
  (2026-09-27, §5.2's last note) every line of every pace is at one rate, `DICTATION_RATE` = 0.85
  (it was the `PACE_RATES` values, 0.75 to 1.0, and pace 4's final 0.95).
- **Punctuation ending (bake-off variant C):** a sentence-ending mark is kept as the real mark and
  followed by its capitalised name: « …froissées. Point. », « …berger ? Point d'interrogation. »,
  « …belle ! Point d'exclamation. », « …vu… Points de suspension. ». The comma and every other
  mark keep today's form: « , virgule, », « ; point-virgule, », « : deux-points, », guillemets,
  tiret. The paragraph prefix « À la ligne. » follows the same rule; its next word is capitalised
  when that word is a punctuation name. Amended 2026-09-27 (pace-bug report, open item 2): a
  breath group that stops on a word inside its sentence (a long piece halved) ends with a bare
  comma, not « . », so the voice keeps the phrase open; halving never cuts right after a
  determiner, a preposition, a pronoun, an auxiliary or a conjunction. « À la ligne. » opens only a
  paragraph's first group.
- **No fallback:** if the server cannot produce a line, the dictation stops on an in-universe
  message that sends the player to a parent (§5.3).
- **Its own container:** the speech engine runs in a second compose service.
- **Licences are not a constraint** (personal, unpublished game). They are still credited in
  `ASSETS-LICENSES.md`.

## 3. Scope

The two places that speak today: the dictation (`Play.svelte` / `battle/DictationPhase.svelte`,
through `lib/dictation/runner.ts`) and the lyre's test line (`places/cabin/LyrePanel.svelte`).
Camp and battle dialogue stays text on screen: one voice for Éris, the dragon and the Pythia would
not fit.

## 4. Server

### 4.1 The `tts` service

- A new directory `tts/`, with its own Dockerfile and a small FastAPI app. The image is
  `discorde-tts:<tag>`, and a compose service `tts` joins the app's network. It has no published
  port.
- **Engine:** Kokoro-82M ONNX (`kokoro-onnx` + onnxruntime), with no PyTorch, and the model and
  voice baked into the image. The plan's first task proves that its phonemes and audio match the
  PyTorch `kokoro` package the user listened to on the bake-off lines. If they don't, the service
  uses the PyTorch build (CPU wheels) instead.
  *Amended (Kokoro plan, Task 1's verdict and the Task 3 addendum):* the engine is onnxruntime
  directly on the same ONNX model (verdict `onnx-direct`, `tools/tts/parity.json`): misaki's French
  espeak G2P and the PyTorch package's chunking and style row, with neither `kokoro-onnx` nor
  PyTorch; `kokoro-onnx` failed the proof by picking the voice's style one row off. `/health` names
  it `kokoro-82m-v1.0-onnx-direct`. A sentence too long for the model (over 510 phonemes) is split,
  never truncated.
- **Threads:** the service uses at most `TTS_THREADS` threads (default 4), so the game server stays
  responsive while a dictation is being prepared.
- **Output:** MP3, 24 kHz mono, with no leading or trailing silence beyond what Kokoro produces.
  *Amended (Kokoro plan, Task 3):* a line with nothing to pronounce (« - » or « / » alone gives no
  phonemes) is the muted line's silence instead (65 ms a character ÷ speed, at least 300 ms), since
  an empty MP3 would not play.
- **Cache:** the service keeps `/cache` in its own volume, `discorde-tts-cache`. Each file is named
  `sha256(model, voice, speed, respelled text, format version).mp3`. The cache is limited to
  `TTS_CACHE_MB` (default 2048) and evicts the least recently used files. It needs no backup: every
  file can be regenerated.
- **Queue:** one worker thread makes lines one at a time. A request for a line waiting in the queue
  moves it to the front. Two requests for the same line share one job.
  *Amended (fix wave A, I2):* a new `/prepare` replaces every queued line nobody waits on (the latest
  dictation wins); a line `/speak` asked for, and the one being made, stay.
- **Pronunciation fixes:** `tts/respell.json` maps words to respellings and is applied
  word-boundary-safe before synthesis. It ships empty. A change to it changes the cache key.
- **Endpoints**, internal only:
  - `POST /speak` with `{text, speed}` returns the MP3. It is made now if not cached, ahead of the
    queue.
  - `POST /prepare` with `{lines: [{text, speed}]}` returns 202 and queues the lines in order.
  - `GET /health` returns ready once the model is loaded.
- **Limits:** each line is at most 1 000 characters, and `speed` must lie within 0.5–1.5. Anything
  else is a 422.
  *Amended (Kokoro plan, Ruling K1):* a line is at most 10 000 characters, so pace 4's full reading
  of the longest seed text (about 1 600 characters spoken) is one line.
  *Amended again (fix wave A, Ruling R-A1):* pace 4 now says its full readings a sentence at a time,
  so the longest line is one sentence; the 10 000-character limit stays as a guard.
- **Test mode** (`TTS_STUB=1`, e2e only): returns a valid silent MP3 as long as the line would take
  (65 ms a character ÷ speed, the current `SPEECH_MS_PER_CHAR`), instantly, without loading the
  model. It keeps the same cache and queue code paths.

### 4.2 The game server

- `/api/tts/speak` and `/api/tts/prepare` proxy to `http://tts:8000`, whose URL comes from
  `DISCORDE_TTS_URL`. They require a profile, like the other play endpoints. They pass the status
  and body through and return **503** when the service is unreachable or unhealthy.
- `GET /api/health` stays about the game only. A new `GET /api/tts/health` reports whether the
  voice is ready, for the README's troubleshooting steps.
- Nothing is recorded ahead of time when a text is saved. The browser code stays the one source of
  the chunking and the spoken form.

## 5. Game

### 5.1 Playback

- A new `lib/dictation/voice.ts` replaces `tts.ts` with the same shape:
  - `speak(spoken, rate)` resolves when the line has finished playing. It fetches
    `/api/tts/speak` and plays the MP3 through the existing Howler engine on the **voice
    channel**. The channel's gain and mute now really apply, the music ducks as it does today,
    and effects still wait.
  - `cancelSpeech()` stops the line.
  - `prepare(lines)` sends the whole script to be recorded.
- **Muted voice:** a muted voice channel does not fetch or play; the line waits its length
  (`speechMs`), as today.
- **Removed:**
  - `tts.ts`: speechSynthesis, the voice picker helpers, the unlock, the settle tick and the
    watchdog;
  - the voice picker in the lyre, and `profile.settings.voice` in the UI. The stored field stays
    readable and ignored, so no migration is needed.
- **Unlock:** the Howler unlock already on the title's « Entrer » tap and the first tap after a
  reload covers the voice.

### 5.2 Preparing a dictation

- When a dictation's script is built, the game calls `prepare` with its unique `say` lines, in
  script order.
- Before the first line plays, the dictation fetches it. If it isn't back within 400 ms, a short
  in-universe waiting line shows, e.g. « La voix de la Pythie s'éclaircit… » (final wording from
  the French copy pass), until it arrives. *Amended (fix wave B, ruling 1):* the line shows after
  1.2 s, stays at least 800 ms once shown, gives way to a second line after about 5 s, and the
  status seal waits (no reading pulse) meanwhile.
- During the dictation, each line's fetch starts when the previous line starts playing, so the
  gaps between lines stay as the pace defines them.
- *Amended (fix wave A, Ruling R-A1):* pace 4's two full readings are said a sentence at a time,
  back to back, each sentence its own line at the reading's rate, so the first is ready in about a
  second; only the reading's first sentence is a resume point, and the music stays ducked 300 ms
  after a line (Ruling R-A2), so it does not swell between the sentences.
- *Amended again (the pace redesign, 2026-09-27, `pace-redesign-brief.md`):* pace 4 is gone. Every
  pace reads each breath group twice and the whole text once at the end, a sentence at a time as
  above (only its first sentence a resume point), every line at 0.85, so `prepare` sends the groups
  then the final reading's sentences a group has not already said. §2's rates are now one rate.

### 5.3 When the voice fails

- **Retry:** a failed fetch (network error, 5xx, or a timeout of 20 s + 50 ms a character) is
  retried once, silently. *Amended (fix wave B, ruling 11):* the timeout is 8 s + 30 ms a character.
- **The card:** if the retry fails, the dictation pauses on an in-universe card. Éris gloats that
  she has silenced the voice, and the card tells the player to call a parent. It has a
  « Réessayer » button (retry the same line and carry on) and a way back to the camp. The draft
  typed so far stays in place: « Réessayer » resumes with it, and leaving follows the dictation's
  existing leave behaviour.
- **The parent's line:** a small line on the card names the cause for the parent: « voix :
  serveur injoignable » (network or 503) or « voix : erreur du serveur » (other 5xx).
- **The lyre's test line** uses the same card, in short form.
- All copy follows the house rules: no emoji, French spacing, the register guard, and Éris
  feminine.

## 6. Deployment and docs

- `compose.yaml` gains the `tts` service and its volume. The app gets `depends_on: tts` without a
  health condition, so the game starts even while the voice is loading.
- The README covers:
  - building and loading the second image;
  - the TrueNAS YAML with both services;
  - the memory figure for both containers, measured;
  - a troubleshooting section for the parent: the card's parent line, `/api/tts/health`, the
    container state and its logs.
- `ASSETS-LICENSES.md` credits Kokoro-82M (Apache-2.0) and the SIWIS voice data (CC BY 4.0).
- The parent spec (`2026-09-23-la-discorde-design.md` §3.3 and §4) is amended: the voice is
  Kokoro on the server, not Web Speech.

## 7. Testing

- **tts service (pytest in its image):**
  - cache key and eviction;
  - queue ordering, jumping the queue and deduplication;
  - respelling;
  - validation (length, speed);
  - stub durations;
  - a real-model smoke test that one line produces a non-silent MP3 of plausible length.
- **Game server (pytest):** the proxy's pass-through, the 503 when unreachable, the auth, and
  `/api/tts/health`.
- **vitest:**
  - the new punctuation endings (every sentence-ending mark, « À la ligne. », the comma and the
    other marks unchanged, abbreviations untouched);
  - the prepare list built from each pace's script;
  - `voice.ts` against a fake fetch and a fake audio backend: playback, cancel, mute, the timeout,
    the one retry, then failure;
  - the runner pausing on failure and resuming on « Réessayer ».
- **e2e:**
  - The stack runs `tts` with `TTS_STUB=1`.
  - Existing dictation specs keep passing; they currently rely on WebKit's speechSynthesis and move
    to the stub.
  - New specs cover the waiting line, the failure card (tts stopped, or a route that returns 503),
    « Réessayer » carrying on, and the lyre test line.
  - One e2e spec runs against the real model (the non-stub `tts` in a separate compose profile,
    run by `check.sh`) and checks that a dictation's first line plays.
    *Amended (Kokoro plan, Ruling K8):* the e2e stack's one `tts` service is the real voice when run
    with `TTS_STUB=0` (`playwright.voice.config.ts`, `voice-real.spec.ts`), not a compose profile.
- **Guards:** the new copy is covered by the existing guards (noEmoji, registerGuard, copyRules,
  frenchSpacing). A guard forbids `speechSynthesis` anywhere in `web/src`.
- **The gate:** `check.sh` builds both images and must end `== ALL GREEN`, with zero warnings.
