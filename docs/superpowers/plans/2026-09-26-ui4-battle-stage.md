# La Discorde — UI4 "The battle stage" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Play, Grimoire and Boss stop being form pages under a legacy top bar and become one **battle stage**: a full-screen battle backdrop, the dragon on the left, the opponent (a lieutenant or Éris, as a painted cut-out) on the right reacting (taunt, flinch, hit, defeat, retreat), an HP bar showing the opponent's hold on the text, and the dictation or proofreading text on a semi-transparent parchment in Literata. When the iPad keyboard opens, the stage folds into a band above the parchment and stays visible. Results become a **victory sheet** over the dimmed battlefield (laurel wreath, XP rising, the dragon reacting and telling the outcome in dialogue, a « Revoir » scroll for the full review). Every current play mechanic keeps working. A battle walk (iPad screenshots) and the full gate close the milestone.

**Architecture:** One new stage component, `components/battle/BattleStage.svelte`, used by `Play.svelte` (dictation and grimoire) and `Boss.svelte`. It is not a `SceneStage`: the parchment is laid out in viewport space (legibility first), not in art %. It reuses the scene engine's pieces (`SceneTransition`, `FxCanvas`, `Hud`, `SceneExit`, `RotateScreen`, `overlayState`, `DialogueBox`, `Overlay`) and its test ids (`scene-battle`, `stage-hud`), so the scene e2e helpers work on it. Pure logic lives in `web/src/lib/battle/` (who fights where, the HP model, the compact-layout rule, reactions, the UI5 event hooks, every French line). A tiny rune store (`lib/battle/stage.svelte.ts`) carries the stage's HP and reactions, so each phase component drives the stage without going through `Play.svelte`. Task 2 splits `Play.svelte` into a thin controller plus four phase components (`MusterPhase`, `DictationPhase`, `ProofPhase`, `VictoryPhase`), so the two B3 lanes edit disjoint files.

**Tech Stack:** Svelte 5 (runes) + TypeScript + Vite 7, vitest 5 (node env), Playwright 1.63 (WebKit `desktop` 1280×720 and `ipad` 1180×820 touch; `chromium` for one library test), Docker Desktop + Git Bash wrapper scripts. CSS transitions and the Web Animations API (`element.animate`) for reactions; the existing canvas `Particles`/`FxCanvas` for hits and ambience. No new npm dependency (GSAP stays unused: WAAPI covers every reaction here), no server change, no API change.

**Spec:** `docs/superpowers/specs/2026-09-24-scenes-ui-design.md` is binding: §5 (the battle stage), §3 (Play, Boss → battle stage; Results → victory overlay), §4 (stage, reduced motion, rotate screen, performance), §6 (look and feel), §9.4 (UI4), §10 (quality gates, including the compact layout under a simulated keyboard). §7 (audio) and §8 (dialogue content) are UI5: this plan leaves hooks (Ruling C9) and builds neither. The UI3a plan (Rulings A1–A18), the immersion wave (W1–W14, W-a…W-f) and UI3b (B1–B12, B-a…B-d) hold here; the C-series below extends them. Repo-root `CLAUDE.md` is binding for every agent: no "pre-existing" problems, zero svelte-check warnings, a flaky test is a defect, no emoji.

## Dependencies and batching

| Batch | Tasks | Where | Needs | Notes |
|---|---|---|---|---|
| B1 | **1** foundation: `lib/battle/*` (who fights where, HP, layout rule, reactions, events, every French line), the stage store, the viewport watcher, battle art entries, shared copy fixes, guards, e2e helpers | main checkout (`scenes`) | — | Pure code and tests; no screen changes. Focused vitest + svelte-check; no Playwright run needed (no screen changed), one full `scripts/check.sh` at the end of B2 covers it. |
| B2 | **2** the stage: `BattleStage`, `Combatant`, `HpBar`; `Play.svelte` split into four phase components (legacy content moved, not restyled); `Boss.svelte` on the stage; `TopBar` retires; merge staging | main checkout | B1 | Everything after builds on it. Full `PW_WORKERS=4 scripts/check.sh` at the end of the batch. |
| B3 | lane **P**: **3 → 4 → 5** (muster, dictation + compact mode, proofreading + compact mode + legibility) ‖ lane **V**: **6 → 7** (victory sheet, « Revoir » scroll, break nudge; Éris's lair for the boss) | two worktrees from B2's head: `../sp-wt-play` (branch `ui4-play`, `STACK=play`), `../sp-wt-victory` (branch `ui4-victory`, `STACK=victory`) | B2 | The lanes touch disjoint files except the hunks Task 2 fenced (the two `PENDING` sets). Within a lane the tasks are sequential. Each lane runs one full `STACK=<lane> PW_WORKERS=4 scripts/check.sh` at its end; then the controller merges both into `scenes` and runs the full gate once. |
| B4 | **8** the battle walk, the legacy kit's retirement, the full gate | main checkout | B3 merged (+ Task A if the user approved it) | The only task that writes `docs/reviews/ui4/`. |
| — | **A** (optional, needs the user's go-ahead) painted chest and a flustered Éris | main checkout, Forge | B1 | Independent of every other task. Never runs Forge while any Playwright run is going (Ruling F4). Default without it: the laurel wreath (CSS/SVG) and CSS reactions on the existing cut-outs. |

Playwright runs are serialised machine-wide by the lock in `scripts/playwright.sh` (Ruling W-e): parallel lanes code and run vitest in parallel, and their e2e runs queue. A queued run is not a hang.

## Global Constraints

- **Scope (spec §9.4):** "UI4 Battle stage: Play/Boss/Grimoire staging, keyboard compact mode, victory overlay." Out of scope: audio files, channels, sliders and ducking (UI5, spec §7); dialogue content files, guided tours, Éris's taunt catalogue (UI5, spec §8). Static French lines in TypeScript are fine (Ruling A9's precedent) and live in `lib/battle/lines.ts`.
- **Mechanics unchanged (spec §1, §5):** no API shape change, no grading, XP, quest, help-stage, hint-count, Argus, Fil or Bouclier rule change. The dictation runner, `gradeSession`, `gradeText`, `withDerivedCategories`, `filTap`, `activePasses`, `typedPassSets`, the stage-3 frozen count and `savePlayState` keep their behaviour. UI4 changes no server file. The one client state addition is an optional `PlayState.opponent` (presentation only, Ruling C2).
- **Feature parity (spec §3, §5):** "All current play mechanics (pace, pause, replay, help stages, Argus passes, Bouclier, Chouette, Fil, word editor) keep working with restyled controls." The Parity map below is the review gate. A control may move (into the compact bar, behind the « Revoir » scroll), never disappear.
- **Legibility beats décor (spec §5):** the text the player reads or writes is Literata, at least 22 px, line height at least 1.8, dark ink (`--ink`) on a parchment whose text zone is at least 94 % opaque (contrast ≥ 7:1 over a black backdrop, unit-tested). In the full layout its column holds 44–72 characters per line and is at least 55 % of the viewport height during proofreading. During proofreading the backdrop dims and the combatants stop idling (Ruling C12). Nothing animates over or behind the text.
- **Routes (spec §2.3):** every route name and path stays; none is added. The « Revoir » scroll is the query `?panel=revoir` on `play`/`grimoire` (Ruling C1), opened with `openPanel` and closed with `closePanel`, so Back, reload and deep links work. Test ids keep their names and meanings (list in the Parity map); new elements get new test ids.
- **Stage conventions:** the stage root is `data-testid="scene-battle"` with `data-phase`, `data-layout` (`full` | `compact`), `data-opponent`, `data-backdrop`, `data-reduced-motion`; it wraps its content in `SceneTransition` (so `expectScene(page, 'battle')` waits for it), renders the HUD in `[data-testid="stage-hud"]`, turns `inert` and fades its `.stage-text` while an overlay is open (`overlayState`), and mounts `RotateScreen` (portrait) with its backdrop. An overlay on it is an `Overlay` (variant `scroll` for « Revoir »), with the immersion rules W1/W2/W11 (in-world object, voice plate, below the HUD band).
- **Motion (spec §4):** honour `prefers-reduced-motion`: no idle bob, no particles, no transform in any reaction (fades and brightness only, unit-tested), the HP bar and the XP laurel jump to their values. `data-reduced-motion` on the stage mirrors it.
- **Performance (spec §4):** the battle backdrops are the existing `battle_river/coast/temple.webp` and `eris_lair.webp` (all < 300 KB, covered by `budget.test.ts`); the stage preloads nothing else. No backdrop is added.
- **French copy:** every French string of this plan is used verbatim; they all live in `lib/battle/lines.ts` (Task 1), except the untouched ones listed in the tasks. In-world, warm, gender-neutral towards the player (never « héros » as a vocative, no adjective or participle agreeing with her: « prête », « sûre », « arrêtée », « piégée » go, Ruling C8). No school register (« niveau », « HarmoS », « réviser », grade codes such as « 10H », « comme en classe », « examen »), no admin or technical register, no « ≈ », no form plural « (s) » (`plural()`), elision through `de()`, dates through `longDate()`, rates through `rateText()`. Éris's taunts target her own tricks and the camp's heroes in-fiction, never the player's ability (`FORBIDDEN` in `eris.ts`, checked over every Éris line by `lines.test.ts`). Code, comments, docs and commit messages are in English.
- **Ethics and colour:** no red (e2e `redScan`); orange is Éris's (`kit-note data-tone="eris"`, `--orange-ink` for text); the HP bar fills with Éris's violet (`--violet`, `--violet-dark`); reward text on parchment is `--reward-ink`. Nothing is lost, no guilt wording (`manqué|raté|perdu`); a battle never "fails": the opponent is routed, pushed back or still standing, and every outcome shows its laurels and XP.
- **No emoji (CLAUDE.md):** painted icons (`TOOL_ICONS`, `ART.icons.*`, `LIEUTENANT_ICONS`), the shared `Icon` SVGs, an inline SVG (the laurel wreath) or words.
- **Accessibility:** touch targets ≥ 48 px for every control on the stage, compact bar included (`expectOverlayTapTargets` on the parchment, its tool rows and the overlays); the words of the text (proofreading tokens, the « Revoir » scroll) are inline targets as today: each word's line box is ≥ 41 px (22 px × 1.9) and its padding extends the hit area to ~44 px, so they are outside the 48 px sweep and their size is guarded by the legibility e2e instead; every control a real `<button>`/`<input>`/`<textarea>`/radio; the HP bar is `role="meter"` with a French `aria-label`; combatant images have `alt` (the opponent's name, the dragon's name); focus rings visible (`--gold-light`); closing « Revoir » returns focus to its button; form elements keep `autocorrect="off"`, `autocapitalize="off"`, `spellcheck="false"`, `lang="fr"`.
- **Guards that must stay green (vitest):** `noEmoji.test.ts`; `placesKit.test.ts`; the new `battleKit.test.ts` (no legacy `.btn`/`.card`/`.chip`/`.parchment` under `components/battle/` and in `Play`/`Boss`, its `PENDING` only shrinks and is empty after Task 7); `registerGuard.test.ts` (Task 1 adds `lib/battle`; Task 2 drops the battle exemption and adds a fenced `PENDING`); `formPlural.test.ts`; `noGuilt.test.ts`; `components/places/headings.test.ts`; `voices.test.ts`; `kit*.test.ts`; `lib/battle/*.test.ts`; `budget.test.ts`; `e2eCrashGuard.test.ts` (every spec imports `test`/`expect` from `./crashGuard`).
- **Legacy CSS:** new code never uses the class names `screen`, `scene`, `btn*`, `card`, `chip*`, `parchment`, `eris-panel`, `muted`, `orange`, `banner*`. Task 8 deletes those rules from `app.css` once nothing uses them.
- **Toolchain:** no Node and no host Python for tooling. From the repo root, in Git Bash:
  - `scripts/npm.sh run test -- <files>` (vitest, focused);
  - `scripts/npm.sh run check` (svelte-check: `0 errors and 0 warnings`);
  - `STACK=<lane> scripts/playwright.sh <spec-filter> [--project=<name>] [--repeat-each=3]`;
  - `STACK=<lane> PW_WORKERS=4 scripts/check.sh` (the full gate);
  - `scripts/playwright.sh --config playwright.playability.config.ts playability-ui4` (the walk; writes to `web/test-results/walk-ui4` unless `WALK_OUT=docs/reviews/ui4`).
  In the main checkout `STACK` is unset. In a worktree always set the lane's `STACK`, so compose project, image, port and `node_modules` volume stay apart. Never run Forge (art) and e2e at the same time (Ruling F4). Do not run Docker or Playwright outside these wrappers.
- **Testing rules:** per task, run the focused vitest files and `svelte-check`; run every **new or changed** e2e spec with `--repeat-each=3`; run every **touched but unchanged-in-intent** spec (selectors migrated) once. One full `scripts/check.sh` per lane or batch, not per task. Playwright is serialised machine-wide by `scripts/playwright.sh`'s lock. The crash-only retry (`scripts/playwright-crash-retry.mjs`) retries a named "browser crashed" failure once; any other failure is a real failure. A flake is a defect: root-cause it, never retry it away.
- **e2e robustness (8 workers by default):** each test creates its own hero (`createProfileApi` + `uniqueName`) and its own text (`createText` with a `uniqueName` title); play states are seeded per page with `seedPlay` (Task 1), never shared; wait with `expectScene(page, 'battle')`, `expect.poll`, `toHaveAttribute`, `getAnimations().length`; no `waitForTimeout` or fixed sleeps; scope locators to `battle-parchment` or their overlay; never assume the shared database holds only your texts; a finger on `ipad`, a mouse on `desktop` (`tap(locator, testInfo)`). The simulated keyboard is `installKeyboardSim`/`setKeyboard` (Task 1): it stands in for `window.visualViewport` before the app starts, exactly as `stubSpeech` does for `speechSynthesis`.
- **Commits:** on the lane's branch (`scenes` in the main checkout). **Always** `git add <paths> && git commit -m "..." -- <paths>`; a `git mv` / `git rm` names both paths. Never `git add -A`, `git stash`, `git reset`, `git checkout`, `git restore` of tracked work, `git clean`, or any history rewrite. End every message with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>` (or your harness's trailer). The walk's screenshots go to the scratch dir; `docs/reviews/ui4/*.png` is written only in Task 8's baseline step.
- **Verification:** run each task's commands and paste the real output (counts included) into the report. A failing, flaky or warning test anywhere is yours to fix or to report as an open item, never "pre-existing" (CLAUDE.md).

## Rulings taken by this plan (the spec is silent; do not re-ask unless marked)

