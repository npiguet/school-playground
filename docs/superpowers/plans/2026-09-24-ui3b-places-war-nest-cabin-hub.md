# La Discorde — UI3b "Places II: war tent, nest, cabin, the real hub" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish UI3. The war tent (the lieutenants' portrait sheets, Éris's file on the map table, the bestiary codex on its lectern), the dragon's nest and the cabin (trophy shelf, journal, lyre, and the hero panel moved there) become painted places whose overlays are in-world objects with full feature parity. The camp moves onto `hub_camp.webp` with six places. The legacy top nav retires from every place. An iPad review walk and the full gate close the milestone.

**Architecture:** Same engine and conventions as UI3a and its immersion wave. `placeFor(route)` maps each legacy route to "its place + its overlay". Each legacy screen moves with `git mv` into `web/src/components/places/<place>/*Panel.svelte` and is restyled with the object kit. Each place is a thin screen on `PlaceScene` (data load, HUD, greeting, `say()`, the « Réessayer » state, the exit sign) with hand-authored `*.shapes.ts` checked by `?debug`. Every control that navigates goes through `panelNav` (`go`, `openHotspot`, `openPanel`, `closePanel`, `replacePanel`). One shared `nextStep(camp)` drives every next-step glow and the hub greeting's last line.

**Tech Stack:** Svelte 5 (runes) + TypeScript + Vite 7, vitest 5 (node env), Playwright 1.63 (WebKit `desktop` 1280×720 and `ipad` 1180×820 touch; a `chromium` project for `scenes-library` only), Docker Desktop + Git Bash wrapper scripts. No new npm dependency, no server change.

**Spec:** `docs/superpowers/specs/2026-09-24-scenes-ui-design.md` is binding (§2, §3, §4, §6, §9 UI3, §10). The UI3a plan (`2026-09-24-ui3a-places-title-library-delphi.md`, Rulings A1–A18) and the immersion wave (`2026-09-25-ui3a-immersion-wave.md`, Rulings W1–W14) hold here; the B-series below extends them. Repo-root `CLAUDE.md` is binding for every agent: no "pre-existing" problems, zero svelte-check warnings, no emoji.

## Changes since the original plan

The original plan (2026-09-24) was written before fix Wave A, the immersion wave and its final fixes. This refresh rebuilds it on the code at `c5a1699`.

| Change | Why |
|---|---|
| Every place screen is a thin `PlaceScene` screen: the greeting goes through PlaceScene's `greet` prop, tapped lines through `place.say()`, hotspots through `openHotspot`, focus return through `hotspotSelector`. The hand-rolled `activate`/greeting effects, `campStore.data` filters and the old camp-status parchment are gone. | Wave A (M2, M4, M5, M18): PlaceScene, `go()`, `campFor()`, `hotspotId.ts` exist. |
| Every overlay uses a real variant and, where a character speaks, a voice plate. Portrait sheet, care, lyre and hero panel are **scroll**s. Éris's file and the trophy shelf are **table**s. The bestiary, a bestiary page and the journal are **codex** spreads. The panels are restyled with the object kit (`kit-sheet`, `kit-note`, `kit-stamp`, `kit-cubby`, `kit-tag`, `kit-bronze is-quiet`, `kit-link`, `kit-gauge`, `kit-medallion`, `LevelMedallions`), never `.card`/`.btn`/`.chip`/`.parchment`. | Immersion Rulings W1, W2, W4, and the UI3a review's recommendation 1 (the bestiary, the journal and the trophy shelf would otherwise be card grids). |
| Overlay titles come from `OVERLAY_TITLES` and echo the plaque: « Le bestiaire » (not « Bestiaire »), « La lyre » (the hotspot, the overlay and the hero-panel medallion; no longer « Réglages »), « Ton dragon » (static; the name is shown inside). | Ruling W6 and its unit test. |
| The sleeping-lieutenant line no longer says « à ce niveau » and handles the plural: « Protée dort encore. Ses ruses viendront dans une classe plus grande. ». The Stats heading « Aide des Muses : niveau N sur 4 » becomes the journal's « L'aide des Muses » with four medallions. « Comme en classe », « Taux dans la fenêtre », « Voir les chiffres bruts », « boîte N », « parties » and grade codes on text rows go too. | The register guard bans « niveau » (it would fail the old copy), carried item "Stats « niveau N sur 4 »" from the immersion ledger. |
| A shared `lib/world/nextStep.ts` (Ruling B9) drives the hub glow, the greeting's last line, the library shelves' glow and the Pythia's glow. The war tent glows on the first stirring lieutenant only. | Immersion Deferred #11 (recommendation 5): "the hub and the place agree on where to go"; W14 (at most one glow per scene). |
| The hub loses its quest-wall and bestiary hotspots, gains badges on the Delphi and war-tent plaques, captions only for news, the dragon seated in the painted nest, a locked path to battle. Its e2e asserts `labelOverlaps(page, 'camp')` is `[]` at three viewports. | Immersion Deferred #10 and #23, recommendation 3, the ledger's camp-label-overlap ruling and final-review M19. |
| The camp's prophecy column is removed without moving its test: Delphi's altar card and its e2e already exist (UI3a Task 12, final fixes). | Done since the original plan. |
| The cabin's lyre overlay carries the credits (a folded « Merci à ceux qui ont aidé le camp » note). | Immersion Deferred #7 (finding 7). |
| The dragon speaks from its care overlay (voice plate, its own tinted cut-out). | Immersion Deferred #23 ("the same for the dragon"), Ruling B5. |
| `Hotspot`'s painted lock and the `sleepingLine` helper move into Task 1: the war tent and the hub both need them. | Two parallel lanes use them. |
| Task 1 pre-stages the files every lane edits (`App.svelte`, `scenes/index.ts`, `OVERLAY_TITLES`, the register guard's file list, the happy-path/grimoire tails, the overlay-sweep helper). Each later task then edits only its own fenced hunk. | Tasks 2–6 run as two parallel worktree lanes. |
| The e2e snippets use today's helpers: `test`/`expect` from `./crashGuard`, `tap(locator, testInfo)`, `uniqueName()`, `expectScene`, `expectCamp`, `closeOverlay`, `expectInSafeZone`, `labelOverlaps`, `expectOverlayClearsScene`, `expectOverlayTapTargets`, `measureBoxes`, and the moved `expectInWorldOverlay`. There is no `Date.now()` in fixture names, no local `tap` and no `heroName` built from a timestamp. | Wave A M9/M12/M13, immersion e2e-robustness rules. |
| The walk (Task 9) follows today's `playability-ui3.spec.ts`: `skipGreeting(w, sceneId)`, `waitForOverlaySettled`, `shot(w, name)`, fixed realistic names, `WALK_OUT`. The functional gate and the baseline refresh are separate steps. | Immersion Task 14, W12, the WALK_OUT carry. |
| Global Constraints now list the guards, the stack, lock and testing rules, and forbid `git checkout`/`stash`/`reset`/`clean`. A dependency/batching table heads the plan. | Ruling W-d/W-e and this refresh's brief. |
| Task structure kept (9 tasks). Tasks 2+3 (war tent) and 4+5+6 (nest, cabin) are two lanes; 7 and 8 can run side by side. | Right-sized for batching. |

## Dependencies and batching

| Batch | Tasks | Where | Needs | Notes |
|---|---|---|---|---|
| B1 | **1** foundation | main checkout (`scenes`) | — | Everything else builds on it. Full `scripts/check.sh` at the end. |
| B2 | lane **W**: **2 → 3** (war tent) ‖ lane **H**: **4 → 5 → 6** (nest, cabin, hero panel) | two worktrees from B1's head: `../sp-wt-war` (branch `ui3b-war`, `STACK=war`), `../sp-wt-home` (branch `ui3b-home`, `STACK=home`) | B1 | The lanes touch disjoint files except the hunks Task 1 fenced. Within a lane the tasks are sequential. Each lane runs one full `STACK=<lane> PW_WORKERS=4 scripts/check.sh` at its end, then the controller merges both into `scenes` and runs the full gate once. |
| B3 | **7** hub ‖ **8** retire the screens + parity sweep | two worktrees from the merged head (`STACK=hub`, `STACK=parity`), or sequential in the main checkout | B2 merged | 7 edits the camp files; 8 edits `App.svelte`, a new vitest and a new spec. The parity spec only relies on `camp-parchemins`, which both hub versions keep. Merge both, then run the full gate once. |
| B4 | **9** the walk and the full gate | main checkout | B3 merged | The only task that refreshes `docs/reviews/ui3/`. |

Playwright runs are serialised machine-wide by the lock in `scripts/playwright.sh` (Ruling W-e): parallel lanes code and run vitest in parallel, and their e2e runs queue.

## Global Constraints

- **Scope (spec §9.3):** "UI3 Places: Title, Library, Delphi, War tent, Dragon's nest, Cabin scenes + overlays with full feature parity." UI3b covers the war tent, the nest, the cabin and the hub remap. Out of scope: audio and dialogue content files (UI5; static lines in TypeScript are fine) and the battle stage (UI4: Play, Boss, Grimoire, Results and ProgressionReveal keep their layout and the legacy `TopBar`).
- **Mechanics unchanged (spec §1):** no API shape change, no grading, XP or quest rule change. UI3b changes no server file.
- **Feature parity (spec §3):** "Any existing functionality on a screen must remain reachable in its new home (feature parity is a review gate)." The Parity map below is the checklist. A control may move behind a fold (`<details>`), never disappear.
- **Routes (spec §2.3):** every current route name and path stays; one route is added (`war-tent`); none is removed. Every scene and overlay has a route, so Back, reload and deep links keep working. Test ids keep their names and meanings; new elements get new test ids.
- **Overlays (spec §2.2, §4; W1, W2, W6, W11):** in-world objects over the dimmed scene, variant `scroll` / `table` / `codex`. A codex panel renders exactly one `.codex-spread` with two `.codex-page` sections. A character's line inside an overlay is an `OverlayVoice` plate (via the `voice` prop, or rendered at the top of the panel when it needs live data), never a paragraph of instructions. The overlay title (`OVERLAY_TITLES`, or the lieutenant/entry name) is the only `<h2>`; sections inside are `<h3 class="kit-section">`, items inside a section `<h4>` (`headings.test.ts`).
- **Forms (spec §2.4, W5):** form elements stay real HTML (`input`, `select`, `textarea`, radio medallions via `LevelMedallions`), restyled by `.kit-form` (every overlay body). The PIN stays a real `<input>`.
- **Stage (spec §4, UI1 Ruling 3):** art 16:9 `object-fit: cover`; every interactive element inside the 4:3 safe zone (art x 12.5–87.5 %); hotspots at y ≥ 14 %; no hotspot on the dialogue dock (x 27–87.5 %, y 80–100 %). Shapes are hand-authored from `docs/art/scenes.md` (±2 %), validated by `validateScene`, checked with `?debug`.
- **One glow per scene (W14, Ruling B9):** at most one `isNew` hotspot per scene for every fixture camp (`nextStep.test.ts` runs every scene). Place glows that mean "go here next" read `nextStep(camp)`.
- **Motion (spec §4):** honour `prefers-reduced-motion` (no parallax, no bob, fades only); parallax ≤ 3 depth layers.
- **Performance (spec §4):** ≤ 600 KB WebP per scene background; each scene preloads its likely next scenes (`budget.test.ts` over `SCENES`).
- **French copy:** use every French string of this plan verbatim. It is in-world, warm and gender-neutral towards the player (never « héros » as a vocative, no adjective agreeing with her). No school register (« réviser », « niveau », « HarmoS », « comme à l'école », grade codes such as « 10H » on a text row), no admin register (« profil », « facultatif »), no technical register (« scanner », « sauvegarder », « chiffres bruts », « fenêtre »), no form plural « (s) » (use `plural()`), elision through `de()`, dates through `longDate()` (`lib/text/french.ts`). Code, comments, docs and commit messages are in English.
- **Ethics and colour:** no red (e2e `redScan`); orange is Éris's (`kit-note data-tone="eris"`, `--orange-ink` for text); reward text on parchment is `--reward-ink`; wax and clay are brown-orange. Nothing is lost, no guilt wording (`manqué|raté|perdu`). Every reward and every lock says in advance how to get past it.
- **No emoji (CLAUDE.md):** painted icons (`ART.icons.*`, `MARK_ICONS`, `LIEUTENANT_ICONS`), the shared `Icon` SVGs or words. Never in French text either.
- **Accessibility:** touch targets ≥ 48 px, inside overlays too (`expectOverlayTapTargets`); every hotspot a real focusable `<button>` with a visible label (or an `ariaLabel`); `alt` on every image (empty for decoration); overlays are `aria-modal` with the stage `inert`; focus rings visible (`--gold-light`); closing an overlay returns focus to what opened it.
- **Guards that must stay green (vitest):** `noEmoji.test.ts`; `placesKit.test.ts` (no legacy `.btn`/`.card`/`.chip`/`.parchment` under `components/places/`, `PENDING` stays empty); `registerGuard.test.ts` (the banned words above; Task 1 makes it scan every place screen); `formPlural.test.ts`; `noGuilt.test.ts`; `components/places/headings.test.ts`; `voices.test.ts` (≤ 160 characters, no « héros », a painted portrait); `kit*.test.ts` (contrast, every `url()` resolves); `lib/world/scenes/nextStep.test.ts` (one glow per scene); `budget.test.ts`; `e2eCrashGuard.test.ts` (every spec imports `test`/`expect` from `./crashGuard`).
- **Legacy CSS:** new code never uses the class names `screen` or `scene` (the global `.scene` stays for Boss until UI4), nor the legacy kit-form classes above.
- **Toolchain:** no Node and no host Python for tooling. From the repo root, in Git Bash:
  - `scripts/npm.sh run test -- <files>` (vitest, focused);
  - `scripts/npm.sh run check` (svelte-check: `0 errors and 0 warnings`);
  - `STACK=<lane> scripts/playwright.sh <spec-filter> [--project=<name>] [--repeat-each=3]`;
  - `STACK=<lane> PW_WORKERS=4 scripts/check.sh` (the full gate);
  - `scripts/playwright.sh --config playwright.playability.config.ts playability-ui3` (the walk; writes to `web/test-results/walk-ui3` unless `WALK_OUT=docs/reviews/ui3`).
  In the main checkout `STACK` is unset. In a worktree always set the lane's `STACK`, so compose project, image, port and `node_modules` volume stay apart. Never run Forge (art) and e2e at the same time (Ruling F4).
- **Testing rules:** per task, run the focused vitest files and `svelte-check`, run every **new or changed** e2e spec with `--repeat-each=3`, and run every **touched but unchanged-in-intent** spec (the ones migrated to new selectors) once. One full `scripts/check.sh` per lane or batch, not per task. Playwright is serialised machine-wide by `scripts/playwright.sh`'s lock; a queued run is not a hang. The crash-only retry (`scripts/playwright-crash-retry.mjs`) retries a named "browser crashed" failure once; any other failure is a real failure.
- **e2e robustness (8 workers by default):** fixture names from `uniqueName()`; wait with `expectScene` / `waitForSceneSettled(page, sceneId)` / `expectCamp`; scope locators to their overlay; no `waitForTimeout` or fixed sleeps (poll real state: `expect.poll`, `toHaveCount`, `getAnimations().length`); never assume the shared database holds only your texts; a finger on `ipad`, a mouse on `desktop` (`tap(locator, testInfo)`).
- **Commits:** on the lane's branch (`scenes` in the main checkout). **Always** `git add <paths> && git commit -m "..." -- <paths>`; a `git mv` / `git rm` names both paths. Never `git add -A`, `git stash`, `git reset`, `git checkout`, `git restore` of tracked work, `git clean`, or any history rewrite. End every message with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>` (or your harness's trailer). The walk's screenshots go to the scratch dir; `docs/reviews/ui3/*.png` changes only in Task 9's baseline step.
- **Verification:** run each task's commands and paste the real output (counts included) into the report. A failing, flaky or warning test anywhere is yours to fix or to report as an open item, never "pre-existing" (CLAUDE.md).

## Rulings taken by this plan (the spec is silent; do not re-ask)

- **B1 Places and routes (extends A1).**

  | Route (name → path) | Place | Overlay (`PanelId`) | Variant | Title |
  |---|---|---|---|---|
  | **new** `war-tent` → `#/p/:id/tente-de-guerre` | war | none | | |
  | `dossier` → `#/p/:id/dossier` | war | `dossier` | table, wide | « Le dossier d'Éris » |
  | `bestiaire` → `#/p/:id/bestiaire` | war | `codex` | codex | « Le bestiaire » |
  | `bestiaire-entry` → `#/p/:id/bestiaire/:key` | war | `page` | codex | the entry's name (fallback « Le bestiaire ») |
  | `lieutenant` → `#/p/:id/monstres/:key` | war | `portrait` | scroll, wide | the lieutenant's name (fallback « Les lieutenants d'Éris ») |
  | `dragon` → `#/p/:id/dragon` (+ `?panel=soin`) | nest | none / `soin` | scroll | « Ton dragon » |
  | `cabin` → `#/p/:id/cabane` (+ `?panel=tresors` / `?panel=heros`) | cabin | none / `tresors` / `heros` | table, wide / scroll | « Tes trésors » / « Ton héros » |
  | `stats` → `#/p/:id/stats` | cabin | `journal` | codex | « Ton journal » |
  | `settings` → `#/p/:id/settings` | cabin | `lyre` | scroll | « La lyre » |

  `camp?panel=heros` stays a route: once the hero is welcomed, the camp hands it over to `cabane?panel=heros` with `replacePanel` (B2). After UI3b only `play`, `grimoire` and `boss` return `null` from `placeFor`.
