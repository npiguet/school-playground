# The House Shows Its Treasures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every reward that belongs in a room (6 trophies, 3 gear, 9 decor) stands at its own painted place in each of the three houses, at full size, with no display limit, on three new straight-on room paintings.

**Architecture:** Three new 2048x1152 rooms (krea2, user picks among variants) and twelve new front-facing cut-outs (art-cutout). The places are measured on the chosen rooms into one JSON table (`treasure-places.json`) that the code imports as `TREASURE_PLACES`; a pure module (`treasures.ts`) says which pieces show and where, `CabinRoom.svelte` draws them as plain images inside the art box. The server drops `MAX_DECOR`, the client drops the medallion slots, the walls-full refusal and `max_decor`.

**Tech Stack:** Svelte 5 + TypeScript + Vitest + Playwright (web/), FastAPI + SQLite + pytest (server/), Krea 2 Turbo through sd-webui-forge-neo (krea2 skill), BiRefNet cut-outs in Docker (art-cutout skill), Pillow.

**Spec:** `docs/superpowers/specs/2026-10-02-house-treasures-design.md` (approved, binding). Read it before any task.

## Global Constraints

- CLAUDE.md: no "pre-existing" problems: anything found broken is fixed or reported as an open item, never dismissed.
- vitest and `svelte-check` end with 0 errors **and 0 warnings**; pytest green.
- No emoji anywhere player-visible (and none in French text).
- Rooms: 2048x1152 (16:9), replacing `assets/art/scenes/{cabin,villa,palais}.png` and `web/public/art/scenes/{cabin,villa,palais}.webp`; served as WebP q88, each under the 600 KB scene budget (`scenes/budget.test.ts`).
- Rooms: "a straight-on view of the back wall (one-point perspective, horizon around the middle)"; "No ruin, crack, moss or dilapidation"; "An empty room must look inviting".
- Fixtures, shared by the three rooms: 6 trophy niches along one long shelf at one height; a gear corner (wall place for the Égide, low shelf or stand for the Sandales, rack or pedestal for the Foudre); a hook (lanterne), a clear floor area in front (tapis), a floor corner (amphore), an alcove (étagère), wall panels (fresque, mosaïque, bouclier), a perch or pedestal (chouette), a shelf spot (couronne); the « Tes trésors » shelf area, the journal on a desk and the lyre stay painted in.
- Pieces: 9 decor + 3 gear, front-facing, painted style, consistent scale, cut out with art-cutout, WebP in `web/public/art/treasures/`. Trophies: the existing `web/public/art/trophies/large/trophy-<lt>-<L>.webp` (512 px).
- `decor:trophee` keeps its id; it becomes « Couronne de laurier », a golden laurel wreath (name, description and art change).
- "A soft contact shadow under each standing piece (CSS, not painted)".
- `Place = { x, y, w }` in art % (x centre, y the bottom edge, w the width); `TREASURE_PLACES: Record<House, Record<PieceId, Place>>`.
- Pieces: depth 0, no idle, no parallax, under the hotspots and their plaques, not tappable. An empty place shows the painted fixture only: no silhouette, no lock.
- « Tes trésors », « Ton journal » and « La lyre » stay as they are.
- Art generation: the krea2 skill (forge-neo, `krea2_turbo-Q3_K_M.gguf` override on every call). Wait for Forge idle **outside** the lock, then `tools/art/with_lock.sh` for one short batch (3-6 images). When Forge is busy, poll until idle; never read Forge's own files. Inside `with_lock.sh` pass Windows paths (`C:/Users/...`).
- The art track never writes into `web/public/art/`: web exports are staged under `assets/art/export/<same path>`; the code task that wires them moves them (art-cutout skill, "Staging while the code is being wired").
- Commands (from the worktree root, Git Bash): unit tests `STACK=house scripts/npm.sh run test`, type check `STACK=house scripts/npm.sh run check`, server tests `STACK=house scripts/pytest.sh -q <paths relative to server/>`, e2e `PW_WORKERS=1 STACK=house scripts/playwright.sh <spec names>` (one run per stack, machine-wide Playwright lock, low RAM: never two at once), full gate `STACK=house scripts/check.sh`. Long commands run in the background with long timeouts; their logs go to `C:/Users/nicol/.claude/jobs/9ac9a508/tmp/` (called `$JOB` below), never to `web/test-results`.
- Measured numbers (places, hotspot polygons, aspects) are the only values a task takes from an earlier task's measurement; every such number has exactly one home (`treasure-places.json` for places, `cabin.shapes.ts` for polygons, the WebP files themselves for aspects).
- Commits end with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. Never push.

## Review Focus

1. **Rewards the room has no place for** (a tint, an equipped accessory, a house row, a reward id that left the catalog, `trophy:hydre:9`): the room shows nothing for them, never a broken image. Pinned by Task 6 `ignores what has no place in a room`.
2. **The house not known yet, or the rewards still loading / failed** (`/camp` slow, `/rewards` 500): the room shows its empty fixtures (the cabin until the camp says otherwise), then the pieces at the right house's places, never at the cabin's places in the villa. Pinned by Task 6 `follows the house` (unit) and Task 8 `the rewards failing leave the room empty, the shelf says why` (e2e).
3. **Other screen sizes** (1180x820, 1366x1024): plaques are pixel-sized while the art scales, so a piece clear at 1280x720 may sit under a plaque. Pinned by Task 6's per-house e2e at three sizes.
4. **A display the server refuses** (any 409 or 500 on PATCH): the shelf says the server's words, the piece stays as it was in the room. Pinned by Task 4 e2e `a fifth piece goes on display; a refusal is said word for word`.
5. **Existing heroes** (decor displayed under the old 4/6/9 limit, gear never exposed): their displayed decor stays displayed with no migration, and more than the old limit can now be displayed in every house. Pinned by Task 4 pytest `test_decor_on_display_before_the_limit_went_stays_and_all_nine_fit`.

## Rulings on spec ambiguities

- R1. The spec's `trophyPath(lt, level)` is module-private in `art.ts`; the code uses the existing public `trophyIcon(lt, level, true)` (same file, the large one).
- R2. « Tes trésors » keeps its own painted object: a low cupboard with open shelves of caskets and scrolls, apart from the six-niche trophy shelf (the spec wants every piece clear of the three hotspots). The three hotspot polygons are redrawn on each new room.
- R3. Shadows: standing pieces (trophies, étagère, couronne, amphore, chouette, sandales, foudre) get the CSS contact shadow; hanging pieces (lanterne, fresque, mosaïque, bouclier, égide) a faint CSS drop shadow so they sit on the wall; the tapis lies flat with none.
- R4. "Art changes" for `decor:trophee` includes its 256 px icon (`icons/decor-trophee.webp`, the medallion in « Tes trésors »): it is cut from the new wreath. The dialog's behaviour is unchanged.
- R5. The trophy WebPs keep their 6.5 % transparent margin (measured: every large trophy has a 0.064-0.066 bottom gap); `TROPHY_FOOT = 0.065` moves a trophy down by that much so its base stands on the line. The twelve new cut-outs are exported trimmed (foot 0).
- R6. Places live in `web/src/lib/world/scenes/treasure-places.json` (one source for the code and the art preview tool), typed and exported as `TREASURE_PLACES`. Aspect ratios are never copied by hand: the browser lays the image out at its own aspect and the unit test reads it from the WebP headers.
- R7. With the limit gone, the race test `test_two_pieces_hung_at_once_cannot_both_take_the_last_spot` has no subject and is removed; `PATCH` keeps `begin_write` for the accessories' one-per-slot swap.
- R8. Gear is shown only when exposed (`equipped`, default 0), as the spec says; no migration. Displayed decor keeps its `equipped = 1` rows (read `server/app/routers/world.py` `patch_reward`, `get_rewards`, migration `004_world.sql`: no slot is stored, only the flag).
- R9. Words that contradict "a bigger house is a grander room, not a bigger shelf" are reworded too: the guide's « 4 pièces dans la cabane, 6 dans la villa, 9 dans le palais » and « l'étagère de ta cabane », the cabin tour's « avec davantage de murs pour ton décor », MANUEL §14, the README's « 4 / 6 / 9 wall slots ». `HOW_TO_WIN['decor:trophee']` becomes « pour la gagner » (la couronne).
- R10. The three rooms are three txt2img paintings from one shared fixture paragraph (not img2img from the cabin), so each can be picked on its own; img2img from the picked cabin is the fallback if a house fails its acceptance twice.
- R11. Pieces must stay inside x 12.5-87.5, below y 8 (the HUD) and clear of the room's name plaque (x 43-57, y 9.5-15.6); they may sit under the dialogue dock (the tapis), which is not interactive.

## File Structure

| File | Responsibility |
|---|---|
| `assets/art/scenes/{cabin,villa,palais}.png` + `.json` | The three chosen rooms and their generation parameters (replaced) |
| `assets/art/treasures/<id>.png`, `<id>_cut.png`, `<id>.json` | The twelve piece sources, cut-outs and sidecars (new folder, so `icons.py` never treats them as icons) |
| `tools/art/treasures.py` | Export the twelve pieces (trim, WebP, budgets) and their contact sheet (new) |
| `tools/art/grid.py` | Art-% grid overlay for measuring a room (new) |
| `tools/art/treasure_preview.py` | Paste every piece at its place on a room PNG, with outlines and an overlap check (new) |
| `web/src/lib/world/scenes/treasure-places.json` | `TREASURE_PLACES` data, measured (new) |
| `web/src/lib/world/scenes/treasures.ts` | Piece ids, `Place`, `placeBox`, `shownPieces` (new) |
| `web/src/lib/world/scenes/treasures.test.ts` | Geometry and logic of the places (new) |
| `web/src/testing/webp.ts` | `webpSize(file)` shared by `art.test.ts` and `treasures.test.ts` (new, moved out of `art.test.ts`) |
| `web/src/lib/world/scenes/cabin.ts`, `cabin.shapes.ts`, `cabin.test.ts` | Hotspots redrawn; `BARE_WALLS`, `DECOR_SLOTS`, `MAX_DISPLAYED_DECOR`, `WALLS_FULL_LINE` gone |
| `web/src/screens/CabinRoom.svelte` | Draws the shown pieces and the `?debug` place lines |
| `web/src/components/places/cabin/TrophiesPanel.svelte` | No `maxDecor`, no walls-full line |
| `web/src/lib/world/art.ts`, `art.test.ts` | `ART.treasures`, budgets |
| `web/src/lib/world/{types.ts,guide.ts,guide.test.ts,shop.test.ts,rewards.ts,rewards.test.ts}` | `max_decor` gone, wording |
| `server/app/world/{shop.py,catalog.py}`, `server/app/routers/world.py` | No `MAX_DECOR`, no walls check, new words |
| `server/tests/{test_shop.py,test_drachmes_api.py,test_world_api.py}` | Tests follow |
| `content/dialogue/cabin.json` | The tour's last line |
| `web/e2e/scenes-cabin.spec.ts`, `web/e2e/scenes-house.spec.ts` | Room e2e |
| `MANUEL.md`, `README.md`, `docs/art/scenes.md`, `docs/art/style-guide.md`, `.claude/skills/krea2/SKILL.md` | Docs |

---

### Task 1: The three rooms, 3 variants each (ends in a STOP for the user's pick)

**Files:**
- Create (scratch, not committed): `$JOB/rooms/prompt-cabin.txt`, `prompt-villa.txt`, `prompt-palais.txt`, `$JOB/rooms/<house>-<seed>_<n>.png` + `.json`, `$JOB/rooms/sheet.png`

**Interfaces:**
- Consumes: nothing.
- Produces: for each house, 2-3 accepted variant PNGs with sidecars in `$JOB/rooms/`, and the review sheet `$JOB/rooms/sheet.png`. Task 2 receives from the controller one pick per house as a file path.

`$JOB` = `C:/Users/nicol/.claude/jobs/9ac9a508/tmp` (Git Bash: `/c/Users/nicol/.claude/jobs/9ac9a508/tmp`).

- [ ] **Step 1: Write the three prompt files**

