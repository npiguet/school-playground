# The living battle (design)

Date: 2026-10-03. Status: agreed in conversation, awaiting the written review.
Builds on the living dragon (spec 2026-10-02-living-dragon-design.md, merged): the same WebGL2 mesh
skinning, rig files, baker, lab and still fallback.

## Why

The user, after the living dragon: "Could we apply the same kind of warping animations to all 7
antagonists as well?", for the battle only; and "you can also increase the size of both the dragon
and the antagonist there, they kind of look small and don't fill the screen very well."

## What she sees

- In battle (every phase, not only the muster and the victory), the opponent moves slowly and slightly
  on non-repeating periods, the way the dragon does in the nest; its feet / base never move. Today's
  CSS `idle-breathe` on the combatants goes.
- The hero's dragon in battle is alive too (controller assumption, stated to the user: it reuses the
  nest's rigs and tint; the egg stays still).
- Both fighters are bigger: they fill the battle stage's height (today the dragon is
  `clamp(140px, 36vh, 320px)` and the opponent `clamp(180px, 50vh, 440px)`); the new sizes are tuned on
  screenshots at 1280x720, 1366x1024 and 1024x640 so nothing of the battle UI (HP bars, the dictation
  and proofreading panels, the dialogue dock, the HUD) is covered and the opponent stays the larger.
- Motion per antagonist (at most 6 bones each):
  - **Éris:** hair streaming, the raised apple arm, the robe's hem, breath; her "flustered" picture
    (shown on defeat) gets its own rig.
  - **Hydre:** the six heads move in three pairs (user: "make a couple of heads move together as a
    pair"), plus the tail tip and breath.
  - **Chimère:** mane / lion head, goat head, snake tail, breath.
  - **Écho:** the two ghost copies drift a little, her hair, breath.
  - **Léthé:** the river ribbons of hair and robe flow (two or three bands), breath.
  - **Protée:** the tentacle arm, the beard, the waves at his base, breath; the trident stays steady.
  - **Sirènes:** the three sisters' wings (grouped into three or four bones), breath.
- Mirroring, the hit / taunt / defeat reactions (Web Animations on `.actor`) and Éris's swap to her
  flustered picture keep working on top of the motion.
- Reduced motion, no WebGL2, a lost context or a failed shader: today's still picture.
- Antagonists are never tinted.

## How

- **Generalise the engine** (web/src/lib/living/): a creature has its own bone names (at most 6, the
  shader's packing unchanged) and its own pose function (periods, amplitudes, phases); rig files are
  keyed by creature id (dragon stages keep theirs); the 585x1024 portrait sprites are padded into the
  1024 square frame (or the frame gets an aspect) so the mesh, margin and baker work unchanged.
- **Rigs:** hand-authored per creature in tools/art/rig.json (8 rigs: 7 antagonists + Éris
  flustered), baked by tools/art/rig.py, checked on debug overlays, then a STOP: the user watches
  each one live in the lab before it reaches the battle.
- **Battle:** Combatant renders the living figure (through DragonFigure's living path or a sibling
  figure) for both fighters; the battle's own layout gets the new sizes.
- **Cost control** as in the nest: 30 fps, paused when hidden; two canvases at most on screen.

## Tests

- Unit: each rig bakes; feet / base boxes get zero weight; the Hydre's paired heads share a bone; the
  pose functions stay within their amplitudes.
- e2e: a battle renders a living canvas for the opponent and for a hatched dragon, the still picture
  under reduced motion and without WebGL2; reactions still play; the new sizes keep the battle UI
  clear at 1280x720, 1366x1024 and 1024x640.
- A human look at each antagonist live in the lab, then in a battle.

## Out of scope

Antagonists outside the battle (war tent, codex, oracle, victory thumbs, portraits); new art; big
moves that need the pictures split into parts.
