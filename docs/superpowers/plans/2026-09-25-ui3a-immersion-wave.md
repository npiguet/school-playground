# La Discorde — UI3a immersion wave (Wave B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every finding of the UI3a playability and immersion review (`docs/reviews/ui3/playability-ui3a.md`, 1 Critical, 14 Important, 12 Minor). Each overlay becomes an in-world object: the naming ritual, the scribe's desk, the bronze lens and the Pythia become **scrolls**. The shelves and the votive tablets become a dark-wood **table** of objects: rolled scrolls in cubbies, terracotta tablets on cords. Alexandria becomes an open **codex**. The legacy `.card` / `.btn` / chip classes leave `components/places/`, and a guard test keeps them out. The copy speaks the camp's language (no school, admin or technical register).

**Architecture:** This wave is the second half of Ruling F1 in the UI3a ledger. Wave A (the final code review fixes, `final-review.md`) lands first; this plan starts from its last commit. The foundation comes first:
- art (textures, a rolled-scroll cut-out, a portal icon);
- the three `Overlay` variants for real, plus the HUD clearance, the fade of the scene's text chrome, and an in-panel character voice;
- a kit of object classes (`kit-seal`, `kit-tag`, `kit-cubby`, `kit-roll`, `kit-tablet`, `kit-medallion`, `kit-ribbon`, `kit-link`, `kit-gauge`) and a `LevelMedallions` radio row;
- guard tests (no legacy class under `components/places/`, no form plural « (s) »);
- pure French helpers (`plural`, `de`, `longDate`, bylines, lengths, the word gauge).

Then the scene data and titles, then each place's panels (title ×2, library ×3, Delphi ×2), then a copy and consolidation pass, then the playability walk and the full gate. The routes, the panel ids, the test ids and the legacy logic stay as they are: this is a presentation and copy wave.

**Tech Stack:** Svelte 5 (runes) + TypeScript + Vite 7, vitest 3 (node env), Playwright at the 1.x version that Wave A upgraded to (Ruling F2), with WebKit `desktop` 1280×720 and `ipad` 1180×820 touch. Docker Desktop + Git Bash wrapper scripts. Krea 2 Turbo on the user's local Forge (art only, Task 1). No new npm dependency.

**Spec:** `docs/superpowers/specs/2026-09-24-scenes-ui-design.md` is binding. Read §2 (esp. 2.2 overlays, 2.4 forms, 2.7 fonts), §3, §4 (`Overlay` variants scroll / codex / table), §6 and §10 before any task. The UI3a plan `docs/superpowers/plans/2026-09-24-ui3a-places-title-library-delphi.md` holds the Rulings A1–A18 this wave keeps: routes = place + overlay, overlay navigation, `kit-form`, no emoji, the icon map. Where this plan and the spec disagree, the spec wins. Where the spec is silent, the Rulings W1–W14 below win. The repo-root `CLAUDE.md` is binding for every agent: no "pre-existing" problems, zero svelte-check warnings, no emoji.

## Prerequisite: Wave A has landed

A separate agent is fixing the whole-branch code review (`.superpowers/sdd/2026-09-24-ui3a-places-title-library-delphi/final-review.md`: I1–I3, M1–M19). **Do not start Task 2 before the controller records "Wave A complete" in `progress.md`.** Task 1 (art files only) may run earlier. Every task builds on Wave A's results and must not redo or undo them:

| Wave A item | What this plan assumes (grep for it; adapt if Wave A named it differently) |
|---|---|
| M1 | Section headings inside panels are `<h3>`; the Overlay title stays the only `<h2>`. New sub-headings in this plan are `<h4>`. |
| I1 | `replacePanel(path)` in `lib/scene/panelNav.ts` is what DeskPanel and LensPanel call after a save. Keep that call. |
| M5 | A `go(path, …)` helper in panelNav plays the tap and navigates. Every control this plan adds that navigates uses it. |
| M3 | The prophecy helpers may have moved (`nearestProphecy`/`prophecyWhen` to `lib/world/prophecy.ts`), and ProphecyCard may have moved to `components/world/`. Import from wherever they are. |
| M4 | PlaceScene renders a « Réessayer » parchment when /camp fails. Keep it, and restyle it only if it uses a legacy class. |
| M6 | `rewardKindOf(id, campStore.catalog)` everywhere. |
| M7 | PortalPanel's banner reads `ART.scenes.alexandrie`. |
| M9 | The `oeuvre` overlay's seal steps back to the works (`onClose` → `closePanel(href('alexandria'))`). |
| M12, M13 | `expectCamp` before acting; scoped `overlay-close`. The comment in `helpers.ts` is reworded. |
| M16 | Title's `.title-note` wraps and has a « Réessayer ». Task 6 restyles it as a ribbon and keeps the retry. |
| M17 | PortalWorkPanel's chunk loads carry a generation token. Keep it. |
| I2 | The Alexandria "stopped early" note is reworded server-side. Nothing to do here. |
| F2 | Playwright is upgraded. `web/package.json` and `web/package-lock.json` are not touched by this plan. |

## Global Constraints

- **Scope:** every finding of `docs/reviews/ui3/playability-ui3a.md`, mapped in the table below. Out of scope: the war tent, nest, cabin, hub remap (UI3b), the battle stage (UI4), and audio and dialogue content files (UI5). A finding part that belongs to UI3b is in the Deferred table, with its reason.
- **Mechanics unchanged (spec §1):** no API shape changes, no grading, XP or quest rule changes. The only server edit is a player-visible catalog wording (Ruling W13).
- **Feature parity (spec §3):** every row of the UI3a Parity map stays reachable: level filters, author/work/translator fields, the scan's three steps, the refresh and adopt flows, the `ecole` picker, shelving a quest, Éris's panel and the finished quests. A control may move behind a toggle (« Autres niveaux », « Qui l'a écrit ? », « Protéger ton bouclier d'un sceau »). It may never disappear.
- **Routes, panel ids, test ids:** unchanged. Every existing `data-testid` keeps its name and its meaning: `text-card`, `chip-prophecy`, `work-card`, `chunk-card`, `scroll-<key>`, `scroll-open`, `oracle-*`, `board-*`, `scan-*`, `btn-*`, `overlay-*`, `title-*`, `pin-gate`, `portal-back`. New elements get new test ids.
- **Overlays (spec §2.2, §4):** "in-world objects sliding over the dimmed scene, never a new form page"; the variants are **scroll / codex / table** (Ruling W1).
- **Forms (spec §2.4):** "Form elements stay real HTML (inputs, textareas, selects) … restyled as semi-transparent parchment / bronze / marble." Medallion rows are real `<input type="radio">` (Ruling W5). The PIN stays a real `<input>`.
- **Fonts (spec §2.7):** Cinzel is for place names, labels and titles, in caps only, never in running text. **Text titles (a parchment's title, a work's title) are Alegreya 600, 19–20 px** (playability #2). Alegreya is for dialogue, UI body and tags. Literata is for any text to defend (textareas, a chunk's preview).
- **French copy:** use every French string of this plan verbatim. It is in-world, warm and neutral in gender (profiles have no gender: never « héros » as a vocative, never an adjective agreeing with the player). No school register (« réviser », « niveau », « HarmoS », « comme à l'école »), no admin register (« profil », « facultatif »), no technical register (« scanner », « sauvegarder »), no form plural « (s) », no shaming (`manqué|raté|perdu` never on screen), and **no emoji, anywhere** (CLAUDE.md). Code, comments, docs and commit messages are in English.
- **Colour:** no red (the e2e `redScan` fails on r ≥ 200, g < 60, b < 60). Orange is Éris's colour. Wax and terracotta are brown-orange, never red. Reward text on parchment is `--reward-ink` `#8a5a1c` (UI1 #13, playability #8).
- **Accessibility:** touch targets ≥ 48 px, including everything inside an overlay (playability #25). Every overlay is an `aria-modal` dialog with the stage `inert`. Every image has an `alt` (empty for decoration). A label-less hotspot has an `aria-label`. Focus rings stay visible (`--gold-light`).
- **Motion (spec §4):** honour `prefers-reduced-motion` (no bob, no turn, fades only). The new glow pulse and the seal animations stop under reduced motion, and a static gold border stays.
- **Art (spec §6, Ruling W3):** CSS first. Krea only for what CSS can't paint: the parchment grain, the wood board, the rolled scroll and the portal icon. Generate only when Forge is idle (the GPU is shared with the user). Each texture is ≤ 150 KB WebP; each cut-out or icon is ≤ 60 KB.
- **Dependencies:** none added. `web/package.json` and `web/package-lock.json` must not change.
- **Toolchain:** no Node and no host Python for tooling. From the repo root in Git Bash:
  - `scripts/npm.sh run test -- <files>` (vitest);
  - `scripts/npm.sh run check` (svelte-check: 0 errors, 0 warnings);
  - `scripts/playwright.sh <spec-filter> [--project=<name>]`;
  - `scripts/playwright.sh --config playwright.playability.config.ts playability-ui3` (the walk);
  - `scripts/check.sh` (the full gate);
  - `tools/art/run_docker.sh <mode>` (art).
- **vitest runs in the `node` environment:** no component tests. Logic goes into `.ts` modules with tests. Components are covered by svelte-check and Playwright. CSS files are checked by reading them (`kit.test.ts` pattern).
- **e2e robustness (the suite runs with 8 parallel workers):**
  - Every fixture name comes from `uniqueName()`, never `Date.now()`.
  - Wait for scenes with `expectScene` / `waitForSceneSettled(page, sceneId)`, and for the camp with `expectCamp`.
  - Locators are scoped to their overlay (`page.getByTestId('overlay-…').getBy…`).
  - No `waitForTimeout` or fixed sleep: poll real state instead (`expect.poll`, `toHaveCount`, `getAnimations().length`).
  - Never assume the shared database holds only your texts: the library is shared by every profile, so match your own fixture by its unique title.
- **Legacy CSS:** `kit-form.css`'s legacy rules (`.btn`, `.card`, `.chip`…) stay for the camp's hero panel (UI3b moves it to the cabin), but nothing under `components/places/` may use them after this wave (Ruling W4).
- **Commits:** branch `scenes`. Other agents commit in parallel, so **always commit with a pathspec** (`git add <paths> && git commit -m "..." -- <paths>`). A `git mv` / `git rm` is committed by naming both old and new paths. Never `git add -A`, `git stash`, `git reset`, `git checkout` or `git clean`. End every commit message with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>` (or the trailer your harness gives you).
- **Verification:** before claiming a task done, run its commands and paste the real output into the report. A failing, flaky or warning test anywhere is yours to fix, or to report as an open item. Never dismiss it as pre-existing (CLAUDE.md).

## Rulings taken by this plan (the spec is silent; do not re-ask)

- **W1 Variant per overlay.**

  | Variant | Overlays | Why |
  |---|---|---|
  | scroll | title `nouveau` (naming ritual) and `tous`; library `pupitre` (desk) and `loupe` (lens); Delphi `pythie`; the camp's `heros` | A single sheet the character hands her |
  | table | library `etageres` (shelves); Delphi `tablettes` | Objects laid out on a dark wood board |
  | codex | library `portail` and `oeuvre` (Alexandria) | A two-page open book; UI3b's bestiary reuses it |

  The codex is always wide and has a fixed height. Its panel renders exactly one `.codex-spread` holding two `.codex-page` sections, left and right.
- **W2 A character's line inside an overlay is an `OverlayVoice` plate at the top of the panel, not the scene's `DialogueBox`.** The DialogueBox lives inside the stage, which is `inert` and dimmed under the backdrop while an overlay is open. The lines are static TypeScript constants in `lib/world/voices.ts` (UI3 Ruling A9 precedent; dialogue content files are UI5). They have no typewriter and are not interactive. This is how the instruction paragraphs leave the panels (playability #3, #5, #6 and recommendation 9).
- **W3 Art for the overlays.** Krea produces four files:
  - a seamless parchment tile (`textures/parchment.webp`, 512 px, ≤ 90 KB);
  - a dark wood board (`textures/wood_board.webp`, ≤ 150 KB);
  - a rolled-scroll cut-out (`ui/scroll_rolled.webp`, ≤ 45 KB);
  - a portal-arch icon (`icons/portal-arch.webp`, ≤ 25 KB by the icon pipeline).

  CSS paints the rest: the rods, torn edges, codex gutter, wax seals, cords, terracotta tablets and the gauge. The CSS gradients stay under every texture `url()`, so a page is complete if a texture is missing. A texture token that points at a file which does not exist is set to `none` (the CSS test enforces that every `url()` resolves).

  If Forge is not idle for the whole of Task 1, the implementer reports the missing files, and the controller either waits or rules CSS-only for them. Task 8 and Task 11 then use the `.roll-css` fallback. The empty stray directory `C:UsersnicolIdeaProjectsschool-playgrounddocsart` at the repo root (a mangled path from an earlier art run, untracked) is removed in Task 1.
- **W4 Legacy-class guard.** `web/src/placesKit.test.ts` fails on `btn`, `btn-primary`, `btn-ghost`, `card`, `chip`, `chip-active` or `parchment` used as a class (attribute, `class:` directive or `:global(.x)`) in any `.svelte` file under `components/places/`, plus the shared `components/QuestCard.svelte` and `components/Scroll.svelte` while it exists. Its `PENDING` set lists the files still waiting for their task. It must only shrink: a clean file left in `PENDING` fails the test too. Task 13 asserts it is empty. A second test forbids form plurals (`quête(s)`, `nouveau(x)`, `(e)`) in `components/**` and `screens/**` (playability #10).
- **W5 Levels are medallions.** `LevelSelect.svelte` (a native `<select>`) retires. `components/ui/LevelMedallions.svelte` is a `<fieldset>` of real radio inputs dressed as bronze medallions, used by the ritual (« Ta classe »), the desk and the lens (« Classe »), and the shelves' and the work's filters (« Quelle classe ? », with « Tous »). `kit-form.css` still restyles any remaining `<select>` (playability #4).
- **W6 Titles echo plaques.** One table, `OVERLAY_TITLES: Record<PanelId, string>` in `lib/world/places.ts`, names every overlay. A unit test checks that each place hotspot's label **starts** its overlay's title (« La lentille » → « La lentille de bronze »). The hub label « Le mur des quêtes » equals the tablets' title. The new-hero shield keeps « Nouveau héros » on its small plaque (a shield, not a hotspot).
- **W7 Dates as a person says them.** `longDate(iso)` is hand-rolled (« lundi 28 septembre », « jeudi 1er janvier 2099 »; the year only when it is not the current one). It is used for prophecy dates in the shelves and the Pythia's panel. `Intl` / `toLocaleDateString` are not used: Node's ICU and WebKit disagree on fr-CH punctuation, and vitest runs in Node. The legacy Play screen keeps `formatSwissDate` (UI4).
- **W8 Words.**
  - « Réviser » becomes « Te préparer », on the camp and altar ProphecyCard and in the Pythia's panel.
  - The sealed-scroll caption « Trois rouleaux scellés » becomes « Trois rouleaux à ouvrir » (the review's « Trois prophéties à ouvrir » is not used: « prophétie » already names a prepared dictation in this game).
  - « Les Parchemins » becomes « Tes parchemins ». « Scanné » becomes « Déchiffré ». « Jamais joué » becomes « Jamais défendu ».
  - « Sauvegarder dans les Parchemins » becomes « Poser sur l'étagère ». « Ajouter aux Parchemins » becomes « Poser sur tes étagères ».
- **W9 Public-domain credits** move from the work view to `ASSETS-LICENSES.md` (and the cabin's credits in UI3b). Each work still shows its author and translator (« Lewis Carroll, trad. Henri Bué »), which is the attribution.
- **W10 Voices stay neutral and short:** ≤ 160 characters per line, no vocative « héros », no emoji. The owl speaks in the library and at the title gate. The Pythia speaks in Delphi.
- **W11 HUD band token.** `--hud-band: calc(64px + env(safe-area-inset-top))` in `kit.css` is the HUD's height: 8 px padding, a 48 px chip, 8 px padding. Overlays are centred in the viewport **below** it (playability #21).
- **W12 The walk's names.** The playability config runs one worker, and only `ipad-landscape` walks the scenes. So the walk may use fixed realistic names: « Anne-Charlotte », « Élise-Marguerite » (the locked hero, which also exercises the elision « Le sceau d'Élise-Marguerite ») and « La dictée du jeudi ». It deletes any earlier copy through the API first (`DELETE /api/profiles/{id}`, `DELETE /api/texts/{id}`). Never run the walk concurrently with another walk. The functional e2e keeps `uniqueName()`.
- **W13 One name for the quest wall.** Everywhere it is « Le mur des quêtes »: the hub label, the plaque, the overlay title and the QuestCard kind label « Mur ». The catalog's player-visible reward `source` strings « … quêtes du tableau » become « … quêtes du mur » (`server/app/world/catalog.py`, wording only; update any pytest pinning them).
- **W14 One glow per scene.** A unit test runs every scene's hotspot states over fixture camps and allows at most one `isNew` at a time. The shared `nextStep(camp)` across hub and places is UI3b (see Deferred).

## Findings → tasks

| # | Sev. | Finding | Task(s) |
|---|---|---|---|
| 1 | C | Every overlay is the same form card; no variants; legacy classes | 1 (art), 2 (variants), 3 (kit + guard), 8 (shelves as cubbies), 11 (Pythia rolls), 12 (tablets on cords), 10 (codex), 13 (guard empty) |
| 2 | I | Shelves read as a school catalogue | 4 (length, history, byline), 8 |
| 3 | I | The naming ritual is a registration form | 2 (voice), 3 (medallions), 7 |
| 4 | I | Native `<select>` not restyled | 3 (select CSS), 7 and 9 (selects replaced) |
| 5 | I | The desk hides its submit and speaks like a teacher | 4 (gauge), 9 |
| 6 | I | The lens is a camera-app dialog | 5 (caption), 9 |
| 7 | I | The portal's work view is a dead end with a legal footnote | 10 |
| 8 | I | The Pythia's reward repeated four times, gold on cream | 3 (`--reward-ink`), 11, 12 |
| 9 | I | The Pythia's scrolls are cards; the picker opens below the fold; hatch | 3 (hatch), 11 |
| 10 | I | Three names for the quest wall, form plurals, a repeated line | 4 (plural + guard), 5 (names), 12 |
| 11 | I | The next-step glow is invisible | 5 |
| 12 | I | Scene plaques show through the overlays | 2 |
| 13 | I | The title's shield row: a coin and two toast pills | 6 |
| 14 | I | The PIN seal: login card, « Code de Ariane », no digit cue | 4 (`de()`), 6 |
| 15 | I | Overlay titles don't echo the landmark | 5 (W6 table + test + e2e sweep) |
| 16 | M | The tablets plaque sits on the altar | 5 |
| 17 | M | The altar prophecy card has small print | 11 |
| 18 | M | « Réviser » underlined in the Oracle | 11 |
| 19 | M | Mechanic-speak and administrative dates | 4 (`longDate`), 11 |
| 20 | M | Technical library captions; a plaque without icon | 1 (portal icon), 5 |
| 21 | M | Overlays cover the HUD | 2 |
| 22 | M | The Pythia addresses her in the masculine | 5 |
| 23 | M | The owl is scenery | 5 |
| 24 | M | The portal cards repeat the title in the byline | 4 (`workByline`), 10 |
| 25 | M | Small tap targets inside overlays | 3 (CSS floor), 2 (helper), 6–12 (per overlay), 13 (sweep) |
| 26 | M | The walk hides real truncation | 14 |
| 27 | M | The rotate-screen icon is a static outline | 13 |

## Deferred to UI3b (with reason)

| Finding part | Why not now | UI3b home |
|---|---|---|
| #1 codex for the bestiary | The bestiary is still a legacy screen until the war tent exists | UI3b Task 3 (bestiary codex on the lectern) reuses `variant="codex"` and `.codex-spread` from this wave |
| #7 credits "or the cabin's settings" | The cabin is not a place yet; the credits go to `ASSETS-LICENSES.md` now (W9) | UI3b Task 6 (lamp & lyre) links the credits |
| #10 "until UI3b removes that hotspot" (the hub's own quest-board hotspot) | The hub remap onto `hub_camp.webp` drops it; only its label changes now | UI3b Task 7 |
| #11 a single `nextStep(camp)` shared by hub and places (recommendation 5) | Needs the six-place hub; this wave guarantees one glow per scene (W14) | UI3b Task 7 |
| #23 "the same for the dragon" | The dragon's painted nest seat is UI3b | UI3b Task 7 |
| Recommendations 3, 4, 7 (hub remap, hero panel to the cabin, locked-place walk) | Already planned in UI3b | UI3b Tasks 6, 7, 9 |
| Recommendation 8 (`Results.svelte` form plural) | **Not deferred:** fixed in Task 4 with `plural()`; the guard covers `components/**` | — |

The controller copies the four UI3b rows into the UI3b dispatch notes when UI3b starts.

## File map

| File | Responsibility | Task |
|---|---|---|
| `assets/art/textures/{parchment,wood_board}.{png,json}`, `assets/art/ui/scroll_rolled{,_cut}.png` + `.json`, `assets/art/icons/portal-arch{,_cut}.png` + `.json` | Krea sources + sidecars | 1 |
| `tools/art/uiart.py`, `tools/art/run_docker.sh` | seamless tile + WebP export of the UI art | 1 |
| `web/public/art/{textures,ui,icons}/…webp` | shipped art | 1 |
| `web/src/lib/world/art.ts` (+ test) | `ART.textures`, `ART.ui`, `PLACE_ICONS` | 1 |
| `web/src/components/scene/{Overlay,OverlayVoice,SceneStage}.svelte` | variants, voice, HUD clearance, text-chrome fade | 2 |
| `web/src/styles/kit.css` (+ test) | tokens (`--hud-band`, wood, wax, clay, reward ink, texture urls), `kit-glow-strong` | 2, 5 |
| `web/src/lib/world/voices.ts` (+ test) | the overlay lines | 2 |
| `web/e2e/helpers.ts` | `expectOverlayClearsScene`, `expectOverlayTapTargets`, `chooseLevel` | 2, 7 |
| `web/e2e/scenes-overlays.spec.ts` | overlay geometry and fade, tap-target sweep | 2, 13 |
| `web/src/styles/kit-objects.css` (+ test), `web/src/main.ts` | the object kit | 3 |
| `web/src/styles/kit-form.css` (+ test) | select restyle, no hatch, 48 px floor, legend | 3 |
| `web/src/components/ui/LevelMedallions.svelte`, `web/src/lib/ui/icons.ts` (+ test) | medallion radios, `laurel` icon | 3 |
| `web/src/placesKit.test.ts` | legacy-class guard, form-plural guard | 3, 13 |
| `web/src/lib/text/french.ts` (+ test), `web/src/lib/library/shelf.ts` (+ test) | `plural`, `de`, `longDate`; length, history, bylines, gauge | 4 |
| `web/src/components/Results.svelte` | the form plural (recommendation 8) | 4 |
| `web/src/components/scene/Hotspot.svelte`, `web/src/lib/scene/{types,validate}.ts` | next-step glow, `grand`, label-less hotspot | 5 |
| `web/src/lib/world/scenes/{library,delphi,camp,title}.ts` (+ shapes, tests), `web/src/lib/world/places.ts` (+ test) | captions, icons, owl, tablets plaque, names, `OVERLAY_TITLES` | 5 |
| `web/src/screens/{Title,LibraryTent,Delphi}.svelte` | variants, titles, voices, owl | 2, 5–12 |
| `web/src/components/PinGate.svelte` | the wax-seal PIN | 6 |
| `web/src/components/places/title/HeroForm.svelte` | forge your shield | 7 |
| `web/src/components/places/library/{Shelves,Desk,Lens,Portal,PortalWork}Panel.svelte` | library overlays | 8, 9, 10 |
| `web/src/components/places/delphi/{Pythia,Tablets}Panel.svelte`, `OracleScroll.svelte` (git mv of `components/Scroll.svelte`), `components/QuestCard.svelte`, ProphecyCard | Delphi overlays | 11, 12 |
| `server/app/world/catalog.py` | « du mur » wording | 12 |
| `ASSETS-LICENSES.md` | public-domain texts note | 10 |
| `web/src/registerGuard.test.ts` | the copy-register guard | 13 |
| `web/src/components/scene/RotateScreen.svelte` | a tablet-looking icon | 13 |
| `web/e2e/playability-ui3.spec.ts` | the walk with real names and new shots | 14 |

---

### Task 1: Art: parchment grain, wood board, a rolled scroll, the portal arch

**Findings:** #1 (textures and objects), #20 (portal icon). **Model:** Opus (art direction). **May run before Wave A lands** (art files, `art.ts` and its test only).

**Files:**
- Create: `assets/art/textures/parchment.png` + `.json`, `assets/art/textures/wood_board.png` + `.json`, `assets/art/ui/scroll_rolled.png` + `.json` (+ `_cut.png`), `assets/art/icons/portal-arch.png` + `.json` (+ `_cut.png`)
- Create: `tools/art/uiart.py`
- Create (generated): `web/public/art/textures/parchment.webp`, `web/public/art/textures/wood_board.webp`, `web/public/art/ui/scroll_rolled.webp`, `web/public/art/icons/portal-arch.webp`
- Modify: `tools/art/run_docker.sh` (a `uiart` mode; `assets/art/ui` in the cutout targets), `tools/art/icons.py` (only if it lists icon ids explicitly), `web/src/lib/world/art.ts`, `web/src/lib/world/art.test.ts`, `docs/art/scenes.md` ("Cut-outs and textures"), `docs/art/style-guide.md` (§5 lessons, §6 icons)
- Remove: the empty untracked directory `C:UsersnicolIdeaProjectsschool-playgrounddocsart` at the repo root (`rmdir` it; it is not in git)

**Interfaces:**
- Consumes: `.claude/skills/krea2/generate.py`, styles `discorde-texture`, `discorde-inked-clean`; `tools/art/cutout.py`, `tools/art/icons.py`.
- Produces: `ART.textures = { marble, parchment, woodBoard }`, `ART.ui = { scrollRolled }`, `PLACE_ICONS = { portal }` (also under `ART.icons.places`), all exported from `web/src/lib/world/art.ts`. Task 2 reads the texture paths as CSS tokens. Tasks 8 and 11 use `ART.ui.scrollRolled`. Task 5 uses `PLACE_ICONS.portal`.

- [ ] **Step 1: Check that Forge is idle, and keep checking between generations**

Run: `curl -s http://127.0.0.1:7860/sdapi/v1/progress`
Idle means `"progress": 0.0` and `"state": {"job_count": 0, …}` (or an empty `job`). If a job is running, the user is generating. Do not queue behind them: wait with Monitor (an until-loop on this endpoint), then generate **one image at a time**, and check again before each generation. If Forge does not answer at all, ask the controller (never start Forge yourself). If Forge stays busy past the task's time box, commit what exists and report the missing files (Ruling W3).

- [ ] **Step 2: Generate the parchment tile (1024², seed 903, then 904/905 if needed)**

The UI2 attempt vignetted ("Parchment got a vignette", `docs/art/style-guide.md` §5). This prompt fights that with explicit negatives and the "edge to edge" wording that worked for the marble:

```bash
python .claude/skills/krea2/generate.py --style discorde-texture --size 1024x1024 --seed 903 --vscale 1.0 \
  --prompt "a flat top-down texture tile filling the whole frame edge to edge, even soft light: aged warm cream parchment paper, faint long fibres and very soft blotchy tone variation in pale honey and ivory, the four edges exactly as light as the centre, uniform all over so it can repeat as a seamless tile. (vignette:-3) (dark edges:-3) (burnt edges:-3) (torn edges:-3) (text:-3) (writing:-3) (border:-3) (objects:-3) (stains:-2)" \
  --out assets/art/textures/parchment.png
```

View it with the Read tool. **Accept** if the corners are not darker than the centre and the contrast is low (text must stay readable on it). Otherwise try seeds 904 and 905. If all three vignette, stop generating: Ruling W3 applies, and the parchment stays the CSS gradient plus the inline SVG grain of Task 2.

- [ ] **Step 3: Generate the wood board (1344×768, seed 911)**

```bash
python .claude/skills/krea2/generate.py --style discorde-texture --size 1344x768 --seed 911 --vscale 1.0 \
  --prompt "a flat top-down texture filling the whole frame edge to edge, soft even warm light: a dark walnut wooden board made of four wide planks running horizontally, fine long grain, two or three small knots, thin dark seams between the planks, gently worn and oiled, uniform all over. (vignette:-3) (nails:-2) (objects:-3) (text:-3) (border:-3) (honeycomb:-3) (tiles:-2)" \
  --out assets/art/textures/wood_board.png
```

**Accept** if it reads as planks at 1040×730 (the table overlay's size) and is dark enough for `--bronze-ink` text (the average should be close to `#3b2715`; Task 2's contrast test uses that token). A board that is too light is fixed with the `--wood-dark` overlay gradient in CSS. Don't regenerate it more than twice.

- [ ] **Step 4: Generate the rolled scroll (1344×768, seed 921) and cut it out**

```bash
python .claude/skills/krea2/generate.py --style discorde-inked-clean --size 1344x768 --seed 921 --vscale 1.0 \
  --prompt "a single object centred in the frame, large, with a margin of white around it, seen straight from the front, soft even warm light from the upper left. subject: one rolled parchment scroll lying horizontally, warm golden-cream parchment with honey-brown shading on its curve, a dark wooden rod end with a small turned gold-capped knob sticking out on each side, a thin natural cord wound once around the middle, blank, (writing:-3) (seal:-3) (ribbon:-2). One bold simple silhouette readable at a small size, (scenery:-3) (text:-3) (cast shadow on the ground:-3), isolated on a flat plain white background." \
  --out assets/art/ui/scroll_rolled.png
tools/art/run_docker.sh cutout assets/art/ui/scroll_rolled.png
```

**Accept** if the cut-out has both knobs, no white rim on a dark background, and no seal (the wax seal is drawn by CSS on top of it, so it can break). Check it on dark wood with the sheet from Step 6.

- [ ] **Step 5: Generate the portal-arch icon (1024², seed 1060) and cut it out**

```bash
python .claude/skills/krea2/generate.py --style discorde-inked-clean --size 1024x1024 --seed 1060 --vscale 1.0 \
  --prompt "a single object centred in the frame, large and filling most of the picture with a margin of white around it, seen from the front, soft even warm light from the upper left. subject: a small rounded stone archway of pale sandstone blocks, its opening filled with a swirl of warm golden light and the faint shapes of bookshelves inside, two worn steps at its foot. One bold simple silhouette made of a few large clear shapes with a clean dark ink outline all around and rich saturated colours, readable at a very small size, (scenery:-3) (text:-3) (letters:-3) (cast shadow on the ground:-3), isolated on a flat plain white background." \
  --out assets/art/icons/portal-arch.png
tools/art/run_docker.sh cutout assets/art/icons/portal-arch.png
tools/art/run_docker.sh icons webp
tools/art/run_docker.sh icons sheet
```

If `icons.py` keeps an explicit id list, add `portal-arch` to it. **Accept** if it reads as an arch at 26 px (the plaque size) on the dark label plate in `docs/art/icons-sheet.png`.

- [ ] **Step 6: Write `tools/art/uiart.py` (seamless tile + WebP export) and wire it into `run_docker.sh`**

```python
"""Export the overlay art (immersion wave, Ruling W3) to web/public/art.

    python tools/art/uiart.py webp    # assets/art/... -> web/public/art/... (TABLE below)
    python tools/art/uiart.py sheet   # docs/art/ui-art-sheet.png: each file on parchment and dark wood

A `tile` entry is made seamless first: shifted by half its size so the old
edges meet in the middle, then the original is blended back over a feathered
cross, which hides the seam without a visible mirror. Quality starts at 82 and
steps down until the file is under its budget (floor 50); a file that still
does not fit fails loudly instead of shipping over budget.

Runs inside the throwaway Docker container (tools/art/run_docker.sh uiart).
Requires: pillow
"""
import argparse
import io
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

WEB = Path("web/public/art")
# source -> (published path, long side in px, budget in KB, tile)
TABLE = {
    "assets/art/textures/parchment.png": ("textures/parchment.webp", 512, 90, True),
    "assets/art/textures/wood_board.png": ("textures/wood_board.webp", 1280, 150, False),
    "assets/art/ui/scroll_rolled_cut.png": ("ui/scroll_rolled.webp", 640, 45, False),
}


def seamless(img: Image.Image) -> Image.Image:
    w, h = img.size
    hw, hh = w // 2, h // 2
    shifted = Image.new(img.mode, (w, h))
    shifted.paste(img.crop((hw, hh, w, h)), (0, 0))
    shifted.paste(img.crop((0, hh, hw, h)), (w - hw, 0))
    shifted.paste(img.crop((hw, 0, w, hh)), (0, h - hh))
    shifted.paste(img.crop((0, 0, hw, hh)), (w - hw, h - hh))
    # `shifted` tiles seamlessly but has a seam cross in its middle; cover that cross with the
    # original (whose middle is seamless), feathered so no edge shows.
    mask = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(mask)
    band = max(8, w // 10)
    d.rectangle((hw - band, 0, hw + band, h), fill=255)
    d.rectangle((0, hh - band, w, hh + band), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(band / 2))
    return Image.composite(img, shifted, mask)


def export(src: Path, dst: Path, max_px: int, max_kb: int, tile: bool) -> None:
    img = Image.open(src)
    img = img.convert("RGBA" if "A" in img.getbands() else "RGB")
    if tile:
        img = seamless(img)
    scale = max_px / max(img.size)
    if scale < 1:
        img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    for q in range(82, 49, -4):
        buf = io.BytesIO()
        img.save(buf, "WEBP", quality=q, method=6)
        if buf.tell() <= max_kb * 1024:
            dst.write_bytes(buf.getvalue())
            print(f"{dst}  {img.width}x{img.height}  q{q}  {buf.tell() / 1024:.0f} KiB")
            return
    raise SystemExit(f"{dst}: over {max_kb} KB even at quality 50")


def sheet() -> None:
    rows = []
    for _, (rel, _px, _kb, tile) in TABLE.items():
        p = WEB / rel
        if not p.exists():
            continue
        img = Image.open(p).convert("RGBA")
        if tile:  # a 2x2 repeat shows any seam
            rep = Image.new("RGBA", (img.width * 2, img.height * 2))
            for x in (0, img.width):
                for y in (0, img.height):
                    rep.paste(img, (x, y))
            img = rep
        rows.append(img)
    out = Image.new("RGB", (1100, 340 * max(1, len(rows))), (243, 230, 200))
    for i, img in enumerate(rows):
        img.thumbnail((500, 320))
        for x, ground in ((10, (243, 230, 200)), (560, (59, 39, 21))):
            cell = Image.new("RGB", (520, 330), ground)
            cell.paste(img, (10, 5), img)
            out.paste(cell, (x, 340 * i + 5))
    out.save("docs/art/ui-art-sheet.png")
    print("docs/art/ui-art-sheet.png")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("mode", choices=["webp", "sheet"])
    a = ap.parse_args()
    if a.mode == "webp":
        for src, (rel, px, kb, tile) in TABLE.items():
            if Path(src).exists():
                export(Path(src), WEB / rel, px, kb, tile)
            else:
                print(f"skip {src} (not generated)")
    else:
        sheet()
```

In `run_docker.sh`:
- add `assets/art/ui` to `TARGETS`;
- add the mode line `uiart)  CMD="python tools/art/uiart.py ${*:-webp}" ;;`;
- document it in the header comment (`tools/art/run_docker.sh uiart [webp|sheet]`);
- extend the usage line.

Run `tools/art/run_docker.sh uiart webp` then `tools/art/run_docker.sh uiart sheet`, and view `docs/art/ui-art-sheet.png` with the Read tool. Fix a visible parchment seam by raising `band`. Never ship it.

- [ ] **Step 7: Map the files in `art.ts` and test their budgets (failing test first)**

In `web/src/lib/world/art.test.ts` add (import `PLACE_ICONS`):

```ts
  it('ships the overlay textures and objects within their budgets (immersion wave W3)', () => {
    expect(ART.textures).toEqual({
      marble: '/art/textures/marble.webp',
      parchment: '/art/textures/parchment.webp',
      woodBoard: '/art/textures/wood_board.webp',
    });
    expect(ART.ui).toEqual({ scrollRolled: '/art/ui/scroll_rolled.webp' });
    for (const p of flat(ART.textures)) expect(statSync('public' + p).size, p).toBeLessThanOrEqual(150 * 1024);
    for (const p of flat(ART.ui)) expect(statSync('public' + p).size, p).toBeLessThanOrEqual(60 * 1024);
    expect(PLACE_ICONS).toEqual({ portal: '/art/icons/portal-arch.webp' });
  });
```

Change the icon count in "maps the 35 painted icons" to **36** (its title and `toHaveLength(36)`). Run it and watch it fail. Then in `art.ts`:

```ts
/** Place plaques that carry a painted icon but are not one of the three ways in (UI3a playability #20). */
export const PLACE_ICONS = {
  portal: icon('portal-arch'),
} as const;
```

add `places: PLACE_ICONS` to `ART.icons`, and to `ART`:

```ts
  // Immersion wave (Ruling W3): overlay surfaces and objects; CSS reads the textures as tokens (kit.css).
  textures: {
    marble: '/art/textures/marble.webp',
    parchment: '/art/textures/parchment.webp',
    woodBoard: '/art/textures/wood_board.webp',
  },
  ui: {
    scrollRolled: '/art/ui/scroll_rolled.webp',
  },
```

Only map files that exist. If Ruling W3's fallback removed one, drop its key here and in the test, and say so in the report.

- [ ] **Step 8: Document the art**

In `docs/art/scenes.md` "Cut-outs and textures", add one row per new file (source PNG, WebP, size, KB) and replace the paragraph "No parchment or bronze texture is shipped…" with what shipped and how (the `seamless()` pass). In `docs/art/style-guide.md` §5, add the lessons: which parchment seed passed, and whether the "edges exactly as light as the centre" wording beat the vignette. Add the seeds to the list of generations, and add `portal-arch` to the icon table in §6.

- [ ] **Step 9: Run the tests**

Run: `scripts/npm.sh run test -- src/lib/world/art.test.ts src/lib/world/scenes/budget.test.ts`
Expected: PASS. The non-scene total stays under 2.5 MB (it is about 1.86 MB before this task; the new files add at most about 300 KB).

- [ ] **Step 10: Commit**

```bash
git add assets/art/textures assets/art/ui assets/art/icons/portal-arch.png assets/art/icons/portal-arch_cut.png assets/art/icons/portal-arch.json tools/art/uiart.py tools/art/run_docker.sh web/public/art/textures web/public/art/ui web/public/art/icons/portal-arch.webp web/src/lib/world/art.ts web/src/lib/world/art.test.ts docs/art/scenes.md docs/art/style-guide.md docs/art/ui-art-sheet.png docs/art/icons-sheet.png
git commit -m "Immersion wave: parchment grain, wood board, rolled scroll and portal-arch art for the overlays" -- assets/art/textures assets/art/ui assets/art/icons/portal-arch.png assets/art/icons/portal-arch_cut.png assets/art/icons/portal-arch.json tools/art/uiart.py tools/art/run_docker.sh web/public/art/textures web/public/art/ui web/public/art/icons/portal-arch.webp web/src/lib/world/art.ts web/src/lib/world/art.test.ts docs/art/scenes.md docs/art/style-guide.md docs/art/ui-art-sheet.png docs/art/icons-sheet.png
```

(Add `tools/art/icons.py` to both lists if you changed it. Drop any path that did not change.)

---

### Task 2: The three overlay variants, the character's voice, the HUD band, the fade of the scene's text

**Findings:** #1 (variants), #12, #21, and the voice infrastructure for #3, #5, #6. **Depends on:** Wave A. Task 1 is optional: a missing texture's token is `none`.

**Files:**
- Modify: `web/src/components/scene/Overlay.svelte`, `web/src/components/scene/SceneStage.svelte`, `web/src/styles/kit.css`, `web/src/styles/kit.test.ts`
- Create: `web/src/components/scene/OverlayVoice.svelte`, `web/src/lib/world/voices.ts`, `web/src/lib/world/voices.test.ts`, `web/e2e/scenes-overlays.spec.ts`
- Modify: `web/src/screens/LibraryTent.svelte` (shelves → `table` + voice), `web/src/components/places/library/ShelvesPanel.svelte` (drop the subtitle paragraph), `web/src/screens/Delphi.svelte` (tablets → `table`; the altar card wrapper gets `stage-text`), `web/src/screens/Title.svelte` (banners and shield plaques get `stage-text`), `web/e2e/helpers.ts`

**Interfaces:**
- Consumes: `ART.textures` (Task 1, if present), `DialogueLine` (`lib/scene/types.ts`), `overlayState` (`covered` in SceneStage).
- Produces:
  - `Overlay` props: `variant: 'scroll' | 'codex' | 'table'`, `size?: 'md' | 'wide'`, **new** `voice?: DialogueLine | null`; `data-variant` on the panel; `.overlay-surface` / `.surface-sheet` / `.scroll-rod` elements; the codex contract (`.codex-spread` > two `.codex-page`, Ruling W1).
  - SceneStage `class:has-overlay` and the `stage-text` fade convention.
  - `VOICES` from `lib/world/voices.ts`.
  - kit tokens `--hud-band`, `--wood`, `--wood-dark`, `--wax`, `--wax-dark`, `--clay`, `--clay-dark`, `--reward-ink`, `--tex-parchment`, `--tex-wood`, `--grain`; keyframes `kit-glow-strong`.
  - e2e helpers `expectOverlayClearsScene(page, overlayTestId, sceneId)` and `expectOverlayTapTargets(page, overlayTestId)`.

- [ ] **Step 1: Write the failing unit tests (tokens, contrast, texture urls, voices)**

Add to `web/src/styles/kit.test.ts` (import `existsSync` and `readdirSync` from `node:fs`):

```ts
  it('names the immersion-wave surfaces and keeps text legible on them (Ruling W1, playability #8)', () => {
    for (const t of ['wood', 'wood-dark', 'reward-ink', 'wax', 'wax-dark', 'clay', 'clay-dark']) expect(tokens[t], t).toBeDefined();
    const GOLD_LIGHT = '#f1dc9a'; // app.css --gold-light
    expect(contrastRatio(tokens['bronze-ink'], tokens['wood-dark'])).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(GOLD_LIGHT, tokens['wood-dark'])).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(tokens['reward-ink'], tokens['parchment-solid'])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(INK, tokens['clay'])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tokens['bronze-ink'], tokens['wax-dark'])).toBeGreaterThanOrEqual(4.5);
  });

  it('reserves the HUD band for the HUD (Ruling W11)', () => {
    expect(css).toMatch(/--hud-band:\s*calc\(64px \+ env\(safe-area-inset-top\)\)/);
  });

  it('points every art url of the kit stylesheets at a shipped file (Ruling W3)', () => {
    for (const f of readdirSync('src/styles').filter((n) => n.endsWith('.css'))) {
      const text = readFileSync(`src/styles/${f}`, 'utf-8');
      for (const m of text.matchAll(/url\(\s*['"]?(\/art\/[^'")]+)['"]?\s*\)/g)) {
        expect(existsSync('public' + m[1]), `${f}: ${m[1]}`).toBe(true);
      }
    }
  });
