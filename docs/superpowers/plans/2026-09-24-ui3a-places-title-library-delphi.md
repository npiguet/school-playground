# La Discorde — UI3a "Places I: engine, Title, Library, Delphi" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the profile picker, the library (with its three ways to add a text) and Delphi (the Oracle and the quest board) into painted scenes whose secondary content opens as routed in-world overlays, with full feature parity, the device-tilt parallax unlocked by the title's « Entrer », painted reward icons and no emoji anywhere the player can see.

**Architecture:** UI3 is split in two plans (Ruling A14). This one (UI3a) extends the UI1 scene engine (nullable hotspot targets, route params/query, ink labels, leader pins, locked-tap callback, wide overlays, an exit sign, a `PlaceScene` shell, keyed greetings, the in-world form kit), then builds three places. A pure `placeFor(route)` maps every route to "a place + an optional overlay", so every legacy route keeps working: `#/p/3/parchemins` is now the library tent with the shelves overlay open. Legacy screens are moved with `git mv` into overlay panels under `web/src/components/places/<place>/` with minimal edits, which keeps their logic, texts and test ids. UI3b (`2026-09-24-ui3b-places-war-nest-cabin-hub.md`) builds the war tent, the nest, the cabin, remaps the hub onto `hub_camp.webp` and runs the final review walk.

**Tech Stack:** Svelte 5 (runes) + TypeScript + Vite 7, vitest 3 (node env), Playwright 1.55.0 (WebKit: `desktop` 1280×720 and `ipad` 1180×820 touch), FastAPI (one catalog field removed, Ruling A13), Docker Desktop + Git Bash wrapper scripts. No new npm dependency.

**Spec:** `docs/superpowers/specs/2026-09-24-scenes-ui-design.md` — binding. Read §2, §3 (screen map + feature parity), §4, §6, §9 (UI3) and §10 before any task. Where this plan and the spec disagree, the spec wins; where the spec is silent, the Rulings below win. The UI1 plan `docs/superpowers/plans/2026-09-24-ui1-foundation-camp-hub.md` describes the engine you extend; its Rulings 1–16 still hold unless a Ruling below amends them. Repo-root `CLAUDE.md` is binding for every agent (no "pre-existing" problems, zero svelte-check warnings, no emoji).

## Global Constraints

- **Scope (spec §9.3):** "UI3 Places: Title, Library, Delphi, War tent, Dragon's nest, Cabin scenes + overlays with full feature parity." UI3a covers Title, Library, Delphi (+ engine, reward icons, emoji removal). Out of UI3 entirely: audio and dialogue content files (UI5; "the DialogueBox with static lines is fine"), the battle stage (UI4: Play, Boss, Grimoire, Results, ProgressionReveal keep their layout; only Rulings A12/A13 touch them).
- **Mechanics unchanged (spec §1):** "Mechanics, pedagogy, API, server: unchanged." The only server change is Ruling A13 (the `glyph` emoji field leaves the world catalog, a user ruling).
- **Feature parity (spec §3):** "Any existing functionality on a screen must remain reachable in its new home (feature parity is a review gate)." The Parity map below is the checklist; a task may not drop a row of it.
- **Language:** UI and game text in French (use every French string of this plan verbatim); code, comments, docs, commit messages in English.
- **Routing (spec §2.3):** "the in-house hash router and all current route names/paths stay; every scene and overlay has a route, so Back, reload and deep links keep working. New routes may be added (e.g. a title scene) but none removed without a ruling."
- **Forms (spec §2.4):** "Form elements stay real HTML (inputs, textareas, selects) for iPad keyboard, selection, autocorrect-off and accessibility, restyled as semi-transparent parchment / bronze / marble. Prefer transparency wherever legibility allows."
- **Overlays (spec §2.2):** "secondary content opens as overlays (in-world objects sliding over the dimmed scene), never as a new form page." Max two levels deep: hub → place → overlay.
- **Dependencies (spec §2.1):** "New npm deps allowed: `gsap`, `howler` (+ types). Any other dep needs a ledger ruling." UI3a adds none (Ruling A18). `web/package.json` and `web/package-lock.json` must not change.
- **Fonts (spec §2.7):** Cinzel "place names, hotspot labels, titles; caps only, never running text", Alegreya "dialogue, narration, quests, bestiary, UI body", Literata "the dictation and proofreading text" (and every textarea holding a text to be defended, Ruling A8).
- **Stage (spec §4):** "art is 16:9, rendered `object-fit: cover` full-bleed. All interactive elements live in a centred 4:3 safe zone." UI1 Ruling 3 geometry: safe zone art x 12.5–87.5 %; hotspots at y ≥ 14 % (HUD band); no hotspot overlaps the dialogue dock (x 27–87.5 %, y 80–100 %).
- **Motion (spec §4):** "honour `prefers-reduced-motion` (no parallax, no bob, fades only)." "Parallax: gentle, on pointer drag / device tilt where permitted; ≤ 3 depth layers."
- **Performance (spec §4):** "≤ 600 KB WebP per scene background; preload likely next scenes." (`web/src/lib/world/scenes/budget.test.ts` enforces it.)
- **Ethics:** no red anywhere (e2e `redScan`: r ≥ 200, g < 60, b < 60 fails); orange is Éris's colour; nothing is lost, no guilt wording (`manqué|raté|perdu` never on screen).
- **No emoji (CLAUDE.md, user ruling 2026-09-24):** "Never use emoji anywhere the player can see them: not as icons, badges, buttons or markers, and not inside French text either. Use the painted icons in `web/public/art/` (cut-outs, emblems, `icons/`), an inline SVG, or plain words instead." From Task 6 on, `web/src/noEmoji.test.ts` enforces it.
- **Accessibility:** touch targets ≥ 48 px; every hotspot and shield is a real focusable `<button>` with a visible label; every image has an `alt` (empty for decoration); every overlay is an `aria-modal` dialog with the scene behind it `inert`.
- **Toolchain:** no Node and no host Python for tooling. Every command goes through `scripts/*.sh` from the repo root in Git Bash: `scripts/npm.sh run test -- <file>` (vitest), `scripts/npm.sh run check` (svelte-check), `scripts/pytest.sh <file> -v`, `scripts/playwright.sh <spec-filter> [--project=<name>]` (builds the prod image, runs e2e), `scripts/playwright.sh --config playwright.playability.config.ts <filter>` (review walks), `scripts/check.sh` (the full gate).
- **vitest runs in the `node` environment:** no component tests, no DOM. Logic goes into `.ts` modules with tests; components are covered by svelte-check (0 errors, 0 warnings) and Playwright. `.svelte.ts` modules can be imported by tests (e.g. `playClock.test.ts`).
- **Legacy CSS:** the global class `.scene` (app.css) is still used by Boss, DragonScreen, Lieutenant, Cabin until they move. New code never uses the class names `scene` or `screen`; the engine uses `scene-stage`, `art`, `stage-*`, `hotspot*`, `kit-*`, `place-*`, `panel-*`.
- **Commits:** branch `scenes`. Other agents commit in parallel: **always commit with a pathspec** (`git add <paths> && git commit -m "..." -- <paths>`); a `git mv`/`git rm` is committed by naming both old and new paths in the pathspec. Never `git add -A`, never `git stash`, `git reset`, `git checkout` or `git clean`. End every commit message with the line `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>` (or the attribution trailer your harness gives you).
- **Verification:** before claiming a task done, run its test commands and paste the real output into your report. A failing or flaky test anywhere is yours to fix or to report as an open item (CLAUDE.md).

## Rulings taken by this plan (the spec is silent; do not re-ask)