Each prompt = framing + lighting + `subject:` (the room, then the shared fixture paragraph with this house's materials) + the scene composition sentence of the style guide + negatives. The style paragraph comes from `--style discorde-illustration`. These prompts run to about 200 words, above the skill's 150: the fixture list is the point, keep it whole.

`$JOB/rooms/prompt-cabin.txt`:

```text
wide interior shot, eye level, the camera looking straight at the back wall of the room in one-point perspective, the back wall flat and parallel to the picture, the horizon across the middle of the picture, the floor and the ceiling receding evenly toward the centre, cosy warm evening light from a small window and an oil lamp. subject: the inside of a small rustic demigod cabin, warm honey-coloured wooden plank walls, rough wooden ceiling beams with bundles of straw, a wide plank floor, simple, clean, cosy and lived-in. Every place in the room is empty and ready for treasures: high on the back wall, centred, one long wooden shelf divided into six equal empty arched niches side by side; below it in the middle, a simple wooden desk with an open leather journal and a quill, bare wall just above the desk; right of the desk, a small wooden table with a golden lyre leaning on it; left of the desk, a low wooden cupboard with open shelves holding a few small caskets and rolled scrolls; about one fifth in from the left edge, a tall empty arched alcove in the wall reaching down to the floor, and beside it a small empty wooden pedestal; one empty bronze hook hanging from a ceiling beam; one small empty wall shelf left of the niches; about one fifth in from the right edge, an empty bronze peg on the wall above a low empty wooden bench, and a small empty wooden pedestal beside the bench; an empty corner of floor at the right; wide stretches of bare wall between all these places and a wide stretch of bare floor in front. Composition: a wide 16:9 game background seen from a little distance, all the important objects are grouped in the middle of the picture, the outer eighth on the far left and on the far right holds only soft background scenery such as plain wall, foliage or sky; the ground in the lower part of the picture continues naturally with the same texture and light but with few small details; the top edge is calm. (people:-2) (text:-3) (busy details:-2) (ruins:-3) (cracks:-3)
```

`$JOB/rooms/prompt-villa.txt`: the cabin prompt with these exact replacements (write the whole file out, not a diff):
- lighting: `warm golden late-afternoon light from tall arched windows`
- room sentence: `the inside of a bright new ancient Greek villa room at the height of its glory, freshly whitewashed smooth walls, a painted frieze of terracotta and Aegean blue Greek key pattern running along the top of the walls, slender painted columns at the corners, a warm terracotta tile floor, everything new, clean and well kept.`
- `one long wooden shelf` -> `one long carved and painted wooden shelf`; `a simple wooden desk` -> `a fine carved wooden desk`; `a small wooden table` -> `a small carved wooden table`; `a low wooden cupboard` -> `a low painted wooden cupboard`; both `empty wooden pedestal` -> `empty white stone pedestal`; `a low empty wooden bench` -> `a low empty carved wooden bench`.
- negatives: `(people:-2) (text:-3) (busy details:-2) (ruins:-3) (cracks:-3) (moss:-3)`

`$JOB/rooms/prompt-palais.txt`: the cabin prompt with:
- lighting: `warm golden evening light, gleaming highlights on gold and marble`
- room sentence: `the inside of a grand ancient Greek palace hall at its prime, polished white marble walls with soft grey veins, white marble columns with gilded capitals along the walls, a colourful floor mosaic of terracotta, Aegean blue and gold patterns, gold trim everywhere, everything new, gleaming and perfect.`
- `one long wooden shelf` -> `one long white marble shelf with gilded edges`; `a simple wooden desk` -> `a fine desk inlaid with gold`; `a small wooden table` -> `a small marble table`; `a low wooden cupboard` -> `a low gilded wooden cupboard`; `empty arched alcove in the wall` -> `empty arched marble alcove in the wall`; both `empty wooden pedestal` -> `empty marble pedestal`; `a low empty wooden bench` -> `a low empty marble bench`; `rough wooden ceiling beams with bundles of straw` is dropped (the room sentence replaces it); `a wide plank floor` is dropped.
- negatives: `(people:-2) (text:-3) (busy details:-2) (ruins:-3) (cracks:-3) (moss:-3)`

The villa and palais files also drop the cabin's `warm honey-coloured wooden plank walls, rough wooden ceiling beams with bundles of straw, a wide plank floor, simple, clean, cosy and lived-in.` (their room sentence replaces it).

- [ ] **Step 2: Wait for Forge idle, outside the lock**

Run in the background (Bash `run_in_background`, timeout 3600000), and wait for its completion notice:

```bash
n=0; until [ $n -ge 2 ]; do
  c=$(curl -s "http://127.0.0.1:7860/sdapi/v1/progress?skip_current_image=true" | python -c "import json,sys;print(json.load(sys.stdin)['state']['job_count'])" 2>/dev/null || echo busy)
  if [ "$c" = "0" ]; then n=$((n+1)); else n=0; fi; sleep 20
done; echo forge idle
```

If Forge does not answer at all, ask the controller to have the user start Forge; do not start it.

- [ ] **Step 3: Generate the cabin's three variants (one locked batch)**

```bash
tools/art/with_lock.sh python .claude/skills/krea2/generate.py --prompt-file C:/Users/nicol/.claude/jobs/9ac9a508/tmp/rooms/prompt-cabin.txt --style discorde-illustration --size 2048x1152 --seed 7101 --count 3 --vscale 1.0 --out C:/Users/nicol/.claude/jobs/9ac9a508/tmp/rooms/cabin-7101.png
```

Expected: `cabin-7101_1.png` .. `_3.png` (seeds 7101-7103) with sidecars.

- [ ] **Step 4: Repeat Step 2, then the villa (seeds 7201-7203); repeat Step 2, then the palais (seeds 7301-7303)**

```bash
tools/art/with_lock.sh python .claude/skills/krea2/generate.py --prompt-file C:/Users/nicol/.claude/jobs/9ac9a508/tmp/rooms/prompt-villa.txt --style discorde-illustration --size 2048x1152 --seed 7201 --count 3 --vscale 1.0 --out C:/Users/nicol/.claude/jobs/9ac9a508/tmp/rooms/villa-7201.png
tools/art/with_lock.sh python .claude/skills/krea2/generate.py --prompt-file C:/Users/nicol/.claude/jobs/9ac9a508/tmp/rooms/prompt-palais.txt --style discorde-illustration --size 2048x1152 --seed 7301 --count 3 --vscale 1.0 --out C:/Users/nicol/.claude/jobs/9ac9a508/tmp/rooms/palais-7301.png
```

(Two separate locked calls, each preceded by Step 2.)

- [ ] **Step 5: Screen every variant against the acceptance criteria (Read each PNG)**

A variant is **accepted** only if all hold:
1. The back wall faces the viewer (its top and bottom edges near-horizontal), the horizon within y 40-60 %.
2. Six niches (or six clearly separate places) on one shelf at one height, all inside x 12.5-87.5, mostly empty (a small painted object in one niche is a reject).
3. The desk with the open journal, the lyre, and the cupboard are painted, apart from each other, inside x 12.5-87.5 and y 14-80 (they become the three hotspots).
4. The alcove, at least one pedestal, a hook or bracket, one small shelf and a gear corner (wall peg or wall space, a low bench or shelf, a pedestal) are present; a clear floor area in front; a floor corner. A missing small fixture is a note (Task 2 can inpaint it), a missing shelf of niches or desk is a reject.
5. Bare wall above the desk and above the lyre table (their name plaques go there, about 12 % wide, 7 % tall).
6. The outer eighths (x < 12.5, x > 87.5) hold plain wall or scenery only; the top 8 % is calm; no text, no people; no ruin, crack, moss or dirt (cabin: rustic but sound and clean).
7. Inviting: warm light, nothing dark or gloomy in the middle.

For each rejected variant, regenerate one more at the next free seed of that house (cabin 7104, 7105...; at most two extra per house, Steps 2-3 pattern with `--count 1`). If a house still has fewer than 2 accepted variants after that, keep the best 2 and say why in the report. If the cabin passes and a house fails twice, add one img2img variant from the best cabin per the krea2 skill's "Richer variant of an existing scene" recipe (`tools/art/img2img.py --init <cabin pick> --prompt-file <house prompt> --style discorde-illustration --size 2048x1152 --denoise 0.72 --steps 12 --seed 72x1|73x1`).

- [ ] **Step 6: Build the review sheet**

```bash
python - <<'EOF'
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
job = Path("C:/Users/nicol/.claude/jobs/9ac9a508/tmp/rooms")
rows = [(h, sorted(job.glob(f"{h}-*.png"))) for h in ("cabin", "villa", "palais")]
W, H, pad = 960, 540, 16
cols = max(len(f) for _, f in rows)
sheet = Image.new("RGB", (pad + cols * (W + pad), pad + len(rows) * (H + 40 + pad)), (27, 20, 33))
d = ImageDraw.Draw(sheet); font = ImageFont.load_default(size=22)
for r, (house, files) in enumerate(rows):
    for c, f in enumerate(files):
        img = Image.open(f).convert("RGB").resize((W, H), Image.LANCZOS)
        g = ImageDraw.Draw(img)
        for x in (0.125, 0.875): g.line([(x * W, 0), (x * W, H)], fill=(0, 200, 255), width=2)
        g.line([(0, 0.08 * H), (W, 0.08 * H)], fill=(255, 80, 80), width=2)
        x0, y0 = pad + c * (W + pad), pad + r * (H + 40 + pad)
        sheet.paste(img, (x0, y0 + 40))
        d.text((x0, y0 + 8), f.stem, fill=(236, 223, 193), font=font)
sheet.save(job / "sheet.png"); print(job / "sheet.png", sheet.size)
EOF
```

Expected: `sheet.png`, one row per house, each variant labelled with its file stem, the safe-zone lines (cyan) and the HUD line (red) drawn.

- [ ] **Step 7: STOP. Hand back to the controller**

Do not commit, do not start Task 2. Report: the sheet path, every accepted variant's full path and seed, the notes from Step 5 (any missing small fixture per variant). **The controller shows the sheet and the full-size variants to the user, who picks one per house (or asks for another round with notes: then rerun Steps 2-6 with the notes worked into the prompt and seeds +10, e.g. 7111).** Task 2 starts only with the three picks in hand.

---

### Task 2: Install the picked rooms and stage their WebPs

**Files:**
- Modify (replace): `assets/art/scenes/cabin.png`, `cabin.json`, `villa.png`, `villa.json`, `palais.png`, `palais.json`
- Create (only if a fixture is added): `assets/art/scenes/masks/<house>_<fixture>_inpaint.png`, `..._refine.png`, `assets/art/scenes/<house>_<fixture>.json`
- Create: `assets/art/export/scenes/cabin.webp`, `villa.webp`, `palais.webp`

**Interfaces:**
- Consumes: the three picks (paths) from the controller; Task 1's notes.
- Produces: the rooms at `assets/art/scenes/<house>.png` (Tasks 5 and 6 measure and preview on these) and staged WebPs at `assets/art/export/scenes/<house>.webp` (Task 6 moves them).

- [ ] **Step 1: Copy each pick and its sidecar over the old room**

```bash
cp "<cabin pick>.png" assets/art/scenes/cabin.png && cp "<cabin pick>.json" assets/art/scenes/cabin.json
cp "<villa pick>.png" assets/art/scenes/villa.png && cp "<villa pick>.json" assets/art/scenes/villa.json
cp "<palais pick>.png" assets/art/scenes/palais.png && cp "<palais pick>.json" assets/art/scenes/palais.json
```

(`<... pick>` = the path the controller gave, without its extension.) The old villa/palais sidecars named `init_image: assets/art/scenes/cabin.png`; the new ones are plain txt2img sidecars, which is now true.

- [ ] **Step 2: Add a missing small fixture only where Task 1 or the user noted one**

Per the krea2 skill "Adding an object to a scene: two passes": pass 1 mask a rounded box on the bare spot (inside x 12.5-87.5, clear of the three hotspot objects), `img2img.py --init assets/art/scenes/<house>.png --mask <inpaint mask> --prompt-file <p> --style discorde-illustration --size 1024x1024 --padding 200 --mask-blur 6 --denoise 0.95 --steps 9 --seed 76<nn> --count 3`; pass 2 the box grown 24 px, denoise 0.5, 16 steps, blur 4. The prompt is the fixture alone, e.g. `A small empty <material> pedestal standing against the back wall, its top flat and bare, the same style, light and perspective as the surrounding picture (people:-3) (text:-3) (statue:-3) (vase:-3)`. Check 0 px differ outside the refine mask grown 12 px; write the result over `assets/art/scenes/<house>.png` and record both passes in `assets/art/scenes/<house>_<fixture>.json` (seeds, masks, settings). Wait for Forge idle outside the lock before each pass (Task 1 Step 2). Skip this step when nothing is noted.

- [ ] **Step 3: Stage the WebPs**

```bash
rm -rf assets/art/web/rooms && mkdir -p assets/art/web/rooms
cp assets/art/scenes/cabin.png assets/art/scenes/villa.png assets/art/scenes/palais.png assets/art/web/rooms/
tools/art/run_docker.sh webify --src assets/art/web/rooms --dst assets/art/export/scenes --max-px 2048 --quality 88
```

Expected: three lines `assets/art/export/scenes/<house>.webp  2048x1152  <n> KiB`, each under 600 KiB. Over 600 KiB: rerun with `--quality 84` and note it.

- [ ] **Step 4: Commit**

```bash
git add assets/art/scenes/cabin.png assets/art/scenes/cabin.json assets/art/scenes/villa.png assets/art/scenes/villa.json assets/art/scenes/palais.png assets/art/scenes/palais.json assets/art/export/scenes/
git add assets/art/scenes/masks/ 2>/dev/null; git status --short
git commit -F - <<'EOF'
House rooms: the cabane, the villa and the palais repainted straight-on with their empty fixtures (six trophy niches, gear corner, alcove, pedestals, hook, shelf), picked by the user; WebPs staged in assets/art/export/scenes

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 3: The twelve pieces, cut out, with a contact sheet (ends in a review STOP)

**Files:**
- Create: `assets/art/treasures/<id>.png`, `<id>.json`, `<id>_cut.png` for the twelve ids below
- Create: `tools/art/treasures.py`
- Create: `assets/art/export/treasures/<id>.webp` (12), `docs/art/treasures-sheet.png`
- Modify (replace): `assets/art/icons/decor-trophee.png`, `decor-trophee.json`, `decor-trophee_cut.png`
- Create: `assets/art/export/icons/decor-trophee.webp`

**Interfaces:**
- Consumes: nothing from Tasks 1-2 (the pieces do not depend on the rooms).
- Produces: `assets/art/export/treasures/<id>.webp` for ids `decor-lanterne, decor-tapis, decor-bibliotheque, decor-trophee, decor-fresque, decor-amphore, decor-chouette, decor-mosaique, decor-bouclier, sandales_hermes, egide, foudre_zeus`; each printed with its pixel size and aspect (h / w). `REAL_CM` in `tools/art/treasures.py` (Task 5 uses it for the scale). The new wreath icon at `assets/art/export/icons/decor-trophee.webp`.

- [ ] **Step 1: Write the twelve prompt files** (`$JOB/treasures/<id>.txt`)

Every prompt = the **treasure composition sentence** around the subject:

> `a single object centred in the frame with plenty of empty white room on every side, seen straight from the front at eye level, soft even warm light from the upper left. subject: <SUBJECT> One clear silhouette with a clean dark ink outline all around and rich saturated colours, the whole object visible from its top down to its base with empty white room below, (scenery:-3) (text:-3) (letters:-3) (cast shadow on the ground:-3), isolated on a flat plain white background.`

(The icon recipe's "slight three-quarter angle" becomes "straight from the front": one cut-out must fit every room's straight-on wall.) Subjects, sizes and seed bases:

| id | size | seeds | SUBJECT |
|---|---|---|---|
| decor-lanterne | 1024x1024 | 7410-7412 | `the lantern of Hestia, a small ancient Greek bronze lantern with a round ring handle on top to hang it from, pierced sides and a little pointed roof, a warm orange flame inside drawn as a solid closed inked shape, nothing glows, smooth polished warm golden bronze, (patina:-3) (chain:-2).` |
| decor-tapis | 1344x768 | 7420-7422 | `the rug of Penelope lying flat on the floor, seen from the front at eye level so the rectangle looks like a wide low foreshortened strip, a thick hand-woven wool rug with a Greek key meander border in terracotta, cream and Aegean blue and a pattern of olive branches in the middle, a small tassel fringe along the near and far edges, (rolled up:-3) (standing:-2) (floor:-3).` |
| decor-bibliotheque | 768x1344 | 7430-7432 | `the bookcase of Alexandria, a tall free-standing ancient Greek wooden bookcase standing on the floor, warm honey-coloured carved wood, four rows of cubby holes each holding rolled cream parchment scrolls with red cords and small round wooden tags, a carved cornice with a Greek key band on top, (books:-3) (doors:-2).` |
| decor-trophee | 1024x1024 | 7440-7442 | `cast entirely in solid gleaming yellow gold, the laurel crown of the victors, one golden laurel wreath made of two curved branches of gold laurel leaves meeting at the top, tied at the bottom with a small Aegean blue ribbon, displayed standing upright on a small round dark wooden stand, made entirely of solid gleaming yellow gold, every leaf gold, (green leaves:-3) (apple:-3) (head:-3).` |
| decor-fresque | 1344x768 | 7450-7452 | `the fresco of the Muses, a wide rectangular ancient Greek fresco panel freshly painted on smooth plaster inside a simple painted border, clean and new, showing the nine Muses standing in a row in flowing cream, terracotta and olive chitons on a deep Aegean blue ground, one with a lyre, one with a scroll, one with a mask, (cracks:-3) (broken edges:-3) (ruin:-3).` |
| decor-amphore | 768x1344 | 7460-7462 | `one painted ancient Greek amphora standing upright on its foot, a tall elegant two-handled terracotta vase in warm orange clay, large and filling most of the picture, painted with black figures of a running hero and a band of Greek key pattern around its neck and foot, glossy fired glaze, (lying down:-3).` |
| decor-chouette | 1024x1024 | 7470-7472 | `a small carved white marble statue of Athena's owl, a stylised little owl sitting upright with big round eyes and neatly carved feather shapes, polished creamy white marble with soft grey veins, standing on a small square marble plinth, large and filling most of the picture, a treasured work of art, (living bird:-3) (realistic photo:-2) (detailed realistic feathers:-2).` |
| decor-mosaique | 1024x1024 | 7480-7482 | `a rectangular ancient Greek mosaic panel in a carved wooden frame, large and filling most of the picture, made of many small square coloured stone tiles clearly visible, showing three graceful Muses in flowing chitons, one holding a lyre, one a scroll and one a mask, on a golden tile background with a border of Greek key pattern in terracotta and Aegean blue tiles.` |
| decor-bouclier | 1024x1024 | 7490-7492 | `one ceremonial ancient Greek round hoplite shield hanging flat, large and filling most of the picture, smooth mirror-polished warm golden bronze, one clean even metal colour all over, a raised rim with a band of Greek key pattern, in its centre a raised relief of a proud Pegasus with spread wings, a treasured parade piece, (patina:-3) (rust:-3) (blotches:-3) (colourful patches:-3) (spear:-2).` |
| sandales_hermes | 1024x1024 | 7500-7502 | `the winged sandals of Hermes, one pair of ancient Greek brown leather sandals standing side by side with their toes toward the viewer, laced straps and small gold buckles, each with a small white feathered wing at the ankle, (feet:-3) (legs:-3).` |
| egide | 1024x1024 | 7510-7512 | `the Aegis of Athena, a round bronze-and-gold ancient Greek shield hanging flat, deep Aegean blue enamel face with a gold Greek key rim and a stylised golden owl in the middle, a small gold fringe of scales at its edge, (patina:-3) (spear:-2).` |
| foudre_zeus | 768x1344 | 7520-7522 | `the thunderbolt of Zeus displayed standing upright in a small round polished bronze stand, one bold golden zigzag lightning bolt held vertically with a pointed spearhead at each end and a thick grip wrapped in Aegean blue cord in the middle, a few small solid pale blue spark shapes with inked edges, nothing glows, (hand:-3) (patina:-3).` |

- [ ] **Step 2: Generate, two pieces per locked batch (6 images), Forge idle checked outside the lock before each**

For each pair of ids (Task 1 Step 2 before each call):

```bash
tools/art/with_lock.sh sh -c 'python .claude/skills/krea2/generate.py --prompt-file C:/Users/nicol/.claude/jobs/9ac9a508/tmp/treasures/decor-lanterne.txt --style discorde-inked-clean --size 1024x1024 --seed 7410 --count 3 --vscale 1.0 --out C:/Users/nicol/.claude/jobs/9ac9a508/tmp/treasures/decor-lanterne.png && python .claude/skills/krea2/generate.py --prompt-file C:/Users/nicol/.claude/jobs/9ac9a508/tmp/treasures/decor-tapis.txt --style discorde-inked-clean --size 1344x768 --seed 7420 --count 3 --vscale 1.0 --out C:/Users/nicol/.claude/jobs/9ac9a508/tmp/treasures/decor-tapis.png'
```

Pairs: (lanterne, tapis), (bibliotheque, trophee), (fresque, amphore), (chouette, mosaique), (bouclier, sandales_hermes), (egide, foudre_zeus), with each id's size and seed base from the table.

- [ ] **Step 3: Pick one per id (Read each) and install it**

Acceptance per piece: front-facing (no three-quarter turn), the whole object in frame with white around it, flat white background with no cast shadow, no text, no extra object (a second caduceus-style duplicate is a reject), the material right (the wreath all gold, the shields one even metal, the tapis flat and foreshortened, the fresco clean and new), readable at 64 px. If none of three passes: rewrite one clause (one change at a time, krea2 skill), seeds base+3..+5, once; then keep the best and note it.

```bash
mkdir -p assets/art/treasures
cp "$JOB/treasures/<id>_<n>.png" assets/art/treasures/<id>.png
cp "$JOB/treasures/<id>_<n>.json" assets/art/treasures/<id>.json
```

For silver-free pieces no post-processing is needed; if a bronze piece shows strong multicolour blotches, desaturate as the krea2 skill says (`ImageEnhance.Color(0.3)` then `Contrast(1.08)`) and add `"postprocess": "Color 0.3, Contrast 1.08"` to its sidecar.

- [ ] **Step 4: Cut out the twelve**

```bash
tools/art/run_docker.sh cutout assets/art/treasures/decor-lanterne.png assets/art/treasures/decor-tapis.png assets/art/treasures/decor-bibliotheque.png assets/art/treasures/decor-trophee.png assets/art/treasures/decor-fresque.png assets/art/treasures/decor-amphore.png assets/art/treasures/decor-chouette.png assets/art/treasures/decor-mosaique.png assets/art/treasures/decor-bouclier.png assets/art/treasures/sandales_hermes.png assets/art/treasures/egide.png assets/art/treasures/foudre_zeus.png
```

Expected: twelve `<id>_cut.png`. Check each on dark, mid and terracotta at 3x (art-cutout "Check the result"): no white rim, no holes, thin parts kept. Enclosed white gaps (between the wreath's branches, the sandals' straps): `python tools/art/clear_holes.py assets/art/treasures/<id>_cut.png --dry-run`, then with `--box` around the gap only (never unrestricted on the marble owl or the polished metal).

- [ ] **Step 5: Write the export tool `tools/art/treasures.py`**

```python
"""Export the twelve room treasures (spec 2026-10-02 house treasures) and build their contact sheet.

    python tools/art/treasures.py webp    # assets/art/treasures/<id>_cut.png -> assets/art/export/treasures/<id>.webp
    python tools/art/treasures.py sheet   # docs/art/treasures-sheet.png
    python tools/art/treasures.py all

WebP: trimmed to the solid object (the icons' opening filter drops stray matting specks) with 4 px of
air, so the piece's base is its image's bottom edge (the room's `y`); the long side downscaled to
768 px for the four big pieces, 512 px for the others; alpha kept. Quality starts at 82 and steps
down until the file is under its budget (floor 50). Each line printed gives the size and the aspect
(height / width).

Contact sheet: the twelve pieces at one common scale (REAL_CM, the width of each piece in
centimetres) beside a bronze trophy for reference, on the dark UI colour, a mid grey and parchment.

Runs on the host (Pillow) or in the art container (tools/art/run_docker.sh has Pillow too).
"""
import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

from icons import DARK, PARCHMENT

SRC = Path("assets/art/treasures")
# Staged export: the code task that wires the treasures moves them into web/public/art/treasures/.
DST = Path("assets/art/export/treasures")
SHEET = Path("docs/art/treasures-sheet.png")
TROPHY = Path("web/public/art/trophies/large/trophy-hydre-2.webp")
TROPHY_CM = 22          # a trophy statuette's height in centimetres, base included
TROPHY_FILL = 0.87      # its share of the 512 px box (6.5 % transparent margin above and below)
MID = (118, 110, 104)
BIG = (768, 90 * 1024)
SMALL = (512, 50 * 1024)
# id -> ((long side px, budget bytes), real width in cm: the sheet's scale and the rooms' (Task 5)).
PIECES = {
    "decor-lanterne": (SMALL, 22),
    "decor-tapis": (BIG, 220),
    "decor-bibliotheque": (BIG, 110),
    "decor-trophee": (SMALL, 30),
    "decor-fresque": (BIG, 160),
    "decor-amphore": (SMALL, 40),
    "decor-chouette": (SMALL, 25),
    "decor-mosaique": (BIG, 100),
    "decor-bouclier": (SMALL, 80),
    "sandales_hermes": (SMALL, 28),
    "egide": (SMALL, 80),
    "foudre_zeus": (SMALL, 25),
}
REAL_CM = {k: cm for k, (_, cm) in PIECES.items()}


def trim(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    solid = img.getchannel("A").point(lambda a: 255 if a > 128 else 0).filter(ImageFilter.MinFilter(9)).filter(ImageFilter.MaxFilter(9))
    l, t, r, b = solid.getbbox() or (0, 0, *img.size)
    pad = 4
    return img.crop((max(l - pad, 0), max(t - pad, 0), min(r + pad, img.width), min(b + pad, img.height)))


def webp():
    DST.mkdir(parents=True, exist_ok=True)
    total = 0
    for pid, ((long_px, budget), _) in PIECES.items():
        img = trim(Image.open(SRC / f"{pid}_cut.png"))
        scale = long_px / max(img.size)
        if scale < 1:
            img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
        dst = DST / f"{pid}.webp"
        for q in range(82, 45, -5):
            img.save(dst, "WEBP", quality=q, method=6)
            if dst.stat().st_size <= budget:
                break
        size = dst.stat().st_size
        total += size
        print(f"{dst}  {img.width}x{img.height}  aspect {img.height / img.width:.4f}  q{q}  {size / 1024:.1f} KiB")
    print(f"total: {total / 1024:.1f} KiB")


def sheet(px_per_cm: float = 2.4):
    pad, label_h = 16, 22
    font = ImageFont.load_default(size=16)
    items = []
    for pid, cm in REAL_CM.items():
        img = Image.open(DST / f"{pid}.webp").convert("RGBA")
        w = round(cm * px_per_cm)
        items.append((pid, img.resize((w, round(w * img.height / img.width)), Image.LANCZOS)))
    trophy = Image.open(TROPHY).convert("RGBA")
    side = round(TROPHY_CM * px_per_cm / TROPHY_FILL)
    items.append(("trophy (scale)", trophy.resize((side, side), Image.LANCZOS)))
    width = 2400
    rows, row, x = [], [], pad
    for it in items:
        if row and x + it[1].width + pad > width:
            rows.append(row)
            row, x = [], pad
        row.append(it)
        x += it[1].width + pad
    rows.append(row)
    band_h = sum(max(i.height for _, i in r) + label_h + 2 * pad for r in rows)
    out = Image.new("RGB", (width, 3 * band_h), DARK)
    draw = ImageDraw.Draw(out)
    y = 0
    for bg, fg in ((DARK, PARCHMENT), (MID, PARCHMENT), (PARCHMENT, DARK)):
        draw.rectangle((0, y, width - 1, y + band_h - 1), fill=bg)
        for r in rows:
            h = max(i.height for _, i in r)
            x = pad
            for pid, img in r:
                out.paste(img, (x, y + pad + h - img.height), img)   # bottoms aligned: one floor line
                draw.text((x, y + pad + h + 4), pid, fill=fg, font=font)
                x += img.width + pad
            y += h + label_h + 2 * pad
    SHEET.parent.mkdir(parents=True, exist_ok=True)
    out.save(SHEET, optimize=True)
    print(f"{SHEET}  {out.width}x{out.height}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("what", choices=["webp", "sheet", "all"])
    a = ap.parse_args()
    if a.what in ("webp", "all"):
        webp()
    if a.what in ("sheet", "all"):
        sheet()


if __name__ == "__main__":
    main()
```

(`from icons import ...` works because `tools/art/` is the script's own folder, as in `trophies.py`.)

- [ ] **Step 6: Run it**

From the worktree root:

```bash
python tools/art/treasures.py all
```

Expected: twelve lines with size, aspect and KiB (BIG under 90, SMALL under 50), `total` under 700 KiB, and `docs/art/treasures-sheet.png`.

- [ ] **Step 7: The wreath's icon (Ruling R4)**

```bash
cp assets/art/treasures/decor-trophee.png assets/art/icons/decor-trophee.png
cp assets/art/treasures/decor-trophee.json assets/art/icons/decor-trophee.json
cp assets/art/treasures/decor-trophee_cut.png assets/art/icons/decor-trophee_cut.png
tools/art/run_docker.sh icons webp --dst assets/art/export/icons --only decor-trophee
```

Expected: `assets/art/export/icons/decor-trophee.webp  q<..>  <n> KiB`, under 20 KiB (the decor icons' budget in `art.test.ts`).

- [ ] **Step 8: STOP for the review. Hand back to the controller**

Report the sheet `docs/art/treasures-sheet.png`, the twelve WebP paths with their aspects, and any accepted weak spot. **The controller shows the sheet to the user.** A piece the user rejects is redone (Steps 2-6 for that id, seeds +10) before Task 5. Then commit:

```bash
git add assets/art/treasures/ tools/art/treasures.py assets/art/export/treasures/ docs/art/treasures-sheet.png assets/art/icons/decor-trophee.png assets/art/icons/decor-trophee.json assets/art/icons/decor-trophee_cut.png assets/art/export/icons/decor-trophee.webp
git commit -F - <<'EOF'
House treasures: twelve front-facing cut-outs (nine decor with the Couronne de laurier for decor:trophee, three gear) and their export tool; WebPs and the wreath's icon staged in assets/art/export; contact sheet at one scale in docs/art/treasures-sheet.png

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 4: No display limit (server and client)

Independent of the art: it can run any time, even while Tasks 1-3 wait on the user (it does not touch the room's drawing).

**Files:**
- Modify: `server/app/world/shop.py:24-26,104`, `server/app/routers/world.py:28,36-38,494-536`
- Modify: `server/tests/test_shop.py:5,37,92`, `server/tests/test_drachmes_api.py:17,276-290`, `server/tests/test_world_api.py:204-310`
- Modify: `web/src/lib/world/types.ts:32`, `web/src/lib/world/guide.ts:68,92,115-116`, `web/src/lib/world/guide.test.ts:52,86`, `web/src/lib/world/shop.test.ts:19`
- Modify: `web/src/lib/world/scenes/cabin.ts:127-134`, `web/src/lib/world/scenes/cabin.test.ts`
- Modify: `web/src/components/places/cabin/TrophiesPanel.svelte`, `web/src/screens/CabinRoom.svelte:382,404,465`
- Modify: `web/e2e/scenes-cabin.spec.ts:399-425`, `web/e2e/scenes-house.spec.ts:76`

**Interfaces:**
- Consumes: nothing.
- Produces: `PATCH /api/profiles/{id}/rewards/{rid}` never refuses decor for room; `/api/world`'s `shop` has no `max_decor`; `ShopCatalog` has no `max_decor`; `TrophiesPanel` props are `{ profile, owned, house, loadError?, onUpdated }`; `cabin.ts` no longer exports `MAX_DISPLAYED_DECOR` or `WALLS_FULL_LINE` (it still exports `DECOR_SLOTS` and `BARE_WALLS` until Task 6).

- [ ] **Step 1: Write the failing server tests**

In `server/tests/test_shop.py`: drop `MAX_DECOR` from the import (line 5) and the line `assert MAX_DECOR == {"cabin": 4, "villa": 6, "palais": 9}`; in `test_the_shop_catalog_served_to_the_client` replace the last assertion with:

```python
    assert c["slot_levels"] == {"cou": 2, "queue": 3, "dos": 4, "tete": 5}
    # Spec 2026-10-02 house treasures: every house has a place for every piece, so no wall limit is served.
    assert "max_decor" not in c
```

and add:

```python
def test_no_wall_limit_is_left_in_the_shop():
    import app.world.shop as shop
    assert not hasattr(shop, "MAX_DECOR")
```

In `server/tests/test_drachmes_api.py`: delete `WALLS_FULL = ...` (line 17) and replace `test_the_walls_hold_four_six_or_nine_pieces_by_house` with:

```python
# Spec 2026-10-02 house treasures: no display limit, in any house.
def test_every_house_displays_all_nine_pieces(client, settings):
    pid = make_profile(client, level="10H")
    own(settings, pid, *QUEST_DECOR, *SHOP_DECOR)
    for d in [*QUEST_DECOR, *SHOP_DECOR]:
        assert wear(client, pid, d).status_code == 200                                 # nine in the cabin
    own(settings, pid, "house:villa")
    assert wear(client, pid, SHOP_DECOR[0], on=False).status_code == 200
    assert wear(client, pid, SHOP_DECOR[0]).status_code == 200                         # still nine in the villa
    assert sum(1 for x in client.get(f"/api/profiles/{pid}/rewards").json() if x["kind"] == "decor" and x["equipped"]) == 9
```

(`wear(client, pid, rid, on=True)` already exists in that file.)

In `server/tests/test_world_api.py`: replace `test_the_cabin_walls_hold_four_pieces_of_decor` with (Review Focus 5):

```python
def test_decor_on_display_before_the_limit_went_stays_and_all_nine_fit(client, settings):
    # Spec 2026-10-02 house treasures: no display limit. A hero who had four pieces on the cabin's
    # walls under the old limit keeps them displayed (the flag is the only state, no migration),
    # and the other five go on display too.
    from app.world.catalog import REWARDS
    pid = make_profile(client)
    decor = [rid for rid, r in REWARDS.items() if r["kind"] == "decor"]
    assert len(decor) == 9
    conn = sqlite3.connect(settings.data_dir / DB_FILENAME)
    for i, rid in enumerate([*decor, "sandales_hermes"]):
        conn.execute("INSERT INTO reward(profile_id, reward_id, source, granted_at, equipped) VALUES (?,?,?,?,?)",
                     (pid, rid, "test", "2026-09-21T12:00:00+00:00", int(i < 4)))
    conn.commit(); conn.close()
    patch = lambda rid, on: client.patch(f"/api/profiles/{pid}/rewards/{rid}", json={"equipped": on})
    shown = lambda: {r["id"] for r in client.get(f"/api/profiles/{pid}/rewards").json() if r["equipped"]}
    assert shown() == set(decor[:4])
    for rid in decor[4:]:
        assert patch(rid, True).json()["equipped"] is True
    assert patch("sandales_hermes", True).json()["equipped"] is True
    assert shown() == {*decor, "sandales_hermes"}
    # A piece put away comes off, and goes back on.
    assert patch("decor:tapis", False).json()["equipped"] is False
    assert patch("decor:tapis", True).json()["equipped"] is True
```

Delete `test_two_pieces_hung_at_once_cannot_both_take_the_last_spot` entirely (Ruling R7).

- [ ] **Step 2: Run them to see them fail**

Run: `STACK=house scripts/pytest.sh -q tests/test_shop.py tests/test_drachmes_api.py tests/test_world_api.py 2>&1 | tail -20`
Expected: FAIL: `test_no_wall_limit_is_left_in_the_shop`, the catalog test (`max_decor` present), `test_every_house_displays_all_nine_pieces` (409 on the fifth), `test_decor_on_display_...` (409).

- [ ] **Step 3: Remove the limit on the server**

`server/app/world/shop.py`: delete lines 24-26 (the comment and `MAX_DECOR = ...`) and the `"max_decor": dict(MAX_DECOR),` line of `shop_catalog`.

`server/app/routers/world.py`:
- line 28: `from app.world.shop import affordable, house_of, is_item, on_sale, parse_accessory, price_of, shop_catalog, worn`
- delete lines 36-38 (the two comment lines and `WALLS_FULL_MESSAGE = ...`)
- delete `_displayed_decor` (lines 500-503)
- `patch_reward` becomes:

```python
@router.patch("/profiles/{profile_id}/rewards/{reward_id}")
def patch_reward(profile_id: int, reward_id: str, body: RewardPatch, db: sqlite3.Connection = Depends(get_db)):
    fetch_profile(db, profile_id)
    if reward_id not in REWARDS:
        raise HTTPException(404, "Reward not found")
    # Under the write lock (final review M18): an accessory put on and the other of its slot taken
    # off are one transaction. Decor is never refused for lack of room: every house has a place for
    # every piece (spec 2026-10-02 house treasures).
    begin_write(db)
    row = db.execute("SELECT * FROM reward WHERE profile_id = ? AND reward_id = ?", (profile_id, reward_id)).fetchone()
    if row is None:
        db.rollback()
        raise HTTPException(404, "Reward not found")
    kind = _kind(reward_id)
    if kind == "house":
        db.rollback()
        raise HTTPException(409, HOUSE_MESSAGE)
    if body.equipped and kind == "accessory":
        # Spec §4 (R7): one piece per slot; putting one on takes off the other of its slot, in the same transaction.
        slot = parse_accessory(reward_id)[1]
        others = [accessory_id(k, slot) for k in ACCESSORY_SETS if accessory_id(k, slot) != reward_id]
        db.execute(f"UPDATE reward SET equipped = 0 WHERE profile_id = ? AND reward_id IN ({','.join('?' * len(others))})",
                   (profile_id, *others))
    db.execute("UPDATE reward SET equipped = ? WHERE profile_id = ? AND reward_id = ?", (int(body.equipped), profile_id, reward_id))
    db.commit()
    row = db.execute("SELECT * FROM reward WHERE profile_id = ? AND reward_id = ?", (profile_id, reward_id)).fetchone()
    return {**REWARDS[reward_id], "granted_at": row["granted_at"], "equipped": bool(row["equipped"])}
```

Check: `grep -rn "MAX_DECOR\|WALLS_FULL\|_displayed_decor\|max_decor" server/` prints only `server/tests/test_shop.py` (the two new assertions). `server/tests/test_french_spacing.py` lines 94/98 use « Les murs sont pleins » as sample strings for the spacing checker only; leave them.

- [ ] **Step 4: Run the server tests**

Run: `STACK=house scripts/pytest.sh -q 2>&1 | tail -5` (in the background, log to `$JOB/pytest-task4.log`)
Expected: all pass.

- [ ] **Step 5: Write the failing client tests**

`web/src/lib/world/guide.test.ts`: remove `max_decor: { cabin: 5, villa: 7, palais: 10 },` from `ODD`, and replace `expect(d).toContain('5 pièces dans la cabane, 7 dans la villa, 10 dans le palais');` with:

```ts
    // Spec 2026-10-02 house treasures: every house has a place for every piece, a bigger one is grander.
    expect(d).toContain('Chaque maison a une place pour chacun de tes trésors\u202f: plus elle est grande, plus la pièce est belle.');
    expect(d).not.toMatch(/pièces dans la cabane|murs portent/);
    expect(s).toContain('Il pose aussi un trophée à sa place dans ta maison.');
    expect(s).not.toContain('étagère de ta cabane');
```

(`s` is the `sceaux` section text, already defined above in that test.)

`web/src/lib/world/shop.test.ts`: remove the line `max_decor: { cabin: 4, villa: 6, palais: 9 },`.

`web/src/lib/world/scenes/cabin.test.ts`: remove `MAX_DISPLAYED_DECOR` and `WALLS_FULL_LINE` from the import and `readFileSync` from `node:fs`'s import if unused; delete the test `'the slots agree with the server: four, six, nine'` and the test `'holds one piece per wall spot and says so in words when they are all taken'`; add to `describe('the three houses', ...)`:

```ts
  it('keeps no display limit (spec 2026-10-02 house treasures)', async () => {
    const mod = await import('./cabin');
    expect('MAX_DISPLAYED_DECOR' in mod).toBe(false);
    expect('WALLS_FULL_LINE' in mod).toBe(false);
  });
```

- [ ] **Step 6: Run to see them fail**

Run: `STACK=house scripts/npm.sh run test -- src/lib/world/guide.test.ts src/lib/world/scenes/cabin.test.ts 2>&1 | tail -20`
Expected: FAIL on the guide sentence and on `MAX_DISPLAYED_DECOR in mod`.

- [ ] **Step 7: Remove the limit on the client**

`web/src/lib/world/types.ts`: delete `max_decor: Record<House, number>;` (line 32).

`web/src/lib/world/guide.ts`: delete `const walls = shop.max_decor;`; in the `sceaux` section replace ` Il pose aussi un trophée sur l'étagère de ta cabane.` with ` Il pose aussi un trophée à sa place dans ta maison.`; in the `drachmes` section replace the two lines

```ts
            'Plus la maison est grande, plus ses murs portent de décor\u202f:',
            `${walls.cabin} pièces dans la cabane, ${walls.villa} dans la villa, ${walls.palais} dans le palais.`,
```

with

```ts
            'Chaque maison a une place pour chacun de tes trésors\u202f: plus elle est grande, plus la pièce est belle.',
```

`web/src/lib/world/scenes/cabin.ts`: delete lines 127-134 (`MAX_DISPLAYED_DECOR` with its comment, and `WALLS_FULL_LINE`). In the comment above `DECOR_SLOTS` nothing names the server any more; leave `DECOR_SLOTS`/`BARE_WALLS` (Task 6 replaces them).

`web/src/components/places/cabin/TrophiesPanel.svelte`:
- header comment lines 6-8 become: `// from the dragon's care, in the nest). Gear and decor on display stand at their own place in the room (spec 2026-10-02 house treasures, no limit): the room owns the list of rewards and hands it down; a piece put on display or away goes back up through \`onUpdated\` (final review M15: one /rewards fetch).`
- delete `import { WALLS_FULL_LINE } from '../../../lib/world/scenes/cabin';`
- props comment: `// \`owned\`: null while the room's /rewards has not answered; \`loadError\` when it could not; \`house\`: the house the hero lives in, whose name the shelf's own words follow (spec 2026-09-29 drachmes §3).`; delete `maxDecor` from the destructuring and from the type.
- delete the `wallsFull` comment, `let wallsFull`, `const displayedDecor`; `toggleEquip` becomes:

```ts
  async function toggleEquip(id: string) {
    const current = ownedById.get(id);
    if (!current) return;
    equipError = '';
    equippingId = id;
    try {
      onUpdated(await worldApi.patchReward(profile.id, id, !current.equipped));
    } catch (e) {
      equipError = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
    } finally {
      equippingId = null;
    }
  }
```

- delete the markup `{#if section.kind === 'decor' && wallsFull}...{/if}` (lines 221-223).

`web/src/screens/CabinRoom.svelte`: import line becomes `import { DECOR_SLOTS, cabinGreeting, guideLine, houseScene, journalLine, lyreLine, trophiesLine } from '../lib/world/scenes/cabin';`; delete the `houseKnown` comment and line (402-404, keep `const house = ...` with the comment `// Until /camp answers, the cabin (R21): the places arrive from the camp, which has loaded it.`); the panel line becomes `<TrophiesPanel {profile} {owned} {house} loadError={rewardsError} onUpdated={updated} />`.

Check: `grep -rn "maxDecor\|max_decor\|MAX_DISPLAYED_DECOR\|WALLS_FULL\|wallsFull\|walls-full" web/src web/e2e` prints only the e2e lines Step 8 replaces.

- [ ] **Step 8: Replace the walls-full e2e test (Review Focus 4)**

In `web/e2e/scenes-cabin.spec.ts` replace the test `'the walls hold four pieces: a fifth « Exposer » says so and hangs nothing'` with:

```ts
// Spec 2026-10-02 house treasures: no display limit; the shelf only ever says what the server says.
test('a fifth piece goes on display; a refusal from the server is said word for word', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const row = (rid: string, equipped: boolean) => ({ id: rid, kind: 'decor', name: rid, desc: '', source: '', granted_at: '2026-09-21T12:00:00+00:00', equipped });
  const state = new Map<string, boolean>([
    ['decor:lanterne', true], ['decor:tapis', true], ['decor:bibliotheque', true], ['decor:trophee', true],
    ['decor:fresque', false], ['decor:amphore', false],
  ]);
  let refuse = false;
  const patches: string[] = [];
  await page.route(`**/api/profiles/${id}/rewards**`, (route) => {
    const req = route.request();
    if (req.method() === 'PATCH') {
      patches.push(req.url());
      if (refuse) return route.fulfill({ status: 409, json: { detail: "Ta maison n'est pas un objet à exposer." } });
      const rid = decodeURIComponent(req.url().split('/rewards/')[1]);
      state.set(rid, (req.postDataJSON() as { equipped: boolean }).equipped);
      return route.fulfill({ json: row(rid, state.get(rid)!) });
    }
    return route.fulfill({ json: [...state].map(([rid, on]) => row(rid, on)) });
  });
  await page.goto(`/#/p/${id}/cabane?panel=tresors`);
  const shelf = page.getByTestId('overlay-trophies');
  const fresque = shelf.getByTestId('cabin-equip-decor:fresque');
  await expect(fresque).toHaveText('Exposer');
  await tap(fresque, testInfo);
  await expect(fresque).toHaveText('Ranger');
  refuse = true;
  const amphore = shelf.getByTestId('cabin-equip-decor:amphore');
  await tap(amphore, testInfo);
  await expect(shelf.getByRole('alert')).toHaveText("Ta maison n'est pas un objet à exposer.");
  await expect(amphore).toHaveText('Exposer');
  expect(patches, 'both asked the server').toHaveLength(2);
  expect(await redScan(page)).toEqual([]);
});
```

In `web/e2e/scenes-house.spec.ts` delete line 76 (`await expect(page.getByTestId('cabin-walls-full')).toHaveCount(0);`).

- [ ] **Step 9: Run the client checks**

Run (background, logs in `$JOB`): `STACK=house scripts/npm.sh run test > $JOB/vitest-task4.log 2>&1; STACK=house scripts/npm.sh run check > $JOB/check-task4.log 2>&1; tail -5 $JOB/vitest-task4.log $JOB/check-task4.log`
Expected: all vitest pass; svelte-check `0 errors and 0 warnings`.

Then: `PW_WORKERS=1 STACK=house scripts/playwright.sh scenes-cabin scenes-house > $JOB/e2e-task4.log 2>&1; tail -15 $JOB/e2e-task4.log`
Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add server/app/world/shop.py server/app/routers/world.py server/tests/test_shop.py server/tests/test_drachmes_api.py server/tests/test_world_api.py web/src/lib/world/types.ts web/src/lib/world/guide.ts web/src/lib/world/guide.test.ts web/src/lib/world/shop.test.ts web/src/lib/world/scenes/cabin.ts web/src/lib/world/scenes/cabin.test.ts web/src/components/places/cabin/TrophiesPanel.svelte web/src/screens/CabinRoom.svelte web/e2e/scenes-cabin.spec.ts web/e2e/scenes-house.spec.ts
git commit -F - <<'EOF'
No display limit (spec 2026-10-02 house treasures): MAX_DECOR and its 409 go from PATCH /rewards, max_decor from /api/world and ShopCatalog, the shelf's walls-full line and maxDecor from TrophiesPanel; the guide says every house has a place for each treasure. Decor displayed under the old limit stays displayed (the flag is the only state, pytest); the race test on the last wall spot goes with its subject

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 5: Measure the places and the hotspots on the chosen rooms

**Files:**
- Create: `tools/art/grid.py`, `tools/art/treasure_preview.py`
- Create: `web/src/lib/world/scenes/treasure-places.json` (not imported until Task 6)
- Modify: `docs/art/scenes.md` (the cabin section becomes the three rooms' sections)
- Create (scratch): `$JOB/measure/*.png`, `$JOB/measure/house-shapes.json`

**Interfaces:**
- Consumes: `assets/art/scenes/<house>.png` (Task 2), `assets/art/export/treasures/*.webp` and `REAL_CM` (Task 3), the trophies `web/public/art/trophies/large/*.webp`.
- Produces: `treasure-places.json` = `{ "cabin" | "villa" | "palais": { "<PieceId>": { "x": number, "y": number, "w": number } } }` with the 18 PieceIds `hydre, echo, chimere, protee, sirenes, lethe, sandales_hermes, egide, foudre_zeus, decor:lanterne, decor:tapis, decor:bibliotheque, decor:trophee, decor:fresque, decor:amphore, decor:chouette, decor:mosaique, decor:bouclier`; the three hotspot polygons per house (art %, `[[x, y], ...]`) in `docs/art/scenes.md` and `$JOB/measure/house-shapes.json` = `{ "<house>": { "trophies": { "points": [[x, y], ...], "labelPos": "below" }, "journal": { ..., "labelPos": "above" }, "lyre": { ..., "labelPos": "above" } } }`.

- [ ] **Step 1: Write `tools/art/grid.py`**

```python
"""Draw an art-% grid over a scene picture, for measuring places (docs/art/scenes.md).

    python tools/art/grid.py assets/art/scenes/cabin.png --out <tmp>/cabin-grid.png
    python tools/art/grid.py assets/art/scenes/cabin.png --out <tmp>/cabin-left.png --crop 10 10 40 60 --scale 2

Lines every 1 % (faint) and every 5 % (strong), the iPad safe zone (x 12.5 and 87.5, cyan), the
HUD's 8 % (red), the room's name plaque (x 43-57, y 9.5-15.6, red box) and the dialogue dock
(x 27-87.5, y 80-100, orange box). With --crop (art % of the whole picture) the crop is cut after
drawing and enlarged --scale times; the 5 % lines are labelled along the crop's top and left edges,
in art % of the whole picture.
"""
import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("src", type=Path)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--crop", type=float, nargs=4, metavar=("X0", "Y0", "X1", "Y1"), default=(0, 0, 100, 100))
    ap.add_argument("--scale", type=float, default=1.0)
    a = ap.parse_args()
    img = Image.open(a.src).convert("RGBA")
    W, H = img.size
    px = lambda x: x * W / 100
    py = lambda y: y * H / 100
    over = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(over)
    for i in range(101):
        strong = i % 5 == 0
        c, w = ((255, 255, 255, 170), 2) if strong else ((255, 255, 255, 60), 1)
        d.line([(px(i), 0), (px(i), H)], fill=c, width=w)
        d.line([(0, py(i)), (W, py(i))], fill=c, width=w)
    for x in (12.5, 87.5):
        d.line([(px(x), 0), (px(x), H)], fill=(0, 200, 255, 230), width=3)
    d.line([(0, py(8)), (W, py(8))], fill=(255, 80, 80, 230), width=3)
    d.rectangle([px(43), py(9.5), px(57), py(15.6)], outline=(255, 80, 80, 230), width=3)
    d.rectangle([px(27), py(80), px(87.5), py(100)], outline=(255, 160, 0, 230), width=3)
    out = Image.alpha_composite(img, over)
    x0, y0, x1, y1 = a.crop
    out = out.crop((round(px(x0)), round(py(y0)), round(px(x1)), round(py(y1))))
    out = out.resize((round(out.width * a.scale), round(out.height * a.scale)), Image.LANCZOS).convert("RGB")
    d = ImageDraw.Draw(out)
    font = ImageFont.load_default(size=18)
    sx, sy = out.width / (x1 - x0), out.height / (y1 - y0)
    for i in range(0, 101, 5):
        if x0 <= i <= x1:
            d.text(((i - x0) * sx + 3, 3), str(i), fill=(255, 255, 0), font=font, stroke_width=2, stroke_fill=(0, 0, 0))
        if y0 <= i <= y1:
            d.text((3, (i - y0) * sy + 3), str(i), fill=(255, 255, 0), font=font, stroke_width=2, stroke_fill=(0, 0, 0))
    a.out.parent.mkdir(parents=True, exist_ok=True)
    out.save(a.out)
    print(a.out, out.size)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Write `tools/art/treasure_preview.py`**

```python
"""Preview the treasures in a room before the game draws them (spec 2026-10-02 house treasures).

    python tools/art/treasure_preview.py cabin --out <tmp>/cabin-full.png [--level 5] [--outline]
        [--shapes <tmp>/house-shapes.json] [--check]

Reads the room (assets/art/scenes/<house>.png), its places (web/src/lib/world/scenes/
treasure-places.json), the twelve treasures (assets/art/export/treasures/, else web/public/art/
treasures/) and the trophies (web/public/art/trophies/large/trophy-<lt>-<level>.webp), and pastes
each piece with the game's maths (treasures.ts placeBox): x the centre, y the bottom edge, w the
width, art %; the image keeps its own aspect; a trophy sits TROPHY_FOOT of its height lower (its
transparent margin). Standing pieces get an ellipse like the CSS contact shadow.
--outline draws each piece's box and id; --shapes the three places' polygons and their plaque bands
(the unit test's model: 12 % wide, 7 % above a place's box or 9.5 % below it); --check prints every
overlap the unit test (treasures.test.ts) would refuse and exits 1 if there is one.
"""
import argparse
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

LIEUTENANTS = ["hydre", "echo", "chimere", "protee", "sirenes", "lethe"]
STANDS = {*LIEUTENANTS, "decor:bibliotheque", "decor:trophee", "decor:amphore", "decor:chouette", "sandales_hermes", "foudre_zeus"}
TROPHY_FOOT = 0.065
PLACES = Path("web/src/lib/world/scenes/treasure-places.json")
NAME_PLAQUE = (43, 9.5, 14, 6.1)
SAFE = (12.5, 87.5)
HUD = 8


def piece_file(pid: str, level: int) -> Path:
    if pid in LIEUTENANTS:
        return Path(f"web/public/art/trophies/large/trophy-{pid}-{level}.webp")
    name = pid.replace(":", "-")
    staged = Path(f"assets/art/export/treasures/{name}.webp")
    return staged if staged.exists() else Path(f"web/public/art/treasures/{name}.webp")


def place_box(p: dict, aspect: float, foot: float) -> tuple[float, float, float, float]:
    """(x, y, w, h) in art %: treasures.ts placeBox."""
    h = p["w"] * aspect * 16 / 9
    return (p["x"] - p["w"] / 2, p["y"] - h * (1 - foot), p["w"], h)


def hit(a, b) -> bool:
    return a[0] < b[0] + b[2] and b[0] < a[0] + a[2] and a[1] < b[1] + b[3] and b[1] < a[1] + a[3]


def in_polygon(x: float, y: float, pts) -> bool:
    inside, j = False, len(pts) - 1
    for i in range(len(pts)):
        (xi, yi), (xj, yj) = pts[i], pts[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def plaque(shape) -> tuple[float, float, float, float]:
    xs = [p[0] for p in shape["points"]]
    ys = [p[1] for p in shape["points"]]
    mid = (min(xs) + max(xs)) / 2
    return (mid - 6, min(ys) - 7, 12, 7) if shape["labelPos"] == "above" else (mid - 6, max(ys), 12, 9.5)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("house", choices=["cabin", "villa", "palais"])
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--level", type=int, default=5)
    ap.add_argument("--outline", action="store_true")
    ap.add_argument("--shapes", type=Path)
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()
    room = Image.open(f"assets/art/scenes/{a.house}.png").convert("RGBA")
    W, H = room.size
    places = json.loads(PLACES.read_text(encoding="utf-8"))[a.house]
    boxes = {}
    for pid, p in sorted(places.items(), key=lambda kv: kv[1]["y"]):
        img = Image.open(piece_file(pid, a.level)).convert("RGBA")
        foot = TROPHY_FOOT if pid in LIEUTENANTS else 0
        bx, by, bw, bh = place_box(p, img.height / img.width, foot)
        boxes[pid] = (bx, by, bw, bh)
        size = (round(bw * W / 100), round(bh * H / 100))
        left, top = round(bx * W / 100), round(by * H / 100)
        if pid in STANDS:
            sw = size[0] * (0.44 if pid in LIEUTENANTS else 0.76)
            sh = sw / 6
            cx, cy = left + size[0] / 2, top + size[1] * (1 - foot)
            shadow = Image.new("RGBA", room.size, (0, 0, 0, 0))
            ImageDraw.Draw(shadow).ellipse([cx - sw / 2, cy - sh / 2, cx + sw / 2, cy + sh / 2], fill=(20, 12, 6, 115))
            room = Image.alpha_composite(room, shadow.filter(ImageFilter.GaussianBlur(sh / 3)))
        room.alpha_composite(img.resize(size, Image.LANCZOS), (left, top))
    d = ImageDraw.Draw(room)
    font = ImageFont.load_default(size=18)
    if a.outline:
        for pid, (bx, by, bw, bh) in boxes.items():
            d.rectangle([bx * W / 100, by * H / 100, (bx + bw) * W / 100, (by + bh) * H / 100], outline=(255, 255, 0, 255), width=2)
            d.text((bx * W / 100 + 3, by * H / 100 + 3), pid, fill=(255, 255, 0, 255), font=font, stroke_width=2, stroke_fill=(0, 0, 0, 255))
    shapes = json.loads(a.shapes.read_text(encoding="utf-8"))[a.house] if a.shapes else {}
    for sid, s in shapes.items():
        d.polygon([(x * W / 100, y * H / 100) for x, y in s["points"]], outline=(0, 255, 120, 255), width=3)
        px_, py_, pw, ph = plaque(s)
        d.rectangle([px_ * W / 100, py_ * H / 100, (px_ + pw) * W / 100, (py_ + ph) * H / 100], outline=(255, 120, 0, 255), width=2)
    problems = []
    if a.check:
        ids = list(boxes)
        for i, pid in enumerate(ids):
            b = boxes[pid]
            if b[0] < SAFE[0] or b[0] + b[2] > SAFE[1] or b[1] < HUD or b[1] + b[3] > 100:
                problems.append(f"{pid} outside the frame, the safe zone or under the HUD: {b}")
            if hit(b, NAME_PLAQUE):
                problems.append(f"{pid} under the room's name")
            for other in ids[i + 1:]:
                if hit(b, boxes[other]):
                    problems.append(f"{pid} overlaps {other}")
            for sid, s in shapes.items():
                if hit(b, plaque(s)):
                    problems.append(f"{pid} on {sid}'s plaque")
                x = b[0]
                while x <= b[0] + b[2]:
                    y = b[1]
                    while y <= b[1] + b[3]:
                        if in_polygon(x, y, s["points"]):
                            problems.append(f"{pid} in {sid}")
                            break
                        y += 0.25
                    else:
                        x += 0.25
                        continue
                    break
    a.out.parent.mkdir(parents=True, exist_ok=True)
    room.convert("RGB").save(a.out)
    print(a.out)
    for p in problems:
        print("PROBLEM", p)
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Grid each room, whole and in crops**

```bash
J=/c/Users/nicol/.claude/jobs/9ac9a508/tmp/measure; mkdir -p $J
for h in cabin villa palais; do
  python tools/art/grid.py assets/art/scenes/$h.png --out $J/$h-grid.png
  python tools/art/grid.py assets/art/scenes/$h.png --out $J/$h-top.png --crop 10 8 90 40 --scale 1.5
  python tools/art/grid.py assets/art/scenes/$h.png --out $J/$h-left.png --crop 10 30 50 100 --scale 1.5
  python tools/art/grid.py assets/art/scenes/$h.png --out $J/$h-right.png --crop 50 30 90 100 --scale 1.5
done
```

Read each with the Read tool. For finer reads, crop 10 x 10 % at `--scale 3`.

- [ ] **Step 4: Record each room's fixtures (art %, by eye on the 1 % grid, ±0.5 %)**

For every fixture of the Global Constraints list, write down: its box (`x, y, w, h`, top-left corner), its **standing line** (the surface a piece rests on: niche floor, shelf top, pedestal top, bench top, floor contact; for a hook, the hook's lowest point; for a wall panel or peg, the panel's centre) and its **inner width** (the free width a piece may fill). Also the desk's painted width `D` (art %).

- [ ] **Step 5: Compute each place**

- Scale: `s = D / 120` (art % per cm: the desk is taken as 120 cm wide; all back-wall fixtures are at the desk's depth). The floor pieces in front (tapis) are nearer; they take the floor area's width instead.
- Room piece width: `w = min(REAL_CM[piece] * s, 0.9 * inner width)` (REAL_CM from `tools/art/treasures.py`; the tapis: `w = 0.9 * clear floor width`).
- Trophy width (one value for the six, R5): the object fills at most 0.65 of its box's width and 0.87 of its height, so `w = min(0.9 * niche inner width / 0.65, 0.9 * niche inner height / (0.87 * 16 / 9))`.
- `x` = the fixture's centre. `y`: standing pieces the standing line; the lanterne `y = hook point + h` (its ring at the hook: `h = w * aspect * 16 / 9`, aspect printed by Task 3 Step 6); wall pieces `y = panel centre + h / 2`; the tapis the floor area's near edge.
- The six trophies share one `y` (the niches' floor) and one `w`.
- Round to 0.1.

Write the result to `web/src/lib/world/scenes/treasure-places.json` (keys in the order of the Interfaces list, 2-space indent).

- [ ] **Step 6: Draw the three hotspots per room**

On the same grids: `trophies` (« Tes trésors ») around the cupboard, `journal` around the desk and its open journal, `lyre` around the table and the lyre; polygons of 4-6 points, inside x 12.5-87.5, y ≥ 14, clear of the dialogue dock (no box overlap with x 27-87.5, y 80-100), not overlapping each other's bounding boxes (`validateShapes`). `labelPos` stays `below` for `trophies` and `above` for the two others. Write `$JOB/measure/house-shapes.json` (format in Interfaces).

- [ ] **Step 7: Preview and check, iterate until clean**

```bash
J=/c/Users/nicol/.claude/jobs/9ac9a508/tmp/measure
for h in cabin villa palais; do
  python tools/art/treasure_preview.py $h --out $J/$h-check.png --outline --shapes $J/house-shapes.json --check
  python tools/art/treasure_preview.py $h --out $J/$h-full-5.png --level 5
  python tools/art/treasure_preview.py $h --out $J/$h-full-1.png --level 1
done
```

Expected: no `PROBLEM` line, exit 0 for each `--check`. Read the `full` previews: each piece sits on its fixture (base on the line, nothing floating or sunk), the sizes read as one scale, nothing covers a niche's neighbour. Fix the numbers and rerun until both hold. A fixture too small for its piece at the real scale: lower `w` to the fixture (Step 5's `min` already does) and note it.

- [ ] **Step 8: Write the rooms into `docs/art/scenes.md`**

Replace the section `## cabin: the hero's cabin` with three sections `## cabin: the hero's cabin (2026-10-02)`, `## villa: the villa (2026-10-02)`, `## palais: the palais (2026-10-02)`, each with:
- one sentence on the room (its look, seed from its sidecar);
- the table `| Landmark | x | y | w | h | Notes |` with the three hotspot objects (Notes: the polygon's points, its plaque side) and every fixture (Notes: its standing line and the piece it holds);
- the line `Places: web/src/lib/world/scenes/treasure-places.json (x centre, y bottom edge, w width, art %), measured with tools/art/grid.py and checked with tools/art/treasure_preview.py --check.`

Keep the file's "How to read the boxes" rules (top-left `x, y`, ±2 % becomes ±0.5 % for these rooms, said in one sentence).

- [ ] **Step 9: Commit**

```bash
git add tools/art/grid.py tools/art/treasure_preview.py web/src/lib/world/scenes/treasure-places.json docs/art/scenes.md
git commit -F - <<'EOF'
House treasures: places measured on the three rooms (treasure-places.json, x centre, y bottom edge, w width in art %, one scale from the desk), the hotspot polygons and every fixture in docs/art/scenes.md; tools/art/grid.py draws the art-% grid, tools/art/treasure_preview.py pastes the pieces with the game's maths and checks every overlap

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

Report to the controller the paths of the nine `full` previews (they can be shown to the user before the code).

---

### Task 6: The room draws its treasures

**Files:**
- Create: `web/src/lib/world/scenes/treasures.ts`, `web/src/lib/world/scenes/treasures.test.ts`, `web/src/testing/webp.ts`
- Modify: `web/src/lib/world/art.ts`, `web/src/lib/world/art.test.ts`
- Modify: `web/src/lib/world/scenes/cabin.ts:1-3,55-125`, `cabin.shapes.ts`, `cabin.test.ts`
- Modify: `web/src/screens/CabinRoom.svelte`
- Modify: `web/e2e/scenes-cabin.spec.ts:356-386`, `web/e2e/scenes-house.spec.ts`
- Move: `assets/art/export/scenes/{cabin,villa,palais}.webp` -> `web/public/art/scenes/`, `assets/art/export/treasures/*.webp` -> `web/public/art/treasures/`, `assets/art/export/icons/decor-trophee.webp` -> `web/public/art/icons/decor-trophee.webp`
- Modify: `README.md:728-729` (the art folder's size), `docs/art/icons-sheet.png` (regenerated)

**Interfaces:**
- Consumes: `treasure-places.json` and the polygons of `docs/art/scenes.md` (Task 5); the staged WebPs (Tasks 2, 3); `highestTrophies(owned: { id: string }[]): Partial<Record<LieutenantKey, number>>` (seals.ts); `trophyIcon(key: string, level: number, large = false): string | null` (art.ts); `ART_ASPECT` (scene/geometry.ts).
- Produces (treasures.ts):
  - `GEAR_PIECES`, `DECOR_PIECES` (readonly tuples), `type GearPiece`, `type DecorPiece`, `type RoomPiece = GearPiece | DecorPiece`, `type PieceId = LieutenantKey | RoomPiece`, `PIECE_IDS: readonly PieceId[]`
  - `interface Place { x: number; y: number; w: number }`, `TREASURE_PLACES: Record<House, Record<PieceId, Place>>`
  - `type Pose = 'trophy' | 'stands' | 'hangs' | 'lies'`, `POSES: Record<PieceId, Pose>`, `TROPHY_FOOT = 0.065`
  - `placeBox(p: Place, aspect: number, foot = 0): Box`
  - `interface ShownPiece { id: PieceId; src: string; place: Place; pose: Pose; foot: number; level: number | null }`, `shownPieces(house: House, owned: readonly Pick<RewardOut, 'id' | 'equipped'>[]): ShownPiece[]`
  - art.ts: `TREASURE_ART: Record<RoomPiece, string>` as `ART.treasures`
  - testing/webp.ts: `webpSize(file: string): { w: number; h: number }`
  - DOM: `[data-testid="cabin-piece-<PieceId>"]` (with `data-level` on trophies) containing one `img`; in `?debug`, `[data-testid="cabin-place-<PieceId>"]`.

- [ ] **Step 1: Move the art into the web app**

```bash
git mv -f assets/art/export/scenes/cabin.webp web/public/art/scenes/cabin.webp
git mv -f assets/art/export/scenes/villa.webp web/public/art/scenes/villa.webp
git mv -f assets/art/export/scenes/palais.webp web/public/art/scenes/palais.webp
mkdir -p web/public/art/treasures && git mv assets/art/export/treasures/*.webp web/public/art/treasures/
git mv -f assets/art/export/icons/decor-trophee.webp web/public/art/icons/decor-trophee.webp
tools/art/run_docker.sh icons sheet
```

(`git mv -f` replaces the tracked old file.) Expected: `docs/art/icons-sheet.png` rewritten with the wreath.

- [ ] **Step 2: Share the WebP size reader**

Create `web/src/testing/webp.ts`:

```ts
// A WebP's pixel size from its header (VP8X, VP8L or VP8), without a dependency (moved out of
// art.test.ts: the room's places test reads the treasures' aspect from their files too).
import { readFileSync } from 'node:fs';

export function webpSize(file: string): { w: number; h: number } {
  const b = readFileSync(file);
  const chunk = b.toString('ascii', 12, 16);
  if (chunk === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
  if (chunk === 'VP8L') {
    const bits = b.readUInt32LE(21);
    return { w: (bits & 0x3fff) + 1, h: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  throw new Error(`${file}: not a WebP`);
}
```

In `web/src/lib/world/art.test.ts` delete the local `webpSize` function and add `import { webpSize } from '../../testing/webp';`.

- [ ] **Step 3: Write the failing art test**

Append to `describe('art map', ...)` in `art.test.ts` (and import `DECOR_PIECES, GEAR_PIECES` from `./scenes/treasures`):

```ts
  it('ships the twelve treasures of the rooms, each within its budget (spec 2026-10-02 house treasures)', () => {
    expect(Object.keys(ART.treasures).sort()).toEqual([...GEAR_PIECES, ...DECOR_PIECES].sort());
    const files = Object.values(ART.treasures);
    const onDisk = readdirSync('public/art/treasures').filter((f) => f.endsWith('.webp')).map((f) => `/art/treasures/${f}`);
    expect([...onDisk].sort()).toEqual([...files].sort());
    for (const p of files) expect(statSync('public' + p).size, p).toBeLessThanOrEqual(90 * 1024);
    expect(files.reduce((s, p) => s + statSync('public' + p).size, 0)).toBeLessThanOrEqual(700 * 1024);
    expect(statSync('public/art/icons/decor-trophee.webp').size).toBeLessThanOrEqual(20 * 1024);
  });
```

- [ ] **Step 4: Write `treasures.ts` and the art map**

In `web/src/lib/world/art.ts`, after `REWARD_ICONS`:

```ts
const treasure = (name: string) => `/art/treasures/${name}.webp`;

/** The twelve pieces that stand in the rooms (spec 2026-10-02 house treasures), front-facing
 *  cut-outs trimmed to the object, keyed by reward id like REWARD_ICONS (the same file names). */
export const TREASURE_ART = {
  sandales_hermes: treasure('sandales_hermes'),
  egide: treasure('egide'),
  foudre_zeus: treasure('foudre_zeus'),
  'decor:lanterne': treasure('decor-lanterne'),
  'decor:tapis': treasure('decor-tapis'),
  'decor:bibliotheque': treasure('decor-bibliotheque'),
  'decor:trophee': treasure('decor-trophee'),
  'decor:fresque': treasure('decor-fresque'),
  'decor:amphore': treasure('decor-amphore'),
  'decor:chouette': treasure('decor-chouette'),
  'decor:mosaique': treasure('decor-mosaique'),
  'decor:bouclier': treasure('decor-bouclier'),
} as const;
```

and in `ART`, after `trophies: { ... },`: `treasures: TREASURE_ART,`.

Create `web/src/lib/world/scenes/treasures.ts`:

```ts
// The house shows its treasures (spec 2026-10-02 house treasures): every reward that belongs in a
// room has a fixed place in every house, painted at full size in the room's perspective. Pure: the
// places are measured on the paintings (treasure-places.json, docs/art/scenes.md); the room draws
// what `shownPieces` returns, as plain images (depth 0, no idle, no parallax, not tappable).
import { ART_ASPECT } from '../../scene/geometry';
import type { Box } from '../../scene/types';
import { TREASURE_ART, trophyIcon } from '../art';
import { highestTrophies } from '../seals';
import { LIEUTENANT_ORDER, type House, type LieutenantKey, type RewardOut } from '../types';
import PLACES from './treasure-places.json';

export const GEAR_PIECES = ['sandales_hermes', 'egide', 'foudre_zeus'] as const;
export const DECOR_PIECES = [
  'decor:lanterne',
  'decor:tapis',
  'decor:bibliotheque',
  'decor:trophee',
  'decor:fresque',
  'decor:amphore',
  'decor:chouette',
  'decor:mosaique',
  'decor:bouclier',
] as const;
export type GearPiece = (typeof GEAR_PIECES)[number];
export type DecorPiece = (typeof DECOR_PIECES)[number];
export type RoomPiece = GearPiece | DecorPiece;
/** A lieutenant's place holds its highest trophy; the others their own piece. */
export type PieceId = LieutenantKey | RoomPiece;
export const PIECE_IDS: readonly PieceId[] = [...LIEUTENANT_ORDER, ...GEAR_PIECES, ...DECOR_PIECES];

/** Where a piece goes, art %: x its centre, y its bottom edge (where it stands, or the foot of a
 *  hanging piece), w its width. Its height follows from its picture. */
export interface Place {
  x: number;
  y: number;
  w: number;
}

export const TREASURE_PLACES = PLACES as Record<House, Record<PieceId, Place>>;

/** How a piece sits: a trophy or a standing piece casts the CSS contact shadow, a hanging one a
 *  faint drop shadow on the wall, the rug lies flat. */
export type Pose = 'trophy' | 'stands' | 'hangs' | 'lies';
export const POSES: Record<PieceId, Pose> = {
  hydre: 'trophy',
  echo: 'trophy',
  chimere: 'trophy',
  protee: 'trophy',
  sirenes: 'trophy',
  lethe: 'trophy',
  sandales_hermes: 'stands',
  egide: 'hangs',
  foudre_zeus: 'stands',
  'decor:lanterne': 'hangs',
  'decor:tapis': 'lies',
  'decor:bibliotheque': 'stands',
  'decor:trophee': 'stands',
  'decor:fresque': 'hangs',
  'decor:amphore': 'stands',
  'decor:chouette': 'stands',
  'decor:mosaique': 'hangs',
  'decor:bouclier': 'hangs',
};

/** The trophies' WebPs keep a 6.5 % transparent margin under the base (measured: 0.064-0.066 on all
 *  thirty); the new cut-outs are trimmed to the object (foot 0). */
export const TROPHY_FOOT = 0.065;

/** The box a piece covers in art %, for a picture of `aspect` (height / width) whose base sits
 *  `foot` of its height above its bottom edge (the room's CSS and tools/art/treasure_preview.py). */
export function placeBox(p: Place, aspect: number, foot = 0): Box {
  const h = p.w * aspect * ART_ASPECT;
  return { x: p.x - p.w / 2, y: p.y - h * (1 - foot), w: p.w, h };
}

export interface ShownPiece {
  id: PieceId;
  src: string;
  place: Place;
  pose: Pose;
  foot: number;
  /** The seal of a trophy (1-5), null for the other pieces. */
  level: number | null;
}

const ROOM_PIECES: ReadonlySet<string> = new Set<string>([...GEAR_PIECES, ...DECOR_PIECES]);

/** What the room shows, back to front (a lower bottom edge is nearer, so drawn later): each
 *  lieutenant's highest trophy at its place, at full size, and the gear and decor on display. A
 *  reward with no place in a room (a tint, an accessory, a house, an id that left the catalog) shows
 *  nothing. */
export function shownPieces(house: House, owned: readonly Pick<RewardOut, 'id' | 'equipped'>[]): ShownPiece[] {
  const places = TREASURE_PLACES[house];
  const out: ShownPiece[] = [];
  const highest = highestTrophies([...owned]);
  for (const lt of LIEUTENANT_ORDER) {
    const level = highest[lt];
    const src = level ? trophyIcon(lt, level, true) : null;
    if (level && src) out.push({ id: lt, src, place: places[lt], pose: 'trophy', foot: TROPHY_FOOT, level });
  }
  for (const r of owned) {
    if (!r.equipped || !ROOM_PIECES.has(r.id)) continue;
    const id = r.id as RoomPiece;
    out.push({ id, src: TREASURE_ART[id], place: places[id], pose: POSES[id], foot: 0, level: null });
  }
  return out.sort((a, b) => a.place.y - b.place.y);
}
```

- [ ] **Step 5: Write `treasures.test.ts` (fails until the shapes are redrawn)**

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { boxesOverlap } from '../../scene/geometry';
import { webpSize } from '../../../testing/webp';
import { ART } from '../art';
import { LIEUTENANT_ORDER, type House, type LieutenantKey } from '../types';
import { houseScene } from './cabin';
import {
  DECOR_PIECES,
  GEAR_PIECES,
  PIECE_IDS,
  POSES,
  TREASURE_PLACES,
  TROPHY_FOOT,
  placeBox,
  shownPieces,
  type PieceId,
  type RoomPiece,
} from './treasures';

const HOUSES: House[] = ['cabin', 'villa', 'palais'];
const isTrophy = (id: PieceId): id is LieutenantKey => (LIEUTENANT_ORDER as readonly string[]).includes(id);
/** A piece's picture, read from its file (all thirty trophies are 512 px squares: the orichalque one stands for them). */
const aspectOf = (id: PieceId) => {
  const s = webpSize('public' + (isTrophy(id) ? ART.trophies.large[id][4] : ART.treasures[id as RoomPiece]));
  return s.h / s.w;
};
const boxOf = (house: House, id: PieceId) => placeBox(TREASURE_PLACES[house][id], aspectOf(id), isTrophy(id) ? TROPHY_FOOT : 0);

/** Whether a point lies inside a polygon (even-odd rule; art %). */
function inPolygon(x: number, y: number, pts: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Spec 2026-10-02 house treasures, "Tests: unit".
describe('the places of the treasures', () => {
  it('has a place for every piece in every house, and for nothing else', () => {
    expect(Object.keys(TREASURE_PLACES).sort()).toEqual([...HOUSES].sort());
    for (const h of HOUSES) {
      expect(Object.keys(TREASURE_PLACES[h]).sort(), h).toEqual([...PIECE_IDS].sort());
      for (const id of PIECE_IDS) {
        const p = TREASURE_PLACES[h][id];
        expect([p.x, p.y, p.w].every(Number.isFinite) && p.w > 0, `${h} ${id}`).toBe(true);
      }
    }
  });

  it('names the gear and decor of the server catalog, one pose each', () => {
    const py = readFileSync('../server/app/world/catalog.py', 'utf-8');
    const ids = [...py.matchAll(/_r\("([^"]+)", "(gear|decor)"/g)].map((m) => m[1]);
    expect([...GEAR_PIECES, ...DECOR_PIECES].sort()).toEqual(ids.sort());
    expect(Object.keys(POSES).sort()).toEqual([...PIECE_IDS].sort());
  });

  it('keeps every piece inside the frame and the safe zone, below the HUD, off the room name', () => {
    for (const h of HOUSES)
      for (const id of PIECE_IDS) {
        const b = boxOf(h, id);
        const where = `${h} ${id} ${JSON.stringify(b)}`;
        expect(b.x, where).toBeGreaterThanOrEqual(12.5);
        expect(b.x + b.w, where).toBeLessThanOrEqual(87.5);
        expect(b.y, where).toBeGreaterThanOrEqual(8);
        expect(b.y + b.h, where).toBeLessThanOrEqual(100);
        // SceneStage's name plaque: « Ton palais », the widest, x 43-57, y 9.5-15.6 at 1280x720.
        expect(boxesOverlap(b, { x: 43, y: 9.5, w: 14, h: 6.1 }), where).toBe(false);
      }
  });

  it('stands the six trophies on one line at one size in each house', () => {
    for (const h of HOUSES) {
      const places = LIEUTENANT_ORDER.map((k) => TREASURE_PLACES[h][k]);
      expect(new Set(places.map((p) => p.y)).size, h).toBe(1);
      expect(new Set(places.map((p) => p.w)).size, h).toBe(1);
    }
  });

  it('keeps every piece clear of the three places and their plaques', () => {
    for (const h of HOUSES) {
      for (const def of houseScene(h).hotspots) {
        const points = (def.shape as { points: [number, number][] }).points;
        const xs = points.map((p) => p[0]);
        const ys = points.map((p) => p[1]);
        const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
        // The plaque's band (cabin.test.ts's old model): 12 % wide; 7 % above the box, or 9.5 % below
        // it for the shelf, whose plaque carries its caption « 12 trésors ».
        const plaque =
          def.labelPos === 'above'
            ? { x: mid - 6, y: Math.min(...ys) - 7, w: 12, h: 7 }
            : { x: mid - 6, y: Math.max(...ys), w: 12, h: 9.5 };
        for (const id of PIECE_IDS) {
          const b = boxOf(h, id);
          expect(boxesOverlap(b, plaque), `${h} ${id} on ${def.id}'s plaque`).toBe(false);
          let off = true;
          for (let x = b.x; x <= b.x + b.w && off; x += 0.1)
            for (let y = b.y; y <= b.y + b.h && off; y += 0.1) if (inPolygon(x, y, points)) off = false;
          expect(off, `${h} ${id} in ${def.id}`).toBe(true);
        }
      }
    }
  });

  it('keeps every piece clear of every other piece', () => {
    for (const h of HOUSES)
      for (let i = 0; i < PIECE_IDS.length; i++)
        for (let j = i + 1; j < PIECE_IDS.length; j++)
          expect(boxesOverlap(boxOf(h, PIECE_IDS[i]), boxOf(h, PIECE_IDS[j])), `${h} ${PIECE_IDS[i]} vs ${PIECE_IDS[j]}`).toBe(false);
  });

  it('places a picture by its bottom edge: a trophy by its base, above its transparent foot', () => {
    expect(placeBox({ x: 50, y: 40, w: 9 }, 1)).toEqual({ x: 45.5, y: 40 - 16, w: 9, h: 16 });
    const t = placeBox({ x: 50, y: 40, w: 9 }, 1, TROPHY_FOOT);
    expect(t.y + t.h * (1 - TROPHY_FOOT)).toBeCloseTo(40, 9);
  });
});