- **C1 Routes and mounting.** No route is added or removed. `play`, `grimoire` and `boss` keep returning `null` from `placeFor`. The battle phases (muster, dictation, proofreading, victory) share one `BattleStage` inside one `Play` instance: a phase change never remounts the stage or replays its entry. The « Revoir » scroll is `?panel=revoir` on the current `play`/`grimoire` URL (its other query keys kept); `Play` reads it from `query.panel`.
- **C2 Who fights where.** `opponentFor()` picks the opponent: the boss route or `encounter=eris` → Éris; `encounter=<lieutenant>` → that lieutenant; the grimoire (no encounter) → Éris, who corrupted it; a free text → among the hero's awake, not-yet-neutralised lieutenants (stirring ones first), the one at `textId % n` (stable per text); none left → Éris. Backdrops (`HOME`): L'Hydre and Léthé by the river (`battle_river`), Protée and the Sirènes on the rocky coast (`battle_coast`), Écho and la Chimère in the ruined temple (`battle_temple`), Éris in the temple for a grimoire or a free text and in her lair (`eris_lair`) for the boss. The choice is stored once in `PlayState.opponent` (optional field, no version bump), so a reload or a resume keeps the same opponent. Until `/camp` has answered, a free text shows the backdrop without combatants (they fade in).
- **C3 The HP bar never grades live — CONTROLLER CONFIRMATION REQUESTED.** Help stages decide what the player may know while proofreading (stage 3: a frozen count; stage 4: nothing). A bar that dropped as each fix was made would tell her, word by word, whether an edit was right, at every stage: a new aid, a pedagogy change (spec §1). So: during the muster, the dictation and the proofreading the bar is full (« L'emprise de l'Hydre »); at help stage 3 it carries as many notches as the frozen count (information she already has). The drop happens at the **reckoning**, the start of the victory phase: one strike per trap she caught (`reckoningSteps`), the opponent flinching under each, then routed (`defeat`), pushed back (`retreat`) or still standing (`taunt`). Proofreading reactions are neutral: the Chouette makes the opponent flinch (the owl's hint already shows the spot), a new Argus pass makes the dragon cheer, an edit makes nothing move. Alternative if the controller prefers the literal spec reading: live drop at help stages 1–2 only (costs one `$derived` in `ProofPhase` and one e2e), stages 3–4 unchanged.
- **C4 Compact mode.** `battleLayout(vvHeight, innerHeight)` is `compact` when the visual viewport is shorter than `min(560, innerHeight)` px (the iPad landscape keyboard leaves ~420 of 820; a desktop window under 560 px tall is the "reduced viewport height" of spec §10), else `full`. In compact the stage follows the visual viewport (`top: var(--vv-top)`, `height: var(--vvh)`): the scene becomes a band of `clamp(64px, 20 % of vvh, 104px)` at the top holding the dragon, the HP bar and the opponent, and the parchment fills the rest, wider (`min(96vw, 60rem)`). One `watchViewport()` (refcounted) owns `--vvh` and `--vv-top`; the per-component `--vvh` effects of Dictation and Proofreading go.
- **C5 The top bar retires.** `TopBar.svelte` is deleted (Task 2). In the muster and the victory the stage shows the scene `Hud` (hero chip → the hero panel in the cabin, whose medallions reach « La lyre », « Ton journal » and « Changer de héros », UI3b B2; the XP laurel; the dragon; the mute lyre) and the exit sign « Le camp » (`scene-exit`). During the dictation and the proofreading there is no HUD (as today) and the way out is « Quitter » in the parchment's header, with its confirm (the dictation's exists; the proofreading gets the same, Task 5).
- **C6 The victory sheet.** Results are not an overlay route but the victory phase: a scroll (`kit-scroll`) unrolled over the dimmed battlefield, crowned by a laurel wreath (inline SVG, leaves growing in), with the outcome title (`victory-title`), the tally lines (`results-catch-rate`, `results-score`, words, `results-threads`, Éris's extra traps), then the spoils (the old progression reveal, restyled in kit objects, test ids kept), then « Continuer » (`reveal-continue`), which folds the spoils away and starts the dialogue (Éris's line, then the dragon's). The three actions — « Revoir » (`battle-revoir`, opens the scroll), « Rejouer ce texte », « Retour au camp » (`btn-back-camp`) — sit at the sheet's foot as soon as the Muses have counted (as today's results always had them), so no flow depends on reading the spoils first. The tally shows at once (never gated on an animation). A painted chest appears only if Task A was approved and run.
- **C7 Voices in battle.** Éris speaks (her portrait, `erisSays`): at the muster from a voice plate on the parchment (her dossier line for the lieutenant on stage, her challenge line for the boss, her grimoire line), and first in the victory dialogue (`erisLine`, unchanged). The dragon speaks (`dragonSays`) the tally, the help-stage message and the « Revoir » hint in the victory dialogue, and the break nudge. Lieutenants do not speak (no new speaker id). `DialogueBox` gets a `dock` prop (`'art'` default, `'fill'` for a container) for the victory.
- **C8 Copy.** Gender-neutral fixes: « Tu reprends là où tu t'étais arrêtée » → « Ton brouillon t'attend là où tu l'avais laissé. »; « Relis ton texte quand tu es prête » → « Relis ton texte quand tu veux. »; « Valide quand tu es sûre » → « Valide quand tout te semble juste. »; the Argus hint « Les mots qui t'ont déjà piégée » → « Les mots qui t'ont déjà joué des tours. Regarde chaque lettre. ». Paces: « Comme en classe » → « D'un bon pas », « Comme à l'examen » → « D'une traite » (descriptions below). The muster shows no grade code and no « ≈ »: « 84 mots » (`plural`). The prophecy says its day with `longDate` (« samedi 30 juin 2035 »). « Les récompenses augmentent avec le rythme. » → « Plus le rythme est vif, plus la gloire est grande. ».
- **C9 UI5 hooks, not UI5.** `lib/battle/events.ts` emits typed battle events (`start`, `phase`, `tool`, `strike`, `outcome`, `retry`, `leave`) to listeners nobody registers yet; `BATTLE_NARRATOR` names the dialogue event keys (`battle.start`, `battle.caught`, `battle.missed`, `battle.victory`, `battle.retreat`, `battle.retry`); `BattleDef.ambience.music` is `null` (the scenes' convention); `data-phase` on the stage lets UI5 duck music during proofreading. No audio, no dialogue file.
- **C10 Reactions.** CSS/WAAPI on the existing cut-outs only: an outer `.actor` element animated in screen space (`reactionAnimation(reaction, { away, reduced })`, `away` = +1 for the opponent on the right, −1 for the dragon), an inner `.facing` element that mirrors the art so the two face each other (`FACES` table), the idle breathing from the kit (`idle-breathe`), hit bursts from `Particles` (`kind="burst"`). `defeat` and `retreat` hold their end pose (`fill: 'forwards'`). Reduced motion: opacity and brightness only.
- **C11 Portrait.** The battle shows the rotate screen in portrait (spec §1), with its backdrop. A dictation at pace 3 or 4 pauses itself when the iPad turns to portrait (it would otherwise keep reading words she cannot see) and waits for « Reprendre »; « Reprendre » now shows for every pace whenever the runner is paused.
- **C12 Legibility numbers.** Text zone `--battle-text-bg: rgba(250, 243, 226, 0.96)` over the parchment texture; ink `--ink`; Literata 22 px (`clamp(22px, 1.9vw, 26px)`), line height 1.9 (the 44 px tap rows), column `max-width: 34em` in full mode (≈ 60–70 characters), the whole parchment width in compact. During proofreading the backdrop is `brightness(0.7) saturate(0.85)` and the combatants' idle animation pauses. The parchment edges may be more transparent (a mask), never the text zone.
- **C13 Merge staging.** Task 1 writes every French line of the milestone into `lines.ts`, fenced by task; lanes consume it and change only their own fence if they must. Task 2 moves each phase into its own component with its full prop contract, so no lane edits `Play.svelte`; `battleKit.test.ts`'s and `registerGuard.test.ts`'s `PENDING` sets list lane P's files, then a fence comment line, then lane V's files, so each lane's removals merge cleanly.
- **C14 The legacy kit retires.** Once the battle is restyled nothing renders `.btn`, `.card`, `.chip`, `.parchment`, `.screen`, `.scene`, `.eris-panel`, `.muted`, `.orange`, `.banner`: Task 8 deletes those rules from `app.css` (after a grep proves them unused) and widens the kit guard to every component and screen. `TopBar.svelte` goes (Task 2); `PaceSelect.svelte` (Task 3), `Results.svelte`, `ProgressionReveal.svelte` and `BreakNudge.svelte` (Task 6) move under `components/battle/` with new names; the unreferenced `battle.webp`/`argus.webp` go (Task 7, with a guard). `Dragon.svelte` stays (the spoils' hatch uses it).
- **C15 Proofreading has a way out.** « Quitter » in the proofreading header asks « Ta relecture est gardée. Veux-tu vraiment quitter ? » and, confirmed, shows the resume banner (as the dictation's « Quitter » does, P1-4); the play state is saved already. This adds a control the proofreading never had (today it is a dead end without the browser's Back): flagged for the controller as a small, spec-compatible addition.

## Parity map (review gate: every current feature → its new home)

| Current screen / component | Features, links, forms, states (test ids kept) | New home |
|---|---|---|
| `TopBar` (Play intro/results, Boss) | avatar + name, screen title, « Retour au camp » (`topbar-camp`), « Lire ton journal » (`topbar-journal` → stats), « La lyre » (`topbar-lyre` → settings), « Son » (`topbar-mute`), « Changer de héros » | Muster and victory: the scene `Hud` (`hud-hero` → hero panel → `hero-journal`, `hero-settings`, `hero-switch`; `hud-mute`; `hud-xp`; `hud-dragon`) + « Le camp » (`scene-exit`); the stage's plaque names the opponent. Dictation/proofreading: « Quitter » (C5). `topbar-*` test ids retire with the component (Task 2 migrates every spec). |
| Play loading / error / « Les Muses comptent les pièges déjoués… » | loading line, error line | A ribbon on the stage's parchment (`battle-status`), same words (Task 2) |
| Play resume banner | « Tu reprends… » (C8 rewording), « Continuer », « Recommencer » | Muster parchment, `battle-resume`, `battle-resume-continue`, `battle-resume-restart` (Task 2 moves, Task 3 restyles) |
| Play intro (dictation) | title (h2), credits, level chip, « ≈ N mots », prophecy (`play-prophecy`), quest banner (`play-quest-banner`), boss banner (`play-boss-banner`), « Voir la feuille » / scan pages, no-voice note, « Choisis ton rythme » + PaceSelect (`pace-option-1..4`, `.disabled` below `minPace` with « Pas pendant un combat »), rewards line, « Commencer la dictée », « Grimoire corrompu » (`btn-grimoire`) + caption | Muster parchment (Task 3): title ribbon (h2), credits, « 84 mots » tag (grade code dropped, C8), prophecy with `longDate`, quest and boss ribbons, the sheet fold, the no-voice note, four pace medallions (radios, test ids and `.disabled` kept), the glory line, « Commencer la dictée », the grimoire way with its caption; Éris's voice plate (C7) |
| Play intro (grimoire) | h2 « Grimoire corrompu », Éris framing paragraph, corrupt error + « Retour aux Parchemins » (`btn-back-library`), « Éris corrompt le grimoire… », « Ouvrir le grimoire » (`btn-open-grimoire`) | Muster parchment (Task 3): h2 kept, Éris's grimoire line as her voice plate, the rule line, the error as `kit-note data-tone="eris"` + « Retour aux parchemins » (`btn-back-library`), the corrupting ribbon, « Ouvrir le grimoire » |
| `Dictation` | « Quitter » (`btn-quit-dictation`) + confirm (`btn-quit-confirm`, « Continuer la dictée »), h2 « Dictée », progress (phrase / groupe / lecture complète), status line + dot, « Réécouter (n) », « Suivant » (`btn-next`), « Pause », « Reprendre », « J'ai fini d'écrire » (`btn-finish-writing`), textarea (`dictation-textarea`, autocorrect off, autoscroll at end), keyboard sizing (`--vvh`), draft autosave | `DictationPhase` on the parchment (Task 4): same controls as bronze buttons ≥ 48 px, the status as a small seal + words, the textarea in Literata on the text zone, compact bar under the band when the keyboard is open (C4), portrait auto-pause (C11) |
| `Proofreading` | h2 « Relecture » / « Grimoire corrompu », stage sentence (grimoire prefix), Argus pass chips (active, done + check), « Passe suivante » (`btn-next-pass`), pass hint, stage-1 spotlight + dim, Bouclier + sentence nav + position, Chouette (hints left) + message + highlight + sentence jump, Fil (`btn-fil`, `fil-message`, `fil-next`, `btn-fil-exit`), « Modifier tout le texte » + textarea, token taps (`tok-N`) → `WordEditor` (`word-editor`, Enter / OK / blur commit, Escape cancel, empty deletes, hint), « J'ai terminé ma relecture » (`btn-done-proofreading`) + « Oui, valider » / « Continuer la relecture », autosave, keyboard scroll-into-view, frozen stage-3 count | `ProofPhase` on the parchment (Task 5): the Argus strip as bronze plaques with the painted Argus mark, the four tools as emblem buttons (painted icons), the Fil and the Chouette as notes, the Bouclier nav, the text zone (C12), the editor restyled, the done footer; compact mode while editing; « Quitter » (C15); neutral stage reactions (C3) |
| `Results` | h1 « Relecture terminée », Éris's line card, catch-rate (`results-catch-rate`, perfect / grimoire wordings, `50 %` with its no-break space), `results-score`, words, `results-threads`, Éris's extra traps, help-stage message banner, submit error + « Réessayer », token text with caught (olive) / still-wrong (orange) marks and missing-word markers, tap → « Attendu : … » + explanation / caught text / « Mot oublié », « Ce qu'Éris a tenté » by category with « déjoué », « Rejouer ce texte », « Retour au camp » (`btn-back-camp`) | Victory sheet (Task 6): title (`victory-title`), tally lines (test ids kept), submit error + « Réessayer », actions; Éris's line and the help message move into the dialogue (C7); the token text, the explanations and the category list move into the « Revoir » scroll (`overlay-revoir`, `?panel=revoir`) |
| `ProgressionReveal` | XP card (`reveal-xp`, +N, rank-up two-phase gauge, bonus chips, « Nouveau rang »), quest cards (`reveal-quest-<id>`), neutralised cards (`reveal-neutralised-<key>`, art, relic medallion, burst), extra rewards (`reveal-reward-<id>`), dragon card (`reveal-dragon`, hatch, name form `reveal-name-input` / `reveal-name-save`, errors), weekly (`reveal-weekly`), boss (`reveal-boss`, `reveal-boss-too-easy`), sound cues, « Voir la relecture » (`reveal-continue`) | Victory sheet spoils (Task 6, `git mv` to `components/battle/VictorySpoils.svelte`): same content and test ids as kit objects; the XP card is the `LaurelBar` rising; `reveal-continue` reads « Continuer » |
| `BreakNudge` | the dragon's (or the egg's) line, « Pause » (`break-pause`), « Encore un texte » (`break-continue`) | The dragon speaking on the victory sheet (Task 6, moved), same copy and test ids |
| `Boss` | battlefield (dragon + Éris), challenge line per tier, `boss-tier` « Combat I/II/III », `boss-reward` medallion + « Récompense si tu gagnes : … », rules, start error, `boss-start` « Affronter Éris » / « Relancer le combat » → play or grimoire route with `quest`, `encounter=eris`, `help` | The stage in Éris's lair (Task 7): Éris as the opponent, her challenge as her voice plate, the same info on the parchment |
| Grimoire path | library `btn-grimoire`, the boss grimoire retry, `corrupt` → proofreading, grimoire wordings in proofreading and results | Kept end to end: the `grimoire` route renders `Play mode="grimoire"` on the stage (Éris in the temple), wordings in `lines.ts` |
| App shell | arrive veil from the camp, PIN gate, profile gate | Unchanged (Task 2 updates the comment) |

## File map

| File | Responsibility | Task |
|---|---|---|
| `web/src/lib/battle/{battle,hp,layout,reactions,events,lines}.ts` (+ tests), `web/src/lib/battle/stage.svelte.ts`, `web/src/lib/battle/viewport.svelte.ts` (+ `stage.svelte.test.ts`), `web/src/lib/battle/legibility.test.ts` | pure battle logic, copy, stage store, viewport watcher | 1 |
| `web/src/lib/world/art.ts` (+ test), `web/src/lib/playState.ts` (+ test), `web/src/lib/dictation/script.ts` (+ test), `web/src/lib/argus.ts` (+ test), `web/src/styles/kit.css` (+ `kit.test.ts`) | battle art, `PlayState.opponent`, pace and Argus copy, battle tokens | 1 |
| `web/src/testing/legacyClasses.ts`, `web/src/placesKit.test.ts`, `web/src/battleKit.test.ts`, `web/src/registerGuard.test.ts` | guards | 1 (2 fences) |
| `web/e2e/helpers.ts` | `installKeyboardSim`, `setKeyboard`, `seedPlay`, `resumeSeeded`, `expectBattle`, `battleRects` | 1 |
| `web/src/components/battle/{BattleStage,Combatant,HpBar,MusterPhase,DictationPhase,ProofPhase,VictoryPhase,BossMuster,TokenText,WordEditor}.svelte`, `web/src/screens/{Play,Boss}.svelte`, `web/src/App.svelte`, `web/src/components/TopBar.svelte` (deleted) | the stage, the split, the top bar's retirement | 2 |
| `web/e2e/scenes-battle.spec.ts`, `web/e2e/{scenes-parity,scenes-camp,alexandria}.spec.ts` | stage e2e, selector migration | 2 |
| `web/src/components/battle/{MusterPhase,PaceMedallions}.svelte`, `web/src/components/PaceSelect.svelte` (moved), `web/e2e/scenes-battle-play.spec.ts`, `web/e2e/scan.spec.ts` | the muster | 3 |
| `web/src/components/battle/DictationPhase.svelte`, `web/src/lib/dictation/runner.ts` (read only) | dictation + compact | 4 |
| `web/src/components/battle/{ProofPhase,TokenText,WordEditor}.svelte` | proofreading + compact + legibility | 5 |
| `web/src/components/battle/{VictoryPhase,VictorySheet,VictorySpoils,LaurelWreath,ReviewScroll,DragonNudge}.svelte` (Results, ProgressionReveal, BreakNudge moved), `web/src/components/scene/DialogueBox.svelte`, `web/e2e/scenes-battle-victory.spec.ts`, `web/e2e/{happy-path,world,grimoire}.spec.ts` | the victory | 6 |
| `web/src/components/battle/BossMuster.svelte`, `web/src/screens/Boss.svelte`, `web/src/lib/world/scenes/camp.ts`, `web/public/art/scenes/{battle,argus}.webp` (deleted), `web/src/artReferenced.test.ts` | Éris's lair | 7 |
| `web/e2e/playability-ui4.spec.ts`, `docs/reviews/ui4/*.png`, `web/src/app.css` (+ `app.css.test.ts`), `web/src/battleKit.test.ts` | walk, legacy kit retirement, gate | 8 |
| `assets/art/battle/*`, `web/public/art/battle/*`, `docs/art/scenes.md` | optional painted chest and flustered Éris | A |

---

### Task 1: Foundation — who fights where, the HP model, the compact rule, reactions, the UI5 hooks, every French line, the stage store, guards, e2e helpers

**Files:**
- Create (all under `web/src/lib/battle/`): `battle.ts`, `battle.test.ts`, `hp.ts`, `hp.test.ts`, `layout.ts`, `layout.test.ts`, `reactions.ts`, `reactions.test.ts`, `events.ts`, `events.test.ts`, `lines.ts`, `lines.test.ts`, `stage.svelte.ts`, `stage.svelte.test.ts`, `viewport.svelte.ts`, `legibility.test.ts`
- Create: `web/src/testing/legacyClasses.ts`, `web/src/battleKit.test.ts`
- Modify: `web/src/placesKit.test.ts` (imports `legacyUses` from the new module), `web/src/registerGuard.test.ts` (scans `lib/battle`)
- Modify: `web/src/lib/world/art.ts` (+ test), `web/src/lib/playState.ts` (+ test), `web/src/lib/dictation/script.ts` (+ test), `web/src/lib/argus.ts` (+ test), `web/src/styles/kit.css` (+ `kit.test.ts`)
- Modify: `web/e2e/helpers.ts`

**Interfaces:**
- Consumes: `LieutenantKey`, `LieutenantState` (`lib/world/types`), `PlayMode` (`lib/types`), `FxPreset` (`lib/scene/types`), `ART`, `lieutenantName`, `genderFor`, `dossierLine`, `FORBIDDEN`, `Band` (`lib/world/eris`), `plural`, `rateText` (`lib/text/french`), `contrastRatio` (`lib/ui/contrast`), `measureBoxes`, `expectScene` (`e2e/helpers.ts`).
- Produces:
  - `battle.ts`: `type OpponentId = LieutenantKey | 'eris'`, `type BackdropId = 'river' | 'coast' | 'temple' | 'lair'`, `type BattleMode = PlayMode | 'boss'`, `type BattlePhase = 'muster' | 'dictation' | 'proofreading' | 'victory'`, `interface BattleDef`, `HOME`, `BACKDROPS`, `FACES`, `opponentFor(input)`, `battleFor(opponent, ctx)`, `isOpponentId(x)`.
  - `hp.ts`: `interface HpView { value; segments }`, `FULL_HP`, `hpDuringPlay(helpStage, initialErrors)`, `reckoningSteps(draft, caught)`, `type Outcome = 'rout' | 'push' | 'standoff'`, `outcomeOf(r, boss)`, `hpPercent(hp)`.
  - `layout.ts`: `COMPACT_MAX_PX`, `type BattleLayout = 'full' | 'compact'`, `battleLayout(vvHeight, innerHeight)`, `bandHeight(vvHeight)`.
  - `reactions.ts`: `REACTIONS`, `type Reaction`, `reactionAnimation(reaction, { away, reduced })`.
  - `events.ts`: `type BattleEvent`, `onBattleEvent(fn)`, `emitBattle(e)`, `BATTLE_NARRATOR`.
  - `lines.ts`: every French line of UI4 (`opponentName`, `EMPRISE`, `STAGE`, `MUSTER`, `ERIS_MUSTER`, `musterTaunt`, `DICTATION`, `PROOF`, `victoryTitle`, `VICTORY`, `dragonTally`, `DRAGON_REVIEW_HINT`, `CHALLENGE_LINES`, `BOSS`).
  - `stage.svelte.ts`: `battleStage` (`{ hp, hits, opponent, dragon }`), `react(side, reaction)`, `setHp(hp)`, `strike(value)`, `resetBattleStage()`.
  - `viewport.svelte.ts`: `viewport` (`{ height, top, inner }`), `watchViewport(): () => void`.
  - `ART.scenes.battleRiver | battleCoast | battleTemple | erisLair`; `PlayState.opponent?: OpponentId`; kit tokens `--battle-text-bg`, `--battle-parchment-edge`.
  - `testing/legacyClasses.ts`: `LEGACY_CLASSES`, `legacyUses(source)`.
  - `e2e/helpers.ts`: `installKeyboardSim(page)`, `setKeyboard(page, px)`, `seedPlay(page, seed)`, `resumeSeeded(page)`, `expectBattle(page, phase?)`, `battleRects(page)`.

- [ ] **Step 1: Write the failing unit tests**

`web/src/lib/battle/battle.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { BACKDROPS, FACES, HOME, battleFor, isOpponentId, opponentFor } from './battle';

const lt = (key: string, over: Partial<{ available: boolean; neutralised: boolean; stirring: boolean }> = {}) => ({
  key,
  available: true,
  neutralised: false,
  stirring: false,
  ...over,
});
const SIX = ['hydre', 'echo', 'chimere', 'protee', 'sirenes', 'lethe'].map((k) => lt(k));

describe('who fights where (Ruling C2)', () => {
  it('sends Éris to the boss fight and to an eris encounter, in her lair', () => {
    expect(opponentFor({ mode: 'boss', encounter: null, textId: 4, lieutenants: SIX })).toBe('eris');
    expect(opponentFor({ mode: 'dictation', encounter: 'eris', textId: 4, lieutenants: SIX })).toBe('eris');
    expect(battleFor('eris', { mode: 'boss', encounter: 'eris' }).backdrop.id).toBe('lair');
    expect(battleFor('eris', { mode: 'grimoire', encounter: 'eris' }).backdrop.id).toBe('lair');
  });

  it('brings the quest lieutenant to its own ground', () => {
    expect(opponentFor({ mode: 'dictation', encounter: 'sirenes', textId: 1, lieutenants: SIX })).toBe('sirenes');
    expect(battleFor('sirenes', { mode: 'dictation', encounter: 'sirenes' }).backdrop.id).toBe('coast');
    expect(HOME).toEqual({ hydre: 'river', lethe: 'river', sirenes: 'coast', protee: 'coast', echo: 'temple', chimere: 'temple' });
  });

  it('lets Éris guard her own grimoire, in the ruined temple', () => {
    expect(opponentFor({ mode: 'grimoire', encounter: null, textId: 9, lieutenants: SIX })).toBe('eris');
    expect(battleFor('eris', { mode: 'grimoire', encounter: null }).backdrop.id).toBe('temple');
  });

  it('picks a free text its lieutenant: stirring first, awake and not neutralised, stable per text', () => {
    expect(opponentFor({ mode: 'dictation', encounter: null, textId: 7, lieutenants: SIX })).toBe('echo'); // 7 % 6 = 1
    const some = [lt('hydre', { neutralised: true }), lt('echo', { available: false }), lt('chimere'), lt('lethe', { stirring: true })];
    expect(opponentFor({ mode: 'dictation', encounter: null, textId: 2, lieutenants: some })).toBe('lethe');
    const calm = [lt('hydre', { neutralised: true }), lt('chimere'), lt('lethe')];
    expect(opponentFor({ mode: 'dictation', encounter: null, textId: 3, lieutenants: calm })).toBe('lethe'); // 3 % 2 = 1
    expect(opponentFor({ mode: 'dictation', encounter: null, textId: 3, lieutenants: [] })).toBe('eris');
    expect(opponentFor({ mode: 'dictation', encounter: 'nope', textId: 0, lieutenants: SIX })).toBe('hydre');
  });

  it('describes a battle from the existing art only', () => {
    expect(battleFor('hydre', { mode: 'dictation', encounter: null })).toMatchObject({
      opponent: { id: 'hydre', name: "L'Hydre", art: '/art/lieutenants/hydre_cut.webp' },
      backdrop: { id: 'river', src: '/art/scenes/battle_river.webp' },
      ambience: { music: null },
      narrator: { start: 'battle.start', victory: 'battle.victory' },
    });
    expect(battleFor('eris', { mode: 'boss', encounter: 'eris' }).opponent.art).toBe('/art/characters/eris_cut.webp');
    expect(Object.keys(BACKDROPS).sort()).toEqual(['coast', 'lair', 'river', 'temple']);
    expect(Object.keys(FACES).sort()).toEqual(['chimere', 'dragon', 'echo', 'eris', 'hydre', 'lethe', 'protee', 'sirenes']);
    expect(isOpponentId('lethe') && isOpponentId('eris') && !isOpponentId('argus')).toBe(true);
  });
});
```

`web/src/lib/battle/hp.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { FULL_HP, hpDuringPlay, hpPercent, outcomeOf, reckoningSteps } from './hp';

describe("the opponent's hold on the text (Ruling C3)", () => {
  it('stays full while she plays, notched only by the count stage 3 already shows', () => {
    expect(hpDuringPlay(1, 4)).toEqual(FULL_HP);
    expect(hpDuringPlay(2, 4)).toEqual(FULL_HP);
    expect(hpDuringPlay(3, 4)).toEqual({ value: 1, segments: 4 });
    expect(hpDuringPlay(3, 0)).toEqual(FULL_HP);
    expect(hpDuringPlay(3, undefined)).toEqual(FULL_HP);
    expect(hpDuringPlay(4, 4)).toEqual(FULL_HP);
  });

  it('drops one strike per trap caught at the reckoning, at most eight strikes', () => {
    expect(reckoningSteps(2, 1)).toEqual([0.5]);
    expect(reckoningSteps(4, 4)).toEqual([0.75, 0.5, 0.25, 0]);
    expect(reckoningSteps(0, 0)).toEqual([0]); // a perfect dictation routs her at once
    expect(reckoningSteps(3, 0)).toEqual([]);
    const many = reckoningSteps(20, 20);
    expect(many).toHaveLength(8);
    expect(many.at(-1)).toBe(0);
    for (let i = 1; i < many.length; i++) expect(many[i]).toBeLessThan(many[i - 1]);
  });

  it('names the outcome without a loss: routed, pushed back, or still standing', () => {
    expect(outcomeOf({ draft: 0, caught: 0 }, null)).toBe('rout');
    expect(outcomeOf({ draft: 3, caught: 3 }, null)).toBe('rout');
    expect(outcomeOf({ draft: 3, caught: 1 }, null)).toBe('push');
    expect(outcomeOf({ draft: 3, caught: 0 }, null)).toBe('standoff');
    expect(outcomeOf({ draft: 5, caught: 4 }, { won: true, too_easy: false })).toBe('rout');
    expect(outcomeOf({ draft: 5, caught: 5 }, { won: false, too_easy: false })).toBe('push');
    expect(outcomeOf({ draft: 0, caught: 0 }, { won: false, too_easy: true })).toBe('standoff');
    expect(hpPercent({ value: 0.504, segments: null })).toBe(50);
  });
});
```

`web/src/lib/battle/layout.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { COMPACT_MAX_PX, bandHeight, battleLayout } from './layout';

describe('the compact battle (Ruling C4)', () => {
  it('folds when the keyboard takes the bottom of the screen', () => {
    expect(battleLayout(820, 820)).toBe('full'); // iPad landscape, no keyboard
    expect(battleLayout(765, 820)).toBe('full'); // a hardware keyboard's shortcut bar
    expect(battleLayout(420, 820)).toBe('compact'); // the on-screen keyboard
    expect(battleLayout(720, 720)).toBe('full'); // the desktop project
  });

  it('folds on a short window too (spec §10: a reduced viewport height)', () => {
    expect(battleLayout(480, 480)).toBe('compact');
    expect(battleLayout(COMPACT_MAX_PX, COMPACT_MAX_PX)).toBe('full');
  });

  it('keeps the band between 64 and 104 px', () => {
    expect(bandHeight(420)).toBe(84);
    expect(bandHeight(250)).toBe(64);
    expect(bandHeight(700)).toBe(104);
  });
});
```

`web/src/lib/battle/reactions.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { REACTIONS, reactionAnimation } from './reactions';

describe('reactions on the cut-outs (Ruling C10)', () => {
  it('animates every reaction but idle, and pushes a hit away from the other side', () => {
    expect(reactionAnimation('idle', { away: 1, reduced: false })).toBeNull();
    for (const r of REACTIONS.filter((x) => x !== 'idle')) expect(reactionAnimation(r, { away: 1, reduced: false }), r).not.toBeNull();
    expect(JSON.stringify(reactionAnimation('hit', { away: 1, reduced: false })!.keyframes)).toContain('translateX(14px)');
    expect(JSON.stringify(reactionAnimation('hit', { away: -1, reduced: false })!.keyframes)).toContain('translateX(-14px)');
  });

  it('holds the end pose of a defeat and a retreat', () => {
    expect(reactionAnimation('defeat', { away: 1, reduced: false })!.options.fill).toBe('forwards');
    expect(reactionAnimation('retreat', { away: 1, reduced: false })!.options.fill).toBe('forwards');
  });

  it('never moves anything under reduced motion: opacity and brightness only', () => {
    for (const r of REACTIONS) {
      const a = reactionAnimation(r, { away: 1, reduced: true });
      if (!a) continue;
      for (const k of a.keyframes) expect(Object.keys(k).every((p) => p === 'opacity' || p === 'filter' || p === 'offset'), r).toBe(true);
    }
  });
});
```

`web/src/lib/battle/events.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { BATTLE_NARRATOR, emitBattle, onBattleEvent } from './events';

describe('battle events, the hooks UI5 listens to (Ruling C9)', () => {
  it('delivers events until unsubscribed, and survives a throwing listener', () => {
    const seen = vi.fn();
    const off = onBattleEvent(seen);
    const off2 = onBattleEvent(() => {
      throw new Error('a listener bug');
    });
    emitBattle({ kind: 'strike', value: 0.5 });
    off();
    off2();
    emitBattle({ kind: 'retry' });
    expect(seen).toHaveBeenCalledTimes(1);
    expect(seen).toHaveBeenCalledWith({ kind: 'strike', value: 0.5 });
  });

  it('names the dialogue events of spec §8', () => {
    expect(BATTLE_NARRATOR).toEqual({
      start: 'battle.start',
      caught: 'battle.caught',
      missed: 'battle.missed',
      victory: 'battle.victory',
      retreat: 'battle.retreat',
      retry: 'battle.retry',
    });
  });
});
```

`web/src/lib/battle/lines.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { FORBIDDEN } from '../world/eris';
import { rateText } from '../text/french';
import * as L from './lines';

// Every string reachable from lines.ts, functions called with representative arguments.
function allLines(): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === 'string') out.push(v);
    else if (typeof v === 'function') {
      for (const args of [[0], [1], [2], [3, 5], [1, 2, 0.5, 'dictation'], [1, 2, 0.5, 'grimoire'], ['chantent']]) {
        try {
          walk((v as (...a: unknown[]) => unknown)(...args));
        } catch {
          /* a signature these arguments do not fit */
        }
      }
    } else if (v && typeof v === 'object') for (const x of Object.values(v)) walk(x);
  };
  for (const v of Object.values(L)) walk(v);
  return out.filter((s) => /\p{L}/u.test(s));
}

describe('the battle speaks the camp, kindly (Rulings C7, C8)', () => {
  it('never addresses the player by an agreeing adjective or « héros »', () => {
    const bad = /\b(prête|sûre|arrêtée|piégée)\b|(^|[,!?«]\s*)(cher |jeune |petite? )?héro(s|ïne)\s*[,!]/iu;
    for (const s of allLines()) expect(bad.test(s), s).toBe(false);
  });

  it('keeps Éris on her own tricks', () => {
    for (const s of [...Object.values(L.CHALLENGE_LINES), L.ERIS_MUSTER.free, L.ERIS_MUSTER.grimoire]) {
      for (const f of FORBIDDEN) expect(s.toLowerCase().includes(f), `${f} in ${s}`).toBe(false);
    }
  });

  it('keeps every static voice line short enough for its plate', () => {
    for (const s of [...Object.values(L.CHALLENGE_LINES), L.ERIS_MUSTER.free, L.ERIS_MUSTER.grimoire, L.DRAGON_REVIEW_HINT]) {
      expect(s.length, s).toBeLessThanOrEqual(160);
    }
  });

  it('names the hold of every opponent, elided and agreed', () => {
    expect(L.EMPRISE).toEqual({
      hydre: "L'emprise de l'Hydre",
      echo: "L'emprise d'Écho",
      chimere: "L'emprise de la Chimère",
      protee: "L'emprise de Protée",
      sirenes: "L'emprise des Sirènes",
      lethe: "L'emprise de Léthé",
      eris: "L'emprise d'Éris",
    });
  });

  it('titles every outcome without a loss', () => {
    expect(L.victoryTitle('rout', 'hydre')).toBe('Victoire !');
    expect(L.victoryTitle('push', 'hydre')).toBe("L'Hydre recule !");
    expect(L.victoryTitle('push', 'sirenes')).toBe('Les Sirènes reculent !');
    expect(L.victoryTitle('push', 'eris')).toBe('Éris recule !');
    expect(L.victoryTitle('standoff', 'echo')).toBe('Le combat continue');
  });

  it('lets the dragon tell the tally in words', () => {
    expect(L.dragonTally({ draft: 0, caught: 0, mode: 'dictation' })).toBe("Pas un piège dans ta dictée : Éris n'a rien pu glisser !");
    expect(L.dragonTally({ draft: 5, caught: 5, mode: 'dictation' })).toBe("Tu as déjoué 5 pièges sur 5. Ses lieutenants s'en souviendront !");
    expect(L.dragonTally({ draft: 2, caught: 1, mode: 'dictation' })).toBe('Tu as déjoué 1 piège sur 2. Les autres se cachent encore : on les débusquera ensemble.');
    expect(L.dragonTally({ draft: 4, caught: 1, mode: 'grimoire' })).toBe(
      'Tu as retrouvé 1 dés-accord sur 4. Chaque dés-accord retrouvé en fait un de moins pour la prochaine fois.',
    );
    expect(L.dragonTally({ draft: 3, caught: 0, mode: 'dictation' })).toBe('Ses pièges se sont bien cachés cette fois. Viens, on les regarde ensemble dans « Revoir ».');
  });

  it('keeps the wordings the e2e reads', () => {
    expect(L.VICTORY.caught(1, 2, 0.5, 'dictation')).toBe(`Pièges déjoués : 1 sur 2 (${rateText(0.5)})`);
    expect(L.VICTORY.caught(3, 4, 0.75, 'grimoire')).toBe(`Dés-accords retrouvés : 3 sur 4 (${rateText(0.75)})`);
    expect([L.MUSTER.words(84), L.MUSTER.words(1)]).toEqual(['84 mots', '1 mot']);
  });
});
```

`web/src/lib/battle/stage.svelte.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { battleStage, react, resetBattleStage, setHp, strike } from './stage.svelte';
import { onBattleEvent } from './events';

describe('the stage store the phases drive', () => {
  beforeEach(() => resetBattleStage());

  it('starts full and idle', () => {
    expect(battleStage.hp).toEqual({ value: 1, segments: null });
    expect(battleStage.hits).toBe(0);
    expect(battleStage.opponent.reaction).toBe('idle');
  });

  it('bumps a nonce on every reaction, even a repeated one', () => {
    react('dragon', 'cheer');
    react('dragon', 'cheer');
    expect(battleStage.dragon).toEqual({ reaction: 'cheer', nonce: 2 });
  });

  it('strikes: lowers the hold, counts the hit, the opponent reels, UI5 hears it', () => {
    const seen = vi.fn();
    const off = onBattleEvent(seen);
    setHp({ value: 1, segments: 3 });
    strike(0.5);
    off();
    expect(battleStage.hp).toEqual({ value: 0.5, segments: 3 });
    expect(battleStage.hits).toBe(1);
    expect(battleStage.opponent.reaction).toBe('hit');
    expect(seen).toHaveBeenCalledWith({ kind: 'strike', value: 0.5 });
  });
});
```

`web/src/lib/battle/legibility.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { contrastRatio } from '../ui/contrast';

// Ruling C12: the text zone is semi-transparent, so its worst case is a black backdrop behind it
// (the lair) and its other extreme a white one. The ink must read at 7:1 (WCAG AAA) on both.
const kit = readFileSync('src/styles/kit.css', 'utf-8');
const app = readFileSync('src/app.css', 'utf-8');
const rgba = (name: string) => {
  const m = new RegExp(`--${name}:\\s*rgba\\((\\d+),\\s*(\\d+),\\s*(\\d+),\\s*([\\d.]+)\\)`).exec(kit);
  if (!m) throw new Error(`--${name} is not an rgba() token`);
  return m.slice(1).map(Number);
};
const hex = (c: number[]) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const over = ([r, g, b, a]: number[], bg: number[]) => hex([r, g, b].map((v, i) => v * a + bg[i] * (1 - a)));
const INK = /--ink:\s*(#[0-9a-f]{6})/i.exec(app)![1];

describe('the battle text reads at 7:1 on any backdrop (Ruling C12)', () => {
  it('keeps the text zone at least 94 % opaque', () => expect(rgba('battle-text-bg')[3]).toBeGreaterThanOrEqual(0.94));
  it('reads over black and over white', () => {
    const bg = rgba('battle-text-bg');
    expect(contrastRatio(INK, over(bg, [0, 0, 0]))).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(INK, over(bg, [255, 255, 255]))).toBeGreaterThanOrEqual(7);
  });
});
```

`web/src/battleKit.test.ts`:

```ts
// UI4 (Rulings C13, C14): the battle stage is built from the kit, like the places (Ruling W4): the
// placesKit check over components/battle/ and the two battle screens.
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { legacyUses } from './testing/legacyClasses';

// Files still waiting for their task. It only shrinks: a file listed here must exist and still use
// a legacy class. Lane P's files, then the fence line, then lane V's (Ruling C13): each lane removes
// only its own lines, so the two merge without a conflict. Task 8 asserts it is empty.
const PENDING = new Set<string>([
  'src/screens/Play.svelte',
  // --- lane V (Tasks 6-7) below this line ---
  'src/screens/Boss.svelte',
]);

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name).replaceAll('\\', '/');
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.svelte')) out.push(p);
  }
  return out;
}

const files = [...walk('src/components/battle'), 'src/screens/Play.svelte', 'src/screens/Boss.svelte'];

describe('the battle uses the kit, never the legacy UI classes (Ruling C14)', () => {
  it('finds no legacy class outside the pending files', () => {
    const report: string[] = [];
    for (const f of files) {
      if (PENDING.has(f)) continue;
      for (const hit of legacyUses(readFileSync(f, 'utf-8'))) report.push(`${f}:${hit}`);
    }
    expect(report).toEqual([]);
  });

  it('keeps the pending list honest: each file exists and still needs its task', () => {
    for (const f of PENDING) {
      expect(existsSync(f), `${f} moved: update PENDING`).toBe(true);
      expect(legacyUses(readFileSync(f, 'utf-8')).length, `${f} is clean: remove it from PENDING`).toBeGreaterThan(0);
    }
  });
});
```

Add to `web/src/lib/world/art.test.ts`:

```ts
  it('names the four battle backdrops (UI4)', () => {
    expect(ART.scenes.battleRiver).toBe('/art/scenes/battle_river.webp');
    expect(ART.scenes.battleCoast).toBe('/art/scenes/battle_coast.webp');
    expect(ART.scenes.battleTemple).toBe('/art/scenes/battle_temple.webp');
    expect(ART.scenes.erisLair).toBe('/art/scenes/eris_lair.webp');
  });
```

Add to `web/src/lib/playState.test.ts` (use the file's own localStorage stub; read it first):

```ts
  it('keeps the opponent chosen for this session across a reload (UI4 Ruling C2)', () => {
    const s = newPlayState(1, 2, 1);
    s.opponent = 'lethe';
    savePlayState(s);
    expect(loadPlayState(1, 2)?.opponent).toBe('lethe');
    expect(newPlayState(1, 2, 1).opponent).toBeUndefined();
  });
```

`web/src/lib/dictation/script.test.ts`:

```ts
  it("names the paces in the camp's words (UI4 Ruling C8)", () => {
    expect(PACE_LABELS[3]).toEqual({ title: "D'un bon pas", description: 'Chaque groupe est lu deux fois, puis la voix enchaîne.' });
    expect(PACE_LABELS[4]).toEqual({ title: "D'une traite", description: 'Le texte entier est lu, puis dicté, puis relu une dernière fois. Pas de réécoute.' });
    expect([PACE_LABELS[1].title, PACE_LABELS[2].title]).toEqual(['Pas à pas', 'Par groupes']);
  });
```

`web/src/lib/argus.test.ts`: `expect(ARGUS_LABELS.mots_pieges.hint).toBe("Les mots qui t'ont déjà joué des tours. Regarde chaque lettre.");`

`web/src/styles/kit.test.ts`, new case: `for (const t of ['battle-text-bg', 'battle-parchment-edge']) expect(css, t).toMatch(new RegExp(\`--${t}:\\s*rgba\\(\`));`

Run: `scripts/npm.sh run test -- src/lib/battle src/battleKit.test.ts src/lib/world/art.test.ts src/lib/playState.test.ts src/lib/dictation/script.test.ts src/lib/argus.test.ts src/styles/kit.test.ts`
Expected: FAIL (missing modules, exports, tokens and labels).

- [ ] **Step 2: `lib/battle/battle.ts`**

```ts
// Who fights where (UI4 Ruling C2): the opponent on the right of the battle stage and the ground it
// fights on, from the art that exists (docs/art/scenes.md "Battle backdrops"). Pure.
import { ART } from '../world/art';
import { lieutenantName } from '../world/eris';
import type { FxPreset } from '../scene/types';
import type { PlayMode } from '../types';
import type { LieutenantKey, LieutenantState } from '../world/types';

export type OpponentId = LieutenantKey | 'eris';
export type BackdropId = 'river' | 'coast' | 'temple' | 'lair';
export type BattleMode = PlayMode | 'boss';
export type BattlePhase = 'muster' | 'dictation' | 'proofreading' | 'victory';

const LIEUTENANTS: LieutenantKey[] = ['hydre', 'echo', 'chimere', 'protee', 'sirenes', 'lethe'];

export function isOpponentId(x: unknown): x is OpponentId {
  return x === 'eris' || LIEUTENANTS.includes(x as LieutenantKey);
}

/** Each lieutenant's ground: the river (the Hydra of Lerna, Lethe the river of forgetting), the sea
 *  coast (Proteus, the Sirens), the ruined temple (Echo, the Chimera). */
export const HOME: Record<LieutenantKey, Exclude<BackdropId, 'lair'>> = {
  hydre: 'river',
  lethe: 'river',
  sirenes: 'coast',
  protee: 'coast',
  echo: 'temple',
  chimere: 'temple',
};

/** `feetY`: where the combatants stand, in % of the backdrop's height (docs/art/scenes.md). */
export const BACKDROPS: Record<BackdropId, { src: string; feetY: number; particles: FxPreset }> = {
  river: { src: ART.scenes.battleRiver, feetY: 80, particles: 'dust' },
  coast: { src: ART.scenes.battleCoast, feetY: 76, particles: 'dust' },
  temple: { src: ART.scenes.battleTemple, feetY: 78, particles: 'dust' },
  lair: { src: ART.scenes.erisLair, feetY: 72, particles: 'embers' },
};

/** Which way each cut-out looks in its file; the stage mirrors a combatant that does not look toward
 *  the other side (Ruling C10). */
export const FACES: Record<OpponentId | 'dragon', 'left' | 'right'> = {
  dragon: 'right',
  eris: 'left',
  hydre: 'left',
  echo: 'left',
  chimere: 'left',
  protee: 'left',
  sirenes: 'left',
  lethe: 'left',
};

export interface BattleDef {
  opponent: { id: OpponentId; name: string; art: string; alt: string };
  backdrop: { id: BackdropId; src: string; feetY: number };
  ambience: { particles: FxPreset; music: string | null };
  /** Dialogue event keys for UI5 (spec §8); nothing reads them in UI4. */
  narrator: { start: string; victory: string; retreat: string; retry: string };
}

export interface OpponentInput {
  mode: BattleMode;
  encounter: string | null;
  textId: number | null;
  lieutenants: Pick<LieutenantState, 'key' | 'available' | 'neutralised' | 'stirring'>[];
}

export function opponentFor(i: OpponentInput): OpponentId {
  if (i.mode === 'boss' || i.encounter === 'eris') return 'eris';
  if (i.encounter && isOpponentId(i.encounter)) return i.encounter;
  if (i.mode === 'grimoire') return 'eris';
  const open = i.lieutenants.filter((l) => l.available && !l.neutralised && isOpponentId(l.key));
  const stirring = open.filter((l) => l.stirring);
  const pool = stirring.length > 0 ? stirring : open;
  if (pool.length === 0) return 'eris';
  return pool[Math.abs(i.textId ?? 0) % pool.length].key as LieutenantKey;
}

export function battleFor(opponent: OpponentId, ctx: { mode: BattleMode; encounter: string | null }): BattleDef {
  const backdropId: BackdropId =
    opponent === 'eris' ? (ctx.mode === 'boss' || ctx.encounter === 'eris' ? 'lair' : 'temple') : HOME[opponent];
  const backdrop = BACKDROPS[backdropId];
  const name = opponent === 'eris' ? 'Éris' : lieutenantName(opponent);
  return {
    opponent: { id: opponent, name, art: opponent === 'eris' ? ART.eris : ART.lieutenants[opponent], alt: name },
    backdrop: { id: backdropId, src: backdrop.src, feetY: backdrop.feetY },
    ambience: { particles: backdrop.particles, music: null },
    narrator: { start: 'battle.start', victory: 'battle.victory', retreat: 'battle.retreat', retry: 'battle.retry' },
  };
}
```

`FACES`: open each cut-out with the Read tool (`web/public/art/lieutenants/*_cut.webp`, `characters/eris_cut.webp`, `dragon/dragon_*_cut.webp`) and set the direction each one actually looks. If the four dragon stages disagree, make the dragon's entry a `Record<DragonStage, 'left' | 'right'>` (and its test). The walk (Task 8) checks that the two sides face each other.

- [ ] **Step 3: `hp.ts`, `layout.ts`, `reactions.ts`, `events.ts`**

```ts
// hp.ts — the opponent's hold on the text (UI4 Ruling C3). Pure.
export interface HpView {
  /** 1 = full hold, 0 = routed. */
  value: number;
  /** Notches on the bar: the stage-3 frozen count, else null. */
  segments: number | null;
}
export const FULL_HP: HpView = { value: 1, segments: null };
export type Outcome = 'rout' | 'push' | 'standoff';

export function hpDuringPlay(helpStage: 1 | 2 | 3 | 4, initialErrors: number | undefined): HpView {
  return helpStage === 3 && (initialErrors ?? 0) > 0 ? { value: 1, segments: initialErrors! } : FULL_HP;
}

const MAX_STRIKES = 8;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** The hold after each strike of the reckoning: one per trap caught, grouped into at most eight. A
 *  perfect dictation (nothing planted) routs the opponent in one strike. */
export function reckoningSteps(draft: number, caught: number): number[] {
  if (draft === 0) return [0];
  if (caught <= 0) return [];
  const strikes = Math.min(caught, MAX_STRIKES);
  const lost = Math.min(1, caught / draft);
  return Array.from({ length: strikes }, (_, i) => Math.max(0, round3(1 - (lost * (i + 1)) / strikes)));
}

export function outcomeOf(r: { draft: number; caught: number }, boss: { won: boolean; too_easy: boolean } | null): Outcome {
  if (boss) {
    if (boss.won) return 'rout';
    if (boss.too_easy) return 'standoff';
    return r.caught > 0 ? 'push' : 'standoff';
  }
  if (r.draft === 0 || r.caught >= r.draft) return 'rout';
  return r.caught > 0 ? 'push' : 'standoff';
}

export const hpPercent = (hp: HpView) => Math.round(hp.value * 100);
```

```ts
// layout.ts — the compact battle while the keyboard is open (UI4 Ruling C4). Pure.
export const COMPACT_MAX_PX = 560;
export type BattleLayout = 'full' | 'compact';

export function battleLayout(vvHeight: number, innerHeight: number): BattleLayout {
  return vvHeight < Math.min(COMPACT_MAX_PX, innerHeight) ? 'compact' : 'full';
}

export function bandHeight(vvHeight: number): number {
  return Math.min(104, Math.max(64, Math.round(vvHeight * 0.2)));
}
```

```ts
// reactions.ts — how a combatant reacts (UI4 Ruling C10): Web Animations keyframes, in screen space,
// on the combatant's outer `.actor` (its inner `.facing` mirrors the art). `away` is +1 for the
// opponent on the right (pushed right), -1 for the dragon on the left. Reduced motion: opacity and
// brightness only (spec §4 "fades only").
export const REACTIONS = ['idle', 'taunt', 'flinch', 'hit', 'defeat', 'retreat', 'cheer', 'brace'] as const;
export type Reaction = (typeof REACTIONS)[number];
export interface ReactionAnim {
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
}

export function reactionAnimation(r: Reaction, o: { away: 1 | -1; reduced: boolean }): ReactionAnim | null {
  const x = (px: number) => `translateX(${px * o.away}px)`;
  if (o.reduced) {
    if (r === 'hit') return { keyframes: [{ filter: 'brightness(1)' }, { filter: 'brightness(1.6)' }, { filter: 'brightness(1)' }], options: { duration: 300 } };
    if (r === 'defeat') return { keyframes: [{ opacity: 1, filter: 'grayscale(0)' }, { opacity: 0.55, filter: 'grayscale(0.6)' }], options: { duration: 400, fill: 'forwards' } };
    if (r === 'retreat') return { keyframes: [{ opacity: 1 }, { opacity: 0.75 }], options: { duration: 400, fill: 'forwards' } };
    return null;
  }
  switch (r) {
    case 'idle':
      return null;
    case 'taunt':
      return {
        keyframes: [
          { transform: 'rotate(0deg) translateY(0)' },
          { transform: `rotate(${-4 * o.away}deg) translateY(-6px)` },
          { transform: `rotate(${3 * o.away}deg) translateY(0)` },
          { transform: 'rotate(0deg) translateY(0)' },
        ],
        options: { duration: 900, easing: 'ease-in-out' },
      };
    case 'flinch':
      return { keyframes: [{ transform: x(0) }, { transform: x(8) }, { transform: x(-3) }, { transform: x(0) }], options: { duration: 320 } };
    case 'hit':
      return {
        keyframes: [
          { transform: x(0), filter: 'brightness(1)' },
          { transform: `${x(14)} rotate(${3 * o.away}deg)`, filter: 'brightness(1.8) saturate(0.6)' },
          { transform: x(-6), filter: 'brightness(1.1)' },
          { transform: x(0), filter: 'brightness(1)' },
        ],
        options: { duration: 360, easing: 'cubic-bezier(.3,.7,.4,1)' },
      };
    case 'defeat':
      return {
        keyframes: [
          { transform: 'translateY(0) rotate(0deg) scale(1)', opacity: 1, filter: 'grayscale(0) brightness(1)' },
          { transform: `translateY(4%) rotate(${8 * o.away}deg) scale(0.96)`, opacity: 0.55, filter: 'grayscale(0.6) brightness(0.8)' },
        ],
        options: { duration: 900, easing: 'ease-in', fill: 'forwards' },
      };
    case 'retreat':
      return {
        keyframes: [
          { transform: 'translateX(0) scale(1)', opacity: 1 },
          { transform: `translateX(${12 * o.away}%) scale(0.92)`, opacity: 0.75 },
        ],
        options: { duration: 800, easing: 'ease-in-out', fill: 'forwards' },
      };
    case 'cheer':
      return {
        keyframes: [{ transform: 'translateY(0)' }, { transform: 'translateY(-10%)' }, { transform: 'translateY(0)' }, { transform: 'translateY(-5%)' }, { transform: 'translateY(0)' }],
        options: { duration: 900, easing: 'ease-out' },
      };
    case 'brace':
      return { keyframes: [{ transform: 'scale(1)' }, { transform: `${x(-6)} scale(1.03)` }, { transform: 'scale(1)' }], options: { duration: 600 } };
  }
}
```

```ts
// events.ts — the battle's hooks for UI5 (Ruling C9): audio cues and dialogue lines will listen here.
// UI4 emits and nobody listens yet. A listener never breaks the battle.
import type { BattleMode, BattlePhase, OpponentId } from './battle';
import type { Outcome } from './hp';

export type BattleEvent =
  | { kind: 'start'; opponent: OpponentId; mode: BattleMode }
  | { kind: 'phase'; phase: BattlePhase }
  | { kind: 'tool'; tool: 'argus' | 'bouclier' | 'chouette' | 'fil' | 'whole' }
  | { kind: 'strike'; value: number }
  | { kind: 'outcome'; outcome: Outcome; caught: number; missed: number }
  | { kind: 'retry' }
  | { kind: 'leave' };

const listeners = new Set<(e: BattleEvent) => void>();

export function onBattleEvent(fn: (e: BattleEvent) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitBattle(e: BattleEvent): void {
  for (const fn of listeners) {
    try {
      fn(e);
    } catch {
      // A UI5 listener's bug must never stop a dictation.
    }
  }
}

/** The dialogue event keys of spec §8 for the battle (content/dialogue/*.json, UI5). */
export const BATTLE_NARRATOR = {
  start: 'battle.start',
  caught: 'battle.caught',
  missed: 'battle.missed',
  victory: 'battle.victory',
  retreat: 'battle.retreat',
  retry: 'battle.retry',
} as const;
```

- [ ] **Step 4: `lib/battle/lines.ts` — every French line of UI4**

```ts
// Every French line of the battle stage (UI4), in one module: the register, plural, guilt, emoji and
// Éris guards read it, and the two B3 lanes consume it without editing the same copy (Ruling C13).
// Static lines (UI3 Ruling A9's precedent); the dialogue content files are UI5 (spec §8). Each
// section is fenced by the task that renders it; a lane edits only its own fence.
import { dossierLine, genderFor, lieutenantName, type Band } from '../world/eris';
import { plural, rateText } from '../text/french';
import type { PlayMode } from '../types';
import type { OpponentId } from './battle';
import type { Outcome } from './hp';

export function opponentName(id: OpponentId): string {
  return id === 'eris' ? 'Éris' : lieutenantName(id);
}

// ===== Stage (Task 2) =====
export const EMPRISE: Record<OpponentId, string> = {
  hydre: "L'emprise de l'Hydre",
  echo: "L'emprise d'Écho",
  chimere: "L'emprise de la Chimère",
  protee: "L'emprise de Protée",
  sirenes: "L'emprise des Sirènes",
  lethe: "L'emprise de Léthé",
  eris: "L'emprise d'Éris",
};
export const STAGE = {
  loading: 'Les Muses préparent le parchemin…',
  loadError: (e: string) => `Impossible de charger ce parchemin : ${e}`,
  counting: 'Les Muses comptent les pièges déjoués…',
  dragonAlt: 'Ton dragon',
} as const;

// ===== Muster (Task 3) =====
export const MUSTER = {
  resume: "Ton brouillon t'attend là où tu l'avais laissé.",
  continue: 'Continuer',
  restart: 'Recommencer',
  words: (n: number) => plural(n, 'mot', 'mots'),
  prophecy: (when: string) => `La Pythie a vu cette dictée pour ${when}.`,
  quest: 'Ce texte compte pour ta quête.',
  boss: "Combat contre Éris : les Yeux d'Argus restent éteints.",
  showSheet: 'Voir la feuille',
  hideSheet: 'Cacher la feuille',
  sheetAlt: (n: number) => `Page ${n} de la feuille`,
  noVoice: 'Cet appareil ne sait pas lire à voix haute. La dictée avancera toute seule, sans voix.',
  paceHeading: 'Choisis ton rythme',
  paceLocked: 'Pas pendant un combat',
  paceGlory: 'Plus le rythme est vif, plus la gloire est grande.',
  start: 'Commencer la dictée',
  grimoire: 'Grimoire corrompu',
  grimoireCaption: 'Éris a déjà recopié ce texte… avec ses dés-accords. Pas de dictée : relis et répare.',
  grimoireRule: "Pas de dictée cette fois : relis le grimoire et répare ce qu'elle a abîmé.",
  openGrimoire: 'Ouvrir le grimoire',
  corrupting: 'Éris corrompt le grimoire…',
  backToShelves: 'Retour aux parchemins',
} as const;
export const ERIS_MUSTER = {
  free: "Un parchemin de plus pour mes dés-accords. Les héros du camp n'y verront que du feu.",
  grimoire: "J'ai recopié ce parchemin à ma façon, en y semant mes dés-accords. Aucun héros du camp ne les retrouvera tous.",
} as const;
/** Éris's line at the muster (Ruling C7): her dossier line for the lieutenant on stage (its band from
 *  the camp), else her own. The boss uses CHALLENGE_LINES. */
export function musterTaunt(o: { opponent: OpponentId; band: Band | null; mode: PlayMode }): string {
  if (o.opponent !== 'eris') return dossierLine(o.opponent, o.band ?? 'none');
  return o.mode === 'grimoire' ? ERIS_MUSTER.grimoire : ERIS_MUSTER.free;
}

// ===== Dictation (Task 4) =====
export const DICTATION = {
  title: 'Dictée',
  quit: 'Quitter',
  quitAsk: 'Ton brouillon est gardé. Veux-tu vraiment quitter la dictée ?',
  quitYes: 'Oui, quitter',
  quitNo: 'Continuer la dictée',
  status: {
    idle: 'Écoute…',
    playing: 'Écoute…',
    waiting: "À toi d'écrire.",
    paused: 'En pause.',
    finished: "C'est fini ! Relis ton texte quand tu veux.",
  },
  replay: 'Réécouter',
  next: 'Suivant',
  pause: 'Pause',
  resume: 'Reprendre',
  finish: "J'ai fini d'écrire",
  placeholder: 'Écris ici ce que tu entends…',
  sentence: (done: number, total: number) => `Phrase ${done} sur ${total}`,
  chunk: (done: number, total: number) => `Groupe ${done} sur ${total}`,
  full: 'Lecture complète',
} as const;

// ===== Proofreading (Task 5) =====
export const PROOF = {
  title: 'Relecture',
  grimoireTitle: 'Grimoire corrompu',
  grimoirePrefix: 'Éris a corrompu ce grimoire.',
  stage1: "Les Yeux d'Argus éclairent une catégorie à la fois.",
  stage2: "Relis une catégorie à la fois, comme Argus te l'a appris.",
  stage4: 'À toi de jouer. Valide quand tout te semble juste.',
  count: (n: number) =>
    n === 0
      ? "Éris n'a rien trouvé à saboter cette fois. Relis une dernière fois, puis valide."
      : n === 1
        ? '1 piège est caché dans ce texte.'
        : `${n} pièges sont cachés dans ce texte.`,
  passes: "Passes d'Argus",
  nextPass: 'Passe suivante',
  bouclier: 'Bouclier de Persée',
  chouette: (left: number) => `Chouette d'Athéna (${left})`,
  fil: "Fil d'Ariane",
  whole: 'Modifier tout le texte',
  wholeLabel: 'Tout le texte',
  filNext: (verb: string) => `Touche un autre verbe pour tendre un nouveau fil${verb ? `, ou touche « ${verb} » pour le corriger` : ''}.`,
  filExit: 'Quitter le fil',
  prevSentence: 'Phrase précédente',
  nextSentence: 'Phrase suivante',
  sentencePos: (k: number, n: number) => `Phrase ${k} sur ${n}, en partant de la fin`,
  owlNone: 'La chouette ne voit plus aucun piège.',
  owlMissing: "Il manque un mot près d'ici.",
  owlHere: 'La chouette a repéré un piège ici.',
  confirmAsk: 'Il reste des passes à faire. Valider quand même ?',
  confirmYes: 'Oui, valider',
  confirmNo: 'Continuer la relecture',
  done: "J'ai terminé ma relecture",
  quit: 'Quitter',
  quitAsk: 'Ta relecture est gardée. Veux-tu vraiment quitter ?',
  quitYes: 'Oui, quitter',
  editorLabel: 'Nouveau mot',
  editorHint: 'Vide = supprimer le mot',
  editorOk: 'OK',
  tokenEdit: (w: string) => `Modifier « ${w} »`,
  tokenFil: (w: string) => `Fil d'Ariane : choisir « ${w} »`,
} as const;

// ===== Victory (Task 6) =====
export function victoryTitle(outcome: Outcome, opponent: OpponentId): string {
  if (outcome === 'rout') return 'Victoire !';
  if (outcome === 'push') {
    const many = opponent !== 'eris' && genderFor(opponent) === 'fp';
    return `${opponentName(opponent)} ${many ? 'reculent' : 'recule'} !`;
  }
  return 'Le combat continue';
}
export const VICTORY = {
  counting: 'Les Muses comptent les pièges déjoués…',
  submitError: (e: string) => `Les Muses n'ont pas pu noter cette partie (${e}).`,
  retry: 'Réessayer',
  sending: 'Envoi en cours…',
  perfect: 'Texte parfait dès la dictée !',
  caught: (c: number, d: number, rate: number | null, mode: PlayMode) =>
    mode === 'grimoire' ? `Dés-accords retrouvés : ${c} sur ${d} (${rateText(rate)})` : `Pièges déjoués : ${c} sur ${d} (${rateText(rate)})`,
  score: (s: number) => `Score : ${s}`,
  words: (ok: number, all: number) => `Mots justes : ${ok} / ${all}`,
  threads: (ok: number, all: number) => `Fils d'Ariane tendus : ${ok} sur ${all}`,
  introduced: (n: number) =>
    `Éris a profité de la relecture pour glisser ${plural(n, 'nouveau piège', 'nouveaux pièges')}. Ça arrive : « Revoir » te les montre.`,
  continue: 'Continuer',
  review: 'Revoir',
  replay: 'Rejouer ce texte',
  camp: 'Retour au camp',
  reviewTitle: 'Revoir le parchemin',
  reviewText: 'Ton texte',
  reviewTried: "Ce qu'Éris a tenté",
  foiled: 'déjoué',
  missingWord: 'Mot oublié',
  expected: (w: string) => `Attendu : « ${w} »`,
  forgotten: (w: string) => `Mot oublié : « ${w} »`,
  neutralised: 'Sa ruse ne te piège plus : trois jours de garde et 8 pièges sur 10 déjoués.',
  bossWon: 'Impossible ! Garde ta pomme, je reviendrai avec de nouvelles ruses.',
  bossLost: "Éris s'enfuit avec la pomme… pour cette fois. Le combat reste ouvert : tu la retrouveras.",
  bossTooEasy:
    "Dictée parfaite : Éris n'a rien pu saboter ! Furieuse, elle va corrompre le parchemin elle-même. Relance le combat pour démasquer ses pièges.",
} as const;
export function dragonTally(o: { draft: number; caught: number; mode: PlayMode }): string {
  if (o.draft === 0) return "Pas un piège dans ta dictée : Éris n'a rien pu glisser !";
  const [one, many] = o.mode === 'grimoire' ? ['dés-accord', 'dés-accords'] : ['piège', 'pièges'];
  const verb = o.mode === 'grimoire' ? 'retrouvé' : 'déjoué';
  if (o.caught === 0) return `Ses ${many} se sont bien cachés cette fois. Viens, on les regarde ensemble dans « Revoir ».`;
  const head = `Tu as ${verb} ${plural(o.caught, one, many)} sur ${o.draft}.`;
  const rate = o.caught / o.draft;
  if (rate >= 0.8) return `${head} Ses lieutenants s'en souviendront !`;
  if (rate >= 0.5) return `${head} Les autres se cachent encore : on les débusquera ensemble.`;
  return `${head} Chaque ${one} ${verb} en fait un de moins pour la prochaine fois.`;
}
export const DRAGON_REVIEW_HINT = 'Touche « Revoir » pour voir chaque piège, mot à mot.';

// ===== Boss (Task 7) =====
export const CHALLENGE_LINES: Record<number, string> = {
  1: 'Deux de mes ruses réduites au silence ? Voyons si mes pièges tiennent quand ils jouent tous ensemble.',
  2: 'Encore toi. Cette fois mes pièges sont mieux cachés, et le texte est long. Très long.',
  3: "Le Grand Désaccord. Toutes mes ruses, un seul texte, et la pomme d'or en jeu. Après ça, je ne reviendrai pas. (Si.)",
};
export const BOSS = {
  tier: (roman: string) => `Combat ${roman}`,
  reward: (xp: number, name: string) => `Récompense si tu gagnes : ${xp} XP · ${name}`,
  rules: "Un long texte · les Yeux d'Argus restent éteints · chaque piège trouvé reste acquis, même si Éris s'enfuit : tu pourras recommencer.",
  start: 'Affronter Éris',
  restart: 'Relancer le combat',
} as const;
```

(`bossWon`, `bossLost`, `bossTooEasy` and the challenge lines are today's strings, moved; the challenge lines lose their « » because a voice plate names its speaker. Check `world.spec.ts`'s too-easy assertion still matches `VICTORY.bossTooEasy` character for character.)

- [ ] **Step 5: The stage store and the viewport watcher**

```ts
// stage.svelte.ts — what the battle stage shows, driven by whichever phase is on (Ruling C13): the
// hold, the hits, each side's last reaction. BattleStage reads it; the phases write it.
import { emitBattle } from './events';
import { FULL_HP, type HpView } from './hp';
import type { Reaction } from './reactions';

export type Side = 'opponent' | 'dragon';
interface Actor {
  reaction: Reaction;
  /** Bumped on every reaction, so the same reaction twice replays. */
  nonce: number;
}

export const battleStage = $state({
  hp: FULL_HP as HpView,
  hits: 0,
  opponent: { reaction: 'idle', nonce: 0 } as Actor,
  dragon: { reaction: 'idle', nonce: 0 } as Actor,
});

export function react(side: Side, reaction: Reaction): void {
  battleStage[side] = { reaction, nonce: battleStage[side].nonce + 1 };
}

export function setHp(hp: HpView): void {
  battleStage.hp = hp;
}

export function strike(value: number): void {
  battleStage.hp = { ...battleStage.hp, value };
  battleStage.hits += 1;
  react('opponent', 'hit');
  emitBattle({ kind: 'strike', value });
}

export function resetBattleStage(): void {
  battleStage.hp = FULL_HP;
  battleStage.hits = 0;
  battleStage.opponent = { reaction: 'idle', nonce: 0 };
  battleStage.dragon = { reaction: 'idle', nonce: 0 };
}
```

```ts
// viewport.svelte.ts — the visual viewport (what the iPad keyboard leaves), watched once, refcounted
// (Ruling C4). It owns --vvh and --vv-top; Dictation and Proofreading used to each set and remove
// --vvh. `window.visualViewport` is read at every event, never cached, so the e2e keyboard
// (helpers.ts installKeyboardSim) stands in for it.
export const viewport = $state({ height: 0, top: 0, inner: 0 });

let users = 0;
let stop: (() => void) | null = null;

function start(): () => void {
  const root = document.documentElement;
  const update = () => {
    const vv = window.visualViewport;
    viewport.height = vv?.height ?? window.innerHeight;
    viewport.top = vv?.offsetTop ?? 0;
    viewport.inner = window.innerHeight;
    root.style.setProperty('--vvh', `${viewport.height}px`);
    root.style.setProperty('--vv-top', `${viewport.top}px`);
  };
  update();
  const vv = window.visualViewport;
  vv?.addEventListener('resize', update);
  vv?.addEventListener('scroll', update);
  window.addEventListener('resize', update);
  return () => {
    vv?.removeEventListener('resize', update);
    vv?.removeEventListener('scroll', update);
    window.removeEventListener('resize', update);
    root.style.removeProperty('--vvh');
    root.style.removeProperty('--vv-top');
  };
}

/** Starts watching (once, however many callers); returns this caller's release (idempotent). */
export function watchViewport(): () => void {
  users += 1;
  if (users === 1) stop = start();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    users -= 1;
    if (users === 0) {
      stop?.();
      stop = null;
    }
  };
}
```

- [ ] **Step 6: Art, play state, shared copy, kit tokens**

`web/src/lib/world/art.ts`, in `ART.scenes` after `battle`:

```ts
    // UI4 battle backdrops (docs/art/scenes.md "Battle backdrops"), one per ground (lib/battle/battle.ts HOME).
    battleRiver: '/art/scenes/battle_river.webp',
    battleCoast: '/art/scenes/battle_coast.webp',
    battleTemple: '/art/scenes/battle_temple.webp',
    erisLair: '/art/scenes/eris_lair.webp',
```

`web/src/lib/playState.ts`: `import type { OpponentId } from './battle/battle';` and in `PlayState`, after `progression`:

```ts
  /** UI4 Ruling C2: the opponent chosen for this session (presentation only), kept so a reload or a
   *  resume faces the same one. No version bump: an optional field, absent until chosen. */
  opponent?: OpponentId;
```

`web/src/lib/dictation/script.ts`, `PACE_LABELS` 3 and 4:

```ts
  3: { title: "D'un bon pas", description: 'Chaque groupe est lu deux fois, puis la voix enchaîne.' },
  4: { title: "D'une traite", description: 'Le texte entier est lu, puis dicté, puis relu une dernière fois. Pas de réécoute.' },
```

`web/src/lib/argus.ts`, `mots_pieges.hint`: `"Les mots qui t'ont déjà joué des tours. Regarde chaque lettre."`.

Grep the old wordings (`Comme en classe`, `Comme à l'examen`, `déjà piégée`) in `web/src`, `web/e2e` and `server/app` and update whatever reads them.

`web/src/styles/kit.css`, in `:root` next to the parchment tokens:

```css
  /* UI4 Ruling C12: the battle parchment. Its text zone stays nearly opaque (7:1 over black,
     lib/battle/legibility.test.ts); only its torn edges let the battlefield through. */
  --battle-text-bg: rgba(250, 243, 226, 0.96);
  --battle-parchment-edge: rgba(246, 236, 212, 0.72);
```

- [ ] **Step 7: Guards**

Create `web/src/testing/legacyClasses.ts` by moving `LEGACY` (exported as `LEGACY_CLASSES`) and `legacyUses` out of `placesKit.test.ts`, unchanged; `placesKit.test.ts` imports `legacyUses` from `./testing/legacyClasses` (a test module never imports another test module: vitest would register its tests twice).

`web/src/registerGuard.test.ts`: add `...walk('src/lib/battle'),` to `FILES` (the walker already skips `*.test.ts`). `BATTLE` stays until Task 2.

- [ ] **Step 8: e2e helpers**

Append to `web/e2e/helpers.ts` (below `measureBoxes` and `expectScene`, which they use):

```ts
// UI4 (spec §10: the battle's compact layout "with a simulated keyboard"): the iPad's on-screen
// keyboard shrinks the *visual* viewport, not the layout one, and Playwright cannot open it. Like
// stubSpeech's speechSynthesis, `window.visualViewport` (a [Replaceable], configurable attribute of
// the window) is replaced before the app runs by a stand-in whose height is innerHeight minus the
// keyboard. lib/battle/viewport.svelte.ts reads window.visualViewport at every event.
export async function installKeyboardSim(page: Page) {
  await page.addInitScript(() => {
    const target = new EventTarget();
    let keyboard = 0;
    const fake = {
      get height() {
        return Math.max(0, window.innerHeight - keyboard);
      },
      get width() {
        return window.innerWidth;
      },
      offsetTop: 0,
      offsetLeft: 0,
      get pageTop() {
        return window.scrollY;
      },
      get pageLeft() {
        return window.scrollX;
      },
      scale: 1,
      onresize: null,
      onscroll: null,
      addEventListener: target.addEventListener.bind(target),
      removeEventListener: target.removeEventListener.bind(target),
      dispatchEvent: target.dispatchEvent.bind(target),
    };
    Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => fake });
    window.addEventListener('resize', () => target.dispatchEvent(new Event('resize')));
    (window as unknown as { __setKeyboard: (px: number) => void }).__setKeyboard = (px: number) => {
      keyboard = px;
      target.dispatchEvent(new Event('resize'));
    };
  });
}

/** Opens (px > 0) or closes (0) the simulated keyboard, and checks the page sees it. */
export async function setKeyboard(page: Page, px: number) {
  const { vv, inner } = await page.evaluate((k) => {
    (window as unknown as { __setKeyboard: (px: number) => void }).__setKeyboard(k);
    return { vv: window.visualViewport!.height, inner: window.innerHeight };
  }, px);
  expect(vv, 'the simulated keyboard shrinks the visual viewport').toBe(Math.max(0, inner - px));
}

export interface PlaySeed {
  profileId: number;
  textId: number;
  mode?: 'dictation' | 'grimoire';
  phase: 'intro' | 'dictation' | 'proofreading' | 'results';
  draft?: string;
  current?: string;
  pace?: 1 | 2 | 3 | 4;
  opponent?: string;
}

// Seeds a play state (lib/playState.ts, version 1) before the app starts, once per tab: a reload
// then keeps what the app itself saved since. Each test has its own browser context, so its
// localStorage is its own under 8 workers.
export async function seedPlay(page: Page, s: PlaySeed) {
  await page.addInitScript((seed) => {
    const key = `discorde.play.${seed.profileId}.${seed.textId}${seed.mode === 'grimoire' ? '.grimoire' : ''}`;
    if (sessionStorage.getItem(`seeded:${key}`)) return;
    sessionStorage.setItem(`seeded:${key}`, '1');
    localStorage.setItem(
      key,
      JSON.stringify({
        version: 1,
        profileId: seed.profileId,
        textId: seed.textId,
        phase: seed.phase,
        pace: seed.pace ?? 1,
        mode: seed.mode ?? 'dictation',
        startedAt: new Date().toISOString(),
        draft: seed.draft ?? '',
        current: seed.current ?? seed.draft ?? '',
        hintsUsed: 0,
        revealedKeys: [],
        passIndex: 0,
        bouclier: false,
        submitted: false,
        sessionId: null,
        ...(seed.opponent ? { opponent: seed.opponent } : {}),
      }),
    );
  }, s);
}

/** A seeded dictation or proofreading comes back behind the resume ribbon: continue it. */
export async function resumeSeeded(page: Page) {
  await page.getByTestId('battle-resume-continue').click();
  await expect(page.getByTestId('battle-resume')).toHaveCount(0);
}

/** The battle stage is on screen, settled, and (optionally) in this phase. */
export async function expectBattle(page: Page, phase?: 'muster' | 'dictation' | 'proofreading' | 'victory') {
  await expectScene(page, 'battle');
  if (phase) await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-phase', phase);
}

/** The stage's parts in viewport px (null when absent). */
export async function battleRects(page: Page) {
  return measureBoxes(page, {
    scene: '[data-testid="battle-scene"]',
    dragon: '[data-testid="battle-dragon"]',
    opponent: '[data-testid="battle-opponent"]',
    hp: '[data-testid="battle-hp"]',
    parchment: '[data-testid="battle-parchment"]',
  });
}
```

- [ ] **Step 9: Run the tests and svelte-check**

Run: `scripts/npm.sh run test -- src/lib/battle src/battleKit.test.ts src/placesKit.test.ts src/registerGuard.test.ts src/lib/world/art.test.ts src/lib/playState.test.ts src/lib/dictation/script.test.ts src/lib/argus.test.ts src/styles/kit.test.ts src/formPlural.test.ts src/noGuilt.test.ts src/noEmoji.test.ts`
Expected: PASS (paste the counts).
Run: `scripts/npm.sh run check`
Expected: `0 errors and 0 warnings`.
No Playwright run in this task: no screen changed (Task 2's spec exercises the helpers).

- [ ] **Step 10: Commit**

```bash
git add web/src/lib/battle web/src/testing/legacyClasses.ts web/src/battleKit.test.ts web/src/placesKit.test.ts web/src/registerGuard.test.ts web/src/lib/world/art.ts web/src/lib/world/art.test.ts web/src/lib/playState.ts web/src/lib/playState.test.ts web/src/lib/dictation/script.ts web/src/lib/dictation/script.test.ts web/src/lib/argus.ts web/src/lib/argus.test.ts web/src/styles/kit.css web/src/styles/kit.test.ts web/e2e/helpers.ts
git commit -m "UI4 Task 1: battle foundation - who fights where, the hold, the compact rule, reactions, UI5 hooks, every battle line, stage store, viewport watcher, guards, keyboard sim

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/lib/battle web/src/testing/legacyClasses.ts web/src/battleKit.test.ts web/src/placesKit.test.ts web/src/registerGuard.test.ts web/src/lib/world/art.ts web/src/lib/world/art.test.ts web/src/lib/playState.ts web/src/lib/playState.test.ts web/src/lib/dictation/script.ts web/src/lib/dictation/script.test.ts web/src/lib/argus.ts web/src/lib/argus.test.ts web/src/styles/kit.css web/src/styles/kit.test.ts web/e2e/helpers.ts
```

(Add to both path lists any file Step 6's grep made you change.)

---

### Task 2: The battle stage — `BattleStage`, `Combatant`, `HpBar`; Play split into phases; Boss on the stage; the top bar retires

This task moves, it does not restyle: each phase's current markup moves into its own component under `components/battle/` and keeps working inside the parchment (legacy classes and all, listed in `PENDING`). Lanes P and V restyle them in B3.

**Files:**
- Create: `web/src/components/battle/BattleStage.svelte`, `Combatant.svelte`, `HpBar.svelte`, `MusterPhase.svelte`, `VictoryPhase.svelte`, `BossMuster.svelte`
- Move: `git mv web/src/components/Dictation.svelte web/src/components/battle/DictationPhase.svelte`; `git mv web/src/components/Proofreading.svelte web/src/components/battle/ProofPhase.svelte`; `git mv web/src/components/TokenText.svelte web/src/components/battle/TokenText.svelte`; `git mv web/src/components/WordEditor.svelte web/src/components/battle/WordEditor.svelte`
- Delete: `git rm web/src/components/TopBar.svelte`
- Modify: `web/src/screens/Play.svelte`, `web/src/screens/Boss.svelte`, `web/src/App.svelte` (comment), `web/src/components/scene/Hud.svelte` (only if its `onHero` contract needs a note), `web/src/battleKit.test.ts`, `web/src/registerGuard.test.ts`
- Create: `web/e2e/scenes-battle.spec.ts`
- Modify: `web/e2e/scenes-parity.spec.ts`, `web/e2e/scenes-camp.spec.ts`, `web/e2e/alexandria.spec.ts`

**Interfaces:**
- Consumes: Task 1's `battleFor`, `opponentFor`, `BattleDef`, `BattlePhase`, `battleLayout`, `bandHeight`, `reactionAnimation`, `battleStage`, `resetBattleStage`, `setHp`, `watchViewport`, `viewport`, `emitBattle`, `EMPRISE`, `STAGE`, `bandFor`; the scene engine's `SceneTransition`, `FxCanvas`, `Hud`, `SceneExit`, `RotateScreen`, `overlayState`, `reducedMotion`/`watchReducedMotion`, `Particles`, `go`, `heroPanelHref`, `campFor`, `refreshCamp`, `loadCatalog`, `initSound`.
- Produces:
  - `BattleStage.svelte` props: `battle: BattleDef | null`, `phase: BattlePhase`, `profile: Profile`, `camp: CampResponse | null`, `dragon: DragonOut | null`, `mode?: BattleMode`, `hud?: boolean`, `exit?: boolean`, `children: Snippet<[BattleLayout]>`. Test ids: `scene-battle` (attributes `data-phase`, `data-layout`, `data-opponent`, `data-backdrop`, `data-reduced-motion`), `battle-scene`, `battle-dragon`, `battle-opponent` (`data-reaction`, `data-hits`), `battle-hp`, `battle-plaque`, `battle-parchment`, `stage-hud`, `scene-exit`, `rotate-screen`.
  - `Combatant.svelte` props: `src`, `alt`, `side: 'left' | 'right'`, `mirror: boolean`, `filter?: string`, `reaction: Reaction`, `nonce: number`, `testId`, `idle: boolean`, `reduced: boolean`.
  - `HpBar.svelte` props: `name: string`, `label: string`, `hp: HpView`.
  - Phase components with their full contracts (below), so lanes never edit `Play.svelte`:
    - `MusterPhase` props: `text: TextFull`, `mode: PlayMode`, `playState: PlayState` (bindable, for `pace`), `minPace: Pace`, `questId: number | null`, `encounter: string | null`, `resume: boolean`, `corrupting: boolean`, `corruptError: string | null`, `taunt: DialogueLine | null`, `profileId: number`, `onContinue`, `onRestart`, `onStart`, `onOpenGrimoire`, `onToLibrary`.
    - `DictationPhase` props: `Dictation`'s (`plan`, `pace`, `voice`, `text` bindable, `onFinish`, `onQuit`) plus `layout: BattleLayout` (read by Task 4).
    - `ProofPhase` props: `Proofreading`'s plus `layout: BattleLayout` and `onQuit: () => void` (both wired now, used by Task 5).
    - `VictoryPhase` props: `text: TextFull`, `result: SessionResult | null`, `playState: PlayState`, `profile: Profile`, `camp: CampResponse | null`, `mode: PlayMode`, `opponent: OpponentId`, `encounter: string | null`, `helpMessage`, `submitError`, `submitting`, `revealDone` (bindable), `reviewOpen: boolean`, `onReplay`, `onCamp`, `onRetry`, `onReview`, `onCloseReview`, `names: Record<string, string>`.
    - `BossMuster` props: `tier: number`, `rewardId: string | null`, `rewardXp: number`, `rewardName: string`, `retry: boolean`, `starting: boolean`, `startError: string`, `taunt: DialogueLine`, `onStart`.

- [ ] **Step 1: Write the failing e2e spec**

`web/e2e/scenes-battle.spec.ts`:

```ts
import { test, expect } from './crashGuard';
import {
  battleRects,
  createProfileApi,
  createText,
  expectBattle,
  expectCamp,
  installKeyboardSim,
  redScan,
  setKeyboard,
  stubSpeech,
  tap,
  uniqueName,
} from './helpers';

// UI4 Task 2 (spec §5): Play, Grimoire and Boss share one battle stage - its backdrop, the dragon on
// the left, the opponent on the right, the hold bar, the parchment in the middle; the scene HUD and
// the exit sign replace the old top bar at the muster (Ruling C5).
const BODY = 'Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.';
const HOME: Record<string, string> = { hydre: 'river', lethe: 'river', sirenes: 'coast', protee: 'coast', echo: 'temple', chimere: 'temple' };

test.beforeEach(async ({ page }) => stubSpeech(page));

test('a free text meets a lieutenant on its own ground, and keeps it after a reload', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Bat-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Bataille'), body: BODY, level: '10H' });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'muster');
  const stage = page.getByTestId('scene-battle');
  await expect(stage).toHaveAttribute('data-opponent', /^(hydre|echo|chimere|protee|sirenes|lethe)$/);
  const opponent = (await stage.getAttribute('data-opponent'))!;
  await expect(stage).toHaveAttribute('data-backdrop', HOME[opponent]);
  await expect(stage).toHaveAttribute('data-layout', 'full');
  await expect(page.getByTestId('battle-dragon')).toBeVisible();
  await expect(page.getByTestId('battle-opponent')).toBeVisible();
  await expect(page.getByTestId('battle-hp')).toHaveAttribute('aria-valuenow', '100');
  await expect(page.getByTestId('battle-parchment').getByTestId('pace-option-1')).toBeVisible();
  // Ruling C5: the scene HUD and the exit sign, no top bar.
  await expect(page.locator('[data-testid="scene-battle"] [data-testid="stage-hud"] [data-testid="hud-hero"]')).toBeVisible();
  await expect(page.getByTestId('scene-exit')).toBeVisible();
  await expect(page.locator('[data-testid^="topbar-"]')).toHaveCount(0);
  expect(await redScan(page)).toEqual([]);
  await page.reload();
  await expectBattle(page, 'muster');
  await expect(stage).toHaveAttribute('data-opponent', opponent);
});

test('a quest, a grimoire and the boss bring their own opponent and ground', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Bat2-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Sirènes'), body: BODY, level: '10H' });
  const stage = page.getByTestId('scene-battle');
  for (const [hash, opponent, backdrop] of [
    [`/#/p/${id}/play/${text.id}?encounter=sirenes`, 'sirenes', 'coast'],
    [`/#/p/${id}/grimoire/${text.id}`, 'eris', 'temple'],
    [`/#/p/${id}/eris`, 'eris', 'lair'],
  ] as const) {
    await page.goto(hash);
    await expectBattle(page, 'muster');
    await expect(stage, hash).toHaveAttribute('data-opponent', opponent);
    await expect(stage, hash).toHaveAttribute('data-backdrop', backdrop);
  }
});