- **A1 Places and routes.** A *place* is a scene; an *overlay* is secondary content on it. Every legacy route becomes "its place + its overlay" (so selectors, deep links and Back keep working), and each district gets a new scene-only route:

  | Route (name → path) | Place | Overlay (`PanelId`) |
  |---|---|---|
  | `profiles` → `#/` | title | none (`?panel=tous` → `tous`, every hero) |
  | `profile-new` → `#/profiles/new` | title | `nouveau` (naming ritual) |
  | `camp` → `#/p/:id/camp` | camp | `?panel=heros` → `heros` (UI3b moves it to the cabin) |
  | **new** `library-tent` → `#/p/:id/tente-parchemins` | library | none |
  | `library` → `#/p/:id/parchemins` | library | `etageres` (her texts) |
  | `text-new` → `#/p/:id/texts/new` | library | `pupitre` (scribe's desk) |
  | `text-scan` → `#/p/:id/texts/scan` | library | `loupe` (bronze lens) |
  | `alexandria` → `#/p/:id/alexandria` | library | `portail` (the works) |
  | `alexandria-work` → `#/p/:id/alexandria/:workId` | library | `oeuvre` (one work) |
  | **new** `delphi` → `#/p/:id/temple` | delphi | none |
  | `oracle` → `#/p/:id/delphes` | delphi | `pythie` (three scrolls, prophecies) |
  | `quests` → `#/p/:id/quetes` | delphi | `tablettes` (quest board) |

  `play`, `grimoire`, `boss` stay legacy screens (UI4). Dossier, bestiary, lieutenant, dragon, cabin, stats and settings stay legacy screens until UI3b.
- **A2 Overlay navigation.** Opening an overlay from inside the app pushes its route and tags the history entry (`openPanel`); the wax seal, Escape, a tap on the backdrop and Back all close it: a tagged entry steps back (`history.back()`), a deep link or reload replaces itself with the bare scene (`closePanel`). In-overlay navigation (a work from the works list) is also tagged, so the seal steps back one overlay. A form that saves (desk, lens, hero naming) replaces its own entry (`replaceRoute`) with where it lands, so Back never reopens an emptied form. This generalises UI1's hero-panel tag (`discordeHeroPanel` → `discordePanel`).
- **A3 Moving a legacy screen into a panel.** `git mv web/src/screens/X.svelte web/src/components/places/<place>/<Name>Panel.svelte`, then only: fix relative imports (`'../lib/` → `'../../../lib/`, `'../components/` → `'../../`); delete the `TopBar` import and element; replace the outer `<div class="screen ...">` by `<div class="panel-<name>">`; delete any painted `.scene` banner block (the place itself is the scene) and its `.scene` CSS rules; apply the task's listed edits. Logic, French texts and `data-testid`s stay unchanged. Overlay titles reuse the legacy headings ("Les Parchemins", "Bibliothèque d'Alexandrie", "Nouveau parchemin", "Scanner une feuille", "L'Oracle de Delphes", "Le tableau des quêtes"), so heading selectors keep working, while each scene's marble plaque echoes its hub label (carry #12: « La tente des parchemins »).
- **A4 The title.** `#/` shows the gates closed with one hotspot, « Entrer ». Its tap (once per page load, module state like UI1's greeting) unlocks audio, asks for tilt (A5), plays a chime and reveals the heroes as painted shields on the two bronze rails: six slots, newest heroes first (by id), the last slot always « Nouveau héros »; with more than five heroes, slot 5 becomes « Tous les héros » (the `tous` overlay lists every hero). A deep link to `#/profiles/new` or `#/?panel=tous` opens its overlay without « Entrer ». The PIN gate keeps its logic and labels and becomes a sealed parchment over the blurred gates.
- **A5 Device tilt (UI1 Ruling 7's deferral).** `requestTilt()` runs synchronously inside the « Entrer » tap (new `Hotspot` prop `onPress`, called before the tap flash, because iOS only grants `DeviceOrientationEvent.requestPermission()` inside a user gesture). Granted (or no permission API) → every `SceneStage` of the session feeds `deviceorientation` into the same `nx/ny` the pointer parallax uses: the first reading is the resting pose, ±15° of tilt is full deflection, axes follow `screen.orientation.angle`, the resting pose resets on rotation. Never under reduced motion or `?debug`. Refused → pointer parallax only. The stage exposes `data-tilt="on|off"`.
- **A6 One tap at a time, per route.** UI1's `activating` guard is released on every route change (`SceneStage` effect). Place scenes stay mounted under their overlays, so without this every hotspot would stay dead after the first overlay closes.
- **A7 Place chrome.** Every place scene but the title renders the UI1 HUD (hero chip, laurel, dragon, sound) and a bronze exit sign « Le camp » at the bottom-left of the safe zone (art x 13.5 %, left of the dialogue dock), test id `scene-exit`, which navigates to the camp. Browser Back works as well. The HUD's hero chip opens the hero panel (`heroPanelHref`, the camp in UI3a, the cabin in UI3b).
- **A8 In-world form kit.** Every overlay body carries the class `kit-form`; `web/src/styles/kit-form.css` restyles, inside it only, the legacy `input/select/textarea/label/.btn/.btn-primary/.btn-ghost/.card/.chip/.chip-active/table/h2/h3/.muted/.parchment` as parchment fields, bronze buttons and marble chips. Textareas use Literata (they hold texts to defend). Screens outside overlays (Play, Boss) keep the legacy look until UI4.
- **A9 Static place greetings.** Each place may greet once per page load per profile with static lines in the `DialogueBox` (the owl in the library, the Pythia at Delphi, keyed `greeting.ts` helpers). Never in `?debug`. Dialogue content files are UI5.
- **A10 « Ce que prépare ta classe ».** The Oracle's `ecole` scroll title comes from server content (« Ce qui arrive à l'école ») and the server is unchanged; the Delphi panel relabels it client-side (carry #13).
- **A11 Older review walks retire.** `web/e2e/playability.spec.ts`, `playability-sp2.spec.ts`, `playability-sp3.spec.ts` and `playability-ui1.spec.ts` drove the pre-UI3 UI (profile picker, library FAB, legacy screens) and would all break; they are deleted in Task 8. Their screenshots in `docs/reviews/{sp1,sp2,sp3,ui1}/` stay as the historical record. `web/e2e/playability-ui3.spec.ts` (Task 13, extended in UI3b) replaces them.
- **A12 Painted icons (`docs/art/icon-inventory.md`).** The art agent delivers 35 transparent 256×256 WebPs into `web/public/art/icons/`: `avatar-{chouette,dragon,lyre,trident,laurier,foudre}`, `lt-{hydre,echo,chimere,protee,sirenes,lethe}`, `tool-{persee,athena,ariane,argus}`, `add-{text,scan,alexandria}`, `seal-oracle`, `lock`, and the 14 non-tint rewards of `server/app/world/catalog.py` `REWARDS` named by id (decor without its `decor:` prefix: `lanterne`, `tapis`, `bibliotheque`, `trophee`, `fresque`). `art.ts` maps them all (`ART.icons`, `rewardIcon()`, `avatarIcon()`, `lieutenantIcon()`); they get their own budget (≤ 60 KB each, ≤ 1.5 MB together) and leave the 2.5 MB non-scene total, as UI1 Ruling 12 did for scenes. If any file is missing when Task 4 starts, the implementer stops and reports BLOCKED. `Medallion` takes a `rewardId` instead of a glyph: the painted icon in its gold ring, a flat CSS colour swatch for `tint:*` (`TINT_SWATCH`), a plain « ? » when locked (also the unknown-id fallback). Icons show wherever a reward shows: Cabin (trophies and displayed decor), ProgressionReveal, the Oracle scrolls' reward line, the Boss reward line, the Lieutenant relic. The Cabin's tinted-egg tint swatches stay (inventory row 28).
- **A13 No emoji, no pictograph icons.** The lieutenants' ONE icon source is `ART.icons.lieutenants` (`lt-*`), shown by `LieutenantBadge`; the server's world catalog drops its `glyph` field and the five client copies (`FALLBACK_GLYPHS` ×4, `LIEUTENANT_GLYPHS`) go (user ruling; the only server change of UI3). Avatars are the painted `avatar-*` medallions. The proofreading tool chips show their painted `tool-*` icons now (small, and the guard needs it; the battle-stage restyle stays UI4). The UI1 inline SVGs (HUD lyre, Overlay seal ✕, hero-panel medallions) are extracted into one `Icon` component (`lib/ui/icons.ts` path table) that also draws the arrows, check mark, star, pencil and missing-word marker; the TopBar uses it. The Oracle seal and the locks use `seal-oracle`/`lock`; the ProgressionReveal weekly leaves use the camp's CSS `.leaf`. Running text says it in words (the Fil d'Ariane message loses « ↔ »; the Settings voice path uses « puis »). Arrows inside grammar explanations (`explain.ts`, `content/homophones.json` hints) are punctuation in a sentence, not icons, and stay. The guard test `web/src/noEmoji.test.ts` fails with `file:line: char U+XXXX` on (1) any `\p{Extended_Pictographic}` or U+FE0F in `web/src` (tests excluded), `web/index.html`, `web/public/manifest.json`, `content/**/*.json`, `server/app/**/*.py`, and (2) any icon glyph `← → ↑ ↓ ✓ ✔ ✕ ✖ ★ ☆ ▢ ▸ ▶ ✶ ❔ ❓` in `.svelte` markup (outside `<script>`, `<style>` and HTML comments). The allow-list is empty. Inventory rows marked optional (22 dictation control icons, 46 quest-kind icons, 56 rank insignia, 57 state motifs, 58 app icon repaint) are not in UI3.
- **A14 Two plans.** UI3 is 22 tasks; UI3a (13 tasks) ships working software on its own: after it, the title, the library tent and Delphi are scenes, while the hub (UI1 art, 8 places), the war-tent screens, the dragon, the cabin, stats and settings are still the UI1/legacy screens, reachable as before. UI3b then does the rest.
- **A15 The hub during UI3a.** The camp keeps UI1's `camp.webp` and its eight places; only targets change: `parchemins` → `library-tent` (Task 9), `oracle` → `delphi` and its preload → library tent + Delphi (Task 12; carry "Preload Library and Delphi from the hub"). `quests` still targets `quests`, which now opens Delphi with the tablets overlay. The six-place remap on `hub_camp.webp` is UI3b.
- **A16 AddMenu retires.** The library FAB and its bottom sheet (« Taper ou coller un texte », « Scanner une feuille », « Bibliothèque d'Alexandrie ») are replaced by the desk, lens and portal hotspots, whose plaques carry the painted `add-*` icons and short captions from the menu (« Taper ou coller un texte », « Scanner une feuille », « Des textes classiques »). `AddMenu.svelte` is deleted in Task 9.
- **A17 Audio sliders are UI5.** Spec §7 (channels, sliders) is milestone UI5. UI3 keeps the single mute (HUD lyre, settings checkbox).
- **A18 No GSAP in UI3.** Overlays, the gate opening and hotspot flashes are CSS and Svelte transitions (UI1 Ruling 2 still holds).

## Parity map (UI3a screens)

Every row must be reachable after this plan; tasks cite rows by screen.

| Screen | Features, links, forms, states | New home |
|---|---|---|
| ProfilePicker | title « La Discorde »; « Choisis ton héros »; hero cards (avatar, name, level) → camp; « + Nouveau héros » → form; states « Les Muses cherchent les héros… », « Impossible de charger les héros : … », « Aucun héros pour l'instant. Crée le tien ! » | Title scene: marble plaque « La Discorde »; « Entrer » gate; shields (avatar, name, level) → camp; « Nouveau héros » shield; « Tous les héros » overlay when > 5; the three states as a banner under the shields (Task 8) |
| ProfileCreate | form: « Ton prénom » (max 30), « Ton avatar » (6 radios), « Ton niveau » (LevelSelect, hint « HarmoS, comme à l'école »), « Un code à quatre chiffres (facultatif) » + hint; errors « Ce nom est déjà pris. », « Les Muses n'ont pas pu créer ce héros… »; submit « Rejoindre le camp » (disabled until a name) → camp, marks unlocked | `nouveau` overlay « Nouveau héros » on the title, same form (Task 8) |
| PinGate | « Code de X » (label + heading), 4-digit input auto-submits, « Ce n'est pas le bon code. Réessaie. », network error, « Changer de héros » → `#/` | Sealed parchment over the blurred gates, same labels + the painted `lock` (Task 8) |
| Library | title « Les Parchemins »; subtitle « Choisis un texte à protéger des dés-accords d'Éris. »; level filter chips (Tous + 5H…11H); « Tous » view sections « Prophéties de l'Oracle » (+ subtitle), « À ton niveau (X) », « Autres parchemins »; text card (title, credits or « Ajouté par X », level chip, « ≈ N mots », « Scanné », « Alexandrie », « Prophétie : dd.mm.yyyy », history line « Jamais joué » / « Joué N× · meilleur taux… ») → play; loading/error states; FAB « + Ajouter un texte » → AddMenu (type / scan / Alexandria) | Library tent: shelves hotspot → `etageres` overlay with the same list, filters, sections, cards and states (Task 9); the FAB's three entries are the desk, lens and portal hotspots (A16) |
| TextCreate | « Titre » (120), « Texte » textarea (autocorrect off, spellcheck, word count « N mots », hint « Entre quatre-vingts et deux cents mots… »), « Niveau », « Auteur », « Œuvre », « Traducteur »; error; « Sauvegarder dans les Parchemins » (disabled until title+text) → library | `pupitre` overlay « Nouveau parchemin » (Task 10); save lands on the shelves overlay |
| ScanText | step capture (explanation, « Prendre une photo » camera input, « Choisir dans les photos », thumbnails + « Retirer », upload error + « Reprendre les photos », « Lire le texte », « Les scribes déchiffrent la feuille… »); step verify (page photos, « À vérifier » chips that select the word, hints, textarea, word count, key hint, « Reprendre une photo », « Le texte est juste » → confirmation « As-tu comparé chaque ligne avec la feuille ? » « Pas encore » / « Oui, le texte est juste »); step details (« Titre », « Niveau », « Dictée pour le » date ≥ today + prophecy hint, « Auteur », « Œuvre », save error, « Sauvegarder dans les Parchemins ») → library | `loupe` overlay « Scanner une feuille » (wide), all three steps (Task 10) |
| Alexandria | banner, intro text, works grid (title, credits, « niveau X », status « Pas encore recopié » / « Hors d'atteinte » / « N rouleaux ») → work; loading/error | `portail` overlay « Bibliothèque d'Alexandrie » (Task 11) |
| AlexandriaWork | title, credits, public-domain note, « Recopier depuis la Bibliothèque » / « Recopier à nouveau » + progress + error/olive banners; level filter chips; chunk cards (« Rouleau N », level, « ≈ N mots », stars, preview; « Ajouter aux Parchemins » / confirmation « Rouleau ajouté aux Parchemins. » + « Jouer maintenant » / « Continuer à fouiller »; « Déjà dans les Parchemins » + « Jouer »; adopt error); empty states | `oeuvre` overlay « Bibliothèque d'Alexandrie » + « Toutes les œuvres » step back (Task 11) |
| Oracle | banner « L'Oracle de Delphes »; « Prophéties » section (text, « Réviser » → play); « Les trois rouleaux »: reward line, three `Scroll`s (sealed / open / « Refermé jusqu'à lundi. »), the `ecole` monster picker (chips, « Annuler », confirm label), consult error + resync, burst; « La quête de la semaine » `QuestCard` + « L'Oracle parlera de nouveau lundi. »; loading/error | Delphi: Pythia hotspot (+ static greeting) → `pythie` overlay « L'Oracle de Delphes » with every section; `ecole` relabelled (A10); the nearest prophecy also sits on the altar in the scene (Task 12) |
| QuestBoard | « En cours » quest cards (shelve), « Défier un monstre » cards (technique, « Dort encore à ce niveau. », neutralised/quest chips, reward line, next decor line, « Lancer une quête »), create error; « Éris » panel (tier + reward + « Se rendre au bord du camp » / « Éris est vaincue trois fois. Elle boude. » / « Éris se cache… »); « Terminées » details | Delphi: votive-tablet wall hotspot (badge = active quests) → `tablettes` overlay « Le tableau des quêtes » (Task 12) |

## UI1 carry items (`docs/reviews/ui1/carry-to-ui3.md`)

| Carry item | Where |
|---|---|
| #4 hero panel into the cabin, HUD shortcut | UI3b Task 6 |
| #12 destination titles echo hub labels; cabin banner | UI3a Tasks 9, 12 (plaques); UI3b Tasks 2, 4, 5 |
| #13 rename the `ecole` scroll client-side | UI3a Task 12 (A10) |
| #17 labels anchored to landmarks (leader/pin), re-map to `hub_camp.webp` | engine: UI3a Task 2 (`leader`); hub: UI3b Task 7 |
| #16 / M9 walk + e2e step for a locked place | UI3b Tasks 2 (sleeping lieutenants) and 7 (battle path locked until Éris can be fought), walk UI3b Task 9 |
| Rec. 1 re-map places to `hub_camp.webp` | UI3b Task 7 |
| Rec. 2 drop bestiary + quest-board hotspots, badges on war tent / Delphi plaques | UI3b Task 7 |
| Rec. 3 clip edge landmarks, keep the label clamp | UI3b Task 7 (validated shapes + `expectInSafeZone`) |
| Rec. 4 weekly banner in the open sky (x 40–65, y 8–18) | UI3b Task 7 |
| Rec. 5 captions only for the 2–3 places with news | UI3b Task 7 |
| Rec. 6 exactly one "next step" glow | UI3b Task 7 |
| Rec. 7 dragon seated in the painted nest (≈ 17, 50), same crop for its portrait | UI3b Task 7 |
| Rec. 8 hub exits as scene transitions, retire the old top nav | UI3a (every place is a `SceneStage` with its zoom-in); UI3b Task 8 (TopBar only on Play/Boss until UI4) |
| Rec. 9 preload Library and Delphi from the hub | UI3a Task 12 |
| Split View rotate screen | Closed by the user (accepted as is), no task |

## Icon inventory (`docs/art/icon-inventory.md`) → tasks

| Rows | Site | Task |
|---|---|---|
| 1–7 | avatar emoji (`AVATAR_GLYPHS`, `Avatar.svelte` and every screen using it) | 5 (`avatar-*`) |
| 8–12 | TopBar ← 📊 ⚙️ 🔊/🔇 🔄 | 6 (`Icon`) |
| 13–15 | HUD lyre, Overlay seal, hero-panel medallions (reference SVGs) | 6 (extracted into `Icon`, reused) |
| 16–18, 21 | AddMenu 📝 📷 📜; the scan capture has no icon | 5 (`add-*`); Task 9 moves them onto the desk/lens/portal plaques |
| 19, 20 | DragonScreen 🔒; PinGate without icon | 6 (`lock` on the tint); 8 (`lock` on the seal) |
| 26, 27, 51 | reward emoji (`FIXED_GLYPHS` ×2), `Medallion` glyph, ❔ fallback | 4 |
| 29–35 | lieutenant glyphs (server + 5 client copies) | 5 (`lt-*`, one source) |
| 38–42 | proofreading tools 🛡️ 🦉 🧵 ✏️; Argus heading without icon | 6 (`tool-*`, `Icon` pencil) |
| 43–45, 52–54 | ✓ → ← ▢ | 6 (`Icon`) |
| 47, 48 | Oracle seal ✶, Alexandria ★ | 6 (`seal-oracle`, `Icon` star) |
| 50 | ProgressionReveal 🌿 | 6 (CSS `.leaf`) |
| not listed | DialogueBox ▸, Dictation « ← Quitter », Settings « → » path, `fil.ts` « ↔ », `corrupt.py` comment « ↔ » | 6 |
| 22, 46, 56, 57, 58 | optional ideas | not in UI3 (A13) |
| 23–25, 28, 36, 37, 49, 55, 59–64 | already fine | none |

## File map

| File | Responsibility | Task |
|---|---|---|
| `web/src/lib/routes.ts` (+ test) | `library-tent`, `delphi` routes | 1 |
| `web/src/lib/world/places.ts` (+ test) | `placeFor(route)`, `sceneHref(place, id)` | 1 |
| `web/src/lib/scene/panelNav.ts` (+ test) | open/close overlays, hero panel href, hotspot href | 1, 2 |
| `web/src/lib/scene/types.ts`, `components/scene/{Hotspot,Overlay,SceneStage,HotspotDebug}.svelte` | engine extensions | 2 |
| `web/src/components/scene/{SceneExit,PlaceScene}.svelte` | place chrome | 2 |
| `web/src/lib/scene/greeting.ts` (+ test) | keyed once-per-load greetings | 2 |
| `web/e2e/helpers.ts` | `measureBoxes`, `expectScene`, `closeOverlay`, `expectInSafeZone`, `labelOverlaps`, title helpers, `openShelves` | 2, 8, 9 |
| `web/src/styles/kit-form.css` (+ test), `web/src/main.ts` | in-world form kit | 3 |
| `web/src/lib/world/art.ts` (+ test) | UI2 scenes, characters, props; painted icons | 3, 4 |
| `web/src/components/juice/Medallion.svelte`, `lib/world/dragon.ts` (+ test) | icon medallion, tint swatches | 4 |
| `web/src/components/{Avatar,LieutenantBadge}.svelte`, `lib/levels.ts`, `lib/world/types.ts`, `server/app/world/catalog.py`, `server/tests/test_world_api.py` | avatars, lieutenant icons, catalog `glyph` removal | 5 |
| `web/src/components/ui/Icon.svelte`, `lib/ui/icons.ts` (+ test), `web/src/noEmoji.test.ts` | shared SVG icons, pictograph sweep, guard | 6 |
| `web/src/lib/scene/{tilt.ts,tiltState.svelte.ts}` (+ test) | device tilt | 7 |
| `web/src/lib/world/scenes/{title.ts,title.shapes.ts}` (+ test), `lib/scene/titleGate.svelte.ts`, `screens/Title.svelte`, `components/places/title/HeroForm.svelte`, `components/PinGate.svelte` | title | 8 |
| `web/src/lib/world/scenes/{library.ts,library.shapes.ts}` (+ test), `screens/LibraryTent.svelte`, `components/places/library/{Shelves,Desk,Lens,Portal,PortalWork}Panel.svelte` | library tent | 9, 10, 11 |
| `web/src/lib/world/scenes/{delphi.ts,delphi.shapes.ts}` (+ test), `screens/Delphi.svelte`, `components/places/delphi/{Pythia,Tablets}Panel.svelte` | Delphi | 12 |
| `web/src/App.svelte` | place routing | 8–12 |
| `web/e2e/scenes-{title,library,delphi}.spec.ts` | per-scene e2e (both projects) | 8–12 |
| `web/e2e/playability-ui3.spec.ts`, `docs/reviews/ui3/*.png` | review walk (first half) | 13 |

---

### Task 1: Place routes, the place map and overlay navigation

**Files:**
- Modify: `web/src/lib/routes.ts`, `web/src/lib/routes.test.ts`
- Create: `web/src/lib/world/places.ts`, `web/src/lib/world/places.test.ts`
- Create: `web/src/lib/scene/panelNav.ts`, `web/src/lib/scene/panelNav.test.ts`
- Modify: `web/src/screens/Camp.svelte` (hero panel uses the shared tag)

**Interfaces:**
- Consumes: `matchRoute(hash)`, `href(name, params, query?)`, `type Route`, `type RouteName` (`web/src/lib/routes.ts`); `navigate(path)`, `replaceRoute(path)` (`web/src/lib/router.svelte.ts`).
- Produces:
  - `RouteName` gains `'library-tent'` (`#/p/:profileId/tente-parchemins`) and `'delphi'` (`#/p/:profileId/temple`).
  - `web/src/lib/world/places.ts`: `export type PlaceId = 'title' | 'camp' | 'library' | 'delphi';` `export type PanelId = 'tous' | 'nouveau' | 'heros' | 'etageres' | 'pupitre' | 'loupe' | 'portail' | 'oeuvre' | 'pythie' | 'tablettes';` `export interface PlaceView { place: PlaceId; panel: PanelId | null }` `export function placeFor(route: Route): PlaceView | null` `export function sceneHref(place: PlaceId, profileId: number): string`. (UI3b extends both unions.)
  - `web/src/lib/scene/panelNav.ts`: `export const PANEL_TAG = 'discordePanel';` `export interface HistoryLike { readonly state: unknown; back(): void; replaceState(data: unknown, unused: string): void }` `export function tagged(state: unknown): Record<string, unknown>` `export function isTagged(state: unknown): boolean` `export function openPanel(path: string, h?: HistoryLike): void` `export function closePanel(scenePath: string, h?: HistoryLike): void` `export function heroPanelHref(profileId: number): string` (returns `#/p/<id>/camp?panel=heros` in UI3a).

- [ ] **Step 1: Write the failing route test**

In `web/src/lib/routes.test.ts`, inside `it('matches every screen', ...)`, add after the `camp` line:

```ts
    expect(matchRoute('#/p/3/tente-parchemins')).toEqual({ name: 'library-tent', params: { profileId: '3' }, query: {} });
    expect(matchRoute('#/p/3/temple')).toEqual({ name: 'delphi', params: { profileId: '3' }, query: {} });
```

and inside `it('builds hrefs', ...)` add:

```ts
    expect(href('library-tent', { profileId: '3' })).toBe('#/p/3/tente-parchemins');
    expect(href('delphi', { profileId: '3' })).toBe('#/p/3/temple');
```

- [ ] **Step 2: Write the failing place-map and panel-navigation tests**

`web/src/lib/world/places.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { matchRoute } from '../routes';
import { placeFor, sceneHref } from './places';

const at = (hash: string) => placeFor(matchRoute(hash));

describe('places (UI3 Ruling A1: every legacy route is its place plus an overlay)', () => {
  it('shows the title for the hero routes', () => {
    expect(at('#/')).toEqual({ place: 'title', panel: null });
    expect(at('#/?panel=tous')).toEqual({ place: 'title', panel: 'tous' });
    expect(at('#/profiles/new')).toEqual({ place: 'title', panel: 'nouveau' });
  });

  it('shows the camp, with its hero panel', () => {
    expect(at('#/p/3/camp')).toEqual({ place: 'camp', panel: null });
    expect(at('#/p/3/camp?panel=heros')).toEqual({ place: 'camp', panel: 'heros' });
    expect(at('#/p/3/camp?panel=nope')).toEqual({ place: 'camp', panel: null });
  });

  it('opens the library tent and its four objects', () => {
    expect(at('#/p/3/tente-parchemins')).toEqual({ place: 'library', panel: null });
    expect(at('#/p/3/parchemins')).toEqual({ place: 'library', panel: 'etageres' });
    expect(at('#/p/3/texts/new')).toEqual({ place: 'library', panel: 'pupitre' });
    expect(at('#/p/3/texts/scan')).toEqual({ place: 'library', panel: 'loupe' });
    expect(at('#/p/3/alexandria')).toEqual({ place: 'library', panel: 'portail' });
    expect(at('#/p/3/alexandria/verne')).toEqual({ place: 'library', panel: 'oeuvre' });
  });

  it('opens Delphi, the Pythia and the votive tablets', () => {
    expect(at('#/p/3/temple')).toEqual({ place: 'delphi', panel: null });
    expect(at('#/p/3/delphes')).toEqual({ place: 'delphi', panel: 'pythie' });
    expect(at('#/p/3/quetes')).toEqual({ place: 'delphi', panel: 'tablettes' });
  });

  it('leaves the battle routes and the places UI3b builds to their current screens', () => {
    for (const h of ['#/p/3/play/1', '#/p/3/grimoire/1', '#/p/3/eris', '#/p/3/dossier', '#/p/3/dragon', '#/p/3/cabane', '#/p/3/stats']) {
      expect(at(h), h).toBeNull();
    }
  });

  it('knows the bare scene an overlay closes onto', () => {
    expect(sceneHref('title', 3)).toBe('#/');
    expect(sceneHref('camp', 3)).toBe('#/p/3/camp');
    expect(sceneHref('library', 3)).toBe('#/p/3/tente-parchemins');
    expect(sceneHref('delphi', 3)).toBe('#/p/3/temple');
  });
});
```

`web/src/lib/scene/panelNav.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { PANEL_TAG, closePanel, heroPanelHref, isTagged, tagged } from './panelNav';

describe('overlay navigation (UI3 Ruling A2)', () => {
  it('tags a history state without losing what was there', () => {
    expect(tagged({ keep: 1 })).toEqual({ keep: 1, [PANEL_TAG]: true });
    expect(tagged(null)).toEqual({ [PANEL_TAG]: true });
    expect(isTagged(tagged(undefined))).toBe(true);
    expect(isTagged({})).toBe(false);
    expect(isTagged(null)).toBe(false);
    expect(isTagged('discordePanel')).toBe(false);
  });

  it('closes an overlay opened in the app by stepping back', () => {
    const h = { state: tagged(null), back: vi.fn(), replaceState: vi.fn() };
    closePanel('#/p/3/temple', h);
    expect(h.back).toHaveBeenCalledOnce();
    expect(h.replaceState).not.toHaveBeenCalled();
  });

  it('points the HUD hero chip at the hero panel', () => {
    expect(heroPanelHref(3)).toBe('#/p/3/camp?panel=heros');
  });
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `scripts/npm.sh run test -- src/lib/routes.test.ts src/lib/world/places.test.ts src/lib/scene/panelNav.test.ts`
Expected: FAIL (`library-tent` unmatched; `Cannot find module './places'`, `'./panelNav'`).

- [ ] **Step 4: Add the two routes**

In `web/src/lib/routes.ts`: add `| 'library-tent'` and `| 'delphi'` to `RouteName` (after `'camp'`); add to `PATTERNS`, right after the `library` pattern:

```ts
  // UI3 Ruling A1: the bare district scenes; the legacy routes open them with an overlay.
  { name: 'library-tent', segments: ['p', { param: 'profileId' }, 'tente-parchemins'] },
  { name: 'delphi', segments: ['p', { param: 'profileId' }, 'temple'] },
```

and to `href()`'s switch, after `case 'library':`:

```ts
      case 'library-tent':
        return `#/p/${params.profileId}/tente-parchemins`;
      case 'delphi':
        return `#/p/${params.profileId}/temple`;
```

- [ ] **Step 5: Write `places.ts`**

```ts
// Which place (scene) a route shows and which overlay is open on it (scenes UI spec §2.2-2.3,
// UI3 Ruling A1). Every legacy route keeps working: it becomes "its place + its overlay", so
// selectors, deep links, reload and Back behave as before. Routes that return null still render
// their legacy screen (the battle routes until UI4; dossier, dragon, cabin... until UI3b).
import { href, type Route } from '../routes';

export type PlaceId = 'title' | 'camp' | 'library' | 'delphi';

export type PanelId =
  | 'tous'
  | 'nouveau'
  | 'heros'
  | 'etageres'
  | 'pupitre'
  | 'loupe'
  | 'portail'
  | 'oeuvre'
  | 'pythie'
  | 'tablettes';

export interface PlaceView {
  place: PlaceId;
  panel: PanelId | null;
}

export function placeFor(route: Route): PlaceView | null {
  switch (route.name) {
    case 'profiles':
      return { place: 'title', panel: route.query.panel === 'tous' ? 'tous' : null };
    case 'profile-new':
      return { place: 'title', panel: 'nouveau' };
    case 'camp':
      return { place: 'camp', panel: route.query.panel === 'heros' ? 'heros' : null };
    case 'library-tent':
      return { place: 'library', panel: null };
    case 'library':
      return { place: 'library', panel: 'etageres' };
    case 'text-new':
      return { place: 'library', panel: 'pupitre' };
    case 'text-scan':
      return { place: 'library', panel: 'loupe' };
    case 'alexandria':
      return { place: 'library', panel: 'portail' };
    case 'alexandria-work':
      return { place: 'library', panel: 'oeuvre' };
    case 'delphi':
      return { place: 'delphi', panel: null };
    case 'oracle':
      return { place: 'delphi', panel: 'pythie' };
    case 'quests':
      return { place: 'delphi', panel: 'tablettes' };
    default:
      return null;
  }
}

/** The bare scene of a place: where closing one of its overlays lands (Ruling A2). */
export function sceneHref(place: PlaceId, profileId: number): string {
  const p = { profileId: String(profileId) };
  switch (place) {
    case 'title':
      return href('profiles');
    case 'camp':
      return href('camp', p);
    case 'library':
      return href('library-tent', p);
    case 'delphi':
      return href('delphi', p);
  }
}
```

- [ ] **Step 6: Write `panelNav.ts`**

```ts
// Opening and closing routed overlays (UI3 Ruling A2, generalising UI1's hero-panel tag). An
// overlay opened from inside the app pushes its route and tags that history entry, so closing it
// steps back to the entry it came from (Back from the scene then leaves the scene instead of
// reopening the overlay). A deep link or a reload has no entry behind it: closing replaces the
// overlay's own entry with the bare scene.
import { href } from '../routes';
import { navigate, replaceRoute } from '../router.svelte';

export const PANEL_TAG = 'discordePanel';

/** The part of `window.history` these helpers use (injectable for the unit tests). */
export interface HistoryLike {
  readonly state: unknown;
  back(): void;
  replaceState(data: unknown, unused: string): void;
}

export function tagged(state: unknown): Record<string, unknown> {
  const base = state !== null && typeof state === 'object' ? (state as Record<string, unknown>) : {};
  return { ...base, [PANEL_TAG]: true };
}

export function isTagged(state: unknown): boolean {
  return state !== null && typeof state === 'object' && (state as Record<string, unknown>)[PANEL_TAG] === true;
}

export function openPanel(path: string, h: HistoryLike = history): void {
  navigate(path);
  h.replaceState(tagged(h.state), '');
}

export function closePanel(scenePath: string, h: HistoryLike = history): void {
  if (isTagged(h.state)) h.back();
  else replaceRoute(scenePath);
}

/** Where the HUD's hero chip leads (UI3b Task 6 moves the hero panel into the cabin). */
export function heroPanelHref(profileId: number): string {
  return href('camp', { profileId: String(profileId) }, { panel: 'heros' });
}
```

- [ ] **Step 7: Run the unit tests**

Run: `scripts/npm.sh run test -- src/lib/routes.test.ts src/lib/world/places.test.ts src/lib/scene/panelNav.test.ts`
Expected: PASS, 3 files.

- [ ] **Step 8: Switch the camp's hero panel to the shared tag**

In `web/src/screens/Camp.svelte`:
- add the import `import { closePanel, heroPanelHref, openPanel } from '../lib/scene/panelNav';`
- delete the `PANEL_TAG` constant, its comment, and the two functions `openHero()` / `closePanel()`; add instead:

```ts
  // UI3 Ruling A2: the shared overlay navigation (UI1's hero-panel tag, generalised).
  function openHero() {
    unlockAudio();
    playSfx('tap');
    openPanel(heroPanelHref(profile.id));
  }

  function closeHeroPanel() {
    closePanel(href('camp', { profileId }));
  }
```

- in the hero-panel `<Overlay ...>`, change `onClose={closePanel}` to `onClose={closeHeroPanel}`;
- remove `replaceRoute` from the `../lib/router.svelte` import if nothing else uses it (keep `navigate` and `router`).

- [ ] **Step 9: Type-check and run the hero-panel e2e (both projects)**

Run: `scripts/npm.sh run check` — Expected: `svelte-check found 0 errors and 0 warnings`.
Run: `scripts/playwright.sh scenes-camp` — Expected: all tests pass on `desktop` and `ipad` (the hero-panel test proves the tag still steps back and a deep link still replaces itself).

- [ ] **Step 10: Commit**

```bash
git add web/src/lib/routes.ts web/src/lib/routes.test.ts web/src/lib/world/places.ts web/src/lib/world/places.test.ts web/src/lib/scene/panelNav.ts web/src/lib/scene/panelNav.test.ts web/src/screens/Camp.svelte
git commit -m "UI3a: place routes, the place map and shared overlay navigation

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/lib/routes.ts web/src/lib/routes.test.ts web/src/lib/world/places.ts web/src/lib/world/places.test.ts web/src/lib/scene/panelNav.ts web/src/lib/scene/panelNav.test.ts web/src/screens/Camp.svelte
```

### Task 2: Engine extensions for places (hotspots, overlays, exit sign, place shell, greetings, e2e helpers)

**Files:**
- Modify: `web/src/lib/scene/types.ts`, `web/src/lib/scene/greeting.ts`, `web/src/lib/scene/greeting.test.ts`, `web/src/lib/scene/panelNav.ts`, `web/src/lib/scene/panelNav.test.ts`
- Modify: `web/src/components/scene/Hotspot.svelte` (full replacement below), `Overlay.svelte`, `SceneStage.svelte`, `HotspotDebug.svelte`
- Create: `web/src/components/scene/SceneExit.svelte`, `web/src/components/scene/PlaceScene.svelte`
- Modify: `web/src/screens/Camp.svelte` (nullable target), `web/e2e/helpers.ts`, `web/e2e/scenes-camp.spec.ts` (uses the shared `measureBoxes`)

**Interfaces:**
- Consumes: Task 1 (`openPanel`, `heroPanelHref`); UI1 `SceneStage` (`scene`, `ctx`, `bind:debug`, `hud` snippet, `children`), `Hud` (`profile`, `camp`, `onHero`), `campStore`, `refreshCamp`, `loadCatalog`, `initSound`.
- Produces:
  - `types.ts`: `export type SceneId = 'camp' | 'title' | 'library' | 'delphi';` `export type LabelPos = 'above' | 'below' | 'on';` `HotspotDef` becomes `{ id; label; target: RouteName | null; params?: Record<string, string>; query?: Record<string, string>; icon?: string; shape; labelPos: LabelPos; leader?: boolean; state }` (`icon` = a painted icon path drawn on the plaque before the name).
  - `Hotspot.svelte` props: `{ def: HotspotDef; status: HotspotState; sceneId: string; onActivate: (def: HotspotDef) => void; onPress?: (def: HotspotDef) => void; onLocked?: (def: HotspotDef) => void }`. `onPress` runs synchronously inside the tap (user-gesture work: audio unlock, tilt permission); `onActivate` runs after the 160 ms flash; `onLocked` runs instead when `status.locked`.
  - `Overlay.svelte` gains `size?: 'md' | 'wide'` (default `'md'`, wide = up to 1040 px); its body carries `class="overlay-body kit-form"`.
  - `SceneExit.svelte` props `{ profileId: number }`: bronze sign « Le camp », `data-testid="scene-exit"`, navigates to the camp.
  - `PlaceScene.svelte` props `{ profile: Profile; scene: SceneDef; debug?: boolean ($bindable); children: Snippet<[SceneContext]> }`: loads `/camp` + catalog + sound for the profile, renders `SceneStage` + `Hud` (hero chip → `openPanel(heroPanelHref(id))`) + `SceneExit`, and calls `children(ctx)` inside the art box.
  - `greeting.ts`: `export function shouldGreetKey(key: string): boolean`, `export function markGreetedKey(key: string): void` (`resetGreetings()` clears them too).
  - `panelNav.ts`: `export function hotspotHref(def: HotspotDef, profileId: number): string | null`.
  - `web/e2e/helpers.ts`: `export interface Rect`, `export async function measureBoxes(page, selectors: Record<string, string>): Promise<Record<string, Rect | null>>`, `export async function expectScene(page, sceneId: string)`, `export async function closeOverlay(page)`, `export async function expectInSafeZone(page, sceneId: string, testIds: string[])`, `export async function labelOverlaps(page, sceneId: string): Promise<string[]>`.

- [ ] **Step 1: Write the failing unit tests**

Append to `web/src/lib/scene/greeting.test.ts` (keep its existing imports; add the new names to the import from `./greeting`):

```ts
import { markGreetedKey, shouldGreetKey } from './greeting';

describe('keyed place greetings (UI3 Ruling A9)', () => {
  it('greets once per key per page load, and a reload forgets it', () => {
    resetGreetings();
    expect(shouldGreetKey('library:3')).toBe(true);
    markGreetedKey('library:3');
    expect(shouldGreetKey('library:3')).toBe(false);
    expect(shouldGreetKey('library:4')).toBe(true);
    expect(shouldGreetKey('delphi:3')).toBe(true);
    resetGreetings();
    expect(shouldGreetKey('library:3')).toBe(true);
  });
});
```

Append to `web/src/lib/scene/panelNav.test.ts` (add `hotspotHref` to its import and `IDLE_HOTSPOT` from `./types`):

```ts
describe('hotspot targets', () => {
  const def = (over: Partial<HotspotDef>): HotspotDef => ({
    id: 'x',
    label: 'X',
    target: 'library',
    shape: { kind: 'ellipse', cx: 50, cy: 50, rx: 5, ry: 5 },
    labelPos: 'below',
    state: () => IDLE_HOTSPOT,
    ...over,
  });

  it('builds the route of a hotspot, with its params and query', () => {
    expect(hotspotHref(def({}), 3)).toBe('#/p/3/parchemins');
    expect(hotspotHref(def({ target: 'lieutenant', params: { key: 'hydre' } }), 3)).toBe('#/p/3/monstres/hydre');
    expect(hotspotHref(def({ target: 'camp', query: { panel: 'heros' } }), 3)).toBe('#/p/3/camp?panel=heros');
  });

  it('returns null when the scene handles the tap itself', () => {
    expect(hotspotHref(def({ target: null }), 3)).toBeNull();
  });
});
```

(`import type { HotspotDef } from './types'` as well.)

Run: `scripts/npm.sh run test -- src/lib/scene/greeting.test.ts src/lib/scene/panelNav.test.ts`
Expected: FAIL (`shouldGreetKey`/`hotspotHref` not exported; `target: null` not assignable).

- [ ] **Step 2: Extend the scene types**

In `web/src/lib/scene/types.ts` replace `export type SceneId = 'camp';` with:

```ts
export type SceneId = 'camp' | 'title' | 'library' | 'delphi';
/** Where a hotspot's plaque sits: above or below its shape, or written `on` the landmark itself
 *  (ink on parchment, e.g. the war tent's portrait sheets). */
export type LabelPos = 'above' | 'below' | 'on';
```

and replace the whole `HotspotDef` interface with:

```ts
export interface HotspotDef {
  id: string;
  /** Place name shown on the label (Cinzel caps). */
  label: string;
  /** Route opened on tap; null when the scene screen handles the tap itself (the title's gate). */
  target: RouteName | null;
  /** Extra route params (e.g. `{ key: 'hydre' }`) and hash query (e.g. `{ panel: 'soin' }`). */
  params?: Record<string, string>;
  query?: Record<string, string>;
  /** A painted icon (`ART.icons...` path) drawn on the plaque before the name. */
  icon?: string;
  shape: HotspotShape;
  labelPos: LabelPos;
  /** A short bronze leader line + pin from the shape to its plaque (UI1 carry #17). */
  leader?: boolean;
  state: (ctx: SceneContext) => HotspotState;
}
```

- [ ] **Step 3: Keyed greetings and `hotspotHref`**

In `web/src/lib/scene/greeting.ts` add below the existing `greeted` set:

```ts
// UI3 Ruling A9: the places' static greetings (owl, Pythia...), keyed `<place>:<profileId>`.
const greetedKeys = new Set<string>();

export function shouldGreetKey(key: string): boolean {
  return !greetedKeys.has(key);
}

export function markGreetedKey(key: string): void {
  greetedKeys.add(key);
}
```

and make `resetGreetings()` also call `greetedKeys.clear();`.

In `web/src/lib/scene/panelNav.ts` add `import type { HotspotDef } from './types';` and:

```ts
/** The route a hotspot opens, or null when the scene handles the tap itself. */
export function hotspotHref(def: HotspotDef, profileId: number): string | null {
  if (!def.target) return null;
  return href(def.target, { profileId: String(profileId), ...(def.params ?? {}) }, def.query);
}
```

Run: `scripts/npm.sh run test -- src/lib/scene/greeting.test.ts src/lib/scene/panelNav.test.ts` — Expected: PASS.

- [ ] **Step 4: Replace `web/src/components/scene/Hotspot.svelte`**

```svelte
<script lang="ts">
  // One clickable place of a scene (scenes UI spec §4): a real <button> covering the shape's box,
  // a glow clipped to the shape, a visible Cinzel label (+ caption, badge), idle glow + bob, a
  // flash on tap. Test id `<sceneId>-<hotspot id>` (UI1 Ruling 4). UI3: `labelPos: 'on'` writes
  // the label in ink on the landmark itself; `leader` pins the plaque to its landmark with a
  // short bronze line (carry #17); `icon` draws a painted icon on the plaque; a locked place
  // explains itself through `onLocked`; `onPress` runs inside the tap itself (user-gesture work
  // such as the audio unlock and the tilt permission, UI3 Ruling A5).
  import { clipPath, labelShift, shapeBox } from '../../lib/scene/geometry';
  import { useSceneRuntime } from '../../lib/scene/runtime.svelte';
  import type { HotspotDef, HotspotState } from '../../lib/scene/types';

  let {
    def,
    status,
    sceneId,
    onActivate,
    onPress,
    onLocked,
  }: {
    def: HotspotDef;
    status: HotspotState;
    sceneId: string;
    onActivate: (def: HotspotDef) => void;
    onPress?: (def: HotspotDef) => void;
    onLocked?: (def: HotspotDef) => void;
  } = $props();

  const rt = useSceneRuntime();
  const box = $derived(shapeBox(def.shape));
  const inked = $derived(def.labelPos === 'on');
  const pinned = $derived(def.leader === true && !inked);
  let flashing = $state(false);
  // Layout width of the plaque (offsetWidth ignores the scene's zoom-in transform), so the label
  // can be clamped inside the safe zone (final review I4, playability #1).
  let labelW = $state(0);
  const shift = $derived(inked ? 0 : labelShift(box.x + box.w / 2, labelW, rt.artW));
  let timer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => () => clearTimeout(timer));

  function onclick() {
    // Final review M3 + UI3 Ruling A6: one tap at a time per stage; SceneStage releases the guard
    // on the next route change (a place stays mounted under its overlays).
    if (rt.activating) return;
    if (status.locked) {
      onLocked?.(def);
      return;
    }
    onPress?.(def);
    rt.activating = true;
    flashing = true;
    timer = setTimeout(
      () => {
        flashing = false;
        onActivate(def);
      },
      rt.reduced ? 0 : 160,
    );
  }
</script>

{#if status.visible}
  <button
    type="button"
    class="hotspot label-{def.labelPos}"
    class:bob={!rt.reduced}
    class:is-new={status.isNew}
    class:locked={status.locked}
    class:flash={flashing}
    class:pinned
    data-testid="{sceneId}-{def.id}"
    aria-disabled={status.locked ? 'true' : undefined}
    style="left:{box.x + box.w / 2}%;top:{box.y + box.h / 2}%;width:{box.w}%;height:{box.h}%"
    {onclick}
  >
    <span class="hotspot-glow" style="clip-path:{clipPath(def.shape)}" aria-hidden="true"></span>
    {#if pinned}<span class="hotspot-leader" aria-hidden="true"></span>{/if}
    <span class="hotspot-label" style="left:calc(50% + {shift}px)" bind:offsetWidth={labelW}>
      <span class="hotspot-name">
        {#if def.icon}<img class="hotspot-icon" src={def.icon} alt="" draggable="false" />{/if}{def.label}
      </span>
      {#if status.caption}<span class="hotspot-caption">{status.caption}</span>{/if}
      <!-- Playability #5: a badge lives on the plaque it counts for, never on the shape. -->
      {#if status.badge !== null}<span class="hotspot-badge" data-testid="{sceneId}-{def.id}-badge">{status.badge}</span>{/if}
    </span>
    {#if status.locked}<span class="sr-only">(fermé pour l'instant)</span>{/if}
  </button>
{/if}

<style>
  .hotspot {
    position: absolute;
    /* Centred on the shape box's centre, so the 48 px floor grows the button symmetrically. */
    transform: translate(-50%, -50%);
    min-width: 48px;
    min-height: 48px;
    z-index: 3;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    appearance: none;
    -webkit-appearance: none;
    font: inherit;
    color: inherit;
    cursor: pointer;
  }
  .hotspot-glow {
    position: absolute;
    inset: 0;
    background: radial-gradient(closest-side, rgba(241, 220, 154, 0.7), rgba(241, 220, 154, 0.15) 70%, rgba(241, 220, 154, 0));
    opacity: 0.3;
    transition: opacity 0.2s ease;
  }
  .hotspot.is-new .hotspot-glow {
    background: radial-gradient(closest-side, rgba(255, 236, 170, 0.9), rgba(201, 162, 39, 0.25) 70%, rgba(201, 162, 39, 0));
  }
  .hotspot:hover .hotspot-glow,
  .hotspot:focus-visible .hotspot-glow {
    opacity: 0.85;
  }
  .hotspot.bob .hotspot-glow {
    animation: kit-glow 3.2s ease-in-out infinite;
  }
  .hotspot.bob .hotspot-label {
    animation: kit-label-bob 3.2s ease-in-out infinite;
  }
  .hotspot.bob.label-on .hotspot-label {
    animation: none;
  }
  .hotspot.flash .hotspot-glow {
    opacity: 1;
    animation: kit-flash 0.16s ease-out;
  }
  .hotspot-label {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 4px 12px;
    white-space: nowrap;
    border-radius: 8px;
    border: 1px solid var(--bronze-light);
    background: rgba(21, 18, 26, 0.66);
    color: var(--bronze-ink);
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.35);
  }
  .label-below .hotspot-label {
    top: calc(100% + 4px);
  }
  .label-above .hotspot-label {
    bottom: calc(100% + 4px);
  }
  .pinned.label-below .hotspot-label {
    top: calc(100% + 16px);
  }
  .pinned.label-above .hotspot-label {
    bottom: calc(100% + 16px);
  }
  /* Carry #17: a short bronze line from the landmark to its plaque, with a gold pin at the
     landmark end, so a label never floats over the sky or the sea. */
  .hotspot-leader {
    position: absolute;
    left: 50%;
    width: 2px;
    height: 16px;
    transform: translateX(-50%);
    background: linear-gradient(var(--bronze-light), var(--bronze));
    box-shadow: 0 0 2px rgba(0, 0, 0, 0.5);
    pointer-events: none;
  }
  .label-below .hotspot-leader {
    top: 100%;
  }
  .label-above .hotspot-leader {
    bottom: 100%;
  }
  .hotspot-leader::before {
    content: '';
    position: absolute;
    left: 50%;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    background: var(--gold-light);
    border: 1px solid var(--bronze-dark);
  }
  .label-below .hotspot-leader::before {
    top: 0;
  }
  .label-above .hotspot-leader::before {
    top: 100%;
  }
  /* Ink on the landmark (portrait sheets): no dark plaque, no bob. */
  .label-on .hotspot-label {
    bottom: 4%;
    padding: 2px 6px;
    border: 0;
    border-radius: 4px;
    background: rgba(243, 230, 200, 0.85);
    color: var(--ink);
    box-shadow: none;
  }
  .label-on .hotspot-name,
  .label-on .hotspot-caption {
    font-size: 12px;
  }
  .hotspot-name {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 15px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .hotspot-icon {
    width: 26px;
    height: 26px;
    object-fit: contain;
  }
  .hotspot-caption {
    font-family: var(--font-body);
    font-style: italic;
    font-size: 14px;
  }
  .hotspot-badge {
    position: absolute;
    top: -14px;
    right: -14px;
    border: 2px solid var(--bronze-dark);
    font-family: var(--font-body);
    font-size: 15px;
    font-style: normal;
    min-width: 28px;
    height: 28px;
    padding: 0 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: var(--gold);
    color: var(--ink);
    font-weight: 700;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
  }
  .hotspot.locked {
    cursor: default;
  }
  .hotspot.locked .hotspot-glow {
    opacity: 0.1;
    filter: grayscale(1);
  }
  .hotspot:focus-visible {
    outline: none;
  }
  .hotspot:focus-visible .hotspot-label {
    outline: 3px solid var(--gold-light);
    outline-offset: 2px;
  }
</style>
```

- [ ] **Step 5: Overlay size + form kit class, SceneStage guard release, debug label box**

`web/src/components/scene/Overlay.svelte`:
- add `size = 'md',` to the destructured props and `size?: 'md' | 'wide';` to their type (after `variant`);
- on the panel `<div use:modal ...>` add `class:overlay-wide={size === 'wide'}`;
- change `<div class="overlay-body">` to `<div class="overlay-body kit-form">`;
- add to `<style>`:

```css
  /* UI3: the scan's verify step, the three Oracle scrolls and the dossier need room. */
  .overlay-wide {
    width: min(1040px, calc(100vw - 32px));
  }
```

`web/src/components/scene/SceneStage.svelte`, after the `runtime.artW/artH` effect:

```ts
  // UI3 Ruling A6: a place stays mounted under its overlays, so the one-tap-at-a-time guard is
  // released on every route change (the camp is unmounted by its own navigation anyway).
  $effect(() => {
    void router.route;
    runtime.activating = false;
  });
```

`web/src/components/scene/HotspotDebug.svelte`: import `type LabelPos` from `../../lib/scene/types` and replace `labelBox` with:

```ts
  function labelBox(box: Box, labelPos: LabelPos): Box {
    if (labelPos === 'on') return { x: box.x, y: box.y + box.h - LABEL_BOX_H / 2, w: box.w, h: LABEL_BOX_H / 2 };
    return labelPos === 'below'
      ? { x: box.x, y: box.y + box.h, w: box.w, h: LABEL_BOX_H }
      : { x: box.x, y: box.y - LABEL_BOX_H, w: box.w, h: LABEL_BOX_H };
  }
```

`web/src/screens/Camp.svelte`: import `hotspotHref` from `../lib/scene/panelNav` and make `activate` read:

```ts
  function activate(def: HotspotDef) {
    const to = hotspotHref(def, profile.id);
    if (!to) return;
    unlockAudio();
    playSfx('tap');
    leaveTo(to);
  }
```

- [ ] **Step 6: Create `web/src/components/scene/SceneExit.svelte`**

```svelte
<script lang="ts">
  // The way back to the camp from a place (UI3 Ruling A7): a bronze sign at the bottom-left of
  // the safe zone, left of the dialogue dock (x 27 %), so no hotspot and no dialogue covers it.
  import { href } from '../../lib/routes';
  import { navigate } from '../../lib/router.svelte';
  import { playSfx, unlockAudio } from '../../lib/juice/sfx';

  let { profileId }: { profileId: number } = $props();

  function go() {
    unlockAudio();
    playSfx('tap');
    navigate(href('camp', { profileId: String(profileId) }));
  }
</script>

<button type="button" class="scene-exit kit-bronze" data-testid="scene-exit" onclick={go}>
  <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true">
    <path d="M19 7L10 16l9 9" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
  <span>Le camp</span>
</button>

<style>
  .scene-exit {
    position: absolute;
    left: 13.5%;
    bottom: 3%;
    z-index: 4;
  }
</style>
```

- [ ] **Step 7: Create `web/src/components/scene/PlaceScene.svelte`**

```svelte
<script lang="ts">
  // The shell of every place scene but the title (UI3 Ruling A7): the stage, the slim HUD, the
  // exit sign, and the /camp data the HUD and the hotspot states read. The screen renders its
  // hotspots, layers and in-scene objects through `children(ctx)`, inside the art box; its
  // overlays are rendered next to this component (they are fixed-position, like the camp's).
  import { untrack, type Snippet } from 'svelte';
  import SceneStage from './SceneStage.svelte';
  import Hud from './Hud.svelte';
  import SceneExit from './SceneExit.svelte';
  import { campStore, loadCatalog, refreshCamp } from '../../lib/world/campStore.svelte';
  import { initSound } from '../../lib/juice/soundStore.svelte';
  import { playSfx, unlockAudio } from '../../lib/juice/sfx';
  import { heroPanelHref, openPanel } from '../../lib/scene/panelNav';
  import type { SceneContext, SceneDef } from '../../lib/scene/types';
  import type { Profile } from '../../lib/types';

  let {
    profile,
    scene,
    debug = $bindable(false),
    children,
  }: { profile: Profile; scene: SceneDef; debug?: boolean; children: Snippet<[SceneContext]> } = $props();

  // Depends on the profile id only (same reasoning as Camp.svelte, final review I2).
  $effect(() => {
    const id = profile.id;
    untrack(() => {
      initSound(profile);
      void refreshCamp(id);
      void loadCatalog();
    });
  });

  // campStore is shared across profiles: ignore a snapshot that belongs to the previous hero.
  const camp = $derived(campStore.data && campStore.data.profile.id === profile.id ? campStore.data : null);
  const ctx = $derived<SceneContext>({ camp, catalog: campStore.catalog });

  function openHero() {
    unlockAudio();
    playSfx('tap');
    openPanel(heroPanelHref(profile.id));
  }
</script>

<SceneStage {scene} {ctx} bind:debug>
  {#snippet hud()}
    <Hud {profile} {camp} onHero={openHero} />
  {/snippet}
  {@render children(ctx)}
  <SceneExit profileId={profile.id} />
</SceneStage>
```

- [ ] **Step 8: Shared e2e helpers**

In `web/e2e/helpers.ts` append:

```ts
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Reads every requested box in one browser round trip (UI1 round 1 review #2): separate
// boundingBox() calls can straddle a layout-changing frame.
export async function measureBoxes(page: Page, selectors: Record<string, string>): Promise<Record<string, Rect | null>> {
  return page.evaluate((sel) => {
    const out: Record<string, { x: number; y: number; width: number; height: number } | null> = {};
    for (const [key, selector] of Object.entries(sel)) {
      const el = document.querySelector(selector);
      if (!el) {
        out[key] = null;
        continue;
      }
      const r = el.getBoundingClientRect();
      out[key] = { x: r.x, y: r.y, width: r.width, height: r.height };
    }
    return out;
  }, selectors);
}

// UI3: a place scene is on screen and has finished its entry (never click into the zoom-in).
export async function expectScene(page: Page, sceneId: string) {
  await expect(page.getByTestId(`scene-${sceneId}`)).toBeVisible();
  await waitForSceneSettled(page);
}

// Closes whichever overlay is open (wax seal) and waits until it has left.
export async function closeOverlay(page: Page) {
  const seal = page.getByTestId('overlay-close');
  if ((await seal.count()) === 0) return;
  await seal.click();
  await expect(page.locator('.overlay-panel')).toHaveCount(0);
}

// Every listed hotspot and its label plaque sit inside the art's 4:3 safe zone (x 12.5-87.5 %,
// hotspots below the HUD band at y 14 %) and on screen; every hotspot is a 48 px touch target.
export async function expectInSafeZone(page: Page, sceneId: string, testIds: string[]) {
  const sel: Record<string, string> = { art: `[data-testid="scene-${sceneId}"] .art` };
  for (const id of testIds) {
    sel[id] = `[data-testid="${id}"]`;
    sel[`${id}-label`] = `[data-testid="${id}"] .hotspot-label`;
  }
  const b = await measureBoxes(page, sel);
  const art = b.art;
  if (!art) throw new Error(`scene-${sceneId} .art did not render`);
  const zone = {
    left: art.x + art.width * 0.125,
    right: art.x + art.width * 0.875,
    top: art.y + art.height * 0.14,
    bottom: art.y + art.height,
  };
  const EPS = 0.5; // sub-pixel rounding of shapes authored flush with the zone edge
  const vw = page.viewportSize()!.width;
  for (const id of testIds) {
    const h = b[id];
    const l = b[`${id}-label`];
    if (!h || !l) throw new Error(`${id} or its label did not render`);
    expect(h.x, `${id} left edge in the safe zone`).toBeGreaterThanOrEqual(zone.left - EPS);
    expect(h.x + h.width, `${id} right edge in the safe zone`).toBeLessThanOrEqual(zone.right + EPS);
    expect(h.y, `${id} top edge below the HUD band`).toBeGreaterThanOrEqual(zone.top - EPS);
    expect(h.y + h.height, `${id} bottom edge in the art`).toBeLessThanOrEqual(zone.bottom + EPS);
    expect(Math.min(h.width, h.height), `${id} is a 48 px touch target`).toBeGreaterThanOrEqual(48);
    expect(l.x, `${id} label left edge in the safe zone`).toBeGreaterThanOrEqual(Math.max(0, zone.left - EPS));
    expect(l.x + l.width, `${id} label right edge in the safe zone`).toBeLessThanOrEqual(Math.min(vw, zone.right + EPS));
  }
}

// Every hotspot label that covers another hotspot or another label of the same scene.
export async function labelOverlaps(page: Page, sceneId: string): Promise<string[]> {
  return page.evaluate((sid) => {
    const hit = (a: DOMRect, b: DOMRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const spots = Array.from(document.querySelectorAll(`[data-testid="scene-${sid}"] button.hotspot`));
    const out: string[] = [];
    for (const s of spots) {
      const label = s.querySelector('.hotspot-label');
      if (!label) continue;
      const lr = label.getBoundingClientRect();
      for (const o of spots) {
        if (o === s) continue;
        if (hit(lr, o.getBoundingClientRect())) out.push(`${s.getAttribute('data-testid')} label over ${o.getAttribute('data-testid')}`);
        const ol = o.querySelector('.hotspot-label');
        if (ol && hit(lr, ol.getBoundingClientRect())) out.push(`${s.getAttribute('data-testid')} label over ${o.getAttribute('data-testid')} label`);
      }
    }
    return out;
  }, sceneId);
}
```

In `web/e2e/scenes-camp.spec.ts` delete the local `interface Rect` and `async function measureBoxes` and add `measureBoxes` to the import from `./helpers`.

- [ ] **Step 9: Verify**

Run: `scripts/npm.sh run test` — Expected: every vitest file passes (validate/camp tests unchanged).
Run: `scripts/npm.sh run check` — Expected: `0 errors and 0 warnings`.
Run: `scripts/playwright.sh scenes-` — Expected: `scenes-camp` and `scenes-debug` pass on `desktop` and `ipad` (the camp is unchanged by the new optional fields; the guard release does not re-enable a double navigation because the camp's `leaveTo` is idempotent).

- [ ] **Step 10: Commit**

```bash
git add web/src/lib/scene/types.ts web/src/lib/scene/greeting.ts web/src/lib/scene/greeting.test.ts web/src/lib/scene/panelNav.ts web/src/lib/scene/panelNav.test.ts web/src/components/scene/Hotspot.svelte web/src/components/scene/Overlay.svelte web/src/components/scene/SceneStage.svelte web/src/components/scene/HotspotDebug.svelte web/src/components/scene/SceneExit.svelte web/src/components/scene/PlaceScene.svelte web/src/screens/Camp.svelte web/e2e/helpers.ts web/e2e/scenes-camp.spec.ts
git commit -m "UI3a: engine for places - hotspot icons/leaders/ink labels/locked taps, wide overlays, exit sign, place shell

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/lib/scene/types.ts web/src/lib/scene/greeting.ts web/src/lib/scene/greeting.test.ts web/src/lib/scene/panelNav.ts web/src/lib/scene/panelNav.test.ts web/src/components/scene/Hotspot.svelte web/src/components/scene/Overlay.svelte web/src/components/scene/SceneStage.svelte web/src/components/scene/HotspotDebug.svelte web/src/components/scene/SceneExit.svelte web/src/components/scene/PlaceScene.svelte web/src/screens/Camp.svelte web/e2e/helpers.ts web/e2e/scenes-camp.spec.ts
```

### Task 3: The in-world form kit and the UI2 art map

**Files:**
- Create: `web/src/styles/kit-form.css`, `web/src/styles/kit-form.test.ts`
- Modify: `web/src/main.ts`
- Modify: `web/src/lib/world/art.ts`, `web/src/lib/world/art.test.ts`

**Interfaces:**
- Consumes: Task 2 (every `Overlay` body has `class="overlay-body kit-form"`); kit tokens of `web/src/styles/kit.css` (`--parchment-edge`, `--parchment-shadow`, `--bronze*`, `--marble-plaque`, `--marble-vein`); app tokens (`--ink`, `--font-*`).
- Produces:
  - `.kit-form` scope (Ruling A8) with tokens `--form-field: #fbf4e2`, `--form-edge: #a8834f`, `--form-ink-soft: #5c4a32`.
  - `ART.scenes.{titleGates, hubCamp, nest, delphi, libraryTent, warTent, cabin}`, `ART.characters.{pythia, owl}`, `ART.props.{votiveTablets, codexLectern, trophyShelf}` (paths under `/art/...`).

- [ ] **Step 1: Write the failing tests**

`web/src/styles/kit-form.test.ts`:

```ts
// UI3 Ruling A8 (scenes UI spec §2.4): real HTML forms restyled as parchment, bronze and marble.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { contrastRatio } from '../lib/ui/contrast';

const css = readFileSync('src/styles/kit-form.css', 'utf-8');
const tokens: Record<string, string> = Object.fromEntries(
  [...css.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((m) => [m[1], m[2]]),
);
const INK = '#2b2a28';
const PARCHMENT_SOLID = '#f3e6c8';

describe('in-world form kit', () => {
  it('restyles every legacy form control, but only inside .kit-form', () => {
    for (const sel of ['.kit-form input', '.kit-form select', '.kit-form textarea', '.kit-form label', '.kit-form .btn', '.kit-form .btn-primary', '.kit-form .btn-ghost', '.kit-form .card', '.kit-form .chip', '.kit-form .chip-active', '.kit-form table', '.kit-form h2', '.kit-form .muted']) {
      expect(css, sel).toContain(sel);
    }
    const bare = css
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('}')
      .map((rule) => rule.split('{')[0].trim())
      .filter((sel) => sel && !sel.startsWith(':root'));
    for (const sel of bare) {
      for (const part of sel.split(',')) expect(part.trim().startsWith('.kit-form'), part).toBe(true);
    }
  });

  it('keeps text legible on the parchment fields', () => {
    expect(contrastRatio(INK, tokens['form-field'])).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(tokens['form-ink-soft'], tokens['form-field'])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tokens['form-ink-soft'], PARCHMENT_SOLID)).toBeGreaterThanOrEqual(4.5);
  });

  it('never defines a red', () => {
    for (const [name, hex] of Object.entries(tokens)) {
      const n = parseInt(hex.slice(1), 16);
      const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      expect(r >= 200 && g < 60 && b < 60, name).toBe(false);
    }
  });

  it('is loaded after the legacy app.css so it wins the cascade', () => {
    const main = readFileSync('src/main.ts', 'utf-8');
    expect(main.indexOf("'./styles/kit-form.css'")).toBeGreaterThan(main.indexOf("'./app.css'"));
  });
});
```

In `web/src/lib/world/art.test.ts` add:

```ts
  it('maps the UI2 scenes, characters and props (docs/art/scenes.md)', () => {
    expect(ART.scenes.titleGates).toBe('/art/scenes/title_gates.webp');
    expect(ART.scenes.hubCamp).toBe('/art/scenes/hub_camp.webp');
    expect(ART.scenes.libraryTent).toBe('/art/scenes/library_tent.webp');
    expect(ART.scenes.delphi).toBe('/art/scenes/delphi.webp');
    expect(ART.scenes.warTent).toBe('/art/scenes/war_tent.webp');
    expect(ART.scenes.nest).toBe('/art/scenes/nest.webp');
    expect(ART.scenes.cabin).toBe('/art/scenes/cabin.webp');
    expect(ART.characters).toEqual({ pythia: '/art/characters/pythia_cut.webp', owl: '/art/characters/owl_cut.webp' });
    expect(ART.props).toEqual({
      votiveTablets: '/art/props/votive_tablets_cut.webp',
      codexLectern: '/art/props/codex_lectern_cut.webp',
      trophyShelf: '/art/props/trophy_shelf_cut.webp',
    });
  });
```

Run: `scripts/npm.sh run test -- src/styles/kit-form.test.ts src/lib/world/art.test.ts`
Expected: FAIL (`ENOENT kit-form.css`; `ART.scenes.titleGates` undefined).

- [ ] **Step 2: Write `web/src/styles/kit-form.css`**

```css
/* In-world forms (scenes UI spec §2.4, UI3 Ruling A8): real HTML inputs restyled as
   semi-transparent parchment fields, bronze buttons and marble chips. Scoped to `.kit-form`,
   which every Overlay body carries, so the legacy screens UI4 has not reached (Play, Boss) keep
   their look. Loaded after app.css. No red anywhere. */
:root {
  --form-field: #fbf4e2;
  --form-edge: #a8834f;
  --form-ink-soft: #5c4a32;
}

.kit-form {
  color: var(--ink);
  font-family: var(--font-body);
}
.kit-form h2,
.kit-form h3 {
  font-family: var(--font-display);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--bronze-dark);
}
.kit-form h2 {
  font-size: 18px;
  margin: 18px 0 8px;
}
.kit-form h3 {
  font-size: 15px;
}
.kit-form .muted {
  color: var(--form-ink-soft);
}
/* Alegreya small caps, not Cinzel: some labels are whole sentences (Cinzel is caps-only). */
.kit-form label {
  font-family: var(--font-body);
  font-weight: 700;
  font-variant: small-caps;
  letter-spacing: 0.03em;
  color: var(--bronze-dark);
}
.kit-form input:not([type='radio']):not([type='checkbox']):not([type='file']),
.kit-form select,
.kit-form textarea {
  background: rgba(251, 244, 226, 0.78);
  border: 1px solid var(--form-edge);
  border-radius: 8px;
  color: var(--ink);
  font-family: var(--font-body);
  box-shadow: inset 0 1px 3px rgba(92, 64, 24, 0.25);
}
/* A textarea holds a text to defend: Literata, the reading face (spec §2.7). */
.kit-form textarea {
  font-family: var(--font-reading);
  line-height: 1.6;
}
.kit-form input:focus-visible,
.kit-form select:focus-visible,
.kit-form textarea:focus-visible {
  outline: 3px solid var(--bronze-light);
  outline-offset: 1px;
}
.kit-form input[type='radio'],
.kit-form input[type='checkbox'] {
  accent-color: var(--bronze);
}
.kit-form .btn {
  border: 1px solid var(--bronze-dark);
  border-radius: 10px;
  background: linear-gradient(180deg, rgba(255, 247, 230, 0.92), rgba(236, 219, 184, 0.92));
  color: var(--bronze-dark);
  font-family: var(--font-display);
  font-weight: 700;
  letter-spacing: 0.04em;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.7),
    0 2px 5px rgba(92, 64, 24, 0.25);
}
.kit-form .btn-primary {
  background: linear-gradient(180deg, var(--bronze-light) 0%, var(--bronze) 45%, var(--bronze-dark) 100%);
  color: var(--bronze-ink);
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.45);
}
.kit-form .btn-ghost {
  background: transparent;
  border-color: transparent;
  box-shadow: none;
}
.kit-form .btn:disabled {
  filter: grayscale(0.6);
  opacity: 0.6;
  cursor: default;
}
.kit-form .card {
  background: rgba(255, 250, 238, 0.55);
  border: 1px solid var(--parchment-edge);
  border-radius: 10px;
  box-shadow: 0 2px 6px var(--parchment-shadow);
  color: var(--ink);
}
.kit-form .card:hover {
  box-shadow: 0 3px 10px var(--parchment-shadow);
}
.kit-form .chip {
  background:
    repeating-linear-gradient(115deg, transparent 0 14px, var(--marble-vein) 14px 15px, transparent 15px 31px),
    linear-gradient(180deg, #faf6ef, var(--marble-plaque));
  border: 1px solid #cfc5b4;
  color: var(--ink);
}
.kit-form .chip-active {
  background: linear-gradient(180deg, var(--bronze-light), var(--bronze));
  border-color: var(--bronze-dark);
  color: var(--bronze-ink);
}
.kit-form .parchment {
  background: rgba(255, 250, 238, 0.5);
  border-color: var(--parchment-edge);
}
.kit-form table {
  border-collapse: collapse;
  width: 100%;
}
.kit-form th {
  padding: 6px 8px;
  border-bottom: 2px solid var(--form-edge);
  font-family: var(--font-display);
  font-size: 13px;
  letter-spacing: 0.05em;
  text-align: left;
  text-transform: uppercase;
  color: var(--bronze-dark);
}
.kit-form td {
  padding: 6px 8px;
  border-bottom: 1px solid rgba(168, 131, 79, 0.35);
}
```

In `web/src/main.ts` add `import './styles/kit-form.css';` on the line after `import './styles/kit.css';`.

- [ ] **Step 3: Extend the art map**

In `web/src/lib/world/art.ts`, inside `ART`, add after `emblems: {...},`:

```ts
  // UI2 cut-outs (docs/art/scenes.md): the Pythia on her tripod, Athena's owl, three props.
  characters: {
    pythia: '/art/characters/pythia_cut.webp',
    owl: '/art/characters/owl_cut.webp',
  },
  props: {
    votiveTablets: '/art/props/votive_tablets_cut.webp',
    codexLectern: '/art/props/codex_lectern_cut.webp',
    trophyShelf: '/art/props/trophy_shelf_cut.webp',
  },
```

and inside `scenes: {...}` add after `battle`:

```ts
    // UI2 scenes (2048×1152), one per place (docs/art/scenes.md).
    titleGates: '/art/scenes/title_gates.webp',
    hubCamp: '/art/scenes/hub_camp.webp',
    nest: '/art/scenes/nest.webp',
    delphi: '/art/scenes/delphi.webp',
    libraryTent: '/art/scenes/library_tent.webp',
    warTent: '/art/scenes/war_tent.webp',
    cabin: '/art/scenes/cabin.webp',
```

- [ ] **Step 4: Run the tests and the type check**

Run: `scripts/npm.sh run test -- src/styles/kit-form.test.ts src/lib/world/art.test.ts src/lib/world/scenes/budget.test.ts`
Expected: PASS (existing art budget: the new characters/props are 55–103 KB each, under 150 KB, and the non-scene total stays under 2.5 MB).
Run: `scripts/npm.sh run check` — Expected: `0 errors and 0 warnings`.

- [ ] **Step 5: Commit**

```bash
git add web/src/styles/kit-form.css web/src/styles/kit-form.test.ts web/src/main.ts web/src/lib/world/art.ts web/src/lib/world/art.test.ts
git commit -m "UI3a: in-world form kit for overlay bodies, UI2 scenes and cut-outs in the art map

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/styles/kit-form.css web/src/styles/kit-form.test.ts web/src/main.ts web/src/lib/world/art.ts web/src/lib/world/art.test.ts
```

### Task 4: The painted icon map and reward medallions

**Precondition:** the 35 icons of Ruling A12 exist in `web/public/art/icons/` (run `ls web/public/art/icons | wc -l` → 35). If not, stop and report BLOCKED with the list of missing files.

**Files:**
- Modify: `web/src/lib/world/art.ts`, `web/src/lib/world/art.test.ts`
- Modify: `web/src/lib/world/dragon.ts`, `web/src/lib/world/dragon.test.ts`
- Modify (full replacement below): `web/src/components/juice/Medallion.svelte`
- Modify: `web/src/screens/Cabin.svelte`, `web/src/components/ProgressionReveal.svelte`, `web/src/screens/Lieutenant.svelte`, `web/src/components/Scroll.svelte`, `web/src/screens/Oracle.svelte`, `web/src/screens/Boss.svelte`
- Modify: `web/e2e/world.spec.ts`

**Interfaces:**
- Consumes: `type Avatar` (`web/src/lib/levels.ts`), `type LieutenantKey`, `type RewardKind`, `type Tint` (`web/src/lib/world/types.ts`).
- Produces (all in `web/src/lib/world/art.ts`):
  - `export const REWARD_ICONS: Record<string, string>` (14 reward ids → `/art/icons/<file>.webp`), `export const AVATAR_ICONS: Record<Avatar, string>`, `export const LIEUTENANT_ICONS: Record<LieutenantKey, string>`, `export const TOOL_ICONS: { persee; athena; ariane; argus }`, `export const ADD_ICONS: { text; scan; alexandria }`, `export const MARK_ICONS: { oracleSeal; lock }`, `export const RELIC_OF: Record<LieutenantKey, string>`; `ART.icons = { rewards, avatars, lieutenants, tools, add, marks }`.
  - `export function rewardIcon(id: string): string | null`, `export function avatarIcon(avatar: string): string` (falls back to the owl), `export function lieutenantIcon(key: string): string | null`, `export function rewardKindOf(id: string): RewardKind`.
  - `web/src/lib/world/dragon.ts`: `export const TINT_SWATCH: Record<Tint, string>`.
  - `Medallion.svelte` props: `{ rewardId: string; kind: RewardKind; size?: number; locked?: boolean }` (was `glyph`); renders `data-reward={rewardId}`.
  - `Scroll.svelte` gains `rewardId?: string | null`.

- [ ] **Step 1: Write the failing tests**

In `web/src/lib/world/art.test.ts`: add `readFileSync, readdirSync` to the `node:fs` import and `ADD_ICONS, AVATAR_ICONS, LIEUTENANT_ICONS, MARK_ICONS, RELIC_OF, REWARD_ICONS, TOOL_ICONS, avatarIcon, lieutenantIcon, rewardIcon, rewardKindOf` to the `./art` import; change the `nonScene` filter to leave icons out too:

```ts
  // Scene backgrounds have their own 600 KB budget (scenes/budget.test.ts), painted icons their
  // own (below, UI3 Ruling A12).
  const nonScene = () => flat(ART).filter((p) => !p.startsWith('/art/scenes/') && !p.startsWith('/art/icons/'));
```

and add:

```ts
  it('maps the 35 painted icons, each within its own budget (UI3 Ruling A12)', () => {
    const icons = flat(ART.icons);
    expect(icons).toHaveLength(35);
    for (const p of icons) expect(statSync('public' + p).size, p).toBeLessThanOrEqual(60 * 1024);
    expect(icons.reduce((s, p) => s + statSync('public' + p).size, 0)).toBeLessThanOrEqual(1.5 * 1024 * 1024);
    const onDisk = readdirSync('public/art/icons').filter((f) => f.endsWith('.webp')).map((f) => `/art/icons/${f}`);
    expect([...onDisk].sort()).toEqual([...icons].sort());
    expect(Object.keys(AVATAR_ICONS)).toHaveLength(6);
    expect(Object.keys(LIEUTENANT_ICONS)).toHaveLength(6);
    expect(Object.keys(TOOL_ICONS)).toEqual(['persee', 'athena', 'ariane', 'argus']);
    expect(Object.keys(ADD_ICONS)).toEqual(['text', 'scan', 'alexandria']);
    expect(MARK_ICONS).toEqual({ oracleSeal: '/art/icons/seal-oracle.webp', lock: '/art/icons/lock.webp' });
  });

  it('has a painted icon for every non-tint reward of the server catalog, and a relic per lieutenant', () => {
    const py = readFileSync('../server/app/world/catalog.py', 'utf-8');
    const ids = [...py.matchAll(/_r\("([^"]+)", "(relic|gear|decor)"/g)].map((m) => m[1]);
    expect(ids).toHaveLength(14);
    expect(Object.keys(REWARD_ICONS).sort()).toEqual([...ids].sort());
    expect(rewardIcon('decor:lanterne')).toBe('/art/icons/lanterne.webp');
    expect(rewardIcon('sandales_hermes')).toBe('/art/icons/sandales_hermes.webp');
    expect(rewardIcon('tint:ecume')).toBeNull();
    for (const [key, relic] of Object.entries(RELIC_OF)) {
      expect(py, key).toContain(`"relic": "${relic}"`);
      expect(rewardKindOf(relic)).toBe('relic');
    }
    expect([rewardKindOf('tint:jade'), rewardKindOf('decor:tapis'), rewardKindOf('egide')]).toEqual(['tint', 'decor', 'gear']);
  });

  it('falls back to the owl for an unknown avatar and to nothing for an unknown lieutenant', () => {
    expect(avatarIcon('trident')).toBe('/art/icons/avatar-trident.webp');
    expect(avatarIcon('medusa')).toBe('/art/icons/avatar-chouette.webp');
    expect(lieutenantIcon('hydre')).toBe('/art/icons/lt-hydre.webp');
    expect(lieutenantIcon('medusa')).toBeNull();
  });
```

In `web/src/lib/world/dragon.test.ts` add (import `TINT_SWATCH`):

```ts
  it('has a flat swatch per tint, never a red (UI3 Ruling A12)', () => {
    expect(Object.keys(TINT_SWATCH).sort()).toEqual(['argent', 'braise', 'bronze', 'ecume', 'jade', 'olivier']);
    for (const [tint, hex] of Object.entries(TINT_SWATCH)) {
      const n = parseInt(hex.slice(1), 16);
      const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      expect(r >= 200 && g < 60 && b < 60, tint).toBe(false);
    }
  });
```

Run: `scripts/npm.sh run test -- src/lib/world/art.test.ts src/lib/world/dragon.test.ts`
Expected: FAIL (`ART.icons` undefined, `TINT_SWATCH` not exported).

- [ ] **Step 2: Map the icons in `art.ts`**

At the top of `web/src/lib/world/art.ts` add:

```ts
import type { Avatar } from '../levels';
import type { LieutenantKey, RewardKind } from './types';

const icon = (name: string) => `/art/icons/${name}.webp`;

/** Painted reward icons (UI3 Ruling A12), keyed by the reward ids of server/app/world/catalog.py
 *  REWARDS; decor files drop their `decor:` prefix. Tints have no icon: they are colour swatches
 *  (TINT_SWATCH in dragon.ts). */
export const REWARD_ICONS: Record<string, string> = {
  ecaille_hydre: icon('ecaille_hydre'),
  voix_echo: icon('voix_echo'),
  criniere_chimere: icon('criniere_chimere'),
  perle_protee: icon('perle_protee'),
  plume_sirene: icon('plume_sirene'),
  pavot_lethe: icon('pavot_lethe'),
  sandales_hermes: icon('sandales_hermes'),
  egide: icon('egide'),
  foudre_zeus: icon('foudre_zeus'),
  'decor:lanterne': icon('lanterne'),
  'decor:tapis': icon('tapis'),
  'decor:bibliotheque': icon('bibliotheque'),
  'decor:trophee': icon('trophee'),
  'decor:fresque': icon('fresque'),
};

/** The hero emblems (was AVATAR_GLYPHS, UI3 Ruling A13). */
export const AVATAR_ICONS: Record<Avatar, string> = {
  chouette: icon('avatar-chouette'),
  dragon: icon('avatar-dragon'),
  lyre: icon('avatar-lyre'),
  trident: icon('avatar-trident'),
  laurier: icon('avatar-laurier'),
  foudre: icon('avatar-foudre'),
};

/** The ONE source of the lieutenants' small icons (was the server's `glyph` + five client copies). */
export const LIEUTENANT_ICONS: Record<LieutenantKey, string> = {
  hydre: icon('lt-hydre'),
  echo: icon('lt-echo'),
  chimere: icon('lt-chimere'),
  protee: icon('lt-protee'),
  sirenes: icon('lt-sirenes'),
  lethe: icon('lt-lethe'),
};

/** The proofreading help tools (Bouclier de Persée, Chouette d'Athéna, Fil d'Ariane, Argus). */
export const TOOL_ICONS = {
  persee: icon('tool-persee'),
  athena: icon('tool-athena'),
  ariane: icon('tool-ariane'),
  argus: icon('tool-argus'),
} as const;

/** The three ways to bring a text into the library (desk, lens, portal). */
export const ADD_ICONS = {
  text: icon('add-text'),
  scan: icon('add-scan'),
  alexandria: icon('add-alexandria'),
} as const;

/** Small marks: the Oracle's wax seal, a padlock. */
export const MARK_ICONS = {
  oracleSeal: icon('seal-oracle'),
  lock: icon('lock'),
} as const;

/** The relic each lieutenant leaves when neutralised (catalog.py LIEUTENANTS[*].relic). */
export const RELIC_OF: Record<LieutenantKey, string> = {
  hydre: 'ecaille_hydre',
  echo: 'voix_echo',
  chimere: 'criniere_chimere',
  protee: 'perle_protee',
  sirenes: 'plume_sirene',
  lethe: 'pavot_lethe',
};
```

inside `ART` add (after `props`):

```ts
  icons: {
    rewards: REWARD_ICONS,
    avatars: AVATAR_ICONS,
    lieutenants: LIEUTENANT_ICONS,
    tools: TOOL_ICONS,
    add: ADD_ICONS,
    marks: MARK_ICONS,
  },
```

and at the end of the file:

```ts
export function rewardIcon(id: string): string | null {
  return REWARD_ICONS[id] ?? null;
}

export function avatarIcon(avatar: string): string {
  return AVATAR_ICONS[avatar as Avatar] ?? AVATAR_ICONS.chouette;
}

export function lieutenantIcon(key: string): string | null {
  return LIEUTENANT_ICONS[key as LieutenantKey] ?? null;
}

export function rewardKindOf(id: string): RewardKind {
  if (id.startsWith('tint:')) return 'tint';
  if (id.startsWith('decor:')) return 'decor';
  return (Object.values(RELIC_OF) as string[]).includes(id) ? 'relic' : 'gear';
}
```

In `web/src/lib/world/dragon.ts` add below `TINT_FILTERS`:

```ts
/** Flat colour swatches for the tint rewards (UI3 Ruling A12): a tint is a colour, not an object.
 *  Braise is an ember orange, never a red. */
export const TINT_SWATCH: Record<Tint, string> = {
  bronze: '#b8863b',
  ecume: '#3f8fb0',
  olivier: '#7a8a4b',
  braise: '#d06a2c',
  jade: '#3a9a78',
  argent: '#c4c8d0',
};
```

Run: `scripts/npm.sh run test -- src/lib/world/art.test.ts src/lib/world/dragon.test.ts` — Expected: PASS.

- [ ] **Step 3: Replace `web/src/components/juice/Medallion.svelte`**

```svelte
<script lang="ts">
  // A reward medallion (UI3 Ruling A12): the painted reward icon in a gold ring; a tint is a flat
  // colour swatch; `locked` greys the ring and shows a plain « ? » so an undiscovered reward reads
  // as a mystery, never a blank (an unknown id falls back to the same « ? »).
  import { rewardIcon } from '../../lib/world/art';
  import { TINT_SWATCH } from '../../lib/world/dragon';
  import type { RewardKind, Tint } from '../../lib/world/types';

  let {
    rewardId,
    kind,
    size = 72,
    locked = false,
  }: { rewardId: string; kind: RewardKind; size?: number; locked?: boolean } = $props();

  const swatch = $derived(kind === 'tint' ? (TINT_SWATCH[rewardId.slice('tint:'.length) as Tint] ?? null) : null);
  const icon = $derived(kind === 'tint' ? null : rewardIcon(rewardId));
</script>

<div
  class="medallion"
  class:locked
  data-kind={kind}
  data-reward={rewardId}
  style="width:{size}px;height:{size}px;font-size:{size * 0.5}px"
  role={locked ? 'img' : undefined}
  aria-label={locked ? 'Récompense à découvrir' : undefined}
>
  {#if !locked && swatch}
    <span class="swatch" style="background:radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.55), {swatch} 62%)" aria-hidden="true"></span>
  {:else if !locked && icon}
    <img class="icon" src={icon} alt="" draggable="false" />
  {:else}
    <span class="mystery" aria-hidden="true">?</span>
  {/if}
</div>

<style>
  .medallion {
    border-radius: 50%;
    border: 3px solid var(--gold);
    background: radial-gradient(circle at 35% 30%, var(--gold-light), var(--gold) 70%);
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    flex-shrink: 0;
    overflow: hidden;
  }
  .icon {
    width: 82%;
    height: 82%;
    object-fit: contain;
  }
  .swatch {
    width: 72%;
    height: 72%;
    border-radius: 50%;
    box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.15);
  }
  .mystery {
    font-family: var(--font-display);
    font-weight: 700;
  }
  .medallion.locked {
    filter: grayscale(1);
    background: radial-gradient(circle at 35% 30%, #ececec, #b8b8b8 70%);
    color: var(--ink-soft);
    border-color: #b8b8b8;
  }
</style>
```

- [ ] **Step 4: Use the icons wherever a reward shows**

- `web/src/screens/Cabin.svelte`: delete `FIXED_GLYPHS`, `relicGlyph()` and `glyphFor()`; the decor pin becomes `<Medallion rewardId={r.id} kind="decor" size={48} />`; the reward card's non-tint branch becomes `<Medallion rewardId={item.id} kind={section.kind} locked={!isOwned} />` (the tint branch with the tinted egg stays, inventory row 28).
- `web/src/components/ProgressionReveal.svelte`: delete `FIXED_GLYPHS`, `LIEUTENANT_GLYPHS` and `glyphFor()`; import `RELIC_OF` from `../lib/world/art` (next to `ART`); the neutralised card's medallion becomes `<Medallion rewardId={RELIC_OF[key as LieutenantKey] ?? ''} kind="relic" size={56} />`; the extra-reward card's becomes `<Medallion rewardId={r.id} kind={r.kind} />`; the won-boss line becomes `{#if bossReward}<p class="reward-line"><Medallion rewardId={bossReward.id} kind="gear" size={48} /><span>{bossReward.name}</span></p>{/if}`. Remove any import left unused (e.g. `RewardKind`).
- `web/src/screens/Lieutenant.svelte`: delete `FALLBACK_GLYPHS` and the `glyph` derived; import `RELIC_OF` from `../lib/world/art`; the neutralised banner's medallion becomes `<Medallion rewardId={RELIC_OF[lieutenantKey as LieutenantKey]} kind="relic" size={64} />`.
- `web/src/components/Scroll.svelte`: add `rewardId = null,` to the destructured props and `rewardId?: string | null;` to their type; import `Medallion from './juice/Medallion.svelte'` and `rewardKindOf` from `../lib/world/art`; the sealed reward line becomes

  ```svelte
      <p class="reward-line">
        {#if rewardId}<Medallion {rewardId} kind={rewardKindOf(rewardId)} size={36} />{/if}
        <span>Récompense de la semaine : {reward}</span>
      </p>
  ```

  and add to its `<style>`: `.reward-line { display: flex; align-items: center; gap: 8px; }`.
- `web/src/screens/Oracle.svelte`: pass `rewardId={oracle.reward_id}` to each `<Scroll ...>`.
- `web/src/screens/Boss.svelte`: import `Medallion from '../components/juice/Medallion.svelte'`; add `const bossRewardId = $derived(campStore.catalog?.boss_rewards[String(tier)] ?? null);` next to `bossRewardName()`; the reward line becomes

  ```svelte
      <p class="reward" data-testid="boss-reward">
        {#if bossRewardId}<Medallion rewardId={bossRewardId} kind="gear" size={40} />{/if}
        <span>Récompense si tu gagnes : {campStore.catalog?.quest_bonus.boss ?? 300} XP · {bossRewardName()}</span>
      </p>
  ```

  and add `.reward { display: flex; align-items: center; gap: 8px; }` to its `<style>`.

- [ ] **Step 5: e2e evidence that the icons show**

In `web/e2e/world.spec.ts`:
- step 2, right after `await expect(page.getByTestId('oracle-reward')).toContainText('Teinte Écume');`: `await expect(page.getByTestId('scroll-faible').locator('[data-reward="tint:ecume"] .swatch')).toBeVisible();`
- step 7, right after `await expect(page.getByTestId('boss-start')).toContainText('Relancer le combat');`: `await expect(page.getByTestId('boss-reward').locator('img[src="/art/icons/sandales_hermes.webp"]')).toBeVisible();`
- step 7, right after the `cabin-reward-sandales_hermes` `data-owned` assertion: `await expect(page.getByTestId('cabin-reward-sandales_hermes').locator('img[src="/art/icons/sandales_hermes.webp"]')).toBeVisible();`

- [ ] **Step 6: Verify**

Run: `scripts/npm.sh run test` — Expected: all pass.
Run: `scripts/npm.sh run check` — Expected: `0 errors and 0 warnings`.
Run: `scripts/playwright.sh world --project=desktop` — Expected: 9 passed.

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/world/art.ts web/src/lib/world/art.test.ts web/src/lib/world/dragon.ts web/src/lib/world/dragon.test.ts web/src/components/juice/Medallion.svelte web/src/screens/Cabin.svelte web/src/components/ProgressionReveal.svelte web/src/screens/Lieutenant.svelte web/src/components/Scroll.svelte web/src/screens/Oracle.svelte web/src/screens/Boss.svelte web/e2e/world.spec.ts
git commit -m "UI3a: painted icon map; reward medallions show the painted icons, tints a swatch

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/lib/world/art.ts web/src/lib/world/art.test.ts web/src/lib/world/dragon.ts web/src/lib/world/dragon.test.ts web/src/components/juice/Medallion.svelte web/src/screens/Cabin.svelte web/src/components/ProgressionReveal.svelte web/src/screens/Lieutenant.svelte web/src/components/Scroll.svelte web/src/screens/Oracle.svelte web/src/screens/Boss.svelte web/e2e/world.spec.ts
```

### Task 5: Painted avatars, one source for the lieutenant icons, the « add » icons

**Files:**
- Modify: `server/app/world/catalog.py`, `server/tests/test_world_api.py`
- Modify: `web/src/lib/world/types.ts` (drop `glyph`), `web/src/lib/levels.ts` (drop `AVATAR_GLYPHS`)
- Modify (full replacement below): `web/src/components/Avatar.svelte`
- Create: `web/src/components/LieutenantBadge.svelte`
- Modify: `web/src/screens/Dossier.svelte`, `web/src/screens/QuestBoard.svelte`, `web/src/screens/Oracle.svelte`, `web/src/components/AddMenu.svelte`, `web/src/screens/ScanText.svelte`
- Modify: `web/e2e/scenes-camp.spec.ts`, `web/e2e/world.spec.ts`

**Interfaces:**
- Consumes: Task 4 (`avatarIcon`, `lieutenantIcon`, `ADD_ICONS`, `ART.erisSmug`).
- Produces:
  - `Avatar.svelte` props unchanged (`{ avatar: Avatar | string; size?: number; ring?: boolean }`); renders `<img src="/art/icons/avatar-<key>.webp">`.
  - `LieutenantBadge.svelte` props `{ lieutenantKey: string; size?: number; dim?: boolean }`; renders `<span class="lt-badge" data-lieutenant={key}><img src="/art/icons/lt-<key>.webp"></span>` (Éris's cut-out for an unknown key).
  - `GET /api/world` lieutenants no longer carry `glyph`; `WorldCatalog['lieutenants'][number]` has no `glyph` field.

- [ ] **Step 1: Write the failing server test**

In `server/tests/test_world_api.py`, at the end of `test_world_catalog` (its JSON body is `w`), add:

```python
    # CLAUDE.md "No emoji" (UI3 Ruling A13): the lieutenants' icons are painted art on the client.
    assert all("glyph" not in lt for lt in w["lieutenants"])
```

Run: `scripts/pytest.sh tests/test_world_api.py -v`
Expected: FAIL on the new assertion.

- [ ] **Step 2: Drop the emoji field from the catalog**

In `server/app/world/catalog.py` delete the `"glyph": "…",` entry from each of the six `LIEUTENANTS` dicts (hydre, echo, chimere, protee, sirenes, lethe); nothing else changes.

Run: `scripts/pytest.sh tests/test_world_api.py -v` — Expected: PASS.

- [ ] **Step 3: Client types and avatars**

- `web/src/lib/world/types.ts`: delete the line `glyph: string;` from `WorldCatalog['lieutenants']`.
- `web/src/lib/levels.ts`: delete `AVATAR_GLYPHS` (and its comment); keep `AVATARS` and `type Avatar`.
- Replace `web/src/components/Avatar.svelte` with:

```svelte
<script lang="ts">
  // A hero's emblem: the painted avatar medallion (UI3 Ruling A13, was an emoji). `ring`: the
  // in-world look (playability #4) - the emblem sits in a bronze ring. Unknown keys show the owl.
  import { avatarIcon } from '../lib/world/art';
  import type { Avatar } from '../lib/levels';

  let { avatar, size = 48, ring = false }: { avatar: Avatar | string; size?: number; ring?: boolean } = $props();
</script>

<span class="avatar" class:ring style="width: {size}px; height: {size}px;" aria-hidden="true">
  <img src={avatarIcon(avatar)} alt="" draggable="false" />
</span>

<style>
  .avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: var(--aegean-light);
    overflow: hidden;
    flex-shrink: 0;
  }
  .avatar img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .avatar.ring {
    box-sizing: border-box;
    border: 3px solid var(--bronze-light);
    background: radial-gradient(circle at 40% 35%, #5a4630, var(--night) 75%);
    box-shadow:
      inset 0 0 0 1px var(--bronze-dark),
      0 0 0 1px var(--bronze-dark),
      0 2px 6px rgba(0, 0, 0, 0.4);
  }
</style>
```

- [ ] **Step 4: Create `web/src/components/LieutenantBadge.svelte`**

```svelte
<script lang="ts">
  // A lieutenant's painted icon in a small bronze ring: the ONE place the lieutenants' icons come
  // from (UI3 Ruling A13; was the server's emoji `glyph` + five client copies). `dim` greys a
  // lieutenant that still sleeps at the hero's level. An unknown key shows Éris herself.
  import { ART, lieutenantIcon } from '../lib/world/art';

  let { lieutenantKey, size = 40, dim = false }: { lieutenantKey: string; size?: number; dim?: boolean } = $props();

  const src = $derived(lieutenantIcon(lieutenantKey) ?? ART.erisSmug);
</script>

<span class="lt-badge" class:dim style="width:{size}px;height:{size}px" data-lieutenant={lieutenantKey} aria-hidden="true">
  <img {src} alt="" draggable="false" />
</span>

<style>
  .lt-badge {
    display: inline-flex;
    flex-shrink: 0;
    border-radius: 50%;
    overflow: hidden;
    border: 2px solid var(--bronze-light);
    background: radial-gradient(circle at 40% 35%, #f6ecd6, #d9c39a);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }
  .lt-badge img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .lt-badge.dim img {
    filter: grayscale(1);
    opacity: 0.55;
  }
</style>
```

- [ ] **Step 5: Replace every lieutenant glyph**

- `web/src/screens/Dossier.svelte`: delete `FALLBACK_GLYPHS` (+ its comment) and `glyphFor()`; import `LieutenantBadge from '../components/LieutenantBadge.svelte'`; in the locked row replace `<span class="glyph" aria-hidden="true">{glyphFor(key)}</span>` by `<LieutenantBadge lieutenantKey={key} size={40} dim />` and, in the same row, fix the hard-coded name (every sleeping lieutenant used to say it was Protée): `<span class="muted">Protée dort encore à ce niveau.</span>` → `<span class="muted">{nameFor(key)} dort encore à ce niveau.</span>`; in the open row replace the glyph span by `<LieutenantBadge lieutenantKey={key} size={40} />`; delete the `.glyph` CSS rule.
- `web/src/screens/QuestBoard.svelte`: delete `FALLBACK_GLYPHS` and `glyphFor()`; import `LieutenantBadge`; replace `<span class="glyph" aria-hidden="true">{glyphFor(key)}</span>` by `<LieutenantBadge lieutenantKey={key} size={48} />`; delete the `.glyph` CSS rule.
- `web/src/screens/Oracle.svelte`: delete `FALLBACK_GLYPHS` and `glyphFor()`; import `LieutenantBadge`; in the monster-picker chip replace `<span aria-hidden="true">{glyphFor(key)}</span>` by `<LieutenantBadge lieutenantKey={key} size={28} />`.

- [ ] **Step 6: The « add » icons**

- `web/src/components/AddMenu.svelte` (retired in Task 9, but it must not show emoji meanwhile): import `ADD_ICONS` from `../lib/world/art`; replace the three `<span class="icon" aria-hidden="true">…</span>` by `<img class="icon" src={ADD_ICONS.text} alt="" />`, `<img class="icon" src={ADD_ICONS.scan} alt="" />`, `<img class="icon" src={ADD_ICONS.alexandria} alt="" />`; its `.icon` CSS rule becomes `.icon { width: 44px; height: 44px; object-fit: contain; flex-shrink: 0; }`.
- `web/src/screens/ScanText.svelte` (inventory row 21): import `ADD_ICONS` from `../lib/world/art`; inside the « Prendre une photo » `<label class="btn btn-primary capture-label">`, before the text, add `<img class="capture-icon" src={ADD_ICONS.scan} alt="" />`; add `.capture-icon { width: 28px; height: 28px; object-fit: contain; }` to its style.

- [ ] **Step 7: e2e evidence**

- `web/e2e/scenes-camp.spec.ts`, test `HUD: laurel, dragon, sound toggle...`, after the first `hud-xp` assertion: `await expect(page.getByTestId('hud-hero').locator('img[src="/art/icons/avatar-chouette.webp"]')).toBeVisible();` (createProfileApi uses the owl).
- `web/e2e/world.spec.ts`, step 3, after the `board-challenge-echo` quest is launched: `await expect(page.getByTestId('board-challenge-echo').locator('img[src="/art/icons/lt-echo.webp"]')).toBeVisible();`

- [ ] **Step 8: Verify**

Run: `scripts/pytest.sh -q` — Expected: all pass.
Run: `scripts/npm.sh run check` — Expected: `0 errors and 0 warnings` (a leftover `.glyph` reference would fail here).
Run: `scripts/npm.sh run test` — Expected: all pass.
Run: `scripts/playwright.sh scenes-camp` and `scripts/playwright.sh world --project=desktop` — Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add server/app/world/catalog.py server/tests/test_world_api.py web/src/lib/world/types.ts web/src/lib/levels.ts web/src/components/Avatar.svelte web/src/components/LieutenantBadge.svelte web/src/screens/Dossier.svelte web/src/screens/QuestBoard.svelte web/src/screens/Oracle.svelte web/src/components/AddMenu.svelte web/src/screens/ScanText.svelte web/e2e/scenes-camp.spec.ts web/e2e/world.spec.ts
git commit -m "UI3a: painted avatars and lieutenant icons (one source, catalog glyph dropped), add icons; sleeping-lieutenant name fix

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- server/app/world/catalog.py server/tests/test_world_api.py web/src/lib/world/types.ts web/src/lib/levels.ts web/src/components/Avatar.svelte web/src/components/LieutenantBadge.svelte web/src/screens/Dossier.svelte web/src/screens/QuestBoard.svelte web/src/screens/Oracle.svelte web/src/components/AddMenu.svelte web/src/screens/ScanText.svelte web/e2e/scenes-camp.spec.ts web/e2e/world.spec.ts
```

### Task 6: One SVG icon family, the pictograph sweep and the no-emoji guard

**Files:**
- Create: `web/src/lib/ui/icons.ts`, `web/src/lib/ui/icons.test.ts`, `web/src/components/ui/Icon.svelte`, `web/src/noEmoji.test.ts`
- Modify: `web/src/components/scene/{Hud,Overlay,SceneExit,DialogueBox}.svelte`, `web/src/screens/Camp.svelte` (hero-panel medallions), `web/src/components/TopBar.svelte`
- Modify: `web/src/components/{Proofreading,Dictation,Results,Scroll,ProgressionReveal}.svelte`, `web/src/screens/{ScanText,AlexandriaWork,DragonScreen,Settings}.svelte`
- Modify: `web/src/lib/fil.ts`, `web/src/lib/fil.test.ts`, `server/app/corrupt.py` (one comment)
- Modify: `web/e2e/scan.spec.ts`

**Interfaces:**
- Consumes: Task 4 (`TOOL_ICONS`, `MARK_ICONS`).
- Produces:
  - `web/src/lib/ui/icons.ts`: `export type IconName = 'lyre' | 'lyre-muted' | 'close' | 'journal' | 'shield' | 'lamp' | 'arrow-left' | 'arrow-right' | 'check' | 'star' | 'pencil' | 'gap';` `export interface IconPath { d: string; width?: number; fill?: boolean; halo?: boolean; dash?: string }` `export const ICONS: Record<IconName, IconPath[]>` (32×32 viewBox).
  - `web/src/components/ui/Icon.svelte` props `{ name: IconName; size?: number; label?: string }` (decorative unless `label`).
  - `web/src/noEmoji.test.ts`: the guard of Ruling A13 (runs in `scripts/check.sh` through vitest).

- [ ] **Step 1: Write the failing guard and icon tests**

`web/src/noEmoji.test.ts`:

```ts
// CLAUDE.md "No emoji" (user ruling 2026-09-24), UI3 Ruling A13: nothing the player can see may
// contain an emoji, and no Svelte markup may use a pictograph character as an icon. Every hit is
// reported as `file:line: char U+XXXX`. The allow-list is empty on purpose: an entry ('path:line')
// needs a user ruling.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ALLOW = new Set<string>([]);
const EMOJI = /\p{Extended_Pictographic}|\u{FE0F}/gu;
const ICON_GLYPHS = /[←-↓✓✔✕✖★☆▢▸▶✶❓❔]/gu;

function walk(dir: string, exts: string[], out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '__pycache__') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, exts, out);
    else if (exts.some((e) => name.endsWith(e)) && !name.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

function hits(file: string, text: string, re: RegExp): string[] {
  const out: string[] = [];
  text.split('\n').forEach((line, i) => {
    const at = `${file}:${i + 1}`;
    if (ALLOW.has(at)) return;
    for (const m of line.matchAll(re)) {
      out.push(`${at}: ${m[0]} U+${m[0].codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`);
    }
  });
  return out;
}

/** Blanks <script>, <style> and HTML comments (line breaks kept) so only the markup is left. */
function markupOnly(svelte: string): string {
  const blank = (s: string) => s.replace(/[^\n]/g, ' ');
  return svelte.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, blank);
}

const PLAYER_VISIBLE = [
  ...walk('src', ['.ts', '.svelte', '.css']),
  'index.html',
  'public/manifest.json',
  ...walk('../content', ['.json']),
  ...walk('../server/app', ['.py']),
];

describe('no emoji anywhere the player can see (CLAUDE.md)', () => {
  it('scans the real trees', () => {
    expect(PLAYER_VISIBLE.length).toBeGreaterThan(100);
    expect(PLAYER_VISIBLE).toContain(join('../server/app/world', 'catalog.py'));
    expect(PLAYER_VISIBLE).toContain(join('src/lib', 'levels.ts'));
  });

  it('finds no emoji in the web sources, the content files or the server', () => {
    const found = PLAYER_VISIBLE.flatMap((f) => hits(f, readFileSync(f, 'utf-8'), EMOJI));
    expect(found).toEqual([]);
  });

  it('uses no pictograph character as an icon in Svelte markup', () => {
    const found = PLAYER_VISIBLE.filter((f) => f.endsWith('.svelte')).flatMap((f) =>
      hits(f, markupOnly(readFileSync(f, 'utf-8')), ICON_GLYPHS),
    );
    expect(found).toEqual([]);
  });
});
```

`web/src/lib/ui/icons.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ICONS } from './icons';

describe('SVG icon family (UI3 Ruling A13)', () => {
  it('draws every icon with at least one well-formed path', () => {
    for (const [name, paths] of Object.entries(ICONS)) {
      expect(paths.length, name).toBeGreaterThan(0);
      for (const p of paths) {
        expect(p.d, name).toMatch(/^M/);
        expect(p.d, name).not.toMatch(/NaN|undefined/);
      }
    }
  });

  it('keeps the UI1 drawings: the muted lyre is the lyre struck through', () => {
    expect(ICONS['lyre-muted'].slice(0, ICONS.lyre.length)).toEqual(ICONS.lyre);
    expect(ICONS['lyre-muted'].some((p) => p.halo)).toBe(true);
  });
});
```

Run: `scripts/npm.sh run test -- src/noEmoji.test.ts src/lib/ui/icons.test.ts`
Expected: FAIL: `icons` module missing, and the guard lists every remaining site (e.g. `src/components/TopBar.svelte:33: 📊 U+1F4CA`, `src/components/Proofreading.svelte:369: 🛡 U+1F6E1`, `src/lib/fil.ts:140: ↔ U+2194`, `../server/app/corrupt.py:302: ↔ U+2194`, markup `←`, `→`, `✓`, `★`, `▢`, `✶`, `▸`). Keep that list: it is this task's checklist.

- [ ] **Step 2: The icon path table**

`web/src/lib/ui/icons.ts`:

```ts
// One family of inline line icons (UI3 Ruling A13), 32×32 viewBox, drawn in currentColor: the
// lyre, the seal's cross, the open journal and the shield are the UI1 drawings (Hud, Overlay, the
// hero-panel medallions), now shared; the rest replaces the pictograph characters (← → ✓ ★ ▢ ✏).
export type IconName =
  | 'lyre'
  | 'lyre-muted'
  | 'close'
  | 'journal'
  | 'shield'
  | 'lamp'
  | 'arrow-left'
  | 'arrow-right'
  | 'check'
  | 'star'
  | 'pencil'
  | 'gap';

export interface IconPath {
  d: string;
  /** Stroke width in viewBox units (default 2.4). */
  width?: number;
  /** Filled with currentColor instead of stroked. */
  fill?: boolean;
  /** Stroked in the night colour, under the next path, for contrast (the mute slash). */
  halo?: boolean;
  dash?: string;
}

const LYRE: IconPath[] = [
  { d: 'M11 27C6 22 4 14 7 8c1-2 3-3 4-2M21 27c5-5 7-13 4-19-1-2-3-3-4-2' },
  { d: 'M7 10h18M10 27h12' },
  { d: 'M13 10v17M16 10v17M19 10v17', width: 1.3 },
];

export const ICONS: Record<IconName, IconPath[]> = {
  lyre: LYRE,
  'lyre-muted': [...LYRE, { d: 'M5 27L27 5', width: 5, halo: true }, { d: 'M5 27L27 5' }],
  close: [{ d: 'M9 9L23 23M23 9L9 23', width: 3 }],
  journal: [
    { d: 'M7 6h8c1 0 1 1 1 2v18c0-1-1-2-2-2H7z M25 6h-8c-1 0-1 1-1 2v18c0-1 1-2 2-2h7z', width: 2.2 },
    { d: 'M10 11h3M10 15h3M19 11h3M19 15h3', width: 1.6 },
  ],
  shield: [{ d: 'M16 4l10 4v7c0 7-5 11-10 13C11 26 6 22 6 15V8z' }, { d: 'M16 9v14M11 15h10', width: 2 }],
  lamp: [
    { d: 'M5 21c4 3 14 3 18 0l4-4h-5c-3-2-10-2-13 0z', width: 2.2 },
    { d: 'M16 15c-2-3 1-5 0-9 3 3 4 6 0 9z', width: 1.8 },
    { d: 'M12 25h8', width: 2.2 },
  ],
  'arrow-left': [{ d: 'M19 7L10 16l9 9', width: 3 }],
  'arrow-right': [{ d: 'M13 7l9 9-9 9', width: 3 }],
  check: [{ d: 'M7 17l6 6L25 9', width: 3 }],
  star: [{ d: 'M16 4l3.5 7.6 8.3.9-6.2 5.6 1.8 8.2L16 22.1l-7.4 4.2 1.8-8.2-6.2-5.6 8.3-.9z', fill: true }],
  pencil: [{ d: 'M7 25l2-6L21 7l4 4-12 12z', width: 2.2 }, { d: 'M18 10l4 4', width: 2 }],
  gap: [{ d: 'M7 9h18v14H7z', width: 2, dash: '3 3' }],
};
```

`web/src/components/ui/Icon.svelte`:

```svelte
<script lang="ts">
  // An inline line icon of the shared family (lib/ui/icons.ts). Decorative (aria-hidden) unless it
  // gets a `label`; the control around it carries the words.
  import { ICONS, type IconName } from '../../lib/ui/icons';

  let { name, size = 24, label }: { name: IconName; size?: number; label?: string } = $props();
</script>

<svg
  class="icon-svg"
  viewBox="0 0 32 32"
  width={size}
  height={size}
  role={label ? 'img' : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : 'true'}
  focusable="false"
>
  {#each ICONS[name] as p, i (i)}
    <path
      d={p.d}
      fill={p.fill ? 'currentColor' : 'none'}
      stroke={p.fill ? 'none' : p.halo ? 'var(--night)' : 'currentColor'}
      stroke-width={p.width ?? 2.4}
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-dasharray={p.dash}
    />
  {/each}
</svg>

<style>
  .icon-svg {
    display: inline-block;
    flex-shrink: 0;
    vertical-align: middle;
  }
</style>
```

Run: `scripts/npm.sh run test -- src/lib/ui/icons.test.ts` — Expected: PASS.

- [ ] **Step 3: Reuse the family where UI1 drew inline SVGs**

Every file below imports `Icon from '<relative>/ui/Icon.svelte'`. In this step and the next three, delete any CSS rule whose element is gone (e.g. the HUD's `.lyre`): svelte-check reports an unused selector as a warning, and warnings must stay at 0.
- `Hud.svelte`: replace the whole `<svg class="lyre" ...>...</svg>` by `<Icon name={soundStore.muted ? 'lyre-muted' : 'lyre'} size={28} />`.
- `Overlay.svelte`: replace the seal's `<svg ...>...</svg>` by `<Icon name="close" size={22} />`.
- `SceneExit.svelte`: replace its `<svg ...>...</svg>` by `<Icon name="arrow-left" size={22} />`.
- `Camp.svelte` hero panel: the three `<svg viewBox="0 0 32 32" width="34" height="34">...</svg>` become `<Icon name="lyre" size={34} />` (Réglages), `<Icon name="journal" size={34} />` (Ton journal), `<Icon name="shield" size={34} />` (Changer de héros).
- `DialogueBox.svelte`: the `.more` caret `▸` becomes `<Icon name="arrow-right" size={28} />` inside the same `<span class="more" ...>`.

- [ ] **Step 4: TopBar (inventory rows 8–12)**

In `web/src/components/TopBar.svelte` (import `Icon from './ui/Icon.svelte'`) replace the five icon spans:
- `<span class="icon" aria-hidden="true">←</span>` → `<span class="icon"><Icon name="arrow-left" size={20} /></span>`
- `<span class="icon">📊</span>` → `<span class="icon"><Icon name="journal" size={22} /></span>`
- `<span class="icon">⚙️</span>` → `<span class="icon"><Icon name="lamp" size={22} /></span>`
- `<span class="icon">{soundStore.muted ? '🔇' : '🔊'}</span>` → `<span class="icon"><Icon name={soundStore.muted ? 'lyre-muted' : 'lyre'} size={22} /></span>`
- `<span class="icon">🔄</span>` → `<span class="icon"><Icon name="shield" size={22} /></span>`

and change the `.icon` rule to `.icon { display: inline-flex; color: var(--bronze); }`. Below 900 px the labels hide, so give each of the four links and the sound button an `aria-label` equal to its label text (`Retour au camp`, `Progrès`, `Réglages`, `Son`, `Changer de héros`).

- [ ] **Step 5: Proofreading tools, arrows and checks (rows 38–45)**

In `web/src/components/Proofreading.svelte` import `Icon from './ui/Icon.svelte'` and `TOOL_ICONS` from `../lib/world/art`, then:
- pass chips: `{i < play.passIndex ? '✓ ' : ''}{ARGUS_LABELS[pass].title}` → `{#if i < play.passIndex}<Icon name="check" size={16} />{/if}{ARGUS_LABELS[pass].title}`
- `Passe suivante →` → `Passe suivante <Icon name="arrow-right" size={18} />`
- in `<div class="passes" ...>`, first child: `<img class="tool-icon argus-mark" src={TOOL_ICONS.argus} alt="" />`
- `🛡️ Bouclier de Persée` → `<img class="tool-icon" src={TOOL_ICONS.persee} alt="" />Bouclier de Persée`
- `🦉 Chouette d'Athéna ({hintsLeft})` → `<img class="tool-icon" src={TOOL_ICONS.athena} alt="" />Chouette d'Athéna ({hintsLeft})`
- `🧵 Fil d'Ariane` → `<img class="tool-icon" src={TOOL_ICONS.ariane} alt="" />Fil d'Ariane`
- `✏️ Modifier tout le texte` → `<Icon name="pencil" size={20} />Modifier tout le texte`
- `← Phrase précédente` → `<Icon name="arrow-left" size={18} /> Phrase précédente`; `Phrase suivante →` → `Phrase suivante <Icon name="arrow-right" size={18} />`

and add to its style: `.tool-icon { width: 26px; height: 26px; object-fit: contain; margin-right: 6px; } .argus-mark { width: 34px; height: 34px; }`.

- [ ] **Step 6: The remaining markup pictographs (rows 43, 47, 48, 50, 52–54 and the unlisted ones)**

- `Dictation.svelte` (import `Icon from './ui/Icon.svelte'`): `← Quitter` → `<Icon name="arrow-left" size={18} /> Quitter`.
- `Results.svelte` (import `Icon`): the missing-word marker's `>▢</button` → `><Icon name="gap" size={18} /></button` (its `aria-label="Mot oublié"` stays); `déjoué ✓` → `déjoué <Icon name="check" size={14} />`.
- `ScanText.svelte` (import `Icon from '../components/ui/Icon.svelte'`): `{viewed.has(w) ? '✓ ' : ''}{w}` → `{#if viewed.has(w)}<Icon name="check" size={16} />{/if}{w}`.
- `AlexandriaWork.svelte` (import `Icon`): the stars span becomes

  ```svelte
              <span class="stars" role="img" aria-label="Richesse en accords : {starsFor(chunk.score)} sur 5"
                >{#each Array.from({ length: starsFor(chunk.score) }, (_, i) => i) as i (i)}<Icon name="star" size={16} />{/each}</span
              >
  ```

- `Scroll.svelte` (import `MARK_ICONS` from `../lib/world/art`): `<span class="wax-seal">✶</span>` → `<span class="wax-seal"><img src={MARK_ICONS.oracleSeal} alt="" /></span>`; add `.wax-seal img { width: 100%; height: 100%; object-fit: contain; }`.
- `DragonScreen.svelte` (import `MARK_ICONS`): `<span class="lock" aria-hidden="true">🔒</span>` → `<span class="lock" aria-hidden="true"><img src={MARK_ICONS.lock} alt="" /></span>`; add `.lock img { width: 26px; height: 26px; object-fit: contain; }`.
- `ProgressionReveal.svelte`: `<span class="leaf">🌿</span>` → `<span class="leaf filled"></span>`; replace its `.laurels` rule by the camp's leaf look:

  ```css
  .laurels {
    display: inline-flex;
    gap: 4px;
  }
  .leaf {
    width: 12px;
    height: 20px;
    box-sizing: border-box;
    border-radius: 100% 0;
    border: 1px solid var(--bronze-dark);
    background: linear-gradient(135deg, var(--gold-light), var(--gold));
    transform: rotate(-30deg);
  }
  ```

- `Settings.svelte`: `Sur iPad : Réglages → Accessibilité → Contenu énoncé → Voix → Français.` → `Sur iPad : ouvre Réglages, puis Accessibilité, puis Contenu énoncé, puis Voix, puis Français.`

- [ ] **Step 7: Words instead of « ↔ »**

`web/src/lib/fil.ts`: the message template `` `${prefix}Le fil est tendu : « ${verb} » ↔ « ${group} » (${num}). Vérifie la terminaison du verbe.` `` becomes `` `${prefix}Le fil est tendu entre « ${verb} » et « ${group} » (${num}). Vérifie la terminaison du verbe.` ``. In `web/src/lib/fil.test.ts` update the two expectations accordingly: `'Le fil est tendu entre « dansent » et « Les fées » (pluriel). Vérifie la terminaison du verbe.'` and `'Le fil est tendu entre « danse » et « Les fée » (pluriel). Vérifie la terminaison du verbe.'` (a wording change only; the e2e `toContainText('Le fil est tendu')` still holds).
`server/app/corrupt.py:302`: the comment `# « leurs bras » ↔ « leur bras »` becomes `# « leurs bras » vs « leur bras »`.

- [ ] **Step 8: e2e selector that read the check mark**

`web/e2e/scan.spec.ts`: `await expect(chips.first()).toContainText('✓');` → `await expect(chips.first()).toHaveAttribute('aria-pressed', 'true');`

- [ ] **Step 9: Verify**

Run: `scripts/npm.sh run test` — Expected: all pass, including the three guard tests (`found` is `[]`).
Run: `scripts/npm.sh run check` — Expected: `0 errors and 0 warnings`.
Run: `scripts/pytest.sh -q` — Expected: all pass.
Run: `scripts/playwright.sh --project=desktop` — Expected: every functional spec passes (happy-path, grimoire, scan, alexandria, world, profiles, scenes-*).

- [ ] **Step 10: Commit**

```bash
git add web/src/lib/ui/icons.ts web/src/lib/ui/icons.test.ts web/src/components/ui/Icon.svelte web/src/noEmoji.test.ts web/src/components/scene/Hud.svelte web/src/components/scene/Overlay.svelte web/src/components/scene/SceneExit.svelte web/src/components/scene/DialogueBox.svelte web/src/screens/Camp.svelte web/src/components/TopBar.svelte web/src/components/Proofreading.svelte web/src/components/Dictation.svelte web/src/components/Results.svelte web/src/components/Scroll.svelte web/src/components/ProgressionReveal.svelte web/src/screens/ScanText.svelte web/src/screens/AlexandriaWork.svelte web/src/screens/DragonScreen.svelte web/src/screens/Settings.svelte web/src/lib/fil.ts web/src/lib/fil.test.ts server/app/corrupt.py web/e2e/scan.spec.ts
git commit -m "UI3a: one SVG icon family, painted tool icons, no pictograph in markup, no-emoji guard test

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/lib/ui/icons.ts web/src/lib/ui/icons.test.ts web/src/components/ui/Icon.svelte web/src/noEmoji.test.ts web/src/components/scene/Hud.svelte web/src/components/scene/Overlay.svelte web/src/components/scene/SceneExit.svelte web/src/components/scene/DialogueBox.svelte web/src/screens/Camp.svelte web/src/components/TopBar.svelte web/src/components/Proofreading.svelte web/src/components/Dictation.svelte web/src/components/Results.svelte web/src/components/Scroll.svelte web/src/components/ProgressionReveal.svelte web/src/screens/ScanText.svelte web/src/screens/AlexandriaWork.svelte web/src/screens/DragonScreen.svelte web/src/screens/Settings.svelte web/src/lib/fil.ts web/src/lib/fil.test.ts server/app/corrupt.py web/e2e/scan.spec.ts
```

### Task 7: Device-tilt parallax

**Files:**
- Create: `web/src/lib/scene/tilt.ts`, `web/src/lib/scene/tilt.test.ts`, `web/src/lib/scene/tiltState.svelte.ts`
- Modify: `web/src/components/scene/SceneStage.svelte`

**Interfaces:**
- Consumes: `SceneRuntime` (`nx`, `ny`, `reduced`, `debug`) from `runtime.svelte.ts`.
- Produces:
  - `web/src/lib/scene/tilt.ts`: `export const TILT_RANGE = 15;` `export interface TiltSample { beta: number; gamma: number }` `export function screenTilt(s: TiltSample, angle: number): { x: number; y: number }` `export function tiltToNorm(s: TiltSample, base: TiltSample, angle: number, range?: number): { nx: number; ny: number }`.
  - `web/src/lib/scene/tiltState.svelte.ts`: `export type TiltPermission = 'unknown' | 'granted' | 'denied' | 'unavailable';` `export const tilt: { permission: TiltPermission }` (`$state`, session-wide) and `export function requestTilt(): Promise<TiltPermission>` (must be called inside a user gesture; Task 8 calls it from the title's « Entrer »).
  - `SceneStage` root gets `data-tilt="on" | "off"`.

- [ ] **Step 1: Write the failing test**

`web/src/lib/scene/tilt.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { TILT_RANGE, screenTilt, tiltToNorm } from './tilt';

const rest = { beta: 40, gamma: 5 };

describe('device tilt (UI3 Ruling A5)', () => {
  it('maps the device axes onto the screen axes for each orientation', () => {
    const s = { beta: 10, gamma: 3 };
    expect(screenTilt(s, 0)).toEqual({ x: 3, y: 10 });
    expect(screenTilt(s, 90)).toEqual({ x: 10, y: -3 });
    expect(screenTilt(s, 180)).toEqual({ x: -3, y: -10 });
    expect(screenTilt(s, 270)).toEqual({ x: -10, y: 3 });
    expect(screenTilt(s, -90)).toEqual({ x: -10, y: 3 });
  });

  it('measures from the resting pose and reaches full deflection at the range', () => {
    expect(tiltToNorm(rest, rest, 90)).toEqual({ nx: 0, ny: 0 });
    expect(tiltToNorm({ beta: 40 + TILT_RANGE, gamma: 5 }, rest, 90)).toEqual({ nx: 1, ny: 0 });
    expect(tiltToNorm({ beta: 40 - TILT_RANGE / 2, gamma: 5 }, rest, 90)).toEqual({ nx: -0.5, ny: 0 });
    expect(tiltToNorm({ beta: 40, gamma: 5 + TILT_RANGE }, rest, 90)).toEqual({ nx: 0, ny: -1 });
  });

  it('clamps to [-1, 1]', () => {
    expect(tiltToNorm({ beta: 120, gamma: -80 }, rest, 0)).toEqual({ nx: -1, ny: 1 });
  });
});
```

Run: `scripts/npm.sh run test -- src/lib/scene/tilt.test.ts` — Expected: FAIL (`Cannot find module './tilt'`).

- [ ] **Step 2: Write `tilt.ts`**

```ts
// Device-tilt parallax (scenes UI spec §4 "on pointer drag / device tilt where permitted", UI3
// Ruling A5). `deviceorientation` gives beta (front-back) and gamma (left-right) in the device's
// portrait frame; the screen's axes depend on how the iPad is held (screen.orientation.angle).
// The first reading is the resting pose; ±TILT_RANGE degrees from it is full deflection.
export const TILT_RANGE = 15;

export interface TiltSample {
  beta: number;
  gamma: number;
}

/** Tilt along the screen's own x (right side down = +) and y (top edge away = +) axes. */
export function screenTilt(s: TiltSample, angle: number): { x: number; y: number } {
  const a = ((Math.round(angle) % 360) + 360) % 360;
  if (a === 90) return { x: s.beta, y: -s.gamma + 0 };
  if (a === 180) return { x: -s.gamma + 0, y: -s.beta + 0 };
  if (a === 270) return { x: -s.beta + 0, y: s.gamma };
  return { x: s.gamma, y: s.beta };
}

export function tiltToNorm(s: TiltSample, base: TiltSample, angle: number, range = TILT_RANGE): { nx: number; ny: number } {
  const now = screenTilt(s, angle);
  const rest = screenTilt(base, angle);
  const clamp = (v: number) => Math.max(-1, Math.min(1, v)) + 0;
  return { nx: clamp((now.x - rest.x) / range), ny: clamp((now.y - rest.y) / range) };
}
```

(`+ 0` turns a `-0` into `0`, so `toEqual` compares cleanly.)

Run: `scripts/npm.sh run test -- src/lib/scene/tilt.test.ts` — Expected: PASS.

- [ ] **Step 3: Write `tiltState.svelte.ts`**

```ts
// Whether device tilt may drive the parallax, for the whole session (UI3 Ruling A5). iOS asks for
// permission (DeviceOrientationEvent.requestPermission), which only works inside a user gesture:
// the title's « Entrer » tap calls requestTilt() synchronously. Elsewhere there is no permission
// API and tilt is simply on (a device without a gyroscope never fires the event).
export type TiltPermission = 'unknown' | 'granted' | 'denied' | 'unavailable';

export const tilt = $state<{ permission: TiltPermission }>({ permission: 'unknown' });

interface PermissionApi {
  requestPermission?: () => Promise<'granted' | 'denied' | 'default'>;
}

export function requestTilt(): Promise<TiltPermission> {
  if (typeof window === 'undefined' || typeof window.DeviceOrientationEvent === 'undefined') {
    tilt.permission = 'unavailable';
    return Promise.resolve(tilt.permission);
  }
  const api = window.DeviceOrientationEvent as unknown as PermissionApi;
  if (typeof api.requestPermission !== 'function') {
    tilt.permission = 'granted';
    return Promise.resolve(tilt.permission);
  }
  return api
    .requestPermission()
    .then((answer) => (tilt.permission = answer === 'granted' ? 'granted' : 'denied'))
    .catch(() => (tilt.permission = 'denied'));
}
```

- [ ] **Step 4: Feed the tilt into the stage**

In `web/src/components/scene/SceneStage.svelte` add the imports

```ts
  import { tilt } from '../../lib/scene/tiltState.svelte';
  import { tiltToNorm, type TiltSample } from '../../lib/scene/tilt';
```

and after the pointer handlers:

```ts
  // UI3 Ruling A5: device tilt drives the same nx/ny as the pointer, once « Entrer » was granted,
  // never under reduced motion or ?debug. The first reading (and the first after a rotation) is the
  // resting pose.
  const tiltOn = $derived(tilt.permission === 'granted' && !runtime.reduced && !runtime.debug);
  $effect(() => {
    if (!tiltOn) return;
    let base: TiltSample | null = null;
    const angle = () => (typeof screen !== 'undefined' && screen.orientation ? screen.orientation.angle : 0);
    const onTilt = (e: Event) => {
      const { beta, gamma } = e as DeviceOrientationEvent;
      if (beta === null || gamma === null || beta === undefined || gamma === undefined) return;
      const sample = { beta, gamma };
      if (!base) {
        base = sample;
        return;
      }
      const n = tiltToNorm(sample, base, angle());
      runtime.nx = n.nx;
      runtime.ny = n.ny;
    };
    const onTurn = () => {
      base = null;
    };
    window.addEventListener('deviceorientation', onTilt);
    screen.orientation?.addEventListener('change', onTurn);
    return () => {
      window.removeEventListener('deviceorientation', onTilt);
      screen.orientation?.removeEventListener('change', onTurn);
      resetPointer();
    };
  });
```

and on the `<main class="scene-stage" ...>` element add `data-tilt={tiltOn ? 'on' : 'off'}`.

- [ ] **Step 5: Verify**

Run: `scripts/npm.sh run test` — Expected: all pass.
Run: `scripts/npm.sh run check` — Expected: `0 errors and 0 warnings`.
Run: `scripts/playwright.sh scenes-camp` — Expected: pass (tilt is `unknown` without « Entrer », `data-tilt="off"`, nothing changes). The tilt e2e lives in Task 8 with the gate that grants it.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/scene/tilt.ts web/src/lib/scene/tilt.test.ts web/src/lib/scene/tiltState.svelte.ts web/src/components/scene/SceneStage.svelte
git commit -m "UI3a: device-tilt parallax behind a session-wide permission

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/lib/scene/tilt.ts web/src/lib/scene/tilt.test.ts web/src/lib/scene/tiltState.svelte.ts web/src/components/scene/SceneStage.svelte
```

### Task 8: The title scene (gates, shields, naming ritual, PIN seal, « Entrer » grants tilt)

**Files:**
- Create: `web/src/lib/world/scenes/title.shapes.ts`, `web/src/lib/world/scenes/title.ts`, `web/src/lib/world/scenes/title.test.ts`, `web/src/lib/scene/titleGate.svelte.ts`, `web/src/screens/Title.svelte`
- Move: `web/src/screens/ProfileCreate.svelte` → `web/src/components/places/title/HeroForm.svelte` (`git mv`)
- Delete: `web/src/screens/ProfilePicker.svelte` (`git rm`; its features move into `Title.svelte`)
- Modify (full replacement below): `web/src/components/PinGate.svelte`
- Modify: `web/src/lib/world/scenes/index.ts`, `web/src/App.svelte`
- Create: `web/e2e/scenes-title.spec.ts`
- Modify: `web/e2e/helpers.ts`, `web/e2e/profiles.spec.ts`, `web/e2e/happy-path.spec.ts`, `web/e2e/world.spec.ts`, `web/playwright.playability.config.ts` (comment)
- Delete: `web/e2e/playability.spec.ts`, `web/e2e/playability-sp2.spec.ts`, `web/e2e/playability-sp3.spec.ts`, `web/e2e/playability-ui1.spec.ts` (Ruling A11)

**Interfaces:**
- Consumes: Task 1 (`placeFor`, `PanelId`, `openPanel`, `closePanel`), Task 2 (`Hotspot` `onPress`/`onActivate`, `Overlay`, `expectScene`, `measureBoxes`), Task 4 (`ART.scenes.titleGates`, `MARK_ICONS.lock`), Task 7 (`requestTilt`, `data-tilt`); `api.profiles.list()`, `Avatar`.
- Produces:
  - `title.ts`: `export const TITLE_HOTSPOTS: HotspotDef[]` (one: `gate`, label « Entrer », `target: null`), `export const TITLE_SCENE: SceneDef` (id `title`, plaque « La Discorde »), `export const SHIELD_SLOTS: { x: number; y: number }[]` (6 slots, art %), `export type ShieldItem = { kind: 'hero'; profile: Profile } | { kind: 'all'; count: number } | { kind: 'new' }`, `export function titleShields(profiles: Profile[]): ShieldItem[]`.
  - `titleGate.svelte.ts`: `export const titleGate: { entered: boolean }` (`$state`, once per page load).
  - `Title.svelte` props `{ panel: PanelId | null }`; test ids `scene-title`, `title-gate`, `title-shields`, `title-hero-<id>`, `title-all`, `title-new`, `overlay-hero-new`, `overlay-heroes`.
  - `PinGate.svelte`: test id `pin-gate`; labels unchanged.
  - `web/e2e/helpers.ts`: `export async function enterTitle(page)`, `export async function newHero(page, name: string, level?: string, pin?: string)`, `export async function pickHero(page, name: string)`.

- [ ] **Step 1: Write the failing scene-data test**

`web/src/lib/world/scenes/title.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { validateScene } from '../../scene/validate';
import type { Profile } from '../../types';
import { SHIELD_SLOTS, TITLE_HOTSPOTS, TITLE_SCENE, titleShields, type ShieldItem } from './title';

const hero = (id: number) => ({ id, name: `H${id}`, avatar: 'chouette', level: '10H' }) as Profile;
const ids = (list: ShieldItem[]) => list.map((s) => (s.kind === 'hero' ? s.profile.id : s.kind));

describe('title scene (UI3 Ruling A4)', () => {
  it('is a valid scene whose only place is the gate, handled by the screen', () => {
    expect(validateScene(TITLE_SCENE)).toEqual([]);
    expect(TITLE_HOTSPOTS.map((h) => [h.id, h.label, h.target])).toEqual([['gate', 'Entrer', null]]);
    expect(TITLE_SCENE).toMatchObject({ id: 'title', title: 'La Discorde', background: '/art/scenes/title_gates.webp' });
  });

  it('hangs six shields on the rails, inside the safe zone and clear of the gate and torches', () => {
    expect(SHIELD_SLOTS).toHaveLength(6);
    for (const s of SHIELD_SLOTS) {
      expect(s.x - 3.25, `${s.x}`).toBeGreaterThanOrEqual(12.5);
      expect(s.x + 3.25, `${s.x}`).toBeLessThanOrEqual(87.5);
      expect(s.x < 36 || s.x > 63, `${s.x} clear of the pillars and torches`).toBe(true);
      expect(s.y).toBeGreaterThanOrEqual(52);
    }
  });

  it('shows the newest heroes first and always ends on « Nouveau héros »', () => {
    expect(ids(titleShields([]))).toEqual(['new']);
    expect(ids(titleShields([hero(1), hero(3), hero(2)]))).toEqual([3, 2, 1, 'new']);
    expect(ids(titleShields([1, 2, 3, 4, 5].map(hero)))).toEqual([5, 4, 3, 2, 1, 'new']);
    const six = titleShields([1, 2, 3, 4, 5, 6].map(hero));
    expect(ids(six)).toEqual([6, 5, 4, 3, 'all', 'new']);
    expect(six[4]).toEqual({ kind: 'all', count: 6 });
  });
});
```

Run: `scripts/npm.sh run test -- src/lib/world/scenes/title.test.ts` — Expected: FAIL (`Cannot find module './title'`).

- [ ] **Step 2: Scene data**

`web/src/lib/world/scenes/title.shapes.ts`:

```ts
// Hotspot geometry of the title scene (title_gates.webp), art % of the 16:9 frame, authored by
// hand from docs/art/scenes.md (gate doors x 43-56, y 45-79) and checked with `?debug`.
import type { ShapeMap } from '../../scene/types';

export const TITLE_SHAPES = {
  gate: { kind: 'polygon', points: [[43, 50], [45.5, 46.5], [49.5, 44.5], [53.5, 46.5], [56, 50], [56, 79], [43, 79]] },
} satisfies ShapeMap;
```

`web/src/lib/world/scenes/title.ts`:

```ts
// The title scene (scenes UI spec §3 "Title scene", UI3 Ruling A4): the camp gates at dusk with
// Éris's shadow in the sky. « Entrer » opens the gate onto the heroes' painted shields.
import { ART } from '../art';
import type { Profile } from '../../types';
import { IDLE_HOTSPOT, type HotspotDef, type HotspotState, type SceneDef } from '../../scene/types';
import { TITLE_SHAPES } from './title.shapes';

const st = (p: Partial<HotspotState> = {}): HotspotState => ({ ...IDLE_HOTSPOT, ...p });

export const TITLE_HOTSPOTS: HotspotDef[] = [
  { id: 'gate', label: 'Entrer', target: null, shape: TITLE_SHAPES.gate, labelPos: 'above', leader: true, state: () => st({ isNew: true }) },
];

export const TITLE_SCENE: SceneDef = {
  id: 'title',
  title: 'La Discorde',
  background: ART.scenes.titleGates,
  layers: [],
  hotspots: TITLE_HOTSPOTS,
  ambience: { particles: 'embers', music: null },
  narrator: { enter: 'title.enter', firstVisit: null },
  preload: [ART.scenes.camp],
};

/** Where the painted shields hang (art %): x = centre, y = top edge. Three per bronze rail
 *  (docs/art/scenes.md: rails x 16-36 and 63-85, hooks at y 53-56), clear of the pillars and the
 *  torches (x 36-63) and inside the 4:3 safe zone. */
export const SHIELD_SLOTS: { x: number; y: number }[] = [
  { x: 19.5, y: 55 },
  { x: 26.5, y: 55 },
  { x: 33, y: 55 },
  { x: 69.5, y: 55 },
  { x: 76.5, y: 55 },
  { x: 83.5, y: 55 },
];

export type ShieldItem = { kind: 'hero'; profile: Profile } | { kind: 'all'; count: number } | { kind: 'new' };

/** Newest heroes first; the last slot is always « Nouveau héros »; with more heroes than slots,
 *  the one before it opens « Tous les héros ». */
export function titleShields(profiles: Profile[]): ShieldItem[] {
  const newest = [...profiles].sort((a, b) => b.id - a.id);
  const room = SHIELD_SLOTS.length - 1;
  const heroes = (list: Profile[]): ShieldItem[] => list.map((profile) => ({ kind: 'hero', profile }));
  if (newest.length <= room) return [...heroes(newest), { kind: 'new' }];
  return [...heroes(newest.slice(0, room - 1)), { kind: 'all', count: newest.length }, { kind: 'new' }];
}
```

In `web/src/lib/world/scenes/index.ts` import `TITLE_SCENE` from `./title` and make `SCENES = [CAMP_SCENE, TITLE_SCENE]` (the budget test then checks `title_gates.webp` and its preload).

`web/src/lib/scene/titleGate.svelte.ts`:

```ts
// Whether « Entrer » was tapped during this page load (UI3 Ruling A4): the gate stays open when
// the player comes back to the title (« Changer de héros »); a reload closes it again.
export const titleGate = $state({ entered: false });
```

Run: `scripts/npm.sh run test -- src/lib/world/scenes/` — Expected: PASS (title + budget + camp).

- [ ] **Step 3: The naming ritual panel**

```bash
mkdir -p web/src/components/places/title
git mv web/src/screens/ProfileCreate.svelte web/src/components/places/title/HeroForm.svelte
sed -i "s#'\.\./components/#'../../#g; s#'\.\./lib/#'../../../lib/#g" web/src/components/places/title/HeroForm.svelte
```

Then in `HeroForm.svelte`:
- import `replaceRoute` instead of `navigate` from `../../../lib/router.svelte`, and in `submit()` replace `navigate(href('camp', ...))` by `replaceRoute(href('camp', { profileId: String(profile.id) }))` (Ruling A2: Back from the camp never reopens an emptied form);
- replace `<div class="screen">` + `<h1>Nouveau héros</h1>` by `<div class="hero-form">` (the overlay carries the title « Nouveau héros »);
- `<Avatar avatar={a} size={48} />` → `<Avatar avatar={a} size={56} ring />`;
- in its style, `.avatar-choice` border becomes `2px solid var(--parchment-edge)` and `.avatar-choice.selected` becomes `border-color: var(--bronze); background: rgba(200, 148, 80, 0.2);`.

Everything else (labels « Ton prénom », « Ton avatar », « Ton niveau », « Un code à quatre chiffres (facultatif) », hint, errors, « Rejoindre le camp ») stays.

- [ ] **Step 4: Write `web/src/screens/Title.svelte`**

```svelte
<script lang="ts">
  // The title scene (scenes UI spec §3, UI3 Ruling A4): the camp gates at dusk, Éris's shadow in
  // the sky. « Entrer » (once per page load) unlocks audio and asks for tilt inside the tap, then
  // opens the gate onto the heroes' painted shields. A new hero is named in an overlay on
  // #/profiles/new; every hero is listed on #/?panel=tous. Replaces ProfilePicker/ProfileCreate.
  import { fade } from 'svelte/transition';
  import SceneStage from '../components/scene/SceneStage.svelte';
  import Hotspot from '../components/scene/Hotspot.svelte';
  import Overlay from '../components/scene/Overlay.svelte';
  import Avatar from '../components/Avatar.svelte';
  import HeroForm from '../components/places/title/HeroForm.svelte';
  import { SHIELD_SLOTS, TITLE_HOTSPOTS, TITLE_SCENE, titleShields } from '../lib/world/scenes/title';
  import { titleGate } from '../lib/scene/titleGate.svelte';
  import { requestTilt } from '../lib/scene/tiltState.svelte';
  import { closePanel, openPanel } from '../lib/scene/panelNav';
  import { playSfx, unlockAudio } from '../lib/juice/sfx';
  import { api, ApiError } from '../lib/api';
  import { href } from '../lib/routes';
  import { navigate } from '../lib/router.svelte';
  import type { PanelId } from '../lib/world/places';
  import type { Profile } from '../lib/types';

  let { panel }: { panel: PanelId | null } = $props();

  let profiles = $state<Profile[]>([]);
  let loading = $state(true);
  let error = $state('');

  async function load() {
    loading = true;
    error = '';
    try {
      profiles = await api.profiles.list();
    } catch (e) {
      error = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
    } finally {
      loading = false;
    }
  }
  load();

  const gate = TITLE_HOTSPOTS[0];
  const shields = $derived(titleShields(profiles));
  const byName = $derived([...profiles].sort((a, b) => a.name.localeCompare(b.name, 'fr')));

  // Inside the tap itself (iOS grants audio and the tilt permission only in a user gesture).
  function gesture() {
    unlockAudio();
    void requestTilt();
  }

  function enter() {
    playSfx('chime');
    titleGate.entered = true;
  }

  function pick(p: Profile) {
    unlockAudio();
    playSfx('tap');
    navigate(href('camp', { profileId: String(p.id) }));
  }

  function openNew() {
    unlockAudio();
    playSfx('tap');
    openPanel(href('profile-new'));
  }

  function openAll() {
    unlockAudio();
    playSfx('tap');
    openPanel(href('profiles', {}, { panel: 'tous' }));
  }

  const closeToTitle = () => closePanel(href('profiles'));
</script>

<SceneStage scene={TITLE_SCENE}>
  {#if !titleGate.entered}
    <Hotspot def={gate} status={gate.state({ camp: null, catalog: null })} sceneId="title" onPress={gesture} onActivate={enter} />
  {:else}
    <div class="shields" role="group" aria-label="Choisis ton héros" data-testid="title-shields" in:fade={{ duration: 300 }}>
      {#each shields as s, i (s.kind === 'hero' ? s.profile.id : s.kind)}
        {@const slot = SHIELD_SLOTS[i]}
        {#if s.kind === 'hero'}
          <button
            type="button"
            class="shield"
            data-testid="title-hero-{s.profile.id}"
            style="left:{slot.x}%;top:{slot.y}%"
            aria-label="{s.profile.name}, {s.profile.level}"
            onclick={() => pick(s.profile)}
          >
            <span class="shield-face"><Avatar avatar={s.profile.avatar} size={44} ring /></span>
            <span class="shield-plaque">
              <span class="shield-name">{s.profile.name}</span>
              <span class="shield-level">{s.profile.level}</span>
            </span>
          </button>
        {:else if s.kind === 'all'}
          <button type="button" class="shield" data-testid="title-all" style="left:{slot.x}%;top:{slot.y}%" aria-label="Tous les héros ({s.count})" onclick={openAll}>
            <span class="shield-face"><span class="shield-count">{s.count}</span></span>
            <span class="shield-plaque"><span class="shield-name wrap">Tous les héros</span></span>
          </button>
        {:else}
          <button type="button" class="shield" data-testid="title-new" style="left:{slot.x}%;top:{slot.y}%" aria-label="Nouveau héros" onclick={openNew}>
            <span class="shield-face">
              <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true"><path d="M16 7v18M7 16h18" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" /></svg>
            </span>
            <span class="shield-plaque"><span class="shield-name wrap">Nouveau héros</span></span>
          </button>
        {/if}
      {/each}
    </div>
    <p class="kit-banner title-hint">Choisis ton héros</p>
    {#if loading}
      <p class="kit-banner title-note">Les Muses cherchent les héros…</p>
    {:else if error}
      <p class="kit-banner title-note">Impossible de charger les héros : {error}</p>
    {:else if profiles.length === 0}
      <p class="kit-banner title-note">Aucun héros pour l'instant. Crée le tien !</p>
    {/if}
  {/if}
</SceneStage>

{#if panel === 'nouveau'}
  <Overlay variant="scroll" title="Nouveau héros" testId="overlay-hero-new" onClose={closeToTitle} returnFocus={'[data-testid="title-new"]'}>
    <HeroForm />
  </Overlay>
{:else if panel === 'tous'}
  <Overlay variant="scroll" title="Tous les héros" testId="overlay-heroes" onClose={closeToTitle} returnFocus={'[data-testid="title-all"]'}>
    <ul class="hero-list">
      {#each byName as p (p.id)}
        <li>
          <button type="button" class="hero-row" aria-label="{p.name}, {p.level}" onclick={() => pick(p)}>
            <Avatar avatar={p.avatar} size={44} ring />
            <span class="hero-row-name">{p.name}</span>
            <span class="hero-row-level">{p.level}</span>
          </button>
        </li>
      {/each}
    </ul>
  </Overlay>
{/if}

<style>
  .shields {
    position: absolute;
    inset: 0;
    z-index: 3;
    pointer-events: none;
  }
  .shield {
    position: absolute;
    transform: translateX(-50%);
    width: 6.5%;
    min-width: 64px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--bronze-ink);
    cursor: pointer;
    pointer-events: auto;
  }
  /* A painted bronze shield hanging from its hook, the hero's emblem at its boss. */
  .shield-face {
    width: 78%;
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    border: 3px solid var(--bronze-dark);
    background: radial-gradient(circle at 38% 32%, var(--bronze-light), var(--bronze) 58%, var(--bronze-dark));
    box-shadow:
      inset 0 0 0 4px rgba(255, 240, 200, 0.25),
      0 4px 10px rgba(0, 0, 0, 0.45);
  }
  .shield:hover .shield-face {
    filter: brightness(1.1);
  }
  .shield:focus-visible {
    outline: none;
  }
  .shield:focus-visible .shield-face {
    outline: 3px solid var(--gold-light);
    outline-offset: 2px;
  }
  .shield-plaque {
    max-width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2px 6px;
    border-radius: 6px;
    border: 1px solid var(--bronze-light);
    background: rgba(21, 18, 26, 0.72);
  }
  .shield-name {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--font-body);
    font-weight: 700;
    font-size: 14px;
  }
  .shield-name.wrap {
    white-space: normal;
    text-align: center;
    line-height: 1.15;
  }
  .shield-level {
    font-size: 12px;
  }
  .shield-count {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 22px;
  }
  .title-hint,
  .title-note {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    z-index: 3;
    margin: 0;
    white-space: nowrap;
  }
  .title-hint {
    bottom: 12%;
  }
  .title-note {
    bottom: 5%;
  }
  .hero-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 10px;
  }
  .hero-row {
    width: 100%;
    min-height: 56px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 10px;
    border: 1px solid var(--parchment-edge);
    border-radius: 10px;
    background: rgba(255, 250, 238, 0.55);
    color: var(--ink);
    text-align: left;
    cursor: pointer;
  }
  .hero-row-name {
    flex: 1;
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .hero-row-level {
    font-size: 14px;
    color: var(--form-ink-soft);
  }
</style>
```

- [ ] **Step 5: The sealed PIN parchment**

Replace `web/src/components/PinGate.svelte` with (logic unchanged):

```svelte
<script lang="ts">
  // The hero's code (legacy logic unchanged), staged as a sealed parchment over the blurred camp
  // gates (UI3 Ruling A4; the painted padlock is icon inventory row 20).
  import { api, ApiError } from '../lib/api';
  import { markUnlocked } from '../lib/profileStore.svelte';
  import { href } from '../lib/routes';
  import { ART, MARK_ICONS } from '../lib/world/art';
  import type { Profile } from '../lib/types';

  let { profile, onUnlocked }: { profile: Profile; onUnlocked: () => void } = $props();

  let pin = $state('');
  let error = $state('');
  let checking = $state(false);

  async function submit(value: string) {
    checking = true;
    error = '';
    try {
      const res = await api.profiles.verifyPin(profile.id, value);
      if (res.ok) {
        markUnlocked(profile.id);
        onUnlocked();
      } else {
        error = "Ce n'est pas le bon code. Réessaie.";
        pin = '';
      }
    } catch (e) {
      error = e instanceof ApiError ? e.detail : 'Une erreur est survenue. Réessaie.';
      pin = '';
    } finally {
      checking = false;
    }
  }

  function onInput(event: Event) {
    const value = (event.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 4);
    pin = value;
    if (value.length === 4 && !checking) submit(value);
  }
</script>

<div class="pin-gate" data-testid="pin-gate">
  <img class="pin-backdrop" src={ART.scenes.titleGates} alt="" aria-hidden="true" />
  <div class="pin-seal kit-parchment kit-form">
    <img class="pin-lock" src={MARK_ICONS.lock} alt="" />
    <h1 class="kit-plaque pin-title">Code de {profile.name}</h1>
    <label class="visually-hidden" for="pin-input">Code de {profile.name}</label>
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
    {#if error}
      <p class="orange" role="alert">{error}</p>
    {/if}
    <a class="kit-bronze" href={href('profiles')}>Changer de héros</a>
  </div>
</div>

<style>
  .pin-gate {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: var(--night);
    overflow: hidden;
  }
  .pin-backdrop {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: blur(8px) brightness(0.45);
    transform: scale(1.06);
  }
  .pin-seal {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    width: min(420px, 100%);
    padding: 28px 24px;
    text-align: center;
  }
  .pin-lock {
    width: 64px;
    height: 64px;
    object-fit: contain;
  }
  .pin-title {
    font-size: 18px;
  }
  .pin-input {
    width: 180px;
    text-align: center;
    font-size: 32px;
    letter-spacing: 0.4em;
    font-family: var(--font-display);
  }
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
```

- [ ] **Step 6: Route the title**

`git rm web/src/screens/ProfilePicker.svelte`. In `web/src/App.svelte`:
- remove the `ProfilePicker` and `ProfileCreate` imports; add `import Title from './screens/Title.svelte';` and `import { placeFor } from './lib/world/places';`;
- add `const view = $derived(placeFor(route));` under `const route = ...`;
- replace

```svelte
{#if route.name === 'profiles'}
  <ProfilePicker />
{:else if route.name === 'profile-new'}
  <ProfileCreate />
{:else if profileId !== null}
```

with

```svelte
{#if view?.place === 'title'}
  <!-- UI3 Ruling A1: one Title instance for #/, #/?panel=tous and #/profiles/new, so opening an
       overlay never replays the scene's entry. -->
  <Title panel={view.panel} />
{:else if profileId !== null}
```

- [ ] **Step 7: e2e helpers and the migrated specs**

Append to `web/e2e/helpers.ts`:

```ts
// UI3 title (Ruling A4): taps « Entrer » if the gate is still closed, then waits for the shields.
export async function enterTitle(page: Page) {
  await expectScene(page, 'title');
  const gate = page.getByTestId('title-gate');
  if (await gate.count()) await gate.click();
  await expect(page.getByTestId('title-shields')).toBeVisible();
}

// Names a new hero through the ritual overlay and lands on the camp.
export async function newHero(page: Page, name: string, level = '10H', pin?: string) {
  await page.goto('/');
  await enterTitle(page);
  await page.getByTestId('title-new').click();
  await expect(page.getByTestId('overlay-hero-new')).toBeVisible();
  await page.getByLabel('Ton prénom').fill(name);
  await page.getByLabel('Ton niveau').selectOption(level);
  if (pin) await page.getByLabel(/Un code à quatre chiffres/).fill(pin);
  await page.getByRole('button', { name: 'Rejoindre le camp' }).click();
  await expectCamp(page);
}

// Picks a hero on the title: its shield when it hangs on a rail, else through « Tous les héros »
// (the shared e2e database holds far more heroes than the six slots).
export async function pickHero(page: Page, name: string) {
  await enterTitle(page);
  const shield = page.getByTestId('title-shields').getByRole('button', { name: new RegExp(name) });
  if (await shield.count()) {
    await shield.first().click();
    return;
  }
  await page.getByTestId('title-all').click();
  await page.getByTestId('overlay-heroes').getByRole('button', { name: new RegExp(name) }).click();
}
```

and make `createProfile` start with `await newHero(page, name, level);` instead of its five `page.goto('/')` … `expectCamp(page)` lines (keep the rest).

- `web/e2e/profiles.spec.ts`: import `newHero, pickHero`; in the first test replace the five lines from `await page.goto('/');` to `await expectCamp(page);` by `await newHero(page, unique(), '10H');`; in the second test replace `await page.getByRole('button', { name: new RegExp(name) }).click();` by `await pickHero(page, name);`.
- `web/e2e/happy-path.spec.ts`: import `newHero`; replace the « Profile » block's lines from `await page.goto('/');` to `await expectCamp(page);` by `await newHero(page, name, '10H');`.
- `web/e2e/world.spec.ts`: import `enterTitle`; in step 1 add `await enterTitle(page);` right after `await page.goto('/');`.
- `git rm web/e2e/playability.spec.ts web/e2e/playability-sp2.spec.ts web/e2e/playability-sp3.spec.ts web/e2e/playability-ui1.spec.ts` (Ruling A11) and change the header comment of `web/playwright.playability.config.ts` to: `// Playability walks (scenes spec §10): one long test per iPad orientation, screenshots into docs/reviews/<milestone>/ (playability-ui3.spec.ts). Run with scripts/playwright.sh --config playwright.playability.config.ts playability-ui3`.

- [ ] **Step 8: Write the title e2e (both projects)**

`web/e2e/scenes-title.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test';
import { createProfileApi, enterTitle, expectCamp, expectInSafeZone, expectScene, measureBoxes, redScan } from './helpers';

// UI3a Task 8 (scenes spec §3 Title, §4 tilt, §10): the camp gates at dusk. « Entrer » unlocks
// audio and tilt and shows the heroes' shields; a new hero is named in an overlay on
// #/profiles/new; a protected hero asks for the code on a sealed parchment. desktop + ipad.

const hero = (project: string) => `Porte-${project}-${Date.now() % 1e6}`;

async function stubTilt(page: Page, answer: 'granted' | 'denied') {
  // The iOS permission API, so the test exercises the real request path in WebKit.
  await page.addInitScript((a) => {
    class FakeOrientationEvent extends Event {
      static requestPermission() {
        return Promise.resolve(a);
      }
    }
    (window as unknown as { DeviceOrientationEvent: unknown }).DeviceOrientationEvent = FakeOrientationEvent;
  }, answer);
}

async function tiltBy(page: Page, beta: number, gamma: number) {
  await page.evaluate(([b, g]) => {
    const e = new Event('deviceorientation');
    Object.defineProperties(e, { beta: { value: b }, gamma: { value: g } });
    window.dispatchEvent(e);
  }, [beta, gamma]);
}

test('« Entrer » opens the gate onto the shields, once per page load', async ({ page }, testInfo) => {
  await page.goto('/');
  await expectScene(page, 'title');
  await expect(page.locator('h1')).toContainText('La Discorde');
  const gate = page.getByTestId('title-gate');
  await expect(gate).toHaveAccessibleName(/Entrer/);
  await expectInSafeZone(page, 'title', ['title-gate']);
  await expect(page.getByTestId('title-shields')).toHaveCount(0);
  if (testInfo.project.name === 'ipad') await gate.tap();
  else await gate.click();
  await expect(page.getByTestId('title-shields')).toBeVisible();
  await expect(gate).toHaveCount(0);
  await expect(page.getByTestId('title-new')).toHaveAccessibleName('Nouveau héros');
  // Same document, same page load: the gate stays open.
  await page.goto('/#/profiles/new');
  await page.goto('/#/');
  await expect(page.getByTestId('title-shields')).toBeVisible();
});

test('the naming ritual is an overlay with its own route; Back and the seal close it', async ({ page }, testInfo) => {
  const name = hero(testInfo.project.name);
  await page.goto('/');
  await enterTitle(page);
  await page.getByTestId('title-new').click();
  await expect(page).toHaveURL(/#\/profiles\/new$/);
  const ritual = page.getByTestId('overlay-hero-new');
  await expect(ritual).toBeVisible();
  await expect(page.getByTestId('scene-title')).toHaveAttribute('inert', '');
  await page.goBack();
  await expect(ritual).toHaveCount(0);
  await expect(page.getByTestId('title-shields')).toBeVisible();

  await page.goto('/#/profiles/new');
  await expect(ritual).toBeVisible();
  await page.getByTestId('overlay-close').click();
  await expect(ritual).toHaveCount(0);
  await expect(page).toHaveURL(/#\/$/);

  await page.goto('/#/profiles/new');
  await page.getByLabel('Ton prénom').fill(name);
  await ritual.locator('label.avatar-choice', { hasText: 'Trident' }).click();
  await page.getByLabel('Ton niveau').selectOption('9H');
  await expect(page.getByLabel(/Un code à quatre chiffres/)).toBeVisible();
  expect(await redScan(page)).toEqual([]);
  await page.getByRole('button', { name: 'Rejoindre le camp' }).click();
  await expectCamp(page);
  await expect(page.getByTestId('hud-hero').locator('img[src="/art/icons/avatar-trident.webp"]')).toBeVisible();
  // The form replaced its own entry: Back lands on the title, not on an empty ritual.
  await page.goBack();
  await expect(page).not.toHaveURL(/profiles\/new/);
});

test('six slots: newest heroes, « Tous les héros » when there are more, « Nouveau héros » last', async ({ page, request }, testInfo) => {
  const names: string[] = [];
  for (let i = 0; i < 6; i++) {
    const n = `${hero(testInfo.project.name)}-${i}`;
    names.push(n);
    await createProfileApi(request, n);
  }
  await page.goto('/');
  await enterTitle(page);
  const shields = page.getByTestId('title-shields').locator('button.shield');
  await expect(shields).toHaveCount(6);
  await expect(shields.nth(5)).toHaveAccessibleName('Nouveau héros');
  await expect(page.getByTestId('title-all')).toBeVisible();
  const sel: Record<string, string> = { art: '[data-testid="scene-title"] .art' };
  for (let i = 0; i < 6; i++) sel[`s${i}`] = `[data-testid="title-shields"] button.shield:nth-child(${i + 1})`;
  const b = await measureBoxes(page, sel);
  const art = b.art!;
  for (let i = 0; i < 6; i++) {
    const s = b[`s${i}`]!;
    expect(s.x, `shield ${i} left`).toBeGreaterThanOrEqual(art.x + art.width * 0.125 - 0.5);
    expect(s.x + s.width, `shield ${i} right`).toBeLessThanOrEqual(art.x + art.width * 0.875 + 0.5);
    expect(Math.min(s.width, s.height), `shield ${i} touch target`).toBeGreaterThanOrEqual(48);
  }
  await page.getByTestId('title-all').click();
  await expect(page).toHaveURL(/#\/\?panel=tous$/);
  await page.getByTestId('overlay-heroes').getByRole('button', { name: new RegExp(names[0]) }).click();
  await expectCamp(page);
});

test('a protected hero asks for the code on a sealed parchment', async ({ page, request }, testInfo) => {
  const res = await request.post('/api/profiles', { data: { name: hero(testInfo.project.name), avatar: 'lyre', level: '10H', pin: '1234' } });
  expect(res.ok()).toBeTruthy();
  const id = (await res.json()).id as number;
  await page.goto(`/#/p/${id}/camp`);
  await expect(page.getByTestId('pin-gate')).toBeVisible();
  expect(await redScan(page)).toEqual([]);
  await page.getByLabel(/Code de/).fill('0000');
  await expect(page.getByText("Ce n'est pas le bon code")).toBeVisible();
  await page.getByLabel(/Code de/).fill('1234');
  await expectCamp(page);
});

test('« Entrer » turns on tilt parallax when the device allows it', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, hero(testInfo.project.name));
  await stubTilt(page, 'granted');
  await page.goto('/');
  await enterTitle(page);
  await expect(page.getByTestId('scene-title')).toHaveAttribute('data-tilt', 'on');
  await page.goto(`/#/p/${id}/camp`); // same document: the permission holds for the session
  await expectCamp(page);
  const dragon = page.getByTestId('camp-dragon-layer');
  await expect(dragon).toBeVisible();
  await tiltBy(page, 40, 0); // resting pose
  await tiltBy(page, 50, 10);
  await expect(dragon).not.toHaveAttribute('data-offset', '0,0');
});

test('no tilt when it is refused', async ({ page }) => {
  await stubTilt(page, 'denied');
  await page.goto('/');
  await enterTitle(page);
  await expect(page.getByTestId('scene-title')).toHaveAttribute('data-tilt', 'off');
});

test('no tilt under reduced motion even when granted', async ({ page }) => {
  await stubTilt(page, 'granted');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await enterTitle(page);
  await expect(page.getByTestId('scene-title')).toHaveAttribute('data-tilt', 'off');
});

test('title: no red, rotate screen in portrait, ?debug outlines the gate', async ({ page }) => {
  await page.goto('/?debug#/');
  await expectScene(page, 'title');
  await expect(page.getByTestId('hotspot-debug').locator('svg.outline')).toHaveCount(1);
  expect(await redScan(page)).toEqual([]);
  await page.setViewportSize({ width: 820, height: 1180 });
  await expect(page.getByTestId('rotate-screen')).toBeVisible();
});
```

- [ ] **Step 9: Verify**

Run: `scripts/npm.sh run test` and `scripts/npm.sh run check` — Expected: all pass, `0 errors and 0 warnings`.
Run: `scripts/playwright.sh scenes-title` — Expected: 8 tests × 2 projects pass.
Run: `scripts/playwright.sh --project=desktop` — Expected: every spec passes (profiles, happy-path, world, smoke still reach the camp through the title).

- [ ] **Step 10: Commit**

```bash
git add web/src/lib/world/scenes/title.shapes.ts web/src/lib/world/scenes/title.ts web/src/lib/world/scenes/title.test.ts web/src/lib/world/scenes/index.ts web/src/lib/scene/titleGate.svelte.ts web/src/screens/Title.svelte web/src/components/places/title/HeroForm.svelte web/src/components/PinGate.svelte web/src/App.svelte web/e2e/scenes-title.spec.ts web/e2e/helpers.ts web/e2e/profiles.spec.ts web/e2e/happy-path.spec.ts web/e2e/world.spec.ts web/playwright.playability.config.ts
git commit -m "UI3a: the title scene - gates, painted shields, naming ritual overlay, sealed PIN, Entrer grants tilt; old walks retired

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/lib/world/scenes/title.shapes.ts web/src/lib/world/scenes/title.ts web/src/lib/world/scenes/title.test.ts web/src/lib/world/scenes/index.ts web/src/lib/scene/titleGate.svelte.ts web/src/screens/Title.svelte web/src/screens/ProfileCreate.svelte web/src/components/places/title/HeroForm.svelte web/src/screens/ProfilePicker.svelte web/src/components/PinGate.svelte web/src/App.svelte web/e2e/scenes-title.spec.ts web/e2e/helpers.ts web/e2e/profiles.spec.ts web/e2e/happy-path.spec.ts web/e2e/world.spec.ts web/playwright.playability.config.ts web/e2e/playability.spec.ts web/e2e/playability-sp2.spec.ts web/e2e/playability-sp3.spec.ts web/e2e/playability-ui1.spec.ts
```

### Task 9: The library tent and its shelves

**Files:**
- Create: `web/src/lib/world/scenes/library.shapes.ts`, `web/src/lib/world/scenes/library.ts`, `web/src/lib/world/scenes/library.test.ts`, `web/src/screens/LibraryTent.svelte`
- Move: `web/src/screens/Library.svelte` → `web/src/components/places/library/ShelvesPanel.svelte` (`git mv`)
- Delete: `web/src/components/AddMenu.svelte` (Ruling A16)
- Modify: `web/src/lib/world/scenes/index.ts`, `web/src/lib/world/scenes/camp.ts`, `web/src/lib/world/scenes/camp.test.ts`, `web/src/App.svelte`
- Create: `web/e2e/scenes-library.spec.ts`
- Modify: `web/e2e/helpers.ts`, `web/e2e/scenes-camp.spec.ts`, `web/e2e/scenes-debug.spec.ts`, `web/e2e/profiles.spec.ts`, `web/e2e/happy-path.spec.ts`, `web/e2e/scan.spec.ts`, `web/e2e/alexandria.spec.ts`

**Interfaces:**
- Consumes: Task 1 (`placeFor` → `{ place: 'library', panel }`, `sceneHref`), Task 2 (`PlaceScene`, `Hotspot`, `DialogueBox`, `Overlay size`, `hotspotHref`, `openPanel`, `closePanel`, `shouldGreetKey`/`markGreetedKey`, e2e helpers), Task 3 (`ART.scenes.libraryTent`, `ART.characters.owl`), Task 4 (`ADD_ICONS`).
- Produces:
  - `library.ts`: `export const LIBRARY_HOTSPOTS: HotspotDef[]` (ids `shelves` → `library`, `desk` → `text-new`, `lens` → `text-scan`, `portal` → `alexandria`), `export const LIBRARY_SCENE: SceneDef` (id `library`, plaque « La tente des parchemins »), `export const OWL_LAYER: SceneLayerDef`, `export function owlGreeting(): DialogueLine[]`.
  - `LibraryTent.svelte` props `{ profile: Profile; panel: PanelId | null; params: Record<string, string> }`; test ids `scene-library`, `library-shelves|desk|lens|portal`, `library-owl`, `overlay-shelves` (Tasks 10–11 add `overlay-desk`, `overlay-lens`, `overlay-portal`, `overlay-portal-work`).
  - `ShelvesPanel.svelte` props `{ profile: Profile }` (the old Library list: `text-card`, `chip-prophecy`, headings unchanged).
  - `web/e2e/helpers.ts`: `export async function openShelves(page)` (from the library scene, taps the shelves and waits for « Les Parchemins »).
  - The camp's `parchemins` place now targets `library-tent`.

- [ ] **Step 1: Write the failing scene-data test**

`web/src/lib/world/scenes/library.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { validateScene } from '../../scene/validate';
import type { CampResponse } from '../types';
import { LIBRARY_HOTSPOTS, LIBRARY_SCENE, OWL_LAYER, owlGreeting } from './library';

const state = (id: string, camp: Partial<CampResponse> | null) =>
  LIBRARY_HOTSPOTS.find((h) => h.id === id)!.state({ camp: camp as CampResponse | null, catalog: null });

describe('library tent (UI3 Ruling A1, A16)', () => {
  it('is a valid scene with the plaque echoing the hub label', () => {
    expect(validateScene(LIBRARY_SCENE)).toEqual([]);
    expect(LIBRARY_SCENE).toMatchObject({ id: 'library', title: 'La tente des parchemins', background: '/art/scenes/library_tent.webp' });
  });

  it('routes its four objects to the legacy routes, pinned to their landmarks', () => {
    expect(LIBRARY_HOTSPOTS.map((h) => [h.id, h.target])).toEqual([
      ['shelves', 'library'],
      ['desk', 'text-new'],
      ['lens', 'text-scan'],
      ['portal', 'alexandria'],
    ]);
    for (const h of LIBRARY_HOTSPOTS) expect(h.leader, h.id).toBe(true);
    expect(LIBRARY_HOTSPOTS.slice(1).map((h) => h.icon)).toEqual([
      '/art/icons/add-text.webp',
      '/art/icons/add-scan.webp',
      '/art/icons/add-alexandria.webp',
    ]);
  });

  it('keeps the old « add » menu captions on the three ways to bring a text in', () => {
    expect(['desk', 'lens', 'portal'].map((id) => state(id, null).caption)).toEqual([
      'Taper ou coller un texte',
      'Scanner une feuille',
      'Des textes classiques',
    ]);
  });

  it('points a new hero at the shelves', () => {
    expect(state('shelves', { xp: { total: 0 } } as Partial<CampResponse>)).toMatchObject({ isNew: true, caption: 'Choisis un texte à défendre' });
    expect(state('shelves', { xp: { total: 40 } } as Partial<CampResponse>).isNew).toBe(false);
  });

  it('seats the owl on the side table and lets it greet with one static line', () => {
    expect(OWL_LAYER).toMatchObject({ src: '/art/characters/owl_cut.webp', x: 80, y: 58, depth: 1 });
    expect(owlGreeting()).toEqual([
      expect.objectContaining({ speaker: 'owl', name: "La chouette d'Athéna", portrait: '/art/characters/owl_cut.webp' }),
    ]);
  });
});
```

Run: `scripts/npm.sh run test -- src/lib/world/scenes/library.test.ts` — Expected: FAIL (`Cannot find module './library'`).

- [ ] **Step 2: Scene data**

`web/src/lib/world/scenes/library.shapes.ts`:

```ts
// Hotspot geometry of the library tent (library_tent.webp), art % of the 16:9 frame, authored by
// hand from docs/art/scenes.md and checked with `?debug`. The desk stops at x 46.5 so it never
// overlaps the bronze lens on its stand (x 47-58). Four objects share ~60 % of the width, so the
// plaques are short (« Le pupitre »...) and staggered: shelves and desk above, lens and portal below.
import type { ShapeMap } from '../../scene/types';

export const LIBRARY_SHAPES = {
  shelves: { kind: 'polygon', points: [[17, 19], [32, 19], [32, 74], [17, 74]] },
  desk: { kind: 'polygon', points: [[34, 45], [41, 40], [46.5, 43], [46.5, 71], [34, 71]] },
  lens: { kind: 'ellipse', cx: 52.5, cy: 49.5, rx: 5.5, ry: 16.5 },
  portal: { kind: 'polygon', points: [[61, 64], [61, 31], [64, 25], [68.5, 22], [73, 25], [76, 31], [76, 64]] },
} satisfies ShapeMap;
```

`web/src/lib/world/scenes/library.ts`:

```ts
// The library tent (scenes UI spec §3 "Library scene"): shelves = her texts, the scribe's desk =
// write or paste a text, the bronze lens = scan a sheet, the portal = Alexandria. Each object opens
// its legacy route as an overlay (UI3 Ruling A1); the three ways in replace the old add menu (A16).
import { ADD_ICONS, ART } from '../art';
import { IDLE_HOTSPOT, type DialogueLine, type HotspotDef, type HotspotState, type SceneDef, type SceneLayerDef } from '../../scene/types';
import { LIBRARY_SHAPES } from './library.shapes';

const st = (p: Partial<HotspotState> = {}): HotspotState => ({ ...IDLE_HOTSPOT, ...p });

export const LIBRARY_HOTSPOTS: HotspotDef[] = [
  {
    id: 'shelves',
    label: 'Tes parchemins',
    target: 'library',
    shape: LIBRARY_SHAPES.shelves,
    labelPos: 'above',
    leader: true,
    state: ({ camp }) => (camp !== null && camp.xp.total === 0 ? st({ isNew: true, caption: 'Choisis un texte à défendre' }) : st()),
  },
  {
    id: 'desk',
    label: 'Le pupitre',
    target: 'text-new',
    icon: ADD_ICONS.text,
    shape: LIBRARY_SHAPES.desk,
    labelPos: 'above',
    leader: true,
    state: () => st({ caption: 'Taper ou coller un texte' }),
  },
  {
    id: 'lens',
    label: 'La lentille',
    target: 'text-scan',
    icon: ADD_ICONS.scan,
    shape: LIBRARY_SHAPES.lens,
    labelPos: 'below',
    leader: true,
    state: () => st({ caption: 'Scanner une feuille' }),
  },
  {
    id: 'portal',
    label: 'Le portail',
    target: 'alexandria',
    icon: ADD_ICONS.alexandria,
    shape: LIBRARY_SHAPES.portal,
    labelPos: 'below',
    leader: true,
    state: () => st({ caption: 'Des textes classiques' }),
  },
];

/** Athena's owl perched on the right-hand side table (docs/art/scenes.md: ≈ (80, 45), 14 % of the
 *  height; feet on the table top at y 58). Decorative: it speaks through the DialogueBox. */
export const OWL_LAYER: SceneLayerDef = {
  id: 'owl',
  src: ART.characters.owl,
  alt: '',
  x: 80,
  y: 58,
  scale: 8,
  depth: 1,
  idle: 'breathe',
};

export const LIBRARY_SCENE: SceneDef = {
  id: 'library',
  title: 'La tente des parchemins',
  background: ART.scenes.libraryTent,
  layers: [OWL_LAYER],
  hotspots: LIBRARY_HOTSPOTS,
  ambience: { particles: 'dust', music: null },
  narrator: { enter: 'library.enter', firstVisit: 'library.first' },
  preload: [],
};

/** UI3 Ruling A9: the owl's static line (dialogue content files are UI5). */
export function owlGreeting(): DialogueLine[] {
  return [
    {
      speaker: 'owl',
      name: "La chouette d'Athéna",
      portrait: ART.characters.owl,
      text: 'Hou ! Tes parchemins dorment sur les étagères. Le pupitre, la lentille et le portail en apportent de nouveaux.',
    },
  ];
}
```

In `web/src/lib/world/scenes/index.ts` add `LIBRARY_SCENE` to `SCENES`.

Run: `scripts/npm.sh run test -- src/lib/world/scenes/` — Expected: PASS.

Note: the SceneStage renders `scene.layers` itself, so the owl needs no markup; its test id comes from Step 4.

- [ ] **Step 3: The shelves panel (Ruling A3, A16)**

```bash
mkdir -p web/src/components/places/library
git mv web/src/screens/Library.svelte web/src/components/places/library/ShelvesPanel.svelte
sed -i "s#'\.\./components/#'../../#g; s#'\.\./lib/#'../../../lib/#g" web/src/components/places/library/ShelvesPanel.svelte
git rm web/src/components/AddMenu.svelte
```

Then in `ShelvesPanel.svelte`:
- delete the `TopBar` and `AddMenu` imports, `let menuOpen = $state(false);`, the `<TopBar {profile} title="Les Parchemins" />` line, the whole `<button ... data-testid="btn-add-text" ...>+ Ajouter un texte</button>` block and the `<AddMenu profileId={profile.id} bind:open={menuOpen} />` line;
- replace `<div class="screen library-screen">` by `<div class="panel-shelves">`;
- in `<style>` delete the `.screen.library-screen {...}` and `.fab {...}` rules (and their comment).

Everything else (subtitle, filters, sections « Prophéties de l'Oracle » / « À ton niveau (X) » / « Autres parchemins », `text-card`, chips, history line, loading/error) stays.

- [ ] **Step 4: Write `web/src/screens/LibraryTent.svelte`**

```svelte
<script lang="ts">
  // The library tent (scenes UI spec §3): the shelves hold her texts, the desk, the lens and the
  // portal bring new ones in. Every object opens its legacy route as an overlay on this scene (UI3
  // Ruling A1): #/p/:id/parchemins = the shelves. Athena's owl greets once per page load (A9).
  import PlaceScene from '../components/scene/PlaceScene.svelte';
  import Hotspot from '../components/scene/Hotspot.svelte';
  import DialogueBox from '../components/scene/DialogueBox.svelte';
  import Overlay from '../components/scene/Overlay.svelte';
  import ShelvesPanel from '../components/places/library/ShelvesPanel.svelte';
  import { LIBRARY_SCENE, owlGreeting } from '../lib/world/scenes/library';
  import { closePanel, hotspotHref, openPanel } from '../lib/scene/panelNav';
  import { markGreetedKey, shouldGreetKey } from '../lib/scene/greeting';
  import { sceneHref, type PanelId } from '../lib/world/places';
  import { playSfx, unlockAudio } from '../lib/juice/sfx';
  import type { DialogueLine, HotspotDef } from '../lib/scene/types';
  import type { Profile } from '../lib/types';

  let { profile, panel, params }: { profile: Profile; panel: PanelId | null; params: Record<string, string> } = $props();

  // Final review M11: the stage owns ?debug; no greeting while it is on.
  let debug = $state(false);
  let greeting = $state<DialogueLine[] | null>(null);
  $effect(() => {
    const key = `library:${profile.id}`;
    if (debug || !shouldGreetKey(key)) return;
    markGreetedKey(key);
    greeting = owlGreeting();
  });

  function activate(def: HotspotDef) {
    const to = hotspotHref(def, profile.id);
    if (!to) return;
    unlockAudio();
    playSfx('tap');
    openPanel(to);
  }

  const close = () => closePanel(sceneHref('library', profile.id));
</script>

<PlaceScene {profile} scene={LIBRARY_SCENE} bind:debug>
  {#snippet children(ctx)}
    {#each LIBRARY_SCENE.hotspots as def (def.id)}
      <Hotspot {def} status={def.state(ctx)} sceneId="library" onActivate={activate} />
    {/each}
    <span class="owl-anchor" data-testid="library-owl" aria-hidden="true"></span>
    {#if greeting}
      <DialogueBox lines={greeting} onDone={() => (greeting = null)} />
    {/if}
  {/snippet}
</PlaceScene>

{#if panel === 'etageres'}
  <Overlay variant="scroll" size="wide" title="Les Parchemins" testId="overlay-shelves" onClose={close} returnFocus={'[data-testid="library-shelves"]'}>
    <ShelvesPanel {profile} />
  </Overlay>
{/if}

<style>
  /* Marks where the owl perches (OWL_LAYER), for tests and the ?debug screenshots. */
  .owl-anchor {
    position: absolute;
    left: 76%;
    top: 44%;
    width: 8%;
    height: 14%;
    pointer-events: none;
  }
</style>
```

(`params` is read by the portal overlays of Task 11.)

- [ ] **Step 5: Route the library, retarget the camp's tent**

In `web/src/App.svelte` import `LibraryTent from './screens/LibraryTent.svelte'` (drop the `Library` import) and replace the `{:else if route.name === 'library'} <Library profile={gateProfile} />` branch with a place branch placed **after** the still-legacy `text-new`, `text-scan`, `alexandria` and `alexandria-work` branches (Tasks 10 and 11 remove those):

```svelte
      {:else if view?.place === 'library'}
        <LibraryTent profile={gateProfile} panel={view.panel} params={route.params} />
```

In `web/src/lib/world/scenes/camp.ts` the `parchemins` hotspot gets `target: 'library-tent'`; in `camp.test.ts` the expected map's `parchemins: 'library'` becomes `parchemins: 'library-tent'`.

- [ ] **Step 6: e2e helpers and migrations**

Append to `web/e2e/helpers.ts`:

```ts
// UI3 library tent: from the scene, open the shelves overlay (the old Library screen).
export async function openShelves(page: Page) {
  await expectScene(page, 'library');
  await page.getByTestId('library-shelves').click();
  await expect(page.getByRole('heading', { name: 'Les Parchemins' })).toBeVisible();
}
```

and in `createProfile` replace `await expect(page.getByRole('heading', { name: 'Les Parchemins' })).toBeVisible();` by `await openShelves(page);`.

Migrations (only these lines change):
- `profiles.spec.ts` test 1: after `await page.getByTestId('camp-parchemins').click();` replace the heading assertion by `await openShelves(page);`.
- `happy-path.spec.ts`: same after `camp-parchemins`; then replace `await page.getByRole('button', { name: /Ajouter un texte/ }).click(); await page.getByTestId('menu-add-type').click();` by `await closeOverlay(page); await page.getByTestId('library-desk').click();`.
- `scan.spec.ts` (both tests): replace `await page.getByTestId('btn-add-text').click(); await page.getByTestId('menu-add-scan').click();` by `await closeOverlay(page); await page.getByTestId('library-lens').click();`.
- `alexandria.spec.ts`: replace `await page.getByTestId('btn-add-text').click(); await page.getByTestId('menu-add-alexandria').click();` by `await closeOverlay(page); await page.getByTestId('library-portal').click();`.
- `scenes-camp.spec.ts`: in `PLACES` the `parchemins` path becomes `/\/tente-parchemins$/`; every `toHaveURL(/\/parchemins$/)` that follows a tap on `camp-parchemins` becomes `toHaveURL(/\/tente-parchemins$/)` (tests « two places tapped », « keyboard », « HUD »; the « Back during the fade » and « hero panel » tests start from `/parchemins` and keep it); the test « legacy screens stay usable in portrait » now uses the dossier (still legacy in UI3a): `await page.goto(\`/#/p/${id}/dossier\`); await expect(page.getByRole('heading', { name: "Le dossier d'Éris" })).toBeVisible();`.
- `scenes-debug.spec.ts`: `toHaveURL(/\/parchemins$/)` → `toHaveURL(/\/tente-parchemins$/)`.

(Import `closeOverlay`, `openShelves` from `./helpers` where used.)

- [ ] **Step 7: Write the library e2e (both projects)**

`web/e2e/scenes-library.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test';
import { closeOverlay, createProfileApi, createText, expectCamp, expectInSafeZone, expectScene, labelOverlaps, redScan } from './helpers';

// UI3a Task 9 (scenes spec §3 Library, §10): the library tent as a place. desktop + ipad.

const PLACES = ['library-shelves', 'library-desk', 'library-lens', 'library-portal'];
const heroName = (project: string) => `Tente-${project}-${Date.now() % 1e6}`;

async function openTent(page: Page, id: number) {
  await page.goto(`/#/p/${id}/tente-parchemins`);
  await expectScene(page, 'library');
  await expect(page.getByTestId('hud-xp')).toBeVisible();
}

async function tap(page: Page, testId: string, project: string) {
  const el = page.getByTestId(testId);
  if (project === 'ipad') await el.tap();
  else await el.click();
}

test('the hub leads into the tent; its plaque echoes the hub label; the exit sign leads back', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/camp`);
  await expectCamp(page);
  await tap(page, 'camp-parchemins', testInfo.project.name);
  await expect(page).toHaveURL(/\/tente-parchemins$/);
  await expectScene(page, 'library');
  await expect(page.locator('.stage-plaque')).toHaveText('La tente des parchemins');
  await expect(page.getByTestId('dialogue-text')).toContainText('Hou !');
  await page.getByTestId('dialogue-skip').click();
  for (const p of PLACES) await expect(page.getByTestId(p)).toBeVisible();
  await expect(page.getByTestId('library-desk')).toContainText('Taper ou coller un texte');
  await expect(page.getByTestId('library-desk').locator('img.hotspot-icon')).toHaveAttribute('src', '/art/icons/add-text.webp');
  await tap(page, 'scene-exit', testInfo.project.name);
  await expectCamp(page);
  await page.goBack();
  await expectScene(page, 'library');
  await page.goBack();
  await expectCamp(page);
});

test('the shelves open « Les Parchemins » as an overlay; seal, Escape and Back close it', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openTent(page, id);
  await tap(page, 'library-shelves', testInfo.project.name);
  await expect(page).toHaveURL(/\/parchemins$/);
  const shelves = page.getByTestId('overlay-shelves');
  await expect(shelves.getByRole('heading', { name: 'Les Parchemins' })).toBeVisible();
  await expect(page.getByTestId('scene-library')).toHaveAttribute('inert', '');
  await expect(shelves.locator('[data-testid="text-card"]').first()).toBeVisible();
  // Parity: the level filter and the « Tous » sections.
  await shelves.getByRole('button', { name: '9H', exact: true }).click();
  await shelves.getByRole('button', { name: 'Tous', exact: true }).click();
  await expect(shelves.getByRole('heading', { name: /À ton niveau/ })).toBeVisible();
  await page.getByTestId('overlay-close').click();
  await expect(shelves).toHaveCount(0);
  await expect(page).toHaveURL(/\/tente-parchemins$/);
  await expect(page.getByTestId('library-shelves')).toBeFocused();

  // The one-tap guard was released: the next object still opens (UI3 Ruling A6).
  await tap(page, 'library-shelves', testInfo.project.name);
  await expect(shelves).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(shelves).toHaveCount(0);
  await tap(page, 'library-shelves', testInfo.project.name);
  await expect(shelves).toBeVisible();
  await page.goBack();
  await expect(shelves).toHaveCount(0);
  await expect(page).toHaveURL(/\/tente-parchemins$/);

  // A deep link reopens it; its seal replaces the entry with the bare scene.
  await page.goto(`/#/p/${id}/parchemins`);
  await expect(shelves).toBeVisible();
  await closeOverlay(page);
  await expect(page).toHaveURL(/\/tente-parchemins$/);
});

test('a text card on the shelves starts the dictation; a prophecy wears its chip', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const title = `Prophétie tente ${testInfo.project.name} ${Date.now()}`;
  await createText(request, { title, body: 'Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.', level: '10H', due_date: '2099-01-01' });
  await page.goto(`/#/p/${id}/parchemins`);
  const card = page.getByTestId('overlay-shelves').locator('[data-testid="text-card"]', { hasText: title });
  await expect(card.getByTestId('chip-prophecy')).toContainText('01.01.2099');
  await card.click();
  await expect(page).toHaveURL(/\/play\/\d+$/);
});

test('places and labels sit in the safe zone, labels never cover another place', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  for (const size of [{ width: 1280, height: 720 }, { width: 1180, height: 820 }, { width: 1366, height: 1024 }]) {
    await page.setViewportSize(size);
    await openTent(page, id);
    await expectInSafeZone(page, 'library', PLACES);
    expect(await labelOverlaps(page, 'library'), `${size.width}x${size.height}`).toEqual([]);
  }
});

test('library: ?debug outlines the four objects; no red; rotate screen', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/tente-parchemins?debug`);
  await expectScene(page, 'library');
  await expect(page.getByTestId('hotspot-debug').locator('svg.outline')).toHaveCount(4);
  expect(await redScan(page)).toEqual([]);
  await page.goto(`/#/p/${id}/parchemins`);
  await expect(page.getByTestId('overlay-shelves')).toBeVisible();
  expect(await redScan(page)).toEqual([]);
  await page.setViewportSize({ width: 820, height: 1180 });
  await expect(page.getByTestId('rotate-screen')).toBeVisible();
});
```

- [ ] **Step 8: Verify**

Run: `scripts/npm.sh run test` and `scripts/npm.sh run check` — Expected: all pass, `0 errors and 0 warnings`.
Run: `scripts/playwright.sh scenes-` — Expected: `scenes-library` (5 tests), `scenes-title`, `scenes-camp`, `scenes-debug` pass on both projects. If the safe-zone or overlap test fails at one size, adjust only the numbers in `library.shapes.ts` (±2 %, docs/art/scenes.md is ±2 % by its own note), take a `?debug` screenshot to confirm the outline still hugs its landmark, and rerun.
Run: `scripts/playwright.sh --project=desktop` — Expected: all pass (happy-path, scan, alexandria and grimoire now enter through the tent; desk, lens and portal still open the legacy screens until Tasks 10–11).

- [ ] **Step 9: Commit**

```bash
git add web/src/lib/world/scenes/library.shapes.ts web/src/lib/world/scenes/library.ts web/src/lib/world/scenes/library.test.ts web/src/lib/world/scenes/index.ts web/src/lib/world/scenes/camp.ts web/src/lib/world/scenes/camp.test.ts web/src/screens/LibraryTent.svelte web/src/components/places/library/ShelvesPanel.svelte web/src/App.svelte web/e2e/scenes-library.spec.ts web/e2e/helpers.ts web/e2e/scenes-camp.spec.ts web/e2e/scenes-debug.spec.ts web/e2e/profiles.spec.ts web/e2e/happy-path.spec.ts web/e2e/scan.spec.ts web/e2e/alexandria.spec.ts
git commit -m "UI3a: the library tent - shelves overlay, desk/lens/portal places replace the add menu, owl greeting

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/lib/world/scenes/library.shapes.ts web/src/lib/world/scenes/library.ts web/src/lib/world/scenes/library.test.ts web/src/lib/world/scenes/index.ts web/src/lib/world/scenes/camp.ts web/src/lib/world/scenes/camp.test.ts web/src/screens/LibraryTent.svelte web/src/screens/Library.svelte web/src/components/places/library/ShelvesPanel.svelte web/src/components/AddMenu.svelte web/src/App.svelte web/e2e/scenes-library.spec.ts web/e2e/helpers.ts web/e2e/scenes-camp.spec.ts web/e2e/scenes-debug.spec.ts web/e2e/profiles.spec.ts web/e2e/happy-path.spec.ts web/e2e/scan.spec.ts web/e2e/alexandria.spec.ts
```

### Task 10: The scribe's desk and the bronze lens (write, paste and scan as overlays)

**Files:**
- Move: `web/src/screens/TextCreate.svelte` → `web/src/components/places/library/DeskPanel.svelte`; `web/src/screens/ScanText.svelte` → `web/src/components/places/library/LensPanel.svelte` (`git mv`)
- Modify: `web/src/screens/LibraryTent.svelte`, `web/src/App.svelte`
- Modify: `web/e2e/scenes-library.spec.ts`

**Interfaces:**
- Consumes: Task 9 (`LibraryTent.svelte`, its `close()`, `panel` values `pupitre` / `loupe`), Task 2 (`Overlay size="wide"`).
- Produces: `DeskPanel.svelte` and `LensPanel.svelte` props `{ profile: Profile }`; overlays `overlay-desk` (« Nouveau parchemin ») and `overlay-lens` (« Scanner une feuille », wide). Both save with `replaceRoute(href('library', ...))` (Ruling A2). Every legacy test id (`scan-input`, `btn-scan-read`, `scan-textarea`, `scan-low-confidence`, `btn-scan-verified`, `scan-confirm`, `btn-scan-confirm`, `scan-title`, `scan-due-date`, `btn-scan-save`, `scan-verify-hint`) is unchanged.

- [ ] **Step 1: Write the failing e2e**

Append to `web/e2e/scenes-library.spec.ts`:

```ts
test('the desk writes a new parchment; saving lands on the shelves and Back never reopens the form', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openTent(page, id);
  await tap(page, 'library-desk', testInfo.project.name);
  await expect(page).toHaveURL(/\/texts\/new$/);
  const desk = page.getByTestId('overlay-desk');
  await expect(desk.getByRole('heading', { name: 'Nouveau parchemin' })).toBeVisible();
  const title = `Pupitre ${testInfo.project.name} ${Date.now()}`;
  await page.getByLabel('Titre').fill(title);
  await page.getByLabel('Texte').fill('Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.');
  await expect(desk).toContainText('13 mots');
  // A text to defend is set in Literata (Ruling A8); every legacy field is there.
  expect(await page.getByLabel('Texte').evaluate((el) => getComputedStyle(el).fontFamily)).toContain('Literata');
  for (const label of ['Niveau', 'Auteur', 'Œuvre', 'Traducteur']) await expect(desk.getByLabel(label)).toBeVisible();
  expect(await redScan(page)).toEqual([]);
  await page.getByRole('button', { name: 'Sauvegarder dans les Parchemins' }).click();
  await expect(page).toHaveURL(/\/parchemins$/);
  await expect(page.getByTestId('overlay-shelves').locator('[data-testid="text-card"]', { hasText: title })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/tente-parchemins$/);
});

test('the lens opens the three-step scan as a wide overlay', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openTent(page, id);
  await tap(page, 'library-lens', testInfo.project.name);
  await expect(page).toHaveURL(/\/texts\/scan$/);
  const lens = page.getByTestId('overlay-lens');
  await expect(lens.getByRole('heading', { name: 'Scanner une feuille' })).toBeVisible();
  await expect(page.getByTestId('scan-input')).toBeAttached();
  await expect(page.getByTestId('btn-scan-read')).toBeDisabled();
  await expect(lens.locator('img.capture-icon')).toHaveAttribute('src', '/art/icons/add-scan.webp');
  const box = await lens.boundingBox();
  expect(box!.width, 'wide overlay').toBeGreaterThan(700);
  expect(await redScan(page)).toEqual([]);
  await closeOverlay(page);
  await expect(page).toHaveURL(/\/tente-parchemins$/);
});
```

Run: `scripts/playwright.sh scenes-library` — Expected: the two new tests FAIL (the desk and the lens still open the legacy screens, no `overlay-desk` / `overlay-lens`).

- [ ] **Step 2: Move the two screens into panels (Ruling A3)**

```bash
git mv web/src/screens/TextCreate.svelte web/src/components/places/library/DeskPanel.svelte
git mv web/src/screens/ScanText.svelte web/src/components/places/library/LensPanel.svelte
sed -i "s#'\.\./components/#'../../#g; s#'\.\./lib/#'../../../lib/#g" web/src/components/places/library/DeskPanel.svelte web/src/components/places/library/LensPanel.svelte
```

In each of the two files:
- delete the `TopBar` import and its `<TopBar ... />` line;
- import `replaceRoute` (instead of `navigate`) from `../../../lib/router.svelte` and change the save's `navigate(href('library', { profileId: String(profile.id) }))` into `replaceRoute(href('library', { profileId: String(profile.id) }))`;
- replace the outer `<div class="screen">` by `<div class="panel-desk">` (DeskPanel) / `<div class="panel-lens">` (LensPanel).

Nothing else changes (labels, word count, hints, the three scan steps, the confirmation, the due date « Dictée pour le »).

- [ ] **Step 3: Open them on the tent**

In `web/src/screens/LibraryTent.svelte` import `DeskPanel` and `LensPanel` from `../components/places/library/` and extend the overlay block:

```svelte
{#if panel === 'etageres'}
  <Overlay variant="scroll" size="wide" title="Les Parchemins" testId="overlay-shelves" onClose={close} returnFocus={'[data-testid="library-shelves"]'}>
    <ShelvesPanel {profile} />
  </Overlay>
{:else if panel === 'pupitre'}
  <Overlay variant="scroll" title="Nouveau parchemin" testId="overlay-desk" onClose={close} returnFocus={'[data-testid="library-desk"]'}>
    <DeskPanel {profile} />
  </Overlay>
{:else if panel === 'loupe'}
  <Overlay variant="scroll" size="wide" title="Scanner une feuille" testId="overlay-lens" onClose={close} returnFocus={'[data-testid="library-lens"]'}>
    <LensPanel {profile} />
  </Overlay>
{/if}
```

In `web/src/App.svelte` delete the `text-new` and `text-scan` branches and the `TextCreate` / `ScanText` imports (the library place branch now serves them).

- [ ] **Step 4: Verify**

Run: `scripts/npm.sh run check` — Expected: `0 errors and 0 warnings`.
Run: `scripts/npm.sh run test` — Expected: all pass (the no-emoji guard walks the moved files too).
Run: `scripts/playwright.sh scenes-library` — Expected: 7 tests × 2 projects pass.
Run: `scripts/playwright.sh --project=desktop` — Expected: all pass; `happy-path` (desk) and `scan` (lens: capture, the « À vérifier » chips, the confirmation, the due date, save → shelves with the prophecy chip, « Voir la feuille » on the play screen) prove the parity of both panels.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/places/library/DeskPanel.svelte web/src/components/places/library/LensPanel.svelte web/src/screens/LibraryTent.svelte web/src/App.svelte web/e2e/scenes-library.spec.ts
git commit -m "UI3a: the scribe's desk and the bronze lens open the text and scan forms as overlays

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/screens/TextCreate.svelte web/src/screens/ScanText.svelte web/src/components/places/library/DeskPanel.svelte web/src/components/places/library/LensPanel.svelte web/src/screens/LibraryTent.svelte web/src/App.svelte web/e2e/scenes-library.spec.ts
```

### Task 11: The portal to Alexandria (works and scrolls as overlays)

**Files:**
- Move: `web/src/screens/Alexandria.svelte` → `web/src/components/places/library/PortalPanel.svelte`; `web/src/screens/AlexandriaWork.svelte` → `web/src/components/places/library/PortalWorkPanel.svelte` (`git mv`)
- Modify: `web/src/screens/LibraryTent.svelte`, `web/src/App.svelte`
- Modify: `web/e2e/scenes-library.spec.ts`, `web/e2e/alexandria.spec.ts`

**Interfaces:**
- Consumes: Task 9/10 (`LibraryTent.svelte`, `panel` values `portail` / `oeuvre`, `params.workId`), Task 1 (`openPanel`, `closePanel`).
- Produces: `PortalPanel.svelte` props `{ profile: Profile }` (opens a work with `openPanel`); `PortalWorkPanel.svelte` props `{ profile: Profile; workId: string }` with a new « Toutes les œuvres » button (`data-testid="portal-back"`, steps back to the works list); overlays `overlay-portal` and `overlay-portal-work` (both titled « Bibliothèque d'Alexandrie », wide). Legacy test ids (`work-card`, `btn-refresh-work`, `alexandria-error`, `chunk-card`, `btn-adopt`, `btn-adopt-play`) unchanged.

- [ ] **Step 1: Write the failing e2e**

Append to `web/e2e/scenes-library.spec.ts`:

```ts
test('the portal opens the works, a work opens its scrolls, « Toutes les œuvres » and the seal step back', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openTent(page, id);
  await tap(page, 'library-portal', testInfo.project.name);
  await expect(page).toHaveURL(/\/alexandria$/);
  const portal = page.getByTestId('overlay-portal');
  await expect(portal.getByRole('heading', { name: "Bibliothèque d'Alexandrie" })).toBeVisible();
  await expect(portal.getByTestId('work-card').first()).toBeVisible();
  expect(await portal.getByTestId('work-card').count()).toBeGreaterThanOrEqual(10);
  await portal.getByTestId('work-card').first().click();
  await expect(page).toHaveURL(/\/alexandria\/[^/]+$/);
  const work = page.getByTestId('overlay-portal-work');
  await expect(work.getByTestId('btn-refresh-work')).toBeVisible();
  await expect(work).toContainText('Les traducteurs et auteurs sont dans le domaine public.');
  await work.getByTestId('portal-back').click();
  await expect(page).toHaveURL(/\/alexandria$/);
  await expect(portal).toBeVisible();
  await portal.getByTestId('work-card').first().click();
  await expect(work).toBeVisible();
  await page.getByTestId('overlay-close').click(); // steps back one overlay (Ruling A2)
  await expect(portal).toBeVisible();
  await page.getByTestId('overlay-close').click();
  await expect(page).toHaveURL(/\/tente-parchemins$/);
  expect(await redScan(page)).toEqual([]);
});
```

Run: `scripts/playwright.sh scenes-library` — Expected: the new test FAILS (no `overlay-portal`).

- [ ] **Step 2: Move the two screens into panels (Ruling A3)**

```bash
git mv web/src/screens/Alexandria.svelte web/src/components/places/library/PortalPanel.svelte
git mv web/src/screens/AlexandriaWork.svelte web/src/components/places/library/PortalWorkPanel.svelte
sed -i "s#'\.\./components/#'../../#g; s#'\.\./lib/#'../../../lib/#g" web/src/components/places/library/PortalPanel.svelte web/src/components/places/library/PortalWorkPanel.svelte
```

`PortalPanel.svelte`:
- delete the `TopBar` import and element; `<div class="screen">` → `<div class="panel-portal">`;
- import `openPanel` from `../../../lib/scene/panelNav` and make `openWork` call `openPanel(href('alexandria-work', { profileId: String(profile.id), workId: w.id }))` (drop `navigate` if unused). The painted `.hero` banner (alexandrie.webp) stays: it is the view through the portal.

`PortalWorkPanel.svelte`:
- delete the `TopBar` import and element; `<div class="screen">` → `<div class="panel-portal-work">`;
- import `closePanel` from `../../../lib/scene/panelNav`; add as the first child of the panel:

```svelte
  <button
    type="button"
    class="btn btn-ghost portal-back"
    data-testid="portal-back"
    onclick={() => closePanel(href('alexandria', { profileId: String(profile.id) }))}
  >
    Toutes les œuvres
  </button>
```

  and to its style `.portal-back { margin-bottom: 8px; }`.

- [ ] **Step 3: Open them on the tent**

In `web/src/screens/LibraryTent.svelte` import `PortalPanel` and `PortalWorkPanel`, and add two branches to the overlay chain (before `{/if}`):

```svelte
{:else if panel === 'portail'}
  <Overlay variant="scroll" size="wide" title="Bibliothèque d'Alexandrie" testId="overlay-portal" onClose={close} returnFocus={'[data-testid="library-portal"]'}>
    <PortalPanel {profile} />
  </Overlay>
{:else if panel === 'oeuvre'}
  <Overlay variant="scroll" size="wide" title="Bibliothèque d'Alexandrie" testId="overlay-portal-work" onClose={close} returnFocus={'[data-testid="library-portal"]'}>
    {#key params.workId}
      <PortalWorkPanel {profile} workId={params.workId ?? ''} />
    {/key}
  </Overlay>
```

(`{#key}`: the panel loads its work once on mount, so a different work id mounts a fresh panel.)

In `web/src/App.svelte` delete the `alexandria` and `alexandria-work` branches and the `Alexandria` / `AlexandriaWork` imports. The library place branch now serves all six library routes from one `LibraryTent` instance.

- [ ] **Step 4: Keep the Alexandria spec on its path**

`web/e2e/alexandria.spec.ts` already enters through `library-portal` (Task 9). Its `await page.goBack();` from a work now lands on the works overlay (history); keep it. Add after `await expect(page.getByTestId('chunk-card').first()).toContainText(/Rouleau \d+/);`: `await expect(page.getByTestId('overlay-portal-work')).toBeVisible();`.

- [ ] **Step 5: Verify**

Run: `scripts/npm.sh run check` and `scripts/npm.sh run test` — Expected: `0 errors and 0 warnings`, all pass.
Run: `scripts/playwright.sh scenes-library` — Expected: 8 tests × 2 projects pass.
Run: `scripts/playwright.sh alexandria --project=desktop` — Expected: pass (refresh with offline fixtures, the graceful « hors d'atteinte » banner, adopting a scroll, « Jouer maintenant » → play with the Jules Verne credits).

- [ ] **Step 6: Commit**

```bash
git add web/src/components/places/library/PortalPanel.svelte web/src/components/places/library/PortalWorkPanel.svelte web/src/screens/LibraryTent.svelte web/src/App.svelte web/e2e/scenes-library.spec.ts web/e2e/alexandria.spec.ts
git commit -m "UI3a: the portal to Alexandria opens the works and their scrolls as overlays

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/screens/Alexandria.svelte web/src/screens/AlexandriaWork.svelte web/src/components/places/library/PortalPanel.svelte web/src/components/places/library/PortalWorkPanel.svelte web/src/screens/LibraryTent.svelte web/src/App.svelte web/e2e/scenes-library.spec.ts web/e2e/alexandria.spec.ts
```

### Task 12: Delphi (the Pythia, the votive tablets, the prophecy on the altar)

**Files:**
- Create: `web/src/lib/world/scenes/delphi.shapes.ts`, `web/src/lib/world/scenes/delphi.ts`, `web/src/lib/world/scenes/delphi.test.ts`, `web/src/screens/Delphi.svelte`
- Move: `web/src/screens/Oracle.svelte` → `web/src/components/places/delphi/PythiaPanel.svelte`; `web/src/screens/QuestBoard.svelte` → `web/src/components/places/delphi/TabletsPanel.svelte` (`git mv`)
- Modify: `web/src/lib/world/scenes/index.ts`, `web/src/lib/world/scenes/camp.ts`, `web/src/lib/world/scenes/camp.test.ts`, `web/src/App.svelte`
- Create: `web/e2e/scenes-delphi.spec.ts`
- Modify: `web/e2e/scenes-camp.spec.ts`, `web/e2e/world.spec.ts`

**Interfaces:**
- Consumes: Task 1 (`placeFor` → `{ place: 'delphi', panel: 'pythie' | 'tablettes' | null }`, `sceneHref`), Task 2 (`PlaceScene`, `Hotspot`, `DialogueBox`, `Overlay`, keyed greetings, e2e helpers), Task 3 (`ART.scenes.delphi`, `ART.characters.pythia`), `nearestProphecy`, `prophecyWhen` (`web/src/lib/world/scenes/camp.ts`).
- Produces:
  - `delphi.ts`: `export const DELPHI_HOTSPOTS: HotspotDef[]` (ids `pythia` → `oracle`, `tablets` → `quests`), `export const DELPHI_SCENE: SceneDef` (id `delphi`, plaque « Le temple de Delphes »), `export const PYTHIA_LAYER: SceneLayerDef`, `export function pythiaGreeting(camp: CampResponse): DialogueLine[]`, `export function scrollTitle(key: ScrollKey, title: string): string`.
  - `Delphi.svelte` props `{ profile: Profile; panel: PanelId | null }`; test ids `scene-delphi`, `delphi-pythia`, `delphi-tablets`, `delphi-tablets-badge`, `delphi-prophecy`, `overlay-pythia`, `overlay-tablets`.
  - `PythiaPanel.svelte`, `TabletsPanel.svelte` props `{ profile: Profile }` (legacy test ids unchanged: `scroll-*`, `scroll-open`, `oracle-reward`, `oracle-monster-*`, `oracle-confirm`, `oracle-cancel`, `oracle-quest`, `oracle-prophecy-*`, `board-challenge-*`, `board-boss`, `quest-card-*`).
  - The camp's `oracle` place targets `delphi`; `CAMP_SCENE.preload` = library tent + Delphi.

- [ ] **Step 1: Write the failing scene-data test**

`web/src/lib/world/scenes/delphi.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { validateScene } from '../../scene/validate';
import type { CampResponse, QuestOut } from '../types';
import { DELPHI_HOTSPOTS, DELPHI_SCENE, PYTHIA_LAYER, pythiaGreeting, scrollTitle } from './delphi';

function camp(over: Partial<CampResponse> = {}): CampResponse {
  return {
    oracle: { week: 'w', status: 'sealed', reward_id: null },
    quests: [],
    ...over,
  } as CampResponse;
}
const state = (id: string, c: CampResponse | null) => DELPHI_HOTSPOTS.find((h) => h.id === id)!.state({ camp: c, catalog: null });

describe('Delphi (UI3 Ruling A1, A10)', () => {
  it('is a valid scene: the Pythia and the votive-tablet wall', () => {
    expect(validateScene(DELPHI_SCENE)).toEqual([]);
    expect(DELPHI_SCENE).toMatchObject({ id: 'delphi', title: 'Le temple de Delphes', background: '/art/scenes/delphi.webp' });
    expect(DELPHI_HOTSPOTS.map((h) => [h.id, h.target])).toEqual([
      ['pythia', 'oracle'],
      ['tablets', 'quests'],
    ]);
  });

  it('seats the Pythia on the painted tripod', () => {
    expect(PYTHIA_LAYER).toMatchObject({ src: '/art/characters/pythia_cut.webp', x: 32.5, y: 77, scale: 16 });
  });

  it('glows on the Pythia while the week is sealed; counts active quests on the tablets', () => {
    expect(state('pythia', camp())).toMatchObject({ isNew: true, caption: 'Trois rouleaux scellés' });
    expect(state('pythia', camp({ oracle: { week: 'w', status: 'chosen', reward_id: null } }))).toMatchObject({ isNew: false, caption: 'Quête en cours' });
    const quests = [{ status: 'active' }, { status: 'active' }, { status: 'done' }] as QuestOut[];
    expect(state('tablets', camp({ quests })).badge).toBe(2);
    expect(state('tablets', camp()).badge).toBeNull();
  });

  it('lets the Pythia greet with one static line', () => {
    expect(pythiaGreeting(camp()).map((l) => l.text)).toEqual(["Approche, héros. Trois rouleaux scellés t'attendent cette semaine."]);
    expect(pythiaGreeting(camp({ oracle: { week: 'w', status: 'chosen', reward_id: null } })).map((l) => l.text)).toEqual([
      "La quête de la semaine est choisie. L'Oracle parlera de nouveau lundi.",
    ]);
    expect(pythiaGreeting(camp())[0]).toMatchObject({ speaker: 'pythia', name: 'La Pythie', portrait: '/art/characters/pythia_cut.webp' });
  });

  it('relabels the « école » scroll client-side (carry #13)', () => {
    expect(scrollTitle('ecole', "Ce qui arrive à l'école")).toBe('Ce que prépare ta classe');
    expect(scrollTitle('faible', 'Le point faible')).toBe('Le point faible');
  });
});
```

Run: `scripts/npm.sh run test -- src/lib/world/scenes/delphi.test.ts` — Expected: FAIL (`Cannot find module './delphi'`).

- [ ] **Step 2: Scene data**

`web/src/lib/world/scenes/delphi.shapes.ts`:

```ts
// Hotspot geometry of Delphi (delphi.webp), art % of the 16:9 frame, authored by hand from
// docs/art/scenes.md (tripod x 27-38, y 39-75 + the Pythia cut-out over it; tablet wall x 53-82,
// y 22-57) and checked with `?debug`. The altar below the wall (y 60-78) holds the prophecy card.
import type { ShapeMap } from '../../scene/types';

export const DELPHI_SHAPES = {
  pythia: { kind: 'polygon', points: [[26, 30], [39, 30], [40.5, 76], [24.5, 76]] },
  tablets: { kind: 'polygon', points: [[53.5, 23], [81.5, 23], [81.5, 56], [53.5, 56]] },
} satisfies ShapeMap;
```

`web/src/lib/world/scenes/delphi.ts`:

```ts
// Delphi (scenes UI spec §3 "Delphi scene"): the Pythia on her tripod (the weekly scrolls and the
// prophecies) and the votive-tablet wall (the quests). Each opens its legacy route as an overlay
// (UI3 Ruling A1). The Pythia greets with a static line (A9).
import { ART } from '../art';
import type { CampResponse, ScrollKey } from '../types';
import { IDLE_HOTSPOT, type DialogueLine, type HotspotDef, type HotspotState, type SceneDef, type SceneLayerDef } from '../../scene/types';
import { DELPHI_SHAPES } from './delphi.shapes';

const st = (p: Partial<HotspotState> = {}): HotspotState => ({ ...IDLE_HOTSPOT, ...p });

export const DELPHI_HOTSPOTS: HotspotDef[] = [
  {
    id: 'pythia',
    label: 'La Pythie',
    target: 'oracle',
    shape: DELPHI_SHAPES.pythia,
    labelPos: 'above',
    leader: true,
    state: ({ camp }) => {
      if (!camp) return st();
      return camp.oracle.status === 'sealed' ? st({ isNew: true, caption: 'Trois rouleaux scellés' }) : st({ caption: 'Quête en cours' });
    },
  },
  {
    id: 'tablets',
    label: 'Le mur des quêtes',
    target: 'quests',
    shape: DELPHI_SHAPES.tablets,
    labelPos: 'below',
    leader: true,
    state: ({ camp }) => {
      const n = camp?.quests.filter((q) => q.status === 'active').length ?? 0;
      return st({ badge: n > 0 ? n : null });
    },
  },
];

/** The Pythia seated where the painted tripod stands (docs/art/scenes.md: centred at x 32.5, feet
 *  at about y 76, about half the picture's height: 16 % wide for the 768×1344 cut-out). */
export const PYTHIA_LAYER: SceneLayerDef = {
  id: 'pythia',
  src: ART.characters.pythia,
  alt: '',
  x: 32.5,
  y: 77,
  scale: 16,
  depth: 1,
  idle: 'breathe',
};

export const DELPHI_SCENE: SceneDef = {
  id: 'delphi',
  title: 'Le temple de Delphes',
  background: ART.scenes.delphi,
  layers: [PYTHIA_LAYER],
  hotspots: DELPHI_HOTSPOTS,
  ambience: { particles: 'dust', music: null },
  narrator: { enter: 'delphi.enter', firstVisit: 'delphi.first' },
  preload: [],
};

export function pythiaGreeting(camp: CampResponse): DialogueLine[] {
  const text =
    camp.oracle.status === 'sealed'
      ? "Approche, héros. Trois rouleaux scellés t'attendent cette semaine."
      : "La quête de la semaine est choisie. L'Oracle parlera de nouveau lundi.";
  return [{ speaker: 'pythia', name: 'La Pythie', portrait: ART.characters.pythia, text }];
}

/** Carry #13 / Ruling A10: the server calls the school scroll « Ce qui arrive à l'école ». */
export function scrollTitle(key: ScrollKey, title: string): string {
  return key === 'ecole' ? 'Ce que prépare ta classe' : title;
}
```

In `web/src/lib/world/scenes/index.ts` add `DELPHI_SCENE` to `SCENES`.

Run: `scripts/npm.sh run test -- src/lib/world/scenes/` — Expected: PASS.

- [ ] **Step 3: Move the Oracle and the quest board into panels (Ruling A3)**

```bash
mkdir -p web/src/components/places/delphi
git mv web/src/screens/Oracle.svelte web/src/components/places/delphi/PythiaPanel.svelte
git mv web/src/screens/QuestBoard.svelte web/src/components/places/delphi/TabletsPanel.svelte
sed -i "s#'\.\./components/#'../../#g; s#'\.\./lib/#'../../../lib/#g" web/src/components/places/delphi/PythiaPanel.svelte web/src/components/places/delphi/TabletsPanel.svelte
```

`PythiaPanel.svelte`:
- delete the `TopBar` import and element, and the banner block `<div class="scene" style="background-image:url({ART.scenes.delphes})"><h1>L'Oracle de Delphes</h1></div>` with the `.scene` and `.scene h1` CSS rules; drop the `ART` import if nothing else uses it;
- `<div class="screen oracle">` → `<div class="panel-pythia oracle">` (keeps the `.oracle` rules);
- import `scrollTitle` from `../../../lib/world/scenes/delphi` and pass `title={scrollTitle(s.key, s.title)}` to each `<Scroll>` (was `title={s.title}`).

`TabletsPanel.svelte`:
- delete the `TopBar` import and element, and the banner block `<div class="scene" style="background-image:url({ART.scenes.camp})"><h1>Le tableau des quêtes</h1></div>` with its `.scene` CSS; drop the `ART` import if unused;
- `<div class="screen board">` → `<div class="panel-tablets board">`.

- [ ] **Step 4: Write `web/src/screens/Delphi.svelte`**

```svelte
<script lang="ts">
  // Delphi (scenes UI spec §3): the Pythia on her tripod opens the weekly scrolls and the
  // prophecies (#/p/:id/delphes), the votive-tablet wall opens the quest board (#/p/:id/quetes).
  // The nearest prophecy also sits on the altar, with « Réviser ». The Pythia greets once per page
  // load (UI3 Ruling A9).
  import PlaceScene from '../components/scene/PlaceScene.svelte';
  import Hotspot from '../components/scene/Hotspot.svelte';
  import DialogueBox from '../components/scene/DialogueBox.svelte';
  import Overlay from '../components/scene/Overlay.svelte';
  import PythiaPanel from '../components/places/delphi/PythiaPanel.svelte';
  import TabletsPanel from '../components/places/delphi/TabletsPanel.svelte';
  import { DELPHI_SCENE, pythiaGreeting } from '../lib/world/scenes/delphi';
  import { nearestProphecy, prophecyWhen } from '../lib/world/scenes/camp';
  import { campStore } from '../lib/world/campStore.svelte';
  import { closePanel, hotspotHref, openPanel } from '../lib/scene/panelNav';
  import { markGreetedKey, shouldGreetKey } from '../lib/scene/greeting';
  import { sceneHref, type PanelId } from '../lib/world/places';
  import { playSfx, unlockAudio } from '../lib/juice/sfx';
  import { href } from '../lib/routes';
  import { navigate } from '../lib/router.svelte';
  import type { DialogueLine, HotspotDef } from '../lib/scene/types';
  import type { Profile } from '../lib/types';

  let { profile, panel }: { profile: Profile; panel: PanelId | null } = $props();

  let debug = $state(false);
  let greeting = $state<DialogueLine[] | null>(null);

  // The Pythia's line depends on this week's scrolls: wait for /camp (PlaceScene loads it).
  const camp = $derived(campStore.data && campStore.data.profile.id === profile.id ? campStore.data : null);
  $effect(() => {
    const key = `delphi:${profile.id}`;
    if (!camp || debug || !shouldGreetKey(key)) return;
    markGreetedKey(key);
    greeting = pythiaGreeting(camp);
  });

  function activate(def: HotspotDef) {
    const to = hotspotHref(def, profile.id);
    if (!to) return;
    unlockAudio();
    playSfx('tap');
    openPanel(to);
  }

  const close = () => closePanel(sceneHref('delphi', profile.id));

  function review(textId: number) {
    unlockAudio();
    navigate(href('play', { profileId: String(profile.id), textId: String(textId) }));
  }
</script>

<PlaceScene {profile} scene={DELPHI_SCENE} bind:debug>
  {#snippet children(ctx)}
    {#each DELPHI_SCENE.hotspots as def (def.id)}
      <Hotspot {def} status={def.state(ctx)} sceneId="delphi" onActivate={activate} />
    {/each}
    {#if ctx.camp}
      {@const prophecy = nearestProphecy(ctx.camp)}
      {#if prophecy}
        <div class="kit-parchment altar-prophecy" data-testid="delphi-prophecy">
          <p class="altar-text">
            <span class="altar-when">La Pythie a vu ton épreuve, {prophecyWhen(prophecy.days_left)} :</span>
            <span class="altar-title">{prophecy.title}</span>
          </p>
          <button type="button" class="kit-bronze" onclick={() => review(prophecy.text_id)}>Réviser</button>
        </div>
      {/if}
    {/if}
    {#if greeting}
      <DialogueBox lines={greeting} onDone={() => (greeting = null)} />
    {/if}
  {/snippet}
</PlaceScene>

{#if panel === 'pythie'}
  <Overlay variant="scroll" size="wide" title="L'Oracle de Delphes" testId="overlay-pythia" onClose={close} returnFocus={'[data-testid="delphi-pythia"]'}>
    <PythiaPanel {profile} />
  </Overlay>
{:else if panel === 'tablettes'}
  <Overlay variant="scroll" size="wide" title="Le tableau des quêtes" testId="overlay-tablets" onClose={close} returnFocus={'[data-testid="delphi-tablets"]'}>
    <TabletsPanel {profile} />
  </Overlay>
{/if}

<style>
  /* The nearest prophecy, laid on the altar under the tablet wall (art x 54-78, y 66-78): clear of
     both places and their labels, above the dialogue dock (y 80). */
  .altar-prophecy {
    position: absolute;
    left: 54%;
    top: 66%;
    width: 24%;
    z-index: 3;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 8px 8px 12px;
  }
  .altar-text {
    flex: 1;
    min-width: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .altar-when {
    font-style: italic;
    font-size: 13px;
    line-height: 1.25;
  }
  .altar-title {
    font-weight: 700;
    font-size: 14px;
    line-height: 1.25;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
  }
  .altar-prophecy .kit-bronze {
    flex-shrink: 0;
    padding: 8px 12px;
    font-size: 15px;
  }
</style>
```

- [ ] **Step 5: Route Delphi, retarget the camp's path**

In `web/src/App.svelte` import `Delphi from './screens/Delphi.svelte'`, delete the `oracle` and `quests` branches and the `Oracle` / `QuestBoard` imports, and add next to the library branch:

```svelte
      {:else if view?.place === 'delphi'}
        <Delphi profile={gateProfile} panel={view.panel} />
```

In `web/src/lib/world/scenes/camp.ts`: the `oracle` hotspot gets `target: 'delphi'`; `CAMP_SCENE.preload` becomes `[ART.scenes.libraryTent, ART.scenes.delphi]` (carry rec. 9; its comment: `// Carry rec. 9: the two places the hub leads to most (the tent, the temple).`). In `camp.test.ts` the route map expects `oracle: 'delphi'` and the preload test expects `['/art/scenes/library_tent.webp', '/art/scenes/delphi.webp']`.

- [ ] **Step 6: Migrate the specs that walked the Oracle**

- `web/e2e/scenes-camp.spec.ts`: in `PLACES` the `oracle` path becomes `/\/temple$/`.
- `web/e2e/world.spec.ts` step 2: after `await page.getByTestId('camp-oracle').click();` add `await expectScene(page, 'delphi'); await page.getByTestId('delphi-pythia').click();` (import `expectScene`). Everything after is unchanged (the scrolls, the picker and the quest are in the Pythia overlay; the reload lands on `#/p/:id/delphes`, which reopens it). Step 3's `camp-quests` still opens `#/p/:id/quetes`, now Delphi with the tablets overlay.

- [ ] **Step 7: Write the Delphi e2e (both projects)**

`web/e2e/scenes-delphi.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test';
import { closeOverlay, createProfileApi, createText, expectCamp, expectInSafeZone, expectScene, labelOverlaps, measureBoxes, redScan } from './helpers';

// UI3a Task 12 (scenes spec §3 Delphi, §10): the Pythia and the votive tablets. desktop + ipad.

const PLACES = ['delphi-pythia', 'delphi-tablets'];
const BODY = 'Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.';
const heroName = (project: string) => `Delphes-${project}-${Date.now() % 1e6}`;

async function openTemple(page: Page, id: number) {
  await page.goto(`/#/p/${id}/temple`);
  await expectScene(page, 'delphi');
  await expect(page.getByTestId('hud-xp')).toBeVisible();
}

async function tap(page: Page, testId: string, project: string) {
  const el = page.getByTestId(testId);
  if (project === 'ipad') await el.tap();
  else await el.click();
}

// Prophecies are global: keep only this test's own (same approach as scenes-camp.spec.ts).
async function onlyOwnProphecy(page: Page, textId: number) {
  await page.route('**/api/profiles/*/camp', async (route) => {
    const res = await route.fetch();
    const json = await res.json();
    json.prophecies = json.prophecies.filter((p: { text_id: number }) => p.text_id === textId);
    await route.fulfill({ response: res, json });
  });
}

test('the hub path leads to the temple; the Pythia greets; the exit sign leads back', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/camp`);
  await expectCamp(page);
  await tap(page, 'camp-oracle', testInfo.project.name);
  await expect(page).toHaveURL(/\/temple$/);
  await expectScene(page, 'delphi');
  await expect(page.locator('.stage-plaque')).toHaveText('Le temple de Delphes');
  await expect(page.getByTestId('dialogue-text')).toHaveText("Approche, héros. Trois rouleaux scellés t'attendent cette semaine.");
  await page.getByTestId('dialogue-skip').click();
  await expect(page.getByTestId('delphi-pythia')).toHaveClass(/is-new/);
  await expect(page.getByTestId('delphi-pythia')).toContainText('Trois rouleaux scellés');
  await tap(page, 'scene-exit', testInfo.project.name);
  await expectCamp(page);
});

test('the Pythia opens the three scrolls; « Ce que prépare ta classe »; seal, Escape and Back close', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openTemple(page, id);
  await page.getByTestId('dialogue-skip').click();
  await tap(page, 'delphi-pythia', testInfo.project.name);
  await expect(page).toHaveURL(/\/delphes$/);
  const oracle = page.getByTestId('overlay-pythia');
  await expect(oracle.getByRole('heading', { name: "L'Oracle de Delphes" })).toBeVisible();
  await expect(oracle.getByTestId('scroll-open')).toHaveCount(3);
  await expect(oracle.getByTestId('scroll-ecole')).toContainText('Ce que prépare ta classe');
  await expect(oracle.getByTestId('scroll-ecole')).not.toContainText("Ce qui arrive à l'école");
  await expect(oracle.getByTestId('oracle-reward')).toContainText('150 XP');
  // Parity: the school scroll's monster picker opens and cancels without consulting.
  await oracle.getByTestId('scroll-ecole').getByTestId('scroll-open').click();
  await expect(oracle.getByTestId('oracle-monster-hydre')).toBeVisible();
  await oracle.getByTestId('oracle-cancel').click();
  await expect(oracle.getByTestId('scroll-open')).toHaveCount(3);
  await page.keyboard.press('Escape');
  await expect(oracle).toHaveCount(0);
  await expect(page).toHaveURL(/\/temple$/);
  await tap(page, 'delphi-pythia', testInfo.project.name);
  await page.goBack();
  await expect(oracle).toHaveCount(0);
  await page.goto(`/#/p/${id}/delphes`);
  await expect(oracle).toBeVisible();
  await closeOverlay(page);
  await expect(page).toHaveURL(/\/temple$/);
});

test('the tablets open the quest board; a launched quest shows on the tablets badge', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openTemple(page, id);
  await page.getByTestId('dialogue-skip').click();
  await expect(page.getByTestId('delphi-tablets-badge')).toHaveCount(0);
  await tap(page, 'delphi-tablets', testInfo.project.name);
  await expect(page).toHaveURL(/\/quetes$/);
  const board = page.getByTestId('overlay-tablets');
  await expect(board.getByRole('heading', { name: 'Le tableau des quêtes' })).toBeVisible();
  await expect(board.getByTestId('board-boss')).toBeVisible();
  await board.getByTestId('board-challenge-echo').getByRole('button', { name: 'Lancer une quête' }).click();
  await expect(board.getByTestId('board-challenge-echo')).toContainText('Quête en cours');
  await closeOverlay(page);
  await expect(page.getByTestId('delphi-tablets-badge')).toHaveText('1');
});

test('the nearest prophecy sits on the altar, clear of the places; « Réviser » opens the dictation', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const title = `Prophétie Delphes ${testInfo.project.name} ${Date.now()}`;
  const text = await createText(request, { title, body: BODY, level: '10H', due_date: '2099-01-01' });
  await onlyOwnProphecy(page, text.id);
  for (const size of [{ width: 1280, height: 720 }, { width: 1180, height: 820 }, { width: 1366, height: 1024 }]) {
    await page.setViewportSize(size);
    await page.goto(`/#/p/${id}/temple?debug`); // ?debug: no greeting in the way
    await expectScene(page, 'delphi');
    const card = page.getByTestId('delphi-prophecy');
    await expect(card).toContainText(title);
    const b = await measureBoxes(page, {
      card: '[data-testid="delphi-prophecy"]',
      pythia: '[data-testid="delphi-pythia"]',
      pythiaLabel: '[data-testid="delphi-pythia"] .hotspot-label',
      tablets: '[data-testid="delphi-tablets"]',
      tabletsLabel: '[data-testid="delphi-tablets"] .hotspot-label',
    });
    const hit = (a: typeof b.card, c: typeof b.card) => !!a && !!c && a.x < c.x + c.width && c.x < a.x + a.width && a.y < c.y + c.height && c.y < a.y + a.height;
    for (const k of ['pythia', 'pythiaLabel', 'tablets', 'tabletsLabel'] as const) {
      expect(hit(b.card, b[k]), `prophecy vs ${k} at ${size.width}x${size.height}`).toBe(false);
    }
  }
  await page.getByTestId('delphi-prophecy').getByRole('button', { name: 'Réviser' }).click();
  await expect(page).toHaveURL(new RegExp(`/play/${text.id}$`));
});

test('places and labels sit in the safe zone, labels never cover another place', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  for (const size of [{ width: 1280, height: 720 }, { width: 1180, height: 820 }, { width: 1366, height: 1024 }]) {
    await page.setViewportSize(size);
    await openTemple(page, id);
    await expectInSafeZone(page, 'delphi', PLACES);
    expect(await labelOverlaps(page, 'delphi'), `${size.width}x${size.height}`).toEqual([]);
  }
});

test('Delphi: ?debug outlines both places; no red; rotate screen', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/temple?debug`);
  await expectScene(page, 'delphi');
  await expect(page.getByTestId('hotspot-debug').locator('svg.outline')).toHaveCount(2);
  expect(await redScan(page)).toEqual([]);
  await page.goto(`/#/p/${id}/delphes`);
  await expect(page.getByTestId('overlay-pythia')).toBeVisible();
  expect(await redScan(page)).toEqual([]);
  await page.setViewportSize({ width: 820, height: 1180 });
  await expect(page.getByTestId('rotate-screen')).toBeVisible();
});
```

- [ ] **Step 8: Verify**

Run: `scripts/npm.sh run test` and `scripts/npm.sh run check` — Expected: all pass, `0 errors and 0 warnings`.
Run: `scripts/playwright.sh scenes-` — Expected: `scenes-delphi` (6 tests), `scenes-library`, `scenes-title`, `scenes-camp`, `scenes-debug` pass on both projects. If a safe-zone or overlap assertion fails, tune `delphi.shapes.ts` or the altar card's `left/top/width` within ±2 % and confirm with a `?debug` screenshot.
Run: `scripts/playwright.sh world --project=desktop` — Expected: 9 passed (the Oracle through the Pythia, the board through the tablets).

- [ ] **Step 9: Commit**

```bash
git add web/src/lib/world/scenes/delphi.shapes.ts web/src/lib/world/scenes/delphi.ts web/src/lib/world/scenes/delphi.test.ts web/src/lib/world/scenes/index.ts web/src/lib/world/scenes/camp.ts web/src/lib/world/scenes/camp.test.ts web/src/screens/Delphi.svelte web/src/components/places/delphi/PythiaPanel.svelte web/src/components/places/delphi/TabletsPanel.svelte web/src/App.svelte web/e2e/scenes-delphi.spec.ts web/e2e/scenes-camp.spec.ts web/e2e/world.spec.ts
git commit -m "UI3a: Delphi - the Pythia's scrolls and the votive tablets as overlays, the prophecy on the altar

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/lib/world/scenes/delphi.shapes.ts web/src/lib/world/scenes/delphi.ts web/src/lib/world/scenes/delphi.test.ts web/src/lib/world/scenes/index.ts web/src/lib/world/scenes/camp.ts web/src/lib/world/scenes/camp.test.ts web/src/screens/Delphi.svelte web/src/screens/Oracle.svelte web/src/screens/QuestBoard.svelte web/src/components/places/delphi/PythiaPanel.svelte web/src/components/places/delphi/TabletsPanel.svelte web/src/App.svelte web/e2e/scenes-delphi.spec.ts web/e2e/scenes-camp.spec.ts web/e2e/world.spec.ts
```

### Task 13: UI3a review walk (iPad screenshots, `?debug` shots) and the full gate

**Files:**
- Create: `web/e2e/playability-ui3.spec.ts`
- Create (generated): `docs/reviews/ui3/ipad-landscape-a*.png`, `docs/reviews/ui3/ipad-portrait-a01-rotate-screen.png`

**Interfaces:**
- Consumes: every helper of Tasks 2, 8, 9 (`expectScene`, `enterTitle`, `closeOverlay`, `expectCamp`, `skipOnboarding`, `stubSpeech`, `createText`, `redScan`, `waitForSceneSettled`); `web/playwright.playability.config.ts` (projects `ipad-landscape` 1180×820, `ipad-portrait` 820×1180).
- Produces: `web/e2e/playability-ui3.spec.ts` with `interface Walk { page: Page; project: string; profileId: number; heroName: string; notes: string[] }`, `const SECTIONS: { name: string; run: (w: Walk) => Promise<void> }[]` and `const DEBUG_SHOTS: { hash: string; sceneId: string; name: string }[]` — UI3b Task 9 appends its sections and debug shots to these two arrays.

- [ ] **Step 1: Write the walk**

`web/e2e/playability-ui3.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test';
import { closeOverlay, createText, enterTitle, expectCamp, expectScene, redScan, skipOnboarding, stubSpeech, waitForSceneSettled } from './helpers';

// UI3 playability walk (scenes spec §10): iPad-size screenshots of every place and overlay into
// docs/reviews/ui3/<project>-<id>-<name>.png for the Opus playability/immersion review ("does
// anything still look like a school form?"), then one `?debug` screenshot per scene to check the
// hand-authored hotspots against their landmarks (docs/art/scenes.md). UI3a: title, library tent,
// Delphi. UI3b appends its sections to SECTIONS and DEBUG_SHOTS.
// Run: scripts/playwright.sh --config playwright.playability.config.ts playability-ui3

const OUT = '/work/docs/reviews/ui3';

interface Walk {
  page: Page;
  project: string;
  profileId: number;
  heroName: string;
  notes: string[];
}

async function shot(w: Walk, name: string, settleMs = 900) {
  // Longer than the 450 ms scene zoom-in and the 280 ms overlay slide.
  await w.page.waitForTimeout(settleMs);
  await w.page.screenshot({ path: `${OUT}/${w.project}-${name}.png` });
}

async function noRed(w: Walk, where: string) {
  const red = await redScan(w.page);
  if (red.length) w.notes.push(`RED at ${where}: ${red.join(', ')}`);
  expect(red, where).toEqual([]);
}

async function skipGreeting(w: Walk) {
  await waitForSceneSettled(w.page);
  const skip = w.page.getByTestId('dialogue-skip');
  if (await skip.count()) await skip.click();
  await expect(w.page.getByTestId('dialogue-box')).toHaveCount(0);
}

async function titleSection(w: Walk) {
  const { page } = w;
  await page.goto('/');
  await expectScene(page, 'title');
  await shot(w, 'a01-title-gate');
  await noRed(w, 'title');
  await enterTitle(page);
  await shot(w, 'a02-title-shields');
  await page.getByTestId('title-new').click();
  await expect(page.getByTestId('overlay-hero-new')).toBeVisible();
  await page.getByLabel('Ton prénom').fill(w.heroName);
  await page.getByTestId('overlay-hero-new').locator('label.avatar-choice', { hasText: 'Lyre' }).click();
  await page.getByLabel('Ton niveau').selectOption('10H');
  await shot(w, 'a03-title-naming-ritual');
  await noRed(w, 'naming ritual');
  await page.getByRole('button', { name: 'Rejoindre le camp' }).click();
  await expectCamp(page);
  w.profileId = Number(page.url().match(/#\/p\/(\d+)\//)?.[1]);
  expect(w.profileId).toBeGreaterThan(0);
  await skipOnboarding(page);
  await skipGreeting(w);

  // A protected hero's sealed parchment.
  const res = await page.request.post('/api/profiles', { data: { name: `${w.heroName}-code`, avatar: 'trident', level: '10H', pin: '4321' } });
  const locked = (await res.json()).id as number;
  await page.goto(`/#/p/${locked}/camp`);
  await expect(page.getByTestId('pin-gate')).toBeVisible();
  await shot(w, 'a04-title-pin-seal');
  await noRed(w, 'pin seal');
}

async function librarySection(w: Walk) {
  const { page } = w;
  await page.goto(`/#/p/${w.profileId}/camp`);
  await expectCamp(page);
  await page.getByTestId('camp-parchemins').click();
  await expectScene(page, 'library');
  await expect(page.getByTestId('dialogue-box')).toBeVisible();
  await shot(w, 'a05-library-owl-greeting');
  await skipGreeting(w);
  await shot(w, 'a06-library-tent');
  await noRed(w, 'library tent');
  await page.getByTestId('library-shelves').click();
  await expect(page.getByTestId('overlay-shelves')).toBeVisible();
  await shot(w, 'a07-library-shelves');
  await noRed(w, 'shelves');
  await closeOverlay(page);
  await page.getByTestId('library-desk').click();
  await expect(page.getByTestId('overlay-desk')).toBeVisible();
  await page.getByLabel('Titre').fill('Les fées de la clairière');
  await page.getByLabel('Texte').fill('Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.');
  await shot(w, 'a08-library-desk');
  await noRed(w, 'desk');
  await closeOverlay(page);
  await page.getByTestId('library-lens').click();
  await expect(page.getByTestId('overlay-lens')).toBeVisible();
  await shot(w, 'a09-library-lens');
  await closeOverlay(page);
  await page.getByTestId('library-portal').click();
  await expect(page.getByTestId('overlay-portal')).toBeVisible();
  await shot(w, 'a10-library-portal');
  await page.getByTestId('overlay-portal').getByTestId('work-card').first().click();
  await expect(page.getByTestId('overlay-portal-work')).toBeVisible();
  await shot(w, 'a11-library-portal-work');
  await noRed(w, 'portal');
  await closeOverlay(page);
  await closeOverlay(page);
  await page.getByTestId('scene-exit').click();
  await expectCamp(page);
}

async function delphiSection(w: Walk) {
  const { page } = w;
  const due = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  await createText(page.request, {
    title: 'La dictée du jeudi',
    body: 'Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.',
    level: '10H',
    due_date: due,
  });
  await page.goto(`/#/p/${w.profileId}/camp`);
  await expectCamp(page);
  await page.getByTestId('camp-oracle').click();
  await expectScene(page, 'delphi');
  await expect(page.getByTestId('dialogue-box')).toBeVisible();
  await shot(w, 'a12-delphi-pythia-greeting');
  await skipGreeting(w);
  await shot(w, 'a13-delphi-temple');
  await noRed(w, 'delphi');
  await page.getByTestId('delphi-pythia').click();
  await expect(page.getByTestId('overlay-pythia')).toBeVisible();
  await shot(w, 'a14-delphi-pythia-scrolls', 1200);
  await page.getByTestId('scroll-ecole').getByTestId('scroll-open').click();
  await expect(page.getByTestId('oracle-monster-hydre')).toBeVisible();
  await shot(w, 'a15-delphi-ecole-picker');
  await page.getByTestId('oracle-cancel').click();
  await closeOverlay(page);
  await page.getByTestId('delphi-tablets').click();
  await expect(page.getByTestId('overlay-tablets')).toBeVisible();
  await shot(w, 'a16-delphi-tablets');
  await noRed(w, 'tablets');
  await closeOverlay(page);
}

const SECTIONS: { name: string; run: (w: Walk) => Promise<void> }[] = [
  { name: 'title', run: titleSection },
  { name: 'library', run: librarySection },
  { name: 'delphi', run: delphiSection },
];

// One `?debug` screenshot per scene: the outlines, the safe zone, the HUD band and the dialogue
// dock over the art (UI1 Ruling 9). A new document each (location.search changes).
const DEBUG_SHOTS: { hash: string; sceneId: string; name: string }[] = [
  { hash: '/', sceneId: 'title', name: 'd01-debug-title' },
  { hash: '/p/{id}/tente-parchemins', sceneId: 'library', name: 'd02-debug-library' },
  { hash: '/p/{id}/temple', sceneId: 'delphi', name: 'd03-debug-delphi' },
];

test('UI3 playability walk', async ({ page }, testInfo) => {
  test.setTimeout(600_000);
  const project = testInfo.project.name;
  const w: Walk = { page, project, profileId: 0, heroName: `Ariane-${project}`, notes: [] };
  const origins = new Set<string>();
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (url.protocol === 'http:' || url.protocol === 'https:') origins.add(url.origin);
  });
  await stubSpeech(page);
  try {
    if (project === 'ipad-portrait') {
      await page.goto('/');
      await expect(page.getByTestId('rotate-screen')).toBeVisible();
      await shot(w, 'a01-rotate-screen');
      return;
    }
    for (const s of SECTIONS) {
      w.notes.push(`section ${s.name}`);
      await s.run(w);
    }
    for (const d of DEBUG_SHOTS) {
      await page.goto(`/?debug#${d.hash.replace('{id}', String(w.profileId))}`);
      await expectScene(page, d.sceneId);
      await expect(page.getByTestId('hotspot-debug')).toBeVisible();
      await shot(w, d.name, 400);
    }
  } finally {
    w.notes.push(`request origins: ${JSON.stringify([...origins])}`);
    console.log(`\n===== NOTES ${project} =====\n${w.notes.join('\n')}\n`);
  }
  // Spec §2.7: no runtime third-party request (fonts, CDNs...).
  expect([...origins]).toEqual([new URL(String(testInfo.project.use.baseURL)).origin]);
});
```

(The avatar label text comes from `avatarLabel('lyre')` = « Lyre ».)

- [ ] **Step 2: Run the walk**

Run: `mkdir -p docs/reviews/ui3 && scripts/playwright.sh --config playwright.playability.config.ts playability-ui3`
Expected: 2 passed (`ipad-landscape`, `ipad-portrait`); `docs/reviews/ui3/` holds `ipad-landscape-a01…a16-*.png`, `ipad-landscape-d01…d03-debug-*.png` and `ipad-portrait-a01-rotate-screen.png`.

- [ ] **Step 3: Look at every screenshot**

Open each PNG with the image viewer (the Read tool shows images). Check, and fix in the owning task's files before going on:
- every `?debug` outline hugs its landmark (gate doors; shelves, desk, lens, portal arch; the Pythia, the tablet wall) — if not, adjust that scene's `*.shapes.ts` within ±2 % and rerun;
- no plaque floats over empty sky or overlaps another plaque; the dialogue box covers no place;
- overlays read as in-world objects (parchment, bronze, marble), with no white form box left.
Write what you checked, and anything left for the Opus playability review, in your task report (not in a file).

- [ ] **Step 4: The full gate**

Run: `scripts/check.sh`
Expected: ends with `== ALL GREEN` (pytest, svelte-check 0 errors / 0 warnings, vitest incl. the no-emoji guard, docker build, Playwright desktop + ipad).

- [ ] **Step 5: Commit**

```bash
git add web/e2e/playability-ui3.spec.ts docs/reviews/ui3
git commit -m "UI3a: review walk with iPad screenshots and ?debug hotspot shots for title, library, Delphi

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/e2e/playability-ui3.spec.ts docs/reviews/ui3
```

---

## Self-review (UI3a)

- **Spec coverage.** §2.2 overlays → Tasks 2, 9–12 (every secondary screen is an `Overlay` on its place). §2.3 routing → Task 1 (A1 table: no route removed, two added, every overlay routed; Back/reload/deep link tested in Tasks 8–12). §2.4 forms → Tasks 3, 8, 10 (real inputs, `.kit-form`, Literata in textareas). §2.5 dialogue → Tasks 9, 12 (owl, Pythia; static lines). §3 Title/Library/Delphi rows + parity → Parity map, Tasks 8–12. §4 stage, safe zone, `?debug`, tilt, reduced motion, preload, budget → Tasks 2, 7, 8 (tilt), 9–12 (`expectInSafeZone`, debug outlines), 12 (preload), budget test extended through `SCENES`. §6 look → Tasks 3, 4, 6. §10 gates → per-scene e2e on `desktop` + `ipad`, Task 13 (screenshots + `scripts/check.sh`). CLAUDE.md no emoji + coordinator requests (icon map, Medallion, reward icons everywhere, lieutenant one source, avatars, tools now, TopBar via shared SVG, CSS leaves, guard test) → Tasks 4–6 and the inventory table.
- **Placeholder scan.** No "TBD"/"similar to"; the two places where an implementer may tune numbers (shapes ±2 %, altar card) name the file, the bound and the check to rerun.
- **Type consistency.** `PanelId` values (`tous`, `nouveau`, `heros`, `etageres`, `pupitre`, `loupe`, `portail`, `oeuvre`, `pythie`, `tablettes`) are the same in Task 1 and in `Title`, `LibraryTent`, `Delphi`. `HotspotDef.target: RouteName | null`, `params`, `query`, `icon`, `leader`, `LabelPos` (Task 2) are what Tasks 8–12 use. `Hotspot` props `onActivate/onPress/onLocked` (Task 2) match Task 8's gate. `openPanel/closePanel/heroPanelHref/hotspotHref` signatures match their callers. `Medallion` `rewardId` (Task 4) matches Cabin, ProgressionReveal, Lieutenant, Scroll, Boss. `ART.icons.*`, `rewardIcon`, `avatarIcon`, `lieutenantIcon`, `rewardKindOf`, `TOOL_ICONS`, `ADD_ICONS`, `MARK_ICONS` (Task 4) match Tasks 5, 6, 8, 9. `Icon` names (Task 6) match every use.
