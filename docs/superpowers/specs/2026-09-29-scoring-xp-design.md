# Sub-project 1: scoring, XP and the review aids

Date: 2026-09-29. Part of the progression redesign (`2026-09-29-progression-roadmap.md`).
Art for this sub-project (Palamède) is in `2026-09-29-art-design.md`.

## Goal

Judge the child the way school does, on the mistakes left in the handed-in copy; let the child
choose which review aids to take, and pay XP for leaving them behind; show every bonus before the
dictation starts. Neutralisation is **not** touched here (sub-project 2 removes it).

## 1. Measures

**Per lieutenant, per session** (quest sessions now, lieutenant levels in sub-project 2). From the
session result's `byCategory`, summed over the lieutenant's categories (`LIEUTENANTS[k].categories`,
the derived `derived:sirenes` / `derived:lethe` included):
- chances = `opportunities`
- mistakes left = `missed + introduced`
- correct share = 1 − mistakes left ÷ chances

**Whole text, per session** (Éris fights and the copy line): mistakes left per 100 words =
100 × `finalErrors.length` ÷ `totalWords`, every category counted (accents, capitals, punctuation
included), as a teacher counts.

## 2. What the measures decide

| Decision | Rule (defaults, all in `data/regles.json`) |
|---|---|
| A quest session (board or Oracle) counts | the text gives the target lieutenant ≥ 3 chances **and** its correct share ≥ 85 % |
| An Éris fight is won | ≤ 4 mistakes left per 100 words |
| The copy line | ≤ 2: « belle copie »; ≤ 8: « copie correcte »; above: « copie à reprendre » |

Removed: the quest rule "≥ 6 chances with no draft mistake counts" and the catch-rate thresholds
(`min_rate` 0.5 / 0.7) of quests and fights; the fight's "too easy" draw (< 3 draft mistakes) and its
switch to a Grimoire retry. A clean copy simply wins. Active quests created before the change are
judged by the new rule (their stored `min_rate`/`min_draft` are ignored).

The copy line replaces « Gloire gagnée : N » on the victory sheet, in the camp's voice with the
count, e.g. « Ta copie : 3 fautes sur 120 mots. Une belle copie. » Never a grade out of 6.

## 3. The review aids

Five aids, each **taken along** or **left at the camp** before the dictation:

| Aid | Key | What it does when taken |
|---|---|---|
| Les yeux d'Argus | `argus` | Pass-by-pass review (verbs, noun groups, homophones, trap words) with the rest of the text dimmed (today's stage-1 behaviour); the "passes left" confirm on « J'ai terminé » |
| Le fil d'Ariane | `ariane` | Tap a verb, then its subject (unchanged) |
| Le bouclier de Persée | `persee` | One sentence at a time, last to first (unchanged) |
| La chouette d'Athéna | `athena` | 3 hints per session (`chouette_hints` in the rules file) |
| Les jetons de Palamède | `palamede` | « N pièges sont cachés dans ce texte », the notched battle bar and the compact bar count (today's stage-3 behaviour) |

- An aid left at the camp is absent from the proofreading screen for the whole session (no button,
  no pass strip, no count). There is no way to call it back mid-session.
- Each aid left at the camp adds **+20 %** (rules file) to the XP bonus.
- The choice is remembered per profile (`settings.aids`, a list of taken aids) and pre-selected next
  time. New profiles and profiles without the setting take all five.
- **Suggestion, never automatic.** After 3 consecutive dictations with a « belle copie » and the same
  aids, the screen suggests leaving the next aid in the order athena → argus → palamede → persee →
  ariane (« Tu pourrais laisser la chouette au camp. »), and highlights its toggle. After 2
  consecutive « copie à reprendre », it suggests taking back the last aid left. The child decides.
- Éris fights and the Grimoire corrompu use the same choice and the same bonus. The fight keeps its
  minimum pace; the "Yeux d'Argus restent éteints" rule and its copy go.
- The resume banner restores the aids chosen for that draft (saved in the play state).

**The automatic help stage is removed.** `next_help_stage`, the `help_stage_message` and the dragon's
line that speaks it, the `?help=` URL parameter and `PlayState.help`, the boss quest's
`help_stage`, `HINTS_PER_STAGE`, and the journal's help line and `HELP_RULE` all go. The journal
instead says which aids were taken last and « Chaque aide laissée au camp : +20 % de gloire. ».
The `profile.help_stage` and `session.help_stage` columns stay in the database (no destructive
migration); new sessions write 0. The bestiary's Argus and Muses `inGame` lines are rewritten (the
Muses no longer switch aids on and off).

## 4. XP

Computed on the server from the session result and the aids, as today:

```
words     = totalWords
m         = mistakes left per 100 words
effort    = 10 + words / 10
accuracy  = (words / 5) × max(0, 1 − m / 10)
rereading = 2 × caught
bonus     = pace bonus + 20 % × aids left + prophecy bonus
XP        = round(effort + (accuracy + rereading) × (1 + bonus))
```

- Pace bonus: pace 1 +0 %, pace 2 +25 %, pace 3 +50 % (rules file). A session at the retired pace 4
  (a stale page) counts as pace 3. The Grimoire has no pace bonus.