test('the exit sign leads back to the camp', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Bat3-${testInfo.project.name}`));
  await page.goto(`/#/p/${id}/eris`);
  await expectBattle(page, 'muster');
  await tap(page.getByTestId('scene-exit'), testInfo);
  await expectCamp(page);
});

test('portrait turns the battle into the rotate screen, with its backdrop', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Bat4-${testInfo.project.name}`));
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto(`/#/p/${id}/eris`);
  await expect(page.getByTestId('rotate-screen')).toBeVisible();
  await expect(page.locator('.rotate-backdrop')).toHaveAttribute('src', '/art/scenes/eris_lair.webp');
});

test('reduced motion: no particles, no idle motion on the combatants', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Bat5-${testInfo.project.name}`));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/#/p/${id}/eris`);
  await expectBattle(page, 'muster');
  await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-reduced-motion', 'true');
  await expect(page.locator('[data-testid="scene-battle"] [data-testid="fx-canvas"]')).toHaveCount(0);
  for (const id of ['battle-dragon', 'battle-opponent']) {
    await expect.poll(() => page.getByTestId(id).evaluate((el) => el.getAnimations({ subtree: true }).length), id).toBe(0);
  }
});

test('the simulated keyboard folds the stage into a band above the parchment, and back', async ({ page, request }, testInfo) => {
  await installKeyboardSim(page);
  const id = await createProfileApi(request, uniqueName(`Bat6-${testInfo.project.name}`));
  await page.goto(`/#/p/${id}/eris`);
  await expectBattle(page, 'muster');
  const inner = await page.evaluate(() => window.innerHeight);
  await setKeyboard(page, inner - 420);
  const stage = page.getByTestId('scene-battle');
  await expect(stage).toHaveAttribute('data-layout', 'compact');
  await expect.poll(async () => (await battleRects(page)).scene?.height ?? 0).toBeLessThanOrEqual(104);
  const r = await battleRects(page);
  for (const part of ['dragon', 'opponent', 'hp'] as const) {
    const b = r[part]!;
    expect(b.y, `${part} inside the band`).toBeGreaterThanOrEqual(r.scene!.y - 1);
    expect(b.y + b.height, `${part} inside the band`).toBeLessThanOrEqual(r.scene!.y + r.scene!.height + 1);
  }
  expect(r.parchment!.y).toBeGreaterThanOrEqual(r.scene!.y + r.scene!.height - 1);
  expect(r.parchment!.y + r.parchment!.height).toBeLessThanOrEqual(421);
  await setKeyboard(page, 0);
  await expect(stage).toHaveAttribute('data-layout', 'full');
});
```

Run: `scripts/playwright.sh scenes-battle --repeat-each=1`
Expected: FAIL (no `scene-battle`).

- [ ] **Step 2: `Combatant.svelte` and `HpBar.svelte`**

```svelte
<script lang="ts">
  // A combatant on the battle stage (UI4 Ruling C10): an existing cut-out, idle-breathing from the
  // kit, reacting through the Web Animations API. `.actor` moves in screen space; `.facing` mirrors
  // the art so the two sides look at each other.
  import { reactionAnimation, type Reaction } from '../../lib/battle/reactions';

  let {
    src,
    alt,
    side,
    mirror,
    filter = 'none',
    reaction,
    nonce,
    testId,
    idle,
    reduced,
    hits = 0,
  }: {
    src: string;
    alt: string;
    side: 'left' | 'right';
    mirror: boolean;
    filter?: string;
    reaction: Reaction;
    nonce: number;
    testId: string;
    idle: boolean;
    reduced: boolean;
    hits?: number;
  } = $props();

  let actor: HTMLDivElement | undefined = $state();

  $effect(() => {
    void nonce; // every reaction replays, the same one twice included
    const el = actor;
    const spec = reactionAnimation(reaction, { away: side === 'right' ? 1 : -1, reduced });
    if (!el || !spec) return;
    const a = el.animate(spec.keyframes, spec.options);
    return () => {
      // A held end pose (defeat, retreat) stays until the next reaction replaces it.
      if (spec.options.fill !== 'forwards') a.cancel();
    };
  });