describe('what the room shows', () => {
  const row = (id: string, equipped = false) => ({ id, equipped });

  it('shows nothing in a house with nothing won: only the painted fixtures', () => {
    for (const h of HOUSES) expect(shownPieces(h, [])).toEqual([]);
  });

  it("shows each lieutenant's highest trophy at its place, from the large file", () => {
    const p = shownPieces('villa', [row('trophy:hydre:1'), row('trophy:hydre:3'), row('trophy:echo:2')]);
    expect(p.map((x) => [x.id, x.level, x.src]).sort()).toEqual([
      ['echo', 2, '/art/trophies/large/trophy-echo-2.webp'],
      ['hydre', 3, '/art/trophies/large/trophy-hydre-3.webp'],
    ]);
    expect(p.find((x) => x.id === 'hydre')).toMatchObject({ place: TREASURE_PLACES.villa.hydre, pose: 'trophy', foot: TROPHY_FOOT });
  });

  it('shows gear and decor only while on display, each at its own place', () => {
    const p = shownPieces('cabin', [row('egide', true), row('foudre_zeus'), row('decor:tapis', true), row('decor:amphore')]);
    expect(p.map((x) => x.id).sort()).toEqual(['decor:tapis', 'egide']);
    expect(p.find((x) => x.id === 'egide')).toMatchObject({ src: '/art/treasures/egide.webp', place: TREASURE_PLACES.cabin.egide, pose: 'hangs', level: null });
  });

  it('shows all eighteen at once: no display limit', () => {
    const all = [
      ...LIEUTENANT_ORDER.map((k) => row(`trophy:${k}:5`)),
      ...[...GEAR_PIECES, ...DECOR_PIECES].map((id) => row(id, true)),
    ];
    for (const h of HOUSES) expect(shownPieces(h, all), h).toHaveLength(18);
  });

  // Review Focus 1.
  it('ignores what has no place in a room: tints, accessories, houses, unknown ids, seals past the fifth', () => {
    expect(
      shownPieces('cabin', [
        row('tint:jade', true),
        row('accessory:hydre-cou', true),
        row('house:villa', true),
        row('decor:retired', true),
        row('trophy:hydre:9'),
        row('trophy:medusa:1'),
      ]),
    ).toEqual([]);
  });

  // Review Focus 2.
  it('follows the house: the same rewards at the palais\'s places', () => {
    const rows = [row('trophy:lethe:4'), row('decor:chouette', true)];
    for (const p of shownPieces('palais', rows)) expect(p.place).toEqual(TREASURE_PLACES.palais[p.id]);
  });

  it('draws the nearer pieces last (a lower bottom edge)', () => {
    const all = [...LIEUTENANT_ORDER.map((k) => row(`trophy:${k}:1`)), ...[...GEAR_PIECES, ...DECOR_PIECES].map((id) => row(id, true))];
    const ys = shownPieces('cabin', all).map((p) => p.place.y);
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
  });
});
```

- [ ] **Step 6: Run to see it fail**

Run: `STACK=house scripts/npm.sh run test -- src/lib/world/scenes/treasures.test.ts src/lib/world/art.test.ts 2>&1 | tail -30`
Expected: FAIL in `keeps every piece clear of the three places` (the old hotspot shapes) and possibly in the payload test of `art.test.ts` (see Step 9); the logic tests pass.

- [ ] **Step 7: Redraw the hotspots and drop the medallion slots**

`web/src/lib/world/scenes/cabin.shapes.ts`: replace the file's header comment (lines 1-3) and the two comment blocks above `VILLA_SHAPES` and `PALAIS_SHAPES` with this one header:

```ts
// Hotspot geometry of the three rooms (spec 2026-10-02 house treasures: repainted straight-on),
// art % of the 16:9 frame, measured on a 1 % grid (docs/art/scenes.md, tools/art/grid.py) and
// checked with `?debug`: « Tes trésors » around the low cupboard, the journal around the desk, the
// lyre around its table. The pieces' places (treasure-places.json) stay clear of them and of their
// plaques (treasures.test.ts).
```

Keep the three exports `CABIN_SHAPES`, `VILLA_SHAPES`, `PALAIS_SHAPES`, each `{ trophies, journal, lyre }` of `{ kind: 'polygon', points: [[x, y], ...] }` `satisfies ShapeMap`, and replace every `points` list with the one measured for that house and place in Task 5 (copied verbatim from `docs/art/scenes.md`, which `$JOB/measure/house-shapes.json` matches).

`web/src/lib/world/scenes/cabin.ts`:
- header comment lines 1-3: `// The hero's house (scenes UI spec §3 "Cabin scene", UI3 Ruling B6): « Tes trésors » (rewards), the journal on the desk (stats) and the lyre (settings). Every trophy, piece of gear and decor on display stands at its own place in the room (spec 2026-10-02 house treasures, treasures.ts). The hero panel is an overlay here too (Ruling B2, Task 6).`
- delete `BARE_WALLS` and `DECOR_SLOTS` with their comments (lines 55-125) and the now unused `Box` from the `../../scene/types` import.

