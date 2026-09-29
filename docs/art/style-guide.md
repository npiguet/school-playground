# La Discorde — art style guide

Art direction for the game's visuals. Every asset is generated locally with Krea 2 Turbo
(see `.claude/skills/krea2/SKILL.md`); the exact prompt, seed and settings of each kept
asset live in the sidecar `.json` next to its PNG, so any asset can be regenerated or
re-cut later.

## 1. Direction in one sentence

Young-adult mythology novel cover: painterly, clean confident linework, soft cel shading
with painted light, expressive faces and slightly stylised proportions. Dramatic and a bit
theatrical, never gory, never horror. The audience is 13 and reads Percy Jackson, Wings of
Fire and Harry Potter: the art should look like something she'd want on a book cover, not
something aimed at small kids.

## 2. Palette

| Role | Colour | Hex (guide) | Used for |
|---|---|---|---|
| Marble white | warm off-white | `#F3EDE2` | stone, chitons, UI panels |
| Terracotta | warm brick orange | `#C4663A` | roofs, pottery, warm accents, Ariadne's thread (`#D9452E`) |
| Olive | muted green | `#7A8A4B` | foliage, cushions, Hydre scales |
| Aegean blue | deep sea blue | `#2C5F8A` | sea, sky, iris of eyes, emblem enamel |
| Gold | burnished gold | `#D4A63A` | jewellery, the apple, medallion rims, dragon scales |
| Discord violet | deep purple to black | `#5B2C83` → `#1B1421` | Éris only: her dress, eyes, hair streaks, discord smoke |

Rules: Mediterranean, sun-bleached, warm. Violet/black is reserved for Éris and her
influence (discord smoke in the battle scene, the wisp on the apple emblem) so the villain
reads instantly. Gold accents stay small except on the dragon and the emblems.

## 3. Style files (append with `--style <name>`)

- `.claude/skills/krea2/styles/discorde-illustration.txt`: scenes (full-bleed, never cut out).
- `.claude/skills/krea2/styles/discorde-inked.txt`: characters, creatures and anything else
  that gets cut out. Same painterly direction plus an "inked cut-out look": a dark ink
  outline around the whole silhouette, crisp closed edges, hair as thick defined locks,
  opaque wing membranes, nothing glowing / misting / smoking into the background, and the
  negatives `(wispy hair:-2) (soft glow:-2) (mist:-2) (shadow:-2)`. Misty subjects (Léthé,
  Écho's copies, Protée's water) keep their concept but as solid inked shapes, "like a
  carved marble relief". This exists because soft strands and glow are what background
  removal gets wrong.
- `.claude/skills/krea2/styles/discorde-inked-clean.txt`: the cleaner-line variant of
  `discorde-inked`, used for the dragon stages, Écho and L'Hydre (2026-09-24 regeneration).
  Keeps the gouache/acrylic shading ("warm and cool colour variation inside every shape")
  but asks for *one clean medium-weight* outline of even thickness, finer interior lines,
  and negatives `(sketchy lines:-2) (rough brush strokes:-2) (scratchy hatching:-2)
  (thick heavy outline:-1.5) (shadow:-2)`. A first try with a heavy comic outline cut out
  perfectly but looked too heavy; `(thick heavy outline:-1.5)` is what lightens it. Use it
  for new cut-out assets; the older ones still use `discorde-inked`.
- `.claude/skills/krea2/styles/discorde-texture.txt`: low-contrast UI surface tiles (marble).
- `.claude/skills/krea2/styles/discorde-emblem.txt`: round bronze/gold medallion UI emblems
  (add "a clean dark ink outline around the medallion's outer rim" to the prompt).

Prompt recipe (see the sidecars): framing → lighting → `subject:` block (longest) →
negatives as `(word:-2..-3)` → `isolated on a flat plain white background` for anything
that gets cut out. Generated with `--vscale 1.0` so the negative weights bite. Portrait
cards 768×1344, creatures/emblems 1024×1024, scenes 1344×768 (UI2 scenes: 2048×1152, see §5) with an "open empty sky in the
upper third" for the UI.

## 4. Character sheets

Reuse these sentences verbatim in any new prompt so recurring characters stay consistent.

All cut-out assets were regenerated on 2026-09-24 with `discorde-inked` (seeds below;
the sidecars hold the exact prompts, which add a "hair as thick solid locks" / "opaque
wing membranes" sentence and `(cast shadow on the ground:-3)` for the ground shadow that
`(shadow:-2)` alone did not remove).

**Éris** (seed 102; smug variant seed 111, whose far-left grey hair wisps are the one
known weak spot, to be retouched by hand): *Éris, the Greek goddess of discord, a tall vain theatrical villainess
with a haughty sly sideways smirk, chin tilted up, half-lidded scheming eyes with dark violet
eye makeup and one sharply arched eyebrow, long wild black hair with violet streaks flowing
as if in wind, a flowing dark purple and black chiton dress with gold embroidered trim, a
spiky golden crown, gold arm bracelets, holding a shining golden apple.*
Attitude: theatrical diva, smug, sore loser. Never sweet, never scary. Always add
`(sweet friendly kind smile:-3)`.

