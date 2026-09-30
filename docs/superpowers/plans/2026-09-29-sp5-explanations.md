# La Discorde — Sub-project 5 "Explanations and what next" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The child always knows what XP, seals, drachmes and aids are for, what to do next, and how to earn anything not yet owned, in the camp's voice. At the camp the dragon ends its greeting with the most useful next goal (a name, the prophecy, Éris, the first text, a seal within reach, the next stage, something affordable at Hermès's stall, the week's scrolls, the weekly goal, or a warm word). The guided tours gain steps for what the progression redesign added (the stall, the seals and their gauges, the parure, the trophies, the house, the guide), a hero who already saw a tour sees its new steps only, once, and the battle's muster gets its own tour. The lyre opens « Le guide du camp », five short sections in the dragon's voice whose every number comes from what the server serves. Every item not owned says in words how to earn it.

**Architecture:** One small server change (the camp counts what the purse can buy; `/api/world` serves a seal's XP), then five client surfaces: the what-next line (a pure function of the camp beside the hub's glow), versioned tours (a `since` on each new step, a version in `settings.tours`), the muster's inline tour, the guide (a pure builder from the catalogue and a cabin panel), and the how-to-earn lines on the shelf. README and the full gate last.
- Server (`server/app`): `world/shop.py` `affordable()`, `routers/world.py` (`camp.affordable`, `/api/world` `level_xp`).
- Client (`web/src`): `lib/world/nextStep.ts` (`whatNext`, `sealWithinReach`), `lib/world/dragon.ts` (`nearNextStage`), `lib/world/scenes/camp.ts` (`campGreeting`), `lib/tours/tours.ts` + `seen.svelte.ts` (versions), `components/scene/PlaceScene.svelte` (new steps only), `components/battle/MusterTour.svelte` (new) in `MusterPhase.svelte` / `Play.svelte`, `lib/world/guide.ts` (new) + `components/places/cabin/GuidePanel.svelte` (new) opened from `LyrePanel.svelte`, `lib/world/seals.ts` (`sealHowLine`, `sealNeedLine`), `lib/world/rewards.ts` (`howToEarn`, `nextFightTier`), `components/places/cabin/TrophiesPanel.svelte`; content in `content/dialogue/{camp,war,nest,cabin,battle}.json`.

**Tech Stack:** Svelte 5 (runes) + TypeScript + Vite 7, vitest 5 (node env, no component rendering: logic that needs a unit test lives in a pure `.ts` module), Playwright 1.63 (WebKit `desktop` 1280×720 and `ipad` 1180×820 touch, which runs `scenes-*.spec.ts`), FastAPI + pydantic 2 + SQLite, pytest. No new dependency, no migration, no art.

