# La Discorde — Sub-project 1 "Scoring, XP and the review aids" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The game judges the child the way school does, on the mistakes left in the handed-in copy: a quest session counts on the lieutenant's correct share of the final text, an Éris fight is won on the mistakes left per 100 words, and the victory sheet says « Ta copie : 3 fautes sur 150 mots. Une belle copie. » instead of « Gloire gagnée ». Before each battle the child chooses which of the five review aids to take along (Argus, Ariane, Persée, Athéna's owl, and the new Palamède) on one pace-and-aids screen that shows every bonus; an aid left at the camp is absent from the proofreading and pays +20 % of glory. The automatic help stage, the client-side score, the fight's "too easy" draw and the "stirring" lieutenants are removed. XP is computed on the server from the copy, the pace, the aids and the prophecy, and the victory's chips break it down. Every threshold lives in `data/regles.json`.

**Architecture:** Server first, then the client, then the art.
- Server (`server/app`): `rules.py` (the rules file, read once at start-up, on `app.state.rules`, served by `GET /api/world`), `world/measures.py` (the two measures of a copy), migration `005` (`session.aids`, `profile_stat*.introduced`), `SessionCreate.aids` (validated, remembered as `settings.aids`), the quest/fight verdicts and the XP formula with its parts (`world/quests.py`, `world/xp.py`, `world/progression.py`), the session's XP stored in its `score` column. The help-stage machinery and `stirring` go; their columns stay.
- Client pure modules (`web/src/lib`): `rules.ts` (the rules with their defaults, the copy verdict, the pace and prophecy bonuses), `aids.ts` (the five aids, their names, the remembered choice, the bonus total, the suggestion rule), `battle/proofAids.ts` (what the proofreading shows for a set of aids). The play state carries the aids chosen for its battle.
- Client components: `ProofPhase` gates each tool on its aid; `MusterPhase` becomes the pace-and-aids screen with a new `AidToggles`; `VictorySheet` shows the copy line; `VictorySpoils` shows the XP parts. Palamède's emblem and bestiary entry land last, once the art track's files are merged.

**Tech Stack:** Svelte 5 (runes) + TypeScript + Vite 7, vitest 5 (node env, no component rendering: logic that needs a unit test lives in a pure `.ts` module), Playwright 1.63 (WebKit `desktop` 1280×720 and `ipad` 1180×820 touch, which runs `scenes-*.spec.ts`), FastAPI + pydantic 2 + SQLite (numbered SQL migrations), pytest. No new dependency.