**Cleaner-line pass (2026-09-24, `discorde-inked-clean`)**: dragon egg 201, hatchling 202,
adult 204, young 283, Écho 392, Hydre 331 (before/after in
`docs/art/cutout-comparison/04-lines-dragons-echo-hydre.png`). Prompt tips from it:
- "dramatic warm/cool rim light from the side" paints a coloured band *outside* the ink
  line, which reads as a sticker rim once cut out. Drop it for cut-outs and write "whole
  creature visible with room around it, soft even lighting"; for the Hydre also add
  `(orange rim light:-2) (glow:-2)`. Do not add `(sticker border:-3) (halo around the
  outline:-2)` on top: it made the edge blotchier, not cleaner.
- Pose words drift with this style: the young dragon sat down until the prompt said
  "standing proudly upright on all four legs ... legs straight" plus `(sitting:-2)`.
- Écho lost her feet or got a knee-length dress until the prompt said "the whole figure
  visible from the top of the head down to the bare feet with room above and below" and
  "ankle-length chiton".
- The Hydre prompt (five heads + a stump sprouting two small heads) now gives six equal
  heads and no visible stump; accepted, as the regrowth reads as part of the myth.

**The dragon companion** (seeds 201–204, young 283 since the cleaner-line pass): *a dragon of the Discorde species, burnished
bronze-gold scales, amber eyes, a pale cream belly, curved ivory horns, leathery wings with
copper-coloured membranes, a row of ivory spines down its back.* Stages: egg (bronze-gold
scaled shell, amber glow through cracks, nest of olive branches) → hatchling (horn nubs,
stubby wings, sitting in the shell) → young (large-dog size, half-spread wings, small flame)
→ adult (long horns, huge wings spread, noble stance). The player recolours it later: keep
the hue shift in CSS/canvas, not in new generations.

**Lieutenants** (seeds: Hydre 331, Écho 392, Chimère 333, Protée 304, Sirènes 305, Léthé 316):
- L'Hydre: five-headed serpent, olive-green scales fading to Aegean blue, cream belly, one
  cut stump sprouting two small heads. Each head has a different expression. Say "all five
  heads are snake heads" and add `(human face:-3)`, or one head turns human.
- Écho: slender nymph, long wavy pale teal hair, pale blue-green chiton, bare feet, hands
  cupped to call, two fainter copies of herself behind her painted as solid pale shapes
  with their own outline. Never write "cut-out" in a prompt: it produces a white die-cut
  sticker border.
- La Chimère: lioness body in terracotta-gold with a fiery mane, a goat head with curled
  horns growing from the back, a tail ending in an olive-green snake head. Do not write
  "the three heads argue": the model then draws three heads side by side. Describe it as
  the Homeric Chimera (lion in front, goat in the middle, serpent behind) with "one single
  lion head" and `(three heads side by side:-3)`.
- Protée: stocky old sea god, seaweed-and-foam beard, coral-and-shell crown, Aegean blue
  skin with sea-green scales, net-and-kelp chiton, one arm becoming an octopus tentacle,
  lower body dissolving into water, driftwood trident, sly wink.
- Les Sirènes: three bird-women, women from the waist up, bird bodies with Aegean blue,
  olive and cream plumage below, perched on one white marble rock, lyre / double flute /
  singing.
- Léthé: serene dreamy woman, hair and grey-blue robe flowing into stylised solid ribbons
  of water "like a carved marble relief" (no mist), half-closed eyes, crown of red poppies,
  holding a silver bowl of still water. Add `(wings:-3) (angel:-3)` or she gets wings.

## 5. Asset list

All under `assets/art/`. `*_cut.png` = same image with the white background removed
(alpha). `web/` holds the WebP copies the game loads (max 1024 px long side, q82).

| Asset | Path | Size |
|---|---|---|
| Éris, main card | `characters/eris.png`, `eris_cut.png` | 768×1344 |
| Éris, smug/gloating variant | `characters/eris_smug.png`, `eris_smug_cut.png` | 768×1344 |
| Dragon egg / hatchling / young / adult | `dragon/dragon_{egg,hatchling,young,adult}.png` + `_cut` | 1024×1024 |
| Lieutenants | `lieutenants/{hydre,echo,chimere,protee,sirenes,lethe}.png` + `_cut` | 768×1344 |
| Scenes: camp (hub, dawn), Delphes, Alexandrie, Parchemins, Argus sanctuary, battle | `scenes/{camp,delphes,alexandrie,parchemins,argus,battle}.png` | 1344×768 |
| Emblems: Yeux d'Argus, Fil d'Ariane, Bouclier de Persée, Chouette d'Athéna, golden apple | `emblems/{argus,ariane,persee,athena,apple}.png` + `_cut` | 1024×1024 |
| Scenes UI (UI2): title gates, camp hub, nest, Delphi, library tent, war tent, cabin, Éris's lair, 3 battle backdrops | `scenes/{title_gates,hub_camp,nest,delphi,library_tent,war_tent,cabin,eris_lair,battle_river,battle_coast,battle_temple}.png` | 2048×1152 |
| Pythia, Athena's owl | `characters/{pythia,owl}.png` + `_cut` | 768×1344, 1024² |
| Props: votive tablets, codex on a lectern, trophy shelf | `props/{votive_tablets,codex_lectern,trophy_shelf}.png` + `_cut` | 1024², 768×1344, 1344×768 |
| Marble texture tile | `textures/marble.png` | 1024² |
| Icons: rewards, avatars, lieutenant glyphs, add menu, seal, lock, app apple | `icons/<id>.png` + `_cut` (see Icons below) | 1024² |

