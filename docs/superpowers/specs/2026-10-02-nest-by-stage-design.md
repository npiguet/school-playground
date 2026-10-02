# The nest grows with the dragon (design)

Date: 2026-10-02. Status: approved in conversation (playtest feedback of 2026-10-02), awaiting the
written review.

## Why

Playtest: the nest has no sense of scale. One painting (`nest.webp`) serves every stage, with a
broken eggshell painted in (wrong even for the egg, which has not hatched), so the ancestral dragon
sits next to a shell as big as itself.

## What she sees

- One nest painting per stage; the place grows around the dragon (the camera pulls back), and the
  dragon itself grows a lot on screen: she still looks at the dragon first.
  - **egg:** a close-up of a straw nest in a sheltered hollow; no shell.
  - **hatchling:** the egg's painting with the broken shell beside the nest (an inpainted variant of
    the egg's painting, so the two match exactly).
  - **young:** a bigger straw nest on a rocky ledge.
  - **adult:** a cave aerie.
  - **illustre:** the aerie grown grander (a small hoard, banners).
  - **ancestral:** a mountain lair open to the sky.
- All six keep the nest's warm light and palette, so it reads as the same home growing.
- The dragon's size and feet line per stage (art % of the 16:9 frame; the square sprite's height on
  screen is its width x 16/9):

  | stage | width | height on screen | feet at y |
  |---|---|---|---|
  | egg | 16 | ~28 | 54 |
  | hatchling | 21 | ~37 | 55 |
  | young | 38 | ~68 | 77 |
  | adult | 40 | ~71 | 80.5 |
  | illustre | 44 | ~78 | 88 |
  | ancestral | 47 | ~84 | 94 |

  Set with the user on the chosen paintings (2026-10-02): a bigger egg in a small nest, sitting down
  in its hollow with the hatchling's shell; the young about 45 % larger than first planned (x 51.5,
  so its box clears the sheet), standing in the straw of a big close-up nest, which pushed the adult
  and the illustre up a size; their heads come within 1 % of the HUD line. The painted landmarks
  (straw, shell, rocks) read at the right size next to the dragon; Task 4 tunes only within the HUD
  and sheet checks, and the head always stays below the HUD.
- From the adult stage, the growth sheet (the next stage and the XP gauge) moves to the side of the
  frame and the dragon shifts the other way (centre around x 44 instead of 50); the sheet never
  overlaps the dragon or the HUD at any stage.
- The care hotspot (tap the dragon: « Ton dragon », the care panel) follows the dragon's size per
  stage.

## Art

- 6 paintings, 2048x1152, `assets/art/scenes/nest_<stage>.png` + `.json` (krea2 skill, forge-neo),
  served as `web/public/art/scenes/nest_<stage>.webp` (q88); `nest.webp` and its source go once
  nothing uses them.
- Each painting leaves the dragon's spot empty and paints its ground (straw or rock) on that stage's
  feet line, across the dragon's width.
- The hatchling's painting is made from the chosen egg painting by the two-pass inpaint method of
  the krea2 skill (the shell only).
- 2-3 variants per stage are shown to the user, who picks, before the code is tuned on them.

## Code

- `NEST_SCENE`'s background comes from the dragon's stage (`ART.scenes.nest[stage]` or the like);
  the camp preloads the current stage's painting.
- `nestDragonLayer(stage)` takes its width, feet line and centre from one per-stage table (the
  table above, tuned); depth 0, no idle (as today).
- The care hotspot's shape per stage (`nest.shapes.ts`).
- The growth sheet's position by stage (beside the dragon up to young, at the side from adult).
- `docs/art/scenes.md`: the nest's landmarks per painting.
- Tests: unit: every stage has a painting, a size, a feet line and a hotspot, the sizes grow at
  every stage, the head stays below the HUD line; e2e: each of the six stages shows its own painting,
  the dragon and the growth sheet stay clear of each other and of the HUD (the existing test, per
  stage), the hotspot covers the dragon.

## Interplay

- The living dragon (spec 2026-10-02-living-dragon-design.md) renders inside the same layer box; the
  larger sizes only change the box.
- Out of scope: the camp's dragon (later), the care panel, tints.