```

Add `'kit-glow-strong'` to the keyframes list of "declares the idle and tap keyframes". The existing "never defines a red" test covers the new hex tokens.

Create `web/src/lib/world/voices.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { VOICES } from './voices';

describe('overlay voices (Ruling W2, W10)', () => {
  it('gives every overlay line a speaker with a painted portrait', () => {
    for (const [id, line] of Object.entries(VOICES)) {
      expect(['owl', 'pythia'], id).toContain(line.speaker);
      expect(existsSync('public' + line.portrait), id).toBe(true);
    }
  });

  it('keeps each line short, neutral and free of form plurals', () => {
    for (const [id, line] of Object.entries(VOICES)) {
      expect(line.text.length, id).toBeLessThanOrEqual(160);
      expect(line.text, id).not.toMatch(/\bhéros\b/i);
      expect(line.text, id).not.toMatch(/\((s|x|e|es)\)/);
    }
  });

  it('turns the old instruction paragraphs into the owl and the Pythia speaking', () => {
    expect(VOICES.desk.text).toBe('Hou ! Entre 80 et 200 mots, et les nombres en lettres, sinon Éris triche.');
    expect(VOICES.lens.text).toContain('une photo par page');
    expect(VOICES.pythia.speaker).toBe('pythia');
  });
});
```

Run: `scripts/npm.sh run test -- src/styles/kit.test.ts src/lib/world/voices.test.ts`
Expected: FAIL (missing tokens; `Cannot find module './voices'`).

- [ ] **Step 2: Add the tokens and the stronger glow to `kit.css`**

In the `:root` block, after `--scrim`:

```css
  /* Immersion wave (Ruling W1, W3, W11). The HUD band: 8 px padding + a 48 px chip + 8 px padding
     (Hud.svelte); overlays centre below it so they never cut the hero chip (playability #21). */
  --hud-band: calc(64px + env(safe-area-inset-top));
  /* The table overlay's dark wood, the wax of seals, the clay of votive tablets. */
  --wood: #5a3d24;
  --wood-dark: #3b2715;
  --wax: #a84a32;
  --wax-dark: #6e2c1c;
  --clay: #d8a47f;
  --clay-dark: #9c5b38;
  /* Reward text on parchment: a darker bronze, gold on cream was below 4.5:1 (UI1 #13). */
  --reward-ink: #8a5a1c;
  /* Painted surfaces (Task 1). A token whose file was not delivered is `none` (Ruling W3); the
     gradients painted under every texture keep the page complete either way. */
  --tex-parchment: url('/art/textures/parchment.webp');
  --tex-wood: url('/art/textures/wood_board.webp');
  /* Paper and clay grain: an inline SVG noise tile (no file, no request). */
  --grain: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .35 0 0 0 0 .22 0 0 0 0 .1 0 0 0 .16 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
```

Next to `@keyframes kit-glow`:

```css
/* The next step's glow (playability #11): stronger and a little faster than the idle glow. */
@keyframes kit-glow-strong {
  0%,
  100% {
    opacity: 0.45;
  }
  50% {
    opacity: 0.85;
  }
}
```

- [ ] **Step 3: Write `lib/world/voices.ts`**

```ts
// A character's line inside an overlay (immersion wave Ruling W2): the old instruction paragraphs,
// spoken by the place's character from the top of the panel (OverlayVoice.svelte). Static lines,
// UI3 Ruling A9's precedent; the dialogue content files are UI5.
import { ART } from './art';
import type { DialogueLine } from '../scene/types';

const owl = (text: string): DialogueLine => ({ speaker: 'owl', name: "La chouette d'Athéna", portrait: ART.characters.owl, text });
const pythia = (text: string): DialogueLine => ({ speaker: 'pythia', name: 'La Pythie', portrait: ART.characters.pythia, text });

export const VOICES = {
  ritual: owl('Hou ! Écris ton prénom sur la bannière, choisis ton emblème, et ton bouclier rejoindra la porte du camp.'),
  shelves: owl("Hou ! Choisis un parchemin à protéger des dés-accords d'Éris."),
  desk: owl('Hou ! Entre 80 et 200 mots, et les nombres en lettres, sinon Éris triche.'),
  lens: owl("Hou ! Pose la feuille imprimée bien à plat, en pleine lumière : une photo par page. L'écriture à la main, je ne sais pas la lire."),
  portal: owl('Hou ! Choisis une œuvre, puis un rouleau à poser sur tes étagères.'),
  pythia: pythia("Un seul rouleau s'ouvre chaque semaine, et les trois promettent la même récompense. Choisis celui qui t'appelle."),
} as const satisfies Record<string, DialogueLine>;
```

- [ ] **Step 4: Write `OverlayVoice.svelte`**

```svelte
<script lang="ts">
  // A character speaking inside an overlay (immersion wave Ruling W2). The scene's DialogueBox sits
  // on the inert, dimmed stage under the backdrop, so the owl or the Pythia speaks from this plate
  // at the top of the panel instead. Static, no typewriter, not a control.
  import type { DialogueLine } from '../../lib/scene/types';

  let { line }: { line: DialogueLine } = $props();
</script>

<figure class="overlay-voice" data-testid="overlay-voice" data-speaker={line.speaker}>
  <img class="voice-portrait" src={line.portrait} alt="" style:filter={line.portraitFilter} />
  <figcaption class="voice-body">
    <span class="voice-name">{line.name}</span>
    <span class="voice-text">{line.text}</span>
  </figcaption>
</figure>

<style>
  .overlay-voice {
    flex: none;
    display: flex;
    align-items: center;
    gap: 14px;
    margin: 0 0 14px;
    padding: 8px 16px 8px 8px;
    border: 1px solid var(--bronze-light);
    border-radius: 12px;
    background: linear-gradient(180deg, rgba(21, 18, 26, 0.84), rgba(21, 18, 26, 0.72));
    color: var(--bronze-ink);
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.3);
  }
  /* Match DialogueBox's portrait treatment (read its CSS and copy the crop if it has one). */
  .voice-portrait {
    flex-shrink: 0;
    width: 64px;
    height: 64px;
    object-fit: contain;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(241, 220, 154, 0.28), transparent 70%);
  }
  .voice-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .voice-name {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 13px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--gold-light);
  }
  .voice-text {
    font-family: var(--font-body);
    font-style: italic;
    font-size: 18px;
    line-height: 1.35;
  }
</style>
```

- [ ] **Step 5: Rebuild `Overlay.svelte` with real variants**

Keep everything in `<script>`: the `closing` guard, `leave`, `modal`, the transitions and their comments. Import `OverlayVoice` and the `DialogueLine` type. Add the prop `voice = null` (`voice?: DialogueLine | null`). Update the header comment: the variants are real objects now (Ruling W1). Replace the panel's markup (the backdrop button is unchanged):

```svelte
<div
  use:modal={{ returnFocus }}
  class="overlay-panel overlay-{variant}"
  class:overlay-wide={size === 'wide' || variant === 'codex'}
  role="dialog"
  aria-modal="true"
  aria-label={title}
  data-testid={testId}
  data-variant={variant}
  tabindex="-1"
  in:fly|global={{ y: reduced ? 0 : 40, duration: reduced ? 200 : 280, opacity: 0 }}
  out:leave={{ duration: 160 }}
>
  <!-- The object itself (Ruling W1): a parchment sheet with torn sides, a dark wood board, or an
       open book. Drawn behind the content, never a control. -->
  <div class="overlay-surface" aria-hidden="true"><div class="surface-sheet"></div></div>
  {#if variant === 'scroll'}
    <span class="scroll-rod rod-top" aria-hidden="true"></span>
    <span class="scroll-rod rod-bottom" aria-hidden="true"></span>
  {/if}
  <header class="overlay-head">
    <h2 class="overlay-title">{title}</h2>
    <!-- Playability #4: a wax-seal close mark rather than a « Fermer » button (a tap outside closes too). -->
    <button type="button" class="overlay-seal" data-testid="overlay-close" aria-label="Fermer" onclick={onClose}>
      <Icon name="close" size={22} />
    </button>
  </header>
  {#if voice}<OverlayVoice line={voice} />{/if}
  <div class="overlay-body kit-form">{@render children()}</div>
</div>
```

The panel no longer takes `kit-parchment` / `kit-scroll` (the surface draws the object). Replace the `<style>` rules `.overlay-panel`, `.overlay-wide`, `.overlay-codex`, `.overlay-table` with the rules below. Keep `.overlay-backdrop`, `.overlay-head`, `.overlay-seal`, `.overlay-seal:focus-visible` and `.overlay-title`, and add `color: var(--ink);` to `.overlay-title`.

```css
  .overlay-panel {
    position: fixed;
    z-index: var(--z-overlay);
    left: 50%;
    /* Centred in the part of the screen below the HUD band (playability #21, Ruling W11). */
    top: calc(var(--hud-band) + (100dvh - var(--hud-band)) / 2);
    transform: translate(-50%, -50%);
    width: min(640px, calc(100vw - 56px));
    max-height: calc(100dvh - var(--hud-band) - 36px);
    display: flex;
    flex-direction: column;
    padding: 26px 30px 22px;
    outline: none;
    isolation: isolate;
    color: var(--ink);
  }
  .overlay-wide {
    width: min(1040px, calc(100vw - 56px));
  }
  .overlay-head {
    flex: none;
  }
  /* The body scrolls between the rods; the rods and the seal stay put. */
  .overlay-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
    overscroll-behavior: contain;
    padding-right: 4px;
  }
  .overlay-surface {
    position: absolute;
    inset: 0;
    z-index: -1;
    pointer-events: none;
  }
  .surface-sheet {
    position: absolute;
    inset: 0;
  }

  /* --- scroll: parchment with torn sides between two wooden rods --------------------------- */
  /* The shadow sits on the wrapper: a mask would clip a shadow drawn on the masked sheet itself. */
  .overlay-scroll .overlay-surface {
    inset: 4px 0;
    filter: drop-shadow(0 10px 22px rgba(0, 0, 0, 0.45));
  }
  .overlay-scroll .surface-sheet {
    --torn-l: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='160'%3E%3Cpath d='M16 0H7L10 9 6 17 11 27 5 36 9 47 4 55 10 67 6 76 11 86 5 94 9 106 4 115 10 125 6 133 11 144 7 160H16Z'/%3E%3C/svg%3E");
    --torn-r: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='160'%3E%3Cpath d='M0 0H9L6 9 10 17 5 27 11 36 7 47 12 55 6 67 10 76 5 86 11 94 7 106 12 115 6 125 10 133 5 144 9 160H0Z'/%3E%3C/svg%3E");
    background:
      radial-gradient(ellipse at 20% 0%, rgba(255, 255, 255, 0.3), transparent 60%),
      linear-gradient(90deg, rgba(92, 64, 24, 0.14), transparent 8%, transparent 92%, rgba(92, 64, 24, 0.14)),
      var(--tex-parchment) 0 0 / 512px 512px repeat,
      var(--grain),
      linear-gradient(180deg, #f6ecd4, #ecdbb8);
    -webkit-mask:
      var(--torn-l) left top / 16px 160px repeat-y,
      linear-gradient(#000 0 0) center / calc(100% - 30px) 100% no-repeat,
      var(--torn-r) right top / 16px 160px repeat-y;
    mask:
      var(--torn-l) left top / 16px 160px repeat-y,
      linear-gradient(#000 0 0) center / calc(100% - 30px) 100% no-repeat,
      var(--torn-r) right top / 16px 160px repeat-y;
  }
  .scroll-rod {
    position: absolute;
    left: -18px;
    right: -18px;
    height: 22px;
    border-radius: 11px;
    z-index: 1;
    background: linear-gradient(180deg, #b98a57 0%, #7a5230 45%, #4e321b 100%);
    box-shadow:
      inset 0 2px 0 rgba(255, 236, 200, 0.35),
      0 3px 6px rgba(0, 0, 0, 0.45);
    pointer-events: none;
  }
  /* Turned gold-capped knobs at both ends of each rod. */
  .scroll-rod::before,
  .scroll-rod::after {
    content: '';
    position: absolute;
    top: -5px;
    width: 22px;
    height: 32px;
    border-radius: 40%;
    background: radial-gradient(circle at 40% 35%, var(--gold-light), var(--bronze) 60%, var(--bronze-dark));
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
  }
  .scroll-rod::before {
    left: -14px;
  }
  .scroll-rod::after {
    right: -14px;
  }
  .rod-top {
    top: -11px;
  }
  .rod-bottom {
    bottom: -11px;
  }

  /* --- table: a dark wood board; objects lie on it, text on the wood is light -------------- */
  .overlay-table .surface-sheet {
    border-radius: 14px;
    background:
      linear-gradient(180deg, rgba(59, 39, 21, 0.35), rgba(59, 39, 21, 0.55)),
      var(--tex-wood) center / cover no-repeat,
      linear-gradient(180deg, var(--wood), var(--wood-dark));
    box-shadow:
      inset 0 0 0 3px #2a1b0e,
      inset 0 0 0 5px rgba(241, 220, 154, 0.22),
      inset 0 0 60px rgba(0, 0, 0, 0.55),
      0 14px 36px rgba(0, 0, 0, 0.5);
  }
  .overlay-table .overlay-title {
    color: var(--gold-light);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  }
  /* Text that sits on the wood itself; objects (tags, sheets, tablets) set their own ink.
     `.overlay-table .overlay-body` (0,2,0) beats `.kit-form`'s ink (0,1,0). */
  .overlay-table .overlay-body {
    color: var(--bronze-ink);
  }
  .overlay-table .overlay-body :global(:is(h3, h4)) {
    color: var(--gold-light);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  }
  .overlay-table .overlay-body :global(.muted) {
    color: rgba(255, 247, 230, 0.86);
  }
  .overlay-table .overlay-body :global(.orange) {
    color: #f2a15e;
  }

  /* --- codex: an open book, two pages and a gutter; always wide, fixed height ---------------- */
  .overlay-codex {
    height: calc(100dvh - var(--hud-band) - 36px);
    padding: 30px 44px 26px;
  }
  .overlay-codex .surface-sheet {
    border: 12px solid #4a2c17;
    border-radius: 12px 18px 18px 12px;
    background:
      linear-gradient(
        90deg,
        rgba(60, 36, 16, 0.22) 0,
        transparent 5%,
        transparent 44%,
        rgba(60, 36, 16, 0.18) 48.6%,
        rgba(40, 24, 10, 0.42) 50%,
        rgba(60, 36, 16, 0.18) 51.4%,
        transparent 56%,
        transparent 95%,
        rgba(60, 36, 16, 0.22) 100%
      ),
      var(--tex-parchment) 0 0 / 512px 512px repeat,
      var(--grain),
      linear-gradient(180deg, #f6ecd4, #ecdbb8);
    box-shadow:
      0 0 0 2px #2e1a0c,
      inset 0 0 40px rgba(92, 64, 24, 0.25),
      0 14px 36px rgba(0, 0, 0, 0.5);
  }
  .overlay-codex .overlay-head {
    position: relative;
    justify-content: center;
  }
  .overlay-codex .overlay-title {
    text-align: center;
  }
  .overlay-codex .overlay-seal {
    position: absolute;
    right: 0;
  }
  .overlay-codex .overlay-body {
    overflow: hidden;
    display: flex;
    padding-right: 0;
  }
  /* Ruling W1's contract: a codex panel renders one .codex-spread with two .codex-page sections;
     the grid's centre is the book's gutter (the panel padding is symmetric). */
  .overlay-codex .overlay-body > :global(.codex-spread) {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: 72px;
  }
  .overlay-codex .overlay-body :global(.codex-page) {
    min-height: 0;
    overflow: auto;
    overscroll-behavior: contain;
  }
  @media (max-width: 900px) {
    .overlay-codex .overlay-body {
      overflow: auto;
      display: block;
    }
    .overlay-codex .overlay-body > :global(.codex-spread) {
      grid-template-columns: 1fr;
    }
    .overlay-codex .overlay-body :global(.codex-page) {
      overflow: visible;
    }
  }
```

Check `kit.css`'s `.kit-scroll` and `.kit-parchment`: they are still used elsewhere (PinGate, ProphecyCard, Camp); keep them.

- [ ] **Step 6: Fade the scene's text chrome while an overlay is open (`SceneStage.svelte`)**

Add `class:has-overlay={covered}` to `<main class="scene-stage">`, and to its `<style>`:

```css
  /* Playability #12: while an overlay is open, the scene's own words (plaques, labels, banners,
     the altar card...) fade out so they never ghost through the panel; the painting stays. A place
     marks such an in-scene text object with `stage-text`. */
  .scene-stage :global(:is(.hotspot-label, .hotspot-leader, .stage-plaque, .stage-text)) {
    transition: opacity 0.2s ease;
  }
  .scene-stage.has-overlay :global(:is(.hotspot-label, .hotspot-leader, .stage-plaque, .stage-text)) {
    opacity: 0;
  }
```

Add `stage-text` to Title's `.title-hint` and `.title-note` banners and to each `.shield-plaque`. Add it to Delphi's `.altar-prophecy` wrapper and to the camp's prophecy wrapper (the same card).

- [ ] **Step 7: Put the shelves and the tablets on the table; the shelves' voice**

- `LibraryTent.svelte`: `<Overlay variant="table" size="wide" … testId="overlay-shelves" voice={VOICES.shelves}>`.
- `ShelvesPanel.svelte`: delete `<p class="subtitle muted">Choisis un texte à protéger des dés-accords d'Éris.</p>` (the owl says it now) and its `.subtitle` rule if nothing else uses it.
- `Delphi.svelte`: `<Overlay variant="table" size="wide" … testId="overlay-tablets">`.

The portal and the work stay `scroll` until Task 10.

- [ ] **Step 8: Add the e2e helpers (`web/e2e/helpers.ts`)**

```ts
// Immersion wave (playability #12, #21): an open overlay - its rods included - starts below the
// HUD, and the scene's text chrome behind it has faded out (SceneStage `has-overlay`).
export async function expectOverlayClearsScene(page: Page, overlayTestId: string, sceneId: string) {
  const panel = page.getByTestId(overlayTestId);
  await expect(panel).toBeVisible();
  await expect.poll(() => panel.evaluate((el) => el.getAnimations().length)).toBe(0);
  const { top, hudBottom } = await page.evaluate(
    ({ id, sid }) => {
      const p = document.querySelector(`[data-testid="${id}"]`)!;
      const parts = [p, ...Array.from(p.querySelectorAll('.scroll-rod'))];
      const hud = document.querySelector(`[data-testid="scene-${sid}"] [data-testid="stage-hud"]`);
      const hudItems = hud ? Array.from(hud.querySelectorAll('*')) : [];
      return {
        top: Math.min(...parts.map((e) => e.getBoundingClientRect().top)),
        hudBottom: Math.max(0, ...hudItems.map((e) => e.getBoundingClientRect().bottom)),
      };
    },
    { id: overlayTestId, sid: sceneId },
  );
  expect(top, `${overlayTestId} starts below the HUD`).toBeGreaterThanOrEqual(hudBottom);
  await expect
    .poll(() =>
      page.evaluate(
        (sid) =>
          Array.from(document.querySelectorAll(`[data-testid="scene-${sid}"] :is(.hotspot-label, .stage-plaque, .stage-text)`)).filter(
            (e) => getComputedStyle(e).opacity !== '0',
          ).length,
        sceneId,
      ),
    )
    .toBe(0);
}

// Playability #25: every control inside an overlay is a 48 px touch target. A radio or file input
// is measured through its label (the input itself is hidden or stretched over it); content inside
// a closed <details> has no box and is skipped.
export async function expectOverlayTapTargets(page: Page, overlayTestId: string) {
  const small = await page.getByTestId(overlayTestId).evaluate((root) => {
    const sel = [
      'button',
      'a[href]',
      'summary',
      'select',
      'input:not([type=radio]):not([type=checkbox]):not([type=file]):not([type=hidden])',
      'label:has(> input[type=radio])',
      'label:has(> input[type=file])',
    ].join(', ');
    return Array.from(root.querySelectorAll<HTMLElement>(sel))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ el, r }) => r.width > 2 && r.height > 2 && getComputedStyle(el).visibility !== 'hidden')
      .filter(({ r }) => Math.min(r.width, r.height) < 48)
      .map(({ el, r }) => `${el.tagName.toLowerCase()} « ${(el.textContent ?? '').trim().slice(0, 30)} » ${Math.round(r.width)}×${Math.round(r.height)}`);
  });
  expect(small, `${overlayTestId}: controls under 48 px`).toEqual([]);
}
```

- [ ] **Step 9: Write `web/e2e/scenes-overlays.spec.ts`**

```ts
import { test, expect } from '@playwright/test';
import { createProfileApi, expectOverlayClearsScene, expectScene, tap, uniqueName } from './helpers';

// Immersion wave Task 2 (scenes spec §2.2, §4; playability #1, #12, #21): the overlays are objects
// (scroll, table, codex), they sit below the HUD, and the scene's words fade out behind them.
// Task 13 extends this file into the sweep of every overlay.

const hero = (project: string) => uniqueName(`Objet-${project}`);

test('the shelves lie on a wood table below the HUD; the owl speaks; the tent labels fade', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, hero(testInfo.project.name));
  await page.goto(`/#/p/${id}/tente-parchemins`);
  await expectScene(page, 'library');
  await page.getByTestId('dialogue-skip').click();
  await tap(page.getByTestId('library-shelves'), testInfo);
  const shelves = page.getByTestId('overlay-shelves');
  await expect(shelves).toHaveAttribute('data-variant', 'table');
  await expect(shelves.getByTestId('overlay-voice')).toHaveAttribute('data-speaker', 'owl');
  await expect(shelves.getByTestId('overlay-voice')).toContainText("dés-accords d'Éris");
  await expectOverlayClearsScene(page, 'overlay-shelves', 'library');
  // The labels come back once it closes.
  await shelves.getByTestId('overlay-close').click();
  await expect(shelves).toHaveCount(0);
  await expect
    .poll(() => page.getByTestId('library-shelves').locator('.hotspot-label').evaluate((e) => getComputedStyle(e).opacity))
    .toBe('1');
});

test('the desk is a scroll: two rods, torn sides, below the HUD', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, hero(testInfo.project.name));
  await page.goto(`/#/p/${id}/texts/new`);
  const desk = page.getByTestId('overlay-desk');
  await expect(desk).toHaveAttribute('data-variant', 'scroll');
  await expect(desk.locator('.scroll-rod')).toHaveCount(2);
  const mask = await desk
    .locator('.surface-sheet')
    .evaluate((e) => getComputedStyle(e).getPropertyValue('-webkit-mask-image') || getComputedStyle(e).getPropertyValue('mask-image'));
  expect(mask).toContain('data:image/svg+xml');
  await expectOverlayClearsScene(page, 'overlay-desk', 'library');
});

test('the quest tablets hang on a wood table; the temple plaque and labels fade', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, hero(testInfo.project.name));
  await page.goto(`/#/p/${id}/quetes`);
  await expect(page.getByTestId('overlay-tablets')).toHaveAttribute('data-variant', 'table');
  await expectOverlayClearsScene(page, 'overlay-tablets', 'delphi');
});
```

(A deep link opens the overlay together with its scene. `expectOverlayClearsScene` waits for the panel's own animations, and its opacity poll waits for the labels' fade.)

- [ ] **Step 10: Run the tests**

```bash
scripts/npm.sh run test -- src/styles/kit.test.ts src/lib/world/voices.test.ts
scripts/npm.sh run check
scripts/playwright.sh scenes-overlays
scripts/playwright.sh scenes-library scenes-delphi scenes-title scenes-camp
```

Expected: PASS, 0 svelte-check errors and 0 warnings. The existing place specs still pass: the test ids, headings and routes are unchanged.

- [ ] **Step 11: Look at it**

Take iPad-size screenshots of the shelves, the desk and the tablets through a scratch spec that you do not commit (pattern: `playability-ui3.spec.ts`'s `shot()`), and view them with the Read tool. Check:
- the wood reads as wood, with light text;
- the desk scroll shows both rods, both knobs and torn sides;
- the hero chip is fully visible above every panel;
- nothing of the tent's plaques shows through.

Put the observations in the report.

- [ ] **Step 12: Commit**

```bash
git add web/src/components/scene/Overlay.svelte web/src/components/scene/OverlayVoice.svelte web/src/components/scene/SceneStage.svelte web/src/styles/kit.css web/src/styles/kit.test.ts web/src/lib/world/voices.ts web/src/lib/world/voices.test.ts web/src/screens/LibraryTent.svelte web/src/screens/Delphi.svelte web/src/screens/Title.svelte web/src/screens/Camp.svelte web/src/components/places/library/ShelvesPanel.svelte web/e2e/helpers.ts web/e2e/scenes-overlays.spec.ts
git commit -m "Immersion wave: scroll, table and codex overlay variants, in-panel voices, HUD clearance, scene text fades under overlays" -- web/src/components/scene/Overlay.svelte web/src/components/scene/OverlayVoice.svelte web/src/components/scene/SceneStage.svelte web/src/styles/kit.css web/src/styles/kit.test.ts web/src/lib/world/voices.ts web/src/lib/world/voices.test.ts web/src/screens/LibraryTent.svelte web/src/screens/Delphi.svelte web/src/screens/Title.svelte web/src/screens/Camp.svelte web/src/components/places/library/ShelvesPanel.svelte web/e2e/helpers.ts web/e2e/scenes-overlays.spec.ts
```

---

### Task 3: The object kit, level medallions, the in-world select, and the legacy-class guard

**Findings:** #1 (kit classes + guard), #4 (select CSS), #9 (no hatch), #25 (48 px floor). **Depends on:** Task 2 (tokens).

**Files:**
- Create: `web/src/styles/kit-objects.css`, `web/src/styles/kit-objects.test.ts`, `web/src/components/ui/LevelMedallions.svelte`, `web/src/placesKit.test.ts`
- Modify: `web/src/main.ts` (import after `kit-form.css`), `web/src/styles/kit-form.css`, `web/src/styles/kit-form.test.ts`, `web/src/lib/ui/icons.ts` (+ `icons.test.ts` if it lists names)

**Interfaces:**
- Consumes: kit tokens (Task 2), `LEVELS` (`lib/levels.ts`), `Icon`.
- Produces:
  - CSS classes: `kit-seal` (+ `is-broken`, `.seal-laurel`), `kit-tag` (+ `kit-tag-title`, `kit-tag-meta`, `kit-stamp`, `kit-prophecy`), `kit-cubby`, `kit-roll` (+ `is-upright`, `data-length`, `.roll-art`, `.roll-css`), `kit-sheet` (an unrolled sheet with rods), `kit-tablet` (+ `.pressed`, `is-asleep`, `kit-tablet-stamp`, `kit-tablet-ribbon`), `kit-medallion` (+ `is-small`), `kit-ribbon`, `kit-link`, `kit-note` (`data-tone="olive" | "eris"`), `kit-gauge` (+ `-track`, `-band`, `-fill`, `-label`), `kit-bronze.is-quiet`, `kit-bronze:disabled`, `label.kit-bronze`.
  - `<LevelMedallions legend name bind:value options? onchange? testId? />`.
  - `Icon` name `laurel`.
  - The guard `placesKit.test.ts` with its shrinking `PENDING` set.

- [ ] **Step 1: Write the failing tests**

`web/src/styles/kit-objects.test.ts`:

```ts
// Immersion wave Task 3 (playability #1): the object kit the overlays are built from.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync('src/styles/kit-objects.css', 'utf-8');

