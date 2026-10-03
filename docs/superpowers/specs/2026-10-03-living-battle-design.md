# The living battle (design)

Date: 2026-10-03. Status: implemented (plan 2026-10-03-living-battle.md); awaiting the user's look.
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
  each one live in the lab before it reaches the battle (superseded 2026-10-03: no stop, see The
  look).
- **Battle:** Combatant renders the living figure (through DragonFigure's living path or a sibling
  figure) for both fighters; the battle's own layout gets the new sizes.
- **Cost control** as in the nest: 30 fps, paused when hidden; two canvases at most on screen.

## Tests

- Unit: each rig bakes; feet / base boxes get zero weight; the Hydre's paired heads share a bone; the
  pose functions stay within their amplitudes.
- e2e: a battle renders a living canvas for the opponent and for a hatched dragon, the still picture
  under reduced motion and without WebGL2; reactions still play; the new sizes keep the battle UI
  clear at 1280x720, 1366x1024 and 1024x640.
- A human look at each antagonist live in the lab, then in a battle: after the implementation (see The
  look, below).

## Out of scope

Antagonists outside the battle (war tent, codex, oracle, victory thumbs, portraits); new art; big
moves that need the pictures split into parts.

## The look (for the user)

The rigs went into the battle without a stop (the user's choice, 2026-10-03: "I will check it last and
we can do the small adjustments later"): this is what to look at, and the small adjustments come after.

How to see them:
- The lab: `STACK=battle scripts/npm.sh exec -- vite build --config vite.lab.config.ts`, then
  `python -m http.server 8744 --directory web/dist-lab` and open http://127.0.0.1:8744/lab.html,
  section « Les adversaires » (« Comme au combat » mirrors them as in the battle; « Poids » shows each
  bone's region; « Amplitude » 1.5x is the game's, 3x shows any tear; « Pause » and « Temps » step
  through a motion).
- In a battle: `STACK=battle scripts/dev.sh` (Vite on http://localhost:5173), make or pick a hero, open
  any text's battle, then add `?encounter=<id>` to its link, e.g.
  http://localhost:5173/#/p/1/play/12?encounter=hydre (the hero's number after `/p/`, the text's after
  `/play/`; ids `eris`, `hydre`, `chimere`, `echo`, `lethe`, `protee`, `sirenes`). Éris's flustered
  pose shows when she is beaten (win a battle under `?encounter=eris`). A hatched hero's dragon lives;
  an egg stays still. The window's size picks the layout (the sizes below).
- The record: `docs/art/foe-rig.png` (the eight rigs' regions).

What to check, per foe:
- [ ] Éris: the hair streams, the apple arm bobs about the elbow, the hem sways; nothing on her face.
- [ ] Éris routed: her head sways with the hand at her brow; her hair on both sides.
- [ ] Hydre: the heads move in three pairs (top + upper-left, upper-right + middle-right, middle-left
      + lower-left); the tail tip curls. Another pairing is a rig change.
- [ ] Chimère: the lion's head and mane, the mane's locks, the goat (it sways with the lion, plus a nod
      of its own), the snake.
- [ ] Écho: the two ghosts drift apart a little; her side locks.
- [ ] Léthé: the two river bands and the robe flow; her long hair.
- [ ] Protée: the tentacle, the beard, the waves; the trident does not move.
- [ ] Sirènes: the four wing bones.
- [ ] Gentle on purpose, may want more: the Sirènes' wings (about 1 degree: at 1.6 to 1.8 their tips
      folded into the bodies and the rock at 3x), Léthé's ribbons (1.2 + 0.4 degrees, the robe 3 px)
      and Protée, the stillest foe (the tentacle 1.2 + 0.4 degrees, the beard 1.8). Raising one is a
      number in `web/src/lib/living/foes.ts`, checked at 3x in the lab for folds.
- [ ] Everyone: slow and slight enough (the amplitude is the dragon's 1.5x), the feet / base still; the
      hit, taunt and defeat reactions play on top.
- [ ] The dragon in battle: alive, tinted, its pieces on.
- [ ] The sizes: bigger, the opponent the larger, nothing over the hold bar, the parchment, the HUD or
      the exit sign. Measured box heights in px, before this spec and now (living-battle.spec.ts's
      "fighter sizes"):

      | Screen | Dragon | Opponent |
      |---|---|---|
      | 1280x720 | 259 to 301 | 360 to 446 |
      | 1366x1024 | 320 to 352 | 440 to 524 |
      | 1024x640 | 230 to 230 | 320 to 336 |
      | 1180x820 (the ipad project) | 295 to 295 | 410 to 410 |
      | 1024x768 | 276 to 276 | 384 to 384 |
      | 1920x1080 | 320 to 677 | 440 to 861 |

      The parchment's width bounds the fighters: each fills its side column and tucks under the
      parchment's edge only where nothing it faces with is hidden (the dragon 15 %, 16 % where its old
      size binds, its snout clear; the opponent 3 %, its transparent margin). Neither is ever smaller
      than before, and that wins: at 1180x820 and 1024x768 the column is narrow for the screen's height,
      so neither grew and the opponent tucks 7.7 % and 15 %, as before. Filling the whole height would
      need a narrower parchment (out of this spec).
- [ ] The iPad trade-off (Ruling B15, the dragon's face first): at 1180x820 and 1024x768 the dragon
      slides off the left screen edge (24 px, 8.1 % of its box, and 38 px, 13.6 %) so its eye and snout
      stay clear of the parchment; its far wing tip and tail are clipped at that edge. The other way
      (the whole dragon on screen) hides its snout under the parchment. A CSS tweak either way.
- Each fighter keeps one size through the battle (Ruling B16, final review): where the screen's
  height, not the column, bounds the opponent (1920x1080), its cap reads the HUD's band whether or not
  the HUD shows, so it is 861 px in the muster, while she writes and at the victory (it was 929 px
  while she wrote). living-battle.spec.ts asserts it at all six screens.

## Open items

None blocks the battle; for the user's look and the playtest:
- The look above and its small adjustments (the gentle foes, the iPad trade-off).
- The opponent's canvas spans the whole 1024 px frame plus its margin, wider than its 585 px portrait:
  cropping it to the portrait is deferred to the playtest (final review, minor 7).
- At 3x amplitude (the lab only; the game plays 1.5x) a soft compression remains on the Hydre's upper
  necks and on Éris's hair beside her elbow; clean at 1.5x.
- The right Sirène's orange leg lies on the seam between the middle and right wings and follows them a
  little; no test pins it.
