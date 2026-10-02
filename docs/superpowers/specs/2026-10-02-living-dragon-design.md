# The living dragon (design)

Date: 2026-10-02. Status: spike approved by the user (watched live), awaiting the written review.
Spike: `C:\Users\nicol\.claude\jobs\9ac9a508\tmp\spike-living` (FINDINGS.md, index.html, rig.json,
tools/make_weights.py); throwaway, to be ported, not copied wholesale.

## Why

Playtest: the dragon's breathe and parallax read as floating and were removed (2026-10-02). The user
wants it to look alive the way mobile games animate 2D sprites: a slight head tilt and nod, a slow
small wing lift, a tail swish, a breathing chest.

## What she sees

- In the nest and on the camp, the hatchling, young, adult, illustre and ancestral dragons move
  slowly and slightly: head, wings, tail, breath, on non-repeating periods. The feet never move.
- Amplitude: **1.5x the spike's 1x** (head about 2.25 + 0.75 deg, wings about 2.4-2.7 deg, tail about
  3.6 + 0.9 deg, chest +2.4 % wide / +1.2 % tall, lift 3.6 px on the 1024 frame).
- The worn pieces move with the dragon as rigid passengers (no stretching, the saddle included).
- The tint looks exactly as today and never recolours the pieces.
- The egg, reduced motion, no WebGL2, a lost context or a failed shader: today's still picture
  (DragonFigure's markup), unchanged.

## How

- **Technique** (proven by the spike): one canvas per dragon, WebGL2, a 64x64 grid mesh with a 3.5 %
  margin over the 1024 frame, six bones (head, wingL, wingR, tail: rotations about pivots; chest:
  scale; lift: vertical translation), linear-blend skinning in the vertex shader, weights from
  per-stage weight maps; alpha below about 4 % dropped.
- **Rigs:** hand-authored per stage (hatchling, young, adult, illustre, ancestral) in a rig file
  (pivots, region polygons, ramps, blur radii, feet-pin zone), baked by a script into the weights the
  game loads (one RGBA PNG or per-vertex weights, whichever is smaller). The spike's adult and
  ancestral rigs are the start; **the ancestral's horn tip must take the head's weight** (it lags in
  the spike). Each rig is checked on its debug overlay.
- **Pieces:** composited into a second texture in `DRAW_ORDER`; each piece is skinned rigidly with the
  dragon's weights at its anchor point.
- **Tint:** `TINT_FILTERS` stay the single source; their CSS functions become colour matrices in the
  fragment shader, on the dragon texture only.
- **Component:** `LivingDragon` replaces the base `<img>` inside `DragonFigure` for the nest and
  camp layers, keeps the box, sizing and `.dragon-figure` wrapper (mood animations still apply);
  `role="img"` and the alt as `aria-label`; the worn pieces listed in a data attribute for tests.
  The battle combatants keep their still picture (later).
- **Cost control:** the loop stops when the page is hidden or the canvas is off-screen, and runs at
  30 fps.
- **Tooling:** the weight baker and its debug helpers move into the art-overlays skill (or a sibling
  skill) with how to author a rig.

## Tests

- Unit: the tint matrices match the CSS functions; each rig bakes; pinned feet get zero weight; a
  piece's weights are rigid.
- e2e: the nest and camp render a canvas for a hatched dragon and the still picture for the egg,
  under reduced motion and with WebGL2 disabled; the worn pieces are listed; two frames differ over
  time and the feet band does not.
- A human look at each stage in the browser before merging.

## Out of scope

Big flaps or a true head turn (they need the art split into parts); the battle combatants; the camp
dragon's size (later).

## Open item noticed

The « écume » tint (`hue-rotate(190deg) saturate(.9)`) gives a blue leaning towards periwinkle; it is
outside the violet band the tests guard (violet is Éris's) but worth a look by eye.
