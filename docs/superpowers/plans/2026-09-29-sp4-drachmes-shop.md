# La Discorde — Sub-project 4 "Drachmes, Hermès's stall, the house, the dragon's accessories" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Something to choose and save up for. Every session, quest, weekly goal, seal and Éris fight pays drachmes (a ledger, like XP, but spendable; every hero starts with a tenth of the XP already won). Hermès keeps a stall painted into the camp: the dragon's 24 accessories (each on sale from its lieutenant's seal: cou bronze, queue argent, dos or, tête orichalque), the villa and the palais (from the adult and the illustre dragon), and four new pieces of decor. The balance shows on the HUD, at the stall and on the victory (« +12 drachmes »). The cabin becomes the highest house owned, with more wall slots (4, 6, 9). The nest's care panel dresses the dragon (one piece per slot), and the dragon wears its pieces, untinted, in the camp, the nest, the battle and the victory.

**Architecture:** Server first (pure rules, then the wiring), then the art without the accessories, then the client in four surfaces (the purse, the stall, the dressed dragon with the accessory art, the house), then the README and the gate.
- Server (`server/app`): `world/drachmes.py` (defaults, what a session earns, the ledger), `world/shop.py` (prices, what is on sale, the house, the worn pieces, the catalogue served to the client), `catalog.py` (24 `accessory:<lt>-<slot>` rewards, four shop decor, two houses), `rules.py` (`drachmes`, `prices`), migration `007_drachmes.sql` (`drachme_event`, the starting grant), `progression.py` (the session's drachmes), `routers/world.py` (`POST /purchases`, the camp's `drachmes`/`house`/`dragon.worn`, `/api/world` `shop`, one accessory per slot and the walls per house in `PATCH /rewards`).
- Client (`web/src`): `lib/world/shop.ts` (the stall's shelves and words), `lib/world/accessories.ts` + the bundled manifest `lib/world/accessories.json` (the overlays' geometry), `components/DragonFigure.svelte` (a tinted picture with untinted overlays), `components/places/camp/StallPanel.svelte`, the care panel's « Sa parure », the HUD's purse, the victory's drachme chip, the house scenes (`VILLA_SCENE`, `PALAIS_SCENE`) with their own hotspots and decor slots, Hermès as a speaker with his content file `content/dialogue/stall.json`.

**Tech Stack:** Svelte 5 (runes) + TypeScript + Vite 7, vitest 5 (node env, no component rendering: logic that needs a unit test lives in a pure `.ts` module), Playwright 1.63 (WebKit `desktop` 1280×720 and `ipad` 1180×820 touch, which runs `scenes-*.spec.ts`), FastAPI + pydantic 2 + SQLite (numbered SQL migrations), pytest. No new dependency.

**Spec:** `docs/superpowers/specs/2026-09-29-drachmes-shop-design.md` is binding (§1 drachmes, §2 the stall, §3 the house, §4 dressing the dragon, §5 data, §6 testing). Context: `docs/superpowers/specs/2026-09-29-progression-roadmap.md`, `docs/superpowers/specs/2026-09-29-art-design.md` (Phase 3: the interiors, the stall, Hermès, the icons; Phase 4: the 96 overlays and their manifest; the web budget raised deliberately, written as a number), `docs/superpowers/specs/2026-09-29-lieutenant-levels-design.md` (levels 2-5 put the accessories on sale; `levels_of()` and `lieutenants[].level` are the API). House style and starting state: `docs/superpowers/plans/2026-09-29-sp1-scoring-xp.md`, `docs/superpowers/plans/2026-09-29-sp3-dragon-growth.md`, `docs/superpowers/plans/2026-09-29-sp2-lieutenant-levels.md`. Landmarks of the interiors and the stall: `docs/art/style-guide.md`, "Progression redesign, phase 3". Repo-root `CLAUDE.md` is binding for every agent: no "pre-existing" problems, tests and `svelte-check` clean with zero errors and zero warnings, no emoji anywhere player-visible.

## Dependencies and batching

Execution is subagent-driven and **sequential**, in the worktree `C:\Users\nicol\IdeaProjects\school-playground\.claude\worktrees\art-skills` (branch `worktree-art-skills`, `STACK=prog`). Each task starts from the previous task's commit; a reviewer gates each task before the next one starts.

**Precondition: sub-projects 1, 3 and 2 are complete on this branch (in that order).** Before Task 1 the controller runs, from the worktree root in Git Bash:

```bash
git log --oneline -300 | grep -cE "README: the five review aids|README: the dragon grows from XP|README: the lieutenants' five seals"
ls server/app/world/dragon.py server/app/world/seals.py server/app/world/fights.py server/app/migrations/006_seals.sql web/src/lib/world/seals.ts web/public/art/trophies/trophy-hydre-1.webp web/public/art/dragon/dragon_ancestral_cut.webp
ls server/app/migrations
test -e server/app/world/mastery.py && echo "mastery.py STILL THERE"
grep -rnE "RELIC_OF|rank_for|\bRANKS\b|neutralised_set|mastery_window|stirring|next_stage_at" web/src server/app
grep -n "def levels_of" server/app/world/seals.py
```

Expected: `3`; every file listed; the migrations end at `006_seals.sql`; no « STILL THERE »; the grep over removed symbols prints nothing; `def levels_of` found. **If any check fails, stop and report.** This plan is written against the code those sub-projects leave (quoted from their plans): `rules.py` with `dragon_stages`, `levels`, `fights`; `app.world.dragon` with `STAGE_ORDER` and `stage_index`; `app.world.seals` with `levels_of(conn, pid) -> dict[str, int]` and `lieutenants_for_level(level)`; `dragon_out(conn, profile, now, rules)`; `get_camp(profile_id, request, db)`; `apply_progression` whose bonuses carry `{"reason": "level", "amount", "lieutenant", "level"}` for a seal; `camp.xp = {total, floor, next}`; `lieutenants[].level`; `DRAGON_STAGES` in `lib/world/types.ts`; `sealTitleOf`, `sealName` in `lib/world/seals.ts`; `isAwake`, `lieutenantName` in `lib/world/eris.ts`; `thousands` in `lib/text/french.ts`; the victory's XP chips (`data-testid="xp-chip"`, `bonusChipLabel`); `ART.trophies`; the non-scene art budget of 3.5 MiB in `art.test.ts`; `RewardKind = 'trophy' | 'tint' | 'gear' | 'decor'`. Where this plan quotes code those sub-projects wrote, it names the block by its role; match it by meaning, not by line number. Test helpers reused from them: `give_xp`, `set_stage` (`server/tests/test_dragon.py`), `seal`, `won`, `LONG` (`server/tests/test_seals_api.py`), `hydre_result`, `post` (`server/tests/test_progression.py`), `_db_before` (`server/tests/test_db.py`).

| # | Task | Recommended model | Why |
|---|---|---|---|
| 1 | Server foundation: `drachmes` and `prices` in the rules file, `world/drachmes.py` (earning rules), `world/shop.py` (on-sale rules, the house, the worn pieces, the served catalogue), the 24 accessories, 4 decor pieces and 2 houses in the catalogue (nothing wired) | sonnet | Pure rules and pytest, fully specified. |
| 2 | Server wiring: migration 007 (ledger, starting grant), a session pays its drachmes, `POST /purchases`, the camp's `drachmes`/`house`/`dragon.worn`, `/api/world` `shop`, one accessory per slot and the walls per house in `PATCH /rewards` | opus | Transactions under the write lock, a race test, changes to two existing endpoints. |
| 3 | Art without the accessories: the camp with its stall (in place of `hub_camp.webp`), the villa and the palais, Hermès, the drachme and four decor icons; the art map, the decor icons and their « how to win » sentences, the reward kinds `accessory`/`house` | sonnet | Mechanical with one measurement. |
| 4 | The purse: client types and API, `lib/world/shop.ts` (shelves and words), the HUD's drachmes next to the XP laurel, the victory's « +12 drachmes » chip | opus | The HUD's centre is measured by several scene specs; a saved victory without drachmes. |
| 5 | Hermès's stall: the camp hotspot, `?panel=etal`, Hermès as a speaker, `content/dialogue/stall.json`, `StallPanel.svelte` (three shelves, states, one confirmation, the purchase) | opus | Layout on the painted stall (safe zone, plaque overlaps), copy, the purchase flow. |
| 6 | Dressing the dragon: the 96 overlays and the merged manifest, the raised art budget, `DragonFigure` in the camp, the nest, the battle and the victory, the care panel's « Sa parure »; e2e earn → buy → wear → see it in the camp | opus | Art gate, manifest math, four renderers, the optimistic swap. |
| 7 | The house: the villa's and the palais's hotspots and decor slots, the cabin place showing the highest house, the place's name, the walls per house on the client; e2e buy the villa and hang a sixth piece | opus | Hotspot and slot placement on two new paintings. |
| 8 | README (drachmes, the stall, the house, the parure, `drachmes`/`prices` in the rules file) and the full gate | opus | The gate may surface cross-task fixes that need judgment. |

**Art.** Staged by the art track, never in `web/public/art` before the task that wires it (`art.test.ts` requires every mapped file to exist and to stay within budget; `artReferenced.test.ts` rejects an unreferenced scene):
- Task 3: `assets/art/export/scenes/hub_camp_stall.webp` (304 KB; the camp with the stall, everything else pixel-identical; stall bounding box x 0.105-0.218, y 0.208-0.448), `assets/art/export/scenes/villa.webp` (255 KB), `assets/art/export/scenes/palais.webp` (323 KB), `assets/art/export/characters/hermes_cut.webp` (64 KB), `assets/art/export/icons/{drachme,decor-amphore,decor-chouette,decor-mosaique,decor-bouclier}.webp` (all under 17 KB). All present at the time of writing (commits `c0d34ef`, `de3ee35`, `d72489a`).
- Task 6: `assets/art/export/dragon/accessories/<lt>-<slot>_<stage>.webp` for lt ∈ hydre, echo, chimere, protee, sirenes, lethe; slot ∈ cou, queue, dos, tete; stage ∈ young, adult, illustre, ancestral (96 files), and one manifest fragment per lieutenant `assets/art/export/dragon/accessories/<lt>.json` = `{ "<lt>-<slot>": { "<stage>": {"src": "<webp file name>", "x": fx, "y": fy, "w": fw, "h": fh} } }` (fractions of the 1024 px stage picture, written by `tools/art/overlay.py crop`). **Being produced while this plan is written**: Task 6's first step checks all 102 files and stops if any is missing.

Playwright runs are serialised machine-wide by the lock in `scripts/playwright.sh` (`with_playwright_lock`, `scripts/lib.sh`); the art agents' Forge and segmentation batches take the same lock (`tools/art/with_lock.sh`), so a queued e2e run is waiting for them, not hanging. Never read Forge's files.

## Global Constraints