- **B2 The hero panel lives in the cabin (carry #4).** Overlay `heros` on the cabin (test ids `overlay-heros`, `hero-settings`, `hero-journal`, `hero-switch` kept). The HUD's hero chip is its shortcut from every place (`heroPanelHref` → `#/p/:id/cabane?panel=heros`, opened with `go(…, 'panel')`, so its seal steps back to where the chip was tapped). Medallions: « La lyre » → the lyre overlay, « Ton journal » → the journal (it pointed at the dossier before), « Changer de héros » → the title. Each opens with `openPanel`, so its seal steps back to the hero panel.
- **B3 The hub on `hub_camp.webp` (carry #17, rec. 1–8).** Six places, ids from UI1 Ruling 4: `dragon` (the nest → `dragon`), `oracle` (the path to Delphi → `delphi`), `parchemins` (library tent → `library-tent`), `dossier` (war tent → `war-tent`), `cabin` (→ `cabin`), `boss` (path to battle → `boss`). `quests` and `bestiary` leave the hub (their homes are Delphi's tablet wall and the war tent's codex). Their counts move onto plaques: the oracle plaque carries the active-quest badge, the war-tent plaque the foiled-tricks badge. Every plaque is pinned by a leader line or inked `on` its landmark. Captions only for news (`campNews`, at most three, in the order battle, oracle, parchemins, dragon, war tent). One next-step glow (B9). The path to battle is always shown, and **locked** (painted lock, grey glow) until Éris can be fought; a tap on it makes the dragon say how many tricks remain. The weekly ribbon stays in the open sky (art x 40–65, y 8–20). The dragon cut-out sits in the painted nest (x 17, feet at y 55). The prophecy stays on Delphi's altar; the oracle plaque's caption announces it.
- **B4 War tent portraits.** Each lieutenant is a hotspot on its blank parchment sheet, its painted cut-out on the sheet, its name inked on the sheet (`labelPos: 'on'`). A lieutenant still asleep at the hero's class is **locked**: the dragon says `sleepingLine(key)`. Only the first stirring lieutenant (in `LIEUTENANT_ORDER`) glows. A neutralised one wears a gold seal and « Neutralisé(e) » agreed by `agree()`. The map table opens the dossier, the lectern the codex.
- **B5 The nest.** The stage (`dragon-stage`), the growth gauge and what the dragon is up to sit on a parchment in the scene. A tap on the dragon opens its care (`soin`): name and tints, with the dragon speaking from the voice plate (`careLine`, its own tinted cut-out). This is the immersion wave's "the same for the dragon" (#23). The nest greets once per page load with the stage line (PlaceScene `greet`).
- **B6 The cabin.** Displayed decor hangs on the walls as reward medallions (`DECOR_SLOTS`). The trophy shelf opens `tresors`, the journal on the desk opens `journal` (stats), the lyre opens `lyre` (settings; the single mute stays, A17; the credits fold lives there, immersion Deferred #7).
- **B7 The top nav retires from the places (carry rec. 8).** After UI3b, `TopBar` is imported only by Play and Boss. The profile gate's loading and error states in `App.svelte` become ribbons on the night backdrop.
- **B8 The walk.** `playability-ui3.spec.ts` gains the sections hub, war, nest, cabin and wide, `?debug` shots of all seven scenes, and the two locked-place steps (carry #16/M9).
- **B9 One next step (immersion Deferred #11, recommendation 5).** `nextStep(camp)` returns, in this order: `'battle'` (a tier is open and no fight is engaged), `'first-text'` (no XP yet), `'prophecy'` (the nearest prophecy falls due within 7 days), `'scrolls'` (the week's scrolls are sealed), else `null`. The hub glows on `HUB_PLACE[step]` (`boss`, `parchemins`, `oracle`, `oracle`). The greeting's last line names the same step (`nextStepLine`). A place glows only when the step is in that place: the library shelves on `'first-text'`, the Pythia on `'prophecy'` or `'scrolls'`. Local "something here" glows (the nest's unnamed dragon, the war tent's first stirring lieutenant) are allowed, one per scene. Change from today: the greeting used to name a prophecy before a battle, and the Pythia glowed for a hero with no XP yet. Both now follow the one order above.
- **B10 Voices.** Éris speaks in the war tent (`erisSays(text)`, `ART.erisSmug`): the portrait sheet (her `dossierLine` for this lieutenant) and the dossier (her `dossierIntro`). The owl speaks on the bestiary codex (`VOICES.bestiary`). The dragon speaks in its care (`careLine`). The journal, trophies, lyre and hero panel have no voice.
- **B11 Lieutenants' sleep in words.** `sleepingLine(key)` in `lib/world/eris.ts` replaces `lockedLine`: « Protée dort encore. Ses ruses viendront dans une classe plus grande. » (plural « Les Sirènes dorment encore. Leurs ruses viendront dans une classe plus grande. »). It is used by the war tent's locked sheets, the dossier's sleeping rows and the quest wall's asleep tablets. The sheet caption is `sleepingCaption(key)`: « Dort encore » / « Dorment encore ».
- **B12 Merge-friendly staging.** Task 1 fences, with comments, one block per place in `App.svelte` (imports and branches), in `lib/world/scenes/index.ts` and in the register guard's file list. Tasks 2–6 edit only their own block, so the two lanes merge without conflicts.

## Parity map (UI3b screens)

| Screen | Features, links, forms, states | New home |
|---|---|---|
| Dossier | Éris's smug portrait + « Éris feuillette son dossier… » / `dossierIntro`; « Ses points faibles »: a row per lieutenant (sleeping row with its line; open row: icon, name, « Neutralisé(e) », Éris's line `dossier-line-*`, « Pièges tendus / déjoués / taux », 3-day gauge) → lieutenant; camp loading/error; `dossier-small-tricks` (small-tricks line, « Mots qu'elle vise », link to stats); « Ce qu'elle préfère taire » (best rate, total caught, rank); stats error | Map table → `overlay-dossier` (table): Éris's voice plate, six pinned sheets (`dossier-row-<key>`), a sheet of small tricks with « Lire ton journal », « Ce qu'elle préfère taire » (Task 3) |
| Bestiaire | subtitle; a grid of entries (art, name, teaser, status « À découvrir » / « En cours » / « Neutralisé(e) », `bestiary-locked`) → entry | Lectern → `overlay-codex` (codex): the owl's plate; left page « Les ruses d'Éris », right page « Les amis du camp » (Task 3) |
| BestiaireEntry | art, « Le mythe » (facts, or teaser + « Mythe à débloquer… »), « Sources », « Au camp » + « Fiction du jeu », « Voir la ruse et la quête » → lieutenant; unknown entry | `overlay-codex-page` (codex): left page plate + myth + sources, right page « Au camp » + the button (Task 3) |
| Lieutenant | portrait on the battle backdrop, technique, Éris's line, neutralised banner + relic medallion + date, « … s'agite à nouveau », gauges (days, traps, rate with the 80 % mark), « Lancer une quête » / « Quête en cours », toast « Quête affichée au mur. », reward line, « Ouvrir son grimoire corrompu », « Textes conseillés » → play; unknown key; loading/error | Sheet → `overlay-portrait` (scroll): Éris's voice plate, the same content in kit objects (Task 2) |
| DragonScreen | dragon art at its stage and tint; `dragon-stage` + growth gauge; « Nom » (egg line, input + « Garder ce nom », errors, toast); « Teinte »: six swatches, locked ones with the lock and « À gagner : quête de l'Oracle », optimistic change; loading/error | Nest: the tinted cut-out and the growth parchment in the scene; `overlay-care` (scroll) with the dragon's voice (Task 4) |
| Cabin | displayed decor over a banner; « Ta cabane »; empty line; four sections of rewards (medallion or tinted egg, name, description, « Comment l'obtenir : … », « Exposer » / « Ranger »); load/equip errors | Cabin: decor on the walls; trophy shelf → `overlay-trophies` (table): four sections of cubbies (Task 5) |
| Stats | subtitle; « Aide des Muses : niveau N sur 4 » + description; « Par catégorie » table; « Mots-pièges » with box; « Dernières parties » (title, date, score, rate, « Grimoire »); « Totaux »; loading/error; empty lines | Journal on the desk → `overlay-journal` (codex): « L'aide des Muses » (four medallions + its line), « Ses ruses, une à une », « Mots-pièges » (laurel leaves for the box), « Tes dernières défenses », « Depuis le début » (Task 6) |
| Settings | « Voix de la dictée » (select, « Écouter un essai », no-voice help), « Ta classe » medallions, « Son » mute, « Objectif de la semaine » 2–5, « Code » (new code, « Retirer le code »), error, toast « C'est noté. », « Enregistrer » | Lyre → `overlay-lyre` (scroll), goal as medallions, credits fold (Task 6) |
| Camp hero panel | three medallions, focus trap, deep link, onboarding precedence | `overlay-heros` in the cabin; `camp?panel=heros` hands over (Task 6) |
| Camp (UI1 hub) | eight places; weekly ribbon; prophecy column + « Te préparer »; greeting; HUD; onboarding; exit veil | Six places on `hub_camp.webp` (B3); prophecy on Delphi's altar (exists) + oracle caption; ribbon, greeting, HUD, onboarding, veil kept (Task 7) |

## Carried items handled here

| Item | Task |
|---|---|
| UI1 #4 hero panel into the cabin, shortcut from the HUD | 6 |
| UI1 #12 titles echo hub labels (« La tente de guerre », « Le nid du dragon », « Ta cabane »); the cabin's own art | 2, 4, 5 (+ `OVERLAY_TITLES`, Task 1) |
| UI1 #16 / M9 the first locked place: walk + e2e step | 2 (sleeping lieutenant), 7 (battle path), 9 (walk) |
| UI1 #17 labels pinned to landmarks, re-map to `hub_camp.webp`; rec. 1–7 | 7 |
| UI1 rec. 8 retire the old top nav | 8 |
| Ledger ruling: camp label overlaps oracle/parchemins and dossier/cabin fixed by the rebuild; hub e2e asserts `labelOverlaps() == []` for all pairs; final review M19 | 7 |
| Immersion ledger: Stats' « niveau N sur 4 » | 6 |
| Immersion Deferred #1 bestiary codex | 3 |
| Immersion Deferred #7 credits in the cabin | 6 |
| Immersion Deferred #10 the hub's own quest-wall hotspot goes | 7 |
| Immersion Deferred #11 shared `nextStep(camp)` | 1 (logic, library, Delphi), 7 (hub) |
| Immersion Deferred #23 the dragon as a speaker; its painted nest seat | 4 (care voice), 7 (hub seat) |
| Immersion Deferred rec. 3, 4, 7 | 7, 6, 2/7/9 |
| UI3a review recommendation 1 (list-as-objects for the bestiary, journal, trophies) | 3, 5, 6 |

## File map

| File | Responsibility | Task |
|---|---|---|
| `web/src/lib/routes.ts` (+ test), `web/src/lib/world/places.ts` (+ test), `web/src/lib/scene/types.ts` | `war-tent` route, B1 place map, `OVERLAY_TITLES`, scene ids | 1 |
| `web/src/lib/world/scenes/speakers.ts` (+ test) | the dragon as a speaker | 1 |
| `web/src/lib/world/nextStep.ts`, `web/src/lib/world/scenes/{camp,library,delphi}.ts` (+ tests), `scenes/nextStep.test.ts` | B9 | 1 |
| `web/src/lib/world/eris.ts` (+ test), `web/src/components/places/delphi/TabletsPanel.svelte`, `web/src/screens/Dossier.svelte` | B11 `sleepingLine` | 1 |
| `web/src/lib/world/voices.ts` (+ test) | `erisSays`, `VOICES.bestiary` | 1 |
| `web/src/components/scene/Hotspot.svelte` | the painted lock | 1 |
| `web/src/App.svelte`, `web/src/lib/world/scenes/index.ts`, `web/src/registerGuard.test.ts` | B12 staging | 1 |
| `web/e2e/helpers.ts`, `web/e2e/scenes-overlays.spec.ts`, `web/e2e/happy-path.spec.ts`, `web/e2e/grimoire.spec.ts`, `web/e2e/scenes-delphi.spec.ts` | `expectInWorldOverlay` moved; tails deep-link to stats; Pythia glow | 1 |
| `web/src/lib/world/scenes/{war.ts,war.shapes.ts,war.test.ts}`, `web/src/screens/WarTent.svelte`, `web/src/components/places/war/PortraitPanel.svelte`, `web/e2e/scenes-war.spec.ts` | war tent + portrait sheets | 2 |
| `web/src/components/places/war/{DossierPanel,CodexPanel,CodexPagePanel}.svelte` | Éris's file, the bestiary | 3 |
| `web/src/lib/world/scenes/{nest.ts,nest.shapes.ts,nest.test.ts}`, `web/src/screens/Nest.svelte`, `web/src/components/places/nest/CarePanel.svelte`, `web/e2e/scenes-nest.spec.ts` | the nest | 4 |
| `web/src/lib/world/scenes/{cabin.ts,cabin.shapes.ts,cabin.test.ts}`, `web/src/screens/CabinRoom.svelte`, `web/src/components/places/cabin/TrophiesPanel.svelte`, `web/e2e/scenes-cabin.spec.ts` | cabin + trophies | 5 |
| `web/src/components/places/cabin/{JournalPanel,LyrePanel,HeroPanel}.svelte`, `web/src/lib/world/journal.ts` (+ test), `web/src/lib/scene/panelNav.ts` (+ test), `web/src/screens/Camp.svelte` | journal, lyre, hero panel | 6 |
| `web/src/lib/world/scenes/{camp.ts,camp.shapes.ts,camp.test.ts}`, `web/src/lib/world/quests.ts` (+ test), `web/src/screens/Camp.svelte`, `web/e2e/scenes-camp.spec.ts`, `web/e2e/scenes-debug.spec.ts` | the hub on `hub_camp.webp` | 7 |
| `web/src/App.svelte`, `web/src/screens/screens.test.ts`, `web/e2e/scenes-parity.spec.ts` | retire the legacy screens, parity sweep | 8 |
| `web/e2e/world.spec.ts` | migrated step by step | 3, 4, 5, 7 |
| `web/e2e/playability-ui3.spec.ts`, `docs/reviews/ui3/*.png` | the complete walk | 9 |

---

### Task 1: Foundation — the war-tent route, the place map and titles, the dragon as a speaker, one next step, the painted lock, merge staging

**Files:**
- Modify: `web/src/lib/routes.ts`, `web/src/lib/routes.test.ts`, `web/src/lib/scene/types.ts`, `web/src/lib/world/places.ts`, `web/src/lib/world/places.test.ts`
- Create: `web/src/lib/world/scenes/speakers.ts`, `web/src/lib/world/scenes/speakers.test.ts`, `web/src/lib/world/nextStep.ts`, `web/src/lib/world/nextStep.test.ts`
- Modify: `web/src/lib/world/scenes/{camp,library,delphi}.ts` and their tests, `web/src/lib/world/scenes/nextStep.test.ts`
- Modify: `web/src/lib/world/eris.ts`, `web/src/lib/world/eris.test.ts`, `web/src/screens/Dossier.svelte`, `web/src/components/places/delphi/TabletsPanel.svelte`
- Modify: `web/src/lib/world/voices.ts`, `web/src/lib/world/voices.test.ts`
- Modify: `web/src/components/scene/Hotspot.svelte`
- Modify: `web/src/App.svelte`, `web/src/lib/world/scenes/index.ts`, `web/src/registerGuard.test.ts`
- Modify: `web/e2e/helpers.ts`, `web/e2e/scenes-overlays.spec.ts`, `web/e2e/happy-path.spec.ts`, `web/e2e/grimoire.spec.ts`, `web/e2e/scenes-delphi.spec.ts`

**Interfaces:**
- Consumes: `placeFor`, `sceneHref`, `OVERLAY_TITLES`, `SceneId`, `campNextStep`/`nextStepLine`/`campGreeting` (camp.ts), `nearestProphecy`/`prophecyWhen` (`lib/world/prophecy.ts`), `genderFor`/`agree` (eris.ts), `DialogueLine`, `MARK_ICONS.lock`.
- Produces:
  - `RouteName` gains `'war-tent'` (`#/p/:profileId/tente-de-guerre`).
  - `SceneId` = `'camp' | 'title' | 'library' | 'delphi' | 'war' | 'nest' | 'cabin'`.
  - `PlaceId` gains `'war' | 'nest' | 'cabin'`; `PanelId` gains `'dossier' | 'codex' | 'page' | 'portrait' | 'soin' | 'tresors' | 'journal' | 'lyre'`; `OVERLAY_TITLES` names them (B1); `placeFor` implements B1; `sceneHref('war'|'nest'|'cabin', id)`.
  - `speakers.ts`: `dragonSpeaker(d: DragonOut): Omit<DialogueLine, 'text'>`, `dragonSays(d: DragonOut, text: string): DialogueLine`.
  - `nextStep.ts`: `type NextStep = 'battle' | 'first-text' | 'prophecy' | 'scrolls' | null`, `nextStep(camp)`, `HUB_PLACE`, `nextStepLine(camp)`.
  - `eris.ts`: `sleepingLine(key: LieutenantKey): string`, `sleepingCaption(key): string`, `stirringCaption(key): string`; `lockedLine` removed.
  - `voices.ts`: `erisSays(text: string): DialogueLine`; `VOICES.bestiary`; speakers allowed: owl, pythia, eris, dragon.
  - `Hotspot.svelte`: a locked hotspot shows `img.hotspot-lock` (the painted lock) on its plaque.
  - `e2e/helpers.ts`: `expectInWorldOverlay(page, testId, scene, hud, variant, voice)` and `LEGACY_UI` (moved from `scenes-overlays.spec.ts`).

- [ ] **Step 1: Write the failing unit tests**

`web/src/lib/routes.test.ts`: in the test that matches every screen add `expect(matchRoute('#/p/3/tente-de-guerre')).toEqual({ name: 'war-tent', params: { profileId: '3' }, query: {} });`; in the one that builds hrefs add `expect(href('war-tent', { profileId: '3' })).toBe('#/p/3/tente-de-guerre');`.

`web/src/lib/world/places.test.ts`: replace « leaves the battle routes and the places UI3b builds to their current screens » by:

```ts
  it('opens the war tent: the map table, the codex, a codex page and the portrait sheets', () => {
    expect(at('#/p/3/tente-de-guerre')).toEqual({ place: 'war', panel: null });
    expect(at('#/p/3/dossier')).toEqual({ place: 'war', panel: 'dossier' });
    expect(at('#/p/3/bestiaire')).toEqual({ place: 'war', panel: 'codex' });
    expect(at('#/p/3/bestiaire/echo')).toEqual({ place: 'war', panel: 'page' });
    expect(at('#/p/3/monstres/hydre')).toEqual({ place: 'war', panel: 'portrait' });
  });

  it('opens the nest and the cabin, with their overlays', () => {
    expect(at('#/p/3/dragon')).toEqual({ place: 'nest', panel: null });
    expect(at('#/p/3/dragon?panel=soin')).toEqual({ place: 'nest', panel: 'soin' });
    expect(at('#/p/3/dragon?panel=nope')).toEqual({ place: 'nest', panel: null });
    expect(at('#/p/3/cabane')).toEqual({ place: 'cabin', panel: null });
    expect(at('#/p/3/cabane?panel=tresors')).toEqual({ place: 'cabin', panel: 'tresors' });
    expect(at('#/p/3/cabane?panel=heros')).toEqual({ place: 'cabin', panel: 'heros' });
    expect(at('#/p/3/stats')).toEqual({ place: 'cabin', panel: 'journal' });
    expect(at('#/p/3/settings')).toEqual({ place: 'cabin', panel: 'lyre' });
  });

  it('leaves only the battle routes to their legacy screens (UI4)', () => {
    for (const h of ['#/p/3/play/1', '#/p/3/grimoire/1', '#/p/3/eris']) expect(at(h), h).toBeNull();
  });
```

add to « knows the bare scene an overlay closes onto »:

```ts
    expect(sceneHref('war', 3)).toBe('#/p/3/tente-de-guerre');
    expect(sceneHref('nest', 3)).toBe('#/p/3/dragon');
    expect(sceneHref('cabin', 3)).toBe('#/p/3/cabane');
```

and in « names every overlay once… » extend the expected table with:

```ts
      dossier: "Le dossier d'Éris",
      codex: 'Le bestiaire',
      page: 'Le bestiaire',
      portrait: "Les lieutenants d'Éris",
      soin: 'Ton dragon',
      tresors: 'Tes trésors',
      journal: 'Ton journal',
      lyre: 'La lyre',
```

and change its loop to `for (const scene of SCENES)` (import `SCENES` from `./scenes`), skipping the dynamic titles and the targets that open a scene rather than an overlay:

```ts
    // `portrait` and `page` are titled by the lieutenant / the entry itself (B1); a hub place opens a
    // scene, not an overlay.
    const DYNAMIC = new Set(['portrait', 'page']);
    for (const scene of SCENES) {
      for (const h of scene.hotspots) {
        if (!h.target || !h.label) continue;
        const view = placeFor({ name: h.target, params: { profileId: '1', workId: 'w', key: 'hydre', ...h.params }, query: h.query ?? {} });
        if (!view?.panel || DYNAMIC.has(view.panel)) continue;
        const title = OVERLAY_TITLES[view.panel];
        expect(title.startsWith(h.label), `${scene.id}/${h.id}: « ${h.label} » opens « ${title} »`).toBe(true);
      }
    }
```

`web/src/lib/world/scenes/speakers.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { DragonOut } from '../types';
import { dragonSays, dragonSpeaker } from './speakers';

const egg = { name: null, tint: 'bronze', stage: 'egg' } as DragonOut;

describe('the dragon as a speaker (UI1 greeting, reused by every place)', () => {
  it('is « L\'œuf » before it hatches, its name after, « Ton dragon » while unnamed', () => {
    expect(dragonSpeaker(egg)).toEqual({ speaker: 'dragon', name: "L'œuf", portrait: '/art/dragon/dragon_egg_cut.webp', portraitFilter: 'none' });
    expect(dragonSpeaker({ ...egg, stage: 'hatchling' }).name).toBe('Ton dragon');
    expect(dragonSpeaker({ ...egg, stage: 'young', name: 'Braise', tint: 'ecume' })).toMatchObject({
      name: 'Braise',
      portrait: '/art/dragon/dragon_young_cut.webp',
      portraitFilter: 'hue-rotate(190deg) saturate(.9)',
    });
  });

  it('says a line', () => {
    expect(dragonSays(egg, 'Bonjour.')).toMatchObject({ speaker: 'dragon', text: 'Bonjour.' });
  });
});
```

(Check `TINT_FILTERS.ecume` in `lib/world/dragon.ts` and copy its exact value into the test.)

`web/src/lib/world/nextStep.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { CampResponse } from './types';
import { HUB_PLACE, nextStep, nextStepLine } from './nextStep';

function camp(over: Partial<CampResponse> = {}): CampResponse {
  return {
    xp: { total: 40 },
    quests: [],
    prophecies: [],
    oracle: { week: 'w', status: 'chosen', reward_id: null },
    boss: { tier_available: null, tiers_won: [], active_quest_id: null },
    ...over,
  } as unknown as CampResponse;
}
const open = { tier_available: 1, tiers_won: [], active_quest_id: null };
const sealed = { week: 'w', status: 'sealed' as const, reward_id: null };
const prophecy = (days: number) => [{ text_id: 1, title: 'La mer', due_date: '2026-09-29', days_left: days }];
const fresh = { total: 0 } as CampResponse['xp'];

describe('one next step for the whole camp (Ruling B9)', () => {
  it('orders battle, a first text, a prophecy within a week, the sealed scrolls, then nothing', () => {
    expect(nextStep(null)).toBeNull();
    expect(nextStep(camp({ boss: open, xp: fresh, prophecies: prophecy(1), oracle: sealed }))).toBe('battle');
    expect(nextStep(camp({ xp: fresh, prophecies: prophecy(1), oracle: sealed }))).toBe('first-text');
    expect(nextStep(camp({ prophecies: prophecy(7), oracle: sealed }))).toBe('prophecy');
    expect(nextStep(camp({ prophecies: prophecy(8), oracle: sealed }))).toBe('scrolls');
    expect(nextStep(camp())).toBeNull();
  });

  it('never points at a battle already engaged', () => {
    const engaged = camp({ boss: { tier_available: 1, tiers_won: [], active_quest_id: 9 }, quests: [{ id: 9, kind: 'boss', status: 'active' }] as CampResponse['quests'] });
    expect(nextStep(engaged)).toBeNull();
  });

  it('leads each step to one hub place', () => {
    expect(HUB_PLACE).toEqual({ battle: 'boss', 'first-text': 'parchemins', prophecy: 'oracle', scrolls: 'oracle' });
  });

  it('names the same step in the greeting', () => {
    expect(nextStepLine(camp({ boss: open }))).toBe("Le sentier de la bataille est ouvert : Éris t'attend.");
    expect(nextStepLine(camp({ prophecies: prophecy(3) }))).toBe("La Pythie a vu ta prochaine épreuve, dans 3 jours. Viens t'y préparer !");
    expect(nextStepLine(camp({ oracle: sealed }))).toBe("La Pythie t'attend à Delphes : trois rouleaux à ouvrir.");
    expect(nextStepLine(camp({ xp: fresh }))).toBe("Les parchemins t'attendent, sous la tente.");
    expect(nextStepLine(camp())).toBe("Les parchemins t'attendent, sous la tente.");
  });
});
```

(`prophecyWhen` puts no-break spaces in « dans 3 jours »: build the expected string with `prophecyWhen(3)` if the literal does not match.)

`web/src/lib/world/eris.test.ts`: replace the `lockedLine` test by:

```ts
  it('says why a lieutenant sleeps and when it wakes, in the right number (Ruling B11)', () => {
    expect(sleepingLine('protee')).toBe('Protée dort encore. Ses ruses viendront dans une classe plus grande.');
    expect(sleepingLine('sirenes')).toBe('Les Sirènes dorment encore. Leurs ruses viendront dans une classe plus grande.');
    expect([sleepingCaption('protee'), sleepingCaption('sirenes')]).toEqual(['Dort encore', 'Dorment encore']);
    expect([stirringCaption('echo'), stirringCaption('sirenes')]).toEqual(["S'agite", "S'agitent"]);
  });
```

`web/src/lib/world/voices.test.ts`: the speaker list becomes `['owl', 'pythia', 'eris', 'dragon']`; add:

```ts
  it('lets Éris speak in the war tent with her smug portrait', () => {
    expect(erisSays('Dossier ouvert.')).toEqual({ speaker: 'eris', name: 'Éris', portrait: '/art/characters/eris_smug_cut.webp', text: 'Dossier ouvert.' });
    expect(VOICES.bestiary.speaker).toBe('owl');
  });
```

`web/src/lib/world/scenes/delphi.test.ts`, `library.test.ts` and `camp.test.ts`: change the glow expectations to B9:
- Delphi: `state('pythia', camp())` (the helper's camp has no `xp`: give it `xp: { total: 40 }` and `prophecies: []`) is `{ isNew: true, caption: 'Trois rouleaux à ouvrir' }`; with `xp: { total: 0 }` it is `{ isNew: false, caption: 'Trois rouleaux à ouvrir' }`; with the week chosen and a prophecy in 2 days it is `isNew: true`.
- Library: unchanged expectations (`xp 0` glows, `xp 40` does not), plus: with a battle open and `xp 0` impossible, so no new case.
- Camp: `campNextStep` now returns `HUB_PLACE[nextStep(camp)] ?? null`: keep its cases and add `campNextStep(camp({ xp: mid, prophecies: [{ text_id: 1, title: 'x', due_date: '2026-09-29', days_left: 2 }], oracle: chosen }))` → `'oracle'`. The greeting test's third line for a fresh hero stays « Les parchemins t'attendent, sous la tente. ».

`web/src/lib/world/scenes/nextStep.test.ts` (the one-glow sweep): add two fixtures, a hero whose week is chosen with a prophecy due in 2 days, and a battle open with a prophecy due tomorrow. Everything else stays (Tasks 2, 4, 5 and 7 add their scenes to its list).

Run: `scripts/npm.sh run test -- src/lib/routes.test.ts src/lib/world/places.test.ts src/lib/world/scenes/speakers.test.ts src/lib/world/nextStep.test.ts src/lib/world/eris.test.ts src/lib/world/voices.test.ts src/lib/world/scenes/`
Expected: FAIL (`war-tent` unmatched, missing modules and exports, new glow rules).

- [ ] **Step 2: Route, scene ids, place map, titles**

`web/src/lib/routes.ts`: add `| 'war-tent'` to `RouteName`, the pattern `{ name: 'war-tent', segments: ['p', { param: 'profileId' }, 'tente-de-guerre'] },` after `delphi`, and in `href()`:

```ts
      case 'war-tent':
        return `#/p/${params.profileId}/tente-de-guerre`;
```

`web/src/lib/scene/types.ts`: `export type SceneId = 'camp' | 'title' | 'library' | 'delphi' | 'war' | 'nest' | 'cabin';`

`web/src/lib/world/places.ts`:
- `export type PlaceId = 'title' | 'camp' | 'library' | 'delphi' | 'war' | 'nest' | 'cabin';`
- `PanelId` gains `| 'dossier' | 'codex' | 'page' | 'portrait' | 'soin' | 'tresors' | 'journal' | 'lyre'`;
- `OVERLAY_TITLES` gains the eight entries of Step 1;
- `placeFor`, before `default`:

```ts
    case 'war-tent':
      return { place: 'war', panel: null };
    case 'dossier':
      return { place: 'war', panel: 'dossier' };
    case 'bestiaire':
      return { place: 'war', panel: 'codex' };
    case 'bestiaire-entry':
      return { place: 'war', panel: 'page' };
    case 'lieutenant':
      return { place: 'war', panel: 'portrait' };
    case 'dragon':
      return { place: 'nest', panel: route.query.panel === 'soin' ? 'soin' : null };
    case 'cabin': {
      const p = route.query.panel;
      return { place: 'cabin', panel: p === 'tresors' || p === 'heros' ? p : null };
    }
    case 'stats':
      return { place: 'cabin', panel: 'journal' };
    case 'settings':
      return { place: 'cabin', panel: 'lyre' };
```

- `sceneHref`:

```ts
    case 'war':
      return href('war-tent', p);
    case 'nest':
      return href('dragon', p);
    case 'cabin':
      return href('cabin', p);
```

- the header comment's last sentence becomes « Routes that return null still render their legacy screen (the battle routes, until UI4). ».

`App.svelte` keeps rendering the legacy screens for these routes until their task lands: it has no `war`/`nest`/`cabin` place branch yet, so those views fall through to the `route.name` branches (Step 7 fences them).

- [ ] **Step 3: The dragon as a speaker**

`web/src/lib/world/scenes/speakers.ts`:

```ts
// The dragon narrates (scenes UI spec §2.5): its name, or « L'œuf » before it hatches, and its own
// tinted cut-out as the dialogue portrait (carry rec. 7: the same image as its scene layer). Used by
// the camp's greeting, the war tent's locked sheets, the hub's locked path and the nest.
import { ART } from '../art';
import { TINT_FILTERS } from '../dragon';
import type { DragonOut } from '../types';
import type { DialogueLine } from '../../scene/types';

export function dragonSpeaker(d: DragonOut): Omit<DialogueLine, 'text'> {
  return {
    speaker: 'dragon',
    name: d.name ?? (d.stage === 'egg' ? "L'œuf" : 'Ton dragon'),
    portrait: ART.dragon[d.stage],
    portraitFilter: TINT_FILTERS[d.tint],
  };
}

export function dragonSays(d: DragonOut, text: string): DialogueLine {
  return { ...dragonSpeaker(d), text };
}
```

- [ ] **Step 4: One next step (Ruling B9)**

`web/src/lib/world/nextStep.ts`:

```ts
// The one next step of the game (UI3a playability recommendation 5, immersion Deferred #11, UI3
// Ruling B9): the hub's glow, the greeting's last line and each place's glow all read it, so the hub
// and the place never disagree on where to go.
import type { CampResponse } from './types';
import { nearestProphecy, prophecyWhen } from './prophecy';

export type NextStep = 'battle' | 'first-text' | 'prophecy' | 'scrolls' | null;

const bossEngaged = (camp: CampResponse) => camp.quests.some((q) => q.kind === 'boss' && q.status === 'active');

/** A battle ready to be fought (rare, earned, it waits for nothing else), then a new hero's first
 *  text, then a prophecy falling due within a week, then the week's sealed scrolls. */
export function nextStep(camp: CampResponse | null): NextStep {
  if (!camp) return null;
  if (camp.boss.tier_available !== null && !bossEngaged(camp)) return 'battle';
  if (camp.xp.total === 0) return 'first-text';
  const p = nearestProphecy(camp);
  if (p && p.days_left <= 7) return 'prophecy';
  if (camp.oracle.status === 'sealed') return 'scrolls';
  return null;
}

/** The hub place each step leads to (CAMP_HOTSPOTS ids). */
export const HUB_PLACE = {
  battle: 'boss',
  'first-text': 'parchemins',
  prophecy: 'oracle',
  scrolls: 'oracle',
} as const satisfies Record<Exclude<NextStep, null>, string>;

/** The greeting's last line names the same step. */
export function nextStepLine(camp: CampResponse): string {
  switch (nextStep(camp)) {
    case 'battle':
      return "Le sentier de la bataille est ouvert : Éris t'attend.";
    case 'prophecy':
      return `La Pythie a vu ta prochaine épreuve, ${prophecyWhen(nearestProphecy(camp)!.days_left)}. Viens t'y préparer !`;
    case 'scrolls':
      return "La Pythie t'attend à Delphes : trois rouleaux à ouvrir.";
    default:
      return "Les parchemins t'attendent, sous la tente.";
  }
}
```

In `web/src/lib/world/scenes/camp.ts`:
- delete the local `nextStepLine` and `bossEngaged`'s use in it; import `HUB_PLACE`, `nextStep`, `nextStepLine` from `../nextStep` and re-export `nextStepLine` (`export { nextStepLine } from '../nextStep';`) for the existing callers;
- `campNextStep` becomes `return camp ? (nextStep(camp) ? HUB_PLACE[nextStep(camp)!] : null) : null;` (type `'boss' | 'parchemins' | 'oracle' | null`), with its comment rewritten to point at Ruling B9;
- `campGreeting`'s local `who` becomes `const who = dragonSpeaker(d);` (import from `./speakers`; drop the now unused `TINT_FILTERS` import).

In `web/src/lib/world/scenes/library.ts`, the shelves' state becomes `st({ isNew: nextStep(camp) === 'first-text', caption: camp !== null && camp.xp.total === 0 ? 'Choisis un texte à défendre' : null })` (import `nextStep` from `../nextStep`).

In `web/src/lib/world/scenes/delphi.ts`, the Pythia's state becomes:

```ts
    state: ({ camp }) => {
      if (!camp) return st();
      const step = nextStep(camp);
      const glow = step === 'prophecy' || step === 'scrolls';
      return camp.oracle.status === 'sealed' ? st({ isNew: glow, caption: 'Trois rouleaux à ouvrir' }) : st({ isNew: glow, caption: 'Quête en cours' });
    },
```

- [ ] **Step 5: The lieutenants' sleep in words (Ruling B11), Éris's voice, the bestiary's owl**

`web/src/lib/world/eris.ts`: replace `lockedLine` by:

```ts
/** Why a lieutenant still sleeps and when it wakes (UI3 Ruling B11): the server wakes each one at
 *  its `min_level` (catalog.py), so the child learns it comes with a bigger class. One source for
 *  the war tent's locked sheets, the dossier's sleeping rows and the quest wall's asleep tablets. */
export function sleepingLine(key: LieutenantKey): string {
  const name = NAMES[key];
  return GENDER[key] === 'fp'
    ? `${name} dorment encore. Leurs ruses viendront dans une classe plus grande.`
    : `${name} dort encore. Ses ruses viendront dans une classe plus grande.`;
}

/** The short caption on a locked sheet or tablet. */
export function sleepingCaption(key: LieutenantKey): string {
  return GENDER[key] === 'fp' ? 'Dorment encore' : 'Dort encore';
}

/** The short caption of a lieutenant that stirs again (a revenge quest waits). */
export function stirringCaption(key: LieutenantKey): string {
  return GENDER[key] === 'fp' ? "S'agitent" : "S'agite";
}
```

with, next to `GENDER`, the camp's names (catalog.py `LIEUTENANTS[*].name`, static like `GENDER` so the module stays store-free):

```ts
const NAMES: Record<LieutenantKey, string> = {
  hydre: "L'Hydre",
  echo: 'Écho',
  chimere: 'La Chimère',
  protee: 'Protée',
  sirenes: 'Les Sirènes',
  lethe: 'Léthé',
};

/** A lieutenant's name as the camp says it. */
export function lieutenantName(key: LieutenantKey): string {
  return NAMES[key];
}
```

In `web/src/screens/Dossier.svelte`, `{lockedLine(nameFor(key))}` → `{sleepingLine(key)}` (import it, drop `lockedLine`). In `web/src/components/places/delphi/TabletsPanel.svelte`, the asleep tablet's `<p class="tablet-note">Dort encore. Son heure viendra.</p>` → `<p class="tablet-note">{sleepingLine(key)}</p>` (import from `../../../lib/world/eris`).

`web/src/lib/world/voices.ts`: add after `pythia`:

```ts
/** Éris speaks in her war tent (UI3 Ruling B10): lines built from live data (her dossier lines). */
export function erisSays(text: string): DialogueLine {
  return { speaker: 'eris', name: 'Éris', portrait: ART.erisSmug, text };
}
```

and in `VOICES`:

```ts
  // UI3b: the owl keeps the bestiary (the old subtitle, immersion Ruling W2).
  bestiary: owl("Hou ! Chaque page raconte d'abord le vrai mythe. Ce que le camp en a fait est écrit à part, sous « Au camp »."),
```

- [ ] **Step 6: The painted lock on a locked plaque**

In `web/src/components/scene/Hotspot.svelte`, import `MARK_ICONS` from `../../lib/world/art`, and inside `.hotspot-name`, before the optional `def.icon` image:

```svelte
          {#if status.locked}<img class="hotspot-icon hotspot-lock" src={MARK_ICONS.lock} alt="" draggable="false" />{/if}
```

and in `<style>`:

```css
  /* UI1 carry #16: a locked place shows the painted lock on its plaque (and keeps its grey glow). */
  .label-on .hotspot-lock {
    width: 16px;
    height: 16px;
  }
```

(The screen-reader text « (fermé pour l'instant) » stays.)

- [ ] **Step 7: Merge staging (Ruling B12)**

`web/src/App.svelte`: regroup the legacy screen imports and branches into one fenced block per place, in this order, each block separated from the next by a comment line (no code change, only order and comments):

```svelte
  // --- UI3b lane W (Tasks 2-3) replaces this block with WarTent ---
  import Dossier from './screens/Dossier.svelte';
  import Bestiaire from './screens/Bestiaire.svelte';
  import BestiaireEntry from './screens/BestiaireEntry.svelte';
  import Lieutenant from './screens/Lieutenant.svelte';
  // --- UI3b Task 4 replaces this block with Nest ---
  import DragonScreen from './screens/DragonScreen.svelte';
  // --- UI3b Tasks 5-6 replace this block with CabinRoom ---
  import Cabin from './screens/Cabin.svelte';
  import Stats from './screens/Stats.svelte';
  import Settings from './screens/Settings.svelte';
  // --- end of the UI3b blocks ---
```

and, in the markup, after the `delphi` place branch:

```svelte
      <!-- UI3b lane W (Tasks 2-3) replaces this block with the war place branch. -->
      {:else if route.name === 'dossier'}
        <Dossier profile={gateProfile} />
      {:else if route.name === 'bestiaire'}
        <Bestiaire profile={gateProfile} />
      {:else if route.name === 'bestiaire-entry'}
        <BestiaireEntry profile={gateProfile} entryKey={route.params.key} />
      {:else if route.name === 'lieutenant'}
        <Lieutenant profile={gateProfile} lieutenantKey={route.params.key} />
      <!-- UI3b Task 4 replaces this block with the nest place branch. -->
      {:else if route.name === 'dragon'}
        <DragonScreen profile={gateProfile} />
      <!-- UI3b Tasks 5-6 replace this block with the cabin place branch. -->
      {:else if route.name === 'cabin'}
        <Cabin profile={gateProfile} />
      {:else if route.name === 'stats'}
        <Stats profile={gateProfile} />
      {:else if route.name === 'settings'}
        <Settings profile={gateProfile} />
      <!-- End of the UI3b blocks: the battle screens below stay until UI4. -->
      {:else if route.name === 'play'}
```

(An HTML comment before an `{:else if}` is part of the previous branch's content, so it renders nothing and changes no behaviour; it only gives each lane its own hunk.)

`web/src/lib/world/scenes/index.ts`:

```ts
// Registry of every scene definition. UI3b lanes each add their own line inside their fence.
import type { SceneDef } from '../../scene/types';
import { CAMP_SCENE } from './camp';
import { DELPHI_SCENE } from './delphi';
import { LIBRARY_SCENE } from './library';
import { TITLE_SCENE } from './title';
// --- lane W (Task 2): import { WAR_SCENE } from './war';

// --- lane H (Task 4): import { NEST_SCENE } from './nest';

// --- lane H (Task 5): import { CABIN_SCENE } from './cabin';

/** Scenes UI spec §4: "≤ 600 KB WebP per scene background". */
export const SCENE_BUDGET_BYTES = 600 * 1024;

export const SCENES: SceneDef[] = [
  CAMP_SCENE,
  TITLE_SCENE,
  LIBRARY_SCENE,
  DELPHI_SCENE,
  // --- lane W (Task 2): WAR_SCENE,

  // --- lane H (Task 4): NEST_SCENE,

  // --- lane H (Task 5): CABIN_SCENE,
];
```

`web/src/registerGuard.test.ts`: the file list scans every place screen, not a hand-kept list, so each lane's new screen is covered without editing the list:

```ts
// The legacy screens UI3b is moving into the places still use the old words; each task deletes its
// line when the screen moves (the list may only shrink; a path that no longer exists fails below).
const PENDING = new Set<string>(['src/screens/Stats.svelte']);
const BATTLE = new Set(['src/screens/Play.svelte', 'src/screens/Boss.svelte']); // UI4

const FILES = [
  ...walk('src/components/places'),
  'src/components/PinGate.svelte',
  'src/components/QuestCard.svelte',
  'src/components/ui/LevelMedallions.svelte',
  ...walk('src/screens').filter((f) => !BATTLE.has(f) && !PENDING.has(f)),
  ...walk('src/lib/world'),
  'src/lib/library/shelf.ts',
];
```

and add a test:

```ts
  it('keeps the pending list honest (UI3b)', () => {
    for (const f of PENDING) expect(existsSync(f), `${f} moved: remove it from PENDING`).toBe(true);
  });
```

(import `existsSync`). Run the guard now: every other legacy screen must already pass. If one does not, fix its copy in this task.

`web/e2e/helpers.ts`: move `LEGACY` (renamed `LEGACY_UI`, exported) and `expectInWorldOverlay` from `scenes-overlays.spec.ts` into `helpers.ts`, unchanged; `scenes-overlays.spec.ts` imports them. Rewrite the sweep's comment: « the camp's hero panel moves to the cabin in UI3b: its row lives in scenes-cabin.spec.ts ». Each UI3b place spec calls `expectInWorldOverlay` for its own overlays.

`web/e2e/happy-path.spec.ts` and `web/e2e/grimoire.spec.ts`: the tail after `btn-back-camp` no longer walks through the hero panel and the dossier (Tasks 3 and 6 change both, in two lanes). It deep-links to the journal route, which exists in every state of the branch:

```ts
  // The stats reflect the session (the journal route; the hero panel and the dossier that lead to it
  // are covered by scenes-cabin and scenes-war).
  await page.getByTestId('btn-back-camp').click();
  await expectCamp(page);
  await page.goto(`/#/p/${profileId}/stats`);
```

followed by the spec's existing text assertions. (Read each spec for how it knows its profile id; `happy-path` creates its hero through the UI, so read the id from the URL as `world.spec.ts` step 1 does.)

`web/e2e/scenes-delphi.spec.ts`, « the hub path leads to the temple… »: a fresh hero's next step is the tent (B9), so `delphi-pythia` must `not.toHaveClass(/is-new/)` there and still read « Trois rouleaux à ouvrir ». Add after it:

```ts
test('the Pythia glows once the tent is behind her: the sealed scrolls are the next step', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const text = await createText(request, { title: uniqueName(`Delphes ${testInfo.project.name}`), body: BODY, level: '10H' });
  await postSession(request, { profileId: id, textId: text.id, day: '2026-08-03', result: makeResult({ draft: 4, caught: 2, category: 'homophone' }) });
  await openTemple(page, id);
  await page.getByTestId('dialogue-skip').click();
  await expect(page.getByTestId('delphi-pythia')).toHaveClass(/is-new/);
});
```

(import `makeResult`, `postSession` if missing).

- [ ] **Step 8: Verify**

Run: `scripts/npm.sh run test` — Expected: all pass (the camp greeting and the one-glow sweep prove the refactor).
Run: `scripts/npm.sh run check` — Expected: `0 errors and 0 warnings`.
Run: `scripts/playwright.sh scenes-delphi --repeat-each=3` and `scripts/playwright.sh scenes-overlays happy-path grimoire scenes-camp` — Expected: all pass on both projects where they run.
Run: `PW_WORKERS=4 scripts/check.sh` — Expected: `== ALL GREEN` (B1's full gate).

- [ ] **Step 9: Commit**

```bash
P="web/src/lib/routes.ts web/src/lib/routes.test.ts web/src/lib/scene/types.ts web/src/lib/world/places.ts web/src/lib/world/places.test.ts web/src/lib/world/scenes/speakers.ts web/src/lib/world/scenes/speakers.test.ts web/src/lib/world/nextStep.ts web/src/lib/world/nextStep.test.ts web/src/lib/world/scenes/camp.ts web/src/lib/world/scenes/camp.test.ts web/src/lib/world/scenes/library.ts web/src/lib/world/scenes/library.test.ts web/src/lib/world/scenes/delphi.ts web/src/lib/world/scenes/delphi.test.ts web/src/lib/world/scenes/nextStep.test.ts web/src/lib/world/scenes/index.ts web/src/lib/world/eris.ts web/src/lib/world/eris.test.ts web/src/lib/world/voices.ts web/src/lib/world/voices.test.ts web/src/screens/Dossier.svelte web/src/components/places/delphi/TabletsPanel.svelte web/src/components/scene/Hotspot.svelte web/src/App.svelte web/src/registerGuard.test.ts web/e2e/helpers.ts web/e2e/scenes-overlays.spec.ts web/e2e/happy-path.spec.ts web/e2e/grimoire.spec.ts web/e2e/scenes-delphi.spec.ts"
git add $P
git commit -m "UI3b: war-tent route and place map, overlay titles, the dragon as a speaker, one next step, the painted lock, merge staging

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- $P
```

### Task 2: The war tent and the lieutenants' portrait sheets (the first locked places) — lane W

**Files:**
- Create: `web/src/lib/world/scenes/war.shapes.ts`, `web/src/lib/world/scenes/war.ts`, `web/src/lib/world/scenes/war.test.ts`, `web/src/screens/WarTent.svelte`, `web/e2e/scenes-war.spec.ts`
- Move: `web/src/screens/Lieutenant.svelte` → `web/src/components/places/war/PortraitPanel.svelte` (`git mv`)
- Modify: `web/src/lib/world/scenes/index.ts` (lane W fence), `web/src/lib/world/scenes/nextStep.test.ts`, `web/src/App.svelte` (lane W fence), `web/e2e/world.spec.ts` (step 3's lieutenant lines only if needed)

**Interfaces:**
- Consumes: Task 1 (`placeFor` → `{ place: 'war', panel }`, `sceneHref('war')`, `dragonSays`, `sleepingLine`, `sleepingCaption`, `stirringCaption`, `lieutenantName`, `erisSays`, the painted lock, `expectInWorldOverlay`), `PlaceScene` (`greet`, `say`, `bind:debug`), `Hotspot` (`onLocked`), `Overlay` (`variant`, `size`, `voice`, `returnFocus`), `openHotspot`, `closePanel`, `hotspotSelector`, `campFor`, `agree`, `bandFor`, `dossierLine`, `longDate`, `LIEUTENANT_ORDER`, `LieutenantKey`, `ART.lieutenants`, `ART.scenes.warTent`.
- Produces:
  - `war.ts`: `LIEUTENANT_NAMES: Record<LieutenantKey, string>` (from `lieutenantName`), `isLieutenantKey(k: string): k is LieutenantKey`, `WAR_HOTSPOTS: HotspotDef[]` (ids `hydre`…`lethe` → `lieutenant` with `params.key`, `labelPos: 'on'`; `dossier` → `dossier`; `bestiary` → `bestiaire`), `WAR_SCENE: SceneDef` (id `war`, plaque « La tente de guerre », preload the hub and nothing else).
  - `WarTent.svelte` props `{ profile: Profile; panel: PanelId | null; params: Record<string, string> }`; test ids `scene-war`, `war-<key>`, `war-dossier`, `war-bestiary`, `war-sheet-<key>`, `overlay-portrait` (Task 3 adds `overlay-dossier`, `overlay-codex`, `overlay-codex-page`).
  - `PortraitPanel.svelte` props `{ profile: Profile; lieutenantKey: string }`; test ids kept: `lieutenant-gauge-days`, `lieutenant-gauge-traps`, `lieutenant-rate`, `lieutenant-quest`, `lieutenant-grimoire`, `lieutenant-text-*`, `lieutenant-neutralised`.

- [ ] **Step 1: Write the failing scene-data test**

`web/src/lib/world/scenes/war.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { validateScene } from '../../scene/validate';
import type { CampResponse, LieutenantState } from '../types';
import { LIEUTENANT_NAMES, WAR_HOTSPOTS, WAR_SCENE, isLieutenantKey } from './war';

const lt = (key: string, over: Partial<LieutenantState> = {}) =>
  ({ key, name: key, available: true, neutralised: false, stirring: false, active_quest_id: null, ...over }) as LieutenantState;
const state = (id: string, lieutenants: LieutenantState[]) =>
  WAR_HOTSPOTS.find((h) => h.id === id)!.state({ camp: { lieutenants } as CampResponse, catalog: null });

describe('war tent (UI3 Ruling B4)', () => {
  it('is a valid scene whose plaque echoes the hub label', () => {
    expect(validateScene(WAR_SCENE)).toEqual([]);
    expect(WAR_SCENE).toMatchObject({ id: 'war', title: 'La tente de guerre', background: '/art/scenes/war_tent.webp' });
    expect(WAR_SCENE.preload).toEqual(['/art/scenes/hub_camp.webp']);
  });

  it('pins the six lieutenants to their sheets, the file to the map table, the codex to the lectern', () => {
    expect(WAR_HOTSPOTS.map((h) => [h.id, h.target, h.params?.key ?? null, h.labelPos])).toEqual([
      ['hydre', 'lieutenant', 'hydre', 'on'],
      ['echo', 'lieutenant', 'echo', 'on'],
      ['chimere', 'lieutenant', 'chimere', 'on'],
      ['protee', 'lieutenant', 'protee', 'on'],
      ['sirenes', 'lieutenant', 'sirenes', 'on'],
      ['lethe', 'lieutenant', 'lethe', 'on'],
      ['dossier', 'dossier', null, 'above'],
      ['bestiary', 'bestiaire', null, 'above'],
    ]);
    expect(WAR_HOTSPOTS.map((h) => h.label).slice(-2)).toEqual(["Le dossier d'Éris", 'Le bestiaire']);
    expect(LIEUTENANT_NAMES.protee).toBe('Protée');
    expect([isLieutenantKey('echo'), isLieutenantKey('eris')]).toEqual([true, false]);
  });

  it('locks a sleeping lieutenant, inks a foiled one, marks a quest', () => {
    expect(state('protee', [lt('protee', { available: false })])).toMatchObject({ locked: true, caption: 'Dort encore' });
    expect(state('sirenes', [lt('sirenes', { available: false })])).toMatchObject({ locked: true, caption: 'Dorment encore' });
    expect(state('hydre', [lt('hydre', { neutralised: true })])).toMatchObject({ caption: 'Neutralisée' });
    expect(state('protee', [lt('protee', { neutralised: true })])).toMatchObject({ caption: 'Neutralisé' });
    expect(state('chimere', [lt('chimere', { active_quest_id: 4 })])).toMatchObject({ caption: 'Quête en cours' });
  });

  it('glows on the first stirring lieutenant only (W14)', () => {
    const both = [lt('echo', { stirring: true }), lt('lethe', { stirring: true })];
    expect(state('echo', both)).toMatchObject({ isNew: true, caption: "S'agite" });
    expect(state('lethe', both)).toMatchObject({ isNew: false, caption: "S'agite" });
  });
});
```

In `web/src/lib/world/scenes/nextStep.test.ts` add `WAR_SCENE` to the swept scenes and a fixture with two stirring lieutenants (`lieutenants: [{ key: 'echo', stirring: true, available: true }, { key: 'lethe', stirring: true, available: true }]`).

Run: `scripts/npm.sh run test -- src/lib/world/scenes/war.test.ts` — Expected: FAIL (`Cannot find module './war'`).

- [ ] **Step 2: Scene data**

`web/src/lib/world/scenes/war.shapes.ts`:

```ts
// Hotspot geometry of the war tent (war_tent.webp), art % of the 16:9 frame, authored by hand from
// docs/art/scenes.md (six blank sheets: columns x 21.5-27.5 / 30-36 / 39-45, rows y 22-37 / 40-55;
// the map table's hotspot kept above y 78; the lectern and its codex x 69-85) and checked with `?debug`.
import type { ShapeMap } from '../../scene/types';

export const WAR_SHAPES = {
  hydre: { kind: 'polygon', points: [[21.5, 22], [27.5, 22], [27.5, 37], [21.5, 37]] },
  echo: { kind: 'polygon', points: [[30, 22], [36, 22], [36, 37], [30, 37]] },
  chimere: { kind: 'polygon', points: [[39, 22], [45, 22], [45, 37], [39, 37]] },
  protee: { kind: 'polygon', points: [[21.5, 40], [27.5, 40], [27.5, 55], [21.5, 55]] },
  sirenes: { kind: 'polygon', points: [[30, 40], [36, 40], [36, 55], [30, 55]] },
  lethe: { kind: 'polygon', points: [[39, 40], [45, 40], [45, 55], [39, 55]] },
  dossier: { kind: 'polygon', points: [[20, 64], [66, 64], [68, 78], [18, 78]] },
  bestiary: { kind: 'polygon', points: [[69, 42], [85, 42], [85, 78], [69, 78]] },
} satisfies ShapeMap;
```

`web/src/lib/world/scenes/war.ts`:

```ts
// The war tent (scenes UI spec §3 "War tent scene", UI3 Ruling B4): the lieutenants' portraits
// pinned to the canvas (a sheet opens the lieutenant's page), the map table (Éris's file) and the
// bestiary codex on its lectern. A lieutenant still asleep at the hero's class is a locked place.
import { ART } from '../art';
import { agree, lieutenantName, sleepingCaption, stirringCaption } from '../eris';
import { LIEUTENANT_ORDER, type LieutenantKey } from '../types';
import { IDLE_HOTSPOT, type HotspotDef, type HotspotState, type SceneContext, type SceneDef } from '../../scene/types';
import { WAR_SHAPES } from './war.shapes';

const st = (p: Partial<HotspotState> = {}): HotspotState => ({ ...IDLE_HOTSPOT, ...p });

export const LIEUTENANT_NAMES = Object.fromEntries(LIEUTENANT_ORDER.map((k) => [k, lieutenantName(k)])) as Record<LieutenantKey, string>;

export function isLieutenantKey(k: string): k is LieutenantKey {
  return (LIEUTENANT_ORDER as readonly string[]).includes(k);
}

function sheetState(key: LieutenantKey) {
  return ({ camp }: SceneContext): HotspotState => {
    const l = camp?.lieutenants.find((x) => x.key === key);
    if (!l) return st();
    if (!l.available) return st({ locked: true, caption: sleepingCaption(key) });
    if (l.neutralised) return st({ caption: agree('Neutralisé', key) });
    if (l.stirring) {
      // W14: one glow per scene - the first lieutenant who stirs, in the camp's order.
      const first = camp!.lieutenants.find((x) => x.stirring && x.available && !x.neutralised)?.key;
      return st({ isNew: first === key, caption: stirringCaption(key) });
    }
    if (l.active_quest_id !== null) return st({ caption: 'Quête en cours' });
    return st();
  };
}

export const WAR_HOTSPOTS: HotspotDef[] = [
  ...LIEUTENANT_ORDER.map(
    (key): HotspotDef => ({
      id: key,
      label: LIEUTENANT_NAMES[key],
      target: 'lieutenant',
      params: { key },
      shape: WAR_SHAPES[key],
      labelPos: 'on',
      state: sheetState(key),
    }),
  ),
  { id: 'dossier', label: "Le dossier d'Éris", target: 'dossier', shape: WAR_SHAPES.dossier, labelPos: 'above', leader: true, state: () => st() },
  { id: 'bestiary', label: 'Le bestiaire', target: 'bestiaire', shape: WAR_SHAPES.bestiary, labelPos: 'above', leader: true, state: () => st() },
];

export const WAR_SCENE: SceneDef = {
  id: 'war',
  title: 'La tente de guerre',
  background: ART.scenes.warTent,
  layers: [],
  hotspots: WAR_HOTSPOTS,
  ambience: { particles: 'dust', music: null },
  narrator: { enter: 'war.enter', firstVisit: 'war.first' },
  // The only way out is the camp (final review M8).
  preload: [ART.scenes.hubCamp],
};
```

(If the sleeping lieutenant's state would still glow because `stirring` is set on an unavailable one, the `available` check above already returns first.)

In `web/src/lib/world/scenes/index.ts`, inside lane W's fences, uncomment the import and `WAR_SCENE,` lines.

Run: `scripts/npm.sh run test -- src/lib/world/scenes/` — Expected: PASS (war, the one-glow sweep, the budget over `SCENES`).

- [ ] **Step 3: The portrait sheet panel**

```bash
mkdir -p web/src/components/places/war
git mv web/src/screens/Lieutenant.svelte web/src/components/places/war/PortraitPanel.svelte
sed -i "s#'\.\./components/#'../../#g; s#'\.\./lib/#'../../../lib/#g" web/src/components/places/war/PortraitPanel.svelte
```

Restyle `PortraitPanel.svelte` as a sheet the scroll hands over (logic, state and API calls stay as they are):
- delete the `TopBar` import and element; the outer `<div class="screen">` → `<div class="panel-portrait">`;
- Éris's line leaves the panel: `WarTent` gives it to the overlay's voice plate (B10), so delete `<p class="eris-line">…</p>` and the now unused `dossierLine` import (keep `bandFor` only if still used);
- the portrait header: `<div class="scene header" …>` → `<figure class="portrait-plate" style="background-image:url({ART.scenes.battle})"><img src={art} alt={name} class="portrait" /></figure>` (drop the `wobble-hover` class and its rule); rule `.portrait-plate { position: relative; overflow: hidden; margin: 0; height: 200px; display: flex; align-items: center; justify-content: center; border-radius: var(--kit-radius); background-size: cover; background-position: center bottom; box-shadow: inset 0 0 0 2px rgba(92, 64, 24, 0.35); }`;
- the neutralised banner: `<div class="kit-sheet neutralised-banner" data-testid="lieutenant-neutralised">` with the `Medallion` and `<p>{agree('Neutralisé', lieutenantKey as LieutenantKey)} le {longDate((lieutenantState.neutralised_at ?? '').slice(0, 10))}</p>` (import `longDate` from `../../../lib/text/french`; delete `neutralisedDate()`);
- the stirring line: `<p class="kit-note" data-tone="eris">{name} {stirringCaption(lieutenantKey as LieutenantKey).toLowerCase()} à nouveau. Une quête de revanche ?</p>` → reads « Écho s'agite à nouveau. Une quête de revanche ? » (import `stirringCaption`);
- the gauges become three `kit-gauge`s (the track and fill of `kit-objects.css`, no word band), `data-state="ok"` once reached:

```svelte
      <div class="gauges">
        <div class="kit-gauge" data-testid="lieutenant-gauge-days" data-state={days >= 3 ? 'ok' : 'short'} style:--fill="{Math.min(100, (days / 3) * 100)}%">
          <span class="kit-gauge-label">Jours de défense : {days}/3</span>
          <span class="kit-gauge-track"><span class="kit-gauge-fill"></span></span>
        </div>
        <div class="kit-gauge" data-testid="lieutenant-gauge-traps" data-state={traps >= 10 ? 'ok' : 'short'} style:--fill="{Math.min(100, (traps / 10) * 100)}%">
          <span class="kit-gauge-label">Pièges rencontrés : {traps}/10</span>
          <span class="kit-gauge-track"><span class="kit-gauge-fill"></span></span>
        </div>
        <div class="kit-gauge" data-testid="lieutenant-rate" data-state={(rate ?? 0) >= 0.8 ? 'ok' : 'short'} style:--fill="{Math.min(100, Math.round((rate ?? 0) * 100))}%">
          <span class="kit-gauge-label">Pièges déjoués : {pct(rate)}, il en faut 80 %</span>
          <span class="kit-gauge-track"><span class="kit-gauge-fill"></span><span class="target-mark" style="left:80%" aria-hidden="true"></span></span>
        </div>
      </div>
```

  with `const days = $derived(lieutenantState?.window.days ?? 0)`, `traps`, `rate` likewise, and `.target-mark { position: absolute; top: -3px; bottom: -3px; width: 2px; background: var(--gold); }` (the track needs `overflow: visible` in this panel: `.gauges .kit-gauge-track { overflow: visible; }`). Use no-break spaces before « % » as `pct` already does elsewhere (` `/` ` as in Results; keep the existing `pct` and fix its space if it is a plain one);
- errors: `<p class="kit-note" data-tone="eris" role="alert">{questError}</p>`; toast: `<p class="kit-note" role="status">{toast}</p>` (text stays « Quête affichée au mur. »);
- actions: « Lancer une quête » / « Quête en cours » is `class="kit-bronze"`; the reward line `<p class="reward-line">Récompense : {questXp} XP et une page du bestiaire</p>` with `.reward-line { margin: 0; color: var(--reward-ink); font-weight: 600; }`; « Ouvrir son grimoire corrompu » is `class="kit-bronze is-quiet"`;
- « Textes conseillés » becomes `<h3 class="kit-section">Textes conseillés</h3>`; its empty line stays `<p class="muted">Lance une quête pour recevoir trois textes conseillés.</p>`; each text is a tag on a cord, no grade code:

```svelte
              <li>
                <a class="kit-tag" data-testid="lieutenant-text-{t.id}" href={playHref(t)}>
                  <span class="kit-tag-title">{t.title}</span>
                  <span class="kit-tag-meta">parchemin {lengthOf(t.word_count)}</span>
                </a>
              </li>
```

  (import `lengthOf` from `../../../lib/library/shelf`; delete the `.text-card`/`.text-title` rules and the `card` class);
- the unknown key and the loading/error lines keep their words (`<p class="muted">…</p>`);
- delete every CSS rule left without markup (`.header`, `.eris-line`, `.bar*`, `.toast`, `.wobble-hover`).

`placesKit.test.ts` and `headings.test.ts` now scan this file: both must pass.

- [ ] **Step 4: Write `web/src/screens/WarTent.svelte`**

```svelte
<script lang="ts">
  // The war tent (scenes UI spec §3, UI3 Ruling B4): each lieutenant's portrait is pinned to a
  // parchment sheet (tap → the lieutenant's page, #/p/:id/monstres/:key), the map table holds
  // Éris's file (#/p/:id/dossier), the codex on its lectern the bestiary (#/p/:id/bestiaire). A
  // lieutenant asleep at the hero's class is a locked place: the dragon says why (carry #16/M9).
  import PlaceScene from '../components/scene/PlaceScene.svelte';
  import Hotspot from '../components/scene/Hotspot.svelte';
  import Overlay from '../components/scene/Overlay.svelte';
  import PortraitPanel from '../components/places/war/PortraitPanel.svelte';
  import { LIEUTENANT_NAMES, WAR_SCENE, isLieutenantKey } from '../lib/world/scenes/war';
  import { WAR_SHAPES } from '../lib/world/scenes/war.shapes';
  import { dragonSays } from '../lib/world/scenes/speakers';
  import { bandFor, dossierLine, sleepingLine } from '../lib/world/eris';
  import { erisSays } from '../lib/world/voices';
  import { ART } from '../lib/world/art';
  import { campFor } from '../lib/world/campStore.svelte';
  import { shapeBox } from '../lib/scene/geometry';
  import { closePanel, openHotspot } from '../lib/scene/panelNav';
  import { hotspotSelector } from '../lib/scene/hotspotId';
  import { unlockAudio } from '../lib/juice/sfx';
  import { OVERLAY_TITLES, sceneHref, type PanelId } from '../lib/world/places';
  import { LIEUTENANT_ORDER } from '../lib/world/types';
  import type { HotspotDef } from '../lib/scene/types';
  import type { Profile } from '../lib/types';

  let { profile, panel, params }: { profile: Profile; panel: PanelId | null; params: Record<string, string> } = $props();

  let debug = $state(false);
  let place: PlaceScene | undefined = $state();
  const camp = $derived(campFor(profile.id));

  const sheets = LIEUTENANT_ORDER.map((key) => ({ key, box: shapeBox(WAR_SHAPES[key]) }));
  const key = $derived(params.key ?? '');
  const portraitTitle = $derived(isLieutenantKey(key) ? LIEUTENANT_NAMES[key] : OVERLAY_TITLES.portrait);
  // Ruling B10: Éris speaks her line for this lieutenant from the sheet's voice plate.
  const portraitVoice = $derived.by(() => {
    const l = isLieutenantKey(key) ? camp?.lieutenants.find((x) => x.key === key) : undefined;
    return l && isLieutenantKey(key) ? erisSays(dossierLine(key, bandFor(l))) : null;
  });

  const activate = (def: HotspotDef) => openHotspot(def, profile.id);

  // The tap on a locked sheet never takes the stage's one-tap guard (Hotspot.svelte), so the other
  // places stay tappable after the dragon has spoken.
  function explainLocked(def: HotspotDef) {
    if (!camp || !isLieutenantKey(def.id)) return;
    unlockAudio();
    place?.say([dragonSays(camp.dragon, sleepingLine(def.id))]);
  }

  const close = () => closePanel(sceneHref('war', profile.id));
</script>

<PlaceScene bind:this={place} {profile} scene={WAR_SCENE} bind:debug>
  {#snippet children(ctx)}
    {#each sheets as s (s.key)}
      {@const l = ctx.camp?.lieutenants.find((x) => x.key === s.key)}
      <div
        class="war-sheet"
        class:asleep={l !== undefined && !l.available}
        data-testid="war-sheet-{s.key}"
        style="left:{s.box.x}%;top:{s.box.y}%;width:{s.box.w}%;height:{s.box.h}%"
        aria-hidden="true"
      >
        <img src={ART.lieutenants[s.key]} alt="" draggable="false" />
        {#if l?.neutralised}<span class="war-seal"></span>{/if}
      </div>
    {/each}
    {#each WAR_SCENE.hotspots as def (def.id)}
      <Hotspot {def} status={def.state(ctx)} sceneId="war" onActivate={activate} onLocked={explainLocked} />
    {/each}
  {/snippet}
</PlaceScene>

{#if panel === 'portrait'}
  <Overlay variant="scroll" size="wide" title={portraitTitle} testId="overlay-portrait" voice={portraitVoice} onClose={close} returnFocus={hotspotSelector('war', key)}>
    {#key key}
      <PortraitPanel {profile} lieutenantKey={key} />
    {/key}
  </Overlay>
{/if}

<style>
  /* A lieutenant's painted cut-out on its blank sheet (the sheets are part of the art); the name is
     inked on the sheet by the hotspot's `on` label. Under the hotspots (z 3). */
  .war-sheet {
    position: absolute;
    z-index: 2;
    overflow: hidden;
    pointer-events: none;
  }
  .war-sheet img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: 50% 10%;
    mix-blend-mode: multiply;
  }
  .war-sheet.asleep img {
    filter: grayscale(1);
    opacity: 0.45;
  }
  /* A gold seal pressed on a foiled lieutenant's sheet. */
  .war-seal {
    position: absolute;
    top: 6%;
    right: 8%;
    width: 30%;
    aspect-ratio: 1;
    border-radius: 50%;
    border: 2px solid var(--bronze-dark);
    background: radial-gradient(circle at 35% 30%, var(--gold-light), var(--gold) 70%);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  }
</style>
```

- [ ] **Step 5: Route the war tent**

In `web/src/App.svelte`, inside lane W's fence: replace the four `Dossier`/`Bestiaire`/`BestiaireEntry`/`Lieutenant` imports by `import WarTent from './screens/WarTent.svelte';` plus the three still-legacy imports (`Dossier`, `Bestiaire`, `BestiaireEntry`: Task 3 removes them), and replace the `lieutenant` branch by the place branch placed **before** the three still-legacy branches:

```svelte
      {:else if view?.place === 'war' && route.name !== 'dossier' && route.name !== 'bestiaire' && route.name !== 'bestiaire-entry'}
        <!-- UI3b Task 2: the war tent and its portrait sheets (Task 3 opens the rest as overlays). -->
        <WarTent profile={gateProfile} panel={view.panel} params={route.params} />
```

(The `route.name` guard is temporary: Task 3 drops it with the legacy branches.)

- [ ] **Step 6: Write the war tent e2e (both projects)**

`web/e2e/scenes-war.spec.ts`:

```ts
import { test, expect } from './crashGuard';
import type { Page } from '@playwright/test';
import {
  closeOverlay,
  createProfileApi,
  expectCamp,
  expectInSafeZone,
  expectInWorldOverlay,
  expectScene,
  labelOverlaps,
  redScan,
  tap,
  uniqueName,
} from './helpers';

// UI3b (scenes spec §3 War tent, §10): the lieutenants' portrait sheets, the first locked places
// (carry #16/M9), Éris's file and the bestiary codex. desktop + ipad.

const SHEETS = ['hydre', 'echo', 'chimere', 'protee', 'sirenes', 'lethe'];
const PLACES = [...SHEETS.map((k) => `war-${k}`), 'war-dossier', 'war-bestiary'];
const heroName = (project: string) => uniqueName(`Guerre-${project}`);

async function openTent(page: Page, id: number) {
  await page.goto(`/#/p/${id}/tente-de-guerre`);
  await expectScene(page, 'war');
  await expect(page.getByTestId('hud-xp')).toBeVisible();
}

test('the war tent: six sheets with their painted lieutenants, the file, the codex, the exit', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openTent(page, id);
  await expect(page.locator('[data-testid="scene-war"] .stage-plaque')).toHaveText('La tente de guerre');
  for (const k of SHEETS) {
    await expect(page.getByTestId(`war-${k}`)).toBeVisible();
    await expect(page.getByTestId(`war-sheet-${k}`).locator('img')).toHaveAttribute('src', `/art/lieutenants/${k}_cut.webp`);
  }
  await expect(page.getByTestId('war-hydre')).toHaveAccessibleName(/L'Hydre/);
  await expect(page.getByTestId('war-dossier')).toHaveAccessibleName(/Le dossier d'Éris/);
  await expect(page.getByTestId('war-bestiary')).toHaveAccessibleName(/Le bestiaire/);
  await tap(page.getByTestId('scene-exit'), testInfo);
  await expectCamp(page);
});

test('a sheet opens its lieutenant: Éris speaks, a quest, the seal and Back close it', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openTent(page, id);
  await tap(page.getByTestId('war-hydre'), testInfo);
  await expect(page).toHaveURL(/\/monstres\/hydre$/);
  const sheet = page.getByTestId('overlay-portrait');
  await expect(sheet.getByRole('heading', { name: "L'Hydre", level: 2 })).toBeVisible();
  await expect(sheet.getByTestId('overlay-voice')).toHaveAttribute('data-speaker', 'eris');
  await expect(sheet.getByTestId('lieutenant-gauge-days')).toContainText('0/3');
  await sheet.getByTestId('lieutenant-quest').click();
  await expect(sheet.getByRole('status')).toHaveText('Quête affichée au mur.');
  await expect(sheet.getByTestId('lieutenant-quest')).toContainText('Quête en cours');
  await expect(sheet.locator('[data-testid^="lieutenant-text-"]').first()).toBeVisible();
  await expect(sheet.locator('[data-testid^="lieutenant-text-"]').first()).not.toContainText(/\b\d{1,2}H\b/);
  await closeOverlay(page);
  await expect(page).toHaveURL(/\/tente-de-guerre$/);
  await expect(page.getByTestId('war-hydre')).toBeFocused();
  await expect(page.getByTestId('war-hydre')).toContainText('Quête en cours');
  await tap(page.getByTestId('war-echo'), testInfo);
  await expect(page.getByTestId('overlay-portrait')).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId('overlay-portrait')).toHaveCount(0);
  await page.goto(`/#/p/${id}/monstres/lethe`);
  await expect(page.getByTestId('overlay-portrait').getByRole('heading', { name: 'Léthé', level: 2 })).toBeVisible();
});

test("a lieutenant asleep at the hero's class is a locked place: the dragon says why", async ({ page, request }, testInfo) => {
  // Protée wakes at 8H (catalog.py min_level): a 7H hero finds him asleep.
  const id = await createProfileApi(request, heroName(testInfo.project.name), '7H');
  await openTent(page, id);
  const protee = page.getByTestId('war-protee');
  await expect(protee).toHaveAttribute('aria-disabled', 'true');
  await expect(protee).toContainText('Dort encore');
  await expect(protee.locator('img.hotspot-lock')).toHaveAttribute('src', '/art/icons/lock.webp');
  await tap(protee, testInfo);
  await expect(page).toHaveURL(/\/tente-de-guerre$/);
  await expect(page.getByTestId('dialogue-text')).toHaveText('Protée dort encore. Ses ruses viendront dans une classe plus grande.');
  await page.getByTestId('dialogue-skip').click();
  // The other places still open: the locked tap never took the stage's one-tap guard.
  await tap(page.getByTestId('war-hydre'), testInfo);
  await expect(page).toHaveURL(/\/monstres\/hydre$/);
});

test('places and labels sit in the safe zone, labels never cover another place', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  for (const size of [{ width: 1280, height: 720 }, { width: 1180, height: 820 }, { width: 1366, height: 1024 }]) {
    await page.setViewportSize(size);
    await openTent(page, id);
    await expectInSafeZone(page, 'war', PLACES);
    expect(await labelOverlaps(page, 'war'), `${size.width}x${size.height}`).toEqual([]);
  }
});

test('overlay-portrait: an in-world scroll, clear of the HUD, 48 px targets, kit classes only', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/monstres/hydre`);
  await expectInWorldOverlay(page, 'overlay-portrait', 'war', true, 'scroll', 'eris');
});

test('war tent: ?debug outlines eight places; no red; rotate screen', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/tente-de-guerre?debug`);
  await expectScene(page, 'war');
  await expect(page.getByTestId('hotspot-debug').locator('svg.outline')).toHaveCount(8);
  expect(await redScan(page)).toEqual([]);
  await page.setViewportSize({ width: 820, height: 1180 });
  await expect(page.getByTestId('rotate-screen')).toBeVisible();
});
```

`web/e2e/world.spec.ts` step 3 reaches `#/p/:id/monstres/hydre` by deep link: its `lieutenant-gauge-days` and `lieutenant-quest` assertions work on the overlay unchanged. Scope them to `page.getByTestId('overlay-portrait')` if strict mode complains.

- [ ] **Step 7: Verify**

Run: `scripts/npm.sh run test -- src/lib/world/scenes/ src/placesKit.test.ts src/registerGuard.test.ts src/components/places/headings.test.ts` and `scripts/npm.sh run check` — Expected: all pass, `0 errors and 0 warnings`.
Run: `STACK=war scripts/playwright.sh scenes-war --repeat-each=3` — Expected: 6 tests × 2 projects × 3 pass. If the safe-zone or overlap assertions fail, tune `war.shapes.ts` within ±2 % and confirm with a `?debug` screenshot.
Run: `STACK=war scripts/playwright.sh world --project=desktop` — Expected: 9 passed.

- [ ] **Step 8: Commit**

```bash
P="web/src/lib/world/scenes/war.shapes.ts web/src/lib/world/scenes/war.ts web/src/lib/world/scenes/war.test.ts web/src/lib/world/scenes/index.ts web/src/lib/world/scenes/nextStep.test.ts web/src/screens/WarTent.svelte web/src/screens/Lieutenant.svelte web/src/components/places/war/PortraitPanel.svelte web/src/App.svelte web/e2e/scenes-war.spec.ts web/e2e/world.spec.ts"
git add $P
git commit -m "UI3b: the war tent - lieutenants' portrait sheets as places, Éris's voice on the sheet, sleeping ones locked with the dragon's word

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- $P
```

### Task 3: Éris's file on the map table, the bestiary codex on the lectern — lane W

**Files:**
- Move (`git mv`): `web/src/screens/Dossier.svelte` → `web/src/components/places/war/DossierPanel.svelte`; `web/src/screens/Bestiaire.svelte` → `web/src/components/places/war/CodexPanel.svelte`; `web/src/screens/BestiaireEntry.svelte` → `web/src/components/places/war/CodexPagePanel.svelte`
- Modify: `web/src/screens/WarTent.svelte`, `web/src/App.svelte` (lane W fence)
- Modify: `web/e2e/scenes-war.spec.ts`, `web/e2e/world.spec.ts` (steps 3 and 9), `web/e2e/scenes-camp.spec.ts` (« legacy screens stay usable in portrait » only)

**Interfaces:**
- Consumes: Task 2 (`WarTent.svelte`, `close`, `key`), Task 1 (`OVERLAY_TITLES`, `erisSays`, `VOICES.bestiary`, `sleepingLine`), `Overlay` variants `table` and `codex`, `OverlayVoice`, `go(…, 'panel')`, `entry()` and `BESTIARY` (`lib/world/bestiary.ts`), `dossierIntro`, `smallTricksLine`, `dossierLine`, `bandFor`, `agree`, `pronounFor`, `LieutenantBadge`, `Gauge`, `Reveal`.
- Produces: `DossierPanel.svelte`, `CodexPanel.svelte` props `{ profile: Profile }`; `CodexPagePanel.svelte` props `{ profile: Profile; entryKey: string }`; overlays `overlay-dossier` (table, wide), `overlay-codex` (codex), `overlay-codex-page` (codex). Kept test ids: `dossier-line-*`, `dossier-small-tricks`, `bestiary-card-*`, `bestiary-locked`. New: `dossier-row-<key>` (a lieutenant's sheet on the table), `codex-page-lieutenant` (« Voir la ruse et la quête »).

- [ ] **Step 1: Write the failing e2e**

Append to `web/e2e/scenes-war.spec.ts`:

```ts
test("the map table opens Éris's file; a sheet opens its lieutenant; the seals step back", async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openTent(page, id);
  await tap(page.getByTestId('war-dossier'), testInfo);
  await expect(page).toHaveURL(/\/dossier$/);
  const file = page.getByTestId('overlay-dossier');
  await expect(file.getByRole('heading', { name: "Le dossier d'Éris", level: 2 })).toBeVisible();
  await expect(file.getByTestId('overlay-voice')).toHaveAttribute('data-speaker', 'eris');
  await expect(file.getByRole('heading', { name: 'Ses points faibles' })).toBeVisible();
  await expect(file.getByTestId('dossier-line-hydre')).toBeVisible();
  await expect(file.getByTestId('dossier-row-hydre').locator('img[src="/art/icons/lt-hydre.webp"]')).toBeVisible();
  await expect(file.getByTestId('dossier-small-tricks').getByRole('link', { name: 'Lire ton journal' })).toBeVisible();
  await file.getByTestId('dossier-row-hydre').click();
  await expect(page).toHaveURL(/\/monstres\/hydre$/);
  await expect(page.getByTestId('overlay-portrait')).toBeVisible();
  await closeOverlay(page);
  await expect(page).toHaveURL(/\/dossier$/);
  await expect(file.getByTestId('dossier-row-hydre')).toBeFocused();
  await closeOverlay(page);
  await expect(page).toHaveURL(/\/tente-de-guerre$/);
});

test("the lectern opens the bestiary codex; a page keeps the myth apart from the camp's fiction", async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openTent(page, id);
  await tap(page.getByTestId('war-bestiary'), testInfo);
  await expect(page).toHaveURL(/\/bestiaire$/);
  const codex = page.getByTestId('overlay-codex');
  await expect(codex.getByRole('heading', { name: 'Le bestiaire', level: 2 })).toBeVisible();
  await expect(codex.getByRole('heading', { name: "Les ruses d'Éris" })).toBeVisible();
  await expect(codex.getByRole('heading', { name: 'Les amis du camp' })).toBeVisible();
  await expect(codex.getByTestId('bestiary-card-hydre').getByTestId('bestiary-locked')).toBeVisible();
  await codex.getByTestId('bestiary-card-argus').click();
  await expect(page).toHaveURL(/\/bestiaire\/argus$/);
  const leaf = page.getByTestId('overlay-codex-page');
  await expect(leaf.getByRole('heading', { name: 'Argus aux cent yeux', level: 2 })).toBeVisible();
  await expect(leaf.getByRole('heading', { name: 'Le mythe' })).toBeVisible();
  await expect(leaf.getByRole('heading', { name: 'Au camp' })).toBeVisible();
  await closeOverlay(page);
  await expect(page).toHaveURL(/\/bestiaire$/);
  await codex.getByTestId('bestiary-card-hydre').click();
  await leaf.getByTestId('codex-page-lieutenant').click();
  await expect(page).toHaveURL(/\/monstres\/hydre$/);
  expect(await redScan(page)).toEqual([]);
});

for (const o of [
  { hash: (id: number) => `/p/${id}/dossier`, testId: 'overlay-dossier', variant: 'table', voice: 'eris' },
  { hash: (id: number) => `/p/${id}/bestiaire`, testId: 'overlay-codex', variant: 'codex', voice: 'owl' },
  { hash: (id: number) => `/p/${id}/bestiaire/hydre`, testId: 'overlay-codex-page', variant: 'codex', voice: null },
] as const) {
  test(`${o.testId}: an in-world ${o.variant}, clear of the HUD, 48 px targets, kit classes only`, async ({ page, request }, testInfo) => {
    const id = await createProfileApi(request, heroName(testInfo.project.name));
    await page.goto(`/#${o.hash(id)}`);
    await expectInWorldOverlay(page, o.testId, 'war', true, o.variant, o.voice);
  });
}
```

Run: `STACK=war scripts/playwright.sh scenes-war` — Expected: the five new tests FAIL (no `overlay-dossier` / `overlay-codex`).

- [ ] **Step 2: Move the three screens into panels**

```bash
git mv web/src/screens/Dossier.svelte web/src/components/places/war/DossierPanel.svelte
git mv web/src/screens/Bestiaire.svelte web/src/components/places/war/CodexPanel.svelte
git mv web/src/screens/BestiaireEntry.svelte web/src/components/places/war/CodexPagePanel.svelte
sed -i "s#'\.\./components/#'../../#g; s#'\.\./lib/#'../../../lib/#g" web/src/components/places/war/DossierPanel.svelte web/src/components/places/war/CodexPanel.svelte web/src/components/places/war/CodexPagePanel.svelte
```

In each: delete the `TopBar` import and element; every in-place navigation becomes `go(…, 'panel')` (its seal steps back).

**`DossierPanel.svelte` — papers on the map table** (loading, the stats call, `nameFor`, `pct`, `smallTricks`, `topTrapWords`, `bestCatchRate` stay):
- outer `<div class="screen dossier">` → `<div class="panel-dossier">`;
- the header with Éris's portrait and bubble becomes her voice plate at the top (import `OverlayVoice` from `../../scene/OverlayVoice.svelte` and `erisSays` from `../../../lib/world/voices`): `<OverlayVoice line={erisSays(statsLoading ? 'Éris feuillette son dossier…' : dossierIntro(profile.name, stats?.totals.sessions ?? 0))} />`; delete the header, `.header`, `.eris-portrait*`, `.bubble` and the `ART` import if unused;
- errors: `<p class="kit-note" data-tone="eris">Impossible de lire le dossier : {statsError}</p>`, `<p class="kit-note" data-tone="eris">Les ruses d'Éris n'ont pas pu être lues : {campStore.error}</p>`; loading `<p class="muted">Éris étale ses notes sur la table…</p>`;
- `<h2>Ses points faibles</h2>` → `<h3 class="kit-section">Ses points faibles</h3>`; the list is a grid of sheets pinned on the table (`.papers { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 18px; list-style: none; margin: 0; padding: 0; }`):

```svelte
            <li>
              {#if !l || !l.available}
                <div class="kit-sheet paper is-asleep" data-testid="dossier-row-{key}" data-lieutenant={key}>
                  <span class="paper-head"><LieutenantBadge lieutenantKey={key} size={40} dim /><h4>{nameFor(key)}</h4></span>
                  <p class="muted">{sleepingLine(key)}</p>
                </div>
              {:else}
                {@const band = bandFor(l)}
                <button type="button" class="kit-sheet paper" data-testid="dossier-row-{key}" data-lieutenant={key} onclick={() => goLieutenant(key)}>
                  <span class="paper-head">
                    <LieutenantBadge lieutenantKey={key} size={40} />
                    <h4>{nameFor(key)}</h4>
                    {#if l.neutralised}<span class="kit-stamp">{agree('Neutralisé', key)}</span>{/if}
                  </span>
                  <span class="kit-note" data-tone="eris" data-testid="dossier-line-{key}">{dossierLine(key, band)}</span>
                  <span class="numbers">Pièges tendus : {l.all_time.traps} · déjoués : {l.all_time.caught} · {pct(l.all_time.rate)}</span>
                  <Gauge value={l.window.days} max={3} label={`${l.window.days}/3 jours · ${l.window.traps}/10 pièges · ${pct(l.window.rate)}`} />
                </button>
              {/if}
            </li>
```

  with `.paper { display: flex; flex-direction: column; gap: 8px; width: 100%; margin: 14px 10px; text-align: left; font: inherit; color: inherit; border: 0; cursor: pointer; }`, `.paper.is-asleep { filter: saturate(0.45) brightness(0.92); cursor: default; }`, `.paper-head { display: flex; align-items: center; gap: 10px; } .paper-head h4 { margin: 0; }`, `.numbers { font-size: 15px; }`; `goLieutenant` becomes `go(href('lieutenant', { profileId, key }), 'panel')`; `sleepingLine` comes from eris.ts (Task 1); `Gauge` stays;
- the small tricks sheet:

```svelte
    <section class="kit-sheet small-tricks" data-testid="dossier-small-tricks">
      <h3 class="kit-section">Ses petites ruses</h3>
      <p>{smallTricksLine(smallTricks.traps, smallTricks.caught)}</p>
      {#if topTrapWords.length > 0}
        <h4>Mots qu'elle vise</h4>
        <ul class="target-words">
          {#each topTrapWords as w (w.word)}<li>{w.word}</li>{/each}
        </ul>
      {/if}
      <a class="kit-link" href={href('stats', { profileId })}>Lire ton journal</a>
    </section>
```

  with `.target-words { display: flex; flex-wrap: wrap; gap: 6px 14px; list-style: none; margin: 0; padding: 0; } .target-words li { font-family: var(--font-reading); font-style: italic; color: var(--orange-ink); }` (the link is a plain `href`: the journal is another place);
- « Ce qu'elle préfère taire »: `<Reveal><section class="kit-sheet"><h3 class="kit-section">Ce qu'elle préfère taire</h3><ul>…</ul></section></Reveal>` with the same three lines (« Ton meilleur taux de réussite : … », « Dés-accords déjoués en tout : … », « Ton rang actuel : … »);
- delete every rule left without markup (`.row*`, `.chip-gold`, `.chips`, `.bubble`…).

**`CodexPanel.svelte` — the bestiary as a two-page codex** (`isUnlocked`, `lieutenantState` stay; the subtitle goes, the owl says it from the voice plate):

```svelte
<div class="codex-spread panel-codex">
  <section class="codex-page page-left">
    <h3>Les ruses d'Éris</h3>
    <ol class="contents">{#each ERIS_SIDE as e (e.key)}{@render item(e)}{/each}</ol>
  </section>
  <section class="codex-page page-right">
    <h3>Les amis du camp</h3>
    <ol class="contents">{#each CAMP_SIDE as e (e.key)}{@render item(e)}{/each}</ol>
  </section>
</div>

{#snippet item(e: BestiaryEntry)}
  {@const unlocked = isUnlocked(e)}
  {@const status = statusStamp(e)}
  <li>
    <button type="button" class="entry" data-testid="bestiary-card-{e.key}" onclick={() => open(e.key)}>
      <img src={e.art} alt="" class="thumb" class:locked={!unlocked} loading="lazy" decoding="async" />
      <span class="entry-text">
        <span class="entry-title">{e.name}</span>
        <span class="entry-teaser">{e.teaser}</span>
        {#if status}<span class="kit-stamp">{status}</span>{/if}
        {#if e.kind === 'monster' && !unlocked}
          <span class="entry-locked" data-testid="bestiary-locked">Mythe à débloquer : termine une quête contre {pronounFor(e.key as LieutenantKey)}</span>
        {/if}
      </span>
    </button>
  </li>
{/snippet}
```

  with `const ERIS_SIDE = BESTIARY.filter((e) => e.kind === 'monster' || e.kind === 'boss')`, `const CAMP_SIDE = BESTIARY.filter((e) => e.kind !== 'monster' && e.kind !== 'boss')`, and `statusStamp(e)` returning `null` for non-monsters, `agree('Neutralisé', key)` when neutralised, « En cours » when it has traps, else « À découvrir ». `open(key)` becomes `go(href('bestiaire-entry', { profileId, key }), 'panel')`. Style the entries like PortalPanel's table of contents (`.contents` list, `.entry` a 48 px+ row button with a 64 px `thumb`, `.entry-title` Alegreya 600 18 px, `.entry-teaser` 15 px, `.entry-locked` italic in `--orange-ink`); delete the grid and chip rules.

**`CodexPagePanel.svelte` — one page of the bestiary** (`item`, `unlocked` stay):

```svelte
{#if !item}
  <div class="codex-spread panel-codex-page">
    <section class="codex-page page-left"><p class="muted">Ce monstre n'existe pas… encore.</p></section>
    <section class="codex-page page-right"></section>
  </div>
{:else}
  <div class="codex-spread panel-codex-page">
    <section class="codex-page page-left">
      <figure class="plate" class:is-scene={item.kind === 'place'}><img src={item.art} alt="" /></figure>
      <h3>Le mythe</h3>
      {#if unlocked}
        <ul>{#each item.facts as fact (fact)}<li>{fact}</li>{/each}</ul>
      {:else}
        <p>{item.teaser}</p>
        <p class="kit-note" data-tone="eris">Mythe à débloquer : termine une quête contre {pronounFor(item.key as LieutenantKey)}.</p>
      {/if}
      <h3>Sources</h3>
      <p class="muted sources">{item.sources}</p>
    </section>
    <section class="codex-page page-right">
      <span class="kit-stamp">Fiction du jeu</span>
      <h3>Au camp</h3>
      <p>{item.inGame}</p>
      {#if item.kind === 'monster'}
        <button type="button" class="kit-bronze" data-testid="codex-page-lieutenant" onclick={openLieutenant}>Voir la ruse et la quête</button>
      {/if}
    </section>
  </div>
{/if}
```

  `openLieutenant` becomes `go(href('lieutenant', { profileId, key: entryKey }), 'panel')`. Style `.plate` like PortalPanel's plate (a framed picture, `max-height: 220px`, `object-fit: contain`; `.is-scene img { object-fit: cover; width: 100%; }`).

- [ ] **Step 3: Open them on the tent**

In `web/src/screens/WarTent.svelte`: import the three panels, `VOICES` and `entry`; track which overlay a portrait or a page was opened from, so focus goes back there (LibraryTent's pattern for works):

```ts
  const pageTitle = $derived(entry(key)?.name ?? OVERLAY_TITLES.page);
  // Where the portrait / page was opened from, captured on the transition (like LibraryTent's work
  // focus): its seal steps back there, and focus follows.
  let previousPanel: PanelId | null = null;
  let openedFrom = $state<PanelId | null>(null);
  $effect(() => {
    const from = previousPanel;
    previousPanel = panel;
    if (panel === 'portrait' || panel === 'page') openedFrom = from;
  });
  const portraitFocus = $derived(
    openedFrom === 'dossier' ? `[data-testid="dossier-row-${key}"]` : openedFrom === 'page' ? '[data-testid="codex-page-lieutenant"]' : hotspotSelector('war', key),
  );
  const pageFocus = $derived(openedFrom === 'codex' ? `[data-testid="bestiary-card-${key}"]` : hotspotSelector('war', 'bestiary'));
```

and the overlay chain:

```svelte
{#if panel === 'portrait'}
  <Overlay variant="scroll" size="wide" title={portraitTitle} testId="overlay-portrait" voice={portraitVoice} onClose={close} returnFocus={portraitFocus}>
    {#key key}
      <PortraitPanel {profile} lieutenantKey={key} />
    {/key}
  </Overlay>
{:else if panel === 'dossier'}
  <Overlay variant="table" size="wide" title={OVERLAY_TITLES.dossier} testId="overlay-dossier" onClose={close} returnFocus={hotspotSelector('war', 'dossier')}>
    <DossierPanel {profile} />
  </Overlay>
{:else if panel === 'codex'}
  <Overlay variant="codex" title={OVERLAY_TITLES.codex} testId="overlay-codex" voice={VOICES.bestiary} onClose={close} returnFocus={hotspotSelector('war', 'bestiary')}>
    <CodexPanel {profile} />
  </Overlay>
{:else if panel === 'page'}
  <Overlay variant="codex" title={pageTitle} testId="overlay-codex-page" onClose={close} returnFocus={pageFocus}>
    {#key key}
      <CodexPagePanel {profile} entryKey={key} />
    {/key}
  </Overlay>
{/if}
```

In `web/src/App.svelte`, inside lane W's fence: delete the `Dossier`, `Bestiaire`, `BestiaireEntry` imports and branches, and drop the temporary `route.name` guard of the war branch (`{:else if view?.place === 'war'}`).

- [ ] **Step 4: Migrate the specs that went through the legacy dossier**

- `web/e2e/world.spec.ts` step 3: `await page.goto(\`/#/p/${profileId}/dossier\`); await page.getByTestId('topbar-camp').click();` → `await page.goto(\`/#/p/${profileId}/camp\`);` (its `expectCamp` stays). Steps 6 and 9 keep their `#/p/:id/dossier` and `#/p/:id/bestiaire/hydre` deep links: the overlays carry the same test ids and the h2 « Le dossier d'Éris ».
- `web/e2e/scenes-camp.spec.ts`, « legacy screens stay usable in portrait »: the dossier is a place now; prove it on the battle screen:

```ts
  await page.goto(`/#/p/${id}/eris`);
  await expect(page.getByTestId('topbar-camp')).toBeVisible();
  await expect(page.getByTestId('rotate-screen')).toHaveCount(0);
```

  (and fix the test's comment).

- [ ] **Step 5: Verify**

Run: `scripts/npm.sh run test -- src/placesKit.test.ts src/registerGuard.test.ts src/formPlural.test.ts src/components/places/headings.test.ts src/lib/world/` and `scripts/npm.sh run check` — Expected: all pass, `0 errors and 0 warnings`.
Run: `STACK=war scripts/playwright.sh scenes-war --repeat-each=3` — Expected: 11 tests × 2 projects × 3 pass.
Run: `STACK=war scripts/playwright.sh world scenes-camp` — Expected: all pass.
Run (end of lane W): `STACK=war PW_WORKERS=4 scripts/check.sh` — Expected: `== ALL GREEN`.

- [ ] **Step 6: Commit**

```bash
P="web/src/screens/Dossier.svelte web/src/screens/Bestiaire.svelte web/src/screens/BestiaireEntry.svelte web/src/components/places/war/DossierPanel.svelte web/src/components/places/war/CodexPanel.svelte web/src/components/places/war/CodexPagePanel.svelte web/src/screens/WarTent.svelte web/src/App.svelte web/e2e/scenes-war.spec.ts web/e2e/world.spec.ts web/e2e/scenes-camp.spec.ts"
git add $P
git commit -m "UI3b: Éris's file as papers on the map table, the bestiary as a codex on the lectern

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- $P
```

### Task 4: The dragon's nest — lane H

**Files:**
- Create: `web/src/lib/world/scenes/nest.shapes.ts`, `web/src/lib/world/scenes/nest.ts`, `web/src/lib/world/scenes/nest.test.ts`, `web/src/screens/Nest.svelte`, `web/e2e/scenes-nest.spec.ts`
- Move: `web/src/screens/DragonScreen.svelte` → `web/src/components/places/nest/CarePanel.svelte` (`git mv`)
- Modify: `web/src/lib/world/scenes/index.ts` (lane H Task 4 fence), `web/src/lib/world/scenes/nextStep.test.ts`, `web/src/App.svelte` (Task 4 fence), `web/e2e/world.spec.ts` (steps 5 and 6, the dragon lines only)

**Interfaces:**
- Consumes: Task 1 (`placeFor` → `{ place: 'nest', panel: 'soin' | null }`, `sceneHref('nest')`, `dragonSays`), `PlaceScene` (`greet`), `SceneLayer`, `Hotspot`, `Overlay` (`voice`), `openHotspot`, `closePanel`, `hotspotSelector`, `stageLine`, `stageLabel`, `stageActivity`, `TINT_FILTERS`, `plural`, `dragonCaption` (camp.ts), `Gauge`.
- Produces:
  - `nest.ts`: `NEST_HOTSPOTS` (one: `dragon` → `dragon` with `query: { panel: 'soin' }`), `NEST_SCENE` (id `nest`, plaque « Le nid du dragon »), `nestDragonLayer(stage)`, `growth(d)`, `nestGreeting(d)`, `careLine(d)`.
  - `Nest.svelte` props `{ profile: Profile; panel: PanelId | null }`; test ids `scene-nest`, `nest-dragon`, `nest-dragon-layer`, `nest-growth`, `dragon-stage` (moved from the legacy screen), `overlay-care`.
  - `CarePanel.svelte` props `{ profile: Profile }`; kept test ids `dragon-name-input`, `dragon-name-save`, `dragon-tint-*`.

- [ ] **Step 1: Write the failing scene-data test**

`web/src/lib/world/scenes/nest.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { validateScene } from '../../scene/validate';
import type { CampResponse, DragonOut } from '../types';
import { NEST_HOTSPOTS, NEST_SCENE, careLine, growth, nestDragonLayer, nestGreeting } from './nest';

const egg = { name: null, tint: 'bronze', stage: 'egg', neutralised: 0, available: 6, next_stage_at: 1, unlocked_tints: ['bronze'] } as DragonOut;
const state = (d: DragonOut) => NEST_HOTSPOTS[0].state({ camp: { dragon: d } as CampResponse, catalog: null });

describe("dragon's nest (UI3 Ruling B5)", () => {
  it('is a valid scene whose plaque echoes the hub label; the dragon opens its care', () => {
    expect(validateScene(NEST_SCENE)).toEqual([]);
    expect(NEST_SCENE).toMatchObject({ id: 'nest', title: 'Le nid du dragon', background: '/art/scenes/nest.webp' });
    expect(NEST_SCENE.preload).toEqual(['/art/scenes/hub_camp.webp']);
    expect(NEST_HOTSPOTS.map((h) => [h.id, h.target, h.query, h.label])).toEqual([['dragon', 'dragon', { panel: 'soin' }, 'Ton dragon']]);
  });

  it('seats the dragon in the straw bed, bigger as it grows', () => {
    expect(nestDragonLayer('egg')).toMatchObject({ x: 50, y: 62, depth: 1 });
    const widths = (['egg', 'hatchling', 'young', 'adult'] as const).map((s) => nestDragonLayer(s).scale);
    expect(widths).toEqual([...widths].sort((a, b) => a - b));
    expect(widths[3]).toBeLessThanOrEqual(34);
  });

  it('asks for a name once it has hatched, and says who it is otherwise', () => {
    expect(state(egg)).toMatchObject({ isNew: false, caption: 'Un œuf de dragon' });
    expect(state({ ...egg, stage: 'hatchling' })).toMatchObject({ isNew: true, caption: 'Il attend un nom' });
    expect(state({ ...egg, stage: 'young', name: 'Braise' })).toMatchObject({ isNew: false, caption: 'Braise' });
  });

  it('measures growth to the next stage in words, with a real plural', () => {
    expect(growth(egg)).toEqual({ value: 0, max: 1, label: 'Prochaine étape : 1 technique neutralisée' });
    expect(growth({ ...egg, stage: 'hatchling', neutralised: 1, next_stage_at: 3 })).toEqual({ value: 1, max: 3, label: 'Prochaine étape : 3 techniques neutralisées' });
    expect(growth({ ...egg, stage: 'adult', neutralised: 6, next_stage_at: null })).toEqual({ value: 6, max: 6, label: 'Étape finale atteinte' });
  });

  it('greets with its stage line and speaks in its care (immersion #23)', () => {
    expect(nestGreeting(egg).map((l) => l.text)).toEqual(["L'œuf frémit chaque fois qu'un piège d'Éris est déjoué."]);
    expect(careLine(egg)).toMatchObject({ speaker: 'dragon', text: "Un œuf n'a pas encore de nom. Il éclora quand une ruse d'Éris sera neutralisée." });
    expect(careLine({ ...egg, stage: 'hatchling' }).text).toBe('Il te regarde et attend un nom.');
    expect(careLine({ ...egg, stage: 'young', name: 'Braise' }).text).toBe('Braise se laisse admirer. Change sa teinte quand tu veux.');
    for (const d of [egg, { ...egg, stage: 'young' as const, name: 'Braise' }]) expect(careLine(d).text.length).toBeLessThanOrEqual(160);
  });
});
```

Add `NEST_SCENE` to the one-glow sweep in `scenes/nextStep.test.ts`.

Run: `scripts/npm.sh run test -- src/lib/world/scenes/nest.test.ts` — Expected: FAIL (`Cannot find module './nest'`).

- [ ] **Step 2: Scene data**

`web/src/lib/world/scenes/nest.shapes.ts`:

```ts
// Hotspot geometry of the dragon's nest (nest.webp), art % of the 16:9 frame, authored by hand from
// docs/art/scenes.md (dragon spot x 34-68, y 30-66; feet at about y 62, centred at x 50) and
// checked with `?debug`.
import type { ShapeMap } from '../../scene/types';

export const NEST_SHAPES = {
  dragon: { kind: 'ellipse', cx: 51, cy: 47, rx: 17, ry: 19 },
} satisfies ShapeMap;
```

`web/src/lib/world/scenes/nest.ts`:

```ts
// The dragon's nest (scenes UI spec §3 "Dragon's nest scene", UI3 Ruling B5): the dragon at its
// stage, in its tint, in the straw bed; its growth on a parchment in the scene; its name and tint in
// the `soin` overlay (#/p/:id/dragon?panel=soin), where it speaks from the voice plate.
import { ART } from '../art';
import { stageLine } from '../dragon';
import { plural } from '../../text/french';
import type { DragonOut, DragonStage } from '../types';
import { IDLE_HOTSPOT, type DialogueLine, type HotspotDef, type HotspotState, type SceneDef, type SceneLayerDef } from '../../scene/types';
import { dragonCaption } from './camp';
import { dragonSays } from './speakers';
import { NEST_SHAPES } from './nest.shapes';

const st = (p: Partial<HotspotState> = {}): HotspotState => ({ ...IDLE_HOTSPOT, ...p });

export const NEST_HOTSPOTS: HotspotDef[] = [
  {
    id: 'dragon',
    label: 'Ton dragon',
    target: 'dragon',
    query: { panel: 'soin' },
    shape: NEST_SHAPES.dragon,
    labelPos: 'below',
    leader: true,
    state: ({ camp }) => {
      if (!camp) return st();
      const d = camp.dragon;
      if (d.stage !== 'egg' && !d.name) return st({ isNew: true, caption: 'Il attend un nom' });
      return st({ caption: dragonCaption(d) });
    },
  },
];

export const NEST_SCENE: SceneDef = {
  id: 'nest',
  title: 'Le nid du dragon',
  background: ART.scenes.nest,
  layers: [],
  hotspots: NEST_HOTSPOTS,
  ambience: { particles: 'embers', music: null },
  narrator: { enter: 'nest.enter', firstVisit: 'nest.first' },
  preload: [ART.scenes.hubCamp],
};

const WIDTH: Record<DragonStage, number> = { egg: 10, hatchling: 16, young: 21, adult: 26 };

/** The dragon's cut-out in the straw bed (docs/art/scenes.md: feet at y 62, centred at x 50). */
export function nestDragonLayer(stage: DragonStage): Omit<SceneLayerDef, 'id' | 'src' | 'alt'> {
  return { x: 50, y: 62, scale: WIDTH[stage], depth: 1, idle: 'breathe' };
}

/** The growth gauge (was DragonScreen's), in words with a real plural. */
export function growth(d: DragonOut): { value: number; max: number; label: string } {
  const max = d.next_stage_at ?? Math.max(1, d.available);
  if (d.next_stage_at === null) return { value: d.neutralised, max, label: 'Étape finale atteinte' };
  return { value: d.neutralised, max, label: `Prochaine étape : ${plural(d.next_stage_at, 'technique neutralisée', 'techniques neutralisées')}` };
}

export function nestGreeting(d: DragonOut): DialogueLine[] {
  return [dragonSays(d, stageLine(d.stage, d.name, Math.max(0, d.available - d.neutralised)))];
}

/** What the dragon says from its care overlay's voice plate (Ruling B5, immersion #23). */
export function careLine(d: DragonOut): DialogueLine {
  if (d.stage === 'egg') return dragonSays(d, "Un œuf n'a pas encore de nom. Il éclora quand une ruse d'Éris sera neutralisée.");
  if (!d.name) return dragonSays(d, 'Il te regarde et attend un nom.');
  return dragonSays(d, `${d.name} se laisse admirer. Change sa teinte quand tu veux.`);
}
```

Uncomment lane H's Task 4 lines in `scenes/index.ts`.

Run: `scripts/npm.sh run test -- src/lib/world/scenes/` — Expected: PASS.

- [ ] **Step 3: The care panel**

```bash
mkdir -p web/src/components/places/nest
git mv web/src/screens/DragonScreen.svelte web/src/components/places/nest/CarePanel.svelte
sed -i "s#'\.\./components/#'../../#g; s#'\.\./lib/#'../../../lib/#g" web/src/components/places/nest/CarePanel.svelte
```

In `CarePanel.svelte` (the naming, the optimistic tint change and their errors stay):
- delete the `TopBar` import and element, the painted banner block (`<div class="scene" …>` with `<Dragon>`) and the `stage-block` (the nest shows the dragon, its stage and its growth), and what only they used: the `Dragon`, `Gauge`, `stageLabel` and `plural` imports, `viewportWidth` with its resize `$effect`, `dragonSize`, `gaugeMax`, `gaugeLabel`;
- `<div class="screen dragon-screen">` → `<div class="panel-care">`;
- loading/error: `<p class="muted">Les Muses cherchent ton dragon…</p>` / `<p class="kit-note" data-tone="eris">Impossible de rejoindre ton dragon : {campStore.error}</p>`;
- `<h2>Nom</h2>` → `<h3 class="kit-section">Son nom</h3>`; `<h2>Teinte</h2>` → `<h3 class="kit-section">Sa teinte</h3>`;
- the name form: the input gets `aria-label="Le nom de ton dragon"` (it had no label), keeps `data-testid="dragon-name-input"`, and drops its scoped CSS (`.kit-form` styles it); « Garder ce nom » is `class="kit-bronze"`; errors `class="kit-note" data-tone="eris"`; the toast `class="kit-note" role="status"` (« C'est noté. » with a straight apostrophe, like the lyre);
- each locked swatch shows its unlock in words under the name (the `title` tooltip never shows on iPad): `{#if !unlocked}<span class="swatch-how">À gagner : quête de l'Oracle</span>{/if}` with `.swatch-how { font-size: 13px; font-style: italic; color: var(--reward-ink); max-width: 96px; text-align: center; }`; drop the `title` attribute; the swatch keeps the painted lock;
- in `<style>` delete `.dragon-screen`, `.scene`, `.portrait`, `.stage-block`, `.chip`, `.name-form input`, `.toast`.

- [ ] **Step 4: Write `web/src/screens/Nest.svelte`**

```svelte
<script lang="ts">
  // The dragon's nest (scenes UI spec §3, UI3 Ruling B5): the dragon in the straw bed at its stage
  // and tint, its growth on a parchment, a tap on it opens its care (#/p/:id/dragon?panel=soin:
  // name and tint), where it speaks. It greets once per page load with its stage line.
  import PlaceScene from '../components/scene/PlaceScene.svelte';
  import SceneLayer from '../components/scene/SceneLayer.svelte';
  import Hotspot from '../components/scene/Hotspot.svelte';
  import Overlay from '../components/scene/Overlay.svelte';
  import Gauge from '../components/juice/Gauge.svelte';
  import CarePanel from '../components/places/nest/CarePanel.svelte';
  import { NEST_SCENE, careLine, growth, nestDragonLayer, nestGreeting } from '../lib/world/scenes/nest';
  import { ART } from '../lib/world/art';
  import { TINT_FILTERS, stageActivity, stageLabel } from '../lib/world/dragon';
  import { campFor } from '../lib/world/campStore.svelte';
  import { closePanel, openHotspot } from '../lib/scene/panelNav';
  import { hotspotSelector } from '../lib/scene/hotspotId';
  import { OVERLAY_TITLES, sceneHref, type PanelId } from '../lib/world/places';
  import type { CampResponse } from '../lib/world/types';
  import type { HotspotDef } from '../lib/scene/types';
  import type { Profile } from '../lib/types';

  let { profile, panel }: { profile: Profile; panel: PanelId | null } = $props();

  let debug = $state(false);
  const dragon = $derived(campFor(profile.id)?.dragon ?? null);
  const greet = (camp: CampResponse | null) => (camp ? nestGreeting(camp.dragon) : null);
  const activate = (def: HotspotDef) => openHotspot(def, profile.id);
  const close = () => closePanel(sceneHref('nest', profile.id));
</script>

<PlaceScene {profile} scene={NEST_SCENE} bind:debug {greet}>
  {#snippet children(ctx)}
    {#if ctx.camp}
      {@const d = ctx.camp.dragon}
      {@const g = growth(d)}
      <SceneLayer
        layer={{ id: 'dragon', src: ART.dragon[d.stage], alt: d.name ?? 'Ton dragon', ...nestDragonLayer(d.stage) }}
        filter={TINT_FILTERS[d.tint]}
        testId="nest-dragon-layer"
      />
      <div class="kit-parchment nest-growth stage-text" data-testid="nest-growth">
        <span class="kit-plaque nest-stage" data-testid="dragon-stage">{stageLabel(d.stage)}</span>
        <Gauge value={g.value} max={g.max} label={g.label} />
        <p class="nest-activity">{stageActivity(d.stage)}</p>
      </div>
    {/if}
    {#each NEST_SCENE.hotspots as def (def.id)}
      <Hotspot {def} status={def.state(ctx)} sceneId="nest" onActivate={activate} />
    {/each}
  {/snippet}
</PlaceScene>

{#if panel === 'soin'}
  <Overlay variant="scroll" title={OVERLAY_TITLES.soin} testId="overlay-care" voice={dragon ? careLine(dragon) : null} onClose={close} returnFocus={hotspotSelector('nest', 'dragon')}>
    <CarePanel {profile} />
  </Overlay>
{/if}

<style>
  /* The growth parchment on the cliff, left of the nest (art x 13.5-30.5, y 18-36): inside the safe
     zone, clear of the dragon's place (x 34+) and the HUD band; `stage-text` fades it under overlays. */
  .nest-growth {
    position: absolute;
    left: 13.5%;
    top: 18%;
    width: 17%;
    z-index: 3;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    text-align: center;
  }
  .nest-stage {
    font-size: 15px;
  }
  .nest-activity {
    margin: 0;
    font-style: italic;
  }
</style>
```

- [ ] **Step 5: Route the nest**

In `web/src/App.svelte`, inside the Task 4 fence: `import DragonScreen …` → `import Nest from './screens/Nest.svelte';`, and the `dragon` branch → `{:else if view?.place === 'nest'}<Nest profile={gateProfile} panel={view.panel} />`.

- [ ] **Step 6: Migrate the world spec**

`web/e2e/world.spec.ts`:
- step 5: `await page.goto(\`/#/p/${profileId}/dragon\`);` → `await page.goto(\`/#/p/${profileId}/dragon?panel=soin\`);`; `await expect(page.locator('img.dragon')).toHaveAttribute('style', /hue-rotate\(190deg\)/);` → `await expect(page.getByTestId('nest-dragon-layer').locator('img')).toHaveAttribute('style', /hue-rotate\(190deg\)/);` (leave the step's `cabane` lines to Task 5);
- step 6: keep `goto …/dragon` and the `dragon-stage` « Dragonnet » assertion (in the scene now), then `await page.goto(\`/#/p/${profileId}/dragon?panel=soin\`);` before `dragon-name-input`; the reload keeps the overlay (deep link). Leave the step's `camp-dragon` line to Task 7.

- [ ] **Step 7: Write the nest e2e (both projects)**

`web/e2e/scenes-nest.spec.ts`:

```ts
import { test, expect } from './crashGuard';
import {
  closeOverlay,
  createProfileApi,
  expectCamp,
  expectInSafeZone,
  expectInWorldOverlay,
  expectScene,
  measureBoxes,
  redScan,
  tap,
  uniqueName,
} from './helpers';

// UI3b Task 4 (scenes spec §3 Dragon's nest, §10). desktop + ipad.

const heroName = (project: string) => uniqueName(`Nid-${project}`);

test('the nest: the egg in the straw, its growth, its greeting; the exit leads back', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/dragon`);
  await expectScene(page, 'nest');
  await expect(page.locator('[data-testid="scene-nest"] .stage-plaque')).toHaveText('Le nid du dragon');
  await expect(page.getByTestId('dialogue-text')).toHaveText("L'œuf frémit chaque fois qu'un piège d'Éris est déjoué.");
  await page.getByTestId('dialogue-skip').click();
  await expect(page.getByTestId('nest-dragon-layer').locator('img')).toHaveAttribute('src', '/art/dragon/dragon_egg_cut.webp');
  await expect(page.getByTestId('dragon-stage')).toHaveText('Œuf');
  await expect(page.getByTestId('nest-growth')).toContainText('Prochaine étape : 1 technique neutralisée');
  await expect(page.getByTestId('nest-growth')).toContainText('Frémit');
  await expect(page.getByTestId('nest-dragon')).toContainText('Un œuf de dragon');
  const b = await measureBoxes(page, { growth: '[data-testid="nest-growth"]', dragon: '[data-testid="nest-dragon"]' });
  expect(b.growth!.x + b.growth!.width, 'growth parchment left of the dragon').toBeLessThanOrEqual(b.dragon!.x);
  await tap(page.getByTestId('scene-exit'), testInfo);
  await expectCamp(page);
});

test('the dragon opens its care and speaks; locked tints say how to win them', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/dragon?debug`); // ?debug: no greeting in the way
  await expectScene(page, 'nest');
  await tap(page.getByTestId('nest-dragon'), testInfo);
  await expect(page).toHaveURL(/\/dragon\?panel=soin$/);
  const care = page.getByTestId('overlay-care');
  await expect(care.getByRole('heading', { name: 'Ton dragon', level: 2 })).toBeVisible();
  await expect(care.getByTestId('overlay-voice')).toContainText("Un œuf n'a pas encore de nom.");
  await expect(care).toContainText('Tu lui donneras un nom quand il éclora.');
  await expect(care.getByTestId('dragon-tint-bronze')).toBeVisible();
  await expect(care.getByTestId('dragon-tint-ecume')).toBeDisabled();
  await expect(care.getByTestId('dragon-tint-ecume')).toContainText("À gagner : quête de l'Oracle");
  await expect(care.getByTestId('dragon-tint-ecume').locator('img[src="/art/icons/lock.webp"]')).toBeVisible();
  await closeOverlay(page);
  await expect(page.getByTestId('nest-dragon')).toBeFocused();
});

test('overlay-care: an in-world scroll, clear of the HUD, 48 px targets, kit classes only', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/dragon?panel=soin`);
  await expectInWorldOverlay(page, 'overlay-care', 'nest', true, 'scroll', 'dragon');
});

test('the HUD dragon leads to the nest; place and label sit in the safe zone', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/camp`);
  await expectCamp(page);
  await tap(page.getByTestId('hud-dragon'), testInfo);
  await expect(page).toHaveURL(/\/dragon$/);
  for (const size of [{ width: 1280, height: 720 }, { width: 1180, height: 820 }, { width: 1366, height: 1024 }]) {
    await page.setViewportSize(size);
    await expectScene(page, 'nest');
    await expectInSafeZone(page, 'nest', ['nest-dragon']);
  }
});

test('nest: ?debug outlines the dragon; no red; rotate screen', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/dragon?debug`);
  await expectScene(page, 'nest');
  await expect(page.getByTestId('hotspot-debug').locator('svg.outline')).toHaveCount(1);
  expect(await redScan(page)).toEqual([]);
  await page.setViewportSize({ width: 820, height: 1180 });
  await expect(page.getByTestId('rotate-screen')).toBeVisible();
});
```

- [ ] **Step 8: Verify**

Run: `scripts/npm.sh run test -- src/lib/world/scenes/ src/placesKit.test.ts src/registerGuard.test.ts src/components/places/headings.test.ts` and `scripts/npm.sh run check` — Expected: all pass, `0 errors and 0 warnings`.
Run: `STACK=home scripts/playwright.sh scenes-nest --repeat-each=3` — Expected: 5 tests × 2 projects × 3 pass.
Run: `STACK=home scripts/playwright.sh world --project=desktop` — Expected: 9 passed (tint change, hatch, naming and reload through the nest).

- [ ] **Step 9: Commit**

```bash
P="web/src/lib/world/scenes/nest.shapes.ts web/src/lib/world/scenes/nest.ts web/src/lib/world/scenes/nest.test.ts web/src/lib/world/scenes/index.ts web/src/lib/world/scenes/nextStep.test.ts web/src/screens/Nest.svelte web/src/screens/DragonScreen.svelte web/src/components/places/nest/CarePanel.svelte web/src/App.svelte web/e2e/scenes-nest.spec.ts web/e2e/world.spec.ts"
git add $P
git commit -m "UI3b: the dragon's nest - the dragon in the straw, its growth in the scene, its care as a scroll where it speaks

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- $P
```

### Task 5: The cabin and its trophy shelf — lane H

**Files:**
- Create: `web/src/lib/world/scenes/cabin.shapes.ts`, `web/src/lib/world/scenes/cabin.ts`, `web/src/lib/world/scenes/cabin.test.ts`, `web/src/screens/CabinRoom.svelte`, `web/e2e/scenes-cabin.spec.ts`
- Move: `web/src/screens/Cabin.svelte` → `web/src/components/places/cabin/TrophiesPanel.svelte` (`git mv`)
- Modify: `web/src/lib/world/scenes/index.ts` (Task 5 fence), `web/src/lib/world/scenes/nextStep.test.ts`, `web/src/App.svelte` (Tasks 5–6 fence), `web/e2e/world.spec.ts` (the `cabane` lines of steps 5 and 7)

**Interfaces:**
- Consumes: Task 1, `PlaceScene`, `Hotspot`, `Overlay`, `Medallion` (derives its kind), `openHotspot`, `closePanel`, `hotspotSelector`, `worldApi.rewards`, `treasureCaption` (camp.ts).
- Produces:
  - `cabin.ts`: `CABIN_HOTSPOTS` (ids `trophies` → `cabin` + `query: { panel: 'tresors' }`, `journal` → `stats`, `lyre` → `settings`), `CABIN_SCENE` (id `cabin`, plaque « Ta cabane »), `DECOR_SLOTS: { x: number; y: number }[]` (4 wall spots, art %, medallion centres).
  - `CabinRoom.svelte` props `{ profile: Profile; panel: PanelId | null }`; test ids `scene-cabin`, `cabin-trophies`, `cabin-journal`, `cabin-lyre`, `cabin-decor-<rewardId>`, `overlay-trophies` (Task 6 adds `overlay-journal`, `overlay-lyre`, `overlay-heros`).
  - `TrophiesPanel.svelte` props `{ profile: Profile; onChange?: () => void }` (kept test ids `cabin-reward-*` with `data-owned`, `cabin-equip-*`).

- [ ] **Step 1: Write the failing scene-data test**

`web/src/lib/world/scenes/cabin.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { boxesOverlap, shapeBox } from '../../scene/geometry';
import { validateScene } from '../../scene/validate';
import type { CampResponse } from '../types';
import { CABIN_HOTSPOTS, CABIN_SCENE, DECOR_SLOTS } from './cabin';

describe('the cabin (UI3 Ruling B6)', () => {
  it('is a valid scene whose plaque echoes the hub label', () => {
    expect(validateScene(CABIN_SCENE)).toEqual([]);
    expect(CABIN_SCENE).toMatchObject({ id: 'cabin', title: 'Ta cabane', background: '/art/scenes/cabin.webp' });
    expect(CABIN_SCENE.preload).toEqual(['/art/scenes/hub_camp.webp']);
  });

  it('opens the trophies, the journal and the lyre', () => {
    expect(CABIN_HOTSPOTS.map((h) => [h.id, h.target, h.query ?? null, h.label])).toEqual([
      ['trophies', 'cabin', { panel: 'tresors' }, 'Tes trésors'],
      ['journal', 'stats', null, 'Ton journal'],
      ['lyre', 'settings', null, 'La lyre'],
    ]);
    expect(CABIN_HOTSPOTS[0].state({ camp: { rewards_count: 2 } as CampResponse, catalog: null }).caption).toBe('2 trésors');
  });

  it('hangs the displayed decor on free wall spots inside the safe zone', () => {
    expect(DECOR_SLOTS).toHaveLength(4);
    for (const s of DECOR_SLOTS) {
      expect(s.x).toBeGreaterThan(14.5);
      expect(s.x).toBeLessThan(85.5);
      expect(s.y).toBeGreaterThan(17);
      const spot = { x: s.x - 2, y: s.y - 3.5, w: 4, h: 7 };
      for (const h of CABIN_HOTSPOTS) expect(boxesOverlap(spot, shapeBox(h.shape)), `${s.x},${s.y} vs ${h.id}`).toBe(false);
    }
  });
});
```

Add `CABIN_SCENE` to the one-glow sweep in `scenes/nextStep.test.ts`.

Run: `scripts/npm.sh run test -- src/lib/world/scenes/cabin.test.ts` — Expected: FAIL (`Cannot find module './cabin'`).

- [ ] **Step 2: Scene data**

`web/src/lib/world/scenes/cabin.shapes.ts`:

```ts
// Hotspot geometry of the cabin (cabin.webp), art % of the 16:9 frame, authored by hand from
// docs/art/scenes.md (trophy shelf clipped to x 12.5-41 and below the HUD band; the journal on the
// desk; the lamp and the lyre on the small table) and checked with `?debug`.
import type { ShapeMap } from '../../scene/types';

export const CABIN_SHAPES = {
  trophies: { kind: 'polygon', points: [[12.5, 14], [40, 14], [40, 64], [12.5, 64]] },
  journal: { kind: 'polygon', points: [[41, 47], [58, 47], [58, 78], [41, 78]] },
  lyre: { kind: 'polygon', points: [[59, 38], [73, 38], [73, 70], [59, 70]] },
} satisfies ShapeMap;
```

`web/src/lib/world/scenes/cabin.ts`:

```ts
// The hero's cabin (scenes UI spec §3 "Cabin scene", UI3 Ruling B6): the trophy shelf (rewards),
// the journal on the desk (stats), the lamp and the lyre (settings). Displayed decor hangs on the
// walls. The hero panel is an overlay here too (Ruling B2, Task 6).
import { ART } from '../art';
import { IDLE_HOTSPOT, type HotspotDef, type HotspotState, type SceneDef } from '../../scene/types';
import { treasureCaption } from './camp';
import { CABIN_SHAPES } from './cabin.shapes';

const st = (p: Partial<HotspotState> = {}): HotspotState => ({ ...IDLE_HOTSPOT, ...p });

export const CABIN_HOTSPOTS: HotspotDef[] = [
  {
    id: 'trophies',
    label: 'Tes trésors',
    target: 'cabin',
    query: { panel: 'tresors' },
    shape: CABIN_SHAPES.trophies,
    labelPos: 'below',
    leader: true,
    state: ({ camp }) => st({ caption: camp ? treasureCaption(camp.rewards_count) : null }),
  },
  { id: 'journal', label: 'Ton journal', target: 'stats', shape: CABIN_SHAPES.journal, labelPos: 'above', leader: true, state: () => st() },
  { id: 'lyre', label: 'La lyre', target: 'settings', shape: CABIN_SHAPES.lyre, labelPos: 'above', leader: true, state: () => st() },
];

export const CABIN_SCENE: SceneDef = {
  id: 'cabin',
  title: 'Ta cabane',
  background: ART.scenes.cabin,
  layers: [],
  hotspots: CABIN_HOTSPOTS,
  ambience: { particles: 'dust', music: null },
  narrator: { enter: 'cabin.enter', firstVisit: 'cabin.first' },
  preload: [ART.scenes.hubCamp],
};

/** Free wall spots for the displayed decor (medallion centres, art %): the back wall between the
 *  windows, the right-hand wall, the wall above the desk. Cycled if more decor is displayed. */
export const DECOR_SLOTS: { x: number; y: number }[] = [
  { x: 63.5, y: 22 },
  { x: 80, y: 26 },
  { x: 80, y: 42 },
  { x: 46, y: 30 },
];
```

Uncomment lane H's Task 5 lines in `scenes/index.ts`.

Run: `scripts/npm.sh run test -- src/lib/world/scenes/` — Expected: PASS.

- [ ] **Step 3: The trophy shelf panel — objects in cubbies on a wood board**

```bash
mkdir -p web/src/components/places/cabin
git mv web/src/screens/Cabin.svelte web/src/components/places/cabin/TrophiesPanel.svelte
sed -i "s#'\.\./components/#'../../#g; s#'\.\./lib/#'../../../lib/#g" web/src/components/places/cabin/TrophiesPanel.svelte
```

In `TrophiesPanel.svelte` (the loads, `ownedById`, `SECTIONS`, `itemsFor`, `toggleEquip` stay):
- props `{ profile, onChange }`: `toggleEquip` calls `onChange?.()` after a successful change (the cabin re-hangs its walls);
- delete the `TopBar` import and element, the banner block (`<div class="scene" …>` with the decor pins and `<h1>`) and what only it used (`DECOR_SLOTS`, `equippedDecor`, `.scene*`, `.decor-pin`);
- `<div class="screen cabin">` → `<div class="panel-trophies">`;
- errors `class="kit-note" data-tone="eris"`; the empty line `<p class="kit-note">Ta cabane attend ses premiers trésors. Chaque récompense est annoncée à l'avance : rien n'est tiré au sort.</p>`;
- each section `<h3 class="kit-section">{section.title}</h3>` and a row of cubbies:

```svelte
      <ul class="cubbies">
        {#each itemsFor(section.kind) as item (item.id)}
          {@const rewardRow = ownedById.get(item.id)}
          {@const isOwned = !!rewardRow}
          <li class="kit-cubby trophy" class:is-empty={!isOwned} data-testid="cabin-reward-{item.id}" data-owned={isOwned ? 'true' : 'false'}>
            {#if section.kind === 'tint'}
              <span class="tint-egg" style={`filter: ${isOwned ? TINT_FILTERS[tintKey(item.id)] : 'grayscale(1) opacity(.5)'}`}><img src={ART.dragon.egg} alt="" /></span>
            {:else}
              <Medallion rewardId={item.id} locked={!isOwned} size={64} />
            {/if}
            <h4 class="trophy-name">{item.name}</h4>
            <p class="trophy-desc">{item.desc}</p>
            {#if !isOwned}
              <p class="trophy-how">Comment l'obtenir : {item.source}</p>
            {:else if (section.kind === 'gear' || section.kind === 'decor') && rewardRow}
              <button type="button" class="kit-bronze is-quiet" data-testid="cabin-equip-{item.id}" disabled={equippingId === item.id} onclick={() => toggleEquip(item.id)}>
                {rewardRow.equipped ? 'Ranger' : 'Exposer'}
              </button>
            {/if}
          </li>
        {/each}
      </ul>
```

  with `.cubbies { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; list-style: none; margin: 0; padding: 0; }`, `.trophy { display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; padding: 14px 10px; }`, `.trophy.is-empty { opacity: 0.9; }`, `.trophy-name { margin: 0; }`, `.trophy-desc { margin: 0; font-size: 14px; }`, `.trophy-how { margin: 0; font-size: 14px; font-style: italic; color: var(--reward-ink); }` (check its contrast on the cubby with the table overlay's inks: the table variant sets light ink on wood, so if the cubby's inside is dark, use `--bronze-ink`-family tokens the way ShelvesPanel's cubby text does), and the tint egg rule from the old `.tint-circle`;
- delete `.grid`, `.reward-card*`, `.name`, `.desc`, `.source`, `.tint-circle` rules and the `card`/`btn` classes.

- [ ] **Step 4: Write `web/src/screens/CabinRoom.svelte`**

```svelte
<script lang="ts">
  // The hero's cabin (scenes UI spec §3, UI3 Ruling B6): the trophy shelf opens the rewards
  // (#/p/:id/cabane?panel=tresors), the journal the stats (#/p/:id/stats), the lyre the settings
  // (#/p/:id/settings). Displayed decor hangs on the walls; it reloads when the cabin opens and
  // whenever the shelf puts something on display or away.
  import PlaceScene from '../components/scene/PlaceScene.svelte';
  import Hotspot from '../components/scene/Hotspot.svelte';
  import Overlay from '../components/scene/Overlay.svelte';
  import Medallion from '../components/juice/Medallion.svelte';
  import TrophiesPanel from '../components/places/cabin/TrophiesPanel.svelte';
  import { CABIN_SCENE, DECOR_SLOTS } from '../lib/world/scenes/cabin';
  import { worldApi } from '../lib/world/api';
  import { closePanel, openHotspot } from '../lib/scene/panelNav';
  import { hotspotSelector } from '../lib/scene/hotspotId';
  import { OVERLAY_TITLES, sceneHref, type PanelId } from '../lib/world/places';
  import type { HotspotDef } from '../lib/scene/types';
  import type { RewardOut } from '../lib/world/types';
  import type { Profile } from '../lib/types';

  let { profile, panel }: { profile: Profile; panel: PanelId | null } = $props();

  let debug = $state(false);
  let owned = $state<RewardOut[]>([]);
  const displayed = $derived(owned.filter((r) => r.kind === 'decor' && r.equipped));

  // Only the hero id is tracked: the walls reload for a new hero, and on demand (onChange).
  let generation = 0;
  function loadWalls(id: number) {
    const mine = ++generation;
    worldApi
      .rewards(id)
      .then((list) => {
        if (mine === generation) owned = list;
      })
      .catch(() => {
        if (mine === generation) owned = [];
      });
  }
  $effect(() => loadWalls(profile.id));

  const activate = (def: HotspotDef) => openHotspot(def, profile.id);
  const close = () => closePanel(sceneHref('cabin', profile.id));
</script>

<PlaceScene {profile} scene={CABIN_SCENE} bind:debug>
  {#snippet children(ctx)}
    {#each displayed as r, i (r.id)}
      {@const slot = DECOR_SLOTS[i % DECOR_SLOTS.length]}
      <div class="cabin-decor" data-testid="cabin-decor-{r.id}" style="left:{slot.x}%;top:{slot.y}%">
        <Medallion rewardId={r.id} size={52} label={r.name} />
      </div>
    {/each}
    {#each CABIN_SCENE.hotspots as def (def.id)}
      <Hotspot {def} status={def.state(ctx)} sceneId="cabin" onActivate={activate} />
    {/each}
  {/snippet}
</PlaceScene>

{#if panel === 'tresors'}
  <Overlay variant="table" size="wide" title={OVERLAY_TITLES.tresors} testId="overlay-trophies" onClose={close} returnFocus={hotspotSelector('cabin', 'trophies')}>
    <TrophiesPanel {profile} onChange={() => loadWalls(profile.id)} />
  </Overlay>
{/if}

<style>
  .cabin-decor {
    position: absolute;
    z-index: 2;
    transform: translate(-50%, -50%);
    pointer-events: none;
    filter: drop-shadow(0 3px 5px rgba(0, 0, 0, 0.4));
  }
</style>
```

(`RewardOut` carries `id`, `kind`, `name`, `equipped`: check `web/src/lib/world/types.ts`; if `name` is absent, read it from `campStore.catalog?.rewards[r.id]?.name`.)

- [ ] **Step 5: Route the cabin**

In `web/src/App.svelte`, inside the Tasks 5–6 fence: `import Cabin …` → `import CabinRoom from './screens/CabinRoom.svelte';` (keep `Stats`, `Settings`: Task 6 removes them), and the `cabin` branch → a place branch placed before the still-legacy `stats`/`settings` branches:

```svelte
      {:else if view?.place === 'cabin' && route.name === 'cabin'}
        <CabinRoom profile={gateProfile} panel={view.panel} />
```

(The `route.name` guard is temporary: Task 6 drops it with the legacy branches.)

- [ ] **Step 6: Migrate the world spec**

`web/e2e/world.spec.ts`, steps 5 and 7: `await page.goto(\`/#/p/${profileId}/cabane\`);` → `await page.goto(\`/#/p/${profileId}/cabane?panel=tresors\`);` (the `cabin-reward-*`/`cabin-equip-*` assertions are unchanged). In step 7, after « Ranger » shows, add `await closeOverlay(page); await expect(page.getByTestId('cabin-decor-sandales_hermes')).toHaveCount(0);` (gear is not decor: it never hangs on the wall; import `closeOverlay`).

- [ ] **Step 7: Write the cabin e2e (both projects)**

`web/e2e/scenes-cabin.spec.ts`:

```ts
import { test, expect } from './crashGuard';
import type { Page } from '@playwright/test';
import {
  closeOverlay,
  createProfileApi,
  expectCamp,
  expectInSafeZone,
  expectInWorldOverlay,
  expectScene,
  labelOverlaps,
  redScan,
  tap,
  uniqueName,
} from './helpers';

// UI3b Tasks 5-6 (scenes spec §3 Cabin, §10). desktop + ipad.

const PLACES = ['cabin-trophies', 'cabin-journal', 'cabin-lyre'];
const heroName = (project: string) => uniqueName(`Cabane-${project}`);

async function openCabin(page: Page, id: number) {
  await page.goto(`/#/p/${id}/cabane`);
  await expectScene(page, 'cabin');
  await expect(page.getByTestId('hud-xp')).toBeVisible();
}

test('the cabin: its own room, three places, the exit', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openCabin(page, id);
  await expect(page.locator('[data-testid="scene-cabin"] .stage-plaque')).toHaveText('Ta cabane');
  await expect(page.locator('[data-testid="scene-cabin"] .art-bg')).toHaveAttribute('src', '/art/scenes/cabin.webp');
  for (const p of PLACES) await expect(page.getByTestId(p)).toBeVisible();
  await expect(page.getByTestId('cabin-trophies')).toContainText('Aucun trésor encore');
  await tap(page.getByTestId('scene-exit'), testInfo);
  await expectCamp(page);
});

test('the trophy shelf shows every reward, each known in advance', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openCabin(page, id);
  await tap(page.getByTestId('cabin-trophies'), testInfo);
  await expect(page).toHaveURL(/\/cabane\?panel=tresors$/);
  const shelf = page.getByTestId('overlay-trophies');
  await expect(shelf.getByRole('heading', { name: 'Tes trésors', level: 2 })).toBeVisible();
  for (const section of ['Reliques', 'Armes et armures divines', 'Objets de la cabane', 'Teintes']) {
    await expect(shelf.getByRole('heading', { name: section, level: 3 })).toBeVisible();
  }
  const sandals = shelf.getByTestId('cabin-reward-sandales_hermes');
  await expect(sandals).toHaveAttribute('data-owned', 'false');
  await expect(sandals).toContainText("Comment l'obtenir");
  await expect(sandals.locator('.medallion')).toHaveAttribute('aria-label', 'Récompense à découvrir');
  expect(await redScan(page)).toEqual([]);
  await closeOverlay(page);
  await expect(page).toHaveURL(/\/cabane$/);
  await expect(page.getByTestId('cabin-trophies')).toBeFocused();
});

test('overlay-trophies: an in-world table, clear of the HUD, 48 px targets, kit classes only', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/cabane?panel=tresors`);
  await expectInWorldOverlay(page, 'overlay-trophies', 'cabin', true, 'table', null);
});

test('places and labels sit in the safe zone, labels never cover another place', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  for (const size of [{ width: 1280, height: 720 }, { width: 1180, height: 820 }, { width: 1366, height: 1024 }]) {
    await page.setViewportSize(size);
    await openCabin(page, id);
    await expectInSafeZone(page, 'cabin', PLACES);
    expect(await labelOverlaps(page, 'cabin'), `${size.width}x${size.height}`).toEqual([]);
  }
});

test('cabin: ?debug outlines three places; no red; rotate screen', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/cabane?debug`);
  await expectScene(page, 'cabin');
  await expect(page.getByTestId('hotspot-debug').locator('svg.outline')).toHaveCount(3);
  expect(await redScan(page)).toEqual([]);
  await page.setViewportSize({ width: 820, height: 1180 });
  await expect(page.getByTestId('rotate-screen')).toBeVisible();
});
```

(Check the stage's background image selector: `.art-bg` or whatever `SceneStage.svelte` renders; use the one `scenes-library.spec.ts` uses if it asserts the background.)

- [ ] **Step 8: Verify**

Run: `scripts/npm.sh run test -- src/lib/world/scenes/ src/placesKit.test.ts src/registerGuard.test.ts src/components/places/headings.test.ts src/styles/` and `scripts/npm.sh run check` — Expected: all pass, `0 errors and 0 warnings`.
Run: `STACK=home scripts/playwright.sh scenes-cabin --repeat-each=3` — Expected: 5 tests × 2 projects × 3 pass.
Run: `STACK=home scripts/playwright.sh world --project=desktop` — Expected: 9 passed (owned tint, won sandals, « Exposer » / « Ranger » through the shelf).

- [ ] **Step 9: Commit**

```bash
P="web/src/lib/world/scenes/cabin.shapes.ts web/src/lib/world/scenes/cabin.ts web/src/lib/world/scenes/cabin.test.ts web/src/lib/world/scenes/index.ts web/src/lib/world/scenes/nextStep.test.ts web/src/screens/CabinRoom.svelte web/src/screens/Cabin.svelte web/src/components/places/cabin/TrophiesPanel.svelte web/src/App.svelte web/e2e/scenes-cabin.spec.ts web/e2e/world.spec.ts"
git add $P
git commit -m "UI3b: the cabin - its own room, the trophy shelf as cubbies on a wood board, displayed decor on the walls

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- $P
```

### Task 6: The journal, the lyre, and the hero panel moves into the cabin — lane H

**Files:**
- Move (`git mv`): `web/src/screens/Stats.svelte` → `web/src/components/places/cabin/JournalPanel.svelte`; `web/src/screens/Settings.svelte` → `web/src/components/places/cabin/LyrePanel.svelte`
- Create: `web/src/components/places/cabin/HeroPanel.svelte`, `web/src/lib/world/journal.ts`, `web/src/lib/world/journal.test.ts`
- Modify: `web/src/screens/CabinRoom.svelte`, `web/src/screens/Camp.svelte`, `web/src/lib/scene/panelNav.ts`, `web/src/lib/scene/panelNav.test.ts`, `web/src/App.svelte` (Tasks 5–6 fence), `web/src/registerGuard.test.ts` (empty `PENDING`)
- Modify: `web/e2e/scenes-cabin.spec.ts`, `web/e2e/scenes-camp.spec.ts` (the hero-panel tests), `web/e2e/happy-path.spec.ts`, `web/e2e/grimoire.spec.ts` (their assertions only)

**Interfaces:**
- Consumes: Task 5 (`CabinRoom.svelte`, `close`), Task 1, `openPanel`, `replacePanel`, `go`, `Icon`, `Avatar`, `clearProfile`, `LevelMedallions`, `CATEGORY_LABELS`, `plural`, `longDate`.
- Produces:
  - `heroPanelHref(profileId)` returns `#/p/<id>/cabane?panel=heros` (B2); the camp replaces `#/p/<id>/camp?panel=heros` with it once the hero is welcomed.
  - `journal.ts`: `HELP_STAGES = [1, 2, 3, 4]`, `helpStageLine(stage: number): string`.
  - `HeroPanel.svelte` props `{ profile: Profile }` (test ids `hero-settings`, `hero-journal`, `hero-switch`; links « La lyre », « Ton journal », « Changer de héros »).
  - `JournalPanel.svelte`, `LyrePanel.svelte` props `{ profile: Profile }`; overlays `overlay-journal` (codex), `overlay-lyre` (scroll), `overlay-heros` (scroll). New test ids: `journal-help`, `journal-totals`, `lyre-credits`.

- [ ] **Step 1: Write the failing tests**

`web/src/lib/scene/panelNav.test.ts`: the hero-chip expectation becomes `expect(heroPanelHref(3)).toBe('#/p/3/cabane?panel=heros');`.

`web/src/lib/world/journal.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { HELP_STAGES, helpStageLine } from './journal';

describe("the journal's words (UI3 Ruling B6; the register guard's « niveau » carry)", () => {
  it('says what the Muses do at each of the four stages, with no school word', () => {
    expect(HELP_STAGES).toEqual([1, 2, 3, 4]);
    expect(HELP_STAGES.map(helpStageLine)).toEqual([
      "Les yeux d'Argus éclairent chaque piège.",
      'Les Muses nomment les passes, sans les éclairer.',
      'Les Muses annoncent seulement le nombre de pièges.',
      'Les Muses te laissent relire sans aide.',
    ]);
    expect(helpStageLine(9)).toBe('');
    for (const s of HELP_STAGES) expect(helpStageLine(s)).not.toMatch(/niveau|classe|école/i);
  });
});
```

Append to `web/e2e/scenes-cabin.spec.ts`:

```ts
test('the journal opens as a codex: the Muses\' help, the tricks, the words, the defences', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openCabin(page, id);
  await tap(page.getByTestId('cabin-journal'), testInfo);
  await expect(page).toHaveURL(/\/stats$/);
  const journal = page.getByTestId('overlay-journal');
  await expect(journal.getByRole('heading', { name: 'Ton journal', level: 2 })).toBeVisible();
  await expect(journal.getByRole('heading', { name: "L'aide des Muses" })).toBeVisible();
  await expect(journal.getByTestId('journal-help').locator('[aria-current="step"]')).toHaveCount(1);
  for (const h of ['Ses ruses, une à une', 'Mots-pièges', 'Tes dernières défenses', 'Depuis le début']) {
    await expect(journal.getByRole('heading', { name: h })).toBeVisible();
  }
  await expect(journal.getByTestId('journal-totals')).toHaveText('0 texte défendu · 0 point · 0 piège déjoué');
  await expect(journal).not.toContainText(/niveau|partie/i);
  await closeOverlay(page);
  await expect(page.getByTestId('cabin-journal')).toBeFocused();
});

test('the lyre holds the settings, one mute with the HUD, the goal as medallions, the credits', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openCabin(page, id);
  await tap(page.getByTestId('cabin-lyre'), testInfo);
  await expect(page).toHaveURL(/\/settings$/);
  const lyre = page.getByTestId('overlay-lyre');
  await expect(lyre.getByRole('heading', { name: 'La lyre', level: 2 })).toBeVisible();
  await expect(lyre.getByRole('group', { name: 'Ta classe' })).toBeVisible();
  await expect(lyre.getByLabel('Nouveau code (quatre chiffres)')).toBeVisible();
  // The settings' mute and the HUD's are one switch (UI3a Ruling A17: the sliders are UI5).
  const mute = lyre.getByLabel('Couper les sons du jeu (la dictée reste lue)');
  await expect(mute).not.toBeChecked();
  await mute.check();
  await expect(page.getByTestId('hud-mute')).toHaveAttribute('aria-pressed', 'true');
  await lyre.getByRole('group', { name: 'Textes par semaine' }).getByRole('radio', { name: '4' }).check();
  await lyre.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(lyre.getByRole('status')).toHaveText("C'est noté.");
  await lyre.getByTestId('lyre-credits').locator('summary').click();
  await expect(lyre.getByTestId('lyre-credits')).toContainText('Wikisource');
  expect(await redScan(page)).toEqual([]);
  await closeOverlay(page);
  await expect(page).toHaveURL(/\/cabane$/);
});

test('the HUD hero chip opens the hero panel in the cabin from any place; its seal steps back', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/tente-parchemins`);
  await expectScene(page, 'library');
  await page.getByTestId('dialogue-skip').click();
  await page.getByTestId('hud-hero').click();
  await expect(page).toHaveURL(/\/cabane\?panel=heros$/);
  const panel = page.getByTestId('overlay-heros');
  await expect(panel.getByRole('heading', { name: 'Ton héros', level: 2 })).toBeVisible();
  for (const name of ['La lyre', 'Ton journal', 'Changer de héros']) await expect(panel.getByRole('link', { name })).toBeVisible();
  await expect(page.getByTestId('scene-cabin')).toHaveAttribute('inert', '');
  await closeOverlay(page);
  await expect(page).toHaveURL(/\/tente-parchemins$/);
  await page.getByTestId('hud-hero').click();
  await panel.getByRole('link', { name: 'Ton journal' }).click();
  await expect(page).toHaveURL(/\/stats$/);
  await closeOverlay(page); // steps back to the hero panel it came from
  await expect(panel).toBeVisible();
});

for (const o of [
  { hash: (id: number) => `/p/${id}/stats`, testId: 'overlay-journal', variant: 'codex' },
  { hash: (id: number) => `/p/${id}/settings`, testId: 'overlay-lyre', variant: 'scroll' },
  { hash: (id: number) => `/p/${id}/cabane?panel=heros`, testId: 'overlay-heros', variant: 'scroll' },
] as const) {
  test(`${o.testId}: an in-world ${o.variant}, clear of the HUD, 48 px targets, kit classes only`, async ({ page, request }, testInfo) => {
    const id = await createProfileApi(request, heroName(testInfo.project.name));
    await page.goto(`/#${o.hash(id)}`);
    await expectInWorldOverlay(page, o.testId, 'cabin', true, o.variant, null);
  });
}
```

(The goal radios' accessible names are their labels « 2 »…« 5 »; if `LevelMedallions` names them differently, match what it renders.)

Run: `scripts/npm.sh run test -- src/lib/scene/panelNav.test.ts src/lib/world/journal.test.ts` — Expected: FAIL. `STACK=home scripts/playwright.sh scenes-cabin` — Expected: the new tests FAIL.

- [ ] **Step 2: The journal's words**

`web/src/lib/world/journal.ts`:

```ts
// The journal's words (UI3 Ruling B6): what the Muses do at each help stage, said the camp's way
// (the old Stats said « niveau N sur 4 » and « Comme en classe », school register).
export const HELP_STAGES = [1, 2, 3, 4] as const;

const LINES: Record<number, string> = {
  1: "Les yeux d'Argus éclairent chaque piège.",
  2: 'Les Muses nomment les passes, sans les éclairer.',
  3: 'Les Muses annoncent seulement le nombre de pièges.',
  4: 'Les Muses te laissent relire sans aide.',
};

export function helpStageLine(stage: number): string {
  return LINES[stage] ?? '';
}
```

- [ ] **Step 3: Move the two screens into panels**

```bash
git mv web/src/screens/Stats.svelte web/src/components/places/cabin/JournalPanel.svelte
git mv web/src/screens/Settings.svelte web/src/components/places/cabin/LyrePanel.svelte
sed -i "s#'\.\./components/#'../../#g; s#'\.\./lib/#'../../../lib/#g" web/src/components/places/cabin/JournalPanel.svelte web/src/components/places/cabin/LyrePanel.svelte
```

**`JournalPanel.svelte` — a two-page codex** (the load, `categoryLabel`, `pct`, `categories` stay; delete `HELP_STAGE_DESCRIPTIONS`, `formatDate`, the subtitle and the `TopBar`):

```svelte
<div class="codex-spread panel-journal">
  <section class="codex-page page-left">
    {#if loading}
      <p class="muted">Les Muses ouvrent ton journal…</p>
    {:else if error}
      <p class="kit-note" data-tone="eris">Impossible d'ouvrir ton journal : {error}</p>
    {:else if stats}
      <h3>L'aide des Muses</h3>
      <div class="help" data-testid="journal-help">
        <ol class="help-stages">
          {#each HELP_STAGES as s (s)}
            <li class="kit-medallion is-small" aria-current={s === stats.profile.help_stage ? 'step' : undefined}>{s}</li>
          {/each}
        </ol>
        <p>{helpStageLine(stats.profile.help_stage)}</p>
      </div>
      <h3>Ses ruses, une à une</h3>
      {#if categories.length === 0}
        <p class="muted">Éris n'a encore rien noté. Défends un texte !</p>
      {:else}
        <table class="tricks">
          <thead><tr><th>Ruse</th><th>Pièges</th><th>Déjoués</th><th>Réussite</th></tr></thead>
          <tbody>
            {#each categories as c (c.category)}
              <tr><td>{categoryLabel(c.category)}</td><td>{c.errors_in_draft}</td><td>{c.caught}</td><td>{pct(c.catch_rate)}</td></tr>
            {/each}
          </tbody>
        </table>
      {/if}
    {/if}
  </section>
  <section class="codex-page page-right">
    {#if stats}
      <h3>Mots-pièges</h3>
      {#if stats.trap_words.length === 0}
        <p class="muted">Aucun mot-piège pour l'instant.</p>
      {:else}
        <ul class="trap-words">
          {#each stats.trap_words as w (w.word)}
            <li>
              <span class="trap-word">{w.word}</span>
              <span class="leaves" role="img" aria-label="{plural(w.box, 'feuille', 'feuilles')} de laurier sur 5">
                {#each [1, 2, 3, 4, 5] as n (n)}<span class="leaf" class:filled={n <= w.box}></span>{/each}
              </span>
            </li>
          {/each}
        </ul>
      {/if}
      <h3>Tes dernières défenses</h3>
      {#if stats.recent_sessions.length === 0}
        <p class="muted">Aucun texte défendu pour l'instant.</p>
      {:else}
        <ul class="defences">
          {#each stats.recent_sessions as s (s.id)}
            <li>
              <span class="defence-title">{s.title}</span>
              <span class="defence-meta">{longDate(s.finished_at.slice(0, 10))} · {plural(s.score, 'point', 'points')} · {pct(s.catch_rate)} déjoués</span>
              {#if s.mode === 'grimoire'}<span class="kit-stamp">Grimoire</span>{/if}
            </li>
          {/each}
        </ul>
      {/if}
      <h3>Depuis le début</h3>
      <p data-testid="journal-totals">{plural(stats.totals.sessions, 'texte défendu', 'textes défendus')} · {plural(stats.totals.score, 'point', 'points')} · {plural(stats.totals.caught, 'piège déjoué', 'pièges déjoués')}</p>
    {/if}
  </section>
</div>
```

imports: `HELP_STAGES`, `helpStageLine` from `../../../lib/world/journal`, `plural`, `longDate` from `../../../lib/text/french`. Style: `.help-stages { display: flex; gap: 10px; list-style: none; margin: 0 0 6px; padding: 0; }`, `.help-stages [aria-current='step'] { border-color: var(--gold-light); box-shadow: 0 0 0 3px var(--gold-light), 0 0 12px rgba(255, 220, 140, 0.8); }`, the table like the codex text (no white cells), `.trap-words` as a list of ink words with five small laurel leaves each (the camp's weekly-ribbon leaf shape, `.leaf.filled` gold), `.defences li` a line of text (no white card), `.defence-title` Alegreya 600. Keep `pct` with a no-break space before « % ». Delete every legacy rule (`.card`, `.chip*`, the `#fff` session boxes).

**`LyrePanel.svelte` — the settings on a scroll** (all logic stays; `weeklyGoal` becomes a string for the medallions: `let weeklyGoal = $state(String(untrack(() => profile.settings.weekly_goal ?? 3)));` and the patch sends `Number(weeklyGoal)`):
- delete the `TopBar`; `<div class="screen">` → `<div class="panel-lyre">`;
- `<h2>Voix de la dictée</h2>` → `<h3 class="kit-section">La voix de la dictée</h3>`; the no-voice help becomes `<p class="kit-note">Aucune voix française sur cet appareil. Sur iPad : ouvre Réglages, puis Accessibilité, puis Contenu énoncé, puis Voix, puis Français.</p>`; « Écouter un essai » is `class="kit-bronze is-quiet"`;
- « Ta classe » keeps `LevelMedallions` (drop the `:global(legend)` rule; `kit-form` styles the legend);
- `<h2>Son</h2>` → `<h3 class="kit-section">Les sons</h3>`;
- `<h2>Objectif de la semaine</h2>` → `<h3 class="kit-section">Ton objectif</h3>` and the select becomes `<LevelMedallions legend="Textes par semaine" name="weekly-goal" options={['2', '3', '4', '5']} bind:value={weeklyGoal} />`;
- `<h2>Code</h2>` → `<h3 class="kit-section">Ton sceau</h3>`; the label « Nouveau code (quatre chiffres) » stays; « Retirer le code » becomes `class="kit-link"` « Retirer le sceau »;
- errors `class="kit-note" data-tone="eris"`, toast `class="kit-note" role="status"`, submit `class="kit-bronze"` « Enregistrer »;
- the credits (immersion Deferred #7), after the form:

```svelte
<details class="lyre-credits" data-testid="lyre-credits">
  <summary class="kit-link">Merci à ceux qui ont aidé le camp</summary>
  <p>Les lettres du camp : Cinzel, Alegreya et Literata, offertes par leurs auteurs sous la licence SIL Open Font.</p>
  <p>Les livres d'Alexandrie viennent de Wikisource et du Projet Gutenberg. Chaque œuvre garde le nom de son auteur et de son traducteur.</p>
  <p>Les peintures du camp ont été faites pour lui.</p>
</details>
```

- delete `section { margin-bottom }`, `select`, `.toast`, `.class-section` rules.

- [ ] **Step 4: The hero panel component**

`web/src/components/places/cabin/HeroPanel.svelte` (the camp overlay's content, moved; each medallion opens the cabin's own overlay with `openPanel`, so its seal steps back to this panel):

```svelte
<script lang="ts">
  // The hero panel (UI1 Ruling 6, carry #4 → UI3 Ruling B2): three bronze medallions. It lives in the
  // cabin; the HUD's hero chip is its shortcut from every place.
  import Avatar from '../../Avatar.svelte';
  import Icon from '../../ui/Icon.svelte';
  import { clearProfile } from '../../../lib/profileStore.svelte';
  import { openPanel } from '../../../lib/scene/panelNav';
  import { unlockAudio, playSfx } from '../../../lib/juice/sfx';
  import { href } from '../../../lib/routes';
  import type { Profile } from '../../../lib/types';

  let { profile }: { profile: Profile } = $props();

  const profileId = $derived(String(profile.id));

  // Another overlay of the cabin: a tagged push, so its seal steps back here (Ruling A2).
  function inCabin(e: MouseEvent, path: string) {
    e.preventDefault();
    unlockAudio();
    playSfx('tap');
    openPanel(path);
  }
</script>

<div class="hero-panel">
  <Avatar avatar={profile.avatar} size={72} ring />
  <p class="hero-name">{profile.name}</p>
  <nav class="medallions" aria-label="Ton héros">
    <a class="medallion" data-testid="hero-settings" href={href('settings', { profileId })} onclick={(e) => inCabin(e, href('settings', { profileId }))}>
      <span class="medallion-disc" aria-hidden="true"><Icon name="lyre" size={34} /></span>
      <span class="medallion-caption">La lyre</span>
    </a>
    <a class="medallion" data-testid="hero-journal" href={href('stats', { profileId })} onclick={(e) => inCabin(e, href('stats', { profileId }))}>
      <span class="medallion-disc" aria-hidden="true"><Icon name="journal" size={34} /></span>
      <span class="medallion-caption">Ton journal</span>
    </a>
    <a class="medallion" data-testid="hero-switch" href={href('profiles')} onclick={() => clearProfile()}>
      <span class="medallion-disc" aria-hidden="true"><Icon name="shield" size={34} /></span>
      <span class="medallion-caption">Changer de héros</span>
    </a>
  </nav>
</div>
```

and move the hero-panel CSS rules from `Camp.svelte` (`.hero-panel`, `.hero-name`, `.medallions`, `.medallion`, `.medallion-disc`, `.medallion:active …`, `.medallion:focus-visible …`, `.medallion-caption`) into its `<style>` unchanged. (Use `go(path, 'panel')` instead of the three calls in `inCabin` if `go` suits: it does exactly unlock + tap + `openPanel`.)

- [ ] **Step 5: Three more overlays in the cabin; the hero chip points there**

`web/src/screens/CabinRoom.svelte`: import `JournalPanel`, `LyrePanel`, `HeroPanel` and extend the overlay chain:

```svelte
{:else if panel === 'journal'}
  <Overlay variant="codex" title={OVERLAY_TITLES.journal} testId="overlay-journal" onClose={close} returnFocus={hotspotSelector('cabin', 'journal')}>
    <JournalPanel {profile} />
  </Overlay>
{:else if panel === 'lyre'}
  <Overlay variant="scroll" title={OVERLAY_TITLES.lyre} testId="overlay-lyre" onClose={close} returnFocus={hotspotSelector('cabin', 'lyre')}>
    <LyrePanel {profile} />
  </Overlay>
{:else if panel === 'heros'}
  <Overlay variant="scroll" title={OVERLAY_TITLES.heros} testId="overlay-heros" onClose={close} returnFocus={'[data-testid="hud-hero"]'}>
    <HeroPanel {profile} />
  </Overlay>
{/if}
```

(The journal and the lyre opened from the hero panel return focus to its medallion when their seal steps back: track `openedFrom` as in `WarTent.svelte` and use `'[data-testid="hero-journal"]'` / `'[data-testid="hero-settings"]'` when it is `'heros'`.)

`web/src/lib/scene/panelNav.ts`: `heroPanelHref` returns `href('cabin', { profileId: String(profileId) }, { panel: 'heros' })`, comment `/** Where the HUD's hero chip leads: the hero panel in the cabin (UI3 Ruling B2, carry #4). */`.

`web/src/screens/Camp.svelte`:
- delete the `{#if panel === 'heros' && profile.settings.onboarded} <Overlay …> … </Overlay> {/if}` block, `closeHeroPanel`, the hero-panel CSS rules, and the imports left unused (`Overlay`, `Avatar`, `Icon`, `clearProfile`, `closePanel`, `OVERLAY_TITLES`, `sceneHref`);
- keep `panel`, and hand over the route (import `replacePanel`, `heroPanelHref` from `../lib/scene/panelNav`):

```ts
  // UI3 Ruling B2: `?panel=heros` stays a route; once the Muses' welcome is over (fix wave 3: the
  // onboarding takes precedence) it hands over to the hero panel in the cabin. replacePanel keeps a
  // tagged entry tagged, so the panel's seal still steps back to where it was opened.
  $effect(() => {
    if (panel === 'heros' && profile.settings.onboarded) replacePanel(heroPanelHref(profile.id));
  });
```

`web/src/App.svelte`, inside the Tasks 5–6 fence: delete the `Stats` and `Settings` imports and branches, and drop the temporary `route.name` guard of the cabin branch (`{:else if view?.place === 'cabin'}`).

`web/src/registerGuard.test.ts`: `PENDING` becomes empty (`new Set<string>([])`); the journal and the lyre are scanned through `components/places`.

- [ ] **Step 6: Migrate the specs that used the camp's hero panel**

- `web/e2e/scenes-camp.spec.ts`, « the hero panel: its own route, medallions, focus kept inside… » → rename « the hero chip opens the hero panel in the cabin; closing steps back, a deep link hands over ». Keep its console/pageerror and focus-count setup; change:
  - `const stage = page.getByTestId('scene-camp');` → `page.getByTestId('scene-cabin')`;
  - `toHaveURL(/\/camp\?panel=heros$/)` → `toHaveURL(/\/cabane\?panel=heros$/)`;
  - the medallion names → `['La lyre', 'Ton journal', 'Changer de héros']`;
  - the particles check reads the cabin's `fx-canvas` (scope it: `page.getByTestId('scene-cabin').getByTestId('fx-canvas')`);
  - after Escape the URL is `/\/camp$/` again (the tagged entry steps back to the camp it was opened from), and the focus count, the Back-closes and the no-Back-trap checks keep their meaning;
  - the two deep links `/#/p/${id}/camp?panel=heros` stay (they prove the hand-over): expect `toHaveURL(/\/cabane\?panel=heros$/)` and the panel, then after the seal `toHaveURL(/\/cabane$/)`; for the first one end with `await page.goBack(); await expect(page).not.toHaveURL(/panel=heros/);`;
  - the last lines: `panel.getByRole('link', { name: 'La lyre' }).click()` → `toHaveURL(/\/settings$/)`.
- « a deep link to the hero panel waits for the onboarding card »: after `onboarding-skip`, expect `toHaveURL(/\/cabane\?panel=heros$/)`, `overlay-heros` visible, `scene-cabin` inert, the Tab loop inside `overlay-heros`, and after the seal `scene-cabin` not inert.
- « no red on the hub, its greeting or the hero panel »: unchanged (the panel opens in the cabin; same test id).
- `web/e2e/happy-path.spec.ts`: its stats assertions become `await expect(page.getByTestId('journal-totals')).toContainText('1 texte défendu');` and `await expect(page.getByText("Accord du verbe avec son sujet (L'Hydre)").first()).toBeVisible();`.
- `web/e2e/grimoire.spec.ts`: `await expect(page.getByTestId('overlay-journal').getByText('Grimoire').first()).toBeVisible();` (the stamp).

- [ ] **Step 7: Verify**

Run: `scripts/npm.sh run test -- src/lib/scene/panelNav.test.ts src/lib/world/journal.test.ts src/placesKit.test.ts src/registerGuard.test.ts src/formPlural.test.ts src/components/places/headings.test.ts` and `scripts/npm.sh run check` — Expected: all pass, `0 errors and 0 warnings`.
Run: `STACK=home scripts/playwright.sh scenes-cabin --repeat-each=3` — Expected: every test × 2 projects × 3 passes.
Run: `STACK=home scripts/playwright.sh scenes-camp happy-path grimoire profiles` — Expected: all pass (`profiles.spec`'s « Changer de héros » goes through the cabin's hero panel).
Run (end of lane H): `STACK=home PW_WORKERS=4 scripts/check.sh` — Expected: `== ALL GREEN`.

- [ ] **Step 8: Commit**

```bash
P="web/src/screens/Stats.svelte web/src/screens/Settings.svelte web/src/components/places/cabin/JournalPanel.svelte web/src/components/places/cabin/LyrePanel.svelte web/src/components/places/cabin/HeroPanel.svelte web/src/lib/world/journal.ts web/src/lib/world/journal.test.ts web/src/screens/CabinRoom.svelte web/src/screens/Camp.svelte web/src/lib/scene/panelNav.ts web/src/lib/scene/panelNav.test.ts web/src/App.svelte web/src/registerGuard.test.ts web/e2e/scenes-cabin.spec.ts web/e2e/scenes-camp.spec.ts web/e2e/happy-path.spec.ts web/e2e/grimoire.spec.ts"
git add $P
git commit -m "UI3b: the journal as a codex, the lyre with the credits; the hero panel moves into the cabin, the HUD chip is its shortcut

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- $P
```

**After B2:** the controller merges `ui3b-war` and `ui3b-home` into `scenes` (the fenced hunks merge cleanly; if git still reports a conflict inside a fence, keep both sides' lines), deletes the fence comments that are now empty in `App.svelte` and `scenes/index.ts` in a small follow-up commit, and runs `PW_WORKERS=4 scripts/check.sh` once.

### Task 7: The hub on `hub_camp.webp` (six places, badges, news captions, one glow, the locked path to battle)

**Files:**
- Modify (full replacement below): `web/src/lib/world/scenes/camp.shapes.ts`, `web/src/lib/world/scenes/camp.ts`, `web/src/lib/world/scenes/camp.test.ts`
- Modify: `web/src/lib/world/quests.ts` (+ test), `web/src/components/places/delphi/TabletsPanel.svelte`, `web/src/screens/Camp.svelte`, `web/src/lib/world/scenes/{title,library,delphi}.ts` and their tests (preload), `web/src/lib/world/places.test.ts` (the W13 hub test)
- Modify: `web/e2e/scenes-camp.spec.ts`, `web/e2e/scenes-debug.spec.ts` (if needed), `web/e2e/world.spec.ts` (the `camp-*` lines)

**Interfaces:**
- Consumes: Task 1 (`nextStep`, `HUB_PLACE`, `nextStepLine`, `dragonSpeaker`, `dragonSays`, the painted lock), Tasks 2–6 (the places exist), `nearestProphecy`, `prophecyWhen`, `lieutenantName`, `stirringCaption`.
- Produces (`camp.ts`):
  - `CampHotspotId = 'dragon' | 'oracle' | 'parchemins' | 'dossier' | 'cabin' | 'boss'`; `CAMP_HOTSPOTS`; `CAMP_SCENE` (background `/art/scenes/hub_camp.webp`).
  - `campNews(camp, catalog): Partial<Record<CampHotspotId, string>>` (≤ 3, priority boss → oracle → parchemins → dragon → dossier).
  - `bossLocked(camp)`, `bossLockLine(camp)`, `campDragonLayer(stage)`.
  - Kept: `dragonCaption`, `bossRewardName`, `treasureCaption`, `weeklyCaption`, `campGreeting`, `campNextStep`, `nextStepLine` (re-export). Removed: `CAMP_DRAGON_LAYER`, `bestiaryCaption`.
  - `quests.ts`: `tricksBeforeEris(camp: CampResponse): number` (shared with the quest wall).
  - Test ids: `camp-<id>` for the six places, `camp-oracle-badge`, `camp-dossier-badge`, `camp-weekly`, `camp-dragon-layer`; `camp-quests`, `camp-bestiary`, `camp-prophecy`, `camp-column` are gone.

- [ ] **Step 1: Write the failing tests**

`web/src/lib/world/quests.test.ts`: add

```ts
  it('counts the tricks still to foil before Éris comes out (the wall and the hub agree)', () => {
    const c = (neutralised: number, won: number[] = []) => ({ dragon: { neutralised, available: 6 }, boss: { tiers_won: won } }) as unknown as CampResponse;
    expect([tricksBeforeEris(c(0)), tricksBeforeEris(c(1)), tricksBeforeEris(c(2)), tricksBeforeEris(c(2, [1]))]).toEqual([2, 1, 0, 2]);
  });
```

Replace `web/src/lib/world/scenes/camp.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { validateScene } from '../../scene/validate';
import type { CampResponse, LieutenantState, QuestOut, WorldCatalog } from '../types';
import { nextStep, HUB_PLACE } from '../nextStep';
import {
  CAMP_HOTSPOTS,
  CAMP_SCENE,
  bossLockLine,
  campDragonLayer,
  campGreeting,
  campNews,
  dragonCaption,
  treasureCaption,
  weeklyCaption,
} from './camp';

function camp(over: Partial<CampResponse> = {}): CampResponse {
  return {
    profile: { id: 7, name: 'Ariane' } as CampResponse['profile'],
    xp: { total: 0, rank: 1, title: 'Recrue du camp', next_threshold: 150, rank_floor: 0 },
    dragon: { name: null, tint: 'bronze', stage: 'egg', neutralised: 0, available: 6, next_stage_at: 1, unlocked_tints: ['bronze'] },
    lieutenants: [],
    quests: [],
    oracle: { week: '2026-W39', status: 'sealed', reward_id: null },
    prophecies: [],
    weekly: { week: '2026-W39', target: 3, done: 0, reached: false },
    boss: { tier_available: null, tiers_won: [], active_quest_id: null },
    rewards_count: 0,
    small_tricks: { traps: 0, caught: 0 },
    ...over,
  };
}
const catalog = {
  boss_rewards: { '1': 'sandales' },
  rewards: { sandales: { id: 'sandales', kind: 'gear', name: "Sandales d'Hermès", desc: '', source: '' } },
} as unknown as WorldCatalog;
const state = (id: string, c: CampResponse | null, cat: WorldCatalog | null = null) => CAMP_HOTSPOTS.find((h) => h.id === id)!.state({ camp: c, catalog: cat });
const ready = (over: Partial<CampResponse> = {}) => camp({ boss: { tier_available: 1, tiers_won: [], active_quest_id: null }, ...over });
const seasoned = { total: 40, rank: 1, title: 'Recrue du camp', next_threshold: 150, rank_floor: 0 };
const chosen = { week: 'w', status: 'chosen' as const, reward_id: null };
const hatchling = { ...camp().dragon, stage: 'hatchling' as const };
const echoStirs = [{ key: 'echo', name: 'Écho', stirring: true, neutralised: false, available: true }] as LieutenantState[];
const prophecy = (days: number) => [{ text_id: 1, title: 'La mer', due_date: '2026-09-27', days_left: days }];

describe('the hub on hub_camp.webp (UI3 Ruling B3)', () => {
  it('is a valid scene with the six places of the painted camp, each pinned to its landmark', () => {
    expect(validateScene(CAMP_SCENE)).toEqual([]);
    expect(CAMP_SCENE).toMatchObject({ title: 'Le camp', background: '/art/scenes/hub_camp.webp' });
    expect(Object.fromEntries(CAMP_HOTSPOTS.map((h) => [h.id, h.target]))).toEqual({
      dragon: 'dragon',
      oracle: 'delphi',
      parchemins: 'library-tent',
      dossier: 'war-tent',
      cabin: 'cabin',
      boss: 'boss',
    });
    for (const h of CAMP_HOTSPOTS) expect(h.leader === true || h.labelPos === 'on', h.id).toBe(true);
  });

  it('always shows the path to battle, locked until Éris can be fought', () => {
    for (const h of CAMP_HOTSPOTS) expect(h.state({ camp: null, catalog: null }).visible, h.id).toBe(true);
    expect(state('boss', null).locked).toBe(true);
    expect(state('boss', camp())).toMatchObject({ locked: true, caption: null, isNew: false });
    expect(state('boss', ready(), catalog)).toMatchObject({ locked: false, isNew: true, caption: "Combat 1 : Sandales d'Hermès" });
    expect(state('boss', ready(), null).caption).toBe('Combat 1 : une récompense');
  });

  it("explains the locked path in the dragon's words", () => {
    expect(bossLockLine(camp())).toBe('Éris se cache encore. Neutralise encore 2 ruses et elle sortira.');
    expect(bossLockLine(camp({ dragon: { ...camp().dragon, neutralised: 1 } }))).toBe('Éris se cache encore. Neutralise encore une ruse et elle sortira.');
    expect(bossLockLine(camp({ boss: { tier_available: null, tiers_won: [1, 2, 3], active_quest_id: null } }))).toBe('Éris est vaincue trois fois. Elle boude, loin du camp.');
  });

  it('captions only the places with news, three at most, in priority order', () => {
    expect(campNews(camp({ xp: seasoned, oracle: chosen }), null)).toEqual({});
    const busy = ready({ xp: seasoned, prophecies: prophecy(2), dragon: hatchling, lieutenants: echoStirs });
    expect(campNews(busy, catalog)).toEqual({ boss: "Combat 1 : Sandales d'Hermès", oracle: 'Une prophétie, dans 2 jours', dragon: 'Il attend un nom' });
    expect(state('dossier', busy, catalog).caption).toBeNull();
    expect(campNews(camp({ xp: seasoned, dragon: hatchling, lieutenants: echoStirs }), null)).toEqual({
      oracle: 'Trois rouleaux à ouvrir',
      dragon: 'Il attend un nom',
      dossier: "Écho s'agite",
    });
    expect(campNews(camp(), null)).toEqual({ oracle: 'Trois rouleaux à ouvrir', parchemins: 'Choisis un texte à défendre' });
  });

  it('glows on at most one place: the one the shared next step names (Ruling B9)', () => {
    const cases = [camp(), ready(), camp({ xp: seasoned, prophecies: prophecy(3), oracle: chosen }), camp({ xp: seasoned }), camp({ xp: seasoned, oracle: chosen })];
    for (const c of cases) {
      const glowing = CAMP_HOTSPOTS.filter((h) => h.state({ camp: c, catalog }).isNew).map((h) => h.id);
      const step = nextStep(c);
      expect(glowing).toEqual(step ? [HUB_PLACE[step]] : []);
    }
  });

  it('carries the quest count on the Delphi plaque and the foiled tricks on the war-tent plaque', () => {
    const quests = [{ status: 'active' }, { status: 'active' }, { status: 'done' }] as QuestOut[];
    expect(state('oracle', camp({ quests })).badge).toBe(2);
    expect(state('oracle', camp()).badge).toBeNull();
    const lieutenants = [{ key: 'hydre', neutralised: true }, { key: 'echo', neutralised: false }] as LieutenantState[];
    expect(state('dossier', camp({ lieutenants })).badge).toBe(1);
    expect(state('dossier', camp()).badge).toBeNull();
  });

  it('greets with three static dragon lines, the last one naming the next step', () => {
    const lines = campGreeting('Ariane', camp());
    expect(lines.map((l) => l.text)).toEqual([
      'Bienvenue au camp, Ariane.',
      "L'œuf frémit chaque fois qu'un piège d'Éris est déjoué.",
      "Les parchemins t'attendent, sous la tente.",
    ]);
    expect(lines[0]).toMatchObject({ speaker: 'dragon', name: "L'œuf", portrait: '/art/dragon/dragon_egg_cut.webp', portraitFilter: 'none' });
  });

  it('seats the dragon in the painted nest, on a shallow plane; preloads the tent and the temple', () => {
    expect(campDragonLayer('egg')).toMatchObject({ x: 17, y: 55, depth: 1 });
    expect(campDragonLayer('adult').scale).toBeGreaterThan(campDragonLayer('egg').scale);
    expect(CAMP_SCENE.preload).toEqual(['/art/scenes/library_tent.webp', '/art/scenes/delphi.webp']);
  });

  it('keeps the words the other places use', () => {
    expect(dragonCaption(camp().dragon)).toBe('Un œuf de dragon');
    expect([0, 1, 2].map(treasureCaption)).toEqual(['Aucun trésor encore', '1 trésor', '2 trésors']);
    expect(weeklyCaption({ week: 'w', target: 3, done: 1, reached: false })).toBe('Cette semaine : 1 / 3 parchemins défendus');
    expect(weeklyCaption({ week: 'w', target: 3, done: 3, reached: true })).toBe('Objectif atteint ! Les Muses sont fières.');
  });
});
```

(`prophecyWhen` puts no-break spaces in « dans 2 jours »: build the expected caption with `prophecyWhen(2)` if the literal does not match.)

In `delphi.test.ts`, `library.test.ts` and `title.test.ts` (if it pins the preload), the preload becomes `['/art/scenes/hub_camp.webp']`. In `places.test.ts`, « calls the quest wall the same on the hub (Ruling W13) » becomes « the hub's Delphi plaque carries the quest count now that the wall lives in the temple (Ruling B3) »: `expect(CAMP_HOTSPOTS.map((h) => h.id)).not.toContain('quests');` and `expect(DELPHI_HOTSPOTS.find((h) => h.id === 'tablets')!.label).toBe(OVERLAY_TITLES.tablettes);`.

Run: `scripts/npm.sh run test -- src/lib/world/` — Expected: FAIL (missing exports, old targets, old background, old preloads).

- [ ] **Step 2: New shapes**

Replace `web/src/lib/world/scenes/camp.shapes.ts` with:

```ts
// Hotspot geometry of the hub (hub_camp.webp), art % of the 16:9 frame, authored by hand from
// docs/art/scenes.md and checked with `?debug` (UI3 Ruling B3). The nest and the cabin overhang the
// 4:3 safe zone in the art and are clipped at 12.5 / 87.5. The library tent's box starts at its eaves
// (y 42) and the oracle's ends at the upper stairs (y 31), so the oracle's plaque fits between them;
// the war tent's box starts under the spear tips (y 43), so the battle path's plaque fits above it.
// The two overlaps UI3a left open (oracle/parchemins, dossier/cabin labels) are what these bounds and
// the label positions in camp.ts solve; scenes-camp.spec.ts proves labelOverlaps() is empty.
import type { ShapeMap } from '../../scene/types';

export const CAMP_SHAPES = {
  dragon: { kind: 'polygon', points: [[12.5, 44], [23, 42], [25, 50], [24, 66], [12.5, 66]] },
  oracle: { kind: 'polygon', points: [[22.5, 14], [36, 14], [36, 22], [33, 31], [27, 31], [22.5, 22]] },
  parchemins: { kind: 'polygon', points: [[33, 42], [51, 42], [51, 61], [33, 61]] },
  dossier: { kind: 'polygon', points: [[54, 43], [74, 43], [74, 70], [54, 70]] },
  boss: { kind: 'polygon', points: [[65, 20], [75, 20], [75, 33], [65, 33]] },
  cabin: { kind: 'polygon', points: [[76, 56], [86, 54], [87.5, 60], [87.5, 78], [76, 78]] },
} satisfies ShapeMap;
```

- [ ] **Step 3: New scene data**

`web/src/lib/world/quests.ts`: add

```ts
/** How many tricks are still to foil before Éris comes out of hiding (the boss rule, SP3 decision
 *  8): one tier per third of the available lieutenants. One source for the quest wall and the hub. */
export function tricksBeforeEris(camp: CampResponse): number {
  const need = Math.ceil((camp.dragon.available * (camp.boss.tiers_won.length + 1)) / 3);
  return Math.max(0, need - camp.dragon.neutralised);
}
```

and in `TabletsPanel.svelte` replace the inline `available`/`neutralised`/`won`/`need` consts by `{@const left = tricksBeforeEris(campStore.data)}` and `Neutralise encore {plural(left, 'ruse', 'ruses')} pour la faire sortir.`.

Replace `web/src/lib/world/scenes/camp.ts` with:

```ts
// The camp as a hub scene on hub_camp.webp (scenes UI spec §3 "Hub scene", UI3 Ruling B3): six
// places pinned to their painted landmarks, captions only where there is news (three at most), one
// next-step glow (Ruling B9), the path to battle locked until Éris can be fought.
import { ART } from '../art';
import { stageLabel, stageLine } from '../dragon';
import { stirringCaption } from '../eris';
import { HUB_PLACE, nextStep, nextStepLine } from '../nextStep';
import { nearestProphecy, prophecyWhen } from '../prophecy';
import { tricksBeforeEris } from '../quests';
import type { CampResponse, DragonOut, DragonStage, LieutenantKey, WorldCatalog } from '../types';
import { IDLE_HOTSPOT, type DialogueLine, type HotspotDef, type HotspotState, type SceneContext, type SceneDef, type SceneLayerDef } from '../../scene/types';
import { dragonSpeaker } from './speakers';
import { CAMP_SHAPES } from './camp.shapes';

export { nextStepLine };

export type CampHotspotId = keyof typeof CAMP_SHAPES;

const st = (p: Partial<HotspotState> = {}): HotspotState => ({ ...IDLE_HOTSPOT, ...p });

/** The dragon's identity: its name, else what it is (the nest's caption). */
export function dragonCaption(d: DragonOut): string {
  return d.name ?? (d.stage === 'egg' ? 'Un œuf de dragon' : stageLabel(d.stage));
}

/** The boss reward "known in advance" (SP3 decisions 9/12), or a generic phrase. */
export function bossRewardName(camp: CampResponse, catalog: WorldCatalog | null): string {
  const tier = camp.boss.tier_available;
  if (tier === null) return 'une récompense';
  const rewardId = catalog?.boss_rewards[String(tier)];
  const name = rewardId ? catalog?.rewards[rewardId]?.name : undefined;
  return name ?? 'une récompense';
}

/** « 1 trésor », « 2 trésors », « Aucun trésor encore » (the cabin's shelf). */
export function treasureCaption(n: number): string {
  if (n <= 0) return 'Aucun trésor encore';
  return n === 1 ? '1 trésor' : `${n} trésors`;
}

/** The weekly goal ribbon, in-world words. */
export function weeklyCaption(w: CampResponse['weekly']): string {
  if (w.reached) return 'Objectif atteint ! Les Muses sont fières.';
  return `Cette semaine : ${w.done} / ${w.target} parchemins défendus`;
}

const engaged = (camp: CampResponse) => camp.quests.some((q) => q.kind === 'boss' && q.status === 'active');

/** Éris hides until enough tricks are foiled (the quest wall's rule, SP3 decision 8). */
export function bossLocked(camp: CampResponse): boolean {
  return camp.boss.tier_available === null && camp.boss.active_quest_id === null;
}

/** What the dragon says when the locked path to battle is tapped (carry #16/M9). */
export function bossLockLine(camp: CampResponse): string {
  if (camp.boss.tiers_won.length >= 3) return 'Éris est vaincue trois fois. Elle boude, loin du camp.';
  const n = tricksBeforeEris(camp);
  if (n <= 0) return 'Éris se cache encore. Continue de défendre tes textes.';
  return `Éris se cache encore. Neutralise encore ${n === 1 ? 'une ruse' : `${n} ruses`} et elle sortira.`;
}

/** The hub place the shared next step names (Ruling B9), or null. */
export function campNextStep(camp: CampResponse | null): CampHotspotId | null {
  const step = nextStep(camp);
  return step ? HUB_PLACE[step] : null;
}

/** Captions only where there is news (carry rec. 5), three at most, by priority. */
export function campNews(camp: CampResponse, catalog: WorldCatalog | null): Partial<Record<CampHotspotId, string>> {
  const p = nearestProphecy(camp);
  const stirring = camp.lieutenants.find((l) => l.stirring && l.available && !l.neutralised);
  const all: [CampHotspotId, string | null][] = [
    ['boss', bossLocked(camp) ? null : engaged(camp) ? 'Un combat est déjà engagé contre Éris.' : `Combat ${camp.boss.tier_available} : ${bossRewardName(camp, catalog)}`],
    ['oracle', p && p.days_left <= 7 ? `Une prophétie, ${prophecyWhen(p.days_left)}` : camp.oracle.status === 'sealed' ? 'Trois rouleaux à ouvrir' : null],
    ['parchemins', camp.xp.total === 0 ? 'Choisis un texte à défendre' : null],
    ['dragon', camp.dragon.stage !== 'egg' && !camp.dragon.name ? 'Il attend un nom' : null],
    ['dossier', stirring ? `${stirring.name} ${stirringCaption(stirring.key as LieutenantKey).toLowerCase()}` : null],
  ];
  return Object.fromEntries(all.filter((e): e is [CampHotspotId, string] => e[1] !== null).slice(0, 3));
}

function place(id: CampHotspotId, extra: (camp: CampResponse) => Partial<HotspotState> = () => ({})) {
  return ({ camp, catalog }: SceneContext): HotspotState => {
    if (!camp) return st();
    return st({ caption: campNews(camp, catalog)[id] ?? null, isNew: campNextStep(camp) === id, ...extra(camp) });
  };
}

export const CAMP_HOTSPOTS: HotspotDef[] = [
  { id: 'dragon', label: 'Le nid du dragon', target: 'dragon', shape: CAMP_SHAPES.dragon, labelPos: 'below', leader: true, state: place('dragon') },
  {
    id: 'oracle',
    label: 'Le chemin de Delphes',
    target: 'delphi',
    shape: CAMP_SHAPES.oracle,
    labelPos: 'below',
    leader: true,
    state: place('oracle', (camp) => {
      const n = camp.quests.filter((q) => q.status === 'active').length;
      return { badge: n > 0 ? n : null };
    }),
  },
  { id: 'parchemins', label: 'La tente des parchemins', target: 'library-tent', shape: CAMP_SHAPES.parchemins, labelPos: 'below', leader: true, state: place('parchemins') },
  {
    id: 'dossier',
    label: 'La tente de guerre',
    target: 'war-tent',
    shape: CAMP_SHAPES.dossier,
    labelPos: 'below',
    leader: true,
    state: place('dossier', (camp) => {
      const n = camp.lieutenants.filter((l) => l.neutralised).length;
      return { badge: n > 0 ? n : null };
    }),
  },
  { id: 'cabin', label: 'Ta cabane', target: 'cabin', shape: CAMP_SHAPES.cabin, labelPos: 'above', leader: true, state: place('cabin') },
  {
    id: 'boss',
    label: 'Le sentier de la bataille',
    target: 'boss',
    shape: CAMP_SHAPES.boss,
    labelPos: 'below',
    leader: true,
    state: (ctx) => (ctx.camp ? place('boss', (camp) => ({ locked: bossLocked(camp) }))(ctx) : st({ locked: true })),
  },
];

export const CAMP_SCENE: SceneDef = {
  id: 'camp',
  title: 'Le camp',
  background: ART.scenes.hubCamp,
  layers: [],
  hotspots: CAMP_HOTSPOTS,
  ambience: { particles: 'embers', music: null },
  narrator: { enter: 'camp.enter', firstVisit: 'camp.first' },
  // Carry rec. 9: the two places the hub leads to most (the tent, the temple).
  preload: [ART.scenes.libraryTent, ART.scenes.delphi],
};

const WIDTH: Record<DragonStage, number> = { egg: 6, hatchling: 7, young: 8, adult: 9 };

/** The dragon's cut-out seated in the painted nest (carry rec. 7, immersion Deferred #23:
 *  docs/art/scenes.md ≈ (17, 50), feet on the straw at y 55). Depth 1 keeps it inside its place's
 *  box (UI1 final review M2). */
export function campDragonLayer(stage: DragonStage): Omit<SceneLayerDef, 'id' | 'src' | 'alt'> {
  return { x: 17, y: 55, scale: WIDTH[stage], depth: 1, idle: 'breathe' };
}

/** The static greeting (dialogue content files arrive in UI5). */
export function campGreeting(profileName: string, camp: CampResponse): DialogueLine[] {
  const d = camp.dragon;
  const who = dragonSpeaker(d);
  return [
    { ...who, text: `Bienvenue au camp, ${profileName}.` },
    { ...who, text: stageLine(d.stage, d.name, Math.max(0, d.available - d.neutralised)) },
    { ...who, text: nextStepLine(camp) },
  ];
}
```

(If a hotspot of another scene still imports `bestiaryCaption`, `CAMP_DRAGON_LAYER` or `nearestProphecy`/`prophecyWhen` from `camp.ts`, point it at their real home.)

`title.ts`, `library.ts`, `delphi.ts`: `preload: [ART.scenes.hubCamp]` (the gate and every way out now open onto the new hub). `ART.scenes.camp` stays in `art.ts` (the battle screens may still use it in UI4; `art.test.ts` keeps it resolving).

Run: `scripts/npm.sh run test -- src/lib/world/` — Expected: PASS.

- [ ] **Step 4: The camp screen on the new art**

In `web/src/screens/Camp.svelte`:
- imports: `campDragonLayer`, `bossLockLine` from `../lib/world/scenes/camp` (drop `CAMP_DRAGON_LAYER`), `dragonSays` from `../lib/world/scenes/speakers`, `unlockAudio` (already imported); drop `ProphecyCard`, `nearestProphecy`, `go`, `href` if now unused;
- `dragonLayer(camp)` spreads `campDragonLayer(camp.dragon.stage)`;
- delete the whole `<div class="camp-column" …>` block, `review()` and the `.camp-column` rule;
- the weekly ribbon keeps its position (`top: 16.5%`, centred) and comment, updated: « in the open sky of hub_camp.webp (docs/art/scenes.md: x 40–65, y 8–20), clear of every place and plaque (scenes-camp.spec.ts measures it) »; move it up only if the e2e below finds an overlap;
- the locked path to battle explains itself (carry #16/M9): `let place: PlaceScene | undefined = $state();`, `bind:this={place}` on `PlaceScene`, and

```ts
  // The tap on the locked path never takes the stage's one-tap guard (Hotspot.svelte).
  function explainLocked() {
    const camp = campFor(profile.id);
    if (!camp) return;
    unlockAudio();
    place?.say([dragonSays(camp.dragon, bossLockLine(camp))]);
  }
```

  (import `campFor`), and every `<Hotspot …>` gets `onLocked={explainLocked}`;
- the header comment drops « the Oracle's prophecy » and « the prophecy column », and says the hero panel lives in the cabin (`?panel=heros` hands over).

- [ ] **Step 5: Rewrite the hub e2e for six places**

In `web/e2e/scenes-camp.spec.ts`:
- `PLACES` becomes:

```ts
const PLACES: { id: string; path: RegExp; name: RegExp }[] = [
  { id: 'dragon', path: /\/dragon$/, name: /Le nid du dragon/ },
  { id: 'oracle', path: /\/temple$/, name: /Le chemin de Delphes/ },
  { id: 'parchemins', path: /\/tente-parchemins$/, name: /La tente des parchemins/ },
  { id: 'dossier', path: /\/tente-de-guerre$/, name: /La tente de guerre/ },
  { id: 'cabin', path: /\/cabane$/, name: /Ta cabane/ },
];
const ALL = [...PLACES.map((p) => `camp-${p.id}`), 'camp-boss'];
```

- « every place routes to its screen and Back returns to the hub »: its final `toHaveCount(0)` on `camp-boss` becomes:

```ts
  // UI3 Ruling B3: the path to battle is always there, locked until Éris can be fought.
  const boss = page.getByTestId('camp-boss');
  await expect(boss).toHaveAttribute('aria-disabled', 'true');
  await expect(boss.locator('img.hotspot-lock')).toHaveAttribute('src', '/art/icons/lock.webp');
```

- add after it:

```ts
test('the locked path to battle: the dragon says how many tricks remain', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openCamp(page, id);
  await page.getByTestId('dialogue-skip').click();
  await tap(page.getByTestId('camp-boss'), testInfo);
  await expect(page).toHaveURL(/\/camp$/);
  await expect(page.getByTestId('dialogue-text')).toHaveText('Éris se cache encore. Neutralise encore 2 ruses et elle sortira.');
  await page.getByTestId('dialogue-skip').click();
  await tap(page.getByTestId('camp-parchemins'), testInfo); // the guard was never taken
  await expect(page).toHaveURL(/\/tente-parchemins$/);
});
```

- « places and their labels sit inside the visible safe zone and work from the keyboard »: loop over `[{ width: 1280, height: 720 }, { width: 1180, height: 820 }, { width: 1366, height: 1024 }]` doing `await page.setViewportSize(size); await openCamp(page, id); await expectInSafeZone(page, 'camp', ALL); expect(await labelOverlaps(page, 'camp'), \`${size.width}x${size.height}\`).toEqual([]);` (the ledger's ruling and final-review M19: every pair, three viewports), with a hero whose plaques carry captions and badges (`readyTheBattle` + a board quest) so the widest plaques are measured; keep the scroll-clip check and the keyboard Enter on `camp-parchemins`;
- « HUD: laurel, dragon, sound toggle… »: `await expect(page.getByTestId('camp-dragon')).toContainText('Un œuf de dragon · Frémit');` → `await expect(page.getByTestId('camp-dragon-layer').locator('img')).toHaveAttribute('src', '/art/dragon/dragon_egg_cut.webp');` (what the dragon is up to now lives in the nest);
- « the path to battle appears once Éris can be fought; badges sit on their plaque »: rename « the path to battle opens once Éris can be fought; badges sit on their plaque »; `await expect(boss).not.toHaveAttribute('aria-disabled', 'true');`; the `camp-dragon` line becomes `await expect(page.getByTestId('camp-dragon-layer').locator('img')).not.toHaveAttribute('src', /dragon_egg/);`; the badge checks read `camp-oracle-badge` (`'1'`: the chimère board quest) against `[data-testid="camp-oracle"] .hotspot-label`, and add `await expect(page.getByTestId('camp-dossier-badge')).toHaveText('2');` (two lieutenants foiled by `readyTheBattle`);
- the dragon-greeting test: with a fresh hero the last line is still « Les parchemins t'attendent, sous la tente. » and `camp-parchemins` glows (B9: `first-text`);
- replace « the weekly ribbon and the prophecy never overlap a hotspot or its label » by:

```ts
test('the weekly ribbon hangs in the open sky, clear of every place and plaque', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await readyTheBattle(request, id, testInfo.project.name); // the battle path's caption is the widest plaque near the sky
  for (const size of [{ width: 1280, height: 720 }, { width: 1180, height: 820 }, { width: 1366, height: 1024 }]) {
    await page.setViewportSize(size);
    await page.goto(`/#/p/${id}/camp?debug`);
    await expectCamp(page);
    await expect(page.getByTestId('camp-weekly')).toBeVisible();
    const { art, weekly, hotspots } = await page.evaluate(() => {
      const rect = (el: Element) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      };
      return {
        art: rect(document.querySelector('[data-testid="scene-camp"] .art')!),
        weekly: rect(document.querySelector('[data-testid="camp-weekly"]')!),
        hotspots: Array.from(document.querySelectorAll('button.hotspot[data-testid^="camp-"]')).map((el) => ({
          testId: el.getAttribute('data-testid'),
          box: rect(el),
          labelBox: rect(el.querySelector('.hotspot-label')!),
        })),
      };
    });
    const at = `${size.width}x${size.height}`;
    expect((weekly.x - art.x) / art.width, `ribbon left at ${at}`).toBeGreaterThanOrEqual(0.3);
    expect((weekly.x + weekly.width - art.x) / art.width, `ribbon right at ${at}`).toBeLessThanOrEqual(0.7);
    expect((weekly.y + weekly.height - art.y) / art.height, `ribbon bottom at ${at}`).toBeLessThanOrEqual(0.22);
    for (const h of hotspots) {
      expect(boxesIntersect(weekly, h.box), `ribbon vs ${h.testId} at ${at}`).toBe(false);
      expect(boxesIntersect(weekly, h.labelBox), `ribbon vs ${h.testId}'s label at ${at}`).toBe(false);
    }
  }
});
```

- delete « a long prophecy title never pushes « Te préparer » out of view » (the card lives on Delphi's altar, and `scenes-delphi.spec.ts` already covers it there) and any helper import left unused (`onlyOwnProphecy`, `measureBoxes` if unused);
- import `labelOverlaps` from `./helpers`.

`web/e2e/scenes-debug.spec.ts`: one outline per visible camp hotspot still holds (six); re-run it.

- [ ] **Step 6: Migrate the world spec**

`web/e2e/world.spec.ts`:
- step 1: `await expect(page.getByTestId('camp-dragon')).toContainText('Un œuf de dragon');` → `await expect(page.getByTestId('camp-dragon-layer').locator('img')).toHaveAttribute('src', '/art/dragon/dragon_egg_cut.webp');`
- step 3: `await page.getByTestId('camp-quests').click();` → `await page.getByTestId('camp-oracle').click(); await expectScene(page, 'delphi'); await page.getByTestId('delphi-tablets').click();`
- step 6: `await expect(page.getByTestId('camp-dragon')).toContainText('Braise');` → `await expect(page.getByTestId('camp-dragon-layer').locator('img')).toHaveAttribute('alt', 'Braise');`
- step 7: `camp-boss` « Sandales d'Hermès » stays (it is news and unlocked).

- [ ] **Step 7: Verify**

Run: `scripts/npm.sh run test -- src/lib/world/ src/components/` and `scripts/npm.sh run check` — Expected: all pass, `0 errors and 0 warnings`.
Run: `STACK=hub scripts/playwright.sh scenes-camp --repeat-each=3` — Expected: all pass on both projects. If `expectInSafeZone` or `labelOverlaps` fails at one size, tune `camp.shapes.ts` within ±2 % (never across another place's box), or move a plaque (`labelPos`, including `on` for the war tent or the cabin), take a `/#/p/<id>/camp?debug` screenshot to confirm every outline still sits on its landmark, and rerun.
Run: `STACK=hub scripts/playwright.sh scenes-debug scenes-delphi scenes-title world` — Expected: all pass.

- [ ] **Step 8: Commit**

```bash
P="web/src/lib/world/scenes/camp.shapes.ts web/src/lib/world/scenes/camp.ts web/src/lib/world/scenes/camp.test.ts web/src/lib/world/scenes/title.ts web/src/lib/world/scenes/title.test.ts web/src/lib/world/scenes/library.ts web/src/lib/world/scenes/library.test.ts web/src/lib/world/scenes/delphi.ts web/src/lib/world/scenes/delphi.test.ts web/src/lib/world/places.test.ts web/src/lib/world/quests.ts web/src/lib/world/quests.test.ts web/src/components/places/delphi/TabletsPanel.svelte web/src/screens/Camp.svelte web/e2e/scenes-camp.spec.ts web/e2e/scenes-debug.spec.ts web/e2e/world.spec.ts"
git add $P
git commit -m "UI3b: the hub on hub_camp.webp - six pinned places, badges on plaques, news captions, one glow, the locked path to battle

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- $P
```

(Leave out of the pathspec any listed file the task did not change.)

### Task 8: The legacy screens retire (top nav, profile gate) and a parity sweep of every route

**Files:**
- Create: `web/src/screens/screens.test.ts`, `web/e2e/scenes-parity.spec.ts`
- Modify: `web/src/App.svelte`

**Interfaces:**
- Consumes: every place of UI3a and UI3b and their test ids (the Parity maps of both plans).
- Produces: `App.svelte` profile-gate states with test ids `gate-loading`, `gate-error`; the invariants of `screens.test.ts` (the screen list, `TopBar` only in Play and Boss, no legacy `screen`/`scene` class outside them).

- [ ] **Step 1: Write the failing invariant test**

`web/src/screens/screens.test.ts`:

```ts
// UI3 end state (spec §3, carry rec. 8, UI3 Ruling B7): every screen is a place scene except the two
// battle screens UI4 restages; the legacy top nav survives only there; no place uses the legacy
// `.screen` page or `.scene` banner classes (the kit classes are placesKit.test.ts's job).
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.svelte')) out.push(p);
  }
  return out;
}

const LEGACY_CLASS = /class="(?:[^"]*\s)?(?:screen|scene)(?:\s[^"]*)?"/;

describe('UI3: the places replaced the screens', () => {
  it('keeps exactly the place scenes and the two battle screens', () => {
    expect(readdirSync('src/screens').filter((f) => f.endsWith('.svelte')).sort()).toEqual([
      'Boss.svelte',
      'CabinRoom.svelte',
      'Camp.svelte',
      'Delphi.svelte',
      'LibraryTent.svelte',
      'Nest.svelte',
      'Play.svelte',
      'Title.svelte',
      'WarTent.svelte',
    ]);
  });

  it('keeps the legacy top nav only on Play and Boss', () => {
    const users = walk('src').filter((f) => /import TopBar from/.test(readFileSync(f, 'utf-8')));
    expect(users.map((f) => basename(f)).sort()).toEqual(['Boss.svelte', 'Play.svelte']);
  });

  it('uses no legacy .screen / .scene class in a place', () => {
    const places = [...walk('src/components/places'), ...walk('src/screens').filter((f) => !/(Boss|Play)\.svelte$/.test(f))];
    for (const f of places) expect(readFileSync(f, 'utf-8'), f).not.toMatch(LEGACY_CLASS);
  });

  it('shows the profile gate on the night backdrop, not on a legacy page', () => {
    const app = readFileSync('src/App.svelte', 'utf-8');
    expect(app).not.toMatch(LEGACY_CLASS);
    expect(app).toContain('data-testid="gate-loading"');
    expect(app).toContain('data-testid="gate-error"');
  });
});
```

Run: `scripts/npm.sh run test -- src/screens/screens.test.ts` — Expected: the first three PASS (B2 removed every other screen); the fourth FAILS (`App.svelte` still wraps the gate states in `<div class="screen">`). If one of the first three fails, an earlier move left something behind: fix it here.

- [ ] **Step 2: The profile gate on the night backdrop**

In `web/src/App.svelte` import `href` from `./lib/routes` and replace

```svelte
    {#if gateLoading && !gateProfile}
      <div class="screen"><p class="muted">Les Muses cherchent ce héros…</p></div>
    {:else if gateError}
      <div class="screen"><p class="orange">Impossible de charger ce héros : {gateError}</p></div>
```

with

```svelte
    {#if gateLoading && !gateProfile}
      <div class="gate-night"><p class="kit-ribbon" data-testid="gate-loading">Les Muses cherchent ce héros…</p></div>
    {:else if gateError}
      <div class="gate-night" role="alert">
        <p class="kit-ribbon" data-testid="gate-error">Impossible de rejoindre ce héros : {gateError}</p>
        <a class="kit-bronze" href={href('profiles')}>Changer de héros</a>
      </div>
```

and add to its `<style>`:

```css
  /* UI3 Ruling B7: the profile gate's states on the night stage colour, never a white page. */
  .gate-night {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 24px;
    background: var(--night);
    text-align: center;
  }
```

Also delete the fence comments left empty after B2 if the controller has not already. Run: `scripts/npm.sh run test -- src/screens/screens.test.ts` — Expected: PASS.

- [ ] **Step 3: The parity sweep (both projects)**

`web/e2e/scenes-parity.spec.ts`:

```ts
import { test, expect } from './crashGuard';
import { createProfileApi, redScan, uniqueName, waitForSceneSettled } from './helpers';

// UI3 feature-parity gate (scenes spec §3 "feature parity is a review gate", §2.3 "every scene and
// overlay has a route"): every route of the app, opened by deep link, shows its place, its overlay
// and a control that proves the legacy feature is there. desktop + ipad.

interface Row {
  hash: string;
  scene?: string;
  overlay?: string;
  testId?: string;
  label?: string;
  heading?: string;
  url?: RegExp;
}

const ROWS: Row[] = [
  { hash: '#/', scene: 'title', testId: 'title-gate' },
  { hash: '#/?panel=tous', scene: 'title', overlay: 'overlay-heroes' },
  { hash: '#/profiles/new', scene: 'title', overlay: 'overlay-hero-new', label: 'Ton prénom' },
  { hash: '#/p/{id}/camp', scene: 'camp', testId: 'camp-parchemins' },
  { hash: '#/p/{id}/camp?panel=heros', scene: 'cabin', overlay: 'overlay-heros', testId: 'hero-switch', url: /\/cabane\?panel=heros$/ },
  { hash: '#/p/{id}/tente-parchemins', scene: 'library', testId: 'library-shelves' },
  { hash: '#/p/{id}/parchemins', scene: 'library', overlay: 'overlay-shelves' },
  { hash: '#/p/{id}/texts/new', scene: 'library', overlay: 'overlay-desk', label: 'Titre' },
  { hash: '#/p/{id}/texts/scan', scene: 'library', overlay: 'overlay-lens', testId: 'scan-input' },
  { hash: '#/p/{id}/alexandria', scene: 'library', overlay: 'overlay-portal', testId: 'work-card' },
  { hash: '#/p/{id}/alexandria/{work}', scene: 'library', overlay: 'overlay-portal-work', testId: 'btn-refresh-work' },
  { hash: '#/p/{id}/temple', scene: 'delphi', testId: 'delphi-pythia' },
  { hash: '#/p/{id}/delphes', scene: 'delphi', overlay: 'overlay-pythia', testId: 'oracle-reward' },
  { hash: '#/p/{id}/quetes', scene: 'delphi', overlay: 'overlay-tablets', testId: 'board-boss' },
  { hash: '#/p/{id}/tente-de-guerre', scene: 'war', testId: 'war-hydre' },
  { hash: '#/p/{id}/dossier', scene: 'war', overlay: 'overlay-dossier', testId: 'dossier-small-tricks' },
  { hash: '#/p/{id}/bestiaire', scene: 'war', overlay: 'overlay-codex', testId: 'bestiary-card-hydre' },
  { hash: '#/p/{id}/bestiaire/argus', scene: 'war', overlay: 'overlay-codex-page', heading: 'Le mythe' },
  { hash: '#/p/{id}/monstres/hydre', scene: 'war', overlay: 'overlay-portrait', testId: 'lieutenant-quest' },
  { hash: '#/p/{id}/dragon', scene: 'nest', testId: 'dragon-stage' },
  { hash: '#/p/{id}/dragon?panel=soin', scene: 'nest', overlay: 'overlay-care', testId: 'dragon-tint-bronze' },
  { hash: '#/p/{id}/cabane', scene: 'cabin', testId: 'cabin-trophies' },
  { hash: '#/p/{id}/cabane?panel=tresors', scene: 'cabin', overlay: 'overlay-trophies', testId: 'cabin-reward-egide' },
  { hash: '#/p/{id}/cabane?panel=heros', scene: 'cabin', overlay: 'overlay-heros', testId: 'hero-journal' },
  { hash: '#/p/{id}/stats', scene: 'cabin', overlay: 'overlay-journal', testId: 'journal-totals' },
  { hash: '#/p/{id}/settings', scene: 'cabin', overlay: 'overlay-lyre', label: 'Nouveau code (quatre chiffres)' },
  { hash: '#/p/{id}/eris', testId: 'topbar-camp' },
  { hash: '#/p/{id}/play/{text}', testId: 'pace-option-1' },
];

test('every route opens its place, its overlay and its legacy feature', async ({ page, request }, testInfo) => {
  test.setTimeout(240_000);
  const id = await createProfileApi(request, uniqueName(`Parite-${testInfo.project.name}`));
  const work = ((await (await request.get('/api/alexandria/works')).json()) as { id: string }[])[0].id;
  const text = ((await (await request.get('/api/texts')).json()) as { id: number }[])[0].id;
  for (const row of ROWS) {
    const hash = row.hash.replace('{id}', String(id)).replace('{work}', work).replace('{text}', String(text));
    await page.goto(`/${hash}`);
    if (row.scene) {
      await expect(page.getByTestId(`scene-${row.scene}`), hash).toBeVisible();
      await waitForSceneSettled(page, row.scene);
    }
    if (row.url) await expect(page, hash).toHaveURL(row.url);
    if (row.overlay) await expect(page.getByTestId(row.overlay), hash).toBeVisible();
    if (row.testId) await expect(page.getByTestId(row.testId).first(), hash).toBeVisible();
    if (row.label) await expect(page.getByLabel(row.label).first(), hash).toBeVisible();
    if (row.heading) await expect(page.getByRole('heading', { name: row.heading }).first(), hash).toBeVisible();
    expect(await redScan(page), hash).toEqual([]);
  }
});
```

(`camp?panel=heros` for a fresh API hero first shows the Muses' welcome: skip it with `skipOnboarding(page)` from `helpers.ts` on that row before the URL check. Check each listed test id against the current panels, e.g. `scan-input` and `btn-refresh-work`, and fix a row rather than the panel.)

- [ ] **Step 4: Verify**

Run: `scripts/npm.sh run test` and `scripts/npm.sh run check` — Expected: all pass, `0 errors and 0 warnings`.
Run: `STACK=parity scripts/playwright.sh scenes-parity --repeat-each=3` — Expected: 1 test × 2 projects × 3 passes (28 routes each).

- [ ] **Step 5: Commit**

```bash
P="web/src/screens/screens.test.ts web/e2e/scenes-parity.spec.ts web/src/App.svelte"
git add $P
git commit -m "UI3b: the legacy screens retire - top nav only on Play and Boss, profile gate on the night backdrop, parity sweep of every route

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- $P
```

**After B3:** the controller merges the hub and parity branches and runs `PW_WORKERS=4 scripts/check.sh` once.

### Task 9: The complete UI3 review walk (iPad screenshots) and the full gate

**Files:**
- Modify: `web/e2e/playability-ui3.spec.ts`
- Regenerate (only in Step 4): `docs/reviews/ui3/*.png`

**Interfaces:**
- Consumes: the walk's `Walk`, `shot`, `noRed`, `skipGreeting(w, sceneId)`, `waitForOverlaySettled`, `settleDialogue`, `titleSection`, `librarySection`, `delphiSection`, `SECTIONS`, `DEBUG_SHOTS`, `clearEarlierWalk`, the fixed names (Ruling W12); `createText`, `postSession`, `makeResult`, `closeOverlay`, `expectCamp`, `expectScene` (`helpers.ts`).
- Produces: sections `title`, `hub`, `library`, `delphi`, `war`, `nest`, `cabin`, `wide`; `?debug` shots of all seven scenes.

- [ ] **Step 1: Add the UI3b sections**

In `web/e2e/playability-ui3.spec.ts`:
- a fixed young hero for the sleeping lieutenant: `const YOUNG = 'Ismène';` (a 7H hero; add it to `clearEarlierWalk`'s heroes), and `const VEILLEE_TITLE = 'La veillée des héros';` (add it to `clearEarlierWalk`'s and the end-of-walk `deleteTexts` titles);
- the sections, above `SECTIONS`:

```ts
async function hubSection(w: Walk) {
  const { page } = w;
  await page.goto(`/#/p/${w.profileId}/camp`);
  await expectCamp(page);
  await settleDialogue(page);
  await shot(w, 'b01-hub-greeting');
  await skipGreeting(w, 'camp');
  await shot(w, 'b02-hub');
  await noRed(w, 'hub');
  // Carry #16 / M9: the locked path to battle, explained by the dragon.
  await page.getByTestId('camp-boss').click();
  await expect(page.getByTestId('dialogue-text')).toContainText('Éris se cache encore');
  await settleDialogue(page);
  await shot(w, 'b03-hub-locked-battle-path');
  await page.getByTestId('dialogue-skip').click();
  // A lived-in camp: two lieutenants foiled over three days, a quest on the wall, the battle open.
  const text = await createText(page.request, { title: VEILLEE_TITLE, body: BODY, level: '10H' });
  for (const day of ['2026-08-03', '2026-08-04', '2026-08-05']) {
    for (const category of ['agreement:verb', 'homophone']) {
      await postSession(page.request, { profileId: w.profileId, textId: text.id, day, result: makeResult({ draft: 4, caught: 4, category }) });
    }
  }
  await page.request.post(`/api/profiles/${w.profileId}/quests`, { data: { target: 'chimere' } });
  await page.reload();
  await expectCamp(page);
  await expect(page.getByTestId('camp-boss')).not.toHaveAttribute('aria-disabled', 'true');
  await shot(w, 'b04-hub-lived-in');
  await noRed(w, 'hub lived-in');
}

async function warSection(w: Walk) {
  const { page } = w;
  await page.goto(`/#/p/${w.profileId}/camp`);
  await expectCamp(page);
  await page.getByTestId('camp-dossier').click();
  await expectScene(page, 'war');
  await shot(w, 'b05-war-tent');
  await noRed(w, 'war tent');
  await page.getByTestId('war-hydre').click();
  await waitForOverlaySettled(page, 'overlay-portrait');
  await shot(w, 'b06-war-portrait-hydre');
  await closeOverlay(page);
  await page.getByTestId('war-dossier').click();
  await waitForOverlaySettled(page, 'overlay-dossier');
  await shot(w, 'b07-war-dossier');
  await noRed(w, 'dossier');
  await closeOverlay(page);
  await page.getByTestId('war-bestiary').click();
  await waitForOverlaySettled(page, 'overlay-codex');
  await shot(w, 'b08-war-codex');
  await page.getByTestId('bestiary-card-hydre').click();
  await waitForOverlaySettled(page, 'overlay-codex-page');
  await shot(w, 'b09-war-codex-page');
  await closeOverlay(page);
  await closeOverlay(page);
  // Carry #16 / M9 again: a lieutenant asleep at a 7H hero's class.
  const r = await page.request.post('/api/profiles', { data: { name: YOUNG, avatar: 'lyre', level: '7H' } });
  expect(r.ok()).toBeTruthy();
  const young = (await r.json()).id as number;
  await page.goto(`/#/p/${young}/tente-de-guerre`);
  await expectScene(page, 'war');
  await page.getByTestId('war-protee').click();
  await expect(page.getByTestId('dialogue-text')).toContainText('Protée dort encore');
  await settleDialogue(page);
  await shot(w, 'b10-war-sleeping-lieutenant');
}

async function nestSection(w: Walk) {
  const { page } = w;
  await page.goto(`/#/p/${w.profileId}/camp`);
  await expectCamp(page);
  await page.getByTestId('camp-dragon').click();
  await expectScene(page, 'nest');
  await expect(page.getByTestId('dialogue-box')).toBeVisible();
  await settleDialogue(page);
  await shot(w, 'b11-nest-greeting');
  await skipGreeting(w, 'nest');
  await shot(w, 'b12-nest');
  await noRed(w, 'nest');
  await page.getByTestId('nest-dragon').click();
  await waitForOverlaySettled(page, 'overlay-care');
  await shot(w, 'b13-nest-care');
  await closeOverlay(page);
}

async function cabinSection(w: Walk) {
  const { page } = w;
  await page.goto(`/#/p/${w.profileId}/camp`);
  await expectCamp(page);
  await page.getByTestId('camp-cabin').click();
  await expectScene(page, 'cabin');
  await shot(w, 'b14-cabin');
  await noRed(w, 'cabin');
  for (const [spot, overlay, name] of [
    ['cabin-trophies', 'overlay-trophies', 'b15-cabin-trophies'],
    ['cabin-journal', 'overlay-journal', 'b16-cabin-journal'],
    ['cabin-lyre', 'overlay-lyre', 'b17-cabin-lyre'],
  ] as const) {
    await page.getByTestId(spot).click();
    await waitForOverlaySettled(page, overlay);
    await shot(w, name);
    await noRed(w, overlay);
    await closeOverlay(page);
  }
  // Carry #4: the HUD's hero chip opens the hero panel in the cabin, from any place.
  await page.goto(`/#/p/${w.profileId}/temple`);
  await expectScene(page, 'delphi');
  await page.getByTestId('hud-hero').click();
  await waitForOverlaySettled(page, 'overlay-heros');
  await shot(w, 'b18-cabin-hero-panel');
  await closeOverlay(page);
}

async function wideSection(w: Walk) {
  const { page } = w;
  for (const [size, name] of [
    [{ width: 1440, height: 900 }, 'b19-laptop-1440x900'],
    [{ width: 2560, height: 1080 }, 'b20-ultrawide-2560x1080'],
  ] as const) {
    await page.setViewportSize(size);
    await page.goto(`/#/p/${w.profileId}/camp`);
    await expectCamp(page);
    await shot(w, name);
  }
  await page.setViewportSize({ width: 1180, height: 820 });
}
```

  (The hub section runs before the library's: the lived-in state it creates does not change the library's shots, which use their own texts; if it does, move `hubSection` after `delphiSection` and keep the numbering.)
- `SECTIONS` and `DEBUG_SHOTS`:

```ts
const SECTIONS: { name: string; run: (w: Walk) => Promise<void> }[] = [
  { name: 'title', run: titleSection },
  { name: 'library', run: librarySection },
  { name: 'delphi', run: delphiSection },
  { name: 'hub', run: hubSection },
  { name: 'war', run: warSection },
  { name: 'nest', run: nestSection },
  { name: 'cabin', run: cabinSection },
  { name: 'wide', run: wideSection },
];

const DEBUG_SHOTS: { hash: string; sceneId: string; name: string }[] = [
  { hash: '/', sceneId: 'title', name: 'd01-debug-title' },
  { hash: '/p/{id}/tente-parchemins', sceneId: 'library', name: 'd02-debug-library' },
  { hash: '/p/{id}/temple', sceneId: 'delphi', name: 'd03-debug-delphi' },
  { hash: '/p/{id}/camp', sceneId: 'camp', name: 'd04-debug-hub' },
  { hash: '/p/{id}/tente-de-guerre', sceneId: 'war', name: 'd05-debug-war-tent' },
  { hash: '/p/{id}/dragon', sceneId: 'nest', name: 'd06-debug-nest' },
  { hash: '/p/{id}/cabane', sceneId: 'cabin', name: 'd07-debug-cabin' },
];
```

- the header comment: « UI3a: title, library tent, Delphi. UI3b: hub, war tent, nest, cabin, wide viewports. ».

- [ ] **Step 2: Run the walk to the scratch dir**

Run: `scripts/playwright.sh --config playwright.playability.config.ts playability-ui3`
Expected: 2 passed; `web/test-results/walk-ui3/` holds `ipad-landscape-a…`, `b01…b20`, `d01…d07` and `ipad-portrait-a01-rotate-screen.png`; the console notes list no `RED at` line and a single request origin. `docs/reviews/ui3/` is untouched.

- [ ] **Step 3: Look at every screenshot**

Open each PNG (the Read tool shows images) with the review's question in mind: "does anything still look like a school form?". Check that every `?debug` outline sits on its landmark (hub: nest, temple and stairs, striped tent, red tent, archway, cabin; war tent: six sheets, table, lectern; nest: straw bed; cabin: shelf, journal, lamp and lyre); that no plaque floats over sky or sea or overlaps another; that the weekly ribbon hangs in the sky; that the dragon sits in the painted nest; that the two locked places read as locked (lock icon, grey glow) and their lines explain why; that the codex spreads keep the title and the voice on the left page; that no grade code, « niveau » or form plural shows. Fix what you find in the owning file (`*.shapes.ts` within ±2 %, CSS, copy), rerun the walk, and list what you checked and anything left for the Opus playability review.

- [ ] **Step 4: Refresh the review baseline and run the full gate**

Run: `WALK_OUT=docs/reviews/ui3 scripts/playwright.sh --config playwright.playability.config.ts playability-ui3` — Expected: 2 passed; `docs/reviews/ui3/` holds the new `b*` and `d04…d07` shots and the refreshed `a*`/`d01…d03`. Delete (`git rm`) any PNG there that the walk no longer writes.
Run: `PW_WORKERS=4 scripts/check.sh`
Expected: `== ALL GREEN`: pytest; svelte-check `0 errors and 0 warnings`; vitest (every guard, `screens.test.ts`, the scene budgets, the one-glow sweep); docker build; Playwright `desktop` (every functional spec), `ipad` (every `scenes-*` spec: title, camp, debug, library, delphi, overlays, war, nest, cabin, parity) and `chromium` (`scenes-library`). No crash retry, or name the crashed test in the report.

- [ ] **Step 5: Commit**

```bash
git add web/e2e/playability-ui3.spec.ts docs/reviews/ui3
git commit -m "UI3b: complete UI3 review walk - iPad screenshots of every place, overlay and locked place, ?debug shots of all seven scenes

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/e2e/playability-ui3.spec.ts docs/reviews/ui3
```

Then the controller dispatches the Opus playability re-review on the new baseline (`docs/reviews/ui3/playability-ui3b.md`) and the whole-branch code review, as for UI3a.

---

## Self-review (UI3b)

- **Spec coverage.** §3 War tent (portraits → page, map table → Éris's file, codex → bestiary): Tasks 2–3. Dragon's nest (dragon at its stage, growth): Task 4. Cabin (trophy shelf, journal = stats, lamp & lyre = settings incl. the sound switch; sliders are UI5 per A17): Tasks 5–6. Hub (six places, weekly ribbon, dragon greets): Task 7. Feature parity: the Parity map, each panel's "what stays" list, and `scenes-parity.spec.ts` (Task 8). §2.3 routes: B1 adds one route, removes none; `camp?panel=heros` kept as a hand-over. §2.2/§4 overlays: every UI3b overlay has a variant, is swept by `expectInWorldOverlay` (variant, HUD clearance, 48 px, kit classes, voice, no red). §4 shapes by hand + `?debug`: every scene task (`validateScene`, `expectInSafeZone`, `labelOverlaps`, debug outline counts) and the walk's seven debug shots. §10: per-scene e2e on both projects, portrait rotate, no red, the walk's iPad screenshots, `scripts/check.sh`.
- **Carried items.** The table above maps every UI1 carry, the two ledgers' UI3b items (the camp label overlaps with an all-pairs e2e at three sizes, the locked place, Stats' « niveau », M19, the shared next step) and every row of the immersion plan's Deferred-to-UI3b table.
- **Guards.** New panels are born under `components/places/` and must pass `placesKit`, `registerGuard`, `formPlural`, `headings`, `noEmoji` and `noGuilt` in the task that moves them. Task 1 makes the register guard scan every place screen, so a lane's new screen is covered without editing the guard.
- **Placeholder scan.** Every step carries its code or its exact edit. The discretionary numbers are hotspot shapes (±2 %, checked by named tests and `?debug` shots) and a few CSS sizes inside the panels; the checks that bound them are named.
- **Type consistency.** `PlaceId`/`PanelId` additions (Task 1) are exactly the values `WarTent`, `Nest` and `CabinRoom` switch on (`portrait`, `dossier`, `codex`, `page`, `soin`, `tresors`, `journal`, `lyre`, `heros`), and `OVERLAY_TITLES: Record<PanelId, string>` names each one. `SceneId` `war`/`nest`/`cabin` match the scene ids and `scene-*` test ids. `dragonSays`/`dragonSpeaker` (Task 1) are used with a `DragonOut` in Tasks 2, 4 and 7. `nextStep`/`HUB_PLACE`/`nextStepLine` (Task 1) are read by camp, library and Delphi, and by the hub (Task 7). `sleepingLine`/`sleepingCaption`/`stirringCaption`/`lieutenantName` (Task 1) are used by war, the dossier, the wall and the hub. `nestDragonLayer`/`campDragonLayer` return `Omit<SceneLayerDef, 'id' | 'src' | 'alt'>` and are spread into a `SceneLayerDef`. `heroPanelHref` changes once (Task 6); PlaceScene calls it unchanged. `dragonCaption` and `treasureCaption` stay exported by `camp.ts` (Task 7) for `nest.ts` and `cabin.ts`. `tricksBeforeEris` (Task 7) serves the wall and the hub.
