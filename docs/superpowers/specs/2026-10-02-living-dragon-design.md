# The living dragon (design)

Date: 2026-10-02. Status: approved by the user (spike watched live, written review done) and implemented on the
living-dragon branch.
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
- The tint is the user's OKLCH presets at full strength (chosen 2026-10-02 in the lab, plan Ruling
  L9), the same on the living dragon and on every still picture, and never recolours the pieces.
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
- **Tint** (plan Ruling L9, 2026-10-02: the user preferred OKLCH to the CSS filters, "It looks more
  natural than the CSS shift"): `TINT_SPECS` (`web/src/lib/world/dragon.ts`, an OKLCH hue shift, chroma
  and lightness factors per tint, strength 1; bronze none) is the single source. The fragment shader
  tints the dragon texture only with the steps of the CPU reference (`web/src/lib/living/tint.ts`);
  every still picture of the dragon (DragonFigure, the HUD and dialogue portraits, the swatch eggs) is
  tinted once on a canvas with that same reference (`use:tintedDragon`,
  `web/src/lib/living/stillTint.ts`), so the canvas and the still picture match. `LivingDragon` takes
  the tint's name (`tint: Tint`) and shows it in `data-tint`; a still picture's `img` carries
  `data-src` and `data-tint` too. The CSS filters (`TINT_FILTERS`) and their colour matrices are gone.
- **Component:** `LivingDragon` replaces the base `<img>` inside `DragonFigure` for the nest and
  camp layers, keeps the box, sizing and `.dragon-figure` wrapper (mood animations still apply);
  `role="img"` and the alt as `aria-label`; the worn pieces listed in a data attribute for tests.
  The battle combatants keep their still picture (later; amended by
  `2026-10-03-living-battle-design.md`: both fighters live in battle).
- **Cost control:** the loop stops when the page is hidden or the canvas is off-screen, and runs at
  30 fps.
- **Tooling:** the weight baker and its debug helpers move into the art-overlays skill (or a sibling
  skill) with how to author a rig.

## Tests

- Unit: the presets are exact; the still tint equals the CPU reference; no preset turns the
  dragon's colours into Éris's violet (OKLCH hue band, a chroma under 0.04 read as grey; the known
  exceptions were accepted by the user on 2026-10-02); each rig bakes; pinned feet get zero weight; a
  piece's weights are rigid.
- e2e: the nest and camp render a canvas for a hatched dragon and the still picture for the egg,
  under reduced motion and with WebGL2 disabled; the worn pieces are listed; two frames differ over
  time and the feet band does not.
- A human look at each stage in the browser before merging.

## Out of scope

Big flaps or a true head turn (they need the art split into parts); the battle combatants (amended
by `2026-10-03-living-battle-design.md`: both fighters live in battle); the camp dragon's size
(later).

## Open item noticed (resolved)

Resolved on 2026-10-02: the user chose the OKLCH presets now in `TINT_SPECS` by eye, écume
included, and accepted the violet guard's known exceptions listed below.

The « écume » tint (first `hue-rotate(190deg) saturate(.9)`, now OKLCH shift 165, chroma 0.9) gives a
blue leaning towards periwinkle; its body colours are outside the violet band the tests guard (violet
is Éris's) but worth a look by eye, with the known exceptions of the violet guard (braise's darkest
shadows, the blue-green highlights under jade, olivier and écume).