`web/src/lib/world/scenes/cabin.test.ts`: remove `BARE_WALLS`, `DECOR_SLOTS` from the import, `boxInside, boxesOverlap, shapeBox` and `inPolygon` if no longer used; delete the tests `"each interior's slots sit on its bare wall, apart, off the places and their plaques"`, `'hangs the displayed decor on free wall spots inside the safe zone'` and `'hangs every piece on measured bare wall, never on a beam, a lintel or a window (fix round 1)'` (treasures.test.ts replaces them).

- [ ] **Step 8: Draw the pieces in `CabinRoom.svelte`**

- header comment lines 4-7: replace `Displayed decor hangs on the walls; it reloads when the cabin opens and whenever the shelf puts something on display or away.` with `Each lieutenant's highest trophy, and the gear and decor on display, stand at their own place in the room (spec 2026-10-02 house treasures); the rewards load when the room opens and follow the shelf's « Exposer » / « Ranger ».`
- imports: delete `import Medallion from '../components/juice/Medallion.svelte';`; `import { cabinGreeting, guideLine, houseScene, journalLine, lyreLine, trophiesLine } from '../lib/world/scenes/cabin';`; add `import { PIECE_IDS, TREASURE_PLACES, shownPieces } from '../lib/world/scenes/treasures';`
- replace `const slots = ...` and `const displayed = ...` (and their comment) with:

