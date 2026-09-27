# La Discorde — design spec

Date: 2026-09-23. Status: approved by the user in conversation (brainstorming), implementation delegated.

A browser game that trains French dictation for a 13-year-old native speaker (Swiss 10H), with profiles for siblings and friends of other ages. **The UI and all game text are in French. Code, comments, docs and commits are in English.**

## 1. Pedagogical core (non-negotiable)

1. **The problem is proofreading, not rule knowledge.** The player knows the rules but doesn't catch errors in a long block of text where nothing is in focus. The game trains *focused, one-thing-at-a-time proofreading* (relecture ciblée). Dictation is the setup; proofreading is the main game.
2. **Error mix:** ~60% agreement (subject–verb, noun group, attributes, participles), ~40% lexical spelling and grammatical homophones.
3. **The reference text is always the answer key.** Correctness is decided only by comparing with the stored reference text. NLP (spaCy) is used only to decide what to highlight, how to classify an error and how to explain it — never to decide what is correct. When NLP is uncertain, the game skips the feature for that word rather than risk teaching something wrong.
4. **Key metric: catch rate** = errors present in her draft that she fixed herself during proofreading ÷ errors present in her draft. Fixing her own error is worth much more than never making it.
5. **Scaffolding fades:** help stages go from spotlight → named passes without spotlight → error count only → nothing (like class).
6. **No discouragement:** no red crosses, no buzzers, no lives, nothing can be lost. Mistakes are framed as Éris's sabotage. Orange rather than red. Specific, kind explanations.

## 2. World and fiction

Greek mythology (public domain), inspired by what she loves (Percy Jackson, Wings of Fire, Harry Potter) without borrowing any of their characters or names.

- **Player:** a young demigod chosen by the Muses to protect written texts.
- **Antagonist: Éris, goddess of Discord**, who sows *dés-accords* (breaks grammatical agreements). Vain, theatrical, sore loser, snarky. Taunts target her own tricks, never the player's ability. She keeps a file on each player: *« Ses points faibles »* — the real stats of which errors that player misses, in Éris's voice.
- **Lieutenants = error families** (each a quest; beating one = sustained high catch rate on it):
  - **L'Hydre** — number agreement (plural of nouns/adjectives, verb -nt/-s): cut a head, two grow back.
  - **Écho** — grammatical homophones (a/à, et/est, ces/ses/c'est/s'est, son/sont, on/ont, ou/où, leur/leurs, la/l'a/là, ce/se, peu/peut/peux, quel(le)(s)/qu'elle(s), -é/-er/-ez/-ait/-ais).
  - **La Chimère** — gender agreement.
  - **Protée** — past participles (être, avoir + COD before, pronominal verbs).
  - **Les Sirènes** — subject far from the verb, subject hidden by a pronoun (*il les mange*), inverted subject, relative *qui*.
  - **Léthé** — attention fading toward the end of a long text (errors concentrated in the last third).
  - **Éris** — final/boss fights: all remaining techniques, long text, fewer aids.
- **Tools (proofreading techniques):**
  - **Les Yeux d'Argus** — spotlight passes; each pass lights only one category of words.
  - **Le Fil d'Ariane** — tap a verb then its subject to "draw the thread" (agreement chain).
  - **Le Bouclier de Persée** — check one sentence at a time, from the last to the first.
  - **La Chouette d'Athéna** — limited hint revealing where an error is.
- **Companion:** a baby dragon the player names and customises (colour/element); it grows as Éris's techniques are neutralised.
- **Places:** the camp (hub), Delphi (the Oracle), the Library of Alexandria (online texts), *Les Parchemins* (the shared library).
- **Learning mythology is a bonus:** the bestiary and texts teach real myths.

## 3. Game systems

