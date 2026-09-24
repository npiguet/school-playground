# La Discorde — SP3 "World and progression" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the core loop into a game world: a camp hub as the home screen, Éris's file « Ses points faibles » in her voice, six lieutenants mapped to error families with quests and a permanent "neutralised" mastery rule, boss fights with Éris, the weekly Consultation de l'Oracle at Delphes (three sealed scrolls → quest of the week), a quest board, the Oracle's prophecies (dictées préparées), a dragon companion that hatches and grows with neutralised techniques (named and tinted by the player), XP and ranks, rewards known in advance (relics, dragon tints, divine gear, cabin decor), a bestiary with real myth facts in French, a weekly goal instead of streaks, a break suggestion after ~25 minutes, and "juice" (animations, particles, generated sounds) that respects `prefers-reduced-motion` and a mute setting.

**Architecture:** Same single container. The server (FastAPI + SQLite) is authoritative for all progression: migration `004_world.sql` adds `quest`, `oracle`, `dragon`, `reward`, `xp_event`, `mastery` tables and two nullable `session` columns; a `server/app/world/` package holds the catalog (lieutenants → stat categories, rewards, ranks), the pure mastery/XP/quest rules and the `apply_progression()` hook that `POST /api/sessions` calls after the SP1 stats update, returning a `progression` block the client animates. A `GET /api/profiles/{id}/camp` endpoint aggregates everything the hub needs. The client (Svelte 5) computes two *derived* stat categories at grading time (`derived:sirenes`, `derived:lethe`) from the existing grading result and the annotation, so Sirènes and Léthé ride on the SP1 stats pipeline unchanged. The art already generated (commit `6b2ad33`, WebP with alpha under `assets/art/web/`) is copied into `web/public/art/` and loaded lazily per screen; sounds are synthesised with WebAudio (no audio files, no external requests).

**Tech Stack:** FastAPI, Python 3.12, stdlib `sqlite3` + numbered SQL migrations, `zoneinfo` + `tzdata` (Europe/Zurich days and ISO weeks), pytest; Svelte 5 (runes) + TypeScript + Vite 7, vitest, WebAudio API, CSS animations, Playwright 1.55.0 (`mcr.microsoft.com/playwright:v1.55.0-noble`); Docker Compose; TrueNAS SCALE 25.10 target.

**Spec:** `docs/superpowers/specs/2026-09-23-la-discorde-design.md` — the binding authority. Read §1, §2, §3.6, §4, §5 (SP3) and §6 before starting any task. Where this plan and the spec disagree, the spec wins; where the spec is silent, this plan's "Decisions" section wins. The SP1 plan (`docs/superpowers/plans/2026-09-23-sp1-foundations-core-loop.md`) and the SP2 plan (`docs/superpowers/plans/2026-09-24-sp2-analysis-sources.md`) document the code you extend; their "Decisions" remain in force unless overridden below.

## Global Constraints