**Spec:** `docs/superpowers/specs/2026-09-29-scoring-xp-design.md` is binding (§1 measures, §2 decisions, §3 aids, §4 XP, §5 the pace-and-aids screen, §6 removals, §7 rules file, §8 data, §9 Palamède, §10 testing). Context: `docs/superpowers/specs/2026-09-29-progression-roadmap.md` (sub-project 1 does **not** touch neutralisation) and `docs/superpowers/specs/2026-09-29-art-design.md` (Palamède's art). Repo-root `CLAUDE.md` is binding for every agent: no "pre-existing" problems, tests and `svelte-check` clean with zero errors and zero warnings, no emoji anywhere player-visible.

## Dependencies and batching

Execution is subagent-driven and **sequential**, all in the worktree `C:\Users\nicol\IdeaProjects\school-playground\.claude\worktrees\art-skills` (branch `worktree-art-skills`, `STACK=prog`). Each task starts from the previous task's commit. A reviewer gates each task before the next one starts.

| # | Task | Recommended model | Why |
|---|---|---|---|
| 1 | Server foundation: the rules file, the two measures, migration 005, `introduced` in the stats, `SessionCreate.aids` (validated, stored, remembered), the recent sessions' aids and copy measure | sonnet | Fully specified here, pure server code and pytest. |
| 2 | Server rules of the game: quest counting, the fight verdict (no "too easy", no Grimoire switch), the XP formula and its parts, the session's XP in `score`, legacy quest goals; world e2e step 7 | opus | Cross-cutting: rounding of the parts, legacy quests, and the e2e boss flow changes meaning. |
| 3 | Client foundation: `lib/rules.ts`, `lib/aids.ts` (names, normalisation, bonus total, suggestion rule), the additive types | sonnet | Pure modules with their tests. |
| 4 | Help stage → aids, end to end: the play state's aids, `proofAids`, ProofPhase's gating, the hold's notches, the owl's hints from the rules, the help-stage machinery removed on both sides (URL `?help=`, `PlayState.help`, `next_help_stage`, the help message and its dragon line, `ProfileOut.help_stage`, the boss's help stage and Grimoire route), the journal's aids line in place of its help line, and the e2e that pinned help stages | opus | The riskiest change: every proofreading spec and the boss flow move. |
| 5 | The words around the aids: the bestiary's Argus and Muses lines, the boss's rules and banner from the fight threshold | sonnet | Copy and small wiring, fully specified. |
| 6 | The pace-and-aids screen: `AidToggles`, the two-column / one-column muster, the bonus tags and total line, the suggestion, the sticky start bar, the resume reminder, the grimoire's aids column; new e2e at 1280×800, 1024×768 and phone width | opus | Layout under a no-scroll budget on three viewports. |
| 7 | The victory: the copy line replaces the score, `computeScore` and `score` removed, the XP chips from the server's parts, the "too easy" leftovers removed; e2e for the chips | sonnet | Well specified. |
| 8 | Stirring removed, server and client (flag, types, captions, `opponentFor`'s preference, the portrait's revenge note, tests, README line) | sonnet | Mechanical but spans scenes and their tests. |
| 9 | Palamède (LAST code task): verify the art files, `TOOL_ICONS.palamede`, `ART.emblems.palamede`, the bestiary entry, the aid toggle's painted emblem, art and bestiary tests | sonnet | Needs the art track merged first. |
| 10 | README (the rules file in the NAS section, the aids in the feature list) and the full gate | opus | The gate may surface cross-task fixes that need judgment. |

**Palamède ordering (controller):** the art track (another branch, `art-track`) produces `web/public/art/emblems/palamede_cut.webp` and `web/public/art/icons/tool-palamede.webp`. **Merge `art-track` into this branch immediately before dispatching Task 9, never earlier**: `web/src/lib/world/art.test.ts` requires the icons on disk to equal the mapped icons, so an early merge turns Tasks 3-8's vitest red. Until Task 9, `aidIcon('palamede')` returns `null` and the aid's toggle shows a plain bronze coin (no glyph, no text); nothing else needs Palamède's art (his count in the proofreading never had an icon). Task 9 makes every aid's emblem a painted one and removes the fallback.

Playwright runs are serialised machine-wide by the lock in `scripts/playwright.sh` (`with_playwright_lock`, `scripts/lib.sh`); the parallel art agent's Forge and segmentation batches take the same lock (`tools/art/with_lock.sh`), so a queued e2e run is waiting for them, not hanging. Never read Forge's files.

## Global Constraints

- **Scope (spec, Goal):** "Neutralisation is **not** touched here (sub-project 2 removes it)." The mastery window, `is_neutralised`, the relics, the dragon's stages from neutralisations and the +200 mastery XP bonus stay exactly as they are. Quest, Oracle, fight, mastery and weekly bonuses are unchanged; XP totals and ranks are kept.
- **The rules file (spec §7), defaults verbatim:**
  ```json
  {
    "quest_min_chances": 3, "quest_min_correct": 0.85,
    "fight_max_per_100": 4,
    "copy_belle_max_per_100": 2, "copy_correcte_max_per_100": 8,
    "aid_bonus": 0.20, "pace_bonus": {"1": 0, "2": 0.25, "3": 0.5}, "prophecy_bonus": 0.5,
    "chouette_hints": 3
  }
  ```
  `data/regles.json` in the data folder, read at server start-up. Every key optional; a missing key uses the default; "A malformed file or a value of the wrong type is logged and ignored (defaults apply), so a typo never stops the game." The values the client needs are served with `GET /api/world` (`rules`).
- **XP (spec §4), verbatim:** `words = totalWords`; `m = mistakes left per 100 words`; `effort = 10 + words / 10`; `accuracy = (words / 5) × max(0, 1 − m / 10)`; `rereading = 2 × caught`; `bonus = pace bonus + 20 % × aids left + prophecy bonus`; `XP = round(effort + (accuracy + rereading) × (1 + bonus))`. Pace 4 counts as pace 3; the Grimoire has no pace bonus; the prophecy applies before the text's due date as today. Worked example: 150 words, 3 mistakes left, 4 caught, pace 2, two aids left → 78 XP.
- **Measures (spec §1):** per lieutenant: chances = `opportunities`, mistakes left = `missed + introduced`, summed over `LIEUTENANTS[k].categories` (derived ones included), correct share = 1 − left ÷ chances. Whole text: 100 × `finalErrors.length` ÷ `totalWords`, every category counted.
- **Data (spec §8):** migration `005` adds `session.aids` (TEXT, JSON list, NULL for old sessions) and `profile_stat.introduced`, `profile_stat_day.introduced` (INTEGER, default 0). No destructive migration: `profile.help_stage` and `session.help_stage` stay in the database; new sessions write 0.
- **Stale pages keep working:** a page opened before this change posts `help_stage` and `score` and no `aids`: the server accepts and ignores the first two and stores `aids` NULL (0 aids left, no bonus). A play state saved before the change (with `help`, without `aids`) resumes with all five aids.
- **Toolchain (verified against `scripts/` on 2026-09-29):** no host Node and no host Python for the project. From the worktree root, in Git Bash:
  - `scripts/pytest.sh -q <paths relative to server/>` (e.g. `scripts/pytest.sh -q tests/test_rules.py`; it runs in `server/`);
  - `scripts/npm.sh run test -- <paths relative to web/>` (vitest, focused, e.g. `src/lib/aids.test.ts`);
  - `scripts/npm.sh run check` (svelte-check over `src`, then `tsc -p tsconfig.e2e.json` over `e2e/`: must print `0 errors and 0 warnings` and tsc must print nothing);
  - `STACK=prog scripts/playwright.sh <spec-file-or-filter> [--project=desktop|ipad] [--repeat-each=3] [-g "<title>"]`;
  - `STACK=prog PW_WORKERS=4 scripts/check.sh` (the full gate: pytest, tts pytest, svelte-check + e2e tsc, vitest, both docker builds, all e2e, the real-voice spec).
  **This is a worktree: always set `STACK=prog`** for `playwright.sh` and `check.sh` (the main checkout's stack is `discorde`; ours is `discorde-prog`). Do not run Docker or Playwright outside these wrappers.
- **Testing rules:** per task, run the focused vitest files, `scripts/npm.sh run check`, and the focused pytest files; run every **new or changed** e2e spec (or test, with `-g`) with `--repeat-each=3`; run every **touched but unchanged-in-intent** spec once. The full gate runs in Task 10 (a task may run it earlier when it changes something global). The crash-only retry (`scripts/playwright-crash-retry.mjs`) retries a named "browser crashed" failure once; any other failure is a real failure. A flake is a defect: root-cause it, never retry it away.
- **e2e robustness (8 workers by default, 4 in the gate):** import `test`/`expect` from `./crashGuard` (it installs the audio stub `window.__discordeAudioStub` and turns tours off, `window.__discordeTours = 'off'`); each test creates its own hero (`createProfileApi`) and its own text (`createText` with `uniqueName`); a finger on `ipad`, a mouse on `desktop` (`tap(locator, testInfo)`); no `waitForTimeout`; web-first assertions and `expect.poll`; a settings save that a reload depends on is awaited. A spec that sets a viewport sets it explicitly (`page.setViewportSize`) and holds on both projects.
- **French copy:** every French string of this plan is used verbatim. In-world, warm, gender-neutral towards the player (no adjective or participle agreeing with her), no school register (`BANNED` in `web/src/testing/copyRules.ts`: « niveau », « réviser », « HarmoS »…), no guilt wording (`GUILT`: manqué, raté, perdu), no FOMO. Plurals through `plural()`. Typography: U+202F (`\u202f`) before « : ; ! ? % » and inside « guillemets » (`web/src/frenchSpacing.test.ts` and `server/tests/test_french_spacing.py` guard it). « faute(s) » and « copie » are the spec's own words and are allowed. Code, comments, docs and commit messages are in English.
- **No emoji (CLAUDE.md):** not in any string, button, badge or marker. The aids use the painted emblems (`TOOL_ICONS`, `web/public/art/icons/tool-*.webp`); until Task 9 Palamède's toggle is a plain bronze coin.
- **Accessibility:** touch targets ≥ 48 px (the aid toggles, the pace medallions, the start button); the aid toggles are real `<button type="button" aria-pressed>` (pressed = taken along); the pace choice stays real radios; the suggestion is text, never colour alone.
- **Guards that must stay green (vitest):** `noEmoji`, `registerGuard`, `noGuilt`, `formPlural`, `frenchSpacing`, `placesKit`, `artReferenced`, `app.css`, `lib/battle/lines.test.ts` (walks every string of `lines.ts`), `lib/world/art.test.ts`, `lib/world/bestiary.test.ts`.
- **Commits:** on `worktree-art-skills`. **Always** `git add <paths> && git commit -m "..." -- <paths>`; a `git rm` names its paths. Never `git add -A`, `git stash`, `git reset`, `git checkout`, `git restore` of tracked work, `git clean`, or any history rewrite. End every message with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- **Verification:** run each task's commands and paste the real output (counts included) into the report. A failing, flaky or warning test anywhere is yours to fix or to report as an open item, never "pre-existing" (CLAUDE.md).

## Review Focus

The five failure modes the spec implies but its test list does not pin, most likely first. Each has its test in the owning task.

1. **Stale pages and stale saves.** A page opened before the change posts `help_stage`, `score` and no `aids`; a play state saved before the change carries `help: 3` and no `aids`; a hand-edited `settings.aids` is `"argus"` or holds unknown keys. Expected: the session is saved (201, `aids` NULL, the hero's remembered aids untouched, no aid bonus), the saved battle resumes with all five aids and no help field, a malformed remembered choice reads as all five, a list with unknown keys keeps only the valid ones. Tests: Task 1 `test_a_page_opened_before_the_aids_still_saves_its_session`; Task 3 `normalizeAids` cases; Task 4 `a save from before the aids resumes with all five taken, and forgets its help stage`.
2. **Rules-file values that look right but are not.** `true` for a count (Python's `bool` is an `int`), `2.5` hints, `NaN`/`Infinity` (Python's `json` accepts them), a negative threshold, `quest_min_correct` above 1, a partial or partly wrong `pace_bonus`, an unknown key. Expected: that value is logged and ignored, its default applies, the others still apply. Tests: Task 1 `test_a_value_of_the_wrong_type_is_logged_and_its_default_kept`, `test_nan_and_infinity_are_refused`, `test_a_partial_file_keeps_the_other_defaults`.
3. **XP parts that do not add up.** The chips must sum to the session XP for every input (rounding of two different sums, a zero base with a bonus, the Grimoire, odd bonus values from the rules file). Expected: `sum(parts) == session` and every part ≥ 0. Test: Task 2 `test_the_parts_always_add_up_to_the_session_xp` (a grid of ~7 000 inputs, default and odd rules).
4. **Quests created before the change.** An active board quest stores `min_rate: 0.9`; an active boss quest stores `min_rate`, `min_draft`, `help_stage` and `mode: "grimoire"` from an old "too easy" draw. Expected: both are judged by the new rule, the API no longer exposes those keys, and the Éris screen opens the ordinary dictation for the old grimoire-flagged fight. Tests: Task 2 `test_quests_created_before_the_new_rule_are_judged_by_it` and the legacy-goal half of `test_boss_flow`; Task 4 removes the Grimoire route from `Boss.svelte` (reviewed in code; covered end to end by Task 2's world step 7).
5. **Degenerate results.** A result with `totalWords` 0, without `finalErrors` (the API's minimal results), or a lieutenant with zero chances. Expected: no division by zero anywhere; 0 mistakes per 100; a lieutenant without chances never counts a quest session; XP is the effort alone. Tests: Task 1 `test_a_lieutenant_without_chances_has_no_correct_share`, `test_mistakes_left_per_100_words_count_every_category`; Task 2's parts grid includes `words = 0`; Task 3 `per100(0, 0)`.

## Rulings taken by this plan (the spec is silent or ambiguous; do not re-ask)

- **R1 The remembered choice is written by the server** with each saved session (`POST /api/sessions` merges `aids` into `settings.aids` when the body carries them). Toggling on the muster changes only the battle's play state; a battle abandoned before its end does not change the remembered choice. The journal's "aids taken last" is `settings.aids`.
- **R2 Stale client:** a body without `aids` stores NULL, leaves `settings.aids` alone and counts 0 aids left. Unknown or repeated keys are a 422 (only a hand-made request can send them). The server stores the aids in the camp's order (`argus, ariane, persee, athena, palamede`).
- **R3 The suggestion's history** is `GET /api/profiles/{id}/stats`'s `recent_sessions` (20 newest), which gain `aids` and `per_100`. "Consecutive dictations" counts `mode == 'dictation'` sessions (Éris fights included); Grimoire rounds between them are skipped, neither counted nor breaking the run. A session without aids (NULL, before the change) breaks a "same aids" run. "Leave" names the first aid of athena → argus → palamede → persee → ariane that the run took and this muster still takes. "Take back the last aid left" names the **latest** of that order that this muster does not take. A leave rule is checked before the take-back rule (they cannot both hold).
- **R4 « Emporter » / « Laisser au camp »:** the toggle's accessible name is the aid's name and `aria-pressed` says taken; on the wide layout a visible state word shows the current choice (« Emporter » when taken, « Laisser au camp » when left), aria-hidden. The « +20 % » tag shows while the aid is left.
- **R5 Pace bonus tags** show only for a non-zero bonus (pace I has none by default: no « +0 % » tag). The total line always shows (« Gloire de ce combat : +0 % » included).
- **R6 Wide or narrow** is measured on the muster's own width (≥ 40 rem, 640 px). At 1280×800 and 1180×820 the parchment (`min(62vw, 48rem)`) is wide; at 1024×768 it is 635 px, narrow. To keep 1024×768 free of scrolling, the narrow layout also folds the paces into one row of three medallions with the selected pace's description under them (the spec's narrow description names only the aids; this applies the same idea to the paces).
- **R7 The start bar is sticky in both layouts**, not only the narrow one: a phone in landscape is under 560 px tall, which folds the stage into the compact layout where the parchment is the full width (so "wide" by width) and the muster must scroll. The muster's bottom fade (UI5 playability #22) is dropped where the start bar is (it would fade the button); the resume view keeps it.
- **R8 The Grimoire button moves into the start bar** (beside « Commencer la dictée », quiet), its caption under the bar: the grimoire way stays one tap away, and the screen fits.
- **R9 `MUSTER.paceGlory`** (« Plus le rythme est vif, plus la gloire est grande. ») goes: the bonus tags and the total line say it with numbers. The pace legend becomes « Ton rythme » (spec §5).
- **R10 The spec's copy example** « Ta copie : 3 fautes sur 120 mots. Une belle copie. » illustrates the wording; with the default limits 3 on 120 is 2.5 per 100, « Une copie correcte. ». The plan follows the limits. Zero mistakes reads « pas une faute ».
- **R11 The help stage leaves the API too:** `ProfileOut.help_stage`, `recent_sessions[].help_stage`, `SessionCreated.help_stage_*` and `POST /boss`'s `help_stage` are dropped (dead data; the columns stay). Legacy goal keys (`min_rate`, `min_draft`, `mode`, `help_stage`) are stripped from `quest_out`. The fight's `boss` block becomes `{tier, won}`.
- **R12 XP parts:** `text = round(effort + accuracy + rereading)`; the rest of the session XP (`XP − text`, never negative) is shared between `pace`, `aids` and `prophecy` in proportion to `base × percentage` by largest remainders, ties in that order. Round is half-up (`int(x + 0.5)`, the existing `_half_up`).
- **R13 Quest counting is unchanged in scope:** a Grimoire session still counts for a quest when it meets the rule (as today); only the rule changes.
- **R14 The boss copy** states the fight threshold from the rules: banner « Combat contre Éris : elle s'enfuit si ta copie garde 4 fautes au plus pour 100 mots. », boss rules « Un long texte. Si ta copie garde 4 fautes au plus pour 100 mots, Éris s'enfuit ; sinon, tu pourras revenir l'affronter. ». The « Relancer le combat » label (only for the Grimoire retry) goes.
- **R15 The prophecy bonus** applies strictly before the due date (the server's `due_date > day`), so the muster's « Prophétie +50 % » tag uses the same test (`prophecyBonusApplies`), while the prophecy tag of the head keeps `isProphecy` (inclusive, the Oracle's display rule).
- **R16 Rules are read at start-up only** (the spec's words); a changed file needs a restart. The README says so.

## File map

| File | Responsibility | Task |
|---|---|---|
| `server/app/rules.py`, `server/tests/test_rules.py` | the rules file | 1 |
| `server/app/world/measures.py`, `server/tests/test_measures.py` | the two measures | 1 |
| `server/app/migrations/005_aids.sql`, `server/tests/test_db.py` | the aids and `introduced` columns | 1 |
| `server/app/main.py` | `app.state.rules` | 1 |
| `server/app/stats.py` | `introduced` in the stats (Task 1); `next_help_stage` removed (Task 4) | 1, 4 |
| `server/app/schemas.py` | `SessionCreate.aids`, optional `help_stage`/`score` (1); `ProfileOut.help_stage` removed (4) | 1, 4 |
| `server/app/routers/sessions.py` | aids stored and remembered (1); rules passed, XP in `score` (2); help machinery removed (4) | 1, 2, 4 |
| `server/app/routers/stats.py` | recent sessions' `aids`, `per_100` (1); `help_stage` out (4) | 1, 4 |
| `server/app/routers/world.py` | `rules` in `/api/world` (1); quest goals, `quest_out` (2); boss help stage (4); stirring (8) | 1, 2, 4, 8 |
| `server/app/world/quests.py`, `xp.py`, `progression.py` | verdicts, XP and parts | 2 |
| `server/app/routers/profiles.py` | `to_out` without `help_stage` | 4 |
| `server/tests/test_sessions.py`, `test_progression.py`, `test_world_rules.py`, `test_world_api.py`, `test_stats_logic.py`, `test_profiles.py` | server tests | 1, 2, 4, 8 |
| `web/src/lib/rules.ts` (+ test), `web/src/lib/aids.ts` (+ test) | client rules and aids | 3 |
| `web/src/lib/types.ts`, `web/src/lib/world/types.ts` | types | 3, 4, 7, 8 |
| `web/src/lib/battle/proofAids.ts` (+ test), `web/src/lib/battle/hp.ts` (+ test), `web/src/lib/argus.ts` (+ test), `web/src/lib/battle/lines.ts` (+ test) | proofreading gating and copy | 4, 5, 6, 7 |
| `web/src/lib/playState.ts` (+ test), `web/src/lib/routes.test.ts` | the battle's aids, no help | 4 |
| `web/src/screens/Play.svelte`, `web/src/screens/Boss.svelte`, `web/src/lib/world/api.ts` | wiring | 4, 5, 6, 7 |
| `web/src/components/battle/ProofPhase.svelte`, `VictoryPhase.svelte`, `BossMuster.svelte` | components | 4, 5, 7 |
| `web/src/lib/world/journal.ts` (+ test), `web/src/components/places/cabin/JournalPanel.svelte` | the journal's aids line | 4 |
| `web/src/lib/world/bestiary.ts` | Argus and the Muses (5), Palamède (9) | 5, 9 |
| `web/src/components/battle/MusterPhase.svelte`, `PaceMedallions.svelte`, `AidToggles.svelte` (new) | the pace-and-aids screen | 5, 6 |
| `web/src/lib/grading/grade.ts` (+ test), `web/src/lib/grading/types.ts`, `web/src/lib/world/derived.test.ts`, `web/src/components/battle/VictorySheet.svelte`, `VictorySpoils.svelte` | the victory | 7 |
| `web/src/lib/world/eris.ts`, `scenes/war.ts`, `scenes/camp.ts`, `web/src/lib/battle/battle.ts`, `web/src/components/places/war/PortraitPanel.svelte` (+ tests) | stirring | 8 |
| `web/src/lib/world/art.ts` (+ test), `web/src/lib/world/bestiary.test.ts` | Palamède | 9 |
| `web/e2e/helpers.ts` | `postSession` aids (1), `makeResult` left (2), `seedPlay` aids, `setSavedAids` (4) | 1, 2, 4 |
| `web/e2e/world.spec.ts`, `scenes-battle-play.spec.ts`, `scenes-battle.spec.ts`, `playability-ui4.spec.ts`, `scenes-cabin.spec.ts`, `scenes-battle-victory.spec.ts`, `happy-path.spec.ts`, `scenes-war.spec.ts`, `scenes-muster.spec.ts` (new) | e2e | 2, 4, 5, 6, 7, 8, 9 |
| `README.md` | stirring line (8), rules file and aids (10) | 8, 10 |

---

### Task 1: Server foundation — the rules file, the two measures, migration 005, `introduced`, the aids of a session

**Files:**
- Create: `server/app/rules.py`, `server/app/world/measures.py`, `server/app/migrations/005_aids.sql`, `server/tests/test_rules.py`, `server/tests/test_measures.py`
- Modify: `server/app/main.py` (lifespan), `server/app/stats.py` (`apply_session_to_stats`), `server/app/schemas.py` (`SessionCreate`, `AID_KEYS`), `server/app/routers/sessions.py` (insert, remembered aids), `server/app/routers/stats.py` (`recent_sessions`), `server/app/routers/world.py` (`get_world`)
- Test: `server/tests/test_db.py`, `server/tests/test_sessions.py`
- Modify: `web/e2e/helpers.ts` (`postSession` gains `aids`)

**Interfaces:**
- Consumes: `Settings.data_dir` (`server/app/config.py`), `connect`, `migrate`, `MIGRATIONS_DIR`, `DB_FILENAME` (`server/app/db.py`).
- Produces:
  - `app.rules`: `RULES_FILENAME = "regles.json"`; `@dataclass(frozen=True) class Rules` with fields `quest_min_chances: int`, `quest_min_correct: float`, `fight_max_per_100: float`, `copy_belle_max_per_100: float`, `copy_correcte_max_per_100: float`, `aid_bonus: float`, `pace_bonus: dict[str, float]`, `prophecy_bonus: float`, `chouette_hints: int` and `as_dict() -> dict`; `load_rules(data_dir: Path) -> Rules`.
  - `app.state.rules: Rules` (set in the lifespan).
  - `app.world.measures`: `lieutenant_measure(by_category: dict, categories: list[str]) -> {"chances": int, "left": int, "correct": float | None}`; `mistakes_per_100(result: dict) -> float`.
  - `app.schemas.AID_KEYS = ("argus", "ariane", "persee", "athena", "palamede")`; `SessionCreate.aids: list[str] | None` (validated, returned in `AID_KEYS` order), `SessionCreate.help_stage: int | None`, `SessionCreate.score: int | None`.
  - `GET /api/world` gains `"rules": Rules.as_dict()`.
  - `GET /api/profiles/{id}/stats` `recent_sessions[]` gains `"aids": list[str] | None` and `"per_100": float | None`.
  - `profile.settings.aids` is written by `POST /api/sessions` when the body carries `aids`.
  - e2e: `postSession(request, { …, aids?: string[] })`.

- [ ] **Step 1: Write the failing rules tests** — `server/tests/test_rules.py`:

```python
import json
import logging
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import create_app
from app.rules import RULES_FILENAME, load_rules

DEFAULTS = {"quest_min_chances": 3, "quest_min_correct": 0.85, "fight_max_per_100": 4.0, "copy_belle_max_per_100": 2.0,
            "copy_correcte_max_per_100": 8.0, "aid_bonus": 0.2, "pace_bonus": {"1": 0.0, "2": 0.25, "3": 0.5},
            "prophecy_bonus": 0.5, "chouette_hints": 3}


def write(tmp_path: Path, text: str) -> Path:
    (tmp_path / RULES_FILENAME).write_text(text, encoding="utf-8")
    return tmp_path


def test_no_file_means_the_built_in_rules(tmp_path):
    assert load_rules(tmp_path).as_dict() == DEFAULTS


def test_a_partial_file_keeps_the_other_defaults(tmp_path):
    rules = load_rules(write(tmp_path, '{"fight_max_per_100": 3, "pace_bonus": {"3": 0.6}, "chouette_hints": 5}'))
    assert rules.as_dict() == {**DEFAULTS, "fight_max_per_100": 3.0, "pace_bonus": {"1": 0.0, "2": 0.25, "3": 0.6},
                               "chouette_hints": 5}


def test_a_malformed_file_is_logged_and_ignored(tmp_path, caplog):
    with caplog.at_level(logging.WARNING):
        assert load_rules(write(tmp_path, '{"aid_bonus": 0.3,')).as_dict() == DEFAULTS
        assert load_rules(write(tmp_path, "[1, 2]")).as_dict() == DEFAULTS
    assert caplog.text.count(RULES_FILENAME) >= 2


def test_a_value_of_the_wrong_type_is_logged_and_its_default_kept(tmp_path, caplog):
    text = json.dumps({"aid_bonus": "0.3", "chouette_hints": 2.5, "quest_min_chances": True, "quest_min_correct": 1.5,
                       "fight_max_per_100": -1, "prophecy_bonus": None, "pace_bonus": {"2": "x", "4": 1, "3": 0.7},
                       "copy_belle_max_per_100": 1, "surprise": 1})
    with caplog.at_level(logging.WARNING):
        rules = load_rules(write(tmp_path, text))
    assert rules.as_dict() == {**DEFAULTS, "pace_bonus": {"1": 0.0, "2": 0.25, "3": 0.7}, "copy_belle_max_per_100": 1.0}
    for key in ("aid_bonus", "chouette_hints", "quest_min_chances", "quest_min_correct", "fight_max_per_100",
                "prophecy_bonus", "pace_bonus", "surprise"):
        assert key in caplog.text, key


def test_nan_and_infinity_are_refused(tmp_path):
    assert load_rules(write(tmp_path, '{"aid_bonus": NaN, "fight_max_per_100": Infinity}')).as_dict() == DEFAULTS


def test_a_pace_bonus_that_is_not_an_object_keeps_the_built_in_one(tmp_path):
    assert load_rules(write(tmp_path, '{"pace_bonus": 0.3}')).as_dict() == DEFAULTS


def test_the_world_catalog_serves_the_rules_read_at_start_up(settings):
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    (settings.data_dir / RULES_FILENAME).write_text('{"chouette_hints": 1}', encoding="utf-8")
    with TestClient(create_app(settings)) as c:
        assert c.get("/api/world").json()["rules"] == {**DEFAULTS, "chouette_hints": 1}


def test_the_world_catalog_serves_the_defaults_without_a_file(client):
    assert client.get("/api/world").json()["rules"] == DEFAULTS
```

- [ ] **Step 2: Write the failing measures tests** — `server/tests/test_measures.py`:

```python
from app.world.measures import lieutenant_measure, mistakes_per_100


def test_a_lieutenants_measure_sums_its_categories_derived_ones_included():
    bc = {"agreement:number": {"opportunities": 5, "draft": 2, "caught": 1, "missed": 1, "introduced": 0},
          "agreement:verb": {"opportunities": 15, "draft": 2, "caught": 2, "missed": 0, "introduced": 1},
          "homophone": {"opportunities": 9, "missed": 4}}
    assert lieutenant_measure(bc, ["agreement:number", "agreement:verb"]) == {"chances": 20, "left": 2, "correct": 0.9}
    lethe = {"derived:lethe": {"opportunities": 4, "draft": 2, "caught": 1, "missed": 1, "introduced": 0}}
    assert lieutenant_measure(lethe, ["derived:lethe"]) == {"chances": 4, "left": 1, "correct": 0.75}


def test_a_lieutenant_without_chances_has_no_correct_share():
    assert lieutenant_measure({}, ["homophone"]) == {"chances": 0, "left": 0, "correct": None}
    assert lieutenant_measure({"homophone": {"opportunities": 0, "introduced": 1}}, ["homophone"]) == {"chances": 0, "left": 1, "correct": None}


def test_mistakes_left_per_100_words_count_every_category():
    three = [{"category": "accent"}, {"category": "punctuation_case"}, {"category": "homophone"}]
    assert mistakes_per_100({"totalWords": 150, "finalErrors": three}) == 2.0
    assert mistakes_per_100({"totalWords": 120, "finalErrors": []}) == 0.0
    assert mistakes_per_100({"totalWords": 0, "finalErrors": [{}]}) == 0.0
    assert mistakes_per_100({"version": 1}) == 0.0
```

- [ ] **Step 3: Write the failing migration and session tests**

Append to `server/tests/test_db.py`:

```python
from app.db import MIGRATIONS_DIR


def _pre_005_db(path):
    """A database as the game left it before sub-project 1: migrations 001-004 only."""
    conn = connect(path)
    conn.execute("CREATE TABLE schema_version (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)")
    for f in sorted(MIGRATIONS_DIR.glob("*.sql")):
        version = int(f.name.split("_", 1)[0])
        if version >= 5:
            break
        conn.executescript(f.read_text(encoding="utf-8"))
        conn.execute("INSERT INTO schema_version(version, applied_at) VALUES (?, 'then')", (version,))
    conn.commit()
    return conn


def test_migration_005_upgrades_a_pre_005_database_in_place(tmp_path):
    conn = _pre_005_db(tmp_path / "old.sqlite3")
    conn.execute("INSERT INTO profile(id, name, avatar, level, help_stage, created_at) VALUES (1, 'Io', 'chouette', '8H', 3, 'now')")
    conn.execute("INSERT INTO text(id, title, body, source, level, created_at) VALUES (1, 'T', 'Un texte.', 'custom', '8H', 'now')")
    conn.execute("INSERT INTO session(profile_id, text_id, pace_level, help_stage, started_at, finished_at, draft, final, "
                 "result_json, score, catch_rate) VALUES (1, 1, 2, 3, 'a', 'b', 'x', 'y', '{}', 40, 0.5)")
    conn.execute("INSERT INTO profile_stat(profile_id, category, occurrences, errors_in_draft, caught, missed, updated_at) "
                 "VALUES (1, 'homophone', 5, 2, 1, 1, 'now')")
    conn.execute("INSERT INTO profile_stat_day(profile_id, day, category, occurrences) VALUES (1, '2026-09-01', 'homophone', 5)")
    conn.commit()
    assert migrate(conn) >= 5
    s = conn.execute("SELECT help_stage, score, aids FROM session").fetchone()
    assert (s["help_stage"], s["score"], s["aids"]) == (3, 40, None)
    assert conn.execute("SELECT help_stage FROM profile").fetchone()[0] == 3        # the column stays
    assert conn.execute("SELECT introduced FROM profile_stat").fetchone()[0] == 0
    assert conn.execute("SELECT introduced FROM profile_stat_day").fetchone()[0] == 0
```

Append to `server/tests/test_sessions.py` (add `import json, sqlite3` and `from pytest import approx` and `from app.db import DB_FILENAME` at the top):

```python
def body_for(p, t, **kw):
    """Sub-project 1: a session body as today's client sends it (no help stage, no score)."""
    body = {"profile_id": p["id"], "text_id": t["id"], "pace_level": 2, "started_at": "2026-09-23T10:00:00+00:00",
            "draft": "x", "final": "y", "result": result(0.5), "catch_rate": 0.5}
    body.update(kw)
    return body


def test_a_session_records_the_aids_taken_and_the_hero_keeps_them(client, settings):
    p, t = setup(client)
    r = client.post("/api/sessions", json=body_for(p, t, aids=["palamede", "argus"]))
    assert r.status_code == 201, r.text
    assert client.get(f"/api/profiles/{p['id']}").json()["settings"]["aids"] == ["argus", "palamede"]
    conn = sqlite3.connect(settings.data_dir / DB_FILENAME)
    assert json.loads(conn.execute("SELECT aids FROM session WHERE id = ?", (r.json()["id"],)).fetchone()[0]) == ["argus", "palamede"]
    conn.close()
    assert client.post("/api/sessions", json=body_for(p, t, aids=[])).status_code == 201
    assert client.get(f"/api/profiles/{p['id']}").json()["settings"]["aids"] == []


def test_unknown_or_repeated_aids_are_refused(client):
    p, t = setup(client)
    for aids in (["argus", "argus"], ["loupe"], "argus"):
        assert client.post("/api/sessions", json=body_for(p, t, aids=aids)).status_code == 422, aids


def test_a_page_opened_before_the_aids_still_saves_its_session(client, settings):
    p, t = setup(client)
    client.patch(f"/api/profiles/{p['id']}", json={"settings": {"aids": ["ariane"]}})
    r = client.post("/api/sessions", json=body_for(p, t, help_stage=3, score=120))
    assert r.status_code == 201, r.text
    assert client.get(f"/api/profiles/{p['id']}").json()["settings"]["aids"] == ["ariane"]
    conn = sqlite3.connect(settings.data_dir / DB_FILENAME)
    assert conn.execute("SELECT aids FROM session WHERE id = ?", (r.json()["id"],)).fetchone()[0] is None
    conn.close()


def test_recent_sessions_carry_the_aids_and_the_mistakes_left_per_100(client):
    p, t = setup(client)
    client.post("/api/sessions", json=body_for(p, t, aids=["athena"]))
    client.post("/api/sessions", json=body_for(p, t, help_stage=1, score=5))
    recent = client.get(f"/api/profiles/{p['id']}/stats").json()["recent_sessions"]
    # result(): one mistake left in 13 words
    assert [(s["aids"], s["per_100"]) for s in recent] == [(None, approx(100 / 13)), (["athena"], approx(100 / 13))]


def test_the_stats_keep_the_mistakes_introduced_while_proofreading(client, settings):
    p, t = setup(client)
    res = result(0.5)
    res["byCategory"]["agreement:verb"]["introduced"] = 2
    assert client.post("/api/sessions", json=body_for(p, t, result=res)).status_code == 201
    conn = sqlite3.connect(settings.data_dir / DB_FILENAME)
    assert conn.execute("SELECT introduced FROM profile_stat WHERE category = 'agreement:verb'").fetchone()[0] == 2
    assert conn.execute("SELECT introduced FROM profile_stat_day WHERE category = 'agreement:verb'").fetchone()[0] == 2
    conn.close()
```

- [ ] **Step 4: Run them to see them fail**

Run: `scripts/pytest.sh -q tests/test_rules.py tests/test_measures.py tests/test_db.py tests/test_sessions.py`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.rules'` / `app.world.measures`, `no such column: aids`, 422 on a body without `help_stage`.

- [ ] **Step 5: Write `server/app/rules.py`**

```python
"""The game's tunable rules (spec 2026-09-29 §7): `regles.json` in the game's data folder (the NAS's
`./data`), read once at start-up. Every key is optional: a missing key keeps its built-in default,
and a malformed file or a value of the wrong type is logged and ignored, so a typo never stops the
game. GET /api/world serves them to the client (the copy line, the bonuses, the owl's hints)."""
from __future__ import annotations
import json
import logging
import math
from dataclasses import asdict, dataclass, field, replace
from pathlib import Path
from typing import Any, Callable

RULES_FILENAME = "regles.json"
PACES = ("1", "2", "3")
log = logging.getLogger("uvicorn.error")


def _default_pace_bonus() -> dict[str, float]:
    return {"1": 0.0, "2": 0.25, "3": 0.5}


@dataclass(frozen=True)
class Rules:
    quest_min_chances: int = 3
    quest_min_correct: float = 0.85
    fight_max_per_100: float = 4.0
    copy_belle_max_per_100: float = 2.0
    copy_correcte_max_per_100: float = 8.0
    aid_bonus: float = 0.20
    pace_bonus: dict[str, float] = field(default_factory=_default_pace_bonus)
    prophecy_bonus: float = 0.5
    chouette_hints: int = 3

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def _count(v: Any) -> bool:
    # bool is an int in Python: « true » is not a count.
    return isinstance(v, int) and not isinstance(v, bool) and v >= 0


def _number(v: Any) -> bool:
    # json.loads accepts NaN and Infinity: neither is a threshold.
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) and v >= 0


def _share(v: Any) -> bool:
    return _number(v) and v <= 1


CHECKS: dict[str, tuple[Callable[[Any], bool], Callable[[Any], Any]]] = {
    "quest_min_chances": (_count, int),
    "quest_min_correct": (_share, float),
    "fight_max_per_100": (_number, float),
    "copy_belle_max_per_100": (_number, float),
    "copy_correcte_max_per_100": (_number, float),
    "aid_bonus": (_number, float),
    "prophecy_bonus": (_number, float),
    "chouette_hints": (_count, int),
}


def _pace_bonus(raw: Any, path: Path) -> dict[str, float] | None:
    if not isinstance(raw, dict):
        log.warning('%s: pace_bonus must be an object like {"2": 0.25}; the built-in one applies', path)
        return None
    out = _default_pace_bonus()
    for pace, value in raw.items():
        if pace not in PACES or not _number(value):
            log.warning("%s: pace_bonus[%r] = %r is ignored (paces 1 to 3, a number >= 0)", path, pace, value)
            continue
        out[pace] = float(value)
    return out


def load_rules(data_dir: Path) -> Rules:
    path = data_dir / RULES_FILENAME
    if not path.is_file():
        return Rules()
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, ValueError) as e:
        log.warning("%s is unreadable (%s): the built-in rules apply", path, e)
        return Rules()
    if not isinstance(raw, dict):
        log.warning("%s must hold a JSON object: the built-in rules apply", path)
        return Rules()
    values: dict[str, Any] = {}
    for key, value in raw.items():
        if key == "pace_bonus":
            pace = _pace_bonus(value, path)
            if pace is not None:
                values[key] = pace
        elif key in CHECKS:
            ok, cast = CHECKS[key]
            if ok(value):
                values[key] = cast(value)
            else:
                log.warning("%s: %s = %r is ignored (wrong type or out of range); its default applies", path, key, value)
        else:
            log.warning("%s: unknown key %r is ignored", path, key)
    return replace(Rules(), **values)
```

- [ ] **Step 6: Write `server/app/world/measures.py`**

```python
"""The two measures of a copy (spec 2026-09-29 §1). Per lieutenant: the chances the text gave it and
the mistakes of its kind left in the handed-in copy. For the whole text: the mistakes left per 100
words, every category counted (accents, capitals, punctuation included), as a teacher counts."""
from __future__ import annotations


def lieutenant_measure(by_category: dict, categories: list[str]) -> dict:
    """chances = opportunities and left = missed + introduced, summed over the lieutenant's categories
    (the derived `derived:sirenes` / `derived:lethe` included); correct = (chances - left) / chances,
    None when the text gave it no chance."""
    chances = left = 0
    for c in categories:
        row = by_category.get(c) or {}
        chances += int(row.get("opportunities", 0) or 0)
        left += int(row.get("missed", 0) or 0) + int(row.get("introduced", 0) or 0)
    return {"chances": chances, "left": left, "correct": (chances - left) / chances if chances > 0 else None}


def mistakes_per_100(result: dict) -> float:
    """100 × finalErrors ÷ totalWords; 0 for a result without words (never a division by zero)."""
    words = int(result.get("totalWords", 0) or 0)
    return 100 * len(result.get("finalErrors") or []) / words if words > 0 else 0.0
```

- [ ] **Step 7: Write migration `server/app/migrations/005_aids.sql`**

```sql
-- Sub-project 1 (spec 2026-09-29 §8): the review aids taken for each session, and the mistakes
-- introduced while proofreading, per category. Nothing is dropped: help_stage stays on profile and
-- session (new sessions write 0).
ALTER TABLE session ADD COLUMN aids TEXT;   -- JSON list of the aids taken; NULL before sub-project 1
ALTER TABLE profile_stat ADD COLUMN introduced INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profile_stat_day ADD COLUMN introduced INTEGER NOT NULL DEFAULT 0;
```

- [ ] **Step 8: Wire the rules into the app**

`server/app/main.py`: add `from app.rules import load_rules` next to the other `app.` imports, and in the lifespan, right after `settings.data_dir.mkdir(parents=True, exist_ok=True)`:

```python
        # Spec 2026-09-29 §7: data/regles.json, read once here; a changed file needs a restart.
        app.state.rules = load_rules(settings.data_dir)
```

`server/app/routers/world.py`: import `Request` (`from fastapi import APIRouter, Depends, HTTPException, Request, Response`) and give `get_world` the rules:

```python
@router.get("/world")
def get_world(request: Request):
    return {
        "lieutenants": [{"key": k, **LIEUTENANTS[k]} for k in LIEUTENANT_ORDER],
        "rewards": REWARDS,
        "ranks": [{"xp": xp, "title": t} for xp, t in RANKS],
        "tints": TINTS,
        "oracle_rewards": ORACLE_REWARDS,
        "boss_rewards": {str(k): v for k, v in BOSS_REWARDS.items()},
        "mastery": MASTERY,
        "quest_bonus": QUEST_BONUS,
        # Spec 2026-09-29 §7: what the client needs of the rules file (the copy line, the bonuses, the owl).
        "rules": request.app.state.rules.as_dict(),
    }
```

- [ ] **Step 9: `introduced` in the stats** — `server/app/stats.py`, replace `apply_session_to_stats`:

```python
def apply_session_to_stats(conn: sqlite3.Connection, profile_id: int, result: dict, day: str, now: str) -> None:
    for key, c in result.get("byCategory", {}).items():
        vals = (c.get("opportunities", 0), c.get("draft", 0), c.get("caught", 0), c.get("missed", 0), c.get("introduced", 0))
        conn.execute("""INSERT INTO profile_stat(profile_id, category, occurrences, errors_in_draft, caught, missed, introduced, updated_at)
                        VALUES (?,?,?,?,?,?,?,?)
                        ON CONFLICT(profile_id, category) DO UPDATE SET
                          occurrences = occurrences + excluded.occurrences,
                          errors_in_draft = errors_in_draft + excluded.errors_in_draft,
                          caught = caught + excluded.caught, missed = missed + excluded.missed,
                          introduced = introduced + excluded.introduced,
                          updated_at = excluded.updated_at""", (profile_id, key, *vals, now))
        conn.execute("""INSERT INTO profile_stat_day(profile_id, day, category, occurrences, errors_in_draft, caught, missed, introduced)
                        VALUES (?,?,?,?,?,?,?,?)
                        ON CONFLICT(profile_id, day, category) DO UPDATE SET
                          occurrences = occurrences + excluded.occurrences,
                          errors_in_draft = errors_in_draft + excluded.errors_in_draft,
                          caught = caught + excluded.caught, missed = missed + excluded.missed,
                          introduced = introduced + excluded.introduced""",
                     (profile_id, day, key, *vals))
```

- [ ] **Step 10: `SessionCreate`** — `server/app/schemas.py`: add after `PIN_RE`:

```python
# Spec 2026-09-29 §3: the five review aids, in the camp's order.
AID_KEYS = ("argus", "ariane", "persee", "athena", "palamede")
```

and replace `SessionCreate` with:

```python
class SessionCreate(BaseModel):
    profile_id: int
    text_id: int
    # 1-3 since the pace redesign (2026-09-27); 4, the retired pace, stays valid for a page opened
    # before it (its session is not lost), as the rows recorded at 4 stay in the history and stats.
    pace_level: int = Field(ge=1, le=4)
    # Sub-project 1 removed the adaptive help stage and the client-side score: a page opened before
    # the change still sends them, accepted and ignored (the session's score is its XP, server-side).
    help_stage: int | None = None
    mode: Literal["dictation", "grimoire"] = "dictation"
    started_at: str
    draft: str
    final: str
    result: dict[str, Any]
    score: int | None = None
    catch_rate: float | None = Field(default=None, ge=0, le=1)
    encounter: str | None = None
    quest_id: int | None = None
    # The review aids taken along (spec 2026-09-29 §3); None from a page opened before them.
    aids: list[str] | None = None

    @field_validator("aids")
    @classmethod
    def _aids(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return v
        if any(a not in AID_KEYS for a in v):
            raise ValueError("unknown aid")
        if len(set(v)) != len(v):
            raise ValueError("an aid listed twice")
        return [a for a in AID_KEYS if a in v]
```

- [ ] **Step 11: Store and remember the aids** — `server/app/routers/sessions.py`: replace the `INSERT` and add the remembered choice right after `session_id = cur.lastrowid`:

```python
    cur = db.execute(
        """INSERT INTO session(profile_id, text_id, pace_level, help_stage, mode, started_at, finished_at,
                                draft, final, result_json, score, catch_rate, encounter, quest_id, aids)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (body.profile_id, body.text_id, body.pace_level, body.help_stage or 0, body.mode, body.started_at, finished_at,
         body.draft, body.final, json.dumps(body.result, ensure_ascii=False), body.score or 0, body.catch_rate,
         body.encounter, body.quest_id, json.dumps(body.aids) if body.aids is not None else None))
    session_id = cur.lastrowid

    # Spec 2026-09-29 §3: the hero's choice of aids is remembered and pre-selected next time (plan
    # Ruling R1: written with the session; a page opened before the aids leaves it alone).
    if body.aids is not None:
        remembered = {**json.loads(profile["settings_json"] or "{}"), "aids": body.aids}
        db.execute("UPDATE profile SET settings_json = ? WHERE id = ?", (json.dumps(remembered, ensure_ascii=False), body.profile_id))
```

(The help-stage block below it keeps running until Task 4.)

- [ ] **Step 12: The recent sessions' aids and copy measure** — `server/app/routers/stats.py`: add `import json` and `from app.world.measures import mistakes_per_100`, and replace the `recent_sessions` query:

```python
    # Spec 2026-09-29 §3: the muster's suggestion reads each defence's aids and its copy.
    recent_sessions = []
    for r in db.execute(
            "SELECT s.id, s.text_id, t.title, s.finished_at, s.score, s.catch_rate, s.pace_level, s.help_stage, s.mode, "
            "s.aids, s.result_json FROM session s JOIN text t ON t.id = s.text_id WHERE s.profile_id = ? "
            "ORDER BY s.finished_at DESC, s.id DESC LIMIT 20", (profile_id,)):
        row = dict(r)
        result = json.loads(row.pop("result_json") or "{}")
        row["aids"] = json.loads(row["aids"]) if row["aids"] is not None else None
        row["per_100"] = mistakes_per_100(result) if int(result.get("totalWords", 0) or 0) > 0 else None
        recent_sessions.append(row)
```

- [ ] **Step 13: e2e helper** — `web/e2e/helpers.ts` `postSession`: add `aids?: string[]` to the options type and `aids: o.aids,` to `data` (after `encounter: o.encounter,`).

- [ ] **Step 14: Run the tests**

Run: `scripts/pytest.sh -q` then `scripts/npm.sh run check`
Expected: every server test passes (the new ones included), `0 errors and 0 warnings`, tsc silent.

- [ ] **Step 15: Commit**

```bash
git add server/app/rules.py server/app/world/measures.py server/app/migrations/005_aids.sql server/app/main.py server/app/stats.py server/app/schemas.py server/app/routers/sessions.py server/app/routers/stats.py server/app/routers/world.py server/tests/test_rules.py server/tests/test_measures.py server/tests/test_db.py server/tests/test_sessions.py web/e2e/helpers.ts
git commit -m "Server: the rules file (data/regles.json), the two measures of a copy, migration 005 (session aids, introduced), the aids of a session stored and remembered

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- server/app/rules.py server/app/world/measures.py server/app/migrations/005_aids.sql server/app/main.py server/app/stats.py server/app/schemas.py server/app/routers/sessions.py server/app/routers/stats.py server/app/routers/world.py server/tests/test_rules.py server/tests/test_measures.py server/tests/test_db.py server/tests/test_sessions.py web/e2e/helpers.ts
```

---

### Task 2: Server rules of the game — quests, the fight, XP and its parts

**Files:**
- Modify: `server/app/world/quests.py` (verdicts), `server/app/world/xp.py` (formula, parts), `server/app/world/progression.py` (`apply_progression`), `server/app/routers/sessions.py` (rules passed, XP in `score`), `server/app/routers/world.py` (quest goals, `quest_out`)
- Test: `server/tests/test_world_rules.py`, `server/tests/test_progression.py`, `server/tests/test_world_api.py`, `server/tests/test_sessions.py`
- Modify: `web/e2e/helpers.ts` (`makeResult` gains `left`), `web/e2e/world.spec.ts` (step 7)

**Interfaces:**
- Consumes: `Rules`, `app.state.rules` (Task 1); `lieutenant_measure`, `mistakes_per_100` (Task 1); `AID_KEYS` (Task 1).
- Produces:
  - `app.world.quests.session_counts_for(by_category: dict, categories: list[str], rules: Rules) -> bool`; `fight_won(result: dict, rules: Rules) -> bool`. `lieutenant_totals`, `evaluate_boss`, `MIN_OPPORTUNITIES*` are removed.
  - `app.world.xp`: `@dataclass(frozen=True) class SessionXp: total: int; parts: dict[str, int]` (keys `text`, `pace`, `aids`, `prophecy`); `pace_bonus(pace_level: int, mode: str, rules: Rules) -> float`; `session_xp(result: dict, pace_level: int, mode: str, prophecy: bool, aids_left: int, rules: Rules) -> SessionXp`. `PACE_MULT` is removed.
  - `apply_progression(conn, profile, session_id, body, result, day, now, prophecy, rules)`; its return's `xp` gains `"parts"`; `boss` becomes `{"tier": int, "won": bool}`.
  - `quest_out` never returns the legacy goal keys `min_rate`, `min_draft`, `mode`, `help_stage`. New board/Oracle goals are `{"sessions": 3, "texts": [...]}`; new boss goals `{"tier", "text_id", "help_stage"}` (`help_stage` leaves in Task 4).
  - `session.score` holds the session XP.
  - e2e: `makeResult({ …, left?: number })` (`finalErrors` has `left` entries, default `draft - caught`).

- [ ] **Step 1: Write the failing rule tests** — in `server/tests/test_world_rules.py` replace the imports of `session_xp` and of `quests` and the tests `test_session_xp`, `test_lieutenant_totals_and_session_counts`, `test_session_counts_for_p1_4_farming_rule`, `test_evaluate_boss` (and the `result` helper they used) with:

```python
from app.rules import Rules
from app.world.xp import rank_for, session_xp
from app.world.quests import density, fight_won, recommend_texts, session_counts_for

R = Rules()
ODD = Rules(aid_bonus=0.33, pace_bonus={"1": 0.1, "2": 0.37, "3": 0.71}, prophecy_bonus=0.29)


def xp_result(words=150, left=3, caught=4):
    return {"totalWords": words, "finalErrors": [{}] * left, "caught": [{}] * caught}


def test_session_xp_the_worked_example():
    # Spec §4: 150 words, 3 mistakes left (m = 2), 4 caught, pace 2, two aids left:
    # effort 25, accuracy 24, rereading 8, bonus 65 % -> 25 + 32 × 1.65 = 78 XP.
    xp = session_xp(xp_result(), 2, "dictation", False, 2, R)
    assert xp.total == 78
    assert xp.parts == {"text": 57, "pace": 8, "aids": 13, "prophecy": 0}


def test_a_stale_pace_4_pays_as_pace_3_and_the_grimoire_has_no_pace_bonus():
    three = session_xp(xp_result(), 3, "dictation", False, 0, R)
    assert session_xp(xp_result(), 4, "dictation", False, 0, R) == three
    assert three.total == 73 and three.parts == {"text": 57, "pace": 16, "aids": 0, "prophecy": 0}
    grimoire = session_xp(xp_result(), 3, "grimoire", False, 0, R)
    assert grimoire.total == 57 and grimoire.parts["pace"] == 0


def test_the_prophecy_adds_its_bonus():
    xp = session_xp(xp_result(), 1, "dictation", True, 0, R)
    assert xp.total == 73 and xp.parts == {"text": 57, "pace": 0, "aids": 0, "prophecy": 16}


def test_the_bonus_never_multiplies_the_effort():
    # 15 left of 150 words is m = 10: no accuracy left, only the rereading takes the bonus.
    xp = session_xp(xp_result(left=15), 3, "dictation", True, 5, R)
    assert xp.total == 25 + 8 * 3 and xp.parts == {"text": 33, "pace": 4, "aids": 8, "prophecy": 4}
    bare = session_xp(xp_result(left=15, caught=0), 3, "dictation", True, 5, R)
    assert bare.total == 25 and bare.parts == {"text": 25, "pace": 0, "aids": 0, "prophecy": 0}


def test_the_parts_always_add_up_to_the_session_xp():
    for rules in (R, ODD):
        for words in (0, 7, 13, 120, 151, 333):
            for left in (0, 1, 4, 9):
                for caught in (0, 1, 5):
                    for pace in (1, 2, 3, 4):
                        for mode in ("dictation", "grimoire"):
                            for prophecy in (False, True):
                                for aids_left in range(6):
                                    xp = session_xp(xp_result(words, left, caught), pace, mode, prophecy, aids_left, rules)
                                    case = (words, left, caught, pace, mode, prophecy, aids_left)
                                    assert sum(xp.parts.values()) == xp.total, case
                                    assert min(xp.parts.values()) >= 0, case


def test_a_quest_session_counts_on_the_final_text():
    def bc(opportunities, missed=0, introduced=0):
        return {"homophone": {"opportunities": opportunities, "draft": 5, "caught": 5 - missed, "missed": missed, "introduced": introduced}}

    assert session_counts_for(bc(3), ["homophone"], R) is True                        # 3 chances, all right
    assert session_counts_for(bc(2), ["homophone"], R) is False                       # too few chances
    assert session_counts_for(bc(20, missed=3), ["homophone"], R) is True             # 85 % exactly
    assert session_counts_for(bc(20, missed=2, introduced=2), ["homophone"], R) is False   # 80 %: introduced count too
    assert session_counts_for({}, ["homophone"], R) is False
    assert session_counts_for(bc(3), ["homophone"], Rules(quest_min_chances=4)) is False
    assert session_counts_for(bc(20, missed=3), ["homophone"], Rules(quest_min_correct=0.9)) is False


def test_a_fight_is_won_on_the_whole_text():
    assert fight_won({"totalWords": 100, "finalErrors": [{}] * 4}, R) is True
    assert fight_won({"totalWords": 100, "finalErrors": [{}] * 5}, R) is False
    assert fight_won({"totalWords": 150, "finalErrors": [], "draftErrors": []}, R) is True    # a clean copy simply wins
    assert fight_won({"totalWords": 100, "finalErrors": [{}] * 4}, Rules(fight_max_per_100=3)) is False
```

Check the expected numbers by hand before running: pace 3, 0 aids: 25 + 32 × 1.5 = 73, text 57, the remaining 16 all to pace. Prophecy alone: the same 73, 16 to prophecy. m = 10: base 8, bonus 0.5 + 1.0 + 0.5 = 2.0, 25 + 24 = 49, text 33, the 16 shared 4 / 8 / 4.

- [ ] **Step 2: Write the failing flow tests**

`server/tests/test_progression.py`: give `hydre_result` the mistakes left in the copy (add the `left` parameter and the `finalErrors` line):

```python
def hydre_result(draft=4, caught=4, words=120, left=0):
    r = make_result()                       # SP1 helper returns a valid SessionResult dict
    r["totalWords"] = words; r["draftErrors"] = [{}] * draft; r["caught"] = [{}] * caught
    r["finalErrors"] = [{}] * left
    r["catchRate"] = caught / draft if draft else None
    r["byCategory"] = {"agreement:verb": {"opportunities": 10, "draft": draft, "caught": caught, "missed": draft - caught, "introduced": 0}}
    return r
```

Replace the XP expectations (hydre_result: 120 words, 0 left, 4 caught, pace 1: effort 22, accuracy 24, rereading 8):
- `test_session_grants_xp_and_reports_rank`: `assert p["xp"]["session"] == 22 + 24 + 8 and p["xp"]["parts"] == {"text": 54, "pace": 0, "aids": 0, "prophecy": 0} and p["xp"]["total_after"] == p["xp"]["session"]`.
- `test_prophecy_bonus_applies_strictly_before_the_due_date`: `on_due_date["xp"]["session"] == 54` (no bonus) and `before_due_date["xp"]["session"] == 70` (22 + 32 × 1.5).

Add to `server/tests/test_progression.py`:

```python
def test_the_aids_left_at_the_camp_pay_their_bonus(client):
    pid = make_profile(client, level="10H"); tid = make_text(client)
    p = post(client, pid, tid, hydre_result(), aids=["argus", "ariane", "persee"])["progression"]
    assert p["xp"]["session"] == 22 + round(32 * 1.4) and p["xp"]["parts"]["aids"] == 13


def test_quests_created_before_the_new_rule_are_judged_by_it(client, settings):
    pid = make_profile(client, level="10H"); tid = make_text(client)
    q = client.post(f"/api/profiles/{pid}/quests", json={"target": "hydre"}).json()
    conn = sqlite3.connect(settings.data_dir / DB_FILENAME)
    conn.execute("UPDATE quest SET goal_json = ? WHERE id = ?", (json.dumps({"sessions": 3, "min_rate": 0.9, "texts": []}), q["id"]))
    conn.commit(); conn.close()
    # Caught 1 of 2 (the old rule's rate 0.5 < 0.9), but 9 of 10 chances right in the copy (0.9 >= 0.85).
    p = post(client, pid, tid, hydre_result(draft=2, caught=1))["progression"]
    assert next(x for x in p["quests"] if x["target"] == "hydre")["counted"] is True
    assert client.get(f"/api/profiles/{pid}/quests?status=active").json()[0]["goal"] == {"sessions": 3}


def test_the_session_keeps_its_xp_as_its_score(client):
    pid = make_profile(client, level="10H"); tid = make_text(client)
    xp = post(client, pid, tid, hydre_result())["progression"]["xp"]["session"]
    history = next(t for t in client.get(f"/api/texts?profile_id={pid}").json() if t["id"] == tid)["history"]
    assert history["best_score"] == xp
```

(add `import sqlite3` and `from app.db import DB_FILENAME` to its imports; `post()` passes extra keys straight into the body, so `aids=` works; `GET /api/texts?profile_id=` attaches each text's `history`, as `test_session_updates_stats_history_and_trap_words` already uses.)

In `server/tests/test_sessions.py`, `test_session_updates_stats_history_and_trap_words` pins `score` 100: replace those two assertions by the session's XP (`session["progression"]["xp"]["session"]` for `totals.score` and `best_score`).

In `server/tests/test_world_api.py`:
- `test_board_quest_lifecycle`: `q.json()["goal"] == {"sessions": 3}`.
- `test_boss_flow`: replace everything from the `lost = post(...)` line through the `won` assertion with:

```python
    # Spec 2026-09-29 §2: the fight is judged on the copy. 6 mistakes left in 120 words (5 per 100) lose.
    lost = post(client, pid, long_text, hydre_result(draft=6, caught=0, left=6), quest_id=b["quest"]["id"], encounter="eris")["progression"]
    assert lost["boss"] == {"tier": 1, "won": False}
    assert client.get(f"/api/profiles/{pid}/quests?status=active").json()[0]["kind"] == "boss"     # nothing lost
    # A quest stored before the change (an old "too easy" draw flagged it for the Grimoire) is judged
    # by the new rule, and its legacy keys never reach the client.
    conn = sqlite3.connect(settings.data_dir / DB_FILENAME)
    legacy = {"tier": 1, "min_rate": 0.7, "min_draft": 3, "text_id": long_text, "help_stage": 3, "mode": "grimoire"}
    conn.execute("UPDATE quest SET goal_json = ? WHERE id = ?", (json.dumps(legacy), b["quest"]["id"]))
    conn.commit(); conn.close()
    assert client.post(f"/api/profiles/{pid}/boss").json()["quest"]["goal"] == {"tier": 1, "text_id": long_text}
    # A clean copy simply wins: no more "too easy" draw, even with nothing caught.
    won = post(client, pid, long_text, hydre_result(draft=0, caught=0), quest_id=b["quest"]["id"], encounter="eris")["progression"]
    assert won["boss"] == {"tier": 1, "won": True} and [r["id"] for r in won["rewards"]] == ["sandales_hermes"]
```

(`test_boss_flow` gains the `settings` fixture; `sqlite3`, `json` and `DB_FILENAME` are already imported there.)

- [ ] **Step 3: Run them to see them fail**

Run: `scripts/pytest.sh -q tests/test_world_rules.py tests/test_progression.py tests/test_world_api.py tests/test_sessions.py`
Expected: FAIL — `ImportError: cannot import name 'fight_won'`, `session_xp()` arity, `parts` missing.

- [ ] **Step 4: The verdicts** — `server/app/world/quests.py`: delete `lieutenant_totals`, the P1-4 comment block, `MIN_OPPORTUNITIES`, `MIN_OPPORTUNITIES_WITHOUT_ERROR`, `session_counts_for` and `evaluate_boss`, and put in their place:

```python
from app.rules import Rules
from app.world.measures import lieutenant_measure, mistakes_per_100


def session_counts_for(by_category: dict, categories: list[str], rules: Rules) -> bool:
    """Spec 2026-09-29 §2: a quest session (board or Oracle) counts when the text gave the target
    lieutenant enough chances and its correct share of the handed-in copy is high enough. Active
    quests created before the change are judged by this rule too (their stored min_rate is ignored)."""
    m = lieutenant_measure(by_category, categories)
    return m["chances"] >= rules.quest_min_chances and m["correct"] is not None and m["correct"] >= rules.quest_min_correct


def fight_won(result: dict, rules: Rules) -> bool:
    """Spec 2026-09-29 §2: an Éris fight is won on the whole copy, at most `fight_max_per_100` mistakes
    left per 100 words. A clean copy simply wins (the old "too easy" draw is gone)."""
    return mistakes_per_100(result) <= rules.fight_max_per_100
```

- [ ] **Step 5: The XP** — replace the body of `server/app/world/xp.py` above `rank_for` with:

```python
"""XP from the copy, the rereading and the bonuses (spec 2026-09-29 §4)."""
from __future__ import annotations
from dataclasses import dataclass
from app.rules import Rules
from app.world.catalog import RANKS
from app.world.measures import mistakes_per_100


def _half_up(x: float) -> int:
    return int(x + 0.5)


@dataclass(frozen=True)
class SessionXp:
    total: int
    # The victory's chips (spec §4): `text` = effort + accuracy + rereading, then each bonus's share of
    # the multiplied part; they always add up to `total`.
    parts: dict[str, int]


def pace_bonus(pace_level: int, mode: str, rules: Rules) -> float:
    """The pace's bonus; the retired pace 4 (a stale page) counts as 3; the Grimoire has none."""
    if mode == "grimoire":
        return 0.0
    return rules.pace_bonus.get(str(min(3, max(1, pace_level))), 0.0)


def _split(amount: int, weights: dict[str, float]) -> dict[str, int]:
    """`amount` shared out in proportion to `weights` by largest remainders (ties in key order), so
    the shares sum to it exactly."""
    total = sum(weights.values())
    if amount <= 0 or total <= 0:
        return {k: 0 for k in weights}
    exact = {k: amount * w / total for k, w in weights.items()}
    shares = {k: int(x) for k, x in exact.items()}
    keys = list(weights)
    order = sorted(keys, key=lambda k: (-(exact[k] - shares[k]), keys.index(k)))
    for k in order[: amount - sum(shares.values())]:
        shares[k] += 1
    return shares


def session_xp(result: dict, pace_level: int, mode: str, prophecy: bool, aids_left: int, rules: Rules) -> SessionXp:
    words = int(result.get("totalWords", 0) or 0)
    m = mistakes_per_100(result)
    effort = 10 + words / 10
    accuracy = (words / 5) * max(0.0, 1 - m / 10)
    rereading = 2 * len(result.get("caught") or [])
    base = accuracy + rereading
    bonuses = {"pace": pace_bonus(pace_level, mode, rules), "aids": rules.aid_bonus * aids_left,
               "prophecy": rules.prophecy_bonus if prophecy else 0.0}
    total = _half_up(effort + base * (1 + sum(bonuses.values())))
    text = _half_up(effort + base)
    return SessionXp(total, {"text": text, **_split(total - text, {k: base * b for k, b in bonuses.items()})})
```

Keep `rank_for` below it unchanged.

- [ ] **Step 6: The progression** — `server/app/world/progression.py`:
  - imports: `from app.rules import Rules`, `from app.schemas import AID_KEYS`, `from app.world.quests import fight_won, session_counts_for` (drop `evaluate_boss`).
  - signature: `def apply_progression(conn, profile, session_id, body, result, day, now, prophecy, rules: Rules) -> dict:`
  - the session XP:

```python
    # 1. session XP (spec 2026-09-29 §4): a page opened before the aids sends none, and leaves none.
    aids = getattr(body, "aids", None)
    aids_left = len(AID_KEYS) - len(aids) if aids is not None else 0
    xp = session_xp(result, body.pace_level, mode, prophecy, aids_left, rules)
    add_xp(conn, pid, xp.total, "session", now, session_id=session_id, week=week)
```

  - the boss branch, replacing everything from `outcome = evaluate_boss(...)` to the `if outcome == "too_easy"` block included:

```python
            won = fight_won(result, rules)
            progress["log"].append({"session_id": session_id, "ok": won})
            boss_out = {"tier": goal["tier"], "won": won}
```

  - the quest count: `ok = session_counts_for(by_cat, cats, rules)`.
  - the return: `"xp": {"session": xp.total, "parts": xp.parts, "bonuses": bonuses, …}` (the other keys unchanged).

- [ ] **Step 7: The router** — `server/app/routers/sessions.py`: `rules = request.app.state.rules` next to `settings = …`; pass `rules` as the last argument of `apply_progression`; after it, before `db.commit()`:

```python
    # Spec 2026-09-29 §4: the session's score is its XP, so the history and the library's best scores
    # keep a meaningful number.
    db.execute("UPDATE session SET score = ? WHERE id = ?", (progression["xp"]["session"], session_id))
```

- [ ] **Step 8: Quest goals** — `server/app/routers/world.py`:
  - `create_board_quest` and `consult`: `goal = {"sessions": 3, "texts": texts}`.
  - `create_boss_quest`: `goal = {"tier": tier, "text_id": text_id, "help_stage": help_stage}`.
  - `quest_out`, after `texts = goal.pop("texts", [])`:

```python
    # Keys of goals stored before sub-project 1: the rule no longer reads them (spec 2026-09-29 §2).
    for legacy in ("min_rate", "min_draft", "mode", "help_stage"):
        goal.pop(legacy, None)
```

- [ ] **Step 9: Run the server tests**

Run: `scripts/pytest.sh -q`
Expected: all pass. Fix every other test that pinned an old number (catch-rate quests, `score`, `too_easy`) by the new rule, never by loosening it.

- [ ] **Step 10: The e2e boss flow** — `web/e2e/helpers.ts` `makeResult`: add `left?: number` to its options, `const left = o.left ?? draft - caught;` and `finalErrors: Array(left).fill(draftError),`.

`web/e2e/world.spec.ts` step 7 (`'7. boss unlocks after two lieutenants; …'`): replace everything from the `// P1-5 follow-up (controller ruling): a perfect dictation …` comment through the `expect(won.progression.rewards…)` assertion with:

```ts
    // Spec 2026-09-29 §2: the fight is judged on the copy. 6 mistakes left in 120 words lose, and
    // nothing is lost: the quest stays active.
    const lost = await postSession(request, {
      profileId: Number(profileId),
      textId: bossTextId,
      day: today,
      result: makeResult({ words: 120, draft: 6, caught: 0, left: 6, category: 'agreement:verb' }),
      questId: bossQuest.id,
      encounter: 'eris',
    });
    expect(lost.progression.boss).toEqual({ tier: 1, won: false });
    const stillActive = await (await request.get(`/api/profiles/${profileId}/quests?status=active`)).json();
    expect(stillActive.some((q: { id: number }) => q.id === bossQuest.id)).toBe(true);

    // A clean copy simply wins (no more "too easy" draw): play the boss text for real, unmodified.
    const bossBody = ((await (await request.get(`/api/texts/${bossTextId}`)).json()) as { body: string }).body;
    await page.locator('[data-testid^="pace-option-"]:not(.disabled)').first().click();
    await page.getByRole('button', { name: 'Commencer la dictée' }).click();
    await dictate(page, bossBody);
    await page.getByTestId('btn-finish-writing').click();
    await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-phase', 'proofreading');
    await page.getByTestId('btn-done-proofreading').click();
    const confirm = page.getByRole('button', { name: 'Oui, valider' });
    await expect(confirm.or(page.getByTestId('victory-title'))).toBeVisible();
    if (await confirm.isVisible()) await confirm.click();
    await expect(page.getByTestId('reveal-boss-reward')).toHaveText("Ta récompense\u202f: Sandales d'Hermès\u202f!", { timeout: 15_000 });
    await page.getByTestId('reveal-continue').click();
```

Keep the cabin part after it. Then run every spec that posts sessions through the API, since the quest rule moved: `grep -ln "postSession(" web/e2e/*.spec.ts` (world, scenes-camp, scenes-cabin, scenes-delphi, scenes-library; the playability walks are not in the gate but their `makeResult` calls must still type-check). A step whose quest progress depended on a catch rate is rewritten to the new rule (a `makeResult` whose copy keeps the target's correct share ≥ 0.85 over its 10 chances, i.e. `draft - caught <= 1`).

Run: `STACK=prog scripts/playwright.sh world.spec.ts --repeat-each=3` then `STACK=prog scripts/playwright.sh scenes-camp scenes-cabin scenes-delphi scenes-library`
Expected: all pass.

- [ ] **Step 11: Type-check and commit**

Run: `scripts/npm.sh run check`
Expected: `0 errors and 0 warnings`, tsc silent.

```bash
git add server/app/world/quests.py server/app/world/xp.py server/app/world/progression.py server/app/routers/sessions.py server/app/routers/world.py server/tests/test_world_rules.py server/tests/test_progression.py server/tests/test_world_api.py server/tests/test_sessions.py web/e2e/helpers.ts web/e2e/world.spec.ts
git commit -m "Server: quests count on the final text, Éris fights are won on mistakes per 100 words, XP from the copy with its parts (text, pace, aids, prophecy), the session's XP as its score; the too-easy draw and its Grimoire switch go

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- server/app/world/quests.py server/app/world/xp.py server/app/world/progression.py server/app/routers/sessions.py server/app/routers/world.py server/tests/test_world_rules.py server/tests/test_progression.py server/tests/test_world_api.py server/tests/test_sessions.py web/e2e/helpers.ts web/e2e/world.spec.ts
```

(add any other spec file you had to change to both lists)

---

### Task 3: Client foundation — the rules and the aids

**Files:**
- Create: `web/src/lib/rules.ts`, `web/src/lib/rules.test.ts`, `web/src/lib/aids.ts`, `web/src/lib/aids.test.ts`
- Modify: `web/src/lib/world/types.ts` (`WorldCatalog.rules`, `Progression.xp.parts`), `web/src/lib/types.ts` (`ProfileSettings.aids`, `RecentSession.aids`/`per_100`)

**Interfaces:**
- Consumes: `GET /api/world`'s `rules` and `recent_sessions[].aids`/`per_100` (Task 1), `progression.xp.parts` (Task 2); `TOOL_ICONS` (`lib/world/art.ts`), `plural` (`lib/text/french.ts`), `todayIso` (`lib/dates.ts`).
- Produces:
  - `lib/rules.ts`: `interface GameRules { quest_min_chances: number; quest_min_correct: number; fight_max_per_100: number; copy_belle_max_per_100: number; copy_correcte_max_per_100: number; aid_bonus: number; pace_bonus: Record<'1' | '2' | '3', number>; prophecy_bonus: number; chouette_hints: number }`; `DEFAULT_RULES: GameRules`; `rulesOf(catalog: { rules?: GameRules } | null | undefined): GameRules`; `per100(mistakes: number, words: number): number`; `type CopyVerdict = 'belle' | 'correcte' | 'reprendre'`; `copyVerdict(per: number, rules): CopyVerdict`; `paceBonus(pace: number, mode: PlayMode, rules: GameRules): number`; `prophecyBonusApplies(dueDate: string | null, today?: Date): boolean`.
  - `lib/aids.ts`: `AID_KEYS` (`['argus', 'ariane', 'persee', 'athena', 'palamede'] as const`), `type AidKey`, `ALL_AIDS: readonly AidKey[]`, `SUGGEST_ORDER: readonly AidKey[]`, `AID_LABELS: Record<AidKey, { name: string; the: string; desc: string }>`, `isAidKey(k: unknown): k is AidKey`, `normalizeAids(raw: unknown): AidKey[]`, `aidDesc(key: AidKey, rules: GameRules): string`, `aidIcon(key: AidKey): string | null`, `bonusParts(o: { pace: number; mode: PlayMode; aids: readonly AidKey[]; prophecy: boolean }, rules: GameRules): { pace: number; aids: number; prophecy: number; total: number }`, `listFr(items: readonly string[]): string`, `interface RecentDefence { mode: string; aids: readonly string[] | null; per_100: number | null }`, `interface Suggestion { kind: 'leave' | 'take'; aid: AidKey }`, `suggestion(recent: readonly RecentDefence[], current: readonly AidKey[], rules: GameRules): Suggestion | null`.
  - Types: `WorldCatalog.rules: GameRules`; `Progression.xp.parts?: { text: number; pace: number; aids: number; prophecy: number }` (optional: a victory saved before the change has none); `ProfileSettings.aids?: string[]`; `RecentSession.aids: string[] | null`, `RecentSession.per_100: number | null`.

- [ ] **Step 1: Write the failing tests**

`web/src/lib/rules.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, copyVerdict, paceBonus, per100, prophecyBonusApplies, rulesOf } from './rules';

describe('the rules of the camp (spec 2026-09-29 §7)', () => {
  it('mirrors the server defaults', () => {
    expect(DEFAULT_RULES).toEqual({
      quest_min_chances: 3,
      quest_min_correct: 0.85,
      fight_max_per_100: 4,
      copy_belle_max_per_100: 2,
      copy_correcte_max_per_100: 8,
      aid_bonus: 0.2,
      pace_bonus: { '1': 0, '2': 0.25, '3': 0.5 },
      prophecy_bonus: 0.5,
      chouette_hints: 3,
    });
  });

  it("reads the server's rules from the world catalog, the defaults until it has come", () => {
    const served = { ...DEFAULT_RULES, chouette_hints: 1 };
    expect(rulesOf({ rules: served })).toBe(served);
    expect(rulesOf(null)).toBe(DEFAULT_RULES);
    expect(rulesOf({})).toBe(DEFAULT_RULES);
  });

  it('counts the mistakes left per 100 words, never dividing by zero', () => {
    expect(per100(3, 150)).toBe(2);
    expect(per100(0, 120)).toBe(0);
    expect(per100(4, 0)).toBe(0);
  });

  it('names the copy as a teacher would, the limits included', () => {
    expect(copyVerdict(0, DEFAULT_RULES)).toBe('belle');
    expect(copyVerdict(2, DEFAULT_RULES)).toBe('belle');
    expect(copyVerdict(2.5, DEFAULT_RULES)).toBe('correcte');
    expect(copyVerdict(8, DEFAULT_RULES)).toBe('correcte');
    expect(copyVerdict(8.1, DEFAULT_RULES)).toBe('reprendre');
    expect(copyVerdict(1, { ...DEFAULT_RULES, copy_belle_max_per_100: 0.5 })).toBe('correcte');
  });

  it('pays the pace bonus, a stale pace 4 as pace 3, never in the grimoire', () => {
    expect([1, 2, 3, 4].map((p) => paceBonus(p, 'dictation', DEFAULT_RULES))).toEqual([0, 0.25, 0.5, 0.5]);
    expect(paceBonus(3, 'grimoire', DEFAULT_RULES)).toBe(0);
  });

  it('pays the prophecy only before its day, as the server does', () => {
    const today = new Date(2026, 8, 29);
    expect(prophecyBonusApplies('2026-09-30', today)).toBe(true);
    expect(prophecyBonusApplies('2026-09-29', today)).toBe(false);
    expect(prophecyBonusApplies(null, today)).toBe(false);
  });
});
```

`web/src/lib/aids.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { AID_KEYS, AID_LABELS, SUGGEST_ORDER, aidDesc, aidIcon, bonusParts, listFr, normalizeAids, suggestion, type AidKey } from './aids';
import { DEFAULT_RULES as R } from './rules';

const ALL = [...AID_KEYS];
const NO_OWL: AidKey[] = ['argus', 'ariane', 'persee', 'palamede'];
const belle = (aids: string[] | null, mode = 'dictation') => ({ mode, aids, per_100: 1 });
const correcte = { mode: 'dictation', aids: ALL, per_100: 5 };
const reprendre = { mode: 'dictation', aids: ALL, per_100: 9 };

describe('the five review aids (spec 2026-09-29 §3)', () => {
  it('are the five, suggested in their own order', () => {
    expect(AID_KEYS).toEqual(['argus', 'ariane', 'persee', 'athena', 'palamede']);
    expect(SUGGEST_ORDER).toEqual(['athena', 'argus', 'palamede', 'persee', 'ariane']);
    expect(AID_LABELS.athena).toMatchObject({ name: "La chouette d'Athéna", the: 'la chouette' });
    expect(AID_LABELS.palamede.name).toBe('Les jetons de Palamède');
    expect(aidDesc('athena', R)).toBe('3 indices pour repérer un piège.');
    expect(aidDesc('athena', { ...R, chouette_hints: 1 })).toBe('1 indice pour repérer un piège.');
    for (const k of ['argus', 'ariane', 'persee', 'athena'] as const) expect(aidIcon(k), k).toMatch(/^\/art\/icons\/tool-/);
  });

  it('reads a remembered or saved choice: all five when there is none, only the valid ones once each', () => {
    expect(normalizeAids(undefined)).toEqual(ALL);
    expect(normalizeAids('argus')).toEqual(ALL);
    expect(normalizeAids(null)).toEqual(ALL);
    expect(normalizeAids(['palamede', 'argus', 'argus', 'loupe'])).toEqual(['argus', 'palamede']);
    expect(normalizeAids([])).toEqual([]);
  });

  it('adds the bonuses the muster shows', () => {
    const b = bonusParts({ pace: 2, mode: 'dictation', aids: ['argus', 'ariane', 'persee'], prophecy: false }, R);
    expect(b.pace).toBe(0.25);
    expect(b.aids).toBeCloseTo(0.4, 10);
    expect(b.prophecy).toBe(0);
    expect(b.total).toBeCloseTo(0.65, 10);
    expect(bonusParts({ pace: 3, mode: 'grimoire', aids: [], prophecy: true }, R).total).toBeCloseTo(1.5, 10);
    expect(bonusParts({ pace: 1, mode: 'dictation', aids: ALL, prophecy: false }, R).total).toBe(0);
  });

  it('lists in French', () => {
    expect([listFr([]), listFr(['a']), listFr(['a', 'b']), listFr(['a', 'b', 'c'])]).toEqual(['', 'a', 'a et b', 'a, b et c']);
  });
});

describe('the suggestion, never automatic (spec 2026-09-29 §3)', () => {
  it('suggests leaving the next aid after three belles copies with the same aids', () => {
    expect(suggestion([belle(ALL), belle(ALL), belle(ALL)], ALL, R)).toEqual({ kind: 'leave', aid: 'athena' });
    expect(suggestion([belle(NO_OWL), belle(NO_OWL), belle(NO_OWL)], NO_OWL, R)).toEqual({ kind: 'leave', aid: 'argus' });
    expect(suggestion([belle(['ariane']), belle(['ariane']), belle(['ariane'])], ['ariane'], R)).toEqual({ kind: 'leave', aid: 'ariane' });
    expect(suggestion([belle([]), belle([]), belle([])], [], R)).toBeNull();
  });

  it('needs three dictations in a row, all belles, with the same aids', () => {
    expect(suggestion([belle(ALL), belle(ALL)], ALL, R)).toBeNull();
    expect(suggestion([belle(ALL), correcte, belle(ALL), belle(ALL)], ALL, R)).toBeNull();
    expect(suggestion([belle(ALL), belle(NO_OWL), belle(ALL)], ALL, R)).toBeNull();
    // A defence from before the aids breaks the run.
    expect(suggestion([belle(ALL), belle(ALL), belle(null)], ALL, R)).toBeNull();
    // A grimoire round between them neither counts nor breaks it (plan Ruling R3).
    expect(suggestion([belle(ALL), belle(ALL, 'grimoire'), belle(ALL), belle(ALL)], ALL, R)).toEqual({ kind: 'leave', aid: 'athena' });
  });

  it('never names an aid this muster already leaves', () => {
    expect(suggestion([belle(ALL), belle(ALL), belle(ALL)], NO_OWL, R)).toEqual({ kind: 'leave', aid: 'argus' });
  });

  it('suggests taking back the last aid left after two copies à reprendre', () => {
    expect(suggestion([reprendre, reprendre], ['ariane', 'persee'], R)).toEqual({ kind: 'take', aid: 'palamede' });
    expect(suggestion([reprendre, reprendre], ['argus', 'ariane', 'persee', 'palamede'], R)).toEqual({ kind: 'take', aid: 'athena' });
    expect(suggestion([reprendre, reprendre], ALL, R)).toBeNull();
    expect(suggestion([reprendre, correcte, reprendre], ['ariane'], R)).toBeNull();
  });

  it('reads the copy limits from the rules', () => {
    expect(suggestion([belle(ALL), belle(ALL), belle(ALL)], ALL, { ...R, copy_belle_max_per_100: 0.5 })).toBeNull();
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `scripts/npm.sh run test -- src/lib/rules.test.ts src/lib/aids.test.ts`
Expected: FAIL — `Cannot find module './rules'`, `'./aids'`.

- [ ] **Step 3: Write `web/src/lib/rules.ts`**

```ts
// The camp's rules (spec 2026-09-29 §7): the server reads data/regles.json at start-up and serves the
// values with GET /api/world (`catalog.rules`). The defaults below mirror server/app/rules.py and
// apply until the catalog has come. Pure.
import { todayIso } from './dates';
import type { PlayMode } from './types';

export interface GameRules {
  quest_min_chances: number;
  quest_min_correct: number;
  fight_max_per_100: number;
  copy_belle_max_per_100: number;
  copy_correcte_max_per_100: number;
  aid_bonus: number;
  pace_bonus: Record<'1' | '2' | '3', number>;
  prophecy_bonus: number;
  chouette_hints: number;
}

export const DEFAULT_RULES: GameRules = {
  quest_min_chances: 3,
  quest_min_correct: 0.85,
  fight_max_per_100: 4,
  copy_belle_max_per_100: 2,
  copy_correcte_max_per_100: 8,
  aid_bonus: 0.2,
  pace_bonus: { '1': 0, '2': 0.25, '3': 0.5 },
  prophecy_bonus: 0.5,
  chouette_hints: 3,
};

export function rulesOf(catalog: { rules?: GameRules } | null | undefined): GameRules {
  return catalog?.rules ?? DEFAULT_RULES;
}

/** Mistakes left per 100 words (spec §1), every category counted; 0 for a text without words. */
export function per100(mistakes: number, words: number): number {
  return words > 0 ? (100 * mistakes) / words : 0;
}

export type CopyVerdict = 'belle' | 'correcte' | 'reprendre';

/** Spec §2: ≤ 2 « belle copie », ≤ 8 « copie correcte », above « copie à reprendre ». */
export function copyVerdict(per: number, rules: Pick<GameRules, 'copy_belle_max_per_100' | 'copy_correcte_max_per_100'>): CopyVerdict {
  if (per <= rules.copy_belle_max_per_100) return 'belle';
  if (per <= rules.copy_correcte_max_per_100) return 'correcte';
  return 'reprendre';
}

/** The pace's bonus (spec §4): a stale pace 4 counts as 3; the Grimoire has none. */
export function paceBonus(pace: number, mode: PlayMode, rules: GameRules): number {
  if (mode === 'grimoire') return 0;
  const key = String(Math.min(3, Math.max(1, Math.round(pace)))) as '1' | '2' | '3';
  return rules.pace_bonus[key] ?? 0;
}

/** The prophecy's bonus applies strictly before the text's due date, as on the server (`due_date > day`). */
export function prophecyBonusApplies(dueDate: string | null, today: Date = new Date()): boolean {
  return !!dueDate && dueDate > todayIso(today);
}
```

- [ ] **Step 4: Write `web/src/lib/aids.ts`**

```ts
// The five review aids (spec 2026-09-29 §3): each taken along or left at the camp before the battle,
// remembered per hero (`settings.aids`, written by the server with each session, plan Ruling R1), and
// worth +20 % of glory each when left. The suggestion reads the last defences; it only ever suggests.
import { copyVerdict, paceBonus, type GameRules } from './rules';
import { plural } from './text/french';
import type { PlayMode } from './types';
import { TOOL_ICONS } from './world/art';

export const AID_KEYS = ['argus', 'ariane', 'persee', 'athena', 'palamede'] as const;
export type AidKey = (typeof AID_KEYS)[number];
export const ALL_AIDS: readonly AidKey[] = AID_KEYS;
/** The order the camp suggests leaving them in. */
export const SUGGEST_ORDER: readonly AidKey[] = ['athena', 'argus', 'palamede', 'persee', 'ariane'];

/** `name` on the toggle, `the` inside a sentence (« Tu pourrais laisser la chouette au camp. »). */
export const AID_LABELS: Record<AidKey, { name: string; the: string; desc: string }> = {
  argus: { name: "Les yeux d'Argus", the: "les yeux d'Argus", desc: "Une catégorie de mots à la fois, le reste dans l'ombre." },
  ariane: { name: "Le fil d'Ariane", the: "le fil d'Ariane", desc: 'Relie un verbe à son sujet.' },
  persee: { name: 'Le bouclier de Persée', the: 'le bouclier de Persée', desc: 'Une phrase à la fois, de la dernière à la première.' },
  athena: { name: "La chouette d'Athéna", the: 'la chouette', desc: 'Des indices pour repérer un piège.' },
  palamede: { name: 'Les jetons de Palamède', the: 'les jetons de Palamède', desc: 'Combien de pièges se cachent dans le texte.' },
};

export function isAidKey(k: unknown): k is AidKey {
  return typeof k === 'string' && (AID_KEYS as readonly string[]).includes(k);
}

/** A remembered or saved choice: the valid aids, once each, in the camp's order. Anything that is not a
 *  list (a new hero, a save from before the aids) is all five, as for a new hero (spec §3). */
export function normalizeAids(raw: unknown): AidKey[] {
  if (!Array.isArray(raw)) return [...AID_KEYS];
  return AID_KEYS.filter((k) => raw.includes(k));
}

/** The toggle's one line; the owl's says how many hints the rules give her. */
export function aidDesc(key: AidKey, rules: GameRules): string {
  return key === 'athena' ? `${plural(rules.chouette_hints, 'indice', 'indices')} pour repérer un piège.` : AID_LABELS[key].desc;
}

/** The aid's painted emblem. Palamède's comes with the art track (plan Task 9): null until then. */
export function aidIcon(key: AidKey): string | null {
  return (TOOL_ICONS as Record<string, string>)[key] ?? null;
}

/** The glory this battle is worth on top of the text (spec §4): the pace, +20 % per aid left, the prophecy. */
export function bonusParts(
  o: { pace: number; mode: PlayMode; aids: readonly AidKey[]; prophecy: boolean },
  rules: GameRules,
): { pace: number; aids: number; prophecy: number; total: number } {
  const pace = paceBonus(o.pace, o.mode, rules);
  const aids = rules.aid_bonus * (AID_KEYS.length - o.aids.length);
  const prophecy = o.prophecy ? rules.prophecy_bonus : 0;
  return { pace, aids, prophecy, total: pace + aids + prophecy };
}

/** « a », « a et b », « a, b et c ». */
export function listFr(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`;
}

/** One of the last defences (GET /api/profiles/{id}/stats `recent_sessions`, newest first). */
export interface RecentDefence {
  mode: string;
  aids: readonly string[] | null;
  per_100: number | null;
}

export interface Suggestion {
  kind: 'leave' | 'take';
  aid: AidKey;
}

const sameAids = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((k) => b.includes(k));

/** Spec §3: after 3 consecutive dictations with a « belle copie » and the same aids, suggest leaving the
 *  next aid (athena → argus → palamede → persee → ariane); after 2 consecutive « copie à reprendre »,
 *  suggest taking back the last aid left. Only a suggestion: the muster never changes the choice.
 *  Grimoire rounds are skipped; a defence from before the aids breaks a "same aids" run (Ruling R3). */
export function suggestion(recent: readonly RecentDefence[], current: readonly AidKey[], rules: GameRules): Suggestion | null {
  const dictations = recent.filter((s) => s.mode === 'dictation');
  const verdict = (s: RecentDefence) => (s.per_100 === null ? null : copyVerdict(s.per_100, rules));
  const run = dictations.slice(0, 3);
  const first = run[0]?.aids ?? null;
  if (run.length === 3 && first !== null && run.every((s) => verdict(s) === 'belle' && s.aids !== null && sameAids(s.aids, first))) {
    const aid = SUGGEST_ORDER.find((k) => first.includes(k) && current.includes(k));
    if (aid) return { kind: 'leave', aid };
  }
  const last2 = dictations.slice(0, 2);
  if (last2.length === 2 && last2.every((s) => verdict(s) === 'reprendre')) {
    const aid = [...SUGGEST_ORDER].reverse().find((k) => !current.includes(k));
    if (aid) return { kind: 'take', aid };
  }
  return null;
}
```

- [ ] **Step 5: The types**

`web/src/lib/world/types.ts`: add `import type { GameRules } from '../rules';`; in `WorldCatalog` add after `quest_bonus`:

```ts
  /** Spec 2026-09-29 §7: the rules file's values (server/app/rules.py), defaults in lib/rules.ts. */
  rules: GameRules;
```

and in `Progression.xp` after `session: number;`:

```ts
    /** Spec 2026-09-29 §4: the session XP broken down for the victory's chips (they add up to `session`).
     *  Absent from a victory saved before the change. */
    parts?: { text: number; pace: number; aids: number; prophecy: number };
```

`web/src/lib/types.ts`: in `ProfileSettings` add:

```ts
  /** Spec 2026-09-29 §3: the review aids taken last, pre-selected at the next muster (written by the
   *  server with each session). Absent: all five. */
  aids?: string[];
```

and in `RecentSession` add after `mode: PlayMode;`:

```ts
  /** Spec 2026-09-29 §3: the aids taken for this defence, null before the aids existed. */
  aids: string[] | null;
  /** Mistakes left per 100 words in the handed-in copy; null for a text without words. */
  per_100: number | null;
```

Fix every test fixture that builds a `WorldCatalog` or `RecentSession` literal without a cast (svelte-check names them) by adding `rules: DEFAULT_RULES` / `aids: null, per_100: null`.

- [ ] **Step 6: Run the tests and the check**

Run: `scripts/npm.sh run test -- src/lib/rules.test.ts src/lib/aids.test.ts` then `scripts/npm.sh run test` then `scripts/npm.sh run check`
Expected: all pass; `0 errors and 0 warnings`.

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/rules.ts web/src/lib/rules.test.ts web/src/lib/aids.ts web/src/lib/aids.test.ts web/src/lib/world/types.ts web/src/lib/types.ts
git commit -m "Client: the camp's rules (defaults, copy verdict, pace and prophecy bonuses) and the five review aids (names, remembered choice, bonus total, the suggestion rule)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/lib/rules.ts web/src/lib/rules.test.ts web/src/lib/aids.ts web/src/lib/aids.test.ts web/src/lib/world/types.ts web/src/lib/types.ts
```

(add the fixture files you touched to both lists)

---

### Task 4: Help stage → aids, end to end

**Files:**
- Create: `web/src/lib/battle/proofAids.ts`, `web/src/lib/battle/proofAids.test.ts`
- Modify (client): `web/src/lib/playState.ts` (+ test), `web/src/screens/Play.svelte`, `web/src/components/battle/ProofPhase.svelte`, `web/src/components/battle/VictoryPhase.svelte`, `web/src/lib/battle/hp.ts` (+ test), `web/src/lib/battle/lines.ts` (+ test), `web/src/lib/argus.ts` (+ test if it pins `HINTS_PER_STAGE`), `web/src/screens/Boss.svelte`, `web/src/components/battle/BossMuster.svelte`, `web/src/lib/world/api.ts`, `web/src/lib/world/types.ts` (`QuestOut.goal`), `web/src/lib/types.ts` (`Profile`, `SessionCreate`, `SessionCreated`, `RecentSession`), `web/src/lib/routes.test.ts`, `web/src/lib/world/quests.test.ts`, `web/src/lib/audio/store.svelte.test.ts`, `web/src/lib/tours/seen.svelte.test.ts`, `web/src/lib/world/journal.ts` (+ test), `web/src/components/places/cabin/JournalPanel.svelte`
- Modify (server): `server/app/routers/sessions.py`, `server/app/stats.py`, `server/app/schemas.py` (`ProfileOut`), `server/app/routers/profiles.py` (`to_out`), `server/app/routers/stats.py`, `server/app/routers/world.py` (boss)
- Test (server): `server/tests/test_sessions.py`, `server/tests/test_stats_logic.py`, `server/tests/test_profiles.py`, `server/tests/test_world_api.py`, `server/tests/test_progression.py`
- Modify (e2e): `web/e2e/helpers.ts`, `web/e2e/scenes-battle-play.spec.ts`, `web/e2e/scenes-battle.spec.ts`, `web/e2e/world.spec.ts` (step 8), `web/e2e/playability-ui4.spec.ts`, `web/e2e/scenes-cabin.spec.ts` (the journal)

**Interfaces:**
- Consumes: `AidKey`, `ALL_AIDS`, `normalizeAids` (Task 3); `rulesOf`, `GameRules` (Task 3); `campStore.catalog` (`lib/world/campStore.svelte.ts`).
- Produces:
  - `lib/battle/proofAids.ts`: `interface ProofAids { passes: boolean; fil: boolean; bouclier: boolean; hintsLeft: number; chouette: boolean; count: number | null }`; `proofAids(aids: readonly AidKey[], o: { hints: number; hintsUsed: number; initialErrors: number | undefined }): ProofAids`.
  - `PlayState.aids: AidKey[]` (required); `PlayState.help` removed; `BattleUnder = { encounter: string | null; quest: number | null }`; `battleContext(state, url): Required<BattleUnder>`; `newPlayState(profileId, textId, pace, mode?, under?, aids?: readonly AidKey[])` (default all five); `loadPlayState` fills `aids` with `normalizeAids` and deletes `help`.
  - `hpDuringPlay(count: number | null): HpView`.
  - `lines.ts`: `PROOF.argusLine`, `PROOF.noAids` (replacing `stage1`, `stage2`, `stage4`); `proofSentence(passes: boolean, count: number | null): string`.
  - `ProofPhase` props: `aids: readonly AidKey[]`, `hints: number` (replacing `helpStage`).
  - `VictoryPhase` loses `helpMessage`.
  - `argus.ts` loses `HINTS_PER_STAGE`.
  - `journal.ts`: `aidsJournalLine(aids: readonly AidKey[]): string`, `aidBonusLine(bonus: number): string`; `HELP_STAGES`, `HELP_RULE`, `helpStageLine` removed. JournalPanel: section « Tes aides », test id `journal-aids`.
  - API: `POST /api/sessions` returns `{id, progression}`; `ProfileOut`, `recent_sessions[]` and `POST /boss` lose `help_stage`; client `Profile.help_stage`, `RecentSession.help_stage`, `SessionCreated.help_stage_*`, `SessionCreate.help_stage` removed; `SessionCreate.aids: AidKey[]`; `worldApi.boss` returns `{ quest; text_id; tier }`; `QuestOut.goal: { sessions?: number; tier?: number; text_id?: number }`.
  - e2e helpers: `PlaySeed.aids?: string[]` (replacing `help`); `setSavedAids(page, profileId, textId, aids)`; `postSession` loses `helpStage`.

- [ ] **Step 1: Write the failing unit tests**

`web/src/lib/battle/proofAids.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ALL_AIDS, type AidKey } from '../aids';
import { proofAids } from './proofAids';

const o = { hints: 3, hintsUsed: 0, initialErrors: 2 };
const none = { passes: false, fil: false, bouclier: false, hintsLeft: 0, chouette: false, count: null };

describe('the proofreading shows the aids taken, and only them (spec 2026-09-29 §3)', () => {
  it('shows nothing of an aid left at the camp', () => {
    expect(proofAids([], o)).toEqual(none);
  });

  it.each([
    ['argus', { passes: true }],
    ['ariane', { fil: true }],
    ['persee', { bouclier: true }],
    ['athena', { hintsLeft: 3, chouette: true }],
    ['palamede', { count: 2 }],
  ] as [AidKey, object][])('%s alone brings its own tool', (aid, on) => {
    expect(proofAids([aid], o)).toEqual({ ...none, ...on });
  });

  it('gives the owl the hints of the rules, and hides her once they are spent', () => {
    expect(proofAids(ALL_AIDS, { ...o, hints: 1 })).toMatchObject({ hintsLeft: 1, chouette: true });
    expect(proofAids(ALL_AIDS, { ...o, hintsUsed: 3 })).toMatchObject({ hintsLeft: 0, chouette: false });
    expect(proofAids(ALL_AIDS, { ...o, hintsUsed: 9 })).toMatchObject({ hintsLeft: 0 });
  });

  it("counts Palamède's traps from the frozen count, zero before it is frozen", () => {
    expect(proofAids(['palamede'], { ...o, initialErrors: undefined }).count).toBe(0);
    expect(proofAids(['palamede'], { ...o, initialErrors: 0 }).count).toBe(0);
  });
});
```

`web/src/lib/battle/hp.test.ts`: replace the two first tests with:

```ts
  it("stays full while she plays, notched only by Palamède's count when his tokens were taken", () => {
    expect(hpDuringPlay(null)).toEqual(FULL_HP);
    expect(hpDuringPlay(4)).toEqual({ value: 1, segments: 4 });
    expect(hpDuringPlay(0)).toEqual(FULL_HP);
  });

  it('never drops during play (user decision: the drop waits for the reckoning)', () => {
    for (const count of [null, 0, 1, 7, 30]) expect(hpDuringPlay(count).value, String(count)).toBe(1);
  });
```

`web/src/lib/battle/lines.test.ts`: add

```ts
  it('says under the title what the aids taken will do, and nothing of the ones left (spec 2026-09-29 §3)', () => {
    expect(L.proofSentence(true, null)).toBe("Les Yeux d'Argus éclairent une catégorie à la fois.");
    expect(L.proofSentence(false, 2)).toBe('2 pièges sont cachés dans ce texte.');
    expect(L.proofSentence(true, 1)).toBe("Les Yeux d'Argus éclairent une catégorie à la fois. 1 piège est caché dans ce texte.");
    expect(L.proofSentence(false, null)).toBe('À toi de jouer. Quand tout te semble juste, dis-le.');
  });
```

`web/src/lib/playState.test.ts`: in `describe('the battle a save belongs to (Ruling C2c)')` drop every `help` (`free`/`boss` lose it; delete the test `"keeps the help stage the battle's link imposed, and an older save takes the link's"`; in the older-save test drop `delete old.help` and expect `battleContext(old, boss)` to equal `{ encounter: null, quest: null }`; in the first test expect `toMatchObject({ encounter: 'eris', quest: 7 })` and `newPlayState(1, 2, 1)` to match `{ encounter: null, quest: null }`), and add:

```ts
describe('the aids a battle was started with (spec 2026-09-29 §3)', () => {
  it('starts with the aids it is given, all five by default, and keeps them through storage', () => {
    expect(newPlayState(1, 2, 1).aids).toEqual(['argus', 'ariane', 'persee', 'athena', 'palamede']);
    const s = newPlayState(1, 2, 1, 'dictation', { encounter: null, quest: null }, ['palamede']);
    s.phase = 'proofreading';
    savePlayState(s);
    expect(loadPlayState(1, 2)!.aids).toEqual(['palamede']);
  });

  it('a save from before the aids resumes with all five taken, and forgets its help stage', () => {
    const old: Record<string, unknown> = { ...newPlayState(1, 2, 1), phase: 'proofreading', help: 3 };
    delete old.aids;
    localStorage.setItem(playKey(1, 2), JSON.stringify(old));
    const s = loadPlayState(1, 2)!;
    expect(s.aids).toEqual(['argus', 'ariane', 'persee', 'athena', 'palamede']);
    expect(s).not.toHaveProperty('help');
    localStorage.setItem(playKey(1, 2), JSON.stringify({ ...old, aids: ['palamede', 'loupe', 'argus'] }));
    expect(loadPlayState(1, 2)!.aids).toEqual(['argus', 'palamede']);
  });
});
```

`web/src/lib/routes.test.ts`: drop `&help=3` / `help: '3'` from the `matchRoute` case and `'#/p/1/play/5?encounter=eris&help=2'` from the keys list (the router keeps no knowledge of `help`; the case just no longer exists in the game).

Server, `server/tests/test_sessions.py`: delete `test_help_stage_adapts` and `test_null_catch_rate_is_ignored_for_adaptation`, drop the `UP_MESSAGE, DOWN_MESSAGE` import and the `help_stage` keys of `post_session`, `test_grimoire_session_…`, `test_missing_word_…` and `test_session_404s` bodies, and add:

```python
def test_the_help_stage_is_gone_but_its_columns_stay(client, settings):
    p, t = setup(client)
    r = client.post("/api/sessions", json=body_for(p, t, aids=["argus"], help_stage=4))
    assert r.status_code == 201 and set(r.json()) == {"id", "progression"}
    assert "help_stage" not in client.get(f"/api/profiles/{p['id']}").json()
    assert "help_stage" not in client.get(f"/api/profiles/{p['id']}/stats").json()["recent_sessions"][0]
    conn = sqlite3.connect(settings.data_dir / DB_FILENAME)
    assert conn.execute("SELECT help_stage FROM session WHERE id = ?", (r.json()["id"],)).fetchone()[0] == 0
    assert conn.execute("SELECT help_stage FROM profile WHERE id = ?", (p["id"],)).fetchone()[0] == 1
    conn.close()
```

`server/tests/test_stats_logic.py`: delete the two `next_help_stage` tests and its import. `server/tests/test_profiles.py`: drop `and p["help_stage"] == 1` (assert `"help_stage" not in p` instead). `server/tests/test_world_api.py` `test_boss_flow`: replace `b["help_stage"] == 3` by `set(b) == {"quest", "text_id", "tier"}` and delete the Decision-8 comment above it; drop `help_stage=3` from its `post(...)` calls. `server/tests/test_progression.py` `post()`: drop `"help_stage": 1` from the body.

- [ ] **Step 2: Run them to see them fail**

Run: `scripts/npm.sh run test -- src/lib/battle/proofAids.test.ts src/lib/battle/hp.test.ts src/lib/battle/lines.test.ts src/lib/playState.test.ts src/lib/routes.test.ts` then `scripts/pytest.sh -q tests/test_sessions.py tests/test_stats_logic.py tests/test_profiles.py tests/test_world_api.py tests/test_progression.py`
Expected: FAIL (missing module `./proofAids`, `hpDuringPlay` arity, `proofSentence` undefined, `aids` undefined; server still returns `help_stage`).

- [ ] **Step 3: `proofAids`** — `web/src/lib/battle/proofAids.ts`:

```ts
// What the proofreading shows for the aids taken along (spec 2026-09-29 §3): an aid left at the camp is
// absent for the whole session, no button, no pass strip, no count. Pure; ProofPhase renders it.
import type { AidKey } from '../aids';

export interface ProofAids {
  /** Les yeux d'Argus: the pass strip, its spotlight (the rest dimmed) and the « passes left » confirm. */
  passes: boolean;
  /** Le fil d'Ariane. */
  fil: boolean;
  /** Le bouclier de Persée. */
  bouclier: boolean;
  /** La chouette d'Athéna: the hints left (0 when she stayed at the camp). */
  hintsLeft: number;
  chouette: boolean;
  /** Les jetons de Palamède: the frozen count (null when they stayed at the camp). */
  count: number | null;
}

export function proofAids(aids: readonly AidKey[], o: { hints: number; hintsUsed: number; initialErrors: number | undefined }): ProofAids {
  const has = (k: AidKey) => aids.includes(k);
  const hintsLeft = has('athena') ? Math.max(0, o.hints - o.hintsUsed) : 0;
  return {
    passes: has('argus'),
    fil: has('ariane'),
    bouclier: has('persee'),
    hintsLeft,
    chouette: hintsLeft > 0,
    count: has('palamede') ? (o.initialErrors ?? 0) : null,
  };
}
```

- [ ] **Step 4: `hp.ts`, `lines.ts`, `argus.ts`**

`web/src/lib/battle/hp.ts`: replace the header's "at help stage 3" wording with "with Palamède's tokens", the `segments` doc with `/** Notches on the bar: Palamède's frozen count, else null. */`, and `hpDuringPlay` with:

```ts
/** The bar during play: always full; never a function of her edits. Les jetons de Palamède notch it with
 *  the frozen count she already sees (spec 2026-09-29 §3); `count` is null when they stayed at the camp. */
export function hpDuringPlay(count: number | null): HpView {
  return count !== null && count > 0 ? { value: 1, segments: count } : FULL_HP;
}
```

`web/src/lib/battle/lines.ts` `PROOF`: replace `stage1`, `stage2`, `stage4` with

```ts
  /** Spec 2026-09-29 §3: what Les yeux d'Argus do, under the title, when they were taken along. */
  argusLine: "Les Yeux d'Argus éclairent une catégorie à la fois.",
  /** No aid under the title to speak of (neither Argus nor Palamède). */
  noAids: 'À toi de jouer. Quand tout te semble juste, dis-le.',
```

update `cue`'s comment ("before the aids' sentence"), and add after `PROOF`:

```ts
/** The proofreading's sentence under its title: what the aids taken will do, never a help stage. */
export function proofSentence(passes: boolean, count: number | null): string {
  const parts = [passes ? PROOF.argusLine : null, count === null ? null : PROOF.count(count)].filter((s): s is string => s !== null);
  return parts.length > 0 ? parts.join(' ') : PROOF.noAids;
}
```

`web/src/lib/argus.ts`: delete `HINTS_PER_STAGE` and its comment (the owl's hints come from the rules file). Remove it from `argus.test.ts` if pinned there.

- [ ] **Step 5: The play state** — `web/src/lib/playState.ts`:
  - `import { normalizeAids, type AidKey } from './aids';`
  - in `PlayState`: replace the `help?` field and its comment with

```ts
  /** Spec 2026-09-29 §3: the review aids taken along for this battle, chosen at its muster and kept with
   *  it, so the resume ribbon restores them. A save from before the aids loads as all five. */
  aids: AidKey[];
```

  and `/** Draft error count frozen when proofreading starts (Palamède's count; plan decision #6). */` for `initialErrors`.
  - `BattleUnder`: drop `help`; doc: "What a battle runs under (Ruling C2c): the encounter and the quest."
  - `battleContext`:

```ts
export function battleContext(state: PlayState | null, url: BattleUnder): Required<BattleUnder> {
  if (!state) return { encounter: url.encounter, quest: url.quest };
  return { encounter: state.encounter ?? null, quest: state.quest ?? null };
}
```

  - `loadPlayState`, after the pace normalisation:

```ts
    // Spec 2026-09-29 §3: the aids chosen for this battle; a save from before them takes all five, and
    // its imposed help stage (the retired `?help=`) is forgotten.
    parsed.aids = normalizeAids(parsed.aids);
    delete parsed.help;
```

  - `newPlayState(profileId, textId, pace, mode = 'dictation', under = { encounter: null, quest: null }, aids: readonly AidKey[] = ALL_AIDS)`: drop `help: under.help ?? null,`, add `aids: [...aids],` (import `ALL_AIDS` too).

- [ ] **Step 6: ProofPhase** — `web/src/components/battle/ProofPhase.svelte`:
  - header comment: replace "Help stages: 1 spotlight passes, 2 named passes, 3 error count, 4 nothing." with "The aids taken along (spec 2026-09-29 §3) decide what shows: Argus's passes and spotlight, Ariane's thread, Persée's shield, the owl's hints, Palamède's count; an aid left at the camp is absent."
  - imports: `import { ARGUS_LABELS, activePasses, typedPassSets } from '../../lib/argus';`, `import { PROOF, proofSentence } from '../../lib/battle/lines';`, `import { proofAids } from '../../lib/battle/proofAids';`, `import type { AidKey } from '../../lib/aids';`.
  - props: replace `helpStage` / `helpStage: 1 | 2 | 3 | 4;` with

```ts
    /** Spec 2026-09-29 §3: the review aids taken along; the others are absent for the whole session. */
    aids: readonly AidKey[];
    /** La chouette d'Athéna's hints per session (`chouette_hints`, the rules file). */
    hints: number;
```

  - the derived values (replacing `activePass`, the P1-6 comment, `spotlightPass`, `hintsLeft`):

```ts
  const tools = $derived(proofAids(aids, { hints, hintsUsed: play.hintsUsed, initialErrors: play.initialErrors }));
  const activePass = $derived(tools.passes ? passes[play.passIndex] : null);
  // Les yeux d'Argus light their pass and dim the rest of the text (the old stage 1).
  const spotlightPass = $derived(activePass);
  const hintsLeft = $derived(tools.hintsLeft);
```

  - `range`: `const range = $derived(tools.bouclier && play.bouclier && spans.length > 0 ? spans[clampSentence(sentenceIndex)] : null);` (a save whose shield was up, resumed with Persée left at the camp, never walks sentence by sentence without a way back).
  - `stageSentence`: `const stageSentence = $derived(proofSentence(tools.passes, tools.count));`
  - `finish()`: `if (tools.passes && !isLastPass) {`
  - `tools` snippet: wrap the bouclier button in `{#if tools.bouclier}…{/if}`, change the owl's condition to `{#if tools.chouette}`, wrap the fil button in `{#if tools.fil}…{/if}`; « Modifier tout le texte » stays always. Update the snippet's comment ("The tools of the aids taken, and the whole text").
  - compact bar: `{#if activePass}` (was `helpStage <= 2 && activePass`), and replace `{:else if helpStage === 3}` / its span with `{:else if tools.count !== null}<span class="bar-count" data-testid="bar-count">{PROOF.countShort(tools.count)}</span>`.
  - both sentence navigations (compact bar and full layout): `{#if tools.bouclier && play.bouclier && spans.length > 0 && !wholeText}`.
  - full layout's Argus strip: `{#if activePass}`.

- [ ] **Step 7: Play** — `web/src/screens/Play.svelte`:
  - imports: add `import { normalizeAids } from '../lib/aids';`, `import { rulesOf } from '../lib/rules';`, and `campStore` to the campStore import.
  - `urlUnder`: `{ encounter: query.encounter ?? null, quest: query.quest ? Number(query.quest) : null }`; update its comment (no `help`), and the Ruling C2c comment ("…its quest too" instead of "its help stage too").
  - delete `helpOverride` and `helpStage`; add

```ts
  // Spec 2026-09-29 §3: the aids this battle runs with. A fresh battle starts from the hero's remembered
  // choice (all five for a new hero); once it exists, the battle's own.
  const aids = $derived(playState?.aids ?? normalizeAids(profile.settings.aids));
  const rules = $derived(rulesOf(campStore.catalog));
```

  - `load()`: `playState = newPlayState(profile.id, id, initialPace, mode, urlUnder, normalizeAids(profile.settings.aids));`
  - `restart()`: `playState = newPlayState(profile.id, id, initialPace, mode, under, aids);` (the replay's muster pre-selects the same aids); delete `helpMessage = null;`.
  - delete `let helpMessage`.
  - `submitSession`: replace `help_stage: helpStage,` by `aids: stateAtSubmit.aids,`; delete `helpMessage = created.help_stage_message;`; the comment above `Promise.all` becomes "Refreshes profileStore (the aids the server remembered for the next muster) and campStore …".
  - the hold: `setHp(hpDuringPlay(aids.includes('palamede') ? (playState?.initialErrors ?? null) : null));` and its comment "…notched by Palamède's count…".
  - `<ProofPhase … {aids} hints={rules.chouette_hints} …>` replacing `{helpStage}`.
  - `<VictoryPhase …>`: delete `{helpMessage}`.

- [ ] **Step 8: VictoryPhase** — `web/src/components/battle/VictoryPhase.svelte`: delete the `helpMessage` prop (destructuring and type), `if (helpMessage) lines.push(...)`, `let spokenHelp`, `spokenHelp = helpMessage;` and the whole second `$effect` (the help message's second take). Rewrite the comment above `speaker` to end "…up to two traps still standing (the word, then its explanation), the « Revoir » hint. Built when the dialogue starts (a pick is remembered), never in a $derived. Once read, the box closes and the actions stay." and the one above `picked` to "Éris's answer, the tally and the explanations, picked once."

- [ ] **Step 9: The boss** — `web/src/screens/Boss.svelte`: delete `isGrimoireRetry` and its comment; `start()`:

```ts
      const { quest, text_id } = await worldApi.boss(profile.id);
      const params = { profileId: String(profile.id), textId: String(text_id) };
      // Spec 2026-09-29 §2: always the dictation; a clean copy simply wins (the old Grimoire retry is gone).
      navigate(href('play', params, { quest: String(quest.id), encounter: 'eris' }));
```

and drop `retry={isGrimoireRetry}` from `<BossMuster>`. `web/src/components/battle/BossMuster.svelte`: delete the `retry` prop (destructuring, type, doc) and render `{BOSS.start}` in the button. `web/src/lib/battle/lines.ts` `BOSS`: delete `restart`. `web/src/lib/world/api.ts`: `request<{ quest: QuestOut; text_id: number; tier: number }>`. `web/src/lib/world/types.ts` `QuestOut.goal`: `goal: { sessions?: number; tier?: number; text_id?: number };` with the comment "`tier` and `text_id` are present only on boss quests (spec 2026-09-29 §2: the rule reads no threshold from a goal)". Remove `min_rate` from `web/src/lib/world/quests.test.ts` fixtures.

- [ ] **Step 10: The client types** — `web/src/lib/types.ts`: delete `Profile.help_stage`, `RecentSession.help_stage`, `SessionCreated.help_stage_before|after|message`; `SessionCreate`: replace `help_stage: number;` with `aids: import('./aids').AidKey[];`. Delete `help_stage: 1,` from the hero fixtures of `web/src/lib/audio/store.svelte.test.ts` and `web/src/lib/tours/seen.svelte.test.ts`. After Step 10b, `grep -rn "help_stage\|helpStage\|HINTS_PER_STAGE\|help_stage_message\|helpStageLine\|HELP_RULE" web/src` must print nothing.

- [ ] **Step 10b: The journal's aids line** (the journal read `stats.profile.help_stage`, which goes in this task)

Test first — `web/src/lib/world/journal.test.ts`: replace the help-stage test (the one using `HELP_STAGES`, `helpStageLine`, `HELP_RULE`) and those imports with:

```ts
import { aidBonusLine, aidsJournalLine, defenceGroups, journalRuses, localDay, ruseLine } from './journal';

describe("the journal's aids (spec 2026-09-29 §3)", () => {
  it('says which aids were taken last, in words', () => {
    expect(aidsJournalLine(['argus', 'ariane', 'persee', 'athena', 'palamede'])).toBe('Au dernier combat, tu as emporté toutes les aides.');
    expect(aidsJournalLine([])).toBe('Au dernier combat, tu as laissé toutes les aides au camp.');
    expect(aidsJournalLine(['athena'])).toBe('Au dernier combat, tu as emporté la chouette.');
    expect(aidsJournalLine(['argus', 'persee', 'palamede'])).toBe(
      "Au dernier combat, tu as emporté les yeux d'Argus, le bouclier de Persée et les jetons de Palamède.",
    );
  });

  it('says what each aid left at the camp is worth, from the rules', () => {
    expect(aidBonusLine(0.2)).toBe('Chaque aide laissée au camp : +20 % de gloire.');
    expect(aidBonusLine(0.35)).toBe('Chaque aide laissée au camp : +35 % de gloire.');
  });
});
```

Run `scripts/npm.sh run test -- src/lib/world/journal.test.ts` (FAIL: `aidsJournalLine` is not exported), then implement. `web/src/lib/world/journal.ts`: the header becomes "The journal's words (UI3 Ruling B6): the aids taken last (spec 2026-09-29 §3), Éris's tricks told by the monster that plays them, and the texts defended, said the camp's way (the old Stats said « niveau N sur 4 », « Comme en classe », a « Réussite » column and points, school and scoreboard register; UI3b playability #1, #2, #14)."; delete `HELP_STAGES`, `LINES`, `HELP_RULE`, `helpStageLine` and their comments, and add:

```ts
import { AID_KEYS, AID_LABELS, listFr, type AidKey } from '../aids';

/** Which aids were taken last (the hero's remembered choice, `settings.aids`, plan Ruling R1). */
export function aidsJournalLine(aids: readonly AidKey[]): string {
  if (aids.length === AID_KEYS.length) return 'Au dernier combat, tu as emporté toutes les aides.';
  if (aids.length === 0) return 'Au dernier combat, tu as laissé toutes les aides au camp.';
  return `Au dernier combat, tu as emporté ${listFr(aids.map((k) => AID_LABELS[k].the))}.`;
}

/** What each aid left at the camp is worth (`aid_bonus`, the rules file). */
export const aidBonusLine = (bonus: number) => `Chaque aide laissée au camp : +${Math.round(bonus * 100)} % de gloire.`;
```

`web/src/components/places/cabin/JournalPanel.svelte`: import `aidBonusLine, aidsJournalLine` instead of `HELP_RULE, helpStageLine`, plus `normalizeAids` from `../../../lib/aids`, `rulesOf` from `../../../lib/rules`, and `campStore, loadCatalog` from `../../../lib/world/campStore.svelte` (call `void loadCatalog();` at the top of the script unless the panel already loads the catalog: it is a no-op once loaded). Rename the section heading « L'aide des Muses » to « Tes aides », the test id `journal-help` to `journal-aids`, the classes `help`/`help-line`/`help-rule` to `aids`/`aids-line`/`aids-rule` (markup and styles), and render:

```svelte
        <p class="aids-line">{aidsJournalLine(normalizeAids(stats.profile.settings.aids))}</p>
        <p class="aids-rule">{aidBonusLine(rulesOf(campStore.catalog).aid_bonus)}</p>
```

Update the panel's header comment (the Muses' help at the hero's stage → the aids taken last).

`web/e2e/scenes-cabin.spec.ts` (the journal test, ~line 100): title `'the journal opens as a codex: the aids taken last, the tricks, the words, the defences'`; heading « Tes aides »; `journal-aids` contains « Au dernier combat, tu as emporté toutes les aides. » and « Chaque aide laissée au camp : +20 % de gloire. »; `journal-aids` has no `li, .kit-medallion`. Run it in Step 14 with `--repeat-each=3`.

- [ ] **Step 11: The server** — remove the help-stage machinery:
  - `server/app/routers/sessions.py`: module docstring "Sessions API: records a played dictation and updates stats, trap words and the world."; delete `UP_MESSAGE`, `DOWN_MESSAGE`, the `next_help_stage` import, and the whole block from `# Grimoire corrompu sessions are deliberately weighted…` to the `message = …` line; in the `INSERT` write `0` for `help_stage` (`VALUES (?,?,?,0,?,…)` with `body.help_stage or 0` removed from the tuple, and a comment "help_stage: the column stays, new sessions write 0 (spec 2026-09-29 §3)"); return `{"id": session_id, "progression": progression}`.
  - `server/app/stats.py`: delete `next_help_stage`; docstring "Per-profile statistics derived from submitted session results (spec §3.5 mots-pièges)."
  - `server/app/schemas.py` `ProfileOut`: delete `help_stage: int`. `server/app/routers/profiles.py` `to_out`: delete `help_stage=row["help_stage"],`.
  - `server/app/routers/stats.py`: drop `s.help_stage` from the recent sessions' `SELECT`.
  - `server/app/routers/world.py` `create_boss_quest`: delete the Decision-8 comment and `help_stage = …`; `goal = {"tier": tier, "text_id": text_id}`; both returns lose `"help_stage"` (`{"quest": …, "text_id": …, "tier": …}`).

- [ ] **Step 12: The e2e helpers** — `web/e2e/helpers.ts`:
  - `postSession`: delete `helpStage` from the options and `help_stage: o.helpStage ?? 1,` from `data`; delete `score: 10,` from its `data` too (the server ignores it; Task 7 removes `score` from `makeResult`'s result).
  - `PlaySeed`: replace `help?: number | null;` with `/** Spec 2026-09-29 §3: the aids the battle was started with. */ aids?: string[];` and in `seedPlay` replace the `help` spread with `...(seed.aids !== undefined ? { aids: seed.aids } : {}),`.
  - add:

```ts
/** Rewrites the aids of an already saved battle (the playability walks re-open the same seeded
 *  proofreading with different aids; `seedPlay` seeds once per tab). The page must be on the game. */
export async function setSavedAids(page: Page, profileId: number, textId: number, aids: string[]) {
  await page.evaluate(
    ({ key, aids }) => {
      const saved = JSON.parse(localStorage.getItem(key) ?? 'null');
      if (saved) localStorage.setItem(key, JSON.stringify({ ...saved, aids }));
    },
    { key: `discorde.play.${profileId}.${textId}`, aids },
  );
}
```

- [ ] **Step 13: The e2e specs**

`web/e2e/scenes-battle-play.spec.ts`:
  - `seededProof(page, request, testInfo, aids: string[])`: seed `aids` (`seedPlay(page, { …, opponent: 'chimere', aids })`) and `page.goto(`/#/p/${id}/play/${text.id}`)` (no `?help=`).
  - callers: `4` → `[]`; `1` → `['argus', 'ariane', 'persee', 'athena']`; `3` → `['ariane', 'persee', 'athena', 'palamede']`. Rename `'help stage 3 notches the hold with the count it already shows'` to `"Palamède's tokens notch the hold with the count they show"` and update its comment. Update every comment that says "stage N".
  - add the per-aid gating tests:

```ts
// Spec 2026-09-29 §3: an aid left at the camp is absent from the proofreading for the whole session.
const AID_CONTROLS: Record<string, string> = { argus: 'btn-next-pass', ariane: 'btn-fil', persee: 'btn-bouclier', athena: 'btn-chouette' };
for (const only of ['argus', 'ariane', 'persee', 'athena', 'palamede', null] as const) {
  test(`the proofreading shows ${only ? `only ${only}'s tool` : 'no aid at all'}`, async ({ page, request }, testInfo) => {
    await seededProof(page, request, testInfo, only ? [only] : []);
    for (const [aid, testId] of Object.entries(AID_CONTROLS)) {
      await expect(page.getByTestId(testId), `${aid}'s control`).toHaveCount(aid === only ? 1 : 0);
    }
    await expect(page.getByTestId('battle-parchment').getByText('2 pièges sont cachés dans ce texte.')).toHaveCount(only === 'palamede' ? 1 : 0);
    // HpBar writes `data-segments={hp.segments ?? ''}`: empty when the hold has no notches.
    await expect(page.getByTestId('battle-hp')).toHaveAttribute('data-segments', only === 'palamede' ? '2' : '');
    await expect(page.getByTestId('btn-whole')).toHaveCount(1);
  });
}

test('without Argus, « J\'ai terminé » validates at once: no passes left to confirm', async ({ page, request }, testInfo) => {
  await seededProof(page, request, testInfo, ['athena']);
  await tap(page.getByTestId('btn-done-proofreading'), testInfo);
  await expect(page.getByRole('button', { name: 'Oui, valider' })).toHaveCount(0);
  await expectBattle(page, 'victory');
});
```

`web/e2e/scenes-battle.spec.ts` `'a boss battle reopened from the shelves…'`: seed `aids: ['palamede']` instead of `help: 3`; comment "The battle's own aids, kept with it (spec 2026-09-29 §3)"; the send assertion becomes `expect(sent).toMatchObject({ encounter: 'eris', quest_id: 4242, pace_level: 3, aids: ['palamede'] }); expect(sent).not.toHaveProperty('help_stage');` and the in-battle comment "Palamède's count, no Argus passes".

`web/e2e/world.spec.ts` step 8: replace the `?help=3` navigation and its comment with

```ts
    // Spec 2026-09-29 §3: Argus left at the camp (the hero's remembered aids), so « J'ai terminé »
    // validates at once, with no « passes left » confirm.
    const patched = await page.request.patch(`/api/profiles/${profileId}`, { data: { settings: { aids: ['palamede'] } } });
    expect(patched.ok()).toBeTruthy();
    await page.goto(`/#/p/${profileId}/play/${textId}`);
```

and drop every `helpStage: …` from its `postSession` calls.

`web/e2e/playability-ui4.spec.ts`: the proofreading walk (`proofSection`) and the viewport shots navigate with `?help=${help}`: navigate without it and, before each `goto`, call `setSavedAids(page, w.profileId, w.texts.long, aids)` with `1` → `['argus', 'ariane', 'persee', 'athena']`, `3` → `['ariane', 'persee', 'athena', 'palamede']`, `4` → `[]` (rename the shot labels `stage1`/`stage3` to `argus`/`palamede`).

`grep -rn "help_stage\|helpStage\|?help=\|help:" web/e2e` must print nothing.

- [ ] **Step 14: Run everything this task touched**

Run: `scripts/pytest.sh -q` ; `scripts/npm.sh run test` ; `scripts/npm.sh run check`
Run: `STACK=prog scripts/playwright.sh scenes-battle-play.spec.ts --repeat-each=3` ; `STACK=prog scripts/playwright.sh scenes-battle.spec.ts -g "boss battle reopened" --repeat-each=3` ; `STACK=prog scripts/playwright.sh scenes-cabin.spec.ts -g "journal opens" --repeat-each=3` ; `STACK=prog scripts/playwright.sh world.spec.ts` ; `STACK=prog scripts/playwright.sh scenes-battle-victory scenes-cabin happy-path`
Expected: all pass, `0 errors and 0 warnings`.

- [ ] **Step 15: Commit**

```bash
git add web/src/lib/battle/proofAids.ts web/src/lib/battle/proofAids.test.ts web/src/lib/playState.ts web/src/lib/playState.test.ts web/src/screens/Play.svelte web/src/components/battle/ProofPhase.svelte web/src/components/battle/VictoryPhase.svelte web/src/lib/battle/hp.ts web/src/lib/battle/hp.test.ts web/src/lib/battle/lines.ts web/src/lib/battle/lines.test.ts web/src/lib/argus.ts web/src/screens/Boss.svelte web/src/components/battle/BossMuster.svelte web/src/lib/world/api.ts web/src/lib/world/types.ts web/src/lib/types.ts web/src/lib/routes.test.ts web/src/lib/world/quests.test.ts web/src/lib/audio/store.svelte.test.ts web/src/lib/tours/seen.svelte.test.ts web/src/lib/world/journal.ts web/src/lib/world/journal.test.ts web/src/components/places/cabin/JournalPanel.svelte server/app/routers/sessions.py server/app/stats.py server/app/schemas.py server/app/routers/profiles.py server/app/routers/stats.py server/app/routers/world.py server/tests/test_sessions.py server/tests/test_stats_logic.py server/tests/test_profiles.py server/tests/test_world_api.py server/tests/test_progression.py web/e2e/helpers.ts web/e2e/scenes-battle-play.spec.ts web/e2e/scenes-battle.spec.ts web/e2e/world.spec.ts web/e2e/playability-ui4.spec.ts web/e2e/scenes-cabin.spec.ts
git commit -m "The review aids replace the help stage: each aid taken along brings its tool to the proofreading, the others are absent; the owl's hints come from the rules; the journal says which aids were taken last; the help stage, its URL override, its message and its API fields go (the columns stay)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/lib/battle/proofAids.ts web/src/lib/battle/proofAids.test.ts web/src/lib/playState.ts web/src/lib/playState.test.ts web/src/screens/Play.svelte web/src/components/battle/ProofPhase.svelte web/src/components/battle/VictoryPhase.svelte web/src/lib/battle/hp.ts web/src/lib/battle/hp.test.ts web/src/lib/battle/lines.ts web/src/lib/battle/lines.test.ts web/src/lib/argus.ts web/src/screens/Boss.svelte web/src/components/battle/BossMuster.svelte web/src/lib/world/api.ts web/src/lib/world/types.ts web/src/lib/types.ts web/src/lib/routes.test.ts web/src/lib/world/quests.test.ts web/src/lib/audio/store.svelte.test.ts web/src/lib/tours/seen.svelte.test.ts web/src/lib/world/journal.ts web/src/lib/world/journal.test.ts web/src/components/places/cabin/JournalPanel.svelte server/app/routers/sessions.py server/app/stats.py server/app/schemas.py server/app/routers/profiles.py server/app/routers/stats.py server/app/routers/world.py server/tests/test_sessions.py server/tests/test_stats_logic.py server/tests/test_profiles.py server/tests/test_world_api.py server/tests/test_progression.py web/e2e/helpers.ts web/e2e/scenes-battle-play.spec.ts web/e2e/scenes-battle.spec.ts web/e2e/world.spec.ts web/e2e/playability-ui4.spec.ts web/e2e/scenes-cabin.spec.ts
```

(add `web/src/lib/argus.test.ts` to both lists if it pinned `HINTS_PER_STAGE`)

---

### Task 5: The words around the aids — the bestiary, the fight's rule

**Files:**
- Modify: `web/src/lib/world/bestiary.ts`, `web/src/lib/battle/lines.ts` (+ test: `MUSTER.boss`, `BOSS.rules`), `web/src/components/battle/BossMuster.svelte`, `web/src/screens/Boss.svelte`, `web/src/components/battle/MusterPhase.svelte` (a `rules` prop), `web/src/screens/Play.svelte` (passes it)
- Test: `web/e2e/scenes-battle-victory.spec.ts` (the boss muster's rules), `web/e2e/scenes-battle-play.spec.ts` (the boss banner)

(The journal's aids line lives in Task 4, Step 10b: `Profile.help_stage`, which the journal read, goes there.)

**Interfaces:**
- Consumes: `rulesOf`, `GameRules` (Task 3); `campStore.catalog`; `Play.svelte`'s `rules` derived (Task 4).
- Produces:
  - `lines.ts`: `MUSTER.boss: (max: number) => string`, `BOSS.rules: (max: number) => string`.
  - `MusterPhase` prop `rules: GameRules`; `BossMuster` prop `fightMax: number`.

- [ ] **Step 1: Write the failing test** — `web/src/lib/battle/lines.test.ts`: add

```ts
  it("states the fight's rule from the rules file, and nothing of Argus (spec 2026-09-29 §2, §3)", () => {
    expect(L.MUSTER.boss(4)).toBe("Combat contre Éris\u202f: elle s'enfuit si ta copie garde 4 fautes au plus pour 100 mots.");
    expect(L.MUSTER.boss(1)).toBe("Combat contre Éris\u202f: elle s'enfuit si ta copie garde 1 faute au plus pour 100 mots.");
    expect(L.BOSS.rules(4)).toBe("Un long texte. Si ta copie garde 4 fautes au plus pour 100 mots, Éris s'enfuit\u202f; sinon, tu pourras revenir l'affronter.");
    for (const s of [L.MUSTER.boss(4), L.BOSS.rules(4)]) expect(s).not.toMatch(/Argus/);
  });
```

- [ ] **Step 2: Run it to see it fail**

Run: `scripts/npm.sh run test -- src/lib/battle/lines.test.ts`
Expected: FAIL (`MUSTER.boss` and `BOSS.rules` are strings).

- [ ] **Step 3: The bestiary** — `web/src/lib/world/bestiary.ts`, the Argus and Muses `inGame` lines (spec §3: the Muses no longer switch aids on and off):

```ts
    inGame: "Les Yeux d'Argus éclairent une seule catégorie de mots à la fois pendant la relecture\u202f; avant chaque combat, tu choisis de les emporter ou de les laisser au camp.",
```

```ts
    inGame: "Au camp, les Muses te confient la garde des textes\u202f; avant chaque combat, tu choisis toi-même les aides que tu emportes.",
```

- [ ] **Step 4: The fight's rule** — `web/src/lib/battle/lines.ts`:

```ts
  /** Spec 2026-09-29 §2: the fight is won on the copy (`fight_max_per_100`, the rules file). */
  boss: (max: number) => `Combat contre Éris\u202f: elle s'enfuit si ta copie garde ${plural(max, 'faute', 'fautes')} au plus pour 100 mots.`,
```

(replacing `MUSTER.boss`), and in `BOSS`:

```ts
  rules: (max: number) =>
    `Un long texte. Si ta copie garde ${plural(max, 'faute', 'fautes')} au plus pour 100 mots, Éris s'enfuit\u202f; sinon, tu pourras revenir l'affronter.`,
```

`BossMuster.svelte`: add the prop `fightMax: number` (doc: "The fight's threshold, mistakes left per 100 words (the rules file).") and render `{BOSS.rules(fightMax)}`. `Boss.svelte`: `import { rulesOf } from '../lib/rules';` and pass `fightMax={rulesOf(campStore.catalog).fight_max_per_100}`.

`MusterPhase.svelte`: add the prop `rules: GameRules` (`import type { GameRules } from '../../lib/rules';`, doc "The camp's rules (spec 2026-09-29 §7): the fight's threshold, the bonuses.") and render `{MUSTER.boss(rules.fight_max_per_100)}` in `play-boss-banner`. `Play.svelte`: `<MusterPhase … {rules} …>` (the `rules` derived exists since Task 4).

- [ ] **Step 5: The e2e**

`web/e2e/scenes-battle-victory.spec.ts` (the boss muster): `toContainText("Un long texte. Si ta copie garde 4 fautes au plus pour 100 mots, Éris s'enfuit\u202f; sinon, tu pourras revenir l'affronter.")`.

`web/e2e/scenes-battle-play.spec.ts` `'a boss dictation locks the slower paces and says why'`: `toHaveText("Combat contre Éris\u202f: elle s'enfuit si ta copie garde 4 fautes au plus pour 100 mots.")`.

Run: `STACK=prog scripts/playwright.sh scenes-battle-victory.spec.ts scenes-battle-play.spec.ts -g "boss" --repeat-each=3` ; `STACK=prog scripts/playwright.sh scenes-war.spec.ts` (the bestiary pages)
Expected: all pass.

- [ ] **Step 6: Check and commit**

Run: `scripts/npm.sh run test` ; `scripts/npm.sh run check`
Expected: all pass, `0 errors and 0 warnings`.

```bash
git add web/src/lib/world/bestiary.ts web/src/lib/battle/lines.ts web/src/lib/battle/lines.test.ts web/src/components/battle/BossMuster.svelte web/src/screens/Boss.svelte web/src/components/battle/MusterPhase.svelte web/src/screens/Play.svelte web/e2e/scenes-battle-victory.spec.ts web/e2e/scenes-battle-play.spec.ts
git commit -m "The bestiary's Argus and Muses no longer switch aids; Éris's fight states its copy rule on her muster and at the battle's head

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/lib/world/bestiary.ts web/src/lib/battle/lines.ts web/src/lib/battle/lines.test.ts web/src/components/battle/BossMuster.svelte web/src/screens/Boss.svelte web/src/components/battle/MusterPhase.svelte web/src/screens/Play.svelte web/e2e/scenes-battle-victory.spec.ts web/e2e/scenes-battle-play.spec.ts
```

---

### Task 6: The pace-and-aids screen

**Files:**
- Create: `web/src/components/battle/AidToggles.svelte`, `web/e2e/scenes-muster.spec.ts`
- Modify: `web/src/components/battle/MusterPhase.svelte`, `web/src/components/battle/PaceMedallions.svelte`, `web/src/lib/battle/lines.ts` (+ test: `MUSTER`), `web/src/screens/Play.svelte` (passes `recent`)
- Test: `web/e2e/scenes-battle-play.spec.ts` (the muster test)

**Interfaces:**
- Consumes: `AID_KEYS`, `AID_LABELS`, `aidDesc`, `aidIcon`, `bonusParts`, `suggestion`, `listFr`, `RecentDefence`, `AidKey` (Task 3); `paceBonus`, `prophecyBonusApplies`, `GameRules` (Task 3); `PlayState.aids` (Task 4); `MusterPhase.rules` (Task 5).
- Produces:
  - `AidToggles` props: `aids: AidKey[]` (bindable), `rules: GameRules`, `wide: boolean`, `highlight?: AidKey | null`. Test ids: `muster-aids`, `aid-toggle-<key>` (`aria-pressed`, `data-suggested="true"` on the highlighted one), `aid-bonus-<key>`, `aid-desc` (narrow).
  - `PaceMedallions` props gain `bonuses: Record<Pace, number>` and `row?: boolean`; test ids `pace-bonus-<p>`, `pace-desc` (row).
  - `MusterPhase` gains `recent: readonly RecentDefence[]`; root `data-testid="muster"` with `data-layout="wide|narrow"`; `muster-bonus`, `muster-prophecy-bonus`, `muster-suggestion`, `btn-start`, `muster-aids-reminder`.
  - `MUSTER` gains `aidsHeading`, `take`, `leave`, `bonusTag`, `total`, `prophecyTag`, `suggestLeave`, `suggestTake`, `aidsReminder`; `paceHeading` becomes « Ton rythme »; `paceGlory` removed.

- [ ] **Step 1: Write the failing e2e** — `web/e2e/scenes-muster.spec.ts`:

```ts
// Spec 2026-09-29 §5: the pace-and-aids screen. One screen, no scrolling at 1280×800 and on the iPad in
// landscape (and at 1024×768), the start button always in view; the aids' choice, its bonus, its
// suggestion (never automatic), its memory.
import type { APIRequestContext, Page, TestInfo } from '@playwright/test';
import { test, expect } from './crashGuard';
import { createProfileApi, createText, expectBattle, makeResult, postSession, swissDay, tap, uniqueName } from './helpers';

const BODY = 'Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.';
const ALL = ['argus', 'ariane', 'persee', 'athena', 'palamede'];

async function muster(page: Page, request: APIRequestContext, testInfo: TestInfo, o: { level?: string; due?: string; query?: string } = {}) {
  const id = await createProfileApi(request, uniqueName(`Mst-${testInfo.project.name}`), o.level ?? '10H');
  const text = await createText(request, { title: uniqueName('Rassemblement'), body: BODY, level: '10H', ...(o.due ? { due_date: o.due } : {}) });
  await page.goto(`/#/p/${id}/play/${text.id}${o.query ?? ''}`);
  await expectBattle(page, 'muster');
  await expect(page.getByTestId('muster')).toBeVisible();
  return { id, text };
}

/** The whole muster fits its parchment: nothing to scroll. */
const fits = (page: Page) => page.getByTestId('muster').evaluate((el) => el.scrollHeight <= el.clientHeight + 1);

/** The start button lies wholly inside the muster's visible box. */
async function startInView(page: Page): Promise<boolean> {
  const start = await page.getByTestId('btn-start').boundingBox();
  const box = await page.getByTestId('muster').boundingBox();
  return !!start && !!box && start.y >= box.y - 1 && start.y + start.height <= box.y + box.height + 1;
}

for (const [width, height, layout] of [
  [1280, 800, 'wide'],
  [1180, 820, 'wide'],
  [1024, 768, 'narrow'],
] as const) {
  test(`at ${width}×${height} the muster fits without scrolling, in its ${layout} layout`, async ({ page, request }, testInfo) => {
    await page.setViewportSize({ width, height });
    await muster(page, request, testInfo);
    await expect(page.getByTestId('muster')).toHaveAttribute('data-layout', layout);
    await expect(page.getByTestId('muster-aids').getByRole('button')).toHaveCount(5);
    await expect.poll(() => fits(page)).toBe(true);
    await expect.poll(() => startInView(page)).toBe(true);
  });
}

test('at phone width the start button stays in view while the muster scrolls', async ({ page, request }, testInfo) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await muster(page, request, testInfo);
  const m = page.getByTestId('muster');
  await expect.poll(() => m.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  await expect.poll(() => startInView(page)).toBe(true);
  await m.evaluate((el) => el.scrollTo({ top: el.scrollHeight / 2 }));
  await expect.poll(() => startInView(page)).toBe(true);
  await m.evaluate((el) => el.scrollTo({ top: 0 }));
  await expect.poll(() => startInView(page)).toBe(true);
});

test('each aid left at the camp adds its bonus to the glory of the battle, pace and prophecy included', async ({ page, request }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const due = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
  await muster(page, request, testInfo, { due });
  await tap(page.getByTestId('pace-option-1'), testInfo);
  await expect(page.getByTestId('muster-bonus')).toContainText('Gloire de ce combat\u202f: +50\u202f%');
  await expect(page.getByTestId('muster-prophecy-bonus')).toHaveText('Prophétie +50\u202f%');
  const owl = page.getByTestId('aid-toggle-athena');
  await expect(owl).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('aid-bonus-athena')).toHaveCount(0);
  await tap(owl, testInfo);
  await expect(owl).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('aid-bonus-athena')).toHaveText('+20\u202f%');
  await expect(page.getByTestId('muster-bonus')).toContainText('+70\u202f%');
  await tap(page.getByTestId('pace-option-2'), testInfo);
  await expect(page.getByTestId('pace-bonus-2')).toHaveText('+25\u202f%');
  await expect(page.getByTestId('pace-bonus-1')).toHaveCount(0);
  await expect(page.getByTestId('muster-bonus')).toContainText('+95\u202f%');
});

test('the aids chosen go with the battle and come back with its resume ribbon', async ({ page, request }, testInfo) => {
  await muster(page, request, testInfo);
  for (const aid of ['athena', 'argus']) await tap(page.getByTestId(`aid-toggle-${aid}`), testInfo);
  await tap(page.getByTestId('btn-start'), testInfo);
  await expectBattle(page, 'dictation');
  await tap(page.getByTestId('btn-quit-dictation'), testInfo);
  await tap(page.getByTestId('btn-quit-confirm'), testInfo);
  await expect(page.getByTestId('muster-aids-reminder')).toHaveText(
    "Tes aides\u202f: le fil d'Ariane, le bouclier de Persée et les jetons de Palamède.",
  );
});

test('the aids taken last are chosen again, and a suggestion only suggests', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Mst7-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Trois belles copies'), body: BODY, level: '10H' });
  // Three belles copies with all five aids: the server remembers them and the camp suggests leaving the owl.
  for (let i = 0; i < 3; i++) {
    await postSession(request, { profileId: id, textId: text.id, day: swissDay(), result: makeResult({ draft: 2, caught: 2 }), aids: ALL });
  }
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'muster');
  await expect(page.getByTestId('muster-suggestion')).toHaveText('Tu pourrais laisser la chouette au camp.');
  const owl = page.getByTestId('aid-toggle-athena');
  await expect(owl).toHaveAttribute('data-suggested', 'true');
  await expect(owl).toHaveAttribute('aria-pressed', 'true');
  for (const aid of ALL) await expect(page.getByTestId(`aid-toggle-${aid}`)).toHaveAttribute('aria-pressed', 'true');
  await tap(owl, testInfo);
  await expect(page.getByTestId('muster-suggestion')).toHaveCount(0);
});

test("the grimoire's muster shows only the aids and its own button; Éris's fight keeps its pace floor", async ({ page, request }, testInfo) => {
  const { id, text } = await muster(page, request, testInfo);
  await page.goto(`/#/p/${id}/grimoire/${text.id}`);
  await expectBattle(page, 'muster');
  await expect(page.getByTestId('muster-aids')).toBeVisible();
  await expect(page.getByRole('radio')).toHaveCount(0);
  await expect(page.getByTestId('btn-open-grimoire')).toBeVisible();
  await page.goto(`/#/p/${id}/play/${text.id}?encounter=eris&quest=1`);
  await expectBattle(page, 'muster');
  await expect(page.getByTestId('muster-aids').getByRole('button')).toHaveCount(5);
  await expect(page.locator('[data-testid^="pace-option-"].disabled').first()).toContainText('Pas pendant un combat');
});
```

(`btn-quit-dictation` and `btn-quit-confirm` are DictationPhase's own test ids.) The hero is 10H (default pace III, +50 %); the text is due in 5 days (prophecy +50 %, R15); pace I brings the total to +50 % (prophecy only).

- [ ] **Step 2: Run it to see it fail**

Run: `STACK=prog scripts/playwright.sh scenes-muster.spec.ts --project=desktop`
Expected: FAIL — no `muster` test id, no aid toggles.

- [ ] **Step 3: The copy** — `web/src/lib/battle/lines.ts` `MUSTER`: `paceHeading: 'Ton rythme',`; delete `paceGlory`; add (import `listFr` from `../aids`):

```ts
  // Spec 2026-09-29 §5: the aids' column, the bonuses, the suggestion, the resume ribbon's reminder.
  aidsHeading: 'Tes aides',
  take: 'Emporter',
  leave: 'Laisser au camp',
  bonusTag: (x: number) => `+${Math.round(x * 100)}\u202f%`,
  total: (x: number) => `Gloire de ce combat\u202f: +${Math.round(x * 100)}\u202f%`,
  prophecyTag: (x: number) => `Prophétie +${Math.round(x * 100)}\u202f%`,
  suggestLeave: (the: string) => `Tu pourrais laisser ${the} au camp.`,
  suggestTake: (the: string) => `Tu pourrais reprendre ${the} avec toi.`,
  aidsReminder: (names: readonly string[]) => (names.length > 0 ? `Tes aides\u202f: ${listFr(names)}.` : 'Aucune aide\u202f: toutes sont restées au camp.'),
```

`web/src/lib/battle/lines.test.ts`: add

```ts
  it('tells the muster its bonuses and its suggestion (spec 2026-09-29 §5)', () => {
    expect([L.MUSTER.bonusTag(0.25), L.MUSTER.total(0.65), L.MUSTER.prophecyTag(0.5)]).toEqual(['+25\u202f%', 'Gloire de ce combat\u202f: +65\u202f%', 'Prophétie +50\u202f%']);
    expect(L.MUSTER.suggestLeave('la chouette')).toBe('Tu pourrais laisser la chouette au camp.');
    expect(L.MUSTER.suggestTake("les yeux d'Argus")).toBe("Tu pourrais reprendre les yeux d'Argus avec toi.");
    expect(L.MUSTER.aidsReminder(['la chouette', "le fil d'Ariane"])).toBe("Tes aides\u202f: la chouette et le fil d'Ariane.");
    expect(L.MUSTER.aidsReminder([])).toBe('Aucune aide\u202f: toutes sont restées au camp.');
  });
```

- [ ] **Step 4: `AidToggles.svelte`**

```svelte
<script lang="ts">
  // The five review aids on the muster (spec 2026-09-29 §3, §5): each taken along or left at the camp.
  // Wide: five compact rows (a 40 px emblem, the name, one line, the choice, the « +20 % » tag when left).
  // Narrow: one row of five 48 px emblem toggles with their names under them, the focused one's line
  // below. A suggested aid is ringed; the choice is always the child's (never changed from here).
  import { untrack } from 'svelte';
  import { AID_KEYS, AID_LABELS, aidDesc, aidIcon, type AidKey } from '../../lib/aids';
  import { MUSTER } from '../../lib/battle/lines';
  import type { GameRules } from '../../lib/rules';

  let {
    aids = $bindable(),
    rules,
    wide,
    highlight = null,
  }: { aids: AidKey[]; rules: GameRules; wide: boolean; highlight?: AidKey | null } = $props();

  let focused = $state<AidKey>(untrack(() => highlight) ?? 'argus');

  function toggle(key: AidKey) {
    aids = aids.includes(key) ? aids.filter((k) => k !== key) : AID_KEYS.filter((k) => k === key || aids.includes(k));
    focused = key;
  }
</script>

<fieldset class="aids" class:wide data-testid="muster-aids">
  <legend class="section">{MUSTER.aidsHeading}</legend>
  <div class="list">
    {#each AID_KEYS as key (key)}
      {@const taken = aids.includes(key)}
      {@const icon = aidIcon(key)}
      <button
        type="button"
        class="aid"
        class:taken
        class:suggested={highlight === key}
        data-testid="aid-toggle-{key}"
        data-suggested={highlight === key ? 'true' : undefined}
        aria-pressed={taken}
        aria-describedby={wide ? undefined : 'aid-desc'}
        onclick={() => toggle(key)}
        onfocus={() => (focused = key)}
        onpointerenter={() => (focused = key)}
      >
        {#if icon}<img class="emblem" src={icon} alt="" />{:else}<span class="emblem kit-medallion" aria-hidden="true"></span>{/if}
        <span class="words">
          <span class="name">{AID_LABELS[key].name}</span>
          {#if wide}<span class="desc">{aidDesc(key, rules)}</span>{/if}
        </span>
        {#if wide}<span class="state" aria-hidden="true">{taken ? MUSTER.take : MUSTER.leave}</span>{/if}
        {#if !taken}<span class="kit-tag bonus" data-testid="aid-bonus-{key}">{MUSTER.bonusTag(rules.aid_bonus)}</span>{/if}
      </button>
    {/each}
  </div>
  {#if !wide}<p class="focused-desc" id="aid-desc" data-testid="aid-desc">{aidDesc(focused, rules)}</p>{/if}
</fieldset>

<style>
  .aids {
    margin: 0;
    padding: 0;
    border: 0;
    min-width: 0;
  }
  .section {
    margin: 0 0 8px;
    padding: 0;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 17px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--bronze-dark);
  }
  .list {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 6px;
  }
  .wide .list {
    grid-template-columns: minmax(0, 1fr);
    gap: 4px;
  }
  .aid {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    min-height: 48px;
    padding: 6px 4px;
    border-radius: 10px;
    border: 2px solid rgba(138, 90, 40, 0.25);
    background: rgba(255, 250, 238, 0.45);
    color: var(--ink);
    font: inherit;
    cursor: pointer;
  }
  .wide .aid {
    flex-direction: row;
    text-align: left;
    gap: 10px;
    padding: 4px 10px;
  }
  .aid.taken {
    border-color: var(--gold);
    background: rgba(255, 247, 222, 0.96);
  }
  .aid:not(.taken) .emblem {
    opacity: 0.45;
    filter: grayscale(0.6);
  }
  .aid.suggested {
    box-shadow: 0 0 0 3px var(--gold-light), 0 0 12px rgba(255, 220, 140, 0.7);
  }
  .aid:focus-visible {
    outline: 3px solid var(--gold-light);
    outline-offset: 2px;
  }
  .emblem {
    flex: none;
    width: 48px;
    height: 48px;
    object-fit: contain;
  }
  .wide .emblem {
    width: 40px;
    height: 40px;
  }
  .words {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .name {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 14px;
    line-height: 1.15;
    text-align: center;
  }
  .wide .name {
    font-size: 16px;
    text-align: left;
  }
  .desc {
    font-size: 14px;
    line-height: 1.25;
    color: var(--ink-soft);
  }
  .state {
    margin-left: auto;
    flex: none;
    font-size: 13px;
    font-style: italic;
    color: var(--ink-soft);
  }
  .bonus {
    font-size: 13px;
    padding-top: 2px;
    padding-bottom: 2px;
  }
  .bonus::after {
    display: none;
  }
  .focused-desc {
    margin: 6px 0 0;
    font-size: 15px;
    color: var(--ink-soft);
    text-align: center;
  }
</style>
```

- [ ] **Step 5: `PaceMedallions.svelte`** — replace the script and markup (keep the existing styles; add the ones below):

```svelte
<script lang="ts">
  // The three paces as bronze medallions (UI4 Task 3; Ruling C8's names; pace IV retired by the pace
  // redesign): real radios, the label is the tap target. `minPace` (SP3 Task 7): in a boss fight the
  // slower paces stay visible, locked, with the reason. Spec 2026-09-29 §5: each shows its bonus tag;
  // `row` (the narrow muster, plan Ruling R6) puts the three side by side with the chosen one's
  // description under them.
  import { PACES, PACE_LABELS, type Pace } from '../../lib/dictation/script';
  import { MUSTER } from '../../lib/battle/lines';

  let {
    pace = $bindable(),
    minPace = 1,
    bonuses,
    row = false,
  }: { pace: Pace; minPace?: Pace; bonuses: Record<Pace, number>; row?: boolean } = $props();
  const ROMAN = ['', 'I', 'II', 'III'];
</script>

<fieldset class="paces" class:row>
  <legend class="section">{MUSTER.paceHeading}</legend>
  <div class="grid" role="radiogroup" aria-label="Rythme de la dictée">
    {#each PACES as p (p)}
      {@const disabled = p < minPace}
      <label class="pace" class:selected={pace === p} class:disabled data-testid="pace-option-{p}">
        <input type="radio" name="pace" value={p} checked={pace === p} {disabled} onchange={() => (pace = p)} />
        <span class="kit-medallion seal" aria-hidden="true">{ROMAN[p]}</span>
        <span class="words">
          <span class="title">{PACE_LABELS[p].title}</span>
          {#if !row || disabled}<span class="desc">{disabled ? MUSTER.paceLocked : PACE_LABELS[p].description}</span>{/if}
        </span>
        {#if bonuses[p] > 0}<span class="kit-tag bonus" data-testid="pace-bonus-{p}">{MUSTER.bonusTag(bonuses[p])}</span>{/if}
      </label>
    {/each}
  </div>
  {#if row}<p class="row-desc" data-testid="pace-desc">{PACE_LABELS[pace].description}</p>{/if}
</fieldset>
```

Styles to add:

```css
  .row .grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .row .pace {
    flex-direction: column;
    text-align: center;
    gap: 4px;
    padding: 6px;
  }
  .bonus {
    margin-left: auto;
    flex: none;
    font-size: 13px;
    padding-top: 2px;
    padding-bottom: 2px;
  }
  .row .bonus {
    margin-left: 0;
  }
  .bonus::after {
    display: none;
  }
  .row-desc {
    margin: 6px 0 0;
    font-size: 15px;
    line-height: 1.3;
    color: var(--ink-soft);
    text-align: center;
  }
```

- [ ] **Step 6: `MusterPhase.svelte`** — the header comment becomes:

```ts
  // The muster (UI4 Task 3; spec 2026-09-29 §5, the pace-and-aids screen): the order of battle on the
  // parchment. The resume ribbon when a dictation or a proofreading waits, with a one-line reminder of
  // the aids taken; otherwise the title over one line of tags, Éris's taunt on her voice plate (Ruling
  // C7), then « Ton rythme » and « Tes aides » side by side on a wide parchment (one column on a narrow
  // one), and a start bar that stays in view (plan Ruling R7): the glory this battle is worth, the
  // suggestion if any, « Commencer la dictée » and the grimoire's way (Ruling R8). The grimoire shows
  // only the aids and « Ouvrir le grimoire ». One screen, no scrolling, at 1280×800 and on the iPad.
```

Script additions (keep the existing ones; `rules` exists since Task 5):

```ts
  import AidToggles from './AidToggles.svelte';
  import { AID_LABELS, bonusParts, suggestion, type RecentDefence } from '../../lib/aids';
  import { PACES, PACE_LABELS, type Pace } from '../../lib/dictation/script';
  import { paceBonus, prophecyBonusApplies, type GameRules } from '../../lib/rules';

  // props: add
  //   recent,
  //   /** The last defences (the stats' recent sessions), for the suggestion (spec §3). */
  //   recent: readonly RecentDefence[];

  // Spec §5: two columns from a 40 rem parchment (1280×800, the iPad in landscape), one below it (Ruling R6).
  const REM = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  let width = $state(0);
  const wide = $derived(width >= 40 * REM);

  const paceBonuses = $derived(Object.fromEntries(PACES.map((p) => [p, paceBonus(p, mode, rules)])) as Record<Pace, number>);
  const bonus = $derived(
    bonusParts({ pace: playState.pace, mode, aids: playState.aids, prophecy: prophecyBonusApplies(text.due_date) }, rules),
  );
  // Only ever suggested (spec §3): the toggles stay as the child set them.
  const suggested = $derived(suggestion(recent, playState.aids, rules));
  const suggestionLine = $derived(
    suggested === null
      ? null
      : suggested.kind === 'leave'
        ? MUSTER.suggestLeave(AID_LABELS[suggested.aid].the)
        : MUSTER.suggestTake(AID_LABELS[suggested.aid].the),
  );
```

Markup: the root becomes

```svelte
<div
  class="muster"
  class:short={mode === 'grimoire' && !resume}
  class:with-bar={!resume}
  class:wide
  data-testid="muster"
  data-layout={wide ? 'wide' : 'narrow'}
  bind:clientWidth={width}
>
```

In the resume sheet, after the `.actions` div:

```svelte
        <p class="aids-reminder" data-testid="muster-aids-reminder">{MUSTER.aidsReminder(playState.aids.map((k) => AID_LABELS[k].the))}</p>
```

The head: the title stays; `credits` moves into the tags line (`{#if credits(text)}<span class="credits">{credits(text)}</span>{/if}` as the tags' last child); the boss banner stays under the tags. Taunt, muted-voice note and sheet fold unchanged.

The grimoire branch becomes:

```svelte
    {#if mode === 'grimoire'}
      <p class="rule">{MUSTER.grimoireRule}</p>
      <AidToggles bind:aids={playState.aids} {rules} {wide} highlight={suggested?.aid ?? null} />
      <div class="start-bar">
        <p class="total" data-testid="muster-bonus">{MUSTER.total(bonus.total)}</p>
        {#if suggestionLine}<p class="suggestion" data-testid="muster-suggestion">{suggestionLine}</p>{/if}
        {#if corruptError}
          <div class="kit-note" data-tone="eris" role="alert">
            <p>{corruptError}</p>
            <button type="button" class="kit-bronze is-quiet" data-testid="btn-back-library" onclick={onToLibrary}>{MUSTER.backToShelves}</button>
          </div>
        {:else if corrupting}
          <p class="kit-ribbon waiting">{MUSTER.corrupting}</p>
        {:else}
          <button type="button" class="kit-bronze grand" data-testid="btn-open-grimoire" onclick={onOpenGrimoire}>{MUSTER.openGrimoire}</button>
        {/if}
      </div>
```

and the dictation branch (replacing the PaceMedallions, `glory`, start button and `grimoire-way`):

```svelte
    {:else}
      <div class="choices">
        <PaceMedallions bind:pace={playState.pace} {minPace} bonuses={paceBonuses} row={!wide} />
        <AidToggles bind:aids={playState.aids} {rules} {wide} highlight={suggested?.aid ?? null} />
      </div>
      <div class="start-bar">
        <p class="total" data-testid="muster-bonus">
          {MUSTER.total(bonus.total)}
          {#if bonus.prophecy > 0}<span class="kit-tag prophecy-bonus" data-testid="muster-prophecy-bonus">{MUSTER.prophecyTag(bonus.prophecy)}</span>{/if}
        </p>
        {#if suggestionLine}<p class="suggestion" data-testid="muster-suggestion">{suggestionLine}</p>{/if}
        <div class="start-row">
          <button type="button" class="kit-bronze grand" data-testid="btn-start" onclick={onStart}>{MUSTER.start}</button>
          <!-- UI4 playability #8: the fight against Éris has one way in and no side door; a lieutenant's
               grimoire keeps its encounter, so it is still that lieutenant's battle. -->
          {#if encounter !== 'eris'}
            <button
              type="button"
              class="kit-bronze is-quiet"
              data-testid="btn-grimoire"
              onclick={() => go(href('grimoire', { profileId: String(profileId), textId: String(text.id) }, grimoireQuery))}
            >
              {MUSTER.grimoire}
            </button>
          {/if}
        </div>
      </div>
      {#if encounter !== 'eris'}<p class="caption">{MUSTER.grimoireCaption}</p>{/if}
    {/if}
```

Styles: delete `.glory` and `.grimoire-way`; change `.muster-title` to `font-size: 22px`, `.muster` gap to `12px` and padding to `14px 20px`; add:

```css
  /* Plan Ruling R7: the start bar is the muster's foot, so the fade that says "more below" goes. */
  .muster.with-bar {
    -webkit-mask-image: none;
    mask-image: none;
  }
  .choices {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }
  .muster.wide .choices {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    align-items: start;
  }
  /* Spec §5: « Commencer la dictée » stays in view, sticky at the bottom of the parchment. */
  .start-bar {
    position: sticky;
    bottom: 0;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    margin: 0 -20px;
    padding: 8px 20px 6px;
    background:
      linear-gradient(var(--battle-parchment-edge), var(--battle-parchment-edge)),
      var(--tex-parchment);
    box-shadow: 0 -8px 12px -10px rgba(60, 35, 10, 0.45);
  }
  .total {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 4px 10px;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 17px;
  }
  .prophecy-bonus::after {
    display: none;
  }
  .suggestion {
    margin: 0;
    font-size: 16px;
    font-style: italic;
    text-align: center;
  }
  .start-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }
  .caption {
    margin: 0;
    align-self: center;
    max-width: 34em;
    font-size: 15px;
    color: var(--ink-soft);
    text-align: center;
  }
  .credits {
    font-size: 15px;
    font-style: italic;
    color: var(--ink-soft);
  }
  .aids-reminder {
    margin: 0;
    font-size: 16px;
    color: var(--ink-soft);
  }
```

(`.credits`'s old block margin rule goes.) Keep `.grand` but add `min-height: 56px` (already) and leave `align-self` to the row.

If the 1024×768 or 1280×800 test still scrolls, measure the overflow in the failing run's screenshot and tighten, in this order: the taunt plate's margins, `.choices` gap, the pace rows' `min-height` (never below 48 px), the head's gaps. Never drop a control or a line of the spec's list.

`Play.svelte`: `<MusterPhase … recent={stats?.recent_sessions ?? []} …>`.

- [ ] **Step 7: The existing muster test** — `web/e2e/scenes-battle-play.spec.ts` `'the muster is an order of battle…'`: replace the `paceGlory` assertion with `await expect(sheet.getByTestId('muster-bonus')).toContainText('Gloire de ce combat');`, and add `await expect(sheet.getByTestId('muster-aids').getByRole('button')).toHaveCount(5);`. Its `sheet.getByRole('radio')` count stays 3.

- [ ] **Step 8: Run**

Run: `scripts/npm.sh run test -- src/lib/battle/lines.test.ts` ; `scripts/npm.sh run check`
Run: `STACK=prog scripts/playwright.sh scenes-muster.spec.ts --repeat-each=3` ; `STACK=prog scripts/playwright.sh scenes-battle-play scenes-battle world.spec.ts happy-path`
Expected: all pass (both projects for `scenes-*`), `0 errors and 0 warnings`.

- [ ] **Step 9: Commit**

```bash
git add web/src/components/battle/AidToggles.svelte web/src/components/battle/MusterPhase.svelte web/src/components/battle/PaceMedallions.svelte web/src/lib/battle/lines.ts web/src/lib/battle/lines.test.ts web/src/screens/Play.svelte web/e2e/scenes-muster.spec.ts web/e2e/scenes-battle-play.spec.ts
git commit -m "The pace-and-aids screen: the five aids beside the paces, every bonus shown before the battle, the suggestion that only suggests, a start bar always in view; the resume ribbon names the aids taken

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/components/battle/AidToggles.svelte web/src/components/battle/MusterPhase.svelte web/src/components/battle/PaceMedallions.svelte web/src/lib/battle/lines.ts web/src/lib/battle/lines.test.ts web/src/screens/Play.svelte web/e2e/scenes-muster.spec.ts web/e2e/scenes-battle-play.spec.ts
```

---

### Task 7: The victory — the copy line and the XP chips

**Files:**
- Modify: `web/src/lib/grading/grade.ts` (+ `grade.test.ts`), `web/src/lib/grading/types.ts`, `web/src/lib/world/derived.test.ts`, `web/src/screens/Play.svelte`, `web/src/lib/types.ts` (`SessionCreate.score`), `web/src/components/battle/VictoryPhase.svelte`, `web/src/components/battle/VictorySheet.svelte`, `web/src/components/battle/VictorySpoils.svelte`, `web/src/lib/battle/lines.ts` (+ test), `web/src/lib/battle/hp.ts` (+ test), `web/src/lib/world/types.ts` (`Progression.boss`)
- Test: `web/e2e/scenes-battle-victory.spec.ts`, `web/e2e/happy-path.spec.ts`, `web/e2e/playability-ui4.spec.ts`, `web/e2e/helpers.ts` (`makeResult` loses `score`)

**Interfaces:**
- Consumes: `per100`, `copyVerdict`, `CopyVerdict`, `rulesOf` (Task 3); `Progression.xp.parts` (Tasks 2-3).
- Produces: `VICTORY.copy(mistakes: number, words: number, verdict: CopyVerdict): string`; `VictorySheet` prop `copy: string` (test id `results-copy`, replacing `results-score`); XP chips with `data-testid="xp-chip"`; `gradeSession(reference, draft, final, annotation)` (no options); `SessionResult.score`, `computeScore`, `SessionCreate.score`, `VICTORY.score`, `VICTORY.bossTooEasy` removed; `Progression.boss: { tier: number; won: boolean } | null`; `outcomeOf(r, boss: { won: boolean } | null)`, `reckoningVerdict(r, { bossFight; progression: { boss: { won: boolean } | null } | null })`.

- [ ] **Step 1: Write the failing tests**

`web/src/lib/battle/lines.test.ts`: in `'tells the tally without a score…'` replace `L.VICTORY.score(94)` in the array by `L.VICTORY.copy(3, 150, 'belle')` and the `score` `toBe` by:

```ts
    expect(L.VICTORY.copy(3, 150, 'belle')).toBe('Ta copie\u202f: 3 fautes sur 150 mots. Une belle copie.');
    expect(L.VICTORY.copy(0, 120, 'belle')).toBe('Ta copie\u202f: pas une faute sur 120 mots. Une belle copie.');
    expect(L.VICTORY.copy(1, 13, 'correcte')).toBe('Ta copie\u202f: 1 faute sur 13 mots. Une copie correcte.');
    expect(L.VICTORY.copy(12, 100, 'reprendre')).toBe('Ta copie\u202f: 12 fautes sur 100 mots. Une copie à reprendre.');
    // Never a grade out of 6 (spec 2026-09-29 §2).
    for (const v of ['belle', 'correcte', 'reprendre'] as const) expect(L.VICTORY.copy(2, 60, v)).not.toMatch(/\bsur 6\b|\/\s*6\b|note/);
```

Drop `L.VICTORY.bossTooEasy` from the Éris list and delete the "too easy" half of `'gives each boss outcome a title and a line that agree…'` (the `tooEasy` lines); the remaining `outcomeOf` calls take `{ won: true }` / `{ won: false }`. Same in `hp.test.ts` (drop `too_easy` from every boss object and delete the `too_easy: true` case).

`web/src/lib/grading/grade.test.ts`: delete `describe('computeScore', …)`, the `computeScore` import, the two `expect(s.score)…` lines, and the `{ paceLevel: N }` argument of every `gradeSession(...)` call; same argument in `web/src/lib/world/derived.test.ts`.

`web/e2e/scenes-battle-victory.spec.ts`: in the victory test that checked `results-score` (around line 59) use

```ts
  await expect(page.getByTestId('results-copy')).toHaveText(/^Ta copie\u202f: (pas une faute|\d+ fautes?) sur \d+ mots?\. Une (belle copie|copie correcte|copie à reprendre)\.$/);
```

(read the test's draft/final to write the exact text instead of the pattern when the numbers are fixed: they are — write the exact line), drop `too_easy` from the progression literals (lines ~373 and ~404), and add after `counted`:

```ts
// Spec 2026-09-29 §4: the session XP broken down, then the quest's.
test('the XP chips break the session down: text, pace, aids, prophecy, then the quest', async ({ page, request }, testInfo) => {
  const sheet = await counted(
    page,
    request,
    `Vic20-${testInfo.project.name}`,
    progression({
      xp: { session: 94, parts: { text: 57, pace: 8, aids: 13, prophecy: 16 }, bonuses: [{ reason: 'board', amount: 60 }], total_before: 487, total_after: 641, rank_before: 3, rank_after: 3, title_after: 'Sentinelle des textes' },
      quests: [{ id: 3, kind: 'board', target: 'hydre', counted: true, progress: 3, goal: 3, completed: true, reward_id: null }],
    }),
  );
  await expect(sheet.getByTestId('xp-chip')).toHaveText(['Texte +57', 'Rythme +8', 'Sans aides +13', 'Prophétie +16', 'Quête +60']);
});

test('a bonus part at zero shows no chip, and a victory saved before the parts keeps its one text chip', async ({ page, request }, testInfo) => {
  const sheet = await counted(
    page,
    request,
    `Vic21-${testInfo.project.name}`,
    progression({ xp: { session: 70, parts: { text: 57, pace: 0, aids: 13, prophecy: 0 }, bonuses: [], total_before: 487, total_after: 557, rank_before: 3, rank_after: 3, title_after: 'Sentinelle des textes' } }),
  );
  await expect(sheet.getByTestId('xp-chip')).toHaveText(['Texte +57', 'Sans aides +13']);
  const old = await counted(page, request, `Vic22-${testInfo.project.name}`, progression());
  await expect(old.getByTestId('xp-chip')).toHaveText(['Texte +51']);
});
```

`web/e2e/happy-path.spec.ts`: replace the `results-score` assertion with the `results-copy` one (the happy path's copy is fixed: write the exact line).

- [ ] **Step 2: Run them to see them fail**

Run: `scripts/npm.sh run test -- src/lib/battle/lines.test.ts src/lib/battle/hp.test.ts src/lib/grading/grade.test.ts src/lib/world/derived.test.ts`
Expected: FAIL (`VICTORY.copy` undefined; `gradeSession` arity is fine but `computeScore` still exported, `score` present).

- [ ] **Step 3: The copy line** — `web/src/lib/battle/lines.ts`: `import type { CopyVerdict } from '../rules';`; in `VICTORY` delete `score` (and its comment) and `bossTooEasy`, and add:

```ts
  /** Spec 2026-09-29 §2: the handed-in copy, in the camp's voice, with the count; never a grade. */
  copy: (mistakes: number, words: number, verdict: CopyVerdict) =>
    `Ta copie\u202f: ${mistakes === 0 ? 'pas une faute' : plural(mistakes, 'faute', 'fautes')} sur ${plural(words, 'mot', 'mots')}. ${COPY_VERDICT[verdict]}`,
```

with, above `VICTORY`:

```ts
const COPY_VERDICT: Record<CopyVerdict, string> = {
  belle: 'Une belle copie.',
  correcte: 'Une copie correcte.',
  reprendre: 'Une copie à reprendre.',
};
```

`VictorySheet.svelte`: add the prop `copy: string` (doc "The copy line (spec 2026-09-29 §2), in place of the old score.") and replace the `results-score` paragraph by `<p class="tally-small" data-testid="results-copy">{copy}</p>`.

`VictoryPhase.svelte`: import `copyVerdict, per100, rulesOf` from `../../lib/rules` and `campStore` from `../../lib/world/campStore.svelte`; add

```ts
  // Spec 2026-09-29 §2: the copy line, from the mistakes left in the handed-in text.
  const copy = $derived.by(() => {
    if (!result) return '';
    const left = result.finalErrors.length;
    return VICTORY.copy(left, result.totalWords, copyVerdict(per100(left, result.totalWords), rulesOf(campStore.catalog)));
  });
```

and pass `{copy}` to `<VictorySheet>`.

- [ ] **Step 4: The score goes** — `web/src/lib/grading/grade.ts`: delete `PACE_MULTIPLIERS`, `clampPaceLevel`, `computeScore`; `gradeSession(reference, draft, final, annotation): SessionResult` (drop the options parameter) and the `score:` line. `web/src/lib/grading/types.ts`: delete `score: number;` from `SessionResult`. `web/src/screens/Play.svelte`: `gradeSession(text.body, playState.draft, playState.current, text.annotation as Annotation)` and delete `score: resultAtSubmit.score,`. `web/src/lib/types.ts` `SessionCreate`: delete `score`. `web/e2e/helpers.ts` `makeResult`: delete `score: 10,`.

- [ ] **Step 5: The chips** — `VictorySpoils.svelte`: replace `BONUS_LABELS` and `bonusChips` with

```ts
  const BONUS_LABELS: Record<string, string> = {
    // Spec 2026-09-29 §4: the session's parts, then the existing bonuses.
    text: 'Texte',
    session: 'Texte',
    pace: 'Rythme',
    aids: 'Sans aides',
    prophecy: 'Prophétie',
    board: 'Quête',
    oracle: 'Oracle',
    boss: 'Éris vaincue',
    mastery: 'Ruse neutralisée',
    weekly: 'Objectif de la semaine',
  };
  const XP_PARTS = ['text', 'pace', 'aids', 'prophecy'] as const;
```

```ts
  // The text's chip always; a bonus's chip when it paid something. A victory saved before the parts has
  // its one « Texte » chip, the whole session.
  const bonusChips = $derived.by(() => {
    const parts = progression.xp.parts;
    const session = parts
      ? XP_PARTS.filter((k) => k === 'text' || parts[k] > 0).map((k) => ({ reason: k, amount: parts[k] }))
      : [{ reason: 'session', amount: progression.xp.session }];
    return [...session, ...progression.xp.bonuses];
  });
```

and give the chip `data-testid="xp-chip"`. Delete the `{:else if progression.boss.too_easy}` branch, and in the `hmpf` effect use `if (progression.boss && !progression.boss.won)` (comment: "Éris's « hmpf » is her mocking a real loss.").

`web/src/lib/world/types.ts`: `boss: { tier: number; won: boolean } | null;` with the comment "Spec 2026-09-29 §2: the fight is won on the copy (no more « too easy » draw)." `web/src/lib/battle/hp.ts`: `outcomeOf(r, boss: { won: boolean } | null)` and `reckoningVerdict`'s `progression: { boss: { won: boolean } | null } | null`; its closing-item-2 comment loses "too_easy (undefeated - she'll try harder) or".

`web/e2e/playability-ui4.spec.ts` (~315): `json.progression.boss = { tier: 1, won };`.

`grep -rn "too_easy\|tooEasy\|computeScore\|results-score\|Gloire gagnée" web/src web/e2e` must print nothing.

- [ ] **Step 6: Run**

Run: `scripts/npm.sh run test` ; `scripts/npm.sh run check`
Run: `STACK=prog scripts/playwright.sh scenes-battle-victory.spec.ts --repeat-each=3` ; `STACK=prog scripts/playwright.sh happy-path.spec.ts --repeat-each=3` ; `STACK=prog scripts/playwright.sh world.spec.ts`
Expected: all pass, `0 errors and 0 warnings`.

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/grading/grade.ts web/src/lib/grading/grade.test.ts web/src/lib/grading/types.ts web/src/lib/world/derived.test.ts web/src/screens/Play.svelte web/src/lib/types.ts web/src/components/battle/VictoryPhase.svelte web/src/components/battle/VictorySheet.svelte web/src/components/battle/VictorySpoils.svelte web/src/lib/battle/lines.ts web/src/lib/battle/lines.test.ts web/src/lib/battle/hp.ts web/src/lib/battle/hp.test.ts web/src/lib/world/types.ts web/e2e/scenes-battle-victory.spec.ts web/e2e/happy-path.spec.ts web/e2e/playability-ui4.spec.ts web/e2e/helpers.ts
git commit -m "The victory says the copy (« Ta copie : 3 fautes sur 150 mots. Une belle copie. ») instead of the score, and its chips break the session XP down; the client-side score and the too-easy leftovers go

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/lib/grading/grade.ts web/src/lib/grading/grade.test.ts web/src/lib/grading/types.ts web/src/lib/world/derived.test.ts web/src/screens/Play.svelte web/src/lib/types.ts web/src/components/battle/VictoryPhase.svelte web/src/components/battle/VictorySheet.svelte web/src/components/battle/VictorySpoils.svelte web/src/lib/battle/lines.ts web/src/lib/battle/lines.test.ts web/src/lib/battle/hp.ts web/src/lib/battle/hp.test.ts web/src/lib/world/types.ts web/e2e/scenes-battle-victory.spec.ts web/e2e/happy-path.spec.ts web/e2e/playability-ui4.spec.ts web/e2e/helpers.ts
```

---

### Task 8: Stirring removed

**Files:**
- Modify: `server/app/routers/world.py` (`lieutenant_states`), `web/src/lib/world/types.ts` (`LieutenantState`), `web/src/lib/world/eris.ts`, `web/src/lib/world/scenes/war.ts`, `web/src/lib/world/scenes/camp.ts`, `web/src/lib/battle/battle.ts`, `web/src/components/places/war/PortraitPanel.svelte`, `README.md` (§8 mastery rule)
- Test: `server/tests/test_world_api.py`, `web/src/lib/world/eris.test.ts`, `web/src/lib/world/scenes/war.test.ts`, `web/src/lib/world/scenes/camp.test.ts`, `web/src/lib/world/scenes/nextStep.test.ts`, `web/src/lib/battle/battle.test.ts`, `web/e2e/scenes-battle-play.spec.ts` (~136), `web/e2e/scenes-war.spec.ts` (~296)

**Interfaces:**
- Consumes: nothing new.
- Produces: `LieutenantState` without `stirring`; `stirringCaption` removed; `opponentFor`'s `lieutenants: Pick<LieutenantState, 'key' | 'available' | 'neutralised'>[]` and no stirring preference.

- [ ] **Step 1: Write the failing tests**

`server/tests/test_world_api.py` `test_camp_for_new_profile`: add `assert all("stirring" not in l for l in c["lieutenants"])` (spec §6).

`web/src/lib/battle/battle.test.ts`: `lt` loses `stirring` (its `over` type and the default); the free-text test becomes

```ts
  it('picks a free text its lieutenant: awake and not neutralised, stable per text', () => {
    expect(opponentFor({ mode: 'dictation', encounter: null, textId: 7, lieutenants: SIX })).toBe('echo'); // 7 % 6 = 1
    const calm = [lt('hydre', { neutralised: true }), lt('echo', { available: false }), lt('chimere'), lt('lethe')];
    expect(opponentFor({ mode: 'dictation', encounter: null, textId: 3, lieutenants: calm })).toBe('lethe'); // 3 % 2 = 1
    expect(opponentFor({ mode: 'dictation', encounter: null, textId: 3, lieutenants: [] })).toBe('eris');
    // Every lieutenant asleep or neutralised: as if there were none.
    const spent = [lt('hydre', { neutralised: true }), lt('echo', { available: false }), lt('lethe', { neutralised: true })];
    for (const textId of [0, 1, 2, 3]) {
      expect(opponentFor({ mode: 'dictation', encounter: null, textId, lieutenants: spent })).toBe('eris');
    }
    expect(opponentFor({ mode: 'dictation', encounter: 'nope', textId: 0, lieutenants: SIX })).toBe('hydre');
  });
```

`war.test.ts`: `lt` loses `stirring: false`; delete `'glows on the first stirring lieutenant only (W14)'`. `camp.test.ts`: delete `echoStirs` and every assertion using it (the dossier's « s'agite » caption). `nextStep.test.ts`: delete the "Two lieutenants stirring at once" camp fixture. `eris.test.ts`: delete `stirringCaption` from the import and its expectation.

- [ ] **Step 2: Run them to see them fail**

Run: `scripts/pytest.sh -q tests/test_world_api.py` ; `scripts/npm.sh run test -- src/lib/battle/battle.test.ts`
Expected: the server test fails (`stirring` still present); vitest passes or fails on types — either way, go on.

- [ ] **Step 3: Remove it**
  - `server/app/routers/world.py` `lieutenant_states`: delete the `"stirring": …` entry.
  - `web/src/lib/world/types.ts`: delete `stirring: boolean;`.
  - `web/src/lib/world/eris.ts`: delete `stirringCaption` and its doc.
  - `web/src/lib/world/scenes/war.ts`: drop the import and the `if (l.stirring) { … }` block (with its W14 comment).
  - `web/src/lib/world/scenes/camp.ts` `campNews`: delete `const stirring = …` and the `['dossier', …]` entry; drop the import.
  - `web/src/lib/battle/battle.ts`:

```ts
export interface OpponentInput {
  mode: BattleMode;
  encounter: string | null;
  textId: number | null;
  lieutenants: Pick<LieutenantState, 'key' | 'available' | 'neutralised'>[];
}

export function opponentFor(i: OpponentInput): OpponentId {
  if (i.mode === 'boss' || i.encounter === 'eris') return 'eris';
  if (i.encounter && isOpponentId(i.encounter)) return i.encounter;
  if (i.mode === 'grimoire') return 'eris';
  const open = i.lieutenants.filter((l) => l.available && !l.neutralised && isOpponentId(l.key));
  if (open.length === 0) return 'eris';
  return open[Math.abs(i.textId ?? 0) % open.length].key as LieutenantKey;
}
```

  - `PortraitPanel.svelte`: delete the `{#if lieutenantState.stirring}…{/if}` note and `stirringCaption` from its import.
  - e2e: `scenes-battle-play.spec.ts` ~136 (`l.stirring = l.key === pick;`): the test forced the pick through the stirring flag; rewrite it to force the pick through the camp answer's `available`/`neutralised` (keep only `pick` open: `l.available = l.key === pick;`), keeping the test's intent (the free text waits for the fresh camp). `scenes-war.spec.ts` ~296: drop `stirring: false,` from the literal.
  - `README.md` §8 « Mastery rule »: replace "Neutralisation is permanent: nothing is ever taken away, a later dip only surfaces as a suggested quest." with "Neutralisation is permanent: nothing is ever taken away."
  - `grep -rn "stirring\|stirringCaption\|revanche" server/app web/src web/e2e` must print nothing.

- [ ] **Step 4: Run**

Run: `scripts/pytest.sh -q` ; `scripts/npm.sh run test` ; `scripts/npm.sh run check`
Run: `STACK=prog scripts/playwright.sh scenes-battle-play.spec.ts -g "fresh camp" --repeat-each=3` ; `STACK=prog scripts/playwright.sh scenes-war scenes-camp`
Expected: all pass, `0 errors and 0 warnings`.

- [ ] **Step 5: Commit**

```bash
git add server/app/routers/world.py server/tests/test_world_api.py web/src/lib/world/types.ts web/src/lib/world/eris.ts web/src/lib/world/eris.test.ts web/src/lib/world/scenes/war.ts web/src/lib/world/scenes/war.test.ts web/src/lib/world/scenes/camp.ts web/src/lib/world/scenes/camp.test.ts web/src/lib/world/scenes/nextStep.test.ts web/src/lib/battle/battle.ts web/src/lib/battle/battle.test.ts web/src/components/places/war/PortraitPanel.svelte web/e2e/scenes-battle-play.spec.ts web/e2e/scenes-war.spec.ts README.md
git commit -m "Stirring lieutenants removed: no flag, no « s'agite » caption, no revenge note, a free text's opponent no longer prefers them

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- server/app/routers/world.py server/tests/test_world_api.py web/src/lib/world/types.ts web/src/lib/world/eris.ts web/src/lib/world/eris.test.ts web/src/lib/world/scenes/war.ts web/src/lib/world/scenes/war.test.ts web/src/lib/world/scenes/camp.ts web/src/lib/world/scenes/camp.test.ts web/src/lib/world/scenes/nextStep.test.ts web/src/lib/battle/battle.ts web/src/lib/battle/battle.test.ts web/src/components/places/war/PortraitPanel.svelte web/e2e/scenes-battle-play.spec.ts web/e2e/scenes-war.spec.ts README.md
```

---

### Task 9: Palamède (the last code task)

**Files:**
- Modify: `web/src/lib/world/art.ts` (+ `art.test.ts`), `web/src/lib/world/bestiary.ts` (+ `bestiary.test.ts`), `web/src/lib/aids.ts` (+ `aids.test.ts`), `web/src/components/battle/AidToggles.svelte`

**Interfaces:**
- Consumes: `web/public/art/emblems/palamede_cut.webp`, `web/public/art/icons/tool-palamede.webp` (the art track, merged by the controller just before this task).
- Produces: `TOOL_ICONS.palamede`, `ART.emblems.palamede`, the bestiary entry `palamede` (after `athena`), `AID_ICONS: Record<AidKey, string>`, `aidIcon(key: AidKey): string`.

- [ ] **Step 1: Verify the art is here**

Run: `ls -l web/public/art/emblems/palamede_cut.webp web/public/art/icons/tool-palamede.webp`
Expected: both files listed. **If either is missing, stop and report to the controller** ("merge `art-track` first"); do not create placeholder art. (While the icon is on disk but unmapped, `art.test.ts` fails: that is expected until Step 4.)

- [ ] **Step 2: Write the failing tests**

`web/src/lib/world/art.test.ts` (the icons test): title `'maps the 37 painted icons, each within its own budget (UI3 Ruling A12)'`, `expect(icons).toHaveLength(37)`, `expect(Object.keys(TOOL_ICONS)).toEqual(['persee', 'athena', 'ariane', 'argus', 'palamede'])`, and add `expect(ART.emblems.palamede).toBe('/art/emblems/palamede_cut.webp');`.

`web/src/lib/world/bestiary.test.ts`: the order gains `'palamede'` after `'athena'`, and the title says « five tools ».

`web/src/lib/aids.test.ts`: replace the four-tools icon loop with

```ts
    for (const k of AID_KEYS) expect(aidIcon(k), k).toBe(`/art/icons/tool-${k}.webp`);
```

- [ ] **Step 3: Run them to see them fail**

Run: `scripts/npm.sh run test -- src/lib/world/art.test.ts src/lib/world/bestiary.test.ts src/lib/aids.test.ts`
Expected: FAIL (36 icons, no `palamede` keys).

- [ ] **Step 4: Wire him in**

`web/src/lib/world/art.ts`: `TOOL_ICONS` gains `palamede: icon('tool-palamede'),` after `argus` (its doc: "The proofreading's review aids (Persée, Athéna, Ariane, Argus, Palamède)."); `ART.emblems` gains `palamede: '/art/emblems/palamede_cut.webp',` after `athena`.

`web/src/lib/aids.ts`: replace `aidIcon` with

```ts
/** The aids' painted emblems (spec 2026-09-29 §5: the existing TOOL_ICONS plus tool-palamede). */
export const AID_ICONS: Record<AidKey, string> = {
  argus: TOOL_ICONS.argus,
  ariane: TOOL_ICONS.ariane,
  persee: TOOL_ICONS.persee,
  athena: TOOL_ICONS.athena,
  palamede: TOOL_ICONS.palamede,
};

export function aidIcon(key: AidKey): string {
  return AID_ICONS[key];
}
```

`web/src/components/battle/AidToggles.svelte`: replace `{#if icon}<img …/>{:else}<span class="emblem kit-medallion" aria-hidden="true"></span>{/if}` with `<img class="emblem" src={aidIcon(key)} alt="" />` and delete the `{@const icon = …}` line.

`web/src/lib/world/bestiary.ts`, after the `athena` entry:

```ts
  {
    key: 'palamede',
    name: 'Palamède',
    kind: 'tool',
    art: ART.emblems.palamede,
    teaser: "Un héros grec inventif, qui démasqua la ruse d'Ulysse.",
    facts: [
      "Les Grecs lui attribuaient de grandes inventions\u202f: les nombres, selon le sophiste Gorgias, et des lettres de l'alphabet grec, selon Hygin.",
      "On disait aussi qu'il avait inventé les dés\u202f: Pausanias raconte qu'on montrait à Argos, dans le temple de la Fortune, ceux qu'il y avait offerts.",
      "Ulysse fit semblant d'être fou pour ne pas partir à Troie. Palamède posa le petit Télémaque devant sa charrue\u202f: Ulysse s'arrêta, et sa ruse fut découverte.",
    ],
    sources: 'Gorgias, Défense de Palamède, 30\u202f; Hygin, Fables, 95 et 277\u202f; Pausanias, Description de la Grèce, II, 20, 3.',
    inGame: 'Ses jetons te disent combien de pièges se cachent.',
  },
```

- [ ] **Step 5: Run**

Run: `scripts/npm.sh run test` ; `scripts/npm.sh run check`
Run: `STACK=prog scripts/playwright.sh scenes-muster.spec.ts scenes-war.spec.ts`
Expected: all pass (the bestiary's page renders Palamède's entry; the muster shows his painted emblem), `0 errors and 0 warnings`.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/world/art.ts web/src/lib/world/art.test.ts web/src/lib/world/bestiary.ts web/src/lib/world/bestiary.test.ts web/src/lib/aids.ts web/src/lib/aids.test.ts web/src/components/battle/AidToggles.svelte
git commit -m "Palamède joins the aids: his painted emblem on the muster, his tool icon, his bestiary entry (numbers, letters and dice; Ulysses unmasked)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/lib/world/art.ts web/src/lib/world/art.test.ts web/src/lib/world/bestiary.ts web/src/lib/world/bestiary.test.ts web/src/lib/aids.ts web/src/lib/aids.test.ts web/src/components/battle/AidToggles.svelte
```

---

### Task 10: README and the full gate

**Files:**
- Modify: `README.md` (§1 feature list, §2 NAS section)

**Interfaces:**
- Consumes: everything above.
- Produces: a documented `data/regles.json`; a clean gate.

- [ ] **Step 1: The README**

§1, replace the « Proofreading » bullet with:

```markdown
- **Proofreading** — five review aids, each taken along or left at the camp before the battle (the
  choice is remembered per hero, and each aid left adds 20 % to the battle's XP bonus): *Les yeux
  d'Argus* (a spotlight over one word category at a time: verbs, nominal groups, homophones, trap
  words), *Le fil d'Ariane* (tap a verb, then its subject), *Le bouclier de Persée* (sentence by
  sentence, last to first), *La chouette d'Athéna* (a few hints) and *Les jetons de Palamède* (how
  many traps hide in the text). The copy is judged as at school, on the mistakes left in it.
```

§2, after « Start it with docker compose » and before « Update to a new version », add:

````markdown
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
  "chouette_hints": 3
}
```

| Key | What it decides |
|---|---|
| `quest_min_chances`, `quest_min_correct` | A quest session counts when the text gives the quest's lieutenant at least this many chances and at least this share of them is right in the handed-in copy |
| `fight_max_per_100` | An Éris fight is won with at most this many mistakes left per 100 words |
| `copy_belle_max_per_100`, `copy_correcte_max_per_100` | The victory's copy line: « belle copie » up to the first, « copie correcte » up to the second, « copie à reprendre » above |
| `aid_bonus` | The XP bonus for each review aid left at the camp |
| `pace_bonus` | The XP bonus of each pace (`"1"` to `"3"`; a partial object keeps the other paces' defaults) |
| `prophecy_bonus` | The XP bonus of a text played before its due date |
| `chouette_hints` | The owl's hints per battle |

A key you leave out keeps its default. A file that is not valid JSON, or a value of the wrong type
(e.g. `"0.3"` in quotes, a negative number, a share above 1), is ignored with a warning in the game's
log (`sudo docker compose logs discorde | grep regles.json`) and the defaults apply: a typo never
stops the game. The file lives in `data/`, so the backups (§4) keep it.
````

- [ ] **Step 2: The full gate**

Run: `STACK=prog PW_WORKERS=4 scripts/check.sh`
Expected: `== ALL GREEN`; pytest, vitest and Playwright with no failure, `svelte-check` `0 errors and 0 warnings`, tsc silent, no warning in the vitest/pytest output. Paste the counts. Any failure, flake or warning is fixed here (root cause, in the owning file) or reported as an open item; never retried away.

- [ ] **Step 3: Final sweeps** (each must print nothing)

```bash
grep -rn "help_stage\|helpStage\|HINTS_PER_STAGE\|next_help_stage\|?help=" web/src web/e2e server/app
grep -rn "stirring\|too_easy\|computeScore\|Gloire gagnée\|paceGlory\|min_rate\|min_draft" web/src web/e2e server/app
```

(`help_stage` may still appear in `server/app/migrations/*.sql` and in `server/app/routers/sessions.py`'s `INSERT` column list — those are the kept columns; `quest_out`'s legacy-key list names `min_rate`/`min_draft`/`help_stage` on purpose. Everything else must go.)

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "README: the five review aids, and data/regles.json (keys, defaults, restart, typos ignored) in the NAS section

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- README.md
```

---

## Spec coverage (self-review)

| Spec | Task |
|---|---|
| §1 measures (per lieutenant, whole text) | 1 (`measures.py`), 3 (`per100`) |
| §2 quest counting, fight verdict, copy line; removals (P1-4 rule, min_rate, too-easy draw, Grimoire switch); legacy quests | 2, 7 (copy line), 4 (Boss route) |
| §3 the five aids, absent when left, +20 %, remembered, new profiles all five, suggestion, fights and Grimoire same choice, the fight's pace floor kept, the Argus-off rule and copy gone, resume restores | 3, 4, 5, 6 |
| §3 help stage removed (`next_help_stage`, message, dragon line, `?help=`, `PlayState.help`, boss `help_stage`, `HINTS_PER_STAGE`, journal help line, `HELP_RULE`), columns stay, new sessions 0, journal's aids line, bestiary Argus/Muses | 4, 5 |
| §4 XP formula, pace 4 → 3, Grimoire no pace bonus, prophecy, bonus never on effort, worked example, `score` removed client-side, `SessionCreate.score` optional and ignored, XP in `score`, chips and `progression.xp.parts` | 2, 3, 7 |
| §5 the pace-and-aids screen (wide, narrow, head, Grimoire, resume, emblems) | 6, 9 |
| §6 stirring and its tests; help and score machinery | 8, 4, 7 |
| §7 rules file (optional keys, defaults, malformed/wrong types logged, served with `/api/world`, README) | 1, 10 |
| §8 migration 005, `introduced`, `SessionCreate.aids` validated, `help_stage`/`score` not required | 1 |
| §9 Palamède (bestiary after Athéna, three facts, `inGame`, `ART.emblems`, `TOOL_ICONS`) | 9 |
| §10 tests: server list (measures, quests, fight, XP, rules file, migration 005, aids validation, stirring gone from `/camp`); client list (gating per aid, suggestion, bonus total, copy line, bestiary and art tests); e2e (help-stage specs rewritten, muster at 1280×800 / 1024×768 / phone, XP chips); gate | 1, 2, 3, 4, 6, 7, 8, 9, 10 |