- **Drachmes (spec §1), verbatim:** "XP is never spent; drachmes are." Earned (defaults, all in `data/regles.json` `drachmes`): a session round(session XP ÷ 10); a board quest 5; an Oracle quest 15; the weekly goal 5; a lieutenant level L 10 × L; an Éris fight won 30. "A ledger table `drachme_event(profile_id, amount, reason, ref, created_at)` like `xp_event`; the balance is its sum and can never go below zero (a purchase is refused with 409 when short). At migration every profile receives a starting grant of floor(total XP ÷ 10) (reason `grant`), so existing play is rewarded. The balance shows on the HUD next to the XP gauge (the drachme coin icon and the number) and at the stall. The victory's chips add « +N drachmes »."
- **The stall (spec §2), verbatim:** "A new camp hotspot on the stall painted into the camp background […], labelled « L'étal d'Hermès », opening a place panel with the Hermès cut-out and three shelves": « Parures du dragon » (the 24 accessories grouped by lieutenant; "on sale once its lieutenant reaches its level (cou 2, queue 3, dos 4, tête 5); before that it shows its silhouette and « Au sceau de bronze de l'Hydre » in words. Protée's set appears from 8H."), « La maison » (« La villa » on sale once the dragon is adult, « Le palais » once illustre and after the villa), « Décor » (« Amphore peinte », « Chouette de marbre », « Mosaïque des Muses », « Bouclier d'apparat »). Prices (rules file `prices`): accessories 40 / 60 / 90 / 130 for cou / queue / dos / tête; decor 50 each; the villa 300, the palais 800. "Buying asks one confirmation (« Acheter la couronne de pavots pour 130 drachmes ? »), then Hermès says a line (content file, ≥ 3 variants) and the item is owned (a `reward` row, kinds `accessory`, `decor`, `house`). Hermès never pushes: no discount, no timer, no « dernière chance »."
- **The house (spec §3):** the cabin place shows the highest owned interior, `cabin`, `villa`, `palais`, each with its own hotspot shapes and decor slots; decor slots cabane 4, villa 6, palais 9 (`MAX_DISPLAYED_DECOR` per interior, server and client); the place's name « Ta cabane », « Ta villa », « Ton palais ».
- **Dressing (spec §4):** « Parure » in the nest's care panel: four slots (cou, queue, dos, tête), each with the owned pieces and « Rien »; one piece per slot, saved on the server (`reward.equipped`, one per slot enforced). `Dragon.svelte` (and every dragon drawing, R19) draws the equipped overlays over the tinted dragon, **unfiltered**, from the manifest (per item and stage: the cropped WebP and its offset, as fractions); overlays from `young` on (kept but not drawn on the egg and the hatchling); draw order queue, dos, cou, tête. Dialogue portraits use the cut-out without overlays.
- **Data (spec §5):** migration **007**: `drachme_event`, the starting grant. Reward kinds `accessory`, `house`, new decor ids; `catalog.py` lists items with slot, lieutenant, level, price.
- **Toolchain (verified against `scripts/` on 2026-09-30):** no host Node and no host Python for the project (the art tools under `tools/art/` run on the host `python`, stdlib only for this plan's one script). From the worktree root, in Git Bash:
  - `scripts/pytest.sh -q <paths relative to server/>` (e.g. `scripts/pytest.sh -q tests/test_shop.py`; it runs in `server/`);
  - `scripts/npm.sh run test -- <paths relative to web/>` (vitest, focused, e.g. `src/lib/world/shop.test.ts`);
  - `scripts/npm.sh run check` (svelte-check over `src`, then `tsc -p tsconfig.e2e.json` over `e2e/`: must print `0 errors and 0 warnings` and tsc must print nothing);
  - `STACK=prog scripts/playwright.sh <spec-file-or-filter> [--project=desktop|ipad] [--repeat-each=3] [-g "<title>"]`;
  - `STACK=prog PW_WORKERS=4 scripts/check.sh` (the full gate: pytest, tts pytest, svelte-check + e2e tsc, vitest, both docker builds, all e2e, the real-voice spec).
  **This is a worktree: always set `STACK=prog`** for `playwright.sh` and `check.sh`. Do not run Docker or Playwright outside these wrappers.
- **Testing rules:** per task, run the focused vitest files, `scripts/npm.sh run check`, and the focused pytest files; run every **new or changed** e2e spec (or test, with `-g`) with `--repeat-each=3`; run every **touched but unchanged-in-intent** spec once. The full gate runs in Task 8. The crash-only retry (`scripts/playwright-crash-retry.mjs`) retries a named "browser crashed" failure once; any other failure is a real failure. A flake is a defect: root-cause it, never retry it away.
- **e2e robustness (8 workers by default, 4 in the gate):** import `test`/`expect` from `./crashGuard`; each test creates its own hero (`createProfileApi`) and its own text (`createText` with `uniqueName`); a finger on `ipad`, a mouse on `desktop` (`tap(locator, testInfo)`); no `waitForTimeout`; web-first assertions and `expect.poll`. Drachmes, seals and stages a test needs are **real**: sessions posted with `postSession` and the `X-Discorde-Day` test clock; `makeResult({ words: 1000, draft: 4, caught: 4 })` is worth about 318 XP and 32 drachmes, `words: 3000` about 910 XP and 91 drachmes (XP = 10 + words/10 + words/5 + 2 × caught; aids left: none, since `postSession` sends none unless asked). A stage that only matters for drawing (the egg keeping its pieces) may be set by intercepting this hero's `/api/profiles/{id}/camp` with `page.route`, scoped to the test's own hero id. The ledger, the prices and the on-sale rules themselves are pinned by pytest.
- **French copy:** every French string of this plan is used verbatim. In-world, warm, gender-neutral towards the player (no adjective or participle agreeing with her), no school register (`BANNED` in `web/src/testing/copyRules.ts`: « niveau », « réviser »…; a seal is its material), no guilt wording (`GUILT`), **no FOMO and no pushing**: no discount, no timer, no « dernière chance », no « vite », no « plus que », no count of days. Plurals through `plural()`. Typography: in TypeScript and Python strings U+202F (`\u202f`) before « : ; ! ? % » and in thousands (`thousands()`); in `content/dialogue/*.json` plain spaces (`content.test.ts` forbids U+00A0/U+202F there; `frenchSpacing()` adds them at display). Lines ≤ 170 characters, no `"`, no `...` (use `…`). Code, comments, docs and commit messages are in English.
- **No emoji (CLAUDE.md):** not in any string, badge or marker. The drachme is its painted coin (`/art/icons/drachme.webp`), a locked piece its dark silhouette, a house its painted room.
- **Guards that must stay green (vitest):** `noEmoji`, `registerGuard`, `noGuilt`, `formPlural`, `frenchSpacing`, `placesKit`, `artReferenced`, `app.css`, `lib/world/art.test.ts`, `lib/world/scenes/budget.test.ts` (600 KB per scene background), `lib/scene/validate.test.ts`, `lib/dialogue/content.test.ts`, `lib/world/rewards.test.ts`; server `tests/test_french_spacing.py`.
- **Commits:** on `worktree-art-skills`, shared with art agents and possibly another implementer. **Always** `git add <paths> && git commit -m "..." -- <paths>`; a `git mv`/`git rm` names both its paths in the commit. Never `git add -A`, `git stash`, `git reset`, `git checkout`, `git restore` of tracked work, `git clean`, or any history rewrite. If git reports `index.lock`, wait a few seconds and retry. End every message with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- **Verification:** run each task's commands and paste the real output (counts included) into the report. A failing, flaky or warning test anywhere is yours to fix or to report as an open item, never "pre-existing" (CLAUDE.md).

## Review Focus

The five failure modes the spec implies but its test list does not pin, most likely first. Each has its test in the owning task.

1. **The purse overdrawn by a race or a stale page.** Two taps on two « Acheter » (or two tablets on one hero) with 100 drachmes and four pieces of 40 or 50; a page that still shows 60 drachmes after spending them elsewhere. Expected: the balance is read and the purchase written inside one `BEGIN IMMEDIATE` transaction, so at most as many purchases succeed as the purse allows, the ledger never sums below zero, every refused one answers 409 with the short line, and the page refreshes the camp after any answer. Tests: Task 2 `test_purchases_racing_never_overdraw`, `test_a_purchase_is_refused_when_short_not_on_sale_owned_or_unknown`; Task 5 e2e `a purchase refused by the server says why and the purse refreshes`.
2. **Rounding and the grant.** Python's `round()` rounds halves to even (`round(2.5) == 2`): 25 XP must pay 3, 45 XP 5, 5 XP 1, 4 XP none; the grant is floor(XP ÷ 10) (1 239 XP → 123), none for a hero under 10 XP, never twice when the migration runner meets 007 again. Expected: integer half-up (`(2 × xp + d) // (2 × d)`), a zero part writes no ledger row, the grant runs once in migration 007. Tests: Task 1 `test_a_session_pays_its_xp_divided_by_ten_rounded_half_up`; Task 2 `test_migration_007_grants_a_tenth_of_the_xp`.
3. **What is on sale at the edges.** A lieutenant exactly at seal 2 (cou on sale, queue not); Protée at 7H with a seal row written by hand (nothing of his sold or shown); the palais at `ancestral` without the villa (refused); a hero whose stored stage is ahead of the XP (sub-project 3: an `adult` with 800 XP) buys the villa; a class moved down after buying Protée's collar (still owned and worn). Expected: the server decides on the stored stage (after `dragon_out`'s catch-up) and `levels_of()` over the lieutenants awake at the class; the client's shelves agree. Tests: Task 1 `test_an_accessory_is_on_sale_from_its_lieutenants_seal`, `test_the_houses_follow_the_dragon_and_each_other`; Task 2 `test_the_houses_in_order_on_the_stored_stage`; Task 4 `stallShelves` edge cases; Task 5 e2e `Protée's set appears from 8H`.
4. **Wearing: one per slot, the order, the tint, the small dragon.** Equipping Écho's pendant while the Hydra's collar is worn; « Rien »; a piece whose manifest entry is missing for a stage; an egg with a piece equipped; a tinted dragon (`braise`). Expected: the server unequips the other piece of the slot in the same transaction; `dragon.worn` lists the manifest keys in draw order queue, dos, cou, tête; the egg and the hatchling keep their pieces equipped but draw none; a missing entry is skipped, never a broken image; the overlay `img` has no CSS filter while the base picture keeps the tint's. Tests: Task 1 `test_the_worn_pieces_in_the_draw_order`; Task 2 `test_one_accessory_per_slot`; Task 6 `accessoryLayers`, `wornAfter`, the manifest fit test, e2e `the dragon wears its collar in the camp, untinted` and `the egg keeps its pieces without drawing them`.
5. **The walls and the name follow the house.** A hero with four pieces hung in the cabin buys the villa: the four stay, two more slots open; a seventh is refused in the villa (and a tenth in the palais); the server's limits and the client's slot lists agree; the camp's plaque and the scene's title follow the house (« Ta villa »), with the villa's own hotspots. Expected: `MAX_DECOR = {"cabin": 4, "villa": 6, "palais": 9}` on the server, `DECOR_SLOTS[house].length` on the client, a vitest that reads the server's line; the room picks its scene from `camp.house`. Tests: Task 2 `test_the_walls_hold_four_six_or_nine_pieces_by_house`; Task 7 `the slots agree with the server`, `each interior's slots sit on its bare wall`, e2e `buy the villa, hang a sixth piece`.

## Rulings taken by this plan (the spec is silent or ambiguous; do not re-ask)

- **R1 Ids and names.** Rewards: `accessory:<lt>-<slot>` (kind `accessory`; the manifest's item key is `<lt>-<slot>`), `decor:amphore`, `decor:chouette`, `decor:mosaique`, `decor:bouclier` (kind `decor`), `house:villa`, `house:palais` (kind `house`); source « L'étal d'Hermès »; granted with source `stall`. Slots in code `cou`, `queue`, `dos`, `tete`. Modules: server `world/drachmes.py`, `world/shop.py`; client `lib/world/shop.ts`, `lib/world/accessories.ts`.
- **R2 The rules file.** `drachmes` is an object of `xp_per_drachme` (a session pays round(XP ÷ it), a whole number from 1), `board`, `oracle`, `weekly`, `level` (× the seal), `boss` (whole numbers from 0); `prices` an object of `accessory` (an object of the four slots), `decor`, `villa`, `palais` (whole numbers from 0). A partial object keeps the other defaults; a wrong value is logged and its default kept; a value that is not an object keeps the whole built-in table. Read at start-up only. Prices reach the client through `/api/world` `shop`, never from `rules`.
- **R3 Earning.** At the end of `apply_progression` (after the weekly goal and the dragon), one ledger row per part, `ref = "session:<id>"`: `session` = half-up(session XP ÷ `xp_per_drachme`) of the session's own XP (`xp.total`, not the bonuses); then one part per bonus of the session: `board`, `oracle`, `weekly`, `boss` (a won fight: its quest's bonus) at their amounts, `level` = `level` × L (the part names its lieutenant and seal). A part of 0 writes nothing. `progression.drachmes = {earned, parts, balance}`.
- **R4 The grant.** Migration 007 inserts `(profile, floor(SUM(xp) / 10), 'grant', NULL, <the migration's time>)` for every profile with at least 10 XP; the divisor is fixed at 10 there (a migration runs once; later changes to `xp_per_drachme` do not re-grant).
- **R5 A purchase.** `POST /api/profiles/{id}/purchases {"item": "<reward id>"}`: 404 for an id that is not a stall item; then, under `begin_write`, in this order: already owned → 409 « Tu l'as déjà. »; not on sale → 409 « Hermès ne vend pas encore cet objet. »; balance below the price → 409 « Ta bourse n'est pas encore assez pleine pour cet objet. »; else a ledger row `(-price, 'purchase', item)` and the reward row (source `stall`, not equipped). 201 `{"reward": RewardOut, "drachmes": balance}`.
- **R6 On sale.** An accessory: its lieutenant is awake at the hero's class (Protée from 8H) and its seal ≥ the slot's (cou 2, queue 3, dos 4, tête 5). Decor: always. The villa: stored stage ≥ `adult`. The palais: stored stage ≥ `illustre` and the villa owned. The stored stage is `dragon_out`'s (it catches up from XP first).
- **R7 Wearing.** `PATCH /rewards/{id} {"equipped": true}` on an accessory unequips the other accessories of its slot in the same transaction (a swap, 200); `false` takes it off (« Rien »). A house cannot be put on display: 409 « Ta maison n'est pas un objet à exposer. ». `dragon.worn` (every `DragonOut`) is the list of equipped accessories as manifest keys, in draw order. An accessory is worn at any class (a class moved down keeps it).
- **R8 The house.** `house_of(owned)`: `palais` if `house:palais` is owned, else `villa` if `house:villa`, else `cabin`; served as `camp.house`. `MAX_DECOR = {"cabin": 4, "villa": 6, "palais": 9}` replaces `MAX_DISPLAYED_DECOR` in `routers/world.py`; the walls-full line is unchanged.
- **R9 The served catalogue.** `/api/world` gains `shop` = `{slots, slot_levels, draw_order, accessories: [{id, item, lieutenant, slot, level, price, the}], decor: [{id, price, the}], houses: [{id, key, stage, after, price, the}], max_decor}`; `the` is the item with its article for the confirmation (« la couronne de pavots »). Names and descriptions stay in `rewards`.
- **R10 The stall is a camp overlay.** `#/p/:id/camp?panel=etal` (`PanelId` `etal`, `OVERLAY_TITLES.etal = "L'étal d'Hermès"`), opened from the camp hotspot `stall` with `go(path, 'panel')` (no night fade: the player stays in the camp), variant `table`, size `wide`, `testId="overlay-stall"`. Hermès's cut-out stands at the head of the panel, beside the purse (« Ta bourse : 254 drachmes »); his voice plate speaks `stall.enter`, then `stall.bought.<kind>` after a purchase.
- **R11 The stall's shelves.** « Parures du dragon » (one group per lieutenant awake at the class, in camp order, headed by its name, four pieces in slot order), « La maison » (villa, palais), « Décor » (the four pieces). A piece shows its picture (an accessory: its overlay at the dragon's stage, `adult`'s before `young`; decor: its icon; a house: its painted room), its name, its price with the coin, and one of: owned « À toi »; on sale and affordable « Acheter »; on sale and short « Encore 12 drachmes à gagner. » (no button); not on sale: the picture as a dark silhouette and the words « Au sceau de bronze de l'Hydre » / « Quand ton dragon sera adulte. » / « Quand ton dragon sera illustre. » / « Après la villa. » / « Quand ton dragon sera illustre, après la villa. ». Before 8H Protée's group is absent.
- **R12 One confirmation, in place.** « Acheter » turns the piece's cubby into the question « Acheter la couronne de pavots pour 130 drachmes ? » with « Acheter » and « Non, merci » (the cubby keeps the focus; no second dialog over the overlay). A refused purchase shows the server's line in the panel and refreshes the camp.
- **R13 Hermès speaks** as the speaker `hermes` (« Hermès », portrait `hermes_cut.webp`) from `content/dialogue/stall.json`: `stall.enter`, `stall.bought.accessory`, `stall.bought.decor`, `stall.bought.house`, four lines each; he never names a price, a delay or a scarcity.
- **R14 The HUD's purse** sits in the HUD's centre, right of the XP laurel: the coin (28 px) and the balance (`thousands()`), `data-testid="hud-drachmes"`, `aria-label` « 254 drachmes »; not in the battle's compact band (the laurel is not there either); it links to nothing.
- **R15 The victory's chip** « +12 drachmes » (the coin before it, `data-testid="drachme-chip"`) follows the XP chips when `progression.drachmes.earned > 0`; a victory saved before the change has no `drachmes` and shows no chip.
- **R16 The manifest is a bundled module.** The six fragments are merged by `tools/art/accessory_manifest.py` into `web/src/lib/world/accessories.json` (Vite cannot import a file from `public/`, and a synchronous import draws the first frame dressed); the 96 WebPs live in `web/public/art/dragon/accessories/`. An entry's `src` is a file name in that folder.
- **R17 The camp background is replaced in place.** `hub_camp_stall.webp` becomes `web/public/art/scenes/hub_camp.webp` (`git mv -f`): every reference, the preloads and the tests keep their path, nothing lingers. The painting's master stays `assets/art/scenes/hub_camp_stall.png` (the untouched `hub_camp.png` stays in `assets/` as the art track's source).
- **R18 The stall's hotspot.** `CAMP_SHAPES.stall` = `[[12.5, 21], [21.8, 21], [21.8, 40], [12.5, 40]]` (the stall's box clipped to the iPad safe zone on the left and above the dragon's head, which overlaps the counter below y 40), `labelPos: 'above'`, leader. If `labelOverlaps(page, 'camp')` then reports the plaque over the Oracle's box, the Oracle's two left points move from x 22.5 to x 24 (the temple's left steps), and nothing else.
- **R19 Where the dragon is dressed:** the camp (`SceneLayer`), the nest (`SceneLayer`), the battle (`Combatant`), the victory (`Dragon.svelte`), all through `DragonFigure.svelte`. Not on the HUD's small round portrait nor in the dialogue portraits (small and cropped, spec §4).
- **R20 « Sa parure »** (the care panel's section after « Sa teinte »): one row per slot, « Au cou », « À la queue », « Sur le dos », « Sur la tête », each a radio group of « Rien » and the owned pieces (picture and name); optimistic like the tints (reverts on an error). Before `young`: « Il portera sa parure dès qu'il sera un jeune dragon. » (the rows stay usable). No piece owned: « Hermès vend des parures à son étal, dans le camp. ».
- **R21 The house scenes.** `VILLA_SCENE` and `PALAIS_SCENE` are the cabin place with the id `cabin` (test ids, greeting, tour and music unchanged), their own background, title and hotspot shapes; `SCENES` keeps its seven places and `HOUSE_SCENES` lists the two new ones (budget and validation tests cover both lists). Until `/camp` has answered, the room shows the cabin (a cold reload of a villa owner shows the cabin for the time of one request: accepted, the places arrive from the camp, which has loaded it).
- **R22 The camp's plaque follows the house:** `HotspotState.label` (default `null`) overrides a hotspot's `label` when set; the camp's `cabin` hotspot sets « Ta cabane », « Ta villa » or « Ton palais ».
- **R23 The shop decor on the trophy shelf** says how to get it: « Hermès la vend à son étal. » (amphore, chouette, mosaïque), « Hermès le vend à son étal. » (bouclier).
- **R24 Budget.** Task 3 keeps the non-scene budget (3.5 MiB) and checks Hermès fits in it; Task 6 adds the 96 overlays to the total and raises the limit to the measured total rounded up to the next 0.5 MiB, the measured number written in the test's comment.

## File map

| File | Responsibility | Task |
|---|---|---|
| `server/app/world/drachmes.py` (new), `server/app/world/shop.py` (new), `server/tests/test_shop.py` (new) | earning, the ledger (1, 2); on-sale rules, house, worn, served catalogue | 1, 2 |
| `server/app/world/catalog.py` | 24 accessories, 4 decor, 2 houses, `SLOTS`, `SLOT_LEVEL`, `ACCESSORY_SETS` | 1 |
| `server/app/rules.py`, `server/tests/test_rules.py` | `drachmes`, `prices` | 1 |
| `server/app/migrations/007_drachmes.sql` (new), `server/tests/test_db.py` | the ledger, the grant | 2 |
| `server/app/world/progression.py` | the session's drachmes | 2 |
| `server/app/routers/world.py`, `server/app/schemas.py` | purchases, camp, world, rewards | 2 |
| `server/tests/test_drachmes_api.py` (new), `test_world_api.py`, `test_progression.py` | API tests | 2 |
| `web/public/art/scenes/{hub_camp,villa,palais}.webp`, `web/public/art/characters/hermes_cut.webp`, `web/public/art/icons/{drachme,decor-*}.webp` | art | 3 |
| `web/public/art/dragon/accessories/*.webp`, `web/src/lib/world/accessories.json`, `tools/art/accessory_manifest.py` (new) | accessory art and manifest | 6 |
| `web/src/lib/world/art.ts` (+ test), `web/src/lib/world/rewards.ts` (+ test) | the map, icons, kinds (3); the accessories in the budget (6) | 3, 6 |
| `web/src/lib/world/types.ts`, `web/src/lib/world/api.ts` | types, `buy` | 3, 4, 7 |
| `web/src/lib/world/shop.ts` (new, + test) | shelves, words | 4, 5 |
| `web/src/lib/scene/hud.ts` (+ test), `web/src/components/scene/Hud.svelte` | the purse | 4 |
| `web/src/components/battle/VictorySpoils.svelte` | the drachme chip (4); the dressed dragon (6) | 4, 6 |
| `web/src/lib/scene/types.ts`, `web/src/lib/dialogue/{types,content,speakers}.ts`, `content.test.ts`, `web/src/lib/world/voices.ts`, `content/dialogue/stall.json` (new) | Hermès | 5 |
| `web/src/lib/world/places.ts` (+ test), `web/src/lib/world/scenes/camp.ts`, `camp.shapes.ts` (+ test), `web/src/screens/Camp.svelte`, `web/src/components/places/camp/StallPanel.svelte` (new) | the stall | 5 |
| `web/src/lib/world/accessories.ts` (new, + test), `web/src/components/DragonFigure.svelte` (new), `web/src/components/Dragon.svelte`, `web/src/components/scene/SceneLayer.svelte`, `web/src/components/battle/Combatant.svelte`, `web/src/components/battle/BattleStage.svelte`, `web/src/screens/Nest.svelte`, `web/src/components/places/nest/CarePanel.svelte` | the dressed dragon | 6 |
| `web/src/lib/world/scenes/cabin.ts`, `cabin.shapes.ts`, `cabin.test.ts`, `index.ts`, `budget.test.ts`, `web/src/screens/CabinRoom.svelte`, `web/src/components/places/cabin/TrophiesPanel.svelte`, `web/src/components/scene/Hotspot.svelte` | the house | 7 |
| `web/e2e/scenes-stall.spec.ts` (new), `scenes-parure.spec.ts` (new), `scenes-house.spec.ts` (new), `scenes-camp.spec.ts`, `scenes-cabin.spec.ts`, `scenes-battle-victory.spec.ts`, `world.spec.ts` | e2e | 2, 4-7 |
| `docs/art/style-guide.md`, `docs/art/scenes.md` | the web homes of the phase 3-4 art | 3, 6 |
| `README.md` | the feature, the rules file | 8 |

---

### Task 1: Server foundation — the rules, the earning, the shop, the catalogue

**Files:**
- Create: `server/app/world/drachmes.py`, `server/app/world/shop.py`, `server/tests/test_shop.py`
- Modify: `server/app/rules.py`, `server/app/world/catalog.py`
- Test: `server/tests/test_rules.py`

**Interfaces:**
- Consumes: `LIEUTENANT_ORDER`, `OF_LIEUTENANT`, `REWARDS`, `_r` (`app/world/catalog.py`); `stage_index` (`app/world/dragon.py`); `_count`, `log` (`app/rules.py`).
- Produces:
  - `app.world.catalog`: `SLOTS = ("cou", "queue", "dos", "tete")`, `SLOT_LEVEL`, `ACCESSORY_SETS: dict[str, dict[str, tuple[str, str]]]` (name, name with its article), `accessory_id(key, slot) -> str`, `STALL = "L'étal d'Hermès"`; 24 `accessory:*` rewards, `decor:amphore|chouette|mosaique|bouclier`, `house:villa|palais` in `REWARDS`.
  - `app.world.drachmes`: `DEFAULT_DRACHMES`, `session_drachmes(xp: int, rules) -> int`, `earned_drachmes(session_xp: int, bonuses: list[dict], rules) -> list[dict]`.
  - `app.world.shop`: `DEFAULT_PRICES`, `default_prices()`, `SHOP_DECOR`, `HOUSES`, `MAX_DECOR`, `DRAW_ORDER`, `THE`, `parse_accessory(rid)`, `is_item(rid)`, `price_of(rid, rules)`, `house_of(owned)`, `on_sale(rid, *, owned, levels, awake, stage)`, `worn(equipped)`, `shop_catalog(rules)`.
  - `Rules.drachmes: dict[str, int]`, `Rules.prices: dict[str, Any]`, both in `as_dict()`.

- [ ] **Step 1: Write the failing rules tests** — `server/tests/test_rules.py`: import `DEFAULT_DRACHMES` from `app.world.drachmes` and `DEFAULT_PRICES` from `app.world.shop`; add to `DEFAULTS` (keep its existing keys exactly) `"drachmes": DRACHME_DEFAULTS, "prices": PRICE_DEFAULTS` with, above it:

```python
DRACHME_DEFAULTS = {"xp_per_drachme": 10, "board": 5, "oracle": 15, "weekly": 5, "level": 10, "boss": 30}
PRICE_DEFAULTS = {"accessory": {"cou": 40, "queue": 60, "dos": 90, "tete": 130}, "decor": 50, "villa": 300, "palais": 800}
```

and at the end of the file:

```python
# Spec 2026-09-29 drachmes §1, §2: what pays drachmes and what things cost live in the rules file.
def test_the_built_in_drachmes_and_prices_mirror_the_spec():
    assert DEFAULT_DRACHMES == DRACHME_DEFAULTS and DEFAULT_PRICES == PRICE_DEFAULTS


def test_drachmes_and_prices_from_the_file_keep_the_other_defaults(tmp_path):
    rules = load_rules(write(tmp_path, '{"drachmes": {"boss": 40, "xp_per_drachme": 8}, '
                                       '"prices": {"accessory": {"tete": 150}, "villa": 250}}'))
    assert rules.drachmes == {**DRACHME_DEFAULTS, "boss": 40, "xp_per_drachme": 8}
    assert rules.prices == {**PRICE_DEFAULTS, "accessory": {**PRICE_DEFAULTS["accessory"], "tete": 150}, "villa": 250}
    assert rules.as_dict() == {**DEFAULTS, "drachmes": rules.drachmes, "prices": rules.prices}
    assert Rules().prices["accessory"]["tete"] == 130          # the built-in table is never shared and changed


def test_a_wrong_drachme_or_price_value_is_logged_and_its_default_kept(tmp_path, caplog):
    text = json.dumps({"drachmes": {"xp_per_drachme": 0, "board": -1, "oracle": True, "weekly": 2.5, "gift": 3, "level": 12},
                       "prices": {"accessory": {"cou": "40", "aile": 10, "dos": 95}, "decor": -5, "villa": 1e3, "palais": 900,
                                  "tapis": 10}})
    with caplog.at_level(logging.WARNING):
        rules = load_rules(write(tmp_path, text))
    assert rules.drachmes == {**DRACHME_DEFAULTS, "level": 12}
    assert rules.prices == {**PRICE_DEFAULTS, "accessory": {**PRICE_DEFAULTS["accessory"], "dos": 95}, "palais": 900}
    for bit in ("'xp_per_drachme'", "'board'", "'oracle'", "'weekly'", "'gift'", "'cou'", "'aile'", "'decor'", "'villa'", "'tapis'"):
        assert bit in caplog.text, bit


def test_drachmes_or_prices_that_are_not_objects_keep_the_built_in_ones(tmp_path):
    assert load_rules(write(tmp_path, '{"drachmes": [5], "prices": 40, "chouette_hints": 2}')).as_dict() == {**DEFAULTS, "chouette_hints": 2}
    assert load_rules(write(tmp_path, '{"prices": {"accessory": 40}}')).prices == PRICE_DEFAULTS
```

(import `Rules` from `app.rules` if the file lacks it.)

- [ ] **Step 2: Write the failing shop tests** — `server/tests/test_shop.py`:

```python
"""Drachmes and Hermès's stall, the pure rules (spec 2026-09-29 drachmes §1-§5)."""
from app.rules import Rules
from app.world.catalog import REWARDS, SLOT_LEVEL, SLOTS, accessory_id
from app.world.drachmes import earned_drachmes, session_drachmes
from app.world.shop import (DRAW_ORDER, MAX_DECOR, SHOP_DECOR, THE, house_of, is_item, on_sale, parse_accessory, price_of,
                            shop_catalog, worn)

FIVE = ["hydre", "echo", "chimere", "sirenes", "lethe"]          # 5H to 7H
SIX = ["hydre", "echo", "chimere", "protee", "sirenes", "lethe"]  # from 8H


def lv(**levels):
    return {k: levels.get(k, 0) for k in SIX}


def test_twenty_four_accessories_one_set_of_four_per_lieutenant():
    ids = [k for k in REWARDS if k.startswith("accessory:")]
    assert len(ids) == 24 and ids[:4] == ["accessory:hydre-cou", "accessory:hydre-queue", "accessory:hydre-dos", "accessory:hydre-tete"]
    assert REWARDS["accessory:lethe-tete"] == {"id": "accessory:lethe-tete", "kind": "accessory", "name": "Couronne de pavots",
                                              "desc": "Une parure de Léthé, à porter sur la tête.", "source": "L'étal d'Hermès"}
    assert REWARDS["accessory:hydre-cou"]["desc"] == "Une parure de l'Hydre, à porter au cou."
    assert REWARDS["accessory:sirenes-queue"]["name"] == "Rubans de plumes"
    assert THE["accessory:lethe-tete"] == "la couronne de pavots" and THE["accessory:sirenes-queue"] == "les rubans de plumes"
    assert THE["accessory:hydre-queue"] == "l'anneau de serpents de bronze"
    assert parse_accessory("accessory:echo-dos") == ("echo", "dos")
    assert parse_accessory("accessory:echo-aile") is None and parse_accessory("accessory:medusa-cou") is None
    assert parse_accessory("decor:tapis") is None
    assert SLOTS == ("cou", "queue", "dos", "tete") and SLOT_LEVEL == {"cou": 2, "queue": 3, "dos": 4, "tete": 5}
    assert DRAW_ORDER == ("queue", "dos", "cou", "tete")


def test_the_shop_decor_and_the_two_houses():
    assert [REWARDS[d]["name"] for d in SHOP_DECOR] == ["Amphore peinte", "Chouette de marbre", "Mosaïque des Muses", "Bouclier d'apparat"]
    assert all(REWARDS[d]["kind"] == "decor" and REWARDS[d]["source"] == "L'étal d'Hermès" for d in SHOP_DECOR)
    assert (REWARDS["house:villa"]["name"], REWARDS["house:palais"]["name"]) == ("La villa", "Le palais")
    assert REWARDS["house:villa"]["kind"] == REWARDS["house:palais"]["kind"] == "house"
    assert MAX_DECOR == {"cabin": 4, "villa": 6, "palais": 9}
    assert house_of(set()) == "cabin" and house_of({"house:villa"}) == "villa" and house_of({"house:villa", "house:palais"}) == "palais"
    assert is_item("house:villa") and is_item("decor:bouclier") and is_item("accessory:echo-cou")
    assert not is_item("decor:tapis") and not is_item("egide") and not is_item("trophy:hydre:1")


def test_prices_come_from_the_rules():
    r = Rules()
    assert [price_of(accessory_id("hydre", s), r) for s in SLOTS] == [40, 60, 90, 130]
    assert (price_of("decor:amphore", r), price_of("house:villa", r), price_of("house:palais", r)) == (50, 300, 800)


# Review focus 3.
def test_an_accessory_is_on_sale_from_its_lieutenants_seal():
    kw = dict(owned=set(), awake=SIX, stage="young")
    assert on_sale("accessory:hydre-cou", levels=lv(hydre=2), **kw)
    assert not on_sale("accessory:hydre-queue", levels=lv(hydre=2), **kw)
    assert not on_sale("accessory:hydre-cou", levels=lv(hydre=1), **kw)
    assert on_sale("accessory:hydre-tete", levels=lv(hydre=5), **kw)
    # Protée's set appears from 8H: asleep at the class, nothing of his is sold, whatever the store says.
    assert not on_sale("accessory:protee-cou", levels=lv(protee=5), owned=set(), awake=FIVE, stage="young")
    assert on_sale("decor:amphore", levels={}, owned=set(), awake=FIVE, stage="egg")


def test_the_houses_follow_the_dragon_and_each_other():
    kw = dict(levels={}, awake=SIX)
    assert not on_sale("house:villa", owned=set(), stage="young", **kw)
    assert on_sale("house:villa", owned=set(), stage="adult", **kw)
    assert not on_sale("house:palais", owned=set(), stage="ancestral", **kw)         # after the villa
    assert not on_sale("house:palais", owned={"house:villa"}, stage="adult", **kw)
    assert on_sale("house:palais", owned={"house:villa"}, stage="illustre", **kw)


# Review focus 4.
def test_the_worn_pieces_in_the_draw_order():
    assert worn({"accessory:lethe-tete", "accessory:hydre-cou", "accessory:echo-queue", "decor:tapis"}) == ["echo-queue", "hydre-cou", "lethe-tete"]
    assert worn(set()) == []


def test_the_shop_catalog_served_to_the_client():
    c = shop_catalog(Rules())
    assert c["accessories"][0] == {"id": "accessory:hydre-cou", "item": "hydre-cou", "lieutenant": "hydre", "slot": "cou", "level": 2,
                                   "price": 40, "the": "le collier d'écailles vertes"}
    assert len(c["accessories"]) == 24 and [d["id"] for d in c["decor"]] == list(SHOP_DECOR)
    assert c["decor"][0] == {"id": "decor:amphore", "price": 50, "the": "l'amphore peinte"}
    assert c["houses"] == [{"id": "house:villa", "key": "villa", "stage": "adult", "after": None, "price": 300, "the": "la villa"},
                           {"id": "house:palais", "key": "palais", "stage": "illustre", "after": "house:villa", "price": 800,
                            "the": "le palais"}]
    assert c["slots"] == ["cou", "queue", "dos", "tete"] and c["draw_order"] == ["queue", "dos", "cou", "tete"]
    assert c["slot_levels"] == {"cou": 2, "queue": 3, "dos": 4, "tete": 5} and c["max_decor"] == {"cabin": 4, "villa": 6, "palais": 9}


# Review focus 2: Python's round() gives round(2.5) == 2; the purse rounds halves up.
def test_a_session_pays_its_xp_divided_by_ten_rounded_half_up():
    r = Rules()
    assert [session_drachmes(x, r) for x in (0, 4, 5, 25, 44, 45, 318)] == [0, 0, 1, 3, 4, 5, 32]


def test_every_source_pays_its_drachmes():
    bonuses = [{"reason": "board", "amount": 60}, {"reason": "oracle", "amount": 150}, {"reason": "boss", "amount": 300},
               {"reason": "weekly", "amount": 40}, {"reason": "level", "amount": 200, "lieutenant": "hydre", "level": 2},
               {"reason": "mystery", "amount": 9}]
    assert earned_drachmes(54, bonuses, Rules()) == [
        {"reason": "session", "amount": 5}, {"reason": "board", "amount": 5}, {"reason": "oracle", "amount": 15},
        {"reason": "boss", "amount": 30}, {"reason": "weekly", "amount": 5},
        {"reason": "level", "amount": 20, "lieutenant": "hydre", "level": 2}]
    assert earned_drachmes(3, [], Rules()) == []                                    # a zero part is no part
```

- [ ] **Step 3: Run them to see them fail**

Run: `scripts/pytest.sh -q tests/test_rules.py tests/test_shop.py`
Expected: FAIL (`ModuleNotFoundError: app.world.drachmes`).

- [ ] **Step 4: The catalogue** — `server/app/world/catalog.py`: inside the `REWARDS = {r["id"]: r for r in [ … ]}` list, after the `decor:fresque` entry, add (literals, so the client's art tests count them):

```python
    # Spec 2026-09-29 drachmes §2: Hermès's four pieces of decor and the two houses, sold at his stall.
    _r("decor:amphore", "decor", "Amphore peinte", "Un héros y court en figures noires, sans jamais s'arrêter.", "L'étal d'Hermès"),
    _r("decor:chouette", "decor", "Chouette de marbre", "La chouette d'Athéna veille sur tes parchemins, même la nuit.", "L'étal d'Hermès"),
    _r("decor:mosaique", "decor", "Mosaïque des Muses", "Trois Muses en petites tuiles\u202f: la lyre, le rouleau et le masque.", "L'étal d'Hermès"),
    _r("decor:bouclier", "decor", "Bouclier d'apparat", "Un bouclier de bronze poli, orné de Pégase. Il brille plus qu'il ne protège.", "L'étal d'Hermès"),
    _r("house:villa", "house", "La villa", "Des murs peints d'une frise, deux fenêtres, et de la place pour six décors.", "L'étal d'Hermès"),
    _r("house:palais", "house", "Le palais", "Des colonnes, un sol de mosaïque, une cour sous les arcades, et de la place pour neuf décors.", "L'étal d'Hermès"),
```

and after sub-project 2's trophies block (it defines `OF_LIEUTENANT`):

```python
# Spec 2026-09-29 drachmes §2, §4 (art spec Phase 4): the dragon's accessories, one set of four per
# lieutenant, each piece on sale from its lieutenant's seal (cou bronze, queue argent, dos or, tête
# orichalque). Each entry: the name, and the name with its article (the stall's confirmation).
STALL = "L'étal d'Hermès"
SLOTS = ("cou", "queue", "dos", "tete")
SLOT_LEVEL = {"cou": 2, "queue": 3, "dos": 4, "tete": 5}
ACCESSORY_SETS: dict[str, dict[str, tuple[str, str]]] = {
    "hydre": {"cou": ("Collier d'écailles vertes", "le collier d'écailles vertes"),
              "queue": ("Anneau de serpents de bronze", "l'anneau de serpents de bronze"),
              "dos": ("Selle de cuir des marais", "la selle de cuir des marais"),
              "tete": ("Casque de bronze à crête de serpents", "le casque de bronze à crête de serpents")},
    "echo": {"cou": ("Pendentif-conque", "le pendentif-conque"),
             "queue": ("Clochettes de bronze", "les clochettes de bronze"),
             "dos": ("Cape couleur de roche", "la cape couleur de roche"),
             "tete": ("Diadème de coquillages", "le diadème de coquillages")},
    "chimere": {"cou": ("Torque en cornes de chèvre", "le torque en cornes de chèvre"),
                "queue": ("Garde-queue à tête de serpent", "le garde-queue à tête de serpent"),
                "dos": ("Cape rouge braise", "la cape rouge braise"),
                "tete": ("Casque à crinière de lion", "le casque à crinière de lion")},
    "protee": {"cou": ("Collier de perles", "le collier de perles"),
               "queue": ("Anneau de corail", "l'anneau de corail"),
               "dos": ("Harnais d'écailles marines", "le harnais d'écailles marines"),
               "tete": ("Couronne de corail", "la couronne de corail")},
    "sirenes": {"cou": ("Pendentif en forme de lyre", "le pendentif en forme de lyre"),
                "queue": ("Rubans de plumes", "les rubans de plumes"),
                "dos": ("Harnais de plumes", "le harnais de plumes"),
                "tete": ("Aigrette de plumes bleues", "l'aigrette de plumes bleues")},
    "lethe": {"cou": ("Collier de pavots rouges", "le collier de pavots rouges"),
              "queue": ("Petite lanterne d'argent", "la petite lanterne d'argent"),
              "dos": ("Cape bleu nuit étoilée", "la cape bleu nuit étoilée"),
              "tete": ("Couronne de pavots", "la couronne de pavots")},
}
_WORN_ON = {"cou": "à porter au cou", "queue": "à porter à la queue", "dos": "à porter sur le dos", "tete": "à porter sur la tête"}


def accessory_id(key: str, slot: str) -> str:
    return f"accessory:{key}-{slot}"


REWARDS.update({accessory_id(k, s): _r(accessory_id(k, s), "accessory", ACCESSORY_SETS[k][s][0],
                                       f"Une parure {OF_LIEUTENANT[k]}, {_WORN_ON[s]}.", STALL)
                for k in LIEUTENANT_ORDER for s in SLOTS})
```

Extend the module docstring with « the stall's accessories, decor and houses (spec 2026-09-29 drachmes) ».

- [ ] **Step 5: The earning rules** — `server/app/world/drachmes.py`:

```python
"""Drachmes (spec 2026-09-29 drachmes §1): the camp's spendable coin. XP is never spent; drachmes are.
Every session, quest, weekly goal, seal and Éris fight won pays some (amounts in the rules file,
`Rules.drachmes`); the balance is the sum of the `drachme_event` ledger and never goes below zero."""
from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.rules import Rules

DEFAULT_DRACHMES: dict[str, int] = {"xp_per_drachme": 10, "board": 5, "oracle": 15, "weekly": 5, "level": 10, "boss": 30}
# The session's other bonuses that pay drachmes, by the reason `apply_progression` gives them.
FLAT = ("board", "oracle", "boss", "weekly")


def session_drachmes(xp: int, rules: "Rules") -> int:
    """round(XP ÷ xp_per_drachme), halves up, in whole numbers (R3, review focus 2)."""
    d = rules.drachmes["xp_per_drachme"]
    return (2 * max(0, xp) + d) // (2 * d)


def earned_drachmes(session_xp: int, bonuses: list[dict], rules: "Rules") -> list[dict]:
    """The session's drachmes, part by part (R3): its own XP's, then one part per bonus that pays."""
    d = rules.drachmes
    parts = [{"reason": "session", "amount": session_drachmes(session_xp, rules)}]
    for b in bonuses:
        if b["reason"] in FLAT:
            parts.append({"reason": b["reason"], "amount": d[b["reason"]]})
        elif b["reason"] == "level":
            parts.append({"reason": "level", "amount": d["level"] * b["level"], "lieutenant": b["lieutenant"], "level": b["level"]})
    return [p for p in parts if p["amount"] > 0]
```

- [ ] **Step 6: The shop's rules** — `server/app/world/shop.py`:

```python
"""L'étal d'Hermès (spec 2026-09-29 drachmes §2-§4): what Hermès sells, at what price (`Rules.prices`),
when each item is on sale, the house an owner lives in, and the accessories the dragon wears. Pure:
the router reads the database and writes the purchase (R5, R6, R7, R8)."""
from __future__ import annotations
from typing import TYPE_CHECKING, Any
from app.world.catalog import ACCESSORY_SETS, LIEUTENANT_ORDER, SLOT_LEVEL, SLOTS, accessory_id
from app.world.dragon import stage_index

if TYPE_CHECKING:
    from app.rules import Rules

DEFAULT_PRICES: dict[str, Any] = {"accessory": {"cou": 40, "queue": 60, "dos": 90, "tete": 130}, "decor": 50, "villa": 300, "palais": 800}


def default_prices() -> dict[str, Any]:
    return {**DEFAULT_PRICES, "accessory": dict(DEFAULT_PRICES["accessory"])}


SHOP_DECOR = ("decor:amphore", "decor:chouette", "decor:mosaique", "decor:bouclier")
HOUSES: dict[str, dict[str, Any]] = {
    "house:villa": {"key": "villa", "stage": "adult", "after": None},
    "house:palais": {"key": "palais", "stage": "illustre", "after": "house:villa"},
}
# Spec §3: the walls of each house hold this many pieces of decor (web/src/lib/world/scenes/cabin.ts
# DECOR_SLOTS has one slot per piece; cabin.test.ts reads this line).
MAX_DECOR = {"cabin": 4, "villa": 6, "palais": 9}
# Spec §4: the order the overlays are drawn in, back to front.
DRAW_ORDER = ("queue", "dos", "cou", "tete")
# Each item with its article, for « Acheter la couronne de pavots pour 130 drachmes ? ».
THE: dict[str, str] = {
    "decor:amphore": "l'amphore peinte", "decor:chouette": "la chouette de marbre",
    "decor:mosaique": "la mosaïque des Muses", "decor:bouclier": "le bouclier d'apparat",
    "house:villa": "la villa", "house:palais": "le palais",
    **{accessory_id(k, s): ACCESSORY_SETS[k][s][1] for k in LIEUTENANT_ORDER for s in SLOTS},
}


def parse_accessory(rid: str) -> tuple[str, str] | None:
    if not rid.startswith("accessory:"):
        return None
    key, _, slot = rid[len("accessory:"):].partition("-")
    return (key, slot) if key in ACCESSORY_SETS and slot in SLOTS else None


def is_item(rid: str) -> bool:
    return rid in THE


def price_of(rid: str, rules: "Rules") -> int:
    acc = parse_accessory(rid)
    if acc:
        return rules.prices["accessory"][acc[1]]
    if rid in SHOP_DECOR:
        return rules.prices["decor"]
    return rules.prices[HOUSES[rid]["key"]]


def house_of(owned: set[str]) -> str:
    """The highest house owned (R8)."""
    return next((HOUSES[h]["key"] for h in ("house:palais", "house:villa") if h in owned), "cabin")


def on_sale(rid: str, *, owned: set[str], levels: dict[str, int], awake: list[str], stage: str) -> bool:
    """Whether Hermès sells the item now (R6); a re-buy is refused apart, by the router."""
    acc = parse_accessory(rid)
    if acc:
        key, slot = acc
        return key in awake and levels.get(key, 0) >= SLOT_LEVEL[slot]
    if rid in SHOP_DECOR:
        return True
    h = HOUSES[rid]
    return stage_index(stage) >= stage_index(h["stage"]) and (h["after"] is None or h["after"] in owned)


def worn(equipped: set[str]) -> list[str]:
    """The equipped accessories as the manifest's item keys ("hydre-cou"), in the draw order (R7)."""
    by_slot: dict[str, str] = {}
    for rid in sorted(equipped):
        acc = parse_accessory(rid)
        if acc:
            by_slot.setdefault(acc[1], f"{acc[0]}-{acc[1]}")
    return [by_slot[s] for s in DRAW_ORDER if s in by_slot]


def shop_catalog(rules: "Rules") -> dict[str, Any]:
    """What `/api/world` serves of the stall (R9): every item with its price and its article."""
    return {
        "slots": list(SLOTS), "slot_levels": dict(SLOT_LEVEL), "draw_order": list(DRAW_ORDER),
        "accessories": [{"id": accessory_id(k, s), "item": f"{k}-{s}", "lieutenant": k, "slot": s, "level": SLOT_LEVEL[s],
                         "price": rules.prices["accessory"][s], "the": THE[accessory_id(k, s)]}
                        for k in LIEUTENANT_ORDER for s in SLOTS],
        "decor": [{"id": d, "price": rules.prices["decor"], "the": THE[d]} for d in SHOP_DECOR],
        "houses": [{"id": h, "key": v["key"], "stage": v["stage"], "after": v["after"], "price": rules.prices[v["key"]], "the": THE[h]}
                   for h, v in HOUSES.items()],
        "max_decor": dict(MAX_DECOR),
    }
```

- [ ] **Step 7: The rules file's `drachmes` and `prices`** — `server/app/rules.py`: add `from app.world.catalog import SLOTS` (next to sub-project 2's catalog import), `from app.world.drachmes import DEFAULT_DRACHMES`, `from app.world.shop import DEFAULT_PRICES, default_prices` (none of them imports `app.rules` at run time: no cycle); extend the module docstring's last sentence with "; what pays drachmes (`drachmes`) and what things cost (`prices`) are served in `/api/world`'s `shop`"; add the fields after `fights`:

```python
    drachmes: dict[str, int] = field(default_factory=lambda: dict(DEFAULT_DRACHMES))
    prices: dict[str, Any] = field(default_factory=default_prices)
```

add after `_fights`:

```python
def _drachmes(raw: Any, path: Path) -> dict[str, int] | None:
    """Spec 2026-09-29 drachmes §1 (R2): what each source pays; a wrong value keeps its default."""
    if not isinstance(raw, dict):
        log.warning('%s: drachmes must be an object like {"board": 5}; the built-in amounts apply', path)
        return None
    out = dict(DEFAULT_DRACHMES)
    for key, v in raw.items():
        least = 1 if key == "xp_per_drachme" else 0
        if key not in DEFAULT_DRACHMES or not (_count(v) and v >= least):
            log.warning("%s: drachmes[%r] = %r is ignored (keys %s; whole numbers, xp_per_drachme from 1); its default applies",
                        path, key, v, ", ".join(DEFAULT_DRACHMES))
            continue
        out[key] = v
    return out


def _prices(raw: Any, path: Path) -> dict[str, Any] | None:
    """Spec §2 (R2): the stall's prices; a wrong value keeps its default."""
    if not isinstance(raw, dict):
        log.warning('%s: prices must be an object like {"decor": 50}; the built-in prices apply', path)
        return None
    out = default_prices()
    for key, v in raw.items():
        if key == "accessory" and isinstance(v, dict):
            for slot, p in v.items():
                if slot in SLOTS and _count(p):
                    out["accessory"][slot] = p
                else:
                    log.warning("%s: prices['accessory'][%r] = %r is ignored (slots %s, whole numbers); its default applies",
                                path, slot, p, ", ".join(SLOTS))
        elif key in ("decor", "villa", "palais") and _count(v):
            out[key] = v
        else:
            log.warning("%s: prices[%r] = %r is ignored (accessory: an object of the four slots; decor, villa, palais: whole "
                        "numbers); its default applies", path, key, v)
    return out
```

and in `load_rules`' loop, after the `fights` branch:

```python
        elif key == "drachmes":
            drachmes = _drachmes(value, path)
            if drachmes is not None:
                values[key] = drachmes
        elif key == "prices":
            prices = _prices(value, path)
            if prices is not None:
                values[key] = prices
```

- [ ] **Step 8: Run the server tests**

Run: `scripts/pytest.sh -q tests/test_rules.py tests/test_shop.py` then `scripts/pytest.sh -q`
Expected: all pass, no warning in the output. Then `scripts/npm.sh run test -- src/lib/world/art.test.ts src/lib/world/rewards.test.ts`: the catalogue grew by four `_r(…, "decor", …)` literals without icons, so `art.test.ts`' icon-per-reward test and `rewards.test.ts`' « how to win » ids test **fail by design until Task 3** (which adds the icons and the sentences); record both failures in the report and nothing else may fail.

- [ ] **Step 9: Commit**

```bash
git add server/app/world/drachmes.py server/app/world/shop.py server/app/rules.py server/app/world/catalog.py server/tests/test_shop.py server/tests/test_rules.py
git commit -m "Server foundation for drachmes and Hermès's stall: what each source pays and what things cost in data/regles.json (drachmes, prices) with the usual fallback, the on-sale rules (seals for the accessories, the dragon's stage for the houses), the house owned, the pieces worn in draw order, the 24 accessories, four decor pieces and two houses in the catalogue (not wired yet)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- server/app/world/drachmes.py server/app/world/shop.py server/app/rules.py server/app/world/catalog.py server/tests/test_shop.py server/tests/test_rules.py
```

---

### Task 2: Server wiring — the ledger, the purchase, wearing, the walls

**Files:**
- Create: `server/app/migrations/007_drachmes.sql`, `server/tests/test_drachmes_api.py`
- Modify: `server/app/world/drachmes.py` (ledger), `server/app/world/progression.py`, `server/app/routers/world.py`, `server/app/schemas.py`
- Test: `server/tests/test_db.py`, `server/tests/test_world_api.py`, `server/tests/test_progression.py`, `web/e2e/world.spec.ts`

**Interfaces:**
- Consumes: Task 1; `levels_of`, `lieutenants_for_level` (`app/world/seals.py`); `dragon_out`, `begin_write`, `grant_reward`, `add_xp` (existing).
- Produces:
  - `app.world.drachmes`: `add_drachmes(conn, pid, amount, reason, ref, now)`, `balance(conn, pid) -> int`.
  - `progression.drachmes = {"earned": int, "parts": [{"reason", "amount", ("lieutenant", "level")}], "balance": int}`.
  - `POST /api/profiles/{id}/purchases` `{"item": str}` → 201 `{"reward": RewardOut, "drachmes": int}`; 404; 409 with the lines of R5.
  - `GET /camp`: `"drachmes": int`, `"house": "cabin" | "villa" | "palais"`; `dragon.worn: list[str]` (also from `PATCH /dragon`).
  - `GET /api/world`: `"shop"` (R9).
  - `PATCH /rewards/{id}`: the accessory swap, the house refusal, the walls per house.
  - `schemas.Purchase(item: str)`.

- [ ] **Step 1: Write the failing migration test** — `server/tests/test_db.py`:

```python
# Spec 2026-09-29 drachmes §1, §5 (review focus 2): the starting grant, a tenth of the XP, once.
def test_migration_007_grants_a_tenth_of_the_xp(tmp_path):
    conn = _db_before(tmp_path / "old.sqlite3", 7)
    for pid, name in ((1, "Io"), (2, "Ada"), (3, "Léo")):
        conn.execute("INSERT INTO profile(id, name, avatar, level, help_stage, created_at) VALUES (?, ?, 'chouette', '8H', 0, 'now')",
                     (pid, name))
    conn.executemany("INSERT INTO xp_event(profile_id, amount, reason, created_at) VALUES (?, ?, ?, 'then')",
                     [(1, 1000, "session"), (1, 239, "level"), (2, 9, "session")])
    conn.commit()
    assert migrate(conn) >= 7
    assert [tuple(r) for r in conn.execute("SELECT profile_id, amount, reason, ref FROM drachme_event ORDER BY profile_id")] == [
        (1, 123, "grant", None)]
    assert migrate(conn) >= 7                                                 # idempotent
    assert conn.execute("SELECT COUNT(*) FROM drachme_event").fetchone()[0] == 1
```

- [ ] **Step 2: Write the failing API tests** — `server/tests/test_drachmes_api.py`:

```python
"""Drachmes, the stall, wearing and the walls through the API (spec 2026-09-29 drachmes §1-§5)."""
import sqlite3
from concurrent.futures import ThreadPoolExecutor

from app.db import DB_FILENAME
from tests.test_dragon import give_xp, set_stage
from tests.test_progression import hydre_result, post
from tests.test_seals_api import LONG, seal, won
from tests.test_sessions import make_profile, make_text

SHORT = "Ta bourse n'est pas encore assez pleine pour cet objet."
NOT_ON_SALE = "Hermès ne vend pas encore cet objet."
OWNED = "Tu l'as déjà."
HOUSE = "Ta maison n'est pas un objet à exposer."
WALLS_FULL = "Les murs sont pleins\u202f: range d'abord une pièce."
QUEST_DECOR = ["decor:lanterne", "decor:tapis", "decor:bibliotheque", "decor:trophee", "decor:fresque"]
SHOP_DECOR = ["decor:amphore", "decor:chouette", "decor:mosaique", "decor:bouclier"]


def db(settings) -> sqlite3.Connection:
    conn = sqlite3.connect(settings.data_dir / DB_FILENAME)
    conn.row_factory = sqlite3.Row
    return conn


def purse(settings, pid, amount):
    conn = db(settings)
    conn.execute("INSERT INTO drachme_event(profile_id, amount, reason, ref, created_at) VALUES (?, ?, 'grant', NULL, 'then')",
                 (pid, amount))
    conn.commit(); conn.close()


def own(settings, pid, *ids):
    conn = db(settings)
    conn.executemany("INSERT INTO reward(profile_id, reward_id, source, granted_at) VALUES (?, ?, 'test', 'then')", [(pid, i) for i in ids])
    conn.commit(); conn.close()


def ledger(settings, pid):
    conn = db(settings)
    rows = [tuple(r) for r in conn.execute("SELECT amount, reason, ref FROM drachme_event WHERE profile_id = ? ORDER BY id", (pid,))]
    conn.close()
    return rows


def camp(client, pid):
    return client.get(f"/api/profiles/{pid}/camp").json()


def buy(client, pid, item):
    return client.post(f"/api/profiles/{pid}/purchases", json={"item": item})


def wear(client, pid, item, on=True):
    return client.patch(f"/api/profiles/{pid}/rewards/{item}", json={"equipped": on})


def test_a_session_pays_drachmes_and_the_camp_shows_the_purse(client):
    pid = make_profile(client, level="10H"); tid = make_text(client)
    assert camp(client, pid)["drachmes"] == 0 and camp(client, pid)["house"] == "cabin"
    p = post(client, pid, tid, hydre_result(), day="2026-09-21")["progression"]
    d = p["drachmes"]
    assert d["parts"][0] == {"reason": "session", "amount": (2 * p["xp"]["session"] + 10) // 20}
    assert d["earned"] == sum(x["amount"] for x in d["parts"]) == d["balance"]
    assert camp(client, pid)["drachmes"] == d["balance"]


def test_a_seal_and_the_week_pay_their_drachmes(client, settings):
    pid = make_profile(client, level="10H"); tid = make_text(client)
    post(client, pid, tid, hydre_result(), day="2026-09-21")
    post(client, pid, tid, hydre_result(), day="2026-09-22")
    p = post(client, pid, tid, hydre_result(), day="2026-09-23")["progression"]      # the Hydra's wooden seal, the week's third
    assert {"reason": "level", "amount": 10, "lieutenant": "hydre", "level": 1} in p["drachmes"]["parts"]
    assert {"reason": "weekly", "amount": 5} in p["drachmes"]["parts"]
    assert all(ref == f"session:{p_ref}" for _a, _r, ref in ledger(settings, pid)[-2:] for p_ref in [ledger(settings, pid)[-1][2].split(":")[1]])


def test_a_board_quest_pays_five(client):
    pid = make_profile(client, level="10H"); tid = make_text(client)
    assert client.post(f"/api/profiles/{pid}/quests", json={"target": "hydre"}).status_code == 201
    for day in ("2026-09-21", "2026-09-22"):
        post(client, pid, tid, hydre_result(), day=day)
    p = post(client, pid, tid, hydre_result(), day="2026-09-22")["progression"]
    assert {"reason": "board", "amount": 5} in p["drachmes"]["parts"]


def test_a_won_fight_pays_thirty(client, settings):
    pid = make_profile(client, level="10H"); long_text = make_text(client, body=LONG)
    for key in ("hydre", "echo", "chimere", "protee", "sirenes", "lethe"):
        seal(settings, pid, key, 2)
    won(settings, pid, 1, 2, 3)
    b = client.post(f"/api/profiles/{pid}/boss").json()
    p = post(client, pid, long_text, hydre_result(draft=0, caught=0), quest_id=b["quest"]["id"], encounter="eris")["progression"]
    assert {"reason": "boss", "amount": 30} in p["drachmes"]["parts"]


def test_buying_takes_the_price_and_grants_the_piece(client, settings):
    pid = make_profile(client, level="10H")
    purse(settings, pid, 100); seal(settings, pid, "hydre", 2)
    r = buy(client, pid, "accessory:hydre-cou")
    assert r.status_code == 201
    body = r.json()
    assert body["drachmes"] == 60
    assert {k: body["reward"][k] for k in ("id", "kind", "name", "equipped")} == {
        "id": "accessory:hydre-cou", "kind": "accessory", "name": "Collier d'écailles vertes", "equipped": False}
    assert ledger(settings, pid) == [(100, "grant", None), (-40, "purchase", "accessory:hydre-cou")]
    assert camp(client, pid)["drachmes"] == 60
    assert "accessory:hydre-cou" in {x["id"] for x in client.get(f"/api/profiles/{pid}/rewards").json()}


def test_a_purchase_is_refused_when_short_not_on_sale_owned_or_unknown(client, settings):
    pid = make_profile(client, level="10H")
    purse(settings, pid, 50); seal(settings, pid, "hydre", 2)
    for item in ("accessory:hydre-queue", "house:villa", "accessory:echo-cou"):
        r = buy(client, pid, item)
        assert (r.status_code, r.json()["detail"]) == (409, NOT_ON_SALE), item
    assert buy(client, pid, "accessory:hydre-cou").status_code == 201                   # 50 - 40 = 10
    r = buy(client, pid, "accessory:hydre-cou")
    assert (r.status_code, r.json()["detail"]) == (409, OWNED)
    r = buy(client, pid, "decor:amphore")
    assert (r.status_code, r.json()["detail"]) == (409, SHORT)
    for item in ("decor:nope", "egide", "trophy:hydre:1", "decor:tapis"):
        assert buy(client, pid, item).status_code == 404, item
    assert camp(client, pid)["drachmes"] == 10


# Review focus 3: the stored stage decides, and the palais comes after the villa.
def test_the_houses_in_order_on_the_stored_stage(client, settings):
    pid = make_profile(client, level="10H")
    purse(settings, pid, 2000); set_stage(settings, pid, "adult")            # stored ahead of the XP (sub-project 3)
    assert buy(client, pid, "house:palais").json()["detail"] == NOT_ON_SALE
    assert buy(client, pid, "house:villa").status_code == 201
    assert camp(client, pid)["house"] == "villa"
    assert buy(client, pid, "house:palais").json()["detail"] == NOT_ON_SALE     # adult, not illustre
    give_xp(settings, pid, 15000)
    assert buy(client, pid, "house:palais").status_code == 201
    assert camp(client, pid)["house"] == "palais" and camp(client, pid)["drachmes"] == 900


def test_protees_set_is_not_sold_before_8h(client, settings):
    pid = make_profile(client, level="7H")
    purse(settings, pid, 200); seal(settings, pid, "protee", 5)                # by hand: Protée sleeps at 7H
    assert buy(client, pid, "accessory:protee-cou").json()["detail"] == NOT_ON_SALE
    assert client.patch(f"/api/profiles/{pid}", json={"level": "8H"}).status_code == 200
    assert buy(client, pid, "accessory:protee-cou").status_code == 201


# Review focus 1: the balance is read and the purchase written under one write lock.
def test_purchases_racing_never_overdraw(client, settings):
    pid = make_profile(client, level="10H")
    purse(settings, pid, 100)
    for key in ("hydre", "echo", "chimere", "lethe"):
        seal(settings, pid, key, 2)
    items = [f"accessory:{k}-cou" for k in ("hydre", "echo", "chimere", "lethe")]
    with ThreadPoolExecutor(max_workers=4) as ex:
        codes = list(ex.map(lambda item: buy(client, pid, item).status_code, items))
    assert sorted(codes) == [201, 201, 409, 409]
    assert camp(client, pid)["drachmes"] == 20 and sum(a for a, _r, _ref in ledger(settings, pid)) == 20


# Review focus 4.
def test_one_accessory_per_slot(client, settings):
    pid = make_profile(client, level="10H")
    own(settings, pid, "accessory:hydre-cou", "accessory:echo-cou", "accessory:lethe-tete")
    assert wear(client, pid, "accessory:hydre-cou").status_code == 200
    assert wear(client, pid, "accessory:lethe-tete").status_code == 200
    assert camp(client, pid)["dragon"]["worn"] == ["hydre-cou", "lethe-tete"]
    assert wear(client, pid, "accessory:echo-cou").status_code == 200                 # a swap
    assert camp(client, pid)["dragon"]["worn"] == ["echo-cou", "lethe-tete"]
    equipped = {x["id"]: x["equipped"] for x in client.get(f"/api/profiles/{pid}/rewards").json()}
    assert equipped["accessory:hydre-cou"] is False and equipped["accessory:echo-cou"] is True
    assert wear(client, pid, "accessory:echo-cou", on=False).status_code == 200       # « Rien »
    assert camp(client, pid)["dragon"]["worn"] == ["lethe-tete"]
    assert wear(client, pid, "accessory:chimere-cou").status_code == 404              # only what is owned
    assert client.patch(f"/api/profiles/{pid}/dragon", json={"tint": "bronze"}).json()["worn"] == ["lethe-tete"]


def test_a_house_is_not_put_on_display(client, settings):
    pid = make_profile(client, level="10H")
    own(settings, pid, "house:villa")
    r = wear(client, pid, "house:villa")
    assert (r.status_code, r.json()["detail"]) == (409, HOUSE)


# Review focus 5.
def test_the_walls_hold_four_six_or_nine_pieces_by_house(client, settings):
    pid = make_profile(client, level="10H")
    own(settings, pid, *QUEST_DECOR, *SHOP_DECOR)
    for d in QUEST_DECOR[:4]:
        assert wear(client, pid, d).status_code == 200
    assert (wear(client, pid, QUEST_DECOR[4]).status_code, wear(client, pid, QUEST_DECOR[4]).json()["detail"]) == (409, WALLS_FULL)
    own(settings, pid, "house:villa")
    assert wear(client, pid, QUEST_DECOR[4]).status_code == 200 and wear(client, pid, SHOP_DECOR[0]).status_code == 200
    assert wear(client, pid, SHOP_DECOR[1]).status_code == 409                         # the seventh, in the villa
    own(settings, pid, "house:palais")
    for d in SHOP_DECOR[1:]:
        assert wear(client, pid, d).status_code == 200                                 # nine in the palais
    assert sum(1 for x in client.get(f"/api/profiles/{pid}/rewards").json() if x["kind"] == "decor" and x["equipped"]) == 9
```

The seal-and-week test's last assertion is convoluted: replace it by

```python
    session_refs = {ref for _a, reason, ref in ledger(settings, pid) if reason in ("level", "weekly")}
    assert len(session_refs) == 1 and next(iter(session_refs)).startswith("session:")
```

`server/tests/test_world_api.py`: in `test_world_catalog` add `assert w["shop"]["houses"][0]["price"] == 300 and len(w["shop"]["accessories"]) == 24 and w["rules"]["prices"]["decor"] == 50`; in `test_camp_for_new_profile` add `assert (c["drachmes"], c["house"], c["dragon"]["worn"]) == (0, "cabin", [])`. Any test there that imports `MAX_DISPLAYED_DECOR` from `app.routers.world` imports `MAX_DECOR` from `app.world.shop` instead and reads `MAX_DECOR["cabin"]` (grep it).

- [ ] **Step 3: Run them to see them fail**

Run: `scripts/pytest.sh -q tests/test_db.py tests/test_drachmes_api.py tests/test_world_api.py`
Expected: FAIL (no table `drachme_event`, no route `/purchases`).

- [ ] **Step 4: Migration 007** — `server/app/migrations/007_drachmes.sql`:

```sql
-- Sub-project 4 (spec 2026-09-29 drachmes §1, §5): the drachme ledger, like xp_event: the balance is
-- its sum. Every hero receives a starting grant of a tenth of the XP already won (floor; none under
-- 10 XP), so existing play is rewarded. The divisor is fixed here: a migration runs once.
CREATE TABLE drachme_event (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,          -- grant | session | board | oracle | weekly | level | boss | purchase
  ref TEXT,                      -- session:<id> | the item bought | NULL for the grant
  created_at TEXT NOT NULL);
CREATE INDEX drachme_event_profile ON drachme_event(profile_id);
INSERT INTO drachme_event(profile_id, amount, reason, ref, created_at)
  SELECT profile_id, SUM(amount) / 10, 'grant', NULL, strftime('%Y-%m-%dT%H:%M:%S+00:00', 'now')
  FROM xp_event GROUP BY profile_id HAVING SUM(amount) >= 10;
```

- [ ] **Step 5: The ledger** — `server/app/world/drachmes.py`, append:

```python
def add_drachmes(conn, profile_id: int, amount: int, reason: str, ref: str | None, now: str) -> None:
    conn.execute("INSERT INTO drachme_event(profile_id, amount, reason, ref, created_at) VALUES (?, ?, ?, ?, ?)",
                 (profile_id, amount, reason, ref, now))


def balance(conn, profile_id: int) -> int:
    return conn.execute("SELECT COALESCE(SUM(amount), 0) FROM drachme_event WHERE profile_id = ?", (profile_id,)).fetchone()[0]
```

- [ ] **Step 6: The session pays** — `server/app/world/progression.py`: import `add_drachmes, balance, earned_drachmes` from `app.world.drachmes`; the docstring's first line gains « then its drachmes » after the dragon; after the last XP step (the weekly goal, then sub-project 3's dragon growth), before the returned dict:

```python
    # Spec 2026-09-29 drachmes §1 (R3): the session's drachmes, from its own XP and each bonus that pays,
    # one ledger row per part.
    drachme_parts = earned_drachmes(xp.total, bonuses, rules)
    for part in drachme_parts:
        add_drachmes(conn, pid, part["amount"], part["reason"], f"session:{session_id}", now)
```

and in the returned dict, after `"rewards"`: `"drachmes": {"earned": sum(p["amount"] for p in drachme_parts), "parts": drachme_parts, "balance": balance(conn, pid)},`.

`server/tests/test_progression.py`: in sub-project 3's `test_session_grants_xp_and_reports_the_dragons_gauge` (or the file's first session test), add `assert p["drachmes"]["balance"] == p["drachmes"]["earned"] > 0`.

- [ ] **Step 7: The router** — `server/app/schemas.py`:

```python
class Purchase(BaseModel):
    """Spec 2026-09-29 drachmes §2: one item of Hermès's stall, by its reward id."""
    item: str = Field(min_length=1, max_length=64)
```

`server/app/routers/world.py`:
  - docstring: « the only writer of quest/oracle/dragon/reward/xp_event/drachme_event/lieutenant_level state outside of app.world.progression »;
  - imports: `Purchase` from `app.schemas`; `ACCESSORY_SETS, accessory_id` added to the catalog import; `from app.world.drachmes import add_drachmes, balance`; `from app.world.shop import MAX_DECOR, house_of, is_item, on_sale, parse_accessory, price_of, shop_catalog, worn`;
  - delete `MAX_DISPLAYED_DECOR` and its comment; the comment above `WALLS_FULL_MESSAGE` becomes « The walls of each house hold MAX_DECOR pieces (spec 2026-09-29 drachmes §3; DECOR_SLOTS in web/src/lib/world/scenes/cabin.ts); one more would hang over the first. »; add