```ts
  // What stands in the room: nothing while /rewards loads or after it failed (the fixtures only),
  // then each piece at the places of the house the camp names.
  const pieces = $derived(owned === null ? [] : shownPieces(house, owned));
```

- replace the `{#each displayed ...}...{/each}` block with:

```svelte
    {#each pieces as p (p.id)}
      <div
        class="piece {p.pose}"
        data-testid="cabin-piece-{p.id}"
        data-level={p.level ?? undefined}
        style="left:{p.place.x - p.place.w / 2}%;top:{p.place.y}%;width:{p.place.w}%;--foot:{p.foot}"
      >
        <img src={p.src} alt="" draggable="false" />
      </div>
    {/each}
    {#if debug}
      <!-- ?debug: every place's bottom edge and width, owned or not, to check them on the painting. -->
      {#each PIECE_IDS as id (id)}
        {@const pl = TREASURE_PLACES[house][id]}
        <div class="place-debug" data-testid="cabin-place-{id}" style="left:{pl.x - pl.w / 2}%;top:{pl.y}%;width:{pl.w}%">
          <span>{id}</span>
        </div>
      {/each}
    {/if}
```

- replace the `.cabin-decor` style with:

```css
  /* A piece at its place (spec 2026-10-02 house treasures): its box's bottom edge on the place's
     line (a trophy sits its transparent foot lower), its width the place's, its height its picture's;
     under the hotspots (z 3) and their plaques, not tappable, still (no depth, idle or parallax). */
  .piece {
    position: absolute;
    z-index: 2;
    transform: translateY(calc(-100% + var(--foot) * 100%));
    pointer-events: none;
  }
  .piece img {
    display: block;
    width: 100%;
    height: auto;
  }
  /* The contact shadow under a standing piece (CSS, not painted): a soft ellipse on its base line. */
  .piece:is(.trophy, .stands)::after {
    content: '';
    position: absolute;
    left: 12%;
    right: 12%;
    bottom: calc(var(--foot) * 100%);
    aspect-ratio: 6 / 1;
    transform: translateY(50%);
    background: radial-gradient(closest-side, rgba(20, 12, 6, 0.45), rgba(20, 12, 6, 0));
    z-index: -1;
  }
  /* A trophy's picture is a square around a narrow statuette: a narrower shadow. */
  .piece.trophy::after {
    left: 28%;
    right: 28%;
  }
  .piece.hangs img {
    filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.35));
  }
  .place-debug {
    position: absolute;
    z-index: 4;
    border-top: 2px dashed #ffe14d;
    pointer-events: none;
  }
  .place-debug span {
    position: absolute;
    bottom: 2px;
    left: 0;
    font-size: 10px;
    color: #ffe14d;
    text-shadow: 0 0 2px #000;
    white-space: nowrap;
  }
```

