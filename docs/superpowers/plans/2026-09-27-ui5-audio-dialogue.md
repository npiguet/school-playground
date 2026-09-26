# La Discorde — UI5 "Audio and dialogue" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The camp gets its voice. Three audio channels (music, effects, the dictation's voice), each with its own volume and mute, set in the cabin's « La lyre » and from a quick sound plate on the HUD, saved per hero. Every place plays a quiet CC0 loop (the sea wind at the gates, the camp fire, the temple air, Éris's lair) and every battle a battle loop that ducks under the dictation's voice and while she proofreads. The short synthesised beeps become short CC0 recordings that never talk over the voice. Nothing sounds before the title's « Entrer » tap. Every character line comes from `content/dialogue/*.json`, keyed by event, with several variants and no immediate repeat: the dragon (stage-aware portrait), the Pythia, Athena's owl and Éris. Each place's first visit is a guided tour that replaces the Muses' welcome cards and the last instruction paragraphs. In battle, Éris taunts in-fiction from the content files, and after the battle the dragon walks her through up to two of the traps that still stand, with the existing explanation text. Dialogue is never spoken by TTS. A walk (tours, dialogue, the lyre, the sound plate) and the full gate close the milestone.

**Architecture:** Two new pure modules and two thin component layers.
- `web/src/lib/audio/`: the catalogue of sounds (`catalog.ts`), the per-hero channel settings and their persistence (`settings.ts`, `store.svelte.ts`), a backend-agnostic mixer (`engine.ts`: one loop at a time, crossfades, ducking reasons, effect rules, the unlock state machine), a Howler backend (`howlerBackend.ts`, the one `AudioContext`, seamless loop regions from `loop.ts`), a recording backend (`recordingBackend.ts`, used by vitest and by every e2e run through a test hook: e2e never plays real sound), the singleton and its page lifecycle (`audio.svelte.ts`), the battle listener on the UI4 hooks (`battleAudio.ts`) and the voice signal for TTS (`voice.ts`). `juice/sfx.ts` stays as the two-function façade the screens already call (`unlockAudio`, `playSfx`); `juice/soundStore.svelte.ts` is retired.
- `web/src/lib/dialogue/` + `web/src/lib/tours/`: the content loader and validator, the line selector (specific-beats-generic, no immediate repeat, placeholders, French spacing), the speaker frames, the battle's dialogue rules, the tours (steps per place, filtered by the dragon's stage) and their seen flags.
- Components: `SceneStage` asks the mixer for its place's loop; the HUD's lyre opens a `SoundPlate`; « La lyre » gets three `ChannelRow`s; `PlaceScene` runs a place's tour (`TourLayer`, rendered next to the stage like the old onboarding card) before its greeting; the screens' greetings, the muster's and the victory's lines read the content files.

**Tech Stack:** Svelte 5 (runes) + TypeScript + Vite 7, vitest 5 (node env), Playwright 1.63 (WebKit `desktop` 1280×720 and `ipad` 1180×820 touch; `chromium` for one library test), Docker Desktop + Git Bash wrapper scripts. New dependencies (spec §2.1 allows them): `howler` 2.2.4 and `@types/howler` 2.2.12 (dev dependencies, exact versions, as every dependency of `web/package.json`). ffmpeg only inside a throwaway tools container (`tools/audio/`), never on the host and never in the app image. One server line (a MIME type) and one Dockerfile line (the content files); no API change.