- Prophecy bonus +50 % (rules file), before the text's due date as today.
- The bonus multiplies only accuracy and rereading, never effort: going faster or without aids
  pays only when the copy is good.
- Example: 150 words, 3 mistakes left (m = 2), 4 caught, pace 2, two aids left: effort 25,
  accuracy 24, rereading 8, bonus 65 % → 25 + 32 × 1.65 = 78 XP.
- Quest, Oracle, fight, mastery and weekly bonuses are unchanged. XP totals and ranks are kept.
- The old client-side `score` (`computeScore`, « Gloire gagnée ») is removed. `SessionCreate.score`
  becomes optional and ignored; the server stores the session XP in the `score` column so the
  history and the library's best scores keep a meaningful number.

The victory's XP chips break the session XP down: « Texte +N », « Rythme +N », « Sans aides +N »,
« Prophétie +N », then the existing quest/weekly chips. The server returns the parts in
`progression.xp.parts` (`text` = effort + accuracy + rereading, and each bonus's share of the
multiplied part, split in proportion to its percentage and rounded so the parts sum to the session
XP).

## 5. The pace-and-aids screen (MusterPhase)

One screen, no scrolling on a desktop at 1280×800 and an iPad in landscape:

- **Wide parchment** (≥ 40 rem): two columns under the text's head. Left, « Ton rythme »: the three
  pace medallions as today, each with its bonus tag (« +25 % »). Right, « Tes aides »: five compact
  toggle rows (40 px emblem, name, one-line description; « +20 % » tag when left at the camp;
  `aria-pressed`, « Emporter » / « Laisser au camp »). Under both, full width: the total line
  (« Gloire de ce combat : +65 % », with the prophecy tag when it applies), the suggestion if any,
  and « Commencer la dictée ».
- **Narrow parchment**: one column; the aids become one row of five 48 px emblem toggles with their
  names under them and the description of the focused one below; the start button stays in view
  (sticky at the bottom of the parchment).
- The head shrinks to one line of tags (word count, quest, prophecy). The Grimoire shows only the
  aids column and its own start button. The resume view is unchanged plus a one-line reminder of the
  aids taken.
- The painted emblems are the existing `TOOL_ICONS` plus `tool-palamede`.

## 6. Removals

- **Stirring**: the server's `stirring` flag (`world.py`), its client type, `stirringCaption`, the war
  sheet caption, the camp news caption, `opponentFor`'s preference, the portrait's « quête de
  revanche » note, and their unit and e2e tests.
- The `help_stage` machinery listed in §3 and the `score` machinery listed in §4.

## 7. The rules file

`data/regles.json` in the game's data folder (the NAS's `./data`), read at server start-up:

```json
{
  "quest_min_chances": 3, "quest_min_correct": 0.85,
  "fight_max_per_100": 4,
  "copy_belle_max_per_100": 2, "copy_correcte_max_per_100": 8,
  "aid_bonus": 0.20, "pace_bonus": {"1": 0, "2": 0.25, "3": 0.5}, "prophecy_bonus": 0.5,
  "chouette_hints": 3
}
```

Every key is optional; a missing key uses the built-in default above. A malformed file or a value of
the wrong type is logged and ignored (defaults apply), so a typo never stops the game. The values the
client needs (copy line limits, bonuses, hints) are served with `GET /api/world`. The README's NAS
section documents the file.

## 8. Data

Migration `005`: `session.aids` (TEXT, JSON list of taken aids, NULL for old sessions);
`profile_stat.introduced` and `profile_stat_day.introduced` (INTEGER, default 0).
`apply_session_to_stats` writes `introduced`. `SessionCreate` gains `aids: list[str]` (the five keys,
validated) and loses the requirement on `help_stage` and `score`.

## 9. Palamède

A bestiary entry after Athéna (kind `tool`, three facts: the Greeks credited him with inventing
numbers (Gorgias, *Défense de Palamède* 30) and letters of the alphabet (Hyginus, *Fables* 277), and
dice (Pausanias 2.20.3); he unmasked Ulysses' feigned madness by laying baby Télémaque before his
plough (Hyginus, *Fables* 95); `inGame`: « Ses jetons te disent combien de pièges se cachent. »),
`ART.emblems.palamede`, `TOOL_ICONS.palamede`. The art comes from the art track.

## 10. Testing

- Server (pytest): the two measures; quest counting on the new rule; the fight verdict; XP formula
  (the worked example, pace 4 as 3, Grimoire without pace bonus, prophecy); the rules file (missing,
  partial, malformed, wrong types); migration 005 on a copy of a pre-005 database; `aids`
  validation; stirring gone from `/camp`.
- Client (vitest): the aid gating in ProofPhase for each aid on and off; the suggestion rule; the
  bonus total shown; the copy line wording; bestiary and art tests updated (37 icons, `TOOL_ICONS`
  keys, bestiary order).
- e2e (Playwright): rewrite the help-stage specs (`scenes-battle-play`, `scenes-battle`, `world`,
  `playability-ui4`, `scenes-cabin`, `scenes-battle-victory`, `happy-path`) around aids; new specs for
  the muster at 1280×800 and 1024×768 (no scroll, the start button visible) and at phone width (sticky
  start button), and for the XP chips.
- `scripts/check.sh` clean: tests, `svelte-check` with zero errors and zero warnings.
