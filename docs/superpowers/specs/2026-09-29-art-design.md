# Art track for the progression redesign

Date: 2026-09-29. Serves every sub-project of `2026-09-29-progression-roadmap.md`. It runs as one
continuous track, started first in the implementation plan and in parallel with the code, so the
local Forge instance is freed as early as possible. Tools and recipes: the `krea2` skill
(generation, inpainting, object extraction) and the `art-cutout` skill (background removal, WebP
export).

## Rules for the whole track

- Model `krea2_turbo-Q3_K_M`, passed on **every** call; 8 steps (9 for inpainting), CFG 1,
  Euler/Simple. Each final asset keeps its PNG, `_cut.png` when cut out, and sidecar JSON in
  `assets/art/...`; the game reads WebP copies under `web/public/art/`.
- Styles: cut-outs and objects `discorde-inked-clean`; emblems `discorde-emblem`; scenes
  `discorde-illustration` (2048×1152). Reuse the dragon's character-sheet sentence from
  `docs/art/style-guide.md` §4 verbatim.
- **Generation time is not a constraint** (the user's ruling): try as many seeds as it takes, redo
  anything mediocre, never settle for a weak result to save time.
- If Forge is busy with the user's own work, poll until it is idle; never read its files.
- Every phase ends with a contact sheet in `docs/art/` (on dark, mid and parchment backgrounds) for
  the user to look at; the user can veto any asset, which is then regenerated.
- No text baked into images, no emoji, no violet on the dragon or its gear (violet is Éris's).
- Record every final seed in `docs/art/style-guide.md` (a new "Progression redesign" section).
- **Every method goes into a skill as soon as it is proven** (the user's ruling), so no later art
  work rediscovers it: what worked, the exact settings and commands, what was tried and rejected
  and why. Generation and inpainting recipes go into the `krea2` skill; the object-extraction
  pipeline (the segmentation venv, slot masks, overlay and manifest scripts) into a new
  `art-overlays` skill with its scripts under `tools/art/`; export and cut-out changes into
  `art-cutout`. The end of each phase is a checkpoint: the phase is not done until its skills are
  updated and committed.

## Phase 1: Palamède and the dragon stages

**Palamède** (sub-project 1). One emblem, `assets/art/emblems/palamede.png`, style
`discorde-emblem`, 1024², like Ariane's (seed range 510-529): Palamède's counting tokens, a small
heap of engraved bronze and bone counters and pebbles with Greek numerals, beside a wax tablet. Cut
out → `web/public/art/emblems/palamede_cut.webp`; reused small as `tool-palamede.webp` through
`tools/art/icons.py` like the four other tools (legible at 48 px is the acceptance test).

**Stages** (sub-project 3; needed first because the slot masks and accessories depend on them).
Style `discorde-inked-clean`, 1024², isolated on white, all three drawn in the **young dragon's
three-quarter pose** (head toward the right of the picture, body side, back, tail and both wings
visible), so accessories on the neck, tail, back and head all show:
- `dragon_illustre`: the adult grown heavier and more powerful, armour-like overlapping scales,
  longer horns, wings half spread, proud and confident, still friendly; renowned, not menacing.
- `dragon_ancestral`: as strong as the illustre, silvered horn tips and muzzle, long whiskers like a
  beard, an open scroll held in one front claw, calm wise eyes; a scholar, not frail.
- `dragon_adult` **redrawn** in the same pose (today it faces the viewer almost head-on, which
  hides the back and tail). The old picture stays in git history; if the user prefers it on the
  contact sheet, it is kept and its back slot is dropped.

Acceptance: the same species and colours as the existing stages (bronze-gold scales, amber eyes,
cream belly, ivory horns, copper membranes), a clear size and dignity progression young → adult →
illustre → ancestral, clean cut-out edges (`art-cutout` check).

## Phase 2: extraction test and slot masks (Forge mostly idle)

1. **Segmentation set-up.** A Python venv under `tools/art/seg/` (host Python + pip, GPU torch
   wheel; not shared with Forge) with `transformers`: Grounding DINO base + SAM 2.1 large (ungated).
   SAM 3 only if the user accepts Meta's licence on Hugging Face and provides a token.
2. **Throwaway test** on the young and redrawn adult stages: one collar and one helmet each through
   the pipeline in the `krea2` skill (tight slot mask → inpaint → segment the object → intersect with
   the mask and the changed pixels → RGBA overlay). Pass: the overlay composited on the stage and on
   a tinted stage (the CSS `hue-rotate` tints) shows no repainted skin, no halo, no missing parts.
   If it fails, fix the method (mask shape, denoise, soft inpainting, segmentation prompt) before
   Phase 4.
3. **Slot masks.** For the four wearing stages (jeune, adulte, illustre, ancestral) × four slots
   (cou, queue, dos, tête): segment "neck", "tail", "back", "head" on each stage, keep the band where
   the item sits, dilate a few pixels past the outline. Save `assets/art/dragon/slots/<stage>_<slot>.png`;
   check all 16 by eye on one contact sheet.

## Phase 3: trophies, house, stall

**Trophies** (sub-project 2): 30 objects, one per lieutenant and level, isolated on white, 1024²,
`discorde-inked-clean`, cut out, exported as 256 px icons (`trophy-<lieutenant>-<level>.webp`) and
512 px for the shelf's close view. Each trophy is the lieutenant's relic made as a keepsake in the
level's material, the detail rising with the level:

| Level | Material | Detail |
|---|---|---|
| 1 | bois | a simply carved wooden figure of the relic on a plain block, few lines |
| 2 | bronze | cast bronze, a few engraved lines, a small round base |
| 3 | argent | polished silver, engraved patterns, a stepped base |
| 4 | or | gold with relief decoration and small gems, a column base |
| 5 | orichalque | reddish-gold orichalcum, intricate filigree, gems, a sculpted base with laurels |

Relics: écaille de l'Hydre, voix d'Écho (a shell), crinière de la Chimère, perle de Protée, plume
de Sirène, pavot de Léthé. Acceptance: all five of one relic recognisably the same object; the
ladder of richness readable at 64 px.

**House interiors** (sub-project 4): `villa` and `palais`, 2048×1152, `discorde-illustration`, the
same camera and room plan as `scenes/cabin.png` (shelf and hooks on the left wall, desk in the
middle, lyre table, bed on the right, window at the back) so the hotspots map across, with more
bare wall for decor: the villa in plastered stone with a painted frieze, two windows and a second
shelf; the palais with columns, a mosaic floor and a view through an arch onto a courtyard.
Candidate route: img2img from `cabin.png` at a moderate denoise to keep the plan; txt2img if that
does not lift the richness enough.

**Hermès's stall** (sub-project 4): painted into `scenes/hub_camp.png` by inpainting on the empty
grass in front of the white wall (left, between the wall and the nest), everything else
pixel-identical so no other hotspot moves: a small market stall with a striped awning, amphorae,
shelves of goods and a winged-sandal sign. Plus `characters/hermes` (768×1344, cut-out: Hermès as a
cheerful travelling merchant, winged sandals and cap, caduceus) and `icons/drachme` (a silver
drachma with an owl, 1024² → 256 px icon).

## Phase 4: the accessories

24 items × 4 wearing stages = 96 overlays (sub-project 4), each made with the Phase 2 pipeline on the
stage picture and its slot mask. Several seeds per item and stage; keep the best. A set's four pieces
share one colour and motif family.

| Lieutenant | Cou (level 2) | Queue (level 3) | Dos (level 4) | Tête (level 5) |
|---|---|---|---|---|
| Hydre | collier d'écailles vertes | anneau de serpents de bronze | selle de cuir des marais | casque de bronze à crête de serpents |
| Écho | pendentif-conque | clochettes de bronze | cape couleur de roche | diadème de coquillages |
| Chimère | torque en cornes de chèvre | garde-queue à tête de serpent | cape rouge braise | casque à crinière de lion |
| Protée | collier de perles | anneau de corail | harnais d'écailles marines | couronne de corail |
| Sirènes | pendentif en forme de lyre | rubans de plumes | harnais de plumes | aigrette de plumes bleues |
| Léthé | collier de pavots rouges | petite lanterne d'argent | cape bleu nuit étoilée | couronne de pavots |

Files: `assets/art/dragon/accessories/<item>_<stage>.png` (RGBA, full stage size) and a manifest
`web/public/art/dragon/accessories.json` giving, per item and stage, the WebP of the cropped overlay
and its x/y offset in the stage picture. Cropping keeps the web budget small: the current
`art.test.ts` limit (2.5 MB of non-scene art) will not hold 96 overlays and 30 trophies, so
sub-projects 2 and 4 raise it deliberately, with the new total written in the test.

Acceptance: every overlay on its stage, in bronze and in two tints, at game size: sits on the body
(no floating collar), covers no eye, no halo, matches the ink and paint style.

## Order and dependencies

1 → 2 → 3 → 4 in that order: the stages feed the masks, the masks and the test feed the accessories.
Phase 3 can start while the Phase 2 segmentation runs, as it needs Forge and Phase 2 mostly does
not. Each sub-project's code picks up its finished art from `web/public/art/`.