The older 1344×768 scenes keep the upper third calm for the HUD, and the old battle backdrop keeps
its centre empty so the lieutenant card and the dragon can be composited over it. They stay in place
for the current screens. The UI2 scenes are covered in the next subsection, and their landmark boxes for hotspots are
in `docs/art/scenes.md`.

### Scenes UI (UI2, 2026-09-24)

Native **2048×1152** (Krea 2 Turbo is happiest around 2–2.5 MP; nothing was upscaled), style
`discorde-illustration`, `--vscale 1.0`, 8 steps. The cut-outs use `discorde-inked-clean` and the
unchanged `cutout.py`. The scene WebPs are exported at 2048 px wide, q88, 190–294 KB each, under the
600 KB budget. Export them with `webify.py --src <folder with only the new PNGs> --dst
web/public/art/scenes --max-px 2048 --quality 88` from a staging folder, so the old scene WebPs are
not rewritten.

**Seeds** (the sidecars hold the exact prompts): title_gates 602, hub_camp 601, nest 603,
delphi 604, library_tent 605, war_tent 806, cabin 507, eris_lair 608, battle_river 509,
battle_coast 510, battle_temple 511, pythia 701, owl 802, votive_tablets 703,
codex_lectern 704, trophy_shelf 705, marble 902 (style `discorde-texture`). 28 generations in total.

