# Sub-project 3: the dragon grows from XP

Date: 2026-09-29. Part of `2026-09-29-progression-roadmap.md`; comes after sub-project 1 (the new
XP formula) and before sub-project 2 (which removes neutralisation). Art (the Dragon illustre, the
Dragon ancestral, the redrawn adult) comes from the art track (`2026-09-29-art-design.md`, Phase 1).
Approved by the user in advance ("assume I approve your further ideas").

## Goal

The dragon becomes the one long progress arc: six stages driven by total XP on a rising curve that
lasts from 5H to 8H and beyond. The ten XP ranks merge into the stages, so there is one gauge and one
name, the dragon's.

## 1. Stages and thresholds

| Stage key | Name | Total XP (default) |
|---|---|---|
| `egg` | Œuf | 0 |
| `hatchling` | Dragonnet | 100 |
| `young` | Jeune dragon | 1 200 |
| `adult` | Dragon adulte | 5 000 |
| `illustre` | Dragon illustre | 15 000 |
| `ancestral` | Dragon ancestral | 40 000 |

At about 80 XP a session plus quest and weekly bonuses, four sessions a week make roughly 400 XP a
week: the dragon hatches in the first sessions, is young within a month, adult within a school
term, illustre in the second year and ancestral in the third. The thresholds live in
`data/regles.json` (`dragon_stages`, same fallback rules as sub-project 1's file).

- The stage is stored and **never goes down** (a lowered threshold or a restored backup never shrinks
  it): stored = max(stored, stage for the XP).
- Neutralisation stops driving the stage (`dragon_stage`, `next_stage_at` and their callers in
  `progression.py` and `world.py` switch to XP). An existing profile keeps its stored stage.
- `hatched_at` is set when leaving `egg`, as today; the naming prompt is unchanged.

## 2. Ranks merge into stages

- `RANKS` and `rank_for` go; `progression.xp` reports `stage_before`/`stage_after` and the gauge's
  floor and next threshold (`floor`, `next`), replacing `rank_before`/`rank_after`/`title_after`.
  `GET /api/world` serves the stage table (key, name, xp) instead of `ranks`.
- The HUD's laurel bar shows progress to the next stage, labelled with the stage name; at the last
  stage it is full and says « Dragon ancestral ».
- The victory's gauge animation keeps its two-part logic (fill the old scale, then switch), keyed on a
  stage change instead of a rank change, and says « Ton dragon grandit ! » with the new stage name.
- The « Nouveau rang » wording and any rank title on screen go.

## 3. The dragon's words and looks

- `DragonStage` gains `illustre` and `ancestral` everywhere (server `STAGE_ORDER`, client type,
  `STAGE_LABELS`, `STAGE_ACTIVITY` « Il veille sur le camp et raconte ses exploits. » / « Il lit les
  vieux parchemins et veille sur toi. », `ART.dragon`, `Dragon.svelte` sizes, the dialogue `when.stage`
  lists).
- `stageLine` no longer counts lieutenants: from `young` on it says how much XP the next stage needs
  in words (« Encore un peu de gloire et je grandis. » when under 20 % remains, else « Chaque texte
  bien défendu me fait grandir. »); at `ancestral`: « J'ai tout lu, tout vu. Et je veille toujours sur
  toi. ». No number in the dragon's mouth; the HUD gauge carries the numbers.
- Every dragon dialogue event that has per-stage variants gets at least three variants for
  `illustre` and for `ancestral` in `content/dialogue/*.json` (the content tests require it). The
  illustre speaks with pride in its deeds, the ancestral with calm wisdom, never condescending; the
  copy rules of the content tests apply.
- The redrawn adult and the two new stages replace/extend `web/public/art/dragon/*_cut.webp`
  (merged from the art track).

## 4. Data

No migration: `dragon.stage` is free text. A test pins that a stored `adult` stays `adult` for a
profile with little XP, and that a profile with 16 000 XP reads `illustre`.

## 5. Testing

- Server: thresholds (defaults and from the rules file), monotonic stage, the world catalogue's stage
  table, `progression.xp` shape, no rank fields left.
- Client: `stageLine`, `stageActivity`, labels for six stages; HUD gauge per stage and at the top;
  victory stage-up animation; dialogue content tests with the two new stages; art test (the new
  `ART.dragon` paths exist).
- e2e: the victory's stage-up reveal, the HUD gauge, the nest showing each stage (seeded XP).
- Full gate clean (zero errors, zero warnings).
