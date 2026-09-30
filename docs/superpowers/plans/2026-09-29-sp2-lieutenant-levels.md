# La Discorde — Sub-project 2 "Lieutenant levels" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The one-time neutralisation becomes five seals per lieutenant (bois, bronze, argent, or, orichalque). Each seal is judged on the per-lieutenant final-text measure over a window of the days after the previous seal, asking more days, more chances and a better share each time (3 / 12 / 85 % up to 10 / 100 / 97 %, tunable in `data/regles.json` `levels`). Each seal pays `100 × L` XP and the lieutenant's trophy in that material (30 painted trophies). Éris's fights recur on a ladder of counts across the lieutenants awake at the hero's class (« at least 2 at bois », « all at bois », … ten fights, tunable in `fights`); the first three keep their divine gear, the later ones pay XP. The war tent shows each lieutenant's seal and three gauges toward the next one in words, Éris's dossier speaks per seal group, the camp plaque counts the seals, the trophy shelf shows the highest trophy per lieutenant with the lower ones in a close view, the victory reveals « Sceau de bronze ! ». A neutralised lieutenant becomes the wooden seal (migration 006) and its relic its wooden trophy.

**Architecture:** Server first (pure rules, then the switch), then the art, then the client surface by surface, then the README and the gate. The server keeps a few old fields ("compat", each listed with the task that removes it) so the game keeps working between tasks.
- Server (`server/app`): `world/seals.py` (materials, default thresholds, the window rule, the readers `seal_day_rows`/`level_rows`/`levels_of`, `raise_levels`, `next_seal`; `lieutenants_for_level` moves here), `world/fights.py` (the ladder: `open_fight`, `next_fight`), `rules.py` gains `levels` and `fights` with the same validation and fallback as the other keys, migration `006_seals.sql` (`lieutenant_level`, the relics turned into wooden trophies), `catalog.py` (30 `trophy:<k>:<L>` rewards; relics, `MASTERY` and the mastery bonus go), `progression.py` (seals replace neutralisation), `routers/world.py` (`lieutenants[].level/next`, `boss.fights/next`, the fight from the ladder, the Oracle lowest seal first). `world/mastery.py` is deleted.
- Client (`web/src`): `lib/world/seals.ts` (the words: seal names, gauges, the progress sentence, the fight caption, the victory's reveal and chip, the shelf's plinth), `lib/world/art.ts` (`ART.trophies`), and the places that showed neutralisation: war tent (sheets, portrait, dossier, codex), Delphi's tablets, the camp (plaque, battle caption), the battle's opponent, the victory, the cabin's shelf.

**Tech Stack:** Svelte 5 (runes) + TypeScript + Vite 7, vitest 5 (node env, no component rendering: logic that needs a unit test lives in a pure `.ts` module), Playwright 1.63 (WebKit `desktop` 1280×720 and `ipad` 1180×820 touch, which runs `scenes-*.spec.ts`), FastAPI + pydantic 2 + SQLite (numbered SQL migrations), pytest. No new dependency.

**Spec:** `docs/superpowers/specs/2026-09-29-lieutenant-levels-design.md` is binding (§1 levels, §2 what goes, §3 migration 006, §4 Éris fights, §5 screens, §6 testing). Context: `docs/superpowers/specs/2026-09-29-progression-roadmap.md`, `docs/superpowers/specs/2026-09-29-drachmes-shop-design.md` (sub-project 4 reads the levels: `levels_of()` and `lieutenants[].level` are its API; nothing is stored for the shop here), `docs/superpowers/specs/2026-09-29-art-design.md` (Phase 3 trophies; the web budget raised deliberately, written as a number). House style and toolchain: `docs/superpowers/plans/2026-09-29-sp1-scoring-xp.md`, `docs/superpowers/plans/2026-09-29-sp3-dragon-growth.md`. Repo-root `CLAUDE.md` is binding for every agent: no "pre-existing" problems, tests and `svelte-check` clean with zero errors and zero warnings, no emoji anywhere player-visible.

## Dependencies and batching

Execution is subagent-driven and **sequential**, in the worktree `C:\Users\nicol\IdeaProjects\school-playground\.claude\worktrees\art-skills` (branch `worktree-art-skills`, `STACK=prog`). Each task starts from the previous task's commit; a reviewer gates each task before the next one starts.

**Precondition: sub-project 1 and sub-project 3 are complete on this branch.** Before Task 1 the controller checks:
- `git log --oneline -80` shows sub-project 1's README commit (« README: the five review aids, and data/regles.json … ») and sub-project 3's README commit (« README: the dragon grows from XP through six stages … »);
- `ls server/app/world/dragon.py server/app/rules.py` lists both;
- `grep -rnE "stirring|too_easy|rank_for|RANKS|next_stage_at|dragon_stage\(" web/src server/app` prints nothing.

If any check fails, stop and report. This plan is written against the code those two sub-projects leave: `rules.py` with `dragon_stages`, `progression.xp.parts` and the XP chips in `VictorySpoils.svelte` (`BONUS_LABELS` with `mastery: 'Ruse neutralisée'`, `data-testid="xp-chip"`), `DragonOut` with `neutralised`/`available` (read only by `tricksBeforeEris`), `dragon_out(conn, profile, now, rules)`, `get_camp(profile_id, request, db)`, the victory's `victoryGauge`. Where this plan quotes code that those sub-projects wrote, it names the block by its role; match it by meaning, not by line number.

| # | Task | Recommended model | Why |
|---|---|---|---|
| 1 | Server foundation: `levels` and `fights` in the rules file, `world/seals.py` window rules and day reader, `world/fights.py` ladder, the 30 trophies in the catalogue (nothing wired) | sonnet | Pure rules and pytest, fully specified. |
| 2 | Server switch: migration 006, the session raises seals (XP, trophies) instead of neutralising, `lieutenants[].level/next`, the fights from the ladder (`boss.fights/next`, XP-only fights), the Oracle lowest seal first, the bestiary unlock, `mastery.py` deleted; world e2e steps 6-7; one full e2e run | opus | Cross-cutting: the mastery machinery goes, compat fields keep the client alive, and the full e2e run may surface specs that assumed neutralisation. |
| 3 | Art: the 60 trophy files moved into `web/public/art/trophies/`, `ART.trophies`, `trophyIcon`, trophy ids in `rewardIcon`/`rewardKindOf`, the raised web budget as a measured number | sonnet | Mechanical with one measurement. |
| 4 | The war tent reads the seals: types, `lib/world/seals.ts` (names, gauges, sentence), Éris's bands and 18 new lines, sheets, portrait, dossier, codex, Delphi's tablets, the camp plaque's seal count, the battle's opponent lowest seal first; compat lieutenant fields removed | opus | Five surfaces, copy, and the server compat removal. |
| 5 | Éris's fights on the client: the battle caption and the dragon's line in words, `boss.next`/`fights`, Roman numerals past V, XP-only fights on the plaque, the wall and the muster, new challenge lines; `DragonOut.neutralised/available` removed | sonnet | Fully specified here, copy included. |
| 6 | The victory: the seal reveal (trophy, « Sceau de bronze ! »), the chip « Sceau de bronze : l'Hydre +200 », a victory saved before the change; `progression.neutralised` removed; e2e with a real seal from seeded stats | opus | The reveal's sequence, saved victories, and a real-session e2e. |
| 7 | The trophy shelf and the relics' end: plinths, close view, the first-seal line, the dragon's shelf line; relics out of the catalogue, the art map and the icons folder | sonnet | Fully specified here. |
| 8 | README (seals, fights, `levels`/`fights` in the rules file) and the full gate | opus | The gate may surface cross-task fixes that need judgment. |

**Compat fields (served only between tasks; each removal task greps that nothing reads them any more):**

| Field | Served by (Task 2) | Removed in |
|---|---|---|
| `lieutenants[].neutralised` (level ≥ 1), `neutralised_at`, `window` | `lieutenant_states` | Task 4 |
| `dragon.neutralised` (lieutenants with a seal), `dragon.available` | `dragon_out` | Task 5 |
| `progression.neutralised` (lieutenants that won their wooden seal this session) | `apply_progression` | Task 6 |

**Art (Task 3):** the art track has staged the trophies at `assets/art/export/trophies/trophy-<lt>-<L>.webp` (256 px, 30 files, about 254 KB in all) and `assets/art/export/trophies/large/trophy-<lt>-<L>.webp` (512 px, 30 files, about 657 KB), `lt` ∈ hydre, echo, chimere, protee, sirenes, lethe and `L` 1..5 (commit `f2e739b`, contact sheet `docs/art/trophies-sheet.png`). They are never copied into `web/public/art` before Task 3 (`art.test.ts` requires every mapped path to exist and the art to stay under budget). Task 3's first step checks the 60 files and stops if any is missing.

Playwright runs are serialised machine-wide by the lock in `scripts/playwright.sh` (`with_playwright_lock`, `scripts/lib.sh`); the art agents' Forge and segmentation batches take the same lock (`tools/art/with_lock.sh`), so a queued e2e run is waiting for them, not hanging. Never read Forge's files.

## Global Constraints

- **Levels (spec §1), verbatim:** five levels, each a material: 1 bois, 2 bronze, 3 argent, 4 or, 5 orichalque. "For lieutenant *k* at level *L* (0 = none yet), level *L+1* is judged on a window built from the per-day stats of *k*'s categories, **only days strictly after the day level L was reached** (so every level takes new work): take the most recent days with at least one chance, newest first, until the window holds at least `days` days and `chances` chances; the level is reached when the window is complete and its correct share (1 − (missed + introduced) ÷ chances) is at least `correct`. Levels go one at a time; one session can raise a lieutenant by at most one level."

  | Level | days | chances | correct |
  |---|---|---|---|
  | 1 bois | 3 | 12 | 85 % |
  | 2 bronze | 4 | 25 | 88 % |
  | 3 argent | 6 | 45 | 91 % |
  | 4 or | 8 | 70 | 94 % |
  | 5 orichalque | 10 | 100 | 97 % |

  "Defaults; all in `data/regles.json` (`levels`). A level is never lost." Rewards: "the lieutenant's trophy in that material (reward id `trophy:<k>:<L>`) and `100 × L` XP (reason `level`, chip « Sceau de bronze : l'Hydre +200 »)." Levels 2 to 5 put an accessory on sale in sub-project 4: nothing is stored for it here.
- **What goes (spec §2):** neutralisation (`mastery` table use, `is_neutralised`, `neutralised_set`, the +200 mastery XP, the relic grant), `MASTERY` in the catalogue, `neutraliseRule`, the « Neutralisé » captions and stamps, the dossier's `neutralised` band, the camp plaque's neutralised seals. "The `mastery` table stays in the database (no destructive migration) but is no longer written."
- **Migration 006 (spec §3):** "A table `lieutenant_level(profile_id, lieutenant, level, reached_at, PRIMARY KEY(profile_id, lieutenant))`. For every `mastery` row: level 1 reached at its `neutralised_at`; its relic reward row is replaced by `trophy:<k>:1` with the same `granted_at` and `equipped`. Profiles keep all XP."
- **Fights (spec §4):** over the lieutenants **available at the hero's class** (Protée only from 8H), defaults for each L = 1..5: « at least 2 at level L », then « all at level L » (10 fights), in `data/regles.json` `fights`. "A fight opens when its condition holds and every earlier fight is won; won fights stay won when a class change adds a lieutenant. Winning is sub-project 1's whole-text rule. Rewards: 300 XP each; the first three keep the Sandales d'Hermès, the Égide and the Foudre de Zeus; the later ones pay XP only." The battle caption says what opens the next fight in words (« Encore deux sceaux de bois et Éris t'attend. »), "never naming one lieutenant as required".
- **On screen a level is its material** (« le sceau de bronze de l'Hydre », « Sceau d'argent »), never « niveau » (banned by `registerGuard`) and never a bare number.
- **Toolchain (verified against `scripts/` on 2026-09-29):** no host Node and no host Python for the project. From the worktree root, in Git Bash:
  - `scripts/pytest.sh -q <paths relative to server/>` (e.g. `scripts/pytest.sh -q tests/test_seals.py`; it runs in `server/`);
  - `scripts/npm.sh run test -- <paths relative to web/>` (vitest, focused, e.g. `src/lib/world/seals.test.ts`);
  - `scripts/npm.sh run check` (svelte-check over `src`, then `tsc -p tsconfig.e2e.json` over `e2e/`: must print `0 errors and 0 warnings` and tsc must print nothing);
  - `STACK=prog scripts/playwright.sh <spec-file-or-filter> [--project=desktop|ipad] [--repeat-each=3] [-g "<title>"]`;
  - `STACK=prog PW_WORKERS=4 scripts/check.sh` (the full gate: pytest, tts pytest, svelte-check + e2e tsc, vitest, both docker builds, all e2e, the real-voice spec).
  **This is a worktree: always set `STACK=prog`** for `playwright.sh` and `check.sh` (the main checkout's stack is `discorde`; ours is `discorde-prog`). Do not run Docker or Playwright outside these wrappers.
- **Testing rules:** per task, run the focused vitest files, `scripts/npm.sh run check`, and the focused pytest files; run every **new or changed** e2e spec (or test, with `-g`) with `--repeat-each=3`; run every **touched but unchanged-in-intent** spec once. Task 2 also runs the whole e2e suite once (it changes what every posted session does). The full gate runs in Task 8. The crash-only retry (`scripts/playwright-crash-retry.mjs`) retries a named "browser crashed" failure once; any other failure is a real failure. A flake is a defect: root-cause it, never retry it away.
- **e2e robustness (8 workers by default, 4 in the gate):** import `test`/`expect` from `./crashGuard` (audio stub, tours off); each test creates its own hero (`createProfileApi`) and its own text (`createText` with `uniqueName`); a finger on `ipad`, a mouse on `desktop` (`tap(locator, testInfo)`); no `waitForTimeout`; web-first assertions and `expect.poll`. A seal a test needs is either **real** (sessions posted with `postSession` and the `X-Discorde-Day` test clock, `makeResult({ draft: 4, caught: 4, category })` gives 10 chances all right) or set by intercepting this hero's `/api/profiles/{id}/camp` with `page.route` (scoped to the test's own hero id). The seal mechanics themselves are pinned by pytest.
- **French copy:** every French string of this plan is used verbatim. In-world, warm, gender-neutral towards the player (no adjective or participle agreeing with her), no school register (`BANNED` in `web/src/testing/copyRules.ts`: « niveau », « réviser »…), no guilt wording (`GUILT`: manqué, raté, perdu), no FOMO. Éris's lines target her own tricks, never the player (`FORBIDDEN` in `eris.ts`), and she speaks of herself in the feminine. Plurals through `plural()`. Typography: in TypeScript strings U+202F (`\u202f`) before « : ; ! ? % » (`rateText()` already writes « 85 % » with it); in `content/dialogue/*.json` plain spaces (`content.test.ts` forbids U+00A0/U+202F there). Lines ≤ 170 characters, no `"`, no `...` (use `…`). Code, comments, docs and commit messages are in English.
- **No emoji (CLAUDE.md):** not in any string, badge or marker. A seal is its painted trophy (`web/public/art/trophies/`), a plain CSS outline before the first one.
- **Guards that must stay green (vitest):** `noEmoji`, `registerGuard`, `noGuilt`, `formPlural`, `frenchSpacing`, `placesKit`, `artReferenced`, `app.css`, `lib/battle/lines.test.ts`, `lib/world/art.test.ts` (every mapped path exists, non-scene art < 150 KB each, the non-scene total under the budget Task 3 writes), `lib/world/bestiary.test.ts`, `lib/dialogue/content.test.ts`, `lib/world/eris.test.ts` (`FORBIDDEN`); server `tests/test_french_spacing.py`.
- **Commits:** on `worktree-art-skills`, shared with art agents and possibly another implementer. **Always** `git add <paths> && git commit -m "..." -- <paths>`; a `git mv`/`git rm` names both its paths in the commit. Never `git add -A`, `git stash`, `git reset`, `git checkout`, `git restore` of tracked work, `git clean`, or any history rewrite. If git reports `index.lock`, wait a few seconds and retry. End every message with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- **Verification:** run each task's commands and paste the real output (counts included) into the report. A failing, flaky or warning test anywhere is yours to fix or to report as an open item, never "pre-existing" (CLAUDE.md).

## Review Focus

The five failure modes the spec implies but its test list does not pin, most likely first. Each has its test in the owning task.

1. **The days around a seal.** A seal won at 23:30 UTC is won the next Swiss day; a second session the same day must not count toward the next seal; a hero with a long clean history (ten days × 20 chances) must gain the wooden seal only, not two or five at once, on the first session after the deploy. Expected: only days strictly after `local_day(reached_at)` (Europe/Zurich) count; one seal per lieutenant per session, and the store refuses to skip one even under a race. Tests: Task 1 `test_only_days_strictly_after_the_last_seal_count`, `test_the_last_seals_day_is_the_swiss_day`; Task 2 `test_one_session_raises_a_lieutenant_by_one_seal_at_most`, `test_the_next_seal_counts_only_days_after_the_last`, `test_a_seal_is_never_skipped_by_the_store`.
2. **Rules-file tables that look right but are not.** `levels` with `"days": 0`, `"chances": true`, `"correct": 1.5` or `0`, an unknown field, a key `"6"`, a list for a seal, a list for `levels`; `fights` with a level 6, a count 7 or 0 or `"tous"`, an extra key, `true` for a level, an empty list, 21 entries, an object for `fights`. Expected: a wrong seal value is logged and its default kept (the other values and seals still apply); a ladder with any wrong entry is refused whole (logged, the built-in ten apply: dropping one entry would renumber the fights after it, and a won fight is stored by its number); a count above the lieutenants awake is capped (never blocks a 7H hero). Tests: Task 1 `test_a_wrong_level_value_is_logged_and_its_default_kept`, `test_levels_that_are_not_an_object_keep_the_built_in_ones`, `test_a_wrong_fight_ladder_is_refused_whole` (parametrised), `test_a_count_above_the_lieutenants_awake_asks_them_all`.
3. **Exact thresholds.** 17 right of 20 (85 %), 22 of 25 (88 %: in binary 22/25 and 0.88 differ in the last bit), 91, 94 and 97 of 100. Expected: each exact share reaches its seal, one more mistake does not; the gauges and the sentence agree with the server (« Tout y est » only when the server would seal). Tests: Task 1 `test_each_threshold_is_reached_exactly_at_its_share` (all five); Task 4 `sealGauges`/`sealProgressLine` at 22 of 25.
4. **Class change and the fights past the gear.** A 7H hero who won fights I and II (all five at bois) moves to 8H: Protée wakes at level 0. Expected: fights I and II stay won (the gear is not granted again), fight III (« 2 at bronze ») is judged over six, the caption counts Protée; the fourth fight and later pay 300 XP and no reward id, the plaque says « Combat IV : 300 XP », the muster says « Récompense si tu gagnes : 300 XP » (no « · 300 XP » twice), fights beyond V get Roman numerals. Tests: Task 1 `test_all_means_every_lieutenant_awake_at_the_class`; Task 2 `test_won_fights_stay_won_when_protee_wakes`, `test_the_fights_after_the_third_pay_xp_only`; Task 5 `romanTier`, `bossRewardName`, `BOSS.reward`, the e2e « Combat IV ».
5. **Data from before the change.** A database with `mastery` rows (a relic equipped, a neutralisation whose relic row is missing, a relic row with no mastery row, XP rows of reason `mastery`) and a play state saved mid-victory with `progression.neutralised: ['echo']` and a `mastery` chip. Expected: migration 006 gives the wooden seal at `neutralised_at`, the wooden trophy with the relic's `granted_at`/`equipped` (or `neutralised_at`/0 when the relic row is missing), drops relic rows, keeps `mastery` and every XP row, and is idempotent; the saved victory shows « Sceau de bois ! » for Écho and the chip « Premier sceau +200 », never « undefined » or « Ruse neutralisée ». Tests: Task 2 `test_migration_006_turns_each_neutralised_lieutenant_into_its_wooden_seal`; Task 6 `levelUps` legacy case, `bonusChipLabel` legacy case, e2e `a victory saved before the seals shows the first seal`.

## Rulings taken by this plan (the spec is silent or ambiguous; do not re-ask)

