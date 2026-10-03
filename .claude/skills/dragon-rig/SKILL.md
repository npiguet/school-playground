---
name: dragon-rig
description: "Author, bake and check the living figures' rigs: the dragon's stages (head, wings, tail, breath) and the battle's foes (spec 2026-10-03 living battle), on one painted sprite each, WebGL2 mesh skinning. Use when a dragon stage or a foe picture changes, when a part lags, tears or moves when it should not (a horn, a wing tip, the feet), or to tune a rig's motion regions."
---

# The living dragon's rigs

The game animates each hatched stage's single sprite (`web/public/art/dragon/dragon_<stage>_cut.webp`)
with a 64 x 64 mesh and six bones (spec `docs/superpowers/specs/2026-10-02-living-dragon-design.md`).
A rig says, per stage, where each bone turns and what it moves. The motion itself (periods and
amplitudes) is code: `web/src/lib/living/pose.ts`.

The tints are baked (amended 2026-10-03): the game's texture for a tinted dragon is the stage's baked
picture `dragon_<stage>_<tint>.webp` (the same size, the same alpha, so the same rig), and the shader
tints nothing in the game. A re-cut stage sprite therefore needs both a rig bake and a tint bake:
`tools/art/run_docker.sh bake` (`web/src/lib/world/bakedTints.test.ts` fails until it is done).

## Files