describe('object kit', () => {
  it('defines every object class the places use', () => {
    for (const cls of [
      'kit-seal', 'kit-tag', 'kit-tag-title', 'kit-tag-meta', 'kit-stamp', 'kit-prophecy', 'kit-cubby', 'kit-roll',
      'roll-css', 'kit-sheet', 'kit-tablet', 'kit-medallion', 'kit-ribbon', 'kit-link', 'kit-note', 'kit-gauge',
    ]) {
      expect(css, cls).toMatch(new RegExp(`\\.${cls}[\\s,.:{\\[]`));
    }
    expect(css).toMatch(/\.kit-seal\.is-broken/);
    expect(css).toMatch(/\.kit-bronze\.is-quiet/);
    expect(css).toMatch(/\.kit-bronze:disabled/);
  });

  it('draws no hatching and no red (playability #9, spec ethics)', () => {
    expect(css).not.toMatch(/repeating-linear-gradient\(\s*115deg/);
    for (const m of css.matchAll(/#([0-9a-f]{6})\b/gi)) {
      const n = parseInt(m[1], 16);
      const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      expect(r >= 200 && g < 60 && b < 60, m[0]).toBe(false);
    }
  });

  it('honours reduced motion for its own animations', () => {
    if (/@keyframes/.test(css)) expect(css).toMatch(/prefers-reduced-motion/);
  });

  it('is loaded after the form kit, so its label-based classes win the cascade', () => {
    const main = readFileSync('src/main.ts', 'utf-8');
    expect(main.indexOf("'./styles/kit-objects.css'")).toBeGreaterThan(main.indexOf("'./styles/kit-form.css'"));
  });
});
```

Add to `web/src/styles/kit-form.test.ts`:

```ts
  it('restyles a native select as a parchment field with a bronze chevron (playability #4)', () => {
    const rule = /\.kit-form select\s*\{[^}]*\}/g;
    const all = [...css.matchAll(rule)].map((m) => m[0]).join('\n');
    expect(all).toMatch(/appearance:\s*none/);
    expect(all).toMatch(/-webkit-appearance:\s*none/);
    expect(all).toMatch(/var\(--chevron\)/);
  });

  it('drops the hatch from chips (playability #9) and gives legends the label face (playability #3)', () => {
    const chip = /\.kit-form \.chip\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(chip).not.toMatch(/repeating-linear-gradient/);
    expect(css).toMatch(/\.kit-form label,\s*\n?\s*\.kit-form legend/);
  });

  it('keeps every control in an overlay a 48 px touch target (playability #25)', () => {
    expect(css).toMatch(/\.kit-form :is\(button, summary, a\.kit-bronze, a\.kit-link\)\s*\{[^}]*min-height:\s*48px/);
  });
```

`web/src/placesKit.test.ts`:

```ts
// Immersion wave Ruling W4 (playability #1): the places are built from kit classes only. Fails on a
// legacy class - .btn, .btn-primary, .btn-ghost, .card, .chip, .chip-active, .parchment - used in
// the markup (class attribute or class: directive) or reached through :global() in the <style> of
// any component under components/places/, and of the shared components the places render.
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const LEGACY = ['btn', 'btn-primary', 'btn-ghost', 'card', 'chip', 'chip-active', 'parchment'];
const SHARED = ['src/components/QuestCard.svelte', 'src/components/Scroll.svelte'];
// Files still waiting for their task. Tasks 6-12 each remove theirs; it may only shrink (a clean
// file left here fails below), and Task 13 asserts it is empty.
const PENDING = new Set<string>([
  // Fill in from the first run's output (the test prints every offender), e.g.:
  // 'src/components/places/library/ShelvesPanel.svelte',
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name).replaceAll('\\', '/');
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.svelte')) out.push(p);
  }
  return out;
}