- [ ] **Step 9: Run the unit tests and fix the payload cap if it moved**

Run: `STACK=house scripts/npm.sh run test > $JOB/vitest-task6.log 2>&1; tail -30 $JOB/vitest-task6.log`
Expected: all pass, except possibly `total non-scene art payload ... under 4.5 MiB` and `readmeSizes`. For the payload: the failing assertion prints the real total (vitest's `received`); raise the cap in that test to the next 0.25 MiB above it and replace its comment's measurement with `Measured with the twelve room treasures (spec 2026-10-02 house treasures): <received> bytes.`. For `readmeSizes`: set the README's `web/public/art` (WebP, about **N** MB) to the figure the failing assertion expects. Rerun until green.

- [ ] **Step 10: Adapt the room e2e to the pieces**

`web/e2e/scenes-cabin.spec.ts`: replace `'displayed decor hangs on bare wall, clear of every place and plaque'` with:

```ts
test('the pieces on display stand at their places, clear of every plaque and of each other, not tappable', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const decor = ['decor:lanterne', 'decor:tapis', 'decor:bibliotheque', 'decor:trophee', 'decor:fresque'];
  await page.route(`**/api/profiles/${id}/rewards`, (route) =>
    route.fulfill({
      json: decor.map((rid) => ({ id: rid, kind: 'decor', name: rid, desc: '', source: '', granted_at: '2026-09-21T12:00:00+00:00', equipped: true })),
    }),
  );
  for (const size of [{ width: 1280, height: 720 }, { width: 1180, height: 820 }, { width: 1366, height: 1024 }]) {
    await page.setViewportSize(size);
    await openCabin(page, id);
    for (const rid of decor) await expect(page.getByTestId(`cabin-piece-${rid}`)).toBeVisible();
    await expectPiecesClear(page, size);
  }
  expect(await page.getByTestId('cabin-piece-decor:tapis').evaluate((e) => getComputedStyle(e).pointerEvents)).toBe('none');
});
```

and move a shared helper into `web/e2e/helpers.ts` (exported, used by both specs):

```ts
/** The pieces in the house's room (spec 2026-10-02 house treasures): each one loaded (a missing
 *  file has no natural width), none over a place's plaque or the room's name, none over another.
 *  Read in one evaluate and polled: setViewportSize may return before WebKit has laid out the size. */
export async function expectPiecesClear(page: Page, size: { width: number; height: number }) {
  const problems = () =>
    page.evaluate(() => {
      const stage = document.querySelector('[data-testid="scene-cabin"]')!;
      const hit = (a: DOMRect, b: DOMRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      const pieces = [...stage.querySelectorAll('[data-testid^="cabin-piece-"]')];
      const plaques = [...stage.querySelectorAll('.hotspot-label, .stage-plaque')].map((e) => e.getBoundingClientRect());
      const out: string[] = [];
      pieces.forEach((p, i) => {
        const name = p.getAttribute('data-testid');
        const img = p.querySelector('img');
        if (!img || !img.complete || img.naturalWidth === 0) out.push(`${name} not loaded`);
        const r = p.getBoundingClientRect();
        for (const q of plaques) if (hit(r, q)) out.push(`${name} on a plaque`);
        for (const o of pieces.slice(i + 1)) if (hit(r, o.getBoundingClientRect())) out.push(`${name} on ${o.getAttribute('data-testid')}`);
      });
      return out;
    });
  await expect.poll(problems, { message: `${size.width}x${size.height}` }).toEqual([]);
}
```

(import `expectPiecesClear` in `scenes-cabin.spec.ts`.)

`web/e2e/scenes-house.spec.ts`: rewrite the file as below (the stall purchase stays; the medallion helper goes; the palais test becomes the three houses empty and full, with screenshots):

```ts
// Spec 2026-09-29 drachmes §3, §6 and spec 2026-10-02 house treasures: buy the villa at the stall;
// each house empty, then with every treasure at its place, photographed for review. desktop + ipad.
import { test, expect } from './crashGuard';
import type { APIRequestContext, Page } from '@playwright/test';
import { createProfileApi, createText, expectPiecesClear, expectScene, heroNamer, labelOverlaps, makeResult, postSession, redScan, swissDay, tap, uniqueName } from './helpers';

const heroName = heroNamer('Maison');
const QUEST_DECOR = ['decor:lanterne', 'decor:tapis'];
const SHOP_DECOR = ['decor:amphore', 'decor:chouette', 'decor:mosaique', 'decor:bouclier'];
const LTS = ['hydre', 'echo', 'chimere', 'protee', 'sirenes', 'lethe'];
const GEAR = ['sandales_hermes', 'egide', 'foudre_zeus'];
const NINE = ['lanterne', 'tapis', 'bibliotheque', 'trophee', 'fresque', 'amphore', 'chouette', 'mosaique', 'bouclier'].map((k) => `decor:${k}`);
const SIZES = [{ width: 1280, height: 720 }, { width: 1180, height: 820 }, { width: 1366, height: 1024 }];

/** Twelve 3 000-word sessions through four board quests against the Hydra: an adult dragon (about
 *  11 000 XP), the lantern and the carpet (two and four quests), about 1 100 drachmes. */
async function wealthyHero(request: APIRequestContext, name: string): Promise<number> {
  const id = await createProfileApi(request, name);
  const text = await createText(request, { title: uniqueName(`Maison ${name}`), body: 'Les fées dansent dans la clairière.', level: '10H' });
  for (let q = 0; q < 4; q++) {
    expect((await request.post(`/api/profiles/${id}/quests`, { data: { target: 'hydre' } })).status()).toBe(201);
    for (let s = 0; s < 3; s++) {
      await postSession(request, { profileId: id, textId: text.id, day: swissDay(0), result: makeResult({ words: 3000, draft: 4, caught: 4, category: 'agreement:verb' }) });
    }
  }
  return id;
}

/** The room at rest (no entrance or tour zoom: the art fills the 1280-wide frame), photographed. */
async function restedShot(page: Page, path: string) {
  await expect.poll(() => page.locator('[data-testid="scene-cabin"] .art-bg').evaluate((e) => Math.round(e.getBoundingClientRect().width))).toBe(1280);
  await page.screenshot({ path });
}

test('buy the villa at the stall: the room follows the house, six pieces and more on display', async ({ page, request }, testInfo) => {
  const id = await wealthyHero(request, heroName(testInfo.project.name));
  const camp = await (await request.get(`/api/profiles/${id}/camp`)).json();
  expect(camp.dragon.stage).toBe('adult');
  for (const item of SHOP_DECOR) expect((await request.post(`/api/profiles/${id}/purchases`, { data: { item } })).status()).toBe(201);
  for (const item of [...QUEST_DECOR, ...SHOP_DECOR]) {
    expect((await request.patch(`/api/profiles/${id}/rewards/${item}`, { data: { equipped: true } })).status()).toBe(200);
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`/#/p/${id}/cabane?debug`);
  await expectScene(page, 'cabin');
  await expect(page.locator('[data-testid="scene-cabin"] .art-bg')).toHaveAttribute('src', '/art/scenes/cabin.webp');
  // Six pieces of decor in the cabin, two more than its old four walls held.
  await expect(page.locator('[data-testid^="cabin-piece-decor:"]')).toHaveCount(6);
  await page.goto(`/#/p/${id}/camp?panel=etal`);
  const villa = page.getByTestId('overlay-stall').getByTestId('stall-item-house:villa');
  await tap(villa.getByTestId('stall-buy-house:villa'), testInfo);
  await expect(villa).toContainText('Acheter la villa pour 300 drachmes\u202f?');
  await tap(villa.getByTestId('stall-confirm'), testInfo);
  await expect(villa).toHaveAttribute('data-state', 'owned');
  await expect(page.getByTestId('overlay-stall').getByTestId('stall-item-house:palais')).toContainText('Quand ton dragon sera illustre.');
  await page.goto(`/#/p/${id}/camp`);
  await expect(page.getByTestId('camp-cabin')).toContainText('Ta villa');
  for (const size of SIZES.slice(0, 2)) {
    await page.setViewportSize(size);
    await expect.poll(() => labelOverlaps(page, 'camp'), { message: `camp ${size.width}x${size.height}` }).toEqual([]);
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`/#/p/${id}/cabane?debug`);
  await expectScene(page, 'cabin');
  await expect(page.locator('[data-testid="scene-cabin"] .stage-plaque')).toHaveText('Ta villa');
  await expect(page.locator('[data-testid="scene-cabin"] .art-bg')).toHaveAttribute('src', '/art/scenes/villa.webp');
  await expect(page.locator('[data-testid^="cabin-piece-decor:"]')).toHaveCount(6);
  await expectPiecesClear(page, { width: 1280, height: 720 });
});