```python
# Spec 2026-09-29 drachmes §2 (R5, R7): Hermès's refusals, said to the player.
OWNED_MESSAGE = "Tu l'as déjà."
NOT_ON_SALE_MESSAGE = "Hermès ne vend pas encore cet objet."
SHORT_MESSAGE = "Ta bourse n'est pas encore assez pleine pour cet objet."
HOUSE_MESSAGE = "Ta maison n'est pas un objet à exposer."


def owned_ids(conn: sqlite3.Connection, pid: int) -> set[str]:
    return {r[0] for r in conn.execute("SELECT reward_id FROM reward WHERE profile_id = ?", (pid,))}
```

  - `dragon_out`: `rows = conn.execute("SELECT reward_id, equipped FROM reward WHERE profile_id = ?", (pid,)).fetchall()`, `owned = {r[0] for r in rows}` in place of its `owned` query, and the returned dict gains `"worn": worn({r[0] for r in rows if r[1]}),  # spec 2026-09-29 drachmes §4: the pieces worn, in draw order`;
  - `get_world`: `"shop": shop_catalog(request.app.state.rules),` after `"quest_bonus"` (comment `# Spec 2026-09-29 drachmes §2: the stall's items, prices (from the rules file) and the walls per house.`);
  - `get_camp`: the returned dict gains `"drachmes": balance(db, pid), "house": house_of(owned_ids(db, pid)),` after `"rewards_count"`;
  - the purchase:

```python
@router.post("/profiles/{profile_id}/purchases", status_code=201)
def post_purchase(profile_id: int, body: Purchase, request: Request, db: sqlite3.Connection = Depends(get_db)):
    """Spec 2026-09-29 drachmes §2 (R5, review focus 1): the balance is read and the purchase written
    under one write lock, so two purchases at once can never overdraw the purse."""
    profile = fetch_profile(db, profile_id)
    if not is_item(body.item):
        raise HTTPException(404, "Item not found")
    rules = request.app.state.rules
    now = now_utc()
    pid = profile["id"]
    begin_write(db)
    try:
        stage = dragon_out(db, profile, now, rules)["stage"]      # the stored stage, caught up from the XP
        owned = owned_ids(db, pid)
        if body.item in owned:
            raise HTTPException(409, OWNED_MESSAGE)
        if not on_sale(body.item, owned=owned, levels=levels_of(db, pid), awake=lieutenants_for_level(profile["level"]), stage=stage):
            raise HTTPException(409, NOT_ON_SALE_MESSAGE)
        price = price_of(body.item, rules)
        if balance(db, pid) < price:
            raise HTTPException(409, SHORT_MESSAGE)
        add_drachmes(db, pid, -price, "purchase", body.item, now)
        grant_reward(db, pid, body.item, "stall", now)
    except HTTPException:
        db.rollback()
        raise
    db.commit()
    row = db.execute("SELECT granted_at, equipped FROM reward WHERE profile_id = ? AND reward_id = ?", (pid, body.item)).fetchone()
    return {"reward": {**REWARDS[body.item], "granted_at": row["granted_at"], "equipped": bool(row["equipped"])},
            "drachmes": balance(db, pid)}
```

  (import `grant_reward` from `app.world.progression`, `levels_of` is already imported since sub-project 2.)
  - `_displayed_decor` stays; `patch_reward` becomes (the lines around it unchanged):

```python
    kind = _kind(reward_id)
    if kind == "house":
        db.rollback()
        raise HTTPException(409, HOUSE_MESSAGE)
    if body.equipped and not row["equipped"] and kind == "decor":
        # Spec 2026-09-29 drachmes §3: the walls of the house the hero lives in.
        if _displayed_decor(db, profile_id) >= MAX_DECOR[house_of(owned_ids(db, profile_id))]:
            db.rollback()
            raise HTTPException(409, WALLS_FULL_MESSAGE)
    if body.equipped and kind == "accessory":
        # Spec §4 (R7): one piece per slot; putting one on takes off the other of its slot, in the same transaction.
        slot = parse_accessory(reward_id)[1]
        others = [accessory_id(k, slot) for k in ACCESSORY_SETS if accessory_id(k, slot) != reward_id]
        db.execute(f"UPDATE reward SET equipped = 0 WHERE profile_id = ? AND reward_id IN ({','.join('?' * len(others))})",
                   (profile_id, *others))
```

  (the house check comes after the row check, so a house not owned stays 404).
- [ ] **Step 8: Run the server tests**

Run: `scripts/pytest.sh -q tests/test_db.py tests/test_drachmes_api.py tests/test_shop.py tests/test_world_api.py tests/test_progression.py` then `scripts/pytest.sh -q`
Expected: all pass, no warning. `grep -rn "MAX_DISPLAYED_DECOR" server` prints nothing.

- [ ] **Step 9: The world e2e** — `web/e2e/world.spec.ts`: in the step that posts the first session (step 1 or 2, whichever first reads `progression.xp`), add

```ts
    // Spec 2026-09-29 drachmes §1: the session pays a tenth of its XP, halves up.
    expect(res.progression.drachmes.parts[0]).toEqual({ reason: 'session', amount: Math.floor((2 * res.progression.xp.session + 10) / 20) });
    expect(res.progression.drachmes.balance).toBe(res.progression.drachmes.earned);
```

