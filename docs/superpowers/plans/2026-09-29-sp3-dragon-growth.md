# La Discorde — Sub-project 3 "The dragon grows from XP" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The dragon becomes the one long progress arc. Its six stages (Œuf, Dragonnet, Jeune dragon, Dragon adulte, Dragon illustre, Dragon ancestral) follow the hero's total XP on a rising curve (0, 100, 1 200, 5 000, 15 000, 40 000, tunable in `data/regles.json`), and a stage never goes down. The ten XP ranks merge into the stages: the HUD's laurel shows the way to the next stage, named by the stage; the victory's gauge fills the old stage and then switches to the new one with « Ton dragon grandit ! »; « Nouveau rang » and every rank title go. The two new stages speak (at least three lines per stage per event), have their activity sentence and their painted picture, and the adult is redrawn.

**Architecture:** Server first, then the client in three steps that each leave the game working, then the README and the gate.
- Server (`server/app`): a new `world/dragon.py` holds the stage order, names, default thresholds and the pure rules (stage for an XP total, the never-down stage, the gauge's floor and next threshold, the served table). `rules.py` gains `dragon_stages` with the same validation and fallback as the other keys. `world/progression.py` grows the stored stage from the total XP after every XP of the session; `routers/world.py`'s `dragon_out` catches up the same way; `GET /api/world` serves `stages`. Then (Task 3) the camp's `xp` block becomes the dragon's gauge `{total, floor, next}`, and (Task 4) `RANKS`, `rank_for`, the rank fields of `progression.xp` and `/api/world`'s `ranks` go.
- Client (`web/src`): `DragonStage` gains `illustre` and `ancestral` everywhere (labels, activities, art, facing, scene widths, dialogue), the art track's pictures move into `web/public/art/dragon/` (Task 2); `lib/world/dragon.ts` gets the gauge helpers (`gaugeOf`, `stageLine` in XP words, Task 3; `stageXp`, `scaleOf`, `victoryGauge`, Task 4) that the HUD, the nest and `VictorySpoils` share.

**Tech Stack:** Svelte 5 (runes) + TypeScript + Vite 7, vitest 5 (node env, no component rendering: logic that needs a unit test lives in a pure `.ts` module), Playwright 1.63 (WebKit `desktop` 1280×720 and `ipad` 1180×820 touch, which runs `scenes-*.spec.ts`), FastAPI + pydantic 2 + SQLite, pytest. No new dependency, no migration.

**Spec:** `docs/superpowers/specs/2026-09-29-dragon-growth-design.md` is binding (§1 stages and thresholds, §2 ranks merge into stages, §3 the dragon's words and looks, §4 data, §5 testing). Context: `docs/superpowers/specs/2026-09-29-progression-roadmap.md` (sub-project 3 comes after sub-project 1 and before sub-project 2, which removes neutralisation: this plan does **not** touch neutralisation itself, only stops it from driving the stage). House style and toolchain: `docs/superpowers/plans/2026-09-29-sp1-scoring-xp.md`. Repo-root `CLAUDE.md` is binding for every agent: no "pre-existing" problems, tests and `svelte-check` clean with zero errors and zero warnings, no emoji anywhere player-visible.

## Dependencies and batching

Execution is subagent-driven and **sequential**, in the worktree `C:\Users\nicol\IdeaProjects\school-playground\.claude\worktrees\art-skills` (branch `worktree-art-skills`, `STACK=prog`). **Precondition:** sub-project 1 is fully merged on this branch (its Tasks 5-10: the bestiary and boss copy, the pace-and-aids screen, the victory's copy line and XP chips in `VictorySpoils.svelte`, stirring removed, Palamède, its README task). Before Task 1 the controller checks `git log --oneline -40` for sub-project 1's Task 10 commit (« README: the five review aids, and data/regles.json … ») and `grep -rn "stirring\|too_easy" web/src server/app` printing nothing; if either fails, stop and report. Each task starts from the previous task's commit; a reviewer gates each task before the next one starts.

| # | Task | Recommended model | Why |
|---|---|---|---|
| 1 | Server: the dragon grows from XP (`world/dragon.py`, `dragon_stages` in the rules file, progression and `dragon_out` from XP, `/api/world` `stages`, `progression.xp` stage fields added), world e2e steps 5-6, one full e2e run | opus | Every hero now hatches after about two sessions: the full e2e run may surface specs that assumed an egg, which need judgment. |
| 2 | Client: six stages and their art (the type, labels, activities, `ART.dragon` with the files moved in, facing, scene widths, the new dialogue lines, the neutralisation wording that no longer holds, a `when.stage` guard); nest e2e per stage | sonnet | Fully specified here, copy included. |
| 3 | The camp's gauge is the dragon's: `camp.xp` = `{total, floor, next}` from the stored stage; the HUD laurel, the nest's growth sheet, `stageLine` in XP words, Éris's dossier aside; `DragonOut.next_stage_at` goes | sonnet | Server and client contract, fully specified. |
| 4 | The victory's stage-up, ranks gone: `progression.xp` without rank fields, `RANKS`/`rank_for`/`ranks` removed, `VictorySpoils`' two-part gauge keyed on the stage, « Ton dragon grandit ! », victory e2e | opus | The animation's phases, saved victories from before the change, and a removal that spans server, client and e2e. |
| 5 | README (dragon growth, `dragon_stages` in the rules file) and the full gate | opus | The gate may surface cross-task fixes that need judgment. |

**Art (Task 2):** the art track has staged the three pictures at `assets/art/export/dragon/dragon_adult_cut.webp` (redrawn in the young dragon's three-quarter pose), `dragon_illustre_cut.webp` and `dragon_ancestral_cut.webp` (1024 px, 116-136 KB each, committed in `0f7953b`; contact sheet `docs/art/progression-stages.png`). They are never copied into `web/public/art` before Task 2, because `web/src/lib/world/art.test.ts` requires every mapped path to exist and the art map to stay under budget. Task 2's first step checks they exist and stops if not.

Playwright runs are serialised machine-wide by the lock in `scripts/playwright.sh` (`with_playwright_lock`, `scripts/lib.sh`); the art agents' Forge and segmentation batches take the same lock (`tools/art/with_lock.sh`), so a queued e2e run is waiting for them, not hanging. Never read Forge's files.

## Global Constraints

- **Stages and thresholds (spec §1), verbatim:**

  | Stage key | Name | Total XP (default) |
  |---|---|---|
  | `egg` | Œuf | 0 |
  | `hatchling` | Dragonnet | 100 |
  | `young` | Jeune dragon | 1 200 |
  | `adult` | Dragon adulte | 5 000 |
  | `illustre` | Dragon illustre | 15 000 |
  | `ancestral` | Dragon ancestral | 40 000 |

  "The thresholds live in `data/regles.json` (`dragon_stages`, same fallback rules as sub-project 1's file)." "The stage is stored and **never goes down** (a lowered threshold or a restored backup never shrinks it): stored = max(stored, stage for the XP)." "Neutralisation stops driving the stage […]. An existing profile keeps its stored stage." "`hatched_at` is set when leaving `egg`, as today; the naming prompt is unchanged."
- **Ranks merge (spec §2):** "`RANKS` and `rank_for` go; `progression.xp` reports `stage_before`/`stage_after` and the gauge's floor and next threshold (`floor`, `next`), replacing `rank_before`/`rank_after`/`title_after`. `GET /api/world` serves the stage table (key, name, xp) instead of `ranks`." The HUD laurel "shows progress to the next stage, labelled with the stage name; at the last stage it is full and says « Dragon ancestral »." The victory gauge "keeps its two-part logic […] keyed on a stage change […] and says « Ton dragon grandit ! » with the new stage name." "The « Nouveau rang » wording and any rank title on screen go."
- **The dragon's words (spec §3), verbatim:** `STAGE_ACTIVITY` « Il veille sur le camp et raconte ses exploits. » (illustre) / « Il lit les vieux parchemins et veille sur toi. » (ancestral). `stageLine` from `young` on: « Encore un peu de gloire et je grandis. » when under 20 % remains, else « Chaque texte bien défendu me fait grandir. »; at `ancestral`: « J'ai tout lu, tout vu. Et je veille toujours sur toi. ». "No number in the dragon's mouth; the HUD gauge carries the numbers." Every dragon dialogue event with per-stage variants gets at least three variants for `illustre` and for `ancestral`; "the illustre speaks with pride in its deeds, the ancestral with calm wisdom, never condescending".
- **Data (spec §4):** no migration (`dragon.stage` is free text).
- **Scope:** neutralisation, the mastery window, relics, boss tiers (counted in neutralised lieutenants) and the +200 mastery XP stay exactly as they are (sub-project 2 changes them); the +200 still counts toward the dragon like any XP. `DragonOut.neutralised` and `.available` stay (the camp's « tricks before Éris » count reads them).
- **Toolchain (verified against `scripts/` on 2026-09-29):** no host Node and no host Python for the project. From the worktree root, in Git Bash:
  - `scripts/pytest.sh -q <paths relative to server/>` (e.g. `scripts/pytest.sh -q tests/test_dragon.py`; it runs in `server/`);
  - `scripts/npm.sh run test -- <paths relative to web/>` (vitest, focused, e.g. `src/lib/world/dragon.test.ts`);
  - `scripts/npm.sh run check` (svelte-check over `src`, then `tsc -p tsconfig.e2e.json` over `e2e/`: must print `0 errors and 0 warnings` and tsc must print nothing);
  - `STACK=prog scripts/playwright.sh <spec-file-or-filter> [--project=desktop|ipad] [--repeat-each=3] [-g "<title>"]`;
  - `STACK=prog PW_WORKERS=4 scripts/check.sh` (the full gate: pytest, tts pytest, svelte-check + e2e tsc, vitest, both docker builds, all e2e, the real-voice spec).
  **This is a worktree: always set `STACK=prog`** for `playwright.sh` and `check.sh` (the main checkout's stack is `discorde`; ours is `discorde-prog`). Do not run Docker or Playwright outside these wrappers.
- **Testing rules:** per task, run the focused vitest files, `scripts/npm.sh run check`, and the focused pytest files; run every **new or changed** e2e spec (or test, with `-g`) with `--repeat-each=3`; run every **touched but unchanged-in-intent** spec once. Task 1 also runs the whole e2e suite once (it changes when every hero's dragon hatches). The full gate runs in Task 5. The crash-only retry (`scripts/playwright-crash-retry.mjs`) retries a named "browser crashed" failure once; any other failure is a real failure. A flake is a defect: root-cause it, never retry it away.
- **e2e robustness (8 workers by default, 4 in the gate):** import `test`/`expect` from `./crashGuard` (audio stub, tours off); each test creates its own hero (`createProfileApi`) and its own text (`createText` with `uniqueName`); a finger on `ipad`, a mouse on `desktop` (`tap(locator, testInfo)`); no `waitForTimeout`; web-first assertions and `expect.poll`. A stage or an XP total a test needs is set by intercepting `/api/profiles/{id}/camp` with `page.route` (the pattern of `scenes-nest.spec.ts` and `playability-ui4.spec.ts`'s faces walk), scoped to the test's own hero id; the real XP-driven growth is pinned by pytest (XP rows written to the test database) and end to end by `world.spec.ts` step 5.
- **French copy:** every French string of this plan is used verbatim. In-world, warm, gender-neutral towards the player (no adjective or participle agreeing with her), no school register (`BANNED` in `web/src/testing/copyRules.ts`: « niveau », « réviser »…), no guilt wording (`GUILT`: manqué, raté, perdu), no FOMO. The dragon is « il » (masculine, as today). Plurals through `plural()`. Typography: in TypeScript strings U+202F (`\u202f`) before « : ; ! ? % » and in thousands (« 15 000 »); in `content/dialogue/*.json` plain spaces (`content.test.ts` forbids U+00A0/U+202F there; `frenchSpacing()` adds them at display). Lines ≤ 170 characters, no `"`, no `...` (use `…`). Code, comments, docs and commit messages are in English.
- **No emoji (CLAUDE.md):** not in any string, badge or marker. The stages are the painted cut-outs.
- **Guards that must stay green (vitest):** `noEmoji`, `registerGuard`, `noGuilt`, `formPlural`, `frenchSpacing`, `placesKit`, `artReferenced`, `app.css`, `lib/battle/lines.test.ts`, `lib/world/art.test.ts` (every mapped path exists, non-scene art < 150 KB each and < 2.5 MB in all), `lib/world/bestiary.test.ts`, `lib/dialogue/content.test.ts`; server `tests/test_french_spacing.py`.
- **Commits:** on `worktree-art-skills`, shared with art agents. **Always** `git add <paths> && git commit -m "..." -- <paths>`; a `git mv`/`git rm` names both its paths in the commit. Never `git add -A`, `git stash`, `git reset`, `git checkout`, `git restore` of tracked work, `git clean`, or any history rewrite. If git reports `index.lock`, wait a few seconds and retry. End every message with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- **Verification:** run each task's commands and paste the real output (counts included) into the report. A failing, flaky or warning test anywhere is yours to fix or to report as an open item, never "pre-existing" (CLAUDE.md).

## Review Focus

The five failure modes the spec implies but its test list does not pin, most likely first. Each has its test in the owning task.

1. **A stored stage ahead of the XP.** Every hero who grew the dragon from neutralisations keeps a stored `young` or `adult` with a few hundred XP (spec §1-§4). Expected: the stage stays; the gauge reads **empty** on that stage's scale (floor 5 000, next 15 000, value 0), never negative or overfull; the dragon says « Chaque texte bien défendu me fait grandir. »; a victory that does not reach the stage's floor shows no stage change. Tests: Task 1 `test_a_stored_adult_stays_adult_with_little_xp`; Task 3 `test_the_camp_gauge_follows_the_stored_stage`, `hudXp` "stored ahead" case, `stageLine` stored-ahead case, the HUD e2e's third state; Task 4 `victoryGauge` stored-ahead case.
2. **Stage tables in the rules file that look right but are not.** A threshold that does not rise (`"young": 6000` above the adult's 5 000, `"hatchling": 0`), an egg that is not 0, `true`, `1200.5`, a negative number, a 400-digit integer, an unknown stage key, a list instead of an object. Expected: a wrong value is logged and its default kept; a table that no longer rises is refused whole (logged) and the built-in table applies; `"egg": 0` is accepted quietly; the other rules keys are untouched. Tests: Task 1 `test_a_wrong_dragon_stage_value_is_logged_and_its_default_kept`, `test_dragon_stages_that_do_not_rise_are_refused_whole`, `test_an_egg_at_zero_is_accepted_quietly`, `test_dragon_stages_that_are_not_an_object_keep_the_built_in_ones`.
3. **A victory that crosses two stages, or reaches the top.** A lowered threshold, a boss bonus or a stored-ahead profile can jump egg → young in one session; the last stage has no next threshold. Expected: the old stage's scale fills, then the new stage's scale shows (the middle stage is skipped, not animated); at `ancestral` the gauge is full (`max` 1, value 1), no division by zero, and the note says « Ton dragon grandit ! ». Tests: Task 4 `victoryGauge` "two stages at once" and "to the top" cases, `scaleOf('ancestral')`.
4. **Exact thresholds and the top of the curve.** 99/100, 14 999/15 000, 39 999/40 000 XP; a hero at 41 000 XP. Expected: the stage changes exactly at the threshold; at the top the HUD laurel is full and reads « Dragon ancestral · 41 000 XP », the nest says « Il a fini de grandir. » without a count, the dragon says « J'ai tout lu, tout vu. Et je veille toujours sur toi. ». Tests: Task 1 `test_six_stages_on_a_rising_curve`, `test_the_gauge_runs_from_the_stage_to_the_next_and_is_open_at_the_top`; Task 3 `test_the_camp_gauge_follows_the_stored_stage` (40 300 XP), `hudXp`/`growth` top cases, the HUD and nest e2e top states.
5. **A victory saved before the change.** A child mid-victory at deploy time: the play state keeps a `progression` whose `xp` carries `rank_before`/`rank_after`/`title_after` and no stage fields. Expected: the victory resumes on the dragon's scale (stages from `progression.dragon`, thresholds from the catalogue's table, or the defaults while it loads), labelled with a stage name, no « undefined », no rank title, no crash. Tests: Task 4 `victoryGauge` "saved before the change" case and the e2e `a victory saved before the stages resumes on the dragon's scale`.

## Rulings taken by this plan (the spec is silent or ambiguous; do not re-ask)

- **R1 The rules file's `dragon_stages`** may name `hatchling` to `ancestral`, each a whole number of XP (0 to 1 000 000, the rules file's existing count bound). The egg is always 0: `"egg": 0` is accepted without a warning, any other egg value is logged and ignored. After the per-key checks, the table must rise strictly from stage to stage; if it does not, no single key can be blamed, so the whole `dragon_stages` is logged and the built-in table applies. `Rules.as_dict()` (served as `/api/world`'s `rules`) includes `dragon_stages`; the client reads the thresholds from `/api/world`'s `stages`, never from `rules`.
- **R2 The stage is grown after every XP of the session** (the session's, the quests', the mastery's and the week's): `apply_progression`'s dragon step moves after the weekly goal. `dragon_out` (every `GET /camp` and `PATCH /dragon`) catches up the same way, so a threshold lowered in the rules file is applied on the next camp visit.
- **R3 The gauge follows the stored stage**, not the XP's: `floor` = the stored stage's threshold, `next` = the next stage's threshold (`null` at `ancestral`). A total below the floor reads an empty gauge (value clamped at 0); a total above `next` (only possible on a stale response) reads full.
- **R4 `camp.xp` becomes `{total, floor, next}`**; the stage stays in `camp.dragon.stage`. The HUD label is « {stage name} · {total} XP » with thousands grouped by U+202F (« Dragon ancestral · 41 000 XP »), through a new `thousands()` in `lib/text/french.ts`. `DragonOut.next_stage_at` (a neutralisation count) goes in Task 3.
- **R5 The stored stage is normalised:** a stored stage that is not one of the six (a hand-edited row) ranks below the egg, is replaced by the stage for the XP, and is reported as `egg` in `stage_before`. `hatched_at` is written (once, `COALESCE`) only when the stage written is not `egg`.
- **R6 `stageLine`** (the camp greeting's stage line): the egg keeps « Chaque piège d'Éris déjoué me fait frémir dans ma coquille. » (a caught trap still earns XP); an unnamed hatchling still asks « Au fait, tu me donnes un nom ? »; a **named hatchling** says the same XP lines as the young dragon on (its old line counted neutralisations); « Je bats des ailes ! », the lieutenant counts and the adult's « Je veille sur le camp… » line go from `stageLine` (that line stays one of the adult's `nest.enter` variants). "Under 20 % remains" means `5 × (next − total) < next − floor` (strictly under a fifth of the stage's span, in whole numbers).
- **R7 The victory:** the gauge's label is the stage name (the old one while the old scale fills, then the new one), its note « Ton dragon grandit ! » shows once the new scale shows; the « Nouveau rang : … » ribbon and « Les feuilles repoussent » go; the dragon card (the picture and « {name} grandit : {stage} ») stays. The new scale uses the server's `floor`/`next` when the progression carries them, else the catalogue's table. The stages come from `progression.xp.stage_before/stage_after`, else `progression.dragon` (a saved victory).
- **R8 The words that said neutralisation grows the dragon are rewritten** (they are false once the XP drives it): `nest.enter`'s hatchling line, the camp tour's egg line on the nest, the nest tour's closing line, the care panel's egg line (`careLine`), the bestiary's dragon `inGame`, and the nest's growth sheet (Task 3).
- **R9 Éris's dossier aside** « Ton rang : {title}. Je fais semblant de ne pas l'avoir vu. » is a rank title on screen: it becomes `dragonAside(stage)`: « Ton dragon dort encore dans sa coquille. Qu'il y reste. » for the egg, else « Ton dragon a grandi : {stage in lower case}. Je fais semblant de ne pas l'avoir vu. ».
- **R10 The nest's growth sheet:** label « Prochaine étape : {next stage's name} », count « {value} sur {max} XP » (thousands grouped); at the top « Il a fini de grandir. » and no count.
- **R11 Sizes and facing:** `Dragon.svelte` takes its size from its callers, so the per-stage sizes are `camp.ts` / `nest.ts` `WIDTH`: camp `illustre 9.5`, `ancestral 10`; nest `illustre 27`, `ancestral 28` (the nest's dragon spot is x 34-68; 28 % keeps the square picture's top at about y 12 %, below the HUD). The redrawn adult, the illustre and the ancestral keep the young dragon's three-quarter pose, looking right (`docs/art/progression-stages.png`), so `FACES.dragon.adult` flips from `left` to `right`.
- **R12 The client's stage list** is `DRAGON_STAGES` in `lib/world/types.ts` (like `LIEUTENANT_ORDER`), `DragonStage` its element type; the client's default thresholds `DEFAULT_STAGE_XP` (`lib/world/dragon.ts`) mirror the server's and apply until the catalogue has come.
- **R13 The dialogue loader refuses an unknown stage** in a `when.stage` list (a typo such as « illustré » would otherwise never speak, silently).
- **R14 Rules are read at start-up only** (sub-project 1's ruling R16); the README says so for `dragon_stages` too.

## File map

| File | Responsibility | Task |
|---|---|---|
| `server/app/world/dragon.py` (new), `server/tests/test_dragon.py` (new) | stage order, names, defaults, stage for XP, never-down stage, gauge, table | 1, 3 |
| `server/app/rules.py`, `server/tests/test_rules.py` | `dragon_stages` | 1 |
| `server/app/world/progression.py` | the stage from XP after every XP, `store_stage`, stage fields (1); rank fields out (4) | 1, 4 |
| `server/app/world/mastery.py` | `dragon_stage` out (1), `next_stage_at` out (3) | 1, 3 |
| `server/app/routers/world.py` | `dragon_out` from XP, `stages` (1); `xp_block` (3); `ranks` out (4) | 1, 3, 4 |
| `server/app/world/xp.py`, `server/app/world/catalog.py` | `rank_for`, `RANKS` out | 4 |
| `server/tests/test_progression.py`, `test_world_rules.py`, `test_world_api.py` | server tests | 1, 3, 4 |
| `web/src/lib/world/types.ts` | `DRAGON_STAGES` (2); `CampResponse.xp`, `DragonOut` (3); `WorldCatalog.stages`, `Progression.xp` (4) | 2, 3, 4 |
| `web/src/lib/world/dragon.ts` (+ test) | labels, activities (2); `gaugeOf`, `nextStage`, `stageLine` (3); `stageXp`, `scaleOf`, `victoryGauge` (4) | 2, 3, 4 |
| `web/src/lib/world/art.ts` (+ test), `web/public/art/dragon/*` | the six pictures | 2 |
| `web/src/lib/battle/battle.ts` (+ test) | `FACES.dragon` | 2 |
| `web/src/lib/world/scenes/camp.ts`, `nest.ts` (+ tests), `cabin.test.ts` | widths (2); greeting, growth (3) | 2, 3 |
| `web/src/lib/dialogue/content.ts`, `content.test.ts`, `content/dialogue/camp.json`, `nest.json` | lines, the `when.stage` guard | 2 |
| `web/src/lib/world/bestiary.ts` | the dragon's `inGame` | 2 |
| `docs/art/style-guide.md` | the exports' new home | 2 |
| `web/src/lib/text/french.ts` (+ test) | `thousands` | 3 |
| `web/src/lib/scene/hud.ts` (+ test), `web/src/components/scene/Hud.svelte` | the HUD laurel | 3 |
| `web/src/screens/Nest.svelte` | the growth sheet | 3 |
| `web/src/lib/world/eris.ts` (+ test), `web/src/components/places/war/DossierPanel.svelte` | Éris's aside | 3 |
| `web/src/components/battle/VictorySpoils.svelte`, `web/src/lib/battle/lines.ts` (+ test) | the victory's gauge | 4 |
| `web/src/components/ui/LaurelBar.svelte`, `web/src/lib/ui/laurel.ts` (+ test), `web/src/components/juice/Gauge.svelte` | comments: stage, not rank | 4 |
| `web/e2e/world.spec.ts`, `scenes-nest.spec.ts`, `scenes-camp.spec.ts`, `scenes-battle-victory.spec.ts`, `playability-ui4.spec.ts` | e2e | 1, 2, 3, 4 |
| `README.md` | dragon growth, `dragon_stages` | 5 |

---

### Task 1: Server — the dragon grows from XP

**Files:**
- Create: `server/app/world/dragon.py`, `server/tests/test_dragon.py`
- Modify: `server/app/rules.py`, `server/app/world/mastery.py` (`dragon_stage` removed), `server/app/world/progression.py` (step order, `store_stage`, stage fields), `server/app/routers/world.py` (`dragon_out`, `get_camp`, `patch_dragon`, `get_world`, imports, `STAGE_ORDER` removed)
- Test: `server/tests/test_rules.py`, `server/tests/test_progression.py`, `server/tests/test_world_rules.py`, `web/e2e/world.spec.ts` (steps 5-6, describe title)

**Interfaces:**
- Consumes: `Rules`, `load_rules`, `_count`, `log` (`app/rules.py`); `xp_total`, `ensure_dragon` (`app/world/progression.py`); `app.state.rules` (set in `main.py`'s lifespan).
- Produces:
  - `app.world.dragon`: `STAGE_ORDER: tuple[str, ...] = ("egg", "hatchling", "young", "adult", "illustre", "ancestral")`; `STAGE_NAMES: dict[str, str]`; `DEFAULT_STAGE_XP: dict[str, int]`; `stage_index(stage: str | None) -> int` (−1 for an unknown one); `stage_for_xp(total: int, thresholds: dict[str, int]) -> str`; `grown_stage(stored: str | None, total: int, thresholds) -> str`; `stage_gauge(stage: str, thresholds) -> tuple[int, int | None]` (floor, next); `stage_table(thresholds) -> list[dict]` (`{"key", "name", "xp"}` in order).
  - `Rules.dragon_stages: dict[str, int]` (defaults `DEFAULT_STAGE_XP`), in `as_dict()`.
  - `app.world.progression.store_stage(conn, profile_id: int, stage: str, now: str) -> None`.
  - `progression.xp` gains `"stage_before"`, `"stage_after"`, `"floor"`, `"next"` (the rank fields stay until Task 4); `progression.dragon` keeps `{stage_before, stage_after, needs_name}`, both from XP now.
  - `dragon_out(conn, profile, now, rules: Rules)`; `GET /api/world` gains `"stages": stage_table(rules.dragon_stages)`.

- [ ] **Step 1: Write the failing rules tests** — `server/tests/test_rules.py`: add `from app.world.dragon import DEFAULT_STAGE_XP` to the imports, add the key to `DEFAULTS` and the new tests:

```python
STAGE_DEFAULTS = {"egg": 0, "hatchling": 100, "young": 1200, "adult": 5000, "illustre": 15000, "ancestral": 40000}
DEFAULTS = {"quest_min_chances": 3, "quest_min_correct": 0.85, "fight_max_per_100": 4.0, "copy_belle_max_per_100": 2.0,
            "copy_correcte_max_per_100": 8.0, "aid_bonus": 0.2, "pace_bonus": {"1": 0.0, "2": 0.25, "3": 0.5},
            "prophecy_bonus": 0.5, "chouette_hints": 3, "dragon_stages": STAGE_DEFAULTS}
```

(keep `DEFAULTS`' existing keys exactly; only `"dragon_stages"` is new), and at the end of the file:

```python
# Spec 2026-09-29 dragon growth §1: the thresholds live in the rules file, with the same fallback rules.
def test_the_built_in_stages_mirror_the_spec():
    assert DEFAULT_STAGE_XP == STAGE_DEFAULTS


def test_dragon_stages_from_the_file_keep_the_other_defaults(tmp_path):
    rules = load_rules(write(tmp_path, '{"dragon_stages": {"hatchling": 50, "ancestral": 30000}}'))
    assert rules.dragon_stages == {**STAGE_DEFAULTS, "hatchling": 50, "ancestral": 30000}
    assert rules.as_dict() == {**DEFAULTS, "dragon_stages": {**STAGE_DEFAULTS, "hatchling": 50, "ancestral": 30000}}


def test_a_wrong_dragon_stage_value_is_logged_and_its_default_kept(tmp_path, caplog):
    text = json.dumps({"dragon_stages": {"egg": 10, "hatchling": True, "young": 1200.5, "adult": -1, "dragon": 5,
                                         "ancestral": 10 ** 400, "illustre": 20000}})
    with caplog.at_level(logging.WARNING):
        rules = load_rules(write(tmp_path, text))
    assert rules.dragon_stages == {**STAGE_DEFAULTS, "illustre": 20000}
    for key in ("'egg'", "'hatchling'", "'young'", "'adult'", "'dragon'", "'ancestral'"):
        assert key in caplog.text, key


def test_an_egg_at_zero_is_accepted_quietly(tmp_path, caplog):
    with caplog.at_level(logging.WARNING):
        assert load_rules(write(tmp_path, '{"dragon_stages": {"egg": 0}}')).dragon_stages == STAGE_DEFAULTS
    assert caplog.text == ""


def test_dragon_stages_that_do_not_rise_are_refused_whole(tmp_path, caplog):
    with caplog.at_level(logging.WARNING):
        assert load_rules(write(tmp_path, '{"dragon_stages": {"young": 6000}}')).dragon_stages == STAGE_DEFAULTS
        assert load_rules(write(tmp_path, '{"dragon_stages": {"hatchling": 0}}')).dragon_stages == STAGE_DEFAULTS
        assert load_rules(write(tmp_path, '{"dragon_stages": {"illustre": 5000, "aid_bonus": 1}}')).dragon_stages == STAGE_DEFAULTS
    assert caplog.text.count("must rise") == 3


def test_dragon_stages_that_are_not_an_object_keep_the_built_in_ones(tmp_path):
    assert load_rules(write(tmp_path, '{"dragon_stages": [100, 1200], "chouette_hints": 2}')).as_dict() == {**DEFAULTS, "chouette_hints": 2}
```

- [ ] **Step 2: Write the failing dragon tests** — `server/tests/test_dragon.py`:

```python
"""The dragon grows from total XP (spec 2026-09-29 dragon growth §1, §4)."""
import sqlite3

from fastapi.testclient import TestClient

from app.db import DB_FILENAME
from app.main import create_app
from app.rules import RULES_FILENAME
from app.world.dragon import (DEFAULT_STAGE_XP, STAGE_ORDER, grown_stage, stage_for_xp, stage_gauge, stage_index,
                              stage_table)
from tests.test_progression import hydre_result, post
from tests.test_sessions import make_profile, make_text

STAGES = [{"key": "egg", "name": "Œuf", "xp": 0}, {"key": "hatchling", "name": "Dragonnet", "xp": 100},
          {"key": "young", "name": "Jeune dragon", "xp": 1200}, {"key": "adult", "name": "Dragon adulte", "xp": 5000},
          {"key": "illustre", "name": "Dragon illustre", "xp": 15000},
          {"key": "ancestral", "name": "Dragon ancestral", "xp": 40000}]


def db(settings) -> sqlite3.Connection:
    return sqlite3.connect(settings.data_dir / DB_FILENAME)


def give_xp(settings, pid: int, amount: int) -> None:
    conn = db(settings)
    conn.execute("INSERT INTO xp_event(profile_id, amount, reason, created_at) VALUES (?, ?, 'session', ?)",
                 (pid, amount, "2026-09-30T10:00:00+00:00"))
    conn.commit(); conn.close()


def set_stage(settings, pid: int, stage: str) -> None:
    conn = db(settings)
    conn.execute("UPDATE dragon SET stage = ? WHERE profile_id = ?", (stage, pid))
    conn.commit(); conn.close()


def stored(settings, pid: int) -> tuple:
    conn = db(settings)
    row = conn.execute("SELECT stage, hatched_at FROM dragon WHERE profile_id = ?", (pid,)).fetchone()
    conn.close()
    return row


def app_with_rules(settings, text: str) -> TestClient:
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    (settings.data_dir / RULES_FILENAME).write_text(text, encoding="utf-8")
    return TestClient(create_app(settings))


def test_six_stages_on_a_rising_curve():
    assert STAGE_ORDER == ("egg", "hatchling", "young", "adult", "illustre", "ancestral")
    t = DEFAULT_STAGE_XP
    assert [stage_for_xp(x, t) for x in (0, 99, 100, 1199, 1200, 4999, 5000, 14999, 15000, 39999, 40000, 10 ** 6)] == [
        "egg", "egg", "hatchling", "hatchling", "young", "young", "adult", "adult", "illustre", "illustre",
        "ancestral", "ancestral"]
    assert stage_table(t) == STAGES


def test_the_stage_never_goes_down_and_an_unknown_stored_stage_gives_way():
    t = DEFAULT_STAGE_XP
    assert grown_stage("adult", 300, t) == "adult"
    assert grown_stage("hatchling", 16000, t) == "illustre"
    assert stage_index("dragonnet") == -1 and grown_stage("dragonnet", 0, t) == "egg"
    assert grown_stage(None, 150, t) == "hatchling"


def test_the_gauge_runs_from_the_stage_to_the_next_and_is_open_at_the_top():
    t = DEFAULT_STAGE_XP
    assert stage_gauge("egg", t) == (0, 100)
    assert stage_gauge("adult", t) == (5000, 15000)
    assert stage_gauge("ancestral", t) == (40000, None)


def test_the_world_serves_the_stage_table(client):
    assert client.get("/api/world").json()["stages"] == STAGES


def test_a_session_hatches_the_egg_at_100_xp_and_reports_the_gauge(client):
    pid = make_profile(client, level="10H"); tid = make_text(client)
    first = post(client, pid, tid, hydre_result(), day="2026-09-21")["progression"]     # 54 XP
    assert first["dragon"]["stage_after"] == "egg" and (first["xp"]["floor"], first["xp"]["next"]) == (0, 100)
    second = post(client, pid, tid, hydre_result(), day="2026-09-22")["progression"]    # 108 XP
    assert second["dragon"] == {"stage_before": "egg", "stage_after": "hatchling", "needs_name": True}
    assert [second["xp"][k] for k in ("stage_before", "stage_after", "floor", "next")] == ["egg", "hatchling", 100, 1200]


def test_the_weeks_bonus_counts_toward_the_stage(settings):
    # R2: the stage is grown after every XP of the session. Same day, so no neutralisation: 54, 108,
    # then 162 + the week's 40 = 202 crosses a hatchling threshold of 200 only thanks to the week.
    with app_with_rules(settings, '{"dragon_stages": {"hatchling": 200}}') as c:
        pid = make_profile(c, level="10H"); tid = make_text(c)
        for _ in range(2):
            assert post(c, pid, tid, hydre_result(), day="2026-09-21")["progression"]["dragon"]["stage_after"] == "egg"
        p = post(c, pid, tid, hydre_result(), day="2026-09-21")["progression"]
        assert {"reason": "weekly", "amount": 40} in p["xp"]["bonuses"] and p["xp"]["total_after"] == 3 * 54 + 40
        assert p["dragon"]["stage_after"] == "hatchling"


def test_thresholds_come_from_the_rules_file_and_the_world_serves_them(settings):
    with app_with_rules(settings, '{"dragon_stages": {"hatchling": 50, "ancestral": 30000}}') as c:
        assert [s["xp"] for s in c.get("/api/world").json()["stages"]] == [0, 50, 1200, 5000, 15000, 30000]
        pid = make_profile(c, level="10H"); tid = make_text(c)
        p = post(c, pid, tid, hydre_result())["progression"]
        assert p["dragon"]["stage_after"] == "hatchling" and (p["xp"]["floor"], p["xp"]["next"]) == (50, 1200)


# Spec §4: an existing profile keeps its stored stage (here one grown from neutralisations before).
def test_a_stored_adult_stays_adult_with_little_xp(client, settings):
    pid = make_profile(client, level="10H"); tid = make_text(client)
    client.get(f"/api/profiles/{pid}/camp")            # creates the dragon's row
    set_stage(settings, pid, "adult")
    p = post(client, pid, tid, hydre_result())["progression"]
    assert p["dragon"] == {"stage_before": "adult", "stage_after": "adult", "needs_name": True}
    assert [p["xp"][k] for k in ("stage_before", "stage_after", "floor", "next")] == ["adult", "adult", 5000, 15000]
    assert client.get(f"/api/profiles/{pid}/camp").json()["dragon"]["stage"] == "adult"
    assert stored(settings, pid)[0] == "adult"


def test_a_profile_with_16000_xp_reads_illustre(client, settings):
    pid = make_profile(client, level="10H")
    give_xp(settings, pid, 16000)
    assert client.get(f"/api/profiles/{pid}/camp").json()["dragon"]["stage"] == "illustre"
    stage, hatched_at = stored(settings, pid)
    assert stage == "illustre" and hatched_at is not None


def test_a_raised_threshold_or_a_restored_backup_never_shrinks_the_stage(settings):
    with TestClient(create_app(settings)) as c:
        pid = make_profile(c, level="10H"); tid = make_text(c)
        give_xp(settings, pid, 1300)
        assert c.get(f"/api/profiles/{pid}/camp").json()["dragon"]["stage"] == "young"
    with app_with_rules(settings, '{"dragon_stages": {"young": 3000}}') as c:
        assert c.get(f"/api/profiles/{pid}/camp").json()["dragon"]["stage"] == "young"
        p = post(c, pid, tid, hydre_result())["progression"]
        assert p["dragon"]["stage_after"] == "young" and (p["xp"]["floor"], p["xp"]["next"]) == (3000, 5000)


def test_an_unknown_stored_stage_is_replaced_by_the_stage_for_the_xp(client, settings):
    pid = make_profile(client, level="10H"); tid = make_text(client)
    client.get(f"/api/profiles/{pid}/camp")
    set_stage(settings, pid, "dragonnet")               # a hand-edited row
    p = post(client, pid, tid, hydre_result())["progression"]
    assert p["dragon"]["stage_before"] == "egg" and p["dragon"]["stage_after"] == "egg"
    assert stored(settings, pid) == ("egg", None)
```

`server/tests/test_progression.py`: in `test_session_grants_xp_and_reports_rank`, after the `rank_before` assertion add

```python
    assert [p["xp"][k] for k in ("stage_before", "stage_after", "floor", "next")] == ["egg", "egg", 0, 100]
```

replace `test_mastery_over_three_days_hatches_the_dragon_and_grants_relic` by

```python
def test_mastery_over_three_days_grants_the_relic_and_the_dragon_hatches_from_xp(client):
    pid = make_profile(client, level="10H"); tid = make_text(client)
    p1 = post(client, pid, tid, hydre_result(), day="2026-09-21")["progression"]
    p2 = post(client, pid, tid, hydre_result(), day="2026-09-22")["progression"]
    p = post(client, pid, tid, hydre_result(), day="2026-09-23")["progression"]
    # Spec 2026-09-29 dragon growth §1: 54 then 108 XP, the egg hatches at 100; neutralising the
    # Hydra no longer grows it.
    assert p1["dragon"]["stage_after"] == "egg"
    assert p2["dragon"] == {"stage_before": "egg", "stage_after": "hatchling", "needs_name": True}
    assert p["neutralised"] == ["hydre"]
    assert [r["id"] for r in p["rewards"]] == ["ecaille_hydre"]
    assert p["dragon"] == {"stage_before": "hatchling", "stage_after": "hatchling", "needs_name": True}
    assert {"reason": "mastery", "amount": 200} in p["xp"]["bonuses"]
    # permanent: a bad day later does not undo it
    p4 = post(client, pid, tid, hydre_result(draft=6, caught=0), day="2026-09-24")["progression"]
    assert p4["neutralised"] == [] and p4["dragon"]["stage_after"] == "hatchling"
```

and delete `test_dragon_stage_is_persisted_monotonically` (its neutralisation-driven stage no longer exists; the never-down rule is pinned by `test_dragon.py`).

`server/tests/test_world_rules.py`: drop `dragon_stage` from the `app.world.mastery` import; rename `test_dragon_stage_and_tiers` to `test_boss_tiers_and_the_neutralisation_count` and delete its two `dragon_stage(...)` lines (the `next_stage_at` line stays until Task 3).

- [ ] **Step 3: Run them to see them fail**

Run: `scripts/pytest.sh -q tests/test_rules.py tests/test_dragon.py tests/test_progression.py tests/test_world_rules.py`
Expected: FAIL (`ModuleNotFoundError: app.world.dragon`; `dragon_stages` missing).

- [ ] **Step 4: The stage rules** — `server/app/world/dragon.py`:

```python
"""The dragon's six stages, grown from total XP (spec 2026-09-29 dragon growth §1-§2). Pure: the
thresholds come from the rules file (`Rules.dragon_stages`, defaults below)."""
from __future__ import annotations

STAGE_ORDER = ("egg", "hatchling", "young", "adult", "illustre", "ancestral")
STAGE_NAMES = {"egg": "Œuf", "hatchling": "Dragonnet", "young": "Jeune dragon", "adult": "Dragon adulte",
               "illustre": "Dragon illustre", "ancestral": "Dragon ancestral"}
DEFAULT_STAGE_XP = {"egg": 0, "hatchling": 100, "young": 1200, "adult": 5000, "illustre": 15000, "ancestral": 40000}


def stage_index(stage: str | None) -> int:
    """A stage's place in the order; an unknown stored one (a hand-edited row) ranks below the egg."""
    return STAGE_ORDER.index(stage) if stage in STAGE_ORDER else -1


def stage_for_xp(total: int, thresholds: dict[str, int]) -> str:
    stage = STAGE_ORDER[0]
    for s in STAGE_ORDER:
        if total >= thresholds[s]:
            stage = s
    return stage


def grown_stage(stored: str | None, total: int, thresholds: dict[str, int]) -> str:
    """stored = max(stored, stage for the XP): a raised threshold or a restored backup never shrinks it."""
    computed = stage_for_xp(total, thresholds)
    return stored if stage_index(stored) > stage_index(computed) else computed


def stage_gauge(stage: str, thresholds: dict[str, int]) -> tuple[int, int | None]:
    """The gauge's floor (the stage's own threshold) and the next stage's threshold (None at the top)."""
    i = STAGE_ORDER.index(stage)
    nxt = thresholds[STAGE_ORDER[i + 1]] if i + 1 < len(STAGE_ORDER) else None
    return thresholds[stage], nxt


def stage_table(thresholds: dict[str, int]) -> list[dict]:
    """What GET /api/world serves in place of the old ranks: every stage, its name and its XP."""
    return [{"key": s, "name": STAGE_NAMES[s], "xp": thresholds[s]} for s in STAGE_ORDER]
```

- [ ] **Step 5: The rules file's `dragon_stages`** — `server/app/rules.py`: add `from app.world.dragon import DEFAULT_STAGE_XP, STAGE_ORDER` after the `typing` import; extend the module docstring's last sentence with "; the dragon's stage thresholds (`dragon_stages`) are served as the world's stage table"; add the field after `chouette_hints`:

```python
    chouette_hints: int = 3
    dragon_stages: dict[str, int] = field(default_factory=lambda: dict(DEFAULT_STAGE_XP))
```

add after `_pace_bonus`:

```python
def _dragon_stages(raw: Any, path: Path) -> dict[str, int] | None:
    """Spec 2026-09-29 dragon growth §1: a partial table keeps the other stages' defaults; the egg is
    always 0; a table that no longer rises is refused whole (no single key can be blamed)."""
    if not isinstance(raw, dict):
        log.warning('%s: dragon_stages must be an object like {"young": 1200}; the built-in stages apply', path)
        return None
    out = dict(DEFAULT_STAGE_XP)
    for stage, value in raw.items():
        if stage == STAGE_ORDER[0] and _count(value) and value == 0:
            continue
        if stage not in STAGE_ORDER[1:] or not _count(value):
            log.warning("%s: dragon_stages[%r] = %r is ignored (hatchling to ancestral, a whole number of XP "
                        "from 0 to %d; the egg is always 0)", path, stage, value, MAX_COUNT)
            continue
        out[stage] = value
    xps = [out[s] for s in STAGE_ORDER]
    if any(a >= b for a, b in zip(xps, xps[1:])):
        log.warning("%s: dragon_stages must rise from stage to stage (%s); the built-in stages apply", path, xps)
        return None
    return out
```

and in `load_rules`' loop, after the `pace_bonus` branch:

```python
        elif key == "dragon_stages":
            stages = _dragon_stages(value, path)
            if stages is not None:
                values[key] = stages
```

(`app/world/__init__.py` is empty and `dragon.py` imports nothing of the app: no import cycle.)

- [ ] **Step 6: The progression grows the stage from XP** — `server/app/world/progression.py`:
  - docstring's first line: `"""Applies a saved session to the world: XP, quests, mastery, weekly goal, then the dragon grown from the total XP (spec §3.6; plan Decisions 3, 6, 7, 8, 11, 15; spec 2026-09-29 dragon growth §1)."""` (keep the second line);
  - imports: `from app.world.dragon import grown_stage, stage_gauge, stage_index` and `from app.world.mastery import boss_tiers, is_neutralised, lieutenants_for_level, mastery_window` (no `dragon_stage`);
  - after `ensure_dragon` add:

```python
def store_stage(conn, profile_id, stage, now) -> None:
    """Writes a grown stage; `hatched_at` is set once, when the dragon leaves the egg (spec §1)."""
    hatched = None if stage == "egg" else now
    conn.execute("UPDATE dragon SET stage = ?, hatched_at = COALESCE(hatched_at, ?), updated_at = ? WHERE profile_id = ?",
                 (stage, hatched, now, profile_id))
```

  - in `apply_progression`, replace everything from the `# 4. dragon stage is stored MONOTONICALLY…` comment to the end of the function by:

```python
    # 4. weekly goal
    target = int(json.loads(profile["settings_json"] or "{}").get("weekly_goal", 3))
    done = weekly_done(conn, pid, week)
    reached_now = False
    if done >= target and conn.execute("SELECT 1 FROM xp_event WHERE profile_id = ? AND reason = 'weekly' AND week = ?", (pid, week)).fetchone() is None:
        add_xp(conn, pid, QUEST_BONUS["weekly"], "weekly", now, week=week)
        bonuses.append({"reason": "weekly", "amount": QUEST_BONUS["weekly"]}); reached_now = True
    total_after = xp_total(conn, pid)
    rank_after, title_after, _, _ = rank_for(total_after)
    # 5. the dragon grows from the total XP (spec 2026-09-29 dragon growth §1), once every XP of this
    # session is in (its quests', its mastery's, the week's): stored = max(stored, stage for the XP),
    # so a raised threshold or a restored backup never shrinks it. Neutralisation no longer drives it.
    thresholds = rules.dragon_stages
    dragon = ensure_dragon(conn, pid, now)
    stage_before = dragon["stage"] if stage_index(dragon["stage"]) >= 0 else "egg"
    stage_after = grown_stage(dragon["stage"], total_after, thresholds)
    if stage_after != dragon["stage"]:
        store_stage(conn, pid, stage_after, now)
    needs_name = stage_after != "egg" and dragon["name"] is None
    floor, nxt = stage_gauge(stage_after, thresholds)
    return {"xp": {"session": xp.total, "parts": xp.parts, "bonuses": bonuses, "total_before": total_before, "total_after": total_after,
                   "rank_before": rank_before, "rank_after": rank_after, "title_after": title_after,
                   "stage_before": stage_before, "stage_after": stage_after, "floor": floor, "next": nxt},
            "quests": quest_out, "neutralised": newly, "rewards": rewards,
            "dragon": {"stage_before": stage_before, "stage_after": stage_after, "needs_name": needs_name},
            "weekly": {"target": target, "done": done, "reached_now": reached_now}, "boss": boss_out,
            "encounter": body.encounter}
```

  (the `# 3. mastery` block above keeps computing `already`/`newly`; `n`, `available`-for-the-stage and `computed` go with the old step 4).
  - `server/app/world/mastery.py`: delete `dragon_stage` (keep `_thresholds` and `next_stage_at` until Task 3); docstring: `"""Mastery (neutralisation) rule, the neutralisation count shown by the nest until sub-project 3's Task 3, and boss tiers (spec §3.6; plan Decisions 3, 8, 11)."""`.

- [ ] **Step 7: The camp's dragon from XP, and the stage table** — `server/app/routers/world.py`:
  - imports: add `from app.rules import Rules` and `from app.world.dragon import grown_stage, stage_table`; `from app.world.mastery import lieutenants_for_level, mastery_window, next_stage_at, tier_available`; `from app.world.progression import (boss_tiers_won, ensure_dragon, lieutenant_day_rows, neutralised_set, store_stage, weekly_done, xp_total)`; delete the `STAGE_ORDER = […]` line;
  - `dragon_out`:

```python
def dragon_out(conn: sqlite3.Connection, profile: sqlite3.Row, now: str, rules: Rules) -> dict:
    pid = profile["id"]
    dragon = ensure_dragon(conn, pid, now)
    available = lieutenants_for_level(profile["level"])
    n = len(neutralised_set(conn, pid))
    # Spec 2026-09-29 dragon growth §1: the stage follows the total XP and never goes down; a stage
    # caught up here (a threshold lowered in regles.json) is stored.
    stage = grown_stage(dragon["stage"], xp_total(conn, pid), rules.dragon_stages)
    if stage != dragon["stage"]:
        store_stage(conn, pid, stage, now)
    owned = {r[0] for r in conn.execute("SELECT reward_id FROM reward WHERE profile_id = ?", (pid,))}
    unlocked_tints = ["bronze"] + [t for t in TINTS[1:] if f"tint:{t}" in owned]
    return {"name": dragon["name"], "tint": dragon["tint"], "stage": stage, "neutralised": n, "available": len(available),
            "next_stage_at": next_stage_at(n, len(available)), "unlocked_tints": unlocked_tints}
```

  - `get_world`: `"stages": stage_table(request.app.state.rules.dragon_stages),` right after `"ranks"` (with the comment `# Spec 2026-09-29 dragon growth §2: the dragon's stages, their names and XP (from the rules file).`);
  - `get_camp(profile_id: int, request: Request, db: sqlite3.Connection = Depends(get_db))` and `dragon = dragon_out(db, profile, now, request.app.state.rules)`;
  - `patch_dragon(profile_id: int, body: DragonPatch, request: Request, db: sqlite3.Connection = Depends(get_db))` and both `dragon_out(db, profile, now, request.app.state.rules)` calls.

- [ ] **Step 8: Run the server tests**

Run: `scripts/pytest.sh -q tests/test_rules.py tests/test_dragon.py tests/test_progression.py tests/test_world_rules.py tests/test_world_api.py` then `scripts/pytest.sh -q`
Expected: all pass, no warning in the output.

- [ ] **Step 9: The world e2e** — `web/e2e/world.spec.ts`:
  - the describe title: `'world: camp, Oracle, quests, the dragon hatching from XP, mastery, boss'`;
  - step 5: name the first post's response `res1` (`const res1 = await postSession(…)`) and add after `expect(oracleProgress?.completed).toBe(true);`:

```ts
    // Spec 2026-09-29 dragon growth §1: the dragon hatches from XP, at 100. Step 4's short text and the
    // first session here stay under it; the second (with the Oracle's 150 and the week's 40) crosses it.
    expect(res1.progression.dragon.stage_after).toBe('egg');
    expect(res2.progression.xp.total_before).toBeLessThan(100);
    expect(res2.progression.xp.total_after).toBeGreaterThanOrEqual(100);
    expect(res2.progression.dragon).toEqual({ stage_before: 'egg', stage_after: 'hatchling', needs_name: true });
```

  - step 6: title `'6. mastery over three days neutralises the Hydra (the dragon grows from XP only); naming it; the dossier changes voice'`; replace the two `hatched.progression.dragon` expectations by

```ts
    // Neutralising the Hydra no longer grows the dragon (spec §1): it hatched from XP in step 5.
    expect(hatched.progression.dragon).toEqual({ stage_before: 'hatchling', stage_after: 'hatchling', needs_name: true });
```

  (the file's header comment « mastery hatch driven through the `X-Discorde-Day` test-clock header » becomes « mastery driven through … »).

- [ ] **Step 10: Run the e2e**

Run: `STACK=prog scripts/playwright.sh world.spec.ts --repeat-each=3`
Then, once, the whole suite (every hero's dragon now hatches after about two sessions): `STACK=prog scripts/playwright.sh`
Expected: all pass. A spec that assumed an egg after several posted sessions is updated to the XP rule (the dragon hatches at 100 XP) in this task, with a comment citing spec 2026-09-29 dragon growth §1; list each such change in the report.

- [ ] **Step 11: Commit**

```bash
git add server/app/world/dragon.py server/app/rules.py server/app/world/mastery.py server/app/world/progression.py server/app/routers/world.py server/tests/test_dragon.py server/tests/test_rules.py server/tests/test_progression.py server/tests/test_world_rules.py web/e2e/world.spec.ts
git commit -m "Server: the dragon grows from total XP through six stages (egg 0, hatchling 100, young 1200, adult 5000, illustre 15000, ancestral 40000; dragon_stages in data/regles.json, same fallback rules), stored and never lower; neutralisation no longer drives it; GET /api/world serves the stage table, progression.xp its stage and gauge

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- server/app/world/dragon.py server/app/rules.py server/app/world/mastery.py server/app/world/progression.py server/app/routers/world.py server/tests/test_dragon.py server/tests/test_rules.py server/tests/test_progression.py server/tests/test_world_rules.py web/e2e/world.spec.ts
```

(add any other e2e spec Step 10 had to update to both path lists).

---

### Task 2: Client — six stages and their art

**Files:**
- Modify: `web/src/lib/world/types.ts` (`DRAGON_STAGES`), `web/src/lib/world/dragon.ts` (labels, activities), `web/src/lib/world/art.ts` (`ART.dragon`), `web/src/lib/battle/battle.ts` (`FACES.dragon`), `web/src/lib/world/scenes/camp.ts` and `nest.ts` (`WIDTH`, `careLine`), `web/src/lib/dialogue/content.ts` (the `when.stage` guard), `content/dialogue/camp.json`, `content/dialogue/nest.json`, `web/src/lib/world/bestiary.ts` (the dragon's `inGame`), `web/src/components/Dragon.svelte` (comment), `docs/art/style-guide.md` (exports line)
- Move: `assets/art/export/dragon/dragon_adult_cut.webp` → `web/public/art/dragon/dragon_adult_cut.webp` (replacing the old adult), `assets/art/export/dragon/dragon_illustre_cut.webp` → `web/public/art/dragon/`, `assets/art/export/dragon/dragon_ancestral_cut.webp` → `web/public/art/dragon/`
- Test: `web/src/lib/world/dragon.test.ts`, `web/src/lib/world/art.test.ts`, `web/src/lib/battle/battle.test.ts`, `web/src/lib/world/scenes/camp.test.ts`, `web/src/lib/world/scenes/nest.test.ts`, `web/src/lib/dialogue/content.test.ts`, `web/e2e/scenes-nest.spec.ts`, `web/e2e/playability-ui4.spec.ts` (faces walk)

**Interfaces:**
- Consumes: the server's six stage keys (Task 1).
- Produces: `DRAGON_STAGES = ['egg', 'hatchling', 'young', 'adult', 'illustre', 'ancestral'] as const` and `type DragonStage = (typeof DRAGON_STAGES)[number]` (`lib/world/types.ts`); `ART.dragon.illustre`, `ART.dragon.ancestral`; `stageLabel`/`stageActivity` for six stages.

- [ ] **Step 1: Verify the art** — Run: `ls -l assets/art/export/dragon/dragon_adult_cut.webp assets/art/export/dragon/dragon_illustre_cut.webp assets/art/export/dragon/dragon_ancestral_cut.webp`
Expected: three files, each under 150 KB. **If any is missing, stop and report** (do not generate, copy or rename other art). Then open `docs/art/progression-stages.png` (Read tool) and confirm the adult, illustre and ancestral look toward the right edge, as the young dragon does; if one looks left, give it `'left'` in Step 5 and say so in the report.

- [ ] **Step 2: Write the failing tests**

`web/src/lib/world/dragon.test.ts`: in `'labels and lines'` add

```ts
    expect(DRAGON_STAGES.map(stageLabel)).toEqual(['Œuf', 'Dragonnet', 'Jeune dragon', 'Dragon adulte', 'Dragon illustre', 'Dragon ancestral']);
    expect(dragonCaption({ name: null, stage: 'ancestral' })).toBe('Dragon ancestral');
```

and in `'says what it is up to…'` add

```ts
    expect(stageActivity('illustre')).toBe('Il veille sur le camp et raconte ses exploits.');
    expect(stageActivity('ancestral')).toBe('Il lit les vieux parchemins et veille sur toi.');
```

(import `DRAGON_STAGES` from `./types`).

`web/src/lib/world/art.test.ts` (import `DRAGON_STAGES` from `./types`):

```ts
  it('paints the dragon at each of its six stages (spec 2026-09-29 dragon growth §3)', () => {
    expect(Object.keys(ART.dragon)).toEqual([...DRAGON_STAGES]);
    for (const s of DRAGON_STAGES) expect(ART.dragon[s]).toBe(`/art/dragon/dragon_${s}_cut.webp`);
  });
```

`web/src/lib/battle/battle.test.ts`, in `'knows which way each painted cut-out looks…'`:

```ts
    // Checked by eye on web/public/art (UI4 Task 1) and docs/art/progression-stages.png (sub-project 3):
    // the redrawn adult, the illustre and the ancestral keep the young dragon's three-quarter pose.
    expect(FACES.dragon).toEqual({ egg: 'right', hatchling: 'right', young: 'right', adult: 'right', illustre: 'right', ancestral: 'right' });
```

`web/src/lib/world/scenes/camp.test.ts`, in `'seats the dragon in the painted nest…'` (import `DRAGON_STAGES` from `../types`):

```ts
    const widths = DRAGON_STAGES.map((s) => campDragonLayer(s).scale);
    expect(widths.every((w, i) => i === 0 || w > widths[i - 1]), 'bigger at every stage').toBe(true);
```

`web/src/lib/world/scenes/nest.test.ts`: in `'seats the dragon in the straw bed, bigger as it grows'` use `DRAGON_STAGES.map((s) => nestDragonLayer(s).scale)`, the same strictly-rising check, and `expect(widths[5]).toBeLessThanOrEqual(34);`; in the greeting test the egg's care line becomes

```ts
    expect(careLine(egg)).toMatchObject({ speaker: 'dragon', text: 'Je frémis dans la paille. Encore quelques textes défendus, et je sors de ma coquille.' });
```

`web/src/lib/dialogue/content.test.ts` (import `DRAGON_STAGES` from `../world/types`): `const STAGES = DRAGON_STAGES.map((stage) => ({ stage }) as DialogueCtx);`; in the tours test `for (const stage of DRAGON_STAGES) {`; and add

```ts
  it('names only the six dragon stages in a when.stage (a typo would never speak, silently)', () => {
    const file = (stage: string[]) => ({ lines: { 'nest.enter': [{ speaker: 'dragon', when: { stage }, text: 'Un mot.' }] } });
    expect(() => parseDialogueFile('nest.json', file(['illustré']))).toThrow(/when\.stage/);
    expect(() => parseDialogueFile('nest.json', file(['illustre', 'ancestral']))).not.toThrow();
  });
```

- [ ] **Step 3: Run them to see them fail**

Run: `scripts/npm.sh run test -- src/lib/world/dragon.test.ts src/lib/world/art.test.ts src/lib/battle/battle.test.ts src/lib/world/scenes/camp.test.ts src/lib/world/scenes/nest.test.ts src/lib/dialogue/content.test.ts`
Expected: FAIL (`DRAGON_STAGES` not exported; `illustre` has no label, art or lines).

- [ ] **Step 4: The type, the words** — `web/src/lib/world/types.ts`: replace `export type DragonStage = …` with

```ts
/** Spec 2026-09-29 dragon growth §1: the six stages, in order (server/app/world/dragon.py STAGE_ORDER). */
export const DRAGON_STAGES = ['egg', 'hatchling', 'young', 'adult', 'illustre', 'ancestral'] as const;
export type DragonStage = (typeof DRAGON_STAGES)[number];
```

`web/src/lib/world/dragon.ts`:

```ts
const STAGE_LABELS: Record<DragonStage, string> = {
  egg: 'Œuf',
  hatchling: 'Dragonnet',
  young: 'Jeune dragon',
  adult: 'Dragon adulte',
  illustre: 'Dragon illustre',
  ancestral: 'Dragon ancestral',
};
```

```ts
const STAGE_ACTIVITY: Record<DragonStage, string> = {
  egg: 'Il frémit dans sa coquille.',
  hatchling: 'Il est curieux.',
  young: "Il s'entraîne à voler.",
  adult: 'Il monte la garde.',
  illustre: 'Il veille sur le camp et raconte ses exploits.',
  ancestral: 'Il lit les vieux parchemins et veille sur toi.',
};
```

(`stageLine` is rewritten in Task 3; until then its last line covers the two new stages.)

`web/src/lib/world/scenes/nest.ts` `careLine`'s egg line: `"Je frémis dans la paille. Encore quelques textes défendus, et je sors de ma coquille."` (spec 2026-09-29 dragon growth §1: it hatches from XP). `WIDTH`:

```ts
// R11: the nest's dragon spot is x 34-68; the square picture at 28 % keeps its top below the HUD.
const WIDTH: Record<DragonStage, number> = { egg: 10, hatchling: 16, young: 21, adult: 26, illustre: 27, ancestral: 28 };
```

`web/src/lib/world/scenes/camp.ts`: `const WIDTH: Record<DragonStage, number> = { egg: 6, hatchling: 7, young: 8, adult: 9, illustre: 9.5, ancestral: 10 };`

`web/src/lib/world/bestiary.ts`, the dragon's `inGame`: `"Au camp, ton dragon est une créature inventée pour le jeu, cousine lointaine de Ladon\u202f: il grandit avec chaque texte que tu défends, de l'œuf au dragon ancestral."`

`web/src/components/Dragon.svelte`'s comment gains: "Its size comes from the caller; the places size each stage themselves (camp.ts / nest.ts `WIDTH`)."

- [ ] **Step 5: The art** — move the files (they replace/extend the served pictures):

```bash
git mv -f assets/art/export/dragon/dragon_adult_cut.webp web/public/art/dragon/dragon_adult_cut.webp
git mv assets/art/export/dragon/dragon_illustre_cut.webp web/public/art/dragon/dragon_illustre_cut.webp
git mv assets/art/export/dragon/dragon_ancestral_cut.webp web/public/art/dragon/dragon_ancestral_cut.webp
```

`web/src/lib/world/art.ts`:

```ts
  dragon: {
    egg: '/art/dragon/dragon_egg_cut.webp',
    hatchling: '/art/dragon/dragon_hatchling_cut.webp',
    young: '/art/dragon/dragon_young_cut.webp',
    // Sub-project 3: the adult redrawn in the young dragon's three-quarter pose, and the two new stages.
    adult: '/art/dragon/dragon_adult_cut.webp',
    illustre: '/art/dragon/dragon_illustre_cut.webp',
    ancestral: '/art/dragon/dragon_ancestral_cut.webp',
  },
```

`web/src/lib/battle/battle.ts`: `dragon: { egg: 'right', hatchling: 'right', young: 'right', adult: 'right', illustre: 'right', ancestral: 'right' },` and the doc comment's last sentence becomes "The dragon's stages all look right (the adult was redrawn in the young dragon's pose in sub-project 3); the egg is symmetric."

`docs/art/style-guide.md`: the paragraph starting « Exports (staged): `assets/art/export/dragon/dragon_{adult,illustre,ancestral}_cut.webp` » becomes « Exports: `web/public/art/dragon/dragon_{adult,illustre,ancestral}_cut.webp` (moved there when sub-project 3 wired them; 1024 px, q82, 116-136 KB). » with the rest of the paragraph unchanged. If `git status --short docs/art/style-guide.md` already shows it modified (an art agent's work in progress), do not touch it: report the line as an open item.

- [ ] **Step 6: The dialogue** — `web/src/lib/dialogue/content.ts`: import `DRAGON_STAGES` from `'../world/types'`; in `checkLine`'s `when` loop, after the existing `throw`, add

```ts
      if (k === 'stage' && (v as unknown[]).some((s) => !(DRAGON_STAGES as readonly unknown[]).includes(s))) {
        throw new Error(`${where}: bad when.stage ${JSON.stringify(v)}`);
      }
```

`content/dialogue/camp.json`, in `camp.enter` after the three `adult` lines:

```json
      { "speaker": "dragon", "when": { "stage": ["illustre"] }, "text": "{hero} ! Les bergers de la vallée chantent déjà nos exploits. J'ai fait semblant de ne pas écouter." },
      { "speaker": "dragon", "when": { "stage": ["illustre"] }, "text": "Bonjour, {hero}. Mes écailles ont durci comme une armure : même Éris les a vues briller." },
      { "speaker": "dragon", "when": { "stage": ["illustre"] }, "text": "{hero} ! Les Muses ont gravé nos victoires sur une colonne. Il en faudra bientôt une deuxième." },
      { "speaker": "dragon", "when": { "stage": ["ancestral"] }, "text": "Bonjour, {hero}. J'ai relu les vieux parchemins cette nuit. Ils parlent souvent de toi." },
      { "speaker": "dragon", "when": { "stage": ["ancestral"] }, "text": "{hero}. Le feu est doux ce matin. Assieds-toi un moment, puis nous irons où tu voudras." },
      { "speaker": "dragon", "when": { "stage": ["ancestral"] }, "text": "Bonjour, {hero}. J'ai vu passer bien des saisons au camp. Tes visites restent mes préférées." }
```

(mind the comma after the last `adult` line). In the camp `tour`: both `"when": { "stage": ["hatchling", "young", "adult"] }` become `["hatchling", "young", "adult", "illustre", "ancestral"]`, and the egg's nest step becomes

```json
    { "speaker": "dragon", "target": "dragon", "when": { "stage": ["egg"] }, "text": "Mon nid. J'éclorai après tes premiers textes défendus, et tu me donneras un nom." },
```

`content/dialogue/nest.json`: the hatchling line « Ah, c'est toi ! Chaque ruse d'Éris neutralisée me fait grandir. » becomes `"Ah, c'est toi ! Chaque texte bien défendu me fait grandir."`; after the three `adult` lines of `nest.enter`:

```json
      { "speaker": "dragon", "when": { "stage": ["illustre"] }, "text": "Tu as vu mes écailles ? Dures comme du bronze. Les lieutenants d'Éris s'en souviennent." },
      { "speaker": "dragon", "when": { "stage": ["illustre"] }, "text": "Le nid devient petit pour moi. Je le garde quand même : c'est ici que tout a commencé." },
      { "speaker": "dragon", "when": { "stage": ["illustre"] }, "text": "On raconte nos exploits jusqu'à Delphes. La Pythie dit que je rougis. C'est faux." },
      { "speaker": "dragon", "when": { "stage": ["ancestral"] }, "text": "Assieds-toi près de moi. J'ai déroulé un vieux parchemin : il raconte le premier piège d'Éris." },
      { "speaker": "dragon", "when": { "stage": ["ancestral"] }, "text": "Je lis lentement, maintenant. Chaque mot compte, tu le sais aussi bien que moi." },
      { "speaker": "dragon", "when": { "stage": ["ancestral"] }, "text": "Le camp a bien changé depuis mon œuf. Toi et moi, nous avons grandi ensemble." }
```

In the nest `tour`: `["hatchling", "young", "adult"]` becomes `["hatchling", "young", "adult", "illustre", "ancestral"]`, and the closing line becomes

```json
    { "speaker": "dragon", "target": null, "text": "Chaque texte bien défendu me fait grandir : œuf, dragonnet, jeune dragon, dragon adulte, puis illustre, et un jour ancestral." }
```

`grep -rn "neutralis" content/dialogue web/src/lib/world/scenes/nest.ts web/src/lib/world/bestiary.ts` must print only lines unrelated to the dragon's growth (none are expected).

- [ ] **Step 7: Run the unit tests and the check**

Run: `scripts/npm.sh run test -- src/lib/world src/lib/battle src/lib/dialogue src/artReferenced.test.ts src/noEmoji.test.ts src/registerGuard.test.ts src/noGuilt.test.ts src/frenchSpacing.test.ts` ; `scripts/npm.sh run check`
Expected: all pass, `0 errors and 0 warnings`, tsc silent. If `art.test.ts`' 2.5 MB budget fails, stop and report the total (do not raise the budget).

- [ ] **Step 8: The nest e2e per stage** — `web/e2e/scenes-nest.spec.ts`: in `'the dragon opens its care and speaks…'` the care voice becomes `'Je frémis dans la paille. Encore quelques textes défendus, et je sors de ma coquille.'`; add:

```ts
// Spec 2026-09-29 dragon growth §3: each of the six stages in the straw bed, with its name and what it
// is up to; the biggest stays clear of its growth sheet and below the HUD. The stage is set by
// intercepting this hero's /camp (its XP is pinned by the server tests and world.spec).
const STAGES = [
  ['egg', 'Œuf', 'Il frémit dans sa coquille.'],
  ['hatchling', 'Dragonnet', 'Il est curieux.'],
  ['young', 'Jeune dragon', "Il s'entraîne à voler."],
  ['adult', 'Dragon adulte', 'Il monte la garde.'],
  ['illustre', 'Dragon illustre', 'Il veille sur le camp et raconte ses exploits.'],
  ['ancestral', 'Dragon ancestral', 'Il lit les vieux parchemins et veille sur toi.'],
] as const;

test('the nest shows each of the six stages, clear of its growth sheet and of the HUD', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  let stage: string = 'egg';
  await page.route(`**/api/profiles/${id}/camp`, async (route) => {
    const res = await route.fetch();
    const camp = await res.json();
    camp.dragon = { ...camp.dragon, stage, name: stage === 'egg' ? null : 'Braise' };
    await route.fulfill({ response: res, json: camp });
  });
  for (const [key, label, activity] of STAGES) {
    stage = key;
    await page.goto(`/#/p/${id}/dragon?debug`);
    await page.reload();
    await expectScene(page, 'nest');
    await expect(page.getByTestId('nest-dragon-layer').locator('img')).toHaveAttribute('src', `/art/dragon/dragon_${key}_cut.webp`);
    await expect(page.getByTestId('dragon-stage')).toHaveText(label);
    await expect(page.getByTestId('nest-growth')).toContainText(activity);
    const b = await measureBoxes(page, { growth: '[data-testid="nest-growth"]', layer: '[data-testid="nest-dragon-layer"] img', hud: 'header.hud' });
    expect(b.growth!.x + b.growth!.width, `${key}: the growth sheet left of the dragon`).toBeLessThanOrEqual(b.layer!.x + 2);
    expect(b.layer!.y, `${key}: the dragon's picture below the HUD`).toBeGreaterThanOrEqual(b.hud!.y + b.hud!.height - 2);
  }
});
```

If the HUD check fails for `illustre` or `ancestral` on one project, lower that stage's nest `WIDTH` by 1 (keeping the six widths strictly rising and `adult` at 26) and rerun; report the values kept.

`web/e2e/playability-ui4.spec.ts` `facesSection`: add `['illustre', 'hydre', 'c28-faces-illustre-hydre'],` and `['ancestral', 'lethe', 'c29-faces-ancestral-lethe'],` after the adult entry (the review walk, not in the gate).

- [ ] **Step 9: Run the e2e**

Run: `STACK=prog scripts/playwright.sh scenes-nest.spec.ts --repeat-each=3` ; `STACK=prog scripts/playwright.sh scenes-camp.spec.ts scenes-tours.spec.ts scenes-battle.spec.ts`
Expected: all pass on both projects.

- [ ] **Step 10: Commit**

```bash
git add web/src/lib/world/types.ts web/src/lib/world/dragon.ts web/src/lib/world/dragon.test.ts web/src/lib/world/art.ts web/src/lib/world/art.test.ts web/src/lib/battle/battle.ts web/src/lib/battle/battle.test.ts web/src/lib/world/scenes/camp.ts web/src/lib/world/scenes/camp.test.ts web/src/lib/world/scenes/nest.ts web/src/lib/world/scenes/nest.test.ts web/src/lib/dialogue/content.ts web/src/lib/dialogue/content.test.ts content/dialogue/camp.json content/dialogue/nest.json web/src/lib/world/bestiary.ts web/src/components/Dragon.svelte docs/art/style-guide.md web/e2e/scenes-nest.spec.ts web/e2e/playability-ui4.spec.ts web/public/art/dragon/dragon_adult_cut.webp web/public/art/dragon/dragon_illustre_cut.webp web/public/art/dragon/dragon_ancestral_cut.webp
git commit -m "The dragon's six stages on the client: Dragon illustre and Dragon ancestral (labels, activities, painted cut-outs moved in from the art track with the redrawn adult, facing, sizes), three lines each in camp.enter and nest.enter, the words that said neutralisation grows the dragon rewritten, an unknown when.stage refused by the loader

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/lib/world/types.ts web/src/lib/world/dragon.ts web/src/lib/world/dragon.test.ts web/src/lib/world/art.ts web/src/lib/world/art.test.ts web/src/lib/battle/battle.ts web/src/lib/battle/battle.test.ts web/src/lib/world/scenes/camp.ts web/src/lib/world/scenes/camp.test.ts web/src/lib/world/scenes/nest.ts web/src/lib/world/scenes/nest.test.ts web/src/lib/dialogue/content.ts web/src/lib/dialogue/content.test.ts content/dialogue/camp.json content/dialogue/nest.json web/src/lib/world/bestiary.ts web/src/components/Dragon.svelte docs/art/style-guide.md web/e2e/scenes-nest.spec.ts web/e2e/playability-ui4.spec.ts web/public/art/dragon/dragon_adult_cut.webp web/public/art/dragon/dragon_illustre_cut.webp web/public/art/dragon/dragon_ancestral_cut.webp assets/art/export/dragon/dragon_adult_cut.webp assets/art/export/dragon/dragon_illustre_cut.webp assets/art/export/dragon/dragon_ancestral_cut.webp
```

(drop `docs/art/style-guide.md` from both lists if Step 5 left it alone).

---

### Task 3: The camp's gauge is the dragon's

**Files:**
- Modify: `server/app/routers/world.py` (`xp_block`, `dragon_out`, `get_camp`, imports), `server/app/world/mastery.py` (`_thresholds`, `next_stage_at` removed), `web/src/lib/world/types.ts` (`CampResponse.xp`, `DragonOut`), `web/src/lib/world/dragon.ts` (`Scale`, `gaugeOf`, `nextStage`, `stageLine`), `web/src/lib/text/french.ts` (`thousands`), `web/src/lib/scene/hud.ts`, `web/src/components/scene/Hud.svelte`, `web/src/lib/world/scenes/nest.ts` (`growth`), `web/src/screens/Nest.svelte`, `web/src/lib/world/scenes/camp.ts` (`campGreeting`), `web/src/lib/world/eris.ts` (`dragonAside`), `web/src/components/places/war/DossierPanel.svelte`
- Test: `server/tests/test_dragon.py`, `server/tests/test_world_api.py`, `server/tests/test_world_rules.py`, `web/src/lib/world/dragon.test.ts`, `web/src/lib/text/french.test.ts`, `web/src/lib/scene/hud.test.ts`, `web/src/lib/world/scenes/nest.test.ts`, `web/src/lib/world/scenes/camp.test.ts`, `web/src/lib/world/scenes/cabin.test.ts`, `web/src/lib/world/eris.test.ts`, `web/e2e/scenes-camp.spec.ts`, `web/e2e/scenes-nest.spec.ts`, `web/e2e/world.spec.ts` (step 1)

**Interfaces:**
- Consumes: `stage_gauge`, `Rules.dragon_stages` (Task 1); `DRAGON_STAGES`, `stageLabel` (Task 2).
- Produces:
  - `GET /api/profiles/{id}/camp` `xp: {"total": int, "floor": int, "next": int | None}` (from the stored stage); `dragon` without `next_stage_at`.
  - `CampResponse.xp: { total: number; floor: number; next: number | null }`; `DragonOut` without `next_stage_at`.
  - `lib/world/dragon.ts`: `interface Scale { floor: number; next: number | null }`; `gaugeOf(total: number, s: Scale): { value: number; max: number }`; `nextStage(stage: DragonStage): DragonStage`; `stageLine(stage: DragonStage, name: string | null, xp: { total: number } & Scale): string`.
  - `thousands(n: number): string` (`lib/text/french.ts`).
  - `hudXp(xp: CampResponse['xp'], stage: DragonStage): { label: string; value: number; max: number }`.
  - `growth(xp: CampResponse['xp'], stage: DragonStage): { value: number; max: number; label: string; count: string | null }`.
  - `dragonAside(stage: DragonStage): string` (`lib/world/eris.ts`).

- [ ] **Step 1: Write the failing server tests** — `server/tests/test_dragon.py`, add:

```python
def test_the_camp_gauge_follows_the_stored_stage(client, settings):
    # R3: a stage grown before (from neutralisations) reads an empty gauge on its own scale.
    pid = make_profile(client, level="10H")
    client.get(f"/api/profiles/{pid}/camp")
    set_stage(settings, pid, "adult"); give_xp(settings, pid, 300)
    assert client.get(f"/api/profiles/{pid}/camp").json()["xp"] == {"total": 300, "floor": 5000, "next": 15000}
    give_xp(settings, pid, 40000)
    c = client.get(f"/api/profiles/{pid}/camp").json()
    assert c["dragon"]["stage"] == "ancestral" and c["xp"] == {"total": 40300, "floor": 40000, "next": None}
```

`server/tests/test_world_api.py` `test_camp_for_new_profile`: `assert c["xp"] == {"total": 0, "floor": 0, "next": 100}` and add `assert "next_stage_at" not in c["dragon"]`. `server/tests/test_world_rules.py`: drop `next_stage_at` from the import and its line in `test_boss_tiers_and_the_neutralisation_count` (rename it `test_boss_tiers`).

- [ ] **Step 2: Write the failing client tests**

`web/src/lib/text/french.test.ts` (import `thousands`):

```ts
  it('groups thousands with a narrow no-break space (« 15 000 »)', () => {
    expect([0, 999, 1000, 41000, 1234567].map(thousands)).toEqual(['0', '999', '1\u202f000', '41\u202f000', '1\u202f234\u202f567']);
  });
```

`web/src/lib/scene/hud.test.ts` (whole file):

```ts
import { describe, expect, it } from 'vitest';
import { hudXp } from './hud';

// Spec 2026-09-29 dragon growth §2: one gauge, the dragon's, named by its stage.
describe('hudXp', () => {
  it('shows the way to the next stage, named by the stage', () => {
    expect(hudXp({ total: 3100, floor: 1200, next: 5000 }, 'young')).toEqual({ label: 'Jeune dragon · 3\u202f100 XP', value: 1900, max: 3800 });
    expect(hudXp({ total: 0, floor: 0, next: 100 }, 'egg')).toEqual({ label: 'Œuf · 0 XP', value: 0, max: 100 });
  });
  it('is full at the last stage and says « Dragon ancestral »', () => {
    expect(hudXp({ total: 41000, floor: 40000, next: null }, 'ancestral')).toEqual({ label: 'Dragon ancestral · 41\u202f000 XP', value: 1, max: 1 });
  });
  it('reads empty for a stage grown before its XP, full for a stale total past the next stage', () => {
    expect(hudXp({ total: 300, floor: 5000, next: 15000 }, 'adult')).toEqual({ label: 'Dragon adulte · 300 XP', value: 0, max: 10000 });
    expect(hudXp({ total: 1300, floor: 100, next: 1200 }, 'hatchling').value).toBe(1100);
  });
});
```

`web/src/lib/world/dragon.test.ts`: replace the `stageLine` expectations in `'labels and lines'` (the egg line through the `for (const st …)` loop) by

```ts
    const xp = (total: number, floor: number, next: number | null) => ({ total, floor, next });
    // UI3b playability #15: the dragon speaks in the first person under its own plate.
    expect(stageLine('egg', null, xp(40, 0, 100))).toBe("Chaque piège d'Éris déjoué me fait frémir dans ma coquille.");
    expect(stageLine('hatchling', null, xp(150, 100, 1200))).toBe('Au fait, tu me donnes un nom\u202f?');
    // Spec 2026-09-29 dragon growth §3: how far the next stage is, in words; « under 20 % » is strict.
    expect(stageLine('hatchling', 'Braise', xp(150, 100, 1200))).toBe('Chaque texte bien défendu me fait grandir.');
    expect(stageLine('young', 'Braise', xp(4240, 1200, 5000))).toBe('Chaque texte bien défendu me fait grandir.'); // 760 of 3800 left: 20 %
    expect(stageLine('young', 'Braise', xp(4241, 1200, 5000))).toBe('Encore un peu de gloire et je grandis.');
    expect(stageLine('illustre', 'Braise', xp(39000, 15000, 40000))).toBe('Encore un peu de gloire et je grandis.');
    expect(stageLine('adult', 'Braise', xp(300, 5000, 15000))).toBe('Chaque texte bien défendu me fait grandir.'); // grown before its XP
    expect(stageLine('ancestral', 'Braise', xp(41000, 40000, null))).toBe("J'ai tout lu, tout vu. Et je veille toujours sur toi.");
    for (const st of DRAGON_STAGES) {
      expect(stageLine(st, 'Braise', xp(4300, 1200, 5000))).not.toMatch(/\d|Braise|Ton dragon|ruse|neutralis|technique/);
    }
```

and add

```ts
  it('measures the gauge on a stage scale, clamped, full at the top', () => {
    expect(gaugeOf(3100, { floor: 1200, next: 5000 })).toEqual({ value: 1900, max: 3800 });
    expect(gaugeOf(300, { floor: 5000, next: 15000 })).toEqual({ value: 0, max: 10000 });
    expect(gaugeOf(9000, { floor: 100, next: 1200 })).toEqual({ value: 1100, max: 1100 });
    expect(gaugeOf(41000, { floor: 40000, next: null })).toEqual({ value: 1, max: 1 });
    expect(DRAGON_STAGES.map(nextStage)).toEqual(['hatchling', 'young', 'adult', 'illustre', 'ancestral', 'ancestral']);
  });
```

(import `gaugeOf`, `nextStage`).

`web/src/lib/world/scenes/nest.test.ts`: the `egg` fixture loses `next_stage_at: 1`; replace `'measures growth to the next stage in words, with a real plural'` by

```ts
  it('measures growth toward the next stage in XP, and says when it has finished growing (spec 2026-09-29 dragon growth §2)', () => {
    expect(growth({ total: 40, floor: 0, next: 100 }, 'egg')).toEqual({ value: 40, max: 100, label: 'Prochaine étape\u202f: Dragonnet', count: '40 sur 100 XP' });
    expect(growth({ total: 3100, floor: 1200, next: 5000 }, 'young')).toEqual({ value: 1900, max: 3800, label: 'Prochaine étape\u202f: Dragon adulte', count: '1\u202f900 sur 3\u202f800 XP' });
    expect(growth({ total: 300, floor: 5000, next: 15000 }, 'adult')).toMatchObject({ value: 0, count: '0 sur 10\u202f000 XP' });
    expect(growth({ total: 41000, floor: 40000, next: null }, 'ancestral')).toEqual({ value: 1, max: 1, label: 'Il a fini de grandir.', count: null });
  });
```

`web/src/lib/world/scenes/camp.test.ts`: the fixture's `xp: { total: 0, floor: 0, next: 100 }`, its dragon without `next_stage_at`, `const seasoned = { total: 40, floor: 0, next: 100 };`. `web/src/lib/world/scenes/cabin.test.ts`: the `dragon` fixture without `next_stage_at: 4`.

`web/src/lib/world/eris.test.ts` (import `dragonAside`):

```ts
  it("keeps the hero's dragon to one dry aside, never a rank (spec 2026-09-29 dragon growth §2)", () => {
    expect(dragonAside('egg')).toBe("Ton dragon dort encore dans sa coquille. Qu'il y reste.");
    expect(dragonAside('illustre')).toBe("Ton dragon a grandi\u202f: dragon illustre. Je fais semblant de ne pas l'avoir vu.");
    for (const s of DRAGON_STAGES) expect(dragonAside(s)).not.toMatch(/rang/);
  });
```

(import `DRAGON_STAGES` from `./types`, alongside `LIEUTENANT_ORDER`).

- [ ] **Step 3: Run them to see them fail**

Run: `scripts/pytest.sh -q tests/test_dragon.py tests/test_world_api.py tests/test_world_rules.py` ; `scripts/npm.sh run test -- src/lib/text/french.test.ts src/lib/scene/hud.test.ts src/lib/world/dragon.test.ts src/lib/world/scenes/nest.test.ts src/lib/world/eris.test.ts`
Expected: FAIL (the camp's xp still carries ranks; `thousands`, `gaugeOf`, `dragonAside` undefined).

- [ ] **Step 4: The server's gauge** — `server/app/routers/world.py`:
  - imports: `from app.world.dragon import grown_stage, stage_gauge, stage_table`; `from app.world.mastery import lieutenants_for_level, mastery_window, tier_available`;
  - `dragon_out`'s return drops `"next_stage_at": …` (`"neutralised"` and `"available"` stay: the camp's « tricks before Éris » count reads them);
  - `xp_block`:

```python
def xp_block(conn: sqlite3.Connection, pid: int, stage: str, rules: Rules) -> dict:
    """The HUD's gauge (spec 2026-09-29 dragon growth §2): the total XP, the dragon's stage's floor and
    the next stage's threshold (None at the top). From the stored stage (R3), so a stage grown before
    its XP reads an empty gauge, never a negative one."""
    floor, nxt = stage_gauge(stage, rules.dragon_stages)
    return {"total": xp_total(conn, pid), "floor": floor, "next": nxt}
```

  - `get_camp`: `rules = request.app.state.rules`, `dragon = dragon_out(db, profile, now, rules)` and `"xp": xp_block(db, pid, dragon["stage"], rules),`.
  - `server/app/world/mastery.py`: delete `_thresholds` and `next_stage_at`; docstring `"""Mastery (neutralisation) rule and boss tiers (spec §3.6; plan Decisions 3, 8, 11)."""`.

- [ ] **Step 5: The client's gauge** — `web/src/lib/text/french.ts`:

```ts
/** A count with its thousands grouped by a narrow no-break space, as French typography wants (« 15 000 »). */
export function thousands(n: number): string {
  return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
}
```

`web/src/lib/world/types.ts`: in `DragonOut` delete `next_stage_at: number | null;`; in `CampResponse`:

```ts
  /** Spec 2026-09-29 dragon growth §2: the dragon's gauge, the HUD's laurel: the total XP, the stored
   *  stage's threshold and the next stage's (null at the last stage). */
  xp: { total: number; floor: number; next: number | null };
```

`web/src/lib/world/dragon.ts`: `import { DRAGON_STAGES, type DragonOut, type DragonStage, type Tint } from './types';` (drop the `plural` import if nothing else uses it), and replace `stageLine` by:

```ts
/** A stage's scale: its own threshold and the next stage's (null at the last stage). */
export interface Scale {
  floor: number;
  next: number | null;
}

/** The gauge on a stage's scale (spec 2026-09-29 dragon growth §2, R3): a total below the floor (a stage
 *  grown before its XP) reads empty, one past the next threshold (a stale answer) full; the last stage
 *  is always full. */
export function gaugeOf(total: number, s: Scale): { value: number; max: number } {
  if (s.next === null) return { value: 1, max: 1 };
  const max = Math.max(1, s.next - s.floor);
  return { value: Math.min(max, Math.max(0, total - s.floor)), max };
}

/** The stage after this one (the last stage is its own). */
export function nextStage(stage: DragonStage): DragonStage {
  const i = DRAGON_STAGES.indexOf(stage);
  return DRAGON_STAGES[Math.min(DRAGON_STAGES.length - 1, i + 1)];
}

/** What the dragon says of itself at its stage, in its own voice (UI3b playability #15: its plate
 *  names it, so it speaks in the first person; the egg speaks from inside its shell). The camp's
 *  greeting. `name` is null until it is named (a hatchling then asks for one). Spec 2026-09-29 dragon
 *  growth §3: once hatched and named, how far the next stage is, in words (never a number: the HUD
 *  carries them); « under 20 % » is strictly under a fifth of the stage's span. */
export function stageLine(stage: DragonStage, name: string | null, xp: { total: number } & Scale): string {
  // UI5 playability #12: it follows `camp.enter`, which has already said hello.
  if (stage === 'egg') return "Chaque piège d'Éris déjoué me fait frémir dans ma coquille.";
  if (stage === 'hatchling' && !name) return 'Au fait, tu me donnes un nom\u202f?';
  if (stage === 'ancestral' || xp.next === null) return "J'ai tout lu, tout vu. Et je veille toujours sur toi.";
  // Whole numbers only (no 0.2 × span float at the boundary): under a fifth of the span remains.
  return 5 * (xp.next - xp.total) < xp.next - xp.floor ? 'Encore un peu de gloire et je grandis.' : 'Chaque texte bien défendu me fait grandir.';
}
```

`web/src/lib/scene/hud.ts` (whole file):

```ts
// HUD XP laurel data (scenes UI spec §4 "Hud (slim: hero, XP laurel, ...)"). Spec 2026-09-29 dragon
// growth §2: one gauge, the dragon's: the way to its next stage, named by its stage.
import { gaugeOf, stageLabel } from '../world/dragon';
import { thousands } from '../text/french';
import type { CampResponse, DragonStage } from '../world/types';

export function hudXp(xp: CampResponse['xp'], stage: DragonStage): { label: string; value: number; max: number } {
  return { label: `${stageLabel(stage)} · ${thousands(xp.total)} XP`, ...gaugeOf(xp.total, xp) };
}
```

`web/src/components/scene/Hud.svelte`: `const xp = $derived(camp ? hudXp(camp.xp, camp.dragon.stage) : null);`

`web/src/lib/world/scenes/nest.ts`: imports `import { dragonCaption, gaugeOf, nextStage, stageLabel } from '../dragon';`, `import { thousands } from '../../text/french';`, `import type { CampResponse, DragonOut, DragonStage } from '../types';` (drop `plural` if unused); `growth`:

```ts
/** The growth sheet (was DragonScreen's; spec 2026-09-29 dragon growth §2): the next stage and the XP
 *  toward it on the dragon's scale (R10); at the last stage « Il a fini de grandir. » and no count. */
export function growth(xp: CampResponse['xp'], stage: DragonStage): { value: number; max: number; label: string; count: string | null } {
  const g = gaugeOf(xp.total, xp);
  if (xp.next === null) return { ...g, label: 'Il a fini de grandir.', count: null };
  return { ...g, label: `Prochaine étape\u202f: ${stageLabel(nextStage(stage))}`, count: `${thousands(g.value)} sur ${thousands(g.max)} XP` };
}
```

`web/src/screens/Nest.svelte`: `{@const g = growth(ctx.camp.xp, d.stage)}` and the count span becomes `{#if g.count}<span class="growth-count">{g.count}</span>{/if}`.

`web/src/lib/world/scenes/camp.ts` `campGreeting`: `dragonSays(d, stageLine(d.stage, d.name, camp.xp)),`.

`web/src/lib/world/eris.ts` (import `stageLabel` from `./dragon` and `type DragonStage` from `./types`):

```ts
/** What Éris would rather not say about the hero's dragon (the dossier's « Ce qu'elle préfère taire »).
 *  Spec 2026-09-29 dragon growth §2: the rank titles are gone; the dragon's stage says how far the
 *  hero has come. */
export function dragonAside(stage: DragonStage): string {
  if (stage === 'egg') return "Ton dragon dort encore dans sa coquille. Qu'il y reste.";
  return `Ton dragon a grandi\u202f: ${stageLabel(stage).toLowerCase()}. Je fais semblant de ne pas l'avoir vu.`;
}
```

`web/src/components/places/war/DossierPanel.svelte`: add `dragonAside` to the `eris` import and replace `<p>Ton rang{'\u202f: '}{camp.xp.title}. Je fais semblant de ne pas l'avoir vu.</p>` by `<p>{dragonAside(camp.dragon.stage)}</p>`.

- [ ] **Step 6: Run the unit tests and the check**

Run: `scripts/pytest.sh -q tests/test_dragon.py tests/test_world_api.py tests/test_world_rules.py` ; `scripts/npm.sh run test` ; `scripts/npm.sh run check`
Expected: all pass, `0 errors and 0 warnings`, tsc silent.

- [ ] **Step 7: The e2e** — `web/e2e/world.spec.ts` step 1 and `web/e2e/scenes-camp.spec.ts` (the HUD test, ~l. 266): `toContainText('Recrue du camp')` becomes `toContainText('Œuf · 0 XP')`. `web/e2e/scenes-nest.spec.ts`, the first test: `toContainText("Pour grandir\u202f: 1 ruse d'Éris neutralisée")` becomes `toContainText('Prochaine étape\u202f: Dragonnet')` followed by `await expect(page.getByTestId('nest-growth')).toContainText('0 sur 100 XP');`. Add to `scenes-camp.spec.ts`:

```ts
// Spec 2026-09-29 dragon growth §2: one gauge, the dragon's: named by its stage, full at the last one,
// empty for a stage grown before its XP (R3). This hero's /camp answer carries the stage and XP.
test("HUD: the laurel is the dragon's growth, named by its stage, full at the last stage", async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  let fake: { stage: string; xp: { total: number; floor: number; next: number | null } } = { stage: 'young', xp: { total: 3100, floor: 1200, next: 5000 } };
  await page.route(`**/api/profiles/${id}/camp`, async (route) => {
    const res = await route.fetch();
    const camp = await res.json();
    camp.dragon = { ...camp.dragon, stage: fake.stage, name: 'Braise' };
    camp.xp = fake.xp;
    await route.fulfill({ response: res, json: camp });
  });
  await openCamp(page, id);
  const laurel = page.getByTestId('hud-xp');
  await expect(laurel).toContainText('Jeune dragon · 3\u202f100 XP');
  await expect(laurel).toHaveAttribute('aria-valuenow', '1900');
  await expect(laurel).toHaveAttribute('aria-valuemax', '3800');
  await expect(laurel.locator('.leaf.lit')).toHaveCount(5);

  fake = { stage: 'ancestral', xp: { total: 41000, floor: 40000, next: null } };
  await page.reload();
  await expectCamp(page);
  await expect(laurel).toContainText('Dragon ancestral · 41\u202f000 XP');
  await expect(laurel.locator('.leaf.lit')).toHaveCount(10);
  await expect(page.getByTestId('hud-dragon').locator('img')).toHaveAttribute('src', '/art/dragon/dragon_ancestral_cut.webp');

  fake = { stage: 'adult', xp: { total: 300, floor: 5000, next: 15000 } };
  await page.reload();
  await expectCamp(page);
  await expect(laurel).toContainText('Dragon adulte · 300 XP');
  await expect(laurel).toHaveAttribute('aria-valuenow', '0');
  await expect(laurel.locator('.leaf.lit')).toHaveCount(0);
});
```

and to `scenes-nest.spec.ts`:

```ts
test('the growth sheet: the next stage and the XP toward it; « Il a fini de grandir. » at the top', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  let fake: { stage: string; xp: { total: number; floor: number; next: number | null } } = { stage: 'young', xp: { total: 3100, floor: 1200, next: 5000 } };
  await page.route(`**/api/profiles/${id}/camp`, async (route) => {
    const res = await route.fetch();
    const camp = await res.json();
    camp.dragon = { ...camp.dragon, stage: fake.stage, name: 'Braise' };
    camp.xp = fake.xp;
    await route.fulfill({ response: res, json: camp });
  });
  await page.goto(`/#/p/${id}/dragon?debug`);
  await expectScene(page, 'nest');
  const sheet = page.getByTestId('nest-growth');
  await expect(sheet).toContainText('Prochaine étape\u202f: Dragon adulte');
  await expect(sheet).toContainText('1\u202f900 sur 3\u202f800 XP');
  fake = { stage: 'ancestral', xp: { total: 41000, floor: 40000, next: null } };
  await page.reload();
  await expectScene(page, 'nest');
  await expect(sheet).toContainText('Il a fini de grandir.');
  await expect(sheet.locator('.growth-count')).toHaveCount(0);
  await expect(sheet.locator('[role="progressbar"]')).toHaveAttribute('data-state', 'ok');
});
```

- [ ] **Step 8: Run the e2e**

Run: `STACK=prog scripts/playwright.sh scenes-camp.spec.ts scenes-nest.spec.ts --repeat-each=3` ; `STACK=prog scripts/playwright.sh world.spec.ts scenes-war.spec.ts`
Expected: all pass on both projects.

- [ ] **Step 9: Commit**

```bash
git add server/app/routers/world.py server/app/world/mastery.py server/tests/test_dragon.py server/tests/test_world_api.py server/tests/test_world_rules.py web/src/lib/world/types.ts web/src/lib/world/dragon.ts web/src/lib/world/dragon.test.ts web/src/lib/text/french.ts web/src/lib/text/french.test.ts web/src/lib/scene/hud.ts web/src/lib/scene/hud.test.ts web/src/components/scene/Hud.svelte web/src/lib/world/scenes/nest.ts web/src/lib/world/scenes/nest.test.ts web/src/screens/Nest.svelte web/src/lib/world/scenes/camp.ts web/src/lib/world/scenes/camp.test.ts web/src/lib/world/scenes/cabin.test.ts web/src/lib/world/eris.ts web/src/lib/world/eris.test.ts web/src/components/places/war/DossierPanel.svelte web/e2e/scenes-camp.spec.ts web/e2e/scenes-nest.spec.ts web/e2e/world.spec.ts
git commit -m "The camp's gauge is the dragon's: the HUD laurel shows the way to the next stage, named by the stage (full at Dragon ancestral), the nest's sheet names the next stage and its XP, the dragon says how far it is in words, Éris's aside speaks of the dragon instead of a rank

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- server/app/routers/world.py server/app/world/mastery.py server/tests/test_dragon.py server/tests/test_world_api.py server/tests/test_world_rules.py web/src/lib/world/types.ts web/src/lib/world/dragon.ts web/src/lib/world/dragon.test.ts web/src/lib/text/french.ts web/src/lib/text/french.test.ts web/src/lib/scene/hud.ts web/src/lib/scene/hud.test.ts web/src/components/scene/Hud.svelte web/src/lib/world/scenes/nest.ts web/src/lib/world/scenes/nest.test.ts web/src/screens/Nest.svelte web/src/lib/world/scenes/camp.ts web/src/lib/world/scenes/camp.test.ts web/src/lib/world/scenes/cabin.test.ts web/src/lib/world/eris.ts web/src/lib/world/eris.test.ts web/src/components/places/war/DossierPanel.svelte web/e2e/scenes-camp.spec.ts web/e2e/scenes-nest.spec.ts web/e2e/world.spec.ts
```

---

### Task 4: The victory's stage-up; the ranks go

**Files:**
- Modify: `server/app/world/catalog.py` (`RANKS`, docstring), `server/app/world/xp.py` (`rank_for`), `server/app/world/progression.py` (rank fields), `server/app/routers/world.py` (`ranks`, imports), `web/src/lib/world/types.ts` (`WorldCatalog.stages`, `Progression.xp`), `web/src/lib/world/dragon.ts` (`DEFAULT_STAGE_XP`, `stageXp`, `scaleOf`, `victoryGauge`), `web/src/components/battle/VictorySpoils.svelte`, `web/src/lib/battle/lines.ts`, `web/src/components/ui/LaurelBar.svelte`, `web/src/lib/ui/laurel.ts`, `web/src/components/juice/Gauge.svelte` (comments)
- Test: `server/tests/test_progression.py`, `server/tests/test_world_rules.py`, `server/tests/test_world_api.py`, `web/src/lib/world/dragon.test.ts`, `web/src/lib/battle/lines.test.ts`, `web/src/lib/ui/laurel.test.ts`, `web/e2e/scenes-battle-victory.spec.ts`

**Interfaces:**
- Consumes: `progression.xp.stage_before/stage_after/floor/next` (Task 1); `/api/world` `stages` (Task 1); `Scale`, `gaugeOf`, `stageLabel` (Tasks 2-3).
- Produces:
  - `progression.xp` = `{session, parts, bonuses, total_before, total_after, stage_before, stage_after, floor, next}` exactly; `/api/world` without `ranks`; `RANKS` and `rank_for` gone.
  - `WorldCatalog.stages: { key: DragonStage; name: string; xp: number }[]` (no `ranks`); `Progression.xp.stage_before?`, `stage_after?: DragonStage`, `floor?: number`, `next?: number | null` (optional: absent from a victory saved before the change).
  - `lib/world/dragon.ts`: `DEFAULT_STAGE_XP: Record<DragonStage, number>`; `stageXp(catalog: { stages?: { key: string; xp: number }[] } | null | undefined): Record<DragonStage, number>`; `scaleOf(stage: DragonStage, xpOf: Record<DragonStage, number>): Scale`; `interface VictoryGauge { grew: boolean; before: { label: string; max: number; from: number }; after: { label: string; max: number; from: number; to: number } }`; `victoryGauge(p: { xp: Progression['xp']; dragon: Progression['dragon'] }, xpOf: Record<DragonStage, number>): VictoryGauge`.
  - `VICTORY.stageUp = 'Ton dragon grandit\u202f!'` (`VICTORY.rankFresh` removed).

- [ ] **Step 1: Write the failing server tests** — `server/tests/test_progression.py`: rename `test_session_grants_xp_and_reports_rank` to `test_session_grants_xp_and_reports_the_dragons_gauge`, delete its `rank_before`/`title_after` line and add

```python
    # Spec 2026-09-29 dragon growth §2: the ranks merged into the stages; no rank field is left.
    assert set(p["xp"]) == {"session", "parts", "bonuses", "total_before", "total_after", "stage_before", "stage_after", "floor", "next"}
```

`server/tests/test_world_api.py` `test_world_catalog`: `len(w["ranks"]) == 10` becomes `[s["key"] for s in w["stages"]] == ["egg", "hatchling", "young", "adult", "illustre", "ancestral"]` and add `assert "ranks" not in w`. `server/tests/test_world_rules.py`: delete `test_rank_for` and `rank_for` from the `app.world.xp` import.

- [ ] **Step 2: Write the failing client tests** — `web/src/lib/world/dragon.test.ts` (import `DEFAULT_STAGE_XP`, `scaleOf`, `stageXp`, `victoryGauge`, and `type Progression` from `./types`):

```ts
describe('the victory gauge (spec 2026-09-29 dragon growth §2)', () => {
  const T = DEFAULT_STAGE_XP;
  const p = (xp: Partial<Progression['xp']>, dragon: Progression['dragon']) => ({
    xp: { session: 51, bonuses: [], total_before: 0, total_after: 0, ...xp },
    dragon,
  });
  const stay = (s: Progression['dragon']['stage_after']) => ({ stage_before: s, stage_after: s, needs_name: false });

  it('reads the stage table from the catalogue, the defaults until it has come', () => {
    expect(DEFAULT_STAGE_XP).toEqual({ egg: 0, hatchling: 100, young: 1200, adult: 5000, illustre: 15000, ancestral: 40000 });
    expect(stageXp(null)).toEqual(T);
    expect(stageXp({ stages: [{ key: 'hatchling', xp: 50 }, { key: 'dragon', xp: 7 }] })).toEqual({ ...T, hatchling: 50 });
    expect(scaleOf('young', T)).toEqual({ floor: 1200, next: 5000 });
    expect(scaleOf('ancestral', T)).toEqual({ floor: 40000, next: null });
  });

  it('stays on one scale when the dragon does not grow', () => {
    const g = victoryGauge(p({ total_before: 487, total_after: 538, stage_before: 'hatchling', stage_after: 'hatchling', floor: 100, next: 1200 }, stay('hatchling')), T);
    expect(g).toEqual({ grew: false, before: { label: 'Dragonnet', max: 1100, from: 387 }, after: { label: 'Dragonnet', max: 1100, from: 387, to: 438 } });
  });

  it('fills the old stage, then switches to the new one', () => {
    const g = victoryGauge(p({ total_before: 1100, total_after: 1211, stage_before: 'hatchling', stage_after: 'young', floor: 1200, next: 5000 }, { stage_before: 'hatchling', stage_after: 'young', needs_name: false }), T);
    expect(g).toEqual({ grew: true, before: { label: 'Dragonnet', max: 1100, from: 1000 }, after: { label: 'Jeune dragon', max: 3800, from: 0, to: 11 } });
  });

  it('skips a middle stage when it crosses two at once', () => {
    const g = victoryGauge(p({ total_before: 60, total_after: 1250, stage_before: 'egg', stage_after: 'young', floor: 1200, next: 5000 }, { stage_before: 'egg', stage_after: 'young', needs_name: true }), T);
    expect(g).toEqual({ grew: true, before: { label: 'Œuf', max: 100, from: 60 }, after: { label: 'Jeune dragon', max: 3800, from: 0, to: 50 } });
  });

  it('is full at the top, never dividing by zero', () => {
    const g = victoryGauge(p({ total_before: 39950, total_after: 40100, stage_before: 'illustre', stage_after: 'ancestral', floor: 40000, next: null }, { stage_before: 'illustre', stage_after: 'ancestral', needs_name: false }), T);
    expect(g).toEqual({ grew: true, before: { label: 'Dragon illustre', max: 25000, from: 24950 }, after: { label: 'Dragon ancestral', max: 1, from: 1, to: 1 } });
  });

  it('reads empty for a stage grown before its XP', () => {
    const g = victoryGauge(p({ total_before: 300, total_after: 354, stage_before: 'adult', stage_after: 'adult', floor: 5000, next: 15000 }, stay('adult')), T);
    expect(g.after).toEqual({ label: 'Dragon adulte', max: 10000, from: 0, to: 0 });
  });

  it('resumes a victory saved before the stages on the dragon\'s scale', () => {
    // A play state saved before the change: rank fields, no stage fields (R7).
    const legacy = { xp: { session: 51, bonuses: [], total_before: 60, total_after: 160, rank_before: 1, rank_after: 2, title_after: 'Scribe des Muses' }, dragon: { stage_before: 'egg' as const, stage_after: 'hatchling' as const, needs_name: true } };
    expect(victoryGauge(legacy, T)).toEqual({ grew: true, before: { label: 'Œuf', max: 100, from: 60 }, after: { label: 'Dragonnet', max: 1100, from: 0, to: 60 } });
    expect(victoryGauge(legacy, stageXp({ stages: [{ key: 'hatchling', xp: 50 }] })).after).toEqual({ label: 'Dragonnet', max: 1150, from: 10, to: 110 });
  });
});
```

`web/src/lib/battle/lines.test.ts`, in the victory copy test: `expect(L.VICTORY.stageUp).toBe('Ton dragon grandit\u202f!');`. `web/src/lib/ui/laurel.test.ts`: the titles say « next stage » instead of « next rank » (`'lights one leaf per tenth of the way to the next stage, rounding down'`, `'shows a full laurel when there is no next stage (max <= 0)'`).

- [ ] **Step 3: Run them to see them fail**

Run: `scripts/pytest.sh -q tests/test_progression.py tests/test_world_api.py tests/test_world_rules.py` ; `scripts/npm.sh run test -- src/lib/world/dragon.test.ts src/lib/battle/lines.test.ts`
Expected: FAIL (rank fields still served; `victoryGauge`, `VICTORY.stageUp` undefined).

- [ ] **Step 4: The ranks go on the server** — `server/app/world/catalog.py`: delete `RANKS`; docstring `"""World catalog: lieutenants, rewards (plan Decisions 1, 6, 12, 20; the dragon's stages, which replaced the XP ranks, live in app.world.dragon). French labels are UI text served by GET /api/world."""`. `server/app/world/xp.py`: delete `rank_for` and `from app.world.catalog import RANKS`. `server/app/world/progression.py`: `from app.world.xp import session_xp`; delete `rank_before = …` and `rank_after, title_after, _, _ = …`; the returned `xp` block:

```python
    return {"xp": {"session": xp.total, "parts": xp.parts, "bonuses": bonuses, "total_before": total_before, "total_after": total_after,
                   "stage_before": stage_before, "stage_after": stage_after, "floor": floor, "next": nxt},
```

`server/app/routers/world.py`: drop `RANKS` from the catalog import, delete `"ranks": …` from `get_world`.

- [ ] **Step 5: The client's stage table and victory gauge** — `web/src/lib/world/types.ts`: in `WorldCatalog` replace `ranks: …` by

```ts
  /** Spec 2026-09-29 dragon growth §2: the dragon's stages, their names and XP (from data/regles.json). */
  stages: { key: DragonStage; name: string; xp: number }[];
```

and in `Progression.xp` replace `rank_before`, `rank_after`, `title_after` by

```ts
    /** Spec 2026-09-29 dragon growth §2: the dragon's stages around this victory and the new stage's
     *  gauge (floor, next; next null at the last stage). Absent from a victory saved before the change. */
    stage_before?: DragonStage;
    stage_after?: DragonStage;
    floor?: number;
    next?: number | null;
```

`web/src/lib/world/dragon.ts` (import `type Progression` from `./types`):

```ts
/** Spec 2026-09-29 dragon growth §1: the built-in thresholds (server/app/world/dragon.py
 *  DEFAULT_STAGE_XP), until the catalogue's table has come. */
export const DEFAULT_STAGE_XP: Record<DragonStage, number> = { egg: 0, hatchling: 100, young: 1200, adult: 5000, illustre: 15000, ancestral: 40000 };

/** Each stage's XP from the catalogue's table (the rules file's), the defaults for any it lacks. */
export function stageXp(catalog: { stages?: { key: string; xp: number }[] } | null | undefined): Record<DragonStage, number> {
  const out = { ...DEFAULT_STAGE_XP };
  for (const s of catalog?.stages ?? []) if ((DRAGON_STAGES as readonly string[]).includes(s.key)) out[s.key as DragonStage] = s.xp;
  return out;
}

export function scaleOf(stage: DragonStage, xpOf: Record<DragonStage, number>): Scale {
  const i = Math.max(0, DRAGON_STAGES.indexOf(stage));
  return { floor: xpOf[DRAGON_STAGES[i]], next: i + 1 < DRAGON_STAGES.length ? xpOf[DRAGON_STAGES[i + 1]] : null };
}

/** The victory's laurel (spec §2, the P1-2 two-part logic keyed on the stage): `before` is the old
 *  stage's scale, which fills to its max when the dragon grows; `after` the new stage's, from the
 *  total before (no growth) or 0, to the total after. The new scale is the server's when the victory
 *  carries it, else the table's (a victory saved before the change, R7). */
export interface VictoryGauge {
  grew: boolean;
  before: { label: string; max: number; from: number };
  after: { label: string; max: number; from: number; to: number };
}

export function victoryGauge(p: { xp: Progression['xp']; dragon: Progression['dragon'] }, xpOf: Record<DragonStage, number>): VictoryGauge {
  const before = p.xp.stage_before ?? p.dragon.stage_before;
  const after = p.xp.stage_after ?? p.dragon.stage_after;
  const beforeScale = scaleOf(before, xpOf);
  const afterScale = p.xp.floor !== undefined && p.xp.next !== undefined ? { floor: p.xp.floor, next: p.xp.next } : scaleOf(after, xpOf);
  const b = gaugeOf(p.xp.total_before, beforeScale);
  const a0 = gaugeOf(p.xp.total_before, afterScale);
  const a1 = gaugeOf(p.xp.total_after, afterScale);
  return {
    grew: before !== after,
    before: { label: stageLabel(before), max: b.max, from: b.value },
    after: { label: stageLabel(after), max: a1.max, from: a0.value, to: a1.value },
  };
}
```

`web/src/lib/battle/lines.ts`: replace `rankFresh` and its comment by

```ts
  /** Spec 2026-09-29 dragon growth §2: under the laurel once it has switched to the new stage. */
  stageUp: 'Ton dragon grandit\u202f!',
```

- [ ] **Step 6: `VictorySpoils.svelte`**
  - imports: `import { stageLabel, stageXp, validName, victoryGauge } from '../../lib/world/dragon';`
  - replace the block from `// XP card ---` up to (not including) `const bonusChips` by:

```ts
  // XP card ------------------------------------------------------------------------------------
  // Spec 2026-09-29 dragon growth §2: one gauge, the dragon's. A stage change fills the OLD stage's
  // scale to its max first, then switches the gauge to the NEW stage's floor/next (the P1-2 two-part
  // logic, keyed on the stage): otherwise the laurel would read full and past its own max at the
  // moment the dragon grows. Derived from the catalogue's stage table, so a still-loading catalogue
  // (`loadCatalog()` above) updates it.
  const gauge = $derived(victoryGauge(progression, stageXp(campStore.catalog)));

  // Reduced motion (UI4 global constraints): the laurel jumps straight to its final value, on the new
  // stage's scale.
  const quick = reducedMotion();
  // Which scale the gauge shows: the old one until the switch fires (below); the new one at once when
  // the dragon does not grow.
  let gaugePhase = $state<'before' | 'after'>(quick ? 'after' : 'before');
  const shown = $derived(!gauge.grew || gaugePhase === 'after' ? gauge.after : gauge.before);

  // Keeps following the catalogue until the delayed "to" step below takes over.
  let xpValue = $state(0);
  let xpAnimated = false;
  $effect(() => {
    if (!xpAnimated) xpValue = quick ? gauge.after.to : gauge.grew ? gauge.before.from : gauge.after.from;
  });
```

  - in the sound-and-particles `$effect`, replace the XP gauge part (from `// The XP gauge itself animates shortly after mount…` to the end of its `if (quick) { … } else { … }`) by:

```ts
    // The XP gauge animates shortly after mount. A stage change fills the OLD scale to its max first,
    // then (after the burst) switches to the NEW stage's scale and animates to `total_after` on it.
    // Reduced motion: the value is already final (above); only the chime plays.
    if (quick) {
      if (untrack(() => gauge.grew)) playSfx('chime');
    } else {
      timers.push(
        setTimeout(() => {
          xpAnimated = true;
          if (gauge.grew) {
            xpValue = gauge.before.max;
            playSfx('chime');
            xpBurstTrigger += 1;
            timers.push(
              setTimeout(() => {
                gaugePhase = 'after';
                xpValue = gauge.after.to;
              }, 400),
            );
          } else {
            xpValue = gauge.after.to;
          }
        }, 150),
      );
    }
```

  - the laurel's markup:

```svelte
        <LaurelBar
          value={xpValue}
          max={shown.max}
          label={shown.label}
          testId="victory-xp"
          surface="parchment"
          note={gauge.grew && gaugePhase === 'after' ? VICTORY.stageUp : undefined}
        />
        {#if gauge.grew}<Particles trigger={xpBurstTrigger} kind="burst" />{/if}
```

  - delete the `{#if rankedUp}<p class="kit-ribbon rank-up">Nouveau rang…</p>{/if}` block and the `.rank-up` CSS rule; the header comment's "XP rising on the laurel" becomes "XP rising on the dragon's laurel".
  - comments: `LaurelBar.svelte` "toward the next rank" → "toward the dragon's next stage", its `note` line "(after a stage change: « Ton dragon grandit ! »)"; `web/src/lib/ui/laurel.ts` "toward the next rank … when the rank is actually reached" → "toward the dragon's next stage … when the stage is actually reached"; `Gauge.svelte` "XP toward the next rank" → "XP toward the dragon's next stage".

- [ ] **Step 7: The victory e2e** — `web/e2e/scenes-battle-victory.spec.ts`:
  - `progression()`'s default `xp`: `{ session: 51, bonuses: [], total_before: 487, total_after: 538, stage_before: 'hatchling', stage_after: 'hatchling', floor: 100, next: 1200 }` and default `dragon: { stage_before: 'hatchling', stage_after: 'hatchling', needs_name: false }`; its comment's last words « a hatch, a rank-up » become « a hatch, a stage change »;
  - every other `xp` literal in the file that carries `rank_before`/`rank_after`/`title_after` (Éris's defeat, the XP chips' tests from sub-project 1) replaces those three fields by `stage_before: 'hatchling', stage_after: 'hatchling', floor: 100, next: 1200`;
  - in the beating-Éris test delete `await expect(sheet.getByTestId('victory-xp')).toContainText('Les feuilles repoussent');` and the comment half « the new rank's leaves grow back »;
  - add:

```ts
// Spec 2026-09-29 dragon growth §2: the old stage fills, then the new one shows, « Ton dragon grandit ! ».
test('the dragon grows on the victory: the laurel ends on the new stage, « Ton dragon grandit ! »', async ({ page, request }, testInfo) => {
  const sheet = await counted(
    page,
    request,
    `Vic23-${testInfo.project.name}`,
    progression({
      xp: { session: 51, bonuses: [{ reason: 'board', amount: 60 }], total_before: 1100, total_after: 1211, stage_before: 'hatchling', stage_after: 'young', floor: 1200, next: 5000 },
      dragon: { stage_before: 'hatchling', stage_after: 'young', needs_name: false },
    }),
  );
  const laurel = sheet.getByTestId('victory-xp');
  await expect(laurel).toHaveAttribute('aria-label', 'Jeune dragon');
  await expect(laurel).toHaveAttribute('aria-valuenow', '11');
  await expect(laurel).toHaveAttribute('aria-valuemax', '3800');
  await expect(laurel).toContainText('Ton dragon grandit\u202f!');
  await expect(sheet.getByTestId('reveal-xp-gain')).toHaveText('+111 XP');
  await expect(sheet.getByTestId('reveal-dragon')).toContainText('grandit\u202f: Jeune dragon');
  await expect(sheet).not.toContainText('Nouveau rang');
});

// Review focus 5: a play state saved before the change carries rank fields and no stage fields.
test('a victory saved before the stages resumes on the dragon\'s scale', async ({ page, request }, testInfo) => {
  const sheet = await counted(
    page,
    request,
    `Vic24-${testInfo.project.name}`,
    progression({ xp: { session: 51, bonuses: [], total_before: 487, total_after: 538, rank_before: 3, rank_after: 3, title_after: 'Sentinelle des textes' } }),
  );
  const laurel = sheet.getByTestId('victory-xp');
  await expect(laurel).toHaveAttribute('aria-label', 'Dragonnet');
  await expect(laurel).toHaveAttribute('aria-valuenow', '438');
  await expect(laurel).toHaveAttribute('aria-valuemax', '1100');
  await expect(sheet).not.toContainText(/Sentinelle|undefined|Nouveau rang/);
});
```

- [ ] **Step 8: Sweep and run** — each must print nothing:

```bash
grep -rnE "RANKS|rank_for|rank_before|rank_after|rank_floor|next_threshold|title_after|rankFresh|rankedUp|rankBefore|rankAfter|catalog\.ranks|\"ranks\"|Nouveau rang|Ton rang|Recrue du camp|next_stage_at|dragon_stage\(" web/src server/app server/tests web/e2e --include=*.ts --include=*.svelte --include=*.py | grep -v "scenes-battle-victory.spec.ts:.*rank_before: 3, rank_after: 3" | grep -v "dragon.test.ts:.*rank_before: 1"
```

(the two excluded lines are the saved-victory fixtures, on purpose.)

Run: `scripts/pytest.sh -q` ; `scripts/npm.sh run test` ; `scripts/npm.sh run check`
Run: `STACK=prog scripts/playwright.sh scenes-battle-victory.spec.ts --repeat-each=3` ; `STACK=prog scripts/playwright.sh world.spec.ts happy-path.spec.ts scenes-camp.spec.ts`
Expected: all pass, `0 errors and 0 warnings`.

- [ ] **Step 9: Commit**

```bash
git add server/app/world/catalog.py server/app/world/xp.py server/app/world/progression.py server/app/routers/world.py server/tests/test_progression.py server/tests/test_world_rules.py server/tests/test_world_api.py web/src/lib/world/types.ts web/src/lib/world/dragon.ts web/src/lib/world/dragon.test.ts web/src/components/battle/VictorySpoils.svelte web/src/lib/battle/lines.ts web/src/lib/battle/lines.test.ts web/src/components/ui/LaurelBar.svelte web/src/lib/ui/laurel.ts web/src/lib/ui/laurel.test.ts web/src/components/juice/Gauge.svelte web/e2e/scenes-battle-victory.spec.ts
git commit -m "The XP ranks merge into the dragon's stages: the victory's laurel fills the old stage then switches to the new one with « Ton dragon grandit ! »; RANKS, rank_for, the rank fields and /api/world's ranks go; a victory saved before the change resumes on the dragon's scale

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- server/app/world/catalog.py server/app/world/xp.py server/app/world/progression.py server/app/routers/world.py server/tests/test_progression.py server/tests/test_world_rules.py server/tests/test_world_api.py web/src/lib/world/types.ts web/src/lib/world/dragon.ts web/src/lib/world/dragon.test.ts web/src/components/battle/VictorySpoils.svelte web/src/lib/battle/lines.ts web/src/lib/battle/lines.test.ts web/src/components/ui/LaurelBar.svelte web/src/lib/ui/laurel.ts web/src/lib/ui/laurel.test.ts web/src/components/juice/Gauge.svelte web/e2e/scenes-battle-victory.spec.ts
```

---

### Task 5: README and the full gate

**Files:**
- Modify: `README.md` (§1 feature list, the feature notes next to the mastery rule, the rules file section added by sub-project 1)

**Interfaces:**
- Consumes: everything above.
- Produces: a documented dragon growth and `dragon_stages`; a clean gate.

- [ ] **Step 1: The README**

§1, in « Camp and progression »: « and a companion dragon that hatches and grows. » becomes « and a companion dragon that grows from the XP through six stages, from the egg to the Dragon ancestral (years of play). »

After the « Mastery rule » bullet, add:

```markdown
- **Dragon growth** — the dragon's stage follows the hero's total XP: Œuf (0), Dragonnet (100),
  Jeune dragon (1 200), Dragon adulte (5 000), Dragon illustre (15 000), Dragon ancestral (40 000),
  thresholds in `data/regles.json`. A stage is never lost: a raised threshold or a restored backup
  keeps the stage already reached, and a dragon grown from neutralisations before this rule keeps
  its stage. The HUD's laurel shows the way to the next stage; the XP ranks are gone.
```

In « The rules file (`data/regles.json`) »: the JSON block gains, after `"chouette_hints": 3`, a comma and the line

```json
  "dragon_stages": {"hatchling": 100, "young": 1200, "adult": 5000, "illustre": 15000, "ancestral": 40000}
```

and the table gains the row

```markdown
| `dragon_stages` | The total XP at which the dragon reaches each stage (`hatchling` to `ancestral`; the egg is always 0). A partial object keeps the other stages' defaults; the stages must rise from one to the next (whole numbers up to 1 000 000), otherwise the whole table is ignored with a warning. A lowered stage takes effect on the next camp visit; a raised one never shrinks a dragon |
```

- [ ] **Step 2: The full gate**

Run: `STACK=prog PW_WORKERS=4 scripts/check.sh`
Expected: `== ALL GREEN`; pytest, vitest and Playwright with no failure, `svelte-check` `0 errors and 0 warnings`, tsc silent, no warning in the vitest/pytest output. Paste the counts. Any failure, flake or warning is fixed here (root cause, in the owning file) or reported as an open item; never retried away.

- [ ] **Step 3: Final sweeps** (each must print nothing)

```bash
grep -rnE "RANKS|rank_for|rank_floor|next_threshold|rankFresh|Nouveau rang|Ton rang|Recrue du camp|next_stage_at|dragon_stage\(" web/src web/e2e server/app server/tests README.md
grep -rn "ruse d'Éris neutralisée me fait grandir\|sera neutralisée, et tu me donneras\|J'éclorai quand" content/dialogue web/src
ls assets/art/export/dragon/dragon_adult_cut.webp assets/art/export/dragon/dragon_illustre_cut.webp assets/art/export/dragon/dragon_ancestral_cut.webp 2>/dev/null
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "README: the dragon grows from XP through six stages (thresholds, never lost, ranks gone), and dragon_stages in data/regles.json

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- README.md
```

---

## Spec coverage (self-review)

| Spec | Task |
|---|---|
| §1 six stages and default thresholds; `dragon_stages` in `data/regles.json` with the same fallback rules | 1 (`world/dragon.py`, `rules.py`), 5 (README) |
| §1 stored, never goes down (lowered threshold, restored backup); neutralisation stops driving it (`dragon_stage`, `next_stage_at`, `progression.py`, `world.py`); an existing profile keeps its stage; `hatched_at` on leaving the egg; naming prompt unchanged | 1 (`grown_stage`, `store_stage`, `needs_name` unchanged), 3 (`next_stage_at`) |
| §2 `RANKS`, `rank_for` go; `progression.xp` `stage_before`/`stage_after`/`floor`/`next`; `/api/world` serves the stage table instead of `ranks` | 1 (added), 4 (ranks removed) |
| §2 HUD laurel: progress to the next stage, the stage's name, full with « Dragon ancestral » at the top | 3 |
| §2 victory: two-part animation keyed on a stage change, « Ton dragon grandit ! » with the new stage's name; « Nouveau rang » and rank titles gone | 4, 3 (Éris's dossier aside) |
| §3 `illustre`/`ancestral` everywhere: `STAGE_ORDER`, client type, `STAGE_LABELS`, `STAGE_ACTIVITY` (verbatim), `ART.dragon`, sizes, dialogue `when.stage` lists | 1, 2 |
| §3 `stageLine` in XP words (20 %), the ancestral line, no number in the dragon's mouth | 3 |
| §3 ≥ 3 variants per per-stage event for `illustre` and `ancestral` (`camp.enter`, `nest.enter`), pride / calm wisdom, copy rules | 2 |
| §3 the redrawn adult and the two new stages in `web/public/art/dragon/` | 2 |
| §4 no migration; a stored `adult` stays `adult` with little XP; 16 000 XP reads `illustre` | 1 |
| §5 server tests (thresholds default and from the file, monotonic, stage table, `progression.xp` shape, no rank field) | 1, 3, 4 |
| §5 client tests (`stageLine`, `stageActivity`, six labels, HUD per stage and at the top, victory stage-up, dialogue content with the two stages, art test) | 2, 3, 4 |
| §5 e2e (the victory's stage-up reveal, the HUD gauge, the nest showing each stage) and the full gate | 2, 3, 4, 5 |
