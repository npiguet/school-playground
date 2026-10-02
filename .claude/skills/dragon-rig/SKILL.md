---
name: dragon-rig
description: Author, bake and check the living dragon's rigs (head, wings, tail, breath on one painted sprite per stage, WebGL2 mesh skinning). Use when a dragon stage picture changes, when a part of the living dragon lags, tears or moves when it should not (a horn, a wing tip, the feet), or to tune a stage's motion regions.
---

# The living dragon's rigs

The game animates each hatched stage's single sprite (`web/public/art/dragon/dragon_<stage>_cut.webp`)
with a 64 x 64 mesh and six bones (spec `docs/superpowers/specs/2026-10-02-living-dragon-design.md`).
A rig says, per stage, where each bone turns and what it moves. The motion itself (periods and
amplitudes) is code: `web/src/lib/living/pose.ts`.

## Files

| File | What |
|---|---|
| `tools/art/rig.json` | The rigs, hand-authored: per stage six bones (pivot, region, ramp, blur) and the pin rectangle. Integers only. |
| `tools/art/rig.py` | The baker and its views (runs in the art tools' container, nothing installed on the host). |
| `web/src/lib/living/rig/dragon_<stage>.json` | What the game loads: pivots, feet box, per-vertex weights (base64). Baked, never edited. |
| `web/src/lib/living/rigs.test.ts` | Fails when a rig or a sprite changed since the bake, when the feet carry weight, or when the ancestral's horn tip lags. |
| `tools/art/rig-out/` | Scratch (gitignored): `grid_<stage>.png`, `rig_<stage>.png`. |
| `docs/art/dragon-rig.png` | The five debug views, kept as the record. |

## Commands

```bash
tools/art/run_docker.sh rig grid  [--stage S]   # the sprite under a 50 px grid, to read coordinates off
tools/art/run_docker.sh rig bake  [--stage S]   # the game's weights
tools/art/run_docker.sh rig debug [--stage S]   # weights over the greyed sprite: head red, left wing green,
                                                # right wing blue, tail yellow, pin darkened, feet box magenta,
                                                # pivots as white dots
tools/art/run_docker.sh rig sheet               # docs/art/dragon-rig.png
STACK=<s> scripts/npm.sh run test -- src/lib/living
```

## The bones

- `head`: rotation about the neck base. Region: the head, both horns to their tips, crest and beard,
  and the neck; `ramp: [y_shoulders, y_jaw]` fades it along the neck to nothing at the shoulders.
- `wingL`, `wingR` (left and right as seen): rotation about each shoulder. Region: the whole membrane
  and the arm, generous into the background past the tips; `ramp_from_pivot` fades it near the shoulder.
- `tail`: rotation about the hip. Region: the tail from the hip to the tip, tight where it passes the
  legs or a wing tip. A stage whose tail does not show (the hatchling in its shell) has no region.
- `chest`: a breathing scale. An ellipse on the chest, blur about 30.
- `lift`: the upper body's rise with the breath: `"all": true` with `ramp: [y_feet, y_hips]`.
- `pin`: a rectangle over the feet (or the hatchling's shell), blur about 22. The feet box (the
  rectangle inset by 3 x blur on top and both sides, down to the bottom) gets zero weight.

## Authoring a stage (about 20 minutes)

1. `rig grid --stage S`, then read the grid view (Read tool): note the neck base, both shoulders, the
   hip, the jaw line, the horn tips, the wing tips, where the feet stand.
2. Write the stage's block in `rig.json` (start from the closest stage's block), then `rig bake` and
   `rig debug --stage S`, and look at `rig_<S>.png`.
3. Check, and fix the polygons until all hold:
   - the head is red to the tip of every horn, the crest and the beard; the neck fades to grey at the
     shoulders; no red on a wing;
   - each wing is coloured to its tips and a little beyond, fading to grey at its shoulder; never on
     the body or on the other wing;
   - the tail is yellow from the hip to the tip, and nowhere on a leg or a wing tip;
   - every foot is inside the magenta feet box; nothing coloured inside it;
   - the pivots sit at the neck base, the shoulders and the hip.
4. Watch it live in the lab (below) at 1.5x and at 3x: no tearing, no streaks off the outline, the
   pieces seated, the feet still.
5. `rig sheet`, run the tests, commit `rig.json`, the baked JSON and the sheet together.

Lessons from the spike: a horn or a wing tip left out of its region lags behind (the adult's left
horn, the ancestral's right horn); wing-tip polygons must be generous into the background; overlap
zones (tail against a wing tip) must stay tight; the cut-outs' faint background haze is dropped by
the shader (alpha below about 4 %), never by the rig.

## The lab

```bash
STACK=<s> scripts/npm.sh exec -- vite build --config vite.lab.config.ts
python -m http.server 8744 --directory web/dist-lab     # then open http://localhost:8744/lab.html
```

Every stage with a rig, living side by side: amplitude (1.5x by default), tint, worn pieces, the
weights view, pause and a time slider.
