# Scenes UI: art files and landmark map (UI2)

Art for the scenes redesign (spec `docs/superpowers/specs/2026-09-24-scenes-ui-design.md`, §3, §4, §6).
Every scene is **2048×1152 (16:9)**. The PNG and its sidecar JSON (prompt, seed, settings) live in
`assets/art/scenes/`, and the game loads the WebP from `web/public/art/scenes/` (q88, 190–294 KB each,
under the 600 KB budget).

## How to read the boxes

- `x, y, w, h` are **percent of the full 16:9 image**: `x`/`y` is the top-left corner, `w`/`h` the size.
  Scenes are rendered `object-fit: cover`, so these are "art %" in the spec's terms.
- The boxes were measured by eye on a 5 % grid overlay, so treat them as ±2 %. Tighten the final
  polygons by hand in `camp.shapes.ts` and check them with the read-only `?debug` hotspot overlay.
- **Safe zone** (visible on a landscape iPad): x 12.5–87.5. The top ~8 % is kept for the HUD and the
  bottom ~22 % (y > 78) for the dialogue box.
- ⚠ marks a landmark that sticks out of the safe zone. Clip its hotspot to the range given.

## title_gates: camp gates at dusk

Éris's violet cloud silhouette (crown, wild hair, golden apple) hangs in the sky above the gate.
Two bronze hook rails with **empty hooks**: hero shields (HTML/CSS or cut-outs) hang below them, on the
plain wall. Cypresses at x ≈ 25–28 and 66–73 sit in front of the wall, so shields can be layered over
them or skip those slots.

| Landmark | x | y | w | h | Notes |
|---|---|---|---|---|---|
| Gate doors ("Entrer") | 43 | 45 | 13 | 34 | Arched double door. Hotspot can include the pillars: x 35–64 |
| Left shield rail + shield area | 16 | 52 | 20 | 17 | Hooks along y ≈ 53–56. About 5 shield slots |
| Right shield rail + shield area | 63 | 52 | 22 | 17 | About 5 shield slots |
| Éris silhouette | 42 | 3 | 17 | 38 | Decorative. Apple at about (58, 17). Good spot for a subtle FX pulse |
| Torches | 36 / 59 | 42 | 4 | 23 | Flame FX anchors at about (38, 46) and (61, 46) |

## hub_camp: the demigod camp hub