- **R1 Names.** The code says *level*, the screen says *seal*: server `app/world/seals.py` and `app/world/fights.py` (`app/levels.py` already means the school classes), client `lib/world/seals.ts`. `lieutenants_for_level` moves from `world/mastery.py` to `world/seals.py`; `world/mastery.py` is deleted in Task 2.
- **R2 The rules file.** `levels` is an object keyed `"1"`…`"5"`, each a partial object of `days`, `chances` (whole numbers from 1 to 1 000 000) and `correct` (a share above 0 and at most 1); each wrong value is logged and its default kept; seals are not required to rise (they are judged one at a time; the README says the defaults rise). `Rules.levels` and `/api/world` `rules.levels` are a list of five `{days, chances, correct}`. `fights` is a list of 1 to 20 `{"level": 1-5, "count": 1-6 | "all"}`, refused whole on any wrong entry. Rules are read at start-up only (sub-project 1's R16).
- **R3 The window.** A day of guard is a Swiss day (`profile_stat_day.day`) with at least one chance for the lieutenant's categories; chances = `SUM(occurrences)` (the stored opportunities), mistakes = `SUM(missed + introduced)`; correct share = (chances − mistakes) ÷ chances, never below 0, `None` without a chance. The previous seal's day is `local_day(reached_at)`. A share is compared with a 1e-9 tolerance (22/25 against 0.88). The client repeats the comparison for its words only; the server decides.
- **R4 When seals are judged.** After every saved session, for every lieutenant awake at the hero's class, after the quests and before the weekly goal (sub-project 3 grows the dragon after every XP, the seals' included). Never on a `GET`: XP is only granted with a session. A `GET /camp` whose window already passes (the rules lowered, or history from before the deploy) shows full gauges and « Tout y est : défends encore un texte, et le sceau de bois est à toi. ».
- **R5 The store.** `lieutenant_level` is upserted with `WHERE lieutenant_level.level = excluded.level - 1`: a seal is written only over the one before it, so two requests racing can never skip or repeat one. `reached_at` is the session's `finished_at` (the test clock's noon, `YYYY-MM-DDT12:00:00+00:00`).
- **R6 Rewards.** Reward id `trophy:<k>:<L>`, kind `trophy`, name « {keepsake} en {material} » (« Écaille de l'Hydre en bois », « Voix d'Écho en argent », « Crinière de la Chimère en or », « Perle de Protée en bronze », « Plume de Sirène en orichalque », « Pavot de Léthé en bois »), a description per material, source « Sceau de bronze de l'Hydre »; granted with source `level:<k>:<L>`. XP `100 × L`, reason `level`; the bonus entry carries `lieutenant` and `level` (the chip needs them). `progression.levels` is `[{lieutenant, level, reward_id}]`. A trophy has no « Exposer » toggle: the shelf shows it.
- **R7 The relics end.** Migration 006 turns each relic into its wooden trophy (a relic row with no `mastery` row, only possible by hand, is dropped with the others); the six relic rewards, `LIEUTENANTS[*].relic`, `RELIC_OF`, their icons and the `relic` kind leave the code in Task 7 (Task 6 stops the victory from reading them).
- **R8 The fights.** A won fight is stored as today (a done boss quest whose goal holds `tier`); tier N means the Nth fight of the ladder, so the old tiers I-III stay won and their gear is never granted twice. `BOSS_REWARDS` keeps 1-3; a later fight's quest has `reward_id: null` and pays `QUEST_BONUS["boss"]` (300). `camp.boss` gains `fights` (the ladder's length) and `next` = `{tier, level, missing}` of the first fight not won, when it is not open yet (else `null`). « All » and any count above the lieutenants awake mean every lieutenant awake at the class.
- **R9 The caption and the dragon's line are one sentence:** « Encore {un|deux|…|six|N} {sceau|sceaux} {de bois|de bronze|d'argent|d'or|d'orichalque} et Éris t'attend. » (counts in words up to six, masculine « un »). Every fight won: the dragon says « Éris est vaincue à chaque combat. Elle boude, loin du camp. », the caption « Éris boude, loin du camp », the wall « Éris est vaincue à chaque combat. Elle boude. ». The server's refusal: « Éris ne se montre pas encore. Gagne d'abord d'autres sceaux sur ses lieutenants. ».
- **R10 Lowest seal first.** The Oracle's « point faible » is chosen by today's rule among the awake lieutenants at the lowest seal; « le choix du destin » among the other awake lieutenants by (seal, last day met, camp order). A free text's opponent is `textId % n` among the awake lieutenants at the lowest seal (never Éris while one is awake).
- **R11 Éris's dossier bands.** Seal 0 keeps today's four catch-rate bands (`none`, `strong`, `contested`, `weak`); seals 1-2 are `bois`, 3-4 `argent`, 5 `orichalque`: 18 new lines, one per lieutenant and group.
- **R12 The words under the gauges** (`sealProgressLine`): seal 0 with no day of guard « Pas encore croisé(e)(s). »; missing days or chances « Encore 2 jours de garde et 13 pièges avant le sceau de bronze. » (either part alone when the other is met); the window full but short « Il ne te reste qu'à déjouer 88 % des pièges avant le sceau de bronze. »; full and right « Tout y est : défends encore un texte, et le sceau de bronze est à toi. »; seal 5 « Sceau d'orichalque. Il ne reste rien à conquérir ici. » (no gauges). The gauges: « Jours de garde : 2 sur 4 », « Pièges croisés : 20 sur 25 », « Pièges déjoués : 84 %, il en faut 88 % » (with the target mark).
- **R13 The seal emblem.** On a sheet of the war tent and on the portrait: the level-L trophy icon; before the first seal a plain CSS outline circle (sheet) or « Pas encore de sceau » under an outline (portrait); a sleeping lieutenant shows none. Captions and stamps: « Sceau de bronze ».
- **R14 The camp plaque** shows one gold seal and the number of seals won across lieutenants (the sum of their levels, up to 30), its accessible text « (7 sceaux) ». The old one-seal-per-lieutenant row would not fit 30.
- **R15 The trophy shelf.** A « Trophées » section first, one plinth per lieutenant in camp order: the highest trophy (the 256 px icon) as a button named by the trophy, « Sceau de bronze » under it; the close view (a sheet in the panel, one at a time, the button's `aria-expanded`) shows the 512 px picture, its description and the lower trophies as small icons with their names under « Aussi sur l'étagère »; no seal yet: an empty plinth, the lieutenant's name and « Premier sceau : 3 jours de garde et 12 pièges, dont 85 % déjoués. » (from the rules), or the sleeping line for a lieutenant asleep at the class. The dragon's shelf line counts the trophies still to win (5 × the lieutenants awake).
- **R16 The victory.** One card per seal won, after the quest cards (where the neutralised cards were): the lieutenant's cut-out, the trophy icon, « Sceau de bronze ! », « Tu poses le sceau de bronze sur l'Hydre. Son trophée t'attend dans ta cabane. » (« Leur trophée » for the Sirènes); a burst and the growth sound. Trophies never appear again as « Nouveau trésor ». A saved victory's `neutralised` keys show as wooden seals; its `mastery` chip reads « Premier sceau +200 ».
- **R17 Éris's challenge lines.** Fight I's line no longer speaks of silenced tricks; fights after III take `CHALLENGE_AGAIN[(tier - 4) % 3]`.
- **R18 Art.** `web/public/art/trophies/trophy-<lt>-<L>.webp` (icons) and `web/public/art/trophies/large/trophy-<lt>-<L>.webp` (close view), mapped as `ART.trophies.icons[lt][L-1]` and `ART.trophies.large[lt][L-1]`, outside `ART.icons` (the icons folder's exact-set test stays about `/art/icons`). The non-scene budget becomes 3.5 MiB (measured total written in the test's comment).

## File map

| File | Responsibility | Task |
|---|---|---|
| `server/app/world/seals.py` (new), `server/tests/test_seals.py` (new) | materials, defaults, window, readers (1); `lieutenants_for_level`, `level_rows`, `levels_of`, `raise_levels`, `next_seal` (2) | 1, 2 |
| `server/app/world/fights.py` (new), `server/tests/test_fights.py` (new) | the ladder | 1 |
| `server/app/rules.py`, `server/tests/test_rules.py` | `levels`, `fights` | 1 |
| `server/app/world/catalog.py` | trophies, materials (1); `MASTERY`, mastery bonus out (2); relics out (7) | 1, 2, 7 |
| `server/app/migrations/006_seals.sql` (new), `server/tests/test_db.py` | migration 006 | 2 |
| `server/app/world/progression.py` | seals replace neutralisation | 2, 6 |
| `server/app/world/mastery.py` | deleted | 2 |
| `server/app/world/oracle.py` | lowest seal first | 2 |
| `server/app/routers/world.py` | lieutenant states, boss block, fights, oracle calls (2); compat out (4, 5) | 2, 4, 5 |
| `server/tests/test_seals_api.py` (new), `test_progression.py`, `test_world_rules.py`, `test_world_api.py` | server tests | 2, 4, 5, 6, 7 |
| `web/src/lib/world/types.ts` | `LieutenantState`, `SealWindow` (4); `CampResponse.boss`, `DragonOut` (5); `Progression` (6); `RewardKind`, `WorldCatalog` (3, 7) | 3-7 |
| `web/src/lib/world/seals.ts` (new, + test) | the seals' words | 4, 5, 6, 7 |
| `web/src/lib/world/art.ts` (+ test), `web/public/art/trophies/**` | trophies (3); relics out (7) | 3, 7 |
| `web/src/lib/world/eris.ts` (+ test), `web/src/lib/battle/lines.test.ts` | bands, lines | 4 |
| `web/src/components/places/war/PortraitPanel.svelte`, `DossierPanel.svelte`, `CodexPanel.svelte`, `web/src/screens/WarTent.svelte`, `web/src/lib/world/scenes/war.ts` (+ test) | war tent | 4 |
| `web/src/components/places/delphi/TabletsPanel.svelte` | tablets' stamp (4), boss sheet (5) | 4, 5 |
| `web/src/lib/world/scenes/camp.ts` (+ test), `web/src/components/scene/Hotspot.svelte`, `web/src/lib/scene/types.ts` | plaque (4); battle caption (5) | 4, 5 |
| `web/src/lib/battle/battle.ts` (+ test) | opponent | 4 |
| `content/dialogue/war.json` | the tour's portraits line | 4 |
| `web/src/lib/world/quests.ts` (+ test), `web/src/lib/world/rewards.ts` (+ test), `web/src/lib/battle/lines.ts`, `web/src/screens/Boss.svelte`, `web/src/components/battle/BossMuster.svelte` | fights | 5, 6, 7 |
| `web/src/components/battle/VictorySpoils.svelte`, `web/src/lib/rules.ts` | victory (6); `levels` in the rules (7) | 6, 7 |
| `web/src/components/places/cabin/TrophiesPanel.svelte`, `web/src/screens/CabinRoom.svelte`, `web/src/lib/world/scenes/cabin.ts` (+ test) | shelf | 7 |
| `web/e2e/world.spec.ts`, `scenes-war.spec.ts`, `scenes-camp.spec.ts`, `scenes-battle-play.spec.ts`, `scenes-battle-victory.spec.ts`, `scenes-cabin.spec.ts`, `playability-ui4.spec.ts`, `helpers.ts` | e2e | 2, 4, 5, 6, 7 |
| `docs/art/style-guide.md` | the trophies' web home | 3 |
| `README.md` | seals, fights, rules file | 8 |

---

### Task 1: Server foundation — the rules, the window, the ladder, the trophies

**Files:**
- Create: `server/app/world/seals.py`, `server/app/world/fights.py`, `server/tests/test_seals.py`, `server/tests/test_fights.py`
- Modify: `server/app/rules.py`, `server/app/world/catalog.py`
- Test: `server/tests/test_rules.py`

**Interfaces:**
- Consumes: `local_day` (`app/clock.py`); `LIEUTENANTS`, `LIEUTENANT_ORDER`, `REWARDS`, `_r` (`app/world/catalog.py`); `_count`, `_share`, `log`, `MAX_COUNT` (`app/rules.py`).
- Produces:
  - `app.world.catalog`: `MATERIALS = ("bois", "bronze", "argent", "or", "orichalque")`, `SEAL_TITLES`, `OF_LIEUTENANT`, `TROPHY_OF`, `trophy_id(key: str, level: int) -> str`, 30 `trophy:<k>:<L>` entries in `REWARDS` (kind `trophy`).
  - `app.world.seals`: `MAX_LEVEL = 5`, `LEVEL_XP = 100`, `DEFAULT_LEVELS: list[dict]`, `LevelWindow(days, chances, mistakes, correct, complete)`, `since_day(reached_at: str | None) -> str | None`, `level_window(day_rows, since, need) -> LevelWindow`, `reaches(w, need) -> bool`, `seal_day_rows(conn, profile_id, categories) -> list[dict]` (`{"day", "chances", "mistakes"}`).
  - `app.world.fights`: `MAX_FIGHTS = 20`, `DEFAULT_FIGHTS: list[dict]`, `fight_need(fight, awake: int) -> int`, `open_fight(ladder, levels: dict[str, int], awake: list[str], won: set[int]) -> int | None`, `next_fight(...) -> {"tier", "level", "missing"} | None`.
  - `Rules.levels: list[dict]` (five `{days, chances, correct}`), `Rules.fights: list[dict]`, both in `as_dict()`.

- [ ] **Step 1: Write the failing rules tests** — `server/tests/test_rules.py`: add `import pytest` if the file lacks it and `from app.world.fights import DEFAULT_FIGHTS` / `from app.world.seals import DEFAULT_LEVELS` to the imports; add to `DEFAULTS` (keep its existing keys exactly) `"levels": LEVEL_DEFAULTS, "fights": FIGHT_DEFAULTS` with, above it:

```python
LEVEL_DEFAULTS = [{"days": 3, "chances": 12, "correct": 0.85}, {"days": 4, "chances": 25, "correct": 0.88},
                  {"days": 6, "chances": 45, "correct": 0.91}, {"days": 8, "chances": 70, "correct": 0.94},
                  {"days": 10, "chances": 100, "correct": 0.97}]
FIGHT_DEFAULTS = [{"level": level, "count": count} for level in range(1, 6) for count in (2, "all")]
```

and at the end of the file:

```python
# Spec 2026-09-29 lieutenant levels §1, §4: the seals' thresholds and Éris's ladder live in the rules file.
def test_the_built_in_seals_and_fights_mirror_the_spec():
    assert DEFAULT_LEVELS == LEVEL_DEFAULTS and DEFAULT_FIGHTS == FIGHT_DEFAULTS and len(FIGHT_DEFAULTS) == 10


def test_levels_from_the_file_keep_the_other_defaults(tmp_path):
    rules = load_rules(write(tmp_path, '{"levels": {"2": {"chances": 30}, "5": {"days": 12, "correct": 0.95}}}'))
    expected = [dict(r) for r in LEVEL_DEFAULTS]
    expected[1]["chances"] = 30
    expected[4].update(days=12, correct=0.95)
    assert rules.levels == expected
    assert rules.as_dict() == {**DEFAULTS, "levels": expected}


def test_a_wrong_level_value_is_logged_and_its_default_kept(tmp_path, caplog):
    text = json.dumps({"levels": {"1": {"days": 0, "chances": True, "correct": 1.5, "speed": 3, "correct ": 1},
                                  "2": {"correct": 0}, "3": [4], "6": {"days": 3}, "4": {"days": 9}}})
    with caplog.at_level(logging.WARNING):
        rules = load_rules(write(tmp_path, text))
    expected = [dict(r) for r in LEVEL_DEFAULTS]
    expected[3]["days"] = 9
    assert rules.levels == expected
    for bit in ("'days'", "'chances'", "'correct'", "'speed'", "'2'", "'3'", "'6'"):
        assert bit in caplog.text, bit


def test_levels_that_are_not_an_object_keep_the_built_in_ones(tmp_path):
    assert load_rules(write(tmp_path, '{"levels": [3, 4], "chouette_hints": 2}')).as_dict() == {**DEFAULTS, "chouette_hints": 2}


def test_a_fight_ladder_from_the_file_replaces_the_built_in_one(tmp_path):
    rules = load_rules(write(tmp_path, '{"fights": [{"level": 1, "count": 3}, {"level": 2, "count": "all"}]}'))
    assert rules.fights == [{"level": 1, "count": 3}, {"level": 2, "count": "all"}]


@pytest.mark.parametrize("ladder", [
    "[]", '{"level": 1, "count": 2}', '[{"level": 6, "count": 2}]', '[{"level": 1, "count": 7}]',
    '[{"level": 1, "count": 0}]', '[{"level": 1, "count": "tous"}]', '[{"level": true, "count": 2}]',
    '[{"level": 1, "count": 2, "reward": "egide"}]', '[{"level": 1}]', '[{"level": 1, "count": 2}, 3]',
    json.dumps([{"level": 1, "count": 2}] * 21),
])
def test_a_wrong_fight_ladder_is_refused_whole(tmp_path, caplog, ladder):
    with caplog.at_level(logging.WARNING):
        rules = load_rules(write(tmp_path, '{"fights": %s, "chouette_hints": 2}' % ladder))
    assert rules.fights == FIGHT_DEFAULTS and rules.chouette_hints == 2
    assert "fights must be a list" in caplog.text
```

- [ ] **Step 2: Write the failing seals and fights tests** — `server/tests/test_seals.py`:

```python
"""The seals' window rule (spec 2026-09-29 lieutenant levels §1). Pure, plus the day reader."""
import sqlite3

import pytest

from app.db import DB_FILENAME
from app.world.catalog import LIEUTENANTS, MATERIALS, REWARDS, trophy_id
from app.world.seals import DEFAULT_LEVELS, LevelWindow, level_window, reaches, seal_day_rows, since_day
from tests.test_progression import hydre_result, post
from tests.test_sessions import make_profile, make_text

L1, L2 = DEFAULT_LEVELS[0], DEFAULT_LEVELS[1]


def days(*rows):  # (day, chances, mistakes)
    return [{"day": d, "chances": c, "mistakes": m} for d, c, m in rows]


def test_five_seals_each_a_material():
    assert MATERIALS == ("bois", "bronze", "argent", "or", "orichalque")


def test_the_window_takes_the_newest_days_until_it_holds_the_days_and_the_chances():
    w = level_window(days(("2026-09-01", 50, 40), ("2026-09-20", 4, 0), ("2026-09-21", 4, 0), ("2026-09-22", 4, 1)), None, L1)
    assert w == LevelWindow(days=3, chances=12, mistakes=1, correct=11 / 12, complete=True)
    assert reaches(w, L1)                                   # the bad day of 09-01 is outside the window
    # Three days hold only 9 chances: the window reaches back one more day, a bad one here.
    w = level_window(days(("2026-09-01", 10, 5), ("2026-09-20", 3, 0), ("2026-09-21", 3, 0), ("2026-09-22", 3, 0)), None, L1)
    assert (w.days, w.chances, w.mistakes, w.complete) == (4, 19, 5, True) and not reaches(w, L1)


def test_a_day_without_a_chance_is_not_a_day_of_guard():
    w = level_window(days(("2026-09-20", 0, 0), ("2026-09-21", 6, 0), ("2026-09-22", 6, 0)), None, L1)
    assert (w.days, w.chances, w.complete) == (2, 12, False) and not reaches(w, L1)


def test_only_days_strictly_after_the_last_seal_count():
    rows = days(("2026-09-20", 10, 0), ("2026-09-21", 10, 0), ("2026-09-22", 10, 0), ("2026-09-23", 10, 0))
    w = level_window(rows, "2026-09-21", L2)
    assert (w.days, w.chances, w.complete) == (2, 20, False)


def test_the_last_seals_day_is_the_swiss_day():
    assert since_day("2026-09-21T23:30:00+00:00") == "2026-09-22"      # 01:30 in Zurich
    assert since_day("2026-09-22T12:00:00+00:00") == "2026-09-22" and since_day(None) is None


def test_no_chance_no_share():
    w = level_window([], None, L1)
    assert w == LevelWindow(days=0, chances=0, mistakes=0, correct=None, complete=False) and not reaches(w, L1)
    # More mistakes than chances (a category's introduced ones) never makes a negative share.
    assert level_window(days(("2026-09-22", 2, 5)), None, {"days": 1, "chances": 1, "correct": 0.5}).correct == 0.0


# Review focus 3: 22/25 and 0.88 differ in the last bit of a float; the exact share must pass.
@pytest.mark.parametrize("i,chances", [(0, 20), (1, 25), (2, 100), (3, 100), (4, 100)])
def test_each_threshold_is_reached_exactly_at_its_share(i, chances):
    need = {**DEFAULT_LEVELS[i], "days": 1, "chances": chances}
    allowed = round(chances * (1 - DEFAULT_LEVELS[i]["correct"]))
    assert reaches(level_window(days(("2026-09-22", chances, allowed)), None, need), need)
    assert not reaches(level_window(days(("2026-09-22", chances, allowed + 1)), None, need), need)


def test_a_lieutenants_days_count_its_chances_and_the_mistakes_left(client, settings):
    pid = make_profile(client, level="10H"); tid = make_text(client)
    r = hydre_result(draft=4, caught=2)
    r["byCategory"]["agreement:verb"]["introduced"] = 1
    r["byCategory"]["agreement:number"] = {"opportunities": 5, "draft": 0, "caught": 0, "missed": 0, "introduced": 0}
    r["byCategory"]["homophone"] = {"opportunities": 7, "draft": 1, "caught": 0, "missed": 1, "introduced": 0}
    post(client, pid, tid, r, day="2026-09-21")
    post(client, pid, tid, hydre_result(), day="2026-09-22")
    conn = sqlite3.connect(settings.data_dir / DB_FILENAME)
    rows = sorted(seal_day_rows(conn, pid, LIEUTENANTS["hydre"]["categories"]), key=lambda x: x["day"])
    conn.close()
    assert rows == [{"day": "2026-09-21", "chances": 15, "mistakes": 3}, {"day": "2026-09-22", "chances": 10, "mistakes": 0}]


def test_thirty_trophies_one_per_lieutenant_and_seal():
    ids = [k for k in REWARDS if k.startswith("trophy:")]
    assert len(ids) == 30 and trophy_id("hydre", 2) == "trophy:hydre:2" and ids[0] == "trophy:hydre:1"
    assert REWARDS["trophy:hydre:1"] == {"id": "trophy:hydre:1", "kind": "trophy", "name": "Écaille de l'Hydre en bois",
                                         "desc": "Un souvenir taillé dans le bois d'olivier.", "source": "Sceau de bois de l'Hydre"}
    assert REWARDS["trophy:echo:3"]["name"] == "Voix d'Écho en argent"
    assert REWARDS["trophy:sirenes:5"]["name"] == "Plume de Sirène en orichalque"
    assert REWARDS["trophy:sirenes:5"]["source"] == "Sceau d'orichalque des Sirènes"
    assert REWARDS["trophy:lethe:4"]["desc"] == "Un souvenir d'or, orné de reliefs et de pierres fines."
```

`server/tests/test_fights.py`:

```python
"""Éris's ladder (spec 2026-09-29 lieutenant levels §4): counts across the lieutenants awake."""
from app.world.fights import DEFAULT_FIGHTS, fight_need, next_fight, open_fight

FIVE = ["hydre", "echo", "chimere", "sirenes", "lethe"]          # 5H to 7H
SIX = ["hydre", "echo", "chimere", "protee", "sirenes", "lethe"]  # from 8H


def lv(**levels):
    return {k: levels.get(k, 0) for k in SIX}


def test_the_ladder_counts_seals_across_lieutenants():
    assert open_fight(DEFAULT_FIGHTS, lv(hydre=1), FIVE, set()) is None
    assert next_fight(DEFAULT_FIGHTS, lv(hydre=1), FIVE, set()) == {"tier": 1, "level": 1, "missing": 1}
    assert open_fight(DEFAULT_FIGHTS, lv(hydre=1, lethe=2), FIVE, set()) == 1      # a higher seal counts too
    assert next_fight(DEFAULT_FIGHTS, lv(hydre=1, lethe=2), FIVE, set()) is None


def test_a_fight_opens_only_when_every_earlier_one_is_won():
    bronze = lv(hydre=2, echo=2, chimere=2, sirenes=2, lethe=2)
    assert open_fight(DEFAULT_FIGHTS, bronze, FIVE, set()) == 1
    assert open_fight(DEFAULT_FIGHTS, bronze, FIVE, {1}) == 2
    assert open_fight(DEFAULT_FIGHTS, bronze, FIVE, {1, 2, 3}) == 4
    assert open_fight(DEFAULT_FIGHTS, bronze, FIVE, {1, 2, 3, 4}) is None
    assert next_fight(DEFAULT_FIGHTS, bronze, FIVE, {1, 2, 3, 4}) == {"tier": 5, "level": 3, "missing": 2}


# Review focus 4: Protée wakes at 8H at level 0; the fights already won stay won.
def test_all_means_every_lieutenant_awake_at_the_class():
    wood = lv(hydre=1, echo=1, chimere=1, sirenes=1, lethe=1)
    assert open_fight(DEFAULT_FIGHTS, wood, FIVE, {1}) == 2
    assert open_fight(DEFAULT_FIGHTS, wood, SIX, {1}) is None
    assert next_fight(DEFAULT_FIGHTS, wood, SIX, {1}) == {"tier": 2, "level": 1, "missing": 1}
    assert open_fight(DEFAULT_FIGHTS, wood, SIX, {1, 2}) is None
    assert next_fight(DEFAULT_FIGHTS, wood, SIX, {1, 2}) == {"tier": 3, "level": 2, "missing": 2}


def test_a_count_above_the_lieutenants_awake_asks_them_all():
    assert fight_need({"level": 1, "count": 6}, 5) == 5 and fight_need({"level": 1, "count": "all"}, 6) == 6
    assert fight_need({"level": 1, "count": 2}, 5) == 2
    assert open_fight([{"level": 1, "count": 6}], lv(hydre=1, echo=1, chimere=1, sirenes=1, lethe=1), FIVE, set()) == 1


def test_every_fight_won_leaves_nothing_to_open():
    top = lv(**{k: 5 for k in SIX})
    won = set(range(1, 11))
    assert open_fight(DEFAULT_FIGHTS, top, SIX, won) is None and next_fight(DEFAULT_FIGHTS, top, SIX, won) is None
    # A ladder shortened in the rules file after more fights were won: nothing left either.
    assert open_fight(DEFAULT_FIGHTS[:4], top, SIX, won) is None and next_fight(DEFAULT_FIGHTS[:4], top, SIX, won) is None
```

- [ ] **Step 3: Run them to see them fail**

Run: `scripts/pytest.sh -q tests/test_rules.py tests/test_seals.py tests/test_fights.py`
Expected: FAIL (`ModuleNotFoundError: app.world.seals`).

- [ ] **Step 4: The trophies in the catalogue** — `server/app/world/catalog.py`: after `REWARDS = {…}` add

```python
# Spec 2026-09-29 lieutenant levels §1: five seals per lieutenant, each a material, each paying the
# lieutenant's keepsake in that material (the art track's trophies: the old relic as a statuette).
MATERIALS = ("bois", "bronze", "argent", "or", "orichalque")
SEAL_TITLES = ("Sceau de bois", "Sceau de bronze", "Sceau d'argent", "Sceau d'or", "Sceau d'orichalque")
OF_LIEUTENANT = {"hydre": "de l'Hydre", "echo": "d'Écho", "chimere": "de la Chimère", "protee": "de Protée",
                 "sirenes": "des Sirènes", "lethe": "de Léthé"}
TROPHY_OF = {"hydre": "Écaille de l'Hydre", "echo": "Voix d'Écho", "chimere": "Crinière de la Chimère",
             "protee": "Perle de Protée", "sirenes": "Plume de Sirène", "lethe": "Pavot de Léthé"}
_TROPHY_DESC = ("Un souvenir taillé dans le bois d'olivier.", "Un souvenir coulé dans le bronze, gravé de quelques traits.",
                "Un souvenir d'argent poli, gravé de motifs.", "Un souvenir d'or, orné de reliefs et de pierres fines.",
                "Un souvenir d'orichalque, le métal rouge de l'Atlantide, ciselé de filigranes.")


def trophy_id(key: str, level: int) -> str:
    return f"trophy:{key}:{level}"


REWARDS.update({trophy_id(k, level): _r(trophy_id(k, level), "trophy", f"{TROPHY_OF[k]} en {MATERIALS[level - 1]}",
                                        _TROPHY_DESC[level - 1], f"{SEAL_TITLES[level - 1]} {OF_LIEUTENANT[k]}")
                for k in LIEUTENANT_ORDER for level in range(1, len(MATERIALS) + 1)})
```

(the client's art tests read `_r("<id>", "<kind>"` literals: these entries are built, so they do not change those counts; the shelf ignores the new kind until Task 7).

- [ ] **Step 5: The window rules** — `server/app/world/seals.py`:

```python
"""Lieutenant levels, shown as seals (spec 2026-09-29 lieutenant levels §1): five per lieutenant, each
a material, each judged on a window of the lieutenant's days after its previous seal. The thresholds
come from the rules file (`Rules.levels`, defaults below). The window rules are pure; the readers
take a connection. On screen a level is always its material, never a number."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Any
from app.clock import local_day
from app.world.catalog import MATERIALS

MAX_LEVEL = len(MATERIALS)
LEVEL_XP = 100   # seal L pays LEVEL_XP × L (spec §1)
DEFAULT_LEVELS: list[dict[str, Any]] = [
    {"days": 3, "chances": 12, "correct": 0.85},
    {"days": 4, "chances": 25, "correct": 0.88},
    {"days": 6, "chances": 45, "correct": 0.91},
    {"days": 8, "chances": 70, "correct": 0.94},
    {"days": 10, "chances": 100, "correct": 0.97},
]
# A share of whole counts can land a hair under a threshold written as a decimal (22/25 against 0.88).
EPSILON = 1e-9


@dataclass(frozen=True)
class LevelWindow:
    days: int
    chances: int
    mistakes: int
    correct: float | None
    complete: bool


def since_day(reached_at: str | None) -> str | None:
    """The Swiss day a seal was won (R3): only the days after it count for the next one."""
    return local_day(reached_at) if reached_at else None


def level_window(day_rows: list[dict], since: str | None, need: dict[str, Any]) -> LevelWindow:
    """The most recent days with a chance, strictly after `since`, newest first, until the window holds
    `need["days"]` days and `need["chances"]` chances (spec §1)."""
    days = chances = mistakes = 0
    rows = sorted((r for r in day_rows if r["chances"] > 0 and (since is None or r["day"] > since)),
                  key=lambda r: r["day"], reverse=True)
    for r in rows:
        if days >= need["days"] and chances >= need["chances"]:
            break
        days += 1; chances += r["chances"]; mistakes += r["mistakes"]
    complete = days >= need["days"] and chances >= need["chances"]
    correct = max(0.0, (chances - mistakes) / chances) if chances else None
    return LevelWindow(days, chances, mistakes, correct, complete)


def reaches(w: LevelWindow, need: dict[str, Any]) -> bool:
    return w.complete and w.correct is not None and w.correct >= need["correct"] - EPSILON


def seal_day_rows(conn, profile_id: int, categories: list[str]) -> list[dict]:
    """Per Swiss day, the chances the texts gave the lieutenant (the opportunities) and the mistakes
    of its kind left in the handed-in copies (missed + introduced), sub-project 1's measure."""
    marks = ",".join("?" * len(categories))
    return [{"day": d, "chances": c or 0, "mistakes": m or 0} for d, c, m in conn.execute(
        f"SELECT day, SUM(occurrences), SUM(missed + introduced) FROM profile_stat_day "
        f"WHERE profile_id = ? AND category IN ({marks}) GROUP BY day", (profile_id, *categories))]
```

- [ ] **Step 6: The ladder** — `server/app/world/fights.py`:

```python
"""Éris's fights (spec 2026-09-29 lieutenant levels §4): a ladder of conditions on seals counted
across the lieutenants awake at the hero's class, never one named lieutenant. Fight N opens when its
condition holds and fights 1 to N-1 are won; a won fight stays won (a done boss quest keeps its
number). Pure: the ladder comes from the rules file (`Rules.fights`, defaults below)."""
from __future__ import annotations
from typing import Any

MAX_FIGHTS = 20
# For each seal L: « at least 2 at L », then « all at L ».
DEFAULT_FIGHTS: list[dict[str, Any]] = [{"level": level, "count": count} for level in range(1, 6) for count in (2, "all")]


def fight_need(fight: dict[str, Any], awake: int) -> int:
    """How many lieutenants the fight asks at its seal: « all » is every one awake, and a count above
    that asks them all (a ladder written for 8H never blocks a 7H hero)."""
    return awake if fight["count"] == "all" else min(int(fight["count"]), awake)


def _missing(fight: dict[str, Any], levels: dict[str, int], awake: list[str]) -> int:
    sealed = sum(1 for k in awake if levels.get(k, 0) >= fight["level"])
    return max(0, fight_need(fight, len(awake)) - sealed)


def open_fight(ladder: list[dict], levels: dict[str, int], awake: list[str], won: set[int]) -> int | None:
    """The first fight not won, when its condition holds (its tier, 1-based); else None."""
    for tier, fight in enumerate(ladder, start=1):
        if tier in won:
            continue
        return tier if _missing(fight, levels, awake) == 0 else None
    return None


def next_fight(ladder: list[dict], levels: dict[str, int], awake: list[str], won: set[int]) -> dict | None:
    """The first fight not won while it is not open yet: its tier, its seal and how many seals it still
    asks (R8). None once it is open, and once every fight is won."""
    for tier, fight in enumerate(ladder, start=1):
        if tier in won:
            continue
        missing = _missing(fight, levels, awake)
        return {"tier": tier, "level": fight["level"], "missing": missing} if missing else None
    return None
```

- [ ] **Step 7: The rules file's `levels` and `fights`** — `server/app/rules.py`: add `from app.world.catalog import LIEUTENANT_ORDER`, `from app.world.fights import DEFAULT_FIGHTS, MAX_FIGHTS` and `from app.world.seals import DEFAULT_LEVELS, MAX_LEVEL` next to sub-project 3's `app.world.dragon` import (none of these modules imports `app.rules`: no cycle); extend the module docstring's last sentence with "; the seals' thresholds (`levels`) and Éris's ladder (`fights`) are read by the server only"; add the fields after `dragon_stages`:

```python
    levels: list[dict[str, Any]] = field(default_factory=lambda: [dict(r) for r in DEFAULT_LEVELS])
    fights: list[dict[str, Any]] = field(default_factory=lambda: [dict(f) for f in DEFAULT_FIGHTS])
```

add after `_dragon_stages`:

```python
SEAL_KEYS = tuple(str(i) for i in range(1, MAX_LEVEL + 1))


def _levels(raw: Any, path: Path) -> list[dict[str, Any]] | None:
    """Spec 2026-09-29 lieutenant levels §1 (R2): each seal's days, chances and correct share; a wrong
    value keeps its default, the others still apply."""
    if not isinstance(raw, dict):
        log.warning('%s: levels must be an object like {"2": {"chances": 30}}; the built-in seals apply', path)
        return None
    out = [dict(r) for r in DEFAULT_LEVELS]
    for key, value in raw.items():
        if key not in SEAL_KEYS or not isinstance(value, dict):
            log.warning('%s: levels[%r] is ignored (the seals are "1" to "5", each an object like {"days": 3})', path, key)
            continue
        for name, v in value.items():
            ok = (name in ("days", "chances") and _count(v) and v >= 1) or (name == "correct" and _share(v) and v > 0)
            if not ok:
                log.warning("%s: levels[%r][%r] = %r is ignored (days and chances are whole numbers from 1, correct a "
                            "share above 0 and at most 1); its default applies", path, key, name, v)
                continue
            out[int(key) - 1][name] = float(v) if name == "correct" else v
    return out


def _fight(f: Any) -> bool:
    return (isinstance(f, dict) and set(f) == {"level", "count"} and _count(f["level"]) and 1 <= f["level"] <= MAX_LEVEL
            and (f["count"] == "all" or (_count(f["count"]) and 1 <= f["count"] <= len(LIEUTENANT_ORDER))))


def _fights(raw: Any, path: Path) -> list[dict[str, Any]] | None:
    """Spec §4 (R2): refused whole on any wrong entry: dropping one would renumber the fights after it,
    and a won fight is stored by its number."""
    if not isinstance(raw, list) or not 1 <= len(raw) <= MAX_FIGHTS or not all(_fight(f) for f in raw):
        log.warning('%s: fights must be a list of 1 to %d fights like {"level": 1, "count": 2} (a seal from 1 to %d, '
                    'a count from 1 to %d or "all"); the built-in fights apply', path, MAX_FIGHTS, MAX_LEVEL, len(LIEUTENANT_ORDER))
        return None
    return [{"level": f["level"], "count": f["count"]} for f in raw]
```

and in `load_rules`' loop, after the `dragon_stages` branch:

```python
        elif key == "levels":
            levels = _levels(value, path)
            if levels is not None:
                values[key] = levels
        elif key == "fights":
            fights = _fights(value, path)
            if fights is not None:
                values[key] = fights
```

- [ ] **Step 8: Run the server tests**

Run: `scripts/pytest.sh -q tests/test_rules.py tests/test_seals.py tests/test_fights.py` then `scripts/pytest.sh -q`
Expected: all pass, no warning in the output. Then `scripts/npm.sh run test -- src/lib/world/art.test.ts src/lib/world/rewards.test.ts` (the catalogue grew): pass.

- [ ] **Step 9: Commit**

```bash
git add server/app/world/seals.py server/app/world/fights.py server/app/rules.py server/app/world/catalog.py server/tests/test_seals.py server/tests/test_fights.py server/tests/test_rules.py
git commit -m "Server foundation for the lieutenants' seals: the window rule (days after the last seal, days, chances, correct share), Éris's ladder of fights on counts across lieutenants, levels and fights in data/regles.json with the usual fallback, the 30 trophies in the catalogue (not wired yet)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- server/app/world/seals.py server/app/world/fights.py server/app/rules.py server/app/world/catalog.py server/tests/test_seals.py server/tests/test_fights.py server/tests/test_rules.py
```

---

### Task 2: Server switch — seals replace neutralisation, fights from the ladder

**Files:**
- Create: `server/app/migrations/006_seals.sql`, `server/tests/test_seals_api.py`
- Modify: `server/app/world/seals.py` (readers, `raise_levels`, `next_seal`, `lieutenants_for_level`), `server/app/world/progression.py`, `server/app/world/oracle.py`, `server/app/world/catalog.py` (`MASTERY`, `QUEST_BONUS["mastery"]`, docstring), `server/app/routers/world.py`
- Delete: `server/app/world/mastery.py`
- Test: `server/tests/test_db.py`, `server/tests/test_progression.py`, `server/tests/test_world_rules.py`, `server/tests/test_world_api.py`, `server/tests/test_rules.py` (import only if needed), `web/e2e/world.spec.ts` (steps 6-7), `web/e2e/scenes-battle-victory.spec.ts` (the refusal line)

**Interfaces:**
- Consumes: Task 1's `seals`, `fights`, `Rules.levels`, `Rules.fights`, `trophy_id`; `grant_reward`, `add_xp` (`progression.py`); `app.state.rules`.
- Produces:
  - `app.world.seals`: `lieutenants_for_level(level: str) -> list[str]`; `level_rows(conn, pid) -> dict[str, tuple[int, str]]`; `levels_of(conn, pid) -> dict[str, int]` (every lieutenant, 0 before its first seal: **sub-project 4 reads this**); `raise_levels(conn, pid, awake, now, rules) -> list[tuple[str, int]]`; `next_seal(conn, pid, key, level, reached_at, rules) -> dict | None`.
  - `progression`: `"levels": [{"lieutenant", "level", "reward_id"}]`; bonus `{"reason": "level", "amount": 100 × L, "lieutenant", "level"}`; the trophy in `rewards`; compat `"neutralised"`.
  - `GET /camp` `lieutenants[]`: `"level"`, `"level_reached_at"`, `"next": {"level", "days", "chances", "correct", "complete", "need": {"days", "chances", "correct"}} | None`, compat `neutralised`/`neutralised_at`/`window`; `boss`: `+ "fights": int, "next": {"tier", "level", "missing"} | None`; `dragon` compat `neutralised` = lieutenants with a seal.
  - `GET /api/world` without `"mastery"`; `QUEST_BONUS` without `"mastery"`.
  - `oracle.compute_scrolls(conn, profile, available, levels)`, `get_or_seal(conn, profile, week, available, levels, now)`.
  - `create_boss_quest(conn, profile, now, rules)`; `BOSS_MESSAGE = "Éris ne se montre pas encore. Gagne d'abord d'autres sceaux sur ses lieutenants."`.

- [ ] **Step 1: Write the failing migration test** — `server/tests/test_db.py`: replace `_pre_005_db` by a general helper and keep the old name:

```python
def _db_before(path, version):
    """A database as the game left it before migration `version`: the earlier migrations only."""
    conn = connect(path)
    conn.execute("CREATE TABLE schema_version (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)")
    for f in sorted(MIGRATIONS_DIR.glob("*.sql")):
        v = int(f.name.split("_", 1)[0])
        if v >= version:
            break
        conn.executescript(f.read_text(encoding="utf-8"))
        conn.execute("INSERT INTO schema_version(version, applied_at) VALUES (?, 'then')", (v,))
    conn.commit()
    return conn


def _pre_005_db(path):
    """A database as the game left it before sub-project 1: migrations 001-004 only."""
    return _db_before(path, 5)
```

and add:

```python
# Spec 2026-09-29 lieutenant levels §3 (review focus 5).
def test_migration_006_turns_each_neutralised_lieutenant_into_its_wooden_seal(tmp_path):
    conn = _db_before(tmp_path / "old.sqlite3", 6)
    for pid, name in ((1, "Io"), (2, "Ada")):
        conn.execute("INSERT INTO profile(id, name, avatar, level, help_stage, created_at) VALUES (?, ?, 'chouette', '8H', 0, 'now')",
                     (pid, name))
    conn.executemany("INSERT INTO mastery(profile_id, lieutenant, neutralised_at) VALUES (?, ?, ?)",
                     [(1, "hydre", "2026-09-10T08:00:00+00:00"), (1, "echo", "2026-09-12T18:30:00+00:00")])
    conn.executemany("INSERT INTO reward(profile_id, reward_id, source, granted_at, equipped) VALUES (?, ?, ?, ?, ?)",
                     [(1, "ecaille_hydre", "mastery:hydre", "2026-09-10T08:00:01+00:00", 1),
                      (1, "sandales_hermes", "quest:4", "2026-09-15T10:00:00+00:00", 1),
                      (2, "plume_sirene", "mastery:sirenes", "2026-09-11T10:00:00+00:00", 0)])   # no mastery row (by hand)
    conn.executemany("INSERT INTO xp_event(profile_id, amount, reason, created_at) VALUES (?, ?, ?, ?)",
                     [(1, 200, "mastery", "2026-09-10T08:00:00+00:00"), (1, 54, "session", "2026-09-10T08:00:00+00:00")])
    conn.commit()
    assert migrate(conn) >= 6
    assert [tuple(r) for r in conn.execute(
        "SELECT profile_id, lieutenant, level, reached_at FROM lieutenant_level ORDER BY profile_id, lieutenant")] == [
        (1, "echo", 1, "2026-09-12T18:30:00+00:00"), (1, "hydre", 1, "2026-09-10T08:00:00+00:00")]
    assert [tuple(r) for r in conn.execute(
        "SELECT profile_id, reward_id, source, granted_at, equipped FROM reward ORDER BY profile_id, reward_id")] == [
        (1, "sandales_hermes", "quest:4", "2026-09-15T10:00:00+00:00", 1),
        (1, "trophy:echo:1", "level:echo:1", "2026-09-12T18:30:00+00:00", 0),       # its relic row was missing
        (1, "trophy:hydre:1", "level:hydre:1", "2026-09-10T08:00:01+00:00", 1)]
    assert conn.execute("SELECT COUNT(*) FROM mastery").fetchone()[0] == 2           # kept, no longer written
    assert conn.execute("SELECT SUM(amount) FROM xp_event WHERE profile_id = 1").fetchone()[0] == 254
    assert migrate(conn) >= 6                                                        # idempotent
    assert conn.execute("SELECT COUNT(*) FROM lieutenant_level").fetchone()[0] == 2
```

- [ ] **Step 2: Write the failing API tests** — `server/tests/test_seals_api.py`:

```python
"""Seals and fights through the API (spec 2026-09-29 lieutenant levels §1, §4, §5)."""
import json
import sqlite3

from app.db import DB_FILENAME
from app.rules import RULES_FILENAME
from app.world import oracle as oracle_mod
from app.world.seals import lieutenants_for_level
from tests.test_progression import hydre_result, post
from tests.test_sessions import make_profile, make_text
from fastapi.testclient import TestClient
from app.main import create_app

BOSS_MESSAGE = "Éris ne se montre pas encore. Gagne d'abord d'autres sceaux sur ses lieutenants."
LONG = " ".join(["Les fées dansent dans la clairière et les oiseaux les écoutent."] * 16)   # ≥ 150 words


def db(settings) -> sqlite3.Connection:
    conn = sqlite3.connect(settings.data_dir / DB_FILENAME)
    conn.row_factory = sqlite3.Row
    return conn


def seal(settings, pid, key, level, reached_at="2026-09-01T12:00:00+00:00"):
    conn = db(settings)
    conn.execute("INSERT OR REPLACE INTO lieutenant_level(profile_id, lieutenant, level, reached_at) VALUES (?, ?, ?, ?)",
                 (pid, key, level, reached_at))
    conn.commit(); conn.close()


def won(settings, pid, *tiers):
    conn = db(settings)
    for t in tiers:
        conn.execute("INSERT INTO quest(profile_id, kind, target, status, goal_json, reward_json, created_at, completed_at) "
                     "VALUES (?, 'boss', 'eris', 'done', ?, '{\"xp\": 300}', 'then', 'then')", (pid, json.dumps({"tier": t, "text_id": 1})))
    conn.commit(); conn.close()


def stat_days(settings, pid, category, days, chances, mistakes=0, draft=0, caught=0):
    conn = db(settings)
    conn.executemany("INSERT INTO profile_stat_day(profile_id, day, category, occurrences, errors_in_draft, caught, missed) "
                     "VALUES (?, ?, ?, ?, ?, ?, ?)", [(pid, d, category, chances, draft, caught, mistakes) for d in days])
    conn.commit(); conn.close()


def camp(client, pid):
    return client.get(f"/api/profiles/{pid}/camp").json()


def hydre(c):
    return next(l for l in c["lieutenants"] if l["key"] == "hydre")


def test_three_days_of_guard_win_the_hydras_wooden_seal(client, settings):
    pid = make_profile(client, level="10H"); tid = make_text(client)
    p1 = post(client, pid, tid, hydre_result(), day="2026-09-21")["progression"]
    p2 = post(client, pid, tid, hydre_result(), day="2026-09-22")["progression"]
    assert p1["levels"] == [] and p2["levels"] == []                      # 2 days: the window is not full
    p = post(client, pid, tid, hydre_result(), day="2026-09-23")["progression"]
    assert p["levels"] == [{"lieutenant": "hydre", "level": 1, "reward_id": "trophy:hydre:1"}]
    assert {"reason": "level", "amount": 100, "lieutenant": "hydre", "level": 1} in p["xp"]["bonuses"]
    assert all(b["reason"] != "mastery" for b in p["xp"]["bonuses"])
    assert p["rewards"] == [{"id": "trophy:hydre:1", "kind": "trophy", "name": "Écaille de l'Hydre en bois"}]
    assert p["neutralised"] == ["hydre"]                                    # compat until Task 6
    c = camp(client, pid)
    h = hydre(c)
    assert (h["level"], h["level_reached_at"]) == (1, "2026-09-23T12:00:00+00:00")
    assert h["next"] == {"level": 2, "days": 0, "chances": 0, "correct": None, "complete": False,
                         "need": {"days": 4, "chances": 25, "correct": 0.88}}
    assert h["bestiary_unlocked"] is True
    conn = db(settings)
    assert conn.execute("SELECT COUNT(*) FROM mastery").fetchone()[0] == 0   # no longer written
    conn.close()


def test_the_next_seal_counts_only_days_after_the_last(client):
    pid = make_profile(client, level="10H"); tid = make_text(client)
    for day in ("2026-09-21", "2026-09-22", "2026-09-23"):
        post(client, pid, tid, hydre_result(), day=day)
    assert post(client, pid, tid, hydre_result(), day="2026-09-23")["progression"]["levels"] == []   # the same day
    for day in ("2026-09-24", "2026-09-25", "2026-09-26"):
        assert post(client, pid, tid, hydre_result(), day=day)["progression"]["levels"] == []        # 3 days of 4
    p = post(client, pid, tid, hydre_result(), day="2026-09-27")["progression"]
    assert p["levels"] == [{"lieutenant": "hydre", "level": 2, "reward_id": "trophy:hydre:2"}]
    assert {"reason": "level", "amount": 200, "lieutenant": "hydre", "level": 2} in p["xp"]["bonuses"]


# Review focus 1: a long clean history before the deploy gives the first seal only.
def test_one_session_raises_a_lieutenant_by_one_seal_at_most(client, settings):
    pid = make_profile(client, level="10H"); tid = make_text(client)
    stat_days(settings, pid, "agreement:verb", [f"2026-09-{d:02d}" for d in range(1, 11)], 20)
    assert post(client, pid, tid, hydre_result(), day="2026-09-30")["progression"]["levels"] == [
        {"lieutenant": "hydre", "level": 1, "reward_id": "trophy:hydre:1"}]
    assert post(client, pid, tid, hydre_result(), day="2026-09-30")["progression"]["levels"] == []
    assert hydre(camp(client, pid))["level"] == 1


def test_a_seal_is_never_skipped_by_the_store(client, settings, monkeypatch):
    # R5: seal L+1 is written only over seal L. A request that read « no seal yet » while another one
    # wrote seal 3 changes nothing, and reports nothing.
    from app.rules import Rules
    from app.world import seals
    pid = make_profile(client, level="10H")
    stat_days(settings, pid, "agreement:verb", ["2026-09-01", "2026-09-02", "2026-09-03"], 10)
    seal(settings, pid, "hydre", 3)
    monkeypatch.setattr(seals, "level_rows", lambda conn, profile_id: {})    # the stale read
    conn = db(settings)
    assert seals.raise_levels(conn, pid, ["hydre"], "2026-09-04T12:00:00+00:00", Rules()) == []
    assert conn.execute("SELECT level FROM lieutenant_level WHERE profile_id = ?", (pid,)).fetchone()[0] == 3
    conn.close()


def test_a_seal_is_never_lost(client):
    pid = make_profile(client, level="10H"); tid = make_text(client)
    for day in ("2026-09-21", "2026-09-22", "2026-09-23"):
        post(client, pid, tid, hydre_result(), day=day)
    post(client, pid, tid, hydre_result(draft=8, caught=0, left=8), day="2026-09-24")
    h = hydre(camp(client, pid))
    assert h["level"] == 1 and h["next"]["correct"] == 0.2


def test_the_seals_thresholds_come_from_the_rules_file(settings):
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    (settings.data_dir / RULES_FILENAME).write_text('{"levels": {"1": {"days": 1, "chances": 5}}}', encoding="utf-8")
    with TestClient(create_app(settings)) as c:
        pid = make_profile(c, level="10H"); tid = make_text(c)
        assert post(c, pid, tid, hydre_result(), day="2026-09-21")["progression"]["levels"][0]["level"] == 1
        assert hydre(camp(c, pid))["next"]["need"] == {"days": 4, "chances": 25, "correct": 0.88}


def test_protee_is_judged_only_from_8h(client, settings):
    pid = make_profile(client, level="7H"); tid = make_text(client)
    stat_days(settings, pid, "agreement:participle", ["2026-09-01", "2026-09-02", "2026-09-03"], 10)
    assert post(client, pid, tid, hydre_result(), day="2026-09-10")["progression"]["levels"] == []
    assert client.patch(f"/api/profiles/{pid}", json={"level": "8H"}).status_code == 200
    assert post(client, pid, tid, hydre_result(), day="2026-09-11")["progression"]["levels"] == [
        {"lieutenant": "protee", "level": 1, "reward_id": "trophy:protee:1"}]


def test_the_oracle_looks_at_the_lowest_seals_first(client, settings):
    # R10: the Hydra's catch rate is the worst, but she has a seal; Écho has none.
    pid = make_profile(client, level="10H")
    stat_days(settings, pid, "agreement:verb", ["2026-09-01"], 10, draft=10, caught=1)
    stat_days(settings, pid, "homophone", ["2026-09-01"], 10, draft=10, caught=5)
    seal(settings, pid, "hydre", 1)
    conn = db(settings)
    profile = conn.execute("SELECT * FROM profile WHERE id = ?", (pid,)).fetchone()
    levels = {"hydre": 1, "echo": 0, "chimere": 0, "protee": 0, "sirenes": 0, "lethe": 0}
    assert oracle_mod.compute_scrolls(conn, profile, lieutenants_for_level("10H"), levels) == {"faible": "echo", "destin": "chimere"}
    conn.close()


def test_the_first_fight_opens_at_two_wooden_seals(client, settings):
    pid = make_profile(client, level="10H")
    assert camp(client, pid)["boss"] == {"tier_available": None, "tiers_won": [], "active_quest_id": None, "fights": 10,
                                         "next": {"tier": 1, "level": 1, "missing": 2}}
    seal(settings, pid, "hydre", 1)
    assert camp(client, pid)["boss"]["next"] == {"tier": 1, "level": 1, "missing": 1}
    r = client.post(f"/api/profiles/{pid}/boss")
    assert r.status_code == 409 and r.json()["detail"] == BOSS_MESSAGE
    seal(settings, pid, "lethe", 3)
    b = camp(client, pid)["boss"]
    assert (b["tier_available"], b["next"]) == (1, None)
    assert camp(client, pid)["dragon"]["neutralised"] == 2                  # compat until Task 5


# Review focus 4.
def test_won_fights_stay_won_when_protee_wakes(client, settings):
    pid = make_profile(client, level="7H")
    for key in ("hydre", "echo", "chimere", "sirenes", "lethe"):
        seal(settings, pid, key, 1)
    won(settings, pid, 1, 2)
    b = camp(client, pid)["boss"]
    assert (b["tier_available"], b["tiers_won"], b["next"]) == (None, [1, 2], {"tier": 3, "level": 2, "missing": 2})
    assert client.patch(f"/api/profiles/{pid}", json={"level": "8H"}).status_code == 200
    b = camp(client, pid)["boss"]
    assert (b["tier_available"], b["tiers_won"], b["next"]) == (None, [1, 2], {"tier": 3, "level": 2, "missing": 2})
    seal(settings, pid, "hydre", 2); seal(settings, pid, "echo", 2)
    assert camp(client, pid)["boss"]["tier_available"] == 3


def test_the_fights_after_the_third_pay_xp_only(client, settings):
    pid = make_profile(client, level="10H"); long_text = make_text(client, body=LONG)
    for key in ("hydre", "echo", "chimere", "protee", "sirenes", "lethe"):
        seal(settings, pid, key, 2)
    won(settings, pid, 1, 2, 3)
    b = client.post(f"/api/profiles/{pid}/boss").json()
    assert b["tier"] == 4 and b["quest"]["reward"] == {"xp": 300, "reward_id": None, "bestiary": False}
    p = post(client, pid, long_text, hydre_result(draft=0, caught=0), quest_id=b["quest"]["id"], encounter="eris")["progression"]
    assert p["boss"] == {"tier": 4, "won": True} and p["rewards"] == [] and {"reason": "boss", "amount": 300} in p["xp"]["bonuses"]
    c = camp(client, pid)["boss"]
    assert c["tiers_won"] == [1, 2, 3, 4] and c["next"] == {"tier": 5, "level": 3, "missing": 2}
```

`server/tests/test_progression.py`: replace the mastery test (after sub-project 3: `test_mastery_over_three_days_grants_the_relic_and_the_dragon_hatches_from_xp`) by

```python
def test_three_days_grant_the_wooden_seal_and_the_dragon_hatches_from_xp(client):
    pid = make_profile(client, level="10H"); tid = make_text(client)
    p1 = post(client, pid, tid, hydre_result(), day="2026-09-21")["progression"]
    p2 = post(client, pid, tid, hydre_result(), day="2026-09-22")["progression"]
    p = post(client, pid, tid, hydre_result(), day="2026-09-23")["progression"]
    # Spec 2026-09-29 lieutenant levels §1: the first seal and its trophy; the dragon hatched from XP.
    assert p1["dragon"]["stage_after"] == "egg"
    assert p2["dragon"] == {"stage_before": "egg", "stage_after": "hatchling", "needs_name": True}
    assert p["levels"] == [{"lieutenant": "hydre", "level": 1, "reward_id": "trophy:hydre:1"}]
    assert [r["id"] for r in p["rewards"]] == ["trophy:hydre:1"]
    assert {"reason": "level", "amount": 100, "lieutenant": "hydre", "level": 1} in p["xp"]["bonuses"]
    # never lost: a bad day later keeps it
    p4 = post(client, pid, tid, hydre_result(draft=6, caught=0), day="2026-09-24")["progression"]
    assert p4["levels"] == [] and p4["dragon"]["stage_after"] == "hatchling"
```

`test_same_day_sessions_count_as_one_day`: `["neutralised"] == []` becomes `["levels"] == []`. In `test_session_grants_xp_and_reports_the_dragons_gauge` (sub-project 3's name), `p["neutralised"] == []` becomes `p["levels"] == []`. Any other assertion on `neutralised` in the file follows the same rule (grep it).

`server/tests/test_world_rules.py`: delete `Window`, `mastery_window`, `is_neutralised`, `boss_tiers`, `tier_available` from the imports (import `lieutenants_for_level` from `app.world.seals`), delete `rows()` and the five `test_window_*` tests and `test_boss_tiers` (their rules are gone; the window is pinned by `test_seals.py`, the ladder by `test_fights.py`).

`server/tests/test_world_api.py`:
  - `test_world_catalog`: delete `and w["mastery"] == {…}` from its assertion and add `assert "mastery" not in w and "mastery" not in w["quest_bonus"]`;
  - `test_camp_for_new_profile`: `c["boss"] == {"tier_available": None, "tiers_won": [], "active_quest_id": None, "fights": 10, "next": {"tier": 1, "level": 1, "missing": 2}}`, and add

```python
    hydre = next(l for l in c["lieutenants"] if l["key"] == "hydre")
    assert (hydre["level"], hydre["level_reached_at"]) == (0, None)
    assert hydre["next"] == {"level": 1, "days": 0, "chances": 0, "correct": None, "complete": False,
                             "need": {"days": 3, "chances": 12, "correct": 0.85}}
```

  - `test_boss_flow`: the comment « neutralise hydre and echo via the test clock » becomes « the wooden seals of hydre and echo via the test clock (spec 2026-09-29 lieutenant levels §4: fight I asks two) »; the final `rewards` set becomes `{"trophy:hydre:1", "trophy:echo:1", "sandales_hermes"}`;
  - `test_oracle_faible_and_destin_pick_sensible_monsters`: unchanged in intent (no seal yet: every lieutenant is at the lowest seal).

- [ ] **Step 3: Run them to see them fail**

Run: `scripts/pytest.sh -q tests/test_db.py tests/test_seals_api.py tests/test_progression.py tests/test_world_api.py tests/test_world_rules.py`
Expected: FAIL (no table `lieutenant_level`, no `levels` in the progression).

- [ ] **Step 4: Migration 006** — `server/app/migrations/006_seals.sql`:

```sql
-- Sub-project 2 (spec 2026-09-29 lieutenant levels §3): the lieutenants' seals. Each neutralised
-- lieutenant becomes seal 1 (bois), won when it was neutralised; its relic becomes the wooden trophy,
-- granted and displayed as the relic was (or when it was neutralised, if the relic row is missing).
-- A relic row without a mastery row (only possible by hand) goes with the others. The mastery table
-- stays (no destructive migration) but is no longer written. XP is untouched.
CREATE TABLE lieutenant_level (
  profile_id INTEGER NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  lieutenant TEXT NOT NULL,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 5),
  reached_at TEXT NOT NULL,
  PRIMARY KEY (profile_id, lieutenant));
INSERT INTO lieutenant_level(profile_id, lieutenant, level, reached_at)
  SELECT profile_id, lieutenant, 1, neutralised_at FROM mastery;
CREATE TEMP TABLE relic_of (lieutenant TEXT PRIMARY KEY, relic TEXT NOT NULL);
INSERT INTO relic_of VALUES ('hydre', 'ecaille_hydre'), ('echo', 'voix_echo'), ('chimere', 'criniere_chimere'),
  ('protee', 'perle_protee'), ('sirenes', 'plume_sirene'), ('lethe', 'pavot_lethe');
INSERT OR IGNORE INTO reward(profile_id, reward_id, source, granted_at, equipped)
  SELECT m.profile_id, 'trophy:' || m.lieutenant || ':1', 'level:' || m.lieutenant || ':1',
         COALESCE(r.granted_at, m.neutralised_at), COALESCE(r.equipped, 0)
  FROM mastery m JOIN relic_of o ON o.lieutenant = m.lieutenant
  LEFT JOIN reward r ON r.profile_id = m.profile_id AND r.reward_id = o.relic;
DELETE FROM reward WHERE reward_id IN (SELECT relic FROM relic_of);
DROP TABLE relic_of;
```

- [ ] **Step 5: The seals' readers and writer** — `server/app/world/seals.py`: add `from typing import TYPE_CHECKING`, `from app.levels import level_index`, extend the catalog import to `LIEUTENANTS, LIEUTENANT_ORDER, MATERIALS`, add `if TYPE_CHECKING: from app.rules import Rules`, and append:

```python
def lieutenants_for_level(level: str) -> list[str]:
    """The lieutenants awake at a class (Protée from 8H), in the camp's order."""
    return [k for k in LIEUTENANT_ORDER if level_index(level) >= level_index(LIEUTENANTS[k]["min_level"])]


def level_rows(conn, profile_id: int) -> dict[str, tuple[int, str]]:
    return {k: (lvl, at) for k, lvl, at in conn.execute(
        "SELECT lieutenant, level, reached_at FROM lieutenant_level WHERE profile_id = ?", (profile_id,))}


def levels_of(conn, profile_id: int) -> dict[str, int]:
    """Every lieutenant's seal, 0 before its first one. Sub-project 4's stall reads this (a lieutenant's
    seal L puts one accessory of its set on sale from L = 2)."""
    rows = level_rows(conn, profile_id)
    return {k: rows[k][0] if k in rows else 0 for k in LIEUTENANT_ORDER}


def _window(conn, profile_id: int, key: str, level: int, reached_at: str | None, rules: "Rules") -> LevelWindow:
    return level_window(seal_day_rows(conn, profile_id, LIEUTENANTS[key]["categories"]), since_day(reached_at), rules.levels[level])


def next_seal(conn, profile_id: int, key: str, level: int, reached_at: str | None, rules: "Rules") -> dict | None:
    """The window toward the next seal, for the war tent's gauges (None after the fifth)."""
    if level >= MAX_LEVEL:
        return None
    w = _window(conn, profile_id, key, level, reached_at, rules)
    return {"level": level + 1, "days": w.days, "chances": w.chances, "correct": w.correct, "complete": w.complete,
            "need": dict(rules.levels[level])}


def raise_levels(conn, profile_id: int, awake: list[str], now: str, rules: "Rules") -> list[tuple[str, int]]:
    """After a saved session (R4): each lieutenant awake at the class whose window passes gains its next
    seal, one at most. Written only over the seal before it (R5). Returns (lieutenant, new seal)."""
    rows = level_rows(conn, profile_id)
    raised = []
    for key in awake:
        level, reached_at = rows.get(key, (0, None))
        if level >= MAX_LEVEL or not reaches(_window(conn, profile_id, key, level, reached_at, rules), rules.levels[level]):
            continue
        cur = conn.execute(
            "INSERT INTO lieutenant_level(profile_id, lieutenant, level, reached_at) VALUES (?, ?, ?, ?) "
            "ON CONFLICT(profile_id, lieutenant) DO UPDATE SET level = excluded.level, reached_at = excluded.reached_at "
            "WHERE lieutenant_level.level = excluded.level - 1", (profile_id, key, level + 1, now))
        if cur.rowcount == 1:
            raised.append((key, level + 1))
    return raised
```

- [ ] **Step 6: The session raises seals** — `server/app/world/progression.py`:
  - docstring's first line: `"""Applies a saved session to the world: XP, quests, seals, weekly goal, then the dragon grown from the total XP (spec §3.6; spec 2026-09-29 dragon growth §1, lieutenant levels §1)."""` (keep the second line);
  - imports: add `trophy_id` to the `app.world.catalog` import; replace the `app.world.mastery` import line by `from app.world.seals import LEVEL_XP, lieutenants_for_level, raise_levels`; delete `lieutenant_day_rows` and `neutralised_set` (their callers go in Step 7);
  - replace the whole `# 3. mastery (permanent)` block (from that comment through the relic's `rewards.append`) by:

```python
    # 3. seals (spec 2026-09-29 lieutenant levels §1): each lieutenant awake at this class may gain its
    # next seal, judged on the days after its last one; one at most per session; never lost. Seal L pays
    # LEVEL_XP × L and the lieutenant's trophy in that material.
    levels_out = []
    for key, reached in raise_levels(conn, pid, lieutenants_for_level(level), now, rules):
        amount = LEVEL_XP * reached
        add_xp(conn, pid, amount, "level", now, session_id=session_id, week=week)
        bonuses.append({"reason": "level", "amount": amount, "lieutenant": key, "level": reached})
        rid = trophy_id(key, reached)
        if grant_reward(conn, pid, rid, f"level:{key}:{reached}", now):
            r = REWARDS[rid]; rewards.append({"id": rid, "kind": r["kind"], "name": r["name"]})
        levels_out.append({"lieutenant": key, "level": reached, "reward_id": rid})
```

  - in the returned dict replace `"neutralised": newly,` by

```python
            "levels": levels_out,
            # Compat until Task 6: the victory's old card reads the lieutenants that won their first seal.
            "neutralised": [u["lieutenant"] for u in levels_out if u["level"] == 1],
```

  (`level` is the hero's class in this function: the loop names the new seal `reached`.)
- `server/app/world/catalog.py`: delete `MASTERY`; `QUEST_BONUS = {"board": 60, "oracle": 150, "boss": 300, "weekly": 40}`; docstring `"""World catalog: lieutenants, rewards, the seals' materials and trophies (plan Decisions 1, 6, 12, 20; spec 2026-09-29 lieutenant levels). French labels are UI text served by GET /api/world."""` (keep sub-project 3's note on the stages if its docstring has one).
- [ ] **Step 7: The Oracle, the camp, the fights** — `server/app/world/oracle.py`:

```python
def compute_scrolls(conn, profile, available, levels) -> dict:
    """R10 (spec 2026-09-29 lieutenant levels §5): lowest seal first. The weak point is chosen among the
    awake lieutenants at the lowest seal; fate among the others, by seal, then the longest unseen."""
    pid = profile["id"]
    low = min(levels.get(k, 0) for k in available)
    candidates = [k for k in available if levels.get(k, 0) == low]
    rates, last = {}, {}
    for k in available:
        cats = LIEUTENANTS[k]["categories"]; marks = ",".join("?" * len(cats))
        row = conn.execute(f"SELECT SUM(errors_in_draft) d, SUM(caught) c, SUM(missed) m, MAX(day) last FROM profile_stat_day "
                           f"WHERE profile_id = ? AND category IN ({marks})", (pid, *cats)).fetchone()
        d, c, m = row["d"] or 0, row["c"] or 0, row["m"] or 0
        rates[k] = (c / d if d >= 5 else None, m); last[k] = row["last"] or ""
    with_rate = [k for k in candidates if rates[k][0] is not None]
    if with_rate: faible = min(with_rate, key=lambda k: (rates[k][0], candidates.index(k)))
    elif any(rates[k][1] for k in candidates): faible = max(candidates, key=lambda k: rates[k][1])
    else: faible = candidates[0]
    others = sorted((k for k in available if k != faible), key=lambda k: (levels.get(k, 0), last[k], available.index(k)))
    return {"faible": faible, "destin": others[0] if others else faible}
```

and `get_or_seal(conn, profile, week, available, levels, now)` passes `levels` to `compute_scrolls`.

`server/app/routers/world.py`:
  - module docstring: "the only writer of quest/oracle/dragon/reward/xp_event/lieutenant_level state outside of app.world.progression";
  - imports: `from app.world.catalog import BOSS_REWARDS, LIEUTENANT_ORDER, LIEUTENANTS, ORACLE_REWARDS, QUEST_BONUS, REWARDS, TINTS` (no `MASTERY`); `from app.world.fights import next_fight, open_fight`; `from app.world.seals import level_rows, levels_of, lieutenants_for_level, next_seal`; the `app.world.mastery` import goes; `neutralised_set` and `lieutenant_day_rows` leave the `app.world.progression` import;
  - `BOSS_MESSAGE = "Éris ne se montre pas encore. Gagne d'abord d'autres sceaux sur ses lieutenants."`;
  - `dragon_out`: `n = sum(1 for v in levels_of(conn, pid).values() if v >= 1)  # compat until Task 5 (the camp's old « tricks before Éris »)` in place of the `neutralised_set` count;
  - `lieutenant_states`:

```python
def lieutenant_states(conn: sqlite3.Connection, profile: sqlite3.Row, rules: Rules) -> list[dict]:
    pid = profile["id"]
    available = set(lieutenants_for_level(profile["level"]))
    seals = level_rows(conn, pid)
    out = []
    for key in LIEUTENANT_ORDER:
        cats = LIEUTENANTS[key]["categories"]
        marks = ",".join("?" * len(cats))
        row = conn.execute(f"SELECT SUM(errors_in_draft) t, SUM(caught) c, SUM(missed) m, MAX(day) last FROM profile_stat_day "
                           f"WHERE profile_id = ? AND category IN ({marks})", (pid, *cats)).fetchone()
        traps, caught, missed = row["t"] or 0, row["c"] or 0, row["m"] or 0
        level, reached_at = seals.get(key, (0, None))
        nxt = next_seal(conn, pid, key, level, reached_at, rules)
        # Spec 2026-09-29 lieutenant levels §5: the page opens at the first seal or a finished quest.
        bestiary_unlocked = level >= 1 or conn.execute(
            "SELECT 1 FROM quest WHERE profile_id = ? AND kind IN ('board','oracle') AND target = ? AND status = 'done' LIMIT 1",
            (pid, key)).fetchone() is not None
        active_quest = conn.execute(
            "SELECT id FROM quest WHERE profile_id = ? AND kind IN ('board','oracle') AND target = ? AND status = 'active' LIMIT 1",
            (pid, key)).fetchone()
        out.append({
            "key": key, "name": LIEUTENANTS[key]["name"], "categories": cats, "available": key in available,
            # Spec §1: the seal won (0 before the first) and the window toward the next (None after the fifth).
            "level": level, "level_reached_at": reached_at, "next": nxt,
            "all_time": {"traps": traps, "caught": caught, "missed": missed, "rate": (caught / traps) if traps else None},
            "last_day": row["last"], "bestiary_unlocked": bestiary_unlocked, "active_quest_id": active_quest["id"] if active_quest else None,
            # Compat until Task 4: the war tent still reads these.
            "neutralised": level >= 1, "neutralised_at": reached_at if level >= 1 else None,
            "window": {"days": nxt["days"], "traps": nxt["chances"], "caught": 0, "rate": nxt["correct"], "complete": nxt["complete"]}
                      if nxt else {"days": 0, "traps": 0, "caught": 0, "rate": None, "complete": False},
        })
    return out
```

  - `create_boss_quest(conn, profile, now, rules)`:

```python
def create_boss_quest(conn: sqlite3.Connection, profile: sqlite3.Row, now: str, rules: Rules) -> tuple[dict, bool]:
    pid = profile["id"]
    # Spec 2026-09-29 lieutenant levels §4: the first fight not won, when its seals are there.
    tier = open_fight(rules.fights, levels_of(conn, pid), lieutenants_for_level(profile["level"]), boss_tiers_won(conn, pid))
    if tier is None:
        raise HTTPException(409, BOSS_MESSAGE)
    existing = conn.execute("SELECT * FROM quest WHERE profile_id = ? AND kind = 'boss' AND status = 'active'", (pid,)).fetchone()
    if existing is not None:
        goal = json.loads(existing["goal_json"])
        return {"quest": quest_out(conn, existing), "text_id": goal["text_id"], "tier": goal["tier"]}, False
    text_id = _pick_boss_text(conn, profile)
    if text_id is None:
        raise HTTPException(409, "Éris ne trouve pas de texte assez long pour ce combat.")
    goal = {"tier": tier, "text_id": text_id}
    # The first three fights keep their divine gear; the later ones pay their XP only (R8).
    reward = {"xp": QUEST_BONUS["boss"], "reward_id": BOSS_REWARDS.get(tier), "bestiary": False}
    quest = create_quest(conn, profile, "boss", "eris", None, goal, reward, now)
    return {"quest": quest, "text_id": text_id, "tier": tier}, True
```

  - `get_world`: delete `"mastery": MASTERY,`;
  - `get_camp`: `levels = levels_of(db, pid)` in place of `neutralised = neutralised_set(db, pid)`; `oracle_mod.get_or_seal(db, profile, week, available, levels, now)`; `tier_avail = open_fight(rules.fights, levels, available, won)`; `"lieutenants": lieutenant_states(db, profile, rules),`; the `boss` block:

```python
        "boss": {"tier_available": tier_avail, "tiers_won": sorted(won), "active_quest_id": active_boss["id"] if active_boss else None,
                 # Spec §4: the ladder's length, and what opens the next fight (None once one is open or all are won).
                 "fights": len(rules.fights), "next": next_fight(rules.fights, levels, available, won) if tier_avail is None else None},
```

  (`rules = request.app.state.rules` is already there since sub-project 3; if not, add it and `request: Request` to the signature.)
  - `get_oracle` / `post_oracle`: `levels = levels_of(db, profile["id"])` in place of `neutralised = …`, passed to `get_or_seal`;
  - `post_boss(profile_id: int, response: Response, request: Request, db: …)` and `create_boss_quest(db, profile, now_utc(), request.app.state.rules)`.
  - Then `git rm server/app/world/mastery.py`: `grep -rn "world.mastery\|from app.world import mastery" server` must print nothing first.

- [ ] **Step 8: Run the server tests**

Run: `scripts/pytest.sh -q tests/test_db.py tests/test_seals.py tests/test_seals_api.py tests/test_fights.py tests/test_progression.py tests/test_world_api.py tests/test_world_rules.py tests/test_rules.py` then `scripts/pytest.sh -q`
Expected: all pass, no warning. `grep -rnE "neutralised_set|lieutenant_day_rows|mastery_window|is_neutralised|tier_available\(|boss_tiers\(|MASTERY|INSERT INTO mastery" server/app` prints nothing.

- [ ] **Step 9: The world e2e** — `web/e2e/world.spec.ts`:
  - the describe title: `'world: camp, Oracle, quests, the dragon hatching from XP, seals, boss'` and the header comment's « a 3-day mastery hatch » becomes « the first seal over three days »;
  - step 6: title `'6. three days of guard win the Hydra\'s wooden seal (its trophy, 100 XP); naming the dragon; the dossier changes voice'`; the loop keeps its three days and becomes

```ts
    // Spec 2026-09-29 lieutenant levels §1: the first seal asks 3 days with a chance, 12 chances and 85 %
    // right in the handed-in copy. This hero already met the Hydra today (steps 4-5), so the seal may
    // come before the third of these days: find the response that brings it.
    let sealed: any = null;
    for (const day of ['2026-09-21', '2026-09-22', '2026-09-23']) {
      const res = await postSession(request, {
        profileId: Number(profileId),
        textId,
        day,
        result: makeResult({ draft: 4, caught: 4, category: 'agreement:verb' }),
      });
      if (res.progression.levels.some((u: { lieutenant: string }) => u.lieutenant === 'hydre')) {
        sealed = res;
        break;
      }
    }
    expect(sealed).not.toBeNull();
    expect(sealed.progression.levels).toContainEqual({ lieutenant: 'hydre', level: 1, reward_id: 'trophy:hydre:1' });
    expect(sealed.progression.xp.bonuses).toContainEqual({ reason: 'level', amount: 100, lieutenant: 'hydre', level: 1 });
    expect(sealed.progression.rewards).toContainEqual({ id: 'trophy:hydre:1', kind: 'trophy', name: "Écaille de l'Hydre en bois" });
```

    and sub-project 3's `hatched.progression.dragon` expectation reads `sealed.progression.dragon`; the dossier's `toContainText("L'Hydre est neutralisée")` stays until Task 4 (the client still reads the compat flag);
  - step 7: title `'7. boss unlocks at two wooden seals; a lost fight loses nothing; a won fight grants the gear'`, and its comment above the homophone loop: `// Écho's wooden seal (spec 2026-09-29 lieutenant levels §4: fight I asks two seals of bois).`

`web/e2e/scenes-battle-victory.spec.ts` (the refused fight, ~481): `"Éris ne se montre pas encore. Gagne d'abord d'autres sceaux sur ses lieutenants."`.

- [ ] **Step 10: Run the e2e**

Run: `STACK=prog scripts/playwright.sh world.spec.ts --repeat-each=3` ; `STACK=prog scripts/playwright.sh scenes-battle-victory.spec.ts -g "refuses"`
Then, once, the whole suite (every posted session now judges seals and the fights come from the ladder): `STACK=prog scripts/playwright.sh`
Expected: all pass. A spec that assumed neutralisation's server behaviour is updated here to the seals, with a comment citing spec 2026-09-29 lieutenant levels; list each such change in the report (client wording is Tasks 4-7's).

- [ ] **Step 11: Commit**

```bash
git add server/app/migrations/006_seals.sql server/app/world/seals.py server/app/world/progression.py server/app/world/oracle.py server/app/world/catalog.py server/app/routers/world.py server/tests/test_seals_api.py server/tests/test_db.py server/tests/test_progression.py server/tests/test_world_api.py server/tests/test_world_rules.py web/e2e/world.spec.ts web/e2e/scenes-battle-victory.spec.ts
git commit -m "Server: the lieutenants' seals replace neutralisation (migration 006: each neutralised lieutenant becomes its wooden seal and its relic its wooden trophy; a session raises a seal on the days after the last, 100 XP per seal level and its trophy), Éris's fights open from the ladder in data/regles.json (XP only after the third), the Oracle looks at the lowest seals first; compat fields keep the client working

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- server/app/migrations/006_seals.sql server/app/world/seals.py server/app/world/progression.py server/app/world/oracle.py server/app/world/catalog.py server/app/routers/world.py server/app/world/mastery.py server/tests/test_seals_api.py server/tests/test_db.py server/tests/test_progression.py server/tests/test_world_api.py server/tests/test_world_rules.py web/e2e/world.spec.ts web/e2e/scenes-battle-victory.spec.ts
```

(`git rm server/app/world/mastery.py` was run at the end of Step 7; the commit names its path. Add any spec Step 10 had to update to both lists.)

---

### Task 3: Art — the trophies in the game

**Files:**
- Move: `assets/art/export/trophies/trophy-<lt>-<L>.webp` → `web/public/art/trophies/`, `assets/art/export/trophies/large/trophy-<lt>-<L>.webp` → `web/public/art/trophies/large/` (60 files)
- Modify: `web/src/lib/world/art.ts`, `web/src/lib/world/types.ts` (`RewardKind` gains `'trophy'`), `docs/art/style-guide.md` (the trophies' web home)
- Test: `web/src/lib/world/art.test.ts`

**Interfaces:**
- Consumes: the 60 staged files; `LIEUTENANT_ORDER`, `LieutenantKey` (`lib/world/types.ts`).
- Produces: `ART.trophies = { icons: Record<LieutenantKey, string[]>, large: Record<LieutenantKey, string[]> }` (index L − 1); `trophyIcon(key: string, level: number, large?: boolean): string | null`; `rewardIcon('trophy:hydre:2')` → the icon; `rewardKindOf('trophy:…')` → `'trophy'`.

- [ ] **Step 1: Verify the art** — Run:

```bash
for lt in hydre echo chimere protee sirenes lethe; do for l in 1 2 3 4 5; do for d in assets/art/export/trophies assets/art/export/trophies/large; do test -f "$d/trophy-$lt-$l.webp" || echo "MISSING $d/trophy-$lt-$l.webp"; done; done; done; ls assets/art/export/trophies/*.webp | wc -l; ls assets/art/export/trophies/large/*.webp | wc -l
```

Expected: no « MISSING » line, `30` and `30`. **If any file is missing, stop and report** (do not generate, copy or rename other art). Open `docs/art/trophies-sheet.png` (Read tool) and confirm the five of each relic read as one object in rising richness.

- [ ] **Step 2: Write the failing tests** — `web/src/lib/world/art.test.ts` (import `LIEUTENANT_ORDER` from `./types`, `trophyIcon` from `./art`):

```ts
  it('maps the 30 trophies twice, as icons and for the close view (spec 2026-09-29 lieutenant levels §1)', () => {
    expect(Object.keys(ART.trophies.icons)).toEqual([...LIEUTENANT_ORDER]);
    for (const k of LIEUTENANT_ORDER) {
      expect(ART.trophies.icons[k]).toEqual([1, 2, 3, 4, 5].map((l) => `/art/trophies/trophy-${k}-${l}.webp`));
      expect(ART.trophies.large[k]).toEqual([1, 2, 3, 4, 5].map((l) => `/art/trophies/large/trophy-${k}-${l}.webp`));
    }
    const onDisk = (dir: string) => readdirSync(`public/art/${dir}`).filter((f) => f.endsWith('.webp')).map((f) => `/art/${dir}/${f}`).sort();
    expect(onDisk('trophies')).toEqual(flat(ART.trophies.icons).sort());
    expect(onDisk('trophies/large')).toEqual(flat(ART.trophies.large).sort());
    for (const p of flat(ART.trophies.icons)) expect(statSync('public' + p).size, p).toBeLessThanOrEqual(20 * 1024);
    expect(trophyIcon('hydre', 2)).toBe('/art/trophies/trophy-hydre-2.webp');
    expect(trophyIcon('lethe', 5, true)).toBe('/art/trophies/large/trophy-lethe-5.webp');
    expect([trophyIcon('medusa', 1), trophyIcon('hydre', 0), trophyIcon('hydre', 6)]).toEqual([null, null, null]);
    expect(rewardIcon('trophy:echo:3')).toBe('/art/trophies/trophy-echo-3.webp');
    expect(rewardIcon('trophy:echo:9')).toBeNull();
    expect(rewardKindOf('trophy:echo:3')).toBe('trophy');
  });
```

and in `'total non-scene art payload stays under 2.5 MB'`: the title becomes `'total non-scene art payload stays under 3.5 MiB (raised for the 60 trophies, art spec Phase 3)'`, the limit `3.5 * 1024 * 1024`, and above it the comment `// Measured when the trophies came in (sub-project 2 Task 3): <N> bytes. Sub-project 4 raises it again for the accessories.` with `<N>` the number Step 4 prints. In `'guesses the same kind as the server catalog for every reward'` add after the loop: `for (const k of LIEUTENANT_ORDER) for (const l of [1, 2, 3, 4, 5]) expect(rewardKindOf(`trophy:${k}:${l}`)).toBe('trophy');`.

- [ ] **Step 3: Run them to see them fail**

Run: `scripts/npm.sh run test -- src/lib/world/art.test.ts`
Expected: FAIL (`ART.trophies` undefined).

- [ ] **Step 4: Move and measure** —

```bash
mkdir -p web/public/art/trophies/large
for lt in hydre echo chimere protee sirenes lethe; do for l in 1 2 3 4 5; do
  git mv "assets/art/export/trophies/trophy-$lt-$l.webp" "web/public/art/trophies/trophy-$lt-$l.webp"
  git mv "assets/art/export/trophies/large/trophy-$lt-$l.webp" "web/public/art/trophies/large/trophy-$lt-$l.webp"
done; done
du -cb web/public/art/dragon/*.webp web/public/art/characters/*.webp web/public/art/lieutenants/*.webp web/public/art/emblems/*.webp web/public/art/props/*.webp web/public/art/battle/*.webp web/public/art/textures/*.webp web/public/art/ui/*.webp web/public/art/trophies/*.webp web/public/art/trophies/large/*.webp | tail -1
```

(if a file is untracked, `mv` it instead of `git mv`). Expected: about 3 420 000 bytes (the art after sub-projects 1 and 3, about 2.51 MB, plus 911 320). Write the printed number as `<N>` in the test comment. **If it is above 3 460 000 bytes (3.3 MiB)**, stop and report the per-folder totals (something else grew).

- [ ] **Step 5: The map** — `web/src/lib/world/types.ts`: `export type RewardKind = 'relic' | 'trophy' | 'tint' | 'gear' | 'decor';` (`relic` goes in Task 7). `web/src/lib/world/art.ts`: `import { LIEUTENANT_ORDER, type LieutenantKey, type RewardKind, type WorldCatalog } from './types';` and, before `export const ART`:

```ts
/** The lieutenants' trophies (spec 2026-09-29 lieutenant levels §1, art spec Phase 3): one per seal,
 *  the old relic as a statuette in the seal's material; the icon (256 px) and the shelf's close view
 *  (512 px), index = seal − 1. */
const trophyPath = (key: LieutenantKey, level: number, large: boolean) => `/art/trophies/${large ? 'large/' : ''}trophy-${key}-${level}.webp`;
const trophiesOf = (large: boolean) =>
  Object.fromEntries(LIEUTENANT_ORDER.map((k) => [k, [1, 2, 3, 4, 5].map((l) => trophyPath(k, l, large))])) as Record<LieutenantKey, string[]>;
export const TROPHY_ICONS = trophiesOf(false);
export const TROPHY_LARGE = trophiesOf(true);
```

in `ART`, after `lieutenants`: `trophies: { icons: TROPHY_ICONS, large: TROPHY_LARGE },`; and:

```ts
/** A lieutenant's trophy for a seal (1-5), or null for an unknown lieutenant or seal. */
export function trophyIcon(key: string, level: number, large = false): string | null {
  const list = (large ? TROPHY_LARGE : TROPHY_ICONS)[key as LieutenantKey];
  return list && Number.isInteger(level) && level >= 1 && level <= list.length ? list[level - 1] : null;
}

const TROPHY_ID = /^trophy:([a-z]+):(\d)$/;

export function rewardIcon(id: string): string | null {
  const m = TROPHY_ID.exec(id);
  return REWARD_ICONS[id] ?? (m ? trophyIcon(m[1], Number(m[2])) : null);
}
```

(replacing the old `rewardIcon`), and in `rewardKindOf` before the `tint:` guess: `if (id.startsWith('trophy:')) return 'trophy';`.

`docs/art/style-guide.md`, "Progression redesign, phase 3": the sentence « The web copies are staged under `assets/art/export/` (not `web/public/art/`); the code task that wires each asset moves it. » gains « The trophies are wired: `web/public/art/trophies/` (256 px) and `web/public/art/trophies/large/` (512 px), sub-project 2. ». If `git status --short docs/art/style-guide.md` already shows it modified (an art agent's work in progress), do not touch it: report the line as an open item.

- [ ] **Step 6: Run**

Run: `scripts/npm.sh run test -- src/lib/world src/artReferenced.test.ts` ; `scripts/npm.sh run check`
Expected: all pass, `0 errors and 0 warnings`.

- [ ] **Step 7: Commit** (the 120 paths of the move plus the edited files; the loop builds the lists):

```bash
PATHS="web/src/lib/world/art.ts web/src/lib/world/art.test.ts web/src/lib/world/types.ts docs/art/style-guide.md"
for lt in hydre echo chimere protee sirenes lethe; do for l in 1 2 3 4 5; do
  PATHS="$PATHS assets/art/export/trophies/trophy-$lt-$l.webp web/public/art/trophies/trophy-$lt-$l.webp assets/art/export/trophies/large/trophy-$lt-$l.webp web/public/art/trophies/large/trophy-$lt-$l.webp"
done; done
git add web/src/lib/world/art.ts web/src/lib/world/art.test.ts web/src/lib/world/types.ts docs/art/style-guide.md
git commit -m "Art: the 30 lieutenant trophies wired into web/public/art/trophies (256 px icons and 512 px for the shelf's close view), trophy ids in rewardIcon and rewardKindOf, the non-scene art budget raised to 3.5 MiB for them (measured total in the test)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- $PATHS
```

(drop `docs/art/style-guide.md` from both lists if Step 5 left it alone.)

---

### Task 4: The war tent reads the seals

**Files:**
- Create: `web/src/lib/world/seals.ts`, `web/src/lib/world/seals.test.ts`
- Modify: `web/src/lib/world/types.ts` (`SealWindow`, `LieutenantState`, `WorldCatalog.mastery` out), `web/src/lib/world/eris.ts` (bands, lines; `neutraliseRule`, `erisProgressLine`, `objectPronounFor` out; `isAwake`), `web/src/components/places/war/PortraitPanel.svelte`, `web/src/components/places/war/DossierPanel.svelte`, `web/src/components/places/war/CodexPanel.svelte`, `web/src/screens/WarTent.svelte`, `web/src/lib/world/scenes/war.ts`, `web/src/components/places/delphi/TabletsPanel.svelte` (the stamp), `web/src/lib/world/scenes/camp.ts` (the plaque), `web/src/components/scene/Hotspot.svelte`, `web/src/lib/scene/types.ts` (comment), `web/src/lib/battle/battle.ts` (`opponentFor`), `content/dialogue/war.json`, `server/app/routers/world.py` (compat lieutenant fields out)
- Test: `web/src/lib/world/eris.test.ts`, `web/src/lib/battle/lines.test.ts`, `web/src/lib/battle/battle.test.ts`, `web/src/lib/world/scenes/war.test.ts`, `web/src/lib/world/scenes/camp.test.ts`, every other vitest fixture of a `LieutenantState` (`grep -rln "neutralised\|window:" web/src --include=*.test.ts`), `server/tests/test_world_api.py`, `web/e2e/scenes-war.spec.ts`, `web/e2e/scenes-camp.spec.ts` (the plaque), `web/e2e/scenes-battle-play.spec.ts` (~136), `web/e2e/world.spec.ts` (step 6's dossier line)

**Interfaces:**
- Consumes: `lieutenants[].level/next` (Task 2); `trophyIcon` (Task 3); `agree`, `plural`, `rateText`, `lowerLeadingArticle`.
- Produces:
  - `lib/world/types.ts`: `interface SealNeed { days: number; chances: number; correct: number }`, `interface SealWindow { level: number; days: number; chances: number; correct: number | null; complete: boolean; need: SealNeed }`; `LieutenantState` with `level: number`, `level_reached_at: string | null`, `next: SealWindow | null` and without `neutralised`, `neutralised_at`, `window`.
  - `lib/world/seals.ts`: `MATERIALS`, `MAX_SEAL`, `sealName(level)`, `sealsName(level)`, `sealTitle(level)`, `sealTitleOf(key, level)`, `sealGauges(n)`, `sealReady(n)`, `sealFill(n)`, `sealProgressLine(key, l)`.
  - `lib/world/eris.ts`: `Band` = `'none' | 'strong' | 'contested' | 'weak' | 'bois' | 'argent' | 'orichalque'`; `bandFor(l: Pick<LieutenantState, 'level' | 'all_time'>)`; `isAwake(key, level)`.
  - `opponentFor`'s `lieutenants: Pick<LieutenantState, 'key' | 'available' | 'level'>[]`.

- [ ] **Step 1: Write the failing tests** — `web/src/lib/world/seals.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MATERIALS, sealFill, sealGauges, sealName, sealProgressLine, sealReady, sealTitle, sealTitleOf, sealsName } from './seals';
import type { SealWindow } from './types';

const next = (o: Partial<SealWindow> & { level: number }): SealWindow => ({
  days: 0, chances: 0, correct: null, complete: false,
  need: { days: 4, chances: 25, correct: 0.88 }, ...o,
});

// Spec 2026-09-29 lieutenant levels §1: on screen a level is always its material.
describe('the seals in words', () => {
  it('names each seal by its material, eliding « de » before a vowel', () => {
    expect(MATERIALS).toEqual(['bois', 'bronze', 'argent', 'or', 'orichalque']);
    expect([1, 2, 3, 4, 5].map(sealName)).toEqual(['sceau de bois', 'sceau de bronze', "sceau d'argent", "sceau d'or", "sceau d'orichalque"]);
    expect([1, 3].map(sealsName)).toEqual(['sceaux de bois', "sceaux d'argent"]);
    expect(sealTitle(2)).toBe('Sceau de bronze');
    expect([sealTitleOf('hydre', 2), sealTitleOf('echo', 3), sealTitleOf('sirenes', 1)]).toEqual(["Sceau de bronze de l'Hydre", "Sceau d'argent d'Écho", 'Sceau de bois des Sirènes']);
    for (const l of [0, 1, 2, 3, 4, 5, 6]) expect(sealTitle(l)).not.toMatch(/niveau|\d/i);
  });

  it('says what stands before the next seal (spec §5)', () => {
    const l = (level: number, n: SealWindow | null) => ({ level, next: n });
    expect(sealProgressLine('hydre', l(1, next({ level: 2, days: 2, chances: 12 })))).toBe('Encore 2 jours de garde et 13 pièges avant le sceau de bronze.');
    expect(sealProgressLine('hydre', l(1, next({ level: 2, days: 3, chances: 30 })))).toBe('Encore 1 jour de garde avant le sceau de bronze.');
    expect(sealProgressLine('protee', l(1, next({ level: 2, days: 5, chances: 24 })))).toBe('Encore 1 piège avant le sceau de bronze.');
    expect(sealProgressLine('echo', l(1, next({ level: 2, days: 4, chances: 25, correct: 0.84, complete: true })))).toBe("Il ne te reste qu'à déjouer 88\u202f% des pièges avant le sceau de bronze.");
    // Review focus 3: 22 right of 25 is exactly 88 %: the server seals it, the words agree.
    expect(sealProgressLine('echo', l(1, next({ level: 2, days: 4, chances: 25, correct: 22 / 25, complete: true })))).toBe('Tout y est\u202f: défends encore un texte, et le sceau de bronze est à toi.');
    expect(sealProgressLine('lethe', l(3, next({ level: 4, need: { days: 8, chances: 70, correct: 0.94 } })))).toBe("Encore 8 jours de garde et 70 pièges avant le sceau d'or.");
    expect(sealProgressLine('chimere', l(0, next({ level: 1, need: { days: 3, chances: 12, correct: 0.85 } })))).toBe('Pas encore croisée.');
    expect(sealProgressLine('sirenes', l(0, next({ level: 1, need: { days: 3, chances: 12, correct: 0.85 } })))).toBe('Pas encore croisées.');
    expect(sealProgressLine('protee', l(0, next({ level: 1, need: { days: 3, chances: 12, correct: 0.85 } })))).toBe('Pas encore croisé.');
    expect(sealProgressLine('hydre', l(5, null))).toBe("Sceau d'orichalque. Il ne reste rien à conquérir ici.");
  });

  it('measures the three gauges against their targets, with the target mark', () => {
    const g = sealGauges(next({ level: 2, days: 2, chances: 20, correct: 0.84 }));
    expect(g.days).toEqual({ label: 'Jours de garde\u202f: 2 sur 4', fill: 50, ok: false });
    expect(g.chances).toEqual({ label: 'Pièges croisés\u202f: 20 sur 25', fill: 80, ok: false });
    expect(g.correct).toEqual({ label: 'Pièges déjoués\u202f: 84\u202f%, il en faut 88\u202f%', fill: 84, ok: false, mark: 88 });
    const over = sealGauges(next({ level: 2, days: 9, chances: 60, correct: 22 / 25, complete: true }));
    expect([over.days.label, over.chances.label, over.correct.ok]).toEqual(['Jours de garde\u202f: 4 sur 4', 'Pièges croisés\u202f: 25 sur 25', true]);
    expect([over.days.fill, over.chances.fill]).toEqual([100, 100]);
    expect(sealGauges(next({ level: 1 })).correct.label).toBe('Pièges déjoués\u202f: —, il en faut 88\u202f%');
    expect(sealReady(next({ level: 2, days: 4, chances: 25, correct: 22 / 25, complete: true }))).toBe(true);
    expect(sealReady(next({ level: 2, days: 4, chances: 25, correct: 0.9, complete: false }))).toBe(false);
    expect(sealFill(next({ level: 2, days: 2, chances: 25, correct: 0.44 }))).toBe(67); // (50 + 100 + 50) / 3
  });
});
```

`web/src/lib/world/eris.test.ts`: `BANDS = ['none', 'strong', 'contested', 'weak', 'bois', 'argent', 'orichalque'] as const`; drop `erisProgressLine`, `neutraliseRule`, `stirringCaption` from the imports if still there and add `isAwake`; `'bands follow the thresholds'` becomes

```ts
  it('bands follow the catch rate before the first seal, then the seal group (spec 2026-09-29 lieutenant levels §5)', () => {
    const l = (traps: number, rate: number | null, level = 0) => ({ level, all_time: { traps, caught: 0, missed: 0, rate } });
    expect(bandFor(l(2, 0))).toBe('none');
    expect(bandFor(l(5, 0.3))).toBe('strong');
    expect(bandFor(l(5, 0.5))).toBe('contested');
    expect(bandFor(l(5, 0.85))).toBe('weak');
    expect([1, 2, 3, 4, 5].map((lv) => bandFor(l(5, 0.1, lv)))).toEqual(['bois', 'bois', 'argent', 'argent', 'orichalque']);
  });

  it('knows who is awake at a class', () => {
    expect([isAwake('protee', '7H'), isAwake('protee', '8H'), isAwake('hydre', '5H')]).toEqual([false, true, true]);
  });
```

delete the `erisProgressLine`/`neutraliseRule` test (its words moved to `seals.test.ts`); in the dossier-lines test add `expect(dossierLine('hydre', 'bois')).toBe('Mon Hydre porte un sceau. Ses têtes repoussent quand même, je les arrose tous les soirs.');`. `web/src/lib/battle/lines.test.ts`: `const BANDS: Band[] = ['none', 'strong', 'contested', 'weak', 'bois', 'argent', 'orichalque'];`.

`web/src/lib/battle/battle.test.ts`: `lt` builds `{ key, available: true, level: 0, ...over }` (no `neutralised`); the free-text test becomes

```ts
  it('picks a free text its lieutenant among the awake ones at the lowest seal, stable per text (R10)', () => {
    expect(opponentFor({ mode: 'dictation', encounter: null, textId: 7, lieutenants: SIX })).toBe('echo'); // 7 % 6 = 1
    const mixed = [lt('hydre', { level: 1 }), lt('echo', { available: false }), lt('chimere'), lt('lethe')];
    expect(opponentFor({ mode: 'dictation', encounter: null, textId: 3, lieutenants: mixed })).toBe('lethe'); // 3 % 2 = 1
    const high = [lt('hydre', { level: 5 }), lt('echo', { level: 3 }), lt('lethe', { level: 3 })];
    expect(opponentFor({ mode: 'dictation', encounter: null, textId: 2, lieutenants: high })).toBe('echo'); // 2 % 2 = 0
    expect(opponentFor({ mode: 'dictation', encounter: null, textId: 3, lieutenants: [] })).toBe('eris');
    expect(opponentFor({ mode: 'dictation', encounter: null, textId: 1, lieutenants: [lt('echo', { available: false })] })).toBe('eris');
    expect(opponentFor({ mode: 'dictation', encounter: 'nope', textId: 0, lieutenants: SIX })).toBe('hydre');
  });
```

`web/src/lib/world/scenes/war.test.ts`: `lt` uses `level: 0, level_reached_at: null, next: null` (no `neutralised`, `neutralised_at`, `window`) and add

```ts
  it('captions a sealed sheet with its seal (spec 2026-09-29 lieutenant levels §5)', () => {
    const state = (level: number) => WAR_HOTSPOTS.find((h) => h.id === 'hydre')!.state({ camp: campWith([lt('hydre', { level })]), catalog: null });
    expect(state(2).caption).toBe('Sceau de bronze');
    expect(state(5).caption).toBe("Sceau d'orichalque");
    expect(state(0).caption).toBeNull();
  });
```

(`campWith` is the file's existing camp fixture builder; if it is named otherwise, use it.) `web/src/lib/world/scenes/camp.test.ts`, `'carries the quest count on the Delphi plaque…'`: the lieutenants fixture uses levels `[2, 0, 1, 0, 0, 0]` and the plaque reads `seals: 3`; `camp()` with no seal reads `seals: 0`. Every other test fixture that builds a `LieutenantState` (grep above) drops `neutralised`/`neutralised_at`/`window` and gains `level: 0, level_reached_at: null, next: null`.

`server/tests/test_world_api.py` `test_camp_for_new_profile`: add `assert not {"neutralised", "neutralised_at", "window"} & set(hydre)`.

- [ ] **Step 2: Run them to see them fail**

Run: `scripts/npm.sh run test -- src/lib/world/seals.test.ts src/lib/world/eris.test.ts src/lib/battle src/lib/world/scenes` ; `scripts/pytest.sh -q tests/test_world_api.py`
Expected: FAIL (`./seals` missing; the compat fields still served).

- [ ] **Step 3: Types and words** — `web/src/lib/world/types.ts`:

```ts
/** Spec 2026-09-29 lieutenant levels §1: what the next seal asks (from data/regles.json). */
export interface SealNeed {
  days: number;
  chances: number;
  correct: number;
}

/** The window toward a lieutenant's next seal: days of guard (days with a chance) after the last
 *  seal, the chances met, the share right in the handed-in copies (null without a chance). */
export interface SealWindow {
  level: number;
  days: number;
  chances: number;
  correct: number | null;
  complete: boolean;
  need: SealNeed;
}
```

`LieutenantState`: delete `neutralised`, `neutralised_at`, `window`; add

```ts
  /** Spec 2026-09-29 lieutenant levels §1: the seal won, 0 before the first (1 bois … 5 orichalque). */
  level: number;
  level_reached_at: string | null;
  /** The window toward the next seal; null after the fifth. */
  next: SealWindow | null;
```

`WorldCatalog`: delete `mastery`. The `Window` interface goes if nothing else uses it (`grep -rn "\bWindow\b" web/src`).

`web/src/lib/world/seals.ts`:

```ts
// Lieutenant levels, shown as seals (spec 2026-09-29 lieutenant levels): five per lieutenant, each a
// material. On screen a level is always its material (« le sceau de bronze de l'Hydre »), never a
// number or the school's word. Pure: the camp's `lieutenants[].next` carries the window, the server
// decides; these words only say it.
import { plural, rateText } from '../text/french';
import { agree } from './eris';
import type { LieutenantKey, LieutenantState, SealWindow } from './types';

export const MATERIALS = ['bois', 'bronze', 'argent', 'or', 'orichalque'] as const;
export const MAX_SEAL = MATERIALS.length;

const OF: Record<LieutenantKey, string> = {
  hydre: "de l'Hydre",
  echo: "d'Écho",
  chimere: 'de la Chimère',
  protee: 'de Protée',
  sirenes: 'des Sirènes',
  lethe: 'de Léthé',
};

// A share of whole counts may land a hair under a decimal threshold (22/25 against 0.88), as on the server.
const EPSILON = 1e-9;

function ofMaterial(level: number): string {
  const m = MATERIALS[Math.min(MAX_SEAL, Math.max(1, Math.round(level))) - 1];
  return /^[aeiou]/.test(m) ? `d'${m}` : `de ${m}`;
}

/** « sceau de bois », « sceau d'argent ». */
export function sealName(level: number): string {
  return `sceau ${ofMaterial(level)}`;
}

/** « sceaux de bois ». */
export function sealsName(level: number): string {
  return `sceaux ${ofMaterial(level)}`;
}

/** « Sceau de bronze ». */
export function sealTitle(level: number): string {
  return `Sceau ${ofMaterial(level)}`;
}

/** « Sceau de bronze de l'Hydre » (the catalogue's `source` of a trophy). */
export function sealTitleOf(key: LieutenantKey, level: number): string {
  return `${sealTitle(level)} ${OF[key]}`;
}

const pct = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 100);
const shareOk = (n: SealWindow) => n.correct !== null && n.correct >= n.need.correct - EPSILON;

export interface SealGauge {
  label: string;
  /** Percent of the gauge filled. */
  fill: number;
  ok: boolean;
}

/** The portrait's three gauges toward the next seal (R12). */
export function sealGauges(n: SealWindow): { days: SealGauge; chances: SealGauge; correct: SealGauge & { mark: number } } {
  return {
    days: { label: `Jours de garde\u202f: ${Math.min(n.days, n.need.days)} sur ${n.need.days}`, fill: pct(n.days / n.need.days), ok: n.days >= n.need.days },
    chances: {
      label: `Pièges croisés\u202f: ${Math.min(n.chances, n.need.chances)} sur ${n.need.chances}`,
      fill: pct(n.chances / n.need.chances),
      ok: n.chances >= n.need.chances,
    },
    correct: {
      label: `Pièges déjoués\u202f: ${rateText(n.correct)}, il en faut ${rateText(n.need.correct)}`,
      fill: pct(n.correct ?? 0),
      ok: shareOk(n),
      mark: pct(n.need.correct),
    },
  };
}

/** The window passes: the next session that keeps it seals the lieutenant. */
export function sealReady(n: SealWindow): boolean {
  return n.complete && shareOk(n);
}

/** Éris's file keeps one gauge per sheet: the three parts together. */
export function sealFill(n: SealWindow): number {
  return Math.round((pct(n.days / n.need.days) + pct(n.chances / n.need.chances) + pct((n.correct ?? 0) / n.need.correct)) / 3);
}

/** What stands before the next seal, in words (spec §5, R12). */
export function sealProgressLine(key: LieutenantKey, l: Pick<LieutenantState, 'level' | 'next'>): string {
  const n = l.next;
  if (!n || l.level >= MAX_SEAL) return "Sceau d'orichalque. Il ne reste rien à conquérir ici.";
  if (l.level === 0 && n.days === 0) return `Pas encore ${agree('croisé', key)}.`;
  const seal = sealName(n.level);
  const days = Math.max(0, n.need.days - n.days);
  const traps = Math.max(0, n.need.chances - n.chances);
  const parts = [days > 0 ? `${plural(days, 'jour', 'jours')} de garde` : null, traps > 0 ? plural(traps, 'piège', 'pièges') : null].filter(
    (p): p is string => p !== null,
  );
  if (parts.length > 0) return `Encore ${parts.join(' et ')} avant le ${seal}.`;
  if (sealReady(n)) return `Tout y est\u202f: défends encore un texte, et le ${seal} est à toi.`;
  return `Il ne te reste qu'à déjouer ${rateText(n.need.correct)} des pièges avant le ${seal}.`;
}
```

`web/src/lib/world/eris.ts`: the header comment says "lieutenant × band (spec §2, §3.6; spec 2026-09-29 lieutenant levels §5)"; `export type Band = 'none' | 'strong' | 'contested' | 'weak' | 'bois' | 'argent' | 'orichalque';`;

```ts
/** Bands a lieutenant's dossier line (R11): before the first seal on its all-time catch rate
 *  (Decision 19 thresholds); then on its seal group: bois-bronze, argent-or, orichalque. */
export function bandFor(l: Pick<LieutenantState, 'level' | 'all_time'>): Band {
  if (l.level >= 5) return 'orichalque';
  if (l.level >= 3) return 'argent';
  if (l.level >= 1) return 'bois';
  const { traps, rate } = l.all_time;
  if (traps < 3 || rate === null) return 'none';
  return rate < 0.4 ? 'strong' : rate < 0.8 ? 'contested' : 'weak';
}
```

in `LINES`, each lieutenant's `neutralised` entry is replaced by these three (verbatim):

```ts
  hydre: {
    // …the four existing bands…
    bois: 'Mon Hydre porte un sceau. Ses têtes repoussent quand même, je les arrose tous les soirs.',
    argent: "Mon Hydre ne sort plus ses têtes qu'une à une. Et encore, on les compte.",
    orichalque: "Cinq sceaux sur mon Hydre. Elle n'a plus une tête à montrer. Je ne veux plus en parler.",
  },
  echo: {
    bois: "Écho porte un sceau. Elle répète encore, mais on l'écoute de moins en moins.",
    argent: 'Écho chuchote a ou à, et on lui répond juste. Elle boude au fond de sa grotte.',
    orichalque: 'Cinq sceaux sur Écho. Même son écho se tait. Je vais devoir trouver une autre voix.',
  },
  chimere: {
    bois: 'Un sceau sur ma Chimère. Ses trois têtes cherchent qui a laissé passer ce masculin.',
    argent: 'Ma Chimère rugit en masculin, on lui répond en féminin, et juste. C\'est agaçant.',
    orichalque: 'Cinq sceaux sur ma Chimère. Elle ne rugit plus du tout. Bellérophon serait jaloux… non, rien.',
  },
  protee: {
    bois: 'Protée porte un sceau. Il change encore de forme, mais on le reconnaît sous chacune.',
    argent: 'On tient Protée sous toutes ses formes, -é, -ée, -és. Il en invente une nouvelle chaque nuit.',
    orichalque: "Cinq sceaux sur Protée. Il garde sa vraie forme et refuse d'en changer. Quel ennui.",
  },
  sirenes: {
    bois: 'Un sceau sur mes Sirènes. Elles chantent toujours, mais le camp a trouvé la cire.',
    argent: 'Mes Sirènes éloignent le sujet, et on le ramène à son verbe. Elles chantent faux, de rage.',
    orichalque: "Cinq sceaux sur mes Sirènes. Plus personne ne se jette à l'eau pour elles. Quel gâchis.",
  },
  lethe: {
    bois: 'Léthé porte un sceau. Elle endort encore la fin des textes, mais on se réveille à temps.',
    argent: "Léthé verse son eau sur le dernier tiers, et on relit jusqu'au bout. Elle n'en revient pas.",
    orichalque: "Cinq sceaux sur Léthé. On n'oublie plus rien, pas même la dernière ligne. Moi, j'aimerais oublier ça.",
  },
```

delete `objectPronounFor`, `neutraliseRule` and `erisProgressLine` (their words are `seals.ts`' now; `grep` their names first: nothing else may use them), and add after `sleepingLine`:

```ts
/** Whether a lieutenant is awake at the hero's class (the server's `lieutenants_for_level`). */
export function isAwake(key: LieutenantKey, level: string): boolean {
  return levelIndex(level) >= levelIndex(WAKES_AT[key]);
}
```

`content/dialogue/war.json`, the tour's portraits step: `"text": "Ses lieutenants sont épinglés sur la toile. Chacun a cinq sceaux à gagner : bois, bronze, argent, or et orichalque."` (a changed line, not a new step: `scenes-tours.spec.ts` counts the steps).

- [ ] **Step 4: The war tent** — `web/src/lib/world/scenes/war.ts`: import `sealTitle` from `'../seals'` (drop `agree` if unused); in `sheetState` replace the neutralised line by `if (l.level > 0) return st({ caption: sealTitle(l.level) });`.

`web/src/screens/WarTent.svelte`: import `trophyIcon` from `'../lib/world/art'`; the sheet's markup:

```svelte
        <img class="war-portrait" src={ART.lieutenants[s.key]} alt="" draggable="false" />
        <!-- Spec 2026-09-29 lieutenant levels §5 (R13): the seal won, its trophy; a plain outline before the first. -->
        {#if l?.available && l.level > 0}
          <img class="war-seal" src={trophyIcon(s.key, l.level)} alt="" draggable="false" data-level={l.level} />
        {:else if l?.available}
          <span class="war-seal is-outline" data-level="0"></span>
        {/if}
```

and the CSS: `.war-sheet img` → `.war-sheet .war-portrait` (both rules: the cover rule and the asleep filter), and `.war-seal` becomes

```css
  /* The seal won on this lieutenant: its trophy pinned to the sheet's corner (R13). */
  .war-seal {
    position: absolute;
    top: 4%;
    right: 6%;
    width: 32%;
    aspect-ratio: 1;
    object-fit: contain;
    filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.45));
  }
  /* Before the first seal: its place, a plain outline. */
  .war-seal.is-outline {
    width: 24%;
    border-radius: 50%;
    border: 2px dashed var(--bronze-dark);
    opacity: 0.55;
    filter: none;
  }
```

`web/src/components/places/war/PortraitPanel.svelte`: the header comment's gauges sentence becomes "the seal won and the three gauges toward the next one (spec 2026-09-29 lieutenant levels §5, R12-R13)"; imports: `ART, trophyIcon` from art (no `RELIC_OF`), `sealGauges, sealProgressLine, sealTitle` from `'../../../lib/world/seals'`, no `eris` import unless still needed, no `Medallion`, no `longDate`; delete `neutralisedLine`, `relicId`, `relicName`, `days`, `traps`, `rate`; add

```ts
  const level = $derived(lieutenantState?.level ?? 0);
  const gauges = $derived(lieutenantState?.next ? sealGauges(lieutenantState.next) : null);
  const nextLine = $derived(lieutenantState && isKnownKey ? sealProgressLine(lieutenantKey as LieutenantKey, lieutenantState) : '');
```

and replace the block from `{#if lieutenantState.neutralised}` through the gauges' closing `{/if}` by

```svelte
      <div class="kit-sheet seal-plate" data-testid="lieutenant-seal" data-level={level}>
        {#if level > 0}
          <img class="seal-art" src={trophyIcon(lieutenantKey, level)} alt="" />
        {:else}
          <span class="seal-outline" aria-hidden="true"></span>
        {/if}
        <p>{level > 0 ? sealTitle(level) : 'Pas encore de sceau'}</p>
      </div>

      {#if gauges}
        <div class="gauges" data-testid="lieutenant-gauges">
          <div class="kit-gauge" data-testid="lieutenant-gauge-days" data-state={gauges.days.ok ? 'ok' : 'short'} style:--fill="{gauges.days.fill}%">
            <span class="kit-gauge-label">{gauges.days.label}</span>
            <span class="kit-gauge-track"><span class="kit-gauge-fill"></span></span>
          </div>
          <div class="kit-gauge" data-testid="lieutenant-gauge-traps" data-state={gauges.chances.ok ? 'ok' : 'short'} style:--fill="{gauges.chances.fill}%">
            <span class="kit-gauge-label">{gauges.chances.label}</span>
            <span class="kit-gauge-track"><span class="kit-gauge-fill"></span></span>
          </div>
          <div class="kit-gauge" data-testid="lieutenant-rate" data-state={gauges.correct.ok ? 'ok' : 'short'} style:--fill="{gauges.correct.fill}%">
            <span class="kit-gauge-label">{gauges.correct.label}</span>
            <span class="kit-gauge-track"
              ><span class="kit-gauge-fill"></span><span class="target-mark" style="left:{gauges.correct.mark}%" aria-hidden="true"></span></span
            >
          </div>
        </div>
      {/if}
      <p class="rule" data-testid="lieutenant-next">{nextLine}</p>
```

with the CSS `.neutralised-banner` rules replaced by

```css
  .seal-plate {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 16px;
  }
  .seal-plate p {
    margin: 0;
    font-weight: 600;
  }
  .seal-art {
    width: 72px;
    height: 72px;
    object-fit: contain;
  }
  .seal-outline {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    border: 2px dashed var(--bronze-dark);
    opacity: 0.55;
  }
```

`web/src/components/places/war/DossierPanel.svelte`: imports `bandFor, dossierLine, dossierIntro, sleepingLine, smallTricksLine` from eris and `sealFill, sealProgressLine, sealReady, sealTitle` from `'../../../lib/world/seals'`; delete `windowFill`; the header comment's gauge sentence says "one gauge per sheet (what still stands before the next seal)"; the sheet button: `aria-describedby="dossier-{key}-line dossier-{key}-progress"`; its body:

```svelte
                  <span class="paper-head">
                    <LieutenantBadge lieutenantKey={key} size={40} />
                    <span class="paper-name">{nameFor(key)}</span>
                    {#if l.level > 0}<span class="kit-stamp" data-testid="dossier-seal-{key}">{sealTitle(l.level)}</span>{/if}
                  </span>
                  <span class="kit-note" data-tone="eris" id="dossier-{key}-line" data-testid="dossier-line-{key}">{dossierLine(key, band)}</span>
                  <span class="progress" id="dossier-{key}-progress" data-testid="dossier-progress-{key}">{sealProgressLine(key, l)}</span>
                  {#if l.next}
                    <span class="kit-gauge" data-testid="dossier-window-{key}" aria-hidden="true" data-state={sealReady(l.next) ? 'ok' : 'short'} style:--fill="{sealFill(l.next)}%">
                      <span class="kit-gauge-track"><span class="kit-gauge-fill"></span></span>
                    </span>
                  {/if}
```

`web/src/components/places/war/CodexPanel.svelte` `statusStamp`: `if (l && l.level > 0) return sealTitle(l.level);` (import `sealTitle`; drop `agree` if unused).

`web/src/components/places/delphi/TabletsPanel.svelte`: `{#if l.level > 0}<span class="kit-tablet-stamp">{sealTitle(l.level)}</span>{/if}` (import `sealTitle`; the header comment's « once enough lieutenants are neutralised » becomes « once enough seals are won »).

- [ ] **Step 5: The plaque and the opponent** — `web/src/lib/world/scenes/camp.ts`, the dossier hotspot:

```ts
    // Spec 2026-09-29 lieutenant levels §5 (R14): the seals won across lieutenants, one gold seal and
    // their number on the plaque, not the gold coin that means « something waits here ».
    state: place('dossier', (camp) => ({ seals: camp.lieutenants.reduce((sum, l) => sum + l.level, 0) })),
```

`web/src/lib/scene/types.ts`, `seals`' comment: "…the war tent's seals won across lieutenants (spec 2026-09-29 lieutenant levels, R14)."

`web/src/components/scene/Hotspot.svelte`, the seals markup:

```svelte
          {#if status.seals > 0}
            <span class="hotspot-seals" data-testid="{hotspotTestId(sceneId, def.id)}-seals" data-count={status.seals}
              ><span class="hotspot-seal" aria-hidden="true"></span><span class="hotspot-seal-count" aria-hidden="true">{status.seals}</span
              ><span class="sr-only">({plural(status.seals, 'sceau', 'sceaux')})</span></span
            >
          {/if}
```

with the CSS comment « Things won here: one gold wax seal and their number after the name (R14). » and

```css
  .hotspot-seal-count {
    font-family: var(--font-body);
    font-style: normal;
    font-weight: 700;
    font-size: 14px;
    margin-left: 2px;
  }
```

`web/src/lib/battle/battle.ts`:

```ts
export interface OpponentInput {
  mode: BattleMode;
  encounter: string | null;
  textId: number | null;
  lieutenants: Pick<LieutenantState, 'key' | 'available' | 'level'>[];
}

/** R10 (spec 2026-09-29 lieutenant levels §5): a free text faces an awake lieutenant at the lowest
 *  seal, stable per text; Éris only when none is awake. */
export function opponentFor(i: OpponentInput): OpponentId {
  if (i.mode === 'boss' || i.encounter === 'eris') return 'eris';
  if (i.encounter && isOpponentId(i.encounter)) return i.encounter;
  if (i.mode === 'grimoire') return 'eris';
  const awake = i.lieutenants.filter((l) => l.available && isOpponentId(l.key));
  if (awake.length === 0) return 'eris';
  const low = Math.min(...awake.map((l) => l.level));
  const open = awake.filter((l) => l.level === low);
  return open[Math.abs(i.textId ?? 0) % open.length].key as LieutenantKey;
}
```

`server/app/routers/world.py` `lieutenant_states`: delete the three compat entries and their comment.

- [ ] **Step 6: Run the unit tests and the check**

Run: `scripts/npm.sh run test` ; `scripts/npm.sh run check` ; `scripts/pytest.sh -q tests/test_world_api.py tests/test_seals_api.py`
Expected: all pass, `0 errors and 0 warnings`. `grep -rnE "\.neutralised\b|neutralised_at|\.window\b|neutraliseRule|erisProgressLine|agree\('Neutralisé|ruses? neutralisées?" web/src web/e2e content --include=*.ts --include=*.svelte --include=*.json` prints only `progression.neutralised` (VictorySpoils, types, until Task 6), `camp.dragon.neutralised` (quests.ts, until Task 5) and e2e lines Step 7 changes.

- [ ] **Step 7: The e2e** — `web/e2e/scenes-war.spec.ts`: replace `'a foiled lieutenant: the gold seal on the sheet, the relic on the portrait, the stamp in the file and the codex'` by

```ts
// Spec 2026-09-29 lieutenant levels §5: an intercepted /camp (the seals themselves are pinned by the
// server tests): the Hydra at the bronze seal on its way to silver, Écho at the fifth.
test('a sealed lieutenant: its trophy on the sheet and the portrait, the seal in the file and the codex, the next seal in words', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.route(`**/api/profiles/${id}/camp`, async (route) => {
    const res = await route.fetch();
    const json = await res.json();
    json.lieutenants = json.lieutenants.map((l: { key: string }) =>
      l.key === 'hydre'
        ? { ...l, level: 2, level_reached_at: '2026-09-20T10:00:00+00:00', bestiary_unlocked: true,
            all_time: { traps: 12, caught: 11, missed: 1, rate: 11 / 12 },
            next: { level: 3, days: 2, chances: 20, correct: 0.9, complete: false, need: { days: 6, chances: 45, correct: 0.91 } } }
        : l.key === 'echo'
          ? { ...l, level: 5, level_reached_at: '2026-09-25T10:00:00+00:00', bestiary_unlocked: true, next: null }
          : l,
    );
    await route.fulfill({ response: res, json });
  });
  await openTent(page, id);
  await expect(page.getByTestId('war-hydre')).toContainText('Sceau de bronze');
  // UI3b playability #8: the names and captions inked on the sheets are read at arm's length.
  for (const sel of ['.hotspot-name', '.hotspot-caption']) {
    const px = await page.getByTestId('war-hydre').locator(sel).evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    expect(px, sel).toBeGreaterThanOrEqual(14);
  }
  await expect(page.getByTestId('war-sheet-hydre').locator('img.war-seal')).toHaveAttribute('src', '/art/trophies/trophy-hydre-2.webp');
  await expect(page.getByTestId('war-sheet-chimere').locator('.war-seal.is-outline')).toBeAttached();
  await tap(page.getByTestId('war-hydre'), testInfo);
  const sheet = page.getByTestId('overlay-portrait');
  await expect(sheet.getByTestId('lieutenant-seal')).toContainText('Sceau de bronze');
  await expect(sheet.getByTestId('lieutenant-seal').locator('img')).toHaveAttribute('src', '/art/trophies/trophy-hydre-2.webp');
  await expect(sheet.getByTestId('overlay-voice')).toContainText('Mon Hydre porte un sceau');
  await expect(sheet.getByTestId('lieutenant-gauge-days')).toContainText('Jours de garde\u202f: 2 sur 6');
  await expect(sheet.getByTestId('lieutenant-gauge-traps')).toContainText('Pièges croisés\u202f: 20 sur 45');
  await expect(sheet.getByTestId('lieutenant-rate')).toContainText('Pièges déjoués\u202f: 90\u202f%, il en faut 91\u202f%');
  await expect(sheet.getByTestId('lieutenant-next')).toHaveText("Encore 4 jours de garde et 25 pièges avant le sceau d'argent.");
  await closeOverlay(page);
  await tap(page.getByTestId('war-echo'), testInfo);
  await expect(sheet.getByTestId('lieutenant-next')).toHaveText("Sceau d'orichalque. Il ne reste rien à conquérir ici.");
  await expect(sheet.getByTestId('lieutenant-gauges')).toHaveCount(0);
  await expect(sheet.getByTestId('overlay-voice')).toContainText('Cinq sceaux sur Écho');
  await closeOverlay(page);
  await tap(page.getByTestId('war-dossier'), testInfo);
  await expect(page.getByTestId('dossier-seal-hydre')).toHaveText('Sceau de bronze');
  await expect(page.getByTestId('dossier-progress-hydre')).toHaveText("Encore 4 jours de garde et 25 pièges avant le sceau d'argent.");
  await expect(page.getByTestId('dossier-window-hydre')).toBeAttached();
  await expect(page.getByTestId('dossier-seal-echo')).toHaveText("Sceau d'orichalque");
  await expect(page.getByTestId('dossier-window-echo')).toHaveCount(0);
  await closeOverlay(page);
  await tap(page.getByTestId('war-bestiary'), testInfo);
  const card = page.getByTestId('overlay-codex').getByTestId('bestiary-card-hydre');
  await expect(card.locator('.kit-stamp')).toHaveText('Sceau de bronze');
  await expect(card.getByTestId('bestiary-locked')).toHaveCount(0);
  expect(await redScan(page)).toEqual([]);
});
```

In `'a sheet opens its lieutenant…'` add after the days gauge: `await expect(sheet.getByTestId('lieutenant-seal')).toContainText('Pas encore de sceau');` and `await expect(sheet.getByTestId('lieutenant-next')).toHaveText('Pas encore croisée.');`.

`web/e2e/scenes-camp.spec.ts` (`'the path to battle opens once Éris can be fought…'`): the comment « the foiled tricks are two gold seals » becomes « the two wooden seals won are one gold seal and « 2 » on the war tent's plaque (R14) »; `await expect(page.getByTestId('camp-dossier-seals').locator('.hotspot-seal-count')).toHaveText('2');` and `toHaveAccessibleName(/La tente de guerre.*2 sceaux/)`; `readyTheBattle`'s comment becomes « Two wooden seals over three days (spec 2026-09-29 lieutenant levels §1) → fight I (§4). ».

`web/e2e/scenes-battle-play.spec.ts` (~136): the forced pick keeps only `pick` awake: `l.available = l.key === pick; l.level = 0;` (no `neutralised`), comment « (a lieutenant may have woken or won a seal since) ». `web/e2e/world.spec.ts` step 6: `toContainText("L'Hydre est neutralisée")` becomes `toContainText('Mon Hydre porte un sceau')`.

- [ ] **Step 8: Run the e2e**

Run: `STACK=prog scripts/playwright.sh scenes-war.spec.ts --repeat-each=3` ; `STACK=prog scripts/playwright.sh scenes-camp.spec.ts -g "opens once" --repeat-each=3` ; `STACK=prog scripts/playwright.sh world.spec.ts scenes-battle-play.spec.ts scenes-tours.spec.ts scenes-delphi.spec.ts`
Expected: all pass on both projects.

- [ ] **Step 9: Commit**

```bash
git add web/src/lib/world/seals.ts web/src/lib/world/seals.test.ts web/src/lib/world/types.ts web/src/lib/world/eris.ts web/src/lib/world/eris.test.ts web/src/lib/battle/lines.test.ts web/src/lib/battle/battle.ts web/src/lib/battle/battle.test.ts web/src/components/places/war/PortraitPanel.svelte web/src/components/places/war/DossierPanel.svelte web/src/components/places/war/CodexPanel.svelte web/src/screens/WarTent.svelte web/src/lib/world/scenes/war.ts web/src/lib/world/scenes/war.test.ts web/src/components/places/delphi/TabletsPanel.svelte web/src/lib/world/scenes/camp.ts web/src/lib/world/scenes/camp.test.ts web/src/components/scene/Hotspot.svelte web/src/lib/scene/types.ts content/dialogue/war.json server/app/routers/world.py server/tests/test_world_api.py web/e2e/scenes-war.spec.ts web/e2e/scenes-camp.spec.ts web/e2e/scenes-battle-play.spec.ts web/e2e/world.spec.ts
git commit -m "The war tent reads the seals: each sheet and portrait shows the seal won (its trophy, an outline before the first) and the three gauges toward the next in words, Éris's dossier speaks per seal group, the codex and the tablets stamp the seal, the camp plaque counts the seals, a free text faces the lowest seal first; the compat neutralisation fields go

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/lib/world/seals.ts web/src/lib/world/seals.test.ts web/src/lib/world/types.ts web/src/lib/world/eris.ts web/src/lib/world/eris.test.ts web/src/lib/battle/lines.test.ts web/src/lib/battle/battle.ts web/src/lib/battle/battle.test.ts web/src/components/places/war/PortraitPanel.svelte web/src/components/places/war/DossierPanel.svelte web/src/components/places/war/CodexPanel.svelte web/src/screens/WarTent.svelte web/src/lib/world/scenes/war.ts web/src/lib/world/scenes/war.test.ts web/src/components/places/delphi/TabletsPanel.svelte web/src/lib/world/scenes/camp.ts web/src/lib/world/scenes/camp.test.ts web/src/components/scene/Hotspot.svelte web/src/lib/scene/types.ts content/dialogue/war.json server/app/routers/world.py server/tests/test_world_api.py web/e2e/scenes-war.spec.ts web/e2e/scenes-camp.spec.ts web/e2e/scenes-battle-play.spec.ts web/e2e/world.spec.ts
```

(add every other test file Step 1's grep updated to both lists.)

---

### Task 5: Éris's fights on the client

**Files:**
- Modify: `web/src/lib/world/types.ts` (`CampResponse.boss`, `DragonOut`), `web/src/lib/world/seals.ts` (`fightLine`), `web/src/lib/world/scenes/camp.ts` (`bossLockLine`, `bossLockCaption`), `web/src/lib/world/quests.ts` (`romanTier`, `tricksBeforeEris` out), `web/src/lib/world/rewards.ts` (`bossRewardName`), `web/src/lib/battle/lines.ts` (`CHALLENGE_LINES`, `CHALLENGE_AGAIN`, `BOSS.reward`), `web/src/screens/Boss.svelte`, `web/src/components/battle/BossMuster.svelte`, `web/src/components/places/delphi/TabletsPanel.svelte` (the boss sheet), `server/app/routers/world.py` (`dragon_out` compat out)
- Test: `web/src/lib/world/seals.test.ts`, `web/src/lib/world/scenes/camp.test.ts`, `web/src/lib/world/quests.test.ts`, `web/src/lib/world/rewards.test.ts`, `web/src/lib/battle/lines.test.ts`, every fixture of a `DragonOut` or `CampResponse.boss` (`grep -rln "neutralised\|tiers_won" web/src --include=*.test.ts`), `server/tests/test_world_api.py`, `web/e2e/scenes-camp.spec.ts`

**Interfaces:**
- Consumes: `camp.boss.fights/next` (Task 2); `sealName`, `sealsName` (Task 4).
- Produces: `CampResponse.boss: { tier_available: number | null; tiers_won: number[]; active_quest_id: number | null; fights: number; next: { tier: number; level: number; missing: number } | null }`; `DragonOut` without `neutralised`/`available`; `fightLine(next): string`; `romanTier(n)` for any 1-39; `bossRewardName` falls back to « 300 XP » for a fight without gear; `BOSS.reward(xp, name: string | null)`; `CHALLENGE_AGAIN: string[]`.

- [ ] **Step 1: Write the failing tests** — `web/src/lib/world/seals.test.ts`:

```ts
  it('says what opens the next fight, never naming a lieutenant (spec §4, R9)', () => {
    expect(fightLine({ tier: 1, level: 1, missing: 2 })).toBe("Encore deux sceaux de bois et Éris t'attend.");
    expect(fightLine({ tier: 2, level: 1, missing: 1 })).toBe("Encore un sceau de bois et Éris t'attend.");
    expect(fightLine({ tier: 5, level: 3, missing: 6 })).toBe("Encore six sceaux d'argent et Éris t'attend.");
    expect(fightLine({ tier: 9, level: 5, missing: 7 })).toBe("Encore 7 sceaux d'orichalque et Éris t'attend.");
  });
```

`web/src/lib/world/quests.test.ts`: delete the `tricksBeforeEris` test and its import; add

```ts
  it('writes every fight of the ladder in Roman numerals (R8: ten fights by default, twenty at most)', () => {
    expect([1, 2, 3, 4, 5, 6, 9, 10, 14, 19, 20].map(romanTier)).toEqual(['I', 'II', 'III', 'IV', 'V', 'VI', 'IX', 'X', 'XIV', 'XIX', 'XX']);
    expect([0, -1, 2.5, 40].map(romanTier)).toEqual(['0', '-1', '2.5', '40']);
  });
```

`web/src/lib/world/rewards.test.ts`: the `catalog` fixture gains `quest_bonus: { boss: 300 }`; the boss test becomes

```ts
  it('names the boss reward known in advance: the gear of the first three fights, then its XP (spec 2026-09-29 lieutenant levels §4)', () => {
    expect(bossRewardId(1, catalog)).toBe('sandales_hermes');
    expect(bossRewardName(1, catalog)).toBe("Sandales d'Hermès");
    expect(bossRewardName(4, catalog)).toBe('300 XP');
    expect(bossRewardName(null, catalog)).toBe('une récompense');
    expect(bossRewardName(1, null)).toBe('une récompense');
    expect(bossRewardId(null, catalog)).toBeNull();
  });
```

`web/src/lib/battle/lines.test.ts`, the boss copy test: add

```ts
    expect(L.BOSS.reward(300, "Sandales d'Hermès")).toBe("Récompense si tu gagnes\u202f: 300 XP · Sandales d'Hermès");
    expect(L.BOSS.reward(300, null)).toBe('Récompense si tu gagnes\u202f: 300 XP');
    expect(L.CHALLENGE_AGAIN).toHaveLength(3);
    for (const line of [...Object.values(L.CHALLENGE_LINES), ...L.CHALLENGE_AGAIN]) expect(line).not.toMatch(/silence|neutralis/);
```

(and add `CHALLENGE_AGAIN` to whatever list the file walks for the copy guards).

`web/src/lib/world/scenes/camp.test.ts`: the camp fixture's `boss` gains `fights: 10, next: { tier: 1, level: 1, missing: 2 }` and its dragon loses `neutralised`/`available`; the boss-lock tests become

```ts
  it('says what opens the next fight in words, on the plaque and in the dragon\'s mouth (spec §4, R9)', () => {
    const c = camp({ boss: { tier_available: null, tiers_won: [], active_quest_id: null, fights: 10, next: { tier: 1, level: 1, missing: 2 } } });
    expect(bossLockCaption(c)).toBe("Encore deux sceaux de bois et Éris t'attend.");
    expect(bossLockLine(c)).toBe("Encore deux sceaux de bois et Éris t'attend.");
    const done = camp({ boss: { tier_available: null, tiers_won: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], active_quest_id: null, fights: 10, next: null } });
    expect(bossLockCaption(done)).toBe('Éris boude, loin du camp');
    expect(bossLockLine(done)).toBe('Éris est vaincue à chaque combat. Elle boude, loin du camp.');
  });
```

(`camp(over)` is the file's existing fixture builder; merge `boss` the way it merges other keys.) `server/tests/test_world_api.py` `test_camp_for_new_profile`: `assert "neutralised" not in c["dragon"] and "available" not in c["dragon"]` (and drop `c["dragon"]["available"] == 5` from its first dragon assertion); `server/tests/test_seals_api.py` `test_the_first_fight_opens_at_two_wooden_seals`: delete the compat `dragon["neutralised"]` line.

- [ ] **Step 2: Run them to see them fail**

Run: `scripts/npm.sh run test -- src/lib/world src/lib/battle/lines.test.ts` ; `scripts/pytest.sh -q tests/test_world_api.py`
Expected: FAIL (`fightLine` undefined, `romanTier(6)` is `'6'`).

- [ ] **Step 3: The words** — `web/src/lib/world/seals.ts`:

```ts
const COUNT_WORDS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six'];

/** What opens the next fight (spec §4, R9): the seals still missing, counted across the lieutenants,
 *  never naming one. The battle path's caption and the dragon's line when the locked path is tapped. */
export function fightLine(next: { level: number; missing: number }): string {
  const n = next.missing;
  const count = n < COUNT_WORDS.length ? COUNT_WORDS[n] : String(n);
  return `Encore ${count} ${n < 2 ? sealName(next.level) : sealsName(next.level)} et Éris t'attend.`;
}
```

`web/src/lib/world/types.ts`: `CampResponse.boss`:

```ts
  /** Spec 2026-09-29 lieutenant levels §4: the ladder's length, and what opens the next fight (null
   *  once a fight is open or every fight is won). */
  boss: { tier_available: number | null; tiers_won: number[]; active_quest_id: number | null; fights: number; next: { tier: number; level: number; missing: number } | null };
```

`DragonOut`: delete `neutralised` and `available`.

`web/src/lib/world/quests.ts`: delete `tricksBeforeEris`; replace `ROMAN_TIERS`/`romanTier` by

```ts
const ROMAN: [number, string][] = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];

/** Roman numeral for a fight (1 -> 'I', 10 -> 'X'); the ladder holds 20 fights at most (R8). */
export function romanTier(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 39) return String(n);
  let out = '';
  let rest = n;
  for (const [value, digits] of ROMAN) {
    while (rest >= value) {
      out += digits;
      rest -= value;
    }
  }
  return out;
}
```

`web/src/lib/world/rewards.ts`:

```ts
/** The name of the reward a boss tier grants: the gear of the first three fights, then its XP (spec
 *  2026-09-29 lieutenant levels §4), or a generic phrase while the catalog loads. */
export function bossRewardName(tier: number | null, catalog: WorldCatalog | null): string {
  const id = bossRewardId(tier, catalog);
  const name = id ? catalog?.rewards[id]?.name : undefined;
  if (name) return name;
  if (tier !== null && catalog && !id) return `${catalog.quest_bonus.boss} XP`;
  return 'une récompense';
}
```

`web/src/lib/battle/lines.ts`:

```ts
export const CHALLENGE_LINES: Record<number, string> = {
  1: 'Deux de mes lieutenants portent un sceau\u202f? Voyons si mes pièges tiennent quand ils jouent tous ensemble.',
  2: 'Encore toi. Cette fois mes pièges sont mieux cachés, et le texte est long. Très long.',
  3: "Le Grand Désaccord. Toutes mes ruses, un seul texte, et la pomme d'or en jeu. Après ça, je ne reviendrai pas. (Si.)",
};
/** R17: the fights after the third, in turn. */
export const CHALLENGE_AGAIN = [
  'Encore des sceaux sur mes lieutenants\u202f? Je reviens, et mes pièges ont appris de nouveaux tours.',
  'Tu collectionnes les sceaux, je collectionne les revanches. Un long texte, rien que pour toi.',
  'Mes lieutenants portent du métal précieux, maintenant. Moi, je garde ma pomme. Viens la chercher.',
];
```

and in `BOSS`: `reward: (xp: number, name: string | null) => (name ? `Récompense si tu gagnes\u202f: ${xp} XP · ${name}` : `Récompense si tu gagnes\u202f: ${xp} XP`),`.

`web/src/screens/Boss.svelte`: `import { CHALLENGE_AGAIN, CHALLENGE_LINES } from '../lib/battle/lines';`, `rewardName={bossRewardId ? bossRewardName(tier, campStore.catalog) : null}` and `taunt={erisSays(CHALLENGE_LINES[tier] ?? CHALLENGE_AGAIN[(tier - 4) % CHALLENGE_AGAIN.length] ?? CHALLENGE_LINES[1])}`. `web/src/components/battle/BossMuster.svelte`: the prop `rewardName: string | null`.

`web/src/lib/world/scenes/camp.ts`: import `fightLine` from `'../seals'` (drop `tricksBeforeEris` and, if unused, `plural`):

```ts
/** What the dragon says when the locked path to battle is tapped (carry #16/M9; spec 2026-09-29
 *  lieutenant levels §4, R9): the same words as the plaque's caption. */
export function bossLockLine(camp: CampResponse): string {
  return camp.boss.next ? fightLine(camp.boss.next) : 'Éris est vaincue à chaque combat. Elle boude, loin du camp.';
}

/** The locked path's caption (final review M12, ethics: a lock says in advance how to get past it,
 *  without a tap): what opens the next fight, in words. Ruling B-d: first of the three captions. */
export function bossLockCaption(camp: CampResponse): string | null {
  return camp.boss.next ? fightLine(camp.boss.next) : 'Éris boude, loin du camp';
}
```

`web/src/components/places/delphi/TabletsPanel.svelte`, the boss sheet's two last branches:

```svelte
        {:else if camp.boss.next}
          <p>Éris se cache. {fightLine(camp.boss.next)}</p>
        {:else}
          <p>Éris est vaincue à chaque combat. Elle boude.</p>
        {/if}
```

(import `fightLine`; drop `tricksBeforeEris` and, if unused, `plural`.)

`server/app/routers/world.py` `dragon_out`: delete the compat count and `"neutralised"`, `"available"` from its return (and `available` if unused).

- [ ] **Step 4: Run the unit tests and the check**

Run: `scripts/npm.sh run test` ; `scripts/npm.sh run check` ; `scripts/pytest.sh -q tests/test_world_api.py tests/test_seals_api.py tests/test_dragon.py`
Expected: all pass, `0 errors and 0 warnings`. `grep -rnE "tricksBeforeEris|dragon\.neutralised|dragon\.available|Neutralise encore|vaincue trois fois" web/src web/e2e server/app` prints nothing (Step 5 changes the e2e hits).

- [ ] **Step 5: The e2e** — `web/e2e/scenes-camp.spec.ts`: `'the locked path to battle: the dragon says how many tricks remain'` becomes `'the locked path to battle: the dragon says what opens the first fight'` with `const line = "Encore deux sceaux de bois et Éris t'attend.";`; add

```ts
// Spec 2026-09-29 lieutenant levels §4: the caption counts seals across lieutenants, never naming one;
// after the third fight Éris pays XP only.
test('the path to battle says what opens the next fight in words; a fourth fight pays its XP', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const text = await createText(request, { title: uniqueName(`Garde ${testInfo.project.name}`), body: BODY, level: '10H' });
  for (const day of ['2026-08-03', '2026-08-04', '2026-08-05']) {
    await postSession(request, { profileId: id, textId: text.id, day, result: makeResult({ draft: 4, caught: 4, category: 'agreement:verb' }) });
  }
  await openCamp(page, id);
  const boss = page.getByTestId('camp-boss');
  await expect(boss).toContainText("Encore un sceau de bois et Éris t'attend.");
  await expect(boss).not.toContainText(/Hydre|Écho|Chimère|Protée|Sirènes|Léthé/);
  await page.route(`**/api/profiles/${id}/camp`, async (route) => {
    const res = await route.fetch();
    const json = await res.json();
    json.boss = { ...json.boss, tier_available: 4, tiers_won: [1, 2, 3], next: null };
    await route.fulfill({ response: res, json });
  });
  await page.reload();
  await expectCamp(page);
  await expect(boss).toContainText('Combat IV\u202f: 300 XP');
});
```

- [ ] **Step 6: Run the e2e**

Run: `STACK=prog scripts/playwright.sh scenes-camp.spec.ts --repeat-each=3` ; `STACK=prog scripts/playwright.sh world.spec.ts scenes-delphi.spec.ts scenes-battle-victory.spec.ts -g "lair|refuses|Éris"`
Expected: all pass on both projects.

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/world/types.ts web/src/lib/world/seals.ts web/src/lib/world/seals.test.ts web/src/lib/world/scenes/camp.ts web/src/lib/world/scenes/camp.test.ts web/src/lib/world/quests.ts web/src/lib/world/quests.test.ts web/src/lib/world/rewards.ts web/src/lib/world/rewards.test.ts web/src/lib/battle/lines.ts web/src/lib/battle/lines.test.ts web/src/screens/Boss.svelte web/src/components/battle/BossMuster.svelte web/src/components/places/delphi/TabletsPanel.svelte server/app/routers/world.py server/tests/test_world_api.py server/tests/test_seals_api.py web/e2e/scenes-camp.spec.ts
git commit -m "Éris's fights on the client: the battle path says what opens the next fight in words (« Encore deux sceaux de bois et Éris t'attend. »), never naming a lieutenant; fights past the third pay their XP on the plaque, the wall and the muster, Roman numerals to XX, new challenge lines; the dragon's compat neutralisation count goes

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/lib/world/types.ts web/src/lib/world/seals.ts web/src/lib/world/seals.test.ts web/src/lib/world/scenes/camp.ts web/src/lib/world/scenes/camp.test.ts web/src/lib/world/quests.ts web/src/lib/world/quests.test.ts web/src/lib/world/rewards.ts web/src/lib/world/rewards.test.ts web/src/lib/battle/lines.ts web/src/lib/battle/lines.test.ts web/src/screens/Boss.svelte web/src/components/battle/BossMuster.svelte web/src/components/places/delphi/TabletsPanel.svelte server/app/routers/world.py server/tests/test_world_api.py server/tests/test_seals_api.py web/e2e/scenes-camp.spec.ts
```

(add every other test file Step 1's grep updated.)

---

### Task 6: The victory reveals the seal

**Files:**
- Modify: `web/src/lib/world/types.ts` (`Progression`), `web/src/lib/world/seals.ts` (`levelUps`, `levelUpLine`, `levelChipLabel`, `sealCry`), `web/src/components/battle/VictorySpoils.svelte`, `web/src/lib/battle/lines.ts` (`VICTORY.neutralised` out), `web/src/components/battle/VictoryPhase.svelte`, `web/src/screens/Play.svelte`, `web/src/lib/playState.ts`, `web/src/lib/types.ts` (comments), `server/app/world/progression.py` (compat out)
- Test: `web/src/lib/world/seals.test.ts`, `web/src/lib/battle/lines.test.ts`, `server/tests/test_seals_api.py`, `web/e2e/scenes-battle-victory.spec.ts`, `web/e2e/playability-ui4.spec.ts` (the review walk)

**Interfaces:**
- Consumes: `progression.levels` and the `level` bonus entries (Task 2); `trophyIcon` (Task 3); `sealTitle`, `sealName` (Task 4); `lowerLeadingArticle`, `genderFor`.
- Produces: `Progression.levels?: { lieutenant: string; level: number; reward_id: string }[]`, `Progression.neutralised?: string[]` (a victory saved before the change), `Progression.xp.bonuses: { reason: string; amount: number; lieutenant?: string; level?: number }[]`; `levelUps(p): { lieutenant: LieutenantKey; level: number; reward_id: string }[]`; `levelUpLine(key, level)`; `levelChipLabel(level, name)`; `sealCry(level)` (« Sceau de bronze ! »); `progression` without `neutralised` on the server.

- [ ] **Step 1: Write the failing tests** — `web/src/lib/world/seals.test.ts`:

```ts
  it('reveals a seal on the victory: its cry, its line, its chip (spec §1, §5, R16)', () => {
    expect(sealCry(2)).toBe('Sceau de bronze\u202f!');
    expect(levelUpLine('hydre', 2)).toBe("Tu poses le sceau de bronze sur l'Hydre. Son trophée t'attend dans ta cabane.");
    expect(levelUpLine('sirenes', 3)).toBe("Tu poses le sceau d'argent sur les Sirènes. Leur trophée t'attend dans ta cabane.");
    expect(levelUpLine('echo', 1)).toBe("Tu poses le sceau de bois sur Écho. Son trophée t'attend dans ta cabane.");
    expect(levelChipLabel(2, "L'Hydre")).toBe("Sceau de bronze\u202f: l'Hydre");
    expect(levelChipLabel(5, 'Les Sirènes')).toBe("Sceau d'orichalque\u202f: les Sirènes");
  });

  // Review focus 5: a victory saved before the seals carries `neutralised`, no `levels`.
  it('reads the seals of a victory, and of one saved before the change', () => {
    const up = { lieutenant: 'hydre', level: 2, reward_id: 'trophy:hydre:2' };
    expect(levelUps({ levels: [up], neutralised: ['echo'] })).toEqual([up]);
    expect(levelUps({ neutralised: ['echo'] })).toEqual([{ lieutenant: 'echo', level: 1, reward_id: 'trophy:echo:1' }]);
    expect(levelUps({ levels: [{ lieutenant: 'medusa', level: 1, reward_id: 'x' }] })).toEqual([]);
    expect(levelUps({})).toEqual([]);
  });

  it('labels every chip of the victory, the saved ones included', () => {
    const names = { hydre: "L'Hydre" };
    expect(bonusChipLabel({ reason: 'level', amount: 200, lieutenant: 'hydre', level: 2 }, names)).toBe("Sceau de bronze\u202f: l'Hydre");
    expect(bonusChipLabel({ reason: 'level', amount: 100, lieutenant: 'echo', level: 1 }, {})).toBe('Sceau de bois\u202f: Écho');
    expect(bonusChipLabel({ reason: 'mastery', amount: 200 }, names)).toBe('Premier sceau');
    expect(bonusChipLabel({ reason: 'pace', amount: 8 }, names)).toBe('Rythme');
    expect(bonusChipLabel({ reason: 'mystery', amount: 1 }, names)).toBe('mystery');
  });
```

(import `bonusChipLabel`, `levelChipLabel`, `levelUpLine`, `levelUps`, `sealCry`). `web/src/lib/battle/lines.test.ts`: drop `L.VICTORY.neutralised` from any list. `server/tests/test_seals_api.py` `test_three_days_of_guard_win_the_hydras_wooden_seal`: `assert p["neutralised"] == ["hydre"]` becomes `assert "neutralised" not in p`.

- [ ] **Step 2: Run them to see them fail**

Run: `scripts/npm.sh run test -- src/lib/world/seals.test.ts` ; `scripts/pytest.sh -q tests/test_seals_api.py`
Expected: FAIL.

- [ ] **Step 3: The words and the type** — `web/src/lib/world/types.ts`, in `Progression`: `xp.bonuses: { reason: string; amount: number; lieutenant?: string; level?: number }[];` (comment: "a seal's bonus names its lieutenant and seal (spec 2026-09-29 lieutenant levels §1)"), and replace `neutralised: string[];` by

```ts
  /** Spec 2026-09-29 lieutenant levels §1: the seals this session won (absent from a victory saved
   *  before the change). */
  levels?: { lieutenant: string; level: number; reward_id: string }[];
  /** A victory saved before the seals: the lieutenants it neutralised, now their wooden seal. */
  neutralised?: string[];
```

`web/src/lib/world/seals.ts`: add `import { genderFor, lieutenantName } from './eris';` (next to `agree`), `import { lowerLeadingArticle } from './quests';`, `import { LIEUTENANT_ORDER } from './types';` (value import beside the types) and:

```ts
const ON: Record<LieutenantKey, string> = {
  hydre: "sur l'Hydre",
  echo: 'sur Écho',
  chimere: 'sur la Chimère',
  protee: 'sur Protée',
  sirenes: 'sur les Sirènes',
  lethe: 'sur Léthé',
};

/** The victory's cry for a seal (spec §5): « Sceau de bronze ! ». */
export function sealCry(level: number): string {
  return `${sealTitle(level)}\u202f!`;
}

/** The seal's card on the victory (R16). */
export function levelUpLine(key: LieutenantKey, level: number): string {
  const their = genderFor(key) === 'fp' ? 'Leur' : 'Son';
  return `Tu poses le ${sealName(level)} ${ON[key]}. ${their} trophée t'attend dans ta cabane.`;
}

/** The seal's XP chip: « Sceau de bronze : l'Hydre » (the victory adds « +200 »). */
export function levelChipLabel(level: number, name: string): string {
  return `${sealTitle(level)}\u202f: ${lowerLeadingArticle(name)}`;
}

const isKey = (k: string): k is LieutenantKey => (LIEUTENANT_ORDER as readonly string[]).includes(k);

/** The seals a victory reveals; a victory saved before the change reveals its neutralisations as the
 *  wooden seals they became (migration 006). */
export function levelUps(p: { levels?: { lieutenant: string; level: number; reward_id: string }[]; neutralised?: string[] }) {
  const ups = p.levels ?? (p.neutralised ?? []).map((k) => ({ lieutenant: k, level: 1, reward_id: `trophy:${k}:1` }));
  return ups.filter((u): u is { lieutenant: LieutenantKey; level: number; reward_id: string } => isKey(u.lieutenant));
}

const CHIP_LABELS: Record<string, string> = {
  // Spec 2026-09-29 §4 (sub-project 1): the session's parts, then the other bonuses.
  text: 'Texte',
  session: 'Texte',
  pace: 'Rythme',
  aids: 'Sans aides',
  prophecy: 'Prophétie',
  board: 'Quête',
  oracle: 'Oracle',
  boss: 'Éris vaincue',
  weekly: 'Objectif de la semaine',
  // A victory saved before the seals: its neutralisation's bonus was the first seal's.
  mastery: 'Premier sceau',
};

/** Every XP chip's label (the victory adds « +N »): a seal names itself and its lieutenant. */
export function bonusChipLabel(b: { reason: string; lieutenant?: string; level?: number }, names: Record<string, string>): string {
  if (b.reason === 'level' && b.lieutenant && isKey(b.lieutenant) && b.level) {
    return levelChipLabel(b.level, names[b.lieutenant] ?? lieutenantName(b.lieutenant));
  }
  return CHIP_LABELS[b.reason] ?? b.reason;
}
```

(`CHIP_LABELS` takes over sub-project 1's `BONUS_LABELS` of `VictorySpoils.svelte`: keep its exact labels; if that map holds a key this list lacks, add it here.)

`web/src/lib/battle/lines.ts`: delete `VICTORY.neutralised`.

- [ ] **Step 4: `VictorySpoils.svelte`**
  - header comment: « a lieutenant neutralised (permanent, spec ethics: nothing is ever lost) » becomes « a seal won on a lieutenant (never lost) »;
  - imports: `ART, trophyIcon` from art (no `RELIC_OF`); `bonusChipLabel, levelUpLine, levelUps, sealCry` from `'../../lib/world/seals'`; no `agree` import unless still used; `LieutenantKey` stays if used;
  - delete `BONUS_LABELS` and `relicName`; the chip's text becomes `{bonusChipLabel(b, names)} +{b.amount}`;
  - `const ups = levelUps(untrack(() => progression));` near the top (the reveal is built once on mount, as `neutralisedTriggers` was), `let levelTriggers = $state<number[]>(ups.map(() => 0));` in place of `neutralisedTriggers`, and in the sound effect `ups.forEach((_u, i) => { timers.push(setTimeout(() => { playSfx('growth'); levelTriggers[i] += 1; }, t)); t += 300; });` in place of the `progression.neutralised.forEach` loop;
  - `extraRewards`: `progression.rewards.filter((r) => r.kind !== 'trophy' && r.kind !== 'relic' && !shownRewardIds.has(r.id) && r.id !== bossReward?.id)` and its comment « the seal cards (every trophy comes from a seal this session; a relic only from a victory saved before the change) »;
  - the neutralised cards become:

```svelte
  {#each ups as u, i (u.lieutenant)}
    <Reveal delay={nextDelay()}>
      <!-- Spec 2026-09-29 lieutenant levels §5 (R16): the seal won, its trophy, like the relic's reveal before. -->
      <div class="level-up" data-testid="reveal-level-{u.lieutenant}">
        <img src={ART.lieutenants[u.lieutenant]} alt={names[u.lieutenant] ?? u.lieutenant} class="lieutenant-art" />
        <div class="kit-sheet spoil level-sheet">
          <img
            class="trophy-art"
            data-testid="reveal-level-trophy"
            src={trophyIcon(u.lieutenant, u.level) ?? ''}
            alt={campStore.catalog?.rewards[u.reward_id]?.name ?? sealCry(u.level)}
          />
          <p class="spoil-title">{sealCry(u.level)}</p>
          <p>{levelUpLine(u.lieutenant, u.level)}</p>
        </div>
        <Particles trigger={levelTriggers[i]} kind="burst" />
      </div>
    </Reveal>
  {/each}
```

  - CSS: `.neutralised` → `.level-up`, `.neutralised-sheet` → `.level-sheet`, and

```css
  .trophy-art {
    width: 88px;
    height: 88px;
    object-fit: contain;
    filter: drop-shadow(0 3px 5px rgba(0, 0, 0, 0.3));
  }
```

`web/src/components/battle/VictoryPhase.svelte`, `web/src/screens/Play.svelte`, `web/src/lib/playState.ts`, `web/src/lib/types.ts`: comments « neutralised titles » / « neutralisations » become « seal cards » / « seals » (no code change).

`server/app/world/progression.py`: delete the compat `"neutralised": …` entry and its comment.

- [ ] **Step 5: Run the unit tests and the check**

Run: `scripts/npm.sh run test` ; `scripts/npm.sh run check` ; `scripts/pytest.sh -q`
Expected: all pass, `0 errors and 0 warnings`. `grep -rnE "RELIC_OF|reveal-neutralised|neutralisedTriggers|VICTORY\.neutralised|Ruse neutralisée" web/src web/e2e` prints only `web/e2e/playability-ui4.spec.ts` (Step 6).

- [ ] **Step 6: The e2e** — `web/e2e/scenes-battle-victory.spec.ts`: import `makeResult`, `postSession`, `swissDay` from `./helpers`; `progression()`'s `neutralised: []` becomes `levels: []` and its comment « a boss won or lost, a hatch, a stage change, a seal »; add

```ts
// Spec 2026-09-29 lieutenant levels §5: the seal on the victory, its trophy, its chip.
test('a seal on the victory: « Sceau de bronze ! », its trophy, its chip', async ({ page, request }, testInfo) => {
  const sheet = await counted(
    page,
    request,
    `Vic25-${testInfo.project.name}`,
    progression({
      levels: [{ lieutenant: 'hydre', level: 2, reward_id: 'trophy:hydre:2' }],
      rewards: [{ id: 'trophy:hydre:2', kind: 'trophy', name: "Écaille de l'Hydre en bronze" }],
      xp: { session: 51, bonuses: [{ reason: 'level', amount: 200, lieutenant: 'hydre', level: 2 }], total_before: 487, total_after: 738, stage_before: 'hatchling', stage_after: 'hatchling', floor: 100, next: 1200 },
    }),
  );
  const card = sheet.getByTestId('reveal-level-hydre');
  await expect(card).toContainText('Sceau de bronze\u202f!');
  await expect(card).toContainText("Tu poses le sceau de bronze sur l'Hydre. Son trophée t'attend dans ta cabane.");
  await expect(card.getByTestId('reveal-level-trophy')).toHaveAttribute('src', '/art/trophies/trophy-hydre-2.webp');
  await expect(sheet.getByTestId('xp-chip')).toContainText(["Sceau de bronze\u202f: l'Hydre +200"]);
  await expect(sheet.getByTestId('reveal-reward-trophy:hydre:2')).toHaveCount(0);   // never twice as « Nouveau trésor »
});

// Review focus 5: a play state saved before the change.
test('a victory saved before the seals shows the first seal', async ({ page, request }, testInfo) => {
  const sheet = await counted(
    page,
    request,
    `Vic26-${testInfo.project.name}`,
    progression({ levels: undefined, neutralised: ['echo'], xp: { session: 51, bonuses: [{ reason: 'mastery', amount: 200 }], total_before: 487, total_after: 738, stage_before: 'hatchling', stage_after: 'hatchling', floor: 100, next: 1200 } }),
  );
  await expect(sheet.getByTestId('reveal-level-echo')).toContainText('Sceau de bois\u202f!');
  await expect(sheet.getByTestId('xp-chip')).toContainText(['Premier sceau +200']);
  await expect(sheet).not.toContainText(/undefined|Ruse neutralisée|neutralisée/);
});

// Spec §6: a real seal from seeded stats. Two days of guard against the Hydra before today (the API,
// with the test clock); today's victory, posted by the sheet, is the third.
test('a real seal on the victory, from seeded stats: « Sceau de bois ! » and its chip', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Sceau-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Veille'), body: REF, level: '10H' });
  for (const daysAgo of [2, 1]) {
    await postSession(request, { profileId: id, textId: text.id, day: swissDay(daysAgo), result: makeResult({ draft: 4, caught: 4, category: 'agreement:verb' }) });
  }
  await seedPlay(page, { profileId: id, textId: text.id, phase: 'results', draft: DRAFT, current: REF, opponent: 'hydre' });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'victory');
  const card = page.getByTestId('reveal-level-hydre');
  await expect(card).toContainText('Sceau de bois\u202f!', { timeout: 15_000 });
  await expect(card.getByTestId('reveal-level-trophy')).toHaveAttribute('src', '/art/trophies/trophy-hydre-1.webp');
  await expect(page.getByTestId('xp-chip').filter({ hasText: 'Sceau de bois' })).toHaveText("Sceau de bois\u202f: l'Hydre +100");
});
```

(the saved-victory test's `progression({ levels: undefined, … })` must produce a play state with no `levels` key: if `seedPlay` serialises `undefined` away, as `JSON.stringify` does, it holds; else build the object without the key.) `web/e2e/playability-ui4.spec.ts` (~243-268): the comment « so today's live session can neutralise it » becomes « so today's live session can win its wooden seal », the locator `[data-testid^="reveal-level-"]`, the note « the Hydra's wooden seal does not come with this session (the server wants more) ».

- [ ] **Step 7: Run the e2e**

Run: `STACK=prog scripts/playwright.sh scenes-battle-victory.spec.ts --repeat-each=3` ; `STACK=prog scripts/playwright.sh world.spec.ts happy-path.spec.ts`
Expected: all pass on both projects.

- [ ] **Step 8: Commit**

```bash
git add web/src/lib/world/types.ts web/src/lib/world/seals.ts web/src/lib/world/seals.test.ts web/src/components/battle/VictorySpoils.svelte web/src/lib/battle/lines.ts web/src/lib/battle/lines.test.ts web/src/components/battle/VictoryPhase.svelte web/src/screens/Play.svelte web/src/lib/playState.ts web/src/lib/types.ts server/app/world/progression.py server/tests/test_seals_api.py web/e2e/scenes-battle-victory.spec.ts web/e2e/playability-ui4.spec.ts
git commit -m "The victory reveals the seal won: the lieutenant, its trophy, « Sceau de bronze ! » and the chip « Sceau de bronze : l'Hydre +200 »; a victory saved before the change shows its neutralisation as the wooden seal; the compat progression.neutralised goes

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/lib/world/types.ts web/src/lib/world/seals.ts web/src/lib/world/seals.test.ts web/src/components/battle/VictorySpoils.svelte web/src/lib/battle/lines.ts web/src/lib/battle/lines.test.ts web/src/components/battle/VictoryPhase.svelte web/src/screens/Play.svelte web/src/lib/playState.ts web/src/lib/types.ts server/app/world/progression.py server/tests/test_seals_api.py web/e2e/scenes-battle-victory.spec.ts web/e2e/playability-ui4.spec.ts
```

---

### Task 7: The trophy shelf; the relics go

**Files:**
- Modify: `web/src/components/places/cabin/TrophiesPanel.svelte`, `web/src/screens/CabinRoom.svelte`, `web/src/lib/world/scenes/cabin.ts`, `web/src/lib/world/seals.ts` (`firstSealLine`, `highestTrophies`), `web/src/lib/rules.ts` (`levels`, `fights`), `web/src/lib/world/art.ts` (relics out), `web/src/lib/world/rewards.ts` (relic sentences out), `web/src/lib/world/types.ts` (`relic` kind and field out), `server/app/world/catalog.py` (relics out)
- Delete: `web/public/art/icons/{ecaille_hydre,voix_echo,criniere_chimere,perle_protee,plume_sirene,pavot_lethe}.webp`
- Test: `web/src/lib/world/seals.test.ts`, `web/src/lib/world/scenes/cabin.test.ts`, `web/src/lib/world/art.test.ts`, `web/src/lib/world/rewards.test.ts`, `web/src/lib/rules.test.ts`, `server/tests/test_world_api.py`, `web/e2e/scenes-cabin.spec.ts`

**Interfaces:**
- Consumes: the owned `trophy:<k>:<L>` rewards (`GET /rewards`); `trophyIcon` (Task 3); `sealTitle`, `sealTitleOf` (Task 4); `isAwake`, `sleepingLine`, `lieutenantName` (`eris.ts`); `rules.levels` (Task 1, served in `/api/world`).
- Produces: `GameRules.levels: SealNeed[]`, `GameRules.fights: { level: number; count: number | 'all' }[]` (defaults in `DEFAULT_RULES`); `highestTrophies(owned): Partial<Record<LieutenantKey, number>>`; `firstSealLine(need: SealNeed): string`; `trophiesLine(d, owned: number | null, max: number)`; no relic anywhere (`RewardKind` = `'trophy' | 'tint' | 'gear' | 'decor'`).

- [ ] **Step 1: Write the failing tests** — `web/src/lib/world/seals.test.ts`:

```ts
  it('finds the highest trophy of each lieutenant on the shelf, and says the first seal (R15)', () => {
    const owned = ['trophy:hydre:1', 'trophy:hydre:2', 'trophy:echo:1', 'tint:jade', 'trophy:medusa:3', 'trophy:lethe:9'].map((id) => ({ id }));
    expect(highestTrophies(owned)).toEqual({ hydre: 2, echo: 1 });
    expect(firstSealLine({ days: 3, chances: 12, correct: 0.85 })).toBe('Premier sceau\u202f: 3 jours de garde et 12 pièges, dont 85\u202f% déjoués.');
    expect(firstSealLine({ days: 1, chances: 1, correct: 0.5 })).toBe('Premier sceau\u202f: 1 jour de garde et 1 piège, dont 50\u202f% déjoués.');
  });
```

`web/src/lib/world/scenes/cabin.test.ts`, the shelf line:

```ts
    expect(trophiesLine(dragon, null, 30).text).toBe("Chaque sceau que tu gagnes pose un trophée sur l'étagère.");
    expect(trophiesLine(dragon, 0, 30).text).toBe("Chaque sceau que tu gagnes pose un trophée sur l'étagère. Le premier sera en bois\u202f!");
    expect(trophiesLine(dragon, 2, 30).text).toBe("Chaque sceau que tu gagnes pose un trophée sur l'étagère. Il en reste 28 à gagner\u202f!");
    expect(trophiesLine(dragon, 24, 25).text).toBe("Chaque sceau que tu gagnes pose un trophée sur l'étagère. Il en reste un à gagner\u202f!");
    expect(trophiesLine(dragon, 30, 30).text).toBe("Tous les sceaux sont gagnés\u202f: l'étagère brille d'orichalque\u202f!");
```

(in place of the four relic lines; the guard loop below them uses `trophiesLine(dragon, 4, 30)`.) `web/src/lib/rules.test.ts`: `expect(DEFAULT_RULES.levels[0]).toEqual({ days: 3, chances: 12, correct: 0.85 })` and `expect(DEFAULT_RULES.fights).toHaveLength(10)`.

`web/src/lib/world/art.test.ts`: the icons test expects `toHaveLength(31)` (sub-project 1 left 37 with Palamède's tool icon; the six relic icons go) and its title « maps the 31 painted icons… »; the catalogue test becomes

```ts
  it('has a painted icon for every gear and decor reward of the server catalog, and a trophy per lieutenant and seal', () => {
    const py = readFileSync('../server/app/world/catalog.py', 'utf-8');
    const ids = [...py.matchAll(/_r\("([^"]+)", "(gear|decor)"/g)].map((m) => m[1]);
    expect(ids).toHaveLength(8);
    expect(Object.keys(REWARD_ICONS).sort()).toEqual([...ids].sort());
    expect(py).not.toMatch(/"relic"/);
    expect(rewardIcon('decor:lanterne')).toBe('/art/icons/decor-lanterne.webp');
    expect(rewardIcon('sandales_hermes')).toBe('/art/icons/sandales_hermes.webp');
    expect(rewardIcon('tint:ecume')).toBeNull();
    expect([rewardKindOf('tint:jade'), rewardKindOf('decor:tapis'), rewardKindOf('egide'), rewardKindOf('trophy:hydre:1')]).toEqual(['tint', 'decor', 'gear', 'trophy']);
  });
```

(drop `RELIC_OF` from the imports). `web/src/lib/world/rewards.test.ts`: the relic `howToWin` lines go (`howToWin('sandales_hermes', '')` stays); the ids check stays as it is (both sides lose the relics). `server/tests/test_world_api.py` `test_world_catalog`: `w["rewards"]["ecaille_hydre"]["name"] == "Écaille de l'Hydre"` becomes `w["rewards"]["trophy:hydre:1"]["name"] == "Écaille de l'Hydre en bois"` and add `assert all(r["kind"] != "relic" for r in w["rewards"].values()) and all("relic" not in l for l in w["lieutenants"])`.

- [ ] **Step 2: Run them to see them fail**

Run: `scripts/npm.sh run test -- src/lib/world src/lib/rules.test.ts` ; `scripts/pytest.sh -q tests/test_world_api.py`
Expected: FAIL.

- [ ] **Step 3: The relics go** —
  - `server/app/world/catalog.py`: delete the six `_r(…, "relic", …)` entries and every `"relic": "…"` field of `LIEUTENANTS` (they are the trophies now: `TROPHY_OF`).
  - `git rm web/public/art/icons/ecaille_hydre.webp web/public/art/icons/voix_echo.webp web/public/art/icons/criniere_chimere.webp web/public/art/icons/perle_protee.webp web/public/art/icons/plume_sirene.webp web/public/art/icons/pavot_lethe.webp`
  - `web/src/lib/world/art.ts`: delete the six relic entries of `REWARD_ICONS`, `RELIC_OF` and its comment; `rewardKindOf`'s last line becomes `return 'gear';` and its doc « the id-prefix guess below covers the moment before the catalog has loaded ».
  - `web/src/lib/world/types.ts`: `export type RewardKind = 'trophy' | 'tint' | 'gear' | 'decor';`; delete `relic: string;` from `WorldCatalog.lieutenants`.
  - `web/src/lib/world/rewards.ts`: delete the six `Neutralise …` sentences of `HOW_TO_WIN` and fix the comment above it (« UI3b playability #13: said to the player, the pronoun agreed with the reward »).
  - `VictorySpoils.svelte`'s `extraRewards` filter: `r.kind !== 'relic'` no longer type-checks (`RewardKind` has no `relic`: svelte-check reports the comparison as having no overlap), so it becomes `String(r.kind) !== 'relic'`, with the comment « a victory saved before the change may still carry a relic: its seal card shows it as the wooden trophy ».

- [ ] **Step 4: The rules and the words** — `web/src/lib/rules.ts`: `import type { SealNeed } from './world/types';`, and in `GameRules`:

```ts
  /** Spec 2026-09-29 lieutenant levels §1: each seal's days, chances and share (seal 1 first). */
  levels: SealNeed[];
  /** §4: Éris's ladder (the server opens the fights; the client never counts them). */
  fights: { level: number; count: number | 'all' }[];
```

with `DEFAULT_RULES` gaining

```ts
  levels: [
    { days: 3, chances: 12, correct: 0.85 },
    { days: 4, chances: 25, correct: 0.88 },
    { days: 6, chances: 45, correct: 0.91 },
    { days: 8, chances: 70, correct: 0.94 },
    { days: 10, chances: 100, correct: 0.97 },
  ],
  fights: [1, 2, 3, 4, 5].flatMap((level) => [{ level, count: 2 }, { level, count: 'all' as const }]),
```

(and `dragon_stages` if sub-project 3 did not add it to the client type: check, do not duplicate). `web/src/lib/world/seals.ts`: add `SealNeed` to the type import, and

```ts
/** The highest trophy of each lieutenant among the rewards owned (R15). */
export function highestTrophies(owned: { id: string }[]): Partial<Record<LieutenantKey, number>> {
  const out: Partial<Record<LieutenantKey, number>> = {};
  for (const { id } of owned) {
    const m = /^trophy:([a-z]+):([1-5])$/.exec(id);
    if (m && isKey(m[1])) out[m[1]] = Math.max(out[m[1]] ?? 0, Number(m[2]));
  }
  return out;
}

/** An empty plinth says what the first seal asks, in words (spec §5). */
export function firstSealLine(need: SealNeed): string {
  return `Premier sceau\u202f: ${plural(need.days, 'jour', 'jours')} de garde et ${plural(need.chances, 'piège', 'pièges')}, dont ${rateText(need.correct)} déjoués.`;
}
```

`web/src/lib/world/scenes/cabin.ts`:

```ts
const COUNT_WORDS = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six'];

/** The shelf's line (spec 2026-09-29 lieutenant levels §5): the trophies still to win, five per
 *  lieutenant awake (`owned` null while the rewards load). */
export function trophiesLine(d: DragonOut, owned: number | null, max: number): DialogueLine {
  const head = "Chaque sceau que tu gagnes pose un trophée sur l'étagère.";
  if (owned === null) return dragonSays(d, head);
  if (owned >= max) return dragonSays(d, "Tous les sceaux sont gagnés\u202f: l'étagère brille d'orichalque\u202f!");
  if (owned === 0) return dragonSays(d, `${head} Le premier sera en bois\u202f!`);
  const left = max - owned;
  return dragonSays(d, `${head} Il en reste ${COUNT_WORDS[left] ?? String(left)} à gagner\u202f!`);
}
```

`web/src/screens/CabinRoom.svelte`: import `isAwake` from `'../lib/world/eris'`; replace `missingRelics` by

```ts
  // Five trophies per lieutenant awake at the class (spec 2026-09-29 lieutenant levels §5); null while /rewards loads.
  const ownedTrophies = $derived(owned === null ? null : owned.filter((r) => r.kind === 'trophy').length);
  const maxTrophies = $derived(5 * LIEUTENANT_ORDER.filter((k) => isAwake(k, profile.level)).length);
```

and `voice={dragon ? trophiesLine(dragon, ownedTrophies, maxTrophies) : null}`.

- [ ] **Step 5: The shelf** — `web/src/components/places/cabin/TrophiesPanel.svelte`:
  - header comment: « …relics and tints are keepsakes… » becomes « …trophies and tints are keepsakes with no toggle (a trophy stands on its lieutenant's plinth, spec 2026-09-29 lieutenant levels §5; a tint is applied from the dragon's care) »;
  - imports: `ART, trophyIcon` from art; `isAwake, lieutenantName, sleepingLine` from `'../../../lib/world/eris'`; `firstSealLine, highestTrophies, sealTitle, sealTitleOf` from `'../../../lib/world/seals'`; `rulesOf` from `'../../../lib/rules'`; `LIEUTENANT_ORDER, type LieutenantKey` from types;
  - `SECTIONS` loses `{ kind: 'relic', title: 'Reliques' }`; add

```ts
  const highest = $derived(highestTrophies(owned ?? []));
  const firstSeal = $derived(firstSealLine(rulesOf(campStore.catalog).levels[0]));
  // The close view: one lieutenant's trophies at a time (R15).
  let openKey = $state<LieutenantKey | null>(null);

  function trophyName(key: LieutenantKey, level: number): string {
    return campStore.catalog?.rewards[`trophy:${key}:${level}`]?.name ?? sealTitleOf(key, level);
  }
```

  - before `{#each SECTIONS …}`:

```svelte
  <section data-testid="cabin-trophy-shelf">
    <h3 class="kit-section">Trophées</h3>
    <ul class="cubbies">
      {#each LIEUTENANT_ORDER as key (key)}
        {@const top = highest[key] ?? 0}
        <li class="kit-cubby trophy plinth" class:is-empty={top === 0} data-testid="cabin-trophy-{key}" data-level={top}>
          {#if top > 0}
            <button
              type="button"
              class="plinth-open"
              aria-expanded={openKey === key}
              aria-controls="trophy-close-{key}"
              onclick={() => (openKey = openKey === key ? null : key)}
            >
              <img class="plinth-art" src={trophyIcon(key, top)} alt="" draggable="false" />
              <span class="trophy-name">{trophyName(key, top)}</span>
            </button>
            <p class="trophy-desc">{sealTitle(top)}</p>
          {:else}
            <span class="plinth-empty" aria-hidden="true"></span>
            <h4 class="trophy-name">{lieutenantName(key)}</h4>
            <p class="trophy-how">{isAwake(key, profile.level) ? firstSeal : sleepingLine(key, profile.level)}</p>
          {/if}
        </li>
      {/each}
    </ul>
    {#if openKey && (highest[openKey] ?? 0) > 0}
      {@const key = openKey}
      {@const top = highest[key] ?? 0}
      <div class="kit-sheet trophy-close" id="trophy-close-{key}" data-testid="cabin-trophy-close-{key}">
        <img class="close-art" src={trophyIcon(key, top, true)} alt={trophyName(key, top)} draggable="false" />
        <div class="close-words">
          <h4>{trophyName(key, top)}</h4>
          <p>{campStore.catalog?.rewards[`trophy:${key}:${top}`]?.desc ?? ''}</p>
          {#if top > 1}
            <p class="lower-title">Aussi sur l'étagère</p>
            <ul class="lower">
              {#each Array.from({ length: top - 1 }, (_, i) => top - 1 - i) as level (level)}
                <li><img src={trophyIcon(key, level)} alt="" draggable="false" /><span>{trophyName(key, level)}</span></li>
              {/each}
            </ul>
          {/if}
        </div>
      </div>
    {/if}
  </section>
```

  - CSS:

```css
  /* A lieutenant's plinth: its highest trophy, a button that opens the close view (R15). */
  .plinth-open {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    min-height: 48px;
    padding: 4px;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  .plinth-open:focus-visible {
    outline: 3px solid var(--gold-light);
    outline-offset: 2px;
  }
  .plinth-art {
    width: 88px;
    height: 88px;
    object-fit: contain;
    filter: drop-shadow(0 3px 5px rgba(0, 0, 0, 0.4));
  }
  .plinth-empty {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    border: 2px dashed var(--parchment-solid);
    opacity: 0.5;
  }
  .trophy-close {
    display: flex;
    gap: 18px;
    align-items: center;
    margin-top: 16px;
    color: var(--ink);
  }
  .close-art {
    width: min(40%, 256px);
    aspect-ratio: 1;
    object-fit: contain;
  }
  .close-words h4,
  .close-words p {
    margin: 0 0 6px;
  }
  .lower-title {
    font-weight: 600;
  }
  .lower {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 16px;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .lower li {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .lower img {
    width: 40px;
    height: 40px;
    object-fit: contain;
  }
```

  (`placesKit`/`app.css` guards: if they flag a raw colour or a non-kit class, use the kit tokens they name; the colours above are already tokens.)

- [ ] **Step 6: Run the unit tests and the check**

Run: `scripts/npm.sh run test` ; `scripts/npm.sh run check` ; `scripts/pytest.sh -q`
Expected: all pass, `0 errors and 0 warnings`. `grep -rnE "relic|RELIC_OF|Reliques|ecaille_hydre|voix_echo|criniere_chimere|perle_protee|plume_sirene|pavot_lethe" web/src server/app --include=*.ts --include=*.svelte --include=*.py` prints nothing but comments that describe the trophies as the old relics (list them in the report); `server/app/migrations/006_seals.sql` is the only file naming the relic ids.

- [ ] **Step 7: The e2e** — `web/e2e/scenes-cabin.spec.ts`, `'the trophy shelf shows every reward, each known in advance'`: the sections are `['Trophées', 'Armes et armures divines', 'Objets de la cabane', 'Teintes']`; the comment « the relic's dark silhouette » becomes « the gear's dark silhouette »; the dragon's line « no relic won yet: six to win » becomes « no seal won yet » with `toContainText("Chaque sceau que tu gagnes pose un trophée sur l'étagère. Le premier sera en bois\u202f!")`; add

```ts
// Spec 2026-09-29 lieutenant levels §5: real seals from posted sessions (the test clock): three days
// win the Hydra's wooden seal, four more days after it the bronze one.
test('the shelf: each lieutenant its highest trophy, the lower ones in its close view, an empty plinth says the first seal', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const text = await createText(request, { title: uniqueName(`Étagère ${testInfo.project.name}`), body: 'Les fées dansent dans la clairière.', level: '10H' });
  for (const day of ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07', '2026-08-08', '2026-08-09']) {
    await postSession(request, { profileId: id, textId: text.id, day, result: makeResult({ draft: 4, caught: 4, category: 'agreement:verb' }) });
  }
  await page.goto(`/#/p/${id}/cabane?panel=tresors`);
  const shelf = page.getByTestId('overlay-trophies');
  await expect(shelf.getByRole('heading', { name: 'Trophées', level: 3 })).toBeVisible();
  const hydre = shelf.getByTestId('cabin-trophy-hydre');
  await expect(hydre).toHaveAttribute('data-level', '2');
  await expect(hydre.locator('img')).toHaveAttribute('src', '/art/trophies/trophy-hydre-2.webp');
  await expect(hydre).toContainText('Sceau de bronze');
  const echo = shelf.getByTestId('cabin-trophy-echo');
  await expect(echo).toHaveAttribute('data-level', '0');
  await expect(echo).toContainText('Premier sceau\u202f: 3 jours de garde et 12 pièges, dont 85\u202f% déjoués.');
  const open = hydre.getByRole('button', { name: "Écaille de l'Hydre en bronze" });
  await tap(open, testInfo);
  await expect(open).toHaveAttribute('aria-expanded', 'true');
  const close = shelf.getByTestId('cabin-trophy-close-hydre');
  await expect(close.locator('img.close-art')).toHaveAttribute('src', '/art/trophies/large/trophy-hydre-2.webp');
  await expect(close).toContainText("Écaille de l'Hydre en bois");
  await expect(close.locator('img[src="/art/trophies/trophy-hydre-1.webp"]')).toBeVisible();
  await expect(shelf.getByTestId('overlay-voice')).toContainText('Il en reste 28 à gagner');
  await tap(open, testInfo);
  await expect(close).toHaveCount(0);
  expect(await redScan(page)).toEqual([]);
});
```

(import `makeResult`, `postSession`, `createText`, `uniqueName`, `tap` from `./helpers` if the file lacks them.)

- [ ] **Step 8: Run the e2e**

Run: `STACK=prog scripts/playwright.sh scenes-cabin.spec.ts --repeat-each=3` ; `STACK=prog scripts/playwright.sh world.spec.ts scenes-battle-victory.spec.ts`
Expected: all pass on both projects; `overlay-trophies: an in-world table…` (48 px targets) passes with the plinth buttons.

- [ ] **Step 9: Commit**

```bash
git add web/src/components/places/cabin/TrophiesPanel.svelte web/src/screens/CabinRoom.svelte web/src/lib/world/scenes/cabin.ts web/src/lib/world/scenes/cabin.test.ts web/src/lib/world/seals.ts web/src/lib/world/seals.test.ts web/src/lib/rules.ts web/src/lib/rules.test.ts web/src/lib/world/art.ts web/src/lib/world/art.test.ts web/src/lib/world/rewards.ts web/src/lib/world/rewards.test.ts web/src/lib/world/types.ts web/src/components/battle/VictorySpoils.svelte server/app/world/catalog.py server/tests/test_world_api.py web/e2e/scenes-cabin.spec.ts
git commit -m "The trophy shelf: each lieutenant's highest trophy on its plinth, the lower ones in its close view, an empty plinth says the first seal in words, the dragon counts the trophies still to win; the relics leave the catalogue, the art map and the icons folder (they are the wooden trophies now)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/components/places/cabin/TrophiesPanel.svelte web/src/screens/CabinRoom.svelte web/src/lib/world/scenes/cabin.ts web/src/lib/world/scenes/cabin.test.ts web/src/lib/world/seals.ts web/src/lib/world/seals.test.ts web/src/lib/rules.ts web/src/lib/rules.test.ts web/src/lib/world/art.ts web/src/lib/world/art.test.ts web/src/lib/world/rewards.ts web/src/lib/world/rewards.test.ts web/src/lib/world/types.ts web/src/components/battle/VictorySpoils.svelte server/app/world/catalog.py server/tests/test_world_api.py web/e2e/scenes-cabin.spec.ts web/public/art/icons/ecaille_hydre.webp web/public/art/icons/voix_echo.webp web/public/art/icons/criniere_chimere.webp web/public/art/icons/perle_protee.webp web/public/art/icons/plume_sirene.webp web/public/art/icons/pavot_lethe.webp
```

---

### Task 8: README and the full gate

**Files:**
- Modify: `README.md` (§1 feature list, the « Mastery rule » and rewards bullets, the test-hooks bullet, the rules file section)

**Interfaces:**
- Consumes: everything above.
- Produces: documented seals and fights, `levels`/`fights` in the rules file; a clean gate.

- [ ] **Step 1: The README**

§1, « Camp and progression »: « XP, Éris's lieutenants (one per error family) to neutralise, » becomes « XP, Éris's lieutenants (one per error family), each with five seals to win (bois, bronze, argent, or, orichalque) and a painted trophy for each, Éris's recurring fights, ».

Replace the « Mastery rule » bullet by:

```markdown
- **Seals (lieutenant levels)** — each error family ("lieutenant") has five seals, each a material:
  bois, bronze, argent, or, orichalque. Seal L+1 is judged on the days after seal L was won (Swiss
  days with at least one chance for that lieutenant, newest first) until the window holds enough
  days and chances; it is won when the share right in the handed-in copies reaches the target:
  3 days / 12 chances / 85 %, 4 / 25 / 88 %, 6 / 45 / 91 %, 8 / 70 / 94 %, 10 / 100 / 97 %
  (`levels` in `data/regles.json`). One seal per lieutenant per session; a seal is never lost.
  Seal L pays 100 × L XP and the lieutenant's trophy in that material (the cabin's shelf). A
  lieutenant neutralised before this rule became its wooden seal, and its relic its wooden trophy
  (migration 006; the old `mastery` table is kept but no longer written).
- **Éris's fights** — a ladder of ten by default (`fights` in `data/regles.json`): for each seal,
  « at least 2 lieutenants at this seal », then « all of them », counted over the lieutenants awake
  at the hero's class (Protée from 8H). A fight opens when its condition holds and every earlier one
  is won; won fights stay won. Each pays 300 XP; the first three also give the Sandales d'Hermès,
  the Égide and the Foudre de Zeus.
```

The rewards bullet: « every relic, dragon tint, divine gear and cabin decor piece » becomes « every trophy, dragon tint, divine gear and cabin decor piece ». The `DISCORDE_TEST_HOOKS` bullet: « the multi-day mastery and weekly-goal logic » becomes « the multi-day seals and weekly-goal logic ».

In « The rules file (`data/regles.json`) »: the JSON block gains, after `dragon_stages` (a comma after it):

```json
  "levels": {"1": {"days": 3, "chances": 12, "correct": 0.85}, "2": {"days": 4, "chances": 25, "correct": 0.88},
             "3": {"days": 6, "chances": 45, "correct": 0.91}, "4": {"days": 8, "chances": 70, "correct": 0.94},
             "5": {"days": 10, "chances": 100, "correct": 0.97}},
  "fights": [{"level": 1, "count": 2}, {"level": 1, "count": "all"}, {"level": 2, "count": 2}, {"level": 2, "count": "all"},
             {"level": 3, "count": 2}, {"level": 3, "count": "all"}, {"level": 4, "count": 2}, {"level": 4, "count": "all"},
             {"level": 5, "count": 2}, {"level": 5, "count": "all"}]
```

and the table gains:

```markdown
| `levels` | Each seal's window (`"1"` bois to `"5"` orichalque): `days` (days with a chance) and `chances` (whole numbers from 1), `correct` (the share right in the handed-in copies, above 0 and at most 1). A partial object keeps the other values; a wrong value is ignored with a warning. The defaults rise; a lowered value takes effect at the next session |
| `fights` | Éris's ladder, in order: each fight asks `count` lieutenants (1 to 6, or `"all"`: every one awake at the class; a count above that asks them all) at seal `level` (1 to 5) or higher. 1 to 20 fights; one wrong entry and the whole ladder is ignored with a warning (a won fight is kept by its number). The first three fights give the divine gear |
```

- [ ] **Step 2: The full gate**

Run: `STACK=prog PW_WORKERS=4 scripts/check.sh`
Expected: `== ALL GREEN`; pytest, vitest and Playwright with no failure, `svelte-check` `0 errors and 0 warnings`, tsc silent, no warning in the vitest/pytest output. Paste the counts. Any failure, flake or warning is fixed here (root cause, in the owning file) or reported as an open item; never retried away.

- [ ] **Step 3: Final sweeps** (each must print nothing)

```bash
grep -rnE "neutralis|Neutralis|mastery|MASTERY|RELIC_OF|stirring|tricksBeforeEris|mastery_window|is_neutralised|neutralised_set|lieutenant_day_rows|tier_available\(|boss_tiers\(" web/src web/e2e server/app server/tests content README.md \
  | grep -v "^server/app/migrations/00[46]_" | grep -v "^server/tests/test_db.py" \
  | grep -v "web/src/lib/world/types.ts:.*neutralised?: string\[\]" | grep -v "web/src/lib/world/seals.ts:.*neutralised" \
  | grep -v "web/src/lib/world/seals.test.ts:.*neutralised\|web/src/lib/world/seals.test.ts:.*mastery" \
  | grep -v "web/src/lib/world/seals.ts:.*mastery: 'Premier sceau'" | grep -v "scenes-battle-victory.spec.ts:.*\(neutralised: \['echo'\]\|reason: 'mastery'\|Ruse neutralisée\)" \
  | grep -v "README.md:.*\(neutralised before this rule\|mastery. table\)"
grep -rn -i "niveau" web/src/lib/world/seals.ts web/src/lib/world/eris.ts web/src/lib/world/scenes/cabin.ts web/src/components/places content/dialogue/war.json
ls assets/art/export/trophies/*.webp assets/art/export/trophies/large/*.webp 2>/dev/null
```

(the excluded lines are the migrations, the migration test, and the saved-victory fallbacks, on purpose; any other hit is fixed or reported.)

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "README: the lieutenants' five seals (window, thresholds, trophies, never lost; the migration from neutralisation), Éris's recurring fights, and levels/fights in data/regles.json

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- README.md
```

---

## Spec coverage (self-review)

| Spec | Task |
|---|---|
| §1 five levels, each a material; on screen always the material | 1 (`MATERIALS`, `SEAL_TITLES`), 4 (`sealName`, `sealTitle`, guards) |
| §1 the window: days strictly after the previous level, newest days with a chance until `days` and `chances`, the correct share (missed + introduced), one at a time, one per session | 1 (`level_window`, `reaches`, `seal_day_rows`), 2 (`raise_levels`, R5) |
| §1 thresholds in `data/regles.json` `levels`, same fallback; never lost | 1 (`_levels`), 2 (`test_the_seals_thresholds_come_from_the_rules_file`, `test_a_seal_is_never_lost`), 8 (README) |
| §1 rewards: `trophy:<k>:<L>` (painted), `100 × L` XP reason `level`, chip « Sceau de bronze : l'Hydre +200 »; levels 2-5 read by sub-project 4 | 1 (catalogue), 2 (progression, `levels_of`), 3 (art), 6 (chip) |
| §2 what goes: `mastery` use, `is_neutralised`, `neutralised_set`, +200 mastery XP, relic grant, `MASTERY`, `neutraliseRule`, captions and stamps, the dossier's band, the plaque's neutralised seals; the `mastery` table stays | 2 (server), 4 (client), 7 (relics), 8 (sweep) |
| §3 migration 006: `lieutenant_level`, mastery → level 1 at `neutralised_at`, relic → `trophy:<k>:1` with `granted_at`/`equipped`, XP kept | 2 |
| §4 the ladder over the lieutenants awake (Protée from 8H), in `fights`, 10 defaults; opens when held and earlier won; won stay won; whole-text win; 300 XP, gear for I-III, XP after | 1 (`fights.py`, `_fights`), 2 (API), 5 (client) |
| §4 the battle caption in words, never naming a lieutenant | 5 (`fightLine`, e2e) |
| §5 war tent sheets and portrait: the seal emblem (trophy icon, outline before 1), three gauges, the words, the orichalque line | 4 |
| §5 Éris's dossier bands per level group, in her voice | 4 (18 lines) |
| §5 camp plaque: seals across lieutenants | 4 (R14) |
| §5 trophy shelf: highest on display, lower in the close view, empty plinth « Premier sceau : … » | 7 |
| §5 Oracle scrolls and battle opponent: lowest level first | 2 (Oracle), 4 (opponent) |
| §5 bestiary: unlocks at level 1 or a finished quest | 2 (server), 4 (codex stamp) |
| §5 victory: the level-up reveal (trophy icon, « Sceau de bronze ! ») | 6 |
| §6 server tests: window rule, rewards, migration 006 on a pre-006 copy, the ladder (counts, Protée at 8H, won kept) | 1, 2 |
| §6 client tests: gauges and lines, dossier bands, shelf, victory reveal, art test with the trophies and the raised budget as a number | 3, 4, 6, 7 |
| §6 e2e: a level-up through seeded stats, the shelf, the battle caption; full gate clean | 6, 7, 5, 8 |