export function legacyUses(source: string): string[] {
  const hits: string[] = [];
  const lineOf = (i: number) => source.slice(0, i).split('\n').length;
  // Markup: drop <script> and HTML comments; keep <style> for the :global() check below.
  const markup = source
    .replace(/<script[\s\S]*?<\/script>/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
  const style = /<style[\s\S]*?<\/style>/.exec(markup);
  const body = style ? markup.slice(0, style.index) + markup.slice(style.index).replace(style[0], (m) => m.replace(/[^\n]/g, ' ')) : markup;
  // class="a b" or class={expr}; an expression runs to the `}` that closes the attribute (followed
  // by whitespace, `>` or `/`), so a template literal's own `${x}` does not cut it short.
  for (const m of body.matchAll(/\bclass=(?:"([^"]*)"|\{([^\n]*?)\}(?=[\s>/]))/g)) {
    const raw = (m[1] ?? '') + ' ' + [...(m[2] ?? '').matchAll(/['"`]([^'"`]*)['"`]/g)].map((s) => s[1]).join(' ');
    for (const token of raw.split(/[\s{}$]+/)) if (LEGACY.includes(token)) hits.push(`${lineOf(m.index!)}: class ${token}`);
  }
  for (const m of body.matchAll(/\bclass:([\w-]+)/g)) if (LEGACY.includes(m[1])) hits.push(`${lineOf(m.index!)}: class:${m[1]}`);
  if (style) {
    for (const m of style[0].matchAll(/:global\(\s*\.([\w-]+)/g)) {
      if (LEGACY.includes(m[1])) hits.push(`${lineOf(style.index + m.index!)}: :global(.${m[1]})`);
    }
  }
  return hits;
}

const files = [...walk('src/components/places'), ...SHARED.filter((f) => existsSync(f))];

describe('places use the kit, never the legacy UI classes (Ruling W4)', () => {
  it('finds no legacy class outside the pending files', () => {
    const report: string[] = [];
    for (const f of files) {
      if (PENDING.has(f)) continue;
      for (const hit of legacyUses(readFileSync(f, 'utf-8'))) report.push(`${f}:${hit}`);
    }
    expect(report).toEqual([]);
  });

  it('keeps the pending list honest: every pending file still has a legacy class', () => {
    for (const f of PENDING) {
      expect(existsSync(f), `${f} no longer exists: remove it from PENDING`).toBe(true);
      expect(legacyUses(readFileSync(f, 'utf-8')).length, `${f} is clean: remove it from PENDING`).toBeGreaterThan(0);
    }
  });

  it('catches every legacy form (self-test)', () => {
    const planted = [
      '<button class="btn btn-primary">x</button>',
      '<div class="card text-card">x</div>',
      '<button class="chip" class:chip-active={on}>x</button>',
      "<span class={`chip ${x}`}>x</span>",
      '<style>.grid :global(.chip) { min-height: 48px; }</style>',
    ].join('\n');
    expect(legacyUses(planted)).toHaveLength(7);
    expect(legacyUses('<button class="kit-bronze is-quiet">x</button><div class="kit-cubby">y</div>')).toEqual([]);
    expect(legacyUses('<script>const btn = "btn";</script><!-- class="card" -->')).toEqual([]);
  });
});
```

Count the self-test's hits by hand when you write it (`btn`, `btn-primary`, `card`, `chip`, `class:chip-active`, the template-literal `chip`, `:global(.chip)` = 7). Run with an empty `PENDING`, and paste the printed offenders into `PENDING` (files only). Expected offenders today: ShelvesPanel, DeskPanel, LensPanel, PortalPanel, PortalWorkPanel, PythiaPanel, TabletsPanel, HeroForm, QuestCard and Scroll. Add any other file the run finds.

Run: `scripts/npm.sh run test -- src/styles/kit-objects.test.ts src/styles/kit-form.test.ts src/placesKit.test.ts`
Expected: FAIL (`kit-objects.css` missing; the select, chip and 48 px rules missing). `placesKit.test.ts` passes once `PENDING` is filled.

- [ ] **Step 2: `kit-form.css`: the select, the chip, the legend, the 48 px floor**

- In `:root` add the chevron: `--chevron: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 9'%3E%3Cpath d='M1 1l6 6 6-6' fill='none' stroke='%235a3a18' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E");`.
- Change the label rule's selector to `.kit-form label,\n.kit-form legend` (the same small caps: playability #3's « Ton avatar » mismatch).
- Replace the `.kit-form .chip` background with `linear-gradient(180deg, #faf6ef, var(--marble-plaque));` (no veins: they read as a "disabled" hatch).
- Append:

```css
/* Playability #4: a native select is the clearest "web form" tell - parchment field, bronze chevron.
   (UI3a's own selects become medallions, Ruling W5; this covers any that remain.) */
.kit-form select {
  appearance: none;
  -webkit-appearance: none;
  min-height: 48px;
  padding: 0 40px 0 14px;
  background: rgba(251, 244, 226, 0.78) var(--chevron) no-repeat right 14px center / 14px 9px;
  font-size: 17px;
}
/* Playability #25: every control inside an overlay is a 48 px touch target. */
.kit-form :is(button, summary, a.kit-bronze, a.kit-link) {
  min-height: 48px;
}
```

Check that `.kit-form select`'s `background` shorthand comes **after** the shared field rule (it does when appended).

- [ ] **Step 3: Write `kit-objects.css`**

```css
/* The object kit (immersion wave, playability #1): what the overlays are made of instead of cards,
   pills and form buttons. Loaded after kit-form.css: a class used on a <label> is written
   `label.kit-x` so it beats `.kit-form label` (same specificity, later file). No red anywhere. */

/* --- Bronze buttons: a quiet variant and a disabled state (kit.css holds the base) ----------- */
.kit-bronze.is-quiet {
  background: linear-gradient(180deg, rgba(255, 247, 230, 0.95), rgba(236, 219, 184, 0.95));
  color: var(--bronze-dark);
  text-shadow: none;
}
.kit-bronze:disabled {
  filter: saturate(0.35) brightness(0.92);
  cursor: default;
  transform: none;
}
label.kit-bronze {
  color: var(--bronze-ink);
  font-family: var(--font-display);
  font-variant: normal;
  letter-spacing: 0.04em;
}
label.kit-bronze.is-quiet {
  color: var(--bronze-dark);
}

/* --- A small text link: « Changer de héros », « Retirer », « Qui l'a écrit ? » -------------- */
.kit-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 48px;
  padding: 0 8px;
  border: 0;
  background: none;
  color: var(--bronze-dark);
  font-family: var(--font-body);
  font-size: 16px;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}
.kit-link:focus-visible {
  outline: 3px solid var(--gold-light);
  outline-offset: 2px;
}

/* --- Wax seal: an irregular terracotta disc with a pressed emblem. `.is-broken`: split in two,
       the halves pushed apart (a defended text, an opened scroll). --------------------------- */
.kit-seal {
  --seal-size: 44px;
  --seal-shape: 47% 53% 50% 50% / 53% 47% 53% 47%;
  position: relative;
  isolation: isolate;
  display: inline-grid;
  place-items: center;
  width: var(--seal-size);
  height: var(--seal-size);
  border-radius: var(--seal-shape);
  background: radial-gradient(circle at 38% 32%, #c86a4e, var(--wax) 55%, var(--wax-dark));
  box-shadow:
    inset 0 0 0 3px rgba(0, 0, 0, 0.18),
    inset 0 2px 3px rgba(255, 210, 180, 0.35),
    0 2px 4px rgba(0, 0, 0, 0.4);
}
.kit-seal > img {
  width: 78%;
  height: 78%;
  object-fit: contain;
  mix-blend-mode: multiply;
}
.kit-seal.is-broken {
  background: none;
  box-shadow: none;
}
.kit-seal.is-broken > img {
  opacity: 0.3;
}
.kit-seal.is-broken::before,
.kit-seal.is-broken::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: var(--seal-shape);
  background: radial-gradient(circle at 38% 32%, #c86a4e, var(--wax) 55%, var(--wax-dark));
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
}
.kit-seal.is-broken::before {
  clip-path: polygon(0 0, 55% 0, 42% 40%, 58% 62%, 45% 100%, 0 100%);
  transform: translateX(-3px) rotate(-8deg);
}
.kit-seal.is-broken::after {
  clip-path: polygon(55% 0, 100% 0, 100% 100%, 45% 100%, 58% 62%, 42% 40%);
  transform: translateX(3px) rotate(6deg);
}
/* A laurel sprig laid over a broken seal: this text was defended. */
.kit-seal .seal-laurel {
  position: absolute;
  inset: auto -10px -8px auto;
  color: var(--gold-light);
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.6));
}

/* --- Paper tag tied to an object: a text's title, a work's name ------------------------------ */
.kit-tag {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 12px 9px 26px;
  border: 1px solid var(--parchment-edge);
  border-radius: 3px 6px 6px 3px;
  background: var(--grain), linear-gradient(180deg, #fbf3df, #ecdcb8);
  color: var(--ink);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.35);
  transform: rotate(var(--tag-tilt, -1.2deg));
  text-align: left;
}
/* the punched hole and the cord up to the object */
.kit-tag::before {
  content: '';
  position: absolute;
  left: 9px;
  top: 14px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--wood-dark);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.6);
}
.kit-tag::after {
  content: '';
  position: absolute;
  left: 12px;
  bottom: calc(100% - 18px);
  width: 2px;
  height: 30px;
  background: linear-gradient(#c9a26b, #8a6a3e);
  transform: rotate(14deg);
  transform-origin: bottom;
}
.kit-tag-title {
  font-family: var(--font-body);
  font-weight: 600;
  font-size: 19px;
  line-height: 1.2;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
}
.kit-tag-meta {
  font-family: var(--font-body);
  font-size: 14px;
  color: var(--form-ink-soft);
}
/* An ink stamp in the tag's corner: « Déchiffré », « Alexandrie ». */
.kit-stamp {
  align-self: flex-start;
  margin-top: 4px;
  padding: 1px 8px;
  border: 1.5px solid currentColor;
  border-radius: 4px;
  color: var(--aegean);
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  transform: rotate(-3deg);
}
/* A gold ribbon across the tag: a prophecy and its day. */
.kit-prophecy {
  align-self: flex-start;
  margin-top: 4px;
  padding: 2px 10px;
  border-radius: 3px;
  background: linear-gradient(180deg, var(--gold-light), #e2c46e);
  color: var(--ink);
  font-family: var(--font-body);
  font-size: 14px;
  font-weight: 700;
}

/* --- A cubby of the shelves: a recessed box in the dark wood --------------------------------- */
.kit-cubby {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
  min-height: 190px;
  padding: 14px 12px 12px;
  border: 0;
  border-radius: 6px;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0.35) 30%, rgba(0, 0, 0, 0.25));
  box-shadow:
    inset 0 6px 12px rgba(0, 0, 0, 0.65),
    inset 0 -2px 0 rgba(255, 236, 200, 0.12),
    0 1px 0 rgba(255, 236, 200, 0.15);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.kit-cubby:focus-visible {
  outline: 3px solid var(--gold-light);
  outline-offset: 2px;
}

/* --- A rolled scroll object: the painted cut-out (or a CSS roll), a wax seal on it ------------ */
.kit-roll {
  position: relative;
  display: grid;
  place-items: center;
  height: 64px;
  transition: transform 0.15s ease;
}
.kit-cubby:hover .kit-roll,
.kit-cubby:focus-visible .kit-roll {
  transform: translateY(-3px);
}
.kit-roll > .roll-art {
  width: var(--roll-w, 82%);
  height: auto;
  max-height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 3px 3px rgba(0, 0, 0, 0.5));
}
/* Ruling W3 fallback: a CSS roll when the painted one was not delivered. */
.kit-roll > .roll-css {
  width: var(--roll-w, 82%);
  height: 34px;
  border-radius: 17px;
  background: var(--grain), linear-gradient(180deg, #fbf1d8 0%, #e9d3a6 45%, #b9955f 100%);
  box-shadow:
    inset -10px 0 0 -4px #7a5230,
    inset 10px 0 0 -4px #7a5230,
    0 3px 4px rgba(0, 0, 0, 0.45);
}
.kit-roll > .kit-seal {
  position: absolute;
  --seal-size: 34px;
}
/* The scroll's thickness says its length (playability #2): court, moyen, long. */
.kit-roll[data-length='court'] {
  --roll-w: 64%;
}
.kit-roll[data-length='moyen'] {
  --roll-w: 80%;
}
.kit-roll[data-length='long'] {
  --roll-w: 96%;
  height: 72px;
}
/* Standing up (the Pythia's three scrolls). */
.kit-roll.is-upright {
  width: 96px;
  height: 200px;
}
.kit-roll.is-upright > .roll-art,
.kit-roll.is-upright > .roll-css {
  width: 200px;
  max-height: none;
  transform: rotate(90deg);
}

/* --- An unrolled sheet between two rods (the Pythia's opened scroll, pinned notes) ----------- */
.kit-sheet {
  position: relative;
  margin: 14px 10px;
  padding: 22px 22px 18px;
  border-radius: 4px;
  background: var(--grain), linear-gradient(180deg, #f8eed8, #ecdbb8);
  color: var(--ink);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
}
.kit-sheet::before,
.kit-sheet::after {
  content: '';
  position: absolute;
  left: -12px;
  right: -12px;
  height: 16px;
  border-radius: 8px;
  background: linear-gradient(180deg, #b98a57 0%, #7a5230 45%, #4e321b 100%);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
}
.kit-sheet::before {
  top: -8px;
}
.kit-sheet::after {
  bottom: -8px;
}

/* --- A terracotta votive tablet hung on a cord from a peg ------------------------------------ */
.kit-tablet {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin-top: 34px;
  padding: 34px 14px 16px;
  border-radius: 46% 46% 10px 10px / 18% 18% 10px 10px;
  background: var(--grain), radial-gradient(ellipse at 35% 25%, #e7b892, var(--clay) 50%, var(--clay-dark));
  color: var(--ink);
  box-shadow:
    inset 0 0 0 2px rgba(92, 40, 20, 0.35),
    inset 0 -6px 12px rgba(92, 40, 20, 0.35),
    0 6px 10px rgba(0, 0, 0, 0.45);
  text-align: center;
}
.kit-tablet::before {
  content: '';
  position: absolute;
  top: 12px;
  left: 50%;
  width: 10px;
  height: 10px;
  margin-left: -5px;
  border-radius: 50%;
  background: var(--wood-dark);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.7);
}
.kit-tablet::after {
  content: '';
  position: absolute;
  top: -34px;
  left: 50%;
  width: 2px;
  height: 48px;
  margin-left: -1px;
  background: linear-gradient(#c9a26b, #8a6a3e);
  box-shadow: 0 0 1px rgba(0, 0, 0, 0.6);
}
/* A medallion pressed into the clay. */
.kit-tablet .pressed {
  display: inline-grid;
  border-radius: 50%;
  filter: sepia(0.55) saturate(0.8) contrast(1.05);
  box-shadow:
    inset 0 3px 6px rgba(92, 40, 20, 0.6),
    0 1px 0 rgba(255, 230, 200, 0.5);
}
.kit-tablet.is-asleep {
  filter: saturate(0.45) brightness(0.88);
}
.kit-tablet-stamp {
  padding: 1px 10px;
  border: 2px solid var(--laurel);
  border-radius: 999px;
  color: #3d4a1a;
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.kit-tablet-ribbon {
  padding: 3px 12px;
  border-radius: 3px;
  background: linear-gradient(180deg, var(--gold-light), #e2c46e);
  color: var(--ink);
  font-family: var(--font-body);
  font-size: 15px;
  font-weight: 700;
}

/* --- A bronze medallion: a level to choose (real radio inside), or a small level mark ------- */
label.kit-medallion,
.kit-medallion {
  position: relative;
  display: inline-grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 2px solid var(--bronze-dark);
  background: radial-gradient(circle at 38% 32%, var(--bronze-light), var(--bronze) 58%, var(--bronze-dark));
  color: var(--bronze-ink);
  font-family: var(--font-display);
  font-variant: normal;
  font-weight: 700;
  font-size: 16px;
  letter-spacing: 0.02em;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.5);
  box-shadow:
    inset 0 0 0 3px rgba(255, 240, 200, 0.22),
    0 3px 6px rgba(0, 0, 0, 0.35);
  cursor: pointer;
  transition: transform 0.12s ease;
}
/* The real radio covers the medallion (opacity 0): taps, keyboard and VoiceOver hit the input. */
.kit-medallion > input {
  position: absolute;
  inset: 0;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}
.kit-medallion:has(input:checked) {
  border-color: var(--gold-light);
  box-shadow:
    0 0 0 3px var(--gold-light),
    0 0 14px rgba(255, 220, 140, 0.8),
    inset 0 0 0 3px rgba(255, 240, 200, 0.35);
  transform: translateY(-2px);
}
.kit-medallion:has(input:focus-visible) {
  outline: 3px solid var(--gold-light);
  outline-offset: 4px;
}
.kit-medallion:has(input:disabled) {
  opacity: 0.5;
  cursor: default;
}
.kit-medallion.is-small {
  width: 40px;
  height: 40px;
  font-size: 13px;
  cursor: default;
}

/* --- A cloth ribbon over a painted scene (the title's one line) ------------------------------ */
.kit-ribbon {
  display: inline-block;
  padding: 8px 36px;
  background: linear-gradient(180deg, #a5532f, #7e3b20);
  color: var(--bronze-ink);
  font-family: var(--font-body);
  font-size: 19px;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  box-shadow:
    inset 0 2px 0 rgba(255, 220, 190, 0.25),
    inset 0 -3px 0 rgba(0, 0, 0, 0.2);
  clip-path: polygon(0 0, 100% 0, calc(100% - 16px) 50%, 100% 100%, 0 100%, 16px 50%);
}

/* --- A note pinned in a panel: the scribes' news (olive) or Éris's hand (orange, never red) -- */
.kit-note {
  padding: 10px 14px;
  border-radius: 6px;
  border-left: 4px solid var(--olive);
  background: rgba(234, 238, 220, 0.9);
  color: var(--ink);
}
.kit-note[data-tone='eris'] {
  border-left-color: var(--orange);
  background: rgba(252, 232, 214, 0.92);
}

/* --- The quill gauge: how long a text is, against the 80-200 words it needs ---------------- */
.kit-gauge {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.kit-gauge-track {
  position: relative;
  height: 10px;
  border-radius: 5px;
  background: rgba(92, 64, 24, 0.18);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.25);
  overflow: hidden;
}
/* The 80-200 band, drawn on the track (80/200 = 40 % of a track that ends at 200). */
.kit-gauge-band {
  position: absolute;
  inset: 0 0 0 40%;
  background: rgba(107, 122, 58, 0.22);
}
.kit-gauge-fill {
  position: absolute;
  inset: 0 auto 0 0;
  width: var(--fill, 0%);
  border-radius: inherit;
  background: linear-gradient(90deg, var(--bronze-light), var(--bronze));
  transition: width 0.2s ease;
}
.kit-gauge[data-state='ok'] .kit-gauge-fill {
  background: linear-gradient(90deg, var(--laurel-light), var(--laurel));
}
.kit-gauge-label {
  font-family: var(--font-body);
  font-size: 16px;
  font-weight: 600;
}

@media (prefers-reduced-motion: reduce) {
  .kit-roll,
  .kit-gauge-fill,
  .kit-medallion {
    transition: none;
  }
}
```

(Every hex here fails the red test by design: the wax `#c86a4e`/`#a84a32` and the ribbon `#a5532f` all have g > 60. Check that `--orange`, `--olive` and `--aegean` exist in `app.css`. They do: UI3a used them.)

In `web/src/main.ts`, add `import './styles/kit-objects.css';` right after the `kit-form.css` import.

- [ ] **Step 4: `LevelMedallions.svelte`**

```svelte
<script lang="ts">
  // A row of bronze level medallions (immersion wave Ruling W5): real radio inputs, so the iPad
  // keyboard, VoiceOver and forms keep working, dressed as the medallions of the naming ritual.
  // Replaces LevelSelect's native <select> (playability #3, #4) and the level pills (#2, #7).
  import { LEVELS } from '../../lib/levels';

  let {
    legend,
    name,
    value = $bindable(),
    options = LEVELS as readonly string[],
    onchange,
    testId,
  }: {
    legend: string;
    name: string;
    value: string;
    options?: readonly string[];
    onchange?: (value: string) => void;
    testId?: string;
  } = $props();
</script>

<fieldset class="level-medallions" data-testid={testId}>
  <legend>{legend}</legend>
  <div class="row">
    {#each options as o (o)}
      <label class="kit-medallion">
        <input type="radio" {name} value={o} bind:group={value} onchange={() => onchange?.(o)} />
        {o}
      </label>
    {/each}
  </div>
</fieldset>

<style>
  .level-medallions {
    margin: 0 0 16px;
    padding: 0;
    border: 0;
  }
  .level-medallions legend {
    margin-bottom: 8px;
    padding: 0;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
</style>
```

Its radios are named by their label text, so e2e picks one with `getByRole('radio', { name: '10H', exact: true }).check()` (Task 7 adds the `chooseLevel` helper). The fieldset's name is its legend: `getByRole('group', { name: 'Ta classe' })`.

- [ ] **Step 5: The laurel icon**

In `lib/ui/icons.ts` add `'laurel'` to `IconName` and to `ICONS`:

```ts
  // A laurel sprig laid on a broken seal (a defended text, immersion wave Task 8).
  laurel: [
    { d: 'M7 27C12 22 18 15 25 5', width: 2 },
    {
      d: 'M11 22c-3 0-5-2-5-4 3 0 5 2 5 4zM14 18c-3-1-4-3-4-5 3 1 4 3 4 5zM17 14c-2-1-3-3-3-5 2 1 3 3 3 5zM15 23c1-3 3-4 5-4-1 3-3 4-5 4zM18 19c1-3 3-4 5-4-1 3-3 4-5 4zM21 15c1-2 3-3 5-3-1 2-3 3-5 3z',
      fill: true,
    },
  ],
```

Update `icons.test.ts` if it pins the list of names.

- [ ] **Step 6: Run the tests**

```bash
scripts/npm.sh run test -- src/styles src/placesKit.test.ts src/lib/ui
scripts/npm.sh run check
scripts/playwright.sh scenes-library scenes-delphi scenes-title
```

Expected: PASS, 0 warnings. The e2e run proves that the 48 px floor and the chip change broke no existing flow.

- [ ] **Step 7: Commit**

```bash
git add web/src/styles/kit-objects.css web/src/styles/kit-objects.test.ts web/src/styles/kit-form.css web/src/styles/kit-form.test.ts web/src/main.ts web/src/components/ui/LevelMedallions.svelte web/src/placesKit.test.ts web/src/lib/ui/icons.ts web/src/lib/ui/icons.test.ts
git commit -m "Immersion wave: object kit (seals, tags, cubbies, rolls, tablets, medallions), in-world select, legacy-class guard for the places" -- web/src/styles/kit-objects.css web/src/styles/kit-objects.test.ts web/src/styles/kit-form.css web/src/styles/kit-form.test.ts web/src/main.ts web/src/components/ui/LevelMedallions.svelte web/src/placesKit.test.ts web/src/lib/ui/icons.ts web/src/lib/ui/icons.test.ts
```

---

### Task 4: French helpers: plurals, elision, dates, bylines, lengths, the word gauge (and the form-plural guard)

**Findings:** #10 (`plural` + guard), #14 (`de()`), #19 (`longDate`), #2 (length, history), #24 (`workByline`), #5 (gauge), recommendation 8 (`Results.svelte`). **Depends on:** nothing but Wave A. It can run in parallel with Task 3 if the controller wants.

**Files:**
- Create: `web/src/lib/text/french.ts`, `web/src/lib/text/french.test.ts`, `web/src/lib/text/screenText.ts`, `web/src/lib/text/screenText.test.ts`, `web/src/lib/library/shelf.ts`, `web/src/lib/library/shelf.test.ts`, `web/src/formPlural.test.ts`
- Modify: `web/src/components/places/delphi/TabletsPanel.svelte` (the two « (s) »), `web/src/components/Results.svelte` (« nouveau(x) piège(s) »)

**Interfaces:**
- Produces:
  - `plural(n, one, many): string` → `"2 quêtes"`, `"1 quête"`, `"0 quête"` (French: fewer than 2 is singular).
  - `de(name): string` → `"d'Ariane"`, `"de Jules"`.
  - `longDate(iso, today?): string`.
  - `lengthOf(words): 'court' | 'moyen' | 'long'`, `historyLine(history): string`, `textByline(text): string`, `workByline(work): string`, `wordGauge(n): { label, state: 'short' | 'ok' | 'long', fill }`, `WORDS_MIN = 80`, `WORDS_MAX = 200`.

- [ ] **Step 1: Write the failing tests**

`web/src/lib/text/french.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { de, longDate, plural } from './french';

describe('French wording helpers', () => {
  it('counts without a form plural (playability #10)', () => {
    expect(plural(2, 'quête', 'quêtes')).toBe('2 quêtes');
    expect(plural(1, 'quête', 'quêtes')).toBe('1 quête');
    expect(plural(0, 'ruse', 'ruses')).toBe('0 ruse');
    expect(plural(12, 'rouleau', 'rouleaux')).toBe('12 rouleaux');
  });

  it('elides « de » before a vowel or a mute h (playability #14)', () => {
    expect(de('Ariane')).toBe("d'Ariane");
    expect(de('Anne-Charlotte')).toBe("d'Anne-Charlotte");
    expect(de('Élise-Marguerite')).toBe("d'Élise-Marguerite");
    expect(de('Hugo')).toBe("d'Hugo");
    expect(de('Yves')).toBe("d'Yves");
    expect(de('Yann')).toBe('de Yann');
    expect(de('Jules')).toBe('de Jules');
    expect(de('  Zoé ')).toBe('de Zoé');
  });

  it('says a date as a person does, the year only when it is not this one (playability #19)', () => {
    const today = new Date(2026, 8, 25);
    expect(longDate('2026-09-28', today)).toBe('lundi 28 septembre');
    expect(longDate('2099-01-01', today)).toBe('jeudi 1er janvier 2099');
    expect(longDate('2035-06-30', today)).toBe('samedi 30 juin 2035');
    expect(longDate('2026-10-01T00:00:00', today)).toBe('jeudi 1er octobre');
  });
});
```

`web/src/lib/library/shelf.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { historyLine, lengthOf, textByline, wordGauge, workByline } from './shelf';

describe('the shelves speak the camp, not the catalogue (playability #2, #5, #24)', () => {
  it('turns a word count into a scroll length', () => {
    expect([80, 110, 111, 160, 161, 230].map(lengthOf)).toEqual(['court', 'court', 'moyen', 'moyen', 'long', 'long']);
  });

  it('tells the history as defences', () => {
    expect(historyLine(null)).toBe('Jamais défendu');
    expect(historyLine({ times_played: 0, best_catch_rate: null } as never)).toBe('Jamais défendu');
    expect(historyLine({ times_played: 3, best_catch_rate: null } as never)).toBe('Défendu 3 fois');
    expect(historyLine({ times_played: 1, best_catch_rate: 0.916 } as never)).toBe('Défendu 1 fois · 92 % des pièges déjoués');
  });

  it('names who wrote it, never the title again', () => {
    expect(textByline({ author: 'Victor Hugo', translator: null, source: 'online', added_by_name: null, credits: 'Victor Hugo, Les Misérables' })).toBe('Victor Hugo');
    expect(textByline({ author: 'Hans Christian Andersen', translator: 'David Soldi', source: 'online', added_by_name: null, credits: null })).toBe(
      'Hans Christian Andersen, trad. David Soldi',
    );
    expect(textByline({ author: null, translator: null, source: 'custom', added_by_name: 'Ariane', credits: null })).toBe('Ajouté par Ariane');
    expect(textByline({ author: null, translator: null, source: 'seed', added_by_name: null, credits: 'Les Muses de la Discorde, Textes originaux' })).toBe(
      'Les Muses de la Discorde, Textes originaux',
    );
    expect(workByline({ author: 'Charles Perrault', translator: null })).toBe('Charles Perrault');
    expect(workByline({ author: 'Lewis Carroll', translator: 'Henri Bué' })).toBe('Lewis Carroll, trad. Henri Bué');
  });

  it('measures a text against the 80-200 words it needs (the desk gauge)', () => {
    expect(wordGauge(13)).toEqual({ label: '13 mots · il en faut au moins 80', state: 'short', fill: 13 / 200 });
    expect(wordGauge(1).label).toBe('1 mot · il en faut au moins 80');
    expect(wordGauge(94)).toEqual({ label: '94 mots · parfait', state: 'ok', fill: 94 / 200 });
    expect(wordGauge(214)).toEqual({ label: '214 mots · au plus 200', state: 'long', fill: 1 });
  });
});
```

`web/src/lib/text/screenText.ts` holds the extraction that this guard and Task 13's register guard share. It is a module, not a test file, so both tests can import it:

```ts
// The text a source file can put on screen (immersion wave guards, Tasks 4 and 13): Svelte markup
// text, and the string literals of scripts, markup expressions and .ts modules. Comments and code
// (a call such as `handle(e)`, an identifier such as `api.scan`) are not text. An approximation
// good enough for guards: it never needs to parse a real template perfectly, only to keep code out.

const LITERAL = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g;

const noJsComments = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

const literals = (code: string) => (noJsComments(code).match(LITERAL) ?? []).join('\n');

export function screenText(source: string, kind: 'svelte' | 'ts'): string {
  if (kind === 'ts') return literals(source);
  const scripts = [...source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => literals(m[1])).join('\n');
  let markup = source
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  // An expression keeps only its string literals (three passes cover one level of nesting).
  for (let i = 0; i < 3; i++) markup = markup.replace(/\{[^{}]*\}/g, (m) => ` ${literals(m)} `);
  return `${scripts}\n${markup}`;
}
```

`web/src/lib/text/screenText.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { screenText } from './screenText';

describe('screenText', () => {
  it('keeps markup text and string literals, drops comments and code', () => {
    const svelte = "<script>// hidden(s)\nconst label = 'Poser'; function onKey(e) { handle(e); }</script>\n<!-- gone -->\n<p>Bonjour {n > 1 ? 'amis' : ''}</p>\n<button onclick={() => handle(e)}>x</button>\n<style>.a { color: red; }</style>";
    const text = screenText(svelte, 'svelte');
    expect(text).toContain("'Poser'");
    expect(text).toContain('Bonjour');
    expect(text).toContain("'amis'");
    expect(text).not.toMatch(/hidden|gone|handle|onKey|color/);
    expect(screenText("const a = 'quête'; // mot\nfoo(e);", 'ts')).toBe("'quête'");
  });
});
```

`web/src/formPlural.test.ts`:

```ts
// UI1 playability #6, UI3a playability #10: never a form plural « quête(s) », « nouveau(x) » on
// screen - count with plural() (lib/text/french.ts). Only what can reach the screen is scanned
// (lib/text/screenText.ts): comments and code such as `handle(e)` are not text.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { screenText } from './lib/text/screenText';

const PLURAL = /[A-Za-zÀ-ÿ]\((?:s|x|e|es)\)/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name).replaceAll('\\', '/');
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(svelte|ts)$/.test(name) && !name.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

const formPlurals = (source: string, kind: 'svelte' | 'ts') => screenText(source, kind).match(PLURAL) ?? [];

describe('no form plurals on screen', () => {
  it('finds none in the components, the screens and the world data', () => {
    const report: string[] = [];
    for (const f of [...walk('src/components'), ...walk('src/screens'), ...walk('src/lib/world')]) {
      for (const hit of formPlurals(readFileSync(f, 'utf-8'), f.endsWith('.svelte') ? 'svelte' : 'ts')) report.push(`${f}: ${hit}`);
    }
    expect(report).toEqual([]);
  });

  it('catches the planted forms and ignores comments and code (self-test)', () => {
    expect(formPlurals('<p>dans {n} quête(s)</p>\n<p>{n} nouveau(x) piège(s)</p>', 'svelte')).toHaveLength(3);
    expect(formPlurals("<p>{n > 1 ? 'ruse(s)' : ''}</p>", 'svelte')).toHaveLength(1);
    expect(formPlurals('<script>// photo(s)\nfunction onKey(e) { handle(e); }</script>\n<!-- jour(s) -->\n<button onclick={() => handle(e)}>x</button>', 'svelte')).toEqual([]);
    expect(formPlurals("const a = 'quête(s)'; // mot(s)\nfoo(e);", 'ts')).toEqual(['e(s)']);
  });
});
```

Run: `scripts/npm.sh run test -- src/lib/text src/lib/library src/formPlural.test.ts`
Expected: FAIL. The modules are missing, and the guard finds `TabletsPanel.svelte` twice and `Results.svelte` twice. Fix any other hit it reports with `plural()` as well.

- [ ] **Step 2: Write `lib/text/french.ts`**

```ts
// French wording helpers (immersion wave): counts without « (s) », « de » elided before a vowel,
// dates as a person says them. Pure and deterministic - no Intl: Node's ICU and WebKit's disagree
// on fr-CH punctuation, and vitest runs in Node (Ruling W7).

/** « 2 quêtes », « 1 quête », « 0 quête » (in French, fewer than two is singular). */
export function plural(n: number, one: string, many: string): string {
  return `${n} ${Math.abs(n) < 2 ? one : many}`;
}

const VOWEL_OR_H = /^[aeiouàâäéèêëîïôöùûüœæh]/i;
// A leading y elides when it sounds like a vowel (« Yves », « Ysaline »), not before one (« Yann »).
const Y_AS_VOWEL = /^y[^aeiouyàâäéèêëîïôöùûü]/i;

/** « de » before a name, elided before a vowel or a mute h: « d'Ariane », « d'Hugo », « de Yann ». */
export function de(name: string): string {
  const s = name.trim();
  return VOWEL_OR_H.test(s) || Y_AS_VOWEL.test(s) ? `d'${s}` : `de ${s}`;
}

const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** « lundi 28 septembre », « jeudi 1er janvier 2099 »: the year only when it is not this one. */
export function longDate(iso: string, today: Date = new Date()): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const day = d === 1 ? '1er' : String(d);
  const year = y === today.getFullYear() ? '' : ` ${y}`;
  return `${weekday} ${day} ${MONTHS[m - 1]}${year}`;
}
```

- [ ] **Step 3: Write `lib/library/shelf.ts`**

```ts
// How the shelves and the desk talk about a text (playability #2, #5, #24): lengths instead of word
// counts, defences instead of « joué », who wrote it without repeating the title.
import { plural } from '../text/french';
import type { AlexandriaWork, TextSummary } from '../types';

export type Length = 'court' | 'moyen' | 'long';
export const WORDS_MIN = 80;
export const WORDS_MAX = 200;

/** A scroll's thickness on the shelf. */
export function lengthOf(words: number): Length {
  return words <= 110 ? 'court' : words <= 160 ? 'moyen' : 'long';
}

export function historyLine(h: TextSummary['history']): string {
  if (!h || h.times_played === 0) return 'Jamais défendu';
  const times = `Défendu ${h.times_played} fois`;
  if (h.best_catch_rate === null || h.best_catch_rate === undefined) return times;
  return `${times} · ${Math.round(h.best_catch_rate * 100)} % des pièges déjoués`;
}

/** Author (and translator); « Ajouté par X » for her own texts; the seed credits as a last resort. */
export function textByline(t: Pick<TextSummary, 'author' | 'translator' | 'source' | 'added_by_name' | 'credits'>): string {
  if (t.author) return t.translator ? `${t.author}, trad. ${t.translator}` : t.author;
  if (t.source === 'custom' && t.added_by_name) return `Ajouté par ${t.added_by_name}`;
  return t.credits ?? '';
}

export function workByline(w: Pick<AlexandriaWork, 'author' | 'translator'>): string {
  return w.translator ? `${w.author}, trad. ${w.translator}` : w.author;
}

/** The desk's quill gauge: how many words, and whether that is enough. */
export function wordGauge(n: number): { label: string; state: 'short' | 'ok' | 'long'; fill: number } {
  const words = plural(n, 'mot', 'mots');
  const fill = Math.min(1, n / WORDS_MAX);
  if (n < WORDS_MIN) return { label: `${words} · il en faut au moins ${WORDS_MIN}`, state: 'short', fill };
  if (n <= WORDS_MAX) return { label: `${words} · parfait`, state: 'ok', fill };
  return { label: `${words} · au plus ${WORDS_MAX}`, state: 'long', fill };
}
```

Check `TextSummary['history']`'s type in `lib/types.ts` (`TextHistory | null`) and that `best_catch_rate` may be `null`. Adjust the test casts if the type is stricter.

- [ ] **Step 4: Remove the form plurals**

In `TabletsPanel.svelte` (import `plural`). Task 12 then moves the first line out of the tablets:
- line ~134: `<p class="muted decor-line">Encore {plural(decor.n, 'quête', 'quêtes')} avant le prochain trésor de ta cabane : {decor.name}.</p>`
- line ~177: `<p>Éris se cache. Neutralise encore {plural(Math.max(0, need - neutralised), 'ruse', 'ruses')} pour la faire sortir.</p>`

In `Results.svelte` (~196), read the whole sentence, then write: `Éris a profité de la relecture pour glisser {plural(introducedCount, 'nouveau piège', 'nouveaux pièges')}.` and keep the rest of the paragraph. `introducedCount` ≥ 1 there. Check the surrounding `{#if}`.

- [ ] **Step 5: Run the tests**

```bash
scripts/npm.sh run test -- src/lib/text src/lib/library src/formPlural.test.ts
scripts/npm.sh run check
scripts/playwright.sh scenes-delphi world
```

Expected: PASS. (world.spec covers the Results screen, scenes-delphi the board.)

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/text web/src/lib/library web/src/formPlural.test.ts web/src/components/places/delphi/TabletsPanel.svelte web/src/components/Results.svelte
git commit -m "Immersion wave: French helpers (plural, elision, spoken dates, bylines, lengths, word gauge) and the form-plural guard" -- web/src/lib/text web/src/lib/library web/src/formPlural.test.ts web/src/components/places/delphi/TabletsPanel.svelte web/src/components/Results.svelte
```

---

### Task 5: Scene data: one name per thing, a visible next step, the owl speaks, captions in the camp's words

**Findings:** #10 (names), #11, #15, #16, #20, #22, #23. **Depends on:** Tasks 1 (portal icon), 2, 4.

**Files:**
- Modify: `web/src/components/scene/Hotspot.svelte`, `web/src/lib/scene/types.ts`, `web/src/lib/scene/validate.ts` (+ `validate.test.ts`)
- Modify: `web/src/lib/world/scenes/library.ts`, `library.shapes.ts`, `library.test.ts`; `delphi.ts`, `delphi.shapes.ts`, `delphi.test.ts`; `camp.ts`, `camp.test.ts`; `title.ts`, `title.test.ts`
- Modify: `web/src/lib/world/places.ts`, `web/src/lib/world/places.test.ts` (`OVERLAY_TITLES` + the echo test)
- Create: `web/src/lib/world/scenes/nextStep.test.ts`
- Modify: `web/src/screens/LibraryTent.svelte`, `web/src/screens/Delphi.svelte`, `web/src/screens/Title.svelte`, `web/src/screens/Camp.svelte` (overlay titles from `OVERLAY_TITLES`; the owl's tap)
- Modify (e2e selector sweep for the renamed titles): `web/e2e/helpers.ts`, `happy-path.spec.ts`, `scan.spec.ts`, `alexandria.spec.ts`, `scenes-camp.spec.ts`, `scenes-library.spec.ts`, `scenes-delphi.spec.ts`

**Interfaces:**
- Consumes: `PLACE_ICONS.portal`, `ADD_ICONS` (Task 1), `kit-glow-strong` (Task 2).
- Produces:
  - `HotspotDef.ariaLabel?: string`, `HotspotDef.grand?: boolean`; a hotspot with `label: ''` renders no plaque.
  - `OVERLAY_TITLES: Record<PanelId, string>`.
  - `owlHint(previous, rnd?)` in `library.ts`.
  - Every overlay title in its final form: « Tes parchemins », « Le pupitre », « La lentille de bronze », « Le portail d'Alexandrie » (×2), « La Pythie », « Le mur des quêtes », « Forge ton bouclier », « Tous les héros », « Ton héros ».

- [ ] **Step 1: Write the failing unit tests**

In `web/src/lib/world/places.test.ts` add (import `OVERLAY_TITLES`, `LIBRARY_SCENE`, `DELPHI_SCENE`, `CAMP_HOTSPOTS` or whatever `camp.ts` exports):

```ts
  it('names every overlay once, echoing the plaque that opens it (carry #12, playability #15, Ruling W6)', () => {
    expect(OVERLAY_TITLES).toEqual({
      tous: 'Tous les héros',
      nouveau: 'Forge ton bouclier',
      heros: 'Ton héros',
      etageres: 'Tes parchemins',
      pupitre: 'Le pupitre',
      loupe: 'La lentille de bronze',
      portail: "Le portail d'Alexandrie",
      oeuvre: "Le portail d'Alexandrie",
      pythie: 'La Pythie',
      tablettes: 'Le mur des quêtes',
    });
    for (const scene of [LIBRARY_SCENE, DELPHI_SCENE]) {
      for (const h of scene.hotspots) {
        if (!h.target || !h.label) continue;
        const view = placeFor({ name: h.target, params: { profileId: '1', workId: 'w', ...h.params }, query: h.query ?? {} });
        const title = OVERLAY_TITLES[view!.panel!];
        expect(title.startsWith(h.label), `${scene.id}/${h.id}: « ${h.label} » opens « ${title} »`).toBe(true);
      }
    }
  });

  it('calls the quest wall the same on the hub (Ruling W13)', () => {
    expect(CAMP_HOTSPOTS.find((h) => h.id === 'quests')!.label).toBe(OVERLAY_TITLES.tablettes);
  });
```

`web/src/lib/world/scenes/nextStep.test.ts`:

```ts
// Carry recommendation 6 / playability #11 (Ruling W14): at most one "next step" glow per scene,
// whatever the camp state. (The hub-wide nextStep(camp) is UI3b.)
import { describe, expect, it } from 'vitest';
import type { CampResponse } from '../types';
import { LIBRARY_SCENE } from './library';
import { DELPHI_SCENE } from './delphi';
import { TITLE_SCENE } from './title';

const camps = [null, { xp: { total: 0 }, oracle: { status: 'sealed' }, quests: [] }, { xp: { total: 90 }, oracle: { status: 'chosen' }, quests: [] }] as unknown as (CampResponse | null)[];

describe('one glow per scene', () => {
  it.each([LIBRARY_SCENE, DELPHI_SCENE, TITLE_SCENE])('$id', (scene) => {
    for (const camp of camps) {
      const lit = scene.hotspots.filter((h) => h.state({ camp, catalog: null }).isNew).map((h) => h.id);
      expect(lit.length, `${scene.id} with ${JSON.stringify(camp?.xp ?? null)}: ${lit}`).toBeLessThanOrEqual(1);
    }
  });
});
```

(Widen the fixture camps with the fields each state function reads. Read `delphi.ts`/`library.ts` and cast as the existing scene tests do.)

Update the scene tests to the new data:
- `library.test.ts`: captions `['Écrire un nouveau parchemin', 'Déchiffrer une feuille', "Les livres d'Alexandrie"]`; icons: shelves `ADD_ICONS.alexandria` (the stacked scrolls), desk `add-text`, lens `add-scan`, portal `/art/icons/portal-arch.webp`; ids and targets include `['owl', null]`; the owl has `label: ''` and `ariaLabel: "La chouette d'Athéna"`; `owlHint` never repeats the previous line.
- `delphi.test.ts`: the caption `'Trois rouleaux à ouvrir'`; the greeting `"Approche. Trois rouleaux scellés t'attendent cette semaine."`; tablets `labelPos: 'above'`.
- `camp.test.ts`: the oracle caption `'Trois rouleaux à ouvrir'`; the quests label `'Le mur des quêtes'`.
- `title.test.ts`: `TITLE_HOTSPOTS[0].grand === true`.
- `validate.test.ts`: `validateScene` reports `owl: a hotspot without a label needs an ariaLabel` for a planted label-less hotspot with no `ariaLabel`.

Run: `scripts/npm.sh run test -- src/lib/world src/lib/scene`
Expected: FAIL on each new expectation.

- [ ] **Step 2: Types and validation**

In `lib/scene/types.ts`, on `HotspotDef`:

```ts
  /** Place name shown on the plaque (Cinzel caps). '' for a hotspot with no plaque (a character you
   *  can tap, e.g. the library owl): it then needs `ariaLabel`. */
  label: string;
  /** The accessible name when `label` is '' (immersion wave, playability #23). */
  ariaLabel?: string;
  /** A bigger plaque for a scene's single call to action (the title's « Entrer », playability #11). */
  grand?: boolean;
```

In `validateScene` add: `for (const h of scene.hotspots) if (!h.label && !h.ariaLabel) problems.push(`${h.id}: a hotspot without a label needs an ariaLabel`);`

- [ ] **Step 3: `Hotspot.svelte`: no plaque for a label-less hotspot, a visible next step, a grand plaque**

- Add `class:grand={def.grand === true}` and `aria-label={def.ariaLabel}` to the button.
- Wrap the plaque: `{#if def.label}<span class="hotspot-label" …>…</span>{/if}`.
- Make `pinned` require a label: `const pinned = $derived(def.leader === true && !inked && def.label !== '');`.

Add to the `<style>`:

```css
  /* Playability #11: the next step is visible on a bright painting - a gold-rimmed plaque with a
     warm halo, and a stronger pulse on the shape. Under reduced motion (no .bob) the gold rim and
     the brighter static glow stay. */
  .hotspot.is-new .hotspot-label {
    border-color: var(--gold-light);
    box-shadow:
      0 0 0 2px rgba(241, 220, 154, 0.6),
      0 0 18px rgba(255, 220, 140, 0.75),
      0 3px 8px rgba(0, 0, 0, 0.35);
  }
  .hotspot.is-new .hotspot-glow {
    opacity: 0.65;
  }
  .hotspot.bob.is-new .hotspot-glow {
    animation: kit-glow-strong 2.4s ease-in-out infinite;
  }
  /* The title's « Entrer »: the scene's one call to action. */
  .hotspot.grand .hotspot-label {
    padding: 8px 20px;
  }
  .hotspot.grand .hotspot-name {
    font-size: 20px;
  }
```

(The existing `.hotspot.bob .hotspot-glow` rule sets `kit-glow` at the same specificity; put the `is-new` rule **after** it.)

- [ ] **Step 4: Scene data**

`title.ts`: the gate gets `grand: true`.

`library.ts`: import `PLACE_ICONS`, and give every hotspot its final caption and icon:

| Hotspot | icon | caption |
|---|---|---|
| shelves | `ADD_ICONS.alexandria` (the stacked scrolls; playability #20) | new hero: « Choisis un texte à défendre » (unchanged) |
| desk | `ADD_ICONS.text` | `st({ caption: 'Écrire un nouveau parchemin' })` |
| lens | `ADD_ICONS.scan` | `st({ caption: 'Déchiffrer une feuille' })` |
| portal | `PLACE_ICONS.portal` | `st({ caption: "Les livres d'Alexandrie" })` |

and append the owl:

```ts
  // Playability #23: Athena's owl is a speaker you can tap, not scenery. No plaque (she is the
  // plaque-less character on her side table); a tap replays one of her hints in the dialogue box.
  {
    id: 'owl',
    label: '',
    ariaLabel: "La chouette d'Athéna",
    target: null,
    shape: LIBRARY_SHAPES.owl,
    labelPos: 'above',
    state: () => st(),
  },
```

and the hints:

```ts
const OWL_HINTS = [
  'Hou ! Tes parchemins dorment sur les étagères. Choisis-en un et défends-le contre Éris.',
  'Hou ! Au pupitre, tu peux écrire ou coller un texte à toi.',
  'Hou ! La lentille de bronze déchiffre les feuilles imprimées de ta classe.',
  "Hou ! Derrière le portail, les scribes d'Alexandrie recopient de vieux livres pour toi.",
];

/** A random owl hint, never the one she just said (spec §8: no immediate repeat). */
export function owlHint(previous: number, rnd: () => number = Math.random): { line: DialogueLine; index: number } {
  let index = Math.floor(rnd() * OWL_HINTS.length);
  if (index === previous) index = (index + 1) % OWL_HINTS.length;
  return { index, line: { speaker: 'owl', name: "La chouette d'Athéna", portrait: ART.characters.owl, text: OWL_HINTS[index] } };
}
```

`library.shapes.ts`: `owl: { kind: 'ellipse', cx: 80.5, cy: 51, rx: 3.8, ry: 7 },`. This covers the owl cut-out (x 76–84, y 44–58, `OWL_LAYER`) and stays clear of the portal box (x ≤ 76) and inside the safe zone (≤ 87.5). Explain it in the file's header comment. Check it with `?debug` (Step 7).

`delphi.ts`:
- the Pythia's sealed caption becomes `'Trois rouleaux à ouvrir'`;
- the greeting's sealed line becomes `"Approche. Trois rouleaux scellés t'attendent cette semaine."` (playability #22: no masculine vocative);
- the tablets get `labelPos: 'above'` (playability #16: the plaque on the wall, not on the altar).

`delphi.shapes.ts`: extend the tablets' bottom edge to 59: `tablets: { kind: 'polygon', points: [[53.5, 23], [81.5, 23], [81.5, 59], [53.5, 59]] },`. The painted bottom row reaches y 58. Update the header comment and make sure it stays clear of the altar card (Delphi's `.altar-prophecy` starts at y 66).

`camp.ts`: the oracle's sealed caption becomes `'Trois rouleaux à ouvrir'`, and the quests hotspot label becomes `'Le mur des quêtes'` (until UI3b drops it, see Deferred).

- [ ] **Step 5: `OVERLAY_TITLES` and the screens**

In `places.ts`:

```ts
/** Every overlay's title (Ruling W6): a place hotspot's plaque starts its overlay's title, so the
 *  player opens what she tapped (carry #12, playability #15). One table, read by every place. */
export const OVERLAY_TITLES: Record<PanelId, string> = {
  tous: 'Tous les héros',
  nouveau: 'Forge ton bouclier',
  heros: 'Ton héros',
  etageres: 'Tes parchemins',
  pupitre: 'Le pupitre',
  loupe: 'La lentille de bronze',
  portail: "Le portail d'Alexandrie",
  oeuvre: "Le portail d'Alexandrie",
  pythie: 'La Pythie',
  tablettes: 'Le mur des quêtes',
};
```

Every `<Overlay title=…>` in `Title.svelte`, `Camp.svelte`, `LibraryTent.svelte` and `Delphi.svelte` becomes `title={OVERLAY_TITLES.<panel>}`.

In `LibraryTent.svelte`, the owl speaks on a tap:

```ts
  let lastHint = -1;
  function speak() {
    const { line, index } = owlHint(lastHint);
    lastHint = index;
    greeting = [line];
  }
  const activate = (def: HotspotDef) => (def.id === 'owl' ? speak() : openHotspot(def, profile.id));
```

(`Hotspot` releases its one-tap guard itself for a `target: null` hotspot. `greeting` is the same state the welcome line uses, so the `DialogueBox` shows it.)

- [ ] **Step 6: Sweep the e2e selectors for the renamed titles**

| Old | New | Where |
|---|---|---|
| `heading 'Les Parchemins'` | `'Tes parchemins'` | `helpers.ts` (`openShelves`), `happy-path.spec.ts:23`, `scan.spec.ts:29`, `scenes-camp.spec.ts:130,254`, `scenes-library.spec.ts:54` |
| `'Nouveau parchemin'` | `'Le pupitre'` | `scenes-library.spec.ts:160` |
| `'Scanner une feuille'` | `'La lentille de bronze'` | `scenes-library.spec.ts:182` |
| `"Bibliothèque d'Alexandrie"` | `"Le portail d'Alexandrie"` | `alexandria.spec.ts:42`, `scenes-library.spec.ts:204` |
| `"L'Oracle de Delphes"` | `'La Pythie'` | `scenes-delphi.spec.ts:52` |
| `'Le tableau des quêtes'` | `'Le mur des quêtes'` | `scenes-delphi.spec.ts:85`, `scenes-camp.spec.ts:25` (regex) and its comment at `:453` |
| `'Taper ou coller un texte'` | `'Écrire un nouveau parchemin'` | `scenes-library.spec.ts:38` |

Grep for each old string in `web/e2e` and `web/src` to catch any line the table missed (comments included: keep them truthful).

Add to `scenes-library.spec.ts`:

```ts
test('the owl is a speaker you can tap: she replays one of her hints', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openTent(page, id);
  await page.getByTestId('dialogue-skip').click();
  await expect(page.getByTestId('dialogue-box')).toHaveCount(0);
  const owl = page.getByTestId('library-owl');
  await expect(owl).toHaveAccessibleName("La chouette d'Athéna");
  await expect(owl.locator('.hotspot-label')).toHaveCount(0);
  await tap(owl, testInfo);
  await expect(page.getByTestId('dialogue-text')).toContainText('Hou !');
  // The other places still open (one-tap guard released for a null target).
  await page.getByTestId('dialogue-skip').click();
  await tap(page.getByTestId('library-shelves'), testInfo);
  await expect(page.getByTestId('overlay-shelves')).toBeVisible();
});
```

Add `'library-owl'` to that spec's safe-zone check. `expectInSafeZone` requires a label, so give it an `{ noLabel: true }` variant or measure the owl alone: add an optional third parameter `labelless: string[] = []` whose ids skip the label checks. `labelOverlaps` already skips a hotspot without `.hotspot-label`.

Add to `scenes-delphi.spec.ts` a check that the tablets' plaque sits above the wall (`label.y + label.height <= tablets.y`) and below the HUD band. `expectInSafeZone` covers the band.

Add to `scenes-title.spec.ts` a check that the new next-step look is there:

```ts
  const label = page.getByTestId('title-gate').locator('.hotspot-label');
  await expect(label).toHaveCSS('border-top-color', 'rgb(241, 220, 154)');
  expect(await label.evaluate((e) => parseFloat(getComputedStyle(e.querySelector('.hotspot-name')!).fontSize))).toBe(20);
```

- [ ] **Step 7: Check the shapes with `?debug`**

Take a scratch screenshot of `/?debug#/p/<id>/tente-parchemins` and `/?debug#/p/<id>/temple` at 1180×820 and 1280×720 (not committed; the walk in Task 14 takes the committed ones). With the Read tool, check:
- the owl ellipse sits on the owl;
- the tablets rectangle covers the bottom row;
- the tablets plaque sits between the top laurel sprigs (y ≈ 17 %), clear of the HUD.

- [ ] **Step 8: Run the tests**

```bash
scripts/npm.sh run test -- src/lib/world src/lib/scene
scripts/npm.sh run check
scripts/playwright.sh scenes-library scenes-delphi scenes-title scenes-camp alexandria happy-path scan
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add web/src/components/scene/Hotspot.svelte web/src/lib/scene web/src/lib/world/scenes web/src/lib/world/places.ts web/src/lib/world/places.test.ts web/src/screens/LibraryTent.svelte web/src/screens/Delphi.svelte web/src/screens/Title.svelte web/src/screens/Camp.svelte web/e2e
git commit -m "Immersion wave: one name per place, overlay titles echo plaques, a visible next step, the owl speaks, captions in the camp's words" -- web/src/components/scene/Hotspot.svelte web/src/lib/scene web/src/lib/world/scenes web/src/lib/world/places.ts web/src/lib/world/places.test.ts web/src/screens/LibraryTent.svelte web/src/screens/Delphi.svelte web/src/screens/Title.svelte web/src/screens/Camp.svelte web/e2e
```

---

### Task 6: The title: shields that hang on the hooks, one cloth ribbon, a wax-sealed PIN

**Findings:** #13, #14 (and #26's long names, checked here with a real long accented name). **Depends on:** Tasks 3, 4.

**Files:**
- Modify: `web/src/lib/world/scenes/title.ts`, `web/src/lib/world/scenes/title.test.ts`, `web/src/screens/Title.svelte`, `web/src/components/PinGate.svelte`
- Modify: `web/e2e/scenes-title.spec.ts`, `web/e2e/profiles.spec.ts`
- Modify: `web/src/placesKit.test.ts` (nothing to remove: Title/PinGate are outside `components/places`; this task leaves `PENDING` as is)

**Interfaces:**
- Consumes: `de()` (Task 4), `kit-ribbon`, `kit-seal`, `kit-link` (Task 3), Wave A's M16 retry on `.title-note`.
- Produces: `SHIELD_SLOTS` on the painted hooks, `SHIELD_W` (art % width of a shield), the PIN caption « Tes quatre chiffres » (its label; e2e uses `getByLabel('Tes quatre chiffres')`).

- [ ] **Step 1: Measure the hooks**

Open `web/public/art/scenes/title_gates.webp` (2048×1152) with the Read tool, and the `?debug` shot of `/?debug#/` at 1180×820 (`docs/reviews/ui3/ipad-landscape-d01-debug-title.png`). Locate each painted hook's tip in art % (x = px / 2048, y = px / 1152). The review's reading of a02 (`docs/reviews/ui3/ipad-landscape-a02-title-shields.png`, art box 1458 px wide, offset −139 px) gives these approximate values, to confirm or correct:
- left rail hooks at x ≈ 17.4, 20.4, 23.3, 30.8, 33.9;
- right rail hooks at x ≈ 65.4, 75.4, 78.3, 81.2, 84.3;
- hook tips at y ≈ 55.5.

Pick three hooks per rail whose centres are at least `SHIELD_W + 0.3` apart, inside the safe zone (a centre in 12.5 + SHIELD_W/2 … 87.5 − SHIELD_W/2) and clear of the pillars and torches (x 36–63).

- [ ] **Step 2: Test the slots (failing first)**

In `title.test.ts`:

```ts
  it('hangs each shield on a painted hook: spaced, inside the safe zone, clear of the gate (playability #13)', () => {
    expect(SHIELD_SLOTS).toHaveLength(6);
    const xs = SHIELD_SLOTS.map((s) => s.x);
    for (let i = 1; i < xs.length; i++) {
      if (i === 3) continue; // left rail -> right rail
      expect(xs[i] - xs[i - 1], `slots ${i - 1}-${i}`).toBeGreaterThanOrEqual(SHIELD_W + 0.3);
    }
    for (const s of SHIELD_SLOTS) {
      expect(s.x - SHIELD_W / 2).toBeGreaterThanOrEqual(12.5);
      expect(s.x + SHIELD_W / 2).toBeLessThanOrEqual(87.5);
      expect(s.x < 36 || s.x > 63, `x ${s.x} clear of the gate`).toBe(true);
      expect(s.y).toBeGreaterThanOrEqual(53);
      expect(s.y).toBeLessThanOrEqual(58);
    }
  });
```

In `title.ts`: `export const SHIELD_W = 5.5;` (art %; 80 px wide at 1180×820, 70 px at 1280×720, both ≥ 64). Set `SHIELD_SLOTS` to the measured hooks (`x` = hook x, `y` = hook tip y). Rewrite the header comment with the measured values and the method.

- [ ] **Step 3: `Title.svelte`: shields on hooks, a blank shield to forge, one ribbon**

- `.shield`: `width: 5.5%` (keep `min-width: 64px`). Put a bronze ring at its top, which is what hangs on the hook:

```svelte
<span class="shield-ring" aria-hidden="true"></span>
```

```css
  /* Playability #13: the ring sits on the painted hook (the slot's y is the hook's tip). */
  .shield-ring {
    width: 14px;
    height: 14px;
    margin-bottom: -4px;
    border-radius: 50%;
    border: 3px solid var(--bronze-light);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  }
```

- The new-hero shield is a blank shield to forge, not a coin: `<span class="shield-face is-blank"><Icon name="plus" size={30} /></span>` with

```css
  .shield-face.is-blank {
    background: radial-gradient(circle, rgba(243, 230, 200, 0.28), rgba(243, 230, 200, 0.12) 70%);
    border: 3px dashed var(--bronze-light);
    color: var(--gold-light);
    box-shadow: inset 0 0 14px rgba(0, 0, 0, 0.35);
  }
```

- The two pills become **one** ribbon (Wave A's M16 retry stays in the error branch):

```svelte
    {#if loading}
      <p class="kit-ribbon title-note stage-text">Les Muses cherchent les héros…</p>
    {:else if error}
      <!-- Wave A M16: the error banner and its « Réessayer »; restyle its <p> as kit-ribbon, keep the retry button (kit-bronze). -->
    {:else}
      <p class="kit-ribbon title-note stage-text" data-testid="title-hint">
        {profiles.length === 0 ? 'Accroche ton bouclier à la porte du camp.' : 'Choisis ton bouclier'}
      </p>
    {/if}
```

  Delete the separate `.title-hint` banner and its CSS. Keep `.title-note` at `bottom: 8%`, and let it wrap (`white-space: normal; max-width: 70%; text-align: center`; Wave A may already have done this).
- The shields group's `aria-label` becomes « Choisis ton bouclier ».

- [ ] **Step 4: `PinGate.svelte`: a wax seal with four slots**

Replace the markup (the logic is unchanged: `onInput`, auto-submit at 4 digits, the errors):

```svelte
<div class="pin-gate" data-testid="pin-gate">
  <img class="pin-backdrop" src={ART.scenes.titleGates} alt="" aria-hidden="true" />
  <div class="pin-seal kit-parchment kit-form">
    <img class="pin-lock" src={MARK_ICONS.lock} alt="" />
    <h1 class="kit-plaque pin-title">Le sceau {de(profile.name)}</h1>
    <!-- Playability #14: four wax slots fill as digits arrive; the real input lies over them
         (opacity 0), so a tap anywhere on the slots opens the keypad. -->
    <div class="pin-slots" data-testid="pin-slots">
      {#each [0, 1, 2, 3] as i (i)}
        <span class="kit-seal pin-slot" class:is-empty={pin.length <= i} aria-hidden="true"></span>
      {/each}
      <input
        id="pin-input"
        class="pin-input"
        type="text"
        inputmode="numeric"
        pattern="[0-9]*"
        maxlength="4"
        autocomplete="off"
        value={pin}
        oninput={onInput}
        disabled={checking}
      />
    </div>
    <label class="pin-caption" for="pin-input">Tes quatre chiffres</label>
    {#if error}
      <p class="orange" role="alert">{error}</p>
    {/if}
    <a class="kit-link" href={href('profiles')}>Changer de héros</a>
  </div>
</div>
```

The CSS changes. Keep `.pin-gate` and `.pin-lock` as they are, and delete the old `.pin-input` rule:

```css
  /* Playability #14: `inset: -16px` pushes the blur's dark edge halo off screen. */
  .pin-backdrop {
    position: absolute;
    inset: -16px;
    width: calc(100% + 32px);
    height: calc(100% + 32px);
    object-fit: cover;
    filter: blur(8px) brightness(0.45);
  }
  .pin-title {
    max-width: 100%;
    font-size: 18px;
    white-space: normal;
    text-wrap: balance;
  }
  .pin-slots {
    position: relative;
    display: flex;
    gap: 14px;
  }
  .pin-slot {
    --seal-size: 52px;
  }
  .pin-slot.is-empty {
    background: rgba(92, 64, 24, 0.12);
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
    border: 2px dashed rgba(138, 90, 40, 0.5);
  }
  .pin-input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    font-size: 16px; /* no iOS zoom on focus */
    caret-color: transparent;
    -webkit-text-security: disc;
  }
  .pin-slots:focus-within {
    outline: 3px solid var(--gold-light);
    outline-offset: 6px;
    border-radius: 12px;
  }
  .pin-caption {
    font-family: var(--font-body);
    font-variant: normal;
    font-weight: 600;
    font-size: 16px;
    color: var(--form-ink-soft);
  }
```

- [ ] **Step 5: e2e**

- In `scenes-title.spec.ts` and `profiles.spec.ts`, replace every `getByLabel(/Code de/)` with `getByLabel('Tes quatre chiffres')`.
- In the "protected hero" test, add:
  - `await expect(page.locator('.pin-title')).toHaveText(/^Le sceau d(e |')/)`;
  - after `fill('12')`, `await expect(page.getByTestId('pin-slots').locator('.pin-slot:not(.is-empty)')).toHaveCount(2)` (then `fill('1234')` as before).
- In "« Entrer » opens the gate": `await expect(page.getByTestId('title-hint')).toHaveCount(1)` (one line, not two), and its text is one of the two sentences.
- In "six slots": each shield's ring top (`.shield-ring` box y) is within ±1.5 % of the art height of `art.y + art.height * slot.y / 100` (pass `SHIELD_SLOTS` in through a small inline copy; e2e can't import app modules, so copy the y value with a comment pointing at `title.ts`).
- Add a test that elides for a real long accented name and fits it:

```ts
test('the seal speaks French with a long accented name: « Le sceau d'Élise-Marguerite »', async ({ page, request }, testInfo) => {
  // A unique but realistic name (starts with a vowel, has an accent and a hyphen, ~20 chars).
  const name = `Élise-Marguerite-${testInfo.project.name.slice(0, 1)}${uniqueName('').slice(-4)}`;
  const res = await request.post('/api/profiles', { data: { name, avatar: 'lyre', level: '10H', pin: '1234' } });
  expect(res.ok(), await res.text()).toBeTruthy();
  await page.goto(`/#/p/${(await res.json()).id}/camp`);
  const title = page.locator('.pin-title');
  await expect(title).toContainText("Le sceau d'Élise-Marguerite");
  const [t, seal] = await Promise.all([title.boundingBox(), page.locator('.pin-seal').boundingBox()]);
  expect(t!.x).toBeGreaterThanOrEqual(seal!.x);
  expect(t!.x + t!.width).toBeLessThanOrEqual(seal!.x + seal!.width);
});
```

(Name length: `Élise-Marguerite-` is 17 characters + 1 + 4 = 22, under the 30-character limit.)
- `profiles.spec.ts`: the « Changer de héros » link keeps its name and role.

- [ ] **Step 6: Run the tests**

```bash
scripts/npm.sh run test -- src/lib/world/scenes/title.test.ts
scripts/npm.sh run check
scripts/playwright.sh scenes-title profiles
```

Expected: PASS. Take a scratch screenshot of the title with 0 heroes, the title with 3 heroes and the PIN seal, and view them. The shields must hang on the hooks, and there is one ribbon line.

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/world/scenes/title.ts web/src/lib/world/scenes/title.test.ts web/src/screens/Title.svelte web/src/components/PinGate.svelte web/e2e/scenes-title.spec.ts web/e2e/profiles.spec.ts
git commit -m "Immersion wave: shields hang on the gate's hooks, one cloth ribbon, a wax-sealed PIN with four slots and elision" -- web/src/lib/world/scenes/title.ts web/src/lib/world/scenes/title.test.ts web/src/screens/Title.svelte web/src/components/PinGate.svelte web/e2e/scenes-title.spec.ts web/e2e/profiles.spec.ts
```

---

### Task 7: The naming ritual: « Forge ton bouclier »

**Findings:** #3, #4 (the ritual's select). **Depends on:** Tasks 2, 3, 5.

**Files:**
- Modify: `web/src/components/places/title/HeroForm.svelte`, `web/src/screens/Title.svelte` (`size="wide"`, `voice={VOICES.ritual}`)
- Modify: `web/src/placesKit.test.ts` (remove HeroForm from `PENDING`)
- Modify: `web/e2e/helpers.ts` (`chooseLevel`, `newHero`), `web/e2e/scenes-title.spec.ts`, `web/e2e/profiles.spec.ts`, `web/e2e/world.spec.ts`, `web/e2e/playability-ui3.spec.ts` (only the ritual's selectors; the walk's content is Task 14)

**Interfaces:**
- Consumes: `LevelMedallions`, `kit-bronze`, `kit-link`, `avatarIcon()` (`lib/world/art.ts`), `VOICES.ritual`.
- Produces: e2e `chooseLevel(scope: Locator, level: string)`. The ritual's controls: `getByLabel('Ton prénom')`, radios named by level, the toggle button « Protéger ton bouclier d'un sceau » (`aria-expanded`), `getByLabel('Ton sceau à quatre chiffres')`, the submit « Accrocher mon bouclier ».

- [ ] **Step 1: Update the e2e first (failing)**

In `helpers.ts`:

```ts
// Immersion wave Ruling W5: levels are medallion radios named by their level.
export async function chooseLevel(scope: Locator, level: string) {
  await scope.getByRole('radio', { name: level, exact: true }).check();
}
```

and `newHero` becomes:

```ts
export async function newHero(page: Page, name: string, level = '10H', pin?: string) {
  await page.goto('/');
  await enterTitle(page);
  await page.getByTestId('title-new').click();
  const ritual = page.getByTestId('overlay-hero-new');
  await expect(ritual).toBeVisible();
  await ritual.getByLabel('Ton prénom').fill(name);
  await chooseLevel(ritual, level);
  if (pin) {
    await ritual.getByRole('button', { name: "Protéger ton bouclier d'un sceau" }).click();
    await ritual.getByLabel('Ton sceau à quatre chiffres').fill(pin);
  }
  await ritual.getByRole('button', { name: 'Accrocher mon bouclier' }).click();
  await expectCamp(page);
}
```

Replace the same three steps (name, `selectOption`, code, 'Rejoindre le camp') in:
- `scenes-title.spec.ts:91–105, 130–132, 174–176`;
- `profiles.spec.ts:20–22`;
- `world.spec.ts:56–59` (read it: it may click « Nouveau héros » by role; keep that);
- `playability-ui3.spec.ts:109–113`.

At `scenes-title.spec.ts:94`, `expect(getByLabel(/Un code à quatre chiffres/))` becomes: the seal field is hidden until the toggle is pressed, then visible, and pressing again hides it and clears it.

Add to the ritual test:

```ts
  await expect(ritual.getByRole('heading', { name: 'Forge ton bouclier' })).toBeVisible();
  await expect(ritual.getByTestId('overlay-voice')).toContainText('bannière');
  await ritual.getByLabel('Ton prénom').fill(name);
  await expect(ritual.getByTestId('forge-banner')).toHaveText(name);
  await ritual.locator('label.avatar-choice', { hasText: 'Trident' }).click();
  await expect(ritual.getByTestId('forge-emblem')).toHaveAttribute('src', '/art/icons/avatar-trident.webp');
  await expect(ritual.getByRole('group', { name: 'Ta classe' })).toBeVisible();
  await expect(ritual.locator('select')).toHaveCount(0);
  await expect(ritual.getByText(/HarmoS|facultatif|profil/)).toHaveCount(0);
  await expectOverlayTapTargets(page, 'overlay-hero-new');
```

Run: `scripts/playwright.sh scenes-title --project=desktop`
Expected: FAIL (no « Forge ton bouclier » body, no radios).

- [ ] **Step 2: Rewrite `HeroForm.svelte`**

Keep the script's logic (`submit`, the 409 and other errors, `markUnlocked`, `replaceRoute` to the camp, `onPinInput`). Add:

```ts
  import LevelMedallions from '../../ui/LevelMedallions.svelte';
  import { avatarIcon } from '../../../lib/world/art';

  let sealOpen = $state(false);
  function toggleSeal() {
    sealOpen = !sealOpen;
    if (!sealOpen) pin = ''; // a closed seal is never sent
  }
```

Remove the `LevelSelect` import. The markup:

```svelte
<div class="hero-form">
  <form class="forge" onsubmit={submit}>
    <!-- Playability #3: the shield that will hang on the gate, forged live. -->
    <div class="forge-preview" aria-hidden="true">
      <span class="forge-shield"><img data-testid="forge-emblem" src={avatarIcon(avatar)} alt="" /></span>
      <span class="forge-banner" data-testid="forge-banner">{name.trim() || 'Ton prénom'}</span>
    </div>

    <div class="forge-fields">
      <div class="field">
        <label for="name">Ton prénom</label>
        <input id="name" type="text" maxlength="30" autocapitalize="words" bind:value={name} required />
      </div>

      <fieldset class="field">
        <legend>Ton emblème</legend>
        <div class="avatars">
          {#each AVATARS as a (a)}
            <label class="avatar-choice" class:selected={avatar === a}>
              <input type="radio" name="avatar" value={a} bind:group={avatar} />
              <Avatar avatar={a} size={56} ring />
              <span>{avatarLabel(a)}</span>
            </label>
          {/each}
        </div>
      </fieldset>

      <LevelMedallions legend="Ta classe" name="level" bind:value={level} />

      <div class="seal">
        <button type="button" class="kit-link" aria-expanded={sealOpen} aria-controls="seal-field" onclick={toggleSeal}>
          Protéger ton bouclier d'un sceau
        </button>
        {#if sealOpen}
          <div class="field" id="seal-field">
            <label for="pin">Ton sceau à quatre chiffres</label>
            <input
              id="pin"
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              maxlength="4"
              autocomplete="new-password"
              value={pin}
              oninput={onPinInput}
            />
            <p class="hint muted">Personne d'autre que toi ne pourra l'ouvrir.</p>
          </div>
        {/if}
      </div>

      {#if error}
        <p class="orange" role="alert">{error}</p>
      {/if}

      <button type="submit" class="kit-bronze forge-submit" disabled={submitting || !name.trim()}>Accrocher mon bouclier</button>
    </div>
  </form>
</div>
```

Styles (replace the old ones; keep the focus-within ring on `.avatar-choice` and `#pin`'s text security):

```css
  .forge {
    display: grid;
    grid-template-columns: 1fr;
    gap: 24px;
  }
  @media (min-width: 760px) {
    .forge {
      grid-template-columns: 240px 1fr;
      align-items: start;
    }
  }
  .forge-preview {
    position: sticky;
    top: 0;
    display: grid;
    justify-items: center;
    gap: 0;
    padding-top: 8px;
  }
  /* The hoplite shield that will hang on the gate: the chosen emblem at its boss. */
  .forge-shield {
    display: grid;
    place-items: center;
    width: 190px;
    height: 190px;
    border-radius: 50%;
    border: 5px solid var(--bronze-dark);
    background: radial-gradient(circle at 38% 32%, var(--bronze-light), var(--bronze) 58%, var(--bronze-dark));
    box-shadow:
      inset 0 0 0 8px rgba(255, 240, 200, 0.18),
      inset 0 0 0 10px var(--bronze-dark),
      0 8px 18px rgba(0, 0, 0, 0.45);
  }
  .forge-shield img {
    width: 62%;
    height: 62%;
    object-fit: contain;
    filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.5));
  }
  /* Her name on a cloth banner across the shield's foot. */
  .forge-banner {
    max-width: 230px;
    margin-top: -26px;
    padding: 6px 30px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    background: linear-gradient(180deg, #a5532f, #7e3b20);
    color: var(--bronze-ink);
    font-family: var(--font-body);
    font-weight: 700;
    font-size: 20px;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
    clip-path: polygon(0 0, 100% 0, calc(100% - 14px) 50%, 100% 100%, 0 100%, 14px 50%);
  }
  .field {
    margin-bottom: 18px;
  }
  .field input[type='text'] {
    width: 100%;
    min-height: 48px;
    font-size: 19px;
  }
  fieldset {
    border: none;
    padding: 0;
    margin: 0 0 18px;
  }
  legend {
    margin-bottom: 8px;
    padding: 0;
  }
  .avatars {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
  /* Medallions without card boxes (playability #3). */
  .avatar-choice {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    min-width: 64px;
    padding: 4px;
    border-radius: 12px;
    font-variant: normal;
    font-weight: 600;
    cursor: pointer;
  }
  .avatar-choice.selected :global(.avatar) {
    box-shadow:
      0 0 0 3px var(--gold-light),
      0 0 14px rgba(255, 220, 140, 0.8);
  }
  .avatar-choice input {
    position: absolute;
    inset: 0;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }
  .avatar-choice:focus-within {
    outline: 3px solid var(--bronze-light);
    outline-offset: 2px;
  }
  .forge-submit {
    margin-top: 6px;
  }
  .hint {
    font-size: 15px;
    margin: 4px 0 0;
  }
  #pin {
    width: 160px;
    letter-spacing: 0.4em;
    -webkit-text-security: disc;
  }
```

(Check `Avatar.svelte`'s root class name for the `.selected` glow: use it instead of `.avatar` if it differs.)

In `Title.svelte`: `<Overlay variant="scroll" size="wide" title={OVERLAY_TITLES.nouveau} testId="overlay-hero-new" voice={VOICES.ritual} …>`.

Remove `src/components/places/title/HeroForm.svelte` from `PENDING` in `placesKit.test.ts`.

- [ ] **Step 3: Run the tests**

```bash
scripts/npm.sh run test -- src/placesKit.test.ts
scripts/npm.sh run check
scripts/playwright.sh scenes-title profiles world happy-path grimoire scan
```

(Every spec that names a hero through `newHero` or `createProfile` runs here.) Expected: PASS. Take a scratch iPad screenshot of the ritual with a long name and view it: the shield preview on the left, the fields on the right, everything visible without scrolling at 1180×820.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/places/title/HeroForm.svelte web/src/screens/Title.svelte web/src/placesKit.test.ts web/e2e/helpers.ts web/e2e/scenes-title.spec.ts web/e2e/profiles.spec.ts web/e2e/world.spec.ts web/e2e/playability-ui3.spec.ts
git commit -m "Immersion wave: the naming ritual forges a shield (live preview, emblem and class medallions, an optional seal)" -- web/src/components/places/title/HeroForm.svelte web/src/screens/Title.svelte web/src/placesKit.test.ts web/e2e/helpers.ts web/e2e/scenes-title.spec.ts web/e2e/profiles.spec.ts web/e2e/world.spec.ts web/e2e/playability-ui3.spec.ts
```

---

### Task 8: The shelves: rolled scrolls in cubbies, with seals and paper tags; « Pour toi »

**Findings:** #1 (shelves as objects), #2, #25 (shelves). **Depends on:** Tasks 1 (scroll art; else `.roll-css`), 2, 3, 4, 5.

**Files:**
- Modify: `web/src/components/places/library/ShelvesPanel.svelte` (rewrite of markup and styles; the loading logic stays)
- Modify: `web/src/placesKit.test.ts` (remove ShelvesPanel from `PENDING`)
- Modify: `web/e2e/scenes-library.spec.ts`, `web/e2e/scan.spec.ts`, `web/e2e/grimoire.spec.ts`, `web/e2e/profiles.spec.ts`, `web/e2e/scenes-overlays.spec.ts`

**Interfaces:**
- Consumes: `lengthOf`, `historyLine`, `textByline` (Task 4), `longDate` (Task 4), `LevelMedallions`, `kit-cubby`, `kit-roll`, `kit-seal`, `kit-tag`, `kit-stamp`, `kit-prophecy`, `kit-bronze.is-quiet`, `Icon laurel` (Task 3), `ART.ui.scrollRolled`, `MARK_ICONS.oracleSeal`.
- Produces: the same test ids (`text-card` on each cubby, `chip-prophecy` on the prophecy ribbon), plus `shelf-levels` (the level medallions behind the toggle) and a cubby attribute `data-length`. The headings are « Prophéties de l'Oracle », « Pour toi », « Autres parchemins » / « Classe 9H ». The toggle is « Autres niveaux ».

- [ ] **Step 1: Update the e2e first (failing)**

In `scenes-library.spec.ts`, the shelves test (`:48`) keeps its close/Escape/Back/deep-link half. Its parity half becomes:

```ts
  await expect(shelves.getByRole('heading', { name: 'Pour toi' })).toBeVisible();
  await expect(shelves.locator('[data-testid="text-card"]').first()).toBeVisible();
  // Playability #2: no school metadata on the shelves - no grade pills, no word counts.
  await expect(shelves.getByText(/≈|\bmots\b|Jamais joué|\b10H\b/)).toHaveCount(0);
  await expect(shelves.getByTestId('shelf-levels')).toHaveCount(0);
  // Parity: every level is still one toggle away.
  await shelves.getByRole('button', { name: 'Autres niveaux' }).click();
  await chooseLevel(shelves.getByTestId('shelf-levels'), '9H');
  await expect(shelves.getByRole('heading', { name: 'Classe 9H' })).toBeVisible();
  await chooseLevel(shelves.getByTestId('shelf-levels'), 'Tous');
  await expect(shelves.getByRole('heading', { name: 'Autres parchemins' })).toBeVisible();
  await expectOverlayTapTargets(page, 'overlay-shelves');
```

(The regex `\b10H\b` must not match the toggle, which only opens on demand: it is asserted before the toggle is pressed.)

The prophecy card test (`:84`): use `uniqueName` for the title (Wave A M10 may already have), and expect the ribbon's spoken date:

```ts
  await expect(card.getByTestId('chip-prophecy')).toContainText('jeudi 1er janvier 2099');
  await expect(card).toHaveAttribute('data-length', 'court');
  await expect(card).toContainText('Jamais défendu');
```

Add a test that a defended text wears a broken seal and a laurel. Post a session through `postSession` / `makeResult` (`helpers.ts`, which uses the `X-Discorde-Day` test hook) for a text made by `createText`, then open the shelves:

```ts
test('a defended text wears a broken seal and a laurel; a new one keeps its seal whole', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const fresh = uniqueName('Sceau intact');
  const defended = uniqueName('Sceau brisé');
  const body = 'Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.';
  await createText(request, { title: fresh, body, level: '10H' });
  const t = await createText(request, { title: defended, body, level: '10H' });
  await postSession(request, { profileId: id, textId: t.id, day: new Date().toISOString().slice(0, 10), result: makeResult({ draft: 2, caught: 1 }) });
  await page.goto(`/#/p/${id}/parchemins`);
  const shelves = page.getByTestId('overlay-shelves');
  const whole = shelves.locator('[data-testid="text-card"]', { hasText: fresh });
  const broken = shelves.locator('[data-testid="text-card"]', { hasText: defended });
  await expect(whole.locator('.kit-seal')).not.toHaveClass(/is-broken/);
  await expect(broken.locator('.kit-seal')).toHaveClass(/is-broken/);
  await expect(broken.locator('.seal-laurel')).toBeVisible();
  await expect(broken).toContainText('Défendu 1 fois · 50 % des pièges déjoués');
});
```

The other specs:
- `scan.spec.ts:31–32`: the card contains « Déchiffré », and its ribbon contains `'samedi 30 juin 2035'`. « Prophéties de l'Oracle » stays a heading.
- `grimoire.spec.ts`: its text is level 8H and the hero is 10H, so the card is now behind the toggle. After the reload, open the shelves' « Autres niveaux » and choose « Tous » (`chooseLevel`) before clicking the card. Keep the 8H level: the test then also covers the toggle.
- `profiles.spec.ts:13–14` counted ≥ 25 seed texts on the shelves. Open « Autres niveaux » (« Tous ») first, then count every `text-card` in the overlay (own level + others ≥ 25).
- `scenes-overlays.spec.ts`: in the shelves test, `await expect(shelves.locator('.kit-cubby').first()).toBeVisible()` and `await expect(shelves.locator('.card, .btn, .chip')).toHaveCount(0)`.

Run: `scripts/playwright.sh scenes-library --project=desktop`
Expected: FAIL.

- [ ] **Step 2: Rewrite the markup of `ShelvesPanel.svelte`**

The script keeps `load()`, `play()`, `prophecies`, `prophecyIds` and the sort. Remove `credits()` and `historyLine()` (they move to `lib/library/shelf.ts`) and `formatSwissDate`. Add:

```ts
  import LevelMedallions from '../../ui/LevelMedallions.svelte';
  import Icon from '../../ui/Icon.svelte';
  import { ART, MARK_ICONS } from '../../../lib/world/art';
  import { historyLine, lengthOf, textByline } from '../../../lib/library/shelf';
  import { longDate } from '../../../lib/text/french';

  let othersOpen = $state(false);
  let levelFilter = $state<string>('Tous');

  const ownLevel = $derived(
    texts.filter((t) => t.level === profile.level && !prophecyIds.has(t.id)).sort(sortByLevelThenTitle),
  );
  // Behind « Autres niveaux »: every other level (« Tous »), or one level.
  const others = $derived(
    (levelFilter === 'Tous'
      ? texts.filter((t) => t.level !== profile.level && !prophecyIds.has(t.id))
      : texts.filter((t) => t.level === levelFilter)
    ).sort(sortByLevelThenTitle),
  );
```

Markup:

```svelte
<div class="panel-shelves">
  {#snippet cubby(t: TextSummary)}
    {@const len = lengthOf(t.word_count)}
    {@const defended = (t.history?.times_played ?? 0) > 0}
    <button type="button" class="kit-cubby" data-testid="text-card" data-length={len} onclick={() => play(t)}>
      <span class="kit-roll" data-length={len} aria-hidden="true">
        <img class="roll-art" src={ART.ui.scrollRolled} alt="" draggable="false" />
        <span class="kit-seal" class:is-broken={defended}>
          <img src={MARK_ICONS.oracleSeal} alt="" />
          {#if defended}<span class="seal-laurel"><Icon name="laurel" size={22} /></span>{/if}
        </span>
      </span>
      <span class="kit-tag">
        <span class="kit-tag-title">{t.title}</span>
        {#if textByline(t)}<span class="kit-tag-meta">{textByline(t)}</span>{/if}
        <span class="kit-tag-meta">parchemin {len} · {historyLine(t.history)}</span>
        {#if t.source === 'scan'}<span class="kit-stamp">Déchiffré</span>{/if}
        {#if t.source === 'online'}<span class="kit-stamp">Alexandrie</span>{/if}
        {#if t.due_date && isProphecy(t.due_date)}
          <span class="kit-prophecy" data-testid="chip-prophecy">Prophétie · {longDate(t.due_date)}</span>
        {/if}
      </span>
    </button>
  {/snippet}

  {#if loading}
    <p class="muted">Les Muses déroulent les parchemins…</p>
  {:else if error}
    <p class="orange">Impossible de lire les parchemins : {error}</p>
  {:else}
    {#if prophecies.length > 0}
      <section>
        <h3>Prophéties de l'Oracle</h3>
        <p class="muted">Ce que prépare ta classe : défends-les avant le jour dit.</p>
        <div class="cubbies">{#each prophecies as t (t.id)}{@render cubby(t)}{/each}</div>
      </section>
    {/if}

    <section>
      <h3>Pour toi</h3>
      {#if ownLevel.length > 0}
        <div class="cubbies">{#each ownLevel as t (t.id)}{@render cubby(t)}{/each}</div>
      {:else}
        <p class="muted">Aucun parchemin pour ta classe pour l'instant. Le pupitre, la lentille et le portail en apportent de nouveaux.</p>
      {/if}
    </section>

    <section class="others">
      <button type="button" class="kit-bronze is-quiet" aria-expanded={othersOpen} aria-controls="other-levels" onclick={() => (othersOpen = !othersOpen)}>
        Autres niveaux
      </button>
      {#if othersOpen}
        <div id="other-levels">
          <LevelMedallions legend="Quelle classe ?" name="shelf-level" options={['Tous', ...LEVELS]} bind:value={levelFilter} testId="shelf-levels" />
          <h3>{levelFilter === 'Tous' ? 'Autres parchemins' : `Classe ${levelFilter}`}</h3>
          {#if others.length > 0}
            <div class="cubbies">{#each others as t (t.id)}{@render cubby(t)}{/each}</div>
          {:else}
            <p class="muted">Aucun parchemin sur cette étagère.</p>
          {/if}
        </div>
      {/if}
    </section>
  {/if}
</div>
```

If Task 1 did not deliver `ART.ui.scrollRolled` (Ruling W3), render `<span class="roll-css"></span>` in place of the `<img>`.

Styles (replace all of the old ones):

```css
  .panel-shelves {
    display: flex;
    flex-direction: column;
    gap: 22px;
  }
  .panel-shelves h3 {
    margin: 0 0 10px;
  }
  /* The shelf unit: cubbies in rows on the dark board. */
  .cubbies {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
    gap: 18px 14px;
    padding: 10px;
    border-radius: 8px;
    background: linear-gradient(180deg, rgba(0, 0, 0, 0.18), rgba(0, 0, 0, 0.3));
    box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.35);
  }
  /* Alternate the tags' tilt so a row doesn't look printed. */
  .cubbies > :global(.kit-cubby:nth-child(3n + 2) .kit-tag) {
    --tag-tilt: 1deg;
  }
  .cubbies > :global(.kit-cubby:nth-child(3n) .kit-tag) {
    --tag-tilt: -0.4deg;
  }
  .others {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 14px;
  }
  .others > div {
    align-self: stretch;
  }
```

Keep the `levelIndex` / `LEVELS` / `isProphecy` imports. The `sortByLevelThenTitle` helper stays.

- [ ] **Step 3: Remove ShelvesPanel from `PENDING`, and run**

```bash
scripts/npm.sh run test -- src/placesKit.test.ts
scripts/npm.sh run check
scripts/playwright.sh scenes-library scenes-overlays scan grimoire profiles happy-path
```

Expected: PASS. Take a scratch iPad screenshot of the shelves (a new hero, and one with a defended text) and view it. Check:
- the scrolls lie in the cubbies;
- the seals sit on the scrolls;
- titles are Alegreya, 2 lines at most;
- no grade code or word count shows;
- the last row scrolls inside the board (between its edges, no cut card).

- [ ] **Step 4: Commit**

```bash
git add web/src/components/places/library/ShelvesPanel.svelte web/src/placesKit.test.ts web/e2e/scenes-library.spec.ts web/e2e/scan.spec.ts web/e2e/grimoire.spec.ts web/e2e/profiles.spec.ts web/e2e/scenes-overlays.spec.ts
git commit -m "Immersion wave: the shelves hold rolled scrolls in cubbies, sealed or broken with a laurel, tagged in the camp's words" -- web/src/components/places/library/ShelvesPanel.svelte web/src/placesKit.test.ts web/e2e/scenes-library.spec.ts web/e2e/scan.spec.ts web/e2e/grimoire.spec.ts web/e2e/profiles.spec.ts web/e2e/scenes-overlays.spec.ts
```

---

### Task 9: The scribe's desk and the bronze lens

**Findings:** #4 (desk and lens selects), #5, #6, #25. **Depends on:** Tasks 2, 3, 4, 5.

**Files:**
- Modify: `web/src/components/places/library/DeskPanel.svelte`, `web/src/components/places/library/LensPanel.svelte`, `web/src/screens/LibraryTent.svelte` (desk: `size="wide"`, `voice={VOICES.desk}`; lens: `voice={VOICES.lens}`)
- Delete: `web/src/components/LevelSelect.svelte` (`git rm`; no user remains after this task and Task 7)
- Modify: `web/src/placesKit.test.ts` (remove DeskPanel and LensPanel from `PENDING`)
- Modify: `web/e2e/scenes-library.spec.ts`, `web/e2e/happy-path.spec.ts`, `web/e2e/scan.spec.ts`, `web/e2e/helpers.ts` (`confirmScanVerified` only if a selector changed)

**Interfaces:**
- Consumes: `wordGauge` (Task 4), `LevelMedallions`, `kit-gauge`, `kit-link`, `kit-bronze(.is-quiet)`, `kit-note` (Task 3), `VOICES.desk`, `VOICES.lens` (Task 2), Wave A's `replacePanel`.
- Produces:
  - Desk: `desk-gauge` (test id); the submit « Poser sur l'étagère »; a « Qui l'a écrit ? » disclosure holding Auteur / Œuvre / Traducteur.
  - Lens: « Prendre une photo » / « Choisir une photo »; « Déchiffrer » (`btn-scan-read`, only once a photo exists); the details' submit « Poser sur l'étagère » (`btn-scan-save`); the date label « Le jour de l'épreuve ».

- [ ] **Step 1: Update the e2e first (failing)**

Desk test (`scenes-library.spec.ts:154`):

```ts
  const desk = page.getByTestId('overlay-desk');
  await expect(desk.getByRole('heading', { name: 'Le pupitre' })).toBeVisible();
  await expect(desk.getByTestId('overlay-voice')).toContainText('Entre 80 et 200 mots');
  await expect(desk.getByText('Entre quatre-vingts')).toHaveCount(0);
  const title = uniqueName(`Pupitre ${testInfo.project.name}`);
  await desk.getByLabel('Titre').fill(title);
  await desk.getByLabel('Texte').fill('Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.');
  await expect(desk.getByTestId('desk-gauge')).toContainText('13 mots · il en faut au moins 80');
  expect(await desk.getByLabel('Texte').evaluate((el) => getComputedStyle(el).fontFamily)).toContain('Literata');
  await expect(desk.getByRole('group', { name: 'Classe' })).toBeVisible();
  await expect(desk.locator('select')).toHaveCount(0);
  // Parity: author, work and translator are one tap away.
  await desk.getByText("Qui l'a écrit ?").click();
  for (const label of ['Auteur', 'Œuvre', 'Traducteur']) await expect(desk.getByLabel(label)).toBeVisible();
  // Playability #5: the way to finish is visible without scrolling on the iPad.
  const submit = desk.getByRole('button', { name: "Poser sur l'étagère" });
  if (testInfo.project.name === 'ipad') {
    const [s, body] = await Promise.all([submit.boundingBox(), desk.locator('.overlay-body').boundingBox()]);
    expect(s!.y + s!.height, 'submit visible without scrolling').toBeLessThanOrEqual(body!.y + body!.height);
  }
  await expectOverlayTapTargets(page, 'overlay-desk');
  expect(await redScan(page)).toEqual([]);
  await submit.click();
```

(The rest of the test, landing on the shelves and Back, is unchanged.) Also change `'Sauvegarder dans les Parchemins'` to `"Poser sur l'étagère"` in the I1 test (`:~190`). Change `happy-path.spec.ts:22` `/Sauvegarder/` to `{ name: "Poser sur l'étagère" }`.

Lens test (`:176`):

```ts
  const lens = page.getByTestId('overlay-lens');
  await expect(lens.getByRole('heading', { name: 'La lentille de bronze' })).toBeVisible();
  await expect(lens.getByTestId('overlay-voice')).toContainText('une photo par page');
  await expect(lens.getByText(/scanner/i)).toHaveCount(0);
  await expect(page.getByTestId('scan-input')).toBeAttached();
  // Playability #6: no grey disabled button before a photo exists.
  await expect(page.getByTestId('btn-scan-read')).toHaveCount(0);
  await expect(lens.getByText('Prendre une photo')).toBeVisible();
  await expect(lens.getByText('Choisir une photo')).toBeVisible();
  await page.getByTestId('scan-input').setInputFiles('/work/server/tests/fixtures/scan/handout.png');
  await expect(page.getByTestId('btn-scan-read')).toHaveText('Déchiffrer');
  await expect(lens.locator('.lens-frame img')).toBeVisible();
  await expectOverlayTapTargets(page, 'overlay-lens');
```

(Keep the wide-overlay width check and the close.) Delete the old `img.capture-icon` assertion, or point it at the lens frame's glass icon, which shows before a photo.

In `scan.spec.ts`: the details form now has `LevelMedallions` (no select; the spec never selected a level, so nothing to change there). The save still uses `btn-scan-save`. Check `confirmScanVerified` in `helpers.ts`: it clicks `btn-scan-verified` and `btn-scan-confirm` (unchanged ids) and `getByRole('button', { name: 'Pas encore' })` (unchanged).

Run: `scripts/playwright.sh scenes-library --project=ipad`
Expected: FAIL.

- [ ] **Step 2: The desk (`DeskPanel.svelte`)**

Keep the script, and use Wave A's `replacePanel` after the save. Replace `LevelSelect` with `LevelMedallions`, and add `import { wordGauge } from '../../../lib/library/shelf';` and `const gauge = $derived(wordGauge(wordCount));`. Markup:

```svelte
<div class="panel-desk">
  <form class="desk" onsubmit={submit}>
    <!-- Playability #5: two columns on the iPad - the text on the left, and the title, the class and
         the way to finish on the right, always in view. -->
    <div class="desk-text">
      <label for="body">Texte</label>
      <textarea id="body" rows="12" autocapitalize="sentences" spellcheck="true" bind:value={body} required {...{ autocorrect: 'off' }}></textarea>
      <div class="kit-gauge" data-state={gauge.state} data-testid="desk-gauge" style:--fill="{gauge.fill * 100}%">
        <span class="kit-gauge-track" aria-hidden="true"><span class="kit-gauge-band"></span><span class="kit-gauge-fill"></span></span>
        <span class="kit-gauge-label" aria-live="polite">{gauge.label}</span>
      </div>
    </div>

    <div class="desk-side">
      <div class="field">
        <label for="title">Titre</label>
        <input id="title" type="text" maxlength="120" bind:value={title} required />
      </div>

      <LevelMedallions legend="Classe" name="desk-level" bind:value={level} />

      <details class="who">
        <summary class="kit-link">Qui l'a écrit ?</summary>
        <div class="field"><label for="author">Auteur</label><input id="author" type="text" maxlength="120" bind:value={author} /></div>
        <div class="field"><label for="work">Œuvre</label><input id="work" type="text" maxlength="120" bind:value={work} /></div>
        <div class="field"><label for="translator">Traducteur</label><input id="translator" type="text" maxlength="120" bind:value={translator} /></div>
      </details>

      {#if error}
        <p class="orange" role="alert">{error}</p>
      {/if}

      <button type="submit" class="kit-bronze desk-submit" disabled={submitting || !title.trim() || !body.trim()}>Poser sur l'étagère</button>
    </div>
  </form>
</div>
```

Styles:

```css
  .desk {
    display: grid;
    grid-template-columns: 1fr;
    gap: 20px;
  }
  @media (min-width: 1000px) {
    .desk {
      grid-template-columns: minmax(0, 1.6fr) minmax(280px, 1fr);
      align-items: start;
    }
  }
  .desk-text,
  .desk-side {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  textarea {
    width: 100%;
    font-size: 18px;
    resize: vertical;
  }
  /* Playability #5: the title field is full width (it truncated at 240 px). */
  .field input[type='text'] {
    width: 100%;
    min-height: 48px;
  }
  .field {
    margin-bottom: 12px;
  }
  .who summary {
    list-style: none;
  }
  .who summary::-webkit-details-marker {
    display: none;
  }
  .desk-submit {
    align-self: flex-start;
  }
```

The rule line « Entre quatre-vingts et deux cents mots… » is gone: the owl says it (`VOICES.desk`).

- [ ] **Step 3: The lens (`LensPanel.svelte`)**

Keep all the script's logic, including the three steps, `showWord`, the confirmation and Wave A's `replacePanel` on save. Replace `LevelSelect` with `LevelMedallions`. The capture step:

```svelte
  {#if step === 'capture'}
    <div class="lens-capture">
      <!-- Playability #6: a round bronze lens frame; the owl gives the photo advice (VOICES.lens). -->
      <div class="lens-frame" aria-hidden="true">
        {#if photos.length > 0}
          <img src={photos[photos.length - 1].url} alt="" />
        {:else}
          <img class="lens-glass" src={ADD_ICONS.scan} alt="" />
        {/if}
      </div>
      <div class="capture-actions">
        <label class="kit-bronze capture-label">
          Prendre une photo
          <input type="file" accept="image/*" capture="environment" multiple data-testid="scan-input" class="file-input" onchange={onFilesChosen} />
        </label>
        <label class="kit-bronze is-quiet capture-label">
          Choisir une photo
          <input type="file" accept="image/*" multiple class="file-input" onchange={onFilesChosen} />
        </label>
      </div>

      {#if photos.length > 0}
        <div class="thumbs">
          {#each photos as p, i (p.url)}
            <div class="thumb">
              <img src={p.url} alt={`Photo ${i + 1}`} />
              <button type="button" class="kit-link" onclick={() => removePhoto(i)}>Retirer</button>
            </div>
          {/each}
        </div>
      {/if}

      {#if uploadError}
        <p class="kit-note" data-tone="eris" role="alert">{uploadError}</p>
        <button type="button" class="kit-bronze is-quiet" onclick={clearPhotos}>Reprendre les photos</button>
      {/if}

      {#if photos.length > 0}
        <button type="button" class="kit-bronze read-btn" data-testid="btn-scan-read" disabled={uploading} onclick={readText}>Déchiffrer</button>
      {/if}
      {#if uploading}
        <p class="muted" aria-live="polite">Les scribes déchiffrent la feuille…</p>
      {/if}
    </div>
```

The verify step:
- the heading becomes `<h3>Vérifie le texte avec la feuille</h3>`;
- the « À vérifier » chips become `<button class="check-word" …>` with the same logic, `aria-pressed` and the check `Icon`;
- `class="hint key-hint"` gets the new text « Corrige chaque mot qui n'est pas comme sur la feuille : ce texte servira de modèle pendant la bataille. »;
- the confirmation box becomes `class="kit-note confirm"` with « Pas encore » as `kit-bronze is-quiet` and « Oui, le texte est juste » as `kit-bronze` (test ids unchanged);
- « Reprendre une photo » is `kit-bronze is-quiet`, and « Le texte est juste » is `kit-bronze` (`btn-scan-verified`).

The details step:
- the heading becomes `<h3>Le parchemin</h3>`;
- « Titre » is unchanged;
- `<LevelMedallions legend="Classe" name="scan-level" bind:value={level} />`;
- the date field's label becomes « Le jour de l'épreuve », and its hint « Si ta classe prépare cette dictée, la Pythie en fera une prophétie. »;
- « Auteur » and « Œuvre » go behind `<details class="who"><summary class="kit-link">Qui l'a écrit ?</summary>…</details>`, like the desk;
- the save error is `kit-note` (tone eris);
- the submit is `kit-bronze` « Poser sur l'étagère » (`btn-scan-save`).

Styles to add or replace (keep `.file-input`, `.verify-grid`, `.photos`, `.photo`, `textarea`, `.actions`, `.field`; drop `.explain`, `.chip-warn`, `.chip-viewed`, `.confirm` legacy colours):

```css
  .lens-capture {
    display: grid;
    justify-items: center;
    gap: 16px;
  }
  /* The bronze lens: a round frame, the glass (or the last photo) inside. */
  .lens-frame {
    display: grid;
    place-items: center;
    width: 220px;
    height: 220px;
    border-radius: 50%;
    overflow: hidden;
    border: 10px solid var(--bronze);
    background: radial-gradient(circle at 35% 30%, rgba(210, 236, 240, 0.9), rgba(110, 160, 170, 0.75) 60%, rgba(40, 70, 80, 0.85));
    box-shadow:
      inset 0 0 0 3px var(--bronze-dark),
      inset 0 0 24px rgba(0, 0, 0, 0.35),
      0 0 0 3px var(--bronze-light),
      0 8px 16px rgba(0, 0, 0, 0.35);
  }
  .lens-frame img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .lens-frame .lens-glass {
    width: 55%;
    height: 55%;
    object-fit: contain;
    opacity: 0.9;
  }
  .capture-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 12px;
  }
  .capture-label {
    position: relative;
  }
  .read-btn {
    min-width: 240px;
  }
  .check-word {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 48px;
    padding: 0 14px;
    border: 2px solid var(--orange);
    border-radius: 6px;
    background: rgba(252, 232, 214, 0.9);
    color: var(--ink);
    font-family: var(--font-reading);
    font-size: 17px;
    font-weight: 600;
    cursor: pointer;
  }
  .check-word[aria-pressed='true'] {
    border-color: var(--olive);
    background: rgba(234, 238, 220, 0.95);
  }
```

- [ ] **Step 4: Retire `LevelSelect.svelte`**

Grep that nothing imports it any more: `grep -rn LevelSelect web/src` → only the file itself. Then `git rm web/src/components/LevelSelect.svelte`.

- [ ] **Step 5: Remove DeskPanel and LensPanel from `PENDING`, and run**

```bash
scripts/npm.sh run test -- src/placesKit.test.ts src/formPlural.test.ts
scripts/npm.sh run check
scripts/playwright.sh scenes-library scenes-overlays scan happy-path
```

Expected: PASS. Take scratch iPad screenshots of the desk (with 13 words, then 94 words) and of the lens (before and after a photo), and view them. The desk's submit must be visible without scrolling. The lens shows a round bronze frame and no disabled grey button.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/places/library/DeskPanel.svelte web/src/components/places/library/LensPanel.svelte web/src/screens/LibraryTent.svelte web/src/placesKit.test.ts web/e2e/scenes-library.spec.ts web/e2e/happy-path.spec.ts web/e2e/scan.spec.ts web/e2e/helpers.ts
git rm web/src/components/LevelSelect.svelte
git commit -m "Immersion wave: the desk in two columns with a quill gauge, the bronze lens deciphers; the owl gives the rules" -- web/src/components/places/library/DeskPanel.svelte web/src/components/places/library/LensPanel.svelte web/src/screens/LibraryTent.svelte web/src/placesKit.test.ts web/e2e/scenes-library.spec.ts web/e2e/happy-path.spec.ts web/e2e/scan.spec.ts web/e2e/helpers.ts web/src/components/LevelSelect.svelte
```

---

### Task 10: The portal: Alexandria as an open codex

**Findings:** #1 (codex), #7, #24, #25 (« Toutes les œuvres »). **Depends on:** Tasks 2, 3, 4, 5, and Wave A's M7, M9, M17.

**Files:**
- Modify: `web/src/components/places/library/PortalPanel.svelte`, `web/src/components/places/library/PortalWorkPanel.svelte`, `web/src/screens/LibraryTent.svelte` (both overlays `variant="codex"`; the portal gets `voice={VOICES.portal}`)
- Modify: `ASSETS-LICENSES.md` (the texts' public-domain note)
- Modify: `web/src/placesKit.test.ts` (remove PortalPanel and PortalWorkPanel from `PENDING`)
- Modify: `web/e2e/scenes-library.spec.ts`, `web/e2e/alexandria.spec.ts`, `web/e2e/scenes-overlays.spec.ts`

**Interfaces:**
- Consumes: the codex contract (Task 2), `workByline`, `lengthOf`, `plural` (Task 4), `LevelMedallions` (with `onchange`), `kit-medallion.is-small`, `kit-note`, `kit-bronze(.is-quiet)`, `Icon` `arrow-left` and `star`.
- Produces: unchanged test ids (`work-card`, `chunk-card`, `portal-back`, `btn-refresh-work`, `btn-adopt`, `btn-adopt-play`, `alexandria-error`), plus `work-levels` (the chunk filter) and `scribes-empty` (the empty state).

- [ ] **Step 1: Update the e2e first (failing)**

In `scenes-library.spec.ts`, the portal test (`:198`):

```ts
  const portal = page.getByTestId('overlay-portal');
  await expect(portal).toHaveAttribute('data-variant', 'codex');
  await expect(portal.getByRole('heading', { name: "Le portail d'Alexandrie" })).toBeVisible();
  await expect(portal.locator('.codex-page')).toHaveCount(2);
  // Playability #24: the byline never repeats the title; the level is a medallion.
  const perrault = portal.locator('[data-testid="work-card"]', { hasText: 'Contes de Perrault' });
  await expect(perrault.locator('.entry-by')).toHaveText('Charles Perrault');
  await expect(portal.getByText(/niveau \d/)).toHaveCount(0);
```

and, once in the work:

```ts
  const work = page.getByTestId('overlay-portal-work');
  await expect(work.getByTestId('btn-refresh-work')).toBeVisible();
  await expect(work).not.toContainText('domaine public');
  const back = work.getByTestId('portal-back');
  await expect(back).toContainText('Toutes les œuvres');
  expect((await back.boundingBox())!.height).toBeGreaterThanOrEqual(48);
  await expectOverlayTapTargets(page, 'overlay-portal-work');
```

(Replace the old `toContainText('Les traducteurs et auteurs sont dans le domaine public.')`.)

A never-copied work shows the scribes' empty state with no level filter. Add this to the same test, after the first open, **only if** the opened work's status is never (read `data-status` on the card; add `data-status={w.status}` to the entry in Step 2):

```ts
  if ((await portal.getByTestId('work-card').first().getAttribute('data-status')) === 'never') {
    await expect(work.getByTestId('scribes-empty')).toContainText("Les scribes n'ont encore rien recopié de ce livre. Demande-leur !");
    await expect(work.getByTestId('work-levels')).toHaveCount(0);
    await expect(work.getByTestId('btn-refresh-work')).toHaveText('Demander aux scribes');
  }
```

(The shared database may have copied that work already in another test. The branch keeps this robust under 8 workers, and `alexandria.spec.ts` covers the copied branch.)

In `alexandria.spec.ts`: the heading at `:42` is renamed in Task 5. At `:97`/`:104`, `'Rouleau ajouté aux Parchemins.'` becomes `'Le rouleau est sur tes étagères.'`. Check that `btn-adopt` and `btn-adopt-play` keep their ids (they do).

Run: `scripts/playwright.sh scenes-library --project=desktop`
Expected: FAIL.

- [ ] **Step 2: `PortalPanel.svelte` as two pages**

Keep the script, including `focusWorkId`, `load()` and `openWork` (through Wave A's `go`/`openPanel`). Change `statusLabel`:

```ts
  function statusLabel(w: AlexandriaWork): string {
    if (w.status === 'never') return 'Pas encore recopié';
    if (w.status === 'error') return "Hors d'atteinte";
    return plural(w.chunk_count, 'rouleau', 'rouleaux');
  }
```

Markup:

```svelte
<div class="codex-spread panel-portal">
  <section class="codex-page page-left">
    <!-- The view through the portal, as a plate in the book (Wave A M7: ART.scenes.alexandrie). -->
    <figure class="plate"><img src={ART.scenes.alexandrie} alt="" /></figure>
    <p class="page-note">Derrière le portail, les scribes d'Alexandrie recopient des livres anciens pour tes étagères.</p>
  </section>
  <section class="codex-page page-right">
    <h3>Les œuvres</h3>
    {#if loading}
      <p class="muted">Les Muses cherchent les scribes…</p>
    {:else if error}
      <p class="kit-note" data-tone="eris">Impossible de joindre la Bibliothèque : {error}</p>
    {:else}
      <ol class="contents">
        {#each works as w (w.id)}
          <li>
            <button type="button" class="entry" data-testid="work-card" data-work-id={w.id} data-status={w.status} onclick={() => openWork(w)}>
              <span class="entry-title">{w.title}</span>
              <span class="entry-by">{workByline(w)}</span>
              <span class="entry-meta">
                <span class="kit-medallion is-small" role="img" aria-label="Classe {w.level_hint}">{w.level_hint}</span>
                <span class="entry-status" class:is-away={w.status === 'error'}>{statusLabel(w)}</span>
              </span>
            </button>
          </li>
        {/each}
      </ol>
    {/if}
  </section>
</div>
```

If Wave A's M7 kept the banner as an inline `style` background, render it as this `<img>` in the plate instead: it is still `ART.scenes.alexandrie`, so the one art table stays the source.

Styles:

```css
  .plate {
    margin: 0 0 14px;
    border: 6px solid #e2cfa4;
    box-shadow:
      0 0 0 1px var(--parchment-edge),
      0 4px 10px rgba(92, 64, 24, 0.3);
  }
  .plate img {
    display: block;
    width: 100%;
    aspect-ratio: 4 / 3;
    object-fit: cover;
  }
  .page-note {
    font-style: italic;
    font-size: 17px;
    margin: 0;
  }
  .page-right h3 {
    margin: 0 0 8px;
  }
  .contents {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .contents li + li {
    border-top: 1px dashed rgba(138, 90, 40, 0.4);
  }
  /* A table-of-contents entry: title, who wrote it, the class medallion and the scribes' status. */
  .entry {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-areas: 'title meta' 'by meta';
    align-items: center;
    gap: 2px 12px;
    width: 100%;
    min-height: 64px;
    padding: 8px 6px;
    border: 0;
    background: none;
    color: var(--ink);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .entry:hover,
  .entry:focus-visible {
    background: rgba(200, 148, 80, 0.12);
  }
  .entry:focus-visible {
    outline: 3px solid var(--gold-light);
    outline-offset: 2px;
  }
  .entry-title {
    grid-area: title;
    font-family: var(--font-body);
    font-weight: 600;
    font-size: 19px;
  }
  .entry-by {
    grid-area: by;
    font-size: 14px;
    color: var(--form-ink-soft);
  }
  .entry-meta {
    grid-area: meta;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .entry-status {
    font-size: 14px;
    color: var(--form-ink-soft);
  }
  .entry-status.is-away {
    color: #9a4d12;
    font-weight: 600;
  }
```

- [ ] **Step 3: `PortalWorkPanel.svelte` as two pages**

Keep the script, including Wave A's generation token, `refresh`, `adopt`, `playNow`, `dismissConfirmation` and `starsFor`. Replace `selectLevel(l)` with the medallions' `onchange={(l) => selectLevel(l)}`. Add:

```ts
  // Playability #7: the filter filters something - hidden while there is nothing to filter.
  const showFilter = $derived(chunks.length > 0 || levelFilter !== 'Tous');
```

Markup:

```svelte
<div class="codex-spread panel-portal-work">
  <section class="codex-page page-left">
    <button type="button" class="kit-bronze is-quiet portal-back" data-testid="portal-back" onclick={() => closePanel(href('alexandria', { profileId: String(profile.id) }))}>
      <Icon name="arrow-left" size={18} /> Toutes les œuvres
    </button>
    {#if workLoading}
      <p class="muted">Les Muses cherchent les scribes…</p>
    {:else if workError}
      <p class="kit-note" data-tone="eris">{workError}</p>
    {:else if work}
      <h3 class="work-title">{work.title}</h3>
      <p class="work-by">{workByline(work)}</p>
      <button type="button" class="kit-bronze" data-testid="btn-refresh-work" disabled={refreshing} onclick={refresh}>
        {work.status === 'ok' ? 'Demander une nouvelle copie' : 'Demander aux scribes'}
      </button>
      {#if refreshing}
        <p class="muted" aria-live="polite">Les scribes recopient… (cela peut prendre une minute)</p>
      {/if}
      {#if refreshNote?.kind === 'error'}
        <p class="kit-note" data-tone="eris" data-testid="alexandria-error">{refreshNote.message}</p>
      {:else if refreshNote?.kind === 'olive'}
        <p class="kit-note">{refreshNote.message}</p>
      {/if}
    {/if}
  </section>

  <section class="codex-page page-right">
    {#if work}
      {#if showFilter}
        <LevelMedallions legend="Quelle classe ?" name="work-level" options={['Tous', ...LEVELS]} bind:value={levelFilter} onchange={(l) => selectLevel(l)} testId="work-levels" />
      {/if}
      {#if chunksLoading}
        <p class="muted">Les Muses déroulent les rouleaux…</p>
      {:else if chunksError}
        <p class="kit-note" data-tone="eris">Impossible de lire les rouleaux : {chunksError}</p>
      {:else if chunks.length === 0}
        {#if levelFilter !== 'Tous'}
          <p class="muted">Aucun rouleau pour cette classe.</p>
        {:else if work.status === 'ok'}
          <p class="muted">Les scribes n'ont trouvé aucun passage assez propre dans ce livre (dialogues, vers, vieux français…).</p>
        {:else}
          <!-- Playability #7: a next step, pointing at the button on the left page. -->
          <p class="scribes-empty" data-testid="scribes-empty">
            <Icon name="arrow-left" size={22} /> Les scribes n'ont encore rien recopié de ce livre. Demande-leur !
          </p>
        {/if}
      {:else}
        <ol class="rolls">
          {#each chunks as chunk (chunk.id)}
            <li class="roll-entry" data-testid="chunk-card">
              <div class="roll-head">
                <span class="seq">Rouleau {chunk.seq}</span>
                <span class="kit-medallion is-small" role="img" aria-label="Classe {chunk.level}">{chunk.level}</span>
                <span class="roll-length">{lengthOf(chunk.word_count)}</span>
                <span class="stars" role="img" aria-label="Richesse en accords : {starsFor(chunk.score)} sur 5">
                  {#each Array.from({ length: starsFor(chunk.score) }, (_, i) => i) as i (i)}<Icon name="star" size={16} />{/each}
                </span>
              </div>
              <p class="preview">{chunk.preview}</p>
              {#if confirmation && confirmation.chunkId === chunk.id}
                <div class="kit-note confirm">
                  <p>Le rouleau est sur tes étagères.</p>
                  <div class="confirm-actions">
                    <button type="button" class="kit-bronze" data-testid="btn-adopt-play" onclick={() => playNow(confirmation!.textId)}>Le défendre maintenant</button>
                    <button type="button" class="kit-bronze is-quiet" onclick={dismissConfirmation}>Continuer à fouiller</button>
                  </div>
                </div>
              {:else if chunk.text_id !== null}
                <div class="already">
                  <span class="muted">Déjà sur tes étagères</span>
                  <a class="kit-bronze is-quiet" href={href('play', { profileId: String(profile.id), textId: String(chunk.text_id) })}>Le défendre</a>
                </div>
              {:else}
                <button type="button" class="kit-bronze" data-testid="btn-adopt" disabled={adoptingId === chunk.id} onclick={() => adopt(chunk)}>Poser sur tes étagères</button>
                {#if adoptErrorChunkId === chunk.id}<p class="kit-note" data-tone="eris">{adoptError}</p>{/if}
              {/if}
            </li>
          {/each}
        </ol>
      {/if}
    {/if}
  </section>
</div>
```

Styles (replace the old ones):

```css
  .page-left {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  .work-title {
    margin: 6px 0 0;
    font-family: var(--font-body);
    font-weight: 700;
    font-size: 24px;
    letter-spacing: normal;
    text-transform: none;
    color: var(--ink);
  }
  .work-by {
    margin: 0;
    font-size: 16px;
    color: var(--form-ink-soft);
  }
  .scribes-empty {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 18px;
    font-style: italic;
  }
  .rolls {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .roll-entry {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 0;
    border-bottom: 1px dashed rgba(138, 90, 40, 0.4);
  }
  .roll-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }
  .seq {
    font-family: var(--font-display);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--bronze-dark);
  }
  .roll-length {
    font-style: italic;
    color: var(--form-ink-soft);
  }
  .stars {
    margin-left: auto;
    color: var(--reward-ink);
  }
  .preview {
    margin: 0;
    font-family: var(--font-reading);
    font-style: italic;
    font-size: 16px;
    line-height: 1.5;
  }
  .already,
  .confirm-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }
  .confirm p {
    margin: 0 0 8px;
    font-weight: 600;
  }
```

The work title is Alegreya (spec §2.7: a book's title is running text, not a caps label). Keep the Wave A M1 `<h3>` level.

- [ ] **Step 4: The codex in `LibraryTent.svelte`, and the credits**

- Both the `portail` and the `oeuvre` overlays become `variant="codex"` (no `size`: the codex is wide). The portal also gets `voice={VOICES.portal}`.
- Delete PortalPanel's old subtitle paragraph (the owl says it).

In `ASSETS-LICENSES.md`, add a section:

```markdown
## Texts from the Bibliothèque d'Alexandrie

The works offered behind the library tent's portal (`server/app/alexandria`, the allowlist) are in
the public domain: their authors and translators died more than seventy years ago. Each work and
each adopted text keeps its author and translator on screen (for example « Lewis Carroll, trad.
Henri Bué »). The original texts come from Wikisource and Project Gutenberg (each work's `source` field in the
allowlist says which).
```

(`server/app/alexandria/allowlist.py` accepts the sources `wikisource` and `gutenberg`. Check the allowlist file itself and name its path in the note.)

- [ ] **Step 5: Remove both panels from `PENDING`, and run**

```bash
scripts/npm.sh run test -- src/placesKit.test.ts src/formPlural.test.ts
scripts/npm.sh run check
scripts/playwright.sh scenes-library alexandria scenes-overlays
```

Expected: PASS. `alexandria.spec.ts` runs its claim loop at any worker count (UI3a Task 2); keep it intact. Take a scratch iPad screenshot of the portal and of a work (never copied, and copied) and view them. Check:
- the book reads as a book: two pages and a gutter;
- nothing crosses the gutter;
- the back button is a bronze button with an arrow.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/places/library/PortalPanel.svelte web/src/components/places/library/PortalWorkPanel.svelte web/src/screens/LibraryTent.svelte ASSETS-LICENSES.md web/src/placesKit.test.ts web/e2e/scenes-library.spec.ts web/e2e/alexandria.spec.ts web/e2e/scenes-overlays.spec.ts
git commit -m "Immersion wave: Alexandria as an open codex, a next step when the scribes have nothing yet, credits in ASSETS-LICENSES" -- web/src/components/places/library/PortalPanel.svelte web/src/components/places/library/PortalWorkPanel.svelte web/src/screens/LibraryTent.svelte ASSETS-LICENSES.md web/src/placesKit.test.ts web/e2e/scenes-library.spec.ts web/e2e/alexandria.spec.ts web/e2e/scenes-overlays.spec.ts
```

---

### Task 11: The Pythia: three real scrolls, one unrolls across the panel; the altar card grows up

**Findings:** #1 (Pythia), #8 (Pythia), #9, #17, #18, #19. **Depends on:** Tasks 1 (scroll art; else `.roll-css`), 2, 3, 4, 5.

**Files:**
- Move: `web/src/components/Scroll.svelte` → `web/src/components/places/delphi/OracleScroll.svelte` (`git mv`, then rewrite)
- Modify: `web/src/components/places/delphi/PythiaPanel.svelte`, `web/src/screens/Delphi.svelte` (`voice={VOICES.pythia}`; the altar card's size)
- Modify: ProphecyCard (wherever Wave A's M3 left it: `components/places/ProphecyCard.svelte` or `components/world/ProphecyCard.svelte`), `web/src/screens/Camp.svelte` (only if its prophecy column needs room for the bigger card)
- Modify: `web/src/placesKit.test.ts` (remove PythiaPanel and Scroll from `PENDING`; drop `Scroll.svelte` from `SHARED`)
- Modify: `web/e2e/scenes-delphi.spec.ts`, `web/e2e/world.spec.ts`, `web/e2e/scenes-camp.spec.ts`

**Interfaces:**
- Consumes: `kit-roll.is-upright`, `kit-seal`, `kit-sheet`, `kit-bronze`, `Medallion`, `LieutenantBadge`, `longDate` (Task 4), `ART.ui.scrollRolled`, `MARK_ICONS.oracleSeal`, `VOICES.pythia`.
- Produces:
  - `OracleScroll` props `{ title, hint, mode: 'rolled' | 'unrolled' | 'closed', busy?, onOpen?, testid, children? }` (presentational; the sounds move to PythiaPanel).
  - Test ids unchanged: `scroll-<key>`, `scroll-open`, `oracle-reward`, `oracle-monster-<key>`, `oracle-cancel`, `oracle-confirm`, `oracle-quest`, `oracle-prophecy-<id>`.
  - The prophecy button « Te préparer » everywhere.

- [ ] **Step 1: Update the e2e first (failing)**

In `scenes-delphi.spec.ts`, the Pythia test (`:45`):

```ts
  const oracle = page.getByTestId('overlay-pythia');
  await expect(oracle.getByRole('heading', { name: 'La Pythie' })).toBeVisible();
  await expect(oracle.getByTestId('overlay-voice')).toHaveAttribute('data-speaker', 'pythia');
  await expect(oracle.getByTestId('scroll-open')).toHaveCount(3);
  // Playability #8: the reward is said once, in the header, in dark bronze - not on each scroll.
  await expect(oracle.getByText(/Récompense de la semaine/)).toHaveCount(0);
  await expect(oracle.getByTestId('oracle-reward')).toContainText('150 XP');
  await expect(oracle.getByTestId('oracle-reward')).toHaveCSS('color', 'rgb(138, 90, 28)');
  await expect(oracle.getByTestId('scroll-ecole')).toContainText('Ce que prépare ta classe');
  await expect(oracle.getByTestId('scroll-ecole')).not.toContainText("Ce qui arrive à l'école");
  // Playability #9: the school scroll unrolls across the whole panel; every monster and « Annuler » in view.
  await oracle.getByTestId('scroll-ecole').getByTestId('scroll-open').click();
  const sheet = oracle.getByTestId('scroll-ecole');
  await expect(oracle.getByTestId('scroll-faible')).toHaveCount(0);
  const [sheetBox, bodyBox] = await Promise.all([sheet.boundingBox(), oracle.locator('.overlay-body').boundingBox()]);
  expect(sheetBox!.width, 'the unrolled scroll spans the panel').toBeGreaterThan(bodyBox!.width * 0.85);
  for (const key of ['hydre', 'echo', 'chimere', 'protee', 'sirenes', 'lethe']) {
    const m = oracle.getByTestId(`oracle-monster-${key}`);
    await expect(m).toBeInViewport();
    expect(Math.min(...Object.values((await m.boundingBox())!).slice(2))).toBeGreaterThanOrEqual(56);
  }
  await expect(oracle.getByTestId('oracle-cancel')).toBeInViewport();
  await expectOverlayTapTargets(page, 'overlay-pythia');
  await oracle.getByTestId('oracle-cancel').click();
  await expect(oracle.getByTestId('scroll-open')).toHaveCount(3);
```

(`Object.values(box).slice(2)` gives `[width, height]`. Write it as `Math.min(box.width, box.height)` if clearer.) Then keep the rest (Escape, Back, the deep link).

Add a test for the prophecy rows. Use `onlyOwnProphecy` so parallel workers' prophecies don't interfere:

```ts
test('the Pythia speaks of a prophecy by its day, not its date; « Te préparer » opens the dictation', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const text = await createText(request, { title: uniqueName('La dictée du jeudi'), body: BODY, level: '10H', due_date: '2099-01-01' });
  await onlyOwnProphecy(page, text.id);
  await page.goto(`/#/p/${id}/delphes`);
  const row = page.getByTestId(`oracle-prophecy-${text.id}`);
  await expect(row).toContainText('jeudi 1er janvier 2099');
  await expect(row).not.toContainText('01.01.2099');
  await expect(page.getByTestId('overlay-pythia')).not.toContainText('multipliée');
  const btn = row.getByRole('button', { name: 'Te préparer' });
  await expect(btn).toHaveCSS('text-decoration-line', 'none');
  await btn.click();
  await expect(page).toHaveURL(new RegExp(`/play/${text.id}$`));
});
```

`onlyOwnProphecy` filters the `/camp` response. The Oracle's prophecies come from `/api/profiles/:id/oracle` (`worldApi.oracle`), so add a sibling helper `onlyOwnOracleProphecy(page, textId)` in `helpers.ts` that filters `oracle.prophecies` the same way, and use it here.

The altar test (`:93`): its final `'Réviser'` becomes `'Te préparer'`, and after the three-size loop add `expect(b.card.width).toBeGreaterThanOrEqual(Math.min(380, b.art.width * 0.26) - 1)`. The three sizes stay the gate for fitting between the places, the dock and the safe zone.

`scenes-camp.spec.ts:526–560`: `'Réviser'` becomes `'Te préparer'` (the name and the assertion messages).

`world.spec.ts:91`: the swatch now lives in the header: `await expect(page.getByTestId('oracle-reward').locator('[data-reward="tint:ecume"] .swatch')).toBeVisible();`.

Run: `scripts/playwright.sh scenes-delphi --project=ipad`
Expected: FAIL.

- [ ] **Step 2: `git mv` the scroll and rewrite it as `OracleScroll`**

```bash
git mv web/src/components/Scroll.svelte web/src/components/places/delphi/OracleScroll.svelte
```

The seal-break sound and the sparkle move out to PythiaPanel. An unrolled scroll is a new instance, so the "sealed flips to false" effect can no longer see the transition. `OracleScroll` becomes purely presentational:

```svelte
<script lang="ts">
  // One of the Pythia's three scrolls (spec §3 Delphi, playability #9): rolled and sealed on its
  // stand, unrolled across the whole panel once opened (or while its monster is being chosen), or
  // closed until Monday. Presentational: PythiaPanel owns the state, the sounds and the sparkles.
  import type { Snippet } from 'svelte';
  import { ART, MARK_ICONS } from '../../../lib/world/art';

  let {
    title,
    hint,
    mode,
    busy = false,
    onOpen,
    testid,
    children,
  }: {
    title: string;
    hint: string;
    mode: 'rolled' | 'unrolled' | 'closed';
    busy?: boolean;
    onOpen?: () => void;
    testid: string;
    children?: Snippet;
  } = $props();
</script>

{#if mode === 'unrolled'}
  <div class="kit-sheet oracle-sheet" data-testid={testid}>
    <h4 class="scroll-title">{title}</h4>
    {@render children?.()}
  </div>
{:else}
  <div class="oracle-roll" class:is-closed={mode === 'closed'} data-testid={testid}>
    <span class="kit-roll is-upright" aria-hidden="true">
      <img class="roll-art" src={ART.ui.scrollRolled} alt="" draggable="false" />
      <span class="kit-seal" class:is-broken={mode === 'closed'}><img src={MARK_ICONS.oracleSeal} alt="" /></span>
    </span>
    <h4 class="scroll-title">{title}</h4>
    {#if mode === 'rolled'}
      <p class="hint">{hint}</p>
      <button type="button" class="kit-bronze" data-testid="scroll-open" disabled={busy} onclick={onOpen}>
        {busy ? "L'Oracle déroule le rouleau…" : 'Briser le sceau'}
      </button>
    {:else}
      {@render children?.()}
    {/if}
  </div>
{/if}

<style>
  .oracle-roll {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    text-align: center;
  }
  .oracle-roll.is-closed {
    opacity: 0.75;
  }
  .oracle-roll.is-closed :global(.kit-roll) {
    height: 120px;
    transform: scale(0.7);
  }
  .scroll-title {
    margin: 0;
    font-family: var(--font-display);
    font-size: 16px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--bronze-dark);
  }
  .hint {
    margin: 0;
    font-size: 16px;
  }
  .oracle-sheet .scroll-title {
    text-align: center;
    margin-bottom: 12px;
  }
</style>
```

(Use `.roll-css` instead of the `<img>` under Ruling W3's fallback.)

- [ ] **Step 3: `PythiaPanel.svelte`**

Script changes:
- import `OracleScroll` from `./OracleScroll.svelte` (not `../../Scroll.svelte`) and `longDate`;
- drop `formatSwissDate`;
- add `import { tick } from 'svelte';` and `import { reducedMotion } from '../../../lib/juice/motion';`;
- keep `load`, `consult`, `confirmEcole`, `cancelEcole`, `isAvailable`, `nameFor`, `names`, `chosenKey`, `revealedFor`, `oracleRewardLine`.

Then:

```ts
  const reduced = reducedMotion();
  let pickerEl = $state<HTMLElement | null>(null);

  // The scroll that lies unrolled across the panel: the school scroll while its monster is being
  // chosen, the chosen one once the week's choice is made. The row of three rolls is not drawn then.
  const unrolled = $derived<ScrollKey | null>(ecolePickerOpen ? 'ecole' : oracle?.status === 'chosen' ? chosenKey : null);

  function openScroll(key: ScrollKey) {
    unlockAudio();
    playSfx('tap');
    if (key === 'ecole') {
      ecolePickerOpen = true;
      // Playability #9: the choice she has to make is in view, whatever the panel's scroll.
      void tick().then(() => pickerEl?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' }));
      return;
    }
    void consult(key);
  }
```

In `consult`, on success, play what `Scroll.svelte`'s effect used to play, before `playSfx('chime')`: `playSfx('seal'); setTimeout(() => playSfx('unroll'), 130);`. The `burstTrigger` Particles stay.

Markup of the scrolls section (the prophecies section changes too, below):

```svelte
    <section>
      <h3>Les trois rouleaux</h3>
      <!-- Playability #8: the reward once, with its medallion, in dark bronze. -->
      <p class="reward-line" data-testid="oracle-reward">
        {#if oracle.reward_id}<Medallion rewardId={oracle.reward_id} kind={rewardKindOf(oracle.reward_id, campStore.catalog)} size={36} />{/if}
        <span>Cette semaine, le rouleau que tu ouvres rapporte : {oracleRewardLine()}</span>
      </p>
      {#if consultError}<p class="kit-note" data-tone="eris" role="alert">{consultError}</p>{/if}

      <div class="scrolls-wrap">
        {#if unrolled}
          {@const s = oracle.scrolls.find((sc) => sc.key === unrolled)!}
          <OracleScroll testid="scroll-{s.key}" title={scrollTitle(s.key, s.title)} hint={s.hint} mode="unrolled">
            {#if ecolePickerOpen}
              <div class="picker" bind:this={pickerEl}>
                <p class="picker-ask">Quel monstre ta classe prépare-t-elle ?</p>
                <div class="picker-grid">
                  {#each LIEUTENANT_ORDER as key (key)}
                    <button
                      type="button"
                      class="monster"
                      class:is-picked={selectedMonster === key}
                      aria-pressed={selectedMonster === key}
                      data-testid="oracle-monster-{key}"
                      disabled={!isAvailable(key)}
                      onclick={() => (selectedMonster = key)}
                    >
                      <LieutenantBadge lieutenantKey={key} size={64} />
                      <span class="monster-name">{nameFor(key)}</span>
                      {#if !isAvailable(key)}<span class="monster-note">dort encore</span>{/if}
                    </button>
                  {/each}
                </div>
                <div class="picker-actions">
                  <button type="button" class="kit-bronze is-quiet" data-testid="oracle-cancel" onclick={cancelEcole}>Annuler</button>
                  <button type="button" class="kit-bronze" data-testid="oracle-confirm" disabled={!selectedMonster || consultingScroll === 'ecole'} onclick={confirmEcole}>
                    {selectedMonster ? confirmChoiceLabel(selectedMonster as LieutenantKey) : "C'est celui-là"}
                  </button>
                </div>
              </div>
            {:else if revealedFor(s.key)}
              {@const r = revealedFor(s.key)!}
              <div class="revealed">
                <img src={r.art} alt={r.name} class="revealed-art pop" />
                <p class="revealed-name pop">{r.name}</p>
              </div>
            {/if}
          </OracleScroll>
          {#if oracle.status === 'chosen'}
            <div class="closed-rolls">
              {#each oracle.scrolls.filter((sc) => sc.key !== unrolled) as c (c.key)}
                <OracleScroll testid="scroll-{c.key}" title={scrollTitle(c.key, c.title)} hint={c.hint} mode="closed">
                  <p class="muted closed-note">Refermé jusqu'à lundi.</p>
                </OracleScroll>
              {/each}
            </div>
          {/if}
        {:else}
          <div class="rolls">
            {#each oracle.scrolls as s (s.key)}
              <OracleScroll
                testid="scroll-{s.key}"
                title={scrollTitle(s.key, s.title)}
                hint={s.hint}
                mode={globallySealed ? 'rolled' : 'closed'}
                busy={consultingScroll === s.key}
                onOpen={() => openScroll(s.key)}
              />
            {/each}
          </div>
        {/if}
        {#if burstTrigger > 0}<Particles trigger={burstTrigger} kind="burst" />{/if}
      </div>
    </section>
```

Check the case the old `quiet` flag covered: a week that is not sealed and has no chosen key yet. Read `OracleOut`'s statuses. If a third status exists, map it to `closed` for all three, which is what the old code showed.

The prophecies section:

```svelte
      <section>
        <h3>Prophéties</h3>
        <p class="muted">Défends chaque prophétie avant son jour : la Pythie te promet une fois et demie plus de gloire (+50 % XP).</p>
        <ul class="prophecy-list">
          {#each oracle.prophecies as p (p.text_id)}
            <li class="kit-sheet prophecy-row" data-testid="oracle-prophecy-{p.text_id}">
              <p><span class="prophecy-title">« {p.title} »</span> <span class="prophecy-when">{longDate(p.due_date)} · {prophecyWhen(p.days_left)}</span></p>
              <button type="button" class="kit-bronze" onclick={() => review(p.text_id)}>Te préparer</button>
            </li>
          {/each}
        </ul>
      </section>
```

with `function review(textId: number) { /* Wave A M5's go() helper, or unlockAudio(); playSfx('tap'); navigate(...) */ }` going to `href('play', { profileId, textId: String(textId) })`. A `<button>`, not the legacy `<a class="btn">` (playability #18).

The quest-of-the-week section: `<h3>La quête de la semaine</h3>`, the `QuestCard`, and « L'Oracle parlera de nouveau lundi. ». Unchanged apart from the heading level Wave A already set.

Styles (replace the old ones; the picker is the important part):

```css
  .oracle {
    display: flex;
    flex-direction: column;
    gap: 22px;
  }
  .reward-line {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 0 12px;
    font-weight: 600;
    font-size: 17px;
    color: var(--reward-ink);
  }
  .rolls {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 18px;
  }
  .scrolls-wrap {
    position: relative;
  }
  .picker {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
  }
  .picker-ask {
    margin: 0;
    font-size: 18px;
    font-style: italic;
  }
  /* Playability #9: a 3x2 grid of monster medallions (>= 56 px), names under them. */
  .picker-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(120px, 1fr));
    gap: 12px;
    width: 100%;
  }
  .monster {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    min-height: 120px;
    padding: 10px 6px;
    border: 2px solid transparent;
    border-radius: 12px;
    background: rgba(255, 250, 238, 0.55);
    color: var(--ink);
    font: inherit;
    cursor: pointer;
  }
  .monster.is-picked {
    border-color: var(--gold-light);
    box-shadow:
      0 0 0 2px var(--bronze),
      0 0 14px rgba(255, 220, 140, 0.7);
  }
  .monster:disabled {
    opacity: 0.55;
    cursor: default;
  }
  .monster:focus-visible {
    outline: 3px solid var(--gold-light);
    outline-offset: 2px;
  }
  .monster-name {
    font-weight: 700;
    font-size: 17px;
  }
  .monster-note {
    font-size: 14px;
    font-style: italic;
  }
  .picker-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 12px;
  }
  .closed-rolls {
    display: flex;
    justify-content: center;
    gap: 40px;
    margin-top: 10px;
  }
  .revealed {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  .revealed-art {
    max-height: 200px;
    object-fit: contain;
  }
  .revealed-name {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 20px;
  }
  .pop {
    animation: pop 0.4s both;
  }
  .prophecy-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .prophecy-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .prophecy-row p {
    margin: 0;
  }
  .prophecy-title {
    font-weight: 700;
  }
  @media (orientation: portrait) {
    .rolls {
      grid-template-columns: 1fr;
    }
  }
```

(The hatch is gone: the monsters are medallion buttons, not `.chip`s. `.picker-grid :global(.chip)` is deleted with them.)

- [ ] **Step 4: ProphecyCard and the altar (playability #17)**

In ProphecyCard: the button becomes `Te préparer`, and the CSS changes:

```css
  .prophecy-card-when {
    font-style: italic;
    font-size: 15px;
    line-height: 1.3;
  }
  .prophecy-card-title {
    font-weight: 600;
    font-size: 17px;
    line-height: 1.25;
    /* keep the 2-line clamp */
  }
  .prophecy-card .kit-bronze {
    flex-shrink: 0;
    padding: 8px 14px;
    font-size: 15px;
  }
```

In `Delphi.svelte`: `.altar-prophecy { left: 53%; top: 64%; width: min(380px, 26%); min-width: 260px; }`. These are targets. The three-size altar test in `scenes-delphi.spec.ts` (1280×720, 1180×820 and 900×900: clear of both places and their plaques, above the dock, inside the safe zone) decides. At 900×900, if the card cannot fit beside its button, let it wrap: `flex-wrap: wrap` on the card, the button under the text. Move `top` only as far as the tablets' new bottom edge (y 59, Task 5) allows. Measure; don't guess. Update the comment in `Delphi.svelte` with the final numbers. Check the camp's prophecy column (`scenes-camp.spec.ts` "a long prophecy title never pushes « Te préparer » out of view") at the same time.

In `Delphi.svelte` also: `<Overlay … testId="overlay-pythia" voice={VOICES.pythia}>`.

- [ ] **Step 5: Update the guard, and run**

In `placesKit.test.ts`: remove `PythiaPanel.svelte` and `Scroll.svelte` from `PENDING`, and remove `Scroll.svelte` from `SHARED` (it now lives under `places/`, so the walk covers it).

```bash
scripts/npm.sh run test -- src/placesKit.test.ts src/formPlural.test.ts
scripts/npm.sh run check
scripts/playwright.sh scenes-delphi scenes-camp world scenes-overlays
```

Expected: PASS. Take scratch iPad screenshots and view them:
- the three sealed rolls;
- the unrolled school scroll with its 3×2 medallions and « Annuler » in view;
- the chosen week, with the monster and two closed rolls;
- the altar card.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/places/delphi/OracleScroll.svelte web/src/components/places/delphi/PythiaPanel.svelte web/src/screens/Delphi.svelte web/src/screens/Camp.svelte web/src/placesKit.test.ts web/e2e/scenes-delphi.spec.ts web/e2e/world.spec.ts web/e2e/scenes-camp.spec.ts web/e2e/helpers.ts <ProphecyCard path>
git commit -m "Immersion wave: the Pythia's three scrolls roll and unroll across the panel; reward said once; prophecies by their day; « Te préparer »" -- web/src/components/Scroll.svelte web/src/components/places/delphi/OracleScroll.svelte web/src/components/places/delphi/PythiaPanel.svelte web/src/screens/Delphi.svelte web/src/screens/Camp.svelte web/src/placesKit.test.ts web/e2e/scenes-delphi.spec.ts web/e2e/world.spec.ts web/e2e/scenes-camp.spec.ts web/e2e/helpers.ts <ProphecyCard path>
```

---

### Task 12: The quest wall: terracotta tablets on cords, one name, one treasure line

**Findings:** #1 (tablets), #8 (tablets reward), #10, #25 (tablets). **Depends on:** Tasks 2, 3, 4, 5.

**Files:**
- Modify: `web/src/components/places/delphi/TabletsPanel.svelte`, `web/src/components/QuestCard.svelte`
- Modify: `server/app/world/catalog.py` (the reward `source` wording, Ruling W13) and any `server/tests` pinning those strings
- Modify: `web/src/placesKit.test.ts` (remove TabletsPanel and QuestCard from `PENDING`)
- Modify: `web/e2e/scenes-delphi.spec.ts`, `web/e2e/world.spec.ts` (only if a selector changes), `web/e2e/scenes-overlays.spec.ts`

**Interfaces:**
- Consumes: `kit-tablet`, `kit-tablet-stamp`, `kit-tablet-ribbon`, `kit-parchment`, `kit-note`, `kit-bronze(.is-quiet)`, `kit-link`, `plural`, `--reward-ink`, `LieutenantBadge`, `Medallion`.
- Produces: unchanged test ids (`board-challenge-<key>`, `board-boss`, `quest-card-<id>`, `quest-play-<id>-<textId>`, `quest-shelve-<id>`), plus `board-reward` (the one reward line) and `board-decor` (the one treasure line). The QuestCard kind labels are « Mur », « Oracle » and « Éris ».

- [ ] **Step 1: Update the e2e first (failing)**

In the tablets test in `scenes-delphi.spec.ts` (`:77`):

```ts
  const board = page.getByTestId('overlay-tablets');
  await expect(board.getByRole('heading', { name: 'Le mur des quêtes' })).toBeVisible();
  // Playability #10: the reward and the treasure line are said once, never on each tablet.
  await expect(board.getByTestId('board-reward')).toHaveCount(1);
  await expect(board.getByText(/Récompense : \d+ XP/)).toHaveCount(0);
  await expect(board.getByTestId('board-decor')).toHaveCount(1);
  await expect(board.getByTestId('board-decor')).toContainText(/Encore \d+ quêtes? avant le prochain trésor de ta cabane/);
  await expect(board.locator('.kit-tablet')).toHaveCount(6);
  await expect(board.getByText(/\((s|x)\)/)).toHaveCount(0);
  await expect(board.getByTestId('board-boss')).toBeVisible();
  await board.getByTestId('board-challenge-echo').getByRole('button', { name: 'Lancer une quête' }).click();
  await expect(board.getByTestId('board-challenge-echo')).toContainText('Quête en cours');
  await expect(board.getByTestId('board-challenge-echo').getByRole('button', { name: 'Lancer une quête' })).toHaveCount(0);
  await expectOverlayTapTargets(page, 'overlay-tablets');
  await closeOverlay(page);
  await expect(page.getByTestId('delphi-tablets-badge')).toHaveText('1');
```

(`board-decor` shows while a decor remains to earn. A new hero has four ahead, so it is always there in this test.)

`world.spec.ts:122–130` launches echo, chimère, then protée, and expects « Deux quêtes à la fois ». The buttons of the non-active tablets stay, so this passes unchanged. Check it.

Run: `scripts/playwright.sh scenes-delphi --project=desktop`
Expected: FAIL.

- [ ] **Step 2: `TabletsPanel.svelte`**

The script is unchanged, apart from the `plural` import (Task 4) and moving `nextDecor()` out of the loop: `const decor = $derived(nextDecor());`. Markup:

```svelte
<div class="panel-tablets board">
  <p class="wall-reward" data-testid="board-reward">Chaque quête du mur rapporte {boardXp} XP et une page du bestiaire.</p>

  <section>
    <h3>En cours</h3>
    {#if activeQuests.length === 0}
      <p class="muted">Aucune quête en cours. Défie un monstre sur le mur, ou va voir la Pythie.</p>
    {:else if campStore.catalog}
      <div class="pinned">
        {#each activeQuests as q (q.id)}
          <QuestCard quest={q} {names} catalog={campStore.catalog} profileId={profile.id} {onShelve} />
        {/each}
      </div>
    {/if}
    {#if decor}
      <p class="decor-line" data-testid="board-decor">Encore {plural(decor.n, 'quête', 'quêtes')} avant le prochain trésor de ta cabane : {decor.name}.</p>
    {/if}
  </section>

  <section>
    <h3>Défier un monstre</h3>
    {#if createError}<p class="kit-note" data-tone="eris" role="alert">{createError}</p>{/if}
    <ul class="wall">
      {#each LIEUTENANT_ORDER as key (key)}
        {@const l = lieutenantState(key)}
        {@const asleep = !l || !l.available}
        <li class="kit-tablet" class:is-asleep={asleep} data-testid="board-challenge-{key}">
          <span class="pressed"><LieutenantBadge lieutenantKey={key} size={64} /></span>
          <h4 class="tablet-name">{names[key] ?? key}</h4>
          <p class="tablet-technique">{technique(key)}</p>
          {#if asleep}
            <p class="tablet-note">Dort encore à ce niveau.</p>
          {:else}
            {#if l.neutralised}<span class="kit-tablet-stamp">{agree('Neutralisé', key)}</span>{/if}
            {#if l.active_quest_id}
              <span class="kit-tablet-ribbon">Quête en cours</span>
            {:else}
              <button type="button" class="kit-bronze" disabled={creating === key} onclick={() => challenge(key)}>Lancer une quête</button>
            {/if}
          {/if}
        </li>
      {/each}
    </ul>
  </section>

  {#if campStore.data}
    <section>
      <h3>Éris</h3>
      <div class="kit-sheet eris-panel" data-testid="board-boss">
        <!-- the three branches unchanged, with kit-bronze « Se rendre au bord du camp » and the plural()
             line from Task 4: « Éris se cache. Neutralise encore N ruses pour la faire sortir. » -->
      </div>
    </section>
  {/if}

  <section>
    <details class="done">
      <summary class="kit-bronze is-quiet">Quêtes terminées</summary>
      <!-- unchanged list / « Aucune quête terminée pour l'instant. » -->
    </details>
  </section>

  {#if questsError}<p class="kit-note" data-tone="eris">{questsError}</p>{/if}
  {#if loadingQuests && allQuests.length === 0}<p class="muted">Les Muses relisent le mur…</p>{/if}
</div>
```

Styles (replace the old ones):

```css
  .board {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  .board h3 {
    margin: 0 0 10px;
  }
  .wall-reward {
    margin: 0;
    font-size: 17px;
    font-weight: 600;
    color: var(--gold-light);
  }
  .decor-line {
    margin: 12px 0 0;
    font-style: italic;
  }
  .pinned {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  /* The wall: a bronze peg rail, six tablets hung from it by their cords. */
  .wall {
    list-style: none;
    margin: 0;
    padding: 6px 0 0;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px 22px;
    background: linear-gradient(180deg, rgba(200, 148, 80, 0.55), rgba(90, 58, 24, 0.55)) top / 100% 6px no-repeat;
  }
  .tablet-name {
    margin: 0;
    font-family: var(--font-display);
    font-size: 17px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink);
    text-shadow: none;
  }
  .tablet-technique,
  .tablet-note {
    margin: 0;
    font-size: 15px;
    line-height: 1.35;
  }
  .tablet-note {
    font-style: italic;
  }
  .eris-panel {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .eris-panel p {
    margin: 0;
  }
  .done summary {
    list-style: none;
  }
  .done summary::-webkit-details-marker {
    display: none;
  }
  @media (max-width: 900px) {
    .wall {
      grid-template-columns: repeat(2, 1fr);
    }
  }
```

The tablet's h4 sits on clay, so give `.tablet-name` its own ink: the table overlay's `:global(:is(h3, h4))` would otherwise make it gold. The rule above sets `color: var(--ink)`. It needs to win on specificity: write it as `.wall .tablet-name` if it doesn't. The e2e contrast is covered by `redScan` and the reviewer's eye; the token contrast `INK` on `--clay` is tested in Task 2.

- [ ] **Step 3: `QuestCard.svelte`**

- The root `class="parchment quest-card"` becomes `class="kit-sheet quest-card"` (a sheet pinned to the board).
- The kind chip becomes `<span class="quest-kind">{kindLabel}</span>` with `kindLabel = quest.kind === 'board' ? 'Mur' : quest.kind === 'oracle' ? 'Oracle' : 'Éris'`.
- The « Terminée le » chip becomes `<p class="quest-done">Terminée le {longDate(quest.completed_at.slice(0, 10))}</p>`.
- The text links `class="btn text-btn"` become `class="kit-bronze is-quiet text-btn"`.
- The confirm buttons: « Oui » is `kit-bronze`, « Non » is `kit-bronze is-quiet`.
- « Ranger » becomes `class="kit-link shelve"`.
- The shelve error becomes `kit-note` (tone eris).
- The reward line colour becomes `var(--reward-ink)` (playability #8; UI1 #13).

CSS for the new pieces:

```css
  .quest-kind {
    padding: 2px 10px;
    border: 1.5px solid var(--bronze);
    border-radius: 4px;
    font-family: var(--font-display);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--bronze-dark);
  }
  .quest-done {
    margin: 0;
    font-style: italic;
    color: var(--form-ink-soft);
  }
```

Delete `.chip-violet`, `.chip-gold`, and the `var(--gold)` reward colour. Keep the Gauge.

- [ ] **Step 4: One name in the catalog (Ruling W13)**

In `server/app/world/catalog.py`, the reward `source` strings « Deux/Quatre/Six/Huit quêtes du tableau » become « … quêtes du mur ». Grep `server/` for « du tableau » and `web/src` + `content/` for « tableau » (player-visible text only), and fix each. Run the server tests that read the catalog.

- [ ] **Step 5: Update the guard, and run**

Remove `TabletsPanel.svelte` and `QuestCard.svelte` from `PENDING`.

```bash
scripts/npm.sh run test -- src/placesKit.test.ts src/formPlural.test.ts
scripts/pytest.sh server/tests -k "catalog or world" -v
scripts/npm.sh run check
scripts/playwright.sh scenes-delphi world scenes-overlays
```

Expected: PASS. Take scratch iPad screenshots of the wall (a new hero; a hero with an active quest; a neutralised lieutenant if `world.spec` leaves one) and view them. Check:
- the tablets hang from the rail;
- the medallions look pressed into the clay;
- no line repeats;
- reward text is dark bronze on parchment and gold on wood.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/places/delphi/TabletsPanel.svelte web/src/components/QuestCard.svelte server/app/world/catalog.py server/tests web/src/placesKit.test.ts web/e2e/scenes-delphi.spec.ts web/e2e/world.spec.ts web/e2e/scenes-overlays.spec.ts
git commit -m "Immersion wave: the quest wall hangs terracotta tablets on cords; one name, one reward line, one treasure line" -- web/src/components/places/delphi/TabletsPanel.svelte web/src/components/QuestCard.svelte server/app/world/catalog.py server/tests web/src/placesKit.test.ts web/e2e/scenes-delphi.spec.ts web/e2e/world.spec.ts web/e2e/scenes-overlays.spec.ts
```

(Name only the server test files you actually changed.)

---

### Task 13: Copy pass and consolidation: the register guard, every overlay swept, the rotate screen, the guard emptied

**Findings:** #25 (sweep), #27, the "copy passes" of this wave, #1 (guard empty). **Depends on:** Tasks 2–12.

**Files:**
- Create: `web/src/registerGuard.test.ts`
- Modify: `web/src/placesKit.test.ts` (assert `PENDING` is empty)
- Consumes from Task 4: `web/src/lib/text/screenText.ts`
- Modify: `web/src/components/scene/RotateScreen.svelte`
- Modify: `web/e2e/scenes-overlays.spec.ts` (the sweep), `web/e2e/scenes-title.spec.ts` (the rotate icon)
- Modify: any file the guards flag

**Interfaces:**
- Consumes: everything above.
- Produces: `registerGuard.test.ts` (the banned-register list); the overlay sweep in e2e.

- [ ] **Step 1: The register guard (failing first, then fix every hit)**

```ts
// Immersion wave (spec §1 "not a school application", playability #2-#7, #19): the words on the
// places' screens are the camp's, not the school's, the office's or the IT department's. Scans the
// places' components, the title/library/Delphi screens, the PIN seal, the scene data and the voices -
// markup text and string literals only (comments and code are not on screen).
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { screenText } from './lib/text/screenText';

const BANNED: [RegExp, string][] = [
  [/\bfacultatif\b/i, 'admin word: say what it does instead'],
  [/\bprofils?\b/i, 'admin word: « héros » or « bouclier »'],
  [/\bHarmoS\b/, 'school system'],
  [/comme à l'école/i, 'school register'],
  // No trailing \b: after « é » (not a \w character) it would never match « Scanné ».
  [/\bscann(?:er|é|ée)(?!\p{L})/iu, 'technical word: « déchiffrer »'],
  [/\bsauvegarder\b/i, 'technical word: « poser sur l'étagère »'],
  [/jamais joué/i, 'say « Jamais défendu »'],
  [/\bréviser\b/i, 'school register: « Te préparer »'],
  [/≈/, 'catalogue metadata'],
  [/multipliée par/i, 'mechanic-speak'],
  [/domaine public/i, 'credits live in ASSETS-LICENSES.md (Ruling W9)'],
  [/\bniveau \d/i, 'school metadata: a medallion says the class'],
  [/\btableau des quêtes\b/i, 'one name: « Le mur des quêtes » (Ruling W13)'],
];

const FILES = [
  ...walk('src/components/places'),
  'src/components/PinGate.svelte',
  'src/components/QuestCard.svelte',
  'src/screens/Title.svelte',
  'src/screens/LibraryTent.svelte',
  'src/screens/Delphi.svelte',
  ...walk('src/lib/world/scenes'),
  'src/lib/world/voices.ts',
  'src/lib/library/shelf.ts',
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name).replaceAll('\\', '/');
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(svelte|ts)$/.test(name) && !name.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

describe('the places speak the camp, not the school', () => {
  it('uses none of the banned words', () => {
    const report: string[] = [];
    for (const f of FILES) {
      const text = screenText(readFileSync(f, 'utf-8'), f.endsWith('.svelte') ? 'svelte' : 'ts');
      for (const [re, why] of BANNED) if (re.test(text)) report.push(`${f}: ${re} (${why})`);
    }
    expect(report).toEqual([]);
  });
});
```

`screenText` is Task 4's extraction (markup text and string literals; comments and code removed). Every hit is fixed in its file. A match that is not player-visible (an API path, a route name) is shown to fall outside the extraction, and the extraction is tightened with a self-test case. Never add an allow-list entry without a controller ruling.

- [ ] **Step 2: Assert the legacy-class guard is empty**

In `placesKit.test.ts`, replace the `PENDING` set's content with nothing, and add `it('has no file left pending (Task 13)', () => expect([...PENDING]).toEqual([]));`. If a file is still pending, the task that owned it missed it: fix it here.

- [ ] **Step 3: The rotate screen (playability #27)**

In `RotateScreen.svelte`, make the icon read as a tablet, with a camera dot and a home-button dot:

```css
  .rotate-icon {
    position: relative;
    width: 64px;
    height: 96px;
    border: 4px solid var(--bronze-light);
    border-radius: 12px;
    background: rgba(21, 18, 26, 0.35);
    box-shadow: 0 0 18px rgba(200, 148, 80, 0.45);
    animation: rotate-hint 2.4s ease-in-out infinite;
  }
  /* A camera dot at the top, a home button at the bottom: a tablet, not an empty frame. */
  .rotate-icon::before,
  .rotate-icon::after {
    content: '';
    position: absolute;
    left: 50%;
    border-radius: 50%;
    background: var(--bronze-light);
    transform: translateX(-50%);
  }
  .rotate-icon::before {
    top: 5px;
    width: 5px;
    height: 5px;
  }
  .rotate-icon::after {
    bottom: 5px;
    width: 10px;
    height: 10px;
    background: none;
    border: 2px solid var(--bronze-light);
  }
```

In `scenes-title.spec.ts`'s portrait test ("title: no red, rotate screen in portrait…"), prove that the turn runs, and that it fades under reduced motion:

```ts
  const icon = page.getByTestId('rotate-screen').locator('.rotate-icon');
  await expect
    .poll(() => icon.evaluate((e) => e.getAnimations().map((a) => [(a as CSSAnimation).animationName, a.playState])))
    .toContainEqual(['rotate-hint', 'running']);
```

Under `page.emulateMedia({ reducedMotion: 'reduce' })`, expect `['rotate-pulse', 'running']` instead.

- [ ] **Step 4: Sweep every overlay (`scenes-overlays.spec.ts`)**

Add one data-driven test per project. It opens each overlay by its deep link on a fresh hero and checks:
- the variant (Ruling W1);
- that it clears the HUD, with the labels faded;
- the 48 px targets;
- no legacy class in the DOM;
- the expected voice.

```ts
const OVERLAYS = [
  { hash: (id: number) => '/profiles/new', testId: 'overlay-hero-new', scene: 'title', variant: 'scroll', voice: 'owl' },
  { hash: (id: number) => `/p/${id}/parchemins`, testId: 'overlay-shelves', scene: 'library', variant: 'table', voice: 'owl' },
  { hash: (id: number) => `/p/${id}/texts/new`, testId: 'overlay-desk', scene: 'library', variant: 'scroll', voice: 'owl' },
  { hash: (id: number) => `/p/${id}/texts/scan`, testId: 'overlay-lens', scene: 'library', variant: 'scroll', voice: 'owl' },
  { hash: (id: number) => `/p/${id}/alexandria`, testId: 'overlay-portal', scene: 'library', variant: 'codex', voice: 'owl' },
  { hash: (id: number) => `/p/${id}/delphes`, testId: 'overlay-pythia', scene: 'delphi', variant: 'scroll', voice: 'pythia' },
  { hash: (id: number) => `/p/${id}/quetes`, testId: 'overlay-tablets', scene: 'delphi', variant: 'table', voice: null },
] as const;

for (const o of OVERLAYS) {
  test(`${o.testId}: an in-world ${o.variant}, clear of the HUD, 48 px targets, kit classes only`, async ({ page, request }, testInfo) => {
    const id = await createProfileApi(request, hero(testInfo.project.name));
    await page.goto(`/#${o.hash(id)}`);
    const panel = page.getByTestId(o.testId);
    await expect(panel).toHaveAttribute('data-variant', o.variant);
    await expectOverlayClearsScene(page, o.testId, o.scene);
    await expectOverlayTapTargets(page, o.testId);
    await expect(panel.locator('.btn, .card, .chip, .chip-active, .parchment')).toHaveCount(0);
    if (o.voice) await expect(panel.getByTestId('overlay-voice')).toHaveAttribute('data-speaker', o.voice);
    else await expect(panel.getByTestId('overlay-voice')).toHaveCount(0);
    expect(await redScan(page)).toEqual([]);
  });
}
```

(The work overlay needs a real work id. Add it by opening the first `work-card` from the portal case, in a separate test, as `scenes-library.spec.ts` does. `#/?panel=tous` needs more than 5 heroes to matter; leave it to `scenes-title.spec.ts`.)

- [ ] **Step 5: A last copy read**

With the Read tool, read every French string in the files of the File map. List them, for example by grepping `>[^<{]*[a-zé][^<{]*<` and the `VOICES` / scene data. Check each against the Global Constraints' copy rules: in-world, warm, gender-neutral, no school/admin/technical register, no `(s)`, no emoji. Fix the stragglers, and put the list of changed strings in the report.

- [ ] **Step 6: Run the tests**

```bash
scripts/npm.sh run test
scripts/npm.sh run check
scripts/playwright.sh scenes-overlays scenes-title
```

Expected: every vitest suite passes (including the four guards: `noEmoji`, `placesKit`, `formPlural`, `registerGuard`), and svelte-check reports 0 warnings.

- [ ] **Step 7: Commit**

```bash
git add web/src/registerGuard.test.ts web/src/placesKit.test.ts web/src/components/scene/RotateScreen.svelte web/e2e/scenes-overlays.spec.ts web/e2e/scenes-title.spec.ts <every file a guard flagged>
git commit -m "Immersion wave: register guard, every overlay swept (variant, HUD, 48 px, kit only), a rotating tablet on the rotate screen" -- web/src/registerGuard.test.ts web/src/placesKit.test.ts web/src/components/scene/RotateScreen.svelte web/e2e/scenes-overlays.spec.ts web/e2e/scenes-title.spec.ts <every file a guard flagged>
```

---

### Task 14: The playability walk with real names, and the full gate

**Findings:** #26, and the re-review input for all 27. **Depends on:** Tasks 1–13 and Wave A.

**Files:**
- Modify: `web/e2e/playability-ui3.spec.ts`
- Create (generated): `docs/reviews/ui3/ipad-landscape-*.png`, `docs/reviews/ui3/ipad-portrait-a01-rotate-screen.png` (overwrites the UI3a shots: git keeps the old ones in history, commit `0f5cfa7`)

**Interfaces:**
- Consumes: every helper above; the playability config (one worker, `ipad-landscape` + `ipad-portrait`).
- Produces: the screenshots for the Opus playability re-review, which the controller dispatches after this task with the same question: "does anything still look like a school form?"

- [ ] **Step 1: Real names, deleted first (Ruling W12)**

At the top of `playability-ui3.spec.ts`:

```ts
// Playability #26: a real long accented name shows real truncation. The playability config runs
// one worker and only ipad-landscape walks the scenes (Ruling W12), so fixed names are safe - but
// an earlier walk's copies are deleted first so the ritual never meets « Ce nom est déjà pris. ».
const HERO = 'Anne-Charlotte';
const LOCKED = 'Élise-Marguerite';
const PROPHECY_TITLE = 'La dictée du jeudi';
const DESK_TITLE = 'Les fées de la clairière';

async function clearEarlierWalk(request: APIRequestContext) {
  const profiles = (await (await request.get('/api/profiles')).json()) as { id: number; name: string }[];
  for (const p of profiles.filter((x) => x.name === HERO || x.name === LOCKED)) {
    expect((await request.delete(`/api/profiles/${p.id}`)).status()).toBe(204);
  }
  const texts = (await (await request.get('/api/texts')).json()) as { id: number; title: string }[];
  for (const t of texts.filter((x) => x.title === PROPHECY_TITLE || x.title === DESK_TITLE)) {
    expect((await request.delete(`/api/texts/${t.id}`)).status()).toBe(204);
  }
}
```

Call it at the start of the test (after `stubSpeech`). Use `HERO` for `w.heroName`, `LOCKED` for the locked hero (not `${w.heroName}-code`), `PROPHECY_TITLE` for the Delphi text and `DESK_TITLE` for the desk's title field. Remove `uniqueName` from this file if it is no longer used.

- [ ] **Step 2: Walk the new objects**

Keep the shot numbering of UI3a so the reviewer can compare. Add `b` shots for the new states:

| Shot | Change |
|---|---|
| a02 | `enterTitle` with zero or more heroes; the one ribbon line |
| a03 | The ritual: fill `HERO`, pick « Lyre » (`label.avatar-choice`), `chooseLevel(ritual, '10H')`; the seal toggle closed |
| **a03b** | The same with « Protéger ton bouclier d'un sceau » open |
| a03 → camp | The submit is « Accrocher mon bouclier » |
| a04 | The PIN seal for `LOCKED`: after `getByLabel('Tes quatre chiffres').fill('43')`, so two slots are filled |
| a06 | The tent (next-step glow on « Tes parchemins ») |
| **a06b** | Tap `library-owl`, `settleDialogue`, shot (her hint in the dialogue box) |
| a07 | The shelves (table, cubbies) |
| **a07b** | « Autres niveaux » open, « Tous » chosen, scrolled to the heading « Autres parchemins » |
| a08 | The desk with `DESK_TITLE` and the 13-word text (gauge « il en faut au moins 80 ») |
| a09 | The lens before a photo |
| **a09b** | After `setInputFiles('/work/server/tests/fixtures/scan/handout.png')`: the photo in the lens frame, « Déchiffrer » |
| a10 | The portal codex |
| a11 | A never-copied work (pick a card whose `data-status` is `never`; fall back to the first card) |
| a12–a13 | Unchanged flow (the Pythia greets with « Approche. … ») |
| a14 | The three sealed rolls |
| a15 | The school scroll unrolled with the six monsters |
| a16 | The wall of tablets |
| portrait-a01 | Pause the rotate icon mid-turn so the still shows it turned: `await page.locator('.rotate-icon').evaluate((e) => { const a = e.getAnimations()[0]; a.pause(); a.currentTime = 0.6 * 2400; });` before `shot()` |

Every wait is on state (the existing `waitForOverlaySettled`, `settleDialogue`, `waitForSceneSettled`); no new fixed delay. The existing 120 ms paint pad in `shot()` stays as documented.

- [ ] **Step 3: Run the walk and view every shot**

```bash
scripts/playwright.sh --config playwright.playability.config.ts playability-ui3
```

View every PNG in `docs/reviews/ui3/` with the Read tool. For each of the 27 findings, write one line in the report: which shot shows it fixed, or what is still off. Fix anything off before the gate (in the task that owned it; a small fix is fine here, and name it in the commit).

- [ ] **Step 4: The full gate**

```bash
scripts/check.sh
```

Expected: ALL GREEN, meaning pytest, svelte-check (0 errors, 0 warnings), vitest, the docker build and Playwright (desktop + ipad, 8 workers). Paste the summary lines. A flaky test is a defect: find its root cause (CLAUDE.md). Never rerun until it happens to pass.

- [ ] **Step 5: Commit**

```bash
git add web/e2e/playability-ui3.spec.ts docs/reviews/ui3
git commit -m "Immersion wave: playability walk with real names and the new objects; UI3a screenshots refreshed" -- web/e2e/playability-ui3.spec.ts docs/reviews/ui3
```

(Do not stage `docs/reviews/ui3/playability-ui3a.md`: it is the review itself, untracked on purpose until the controller commits it with the re-review.)

---

## Self-review (plan writer)

- **Coverage:** the 27 findings are mapped (table "Findings → tasks"). The UI3b parts are in "Deferred", each with its reason and home.
- **Order:**
  1. Foundation: Task 1 (art, may start before Wave A) and Tasks 2–4 (variants, kit, guard, helpers).
  2. Shared data: Task 5 (names, titles, glow, owl).
  3. Places: Tasks 6–7 (title), 8–10 (library), 11–12 (Delphi).
  4. Task 13 (copy pass, sweep, guard emptied), then Task 14 (walk + gate).
- **Parallelism:** Task 4 may run beside Task 3. After Task 5, the place tasks touch disjoint panels, but they share `placesKit.test.ts`'s `PENDING` set and some e2e specs. Run them one at a time (the SDD default), or resolve the one-line `PENDING` conflicts on merge.
- **Wave A interplay:** stated per task (replacePanel, `go`, h3, M7, M9, M16, M17, the prophecy helpers' location). Nothing here redoes a Wave A item.
- **Risks the implementer must watch:**
  - the altar card at 900×900 (Task 11; the three-size test decides);
  - the shields' hook positions (Task 6; measured, not guessed);
  - the parchment texture's vignette (Task 1; Ruling W3 fallback);
  - the specificity trap between `.kit-form label` and label-based kit classes (Task 3's load order + `label.kit-*` selectors);
  - `profiles.spec`/`grimoire.spec` relying on texts outside her level (Task 8).