// Spec 2026-10-02 house treasures, "e2e: screenshots of each house empty and full for review".
for (const house of ['cabin', 'villa', 'palais'] as const) {
  test(`${house}: the empty fixtures, then every treasure at its place`, async ({ page, request }, testInfo) => {
    const id = await createProfileApi(request, heroName(testInfo.project.name));
    await page.route(`**/api/profiles/${id}/camp`, async (route) => {
      const res = await route.fetch();
      await route.fulfill({ response: res, json: { ...(await res.json()), house } });
    });
    const row = (rid: string, kind: string, equipped: boolean) => ({ id: rid, kind, name: rid, desc: '', source: '', granted_at: '2026-09-30T10:00:00', equipped });
    let rows: object[] = [];
    await page.route(`**/api/profiles/${id}/rewards`, (route) => route.fulfill({ json: rows }));
    await page.setViewportSize({ width: 1280, height: 720 });
    // Empty: the painted fixtures only (the first visit's tour skipped).
    await page.goto(`/#/p/${id}/cabane`);
    await expectScene(page, 'cabin');
    await expect(page.locator('[data-testid="scene-cabin"] .art-bg')).toHaveAttribute('src', `/art/scenes/${house}.webp`);
    await tap(page.getByTestId('dialogue-skip'), testInfo);
    await expect(page.getByTestId('dialogue-box')).toHaveCount(0);
    await expect(page.locator('[data-testid^="cabin-piece-"]')).toHaveCount(0);
    await restedShot(page, testInfo.outputPath(`${house}-empty.png`));
    // Full: every lieutenant's trophy (seals 1 to 5 and 1 again), the three gear, the nine decor.
    rows = [
      ...LTS.map((k, i) => row(`trophy:${k}:${(i % 5) + 1}`, 'trophy', false)),
      ...GEAR.map((g) => row(g, 'gear', true)),
      ...NINE.map((d) => row(d, 'decor', true)),
    ];
    await page.reload();
    await expectScene(page, 'cabin');
    await expect(page.getByTestId('dialogue-box')).toBeVisible();
    await tap(page.getByTestId('dialogue-skip'), testInfo);
    await expect(page.getByTestId('dialogue-box')).toHaveCount(0);
    await expect(page.locator('[data-testid^="cabin-piece-"]')).toHaveCount(18);
    for (const k of LTS) await expect(page.getByTestId(`cabin-piece-${k}`).locator('img')).toHaveAttribute('src', new RegExp(`/art/trophies/large/trophy-${k}-\\d\\.webp$`));
    for (const size of SIZES) {
      await page.setViewportSize(size);
      await expect.poll(() => labelOverlaps(page, 'cabin'), { message: `${size.width}x${size.height}` }).toEqual([]);
      await expectPiecesClear(page, size);
    }
    expect(await redScan(page)).toEqual([]);
    await page.setViewportSize({ width: 1280, height: 720 });
    await restedShot(page, testInfo.outputPath(`${house}-full.png`));
    await page.goto(`/#/p/${id}/cabane?debug`);
    await expect(page.getByTestId('hotspot-debug').locator('svg.outline')).toHaveCount(3);
    await expect(page.locator('[data-testid^="cabin-place-"]')).toHaveCount(18);
    await restedShot(page, testInfo.outputPath(`${house}-debug.png`));
  });
}
```

- [ ] **Step 11: Type check, unit tests, e2e**

Run (background, logs in `$JOB`): `STACK=house scripts/npm.sh run check > $JOB/check-task6.log 2>&1; STACK=house scripts/npm.sh run test > $JOB/vitest-task6.log 2>&1; tail -5 $JOB/check-task6.log $JOB/vitest-task6.log`
Expected: `0 errors and 0 warnings`; all vitest pass.

Then `PW_WORKERS=1 STACK=house scripts/playwright.sh scenes-cabin scenes-house > $JOB/e2e-task6.log 2>&1; tail -20 $JOB/e2e-task6.log`
Expected: all pass. Copy the nine screenshots out (`find web/test-results -name '*-empty.png' -o -name '*-full.png' -o -name '*-debug.png' | xargs -I{} cp {} $JOB/shots/`, `mkdir -p $JOB/shots` first) and Read them: every piece on its fixture, nothing floating, sunk or cut; fix `treasure-places.json` (and rerun Task 5's `--check`) if one is off by more than 0.5 %.

- [ ] **Step 12: Commit**

```bash
git add web/public/art/scenes/cabin.webp web/public/art/scenes/villa.webp web/public/art/scenes/palais.webp web/public/art/treasures/ web/public/art/icons/decor-trophee.webp docs/art/icons-sheet.png web/src/testing/webp.ts web/src/lib/world/art.ts web/src/lib/world/art.test.ts web/src/lib/world/scenes/treasures.ts web/src/lib/world/scenes/treasures.test.ts web/src/lib/world/scenes/cabin.ts web/src/lib/world/scenes/cabin.shapes.ts web/src/lib/world/scenes/cabin.test.ts web/src/screens/CabinRoom.svelte web/e2e/helpers.ts web/e2e/scenes-cabin.spec.ts web/e2e/scenes-house.spec.ts README.md
git status --short
git commit -F - <<'EOF'
The house shows its treasures (spec 2026-10-02): the three new rooms, each lieutenant's highest trophy (the large file) and every piece of gear and decor on display at its own place, a plain image under the hotspots with a CSS contact shadow, no slot, no limit; TREASURE_PLACES from treasure-places.json, shownPieces and placeBox in treasures.ts, proven inside the safe zone, off the places, their plaques and each other; hotspots redrawn on the new rooms; ?debug draws every place; the medallion slots, BARE_WALLS and DECOR_SLOTS go; e2e photographs each house empty and full

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 7: Wording: the Couronne de laurier, the houses, the manual