**Spec:** `docs/superpowers/specs/2026-09-29-explanations-design.md` is binding (§1 the dragon's "what next" line, §2 first visits, §3 le guide du camp, §4 how to earn it, §5 testing). Context: `docs/superpowers/specs/2026-09-29-progression-roadmap.md` and the four other specs of 2026-09-29 (`scoring-xp`, `dragon-growth`, `lieutenant-levels`, `drachmes-shop`). House style and starting state: `docs/superpowers/plans/2026-09-29-sp1-scoring-xp.md`, `2026-09-29-sp3-dragon-growth.md`, `2026-09-29-sp2-lieutenant-levels.md`, `2026-09-29-sp4-drachmes-shop.md`. Repo-root `CLAUDE.md` is binding for every agent: no "pre-existing" problems, tests and `svelte-check` clean with zero errors and zero warnings, no emoji anywhere player-visible.

## Dependencies and batching

Execution is subagent-driven and **sequential**, in the worktree `C:\Users\nicol\IdeaProjects\school-playground\.claude\worktrees\art-skills` (branch `worktree-art-skills`, `STACK=prog`). Each task starts from the previous task's commit; a reviewer gates each task before the next one starts.

**Precondition: sub-projects 1, 3, 2 and 4 are complete on this branch (in that order).** Before Task 1 the controller runs, from the worktree root in Git Bash:

```bash
git log --oneline -500 | grep -cE "README: the five review aids|README: the dragon grows from XP|README: the lieutenants' five seals|README: drachmes"
ls server/app/world/shop.py server/app/world/drachmes.py server/app/world/seals.py server/app/world/fights.py server/app/world/dragon.py server/app/migrations/007_drachmes.sql web/src/lib/world/shop.ts web/src/lib/world/seals.ts web/src/lib/world/accessories.ts web/src/components/places/camp/StallPanel.svelte content/dialogue/stall.json server/tests/test_drachmes_api.py
ls server/app/migrations | tail -1
grep -nE "def (on_sale|price_of|is_item|house_of)\b" server/app/world/shop.py
grep -nE "^LEVEL_XP|def (levels_of|lieutenants_for_level)\b" server/app/world/seals.py
grep -nE "export function (stageLine|stageXp|stageLabel|gaugeOf)\b" web/src/lib/world/dragon.ts
grep -nE "export function (sealName|sealTitle|sealTitleOf|firstSealLine|highestTrophies|fightLine)\b" web/src/lib/world/seals.ts
grep -nE "export function (drachmesText|lockedAccessoryLine|houseLockedLine|stallShelves)\b" web/src/lib/world/shop.ts
grep -n "hermes" web/src/lib/dialogue/content.ts
grep -n "stall" web/src/lib/world/scenes/camp.shapes.ts
grep -rnE "RELIC_OF|rank_for|\bRANKS\b|neutralised_set|stirring|next_stage_at|MAX_DISPLAYED_DECOR = DECOR_SLOTS" web/src server/app
```

Expected: `4`; every file listed; the migrations end at `007_drachmes.sql`; every `grep -n` finds its symbols (`hermes` among the speakers, `stall` among the camp shapes); the last grep prints nothing. **If any check fails, stop and report.** This plan is written against the code those sub-projects leave (quoted from their plans): `app.world.shop` with `is_item`, `on_sale(rid, *, owned, levels, awake, stage)`, `price_of(rid, rules)`; `app.world.drachmes.balance(conn, pid)`; `app.world.seals` with `LEVEL_XP`, `levels_of`, `lieutenants_for_level`; `owned_ids(db, pid)` and `dragon_out(conn, profile, now, rules)` in `routers/world.py`; `get_camp` serving `drachmes`, `house`, `dragon.worn`; `/api/world` serving `rules` (`Rules.as_dict()`, with `levels`, `fights`, `dragon_stages`, `drachmes`, `prices`), `stages`, `shop`, `quest_bonus` (no `mastery`); client `CampResponse.xp = {total, floor, next}`, `CampResponse.boss = {tier_available, tiers_won, active_quest_id, fights, next}`, `CampResponse.drachmes`, `CampResponse.house`, `LieutenantState.level/next` (`SealWindow`), `WorldCatalog.stages/shop`, `GameRules.levels/fights`; `DRAGON_STAGES` (`lib/world/types.ts`); `stageLine(stage, name, xp)`, `Scale`, `stageXp(catalog)`, `stageLabel` (`lib/world/dragon.ts`); `sealName`, `sealTitle`, `sealTitleOf`, `firstSealLine`, `highestTrophies`, `MAX_SEAL` (`lib/world/seals.ts`); `isAwake`, `lieutenantName`, `sleepingLine` (`lib/world/eris.ts`); `romanTier` (`lib/world/quests.ts`, Roman numerals to X); `drachmesText`, `lockedAccessoryLine`, `houseLockedLine` (`lib/world/shop.ts`); `thousands` (`lib/text/french.ts`); `trophyIcon` (`lib/world/art.ts`); the speaker `hermes`; the camp hotspot `stall`; the house scenes (`houseScene`, `HOUSE_SCENES`) built with the cabin's hotspot ids; SP2's trophy shelf in `TrophiesPanel.svelte` (plinths, close view, `openKey`, `trophyName`). Where this plan quotes code those sub-projects wrote, it names the block by its role; match it by meaning, not by line number. Test helpers reused from them: `purse`, `own`, `camp` (`server/tests/test_drachmes_api.py`), `seal` (`server/tests/test_seals_api.py`), `set_stage` (`server/tests/test_dragon.py`), `make_profile` (`server/tests/test_sessions.py`), `lv`, `SIX`, `FIVE` (`server/tests/test_shop.py`).

| # | Task | Recommended model | Why |
|---|---|---|---|
| 1 | The dragon's what-next line: the server's `camp.affordable` and `/api/world` `level_xp`; `whatNext` (ten cases, first match wins), `sealWithinReach`, `nearNextStage`; the new `camp.next.*` lines; the greeting that never repeats itself; e2e of every case from a seeded camp | opus | A priority function with ties and edge thresholds, copy with agreement, a server/client contract, and a ten-case e2e. |
| 2 | Tours with versions: `since` on new steps, the version in `settings.tours`, a seen tour re-shown for its new steps only; the new steps of the camp (Hermès at the stall), the war tent, the nest and the cabin; e2e | opus | Seen flags that existing heroes carry, a re-show that must never flash an empty tour, and every tours-on spec to re-check. |
| 3 | The muster's tour: tour `muster` in `battle.json`, `MusterTour.svelte` on the plate where Éris's taunt stands, the lit part of the parchment, shown on the first dictation muster only; e2e | opus | Layout inside the no-scroll muster, a non-modal tour that must never block the start. |
| 4 | Le guide du camp: `lib/world/guide.ts` (five sections from the served catalogue), `GuidePanel.svelte`, `?panel=guide` in the cabin, the lyre's entry; e2e from the lyre and with served rules changed | sonnet | Fully specified here, copy included. |
| 5 | How to earn it: `sealHowLine`/`sealNeedLine`, every plinth a button, « Encore à gagner » in the close view, the next fight's gear, `howToEarn` over every locked kind, the FOMO rule; e2e on the shelf | sonnet | Fully specified here. |
| 6 | README (the what-next line, the tours' new steps, the guide, how to earn) and the full gate | opus | The gate may surface cross-task fixes that need judgment. |

Playwright runs are serialised machine-wide by the lock in `scripts/playwright.sh` (`with_playwright_lock`, `scripts/lib.sh`); the art agents' Forge and segmentation batches take the same lock (`tools/art/with_lock.sh`), so a queued e2e run is waiting for them, not hanging. Never read Forge's files.

## Global Constraints

- **The what-next line (spec §1), verbatim:** "At the camp, after its greeting, the dragon says one line about the most useful next goal. Priority, first match wins: 1. it has hatched and has no name → the existing naming line; 2. an Éris fight is open → « Éris t'attend sur le sentier de la bataille. »; 3. a lieutenant's next seal is within reach (its window at least 70 % complete and its share at target) → « Encore un peu et {lieutenant} aura son sceau de {matière}. »; 4. the next dragon stage is under 20 % away → « Encore un peu de gloire et je grandis. »; 5. something on sale is affordable → « Hermès a quelque chose pour toi, et tu as de quoi payer. »; 6. the weekly goal is not reached → « Encore {n} textes cette semaine pour l'objectif. »; 7. otherwise a generic encouragement. Every line has ≥ 3 variants in `content/dialogue/camp.json` under `camp.next.<case>`; the choice is a pure function of the camp state (unit-tested); the line never repeats the greeting's content."
- **First visits (spec §2), verbatim:** "The UI5 guided tours gain steps for what changed: the muster (the pace, the five aids, leaving them at the camp for glory, the total), the war tent (seals and their materials, the gauges), the stall (drachmes, what is on sale and why), the nest's parure, the cabin (the house and its upgrades, the trophy shelf). A tour already seen by a hero is re-shown once for its new steps only (a per-tour content version in `settings.tours`). Every tour stays replayable from the lyre."
- **The guide (spec §3), verbatim:** "A rereadable guide in the cabin (a new entry on the lyre's panel, « Le guide du camp »), five short sections in the dragon's voice: « La gloire et ton dragon » (XP and stages), « Les sceaux » (levels, materials, trophies), « Les drachmes » (earning, the stall, the house), « Les aides » (the five aids and their bonus), « Les combats contre Éris » (when they open, how to win). Numbers come from the rules the server serves, so the guide never drifts from the rules file."
- **How to earn it (spec §4), verbatim:** "Everything not yet owned says how to get it, in words: empty trophy plinths (« Premier sceau : défends des textes où l'Hydre se cache »), locked tints (« Une quête de l'Oracle »), stall items (their seal), house upgrades (the dragon stage), gear (« Le prochain combat contre Éris »), decor. No item is hidden; nothing uses a countdown or guilt wording."
- **Testing (spec §5):** "The priority function (every case, ties), content tests (variants, register, no guilt, no emoji, typography), the tours' new steps and the "new steps only" re-show, the guide's numbers from the served rules, the "how to earn" line of every locked item kind; e2e: a camp showing each "what next" case from seeded state, a tour re-shown for new steps, the guide opened from the lyre. Full gate clean."
- **Toolchain (verified against `scripts/` on 2026-09-30):** no host Node and no host Python for the project. From the worktree root, in Git Bash:
  - `scripts/pytest.sh -q <paths relative to server/>` (e.g. `scripts/pytest.sh -q tests/test_explanations_api.py`; it runs in `server/`);
  - `scripts/npm.sh run test -- <paths relative to web/>` (vitest, focused, e.g. `src/lib/world/nextStep.test.ts`);
  - `scripts/npm.sh run check` (svelte-check over `src`, then `tsc -p tsconfig.e2e.json` over `e2e/`: must print `0 errors and 0 warnings` and tsc must print nothing);
  - `STACK=prog scripts/playwright.sh <spec-file-or-filter> [--project=desktop|ipad] [--repeat-each=3] [-g "<title>"]`;
  - `STACK=prog PW_WORKERS=4 scripts/check.sh` (the full gate: pytest, tts pytest, svelte-check + e2e tsc, vitest, both docker builds, all e2e, the real-voice spec).
  **This is a worktree: always set `STACK=prog`** for `playwright.sh` and `check.sh`. Do not run Docker or Playwright outside these wrappers.
- **Testing rules:** per task, run the focused vitest files, `scripts/npm.sh run check`, and the focused pytest files; run every **new or changed** e2e spec (or test, with `-g`) with `--repeat-each=3`; run every **touched but unchanged-in-intent** spec once. Task 2 and Task 3 also run every spec that turns the tours on (`grep -ln "tours: true" web/e2e`) once. The full gate runs in Task 6. The crash-only retry (`scripts/playwright-crash-retry.mjs`) retries a named "browser crashed" failure once; any other failure is a real failure. A flake is a defect: root-cause it, never retry it away.
- **e2e robustness (8 workers by default, 4 in the gate):** import `test`/`expect` from `./crashGuard` (audio stub; tours off unless `test.use({ tours: true })`); each test creates its own hero (`createProfileApi`, or `createFreshHeroApi` for a hero who never saw the camp tour) and its own text (`createText` with `uniqueName`); a finger on `ipad`, a mouse on `desktop` (`tap(locator, testInfo)`); no `waitForTimeout`; web-first assertions and `expect.poll`. A camp state a test needs (a seal within reach, a stage close, an affordable piece) is set by intercepting **this hero's** `/api/profiles/{id}/camp` (or `/rewards`, `/api/world`) with `page.route` and editing the real answer; the rules themselves are pinned by vitest and pytest.
- **French copy:** every French string of this plan is used verbatim. In-world, warm, gender-neutral towards the player (no adjective or participle agreeing with her), no school register (`BANNED` in `web/src/testing/copyRules.ts`: « niveau », « réviser »…; a seal is its material), no guilt wording (`GUILT`: manqué, raté, perdu), **no FOMO and no countdown** (the new `FOMO` rule, R14: no « dernière chance », « trop tard », « compte à rebours », « dépêche », « plus que 3 »…). The dragon is « il » and speaks in the first person; Éris agrees with herself in the feminine and never targets the player (`FORBIDDEN` in `eris.ts`). Plurals through `plural()` or count words. Typography: in TypeScript strings U+202F (`\u202f`) before « : ; ! ? % », inside « guillemets » and in thousands (`thousands()`); in `content/dialogue/*.json` plain spaces (`content.test.ts` forbids U+00A0/U+202F there; `frenchSpacing()` adds them at display). Lines ≤ 170 characters, no `"`, no `...` (use `…`). Code, comments, docs and commit messages are in English.
- **No emoji (CLAUDE.md):** not in any string, button, badge or marker. A trophy not yet won is its painted icon as a dark silhouette; a lit part of the muster is a gold outline.
- **Guards that must stay green (vitest):** `noEmoji`, `registerGuard`, `noGuilt`, `formPlural`, `frenchSpacing`, `placesKit`, `artReferenced`, `app.css`, `lib/dialogue/content.test.ts`, `lib/battle/lines.test.ts`, `lib/world/rewards.test.ts`, `lib/world/eris.test.ts`, `lib/tours/*.test.ts`; server `tests/test_french_spacing.py`.
- **Commits:** on `worktree-art-skills`, shared with art agents and possibly another implementer. **Always** `git add <paths> && git commit -m "..." -- <paths>`. Never `git add -A`, `git stash`, `git reset`, `git checkout`, `git restore` of tracked work, `git clean`, or any history rewrite. If git reports `index.lock`, wait a few seconds and retry. End every message with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- **Verification:** run each task's commands and paste the real output (counts included) into the report. A failing, flaky or warning test anywhere is yours to fix or to report as an open item, never "pre-existing" (CLAUDE.md).

## Review Focus

The five failure modes the spec implies but its test list does not pin, most likely first. Each has its test in the owning task.

1. **The what-next line at its edges.** Several cases true at once; a window at exactly 70 % (3 of 4 days, 18 of 25 chances: 72 %) and one chance short (17: 68 %); a share of 22/25 against 0.88 (the float lands a hair under); two lieutenants equally close; the Sirènes (plural agreement); a stored stage ahead of the XP (sub-project 3: an `adult` with 300 XP); an egg at 81 XP; exactly a fifth of the span left; one text left for the week (« un texte »); a fight already engaged; the stage or the name said twice in one greeting. Expected: the first case of R1 wins; the 70 % test is in whole numbers and the share keeps sub-project 2's 1e-9 tolerance; ties go to the fuller window, then the camp's order; the Sirènes get their own plural lines; no stage case below the floor or at exactly a fifth; singular for one text; the engaged fight still says Éris waits; the stage line leaves the greeting when the next goal is the name or the stage. Tests: Task 1 `whatNext` (`takes the first case that holds, in the order of R1`, `finds a seal within reach`, `names the lieutenant and the seal, the Sirènes with their own lines`, `says the stage is close only on its own scale`, `counts the week's texts in words`, `keeps pointing at Éris while her fight is under way`), `nearNextStage`, `campGreeting` `never repeats itself`, pytest `test_the_camp_counts_what_the_purse_can_buy`.
2. **Seen flags from before the versions.** Every hero on the NAS carries `tours: ['camp', 'war', …]` (or only `onboarded: true`) from UI5; a stale page still reads bare ids; a hand-edited entry `war:x`, `war:0`, `war:2.5`; a hero whose dragon's stage has no new step in a tour; the lyre's reset. Expected: a bare id is version 1, `onboarded` alone is the camp's version 1; malformed entries count for nothing; the save keeps the bare id and adds `id:N` (a stale page never replays the tour); a re-show with no step for this stage is marked seen silently and the place greets (never an empty tour flashing); the reset clears every version. Tests: Task 2 `versions each tour by its newest steps`, `re-shows only the steps newer than what was seen`, the seen store's `comes back for new steps once`, the content test `versions the new tour steps and leaves no stage without them`, e2e `a tour seen before its new steps comes back once, with the new steps only` and `a hero onboarded before the stall hears Hermès at the camp`.
3. **The muster's tour never stands in the way.** A child who taps « Commencer la dictée » on step 1; a resumed dictation; the grimoire; the no-scroll muster at 1280×800 with the tour's plate taller than Éris's taunt; a lit part left outlined after the tour. Expected: the tour is not a modal, every control stays usable, starting the dictation ends it and marks it seen; no tour on a resume or on the grimoire; the start button stays in view; the outline leaves with the step. Tests: Task 3 e2e `the first muster explains the pace, the aids and the total, once`, `the muster stays usable under its tour`, `no muster tour on a resumed battle or on the grimoire`.
4. **The guide drifting from the rules.** A rules file with other bonuses, seals, fights or drachmes; a catalogue not loaded yet; one gear piece instead of three. Expected: every number in the guide comes from `/api/world` (`rules`, `stages`, `shop`, `quest_bonus`, `level_xp`, `boss_rewards`) with the built-in defaults only until it has come; no number the rules file owns is written in a sentence. Tests: Task 4 `reads every number from the served catalogue`, `says the defaults until the catalogue has come`, e2e `the guide reads the rules the server serves`.
5. **A locked item without its sentence.** A lieutenant at seal 0 (its five trophies), at bronze (argent to orichalque still to win), asleep at the class; the Sirènes' plural; the next fight's gear vs a later one; every tint, decor piece, accessory and house. Expected: every item not owned has a sentence in words, never the catalogue's fallback « À gagner : … », agreed with its noun, with no pressure; the empty plinth says how and how much; nothing is hidden (the trophies still to win show as silhouettes). Tests: Task 5 `has a sentence for every locked kind, never the fallback, never pressure`, `says how each trophy is won`, `names the next fight to win on the ladder`, `says the next fight's gear, agreed`, e2e `the shelf says how to win every trophy`.

## Rulings taken by this plan (the spec is silent or ambiguous; do not re-ask)

- **R1 The order.** The spec's seven cases keep their order; the three next steps the camp already names (UI5 Ruling E12, `camp.next.prophecy`, `camp.next.first-text`, `camp.next.scrolls`) are kept and inserted where they agree with the hub's glow (UI3 Ruling B9, order amended by the controller: the real-school dictation first). First match wins: `name` → `prophecy` (due within 7 days) → `battle` (an Éris fight open, engaged or not) → `first-text` (no XP yet) → `seal` → `stage` → `shop` → `scrolls` (the week's scrolls sealed) → `weekly` → `none`. The glow (`nextStep`, `HUB_PLACE`) is unchanged: it points at a place, the line at a goal, and they agree whenever the glow's step outranks the other goals. `nextStepKey` goes; `whatNext` replaces it.
- **R2 The name.** Any hatched stage without a name (a hatchling, or a dragon grown past it unnamed): `camp.next.name`, whose first variant is the existing naming line « Au fait, tu me donnes un nom ? ».
- **R3 A seal within reach.** A lieutenant counts when it is available at the class, below seal 5 with a `next` window, its window at least 70 % complete in **both** days and chances (whole numbers: `10 × days ≥ 7 × need.days` and `10 × chances ≥ 7 × need.chances`) and its share at target (`correct ≠ null` and `correct ≥ need.correct − 1e-9`, sub-project 2's tolerance). Among several, the fullest window (`min(days ÷ need.days, chances ÷ need.chances, 1)`) wins, then the camp's order (`LIEUTENANT_ORDER`). The spec's line « {lieutenant} aura son sceau de {matière} » cannot agree with the Sirènes and cannot elide « de argent », so the placeholders are `{lieutenant}` (the camp's name in a sentence: « l'Hydre », « Écho », « la Chimère », « Protée », « les Sirènes », « Léthé ») and `{seal}` (`sealName`: « sceau de bronze », « sceau d'argent »), and the Sirènes have their own three lines through `when.opponent` (the spec's line reads « Encore un peu et l'Hydre aura son sceau de bronze. »).
- **R4 The stage close.** `nearNextStage(xp)`: `next ≠ null` and `5 × (next − total) < next − floor` (sub-project 3's R6, now shared with `stageLine`), on the stored stage's scale (a stage grown before its XP is never close). The egg has its own three lines (it does not « grandir », it hatches).
- **R5 Something affordable.** The client cannot know which decor or accessories the hero owns from the camp, so the server counts it: `camp.affordable` = the stall's items on sale for this hero (sub-project 4's `on_sale` on the stored stage and the lieutenants awake at the class), not owned, priced within the balance. The line never names the item or its price.
- **R6 The week.** `{texts}` is the texts still to defend this week in words (« un texte », « deux textes » … « six textes », then digits), never « 1 textes ».
- **R7 Never twice.** The greeting is `camp.enter`, the stage line, `camp.weekly` when the week is reached, then the what-next line; when the what-next case is `name` or `stage` the stage line is left out (it would say the same thing).
- **R8 Tour versions.** A tour step may carry `"since": N` (a whole number ≥ 2: the content version that added it); a tour's version is the highest `since` of its steps (1 without any). `settings.tours` keeps its list of strings: a bare `"war"` means version 1 seen (every UI5 save), `"war:2"` version 2; `onboarded: true` counts as the camp's version 1 (UI5 Ruling E13). A save writes the bare id plus `"id:N"` when N ≥ 2 (a page opened before this change reads the bare id and never replays the tour). Malformed entries (`war:x`, `war:0`, `war:2.5`) count for nothing. The lyre's « Refaire les visites du camp » clears the list, so every tour comes back whole.
- **R9 New steps only.** A hero who saw version V of a tour gets, once, the steps with `since > V` that match the dragon's stage, in the file's order, with the same ring, box and « C'est parti ! » on the last. No opener line: each new step reads on its own. If no step is left for this stage, the tour is marked seen without showing and the place greets as usual.
- **R10 The new place steps** (all `"since": 2`): the camp: Hermès at the stall (`speaker: "hermes"`, target `stall`), then the dragon on what is for sale and why (target `stall`), after the cabin's step; the war tent: the dragon on the three gauges (target `portraits`) after the portraits' step, and Éris on her fights (target null) before her closing line; the nest: the parure (target `dragon`; one line from `young` on, one for the egg and the hatchling); the cabin: the trophies (target `trophies`) after the shelf's step, the guide (target `lyre`) after the lyre's step, the house (target null) last. The library and Delphi are unchanged (version 1).
- **R11 The muster's tour.** Tour id `muster`, its steps in `content/dialogue/battle.json` (`tour`), targets `pace`, `aids`, `bonus` (parts of the parchment) or null. It is shown once, on the first **dictation** muster (never a resume ribbon, never the grimoire), once the camp has been asked (the dragon speaks it in its own look), on the plate where Éris's taunt stands (`MusterTour.svelte`: the dragon's plate, « Suite », « Passer la visite », « C'est parti ! » on the last step). It is **not** a modal: the muster stays usable; « Commencer la dictée » ends it and marks it seen. Each step lights its part with a gold outline (`data-tour-part` on the pace fieldset, the aids fieldset and the total line; `data-tour-lit` while lit). Éris's taunt shows again when it ends.
- **R12 The guide.** A cabin panel `#/p/:id/cabane?panel=guide` (`PanelId` `guide`, `OVERLAY_TITLES.guide = 'Le guide du camp'`, variant `codex`, `testId="overlay-guide"`), opened from the lyre's new section « Le guide du camp » (button « Lire le guide du camp », `data-testid="lyre-guide"`) with `go(path, 'panel')`, so its seal steps back to the lyre (a deep link closes to the cabin). The dragon's plate: `guideLine`. `lib/world/guide.ts` builds the five sections from the catalogue: `rules` (with `drachmes`, now typed on the client), `stages`, `shop`, `quest_bonus`, `level_xp` (new in `/api/world`), `boss_rewards`/`rewards`; the built-in defaults speak only until it has come. The aids' suggestion counts become exported constants (`LEAVE_AFTER = 3`, `TAKE_AFTER = 2` in `lib/aids.ts`) so the guide reads the same numbers the muster uses.
- **R13 How to earn it.** The empty plinth splits sub-project 2's `firstSealLine` in two: `sealHowLine(key, 1)` (« Premier sceau : défends des textes où l'Hydre se cache. », the spec's words) and `sealNeedLine(need)` (« 3 jours de garde et 12 pièges, dont 85 % déjoués. », from the rules); `firstSealLine` goes. Every awake lieutenant's plinth becomes a button (seal 0 too); the close view adds « Encore à gagner »: the trophies above the highest one, each as a dark silhouette with its name and `sealHowLine(key, L)` (« Au sceau d'argent : défends encore des textes où les Sirènes se cachent. »). The gear of the next fight not won (`nextFightTier`: the lowest tier of the ladder not in `tiers_won`) says « Gagne le prochain combat contre Éris pour les gagner. » (« …pour la gagner. » for the égide and the foudre); a later one keeps « Bats Éris une deuxième fois pour la gagner. ». Tints keep « Gagne-la dans une quête de l'Oracle. », decor its quest or stall sentence, accessories and houses sub-project 4's stall lines. `howToEarn(id, source, {nextTier, catalog})` is the shelf's one entry point.
- **R14 No pressure, checked.** `copyRules.ts` gains `FOMO` (Task 4); the guide's test (Task 4), the dialogue content test and the how-to-earn test (Task 5) apply it next to `BANNED` and `GUILT`.

## File map

| File | Responsibility | Task |
|---|---|---|
| `server/app/world/shop.py`, `server/tests/test_shop.py` | `affordable()` | 1 |
| `server/app/routers/world.py`, `server/tests/test_explanations_api.py` (new), `server/tests/test_world_api.py` | `camp.affordable`, `/api/world` `level_xp` | 1 |
| `web/src/lib/world/types.ts` | `CampResponse.affordable`, `WorldCatalog.level_xp` | 1 |
| `web/src/lib/world/nextStep.ts` (+ test) | `whatNext`, `sealWithinReach`, `NextCase` | 1 |
| `web/src/lib/world/dragon.ts` (+ test) | `nearNextStage` | 1 |
| `web/src/lib/world/scenes/camp.ts` (+ test) | `campGreeting` | 1 |
| `web/src/lib/dialogue/types.ts`, `content.test.ts`, `content/dialogue/camp.json` | the `camp.next.*` keys and lines (1); the camp tour's steps (2) | 1, 2 |
| `web/e2e/scenes-camp-next.spec.ts` (new) | every what-next case | 1 |
| `web/src/lib/tours/tours.ts` (+ test), `web/src/lib/tours/seen.svelte.ts` (+ test), `web/src/lib/dialogue/content.ts` | versions (2); the muster tour's file (3) | 2, 3 |
| `web/src/components/scene/PlaceScene.svelte` | new steps only | 2 |
| `content/dialogue/war.json`, `nest.json`, `cabin.json` | new tour steps | 2 |
| `web/e2e/scenes-tours.spec.ts` | step lists, re-show | 2 |
| `content/dialogue/battle.json`, `web/src/components/battle/MusterTour.svelte` (new), `MusterPhase.svelte`, `PaceMedallions.svelte`, `AidToggles.svelte`, `web/src/screens/Play.svelte` | the muster's tour | 3 |
| `web/e2e/scenes-muster-tour.spec.ts` (new) | the muster's tour | 3 |
| `web/src/lib/rules.ts` (+ test), `web/src/lib/aids.ts` (+ test) | `drachmes` typed; `LEAVE_AFTER`, `TAKE_AFTER` | 4 |
| `web/src/lib/world/guide.ts` (new, + test), `web/src/components/places/cabin/GuidePanel.svelte` (new), `web/src/lib/world/places.ts` (+ test), `web/src/screens/CabinRoom.svelte`, `web/src/lib/world/scenes/cabin.ts` (+ test), `web/src/components/places/cabin/LyrePanel.svelte` | the guide | 4 |
| `web/e2e/scenes-guide.spec.ts` (new) | the guide | 4 |
| `web/src/testing/copyRules.ts` | `FOMO` | 4 |
| `web/src/lib/world/seals.ts` (+ test), `web/src/lib/world/rewards.ts` (+ test), `web/src/components/places/cabin/TrophiesPanel.svelte` | how to earn | 5 |
| `web/e2e/scenes-cabin.spec.ts` | the shelf's sentences | 5 |
| `README.md` | the feature | 6 |

---

### Task 1: The dragon's what-next line

**Files:**
- Create: `server/tests/test_explanations_api.py`, `web/e2e/scenes-camp-next.spec.ts`
- Modify: `server/app/world/shop.py`, `server/app/routers/world.py`, `web/src/lib/world/types.ts`, `web/src/lib/world/nextStep.ts`, `web/src/lib/world/dragon.ts`, `web/src/lib/world/scenes/camp.ts`, `web/src/lib/dialogue/types.ts`, `content/dialogue/camp.json`
- Test: `server/tests/test_shop.py`, `server/tests/test_world_api.py`, `web/src/lib/world/nextStep.test.ts`, `web/src/lib/world/dragon.test.ts`, `web/src/lib/world/scenes/camp.test.ts`, `web/src/lib/dialogue/content.test.ts`, every vitest fixture of a `CampResponse` typed in full (`grep -rln "rewards_count" web/src --include=*.test.ts`)

**Interfaces:**
- Consumes: `is_item`, `on_sale`, `price_of` (`app/world/shop.py`); `REWARDS` (`app/world/catalog.py`); `LEVEL_XP`, `levels_of`, `lieutenants_for_level` (`app/world/seals.py`); `balance` (`app/world/drachmes.py`); `owned_ids`, `dragon_out` (`routers/world.py`); `nearestProphecy`, `prophecyWhen`; `sealName` (`lib/world/seals.ts`); `lieutenantName` (`lib/world/eris.ts`); `stageLine`, `Scale` (`lib/world/dragon.ts`); `sayKey`, `dragonSays`.
- Produces:
  - `app.world.shop.affordable(*, owned, levels, awake, stage, balance, rules) -> list[str]`; `GET /camp` `"affordable": int`; `GET /api/world` `"level_xp": int`.
  - `CampResponse.affordable: number`; `WorldCatalog.level_xp: number`.
  - `lib/world/dragon.ts`: `nearNextStage(xp: { total: number } & Scale): boolean`.
  - `lib/world/nextStep.ts`: `type NextCase`, `interface NextLine { kind; key; vars?; ctx? }`, `sealWithinReach(camp) -> { key: LieutenantKey; level: number } | null`, `whatNext(camp) -> NextLine`; `nextStepKey` removed (`nextStep`, `HUB_PLACE`, `bossEngaged` unchanged).
  - `DIALOGUE_KEYS` gains `camp.next.name`, `camp.next.seal`, `camp.next.stage`, `camp.next.shop`, `camp.next.weekly`.

- [ ] **Step 1: Write the failing server tests** — `server/tests/test_shop.py` (sub-project 4's; its `lv`, `SIX`, `FIVE` and `Rules` import are there), add `affordable` to the `app.world.shop` import and:

```python
# Spec 2026-09-29 explanations §1 case 5 (R5): what the purse can buy now, never what it cannot.
def test_what_the_purse_can_buy():
    r = Rules()
    kw = dict(levels=lv(hydre=2), awake=SIX, stage="young", rules=r)
    assert affordable(owned=set(), balance=39, **kw) == []
    assert affordable(owned=set(), balance=40, **kw) == ["accessory:hydre-cou"]
    assert set(affordable(owned={"decor:amphore"}, balance=50, **kw)) == {
        "accessory:hydre-cou", "decor:chouette", "decor:mosaique", "decor:bouclier"}
    assert "house:villa" in affordable(owned=set(), balance=300, levels={}, awake=SIX, stage="adult", rules=r)
    assert "house:villa" not in affordable(owned=set(), balance=300, levels={}, awake=SIX, stage="young", rules=r)
    rich = affordable(owned=set(), balance=10_000, levels=lv(protee=5), awake=FIVE, stage="egg", rules=r)
    assert not [i for i in rich if "protee" in i]
```

`server/tests/test_explanations_api.py`:

```python
"""The camp's what-next inputs through the API (spec 2026-09-29 explanations §1, §3)."""
from tests.test_dragon import set_stage
from tests.test_drachmes_api import camp, own, purse
from tests.test_seals_api import seal
from tests.test_sessions import make_profile


# Review focus 1 (R5): the camp counts what the purse can buy, owned pieces aside.
def test_the_camp_counts_what_the_purse_can_buy(client, settings):
    pid = make_profile(client, level="10H")
    assert camp(client, pid)["affordable"] == 0
    purse(settings, pid, 49)
    assert camp(client, pid)["affordable"] == 0                  # the decor costs 50
    purse(settings, pid, 1)
    assert camp(client, pid)["affordable"] == 4                  # the four decor pieces
    own(settings, pid, "decor:amphore")
    assert camp(client, pid)["affordable"] == 3
    seal(settings, pid, "hydre", 2)
    assert camp(client, pid)["affordable"] == 4                  # and the Hydra's collar, 40


def test_protee_sells_nothing_before_8h_and_the_villa_waits_for_the_adult(client, settings):
    pid = make_profile(client, level="7H")
    purse(settings, pid, 300); seal(settings, pid, "protee", 5)
    assert camp(client, pid)["affordable"] == 4                  # the decor only
    set_stage(settings, pid, "adult")
    assert camp(client, pid)["affordable"] == 5                  # and the villa


# Spec §3: the guide reads a seal's XP from the server.
def test_the_world_serves_the_xp_of_a_seal(client):
    assert client.get("/api/world").json()["level_xp"] == 100
```

`server/tests/test_world_api.py` `test_camp_for_new_profile`: add `assert c["affordable"] == 0`.

- [ ] **Step 2: Run them to see them fail**

Run: `scripts/pytest.sh -q tests/test_shop.py tests/test_explanations_api.py tests/test_world_api.py`
Expected: FAIL (`affordable` undefined, no `affordable` or `level_xp` in the answers).

- [ ] **Step 3: The server** — `server/app/world/shop.py` (import `REWARDS` from `app.world.catalog` if the module does not yet):

```python
def affordable(*, owned: set[str], levels: dict[str, int], awake, stage: str, balance: int, rules) -> list[str]:
    """The stall's items the purse can buy now (spec 2026-09-29 explanations §1 case 5, R5): on sale for
    this hero, not owned, priced within the balance. The camp serves their number."""
    return [rid for rid in REWARDS
            if is_item(rid) and rid not in owned
            and on_sale(rid, owned=owned, levels=levels, awake=awake, stage=stage)
            and price_of(rid, rules) <= balance]
```

`server/app/routers/world.py`: import `affordable`; import `LEVEL_XP` from `app.world.seals`. In `get_camp`, next to `"drachmes"`, using the values the function already has (the owned ids, the balance, the dragon from `dragon_out`, the profile's class):

```python
        "affordable": len(affordable(owned=owned_ids(db, pid), levels=levels_of(db, pid),
                                     awake=lieutenants_for_level(profile["level"]), stage=dragon["stage"],
                                     balance=balance(db, pid), rules=request.app.state.rules)),
```

(reuse the variables `get_camp` already computed for `drachmes`/`house` rather than calling twice; the stage is the stored one after `dragon_out`'s catch-up). In `get_world`'s dict, after `"quest_bonus"`: `"level_xp": LEVEL_XP,`.

- [ ] **Step 4: Run the server tests**

Run: `scripts/pytest.sh -q tests/test_shop.py tests/test_explanations_api.py tests/test_world_api.py tests/test_drachmes_api.py`
Expected: PASS.

- [ ] **Step 5: Write the failing client tests** — `web/src/lib/world/dragon.test.ts`, add `nearNextStage` to the import and:

```ts
  it('knows when the next stage is close: strictly under a fifth of the span (spec 2026-09-29 explanations §1, R4)', () => {
    expect(nearNextStage({ total: 1101, floor: 100, next: 1200 })).toBe(true);
    expect(nearNextStage({ total: 980, floor: 100, next: 1200 })).toBe(false); // exactly a fifth left
    expect(nearNextStage({ total: 81, floor: 0, next: 100 })).toBe(true);
    expect(nearNextStage({ total: 300, floor: 5000, next: 15000 })).toBe(false); // a stage grown before its XP
    expect(nearNextStage({ total: 41000, floor: 40000, next: null })).toBe(false);
  });
```

`web/src/lib/world/nextStep.test.ts`: the test `'names the same step in the greeting'` and the `nextStepKey` import go; add (keep the file's `prophecy` helper):

```ts
import { LIEUTENANT_ORDER, type LieutenantState } from './types';
import { sealWithinReach, whatNext } from './nextStep';

const need = { days: 4, chances: 25, correct: 0.88 };
const win = (days: number, chances: number, correct: number | null) => ({
  level: 2, days, chances, correct, complete: days >= need.days && chances >= need.chances, need,
});
const lt = (key: string, o: Partial<LieutenantState> = {}) =>
  ({ key, name: key, available: true, level: 1, next: win(0, 0, null), ...o }) as unknown as LieutenantState;
const withLt = (o: Record<string, Partial<LieutenantState>>) => LIEUTENANT_ORDER.map((k) => lt(k, o[k]));
const bossClosed = { tier_available: null, tiers_won: [], active_quest_id: null, fights: 10, next: { tier: 1, level: 1, missing: 2 } };
function state(o: Record<string, unknown> = {}): CampResponse {
  return {
    xp: { total: 300, floor: 100, next: 1200 },
    dragon: { name: 'Braise', stage: 'hatchling', tint: 'bronze', worn: [] },
    lieutenants: withLt({}),
    quests: [],
    prophecies: [],
    oracle: { week: 'w', status: 'chosen', reward_id: null },
    weekly: { week: 'w', target: 3, done: 3, reached: true },
    boss: bossClosed,
    affordable: 0,
    ...o,
  } as unknown as CampResponse;
}

describe("the dragon's what-next line (spec 2026-09-29 explanations §1)", () => {
  // Review focus 1: every case true at once, then peeled one by one.
  it('takes the first case that holds, in the order of R1', () => {
    const c: Record<string, unknown> = {
      dragon: { name: null, stage: 'hatchling', tint: 'bronze', worn: [] },
      prophecies: prophecy(3),
      boss: { ...bossClosed, tier_available: 1, next: null },
      xp: { total: 0, floor: 0, next: 100 },
      lieutenants: withLt({ echo: { next: win(3, 18, 0.9) } }),
      affordable: 2,
      oracle: { week: 'w', status: 'sealed', reward_id: null },
      weekly: { week: 'w', target: 3, done: 1, reached: false },
    };
    const peel: Record<string, unknown>[] = [
      { dragon: { name: 'Braise', stage: 'hatchling', tint: 'bronze', worn: [] } },
      { prophecies: [] },
      { boss: bossClosed },
      { xp: { total: 1150, floor: 100, next: 1200 } },
      { lieutenants: withLt({}) },
      { xp: { total: 300, floor: 100, next: 1200 } },
      { affordable: 0 },
      { oracle: { week: 'w', status: 'chosen', reward_id: null } },
      { weekly: { week: 'w', target: 3, done: 3, reached: true } },
    ];
    const seen = [whatNext(state(c)).kind];
    for (const drop of peel) {
      Object.assign(c, drop);
      seen.push(whatNext(state(c)).kind);
    }
    expect(seen).toEqual(['name', 'prophecy', 'battle', 'first-text', 'seal', 'stage', 'shop', 'scrolls', 'weekly', 'none']);
  });

  it('asks for a name at any hatched stage, never from the egg', () => {
    expect(whatNext(state({ dragon: { name: null, stage: 'young', tint: 'bronze', worn: [] } }))).toEqual({ kind: 'name', key: 'camp.next.name' });
    expect(whatNext(state({ dragon: { name: null, stage: 'egg', tint: 'bronze', worn: [] } })).kind).toBe('none');
  });

  it('keeps pointing at Éris while her fight is under way', () => {
    const engaged = { ...bossClosed, tier_available: 2, active_quest_id: 9, next: null };
    expect(whatNext(state({ boss: engaged }))).toEqual({ kind: 'battle', key: 'camp.next.battle' });
  });

  // Review focus 1 (R3): whole numbers at 70 %, the share's tolerance, the ties.
  it('finds a seal within reach: 70 % of the window, the share at target', () => {
    const at = (w: ReturnType<typeof win> | null, o: Partial<LieutenantState> = {}) => sealWithinReach(state({ lieutenants: withLt({ hydre: { next: w, ...o } }) }));
    expect(at(win(3, 18, 0.88))).toEqual({ key: 'hydre', level: 2 }); // 75 % of the days, 72 % of the chances
    expect(at(win(3, 18, 22 / 25))).toEqual({ key: 'hydre', level: 2 }); // 0.88 as the server computes it
    expect(at(win(4, 25, 0.9))).toEqual({ key: 'hydre', level: 2 }); // complete, not sealed yet
    expect(at(win(3, 17, 0.9))).toBeNull(); // 68 % of the chances
    expect(at(win(2, 25, 0.9))).toBeNull(); // 50 % of the days
    expect(at(win(3, 18, 0.87))).toBeNull();
    expect(at(win(3, 18, null))).toBeNull();
    expect(at(null, { level: 5 })).toBeNull();
    expect(at(win(3, 18, 0.9), { available: false })).toBeNull();
    // Ties: the fuller window, then the camp's order.
    expect(sealWithinReach(state({ lieutenants: withLt({ echo: { next: win(3, 18, 0.9) }, lethe: { next: win(4, 25, 0.9) } }) }))).toEqual({ key: 'lethe', level: 2 });
    expect(sealWithinReach(state({ lieutenants: withLt({ lethe: { next: win(3, 18, 0.9) }, echo: { next: win(3, 18, 0.9) } }) }))).toEqual({ key: 'echo', level: 2 });
  });

  it('names the lieutenant and the seal, the Sirènes with their own lines', () => {
    const line = (key: string) => whatNext(state({ lieutenants: withLt({ [key]: { next: win(3, 18, 0.9) } }) }));
    expect(line('hydre')).toEqual({ kind: 'seal', key: 'camp.next.seal', vars: { lieutenant: "l'Hydre", seal: 'sceau de bronze' }, ctx: { opponent: 'hydre' } });
    expect(line('sirenes')).toMatchObject({ vars: { lieutenant: 'les Sirènes', seal: 'sceau de bronze' }, ctx: { opponent: 'sirenes' } });
    expect(line('protee').vars).toEqual({ lieutenant: 'Protée', seal: 'sceau de bronze' });
    const argent = whatNext(state({ lieutenants: withLt({ chimere: { level: 2, next: { ...win(5, 40, 0.92), level: 3, need: { days: 6, chances: 45, correct: 0.91 } } } }) }));
    expect(argent.vars).toEqual({ lieutenant: 'la Chimère', seal: "sceau d'argent" });
  });

  it('says the stage is close only on its own scale', () => {
    expect(whatNext(state({ xp: { total: 1150, floor: 100, next: 1200 } })).kind).toBe('stage');
    expect(whatNext(state({ xp: { total: 90, floor: 0, next: 100 }, dragon: { name: null, stage: 'egg', tint: 'bronze', worn: [] } })).kind).toBe('stage');
    expect(whatNext(state({ xp: { total: 300, floor: 5000, next: 15000 }, dragon: { name: 'Braise', stage: 'adult', tint: 'bronze', worn: [] } })).kind).toBe('none');
    expect(whatNext(state({ xp: { total: 41000, floor: 40000, next: null }, dragon: { name: 'Braise', stage: 'ancestral', tint: 'bronze', worn: [] } })).kind).toBe('none');
  });

  it("counts the week's texts in words", () => {
    expect(whatNext(state({ weekly: { week: 'w', target: 3, done: 2, reached: false } }))).toEqual({ kind: 'weekly', key: 'camp.next.weekly', vars: { texts: 'un texte' } });
    expect(whatNext(state({ weekly: { week: 'w', target: 5, done: 0, reached: false } })).vars).toEqual({ texts: 'cinq textes' });
  });
});
```

`web/src/lib/world/scenes/camp.test.ts`: in `'greets with her name…'` nothing changes (a new hero: `first-text`); in `'praises the week's goal…'` the last line keeps `camp.next.none` only if the fixture's week is reached: give that `camp(...)` call `weekly: { week: 'w', target: 3, done: 3, reached: true }`. Add (build the camps with the file's `camp()` fixture; it gains `affordable: 0` and a reached week if it lacks them):

```ts
  // Spec 2026-09-29 explanations §1, R7: the line never repeats the greeting's content.
  it('never repeats itself: the name or the stage said as the next goal replaces the stage line', () => {
    const week = { week: 'w', target: 3, done: 3, reached: true };
    const close = camp({ weekly: week, xp: { total: 1150, floor: 100, next: 1200 }, dragon: { ...camp().dragon, stage: 'hatchling', name: 'Braise' } });
    expect(campGreeting('Ariane', close).map((l) => l.key)).toEqual(['camp.enter', 'camp.weekly', 'camp.next.stage']);
    const unnamed = camp({ weekly: week, xp: { total: 300, floor: 100, next: 1200 }, dragon: { ...camp().dragon, stage: 'hatchling', name: null } });
    expect(campGreeting('Ariane', unnamed).map((l) => l.key)).toEqual(['camp.enter', 'camp.weekly', 'camp.next.name']);
    const calm = camp({ weekly: week, xp: { total: 300, floor: 100, next: 1200 }, dragon: { ...camp().dragon, stage: 'hatchling', name: 'Braise' } });
    const lines = campGreeting('Ariane', calm);
    expect(lines.map((l) => l.key)).toEqual(['camp.enter', undefined, 'camp.weekly', 'camp.next.none']);
    expect(new Set(lines.map((l) => l.text)).size).toBe(lines.length);
  });

  it('speaks the seal line with its lieutenant and its seal', () => {
    const next = { level: 2, days: 3, chances: 18, correct: 0.9, complete: false, need: { days: 4, chances: 25, correct: 0.88 } };
    const lieutenants = [{ key: 'sirenes', name: 'Les Sirènes', available: true, level: 1, next }] as unknown as LieutenantState[];
    const last = campGreeting('Ariane', camp({ lieutenants, xp: { total: 300, floor: 100, next: 1200 } })).at(-1)!;
    expect(last.key).toBe('camp.next.seal');
    expect(variantsOf('camp.next.seal', { lieutenant: 'les Sirènes', seal: 'sceau de bronze' })).toContain(last.text);
    expect(last.text).toMatch(/Sirènes (auront|\.)|contre les Sirènes/);
  });
```

(`variantsOf` is the file's helper over the content lines; if it takes no vars, fill them the way `expectLineOf` does. `LieutenantState` is already imported there.)

`web/src/lib/dialogue/content.test.ts`: `DOMAINS` gains

```ts
  // Spec 2026-09-29 explanations §1: the what-next lines, in every context the camp asks them.
  'camp.next.name': DRAGON_STAGES.filter((s) => s !== 'egg').map((stage) => ({ stage }) as DialogueCtx),
  'camp.next.stage': DRAGON_STAGES.filter((s) => s !== 'ancestral').map((stage) => ({ stage }) as DialogueCtx),
  'camp.next.seal': LIEUTENANT_ORDER.map((opponent) => ({ opponent }) as DialogueCtx),
```

(`DRAGON_STAGES` is imported there since sub-project 3.)

- [ ] **Step 6: Run them to see them fail**

Run: `scripts/npm.sh run test -- src/lib/world/nextStep.test.ts src/lib/world/dragon.test.ts src/lib/world/scenes/camp.test.ts src/lib/dialogue/content.test.ts`
Expected: FAIL (`whatNext`, `sealWithinReach`, `nearNextStage` undefined; unknown keys `camp.next.seal`…).

- [ ] **Step 7: Types, the stage, the priority** — `web/src/lib/world/types.ts`: `CampResponse` gains `/** Spec 2026-09-29 explanations §1 (R5): the stall's items the purse can buy now. */ affordable: number;`; `WorldCatalog` gains `/** A seal L pays level_xp × L XP (spec 2026-09-29 lieutenant levels §1), read by the guide. */ level_xp: number;`. Every vitest fixture of a `CampResponse` typed in full gains `affordable: 0`, every `WorldCatalog` one `level_xp: 100`.

`web/src/lib/world/dragon.ts`, above `stageLine`:

```ts
/** The next stage is close (spec 2026-09-29 dragon growth §3, its R6; explanations §1 case 4): strictly
 *  under a fifth of the stage's span left, in whole numbers, on the stored stage's scale. Never at the top. */
export function nearNextStage(xp: { total: number } & Scale): boolean {
  return xp.next !== null && 5 * (xp.next - xp.total) < xp.next - xp.floor;
}
```

and `stageLine`'s last line becomes `return nearNextStage(xp) ? 'Encore un peu de gloire et je grandis.' : 'Chaque texte bien défendu me fait grandir.';`.

`web/src/lib/world/nextStep.ts` (keep `NextStep`, `bossEngaged`, `nextStep`, `HUB_PLACE`; delete `nextStepKey`). The header comment gains: « The dragon's what-next line (spec 2026-09-29 explanations §1, plan R1) is `whatNext`: the goals the glow names come first when they are the next step, then the progression's goals. » Imports: `nearNextStage` from `./dragon`, `lieutenantName` from `./eris`, `sealName` from `./seals`, `LIEUTENANT_ORDER`, `type LieutenantKey` from `./types`, `type DialogueCtx` from `../dialogue/types`. Add:

```ts
export type NextCase = 'name' | 'prophecy' | 'battle' | 'first-text' | 'seal' | 'stage' | 'shop' | 'scrolls' | 'weekly' | 'none';

export interface NextLine {
  kind: NextCase;
  key: DialogueKey;
  vars?: Record<string, string>;
  ctx?: DialogueCtx;
}

// A share of whole counts may land a hair under a decimal target (22/25 against 0.88), as on the server.
const EPSILON = 1e-9;

/** Spec §1 case 3 (R3): the lieutenant closest to its next seal whose window is at least 70 % complete
 *  in days and in chances (whole numbers) and whose share is at target; the fuller window first, then
 *  the camp's order. */
export function sealWithinReach(camp: Pick<CampResponse, 'lieutenants'>): { key: LieutenantKey; level: number } | null {
  let best: { key: LieutenantKey; level: number; fill: number; order: number } | null = null;
  for (const l of camp.lieutenants) {
    const n = l.next;
    const order = LIEUTENANT_ORDER.indexOf(l.key as LieutenantKey);
    if (!l.available || !n || order < 0 || n.correct === null) continue;
    if (10 * n.days < 7 * n.need.days || 10 * n.chances < 7 * n.need.chances) continue;
    if (n.correct < n.need.correct - EPSILON) continue;
    const fill = Math.min(1, n.days / n.need.days, n.chances / n.need.chances);
    if (!best || fill > best.fill || (fill === best.fill && order < best.order)) best = { key: l.key as LieutenantKey, level: n.level, fill, order };
  }
  return best ? { key: best.key, level: best.level } : null;
}

/** « l'Hydre », « la Chimère », « les Sirènes »: the camp's name inside a sentence. */
const inSentence = (name: string) => name.replace(/^(L'|La |Les )/, (m) => m.toLowerCase());

const COUNT = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six'];
/** « un texte », « deux textes » (R6). */
const texts = (n: number) => `${n < COUNT.length ? COUNT[n] : String(n)} ${n < 2 ? 'texte' : 'textes'}`;

/** The dragon's what-next line (spec §1, R1): a pure function of the camp, first match wins. */
export function whatNext(camp: CampResponse): NextLine {
  const d = camp.dragon;
  if (d.stage !== 'egg' && !d.name) return { kind: 'name', key: 'camp.next.name' };
  const p = nearestProphecy(camp);
  if (p && p.days_left <= 7) return { kind: 'prophecy', key: 'camp.next.prophecy', vars: { when: prophecyWhen(p.days_left) } };
  if (camp.boss.tier_available !== null) return { kind: 'battle', key: 'camp.next.battle' };
  if (camp.xp.total === 0) return { kind: 'first-text', key: 'camp.next.first-text' };
  const near = sealWithinReach(camp);
  if (near) {
    return {
      kind: 'seal',
      key: 'camp.next.seal',
      vars: { lieutenant: inSentence(lieutenantName(near.key)), seal: sealName(near.level) },
      ctx: { opponent: near.key },
    };
  }
  if (nearNextStage(camp.xp)) return { kind: 'stage', key: 'camp.next.stage' };
  if (camp.affordable > 0) return { kind: 'shop', key: 'camp.next.shop' };
  if (camp.oracle.status === 'sealed') return { kind: 'scrolls', key: 'camp.next.scrolls' };
  if (!camp.weekly.reached) return { kind: 'weekly', key: 'camp.next.weekly', vars: { texts: texts(Math.max(1, camp.weekly.target - camp.weekly.done)) } };
  return { kind: 'none', key: 'camp.next.none' };
}
```

(If `DialogueCtx.opponent`'s type does not accept a `LieutenantKey`, it is `OpponentId`, which includes the six keys: cast with `as DialogueCtx`, as `content.test.ts` does.)

- [ ] **Step 8: The greeting** — `web/src/lib/world/scenes/camp.ts`: the import of `nextStepKey` becomes `whatNext`;

```ts
/** The camp's greeting (Ruling E12; spec 2026-09-29 explanations §1): her name, the dragon's stage, the
 *  week's goal when reached, then the most useful next goal (R1). R7: when that goal is the name or the
 *  stage, the stage line is left out, so nothing is said twice. */
export function campGreeting(profileName: string, camp: CampResponse): DialogueLine[] {
  const d = camp.dragon;
  const next = whatNext(camp);
  const lines = [sayKey('camp.enter', { vars: { hero: profileName }, dragon: d })];
  if (next.kind !== 'name' && next.kind !== 'stage') lines.push(dragonSays(d, stageLine(d.stage, d.name, camp.xp)));
  if (camp.weekly.reached) lines.push(sayKey('camp.weekly', { dragon: d }));
  lines.push(sayKey(next.key, { vars: next.vars, ctx: next.ctx, dragon: d }));
  return lines;
}
```

- [ ] **Step 9: The lines** — `web/src/lib/dialogue/types.ts`: `DIALOGUE_KEYS`' first row becomes `'camp.enter', 'camp.weekly', 'camp.next.name', 'camp.next.prophecy', 'camp.next.battle', 'camp.next.first-text', 'camp.next.seal', 'camp.next.stage', 'camp.next.shop', 'camp.next.scrolls', 'camp.next.weekly', 'camp.next.none',`; `PLACEHOLDERS` gains `'camp.next.seal': ['lieutenant', 'seal'], 'camp.next.weekly': ['texts'],`.

`content/dialogue/camp.json` (plain spaces; keep the other keys as they are): the first line of `camp.next.battle` becomes the spec's

```json
      { "speaker": "dragon", "text": "Éris t'attend sur le sentier de la bataille." },
```

and, before `camp.next.prophecy`:

```json
    "camp.next.name": [
      { "speaker": "dragon", "text": "Au fait, tu me donnes un nom ?" },
      { "speaker": "dragon", "text": "J'ai éclos, mais je n'ai toujours pas de nom. Tu viens m'en choisir un, dans mon nid ?" },
      { "speaker": "dragon", "text": "Dans mon nid, tu peux me donner un nom. J'ai hâte de l'entendre !" }
    ],
```

after `camp.next.first-text`:

```json
    "camp.next.seal": [
      { "speaker": "dragon", "text": "Encore un peu et {lieutenant} aura son {seal}." },
      { "speaker": "dragon", "text": "Tu y es presque : {lieutenant} aura bientôt son {seal}." },
      { "speaker": "dragon", "text": "Je sens le {seal} tout proche. Encore un peu de garde contre {lieutenant}." },
      { "speaker": "dragon", "when": { "opponent": ["sirenes"] }, "text": "Encore un peu et {lieutenant} auront leur {seal}." },
      { "speaker": "dragon", "when": { "opponent": ["sirenes"] }, "text": "Tu y es presque : {lieutenant} auront bientôt leur {seal}." },
      { "speaker": "dragon", "when": { "opponent": ["sirenes"] }, "text": "Je sens le {seal} tout proche. Encore un peu de garde contre {lieutenant}." }
    ],
    "camp.next.stage": [
      { "speaker": "dragon", "text": "Encore un peu de gloire et je grandis." },
      { "speaker": "dragon", "text": "Je le sens, mes écailles tirent : encore un peu de gloire et je grandis." },
      { "speaker": "dragon", "text": "Encore quelques textes bien défendus, et tu vas me voir grandir !" },
      { "speaker": "dragon", "when": { "stage": ["egg"] }, "text": "Encore un peu de gloire et je sors de ma coquille." },
      { "speaker": "dragon", "when": { "stage": ["egg"] }, "text": "Ma coquille craque déjà un peu. Encore quelques textes, et je sors !" },
      { "speaker": "dragon", "when": { "stage": ["egg"] }, "text": "Je tapote de plus en plus fort : encore un peu de gloire et j'éclos." }
    ],
    "camp.next.shop": [
      { "speaker": "dragon", "text": "Hermès a quelque chose pour toi, et tu as de quoi payer." },
      { "speaker": "dragon", "text": "Ta bourse est assez pleine pour un objet de l'étal d'Hermès. Va voir, si le cœur t'en dit." },
      { "speaker": "dragon", "text": "À l'étal d'Hermès, quelque chose est à ta portée. Rien ne presse : il t'attendra." }
    ],
```

and after `camp.next.scrolls`:

```json
    "camp.next.weekly": [
      { "speaker": "dragon", "text": "Encore {texts} cette semaine pour l'objectif." },
      { "speaker": "dragon", "text": "Ton objectif de la semaine : encore {texts}, à ton rythme." },
      { "speaker": "dragon", "text": "Cette semaine, encore {texts} et l'objectif est atteint." }
    ],
```

`camp.next.none` keeps its three lines (the generic encouragement).

- [ ] **Step 10: Run the unit tests and the check**

Run: `scripts/npm.sh run test -- src/lib/world src/lib/dialogue src/noEmoji.test.ts src/registerGuard.test.ts src/noGuilt.test.ts src/frenchSpacing.test.ts src/formPlural.test.ts` ; `scripts/npm.sh run check`
Expected: PASS; `0 errors and 0 warnings`, tsc silent. `grep -rn "nextStepKey" web/src web/e2e` prints nothing.

- [ ] **Step 11: The e2e** — `web/e2e/scenes-camp-next.spec.ts`:

```ts
import { test, expect } from './crashGuard';
import type { Page } from '@playwright/test';
import { createProfileApi, expectCamp, expectLineOf, heroNamer, nextLine } from './helpers';
import { prophecyWhen } from '../src/lib/world/prophecy';

// Spec 2026-09-29 explanations §1, §5: the camp shows each what-next case, from a seeded camp (this
// hero's /camp answer edited; the priority itself is pinned by nextStep.test.ts).
const heroName = heroNamer('Prochain');

// A camp where no case holds: a named hatchling far from its next stage, the week reached, the scrolls
// opened, nothing affordable, no prophecy, no fight.
function calm(c: any) {
  c.xp = { total: 300, floor: 100, next: 1200 };
  c.dragon = { ...c.dragon, stage: 'hatchling', name: 'Braise' };
  c.weekly = { ...c.weekly, target: 3, done: 3, reached: true };
  c.oracle = { ...c.oracle, status: 'chosen' };
  c.affordable = 0;
  c.prophecies = [];
  c.boss = { ...c.boss, tier_available: null };
}
const nearSeal = { level: 2, days: 3, chances: 18, correct: 0.9, complete: false, need: { days: 4, chances: 25, correct: 0.88 } };
const CASES: { name: string; key: string; vars?: Record<string, string>; edit: (c: any) => void }[] = [
  { name: 'name', key: 'camp.next.name', edit: (c) => (c.dragon = { ...c.dragon, name: null }) },
  { name: 'prophecy', key: 'camp.next.prophecy', vars: { when: prophecyWhen(2) }, edit: (c) => (c.prophecies = [{ text_id: 1, title: 'La mer', due_date: '2099-01-02', days_left: 2 }]) },
  { name: 'battle', key: 'camp.next.battle', edit: (c) => (c.boss = { ...c.boss, tier_available: 1, next: null }) },
  { name: 'first-text', key: 'camp.next.first-text', edit: (c) => (c.xp = { total: 0, floor: 0, next: 100 }) },
  {
    name: 'seal',
    key: 'camp.next.seal',
    vars: { lieutenant: "l'Hydre", seal: 'sceau de bronze' },
    edit: (c) => (c.lieutenants = c.lieutenants.map((l: any) => (l.key === 'hydre' ? { ...l, available: true, level: 1, next: nearSeal } : l))),
  },
  { name: 'stage', key: 'camp.next.stage', edit: (c) => (c.xp = { total: 1150, floor: 100, next: 1200 }) },
  { name: 'shop', key: 'camp.next.shop', edit: (c) => (c.affordable = 2) },
  { name: 'scrolls', key: 'camp.next.scrolls', edit: (c) => (c.oracle = { ...c.oracle, status: 'sealed' }) },
  { name: 'weekly', key: 'camp.next.weekly', vars: { texts: 'deux textes' }, edit: (c) => (c.weekly = { ...c.weekly, target: 3, done: 1, reached: false }) },
  { name: 'none', key: 'camp.next.none', edit: () => {} },
];

/** Walks the greeting to its what-next line, collecting what the dragon said on the way. */
async function toNextLine(page: Page): Promise<string[]> {
  const box = page.getByTestId('dialogue-box');
  await expect(box).toBeVisible();
  const said: string[] = [];
  for (let i = 0; i < 6 && !((await box.getAttribute('data-key')) ?? '').startsWith('camp.next.'); i++) {
    said.push((await page.getByTestId('dialogue-text').textContent()) ?? '');
    await nextLine(page);
  }
  return said;
}

for (const c of CASES) {
  test(`the dragon names the next goal: ${c.name}`, async ({ page, request }, testInfo) => {
    const id = await createProfileApi(request, heroName(testInfo.project.name));
    await page.route(`**/api/profiles/${id}/camp`, async (route) => {
      const camp = await (await route.fetch()).json();
      calm(camp);
      c.edit(camp);
      await route.fulfill({ json: camp });
    });
    await page.goto(`/#/p/${id}/camp`);
    await expectCamp(page);
    const before = await toNextLine(page);
    await expectLineOf(page.getByTestId('dialogue-box'), c.key, c.vars);
    // R7: the stage line is left out when the next goal is the name or the stage.
    if (c.name === 'stage' || c.name === 'name') expect(before).toHaveLength(2); // camp.enter, camp.weekly
  });
}
```

(`toNextLine` reads a line's text before `nextLine` completes it; the length check only counts lines, so a half-typed text does not matter. If `CampResponse.boss.next` is typed non-optional in the e2e JSON, the `any` covers it.)

- [ ] **Step 12: Run the e2e**

Run: `STACK=prog scripts/playwright.sh scenes-camp-next.spec.ts --repeat-each=3` ; `STACK=prog scripts/playwright.sh scenes-camp.spec.ts scenes-dialogue.spec.ts world.spec.ts`
Expected: PASS on both projects (a new hero still hears `camp.next.first-text`).

- [ ] **Step 13: Commit**

```bash
git add server/app/world/shop.py server/app/routers/world.py server/tests/test_shop.py server/tests/test_explanations_api.py server/tests/test_world_api.py web/src/lib/world/types.ts web/src/lib/world/nextStep.ts web/src/lib/world/nextStep.test.ts web/src/lib/world/dragon.ts web/src/lib/world/dragon.test.ts web/src/lib/world/scenes/camp.ts web/src/lib/world/scenes/camp.test.ts web/src/lib/dialogue/types.ts web/src/lib/dialogue/content.test.ts content/dialogue/camp.json web/e2e/scenes-camp-next.spec.ts
git commit -m "The dragon ends its camp greeting with the most useful next goal: its name, the prophecy, Éris, the first text, a seal within reach, the next stage, something affordable at Hermès's stall, the week's scrolls, the weekly goal, or a warm word; the camp counts what the purse can buy and /api/world serves a seal's XP

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- server/app/world/shop.py server/app/routers/world.py server/tests/test_shop.py server/tests/test_explanations_api.py server/tests/test_world_api.py web/src/lib/world/types.ts web/src/lib/world/nextStep.ts web/src/lib/world/nextStep.test.ts web/src/lib/world/dragon.ts web/src/lib/world/dragon.test.ts web/src/lib/world/scenes/camp.ts web/src/lib/world/scenes/camp.test.ts web/src/lib/dialogue/types.ts web/src/lib/dialogue/content.test.ts content/dialogue/camp.json web/e2e/scenes-camp-next.spec.ts
```

(add every other fixture file Step 7 touched to both lists.)

---

### Task 2: Tours with versions — the new steps of the places

**Files:**
- Modify: `web/src/lib/tours/tours.ts`, `web/src/lib/tours/seen.svelte.ts`, `web/src/lib/dialogue/types.ts`, `web/src/lib/dialogue/content.ts`, `web/src/components/scene/PlaceScene.svelte`, `content/dialogue/camp.json`, `content/dialogue/war.json`, `content/dialogue/nest.json`, `content/dialogue/cabin.json`
- Test: `web/src/lib/tours/tours.test.ts`, `web/src/lib/tours/seen.svelte.test.ts`, `web/src/lib/dialogue/content.test.ts`, `web/e2e/scenes-tours.spec.ts`, every spec with `tours: true`

**Interfaces:**
- Consumes: `TOURS`, `matches`, `frameFor`; the scenes' hotspot ids (`stall` in the camp since sub-project 4; the house scenes share the cabin's ids).
- Produces:
  - `TourStepDef.since?: number`.
  - `lib/tours/tours.ts`: `tourVersion(id)`, `seenVersion(settings, id)`, `seenEntries(id)`, `tourSeen` on versions, `tourSteps(id, dragon, after = 0)`.
  - `markTourSeen` saves `seenEntries`; `PlaceScene` shows new steps only (R9).

- [ ] **Step 1: Write the failing tests** — `web/src/lib/tours/tours.test.ts`: import `seenEntries, seenVersion, tourVersion` too. In `"follows the dragon's stage…"` the camp's targets become `[null, null, null, 'parchemins', 'oracle', 'dossier', 'dragon', 'cabin', 'stall', 'stall', 'boss', null]` and the war's `['dossier', 'portraits', 'portraits', 'bestiary', null, null]`. `"counts the camp's tour as seen for a hero onboarded before UI5"` becomes:

```ts
  it("counts the camp's tour's first version as seen for a hero onboarded before UI5", () => {
    expect(seenVersion({}, 'camp')).toBe(0);
    expect(seenVersion({ onboarded: true }, 'camp')).toBe(1);
    expect(tourSeen({ onboarded: true }, 'camp')).toBe(false); // the camp has new steps since
    expect(tourSeen({ onboarded: true }, 'library')).toBe(false);
    expect(tourSeen({ tours: ['library'] }, 'library')).toBe(true);
  });

  // Spec 2026-09-29 explanations §2, R8; review focus 2.
  it('versions each tour by its newest steps, and reads what a hero has seen', () => {
    expect([tourVersion('camp'), tourVersion('war'), tourVersion('nest'), tourVersion('cabin')]).toEqual([2, 2, 2, 2]);
    expect([tourVersion('library'), tourVersion('delphi')]).toEqual([1, 1]);
    expect(seenVersion({ tours: ['war'] }, 'war')).toBe(1);
    expect(seenVersion({ tours: ['war', 'war:2'] }, 'war')).toBe(2);
    expect(seenVersion({ tours: ['war:x', 'war:0', 'war:2.5', 'warrior', 'war:'] }, 'war')).toBe(0);
    expect(tourSeen({ tours: ['war'] }, 'war')).toBe(false);
    expect(tourSeen({ tours: ['war', 'war:2'] }, 'war')).toBe(true);
    expect(seenEntries('library')).toEqual(['library']);
    expect(seenEntries('cabin')).toEqual(['cabin', 'cabin:2']);
  });

  it('re-shows only the steps newer than what was seen, for the dragon on show', () => {
    expect(tourSteps('cabin', young, 1).targets).toEqual(['trophies', 'lyre', null]);
    expect(tourSteps('war', young, 1).targets).toEqual(['portraits', null]);
    expect(tourSteps('camp', young, 1).lines.map((l) => l.speaker)).toEqual(['hermes', 'dragon']);
    expect(tourSteps('camp', young, 1).targets).toEqual(['stall', 'stall']);
    expect(tourSteps('nest', egg, 1).lines.map((l) => l.text)).toEqual(['Quand je serai un jeune dragon, je porterai une parure. Hermès vend chaque pièce à son étal, dans le camp.']);
    expect(tourSteps('nest', young, 1).lines[0].text).toMatch(/^Ici, tu choisis aussi ma parure/);
    expect(tourSteps('library', young, 1).lines).toEqual([]);
    expect(tourSteps('cabin', young, 2).lines).toEqual([]);
    expect(tourSteps('cabin', young).lines).toHaveLength(6);
  });
```

`web/src/lib/tours/seen.svelte.test.ts`: the second test's last expectation becomes `{ settings: { tours: ['nest', 'library', 'war', 'war:2'] } }`; the third's `{ settings: { tours: ['camp', 'camp:2', 'cabin', 'cabin:2'], onboarded: true } }`; the fifth's `{ settings: { tours: ['camp', 'camp:2'], onboarded: true } }` and its `toMatchObject({ tours: ['camp', 'camp:2'], onboarded: true })`. Add:

```ts
  it('comes back for new steps once, and never after the version is saved (spec 2026-09-29 explanations §2)', async () => {
    const p = hero({ tours: ['war'] });
    profileStore.current = p;
    expect(shouldTour(p, 'war')).toBe(true);
    await markTourSeen(p, 'war');
    expect(patch).toHaveBeenLastCalledWith(9, { settings: { tours: ['war', 'war:2'] } });
    expect(shouldTour(profileStore.current!, 'war')).toBe(false);
    expect(shouldTour(hero({ tours: ['war', 'war:2'] }), 'war')).toBe(false);
  });
```

`web/src/lib/dialogue/content.test.ts`, in the tours test, the scene of the cabin tour is checked against every house (`import { HOUSE_SCENES, SCENES } from '../world/scenes'`: for `id === 'cabin'`, every target must be ringable in `SCENES`' cabin and in each of `HOUSE_SCENES`); add:

```ts
  // Spec 2026-09-29 explanations §2, R8-R9: a tour's new steps are versioned, and a hero who saw the
  // older version hears at least one of them, whatever the dragon's stage.
  it('versions the new tour steps and leaves no stage without them', () => {
    for (const id of TOUR_IDS) {
      for (const s of TOURS[id]) if (s.since !== undefined) expect(Number.isInteger(s.since) && s.since >= 2, `${id}: since ${s.since}`).toBe(true);
      const version = TOURS[id].reduce((v, s) => Math.max(v, s.since ?? 1), 1);
      if (version < 2) continue;
      for (const stage of DRAGON_STAGES) {
        expect(TOURS[id].filter((s) => (s.since ?? 1) > 1 && (!s.when || s.when.stage?.includes(stage))).length, `${id} ${stage}`).toBeGreaterThan(0);
      }
    }
    expect(() => parseDialogueFile('war.json', { lines: { 'war.enter': [{ speaker: 'eris', text: 'Un mot.' }] }, tour: [{ speaker: 'dragon', target: null, since: 1, text: 'Un mot.' }] })).toThrow(/since/);
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `scripts/npm.sh run test -- src/lib/tours src/lib/dialogue/content.test.ts`
Expected: FAIL (`tourVersion`, `seenVersion`, `seenEntries` undefined; the new steps missing).

- [ ] **Step 3: Versions** — `web/src/lib/dialogue/types.ts`, `TourStepDef` gains `/** Spec 2026-09-29 explanations §2 (R8): the tour's content version that added this step (absent: 1). */ since?: number;`. `web/src/lib/dialogue/content.ts`, in `checkLine`, after the target check:

```ts
  if (tour && o.since !== undefined && !(Number.isInteger(o.since) && (o.since as number) >= 2)) throw new Error(`${where}: bad since`);
```

`web/src/lib/tours/tours.ts` (header comment gains « Spec 2026-09-29 explanations §2: steps added later carry `since`; a hero who saw an older version hears the new steps only, once (plan R8, R9). »):

```ts
/** A tour's content version (R8): the newest `since` of its steps, 1 without any. */
export function tourVersion(id: TourId): number {
  return TOURS[id].reduce((v, s) => Math.max(v, s.since ?? 1), 1);
}

/** The version of `id` this hero has seen (R8): 0 never, 1 for a bare « war » (every save before the
 *  versions; `onboarded` counts as the camp's), N for « war:N ». Anything else counts for nothing. */
export function seenVersion(settings: ProfileSettings, id: TourId): number {
  let seen = id === 'camp' && settings.onboarded === true ? 1 : 0;
  for (const entry of settings.tours ?? []) {
    if (entry === id) seen = Math.max(seen, 1);
    else if (entry.startsWith(`${id}:`)) {
      const v = Number(entry.slice(id.length + 1));
      if (Number.isInteger(v) && v >= 1) seen = Math.max(seen, v);
    }
  }
  return seen;
}

/** What a save writes for `id` (R8): the bare id, read by a page opened before the versions, and
 *  « id:N » from version 2. */
export function seenEntries(id: TourId): string[] {
  const v = tourVersion(id);
  return v >= 2 ? [id, `${id}:${v}`] : [id];
}

export function tourSeen(settings: ProfileSettings, id: TourId): boolean {
  return seenVersion(settings, id) >= tourVersion(id);
}

/** The steps of `id` for this dragon; `after` a version already seen, the newer steps only (R9). */
export function tourSteps(id: TourId, dragon: DragonOut | null, after = 0): { lines: DialogueLine[]; targets: (string | null)[] } {
  const steps = TOURS[id].filter((s) => (s.since ?? 1) > after && matches(s.when, dragon ? { stage: dragon.stage } : {}));
  return {
    lines: steps.map((s, i) => ({ ...frameFor(s.speaker, dragon), text: frenchSpacing(s.text), key: `tour.${id}.${i}` })),
    targets: steps.map((s) => s.target),
  };
}
```

(the old `tourSeen` body and `tourSteps` are replaced by these.) `web/src/lib/tours/seen.svelte.ts`: import `seenEntries`; in `markTourSeen` the list becomes `const tours = [...new Set([...(base.tours ?? []), ...seenThisLoad(profile.id).flatMap(seenEntries)])];` (its comment: « … each one sends every tour this page load has seen, at its current version (R8) … »). `resetTours` is unchanged (it clears every version).

- [ ] **Step 4: New steps only** — `web/src/components/scene/PlaceScene.svelte`: import `seenVersion` with `tourSteps`; in the tour's `tick().then(…)`:

```ts
      if (!live || tour || overlayState.open > 0) return;
      // Spec 2026-09-29 explanations §2 (R9): a tour seen before its new steps comes back with them only;
      // none for this dragon's stage: it counts as seen, and the place greets as usual.
      const steps = tourSteps(id, dragon, seenVersion(profile.settings, id));
      if (steps.lines.length === 0) {
        void markTourSeen(profile, id);
        return;
      }
      markGreeted(greetKey(scene.id, profile.id));
      tour = { id, ...steps };
```

`web/src/screens/Camp.svelte`'s `shouldTour(profile, 'camp')` needs no change (it reads versions now).

- [ ] **Step 5: The new steps** (plain spaces; the ids stay; insert exactly where said) — `content/dialogue/camp.json` `tour`, after the step targeting `cabin`:

```json
    { "speaker": "hermes", "target": "stall", "since": 2, "text": "L'étal d'Hermès, c'est le mien ! Tes textes te rapportent des drachmes ; ici, tu les échanges contre des parures, du décor, et même une maison." },
    { "speaker": "dragon", "target": "stall", "since": 2, "text": "Ce qu'Hermès vend dépend de toi : un sceau gagné met une parure en vente, et quand je grandis, une plus belle maison. Ta bourse est en haut de l'écran." },
```

`content/dialogue/war.json` `tour`, after the `portraits` step:

```json
    { "speaker": "dragon", "target": "portraits", "since": 2, "text": "Sur chaque fiche, trois jauges : les jours de garde, les pièges croisés, et la part de pièges déjoués. Quand tout y est, le sceau est à toi." },
```

and before Éris's closing step (after `bestiary`):

```json
    { "speaker": "eris", "target": null, "since": 2, "text": "Des sceaux sur mes lieutenants ? Soit. Quand il y en aura assez, je reviendrai vous défier sur le sentier de la bataille." },
```

`content/dialogue/nest.json` `tour`, after the two `dragon` steps (before the closing line):

```json
    { "speaker": "dragon", "target": "dragon", "since": 2, "when": { "stage": ["young", "adult", "illustre", "ancestral"] }, "text": "Ici, tu choisis aussi ma parure : au cou, à la queue, sur le dos, sur la tête. Hermès vend chaque pièce à son étal." },
    { "speaker": "dragon", "target": "dragon", "since": 2, "when": { "stage": ["egg", "hatchling"] }, "text": "Quand je serai un jeune dragon, je porterai une parure. Hermès vend chaque pièce à son étal, dans le camp." },
```

`content/dialogue/cabin.json` `tour` becomes (the three old steps kept, three new ones):

```json
  "tour": [
    { "speaker": "dragon", "target": "trophies", "text": "L'étagère garde tes trésors. Ici, pas de hasard : tu sais toujours ce que tu peux gagner." },
    { "speaker": "dragon", "target": "trophies", "since": 2, "text": "Chaque sceau que tu gagnes y pose un trophée, du bois à l'orichalque. Un socle vide te dit comment gagner le premier." },
    { "speaker": "dragon", "target": "journal", "text": "Ton journal se souvient de chaque texte défendu et de chaque piège déjoué." },
    { "speaker": "dragon", "target": "lyre", "text": "La lyre règle la voix qui lit la dictée, la musique et les bruitages du camp." },
    { "speaker": "dragon", "target": "lyre", "since": 2, "text": "Dans la lyre, il y a aussi le guide du camp : la gloire, les sceaux, les drachmes, les aides et Éris, tout y est raconté." },
    { "speaker": "dragon", "target": null, "since": 2, "text": "Et cette cabane peut grandir : Hermès vend une villa, puis un palais, quand je grandis. Plus de murs, plus de décor !" }
  ]
```

(If sub-project 2, 3 or 4 changed one of the old steps' texts, keep their text: only the new steps are this task's.)

- [ ] **Step 6: Run the unit tests and the check**

Run: `scripts/npm.sh run test -- src/lib/tours src/lib/dialogue src/lib/world/scenes src/noEmoji.test.ts src/registerGuard.test.ts src/noGuilt.test.ts` ; `scripts/npm.sh run check`
Expected: PASS; `0 errors and 0 warnings`, tsc silent.

- [ ] **Step 7: The e2e** — `web/e2e/scenes-tours.spec.ts`: the first test's list becomes `['', '', '', 'parchemins', 'oracle', 'dossier', 'dragon', 'cabin', 'stall', 'stall', 'boss', '']` and its saved settings `{ tours: ['camp', 'camp:2'], onboarded: true }`; the war test walks `dossier`, `portraits`, then `portraits` again (the gauges), `bestiary`, and ends on `data-step` `'5'` with « C'est parti ! »; « Refaire les visites du camp » patches `tours` with every tour's saved entries (`['camp', 'camp:2', 'library', 'delphi', 'war', 'war:2', 'nest', 'nest:2', 'cabin', 'cabin:2']`) before the reset. Every test that uses `createProfileApi` (onboarded, camp version 1) and opens the camp with the tours on now meets the camp's new steps first: walk or skip them there. Add (import `frenchSpacing` from `'../src/lib/text/french'`):

```ts
// Spec 2026-09-29 explanations §2, §5 (R8, R9; review focus 2).
test('a tour seen before its new steps comes back once, with the new steps only', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await request.patch(`/api/profiles/${id}`, { data: { settings: { tours: ['camp', 'library', 'delphi', 'war', 'nest', 'cabin'] } } });
  await page.goto(`/#/p/${id}/cabane`);
  const tour = page.getByTestId('tour');
  await expect(tour).toHaveAttribute('data-tour', 'cabin');
  await expectScene(page, 'cabin');
  await expect(page.getByTestId('dialogue-text')).toHaveText(
    frenchSpacing("Chaque sceau que tu gagnes y pose un trophée, du bois à l'orichalque. Un socle vide te dit comment gagner le premier."),
  );
  expect(await walkTour(page)).toEqual(['trophies', 'lyre', '']);
  await expect.poll(async () => (await (await request.get(`/api/profiles/${id}`)).json()).settings.tours).toContain('cabin:2');
  await page.reload();
  await expectScene(page, 'cabin');
  await expect(tour).toHaveCount(0);
  await expectLineOf(page.getByTestId('dialogue-box'), 'cabin.enter');
  // A place without new steps stays quiet.
  await page.goto(`/#/p/${id}/temple`);
  await expectScene(page, 'delphi');
  await expect(tour).toHaveCount(0);
});

test('a hero onboarded before the stall hears Hermès at the camp, then nothing more', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/camp`);
  const tour = page.getByTestId('tour');
  await expect(tour).toHaveAttribute('data-tour', 'camp');
  await expect(tour).toHaveAttribute('data-target', 'stall');
  await expect(page.getByTestId('dialogue-box')).toHaveAttribute('data-speaker', 'hermes');
  expect(await walkTour(page)).toEqual(['stall', 'stall']);
  await expect.poll(async () => (await (await request.get(`/api/profiles/${id}`)).json()).settings.tours).toContain('camp:2');
  await page.reload();
  await expectCamp(page);
  await expect(tour).toHaveCount(0);
});
```

- [ ] **Step 8: Run the e2e**

Run: `STACK=prog scripts/playwright.sh scenes-tours.spec.ts --repeat-each=3` ; then once each spec that turns the tours on: `grep -ln "tours: true" web/e2e` (at least `playability-ui5.spec.ts`, `scenes-audio.spec.ts`, `world.spec.ts`): `STACK=prog scripts/playwright.sh playability-ui5.spec.ts scenes-audio.spec.ts world.spec.ts`
Expected: PASS on both projects. A tours-on spec that met the camp's new steps unexpectedly is fixed in that spec (walk or skip them), never by turning its tours off.

- [ ] **Step 9: Commit**

```bash
git add web/src/lib/tours/tours.ts web/src/lib/tours/tours.test.ts web/src/lib/tours/seen.svelte.ts web/src/lib/tours/seen.svelte.test.ts web/src/lib/dialogue/types.ts web/src/lib/dialogue/content.ts web/src/lib/dialogue/content.test.ts web/src/components/scene/PlaceScene.svelte content/dialogue/camp.json content/dialogue/war.json content/dialogue/nest.json content/dialogue/cabin.json web/e2e/scenes-tours.spec.ts
git commit -m "Tours gain versioned steps for what the progression added (Hermès at his stall, the seals' gauges and Éris's fights, the parure, the trophies, the guide and the house); a hero who saw a tour before hears its new steps only, once; settings.tours keeps the bare id and adds id:N

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/lib/tours/tours.ts web/src/lib/tours/tours.test.ts web/src/lib/tours/seen.svelte.ts web/src/lib/tours/seen.svelte.test.ts web/src/lib/dialogue/types.ts web/src/lib/dialogue/content.ts web/src/lib/dialogue/content.test.ts web/src/components/scene/PlaceScene.svelte content/dialogue/camp.json content/dialogue/war.json content/dialogue/nest.json content/dialogue/cabin.json web/e2e/scenes-tours.spec.ts
```

(add every tours-on spec Step 8 changed to both lists.)

---

### Task 3: The muster's tour

**Files:**
- Create: `web/src/components/battle/MusterTour.svelte`, `web/e2e/scenes-muster-tour.spec.ts`
- Modify: `web/src/lib/dialogue/types.ts` (`TOUR_IDS`), `web/src/lib/dialogue/content.ts` (`TOURS` by file), `web/src/lib/tours/tours.ts` (`MUSTER_TOUR_PARTS`), `content/dialogue/battle.json`, `web/src/components/battle/MusterPhase.svelte`, `web/src/components/battle/PaceMedallions.svelte`, `web/src/components/battle/AidToggles.svelte`, `web/src/screens/Play.svelte`
- Test: `web/src/lib/tours/tours.test.ts`, `web/src/lib/dialogue/content.test.ts`

**Interfaces:**
- Consumes: Task 2's `tourSteps`, `seenVersion`, `shouldTour`, `markTourSeen`; `OverlayVoice`; the muster's `taunt` plate; Play's `campTried`, `showResumeBanner`, `startDictation`.
- Produces: `TourId` `muster`; `MUSTER_TOUR_PARTS = ['pace', 'aids', 'bonus']`; `MusterTour.svelte` (`lines`, `targets`, `onStep`, `onDone`); `MusterPhase` props `tour`, `onTourDone`; `data-tour-part` on the pace fieldset, the aids fieldset and the total line.

- [ ] **Step 1: Write the failing tests** — `web/src/lib/tours/tours.test.ts`: import `MUSTER_TOUR_PARTS`; add

```ts
  // Spec 2026-09-29 explanations §2 (R11): the muster's own tour, told by the dragon.
  it('walks the muster through the pace, the aids and the total', () => {
    const m = tourSteps('muster', young);
    expect(m.targets).toEqual(['pace', 'aids', 'aids', 'bonus', null]);
    expect(m.lines.every((l) => l.speaker === 'dragon')).toBe(true);
    expect(MUSTER_TOUR_PARTS).toEqual(['pace', 'aids', 'bonus']);
    expect(tourVersion('muster')).toBe(1);
  });
```

`web/src/lib/dialogue/content.test.ts`, in the tours test: `const ringable = id === 'muster' ? [...MUSTER_TOUR_PARTS] : …` (import it from `'../tours/tours'`), and the per-stage count holds for the muster too.

- [ ] **Step 2: Run them to see them fail**

Run: `scripts/npm.sh run test -- src/lib/tours src/lib/dialogue/content.test.ts`
Expected: FAIL (no tour `muster`).

- [ ] **Step 3: The tour's content** — `web/src/lib/dialogue/types.ts`: `export const TOUR_IDS = ['camp', 'library', 'delphi', 'war', 'nest', 'cabin', 'muster'] as const;`. `web/src/lib/dialogue/content.ts`: `TOURS` becomes

```ts
/** Which content file holds each tour: a place's own, the muster's in battle.json (spec 2026-09-29
 *  explanations §2, R11). */
const TOUR_FILE: Record<TourId, string> = { camp: 'camp', library: 'library', delphi: 'delphi', war: 'war', nest: 'nest', cabin: 'cabin', muster: 'battle' };
const byName = Object.fromEntries(parsed) as Record<string, DialogueFile>;
export const TOURS = Object.fromEntries(TOUR_IDS.map((id) => [id, byName[TOUR_FILE[id]]?.tour ?? []])) as Record<TourId, TourStepDef[]>;
```

`web/src/lib/tours/tours.ts`: `/** The muster's parts its tour lights (R11): the pace, the aids, the total. */ export const MUSTER_TOUR_PARTS = ['pace', 'aids', 'bonus'] as const;` (`TOUR_OF` is unchanged: the muster is no scene). `content/dialogue/battle.json` gains, after `lines`:

```json
  "tour": [
    { "speaker": "dragon", "target": "pace", "text": "Ton rythme : plus la Pythie lit vite, plus la gloire est grande. Choisis celui qui te va." },
    { "speaker": "dragon", "target": "aids", "text": "Tes aides : cinq alliés pour relire. Touche une aide pour l'emporter, ou pour la laisser au camp." },
    { "speaker": "dragon", "target": "aids", "text": "Chaque aide laissée au camp ajoute de la gloire : sa pastille dit combien. Tu la reprends quand tu veux." },
    { "speaker": "dragon", "target": "bonus", "text": "Ici, toute la gloire en plus de cette dictée. Elle compte surtout quand ta copie est soignée." },
    { "speaker": "dragon", "target": null, "text": "Tu choisis, et tu changes d'avis quand tu veux. En route pour la dictée !" }
  ]
```

- [ ] **Step 4: The plate** — `web/src/components/battle/MusterTour.svelte`:

```svelte
<script lang="ts">
  // The muster's first-visit tour (spec 2026-09-29 explanations §2, plan R11): the dragon explains the
  // pace, the aids, leaving them at the camp and the total, one step at a time, on the plate where
  // Éris's taunt usually stands. Not a modal: the muster stays usable under it (« Commencer la
  // dictée » ends it too); each step lights its part of the parchment (MusterPhase).
  import OverlayVoice from '../scene/OverlayVoice.svelte';
  import type { DialogueLine } from '../../lib/scene/types';

  let {
    lines,
    targets,
    onStep,
    onDone,
  }: { lines: DialogueLine[]; targets: (string | null)[]; onStep: (target: string | null) => void; onDone: () => void } = $props();

  let index = $state(0);
  const line = $derived(lines[Math.min(index, lines.length - 1)]);
  const last = $derived(index >= lines.length - 1);
  $effect(() => onStep(targets[index] ?? null));

  function next() {
    if (last) onDone();
    else index += 1;
  }
</script>

{#if line}
  <div
    class="muster-tour"
    role="group"
    aria-label={'Visite\u202f: la préparation de la bataille'}
    aria-live="polite"
    data-testid="muster-tour"
    data-step={index}
    data-target={targets[index] ?? ''}
  >
    <OverlayVoice {line} testId="muster-tour-voice" />
    <div class="tour-actions">
      {#if !last}
        <button type="button" class="kit-link" data-testid="muster-tour-skip" onclick={onDone}>Passer la visite</button>
      {/if}
      <button type="button" class="kit-bronze is-quiet" data-testid="muster-tour-next" onclick={next}>{last ? "C'est parti\u202f!" : 'Suite'}</button>
    </div>
  </div>
{/if}

<style>
  .muster-tour {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .muster-tour :global(.overlay-voice) {
    margin-bottom: 0;
  }
  .tour-actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 14px;
  }
  .tour-actions button {
    min-height: 48px;
  }
</style>
```

- [ ] **Step 5: The muster** — `web/src/components/battle/PaceMedallions.svelte`: the root `<fieldset class="paces" …>` gains `data-tour-part="pace"`. `web/src/components/battle/AidToggles.svelte`: the root `<fieldset class="aids" …>` gains `data-tour-part="aids"`. `web/src/components/battle/MusterPhase.svelte`:
  - header comment gains « On the first dictation muster the dragon's tour takes the taunt's plate (spec 2026-09-29 explanations §2, plan R11). »;
  - imports: `MusterTour` from `'./MusterTour.svelte'`, `reducedMotion` from `'../../lib/juice/motion'`;
  - props gain `tour = null` and `onTourDone = () => {}` typed `/** The muster's first-visit tour (R11), or null. */ tour?: { lines: DialogueLine[]; targets: (string | null)[] } | null; onTourDone?: () => void;`;
  - script:

```ts
  // R11: the tour's step lights its part of the parchment (a gold outline), and only while it speaks.
  let root = $state<HTMLDivElement>();
  let tourTarget = $state<string | null>(null);
  $effect(() => {
    const t = tour ? tourTarget : null;
    const node = root;
    if (!t || !node) return;
    const el = node.querySelector<HTMLElement>(`[data-tour-part="${t}"]`);
    if (!el) return;
    el.setAttribute('data-tour-lit', '');
    el.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
    return () => el.removeAttribute('data-tour-lit');
  });
```

  - the root `<div class="muster" …>` gains `bind:this={root}`;
  - `{#if taunt}<OverlayVoice line={taunt} testId="battle-voice" />{/if}` becomes

```svelte
    {#if tour && mode !== 'grimoire'}
      <MusterTour lines={tour.lines} targets={tour.targets} onStep={(t) => (tourTarget = t)} onDone={onTourDone} />
    {:else if taunt}
      <OverlayVoice line={taunt} testId="battle-voice" />
    {/if}
```

  - the dictation's total line (`<p class="total" data-testid="muster-bonus">` in the dictation branch, not the grimoire's) gains `data-tour-part="bonus"`;
  - CSS:

```css
  /* R11: the part the tour speaks of (the pace, the aids, the total), outlined in gold. */
  .muster :global([data-tour-lit]) {
    outline: 3px solid var(--gold-light);
    outline-offset: 4px;
    border-radius: 12px;
    box-shadow: 0 0 18px color-mix(in srgb, var(--gold-light) 60%, transparent);
  }
```

`web/src/screens/Play.svelte`: import `markTourSeen`, `shouldTour` from `'../lib/tours/seen.svelte'` and `seenVersion`, `tourSteps` from `'../lib/tours/tours'`;

```ts
  // Spec 2026-09-29 explanations §2 (R11): the muster's own tour, once, on the first dictation muster
  // (never a resume or the grimoire), once /camp has been asked (the dragon speaks in its own look).
  let musterTour = $state<{ lines: DialogueLine[]; targets: (string | null)[] } | null>(null);
  let musterTourAsked = false;
  $effect(() => {
    if (musterTourAsked || !campTried || phase !== 'muster' || mode !== 'dictation' || showResumeBanner || playState?.phase !== 'intro') return;
    musterTourAsked = true;
    untrack(() => {
      if (!shouldTour(profile, 'muster')) return;
      const steps = tourSteps('muster', camp?.dragon ?? null, seenVersion(profile.settings, 'muster'));
      if (steps.lines.length > 0) musterTour = steps;
      else void markTourSeen(profile, 'muster');
    });
  });
  function endMusterTour() {
    if (!musterTour) return;
    musterTour = null;
    void markTourSeen(profile, 'muster');
  }
```

`startDictation`'s first line becomes `endMusterTour();` (before `if (!playState) return;`), and `<MusterPhase …>` gains `tour={musterTour}` and `onTourDone={endMusterTour}`.

- [ ] **Step 6: Run the unit tests and the check**

Run: `scripts/npm.sh run test -- src/lib/tours src/lib/dialogue src/lib/battle src/placesKit.test.ts src/noEmoji.test.ts src/registerGuard.test.ts src/noGuilt.test.ts src/frenchSpacing.test.ts` ; `scripts/npm.sh run check`
Expected: PASS; `0 errors and 0 warnings`, tsc silent.

- [ ] **Step 7: The e2e** — `web/e2e/scenes-muster-tour.spec.ts`:

```ts
import { test, expect } from './crashGuard';
import { createProfileApi, createText, expectBattle, heroNamer, seedPlay, tap, uniqueName } from './helpers';

// Spec 2026-09-29 explanations §2 (plan R11): the muster's own tour, on the plate of Éris's taunt.
test.use({ tours: true });
const heroName = heroNamer('Rassemblement');
const BODY = 'Les enfants jouent dans le jardin. Ils rient.';

test('the first muster explains the pace, the aids and the total, once', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const text = await createText(request, { title: uniqueName('Visite'), body: BODY, level: '10H' });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'muster');
  const tour = page.getByTestId('muster-tour');
  await expect(tour).toHaveAttribute('data-step', '0');
  await expect(page.getByTestId('battle-voice')).toHaveCount(0);
  const lit = page.locator('[data-tour-lit]');
  const parts: string[] = [];
  for (let i = 0; i < 8 && (await tour.count()) > 0; i++) {
    const target = (await tour.getAttribute('data-target')) ?? '';
    parts.push(target);
    if (target) await expect(lit).toHaveAttribute('data-tour-part', target);
    else await expect(lit).toHaveCount(0);
    const step = await tour.getAttribute('data-step');
    await tap(page.getByTestId('muster-tour-next'), testInfo);
    await expect.poll(async () => ((await tour.count()) === 0 ? 'gone' : await tour.getAttribute('data-step'))).not.toBe(step);
  }
  expect(parts).toEqual(['pace', 'aids', 'aids', 'bonus', '']);
  await expect(lit).toHaveCount(0);
  await expect(page.getByTestId('battle-voice')).toBeVisible();
  await expect.poll(async () => (await (await request.get(`/api/profiles/${id}`)).json()).settings.tours ?? []).toContain('muster');
  await page.reload();
  await expectBattle(page, 'muster');
  await expect(page.getByTestId('battle-voice')).toBeVisible();
  await expect(tour).toHaveCount(0);
});

// Review focus 3.
test('the muster stays usable under its tour: « Commencer la dictée » ends it, and it is seen', async ({ page, request }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const text = await createText(request, { title: uniqueName('Visite'), body: BODY, level: '10H' });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'muster');
  await expect(page.getByTestId('muster-tour')).toBeVisible();
  const owl = page.getByTestId('aid-toggle-athena');
  const pressed = await owl.getAttribute('aria-pressed');
  await tap(owl, testInfo);
  await expect(owl).not.toHaveAttribute('aria-pressed', pressed ?? '');
  await expect(page.getByTestId('btn-start')).toBeInViewport();
  await tap(page.getByTestId('btn-start'), testInfo);
  await expectBattle(page, 'dictation');
  await expect.poll(async () => (await (await request.get(`/api/profiles/${id}`)).json()).settings.tours ?? []).toContain('muster');
});

test('no muster tour on a resumed battle or on the grimoire', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const text = await createText(request, { title: uniqueName('Visite'), body: BODY, level: '10H' });
  await seedPlay(page, { profileId: id, textId: text.id, phase: 'dictation', draft: 'Les enfants' });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'muster');
  await expect(page.getByTestId('battle-resume')).toBeVisible();
  await expect(page.getByTestId('muster-tour')).toHaveCount(0);
  await page.goto(`/#/p/${id}/grimoire/${text.id}`);
  await expect(page.getByTestId('muster')).toBeVisible();
  await expect(page.getByTestId('muster-tour')).toHaveCount(0);
});
```

(`seedPlay`'s fields follow its `PlaySeed` type; if it needs more than these, give them as `scenes-audio.spec.ts` does. If the grimoire's route shows no muster until its text is corrupted, assert on what it shows first; the point is that no `muster-tour` appears.)

- [ ] **Step 8: Run the e2e**

Run: `STACK=prog scripts/playwright.sh scenes-muster-tour.spec.ts --repeat-each=3` ; `STACK=prog scripts/playwright.sh scenes-muster.spec.ts scenes-battle-play.spec.ts playability-ui5.spec.ts scenes-audio.spec.ts`
Expected: PASS on both projects (the muster's no-scroll specs run with the tours off, unchanged). A tours-on spec that now meets the muster's tour where it expected Éris's plate walks or skips the tour there.

- [ ] **Step 9: Commit**

```bash
git add web/src/components/battle/MusterTour.svelte web/src/components/battle/MusterPhase.svelte web/src/components/battle/PaceMedallions.svelte web/src/components/battle/AidToggles.svelte web/src/screens/Play.svelte web/src/lib/dialogue/types.ts web/src/lib/dialogue/content.ts web/src/lib/dialogue/content.test.ts web/src/lib/tours/tours.ts web/src/lib/tours/tours.test.ts content/dialogue/battle.json web/e2e/scenes-muster-tour.spec.ts
git commit -m "The first dictation muster has its own tour: the dragon explains the pace, the aids, leaving them at the camp for glory and the total on the plate of Éris's taunt, lighting each part; never a modal, never on a resume or the grimoire; starting the dictation ends it

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/components/battle/MusterTour.svelte web/src/components/battle/MusterPhase.svelte web/src/components/battle/PaceMedallions.svelte web/src/components/battle/AidToggles.svelte web/src/screens/Play.svelte web/src/lib/dialogue/types.ts web/src/lib/dialogue/content.ts web/src/lib/dialogue/content.test.ts web/src/lib/tours/tours.ts web/src/lib/tours/tours.test.ts content/dialogue/battle.json web/e2e/scenes-muster-tour.spec.ts
```

(add every spec Step 8 changed to both lists.)

---

### Task 4: Le guide du camp

**Files:**
- Create: `web/src/lib/world/guide.ts`, `web/src/lib/world/guide.test.ts`, `web/src/components/places/cabin/GuidePanel.svelte`, `web/e2e/scenes-guide.spec.ts`
- Modify: `web/src/testing/copyRules.ts`, `web/src/lib/rules.ts`, `web/src/lib/aids.ts`, `web/src/lib/world/places.ts`, `web/src/screens/CabinRoom.svelte`, `web/src/lib/world/scenes/cabin.ts`, `web/src/components/places/cabin/LyrePanel.svelte`
- Test: `web/src/lib/rules.test.ts`, `web/src/lib/aids.test.ts`, `web/src/lib/world/places.test.ts`, `web/src/lib/world/scenes/cabin.test.ts`

**Interfaces:**
- Consumes: `rulesOf`, `paceBonus` (`lib/rules.ts`); `AID_KEYS`, `AID_LABELS`, `aidDesc`, `listFr` (`lib/aids.ts`); `PACES`, `PACE_LABELS` (`lib/dictation/script.ts`); `stageXp`, `stageLabel` (`lib/world/dragon.ts`); `sealName`, `sealTitle`, `MAX_SEAL` (`lib/world/seals.ts`); `romanTier` (`lib/world/quests.ts`); `drachmesText` (`lib/world/shop.ts`); `plural`, `rateText`, `thousands` (`lib/text/french.ts`); `go`, `href`; Task 1's `WorldCatalog.level_xp`.
- Produces: `FOMO` (`web/src/testing/copyRules.ts`); `GameRules.drachmes`; `LEAVE_AFTER`, `TAKE_AFTER` (`lib/aids.ts`); `lib/world/guide.ts` `GuideSection`, `GuideBlock`, `guideSections(catalog)`; `PanelId` `guide`; `guideLine(d)` (`scenes/cabin.ts`); `GuidePanel.svelte`.

- [ ] **Step 1: Write the failing tests** — `web/src/lib/rules.test.ts`: `it('knows what pays drachmes, as the server's defaults (spec 2026-09-29 drachmes §1)', () => expect(DEFAULT_RULES.drachmes).toEqual({ xp_per_drachme: 10, board: 5, oracle: 15, weekly: 5, level: 10, boss: 30 }));`. `web/src/lib/aids.test.ts`: `it('suggests after three belles copies and two copies à reprendre (the guide reads the same numbers)', () => expect([LEAVE_AFTER, TAKE_AFTER]).toEqual([3, 2]));` (the suggestion tests stay as they are). `web/src/lib/world/places.test.ts`: `placeFor` of the `cabin` route with `{ panel: 'guide' }` is `{ place: 'cabin', panel: 'guide' }`, and `OVERLAY_TITLES.guide` is `'Le guide du camp'`. `web/src/lib/world/scenes/cabin.test.ts`: `expect(guideLine(dragon).text).toBe('Tout ce que je sais du camp est écrit ici. Relis-le quand tu veux.');` and the `lyreLine` expectation becomes `'Règle ici la musique, les bruitages et la voix qui te lit la dictée\u202f; les visites du camp et son guide t'attendent aussi.'` (add `guideLine(dragon)` to the loop over lines ≤ 160 characters).

`web/src/lib/world/guide.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES } from '../rules';
import { FOMO, GENDERED, GUILT, banned } from '../../testing/copyRules';
import { guideSections } from './guide';
import type { WorldCatalog } from './types';

const text = (catalog: WorldCatalog | null, id: string) => {
  const s = guideSections(catalog).find((x) => x.id === id)!;
  return s.blocks.map((b) => (b.kind === 'p' ? b.text : b.items.join('\n'))).join('\n');
};

// A rules file and a stall that differ from every default (review focus 4).
const ODD = {
  rules: {
    ...DEFAULT_RULES,
    aid_bonus: 0.3,
    prophecy_bonus: 0.4,
    pace_bonus: { '1': 0, '2': 0.1, '3': 0.2 },
    fight_max_per_100: 5,
    chouette_hints: 2,
    levels: [{ days: 2, chances: 10, correct: 0.8 }, ...DEFAULT_RULES.levels.slice(1)],
    fights: [{ level: 1, count: 3 }, { level: 1, count: 'all' }],
    drachmes: { xp_per_drachme: 8, board: 6, oracle: 16, weekly: 7, level: 11, boss: 33 },
  },
  stages: [
    { key: 'egg', name: 'Œuf', xp: 0 },
    { key: 'hatchling', name: 'Dragonnet', xp: 50 },
    { key: 'young', name: 'Jeune dragon', xp: 1000 },
    { key: 'adult', name: 'Dragon adulte', xp: 4000 },
    { key: 'illustre', name: 'Dragon illustre', xp: 12000 },
    { key: 'ancestral', name: 'Dragon ancestral', xp: 30000 },
  ],
  quest_bonus: { board: 70, oracle: 160, boss: 310, weekly: 45 },
  level_xp: 120,
  boss_rewards: { '1': 'sandales_hermes' },
  rewards: { sandales_hermes: { id: 'sandales_hermes', kind: 'gear', name: "Sandales d'Hermès", desc: '', source: '' } },
  shop: {
    slots: ['cou', 'queue', 'dos', 'tete'],
    slot_levels: { cou: 2, queue: 3, dos: 4, tete: 5 },
    draw_order: ['queue', 'dos', 'cou', 'tete'],
    accessories: [
      { id: 'accessory:hydre-cou', item: 'hydre-cou', lieutenant: 'hydre', slot: 'cou', level: 2, price: 45, the: '' },
      { id: 'accessory:hydre-queue', item: 'hydre-queue', lieutenant: 'hydre', slot: 'queue', level: 3, price: 65, the: '' },
      { id: 'accessory:hydre-dos', item: 'hydre-dos', lieutenant: 'hydre', slot: 'dos', level: 4, price: 95, the: '' },
      { id: 'accessory:hydre-tete', item: 'hydre-tete', lieutenant: 'hydre', slot: 'tete', level: 5, price: 135, the: '' },
    ],
    decor: [{ id: 'decor:amphore', price: 55, the: '' }],
    houses: [
      { id: 'house:villa', key: 'villa', stage: 'adult', after: null, price: 350, the: '' },
      { id: 'house:palais', key: 'palais', stage: 'illustre', after: 'house:villa', price: 900, the: '' },
    ],
    max_decor: { cabin: 5, villa: 7, palais: 10 },
  },
} as unknown as WorldCatalog;

describe('le guide du camp (spec 2026-09-29 explanations §3)', () => {
  it('has five sections in order, in the dragon\'s words', () => {
    expect(guideSections(null).map((s) => [s.id, s.title])).toEqual([
      ['gloire', 'La gloire et ton dragon'],
      ['sceaux', 'Les sceaux'],
      ['drachmes', 'Les drachmes'],
      ['aides', 'Les aides'],
      ['eris', 'Les combats contre Éris'],
    ]);
  });

  it('says the defaults until the catalogue has come', () => {
    expect(text(null, 'gloire')).toContain('Dragonnet\u202f: 100 XP');
    expect(text(null, 'gloire')).toContain('Dragon ancestral\u202f: 40\u202f000 XP');
    expect(text(null, 'sceaux')).toContain('Sceau de bois\u202f: 3 jours de garde, 12 pièges, 85\u202f% déjoués');
    expect(text(null, 'drachmes')).toContain('Pour le cou, au sceau de bronze\u202f: 40 drachmes');
    expect(text(null, 'aides')).toContain('20\u202f% de gloire');
    expect(text(null, 'eris')).toContain("Combat X\u202f: tous les lieutenants au sceau d'orichalque");
  });

  // Review focus 4: every number follows what the server serves.
  it('reads every number from the served catalogue', () => {
    const g = text(ODD, 'gloire');
    expect(g).toContain('Dragonnet\u202f: 50 XP');
    expect(g).toContain('Dragon ancestral\u202f: 30\u202f000 XP');
    expect(g).toContain("70 XP pour une quête du mur, 160 pour une quête de l'Oracle, 45 pour l'objectif de la semaine");
    const s = text(ODD, 'sceaux');
    expect(s).toContain('Sceau de bois\u202f: 2 jours de garde, 10 pièges, 80\u202f% déjoués');
    expect(s).toContain("120 XP pour le sceau de bois, 240 pour le bronze, et ainsi de suite jusqu'à 600 pour l'orichalque");
    const d = text(ODD, 'drachmes');
    expect(d).toContain('une pour 8 XP gagnés');
    expect(d).toContain('Une quête du mur\u202f: 6 drachmes');
    expect(d).toContain("Un sceau\u202f: 11 drachmes pour le bois, jusqu'à 55 drachmes pour l'orichalque");
    expect(d).toContain('Un combat gagné contre Éris\u202f: 33 drachmes');
    expect(d).toContain('Pour le cou, au sceau de bronze\u202f: 45 drachmes');
    expect(d).toContain("Pour la tête, au sceau d'orichalque\u202f: 135 drachmes");
    expect(d).toContain('Le décor coûte 55 drachmes la pièce');
    expect(d).toContain('La villa, 350 drachmes');
    expect(d).toContain('le palais, 900 drachmes');
    expect(d).toContain('5 pièces dans la cabane, 7 dans la villa, 10 dans le palais');
    const a = text(ODD, 'aides');
    expect(a).toContain('30\u202f% de gloire');
    expect(a).toContain('10\u202f% au rythme \u00ab\u202fPar groupes\u202f\u00bb et 20\u202f% au rythme \u00ab\u202fD\'un bon pas\u202f\u00bb');
    expect(a).toContain('ajoute 40\u202f%');
    expect(a).toContain('2 indices pour repérer un piège');
    const e = text(ODD, 'eris');
    expect(e).toContain('Combat I\u202f: trois lieutenants au sceau de bois');
    expect(e).toContain('Combat II\u202f: tous les lieutenants au sceau de bois');
    expect(e).not.toContain('Combat III');
    expect(e).toContain('5 fautes au plus pour 100 mots');
    expect(e).toContain('310 XP et 33 drachmes');
    expect(e).toContain("La première apporte aussi une arme des dieux\u202f: Sandales d'Hermès.");
  });

  it('speaks the camp, never the school, never guilt or pressure, in French typography', () => {
    for (const catalog of [null, ODD]) {
      for (const s of guideSections(catalog)) {
        for (const b of s.blocks) {
          for (const t of b.kind === 'p' ? [b.text] : b.items) {
            expect(banned(t), t).toEqual([]);
            expect(t.match(GUILT), t).toBeNull();
            expect(t, t).not.toMatch(GENDERED);
            expect(t, t).not.toMatch(FOMO);
            expect(t, t).not.toMatch(/ [:;!?%»]|« /);
          }
        }
      }
    }
  });
});
```

(`FOMO` is this task's addition to `web/src/testing/copyRules.ts`, Step 3; Task 5 applies it to the content and the how-to-earn lines.)

- [ ] **Step 2: Run them to see them fail**

Run: `scripts/npm.sh run test -- src/lib/world/guide.test.ts src/lib/rules.test.ts src/lib/aids.test.ts src/lib/world/places.test.ts src/lib/world/scenes/cabin.test.ts`
Expected: FAIL (`./guide` missing, no `drachmes` in the rules, no `LEAVE_AFTER`).

- [ ] **Step 3: The pressure rule, the rules and the aids** — `web/src/testing/copyRules.ts`, after `GUILT`:

```ts
/** Spec 2026-09-29 explanations §4, drachmes §2 (plan R14): nothing hurries the player. No countdown, no
 *  scarcity, no last chance. (« vite » alone is no pressure: « Le camp apprend vite. ») */
export const FOMO = /(?<!\p{L})(derni[eè]re chance|trop tard|compte à rebours|dépêche|plus que \d|ne reste (?:plus )?que \d|avant qu'il ne soit|bientôt fini)/iu;
```

`web/src/lib/rules.ts`, `GameRules` gains

```ts
  /** Spec 2026-09-29 drachmes §1: what pays drachmes (the guide says it; the server pays them). */
  drachmes: { xp_per_drachme: number; board: number; oracle: number; weekly: number; level: number; boss: number };
```

and `DEFAULT_RULES` `drachmes: { xp_per_drachme: 10, board: 5, oracle: 15, weekly: 5, level: 10, boss: 30 },`. `web/src/lib/aids.ts`: above `suggestion`,

```ts
/** Spec §3: « belles copies » in a row before leaving an aid is suggested, « copies à reprendre » before
 *  taking one back (the guide says the same numbers). */
export const LEAVE_AFTER = 3;
export const TAKE_AFTER = 2;
```

and in `suggestion` `dictations.slice(0, 3)` / `run.length === 3` become `LEAVE_AFTER`, `dictations.slice(0, 2)` / `last2.length === 2` become `TAKE_AFTER`.

- [ ] **Step 4: The guide** — `web/src/lib/world/guide.ts`:

```ts
// Le guide du camp (spec 2026-09-29 explanations §3, plan R12): five short sections in the dragon's
// voice, reread from the lyre. Every number comes from what the server serves (`/api/world`: the rules
// file's values, the stages, the stall, the quest bonuses, a seal's XP, the fights' gear), so the guide
// never drifts from data/regles.json; the defaults below only speak until the catalogue has come. Pure.
import { AID_KEYS, AID_LABELS, LEAVE_AFTER, TAKE_AFTER, aidDesc, listFr } from '../aids';
import { PACES, PACE_LABELS } from '../dictation/script';
import { paceBonus, rulesOf } from '../rules';
import { plural, rateText, thousands } from '../text/french';
import { stageLabel, stageXp } from './dragon';
import { romanTier } from './quests';
import { MAX_SEAL, sealName, sealTitle } from './seals';
import { drachmesText } from './shop';
import { DRAGON_STAGES, type DragonStage, type House, type Slot, type WorldCatalog } from './types';

export type GuideBlock = { kind: 'p'; text: string } | { kind: 'list'; items: string[] };
export interface GuideSection {
  id: 'gloire' | 'sceaux' | 'drachmes' | 'aides' | 'eris';
  title: string;
  blocks: GuideBlock[];
}

// The server's defaults (catalog.py QUEST_BONUS, seals.py LEVEL_XP, shop.py prices), until /api/world has come.
const QUEST_BONUS = { board: 60, oracle: 150, weekly: 40, boss: 300 };
const LEVEL_XP = 100;
const SLOT_ORDER: Slot[] = ['cou', 'queue', 'dos', 'tete'];
const SLOT_LEVEL: Record<Slot, number> = { cou: 2, queue: 3, dos: 4, tete: 5 };
const SLOT_PRICE: Record<Slot, number> = { cou: 40, queue: 60, dos: 90, tete: 130 };
const SLOT_WHERE: Record<Slot, string> = { cou: 'le cou', queue: 'la queue', dos: 'le dos', tete: 'la tête' };
const HOUSES = { villa: { stage: 'adult' as DragonStage, price: 300 }, palais: { stage: 'illustre' as DragonStage, price: 800 } };
const WALLS: Record<House, number> = { cabin: 4, villa: 6, palais: 9 };
const DECOR_PRICE = 50;

const WORDS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six'];
const count = (n: number, feminine = false) => (n === 1 && feminine ? 'une' : n < WORDS.length ? WORDS[n] : String(n));
const p = (text: string): GuideBlock => ({ kind: 'p', text });
const list = (items: string[]): GuideBlock => ({ kind: 'list', items });
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const quoted = (s: string) => `\u00ab\u202f${s}\u202f\u00bb`;
/** « adulte », « illustre »: what the dragon is when a house goes on sale. */
const grown = (s: DragonStage) => lowerFirst(stageLabel(s).replace(/^Dragon /, ''));

export function guideSections(catalog: WorldCatalog | null): GuideSection[] {
  const r = rulesOf(catalog);
  const xp = stageXp(catalog);
  const qb = { ...QUEST_BONUS, ...(catalog?.quest_bonus ?? {}) };
  const lx = catalog?.level_xp ?? LEVEL_XP;
  const d = r.drachmes;
  const shop = catalog?.shop ?? null;
  const slotLevel = (s: Slot) => shop?.slot_levels[s] ?? SLOT_LEVEL[s];
  const slotPrice = (s: Slot) => shop?.accessories.find((a) => a.slot === s)?.price ?? SLOT_PRICE[s];
  const house = (k: 'villa' | 'palais') => {
    const h = shop?.houses.find((x) => x.key === k);
    return { stage: h?.stage ?? HOUSES[k].stage, price: h?.price ?? HOUSES[k].price };
  };
  const villa = house('villa');
  const palais = house('palais');
  const walls = shop?.max_decor ?? WALLS;
  const decor = shop?.decor[0]?.price ?? DECOR_PRICE;
  const paces = PACES.map((pace) => ({ pace, bonus: paceBonus(pace, 'dictation', r) })).filter((x) => x.bonus > 0);
  const gear = Object.keys(catalog?.boss_rewards ?? {})
    .sort((a, b) => Number(a) - Number(b))
    .map((tier) => catalog?.rewards[catalog.boss_rewards[tier]]?.name)
    .filter((n): n is string => !!n);

  return [
    {
      id: 'gloire',
      title: 'La gloire et ton dragon',
      blocks: [
        p("Chaque texte défendu te rapporte de la gloire\u202f: un peu pour l'effort, davantage pour une copie soignée, et encore un peu pour chaque piège déjoué en relisant. Ta jauge, en haut de l'écran, la compte en XP."),
        p('La gloire ne se dépense jamais\u202f: elle me fait grandir, et je ne rapetisse jamais. Voici mes étapes\u202f:'),
        list(DRAGON_STAGES.filter((s) => s !== 'egg').map((s) => `${stageLabel(s)}\u202f: ${thousands(xp[s])} XP`)),
        p(`De la gloire en plus\u202f: ${qb.board} XP pour une quête du mur, ${qb.oracle} pour une quête de l'Oracle, ${qb.weekly} pour l'objectif de la semaine.`),
      ],
    },
    {
      id: 'sceaux',
      title: 'Les sceaux',
      blocks: [
        p("Chaque lieutenant d'Éris a cinq sceaux à gagner, un par métal\u202f: bois, bronze, argent, or et orichalque."),
        p("Un sceau se gagne sur plusieurs jours de garde, en défendant des textes où le lieutenant se cache\u202f: il faut assez de jours, assez de pièges croisés, et une bonne part de pièges déjoués dans ta copie finale."),
        list(r.levels.map((n, i) => `${sealTitle(i + 1)}\u202f: ${plural(n.days, 'jour', 'jours')} de garde, ${plural(n.chances, 'piège', 'pièges')}, ${rateText(n.correct)} déjoués`)),
        p('Seuls comptent les jours qui suivent le sceau précédent\u202f: chaque sceau demande de nouveaux textes. Un sceau gagné ne se perd jamais.'),
        p(`Chaque sceau rapporte de la gloire\u202f: ${lx} XP pour le sceau de bois, ${2 * lx} pour le bronze, et ainsi de suite jusqu'à ${MAX_SEAL * lx} pour l'orichalque. Il pose aussi un trophée sur l'étagère de ta cabane.`),
        p('Sous la tente de guerre, trois jauges te montrent où tu en es avec chaque lieutenant.'),
      ],
    },
    {
      id: 'drachmes',
      title: 'Les drachmes',
      blocks: [
        p(`Les drachmes, elles, se dépensent. Chaque texte t'en rapporte une pour ${d.xp_per_drachme} XP gagnés, et d'autres s'y ajoutent\u202f:`),
        list([
          `Une quête du mur\u202f: ${drachmesText(d.board)}`,
          `Une quête de l'Oracle\u202f: ${drachmesText(d.oracle)}`,
          `L'objectif de la semaine\u202f: ${drachmesText(d.weekly)}`,
          `Un sceau\u202f: ${drachmesText(d.level)} pour le bois, jusqu'à ${drachmesText(MAX_SEAL * d.level)} pour l'orichalque`,
          `Un combat gagné contre Éris\u202f: ${drachmesText(d.boss)}`,
        ]),
        p("Hermès les échange à son étal, dans le camp. Ce qu'il vend dépend de toi\u202f: chaque sceau d'un lieutenant, à partir du bronze, met en vente une de ses parures."),
        list(SLOT_ORDER.map((s) => `Pour ${SLOT_WHERE[s]}, au ${sealName(slotLevel(s))}\u202f: ${drachmesText(slotPrice(s))}`)),
        p(
          `Le décor coûte ${drachmesText(decor)} la pièce. La villa, ${drachmesText(villa.price)}, est en vente quand je suis ${grown(villa.stage)}\u202f; le palais, ${drachmesText(palais.price)}, quand je suis ${grown(palais.stage)}, après la villa. Plus la maison est grande, plus ses murs portent de décor\u202f: ${walls.cabin} pièces dans la cabane, ${walls.villa} dans la villa, ${walls.palais} dans le palais.`,
        ),
        p('Hermès ne presse personne\u202f: ses prix ne bougent pas, et rien ne quitte son étal.'),
      ],
    },
    {
      id: 'aides',
      title: 'Les aides',
      blocks: [
        p('Avant chaque dictée, tu choisis les aides que tu emportes pour relire\u202f:'),
        list(AID_KEYS.map((k) => `${AID_LABELS[k].name}\u202f: ${lowerFirst(aidDesc(k, r))}`)),
        p(
          [
            `Chaque aide laissée au camp ajoute ${rateText(r.aid_bonus)} de gloire.`,
            paces.length ? `Le rythme en ajoute aussi\u202f: ${listFr(paces.map((x) => `${rateText(x.bonus)} au rythme ${quoted(PACE_LABELS[x.pace].title)}`))}.` : '',
            `Un texte prophétisé, défendu avant son jour, ajoute ${rateText(r.prophecy_bonus)}.`,
          ]
            .filter(Boolean)
            .join(' '),
        ),
        p("Ce bonus s'ajoute à la gloire de ta copie et de tes pièges déjoués, pas à celle de l'effort\u202f: il compte surtout quand ta copie est soignée."),
        p(
          `Tu décides toujours. Après ${count(LEAVE_AFTER, true)} ${LEAVE_AFTER < 2 ? 'belle copie' : 'belles copies'} de suite avec les mêmes aides, je te proposerai d'en laisser une au camp\u202f; après ${count(TAKE_AFTER, true)} ${TAKE_AFTER < 2 ? 'copie à reprendre' : 'copies à reprendre'}, d'en reprendre une. Tu peux toujours dire non.`,
        ),
      ],
    },
    {
      id: 'eris',
      title: 'Les combats contre Éris',
      blocks: [
        p("Éris revient se battre quand assez de sceaux sont posés sur ses lieutenants. Chaque combat s'ouvre après la victoire du précédent\u202f:"),
        list(
          r.fights.map((f, i) => {
            const who = f.count === 'all' ? 'tous les lieutenants' : f.count === 1 ? 'un lieutenant' : `${count(f.count)} lieutenants`;
            return `Combat ${romanTier(i + 1)}\u202f: ${who} au ${sealName(f.level)}`;
          }),
        ),
        p(`Pour la faire fuir, ta copie doit garder ${plural(r.fight_max_per_100, 'faute', 'fautes')} au plus pour 100 mots. Sinon, tu pourras revenir l'affronter quand tu voudras.`),
        p(
          [
            `Chaque victoire rapporte ${qb.boss} XP et ${drachmesText(d.boss)}.`,
            gear.length === 1 ? `La première apporte aussi une arme des dieux\u202f: ${gear[0]}.` : '',
            gear.length > 1 ? `Les ${count(gear.length, true)} premières apportent aussi une arme des dieux\u202f: ${listFr(gear)}.` : '',
          ]
            .filter(Boolean)
            .join(' '),
        ),
        p('Un combat gagné le reste pour toujours.'),
      ],
    },
  ];
}
```

(`rateText` already writes « 20 % » with U+202F. If `sealName` of sub-project 2 takes its level differently, follow it. If `listFr` joins with « et » and a comma, the pace sentence reads « 25 % au rythme « Par groupes » et 50 % au rythme « D'un bon pas » ».)

- [ ] **Step 5: The panel, the route, the lyre** — `web/src/lib/world/places.ts`: `PanelId` gains `| 'guide'`; `OVERLAY_TITLES` gains `guide: 'Le guide du camp',`; in `placeFor`, the `cabin` case accepts `p === 'guide'` next to `'tresors'` and `'heros'`. `web/src/lib/world/scenes/cabin.ts`:

```ts
/** The guide's plate (spec 2026-09-29 explanations §3). */
export function guideLine(d: DragonOut): DialogueLine {
  return dragonSays(d, 'Tout ce que je sais du camp est écrit ici. Relis-le quand tu veux.');
}
```

and `lyreLine`'s text becomes `'Règle ici la musique, les bruitages et la voix qui te lit la dictée\u202f; les visites du camp et son guide t'attendent aussi.'`.

`web/src/components/places/cabin/GuidePanel.svelte`:

```svelte
<script lang="ts">
  // Le guide du camp (spec 2026-09-29 explanations §3, plan R12): five sections in the dragon's voice,
  // rebuilt from the catalogue the server serves (lib/world/guide.ts), so its numbers follow
  // data/regles.json.
  import { campStore } from '../../../lib/world/campStore.svelte';
  import { guideSections } from '../../../lib/world/guide';

  const sections = $derived(guideSections(campStore.catalog));
</script>

<div class="panel-guide" data-testid="guide">
  {#each sections as s (s.id)}
    <section data-testid="guide-{s.id}">
      <h3 class="kit-section">{s.title}</h3>
      {#each s.blocks as b, i (i)}
        {#if b.kind === 'p'}
          <p>{b.text}</p>
        {:else}
          <ul>
            {#each b.items as item (item)}<li>{item}</li>{/each}
          </ul>
        {/if}
      {/each}
    </section>
  {/each}
</div>

<style>
  .panel-guide section + section {
    margin-top: 18px;
  }
  .panel-guide p {
    margin: 8px 0 0;
  }
  .panel-guide ul {
    margin: 8px 0 0;
    padding-left: 22px;
  }
  .panel-guide li + li {
    margin-top: 4px;
  }
</style>
```

`web/src/screens/CabinRoom.svelte`: import `GuidePanel` and `guideLine`; before `{:else if panel === 'heros'}`:

```svelte
{:else if panel === 'guide'}
  <!-- Spec 2026-09-29 explanations §3 (R12): opened from the lyre, its seal steps back there. -->
  <Overlay variant="codex" title={OVERLAY_TITLES.guide} testId="overlay-guide" voice={dragon ? guideLine(dragon) : null} onClose={close} returnFocus={hotspotSelector('cabin', 'lyre')}>
    <GuidePanel />
  </Overlay>
```

`web/src/components/places/cabin/LyrePanel.svelte`: import `go` from `'../../../lib/scene/panelNav'` and `href` from `'../../../lib/routes'`; inside the `.apart` section, after the tours' button:

```svelte
      <h3 class="kit-section guide-title">Le guide du camp</h3>
      <!-- Spec 2026-09-29 explanations §3 (R12): the guide opens as the cabin's panel; its seal steps back here. -->
      <button
        type="button"
        class="kit-link"
        data-testid="lyre-guide"
        onclick={() => go(href('cabin', { profileId: String(profile.id) }, { panel: 'guide' }), 'panel')}>Lire le guide du camp</button
      >
```

and CSS `.guide-title { margin-top: 14px; }`. The header comment's list gains « le guide du camp ».

- [ ] **Step 6: Run the unit tests and the check**

Run: `scripts/npm.sh run test -- src/lib/world src/lib/rules.test.ts src/lib/aids.test.ts src/placesKit.test.ts src/noEmoji.test.ts src/registerGuard.test.ts src/noGuilt.test.ts src/frenchSpacing.test.ts src/formPlural.test.ts` ; `scripts/npm.sh run check`
Expected: PASS; `0 errors and 0 warnings`, tsc silent.

- [ ] **Step 7: The e2e** — `web/e2e/scenes-guide.spec.ts`:

```ts
import { test, expect } from './crashGuard';
import { createProfileApi, heroNamer, tap } from './helpers';

// Spec 2026-09-29 explanations §3, §5 (plan R12).
const heroName = heroNamer('Guide');
const TITLES = ['La gloire et ton dragon', 'Les sceaux', 'Les drachmes', 'Les aides', 'Les combats contre Éris'];

test('the guide opens from the lyre, five sections, and its seal steps back to the lyre', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/settings`);
  const lyre = page.getByTestId('overlay-lyre');
  await expect(lyre).toBeVisible();
  await tap(lyre.getByTestId('lyre-guide'), testInfo);
  await expect(page).toHaveURL(/\/cabane\?panel=guide$/);
  const guide = page.getByTestId('overlay-guide');
  await expect(guide).toBeVisible();
  await expect(guide.locator('h3')).toHaveText(TITLES);
  await expect(guide.getByTestId('guide-aides')).toContainText('20\u202f% de gloire');
  await expect(guide.getByTestId('guide-gloire')).toContainText('Dragonnet\u202f: 100 XP');
  await guide.getByTestId('overlay-close').click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(lyre).toBeVisible();
});

// Review focus 4: the numbers are the server's.
test('the guide reads the rules the server serves', async ({ page, request }, testInfo) => {
  await page.route('**/api/world', async (route) => {
    const world = await (await route.fetch()).json();
    world.rules.aid_bonus = 0.3;
    world.rules.fights[0] = { level: 1, count: 3 };
    await route.fulfill({ json: world });
  });
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/cabane?panel=guide`);
  const guide = page.getByTestId('overlay-guide');
  await expect(guide.getByTestId('guide-aides')).toContainText('30\u202f% de gloire');
  await expect(guide.getByTestId('guide-eris')).toContainText('Combat I\u202f: trois lieutenants au sceau de bois');
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});
```

- [ ] **Step 8: Run the e2e**

Run: `STACK=prog scripts/playwright.sh scenes-guide.spec.ts --repeat-each=3` ; `STACK=prog scripts/playwright.sh scenes-cabin.spec.ts scenes-overlays.spec.ts`
Expected: PASS on both projects.

- [ ] **Step 9: Commit**

```bash
git add web/src/lib/world/guide.ts web/src/lib/world/guide.test.ts web/src/components/places/cabin/GuidePanel.svelte web/src/lib/rules.ts web/src/lib/rules.test.ts web/src/lib/aids.ts web/src/lib/aids.test.ts web/src/lib/world/places.ts web/src/lib/world/places.test.ts web/src/screens/CabinRoom.svelte web/src/lib/world/scenes/cabin.ts web/src/lib/world/scenes/cabin.test.ts web/src/components/places/cabin/LyrePanel.svelte web/src/testing/copyRules.ts web/e2e/scenes-guide.spec.ts
git commit -m "Le guide du camp: five sections in the dragon's voice (glory and the stages, the seals, the drachmes, the aids, Éris's fights), every number from what /api/world serves, opened from the lyre as the cabin's panel

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/lib/world/guide.ts web/src/lib/world/guide.test.ts web/src/components/places/cabin/GuidePanel.svelte web/src/lib/rules.ts web/src/lib/rules.test.ts web/src/lib/aids.ts web/src/lib/aids.test.ts web/src/lib/world/places.ts web/src/lib/world/places.test.ts web/src/screens/CabinRoom.svelte web/src/lib/world/scenes/cabin.ts web/src/lib/world/scenes/cabin.test.ts web/src/components/places/cabin/LyrePanel.svelte web/src/testing/copyRules.ts web/e2e/scenes-guide.spec.ts
```

---

### Task 5: How to earn it

**Files:**
- Modify: `web/src/lib/world/seals.ts`, `web/src/lib/world/rewards.ts`, `web/src/components/places/cabin/TrophiesPanel.svelte`, `web/src/lib/dialogue/content.test.ts`
- Test: `web/src/lib/world/seals.test.ts`, `web/src/lib/world/rewards.test.ts`, `web/e2e/scenes-cabin.spec.ts`

**Interfaces:**
- Consumes: `howToWin`, `HOW_TO_WIN_IDS`; `sealName`, `MAX_SEAL`, `highestTrophies`; `lockedAccessoryLine`, `houseLockedLine`; `trophyIcon`; `isAwake`, `lieutenantName`, `sleepingLine`; `campFor`, `campStore`.
- Consumes also: Task 4's `FOMO` (`web/src/testing/copyRules.ts`).
- Produces: `sealHowLine(key, level)`, `sealNeedLine(need)` (`firstSealLine` removed); `nextFightTier(camp)`, `howToEarn(id, source, {nextTier, catalog})` (`lib/world/rewards.ts`); the shelf's buttons and « Encore à gagner ».

- [ ] **Step 1: Write the failing tests** — `web/src/lib/world/seals.test.ts`: the `firstSealLine` expectations go; add `sealHowLine, sealNeedLine` to the import and:

```ts
  // Spec 2026-09-29 explanations §4 (R13): how each trophy is won, in words, agreed with its lieutenant.
  it('says how each trophy is won, and what the first seal asks', () => {
    expect(sealHowLine('hydre', 1)).toBe("Premier sceau\u202f: défends des textes où l'Hydre se cache.");
    expect(sealHowLine('sirenes', 3)).toBe("Au sceau d'argent\u202f: défends encore des textes où les Sirènes se cachent.");
    expect(sealHowLine('protee', 5)).toBe("Au sceau d'orichalque\u202f: défends encore des textes où Protée se cache.");
    expect(sealNeedLine({ days: 3, chances: 12, correct: 0.85 })).toBe('3 jours de garde et 12 pièges, dont 85\u202f% déjoués.');
    expect(sealNeedLine({ days: 1, chances: 1, correct: 0.9 })).toBe('1 jour de garde et 1 piège, dont 90\u202f% déjoués.');
  });
```

`web/src/lib/world/rewards.test.ts` (imports: `howToEarn`, `nextFightTier`, `HOW_TO_WIN_IDS` from `./rewards`; `sealHowLine` from `./seals`; `houseLockedLine`, `lockedAccessoryLine` from `./shop`; `LIEUTENANT_ORDER`, `type CampResponse`, `type ShopCatalog`, `type WorldCatalog` from `./types`; `FOMO`, `GUILT`, `banned` from `'../../testing/copyRules'`):

```ts
describe('every thing not owned says how to earn it (spec 2026-09-29 explanations §4)', () => {
  const catalog = { boss_rewards: { '1': 'sandales_hermes', '2': 'egide', '3': 'foudre_zeus' } } as unknown as WorldCatalog;
  const VILLA = { id: 'house:villa', key: 'villa', stage: 'adult', after: null, price: 300, the: 'la villa' } as ShopCatalog['houses'][number];
  const PALAIS = { id: 'house:palais', key: 'palais', stage: 'illustre', after: 'house:villa', price: 800, the: 'le palais' } as ShopCatalog['houses'][number];

  it('names the next fight to win on the ladder', () => {
    const boss = (tiers_won: number[]) => ({ boss: { tier_available: null, tiers_won, active_quest_id: null, fights: 10, next: null } }) as unknown as CampResponse;
    expect(nextFightTier(boss([]))).toBe(1);
    expect(nextFightTier(boss([1, 2]))).toBe(3);
    expect(nextFightTier(boss([2]))).toBe(1);
    expect(nextFightTier(boss([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))).toBeNull();
    expect(nextFightTier(null)).toBeNull();
  });

  it("says the next fight's gear, agreed, and keeps the later ones' sentences", () => {
    expect(howToEarn('sandales_hermes', '', { nextTier: 1, catalog })).toBe('Gagne le prochain combat contre Éris pour les gagner.');
    expect(howToEarn('egide', '', { nextTier: 2, catalog })).toBe('Gagne le prochain combat contre Éris pour la gagner.');
    expect(howToEarn('foudre_zeus', '', { nextTier: 3, catalog })).toBe('Gagne le prochain combat contre Éris pour la gagner.');
    expect(howToEarn('egide', '', { nextTier: 1, catalog })).toBe('Bats Éris une deuxième fois pour la gagner.');
    expect(howToEarn('tint:jade', '', { nextTier: null, catalog: null })).toBe("Gagne-la dans une quête de l'Oracle.");
  });

  // Review focus 5.
  it('has a sentence for every locked kind, never the fallback, never pressure', () => {
    const lines: [string, string][] = [
      ...LIEUTENANT_ORDER.flatMap((k) => [1, 2, 3, 4, 5].map((l) => [`trophy:${k}:${l}`, sealHowLine(k, l)] as [string, string])),
      ...HOW_TO_WIN_IDS.flatMap((id) => [1, 2, 3].map((t) => [`${id} (fight ${t})`, howToEarn(id, '', { nextTier: t, catalog })] as [string, string])),
      ...LIEUTENANT_ORDER.flatMap((k) => [2, 3, 4, 5].map((l) => [`accessory:${k}:${l}`, lockedAccessoryLine(k, l)] as [string, string])),
      ['house:villa', houseLockedLine(VILLA, 'young', new Set())],
      ['house:palais', houseLockedLine(PALAIS, 'adult', new Set(['house:villa']))],
    ];
    for (const [where, text] of lines) {
      expect(text, where).not.toMatch(/^À gagner/);
      expect(banned(text), where).toEqual([]);
      expect(text.match(GUILT), where).toBeNull();
      expect(text, where).not.toMatch(FOMO);
    }
    // Every kind of the shelf and the stall is there: trophies, tints, gear, decor, accessories, houses.
    const kinds = new Set(lines.map(([where]) => where.split(':')[0].split(' ')[0]));
    for (const k of ['trophy', 'tint', 'accessory', 'house', 'decor', 'sandales_hermes', 'egide', 'foudre_zeus']) expect([...kinds].some((x) => x.startsWith(k)), k).toBe(true);
  });
});
```

`web/src/lib/dialogue/content.test.ts`, in `'speaks the camp, never the school…'`: add `expect(line.text, where).not.toMatch(FOMO);` (import `FOMO`) and a self-test next to it: `expect('Plus que 3 jours !').toMatch(FOMO); expect('Dernière chance').toMatch(FOMO); expect("Il ne te reste qu'à déjouer 88 % des pièges").not.toMatch(FOMO); expect('Le camp apprend vite.').not.toMatch(FOMO);`.

- [ ] **Step 2: Run them to see them fail**

Run: `scripts/npm.sh run test -- src/lib/world/seals.test.ts src/lib/world/rewards.test.ts src/lib/dialogue/content.test.ts`
Expected: FAIL (`sealHowLine`, `howToEarn`, `nextFightTier` undefined).

- [ ] **Step 3: The words** — `web/src/lib/world/seals.ts`: delete `firstSealLine` (grep its callers: the shelf, Step 4); add

```ts
const HIDES: Record<LieutenantKey, string> = {
  hydre: "où l'Hydre se cache",
  echo: 'où Écho se cache',
  chimere: 'où la Chimère se cache',
  protee: 'où Protée se cache',
  sirenes: 'où les Sirènes se cachent',
  lethe: 'où Léthé se cache',
};

/** How a trophy is won, in words (spec 2026-09-29 explanations §4, R13): the first seal, then each metal. */
export function sealHowLine(key: LieutenantKey, level: number): string {
  if (level <= 1) return `Premier sceau\u202f: défends des textes ${HIDES[key]}.`;
  return `Au ${sealName(level)}\u202f: défends encore des textes ${HIDES[key]}.`;
}

/** What a seal asks, from the rules (the empty plinth's second line). */
export function sealNeedLine(need: SealNeed): string {
  return `${plural(need.days, 'jour', 'jours')} de garde et ${plural(need.chances, 'piège', 'pièges')}, dont ${rateText(need.correct)} déjoués.`;
}
```

`web/src/lib/world/rewards.ts` (import `type CampResponse`):

```ts
// The divine gear agrees with its pronoun (les sandales, l'égide, la foudre).
const GEAR_THEM: Record<string, string> = { sandales_hermes: 'les', egide: 'la', foudre_zeus: 'la' };

/** The fight whose reward is the next to win (spec 2026-09-29 explanations §4, R13): the lowest tier of
 *  the ladder not won yet; null once every fight is won or without the camp. */
export function nextFightTier(camp: Pick<CampResponse, 'boss'> | null): number | null {
  if (!camp) return null;
  for (let t = 1; t <= camp.boss.fights; t++) if (!camp.boss.tiers_won.includes(t)) return t;
  return null;
}

/** How to earn a reward not owned yet (spec §4): the next fight's gear says so; the rest keeps its sentence. */
export function howToEarn(id: string, source: string, o: { nextTier: number | null; catalog: WorldCatalog | null }): string {
  const tier = Object.entries(o.catalog?.boss_rewards ?? {}).find(([, rid]) => rid === id)?.[0];
  if (tier !== undefined && o.nextTier !== null && Number(tier) === o.nextTier) {
    return `Gagne le prochain combat contre Éris pour ${GEAR_THEM[id] ?? 'le'} gagner.`;
  }
  return howToWin(id, source);
}
```

- [ ] **Step 4: The shelf** — `web/src/components/places/cabin/TrophiesPanel.svelte` (sub-project 2's trophy section and sub-project 4's props kept; this changes the plinths, the close view and the how-to line):
  - imports: `MAX_SEAL, highestTrophies, sealHowLine, sealNeedLine, sealTitle, sealTitleOf` from seals (no `firstSealLine`); `howToEarn, nextFightTier` from rewards (no `howToWin`); `campFor` with `campStore`;
  - script: SP2's `firstSeal` becomes `const firstNeed = $derived(sealNeedLine(rulesOf(campStore.catalog).levels[0]));` and add `const nextTier = $derived(nextFightTier(campFor(profile.id)));`;
  - each cubby's `<p class="trophy-how">{howToWin(item.id, item.source)}</p>` becomes `<p class="trophy-how">{howToEarn(item.id, item.source, { nextTier, catalog: campStore.catalog })}</p>`;
  - the plinths' list:

```svelte
      {#each LIEUTENANT_ORDER as key (key)}
        {@const top = highest[key] ?? 0}
        {@const awake = isAwake(key, profile.level)}
        <li class="kit-cubby trophy plinth" class:is-empty={top === 0} data-testid="cabin-trophy-{key}" data-level={top}>
          {#if awake || top > 0}
            <!-- Spec 2026-09-29 explanations §4 (R13): every plinth opens its close view, the empty one too:
                 the trophies still to win are shown there, never hidden. -->
            <button
              type="button"
              class="plinth-open"
              data-testid="cabin-trophy-open-{key}"
              aria-expanded={openKey === key}
              aria-controls="trophy-close-{key}"
              onclick={() => (openKey = openKey === key ? null : key)}
            >
              {#if top > 0}
                <img class="plinth-art" src={trophyIcon(key, top)} alt="" draggable="false" />
                <span class="trophy-name">{trophyName(key, top)}</span>
              {:else}
                <span class="plinth-empty" aria-hidden="true"></span>
                <span class="trophy-name">{lieutenantName(key)}</span>
              {/if}
            </button>
            {#if top > 0}
              <p class="trophy-desc">{sealTitle(top)}</p>
            {:else}
              <p class="trophy-how">{sealHowLine(key, 1)}</p>
              <p class="trophy-need">{firstNeed}</p>
            {/if}
          {:else}
            <span class="plinth-empty" aria-hidden="true"></span>
            <h4 class="trophy-name">{lieutenantName(key)}</h4>
            <p class="trophy-how">{sleepingLine(key, profile.level)}</p>
          {/if}
        </li>
      {/each}
```

  - the close view opens for any `openKey` (not only `top > 0`): the large picture, the name, the description and « Aussi sur l'étagère » stay as sub-project 2 wrote them but only `{#if top > 0}` (a lieutenant with no seal shows its name as the heading instead); after them, in `.close-words`:

```svelte
          {#if top < MAX_SEAL}
            <p class="lower-title">Encore à gagner</p>
            <ul class="lower to-win">
              {#each Array.from({ length: MAX_SEAL - top }, (_, i) => top + 1 + i) as level (level)}
                <li data-testid="cabin-trophy-towin-{key}-{level}">
                  <img class="silhouette" src={trophyIcon(key, level)} alt="" draggable="false" />
                  <span class="to-win-words"><span class="to-win-name">{trophyName(key, level)}</span><span class="to-win-how">{sealHowLine(key, level)}</span></span>
                </li>
              {/each}
            </ul>
          {/if}
```

  - CSS:

```css
  /* R13: a trophy still to win is its painted icon as a dark silhouette, never hidden. */
  .to-win .silhouette {
    width: 40px;
    height: 40px;
    object-fit: contain;
    filter: brightness(0) opacity(0.45);
  }
  .to-win-words {
    display: flex;
    flex-direction: column;
  }
  .to-win-how,
  .trophy-need {
    font-size: 14px;
    color: var(--ink-soft);
  }
```

(`openKey`'s type and the close view's `id`/`aria-controls` stay sub-project 2's. If `trophyIcon` returns `null` for a missing icon, the `img` gets no `src`, as sub-project 2's plinth already accepts.)

- [ ] **Step 5: Run the unit tests and the check**

Run: `scripts/npm.sh run test -- src/lib/world src/lib/dialogue src/placesKit.test.ts src/noEmoji.test.ts src/registerGuard.test.ts src/noGuilt.test.ts src/frenchSpacing.test.ts src/formPlural.test.ts` ; `scripts/npm.sh run check`
Expected: PASS; `0 errors and 0 warnings`, tsc silent. `grep -rn "firstSealLine" web/src web/e2e` prints nothing.

- [ ] **Step 6: The e2e** — `web/e2e/scenes-cabin.spec.ts` (sub-project 2's shelf tests that read the old « Premier sceau : 3 jours de garde… » line now read the two lines below); add:

```ts
// Spec 2026-09-29 explanations §4 (R13; review focus 5): nothing on the shelf is hidden, each thing says how.
test('the shelf says how to win every trophy, and the next fight names its gear', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.route(`**/api/profiles/${id}/rewards`, async (route) => {
    const list = await (await route.fetch()).json();
    const trophy = (level: number, material: string) => ({
      id: `trophy:hydre:${level}`, kind: 'trophy', name: `Écaille de l'Hydre en ${material}`, desc: '',
      source: "Sceau de l'Hydre", granted_at: '2026-09-20T12:00:00+00:00', equipped: false,
    });
    await route.fulfill({ json: [...list, trophy(1, 'bois'), trophy(2, 'bronze')] });
  });
  await page.goto(`/#/p/${id}/cabane?panel=tresors`);
  const shelf = page.getByTestId('overlay-trophies');
  await expect(shelf.getByTestId('cabin-trophy-echo')).toContainText(frenchSpacing("Premier sceau : défends des textes où Écho se cache."));
  await expect(shelf.getByTestId('cabin-trophy-echo')).toContainText('3 jours de garde et 12 pièges, dont 85\u202f% déjoués.');
  await tap(shelf.getByTestId('cabin-trophy-open-echo'), testInfo);
  for (const level of [1, 2, 3, 4, 5]) await expect(shelf.getByTestId(`cabin-trophy-towin-echo-${level}`)).toBeVisible();
  await tap(shelf.getByTestId('cabin-trophy-open-hydre'), testInfo);
  const close = shelf.getByTestId('cabin-trophy-close-hydre');
  await expect(close).toContainText("Aussi sur l'étagère");
  await expect(close.getByTestId('cabin-trophy-towin-hydre-2')).toHaveCount(0);
  await expect(close.getByTestId('cabin-trophy-towin-hydre-3')).toContainText(frenchSpacing("Au sceau d'argent : défends encore des textes où l'Hydre se cache."));
  await expect(shelf.getByTestId('cabin-reward-sandales_hermes')).toContainText('Gagne le prochain combat contre Éris pour les gagner.');
  await expect(shelf.getByTestId('cabin-reward-egide')).toContainText('Bats Éris une deuxième fois pour la gagner.');
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});
```

(import `frenchSpacing` from `'../src/lib/text/french'` if the file lacks it; `heroName` is the file's.)

- [ ] **Step 7: Run the e2e**

Run: `STACK=prog scripts/playwright.sh scenes-cabin.spec.ts --repeat-each=3` ; `STACK=prog scripts/playwright.sh scenes-house.spec.ts scenes-stall.spec.ts`
Expected: PASS on both projects.

- [ ] **Step 8: Commit**

```bash
git add web/src/lib/world/seals.ts web/src/lib/world/seals.test.ts web/src/lib/world/rewards.ts web/src/lib/world/rewards.test.ts web/src/components/places/cabin/TrophiesPanel.svelte web/src/lib/dialogue/content.test.ts web/e2e/scenes-cabin.spec.ts
git commit -m "Everything not owned says how to earn it: an empty plinth says where its lieutenant hides and what the first seal asks, every plinth opens a close view with the trophies still to win as silhouettes, the next fight names its gear; a FOMO rule keeps every line free of pressure

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/lib/world/seals.ts web/src/lib/world/seals.test.ts web/src/lib/world/rewards.ts web/src/lib/world/rewards.test.ts web/src/components/places/cabin/TrophiesPanel.svelte web/src/lib/dialogue/content.test.ts web/e2e/scenes-cabin.spec.ts
```

---

### Task 6: README and the full gate

**Files:**
- Modify: `README.md` (§8 World and progression)

**Interfaces:**
- Consumes: everything above.
- Produces: the documented explanations; a clean gate.

- [ ] **Step 1: The README** — §8, the first bullet's last sentence « The first visit to each place is a short tour by its character; « Refaire les visites du camp » in the lyre replays them. » becomes:

```markdown
  The first visit to each place is a short tour by its character, and the battle's muster has its
  own (the pace, the aids and what leaving them is worth); when a place gains something new, a hero
  who already saw its tour hears only the new steps, once (a version per tour in `settings.tours`,
  e.g. `"cabin:2"`). « Refaire les visites du camp » in the lyre replays them all, and « Le guide
  du camp » there explains glory and the dragon's stages, the seals, the drachmes, the aids and
  Éris's fights, with the numbers of `data/regles.json` as the server serves them.