### 3.1 Profiles
- Multiple profiles on one server. Home screen: choose your hero (card with name, avatar, dragon).
- Optional 4-digit code per profile (hashed server-side). Not security, just to stop siblings playing on the wrong profile.
- Each profile has a school level (`5H`…`11H`, Swiss HarmoS; mapping to French grades in code comments). The level sets the rule scope (e.g. no participles with avoir below 9H), the text difficulty and the starting dictation pace.
- Everything is per profile: progress, stats, Éris's file, dragon, rewards, quests.

### 3.2 Texts — *Les Parchemins* (shared library)
- Every text is stored on the server (SQLite) and visible to all profiles, tagged with who added it, date, level, source and credits (author, translator, work).
- Each profile has its own history per text: times played, best score, best catch rate. Any text can be replayed any number of times.
- Sources: `seed` (curated, shipped), `custom` (typed/pasted), `scan` (photo of a printed handout + OCR, verified by the child), `online` (Library of Alexandria).
- A text can carry a due date (a *dictée préparée* for a class test) → it becomes the Oracle's prophecy until the date passes, then stays in the library.
- The original photo of a scanned handout is stored in the data volume.
- Public domain rule: author **and translator** died before 1956 (Swiss law: life + 70 years). If unknown → reject.

### 3.3 Dictation
- Audio from the server: Kokoro-82M's French voice `ff_siwis`, synthesised by a second container (`tts`) and played through the game's audio on the voice channel; no browser voice and no fallback (amended by `2026-09-27-kokoro-voice-design.md`). Punctuation is spoken (« virgule », « point d'interrogation », « deux-points », « ouvrez les guillemets »…), as a teacher would; a sentence-ending mark is kept and followed by its capitalised name (« …froissées. Point. »). Numbers must be written as words in texts.
- Text is segmented into sentences and then *groupes de souffle* (chunks of ~4–10 words split at punctuation and natural boundaries).
- **Pace levels** (part of difficulty; the player can always lower it in free practice, rewards scale):
  1. Sentence by sentence, slow rate (~0.75), the player advances manually, unlimited replays.
  2. Chunks, rate ~0.85, limited replays (3 per text; perk *Écho* grants more).
  3. Classroom pace: each chunk read twice, auto-advance with a pause proportional to chunk length (~typing time).
  4. Test conditions: full reading, dictation (chunks read twice, auto), final full reading, no replays.

  *Amended 2026-09-27 (the pace redesign, `.superpowers/sdd/2026-09-27-kokoro-voice/pace-redesign-brief.md`):* three paces, pace 4 is gone (a save or setting at 4 loads as 3; sessions recorded at 4 stay valid). Every pace reads breath groups, each twice: the first reading, a long pause (max(3 s, 1.6 s a word)), the second reading, a short pause (max(2 s, 0.8 s a word)); then the whole text once at the end, a sentence at a time. Every line at rate 0.85. **I, Pas à pas:** waits for « Suivant » after each group; « Réécouter » gives one extra reading a group. **II, Par groupes:** moves on by itself, with « Pause »; no replay. **III, D'un bon pas:** as II with no « Pause » button, on groups about twice as long (neighbouring groups of a sentence merged while they stay at 20 words or fewer). Default by level unchanged: 5H-6H I, 7H-8H II, others III.
- Typing: a textarea with `autocorrect="off" autocapitalize="off" autocomplete="off" spellcheck="false"`, large font, positioned so the current line stays visible above the iPad on-screen keyboard. The reference text is never visible during dictation.

### 3.4 Proofreading (*relecture*) — the main game
After the dictation, the player's draft is frozen as a snapshot and she enters proofreading. She can edit any word (tap a word → inline edit).
- **Argus passes** (help stage 1): one pass at a time, each lights only its category in *her* text and dims the rest:
  - *Verbes* — conjugated verbs (+ participles for levels ≥ 8H).
  - *Groupes nominaux* — determiners, nouns, adjectives, past participles used as adjectives.
  - *Homophones* — words from the homophone table.
  - *Mots-pièges* — words from her personal list of past lexical errors.
  - Order: her weakest category first (from stats), default Verbes → GN → Homophones → Mots-pièges.
- Mapping categories onto her text: align her tokens with the reference tokens (token-level edit-distance alignment); a word of hers gets the category of the aligned reference token (from the reference annotation).
- **Help stages** (per profile, adaptive): 1 spotlight passes; 2 named passes without spotlight; 3 only the number of remaining errors (*« 4 pièges sont cachés »*); 4 nothing, she decides when she's done. Move up after catch rate ≥ 70% on 3 consecutive texts; move down after ≤ 30% on 2 consecutive texts (gently, framed in fiction).
- **Bouclier de Persée:** optional mode showing a single sentence at a time, last to first.
- **Chouette d'Athéna:** N hints per text (depends on stage) revealing one wrong word.
- **Fil d'Ariane** (from sub-project 2): tap a verb, then its subject; checked against the dependency parse only when the parse is high-confidence.

### 3.5 Grading and feedback
- Normalisation before comparison: typographic apostrophes/quotes unified, whitespace collapsed, `oe` ≡ `œ`, `ae` ≡ `æ`, non-breaking spaces ignored. Capital letters and punctuation *are* graded but in a separate, low-weight category.
- Token alignment of final text (and of the frozen draft) against the reference.
- Error classification per wrong token, in this order:
  1. `homophone` — the typed word and the expected word are in the same homophone set.
  2. `agreement` — same stem, different inflectional ending (endings: -s -x -e -es -nt -ent -ée -ées -és -ai -ais -ait -aient -er -ez -é …), subclassified with the reference annotation into `number` / `gender` / `verb` / `participle` when possible.
  3. `accent` — identical after removing diacritics.
  4. `punctuation_case` — case or punctuation only.
  5. `lexical` — everything else (and missing/extra words).
- Draft errors vs final errors → `caught` (fixed during proofreading), `missed`, `introduced` (a correct word made wrong during proofreading — counted, gently mentioned).
- Results screen: her text with each error shown (orange underline, correct form revealed on tap), grouped by category with short kid-friendly explanations (template per category/subcategory, using the subject from the annotation when available: *« “dansent” s'accorde avec son sujet “les fées” → pluriel → -nt »*).
- Score: points per correct word + big bonus per caught error + bonus for catch rate; never negative.
- Lexical errors feed the profile's **mots-pièges** list (Leitner boxes for later drills).

### 3.6 Progression and rewards (sub-project 3)
- XP from effort (finishing texts), catch rate, and self-corrections. Personal bests, not leaderboards.
- Lieutenant quests; neutralising a technique = catch rate ≥ 80% on that category over 3 different days (min. 10 occurrences).
- Weekly **Consultation de l'Oracle**: three sealed scrolls — *Le point faible* (weakest category), *Ce qui arrive à l'école* (she picks the monster matching what the class studies), *Le choix du destin* (a long-unpractised category). The chosen scroll = quest of the week with a bonus reward. Also a quest board at camp to challenge any monster.
- Dragon companion evolves (egg → hatchling → young → adult) with neutralised techniques; cosmetics, relics, divine weapons/armour, a cabin at camp, a bestiary of defeated monsters with myth facts.
- Weekly goal (e.g. 3 sessions per week) instead of daily streaks; no guilt messaging, no push notifications, no timers unless opted in.
- Session length: chapters ~10 minutes; after ~25 minutes, the dragon suggests a break.

## 4. Architecture

```
 iPad / laptop (Safari/Chrome/Edge)         Server: two Docker containers
 ┌──────────────────────────────┐          ┌──────────────────────────────────┐
 │ Svelte 5 + TypeScript SPA     │  HTTP    │ FastAPI (Python 3.12)            │
 │ - profiles, game, library     │ ◄──────► │ - serves the built SPA           │
 │ - audio (Howler), the voice   │  JSON    │ - REST API /api/...              │
 │ - grading engine (TS, pure)   │          │ - spaCy fr_core_news_lg analysis │
 │ - PWA manifest + icons        │          │ - Tesseract OCR (fra) [SP2]      │
 └──────────────────────────────┘          │ - text sourcing [SP2]            │
                                            │ - /api/tts/* → tts:8000          │
                                            │ SQLite + files in volume /data   │
                                            └──────────────────────────────────┘
                                            ┌──────────────────────────────────┐
                                            │ tts: Kokoro-82M (FastAPI, CPU)   │
                                            │ internal only, /cache volume     │
                                            └──────────────────────────────────┘
```

- **Two containers**: the game (multi-stage Dockerfile: node build of the SPA → python runtime serving it, port `8080`, volume for `/data`) and its voice (`tts/`, Kokoro-82M, internal only, volume `discorde-tts-cache`), both in `compose.yaml` (amended by `2026-09-27-kokoro-voice-design.md`). Target: **TrueNAS SCALE 25.10** (Apps → Discover → ⋮ → *Install via YAML*), and Docker Desktop on Windows for development.
- **Plain HTTP on the LAN** is the deployment; everything must work without HTTPS, and no feature needs a secure context (no service worker, no `getUserMedia`). Camera capture uses `<input type="file" accept="image/*" capture="environment">`, which works over HTTP.
- **Server-authoritative data.** Profiles, texts, sessions and stats live in SQLite on the server. The client keeps only transient state (and may cache the current session in `localStorage` to survive a reload).
- **Grading runs client-side** in a pure TypeScript module (instant feedback, unit-testable); the client submits the session (draft, final, per-token results) and the server recomputes and stores stats. The server stores the raw texts too, so stats can be recomputed if the grading logic changes.
- **Text analysis runs server-side** when a text is saved: spaCy `fr_core_news_lg` → tokens with POS, morphological features, dependency head/relation, and derived categories (`verb`, `nominal_group`, `homophone`) and, from SP2, agreement chains with a confidence flag. Stored as JSON alongside the text. Seed texts are annotated by the same code at startup/import.
- No external API calls at runtime except, from SP2, Wikisource/Gutenberg fetching (server-side, cached). No API keys. No trackers.

### Repository layout
```
server/            FastAPI app (app/), tests (tests/), requirements*.txt
web/               Vite + Svelte 5 + TS SPA (src/), unit tests (vitest), e2e (playwright)
content/seed/      curated passages (JSON), with credits
scripts/           helper scripts (run tools in Docker: npm, pytest, playwright)
docs/              specs, plans, README assets
Dockerfile, compose.yaml, compose.dev.yaml, README.md
```

### Toolchain constraint (important for implementers)
The dev machine is Windows 11 with Docker Desktop, Git Bash, **no Node.js installed**, and Python 3.14 (too new for spaCy). **All toolchains run in Docker**: `node:22` for the SPA, `python:3.12-slim` for the server and its tests, `mcr.microsoft.com/playwright` for e2e and playability screenshots. Provide wrapper scripts in `scripts/` so agents run e.g. `scripts/npm.sh run test` and `scripts/pytest.sh`. Do not install software on the host. Use `.gitattributes` with `* text=auto eol=lf`. Named Docker volumes for `node_modules` to keep bind mounts fast.

### Data model (initial)
- `profile(id, name, avatar, level, pin_hash?, created_at, settings_json)`
- `text(id, title, body, source, level, author?, translator?, work?, credits?, added_by_profile_id?, due_date?, photo_path?, annotation_json, created_at)`
- `session(id, profile_id, text_id, pace_level, help_stage, started_at, finished_at, draft, final, result_json, score, catch_rate)`
- `profile_stat(profile_id, category, occurrences, errors_in_draft, caught, missed, updated_at)` (+ daily history for mastery rules)
- `trap_word(profile_id, word, box, last_seen, misses)` (mots-pièges)
- Schema versioning with a small migration runner (numbered SQL files), so later sub-projects can extend it.

## 5. Sub-projects

### SP1 — Foundations and core loop (first playable)
- Repo scaffolding, Docker toolchain wrappers, Dockerfile, compose files, CI-like `scripts/check.sh` running all tests.
- Server: FastAPI, SQLite + migrations, profiles CRUD (+ optional PIN), texts CRUD, sessions, stats, spaCy annotation of texts (POS/morph/deps + derived categories + homophone flags), seed import at startup.
- Seed content: ~30 passages (80–200 words): classic French authors (Daudet, Maupassant, Verne, Dumas, Renard, Hugo, Sand, Töpffer, Ramuz), public-domain translations (Homer's *Odyssée* translated by Victor Bérard, Kipling translated by Fabulet & d'Humières, Stevenson translated by André Laurie, Carroll translated by Henri Bué, Grimm, Andersen), and a few original myth passages written for the game and proofread. Each with credits and level. Mix present, imparfait and passé simple, rich in agreement chains.
- SPA: profile picker (+ create profile, optional code), library list (*Les Parchemins*) with add-text (type/paste), dictation screen with the 4 pace levels, proofreading with Argus passes and help stages, Bouclier de Persée, Chouette d'Athéna, results screen with explanations, basic per-profile stats page.
- Grading engine (TS) with thorough unit tests (alignment, normalisation, classification, catch rate).
- Visual style: already themed but minimal (Greek palette: marble white, terracotta, olive, Aegean blue; a serif display font; CSS only). PWA manifest + icon so "Add to Home Screen" gives a proper icon.
- iPad-first layouts (landscape and portrait), also laptop.

### SP2 — Analysis and text sources
- Agreement chains from the dependency parse (det/amod → noun, nsubj → verb, cop + attribute, aux:pass, être + participle, conj subjects, relative *qui* antecedent) with confidence flags; subcategory classification of agreement errors; better explanations; Fil d'Ariane.
- Lexicon (Lexique 3.83, CC BY-SA) for inflected forms and homophones; 1990 spelling reform variants accepted.
- Scan in the game: photo(s) of a printed handout → preprocessing → Tesseract `fra` → the child verifies/fixes the text on screen against the paper → annotate → save (with due date option → Oracle prophecy).
- *Grimoire corrompu*: proofreading-only mode on a correct text with errors planted by Éris, weighted by the profile's weaknesses.
- Library of Alexandria: server-side fetch from Wikisource FR and Project Gutenberg from an allowlist of works (author + translator with death years), cleaning, old-spelling filter, chunking to 80–200 words, dialogue/verse/proper-noun filters, scoring by agreement density and difficulty; cached.

### SP3 — World and progression
- Camp hub, Delphi/Oracle weekly scrolls, quest board, lieutenants and boss fights, Éris's file with her voice lines, taunts and reactions, dragon companion (naming, colour, growth), rewards, bestiary with myth facts, mastery rules, weekly goal, break suggestion.
- Art generated locally with the `krea2` skill (`.claude/skills/krea2/`), consistent style file(s), background removal for sprites; "juice" (animations, sounds, particles).

### SP4 — Deployment documentation
- README: dev setup, deployment on TrueNAS 25.10, iPad "Add to Home Screen" instructions (Safari → Share → *Sur l'écran d'accueil*), backups of the data volume.

## 6. Quality gates after every sub-project
1. **Technical review**: code review against this spec and the plan, all tests green (`scripts/check.sh`), Docker image builds and runs, smoke test of the API.
2. **Playability review**: an agent plays the game in Playwright at iPad viewports (1180×820 landscape and 820×1180 portrait), takes screenshots of every screen, and evaluates it as (a) a 13-year-old fantasy fan and (b) a game designer: friction, clarity, fun, tone, pacing, feedback, whether proofreading feels like the core game. Findings are triaged and the important ones fixed before moving on.