**Files:**
- Modify: `server/app/world/catalog.py:35,42-43`, `server/tests/test_shop.py`
- Modify: `web/src/lib/world/rewards.ts:68`, `web/src/lib/world/rewards.test.ts`
- Modify: `content/dialogue/cabin.json:15`
- Modify: `MANUEL.md:271,374,446-453`, `README.md:576-577`

**Interfaces:**
- Consumes: nothing new.
- Produces: `REWARDS["decor:trophee"]` = name « Couronne de laurier », desc « Une couronne de laurier en or, celle des vainqueurs. »; the houses' new descriptions.

- [ ] **Step 1: Write the failing tests**

`server/tests/test_shop.py`:

```python
def test_the_laurel_crown_and_the_houses_say_what_they_are():
    """Spec 2026-10-02 house treasures: decor:trophee keeps its id and becomes the Couronne de laurier;
    the houses say what the room is like, never how many pieces it holds."""
    assert (REWARDS["decor:trophee"]["name"], REWARDS["decor:trophee"]["desc"]) == (
        "Couronne de laurier", "Une couronne de laurier en or, celle des vainqueurs.")
    assert REWARDS["house:villa"]["desc"] == "Des murs blanchis de frais, une frise peinte et des colonnes\u202f: une maison toute neuve."
    assert REWARDS["house:palais"]["desc"] == "Des murs de marbre, des chapiteaux dorés et un sol de mosaïque\u202f: tout y brille."
    assert [r["id"] for r in REWARDS.values() if "pomme" in (r["name"] + r["desc"]).lower() or "place pour" in r["desc"]] == []
```

`web/src/lib/world/rewards.test.ts`, in the test that already checks `sentence('sandales_hermes', '')`:

```ts
    // Spec 2026-10-02 house treasures: la couronne de laurier.
    expect(sentence('decor:trophee', '')).toBe('Termine huit quêtes du mur pour la gagner.');
```

- [ ] **Step 2: Run to see them fail**

Run: `STACK=house scripts/pytest.sh -q tests/test_shop.py 2>&1 | tail -5; STACK=house scripts/npm.sh run test -- src/lib/world/rewards.test.ts 2>&1 | tail -8`
Expected: FAIL on the name/descriptions and on « pour le gagner ».

- [ ] **Step 3: Change the words**

`server/app/world/catalog.py`:

```python
    _r("decor:trophee", "decor", "Couronne de laurier", "Une couronne de laurier en or, celle des vainqueurs.", "Huit quêtes du mur"),
```

```python
    _r("house:villa", "house", "La villa", "Des murs blanchis de frais, une frise peinte et des colonnes\u202f: une maison toute neuve.", "L'étal d'Hermès"),
    _r("house:palais", "house", "Le palais", "Des murs de marbre, des chapiteaux dorés et un sol de mosaïque\u202f: tout y brille.", "L'étal d'Hermès"),
```

`web/src/lib/world/rewards.ts:68`: `'decor:trophee': 'Termine huit quêtes du mur pour la gagner.',`

`content/dialogue/cabin.json` line 15 text: `"Et ta maison peut changer : quand je grandis, Hermès vend une villa, puis un palais, chacun plus beau que le précédent !"` (the file's own spacing convention, plain spaces, as its other lines).

`MANUEL.md`:
- line 271: `- Un **trophée** du lieutenant dans la matière du sceau, posé à sa place dans ta maison :`
- line 374: `Pénélope, l'Étagère d'Alexandrie, puis la Couronne de laurier.`
- §14 (lines 448-453) becomes:

```markdown
Ta maison commence en cabane. La villa puis le palais sont plus grands et plus beaux, et chaque
maison a une place pour chacun de tes trésors : le plus beau trophée de chaque lieutenant, les
armes des dieux et les objets de décor. Une place encore vide attend son trésor.

- **Tes trésors** : l'étagère de tout ce que tu as gagné (trophées, armes des dieux, décor et
  teintes). Rien n'y est caché : chaque trésor pas encore gagné dit comment l'obtenir. Touche
  « Exposer » pour montrer une arme des dieux ou un objet de décor à sa place dans ta maison,
  « Ranger » pour l'enlever. Un trophée se montre tout seul, et un sceau plus haut le remplace.
```

`README.md` lines 576-577: `on sale from seals 2 to 5 by slot, the villa from the adult dragon, the palais from the illustre one after the villa).` (the « 4 / 6 / 9 wall slots » clause goes).

Check: `grep -rn "Trophée de la Pomme\|pomme d'or… en bois\|place pour six\|place pour neuf\|wall slots\|davantage de murs" --include=*.py --include=*.ts --include=*.svelte --include=*.json --include=*.md . | grep -v node_modules | grep -v "docs/superpowers\|\.superpowers\|docs/reviews"` prints nothing.

- [ ] **Step 4: Run the tests**

Run: `STACK=house scripts/pytest.sh -q > $JOB/pytest-task7.log 2>&1; STACK=house scripts/npm.sh run test > $JOB/vitest-task7.log 2>&1; tail -5 $JOB/pytest-task7.log $JOB/vitest-task7.log`
Expected: all pass (the dialogue content tests check every line's length and spacing).

- [ ] **Step 5: Commit**

```bash
git add server/app/world/catalog.py server/tests/test_shop.py web/src/lib/world/rewards.ts web/src/lib/world/rewards.test.ts content/dialogue/cabin.json MANUEL.md README.md
git commit -F - <<'EOF'
Wording (spec 2026-10-02 house treasures): decor:trophee becomes the Couronne de laurier (« pour la gagner »), the villa and the palais say what the room is like instead of how many pieces it holds, the cabin tour's last line and MANUEL §11 and §14 follow, the README loses the wall slots

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 8: e2e: a seal's trophy at its place, « Exposer » and « Ranger » in the room

**Files:**
- Modify: `web/e2e/scenes-cabin.spec.ts`

**Interfaces:**
- Consumes: the DOM of Task 6 (`cabin-piece-<id>`, `data-level`), `TrophiesPanel`'s `cabin-equip-<id>`.
- Produces: tests only.

- [ ] **Step 1: Write the tests**

Append to `web/e2e/scenes-cabin.spec.ts`:

```ts
// Spec 2026-10-02 house treasures: real seals from posted sessions (the test clock): three days win
// the Hydra's wooden seal, four more days after it the bronze one.
test("a seal won puts its trophy at the lieutenant's place, full size; the next seal replaces it there", async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const text = await createText(request, { title: uniqueName(`Trophée ${testInfo.project.name}`), body: 'Les fées dansent dans la clairière.', level: '10H' });
  const days = ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07', '2026-08-08', '2026-08-09'];
  const play = async (list: string[]) => {
    for (const day of list) await postSession(request, { profileId: id, textId: text.id, day, result: makeResult({ draft: 4, caught: 4, category: 'agreement:verb' }) });
  };
  await play(days.slice(0, 3));
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`/#/p/${id}/cabane?debug`);
  await expectScene(page, 'cabin');
  const hydre = page.getByTestId('cabin-piece-hydre');
  await expect(hydre).toHaveAttribute('data-level', '1');
  await expect(hydre.locator('img')).toHaveAttribute('src', '/art/trophies/large/trophy-hydre-1.webp');
  await expect.poll(() => hydre.locator('img').evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(512);
  await expect(page.locator('[data-testid^="cabin-piece-"]')).toHaveCount(1);
  expect(await hydre.evaluate((e) => getComputedStyle(e).pointerEvents)).toBe('none');
  const before = await hydre.boundingBox();
  await play(days.slice(3));
  await page.reload();
  await expectScene(page, 'cabin');
  await expect(hydre).toHaveAttribute('data-level', '2');
  await expect(hydre.locator('img')).toHaveAttribute('src', '/art/trophies/large/trophy-hydre-2.webp');
  await expect(page.locator('[data-testid^="cabin-piece-"]')).toHaveCount(1);
  await expect.poll(() => hydre.boundingBox().then((b) => b && [Math.round(b.x), Math.round(b.y + b.height), Math.round(b.width)])).toEqual(
    before && [Math.round(before.x), Math.round(before.y + before.height), Math.round(before.width)],
  );
});

test('« Exposer » puts a piece at its place in the room, « Ranger » takes it away', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const kinds: Record<string, string> = { egide: 'gear', 'decor:tapis': 'decor', 'decor:chouette': 'decor' };
  const state = new Map<string, boolean>([['egide', false], ['decor:tapis', true], ['decor:chouette', true]]);
  const row = (rid: string) => ({ id: rid, kind: kinds[rid], name: rid, desc: '', source: '', granted_at: '2026-09-21T12:00:00+00:00', equipped: state.get(rid) });
  await page.route(`**/api/profiles/${id}/rewards**`, (route) => {
    const req = route.request();
    if (req.method() === 'PATCH') {
      const rid = decodeURIComponent(req.url().split('/rewards/')[1]);
      state.set(rid, (req.postDataJSON() as { equipped: boolean }).equipped);
      return route.fulfill({ json: row(rid) });
    }
    return route.fulfill({ json: [...state.keys()].map(row) });
  });
  await openCabin(page, id);
  await tap(page.getByTestId('dialogue-skip'), testInfo);
  await expect(page.getByTestId('dialogue-box')).toHaveCount(0);
  await expect(page.getByTestId('cabin-piece-decor:tapis')).toBeVisible();
  await expect(page.getByTestId('cabin-piece-egide')).toHaveCount(0);
  await tap(page.getByTestId('cabin-trophies'), testInfo);
  const shelf = page.getByTestId('overlay-trophies');
  await tap(shelf.getByTestId('cabin-equip-egide'), testInfo);
  await expect(shelf.getByTestId('cabin-equip-egide')).toHaveText('Ranger');
  await tap(shelf.getByTestId('cabin-equip-decor:tapis'), testInfo);
  await expect(shelf.getByTestId('cabin-equip-decor:tapis')).toHaveText('Exposer');
  await closeOverlay(page);
  await expect(page.getByTestId('cabin-piece-egide')).toBeVisible();
  await expect(page.getByTestId('cabin-piece-egide').locator('img')).toHaveAttribute('src', '/art/treasures/egide.webp');
  await expect(page.getByTestId('cabin-piece-decor:tapis')).toHaveCount(0);
  await expect(page.getByTestId('cabin-piece-decor:chouette')).toBeVisible();
});

// Review Focus 2: the rewards out of reach leave the fixtures empty and the shelf says why.
test('the rewards failing leave the room empty, the shelf says why', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.route(`**/api/profiles/${id}/rewards`, (route) => route.fulfill({ status: 500, json: { detail: 'Les trésors sont introuvables.' } }));
  await page.goto(`/#/p/${id}/cabane?debug`);
  await expectScene(page, 'cabin');
  await expect(page.locator('[data-testid^="cabin-piece-"]')).toHaveCount(0);
  await page.goto(`/#/p/${id}/cabane?panel=tresors`);
  await expect(page.getByTestId('overlay-trophies')).toContainText('Les trésors sont introuvables.');
});
```

(`closeOverlay`, `createText`, `makeResult`, `postSession`, `uniqueName` are already imported in this spec.) If `ApiError.detail` for a 500 is not the body's `detail`, read `web/src/lib/api.ts` and assert what the shelf really shows (the `loadError` line), then keep the test.

- [ ] **Step 2: Run them**

Run: `PW_WORKERS=1 STACK=house scripts/playwright.sh scenes-cabin > $JOB/e2e-task8.log 2>&1; tail -20 $JOB/e2e-task8.log`
Expected: all pass. A failure is a bug in Task 6's code or a wrong assumption above: fix the cause (systematic-debugging), never loosen the assertion.

- [ ] **Step 3: Commit**

```bash
git add web/e2e/scenes-cabin.spec.ts
git commit -F - <<'EOF'
e2e (spec 2026-10-02 house treasures): a seal won stands its large trophy at the Hydra's place and the next seal replaces it there; « Exposer » and « Ranger » put a piece in the room and take it away; rewards out of reach leave the fixtures empty

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 9: Docs, the full gate, and the final screenshots

**Files:**
- Modify: `docs/art/scenes.md` (the cut-outs table), `docs/art/style-guide.md` (new section), `.claude/skills/krea2/SKILL.md` (a recipe), `web/src/lib/world/art.ts` (comments only, if stale)

**Interfaces:**
- Consumes: everything above.
- Produces: the docs; nine screenshots in `$JOB/shots/` shown to the user.

- [ ] **Step 1: Docs**

`docs/art/scenes.md`, table "Cut-outs and textures": add one row per treasure, `| <name> (house treasure) | assets/art/treasures/<id>.png | web/public/art/treasures/<id>.webp (<n> KB) | <w>x<h> |`, sizes from Task 3 Step 6's output.

`docs/art/style-guide.md`: a section `### House treasures (2026-10-02)` after "Progression redesign, phase 3": the three rooms (prompt structure: the shared fixture paragraph, per-house materials, seeds picked, rejected seeds and why, any inpainted fixture), the twelve pieces (the treasure composition sentence, one line per id: seed, size, weak spot), the export (`tools/art/treasures.py`, budgets 90/50 KB, trimmed, the sheet `docs/art/treasures-sheet.png`), the measuring (`tools/art/grid.py`, `tools/art/treasure_preview.py --check`, the desk as the 120 cm scale) and a line that the phase-3 villa and palais (seeds 4401, 4501) and the 2026-09-24 cabin (507) are replaced.

`.claude/skills/krea2/SKILL.md`: a short recipe `### A straight-on room with empty fixtures (the houses, 2026-10-02)`: what held (one-point perspective phrasing, named positions, "empty and ready" wording, the negatives that kept ruins out) and what failed in Task 1 (from the rejected variants), in the skill's own style.

`web/src/lib/world/art.ts`: the comment `// Spec 2026-09-29 drachmes §3: the houses bought from Hermès, the cabin's room plan.` becomes `// The houses (spec 2026-10-02 house treasures): three rooms painted straight-on with one place per treasure.`

- [ ] **Step 2: The full gate**

Run in the background (timeout 7200000): `STACK=house scripts/check.sh > $JOB/check-final.log 2>&1; tail -30 $JOB/check-final.log`
Expected: `== ALL GREEN`. Any failure, warning or flaky test is fixed here (CLAUDE.md), then the gate runs again.

- [ ] **Step 3: The final screenshots**

```bash
mkdir -p $JOB/shots && rm -f $JOB/shots/*.png
find web/test-results -name '*-empty.png' -o -name '*-full.png' -o -name '*-debug.png' | while read f; do cp "$f" "$JOB/shots/$(basename "$(dirname "$f")")-$(basename "$f")"; done
ls $JOB/shots
```

Expected: cabin, villa and palais, each `-empty`, `-full` and `-debug`, for the desktop and ipad projects. If the gate's run left none (passing runs may clean `test-results`), rerun `PW_WORKERS=1 STACK=house scripts/playwright.sh scenes-house` and copy again.

- [ ] **Step 4: Commit and hand back**

```bash
git add docs/art/scenes.md docs/art/style-guide.md .claude/skills/krea2/SKILL.md web/src/lib/world/art.ts
git commit -F - <<'EOF'
Docs (spec 2026-10-02 house treasures): the treasures in the cut-outs table, the rooms' and pieces' seeds and prompts in the style guide, the straight-on room recipe in the krea2 skill

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

Report the screenshot paths. **The controller shows each house empty and full to the user.**