</script>

<div class="combatant {side}" data-testid={testId} data-reaction={reaction} data-hits={hits}>
  <div class="actor" bind:this={actor}>
    <div class="facing" class:mirror>
      <img {src} {alt} class:idle-breathe={idle && !reduced} style:filter draggable="false" />
    </div>
  </div>
</div>

<style>
  .combatant {
    position: absolute;
    bottom: var(--feet, 6%);
    height: var(--h, 40vh);
    pointer-events: none;
  }
  .combatant.left {
    left: var(--left-x, 4vw);
  }
  .combatant.right {
    right: var(--right-x, 4vw);
  }
  .actor,
  .facing {
    height: 100%;
  }
  .facing.mirror {
    transform: scaleX(-1);
  }
  img {
    height: 100%;
    width: auto;
    display: block;
    object-fit: contain;
    user-select: none;
  }
</style>
```

(A previous `defeat`'s held animation must end when a new battle starts: `BattleStage` keys the combatants on the opponent id and on a `resetBattleStage()` generation, so a replay mounts fresh ones.)

```svelte
<script lang="ts">
  // The opponent's hold on the text (UI4 Ruling C3): full while she plays, notched at help stage 3,
  // dropping only at the reckoning. Éris's violet, never red; a meter for assistive tech.
  import { hpPercent, type HpView } from '../../lib/battle/hp';

  let { name, label, hp }: { name: string; label: string; hp: HpView } = $props();
  const ticks = $derived(hp.segments && hp.segments > 1 ? Array.from({ length: hp.segments - 1 }, (_, i) => (i + 1) / hp.segments!) : []);
</script>

<div
  class="hp-bar stage-text"
  data-testid="battle-hp"
  role="meter"
  aria-label={label}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-valuenow={hpPercent(hp)}
  data-segments={hp.segments ?? ''}