(with the step's own name for the response). Run: `STACK=prog scripts/playwright.sh world.spec.ts --repeat-each=3`. Expected: pass.

- [ ] **Step 10: Commit**

```bash
git add server/app/migrations/007_drachmes.sql server/app/world/drachmes.py server/app/world/progression.py server/app/routers/world.py server/app/schemas.py server/tests/test_drachmes_api.py server/tests/test_db.py server/tests/test_world_api.py server/tests/test_progression.py web/e2e/world.spec.ts
git commit -m "Server: drachmes (migration 007: the ledger and a starting grant of a tenth of the XP; each session, quest, weekly goal, seal and won fight pays its drachmes), Hermès's stall (POST /purchases under one write lock: owned, not on sale, short), the camp's purse, house and worn pieces, the shop in /api/world, one accessory per slot and the walls per house

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- server/app/migrations/007_drachmes.sql server/app/world/drachmes.py server/app/world/progression.py server/app/routers/world.py server/app/schemas.py server/tests/test_drachmes_api.py server/tests/test_db.py server/tests/test_world_api.py server/tests/test_progression.py web/e2e/world.spec.ts
```

---

### Task 3: Art without the accessories — the stall's camp, the two houses, Hermès, the icons

**Files:**
- Move: `assets/art/export/scenes/hub_camp_stall.webp` → `web/public/art/scenes/hub_camp.webp` (replaces it), `assets/art/export/scenes/{villa,palais}.webp` → `web/public/art/scenes/`, `assets/art/export/characters/hermes_cut.webp` → `web/public/art/characters/`, `assets/art/export/icons/{drachme,decor-amphore,decor-chouette,decor-mosaique,decor-bouclier}.webp` → `web/public/art/icons/`
- Modify: `web/src/lib/world/art.ts`, `web/src/lib/world/types.ts` (`RewardKind`), `web/src/lib/world/rewards.ts`, `docs/art/style-guide.md`, `docs/art/scenes.md`
- Test: `web/src/lib/world/art.test.ts`, `web/src/lib/world/rewards.test.ts`

**Interfaces:**
- Consumes: the staged art; Task 1's catalogue (four decor `_r` literals, two houses).
- Produces: `ART.scenes.villa`, `ART.scenes.palais`, `ART.characters.hermes`; `REWARD_ICONS['decor:amphore' | 'decor:chouette' | 'decor:mosaique' | 'decor:bouclier']`; `MARK_ICONS.drachme`; `RewardKind` = `'trophy' | 'tint' | 'gear' | 'decor' | 'accessory' | 'house'`; `rewardKindOf('accessory:…') === 'accessory'`, `rewardKindOf('house:…') === 'house'`; the four « how to win » sentences (R23).

- [ ] **Step 1: Verify the art** — Run:

```bash
for f in scenes/hub_camp_stall scenes/villa scenes/palais characters/hermes_cut icons/drachme icons/decor-amphore icons/decor-chouette icons/decor-mosaique icons/decor-bouclier; do test -f "assets/art/export/$f.webp" || echo "MISSING $f"; done
```

Expected: no « MISSING » line. **If any file is missing, stop and report.** Open `docs/art/phase3-sheet.png` (Read tool) and confirm the stall, Hermès and the five icons are the ones the style guide describes.

- [ ] **Step 2: Write the failing tests** — `web/src/lib/world/art.test.ts`:
  - `'maps the UI2 scenes, characters and props'`: `expect(ART.characters).toEqual({ pythia: '/art/characters/pythia_cut.webp', owl: '/art/characters/owl_cut.webp', hermes: '/art/characters/hermes_cut.webp' });` and add `expect([ART.scenes.villa, ART.scenes.palais]).toEqual(['/art/scenes/villa.webp', '/art/scenes/palais.webp']);`;
  - the icons test: `toHaveLength(36)` and its title « maps the 36 painted icons… » (sub-project 2 left 31; the drachme and four decor come), `expect(MARK_ICONS).toEqual({ oracleSeal: '/art/icons/seal-oracle.webp', lock: '/art/icons/lock.webp', drachme: '/art/icons/drachme.webp' });`;
  - the catalogue test (sub-project 2's version): `expect(ids).toHaveLength(12);` (3 gear, 5 quest decor, 4 shop decor) and add `expect(rewardIcon('decor:mosaique')).toBe('/art/icons/decor-mosaique.webp');` and `expect([rewardKindOf('accessory:hydre-cou'), rewardKindOf('house:villa')]).toEqual(['accessory', 'house']);`;
  - add:

```ts
  it('ships the camp with Hermès\'s stall in place of the old one, and Hermès within budget (spec 2026-09-29 drachmes §2)', () => {
    expect(ART.scenes.hubCamp).toBe('/art/scenes/hub_camp.webp');
    expect(existsSync('public/art/scenes/hub_camp_stall.webp')).toBe(false);
    expect(statSync('public' + ART.characters.hermes).size).toBeLessThanOrEqual(80 * 1024);
    for (const id of ['amphore', 'chouette', 'mosaique', 'bouclier']) expect(statSync(`public/art/icons/decor-${id}.webp`).size, id).toBeLessThanOrEqual(20 * 1024);
  });
```

`web/src/lib/world/rewards.test.ts`: add `expect(howToWin('decor:bouclier', '')).toBe('Hermès le vend à son étal.');` and `expect(howToWin('decor:chouette', '')).toBe('Hermès la vend à son étal.');` (the ids check already compares `HOW_TO_WIN_IDS` with `REWARD_ICONS` plus the tints).

- [ ] **Step 3: Run them to see them fail**

Run: `scripts/npm.sh run test -- src/lib/world/art.test.ts src/lib/world/rewards.test.ts`
Expected: FAIL.

- [ ] **Step 4: Move** —

```bash
git mv -f assets/art/export/scenes/hub_camp_stall.webp web/public/art/scenes/hub_camp.webp
for f in scenes/villa scenes/palais characters/hermes_cut icons/drachme icons/decor-amphore icons/decor-chouette icons/decor-mosaique icons/decor-bouclier; do
  git mv "assets/art/export/$f.webp" "web/public/art/$f.webp"
done
git status --short web/public/art assets/art/export
```

(a file that is untracked: `mv` it instead). Expected: `web/public/art/scenes/hub_camp.webp` modified (R17), eight renames, no staged file left under `assets/art/export/{scenes,characters}` and only `tool-palamede.webp` left if sub-project 1 did not move it (it did: then nothing) under `assets/art/export/icons`.

- [ ] **Step 5: The map** — `web/src/lib/world/types.ts`: `export type RewardKind = 'trophy' | 'tint' | 'gear' | 'decor' | 'accessory' | 'house';`. `web/src/lib/world/art.ts`:
  - `REWARD_ICONS` gains `'decor:amphore': icon('decor-amphore'), 'decor:chouette': icon('decor-chouette'), 'decor:mosaique': icon('decor-mosaique'), 'decor:bouclier': icon('decor-bouclier'),` (comment: « Spec 2026-09-29 drachmes §2: Hermès's four pieces »);
  - `MARK_ICONS` gains `drachme: icon('drachme'),` (comment on the object: « Small marks: the Oracle's wax seal, a padlock, the drachme coin (spec 2026-09-29 drachmes §1). »);
  - `ART.characters` gains `hermes: '/art/characters/hermes_cut.webp',` (comment « Spec 2026-09-29 drachmes §2: Hermès at his stall. »);
  - `ART.scenes` gains, after `cabin`, `villa: '/art/scenes/villa.webp', palais: '/art/scenes/palais.webp',` (comment « Spec 2026-09-29 drachmes §3: the houses bought from Hermès, the cabin's room plan. ») and `hubCamp`'s comment « the camp with Hermès's stall painted in (spec 2026-09-29 drachmes §2) »;
  - `rewardKindOf`, before the `tint:` guess: `if (id.startsWith('accessory:')) return 'accessory';` and `if (id.startsWith('house:')) return 'house';`.

`web/src/lib/world/rewards.ts`, `HOW_TO_WIN` after `decor:fresque`:

```ts
  // Spec 2026-09-29 drachmes §2: Hermès's decor, bought at his stall.
  'decor:amphore': 'Hermès la vend à son étal.',
  'decor:chouette': 'Hermès la vend à son étal.',
  'decor:mosaique': 'Hermès la vend à son étal.',
  'decor:bouclier': 'Hermès le vend à son étal.',
```

`TrophiesPanel.svelte` lists rewards by kind: `accessory` and `house` are in no section there (they live at the stall and in the nest), so nothing changes in it.

`docs/art/style-guide.md`, "Progression redesign, phase 3", after sub-project 2's sentence on the trophies: « The camp with the stall is wired in place of `web/public/art/scenes/hub_camp.webp`; the villa, the palais, Hermès and the five icons are in `web/public/art/` (sub-project 4). ». `docs/art/scenes.md`, in the hub camp's section: « The web copy carries Hermès's stall (`assets/art/scenes/hub_camp_stall.png`, box x 10.5-21.8 %, y 20.8-44.8 %; sub-project 4). ». If `git status --short docs/art/` shows either file already modified (an art agent's work in progress), do not touch it: report the line as an open item.

- [ ] **Step 6: Measure and run**

```bash
du -cb web/public/art/dragon/*.webp web/public/art/characters/*.webp web/public/art/lieutenants/*.webp web/public/art/emblems/*.webp web/public/art/props/*.webp web/public/art/battle/*.webp web/public/art/textures/*.webp web/public/art/ui/*.webp web/public/art/trophies/*.webp web/public/art/trophies/large/*.webp | tail -1
```

Expected: under 3 670 016 bytes (3.5 MiB, sub-project 2's limit): about sub-project 2's measured total plus 64 498. **If it is above, stop and report the per-folder totals** (Task 6 raises the budget once, with the accessories).

Run: `scripts/npm.sh run test -- src/lib/world src/artReferenced.test.ts src/lib/world/scenes/budget.test.ts` ; `scripts/npm.sh run check` ; `STACK=prog scripts/playwright.sh scenes-camp.spec.ts`
Expected: all pass, `0 errors and 0 warnings`; the camp spec passes unchanged on both projects (the new background moves no hotspot: the stall's box is pixel-identical elsewhere).

- [ ] **Step 7: Commit**

```bash
PATHS="web/src/lib/world/art.ts web/src/lib/world/art.test.ts web/src/lib/world/types.ts web/src/lib/world/rewards.ts web/src/lib/world/rewards.test.ts docs/art/style-guide.md docs/art/scenes.md web/public/art/scenes/hub_camp.webp assets/art/export/scenes/hub_camp_stall.webp"
for f in scenes/villa scenes/palais characters/hermes_cut icons/drachme icons/decor-amphore icons/decor-chouette icons/decor-mosaique icons/decor-bouclier; do
  PATHS="$PATHS assets/art/export/$f.webp web/public/art/$f.webp"
done
git add web/src/lib/world/art.ts web/src/lib/world/art.test.ts web/src/lib/world/types.ts web/src/lib/world/rewards.ts web/src/lib/world/rewards.test.ts docs/art/style-guide.md docs/art/scenes.md
git commit -m "Art: the camp with Hermès's stall painted in (in place of hub_camp.webp), the villa and the palais, Hermès, the drachme coin and Hermès's four decor icons wired; decor icons and how to get them, the accessory and house reward kinds

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- $PATHS
```

(drop the docs from both lists if Step 5 left them alone.)

---

### Task 4: The purse — types, the stall's words, the HUD, the victory's chip

**Files:**
- Create: `web/src/lib/world/shop.ts`, `web/src/lib/world/shop.test.ts`
- Modify: `web/src/lib/world/types.ts`, `web/src/lib/world/api.ts`, `web/src/lib/scene/hud.ts`, `web/src/components/scene/Hud.svelte`, `web/src/components/battle/VictorySpoils.svelte`
- Test: `web/src/lib/scene/hud.test.ts`, every vitest fixture of a `CampResponse`/`DragonOut`/`WorldCatalog` (`grep -rln "rewards_count\|unlocked_tints\|quest_bonus" web/src --include=*.test.ts`), `web/e2e/scenes-camp.spec.ts`, `web/e2e/scenes-battle-victory.spec.ts`

**Interfaces:**
- Consumes: Task 2's API; `thousands`, `plural` (`lib/text/french.ts`); `sealTitleOf` (`lib/world/seals.ts`); `isAwake` (`lib/world/eris.ts`); `DRAGON_STAGES`, `LIEUTENANT_ORDER`; `MARK_ICONS.drachme` (Task 3).
- Produces:
  - `lib/world/types.ts`: `type House = 'cabin' | 'villa' | 'palais'`, `type Slot = 'cou' | 'queue' | 'dos' | 'tete'`, `interface ShopCatalog`, `WorldCatalog.shop`, `CampResponse.drachmes: number`, `CampResponse.house: House`, `DragonOut.worn: string[]`, `Progression.drachmes?: { earned: number; parts: { reason: string; amount: number; lieutenant?: string; level?: number }[]; balance: number }`.
  - `worldApi.buy(profileId, item) -> Promise<{ reward: RewardOut; drachmes: number }>`.
  - `lib/world/shop.ts`: `drachmesText(n)`, `purseLine(n)`, `drachmeChip(n)`, `confirmQuestion(item)`, `lockedAccessoryLine(key, level)`, `houseLockedLine(house, stage, owned)`, `stallShelves(shop, rewards, camp, owned, heroLevel)`, `HOUSE_NAMES`, `kindOfItem(id)`.
  - `lib/scene/hud.ts`: `hudDrachmes(n): { text: string; label: string }`.

- [ ] **Step 1: Write the failing tests** — `web/src/lib/world/shop.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { HOUSE_NAMES, confirmQuestion, drachmeChip, drachmesText, houseLockedLine, kindOfItem, lockedAccessoryLine, purseLine, stallShelves } from './shop';
import type { CampResponse, LieutenantState, ShopCatalog } from './types';

const SLOTS = ['cou', 'queue', 'dos', 'tete'] as const;
const LEVEL = { cou: 2, queue: 3, dos: 4, tete: 5 } as const;
const PRICE = { cou: 40, queue: 60, dos: 90, tete: 130 } as const;
const KEYS = ['hydre', 'echo', 'chimere', 'protee', 'sirenes', 'lethe'] as const;
const SHOP: ShopCatalog = {
  slots: [...SLOTS],
  slot_levels: { ...LEVEL },
  draw_order: ['queue', 'dos', 'cou', 'tete'],
  accessories: KEYS.flatMap((k) => SLOTS.map((s) => ({ id: `accessory:${k}-${s}`, item: `${k}-${s}`, lieutenant: k, slot: s, level: LEVEL[s], price: PRICE[s], the: `le ${s} ${k}` }))),
  decor: ['amphore', 'chouette', 'mosaique', 'bouclier'].map((d) => ({ id: `decor:${d}`, price: 50, the: `la ${d}` })),
  houses: [
    { id: 'house:villa', key: 'villa', stage: 'adult', after: null, price: 300, the: 'la villa' },
    { id: 'house:palais', key: 'palais', stage: 'illustre', after: 'house:villa', price: 800, the: 'le palais' },
  ],
  max_decor: { cabin: 4, villa: 6, palais: 9 },
};
const NAMES = new Proxy({} as Record<string, { name: string }>, { get: (_t, id: string) => ({ name: `Nom ${id}` }) });
const lt = (key: string, level: number) => ({ key, level }) as unknown as LieutenantState;
const camp = (o: { levels?: Partial<Record<string, number>>; stage?: string; drachmes?: number }) =>
  ({
    lieutenants: KEYS.map((k) => lt(k, o.levels?.[k] ?? 0)),
    dragon: { stage: o.stage ?? 'young' },
    drachmes: o.drachmes ?? 0,
  }) as unknown as CampResponse;

// Spec 2026-09-29 drachmes §1, §2.
describe('the purse and the stall in words', () => {
  it('counts drachmes with thousands grouped, and says the chip and the purse', () => {
    expect([drachmesText(1), drachmesText(40), drachmesText(1117)]).toEqual(['1 drachme', '40 drachmes', '1\u202f117 drachmes']);
    expect(purseLine(254)).toBe('Ta bourse\u202f: 254 drachmes');
    expect([drachmeChip(12), drachmeChip(1)]).toEqual(['+12 drachmes', '+1 drachme']);
    expect(confirmQuestion({ the: 'la couronne de pavots', price: 130 })).toBe('Acheter la couronne de pavots pour 130 drachmes\u202f?');
    expect(HOUSE_NAMES).toEqual({ cabin: 'Ta cabane', villa: 'Ta villa', palais: 'Ton palais' });
    expect([kindOfItem('accessory:hydre-cou'), kindOfItem('decor:amphore'), kindOfItem('house:villa')]).toEqual(['accessory', 'decor', 'house']);
  });

  it('says what a locked piece waits for, never a number or « niveau »', () => {
    expect(lockedAccessoryLine('hydre', 2)).toBe("Au sceau de bronze de l'Hydre");
    expect(lockedAccessoryLine('echo', 3)).toBe("Au sceau d'argent d'Écho");
    expect(lockedAccessoryLine('sirenes', 5)).toBe("Au sceau d'orichalque des Sirènes");
    const [villa, palais] = SHOP.houses;
    expect(houseLockedLine(villa, 'young', new Set())).toBe('Quand ton dragon sera adulte.');
    expect(houseLockedLine(palais, 'adult', new Set(['house:villa']))).toBe('Quand ton dragon sera illustre.');
    expect(houseLockedLine(palais, 'illustre', new Set())).toBe('Après la villa.');
    expect(houseLockedLine(palais, 'young', new Set())).toBe('Quand ton dragon sera illustre, après la villa.');
  });

  // Review focus 3.
  it('fills the three shelves: owned, affordable, short, locked; Protée from 8H', () => {
    const owned = new Set(['accessory:hydre-cou']);
    const s = stallShelves(SHOP, NAMES, camp({ levels: { hydre: 3, echo: 2 }, drachmes: 55 }), owned, '7H');
    expect(s.accessories.map((g) => g.lieutenant)).toEqual(['hydre', 'echo', 'chimere', 'sirenes', 'lethe']);
    const hydre = s.accessories[0].items;
    expect(hydre.map((i) => i.state)).toEqual(['owned', 'short', 'locked', 'locked']);
    expect(hydre[0]).toMatchObject({ id: 'accessory:hydre-cou', name: 'Nom accessory:hydre-cou', price: 40, note: 'À toi' });
    expect(hydre[1]).toMatchObject({ state: 'short', note: 'Encore 5 drachmes à gagner.', missing: 5 });
    expect(hydre[2].note).toBe("Au sceau d'or de l'Hydre");
    expect(s.accessories[1].items[0]).toMatchObject({ state: 'on_sale', note: null });
    expect(s.decor.map((i) => i.state)).toEqual(['on_sale', 'on_sale', 'on_sale', 'on_sale']);
    expect(s.houses.map((i) => [i.state, i.note])).toEqual([['locked', 'Quand ton dragon sera adulte.'], ['locked', 'Quand ton dragon sera illustre, après la villa.']]);
    expect(stallShelves(SHOP, NAMES, camp({}), new Set(), '8H').accessories.map((g) => g.lieutenant)).toContain('protee');
    const rich = stallShelves(SHOP, NAMES, camp({ stage: 'illustre', drachmes: 5000 }), new Set(['house:villa']), '10H');
    expect(rich.houses.map((i) => i.state)).toEqual(['owned', 'on_sale']);
    expect(stallShelves(SHOP, NAMES, camp({ drachmes: 0 }), new Set(), '10H').decor[0].note).toBe('Encore 50 drachmes à gagner.');
  });
});
```

`web/src/lib/scene/hud.test.ts`: add `it('shows the purse: the number grouped, its name for screen readers (spec 2026-09-29 drachmes §1)', () => { expect(hudDrachmes(1117)).toEqual({ text: '1\u202f117', label: '1117 drachmes' }); expect(hudDrachmes(1)).toEqual({ text: '1', label: '1 drachme' }); });`. Every vitest fixture of a `CampResponse` gains `drachmes: 0, house: 'cabin'` and its dragon `worn: []`; every `WorldCatalog` fixture that is typed in full gains a `shop` (the `SHOP` above, exported from a shared place only if two files need it; else inline a minimal one).

- [ ] **Step 2: Run them to see them fail**

Run: `scripts/npm.sh run test -- src/lib/world/shop.test.ts src/lib/scene/hud.test.ts`
Expected: FAIL (`./shop` missing).

- [ ] **Step 3: Types and API** — `web/src/lib/world/types.ts`:

```ts
/** Spec 2026-09-29 drachmes §3: the house the hero lives in (the highest one owned). */
export type House = 'cabin' | 'villa' | 'palais';
/** Spec §4: where the dragon wears a piece. */
export type Slot = 'cou' | 'queue' | 'dos' | 'tete';

/** Spec §2 (R9): Hermès's stall as `/api/world` serves it; names and descriptions are in `rewards`. */
export interface ShopCatalog {
  slots: Slot[];
  slot_levels: Record<Slot, number>;
  draw_order: Slot[];
  accessories: { id: string; item: string; lieutenant: string; slot: Slot; level: number; price: number; the: string }[];
  decor: { id: string; price: number; the: string }[];
  houses: { id: string; key: 'villa' | 'palais'; stage: DragonStage; after: string | null; price: number; the: string }[];
  max_decor: Record<House, number>;
}
```

`WorldCatalog` gains `shop: ShopCatalog;`; `DragonOut` gains `/** Spec §4: the pieces worn, as manifest keys ("hydre-cou"), in draw order. */ worn: string[];`; `CampResponse` gains `/** Spec §1: the purse. */ drachmes: number;` and `/** Spec §3. */ house: House;`; `Progression` gains

```ts
  /** Spec 2026-09-29 drachmes §1: what this session paid, part by part (absent from a victory saved
   *  before the change). */
  drachmes?: { earned: number; parts: { reason: string; amount: number; lieutenant?: string; level?: number }[]; balance: number };
```

`web/src/lib/world/api.ts`: `buy: (profileId: number, item: string) => request<{ reward: RewardOut; drachmes: number }>('POST', `/api/profiles/${profileId}/purchases`, { item }),`.

- [ ] **Step 4: The stall's words** — `web/src/lib/world/shop.ts`:

```ts
// Hermès's stall in words (spec 2026-09-29 drachmes §1-§3, R11): the purse, the three shelves and each
// piece's state. Pure: the camp carries the seals, the stage and the purse, `/api/world` the stall's
// items and prices; the server decides every purchase, these words only say it. Hermès never pushes:
// no discount, no timer, no scarcity, a price is only ever a price.
import { plural, thousands } from '../text/french';
import { isAwake } from './eris';
import { sealTitleOf } from './seals';
import { DRAGON_STAGES, LIEUTENANT_ORDER, type CampResponse, type DragonStage, type House, type LieutenantKey, type ShopCatalog } from './types';

export const HOUSE_NAMES: Record<House, string> = { cabin: 'Ta cabane', villa: 'Ta villa', palais: 'Ton palais' };

/** « 1 drachme », « 1 117 drachmes ». */
export function drachmesText(n: number): string {
  return plural(n, 'drachme', 'drachmes').replace(/^\d+/, thousands(n));
}

export const purseLine = (n: number) => `Ta bourse\u202f: ${drachmesText(n)}`;
export const drachmeChip = (n: number) => `+${drachmesText(n)}`;
export const confirmQuestion = (item: { the: string; price: number }) => `Acheter ${item.the} pour ${drachmesText(item.price)}\u202f?`;

export type ItemKind = 'accessory' | 'decor' | 'house';
export const kindOfItem = (id: string): ItemKind => (id.startsWith('accessory:') ? 'accessory' : id.startsWith('house:') ? 'house' : 'decor');

/** « Au sceau de bronze de l'Hydre » (spec §2). */
export function lockedAccessoryLine(key: LieutenantKey, level: number): string {
  const t = sealTitleOf(key, level);
  return `Au ${t.charAt(0).toLowerCase()}${t.slice(1)}`;
}

const GROWN: Partial<Record<DragonStage, string>> = { adult: 'adulte', illustre: 'illustre', ancestral: 'ancestral' };
const stageAt = (s: DragonStage) => DRAGON_STAGES.indexOf(s);

/** What a house waits for (R11): the dragon's stage, the house before it, or both. */
export function houseLockedLine(h: ShopCatalog['houses'][number], stage: DragonStage, owned: ReadonlySet<string>): string {
  const grown = stageAt(stage) >= stageAt(h.stage);
  const after = h.after === null || owned.has(h.after);
  const when = `Quand ton dragon sera ${GROWN[h.stage] ?? h.stage}`;
  if (!grown && !after) return `${when}, après la villa.`;
  if (!grown) return `${when}.`;
  return 'Après la villa.';
}

export type ItemState = 'owned' | 'on_sale' | 'short' | 'locked';
export interface StallItem {
  id: string;
  name: string;
  the: string;
  price: number;
  state: ItemState;
  /** Under the piece: « À toi », what it waits for, or what the purse still needs; null when it can be bought. */
  note: string | null;
  /** Drachmes still to win for it (0 unless `short`). */
  missing: number;
}

export interface StallShelves {
  accessories: { lieutenant: LieutenantKey; items: StallItem[] }[];
  houses: StallItem[];
  decor: StallItem[];
}

/** The stall's three shelves for this hero (R6, R11): Protée's group only from 8H. */
export function stallShelves(
  shop: ShopCatalog,
  rewards: Record<string, { name: string }>,
  camp: Pick<CampResponse, 'lieutenants' | 'dragon' | 'drachmes'>,
  owned: ReadonlySet<string>,
  heroLevel: string,
): StallShelves {
  const levels = Object.fromEntries(camp.lieutenants.map((l) => [l.key, l.level])) as Record<string, number>;
  const item = (id: string, the: string, price: number, onSale: boolean, locked: string): StallItem => {
    const base = { id, name: rewards[id]?.name ?? the, the, price, missing: 0 };
    if (owned.has(id)) return { ...base, state: 'owned', note: 'À toi' };
    if (!onSale) return { ...base, state: 'locked', note: locked };
    const missing = Math.max(0, price - camp.drachmes);
    return missing > 0 ? { ...base, state: 'short', note: `Encore ${drachmesText(missing)} à gagner.`, missing } : { ...base, state: 'on_sale', note: null };
  };
  const accessories = LIEUTENANT_ORDER.filter((k) => isAwake(k, heroLevel)).map((k) => ({
    lieutenant: k,
    items: shop.accessories
      .filter((a) => a.lieutenant === k)
      .map((a) => item(a.id, a.the, a.price, (levels[k] ?? 0) >= a.level, lockedAccessoryLine(k, a.level))),
  }));
  const stage = camp.dragon.stage;
  const houses = shop.houses.map((h) =>
    item(h.id, h.the, h.price, stageAt(stage) >= stageAt(h.stage) && (h.after === null || owned.has(h.after)), houseLockedLine(h, stage, owned)),
  );
  const decor = shop.decor.map((d) => item(d.id, d.the, d.price, true, ''));
  return { accessories, houses, decor };
}
```

(`isAwake(key, level)` is sub-project 2's; if its parameter order differs, follow it.)

`web/src/lib/scene/hud.ts`: `import { plural, thousands } from '../text/french';` and

```ts
/** The HUD's purse (spec 2026-09-29 drachmes §1, R14): the number, and its name for screen readers. */
export function hudDrachmes(n: number): { text: string; label: string } {
  return { text: thousands(n), label: plural(n, 'drachme', 'drachmes') };
}
```

- [ ] **Step 5: The HUD** — `web/src/components/scene/Hud.svelte`: header comment gains « the purse beside the laurel (spec 2026-09-29 drachmes §1) »; import `MARK_ICONS` from art and `hudDrachmes`; `const purse = $derived(camp ? hudDrachmes(camp.drachmes) : null);`; the centre becomes

```svelte
  <div class="hud-center">
    {#if xp && !band}
      <LaurelBar value={xp.value} max={xp.max} label={xp.label} testId="hud-xp" />
    {/if}
    {#if purse && !band}
      <!-- R14: the painted coin and the balance, right of the laurel; not a link. -->
      <span class="hud-drachmes" data-testid="hud-drachmes" role="img" aria-label={purse.label}>
        <img src={MARK_ICONS.drachme} alt="" draggable="false" /><span aria-hidden="true">{purse.text}</span>
      </span>
    {/if}
  </div>
```

and CSS:

```css
  .hud-center {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .hud-drachmes {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 40px;
    padding: 2px 12px 2px 4px;
    border-radius: 999px;
    border: 1px solid var(--bronze-light);
    background: rgba(21, 18, 26, 0.6);
    color: var(--bronze-ink);
    font-family: var(--font-body);
    font-weight: 700;
    font-size: 18px;
    white-space: nowrap;
  }
  .hud-drachmes img {
    width: 28px;
    height: 28px;
    object-fit: contain;
  }
```

(if `.hud-center` already has rules, merge; `rgba(21, 18, 26, 0.6)` is the HUD's existing chip background, so `placesKit`/`app.css` accept it as they accept the chip's.) The HUD's centre grows by about 90 px: at 1180 px wide the grid's `1fr auto 1fr` still leaves the hero chip (≤ 260 px) and the right controls their room.

- [ ] **Step 6: The victory's chip** — `web/src/components/battle/VictorySpoils.svelte`: import `MARK_ICONS` (already importing `ART`, add it) and `drachmeChip` from `'../../lib/world/shop'`; `const drachmesEarned = $derived(progression.drachmes?.earned ?? 0);`; right after the `{#each …}` of the XP chips (sub-project 1's, `data-testid="xp-chip"`), inside the same container and with the same element and class as an XP chip:

```svelte
    {#if drachmesEarned > 0}
      <!-- Spec 2026-09-29 drachmes §1 (R15): the session's drachmes, after its XP. -->
      <span class="{XP_CHIP_CLASSES} drachme-chip" data-testid="drachme-chip">
        <img class="chip-coin" src={MARK_ICONS.drachme} alt="" draggable="false" />{drachmeChip(drachmesEarned)}
      </span>
    {/if}
```

where `{XP_CHIP_CLASSES}` stands for the literal class list the XP chip carries in that file (copy it). CSS: `.chip-coin { width: 20px; height: 20px; object-fit: contain; vertical-align: -4px; margin-right: 4px; }`.

- [ ] **Step 7: The e2e** — `web/e2e/scenes-camp.spec.ts`: add

```ts
// Spec 2026-09-29 drachmes §1 (R14): the purse beside the XP laurel, in every place's HUD.
test('the HUD shows the purse beside the laurel', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const text = await createText(request, { title: uniqueName(`Bourse ${testInfo.project.name}`), body: 'Les fées dansent dans la clairière.', level: '10H' });
  const res = await postSession(request, { profileId: id, textId: text.id, day: swissDay(0), result: makeResult({ words: 1000, draft: 4, caught: 4 }) });
  await page.goto(`/#/p/${id}/camp`);
  await expectCamp(page);
  const purse = page.getByTestId('hud-drachmes');
  await expect(purse).toHaveText(String(res.progression.drachmes.balance));
  await expect(purse).toHaveAttribute('aria-label', `${res.progression.drachmes.balance} drachmes`);
  const [laurel, coin] = [await page.getByTestId('hud-xp').boundingBox(), await purse.boundingBox()];
  expect(coin!.x).toBeGreaterThan(laurel!.x + laurel!.width - 1);
  expect(await labelOverlaps(page, 'camp')).toEqual([]);
});
```

(import what the file lacks from `./helpers`; `heroName` is the file's hero namer.) `web/e2e/scenes-battle-victory.spec.ts`: the `progression()` builder gains `drachmes: { earned: 12, parts: [{ reason: 'session', amount: 12 }], balance: 40 }`; add

```ts
// Spec 2026-09-29 drachmes §1 (R15): the victory's chips add the drachmes; a saved victory has none.
test('the victory adds « +12 drachmes » after the XP chips', async ({ page, request }, testInfo) => {
  const sheet = await counted(page, request, `Vic40-${testInfo.project.name}`, progression({}));
  await expect(sheet.getByTestId('drachme-chip')).toHaveText('+12 drachmes');
  await expect(sheet.getByTestId('drachme-chip').locator('img')).toHaveAttribute('src', '/art/icons/drachme.webp');
});

test('a victory saved before the drachmes shows no drachme chip', async ({ page, request }, testInfo) => {
  const sheet = await counted(page, request, `Vic41-${testInfo.project.name}`, progression({ drachmes: undefined }));
  await expect(sheet.getByTestId('xp-chip').first()).toBeVisible();
  await expect(sheet.getByTestId('drachme-chip')).toHaveCount(0);
  await expect(sheet).not.toContainText('undefined');
});
```

(`counted` and `progression` are the file's helpers since sub-project 2; the test names' `Vic40`/`Vic41` avoid the numbers in use: check and pick free ones.)

- [ ] **Step 8: Run**

Run: `scripts/npm.sh run test` ; `scripts/npm.sh run check` ; `STACK=prog scripts/playwright.sh scenes-camp.spec.ts scenes-battle-victory.spec.ts --repeat-each=3`
Then once, every spec that measures the HUD band (`grep -ln "hud-xp\|hud-hero\|expectOverlayClearsScene" web/e2e/*.spec.ts`): `STACK=prog scripts/playwright.sh <those files>`.
Expected: all pass, `0 errors and 0 warnings`.

- [ ] **Step 9: Commit**

```bash
git add web/src/lib/world/shop.ts web/src/lib/world/shop.test.ts web/src/lib/world/types.ts web/src/lib/world/api.ts web/src/lib/scene/hud.ts web/src/lib/scene/hud.test.ts web/src/components/scene/Hud.svelte web/src/components/battle/VictorySpoils.svelte web/e2e/scenes-camp.spec.ts web/e2e/scenes-battle-victory.spec.ts
git commit -m "The purse: drachmes on the HUD beside the XP laurel and « +12 drachmes » on the victory; the stall's shelves and words as pure rules (owned, affordable, short, locked by a seal or the dragon's stage, Protée from 8H); client types and the purchase call

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/lib/world/shop.ts web/src/lib/world/shop.test.ts web/src/lib/world/types.ts web/src/lib/world/api.ts web/src/lib/scene/hud.ts web/src/lib/scene/hud.test.ts web/src/components/scene/Hud.svelte web/src/components/battle/VictorySpoils.svelte web/e2e/scenes-camp.spec.ts web/e2e/scenes-battle-victory.spec.ts
```

(add every fixture file Step 1 touched to both lists.)

---

### Task 5: Hermès's stall

**Files:**
- Create: `content/dialogue/stall.json`, `web/src/components/places/camp/StallPanel.svelte`, `web/e2e/scenes-stall.spec.ts`
- Modify: `web/src/lib/scene/types.ts` (`SpeakerId`), `web/src/lib/dialogue/types.ts`, `web/src/lib/dialogue/content.ts`, `web/src/lib/dialogue/speakers.ts`, `web/src/lib/world/voices.ts`, `web/src/lib/world/places.ts`, `web/src/lib/world/scenes/camp.shapes.ts`, `web/src/lib/world/scenes/camp.ts`, `web/src/screens/Camp.svelte`
- Test: `web/src/lib/dialogue/content.test.ts`, `web/src/lib/world/places.test.ts`, `web/src/lib/world/scenes/camp.test.ts`, `web/e2e/scenes-camp.spec.ts` (the place count, the debug outlines)

**Interfaces:**
- Consumes: Task 3's art, Task 4's `stallShelves`, `confirmQuestion`, `purseLine`, `kindOfItem`, `worldApi.buy`; `sayKey`; `refreshCamp`, `campFor`, `campStore`; `go`, `closePanel`, `hotspotHref`, `hotspotSelector`.
- Produces: `SpeakerId` with `'hermes'`; `hermes(text)` in `voices.ts`; dialogue keys `stall.enter`, `stall.bought.accessory`, `stall.bought.decor`, `stall.bought.house`; `PanelId` `'etal'`; the camp hotspot `stall`; `StallPanel` (`{ profile, onBought: (kind: ItemKind) => void }`).

- [ ] **Step 1: Hermès's lines** — `content/dialogue/stall.json` (plain spaces; `frenchSpacing()` adds the thin ones at display):

```json
{
  "lines": {
    "stall.enter": [
      { "speaker": "hermes", "text": "Bienvenue à mon étal ! Regarde tout à ton aise, rien ne presse." },
      { "speaker": "hermes", "text": "Ah, te voilà ! J'arrive de l'Olympe avec quelques merveilles. Prends ton temps." },
      { "speaker": "hermes", "text": "Mes sandales ont fait le tour de la Grèce pour remplir ces étagères. Regarde, simplement." },
      { "speaker": "hermes", "text": "Salut à toi ! Chaque objet ici a sa petite histoire. Demande-moi, je les connais toutes." }
    ],
    "stall.bought.accessory": [
      { "speaker": "hermes", "text": "Belle parure ! Passe au nid pour en habiller ton dragon." },
      { "speaker": "hermes", "text": "Ton dragon va se tenir plus droit que jamais. Le nid t'attend pour l'essayage." },
      { "speaker": "hermes", "text": "Un travail d'artisan de Corinthe ! Au nid, ton dragon pourra s'en parer." },
      { "speaker": "hermes", "text": "Emballée dans une feuille de vigne ! Ton dragon la trouvera dans son nid." }
    ],
    "stall.bought.decor": [
      { "speaker": "hermes", "text": "Un bel objet pour une belle demeure. Il t'attend parmi tes trésors." },
      { "speaker": "hermes", "text": "Livré par mes sandales ailées ! Ouvre tes trésors pour l'exposer au mur." },
      { "speaker": "hermes", "text": "Tes murs vont briller ! L'objet t'attend parmi tes trésors, dans ta maison." },
      { "speaker": "hermes", "text": "Voilà qui fera parler tout le camp. Tu le trouveras parmi tes trésors." }
    ],
    "stall.bought.house": [
      { "speaker": "hermes", "text": "Les clés sont à toi ! Tes affaires ont déjà déménagé, par la voie des airs." },
      { "speaker": "hermes", "text": "Une demeure digne de ton camp ! Ton dragon voudra la visiter tout de suite." },
      { "speaker": "hermes", "text": "Marché conclu ! Tes trophées et tes décors t'attendent déjà dans ta nouvelle maison." },
      { "speaker": "hermes", "text": "J'ai porté chaque meuble moi-même, d'un seul coup d'ailes. Bonne installation !" }
    ]
  }
}
```

(« Emballée » agrees with « la parure », not with the player: `GENDERED` only looks at « tu es … » forms; if the guard flags it anyway, use « Emballé dans une feuille de vigne ! Ton dragon trouvera son cadeau dans son nid. ».)

- [ ] **Step 2: Write the failing tests** — `web/src/lib/dialogue/content.test.ts`: the files list gains `'stall.json'` (sorted: `…, 'nest.json', 'stall.json', 'war.json'`); add

```ts
  // Spec 2026-09-29 drachmes §2: Hermès never pushes: no price, no delay, no scarcity in his mouth.
  it('lets Hermès welcome and thank, never press', () => {
    const lines = every.filter((x) => x.line.speaker === 'hermes');
    expect(lines.length).toBeGreaterThanOrEqual(12);
    for (const { where, line } of lines) {
      expect(line.text, where).not.toMatch(/\d|drachme|prix|promo|remise|réduc|solde|vite|dernière|dernier|plus que|seulement|aujourd'hui|demain|bientôt|avant que|stock|rare/i);
    }
  });
```

`web/src/lib/world/places.test.ts`: `expect(placeFor(matchRoute('#/p/3/camp?panel=etal'))).toEqual({ place: 'camp', panel: 'etal' });` and `expect(OVERLAY_TITLES.etal).toBe("L'étal d'Hermès");`. `web/src/lib/world/scenes/camp.test.ts`: the hotspot ids list gains `'stall'`; add

```ts
  it('puts Hermès's stall on its painted box, inside the safe zone, above the dragon (spec 2026-09-29 drachmes §2, R18)', () => {
    const stall = CAMP_HOTSPOTS.find((h) => h.id === 'stall')!;
    expect(stall).toMatchObject({ label: "L'étal d'Hermès", target: 'camp', query: { panel: 'etal' }, labelPos: 'above', leader: true });
    expect(CAMP_SHAPES.stall).toEqual({ kind: 'polygon', points: [[12.5, 21], [21.8, 21], [21.8, 40], [12.5, 40]] });
    expect(validateScene(CAMP_SCENE)).toEqual([]);
  });
```

(`validateScene` is the name `lib/scene/validate.ts` exports; use the file's own if it differs.)

- [ ] **Step 3: Run them to see them fail**

Run: `scripts/npm.sh run test -- src/lib/dialogue src/lib/world/places.test.ts src/lib/world/scenes/camp.test.ts`
Expected: FAIL (unknown speaker `hermes`, unknown keys).

- [ ] **Step 4: Hermès speaks** —
  - `web/src/lib/scene/types.ts`: `export type SpeakerId = 'dragon' | 'pythia' | 'owl' | 'eris' | 'hermes';`
  - `web/src/lib/world/voices.ts`: `export const hermes = (text: string): DialogueLine => ({ speaker: 'hermes', name: 'Hermès', portrait: ART.characters.hermes, text });` (comment « Spec 2026-09-29 drachmes §2: the merchant at his stall. »)
  - `web/src/lib/dialogue/speakers.ts`: import `hermes`; `case 'hermes': return frame(hermes(''));`; the header comment names Hermès.
  - `web/src/lib/dialogue/content.ts`: `import stall from '@content/dialogue/stall.json';`, `SPEAKERS` gains `'hermes'`, `FILES` gains `stall`.
  - `web/src/lib/dialogue/types.ts`: `DIALOGUE_KEYS` gains `'stall.enter', 'stall.bought.accessory', 'stall.bought.decor', 'stall.bought.house',` after `'cabin.enter'`.
  - `grep -rn "'eris'" web/src/components/scene web/src/lib/dialogue --include=*.svelte --include=*.ts` : any switch or map over speakers (a portrait frame colour, a `data-speaker` style) gains `hermes` with the Pythia's treatment.
- [ ] **Step 5: The panel route and the hotspot** — `web/src/lib/world/places.ts`: `PanelId` gains `| 'etal'`; `OVERLAY_TITLES` gains `etal: "L'étal d'Hermès",`; `placeFor`'s camp case: `return { place: 'camp', panel: route.query.panel === 'heros' || route.query.panel === 'etal' ? route.query.panel : null };`.

`web/src/lib/world/scenes/camp.shapes.ts`: header comment gains « Hermès's stall (sub-project 4, `hub_camp.webp` now carries it; style guide phase 3: box x 10.5-21.8, y 20.8-44.8) is clipped to the iPad safe zone on the left and ends at y 40, above the dragon's head, which covers the counter below (R18). »; `CAMP_SHAPES` gains `stall: { kind: 'polygon', points: [[12.5, 21], [21.8, 21], [21.8, 40], [12.5, 40]] },` after `dragon`.

`web/src/lib/world/scenes/camp.ts`, in `CAMP_HOTSPOTS` after the dragon's:

```ts
  // Spec 2026-09-29 drachmes §2 (R10, R18): Hermès's stall opens as an overlay of the camp; no caption
  // and no glow of its own: nothing here ever calls the player in.
  { id: 'stall', label: "L'étal d'Hermès", target: 'camp', query: { panel: 'etal' }, shape: CAMP_SHAPES.stall, labelPos: 'above', leader: true, state: place('stall') },
```

(the header comment's « six places » becomes « six places and Hermès's stall »).

- [ ] **Step 6: The panel** — `web/src/components/places/camp/StallPanel.svelte`:

```svelte
<script lang="ts">
  // L'étal d'Hermès (spec 2026-09-29 drachmes §2, R10-R12): Hermès at the head of his stall, the purse,
  // and three shelves: the dragon's accessories by lieutenant, the houses, the decor. Every piece is
  // shown ahead with what it waits for (ethics: nothing hidden, nothing drawn by lot); buying asks one
  // question in the piece's own cubby, then Hermès thanks (the overlay's voice, `onBought`). The server
  // decides every purchase; a refusal says why and refreshes the purse.
  import { worldApi } from '../../../lib/world/api';
  import { ApiError } from '../../../lib/api';
  import { ART, MARK_ICONS, rewardIcon } from '../../../lib/world/art';
  import { campFor, campStore, refreshCamp } from '../../../lib/world/campStore.svelte';
  import { lieutenantName } from '../../../lib/world/eris';
  import { accessoryPicture } from '../../../lib/world/accessories';
  import { confirmQuestion, drachmesText, kindOfItem, purseLine, stallShelves, type ItemKind, type StallItem } from '../../../lib/world/shop';
  import { playSfx, unlockAudio } from '../../../lib/juice/sfx';
  import type { RewardOut } from '../../../lib/world/types';
  import type { Profile } from '../../../lib/types';

  let { profile, onBought }: { profile: Profile; onBought: (kind: ItemKind) => void } = $props();

  const camp = $derived(campFor(profile.id));
  let owned = $state<RewardOut[] | null>(null);
  let error = $state('');
  $effect(() => {
    const id = profile.id;
    owned = null;
    worldApi.rewards(id).then((list) => (owned = list)).catch((e) => {
      owned = [];
      error = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
    });
  });
  const ownedIds = $derived(new Set((owned ?? []).map((r) => r.id)));
  const shelves = $derived(
    camp && campStore.catalog && owned ? stallShelves(campStore.catalog.shop, campStore.catalog.rewards, camp, ownedIds, profile.level) : null,
  );

  let asking = $state<string | null>(null);
  let buying = $state(false);

  function picture(it: StallItem): string {
    const kind = kindOfItem(it.id);
    if (kind === 'house') return it.id === 'house:villa' ? ART.scenes.villa : ART.scenes.palais;
    if (kind === 'decor') return rewardIcon(it.id) ?? '';
    return accessoryPicture(it.id.slice('accessory:'.length), camp?.dragon.stage ?? 'adult') ?? '';
  }

  async function buy(it: StallItem) {
    buying = true;
    error = '';
    try {
      const res = await worldApi.buy(profile.id, it.id);
      owned = [...(owned ?? []), res.reward];
      unlockAudio();
      playSfx('chime');
      onBought(kindOfItem(it.id));
    } catch (e) {
      error = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
    } finally {
      buying = false;
      asking = null;
      await refreshCamp(profile.id); // the purse, here and on the HUD (review focus 1)
    }
  }
</script>

{#snippet piece(it: StallItem)}
  <li class="kit-cubby stall-item" class:is-empty={it.state === 'locked'} data-testid="stall-item-{it.id}" data-state={it.state}>
    <img class="stall-pic" class:house={kindOfItem(it.id) === 'house'} class:silhouette={it.state === 'locked'} src={picture(it)} alt="" draggable="false" />
    <h4 class="stall-name">{it.name}</h4>
    <p class="stall-price"><img class="coin" src={MARK_ICONS.drachme} alt="" draggable="false" />{drachmesText(it.price)}</p>
    {#if asking === it.id}
      <div class="stall-ask" role="group" aria-labelledby="ask-{it.id}">
        <p id="ask-{it.id}">{confirmQuestion(it)}</p>
        <button type="button" class="kit-bronze" data-testid="stall-confirm" disabled={buying} onclick={() => buy(it)}>Acheter</button>
        <button type="button" class="kit-bronze is-quiet" data-testid="stall-cancel" disabled={buying} onclick={() => (asking = null)}>Non, merci</button>
      </div>
    {:else if it.state === 'on_sale'}
      <button type="button" class="kit-bronze" data-testid="stall-buy-{it.id}" onclick={() => ((asking = it.id), (error = ''))}>Acheter</button>
    {:else}
      <p class="stall-note" data-testid="stall-note-{it.id}">{it.note}</p>
    {/if}
  </li>
{/snippet}

<div class="panel-stall">
  <div class="stall-head">
    <img class="hermes" src={ART.characters.hermes} alt="Hermès" draggable="false" />
    {#if camp}<p class="purse" data-testid="stall-purse"><img class="coin" src={MARK_ICONS.drachme} alt="" draggable="false" />{purseLine(camp.drachmes)}</p>{/if}
  </div>
  {#if error}<p class="kit-note" data-tone="eris" role="alert" data-testid="stall-error">{error}</p>{/if}
  {#if !shelves}
    <p class="muted">Hermès déballe ses marchandises…</p>
  {:else}
    <section data-testid="stall-accessories">
      <h3 class="kit-section">Parures du dragon</h3>
      {#each shelves.accessories as group (group.lieutenant)}
        <h4 class="stall-group" data-testid="stall-group-{group.lieutenant}">{lieutenantName(group.lieutenant)}</h4>
        <ul class="cubbies">{#each group.items as it (it.id)}{@render piece(it)}{/each}</ul>
      {/each}
    </section>
    <section data-testid="stall-houses">
      <h3 class="kit-section">La maison</h3>
      <ul class="cubbies">{#each shelves.houses as it (it.id)}{@render piece(it)}{/each}</ul>
    </section>
    <section data-testid="stall-decor">
      <h3 class="kit-section">Décor</h3>
      <ul class="cubbies">{#each shelves.decor as it (it.id)}{@render piece(it)}{/each}</ul>
    </section>
  {/if}
</div>
```

`accessoryPicture` comes from Task 6; until then define it here as a local placeholder? **No**: Task 5 adds `web/src/lib/world/accessories.ts` with only

```ts
// The dragon's accessories on screen (spec 2026-09-29 drachmes §4). Task 6 adds the manifest and the overlays.
import type { DragonStage } from './types';

/** The stall's and the parure's picture of a piece (R11): its overlay at the dragon's stage, the adult's
 *  before the young dragon; null until the manifest has the piece. */
export function accessoryPicture(_item: string, _stage: DragonStage): string | null {
  return null;
}
```

and the shelf shows the piece with no picture (an empty `src` renders nothing: the `img` gets `hidden={!src}`; write `{#if picture(it)}<img …/>{:else}<span class="stall-pic empty" aria-hidden="true"></span>{/if}` instead of the bare `img`). Task 6 fills `accessoryPicture` in.

CSS (tokens only; the cubbies are `TrophiesPanel`'s look):

```css
  .panel-stall {
    display: flex;
    flex-direction: column;
    gap: 22px;
  }
  .stall-head {
    display: flex;
    align-items: flex-end;
    gap: 18px;
  }
  .hermes {
    height: 180px;
    width: auto;
    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.45));
  }
  .purse,
  .stall-price {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    font-weight: 700;
  }
  .purse {
    font-size: 20px;
  }
  .coin {
    width: 26px;
    height: 26px;
    object-fit: contain;
  }
  .stall-group {
    margin: 14px 0 8px;
    font-variant: small-caps;
  }
  .cubbies {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 16px;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .stall-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    text-align: center;
  }
  .stall-pic {
    width: 96px;
    height: 96px;
    object-fit: contain;
  }
  .stall-pic.house {
    width: 160px;
    height: 90px;
    object-fit: cover;
    border-radius: 4px;
  }
  .stall-pic.silhouette {
    filter: brightness(0) opacity(0.55);
  }
  .stall-name,
  .stall-note,
  .stall-ask p {
    margin: 0;
  }
  .stall-note {
    font-style: italic;
    font-size: 14px;
  }
  .stall-ask {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
  }
```

(the silhouette matches `Medallion`'s `.silhouette`; a house's painted room is a picture, not a silhouette: when locked it is darkened the same way. If `placesKit` asks for the kit's own class for the cubby text colours, use the ones `TrophiesPanel` uses.)

- [ ] **Step 7: The camp opens it** — `web/src/screens/Camp.svelte`: imports `Overlay`, `StallPanel`, `sayKey` from `'../lib/dialogue/select'`, `go`, `closePanel` (with `openPanel`… already imported from `panelNav`), `OVERLAY_TITLES`, `sceneHref`, `type ItemKind` from `'../lib/world/shop'`, `type DialogueLine`; in `activate`, before `leaveTo(to)`:

```ts
    // Spec 2026-09-29 drachmes §2 (R10): the stall is an overlay of the camp: no night fade, no leaving.
    if (def.query?.panel) {
      go(to, 'panel');
      return;
    }
```

(and drop the `unlockAudio(); playSfx('tap');` duplication for that branch: `go` plays the tap); then

```ts
  // Hermès speaks on the stall's voice plate: his welcome, then his thanks after a purchase (R13).
  let stallVoice = $state<DialogueLine | null>(null);
  $effect(() => {
    if (panel === 'etal') stallVoice = untrack(() => sayKey('stall.enter'));
  });
  const bought = (kind: ItemKind) => (stallVoice = sayKey(`stall.bought.${kind}`));
  const closeStall = () => closePanel(sceneHref('camp', profile.id));
```

(import `untrack` from `svelte`), and after `</PlaceScene>`:

```svelte
{#if panel === 'etal'}
  <Overlay variant="table" size="wide" title={OVERLAY_TITLES.etal} testId="overlay-stall" voice={stallVoice} onClose={closeStall} returnFocus={hotspotSelector('camp', 'stall')}>
    <StallPanel {profile} onBought={bought} />
  </Overlay>
{/if}
```

The camp's header comment gains « Hermès's stall opens here as an overlay (`?panel=etal`, spec 2026-09-29 drachmes §2) ». The `?panel=heros` hand-over effect is unchanged.

- [ ] **Step 8: Run the unit tests and the check**

Run: `scripts/npm.sh run test` ; `scripts/npm.sh run check`
Expected: all pass, `0 errors and 0 warnings`.

- [ ] **Step 9: The e2e** — `web/e2e/scenes-camp.spec.ts`: the list of camp places (and the `?debug` outline count) gains `camp-stall` (7 outlines). `web/e2e/scenes-stall.spec.ts`:

```ts
// Spec 2026-09-29 drachmes §2 (R10-R13): Hermès's stall on the camp. desktop + ipad.
import { test, expect } from './crashGuard';
import type { Page, TestInfo } from '@playwright/test';
import {
  createProfileApi, createText, expectCamp, expectInWorldOverlay, expectLineOf, expectOverlayTapTargets,
  heroNamer, labelOverlaps, makeResult, postSession, redScan, swissDay, tap, uniqueName, variantsOf,
} from './helpers';

const heroName = heroNamer('Étal');

async function openStall(page: Page, id: number, testInfo: TestInfo) {
  await page.goto(`/#/p/${id}/camp`);
  await expectCamp(page);
  await tap(page.getByTestId('camp-stall'), testInfo);
  await expect(page.getByTestId('overlay-stall')).toBeVisible();
  await expect(page).toHaveURL(/\/camp\?panel=etal$/);
}

test('the stall: its plaque on the painted stall, three shelves, everything shown ahead', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/camp`);
  await expectCamp(page);
  await expect(page.getByTestId('camp-stall')).toContainText("L'étal d'Hermès");
  for (const size of [{ width: 1280, height: 720 }, { width: 1180, height: 820 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(size);
    expect(await labelOverlaps(page, 'camp'), `${size.width}x${size.height}`).toEqual([]);
  }
  await openStall(page, id, testInfo);
  const stall = page.getByTestId('overlay-stall');
  await expectInWorldOverlay(page, 'overlay-stall', 'camp', true, 'table', await stall.getByTestId('overlay-voice').innerText());
  await expectLineOf(stall.getByTestId('overlay-voice'), 'stall.enter');
  await expect(stall.getByTestId('stall-purse')).toHaveText('Ta bourse\u202f: 0 drachme');
  await expect(stall.getByRole('heading', { level: 3 })).toHaveText(['Parures du dragon', 'La maison', 'Décor']);
  const collar = stall.getByTestId('stall-item-accessory:hydre-cou');
  await expect(collar).toHaveAttribute('data-state', 'locked');
  await expect(collar).toContainText("Collier d'écailles vertes");
  await expect(collar).toContainText("Au sceau de bronze de l'Hydre");
  await expect(stall.getByTestId('stall-item-accessory:lethe-tete')).toContainText("Au sceau d'orichalque de Léthé");
  await expect(stall.getByTestId('stall-item-house:villa')).toContainText('Quand ton dragon sera adulte.');
  await expect(stall.getByTestId('stall-item-decor:amphore')).toHaveAttribute('data-state', 'short');
  await expect(stall.getByTestId('stall-item-decor:amphore')).toContainText('Encore 50 drachmes à gagner.');
  await expect(stall).not.toContainText(/niveau|promo|dernière chance|remise/i);
  await expectOverlayTapTargets(page, 'overlay-stall');
  expect(await redScan(page)).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('overlay-stall')).toHaveCount(0);
  await expect(page.getByTestId('camp-stall')).toBeFocused();
});

test("Protée's set appears from 8H", async ({ page, request }, testInfo) => {
  const young = await createProfileApi(request, heroName(testInfo.project.name), '7H');
  await openStall(page, young, testInfo);
  await expect(page.getByTestId('stall-group-hydre')).toBeVisible();
  await expect(page.getByTestId('stall-group-protee')).toHaveCount(0);
  const older = await createProfileApi(request, heroName(testInfo.project.name), '8H');
  await openStall(page, older, testInfo);
  await expect(page.getByTestId('stall-group-protee')).toHaveText('Protée');
});

test('buying asks once, Hermès thanks, the piece is owned and the purse goes down', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const text = await createText(request, { title: uniqueName(`Étal ${testInfo.project.name}`), body: 'Les fées dansent dans la clairière.', level: '10H' });
  const res = await postSession(request, { profileId: id, textId: text.id, day: swissDay(0), result: makeResult({ words: 1000, draft: 4, caught: 4 }) });
  const before: number = res.progression.drachmes.balance;
  expect(before).toBeGreaterThanOrEqual(50);
  await openStall(page, id, testInfo);
  const stall = page.getByTestId('overlay-stall');
  const amphora = stall.getByTestId('stall-item-decor:amphore');
  await tap(amphora.getByTestId('stall-buy-decor:amphore'), testInfo);
  await expect(amphora).toContainText("Acheter l'amphore peinte pour 50 drachmes\u202f?");
  await tap(amphora.getByTestId('stall-cancel'), testInfo);
  await expect(amphora).toHaveAttribute('data-state', 'on_sale');
  await tap(amphora.getByTestId('stall-buy-decor:amphore'), testInfo);
  await tap(amphora.getByTestId('stall-confirm'), testInfo);
  await expect(amphora).toHaveAttribute('data-state', 'owned');
  await expect(amphora).toContainText('À toi');
  await expectLineOf(stall.getByTestId('overlay-voice'), 'stall.bought.decor');
  await expect(stall.getByTestId('stall-purse')).toHaveText(`Ta bourse\u202f: ${before - 50} drachmes`);
  await expect(page.getByTestId('hud-drachmes')).toHaveText(String(before - 50));
  // The shelf in the cabin knows it: « Exposer » is there.
  await page.goto(`/#/p/${id}/cabane?panel=tresors`);
  await expect(page.getByTestId('cabin-reward-decor:amphore')).toHaveAttribute('data-owned', 'true');
});

// Review focus 1: a purse spent elsewhere (another tablet) since the page was drawn.
test('a purchase refused by the server says why and the purse refreshes', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const text = await createText(request, { title: uniqueName(`Étal ${testInfo.project.name}`), body: 'Les fées dansent dans la clairière.', level: '10H' });
  const res = await postSession(request, { profileId: id, textId: text.id, day: swissDay(0), result: makeResult({ words: 1000, draft: 4, caught: 4 }) });
  await openStall(page, id, testInfo);
  const stall = page.getByTestId('overlay-stall');
  await tap(stall.getByTestId('stall-buy-decor:chouette'), testInfo);
  // Meanwhile, elsewhere: the purse is spent down below 50.
  let left: number = res.progression.drachmes.balance;
  for (const item of ['decor:amphore', 'decor:mosaique', 'decor:bouclier']) {
    if (left < 50) break;
    expect((await request.post(`/api/profiles/${id}/purchases`, { data: { item } })).status()).toBe(201);
    left -= 50;
  }
  await tap(stall.getByTestId('stall-confirm'), testInfo);
  await expect(stall.getByTestId('stall-error')).toHaveText("Ta bourse n'est pas encore assez pleine pour cet objet.");
  await expect(stall.getByTestId('stall-purse')).toContainText(`${left} drachme`);
  await expect(stall.getByTestId('stall-item-decor:chouette')).toHaveAttribute('data-state', 'short');
});
```

(`expectLineOf(box, key)` checks the box holds one of the key's variants; `expectInWorldOverlay`'s last argument is the voice text or null: read the helper's signature and pass what it asks. If the 1 000-word session pays under 150, the refusal test spends only what it can: `left < 50` ends the loop, as written.)

- [ ] **Step 10: Run the e2e**

Run: `STACK=prog scripts/playwright.sh scenes-stall.spec.ts --repeat-each=3` ; `STACK=prog scripts/playwright.sh scenes-camp.spec.ts`
Expected: all pass on both projects. If `labelOverlaps` reports `camp-stall label over camp-oracle`, apply R18's fallback (the Oracle's two left points to x 24, in `camp.shapes.ts`, with a comment), and run both specs again.

- [ ] **Step 11: Commit**

```bash
git add content/dialogue/stall.json web/src/components/places/camp/StallPanel.svelte web/src/lib/world/accessories.ts web/src/lib/scene/types.ts web/src/lib/dialogue/types.ts web/src/lib/dialogue/content.ts web/src/lib/dialogue/content.test.ts web/src/lib/dialogue/speakers.ts web/src/lib/world/voices.ts web/src/lib/world/places.ts web/src/lib/world/places.test.ts web/src/lib/world/scenes/camp.shapes.ts web/src/lib/world/scenes/camp.ts web/src/lib/world/scenes/camp.test.ts web/src/screens/Camp.svelte web/e2e/scenes-stall.spec.ts web/e2e/scenes-camp.spec.ts
git commit -m "Hermès's stall on the camp: the hotspot on the painted stall, the overlay with Hermès and the purse, three shelves (the dragon's parures by lieutenant, the houses, the decor) each piece shown ahead with what it waits for, one question before buying, Hermès's thanks from his own content file (he never presses)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- content/dialogue/stall.json web/src/components/places/camp/StallPanel.svelte web/src/lib/world/accessories.ts web/src/lib/scene/types.ts web/src/lib/dialogue/types.ts web/src/lib/dialogue/content.ts web/src/lib/dialogue/content.test.ts web/src/lib/dialogue/speakers.ts web/src/lib/world/voices.ts web/src/lib/world/places.ts web/src/lib/world/places.test.ts web/src/lib/world/scenes/camp.shapes.ts web/src/lib/world/scenes/camp.ts web/src/lib/world/scenes/camp.test.ts web/src/screens/Camp.svelte web/e2e/scenes-stall.spec.ts web/e2e/scenes-camp.spec.ts
```

(add the speaker-map files Step 4's grep changed.)

---

### Task 6: Dressing the dragon

**Files:**
- Create: `tools/art/accessory_manifest.py`, `web/src/lib/world/accessories.json`, `web/src/lib/world/accessories.test.ts`, `web/src/components/DragonFigure.svelte`, `web/e2e/scenes-parure.spec.ts`
- Move: `assets/art/export/dragon/accessories/*.webp` → `web/public/art/dragon/accessories/` (96 files)
- Modify: `web/src/lib/world/accessories.ts`, `web/src/components/Dragon.svelte`, `web/src/components/scene/SceneLayer.svelte`, `web/src/components/battle/Combatant.svelte`, `web/src/components/battle/BattleStage.svelte`, `web/src/components/battle/VictorySpoils.svelte`, `web/src/screens/Camp.svelte`, `web/src/screens/Nest.svelte`, `web/src/components/places/nest/CarePanel.svelte`, `docs/art/style-guide.md`
- Test: `web/src/lib/world/art.test.ts`

**Interfaces:**
- Consumes: `dragon.worn` (Task 2), `worldApi.rewards`, `worldApi.patchReward`, `replaceCamp`, `refreshCamp`.
- Produces: `lib/world/accessories.ts`: `SLOTS`, `DRAW_ORDER`, `WEARING`, `SLOT_NAMES`, `ACCESSORY_MANIFEST`, `accessorySrc(file)`, `accessoryLayers(worn, stage): OverlayLayer[]`, `accessoryPicture(item, stage)`, `wornAfter(worn, slot, item | null)`, `wears(stage)`; `DragonFigure.svelte` (`{ src, alt, filter, overlays, className? }`); `SceneLayer`'s and `Combatant`'s `overlays` prop; `Dragon.svelte`'s `worn` prop.

- [ ] **Step 1: Verify the art** — Run:

```bash
D=assets/art/export/dragon/accessories
for lt in hydre echo chimere protee sirenes lethe; do
  test -f "$D/$lt.json" || echo "MISSING $D/$lt.json"
  for s in cou queue dos tete; do for st in young adult illustre ancestral; do
    test -f "$D/$lt-${s}_$st.webp" || echo "MISSING $D/$lt-${s}_$st.webp"
  done; done
done
ls $D/*.webp | wc -l
```

Expected: no « MISSING » line and `96`. **If any file is missing, stop and report** (do not generate, copy, rename or crop art). Open the art track's Phase 4 contact sheet in `docs/art/` (Read tool) and confirm each set shares one colour and motif family.

- [ ] **Step 2: The merge script** — `tools/art/accessory_manifest.py`:

```python
"""Merge the per-lieutenant accessory manifest fragments (tools/art/overlay.py crop --manifest) into the
game's bundled manifest (spec 2026-09-29 drachmes §4, plan R16). Stdlib only; run from the repo root:
    python tools/art/accessory_manifest.py [--src assets/art/export/dragon/accessories]
It refuses a fragment that misses an item or a stage, or names an item of another lieutenant."""
import argparse
import json
from pathlib import Path

LIEUTENANTS = ["hydre", "echo", "chimere", "protee", "sirenes", "lethe"]
SLOTS = ["cou", "queue", "dos", "tete"]
STAGES = ["young", "adult", "illustre", "ancestral"]
OUT = Path("web/src/lib/world/accessories.json")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--src", default="assets/art/export/dragon/accessories")
    src = Path(ap.parse_args().src)
    out: dict = {}
    for lt in LIEUTENANTS:
        frag = json.loads((src / f"{lt}.json").read_text(encoding="utf-8"))
        stray = [k for k in frag if not k.startswith(f"{lt}-")]
        if stray:
            raise SystemExit(f"{lt}.json: {stray} belong to another lieutenant")
        for slot in SLOTS:
            item = f"{lt}-{slot}"
            if item not in frag or any(st not in frag[item] for st in STAGES):
                raise SystemExit(f"{lt}.json: {item} misses a stage (has {sorted(frag.get(item, {}))})")
            out[item] = {st: {k: frag[item][st][k] for k in ("src", "x", "y", "w", "h")} for st in STAGES}
    OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{OUT}: {len(out)} items, {sum(len(v) for v in out.values())} overlays")


if __name__ == "__main__":
    main()
```

Run: `python tools/art/accessory_manifest.py`. Expected: `web/src/lib/world/accessories.json: 24 items, 96 overlays`.

- [ ] **Step 3: Move and measure** —

```bash
mkdir -p web/public/art/dragon/accessories
for f in assets/art/export/dragon/accessories/*.webp; do
  if git ls-files --error-unmatch "$f" >/dev/null 2>&1; then git mv "$f" web/public/art/dragon/accessories/; else mv "$f" web/public/art/dragon/accessories/; fi
done
du -cb web/public/art/dragon/accessories/*.webp | tail -1
du -cb web/public/art/dragon/*.webp web/public/art/dragon/accessories/*.webp web/public/art/characters/*.webp web/public/art/lieutenants/*.webp web/public/art/emblems/*.webp web/public/art/props/*.webp web/public/art/battle/*.webp web/public/art/textures/*.webp web/public/art/ui/*.webp web/public/art/trophies/*.webp web/public/art/trophies/large/*.webp | tail -1
```

The fragments (`<lt>.json`) stay in `assets/art/export/dragon/accessories/`: they are the art track's records, and the script's input when an overlay is redone. Write down both totals. **If the accessories alone exceed 2 621 440 bytes (2.5 MiB), stop and report the ten largest files** (an overlay that big was not cropped).

- [ ] **Step 4: Write the failing tests** — `web/src/lib/world/accessories.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ACCESSORY_MANIFEST, DRAW_ORDER, SLOTS, SLOT_NAMES, WEARING, accessoryLayers, accessoryPicture, wears, wornAfter } from './accessories';

// Spec 2026-09-29 drachmes §4 (review focus 4).
describe('the dragon wears its pieces', () => {
  it('knows the slots, their order and the stages that wear them', () => {
    expect(SLOTS).toEqual(['cou', 'queue', 'dos', 'tete']);
    expect(DRAW_ORDER).toEqual(['queue', 'dos', 'cou', 'tete']);
    expect(WEARING).toEqual(['young', 'adult', 'illustre', 'ancestral']);
    expect(SLOT_NAMES).toEqual({ cou: 'Au cou', queue: 'À la queue', dos: 'Sur le dos', tete: 'Sur la tête' });
    expect([wears('egg'), wears('hatchling'), wears('young'), wears('ancestral')]).toEqual([false, false, true, true]);
  });

  it('places each overlay as percentages of the stage picture, back to front', () => {
    const e = ACCESSORY_MANIFEST['hydre-cou'].adult!;
    const [queue, cou] = accessoryLayers(['hydre-cou', 'echo-queue'], 'adult');
    expect(queue.item).toBe('echo-queue');
    expect(cou).toMatchObject({ item: 'hydre-cou', src: `/art/dragon/accessories/${e.src}` });
    expect(cou.left).toBeCloseTo(e.x * 100, 6);
    expect(cou.top).toBeCloseTo(e.y * 100, 6);
    expect(cou.width).toBeCloseTo(e.w * 100, 6);
    expect(cou.height).toBeCloseTo(e.h * 100, 6);
    expect(accessoryLayers(['lethe-tete', 'hydre-dos', 'sirenes-cou', 'chimere-queue'], 'young').map((l) => l.item)).toEqual([
      'chimere-queue', 'hydre-dos', 'sirenes-cou', 'lethe-tete',
    ]);
  });

  it('keeps the pieces on the egg and the hatchling without drawing them, and skips what it does not know', () => {
    expect(accessoryLayers(['hydre-cou'], 'egg')).toEqual([]);
    expect(accessoryLayers(['hydre-cou'], 'hatchling')).toEqual([]);
    expect(accessoryLayers(['medusa-cou', 'hydre-aile'], 'adult')).toEqual([]);
    expect(accessoryLayers(['hydre-cou', 'echo-cou'], 'adult').map((l) => l.item)).toEqual(['hydre-cou']); // one per slot
  });

  it('pictures a piece at the dragon\'s stage, the adult\'s before it wears', () => {
    expect(accessoryPicture('echo-dos', 'illustre')).toBe(`/art/dragon/accessories/${ACCESSORY_MANIFEST['echo-dos'].illustre!.src}`);
    expect(accessoryPicture('echo-dos', 'egg')).toBe(`/art/dragon/accessories/${ACCESSORY_MANIFEST['echo-dos'].adult!.src}`);
    expect(accessoryPicture('medusa-dos', 'adult')).toBeNull();
  });

  it('swaps a piece in its slot, or takes it off', () => {
    expect(wornAfter(['echo-queue', 'hydre-cou'], 'cou', 'lethe-cou')).toEqual(['echo-queue', 'lethe-cou']);
    expect(wornAfter(['echo-queue', 'hydre-cou'], 'cou', null)).toEqual(['echo-queue']);
    expect(wornAfter([], 'tete', 'hydre-tete')).toEqual(['hydre-tete']);
    expect(wornAfter(['hydre-tete'], 'queue', 'echo-queue')).toEqual(['echo-queue', 'hydre-tete']);
  });
});
```

`web/src/lib/world/art.test.ts`: import `ACCESSORY_MANIFEST, accessorySrc` from `./accessories`; add a WebP size reader and the manifest test:

```ts
/** A WebP's pixel size from its header (VP8X, VP8L or VP8), without a dependency. */
function webpSize(file: string): { w: number; h: number } {
  const b = readFileSync(file);
  const chunk = b.toString('ascii', 12, 16);
  if (chunk === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
  if (chunk === 'VP8L') {
    const bits = b.readUInt32LE(21);
    return { w: (bits & 0x3fff) + 1, h: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  throw new Error(`${file}: not a WebP`);
}

  // Spec 2026-09-29 drachmes §4, §6: every piece at every wearing stage, inside the stage's picture,
  // its fractions matching its own crop (review focus 4); nothing on disk the manifest does not name.
  it('has a manifest entry for the 24 pieces at the four wearing stages, and each one fits', () => {
    const lts = ['hydre', 'echo', 'chimere', 'protee', 'sirenes', 'lethe'];
    const items = lts.flatMap((lt) => ['cou', 'queue', 'dos', 'tete'].map((s) => `${lt}-${s}`));
    expect(Object.keys(ACCESSORY_MANIFEST).sort()).toEqual([...items].sort());
    const files: string[] = [];
    for (const item of items) {
      for (const stage of ['young', 'adult', 'illustre', 'ancestral'] as const) {
        const e = ACCESSORY_MANIFEST[item][stage];
        expect(e, `${item} ${stage}`).toBeDefined();
        const where = `${item} ${stage}`;
        const pic = webpSize('public' + ART.dragon[stage]);
        const crop = webpSize('public' + accessorySrc(e!.src));
        files.push(e!.src);
        expect(e!.w > 0 && e!.h > 0 && e!.x >= 0 && e!.y >= 0, where).toBe(true);
        expect(e!.x + e!.w, where).toBeLessThanOrEqual(1 + 1e-4);
        expect(e!.y + e!.h, where).toBeLessThanOrEqual(1 + 1e-4);
        expect(Math.abs(e!.w * pic.w - crop.w), where).toBeLessThanOrEqual(1.5);
        expect(Math.abs(e!.h * pic.h - crop.h), where).toBeLessThanOrEqual(1.5);
        expect(statSync('public' + accessorySrc(e!.src)).size, where).toBeLessThan(150 * 1024);
      }
    }
    expect(readdirSync('public/art/dragon/accessories').sort()).toEqual([...files].sort());
  });
```

and the budget test (sub-project 2's `'total non-scene art payload stays under 3.5 MiB …'`) becomes

```ts
  it('total non-scene art payload, the accessories included, stays under <LIMIT> MiB (raised for the 96 overlays, art spec Phase 4)', () => {
    // Measured when the accessories came in (sub-project 4 Task 6): <N> bytes, of which the overlays <A>.
    const accessories = readdirSync('public/art/dragon/accessories').map((f) => statSync(`public/art/dragon/accessories/${f}`).size);
    const total = nonScene().reduce((s, p) => s + statSync('public' + p).size, 0) + accessories.reduce((s, n) => s + n, 0);
    expect(total).toBeLessThan(<LIMIT> * 1024 * 1024);
  });
```

with `<N>` and `<A>` Step 3's two totals and `<LIMIT>` = `<N>` in MiB rounded up to the next 0.5 (R24; e.g. 4.8 MiB → 5), written as a number. Write the real numbers in the file; the placeholders are this plan's only unknowns.

- [ ] **Step 5: Run them to see them fail**

Run: `scripts/npm.sh run test -- src/lib/world/accessories.test.ts src/lib/world/art.test.ts`
Expected: FAIL (`ACCESSORY_MANIFEST` missing).

- [ ] **Step 6: The overlays' geometry** — `web/src/lib/world/accessories.ts` (replaces Task 5's stub, keeping `accessoryPicture`'s signature):

```ts
// The dragon's accessories on screen (spec 2026-09-29 drachmes §4, R16, R19): the bundled manifest
// (tools/art/accessory_manifest.py merges the art track's fragments) gives, per piece and wearing
// stage, the cropped WebP and where it sits in the 1024 px stage picture, as fractions, so it scales
// with the picture. The overlays are drawn over the tinted dragon, never tinted themselves.
import MANIFEST from './accessories.json';
import type { DragonStage, Slot } from './types';

export const SLOTS: Slot[] = ['cou', 'queue', 'dos', 'tete'];
/** Back to front (spec §4). */
export const DRAW_ORDER: Slot[] = ['queue', 'dos', 'cou', 'tete'];
/** The stages that wear their pieces; the egg and the hatchling keep theirs without showing them. */
export const WEARING: DragonStage[] = ['young', 'adult', 'illustre', 'ancestral'];
export const SLOT_NAMES: Record<Slot, string> = { cou: 'Au cou', queue: 'À la queue', dos: 'Sur le dos', tete: 'Sur la tête' };

interface Entry {
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
}
export const ACCESSORY_MANIFEST = MANIFEST as Record<string, Partial<Record<DragonStage, Entry>>>;
export const accessorySrc = (file: string) => `/art/dragon/accessories/${file}`;
export const wears = (stage: DragonStage) => WEARING.includes(stage);

const slotOf = (item: string) => item.split('-')[1] as Slot;

export interface OverlayLayer {
  item: string;
  src: string;
  /** Percent of the stage picture's box. */
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The overlays to draw over the dragon, back to front (one per slot; unknown pieces skipped). */
export function accessoryLayers(worn: readonly string[], stage: DragonStage): OverlayLayer[] {
  if (!wears(stage)) return [];
  const bySlot = new Map<Slot, string>();
  for (const item of worn) if (SLOTS.includes(slotOf(item)) && !bySlot.has(slotOf(item))) bySlot.set(slotOf(item), item);
  return DRAW_ORDER.flatMap((slot) => {
    const item = bySlot.get(slot);
    const e = item ? ACCESSORY_MANIFEST[item]?.[stage] : undefined;
    return item && e ? [{ item, src: accessorySrc(e.src), left: e.x * 100, top: e.y * 100, width: e.w * 100, height: e.h * 100 }] : [];
  });
}

/** The stall's and the parure's picture of a piece (R11): its overlay at the dragon's stage, the adult's
 *  before the young dragon; null for an unknown piece. */
export function accessoryPicture(item: string, stage: DragonStage): string | null {
  const e = ACCESSORY_MANIFEST[item]?.[wears(stage) ? stage : 'adult'];
  return e ? accessorySrc(e.src) : null;
}

/** The worn list after putting `item` on in `slot` (null: « Rien »), in draw order (the optimistic update). */
export function wornAfter(worn: readonly string[], slot: Slot, item: string | null): string[] {
  const kept = worn.filter((w) => slotOf(w) !== slot);
  const next = item ? [...kept, item] : kept;
  return DRAW_ORDER.flatMap((s) => next.filter((w) => slotOf(w) === s));
}
```

(`tsconfig` must allow `resolveJsonModule`: the content files are already imported as JSON, so it does.) In `StallPanel.svelte` the picture fallback of Task 5 stays (a `null` picture draws the empty frame).

- [ ] **Step 7: One figure, dressed** — `web/src/components/DragonFigure.svelte`:

```svelte
<script lang="ts">
  // The dragon as drawn on screen (spec 2026-09-29 drachmes §4, R19): its stage picture under the tint's
  // CSS filter, and the pieces it wears on top, unfiltered (a tint recolours the dragon, never its
  // gear). The overlays are percentages of the picture's own box, so the figure scales as one.
  // `className` carries the caller's animation (idle, mood), so the pieces move with the dragon.
  import type { OverlayLayer } from '../lib/world/accessories';

  let {
    src,
    alt,
    filter = 'none',
    overlays = [],
    className = '',
    style = '',
  }: { src: string; alt: string; filter?: string; overlays?: OverlayLayer[]; className?: string; style?: string } = $props();
</script>

<div class="dragon-figure {className}" {style}>
  <img class="dragon-base" {src} {alt} style:filter draggable="false" />
  {#each overlays as o (o.item)}
    <img
      class="dragon-overlay"
      data-testid="dragon-overlay"
      data-item={o.item}
      src={o.src}
      alt=""
      draggable="false"
      style="left:{o.left}%;top:{o.top}%;width:{o.width}%;height:{o.height}%"
    />
  {/each}
</div>

<style>
  .dragon-figure {
    position: relative;
  }
  .dragon-base {
    display: block;
    width: 100%;
    height: auto;
  }
  .dragon-overlay {
    position: absolute;
    display: block;
    pointer-events: none;
  }
</style>
```

  - `SceneLayer.svelte`: props gain `overlays = []` (`OverlayLayer[]`); the `img` becomes `<DragonFigure src={layer.src} alt={layer.alt} {filter} {overlays} className="scene-layer-img idle-{rt.reduced ? 'none' : layer.idle}" />` (the idle animation moves from the picture to the figure, so the pieces breathe with it); `.scene-layer-img` keeps `display: block; width: 100%;` as a `:global` rule if the class is now set on the child component (Svelte scopes styles: write `.scene-layer :global(.scene-layer-img)`).
  - `Dragon.svelte`: props gain `worn = []` (`readonly string[]`); render `<DragonFigure src={ART.dragon[stage]} alt={name ?? 'Ton dragon'} filter={TINT_FILTERS[tint]} overlays={accessoryLayers(worn, stage)} className="dragon {mood}{stage === 'egg' ? ' egg' : ''}" style="width:{size}px" />`; its styles become `:global` under a wrapper or move the animation classes to `kit.css`'s existing keyframes (`float`, `pop`, `wobble` are global keyframes already: keep the class rules in this file as `:global(.dragon.idle)` etc.). Header comment: « … and the pieces it wears (spec 2026-09-29 drachmes §4) ».
  - `Combatant.svelte`: props gain `overlays = []`; inside `.facing` the `img` becomes `<DragonFigure {src} {alt} {filter} {overlays} className={idle && !reduced ? 'combatant-figure idle-breathe' : 'combatant-figure'} />`, with `.facing :global(.combatant-figure) { height: 100%; display: inline-block; }` and `.facing :global(.combatant-figure .dragon-base) { height: 100%; width: auto; }` (the figure's box is the picture's: the percentages hold; the mirror flips the whole figure).
  - `BattleStage.svelte`: the dragon's `Combatant` gains `overlays={accessoryLayers(dragon.worn, dragonStage)}`; the opponent's gets none.
  - `Camp.svelte`: `<SceneLayer layer={dragonLayer(ctx.camp)} filter={…} overlays={accessoryLayers(ctx.camp.dragon.worn, ctx.camp.dragon.stage)} testId="camp-dragon-layer" />`; `Nest.svelte` the same for `nest-dragon-layer`.
  - `VictorySpoils.svelte`: the dragon card's `<Dragon …>` gains `worn={dragon?.worn ?? []}`.
  - The HUD's round portrait and the dialogue portraits are unchanged (R19).

- [ ] **Step 8: « Sa parure »** — `web/src/components/places/nest/CarePanel.svelte`: header comment gains « and its parure: one owned piece or nothing per slot (spec 2026-09-29 drachmes §4, R20) »; imports `SLOTS, SLOT_NAMES, accessoryPicture, wears, wornAfter` from `'../../../lib/world/accessories'`, `type RewardOut, type Slot` from types; script:

```ts
  // The pieces owned, fetched once per hero (R20); the worn ones come with the camp (`dragon.worn`).
  let owned = $state<RewardOut[] | null>(null);
  $effect(() => {
    const id = profile.id;
    owned = null;
    worldApi.rewards(id).then((list) => (owned = list)).catch(() => (owned = []));
  });
  const itemOf = (id: string) => id.slice('accessory:'.length);
  const piecesIn = (slot: Slot) => (owned ?? []).filter((r) => r.kind === 'accessory' && itemOf(r.id).endsWith(`-${slot}`));
  const wornIn = (slot: Slot) => dragon?.worn.find((w) => w.endsWith(`-${slot}`)) ?? null;
  const ownsAny = $derived((owned ?? []).some((r) => r.kind === 'accessory'));

  let parureError = $state('');
  let savingSlot = $state<Slot | null>(null);

  async function wear(slot: Slot, item: string | null) {
    if (!dragon || wornIn(slot) === item) return;
    const previous = camp;
    const current = wornIn(slot);
    parureError = '';
    savingSlot = slot;
    // Optimistic, like the tints: a refusal (stale camp) reverts to the server's own state.
    if (previous) replaceCamp(profile.id, { ...previous, dragon: { ...previous.dragon, worn: wornAfter(previous.dragon.worn, slot, item) } });
    try {
      if (item) await worldApi.patchReward(profile.id, `accessory:${item}`, true);
      else if (current) await worldApi.patchReward(profile.id, `accessory:${current}`, false);
      unlockAudio();
      playSfx('chime');
    } catch (e) {
      if (previous) replaceCamp(profile.id, previous);
      parureError = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
    } finally {
      savingSlot = null;
    }
  }
```

markup, after the tint section:

```svelte
    <section class="parure-section" data-testid="dragon-parure">
      <h3 class="kit-section">Sa parure</h3>
      {#if !wears(dragon.stage)}<p class="parure-note">Il portera sa parure dès qu'il sera un jeune dragon.</p>{/if}
      {#if parureError}<p class="kit-note" data-tone="eris" role="alert">{parureError}</p>{/if}
      {#each SLOTS as slot (slot)}
        <div class="parure-slot" role="radiogroup" aria-label={SLOT_NAMES[slot]} data-testid="parure-{slot}">
          <span class="parure-slot-name">{SLOT_NAMES[slot]}</span>
          <div class="parure-choices">
            <button type="button" role="radio" class="parure-choice" aria-checked={wornIn(slot) === null} data-testid="parure-{slot}-rien" disabled={savingSlot !== null} onclick={() => wear(slot, null)}>
              <span class="parure-none" aria-hidden="true"></span><span>Rien</span>
            </button>
            {#each piecesIn(slot) as r (r.id)}
              <button type="button" role="radio" class="parure-choice" aria-checked={wornIn(slot) === itemOf(r.id)} data-testid="parure-{itemOf(r.id)}" disabled={savingSlot !== null} onclick={() => wear(slot, itemOf(r.id))}>
                <img src={accessoryPicture(itemOf(r.id), dragon.stage) ?? ''} alt="" draggable="false" /><span>{r.name}</span>
              </button>
            {/each}
          </div>
        </div>
      {/each}
      {#if owned && !ownsAny}<p class="parure-how" data-testid="dragon-parure-how">Hermès vend des parures à son étal, dans le camp.</p>{/if}
    </section>
```

CSS: `.parure-section` like `.tint-section` (column, gap 10px, `> p { margin: 0 }`); `.parure-slot` a row (`display: grid; grid-template-columns: 110px 1fr; align-items: center; gap: 10px`); `.parure-choices { display: flex; flex-wrap: wrap; gap: 8px; }`; `.parure-choice` like `.tint-swatch` (transparent, column, min 72×48, 4px padding) with `aria-checked="true"` drawn as the selected ring (`.parure-choice[aria-checked='true'] img, .parure-choice[aria-checked='true'] .parure-none { box-shadow: 0 0 0 3px var(--olive-light); border-radius: 8px; }`); `.parure-choice img, .parure-none { width: 56px; height: 56px; object-fit: contain; }`; `.parure-none { border: 2px dashed var(--ink-soft); border-radius: 8px; box-sizing: border-box; }`; `.parure-note, .parure-how { font-style: italic; color: var(--reward-ink); }`. Arrow keys between radios are not required (each is a button); `expectOverlayTapTargets` must pass (48 px).

`docs/art/style-guide.md`, the Phase 4 section (or "Progression redesign" if the art track named it otherwise): « Wired by sub-project 4: the 96 overlays in `web/public/art/dragon/accessories/`, the manifest merged by `python tools/art/accessory_manifest.py` into `web/src/lib/world/accessories.json` (re-run it after any `overlay.py crop`). » (same rule as Task 3 if an art agent has the file open).

- [ ] **Step 9: Run the unit tests and the check**

Run: `scripts/npm.sh run test` ; `scripts/npm.sh run check`
Expected: all pass, `0 errors and 0 warnings`.

- [ ] **Step 10: The e2e** — `web/e2e/scenes-parure.spec.ts`:

```ts
// Spec 2026-09-29 drachmes §4, §6: earn → buy → wear → see it in the camp; the tint never touches the
// pieces; the egg keeps its pieces without showing them. desktop + ipad.
import { test, expect } from './crashGuard';
import {
  createProfileApi, createText, expectCamp, expectOverlayTapTargets, heroNamer, makeResult, postSession, redScan, tap, uniqueName,
} from './helpers';

const heroName = heroNamer('Parure');
// Seven days against the Hydra: the wooden seal on the third, the bronze one on the seventh (four days,
// 40 chances after it); 1 000 words a session make a young dragon and about 250 drachmes.
const DAYS = ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07', '2026-08-08', '2026-08-09'];

test('earn, buy the Hydra\'s collar, wear it: the dragon wears it in the camp, untinted', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const text = await createText(request, { title: uniqueName(`Parure ${testInfo.project.name}`), body: 'Les fées dansent dans la clairière.', level: '10H' });
  let last: any = null;
  for (const day of DAYS) {
    last = await postSession(request, { profileId: id, textId: text.id, day, result: makeResult({ words: 1000, draft: 4, caught: 4, category: 'agreement:verb' }) });
  }
  expect(last.progression.levels).toContainEqual({ lieutenant: 'hydre', level: 2, reward_id: 'trophy:hydre:2' });
  expect(['young', 'adult']).toContain(last.progression.dragon.stage_after);
  // The stall: the collar is on sale, the ring waits for the silver seal.
  await page.goto(`/#/p/${id}/camp?panel=etal`);
  const stall = page.getByTestId('overlay-stall');
  await expect(stall.getByTestId('stall-item-accessory:hydre-queue')).toContainText("Au sceau d'argent de l'Hydre");
  const collar = stall.getByTestId('stall-item-accessory:hydre-cou');
  await expect(collar.locator('img.stall-pic')).toHaveAttribute('src', /\/art\/dragon\/accessories\/hydre-cou_/);
  await tap(collar.getByTestId('stall-buy-accessory:hydre-cou'), testInfo);
  await expect(collar).toContainText("Acheter le collier d'écailles vertes pour 40 drachmes\u202f?");
  await tap(collar.getByTestId('stall-confirm'), testInfo);
  await expect(collar).toHaveAttribute('data-state', 'owned');
  // The nest: put it on, then the braise tint.
  await page.goto(`/#/p/${id}/dragon?panel=soin`);
  const care = page.getByTestId('overlay-care');
  await expect(care.getByTestId('parure-cou-rien')).toHaveAttribute('aria-checked', 'true');
  await tap(care.getByTestId('parure-hydre-cou'), testInfo);
  await expect(care.getByTestId('parure-hydre-cou')).toHaveAttribute('aria-checked', 'true');
  await expectOverlayTapTargets(page, 'overlay-care');
  await expect.poll(async () => (await request.get(`/api/profiles/${id}/camp`).then((r) => r.json())).dragon.worn).toEqual(['hydre-cou']);
  // The camp: the collar over the dragon, no filter on it while the dragon keeps its tint's.
  await page.goto(`/#/p/${id}/camp`);
  await expectCamp(page);
  const layer = page.getByTestId('camp-dragon-layer');
  const overlay = layer.locator('img.dragon-overlay[data-item="hydre-cou"]');
  await expect(overlay).toHaveAttribute('src', /\/art\/dragon\/accessories\/hydre-cou_(young|adult)\.webp$/);
  await expect(overlay).toHaveCSS('filter', 'none');
  const [base, piece] = [await layer.locator('img.dragon-base').boundingBox(), await overlay.boundingBox()];
  expect(piece!.x).toBeGreaterThanOrEqual(base!.x - 1);
  expect(piece!.x + piece!.width).toBeLessThanOrEqual(base!.x + base!.width + 1);
  expect(await redScan(page)).toEqual([]);
  // « Rien » takes it off.
  await page.goto(`/#/p/${id}/dragon?panel=soin`);
  await tap(page.getByTestId('parure-cou-rien'), testInfo);
  await page.goto(`/#/p/${id}/dragon`);
  await expect(page.getByTestId('nest-dragon-layer').locator('img.dragon-overlay')).toHaveCount(0);
});

test('a tinted dragon keeps its pieces in their own colours; the egg keeps them without showing them', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  // This hero's camp says: a braise adult wearing Léthé's crown, then an egg wearing it.
  let stage = 'adult';
  await page.route(`**/api/profiles/${id}/camp`, async (route) => {
    const res = await route.fetch();
    const camp = await res.json();
    camp.dragon = { ...camp.dragon, stage, tint: 'braise', worn: ['lethe-tete'] };
    await route.fulfill({ response: res, json: camp });
  });
  await page.goto(`/#/p/${id}/dragon`);
  const layer = page.getByTestId('nest-dragon-layer');
  await expect(layer.locator('img.dragon-overlay[data-item="lethe-tete"]')).toHaveCSS('filter', 'none');
  await expect(layer.locator('img.dragon-base')).not.toHaveCSS('filter', 'none');
  stage = 'egg';
  await page.reload();
  await expect(layer.locator('img.dragon-base')).toBeVisible();
  await expect(layer.locator('img.dragon-overlay')).toHaveCount(0);
  await page.goto(`/#/p/${id}/dragon?panel=soin`);
  await expect(page.getByTestId('dragon-parure')).toContainText("Il portera sa parure dès qu'il sera un jeune dragon.");
  await expect(page.getByTestId('dragon-parure-how')).toHaveText('Hermès vend des parures à son étal, dans le camp.');
});
```

`web/e2e/scenes-battle-victory.spec.ts`, the dragon-card test that shows a grown dragon (sub-project 3's stage-up): the camp it reads gets `worn: ['hydre-cou']` through the file's existing camp interception if it has one; then `await expect(sheet.getByTestId('reveal-dragon').locator('img.dragon-overlay')).toHaveCount(1)`. If that file has no camp interception, add this check to `scenes-parure.spec.ts` instead, after the collar is worn: seed a victory with `seedPlay` and a stage change (sub-project 3's pattern) and expect the overlay in `reveal-dragon`.

- [ ] **Step 11: Run the e2e**

Run: `STACK=prog scripts/playwright.sh scenes-parure.spec.ts --repeat-each=3` ; `STACK=prog scripts/playwright.sh scenes-camp.spec.ts scenes-nest.spec.ts scenes-battle-play.spec.ts scenes-battle-victory.spec.ts`
Expected: all pass on both projects (the figure wrapper must not change any measured box of the dragon: `SceneLayer`'s box is the same, the picture fills it).

- [ ] **Step 12: Commit** (the 96 moved files plus the edited ones):

```bash
PATHS="tools/art/accessory_manifest.py web/src/lib/world/accessories.json web/src/lib/world/accessories.ts web/src/lib/world/accessories.test.ts web/src/lib/world/art.test.ts web/src/components/DragonFigure.svelte web/src/components/Dragon.svelte web/src/components/scene/SceneLayer.svelte web/src/components/battle/Combatant.svelte web/src/components/battle/BattleStage.svelte web/src/components/battle/VictorySpoils.svelte web/src/screens/Camp.svelte web/src/screens/Nest.svelte web/src/components/places/nest/CarePanel.svelte web/e2e/scenes-parure.spec.ts web/e2e/scenes-battle-victory.spec.ts docs/art/style-guide.md"
for lt in hydre echo chimere protee sirenes lethe; do for s in cou queue dos tete; do for st in young adult illustre ancestral; do
  PATHS="$PATHS assets/art/export/dragon/accessories/$lt-${s}_$st.webp web/public/art/dragon/accessories/$lt-${s}_$st.webp"
done; done; done
git add tools/art/accessory_manifest.py web/src/lib/world/accessories.json web/src/lib/world/accessories.ts web/src/lib/world/accessories.test.ts web/src/lib/world/art.test.ts web/src/components/DragonFigure.svelte web/src/components/Dragon.svelte web/src/components/scene/SceneLayer.svelte web/src/components/battle/Combatant.svelte web/src/components/battle/BattleStage.svelte web/src/components/battle/VictorySpoils.svelte web/src/screens/Camp.svelte web/src/screens/Nest.svelte web/src/components/places/nest/CarePanel.svelte web/e2e/scenes-parure.spec.ts web/e2e/scenes-battle-victory.spec.ts docs/art/style-guide.md web/public/art/dragon/accessories
git commit -m "The dragon dresses: the 96 accessory overlays and their merged manifest, drawn untinted over the tinted dragon in the camp, the nest, the battle and the victory (from the young dragon on, back to front), « Sa parure » in the nest's care (one piece or nothing per slot), the non-scene art budget raised for them (measured total in the test)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- $PATHS
```

(a file that was untracked in `assets/` has no old path to name: `git commit -- <path>` of a path git never knew fails, so drop those old paths from `PATHS`: `git ls-files --error-unmatch` tells which.)

---

### Task 7: The house — villa and palais, the walls per house

**Files:**
- Modify: `web/src/lib/world/scenes/cabin.shapes.ts`, `web/src/lib/world/scenes/cabin.ts`, `web/src/lib/world/scenes/index.ts`, `web/src/lib/world/scenes/budget.test.ts`, `web/src/lib/world/scenes/camp.ts`, `web/src/lib/scene/types.ts` (`HotspotState.label`), `web/src/components/scene/Hotspot.svelte`, `web/src/screens/CabinRoom.svelte`, `web/src/components/places/cabin/TrophiesPanel.svelte`
- Create: `web/e2e/scenes-house.spec.ts`
- Test: `web/src/lib/world/scenes/cabin.test.ts`, `web/src/lib/world/scenes/camp.test.ts`, `web/e2e/scenes-cabin.spec.ts` (unchanged intent: run once)

**Interfaces:**
- Consumes: `camp.house` (Task 2), `ART.scenes.villa/palais` (Task 3), `HOUSE_NAMES` (Task 4).
- Produces: `VILLA_SHAPES`, `PALAIS_SHAPES` (`cabin.shapes.ts`); `BARE_WALLS: Record<House, Record<string, Box>>`, `DECOR_SLOTS: Record<House, { x: number; y: number }[]>`, `MAX_DISPLAYED_DECOR: Record<House, number>`, `VILLA_SCENE`, `PALAIS_SCENE`, `houseScene(house)` (`cabin.ts`); `HOUSE_SCENES` (`scenes/index.ts`); `HotspotState.label: string | null`; `TrophiesPanel`'s `maxDecor` prop.

- [ ] **Step 1: Look at the two rooms** — open `assets/art/scenes/villa.png` and `assets/art/scenes/palais.png` (Read tool) next to the style guide's landmark table. The shapes and slots below were measured on them (percent of 2048 × 1152); confirm each by eye with `?debug` in Step 7 and move a slot inside its bare-wall box by at most 2 points if a painted detail is under it (then update this step's numbers in the tests).

- [ ] **Step 2: Write the failing tests** — `web/src/lib/world/scenes/cabin.test.ts`:

```ts
import { readFileSync } from 'node:fs';
// (add to the file's imports) BARE_WALLS, DECOR_SLOTS, MAX_DISPLAYED_DECOR, PALAIS_SCENE, VILLA_SCENE, houseScene from './cabin'

// Spec 2026-09-29 drachmes §3 (R21, review focus 5).
describe('the three houses', () => {
  it('each shows its own room, its own name, the same three places', () => {
    expect([houseScene('cabin').title, houseScene('villa').title, houseScene('palais').title]).toEqual(['Ta cabane', 'Ta villa', 'Ton palais']);
    expect([VILLA_SCENE.background, PALAIS_SCENE.background]).toEqual(['/art/scenes/villa.webp', '/art/scenes/palais.webp']);
    for (const s of [VILLA_SCENE, PALAIS_SCENE]) {
      expect(s.id).toBe('cabin');
      expect(s.hotspots.map((h) => [h.id, h.label, h.target])).toEqual(CABIN_SCENE.hotspots.map((h) => [h.id, h.label, h.target]));
      expect(s.narrator).toEqual(CABIN_SCENE.narrator);
      expect(validateScene(s), s.title).toEqual([]);
    }
  });

  it('the slots agree with the server: four, six, nine', () => {
    const py = readFileSync('../server/app/world/shop.py', 'utf-8');
    expect(py).toContain('MAX_DECOR = {"cabin": 4, "villa": 6, "palais": 9}');
    expect(MAX_DISPLAYED_DECOR).toEqual({ cabin: 4, villa: 6, palais: 9 });
    for (const h of ['cabin', 'villa', 'palais'] as const) expect(DECOR_SLOTS[h]).toHaveLength(MAX_DISPLAYED_DECOR[h]);
  });

  // A 52 px medallion is ~4.1 % of the art's width and ~7.2 % of its height at 1280×720: each slot's
  // medallion stays on its house's bare wall, apart from the others, off every place's box and plaque.
  it("each interior's slots sit on its bare wall, apart, off the places and their plaques", () => {
    const HALF = { x: 2.1, y: 3.7 };
    const inside = (p: { x: number; y: number }, b: { x: number; y: number; w: number; h: number }) =>
      p.x - HALF.x >= b.x && p.x + HALF.x <= b.x + b.w && p.y - HALF.y >= b.y && p.y + HALF.y <= b.y + b.h;
    for (const [house, scene] of [['cabin', CABIN_SCENE], ['villa', VILLA_SCENE], ['palais', PALAIS_SCENE]] as const) {
      const slots = DECOR_SLOTS[house];
      for (const s of slots) expect(Object.values(BARE_WALLS[house]).some((b) => inside(s, b)), `${house} ${JSON.stringify(s)}`).toBe(true);
      for (let i = 0; i < slots.length; i++) for (let j = i + 1; j < slots.length; j++) {
        const apart = Math.abs(slots[i].x - slots[j].x) >= 2 * HALF.x || Math.abs(slots[i].y - slots[j].y) >= 2 * HALF.y;
        expect(apart, `${house} ${i} ${j}`).toBe(true);
      }
      for (const h of scene.hotspots) {
        const xs = (h.shape as { points: [number, number][] }).points.map((p) => p[0]);
        const ys = (h.shape as { points: [number, number][] }).points.map((p) => p[1]);
        // The place's box, and its plaque's band (7 % above or below it, 8 % either side of its middle).
        const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
        const mid = box.x + box.w / 2;
        const plaque = h.labelPos === 'above' ? { x: mid - 8, y: box.y - 7, w: 16, h: 7 } : { x: mid - 8, y: box.y + box.h, w: 16, h: 7 };
        for (const s of slots) {
          for (const b of [box, plaque]) {
            const clear = s.x + HALF.x <= b.x || s.x - HALF.x >= b.x + b.w || s.y + HALF.y <= b.y || s.y - HALF.y >= b.y + b.h;
            expect(clear, `${house} ${JSON.stringify(s)} on ${h.id}`).toBe(true);
          }
        }
      }
    }
  });
});
```

(`validateScene`, `CABIN_SCENE` imported as the file already does; if the cabin's existing slots fail the plaque band, note which one and widen nothing: move the slot within its bare wall and say so in the report.) `web/src/lib/world/scenes/budget.test.ts`: import `HOUSE_SCENES` and iterate `[...SCENES, ...HOUSE_SCENES]` in the second test. `web/src/lib/world/scenes/camp.test.ts`: add

```ts
  it('names the house on the camp\'s plaque (spec 2026-09-29 drachmes §3, R22)', () => {
    const cabin = CAMP_HOTSPOTS.find((h) => h.id === 'cabin')!;
    for (const [house, name] of [['cabin', 'Ta cabane'], ['villa', 'Ta villa'], ['palais', 'Ton palais']] as const) {
      expect(cabin.state({ camp: { ...camp(), house }, catalog: null }).label).toBe(name);
    }
  });
```

(`camp()` is the file's camp fixture builder.)

- [ ] **Step 3: Run them to see them fail**

Run: `scripts/npm.sh run test -- src/lib/world/scenes`
Expected: FAIL (`VILLA_SCENE` missing).

- [ ] **Step 4: Shapes and slots** — `web/src/lib/world/scenes/cabin.shapes.ts`, after `CABIN_SHAPES`:

```ts
// Spec 2026-09-29 drachmes §3: the villa and the palais keep the cabin's room plan (style guide,
// "Progression redesign, phase 3": landmarks by eye, ±2 %), so the three places keep their roles; each
// room has its own boxes. The villa's shelf box steps down to x 31 below y 44, so the wall right of its
// medals stays free for decor.
export const VILLA_SHAPES = {
  trophies: { kind: 'polygon', points: [[12.5, 14], [40, 14], [40, 44], [31, 44], [31, 62], [12.5, 62]] },
  journal: { kind: 'polygon', points: [[38, 46], [57.5, 46], [57.5, 78], [38, 78]] },
  lyre: { kind: 'polygon', points: [[59, 42], [72.5, 42], [72.5, 72], [59, 72]] },
} satisfies ShapeMap;

export const PALAIS_SHAPES = {
  trophies: { kind: 'polygon', points: [[12.5, 14], [33.5, 14], [33.5, 62], [12.5, 62]] },
  journal: { kind: 'polygon', points: [[39, 50], [58, 50], [58, 78], [39, 78]] },
  lyre: { kind: 'polygon', points: [[59.5, 43], [72, 43], [72, 76], [59.5, 76]] },
} satisfies ShapeMap;
```

`web/src/lib/world/scenes/cabin.ts`: import `VILLA_SHAPES, PALAIS_SHAPES`, `type House` from `'../types'`, `type ShapeMap` and `type Box` from `'../../scene/types'`; the hotspots become a builder:

```ts
function houseHotspots(shapes: typeof CABIN_SHAPES): HotspotDef[] {
  return [
    {
      id: 'trophies',
      label: 'Tes trésors',
      target: 'cabin',
      query: { panel: 'tresors' },
      shape: shapes.trophies,
      labelPos: 'below',
      leader: true,
      state: ({ camp }) => st({ caption: camp ? treasureCaption(camp.rewards_count) : null }),
    },
    { id: 'journal', label: 'Ton journal', target: 'stats', shape: shapes.journal, labelPos: 'above', leader: true, state: () => st() },
    { id: 'lyre', label: 'La lyre', target: 'settings', shape: shapes.lyre, labelPos: 'above', leader: true, state: () => st() },
  ];
}

export const CABIN_HOTSPOTS: HotspotDef[] = houseHotspots(CABIN_SHAPES);
```

(`CABIN_SCENE` unchanged but for `hotspots: CABIN_HOTSPOTS`); then

```ts
/** Spec 2026-09-29 drachmes §3 (R21): the houses bought from Hermès, the cabin place in a richer room. */
export const VILLA_SCENE: SceneDef = { ...CABIN_SCENE, title: 'Ta villa', background: ART.scenes.villa, hotspots: houseHotspots(VILLA_SHAPES) };
export const PALAIS_SCENE: SceneDef = { ...CABIN_SCENE, title: 'Ton palais', background: ART.scenes.palais, hotspots: houseHotspots(PALAIS_SHAPES) };

export function houseScene(house: House): SceneDef {
  return house === 'palais' ? PALAIS_SCENE : house === 'villa' ? VILLA_SCENE : CABIN_SCENE;
}
```

`BARE_WALL` becomes `BARE_WALLS` (the cabin's three boxes unchanged, under `cabin`):

```ts
/** Bare wall of each room (art %), measured on the paintings: nothing painted inside these boxes. */
export const BARE_WALLS: Record<House, Record<string, Box>> = {
  cabin: {
    betweenWindows: { x: 56.5, y: 21, w: 12.5, h: 16.5 },
    leftOfWindow: { x: 41.5, y: 28, w: 4.5, h: 16 },
    rightWall: { x: 81.5, y: 41, w: 6, h: 16.5 },
  },
  // villa.webp: the back wall under the frieze (it ends at y ~= 23) between and beside the arched
  // windows (x ~= 48.5-55 and 73-79.5), above the lyre (from y ~= 42); the left wall right of the
  // medals (they end at x ~= 27, y ~= 62) and below them, left of the painted pot (x ~= 29.5-37).
  villa: {
    betweenWindows: { x: 56.5, y: 24, w: 15, h: 16 },
    leftOfLeftWindow: { x: 41.5, y: 25, w: 6, h: 16 },
    rightOfRightWindow: { x: 80, y: 26, w: 6.5, h: 24 },
    rightOfMedals: { x: 32, y: 46, w: 6.5, h: 14 },
    lowerLeftWall: { x: 13, y: 69, w: 15.5, h: 11 },
  },
  // palais.webp: the marble wall over the doorway, between the frieze (it ends at y ~= 15) and the
  // lintel (it starts at y ~= 21), between the columns (x ~= 38-61.5; the medallions may touch the
  // mouldings by less than 1 %); the left marble wall under the shelf's plaque band, above the red
  // baseboard, which rises from y ~= 97 at x 13 to y ~= 78 at x 30.
  palais: {
    overDoor: { x: 39.9, y: 14.6, w: 20.8, h: 7.5 },
    lowerLeftWall: { x: 12.8, y: 69, w: 12.5, h: 17 },
    lowerLeftRight: { x: 25.5, y: 69, w: 5, h: 8 },
  },
};

/** Where the displayed decor hangs in each room (medallion centres, art %), one piece per slot, each
 *  on its room's BARE_WALLS, clear of the places and their plaques (cabin.test.ts proves it). */
export const DECOR_SLOTS: Record<House, { x: number; y: number }[]> = {
  cabin: [
    { x: 60, y: 31 },
    { x: 84.5, y: 45 },
    { x: 43.8, y: 35 },
    { x: 84.5, y: 53 },
  ],
  villa: [
    { x: 62, y: 31 },
    { x: 44.5, y: 32 },
    { x: 83.3, y: 36 },
    { x: 35.2, y: 53 },
    { x: 17, y: 74.5 },
    { x: 24, y: 74.5 },
  ],
  palais: [
    { x: 42.1, y: 18.3 },
    { x: 47.6, y: 18.3 },
    { x: 53.1, y: 18.3 },
    { x: 58.5, y: 18.3 },
    { x: 15, y: 73 },
    { x: 21.2, y: 73 },
    { x: 27.9, y: 73 },
    { x: 15, y: 81.5 },
    { x: 21.2, y: 81.5 },
  ],
};

/** The walls hold one piece per slot (spec §3; the server's MAX_DECOR in server/app/world/shop.py
 *  refuses one more with the same line). */
export const MAX_DISPLAYED_DECOR: Record<House, number> = {
  cabin: DECOR_SLOTS.cabin.length,
  villa: DECOR_SLOTS.villa.length,
  palais: DECOR_SLOTS.palais.length,
};
```

(the old `BARE_WALL`'s doc comment moves above `BARE_WALLS.cabin`; `grep -rn "BARE_WALL\b\|MAX_DISPLAYED_DECOR\|DECOR_SLOTS" web/src web/e2e` and update every reader to the house's entry.) `web/src/lib/world/scenes/index.ts`: `export const HOUSE_SCENES: SceneDef[] = [VILLA_SCENE, PALAIS_SCENE];` with the comment « Spec 2026-09-29 drachmes §3: the cabin place's two other rooms (SCENES keeps the seven places). ».

- [ ] **Step 5: The plaque follows the house** — `web/src/lib/scene/types.ts`: `HotspotState` gains `/** Overrides the plaque's name (the camp's house, spec 2026-09-29 drachmes §3). */ label: string | null;` and `IDLE_HOTSPOT` gains `label: null`; `Hotspot.svelte`: `const label = $derived(status.label ?? def.label);` and every `def.label` of the markup and of `pinned` reads `label`; every vitest that compares a whole `HotspotState` with `toEqual` gains `label: null` (grep `seals: 0` in `*.test.ts`). `web/src/lib/world/scenes/camp.ts`: import `HOUSE_NAMES` from `'../shop'`; the cabin hotspot's `state: place('cabin', (camp) => ({ label: HOUSE_NAMES[camp.house] }))`, its static `label` stays « Ta cabane » (before the camp loads).

- [ ] **Step 6: The room** — `web/src/screens/CabinRoom.svelte`: header comment gains « The room is the highest house owned: the cabin, the villa or the palais, each with its own places and walls (spec 2026-09-29 drachmes §3, R21). »; imports `houseScene, DECOR_SLOTS, MAX_DISPLAYED_DECOR` (in place of `CABIN_SCENE, DECOR_SLOTS`); script:

```ts
  // Until /camp answers, the cabin (R21): the places arrive from the camp, which has loaded it.
  const house = $derived(campFor(profile.id)?.house ?? 'cabin');
  const scene = $derived(houseScene(house));
  const slots = $derived(DECOR_SLOTS[house]);
  const displayed = $derived((owned ?? []).filter((r) => r.kind === 'decor' && r.equipped).slice(0, slots.length));
```

markup: `<PlaceScene {profile} {scene} …>`, `{#each scene.hotspots as def (def.id)}`, `{@const slot = slots[i]}`, and `<TrophiesPanel {profile} {owned} maxDecor={MAX_DISPLAYED_DECOR[house]} … />`. `TrophiesPanel.svelte`: props gain `maxDecor: number`; `MAX_DISPLAYED_DECOR` leaves its import; `displayedDecor >= maxDecor` in `toggleEquip`; its comment « The walls hold MAX_DISPLAYED_DECOR pieces » becomes « The walls of the house hold `maxDecor` pieces (spec 2026-09-29 drachmes §3) ». Check that `PlaceScene` and `SceneStage` read `scene` reactively (a `$derived` prop): if `SceneStage` copies `scene.background` once on mount, make it read the prop directly, or key the stage on the house with `{#key house}` around `<PlaceScene>` (then the greeting must not replay: PlaceScene's greeting is once per hero per page load already, `shouldGreet`).

- [ ] **Step 7: Run the unit tests, the check, and look**

Run: `scripts/npm.sh run test` ; `scripts/npm.sh run check`
Expected: all pass, `0 errors and 0 warnings`. Then with the stack up (`STACK=prog scripts/playwright.sh scenes-house.spec.ts` from Step 8 leaves heroes with a villa), open the room with `?debug` in the e2e's screenshot step (Step 8 saves `test-results/…/villa-debug.png` and `palais-debug.png`): read both pictures and confirm each medallion hangs on bare wall and each outline hugs its landmark.

- [ ] **Step 8: The e2e** — `web/e2e/scenes-house.spec.ts`:

```ts
// Spec 2026-09-29 drachmes §3, §6: buy the villa, hang a sixth piece of decor in it; the palais's room.
// desktop + ipad.
import { test, expect } from './crashGuard';
import type { APIRequestContext } from '@playwright/test';
import { createProfileApi, createText, expectScene, heroNamer, labelOverlaps, makeResult, postSession, redScan, swissDay, tap, uniqueName } from './helpers';

const heroName = heroNamer('Maison');
const QUEST_DECOR = ['decor:lanterne', 'decor:tapis'];
const SHOP_DECOR = ['decor:amphore', 'decor:chouette', 'decor:mosaique', 'decor:bouclier'];

/** Twelve 3 000-word sessions through four board quests against the Hydra: an adult dragon (about
 *  11 000 XP), the lantern and the carpet (two and four quests), about 1 100 drachmes. */
async function wealthyHero(request: APIRequestContext, name: string): Promise<number> {
  const id = await createProfileApi(request, name);
  const text = await createText(request, { title: uniqueName(`Maison ${name}`), body: 'Les fées dansent dans la clairière.', level: '10H' });
  for (let q = 0; q < 4; q++) {
    expect((await request.post(`/api/profiles/${id}/quests`, { data: { target: 'hydre' } })).status()).toBe(201);
    for (let s = 0; s < 3; s++) {
      await postSession(request, { profileId: id, textId: text.id, day: swissDay(0), result: makeResult({ words: 3000, draft: 4, caught: 4, category: 'agreement:verb' }) });
    }
  }
  return id;
}

test('buy the villa at the stall, hang a sixth piece in it', async ({ page, request }, testInfo) => {
  const id = await wealthyHero(request, heroName(testInfo.project.name));
  const camp = await (await request.get(`/api/profiles/${id}/camp`)).json();
  expect(camp.dragon.stage).toBe('adult');
  // The villa, bought at the stall.
  await page.goto(`/#/p/${id}/camp?panel=etal`);
  const villa = page.getByTestId('overlay-stall').getByTestId('stall-item-house:villa');
  await tap(villa.getByTestId('stall-buy-house:villa'), testInfo);
  await expect(villa).toContainText('Acheter la villa pour 300 drachmes\u202f?');
  await tap(villa.getByTestId('stall-confirm'), testInfo);
  await expect(villa).toHaveAttribute('data-state', 'owned');
  await expect(page.getByTestId('overlay-stall').getByTestId('stall-item-house:palais')).toContainText('Quand ton dragon sera illustre.');
  // Four pieces from Hermès; five of the six on the walls through the API.
  for (const item of SHOP_DECOR) expect((await request.post(`/api/profiles/${id}/purchases`, { data: { item } })).status()).toBe(201);
  for (const item of [...QUEST_DECOR, ...SHOP_DECOR.slice(0, 3)]) {
    expect((await request.patch(`/api/profiles/${id}/rewards/${item}`, { data: { equipped: true } })).status()).toBe(200);
  }
  // The camp's plaque and the room follow the house.
  await page.goto(`/#/p/${id}/camp`);
  await expect(page.getByTestId('camp-cabin')).toContainText('Ta villa');
  await page.goto(`/#/p/${id}/cabane`);
  await expectScene(page, 'cabin');
  await expect(page.locator('[data-testid="scene-cabin"] .stage-plaque')).toHaveText('Ta villa');
  await expect(page.locator('[data-testid="scene-cabin"] .art-bg')).toHaveAttribute('src', '/art/scenes/villa.webp');
  // The sixth piece, from the shelf.
  await tap(page.getByTestId('cabin-trophies'), testInfo);
  await tap(page.getByTestId('cabin-equip-decor:bouclier'), testInfo);
  await expect(page.getByTestId('cabin-equip-decor:bouclier')).toHaveText('Ranger');
  await expect(page.getByTestId('cabin-walls-full')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-testid^="cabin-decor-"]')).toHaveCount(6);
  for (const size of [{ width: 1280, height: 720 }, { width: 1180, height: 820 }]) {
    await page.setViewportSize(size);
    expect(await labelOverlaps(page, 'cabin'), `${size.width}x${size.height}`).toEqual([]);
    // No medallion over a place's plaque.
    const plaques = await page.locator('[data-testid="scene-cabin"] .hotspot-label').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()));
    const medals = await page.locator('[data-testid^="cabin-decor-"]').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()));
    for (const m of medals) for (const p of plaques) expect(m.right <= p.left || m.left >= p.right || m.bottom <= p.top || m.top >= p.bottom).toBe(true);
  }
  expect(await redScan(page)).toEqual([]);
  await page.goto(`/#/p/${id}/cabane?debug`);
  await expect(page.getByTestId('hotspot-debug').locator('svg.outline')).toHaveCount(3);
  await page.screenshot({ path: testInfo.outputPath('villa-debug.png') });
});

test("the palais's room: its places and nine slots", async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  // This hero's camp says: the palais (the room is the client's to draw; buying it is pinned by pytest).
  await page.route(`**/api/profiles/${id}/camp`, async (route) => {
    const res = await route.fetch();
    await route.fulfill({ response: res, json: { ...(await res.json()), house: 'palais' } });
  });
  await page.goto(`/#/p/${id}/cabane?debug`);
  await expectScene(page, 'cabin');
  await expect(page.locator('[data-testid="scene-cabin"] .stage-plaque')).toHaveText('Ton palais');
  await expect(page.locator('[data-testid="scene-cabin"] .art-bg')).toHaveAttribute('src', '/art/scenes/palais.webp');
  for (const size of [{ width: 1280, height: 720 }, { width: 1180, height: 820 }]) {
    await page.setViewportSize(size);
    expect(await labelOverlaps(page, 'cabin'), `${size.width}x${size.height}`).toEqual([]);
  }
  await page.screenshot({ path: testInfo.outputPath('palais-debug.png') });
});
```

(the palais test sees no decor hung: the slots' placement is pinned by the vitest; the screenshot lets Step 7 check them by eye with the debug outlines. If `.stage-plaque` or `.art-bg` are named otherwise in `scenes-cabin.spec.ts`, use its selectors.)

- [ ] **Step 9: Run the e2e**

Run: `STACK=prog scripts/playwright.sh scenes-house.spec.ts --repeat-each=3` ; `STACK=prog scripts/playwright.sh scenes-cabin.spec.ts scenes-camp.spec.ts`
Expected: all pass on both projects.

- [ ] **Step 10: Commit**

```bash
git add web/src/lib/world/scenes/cabin.shapes.ts web/src/lib/world/scenes/cabin.ts web/src/lib/world/scenes/cabin.test.ts web/src/lib/world/scenes/index.ts web/src/lib/world/scenes/budget.test.ts web/src/lib/world/scenes/camp.ts web/src/lib/world/scenes/camp.test.ts web/src/lib/scene/types.ts web/src/components/scene/Hotspot.svelte web/src/screens/CabinRoom.svelte web/src/components/places/cabin/TrophiesPanel.svelte web/e2e/scenes-house.spec.ts
git commit -m "The house: the cabin place shows the highest house owned (cabin, villa, palais), each room with its own places and walls (4, 6, 9 decor slots, agreeing with the server), the camp's plaque and the scene's title follow it (Ta villa, Ton palais)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/lib/world/scenes/cabin.shapes.ts web/src/lib/world/scenes/cabin.ts web/src/lib/world/scenes/cabin.test.ts web/src/lib/world/scenes/index.ts web/src/lib/world/scenes/budget.test.ts web/src/lib/world/scenes/camp.ts web/src/lib/world/scenes/camp.test.ts web/src/lib/scene/types.ts web/src/components/scene/Hotspot.svelte web/src/screens/CabinRoom.svelte web/src/components/places/cabin/TrophiesPanel.svelte web/e2e/scenes-house.spec.ts
```

(add every fixture file Step 5's `label: null` touched.)

---

### Task 8: README and the full gate

**Files:**
- Modify: `README.md` (§1 feature list, the rewards bullet, the rules file section)

**Interfaces:**
- Consumes: everything above.
- Produces: documented drachmes, stall, house and parure, `drachmes`/`prices` in the rules file; a clean gate.

- [ ] **Step 1: The README**

§1, « Camp and progression »: after sub-project 2's seals and fights, add « drachmes to spend at Hermès's stall (the dragon's accessories, the villa and the palais, decor), ».

After sub-project 2's « Éris's fights » bullet add:

```markdown
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
```

The rewards bullet: « every trophy, dragon tint, divine gear and cabin decor piece » becomes « every trophy, dragon tint, divine gear and piece of decor (the accessories and the houses are at Hermès's stall) ».

In « The rules file (`data/regles.json`) »: the JSON block gains, after `fights` (a comma after it):

```json
  "drachmes": {"xp_per_drachme": 10, "board": 5, "oracle": 15, "weekly": 5, "level": 10, "boss": 30},
  "prices": {"accessory": {"cou": 40, "queue": 60, "dos": 90, "tete": 130}, "decor": 50, "villa": 300, "palais": 800}
```

and the table gains:

```markdown
| `drachmes` | What pays drachmes: a session pays its XP ÷ `xp_per_drachme` (rounded, halves up; from 1), a board quest `board`, an Oracle quest `oracle`, the weekly goal `weekly`, a seal L `level` × L, a won Éris fight `boss` (whole numbers). A partial object keeps the other values; a wrong value is ignored with a warning. The starting grant (a tenth of the XP) was given once, by migration 007 |
| `prices` | Hermès's prices in drachmes: `accessory` (an object of `cou`, `queue`, `dos`, `tete`), `decor` (each piece), `villa`, `palais` (whole numbers). A partial object keeps the other prices; a wrong value is ignored with a warning |
```

- [ ] **Step 2: The full gate**

Run: `STACK=prog PW_WORKERS=4 scripts/check.sh`
Expected: `== ALL GREEN`; pytest, vitest and Playwright with no failure, `svelte-check` `0 errors and 0 warnings`, tsc silent, no warning in the vitest/pytest output. Paste the counts. Any failure, flake or warning is fixed here (root cause, in the owning file) or reported as an open item; never retried away.

- [ ] **Step 3: Final sweeps** (each must print nothing)

```bash
grep -rn "MAX_DISPLAYED_DECOR\b" server
grep -rnE "\bBARE_WALL\b" web/src web/e2e
grep -rn -i "niveau\|dernière chance\|promo\|remise\|soldes" content/dialogue/stall.json web/src/lib/world/shop.ts web/src/components/places/camp web/src/components/places/nest/CarePanel.svelte
ls assets/art/export/scenes/*.webp assets/art/export/characters/*.webp assets/art/export/dragon/accessories/*.webp assets/art/export/icons/drachme.webp assets/art/export/icons/decor-*.webp 2>/dev/null
ls web/public/art/scenes/hub_camp_stall.webp 2>/dev/null
```

(the staged exports are all wired; only the six manifest fragments stay under `assets/art/export/dragon/accessories/`, by design.)

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "README: drachmes (what pays them, the ledger and the starting grant), Hermès's stall, the villa and the palais, the dragon's parure, and drachmes/prices in data/regles.json

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- README.md
```

---

## Spec coverage (self-review)

| Spec | Task |
|---|---|
| §1 XP never spent; drachmes from sessions (XP ÷ 10), board 5, Oracle 15, weekly 5, level 10 × L, fight 30, in `data/regles.json` `drachmes` | 1 (`earned_drachmes`, `_drachmes`), 2 (progression, API tests), 8 (README) |
| §1 ledger `drachme_event(profile_id, amount, reason, ref, created_at)`, balance its sum, never below zero, 409 when short | 2 (migration, `post_purchase` under `begin_write`, race test) |
| §1 starting grant floor(XP ÷ 10), reason `grant` | 2 (migration 007 test) |
| §1 balance on the HUD next to the XP gauge (coin and number) and at the stall; victory chips « +N drachmes » | 4 (HUD, chip), 5 (stall purse) |
| §2 camp hotspot on the painted stall « L'étal d'Hermès », a place panel with Hermès and three shelves | 3 (art), 5 |
| §2 accessories grouped by lieutenant, on sale from cou 2 / queue 3 / dos 4 / tête 5, silhouette and « Au sceau de bronze de l'Hydre » before; Protée from 8H | 1 (`on_sale`), 4 (`stallShelves`), 5 (panel, e2e) |
| §2 the villa (adult) and the palais (illustre, after the villa); four decor pieces | 1, 2 (house order test), 4, 5 |
| §2 prices in `prices` (40/60/90/130, decor 50, villa 300, palais 800) | 1 (`_prices`, `shop_catalog`), 8 (README) |
| §2 one confirmation « Acheter la couronne de pavots pour 130 drachmes ? », Hermès's line (content file, ≥ 3 variants), a `reward` row (kinds accessory, decor, house); never pushing | 4 (`confirmQuestion`), 5 (`stall.json` with 4 variants each, the no-pressure test, the flow) |
| §3 the cabin place shows the highest interior; own hotspot shapes and decor slots; slots 4/6/9 per interior on server and client; the place's name follows | 2 (`MAX_DECOR`, walls test), 7 (scenes, slots, label, e2e) |
| §4 « Parure » in the care panel: four slots, owned pieces and « Rien », one per slot, saved on the server, one per slot enforced | 2 (swap), 6 (panel, e2e) |
| §4 overlays drawn unfiltered over the tinted dragon from the manifest (per item and stage, WebP and fractions), from `young` on, kept on the egg/hatchling, order queue, dos, cou, tête; dressed everywhere but the portraits | 6 (`accessoryLayers`, `DragonFigure`, four renderers, e2e) |
| §5 migration 007; reward kinds `accessory`, `house`, new decor ids; the catalogue lists items with slot, lieutenant, level, price | 1 (catalogue, `shop_catalog`), 2 (migration, `/api/world` `shop`), 3 (client kinds) |
| §6 server tests: earning per source, grant, purchases (on-sale rules, balance, 409 short or not on sale, re-buy refused), equip rules, house order, per-interior decor limits | 1, 2 |
| §6 client tests: stall shelves and states, confirm, HUD balance, parure panel, overlay rendering per stage with tints (manifest math), cabin interiors | 4, 5, 6, 7 |
| §6 e2e: earn → buy → wear → see it in the camp; buy the villa; hang a sixth decor piece in the villa | 6, 7 |
| §6 art test: manifest entries exist and fit; the raised web budget as a number; full gate clean | 6, 8 |