Late-afternoon valley. The six landmarks stand apart on the grass, with a storm over purple hills on
the right (Éris's direction).

| Landmark | x | y | w | h | Notes |
|---|---|---|---|---|---|
| Dragon's nest | 6 | 44 | 19 | 20 | ⚠ Nest on a rock (the rock runs down to y 75). Hotspot x 12.5–25. A small dragon cut-out can sit in the nest at about (17, 50) |
| Oracle's path to Delphi | 21 | 3 | 17 | 38 | Temple on the hill (x 22–36, y 3–22) plus the upper white stairs. The stairs keep winding down to (30, 70), so don't overlap the library tent |
| Library tent | 30 | 34 | 22 | 27 | Cream-and-blue striped pavilion |
| War tent | 54 | 42 | 21 | 30 | Red-and-bronze tent with a shield and spears |
| Path to battle | 62 | 20 | 18 | 14 | Wooden archway (x 66–74, y 21–33) with the dirt path off toward the storm |
| Cabin | 76 | 54 | 20 | 28 | ⚠ Right edge at x 96, bottom at y 82. Hotspot x 76–87.5, y 54–78 (the door is at x 79–82) |

Weekly-goal banner: open sky at x 40–65, y 8–18.

## nest: the dragon's nest

A woven nest in a rock hollow on a sea cliff at sunset. The middle of the straw bed is empty.

| Landmark | x | y | w | h | Notes |
|---|---|---|---|---|---|
| Nest (whole) | 25 | 30 | 53 | 48 | |
| **Dragon spot** | 34 | 30 | 34 | 36 | Empty straw bed. Put the dragon cut-out's feet at about y 62, centred at x 50. For the adult, scale it to about 45 % of the height |
| Cracked egg shell | 33 | 39 | 5 | 10 | Decorative |
| Bronze brazier cup | 58 | 33 | 7 | 13 | Decorative, possible FX anchor |

## delphi: the temple of Apollo

Sunbeams, green vapour rising from a crack under an **empty** oracle tripod, and a wall of votive tablets.

| Landmark | x | y | w | h | Notes |
|---|---|---|---|---|---|
| Pythia's tripod | 27 | 39 | 11 | 36 | Tall bronze tripod with a bowl seat, on a round dais (x 18–45, y 73–81). Place `characters/pythia_cut` centred at x 32.5 with her feet at about y 76. It covers the painted tripod, and her own tripod stool replaces it. Scale her to about 50 % of the height |
| Votive-tablet wall (quests) | 53 | 22 | 29 | 35 | Five rows of small terracotta tablets. `props/votive_tablets_cut` can be overlaid for a "new quest" highlight |
| Altar with offerings | 53 | 60 | 25 | 18 | Optional secondary hotspot |
| Painted frieze | 52 | 0 | 38 | 13 | Decorative, under the HUD |

## library_tent: the library tent

Striped canvas tent open toward the viewer. Lamps hang from the ridge pole.

| Landmark | x | y | w | h | Notes |
|---|---|---|---|---|---|
| Scroll shelves (her texts) | 17 | 19 | 15 | 58 | Pigeonholes full of scrolls |
| Scribe's desk (write or paste a text) | 33 | 36 | 16 | 35 | Slanted desk, quills, blank scroll |
| Bronze lens (scan) | 47 | 31 | 11 | 35 | Round lens on a tall stand |
| Portal to Alexandria | 61 | 21 | 15 | 43 | Glowing golden stone arch with a glimpse of shelves. Good spot for a particle FX |

Owl placement: the owl can perch on the right-hand side table at about (80, 45), or on the shelf's
top at about (24, 18). Use `characters/owl_cut` at about 14 % of the height.

## war_tent: the war council tent

Red canvas tent. Six **blank parchment sheets** are pinned to the back wall so the game can overlay
the lieutenants' portraits (crops of the lieutenant cut-outs) and their locked or unlocked state.

| Landmark | x | y | w | h | Notes |
|---|---|---|---|---|---|
| Portrait sheets (all six) | 21 | 22 | 24 | 33 | Top row y 22–37, bottom row y 40–55. Columns x 21.5–27.5, 30–36, 39–45 |
| Map table (Éris's file) | 20 | 62 | 48 | 20 | Map of Greece with bronze figurines. The tabletop reaches y 86, so keep the hotspot above y 78 |
| Lectern with the bestiary codex | 68 | 42 | 17 | 50 | Codex itself at x 70–82, y 42–56. `props/codex_lectern_cut` can replace it for an opening animation |

## cabin: the hero's cabin

Evening, white-washed room, warm lamplight.

| Landmark | x | y | w | h | Notes |
|---|---|---|---|---|---|
| Trophy shelf (rewards, perks) | 10 | 12 | 31 | 52 | Laurel crown, cup, medals. The left 2.5 % falls outside the safe zone, so use a hotspot of x 12.5–41. `props/trophy_shelf_cut` exists for an overlay close-up |
| Journal on the desk (stats) | 35 | 47 | 24 | 31 | Open journal at x 42–54, y 51–59 |
| Lamp and lyre (settings, audio) | 58 | 38 | 15 | 37 | Lamp at x 60–66, lyre at x 67–73 |

## eris_lair: Éris's lair

Dark bronze hall with purple drapes, green flames and poison-green veins in black marble.

| Landmark | x | y | w | h | Notes |
|---|---|---|---|---|---|
| Throne | 46 | 33 | 8 | 20 | Place `characters/eris_cut` standing in front of it, centred at x 50 with her feet at about y 72 |
| Golden apple on its pedestal | 47 | 55 | 6 | 18 | Apple at about (50, 57). Good spot for a glow FX |
| Green-flame braziers | 30 / 64.5 | 38 | 5 | 28 | FX anchors |

## Battle backdrops: battle_river, battle_coast, battle_temple

No interactive landmarks. They all share the same layout for the battle stage:

| Zone | x | y | w | h | Notes |
|---|---|---|---|---|---|
| Left combatant (dragon) | 13 | 35 | 25 | 50 | Open ground. Feet at about y 80 (river), y 75 (coast, on the rock ledge), y 78 (temple floor) |
| Right combatant (opponent) | 62 | 30 | 25 | 55 | Open ground. Feet at about y 80 |
| Parchment (dictation text) | 28 | 10 | 44 | 68 | The calm centre: river or sea and sky. The parchment is semi-transparent, so the backdrop shows through |

- `battle_river`: grassy bank on the left, pebble bank on the right, the river running into the distance,
  and violet storm clouds at top right.
- `battle_coast`: rocky ledge on the left, a sandy flat on the right, waves and sea stacks, and a storm
  sky with sunbeams.
- `battle_temple`: broken Ionic columns at x 11–21 and 79–92, a marble floor on the left and earth on
  the right, and fallen column drums in the midground.

## Cut-outs and textures

| Asset | Source PNG (+ `_cut.png`, `.json`) | WebP | Size |
|---|---|---|---|
| Pythia on her tripod stool | `assets/art/characters/pythia.png` | `web/public/art/characters/pythia_cut.webp` | 768×1344 |
| Athena's owl | `assets/art/characters/owl.png` | `web/public/art/characters/owl_cut.webp` | 1024² |
| Votive tablets board | `assets/art/props/votive_tablets.png` | `web/public/art/props/votive_tablets_cut.webp` | 1024² |
| Codex on a lectern | `assets/art/props/codex_lectern.png` | `web/public/art/props/codex_lectern_cut.webp` | 768×1344 |
| Trophy shelf | `assets/art/props/trophy_shelf.png` | `web/public/art/props/trophy_shelf_cut.webp` | 1344×768 |
| Marble texture (tile) | `assets/art/textures/marble.png` | `web/public/art/textures/marble.webp` (28 KB) | 1024² |
| Parchment texture (tile) | `assets/art/textures/parchment.png` | `web/public/art/textures/parchment.webp` (3 KB) | 1024² → 512² |
| Wood board (table overlay) | `assets/art/textures/wood_board.png` | `web/public/art/textures/wood_board.webp` (50 KB) | 1344×768 → 1280×731 |
| Rolled scroll (cut-out) | `assets/art/ui/scroll_rolled.png` + `_cut.png` | `web/public/art/ui/scroll_rolled.webp` (20 KB) | 1344×768 → 640×366 |
| Portal-arch icon (cut-out) | `assets/art/icons/portal-arch.png` + `_cut.png` | `web/public/art/icons/portal-arch.webp` (10 KB) | 1024² → 256² |
| Treasure chest, closed (cut-out, UI4 Task A) | `assets/art/battle/chest_closed.png` + `_cut.png` | `web/public/art/battle/chest_closed.webp` (45 KB) | 1024² |
| Treasure chest, open (cut-out, UI4 Task A, same seed 706) | `assets/art/battle/chest_open.png` + `_cut.png` | `web/public/art/battle/chest_open.webp` (57 KB) | 1024² |
| Éris, flustered/routed pose (cut-out, UI4 Task A) | `assets/art/characters/eris_flustered.png` + `_cut.png` | `web/public/art/characters/eris_flustered_cut.webp` (71 KB) | 768×1344 |

The marble tile is "seamless-ish": soft veins with no hard border, which is fine behind a plaque. No
bronze texture is shipped: it came out as a honeycomb pattern, so CSS gradients or noise do better.
The wood board and the scroll cut-out shipped from the immersion wave (UI3a Task 1, playability
findings #1 and #20): the wood board is used as-is behind table-style overlay panels (a `--wood-dark`
CSS overlay darkens it further if needed), and the scroll is the rolled-scroll cut-out for the shelves
and Pythia panels. Export with `tools/art/run_docker.sh uiart webp` then `uiart sheet`
(`tools/art/uiart.py`); the `tile` entries go through a `seamless()` pass first (quadrant-shift plus a
feathered cross blend) so a repeat shows no seam — see `docs/art/ui-art-sheet.png`.

**Parchment retry (2026-09-25):** the first three seeds (903, 904, 905, tried before this retry) all
vignetted for the reason above (a repeating blotch grid once `seamless()`'s quadrant-shift relocated
each dark corner to the tile's centre and to the four-corner junctions). The retry prompted the tile
explicitly as a low-contrast text background — no "tone variation", strong negatives against
vignette/blotches/stains/corners — with `generate.py --tiling` (a real `tiling` field on the Forge
txt2img API, confirmed via `/openapi.json`), and added a `flatten()` pass to `uiart.py` that divides
the image by a large blur of itself, re-centres it on the kit's `--parchment-solid` tone, and
compresses the remaining grain to a luminance std ≤ 3, run before `seamless()`. Seed 903 passed on
the first try this time (corner-vs-centre luminance within 0.001 of each other after `flatten()` +
`seamless()`); see `docs/art/style-guide.md` §5 for the prompt, the measurements and the 3×3
tiled-with-text check. `ART.textures.parchment` is shipped.