```

After the camp's list of places add:

```markdown
- **What next.** At the camp, the dragon ends its greeting with the most useful next goal, first
  match wins: a name for a hatched dragon, a prophecy due within a week, an open fight against
  Éris, the first text, a lieutenant's seal within reach (its window at least 70 % complete and
  its share at target), the next stage (under a fifth of the way left), something affordable at
  Hermès's stall, the week's sealed scrolls, the weekly goal, otherwise a warm word.
- **How to earn it.** Nothing is hidden: every trophy, tint, gear, decor piece, accessory and
  house not owned says in words how to get it (an empty plinth says where its lieutenant hides and
  what the first seal asks; the trophies still to win show as silhouettes in the shelf's close
  view; the next fight names its gear). No countdown, no pressure.
```

- [ ] **Step 2: The full gate**

Run: `STACK=prog PW_WORKERS=4 scripts/check.sh`
Expected: `== ALL GREEN`; pytest, vitest and Playwright with no failure, `svelte-check` `0 errors and 0 warnings`, tsc silent, no warning in the vitest/pytest output. Paste the counts. Any failure, flake or warning is fixed here (root cause, in the owning file) or reported as an open item; never retried away.

- [ ] **Step 3: Final sweeps** (each must print nothing)

```bash
grep -rnE "nextStepKey|firstSealLine" web/src web/e2e
grep -rniE "derni[eè]re chance|trop tard|compte à rebours|dépêche" content/dialogue web/src --include=*.json --include=*.ts --include=*.svelte | grep -v "testing/copyRules.ts"
grep -rn "niveau" content/dialogue web/src/lib/world/guide.ts web/src/lib/world/nextStep.ts web/src/components/battle/MusterTour.svelte
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "README: the dragon's what-next line, the tours' new steps shown once to heroes who saw them before, the muster's tour, le guide du camp, and how to earn everything not owned

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- README.md
```

---

## Spec coverage (self-review)

| Spec | Task |
|---|---|
| §1 the line after the greeting, priority first match wins: name, Éris open, seal within reach (70 %, share at target), stage under 20 %, something affordable, weekly goal, generic | 1 (`whatNext`, R1-R6; `camp.affordable` on the server) |
| §1 ≥ 3 variants per case under `camp.next.<case>` in `camp.json`; the spec's lines used | 1 (content, `DOMAINS`; the Sirènes' own three lines, R3) |
| §1 a pure function of the camp state, unit-tested; never repeats the greeting's content | 1 (`nextStep.test.ts`, `campGreeting` test, R7) |
| §2 new steps: the muster (pace, aids, leaving them, total) | 3 |
| §2 new steps: the war tent (seals and materials, gauges), the stall (drachmes, what is on sale and why), the nest's parure, the cabin (house and upgrades, trophy shelf) | 2 (R10; the war tour's portraits line on the five materials is sub-project 2's) |
| §2 a seen tour re-shown once for its new steps only; a per-tour content version in `settings.tours`; every tour replayable from the lyre | 2 (R8, R9), 3 (the muster's tour is reset with the others) |
| §3 the guide in the cabin, a new entry on the lyre, five sections in the dragon's voice, numbers from the served rules | 4 (R12; `level_xp` served in 1) |
| §4 empty plinths, locked tints, stall items, house upgrades, gear (next fight), decor; nothing hidden, no countdown or guilt | 5 (R13, R14); stall items and houses from sub-project 4, pinned in 5's test |
| §5 tests: priority (every case, ties); content (variants, register, guilt, emoji, typography); tours' new steps and re-show; guide's numbers from served rules; how-to-earn per locked kind | 1, 2, 3, 4, 5 |
| §5 e2e: each what-next case from seeded state; a tour re-shown for new steps; the guide from the lyre; full gate | 1, 2, 4, 6 |