>
  <span class="hp-name kit-plaque" data-testid="battle-plaque">{name}</span>
  <span class="hp-track" aria-hidden="true">
    <span class="hp-fill" style:transform="scaleX({hp.value})"></span>
    {#each ticks as t (t)}<span class="hp-tick" style:left="{t * 100}%"></span>{/each}
  </span>
</div>

<style>
  .hp-bar {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
  }
  .hp-name {
    align-self: center;
    font-size: 15px;
    padding: 2px 12px;
  }
  .hp-track {
    position: relative;
    height: 14px;
    border-radius: 7px;
    background: rgba(21, 18, 26, 0.72);
    border: 2px solid var(--bronze-light);
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.6);
    overflow: hidden;
  }
  .hp-fill {
    position: absolute;
    inset: 0;
    transform-origin: left center;
    background: linear-gradient(180deg, #8a4fb5, var(--violet) 60%, var(--violet-dark));
    transition: transform 0.35s cubic-bezier(0.3, 0.7, 0.4, 1);
  }
  .hp-tick {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    margin-left: -1px;
    background: var(--bronze-ink);
    opacity: 0.8;
  }
</style>
```

- [ ] **Step 3: `BattleStage.svelte`**

```svelte
<script lang="ts">
  // The battle stage (scenes spec §5, UI4 Rulings C4, C5, C10, C12): full-screen backdrop, the dragon
  // on the left, the opponent on the right, its hold bar, and the parchment in the middle, laid out in
  // viewport space so the text keeps its size. While the keyboard is open (visual viewport shorter
  // than 560 px) the scene folds into a band above the parchment. Test ids and attributes mirror
  // SceneStage's (`scene-battle`, `stage-hud`, `data-reduced-motion`, SceneTransition's
  // `data-settled`), so the scene e2e helpers work here too.
  import { onMount, type Snippet } from 'svelte';
  import SceneTransition from '../scene/SceneTransition.svelte';
  import FxCanvas from '../scene/FxCanvas.svelte';
  import Hud from '../scene/Hud.svelte';
  import SceneExit from '../scene/SceneExit.svelte';
  import RotateScreen from '../scene/RotateScreen.svelte';
  import Particles from '../juice/Particles.svelte';
  import Combatant from './Combatant.svelte';
  import HpBar from './HpBar.svelte';
  import { FACES, type BattleDef, type BattleMode, type BattlePhase } from '../../lib/battle/battle';
  import { bandHeight, battleLayout } from '../../lib/battle/layout';
  import { battleStage, resetBattleStage } from '../../lib/battle/stage.svelte';
  import { viewport, watchViewport } from '../../lib/battle/viewport.svelte';
  import { emitBattle } from '../../lib/battle/events';
  import { EMPRISE, STAGE } from '../../lib/battle/lines';
  import { overlayState } from '../../lib/scene/overlayState.svelte';
  import { go, heroPanelHref } from '../../lib/scene/panelNav';
  import { reducedMotion, watchReducedMotion } from '../../lib/juice/motion';
  import { ART } from '../../lib/world/art';
  import { TINT_FILTERS } from '../../lib/world/dragon';
  import type { BattleLayout } from '../../lib/battle/layout';
  import type { CampResponse, DragonOut } from '../../lib/world/types';
  import type { Profile } from '../../lib/types';

  let {
    battle,
    phase,
    profile,
    camp,
    dragon,
    mode = 'dictation',
    hud = false,
    exit = false,
    children,
  }: {
    battle: BattleDef | null;
    phase: BattlePhase;
    mode?: BattleMode;
    profile: Profile;
    camp: CampResponse | null;
    dragon: DragonOut | null;
    hud?: boolean;
    exit?: boolean;
    children: Snippet<[BattleLayout]>;
  } = $props();

  resetBattleStage();
  let reduced = $state(reducedMotion());
  $effect(() => watchReducedMotion((r) => (reduced = r)));
  onMount(() => watchViewport());

  const layout = $derived<BattleLayout>(viewport.height > 0 ? battleLayout(viewport.height, viewport.inner) : 'full');
  const band = $derived(bandHeight(viewport.height || 820));
  const covered = $derived(overlayState.open > 0);
  // Ruling C12: during proofreading nothing moves behind the text.
  const idle = $derived(phase !== 'proofreading');

  $effect(() => {
    if (battle) emitBattle({ kind: 'start', opponent: battle.opponent.id, mode });
  });
  $effect(() => emitBattle({ kind: 'phase', phase }));

  const onHero = () => go(heroPanelHref(profile.id), 'panel');
</script>

<main
  class="battle-stage"
  class:has-overlay={covered}
  class:has-hud={hud && layout === 'full'}
  data-testid="scene-battle"
  data-phase={phase}
  data-layout={layout}
  data-opponent={battle?.opponent.id ?? ''}
  data-backdrop={battle?.backdrop.id ?? ''}
  data-reduced-motion={reduced ? 'true' : 'false'}
  inert={covered}
  style:--band="{band}px"
>
  <SceneTransition kind="fade">
    <div class="battle-scene" data-testid="battle-scene">
      {#if battle}
        <img class="battle-backdrop" src={battle.backdrop.src} alt="" draggable="false" />
        {#if !reduced && layout === 'full' && idle}<FxCanvas preset={battle.ambience.particles} />{/if}
        <Combatant
          src={ART.dragon[dragon?.stage ?? 'egg']}
          alt={dragon?.name ?? STAGE.dragonAlt}
          side="left"
          mirror={FACES.dragon !== 'right'}
          filter={TINT_FILTERS[dragon?.tint ?? 'bronze']}
          reaction={battleStage.dragon.reaction}
          nonce={battleStage.dragon.nonce}
          testId="battle-dragon"
          {idle}
          {reduced}
        />
        {#key battle.opponent.id}
          <Combatant
            src={battle.opponent.art}
            alt={battle.opponent.alt}
            side="right"
            mirror={FACES[battle.opponent.id] !== 'left'}
            reaction={battleStage.opponent.reaction}
            nonce={battleStage.opponent.nonce}
            hits={battleStage.hits}
            testId="battle-opponent"
            {idle}
            {reduced}
          />
          <div class="hit-burst" aria-hidden="true"><Particles trigger={battleStage.hits} kind="burst" /></div>
        {/key}
        <div class="hp-slot"><HpBar name={battle.opponent.name} label={EMPRISE[battle.opponent.id]} hp={battleStage.hp} /></div>
      {/if}
    </div>
    <section class="battle-parchment" data-testid="battle-parchment" aria-label={battle?.opponent.name ?? ''}>
      {@render children(layout)}
    </section>
    {#if exit && layout === 'full'}<SceneExit profileId={profile.id} />{/if}
  </SceneTransition>
  <div class="stage-hud" data-testid="stage-hud">
    {#if hud && layout === 'full'}<Hud {profile} {camp} {onHero} />{/if}
  </div>
  <RotateScreen background={battle?.backdrop.src ?? null} />
</main>

<style>
  .battle-stage {
    position: fixed;
    inset: 0;
    overflow: hidden; /* fallback for engines without `clip` */
    overflow: clip;
    background: var(--night);
    --parchment-w: min(62vw, 48rem);
    --side: calc((100vw - var(--parchment-w)) / 2);
    --top: calc(12px + env(safe-area-inset-top));
  }
  .battle-stage.has-hud {
    --top: calc(var(--hud-band) + 8px);
  }
  .battle-scene {
    position: absolute;
    inset: 0;
  }
  .battle-backdrop {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: 50% 60%;
    transition: filter 0.4s ease;
  }
  .battle-stage[data-phase='proofreading'] .battle-backdrop {
    filter: brightness(0.7) saturate(0.85);
  }
  .battle-scene :global(.combatant.left) {
    --h: clamp(140px, 36vh, 320px);
    --left-x: max(8px, calc(var(--side) / 2 - 0.35 * var(--h)));
    --feet: calc(4vh + env(safe-area-inset-bottom));
  }
  .battle-scene :global(.combatant.right) {
    --h: clamp(180px, 50vh, 440px);
    --right-x: max(8px, calc(var(--side) / 2 - 0.3 * var(--h)));
    --feet: calc(4vh + env(safe-area-inset-bottom));
  }
  .hit-burst {
    position: absolute;
    right: calc(var(--side) / 2 - 60px);
    bottom: 30vh;
    width: 120px;
    height: 120px;
    pointer-events: none;
  }
  .hp-slot {
    position: absolute;
    top: var(--top);
    right: 12px;
    width: min(240px, calc(var(--side) - 24px));
    z-index: 3;
  }
  .battle-parchment {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    width: var(--parchment-w);
    top: var(--top);
    bottom: calc(12px + env(safe-area-inset-bottom));
    z-index: 4;
    display: flex;
    flex-direction: column;
    min-height: 0;
    border-radius: 14px;
    background:
      linear-gradient(var(--battle-parchment-edge), var(--battle-parchment-edge)),
      var(--tex-parchment);
    box-shadow:
      0 0 0 2px rgba(201, 171, 116, 0.55),
      0 12px 40px rgba(0, 0, 0, 0.45);
    overflow: hidden;
  }
  .battle-stage :global(.scene-exit) {
    left: calc(12px + env(safe-area-inset-left));
    bottom: calc(12px + env(safe-area-inset-bottom));
  }
  .stage-hud {
    position: absolute;
    inset: 0 0 auto 0;
    z-index: 5;
    height: 0;
  }
  .battle-stage.has-overlay :global(.stage-text) {
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  /* Ruling C4: the keyboard is open. The stage follows the visual viewport; the scene is a band. */
  .battle-stage[data-layout='compact'] {
    inset: auto 0 auto 0;
    top: var(--vv-top, 0px);
    height: var(--vvh, 100dvh);
    --parchment-w: min(96vw, 60rem);
  }
  .battle-stage[data-layout='compact'] .battle-scene {
    inset: 0 0 auto 0;
    height: var(--band);
    overflow: hidden;
    border-bottom: 2px solid var(--bronze-light);
  }
  .battle-stage[data-layout='compact'] .battle-backdrop {
    object-position: 50% 45%;
  }
  .battle-stage[data-layout='compact'] .battle-scene :global(.combatant) {
    --h: calc(var(--band) - 8px);
    --feet: 4px;
  }
  .battle-stage[data-layout='compact'] .battle-scene :global(.combatant.left) {
    --left-x: 12px;
  }
  .battle-stage[data-layout='compact'] .battle-scene :global(.combatant.right) {
    --right-x: 12px;
  }
  .battle-stage[data-layout='compact'] .hp-slot {
    top: 50%;
    left: 50%;
    right: auto;
    transform: translate(-50%, -50%);
    width: min(40vw, 320px);
  }
  .battle-stage[data-layout='compact'] .hit-burst {
    display: none;
  }
  .battle-stage[data-layout='compact'] .battle-parchment {
    top: var(--band);
    bottom: 0;
    border-radius: 0 0 14px 14px;
  }

  @media (orientation: portrait) and (aspect-ratio < 1) {
    .battle-stage > :global(.scene-transition) {
      display: none;
    }
  }
</style>
```

Notes for the implementer:
- The `SceneTransition` wrapper is `position: absolute; inset: 0` (its own CSS), so the absolute children lay out against it; in compact the stage itself is resized, the wrapper follows.
- The HUD's `Hud` is anchored to `.stage-hud` exactly as in `SceneStage` (its `position: absolute; top: 0; left: 0; right: 0`).
- If `--hud-band` needs the `has-hud` rule from `kit.css` (Ruling W-a), mirror it: the kit resets `--hud-band` to the safe-area inset for a stage without a HUD via `:has()`; read `kit.css` lines ~60-75 and add `.battle-stage` next to `.scene-stage` in that rule if it is scoped to the scene stage.
- `Particles` burst at `.hit-burst`, a box over the opponent's chest; it renders nothing under reduced motion by itself.

- [ ] **Step 4: Split `Play.svelte` into the controller and four phases**

Move the markup and nothing else; the logic stays in `Play.svelte`:
- `MusterPhase.svelte` receives the `{#if showResumeBanner}` block and the `{:else if playState.phase === 'intro'}` block (and their CSS), reading its props instead of Play's state; the resume banner gets `data-testid="battle-resume"`, its buttons `battle-resume-continue` / `battle-resume-restart`. `PaceSelect` is still imported from `../PaceSelect.svelte` (Task 3 replaces it). The title `h1` becomes `h2` (the stage has no `h1` of its own; the plaque is the opponent's name; headings keep their names for the e2e).
- `DictationPhase.svelte` (the moved `Dictation.svelte`): delete its `--vvh` `$effect` (the stage's `watchViewport` owns `--vvh` now, Ruling C4) and its `style="height: var(--vvh)"` (the parchment sizes it: `height: 100%`); nothing else changes.
- `DictationPhase.svelte` and `ProofPhase.svelte` both declare the new `layout` prop now (unused until Tasks 4–5; a destructured rune prop that is not read yet raises no svelte-check warning — if it does, prefix it `_layout` rather than silencing the check). Lanes then never edit `Play.svelte`.
- `ProofPhase.svelte` (the moved `Proofreading.svelte`): in its visual-viewport `$effect`, delete the two `--vvh` property writes and the `removeProperty`, keep the `scrollIntoView` of the edited word on `resize`; `height: var(--vvh, 100dvh)` becomes `height: 100%`; add the `onQuit` prop (rendered by Task 5). Fix the imports of `TokenText`/`WordEditor` (same folder now).
- `VictoryPhase.svelte` receives the `{:else if result}` block (BreakNudge, ProgressionReveal, Results) and the « Les Muses comptent… » waiting line, with its props; it imports the three legacy components from `../` for now.
- `BossMuster.svelte` receives `Boss.svelte`'s parchment/info card markup (challenge line, tier, reward, rules, error, start button) and CSS, reading its props.

`Play.svelte` becomes:

```svelte
<script lang="ts">
  // ... every import and every function of today's Play.svelte stays, minus TopBar and the four
  // components now rendered by the phases, plus:
  import { untrack } from 'svelte';
  import BattleStage from '../components/battle/BattleStage.svelte';
  import MusterPhase from '../components/battle/MusterPhase.svelte';
  import DictationPhase from '../components/battle/DictationPhase.svelte';
  import ProofPhase from '../components/battle/ProofPhase.svelte';
  import VictoryPhase from '../components/battle/VictoryPhase.svelte';
  import { battleFor, opponentFor, type BattlePhase } from '../lib/battle/battle';
  import { hpDuringPlay } from '../lib/battle/hp';
  import { musterTaunt, STAGE } from '../lib/battle/lines';
  import { setHp } from '../lib/battle/stage.svelte';
  import { bandFor } from '../lib/world/eris';
  import { erisSays } from '../lib/world/voices';
  import { closePanel, openPanel } from '../lib/scene/panelNav';
  import { initSound } from '../lib/juice/soundStore.svelte';
  import { loadCatalog } from '../lib/world/campStore.svelte';

  // (props unchanged)

  // UI4 Task 2: the stage needs the camp (the dragon, the HUD, a free text's lieutenant) and the
  // hero's mute setting, like every place (PlaceScene does the same).
  let campTried = $state(false);
  $effect(() => {
    const pid = profile.id;
    untrack(() => {
      initSound(profile);
      void loadCatalog();
      void refreshCamp(pid).finally(() => (campTried = true));
    });
  });

  // Ruling C2: the opponent is chosen once (the camp answered, or failed to), then kept in the play
  // state so a reload or a resume faces the same one.
  $effect(() => {
    if (!playState || playState.opponent || (!camp && !campTried)) return;
    playState.opponent = opponentFor({
      mode,
      encounter,
      textId: id,
      lieutenants: camp?.lieutenants ?? [],
    });
    save();
  });
  const battle = $derived(playState?.opponent ? battleFor(playState.opponent, { mode, encounter }) : null);

  const phase = $derived<BattlePhase>(
    !playState || loading || error || showResumeBanner || playState.phase === 'intro'
      ? 'muster'
      : playState.phase === 'results'
        ? 'victory'
        : playState.phase,
  );

  // Ruling C3: the hold is full while she plays, notched by the stage-3 count.
  $effect(() => {
    if (phase === 'dictation' || phase === 'proofreading' || phase === 'muster') {
      setHp(hpDuringPlay(helpStage, playState?.initialErrors));
    }
  });

  // Ruling C7: Éris's line at the muster.
  const taunt = $derived.by(() => {
    if (!battle) return null;
    const lt = camp?.lieutenants.find((l) => l.key === battle.opponent.id);
    return erisSays(musterTaunt({ opponent: battle.opponent.id, band: lt ? bandFor(lt) : null, mode }));
  });

  // Ruling C1: « Revoir » is ?panel=revoir on this very URL.
  const routeName = $derived(mode === 'grimoire' ? 'grimoire' : 'play');
  const params = $derived({ profileId: String(profile.id), textId: String(id) });
  const baseQuery = $derived(Object.fromEntries(Object.entries(query).filter(([k]) => k !== 'panel')));
  const reviewOpen = $derived(query.panel === 'revoir');
  function openReview() {
    openPanel(href(routeName, params, { ...baseQuery, panel: 'revoir' }));
  }
  function closeReview() {
    closePanel(href(routeName, params, Object.keys(baseQuery).length ? baseQuery : undefined));
  }
</script>

<BattleStage {battle} {phase} {profile} {camp} {mode} dragon={camp?.dragon ?? null} hud={phase === 'muster' || phase === 'victory'} exit={phase === 'muster' || phase === 'victory'}>
  {#snippet children(layout)}
    {#if loading}
      <p class="kit-ribbon battle-status" data-testid="battle-status">{STAGE.loading}</p>
    {:else if error}
      <p class="kit-ribbon battle-status" data-testid="battle-status" role="alert">{STAGE.loadError(error)}</p>
    {:else if text && plan && playState}
      {#if showResumeBanner || playState.phase === 'intro'}
        <MusterPhase
          {text}
          {mode}
          bind:playState
          {minPace}
          {questId}
          {encounter}
          resume={showResumeBanner}
          {corrupting}
          {corruptError}
          {taunt}
          profileId={profile.id}
          onContinue={continueSession}
          onRestart={restart}
          onStart={startDictation}
          onOpenGrimoire={openGrimoire}
          onToLibrary={toLibrary}
        />
      {:else if playState.phase === 'dictation'}
        <DictationPhase {plan} pace={playState.pace} {voice} {layout} bind:text={playState.draft} onFinish={onDictationFinish} onQuit={quitDictation} />
      {:else if playState.phase === 'proofreading'}
        <ProofPhase
          reference={text}
          bind:state={playState}
          {helpStage}
          argusOrder={stats?.argus_order ?? []}
          trapWords={trapWords.map((t) => t.word)}
          level={profile.level}
          {mode}
          {layout}
          onDone={onProofreadingDone}
          onQuit={quitProofreading}
        />
      {:else}
        <VictoryPhase
          {text}
          {result}
          {playState}
          {profile}
          {camp}
          {mode}
          opponent={playState.opponent ?? 'eris'}
          {encounter}
          {helpMessage}
          {submitError}
          {submitting}
          bind:revealDone
          {reviewOpen}
          names={progressionNames}
          onReplay={restart}
          onCamp={toLibraryCamp}
          onRetry={submitSession}
          onReview={openReview}
          onCloseReview={closeReview}
        />
      {/if}
    {/if}
  {/snippet}
</BattleStage>
```

- `quitProofreading()` is `quitDictation()`'s twin (`save(); showResumeBanner = true;`), wired now so Task 5 only renders the button (C15).
- `href`'s third argument is `Record<string, string> | undefined`; if it rejects an empty object, pass `undefined` as above.
- The `.battle-status` ribbon is a small scoped rule in `Play.svelte` (`margin: auto; text-align: center`).
- A route change to `?panel=revoir` must not remount anything: App renders `Play` in the same branch, so it does not (Ruling C1). Keep it that way.

- [ ] **Step 5: Boss on the stage**

`Boss.svelte` keeps its script (camp refresh, tier, reward id, `start()`) minus `TopBar`, `Dragon`, `CHALLENGE_LINES` (now `lines.ts`), and renders:

```svelte
<BattleStage battle={battleFor('eris', { mode: 'boss', encounter: 'eris' })} phase="muster" {profile} {camp} mode="boss" dragon={camp?.dragon ?? null} hud exit>
  {#snippet children()}
    <BossMuster
      {tier}
      rewardId={bossRewardId}
      rewardXp={campStore.catalog?.quest_bonus.boss ?? 300}
      rewardName={bossRewardName(tier, campStore.catalog)}
      retry={isGrimoireRetry}
      {starting}
      {startError}
      taunt={erisSays(CHALLENGE_LINES[tier] ?? CHALLENGE_LINES[1])}
      onStart={start}
    />
  {/snippet}
</BattleStage>
```

Keep `navigate(...)` in `start()` as it is (the boss route hands over to play/grimoire).

- [ ] **Step 6: Retire `TopBar`, stage the lanes' fences**

- `git rm web/src/components/TopBar.svelte`. Grep `TopBar` in `web/src` and `web/e2e`: nothing may remain but comments you then correct.
- `App.svelte`: the comment « The battle screens below keep their legacy layout and TopBar until UI4. » becomes « The battle routes render the battle stage (UI4); Play stays mounted across its phases and its « Revoir » panel (Ruling C1). ».
- `battleKit.test.ts` `PENDING` becomes (lane P, fence, lane V):

```ts
const PENDING = new Set<string>([
  'src/components/battle/MusterPhase.svelte',
  'src/components/battle/DictationPhase.svelte',
  'src/components/battle/ProofPhase.svelte',
  'src/components/battle/WordEditor.svelte',
  // --- lane V (Tasks 6-7) below this line ---
  'src/components/battle/VictoryPhase.svelte',
  'src/components/battle/BossMuster.svelte',
]);
```

  (keep only files that really still have a legacy hit; the test fails on a clean listed file.)
- `registerGuard.test.ts`: delete `BATTLE` (and its filter); add `...walk('src/components/battle')` to `FILES`; `PENDING` gets the same fenced shape with the phase files that still hold banned words (`MusterPhase.svelte` holds « ≈ »; check the others by running the test), e.g.:

```ts
const PENDING = new Set<string>([
  'src/components/battle/MusterPhase.svelte',
  // --- lane V (Tasks 6-7) below this line ---
]);
```

  and its existing « keeps the pending list honest » test stays.

- [ ] **Step 7: Migrate the specs that read the old top bar**

- `scenes-camp.spec.ts` « legacy screens stay usable in portrait »: rename to « the battle turns into the rotate screen in portrait, like every scene » and assert `rotate-screen` visible (the new behaviour, spec §1); or delete it if `scenes-battle.spec.ts`'s portrait test covers it (it does: delete, and say so in the report).
- `scenes-parity.spec.ts`: the rows become `{ hash: '#/p/{id}/eris', scene: 'battle', testId: 'boss-start' }` and `{ hash: '#/p/{id}/play/{text}', scene: 'battle', testId: 'pace-option-1' }`. Replace « the legacy TopBar reads its journal from the cabin, not the dossier » by:

```ts
// UI4 Ruling C5: the top bar retired; from a battle's muster the HUD's hero chip opens the hero panel
// in the cabin, whose medallions reach the journal and the lyre; its seal steps back to the battle.
test('the battle muster reaches the journal and the lyre through the hero panel', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`ParBat-${testInfo.project.name}`));
  const text = ((await (await request.get('/api/texts')).json()) as { id: number }[])[0].id;
  for (const hash of [`#/p/${id}/eris`, `#/p/${id}/play/${text}`]) {
    await page.goto(`/${hash}`);
    await expectScene(page, 'battle');
    await page.getByTestId('hud-hero').click();
    await expect(page.getByTestId('overlay-heros'), hash).toBeVisible();
    for (const [medallion, overlay, url] of [
      ['hero-journal', 'overlay-journal', /\/stats$/],
      ['hero-settings', 'overlay-lyre', /\/settings$/],
    ] as const) {
      await page.getByTestId(medallion).click();
      await expect(page, medallion).toHaveURL(url);
      await expect(page.getByTestId(overlay), medallion).toBeVisible();
      await closeOverlay(page);
      await expect(page.getByTestId('overlay-heros'), medallion).toBeVisible();
    }
    await closeOverlay(page);
    await expect(page, hash).toHaveURL(new RegExp(hash.replace(/[?]/g, '\\?') + '$'));
    await expectScene(page, 'battle');
    expect(await redScan(page), hash).toEqual([]);
  }
});
```

  (Import `expectScene` if the file does not yet. Read the hero-panel e2e in `scenes-cabin.spec.ts` for the exact seal/Back behaviour from a non-cabin place and follow it: the hero panel opened with `go(…, 'panel')` steps back to where the chip was tapped, UI3b B2.)
- `alexandria.spec.ts`: `watchOverlap(page, 'scene-library', 'topbar-camp')` → `watchOverlap(page, 'scene-library', 'scene-battle')`; `expect(page.getByTestId('topbar-camp')).toBeVisible()` → `expect(page.getByTestId('scene-battle')).toBeVisible()`; update the comment (« `scene-battle` is Play's stage, rendered from its first paint, before its own text fetch resolves »).
- `grep -rn "topbar-" web/e2e` must print nothing.

- [ ] **Step 8: Run**

Run: `scripts/npm.sh run test -- src/battleKit.test.ts src/registerGuard.test.ts src/placesKit.test.ts src/formPlural.test.ts src/noEmoji.test.ts src/noGuilt.test.ts src/lib/battle` — Expected: PASS.
Run: `scripts/npm.sh run check` — Expected: `0 errors and 0 warnings`.
Run: `scripts/playwright.sh scenes-battle --repeat-each=3` — Expected: all pass on `desktop` and `ipad` (6 tests × 2 projects × 3).
Run once each (migrated): `scripts/playwright.sh scenes-parity`, `scripts/playwright.sh alexandria`, `scripts/playwright.sh happy-path`, `scripts/playwright.sh grimoire`, `scripts/playwright.sh world`, `scripts/playwright.sh scan` — Expected: pass (every flow still runs through the legacy phase markup on the new stage).
Run: `PW_WORKERS=4 scripts/check.sh` — Expected: `== ALL GREEN` (B2's batch gate; paste pytest/vitest/e2e counts).

- [ ] **Step 9: Commit**

```bash
git add web/src/components/battle web/src/screens/Play.svelte web/src/screens/Boss.svelte web/src/App.svelte web/src/battleKit.test.ts web/src/registerGuard.test.ts web/e2e/scenes-battle.spec.ts web/e2e/scenes-parity.spec.ts web/e2e/scenes-camp.spec.ts web/e2e/alexandria.spec.ts
git commit -m "UI4 Task 2: the battle stage - backdrop, dragon and opponent cut-outs, the hold bar, the parchment, compact band; Play split into phases, Boss on the stage, the top bar retires

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/components/battle web/src/components/Dictation.svelte web/src/components/Proofreading.svelte web/src/components/TokenText.svelte web/src/components/WordEditor.svelte web/src/components/TopBar.svelte web/src/screens/Play.svelte web/src/screens/Boss.svelte web/src/App.svelte web/src/battleKit.test.ts web/src/registerGuard.test.ts web/e2e/scenes-battle.spec.ts web/e2e/scenes-parity.spec.ts web/e2e/scenes-camp.spec.ts web/e2e/alexandria.spec.ts
```

(The pathspec names both sides of each `git mv` and the removed `TopBar.svelte`.)

Then the controller creates the two B3 worktrees from this commit.

---

### Task 3: The muster — the order of battle on the parchment (lane P)

**Files:**
- Modify: `web/src/components/battle/MusterPhase.svelte`
- Move: `git mv web/src/components/PaceSelect.svelte web/src/components/battle/PaceMedallions.svelte` (then rewrite it)
- Modify: `web/src/battleKit.test.ts`, `web/src/registerGuard.test.ts` (remove `MusterPhase.svelte` from lane P's side of both `PENDING` sets)
- Create: `web/e2e/scenes-battle-play.spec.ts`
- Modify: `web/e2e/scan.spec.ts` (the prophecy's day in words)

**Interfaces:**
- Consumes: Task 2's `MusterPhase` prop contract (unchanged), `MUSTER`, `OverlayVoice` (`{ line, testId }`), `longDate`, `isProphecy`, `ttsAvailable`, `api.scan.pageUrl`, `PACE_LABELS`, `react` (`stage.svelte.ts`), the kit (`kit-ribbon`, `kit-tag`, `kit-note`, `kit-bronze`, `kit-medallion`, `kit-link`).
- Produces: `PaceMedallions.svelte` (`pace` bindable, `minPace`), test ids kept (`pace-option-1..4` on the labels, `.disabled` below `minPace`, `play-prophecy`, `play-quest-banner`, `play-boss-banner`, `btn-grimoire`, `btn-open-grimoire`, `btn-back-library`, `battle-resume*`), new `battle-voice` (Éris's plate), `muster-words`.

- [ ] **Step 1: Write the failing e2e**

`web/e2e/scenes-battle-play.spec.ts` (lane P's spec; Tasks 4 and 5 append to it):

```ts
import { test, expect } from './crashGuard';
import {
  battleRects,
  createProfileApi,
  createText,
  expectBattle,
  expectOverlayTapTargets,
  installKeyboardSim,
  LEGACY_UI,
  redScan,
  resumeSeeded,
  seedPlay,
  setKeyboard,
  stubSpeech,
  tap,
  uniqueName,
} from './helpers';

// UI4 lane P (spec §5): the muster, the dictation and the proofreading on the battle stage, their
// compact layout under the simulated keyboard, and the long text's legibility.
const BODY = 'Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.';

test.beforeEach(async ({ page }) => stubSpeech(page));

test('the muster is an order of battle: Éris taunts, four pace medallions, no school metadata', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Mus-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Muster'), body: BODY, level: '10H' });
  await page.goto(`/#/p/${id}/play/${text.id}?encounter=hydre`);
  await expectBattle(page, 'muster');
  const sheet = page.getByTestId('battle-parchment');
  await expect(sheet.getByTestId('battle-voice')).toHaveAttribute('data-speaker', 'eris');
  await expect(sheet.getByTestId('battle-voice')).toContainText('Hydre');
  await expect(sheet.getByTestId('muster-words')).toHaveText('14 mots');
  await expect(sheet).not.toContainText(/\b\d{1,2}H\b|≈/);
  await expect(sheet.getByRole('radio')).toHaveCount(4);
  await expect(sheet.getByTestId('pace-option-3')).toContainText("D'un bon pas");
  await expect(sheet.getByTestId('pace-option-4')).toContainText("D'une traite");
  await expect(sheet.getByText('Plus le rythme est vif, plus la gloire est grande.')).toBeVisible();
  await expect(sheet.locator(LEGACY_UI)).toHaveCount(0);
  await expectOverlayTapTargets(page, 'battle-parchment');
  expect(await redScan(page)).toEqual([]);
  await tap(sheet.getByTestId('pace-option-2'), testInfo);
  await expect(sheet.getByTestId('pace-option-2').locator('input')).toBeChecked();
  await tap(sheet.getByRole('button', { name: 'Commencer la dictée' }), testInfo);
  await expectBattle(page, 'dictation');
});

test('a boss dictation locks the slower paces and says why', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Mus2-${testInfo.project.name}`), '10H');
  const text = await createText(request, { title: uniqueName('Muster boss'), body: BODY, level: '10H' });
  await page.goto(`/#/p/${id}/play/${text.id}?encounter=eris&quest=1`);
  await expectBattle(page, 'muster');
  const sheet = page.getByTestId('battle-parchment');
  await expect(sheet.getByTestId('play-boss-banner')).toHaveText("Combat contre Éris : les Yeux d'Argus restent éteints.");
  await expect(sheet.getByTestId('play-quest-banner')).toHaveText('Ce texte compte pour ta quête.');
  await expect(sheet.locator('[data-testid^="pace-option-"].disabled').first()).toContainText('Pas pendant un combat');
});

test('a seeded dictation comes back behind the resume ribbon', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Mus3-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Muster reprise'), body: BODY, level: '10H' });
  await seedPlay(page, { profileId: id, textId: text.id, phase: 'dictation', draft: 'Les fées' });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'muster');
  await expect(page.getByTestId('battle-resume')).toContainText("Ton brouillon t'attend là où tu l'avais laissé.");
  await resumeSeeded(page);
  await expectBattle(page, 'dictation');
  await expect(page.getByTestId('dictation-textarea')).toHaveValue('Les fées');
});

test('the grimoire muster: Éris guards it, and a text too short for her says so', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Mus4-${testInfo.project.name}`));
  const tiny = await createText(request, { title: uniqueName('Oui'), body: 'Oui.', level: '10H' });
  await page.goto(`/#/p/${id}/grimoire/${tiny.id}`);
  await expectBattle(page, 'muster');
  const sheet = page.getByTestId('battle-parchment');
  await expect(sheet.getByRole('heading', { name: 'Grimoire corrompu' })).toBeVisible();
  await expect(sheet.getByTestId('battle-voice')).toContainText("J'ai recopié ce parchemin à ma façon");
  await tap(sheet.getByTestId('btn-open-grimoire'), testInfo);
  await expect(sheet.locator('.kit-note[data-tone="eris"]')).toBeVisible();
  await expect(sheet.getByTestId('btn-back-library')).toHaveText('Retour aux parchemins');
});
```

(If the server corrupts even « Oui. », pick the shortest body its 422 path refuses: read `server/app/routers/texts.py` `corrupt` for the rule and use a body under it.)

`web/e2e/scan.spec.ts`: `await expect(page.getByTestId('play-prophecy')).toContainText('30.06.2035');` → `toContainText('samedi 30 juin 2035')`.

Run: `scripts/playwright.sh scenes-battle-play` — Expected: FAIL (no voice plate, words tag, medallions).

- [ ] **Step 2: `PaceMedallions.svelte`**

After the `git mv`, rewrite it on the kit's radio medallion (`ui/LevelMedallions.svelte`'s markup, the label is the 48 px target and carries the test id):

```svelte
<script lang="ts">
  // The four paces as bronze medallions (UI4 Task 3; Ruling C8's names): real radios. `minPace`
  // (SP3 Task 7): in a boss fight the slower paces stay visible, locked, with the reason.
  import { PACE_LABELS, type Pace } from '../../lib/dictation/script';
  import { MUSTER } from '../../lib/battle/lines';

  let { pace = $bindable(), minPace = 1 }: { pace: Pace; minPace?: Pace } = $props();
  const PACES: Pace[] = [1, 2, 3, 4];
  const ROMAN = ['', 'I', 'II', 'III', 'IV'];
</script>

<fieldset class="paces">
  <legend class="kit-section">{MUSTER.paceHeading}</legend>
  <div class="grid" role="radiogroup" aria-label="Rythme de la dictée">
    {#each PACES as p (p)}
      {@const disabled = p < minPace}
      <label class="pace" class:selected={pace === p} class:disabled data-testid="pace-option-{p}">
        <input type="radio" name="pace" value={p} checked={pace === p} {disabled} onchange={() => (pace = p)} />
        <span class="kit-medallion seal" aria-hidden="true">{ROMAN[p]}</span>
        <span class="words">
          <span class="title">{PACE_LABELS[p].title}</span>
          <span class="desc">{disabled ? MUSTER.paceLocked : PACE_LABELS[p].description}</span>
        </span>
      </label>
    {/each}
  </div>
</fieldset>

<style>
  .paces {
    margin: 0;
    padding: 0;
    border: 0;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  .pace {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 64px;
    padding: 8px 12px;
    border-radius: 10px;
    border: 2px solid transparent;
    background: rgba(255, 250, 238, 0.6);
    cursor: pointer;
  }
  .pace input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .pace.selected {
    border-color: var(--gold);
    background: rgba(255, 247, 222, 0.95);
    box-shadow: 0 0 0 3px rgba(212, 166, 58, 0.25);
  }
  .pace:has(input:focus-visible) {
    outline: 3px solid var(--gold-light);
    outline-offset: 2px;
  }
  .pace.disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  .seal {
    flex: none;
    width: 48px;
    height: 48px;
    font-family: var(--font-display);
  }
  .words {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .title {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 16px;
  }
  .desc {
    font-size: 14px;
    color: var(--ink-soft);
    line-height: 1.3;
  }
</style>
```

(Check `.kit-medallion`'s own rules in `kit-objects.css`: it may style a label with an input inside; used here as a bare disc, give it only what it needs, or add a `.kit-seal`-style disc if the medallion rule assumes an input.)

- [ ] **Step 3: `MusterPhase.svelte` restyled**

Structure, top to bottom, inside a scrolling `.muster` column (`overflow: auto; padding: 18px 22px; gap: 14px`):
1. Resume state (`resume`): a centred `kit-ribbon` sheet `data-testid="battle-resume"` with `MUSTER.resume`, `kit-bronze` « Continuer » (`battle-resume-continue`) and `kit-bronze is-quiet` « Recommencer » (`battle-resume-restart`). Nothing else renders while it shows.
2. Header: `<h2 class="muster-title">` (Cinzel, 26 px) = `MUSTER.grimoire` in grimoire mode, else `text.title`; the credits line under it (`kit-tag-meta` style, italic, the existing `credits(text)` logic moved here); a row of tags: `<span class="kit-tag" data-testid="muster-words">{MUSTER.words(text.word_count)}</span>`, the quest ribbon (`kit-tag` with the Oracle seal icon `MARK_ICONS.oracleSeal`, `data-testid="play-quest-banner"`, text `MUSTER.quest`) when `questId`, the boss ribbon (`kit-note data-tone="eris"`, `data-testid="play-boss-banner"`, `MUSTER.boss`) when `encounter === 'eris'`, the prophecy (`kit-prophecy` or a `kit-tag` in `--reward-ink`, `data-testid="play-prophecy"`, `MUSTER.prophecy(longDate(text.due_date))`) when `text.due_date && isProphecy(text.due_date)`.
3. Éris's plate: `{#if taunt}<OverlayVoice line={taunt} testId="battle-voice" />{/if}`; on mount, `react('opponent', 'taunt')` and `react('dragon', 'brace')` once.
4. The sheet fold (`text.photo_count > 0`): a `kit-link` toggle `MUSTER.showSheet` / `MUSTER.hideSheet` and the pages (`alt={MUSTER.sheetAlt(n)}`), exactly the old behaviour.
5. Grimoire mode: `<p class="rule">{MUSTER.grimoireRule}</p>`; then `corruptError` → `kit-note data-tone="eris" role="alert"` with the error + `kit-bronze is-quiet` `MUSTER.backToShelves` (`btn-back-library`, `onToLibrary`); `corrupting` → `kit-ribbon` `MUSTER.corrupting`; else the grand `kit-bronze` `MUSTER.openGrimoire` (`btn-open-grimoire`).
6. Dictation mode: the no-voice `kit-note` (`MUSTER.noVoice`) when `!ttsAvailable()`; `<PaceMedallions bind:pace={playState.pace} {minPace} />`; `<p class="glory">{MUSTER.paceGlory}</p>`; the grand `kit-bronze` « Commencer la dictée »; then, set apart by a thin bronze rule, the grimoire way: `kit-bronze is-quiet` `MUSTER.grimoire` (`btn-grimoire`, navigates as before with `go(href('grimoire', …))`) and its caption `MUSTER.grimoireCaption` in `--ink-soft`.

Every button ≥ 48 px, every text on the parchment `--ink` / `--ink-soft`, no legacy class. The component's `<h2>` is the only heading above `h3` (the pace legend is `kit-section`).

Remove `MusterPhase.svelte` from lane P's side of `battleKit.test.ts`'s and `registerGuard.test.ts`'s `PENDING`.

- [ ] **Step 4: Run**

Run: `scripts/npm.sh run test -- src/battleKit.test.ts src/registerGuard.test.ts src/formPlural.test.ts src/noEmoji.test.ts src/lib/battle` — PASS.
Run: `scripts/npm.sh run check` — `0 errors and 0 warnings`.
Run: `STACK=play scripts/playwright.sh scenes-battle-play --repeat-each=3` — PASS.
Run once: `STACK=play scripts/playwright.sh scan`, `STACK=play scripts/playwright.sh happy-path`, `STACK=play scripts/playwright.sh world` — PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/battle/MusterPhase.svelte web/src/components/battle/PaceMedallions.svelte web/src/battleKit.test.ts web/src/registerGuard.test.ts web/e2e/scenes-battle-play.spec.ts web/e2e/scan.spec.ts
git commit -m "UI4 Task 3: the muster - Éris's taunt, pace medallions, words not grade codes, the prophecy's day, the grimoire way, on the battle parchment

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/components/battle/MusterPhase.svelte web/src/components/PaceSelect.svelte web/src/components/battle/PaceMedallions.svelte web/src/battleKit.test.ts web/src/registerGuard.test.ts web/e2e/scenes-battle-play.spec.ts web/e2e/scan.spec.ts
```

---

### Task 4: The dictation on the stage, and its compact mode under the keyboard (lane P)

**Files:**
- Modify: `web/src/components/battle/DictationPhase.svelte`, `web/src/battleKit.test.ts` (remove it from lane P's `PENDING`)
- Modify: `web/e2e/scenes-battle-play.spec.ts`

**Interfaces:**
- Consumes: `DICTATION`, `react`, the `layout` prop Task 2 already passes from the stage, `createRunner` (unchanged). Lane P never edits `Play.svelte`.
- Produces: test ids kept (`btn-quit-dictation`, `btn-quit-confirm`, `btn-next`, `btn-finish-writing`, `dictation-textarea`); new `dictation-status` (the words), `dictation-controls`, `btn-replay`, `btn-pause`, `btn-resume`.

- [ ] **Step 1: Write the failing e2e** (append to `scenes-battle-play.spec.ts`)

```ts
const LONG = Array.from({ length: 8 }, () => 'Les fées dansent dans la clairière et les oiseaux les écoutent en silence.').join(' ');

async function startDictation(page: Page, testInfo: TestInfo, pace: 1 | 3 = 1) {
  const sheet = page.getByTestId('battle-parchment');
  await tap(sheet.getByTestId(`pace-option-${pace}`), testInfo);
  await tap(sheet.getByRole('button', { name: 'Commencer la dictée' }), testInfo);
  await expectBattle(page, 'dictation');
}

test('the dictation writes on the parchment, in Literata, with bronze controls', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Dic-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Dictée'), body: BODY, level: '10H' });
  await page.goto(`/#/p/${id}/play/${text.id}?encounter=lethe`);
  await expectBattle(page, 'muster');
  await startDictation(page, testInfo);
  const ta = page.getByTestId('dictation-textarea');
  await expect(ta).toBeVisible();
  const font = await ta.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { family: cs.fontFamily, size: parseFloat(cs.fontSize), line: parseFloat(cs.lineHeight) / parseFloat(cs.fontSize) };
  });
  expect(font.family).toContain('Literata');
  expect(font.size).toBeGreaterThanOrEqual(22);
  expect(font.line).toBeGreaterThanOrEqual(1.5);
  await expect(page.getByTestId('btn-next')).toBeEnabled();
  await expect(page.getByTestId('dictation-status')).toHaveText("À toi d'écrire.");
  await expect(page.getByTestId('battle-parchment').locator(LEGACY_UI)).toHaveCount(0);
  await expectOverlayTapTargets(page, 'battle-parchment');
  await expect(page.locator('[data-testid="scene-battle"] [data-testid="stage-hud"] *')).toHaveCount(0);
  expect(await redScan(page)).toEqual([]);
});

// Spec §10: the compact layout with a simulated keyboard. The stage becomes a band above the
// parchment and stays visible; the textarea and every control stay above the keyboard.
test('the keyboard folds the dictation: band above, textarea and controls above the keyboard', async ({ page, request }, testInfo) => {
  await installKeyboardSim(page);
  const id = await createProfileApi(request, uniqueName(`Dic2-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Dictée clavier'), body: LONG, level: '10H' });
  await page.goto(`/#/p/${id}/play/${text.id}?encounter=hydre`);
  await expectBattle(page, 'muster');
  await startDictation(page, testInfo);
  const ta = page.getByTestId('dictation-textarea');
  await tap(ta, testInfo);
  const inner = await page.evaluate(() => window.innerHeight);
  await setKeyboard(page, inner - 420);
  await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-layout', 'compact');
  await expect.poll(async () => (await battleRects(page)).scene?.height ?? 0).toBeLessThanOrEqual(104);
  const r = await battleRects(page);
  const bandBottom = r.scene!.y + r.scene!.height;
  for (const part of ['dragon', 'opponent', 'hp'] as const) {
    const b = r[part]!;
    expect(b.height, `${part} still visible in the band`).toBeGreaterThan(20);
    expect(b.y + b.height, `${part} inside the band`).toBeLessThanOrEqual(bandBottom + 1);
  }
  const box = (await ta.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(bandBottom - 1);
  expect(box.y + box.height).toBeLessThanOrEqual(421);
  expect(box.height).toBeGreaterThanOrEqual(150);
  for (const b of await page.getByTestId('dictation-controls').getByRole('button').all()) {
    const bb = (await b.boundingBox())!;
    expect(bb.height).toBeGreaterThanOrEqual(48);
    expect(bb.y + bb.height).toBeLessThanOrEqual(421);
  }
  await ta.fill(LONG + ' ' + LONG);
  await expect(ta).toBeFocused();
  // The caret line (at the end) stays in view: the textarea scrolled to its bottom.
  expect(await ta.evaluate((el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 2)).toBe(true);
  await setKeyboard(page, 0);
  await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-layout', 'full');
  await expect.poll(async () => (await battleRects(page)).opponent?.height ?? 0).toBeGreaterThan(150);
});

test('a short window folds the dictation too (spec §10: reduced viewport height)', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Dic3-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Dictée courte'), body: BODY, level: '10H' });
  const size = page.viewportSize()!;
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'muster');
  await startDictation(page, testInfo);
  await page.setViewportSize({ width: size.width, height: 440 });
  await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-layout', 'compact');
  const box = (await page.getByTestId('dictation-textarea').boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(441);
  await page.setViewportSize(size);
  await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-layout', 'full');
});

test('Quitter asks first, then shows the resume ribbon with the draft kept', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Dic4-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Dictée quitter'), body: BODY, level: '10H' });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'muster');
  await startDictation(page, testInfo);
  await page.getByTestId('dictation-textarea').fill('Les fées');
  await tap(page.getByTestId('btn-quit-dictation'), testInfo);
  await expect(page.getByText('Ton brouillon est gardé. Veux-tu vraiment quitter la dictée ?')).toBeVisible();
  await tap(page.getByTestId('btn-quit-confirm'), testInfo);
  await expect(page.getByTestId('battle-resume')).toBeVisible();
  await resumeSeeded(page);
  await expect(page.getByTestId('dictation-textarea')).toHaveValue('Les fées');
});

// Ruling C11: a flowing dictation (pace 3) pauses when the iPad turns to portrait, and waits.
test('turning to portrait pauses a flowing dictation until « Reprendre »', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Dic5-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Dictée portrait'), body: LONG, level: '10H' });
  const size = page.viewportSize()!;
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'muster');
  await startDictation(page, testInfo, 3);
  await expect(page.getByTestId('dictation-status')).toHaveText('Écoute…');
  await page.setViewportSize({ width: 820, height: 1180 });
  await expect(page.getByTestId('rotate-screen')).toBeVisible();
  await page.setViewportSize(size);
  await expect(page.getByTestId('dictation-status')).toHaveText('En pause.');
  const spoken = await page.evaluate(() => (window as any).__spoken.length);
  await tap(page.getByTestId('btn-resume'), testInfo);
  await expect.poll(() => page.evaluate(() => (window as any).__spoken.length)).toBeGreaterThan(spoken);
});
```

(Import `Page`, `TestInfo` types from `@playwright/test` at the top of the spec.)

Run: `STACK=play scripts/playwright.sh scenes-battle-play` — FAIL (new test ids, compact bar, portrait pause).

- [ ] **Step 2: `DictationPhase.svelte` restyled**

Keep its script (runner, `onDestroy`, `onInput` autoscroll, quit confirm) and change:
- Copy from `DICTATION` (`statusText` → `DICTATION.status[runnerState.status]`, progress via `DICTATION.sentence/chunk/full`).
- Read the `layout` prop (declared in Task 2).
- Portrait pause (Ruling C11):

```ts
  // Ruling C11: turning the iPad to portrait hides the text behind the rotate screen; a flowing
  // dictation (pace 3-4 never waits for a tap) must not keep reading words she cannot write.
  $effect(() => {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia('(orientation: portrait)');
    const check = () => {
      if (mq.matches && window.innerWidth < window.innerHeight && pace >= 3 && runnerState.status === 'playing') runner.pause();
    };
    check();
    mq.addEventListener('change', check);
    window.addEventListener('resize', check);
    return () => {
      mq.removeEventListener('change', check);
      window.removeEventListener('resize', check);
    };
  });
```

  (Read `runnerState.status` inside `check` through a plain variable mirror, or `untrack`, so the effect does not re-subscribe on every status change.)
- « Reprendre » (`btn-resume`) shows whenever `runnerState.status === 'paused'`, for every pace; « Pause » (`btn-pause`) only for paces 3–4 while playing (as today); « Réécouter » (`btn-replay`, with `(n)` at pace 2) and « Suivant » (`btn-next`) for paces 1–2.
- A finished writing (`finish()`) calls `react('dragon', 'cheer')` before `onFinish()`.
- Markup: a header row (`kit-bronze is-quiet` « Quitter » with the arrow icon; `<h2 class="phase-title">` « Dictée » in Cinzel; the progress in `--ink-soft`), the confirm as a `kit-note` with `kit-bronze` « Oui, quitter » / `kit-bronze is-quiet` « Continuer la dictée », a status row (`<span class="seal" data-status>` – the old dot restyled as a small gold/bronze seal that pulses while playing, no animation under reduced motion – and `<span data-testid="dictation-status">`), the controls row `data-testid="dictation-controls"` (`kit-bronze`, ≥ 48 px; « J'ai fini d'écrire » is the gold call to action at the row's end), and the textarea filling the rest.
- Textarea: `font: 400 clamp(22px, 1.9vw, 26px)/1.7 var(--font-reading)`, `color: var(--ink)`, `background: var(--battle-text-bg)` with faint ruled lines (`background-image: repeating-linear-gradient(transparent 0 calc(1.7em - 1px), rgba(138, 90, 40, 0.14) calc(1.7em - 1px) 1.7em)`, `background-attachment: local`), `border: 1px solid var(--parchment-edge)`, `border-radius: 10px`, `padding: 14px 18px`, `resize: none`, `flex: 1; min-height: 0`. Keep every attribute (`lang`, `autocorrect`, `autocapitalize`, `autocomplete`, `spellcheck`, placeholder `DICTATION.placeholder`).
- Compact (`layout === 'compact'`): one bar under the band — « Quitter » as a 48 px icon button (`aria-label="Quitter"`), the progress, the controls, « J'ai fini d'écrire » — and the textarea below; the `h2` and the status row become `sr-only` (the status stays announced: give the status span `aria-live="polite"` in both layouts).
- The column: `.dictation { display: flex; flex-direction: column; gap: 10px; height: 100%; padding: 14px 18px; }`.

Remove `DictationPhase.svelte` from lane P's `PENDING` in `battleKit.test.ts`.

- [ ] **Step 3: Run**

Run: `scripts/npm.sh run test -- src/battleKit.test.ts src/lib/battle src/lib/dictation` — PASS.
Run: `scripts/npm.sh run check` — `0 errors and 0 warnings`.
Run: `STACK=play scripts/playwright.sh scenes-battle-play --repeat-each=3` — PASS on `desktop` and `ipad`.
Run once: `STACK=play scripts/playwright.sh happy-path`, `STACK=play scripts/playwright.sh world` — PASS (the world spec's fast-timer dictation drives `btn-next`/`btn-finish-writing`).

- [ ] **Step 4: Commit**

```bash
git add web/src/components/battle/DictationPhase.svelte web/src/battleKit.test.ts web/e2e/scenes-battle-play.spec.ts
git commit -m "UI4 Task 4: the dictation on the battle parchment - Literata on ruled parchment, bronze controls, compact bar under the keyboard, portrait pause

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/components/battle/DictationPhase.svelte web/src/battleKit.test.ts web/e2e/scenes-battle-play.spec.ts
```

---

### Task 5: The proofreading on the stage — legibility first, compact editing, neutral reactions, a way out (lane P)

**Files:**
- Modify: `web/src/components/battle/ProofPhase.svelte`, `web/src/components/battle/TokenText.svelte`, `web/src/components/battle/WordEditor.svelte`, `web/src/styles/kit-objects.css` (an aegean note tone, if missing), `web/src/battleKit.test.ts`, `web/src/registerGuard.test.ts` (lane P's `PENDING` empty)
- Modify: `web/e2e/scenes-battle-play.spec.ts`

**Interfaces:**
- Consumes: `PROOF`, `TOOL_ICONS`, `ARGUS_LABELS`, `react`, `emitBattle`, the `layout` and `onQuit` props Task 2 already passes, everything `Proofreading` used (unchanged logic).
- Produces: test ids kept (`btn-next-pass`, `btn-fil`, `fil-message`, `fil-next`, `btn-fil-exit`, `tok-N`, `word-editor`, `btn-done-proofreading`); new `proof-text` (the text zone), `proof-tools`, `proof-foot`, `btn-bouclier`, `btn-chouette`, `btn-whole`, `chouette-note`, `btn-quit-proof`, `btn-quit-proof-confirm`, `argus-pass-<pass>`.

- [ ] **Step 1: Write the failing e2e** (append to `scenes-battle-play.spec.ts`)

```ts
// ~300 words: a long proofreading text (legibility beats décor, spec §5).
const SENTENCES = [
  'Les fées dansent dans la clairière pendant que la lune se lève.',
  'Elles chantent doucement et les oiseaux les écoutent sans bruit.',
  'Le vent emporte leurs chansons jusqu’au village endormi.',
  'Les enfants sortent de leurs maisons, émerveillés par la musique.',
  'La nuit est douce et les étoiles brillent au-dessus des arbres.',
];
const LONG_REF = Array.from({ length: 24 }, (_, i) => SENTENCES[i % SENTENCES.length]).join(' ');
const LONG_DRAFT = LONG_REF.replace('Les fées dansent', 'Les fées danse').replace(/La nuit est douce(?![\s\S]*La nuit est douce)/, 'La nuit et douce');

async function seededProof(page: Page, request: APIRequestContext, testInfo: TestInfo, help: 1 | 2 | 3 | 4) {
  const id = await createProfileApi(request, uniqueName(`Pro-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Relecture longue'), body: LONG_REF, level: '10H' });
  await seedPlay(page, { profileId: id, textId: text.id, phase: 'proofreading', draft: LONG_DRAFT, opponent: 'chimere' });
  await page.goto(`/#/p/${id}/play/${text.id}?help=${help}`);
  await expectBattle(page, 'muster');
  await resumeSeeded(page);
  await expectBattle(page, 'proofreading');
  return { id, text };
}

test('a long proofreading text reads comfortably: size, measure, height, an opaque page, a quiet stage', async ({ page, request }, testInfo) => {
  await seededProof(page, request, testInfo, 4);
  const zone = page.getByTestId('proof-text');
  const m = await zone.evaluate((el) => {
    const p = el.querySelector('.tokens') as HTMLElement;
    const cs = getComputedStyle(p);
    const size = parseFloat(cs.fontSize);
    return {
      family: cs.fontFamily,
      size,
      line: parseFloat(cs.lineHeight) / size,
      measure: p.getBoundingClientRect().width / size,
      height: el.getBoundingClientRect().height / window.innerHeight,
      bg: getComputedStyle(el).backgroundColor,
    };
  });
  expect(m.family).toContain('Literata');
  expect(m.size).toBeGreaterThanOrEqual(22);
  expect(m.line).toBeGreaterThanOrEqual(1.8);
  expect(m.measure, 'column width in font sizes (~44-72 characters)').toBeGreaterThanOrEqual(22);
  expect(m.measure).toBeLessThanOrEqual(36);
  expect(m.height, 'the text zone takes most of the screen').toBeGreaterThanOrEqual(0.55);
  const alpha = Number(/rgba?\([^)]*?,\s*([\d.]+)\)$/.exec(m.bg)?.[1] ?? '1');
  expect(alpha).toBeGreaterThanOrEqual(0.94);
  await expect(page.locator('.battle-backdrop')).toHaveCSS('filter', /brightness\(0\.7\)/);
  await expect.poll(() => page.getByTestId('battle-opponent').evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
  await expect(page.locator('[data-testid="scene-battle"] [data-testid="fx-canvas"]')).toHaveCount(0);
  await expect(page.getByTestId('battle-parchment').locator(LEGACY_UI)).toHaveCount(0);
  // The words of the text are inline targets (see Global Constraints, Accessibility): the 48 px
  // sweep covers the tools and the footer, not the tokens.
  await expectOverlayTapTargets(page, 'proof-tools');
  await expectOverlayTapTargets(page, 'proof-foot');
  expect(await redScan(page)).toEqual([]);
});

test('the Argus passes and the four tools work from their painted controls; the hold never grades', async ({ page, request }, testInfo) => {
  await seededProof(page, request, testInfo, 1);
  const hp = page.getByTestId('battle-hp');
  await expect(hp).toHaveAttribute('aria-valuenow', '100');
  await expect(page.getByTestId('argus-pass-verbes')).toHaveAttribute('aria-pressed', 'true');
  await tap(page.getByTestId('btn-next-pass'), testInfo);
  await expect(page.getByTestId('argus-pass-verbes')).not.toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('battle-dragon')).toHaveAttribute('data-reaction', 'cheer');
  await tap(page.getByTestId('btn-chouette'), testInfo);
  await expect(page.getByTestId('chouette-note')).toContainText(/chouette|manque/i);
  await expect(page.getByTestId('battle-opponent')).toHaveAttribute('data-reaction', 'flinch');
  await tap(page.getByTestId('btn-bouclier'), testInfo);
  await expect(page.getByTestId('btn-bouclier')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText(/Phrase \d+ sur \d+, en partant de la fin/)).toBeVisible();
  await tap(page.getByTestId('btn-bouclier'), testInfo);
  // An edit that fixes a trap moves nothing on the stage (Ruling C3).
  await tap(page.locator('[data-testid^="tok-"]', { hasText: /^danse$/ }).first(), testInfo);
  await page.getByTestId('word-editor').fill('dansent');
  await page.getByTestId('word-editor').press('Enter');
  await expect(page.locator('[data-testid^="tok-"]', { hasText: /^dansent$/ }).first()).toBeVisible();
  await expect(hp).toHaveAttribute('aria-valuenow', '100');
});

test('help stage 3 notches the hold with the count it already shows', async ({ page, request }, testInfo) => {
  await seededProof(page, request, testInfo, 3);
  await expect(page.getByText('2 pièges sont cachés dans ce texte.')).toBeVisible();
  await expect(page.getByTestId('battle-hp')).toHaveAttribute('data-segments', '2');
});

// Spec §10: editing a word near the end of a long text with the keyboard open.
test('the keyboard folds the proofreading: the word editor stays above it, the band stays visible', async ({ page, request }, testInfo) => {
  await installKeyboardSim(page);
  await seededProof(page, request, testInfo, 4);
  const tokens = page.locator('[data-testid^="tok-"]');
  const last = tokens.nth((await tokens.count()) - 4);
  await last.scrollIntoViewIfNeeded();
  await tap(last, testInfo);
  const editor = page.getByTestId('word-editor');
  await expect(editor).toBeFocused();
  const inner = await page.evaluate(() => window.innerHeight);
  await setKeyboard(page, inner - 420);
  await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-layout', 'compact');
  const r = await battleRects(page);
  const bandBottom = r.scene!.y + r.scene!.height;
  expect(r.opponent!.height).toBeGreaterThan(20);
  await expect
    .poll(async () => {
      const b = (await editor.boundingBox())!;
      return b.y >= bandBottom - 1 && b.y + b.height <= 421;
    })
    .toBe(true);
  await editor.fill('arbres');
  await editor.press('Enter');
  await expect(editor).toHaveCount(0);
  await setKeyboard(page, 0);
  await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-layout', 'full');
});

test('« Modifier tout le texte » folds under the keyboard too', async ({ page, request }, testInfo) => {
  await installKeyboardSim(page);
  await seededProof(page, request, testInfo, 4);
  await tap(page.getByTestId('btn-whole'), testInfo);
  const ta = page.getByLabel('Tout le texte');
  await tap(ta, testInfo);
  const inner = await page.evaluate(() => window.innerHeight);
  await setKeyboard(page, inner - 420);
  await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-layout', 'compact');
  const b = (await ta.boundingBox())!;
  expect(b.y + b.height).toBeLessThanOrEqual(421);
  expect(b.height).toBeGreaterThanOrEqual(150);
});

test('the proofreading has a way out: Quitter asks, then the resume ribbon keeps everything', async ({ page, request }, testInfo) => {
  await seededProof(page, request, testInfo, 4);
  await tap(page.getByTestId('btn-quit-proof'), testInfo);
  await expect(page.getByText('Ta relecture est gardée. Veux-tu vraiment quitter ?')).toBeVisible();
  await tap(page.getByTestId('btn-quit-proof-confirm'), testInfo);
  await expect(page.getByTestId('battle-resume')).toBeVisible();
  await resumeSeeded(page);
  await expectBattle(page, 'proofreading');
});
```

(Import `APIRequestContext` too. `LONG_DRAFT` plants two errors — « danse », « et » — so stage 3 shows 2; if the grader counts differently for this text, derive the expected number from the stage sentence rather than hard-coding, but keep the `data-segments` equality with it.)

Run: `STACK=play scripts/playwright.sh scenes-battle-play` — FAIL.

- [ ] **Step 2: `ProofPhase.svelte` restyled**

The script's logic is untouched (grade, passes, Fil, Bouclier, Chouette, editing, done, autosave, stage-3 freeze). Additions:
- Read the `layout` and `onQuit` props (declared and wired in Task 2); render « Quitter » now. A `confirmQuit` state: « Quitter » (`btn-quit-proof`) → `kit-note` `PROOF.quitAsk` with `kit-bronze` « Oui, quitter » (`btn-quit-proof-confirm`, calls `onQuit`) and `kit-bronze is-quiet` `PROOF.confirmNo`; opening it closes `confirmDone` and vice versa.
- Reactions (Ruling C3): `useChouette()` → after a hint is revealed, `react('opponent', 'flinch')` and `emitBattle({ kind: 'tool', tool: 'chouette' })`; `goToPass(i)` with `i > play.passIndex` → `react('dragon', 'cheer')` and `emitBattle({ kind: 'tool', tool: 'argus' })`; `toggleBouclier`, `toggleFil`, `toggleWholeText` → `emitBattle({ kind: 'tool', tool: … })` only (no reaction). An edit never reacts.
- Copy from `PROOF` (stage sentences, labels, confirm, Fil lines, sentence position).

Markup (full layout), top to bottom in a flex column filling the parchment (`height: 100%; padding: 12px 18px; gap: 8px`):
1. Header row: `kit-bronze is-quiet` « Quitter » (arrow icon), `<h2 class="phase-title">` (`PROOF.title` / `PROOF.grimoireTitle`), and under it the stage sentence (`--ink-soft`, 16 px).
2. Argus strip (help stages 1–2): the painted Argus mark (`TOOL_ICONS.argus`, 34 px) then one bronze plaque per pass (`<button class="kit-bronze is-quiet pass" data-testid="argus-pass-{pass}" aria-pressed>`: done passes carry the check icon and read quieter, the active one is gold-rimmed), « Passe suivante » (`btn-next-pass`, arrow icon) at the end; the pass hint below in `--aegean-ink`, 16 px, weight 600. `role="group" aria-label={PROOF.passes}`.
3. Tools row `data-testid="proof-tools"`: four emblem buttons (`kit-bronze is-quiet tool`, 48 px min height, a 28 px painted icon then the label): `btn-bouclier` (`TOOL_ICONS.persee`, `PROOF.bouclier`, `aria-pressed`), `btn-chouette` (`TOOL_ICONS.athena`, `PROOF.chouette(hintsLeft)`, only while `helpStage < 4 && hintsLeft > 0`), `btn-fil` (`TOOL_ICONS.ariane`, `PROOF.fil`, `aria-pressed`), `btn-whole` (the pencil `Icon`, `PROOF.whole`, `aria-pressed`).
4. Notes: the Fil panel as `kit-note` (aegean tone: add `data-tone="aegean"` to `kit-objects.css`'s `.kit-note` if it has none — `border-left-color: var(--aegean); background: rgba(221, 234, 242, 0.92)`) with `fil-message`, `fil-next`, and `kit-bronze is-quiet` « Quitter le fil » (`btn-fil-exit`); the Chouette's message as `kit-note` with the owl's painted icon (`data-testid="chouette-note"`, `role="status"`); the Bouclier nav (`kit-bronze is-quiet` « Phrase précédente » / « Phrase suivante », the position `PROOF.sentencePos(...)` between them).
5. The text zone `data-testid="proof-text"`: `flex: 1; min-height: 0; overflow: auto; -webkit-overflow-scrolling: touch; background: var(--battle-text-bg); border: 1px solid var(--parchment-edge); border-radius: 10px; padding: 16px 22px;` holding the `TokenText` (or the whole-text textarea, `aria-label={PROOF.wholeLabel}`, same font as the tokens). The tokens' column: `max-width: 34em; margin-inline: auto` in full layout, `max-width: none` in compact.
6. Footer (`data-testid="proof-foot"`): « J'ai terminé ma relecture » (`btn-done-proofreading`, the gold `kit-bronze` call to action, `max-width: 480px`) or the confirm (`PROOF.confirmAsk`, « Oui, valider » / « Continuer la relecture »).

Compact layout (`layout === 'compact'`): the header, the Argus strip, the tools row, the notes (except the Chouette note if just used) and the footer are hidden (`display: none`, not unmounted, so their state survives); the text zone takes the whole parchment below the band. The word editor is the only control there, which is what she needs while typing. Keep the resize `scrollIntoView` of the edited word (Task 2 left it in place) so the editor lands above the keyboard.

`TokenText.svelte`: font `clamp(22px, 1.9vw, 26px)` Literata, line height 1.9, `color: var(--ink)`; `.tok.lit` stays `--aegean-light` / `--aegean-ink`; `.tok.hint` keeps orange-light with the orange underline (Éris's colour marks her trap); `.tok.fil-verb` outline `--aegean`; `.tok.fil-subject` underline `--gold`; the focus ring `--gold-light`; aria labels from `PROOF.tokenEdit` / `PROOF.tokenFil`.

`WordEditor.svelte`: the input in Literata at the token's size with a `--gold` 2 px border on `--battle-text-bg`, « OK » as a `kit-bronze` 48 px button, the hint `PROOF.editorHint` in `--ink-soft` 13 px; its behaviour (Enter/OK/blur commit once, Escape cancels, focus + select + scroll on mount) unchanged. `aria-label={PROOF.editorLabel}`.

Remove `ProofPhase.svelte` and `WordEditor.svelte` from lane P's side of `battleKit.test.ts`'s `PENDING` (lane P's side is now empty), and any lane P file left in `registerGuard.test.ts`'s `PENDING`. Keep the fence comment line.

- [ ] **Step 3: Run**

Run: `scripts/npm.sh run test -- src/battleKit.test.ts src/registerGuard.test.ts src/lib/battle src/lib/fil.test.ts src/lib/argus.test.ts src/styles` — PASS.
Run: `scripts/npm.sh run check` — `0 errors and 0 warnings`.
Run: `STACK=play scripts/playwright.sh scenes-battle-play --repeat-each=3` — PASS on both projects.
Run once: `STACK=play scripts/playwright.sh grimoire`, `STACK=play scripts/playwright.sh happy-path`, `STACK=play scripts/playwright.sh world` — PASS.
Run: `STACK=play PW_WORKERS=4 scripts/check.sh` — `== ALL GREEN` (lane P's gate; paste the counts).

- [ ] **Step 4: Commit**

```bash
git add web/src/components/battle/ProofPhase.svelte web/src/components/battle/TokenText.svelte web/src/components/battle/WordEditor.svelte web/src/battleKit.test.ts web/src/registerGuard.test.ts web/src/styles/kit-objects.css web/e2e/scenes-battle-play.spec.ts
git commit -m "UI4 Task 5: the proofreading on the battle parchment - legibility first, painted Argus and tools, compact editing under the keyboard, neutral reactions, a way out

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/components/battle/ProofPhase.svelte web/src/components/battle/TokenText.svelte web/src/components/battle/WordEditor.svelte web/src/battleKit.test.ts web/src/registerGuard.test.ts web/src/styles/kit-objects.css web/e2e/scenes-battle-play.spec.ts
```

(Leave `kit-objects.css` out of both lists if the aegean note tone already existed.)

---

### Task 6: The victory — the reckoning, the victory sheet, the spoils, the dragon's words, the « Revoir » scroll (lane V)

**Files:**
- Modify: `web/src/components/battle/VictoryPhase.svelte`
- Create: `web/src/components/battle/VictorySheet.svelte`, `web/src/components/battle/LaurelWreath.svelte`
- Move: `git mv web/src/components/ProgressionReveal.svelte web/src/components/battle/VictorySpoils.svelte`; `git mv web/src/components/Results.svelte web/src/components/battle/ReviewScroll.svelte`; `git mv web/src/components/BreakNudge.svelte web/src/components/battle/DragonNudge.svelte` (then restyle each)
- Modify: `web/src/components/scene/DialogueBox.svelte` (the `dock` prop), `web/src/components/places/headings.test.ts` (the scroll's headings), `web/src/battleKit.test.ts`, `web/src/registerGuard.test.ts` (remove `VictoryPhase.svelte` from lane V's side)
- Create: `web/e2e/scenes-battle-victory.spec.ts`
- Modify: `web/e2e/happy-path.spec.ts` (the results heading and the final text now live in the sheet and the scroll)

**Interfaces:**
- Consumes: Task 2's `VictoryPhase` contract (including `encounter`, `reviewOpen`, `onReview`, `onCloseReview`, `revealDone` bindable), `reckoningSteps`, `outcomeOf`, `strike`, `setHp`, `react`, `battleStage`, `emitBattle`, `VICTORY`, `victoryTitle`, `dragonTally`, `DRAGON_REVIEW_HINT`, `erisLine`, `explain`, `caughtText`, `CATEGORY_LABELS`, `erisSays`, `dragonSays`, `DialogueBox`, `Overlay`, `LaurelBar`, `Medallion`, `Particles`, `Dragon`, `playClock`, `clockReset`, `reducedMotion`.
- Produces: `DialogueBox` prop `dock?: 'art' | 'fill'`; test ids kept (`results-catch-rate`, `results-score`, `results-threads`, `btn-back-camp`, `reveal-*`, `break-nudge`, `break-pause`, `break-continue`); new `victory`, `victory-title`, `victory-laurel`, `victory-xp`, `battle-revoir`, `victory-actions`, `victory-dialogue`, `overlay-revoir`, `revoir-popover`.

- [ ] **Step 1: Write the failing e2e**

`web/e2e/scenes-battle-victory.spec.ts` (lane V's spec; Task 7 appends to it):

```ts
import { test, expect } from './crashGuard';
import {
  closeOverlay,
  createProfileApi,
  createText,
  expectBattle,
  expectCamp,
  expectOverlayClearsScene,
  expectOverlayTapTargets,
  LEGACY_UI,
  redScan,
  seedPlay,
  stubSpeech,
  tap,
  uniqueName,
} from './helpers';

// UI4 lane V (spec §3 "Results -> Victory overlay", §5): the reckoning on the stage, the victory
// sheet (laurels, XP, the dragon's words), « Revoir », the break nudge, and Éris's lair.
const REF = 'Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.';
const DRAFT = 'Les fées danse dans la clairière. Elles chante et les oiseaux les écoutent.';
const HALF = 'Les fées dansent dans la clairière. Elles chante et les oiseaux les écoutent.';

test.beforeEach(async ({ page }) => stubSpeech(page));

async function victory(page: import('@playwright/test').Page, request: import('@playwright/test').APIRequestContext, name: string, current: string, opponent = 'hydre') {
  const id = await createProfileApi(request, uniqueName(name));
  const text = await createText(request, { title: uniqueName('Victoire'), body: REF, level: '10H' });
  await seedPlay(page, { profileId: id, textId: text.id, phase: 'results', draft: DRAFT, current, opponent });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'victory');
  return { id, text };
}

test('the reckoning strikes once per trap caught, then the lieutenant falls back', async ({ page, request }, testInfo) => {
  await victory(page, request, `Vic-${testInfo.project.name}`, HALF);
  await expect(page.getByTestId('battle-hp')).toHaveAttribute('aria-valuenow', '50');
  await expect(page.getByTestId('battle-opponent')).toHaveAttribute('data-hits', '1');
  await expect(page.getByTestId('battle-opponent')).toHaveAttribute('data-reaction', 'retreat');
  await expect(page.getByTestId('battle-dragon')).toHaveAttribute('data-reaction', 'cheer');
  await expect(page.getByTestId('victory-title')).toHaveText("L'Hydre recule !");
  await expect(page.getByTestId('victory-laurel')).toBeVisible();
  await expect(page.getByTestId('results-catch-rate')).toContainText('1 sur 2');
  expect(await page.getByTestId('results-catch-rate').textContent()).toContain('50 %');
});

test('the sheet: spoils, then « Continuer » lets Éris and the dragon speak; the actions are there throughout', async ({ page, request }, testInfo) => {
  await victory(page, request, `Vic2-${testInfo.project.name}`, HALF);
  const sheet = page.getByTestId('victory');
  await expect(sheet.getByTestId('reveal-xp')).toBeVisible();
  await expect(sheet.getByTestId('victory-xp')).toHaveAttribute('role', 'progressbar');
  await expect(sheet.getByTestId('victory-actions').getByTestId('btn-back-camp')).toBeVisible();
  await expect(sheet.locator(LEGACY_UI)).toHaveCount(0);
  await expectOverlayTapTargets(page, 'battle-parchment');
  expect(await redScan(page)).toEqual([]);
  await tap(sheet.getByTestId('reveal-continue'), testInfo);
  await expect(sheet.getByTestId('reveal-xp')).toHaveCount(0);
  const box = page.getByTestId('dialogue-box');
  await expect(box).toContainText('Éris');
  await page.getByTestId('dialogue-advance').click(); // finish typing
  await page.getByTestId('dialogue-advance').click(); // next line
  await expect(page.getByTestId('dialogue-text')).toContainText('Tu as déjoué 1 piège sur 2.');
});

test('« Revoir » opens the review scroll: each trap explained on tap; Back and reload keep it honest', async ({ page, request }, testInfo) => {
  await victory(page, request, `Vic3-${testInfo.project.name}`, HALF);
  await tap(page.getByTestId('battle-revoir'), testInfo);
  await expect(page).toHaveURL(/panel=revoir/);
  // expectInWorldOverlay's parts, minus its 48 px sweep: the scroll's words are inline targets.
  const scroll = page.getByTestId('overlay-revoir');
  await expect(scroll).toHaveAttribute('data-variant', 'scroll');
  await expectOverlayClearsScene(page, 'overlay-revoir', 'battle', true);
  await expect(scroll.locator(LEGACY_UI)).toHaveCount(0);
  await expect(scroll.getByTestId('overlay-voice')).toHaveCount(0);
  await expect(scroll.getByTestId('overlay-close')).toBeVisible();
  expect(await redScan(page)).toEqual([]);
  await expect(scroll.getByRole('heading', { name: "Ce qu'Éris a tenté" })).toBeVisible();
  await tap(scroll.getByRole('button', { name: 'chante', exact: true }), testInfo);
  await expect(scroll.getByTestId('revoir-popover')).toContainText('Attendu : « chantent »');
  await page.reload();
  await expect(page.getByTestId('overlay-revoir')).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId('overlay-revoir')).toHaveCount(0);
  await expect(page).not.toHaveURL(/panel=revoir/);
  await tap(page.getByTestId('battle-revoir'), testInfo);
  await closeOverlay(page);
  await expect(page.getByTestId('battle-revoir')).toBeFocused();
});

test('every trap caught routs the lieutenant; a perfect dictation too', async ({ page, request }, testInfo) => {
  await victory(page, request, `Vic4-${testInfo.project.name}`, REF);
  await expect(page.getByTestId('victory-title')).toHaveText('Victoire !');
  await expect(page.getByTestId('battle-hp')).toHaveAttribute('aria-valuenow', '0');
  await expect(page.getByTestId('battle-opponent')).toHaveAttribute('data-reaction', 'defeat');
});

test('nothing caught: still standing, still laurels, never a loss', async ({ page, request }, testInfo) => {
  await victory(page, request, `Vic5-${testInfo.project.name}`, DRAFT, 'sirenes');
  await expect(page.getByTestId('victory-title')).toHaveText('Le combat continue');
  await expect(page.getByTestId('battle-hp')).toHaveAttribute('aria-valuenow', '100');
  await expect(page.getByTestId('battle-opponent')).toHaveAttribute('data-reaction', 'taunt');
  await expect(page.getByTestId('victory-laurel')).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/manqué|raté|perdu/i);
});