**Composition sentence** appended to every scene prompt (it's in the sidecars):
*"Composition: a wide 16:9 game background seen from a little distance, all the important objects
are grouped in the middle of the picture, the outer eighth on the far left and on the far right
holds only soft background scenery such as plain wall, foliage or sky; the ground in the lower part
of the picture continues naturally with the same texture and light but with few small details; the
top edge is calm."* followed by `(people:-2) (text:-3) (letters:-3) (signs:-3) (busy details:-2)`.

Prompt tips from this batch:
- **Never ask for a "calm, plain, uncluttered bottom fifth".** Krea paints a flat blank beige band
  across the bottom 30 % (nest, war tent and library first tries). Ask for "the ground continues
  naturally with the same texture and light but with few small details" instead.
- "Every important element sits in the middle three quarters" is not enough to keep things out of
  the iPad crop. **Name positions**: "about one fifth in from the left edge", "left of centre, set
  in from the left edge", "right of centre, well inside the picture". Even so, the hub's nest and
  cabin still overhang the 12.5 / 87.5 lines slightly, so clip those hotspots (see `scenes.md`).
- Six landmarks in one hub works if each gets its own sentence with a position, a strong colour
  identity (cream-and-blue striped library pavilion, red-and-bronze war tent, white cabin with a
  terracotta roof, marble temple on a hill, a nest on a rock, a wooden archway toward stormy
  hills), and "each standing alone with open grass between them".
- A "tripod stool" gives a bar stool. Write "a tall ancient Greek bronze tripod, three long curved
  bronze legs holding a wide round shallow bronze bowl as a seat" plus `(bar stool:-3)`.
- For empty slots the game fills (shield hooks, portrait sheets), say "bare hooks with nothing
  hanging on them" plus `(shields:-3)`, or "blank empty sheets of parchment each fixed only by one
  small bronze pin at its top edge" plus `(daggers on the sheets:-3)`. With "pinned with daggers"
  the dagger covers the middle of every sheet.
- For the "empty dragon spot" in the nest, say "the middle of the nest is completely empty and
  open, a soft hollow waiting for a dragon" plus `(dragon:-3) (creature:-3)`.
- A villain lair came out as a daylit courtyard until the prompt said "a dim enclosed hall at
  night lit only by poison purple and acid green light from below", "deep inside a mountain", and
  `(daylight:-3) (sky:-3)`. Keep `(skulls:-3) (blood:-3)` so it stays ominous, not horror.
- In `discorde-inked-clean`, a plain "Athena's owl" comes out as a naturalistic field-guide bird.
  "A lively story character, a small stylised little owl ... simple clean feather shapes ...
  clever amused look" plus `(realistic photo:-2) (detailed realistic feathers:-2)` gives the
  sidekick look. Also ask for "plenty of empty white room" or the perch gets cropped.
- Painted scrolls and journals still get illegible pseudo-writing (library notes, cabin journal).
  It reads as texture, not text, and was accepted.
- Textures: `discorde-texture` (in `styles/`) plus "uniform all over so it can repeat". Marble
  worked. Parchment got a vignette and bronze turned into honeycomb, so CSS does those better.

Not yet made (candidates for a later batch): the Muses, per-stage dragon colour variants, a
title/hero banner 1536×640. Player avatars and small item icons are done (see Icons below).

### Immersion wave overlay art (UI3a Task 1, 2026-09-25)

New surfaces and objects for the overlay panels (playability findings #1 scroll/table overlay
variants, #20 portal icon): a wood board (table overlay), a rolled scroll (shelves, Pythia panels),
and the portal-arch icon (Alexandria portal plaque). Style `discorde-texture` for the wood,
`discorde-inked-clean` for the scroll and the icon, `--vscale 1.0`, 8 steps.

**Seeds**: wood_board 911, scroll_rolled 921 (cut out), portal-arch 1060 (cut out, seeds table
below). Parchment was tried at seeds 903, 904 and 905 and rejected all three times (see below). 6
generations in total for this task (3 kept, 3 rejected parchment tries).

Prompt tips from this batch:
- **The parchment vignette from UI2 was not fixed by "the four edges exactly as light as the
  centre" plus `(vignette:-3) (dark edges:-3) (burnt edges:-3)`.** All three seeds (903, 904, 905)
  still measured 8-11 % darker at the corners than at the centre (checked with Pillow, not just by
  eye — seed 903 was clearly the worst and was rejected outright; 904 and 905 were closer calls).
  The real test isn't the single tile: run it through the `seamless()` quadrant-shift
  `tools/art/uiart.py` uses and tile the *result* 2×2. Because the shift relocates each corner to
  the new tile's centre, a vignetted source turns into a **repeating grid of dark blotches** at
  the tile centres and corner-junctions — worse than the flat seam the pass exists to hide. Both
  904 and 905 failed that check, so parchment stays a CSS gradient plus inline SVG grain (Task 2's
  `kit.css`), not a generated image (Ruling W3).
- The wood board (four wide planks, `(vignette:-3) (honeycomb:-3) (nails:-2)`) worked on the first
  try and needed no regeneration: it reads clearly as planks with knots and dark plank seams. Its
  average colour (`#5c3d2f`) is lighter than the `#3b2715` target, but the contrast ratio against
  the `--bronze-ink` text colour (`#fff7e6`) is already ≈9:1 (WCAG AAA), so a CSS `--wood-dark`
  overlay is a polish option here, not a requirement.
- The rolled-scroll prompt needed "blank" plus `(writing:-3) (seal:-3)` to keep the parchment
  surface empty (the wax seal and any title text are drawn in CSS/HTML on top, so they can't be
  baked in and broken by the cut-out); both gold-capped knobs and the wound cord came through
  clean on the first try, and the cut-out has no white rim on a dark background.

### Parchment retry (2026-09-25): shipped, seed 903

The three earlier tries (903-905 above) all asked for "soft blotchy tone variation" as a *positive*
attribute, which is exactly the kind of slow, low-frequency shading `seamless()`'s quadrant-shift
turns into a repeating blotch grid. The retry changed the approach on three fronts instead of
trying more seeds with the same wording:

- **Prompted as a low-contrast text background, not a scenic material.** No "tone variation"
  anywhere in the prompt; instead "very low contrast, an almost perfectly uniform pale tone …
  exactly the same brightness at the corners as at the centre" plus a longer negative list
  (`vignette`, `dark edges`, `dark corners`, `corners`, `stains`, `blotches`, `spots`, `burnt
  edges`, `torn edges`, `text`, `writing`, `border`, `objects`, `shadow`, all at `-2`/`-3`). No
  style file: `discorde-texture`'s own paragraph asks for "soft gouache tone variation", which
  fights this prompt directly, so it was dropped for this one asset.
- **`generate.py --tiling`** (new flag, confirmed against `/openapi.json`:
  `StableDiffusionProcessingTxt2Img.tiling` is a real, if undocumented, txt2img field) asks the
  sampler itself for an edge-matching image, on top of the prompt wording.
- **`tools/art/uiart.py` gained a `flatten()` step**, run before `seamless()` for any `TABLE` entry
  with a target RGB: divide the image by a large Gaussian blur of itself (radius = long side / 6)
  to cancel whatever low-frequency shading is still left, re-centre on the kit's parchment tone
  (`--parchment-solid: #f3e6c8` in `web/src/styles/kit.css`), then compress the remaining grain so
  luminance std stays ≤ 3 (0-255 scale).

Seed 903 (1024², `--vscale 1.0 --tiling`, no style) passed on the **first try**, so seeds 904/905
were not needed this time:

```bash
python .claude/skills/krea2/generate.py --size 1024x1024 --seed 903 --vscale 1.0 --tiling \
  --prompt "a flat, top-down paper texture tile filling the entire frame edge to edge, meant to sit as a plain background behind small printed text: pale warm ivory parchment paper, very low contrast, an almost perfectly uniform pale tone across the whole image, only very fine faint paper fibres visible up close, flat even studio light with no shading anywhere, exactly the same brightness at the corners as at the centre, a seamless tileable pattern with no visible seam when repeated. (vignette:-3) (dark edges:-3) (dark corners:-3) (corners:-2) (stains:-3) (blotches:-3) (spots:-2) (burnt edges:-3) (torn edges:-3) (text:-3) (writing:-3) (border:-3) (objects:-3) (shadow:-3)" \
  --out assets/art/textures/parchment.png
```

Measured with Pillow/NumPy: raw generation, corner-vs-centre luminance already close (corner mean
228.1, centre mean 232.8, diff 4.7 out of 255 — down from ~26 on the rejected 904/905); after
`flatten()` + `seamless()`, corner and centre means match to three decimal places (230.376 vs
230.376) and the overall luminance std is 2.06 (≤ 3 target). A 3×3 tile with a line of dark ink
text over it (`docs/art/parchment-tiled-check.png`, not committed) shows no seam, no grid and no
darker corner at full resolution, and the text stays perfectly legible. Exported at 512×512, WebP
quality 82, **3 KiB** (well inside the 150 KB texture budget). `ART.textures.parchment` is back in
`web/src/lib/world/art.ts`.

### Icons (2026-09-24)

Small painted icons that replace the emoji the UI used as markers (see `docs/art/icon-inventory.md`
for every site). Originals + sidecars + `_cut.png` in `assets/art/icons/`; the game loads
`web/public/art/icons/<id>.webp` (256×256, alpha, trimmed to the object and centred with a 6 %
margin, all under 20 KB). Contact sheet at 128 and 64 px on dark and parchment:
`docs/art/icons-sheet.png`. Export with `tools/art/run_docker.sh icons` (`tools/art/icons.py`).

**Ids and seeds** (style `discorde-inked-clean`, 1024², `--vscale 1.0`, 8 steps):

| Group | Id → seed |
|---|---|
| Relics (`REWARDS` ids) | ecaille_hydre 1041, voix_echo 1002, criniere_chimere 1043, perle_protee 1004, plume_sirene 1005, pavot_lethe 1006 |
| Gear | sandales_hermes 1007, egide 1008, foudre_zeus 1009 |
| Decor (`decor:x` → `decor-x`, a colon can't be in a file name) | decor-lanterne 1010, decor-tapis 1011, decor-bibliotheque 1012, decor-trophee 1013, decor-fresque 1014 |
| Avatars (`AVATARS` keys) | avatar-chouette 1031, avatar-dragon 1032, avatar-lyre 1044, avatar-trident 1022, avatar-laurier 1023, avatar-foudre 1030 |
| Lieutenant glyphs | lt-hydre 1042, lt-echo 1016, lt-chimere 1045, lt-protee 1018, lt-sirenes 1019, lt-lethe 1046 |
| Add menu | add-text 1025 (quill on parchment), add-scan 1050 (bronze lens on a stand; a first box-camera try, 1033, was anachronistic), add-alexandria 1047 (stacked scrolls) |
| Misc | seal-oracle 1034, lock 1048 |
| Place icon (UI3a Task 1, playability #20) | portal-arch 1060 (a stone archway with a golden portal swirl, for the Alexandria portal plaque) |
| Home-screen icon | app-apple 1049 → `web/public/icons/{icon-192,icon-512,apple-touch-icon,icon-maskable-512}.png` |
| Reused, no generation | tool-persee, tool-athena, tool-ariane, tool-argus = the existing `emblems/*_cut.png` medallions, which read fine at 64 px |

`tint:*` rewards stay CSS swatches (the tinted egg). 44 generations in total (36 icons + 8 redos).
The app icon is the painted apple on the terracotta ground (`#C0623B`, a soft lighter centre),
at 74 % of the side and 56 % for the maskable one. It replaces the flat SVG apple; the old
`npm run icons` script (`web/scripts/make-icons.mjs`) has been removed (UI3a Task 6) so it can no
longer be run by accident and overwrite the painted PNGs — see `tools/art/icons.py app` instead.

**Composition sentence** (every prompt; the sidecars hold the full text): *"a single object centred
in the frame with plenty of empty white room on every side, seen from a slight three-quarter angle,
soft even warm light from the upper left. subject: … One bold simple silhouette made of a few large
clear shapes with a clean dark ink outline all around and rich saturated colours, readable at a very
small size, (scenery:-3) (text:-3) (letters:-3) (cast shadow on the ground:-3), isolated on a flat
plain white background."* Relics end their subject with "an ancient treasured relic". Avatars start
with "a proud heraldic hero emblem, richly painted with burnished gold accents": that phrase gives
the badge look the avatar set shares (the trident and the bolt gained small wings from it).

Prompt tips from this batch:
- Never write "icon", "cut-out" or "sticker" (die-cut white borders). "One bold simple silhouette
  ... readable at a very small size" is enough to get a clean, readable object.
- Without "a clean dark ink outline all around and rich saturated colours" the first objects came
  out pale and outline-less (a flat gold bolt, an egg-like scale). Keep that clause.
- A "scale" alone gives an egg or a seed. Say "shaped like a pointed shield or a kite ... a raised
  ridge ... smaller overlapping scale shapes engraved along its edge" plus `(egg:-3)`.
- "Locks of a lion's mane" gave the back of a lion's head with ears. Write "three long separate
  locks ... fanned out upward like a small bouquet of flames, bound ... by a gold band" plus
  `(ears:-3) (animal head:-3) (face:-3)`.
- A single snake head reads as any snake. For the Hydra, three heads on one coiled body is the
  readable minimum. A plain lion head reads as a lion, not the Chimera: add the goat horns and the
  small snake. One lion try came back letterboxed with black bars; `(black border:-3) (frame:-3)`
  fixed it.
- Léthé in "carved marble relief" words got blank statue eyes. For a face, say "visible dark
  eyelashes and soft grey-blue irises ... warm living skin" plus `(blank white eyes:-3)`.
- Bronze objects pick up a blotchy multicolour patina. Say "smooth polished warm golden bronze,
  clean even metal" plus `(patina:-3) (rust:-3)`.
- The golden apple came out green-yellow with a worm-like violet wisp. "Made of polished burnished
  gold metal like a divine treasure" plus `(green apple:-3)`, and a violet ribbon bow instead of
  a wisp.
- Small or pale objects (a few scrolls, a poppy) come out small in the frame. That doesn't matter
  for the export, which trims to the object, but "large and filling most of the picture" gives a
  bolder result.
- Known weak spots, accepted: `egide` has a lump of gold scales on its right rim; `foudre_zeus`
  is thin at 64 px (`avatar-foudre` is the bolder bolt); `add-text` is pale on parchment; the
  lock's body has two "ears".

## 6. Tooling (no host installs)

`tools/art/run_docker.sh all` runs, inside a throwaway `python:3.12-slim` container with the
repo mounted at `/work`:

- `tools/art/cutout.py <folders>`: background removal → `*_cut.png` with rembg
  `birefnet-general` + rembg alpha matting (erode 4, foreground 250, background 5), no
  other post-processing. Chosen over `isnet-general-use` (hard staircase edge with a 1-px
  white rim, holes in pale areas) and over wider matting bands / colour decontamination
  after a side-by-side comparison; the before/after sheets are in
  `docs/art/cutout-comparison/`. Skips existing outputs unless `--force`. About 20 s per
  image on CPU; the ~900 MB model and the pip wheels are cached in two named Docker
  volumes (`art-rembg-cache`, `art-pip-cache`), versions are pinned in `run_docker.sh`.
- `tools/art/icons.py webp|sheet|app|all` (`run_docker.sh icons`): the 256 px icon WebPs in
  `web/public/art/icons/`, the contact sheet `docs/art/icons-sheet.png`, and the home-screen PNGs in
  `web/public/icons/`. `assets/art/icons` is among the default cut-out targets.
- `tools/art/webify.py`: WebP export of every PNG into `assets/art/web/`, prints the total.
  Copy the `*_cut.webp` files (and scenes) to `web/public/art/` afterwards; the game only
  references those paths (`web/src/lib/world/art.ts`).

`assets/art/web/` is intermediate staging output, never a source of truth: every run mirrors
the *whole* `assets/art` tree into it (there is no `--src`/`--dst` narrowing in normal use), so
it always holds far more than whatever a given task actually shipped. Nothing in the app, the
tests or the scripts reads from it - the game, the tests and `scripts/*.sh` only ever read the
copies under `web/public/art/`. It is listed in `.gitignore` and never committed; re-run
`webify.py` to regenerate it locally whenever you need to eyeball a export before copying it to
`web/public/art/`.

Regenerate one asset: `python .claude/skills/krea2/generate.py --prompt "<prompt from the
sidecar>" --style discorde-illustration --size 768x1344 --seed <seed> --vscale 1.0 --out
assets/art/...`, look at it, then rerun the Docker tools.

No text is baked into images; the game adds all text in HTML.

`run_docker.sh` resolves the repo path with `pwd -W` under Git Bash. Before UI2, a precedence
slip made it print two paths, so `docker run -v` failed. That's fixed now, and `props/` is among
the default cut-out targets.

## Progression redesign (2026-09-29)

The art track of `docs/superpowers/specs/2026-09-29-art-design.md`. Settings everywhere: model
`krea2_turbo-Q3_K_M`, CFG 1, Euler/Simple, NegPiP V-scale 1.0. Sidecars hold the full prompts.

### Phase 1: Palamède and the dragon stages

**Palamède** (`emblems/palamede.png`, `discorde-emblem`, 1024², 8 steps): **seed 518** (12 tried,
510-521). Subject: *a large neat heap of thick round counters filling the middle of the medallion:
polished bronze discs and pale ivory bone discs, each engraved with one single simple geometric
mark (a line, a cross or a small triangle), a few grey and terracotta river pebbles, and leaning
upright behind the heap an ancient Greek wax writing tablet, a rectangular wooden frame around a
recessed panel of dark honey-coloured wax scratched with a few straight tally strokes*, plus
`(faces:-3) (buttons with holes:-3)`. Lessons: "counters engraved with dots and strokes" drew dots
that read as little faces or buttons (seeds 510-513); "one single simple geometric mark" fixed it.
"A small open wax tablet" gave a wooden tag or a scroll; "a rectangular wooden frame around a
recessed panel of dark honey-coloured wax" gives the tablet. Exports (staged, see the art-cutout
skill): `assets/art/export/emblems/palamede_cut.webp` (1024 px, q82, 109 KB) and
`assets/art/export/icons/tool-palamede.webp` (256 px, reads at 48 px as a heap of tokens and a
tablet).

**Dragon stages** (`discorde-inked-clean`, 1024², isolated on white). All three were made by
**img2img from the previous stage** (`tools/art/img2img.py`, no mask), which keeps the young
dragon's three-quarter pose (head toward the right, back, side, tail and both wings visible), its
colours and its framing, so slot masks and accessories line up from stage to stage:

| Stage | From | Denoise / steps | Seed | Subject change |
|---|---|---|---|---|
| `dragon_adult` (redrawn) | `dragon_young.png` | 0.78 / 10 | 614 | the size of a horse, long curved ivory horns, large wings raised and swept back, longer neck, calm protective confident |
| `dragon_illustre` | `dragon_adult.png` | 0.85 / 9 | 621 | the size of an elephant, broad deep chest, thick neck, massive legs, scales "grown large and overlapping like polished armour plates", very long sweeping horns with a second smaller pair, tall spines, "a famous hero not a monster", `(menacing:-2)` |
| `dragon_ancestral` | `dragon_illustre.png` | 0.80 / 10, then far-wing inpaint 0.75 / 11 | 630, then 640 | silvered muzzle and horn tips, long silver-white whiskers like a beard, heavy brows, calm wise kind eyes, "standing on three legs and holding up an open parchment scroll in its raised right front claw", "a venerable sage not frail" |

The ancestral's far wing came out slate blue at every seed; it was repainted copper by inpainting a
SAM 2.1 mask of that wing (prompt: "the far wing ... warm copper-coloured and rust-orange membranes
... the same warm copper as the near wing, (blue:-2) (grey:-2) (violet:-3)"). The small far-wing
sliver below the scroll claw stays slate blue (accepted, it reads as shadow).

Rejected: **txt2img for the adult** (seeds 600-607) gave a good side pose, but the far wing, the
far legs and the tail tip came out pale and translucent (atmospheric perspective) at every seed,
even with "the far wing as solid and richly painted as the near one" and `(translucent faded
parts:-3)`: bad for the cut-out and for accessories. img2img at 0.7 kept the young's gangly
proportions; 0.78-0.85 is the band where the new stage matures but keeps the pose.

Exports (staged): `assets/art/export/dragon/dragon_{adult,illustre,ancestral}_cut.webp` (1024 px,
q82, 116-136 KB). Contact sheet of the six stages on dark, mid and parchment:
`docs/art/progression-stages.png` (`python tools/art/stages_sheet.py`). The old adult (seed 204,
head-on) stays in git history.

### Phase 2: extraction test and slot masks (2026-09-30)

The pipeline is written up in the `art-overlays` skill (scripts under `tools/art/`: `img2img.py`,
`segment.py`, `overlay.py`, `slots.py` + `slots.json`; segmentation venv `tools/art/seg/.venv`,
SAM 2.1 large, Grounding DINO base). Throwaway test, four items, all passing on bronze and on the
ecume, braise and argent tints (`docs/art/overlay-test.png`):

| Item | Stage | Seed | Denoise | Notes |
|---|---|---|---|---|
| gold Greek-key collar, carnelian gem | young | 701 | 0.75 | 0.8-0.9 drew the collar on a neck narrower than the real one |
| gold Greek-key collar, carnelian gem | adult | 721 | 0.85 | |
| bronze dome helmet, red horsehair crest | young | 713 | 0.85 | needed the horns cut out of the head slot, and the "solid dome ... no scales showing through" prompt |
| bronze helmet, red crest | adult | 733 | 0.85 | |

Slot masks: `assets/art/dragon/slots/{young,adult,illustre,ancestral}_{cou,queue,dos,tete}.png`,
contact sheet `docs/art/slot-masks.png`, all 16 checked by eye.

### Progression redesign, phase 3 (2026-09-29)

Trophies, house interiors, Hermès's stall, Hermès and the shop icons (art spec Phase 3). Recipes and
what was rejected: `krea2` skill "Phase 3 recipes (progression redesign)", `art-cutout` skill
"Phase 3 exports". The web copies are staged under `assets/art/export/` (not `web/public/art/`);
the code task that wires each asset moves it. Contact sheets: `docs/art/trophies-sheet.png`,
`docs/art/phase3-sheet.png`.

**Trophies** `assets/art/trophies/trophy-<lt>-<L>.png` (+ `_cut`, sidecar), 1024², style
`discorde-inked-clean`, `--vscale 1.0`, 8 steps. Prompt: the icon composition sentence (§5 Icons)
with "subject: a treasured trophy statuette, <object>, <material>, <base>", one fixed object
sentence per relic and one material sentence per level (the sidecars hold the exact text).

| Relic (object) | L1 bois | L2 bronze | L3 argent | L4 or | L5 orichalque |
|---|---|---|---|---|---|
| hydre (a kite-shaped serpent scale standing on its tip) | 1100 | 1100 | 1100 | 1100 | 1100 |
| echo (an upright spiral conch shell) | 1110 | 1110 | 1110 | 1110 | 1110 |
| chimere (three mane locks bound like a bouquet of flames) | 1120 | 1120 | 1121 | 1122 | 1120 |
| protee (an open scallop shell holding a pearl) | 1131 | 1130 | 1130 | 1132 | 1131 |
| sirenes (one long upright feather) | 1140 | 1140 | 1140 | 1140 | 1140 |
| lethe (one open poppy with a seed head, two leaves) | 1150 | 1150 | 1150 | 1150 | 1150 |

Bases: plain wooden block, small round bronze base, three-tier stepped silver base, fluted gold
column, sculpted rose-gold base with a laurel garland. Gems from level 4: emerald, aquamarine, red,
sea-blue, sapphire, ruby. 45 generations, 15 rejected (the material sentences were tightened along
the way: brown wood, "every surface silver", gold leading the subject, rose-gold orichalcum; see
the skill). Known weak spot, accepted: at 64 px wood and bronze are both brown and differ mostly by
the base (block vs round) and the shine.

**Interiors** `assets/art/scenes/villa.png` (seed 4401) and `palais.png` (seed 4501), 2048×1152,
`discorde-illustration`: img2img of `scenes/cabin.png`, denoise 0.72, 12 steps, V-scale 1 (villa
at 0.60 was rejected: busier, closer to the cabin's clutter). Landmarks (percent of the picture,
by eye, ±2 %, like `docs/art/scenes.md`):

| Landmark | villa x, y, w, h | palais x, y, w, h |
|---|---|---|
| Trophy shelf with hooks and medals (left wall) | 10, 13, 30, 50 | 4, 23, 30, 43 |
| Second shelf | 31, 28, 9, 16 (right of the main shelf, a few books and a vase) | 16, 8, 17, 23 (above the main shelf, bare) |
| Journal on the desk | 43, 50, 9, 6 (desk 37, 47, 21, 31) | 44, 53, 10, 7 (desk 39, 52, 20, 29) |
| Lamp and lyre table | 59, 41, 15, 31 | 59, 43, 13, 33 |
| Bed | 73, 53, 15, 37 | 72, 22, 16, 73 (canopy bed) |
| Back windows / arch | two arched windows 47, 22, 9, 28 and 72, 22, 9, 28 | arch onto the courtyard 40, 20, 18, 40 |

Bare wall for decor: villa, the left wall below the medals (x 10-38, y 63-80) and the back wall
between and under the two windows; palais, the marble wall below the shelf (x 4-34, y 66-85), the
bare upper shelf, and the wall panels beside the arch between the columns. Both WebPs 249 / 315 KiB (`assets/art/export/scenes/`).

**Hermès's stall** `assets/art/scenes/hub_camp_stall.png` (the original `hub_camp.png` untouched):
inpaint seed 4323 (mask `scenes/masks/hub_camp_stall_inpaint.png`, padding 160, blur 8, denoise
0.95, 9 steps, 1024² crop), then only the hand-traced stall (`masks/hub_camp_stall_paste.png`)
pasted onto the original with `tools/art/inpaint_paste.py`: **0 px differ outside the inpaint mask**
(checked by the script; the raw inpaint result is kept as `masks/hub_camp_stall_raw.png`, and
re-running the command reproduces the PNG exactly). Striped red-and-cream awning, a round wooden
sign with golden winged sandals, amphorae, baskets and rolled cloth on a counter, no text.
**Stall bounding box: x 0.105-0.218, y 0.208-0.448 of the picture** (px 216-445, 240-515); it
stands in front of the right end of the white wall, above the nest (nest hotspot from y 0.44). The
left 2 % falls outside the iPad safe zone, so clip the hotspot to x 0.125-0.218. Rejected: seeds
4301-4303 (mask at x 0.015-0.17, mostly outside the safe zone, and its top edge cut the wall's
tiles, painting a second roofline) and 4311-4313 (same place, lower mask). WebP 297 KiB.

**Hermès** `assets/art/characters/hermes.png` + `_cut` (seed 707, 768×1344, `discorde-inked-clean`;
seed 708 rejected, two caduceuses), a cheerful young merchant god: winged brimmed cap, saffron tunic,
blue cloak, satchel of goods, the caduceus raised, the other hand open in welcome, winged sandals.
A small enclosed white gap by the caduceus hand was cleared with `tools/art/clear_holes.py`.
Export `assets/art/export/characters/hermes_cut.webp` (1024 px high, 63 KiB).

**Icons** (icon composition sentence, `discorde-inked-clean`, 1024², cut, 256 px via `icons.py
webp --dst assets/art/export/icons --only ...`): drachme 1065 (a silver drachma with Athena's owl
and an olive sprig; desaturated to 30 % after generation, see its sidecar; 1061-1064 and 1066
rejected, blotchy multicolour silver), decor-amphore 1015 (black-figure amphora with a running
hero), decor-chouette 1017 (a small white marble owl on a plinth), decor-mosaique 1020 (a framed
tile mosaic of three Muses with lyre, scroll and mask), decor-bouclier 1026 (a polished bronze
hoplite shield with a Pegasus relief; 1021 and 1027 rejected, blotchier). All under 17 KiB.