- **Language:** "The UI and all game text are in French. Code, comments, docs and commits are in English." (spec §0). Every French string in this plan is to be used verbatim; typographic apostrophes (’) or straight (') are both fine but be consistent within a file (the codebase uses straight quotes in code, « » guillemets with spaces in prose).
- **Pedagogy (spec §1):** "The reference text is always the answer key." "No discouragement: no red crosses, no buzzers, no lives, nothing can be lost. Mistakes are framed as Éris's sabotage. Orange rather than red." "Taunts target her own tricks, never the player's ability." (§2)
- **Progression (spec §3.6):** "XP from effort (finishing texts), catch rate, and self-corrections. Personal bests, not leaderboards." "neutralising a technique = catch rate ≥ 80% on that category over 3 different days (min. 10 occurrences)". "Weekly goal (e.g. 3 sessions per week) instead of daily streaks; no guilt messaging, no push notifications, no timers unless opted in." "after ~25 minutes, the dragon suggests a break."
- **Ethics (task brief):** no money, no loot boxes, every reward is known in advance before the player commits to a quest; nothing is ever taken away.
- **Toolchain (spec §4):** "All toolchains run in Docker [...]. Do not install software on the host." Windows 11 + Docker Desktop + Git Bash; host Python is never used for the server. Every command goes through `scripts/*.sh`. No new npm runtime dependencies (juice is hand-written CSS/canvas/WebAudio).
- **Deployment (spec §4):** single container, `compose.yaml`, port `8080`, `/data` volume, TrueNAS SCALE 25.10, plain HTTP. "No external API calls at runtime [...]. No API keys. No trackers." Fonts stay system fonts; art is served from `web/public/art/` (same origin).
- **Data (spec §4):** "Server-authoritative data." Progression lives in SQLite; the client only caches transient UI state. Migrations are numbered SQL files; SP2 owns `002` and `003`, **SP3 starts at `004`**.
- **Accessibility:** every animation is disabled or reduced under `@media (prefers-reduced-motion: reduce)`; every sound obeys the mute setting; touch targets ≥ 48 px (SP1 convention).
- **Commits:** every task commits its own work on branch `grimoire`, **always with a pathspec** because parallel agents share the index: `git add <paths> && git commit -m "..." -- <paths>`. End every commit message with the attribution trailer your harness gives you (e.g. `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`).
- **Shared files with SP2:** SP2 is implemented concurrently. Before editing any file listed in SP2's task file lists (`server/app/routers/sessions.py`, `stats.py`, `texts.py`, `schemas.py`, `main.py`, `corrupt.py`, `server/tests/conftest.py`, `web/src/lib/routes.ts`, `api.ts`, `types.ts`, `App.svelte`, `Play.svelte`, `Results.svelte`, `Library.svelte`, `Stats.svelte`, `playState.ts`, `compose.e2e.yaml`, `web/e2e/helpers.ts`, `README.md`), run `git pull --rebase` / rebase onto the lane head, keep your edits minimal and localised (insert lines, never reformat), and re-run the tests. If an SP2 symbol this plan relies on (`session.mode`, `SessionCreate.mode`, `POST /api/texts/{id}/corrupt`, `isProphecy`, `formatSwissDate`, `createProfile`/`createText` helpers) is not yet in the tree, implement the fallback named in the task ("SP2 fallback") and record it in your report.
- **Verification:** before claiming a task done, run the task's test command through the wrapper scripts and paste the actual output in your report. `scripts/check.sh` is enforced at lane joins (after Task 3, after Task 8, and at Task 9).

## Decisions taken by this plan (nobody was available to ask; do not re-ask)

1. **Lieutenant → stat categories.** `hydre` = `agreement:number` + `agreement:verb`; `echo` = `homophone`; `chimere` = `agreement:gender`; `protee` = `agreement:participle` (only for levels ≥ 8H — below, Protée « dort » and is excluded from counts); `sirenes` = `derived:sirenes`; `lethe` = `derived:lethe`. `accent`, `lexical`, `punctuation_case` belong to no lieutenant (they feed mots-pièges, SP1) and are shown in the dossier as « Petites ruses » without a monster.
2. **Derived categories are computed client-side at grading time** and submitted inside `result.byCategory` under keys prefixed `derived:` — the SP1 server stats pipeline stores them unchanged in `profile_stat`/`profile_stat_day`. `derived:sirenes` counts agreement errors on verbs whose subject–verb chain is "sirène-like" (relative `qui`, distance ≥ 4 tokens, inverted subject, or an object pronoun between subject and verb — annotation v2 chains with confidence ≠ `low`, v1 fallback on the `subject` field). `derived:lethe` counts every draft error whose reference token lies in the last third of the text (texts ≥ 60 words only). The stats router excludes `derived:%` rows from the generic category list and totals so nothing is double-counted in SP1 screens.
3. **Mastery rule = minimal recent window.** For a lieutenant, walk its `profile_stat_day` rows (summed over its categories) from the most recent day backwards, accumulating days that had ≥ 1 draft error, until both ≥ 3 days and ≥ 10 draft errors are reached; neutralised when `caught / errors_in_draft ≥ 0.8` over that window. "Occurrences" in the spec is read as *errors present in the draft* (the denominator of the catch rate). Neutralisation is **permanent** (`mastery` table row): nothing can be lost; later dips only surface as a quest suggestion (« L'Hydre s'agite »), never as a demotion.
4. **Days and weeks are Swiss.** `server/app/clock.py` computes the local day (`Europe/Zurich`, env `DISCORDE_TZ`) and ISO week (`YYYY-Www`, Monday–Sunday) from the UTC timestamp; `POST /api/sessions` uses it for `day` from SP3 on (SP1 used the UTC date). `tzdata` is added to `requirements.txt` because `python:3.12-slim` ships no system zoneinfo.
5. **Test clock hook.** When env `DISCORDE_TEST_HOOKS=1` (set only in `compose.e2e.yaml` and pytest), `POST /api/sessions` honours a request header `X-Discorde-Day: YYYY-MM-DD` that overrides the day (and sets `finished_at` to that day at 12:00 UTC). This is the only way e2e can exercise the 3-day mastery rule; the production image never sets the env.
6. **XP.** `xp = round((10 + words/10 + 5 × caught + catch_bonus) × pace_mult)` with `catch_bonus = round(30 × catch_rate)` or 15 when the draft had no errors, `pace_mult = {1: 1, 2: 1.25, 3: 1.5, 4: 2}` (grimoire sessions: 1). Bonuses: board quest 60, Oracle quest 150, boss won 300, neutralisation 200, weekly goal 40, prophecy text played before its date ×1.5 on the session XP. Ten ranks with thresholds `[0, 150, 400, 800, 1400, 2200, 3200, 4500, 6000, 8000]` and epicene titles (Decision 20). XP is a ledger (`xp_event`), the total is a SUM.
7. **Quests.** Three kinds: `board` (any lieutenant, ≤ 2 active at once, never expire), `oracle` (one per ISO week, replaced quietly at the next consultation), `boss` (single session). Board and Oracle goals: 3 sessions where the monster « a été tenu en échec »: a session counts when the lieutenant's categories had ≥ 1 draft error and `caught/draft ≥ 0.5`, or had 0 draft errors while the text offered ≥ 3 opportunities in those categories. Every session (dictation or grimoire, any text) is evaluated against every active quest; quests also carry 3 recommended texts chosen by category density. A quest can be « rangée » (shelved) without penalty.
8. **Boss fights.** Tier *k* ∈ {1,2,3} unlocks when `2k` lieutenants are neutralised (adjusted to the available count: tiers at ⌈n/3⌉, ⌈2n/3⌉, n). `POST /boss` picks a long text (≥ 150 words, profile level or one below, unplayed preferred, else the longest available) and forces `help_stage = clamp(profile.help_stage + 1, 2, 4)` (fewer aids, never the spotlight). Win = catch rate ≥ 0.7 with ≥ 3 draft errors, or a draft with < 3 errors (« Éris n'a rien eu à saboter »). A lost fight loses nothing: the quest stays `active` and can be replayed. Boss sessions are excluded from the adaptive help-stage computation (`encounter IS NULL` filter).
9. **Oracle scrolls.** Labels fixed: « Le point faible », « Ce qui arrive à l'école », « Le choix du destin ». The reward of the week is the same whichever scroll is opened and is shown *before* opening (no gamble): the *n*-th completed Oracle quest grants the *n*-th entry of `ORACLE_REWARDS` (dragon tints Écume, Olivier, Braise, Jade, Argent, then cabin decor), afterwards 150 XP only. « Le point faible » = the non-neutralised lieutenant with the lowest all-time catch rate (≥ 5 traps; fallback most missed; fallback Hydre). « Le choix du destin » = the non-neutralised lieutenant whose categories have the oldest last practised day (never practised first), different from « Le point faible » when possible. « Ce qui arrive à l'école » = the player picks the monster.
10. **Prophecies** (SP2 due dates) appear on the camp and at Delphes with a countdown; playing a prophecy text before its date gives ×1.5 session XP. No extra table.
11. **Dragon stages** from the number of neutralised lieutenants among the *available* ones (`n` = 6, or 5 below 8H): `egg` 0, `hatchling` ≥ 1, `young` ≥ ⌈n/2⌉, `adult` = n. Between stages a progress ring shows partial progress (« L'œuf frémit »). The player names the dragon when it hatches (rename any time, 1–20 chars) and chooses a tint among unlocked ones; tints are CSS filters on the same cut image (style guide: hue shift in CSS, never new generations). Violet is never offered (reserved for Éris).
12. **Rewards catalog lives on the server** (`server/app/world/catalog.py`, French labels included) and is served by `GET /api/world`; the client only maps reward ids to art/glyphs. Relics (one per neutralised lieutenant), tints (Oracle), divine gear (boss tiers: Sandales d'Hermès, Égide, Foudre de Zeus), cabin decor (every second completed board quest, fixed order). No new art is generated in SP3: relics and decor are CSS medallions (gold ring + glyph); the existing emblems illustrate the tools in the bestiary. A later art batch may replace them.
13. **Bestiary** entries separate « Le mythe » (real facts, with a « Sources » line naming the ancient texts) from « Au camp » (the game's fiction, clearly labelled) so the child never confuses the two. Monster entries show one teaser fact until the first completed quest on that monster (or neutralisation) unlocks the full page; tool/place entries are always open.
14. **Routes.** The hub takes `#/p/:id/camp`; the library moves to `#/p/:id/parchemins` (route name `library` unchanged so SP1/SP2 `href('library')` calls keep working). New routes: `dossier`, `bestiaire`, `bestiaire-entry/:key`, `lieutenant/:key` (`/monstres/:key`), `oracle` (`/delphes`), `quests` (`/quetes`), `boss` (`/eris`), `dragon`, `cabin` (`/cabane`). `matchRoute` learns to split a `?k=v&…` query into `route.query` so `play`/`grimoire` can carry `quest`, `encounter`, `focus`, `help`.
15. **Weekly goal** default 3 sessions per ISO week, adjustable 2–5 in Réglages (`settings.weekly_goal`). Displayed as laurel leaves that fill; reaching it grants 40 XP once per week; missing it is never mentioned (the next week just starts).
16. **Break suggestion**: the client accumulates active play time (dictation + proofreading phases, paused when the tab is hidden) in `sessionStorage`; when ≥ 25 minutes at the end of a session, the dragon suggests a break on the results screen (« Pause » → camp; « Encore un texte » dismisses). Resets after 10 minutes of inactivity. Never a blocking timer.
17. **Sound** is synthesised with WebAudio (`sfx.ts`: tap, seal break, scroll unroll, chime, growth fanfare, Éris « hmpf »), created lazily on the first user gesture (iOS). `settings.mute` (server-side profile setting, mirrored in `localStorage` for instant effect) mutes everything; a speaker toggle sits in the TopBar. Dictation TTS is unaffected by mute.
18. **Motion**: one global rule in `app.css` neutralises all keyframe animations and transitions under reduced motion; the canvas `Particles` component renders nothing under reduced motion; `Reveal` staggering becomes instant.
19. **Éris's voice lines are client-side** (`web/src/lib/world/eris.ts`), templated by lieutenant × band (`none` < 3 traps, `strong` rate < 0.4, `contested` 0.4–0.8, `weak` ≥ 0.8 not yet neutralised, `neutralised`). A unit test asserts no line contains any word of a forbidden list aimed at the player (`nul`, `nulle`, `mauvais`, `mauvaise`, `incapable`, `bête`, `idiot`, `idiote`, `tu es`, `tu n'es`, `tu ne sais`, `tu n'arrives`). The SP1 `erisLine()` (results) stays as is.
20. **Epicene wording.** Rank titles and all lines addressed to the player avoid gendered agreement (siblings/friends may be boys): « Recrue du camp », « Scribe des Muses », « Sentinelle des textes », « Garde des Parchemins », « Œil d'Argus », « Main d'Ariane », « Bouclier de Persée », « Sagesse d'Athéna », « Fléau d'Éris », « Légende du camp ». Where SP1 already uses the feminine (e.g. « piégée »), leave it.
21. **Grimoire focus.** `POST /api/texts/{id}/corrupt` gains an optional `focus: lieutenant key`; the categories of that lieutenant get their weight ×3 (so « le Grimoire de l'Hydre » is a fight against the Hydre). Depends on SP2 Task 4; if absent when Task 3 runs, skip Step 6 of Task 3 and record it.
22. **Onboarding**: first visit to the camp shows three short cards (the Muses, Éris and the dés-accords, the egg) stored as `settings.onboarded = true`; skippable at any time.

## Lanes (parallel execution)

| Lane | Tasks | Notes |
|---|---|---|
| **Server** | 1 → 2 → 3 | Task 1 is pure functions + migration; Task 2 wires the session hook (touches SP2 files — rebase first); Task 3 adds the world API. |
| **Web** | 4 → 5 → 6 → 7 → 8 | Task 4 depends on nothing server-side. Tasks 5–8 code against the "Shared contracts" below and only need the server at e2e time. |
| **Joint** | 9 → 10 | Start after both lanes are complete. |

`scripts/check.sh` must be `== ALL GREEN` after Task 3, after Task 8, and at Task 9.

## Shared contracts (both lanes code against these; do not drift)

### Keys and enums

```
LIEUTENANT_ORDER = ['hydre', 'echo', 'chimere', 'protee', 'sirenes', 'lethe']
BOSS = 'eris'
DragonStage = 'egg' | 'hatchling' | 'young' | 'adult'
Tint = 'bronze' | 'ecume' | 'olivier' | 'braise' | 'jade' | 'argent'
QuestKind = 'board' | 'oracle' | 'boss';  QuestStatus = 'active' | 'done' | 'shelved' | 'expired'
ScrollKey = 'faible' | 'ecole' | 'destin'
RewardKind = 'relic' | 'tint' | 'gear' | 'decor'
Derived stat keys: 'derived:sirenes', 'derived:lethe'
Week id: 'YYYY-Www' (ISO 8601), day: 'YYYY-MM-DD' local (Europe/Zurich)
```

### Migration `004_world.sql` (Task 1)

```sql
ALTER TABLE session ADD COLUMN encounter TEXT;            -- NULL | lieutenant key | 'eris'
ALTER TABLE session ADD COLUMN quest_id INTEGER;          -- NULL | quest.id (no FK: quests may be deleted with the profile)
CREATE TABLE quest (id INTEGER PRIMARY KEY AUTOINCREMENT, profile_id INTEGER NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('board','oracle','boss')), target TEXT NOT NULL, week TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','done','shelved','expired')),
  goal_json TEXT NOT NULL, progress_json TEXT NOT NULL DEFAULT '{}', reward_json TEXT NOT NULL,
  created_at TEXT NOT NULL, completed_at TEXT);
CREATE INDEX quest_profile_status ON quest(profile_id, status);
CREATE TABLE oracle (profile_id INTEGER NOT NULL REFERENCES profile(id) ON DELETE CASCADE, week TEXT NOT NULL,
  scrolls_json TEXT NOT NULL, chosen TEXT, quest_id INTEGER, consulted_at TEXT, PRIMARY KEY (profile_id, week));
CREATE TABLE dragon (profile_id INTEGER PRIMARY KEY REFERENCES profile(id) ON DELETE CASCADE, name TEXT,
  tint TEXT NOT NULL DEFAULT 'bronze', stage TEXT NOT NULL DEFAULT 'egg', hatched_at TEXT, updated_at TEXT NOT NULL);
CREATE TABLE reward (profile_id INTEGER NOT NULL REFERENCES profile(id) ON DELETE CASCADE, reward_id TEXT NOT NULL,
  source TEXT NOT NULL, granted_at TEXT NOT NULL, equipped INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (profile_id, reward_id));
CREATE TABLE xp_event (id INTEGER PRIMARY KEY AUTOINCREMENT, profile_id INTEGER NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  session_id INTEGER, quest_id INTEGER, amount INTEGER NOT NULL, reason TEXT NOT NULL, week TEXT, created_at TEXT NOT NULL);
CREATE INDEX xp_event_profile ON xp_event(profile_id);
CREATE TABLE mastery (profile_id INTEGER NOT NULL REFERENCES profile(id) ON DELETE CASCADE, lieutenant TEXT NOT NULL,
  neutralised_at TEXT NOT NULL, PRIMARY KEY (profile_id, lieutenant));
```

### API (Task 3 produces, Tasks 5–8 consume)

| Method & path | Body → response |
|---|---|
| `GET /api/world` | → `{lieutenants: [{key, name, categories, technique, min_level, relic}], rewards: {id: {id, kind, name, desc, source}}, ranks: [{xp, title}], tints: [Tint], oracle_rewards: [reward_id], boss_rewards: {"1": id, "2": id, "3": id}, mastery: {min_days: 3, min_traps: 10, rate: 0.8}, quest_bonus: {board: 60, oracle: 150, boss: 300, mastery: 200, weekly: 40}}` |
| `GET /api/profiles/{id}/camp` | → `CampResponse` (below) |
| `PATCH /api/profiles/{id}/dragon` | `{name?: string, tint?: Tint}` → `DragonOut`; `422` if name empty/> 20 chars or tint not unlocked |
| `GET /api/profiles/{id}/quests?status=active` | → `[QuestOut]` (default: active + done, newest first, ≤ 50) |
| `POST /api/profiles/{id}/quests` | `{target: lieutenant}` → `201 QuestOut`; `409 {detail}` if that target already has an active board quest or 2 board quests are active (« Deux quêtes à la fois, c'est déjà beaucoup. Termine-en une ou range-la. ») |
| `POST /api/profiles/{id}/quests/{qid}/shelve` | → `QuestOut` with `status: 'shelved'` |
| `GET /api/profiles/{id}/oracle` | → `OracleOut` |
| `POST /api/profiles/{id}/oracle` | `{scroll: ScrollKey, lieutenant?: key}` (required for `ecole`) → `{oracle: OracleOut, quest: QuestOut}`; `409` if already consulted this week |
| `POST /api/profiles/{id}/boss` | → `{quest: QuestOut, text_id, tier, help_stage}`; `409` if no tier available; returns the existing active boss quest if any |
| `GET /api/profiles/{id}/rewards` | → `[{id, kind, name, desc, source, granted_at, equipped}]` |
| `PATCH /api/profiles/{id}/rewards/{rid}` | `{equipped: bool}` → the reward |
| `POST /api/sessions` | body gains `encounter?: string`, `quest_id?: int`; header `X-Discorde-Day` (test hook); response gains `progression: Progression` |
| `POST /api/texts/{id}/corrupt` | body gains `focus?: lieutenant key` (Decision 21) |
| `GET /api/profiles/{id}/stats` | unchanged shape; `categories`/`totals` now exclude `derived:%` |

```ts
// web/src/lib/world/types.ts (Task 4) — mirrors server/app/schemas.py additions (Task 3)
export interface Window { days: number; traps: number; caught: number; rate: number | null; complete: boolean }
export interface LieutenantState { key: string; name: string; categories: string[]; available: boolean; neutralised: boolean;
  neutralised_at: string | null; window: Window; all_time: { traps: number; caught: number; missed: number; rate: number | null };
  last_day: string | null; bestiary_unlocked: boolean; active_quest_id: number | null; stirring: boolean }
export interface QuestOut { id: number; kind: QuestKind; target: string; week: string | null; status: QuestStatus;
  goal: { sessions?: number; min_rate: number; min_draft?: number }; progress: { sessions: number; log: { session_id: number; ok: boolean }[] };
  reward: { xp: number; reward_id: string | null; bestiary: boolean };
  texts: { id: number; title: string; level: string; word_count: number }[]; created_at: string; completed_at: string | null }
export interface DragonOut { name: string | null; tint: Tint; stage: DragonStage; neutralised: number; available: number;
  next_stage_at: number | null; unlocked_tints: Tint[] }
export interface OracleOut { week: string; status: 'sealed' | 'chosen'; reward_id: string | null;
  scrolls: { key: ScrollKey; title: string; hint: string; lieutenant: string | null }[];  // lieutenant revealed only for the chosen scroll
  quest: QuestOut | null; prophecies: { text_id: number; title: string; due_date: string; days_left: number }[] }
export interface CampResponse { profile: Profile; xp: { total: number; rank: number; title: string; next_threshold: number | null; rank_floor: number };
  dragon: DragonOut; lieutenants: LieutenantState[]; quests: QuestOut[]; oracle: { week: string; status: 'sealed' | 'chosen'; reward_id: string | null };
  prophecies: OracleOut['prophecies']; weekly: { week: string; target: number; done: number; reached: boolean };
  boss: { tier_available: number | null; tiers_won: number[]; active_quest_id: number | null }; rewards_count: number; small_tricks: { traps: number; caught: number } }
export interface Progression { xp: { session: number; bonuses: { reason: string; amount: number }[]; total_before: number; total_after: number;
  rank_before: number; rank_after: number; title_after: string };
  quests: { id: number; kind: QuestKind; target: string; counted: boolean; progress: number; goal: number | null; completed: boolean; reward_id: string | null }[];
  neutralised: string[]; rewards: { id: string; kind: RewardKind; name: string }[];
  dragon: { stage_before: DragonStage; stage_after: DragonStage; needs_name: boolean };
  weekly: { target: number; done: number; reached_now: boolean }; boss: { tier: number; won: boolean } | null; encounter: string | null }
```

## File structure

```
server/requirements.txt                          + tzdata (Task 1)
server/app/clock.py                              now_utc(), local_day(), iso_week(), week_of_day() (Task 1)
server/app/migrations/004_world.sql              (Task 1)
server/app/world/__init__.py
server/app/world/catalog.py                      LIEUTENANTS, REWARDS, RANKS, TINTS, ORACLE_REWARDS, BOSS_REWARDS, QUEST_BONUS (Task 1)
server/app/world/mastery.py                      mastery_window(), is_neutralised(), lieutenants_for_level(), dragon_stage(), boss_tiers() (Task 1)
server/app/world/xp.py                           session_xp(), rank_for() (Task 1)
server/app/world/quests.py                       session_counts_for(), evaluate_boss(), recommend_texts(), density() (Task 1)
server/app/world/progression.py                  apply_progression(conn, ...) -> dict (Task 2)
server/app/routers/world.py                      /api/world, /camp, /dragon, /quests, /oracle, /boss, /rewards (Task 3)
server/app/world/oracle.py                       compute_scrolls(), consult() (Task 3)
server/tests/test_clock.py, test_world_rules.py (Task 1), test_progression.py (Task 2), test_world_api.py (Task 3)
web/public/art/{characters,dragon,lieutenants,emblems,scenes}/*.webp   copied cut art + scenes (Task 4)
web/src/lib/world/art.ts, art.test.ts            ART map + intrinsic sizes (Task 4)
web/src/lib/world/types.ts                       shared contracts above (Task 4)
web/src/lib/world/api.ts                         worldApi.* fetch wrappers (Task 4)
web/src/lib/juice/motion.ts, sfx.ts, soundStore.svelte.ts   (Task 4)
web/src/components/juice/Particles.svelte, Reveal.svelte, Medallion.svelte, Gauge.svelte   (Task 4)
web/src/app.css                                  + violet tokens, keyframes, reduced-motion rule (Task 4)
web/src/lib/world/derived.ts, derived.test.ts    withDerivedCategories() (Task 5)
web/src/lib/world/playClock.svelte.ts, playClock.test.ts   break timer (Task 5)
web/src/lib/world/campStore.svelte.ts            cached CampResponse + refresh (Task 5)
web/src/screens/Camp.svelte, components/Onboarding.svelte, components/BreakNudge.svelte   (Task 5)
web/src/lib/routes.ts (+test), App.svelte, TopBar.svelte, ProfilePicker.svelte, ProfileCreate.svelte, Play.svelte, Settings.svelte   (Task 5, minimal edits)
web/src/lib/world/eris.ts, eris.test.ts          dossier lines, camp greetings (Task 6)
web/src/lib/world/bestiary.ts, bestiary.test.ts  real myth facts (Task 6)
web/src/screens/Dossier.svelte, Bestiaire.svelte, BestiaireEntry.svelte, Lieutenant.svelte   (Task 6)
web/src/screens/Oracle.svelte, QuestBoard.svelte, Boss.svelte; components/Scroll.svelte, QuestCard.svelte   (Task 7)
web/src/screens/Play.svelte                      query params → quest_id / encounter / help_stage / focus (Task 7, minimal edit)
web/src/lib/world/dragon.ts, dragon.test.ts      TINT_FILTERS, stage art, moods (Task 8)
web/src/components/Dragon.svelte, ProgressionReveal.svelte; screens/DragonScreen.svelte, Cabin.svelte   (Task 8)
web/e2e/world.spec.ts, helpers.ts (+ makeResult, postSession)   (Task 9)
compose.e2e.yaml                                 DISCORDE_TEST_HOOKS=1 (Task 9)
web/e2e/playability-sp3.spec.ts, web/playwright.playability.config.ts, docs/reviews/sp3/*.png, docs/reviews/sp3/playability.md   (Task 10)
```

Conventions (unchanged): levels `['5H','6H','7H','8H','9H','10H','11H']`; SP1 stat keys plus the two derived keys; timestamps ISO 8601 UTC; local days `YYYY-MM-DD`; Swiss dates `dd.mm.yyyy` (SP2 `formatSwissDate`).

---

### Task 1: World catalog, Swiss clock, mastery/XP/quest rules, migration 004 (server lane)

Spec §2 (lieutenants = error families), §3.6 (mastery rule, XP sources, dragon stages, rewards known in advance). Decisions 1, 3, 4, 6, 7, 8, 11, 12, 20.

**Files:**
- Create: `server/app/clock.py`, `server/app/world/__init__.py`, `server/app/world/catalog.py`, `server/app/world/mastery.py`, `server/app/world/xp.py`, `server/app/world/quests.py`, `server/app/migrations/004_world.sql`, `server/tests/test_clock.py`, `server/tests/test_world_rules.py`
- Modify: `server/requirements.txt` (add `tzdata>=2024.1`), `server/tests/test_db.py` (expect migration version ≥ 4 and the new tables)

**Interfaces:**
- Consumes: SP1 `profile_stat_day` rows `{day, category, errors_in_draft, caught, missed, occurrences}`; SP1 `result_json` shape (`byCategory[key] = {opportunities, draft, caught, missed, introduced}`, `totalWords`, `catchRate`, `caught: []`, `draftErrors: []`); SP1 `annotation_json` tokens (`pos`, `dep`, `morph`, `categories`, `homophone`, `subject`) and SP2 v2 `chains` when present.
- Produces (exact signatures used by Tasks 2 and 3):
  ```python
  # clock.py
  def now_utc() -> str                                  # ISO 8601 UTC, same format as SP1 routers
  def local_day(iso_utc: str, tz: str = DEFAULT_TZ) -> str   # 'YYYY-MM-DD' in Europe/Zurich (env DISCORDE_TZ)
  def iso_week(day: str) -> str                         # '2026-09-24' -> '2026-W39'
  def week_days(week: str) -> list[str]                 # the 7 local days of that ISO week, Monday first
  # catalog.py
  LIEUTENANT_ORDER: list[str]; LIEUTENANTS: dict[str, dict]   # key -> {name, categories, technique, min_level, relic, glyph}
  REWARDS: dict[str, dict]      # id -> {id, kind, name, desc, source}
  RANKS: list[tuple[int, str]]  # (xp_threshold, title), ascending, 10 entries
  TINTS: list[str]; ORACLE_REWARDS: list[str]; BOSS_REWARDS: dict[int, str]; DECOR_ORDER: list[str]
  QUEST_BONUS = {"board": 60, "oracle": 150, "boss": 300, "mastery": 200, "weekly": 40}
  MASTERY = {"min_days": 3, "min_traps": 10, "rate": 0.8}
  # mastery.py
  @dataclass class Window: days: int; traps: int; caught: int; rate: float | None; complete: bool
  def lieutenants_for_level(level: str) -> list[str]           # drops 'protee' below 8H
  def mastery_window(day_rows: list[dict]) -> Window           # rows {day, errors_in_draft, caught}, any order, already summed per day
  def is_neutralised(w: Window) -> bool
  def dragon_stage(neutralised: int, available: int) -> str    # 'egg'|'hatchling'|'young'|'adult'
  def next_stage_at(neutralised: int, available: int) -> int | None
  def boss_tiers(available: int) -> dict[int, int]            # tier -> neutralised count needed, e.g. {1: 2, 2: 4, 3: 6}
  def tier_available(neutralised: int, available: int, won: set[int]) -> int | None   # lowest unlocked tier not yet won, fought in order
  # xp.py
  PACE_MULT = {1: 1.0, 2: 1.25, 3: 1.5, 4: 2.0}
  def session_xp(result: dict, pace_level: int, mode: str, prophecy: bool) -> int
  def rank_for(total: int) -> tuple[int, str, int, int | None]   # (rank 1..10, title, floor, next_threshold|None)
  # quests.py
  def lieutenant_totals(by_category: dict, categories: list[str]) -> dict   # {opportunities, draft, caught, missed}
  def session_counts_for(by_category: dict, categories: list[str], min_rate: float) -> bool
  def evaluate_boss(result: dict, min_rate: float = 0.7, min_draft: int = 3) -> bool
  def density(annotation: dict, word_count: int, key: str) -> float          # matching tokens per 100 words
  def recommend_texts(rows: list[dict], key: str, level: str, played: set[int], n: int = 3) -> list[dict]
  ```

- [ ] **Step 1: Migration, requirements, failing db test**

Write `server/app/migrations/004_world.sql` exactly as in "Shared contracts" (first line: `-- SP3: world and progression (quests, oracle, dragon, rewards, xp ledger, mastery).`). Add `tzdata>=2024.1` to `server/requirements.txt`. In `server/tests/test_db.py`, add:

```python
def test_migration_004_creates_world_tables(tmp_path):
    from app.db import connect, migrate
    conn = connect(tmp_path / "x.sqlite3")
    assert migrate(conn) >= 4
    names = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    assert {"quest", "oracle", "dragon", "reward", "xp_event", "mastery"} <= names
    cols = {r[1] for r in conn.execute("PRAGMA table_info(session)")}
    assert {"encounter", "quest_id"} <= cols
```
Run: `scripts/pytest.sh -q tests/test_db.py` → the new test FAILS (missing tables). Write the migration → PASS. The dev image is rebuilt by `build_server_dev_image` (in `scripts/lib.sh`) on every wrapper call, so `tzdata` is picked up automatically; verify with `scripts/py.sh python -c "import zoneinfo; print(zoneinfo.ZoneInfo('Europe/Zurich'))"`.

- [ ] **Step 2: `clock.py` with tests**

```python
# server/tests/test_clock.py
from app.clock import local_day, iso_week, week_days
def test_local_day_is_swiss():
    assert local_day("2026-09-24T22:30:00+00:00") == "2026-09-25"   # 00:30 CEST next day
    assert local_day("2026-01-10T23:30:00+00:00") == "2026-01-11"   # CET
    assert local_day("2026-09-24T10:00:00+00:00") == "2026-09-24"
def test_iso_week():
    assert iso_week("2026-09-24") == "2026-W39"
    assert iso_week("2026-01-01") == "2026-W01"
    assert iso_week("2027-01-01") == "2026-W53"
def test_week_days():
    days = week_days("2026-W39")
    assert days[0] == "2026-09-21" and days[-1] == "2026-09-27" and len(days) == 7
```
```python
# server/app/clock.py
"""Swiss local days and ISO weeks (plan Decision 4). All stored timestamps stay UTC ISO 8601."""
from __future__ import annotations
import os
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

DEFAULT_TZ = os.environ.get("DISCORDE_TZ", "Europe/Zurich")

def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat()

def local_day(iso_utc: str, tz: str = DEFAULT_TZ) -> str:
    dt = datetime.fromisoformat(iso_utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(ZoneInfo(tz)).date().isoformat()

def iso_week(day: str) -> str:
    y, w, _ = date.fromisoformat(day).isocalendar()
    return f"{y}-W{w:02d}"

def week_days(week: str) -> list[str]:
    y, w = int(week[:4]), int(week[-2:])
    monday = date.fromisocalendar(y, w, 1)
    return [(monday + timedelta(days=i)).isoformat() for i in range(7)]
```
Run: `scripts/pytest.sh -q tests/test_clock.py` → 3 passed.

- [ ] **Step 3: `catalog.py`**

```python
"""World catalog: lieutenants, rewards, ranks (plan Decisions 1, 6, 12, 20). French labels are UI text served by GET /api/world."""
LIEUTENANT_ORDER = ["hydre", "echo", "chimere", "protee", "sirenes", "lethe"]
LIEUTENANTS = {
    "hydre":   {"name": "L'Hydre", "categories": ["agreement:number", "agreement:verb"], "min_level": "5H", "relic": "ecaille_hydre", "glyph": "🐍",
                "technique": "Elle sème des dés-accords de nombre : un -s ou un -nt qui manque, et deux têtes repoussent."},
    "echo":    {"name": "Écho", "categories": ["homophone"], "min_level": "5H", "relic": "voix_echo", "glyph": "🔊",
                "technique": "Elle répète un mot qui sonne juste mais s'écrit faux : a ou à, et ou est, son ou sont."},
    "chimere": {"name": "La Chimère", "categories": ["agreement:gender"], "min_level": "5H", "relic": "criniere_chimere", "glyph": "🦁",
                "technique": "Ses têtes se disputent le genre : un masculin ici, un féminin là."},
    "protee":  {"name": "Protée", "categories": ["agreement:participle"], "min_level": "8H", "relic": "perle_protee", "glyph": "🌊",
                "technique": "Il change la forme des participes passés : -é, -ée, -és, -ées, selon être ou avoir."},
    "sirenes": {"name": "Les Sirènes", "categories": ["derived:sirenes"], "min_level": "5H", "relic": "plume_sirene", "glyph": "🎶",
                "technique": "Leur chant éloigne le sujet de son verbe, le cache derrière un pronom ou le met après."},
    "lethe":   {"name": "Léthé", "categories": ["derived:lethe"], "min_level": "5H", "relic": "pavot_lethe", "glyph": "🌫️",
                "technique": "Elle endort l'attention dans le dernier tiers du texte, là où l'on ne relit plus."},
}
TINTS = ["bronze", "ecume", "olivier", "braise", "jade", "argent"]
def _r(id, kind, name, desc, source): return {"id": id, "kind": kind, "name": name, "desc": desc, "source": source}
REWARDS = {r["id"]: r for r in [
    _r("ecaille_hydre", "relic", "Écaille de l'Hydre", "Une écaille vert olive, tiède comme un marais.", "Neutraliser l'Hydre"),
    _r("voix_echo", "relic", "Voix d'Écho", "Un coquillage qui répète le dernier mot juste.", "Neutraliser Écho"),
    _r("criniere_chimere", "relic", "Crinière de la Chimère", "Trois mèches de feu qui ne brûlent pas.", "Neutraliser la Chimère"),
    _r("perle_protee", "relic", "Perle de Protée", "Une perle qui garde toujours la même forme.", "Neutraliser Protée"),
    _r("plume_sirene", "relic", "Plume de Sirène", "Une plume bleue qui ne chante plus.", "Neutraliser les Sirènes"),
    _r("pavot_lethe", "relic", "Pavot de Léthé", "Un pavot rouge qui tient éveillé.", "Neutraliser Léthé"),
    _r("tint:ecume", "tint", "Teinte Écume", "Ton dragon prend la couleur de la mer Égée.", "Quête de l'Oracle"),
    _r("tint:olivier", "tint", "Teinte Olivier", "Ton dragon prend le vert des oliviers.", "Quête de l'Oracle"),
    _r("tint:braise", "tint", "Teinte Braise", "Ton dragon rougeoie comme une braise.", "Quête de l'Oracle"),
    _r("tint:jade", "tint", "Teinte Jade", "Ton dragon brille d'un vert de jade.", "Quête de l'Oracle"),
    _r("tint:argent", "tint", "Teinte Argent", "Ton dragon devient argenté comme la lune.", "Quête de l'Oracle"),
    _r("sandales_hermes", "gear", "Sandales d'Hermès", "Des sandales ailées : rien ne t'échappe.", "Vaincre Éris (première fois)"),
    _r("egide", "gear", "Égide", "Le bouclier d'Athéna, contre tous les dés-accords.", "Vaincre Éris (deuxième fois)"),
    _r("foudre_zeus", "gear", "Foudre de Zeus", "La foudre en personne. Éris n'a plus qu'à bien se tenir.", "Vaincre Éris (troisième fois)"),
    _r("decor:lanterne", "decor", "Lanterne d'Hestia", "Une lanterne qui éclaire ta cabane.", "Deux quêtes du tableau"),
    _r("decor:tapis", "decor", "Tapis de Pénélope", "Un tapis tissé avec patience.", "Quatre quêtes du tableau"),
    _r("decor:bibliotheque", "decor", "Étagère d'Alexandrie", "Une étagère pour tes parchemins préférés.", "Six quêtes du tableau"),
    _r("decor:trophee", "decor", "Trophée de la Pomme", "Une pomme d'or… en bois peint.", "Huit quêtes du tableau"),
    _r("decor:fresque", "decor", "Fresque des Muses", "Les neuf Muses peintes sur ton mur.", "Sixième quête de l'Oracle"),
]}
ORACLE_REWARDS = ["tint:ecume", "tint:olivier", "tint:braise", "tint:jade", "tint:argent", "decor:fresque"]
DECOR_ORDER = ["decor:lanterne", "decor:tapis", "decor:bibliotheque", "decor:trophee"]
BOSS_REWARDS = {1: "sandales_hermes", 2: "egide", 3: "foudre_zeus"}
RANKS = [(0, "Recrue du camp"), (150, "Scribe des Muses"), (400, "Sentinelle des textes"), (800, "Garde des Parchemins"),
         (1400, "Œil d'Argus"), (2200, "Main d'Ariane"), (3200, "Bouclier de Persée"), (4500, "Sagesse d'Athéna"),
         (6000, "Fléau d'Éris"), (8000, "Légende du camp")]
QUEST_BONUS = {"board": 60, "oracle": 150, "boss": 300, "mastery": 200, "weekly": 40}
MASTERY = {"min_days": 3, "min_traps": 10, "rate": 0.8}
```

- [ ] **Step 4: Failing tests for `mastery.py`, `xp.py`, `quests.py`**

```python
# server/tests/test_world_rules.py
import pytest
from app.world.mastery import (Window, boss_tiers, dragon_stage, is_neutralised, lieutenants_for_level, mastery_window,
                               next_stage_at, tier_available)
from app.world.xp import rank_for, session_xp
from app.world.quests import density, evaluate_boss, lieutenant_totals, recommend_texts, session_counts_for

def rows(*triples):  # (day, draft, caught)
    return [{"day": d, "errors_in_draft": e, "caught": c} for d, e, c in triples]

def test_lieutenants_for_level_drops_protee_below_8h():
    assert "protee" not in lieutenants_for_level("7H")
    assert lieutenants_for_level("8H") == ["hydre", "echo", "chimere", "protee", "sirenes", "lethe"]

def test_window_needs_three_days_and_ten_traps():
    w = mastery_window(rows(("2026-09-20", 4, 4), ("2026-09-21", 4, 4)))
    assert w.days == 2 and w.traps == 8 and not w.complete and not is_neutralised(w)
    w = mastery_window(rows(("2026-09-20", 4, 4), ("2026-09-21", 4, 4), ("2026-09-22", 4, 3)))
    assert w.complete and w.days == 3 and w.traps == 12 and w.rate == pytest.approx(11 / 12) and is_neutralised(w)

def test_window_is_the_most_recent_minimal_span_and_ignores_empty_days():
    w = mastery_window(rows(("2026-09-01", 10, 0), ("2026-09-10", 0, 0), ("2026-09-20", 5, 5), ("2026-09-21", 3, 3), ("2026-09-22", 4, 4)))
    assert w.days == 3 and w.traps == 12 and w.rate == 1.0   # the bad day on 09-01 is outside the window

def test_window_extends_until_ten_traps():
    w = mastery_window(rows(("2026-09-19", 1, 0), ("2026-09-20", 2, 2), ("2026-09-21", 2, 2), ("2026-09-22", 2, 2), ("2026-09-23", 4, 4)))
    assert w.days == 5 and w.traps == 11 and w.rate == pytest.approx(10 / 11) and is_neutralised(w)

def test_window_no_data():
    assert mastery_window([]) == Window(days=0, traps=0, caught=0, rate=None, complete=False)

def test_dragon_stage_and_tiers():
    assert dragon_stage(0, 6) == "egg" and dragon_stage(1, 6) == "hatchling" and dragon_stage(3, 6) == "young" and dragon_stage(6, 6) == "adult"
    assert dragon_stage(2, 5) == "hatchling" and dragon_stage(3, 5) == "young" and dragon_stage(5, 5) == "adult"
    assert next_stage_at(0, 6) == 1 and next_stage_at(1, 6) == 3 and next_stage_at(6, 6) is None
    assert boss_tiers(6) == {1: 2, 2: 4, 3: 6} and boss_tiers(5) == {1: 2, 2: 4, 3: 5}
    assert tier_available(1, 6, set()) is None and tier_available(2, 6, set()) == 1
    assert tier_available(4, 6, {1}) == 2 and tier_available(6, 6, {1, 2, 3}) is None
    assert tier_available(4, 6, set()) == 1   # tiers are fought in order

def result(words=100, draft=4, caught=3, rate=0.75):
    return {"totalWords": words, "catchRate": rate, "caught": [{}] * caught, "draftErrors": [{}] * draft,
            "byCategory": {"agreement:verb": {"opportunities": 12, "draft": draft, "caught": caught, "missed": draft - caught, "introduced": 0}}}

def test_session_xp():
    assert session_xp(result(), 1, "dictation", False) == 10 + 10 + 15 + 23          # 58
    assert session_xp(result(), 3, "dictation", False) == 87                          # 58 × 1.5
    assert session_xp(result(), 3, "grimoire", False) == 58                          # grimoire: no pace multiplier
    assert session_xp(result(draft=0, caught=0, rate=None), 1, "dictation", False) == 10 + 10 + 0 + 15
    assert session_xp(result(), 1, "dictation", True) == 87                          # prophecy ×1.5

def test_rank_for():
    assert rank_for(0) == (1, "Recrue du camp", 0, 150)
    assert rank_for(149) == (1, "Recrue du camp", 0, 150)
    assert rank_for(150) == (2, "Scribe des Muses", 150, 400)
    assert rank_for(9999) == (10, "Légende du camp", 8000, None)

def test_lieutenant_totals_and_session_counts():
    bc = {"agreement:number": {"opportunities": 5, "draft": 2, "caught": 1, "missed": 1, "introduced": 0},
          "agreement:verb": {"opportunities": 7, "draft": 2, "caught": 1, "missed": 1, "introduced": 0}}
    assert lieutenant_totals(bc, ["agreement:number", "agreement:verb"]) == {"opportunities": 12, "draft": 4, "caught": 2, "missed": 2}
    assert session_counts_for(bc, ["agreement:number", "agreement:verb"], 0.5) is True
    assert session_counts_for(bc, ["agreement:number", "agreement:verb"], 0.6) is False
    assert session_counts_for({"homophone": {"opportunities": 3, "draft": 0, "caught": 0, "missed": 0, "introduced": 0}}, ["homophone"], 0.5) is True
    assert session_counts_for({"homophone": {"opportunities": 2, "draft": 0, "caught": 0, "missed": 0, "introduced": 0}}, ["homophone"], 0.5) is False
    assert session_counts_for({}, ["homophone"], 0.5) is False

def test_evaluate_boss():
    assert evaluate_boss(result(draft=5, caught=4, rate=0.8)) is True
    assert evaluate_boss(result(draft=5, caught=3, rate=0.6)) is False
    assert evaluate_boss(result(draft=2, caught=0, rate=0.0)) is True     # fewer than 3 traps: nothing to sabotage

def tok(i, pos, **kw):
    t = {"i": i, "text": "x", "start": 0, "end": 1, "lemma": "x", "pos": pos, "morph": {}, "head": i, "dep": "dep",
         "categories": [], "homophone": None, "subject": None}
    t.update(kw); return t

def test_density():
    ann = {"version": 1, "tokens": [tok(0, "DET", categories=["nominal_group"], morph={"Number": "Plur"}),
                                    tok(1, "NOUN", categories=["nominal_group"], morph={"Number": "Plur", "Gender": "Fem"}),
                                    tok(2, "VERB", categories=["verb"], morph={"Number": "Plur"}, subject=1),
                                    tok(3, "ADP", homophone="a_à", categories=["homophone"]),
                                    tok(4, "VERB", morph={"VerbForm": "Part"}, categories=["participle"])]}
    assert density(ann, 50, "hydre") == pytest.approx(6.0)       # tokens 0,1,2 plural → 3 per 50 words
    assert density(ann, 50, "echo") == pytest.approx(2.0)
    assert density(ann, 50, "chimere") == pytest.approx(2.0)     # one feminine nominal token
    assert density(ann, 50, "protee") == pytest.approx(2.0)
    assert density(ann, 50, "sirenes") == 0.0                    # v1: subject at distance 1, no qui
    assert density(ann, 50, "lethe") == 0.0 and density(ann, 130, "lethe") == 1.0

def test_recommend_texts_prefers_level_unplayed_and_density():
    rows_ = [{"id": 1, "title": "a", "level": "10H", "word_count": 100, "density": 4.0},
             {"id": 2, "title": "b", "level": "10H", "word_count": 100, "density": 9.0},
             {"id": 3, "title": "c", "level": "11H", "word_count": 100, "density": 9.0},   # above level: excluded
             {"id": 4, "title": "d", "level": "9H", "word_count": 100, "density": 6.0},
             {"id": 5, "title": "e", "level": "10H", "word_count": 100, "density": 7.0}]
    assert [r["id"] for r in recommend_texts(rows_, "hydre", "10H", played={2}, n=3)] == [5, 4, 1]
    assert [r["id"] for r in recommend_texts(rows_, "hydre", "10H", played=set(), n=2)] == [2, 5]
```
Run: `scripts/pytest.sh -q tests/test_world_rules.py` → FAIL (`ModuleNotFoundError: app.world`).

- [ ] **Step 5: Implement `mastery.py`, `xp.py`, `quests.py`**

`server/app/world/mastery.py`:
```python
"""Mastery (neutralisation) rule, dragon stages and boss tiers (spec §3.6; plan Decisions 3, 8, 11)."""
from __future__ import annotations
from dataclasses import dataclass
from math import ceil
from app.levels import level_index
from app.world.catalog import LIEUTENANTS, LIEUTENANT_ORDER, MASTERY

@dataclass(frozen=True)
class Window:
    days: int; traps: int; caught: int; rate: float | None; complete: bool

def lieutenants_for_level(level: str) -> list[str]:
    return [k for k in LIEUTENANT_ORDER if level_index(level) >= level_index(LIEUTENANTS[k]["min_level"])]

def mastery_window(day_rows: list[dict]) -> Window:
    days = traps = caught = 0
    for r in sorted((r for r in day_rows if r["errors_in_draft"] > 0), key=lambda r: r["day"], reverse=True):
        if days >= MASTERY["min_days"] and traps >= MASTERY["min_traps"]:
            break
        days += 1; traps += r["errors_in_draft"]; caught += r["caught"]
    complete = days >= MASTERY["min_days"] and traps >= MASTERY["min_traps"]
    return Window(days, traps, caught, caught / traps if traps else None, complete)

def is_neutralised(w: Window) -> bool:
    return w.complete and w.rate is not None and w.rate >= MASTERY["rate"]

def _thresholds(available: int) -> dict[str, int]:
    return {"hatchling": 1, "young": ceil(available / 2), "adult": available}

def dragon_stage(neutralised: int, available: int) -> str:
    t = _thresholds(available)
    if neutralised >= t["adult"]: return "adult"
    if neutralised >= t["young"]: return "young"
    if neutralised >= t["hatchling"]: return "hatchling"
    return "egg"

def next_stage_at(neutralised: int, available: int) -> int | None:
    for n in sorted(_thresholds(available).values()):
        if n > neutralised: return n
    return None

def boss_tiers(available: int) -> dict[int, int]:
    return {1: ceil(available / 3), 2: ceil(2 * available / 3), 3: available}

def tier_available(neutralised: int, available: int, won: set[int]) -> int | None:
    for tier, need in boss_tiers(available).items():
        if tier in won: continue
        return tier if neutralised >= need else None
    return None
```

`server/app/world/xp.py` (note: `int(x + 0.5)` instead of `round()` to avoid banker's rounding — `round(22.5)` is 22 in Python):
```python
"""XP from effort, catch rate and self-corrections (spec §3.6; plan Decision 6)."""
from __future__ import annotations
from app.world.catalog import RANKS
PACE_MULT = {1: 1.0, 2: 1.25, 3: 1.5, 4: 2.0}

def _half_up(x: float) -> int:
    return int(x + 0.5)

def session_xp(result: dict, pace_level: int, mode: str, prophecy: bool) -> int:
    words = int(result.get("totalWords", 0))
    caught = len(result.get("caught", []))
    rate = result.get("catchRate")
    catch_bonus = 15 if not result.get("draftErrors") else _half_up(30 * (rate or 0.0))
    base = 10 + words / 10 + 5 * caught + catch_bonus
    mult = PACE_MULT.get(pace_level, 1.0) if mode == "dictation" else 1.0
    if prophecy: mult *= 1.5
    return _half_up(base * mult)

def rank_for(total: int) -> tuple[int, str, int, int | None]:
    rank, title, floor = 1, RANKS[0][1], 0
    for i, (threshold, name) in enumerate(RANKS):
        if total >= threshold: rank, title, floor = i + 1, name, threshold
    nxt = RANKS[rank][0] if rank < len(RANKS) else None
    return rank, title, floor, nxt
```

`server/app/world/quests.py`:
```python
"""Quest evaluation, boss verdict and text recommendation by category density (plan Decisions 7, 8)."""
from __future__ import annotations
from app.levels import level_index

def lieutenant_totals(by_category: dict, categories: list[str]) -> dict:
    t = {"opportunities": 0, "draft": 0, "caught": 0, "missed": 0}
    for c in categories:
        row = by_category.get(c) or {}
        for k in t: t[k] += int(row.get(k, 0))
    return t

def session_counts_for(by_category: dict, categories: list[str], min_rate: float) -> bool:
    t = lieutenant_totals(by_category, categories)
    if t["draft"] > 0: return t["caught"] / t["draft"] >= min_rate
    return t["opportunities"] >= 3

def evaluate_boss(result: dict, min_rate: float = 0.7, min_draft: int = 3) -> bool:
    if len(result.get("draftErrors", [])) < min_draft: return True
    return (result.get("catchRate") or 0.0) >= min_rate

def _pron_between(tokens: list[dict], a: int, b: int) -> bool:
    return any(x["pos"] == "PRON" and x.get("dep") != "nsubj" for x in tokens[min(a, b) + 1:max(a, b)])

def sirene_like(tokens: list[dict], chains: list[dict], t: dict) -> bool:
    i = t["i"]
    if chains:
        for ch in chains:
            if ch.get("kind") != "subject_verb" or i not in ch.get("targets", []) or ch.get("confidence") == "low": continue
            c = ch["controller"]
            if ch.get("via") == "qui" or ch.get("distance", 0) >= 4 or c > i or _pron_between(tokens, c, i): return True
        return False
    s = t.get("subject")
    return s is not None and (abs(s - i) >= 4 or s > i or _pron_between(tokens, s, i))

def density(annotation: dict, word_count: int, key: str) -> float:
    tokens = annotation.get("tokens", []); chains = annotation.get("chains", [])
    if key == "lethe": return 1.0 if word_count >= 120 else 0.0
    def hit(t):
        m = t.get("morph", {}); cats = t.get("categories", [])
        if key == "hydre": return m.get("Number") == "Plur" and ("nominal_group" in cats or "verb" in cats)
        if key == "echo": return t.get("homophone") is not None
        if key == "chimere": return m.get("Gender") == "Fem" and "nominal_group" in cats
        if key == "protee": return "participle" in cats or m.get("VerbForm") == "Part"
        if key == "sirenes": return "verb" in cats and sirene_like(tokens, chains, t)
        return False
    n = sum(1 for t in tokens if hit(t))
    return 100.0 * n / word_count if word_count else 0.0

def recommend_texts(rows: list[dict], key: str, level: str, played: set[int], n: int = 3) -> list[dict]:
    ok = [r for r in rows if level_index(r["level"]) <= level_index(level) and r["density"] > 0]
    ok.sort(key=lambda r: (r["id"] in played, -r["density"], r["id"]))
    return [{"id": r["id"], "title": r["title"], "level": r["level"], "word_count": r["word_count"]} for r in ok[:n]]
```
The router (Task 3) builds `rows` with `density` precomputed per lieutenant from `annotation_json`. Run: `scripts/pytest.sh -q tests/test_world_rules.py tests/test_clock.py tests/test_db.py` → all passed; then `scripts/pytest.sh -q` → all green.

- [ ] **Step 6: Commit**

```bash
git add server/requirements.txt server/app/clock.py server/app/world server/app/migrations/004_world.sql server/tests/test_clock.py server/tests/test_world_rules.py server/tests/test_db.py
git commit -m "Add SP3 world foundations: catalog, Swiss clock, mastery/XP/quest rules, migration 004" -- server/requirements.txt server/app/clock.py server/app/world server/app/migrations/004_world.sql server/tests/test_clock.py server/tests/test_world_rules.py server/tests/test_db.py
```

---

### Task 2: Progression hook on session save — XP ledger, quests, mastery, dragon, weekly goal, test clock (server lane)

Spec §3.6 (XP, mastery, dragon growth, weekly goal), §1.6 (nothing can be lost). Decisions 2, 3, 4, 5, 6, 7, 8, 10, 11, 15. **Touches SP2 files** (`sessions.py`, `schemas.py`, `stats.py`, `config.py`, `conftest.py`): rebase on the lane head first.

**Files:**
- Create: `server/app/world/progression.py`, `server/tests/test_progression.py`
- Modify: `server/app/routers/sessions.py` (day from `clock.local_day`, test header, `encounter`/`quest_id` columns, call `apply_progression`, `encounter IS NULL` filter on the help-stage query), `server/app/schemas.py` (`SessionCreate.encounter`, `quest_id`), `server/app/routers/stats.py` (exclude `derived:%`), `server/app/config.py` (`test_hooks: bool`), `server/tests/conftest.py` (`test_hooks=True` in the `settings` fixture), `server/tests/test_sessions.py` (response has `progression`)

**Interfaces:**
- Consumes: Task 1 (`clock`, `catalog`, `mastery`, `xp`, `quests`); SP1 `apply_session_to_stats` (must run **before** `apply_progression` so `profile_stat_day` includes this session); SP2 `session.mode` (**SP2 fallback:** if the `mode` column does not exist yet, treat every session as `'dictation'` and read `getattr(body, "mode", "dictation")`).
- Produces:
  ```python
  # progression.py
  def grant_reward(conn, profile_id: int, reward_id: str, source: str, now: str) -> bool     # False if already owned
  def add_xp(conn, profile_id: int, amount: int, reason: str, now: str, session_id=None, quest_id=None, week=None) -> None
  def xp_total(conn, profile_id: int) -> int
  def lieutenant_day_rows(conn, profile_id: int, categories: list[str]) -> list[dict]        # summed per day over the categories
  def neutralised_set(conn, profile_id: int) -> set[str]
  def boss_tiers_won(conn, profile_id: int) -> set[int]
  def weekly_done(conn, profile_id: int, week: str) -> int                                    # sessions whose local day is in the week
  def apply_progression(conn, profile: sqlite3.Row, session_id: int, body, result: dict, day: str, now: str, prophecy: bool) -> dict   # the Progression contract
  ```
  `sessions.py` response: `{"id", "help_stage_before", "help_stage_after", "help_stage_message", "progression": {...}}`.

- [ ] **Step 1: Failing tests**

```python
# server/tests/test_progression.py
import json
from tests.test_sessions import make_profile, make_text, make_result   # reuse SP1 helpers; if named differently there, import those names

def hydre_result(draft=4, caught=4, words=120):
    r = make_result()                       # SP1 helper returns a valid SessionResult dict
    r["totalWords"] = words; r["draftErrors"] = [{}] * draft; r["caught"] = [{}] * caught
    r["catchRate"] = caught / draft if draft else None
    r["byCategory"] = {"agreement:verb": {"opportunities": 10, "draft": draft, "caught": caught, "missed": draft - caught, "introduced": 0}}
    return r

def post(client, pid, tid, result, day=None, **extra):
    body = {"profile_id": pid, "text_id": tid, "pace_level": 1, "help_stage": 1, "started_at": "2026-09-24T10:00:00+00:00",
            "draft": "x", "final": "x", "result": result, "score": 10, "catch_rate": result["catchRate"], **extra}
    headers = {"X-Discorde-Day": day} if day else {}
    r = client.post("/api/sessions", json=body, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()

def test_session_grants_xp_and_reports_rank(client):
    pid = make_profile(client, level="10H"); tid = make_text(client)
    p = post(client, pid, tid, hydre_result())["progression"]
    assert p["xp"]["session"] == 10 + 12 + 20 + 30 and p["xp"]["total_after"] == p["xp"]["session"]
    assert p["xp"]["rank_before"] == 1 and p["xp"]["title_after"] == "Recrue du camp"
    assert p["dragon"] == {"stage_before": "egg", "stage_after": "egg", "needs_name": False}
    assert p["neutralised"] == [] and p["rewards"] == [] and p["boss"] is None

def test_mastery_over_three_days_hatches_the_dragon_and_grants_relic(client):
    pid = make_profile(client, level="10H"); tid = make_text(client)
    post(client, pid, tid, hydre_result(), day="2026-09-21")
    post(client, pid, tid, hydre_result(), day="2026-09-22")
    p = post(client, pid, tid, hydre_result(), day="2026-09-23")["progression"]
    assert p["neutralised"] == ["hydre"]
    assert [r["id"] for r in p["rewards"]] == ["ecaille_hydre"]
    assert p["dragon"] == {"stage_before": "egg", "stage_after": "hatchling", "needs_name": True}
    assert {"reason": "mastery", "amount": 200} in p["xp"]["bonuses"]
    # permanent: a bad day later does not undo it
    p2 = post(client, pid, tid, hydre_result(draft=6, caught=0), day="2026-09-24")["progression"]
    assert p2["neutralised"] == [] and p2["dragon"]["stage_after"] == "hatchling"

def test_same_day_sessions_count_as_one_day(client):
    pid = make_profile(client, level="10H"); tid = make_text(client)
    for _ in range(3): post(client, pid, tid, hydre_result(), day="2026-09-21")
    assert post(client, pid, tid, hydre_result(), day="2026-09-21")["progression"]["neutralised"] == []

def test_test_header_ignored_without_hook(settings, tmp_path):
    from dataclasses import replace
    from fastapi.testclient import TestClient
    from app.main import create_app
    with TestClient(create_app(replace(settings, test_hooks=False, data_dir=tmp_path / "d2"))) as c:
        pid = make_profile(c, level="10H"); tid = make_text(c)
        post(c, pid, tid, hydre_result(), day="2001-01-01")
        day = c.get(f"/api/profiles/{pid}/stats").json()  # SP1 stats do not expose days; check the DB instead
        import sqlite3
        conn = sqlite3.connect(tmp_path / "d2" / "discorde.sqlite3")
        assert conn.execute("SELECT day FROM profile_stat_day WHERE profile_id = ?", (pid,)).fetchone()[0] != "2001-01-01"

def test_weekly_goal_bonus_once(client):
    pid = make_profile(client, level="10H"); tid = make_text(client)
    post(client, pid, tid, hydre_result(), day="2026-09-21"); post(client, pid, tid, hydre_result(), day="2026-09-22")
    p = post(client, pid, tid, hydre_result(), day="2026-09-23")["progression"]
    assert p["weekly"] == {"target": 3, "done": 3, "reached_now": True}
    p = post(client, pid, tid, hydre_result(), day="2026-09-24")["progression"]
    assert p["weekly"]["reached_now"] is False and p["weekly"]["done"] == 4
    assert not any(b["reason"] == "weekly" for b in p["xp"]["bonuses"])

def test_derived_categories_are_hidden_from_generic_stats(client):
    pid = make_profile(client, level="10H"); tid = make_text(client)
    r = hydre_result(); r["byCategory"]["derived:lethe"] = {"opportunities": 30, "draft": 2, "caught": 2, "missed": 0, "introduced": 0}
    post(client, pid, tid, r)
    stats = client.get(f"/api/profiles/{pid}/stats").json()
    assert all(not c["category"].startswith("derived:") for c in stats["categories"])
    assert stats["totals"]["caught"] == 4
```
Run: `scripts/pytest.sh -q tests/test_progression.py` → FAIL (`KeyError: 'progression'`).

- [ ] **Step 2: `config.py`, `conftest.py`, `schemas.py`**

`config.py`: add `test_hooks: bool = False` and `test_hooks=os.environ.get("DISCORDE_TEST_HOOKS") == "1"` in `from_env`. `conftest.py` `settings` fixture: add `test_hooks=True`. `schemas.py` `SessionCreate`: add `encounter: str | None = None` and `quest_id: int | None = None` (insert after `catch_rate`; do not touch SP2's `mode` line).

- [ ] **Step 3: `progression.py`**

```python
"""Applies a saved session to the world: XP, quests, mastery, dragon, weekly goal (spec §3.6; plan Decisions 3, 6, 7, 8, 11, 15).
Runs after app.stats.apply_session_to_stats so profile_stat_day already includes the session. Never removes anything."""
from __future__ import annotations
import json, sqlite3
from app.clock import iso_week, week_days
from app.world.catalog import BOSS_REWARDS, DECOR_ORDER, LIEUTENANTS, ORACLE_REWARDS, QUEST_BONUS, REWARDS
from app.world.mastery import dragon_stage, is_neutralised, lieutenants_for_level, mastery_window, boss_tiers
from app.world.quests import evaluate_boss, session_counts_for
from app.world.xp import rank_for, session_xp

def add_xp(conn, profile_id, amount, reason, now, session_id=None, quest_id=None, week=None):
    conn.execute("INSERT INTO xp_event(profile_id, session_id, quest_id, amount, reason, week, created_at) VALUES (?,?,?,?,?,?,?)",
                 (profile_id, session_id, quest_id, amount, reason, week, now))

def xp_total(conn, profile_id) -> int:
    return conn.execute("SELECT COALESCE(SUM(amount), 0) FROM xp_event WHERE profile_id = ?", (profile_id,)).fetchone()[0]

def grant_reward(conn, profile_id, reward_id, source, now) -> bool:
    if reward_id not in REWARDS: return False
    cur = conn.execute("INSERT OR IGNORE INTO reward(profile_id, reward_id, source, granted_at) VALUES (?,?,?,?)",
                       (profile_id, reward_id, source, now))
    return cur.rowcount == 1

def lieutenant_day_rows(conn, profile_id, categories) -> list[dict]:
    marks = ",".join("?" * len(categories))
    return [dict(r) for r in conn.execute(
        f"SELECT day, SUM(errors_in_draft) AS errors_in_draft, SUM(caught) AS caught FROM profile_stat_day "
        f"WHERE profile_id = ? AND category IN ({marks}) GROUP BY day", (profile_id, *categories))]

def neutralised_set(conn, profile_id) -> set[str]:
    return {r[0] for r in conn.execute("SELECT lieutenant FROM mastery WHERE profile_id = ?", (profile_id,))}

def boss_tiers_won(conn, profile_id) -> set[int]:
    return {json.loads(r[0]).get("tier") for r in conn.execute(
        "SELECT goal_json FROM quest WHERE profile_id = ? AND kind = 'boss' AND status = 'done'", (profile_id,))}

def weekly_done(conn, profile_id, week) -> int:
    days = week_days(week)
    return conn.execute("SELECT COUNT(*) FROM session WHERE profile_id = ? AND substr(finished_at, 1, 10) BETWEEN ? AND ?",
                        (profile_id, days[0], days[-1])).fetchone()[0]
```
`weekly_done` compares the UTC date prefix of `finished_at` — one hour off at week edges is acceptable for a goal that never penalises; note it in a comment. Then:
```python
def ensure_dragon(conn, profile_id, now) -> sqlite3.Row:
    conn.execute("INSERT OR IGNORE INTO dragon(profile_id, updated_at) VALUES (?, ?)", (profile_id, now))
    return conn.execute("SELECT * FROM dragon WHERE profile_id = ?", (profile_id,)).fetchone()

def _complete_quest(conn, q, profile_id, now, bonuses, rewards):
    reward = json.loads(q["reward_json"])
    conn.execute("UPDATE quest SET status = 'done', completed_at = ? WHERE id = ?", (now, q["id"]))
    add_xp(conn, profile_id, reward["xp"], q["kind"], now, quest_id=q["id"], week=q["week"])
    bonuses.append({"reason": q["kind"], "amount": reward["xp"]})
    if reward.get("reward_id") and grant_reward(conn, profile_id, reward["reward_id"], f"quest:{q['id']}", now):
        r = REWARDS[reward["reward_id"]]; rewards.append({"id": r["id"], "kind": r["kind"], "name": r["name"]})
    if q["kind"] == "board":
        done = conn.execute("SELECT COUNT(*) FROM quest WHERE profile_id = ? AND kind = 'board' AND status = 'done'", (profile_id,)).fetchone()[0]
        if done % 2 == 0 and (done // 2) <= len(DECOR_ORDER):
            rid = DECOR_ORDER[done // 2 - 1]
            if grant_reward(conn, profile_id, rid, f"board:{done}", now):
                r = REWARDS[rid]; rewards.append({"id": rid, "kind": r["kind"], "name": r["name"]})

def apply_progression(conn, profile, session_id, body, result, day, now, prophecy) -> dict:
    pid = profile["id"]; level = profile["level"]; week = iso_week(day)
    mode = getattr(body, "mode", "dictation")
    total_before = xp_total(conn, pid)
    rank_before = rank_for(total_before)[0]
    bonuses: list[dict] = []; rewards: list[dict] = []
    # 1. session XP
    xp = session_xp(result, body.pace_level, mode, prophecy)
    add_xp(conn, pid, xp, "session", now, session_id=session_id, week=week)
    # 2. quests
    quest_out = []; boss_out = None
    by_cat = result.get("byCategory", {})
    for q in conn.execute("SELECT * FROM quest WHERE profile_id = ? AND status = 'active' ORDER BY id", (pid,)).fetchall():
        goal = json.loads(q["goal_json"]); progress = json.loads(q["progress_json"] or "{}")
        progress.setdefault("sessions", 0); progress.setdefault("log", [])
        if q["kind"] == "boss":
            if body.quest_id != q["id"]: continue
            won = evaluate_boss(result, goal["min_rate"], goal["min_draft"])
            progress["log"].append({"session_id": session_id, "ok": won})
            boss_out = {"tier": goal["tier"], "won": won}
            if won: _complete_quest(conn, q, pid, now, bonuses, rewards)
            conn.execute("UPDATE quest SET progress_json = ? WHERE id = ?", (json.dumps(progress), q["id"]))
            quest_out.append({"id": q["id"], "kind": "boss", "target": "eris", "counted": won, "progress": 1 if won else 0, "goal": 1,
                              "completed": won, "reward_id": json.loads(q["reward_json"]).get("reward_id")})
            continue
        cats = LIEUTENANTS[q["target"]]["categories"]
        ok = session_counts_for(by_cat, cats, goal["min_rate"])
        if ok: progress["sessions"] += 1
        progress["log"].append({"session_id": session_id, "ok": ok})
        completed = progress["sessions"] >= goal["sessions"]
        conn.execute("UPDATE quest SET progress_json = ? WHERE id = ?", (json.dumps(progress), q["id"]))
        if completed: _complete_quest(conn, q, pid, now, bonuses, rewards)
        quest_out.append({"id": q["id"], "kind": q["kind"], "target": q["target"], "counted": ok, "progress": progress["sessions"],
                          "goal": goal["sessions"], "completed": completed, "reward_id": json.loads(q["reward_json"]).get("reward_id")})
    # 3. mastery (permanent)
    available = lieutenants_for_level(level)
    already = neutralised_set(conn, pid)
    newly = []
    for key in available:
        if key in already: continue
        if is_neutralised(mastery_window(lieutenant_day_rows(conn, pid, LIEUTENANTS[key]["categories"]))):
            conn.execute("INSERT INTO mastery(profile_id, lieutenant, neutralised_at) VALUES (?,?,?)", (pid, key, now))
            newly.append(key)
            add_xp(conn, pid, QUEST_BONUS["mastery"], "mastery", now, session_id=session_id, week=week)
            bonuses.append({"reason": "mastery", "amount": QUEST_BONUS["mastery"]})
            rid = LIEUTENANTS[key]["relic"]
            if grant_reward(conn, pid, rid, f"mastery:{key}", now):
                r = REWARDS[rid]; rewards.append({"id": rid, "kind": r["kind"], "name": r["name"]})
    # 4. dragon
    dragon = ensure_dragon(conn, pid, now)
    stage_before = dragon["stage"]
    n = len(already | set(newly))
    stage_after = dragon_stage(n, len(available))
    if stage_after != stage_before:
        conn.execute("UPDATE dragon SET stage = ?, hatched_at = COALESCE(hatched_at, ?), updated_at = ? WHERE profile_id = ?",
                     (stage_after, now, now, pid))
    needs_name = stage_after != "egg" and dragon["name"] is None
    # 5. weekly goal
    target = int(json.loads(profile["settings_json"] or "{}").get("weekly_goal", 3))
    done = weekly_done(conn, pid, week)
    reached_now = False
    if done >= target and conn.execute("SELECT 1 FROM xp_event WHERE profile_id = ? AND reason = 'weekly' AND week = ?", (pid, week)).fetchone() is None:
        add_xp(conn, pid, QUEST_BONUS["weekly"], "weekly", now, week=week)
        bonuses.append({"reason": "weekly", "amount": QUEST_BONUS["weekly"]}); reached_now = True
    total_after = xp_total(conn, pid)
    rank_after, title_after, _, _ = rank_for(total_after)
    return {"xp": {"session": xp, "bonuses": bonuses, "total_before": total_before, "total_after": total_after,
                   "rank_before": rank_before, "rank_after": rank_after, "title_after": title_after},
            "quests": quest_out, "neutralised": newly, "rewards": rewards,
            "dragon": {"stage_before": stage_before, "stage_after": stage_after, "needs_name": needs_name},
            "weekly": {"target": target, "done": done, "reached_now": reached_now}, "boss": boss_out,
            "encounter": body.encounter}
```

- [ ] **Step 4: Wire `sessions.py` and `stats.py`**

`sessions.py` (minimal, localised edits):
1. Imports: `from fastapi import Header`, `from app.clock import local_day`, `from app.world.progression import apply_progression`.
2. Signature: `def create_session(body: SessionCreate, db = Depends(get_db), x_discorde_day: str | None = Header(default=None)):` and read `settings = request.app.state.settings` by adding `request: Request` to the signature (import `Request`).
3. Replace `day = finished_at[:10]` with:
   ```python
   day = local_day(finished_at)
   if settings.test_hooks and x_discorde_day and re.fullmatch(r"\d{4}-\d{2}-\d{2}", x_discorde_day):
       day = x_discorde_day; finished_at = f"{day}T12:00:00+00:00"
   ```
4. INSERT: add `encounter, quest_id` columns and values `body.encounter, body.quest_id`.
5. Help-stage SELECT: append `AND encounter IS NULL` (keep SP2's `AND mode = 'dictation'` if present).
6. After `update_trap_words(...)`: `text_row = db.execute("SELECT due_date FROM text WHERE id = ?", (body.text_id,)).fetchone()`; `prophecy = bool(text_row["due_date"]) and text_row["due_date"] >= day`; `progression = apply_progression(db, profile, session_id, body, body.result, day, finished_at, prophecy)`.
7. Return adds `"progression": progression`.

`stats.py`: in the `categories` query add `AND category NOT LIKE 'derived:%'`; in `caught_row` add the same filter. `test_sessions.py`: extend the existing create test with `assert "progression" in r.json()`.

Run: `scripts/pytest.sh -q` → all green (including `tests/test_progression.py`).

- [ ] **Step 5: Commit**

```bash
git add server/app/world/progression.py server/app/routers/sessions.py server/app/routers/stats.py server/app/schemas.py server/app/config.py server/tests/conftest.py server/tests/test_progression.py server/tests/test_sessions.py
git commit -m "Apply progression on session save: XP ledger, quests, permanent mastery, dragon stage, weekly goal, test clock" -- server/app/world/progression.py server/app/routers/sessions.py server/app/routers/stats.py server/app/schemas.py server/app/config.py server/tests/conftest.py server/tests/test_progression.py server/tests/test_sessions.py
```

---

### Task 3: World API — camp, dragon, quests, Oracle, boss, rewards, grimoire focus (server lane)

Spec §3.6 (Oracle scrolls, quest board, boss fights, dragon customisation, rewards), §3.2 (prophecies). Decisions 7, 8, 9, 10, 11, 12, 21. Touches SP2 files `main.py`, `texts.py`, `corrupt.py`, `schemas.py`: rebase first.

**Files:**
- Create: `server/app/world/oracle.py`, `server/app/routers/world.py`, `server/tests/test_world_api.py`
- Modify: `server/app/main.py` (`app.include_router(world.router)` above the `/api` catch-all), `server/app/schemas.py` (`DragonPatch`, `QuestCreate`, `OracleChoice`, `RewardPatch`; `CorruptRequest.focus`), `server/app/corrupt.py` + `server/app/routers/texts.py` (focus weights — Step 6, SP2-dependent)

**Interfaces:**
- Consumes: Task 1 and Task 2 modules; SP1 `fetch_profile`, `to_out`; SP2 `isProphecy` semantics (`due_date >= today`).
- Produces: the API table in "Shared contracts" and
  ```python
  # oracle.py
  def compute_scrolls(conn, profile, available: list[str], neutralised: set[str]) -> dict   # {'faible': key, 'destin': key}
  def scroll_meta() -> list[dict]        # [{key, title, hint}] fixed labels
  def oracle_reward_for(conn, profile_id) -> str | None   # ORACLE_REWARDS[n] with n = completed oracle quests, else None (150 XP only)
  def consult(conn, profile, week, scroll, lieutenant, now) -> tuple[dict, dict]   # (oracle row dict, quest dict); raises ValueError on bad input
  # routers/world.py helpers reused by tests
  def quest_out(conn, row) -> dict; def dragon_out(conn, profile, now) -> dict; def lieutenant_states(conn, profile) -> list[dict]
  def create_board_quest(conn, profile, target, now) -> dict; def create_boss_quest(conn, profile, now) -> dict
  ```

- [ ] **Step 1: Failing API tests**

```python
# server/tests/test_world_api.py
from tests.test_sessions import make_profile, make_text
from tests.test_progression import hydre_result, post

def test_world_catalog(client):
    w = client.get("/api/world").json()
    assert [l["key"] for l in w["lieutenants"]] == ["hydre", "echo", "chimere", "protee", "sirenes", "lethe"]
    assert w["rewards"]["ecaille_hydre"]["name"] == "Écaille de l'Hydre" and w["mastery"] == {"min_days": 3, "min_traps": 10, "rate": 0.8}
    assert w["boss_rewards"]["1"] == "sandales_hermes" and len(w["ranks"]) == 10

def test_camp_for_new_profile(client):
    pid = make_profile(client, level="7H")
    c = client.get(f"/api/profiles/{pid}/camp").json()
    assert c["xp"] == {"total": 0, "rank": 1, "title": "Recrue du camp", "next_threshold": 150, "rank_floor": 0}
    assert c["dragon"]["stage"] == "egg" and c["dragon"]["available"] == 5 and c["dragon"]["unlocked_tints"] == ["bronze"]
    protee = next(l for l in c["lieutenants"] if l["key"] == "protee")
    assert protee["available"] is False and len(c["lieutenants"]) == 6
    assert c["oracle"]["status"] == "sealed" and c["weekly"] == {"week": c["weekly"]["week"], "target": 3, "done": 0, "reached": False}
    assert c["boss"] == {"tier_available": None, "tiers_won": [], "active_quest_id": None}

def test_dragon_patch_validation(client):
    pid = make_profile(client, level="10H")
    assert client.patch(f"/api/profiles/{pid}/dragon", json={"name": "Braise"}).json()["name"] == "Braise"
    assert client.patch(f"/api/profiles/{pid}/dragon", json={"name": ""}).status_code == 422
    assert client.patch(f"/api/profiles/{pid}/dragon", json={"tint": "ecume"}).status_code == 422   # not unlocked
    assert client.patch(f"/api/profiles/{pid}/dragon", json={"tint": "bronze"}).json()["tint"] == "bronze"

def test_board_quest_lifecycle(client):
    pid = make_profile(client, level="10H"); tid = make_text(client)
    q = client.post(f"/api/profiles/{pid}/quests", json={"target": "hydre"})
    assert q.status_code == 201 and q.json()["goal"] == {"sessions": 3, "min_rate": 0.5} and q.json()["reward"]["xp"] == 60
    assert client.post(f"/api/profiles/{pid}/quests", json={"target": "hydre"}).status_code == 409
    client.post(f"/api/profiles/{pid}/quests", json={"target": "echo"})
    r = client.post(f"/api/profiles/{pid}/quests", json={"target": "chimere"})
    assert r.status_code == 409 and "Deux quêtes" in r.json()["detail"]
    for _ in range(3): p = post(client, pid, tid, hydre_result())["progression"]
    hq = next(x for x in p["quests"] if x["target"] == "hydre")
    assert hq["completed"] is True and hq["progress"] == 3
    quests = client.get(f"/api/profiles/{pid}/quests?status=done").json()
    assert [x["target"] for x in quests] == ["hydre"]
    eq = client.get(f"/api/profiles/{pid}/quests?status=active").json()[0]
    assert client.post(f"/api/profiles/{pid}/quests/{eq['id']}/shelve").json()["status"] == "shelved"

def test_oracle_consultation(client):
    pid = make_profile(client, level="10H")
    o = client.get(f"/api/profiles/{pid}/oracle").json()
    assert o["status"] == "sealed" and [s["key"] for s in o["scrolls"]] == ["faible", "ecole", "destin"]
    assert all(s["lieutenant"] is None for s in o["scrolls"]) and o["reward_id"] == "tint:ecume"
    assert client.post(f"/api/profiles/{pid}/oracle", json={"scroll": "ecole"}).status_code == 422
    r = client.post(f"/api/profiles/{pid}/oracle", json={"scroll": "ecole", "lieutenant": "chimere"}).json()
    assert r["quest"]["kind"] == "oracle" and r["quest"]["target"] == "chimere" and r["quest"]["reward"]["reward_id"] == "tint:ecume"
    assert r["oracle"]["status"] == "chosen" and next(s for s in r["oracle"]["scrolls"] if s["key"] == "ecole")["lieutenant"] == "chimere"
    assert client.post(f"/api/profiles/{pid}/oracle", json={"scroll": "faible"}).status_code == 409

def test_oracle_faible_and_destin_pick_sensible_monsters(client):
    pid = make_profile(client, level="10H"); tid = make_text(client)
    r = hydre_result(draft=6, caught=1)
    r["byCategory"]["homophone"] = {"opportunities": 5, "draft": 5, "caught": 5, "missed": 0, "introduced": 0}
    post(client, pid, tid, r, day="2026-09-01")
    o = client.post(f"/api/profiles/{pid}/oracle", json={"scroll": "faible"}).json()
    assert o["quest"]["target"] == "hydre"
    # destin: a never-practised lieutenant, not the weak one
    assert o["oracle"]["scrolls"][2]["lieutenant"] is None       # still sealed (not chosen)

def test_boss_requires_tier(client):
    pid = make_profile(client, level="10H")
    assert client.post(f"/api/profiles/{pid}/boss").status_code == 409

def test_boss_flow(client):
    pid = make_profile(client, level="10H")
    long_text = make_text(client, body=" ".join(["Les fées dansent dans la clairière et les oiseaux les écoutent."] * 16))   # ≥ 150 words
    # neutralise hydre and echo via the test clock
    for key, cat in (("hydre", "agreement:verb"), ("echo", "homophone")):
        for day in ("2026-09-21", "2026-09-22", "2026-09-23"):
            r = hydre_result(); r["byCategory"] = {cat: {"opportunities": 10, "draft": 4, "caught": 4, "missed": 0, "introduced": 0}}
            post(client, pid, long_text, r, day=day)
    camp = client.get(f"/api/profiles/{pid}/camp").json()
    assert camp["boss"]["tier_available"] == 1 and camp["dragon"]["stage"] == "hatchling"
    b = client.post(f"/api/profiles/{pid}/boss").json()
    assert b["tier"] == 1 and b["text_id"] == long_text and b["help_stage"] == 2 and b["quest"]["kind"] == "boss"
    assert client.post(f"/api/profiles/{pid}/boss").json()["quest"]["id"] == b["quest"]["id"]   # idempotent while active
    lost = post(client, pid, long_text, hydre_result(draft=5, caught=2), quest_id=b["quest"]["id"], encounter="eris", help_stage=2)["progression"]
    assert lost["boss"] == {"tier": 1, "won": False}
    assert client.get(f"/api/profiles/{pid}/quests?status=active").json()[0]["kind"] == "boss"     # nothing lost
    won = post(client, pid, long_text, hydre_result(draft=5, caught=4), quest_id=b["quest"]["id"], encounter="eris", help_stage=2)["progression"]
    assert won["boss"] == {"tier": 1, "won": True} and [r["id"] for r in won["rewards"]] == ["sandales_hermes"]
    rewards = client.get(f"/api/profiles/{pid}/rewards").json()
    assert {r["id"] for r in rewards} == {"ecaille_hydre", "voix_echo", "sandales_hermes"}
    rid = client.patch(f"/api/profiles/{pid}/rewards/sandales_hermes", json={"equipped": True}).json()
    assert rid["equipped"] is True
```
`make_text(client, body=...)` — if the SP1 helper has no `body` parameter, add one (default = its current text). Run: `scripts/pytest.sh -q tests/test_world_api.py` → FAIL (404s).

- [ ] **Step 2: `schemas.py` additions**

```python
class DragonPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=20)
    tint: str | None = None
class QuestCreate(BaseModel):
    target: str
class OracleChoice(BaseModel):
    scroll: Literal["faible", "ecole", "destin"]
    lieutenant: str | None = None
class RewardPatch(BaseModel):
    equipped: bool
```
(`from typing import Literal`.) `CorruptRequest.focus: str | None = None` — only if SP2's `CorruptRequest` exists (Step 6).

- [ ] **Step 3: `oracle.py`**

```python
"""Consultation de l'Oracle: three sealed scrolls, one choice per ISO week (spec §3.6; plan Decision 9)."""
from __future__ import annotations
import json
from app.world.catalog import LIEUTENANTS, ORACLE_REWARDS, QUEST_BONUS

SCROLLS = [
    {"key": "faible", "title": "Le point faible", "hint": "Le monstre qui te piège le plus souvent en ce moment."},
    {"key": "ecole", "title": "Ce qui arrive à l'école", "hint": "Choisis le monstre qui ressemble à ce que ta classe étudie."},
    {"key": "destin", "title": "Le choix du destin", "hint": "Un monstre que tu n'as pas affronté depuis longtemps."},
]
def scroll_meta() -> list[dict]: return [dict(s) for s in SCROLLS]

def compute_scrolls(conn, profile, available, neutralised) -> dict:
    pid = profile["id"]
    candidates = [k for k in available if k not in neutralised] or list(available)
    rates, last = {}, {}
    for k in candidates:
        cats = LIEUTENANTS[k]["categories"]; marks = ",".join("?" * len(cats))
        row = conn.execute(f"SELECT SUM(errors_in_draft) d, SUM(caught) c, SUM(missed) m, MAX(day) last FROM profile_stat_day "
                           f"WHERE profile_id = ? AND category IN ({marks})", (pid, *cats)).fetchone()
        d, c, m = row["d"] or 0, row["c"] or 0, row["m"] or 0
        rates[k] = (c / d if d >= 5 else None, m); last[k] = row["last"] or ""
    with_rate = [k for k in candidates if rates[k][0] is not None]
    if with_rate: faible = min(with_rate, key=lambda k: (rates[k][0], candidates.index(k)))
    elif any(rates[k][1] for k in candidates): faible = max(candidates, key=lambda k: rates[k][1])
    else: faible = candidates[0]
    others = [k for k in candidates if k != faible] or candidates
    destin = min(others, key=lambda k: (last[k], candidates.index(k)))
    return {"faible": faible, "destin": destin}

def oracle_reward_for(conn, profile_id) -> str | None:
    n = conn.execute("SELECT COUNT(*) FROM quest WHERE profile_id = ? AND kind = 'oracle' AND status = 'done'", (profile_id,)).fetchone()[0]
    return ORACLE_REWARDS[n] if n < len(ORACLE_REWARDS) else None

def get_or_seal(conn, profile, week, available, neutralised, now) -> dict:
    row = conn.execute("SELECT * FROM oracle WHERE profile_id = ? AND week = ?", (profile["id"], week)).fetchone()
    if row is None:
        scrolls = compute_scrolls(conn, profile, available, neutralised)
        conn.execute("INSERT INTO oracle(profile_id, week, scrolls_json) VALUES (?,?,?)", (profile["id"], week, json.dumps(scrolls)))
        conn.execute("UPDATE quest SET status = 'expired' WHERE profile_id = ? AND kind = 'oracle' AND status = 'active' AND week <> ?", (profile["id"], week))
        row = conn.execute("SELECT * FROM oracle WHERE profile_id = ? AND week = ?", (profile["id"], week)).fetchone()
    return dict(row)
```
`consult(conn, profile, week, scroll, lieutenant, now)` (implemented in the router, since it needs `create_quest`): validates (`ecole` requires a lieutenant in `LIEUTENANTS`; other scrolls take the sealed one), raises `ValueError("Il faut choisir un monstre.")` / `ValueError("unknown lieutenant")`, refuses when `chosen` is set (the router maps that to 409 with « L'Oracle a déjà parlé cette semaine. Reviens lundi. »), creates the quest (`kind='oracle'`, `week`, goal `{"sessions": 3, "min_rate": 0.5}`, reward `{"xp": 150, "reward_id": oracle_reward_for(...), "bestiary": True}`), updates the oracle row (`chosen`, `quest_id`, `consulted_at`).

- [ ] **Step 4: `routers/world.py`**

Prefix `/api`, tag `world`. Common helpers:

```python
def _week_today() -> tuple[str, str]:  now = now_utc(); day = local_day(now); return day, iso_week(day)
def quest_out(conn, row) -> dict:      # goal/progress/reward from JSON, texts from goal_json["texts"], week, status, timestamps
def lieutenant_states(conn, profile) -> list[dict]:
    # for each key in LIEUTENANT_ORDER: available (in lieutenants_for_level), neutralised (+at), window = mastery_window(lieutenant_day_rows(...)),
    # all_time from profile_stat summed over categories (rate None when traps == 0), last_day = MAX(day), bestiary_unlocked = neutralised or a done quest on it,
    # active_quest_id = active board/oracle quest on it, stirring = neutralised and window.complete and window.rate < 0.5
def dragon_out(conn, profile, now) -> dict:
    # ensure_dragon; neutralised = len(neutralised_set); available = len(lieutenants_for_level); stage recomputed via dragon_stage (and persisted if it differs);
    # unlocked_tints = ['bronze'] + [t for t in TINTS[1:] if f'tint:{t}' owned]; next_stage_at
def xp_block(conn, pid) -> dict:       # total, rank, title, rank_floor, next_threshold
def prophecies(conn, day) -> list[dict]:   # texts with due_date >= day, sorted by due_date; days_left = (due - day).days
def text_rows_with_density(conn, key) -> list[dict]:   # SELECT id, title, level, body, annotation_json FROM text → density(annotation, word_count(body), key)
def create_quest(conn, profile, kind, target, week, goal, reward, now) -> dict
def create_board_quest(conn, profile, target, now):
    # 409 rules; goal {"sessions": 3, "min_rate": 0.5, "texts": recommend_texts(...)}; reward {"xp": 60, "reward_id": None, "bestiary": True}
def create_boss_quest(conn, profile, now):
    # tier = tier_available(...); None → 409 « Éris ne se montre pas encore. Neutralise d'abord ses lieutenants. »
    # existing active boss quest → return it (200); else pick text (Decision 8), help_stage = max(2, min(4, profile.help_stage + 1)),
    # goal {"tier": tier, "min_rate": 0.7, "min_draft": 3, "text_id": id, "help_stage": h}, reward {"xp": 300, "reward_id": BOSS_REWARDS[tier], "bestiary": False}
```
Endpoints (all sync `def`, `db: sqlite3.Connection = Depends(get_db)`, `fetch_profile` first, `db.commit()` after every write):
- `GET /world` → catalog block (`lieutenants` as a list in `LIEUTENANT_ORDER` with `key` added; `boss_rewards` keys as strings).
- `GET /profiles/{id}/camp` → `CampResponse`: `profile: to_out(profile)`, `xp`, `dragon`, `lieutenants`, `quests` (active, newest first), `oracle: {week, status, reward_id}` from `get_or_seal`, `prophecies`, `weekly: {week, target (settings weekly_goal, default 3), done (weekly_done), reached: done >= target}`, `boss: {tier_available, tiers_won (sorted list), active_quest_id}`, `rewards_count`, `small_tricks` (profile_stat sums over `accent`, `lexical`, `punctuation_case`).
- `PATCH /profiles/{id}/dragon`: validate `tint in TINTS` and unlocked else 422 « Cette teinte n'est pas encore débloquée. »; update; return `dragon_out`.
- `GET /profiles/{id}/quests?status=` (`active` | `done` | omitted = both), ≤ 50, newest first.
- `POST /profiles/{id}/quests` → 201 / 409. `POST /profiles/{id}/quests/{qid}/shelve` → 404 if not this profile's, else set `shelved`.
- `GET /profiles/{id}/oracle` → `OracleOut` (scroll `lieutenant` is `None` unless `chosen == key`; `quest` = the week's quest if any; `prophecies`).
- `POST /profiles/{id}/oracle` → 201 `{oracle, quest}`; `ValueError` → 422; already chosen → 409.
- `POST /profiles/{id}/boss` → 201 (new) or 200 (existing) `{quest, text_id, tier, help_stage}`; 409 when no tier.
- `GET /profiles/{id}/rewards`, `PATCH /profiles/{id}/rewards/{rid}` (404 if not owned).

`main.py`: `from app.routers import world` and `app.include_router(world.router)` in the marked spot. Run: `scripts/pytest.sh -q` → all green.

- [ ] **Step 5: Manual smoke through the dev stack**

`scripts/dev.sh` (background) then from Git Bash: `curl -s localhost:8080/api/world | head -c 400`, create a profile via the UI, `curl -s localhost:8080/api/profiles/1/camp | head -c 600`, `curl -s -X POST localhost:8080/api/profiles/1/oracle -H 'Content-Type: application/json' -d '{"scroll":"faible"}'`. Stop the stack. Paste outputs in the report.

- [ ] **Step 6: Grimoire focus (Decision 21; only if SP2 Task 4 is in the tree)**

`corrupt.py` `category_weights(...)`: add parameter `focus: str | None = None`; after computing the weights, `if focus in LIEUTENANTS: for c in LIEUTENANTS[focus]["categories"]: if c in weights: weights[c] *= 3` (derived keys are not corruption categories — `sirenes` and `lethe` focus therefore only boost nothing; for `lethe` instead bias plant *positions* to the last third: when `focus == "lethe"`, choose plants among candidates with `start >= 2/3 · len(text)` first). `routers/texts.py` corrupt endpoint passes `body.focus`. Test in `test_corrupt.py`: with `focus="chimere"`, `category_weights(...)["agreement:gender"]` is 3× the unfocused value; with `focus="lethe"` on a 200-word text, ≥ 70 % of plants have `start >= 2/3 · len(text)`. If SP2 Task 4 is absent, skip and write "focus deferred" in the report.

- [ ] **Step 7: Lane gate and commit**

`scripts/check.sh` → `== ALL GREEN` (if only SP2 web tests fail for reasons outside this lane, say so and re-run at Task 9).

```bash
git add server/app/world/oracle.py server/app/routers/world.py server/app/main.py server/app/schemas.py server/tests/test_world_api.py server/tests/test_sessions.py
git commit -m "Add world API: camp, dragon, quests, Oracle scrolls, boss fights, rewards" -- server/app/world/oracle.py server/app/routers/world.py server/app/main.py server/app/schemas.py server/tests/test_world_api.py server/tests/test_sessions.py
# Step 6, when done:
git add server/app/corrupt.py server/app/routers/texts.py server/tests/test_corrupt.py
git commit -m "Grimoire corrompu: optional lieutenant focus for corruption weights" -- server/app/corrupt.py server/app/routers/texts.py server/tests/test_corrupt.py
```

---

### Task 4: Art in `web/public`, world types/API client, juice foundation (motion, sound, particles, medallions) (web lane)

Spec §5 SP3 ("juice: animations, sounds, particles"), task brief (serve art from `web/public`, bundle size, reduced motion, mute, no external requests). Decisions 12, 17, 18. Depends on nothing server-side.

**Files:**
- Create: `web/public/art/**/*.webp` (copied), `web/src/lib/world/art.ts`, `web/src/lib/world/art.test.ts`, `web/src/lib/world/types.ts`, `web/src/lib/world/api.ts`, `web/src/lib/juice/motion.ts`, `web/src/lib/juice/sfx.ts`, `web/src/lib/juice/sfx.test.ts`, `web/src/lib/juice/soundStore.svelte.ts`, `web/src/components/juice/Particles.svelte`, `web/src/components/juice/Reveal.svelte`, `web/src/components/juice/Medallion.svelte`, `web/src/components/juice/Gauge.svelte`
- Modify: `web/src/app.css` (tokens, keyframes, reduced-motion rule, `.parchment`, `.scene`)

**Interfaces:**
- Consumes: `assets/art/web/**` (WebP, cut variants carry alpha — verified: `VP8X` alpha flag set); SP1 theme tokens.
- Produces:
  ```ts
  // art.ts
  export const ART = { eris: '/art/characters/eris_cut.webp', erisSmug: '/art/characters/eris_smug_cut.webp',
    dragon: { egg: '/art/dragon/dragon_egg_cut.webp', hatchling: '/art/dragon/dragon_hatchling_cut.webp', young: '/art/dragon/dragon_young_cut.webp', adult: '/art/dragon/dragon_adult_cut.webp' },
    lieutenants: { hydre: '/art/lieutenants/hydre_cut.webp', echo: ..., chimere: ..., protee: ..., sirenes: ..., lethe: ... },
    emblems: { argus: '/art/emblems/argus_cut.webp', ariane: ..., persee: ..., athena: ..., apple: ... },
    scenes: { camp: '/art/scenes/camp.webp', delphes: ..., alexandrie: ..., parchemins: ..., argus: ..., battle: ... } } as const;
  export const ART_SIZES = { portrait: { w: 768, h: 1344 }, square: { w: 1024, h: 1024 }, scene: { w: 1344, h: 768 } };
  export function artFor(kind: 'lieutenant' | 'dragon' | 'scene' | 'emblem', key: string): string   // throws on unknown key
  // types.ts — the "Shared contracts" TS block, verbatim, plus: export const LIEUTENANT_ORDER = [...] as const; export type LieutenantKey = ...
  // api.ts
  export const worldApi = { world(), camp(profileId), patchDragon(profileId, body), quests(profileId, status?), createQuest(profileId, target),
    shelveQuest(profileId, questId), oracle(profileId), consult(profileId, body), boss(profileId), rewards(profileId), patchReward(profileId, id, equipped) }
  // motion.ts
  export function reducedMotion(): boolean            // matchMedia('(prefers-reduced-motion: reduce)').matches, false in SSR/tests
  // sfx.ts
  export type Sfx = 'tap' | 'seal' | 'unroll' | 'chime' | 'growth' | 'hmpf' | 'laurel';
  export function unlockAudio(): void                 // creates/resumes the AudioContext; call from a user gesture
  export function playSfx(name: Sfx): void            // no-op when muted or no context
  export function renderSfx(name: Sfx, ctx: BaseAudioContext, at: number): void   // pure scheduling on any context (tested with OfflineAudioContext-like stub)
  // soundStore.svelte.ts
  export const soundStore: { muted: boolean }; export function initSound(profile: Profile): void; export async function setMuted(profileId: number, muted: boolean): Promise<void>
  ```
  Components: `<Particles trigger={n} kind="burst"|"sparkle"|"laurel" />` (re-fires whenever `trigger` changes), `<Reveal delay={ms}>…</Reveal>` (fade-up), `<Medallion glyph="🐍" kind="relic"|"gear"|"decor"|"tint" size={72} locked={false} />`, `<Gauge value={n} max={m} label="…" />` (rounded bar, olive fill, orange never).

- [ ] **Step 1: Copy the art and write the map test**

From Git Bash at the repo root (27 files, ≈ 1.9 MB total; the non-cut portraits are not copied):
```bash
mkdir -p web/public/art/{characters,dragon,lieutenants,emblems,scenes}
cp assets/art/web/characters/*_cut.webp web/public/art/characters/
cp assets/art/web/dragon/*_cut.webp web/public/art/dragon/
cp assets/art/web/lieutenants/*_cut.webp web/public/art/lieutenants/
cp assets/art/web/emblems/*_cut.webp web/public/art/emblems/
cp assets/art/web/scenes/*.webp web/public/art/scenes/
du -sh web/public/art
```
`art.test.ts` (vitest runs in node with cwd `web/`):
```ts
import { describe, it, expect } from 'vitest';
import { existsSync, statSync } from 'node:fs';
import { ART, artFor } from './art';
function flat(o: unknown): string[] { return typeof o === 'string' ? [o] : Object.values(o as object).flatMap(flat); }
describe('art map', () => {
  it('every path exists under public/ and is under 150 KB', () => {
    for (const p of flat(ART)) {
      const file = 'public' + p;
      expect(existsSync(file), file).toBe(true);
      expect(statSync(file).size, file).toBeLessThan(150 * 1024);
    }
  });
  it('total art payload stays under 2.5 MB', () => {
    expect(flat(ART).reduce((s, p) => s + statSync('public' + p).size, 0)).toBeLessThan(2.5 * 1024 * 1024);
  });
  it('artFor resolves and throws on unknown keys', () => {
    expect(artFor('lieutenant', 'hydre')).toBe('/art/lieutenants/hydre_cut.webp');
    expect(() => artFor('lieutenant', 'medusa')).toThrow();
  });
});
```
Run: `scripts/npm.sh run test -- art` → FAIL (module missing). Write `art.ts` → PASS.

- [ ] **Step 2: `types.ts` and `api.ts`**

Copy the "Shared contracts" TS block into `web/src/lib/world/types.ts` (import `Profile` from `../types`), add `export type QuestKind = 'board' | 'oracle' | 'boss'; export type QuestStatus = ...; export type DragonStage = ...; export type Tint = ...; export type ScrollKey = ...; export type RewardKind = ...; export const LIEUTENANT_ORDER = ['hydre','echo','chimere','protee','sirenes','lethe'] as const; export type LieutenantKey = (typeof LIEUTENANT_ORDER)[number]; export interface WorldCatalog { lieutenants: {key: string; name: string; categories: string[]; technique: string; min_level: string; relic: string; glyph: string}[]; rewards: Record<string, {id: string; kind: RewardKind; name: string; desc: string; source: string}>; ranks: {xp: number; title: string}[]; tints: Tint[]; oracle_rewards: string[]; boss_rewards: Record<string, string>; mastery: {min_days: number; min_traps: number; rate: number}; quest_bonus: Record<string, number> }; export interface RewardOut { id: string; kind: RewardKind; name: string; desc: string; source: string; granted_at: string; equipped: boolean }`.

`api.ts` re-uses SP1's private `request<T>` — export it from `web/src/lib/api.ts` (`export async function request…`; one-word change) and build `worldApi` with the paths of the API table. Type-check: `scripts/npm.sh run check` → no errors.

- [ ] **Step 3: `motion.ts`, `soundStore`, `sfx.ts` with a scheduling test**

`motion.ts`: `export function reducedMotion() { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; }`.

`soundStore.svelte.ts`: `export const soundStore = $state({ muted: false })`; `initSound(profile)` reads `profile.settings.mute ?? localStorage 'discorde.mute' === '1'`; `setMuted(profileId, muted)` sets the store, writes localStorage (try/catch) and `api.profiles.patch(profileId, { settings: { mute: muted } })` (errors swallowed — sound is a convenience). Add `mute?: boolean; weekly_goal?: number; onboarded?: boolean` to `ProfileSettings` in `web/src/lib/types.ts` (three optional fields, additive).

`sfx.ts` — synthesised sounds, short (≤ 600 ms), quiet (peak gain 0.25):
```ts
type Ctx = BaseAudioContext;
let ctx: AudioContext | null = null;
export function unlockAudio() { try { ctx ??= new AudioContext(); if (ctx.state === 'suspended') void ctx.resume(); } catch { ctx = null; } }
function tone(ctx: Ctx, at: number, freq: number, dur: number, type: OscillatorType, gain = 0.2, glideTo?: number) {
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, at); if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, at + dur);
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(gain, at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(ctx.destination); o.start(at); o.stop(at + dur + 0.02);
}
function noise(ctx: Ctx, at: number, dur: number, gain = 0.15) { /* AudioBufferSource of white noise, lowpass 1200 Hz, same envelope */ }
export function renderSfx(name: Sfx, ctx: Ctx, at: number) {
  switch (name) {
    case 'tap': tone(ctx, at, 660, 0.06, 'sine', 0.12); break;
    case 'seal': noise(ctx, at, 0.12, 0.2); tone(ctx, at + 0.05, 220, 0.18, 'triangle', 0.15, 110); break;      // wax crack
    case 'unroll': noise(ctx, at, 0.35, 0.08); tone(ctx, at, 330, 0.35, 'sine', 0.06, 440); break;                // paper slide
    case 'chime': [523, 659, 784].forEach((f, i) => tone(ctx, at + i * 0.09, f, 0.35, 'sine', 0.18)); break;      // C–E–G
    case 'growth': [392, 523, 659, 784, 1047].forEach((f, i) => tone(ctx, at + i * 0.11, f, 0.5, 'triangle', 0.2)); break;
    case 'hmpf': tone(ctx, at, 180, 0.22, 'sawtooth', 0.1, 120); break;                                            // Éris, displeased
    case 'laurel': [784, 988].forEach((f, i) => tone(ctx, at + i * 0.12, f, 0.3, 'sine', 0.15)); break;
  }
}
export function playSfx(name: Sfx) { if (soundStore.muted || !ctx) return; try { renderSfx(name, ctx, ctx.currentTime); } catch { /* ignore */ } }
```
`sfx.test.ts` uses a minimal stub context (`createOscillator`/`createGain`/`createBuffer`/`createBufferSource`/`createBiquadFilter` returning chainable objects that record `start` calls) and asserts: every `Sfx` name schedules ≥ 1 oscillator/buffer start; every scheduled node stops within 0.7 s of `at`; `playSfx` is a no-op when `soundStore.muted` is true (no `ctx` needed: set `muted` and call — no throw). Run: `scripts/npm.sh run test -- sfx` → PASS.

- [ ] **Step 4: `app.css` additions and the four juice components**

`app.css` (append):
```css
:root { --violet: #5b2c83; --violet-dark: #1b1421; --gold-light: #f1dc9a; --olive-light: #e4e9d3; }
@keyframes float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
@keyframes pop { 0% { transform: scale(.6); opacity: 0 } 70% { transform: scale(1.06); opacity: 1 } 100% { transform: scale(1) } }
@keyframes fade-up { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: none } }
@keyframes shimmer { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }
@keyframes wobble { 0%,100% { transform: rotate(0) } 25% { transform: rotate(-3deg) } 75% { transform: rotate(3deg) } }
.parchment { background: linear-gradient(#fbf6ea, #f1e7d0); border: 1px solid #d9c9a3; border-radius: 10px; box-shadow: inset 0 0 24px rgba(120, 90, 30, .12), 0 2px 6px rgba(43,42,40,.12); }
.scene { position: relative; background-size: cover; background-position: center bottom; border-radius: var(--radius); overflow: hidden; }
.scene::after { content: ''; position: absolute; inset: 0; background: linear-gradient(rgba(244,239,230,.75), rgba(244,239,230,.15) 35%, rgba(244,239,230,0)); pointer-events: none; }
.eris-panel { background: linear-gradient(135deg, var(--violet-dark), var(--violet)); color: var(--marble); border-radius: var(--radius); }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .001ms !important; animation-iteration-count: 1 !important; transition-duration: .001ms !important; scroll-behavior: auto !important; }
}
```
`Particles.svelte`: `<canvas>` absolutely positioned over its parent (`position:absolute; inset:0; pointer-events:none`); `$effect` on `trigger`: if `reducedMotion()` return; spawn 40 (`burst`: gold/terracotta dots radiating), 25 (`sparkle`: slow gold twinkles) or 12 (`laurel`: olive leaves falling) particles and animate with `requestAnimationFrame` for ≤ 1.2 s, then clear; cancel on destroy. `Reveal.svelte`: wrapper `<div class="reveal" style="animation-delay:{delay}ms">{@render children()}</div>` with `animation: fade-up .45s both`. `Medallion.svelte`: 72 px circle, `border: 3px solid var(--gold)`, radial gold gradient, glyph centred, `locked` → greyscale + « ? » glyph + `aria-label="Récompense à découvrir"`. `Gauge.svelte`: `<div role="progressbar" aria-valuenow={value} aria-valuemax={max}>` with label and `value / max` text; fill olive; width transition `.6s`.

`scripts/npm.sh run check` → no errors. Quick visual check in `scripts/dev.sh` is optional here (components are exercised by Task 5).

- [ ] **Step 5: Commit**

```bash
git add web/public/art web/src/lib/world/art.ts web/src/lib/world/art.test.ts web/src/lib/world/types.ts web/src/lib/world/api.ts web/src/lib/api.ts web/src/lib/types.ts web/src/lib/juice web/src/components/juice web/src/app.css
git commit -m "Add SP3 web foundation: served art, world types and API client, motion/sound/particle juice" -- web/public/art web/src/lib/world/art.ts web/src/lib/world/art.test.ts web/src/lib/world/types.ts web/src/lib/world/api.ts web/src/lib/api.ts web/src/lib/types.ts web/src/lib/juice web/src/components/juice web/src/app.css
```

---

### Task 5: Camp hub, routes with query params, derived categories, onboarding, weekly goal, break timer (web lane)

Spec §2 (the camp is the hub), §3.6 (weekly goal, break after ~25 min), Decisions 2, 14, 15, 16, 22. **Touches SP2 files** (`routes.ts`, `App.svelte`, `Play.svelte`, `Library.svelte`): rebase first, minimal insertions.

**Files:**
- Create: `web/src/lib/world/derived.ts`, `web/src/lib/world/derived.test.ts`, `web/src/lib/world/playClock.svelte.ts`, `web/src/lib/world/playClock.test.ts`, `web/src/lib/world/campStore.svelte.ts`, `web/src/screens/Camp.svelte`, `web/src/components/Onboarding.svelte`, `web/src/components/BreakNudge.svelte`
- Modify: `web/src/lib/routes.ts` (+ `routes.test.ts`), `web/src/App.svelte`, `web/src/components/TopBar.svelte`, `web/src/screens/ProfilePicker.svelte`, `web/src/screens/ProfileCreate.svelte`, `web/src/screens/Play.svelte` (derived categories, play clock, break nudge), `web/src/screens/Settings.svelte` (mute, weekly goal), `web/e2e/happy-path.spec.ts`, `web/e2e/profiles.spec.ts`, `web/e2e/seed.spec.ts`, `web/e2e/helpers.ts` (camp → library step)

**Interfaces:**
- Consumes: Task 4 (`worldApi`, `ART`, `Particles`, `Reveal`, `Gauge`, `soundStore`, `playSfx`, `unlockAudio`); SP1 `gradeSession`, `gradeText`, `mapAnnotation` (`$lib/grading`), `SessionResult`, `Annotation`; SP2 `isProphecy`/`formatSwissDate` from `$lib/dates` (**SP2 fallback:** local `formatSwissDate` in `Camp.svelte`).
- Produces:
  ```ts
  // derived.ts
  export const DERIVED_KEYS = ['derived:sirenes', 'derived:lethe'] as const;
  export function sireneLike(annots: (AnnotToken | undefined)[], chains: Chain[] | undefined, refIndex: number): boolean;
  export function letheCut(refTokenCount: number): number;                          // Math.floor(2/3 · n)
  export function withDerivedCategories(result: SessionResult, reference: string, draft: string, annotation: Annotation | null): SessionResult;
  // playClock.svelte.ts
  export const playClock: { activeMs: number; needsBreak: boolean };   // needsBreak = activeMs >= 25 min
  export function clockStart(): void; export function clockStop(): void; export function clockReset(): void; export function clockTick(now = Date.now()): void
  // routes.ts
  export interface Route { name: RouteName; params: Record<string, string>; query: Record<string, string> }   // query added (default {})
  new RouteNames: 'camp' | 'dossier' | 'bestiaire' | 'bestiaire-entry' | 'lieutenant' | 'oracle' | 'quests' | 'boss' | 'dragon' | 'cabin'
  export function href(name, params, query?: Record<string, string>): string   // appends ?k=v when query given
  // campStore.svelte.ts
  export const campStore: { data: CampResponse | null; loading: boolean; error: string }; export async function refreshCamp(profileId: number): Promise<void>
  ```
  `data-testid`s used by Tasks 9–10: `camp-parchemins`, `camp-oracle`, `camp-quests`, `camp-bestiary`, `camp-cabin`, `camp-dossier`, `camp-dragon`, `camp-boss`, `camp-prophecy`, `camp-xp`, `camp-weekly`, `onboarding-next`, `onboarding-skip`, `topbar-mute`, `topbar-camp`, `break-nudge`, `break-pause`, `break-continue`.

- [ ] **Step 1: Failing tests for `derived.ts`, `playClock`, routes**

```ts
// derived.test.ts
import { describe, it, expect } from 'vitest';
import { gradeSession } from '$lib/grading';
import type { Annotation, AnnotToken } from '$lib/grading/types';
import { letheCut, sireneLike, withDerivedCategories } from './derived';

function tok(i: number, text: string, start: number, extra: Partial<AnnotToken> = {}): AnnotToken {
  return { i, text, start, end: start + text.length, lemma: text, pos: 'NOUN', morph: {}, head: i, dep: 'dep', categories: [], homophone: null, subject: null, ...extra };
}
describe('sireneLike', () => {
  it('flags relative qui, long distance, inversion and object pronoun (v2 chains)', () => {
    const annots = [tok(0, 'a', 0), tok(1, 'b', 2), tok(2, 'c', 4), tok(3, 'd', 6), tok(4, 'e', 8, { pos: 'PRON', dep: 'obj' }), tok(5, 'f', 10, { pos: 'VERB' })];
    const chain = (o: object) => ({ id: 0, kind: 'subject_verb', controller: 3, controller_group: [3], targets: [5], via: null, via_token: null, features: {}, confidence: 'high', distance: 2, rule: null, ...o }) as never;
    expect(sireneLike(annots, [chain({})], 5)).toBe(true);                        // pronoun 'e' between d and f
    expect(sireneLike(annots, [chain({ controller: 4, targets: [5], distance: 1 })], 5)).toBe(false);
    expect(sireneLike(annots, [chain({ controller: 0, distance: 5 })], 5)).toBe(true);
    expect(sireneLike(annots, [chain({ via: 'qui', controller: 4, distance: 1 })], 5)).toBe(true);
    expect(sireneLike(annots, [chain({ controller: 4, distance: 1, confidence: 'low', via: 'qui' })], 5)).toBe(false);
  });
  it('falls back to the v1 subject field', () => {
    const annots = [tok(0, 'a', 0), tok(1, 'b', 2), tok(2, 'c', 4), tok(3, 'd', 6), tok(4, 'e', 8), tok(5, 'f', 10, { pos: 'VERB', subject: 0 })];
    expect(sireneLike(annots, undefined, 5)).toBe(true);
    annots[5].subject = 4;
    expect(sireneLike(annots, undefined, 5)).toBe(false);
  });
});
describe('withDerivedCategories', () => {
  const ref = Array.from({ length: 30 }, (_, i) => (i === 29 ? 'fin.' : `mot${i}`)).join(' ');   // 30 words: cut at token 20
  it('adds derived:lethe from the last third and leaves the original categories intact', () => {
    const draft = ref.replace('mot25', 'moX25').replace('mot3', 'moX3');
    const base = gradeSession(ref, draft, draft, null, { paceLevel: 1 });
    const out = withDerivedCategories(base, ref, draft, null);
    expect(out.byCategory.lexical).toEqual(base.byCategory.lexical);
    expect(out.byCategory['derived:lethe' as never]).toMatchObject({ draft: 1, caught: 0, missed: 1 });
    expect(out.byCategory['derived:lethe' as never].opportunities).toBeGreaterThanOrEqual(10);
  });
  it('skips lethe on short texts and sirenes without annotation', () => {
    const short = 'Les fées dansent dans la clairière.';
    const out = withDerivedCategories(gradeSession(short, short, short, null, { paceLevel: 1 }), short, short, null);
    expect(out.byCategory['derived:lethe' as never]).toBeUndefined();
    expect(out.byCategory['derived:sirenes' as never]).toBeUndefined();
  });
  it('letheCut is the floor of two thirds', () => { expect(letheCut(30)).toBe(20); expect(letheCut(31)).toBe(20); });
});
```
Léthé requires ≥ 60 words, so in the test replace the `ref` builder with `length: 90` (cut at token 60), plant the errors at `mot75` and `mot3`, and expect `opportunities ≥ 25`; the comment `// 30 words` becomes `// 90 words: cut at token 60`. `sireneLike` receives `annots` indexed by *reference token index* (result of `mapAnnotation`) — in the tests the two indexings coincide.

```ts
// playClock.test.ts
import { describe, it, expect } from 'vitest';
import { clockReset, clockStart, clockStop, clockTick, playClock } from './playClock.svelte';
describe('playClock', () => {
  it('accumulates only while started and flags 25 minutes', () => {
    clockReset(); clockStart(); clockTick(0); clockTick(10 * 60_000);
    expect(playClock.activeMs).toBe(10 * 60_000); expect(playClock.needsBreak).toBe(false);
    clockStop(); clockTick(20 * 60_000); expect(playClock.activeMs).toBe(10 * 60_000);
    clockStart(); clockTick(20 * 60_000); clockTick(36 * 60_000); expect(playClock.needsBreak).toBe(true);
  });
  it('resets after ten idle minutes', () => {
    clockReset(); clockStart(); clockTick(0); clockTick(5 * 60_000); clockStop();
    clockStart(); clockTick(16 * 60_000); expect(playClock.activeMs).toBe(0);
  });
});
```
`routes.test.ts` additions: `matchRoute('#/p/3/camp')` → `{name:'camp', params:{profileId:'3'}, query:{}}`; `'#/p/3/parchemins'` → `library`; `'#/p/3/play/12?quest=7&encounter=eris&help=3'` → `play` with `query: {quest:'7', encounter:'eris', help:'3'}`; `'#/p/3/monstres/hydre'` → `lieutenant` with `key`; `'#/p/3/bestiaire/echo'` → `bestiaire-entry`; `'#/p/3/delphes'`, `'#/p/3/quetes'`, `'#/p/3/eris'`, `'#/p/3/dragon'`, `'#/p/3/cabane'`, `'#/p/3/dossier'`; `href('play', {profileId:'3', textId:'12'}, {quest:'7'})` → `'#/p/3/play/12?quest=7'`; `href('library', {profileId:'3'})` → `'#/p/3/parchemins'`. Existing SP1 tests asserting `#/p/3/camp` → `library` must be updated to `camp`. Run: `scripts/npm.sh run test -- derived playClock routes` → FAIL.

- [ ] **Step 2: Implement `derived.ts`, `playClock.svelte.ts`, `routes.ts`**

`derived.ts`:
```ts
import { gradeText, mapAnnotation } from '$lib/grading';
import type { Annotation, AnnotToken, CategoryStat, Chain, SessionResult, TokenError } from '$lib/grading/types';
export const DERIVED_KEYS = ['derived:sirenes', 'derived:lethe'] as const;
const LETHE_MIN_WORDS = 60;
function pronBetween(annots: (AnnotToken | undefined)[], a: number, b: number) {
  for (let j = Math.min(a, b) + 1; j < Math.max(a, b); j++) { const t = annots[j]; if (t && t.pos === 'PRON' && t.dep !== 'nsubj') return true; }
  return false;
}
export function sireneLike(annots, chains, refIndex) {
  const a = annots[refIndex]; if (!a) return false;
  if (chains && chains.length) {
    for (const ch of chains) {
      if (ch.kind !== 'subject_verb' || ch.confidence === 'low' || !ch.targets.includes(a.i)) continue;
      const c = ch.controller;   // chain ids are annotation token ids; map to ref indices through annots[].i
      const cRef = annots.findIndex((t) => t?.i === c);
      if (ch.via === 'qui' || ch.distance >= 4 || c > a.i || (cRef >= 0 && pronBetween(annots, cRef, refIndex))) return true;
    }
    return false;
  }
  if (a.subject === null || a.subject === undefined) return false;
  const sRef = annots.findIndex((t) => t?.i === a.subject);
  return Math.abs(a.subject - a.i) >= 4 || a.subject > a.i || (sRef >= 0 && pronBetween(annots, sRef, refIndex));
}
export function letheCut(n: number) { return Math.floor((2 * n) / 3); }
function stat(errs: TokenError[], caughtKeys: Set<string>, pick: (e: TokenError) => boolean, opportunities: number, introduced: TokenError[], key: (e: TokenError) => string): CategoryStat {
  const draft = errs.filter(pick); const caught = draft.filter((e) => caughtKeys.has(key(e))).length;
  return { opportunities, draft: draft.length, caught, missed: draft.length - caught, introduced: introduced.filter(pick).length };
}
export function withDerivedCategories(result, reference, draft, annotation) {
  const grade = gradeText(reference, draft, annotation);          // reference tokens + alignment of the DRAFT
  const annots = mapAnnotation(grade.refTokens, annotation);
  const words = grade.refTokens.filter((t) => t.kind === 'word');
  const key = (e: TokenError) => `${e.refIndex}:${e.anchor}:${e.expected}:${e.typed}`;   // same identity as grading's errorKey — import errorKey from '$lib/grading' if exported
  const caughtKeys = new Set(result.caught.map(key));
  const byCategory = { ...result.byCategory } as Record<string, CategoryStat>;
  if (words.length >= LETHE_MIN_WORDS) {
    const cut = letheCut(grade.refTokens.length);
    const inLast = (e: TokenError) => (e.refIndex ?? e.anchor) >= cut;
    byCategory['derived:lethe'] = stat(result.draftErrors, caughtKeys, inLast, grade.refTokens.filter((t, i) => i >= cut && t.kind === 'word').length, result.introduced, key);
  }
  if (annotation) {
    const isSirene = (i: number) => annots[i]?.categories.includes('verb') && sireneLike(annots, annotation.chains, i);
    const opportunities = grade.refTokens.reduce((n, _t, i) => n + (isSirene(i) ? 1 : 0), 0);
    if (opportunities > 0) {
      const pick = (e: TokenError) => e.category === 'agreement' && e.refIndex !== null && isSirene(e.refIndex);
      byCategory['derived:sirenes'] = stat(result.draftErrors, caughtKeys, pick, opportunities, result.introduced, key);
    }
  }
  return { ...result, byCategory: byCategory as SessionResult['byCategory'] };
}
```
Use the grading module's exported `errorKey` (Results.svelte imports it from `$lib/grading`) instead of the local `key` if it exists — same identity, one implementation.

`playClock.svelte.ts`: `$state({ activeMs: 0, running: false, lastTick: null as number | null, lastStop: null as number | null })` persisted to `sessionStorage 'discorde.playClock'` (try/catch) on every tick; `clockTick(now)`: if `running && lastTick !== null` add `now - lastTick` (capped at 60 s per tick so a sleeping tab does not inflate); `clockStart()`: if `lastStop !== null && now - lastStop >= 10 min` → `activeMs = 0`; `running = true; lastTick = null`; `clockStop()`: `running = false; lastStop = now`; `needsBreak` is a `$derived(activeMs >= 25 * 60_000)` exposed as a getter on the exported object. Also listen to `visibilitychange` in `clockStart` (hidden → `clockStop()`, visible → `clockStart()`) — guard `typeof document`.

`routes.ts`: split `hash` on the first `?`, parse the query with `URLSearchParams` into a plain object; add the patterns (`camp`: `['p', id, 'camp']`; `library`: `['p', id, 'parchemins']`; `dossier`; `bestiaire`; `bestiaire-entry`: `[..., 'bestiaire', {param:'key'}]`; `lieutenant`: `['p', id, 'monstres', {param:'key'}]`; `oracle`: `delphes`; `quests`: `quetes`; `boss`: `eris`; `dragon`; `cabin`: `cabane`) and the `href` cases (+ optional `query` argument appended as `?` + `URLSearchParams`). Run: `scripts/npm.sh run test -- derived playClock routes` → PASS.

- [ ] **Step 3: `campStore`, `Camp.svelte`, `Onboarding.svelte`**

`campStore.svelte.ts`: `$state({ data: null, loading: false, error: '' })`; `refreshCamp(profileId)` calls `worldApi.camp`, maps `ApiError.detail`.

`Camp.svelte` (props `profile`): `<TopBar {profile} title="Le camp" />`; on mount `refreshCamp(profile.id)` and `initSound(profile)`. Layout: a `.scene` header with `background-image: url(ART.scenes.camp)` (height 34 vh landscape / 26 vh portrait) holding, in the calm upper third: greeting `Bienvenue au camp, {profile.name}.` (h1), rank line `data-testid="camp-xp"`: `{title} · {total} XP` with a `<Gauge value={total - rank_floor} max={next_threshold - rank_floor}>` (or « Rang maximal » when `next_threshold` is null), and the weekly laurels `data-testid="camp-weekly"`: `target` leaf glyphs (🌿) filled olive for `done`, caption `Objectif de la semaine : {done} / {target} textes` — when `reached`: `Objectif atteint ! Les Muses sont fières.` (never any text about missing it). Below the scene a `.dragon-card` `data-testid="camp-dragon"` (tap → `href('dragon')`): stage art from `ART.dragon[stage]` (for the egg: `float` animation; `img loading="eager" decoding="async"`), name or `Un œuf de dragon` and a speech bubble: egg → `L'œuf frémit chaque fois qu'un piège d'Éris est déjoué.`; hatchling → `{name} te regarde avec de grands yeux ambre.`; young → `{name} bat des ailes : encore {n} technique(s) à neutraliser.`; adult → `{name} veille sur le camp. Éris n'a qu'à bien se tenir.` Then a grid of `.card` buttons (each with a Medallion-like glyph, title, subtitle):
- `camp-parchemins` « Les Parchemins » / `{n} textes à protéger` (n from `api.texts.list` count — or omit the count and say `La bibliothèque du camp`) → `href('library')`
- `camp-oracle` « Delphes — l'Oracle » / sealed: `Trois rouleaux scellés t'attendent cette semaine.` (gold dot badge) ; chosen: `L'Oracle a parlé. Quête en cours.` → `href('oracle')`
- `camp-quests` « Tableau des quêtes » / `{active} quête(s) en cours` → `href('quests')`
- `camp-bestiary` « Bestiaire et monstres » / `{neutralised} sur {available} ruse(s) neutralisée(s) · les vrais mythes` → `href('bestiaire')` (the bestiary lists the six lieutenants with their status and links each to its `lieutenant` page; there is no separate `camp-monsters` card).
- `camp-dossier` « Le dossier d'Éris » / `« Ses points faibles »… selon elle` → `href('dossier')`
- `camp-cabin` « Ta cabane » / `{rewards_count} trésor(s)` → `href('cabin')`
Above the grid, conditional banners: `camp-prophecy` when `prophecies.length > 0`: `.parchment` « Prophétie de l'Oracle : {title} — dictée le {formatSwissDate(due_date)} ({days_left === 0 ? "aujourd'hui" : `dans ${days_left} jour(s)`}) » with button `Réviser` → `href('play', {textId})`; `camp-boss` when `boss.tier_available !== null || boss.active_quest_id !== null`: `.eris-panel` with `ART.erisSmug` (height 120 px) « Éris t'attend au bord du camp. » / `Combat {tier} : {reward name known in advance}` → `href('boss')`. When the camp store has an error: `Impossible de rejoindre le camp : {error}` in orange with a `Réessayer` button. `playSfx('tap')` on card taps (after `unlockAudio()`).

`Onboarding.svelte` (shown by Camp when `!profile.settings.onboarded`): a modal `.parchment` with three steps, `Reveal` on each: 1 `Les Muses ont choisi un héros : toi.` / `Tu protèges les textes contre Éris, la déesse de la Discorde.` (epicene, Decision 20); 2 `Éris sème des dés-accords.` / `Un -s oublié, un a pour un à… Ses lieutenants sont chacun une ruse. Relis, une chose à la fois, et ils tombent.`; 3 `Un œuf t'a été confié.` / `Il éclora quand tu auras neutralisé la première ruse d'Éris. Tu lui donneras un nom.` Buttons `onboarding-next` « Suivant » / last step « Entrer au camp », and `onboarding-skip` « Passer ». On finish: `api.profiles.patch(profile.id, { settings: { onboarded: true } })` and `profileStore.current = updated`.

- [ ] **Step 4: Wire `App.svelte`, `TopBar`, `ProfilePicker`, `ProfileCreate`, `Settings`, `Play`, `BreakNudge`, e2e expectations**

`App.svelte`: add `{:else if route.name === 'camp'}<Camp profile={gateProfile} />` (routes for Tasks 6–8 are added by those tasks). `ProfilePicker.pick` and `ProfileCreate` submit → `navigate(href('camp', …))`. `TopBar`: add first link `topbar-camp` (`🏕️` « Camp » → `href('camp')`), keep « Progrès » but point it to `href('dossier')` (Task 6 adds the route; until then the fallback in `App.svelte` shows the profile picker — acceptable within the lane, the same task series lands both), add `<button class="link" data-testid="topbar-mute" aria-pressed={soundStore.muted} onclick={toggle}>` with `🔊`/`🔇` and label « Son » — `toggle` calls `unlockAudio()` then `setMuted(profile.id, !soundStore.muted)`. `Settings.svelte`: new sections « Son » (checkbox `Couper les sons du jeu (la dictée reste lue)` bound to `soundStore.muted` via `setMuted`) and « Objectif de la semaine » (`<select id="weekly-goal">` 2–5, saved in `settings.weekly_goal` with the existing form). `Library.svelte` subtitle unchanged; nothing else.

`Play.svelte` (three localised insertions): (1) `computeResult()`: wrap — `result = withDerivedCategories(gradeSession(...), text.body, playState.draft, text.annotation as Annotation)`; (2) an `$effect` on `playState?.phase`: `dictation`/`proofreading` → `clockStart()`, otherwise `clockStop()`; `clockTick()` every 15 s with `setInterval` while running (clear on destroy); (3) in the results branch, above `<Results …>`: `{#if playClock.needsBreak}<BreakNudge dragonName={campStore.data?.dragon.name ?? 'Ton dragon'} onPause={toLibraryCamp} onContinue={() => clockReset()} />{/if}` where `toLibraryCamp` clears play state and navigates to `href('camp')`. `BreakNudge.svelte` (`data-testid="break-nudge"`): `.parchment` with the dragon's current stage art (small) and `« {dragonName} bâille : ça fait vingt-cinq minutes qu'on chasse les pièges. On souffle un peu ? »`, buttons `break-pause` « Pause » and `break-continue` « Encore un texte ».

e2e updates (SP1 specs): after profile creation, expect `page.getByRole('heading', { name: /Bienvenue au camp/ })`, then click `page.getByTestId('camp-parchemins')` before expecting « Les Parchemins ». In `helpers.ts` add `export async function goToLibrary(page, profileId)` = `page.goto('/#/p/' + profileId + '/parchemins')`; SP2's `createProfile` helper (if present) ends with a click on `camp-parchemins`. Also dismiss onboarding in new-profile flows: `await page.getByTestId('onboarding-skip').click()` right after the camp heading appears (make the helper `skipOnboarding(page)` tolerant: `if (await btn.isVisible()) await btn.click()`).

Run: `scripts/npm.sh run check` and `scripts/npm.sh run test` → green; `scripts/playwright.sh e2e/happy-path.spec.ts e2e/profiles.spec.ts e2e/seed.spec.ts` → green (server lane Tasks 1–2 must be merged for `/camp`; if not yet, run again at Task 9 and say so).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/world/derived.ts web/src/lib/world/derived.test.ts web/src/lib/world/playClock.svelte.ts web/src/lib/world/playClock.test.ts web/src/lib/world/campStore.svelte.ts web/src/screens/Camp.svelte web/src/components/Onboarding.svelte web/src/components/BreakNudge.svelte web/src/lib/routes.ts web/src/lib/routes.test.ts web/src/App.svelte web/src/components/TopBar.svelte web/src/screens/ProfilePicker.svelte web/src/screens/ProfileCreate.svelte web/src/screens/Play.svelte web/src/screens/Settings.svelte web/e2e/happy-path.spec.ts web/e2e/profiles.spec.ts web/e2e/seed.spec.ts web/e2e/helpers.ts
git commit -m "Add the camp hub as home: routes with queries, derived Sirènes/Léthé categories, onboarding, weekly goal, break nudge" -- web/src/lib/world/derived.ts web/src/lib/world/derived.test.ts web/src/lib/world/playClock.svelte.ts web/src/lib/world/playClock.test.ts web/src/lib/world/campStore.svelte.ts web/src/screens/Camp.svelte web/src/components/Onboarding.svelte web/src/components/BreakNudge.svelte web/src/lib/routes.ts web/src/lib/routes.test.ts web/src/App.svelte web/src/components/TopBar.svelte web/src/screens/ProfilePicker.svelte web/src/screens/ProfileCreate.svelte web/src/screens/Play.svelte web/src/screens/Settings.svelte web/e2e/happy-path.spec.ts web/e2e/profiles.spec.ts web/e2e/seed.spec.ts web/e2e/helpers.ts
```

---

### Task 6: Éris's file « Ses points faibles », bestiary with real myths, lieutenant pages (web lane)

Spec §2 (Éris keeps a file in her voice; taunts about her own tricks; bestiary teaches real myths), §3.6. Decisions 1, 13, 19, 20.

**Files:**
- Create: `web/src/lib/world/eris.ts`, `web/src/lib/world/eris.test.ts`, `web/src/lib/world/bestiary.ts`, `web/src/lib/world/bestiary.test.ts`, `web/src/screens/Dossier.svelte`, `web/src/screens/Bestiaire.svelte`, `web/src/screens/BestiaireEntry.svelte`, `web/src/screens/Lieutenant.svelte`
- Modify: `web/src/App.svelte` (routes `dossier`, `bestiaire`, `bestiaire-entry`, `lieutenant`)

**Interfaces:**
- Consumes: Task 4 (`worldApi`, `ART`, `Medallion`, `Gauge`, `Reveal`, `playSfx`), Task 5 (`campStore`, `href` with new routes), SP1 `api.profiles.stats` (`trap_words`, `recent_sessions`).
- Produces:
  ```ts
  // eris.ts
  export type Band = 'none' | 'strong' | 'contested' | 'weak' | 'neutralised';
  export function bandFor(l: LieutenantState): Band;                 // neutralised → 'neutralised'; all_time.traps < 3 → 'none'; rate < .4 strong; < .8 contested; else weak
  export function dossierLine(key: LieutenantKey, band: Band): string;
  export function dossierIntro(name: string, sessions: number): string;
  export function smallTricksLine(traps: number, caught: number): string;
  export function campGreeting(hour: number): string;                // « Bonjour », « Bonsoir »… no guilt, no streak talk
  export const FORBIDDEN: string[];                                  // Decision 19 list, exported for the test
  // bestiary.ts
  export interface BestiaryEntry { key: string; name: string; kind: 'monster' | 'boss' | 'tool' | 'place' | 'companion'; art: string;
    teaser: string; facts: string[]; sources: string; inGame: string }
  export const BESTIARY: BestiaryEntry[];                            // 14 entries, order: 6 monsters, eris, argus, ariane, persee, athena, muses, delphes, dragon
  export function entry(key: string): BestiaryEntry | undefined;
  ```
  `data-testid`s: `dossier-line-{key}`, `dossier-small-tricks`, `bestiary-card-{key}`, `bestiary-locked`, `lieutenant-gauge-days`, `lieutenant-gauge-traps`, `lieutenant-rate`, `lieutenant-quest`, `lieutenant-grimoire`, `lieutenant-text-{id}`, `lieutenant-neutralised`.

- [ ] **Step 1: Failing tests**

```ts
// eris.test.ts
import { describe, it, expect } from 'vitest';
import { FORBIDDEN, bandFor, dossierLine } from './eris';
import { LIEUTENANT_ORDER } from './types';
const BANDS = ['none', 'strong', 'contested', 'weak', 'neutralised'] as const;
describe("Éris's dossier lines", () => {
  it('exist for every lieutenant × band and are distinct', () => {
    const all = LIEUTENANT_ORDER.flatMap((k) => BANDS.map((b) => dossierLine(k, b)));
    expect(all.every((s) => s.length > 20)).toBe(true);
    expect(new Set(all).size).toBe(all.length);
  });
  it('never target the player (Decision 19)', () => {
    for (const k of LIEUTENANT_ORDER) for (const b of BANDS) {
      const line = dossierLine(k, b).toLowerCase();
      for (const w of FORBIDDEN) expect(line, `${k}/${b} contains "${w}"`).not.toContain(w);
    }
  });
  it('bands follow the thresholds', () => {
    const l = (traps: number, rate: number | null, neutralised = false) =>
      ({ neutralised, all_time: { traps, caught: 0, missed: 0, rate } }) as never;
    expect(bandFor(l(2, 0))).toBe('none'); expect(bandFor(l(5, 0.3))).toBe('strong');
    expect(bandFor(l(5, 0.5))).toBe('contested'); expect(bandFor(l(5, 0.85))).toBe('weak'); expect(bandFor(l(5, 0.1, true))).toBe('neutralised');
  });
});
```
```ts
// bestiary.test.ts
import { describe, it, expect } from 'vitest';
import { BESTIARY, entry } from './bestiary';
import { LIEUTENANT_ORDER } from './types';
describe('bestiary', () => {
  it('has an entry per lieutenant plus Éris, four tools, the Muses, Delphes and the dragon', () => {
    for (const k of LIEUTENANT_ORDER) expect(entry(k)?.kind).toBe('monster');
    expect(BESTIARY.map((e) => e.key)).toEqual([...LIEUTENANT_ORDER, 'eris', 'argus', 'ariane', 'persee', 'athena', 'muses', 'delphes', 'dragon']);
  });
  it('every entry separates myth from game fiction and cites sources', () => {
    for (const e of BESTIARY) {
      expect(e.facts.length).toBeGreaterThanOrEqual(3);
      expect(e.sources.length).toBeGreaterThan(5);
      expect(e.inGame.length).toBeGreaterThan(10);
      expect(e.art.startsWith('/art/')).toBe(true);
    }
  });
});
```
Run: `scripts/npm.sh run test -- eris bestiary` → FAIL.

- [ ] **Step 2: `eris.ts`**

```ts
import type { LieutenantKey, LieutenantState } from './types';
export type Band = 'none' | 'strong' | 'contested' | 'weak' | 'neutralised';
export const FORBIDDEN = ['nul', 'nulle', 'mauvais', 'mauvaise', 'incapable', 'bête', 'idiot', 'idiote', 'tu es', "tu n'es", 'tu ne sais', "tu n'arrives", 'faible'];
export function bandFor(l: LieutenantState): Band {
  if (l.neutralised) return 'neutralised';
  const { traps, rate } = l.all_time;
  if (traps < 3 || rate === null) return 'none';
  return rate < 0.4 ? 'strong' : rate < 0.8 ? 'contested' : 'weak';
}
const LINES: Record<LieutenantKey, Record<Band, string>> = {
  hydre: {
    none: "Mon Hydre n'a pas encore montré ses têtes dans ces textes. Patience : elles repoussent vite.",
    strong: "Les têtes de mon Hydre se glissent dans les pluriels et personne ne les remarque. Délicieux.",
    contested: "Une tête coupée sur deux. L'Hydre s'énerve, et moi aussi.",
    weak: "Mon Hydre ne trouve presque plus de verbe où se cacher. Je vais devoir la nourrir.",
    neutralised: "L'Hydre est neutralisée. Je refuse d'en parler.",
  },
  echo: {
    none: "Écho attend son heure : a ou à, et ou est… elle répète, et on la croit.",
    strong: "Écho murmure et ses mots passent pour vrais. Mon meilleur tour.",
    contested: "Écho se fait démasquer une fois sur deux. Elle boude dans sa grotte.",
    weak: "Écho n'ose presque plus répéter. Ses échos s'éteignent, quelle tristesse.",
    neutralised: "Écho est réduite au silence. Ce n'est pas une grande perte. (Si.)",
  },
  chimere: {
    none: "Ma Chimère n'a pas encore rugi ici. Ses têtes se disputent le genre de chaque mot.",
    strong: "Un masculin ici, un féminin là : ma Chimère brouille tout et personne ne bronche.",
    contested: "La Chimère perd une tête sur deux. Elle ne sait plus laquelle rugir.",
    weak: "Ma Chimère se fait attraper presque à chaque fois. Ses trois têtes en rougissent.",
    neutralised: "La Chimère est neutralisée. Bellérophon n'aurait pas fait mieux… oubliez ce que j'ai dit.",
  },
  protee: {
    none: "Protée dort au fond de la mer. Ses participes changent de forme quand on les regarde.",
    strong: "Protée change de forme sous les yeux de tout le monde et personne ne le retient. Un artiste.",
    contested: "On retient Protée une fois sur deux. Il glisse encore, mais moins bien.",
    weak: "Protée n'arrive presque plus à se transformer sans être attrapé. Vexant.",
    neutralised: "Protée est neutralisé. On l'a tenu jusqu'à ce qu'il reprenne sa vraie forme. Je déteste ça.",
  },
  sirenes: {
    none: "Mes Sirènes n'ont pas encore chanté : elles éloignent le sujet de son verbe et attendent.",
    strong: "Le chant des Sirènes fait oublier le sujet à tout le monde. Mon plus beau tour.",
    contested: "Une phrase sur deux résiste au chant des Sirènes. Elles chantent plus fort.",
    weak: "Les Sirènes chantent dans le vide. Quelqu'un s'attache au mât, c'est agaçant.",
    neutralised: "Les Sirènes sont neutralisées. Elles ont perdu leur voix et moi mon calme.",
  },
  lethe: {
    none: "Léthé attend la fin des textes. C'est là que la vigilance s'endort.",
    strong: "Dans le dernier tiers, Léthé fait tout oublier. Personne ne relit jusqu'au bout. Exquis.",
    contested: "Léthé endort la fin des textes une fois sur deux. Elle trouve ça insuffisant.",
    weak: "Léthé n'endort presque plus personne. La fin des textes est relue. Scandaleux.",
    neutralised: "Léthé est neutralisée. Personne n'oublie plus la fin. Moi, j'aimerais oublier cette page.",
  },
};
export function dossierLine(key: LieutenantKey, band: Band): string { return LINES[key][band]; }
export function dossierIntro(name: string, sessions: number): string {
  if (sessions === 0) return `Dossier « ${name} ». Rien à signaler pour l'instant. Ça ne durera pas.`;
  return `Dossier « ${name} ». ${sessions} texte${sessions > 1 ? 's' : ''} surveillé${sessions > 1 ? 's' : ''} de près. Voici où mes ruses passent encore.`;
}
export function smallTricksLine(traps: number, caught: number): string {
  if (traps === 0) return "Mes petites ruses (accents, lettres, majuscules) n'ont pas encore servi.";
  return `Mes petites ruses (accents, lettres, majuscules) : ${traps} tentative${traps > 1 ? 's' : ''}, ${caught} déjouée${caught > 1 ? 's' : ''}. Je note.`;
}
export function campGreeting(hour: number): string {
  return hour < 5 ? 'Bonne nuit au camp.' : hour < 12 ? 'Bonjour au camp.' : hour < 18 ? 'Bel après-midi au camp.' : 'Bonsoir au camp.';
}
```
Run: `scripts/npm.sh run test -- eris` → PASS (if `FORBIDDEN` catches a word in a line — e.g. `faible` — reword the line, never the list).

- [ ] **Step 3: `bestiary.ts` — real myths in French**

Every fact below is from the classical sources named; keep them verbatim (they were checked against the sources), and keep « Au camp » clearly fictional.

```ts
import { ART } from './art';
export const BESTIARY: BestiaryEntry[] = [
  { key: 'hydre', name: "L'Hydre de Lerne", kind: 'monster', art: ART.lieutenants.hydre,
    teaser: "Un serpent d'eau à plusieurs têtes : quand on en coupe une, d'autres repoussent.",
    facts: ["L'Hydre vivait dans les marais de Lerne, près d'Argos. Elle est la fille de Typhon et d'Échidna, comme la Chimère.",
      "La tuer fut le deuxième des douze travaux d'Héraclès. À chaque tête coupée, deux repoussaient ; son neveu Iolaos brûla les cous avec des torches pour les empêcher de repousser.",
      "La tête du milieu était immortelle : Héraclès l'enterra sous un énorme rocher.",
      "Héraclès trempa ses flèches dans le venin de l'Hydre. Eurysthée refusa de compter ce travail, parce qu'Héraclès avait été aidé."],
    sources: 'Hésiode, Théogonie ; Apollodore, Bibliothèque, II, 5, 2.',
    inGame: "Au camp, l'Hydre sème les dés-accords de nombre : un pluriel oublié, et deux autres se cachent plus loin." },
  { key: 'echo', name: 'Écho', kind: 'monster', art: ART.lieutenants.echo,
    teaser: 'Une nymphe condamnée à ne répéter que les derniers mots des autres.',
    facts: ["Écho était une nymphe des montagnes (une oréade). Héra la punit parce qu'elle la retenait par ses bavardages pendant que Zeus s'échappait : elle ne pourrait plus que répéter les derniers mots entendus.",
      "Elle tomba amoureuse de Narcisse, qui la repoussa. De chagrin, elle se cacha dans les grottes et se consuma jusqu'à n'être plus qu'une voix.",
      "C'est d'elle que vient le mot « écho » : un son qui revient, répété par les rochers.",
      "Ovide raconte son histoire dans les Métamorphoses, juste avant celle de Narcisse qui tombe amoureux de son reflet."],
    sources: 'Ovide, Métamorphoses, livre III.',
    inGame: "Au camp, Écho répète un mot qui sonne juste mais s'écrit faux : a pour à, et pour est." },
  { key: 'chimere', name: 'La Chimère', kind: 'monster', art: ART.lieutenants.chimere,
    teaser: 'Lion, chèvre et serpent en une seule bête, qui crache le feu.',
    facts: ["Selon Hésiode, la Chimère avait trois têtes : une de lion, une de chèvre et une de serpent (dragon). Homère dit qu'elle soufflait du feu.",
      "Elle ravageait la Lycie, en Asie Mineure. Le héros Bellérophon la tua en volant sur le cheval ailé Pégase.",
      "Elle est la sœur de l'Hydre et de Cerbère : tous sont enfants de Typhon et d'Échidna.",
      "Aujourd'hui, une « chimère » désigne un rêve impossible ou une créature faite de morceaux qui ne vont pas ensemble."],
    sources: 'Homère, Iliade, VI ; Hésiode, Théogonie ; Apollodore, Bibliothèque, II, 3.',
    inGame: 'Au camp, ses têtes se disputent le genre des mots : un masculin ici, un féminin là.' },
  { key: 'protee', name: 'Protée', kind: 'monster', art: ART.lieutenants.protee,
    teaser: 'Le Vieillard de la mer, qui change de forme pour ne pas répondre.',
    facts: ["Protée est un dieu marin, gardien des troupeaux de phoques de Poséidon. Il connaît le passé, le présent et l'avenir, mais refuse de le dire.",
      "Pour échapper à ceux qui l'interrogent, il se transforme : lion, serpent, panthère, sanglier, eau qui coule, arbre…",
      "Dans l'Odyssée, Ménélas, conseillé par la fille de Protée, Idothée, le saisit et le tient fermement jusqu'à ce qu'il reprenne sa vraie forme et réponde.",
      "L'adjectif « protéiforme » vient de lui : qui change sans cesse de forme."],
    sources: 'Homère, Odyssée, chant IV.',
    inGame: 'Au camp, Protée change la forme des participes passés : -é, -ée, -és, -ées.' },
  { key: 'sirenes', name: 'Les Sirènes', kind: 'monster', art: ART.lieutenants.sirenes,
    teaser: 'Leur chant attire les marins vers les rochers.',
    facts: ["Dans l'Odyssée, Circé prévient Ulysse : le chant des Sirènes attire les marins vers la mort. Ulysse bouche les oreilles de ses compagnons avec de la cire et se fait attacher au mât pour écouter sans céder.",
      "Dans l'Antiquité, les Sirènes sont des femmes-oiseaux : un visage de femme sur un corps d'oiseau. Les sirènes à queue de poisson viennent du Moyen Âge.",
      "Le musicien Orphée, à bord du navire Argo, couvrit leur chant avec sa lyre pour sauver les Argonautes.",
      "Les Sirènes sont associées aux Muses : dans certaines légendes, elles ont perdu un concours de chant contre elles."],
    sources: 'Homère, Odyssée, chant XII ; Apollonios de Rhodes, Argonautiques, IV.',
    inGame: 'Au camp, leur chant éloigne le sujet de son verbe, le cache derrière un pronom ou le met après.' },
  { key: 'lethe', name: 'Léthé', kind: 'monster', art: ART.lieutenants.lethe,
    teaser: "Le fleuve de l'Oubli, aux Enfers.",
    facts: ["Léthé est un fleuve des Enfers : les âmes y boivent pour oublier leur vie passée avant de renaître.",
      "Chez Hésiode, Léthé (l'Oubli) est une fille d'Éris, la Discorde, avec la Peine, la Faim et les Querelles.",
      "Platon raconte dans la République qu'après avoir bu au fleuve, les âmes oublient tout ; Virgile place la scène dans l'Énéide.",
      "Son contraire est Mnémosyne, la Mémoire, mère des Muses. À l'oracle de Trophonios, on buvait aux deux sources : Léthé pour oublier, Mnémosyne pour se souvenir."],
    sources: 'Hésiode, Théogonie ; Platon, République, X ; Virgile, Énéide, VI ; Pausanias, IX, 39.',
    inGame: "Au camp, Léthé endort l'attention dans le dernier tiers du texte, là où l'on ne relit plus." },
  { key: 'eris', name: 'Éris', kind: 'boss', art: ART.eris,
    teaser: 'La déesse de la Discorde, celle qui lança la pomme d\'or.',
    facts: ["Éris est la déesse de la Discorde. Homère en fait la sœur d'Arès, le dieu de la guerre ; Hésiode, une fille de la Nuit.",
      "Non invitée au mariage de Thétis et Pélée, elle jeta une pomme d'or « à la plus belle ». Héra, Athéna et Aphrodite se la disputèrent : ce fut le début de la guerre de Troie.",
      "Hésiode distingue deux Éris : la mauvaise, qui pousse à la guerre, et la bonne, qui pousse à faire mieux que son voisin, comme le potier jaloux du potier.",
      "Ses enfants sont la Peine, l'Oubli (Léthé), la Faim, les Douleurs, les Combats, les Mensonges et le Serment."],
    sources: "Homère, Iliade, IV ; Hésiode, Théogonie et Les Travaux et les Jours ; Chants cypriens (résumé de Proclos).",
    inGame: "Au camp, Éris sème les dés-accords. Ses lieutenants sont chacun une de ses ruses ; elle-même les rassemble toutes." },
  { key: 'argus', name: 'Argus aux cent yeux', kind: 'tool', art: ART.emblems.argus,
    teaser: 'Le gardien qui ne dormait jamais tout entier.',
    facts: ["Argus Panoptès (« qui voit tout ») avait cent yeux ; quand certains dormaient, les autres veillaient.",
      "Héra le chargea de garder Io, changée en génisse. Hermès l'endormit en jouant de la flûte et lui coupa la tête.",
      "Héra plaça ses yeux sur la queue du paon, son oiseau : c'est pour cela que les plumes du paon ont des « yeux »."],
    sources: 'Ovide, Métamorphoses, I ; Apollodore, Bibliothèque, II, 1.',
    inGame: "Les Yeux d'Argus éclairent une seule catégorie de mots à la fois pendant la relecture." },
  { key: 'ariane', name: "Ariane et son fil", kind: 'tool', art: ART.emblems.ariane,
    teaser: 'Le fil qui permit de sortir du Labyrinthe.',
    facts: ["Ariane, fille du roi Minos de Crète, donna à Thésée une pelote de fil pour retrouver la sortie du Labyrinthe construit par Dédale.",
      "Thésée tua le Minotaure, mi-homme mi-taureau, et suivit le fil pour ressortir.",
      "Abandonnée par Thésée sur l'île de Naxos, Ariane fut recueillie par le dieu Dionysos qui l'épousa."],
    sources: 'Apollodore, Épitomé, I ; Plutarque, Vie de Thésée ; Ovide, Métamorphoses, VIII.',
    inGame: "Le Fil d'Ariane relie un verbe à son sujet : tu tires le fil pour vérifier l'accord." },
  { key: 'persee', name: 'Persée et le bouclier', kind: 'tool', art: ART.emblems.persee,
    teaser: 'Le héros qui regarda Méduse sans la regarder.',
    facts: ["Persée devait rapporter la tête de Méduse, dont le regard changeait en pierre. Athéna lui prêta un bouclier poli comme un miroir pour la viser sans la regarder en face.",
      "Il reçut aussi des sandales ailées, un casque qui rend invisible et une besace pour transporter la tête.",
      "Du sang de Méduse naquit le cheval ailé Pégase."],
    sources: 'Hésiode, Théogonie ; Apollodore, Bibliothèque, II, 4 ; Ovide, Métamorphoses, IV.',
    inGame: 'Le Bouclier de Persée montre une phrase à la fois, de la dernière à la première, pour relire sans se laisser emporter.' },
  { key: 'athena', name: "La chouette d'Athéna", kind: 'tool', art: ART.emblems.athena,
    teaser: "L'oiseau de la déesse de la sagesse.",
    facts: ["La chouette chevêche est l'oiseau d'Athéna, déesse de la sagesse, de la stratégie et des artisans.",
      "Les pièces d'argent d'Athènes portaient une chouette : on les appelait des « chouettes ». D'où l'expression « porter des chouettes à Athènes », faire quelque chose d'inutile.",
      "Athéna est née tout armée de la tête de Zeus. Elle donna son nom à Athènes après avoir offert l'olivier à la ville."],
    sources: 'Hésiode, Théogonie ; Aristophane, Les Oiseaux ; Apollodore, Bibliothèque, III, 14.',
    inGame: "La Chouette d'Athéna révèle où se cache une erreur : un indice, pas la réponse." },
  { key: 'muses', name: 'Les Muses', kind: 'place', art: ART.scenes.parchemins,
    teaser: 'Neuf déesses des arts et de la mémoire.',
    facts: ["Les neuf Muses sont les filles de Zeus et de Mnémosyne, la Mémoire. Elles vivent sur le mont Hélicon et l'Olympe.",
      "Chacune protège un art : Calliope la poésie épique, Clio l'histoire, Euterpe la musique, Thalie la comédie, Melpomène la tragédie, Terpsichore la danse, Érato la poésie amoureuse, Polymnie les hymnes, Uranie l'astronomie.",
      "Les poètes grecs commencent leurs chants en invoquant les Muses : « Chante, déesse… » ouvre l'Iliade."],
    sources: 'Hésiode, Théogonie ; Homère, Iliade, I.',
    inGame: "Au camp, les Muses t'ont choisi pour protéger les textes ; elles allument et éteignent les aides à la relecture." },
  { key: 'delphes', name: "Delphes et l'Oracle", kind: 'place', art: ART.scenes.delphes,
    teaser: 'Le sanctuaire où Apollon répondait par la bouche de la Pythie.',
    facts: ["À Delphes, sur les pentes du Parnasse, la Pythie, prêtresse d'Apollon, rendait des oracles souvent à double sens.",
      "Les Grecs y voyaient le centre du monde, marqué par une pierre appelée omphalos (« nombril »).",
      "Sur le temple étaient gravées des maximes comme « Connais-toi toi-même » et « Rien de trop ».",
      "Les cités venaient y consulter avant une guerre ou la fondation d'une colonie ; des Jeux pythiques s'y tenaient tous les quatre ans."],
    sources: 'Hérodote, Histoires, I ; Pausanias, Description de la Grèce, X ; Plutarque, Sur l\'E de Delphes.',
    inGame: "Au camp, l'Oracle propose chaque semaine trois rouleaux scellés : tu en ouvres un, et c'est ta quête de la semaine." },
  { key: 'dragon', name: 'Le dragon des Muses', kind: 'companion', art: ART.dragon.young,
    teaser: 'Un compagnon aux écailles de bronze.',
    facts: ["Dans les mythes grecs, les dragons sont de grands serpents gardiens : Ladon veillait sur les pommes d'or du jardin des Hespérides.",
      "Python, un serpent-dragon, gardait Delphes avant qu'Apollon ne le tue et n'y installe son oracle.",
      "Le dragon de Colchide gardait la Toison d'or ; Médée l'endormit pour que Jason puisse la prendre."],
    sources: 'Hésiode, Théogonie ; Apollonios de Rhodes, Argonautiques, IV ; Apollodore, Bibliothèque, II, 5.',
    inGame: "Au camp, ton dragon est une créature inventée pour le jeu, cousine lointaine de Ladon : il grandit à chaque ruse d'Éris que tu neutralises." },
];
export function entry(key: string) { return BESTIARY.find((e) => e.key === key); }
```
Run: `scripts/npm.sh run test -- bestiary` → PASS.

- [ ] **Step 4: Screens**

`Dossier.svelte` (`TopBar title="Le dossier d'Éris"`): loads `campStore` (refresh if empty) and `api.profiles.stats`. Header `.eris-panel` with `ART.erisSmug` (portrait, max-height 220 px, `float` animation) and `dossierIntro(profile.name, stats.totals.sessions)` in a speech bubble. Then « Ses points faibles » as a list of `.parchment` rows, one per lieutenant in `LIEUTENANT_ORDER` (unavailable ones shown greyed with `Protée dort encore à ce niveau.`): glyph + name, the Éris line `data-testid="dossier-line-{key}"` in italics, and *the real numbers under her voice*: `Pièges tendus : {traps} · déjoués : {caught} · taux : {pct}` plus a `<Gauge>` of the mastery window (`{window.days}/3 jours · {window.traps}/10 pièges · {rate}`) and a « Neutralisé » gold chip when applicable; row tap → `href('lieutenant', {key})`. Then `data-testid="dossier-small-tricks"` with `smallTricksLine(...)` and the top 8 trap words as chips (« Mots qu'elle vise » — link to Stats for the full list: « Voir les chiffres bruts » → `href('stats')`). Last: « Ce qu'elle préfère taire » — a `Reveal` card with the *positive* facts: personal best catch rate (from `recent_sessions`), total caught, current rank. Loading text: `Éris feuillette son dossier…`.

`Bestiaire.svelte` (`TopBar title="Bestiaire"`): grid of `bestiary-card-{key}` cards (art thumbnail 96 px, name, teaser, for monsters a status chip: `Neutralisé` gold / `En cours` aegean / `À découvrir`). Locked monster entries (`!bestiary_unlocked`) show the art in `filter: grayscale(.8) brightness(.9)` and chip `data-testid="bestiary-locked"` « Mythe à débloquer : termine une quête contre lui ». Tap → `href('bestiaire-entry', {key})`.

`BestiaireEntry.svelte`: `TopBar title={entry.name}`; art (portrait or scene) ; section « Le mythe » (all `facts` as a list when unlocked; only `teaser` + the lock line otherwise), « Sources » (muted small), « Au camp » (`.parchment` with the fiction, prefixed by a small « Fiction du jeu » chip). For monsters: button « Voir la ruse et la quête » → `href('lieutenant', {key})`. Unknown key → `Ce monstre n'existe pas… encore.`

`Lieutenant.svelte` (`TopBar title={name}`; `.scene` header with `ART.scenes.battle` and the lieutenant art centred, `wobble` on hover): the technique line (from `worldApi.world()` catalog — cache it in `campStore.catalog`), Éris's line for the band, three gauges `lieutenant-gauge-days` (`{days}/3 jours différents`), `lieutenant-gauge-traps` (`{traps}/10 pièges rencontrés`), `lieutenant-rate` (`Taux dans la fenêtre : {pct}` with the 80 % target marked). When neutralised: `data-testid="lieutenant-neutralised"` banner « Neutralisé le {date} » + Medallion of the relic; when `stirring`: `« {name} s'agite à nouveau. Une quête de revanche ? »` (no loss). Actions: `lieutenant-quest` « Lancer une quête » (disabled with `Quête en cours` when `active_quest_id`; shows the known reward: `Récompense : 60 XP · page du bestiaire`) → `worldApi.createQuest` → toast « Quête affichée au tableau. » and `refreshCamp`; 409 → orange detail. `lieutenant-grimoire` « Ouvrir son grimoire corrompu » → `href('grimoire', {textId: firstRecommended}, {focus: key})` (**SP2 fallback:** hide the button if the `grimoire` route does not exist). Recommended texts (from the active quest's `texts`, else from `worldApi.createQuest`'s response — before a quest exists show « Lance une quête pour recevoir trois textes conseillés »): `lieutenant-text-{id}` cards → `href('play', {textId}, {encounter: key, quest: String(active_quest_id ?? '')})` (omit `quest` when null).

`App.svelte`: four new branches. `scripts/npm.sh run check` → clean; visual check in `scripts/dev.sh` at 1180×820 and 820×1180 (DevTools device toolbar): dossier readable, bestiary grid 3 columns landscape / 2 portrait.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/world/eris.ts web/src/lib/world/eris.test.ts web/src/lib/world/bestiary.ts web/src/lib/world/bestiary.test.ts web/src/screens/Dossier.svelte web/src/screens/Bestiaire.svelte web/src/screens/BestiaireEntry.svelte web/src/screens/Lieutenant.svelte web/src/App.svelte
git commit -m "Add Éris's dossier in her voice, bestiary with real myths, lieutenant pages with mastery gauges" -- web/src/lib/world/eris.ts web/src/lib/world/eris.test.ts web/src/lib/world/bestiary.ts web/src/lib/world/bestiary.test.ts web/src/screens/Dossier.svelte web/src/screens/Bestiaire.svelte web/src/screens/BestiaireEntry.svelte web/src/screens/Lieutenant.svelte web/src/App.svelte
```

---

### Task 7: Delphes — Consultation de l'Oracle, quest board, boss fight flow, Play with quest/encounter (web lane)

Spec §3.6 (Oracle scrolls → quest of the week with bonus; quest board; boss fights with fewer aids), §3.2 (prophecies). Decisions 7, 8, 9, 10, 14, 21. Touches SP2 file `Play.svelte`: rebase first.

**Files:**
- Create: `web/src/components/Scroll.svelte`, `web/src/components/QuestCard.svelte`, `web/src/lib/world/quests.ts`, `web/src/lib/world/quests.test.ts`, `web/src/screens/Oracle.svelte`, `web/src/screens/QuestBoard.svelte`, `web/src/screens/Boss.svelte`
- Modify: `web/src/App.svelte` (routes `oracle`, `quests`, `boss`; pass `route.query` to `Play`), `web/src/screens/Play.svelte` (props `query`; `quest_id`, `encounter`, `help_stage` override, `focus`), `web/src/lib/types.ts` (`SessionCreate.encounter?`, `quest_id?`; `SessionCreated.progression?: Progression`)

**Interfaces:**
- Consumes: Task 4 (`worldApi`, `Particles`, `Reveal`, `Medallion`, `playSfx`), Task 5 (`campStore`, `href` with query), Task 6 (`entry()` for monster names/art), SP2 `formatSwissDate` (**fallback:** local), SP2 `api.texts.corrupt(id, body)` for `focus` (**fallback:** ignore `focus`).
- Produces:
  ```ts
  // quests.ts (pure)
  export function questTitle(q: QuestOut, names: Record<string, string>): string;       // « Tenir l'Hydre en échec », « Rouleau de l'Oracle : Écho », « Combat contre Éris (I) »
  export function questProgressLabel(q: QuestOut): string;                              // « 2 / 3 textes » or « Un combat »
  export function rewardLabel(q: QuestOut, catalog: WorldCatalog): string;              // « 60 XP · page du bestiaire », « 150 XP · Teinte Écume », « 300 XP · Sandales d'Hermès »
  export function romanTier(n: number): string;                                          // 1 → 'I'
  // Play.svelte new prop
  query: Record<string, string> = {}   // quest, encounter, help, focus
  ```
  `data-testid`s: `scroll-faible`, `scroll-ecole`, `scroll-destin`, `scroll-open`, `oracle-monster-{key}`, `oracle-confirm`, `oracle-reward`, `oracle-quest`, `oracle-prophecy-{textId}`, `quest-card-{id}`, `quest-shelve-{id}`, `quest-play-{id}-{textId}`, `board-challenge-{key}`, `board-boss`, `boss-start`, `boss-tier`, `boss-reward`, `play-quest-banner`, `play-boss-banner`.

- [ ] **Step 1: Failing tests for `quests.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { questProgressLabel, questTitle, rewardLabel, romanTier } from './quests';
const names = { hydre: "L'Hydre", echo: 'Écho' };
const q = (o: object) => ({ id: 1, kind: 'board', target: 'hydre', week: null, status: 'active', goal: { sessions: 3, min_rate: 0.5 },
  progress: { sessions: 2, log: [] }, reward: { xp: 60, reward_id: null, bestiary: true }, texts: [], created_at: '', completed_at: null, ...o }) as never;
const catalog = { rewards: { 'tint:ecume': { name: 'Teinte Écume' }, sandales_hermes: { name: "Sandales d'Hermès" } } } as never;
describe('quest labels', () => {
  it('titles', () => {
    expect(questTitle(q({}), names)).toBe("Tenir l'Hydre en échec");
    expect(questTitle(q({ kind: 'oracle', target: 'echo' }), names)).toBe("Rouleau de l'Oracle : Écho");
    expect(questTitle(q({ kind: 'boss', target: 'eris', goal: { tier: 2, min_rate: 0.7, min_draft: 3 } }), names)).toBe('Combat contre Éris (II)');
  });
  it('progress and rewards', () => {
    expect(questProgressLabel(q({}))).toBe('2 / 3 textes');
    expect(questProgressLabel(q({ kind: 'boss', goal: { tier: 1, min_rate: 0.7, min_draft: 3 } }))).toBe('Un combat');
    expect(rewardLabel(q({}), catalog)).toBe('60 XP · page du bestiaire');
    expect(rewardLabel(q({ kind: 'oracle', reward: { xp: 150, reward_id: 'tint:ecume', bestiary: true } }), catalog)).toBe('150 XP · Teinte Écume · page du bestiaire');
    expect(rewardLabel(q({ kind: 'boss', reward: { xp: 300, reward_id: 'sandales_hermes', bestiary: false } }), catalog)).toBe("300 XP · Sandales d'Hermès");
    expect(romanTier(3)).toBe('III');
  });
});
```
`questTitle` lower-cases a leading « L' » of the monster name after « Tenir » (`Tenir l'Hydre en échec`, `Tenir les Sirènes en échec` — for « Les Sirènes » lower-case the article too: `name.replace(/^(L'|La |Le |Les )/, (m) => m.toLowerCase())`). Run: `scripts/npm.sh run test -- quests` → FAIL, implement → PASS.

- [ ] **Step 2: `Scroll.svelte` and `QuestCard.svelte`**

`Scroll.svelte` props `{ title, hint, sealed, revealed?: {name, art}, reward, onOpen, testid }`: a `.parchment` rolled look — when `sealed`: closed roll (two rounded ends, a wax seal circle `var(--terracotta)` with `✶`), title, hint, `Récompense de la semaine : {reward}` and button `scroll-open` « Briser le sceau » (calls `onOpen`); on opening: `playSfx('seal')` then `playSfx('unroll')`, a `max-height` transition 0 → content (`.5s`) with `Particles kind="sparkle"`; when `revealed`: the monster art (max-height 180 px) and name with `pop` animation.

`QuestCard.svelte` props `{ quest, names, catalog, profileId, onShelve? }` (`data-testid="quest-card-{id}"`): title, kind chip (`Tableau` / `Oracle` gold / `Éris` violet), `Gauge` progress with `questProgressLabel`, `rewardLabel` prefixed `Récompense connue :`, the recommended texts as small buttons `quest-play-{id}-{textId}` « {title} · {level} » → `href('play', {textId}, {quest: id, encounter: target})`; for `done` quests a « Terminée le {date} » chip; for active board quests a ghost button `quest-shelve-{id}` « Ranger » → `worldApi.shelveQuest` (confirm inline: « Ranger cette quête ? Elle ne compte plus, sans rien perdre. » / « Oui » / « Non »).

- [ ] **Step 3: `Oracle.svelte`**

`TopBar title="Delphes — l'Oracle"`; `.scene` header with `ART.scenes.delphes`. Load `worldApi.oracle(profile.id)` (+ `worldApi.world()` for names/rewards). Sections:
1. **Prophéties** (when any): `.parchment` list `oracle-prophecy-{textId}`: `« {title} » — dictée le {formatSwissDate(due_date)} · {days_left === 0 ? "c'est aujourd'hui" : `dans ${days_left} jour(s)`}` + button « Réviser » → `href('play', {textId})`. Intro line: `L'Oracle a vu une dictée arriver à l'école. Révise-la avant le jour dit : l'XP est multipliée par 1,5.`
2. **Les trois rouleaux** — `oracle-reward` line above: `Cette semaine, ouvrir un rouleau rapporte : {rewardLabel-like text: "150 XP · {reward name}" or "150 XP"}` (known in advance, identical for all three). Three `Scroll`s side by side (stacked in portrait) — `sealed = status === 'sealed'`. Opening `faible`/`destin` → `worldApi.consult(profile.id, {scroll})`; opening `ecole` → a monster picker appears inside the scroll (six `oracle-monster-{key}` buttons with glyph + name, unavailable ones disabled with `dort encore`), then `oracle-confirm` « C'est celui-là » → `consult({scroll: 'ecole', lieutenant})`. After the response: the chosen scroll shows `revealed` (monster art + name from `entry(key)`), the other two fade (`opacity .5`) with `Refermé jusqu'à lundi.`; `Particles kind="burst"`; `playSfx('chime')`; `refreshCamp`.
3. **La quête de la semaine** (`oracle-quest`, when `status === 'chosen'`): `<QuestCard quest={quest} …/>` and `L'Oracle parlera de nouveau lundi.` 409 from the server → orange `L'Oracle a déjà parlé cette semaine. Reviens lundi.`

- [ ] **Step 4: `QuestBoard.svelte` and `Boss.svelte`**

`QuestBoard.svelte` (`TopBar title="Tableau des quêtes"`; `.scene` with `ART.scenes.camp` cropped low): **En cours** — `QuestCard`s for active quests (empty: `Aucune quête en cours. Défie un monstre ci-dessous ou consulte l'Oracle.`). **Défier un monstre** — six `board-challenge-{key}` cards (glyph, name, one-line technique, chips `Neutralisé` / `Quête en cours`, and the known reward `60 XP · page du bestiaire` + `Prochain trésor de cabane dans {n} quête(s) : {decor name}` computed from the count of done board quests and `DECOR_ORDER` from the catalog) → `worldApi.createQuest`; 409 → orange detail inline. **Éris** — `board-boss` `.eris-panel` card: when `tier_available` or `active_quest_id`: `Combat {roman} — récompense : {boss reward name}` and button « Se rendre au bord du camp » → `href('boss')`; otherwise `Éris se cache. Neutralise {need − neutralised} ruse(s) de plus pour la faire sortir.` where `need = Math.ceil(available * (tiers_won.length + 1) / 3)` (the same formula as the server's `boss_tiers`). **Terminées** — last 10 done quests, collapsed by default (`<details>`).

`Boss.svelte` (`TopBar title="Éris"`): full `.scene` with `ART.scenes.battle`, `ART.erisSmug` on the right (portrait, max-height 60 vh), the player's dragon (stage art, `Dragon` component from Task 8 — until Task 8 lands, a plain `<img>` of `ART.dragon[stage]`) on the left. Text panel `.eris-panel`: Éris's challenge line by tier (Decision 19: about her tricks, never the player): I `« Deux de mes ruses réduites au silence ? Voyons si mes pièges tiennent quand ils jouent tous ensemble. »`; II `« Encore toi. Cette fois mes pièges sont mieux cachés, et le texte est long. Très long. »`; III `« Le Grand Désaccord. Toutes mes ruses, un seul texte, et la pomme d'or en jeu. Après ça, je ne reviendrai pas. (Si.) »`. Info card: `boss-tier` `Combat {roman}`, `boss-reward` `Récompense si tu gagnes : 300 XP · {name}`, rules: `Un long texte · les Yeux d'Argus restent éteints · aucun piège n'est perdu si Éris s'enfuit : tu pourras recommencer.` Button `boss-start` « Affronter Éris » → `worldApi.boss(profile.id)` → `navigate(href('play', {textId: String(text_id)}, {quest: String(quest.id), encounter: 'eris', help: String(help_stage)}))`. 409 → `Éris ne se montre pas encore. Neutralise d'abord ses lieutenants.`

- [ ] **Step 5: `Play.svelte` and `App.svelte` wiring, `types.ts`**

`types.ts`: `SessionCreate` gains `encounter?: string | null; quest_id?: number | null`; `SessionCreated` gains `progression?: import('./world/types').Progression`. `App.svelte`: `<Play profile={gateProfile} textId={route.params.textId} query={route.query} />` (also for the SP2 `grimoire` branch when present) and the three new route branches.

`Play.svelte` (localised insertions): prop `query: Record<string, string> = {}`; `const questId = $derived(query.quest ? Number(query.quest) : null); const encounter = $derived(query.encounter ?? null); const helpOverride = $derived(query.help ? Number(query.help) : null);` — `helpStage` becomes `helpOverride ?? profile.help_stage` (clamped as before). In `submitSession`: add `encounter, quest_id: questId, help_stage: helpStage` (replacing `profile.help_stage`). Intro screen: when `questId`: `.parchment` `data-testid="play-quest-banner"` `Ce texte compte pour ta quête.`; when `encounter === 'eris'`: `.eris-panel` `data-testid="play-boss-banner"` `Combat contre Éris — les Yeux d'Argus restent éteints.` and the pace selector is limited to `≥ defaultPace(level)` (lower options disabled with `Pas pendant un combat`). Grimoire mode (SP2 present): pass `focus: query.focus` into `api.texts.corrupt(...)`. Store `created.progression` into `playState.progression` (optional field on `PlayState`, no version bump) so Task 8 can render it after a reload.

Run: `scripts/npm.sh run check` and `scripts/npm.sh run test` → green. Manual walk in `scripts/dev.sh`: camp → Delphes → break a seal → quest visible on the board → play a recommended text → results.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/Scroll.svelte web/src/components/QuestCard.svelte web/src/lib/world/quests.ts web/src/lib/world/quests.test.ts web/src/screens/Oracle.svelte web/src/screens/QuestBoard.svelte web/src/screens/Boss.svelte web/src/App.svelte web/src/screens/Play.svelte web/src/lib/types.ts web/src/lib/playState.ts
git commit -m "Add Delphes Oracle consultation, quest board, boss fight flow and quest-aware play sessions" -- web/src/components/Scroll.svelte web/src/components/QuestCard.svelte web/src/lib/world/quests.ts web/src/lib/world/quests.test.ts web/src/screens/Oracle.svelte web/src/screens/QuestBoard.svelte web/src/screens/Boss.svelte web/src/App.svelte web/src/screens/Play.svelte web/src/lib/types.ts web/src/lib/playState.ts
```

---

### Task 8: Dragon companion (naming, tint, growth), cabin and rewards, progression reveal after a session (web lane)

Spec §2 (companion named and customised, grows with neutralised techniques), §3.6 (cosmetics, relics, divine gear, cabin, rewards). Decisions 11, 12, 17, 18. Touches SP2 files `Play.svelte`/`Results.svelte`: rebase first; `Results.svelte` is **not** modified — the reveal is rendered by `Play.svelte` above it.

**Files:**
- Create: `web/src/lib/world/dragon.ts`, `web/src/lib/world/dragon.test.ts`, `web/src/components/Dragon.svelte`, `web/src/components/ProgressionReveal.svelte`, `web/src/screens/DragonScreen.svelte`, `web/src/screens/Cabin.svelte`
- Modify: `web/src/App.svelte` (routes `dragon`, `cabin`), `web/src/screens/Play.svelte` (render `ProgressionReveal` from `playState.progression`), `web/src/screens/Camp.svelte` (use `<Dragon>` in the dragon card), `web/src/screens/Boss.svelte` (use `<Dragon>`)

**Interfaces:**
- Consumes: Task 4 (`ART`, `Particles`, `Reveal`, `Medallion`, `Gauge`, `playSfx`), Task 5 (`campStore`, `refreshCamp`), Task 7 (`playState.progression: Progression`, `QuestCard` labels via `quests.ts`), SP1 `erisLine` (`$lib/explain`) for Éris's reaction, `loadProfile`.
- Produces:
  ```ts
  // dragon.ts
  export const TINT_FILTERS: Record<Tint, string> = { bronze: 'none', ecume: 'hue-rotate(190deg) saturate(.9)', olivier: 'hue-rotate(70deg) saturate(.8)',
    braise: 'hue-rotate(-25deg) saturate(1.3)', jade: 'hue-rotate(120deg) saturate(.9)', argent: 'saturate(0) brightness(1.15)' };
  export const TINT_NAMES: Record<Tint, string> = { bronze: 'Bronze', ecume: 'Écume', olivier: 'Olivier', braise: 'Braise', jade: 'Jade', argent: 'Argent' };
  export type Mood = 'idle' | 'happy' | 'sleepy';
  export function stageLabel(stage: DragonStage): string;            // « Œuf », « Dragonnet », « Jeune dragon », « Dragon adulte »
  export function stageLine(stage: DragonStage, name: string | null, remaining: number | null): string;   // the camp speech bubble lines from Task 5 (moved here; Camp imports them)
  export function validName(name: string): boolean;                  // 1–20 chars after trim, no line breaks
  ```
  `<Dragon stage tint size mood name? />` renders `<img src={ART.dragon[stage]} alt={name ?? 'Ton dragon'} style="filter: {TINT_FILTERS[tint]}; width: {size}px" class="dragon {mood}">` (`idle` → `float 4s infinite`, `happy` → `pop` once, `sleepy` → slow `float 7s`, egg → `wobble` on `happy`).
  `data-testid`s: `dragon-name-input`, `dragon-name-save`, `dragon-tint-{tint}`, `dragon-stage`, `reveal-xp`, `reveal-quest-{id}`, `reveal-neutralised-{key}`, `reveal-reward-{id}`, `reveal-dragon`, `reveal-name-input`, `reveal-name-save`, `reveal-weekly`, `reveal-boss`, `reveal-continue`, `cabin-reward-{id}`, `cabin-equip-{id}`.

- [ ] **Step 1: Failing tests**

```ts
// dragon.test.ts
import { describe, it, expect } from 'vitest';
import { TINT_FILTERS, stageLabel, stageLine, validName } from './dragon';
describe('dragon helpers', () => {
  it('never offers violet (reserved for Éris) and has six tints', () => {
    expect(Object.keys(TINT_FILTERS)).toEqual(['bronze', 'ecume', 'olivier', 'braise', 'jade', 'argent']);
    for (const f of Object.values(TINT_FILTERS)) expect(f).not.toMatch(/hue-rotate\((2[6-9]\d|3[0-2]\d)deg\)/);   // 260–329° ≈ violet band
  });
  it('labels and lines', () => {
    expect(stageLabel('egg')).toBe('Œuf'); expect(stageLabel('adult')).toBe('Dragon adulte');
    expect(stageLine('egg', null, 1)).toContain("L'œuf frémit");
    expect(stageLine('young', 'Braise', 2)).toBe('Braise bat des ailes : encore 2 techniques à neutraliser.');
    expect(stageLine('young', 'Braise', 1)).toBe('Braise bat des ailes : encore 1 technique à neutraliser.');
    expect(stageLine('adult', 'Braise', null)).toBe("Braise veille sur le camp. Éris n'a qu'à bien se tenir.");
  });
  it('validates names', () => {
    expect(validName('  Braise ')).toBe(true); expect(validName('')).toBe(false); expect(validName('a'.repeat(21))).toBe(false); expect(validName('a\nb')).toBe(false);
  });
});
```
Run: `scripts/npm.sh run test -- dragon` → FAIL; implement `dragon.ts` → PASS. Move the four bubble lines out of `Camp.svelte` into `stageLine` (hatchling: `{name} te regarde avec de grands yeux ambre.`) and import them.

- [ ] **Step 2: `Dragon.svelte`, `DragonScreen.svelte`**

`DragonScreen.svelte` (`TopBar title={dragon.name ?? 'Ton dragon'}`): `.scene` with `ART.scenes.camp`; centre `<Dragon size={min(420, 55vw)} mood="idle">`; `dragon-stage` chip `stageLabel(stage)` + `Gauge value={neutralised} max={next_stage_at ?? available}` with label `Prochaine étape : {next_stage_at} technique(s) neutralisée(s)` (or `Étape finale atteinte`). **Nom**: when `stage === 'egg'`: `Tu lui donneras un nom quand il éclora.`; else `<input data-testid="dragon-name-input" maxlength="20" lang="fr" autocapitalize="words" value={name}>` + `dragon-name-save` « Garder ce nom » → `worldApi.patchDragon(profile.id, {name})` → toast `C'est noté.`, `refreshCamp`. **Teinte**: six `dragon-tint-{tint}` swatches (a 56 px circle showing a tiny egg image under the filter, name below); locked ones greyed with a lock glyph and `title="À gagner : quête de l'Oracle"`; tap an unlocked one → `patchDragon({tint})` (optimistic update; on 422 revert and show the detail). `playSfx('chime')` on save.

- [ ] **Step 3: `Cabin.svelte`**

`TopBar title="Ta cabane"`; `.scene` with `ART.scenes.camp` (cropped to the huts) and equipped decor rendered as small floating `Medallion`s over the scene (each equipped `decor:*` adds one at a fixed slot). Sections **Reliques**, **Armes et armures divines**, **Objets de la cabane**, **Teintes** — each a grid of `cabin-reward-{id}` cards: `Medallion glyph kind locked={!owned}`, name, desc; **unowned items are listed too** (greyed) with `source` as « Comment l'obtenir : … » so every reward is known in advance (Decision 12). Owned gear/decor have a toggle `cabin-equip-{id}` « Exposer » / « Ranger » → `worldApi.patchReward`. Glyphs by id: relics use the lieutenant glyph; `sandales_hermes` 👟, `egide` 🛡️, `foudre_zeus` ⚡, `decor:lanterne` 🏮, `decor:tapis` 🧶, `decor:bibliotheque` 📚, `decor:trophee` 🍎, `decor:fresque` 🎨, tints a coloured circle with the filter. Empty state line: `Ta cabane attend ses premiers trésors. Chaque récompense est annoncée à l'avance : rien n'est tiré au sort.`

- [ ] **Step 4: `ProgressionReveal.svelte`**

Props `{ progression: Progression; profile: Profile; dragon: DragonOut | null; names: Record<string, string>; onDone: () => void }`. A stacked sequence of `Reveal` cards (delay 0, 250, 500 ms…), each present only when relevant, in this order:
1. `reveal-xp`: `+{session} XP` with an animated `Gauge` from `total_before − rank_floor` to `total_after − rank_floor` (width transition), bonus chips (`reason` → label: `session` «Texte», `board` «Quête», `oracle` «Oracle», `boss` «Éris vaincue», `mastery` «Ruse neutralisée», `weekly` «Objectif de la semaine»); on rank-up: `Nouveau rang : {title_after}` with `pop` + `Particles kind="burst"` + `playSfx('chime')`.
2. Per quest touched (`reveal-quest-{id}`): title via `questTitle`, `counted ? 'Ce texte compte : ' : 'Ce texte ne compte pas cette fois : '` + `{progress} / {goal}`; `completed` → gold frame, `Quête accomplie !` and the reward line.
3. `reveal-neutralised-{key}`: full-width `.parchment` with the lieutenant art, `{name} — neutralisé !`, `Sa ruse ne te piège plus : taux ≥ 80 % sur trois jours.`, the relic Medallion; `Particles kind="burst"`, `playSfx('growth')`.
4. `reveal-reward-{id}` for rewards not already shown by 2/3 (decor from board quests): Medallion + name + desc.
5. `reveal-dragon` when `stage_before !== stage_after`: egg → hatchling: `L'œuf éclôt !` with the egg image `wobble` then the hatchling `pop`; other growths: `{name} grandit : {stageLabel}`. When `needs_name`: `<input data-testid="reveal-name-input">` + `reveal-name-save` « C'est son nom » → `worldApi.patchDragon` (validated with `validName`; error in orange `Un nom de 1 à 20 lettres.`); `playSfx('growth')`, `Particles kind="sparkle"`.
6. `reveal-weekly` when `reached_now`: laurel glyphs filling, `Objectif de la semaine atteint ! +40 XP`, `Particles kind="laurel"`, `playSfx('laurel')`.
7. `reveal-boss` when `boss`: won → `.eris-panel` with `ART.erisSmug` flipped and the line `« Impossible ! Garde ta pomme, je reviendrai avec de nouvelles ruses. »` + reward; lost → `« Éris s'enfuit avec la pomme… pour cette fois. Le combat reste ouvert, rien n'est perdu. »` + `playSfx('hmpf')` (no orange, no loss wording).
Ends with `reveal-continue` « Voir la relecture » (calls `onDone`, which collapses the reveal and scrolls to `Results`). Under reduced motion the cards appear at once and there are no particles (handled by the components).

- [ ] **Step 5: Wire `Play.svelte`, `Camp.svelte`, `Boss.svelte`, `App.svelte`**

`Play.svelte`: in the results branch, `{#if playState.progression && !revealDone}<ProgressionReveal progression={playState.progression} {profile} dragon={campStore.data?.dragon ?? null} names={...} onDone={() => (revealDone = true)} />{/if}` above `<Results …>` (`let revealDone = $state(false)`, reset in `restart()`); after `submitSession` succeeds also call `refreshCamp(profile.id)` (camp data will be fresh on return). Names map: from `campStore.data?.lieutenants` (`key → name`). `Camp.svelte`: replace the dragon `<img>` by `<Dragon stage tint size={160} mood="idle" name>`; `Boss.svelte`: same at 260 px. `App.svelte`: routes `dragon` → `DragonScreen`, `cabin` → `Cabin`.

Run: `scripts/npm.sh run check`, `scripts/npm.sh run test` → green. Manual walk in `scripts/dev.sh` (server lane merged): play a text → the reveal shows XP; with `DISCORDE_TEST_HOOKS=1` added temporarily to `compose.dev.yaml`, post two extra sessions via `curl` with `X-Discorde-Day` headers, play a third → the egg hatches and asks for a name. Then the web lane gate: `scripts/check.sh` → `== ALL GREEN`.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/world/dragon.ts web/src/lib/world/dragon.test.ts web/src/components/Dragon.svelte web/src/components/ProgressionReveal.svelte web/src/screens/DragonScreen.svelte web/src/screens/Cabin.svelte web/src/App.svelte web/src/screens/Play.svelte web/src/screens/Camp.svelte web/src/screens/Boss.svelte
git commit -m "Add the dragon companion (name, tint, growth), the cabin with known rewards, and the post-session progression reveal" -- web/src/lib/world/dragon.ts web/src/lib/world/dragon.test.ts web/src/components/Dragon.svelte web/src/components/ProgressionReveal.svelte web/src/screens/DragonScreen.svelte web/src/screens/Cabin.svelte web/src/App.svelte web/src/screens/Play.svelte web/src/screens/Camp.svelte web/src/screens/Boss.svelte
```

---

### Task 9: Integration — Playwright e2e camp → Oracle → quest → session → reward, mastery hatch, boss; full gate (joint)

Spec §6.1. Runs against the production image via `scripts/playwright.sh`; the test clock (Decision 5) is enabled only in `compose.e2e.yaml`.

**Files:**
- Create: `web/e2e/world.spec.ts`
- Modify: `compose.e2e.yaml` (`DISCORDE_TEST_HOOKS: "1"` in the `app` service environment — keep SP2's Alexandria env if present), `web/e2e/helpers.ts` (`makeResult`, `postSession`, `skipOnboarding` if not added in Task 5), `README.md` (SP3 section: camp, Oracle week, mastery rule, test hooks env)

**Interfaces:**
- Consumes: every `data-testid` from Tasks 5–8; SP1 `stubSpeech`; SP2 `createProfile`/`createText` (**fallback:** UI flow as in `happy-path.spec.ts` and `request.post('/api/texts', …)`).
- Produces (`helpers.ts`):
  ```ts
  export function makeResult(o: { words?: number; draft?: number; caught?: number; category?: string }): object   // a valid SessionResult with one category
  export async function postSession(request: APIRequestContext, o: { profileId: number; textId: number; day: string; result: object; questId?: number; encounter?: string; helpStage?: number }): Promise<any>
  export async function skipOnboarding(page: Page): Promise<void>
  ```

- [ ] **Step 1: compose and helpers**

`compose.e2e.yaml` `app.environment`: add `DISCORDE_TEST_HOOKS: "1"`. `makeResult` returns `{ version: 1, byCategory: { [category]: { opportunities: 10, draft, caught, missed: draft - caught, introduced: 0 } }, draftErrors: Array(draft).fill({ refIndex: 0, typedIndex: 0, expected: 'x', typed: 'y', category: 'agreement', sub: 'verb', anchor: -1 }), finalErrors: [], caught: Array(caught).fill(...same...), missed: [], introduced: [], correctWords: words - draft, totalWords: words, catchRate: draft ? caught / draft : null, score: 10 }`. `postSession` posts to `/api/sessions` with header `X-Discorde-Day` and `{profile_id, text_id, pace_level: 1, help_stage: helpStage ?? 1, started_at: day + 'T10:00:00+00:00', draft: 'x', final: 'x', result, score: 10, catch_rate: result.catchRate, quest_id, encounter}` and returns the JSON (`expect(res.ok()).toBeTruthy()`).

- [ ] **Step 2: `world.spec.ts`**

One file, tests in order with `test.describe.serial`, shared `profileId`/`textId` captured from the UI and API (Desktop Safari device from the config):

1. **camp is home** — `stubSpeech`; create profile `Ariane-${Date.now()%1e6}` (10H) through the UI; expect `heading /Bienvenue au camp/`; onboarding visible → click `onboarding-next` twice, then « Entrer au camp »; expect `camp-xp` contains `Recrue du camp`, `camp-dragon` contains `Un œuf de dragon`, `camp-weekly` contains `0 / 3`. Read `profileId` from `location.hash`.
2. **Oracle: sealed scrolls, reward known, choose the school scroll** — `camp-oracle` click; expect three scrolls with `scroll-open` buttons and `oracle-reward` containing `Teinte Écume`; click `scroll-ecole`'s `scroll-open`; click `oracle-monster-hydre`; `oracle-confirm`; expect `oracle-quest` contains `Rouleau de l'Oracle : L'Hydre` (or `l'Hydre` — assert with `/Oracle : l.Hydre/i`) and `0 / 3 textes`; reload page → still `chosen` (server state); a second `scroll-open` must not exist.
3. **quest board shows it, lieutenant page gauges** — `topbar-camp`, `camp-quests`; expect `quest-card-*` with `Récompense connue : 150 XP · Teinte Écume`; `board-challenge-echo` click → a second card appears (board quest); `board-challenge-chimere` click → a third card (the Oracle quest is not a board quest, so two board quests are allowed); `board-challenge-protee` click → orange text `Deux quêtes à la fois`. Navigate `#/p/{id}/monstres/hydre`; expect `lieutenant-gauge-days` contains `0/3`, `lieutenant-quest` disabled (`Quête en cours`).
4. **a real session counts for the quest and shows the reveal** — via API create the text `Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.` (`createText`); go to `#/p/{id}/play/{textId}?quest={oracleQuestId}&encounter=hydre`; expect `play-quest-banner`; play pace 1 exactly as `happy-path.spec.ts` does (draft with `danse`/`chante`, fix `danse` → `dansent`); on results expect `reveal-xp` visible with `/\+\d+ XP/`, `reveal-quest-{oracleQuestId}` contains `Ce texte compte : 1 / 3`; click `reveal-continue`; `results-catch-rate` visible.
5. **complete the Oracle quest via API, see the tint unlocked** — `postSession` ×2 (days today and today; the quest counts sessions, not days) with `makeResult({draft: 4, caught: 4, category: 'agreement:verb'})`; expect the second response `progression.quests` has the oracle quest `completed: true` and `rewards` contains `tint:ecume`; UI: `#/p/{id}/dragon` → `dragon-tint-ecume` enabled; click it → the `img.dragon` style contains `hue-rotate(190deg)`; `#/p/{id}/cabane` → `cabin-reward-tint:ecume` not greyed (attribute `data-owned="true"` — add this attribute to the card in Task 8's `Cabin.svelte` if missing).
6. **mastery over three days hatches the dragon; the dossier changes voice** — `postSession` on days `2026-09-21/22/23` with the Hydre result (4/4 each); the third response: `progression.neutralised` = `['hydre']`, `dragon.stage_after` = `'hatchling'`, `needs_name` true; UI: `#/p/{id}/dragon` → `dragon-stage` = `Dragonnet`; fill `dragon-name-input` `Braise`, `dragon-name-save`; reload → input value `Braise`; camp `camp-dragon` contains `Braise`; `#/p/{id}/dossier` → `dossier-line-hydre` contains `L'Hydre est neutralisée`; `#/p/{id}/bestiaire/hydre` → `Iolaos` visible (full facts unlocked).
7. **boss unlocks after two lieutenants; a lost fight loses nothing; a won fight grants the gear** — neutralise `echo` via API (3 days, `category: 'homophone'`); camp → `camp-boss` visible with `Sandales d'Hermès`; click → `boss-start` → URL contains `encounter=eris`; expect `play-boss-banner`; instead of playing the long text in the UI, read `quest` and `text_id` from the URL/`worldApi` (`request.get('/api/profiles/{id}/quests?status=active')`) and `postSession` a losing result (`draft: 5, caught: 2`, `questId`, `encounter: 'eris'`, `helpStage: 2`) → `progression.boss.won === false`, quest still active; then a winning one (`draft: 5, caught: 4`) → `won: true`, `rewards` includes `sandales_hermes`; UI `#/p/{id}/cabane` → `cabin-reward-sandales_hermes` owned; `cabin-equip-sandales_hermes` click → text « Ranger ».
8. **weekly goal and break nudge** — `camp-weekly` contains `Objectif atteint` (≥ 3 sessions this week were posted with today's day in step 5 — ensure at least three used today's local date: use `new Date().toISOString().slice(0,10)` for those); break nudge: `page.evaluate(() => sessionStorage.setItem('discorde.playClock', JSON.stringify({ activeMs: 26 * 60000, running: false, lastTick: null, lastStop: Date.now() })))`, play the short text once more to results → `break-nudge` visible with `Braise bâille`; `break-continue` click → nudge gone.
9. **no red, no guilt** — on the camp and the dossier, `page.evaluate` scans `getComputedStyle(el).color`/`backgroundColor` of all elements for pure reds (`rgb(2[0-9][0-9], [0-9]{1,2}, [0-9]{1,2})` with g,b < 60) → none; `page.locator('body')` never contains `manqué`, `raté`, `perdu` (case-insensitive) on the camp.

Run: `scripts/playwright.sh e2e/world.spec.ts` → 9 passed. Then all specs: `scripts/playwright.sh` → SP1 + SP2 + world specs green.

- [ ] **Step 3: README and the full gate**

`README.md`: section « SP3 — World and progression » (English): the camp is the home screen; Oracle week is ISO Monday–Sunday in `Europe/Zurich` (`DISCORDE_TZ`); mastery rule; rewards are all listed in advance in the cabin; `DISCORDE_TEST_HOOKS=1` enables the `X-Discorde-Day` header for tests only (never set it in production); art is served from `web/public/art` (≈ 1.9 MB total); sounds are synthesised (mute in Réglages or the TopBar).

`scripts/check.sh` → `== ALL GREEN`. Then, as SP1/SP2 did, verify the production compose: `docker compose -f compose.yaml up -d --build`, wait for `healthy`, `curl -s http://localhost:8080/api/world | head -c 300`, `curl -s -o /dev/null -w '%{http_code} %{content_type}\n' http://localhost:8080/art/dragon/dragon_egg_cut.webp` → `200 image/webp`, `docker compose -f compose.yaml down`. Note the image size in the commit message.

- [ ] **Step 4: Commit**

```bash
git add web/e2e/world.spec.ts web/e2e/helpers.ts compose.e2e.yaml README.md
git commit -m "Add SP3 end-to-end tests: camp, Oracle, quests, mastery hatch, boss fight, rewards; enable the test clock in e2e" -- web/e2e/world.spec.ts web/e2e/helpers.ts compose.e2e.yaml README.md
```

---

### Task 10: Playability review of SP3 at iPad viewports (joint)

Spec §6.2. This task **reports**; it does not fix. The controller triages the findings afterwards.

**Files:**
- Create: `web/e2e/playability-sp3.spec.ts`, `docs/reviews/sp3/*.png`, `docs/reviews/sp3/playability.md`
- Modify: `web/playwright.playability.config.ts` (add `'**/playability-sp3.spec.ts'` to `testMatch`; create the file as SP1 Task 14 specifies — `testDir: './e2e'`, `timeout: 120_000`, `workers: 1`, projects `ipad-landscape` 1180×820 and `ipad-portrait` 820×1180 with `devices['iPad Pro 11']`-like touch settings — if SP1 has not landed it yet)

**Interfaces:**
- Consumes: `stubSpeech`, Task 9 helpers (`makeResult`, `postSession`, `skipOnboarding`) and every `data-testid` from Tasks 5–8.

- [ ] **Step 1: `playability-sp3.spec.ts`**

One test per project, profile `` `Ariane-${testInfo.project.name}` `` (10H), saving `docs/reviews/sp3/<project>-NN-<screen>.png` (`fullPage: true`) for:
`01-camp-onboarding-1`, `02-camp-onboarding-3`, `03-camp-egg` (fresh camp), `04-delphes-sealed`, `05-delphes-picker` (école scroll open, monsters listed), `06-delphes-revealed` (after choosing the Hydre), `07-quest-board`, `08-lieutenant-hydre` (gauges at 0), `09-bestiary-locked`, `10-bestiary-entry-locked`, `11-dossier-fresh`, `12-play-quest-intro` (banner), `13-progression-reveal-xp` (after the UI session, before `reveal-continue`), `14-progression-reveal-hatch` (after posting the three mastery days via API, play the short text once more: the reveal shows « L'œuf éclôt ! » and the name input — fill `Braise` and save before the screenshot `15-progression-reveal-named`), `16-camp-hatchling`, `17-dragon-screen-tints` (after the Oracle quest completed via API — Écume unlocked), `18-cabin` (relic + tint owned, everything else known in advance), `19-dossier-neutralised`, `20-bestiary-entry-unlocked` (Hydre full facts), `21-boss-intro` (after neutralising Écho via API), `22-play-boss-intro` (banner, pace options ≥ default), `23-reveal-boss-lost` (the reveal only shows for a UI session: play the boss text in the UI at pace 1 with a poor draft and fix nothing → the reveal's `reveal-boss` lost card), `24-break-nudge` (after seeding `discorde.playClock` as Task 9 does), `25-settings-sound-weekly`, `26-camp-weekly-reached`, `27-camp-reduced-motion` (`page.emulateMedia({ reducedMotion: 'reduce' })` then camp — check nothing depends on animation to be visible).
Also record in the spec's console output: the total transferred bytes of `/art/*` requests on the camp (via `page.on('response')`) — must be < 600 KB per screen; the number of `<img>` without `alt`; whether any element uses a red colour (same scan as Task 9); the `aria-pressed` state of `topbar-mute` after a toggle.

Run: `scripts/playwright.sh --config playwright.playability.config.ts` → the SP1/SP2 playability tests + these 2 pass, 54 new PNGs under `docs/reviews/sp3/`.

- [ ] **Step 2: Look at every screenshot and write `docs/reviews/sp3/playability.md`**

Open each PNG with the Read tool. Report structure (English, quoting French UI text verbatim):
1. **Setup**: image built from commit `<sha>`, viewports, the walk performed, art bytes per screen.
2. **Screen-by-screen notes** (both orientations): camp (does it read as a home? is the calm upper third of the scene actually calm under the HUD? is the egg the emotional centre?), Delphes (are sealed scrolls exciting without being a gamble — is the reward visibly identical for all three?), quest board (is the "known reward" line prominent?), lieutenant page (do three gauges explain the 80 %/3 days/10 traps rule to a 13-year-old?), dossier (is Éris's voice fun and never humiliating? are the real numbers legible under her lines?), bestiary (myth vs « Au camp » separation clear?), progression reveal (pacing of the cards, hatch moment, naming), dragon/cabin (tint contrast on the cut image, greyed-but-listed rewards), boss (intro tension, lost-fight wording), break nudge, settings.
3. **As a 13-year-old fantasy fan**: would she want to come back to the camp? Does the egg make her want to neutralise the Hydre? Are the Oracle scrolls a weekly ritual she'd tell a friend about? Is Éris funny? Does the bestiary teach her something she'd repeat? Which reward would she want first?
4. **As a game designer**: engagement loop (camp → quest → text → reveal → camp: taps and seconds per loop), clarity (does she know at every moment what to do next?), fairness (is the mastery window understandable and reachable in ~2 weeks of 3 sessions?), tone (no blame, no red, no "missed"/"lost" wording, a lost boss fight reads as open), **dark-pattern audit** (no streaks, no timers unless opted in, no variable rewards, no scarcity, no FOMO at week end — check the exact wording of expired Oracle quests, no notifications, no currency), pacing (reveal length, 25-minute nudge), feedback (XP bar, quest counters), accessibility (reduced motion, mute, touch targets, alt texts).
5. **Prioritised findings**: table `P0 (blocks play) / P1 (hurts the loop or the tone) / P2 (polish)`, each with screen, evidence (screenshot file), and a concrete suggested fix. List what should *not* change.
6. **Spec conformance spot-checks**: §3.6 mastery rule visible and correct; weekly goal instead of streaks; break suggestion present and dismissible; rewards known in advance everywhere (Oracle, board, boss, cabin); §2 taunts about her tricks only (quote three dossier lines); bestiary facts are real (spot-check two against the cited sources); no external requests (`page.on('request')` domains = only the app origin); art served from `/art/`; `prefers-reduced-motion` respected.

- [ ] **Step 3: Commit**

```bash
git add web/playwright.playability.config.ts web/e2e/playability-sp3.spec.ts docs/reviews/sp3
git commit -m "Add SP3 playability review with iPad screenshots" -- web/playwright.playability.config.ts web/e2e/playability-sp3.spec.ts docs/reviews/sp3
```

---

## Self-review notes (written by the planner)

- **Spec coverage.** §5 SP3: camp hub → Task 5; Delphi/Oracle weekly scrolls → Tasks 3, 7; quest board → Tasks 3, 7; lieutenants and boss fights → Tasks 1–3, 6, 7; Éris's file with voice lines → Task 6 (dossier), Task 8 (reactions in the reveal), SP1 `erisLine` kept; dragon companion (naming, colour, growth) → Tasks 2, 3, 8; rewards → Tasks 1–3, 8 (cabin lists every reward in advance); bestiary with myth facts → Task 6; mastery rules → Tasks 1–2; weekly goal → Tasks 2, 5; break suggestion → Task 5; art → Task 4 (existing generated set; no new generation, Decision 12); juice (animations, sounds, particles) → Task 4 with reduced-motion and mute → Tasks 4–5. §3.6 XP sources (effort, catch rate, self-corrections) → `session_xp`; "personal bests, not leaderboards" → no cross-profile data anywhere; "no guilt messaging, no push notifications, no timers unless opted in" → Decisions 15–16, Task 9 test 9, Task 10 audit. §3.2 due date → prophecy → Tasks 3, 5, 7 and ×1.5 XP (Decision 10). §1.6 nothing can be lost → permanent mastery, lost boss keeps the quest, shelving without penalty. §6 gates → Tasks 9, 10. Task brief extras: dictée préparée as prophecy ✔, catch-rate mastery ≥ 80 %/3 days/≥ 10 ✔ (Decision 3 interprets "occurrences"), colour tint via CSS filter ✔, sounds generated with WebAudio ✔, art from `web/public` ✔ (size test in Task 4), all UI text French ✔, migrations from `004` ✔, pathspec commits ✔.
- **Placeholder scan.** No TBD/TODO. Screens are specified by exact strings, test ids and behaviours; pure modules have code. Prose that drifted into deliberation during drafting (Task 5 camp cards, Task 7 boss lines, Task 10 boss-lost screenshot) was rewritten as single instructions.
- **Type consistency.** `LIEUTENANT_ORDER` identical in `catalog.py` and `world/types.ts`; `derived:sirenes`/`derived:lethe` keys in Decision 2, `catalog.py`, `derived.ts`, `stats.py` filter; `Progression` fields (`xp.session/bonuses/total_before/total_after/rank_before/rank_after/title_after`, `quests[].counted/progress/goal/completed/reward_id`, `neutralised`, `rewards`, `dragon.stage_before/stage_after/needs_name`, `weekly`, `boss`, `encounter`) in Task 2 `apply_progression` ↔ contracts ↔ Task 8 reveal ↔ Task 9 assertions; `QuestOut.goal/progress/reward/texts` in Task 3 `quest_out` ↔ `quests.ts` tests; `SessionCreate.encounter/quest_id` in Task 2 `schemas.py` ↔ Task 7 `types.ts`/`Play.svelte` ↔ Task 9 `postSession`; `help` query → `help_stage` in Task 7 ↔ Task 3 boss response; `X-Discorde-Day` in Tasks 2, 9, 10; tint ids `tint:ecume` etc. in `catalog.py` ↔ `dragon_out.unlocked_tints` ↔ `TINT_FILTERS` keys (without prefix) ↔ Task 9 `dragon-tint-ecume`; `data-testid`s in Tasks 5–8 ↔ 9–10 (`camp-*`, `scroll-*`, `oracle-*`, `quest-*`, `board-*`, `boss-*`, `lieutenant-*`, `dossier-*`, `bestiary-*`, `dragon-*`, `reveal-*`, `cabin-*`, `break-*`, `topbar-*`, `onboarding-*`).
- **Known simplifications recorded as decisions:** derived categories computed client-side and stored through the SP1 pipeline (Decision 2); `weekly_done` uses the UTC date prefix (documented in Task 2); no new art (Decision 12); Oracle expiry is lazy at the next consultation (Decision 7); Grimoire focus depends on SP2 Task 4 (Decision 21, skippable); boss text choice is heuristic (Decision 8).