test('reduced motion: the hold and the laurels land at once', async ({ page, request }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await victory(page, request, `Vic6-${testInfo.project.name}`, HALF);
  await expect(page.getByTestId('battle-hp')).toHaveAttribute('aria-valuenow', '50');
  await expect.poll(() => page.getByTestId('victory-laurel').evaluate((el) => el.getAnimations({ subtree: true }).filter((a) => a.playState === 'running').length)).toBe(0);
});

test('a failed submission can be sent again from the sheet', async ({ page, request }, testInfo) => {
  let failed = false;
  await page.route('**/api/sessions', async (route) => {
    if (!failed && route.request().method() === 'POST') {
      failed = true;
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Serveur fatigué' }) });
    } else await route.continue();
  });
  await victory(page, request, `Vic7-${testInfo.project.name}`, HALF);
  await expect(page.getByTestId('victory')).toContainText("Les Muses n'ont pas pu noter cette partie (Serveur fatigué).");
  await tap(page.getByRole('button', { name: 'Réessayer' }), testInfo);
  await expect(page.getByTestId('reveal-xp')).toBeVisible();
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

test('after twenty-five minutes the dragon suggests a pause, on the sheet', async ({ page, request }, testInfo) => {
  await page.addInitScript(
    (seed) => sessionStorage.setItem(seed.key, seed.value),
    { key: 'discorde.playClock', value: JSON.stringify({ activeMs: 26 * 60000, running: false, lastTick: null, lastStop: Date.now() }) },
  );
  await victory(page, request, `Vic8-${testInfo.project.name}`, HALF);
  const nudge = page.getByTestId('break-nudge');
  await expect(nudge).toContainText("ça fait vingt-cinq minutes qu'on chasse les pièges");
  await tap(page.getByTestId('break-continue'), testInfo);
  await expect(nudge).toHaveCount(0);
  await tap(page.getByTestId('btn-back-camp'), testInfo);
  await expectCamp(page);
});
```

(The Chimère/Sirènes/Hydre names come from the seeded `opponent`; the play clock seed is `world.spec.ts`'s. If the victory's own XP makes the fresh hero's egg hatch and the spoils ask for a name, nothing here depends on it.)

`web/e2e/happy-path.spec.ts`: replace `await expect(page.getByRole('heading', { name: 'Relecture terminée' })).toBeVisible();` by `await expect(page.getByTestId('victory-title')).toBeVisible();`, and `await expect(page.getByText(/chantent/).first()).toBeVisible();` by opening the scroll:

```ts
  await page.getByTestId('battle-revoir').click();
  await expect(page.getByTestId('overlay-revoir').getByText(/chantent/).first()).toBeVisible();
  await closeOverlay(page);
```

Run: `STACK=victory scripts/playwright.sh scenes-battle-victory` — FAIL.

- [ ] **Step 2: `DialogueBox` gets a dock**

```ts
  let { lines, onDone, dock = 'art' }: { lines: DialogueLine[]; onDone: () => void; dock?: 'art' | 'fill' } = $props();
```

and on the root: `class:fill={dock === 'fill'}`, `style={dock === 'art' ? \`left:${DIALOGUE_DOCK.x}%;width:${DIALOGUE_DOCK.w}%;max-height:${DIALOGUE_DOCK.h - 2}%\` : undefined}`, with

```css
  .dialogue.fill {
    position: relative;
    bottom: auto;
    left: auto;
    width: 100%;
  }
```

Every place keeps the default (`'art'`); run the place specs that show a dialogue once (below).

- [ ] **Step 3: The reckoning and the sheet (`VictoryPhase.svelte`)**

```ts
  // UI4 Ruling C3: the reckoning. The hold drops one strike per trap caught (client-side result, so
  // it never waits for the server), then the opponent is routed, pushed back or still standing.
  // For a boss fight the final pose waits for the server's verdict (progression.boss).
  const draft = $derived(result?.draftErrors.length ?? 0);
  const caught = $derived(result?.caught.length ?? 0);
  const bossFight = $derived(encounter === 'eris');
  const verdictReady = $derived(!bossFight || !!playState.progression || !!submitError);
  const outcome = $derived(outcomeOf({ draft, caught }, playState.progression?.boss ?? null));
  let struck = $state(false);

  $effect(() => {
    if (!result) return;
    return untrack(() => {
      const steps = reckoningSteps(draft, caught);
      if (reducedMotion()) {
        if (steps.length) strike(steps.at(-1)!);
        struck = true;
        return;
      }
      const timers = steps.map((v, i) => setTimeout(() => strike(v), 500 + i * 380));
      timers.push(setTimeout(() => (struck = true), 500 + steps.length * 380 + 150));
      return () => timers.forEach(clearTimeout);
    });
  });

  $effect(() => {
    if (!struck || !verdictReady) return;
    const o = outcome;
    untrack(() => {
      react('opponent', o === 'rout' ? 'defeat' : o === 'push' ? 'retreat' : 'taunt');
      react('dragon', o === 'standoff' ? 'brace' : 'cheer');
      emitBattle({ kind: 'outcome', outcome: o, caught, missed: Math.max(0, draft - caught) });
    });
  });
```

(`strike` is the stage store's; the `$effect` keyed on `result` runs once per mounted victory: Play remounts `VictoryPhase` on a replay, so a new battle reckons again.)

`VictoryPhase` renders, inside the parchment:
- `{#if playClock.needsBreak}<DragonNudge dragon={camp?.dragon ?? null} onPause={onCamp} onContinue={() => clockReset()} />{/if}` at the top.
- `<VictorySheet …>` with: `title = victoryTitle(outcome, opponent)` (shown once `struck`; before, the title reads the opponent's name alone so nothing jumps), the tally lines, the pending ribbon (`VICTORY.counting`) while `submitting || (!playState.submitted && !submitError)`, the submit error (`kit-note data-tone="eris" role="alert"`, `VICTORY.submitError(submitError)` + `kit-bronze` « Réessayer » / « Envoi en cours… », disabled while `submitting`), the spoils while `playState.progression && !revealDone`, the dialogue once `revealDone` or once there is no progression to show and nothing is pending, and the actions whenever nothing is pending.
- `{#if reviewOpen && result}<ReviewScroll … onClose={onCloseReview} />{/if}`.

`VictorySheet.svelte` (a `kit-scroll`, top to bottom, scrolling inside the parchment with the actions pinned at its foot):

```svelte
<article class="victory kit-scroll" data-testid="victory">
  <header class="crown">
    <LaurelWreath {reduced} />
    <h2 class="victory-title" data-testid="victory-title">{title}</h2>
  </header>
  <div class="tally">
    <p class="tally-line" data-testid="results-catch-rate">{draft === 0 ? VICTORY.perfect : VICTORY.caught(caught, draft, rate, mode)}</p>
    <p class="tally-small" data-testid="results-score">{VICTORY.score(result.score)}</p>
    <p class="tally-small">{VICTORY.words(result.correctWords, result.totalWords)}</p>
    {#if result.tools && result.tools.threadsDrawn > 0}<p class="tally-small" data-testid="results-threads">{VICTORY.threads(result.tools.threadsCorrect, result.tools.threadsDrawn)}</p>{/if}
    {#if introduced > 0}<p class="tally-note">{VICTORY.introduced(introduced)}</p>{/if}
  </div>
  {@render status?.()}
  {@render spoils?.()}
  {@render dialogue?.()}
  <footer class="actions" data-testid="victory-actions">
    <button type="button" class="kit-bronze" data-testid="battle-revoir" onclick={onReview}>{VICTORY.review}</button>
    <button type="button" class="kit-bronze is-quiet" onclick={onReplay}>{VICTORY.replay}</button>
    <button type="button" class="kit-bronze is-quiet" data-testid="btn-back-camp" onclick={onCamp}>{VICTORY.camp}</button>
  </footer>
</article>
```

(Props and snippets as that markup reads them; `rate = draft > 0 ? caught / draft : null`, `introduced = result.introduced.length`. The actions render only when nothing is pending: pass a `showActions` boolean. `.victory-title` is Cinzel 30 px `--reward-ink`; the tally line Alegreya 20 px weight 600; the small lines 16 px `--ink-soft`.)

The dialogue snippet: `<div class="victory-dialogue" data-testid="victory-dialogue"><DialogueBox dock="fill" lines={victoryLines} onDone={() => (talked = true)} /></div>` with

```ts
  const speaker = $derived(camp?.dragon ?? ({ name: null, stage: 'egg', tint: 'bronze' } as DragonOut));
  const victoryLines = $derived.by(() => {
    if (!result) return [];
    const introduced = result.introduced.length;
    const lines = [erisSays(erisLine(result.catchRate, draft, introduced, mode)), dragonSays(speaker, dragonTally({ draft, caught, mode }))];
    if (helpMessage) lines.push(dragonSays(speaker, helpMessage));
    if (draft + introduced > 0) lines.push(dragonSays(speaker, DRAGON_REVIEW_HINT));
    return lines;
  });
```

(Once `talked`, the box closes; the actions stay. The dialogue is built once per victory: snapshot `victoryLines` with `untrack` when it first renders, so a late `helpMessage` does not restart the typewriter.)

- [ ] **Step 4: `LaurelWreath.svelte`**

```svelte
<script lang="ts">
  // The victory's laurel wreath (spec §3 "chest/laurel animation", UI4 Ruling C6): two branches of
  // gold leaves growing in around the title, inline SVG (no emoji, no new art). Reduced motion:
  // the wreath is simply there.
  let { reduced = false, size = 200 }: { reduced?: boolean; size?: number } = $props();
  const LEAVES = 8;
  // Angles from the bottom of the circle (180°) up each side to 25° off the top.
  const leaves = Array.from({ length: LEAVES }, (_, i) => {
    const deg = 165 - (i * (165 - 30)) / (LEAVES - 1);
    const rad = (deg * Math.PI) / 180;
    return { i, x: 78 * Math.sin(rad), y: -78 * Math.cos(rad), deg };
  });
</script>

<svg class="wreath" class:still={reduced} viewBox="-100 -100 200 200" width={size} height={size * 0.62} aria-hidden="true" data-testid="victory-laurel" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="leaf-gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f1dc9a" />
      <stop offset="1" stop-color="#c9a227" />
    </linearGradient>
  </defs>
  {#each [-1, 1] as side (side)}
    {#each leaves as l (l.i)}
      <g transform="translate({side * l.x} {l.y}) rotate({side * (l.deg - 90)})">
        <ellipse class="leaf" style="--i:{l.i}" rx="8" ry="17" fill="url(#leaf-gold)" />
      </g>
    {/each}
  {/each}
</svg>

<style>
  .wreath {
    display: block;
    margin: 0 auto -18px;
    overflow: visible;
  }
  .leaf {
    stroke: var(--bronze-dark);
    stroke-width: 1.4;
    transform-box: fill-box;
    transform-origin: center;
    animation: leaf-in 0.34s cubic-bezier(0.2, 0.9, 0.3, 1.3) calc(var(--i) * 70ms) both;
  }
  .still .leaf {
    animation: none;
  }
  @keyframes leaf-in {
    from {
      transform: scale(0);
      opacity: 0;
    }
  }
</style>
```

(Tune the geometry in the walk: the two branches should frame the title from below, open at the top. The global reduced-motion rule already zeroes durations; `.still` removes the animation outright so the e2e reads no running animation.)

- [ ] **Step 5: The spoils (`VictorySpoils.svelte`, moved from `ProgressionReveal`)**

Keep the whole script (rank-up two-phase gauge, quest bonus, relic names, extra rewards, hatch, dragon naming with its errors and chime, sound and particle cues, staggered `Reveal` delays). Change the markup to kit objects, test ids unchanged:
- XP (`reveal-xp`): `+{session} XP` in Cinzel `--reward-ink`, then `<LaurelBar value={xpValue} max={gaugeMax} label={gaugeTitle} testId="victory-xp" />` instead of `Gauge` (its value animates through the existing `xpValue` steps; LaurelBar lights leaves), the bonus lines as `kit-tag`s, « Nouveau rang : … » as a `kit-ribbon`.
- Quests (`reveal-quest-<id>`): a `kit-sheet` each, `gold-frame` → the sheet's gold rim when completed, « Quête accomplie ! » as a `kit-stamp`.
- Neutralised (`reveal-neutralised-<key>`): the lieutenant's cut-out beside a `kit-sheet`: « {name} — {agree('neutralisé')} ! », `VICTORY.neutralised`, the relic `Medallion`, the burst.
- Extra rewards (`reveal-reward-<id>`): `Medallion` + name in a `kit-cubby`.
- Dragon (`reveal-dragon`): `Dragon` (hatch as today) on a `kit-sheet`; the name form in `kit-form` (`reveal-name-input`, `reveal-name-save` « C'est son nom », error as `kit-note data-tone="eris"`).
- Weekly (`reveal-weekly`): the laurel leaves (as today, CSS) + its line.
- Boss (`reveal-boss`, `reveal-boss-too-easy`): won → Éris's line as an `OverlayVoice` plate (`erisSays(VICTORY.bossWon)`) + the reward `Medallion`; lost → `kit-note data-tone="eris"` `VICTORY.bossLost`; too easy → `kit-note` `VICTORY.bossTooEasy`.
- « Continuer » (`reveal-continue`, `VICTORY.continue`) — a `kit-bronze` at the end.
Remove the `.card`/`.chip`/`.parchment`/`.btn` classes and the `eris-panel` usage.

- [ ] **Step 6: The « Revoir » scroll (`ReviewScroll.svelte`, moved from `Results`)**

Keep the script (local grade, final-position maps, pieces, grouped attempts, the tapped token state, `activePanel`), drop the tally/Éris/help/error/actions (they live on the sheet). Render:

```svelte
<Overlay variant="scroll" size="wide" title={VICTORY.reviewTitle} testId="overlay-revoir" {onClose} returnFocus={'[data-testid="battle-revoir"]'}>
  <h3 class="kit-section">{VICTORY.reviewText}</h3>
  <div class="review-text"><p class="tokens" lang="fr">…the same pieces loop, buttons with class `tok` / `err` / `caught` / `punct` / `active`, missing markers with `aria-label={VICTORY.missingWord}`…</p></div>
  {#if activePanel}
    <div class="kit-note" data-tone={activePanel.kind === 'caught' ? undefined : 'eris'} role="note" data-testid="revoir-popover">
      …`VICTORY.expected(expected)` + `explain(err, ctx).text` / `caughtText(caught)` / `VICTORY.forgotten(expected)`…
    </div>
  {/if}
  {#if grouped.length > 0}
    <h3 class="kit-section">{VICTORY.reviewTried}</h3>
    {#each grouped as group (group.key)}
      <section class="category">
        <h4>{group.label}</h4>
        <ul>…each explanation, with a `kit-tag` « déjoué » + check icon when caught…</ul>
      </section>
    {/each}
  {/if}
</Overlay>
```

The text keeps Literata 22 px on `--battle-text-bg`, caught words dotted-underlined in `--laurel`, still-wrong words underlined in `--orange` (never red), every token a ≥ 44 px-tall line box as today (`padding: 10px 2px`), the popover right under the text (`kit-note`). `headings.test.ts`: add `expect(levels('src/components/battle/ReviewScroll.svelte')).toEqual([3, 3, 4]);`.

- [ ] **Step 7: The dragon's nudge (`DragonNudge.svelte`, moved from `BreakNudge`)**

Same props, copy and test ids; markup: an `OverlayVoice`-style plate spoken by the dragon (`dragonSays(dragon ?? egg, message)`, `testId="break-nudge"` on the wrapper) with `kit-bronze` « Pause » (`break-pause`) and `kit-bronze is-quiet` « Encore un texte » (`break-continue`).

Remove `VictoryPhase.svelte` from lane V's side of `battleKit.test.ts`'s `PENDING` (and of `registerGuard.test.ts`'s if listed); the moved files must pass the guards (they are under `components/battle/` now).

- [ ] **Step 8: Run**

Run: `scripts/npm.sh run test -- src/battleKit.test.ts src/registerGuard.test.ts src/components/places/headings.test.ts src/formPlural.test.ts src/noGuilt.test.ts src/noEmoji.test.ts src/lib/battle` — PASS.
Run: `scripts/npm.sh run check` — `0 errors and 0 warnings`.
Run: `STACK=victory scripts/playwright.sh scenes-battle-victory --repeat-each=3` — PASS on both projects.
Run once: `STACK=victory scripts/playwright.sh happy-path`, `… world`, `… grimoire`, `… scenes-camp`, `… scenes-nest`, `… scenes-delphi` (the dialogue box's default dock) — PASS.

- [ ] **Step 9: Commit**

```bash
git add web/src/components/battle web/src/components/scene/DialogueBox.svelte web/src/components/places/headings.test.ts web/src/battleKit.test.ts web/src/registerGuard.test.ts web/e2e/scenes-battle-victory.spec.ts web/e2e/happy-path.spec.ts
git commit -m "UI4 Task 6: the victory - the reckoning on the stage, the laurel sheet with XP and spoils, Éris and the dragon speak, the Revoir scroll, the dragon's pause

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/components/battle web/src/components/ProgressionReveal.svelte web/src/components/Results.svelte web/src/components/BreakNudge.svelte web/src/components/scene/DialogueBox.svelte web/src/components/places/headings.test.ts web/src/battleKit.test.ts web/src/registerGuard.test.ts web/e2e/scenes-battle-victory.spec.ts web/e2e/happy-path.spec.ts
```

---

### Task 7: Éris's lair — the boss muster on the stage; the unused battle art goes (lane V)

**Files:**
- Modify: `web/src/components/battle/BossMuster.svelte`, `web/src/screens/Boss.svelte`
- Modify: `web/src/lib/world/scenes/camp.ts` (preload the lair instead of the old battlefield) and its test if it pins the preload list
- Delete: `git rm web/public/art/scenes/battle.webp web/public/art/scenes/argus.webp` (only after the grep in Step 2 proves them unreferenced) and the `battle` entry of `ART.scenes`
- Create: `web/src/artReferenced.test.ts`
- Modify: `web/src/battleKit.test.ts`, `web/src/registerGuard.test.ts` (lane V's `PENDING` empty), `docs/art/scenes.md` (the old `battle.webp` line, if any)
- Modify: `web/e2e/scenes-battle-victory.spec.ts`

**Interfaces:**
- Consumes: Task 2's `BossMuster` contract, `BOSS`, `CHALLENGE_LINES`, `romanTier`, `OverlayVoice`, `Medallion`.
- Produces: test ids kept (`boss-tier`, `boss-reward`, `boss-start`), `battle-voice` (Éris's challenge).

- [ ] **Step 1: Write the failing e2e** (append to `scenes-battle-victory.spec.ts`)

```ts
test("Éris's lair: her challenge, the fight's stakes and the rules on the parchment", async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Lair-${testInfo.project.name}`));
  await page.goto(`/#/p/${id}/eris`);
  await expectBattle(page, 'muster');
  const stage = page.getByTestId('scene-battle');
  await expect(stage).toHaveAttribute('data-backdrop', 'lair');
  await expect(stage).toHaveAttribute('data-opponent', 'eris');
  const sheet = page.getByTestId('battle-parchment');
  await expect(sheet.getByTestId('battle-voice')).toHaveAttribute('data-speaker', 'eris');
  await expect(sheet.getByTestId('battle-voice')).toContainText('Voyons si mes pièges tiennent');
  await expect(sheet.getByTestId('boss-tier')).toHaveText('Combat I');
  await expect(sheet.getByTestId('boss-reward')).toContainText('Récompense si tu gagnes');
  await expect(sheet.getByTestId('boss-start')).toHaveText('Affronter Éris');
  await expect(sheet.locator(LEGACY_UI)).toHaveCount(0);
  await expectOverlayTapTargets(page, 'battle-parchment');
  expect(await redScan(page)).toEqual([]);
});

test('a fight Éris refuses says why, in her colour, and nothing is lost', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Lair2-${testInfo.project.name}`));
  await page.goto(`/#/p/${id}/eris`);
  await expectBattle(page, 'muster');
  await tap(page.getByTestId('boss-start'), testInfo);
  await expect(page.getByTestId('battle-parchment').locator('.kit-note[data-tone="eris"][role="alert"]')).toBeVisible();
  await expect(page).toHaveURL(/\/eris$/);
});
```

(A fresh hero has no open tier: read `server/app/routers/world.py`'s boss endpoint for the status and message it returns, and assert its text if it is stable.)

`web/src/artReferenced.test.ts`:

```ts
// UI4 Ruling C14: every scene background shipped under public/art/scenes is used by the game (an
// unused one is dead weight in the PWA cache and misleads the art inventory).
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (/\.(svelte|ts)$/.test(name) && !name.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

describe('scene art in use', () => {
  it('references every file of public/art/scenes from the game sources', () => {
    const code = sources('src').map((f) => readFileSync(f, 'utf-8')).join('\n');
    const unused = readdirSync('public/art/scenes').filter((f) => f.endsWith('.webp') && !code.includes(`/art/scenes/${f}`));
    expect(unused).toEqual([]);
  });
});
```

Run: `STACK=victory scripts/playwright.sh scenes-battle-victory` and `scripts/npm.sh run test -- src/artReferenced.test.ts` — FAIL.

- [ ] **Step 2: `BossMuster.svelte` and the art sweep**

`BossMuster` renders, in a scrolling column like the muster: `<h2>` « Éris » is not needed (the stage's plaque names her); Éris's challenge as `<OverlayVoice line={taunt} testId="battle-voice" />` (and `react('opponent', 'taunt')` on mount); `<p class="kit-ribbon" data-testid="boss-tier">{BOSS.tier(romanTier(tier))}</p>`; the stakes `data-testid="boss-reward"`: `Medallion` (40 px) + `BOSS.reward(rewardXp, rewardName)` in `--reward-ink`; the rules `BOSS.rules` in `--ink-soft`; the error `kit-note data-tone="eris" role="alert"`; the grand `kit-bronze` `boss-start` (`BOSS.restart` when `retry`, else `BOSS.start`, disabled while `starting`). No legacy class.

`Boss.svelte`: drop the leftover imports (`Dragon`, `TopBar` if any remained, `ART.scenes.battle`), keep its data and `start()`.

Grep `battle.webp`, `scenes.battle\b`, `argus.webp` in `web/src`, `web/e2e`, `docs/art`: `camp.ts`'s preload uses `ART.scenes.battle` → replace with `ART.scenes.erisLair` (the path to battle leads to her lair); remove the `battle` key from `ART.scenes`; if nothing else references the two files, `git rm` them and drop their lines from `docs/art/scenes.md`/`docs/art/icon-inventory.md` if listed. If `artReferenced.test.ts` still lists a file, either it is used by a path built at runtime (then make the reference explicit in `art.ts`) or it goes too — report which.

Remove `BossMuster.svelte` from lane V's side of both `PENDING` sets (lane V's side is now empty; keep the fence line).

- [ ] **Step 3: Run**

Run: `scripts/npm.sh run test -- src/artReferenced.test.ts src/battleKit.test.ts src/registerGuard.test.ts src/lib/world src/budget.test.ts` (the budget test lives under `lib/world/scenes/`: include that path) — PASS.
Run: `scripts/npm.sh run check` — `0 errors and 0 warnings`.
Run: `STACK=victory scripts/playwright.sh scenes-battle-victory --repeat-each=3` — PASS.
Run once: `STACK=victory scripts/playwright.sh world`, `… scenes-camp`, `… scenes-parity` — PASS.
Run: `STACK=victory PW_WORKERS=4 scripts/check.sh` — `== ALL GREEN` (lane V's gate; paste the counts).

- [ ] **Step 4: Commit**

```bash
git add web/src/components/battle/BossMuster.svelte web/src/screens/Boss.svelte web/src/lib/world/scenes/camp.ts web/src/lib/world/art.ts web/src/artReferenced.test.ts web/src/battleKit.test.ts web/src/registerGuard.test.ts web/e2e/scenes-battle-victory.spec.ts docs/art/scenes.md
git commit -m "UI4 Task 7: Éris's lair - her challenge as her voice, the fight's stakes on the parchment; the unused battlefield art goes, guarded

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/components/battle/BossMuster.svelte web/src/screens/Boss.svelte web/src/lib/world/scenes/camp.ts web/src/lib/world/art.ts web/src/artReferenced.test.ts web/src/battleKit.test.ts web/src/registerGuard.test.ts web/e2e/scenes-battle-victory.spec.ts docs/art/scenes.md web/public/art/scenes/battle.webp web/public/art/scenes/argus.webp
```

(Add the camp test file, `art.test.ts` and any doc you touched to both lists; drop `docs/art/scenes.md` if unchanged.)

Then the controller merges lane P and lane V into `scenes` (the only shared hunks are the two `PENDING` sets, both empty on each side of the fence after the lanes: keep the fence line and nothing else), runs `PW_WORKERS=4 scripts/check.sh` once, and removes the worktrees.

---

### Task 8: The battle walk (iPad screenshots), the legacy kit's retirement, the full gate

**Files:**
- Create: `web/e2e/playability-ui4.spec.ts`
- Regenerate (only in Step 5): `docs/reviews/ui4/*.png`
- Modify: `web/src/app.css` (+ `web/src/app.css.test.ts`), `web/src/battleKit.test.ts`, `web/src/placesKit.test.ts` (widened scope), `web/src/registerGuard.test.ts` (no `PENDING` left)

**Interfaces:**
- Consumes: the walk pattern of `playability-ui3.spec.ts` (`Walk`, `shot`, `noRed`, `waitForOverlaySettled`, `settleDialogue`, `OUT` from `WALK_OUT`, fixed names, `clearEarlierWalk`, the origins check); `createText`, `postSession`, `makeResult`, `seedPlay`, `resumeSeeded`, `installKeyboardSim`, `setKeyboard`, `expectBattle`, `closeOverlay`, `expectCamp` (`helpers.ts`).
- Produces: `playability-ui4.spec.ts` with sections `muster`, `dictation`, `proofreading`, `victory`, `boss`, `wide`; shots `c01…c22` + `ipad-portrait-c23-rotate-battle`; the legacy kit gone from `app.css`.

- [ ] **Step 1: The walk**

`web/e2e/playability-ui4.spec.ts`. Copy from `playability-ui3.spec.ts` (read it first) the header comment's WALK_OUT explanation (with `walk-ui4` / `docs/reviews/ui4`), `OUT`, `Walk`, `waitForImagesAndFonts`, `shot`, `waitForOverlaySettled`, `settleDialogue`, `noRed`, the `deleteHeroes`/`deleteTexts` helpers and the origins check. Then:

```ts
// UI4 battle walk (scenes spec §10): iPad-size screenshots of the battle stage in every phase and
// layout, for the Opus playability review ("does anything still look like a school form?") and the
// legibility check of a long proofreading text.
// `Walk` (copied from the UI3 walk) gains `texts: Record<'short' | 'long' | 'grimoire' | 'rout' | 'standoff', number>`.
const BATTLE_HERO = 'Pénélope-Aurore';
const T_SHORT = 'Le chant des fées';
const T_LONG = 'La nuit des fées';
const T_GRIMOIRE = "Le grimoire d'Ulysse";
const SHORT = 'Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.';
const SHORT_HALF = 'Les fées dansent dans la clairière. Elles chante et les oiseaux les écoutent.';
const SHORT_DRAFT = 'Les fées danse dans la clairière. Elles chante et les oiseaux les écoutent.';
// ~300 words, two planted errors (the lane P spec's LONG_REF / LONG_DRAFT; copy them).

async function musterSection(w: Walk) {
  const { page } = w;
  await page.goto(`/#/p/${w.profileId}/play/${w.texts.short}?encounter=hydre`);
  await expectBattle(page, 'muster');
  await shot(w, 'c01-muster-hydre-river');
  await noRed(w, 'muster');
  await page.goto(`/#/p/${w.profileId}/play/${w.texts.long}?encounter=sirenes&quest=1`);
  await expectBattle(page, 'muster');
  await shot(w, 'c02-muster-sirenes-coast-quest');
  await page.goto(`/#/p/${w.profileId}/grimoire/${w.texts.grimoire}`);
  await expectBattle(page, 'muster');
  await shot(w, 'c03-muster-grimoire-temple');
}

async function dictationSection(w: Walk) {
  const { page } = w;
  await page.goto(`/#/p/${w.profileId}/play/${w.texts.short}?encounter=lethe`);
  await expectBattle(page, 'muster');
  await page.getByTestId('pace-option-1').click();
  await page.getByRole('button', { name: 'Commencer la dictée' }).click();
  await expectBattle(page, 'dictation');
  await expect(page.getByTestId('btn-next')).toBeEnabled();
  await page.getByTestId('dictation-textarea').fill('Les fées danse dans la clairière.');
  await shot(w, 'c04-dictation-lethe');
  await noRed(w, 'dictation');
  await page.getByTestId('dictation-textarea').click();
  await setKeyboard(page, 400);
  await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-layout', 'compact');
  await shot(w, 'c05-dictation-compact-keyboard');
  await setKeyboard(page, 0);
}

async function proofSection(w: Walk) {
  const { page } = w;
  for (const [help, name] of [
    [1, 'c06-proof-stage1-argus-long'],
    [3, 'c07-proof-stage3-notched-hold'],
  ] as const) {
    await page.goto(`/#/p/${w.profileId}/play/${w.texts.long}?help=${help}&encounter=chimere`);
    await expectBattle(page);
    if (await page.getByTestId('battle-resume').count()) await resumeSeeded(page);
    await expectBattle(page, 'proofreading');
    await shot(w, name);
    await noRed(w, name);
  }
  await page.getByTestId('btn-fil').click();
  await page.getByTestId('tok-2').click();
  await shot(w, 'c08-proof-fil');
  await page.getByTestId('btn-fil-exit').click();
  await page.getByTestId('btn-bouclier').click();
  await shot(w, 'c09-proof-bouclier');
  await page.getByTestId('btn-bouclier').click();
  const tokens = page.locator('[data-testid^="tok-"]');
  const near = tokens.nth((await tokens.count()) - 4);
  await near.scrollIntoViewIfNeeded();
  await near.click();
  await setKeyboard(page, 400);
  await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-layout', 'compact');
  await shot(w, 'c10-proof-compact-editing');
  await page.getByTestId('word-editor').press('Escape');
  await setKeyboard(page, 0);
}

async function victorySection(w: Walk) {
  const { page } = w;
  // A lived-in victory: two days of the Hydra already foiled, so today's live session can neutralise it.
  await page.goto(`/#/p/${w.profileId}/play/${w.texts.short}?encounter=hydre`);
  await expectBattle(page, 'muster');
  await page.getByTestId('pace-option-1').click();
  await page.getByRole('button', { name: 'Commencer la dictée' }).click();
  await expect(page.getByTestId('btn-next')).toBeEnabled();
  await page.getByTestId('dictation-textarea').fill('Les fées danse dans la clairière.');
  await page.getByTestId('btn-next').click();
  await expect(page.getByTestId('btn-finish-writing')).toBeVisible();
  await page.getByTestId('dictation-textarea').fill(SHORT_DRAFT);
  await page.getByTestId('btn-finish-writing').click();
  await expectBattle(page, 'proofreading');
  const danse = page.locator('[data-testid^="tok-"]', { hasText: /^danse$/ });
  await danse.click();
  await page.getByTestId('word-editor').fill('dansent');
  await page.getByTestId('word-editor').press('Enter');
  await page.getByTestId('btn-done-proofreading').click();
  const confirm = page.getByRole('button', { name: 'Oui, valider' });
  if (await confirm.isVisible()) await confirm.click();
  await expectBattle(page, 'victory');
  await expect(page.getByTestId('battle-opponent')).toHaveAttribute('data-reaction', /retreat|defeat/);
  await expect(page.getByTestId('reveal-xp')).toBeVisible();
  await shot(w, 'c11-victory-reckoning-and-spoils');
  await noRed(w, 'victory');
  await page.getByTestId('victory').evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await shot(w, 'c12-victory-spoils-end');
  await page.getByTestId('reveal-continue').click();
  await settleDialogue(page);
  await shot(w, 'c13-victory-eris-speaks');
  await page.getByTestId('dialogue-advance').click();
  await settleDialogue(page);
  await shot(w, 'c14-victory-dragon-speaks');
  await page.getByTestId('battle-revoir').click();
  await waitForOverlaySettled(page, 'overlay-revoir');
  await page.getByTestId('overlay-revoir').getByRole('button', { name: 'chante', exact: true }).click();
  await shot(w, 'c15-revoir-scroll');
  await noRed(w, 'revoir');
  await closeOverlay(page);
  // A rout and a standoff, from seeded states (a second and third text).
  await page.goto(`/#/p/${w.profileId}/play/${w.texts.rout}`);
  await expectBattle(page, 'victory');
  await expect(page.getByTestId('battle-opponent')).toHaveAttribute('data-reaction', 'defeat');
  await shot(w, 'c16-victory-rout');
  await page.goto(`/#/p/${w.profileId}/play/${w.texts.standoff}`);
  await expectBattle(page, 'victory');
  await expect(page.getByTestId('battle-opponent')).toHaveAttribute('data-reaction', 'taunt');
  await shot(w, 'c17-victory-standoff');
}

async function bossSection(w: Walk) {
  const { page } = w;
  await page.goto(`/#/p/${w.profileId}/eris`);
  await expectBattle(page, 'muster');
  await shot(w, 'c18-boss-lair');
  await noRed(w, 'lair');
  // The break nudge on a victory sheet.
  await page.addInitScript(
    (seed) => sessionStorage.setItem(seed.key, seed.value),
    { key: 'discorde.playClock', value: JSON.stringify({ activeMs: 26 * 60000, running: false, lastTick: null, lastStop: Date.now() }) },
  );
  await page.goto(`/#/p/${w.profileId}/play/${w.texts.rout}`);
  await expect(page.getByTestId('break-nudge')).toBeVisible();
  await shot(w, 'c19-victory-break-nudge');
}

async function wideSection(w: Walk) {
  const { page } = w;
  for (const [size, name] of [
    [{ width: 1440, height: 900 }, 'c20-laptop-1440x900-proof'],
    [{ width: 2560, height: 1080 }, 'c21-ultrawide-2560x1080-proof'],
    [{ width: 1180, height: 480 }, 'c22-short-window-compact-proof'],
  ] as const) {
    await page.setViewportSize(size);
    await page.goto(`/#/p/${w.profileId}/play/${w.texts.long}?help=4`);
    await expectBattle(page);
    if (await page.getByTestId('battle-resume').count()) await resumeSeeded(page);
    await expectBattle(page, 'proofreading');
    await shot(w, name);
  }
  await page.setViewportSize({ width: 1180, height: 820 });
}
```

The test body follows the UI3 walk's: `installKeyboardSim(page)` and `stubSpeech(page)` first; `clearEarlierWalk` deletes `BATTLE_HERO` and the titles above; create `BATTLE_HERO` (10H) through the API; create the texts (`short`, `long`, `grimoire`, `rout`, `standoff`) with those fixed titles (`rout`/`standoff` are copies of `SHORT` titled « Le chant des fées (II) » / « (III) »); seed through `seedPlay` the long text's proofreading (`LONG_DRAFT`, `opponent: 'chimere'`), the rout (`current: SHORT`, `opponent: 'protee'`) and the standoff (`current: SHORT_DRAFT`, `opponent: 'echo'`) before the first `goto`; seed two past days of Hydra sessions with `postSession` (`makeResult({ draft: 5, caught: 5, category: 'agreement:verb' })`, `day` = yesterday and the day before, computed from `new Date()`) so the live session can neutralise it; in `ipad-portrait`, go to `/#/p/<id>/eris`, pause the rotate icon's animation at 60 % as the UI3 walk does, and shoot `c23-rotate-battle`; run `SECTIONS = [muster, dictation, proofreading, victory, boss, wide]`; delete the texts in `finally`; assert a single request origin. If the neutralisation does not show on c11/c12 (the server's rule wants more), note it in the walk's notes (not a failure): the spoils' look is what the shot is for.

- [ ] **Step 2: Run the walk to the scratch dir**

Run: `scripts/playwright.sh --config playwright.playability.config.ts playability-ui4`
Expected: 2 passed; `web/test-results/walk-ui4/` holds `ipad-landscape-c01…c22` and `ipad-portrait-c23-rotate-battle.png`; the notes list no `RED at` line and one request origin. `docs/reviews/` untouched.

- [ ] **Step 3: Look at every screenshot**

Open each PNG (the Read tool shows images) with the review's question: "does anything still look like a school form?", and the spec's: "legibility beats décor". Check: the dragon and the opponent face each other (fix `FACES` if not) and stand on the ground of their backdrop (`--feet`), neither covered by the parchment's text zone; the hold bar reads against every backdrop and names the opponent; the long text in c06/c07/c20/c21 reads comfortably (no line wider than ~70 characters in full layout, no décor behind the letters, the backdrop dimmed); the compact shots (c05, c10, c22) keep the band's three parts visible and the editor/textarea above the "keyboard"; the laurel wreath frames the title; the spoils read as objects (medallions, sheets), not as cards; the dialogue box sits inside the sheet; the « Revoir » scroll matches the other scrolls of the game; no grade code, « niveau », form plural, red or emoji anywhere. Fix what you find in the owning file (CSS, `FACES`, geometry within the stage's variables, copy only through `lines.ts`), rerun the walk, and list what you checked and what you leave for the Opus playability review.

- [ ] **Step 4: The legacy kit retires (Ruling C14)**

- `grep -rnE "class=\"[^\"]*\b(btn|btn-primary|btn-ghost|card|chip|chip-active|parchment|screen|scene|eris-panel|banner|banner-olive|banner-error)\b" web/src --include=*.svelte` and the `class:` / `:global(.x)` forms: every hit must be gone (the guards say so). `.muted` and `.orange` may still be used as plain classes by the places: grep each; delete a rule only when nothing uses it, else leave it and say so.
- Delete from `web/src/app.css` the rules of every class the grep proved unused (`.screen`, `.btn*`, `.card*`, `.chip*`, `.parchment`, `.scene` + `::after`, `.eris-panel`, …), keeping the tokens, the base element styles, the fonts, the keyframes (`float`, `pop`, `wobble` are `Dragon.svelte`'s) and the reduced-motion block.
- `app.css.test.ts`: add « defines none of the retired legacy classes »: for each of `screen, btn, btn-primary, btn-ghost, card, chip, chip-active, parchment, scene, eris-panel` expect `css` not to match `new RegExp(\`^\\.${c}\\b\`, 'm')`.
- `placesKit.test.ts`: widen `files` to every `.svelte` under `src/components` and `src/screens` (the battle included), since nothing may use the legacy classes any more; `battleKit.test.ts` then only keeps its (empty) `PENDING` honesty test plus a final assertion `expect([...PENDING]).toEqual([])` — or fold it into `placesKit.test.ts` and delete it (say which).
- `registerGuard.test.ts`: `PENDING` is empty (only the fence comment is left: remove the comment too); the header comment no longer mentions the battle exemption.

- [ ] **Step 5: Refresh the baseline and run the full gate**

Run: `WALK_OUT=docs/reviews/ui4 scripts/playwright.sh --config playwright.playability.config.ts playability-ui4` — Expected: 2 passed; `docs/reviews/ui4/` holds the 23 shots.
Run: `PW_WORKERS=4 scripts/check.sh`
Expected: `== ALL GREEN`: pytest; svelte-check `0 errors and 0 warnings`; vitest (every guard, `lib/battle`, `artReferenced`, the budgets, the one-glow sweep); docker build; Playwright `desktop` (every functional spec) and `ipad` (every `scenes-*` spec, `scenes-battle`, `scenes-battle-play`, `scenes-battle-victory` included) and `chromium`. No crash retry, or name the crashed test. Run it a second time if the first needed any fix after Step 4.

- [ ] **Step 6: Commit**

```bash
git add web/e2e/playability-ui4.spec.ts docs/reviews/ui4 web/src/app.css web/src/app.css.test.ts web/src/battleKit.test.ts web/src/placesKit.test.ts web/src/registerGuard.test.ts
git commit -m "UI4 Task 8: the battle walk (iPad screenshots of every phase, layout and outcome), the legacy kit retires, full gate

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/e2e/playability-ui4.spec.ts docs/reviews/ui4 web/src/app.css web/src/app.css.test.ts web/src/battleKit.test.ts web/src/placesKit.test.ts web/src/registerGuard.test.ts
```

(Add any file Step 3's fixes touched.) Then the controller dispatches the Opus playability review on `docs/reviews/ui4/` (`docs/reviews/ui4/playability-ui4.md`) and the whole-branch Opus code review, as for UI3.

---

### Task A (optional — only with the user's go-ahead): a painted chest and a flustered Éris

Without this task the victory has the CSS/SVG laurel wreath (Ruling C6) and the reactions are CSS/WAAPI on today's cut-outs (Ruling C10); nothing else depends on it. It can run any time after Task 1 and before Task 8's walk. Forge runs only while no Playwright run is going (Ruling F4) and while the user is not using the GPU; the `krea2` skill drives it.

**Assets (three, up to 6 seeds each: 18 generations at most, about 45 minutes of Forge time):**

| Asset | Size | Style file | Use |
|---|---|---|---|
| `assets/art/battle/chest_closed.png` → `web/public/art/battle/chest_closed.webp` (cut-out, ≤ 60 KB) | 1024² | `discorde-inked-clean` | Victory sheet: the closed chest under the laurel when the spoils hold a reward |
| `assets/art/battle/chest_open.png` → `web/public/art/battle/chest_open.webp` (cut-out, ≤ 60 KB) | 1024², same seed family and framing as the closed one | `discorde-inked-clean` | Swapped in 600 ms after the sheet appears (a fade under reduced motion) |
| `assets/art/characters/eris_flustered.png` → `web/public/art/characters/eris_flustered_cut.webp` (≤ 120 KB) | 768×1344 | `discorde-inked` (her other two poses' style) | The opponent's `defeat` pose when Éris is routed (boss won, grimoire routed) |

**Prompts** (recipe of `docs/art/style-guide.md` §3: framing → lighting → subject → negatives → plain background; `--vscale 1.0`):

1. Chest, closed: « Game prop illustration, three-quarter view from slightly above, whole object visible with room around it, soft even lighting. subject: a small ancient Greek treasure chest of dark olive wood with burnished bronze corner bands and a bronze clasp shaped like a laurel sprig, a meander (Greek key) pattern carved along the lid, the lid firmly shut, one clean medium-weight dark ink outline of even thickness around the whole object, finer interior lines, gouache shading with warm and cool colour variation inside every shape. (sketchy lines:-2) (rough brush strokes:-2) (thick heavy outline:-1.5) (shadow:-2) (cast shadow on the ground:-3) (glow:-2) (text:-3) isolated on a flat plain white background »
2. Chest, open: the same prompt with « the lid thrown open and tilted back, inside a heap of gold coins and a small golden laurel wreath lying on top, the gold painted with warm light inside the chest only » instead of « the lid firmly shut », same seed as the kept closed chest (and ±1, ±2 if the lid angle drifts).
3. Éris flustered: the style guide's Éris sheet verbatim (« Éris, the Greek goddess of discord, a tall vain theatrical villainess … holding a shining golden apple. ») with the attitude changed to « a sore loser caught off guard: one hand pressed to her forehead in theatrical dismay, crown knocked slightly askew, eyes squeezed half shut, mouth in an offended pout, clutching the golden apple to her chest, the whole figure visible from the top of the crown down to the sandals with room above and below, hair as thick solid locks », plus `(sweet friendly kind smile:-3) (crying:-2) (tears:-3) (shadow:-2) (cast shadow on the ground:-3)` and « isolated on a flat plain white background ». Never write "cut-out" in the prompt.

**Steps:**
- [ ] Generate with the `krea2` skill, keep the sidecar JSON next to each PNG, cut out with `tools/art/run_docker.sh` (`cutout.py`) as the other cut-outs, export WebP, check each against the style guide and the existing cut-outs side by side (a contact sheet in `docs/art/`), and reject anything with a sticker rim, a glow halo or a mangled hand.
- [ ] Add `ART.battle = { chestClosed, chestOpen }` and `ART.erisFlustered` to `art.ts` (+ `art.test.ts`), rows in `docs/art/scenes.md`'s cut-out table and `ASSETS-LICENSES.md` if it lists generated art.
- [ ] Wire them (if Task 6/7 are already merged, in a small follow-up commit on `scenes`): `VictorySheet` shows the chest (closed → open) above the tally when `progression.rewards.length > 0`, `data-testid="victory-chest"`; `BattleStage` swaps the opponent's `src` to `ART.erisFlustered` when the opponent is Éris and its reaction is `defeat`. Add one e2e assertion to `scenes-battle-victory.spec.ts` (`victory-chest` visible on a victory with a reward) and one to the walk.
- [ ] `scripts/npm.sh run test -- src/lib/world/art.test.ts src/lib/world/scenes` (budget), commit the PNGs, sidecars, WebPs and code with an explicit pathspec: `"UI4 Task A: a painted treasure chest (closed, open) and a flustered Éris for the victory"`.

---

## Self-review (UI4)

- **Spec coverage.** §5 full-screen backdrop: `BattleStage` + `BACKDROPS` (Task 2), four grounds from the existing art (C2). Opponent on one side reacting (hit, taunt, defeat): `Combatant` + `reactions.ts` (Tasks 1–2), taunt at the muster (3, 7), flinch on the owl (5), hits and defeat/retreat at the reckoning (6). HP bar dropping as errors are caught: at the reckoning, one strike per caught trap (C3, flagged). Dragon on the other side: `battle-dragon` with its tint and stage (2), cheering and bracing (3, 5, 6). Semi-transparent parchment in Literata: `--battle-text-bg` + the texture (1, 2), Literata ≥ 22 px everywhere she reads or writes (4, 5, 6). Compact mode on `visualViewport`: `viewport.svelte.ts` + `battleLayout` + the band (1, 2), per phase (4, 5), tested with the simulated keyboard and with a short window on both projects. Every mechanic kept: the Parity map, the migrated functional specs (happy-path, grimoire, world, scan, alexandria) and the new per-phase e2e. Legibility beats décor: C12, `legibility.test.ts`, the long-text e2e, the walk's c06/c07/c20–c22. §3 Victory overlay: the laurel sheet, XP rising on the laurel bar, the dragon reacting and speaking, explanations through the dialogue and the « Revoir » scroll (6); chest only with Task A. §7–§8: hooks only (C9). §10: e2e on WebKit iPad landscape including the compact layout with a simulated keyboard, the portrait rotate screen, reduced motion; the walk; `scripts/check.sh`.
- **Parity.** Every row of the Parity map names its task and keeps its test ids; the three test ids that retire (`topbar-*`) retire with their component and every spec using them is migrated in Task 2. The one feature dropped from the screen is the grade-code chip (C8 / register rule), reported as a ruling.
- **Guards.** `battleKit.test.ts` (legacy classes, a shrinking `PENDING`), `registerGuard.test.ts` over `lib/battle` and `components/battle` (Task 2 removes the battle exemption), `lines.test.ts` (gendered adjectives, vocative « héros », Éris's `FORBIDDEN`, plate length), `legibility.test.ts` (7:1 over black and white), `artReferenced.test.ts`, the headings test for the scroll; Task 8 widens the kit guard to the whole app once the legacy CSS is gone.
- **Parallel safety.** Lane P edits `MusterPhase`, `PaceMedallions`, `DictationPhase`, `ProofPhase`, `TokenText`, `WordEditor`, `kit-objects.css` (a note tone), `scan.spec.ts`, its own spec; lane V edits `VictoryPhase` and its new/moved components, `DialogueBox`, `BossMuster`, `Boss.svelte`, `camp.ts`, `art.ts`, `happy-path.spec.ts`, its own spec. Shared: the two `PENDING` sets, each lane on its side of a fence line. Neither lane edits `Play.svelte` or `lines.ts` (Task 2 passes every prop a phase needs; Task 1 wrote every line). `world.spec.ts` and `grimoire.spec.ts` are run, not edited, by both lanes (their test ids are kept).
- **Placeholder scan.** Every step carries its code or its exact edit. The discretionary values are CSS sizes on the stage (bounded by the e2e: band ≤ 104 px, text ≥ 22 px, measure 22–36 font sizes, text zone ≥ 55 % of the height, targets ≥ 48 px) and `FACES`, which the files decide (Task 1 note, Task 8 check).
- **Type consistency.** `OpponentId`, `BattleDef`, `BattlePhase`, `BattleMode` (Task 1) are what `BattleStage`, `Play`, `Boss` and the phases use (Task 2 on). `HpView`/`FULL_HP`/`hpDuringPlay`/`reckoningSteps`/`outcomeOf` (Task 1) feed `setHp` in Play (Task 2) and the reckoning in `VictoryPhase` (Task 6). `Reaction` and `reactionAnimation` (Task 1) are read by `Combatant` (Task 2); `react`/`strike` (Task 1) are called by Muster (3), Dictation (4), Proof (5), Victory (6), BossMuster (7). `BattleLayout` flows from the stage's snippet to `DictationPhase`/`ProofPhase` (declared in Task 2). `PlayState.opponent` (Task 1) is set by Play (Task 2) and seeded by the e2e (`seedPlay`'s `opponent`). `DialogueBox`'s `dock` (Task 6) defaults to today's behaviour. Test ids used by later tasks (`scene-battle`, `battle-*`, `battle-resume*`, `battle-voice`, `victory*`, `overlay-revoir`) are produced before they are read.