**Spec:** `docs/superpowers/specs/2026-09-24-scenes-ui-design.md` is binding: §7 (audio), §8 (dialogue), §2.5–2.6 (the dragon narrates, the Pythia, the owl and Éris speak in their places, dialogue is never TTS'd; three channels each with its own volume and mute), §1 guardrails (no shaming, no FOMO, Éris's taunts target the camp's heroes in-fiction), §4 (reduced motion, performance), §9.5 (UI5: "audio sourcing and channels, dialogue content, guided first visits, Éris taunts"), §10 (quality gates). The UI3a (A1–A18), immersion (W1–W14, W-a…W-f), UI3b (B1–B12, B-a…B-d) and UI4 (C1–C15, C2b–C2d, U4-a…U4-d) rulings hold; the E-series below extends them. Repo-root `CLAUDE.md` is binding for every agent: no "pre-existing" problems, zero svelte-check warnings, a flaky test is a defect, no emoji.

## Dependencies and batching

| Batch | Tasks | Where | Needs | Model | Notes |
|---|---|---|---|---|---|
| B1 | **1** audio foundation: `howler` dependency, the sound catalogue, the channel settings and their store (with the legacy `mute` migration), the battle start event's backdrop, the scenes' loops, the `.m4a` MIME type, the e2e test hooks (audio stub, tours option, audio helpers) → **2** dialogue foundation: every French line of the milestone in `content/dialogue/*.json`, the loader/validator, the selector, the speakers, the tours and their seen flags, `frenchSpacing`, the shared copy rules, the content guards, the Dockerfile line | main checkout (`scenes`) | — | opus, opus | Pure code, data and tests; no screen changes except import moves. Focused vitest + svelte-check + pytest per task; one full `PW_WORKERS=4 scripts/check.sh` at the end of Task 2. |
| B2 | lane **S**: **3** audio sourcing (**3a** candidates → **CHECKPOINT: controller review** → **3b** download, transcode, loudness, loops, credits, budget test) ‖ lane **A**: **4 → 5** (the mixer and the Howler backend; then the places' loops, the battle's ducking, the voice's volume, « La lyre », the HUD's sound plate) ‖ lane **D**: **6 → 7** (greetings from the content files and the six tours; then the battle's dialogue: muster, retry, victory, the dragon's explanations, the muted-voice note) | three worktrees from Task 2's head: `../sp-wt-sound` (branch `ui5-sound`, `STACK=sound`), `../sp-wt-audio` (branch `ui5-audio`, `STACK=audio`), `../sp-wt-dialogue` (branch `ui5-dialogue`, `STACK=dialogue`) | B1 | sonnet; opus → sonnet; opus → sonnet | Lane S runs no Playwright (only the ffmpeg container, which takes the machine-wide lock, and vitest); lanes A and D run e2e, queued by the lock (at most two e2e stacks exist at once, Ruling W-d). The lanes touch disjoint files except `scenes-camp.spec.ts` (A: the HUD sound test; D: the onboarding tests and the greeting assertion; distant hunks). Each e2e lane runs one full `STACK=<lane> PW_WORKERS=4 scripts/check.sh` at its end; lane S runs the focused vitest and `docker build`. The controller merges S, then A, then D into `scenes` and runs the full gate once. |
| B3 | **8** French spacing sweep (U+202F before « : ; ! ? » and inside « guillemets » in every string on screen; guard) — **CONTROLLER RULING REQUESTED (E15)** | main checkout | B2 merged | sonnet | Mechanical; touches copy in many files and the e2e/vitest expectations that pin it. Full gate at its end. |
| B4 | **9** the UI5 walk (tours, greetings, the lyre, the sound plate, the battle's dialogue), the audio files served e2e, the manual iPad checklist for the user, the full gate | main checkout | B3 | opus | The only task that writes `docs/reviews/ui5/`. |

Playwright runs are serialised machine-wide by the lock in `scripts/playwright.sh` (Ruling W-e): parallel lanes code and run vitest in parallel, and their e2e runs queue. A queued run is not a hang. `tools/audio/run_docker.sh` takes the same lock while ffmpeg runs (its CPU burst starves the e2e browsers, the reason behind Ruling F4).

## Global Constraints

- **Scope (spec §9.5):** "UI5 Audio + dialogue: audio sourcing and channels, dialogue content, guided first visits, Éris taunts." Out of scope: new art, new routes, new places, any change to grading, XP, quests, help stages, Argus, Fil, Bouclier, the dictation runner's pacing.
- **Mechanics unchanged (spec §1):** no API shape change, no grading/XP/quest/help-stage rule change. The dictation runner keeps its timing: a muted voice still takes the time of its speech (the utterance plays at volume 0). The server change is one `mimetypes.add_type` line and its test (Ruling E16); `settings` stays a free-form dict merged shallowly by the existing PATCH.
- **Feature parity:** the Parity map below is the review gate. A control may move (the mute into the sound plate, an instruction into a tour), never disappear; every tour can be replayed from the lyre, so nothing a tour says is lost.
- **Audio (spec §7):**
  - **Never before the unlock gesture.** The mixer plays nothing (no loop, no effect) until `unlock()`, which runs synchronously inside a tap: the title's « Entrer », or the first game tap that already calls `unlockAudio()` (`go()`, the HUD, the hotspots) after a reload or a deep link (Ruling E3). A loop asked for before that is remembered and starts at the unlock.
  - **Three channels, each with its volume (0–1, step 0.05) and mute**, saved per hero in `profile.settings.audio` (whole object per PATCH, saves serialised), mirrored on the device (`localStorage['discorde.audio']`) for the title before a hero is chosen. Music and effects mute independently of the voice; the voice's volume is `SpeechSynthesisUtterance.volume` where the browser honours it (the iPad may only honour the device buttons: the lyre says so).
  - **Music:** one loop at a time, crossfaded (1.2 s); ducked to 30 % while TTS speaks, during the whole dictation phase and during proofreading, fades 400 ms (Ruling E5). **Effects:** short, dropped while the voice speaks, the same effect never twice within 80 ms (Ruling E6).
  - **Reduced motion is unaffected:** no audio code reads `prefers-reduced-motion`; the tours' ring and the dialogue follow the existing reduced-motion rules (no pulse, full text at once).
  - **iPad Safari quirks:** exactly one `AudioContext` (Howler's; nothing in `src` constructs `AudioContext`/`webkitAudioContext`, guarded); Web Audio only (never `html5: true`: iOS ignores an HTML media element's volume, so ducking would silently fail; guarded); resume on `visibilitychange`/`pageshow` and on the next `pointerdown` when the context is `suspended` or `interrupted` (a call, Siri, the lock screen); suspend when the page hides; `navigator.audioSession` is never touched, so the Web Audio channels follow the ring/silent switch as iPad games do (Ruling E3; the voice is `speechSynthesis`, which our code does not route); at most two decoded loops in memory (the crossfade), loops 30–90 s.
  - **Sounds are never the only carrier of information:** every cue has a visual counterpart already on screen.
- **Dialogue (spec §8):** lines live in `content/dialogue/<area>.json` (French), keyed `<area>.<event>`; ≥ 3 variants per event (per condition), no immediate repeat of a key's line within a page load, a place greets once per page load (Ruling A9), a place's first visit is its tour, skippable, seen per hero (`settings.tours`). Speakers: `dragon` (its stage's tinted cut-out, « L'œuf » before it hatches), `pythia`, `owl`, `eris`. Never TTS'd (guarded). No dialogue box during the dictation and the proofreading (the text has the player's whole attention). Overlay voice plates (`lib/world/voices.ts`) and UI copy (`lib/battle/lines.ts`) stay in code (Ruling E11).
- **French copy:** every French string of this plan is used verbatim. In-world, warm, gender-neutral towards the player (never « héros » as a vocative addressed to her, no adjective or participle agreeing with her: « prête », « sûre », « arrêtée », « piégée », « seule », « contente », « fatiguée » go), no school register (« niveau », « HarmoS », « réviser », grade codes, « examen »), no admin or technical register, no guilt wording (`manqué|raté|perdu`), no FOMO (no deadline pressure, no streak, no « ne rate pas »), plurals through `plural()`, elision through `de()`, dates through `longDate()`. Éris's lines target her own tricks and the camp's heroes in-fiction, never the player's ability (`FORBIDDEN` in `eris.ts`, checked over every Éris line and tour step). Typography: content lines are authored with plain spaces; the loader applies `frenchSpacing()` (U+202F before « : ; ! ? » and inside « guillemets »); raw content with U+202F or U+00A0 fails its test (reviewable text, no invisible characters). Code, comments, docs and commit messages are in English.
- **Ethics and colour:** no red (e2e `redScan`); orange is Éris's; the tour's dimming is night (`--night`), its ring gold (`--gold-light`). Nothing is lost; no guilt wording; Éris never mocks the player.
- **No emoji (CLAUDE.md):** the HUD's sound plate uses inline SVG icons (`Icon.svelte`), never an emoji or a music-note glyph; content files are covered by `noEmoji.test.ts` (it already walks `content/**/*.json`).
- **Accessibility:** touch targets ≥ 48 px (the sound plate, the channel rows, the tour's buttons); sliders are real `<input type="range">` with a French `aria-label`; mute toggles and the sound plate's toggles are real `<button aria-pressed>`; the sound plate's opener has `aria-expanded`/`aria-controls` and closes on Escape and on a tap outside, returning focus to the opener; a tour is a modal (`use:modal`: the stage is inert, Tab stays in the tour, focus returns where it was); the dialogue box's live region announces each line (M6 of UI3a, unchanged).
- **Routes:** no route is added or removed. The sound plate is a transient HUD control (no route); a tour has no route (a reload during an unseen tour restarts it from its first step).
- **Guards that must stay green (vitest):** every UI4 guard (`noEmoji`, `placesKit`, `registerGuard`, `formPlural`, `noGuilt`, `headings`, `voices`, `kit*`, `lib/battle/*`, `budget`, `e2eCrashGuard`, `artReferenced`, `app.css`), plus the new `lib/audio/*.test.ts` (engine, settings, store, catalogue, loop, Howler backend, assets budget), `audioGuards.test.ts` (one `AudioContext`, no `html5: true`, no audio code reads reduced motion), `lib/dialogue/content.test.ts` (keys, variants, placeholders, speakers, tour targets, register, guilt, gender, `FORBIDDEN`, typography, length, never TTS'd), `lib/tours/*.test.ts`, `frenchSpacing.test.ts` (Task 8).
- **Toolchain:** no Node and no host Python or ffmpeg. From the repo root, in Git Bash:
  - `scripts/npm.sh run test -- <files>` (vitest, focused); `scripts/npm.sh install <pkg>@<ver> --save-dev --save-exact` (Task 1 only);
  - `scripts/npm.sh run check` (svelte-check + e2e tsc: `0 errors and 0 warnings`);
  - `scripts/pytest.sh -q <files>` (server tests);
  - `STACK=<lane> scripts/playwright.sh <spec-filter> [--project=<name>] [--repeat-each=3]`;
  - `STACK=<lane> PW_WORKERS=4 scripts/check.sh` (the full gate);
  - `tools/audio/run_docker.sh <measure|build|credits> [args]` (Task 3 only);
  - `scripts/playwright.sh --config playwright.playability.config.ts playability-ui5` (the walk; writes to `web/test-results/walk-ui5` unless `WALK_OUT=docs/reviews/ui5`).
  In the main checkout `STACK` is unset. In a worktree always set the lane's `STACK`. Never run Forge and e2e at the same time (Ruling F4). Do not run Docker or Playwright outside these wrappers.
- **Testing rules:** per task, run the focused vitest files and `svelte-check`; run every **new or changed** e2e spec with `--repeat-each=3`; run every **touched but unchanged-in-intent** spec once. One full `scripts/check.sh` per lane or batch. The crash-only retry (`scripts/playwright-crash-retry.mjs`) retries a named "browser crashed" failure once; any other failure is a real failure. A flake is a defect: root-cause it, never retry it away.
- **e2e robustness (8 workers by default):** every page runs with the recording audio backend (`window.__discordeAudioStub`, set by `crashGuard.ts`'s `page` fixture): **no e2e ever plays or decodes real sound**; audio is asserted through `audioState(page)` (the engine's snapshot) with `expect.poll`. Tours are off (`window.__discordeTours = 'off'`) unless a spec says `test.use({ tours: true })`. Each test creates its own hero (`createProfileApi`, or `createFreshHeroApi` for an unseen camp tour) and its own text; dialogue lines are asserted by key (`data-key` on the dialogue box, the voice plate) and by membership in the key's variants (`expectLineOf`), never by one variant's exact text (the pick is random); no `waitForTimeout`; a finger on `ipad`, a mouse on `desktop` (`tap`). A settings save that a reload depends on is awaited with `page.waitForResponse` on the PATCH.
- **Commits:** on the lane's branch (`scenes` in the main checkout). **Always** `git add <paths> && git commit -m "..." -- <paths>`; a `git mv` / `git rm` names both paths. Never `git add -A`, `git stash`, `git reset`, `git checkout`, `git restore` of tracked work, `git clean`, or any history rewrite. End every message with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>` (or your harness's trailer). The walk's screenshots go to the scratch dir; `docs/reviews/ui5/*` is written only in Task 9's baseline step. `assets/audio/staging/` is never committed (gitignored, Task 3).
- **Verification:** run each task's commands and paste the real output (counts included) into the report. A failing, flaky or warning test anywhere is yours to fix or to report as an open item, never "pre-existing" (CLAUDE.md).

## Rulings taken by this plan (the spec is silent; do not re-ask unless marked)

- **E1 One engine, the façade kept.** The synthesised WebAudio tones of `juice/sfx.ts` (and their own `AudioContext`) retire; the same seven effect names (`tap`, `seal`, `unroll`, `chime`, `growth`, `hmpf`, `laurel`) become CC0 recordings, plus `strike` (a reckoning blow) and `fanfare` (a rout). `unlockAudio()` and `playSfx(name)` keep their signatures, so the screens' ~20 call sites do not change. `soundStore` becomes a thin façade over the new store in Task 1 and is deleted in Task 5 (spec §7: replaced, not duplicated).
- **E2 Settings and migration.** `settings.audio = { music, sfx, voice }`, each `{ volume, muted }`; defaults music 0.5, effects 0.7, voice 1.0, nothing muted. A hero saved before UI5 has only `mute`: `mute: true` seeds music and effects muted (it never silenced the dictation, « La dictée est toujours lue »). `mute` is no longer written. Toggles save at once; a slider saves 400 ms after the last move and at once on release; saves are chained so the server sees them in order. Before a hero is chosen (the title), the device mirror applies.
- **E3 Unlock and the silent switch.** See the Global Constraints. Howler's `autoUnlock` stays on (it only unlocks the context on a touch; our engine decides what plays). `navigator.audioSession` is not set: iPad Web Audio then follows the ring/silent switch like other games. Whether the dictation's voice (speechSynthesis) plays with the switch on is the platform's behaviour, unchanged by UI5; the real-device check is on the user's list (Task 9).
- **E4 Which loop where.** Title: `sea` (the gates at dusk). Camp, nest, cabin: `camp` (the fire). Library tent, Delphi: `temple`. War tent: `lair` (Éris's file on the table). Every battle: `battle`; the boss in her lair: `lair`. `SCENE_MUSIC` and `battleTrack()` (catalogue) are the one source; `SceneDef.ambience.music` and `BattleDef.ambience.music` read them.
- **E5 Ducking.** Reasons `voice` (any `speak()`: the dictation, « Écouter un essai »), `dictation` (the whole phase: the voice speaks every few seconds, a pumping loop would distract more than a steady low one) and `proofreading`; any reason ducks to 30 %. A place (`SceneStage`) clears every reason when it takes over, so a Back out of a battle never leaves the camp ducked.
- **E6 Effects.** Dropped (not queued) before the unlock, when the channel is muted, while the voice speaks; the same effect at most once per 80 ms. The reckoning's blows play `strike`, a rout plays `fanfare`; the spoils keep their existing cues.
- **E7 The voice channel — CONTROLLER CONFIRMATION REQUESTED.** The spec gives the voice a mute. Muted, the utterances play at volume 0, so the dictation keeps its pace but is silent (useful when someone reads it aloud to her). Two warnings keep it from being a trap: the lyre under the voice's row (« En sourdine, la dictée n'est plus lue à voix haute : il faudra quelqu'un pour te la lire. ») and the muster's parchment (« La voix de la dictée est en sourdine. » with « Rendre la voix », which unmutes). The sound plate includes the voice toggle (the HUD is not shown during the dictation, Ruling C5, so it cannot be flipped mid-dictation). Alternative: no voice mute at all (a volume floor of 0.2 instead), one row less.
- **E8 The HUD's quick toggles — CONTROLLER CONFIRMATION REQUESTED.** The HUD keeps one round lyre button (`hud-mute`, now an opener with `aria-expanded`), which drops a small bronze **sound plate** (`hud-sound`) with three toggles (« Musique », « Bruitages », « Voix », `aria-pressed` = playing) and « La lyre » (to the full settings). One button keeps the battle's compact band as it is (four controls, UI4 I4); three round buttons would not fit it at 1180 px. The lyre icon shows struck through when music and effects are both muted. Alternative: two round buttons (music, effects) in the full HUD, the plate only in the band.
- **E9 Seamless loops.** Encoded with a crossfaded seam (tail into head, Task 3); at runtime the loop region skips the AAC encoder's priming when the browser kept it (`loopRegion`, from `meta.gen.json`), through a Howler sprite with `loop: true` (sample-accurate `loopStart`/`loopEnd`).
- **E10 Test hooks in the shipped app — CONTROLLER CONFIRMATION REQUESTED.** Two page globals, set only by `crashGuard.ts`'s init script: `__discordeAudioStub` (the engine uses the recording backend and publishes `window.__discordeAudio.snapshot()`) and `__discordeTours = 'off'` (no tours). They are read once (engine creation, each tour check), like `stubSpeech` replaces `speechSynthesis`. Without them the ~40 specs that create heroes through the UI would each meet up to six tours. Cost if wrong: a player who sets them in the console gets a silent game or no tours.
- **E11 What lives in the content files.** Event dialogue (the dialogue box: greetings, owl hints, tours, Éris's battle lines, the dragon's explanation intros). Lines built from live numbers stay in code (`stageLine`, `dragonTally`, `bossLockLine`, the boss's challenge and exit lines, the introduced-traps aside) and so do the overlay voice plates (`voices.ts`) and UI copy (`lines.ts`). Format: `{ "lines": { "<area>.<event>": [ { "speaker", "text", "when"? } ] }, "tour"?: [ { "speaker", "text", "target", "when"? } ] }`. A line whose `when` matches the context beats the generic ones; placeholders `{hero}`, `{when}`, `{word}` only where declared.
- **E12 Greetings.** Once per place per page load (A9), now a variant. Camp: `camp.enter` (with her name), the dragon's `stageLine`, `camp.weekly` when the week's goal is reached (praise, never pressure), then `camp.next.<step>` (the same next step as the hub's glow, Ruling B9). Delphi: `delphi.enter.sealed|chosen`. Library: `library.enter`; the owl's hints `library.owl`. Nest: `nest.enter` by stage, `nest.name` for an unnamed hatchling. Cabin: `cabin.enter`. War tent (new): Éris's `war.enter`. The title has no dialogue (no hero yet).
- **E13 Tours — CONTROLLER CONFIRMATION REQUESTED.** Six tours (camp, library, Delphi, war tent, nest, cabin). A tour is a modal over its place (rendered next to the stage, like the old onboarding card): the stage is inert, the rest of the scene dims under a gold ring around each step's hotspot, the place's character speaks each step in the dialogue box, « Passer la visite » ends it. Finished or skipped, it is seen (`settings.tours`, and `onboarded: true` for the camp). **The camp tour replaces the Muses' welcome cards** (`Onboarding.svelte` is deleted; its three facts become the egg's first lines), and the deep-linked hero panel still waits for it (fix wave 3's rule). A hero onboarded before UI5 counts as having seen the camp tour; the other five tours show on her next visit to each place. Two instruction paragraphs move into tours: the portal's page note and the empty shelf's « Chaque récompense est annoncée à l'avance : rien n'est tiré au sort. ». « Refaire les visites du camp » in the lyre clears the flags. A tour waits for the camp data (the dragon's stage picks its lines) and takes the greeting's turn.
- **E14 Battle dialogue.** Muster: Éris's voice plate says `battle.start` (Éris as the opponent, by mode) or her dossier line (a lieutenant, unchanged), or `battle.retry` after « Rejouer ce texte ». Victory: Éris first, keyed by the reckoning (`battle.perfect` no trap in the draft; `battle.victory` ≥ 80 % caught; `battle.retreat` ≥ 50 %; `battle.caught` > 0; `battle.missed` none), grimoire variants by mode, her introduced-traps aside kept; then the dragon's tally (unchanged), then up to two traps that still stand (one per category, text order): `battle.explain` naming the word, then `explain()`'s text; then the help-stage message and the « Revoir » hint (unchanged). "Error caught" and "error missed" are said at the reckoning, never live (Ruling C3). The picks are made once when the dialogue starts, never in a `$derived`.
- **E15 French spacing everywhere — CONTROLLER RULING REQUESTED.** The codebase is inconsistent: most strings use a plain space before « ! ? : » (e.g. `lines.ts`: « Victoire ! »), a few use U+202F (`ProphecyCard`, `shelf.ts`, every « % »). The content files get U+202F through `frenchSpacing()` (Task 2). Task 8 makes the rest match (a guard over every string on screen, the fixes, the pinned expectations). CLAUDE.md says an inconsistency found is ours to fix; the cost is one mechanical task touching many copy strings and e2e pins. Alternative: keep plain spaces everywhere and drop `frenchSpacing` (then the content test forbids U+202F instead).
- **E16 Server and image.** `mimetypes.add_type("audio/mp4", ".m4a")` next to the WebP and WOFF2 lines (the slim image's MIME database lacks it; iPad Safari refuses `application/octet-stream` audio in some paths), with a pytest. The Dockerfile's web stage copies `content/dialogue/` (it copies only `content/*.json` today, so the build would miss the dialogue imports).
- **E17 Sourcing.** CC0 only (Kenney packs, OpenGameArt entries marked CC0, freesound sounds marked « Creative Commons 0 »); the licence is read on the source page at download time and quoted in `tools/audio/sources.json`. Freesound originals need a logged-in account: the lane uses freesound's public HQ previews (same licence) unless the controller asks the user for an original. The candidate list is a controller checkpoint (Task 3a); **a human listening pass is the user's decision** (the controller asks; the default is to ship after the controller's review and the user's listening on a real iPad in Task 9's checklist). Sizes: music ≤ 8 MiB total, each loop ≤ 2 MiB and 30–90 s; each effect ≤ 64 KiB, effects ≤ 512 KiB total; AAC-LC 96 kbps in `.m4a`, 44.1 kHz, loops stereo, effects mono; loudness −18 LUFS integrated for loops, −16 LUFS for effects (short effects: measured over a 3 s repetition), true peak ≤ −1.5 dBTP.

## Parity map (review gate: every current feature → its new home)

| Current | Features, states (test ids) | New home | Task |
|---|---|---|---|
| `Onboarding.svelte` (camp, new hero) | the Muses' three cards (who she is, Éris's dés-accords, the egg), « Suivant » (`onboarding-next`), skip (`onboarding-skip`), a real modal (inert camp, Tab trapped, focus back), precedence over a deep-linked hero panel, `settings.onboarded` | The camp tour: its first four lines carry the three facts (the egg speaks them), `dialogue-advance`, « Passer la visite » (`dialogue-skip`), `use:modal`, the hero panel waits for it, `onboarded: true` written with `tours` | 6 |
| HUD « Son » (`hud-mute`, one mute) | toggles music+effects, lyre / lyre-muted icon, survives leaving the camp | `hud-mute` opens the sound plate (`hud-sound`, `hud-sound-music|sfx|voice`, `hud-sound-lyre`); icon struck through when music and effects are muted | 5 |
| Lyre « Les sons du camp » | « Joués » / « Coupés » radios (`lyre-sounds`), « La dictée est toujours lue. » | Three channel rows (`lyre-channel-*`, `lyre-volume-*`, `lyre-mute-*`), the voice's notes (E7), « Refaire les visites du camp » (`lyre-tours`), a credits line for the sounds | 5 |
| `juice/sfx.ts` | seven synthesised effects, `unlockAudio`, `playSfx` | CC0 recordings with the same names + `strike`, `fanfare`; same two functions | 3, 4 |
| Static greetings (`campGreeting`, `owlGreeting`, `pythiaGreeting`, `nestGreeting`, `cabinGreeting`) | once per page load | The same, from the content files (each old line is a variant of its key) | 6 |
| `owlHint` | four hints, never twice in a row | `library.owl` through the selector | 6 |
| `nextStepLine` | the greeting's last line per next step | `camp.next.<step>` (old lines are variants) | 6 |
| `erisLine` (`explain.ts`) | Éris's victory line, five tiers × dictation/grimoire, the introduced-traps aside | `battle.perfect|victory|retreat|caught|missed` (old lines are variants), the aside in `lines.ts` | 7 |
| `ERIS_MUSTER`, `musterTaunt` | Éris's muster line (free text, grimoire), the lieutenants' dossier lines | `battle.start` by mode, `battle.retry`; dossier lines unchanged | 7 |
| `PortalPanel` page note, `TrophiesPanel` empty note's second sentence | instruction text | Library tour step 4, cabin tour step 1 (replayable from the lyre) | 6 |

## File map

| File | Responsibility | Task |
|---|---|---|
| `web/package.json`, `web/package-lock.json` | `howler`, `@types/howler` | 1 |
| `web/src/lib/audio/{catalog,settings}.ts`, `store.svelte.ts`, `meta.gen.json` (+ `catalog.test.ts`, `settings.test.ts`, `store.svelte.test.ts`) | what sounds exist, the channels, their persistence | 1 |
| `web/src/lib/juice/soundStore.svelte.ts` (façade), `web/src/lib/juice/sfx.ts` (+ test), `web/src/components/scene/PlaceScene.svelte`, `web/src/screens/{Boss,Play}.svelte` (imports only) | the store's migration | 1 |
| `web/src/lib/types.ts` | `ProfileSettings.audio`, `.tours` | 1 |
| `web/src/lib/battle/{battle,events}.ts` (+ tests), `web/src/components/battle/BattleStage.svelte` (one emit) | the start event's backdrop, the battle's loop | 1 |
| `web/src/lib/world/scenes/*.ts` (+ tests), `web/src/lib/scene/types.ts` | the places' loops (`TrackId`) | 1 |
| `server/app/main.py`, `server/tests/test_static_types.py`, `server/tests/test_ui5_settings.py` | `.m4a` MIME type; settings round trip | 1 |
| `web/e2e/crashGuard.ts`, `web/e2e/helpers.ts` | audio stub, tours option, `audioState`, `expectMusic`, `stubSpeech` volumes, `expectLineOf`, `nextLine`, `createFreshHeroApi` | 1 |
| `content/dialogue/{camp,library,delphi,war,nest,cabin,battle}.json` | every line of the milestone | 2 |
| `web/src/lib/dialogue/{types,content,select,speakers,battle}.ts` (+ tests), `web/src/lib/tours/{tours.ts,seen.svelte.ts}` (+ tests) | loader, selector, frames, battle keys, tours, seen flags | 2 |
| `web/src/lib/text/french.ts` (+ test), `web/src/testing/copyRules.ts`, `web/src/{registerGuard,noGuilt}.test.ts`, `web/src/lib/battle/lines.test.ts`, `web/src/lib/world/voices.ts` | `frenchSpacing`, shared copy rules, exported speaker helpers | 2 |
| `web/src/lib/scene/{types.ts,overlayState.svelte.ts}`, `web/src/components/scene/SceneStage.svelte` (one class condition) | `DialogueLine.key`, `narrator.tour`, the tour flag | 2 |
| `Dockerfile` | copy `content/dialogue` | 2 |
| `tools/audio/{Dockerfile,run_docker.sh,process.py,sources.json}`, `docs/audio/candidates.md`, `web/public/audio/{music,sfx}/*.m4a`, `web/src/lib/audio/meta.gen.json`, `web/src/lib/audio/assets.test.ts`, `ASSETS-LICENSES.md`, `.gitignore` | sourcing | 3 |
| `web/src/lib/audio/{engine,loop,howlerBackend,recordingBackend}.ts`, `audio.svelte.ts` (+ tests), `web/src/audioGuards.test.ts`, `web/src/lib/juice/sfx.ts` (+ test), `web/src/main.ts` | the mixer | 4 |
| `web/src/lib/audio/{battleAudio,voice}.ts` (+ tests), `web/src/lib/dictation/tts.ts` (+ test), `web/src/components/scene/{SceneStage,Hud,SoundPlate}.svelte`, `web/src/components/ui/Icon.svelte`, `web/src/components/places/cabin/{LyrePanel,ChannelRow}.svelte`, `web/src/screens/Title.svelte`, `web/src/lib/juice/soundStore.svelte.ts` (deleted), `web/e2e/scenes-audio.spec.ts`, `web/e2e/{scenes-camp,scenes-cabin}.spec.ts` | wiring | 5 |
| `web/src/components/scene/{DialogueBox,PlaceScene,TourLayer,OverlayVoice}.svelte`, `web/src/components/Onboarding.svelte` (deleted), `web/src/screens/{Camp,LibraryTent,Delphi,WarTent,Nest,CabinRoom}.svelte`, `web/src/lib/world/scenes/{camp,library,delphi,nest,cabin}.ts` (+ tests), `web/src/lib/world/nextStep.ts` (+ test), `web/src/components/places/{library/PortalPanel,cabin/TrophiesPanel}.svelte`, `web/src/styles/kit.css` (onboarding rules), `web/e2e/{scenes-tours,scenes-dialogue}.spec.ts`, `web/e2e/{scenes-camp,scenes-cabin,scenes-delphi,world}.spec.ts`, `web/e2e/helpers.ts` (`skipOnboarding`) | greetings, tours | 6 |
| `web/src/lib/battle/lines.ts` (+ test), `web/src/lib/explain.ts` (+ test), `web/src/screens/Play.svelte`, `web/src/components/battle/{MusterPhase,VictoryPhase}.svelte`, `web/e2e/{scenes-battle-play,scenes-battle-victory}.spec.ts` | battle dialogue | 7 |
| `web/src/frenchSpacing.test.ts` + the strings it finds | typography | 8 |
| `web/e2e/playability-ui5.spec.ts`, `web/e2e/scenes-audio.spec.ts` (files served), `docs/reviews/ui5/*` | walk, gate | 9 |

---

### Task 1: Audio foundation — the dependency, the catalogue, the channels and their store, the loops' map, the MIME type, the e2e hooks

**Files:**
- Modify: `web/package.json`, `web/package-lock.json` (through `scripts/npm.sh install howler@2.2.4 @types/howler@2.2.12 --save-dev --save-exact`)
- Create: `web/src/lib/audio/catalog.ts`, `catalog.test.ts`, `settings.ts`, `settings.test.ts`, `store.svelte.ts`, `store.svelte.test.ts`, `meta.gen.json` (`{}`)
- Modify: `web/src/lib/types.ts`, `web/src/lib/juice/soundStore.svelte.ts` (façade), `web/src/lib/juice/sfx.ts`, `web/src/lib/juice/sfx.test.ts`, `web/src/components/scene/PlaceScene.svelte`, `web/src/screens/Boss.svelte`, `web/src/screens/Play.svelte` (the `initSound` import → `initAudioSettings`, nothing else)
- Modify: `web/src/lib/battle/battle.ts`, `battle.test.ts`, `events.ts`, `events.test.ts`, `web/src/components/battle/BattleStage.svelte` (the `start` emit)
- Modify: `web/src/lib/scene/types.ts` (`ambience.music: TrackId | null`), `web/src/lib/world/scenes/{title,camp,library,delphi,war,nest,cabin}.ts` (+ their tests where they pin `music: null`)
- Modify: `server/app/main.py`; Create: `server/tests/test_static_types.py`, `server/tests/test_ui5_settings.py`
- Modify: `web/e2e/crashGuard.ts`, `web/e2e/helpers.ts`

**Interfaces:**
- Consumes: `SceneId` (`lib/scene/types`), `BackdropId`, `battleFor` (`lib/battle/battle`), `api.profiles.patch`, `profileStore`, `Profile`, `ProfileSettings`.
- Produces:
  - `catalog.ts`: `type TrackId = 'sea' | 'camp' | 'temple' | 'lair' | 'battle'`, `type SfxId = 'tap' | 'seal' | 'unroll' | 'chime' | 'growth' | 'hmpf' | 'laurel' | 'strike' | 'fanfare'`, `interface SoundDef { src; mix }`, `TRACKS`, `SFX`, `TRACK_IDS`, `SFX_IDS`, `SCENE_MUSIC`, `battleTrack(backdrop)`, the budgets `MUSIC_BUDGET_BYTES`, `TRACK_MAX_BYTES`, `SFX_MAX_BYTES`, `SFX_BUDGET_BYTES`, `LOOP_MIN_S`, `LOOP_MAX_S`.
  - `settings.ts`: `type ChannelId`, `interface ChannelSetting`, `type AudioSettings`, `CHANNELS`, `DEFAULT_AUDIO`, `clampVolume`, `audioFrom(settings, device)`, `gainOf(channel)`.
  - `store.svelte.ts`: `audioSettings` (`$state<AudioSettings>`), `initAudioSettings(profile)`, `snapshotAudio()`, `setChannels(profileId, patch, opts?)`, `setChannel(profileId, ch, patch, opts?)`, `bothMuted()`, `flushAudioSave()` (tests), `resetAudioStoreForTests()`.
  - `ProfileSettings.audio?: AudioSettings`, `ProfileSettings.tours?: string[]`.
  - `BattleEvent` `start` gains `backdrop: BackdropId`; `BattleDef.ambience.music: TrackId`.
  - `SceneDef.ambience.music: TrackId | null` from `SCENE_MUSIC`.
  - e2e: the `tours` fixture option; `AudioSnap`, `audioState(page)`, `expectMusic(page, track, opts?)`, `spokenVolumes(page)`, `expectLineOf(locator, key, vars?)`, `nextLine(page)`, `createFreshHeroApi(request, name, level?)`.

- [ ] **Step 1: Add the dependency**

Run: `scripts/npm.sh install howler@2.2.4 @types/howler@2.2.12 --save-dev --save-exact`
Expected: `web/package.json` gains the two exact devDependencies; `web/package-lock.json` changes; nothing else. (`ensure_volumes` reinstalls every stack's `node_modules` on the next run because the lockfile hash changed, B5 of the immersion wave.)

- [ ] **Step 2: Write the failing unit tests**

`web/src/lib/audio/catalog.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SCENES } from '../world/scenes';
import { SCENE_MUSIC, SFX, SFX_IDS, TRACKS, TRACK_IDS, battleTrack } from './catalog';

describe('the sounds of the camp (spec §7, Ruling E4)', () => {
  it('gives every place its loop and every scene definition reads it', () => {
    expect(SCENE_MUSIC).toEqual({ title: 'sea', camp: 'camp', nest: 'camp', cabin: 'camp', library: 'temple', delphi: 'temple', war: 'lair' });
    for (const s of SCENES) expect(s.ambience.music, s.id).toBe(SCENE_MUSIC[s.id]);
  });

  it('plays the battle loop on every ground but her lair', () => {
    expect(['river', 'coast', 'temple'].map((b) => battleTrack(b as 'river'))).toEqual(['battle', 'battle', 'battle']);
    expect(battleTrack('lair')).toBe('lair');
  });

  it('keeps every sound as an .m4a under /audio, mixed between 0 and 1', () => {
    expect([...TRACK_IDS].sort()).toEqual(['battle', 'camp', 'lair', 'sea', 'temple']);
    expect([...SFX_IDS].sort()).toEqual(['chime', 'fanfare', 'growth', 'hmpf', 'laurel', 'seal', 'strike', 'tap', 'unroll']);
    for (const [id, d] of Object.entries(TRACKS)) expect(d.src).toBe(`/audio/music/${id}.m4a`);
    for (const [id, d] of Object.entries(SFX)) expect(d.src).toBe(`/audio/sfx/${id}.m4a`);
    for (const d of [...Object.values(TRACKS), ...Object.values(SFX)]) {
      expect(d.mix).toBeGreaterThan(0);
      expect(d.mix).toBeLessThanOrEqual(1);
    }
  });
});
```

`web/src/lib/audio/settings.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_AUDIO, audioFrom, clampVolume, gainOf } from './settings';

describe('the three channels (spec §7, Ruling E2)', () => {
  it('starts from the defaults: music 0.5, effects 0.7, voice 1, nothing muted', () => {
    expect(audioFrom({}, null)).toEqual(DEFAULT_AUDIO);
    expect(DEFAULT_AUDIO).toEqual({
      music: { volume: 0.5, muted: false },
      sfx: { volume: 0.7, muted: false },
      voice: { volume: 1, muted: false },
    });
  });

  it("reads the hero's saved channels, repairing whatever is missing or out of range", () => {
    const s = audioFrom({ audio: { music: { volume: 0.2, muted: true }, sfx: { volume: 7, muted: 'x' }, voice: {} } as never }, null);
    expect(s).toEqual({ music: { volume: 0.2, muted: true }, sfx: { volume: 1, muted: false }, voice: { volume: 1, muted: false } });
  });

  it('maps the old single mute onto the music and the effects, never the voice', () => {
    expect(audioFrom({ mute: true }, null)).toEqual({ ...DEFAULT_AUDIO, music: { volume: 0.5, muted: true }, sfx: { volume: 0.7, muted: true } });
    expect(audioFrom({ mute: true, audio: DEFAULT_AUDIO }, null)).toEqual(DEFAULT_AUDIO);
  });

  it("uses the device's last channels only before a hero is chosen", () => {
    const device = { music: { volume: 0.1, muted: false }, sfx: { volume: 0.3, muted: true }, voice: { volume: 0.9, muted: false } };
    expect(audioFrom(null, device)).toEqual(device);
    expect(audioFrom({}, device)).toEqual(DEFAULT_AUDIO);
    expect(audioFrom(null, 'garbage')).toEqual(DEFAULT_AUDIO);
  });

  it('clamps and rounds a volume, and silences a muted channel', () => {
    expect(clampVolume(0.333, 1)).toBe(0.33);
    expect(clampVolume(-1, 1)).toBe(0);
    expect(clampVolume(Number.NaN, 0.4)).toBe(0.4);
    expect(gainOf({ volume: 0.6, muted: false })).toBe(0.6);
    expect(gainOf({ volume: 0.6, muted: true })).toBe(0);
  });
});
```

`web/src/lib/audio/store.svelte.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const patch = vi.fn(async (id: number, body: { settings: object }) => ({ id, settings: body.settings }));
vi.mock('../api', () => ({ api: { profiles: { patch: (id: number, body: { settings: object }) => patch(id, body) } } }));

import { profileStore } from '../profileStore.svelte';
import { DEFAULT_AUDIO } from './settings';
import { audioSettings, bothMuted, flushAudioSave, initAudioSettings, resetAudioStoreForTests, setChannel, setChannels } from './store.svelte';

const hero = (settings: object = {}) => ({ id: 4, name: 'Io', avatar: 'chouette', level: '10H', has_pin: false, help_stage: 1, created_at: '', settings }) as never;

beforeEach(() => {
  patch.mockClear();
  resetAudioStoreForTests();
  profileStore.current = hero();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('the channel store (Ruling E2)', () => {
  it("seeds from the hero, the old mute included", () => {
    initAudioSettings(hero({ mute: true }));
    expect(audioSettings.music.muted && audioSettings.sfx.muted && !audioSettings.voice.muted).toBe(true);
    expect(bothMuted()).toBe(true);
  });

  it('saves a toggle at once, as the whole audio object, and keeps the in-session hero in step', async () => {
    initAudioSettings(hero());
    setChannel(4, 'music', { muted: true });
    await vi.runAllTimersAsync();
    expect(patch).toHaveBeenCalledTimes(1);
    expect(patch).toHaveBeenLastCalledWith(4, { settings: { audio: { ...DEFAULT_AUDIO, music: { volume: 0.5, muted: true } } } });
    expect((profileStore.current as { settings: { audio: object } }).settings.audio).toEqual({ ...DEFAULT_AUDIO, music: { volume: 0.5, muted: true } });
  });

  it('saves a moving slider once it rests, and at once on release', async () => {
    initAudioSettings(hero());
    setChannel(4, 'voice', { volume: 0.9 }, { live: true });
    setChannel(4, 'voice', { volume: 0.8 }, { live: true });
    await vi.advanceTimersByTimeAsync(399);
    expect(patch).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(patch).toHaveBeenCalledTimes(1);
    setChannel(4, 'voice', { volume: 0.7 }, { live: true });
    setChannel(4, 'voice', { volume: 0.6 });
    await vi.runAllTimersAsync();
    expect(patch).toHaveBeenCalledTimes(2);
    expect(patch.mock.lastCall![1]).toMatchObject({ settings: { audio: { voice: { volume: 0.6, muted: false } } } });
  });

  it('sends the saves in order, one after the other', async () => {
    initAudioSettings(hero());
    const order: string[] = [];
    patch.mockImplementation(async (id, body) => {
      order.push(JSON.stringify((body.settings as { audio: { sfx: { muted: boolean } } }).audio.sfx.muted));
      return { id, settings: body.settings };
    });
    setChannels(4, { music: { muted: true }, sfx: { muted: true } });
    setChannel(4, 'sfx', { muted: false });
    await flushAudioSave();
    expect(order).toEqual(['true', 'false']);
  });

  it('never throws when the server or the storage is out of reach', async () => {
    patch.mockRejectedValueOnce(new Error('offline'));
    initAudioSettings(hero());
    expect(() => setChannel(4, 'sfx', { muted: true })).not.toThrow();
    await flushAudioSave();
    expect(audioSettings.sfx.muted).toBe(true);
  });
});
```

`battle.test.ts`: in 'describes a battle from the existing art only', `ambience: { music: null }` becomes `ambience: { music: 'battle' }`, and add `expect(battleFor('eris', { mode: 'boss', encounter: 'eris' }).ambience.music).toBe('lair');`.

`events.test.ts`: every `start` event in it gains `backdrop: 'river'` (or its real ground); add a type-level check `expectTypeOf<Extract<BattleEvent, { kind: 'start' }>>().toHaveProperty('backdrop')`.

`server/tests/test_static_types.py` (read `server/tests/conftest.py` first and use its app/settings fixtures the way `test_health.py` does):

```python
"""UI5 Ruling E16: the audio files are served as audio/mp4, like the WebP art and the WOFF2 fonts."""
import mimetypes

import app.main  # noqa: F401  (registers the types at import)


def test_m4a_is_audio_mp4():
    assert mimetypes.guess_type("camp.m4a")[0] == "audio/mp4"


def test_the_spa_catch_all_serves_an_m4a_as_audio(client_with_static):  # fixture: a static dir holding audio/music/x.m4a
    res = client_with_static.get("/audio/music/x.m4a")
    assert res.status_code == 200
    assert res.headers["content-type"] == "audio/mp4"
```

(If `conftest.py` has no static-dir fixture, write one in this file: a `tmp_path` static dir with `index.html` and `audio/music/x.m4a`, `Settings` built with `static_dir=tmp_path`, `TestClient(create_app(settings))`.)

`server/tests/test_ui5_settings.py`:

```python
"""UI5: the hero's audio channels and seen tours ride in the free-form settings, merged key by key."""


def test_audio_and_tours_round_trip_and_merge(client, make_profile):  # use conftest's profile helper
    pid = make_profile()
    audio = {"music": {"volume": 0.4, "muted": False}, "sfx": {"volume": 0.7, "muted": True}, "voice": {"volume": 1, "muted": False}}
    assert client.patch(f"/api/profiles/{pid}", json={"settings": {"audio": audio}}).status_code == 200
    assert client.patch(f"/api/profiles/{pid}", json={"settings": {"tours": ["camp"], "onboarded": True}}).status_code == 200
    s = client.get(f"/api/profiles/{pid}").json()["settings"]
    assert s["audio"] == audio and s["tours"] == ["camp"] and s["onboarded"] is True
    audio2 = {**audio, "music": {"volume": 0.1, "muted": True}}
    client.patch(f"/api/profiles/{pid}", json={"settings": {"audio": audio2}})
    assert client.get(f"/api/profiles/{pid}").json()["settings"]["audio"] == audio2
```

(Adapt the fixture names to `conftest.py`; if there is no GET for one profile, read it from the list.)

- [ ] **Step 3: `lib/audio/catalog.ts`**

```ts
// The camp's sounds (scenes UI spec §7): five quiet loops and nine short effects, all CC0
// (ASSETS-LICENSES.md), AAC in .m4a for the iPad. The paths are fixed here (UI5 Task 1) so the
// sourcing lane produces exactly these files and the engine lane plays them without waiting for it.
// `mix` is each sound's level inside its channel, set by ear in Task 3b.
import type { SceneId } from '../scene/types';
import type { BackdropId } from '../battle/battle';

export type TrackId = 'sea' | 'camp' | 'temple' | 'lair' | 'battle';
export type SfxId = 'tap' | 'seal' | 'unroll' | 'chime' | 'growth' | 'hmpf' | 'laurel' | 'strike' | 'fanfare';

export interface SoundDef {
  src: string;
  mix: number;
}

const track = (id: TrackId, mix = 1): SoundDef => ({ src: `/audio/music/${id}.m4a`, mix });
const effect = (id: SfxId, mix = 1): SoundDef => ({ src: `/audio/sfx/${id}.m4a`, mix });

export const TRACKS: Record<TrackId, SoundDef> = {
  sea: track('sea'),
  camp: track('camp'),
  temple: track('temple'),
  lair: track('lair'),
  battle: track('battle', 0.9),
};

export const SFX: Record<SfxId, SoundDef> = {
  tap: effect('tap', 0.6),
  seal: effect('seal'),
  unroll: effect('unroll', 0.8),
  chime: effect('chime'),
  growth: effect('growth'),
  hmpf: effect('hmpf', 0.8),
  laurel: effect('laurel'),
  strike: effect('strike', 0.8),
  fanfare: effect('fanfare'),
};

export const TRACK_IDS = Object.keys(TRACKS) as TrackId[];
export const SFX_IDS = Object.keys(SFX) as SfxId[];

/** Ruling E4: the loop of each place. */
export const SCENE_MUSIC: Record<SceneId, TrackId> = {
  title: 'sea',
  camp: 'camp',
  nest: 'camp',
  cabin: 'camp',
  library: 'temple',
  delphi: 'temple',
  war: 'lair',
};

/** Ruling E4: every battle ground plays the battle loop; Éris in her lair plays hers. */
export function battleTrack(backdrop: BackdropId): TrackId {
  return backdrop === 'lair' ? 'lair' : 'battle';
}

// Ruling E17: the size budget (assets.test.ts, Task 3).
export const MUSIC_BUDGET_BYTES = 8 * 1024 * 1024;
export const TRACK_MAX_BYTES = 2 * 1024 * 1024;
export const SFX_MAX_BYTES = 64 * 1024;
export const SFX_BUDGET_BYTES = 512 * 1024;
export const LOOP_MIN_S = 30;
export const LOOP_MAX_S = 90;
```

`meta.gen.json`: `{}` (Task 3b writes it; nothing else edits it).

- [ ] **Step 4: `lib/audio/settings.ts`**

```ts
// The three channels (scenes UI spec §7, Ruling E2): music, effects and the dictation's voice, each
// with a volume and a mute, saved per hero in `settings.audio`. Pure: store.svelte.ts persists them.
import type { ProfileSettings } from '../types';

export type ChannelId = 'music' | 'sfx' | 'voice';
export interface ChannelSetting {
  volume: number;
  muted: boolean;
}
export type AudioSettings = Record<ChannelId, ChannelSetting>;

export const CHANNELS: ChannelId[] = ['music', 'sfx', 'voice'];

export const DEFAULT_AUDIO: AudioSettings = {
  music: { volume: 0.5, muted: false },
  sfx: { volume: 0.7, muted: false },
  voice: { volume: 1, muted: false },
};

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** 0-1, two decimals (the sliders step by 0.05). */
export function clampVolume(v: unknown, fallback: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return Math.round(Math.min(1, Math.max(0, n)) * 100) / 100;
}

/** A hero's channels (`settings` given): the saved ones, repaired, else the old single mute mapped
 *  onto the music and the effects, else the defaults. Before a hero is chosen (`settings` null):
 *  what this device used last, else the defaults. */
export function audioFrom(settings: ProfileSettings | null, device: unknown): AudioSettings {
  const saved: unknown = settings ? settings.audio : device;
  const out = {} as AudioSettings;
  for (const ch of CHANNELS) {
    const s = isRecord(saved) && isRecord(saved[ch]) ? saved[ch] : {};
    out[ch] = {
      volume: clampVolume(s.volume, DEFAULT_AUDIO[ch].volume),
      muted: typeof s.muted === 'boolean' ? s.muted : DEFAULT_AUDIO[ch].muted,
    };
  }
  if (settings && !isRecord(settings.audio) && settings.mute === true) {
    out.music.muted = true;
    out.sfx.muted = true;
  }
  return out;
}

export function gainOf(c: ChannelSetting): number {
  return c.muted ? 0 : c.volume;
}
```

`lib/types.ts`: in `ProfileSettings`, rewrite `mute`'s comment to « Before UI5: one switch for the music and the effects. Read once to seed `audio` (Ruling E2); no longer written. » and add:

```ts
  /** UI5 (spec §7): the three channels, always saved whole. */
  audio?: import('./audio/settings').AudioSettings;
  /** UI5 (spec §8): the places whose first-visit tour was seen or skipped. */
  tours?: string[];
```

- [ ] **Step 5: `lib/audio/store.svelte.ts`**

```ts
// The hero's channels ($state, Ruling E2): server-authoritative in `settings.audio`, mirrored on the
// device so the title (no hero yet) starts from the last values. A toggle saves at once; a moving
// slider saves once it rests and at once on release. Saves are chained, so the server sees them in
// the order they were made (two quick toggles never land reversed). Sound is a convenience: no
// failure here ever reaches the player.
import { api } from '../api';
import { profileStore } from '../profileStore.svelte';
import type { Profile } from '../types';
import { CHANNELS, DEFAULT_AUDIO, audioFrom, clampVolume, type AudioSettings, type ChannelId, type ChannelSetting } from './settings';

const DEVICE_KEY = 'discorde.audio';
const LIVE_SAVE_MS = 400;

function readDevice(): unknown {
  try {
    const raw = localStorage.getItem(DEVICE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeDevice(s: AudioSettings): void {
  try {
    localStorage.setItem(DEVICE_KEY, JSON.stringify(s));
  } catch {
    // Storage unavailable (private mode, quota): the hero's settings still apply.
  }
}

export const audioSettings = $state<AudioSettings>(audioFrom(null, readDevice()));

function assign(s: AudioSettings): void {
  for (const ch of CHANNELS) audioSettings[ch] = { ...s[ch] };
}

/** A plain copy (never the $state proxy): what the engine and the server receive. */
export function snapshotAudio(): AudioSettings {
  return {
    music: { ...audioSettings.music },
    sfx: { ...audioSettings.sfx },
    voice: { ...audioSettings.voice },
  };
}

export function initAudioSettings(profile: Profile): void {
  assign(audioFrom(profile.settings, null));
}

export const bothMuted = (): boolean => audioSettings.music.muted && audioSettings.sfx.muted;

let chain: Promise<unknown> = Promise.resolve();
let liveTimer: ReturnType<typeof setTimeout> | undefined;

function save(profileId: number): void {
  clearTimeout(liveTimer);
  liveTimer = undefined;
  const audio = snapshotAudio();
  chain = chain
    .then(() => api.profiles.patch(profileId, { settings: { audio } }))
    .catch(() => {
      // Server out of reach: the local values still apply; the next load reconciles.
    });
}

export function setChannels(
  profileId: number,
  patch: Partial<Record<ChannelId, Partial<ChannelSetting>>>,
  opts: { live?: boolean } = {},
): void {
  for (const ch of CHANNELS) {
    const p = patch[ch];
    if (!p) continue;
    const cur = audioSettings[ch];
    audioSettings[ch] = {
      volume: p.volume === undefined ? cur.volume : clampVolume(p.volume, cur.volume),
      muted: p.muted ?? cur.muted,
    };
  }
  const s = snapshotAudio();
  // UI3 final review I3: a screen that re-seeds from the in-session hero must see the change.
  const current = profileStore.current;
  if (current && current.id === profileId) current.settings = { ...current.settings, audio: s };
  writeDevice(s);
  if (opts.live) {
    clearTimeout(liveTimer);
    liveTimer = setTimeout(() => save(profileId), LIVE_SAVE_MS);
  } else {
    save(profileId);
  }
}

export function setChannel(profileId: number, ch: ChannelId, patch: Partial<ChannelSetting>, opts: { live?: boolean } = {}): void {
  setChannels(profileId, { [ch]: patch }, opts);
}

/** Tests: waits for every save made so far. */
export async function flushAudioSave(): Promise<void> {
  await chain;
}

export function resetAudioStoreForTests(): void {
  clearTimeout(liveTimer);
  liveTimer = undefined;
  chain = Promise.resolve();
  assign(DEFAULT_AUDIO);
}
```

(The "saves a moving slider" test's last two calls rely on `save` clearing the pending live timer: two PATCHes in all, the second with 0.6.)

- [ ] **Step 6: The old store becomes a façade; `initSound` callers move**

`lib/juice/soundStore.svelte.ts` (whole file):

```ts
// UI5 Ruling E1: the single mute became three channels (lib/audio/store.svelte.ts). Until the HUD
// and the lyre move to them (UI5 Task 5, which deletes this file), « muted » means the music and
// the effects, never the dictation's voice (« La dictée est toujours lue »).
import { audioSettings, bothMuted, setChannels } from '../audio/store.svelte';

export const soundStore = {
  get muted(): boolean {
    return bothMuted();
  },
};

export async function setMuted(profileId: number, muted: boolean): Promise<void> {
  setChannels(profileId, { music: { muted }, sfx: { muted } });
}
```

`PlaceScene.svelte`, `Boss.svelte`, `Play.svelte`: `import { initSound } from '…/juice/soundStore.svelte'` → `import { initAudioSettings } from '…/audio/store.svelte'`, and each `initSound(profile)` → `initAudioSettings(profile)`. Nothing else in those files.

`lib/juice/sfx.ts`: `playSfx`'s guard `soundStore.muted` → `audioSettings.sfx.muted` (import from `../audio/store.svelte`); the rest stays until Task 4. `sfx.test.ts`: `soundStore.muted = …` → `audioSettings.sfx.muted = …`.

- [ ] **Step 7: The battle's start event names its ground; the loops' map**

`lib/battle/events.ts`: `| { kind: 'start'; opponent: OpponentId; mode: BattleMode; backdrop: BackdropId }` (import `BackdropId`). `BattleStage.svelte`: `emitBattle({ kind: 'start', opponent: battle.opponent.id, mode, backdrop: battle.backdrop.id })`. `lib/battle/battle.ts`: `BattleDef.ambience: { music: TrackId }`, and `battleFor` sets `ambience: { music: battleTrack(backdrop.id) }` (update the doc comment: « UI5: the loop of this ground (Ruling E4) »).

`lib/scene/types.ts`: `ambience: { particles: FxPreset; music: TrackId | null };` (import type from `../audio/catalog`). Each `lib/world/scenes/<place>.ts`: `ambience: { particles: '…', music: SCENE_MUSIC.<place> }`. Scene tests that pinned `music: null` pin the track.

- [ ] **Step 8: The MIME type**

`server/app/main.py`, after the WOFF2 line:

```python
# UI5 (scenes UI spec §7, Ruling E16): the camp's sounds (web/public/audio/**/*.m4a, AAC). Without it
# the slim image served them as application/octet-stream.
mimetypes.add_type("audio/mp4", ".m4a")
```

- [ ] **Step 9: The e2e hooks**

`web/e2e/crashGuard.ts`: `export const test = base.extend<{ tours: boolean }>({ tours: [false, { option: true }], context: …, page: async ({ page, tours }, use, testInfo) => { … } })`. The page fixture's init script gains, before the heartbeat (same `addInitScript`, `tours` passed as its argument):

```ts
    await page.addInitScript((toursOn: boolean) => {
      // UI5 Ruling E10: no e2e ever plays real sound (the engine records instead and publishes its
      // state as window.__discordeAudio), and the first-visit tours stay away unless a spec asks
      // for them with test.use({ tours: true }).
      const w = window as unknown as { __discordeAudioStub?: boolean; __discordeTours?: string; __pageStalls?: string[] };
      w.__discordeAudioStub = true;
      if (!toursOn) w.__discordeTours = 'off';
      // … the existing heartbeat, unchanged …
    }, tours);
```

`web/e2e/helpers.ts` — `stubSpeech`: the class `U` gains `volume = 1`; `speak(u)` also pushes `u.volume` to `window.__spokenVolumes` (created next to `__spoken`). Append:

```ts
// ===== UI5 (Task 1) =====

/** The audio engine's state (Ruling E10), or null before the app has created it. */
export interface AudioSnap {
  unlocked: boolean;
  settings: Record<'music' | 'sfx' | 'voice', { volume: number; muted: boolean }>;
  wanted: string | null;
  playing: string | null;
  musicGain: number;
  ducks: string[];
  voiceSpeaking: boolean;
  sfx: string[];
}

export async function audioState(page: Page): Promise<AudioSnap | null> {
  return page.evaluate(() => {
    const w = window as unknown as { __discordeAudio?: { snapshot(): unknown } };
    return (w.__discordeAudio?.snapshot() ?? null) as never;
  });
}

/** Waits until the loop playing is `track` (null: none), and optionally for its ducking. */
export async function expectMusic(page: Page, track: string | null, opts: { ducks?: string[] } = {}) {
  await expect.poll(async () => (await audioState(page))?.playing ?? null).toBe(track);
  if (opts.ducks) await expect.poll(async () => (await audioState(page))?.ducks ?? null).toEqual(opts.ducks);
}

/** The volumes the stubbed speechSynthesis was asked to speak at, oldest first. */
export async function spokenVolumes(page: Page): Promise<number[]> {
  return page.evaluate(() => (window as unknown as { __spokenVolumes?: number[] }).__spokenVolumes ?? []);
}

/** Taps the dialogue box to its next line: once to finish the typing, once to go on. */
export async function nextLine(page: Page) {
  const adv = page.getByTestId('dialogue-advance');
  if ((await adv.getAttribute('aria-label')) !== 'Suite') await adv.click();
  await expect(adv).toHaveAttribute('aria-label', 'Suite');
  await adv.click();
}

/** A hero whose camp tour is still to come (createProfileApi marks it seen, as `onboarded`). */
export async function createFreshHeroApi(request: APIRequestContext, name: string, level = '10H'): Promise<number> {
  const res = await request.post('/api/profiles', { data: { name, avatar: 'chouette', level } });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).id as number;
}
```

(`expectLineOf` needs the content files: Task 2 adds it.)

- [ ] **Step 10: Run the tests**

Run: `scripts/npm.sh run test -- src/lib/audio src/lib/juice src/lib/battle src/lib/world/scenes src/lib/scene`
Expected: PASS (paste the counts).
Run: `scripts/pytest.sh -q server/tests/test_static_types.py server/tests/test_ui5_settings.py`
Expected: PASS.
Run: `scripts/npm.sh run check`
Expected: `0 errors and 0 warnings` (the e2e type-check included).
Run once each (selectors unchanged, the fixture changed under them): `scripts/playwright.sh scenes-camp scenes-cabin scenes-battle.spec`
Expected: PASS (the HUD mute tests pass through the façade).

- [ ] **Step 11: Commit**

```bash
git add web/package.json web/package-lock.json web/src/lib/audio web/src/lib/types.ts web/src/lib/juice web/src/components/scene/PlaceScene.svelte web/src/screens/Boss.svelte web/src/screens/Play.svelte web/src/lib/battle web/src/components/battle/BattleStage.svelte web/src/lib/scene/types.ts web/src/lib/world/scenes server/app/main.py server/tests/test_static_types.py server/tests/test_ui5_settings.py web/e2e/crashGuard.ts web/e2e/helpers.ts
git commit -m "UI5 Task 1: audio foundation - howler, the sound catalogue, three channels saved per hero (old mute migrated), the places' and battles' loops, .m4a MIME type, e2e audio stub and tours option

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/package.json web/package-lock.json web/src/lib/audio web/src/lib/types.ts web/src/lib/juice web/src/components/scene/PlaceScene.svelte web/src/screens/Boss.svelte web/src/screens/Play.svelte web/src/lib/battle web/src/components/battle/BattleStage.svelte web/src/lib/scene/types.ts web/src/lib/world/scenes server/app/main.py server/tests/test_static_types.py server/tests/test_ui5_settings.py web/e2e/crashGuard.ts web/e2e/helpers.ts
```

---

### Task 2: Dialogue foundation — every line in the content files, the loader, the selector, the speakers, the tours and their seen flags, the guards

**Files:**
- Create: `content/dialogue/{camp,library,delphi,war,nest,cabin,battle}.json`
- Create: `web/src/lib/dialogue/{types,content,select,speakers,battle}.ts`, `content.test.ts`, `select.test.ts`, `battle.test.ts`
- Create: `web/src/lib/tours/tours.ts`, `tours.test.ts`, `seen.svelte.ts`, `seen.svelte.test.ts`
- Create: `web/src/testing/copyRules.ts`; Modify: `web/src/registerGuard.test.ts`, `web/src/noGuilt.test.ts`, `web/src/lib/battle/lines.test.ts` (import the rules from it)
- Modify: `web/src/lib/text/french.ts` (+ `french.test.ts`): `frenchSpacing`
- Modify: `web/src/lib/scene/types.ts` (`DialogueLine.key`, `narrator`), `web/src/lib/world/scenes/*.ts` (`narrator`), `web/src/lib/scene/overlayState.svelte.ts` (`tour` flag), `web/src/components/scene/SceneStage.svelte` (one class condition), `web/src/lib/world/voices.ts` (export `owl`, `pythia`), `web/src/lib/battle/events.ts` (`BATTLE_NARRATOR` typed)
- Modify: `Dockerfile`; `web/e2e/helpers.ts` (`expectLineOf`)

**Interfaces:**
- Consumes: `SpeakerId`, `DialogueLine`, `SceneId`, `SCENES`, `DragonOut`, `DragonStage`, `OpponentId`, `BattleMode`, `PlayMode`, `dragonSpeaker`, `erisSays`, `ART`, `FORBIDDEN`, `screenText`, `Profile`, `ProfileSettings`, `api`, `profileStore`.
- Produces:
  - `types.ts`: `When`, `LineDef`, `TourStepDef`, `DialogueFile`, `DIALOGUE_KEYS`, `DialogueKey`, `TOUR_IDS`, `TourId`, `DialogueCtx`, `PLACEHOLDERS`.
  - `content.ts`: `parseDialogueFile(name, raw)`, `LINES: Record<DialogueKey, LineDef[]>`, `TOURS: Record<TourId, TourStepDef[]>`.
  - `select.ts`: `matches(when, ctx)`, `poolFor(lines, ctx)`, `pick(pool, last, rnd)`, `fill(text, vars)`, `sayKey(key, opts?)`, `resetDialogueMemory()`.
  - `speakers.ts`: `frameFor(speaker, dragon)`, `EGG`.
  - `battle.ts`: `erisVictoryKey(o)`, `erisVictoryLine(o)`, `musterLine(o)`, `explainIntro(word, dragon)`.
  - `tours/tours.ts`: `TOUR_OF`, `toursEnabled()`, `tourSeen(settings, id)`, `tourSteps(id, dragon)`.
  - `tours/seen.svelte.ts`: `shouldTour(profile, id)`, `markTourSeen(profile, id)`, `resetTours(profileId)`, `resetSeenForTests()`.
  - `frenchSpacing(text)`; `copyRules.ts`: `BANNED`, `banned(text)`, `GUILT`, `GENDERED`.
  - `DialogueLine.key?: string`; `SceneDef.narrator: { enter: DialogueKey | null; tour: TourId | null }`; `overlayState.tour: boolean`.
  - e2e: `expectLineOf(locator, key, vars?)`.

- [ ] **Step 1: The content files**

Authored with plain spaces (the loader applies `frenchSpacing`), straight apostrophes, « guillemets », « … » as one character. Every existing line is kept as a variant of its key.

`content/dialogue/camp.json`:

```json
{
  "lines": {
    "camp.enter": [
      { "speaker": "dragon", "text": "Bienvenue au camp, {hero}." },
      { "speaker": "dragon", "text": "Te revoilà, {hero} ! Le feu t'attendait." },
      { "speaker": "dragon", "text": "{hero} ! Les Muses ont gardé ta place près du feu." },
      { "speaker": "dragon", "text": "Salut, {hero}. Le camp est plus calme quand tu es là." }
    ],
    "camp.weekly": [
      { "speaker": "dragon", "text": "Ton objectif de la semaine est atteint. Le camp te remercie !" },
      { "speaker": "dragon", "text": "Tous les textes promis cette semaine sont défendus. Tu peux souffler, ou continuer si le cœur t'en dit." },
      { "speaker": "dragon", "text": "Objectif de la semaine atteint ! Même Éris l'a remarqué, et ça l'agace." }
    ],
    "camp.next.prophecy": [
      { "speaker": "dragon", "text": "La Pythie a vu ta prochaine épreuve, {when}. Viens t'y préparer !" },
      { "speaker": "dragon", "text": "Une prophétie t'attend à Delphes : ta prochaine dictée, {when}. On s'y prépare ensemble ?" },
      { "speaker": "dragon", "text": "La Pythie a parlé : une dictée arrive {when}. Allons voir son parchemin." }
    ],
    "camp.next.battle": [
      { "speaker": "dragon", "text": "Le sentier de la bataille est ouvert : Éris t'attend." },
      { "speaker": "dragon", "text": "Éris s'est montrée au bout du sentier de la bataille. On y va quand tu veux." },
      { "speaker": "dragon", "text": "Le sentier de la bataille est ouvert. Éris fanfaronne déjà, là-bas." }
    ],
    "camp.next.first-text": [
      { "speaker": "dragon", "text": "Les parchemins t'attendent, sous la tente." },
      { "speaker": "dragon", "text": "Ton premier parchemin t'attend sous la tente. Éris y a déjà glissé ses pièges !" },
      { "speaker": "dragon", "text": "Sous la tente des parchemins, un premier texte attend d'être défendu." }
    ],
    "camp.next.scrolls": [
      { "speaker": "dragon", "text": "La Pythie t'attend à Delphes : trois rouleaux à ouvrir." },
      { "speaker": "dragon", "text": "Une nouvelle semaine, trois nouveaux rouleaux : la Pythie t'attend à Delphes." },
      { "speaker": "dragon", "text": "Les rouleaux de la semaine sont scellés à Delphes. Lequel t'appellera ?" }
    ],
    "camp.next.none": [
      { "speaker": "dragon", "text": "Les parchemins t'attendent, sous la tente." },
      { "speaker": "dragon", "text": "La tente des parchemins a toujours un texte à défendre." },
      { "speaker": "dragon", "text": "Où allons-nous ? Les parchemins, Delphes, la tente de guerre : à toi de choisir." }
    ]
  },
  "tour": [
    { "speaker": "dragon", "target": null, "when": { "stage": ["egg"] }, "text": "Toc, toc ! C'est moi, l'œuf que les Muses t'ont confié. Je vais te montrer le camp." },
    { "speaker": "dragon", "target": null, "when": { "stage": ["hatchling", "young", "adult"] }, "text": "On refait le tour du camp ? Suis-moi." },
    { "speaker": "dragon", "target": null, "text": "Les Muses comptent sur toi pour défendre les textes du camp contre Éris, la déesse de la Discorde." },
    { "speaker": "dragon", "target": null, "text": "Éris sème des dés-accords : un -s oublié, un a pour un à… Chacun de ses lieutenants est une ruse." },
    { "speaker": "dragon", "target": null, "text": "Relis une chose à la fois, et ses ruses tombent une à une." },
    { "speaker": "dragon", "target": "parchemins", "text": "La tente des parchemins : tes textes t'y attendent, et on peut en apporter de nouveaux." },
    { "speaker": "dragon", "target": "oracle", "text": "Le chemin de Delphes : la Pythie y ouvre les rouleaux de la semaine et annonce tes prochaines dictées." },
    { "speaker": "dragon", "target": "dossier", "text": "La tente de guerre : le dossier d'Éris et le bestiaire de ses monstres." },
    { "speaker": "dragon", "target": "dragon", "when": { "stage": ["egg"] }, "text": "Mon nid. J'éclorai quand la première ruse d'Éris sera neutralisée, et tu me donneras un nom." },
    { "speaker": "dragon", "target": "dragon", "when": { "stage": ["hatchling", "young", "adult"] }, "text": "Mon nid. Viens m'y voir quand tu veux." },
    { "speaker": "dragon", "target": "cabin", "text": "Ta cabane : tes trésors, ton journal, et la lyre pour régler la voix et les sons." },
    { "speaker": "dragon", "target": "boss", "text": "Le sentier de la bataille. Quand Éris se montrera, c'est là qu'on l'affrontera." },
    { "speaker": "dragon", "target": null, "text": "À toi de choisir où aller : touche un lieu du camp !" }
  ]
}
```

`content/dialogue/library.json`:

```json
{
  "lines": {
    "library.enter": [
      { "speaker": "owl", "text": "Hou ! Tes parchemins dorment sur les étagères. Le pupitre, la lentille et le portail en apportent de nouveaux." },
      { "speaker": "owl", "text": "Hou ! Bienvenue sous la tente. Quel parchemin défendons-nous aujourd'hui ?" },
      { "speaker": "owl", "text": "Hou ! Les étagères t'attendent. Si tu hésites, touche-moi." }
    ],
    "library.owl": [
      { "speaker": "owl", "text": "Hou ! Tes parchemins dorment sur les étagères. Choisis-en un et défends-le contre Éris." },
      { "speaker": "owl", "text": "Hou ! Au pupitre, tu peux écrire ou coller un texte à toi." },
      { "speaker": "owl", "text": "Hou ! La lentille de bronze déchiffre les feuilles imprimées de ta classe." },
      { "speaker": "owl", "text": "Hou ! Derrière le portail, les scribes d'Alexandrie recopient de vieux livres pour toi." }
    ]
  },
  "tour": [
    { "speaker": "owl", "target": "shelves", "text": "Hou ! Sur les étagères dorment tes parchemins. Choisis-en un pour le défendre contre Éris." },
    { "speaker": "owl", "target": "desk", "text": "Au pupitre, tu peux écrire ou coller un texte à toi. Entre 80 et 200 mots, c'est l'idéal." },
    { "speaker": "owl", "target": "lens", "text": "La lentille de bronze déchiffre les feuilles imprimées de ta classe." },
    { "speaker": "owl", "target": "portal", "text": "Derrière le portail, les scribes d'Alexandrie recopient de vieux livres pour tes étagères." },
    { "speaker": "owl", "target": "owl", "text": "Et si tu oublies, touche-moi : je te redirai tout. Hou !" }
  ]
}
```

`content/dialogue/delphi.json`:

```json
{
  "lines": {
    "delphi.enter.sealed": [
      { "speaker": "pythia", "text": "Approche. Trois rouleaux scellés t'attendent cette semaine." },
      { "speaker": "pythia", "text": "Les rouleaux de la semaine sont scellés. Un seul s'ouvrira pour toi." },
      { "speaker": "pythia", "text": "Approche. Les vapeurs m'ont montré trois chemins pour ta semaine." }
    ],
    "delphi.enter.chosen": [
      { "speaker": "pythia", "text": "La quête de la semaine est choisie. L'Oracle parlera de nouveau lundi." },
      { "speaker": "pythia", "text": "Ton rouleau est ouvert. Je lirai de nouveaux signes lundi." },
      { "speaker": "pythia", "text": "La semaine suit son chemin. Reviens lundi : les vapeurs auront changé." }
    ]
  },
  "tour": [
    { "speaker": "pythia", "target": "pythia", "text": "Je suis la Pythie. Chaque semaine, trois rouleaux scellés t'attendent ici : tu en ouvres un, et sa quête commence." },
    { "speaker": "pythia", "target": "tablets", "text": "Sur ce mur, les tablettes votives gardent tes quêtes et les monstres que tu as défiés." },
    { "speaker": "pythia", "target": null, "text": "Et quand ta classe prépare une dictée, pose son texte sur les étagères : j'en ferai une prophétie." }
  ]
}
```

`content/dialogue/war.json`:

```json
{
  "lines": {
    "war.enter": [
      { "speaker": "eris", "text": "Tiens, de la visite. Fouillez mon dossier : mes meilleures ruses n'y sont pas écrites." },
      { "speaker": "eris", "text": "Les héros du camp épinglent mes lieutenants sur leur toile. Comme c'est touchant." },
      { "speaker": "eris", "text": "Mon dossier, ma collection de monstres… Le camp croit tout savoir. Il se trompe." },
      { "speaker": "eris", "text": "Encore un conseil de guerre ? Mes lieutenants tremblent. Un peu. Pas beaucoup." }
    ]
  },
  "tour": [
    { "speaker": "dragon", "target": "dossier", "text": "La tente de guerre. Sur la table, le dossier d'Éris : tout ce qu'on sait de ses ruses." },
    { "speaker": "dragon", "target": null, "text": "Ses lieutenants sont épinglés sur la toile. Chacun cache une ruse dans les textes." },
    { "speaker": "dragon", "target": "bestiary", "text": "Le bestiaire raconte le vrai mythe de chaque monstre, puis ce qu'Éris en a fait." },
    { "speaker": "eris", "target": null, "text": "Fouillez mon dossier tant que vous voudrez, au camp. Mes meilleures ruses n'y sont pas écrites." }
  ]
}
```

`content/dialogue/nest.json`:

```json
{
  "lines": {
    "nest.enter": [
      { "speaker": "dragon", "when": { "stage": ["egg"] }, "text": "Toc, toc… Chaque piège d'Éris déjoué me fait frémir dans ma coquille." },
      { "speaker": "dragon", "when": { "stage": ["egg"] }, "text": "Il fait chaud dans ce nid. Encore un peu, et je sors !" },
      { "speaker": "dragon", "when": { "stage": ["egg"] }, "text": "Tu entends ? C'est moi qui tapote la coquille." },
      { "speaker": "dragon", "when": { "stage": ["hatchling"] }, "text": "Te revoilà ! Chaque ruse d'Éris neutralisée me fait grandir." },
      { "speaker": "dragon", "when": { "stage": ["hatchling"] }, "text": "Regarde mes écailles : elles brillent un peu plus chaque jour." },
      { "speaker": "dragon", "when": { "stage": ["hatchling"] }, "text": "J'ai essayé de cracher du feu. Juste de la fumée, pour l'instant." },
      { "speaker": "dragon", "when": { "stage": ["young"] }, "text": "Je bats des ailes ! Bientôt, je volerai au-dessus du camp." },
      { "speaker": "dragon", "when": { "stage": ["young"] }, "text": "Je me suis entraîné à voler toute la matinée." },
      { "speaker": "dragon", "when": { "stage": ["young"] }, "text": "Mes ailes me portent déjà jusqu'au feu du camp." },
      { "speaker": "dragon", "when": { "stage": ["adult"] }, "text": "Je veille sur le camp. Éris n'a qu'à bien se tenir." },
      { "speaker": "dragon", "when": { "stage": ["adult"] }, "text": "Du haut du nid, je vois tout le camp. Rien ne m'échappe." },
      { "speaker": "dragon", "when": { "stage": ["adult"] }, "text": "Les lieutenants d'Éris évitent mon ombre, maintenant." }
    ],
    "nest.name": [
      { "speaker": "dragon", "text": "Te revoilà ! Tu me donnes un nom ?" },
      { "speaker": "dragon", "text": "Je n'ai toujours pas de nom… Tu m'en choisis un ?" },
      { "speaker": "dragon", "text": "Un dragon sans nom, c'est un peu triste. Tu m'aides ?" }
    ]
  },
  "tour": [
    { "speaker": "dragon", "target": "dragon", "when": { "stage": ["egg"] }, "text": "Mon nid. Quand j'aurai éclos, tu me donneras un nom et tu choisiras ma teinte." },
    { "speaker": "dragon", "target": "dragon", "when": { "stage": ["hatchling", "young", "adult"] }, "text": "Mon nid. Ici, tu choisis ma teinte, et mon nom si je n'en ai pas encore." },
    { "speaker": "dragon", "target": null, "text": "Chaque ruse d'Éris neutralisée me fait grandir : œuf, petit dragon, jeune dragon, puis gardien du camp." }
  ]
}
```

`content/dialogue/cabin.json`:

```json
{
  "lines": {
    "cabin.enter": [
      { "speaker": "dragon", "text": "Ta cabane. Tout ce que tu as gagné est rangé ici." },
      { "speaker": "dragon", "text": "Ta cabane sent le bois et la cire. Tes trésors t'attendent." },
      { "speaker": "dragon", "text": "On est bien, ici. Tes trésors, ton journal, ta lyre : tout est à sa place." }
    ]
  },
  "tour": [
    { "speaker": "dragon", "target": "trophies", "text": "L'étagère garde tes trésors. Chaque récompense est annoncée à l'avance : rien n'est tiré au sort." },
    { "speaker": "dragon", "target": "journal", "text": "Ton journal se souvient de chaque texte défendu et de chaque piège déjoué." },
    { "speaker": "dragon", "target": "lyre", "text": "La lyre règle la voix qui lit la dictée, la musique et les bruitages du camp." }
  ]
}
```

`content/dialogue/battle.json`:

```json
{
  "lines": {
    "battle.start": [
      { "speaker": "eris", "text": "Un parchemin de plus pour mes dés-accords. Les héros du camp n'y verront que du feu." },
      { "speaker": "eris", "text": "Ce texte-là, je l'ai choisi moi-même. Mes pièges y sont bien au chaud." },
      { "speaker": "eris", "text": "Le camp envoie encore quelqu'un défendre ce parchemin ? Mes pièges sont prêts, eux." },
      { "speaker": "eris", "text": "Écoute bien la voix… Moi, j'écoute surtout les accords qui s'égarent." },
      { "speaker": "eris", "when": { "mode": ["grimoire"] }, "text": "J'ai recopié ce parchemin à ma façon, en y semant mes dés-accords. Aucun héros du camp ne les retrouvera tous." },
      { "speaker": "eris", "when": { "mode": ["grimoire"] }, "text": "Mon grimoire, ma plume, mes dés-accords. Bonne chance pour tout réparer !" },
      { "speaker": "eris", "when": { "mode": ["grimoire"] }, "text": "Chaque page de ce grimoire porte ma marque. Cherche bien : elle est discrète." }
    ],
    "battle.retry": [
      { "speaker": "eris", "text": "Revoilà ce parchemin ? J'ai changé mes pièges de cachette." },
      { "speaker": "eris", "text": "Deuxième manche ! Les héros du camp ne lâchent jamais rien, hein ?" },
      { "speaker": "eris", "text": "Encore ce texte ? Soit. Mes dés-accords adorent qu'on les cherche." }
    ],
    "battle.perfect": [
      { "speaker": "eris", "text": "Pfff. Tu n'as rien laissé passer pendant la dictée. Je reviendrai." },
      { "speaker": "eris", "text": "Pas un seul piège ? Mes lieutenants vont m'entendre." },
      { "speaker": "eris", "text": "Rien. Pas un dés-accord. Le camp a de la chance, cette fois." }
    ],
    "battle.victory": [
      { "speaker": "eris", "text": "Impossible ! Tu as déjoué presque tous mes pièges. Ça ne se reproduira pas." },
      { "speaker": "eris", "text": "Mes pièges, débusqués un par un… Les héros du camp deviennent agaçants." },
      { "speaker": "eris", "text": "Je retourne à mes plans. Et la prochaine fois, je cache mieux mes pièges !" },
      { "speaker": "eris", "when": { "mode": ["grimoire"] }, "text": "Quoi ?! Tu as trouvé tous mes dés-accords dans ce grimoire. Je le corromprai mieux la prochaine fois." },
      { "speaker": "eris", "when": { "mode": ["grimoire"] }, "text": "Mon beau grimoire, réparé page après page… Quel gâchis." },
      { "speaker": "eris", "when": { "mode": ["grimoire"] }, "text": "Le grimoire respire à nouveau. Profitez-en, au camp : ça ne durera pas." }
    ],
    "battle.retreat": [
      { "speaker": "eris", "text": "Hmpf. La moitié de mes pièges, déjoués. J'en cacherai mieux la prochaine fois." },
      { "speaker": "eris", "text": "Je recule… d'un pas. Un tout petit pas." },
      { "speaker": "eris", "text": "Quelques-uns de mes pièges tiennent encore. Je m'accroche à ceux-là." },
      { "speaker": "eris", "when": { "mode": ["grimoire"] }, "text": "Hmpf. La moitié de mes dés-accords retrouvés. Le grimoire garde encore quelques secrets…" },
      { "speaker": "eris", "when": { "mode": ["grimoire"] }, "text": "Le grimoire se répare à moitié. L'autre moitié reste à moi." },
      { "speaker": "eris", "when": { "mode": ["grimoire"] }, "text": "Tu trouves mes dés-accords plus vite que je ne les sème. Presque." }
    ],
    "battle.caught": [
      { "speaker": "eris", "text": "Ha ! Mes pièges tiennent encore. Mais tu commences à voir clair…" },
      { "speaker": "eris", "text": "Quelques pièges débusqués. Les autres rient encore dans leur cachette." },
      { "speaker": "eris", "text": "Tu en as trouvé quelques-uns ? Garde-les. J'en ai plein d'autres." },
      { "speaker": "eris", "when": { "mode": ["grimoire"] }, "text": "Ha ! Quelques dés-accords retrouvés. Le grimoire commence à se réparer." },
      { "speaker": "eris", "when": { "mode": ["grimoire"] }, "text": "Quelques pages réparées… Mon grimoire garde le reste de ses secrets." },
      { "speaker": "eris", "when": { "mode": ["grimoire"] }, "text": "Tu as débusqué quelques dés-accords. Les autres dorment encore entre les lignes." }
    ],
    "battle.missed": [
      { "speaker": "eris", "text": "Mes pièges sont restés bien cachés. Cette fois." },
      { "speaker": "eris", "text": "Pas un piège débusqué ! Mes lieutenants sont fiers d'eux… pour aujourd'hui." },
      { "speaker": "eris", "text": "Ils se sont bien cachés, mes petits pièges. Le dragon va vouloir les chercher avec toi, je parie." },
      { "speaker": "eris", "when": { "mode": ["grimoire"] }, "text": "Mes dés-accords sont restés bien cachés dans ce grimoire. Cette fois." },
      { "speaker": "eris", "when": { "mode": ["grimoire"] }, "text": "Mon grimoire garde tous ses secrets… pour l'instant." },
      { "speaker": "eris", "when": { "mode": ["grimoire"] }, "text": "Pas une page réparée ! Mon encre tient bon, aujourd'hui." }
    ],
    "battle.explain": [
      { "speaker": "dragon", "text": "Regarde « {word} » avec moi." },
      { "speaker": "dragon", "text": "Un piège que je veux te montrer : « {word} »." },
      { "speaker": "dragon", "text": "Celui-ci, je te l'explique : « {word} »." }
    ]
  }
}
```

- [ ] **Step 2: Write the failing tests**

`web/src/lib/text/french.test.ts` (append):

```ts
describe('frenchSpacing (Ruling E15)', () => {
  it('puts a narrow no-break space before « : ; ! ? » and inside guillemets', () => {
    expect(frenchSpacing('Hou ! Quoi ?! Voilà : « mot » ; fin')).toBe('Hou\u202f! Quoi\u202f?! Voilà\u202f: «\u202fmot\u202f»\u202f; fin');
  });
  it('replaces a no-break space too, and is idempotent', () => {
    const once = frenchSpacing('Vite\u00a0!');
    expect(once).toBe('Vite\u202f!');
    expect(frenchSpacing(once)).toBe(once);
  });
  it('leaves an unspaced colon alone (never invents a space)', () => {
    expect(frenchSpacing('l’idéal:80')).toBe('l’idéal:80');
  });
});
```

`web/src/lib/dialogue/select.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { fill, matches, pick, poolFor, resetDialogueMemory, sayKey } from './select';
import { LINES } from './content';
import type { LineDef } from './types';

const l = (text: string, when?: LineDef['when']): LineDef => ({ speaker: 'eris', text, ...(when ? { when } : {}) });
const seq = (...xs: number[]) => {
  let i = 0;
  return () => xs[i++ % xs.length];
};

beforeEach(() => resetDialogueMemory());

describe('picking a line (spec §8)', () => {
  it('prefers the lines made for this context over the generic ones', () => {
    const lines = [l('a'), l('b'), l('g1', { mode: ['grimoire'] }), l('g2', { mode: ['grimoire'] })];
    expect(poolFor(lines, { mode: 'grimoire' }).map((x) => x.text)).toEqual(['g1', 'g2']);
    expect(poolFor(lines, { mode: 'dictation' }).map((x) => x.text)).toEqual(['a', 'b']);
    expect(poolFor(lines, {}).map((x) => x.text)).toEqual(['a', 'b']);
    expect(matches({ stage: ['egg'] }, { stage: 'egg' })).toBe(true);
    expect(matches({ stage: ['egg'] }, {})).toBe(false);
  });

  it('never says the same line twice in a row, unless it is the only one', () => {
    const pool = [l('a'), l('b'), l('c')];
    expect(pick(pool, 'a', seq(0))!.text).toBe('b');
    expect(pick(pool, 'b', seq(0.99))!.text).toBe('c');
    expect(pick([l('a')], 'a', seq(0))!.text).toBe('a');
    expect(pick([], undefined, seq(0))).toBeNull();
  });

  it('fills the declared placeholders and leaves unknown ones visible (the content test forbids them)', () => {
    expect(fill('Bienvenue, {hero}.', { hero: 'Io' })).toBe('Bienvenue, Io.');
    expect(fill('{nope}', {})).toBe('{nope}');
  });

  it('speaks a key as a framed line, spaced, with its key, and remembers it', () => {
    const d = { name: 'Brasier', stage: 'young', tint: 'bronze' } as never;
    const first = sayKey('camp.enter', { vars: { hero: 'Io' }, dragon: d, rnd: seq(0) });
    expect(first).toMatchObject({ speaker: 'dragon', name: 'Brasier', key: 'camp.enter', text: 'Bienvenue au camp, Io.' });
    for (let i = 0; i < 20; i++) {
      const again = sayKey('camp.enter', { vars: { hero: 'Io' }, dragon: d });
      expect(again.text).not.toBe(first.text);
      first.text = again.text;
    }
    expect(sayKey('library.owl', { rnd: seq(0.3) }).text).toMatch(/^Hou\u202f!/);
  });

  it('knows every key it can be asked for', () => {
    expect(Object.keys(LINES).length).toBeGreaterThan(20);
  });
});
```

`web/src/lib/dialogue/content.test.ts`:

```ts
// UI5 (spec §8, §1): the content files are the whole dialogue of the camp. Every line passes the
// camp's copy rules here, since the file guards (registerGuard, noGuilt) scan src/ only.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { FORBIDDEN } from '../world/eris';
import { SCENES } from '../world/scenes';
import { GENDERED, GUILT, banned } from '../../testing/copyRules';
import { LINES, TOURS, parseDialogueFile } from './content';
import { DIALOGUE_KEYS, PLACEHOLDERS, TOUR_IDS, type DialogueCtx, type DialogueKey, type LineDef } from './types';
import { poolFor } from './select';

const DIR = '../content/dialogue';
const every: { where: string; line: LineDef }[] = [
  ...Object.entries(LINES).flatMap(([k, ls]) => ls.map((line) => ({ where: k, line }))),
  ...Object.entries(TOURS).flatMap(([t, ls]) => ls.map((line, i) => ({ where: `tour.${t}.${i}`, line }))),
];

// The contexts each key is asked in (default: none): every one must have at least three lines to
// pick from, so « no immediate repeat » always has somewhere to go.
const DOMAINS: Partial<Record<DialogueKey, DialogueCtx[]>> = {
  'nest.enter': ['egg', 'hatchling', 'young', 'adult'].map((stage) => ({ stage }) as DialogueCtx),
  'battle.start': [{ mode: 'dictation' }, { mode: 'grimoire' }],
  'battle.victory': [{ mode: 'dictation' }, { mode: 'grimoire' }],
  'battle.retreat': [{ mode: 'dictation' }, { mode: 'grimoire' }],
  'battle.caught': [{ mode: 'dictation' }, { mode: 'grimoire' }],
  'battle.missed': [{ mode: 'dictation' }, { mode: 'grimoire' }],
};

describe('the dialogue content (spec §8)', () => {
  it('has exactly the files and keys the code asks for, each key in its own file', () => {
    expect(readdirSync(DIR).sort()).toEqual(['battle.json', 'cabin.json', 'camp.json', 'delphi.json', 'library.json', 'nest.json', 'war.json']);
    expect(Object.keys(LINES).sort()).toEqual([...DIALOGUE_KEYS].sort());
    for (const f of readdirSync(DIR)) {
      const file = parseDialogueFile(f, JSON.parse(readFileSync(`${DIR}/${f}`, 'utf-8')));
      for (const k of Object.keys(file.lines)) expect(k.startsWith(`${f.replace('.json', '')}.`), `${f}: ${k}`).toBe(true);
    }
  });

  it('offers at least three lines for every key in every context it is asked in', () => {
    for (const k of DIALOGUE_KEYS) {
      for (const ctx of DOMAINS[k] ?? [{}]) expect(poolFor(LINES[k], ctx).length, `${k} ${JSON.stringify(ctx)}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('walks each tour through hotspots that exist in its place, for every dragon stage', () => {
    expect(Object.keys(TOURS).sort()).toEqual([...TOUR_IDS].sort());
    for (const id of TOUR_IDS) {
      const scene = SCENES.find((s) => s.id === id)!;
      for (const step of TOURS[id]) if (step.target) expect(scene.hotspots.map((h) => h.id), `${id}: ${step.target}`).toContain(step.target);
      for (const stage of ['egg', 'hatchling', 'young', 'adult'] as const) {
        expect(TOURS[id].filter((s) => !s.when || s.when.stage?.includes(stage)).length, `${id} ${stage}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('uses only the placeholders each key declares', () => {
    for (const { where, line } of every) {
      const used = [...line.text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      const allowed = PLACEHOLDERS[where as DialogueKey] ?? [];
      for (const u of used) expect(allowed, `${where}: {${u}}`).toContain(u);
    }
  });

  it('speaks the camp, never the school, never guilt, never an agreement with the player', () => {
    for (const { where, line } of every) {
      expect(banned(line.text), where).toEqual([]);
      expect(line.text.match(GUILT), where).toBeNull();
      expect(line.text.match(GENDERED), where).toBeNull();
    }
  });

  it("keeps Éris's taunts on her tricks and the camp's heroes, never the player's ability", () => {
    for (const { where, line } of every.filter((x) => x.line.speaker === 'eris')) {
      for (const w of FORBIDDEN) expect(line.text.toLowerCase().includes(w), `${where}: « ${w} »`).toBe(false);
    }
  });

  it('is authored with plain spaces, typographic signs and a length that fits the box', () => {
    for (const { where, line } of every) {
      expect(line.text, where).not.toMatch(/[\u00a0\u202f]/);
      expect(line.text, where).not.toMatch(/ {2}|^\s|\s$|"|\.\.\./);
      expect(line.text.length, where).toBeLessThanOrEqual(170);
    }
  });

  it('is never spoken by the dictation voice', () => {
    for (const f of ['src/lib/dialogue/select.ts', 'src/lib/dialogue/battle.ts', 'src/lib/tours/tours.ts', 'src/components/scene/DialogueBox.svelte', 'src/components/scene/OverlayVoice.svelte']) {
      expect(readFileSync(f, 'utf-8'), f).not.toMatch(/dictation\/tts|speechSynthesis|speak\(/);
    }
  });
});
```

(`TourLayer.svelte` joins that last list in Task 6.)

`web/src/lib/dialogue/battle.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { erisVictoryKey, erisVictoryLine, musterLine } from './battle';
import { LINES } from './content';
import { poolFor, resetDialogueMemory } from './select';
import { frenchSpacing } from '../text/french';

beforeEach(() => resetDialogueMemory());

describe("Éris in battle (Ruling E14)", () => {
  it('reacts to the reckoning, never live', () => {
    expect(erisVictoryKey({ draft: 0, catchRate: null })).toBe('battle.perfect');
    expect(erisVictoryKey({ draft: 5, catchRate: 0.8 })).toBe('battle.victory');
    expect(erisVictoryKey({ draft: 5, catchRate: 0.6 })).toBe('battle.retreat');
    expect(erisVictoryKey({ draft: 5, catchRate: 0.2 })).toBe('battle.caught');
    expect(erisVictoryKey({ draft: 5, catchRate: 0 })).toBe('battle.missed');
    expect(erisVictoryKey({ draft: 5, catchRate: null })).toBe('battle.missed');
  });

  it('speaks a grimoire line in a grimoire, and adds her aside for the traps she slipped in', () => {
    const g = erisVictoryLine({ draft: 4, catchRate: 1, introduced: 0, mode: 'grimoire' });
    expect(poolFor(LINES['battle.victory'], { mode: 'grimoire' }).map((x) => frenchSpacing(x.text))).toContain(g.text);
    expect(g).toMatchObject({ speaker: 'eris', key: 'battle.victory' });
    expect(erisVictoryLine({ draft: 4, catchRate: 0.5, introduced: 2, mode: 'dictation' }).text).toMatch(/\(Et j'en ai glissé 2 pendant ta relecture\. Sournois, je sais\.\)$/);
  });

  it('opens the muster with her line, her retry line, or the lieutenant’s dossier line', () => {
    expect(musterLine({ opponent: 'eris', band: null, mode: 'grimoire', retry: false }).key).toBe('battle.start');
    expect(musterLine({ opponent: 'eris', band: null, mode: 'dictation', retry: true }).key).toBe('battle.retry');
    const lt = musterLine({ opponent: 'hydre', band: 'strong', mode: 'dictation', retry: false });
    expect(lt.key).toBeUndefined();
    expect(lt.text).toContain('Hydre');
  });
});
```

`web/src/lib/tours/tours.test.ts` and `seen.svelte.test.ts`:

```ts
// tours.test.ts
import { describe, expect, it } from 'vitest';
import { TOUR_OF, tourSeen, tourSteps, toursEnabled } from './tours';

const egg = { name: null, stage: 'egg', tint: 'bronze' } as never;
const young = { name: 'Brasier', stage: 'young', tint: 'olive' } as never;

describe('the first-visit tours (spec §8, Ruling E13)', () => {
  it('belongs to every place with hotspots, not to the title', () => {
    expect(TOUR_OF).toEqual({ camp: 'camp', library: 'library', delphi: 'delphi', war: 'war', nest: 'nest', cabin: 'cabin' });
  });

  it("follows the dragon's stage and names each step's hotspot", () => {
    const e = tourSteps('camp', egg);
    expect(e.lines[0].text).toMatch(/^Toc, toc\u202f!/);
    expect(e.lines[0]).toMatchObject({ speaker: 'dragon', name: "L'œuf", key: 'tour.camp.0' });
    expect(e.targets).toEqual([null, null, null, null, 'parchemins', 'oracle', 'dossier', 'dragon', 'cabin', 'boss', null]);
    const y = tourSteps('camp', young);
    expect(y.lines[0].text).toBe('On refait le tour du camp\u202f? Suis-moi.');
    expect(y.lines).toHaveLength(e.lines.length);
    expect(tourSteps('war', young).lines.at(-1)).toMatchObject({ speaker: 'eris' });
  });

  it("counts the camp's tour as seen for a hero onboarded before UI5", () => {
    expect(tourSeen({}, 'camp')).toBe(false);
    expect(tourSeen({ onboarded: true }, 'camp')).toBe(true);
    expect(tourSeen({ onboarded: true }, 'library')).toBe(false);
    expect(tourSeen({ tours: ['library'] }, 'library')).toBe(true);
  });

  it('can be switched off by the e2e hook only (Ruling E10)', () => {
    expect(toursEnabled()).toBe(true);
    (globalThis as { __discordeTours?: string }).__discordeTours = 'off';
    expect(toursEnabled()).toBe(false);
    delete (globalThis as { __discordeTours?: string }).__discordeTours;
  });
});
```

```ts
// seen.svelte.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const patch = vi.fn(async (id: number, body: { settings: object }) => ({ id, settings: body.settings }));
vi.mock('../api', () => ({ api: { profiles: { patch: (id: number, b: { settings: object }) => patch(id, b) } } }));

import { profileStore } from '../profileStore.svelte';
import { markTourSeen, resetSeenForTests, resetTours, shouldTour } from './seen.svelte';

const hero = (settings: object) => ({ id: 9, name: 'Io', avatar: 'chouette', level: '10H', has_pin: false, help_stage: 1, created_at: '', settings }) as never;

beforeEach(() => {
  patch.mockClear();
  resetSeenForTests();
});

describe('seen tours (Ruling E13)', () => {
  it('marks a tour seen for this page load even when the save fails, and saves the whole list', async () => {
    const p = hero({ tours: ['nest'] });
    profileStore.current = p;
    patch.mockRejectedValueOnce(new Error('offline'));
    expect(shouldTour(p, 'library')).toBe(true);
    await markTourSeen(p, 'library');
    expect(shouldTour(p, 'library')).toBe(false);
    expect(patch).toHaveBeenLastCalledWith(9, { settings: { tours: ['nest', 'library'] } });
  });

  it('writes onboarded with the camp tour, and the lyre clears everything', async () => {
    const p = hero({});
    profileStore.current = p;
    await markTourSeen(p, 'camp');
    expect(patch).toHaveBeenLastCalledWith(9, { settings: { tours: ['camp'], onboarded: true } });
    expect(profileStore.current!.settings).toMatchObject({ tours: ['camp'], onboarded: true });
    await resetTours(9);
    expect(patch).toHaveBeenLastCalledWith(9, { settings: { tours: [], onboarded: false } });
    expect(shouldTour(profileStore.current!, 'camp')).toBe(true);
  });
});
```

- [ ] **Step 3: `lib/text/french.ts` — `frenchSpacing`**

```ts
/** French typography (Ruling E15): a narrow no-break space (U+202F) before « : ; ! ? » and inside
 *  « guillemets », replacing a plain or no-break space already there, so a line never wraps a lone
 *  « ! » onto the next line. Never adds a space where there was none. Idempotent. */
export function frenchSpacing(text: string): string {
  return text.replace(/[ \u00a0]+([:;!?»])/g, '\u202f$1').replace(/«[ \u00a0]+/g, '«\u202f');
}
```

- [ ] **Step 4: `lib/dialogue/types.ts`, `content.ts`, `speakers.ts`, `select.ts`**

`types.ts`:

```ts
// The dialogue content's shape (spec §8, Ruling E11). The files live in content/dialogue/<area>.json.
import type { SpeakerId } from '../scene/types';
import type { DragonStage } from '../world/types';
import type { BattleMode, OpponentId } from '../battle/battle';

export interface When {
  stage?: DragonStage[];
  opponent?: OpponentId[];
  mode?: BattleMode[];
}
export interface LineDef {
  speaker: SpeakerId;
  text: string;
  when?: When;
}
export interface TourStepDef extends LineDef {
  /** The hotspot id the ring circles, or null for a line over the whole place. */
  target: string | null;
}
export interface DialogueFile {
  lines: Record<string, LineDef[]>;
  tour?: TourStepDef[];
}
export interface DialogueCtx {
  stage?: DragonStage;
  opponent?: OpponentId;
  mode?: BattleMode;
}

export const DIALOGUE_KEYS = [
  'camp.enter', 'camp.weekly', 'camp.next.prophecy', 'camp.next.battle', 'camp.next.first-text', 'camp.next.scrolls', 'camp.next.none',
  'library.enter', 'library.owl',
  'delphi.enter.sealed', 'delphi.enter.chosen',
  'war.enter',
  'nest.enter', 'nest.name',
  'cabin.enter',
  'battle.start', 'battle.retry', 'battle.perfect', 'battle.victory', 'battle.retreat', 'battle.caught', 'battle.missed', 'battle.explain',
] as const;
export type DialogueKey = (typeof DIALOGUE_KEYS)[number];

export const TOUR_IDS = ['camp', 'library', 'delphi', 'war', 'nest', 'cabin'] as const;
export type TourId = (typeof TOUR_IDS)[number];

/** The placeholders each key may use (content.test.ts); every other key uses none. */
export const PLACEHOLDERS: Partial<Record<DialogueKey, string[]>> = {
  'camp.enter': ['hero'],
  'camp.next.prophecy': ['when'],
  'battle.explain': ['word'],
};
```

`content.ts`:

```ts
// Loads and checks the dialogue files at import (a bad file fails the build's tests, never a player's
// screen): every key belongs to DIALOGUE_KEYS and to its own file, every speaker exists, every
// `when` names known conditions. The files are imported one by one (typed, bundled by Vite).
import camp from '@content/dialogue/camp.json';
import library from '@content/dialogue/library.json';
import delphi from '@content/dialogue/delphi.json';
import war from '@content/dialogue/war.json';
import nest from '@content/dialogue/nest.json';
import cabin from '@content/dialogue/cabin.json';
import battle from '@content/dialogue/battle.json';
import { DIALOGUE_KEYS, TOUR_IDS, type DialogueFile, type DialogueKey, type LineDef, type TourId, type TourStepDef } from './types';

const SPEAKERS = new Set(['dragon', 'pythia', 'owl', 'eris']);
const WHEN_KEYS = new Set(['stage', 'opponent', 'mode']);

function checkLine(where: string, x: unknown, tour: boolean): LineDef | TourStepDef {
  const o = x as Record<string, unknown>;
  if (typeof o !== 'object' || o === null) throw new Error(`${where}: not an object`);
  if (!SPEAKERS.has(o.speaker as string)) throw new Error(`${where}: unknown speaker ${String(o.speaker)}`);
  if (typeof o.text !== 'string' || !o.text.trim()) throw new Error(`${where}: empty text`);
  if (o.when !== undefined) {
    const w = o.when as Record<string, unknown>;
    for (const [k, v] of Object.entries(w)) {
      if (!WHEN_KEYS.has(k) || !Array.isArray(v) || v.length === 0) throw new Error(`${where}: bad when.${k}`);
    }
  }
  if (tour && !(o.target === null || typeof o.target === 'string')) throw new Error(`${where}: bad target`);
  return o as unknown as LineDef;
}

export function parseDialogueFile(name: string, raw: unknown): DialogueFile {
  const area = name.replace(/\.json$/, '');
  const r = raw as { lines?: unknown; tour?: unknown };
  if (typeof r?.lines !== 'object' || r.lines === null) throw new Error(`${name}: no lines`);
  const lines: Record<string, LineDef[]> = {};
  for (const [key, list] of Object.entries(r.lines as Record<string, unknown>)) {
    if (!key.startsWith(`${area}.`)) throw new Error(`${name}: ${key} belongs elsewhere`);
    if (!(DIALOGUE_KEYS as readonly string[]).includes(key)) throw new Error(`${name}: unknown key ${key}`);
    if (!Array.isArray(list) || list.length === 0) throw new Error(`${name}: ${key} is empty`);
    lines[key] = list.map((x, i) => checkLine(`${name} ${key}[${i}]`, x, false));
  }
  const tour = r.tour === undefined ? undefined : (r.tour as unknown[]).map((x, i) => checkLine(`${name} tour[${i}]`, x, true) as TourStepDef);
  return { lines, ...(tour ? { tour } : {}) };
}

const FILES = { camp, library, delphi, war, nest, cabin, battle } as Record<string, unknown>;
const parsed = Object.entries(FILES).map(([n, raw]) => [n, parseDialogueFile(`${n}.json`, raw)] as const);

export const LINES = Object.fromEntries(parsed.flatMap(([, f]) => Object.entries(f.lines))) as Record<DialogueKey, LineDef[]>;
export const TOURS = Object.fromEntries(
  parsed.filter(([n, f]) => f.tour && (TOUR_IDS as readonly string[]).includes(n)).map(([n, f]) => [n, f.tour!]),
) as Record<TourId, TourStepDef[]>;
```

`speakers.ts`:

```ts
// Who says a content line (spec §2.5): the dragon with its stage's tinted cut-out (« L'œuf » before
// it hatches), the Pythia, Athena's owl, Éris. The same frames as voices.ts and speakers.ts.
import { dragonSpeaker } from '../world/scenes/speakers';
import { erisSays, owl, pythia } from '../world/voices';
import type { DragonOut } from '../world/types';
import type { DialogueLine, SpeakerId } from '../scene/types';

/** The dragon before /camp has answered: an egg, in bronze. */
export const EGG = { name: null, stage: 'egg', tint: 'bronze' } as unknown as DragonOut;

function frame(line: DialogueLine): Omit<DialogueLine, 'text'> {
  const { text, ...rest } = line;
  void text;
  return rest;
}

export function frameFor(speaker: SpeakerId, dragon: DragonOut | null | undefined): Omit<DialogueLine, 'text'> {
  switch (speaker) {
    case 'dragon':
      return dragonSpeaker(dragon ?? EGG);
    case 'owl':
      return frame(owl(''));
    case 'pythia':
      return frame(pythia(''));
    case 'eris':
      return frame(erisSays(''));
  }
}
```

(`voices.ts` exports its private `owl`/`pythia` constructors for this, Step 7.)

`select.ts`:

```ts
// Picks what a character says (spec §8, Ruling E11): among a key's lines, those made for this context
// (a `when` that matches) beat the generic ones; the one said last for that key is never said again
// right away (per page load, like the greetings, Ruling A9), unless it is the only one.
import { frenchSpacing } from '../text/french';
import type { DragonOut } from '../world/types';
import type { DialogueLine } from '../scene/types';
import { LINES } from './content';
import { frameFor } from './speakers';
import type { DialogueCtx, DialogueKey, LineDef, When } from './types';

const lastSaid = new Map<string, string>();

export function matches(w: When | undefined, c: DialogueCtx): boolean {
  if (!w) return true;
  return (
    (!w.stage || (c.stage !== undefined && w.stage.includes(c.stage))) &&
    (!w.opponent || (c.opponent !== undefined && w.opponent.includes(c.opponent))) &&
    (!w.mode || (c.mode !== undefined && w.mode.includes(c.mode)))
  );
}

export function poolFor(lines: LineDef[], ctx: DialogueCtx): LineDef[] {
  const specific = lines.filter((l) => l.when && matches(l.when, ctx));
  return specific.length > 0 ? specific : lines.filter((l) => !l.when);
}

export function pick(pool: LineDef[], last: string | undefined, rnd: () => number): LineDef | null {
  if (pool.length === 0) return null;
  const fresh = pool.length > 1 ? pool.filter((l) => l.text !== last) : pool;
  return fresh[Math.min(fresh.length - 1, Math.floor(rnd() * fresh.length))];
}

export function fill(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k] : m));
}

export interface SayOpts {
  ctx?: DialogueCtx;
  vars?: Record<string, string>;
  dragon?: DragonOut | null;
  rnd?: () => number;
}

/** A line of `key`, framed for its speaker, spaced, tagged with its key (`data-key` in the DOM). The
 *  content test guarantees every key has lines for every context it is asked in; a miss is a bug
 *  and throws. */
export function sayKey(key: DialogueKey, o: SayOpts = {}): DialogueLine {
  const ctx = { ...(o.dragon ? { stage: o.dragon.stage } : {}), ...o.ctx };
  const line = pick(poolFor(LINES[key] ?? [], ctx), lastSaid.get(key), o.rnd ?? Math.random);
  if (!line) throw new Error(`no line for ${key}`);
  lastSaid.set(key, line.text);
  return { ...frameFor(line.speaker, o.dragon), text: frenchSpacing(fill(line.text, o.vars ?? {})), key };
}

export function resetDialogueMemory(): void {
  lastSaid.clear();
}
```

- [ ] **Step 5: `lib/dialogue/battle.ts`**

```ts
// Éris and the dragon in battle (Ruling E14). Never during the dictation or the proofreading: the
// muster, the retry and the victory only; "error caught" and "error missed" at the reckoning.
import { dossierLine, type Band } from '../world/eris';
import { erisSays } from '../world/voices';
import { frenchSpacing } from '../text/french';
import { VICTORY } from '../battle/lines';
import type { OpponentId } from '../battle/battle';
import type { DragonOut } from '../world/types';
import type { DialogueLine } from '../scene/types';
import type { PlayMode } from '../types';
import { sayKey } from './select';
import type { DialogueKey } from './types';

export function erisVictoryKey(o: { draft: number; catchRate: number | null }): DialogueKey {
  if (o.draft === 0) return 'battle.perfect';
  const r = o.catchRate ?? 0;
  if (r >= 0.8) return 'battle.victory';
  if (r >= 0.5) return 'battle.retreat';
  if (r > 0) return 'battle.caught';
  return 'battle.missed';
}

export function erisVictoryLine(o: { draft: number; catchRate: number | null; introduced: number; mode: PlayMode }): DialogueLine {
  const line = sayKey(erisVictoryKey(o), { ctx: { mode: o.mode } });
  return o.introduced > 0 ? { ...line, text: `${line.text} ${frenchSpacing(VICTORY.erisIntroduced(o.introduced))}` } : line;
}

export function musterLine(o: { opponent: OpponentId; band: Band | null; mode: PlayMode; retry: boolean }): DialogueLine {
  if (o.retry) return sayKey('battle.retry', { ctx: { mode: o.mode, opponent: o.opponent } });
  if (o.opponent !== 'eris') return erisSays(dossierLine(o.opponent, o.band ?? 'none'));
  return sayKey('battle.start', { ctx: { mode: o.mode } });
}

export function explainIntro(word: string, dragon: DragonOut | null): DialogueLine {
  return sayKey('battle.explain', { vars: { word }, dragon });
}
```

`lib/battle/lines.ts`: add to `VICTORY` (Task 6's fence) `erisIntroduced: (n: number) => \`(Et j'en ai glissé ${n} pendant ta relecture. Sournois, je sais.)\`,` — the exact aside of today's `erisLine` (Task 7 deletes `erisLine`).

- [ ] **Step 6: The tours and their seen flags**

`lib/tours/tours.ts`:

```ts
// The first-visit tours (spec §8, Ruling E13): each place with hotspots walks its new visitor round
// them, its character speaking one step at a time. Steps come from the place's content file,
// filtered by the dragon's stage.
import { TOURS } from '../dialogue/content';
import { frameFor } from '../dialogue/speakers';
import { matches } from '../dialogue/select';
import { frenchSpacing } from '../text/french';
import type { DialogueLine, SceneId } from '../scene/types';
import type { DragonOut } from '../world/types';
import type { ProfileSettings } from '../types';
import type { TourId } from '../dialogue/types';

export const TOUR_OF: Partial<Record<SceneId, TourId>> = { camp: 'camp', library: 'library', delphi: 'delphi', war: 'war', nest: 'nest', cabin: 'cabin' };

/** Ruling E10: e2e switches the tours off unless a spec asks for them. */
export function toursEnabled(): boolean {
  return (globalThis as { __discordeTours?: string }).__discordeTours !== 'off';
}

/** A hero onboarded before UI5 saw the Muses' cards, which the camp tour replaces. */
export function tourSeen(settings: ProfileSettings, id: TourId): boolean {
  return (settings.tours ?? []).includes(id) || (id === 'camp' && settings.onboarded === true);
}

export function tourSteps(id: TourId, dragon: DragonOut | null): { lines: DialogueLine[]; targets: (string | null)[] } {
  const steps = TOURS[id].filter((s) => matches(s.when, dragon ? { stage: dragon.stage } : {}));
  return {
    lines: steps.map((s, i) => ({ ...frameFor(s.speaker, dragon), text: frenchSpacing(s.text), key: `tour.${id}.${i}` })),
    targets: steps.map((s) => s.target),
  };
}
```

`lib/tours/seen.svelte.ts`:

```ts
// Which tours a hero has seen (Ruling E13): `settings.tours` on the server, plus what this page load
// has shown, so a failed save never replays a tour she just closed. Reactive (SvelteSet), so the
// camp's deep-linked hero panel opens as soon as its tour ends.
import { SvelteSet } from 'svelte/reactivity';
import { api } from '../api';
import { profileStore } from '../profileStore.svelte';
import type { Profile } from '../types';
import type { TourId } from '../dialogue/types';
import { tourSeen, toursEnabled } from './tours';

const seenNow = new SvelteSet<string>();
const k = (profileId: number, id: TourId) => `${profileId}:${id}`;

export function shouldTour(profile: Profile, id: TourId): boolean {
  return toursEnabled() && !seenNow.has(k(profile.id, id)) && !tourSeen(profile.settings, id);
}

export async function markTourSeen(profile: Profile, id: TourId): Promise<void> {
  seenNow.add(k(profile.id, id));
  const base = profileStore.current?.id === profile.id ? profileStore.current.settings : profile.settings;
  const tours = [...new Set([...(base.tours ?? []), id])];
  const settings = id === 'camp' ? { tours, onboarded: true } : { tours };
  try {
    const updated = await api.profiles.patch(profile.id, { settings });
    if (profileStore.current?.id === profile.id) profileStore.current = updated;
  } catch {
    // A comfort feature: the tour is closed for this page load whatever the server said.
  }
}

/** « Refaire les visites du camp » (the lyre): errors reach the lyre, which shows them. */
export async function resetTours(profileId: number): Promise<void> {
  for (const key of [...seenNow]) if (key.startsWith(`${profileId}:`)) seenNow.delete(key);
  const updated = await api.profiles.patch(profileId, { settings: { tours: [], onboarded: false } });
  if (profileStore.current?.id === profileId) profileStore.current = updated;
}

export function resetSeenForTests(): void {
  seenNow.clear();
}
```

- [ ] **Step 7: Types, scene data, the stage's tour flag, voices, events**

- `lib/scene/types.ts`: `DialogueLine` gains `/** The content key it came from (spec §8): the dialogue box's data-key, for e2e. */ key?: string;`. `SceneDef.narrator` becomes `{ enter: DialogueKey | null; tour: TourId | null }` (doc: « the place's greeting key and its first-visit tour »). Each scene: `narrator: { enter: '<place>.enter' | 'delphi.enter.sealed' | null, tour: '<place>' | null }` (title: both null; war: `'war.enter'`, `'war'`).
- `lib/scene/overlayState.svelte.ts`: `export const overlayState = $state({ open: 0, tour: false });` with a comment « UI5: a first-visit tour is open (TourLayer): the stage is inert as under any modal, but keeps its labels, which the tour points at. »
- `SceneStage.svelte`: `class:has-overlay={covered && !overlayState.tour}` (the `inert` stays on `covered`).
- `lib/world/voices.ts`: `export const owl = …`, `export const pythia = …` (no other change).
- `lib/battle/events.ts`: `BATTLE_NARRATOR` gains `perfect: 'battle.perfect'`, `explain: 'battle.explain'` and `satisfies Record<string, DialogueKey>`; its comment points at `content/dialogue/battle.json`.

- [ ] **Step 8: The shared copy rules**

`web/src/testing/copyRules.ts` (moved, not copied): `BANNED` and `banned(text)` from `registerGuard.test.ts`; `GUILT` from `noGuilt.test.ts`; `GENDERED` (the `bad` regex of `lines.test.ts`, extended with « seule », « contente », « fatiguée », « perdue » excluded since GUILT has it). The three tests import them. Their self-tests stay green.

- [ ] **Step 9: The Dockerfile and the e2e line helper**

`Dockerfile`, web stage, after `COPY content/*.json content/`:

```dockerfile
# UI5 (Ruling E16): the dialogue content the web bundle imports (lib/dialogue/content.ts).
COPY content/dialogue content/dialogue
```

`web/e2e/helpers.ts` (UI5 section):

```ts
import camp from '../../content/dialogue/camp.json';
import library from '../../content/dialogue/library.json';
import delphi from '../../content/dialogue/delphi.json';
import war from '../../content/dialogue/war.json';
import nest from '../../content/dialogue/nest.json';
import cabin from '../../content/dialogue/cabin.json';
import battle from '../../content/dialogue/battle.json';

const CONTENT_LINES: Record<string, { text: string }[]> = Object.assign(
  {},
  ...[camp, library, delphi, war, nest, cabin, battle].map((f) => (f as { lines: object }).lines),
);

const spaced = (t: string) => t.replace(/[ \u00a0]+([:;!?»])/g, '\u202f$1').replace(/«[ \u00a0]+/g, '«\u202f');

/** The dialogue box (or a voice plate) says one of `key`'s variants (the pick is random, Ruling E11). */
export async function expectLineOf(box: Locator, key: string, vars: Record<string, string> = {}) {
  await expect(box).toHaveAttribute('data-key', key);
  const fill = (t: string) => t.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
  const variants = (CONTENT_LINES[key] ?? []).map((l) => spaced(fill(l.text)));
  expect(variants.length, key).toBeGreaterThan(0);
  const text = box.getByTestId('dialogue-text').or(box.locator('.voice-text'));
  await expect.poll(async () => variants.includes(((await text.first().textContent()) ?? '').trim())).toBe(true);
}
```

(Keep `spaced` identical to `frenchSpacing`; a comment says so. If `import … .json` from `../../content` trips the e2e tsconfig, add `"../content/dialogue/*.json"` to `tsconfig.e2e.json`'s `include`.)

- [ ] **Step 10: Run the tests and the gate**

Run: `scripts/npm.sh run test -- src/lib/dialogue src/lib/tours src/lib/text src/lib/scene src/lib/world src/lib/battle src/registerGuard.test.ts src/noGuilt.test.ts src/noEmoji.test.ts src/formPlural.test.ts`
Expected: PASS (paste the counts).
Run: `scripts/npm.sh run check` — Expected: `0 errors and 0 warnings`.
Run: `PW_WORKERS=4 scripts/check.sh` — Expected: `== ALL GREEN` (the docker build proves the Dockerfile line; e2e unchanged in behaviour).

- [ ] **Step 11: Commit**

```bash
git add content/dialogue web/src/lib/dialogue web/src/lib/tours web/src/lib/text web/src/testing/copyRules.ts web/src/registerGuard.test.ts web/src/noGuilt.test.ts web/src/lib/battle web/src/lib/scene web/src/lib/world web/src/components/scene/SceneStage.svelte Dockerfile web/e2e/helpers.ts
git commit -m "UI5 Task 2: dialogue foundation - every line in content/dialogue, loader and checks, the selector (no immediate repeat), speakers, battle keys, six tours and their seen flags, frenchSpacing, shared copy rules

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- content/dialogue web/src/lib/dialogue web/src/lib/tours web/src/lib/text web/src/testing/copyRules.ts web/src/registerGuard.test.ts web/src/noGuilt.test.ts web/src/lib/battle web/src/lib/scene web/src/lib/world web/src/components/scene/SceneStage.svelte Dockerfile web/e2e/helpers.ts
```

(Add `web/tsconfig.e2e.json` to both lists if you changed it.)

---

### Task 3: Audio sourcing — candidates (checkpoint), then download, transcode, loudness, loops, credits, budget (lane S)

**Files:**
- Create: `tools/audio/Dockerfile`, `tools/audio/run_docker.sh`, `tools/audio/process.py`, `tools/audio/sources.json`, `docs/audio/candidates.md`
- Create: `web/public/audio/music/{sea,camp,temple,lair,battle}.m4a`, `web/public/audio/sfx/{tap,seal,unroll,chime,growth,hmpf,laurel,strike,fanfare}.m4a`, `web/src/lib/audio/assets.test.ts`
- Modify: `web/src/lib/audio/meta.gen.json` (generated), `web/src/lib/audio/catalog.ts` (only the `mix` values, by ear), `ASSETS-LICENSES.md` (generated section), `.gitignore` (`assets/audio/staging/`)

**Interfaces:**
- Consumes: `TRACKS`, `SFX`, the budgets (`catalog.ts`).
- Produces: the fourteen `.m4a` files at the catalogue's paths; `meta.gen.json` = `{ "<track>": { "samples": n, "rate": 44100, "priming": 1024 } }`; `ASSETS-LICENSES.md` section `## Sounds` between `<!-- audio:start -->` and `<!-- audio:end -->`.

**The slots (what each file must be):**

| Slot | Brief | Length |
|---|---|---|
| `music/sea` | sea wind at dusk by the gates: soft surf far below, wind, no gulls crying, no voice | loop 45–90 s |
| `music/camp` | a camp fire at night: gentle crackle, crickets, maybe a faint plucked string far away | loop 45–90 s |
| `music/temple` | temple air: wind through columns, a low warm drone or faint chimes, calm | loop 45–90 s |
| `music/lair` | Éris's lair: low ominous drone, slow bubbling, faint wind; unsettling, never scary | loop 45–90 s |
| `music/battle` | a light rhythmic loop (hand drums, plucked strings), energetic but not aggressive (she writes under it, ducked) | loop 45–90 s |
| `sfx/tap` | a soft wooden or paper click | ≤ 0.15 s |
| `sfx/seal` | a wax seal cracking | ≤ 0.5 s |
| `sfx/unroll` | parchment unrolling | ≤ 0.8 s |
| `sfx/chime` | a small bright bell or chime | ≤ 1.2 s |
| `sfx/growth` | a rising shimmer (the dragon grows) | ≤ 1.5 s |
| `sfx/hmpf` | Éris displeased: a muted low comic horn or bassoon "womp" (no voice) | ≤ 0.8 s |
| `sfx/laurel` | leaves rustling with a tiny chime | ≤ 1 s |
| `sfx/strike` | a soft blow on a bronze shield | ≤ 0.5 s |
| `sfx/fanfare` | a short victory jingle | ≤ 2.5 s |

**Where to look (CC0 only, Ruling E17):** Kenney's audio packs (each zip ships a `License.txt` stating CC0): « RPG Audio », « Interface Sounds », « UI Audio », « Impact Sounds », « Music Jingles » (kenney.nl/assets/…); OpenGameArt entries whose licence field reads « CC0 » (search with the licence filter; never « CC-BY », « OGA-BY », « GPL »); freesound sounds whose licence reads « Creative Commons 0 » (search with the licence filter). Anything else is out, whatever a page's text claims elsewhere.

- [ ] **Step 1: The tools**

`tools/audio/Dockerfile`:

```dockerfile
# ffmpeg for tools/audio/process.py, never on the host and never in the app image (UI5 Task 3).
FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /work
```

`tools/audio/run_docker.sh`:

```sh
#!/usr/bin/env sh
# Runs tools/audio/process.py in a throwaway container with ffmpeg (image discorde-audio-tools, built
# once from tools/audio/Dockerfile); nothing is installed on the host. Works from Git Bash on Windows
# (MSYS_NO_PATHCONV stops the path mangling of the -v argument). Holds the machine-wide Playwright
# lock while ffmpeg runs: its CPU burst starves the e2e browsers (Rulings W-e, F4).
#
#   tools/audio/run_docker.sh measure assets/audio/staging/<file>   # duration, loudness, true peak
#   tools/audio/run_docker.sh build [slot ...]                       # all slots when none given
#   tools/audio/run_docker.sh credits                                # rewrites ASSETS-LICENSES.md's sound section
set -eu
REPO=$(cd "$(dirname "$0")/../.." && (pwd -W 2>/dev/null || pwd))
IMAGE=discorde-audio-tools:1
docker image inspect "$IMAGE" >/dev/null 2>&1 || docker build -t "$IMAGE" "$REPO/tools/audio"
# The lock helper scripts/playwright.sh uses (read it: source scripts/lib.sh and call the same
# acquire/release functions; do not copy the lock logic).
. "$(dirname "$0")/../../scripts/lib.sh"
with_playwright_lock MSYS_NO_PATHCONV=1 docker run --rm -v "$REPO:/work" -w /work "$IMAGE" python tools/audio/process.py "$@"
```

(If `lib.sh` has no single "run under the lock" function, add one there, used by both `playwright.sh` and this script, with a test in the style of the lock's existing tests.)

`tools/audio/process.py` (stdlib only):

```python
"""UI5 audio pipeline (Ruling E17): trims each CC0 source, crossfades a loop's seam, normalises its
loudness, encodes AAC-LC 96 kbps .m4a, records each loop's exact length for the runtime loop region
(web/src/lib/audio/meta.gen.json) and writes the credits into ASSETS-LICENSES.md. Runs in the
tools/audio container (run_docker.sh); sources are listed in tools/audio/sources.json."""
from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCES = ROOT / "tools/audio/sources.json"
OUT = ROOT / "web/public/audio"
META = ROOT / "web/src/lib/audio/meta.gen.json"
LICENSES = ROOT / "ASSETS-LICENSES.md"
RATE = 44100
PRIMING = 1024  # ffmpeg's native AAC encoder priming, in samples
TARGET = {"music": -18.0, "sfx": -16.0}
TRUE_PEAK = -1.5


def run(args: list[str]) -> str:
    p = subprocess.run(args, capture_output=True, text=True)
    if p.returncode != 0:
        sys.exit(f"ffmpeg failed: {' '.join(args)}\n{p.stderr[-2000:]}")
    return p.stderr


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def duration(path: Path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                         capture_output=True, text=True, check=True).stdout
    return float(out.strip())


def loudness(path: Path) -> tuple[float, float]:
    """Integrated loudness (LUFS) and true peak (dBTP). A clip under 3 s is measured over a 3 s
    repetition of itself (EBU R128 gates in 400 ms blocks; a lone 0.1 s click has no integrated value)."""
    short = duration(path) < 3
    pre = ["-stream_loop", "40"] if short else []
    err = run(["ffmpeg", "-hide_banner", "-nostats", *pre, "-i", str(path), *(["-t", "3"] if short else []),
               "-af", "ebur128=peak=true", "-f", "null", "-"])
    i = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", err)[-1])
    tp = float(re.findall(r"Peak:\s+(-?[\d.]+) dBFS", err)[-1])
    return i, tp


def build(slot: str, s: dict) -> dict:
    kind, name = slot.split("/")
    src = ROOT / s["file"]
    if sha256(src) != s["sha256"]:
        sys.exit(f"{slot}: {s['file']} does not match its recorded sha256")
    channels = "2" if kind == "music" else "1"
    with tempfile.TemporaryDirectory() as tmp:
        cut = Path(tmp) / "cut.wav"
        trim = ["-ss", str(s.get("start", 0)), "-t", str(s["duration"])]
        if kind == "music":
            x = float(s.get("xfade", 3.0))
            # Seam: the loop's tail fades into its own head, so its end leads straight back to its start
            # (output = body[x:], ending with head[0:x] crossfaded in).
            graph = (f"[0:a]aresample={RATE},asplit=2[a][b];"
                     f"[a]atrim=0:{x},asetpts=PTS-STARTPTS[head];"
                     f"[b]atrim={x},asetpts=PTS-STARTPTS[body];"
                     f"[body][head]acrossfade=d={x}:c1=tri:c2=tri[out]")
            run(["ffmpeg", "-hide_banner", "-y", *trim, "-i", str(src), "-filter_complex", graph, "-map", "[out]",
                 "-ac", channels, "-c:a", "pcm_s16le", str(cut)])
        else:
            run(["ffmpeg", "-hide_banner", "-y", *trim, "-i", str(src), "-ar", str(RATE), "-ac", channels,
                 "-af", "afade=t=out:st={:.3f}:d=0.02".format(max(0.0, float(s["duration"]) - 0.02)),
                 "-c:a", "pcm_s16le", str(cut)])
        i, _ = loudness(cut)
        gain = TARGET[kind] - i
        norm = Path(tmp) / "norm.wav"
        run(["ffmpeg", "-hide_banner", "-y", "-i", str(cut), "-af",
             f"volume={gain:.2f}dB,alimiter=limit={10 ** (TRUE_PEAK / 20):.4f}:level=0",
             "-c:a", "pcm_s16le", str(norm)])
        with wave.open(str(norm)) as w:
            samples, rate = w.getnframes(), w.getframerate()
        dest = OUT / kind / f"{name}.m4a"
        dest.parent.mkdir(parents=True, exist_ok=True)
        run(["ffmpeg", "-hide_banner", "-y", "-i", str(norm), "-c:a", "aac", "-b:a", "96k",
             "-movflags", "+faststart", "-map_metadata", "-1", str(dest)])
    li, tp = loudness(dest)
    print(f"{slot:14} {dest.stat().st_size / 1024:7.1f} KiB  {samples / rate:6.2f} s  {li:6.1f} LUFS  {tp:5.1f} dBTP")
    return {"samples": samples, "rate": rate, "priming": PRIMING} if kind == "music" else {}


def credits(sources: dict) -> None:
    rows = ["| File | Source | Author | Licence | Changes |", "|---|---|---|---|---|"]
    for slot, s in sorted(sources.items()):
        rows.append(f"| `web/public/audio/{slot}.m4a` | [{s['title']}]({s['url']}) | {s['author']} | "
                    f"[{s['license']}]({s['license_url']}) | trimmed, {'loop seam crossfaded, ' if slot.startswith('music') else ''}"
                    f"loudness normalised, AAC 96 kbps |")
    section = "\n".join(["<!-- audio:start -->", "## Sounds (scenes UI spec §7)", "",
                         "Every sound is CC0 (public domain dedication); credited here anyway, with where it came from.",
                         "", *rows, "<!-- audio:end -->"])
    text = LICENSES.read_text(encoding="utf-8")
    text = (re.sub(r"<!-- audio:start -->.*<!-- audio:end -->", section, text, flags=re.S)
            if "<!-- audio:start -->" in text else text.rstrip() + "\n\n" + section + "\n")
    LICENSES.write_text(text, encoding="utf-8")


def main() -> None:
    cmd, *args = sys.argv[1:] or ["build"]
    sources = json.loads(SOURCES.read_text(encoding="utf-8"))
    if cmd == "measure":
        for a in args:
            i, tp = loudness(ROOT / a)
            print(f"{a}: {duration(ROOT / a):.2f} s, {i:.1f} LUFS, {tp:.1f} dBTP")
    elif cmd == "build":
        meta = json.loads(META.read_text(encoding="utf-8")) if META.exists() else {}
        for slot in args or sorted(sources):
            m = build(slot, sources[slot])
            if m:
                meta[slot.split("/")[1]] = m
        META.write_text(json.dumps(meta, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    elif cmd == "credits":
        credits(sources)
    else:
        sys.exit("usage: process.py measure <files> | build [slots] | credits")


if __name__ == "__main__":
    main()
```

`.gitignore`: add

```
# UI5 Task 3: downloaded audio sources (tools/audio/sources.json records each URL and sha256). Never committed.
assets/audio/staging/
```

- [ ] **Step 2 (3a): Find candidates, check each licence, list them — CHECKPOINT**

For each of the fourteen slots find two or three candidates. For each: open the source page (WebFetch), read its licence where the page states it (Kenney: the pack page and the zip's `License.txt`; OpenGameArt: the entry's « License(s) » field; freesound: the sound page's licence badge), and quote it. Download the candidate into `assets/audio/staging/` with `curl -L -o` (Kenney: the pack zip, unzipped; freesound without a login: the page's HQ preview mp3, Ruling E17; OpenGameArt: the attached file). Measure it (`tools/audio/run_docker.sh measure assets/audio/staging/<file>`). Write `docs/audio/candidates.md`: per slot, a table (candidate, title, author, page URL, licence URL, the licence quote and the date read, duration, measured loudness, which excerpt you would use: start and duration, and one line on why it fits the brief). Reject anything whose licence you cannot read on the page, anything CC-BY or stricter, anything with a voice, anything that sounds like a phone or a modern device.

Commit only the list:

```bash
git add docs/audio/candidates.md .gitignore tools/audio
git commit -m "UI5 Task 3a: audio tools and the candidate list for the controller's review

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- docs/audio/candidates.md .gitignore tools/audio
```

**Then STOP and report** (the list's path, a one-line summary per slot, anything you could not fill). The controller reviews the list; whether the user listens to the candidates first is **the user's decision** (the controller asks). You are resumed with the chosen candidate per slot (and any freesound original the user downloaded with their account).

- [ ] **Step 3 (3b): Build**

Write `tools/audio/sources.json` for the chosen candidates (schema: `file`, `sha256`, `title`, `author`, `url`, `license` (« CC0 1.0 »), `license_url` (« https://creativecommons.org/publicdomain/zero/1.0/ »), `evidence` (the quote and date), `start`, `duration`, `xfade` (music, 2–4 s)). Run `tools/audio/run_docker.sh build`. Check the summary: every loop 45–90 s, ≈ −18 LUFS; every effect ≈ −16 LUFS; true peaks ≤ −1.5 dBTP; sizes within the budget. Listen for the seam where you can (decode `web/public/audio/music/<id>.m4a` twice end to end with ffmpeg's `concat` into the staging dir and measure a silence gap with `silencedetect=n=-60dB:d=0.02`: none may be reported at the seam). Set each sound's `mix` in `catalog.ts` only if a sound is clearly out of balance with the others (say which and why). Run `tools/audio/run_docker.sh credits`.

- [ ] **Step 4: The budget and credit test**

`web/src/lib/audio/assets.test.ts`:

```ts
// UI5 Ruling E17: the camp's sounds are the catalogue's, AAC in .m4a, within budget, each with its
// length known and its CC0 source credited.
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import META from './meta.gen.json';
import { LOOP_MAX_S, LOOP_MIN_S, MUSIC_BUDGET_BYTES, SFX, SFX_BUDGET_BYTES, SFX_MAX_BYTES, TRACKS, TRACK_MAX_BYTES } from './catalog';

const file = (src: string) => `public${src}`;
const size = (src: string) => statSync(file(src)).size;

describe('the audio files (spec §7)', () => {
  it('ships every catalogued sound as an MP4/AAC file, and nothing else', () => {
    for (const d of [...Object.values(TRACKS), ...Object.values(SFX)]) {
      expect(existsSync(file(d.src)), d.src).toBe(true);
      expect(readFileSync(file(d.src)).subarray(4, 8).toString('latin1'), d.src).toBe('ftyp');
    }
    const shipped = ['music', 'sfx'].flatMap((k) => readdirSync(`public/audio/${k}`).map((f) => `/audio/${k}/${f}`)).sort();
    expect(shipped).toEqual([...Object.values(TRACKS), ...Object.values(SFX)].map((d) => d.src).sort());
  });

  it('keeps the music within 8 MiB (each loop within 2 MiB) and the effects small', () => {
    const music = Object.values(TRACKS).map((d) => size(d.src));
    for (const [i, d] of Object.values(TRACKS).entries()) expect(music[i], d.src).toBeLessThanOrEqual(TRACK_MAX_BYTES);
    expect(music.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(MUSIC_BUDGET_BYTES);
    const fx = Object.values(SFX).map((d) => size(d.src));
    for (const [i, d] of Object.values(SFX).entries()) expect(fx[i], d.src).toBeLessThanOrEqual(SFX_MAX_BYTES);
    expect(fx.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(SFX_BUDGET_BYTES);
  });

  it("knows each loop's exact length, between 30 and 90 s", () => {
    const meta = META as Record<string, { samples: number; rate: number; priming: number }>;
    expect(Object.keys(meta).sort()).toEqual(Object.keys(TRACKS).sort());
    for (const [id, m] of Object.entries(meta)) {
      expect(m.rate, id).toBe(44100);
      expect(m.priming, id).toBe(1024);
      expect(m.samples / m.rate, id).toBeGreaterThanOrEqual(LOOP_MIN_S);
      expect(m.samples / m.rate, id).toBeLessThanOrEqual(LOOP_MAX_S);
    }
  });

  it('credits every file with its CC0 source (ASSETS-LICENSES.md, tools/audio/sources.json)', () => {
    const credits = readFileSync('../ASSETS-LICENSES.md', 'utf-8');
    const sources = JSON.parse(readFileSync('../tools/audio/sources.json', 'utf-8')) as Record<string, Record<string, string>>;
    for (const d of [...Object.values(TRACKS), ...Object.values(SFX)]) {
      expect(credits, d.src).toContain(`web/public${d.src}`);
      const s = sources[d.src.replace('/audio/', '').replace('.m4a', '')];
      expect(s, d.src).toBeDefined();
      expect(s.license, d.src).toBe('CC0 1.0');
      for (const k of ['url', 'author', 'title', 'evidence', 'sha256']) expect(s[k], `${d.src} ${k}`).toBeTruthy();
    }
    expect(credits).not.toMatch(/Audio credits \(scenes UI spec §7\) are added\s+in UI5/);
  });
});
```

`ASSETS-LICENSES.md`'s header paragraph: drop « Audio credits (scenes UI spec §7) are added in UI5. » (the generated section is there now).

- [ ] **Step 5: Run**

Run: `STACK=sound scripts/npm.sh run test` (the whole vitest suite: the lane changed shipped files) — Expected: PASS (paste counts). Run: `STACK=sound scripts/npm.sh run check` — Expected: `0 errors and 0 warnings`. The lane runs no Playwright and no image build: the controller's merged gate builds the image with the files. Report the final sizes, lengths and loudness table (the `build` summary).

- [ ] **Step 6: Commit**

```bash
git add tools/audio web/public/audio web/src/lib/audio/meta.gen.json web/src/lib/audio/assets.test.ts web/src/lib/audio/catalog.ts ASSETS-LICENSES.md
git commit -m "UI5 Task 3b: the camp's CC0 sounds - five loops and nine effects, trimmed, seamless, normalised, AAC .m4a, credited, within budget

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- tools/audio web/public/audio web/src/lib/audio/meta.gen.json web/src/lib/audio/assets.test.ts web/src/lib/audio/catalog.ts ASSETS-LICENSES.md
```

---

### Task 4: The mixer — engine, loop region, Howler and recording backends, the singleton and its page lifecycle (lane A)

**Files:**
- Create: `web/src/lib/audio/{engine,loop,howlerBackend,recordingBackend}.ts`, `audio.svelte.ts`, `engine.test.ts`, `loop.test.ts`, `howlerBackend.test.ts`, `web/src/audioGuards.test.ts`
- Modify: `web/src/lib/juice/sfx.ts` (façade), `web/src/lib/juice/sfx.test.ts` (rewritten), `web/src/main.ts`

**Interfaces:**
- Consumes: `TRACKS`, `SFX`, `TrackId`, `SfxId`, `AudioSettings`, `DEFAULT_AUDIO`, `gainOf`, `snapshotAudio`, `meta.gen.json` (`{}` until lane S merges: `loopRegion` then loops the whole buffer).
- Produces: `createEngine(backend, now?)` → `AudioEngine` { `unlock`, `poke`, `visibility`, `setSettings`, `music`, `scene`, `duck`, `voice`, `sfx`, `snapshot` }; `AudioBackend`, `TrackHandle`, `ContextState`, `AudioSnapshot`, `DuckReason`, `DUCK_GAIN`, `FADE_MS`, `CROSSFADE_MS`, `SFX_REPEAT_MS`; `loopRegion(bufferSeconds, meta)`; `howlerBackend()`; `recordingBackend()`; `audio()`, `installAudio()`.

- [ ] **Step 1: Write the failing tests**

`web/src/lib/audio/engine.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CROSSFADE_MS, DUCK_GAIN, FADE_MS, SFX_REPEAT_MS, createEngine } from './engine';
import { recordingBackend } from './recordingBackend';
import { DEFAULT_AUDIO, type AudioSettings } from './settings';

const with_ = (patch: Partial<Record<keyof AudioSettings, Partial<AudioSettings['music']>>>): AudioSettings => {
  const s = JSON.parse(JSON.stringify(DEFAULT_AUDIO)) as AudioSettings;
  for (const [k, v] of Object.entries(patch)) Object.assign(s[k as keyof AudioSettings], v);
  return s;
};

function setup() {
  const backend = recordingBackend();
  let t = 1000;
  const engine = createEngine(backend, () => t);
  return { backend, engine, later: (ms: number) => (t += ms) };
}
const live = (b: ReturnType<typeof recordingBackend>) => b.log.tracks.filter((x) => !x.stopped).map((x) => x.id);

describe('the mixer (spec §7)', () => {
  it('plays nothing before the unlock gesture, then the loop the place asked for (Ruling E3)', () => {
    const { backend, engine } = setup();
    engine.scene('camp');
    engine.sfx('tap');
    expect(backend.log.tracks).toEqual([]);
    expect(backend.log.sfx).toEqual([]);
    expect(engine.snapshot()).toMatchObject({ unlocked: false, wanted: 'camp', playing: null });
    engine.unlock();
    expect(backend.log.state).toBe('running');
    expect(backend.log.calls).toContain(`start camp 0.5 ${CROSSFADE_MS}`);
    expect(engine.snapshot()).toMatchObject({ unlocked: true, playing: 'camp' });
    engine.unlock();
    expect(live(backend)).toEqual(['camp']);
  });

  it('crossfades to the next loop, one loop at a time (Ruling E4)', () => {
    const { backend, engine } = setup();
    engine.unlock();
    engine.scene('camp');
    engine.scene('temple');
    expect(backend.log.calls.slice(-2)).toEqual([`stop camp ${CROSSFADE_MS}`, `start temple 0.5 ${CROSSFADE_MS}`]);
    expect(live(backend)).toEqual(['temple']);
    engine.scene('temple');
    expect(backend.log.tracks).toHaveLength(2);
  });

  it('stops the music when muted and brings it back when unmuted', () => {
    const { backend, engine } = setup();
    engine.unlock();
    engine.scene('sea');
    engine.setSettings(with_({ music: { muted: true } }));
    expect(live(backend)).toEqual([]);
    expect(engine.snapshot().playing).toBeNull();
    engine.setSettings(with_({ music: { muted: false, volume: 0.8 } }));
    expect(live(backend)).toEqual(['sea']);
    expect(backend.log.tracks.at(-1)!.gain).toBeCloseTo(0.8);
  });

  it('ducks under the voice, the dictation and the proofreading, until every reason is gone (Ruling E5)', () => {
    const { backend, engine } = setup();
    engine.unlock();
    engine.music('battle');
    const full = 0.5 * 0.9;
    engine.duck('dictation', true);
    expect(backend.log.calls.at(-1)).toBe(`fade battle ${full * DUCK_GAIN} ${FADE_MS}`);
    engine.voice(true);
    engine.duck('dictation', false);
    expect(engine.snapshot()).toMatchObject({ ducks: ['voice'], voiceSpeaking: true });
    expect(backend.log.tracks[0].gain).toBeCloseTo(full * DUCK_GAIN);
    engine.voice(false);
    expect(backend.log.tracks[0].gain).toBeCloseTo(full);
    engine.duck('proofreading', true);
    engine.duck('proofreading', true);
    // dictation on, voice on, dictation off, voice off, proofreading on; the second « on » is a no-op.
    expect(backend.log.calls.filter((c) => c.startsWith('fade')).length).toBe(5);
  });

  it('clears the battle\'s ducks and the voice when a place takes over', () => {
    const { backend, engine } = setup();
    engine.unlock();
    engine.music('battle');
    engine.duck('proofreading', true);
    engine.voice(true);
    engine.scene('camp');
    expect(engine.snapshot()).toMatchObject({ ducks: [], voiceSpeaking: false, playing: 'camp' });
    expect(backend.log.tracks.at(-1)!.gain).toBeCloseTo(0.5);
  });

  it('plays effects at their volume, never muted, never over the voice, never twice in 80 ms (Ruling E6)', () => {
    const { backend, engine, later } = setup();
    engine.unlock();
    engine.sfx('chime');
    expect(backend.log.sfx.at(-1)).toEqual({ id: 'chime', gain: 0.7 });
    engine.sfx('chime');
    later(SFX_REPEAT_MS);
    engine.sfx('chime');
    expect(backend.log.sfx.filter((s) => s.id === 'chime')).toHaveLength(2);
    engine.voice(true);
    engine.sfx('tap');
    engine.voice(false);
    engine.setSettings(with_({ sfx: { muted: true } }));
    engine.sfx('seal');
    expect(backend.log.sfx.map((s) => s.id)).toEqual(['chime', 'chime']);
    expect(engine.snapshot().sfx).toEqual(['chime', 'chime']);
    engine.setSettings(with_({ sfx: { volume: 0.5 } }));
    engine.sfx('tap');
    expect(backend.log.sfx.at(-1)).toEqual({ id: 'tap', gain: 0.5 * 0.6 });
  });

  it('suspends when the page hides and resumes when it shows or on the next tap (iPad)', () => {
    const { backend, engine } = setup();
    engine.visibility(true);
    engine.poke();
    expect(backend.log.calls).toEqual([]);
    engine.unlock();
    engine.visibility(true);
    expect(backend.log.state).toBe('suspended');
    engine.visibility(false);
    expect(backend.log.state).toBe('running');
    backend.log.state = 'interrupted';
    engine.poke();
    expect(backend.log.state).toBe('running');
  });
});
```

`web/src/lib/audio/loop.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { loopRegion } from './loop';

const meta = { samples: 60 * 44100, rate: 44100, priming: 1024 };

describe('the loop region (Ruling E9)', () => {
  it('loops the whole buffer when the browser dropped the encoder priming, or when the length is unknown', () => {
    expect(loopRegion(60, meta)).toEqual([0, 60]);
    expect(loopRegion(59.999, meta)).toEqual([0, 59.999]);
    expect(loopRegion(12.5, undefined)).toEqual([0, 12.5]);
  });

  it('skips the priming and stops before the padding when the browser kept them', () => {
    const [start, length] = loopRegion(60 + (1024 + 900) / 44100, meta);
    expect(start).toBeCloseTo(1024 / 44100, 6);
    expect(length).toBeCloseTo(60, 6);
  });
});
```

`web/src/lib/audio/howlerBackend.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { FakeHowl, made, ctx } = vi.hoisted(() => {
  const made: InstanceType<typeof FakeHowl>[] = [];
  const ctx = { state: 'suspended', resume: vi.fn(async () => void (ctx.state = 'running')), suspend: vi.fn(async () => void (ctx.state = 'suspended')) };
  class FakeHowl {
    handlers = new Map<string, ((id?: number) => void)[]>();
    calls: string[] = [];
    vol = 1;
    constructor(public opts: { src: string[]; sprite?: Record<string, [number, number, boolean?]>; html5?: boolean }) {
      made.push(this);
    }
    once(ev: string, fn: () => void) {
      this.handlers.set(ev, [...(this.handlers.get(ev) ?? []), fn]);
      return this;
    }
    emit(ev: string) {
      const fns = this.handlers.get(ev) ?? [];
      this.handlers.delete(ev);
      fns.forEach((f) => f());
    }
    duration() {
      return 60 + 2048 / 44100;
    }
    play(sprite?: string) {
      this.calls.push(`play ${sprite ?? ''}`.trim());
      return 7;
    }
    fade(from: number, to: number, ms: number) {
      this.vol = to;
      this.calls.push(`fade ${from}->${to} ${ms}`);
      return this;
    }
    // Howler: volume() and volume(soundId) read (an id is > 1); volume(v) and volume(v, id) set.
    volume(v?: number, id?: number) {
      if (v === undefined || (id === undefined && v > 1)) return this.vol;
      this.vol = v;
      this.calls.push(`volume ${v}`);
      return this;
    }
    unload() {
      this.calls.push('unload');
    }
  }
  return { FakeHowl, made, ctx };
});
vi.mock('howler', () => ({ Howl: FakeHowl, Howler: { ctx } }));
vi.mock('./meta.gen.json', () => ({ default: { camp: { samples: 60 * 44100, rate: 44100, priming: 1024 } } }));

import { howlerBackend } from './howlerBackend';

beforeEach(() => void (made.length = 0));

describe('the Howler backend (iPad Safari, Rulings E3 and E9)', () => {
  it('builds the loop from a probe once its length is known, skipping the priming, and fades it in', () => {
    const b = howlerBackend();
    const h = b.track('camp');
    h.start(0.4, 1200);
    expect(made).toHaveLength(1);
    made[0].emit('load');
    const loop = made[1];
    expect(loop.opts.src).toEqual(['/audio/music/camp.m4a']);
    expect(loop.opts.html5).toBeFalsy();
    const [start, length, looped] = loop.opts.sprite!.loop;
    expect(start).toBeCloseTo((1024 / 44100) * 1000, 3);
    expect(length).toBeCloseTo(60000, 3);
    expect(looped).toBe(true);
    expect(loop.calls).toEqual(['play loop', 'fade 0->0.4 1200']);
  });

  it('fades out, then frees the loop and its probe; a loop stopped while loading never plays', () => {
    const b = howlerBackend();
    const h = b.track('camp');
    h.start(0.5, 1200);
    made[0].emit('load');
    h.stop(1200);
    expect(made[1].calls.at(-1)).toBe('fade 0.5->0 1200');
    made[1].emit('fade');
    expect(made[1].calls.at(-1)).toBe('unload');
    expect(made[0].calls.at(-1)).toBe('unload');
    const early = b.track('camp');
    early.stop(1200);
    made[2].emit('load');
    expect(made).toHaveLength(3);
    expect(made[2].calls).toEqual(['unload']);
  });

  it('plays an effect at its gain, preloads the effects once, and drives the one context', () => {
    const b = howlerBackend();
    b.warm();
    const n = made.length;
    b.warm();
    expect(made.length).toBe(n);
    b.sfx('tap', 0.3);
    expect(made.find((m) => m.opts.src[0] === '/audio/sfx/tap.m4a')!.calls).toEqual(['play', 'volume 0.3']);
    b.resume();
    expect(ctx.resume).toHaveBeenCalled();
    expect(b.state()).toBe('running');
    b.suspend();
    expect(ctx.suspend).toHaveBeenCalled();
  });
});
```

`web/src/audioGuards.test.ts`:

```ts
// UI5 (spec §7, iPad Safari): one AudioContext (Howler's), Web Audio only (iOS ignores an HTML media
// element's volume, so ducking would fail silently), and no audio code reads reduced motion (sound is
// not motion; spec §4's rule leaves it alone).
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n).replaceAll('\\', '/');
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|svelte)$/.test(n) && !n.endsWith('.test.ts')) out.push(p);
  }
  return out;
}
const files = walk('src');

describe('audio on the iPad', () => {
  it('never builds its own AudioContext', () => {
    expect(files.filter((f) => /new\s+(webkit)?AudioContext\b|webkitAudioContext/.test(readFileSync(f, 'utf-8')))).toEqual([]);
  });
  it('never plays through an HTML media element', () => {
    expect(files.filter((f) => /html5\s*:\s*true|new\s+Audio\(/.test(readFileSync(f, 'utf-8')))).toEqual([]);
  });
  it('leaves reduced motion to the eyes', () => {
    expect(walk('src/lib/audio').filter((f) => /reducedMotion|prefers-reduced-motion/.test(readFileSync(f, 'utf-8')))).toEqual([]);
  });
});
```

`web/src/lib/juice/sfx.test.ts` (rewritten):

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { playSfx, unlockAudio } from './sfx';
import { audio } from '../audio/audio.svelte';

describe('the effects façade (Ruling E1)', () => {
  beforeEach(() => audio().scene(null));
  it('keeps the screens\' two calls and routes them to the mixer', () => {
    playSfx('tap');
    expect(audio().snapshot().sfx).not.toContain('tap');
    unlockAudio();
    playSfx('seal');
    expect(audio().snapshot()).toMatchObject({ unlocked: true });
    expect(audio().snapshot().sfx.at(-1)).toBe('seal');
  });
});
```

- [ ] **Step 2: `lib/audio/loop.ts`**

```ts
// Seamless loops (Ruling E9): the AAC encoder puts 1024 samples of priming before the audio and some
// padding after it. A browser that honours the file's edit list drops them; one that does not keeps
// them, and a plain loop would click and gap at the seam. Task 3 records each loop's exact length.
export interface LoopMeta {
  samples: number;
  rate: number;
  priming: number;
}

/** [start, length] of the loop in the decoded buffer, in seconds. */
export function loopRegion(bufferSeconds: number, meta: LoopMeta | undefined): [number, number] {
  if (!meta) return [0, bufferSeconds];
  const length = meta.samples / meta.rate;
  if (bufferSeconds <= length + 0.005) return [0, Math.min(length, bufferSeconds)];
  const priming = meta.priming / meta.rate;
  return [priming, Math.min(length, bufferSeconds - priming)];
}
```

- [ ] **Step 3: `lib/audio/engine.ts`**

```ts
// The mixer (scenes UI spec §7, Rulings E3-E6): one loop at a time on the music channel, short
// effects on the sfx channel, and the voice (speechSynthesis, played elsewhere) only signalled here,
// so the music ducks under it and no effect talks over it. Backend-agnostic: Howler in the browser
// (howlerBackend.ts), a recorder in vitest and in every e2e run (recordingBackend.ts). Nothing plays
// before `unlock()`, which a tap calls (iOS only lets a gesture start audio); a loop asked for
// earlier waits for it.
import { SFX, TRACKS, type SfxId, type TrackId } from './catalog';
import { DEFAULT_AUDIO, gainOf, type AudioSettings } from './settings';

export type DuckReason = 'voice' | 'dictation' | 'proofreading';
export type ContextState = 'running' | 'suspended' | 'interrupted' | 'closed' | 'none';

export const DUCK_GAIN = 0.3;
export const FADE_MS = 400;
export const CROSSFADE_MS = 1200;
export const SETTINGS_FADE_MS = 150;
export const SFX_REPEAT_MS = 80;

export interface TrackHandle {
  /** Starts the loop silent and fades it up to `gain` (at once if it is still loading: when ready). */
  start(gain: number, fadeMs: number): void;
  fadeTo(gain: number, fadeMs: number): void;
  /** Fades out, then stops and frees the loop (a loop still loading never starts). */
  stop(fadeMs: number): void;
}

export interface AudioBackend {
  track(id: TrackId): TrackHandle;
  sfx(id: SfxId, gain: number): void;
  /** Preloads the effects (after the unlock, so the first cue is not late). Idempotent. */
  warm(): void;
  resume(): void;
  suspend(): void;
  state(): ContextState;
}

export interface AudioSnapshot {
  unlocked: boolean;
  settings: AudioSettings;
  wanted: TrackId | null;
  playing: TrackId | null;
  musicGain: number;
  ducks: DuckReason[];
  voiceSpeaking: boolean;
  /** The last effects played (at most 50), oldest first. */
  sfx: SfxId[];
}

export function createEngine(backend: AudioBackend, now: () => number = () => Date.now()) {
  let unlocked = false;
  let settings: AudioSettings = DEFAULT_AUDIO;
  let wanted: TrackId | null = null;
  let current: { id: TrackId; handle: TrackHandle } | null = null;
  const ducks = new Set<DuckReason>();
  const played: SfxId[] = [];
  const lastPlayed = new Map<SfxId, number>();

  const gainFor = (id: TrackId): number => gainOf(settings.music) * TRACKS[id].mix * (ducks.size > 0 ? DUCK_GAIN : 1);

  function sync(fadeMs = FADE_MS): void {
    if (!unlocked) return;
    const target = settings.music.muted ? null : wanted;
    if (current && current.id !== target) {
      current.handle.stop(CROSSFADE_MS);
      current = null;
    }
    if (current) {
      current.handle.fadeTo(gainFor(current.id), fadeMs);
    } else if (target) {
      current = { id: target, handle: backend.track(target) };
      current.handle.start(gainFor(target), CROSSFADE_MS);
    }
  }

  function duck(reason: DuckReason, on: boolean): void {
    if (ducks.has(reason) === on) return;
    if (on) ducks.add(reason);
    else ducks.delete(reason);
    sync();
  }

  return {
    unlock(): void {
      if (!unlocked) backend.warm();
      backend.resume();
      if (unlocked) return;
      unlocked = true;
      sync();
    },
    /** A tap anywhere: the iPad may have suspended or interrupted the context meanwhile. */
    poke(): void {
      if (unlocked && backend.state() !== 'running') backend.resume();
    },
    visibility(hidden: boolean): void {
      if (!unlocked) return;
      if (hidden) backend.suspend();
      else backend.resume();
    },
    setSettings(next: AudioSettings): void {
      settings = next;
      sync(SETTINGS_FADE_MS);
    },
    /** The battle asks for its loop (the ducks stay: its phases own them). */
    music(id: TrackId | null): void {
      if (id === wanted) return;
      wanted = id;
      sync();
    },
    /** A place takes over (SceneStage): its loop, and no leftover duck from a battle or a speech. */
    scene(id: TrackId | null): void {
      const hadDucks = ducks.size > 0;
      ducks.clear();
      if (id !== wanted) {
        wanted = id;
        sync();
      } else if (hadDucks) {
        sync();
      }
    },
    duck,
    voice(speaking: boolean): void {
      duck('voice', speaking);
    },
    sfx(id: SfxId): void {
      if (!unlocked || settings.sfx.muted || ducks.has('voice')) return;
      const t = now();
      const last = lastPlayed.get(id);
      if (last !== undefined && t - last < SFX_REPEAT_MS) return;
      lastPlayed.set(id, t);
      backend.sfx(id, gainOf(settings.sfx) * SFX[id].mix);
      played.push(id);
      if (played.length > 50) played.shift();
    },
    snapshot(): AudioSnapshot {
      return {
        unlocked,
        settings: JSON.parse(JSON.stringify(settings)) as AudioSettings,
        wanted,
        playing: current?.id ?? null,
        musicGain: current ? gainFor(current.id) : 0,
        ducks: [...ducks].sort(),
        voiceSpeaking: ducks.has('voice'),
        sfx: [...played],
      };
    },
  };
}

export type AudioEngine = ReturnType<typeof createEngine>;
```

- [ ] **Step 4: The backends**

`lib/audio/recordingBackend.ts`:

```ts
// A backend that plays nothing and writes down what it was asked (Ruling E10): vitest's, and every
// e2e page's (window.__discordeAudioStub), whose engine state is read through window.__discordeAudio.
import type { AudioBackend, ContextState } from './engine';
import type { SfxId, TrackId } from './catalog';

export interface Recorded {
  calls: string[];
  tracks: { id: TrackId; gain: number; stopped: boolean }[];
  sfx: { id: SfxId; gain: number }[];
  state: ContextState;
}

export function recordingBackend(): AudioBackend & { log: Recorded } {
  const log: Recorded = { calls: [], tracks: [], sfx: [], state: 'suspended' };
  return {
    log,
    track(id) {
      const t = { id, gain: 0, stopped: false };
      log.tracks.push(t);
      return {
        start(gain, ms) {
          t.gain = gain;
          log.calls.push(`start ${id} ${gain} ${ms}`);
        },
        fadeTo(gain, ms) {
          t.gain = gain;
          log.calls.push(`fade ${id} ${gain} ${ms}`);
        },
        stop(ms) {
          t.gain = 0;
          t.stopped = true;
          log.calls.push(`stop ${id} ${ms}`);
        },
      };
    },
    sfx(id, gain) {
      log.sfx.push({ id, gain });
    },
    warm() {},
    resume() {
      log.state = 'running';
    },
    suspend() {
      log.state = 'suspended';
    },
    state: () => log.state,
  };
}
```

(`engine.test.ts`'s "suspends when the page hides" expects `calls` to stay empty before the unlock, so `resume`/`suspend` do not write to `calls`.)

`lib/audio/howlerBackend.ts`:

```ts
// The browser backend (Rulings E3, E9): Howler over Web Audio, whose single AudioContext is the only
// one in the app. A loop is loaded by a probe; once its decoded length is known, a sprite region
// (sample-accurate loopStart/loopEnd) skips the AAC priming when the browser kept it. The second
// Howl of the same file reuses Howler's decoded-buffer cache (no second fetch, no second decode).
import { Howl, Howler } from 'howler';
import META from './meta.gen.json';
import { SFX, SFX_IDS, TRACKS, type SfxId } from './catalog';
import { loopRegion, type LoopMeta } from './loop';
import type { AudioBackend, ContextState } from './engine';

export function howlerBackend(): AudioBackend {
  const effects = new Map<SfxId, Howl>();
  const effect = (id: SfxId): Howl => {
    let h = effects.get(id);
    if (!h) {
      h = new Howl({ src: [SFX[id].src], preload: true });
      effects.set(id, h);
    }
    return h;
  };

  return {
    track(id) {
      let loop: Howl | null = null;
      let sound: number | null = null;
      let target = 0;
      let fadeIn = 0;
      let gone = false;
      const probe = new Howl({ src: [TRACKS[id].src], preload: true });
      probe.once('load', () => {
        if (gone) {
          probe.unload();
          return;
        }
        const [start, length] = loopRegion(probe.duration(), (META as Record<string, LoopMeta>)[id]);
        loop = new Howl({ src: [TRACKS[id].src], sprite: { loop: [start * 1000, length * 1000, true] }, volume: 0 });
        sound = loop.play('loop');
        loop.fade(0, target, fadeIn, sound);
      });
      // A file that cannot load stays silent: sound is a convenience, never a blocker.
      probe.once('loaderror', () => undefined);
      return {
        start(gain, ms) {
          target = gain;
          fadeIn = ms;
        },
        fadeTo(gain, ms) {
          target = gain;
          if (loop && sound !== null) loop.fade(loop.volume(sound) as number, gain, ms, sound);
        },
        stop(ms) {
          gone = true;
          if (!loop || sound === null) return; // still loading: the load handler frees the probe
          const l = loop;
          const s = sound;
          l.once('fade', () => {
            l.unload();
            probe.unload();
          }, s);
          l.fade(l.volume(s) as number, 0, ms, s);
        },
      };
    },
    sfx(id, gain) {
      const h = effect(id);
      const s = h.play();
      h.volume(gain, s);
    },
    warm() {
      for (const id of SFX_IDS) effect(id);
    },
    resume() {
      void Howler.ctx?.resume?.().catch(() => undefined);
    },
    suspend() {
      void Howler.ctx?.suspend?.().catch(() => undefined);
    },
    state(): ContextState {
      return (Howler.ctx?.state as ContextState | undefined) ?? 'none';
    },
  };
}
```

(Match the fake's call order in `howlerBackend.test.ts` to Howler's real signatures: `fade(from, to, duration, id)`, `volume(vol, id)`, `once(event, fn, id)`. If `@types/howler` types `once`'s id differently, keep the runtime call and type it the way the typings allow, without a cast that svelte-check would warn about.)

- [ ] **Step 5: The singleton, the lifecycle, the façade**

`lib/audio/audio.svelte.ts`:

```ts
// The one mixer of the page (Ruling E1) and what keeps it in step with the page: the hero's channels,
// a hidden page (suspend), a shown page or a tap (resume, the iPad's `interrupted` state). In a
// browser it plays through Howler, unless an e2e page set __discordeAudioStub (Ruling E10): then it
// records, and publishes its state as window.__discordeAudio.
import { createEngine, type AudioEngine } from './engine';
import { howlerBackend } from './howlerBackend';
import { recordingBackend } from './recordingBackend';
import { snapshotAudio } from './store.svelte';

type TestWindow = Window & { __discordeAudioStub?: boolean; __discordeAudio?: { snapshot: AudioEngine['snapshot'] } };

let engine: AudioEngine | null = null;

export function audio(): AudioEngine {
  if (engine) return engine;
  const w = typeof window === 'undefined' ? null : (window as TestWindow);
  const recording = !w || w.__discordeAudioStub === true;
  const e = createEngine(recording ? recordingBackend() : howlerBackend());
  if (w && recording) w.__discordeAudio = { snapshot: () => e.snapshot() };
  engine = e;
  return e;
}

/** Called once from main.ts, before the app mounts. Returns its teardown (tests). */
export function installAudio(): () => void {
  const e = audio();
  const stopSync = $effect.root(() => {
    $effect(() => e.setSettings(snapshotAudio()));
  });
  const onVisibility = () => e.visibility(document.hidden);
  const onPoke = () => e.poke();
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pageshow', onVisibility);
  window.addEventListener('pointerdown', onPoke, { capture: true, passive: true });
  return () => {
    stopSync();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pageshow', onVisibility);
    window.removeEventListener('pointerdown', onPoke, { capture: true });
  };
}
```

`lib/juice/sfx.ts` (whole file):

```ts
// UI5 Ruling E1: the effects are CC0 recordings (lib/audio/catalog.ts) played by the one mixer. This
// module keeps the two calls the screens have always made. Both run inside a tap: `unlockAudio`
// first (iOS starts audio only from a gesture), then any `playSfx`.
import { audio } from '../audio/audio.svelte';
import type { SfxId } from '../audio/catalog';

export type Sfx = SfxId;

export function unlockAudio(): void {
  try {
    audio().unlock();
  } catch {
    // Sound is a convenience, never a blocker.
  }
}

export function playSfx(name: Sfx): void {
  try {
    audio().sfx(name);
  } catch {
    // Idem.
  }
}
```

`main.ts`: `import { installAudio } from './lib/audio/audio.svelte';` and `installAudio();` after `startRouter();`.

- [ ] **Step 6: Run**

Run: `scripts/npm.sh run test -- src/lib/audio src/lib/juice src/audioGuards.test.ts src/lib/scene/panelNav.test.ts`
Expected: PASS (paste counts; `panelNav.test.ts` imports `sfx.ts`: it must still pass under node with the recording backend).
Run: `scripts/npm.sh run check` — Expected: `0 errors and 0 warnings`.
Run once: `STACK=audio scripts/playwright.sh scenes-title scenes-camp` — Expected: PASS (the effects façade under the stub).

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/audio web/src/audioGuards.test.ts web/src/lib/juice web/src/main.ts
git commit -m "UI5 Task 4: the mixer - one loop at a time with crossfades, ducking reasons, effect rules, unlock state, Howler backend with seamless loop regions, recording backend, page lifecycle; sfx.ts becomes its facade

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/lib/audio web/src/audioGuards.test.ts web/src/lib/juice web/src/main.ts
```

---

### Task 5: Wiring the sound — places' loops, the battle's ducking, the voice, « La lyre », the HUD's sound plate (lane A)

**Files:**
- Create: `web/src/lib/audio/battleAudio.ts`, `battleAudio.test.ts`, `voice.ts`; `web/src/components/scene/SoundPlate.svelte`; `web/src/components/places/cabin/ChannelRow.svelte`; `web/e2e/scenes-audio.spec.ts`
- Modify: `web/src/lib/audio/audio.svelte.ts` (the battle listener), `web/src/lib/dictation/tts.ts` (+ `tts.test.ts`), `web/src/components/scene/SceneStage.svelte` (the loop), `web/src/components/scene/Hud.svelte`, `web/src/components/ui/Icon.svelte` (+ its test if it lists names), `web/src/components/places/cabin/LyrePanel.svelte`, `web/src/screens/Title.svelte`
- Delete: `git rm web/src/lib/juice/soundStore.svelte.ts`
- Modify (migrate): `web/e2e/scenes-camp.spec.ts` (the HUD sound test only), `web/e2e/scenes-cabin.spec.ts` (the lyre test only)

**Interfaces:**
- Consumes: `audio()`, `onBattleEvent`, `battleTrack`, `audioSettings`, `setChannel`, `bothMuted`, `gainOf`, `resetTours` (Task 2), `playSfx`, `go`, `href`, `modal`-free popover pattern, `Icon`.
- Produces: `listenToBattle(engine)`; `voiceGain()`, `voiceBegins()`, `voiceEnds()`; `SoundPlate` (test ids `hud-mute` (opener), `hud-sound`, `hud-sound-music|sfx|voice`, `hud-sound-lyre`); `ChannelRow` (`lyre-channel-<ch>`, `lyre-volume-<ch>`, `lyre-mute-<ch>`); `lyre-tours`, `lyre-voice-muted`.

- [ ] **Step 1: Write the failing tests**

`web/src/lib/audio/battleAudio.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createEngine } from './engine';
import { recordingBackend } from './recordingBackend';
import { listenToBattle } from './battleAudio';
import { emitBattle } from '../battle/events';

describe('the battle on the mixer (Rulings E4-E6, UI4 hooks C9)', () => {
  it('plays its ground\'s loop, ducks through the dictation and the proofreading, strikes and cheers', () => {
    const e = createEngine(recordingBackend());
    e.unlock();
    const stop = listenToBattle(e);
    emitBattle({ kind: 'start', opponent: 'hydre', mode: 'dictation', backdrop: 'river' });
    expect(e.snapshot()).toMatchObject({ playing: 'battle', ducks: [] });
    emitBattle({ kind: 'phase', phase: 'dictation' });
    expect(e.snapshot().ducks).toEqual(['dictation']);
    emitBattle({ kind: 'phase', phase: 'proofreading' });
    expect(e.snapshot().ducks).toEqual(['proofreading']);
    emitBattle({ kind: 'phase', phase: 'victory' });
    expect(e.snapshot().ducks).toEqual([]);
    emitBattle({ kind: 'strike', value: 0.5 });
    emitBattle({ kind: 'outcome', outcome: 'rout', caught: 3, missed: 0 });
    expect(e.snapshot().sfx).toEqual(['strike', 'fanfare']);
    emitBattle({ kind: 'start', opponent: 'eris', mode: 'boss', backdrop: 'lair' });
    expect(e.snapshot().playing).toBe('lair');
    emitBattle({ kind: 'phase', phase: 'proofreading' });
    emitBattle({ kind: 'leave' });
    expect(e.snapshot().ducks).toEqual([]);
    stop();
  });
});
```

`tts.test.ts` (append):

```ts
describe('the voice channel (Rulings E5, E7)', () => {
  it('speaks at the voice channel\'s gain and ducks the music while it speaks', async () => {
    const { audioSettings } = await import('../audio/store.svelte');
    const { audio } = await import('../audio/audio.svelte');
    audioSettings.voice = { volume: 0.4, muted: false };
    const volumes: number[] = [];
    (globalThis as any).speechSynthesis.speak = (u: any) => {
      volumes.push(u.volume);
      expect(audio().snapshot().voiceSpeaking).toBe(true);
      setTimeout(() => u.onend?.(), 5);
    };
    await speak('Un.', { rate: 1 });
    audioSettings.voice = { volume: 0.4, muted: true };
    await speak('Deux.', { rate: 1 });
    expect(volumes).toEqual([0.4, 0]);
    expect(audio().snapshot().voiceSpeaking).toBe(false);
  });

  it('lets the music back up when a speech is cancelled without its end event (iOS)', async () => {
    const { audio } = await import('../audio/audio.svelte');
    (globalThis as any).speechSynthesis.speak = () => undefined; // never ends
    void speak('Trois.', { rate: 1 });
    expect(audio().snapshot().voiceSpeaking).toBe(true);
    cancelSpeech();
    expect(audio().snapshot().voiceSpeaking).toBe(false);
  });
});
```

`web/e2e/scenes-audio.spec.ts`:

```ts
import { test, expect } from './crashGuard';
import {
  audioState,
  closeOverlay,
  createProfileApi,
  createText,
  expectBattle,
  expectCamp,
  expectMusic,
  expectScene,
  heroNamer,
  seedPlay,
  spokenVolumes,
  stubSpeech,
  tap,
  uniqueName,
} from './helpers';

// UI5 (spec §7): the engine's state through the recording backend (Ruling E10): no real sound.
const heroName = heroNamer('Lyre');

test('silent until « Entrer », then the sea wind at the gates (Ruling E3)', async ({ page }, testInfo) => {
  await page.goto('/');
  await expectScene(page, 'title');
  await expect.poll(async () => (await audioState(page))?.wanted).toBe('sea');
  expect(await audioState(page)).toMatchObject({ unlocked: false, playing: null, sfx: [] });
  await tap(page.getByTestId('title-gate'), testInfo);
  await expectMusic(page, 'sea');
  expect((await audioState(page))!.sfx).toContain('chime');
});

test('each place plays its loop; a reload waits for the first tap', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/camp`);
  await expectCamp(page);
  await expect.poll(async () => (await audioState(page))?.wanted).toBe('camp');
  expect((await audioState(page))!.playing).toBeNull();
  await tap(page.getByTestId('camp-parchemins'), testInfo);
  await expectScene(page, 'library');
  await expectMusic(page, 'temple');
  await page.goBack();
  await expectCamp(page);
  await expectMusic(page, 'camp');
  await tap(page.getByTestId('camp-dossier'), testInfo);
  await expectScene(page, 'war');
  await expectMusic(page, 'lair');
});

test('the battle loop ducks through the dictation and the proofreading, and the camp comes back clear (Ruling E5)', async ({ page, request }, testInfo) => {
  await stubSpeech(page);
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const text = await createText(request, { title: uniqueName('Duck'), body: 'Les enfants jouent dans le jardin. Ils rient.' } as never);
  await seedPlay(page, { profileId: id, textId: text.id, phase: 'proofreading' } as never);
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'proofreading');
  await expect.poll(async () => (await audioState(page))?.wanted).toBe('battle');
  await expect.poll(async () => (await audioState(page))?.ducks).toEqual(['proofreading']);
  // A hash navigation (Back, a link) keeps the page and its mixer: the camp's SceneStage clears the ducks.
  await page.goto(`/#/p/${id}/camp`);
  await expectCamp(page);
  await expect.poll(async () => (await audioState(page))?.ducks).toEqual([]);
  await expect.poll(async () => (await audioState(page))?.wanted).toBe('camp');
});

test("the HUD's lyre opens three quick toggles that the lyre and a reload remember (Ruling E8)", async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/camp`);
  await expectCamp(page);
  const opener = page.getByTestId('hud-mute');
  await expect(opener).toHaveAttribute('aria-expanded', 'false');
  await tap(opener, testInfo);
  const plate = page.getByTestId('hud-sound');
  await expect(plate).toBeVisible();
  for (const ch of ['music', 'sfx', 'voice']) await expect(plate.getByTestId(`hud-sound-${ch}`)).toHaveAttribute('aria-pressed', 'true');
  const saved = page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().includes(`/api/profiles/${id}`));
  await tap(plate.getByTestId('hud-sound-music'), testInfo);
  await saved;
  await expect(plate.getByTestId('hud-sound-music')).toHaveAttribute('aria-pressed', 'false');
  expect((await audioState(page))!.settings.music.muted).toBe(true);
  await page.keyboard.press('Escape');
  await expect(plate).toHaveCount(0);
  await expect(opener).toBeFocused();
  await page.reload();
  await expectCamp(page);
  await tap(page.getByTestId('hud-mute'), testInfo);
  await expect(page.getByTestId('hud-sound-music')).toHaveAttribute('aria-pressed', 'false');
  await tap(page.getByTestId('hud-sound-lyre'), testInfo);
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByTestId('lyre-mute-music')).toHaveAttribute('aria-pressed', 'true');
});

test('the lyre sets each channel; the voice reaches the dictation at its volume, and says when it is muted (Ruling E7)', async ({ page, request }, testInfo) => {
  await stubSpeech(page);
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/settings`);
  const lyre = page.getByTestId('overlay-lyre');
  const slider = lyre.getByTestId('lyre-volume-voice');
  await expect(slider).toHaveAttribute('aria-label', 'Volume de la voix');
  await slider.focus();
  await page.keyboard.press('Home');
  for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveValue('40');
  await expect.poll(async () => (await audioState(page))?.settings.voice.volume).toBe(0.4);
  await lyre.getByRole('button', { name: 'Écouter un essai' }).click();
  await expect.poll(async () => (await spokenVolumes(page)).at(-1)).toBe(0.4);
  await lyre.getByTestId('lyre-mute-voice').click();
  await expect(lyre.getByTestId('lyre-voice-muted')).toHaveText(
    "En sourdine, la dictée n'est plus lue à voix haute\u202f: il faudra quelqu'un pour te la lire.",
  );
  await expect(lyre.locator('input[type="checkbox"]')).toHaveCount(0);
  await closeOverlay(page);
});
```

(Read `seedPlay`'s real `PlaySeed` fields and `createText`'s body in `helpers.ts` and write the calls exactly, without `as never`; the quit test ids come from `ProofPhase` (C15). Before Task 8, the expected lyre text uses the spacing this task's `LyrePanel` renders: the copy goes through `frenchSpacing`, see Step 5.)

- [ ] **Step 2: The battle listener and the voice signal**

`lib/audio/battleAudio.ts`:

```ts
// The battle on the mixer (UI4 Ruling C9's hooks, Rulings E4-E6): its ground's loop, the ducking of
// its dictation and proofreading phases, a blow per reckoning strike, a fanfare for a rout.
import { onBattleEvent } from '../battle/events';
import { battleTrack } from './catalog';
import type { AudioEngine } from './engine';

export function listenToBattle(e: AudioEngine): () => void {
  return onBattleEvent((ev) => {
    switch (ev.kind) {
      case 'start':
        e.music(battleTrack(ev.backdrop));
        break;
      case 'phase':
        e.duck('dictation', ev.phase === 'dictation');
        e.duck('proofreading', ev.phase === 'proofreading');
        break;
      case 'strike':
        e.sfx('strike');
        break;
      case 'outcome':
        if (ev.outcome === 'rout') e.sfx('fanfare');
        break;
      case 'leave':
        e.duck('dictation', false);
        e.duck('proofreading', false);
        break;
    }
  });
}
```

`audio.svelte.ts`'s `installAudio`: `const stopBattle = listenToBattle(e);` and call it in the teardown.

`lib/audio/voice.ts`:

```ts
// The dictation's voice is speechSynthesis (lib/dictation/tts.ts), not a Howler sound: here is what it
// needs from the audio side (Rulings E5, E7). Its gain is the voice channel's (a muted voice speaks
// at 0, keeping the dictation's pace); while it speaks the music ducks and effects wait.
import { audio } from './audio.svelte';
import { audioSettings } from './store.svelte';
import { gainOf } from './settings';

export const voiceGain = (): number => gainOf(audioSettings.voice);

export function voiceSpeaking(on: boolean): void {
  try {
    audio().voice(on);
  } catch {
    // Sound is a convenience.
  }
}
```

`lib/dictation/tts.ts`: in `speak()`, `utterance.volume = voiceGain();`; in `startSpeaking`, `voiceSpeaking(true)` just before `synth.speak(utterance)` (the music is down before the first word); `finish` becomes `if (activeUtterance === utterance) { activeUtterance = null; voiceSpeaking(false); } resolve();` (a cancelled utterance whose end event arrives late must not un-duck a newer one); `cancelSpeech()` calls `voiceSpeaking(false)` after `synth.cancel()` and sets `activeUtterance = null`. `unlockSpeech()` stays silent to the mixer.

- [ ] **Step 3: The places' loops and the title's unlock**

`SceneStage.svelte` (script):

```ts
  import { untrack } from 'svelte';
  import { audio } from '../../lib/audio/audio.svelte';
  // UI5 (spec §7, Ruling E4): each place plays its loop, and takes the mixer back from a battle or a
  // speech (no leftover duck). Nothing sounds before the first tap (Ruling E3): the mixer waits.
  $effect(() => {
    const track = scene.ambience.music;
    untrack(() => audio().scene(track));
  });
```

`Title.svelte`: `gesture()` already calls `unlockAudio()` first, then `requestTilt()`; `enter()` plays `chime` after it; keep that order and add a comment « UI5 Ruling E3: the unlock comes first, inside the tap; the gate's chime is the first sound of the game. » No other change.

- [ ] **Step 4: The HUD's sound plate**

`Icon.svelte` gains `music`, `bell`, `voice` (inline SVG strokes in the existing icons' style: a lyre-string trio of notes is out, draw a small kithara for `music`, a hand bell for `bell`, a speaking scroll for `voice`; each also drawn struck through through the existing `-muted` pattern if the component has one, else a CSS slash in `SoundPlate`).

`components/scene/SoundPlate.svelte`:

```svelte
<script lang="ts">
  // The HUD's quick sound toggles (spec §7, Ruling E8): the lyre button drops a small bronze plate
  // with the three channels and a way to the full lyre. A transient control, no route; closes on
  // Escape, on a tap outside, and on its way to the lyre, giving focus back to the lyre button.
  import Icon from '../ui/Icon.svelte';
  import { audioSettings, bothMuted, setChannel } from '../../lib/audio/store.svelte';
  import { unlockAudio, playSfx } from '../../lib/juice/sfx';
  import { go } from '../../lib/scene/panelNav';
  import { href } from '../../lib/routes';
  import type { ChannelId } from '../../lib/audio/settings';

  let { profileId }: { profileId: number } = $props();

  let open = $state(false);
  let root: HTMLElement | undefined = $state();
  let opener: HTMLButtonElement | undefined = $state();

  const ROWS: { ch: ChannelId; label: string; icon: 'music' | 'bell' | 'voice' }[] = [
    { ch: 'music', label: 'Musique', icon: 'music' },
    { ch: 'sfx', label: 'Bruitages', icon: 'bell' },
    { ch: 'voice', label: 'Voix', icon: 'voice' },
  ];

  function toggleOpen() {
    unlockAudio();
    open = !open;
  }
  function close(refocus = true) {
    if (!open) return;
    open = false;
    if (refocus) opener?.focus();
  }
  function flip(ch: ChannelId) {
    setChannel(profileId, ch, { muted: !audioSettings[ch].muted });
    if (ch === 'sfx' && !audioSettings.sfx.muted) playSfx('tap');
  }
  function toLyre() {
    close(false);
    go(href('settings', { profileId: String(profileId) }), 'panel');
  }

  $effect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (root && !root.contains(e.target as Node)) close(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
    };
  });
</script>

<div class="sound" bind:this={root}>
  <button
    bind:this={opener}
    type="button"
    class="hud-round"
    data-testid="hud-mute"
    aria-label="Les sons"
    aria-expanded={open}
    aria-controls="hud-sound"
    onclick={toggleOpen}
  >
    <Icon name={bothMuted() ? 'lyre-muted' : 'lyre'} size={28} />
  </button>
  {#if open}
    <div id="hud-sound" class="plate kit-plate" role="group" aria-label="Les sons du camp" data-testid="hud-sound">
      {#each ROWS as r (r.ch)}
        <button
          type="button"
          class="toggle"
          class:off={audioSettings[r.ch].muted}
          aria-pressed={!audioSettings[r.ch].muted}
          data-testid="hud-sound-{r.ch}"
          onclick={() => flip(r.ch)}
        >
          <Icon name={r.icon} size={26} />
          <span>{r.label}</span>
        </button>
      {/each}
      <button type="button" class="kit-link to-lyre" data-testid="hud-sound-lyre" onclick={toLyre}>La lyre</button>
    </div>
  {/if}
</div>
```

Style it as the HUD's other bronze pieces (`.hud-round` stays the Hud's class, move its rule so both use it): the plate drops under the button, right-aligned, `min-width: 220px`, three rows of ≥ 48 px, `.off` draws the icon at 50 % and a bronze slash; inside the battle band the plate drops below the band (z-index above the parchment). If `kit-plate` does not exist, use the dark voice-plate treatment of `OverlayVoice` (dark translucent, bronze border). No red; focus ring `--gold-light`.

`Hud.svelte`: the mute button and `toggleMute` go; `<SoundPlate profileId={profile.id} />` takes its place in `.hud-right`; the comment « Audio channels and their sliders arrive in UI5; UI1 keeps the existing single mute. » becomes « UI5 Ruling E8: the lyre opens the sound plate (three channels). ». Imports of `soundStore`/`setMuted` go.

- [ ] **Step 5: « La lyre »**

`components/places/cabin/ChannelRow.svelte`:

```svelte
<script lang="ts">
  // One channel of « Les sons du camp » (spec §7): a real range input (0-100, step 5) and a
  // « Sourdine » toggle. Applies at once; the slider saves once it rests and on release (Ruling E2).
  import { audioSettings, setChannel } from '../../../lib/audio/store.svelte';
  import { playSfx } from '../../../lib/juice/sfx';
  import type { ChannelId } from '../../../lib/audio/settings';

  let { profileId, channel, label, volumeLabel }: { profileId: number; channel: ChannelId; label: string; volumeLabel: string } = $props();

  const value = $derived(Math.round(audioSettings[channel].volume * 100));
  const set = (e: Event, live: boolean) => setChannel(profileId, channel, { volume: Number((e.currentTarget as HTMLInputElement).value) / 100 }, { live });
</script>

<div class="channel" data-testid="lyre-channel-{channel}">
  <span class="channel-name">{label}</span>
  <input
    type="range"
    min="0"
    max="100"
    step="5"
    aria-label={volumeLabel}
    data-testid="lyre-volume-{channel}"
    {value}
    oninput={(e) => set(e, true)}
    onchange={(e) => {
      set(e, false);
      if (channel === 'sfx') playSfx('tap');
    }}
  />
  <button
    type="button"
    class="kit-bronze is-quiet mute"
    aria-pressed={audioSettings[channel].muted}
    data-testid="lyre-mute-{channel}"
    onclick={() => setChannel(profileId, channel, { muted: !audioSettings[channel].muted })}>Sourdine</button
  >
</div>
```

(Style the range as bronze on parchment (`accent-color: var(--bronze)`, a 48 px tall hit area), the row a three-column grid; `aria-pressed="true"` shows the button pressed-in.)

`LyrePanel.svelte`:
- Drop `SOUNDS_ON`/`SOUNDS_OFF`, the `sounds` state, its effect, `onSoundsChange`, the `soundStore` import, the « Les sons du camp » medallions and « La dictée est toujours lue. ».
- New section after the voice's:

```svelte
    <section>
      <h3 class="kit-section">Les sons du camp</h3>
      <ChannelRow profileId={profile.id} channel="music" label="La musique" volumeLabel="Volume de la musique" />
      <ChannelRow profileId={profile.id} channel="sfx" label="Les bruitages" volumeLabel="Volume des bruitages" />
      <ChannelRow profileId={profile.id} channel="voice" label="La voix" volumeLabel="Volume de la voix" />
      {#if audioSettings.voice.muted}
        <p class="kit-note" data-testid="lyre-voice-muted">{frenchSpacing("En sourdine, la dictée n'est plus lue à voix haute : il faudra quelqu'un pour te la lire.")}</p>
      {/if}
      <p class="note">{frenchSpacing("Sur iPad, le volume de la voix suit aussi les boutons de l'appareil.")}</p>
    </section>
```

- « Refaire les visites du camp » after the seal's section:

```svelte
    <section>
      <h3 class="kit-section">Les visites du camp</h3>
      <button type="button" class="kit-link" data-testid="lyre-tours" onclick={replayTours} disabled={replaying}>Refaire les visites du camp</button>
    </section>
```

with `async function replayTours() { replaying = true; error = ''; try { await resetTours(profile.id); toast.show('Les visites reprendront à ton prochain passage dans chaque lieu.'); } catch (e) { error = e instanceof ApiError ? e.detail : 'Une erreur est survenue.'; } finally { replaying = false; } }`.
- Credits: add `<p>Les musiques et les bruitages du camp ont été offerts à tous par leurs auteurs, sous la licence Creative Commons Zéro.</p>` after the fonts' line.

`LyrePanel`'s docblock: « The mute (A17) became three channels (UI5, spec §7). »

- [ ] **Step 6: Retire the façade, migrate the two specs**

`git rm web/src/lib/juice/soundStore.svelte.ts` (grep first: nothing may import it any more). `scenes-camp.spec.ts` « HUD: laurel, dragon, sound toggle that survives leaving the camp »: keep the laurel/dragon parts; the sound part becomes: open the plate, turn music and effects off (`hud-sound-music`, `hud-sound-sfx`), close it, leave for the library and come back, the opener's icon is the muted lyre (`hud-mute` holds `[data-icon="lyre-muted"]` or the `Icon`'s own marker), reopen, both still off, turn them back on. `scenes-cabin.spec.ts` « the lyre holds the settings… »: replace the « Les sons du camp » radios' lines with the three rows (`lyre-channel-music|sfx|voice` visible, `lyre-mute-music` toggles `aria-pressed`, no checkbox, no radio group named « Les sons du camp »), keep the rest; « La dictée est toujours lue. » becomes the iPad note.

- [ ] **Step 7: Run**

Run: `scripts/npm.sh run test -- src/lib/audio src/lib/dictation src/lib/juice src/audioGuards.test.ts src/registerGuard.test.ts src/noEmoji.test.ts`
Expected: PASS (paste counts).
Run: `scripts/npm.sh run check` — Expected: `0 errors and 0 warnings`.
Run: `STACK=audio scripts/playwright.sh scenes-audio --repeat-each=3` — Expected: PASS on `desktop` and `ipad`.
Run once: `STACK=audio scripts/playwright.sh scenes-camp scenes-cabin scenes-battle happy-path` — Expected: PASS.
Run the lane's gate: `STACK=audio PW_WORKERS=4 scripts/check.sh` — Expected: `== ALL GREEN`.

- [ ] **Step 8: Commit**

```bash
git add web/src/lib/audio web/src/lib/dictation/tts.ts web/src/lib/dictation/tts.test.ts web/src/components/scene/SceneStage.svelte web/src/components/scene/Hud.svelte web/src/components/scene/SoundPlate.svelte web/src/components/ui/Icon.svelte web/src/components/places/cabin/LyrePanel.svelte web/src/components/places/cabin/ChannelRow.svelte web/src/screens/Title.svelte web/e2e/scenes-audio.spec.ts web/e2e/scenes-camp.spec.ts web/e2e/scenes-cabin.spec.ts
git rm web/src/lib/juice/soundStore.svelte.ts
git commit -m "UI5 Task 5: the camp sounds - each place's loop, the battle ducking under the voice and the proofreading, the voice's volume, three channels in the lyre, the HUD sound plate; the single mute retires

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/lib/audio web/src/lib/dictation/tts.ts web/src/lib/dictation/tts.test.ts web/src/components/scene/SceneStage.svelte web/src/components/scene/Hud.svelte web/src/components/scene/SoundPlate.svelte web/src/components/ui/Icon.svelte web/src/components/places/cabin/LyrePanel.svelte web/src/components/places/cabin/ChannelRow.svelte web/src/screens/Title.svelte web/e2e/scenes-audio.spec.ts web/e2e/scenes-camp.spec.ts web/e2e/scenes-cabin.spec.ts web/src/lib/juice/soundStore.svelte.ts
```

(Add `Icon`'s test file if it lists the icon names.)

---

### Task 6: Greetings from the content files, and the six first-visit tours (lane D)

**Files:**
- Create: `web/src/components/scene/TourLayer.svelte`, `web/e2e/scenes-tours.spec.ts`, `web/e2e/scenes-dialogue.spec.ts`
- Modify: `web/src/components/scene/{DialogueBox,PlaceScene,OverlayVoice}.svelte`, `web/src/screens/{Camp,LibraryTent,Delphi,WarTent,Nest,CabinRoom}.svelte`, `web/src/lib/world/scenes/{camp,library,delphi,nest,cabin}.ts` (+ tests), `web/src/lib/world/nextStep.ts` (+ test), `web/src/components/places/library/PortalPanel.svelte`, `web/src/components/places/cabin/TrophiesPanel.svelte`, `web/src/styles/kit.css` (the onboarding rules), `web/src/lib/dialogue/content.test.ts` (TourLayer in the TTS list), comments naming Onboarding in `overlayState.svelte.ts`, `SceneStage.svelte`, `RotateScreen.svelte`
- Delete: `git rm web/src/components/Onboarding.svelte`
- Modify (migrate): `web/e2e/scenes-camp.spec.ts` (the two onboarding tests → tours; the greeting assertion), `web/e2e/scenes-cabin.spec.ts` (greeting line), `web/e2e/scenes-delphi.spec.ts` (greeting line), `web/e2e/world.spec.ts` (the onboarding walk), `web/e2e/helpers.ts` (`skipOnboarding`)

**Interfaces:**
- Consumes: `sayKey`, `tourSteps`, `TOUR_OF`, `shouldTour`, `markTourSeen`, `overlayState`, `modal`, `stageBox`, `shapeBox`, `greetKey`/`markGreeted`/`shouldGreet`, `nextStep`, `prophecyWhen`, `nearestProphecy`, `stageLine`, `dragonSays`.
- Produces: `DialogueBox` props `skipLabel`, `onLine`, attributes `data-key`, `data-speaker`; `OverlayVoice` `data-key`; `TourLayer` (`data-testid="tour"`, `data-tour`, `data-step`, `data-target`, `tour-ring`); `nextStepKey(camp)`; `campGreeting`, `pythiaGreeting`, `owlGreeting`, `owlHint`, `nestGreeting`, `cabinGreeting`, `warGreeting` from the content.

- [ ] **Step 1: Write the failing e2e**

`web/e2e/scenes-tours.spec.ts`:

```ts
import { test, expect } from './crashGuard';
import { createFreshHeroApi, createProfileApi, expectCamp, expectLineOf, expectScene, heroNamer, nextLine, tap } from './helpers';

// UI5 (spec §8, Ruling E13): each place's first visit is its tour.
test.use({ tours: true });
const heroName = heroNamer('Visite');

async function walkTour(page: import('@playwright/test').Page): Promise<string[]> {
  const tour = page.getByTestId('tour');
  const targets: string[] = [];
  for (let i = 0; i < 30 && (await tour.count()) > 0; i++) {
    const step = await tour.getAttribute('data-step');
    targets.push((await tour.getAttribute('data-target')) ?? '');
    await nextLine(page);
    await expect.poll(async () => ((await tour.count()) === 0 ? 'gone' : await tour.getAttribute('data-step'))).not.toBe(step);
  }
  return targets;
}

test("a new hero's camp begins with the egg's tour, once (the Muses' cards are gone)", async ({ page, request }, testInfo) => {
  const id = await createFreshHeroApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/camp`);
  const tour = page.getByTestId('tour');
  await expect(tour).toHaveAttribute('data-tour', 'camp');
  await expect(page.getByTestId('onboarding')).toHaveCount(0);
  await expect(page.getByTestId('dialogue-box')).toHaveAttribute('data-speaker', 'dragon');
  await expect(page.getByTestId('dialogue-box')).toContainText("L'œuf");
  // A modal: the camp is inert under it, its labels stay readable.
  await expect(page.getByTestId('scene-camp')).toHaveAttribute('inert', '');
  await expect(page.getByTestId('scene-camp')).not.toHaveClass(/has-overlay/);
  expect(await walkTour(page)).toEqual(['', '', '', '', 'parchemins', 'oracle', 'dossier', 'dragon', 'cabin', 'boss', '']);
  await expect(tour).toHaveCount(0);
  const hero = await (await request.get(`/api/profiles/${id}`)).json();
  expect(hero.settings).toMatchObject({ tours: ['camp'], onboarded: true });
  await page.reload();
  await expectCamp(page);
  await expect(tour).toHaveCount(0);
  await expectLineOf(page.getByTestId('dialogue-box'), 'camp.enter', { hero: hero.name });
});

test('the ring circles each step\'s hotspot; « Passer la visite » ends it and it is seen', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/tente-parchemins`);
  const tour = page.getByTestId('tour');
  await expect(tour).toHaveAttribute('data-tour', 'library');
  await expect(tour).toHaveAttribute('data-target', 'shelves');
  const ring = await page.getByTestId('tour-ring').boundingBox();
  const shelves = await page.getByTestId('library-shelves').boundingBox();
  expect(ring!.x).toBeLessThanOrEqual(shelves!.x + 2);
  expect(ring!.x + ring!.width).toBeGreaterThanOrEqual(shelves!.x + shelves!.width - 2);
  await expect(page.getByTestId('dialogue-skip')).toHaveText('Passer la visite');
  await tap(page.getByTestId('dialogue-skip'), testInfo);
  await expect(tour).toHaveCount(0);
  await page.reload();
  await expectScene(page, 'library');
  await expect(tour).toHaveCount(0);
  await expectLineOf(page.getByTestId('dialogue-box'), 'library.enter');
});

test('Tab stays in the tour, and focus comes back after it', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/cabane`);
  await expect(page.getByTestId('tour')).toHaveAttribute('data-tour', 'cabin');
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[data-testid="tour"]')), `Tab ${i + 1}`).toBe(true);
  }
  await page.getByTestId('dialogue-skip').click();
  await expect(page.getByTestId('tour')).toHaveCount(0);
});

test('a deep link to the hero panel waits for the camp tour: one modal at a time', async ({ page, request }, testInfo) => {
  const id = await createFreshHeroApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/camp?panel=heros`);
  await expect(page.getByTestId('tour')).toBeVisible();
  await expect(page.getByTestId('overlay-heros')).toHaveCount(0);
  await page.getByTestId('dialogue-skip').click();
  await expect(page.getByTestId('overlay-heros')).toBeVisible();
});

test('« Refaire les visites du camp » brings every tour back', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await request.patch(`/api/profiles/${id}`, { data: { settings: { tours: ['camp', 'library', 'delphi', 'war', 'nest', 'cabin'] } } });
  await page.goto(`/#/p/${id}/settings`);
  await page.getByTestId('lyre-tours').click();
  await expect(page.getByTestId('overlay-lyre').getByRole('status')).toHaveText('Les visites reprendront à ton prochain passage dans chaque lieu.');
  await page.goto(`/#/p/${id}/temple`);
  await expect(page.getByTestId('tour')).toHaveAttribute('data-tour', 'delphi');
  await expect(page.getByTestId('dialogue-box')).toHaveAttribute('data-speaker', 'pythia');
});

test('reduced motion: the ring holds still and every line shows at once', async ({ page, request }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/tente-de-guerre`);
  await expect(page.getByTestId('tour')).toHaveAttribute('data-tour', 'war');
  await expect(page.getByTestId('dialogue-advance')).toHaveAttribute('aria-label', 'Suite');
  expect(await page.getByTestId('tour-ring').evaluate((el) => el.getAnimations().length)).toBe(0);
});
```

(The « Refaire les visites » test depends on lane A's `lyre-tours`: run it after the merge (Task 9's gate); in lane D mark it `test.fixme` with the comment « needs lane A's lyre button (UI5 Task 5); un-fixme'd in Task 9 », and Task 9 removes the `fixme`. The profile GET path: use the route the server has; if none, read the hero from `/api/profiles`.)

`web/e2e/scenes-dialogue.spec.ts` (tours off):

```ts
import { test, expect } from './crashGuard';
import { createProfileApi, expectCamp, expectLineOf, expectScene, heroNamer, nextLine, tap } from './helpers';

const heroName = heroNamer('Parole');

test('the camp greets with her name, the dragon\'s stage, then the next step (spec §8, Ruling E12)', async ({ page, request }, testInfo) => {
  const name = heroName(testInfo.project.name);
  const id = await createProfileApi(request, name);
  await page.goto(`/#/p/${id}/camp`);
  await expectCamp(page);
  const box = page.getByTestId('dialogue-box');
  await expectLineOf(box, 'camp.enter', { hero: name });
  await nextLine(page);
  await expect(box).not.toHaveAttribute('data-key', /./);
  await nextLine(page);
  await expectLineOf(box, 'camp.next.first-text');
});

test("the owl never says the same hint twice in a row", async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/tente-parchemins`);
  await expectScene(page, 'library');
  await page.getByTestId('dialogue-skip').click();
  const said: string[] = [];
  for (let i = 0; i < 4; i++) {
    await tap(page.getByTestId('library-owl'), testInfo);
    await expectLineOf(page.getByTestId('dialogue-box'), 'library.owl');
    said.push((await page.getByTestId('dialogue-text').textContent())!);
    await page.getByTestId('dialogue-skip').click();
  }
  for (let i = 1; i < said.length; i++) expect(said[i]).not.toBe(said[i - 1]);
});

test('Éris greets in the war tent, the Pythia at Delphi, in French typography', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/tente-de-guerre`);
  await expectScene(page, 'war');
  await expectLineOf(page.getByTestId('dialogue-box'), 'war.enter');
  await expect(page.getByTestId('dialogue-box')).toHaveAttribute('data-speaker', 'eris');
  await page.goto(`/#/p/${id}/temple`);
  await expectScene(page, 'delphi');
  await expectLineOf(page.getByTestId('dialogue-box'), 'delphi.enter.sealed');
  await expect(page.getByTestId('dialogue-advance')).toHaveAttribute('aria-label', 'Suite', { timeout: 15_000 });
  expect(await page.getByTestId('dialogue-text').textContent()).not.toMatch(/ [:;!?»]|« /);
});
```

(Migrations: `scenes-camp.spec.ts:174` and `:227` (the onboarding card tests) move into `scenes-tours.spec.ts` as the "deep link" and "Tab" tests above (delete them from `scenes-camp`); `scenes-camp.spec.ts:457-459` checks `expectLineOf(box, 'camp.enter', { hero: name })` and the live region contains the same text; `scenes-cabin.spec.ts:228` → `expectLineOf(…, 'cabin.enter')`; `scenes-delphi.spec.ts:44` → `expectLineOf(…, 'delphi.enter.sealed')`; `world.spec.ts:69-73`: that test gets `test.use({ tours: true })` (its own `describe`) and walks the camp tour with `nextLine` until `tour` is gone, keeping its intent (a first visit walked, not skipped). `helpers.ts` `skipOnboarding`: if `[data-testid="tour"][data-tour="camp"]` is visible, click its `dialogue-skip` and wait for it to go; comment updated.)

- [ ] **Step 2: `DialogueBox` and `OverlayVoice`**

`DialogueBox.svelte`: props `skipLabel = 'Tout passer'` and `onLine?: (index: number) => void`; `$effect(() => onLine?.(index));`; the root gets `data-key={line.key}` and `data-speaker={line.speaker}`; the skip button reads `{skipLabel}`. Its docblock: « UI5 feeds it content lines (spec §8) and runs the tours through `onLine`. ». `OverlayVoice.svelte`: the figure gets `data-key={line.key}`.

- [ ] **Step 3: `TourLayer.svelte`**

```svelte
<script lang="ts">
  // A place's first-visit tour (spec §8, Ruling E13): a modal next to the stage (the stage is inert
  // under it, as under any overlay, but keeps its labels: overlayState.tour), the place dimmed at
  // night but for a gold ring around the step's hotspot, and the place's character speaking each
  // step in the dialogue box, docked in the art box as usual. « Passer la visite » ends it.
  import { onDestroy } from 'svelte';
  import DialogueBox from './DialogueBox.svelte';
  import { modal, overlayState } from '../../lib/scene/overlayState.svelte';
  import { shapeBox, stageBox } from '../../lib/scene/geometry';
  import { reducedMotion } from '../../lib/juice/motion';
  import type { DialogueLine, SceneDef } from '../../lib/scene/types';

  let { scene, lines, targets, onDone }: { scene: SceneDef; lines: DialogueLine[]; targets: (string | null)[]; onDone: () => void } = $props();

  let index = $state(0);
  let vw = $state(0);
  let vh = $state(0);
  const art = $derived(stageBox(vw, vh));
  const target = $derived(targets[index] ?? null);
  const box = $derived.by(() => {
    const h = target ? scene.hotspots.find((x) => x.id === target) : null;
    return h ? shapeBox(h.shape) : null;
  });
  const still = reducedMotion();

  overlayState.tour = true;
  onDestroy(() => (overlayState.tour = false));
</script>

<svelte:window bind:innerWidth={vw} bind:innerHeight={vh} />

<div
  class="tour"
  role="dialog"
  aria-modal="true"
  aria-label="Visite : {scene.title}"
  tabindex="-1"
  data-testid="tour"
  data-tour={scene.id}
  data-step={index}
  data-target={target ?? ''}
  use:modal
>
  <div class="art" style="left:{art.left}px;top:{art.top}px;width:{art.width}px;height:{art.height}px">
    <div
      class="dim"
      aria-hidden="true"
      style={box ? `--x:${box.x + box.w / 2}%;--y:${box.y + box.h / 2}%;--rx:${box.w / 2 + 3}%;--ry:${box.h / 2 + 4}%` : undefined}
      class:whole={!box}
    ></div>
    {#if box}
      <div
        class="ring"
        class:still
        aria-hidden="true"
        data-testid="tour-ring"
        style="left:{box.x - 1}%;top:{box.y - 1}%;width:{box.w + 2}%;height:{box.h + 2}%"
      ></div>
    {/if}
    <DialogueBox {lines} {onDone} onLine={(i) => (index = i)} skipLabel="Passer la visite" />
  </div>
</div>

<style>
  .tour {
    position: fixed;
    inset: 0;
    z-index: 40;
    outline: none;
  }
  .art {
    position: absolute;
  }
  .dim {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse var(--rx) var(--ry) at var(--x) var(--y), transparent 92%, rgba(21, 18, 26, 0.55) 100%);
    transition: background 300ms ease;
  }
  .dim.whole {
    background: rgba(21, 18, 26, 0.35);
  }
  .ring {
    position: absolute;
    border: 3px solid var(--gold-light);
    border-radius: 50%;
    box-shadow: 0 0 18px rgba(241, 220, 154, 0.7);
    animation: tour-ring 1.6s ease-in-out infinite;
    pointer-events: none;
  }
  .ring.still {
    animation: none !important;
  }
  @keyframes tour-ring {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.55;
    }
  }
</style>
```

(Check the ring and the dimming against the art at 1180×820 and 1280×720 in the walk; the ellipse hole's size may need tuning per shape. The HUD band sits above `.tour`'s z-index only if it is itself above 40: keep the HUD visible but inert; do not let the dim cover it.)

- [ ] **Step 4: `PlaceScene` runs the tour before the greeting**

In `PlaceScene.svelte`:

```ts
  import TourLayer from './TourLayer.svelte';
  import { markTourSeen, shouldTour } from '../../lib/tours/seen.svelte';
  import { tourSteps } from '../../lib/tours/tours';
  import type { TourId } from '../../lib/dialogue/types';

  // UI5 (spec §8, Ruling E13): a place's first visit is its tour. It waits for the camp data (the
  // dragon's stage picks its lines), takes the greeting's turn (the place counts as greeted), and is
  // seen once it ends or is skipped.
  let tour = $state<{ id: TourId; lines: DialogueLine[]; targets: (string | null)[] } | null>(null);
  const tourId = $derived(scene.narrator.tour);
  const touring = $derived(!!tourId && shouldTour(profile, tourId));
  $effect(() => {
    if (debug || tour || !tourId || !camp || !touring) return;
    const id = tourId;
    const dragon = camp.dragon;
    untrack(() => {
      markGreeted(greetKey(scene.id, profile.id));
      tour = { id, ...tourSteps(id, dragon) };
    });
  });
  function tourDone() {
    const t = tour;
    tour = null;
    if (t) void markTourSeen(profile, t.id);
  }
```

The greeting effect gains `if (touring) return;` first. Render `{#if tour}<TourLayer {scene} lines={tour.lines} targets={tour.targets} onDone={tourDone} />{/if}` after `</SceneStage>` (next to the hero veil), never inside the stage.

- [ ] **Step 5: The greetings read the content**

- `lib/world/nextStep.ts`: `nextStepLine` → `nextStepKey(camp): { key: DialogueKey; vars?: Record<string, string> }` (`prophecy` → `camp.next.prophecy` with `{ when: prophecyWhen(nearestProphecy(camp)!.days_left) }`; `battle`, `first-text`, `scrolls` → `camp.next.<step>`; null → `camp.next.none`). `nextStep.test.ts` pins keys instead of strings.
- `lib/world/scenes/camp.ts`:

```ts
/** The camp's greeting (Ruling E12): her name, the dragon's stage, the week's goal when reached, the next step. */
export function campGreeting(profileName: string, camp: CampResponse): DialogueLine[] {
  const d = camp.dragon;
  const lines = [
    sayKey('camp.enter', { vars: { hero: profileName }, dragon: d }),
    dragonSays(d, stageLine(d.stage, d.name, Math.max(0, d.available - d.neutralised))),
  ];
  if (camp.weekly.reached) lines.push(sayKey('camp.weekly', { dragon: d }));
  const next = nextStepKey(camp);
  lines.push(sayKey(next.key, { vars: next.vars, dragon: d }));
  return lines;
}
```

- `delphi.ts`: `pythiaGreeting(camp) = [sayKey(camp.oracle.status === 'sealed' ? 'delphi.enter.sealed' : 'delphi.enter.chosen')]`.
- `library.ts`: `owlGreeting() = [sayKey('library.enter')]`; `owlHint()` → `owlHint(): DialogueLine` = `sayKey('library.owl')` (the selector remembers the last); `OWL_HINTS` goes; `LibraryTent.svelte` drops its `lastHint` bookkeeping.
- `nest.ts`: `nestGreeting(d) = [d.stage === 'hatchling' && !d.name ? sayKey('nest.name', { dragon: d }) : sayKey('nest.enter', { dragon: d })]`.
- `cabin.ts`: `cabinGreeting(d) = [sayKey('cabin.enter', { dragon: d })]`.
- `WarTent.svelte`: gains `const greet = () => [sayKey('war.enter')];` passed to `PlaceScene` (Éris speaks from her portrait, `erisSays`'s frame).
- `Camp.svelte`: `greet = (camp) => (camp ? campGreeting(profile.name, camp) : null)` (PlaceScene holds it while the tour runs); `import Onboarding` and `{#if !profile.settings.onboarded}<Onboarding …/>{/if}` go; the hero-panel deep link: `if (panel === 'heros' && !shouldTour(profile, 'camp')) replacePanel(…)` inside its effect (reactive through the `SvelteSet`).
- Each scene module's unit test pins the key (`toMatchObject({ key: 'camp.enter', speaker: 'dragon' })`) and the membership of the text among the key's variants, not one exact text.

- [ ] **Step 6: Retire the onboarding card and two instruction paragraphs**

`git rm web/src/components/Onboarding.svelte`; delete its `.onboarding-*` rules from `kit.css` (grep first); update the comments that name it (`overlayState.svelte.ts`: « Overlay and TourLayer register… »; `SceneStage.svelte`, `RotateScreen.svelte`). `PortalPanel.svelte`: delete `<p class="page-note">…</p>` and its CSS (the library tour's step 4 and the owl's hint say it). `TrophiesPanel.svelte`: the empty note becomes « Ta cabane attend ses premiers trésors. » (the cabin tour's step 1 says the rest). `content.test.ts`: add `src/components/scene/TourLayer.svelte` to the never-TTS'd list.

- [ ] **Step 7: Run**

Run: `scripts/npm.sh run test -- src/lib/world src/lib/dialogue src/lib/tours src/lib/scene src/registerGuard.test.ts src/placesKit.test.ts src/noEmoji.test.ts`
Expected: PASS (paste counts).
Run: `scripts/npm.sh run check` — Expected: `0 errors and 0 warnings`.
Run: `STACK=dialogue scripts/playwright.sh scenes-tours scenes-dialogue --repeat-each=3` — Expected: PASS on both projects (the one `fixme` reported as such).
Run once: `STACK=dialogue scripts/playwright.sh scenes-camp scenes-cabin scenes-delphi scenes-library scenes-war scenes-nest world happy-path profiles` — Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add web/src/components/scene web/src/screens web/src/lib/world web/src/lib/dialogue/content.test.ts web/src/lib/scene web/src/components/places/library/PortalPanel.svelte web/src/components/places/cabin/TrophiesPanel.svelte web/src/styles/kit.css web/e2e/scenes-tours.spec.ts web/e2e/scenes-dialogue.spec.ts web/e2e/scenes-camp.spec.ts web/e2e/scenes-cabin.spec.ts web/e2e/scenes-delphi.spec.ts web/e2e/world.spec.ts web/e2e/helpers.ts
git rm web/src/components/Onboarding.svelte
git commit -m "UI5 Task 6: greetings from the content files (variants, no immediate repeat) and six first-visit tours; the camp tour replaces the Muses' cards

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/components/scene web/src/screens web/src/lib/world web/src/lib/dialogue/content.test.ts web/src/lib/scene web/src/components/places/library/PortalPanel.svelte web/src/components/places/cabin/TrophiesPanel.svelte web/src/styles/kit.css web/e2e/scenes-tours.spec.ts web/e2e/scenes-dialogue.spec.ts web/e2e/scenes-camp.spec.ts web/e2e/scenes-cabin.spec.ts web/e2e/scenes-delphi.spec.ts web/e2e/world.spec.ts web/e2e/helpers.ts web/src/components/Onboarding.svelte
```

---

### Task 7: The battle's dialogue — Éris at the muster and on a retry, her reckoning, the dragon's explanations, the muted voice's note (lane D)

**Files:**
- Modify: `web/src/screens/Play.svelte` (the muster line, the retry flag), `web/src/components/battle/VictoryPhase.svelte`, `web/src/components/battle/MusterPhase.svelte` (the muted voice's note), `web/src/lib/battle/lines.ts` (+ `lines.test.ts`), `web/src/lib/explain.ts` (+ `explain.test.ts`), `web/src/lib/dialogue/battle.ts` (+ test: `stillStanding`)
- Modify: `web/e2e/scenes-battle-play.spec.ts`, `web/e2e/scenes-battle-victory.spec.ts`

**Interfaces:**
- Consumes: `musterLine`, `erisVictoryLine`, `explainIntro`, `explain`, `ExplainContext`, `TokenError`, `dragonSays`, `audioSettings`, `setChannel`, `frenchSpacing`.
- Produces: `stillStanding(errors, max)` in `lib/dialogue/battle.ts`; `MUSTER.voiceMuted`, `MUSTER.voiceBack` in `lines.ts`; test ids `battle-voice-muted`, `battle-voice-unmute`; `battle-voice` and `victory-dialogue` lines carry `data-key`.

- [ ] **Step 1: Write the failing tests**

Unit (`lib/dialogue/battle.test.ts`, append; add `stillStanding` to its import from `./battle`):

```ts
describe('the traps the dragon explains (Ruling E14)', () => {
  it('takes the traps still standing, in text order, one per category, at most two', () => {
    const e = (pos: number, cat: string, caught: boolean) => ({ position: pos, category: cat, caught }) as never;
    expect(stillStanding([e(9, 'agreement:verb', false), e(2, 'homophone', false), e(4, 'agreement:verb', false), e(1, 'accent', true)], 2).map((x: { position: number }) => x.position)).toEqual([2, 4]);
    expect(stillStanding([e(1, 'accent', true)], 2)).toEqual([]);
  });
});
```

(Read how `ReviewScroll.svelte` finds the traps it marks orange (still wrong in the final text) and the field names of `TokenError` (position, category, caught state); write `stillStanding` over the same data and correct this test's shape to it. If `ReviewScroll` computes them inline, move that computation into `stillStanding` and make `ReviewScroll` call it.)

e2e (`scenes-battle-victory.spec.ts`, append; reuse the file's seeding helpers for a submitted result):

```ts
test("Éris answers the reckoning from her lines, then the dragon explains a trap still standing (Ruling E14)", async ({ page, request }, testInfo) => {
  // Seed a result with 4 traps in the draft, 1 caught (catch rate 25 %): Éris's key is battle.caught.
  // … seeding as the file's other victory tests do …
  const dialogue = page.getByTestId('victory-dialogue');
  await expectLineOf(dialogue.getByTestId('dialogue-box'), 'battle.caught');
  await expect(dialogue.getByTestId('dialogue-box')).toHaveAttribute('data-speaker', 'eris');
  await nextLine(page); // the tally
  await nextLine(page);
  await expectLineOf(dialogue.getByTestId('dialogue-box'), 'battle.explain', { word: EXPECTED_WORD });
  await expect(dialogue.getByTestId('dialogue-box')).toHaveAttribute('data-speaker', 'dragon');
  await nextLine(page);
  await expect(dialogue.getByTestId('dialogue-text')).not.toHaveText('');
});
```

`scenes-battle-play.spec.ts` (append):

```ts
test("Éris opens the muster from her lines, and a replay from her retry lines", async ({ page, request }, testInfo) => {
  // A grimoire muster: battle.start in its grimoire variants.
  // … open the grimoire route for a fresh text as the file's grimoire muster test does …
  await expectLineOf(page.getByTestId('battle-voice'), 'battle.start');
  // A finished free-text battle's « Rejouer ce texte » (seed a victory, as scenes-battle-victory does):
  await page.getByRole('button', { name: 'Rejouer ce texte' }).click();
  await expectBattle(page, 'muster');
  await expectLineOf(page.getByTestId('battle-voice'), 'battle.retry');
});

test('the muster says when the voice is muted, and gives it back (Ruling E7)', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await request.patch(`/api/profiles/${id}`, { data: { settings: { audio: { music: { volume: 0.5, muted: false }, sfx: { volume: 0.7, muted: false }, voice: { volume: 1, muted: true } } } } });
  // … open a free text's muster …
  const note = page.getByTestId('battle-voice-muted');
  await expect(note).toContainText('La voix de la dictée est en sourdine.');
  await tap(page.getByTestId('battle-voice-unmute'), testInfo);
  await expect(note).toHaveCount(0);
  await expect.poll(async () => (await audioState(page))?.settings.voice.muted).toBe(false);
});
```

(Fill in the seeding from the files' existing tests; import `expectLineOf`, `nextLine`, `audioState`.)

- [ ] **Step 2: The muster**

`Play.svelte`: `let retried = $state(false);` set to `true` in `restart()` (next to `emitBattle({ kind: 'retry' })`) and back to `false` when a different battle starts (the same place `Play` resets on a new `textId`/`mode`). The muster line is picked once per muster, never in a `$derived` (a pick is recorded):

```ts
  // UI5 Ruling E14: Éris's muster line, from her lines (battle.start / battle.retry) or her dossier line
  // for a lieutenant. Picked once when the muster shows (a pick is remembered: no immediate repeat).
  let taunt = $state<DialogueLine | null>(null);
  $effect(() => {
    if (phase !== 'muster' || !battle) {
      if (phase !== 'muster') taunt = null;
      return;
    }
    if (taunt) return;
    const lt = camp?.lieutenants.find((l) => l.key === battle.opponent.id);
    untrack(() => {
      taunt = musterLine({ opponent: battle.opponent.id, band: lt ? bandFor(lt) : null, mode, retry: retried });
    });
  });
```

(`musterTaunt` and `ERIS_MUSTER` leave `lines.ts`; `lines.test.ts` drops their cases; the `FORBIDDEN` check over Éris's muster lines lives in `content.test.ts` now.)

`MusterPhase.svelte`, under the voice plate:

```svelte
    {#if audioSettings.voice.muted}
      <p class="kit-note" data-testid="battle-voice-muted">
        {MUSTER.voiceMuted}
        <button type="button" class="kit-link" data-testid="battle-voice-unmute" onclick={() => setChannel(profileId, 'voice', { muted: false })}>{MUSTER.voiceBack}</button>
      </p>
    {/if}
```

(`profileId` is among its props or passed by `Play`: add it to the prop contract if missing.) `lines.ts` `MUSTER` (Task 3's fence): `voiceMuted: 'La voix de la dictée est en sourdine.'`, `voiceBack: 'Rendre la voix'`.

- [ ] **Step 3: The victory's dialogue**

`VictoryPhase.svelte`: the `victoryLines` `$derived` becomes a function called where `spoken` is snapshotted (both effects), so each pick happens once:

```ts
  // Ruling C7, UI5 Ruling E14: Éris answers the reckoning from her lines, then the dragon: the tally, up
  // to two traps still standing (the word, then its explanation), the help-stage message, the « Revoir »
  // hint. Built when the dialogue starts (a pick is remembered), never in a $derived.
  function victoryLines(): DialogueLine[] {
    if (!result) return [];
    const introduced = result.introduced.length;
    const lines = [
      erisVictoryLine({ draft, catchRate: result.catchRate, introduced, mode }),
      dragonSays(speaker, dragonTally({ draft, caught, mode })),
    ];
    for (const e of stillStanding(result.errors, 2)) {
      const { text } = explain(e, explainCtx);
      lines.push(explainIntro(e.expected, speaker), dragonSays(speaker, text));
    }
    if (helpMessage) lines.push(dragonSays(speaker, helpMessage));
    if (draft + introduced > 0) lines.push(dragonSays(speaker, DRAGON_REVIEW_HINT));
    return lines;
  }
```

(Use the real names: the result's error list, the expected form's field, the `ExplainContext` `ReviewScroll` receives (thread it through `VictoryPhase`'s props from `Play` if it is not there yet: lane D owns `Play`). `explain.ts`: delete `erisLine` and its tests (its lines live in `battle.json`; its aside in `VICTORY.erisIntroduced`).)

- [ ] **Step 4: Run**

Run: `scripts/npm.sh run test -- src/lib/dialogue src/lib/battle src/lib/explain.test.ts src/registerGuard.test.ts`
Expected: PASS (paste counts).
Run: `scripts/npm.sh run check` — Expected: `0 errors and 0 warnings`.
Run: `STACK=dialogue scripts/playwright.sh scenes-battle-play scenes-battle-victory --repeat-each=3` — Expected: PASS.
Run once: `STACK=dialogue scripts/playwright.sh scenes-battle grimoire happy-path world` — Expected: PASS.
Run the lane's gate: `STACK=dialogue PW_WORKERS=4 scripts/check.sh` — Expected: `== ALL GREEN`.

- [ ] **Step 5: Commit**

```bash
git add web/src/screens/Play.svelte web/src/components/battle/VictoryPhase.svelte web/src/components/battle/MusterPhase.svelte web/src/lib/battle/lines.ts web/src/lib/battle/lines.test.ts web/src/lib/explain.ts web/src/lib/explain.test.ts web/src/lib/dialogue web/e2e/scenes-battle-play.spec.ts web/e2e/scenes-battle-victory.spec.ts
git commit -m "UI5 Task 7: the battle's dialogue - Eris at the muster and on a replay, her answer to the reckoning, the dragon explaining up to two traps still standing, the muted voice's note at the muster

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/screens/Play.svelte web/src/components/battle/VictoryPhase.svelte web/src/components/battle/MusterPhase.svelte web/src/lib/battle/lines.ts web/src/lib/battle/lines.test.ts web/src/lib/explain.ts web/src/lib/explain.test.ts web/src/lib/dialogue web/e2e/scenes-battle-play.spec.ts web/e2e/scenes-battle-victory.spec.ts
```

(If `ReviewScroll.svelte` or `Play`'s prop threading changed, add them to both lists.)

---

### Task 8: French spacing everywhere (B3, main — CONTROLLER RULING E15)

Runs only if the controller rules for it (default: run). If ruled out instead: delete `frenchSpacing`'s calls, make `content.test.ts` forbid U+202F in the rendered lines, and fix the e2e pins that expect it (one small commit).

**Files:**
- Create: `web/src/frenchSpacing.test.ts`
- Modify: every file its first run lists (copy only), and the vitest/e2e expectations that pin those strings

- [ ] **Step 1: The guard**

```ts
// UI5 Ruling E15: French typography on every string the player reads: a narrow no-break space
// (U+202F) before « : ; ! ? » and inside « guillemets », never a plain or a no-break (U+00A0) one.
// Scans the same files as registerGuard (markup text and string literals, screenText) plus the
// scene components and the shared UI; the content files are spaced by their loader.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { screenText } from './lib/text/screenText';

const FILES = [
  ...walk('src/components'),
  ...walk('src/screens'),
  ...walk('src/lib/world'),
  ...walk('src/lib/battle'),
  ...walk('src/lib/scene'),
  'src/lib/library/shelf.ts',
  'src/lib/explain.ts',
  'src/lib/argus.ts',
  'src/lib/dictation/script.ts',
];
const BAD = /[ \u00a0][:;!?»]|«[ \u00a0]/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n).replaceAll('\\', '/');
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(svelte|ts)$/.test(n) && !n.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

describe('French spacing on screen', () => {
  it('puts U+202F before « : ; ! ? » and inside guillemets everywhere', () => {
    const report: string[] = [];
    for (const f of FILES) {
      const text = screenText(readFileSync(f, 'utf-8'), f.endsWith('.svelte') ? 'svelte' : 'ts');
      for (const m of text.matchAll(BAD)) report.push(`${f}: «${text.slice(Math.max(0, m.index! - 20), m.index! + 3)}»`);
    }
    expect(report).toEqual([]);
  });

  it('catches a planted plain space and ignores code (self-test)', () => {
    expect([...screenText('<p>Victoire !</p>', 'svelte').matchAll(BAD)]).toHaveLength(1);
    expect([...screenText("<script>const x = a ? b : c;</script><p>Victoire\u202f!</p>", 'svelte').matchAll(BAD)]).toHaveLength(0);
  });
});
```

(If `screenText` keeps code tokens that trip the pattern (a ternary inside a template literal, a CSS pseudo-class), fix `screenText` rather than widening an exception; any exception needs a controller ruling.)

- [ ] **Step 2: Fix every hit**

In `.ts` strings write the escape `\u202f` (never an invisible literal, as `normalize.ts` asks); in Svelte markup text write `{'\u202f'}` or wrap the text through `frenchSpacing()` where a whole line is copy. Keep every word as it was. Then update the pins: `grep` the e2e specs and the unit tests for the changed strings (« Victoire ! », « Passe suivante », « Il fallait : », every `toHaveText`/`toContainText`/`toBe` with a space before « : ! ? ») and write them with `\u202f`.

- [ ] **Step 3: Run the full gate**

Run: `scripts/npm.sh run test` — Expected: PASS (paste counts). Run: `scripts/npm.sh run check` — Expected: `0 errors and 0 warnings`. Run: `PW_WORKERS=4 scripts/check.sh` — Expected: `== ALL GREEN`.

- [ ] **Step 4: Commit**

```bash
git add web/src/frenchSpacing.test.ts <every file changed>
git commit -m "UI5 Task 8: French spacing everywhere - U+202F before : ; ! ? and inside guillemets on every string on screen, guarded

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/frenchSpacing.test.ts <every file changed>
```

---

### Task 9: The UI5 walk, the files served, the iPad checklist, the full gate (B4, main)

**Files:**
- Create: `web/e2e/playability-ui5.spec.ts`
- Modify: `web/e2e/scenes-audio.spec.ts` (the files served), `web/e2e/scenes-tours.spec.ts` (un-`fixme` the lyre test)
- Regenerate (only in Step 5): `docs/reviews/ui5/*`

**Interfaces:**
- Consumes: the walk pattern of `playability-ui4.spec.ts` (`Walk`, `shot`, `waitForOverlaySettled`, `settleDialogue`, `noRed`, `OUT` from `WALK_OUT`, fixed names, `clearEarlierWalk`, the origins check), every UI5 helper.
- Produces: shots `e01…e20`; `docs/reviews/ui5/notes.md` (the walk's notes and the user's iPad checklist).

- [ ] **Step 1: The files served**

Append to `scenes-audio.spec.ts`:

```ts
import { readdirSync } from 'node:fs';

test('every sound is served as audio/mp4 (Ruling E16)', async ({ request }) => {
  const files = ['music', 'sfx'].flatMap((k) => readdirSync(`public/audio/${k}`).map((f) => `/audio/${k}/${f}`));
  expect(files.length).toBe(14);
  for (const f of files) {
    const res = await request.get(f);
    expect(res.status(), f).toBe(200);
    expect(res.headers()['content-type'], f).toBe('audio/mp4');
  }
});
```

Remove the `test.fixme` from `scenes-tours.spec.ts`'s « Refaire les visites » test.

- [ ] **Step 2: The walk**

`web/e2e/playability-ui5.spec.ts`. Copy from `playability-ui4.spec.ts` (read it first) its header's `WALK_OUT` explanation (`walk-ui5` / `docs/reviews/ui5`), `OUT`, `Walk`, `waitForImagesAndFonts`, `shot`, `waitForOverlaySettled`, `settleDialogue`, `noRed`, the delete helpers and the origins check. `test.use({ tours: true })`. Hero « Nausicaa-Iris » (10H, created fresh through the API, no tours seen); a second hero « Pénélope-Aurore » is reused from the UI4 walk's setup pattern for the battle shots (tours seen). Shots (iPad landscape; `ipad-landscape-` prefix as the UI4 walk names them):

| Shot | What |
|---|---|
| e01-camp-tour-egg | the camp tour's first line (the egg), whole camp dimmed |
| e02-camp-tour-ring-parchemins | step on `parchemins`, the gold ring |
| e03-camp-tour-last | the last line, no ring |
| e04-camp-greeting | after a reload: the greeting's first line (her name) |
| e05-library-tour-lens | the library tour on `lens` |
| e06-delphi-tour-tablets | the Delphi tour on `tablets` (the Pythia) |
| e07-war-tour-eris | the war tour's last step (Éris speaks) |
| e08-war-greeting | the war tent's greeting on a second visit (Éris) |
| e09-nest-tour | the nest tour on the dragon |
| e10-cabin-tour-lyre | the cabin tour on `lyre` |
| e11-hud-sound-plate | the camp with the HUD's sound plate open, music off |
| e12-lyre-sounds | « La lyre » scrolled to « Les sons du camp », the voice muted (its warning shown) |
| e13-lyre-tours | the lyre's « Les visites du camp » and credits open |
| e14-muster-eris-start | a free text's muster: Éris's `battle.start` plate |
| e15-muster-voice-muted | the muster with the muted voice's note |
| e16-muster-retry | the muster after « Rejouer ce texte »: `battle.retry` |
| e17-victory-eris | the victory dialogue's first line (Éris) |
| e18-victory-explain | the dragon's `battle.explain` line |
| e19-victory-explanation | the explanation text line |
| e20-band-sound-plate | the compact battle band (simulated keyboard) with the sound plate open |

The walk also records each shot's `audioState` (playing, ducks) into the notes, so the reviewer can check the loop per place without sound. Delete the walk's texts in `finally`; assert a single request origin.

- [ ] **Step 3: Run the walk to the scratch dir and look at every shot**

Run: `scripts/playwright.sh --config playwright.playability.config.ts playability-ui5`
Expected: passed; `web/test-results/walk-ui5/` holds the twenty shots; the notes list no `RED at` line and one request origin. `docs/reviews/` untouched.

Open each PNG (the Read tool shows images) with the reviews' question, « does anything still look like a school form? », and: the ring circles its hotspot at both sizes, the dimming leaves the hotspot's label readable, the dialogue box never covers the ringed hotspot (move the ring's step to a line without target or report it), the sound plate reads as a bronze object and not a settings menu, its three toggles are clearly on/off without colour alone, the lyre's rows are bronze on parchment, every line shows French spacing (no lone « ! » at a line start), no emoji, no red, no grade code, no « niveau ». Fix what you find in the owning file (CSS, `TourLayer`'s ellipse, the content's `target` only with a ruling), rerun the walk, and list what you checked and what you leave for the Opus playability review.

- [ ] **Step 4: The user's iPad checklist**

Write it into `docs/reviews/ui5/notes.md` (with the walk's notes), for the controller to hand to the user. The things no e2e can check (Ruling E10 keeps real sound out of e2e):
1. Title: silent until « Entrer »; after it, the sea wind fades in.
2. Each place's loop; the crossfade on the way (no gap, no double loop).
3. Each loop's seam: listen through two turns of `camp` and `battle` (no click, no gap).
4. A dictation: the battle loop sits low under the voice and stays low while writing; proofreading: low; victory: back up.
5. The voice slider at 40 %: the dictation's voice is quieter (or, if the iPad ignores it, only the device buttons change it, as the lyre says).
6. The silent switch on: music and effects stop; note whether the dictation's voice still speaks (the platform's behaviour, Ruling E3).
7. Lock the iPad during a loop and unlock it: the loop resumes after the first tap at the latest; a phone call or Siri mid-loop: the same.
8. Rapid taps: no cascade of clicks, no effect over the voice.
9. The listening pass on the chosen sounds themselves (Ruling E17), if the user did not do it at the Task 3 checkpoint.

- [ ] **Step 5: Refresh the baseline and run the full gate**

Run: `WALK_OUT=docs/reviews/ui5 scripts/playwright.sh --config playwright.playability.config.ts playability-ui5` — Expected: passed; `docs/reviews/ui5/` holds the twenty shots and `notes.md`.
Run: `PW_WORKERS=4 scripts/check.sh`
Expected: `== ALL GREEN`: pytest (the MIME type, the settings round trip); svelte-check `0 errors and 0 warnings`; vitest (every guard, `lib/audio` with the assets budget, `lib/dialogue`, `lib/tours`, `audioGuards`, `frenchSpacing`); docker build; Playwright `desktop`, `ipad` (`scenes-audio`, `scenes-tours`, `scenes-dialogue`, every other `scenes-*`) and `chromium`. No crash retry, or name the crashed test. Run it a second time if the first needed any fix.

- [ ] **Step 6: Commit**

```bash
git add web/e2e/playability-ui5.spec.ts web/e2e/scenes-audio.spec.ts web/e2e/scenes-tours.spec.ts docs/reviews/ui5
git commit -m "UI5 Task 9: the audio and dialogue walk (tours, greetings, the lyre, the sound plate, the battle's lines), the files served, the user's iPad checklist, full gate

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/e2e/playability-ui5.spec.ts web/e2e/scenes-audio.spec.ts web/e2e/scenes-tours.spec.ts docs/reviews/ui5
```

(Add any file Step 3's fixes touched.) Then the controller dispatches the Opus playability review on `docs/reviews/ui5/` (`docs/reviews/ui5/playability-ui5.md`), the whole-branch Opus code review, and hands the iPad checklist to the user.

---

## Self-review (UI5)

- **Spec coverage.** §7: Howler (Task 1 dependency, Task 4 backend); channels music, sfx, voice with independent volume + mute (Task 1 settings/store, Task 5 lyre rows and sound plate); in the Cabin's « La lyre » and as HUD quick toggles (Task 5, E8); stored per profile in the server settings (Task 1, pytest round trip); voice volume where honoured (`utterance.volume`, Task 5, with the iPad note); a quiet loop per scene and a battle loop (catalogue E4, Task 3 files, Task 5 wiring); ducked while TTS speaks and during proofreading (E5, the engine, `voice.ts`, the battle listener); effects short and never over the voice (E6, engine test); unlock on « Entrer » (E3, engine test, e2e); CC0 only, AAC/m4a, ~8 MB music, credited (Task 3, E17, `assets.test.ts`); `sfx.ts`/`soundStore` replaced, not duplicated (E1: façade kept, soundStore deleted, synth retired). §8: content files keyed by event (Task 2), several variants and no immediate repeat (selector tests, owl e2e), speakers dragon (stage-aware), Pythia, owl, Éris (frames, content test), first-visit tours replacing instruction paragraphs, skippable, seen per profile (Tasks 2, 6, E13), the dragon delivering the explanation after a battle (Task 7), never TTS'd (content test, guard). §1: no shaming (GUILT, GENDERED), no FOMO (copy rules, the weekly line's wording), Éris in-fiction (`FORBIDDEN` over every Éris line and tour step). §10: e2e on WebKit iPad and desktop, reduced motion (tour e2e), the walk, `scripts/check.sh`.
- **Parity.** Every row of the Parity map names its task. Retired test ids: `onboarding*` (moved to `tour`, `dialogue-*`), `lyre-sounds` (moved to `lyre-channel-*`); `hud-mute` keeps its id with a new role (opener). Every spec that used them is migrated in the task that retires them.
- **Guards.** `audioGuards.test.ts` (one AudioContext, no HTML5 audio, audio ignores reduced motion), `assets.test.ts` (files, budget, lengths, credits), `content.test.ts` (keys, variants per context, placeholders, tour targets per stage, register, guilt, gender, `FORBIDDEN`, typography, length, never TTS'd), `copyRules.ts` shared by the file guards and the content guard, `frenchSpacing.test.ts` (Task 8), and the existing guards unchanged.
- **Parallel safety.** Lane S writes only `tools/audio`, `web/public/audio`, `meta.gen.json`, `assets.test.ts`, `catalog.ts`'s `mix` values, `ASSETS-LICENSES.md`, `.gitignore`, `docs/audio`. Lane A writes `lib/audio` (not `meta.gen.json`, not `catalog.ts`), `juice`, `tts.ts`, `SceneStage` (script), `Hud`, `SoundPlate`, `Icon`, `LyrePanel`, `ChannelRow`, `Title` (comment), `main.ts`, `scenes-audio`, and the HUD/lyre tests of `scenes-camp`/`scenes-cabin`. Lane D writes `DialogueBox`, `PlaceScene`, `TourLayer`, `OverlayVoice`, the six place screens, the scene modules' greeting functions, `nextStep.ts`, `PortalPanel`, `TrophiesPanel`, `kit.css` (onboarding rules), `Play`, `MusterPhase`, `VictoryPhase`, `lines.ts`, `explain.ts`, `lib/dialogue/battle.ts`, `helpers.ts` (`skipOnboarding`), `scenes-tours`, `scenes-dialogue`, the battle specs, and the onboarding/greeting tests of `scenes-camp`/`scenes-cabin`/`scenes-delphi`/`world`. Shared files: `scenes-camp.spec.ts` and `scenes-cabin.spec.ts` (distinct tests, distant hunks). B1 staged everything both lanes read (`types.ts`, the store, the catalogue, `SceneStage`'s tour flag, `overlayState.tour`, the scenes' `ambience`/`narrator`, `lines.ts`'s `erisIntroduced`, the e2e helpers and fixtures).
- **Placeholder scan.** Every step carries its code or its exact edit, with four deliberate read-then-write points named in their steps: the server test fixtures (`conftest.py`), the `seedPlay`/`createText` fields in the new e2e, `TokenError`'s field names for `stillStanding`, and `scripts/lib.sh`'s lock helper. The discretionary values are the sounds themselves (Task 3's checkpoint and the user's listening), the `mix` levels, the sound plate's and the channel rows' CSS, the tour's ellipse size, all bounded by tests or the walk.
- **Type consistency.** `TrackId`/`SfxId` (Task 1) are what the engine, the backends, `SCENE_MUSIC`, `battleTrack`, `SceneDef.ambience.music` and `BattleDef.ambience.music` use. `AudioSettings`/`ChannelId`/`ChannelSetting` (Task 1) feed the store, the engine's `setSettings`, `ProfileSettings.audio`, the lyre and the sound plate. `BattleEvent.start.backdrop` (Task 1) is read by `listenToBattle` (Task 5). `DialogueKey`/`TourId`/`DialogueCtx` (Task 2) are what `sayKey`, `tourSteps`, `shouldTour`, `SceneDef.narrator`, `nextStepKey` and the battle helpers use; `DialogueLine.key` (Task 2) becomes `data-key` in `DialogueBox`/`OverlayVoice` (Task 6), which `expectLineOf` (Task 2) reads. `overlayState.tour` (Task 2) is set by `TourLayer` (Task 6) and read by `SceneStage` (Task 2). `resetTours` (Task 2) is called by the lyre (Task 5). `audioSettings`/`setChannel` (Task 1) are read by `MusterPhase` (Task 7). Test ids used by later tasks (`hud-mute`, `hud-sound-*`, `lyre-*`, `tour`, `tour-ring`, `dialogue-*` with `data-key`/`data-speaker`, `battle-voice-muted`, `battle-voice-unmute`) are produced before they are read, except `lyre-tours` in `scenes-tours` (lane D, `fixme` until Task 9).