| File | What |
|---|---|
| `tools/art/rig.json` | The rigs, hand-authored: per stage six bones (pivot, region, ramp, blur) and the pin rectangle. Integers only. |
| `tools/art/rig.py` | The baker and its views (runs in the art tools' container, nothing installed on the host). |
| `web/src/lib/living/rig/dragon_<stage>.json` | What the game loads: pivots, feet box, per-vertex weights (base64). Baked, never edited. |
| `web/src/lib/living/rigs.test.ts` | Fails when a rig or a sprite changed since the bake, when the feet carry weight, or when the ancestral's horn tip lags. |
| `tools/art/rig-out/` | Scratch (gitignored): `grid_<stage>.png`, `rig_<stage>.png`. |
| `docs/art/dragon-rig.png` | The debug views of the authored stages, kept as the record. |

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
- `pin`: a rectangle over the feet (or the hatchling's shell), blur about 14. The feet box (the
  rectangle inset by 3 x blur on top and both sides, rounded inward to the 16 px mesh, down to the
  bottom) gets zero weight: size the rectangle so the box holds every claw (`rig bake` prints it).

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

Every stage with a rig, living side by side, then every foe (« Les adversaires », below): amplitude
(1.5x by default, the game's), tint (the baked pictures, as in the game), worn pieces, the weights
view (« Poids »), pause and a time slider. Above them the « Teintes » panel previews a tint live on
the shader with its sliders, beside the baked picture; a new setting goes into
`web/src/lib/world/tintSpecs.json`, then a re-bake.

## Stage notes

- hatchling: no tail shows, so the tail has a pivot and no region; the shell is the pin. Its blur is
  8 (rectangle x 228-800 from y 605) so the left wing's long lower tip (x 160-210, y 600-665) stays
  out of it, and `lift` ramps from the shell's rim (y 640) up, so the rim never rises with the breath.
- young: the tail's curl runs behind the hind legs to the right; only the part left of the legs is
  in its region, and the pin's corner softens the curl's bottom beside the left foot.
- adult: the feet box starts at y 896 and spans x 224-816 so both outer feet's claws are inside.
- illustre: the right wing sits behind the neck, keep its polygon off the neck; the long left horn
  reaches x 390, inside the head polygon.
- ancestral: the head polygon reaches the frame's top so the right horn's tip takes the head's weight
  (a test checks it); the feet box starts at x 224 for the left foot's claws (about x 245).
- every stage: each wing's claw tip and the far tips of its edges are probed in `rigs.test.ts`
  (weight >= 0.9 on the wing); add a probe when you move a tip. Only opaque pixels inside a polygon
  count (the background takes its nearest opaque pixel's weight), so a tip a few pixels outside the
  polygon is lost: run the polygon well past it. The hatchling's right claw tip sits 126 px from its
  pivot, so that wing ramps over [30, 140].
- illustre and ancestral: the front claw tip curls under the left horn, a few pixels below it. The
  head polygon's left edge runs between the horn's underside and the claw (about y 75 at x 450,
  y 105 to 110 at x 500), then down at x 505 (illustre) or 535 (ancestral), left of the crest spikes
  and right of the claw tip; the ancestral's claw tip keeps under 0.1 of the head (a test checks it).
- illustre: the left wing's lower finger touches the tail's tip at about (115, 855); the tail polygon
  starts at x 122 so the finger above y 820 stays on the wing.

## The foes

The battle's opponents live on the same engine (spec `docs/superpowers/specs/2026-10-03-living-battle-design.md`).

- Keys in `rig.json` (`stages.ts` `FOE_RIGS`): `eris`, `eris_flustered` (Éris routed), `hydre`, `chimere`,
  `echo`, `lethe`, `protee`, `sirenes`. Each block names its sprite (`"sprite": "web/public/art/..."`, part of
  the bake hash) and bakes to `web/src/lib/living/rig/foe_<id>.json` (with `"width": 585`).
- The 585 x 1024 portrait is padded, centred, into the 1024 frame: it sits at x 219-804. Read every
  point off `rig grid --stage <id>` (the grid view shows it padded).
- A region may be several polygons: `"polys": [[...], [...]]`.
- The four rigid bones are named per foe, in `web/src/lib/living/foes.ts` (`FOE_MOTIONS`, which also
  holds the motion); the block's key order must match (a test pins it), then `chest` and `lift`:
  eris `hair, hairFront, arm, hem`; eris_flustered `hairL, hairR, head, hem` (`hem` has a pivot and no
  region); hydre `pairHaut, pairDroite, pairBas, tail`; chimere `lion, mane, goat, snake`; echo `ghostL,
  ghostR, hairL, hairR`; lethe `ribbonL, ribbonR, robe, hair`; protee `tentacle, beard, waveL, waveR`;
  sirenes `wingL, wingInner, wingC, wingR`.
- `rig foe-sheet` writes `docs/art/foe-rig.png`, the foes' debug views for the record.
- The lab's « Les adversaires » shows every foe (a rig not baked yet as its still portrait);
  « Comme au combat » mirrors them as in the battle.
- The lab tiles are small; to judge a seam at 3x, render the skinned frame at full size offline (the
  shader's displacement is `sum w_i (B_i p - p)`, linear across each 16 px cell) and look at crops.

Foe notes:

- eris: the hair turns about the back of her head ([30, 200] from the pivot); its polygon stops about
  15 px right of her raised elbow and forearm (the arm stays still), takes the strands under the
  bracelet down to y 545 but stays right of x 590, where her robe's edge starts (else the robe swings).
  The apple arm turns about the elbow (378, 350); its polygon runs left of the locks at her shoulder.
- eris_flustered: the head's `ramp: [260, 180]` gives the hand at her brow and the forearm the head's
  weight, fading to the elbow; the chest ellipse is 80 x 90 with blur 24 (at 60 x 70 blur 30 it peaked
  under 230 / 255 and failed "each region carries its bone").
- hydre: no necks of different pairs cross; they run side by side. The two upper pairs fade along y
  (`ramp: [380, 250]` and `[500, 360]`) so each neck bends smoothly into the body, and they take blur 14:
  at blur 8 the top neck and the upper-right neck folded over each other at 3x. `pairBas` (the two
  left heads and the curl between them) fades by distance from (360, 640). The tail turns about where
  it leaves the ground coil (600, 905); its polygon's top stays under the coil above (y 884 and lower),
  else the coil's edge is dragged along. The two left snouts touch the top neck: `pairBas` runs to x 478-480
  there with blur 6 (at blur 12 the snout tips stayed under 0.85 and lagged; run past x 480 and the top
  neck's outline is dragged along), and a test probes each head's eye and snout. The pairs swing 1.1 to
  1.2 deg (plus 0.3): at 1.6 to 2.0 deg the top neck tore from the upper-right one at 3x.
- chimere: the goat's head sits against the lion's mane along a long seam, so the goat sways with the
  lion (the lion's waves plus a nod of its own, in `foes.ts`) and turns about (520, 400); with motions
  of their own the seam folded. The lion polygon stops left of the horn's tip (x 488 at the top). The
  snake's polygon runs down to x 615 so its whole left edge (beside the goat's beard and the rump) is
  inside; its swing is 2.0 + 0.6 deg (at 2.6 + 0.8 it folded into the beard at 3x). The pin covers the
  rock and the four paws (the hind paw's toes reach x 725).
- echo: the ghosts drift (frame px, no turn), ramped along y (`[900, 420]`) so their feet stay. Their
  polygons follow the main figure's outline about 20 to 25 px outside it (her hair, her raised hands,
  her arms down to the elbows, her robe), blur 8, so the ghost takes the stretch and her dark outline
  stays put; her side locks (`hairL`, `hairR`) are only the hair below her elbows. The chest ellipse is
  75 x 70, blur 24 (60 x 60, blur 30 peaked at 0.87).
- lethe: the ribbons turn about where they leave the sleeves, faded both by distance (`ramp_from_pivot`)
  and toward the pool (`ramp`, zero at y 850), blur 16; the robe drifts 3 px at 1x, blur 18. With
  1.8 + 0.6 deg ribbons and a 4 px robe, blur 10 and 14, the seams between the robe and the bands folded
  at 3x; now 1.2 + 0.4 deg. `hair` is only the locks beside her face and on her shoulders (y 140-312),
  never the sleeves below.
- protee: the trident, its three tips, its shaft through the waves and the hand holding it carry nothing
  (a test probes them); `lift` has no region, so the breath is the chest's alone. The tentacle turns
  about the elbow (668, 425) by 1.2 + 0.4 deg (at 2.8 + 0.9 its curl folded into the net at 3x); its
  polygon's edge stays at x 664-668 beside the curl so the curl's own rim takes the stretch, not the
  net. The left crest lies only 16 to 24 px left of the shaft (x 291-329 against 345 at y 880), so `waveL`
  holds only its left part (polygon to x 300, blur 4, full from y 880 down): every vertex carrying weight
  stays at least 30 px off the shaft, and a test checks every vertex of the trident's two boxes is zero.
- sirenes: the wings hang beside the still rock and lie against the sisters' bodies along long seams, so
  they turn about a degree (wingL 1.0, wingInner 0.8, wingC 0.9); at 1.6 to 1.8 deg their tips (500 px
  below the shoulders) swung 50 px at 3x and folded into the bodies and the rock. The middle and right
  wings touch along one seam: the right one sways with the middle one plus a beat of its own (as the
  Chimère's goat). Polygon edges stay 20 to 30 px off the rock's edges and off the left sister's body;
  the pin runs to x 668, the rock's right corner. The right sister's orange leg (about x 685-705,
  y 560-620, beside the rock) lies on the seam between the middle and right wings and takes about half
  of each (wingR 0.5-0.6, wingC 0.06-0.3), so it follows them a little; no test pins it.
