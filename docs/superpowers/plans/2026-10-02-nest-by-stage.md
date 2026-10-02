# The Nest Grows With the Dragon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One nest painting per dragon stage (the place grows around the dragon, the camera pulls back), the dragon much bigger on screen, its care hotspot and growth sheet placed per stage.

**Architecture:** Five new paintings by txt2img (egg, young, adult, illustre, ancestral) and a sixth (hatchling) made from the chosen egg painting by the krea2 skill's two-pass inpaint, picked by the user at two explicit STOPs. In code, `ART.nest` maps each stage to its painting, `nestScene(stage)` returns one stable `SceneDef` per stage (background + the hotspot shaped for that stage), `NEST_STAGES` is the one per-stage table (dragon centre, feet line, width, growth-sheet side) that `nestDragonLayer` and `Nest.svelte` read, and the camp warms the current stage's painting through `campScene(stage)`. `SceneStage` learns to show no painting while a scene's background is still unknown, and to warm a preload list that changes after mount.

**Tech Stack:** Svelte 5 (runes), TypeScript, vitest, Playwright (in Docker), Krea 2 Turbo via sd-webui-forge-neo (krea2 skill), Python + Pillow for previews and masks.

**Spec:** `docs/superpowers/specs/2026-10-02-nest-by-stage-design.md`

## Global Constraints

- Paintings: 6, **2048x1152**, `assets/art/scenes/nest_<stage>.png` + `.json`, served as `web/public/art/scenes/nest_<stage>.webp` (**q88**); `nest.webp` and its source (`nest.png`, `nest.json`) are removed once nothing uses them.
- Each painting leaves the dragon's spot empty and paints its ground (straw or rock) on that stage's feet line, across the dragon's width; no dragon, creature or egg painted in.
- All six keep the nest's warm light and palette (`assets/art/scenes/nest.json`: warm golden sunset, `discorde-illustration`, `--vscale 1.0`, 8 steps).
- The hatchling's painting is made from the chosen egg painting by the two-pass inpaint method of the krea2 skill (the shell only).
- 2-3 variants per stage are shown to the user, who picks, **before** the code is tuned on them (Task 1 and Task 2 end in an explicit STOP).
- Starting sizes (art % of the 16:9 frame; the square sprite's height on screen is its width x 16/9): egg w 16 feet 54, hatchling 21/55, young 38/77.8, adult 40/81.2, illustre 44/88.9, ancestral 47/94 (set with the user in Task 1, 2026-10-02; the young, adult and illustre feet lowered in Task 4 so their boxes clear `HUD_LINE` 10, then the young's and the illustre's in Task 5 so their painted heads clear the HUD on the shortest supported art box, 640 px tall, ruling N3: `HUD_LINE_SHORT` 11.2 with `SPRITE_TOP_MARGIN`); centre x 50 up to the hatchling (51.5 for the young, so its box clears the sheet), around **x 44** from adult. Tuned on the chosen paintings; the head always stays below the HUD (`HUD_LINE = 10` art %: Task 4 measured the real `header.hud` at 71.5 px of a 720 px art box, 9.9 %, not the 64 px first assumed).
- From the adult stage the growth sheet moves to the side of the frame (the right, since the dragon shifts left); the sheet never overlaps the dragon or the HUD at any stage.
- The dragon layer stays depth 0, idle `none`.
- CLAUDE.md: no "pre-existing" problems (fix or report every failure or warning you meet); `vitest` and `svelte-check` must end with **0 errors and 0 warnings**; no emoji anywhere the player can see.
- **Interplay with the living-dragon plan** (`docs/superpowers/plans/2026-10-02-living-dragon.md`, running at the same time): it replaces the base `<img>` inside `DragonFigure` with a WebGL canvas for the nest and camp layers. This plan changes only the layer's box (`nestDragonLayer` x / y / scale), the background, the hotspot and the growth sheet. **Never edit `DragonFigure.svelte`, `SceneLayer.svelte` or `Dragon.svelte`**, and in `web/e2e/scenes-nest.spec.ts` leave the existing `img.dragon-base` `src` assertions as they are (the living-dragon plan owns them); new geometry checks measure the layer wrapper `[data-testid="nest-dragon-layer"]`, which both plans keep.
- The house-treasures plan also uses Forge and may also change `README.md`'s art size: art jobs just queue on the lock; whichever branch merges second recomputes the README figure (Task 3 Step 9).
- Commands (run long ones in the background, write logs to `C:\Users\nicol\.claude\jobs\9ac9a508\tmp`, never to `web/test-results`):
  - unit: `STACK=nest scripts/npm.sh run test > C:/Users/nicol/.claude/jobs/9ac9a508/tmp/nest-test.log 2>&1`
  - types: `STACK=nest scripts/npm.sh run check > C:/Users/nicol/.claude/jobs/9ac9a508/tmp/nest-check.log 2>&1`
  - e2e: `PW_WORKERS=1 STACK=nest scripts/playwright.sh <spec names> > C:/Users/nicol/.claude/jobs/9ac9a508/tmp/nest-e2e.log 2>&1` (one run per stack; the Playwright lock is machine-wide).
- Forge: wait for Forge idle **outside** the lock, then `tools/art/with_lock.sh` for one short job (3 images); when Forge is busy just poll until idle; never read Forge's own files. Inside `with_lock.sh`, pass Windows-style paths (`C:/Users/...`).
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. Never push.

## Review Focus

1. **A grown dragon's nest opened cold (reload or deep link, /camp still on its way):** she must never see the egg's painting flash before the adult's; the stage shows the night and « Les Muses préparent le camp… » until the stage is known. Test: Task 5 Step 2 (`a grown dragon's nest opened cold...`).
2. **/camp arriving after the camp's 800 ms warm-up timer:** the camp still warms the current stage's nest painting, and only that one (no stale `nest.webp`, no other stage). Test: Task 5 Step 3 (`scenes-preload.spec.ts`).
3. **The « Ton dragon » plaque under the big dragons:** it hangs below the hotspot, so a hotspot reaching low would push it into the dialogue dock (y 80+) or out of the art. Expected: plaque in the safe zone and clear of the dock at every stage, on desktop and iPad. Tests: Task 4 Step 1 (`cy + ry <= 70`) and Task 5 Step 1 (`expectInSafeZone` per stage).
4. **The growth sheet on the right covering the dragon's hotspot** (the sheet is z-index 3 and would swallow taps): a tap on the ancestral dragon must open its care. Tests: Task 4 Step 1 (sheet band disjoint from the hotspot) and Task 5 Step 1 (tap at the ancestral stage opens `overlay-care`).
5. **A landscape iPad 4:3 crop (1366x1024)** hides the outer eighths: the right-side sheet and the biggest dragon must stay inside x 12.5-87.5 of the art. Tests: Task 4 Step 1 (safe-zone bounds) and Task 5 Step 1 (the 1366x1024 measure at the ancestral stage).

## Rulings on the spec's open points

1. **Which side the sheet goes to from the adult:** the right (x 68.5-87.5), since the dragon shifts left to x 44.
2. **`ART.scenes.nest[stage]` "or the like":** `ART.nest[stage]` at the root of `ART`. `ART.scenes` stays a flat string map, because `artFor('scene', key)` reads it as `Record<string, string>`.
3. **Before /camp says the stage:** no painting at all (the night and « Les Muses préparent le camp… »), not the egg's nest, so a grown dragon never flashes the wrong nest.
4. **"The HUD line":** for the dragon's head it is the real HUD, 10 % of a 1280x720 art box (`HUD_LINE`, 71.5 px measured in Task 4; the e2e measures the real one). For the hotspot it is the existing 14 % band (`HUD_BAND`). At 47 % wide the ancestral's box reaches y 10.4, above the 14 % band.
5. **The hatchling's shell** is the egg's broken top cap plus a few fragments, right of the dragon, because the hatchling sprite already sits in the bottom half of its shell.
6. **"The hotspot covers the dragon":** the ellipse is centred inside the dragon's box, at least 0.6 of its width and 0.5 of its height. Its bottom stays at or above y 70 so the plaque below it clears the dialogue dock, which means the big dragons' ellipse covers head to belly, not the feet.
7. **Tuning limits:** y may move ±4 and w ±3 from the spec's starting values, keeping the sizes growing at every stage.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `tools/art/nest_preview.py` | Create (Task 1) | Composite a stage's dragon sprite on a nest painting exactly as `SceneLayer` places it, with the hotspot, the sheet band, the HUD line, the safe zone, the dialogue dock and an optional 5 % grid: the acceptance and tuning tool. |
| `assets/art/scenes/nest_<stage>.png/.json` | Create (Tasks 1-2) | The six chosen paintings and their sidecars. |
| `assets/art/scenes/masks/nest_hatchling_*` | Create (Task 2) | The shell's inpaint and refine masks and the pass-1 pick. |
| `assets/art/scenes/nest.png/.json`, `web/public/art/scenes/nest.webp` | Delete (Task 3) | The old single painting. |
| `web/public/art/scenes/nest_<stage>.webp` | Create (Task 3) | The six served WebPs. |
| `web/src/lib/world/art.ts` | Modify (Task 3) | `ART.nest: Record<DragonStage, string>`; `ART.scenes.nest` goes. |
| `web/src/lib/world/scenes/nest.ts` | Modify (Tasks 3-5) | `nestScene(stage)`, `NEST_STAGE_SCENES`, `NEST_STAGES`, `HUD_LINE`, `HUD_LINE_SHORT`, `SHEET_X`, `SHEET_TOP`, `dragonTop`, `dragonHead`, `nestDragonLayer`. |
| `web/src/lib/world/scenes/nest.sprites.ts` | Create (Task 5) | `SPRITE_TOP_MARGIN`: each sprite's transparent rows above the head (the e2e checks them on the files). |
| `web/src/lib/world/scenes/nest.shapes.ts` | Modify (Task 4) | The dragon hotspot's ellipse per stage. |
| `web/src/lib/world/scenes/camp.ts` | Modify (Task 3) | `campScene(stage)`: the camp's preload with the current stage's nest painting. |
| `web/src/lib/world/scenes/index.ts` | Modify (Task 3) | Re-export `NEST_STAGE_SCENES` for the budget test. |
| `web/src/components/scene/SceneStage.svelte` | Modify (Task 3) | No `<img>` for an empty background; preload warms a list that changes after mount; the music effect keyed on the track only. |
| `web/src/screens/Nest.svelte` | Modify (Tasks 3-4) | The scene from the stage; the growth sheet's side and box from `NEST_STAGES` / `SHEET_X`. |
| `web/src/screens/Camp.svelte` | Modify (Task 3) | The scene from `campScene(stage)`. |
| Tests: `nest.test.ts`, `camp.test.ts`, `art.test.ts`, `budget.test.ts`, `web/e2e/scenes-nest.spec.ts`, `web/e2e/scenes-preload.spec.ts`, `web/e2e/helpers.ts` | Modify | As in each task. |
| Docs: `docs/art/scenes.md`, `docs/art/style-guide.md`, `README.md` | Modify | Landmarks per painting, seeds and prompt notes, the art folder's size. |

No PWA precache list exists in this repository (no service worker, no `VitePWA`); `web/src/artReferenced.test.ts` (every scene WebP referenced from the sources) and `web/src/lib/world/scenes/budget.test.ts` (600 KB per scene) are the lists that must agree with the files. No e2e spec names `nest.webp`.

---

### Task 1: Paint the egg, young, adult, illustre and ancestral nests (variants, then the user picks)

**Files:**
- Create: `tools/art/nest_preview.py`
- Create (gitignored staging): `assets/art/web/nest_variants/*.txt`, `*.png`, `*.json`, `preview_*.png`
- Create after the pick: `assets/art/scenes/nest_{egg,young,adult,illustre,ancestral}.png` + `.json`
- Modify after the pick: `docs/art/style-guide.md` (seeds and prompt notes)

**Interfaces:**
- Consumes: the krea2 skill (`.claude/skills/krea2/generate.py`, style `discorde-illustration`), the dragon sprites `web/public/art/dragon/dragon_<stage>_cut.webp`.
- Produces: the five chosen PNGs (2048x1152) with sidecars; `tools/art/nest_preview.py` with the CLI below, used again in Tasks 2 and 4.

- [ ] **Step 1: Write the preview tool**

Create `tools/art/nest_preview.py`:

```python
"""Preview the nest's dragon on a nest painting exactly as the game places it.

SceneLayer: x = the layer's centre, y = its bottom edge, w = its width, all in art % of the 16:9
frame; the sprite is square, so its height is w x 16/9 in % of the frame's height. Draws, on top:
the feet line (green) across the layer's width, the hotspot ellipse (yellow), the growth sheet's
band (cyan), the HUD line at 10 % (red), the 4:3 safe zone x 12.5-87.5 (white) and the dialogue dock
x 27-87.5, y 80-100 (magenta); --grid adds a 5 % grid with labels every 10 % for measuring
landmarks (docs/art/scenes.md).

  python tools/art/nest_preview.py --painting assets/art/scenes/nest_adult.png --stage adult \
      --x 44 --y 80 --w 34 --ellipse 44,45,15,25 --sheet right --out <scratch>/adult.png
"""
import argparse
from pathlib import Path

from PIL import Image, ImageDraw

SHEET = {"left": (13.5, 19.0), "right": (68.5, 19.0)}  # x, w (art %), rods included: nest.ts SHEET_X
SHEET_TOP, SHEET_BOTTOM = 18.0, 45.0  # the sheet's top (nest.ts SHEET_TOP) and its usual bottom
HUD_LINE = 10.0  # nest.ts HUD_LINE
SAFE = (12.5, 87.5)
DOCK = (27.0, 80.0, 87.5, 100.0)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--painting", type=Path, required=True)
    ap.add_argument("--stage", required=True, choices=["egg", "hatchling", "young", "adult", "illustre", "ancestral"])
    ap.add_argument("--x", type=float, required=True)
    ap.add_argument("--y", type=float, required=True)
    ap.add_argument("--w", type=float, required=True)
    ap.add_argument("--ellipse", help="cx,cy,rx,ry in art %%")
    ap.add_argument("--sheet", choices=["left", "right"])
    ap.add_argument("--grid", action="store_true")
    ap.add_argument("--out", type=Path, required=True)
    a = ap.parse_args()

    bg = Image.open(a.painting).convert("RGBA")
    W, H = bg.size
    px = lambda v: v / 100 * W  # noqa: E731
    py = lambda v: v / 100 * H  # noqa: E731
    sprite = Image.open(f"web/public/art/dragon/dragon_{a.stage}_cut.webp").convert("RGBA")
    side = round(px(a.w))
    sprite = sprite.resize((side, side), Image.LANCZOS)
    left, top = round(px(a.x - a.w / 2)), round(py(a.y)) - side
    layer = Image.new("RGBA", bg.size, (0, 0, 0, 0))
    layer.paste(sprite, (left, top))  # paste accepts a negative top (a head above the frame shows)
    out = Image.alpha_composite(bg, layer)

    d = ImageDraw.Draw(out)
    if a.grid:
        for g in range(5, 100, 5):
            col = (255, 255, 255, 140) if g % 10 == 0 else (255, 255, 255, 60)
            d.line([(px(g), 0), (px(g), H)], fill=col, width=1)
            d.line([(0, py(g)), (W, py(g))], fill=col, width=1)
            if g % 10 == 0:
                d.text((px(g) + 3, 3), str(g), fill=(255, 255, 255, 255))
                d.text((3, py(g) + 3), str(g), fill=(255, 255, 255, 255))
    d.line([(px(SAFE[0]), 0), (px(SAFE[0]), H)], fill=(255, 255, 255, 255), width=3)
    d.line([(px(SAFE[1]), 0), (px(SAFE[1]), H)], fill=(255, 255, 255, 255), width=3)
    d.line([(0, py(HUD_LINE)), (W, py(HUD_LINE))], fill=(230, 40, 40, 255), width=3)
    d.rectangle([px(DOCK[0]), py(DOCK[1]), px(DOCK[2]), py(DOCK[3]) - 1], outline=(220, 0, 220, 255), width=3)
    d.line([(px(a.x - a.w / 2), py(a.y)), (px(a.x + a.w / 2), py(a.y))], fill=(40, 230, 40, 255), width=4)
    if a.ellipse:
        cx, cy, rx, ry = (float(v) for v in a.ellipse.split(","))
        d.ellipse([px(cx - rx), py(cy - ry), px(cx + rx), py(cy + ry)], outline=(255, 220, 0, 255), width=4)
    if a.sheet:
        sx, sw = SHEET[a.sheet]
        d.rectangle([px(sx), py(SHEET_TOP), px(sx + sw), py(SHEET_BOTTOM)], outline=(0, 220, 255, 255), width=4)
    a.out.parent.mkdir(parents=True, exist_ok=True)
    out.convert("RGB").save(a.out)
    print(a.out)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Check the tool on the current painting**

Run: `python tools/art/nest_preview.py --painting assets/art/scenes/nest.png --stage adult --x 50 --y 62 --w 26 --ellipse 51,47,17,19 --sheet left --grid --out assets/art/web/nest_variants/preview_old_adult.png`
Expected: prints the path; Read the PNG: the adult dragon stands in the old straw bed at today's size (x 37-63, feet at y 62), the yellow ellipse around it, the cyan band on the left cliff, the lines drawn. If the dragon is not where the live game shows it today, the formula is wrong: fix the tool before going on.

- [ ] **Step 3: Write the five prompt files**

Each file is `assets/art/web/nest_variants/nest_<stage>.txt` (the `Style:` paragraph is appended by `--style discorde-illustration`, as for `nest.json`). Every file ends with this composition tail, verbatim:

```
Composition: a wide 16:9 game background seen from a little distance, all the important objects are grouped in the middle of the picture, the outer eighth on the far left and on the far right holds only soft background scenery such as plain wall, foliage or sky; the ground in the lower part of the picture continues naturally with the same texture and light but with few small details; the top edge is calm. (people:-2) (text:-3) (letters:-3) (signs:-3) (busy details:-2)
```

`nest_egg.txt` (egg w 12 at x 50, feet y 62; the hatchling, w 18 feet 66, will use the same painting; sheet band on the left):

```
close-up, eye level, warm golden sunset light. subject: the dragon's nest of a demigod camp seen from close by, a round nest of woven olive branches lined with golden straw and soft cream fleeces in the centre of the picture, filling it from about one third to two thirds of its width, the middle of the nest is completely empty and open, a soft flat hollow of golden straw waiting for one dragon egg, the straw floor of the hollow lying a little below the middle of the picture's height and running wide and flat across the centre. The nest sits in a sheltered hollow of pale sun-warmed limestone, the rock arching high overhead, a few flowering bushes at its sides, a glimpse of the Aegean sea and the sunset sky on the right. On the left, set in from the left edge, a smooth stretch of plain warm cliff rock with nothing on it. (dragon:-3) (creature:-3) (animal:-2) (bird:-2) (egg:-3) (egg shell:-3) (coins:-2)
```

`nest_young.txt` (w 26 at x 50, feet y 72; sheet band on the left):

```
wide shot, eye level, warm golden sunset light. subject: the dragon's nest of a demigod camp grown bigger, a wide round nest of thick woven olive branches lined with golden straw and soft fleeces, resting on a broad flat rocky ledge high on a sea cliff, the nest spanning the middle of the picture from about one third to two thirds of its width, the middle of the nest is completely empty and open, a wide flat bed of golden straw waiting for a young dragon, its straw floor lying about three quarters of the way down the picture. Pale sun-warmed limestone rocks frame the ledge, flowering bushes grow in the cracks, the Aegean sea far below and the sunset sky on the right. On the left, set in from the left edge, the cliff face rises as a smooth stretch of plain warm rock with nothing on it. (dragon:-3) (creature:-3) (animal:-2) (bird:-2) (egg:-3) (egg shell:-3) (coins:-2)
```

`nest_adult.txt` (w 34 at x 44, feet y 80; sheet band on the right):

```
wide shot, eye level, warm golden sunset light. subject: a dragon's aerie inside a wide cave high on a sea cliff, a great shallow nest of woven olive branches and golden straw on the flat rock floor of the cave, slightly left of the centre of the picture, spanning from about one quarter to three fifths of its width, the middle of the nest is completely empty and open, a broad flat bed of golden straw waiting for a big dragon, its straw floor lying about four fifths of the way down the picture. The cave's mouth opens wide behind the nest onto the Aegean sea and the sunset sky, warm light pouring in over the pale limestone, a small bronze brazier glowing at the left edge of the nest. On the right, set in from the right edge, a smooth stretch of plain warm cave wall with nothing on it. (dragon:-3) (creature:-3) (animal:-2) (bird:-2) (egg:-3) (egg shell:-3)
```

`nest_illustre.txt` (w 40 at x 44, feet y 86; sheet band on the right):

```
wide shot, eye level, warm golden sunset light. subject: a grand dragon's aerie inside a great cave high on a sea cliff, a huge shallow nest of woven olive branches, golden straw and rich red and saffron fleeces on the flat rock floor, slightly left of the centre of the picture, spanning from about one quarter to two thirds of its width, the middle of the nest is completely empty and open, a broad flat bed of golden straw waiting for a great dragon, its straw floor lying about seven eighths of the way down the picture. Around the rim of the nest, never in its middle, a small hoard: a few heaps of gold coins, a bronze shield and a tall painted amphora; long red and gold banners with Greek-key borders hang from the cave's ceiling on the left; the cave's mouth opens behind onto the Aegean sea and the sunset sky. On the right, set in from the right edge, a smooth stretch of plain warm cave wall with nothing on it. (dragon:-3) (creature:-3) (animal:-2) (bird:-2) (egg:-3) (egg shell:-3)
```

`nest_ancestral.txt` (w 47 at x 44, feet y 94; sheet band on the right; the head reaches y ~10):

```
wide shot, eye level, warm golden sunset light. subject: an ancient dragon's mountain lair open to the sky, a vast flat summit hollow high above the clouds ringed by great pale boulders and a few broken marble columns, a huge shallow nest of whole olive trunks, golden straw and old red fleeces on the flat rock floor, slightly left of the centre of the picture, spanning from about one fifth to two thirds of its width, the middle of the nest is completely empty and open, a broad flat bed of golden straw waiting for an enormous dragon, its straw floor running almost to the bottom edge of the picture. Heaps of gold coins and an ancient bronze brazier at the far left of the nest, faded banners on two leaning poles behind it, distant mountain peaks, the Aegean sea far below and a wide open sunset sky above. On the right, set in from the right edge, a tall smooth face of plain warm rock with nothing on it. (dragon:-3) (creature:-3) (animal:-2) (bird:-2) (egg:-3) (egg shell:-3)
```

- [ ] **Step 4: Generate three variants per stage (one short locked job per stage)**

Seeds: egg 1601, young 1611, adult 1621, illustre 1631, ancestral 1641, `--count 3` (seeds +0, +1, +2). Run in the background (`run_in_background`), from the worktree root:

```bash
W=$(pwd -W)
idle() { until python -c "import json,sys,urllib.request as u; p=json.load(u.urlopen('http://127.0.0.1:7860/sdapi/v1/progress?skip_current_image=true')); sys.exit(0 if p['state']['job_count']==0 else 1)"; do sleep 20; done; }
for pair in egg:1601 young:1611 adult:1621 illustre:1631 ancestral:1641; do
  s=${pair%%:*}; seed=${pair##*:}
  idle; sleep 5; idle   # idle twice in a row, outside the lock
  sh tools/art/with_lock.sh python .claude/skills/krea2/generate.py \
    --prompt-file "$W/assets/art/web/nest_variants/nest_$s.txt" --style discorde-illustration \
    --size 2048x1152 --steps 8 --vscale 1.0 --seed $seed --count 3 \
    --out "$W/assets/art/web/nest_variants/nest_$s.png"
done > C:/Users/nicol/.claude/jobs/9ac9a508/tmp/nest-art.log 2>&1
```

Expected: `nest_<stage>_1.png`..`_3.png` with sidecars for the five stages (15 images). If Forge does not answer at all, ask the controller to have the user start Forge; never start it yourself.

- [ ] **Step 5: Make the previews and check every variant**

For each variant, one preview at the stage's starting values (the egg's variants get a second preview with the hatchling, since it shares the painting):

```bash
P=assets/art/web/nest_variants
for n in 1 2 3; do
  python tools/art/nest_preview.py --painting $P/nest_egg_$n.png --stage egg --x 50 --y 62 --w 12 --ellipse 50,51,6.5,10.5 --sheet left --out $P/preview_egg_$n.png
  python tools/art/nest_preview.py --painting $P/nest_egg_$n.png --stage hatchling --x 50 --y 66 --w 18 --ellipse 50,50,8.5,15 --sheet left --out $P/preview_hatchling_$n.png
  python tools/art/nest_preview.py --painting $P/nest_young_$n.png --stage young --x 50 --y 72 --w 26 --ellipse 50,47,12,21 --sheet left --out $P/preview_young_$n.png
  python tools/art/nest_preview.py --painting $P/nest_adult_$n.png --stage adult --x 44 --y 80 --w 34 --ellipse 44,45,15,25 --sheet right --out $P/preview_adult_$n.png
  python tools/art/nest_preview.py --painting $P/nest_illustre_$n.png --stage illustre --x 44 --y 86 --w 40 --ellipse 44,43,17,27 --sheet right --out $P/preview_illustre_$n.png
  python tools/art/nest_preview.py --painting $P/nest_ancestral_$n.png --stage ancestral --x 44 --y 94 --w 47 --ellipse 44,42.5,20,27.5 --sheet right --out $P/preview_ancestral_$n.png
done
```

Read every raw variant and every preview. A variant **passes** when all of these hold:
1. 2048x1152, the warm golden sunset light and the palette of `nest.png` (golden straw, pale limestone, olive green, terracotta, Aegean blue, small gold accents).
2. No dragon, creature, animal, bird, egg or eggshell painted anywhere (the egg painting especially: the old painting's shell is what the playtest rejected); no text or letters.
3. The dragon's box (from the layer's left to right edge, from its top to the green feet line) holds only empty straw, rock floor or background: no brazier, coin, shield or rim cutting through it.
4. The painted ground (straw or rock floor) runs under the green feet line across the dragon's whole width: in the preview the sprite stands on ground, not in the air, in a wall, or in front of the nest's front rim.
5. The scale reads: up to young the nest is clearly bigger than the dragon (it sits in it); from adult the place (cave, aerie, lair) is clearly bigger than the dragon and the nest holds it.
6. The cyan sheet band is calm (plain rock, wall or sky; no landmark the sheet would hide), and nothing important lies outside the white safe-zone lines.

If none of the three variants of a stage passes, run one more batch for that stage with seeds +3 (e.g. adult 1624, `--count 3`), strengthening only the failing point in the prompt (e.g. `(egg shell:-4)`, or moving "its straw floor lying ..." nearer the stated fraction); at most two extra batches per stage, then keep the best three with their flaws written down.

- [ ] **Step 6: STOP — show the variants to the user**

Report to the controller and stop. The report lists, per stage, the 2-3 candidates as pairs of paths (`assets/art/web/nest_variants/nest_<stage>_<n>.png` and its `preview_<stage>_<n>.png`; for the egg also `preview_hatchling_<n>.png`), each with its seed and a one-line note against the six criteria. Do not go on until the controller relays the user's pick for each of the five stages (and any retouch wanted).

- [ ] **Step 7: Keep the picks**

For each stage, with `<n>` the picked variant:

```bash
cp assets/art/web/nest_variants/nest_<stage>_<n>.png assets/art/scenes/nest_<stage>.png
cp assets/art/web/nest_variants/nest_<stage>_<n>.json assets/art/scenes/nest_<stage>.json
```

- [ ] **Step 8: Record the seeds and the prompt notes in the style guide**

In `docs/art/style-guide.md`, under "Scenes UI (UI2, 2026-09-24)", after the **Seeds** paragraph, add a paragraph (fill in the picked seeds and what you learned while generating; no placeholder text may remain):

```markdown
**The nest by stage (spec 2026-10-02 nest by stage):** one painting per dragon stage,
`scenes/nest_{egg,hatchling,young,adult,illustre,ancestral}.png`, same light, palette and style as the
old `nest.png` (seed 603, removed), `--vscale 1.0`, 8 steps, Krea2 Variance off. Picked seeds: egg <seed>,
young <seed>, adult <seed>, illustre <seed>, ancestral <seed> (the sidecars hold the prompts). The
hatchling's painting is the egg's with the broken shell inpainted in two passes (see below). Each
prompt names the empty spot's place and its floor's height ("its straw floor lying about four fifths
of the way down the picture") and a calm stretch on the growth sheet's side; check every variant with
`tools/art/nest_preview.py` (the stage's sprite at its place, the hotspot, the sheet's band).
```

Add one bullet per real lesson of the batch to "Prompt tips from this batch" if there is one (e.g. which floor-height wording held).

- [ ] **Step 9: Commit**

```bash
git add tools/art/nest_preview.py assets/art/scenes/nest_egg.* assets/art/scenes/nest_young.* assets/art/scenes/nest_adult.* assets/art/scenes/nest_illustre.* assets/art/scenes/nest_ancestral.* docs/art/style-guide.md
git commit -m "Art: the nest by stage, five paintings picked by the user (egg, young, adult, illustre, ancestral; 2048x1152, the old nest's light and palette, the dragon's spot empty on its feet line), and tools/art/nest_preview.py to check a sprite at its place

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Paint the hatchling's shell on the egg's painting (two passes, then the user looks)

**Files:**
- Create: `assets/art/scenes/masks/nest_hatchling_shell_inpaint.png`, `assets/art/scenes/masks/nest_hatchling_shell_refine.png`, `assets/art/scenes/masks/nest_hatchling_raw.png` (+ `.json`)
- Create: `assets/art/scenes/nest_hatchling.png` + `.json`
- Modify: `docs/art/style-guide.md`

**Interfaces:**
- Consumes: `assets/art/scenes/nest_egg.png` (Task 1), `tools/art/img2img.py`, `tools/art/nest_preview.py`.
- Produces: `assets/art/scenes/nest_hatchling.png` (2048x1152), identical to the egg's painting outside the shell.

The hatchling sprite (`dragon_hatchling_cut.webp`) already sits in the **bottom half** of its shell, so the painted shell is the egg's broken-off **top cap and a few fragments**, in the egg's own scales (bronze-gold and dark blue-green, like `dragon_egg_cut.webp`), lying beside the nest on the right of the dragon (the sheet is on the left). The hatchling's box is x 39.5-60.5, y 17.7-55 (w 21, feet 55, on `nest_egg.png` seed 1663, set with the user in Task 1): the shell stays right of x 61.

**Done 2026-10-02 (approved by the user, seed 1654):** inpaint box px (1290, 718, 1556, 850) (wider for the egg's scale, top below the olive leaf, bottom above the rock's dark lip); refine grown (left, top, right, bottom) = (24, 8, 24, 20) px = px (1266, 710, 1580, 870): 8 px on top to spare the leaf, and 24 px on the **left** too, since with no left growth 147 px of pass 1's blur-6 feather stayed outside the refine mask (the left edge, x 61.8 %, is still clear of the dragon's box at x 60.5 %). The prompt became the "rounded top ... tipped on its side ... broken rim facing the viewer" one (the first gave scaly bracelets, seeds 1651-1653; pass 1 then ran seeds 1654-1656). Check: 0 px changed outside the refine feather, changed box px (1256, 700, 1591, 881) = x 61.3-77.7 %, y 60.8-76.5 % (Task 4's **Broken shell** row). Settings in `assets/art/scenes/nest_hatchling.json`, method record in `docs/art/style-guide.md`.

- [ ] **Step 1: Draw the two masks**

Default box (art %): x 64-74, y 60-72 = px 1311-1516 x 691-829 (on 1663 the small nest spans about x 30-67, y 31-67; this box is the bare rock right of its front rim, just below the fallen olive leaf). Before drawing, open `nest_preview.py --grid` on `nest_egg.png` and move the box so its bottom sits on the straw or rock floor beside the nest and it holds no landmark; keep x >= 61 and <= 87.5. Then:

```bash
python - <<'EOF'
from PIL import Image, ImageDraw
W, H = 2048, 1152
box = (1311, 691, 1516, 829)          # pass 1: the shell's spot (adjusted on the painting)
grow = (0, 24, 24, 24)                # pass 2: grown 24 px on top, right and bottom, never left toward the dragon
for name, (l, t, r, b) in {
    "inpaint": box,
    "refine": (box[0] - grow[0], box[1] - grow[1], box[2] + grow[2], box[3] + grow[3]),
}.items():
    m = Image.new("L", (W, H), 0)
    ImageDraw.Draw(m).rounded_rectangle((l, t, r, b), radius=40, fill=255)
    m.save(f"assets/art/scenes/masks/nest_hatchling_shell_{name}.png")
EOF
```

- [ ] **Step 2: Write the shell prompt**

`assets/art/web/nest_variants/nest_hatchling_shell.txt`:

```
The empty broken top of a dragon's egg lying on the golden straw at the edge of a nest, a curved cap of eggshell made of overlapping burnished bronze-gold and dark blue-green scales like a pine cone, its thick jagged broken edge turned up so the pale empty inside shows, with three or four smaller scaly shell fragments scattered beside it on the straw, resting flat on the straw with a soft shadow under it, the same style, warm golden sunset light and perspective as the surrounding picture. (dragon:-3) (creature:-3) (bird:-3) (people:-3) (text:-3) (white eggshell:-2) (whole egg:-2)
```

- [ ] **Step 3: Pass 1, paint the shell (three seeds)**

```bash
W=$(pwd -W)
idle() { until python -c "import json,sys,urllib.request as u; p=json.load(u.urlopen('http://127.0.0.1:7860/sdapi/v1/progress?skip_current_image=true')); sys.exit(0 if p['state']['job_count']==0 else 1)"; do sleep 20; done; }
idle; sleep 5; idle   # idle twice in a row, outside the lock
sh tools/art/with_lock.sh python tools/art/img2img.py --init "$W/assets/art/scenes/nest_egg.png" \
  --mask "$W/assets/art/scenes/masks/nest_hatchling_shell_inpaint.png" \
  --prompt-file "$W/assets/art/web/nest_variants/nest_hatchling_shell.txt" --style discorde-illustration \
  --size 1024x1024 --padding 200 --mask-blur 6 --denoise 0.95 --steps 9 --seed 1651 --count 3 \
  --out "$W/assets/art/web/nest_variants/nest_hatchling_p1.png" > C:/Users/nicol/.claude/jobs/9ac9a508/tmp/nest-shell1.log 2>&1
```

Read the three. Keep the one whose shell reads as the egg's broken cap (scaled like `dragon_egg_cut.webp`, not a white bird's egg), lies on the floor, and stays inside the mask; a soft feathered halo at this stage is expected (pass 2 removes it). None good: seeds 1654-1656 once, then report.

- [ ] **Step 4: Pass 2, re-render the edge**

With `<k>` the kept pass-1 image and `<seed>` its seed:

```bash
sh tools/art/with_lock.sh python tools/art/img2img.py --init "$W/assets/art/web/nest_variants/nest_hatchling_p1_<k>.png" \
  --mask "$W/assets/art/scenes/masks/nest_hatchling_shell_refine.png" \
  --prompt-file "$W/assets/art/web/nest_variants/nest_hatchling_shell.txt" --style discorde-illustration \
  --size 1024x1024 --padding 200 --mask-blur 4 --denoise 0.5 --steps 16 --seed <seed> --count 1 \
  --out "$W/assets/art/web/nest_variants/nest_hatchling_p2.png" > C:/Users/nicol/.claude/jobs/9ac9a508/tmp/nest-shell2.log 2>&1
```

- [ ] **Step 5: Check that nothing else changed**

```bash
python - <<'EOF'
from PIL import Image, ImageChops, ImageFilter
egg = Image.open("assets/art/scenes/nest_egg.png").convert("RGB")
out = Image.open("assets/art/web/nest_variants/nest_hatchling_p2.png").convert("RGB")
assert out.size == egg.size == (2048, 1152), out.size
refine = Image.open("assets/art/scenes/masks/nest_hatchling_shell_refine.png").convert("L")
near = refine.filter(ImageFilter.MaxFilter(25))          # the refine mask grown ~12 px (its feather)
diff = ImageChops.difference(egg, out).convert("L").point(lambda v: 255 if v > 0 else 0)
outside = ImageChops.multiply(diff, ImageChops.invert(near))
print("changed px outside:", sum(1 for v in outside.getdata() if v))
print("changed box:", diff.getbbox())
EOF
```

Expected: `changed px outside: 0`, and the changed box inside the refine mask's grown box. Then preview: `python tools/art/nest_preview.py --painting assets/art/web/nest_variants/nest_hatchling_p2.png --stage hatchling --x 50 --y 55 --w 21 --ellipse 50,36.5,9.5,18.5 --sheet left --out assets/art/web/nest_variants/preview_hatchling_final.png`. Read it: no halo, crisp edge, the shell beside (not under) the dragon, outside the yellow ellipse and the cyan band.

- [ ] **Step 6: STOP — show the shell to the user**

Report to the controller and stop, with `nest_hatchling_p2.png`, `preview_hatchling_final.png`, the pass-1 alternatives' paths and the diff numbers. Do not go on until the controller relays the user's approval (or a retouch: then redo Steps 1-5 with the change).

- [ ] **Step 7: Keep the result, its settings and the method's record**

```bash
cp assets/art/web/nest_variants/nest_hatchling_p2.png assets/art/scenes/nest_hatchling.png
cp assets/art/web/nest_variants/nest_hatchling_p1_<k>.png assets/art/scenes/masks/nest_hatchling_raw.png
cp assets/art/web/nest_variants/nest_hatchling_p1_<k>.json assets/art/scenes/masks/nest_hatchling_raw.json
python - <<'EOF'
import json
p2 = json.load(open("assets/art/web/nest_variants/nest_hatchling_p2.json"))
p2["method"] = "krea2 skill, Adding an object to a scene: two passes, on nest_egg.png"
p2["pass1"] = json.load(open("assets/art/scenes/masks/nest_hatchling_raw.json"))
json.dump(p2, open("assets/art/scenes/nest_hatchling.json", "w"), indent=2, ensure_ascii=False)
EOF
```

In `docs/art/style-guide.md`, after the paragraph of Task 1 Step 8, add:

```markdown
**The hatchling's nest** (`nest_hatchling.png`) is `nest_egg.png` with the egg's broken top cap and a
few scaly fragments beside the nest, right of the dragon's spot, by the krea2 skill's two passes:
pass 1 `masks/nest_hatchling_shell_inpaint.png` (rounded box px <l>-<r> x <t>-<b>), only masked,
padding 200, `--mask-blur 6`, denoise 0.95, 9 steps, seed <seed>; pass 2
`masks/nest_hatchling_shell_refine.png` (grown 24 px on the top, right and bottom, never toward the
dragon), denoise 0.5, 16 steps, `--mask-blur 4`. 0 px differ from the egg's painting outside the
refine mask's feather. The shell is the cap: the hatchling sprite already sits in the shell's bottom half.
```

(Write the real box and seed; no `<...>` may remain.)

- [ ] **Step 8: Commit**

```bash
git add assets/art/scenes/nest_hatchling.* assets/art/scenes/masks/nest_hatchling_* docs/art/style-guide.md
git commit -m "Art: the hatchling's nest, the egg's painting with the egg's broken top cap beside the nest (two-pass inpaint, 0 px changed outside the shell), approved by the user

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Ship the six paintings; the nest shows its stage's painting, the camp warms it

**Files:**
- Create: `web/public/art/scenes/nest_{egg,hatchling,young,adult,illustre,ancestral}.webp`
- Delete: `web/public/art/scenes/nest.webp`, `assets/art/scenes/nest.png`, `assets/art/scenes/nest.json`
- Modify: `web/src/lib/world/art.ts:173` (and the ART root), `web/src/lib/world/art.test.ts:116`
- Modify: `web/src/lib/world/scenes/nest.ts:14-41`, `web/src/lib/world/scenes/nest.test.ts:6-18`
- Modify: `web/src/lib/world/scenes/camp.ts:139-151`, `web/src/lib/world/scenes/camp.test.ts:235-248`
- Modify: `web/src/lib/world/scenes/index.ts`, `web/src/lib/world/scenes/budget.test.ts`
- Modify: `web/src/components/scene/SceneStage.svelte:82-101,181-187`
- Modify: `web/src/screens/Nest.svelte:12,33,64`, `web/src/screens/Camp.svelte:23,156`
- Modify: `README.md:728-729`, `docs/art/style-guide.md:138,158`

**Interfaces:**
- Consumes: the six PNGs (Tasks 1-2).
- Produces:
  - `ART.nest: Readonly<Record<DragonStage, string>>` = `/art/scenes/nest_<stage>.webp`.
  - `nestScene(stage: DragonStage | null): SceneDef` — one stable object per stage (`nestScene(s) === nestScene(s)`); `null` (stage not known yet) gives `background: ''` and `hotspots: []`.
  - `NEST_SCENE: SceneDef` (= `nestScene('egg')`, the registry's entry), `NEST_STAGE_SCENES: SceneDef[]` (the six, stage order).
  - `campScene(stage: DragonStage | null): SceneDef` — `CAMP_SCENE` with the stage's nest painting fourth in `preload`; `null` gives `CAMP_SCENE` (no nest painting).
  - `SceneStage` renders no background `<img>` for `background === ''`.

- [ ] **Step 1: Write the failing unit tests**

In `web/src/lib/world/scenes/nest.test.ts`, change the import and the `state` helper and replace the first `it(...)`:

```ts
import { DRAGON_STAGES, type CampResponse, type DragonOut } from '../types';
import { NEST_SCENE, careLine, growth, nestDragonLayer, nestGreeting, nestScene } from './nest';

const egg = { name: null, tint: 'bronze', stage: 'egg', unlocked_tints: ['bronze'], worn: [] } as DragonOut;
const state = (d: DragonOut) => nestScene(d.stage).hotspots[0].state({ camp: { dragon: d } as CampResponse, catalog: null });

describe("dragon's nest (UI3 Ruling B5)", () => {
  it('paints the nest of its stage, a valid scene whose plaque echoes the hub label; the dragon opens its care (spec 2026-10-02 nest by stage)', () => {
    for (const s of DRAGON_STAGES) {
      const scene = nestScene(s);
      expect(validateScene(scene), s).toEqual([]);
      expect(scene, s).toMatchObject({ id: 'nest', title: 'Le nid du dragon', background: `/art/scenes/nest_${s}.webp`, preload: ['/art/scenes/hub_camp.webp'] });
      expect(scene.hotspots.map((h) => [h.id, h.target, h.query, h.label]), s).toEqual([['dragon', 'dragon', { panel: 'soin' }, 'Ton dragon']]);
      // One object per stage: the screen's $derived scene never changes while the stage does not.
      expect(nestScene(s), s).toBe(scene);
    }
    // Review Focus 1: before /camp says the stage, no painting (never the egg's for a grown dragon).
    expect(nestScene(null)).toMatchObject({ id: 'nest', title: 'Le nid du dragon', background: '', hotspots: [] });
    expect(NEST_SCENE).toBe(nestScene('egg'));
  });
```

(The `state(...)` uses stay as they are: `state({ ...egg, stage: 'young', name: 'Braise' })` now reads the young scene's hotspot.)

In `web/src/lib/world/art.test.ts`, replace line 116 (`expect(ART.scenes.nest)...`) with:

```ts
    // Spec 2026-10-02 nest by stage: one painting per stage, 2048x1152; the old single nest is gone.
    expect(ART.nest).toEqual(Object.fromEntries(DRAGON_STAGES.map((s) => [s, `/art/scenes/nest_${s}.webp`])));
    for (const p of Object.values(ART.nest)) expect(webpSize('public' + p), p).toEqual({ w: 2048, h: 1152 });
    expect(existsSync('public/art/scenes/nest.webp')).toBe(false);
    expect('nest' in ART.scenes).toBe(false);
```

In `web/src/lib/world/scenes/camp.test.ts`, import `campScene` beside `CAMP_SCENE` and replace the preload assertion (lines 239-246) with:

```ts
    // Final review M14: none of the hub's destinations loads cold on its first tap; spec 2026-10-02
    // nest by stage: the nest's painting is the dragon's stage's, known once /camp has arrived.
    const places = ['/art/scenes/library_tent.webp', '/art/scenes/delphi.webp', '/art/scenes/war_tent.webp'];
    const after = ['/art/scenes/cabin.webp', '/art/scenes/eris_lair.webp'];
    expect(CAMP_SCENE.preload).toEqual([...places, ...after]);
    expect(campScene(null)).toBe(CAMP_SCENE);
    for (const s of DRAGON_STAGES) {
      expect(campScene(s).preload, s).toEqual([...places, `/art/scenes/nest_${s}.webp`, ...after]);
      expect(campScene(s), s).toBe(campScene(s));
      expect({ ...campScene(s), preload: [] }, s).toEqual({ ...CAMP_SCENE, preload: [] });
    }
```

In `web/src/lib/world/scenes/budget.test.ts`, import `NEST_STAGE_SCENES` from `./index` and loop over `[...SCENES, ...HOUSE_SCENES, ...NEST_STAGE_SCENES]` in the second test.

- [ ] **Step 2: Run them and see them fail**

Run: `STACK=nest scripts/npm.sh run test > C:/Users/nicol/.claude/jobs/9ac9a508/tmp/nest-test.log 2>&1` (background).
Expected: FAIL — `nestScene` / `campScene` / `NEST_STAGE_SCENES` are not exported, `ART.nest` is undefined.

- [ ] **Step 3: Export the six WebPs and remove the old nest**

```bash
mkdir -p assets/art/web/nest_stage
cp assets/art/scenes/nest_{egg,hatchling,young,adult,illustre,ancestral}.png assets/art/web/nest_stage/
tools/art/run_docker.sh webify --src assets/art/web/nest_stage --dst web/public/art/scenes --max-px 2048 --quality 88
ls -l web/public/art/scenes/nest_*.webp
git rm web/public/art/scenes/nest.webp assets/art/scenes/nest.png assets/art/scenes/nest.json
```

Expected: six WebPs, 2048x1152, each under 600 KB (the old one was in 190-294 KB). One over 600 KB: re-export that one at `--quality 84` and say so in the style guide's paragraph.

- [ ] **Step 4: Map the paintings (`art.ts`)**

Remove `nest: '/art/scenes/nest.webp',` from `ART.scenes` (line 173). `ART.scenes` stays a flat string map (`artFor('scene', key)` reads it as `Record<string, string>`), so the per-stage map goes at the root of `ART`, right after `dragon: { ... },`:

```ts
  // Spec 2026-10-02 nest by stage: the nest painted for each stage of the dragon, the place growing
  // around it (docs/art/scenes.md "nest_<stage>"). Scene backgrounds: the 600 KB budget applies.
  nest: {
    egg: '/art/scenes/nest_egg.webp',
    hatchling: '/art/scenes/nest_hatchling.webp',
    young: '/art/scenes/nest_young.webp',
    adult: '/art/scenes/nest_adult.webp',
    illustre: '/art/scenes/nest_illustre.webp',
    ancestral: '/art/scenes/nest_ancestral.webp',
  },
```

- [ ] **Step 5: One scene per stage (`nest.ts`)**

Replace lines 14-41 (`NEST_HOTSPOTS` and `NEST_SCENE`) with the code below; add `DRAGON_STAGES` to the `../types` import (`import { DRAGON_STAGES, type CampResponse, type DragonOut, type DragonStage } from '../types';`) and `type HotspotShape` to the `../../scene/types` import.

```ts
/** The dragon in its nest: tap it for its care (« Ton dragon », `?panel=soin`). */
function dragonHotspot(shape: HotspotShape): HotspotDef {
  return {
    id: 'dragon',
    label: 'Ton dragon',
    target: 'dragon',
    query: { panel: 'soin' },
    shape,
    labelPos: 'below',
    leader: true,
    state: ({ camp }) => {
      if (!camp) return st();
      const d = camp.dragon;
      if (d.stage !== 'egg' && !d.name) return st({ isNew: true, caption: 'Il attend un nom' });
      return st({ caption: dragonCaption(d) });
    },
  };
}

const NEST_BASE: Omit<SceneDef, 'background' | 'hotspots'> = {
  id: 'nest',
  title: 'Le nid du dragon',
  layers: [],
  ambience: { particles: 'embers', music: SCENE_MUSIC.nest },
  narrator: { enter: 'nest.enter', tour: 'nest' },
  preload: [ART.scenes.hubCamp],
};

// Spec 2026-10-02 nest by stage: the nest painted for the dragon's stage. One object per stage, so the
// screen's derived scene stays the same object while the stage does not change.
const BY_STAGE = Object.fromEntries(
  DRAGON_STAGES.map((s) => [s, { ...NEST_BASE, background: ART.nest[s], hotspots: [dragonHotspot(NEST_SHAPES.dragon)] }]),
) as Record<DragonStage, SceneDef>;

/** While /camp has not said the dragon's stage: no painting (the stage's night and « Les Muses
 *  préparent le camp… »), never another stage's nest flashing first; no hotspot yet. */
const WAITING: SceneDef = { ...NEST_BASE, background: '', hotspots: [] };

export function nestScene(stage: DragonStage | null): SceneDef {
  return stage ? BY_STAGE[stage] : WAITING;
}

/** The registry's nest (scenes/index.ts SCENES: one scene per place). */
export const NEST_SCENE: SceneDef = BY_STAGE.egg;
/** The six nests, in stage order (the budget test checks each painting). */
export const NEST_STAGE_SCENES: SceneDef[] = DRAGON_STAGES.map((s) => BY_STAGE[s]);
```

In `web/src/lib/world/scenes/index.ts`, change the nest import to `import { NEST_SCENE, NEST_STAGE_SCENES } from './nest';` and add after `HOUSE_SCENES`:

```ts
/** Spec 2026-10-02 nest by stage: the nest place painted for each stage (SCENES keeps the egg's). */
export { NEST_STAGE_SCENES };
```

- [ ] **Step 6: The camp warms the stage's nest (`camp.ts`, `Camp.svelte`)**

In `camp.ts`, add `DRAGON_STAGES` to the `../types` import (keep `type DragonStage`) and replace `preload: [...]` of `CAMP_SCENE` plus its comment with:

```ts
  // Carry rec. 9, final review M14: every place the hub leads to, so none loads cold on its first
  // tap (the next step's place first: the tent and the temple, then the others and the battle).
  // UI4: the path to battle leads to Éris's lair (the boss's battle stage). The nest's painting
  // depends on the dragon's stage: campScene adds it once /camp has said the stage.
  preload: [...PLACES_FIRST, ...PLACES_AFTER],
};
```

and, above `CAMP_SCENE`:

```ts
const PLACES_FIRST = [ART.scenes.libraryTent, ART.scenes.delphi, ART.scenes.warTent];
const PLACES_AFTER = [ART.scenes.cabin, ART.scenes.erisLair];
```

and, below `CAMP_SCENE`:

```ts
// Spec 2026-10-02 nest by stage: one camp per stage, so Camp.svelte's derived scene stays the same
// object while the stage does not change.
const CAMP_BY_STAGE = Object.fromEntries(
  DRAGON_STAGES.map((s) => [s, { ...CAMP_SCENE, preload: [...PLACES_FIRST, ART.nest[s], ...PLACES_AFTER] }]),
) as Record<DragonStage, SceneDef>;

/** The camp, warming the nest painting of the dragon's stage; before /camp arrives the stage is not
 *  known, so it warms no nest painting yet (SceneStage warms the list again when it changes). */
export function campScene(stage: DragonStage | null): SceneDef {
  return stage ? CAMP_BY_STAGE[stage] : CAMP_SCENE;
}
```

In `Camp.svelte`: import `campScene` with `CAMP_SCENE` (line 23); add, after `let place: PlaceScene | undefined = $state();`:

```ts
  // Spec 2026-10-02 nest by stage: the camp warms the nest painting of the dragon's stage.
  const scene = $derived(campScene(campFor(profile.id)?.dragon.stage ?? null));
```

and on line 156 replace `scene={CAMP_SCENE}` with `{scene}` (`{#each CAMP_SCENE.hotspots ...}` stays: the hotspots are the same in every camp scene).

- [ ] **Step 7: The nest screen reads its stage's scene (`Nest.svelte`)**

Line 12: `import { careLine, growth, nestDragonLayer, nestGreeting, nestScene } from '../lib/world/scenes/nest';`. After `const dragon = $derived(...)` add:

```ts
  // Spec 2026-10-02 nest by stage: the nest painted for the dragon's stage (none until /camp says it).
  const scene = $derived(nestScene(dragon?.stage ?? null));
```

Line 33: `<PlaceScene {profile} {scene} bind:debug {greet}>`. Line 64: `{#each scene.hotspots as def (def.id)}`.

- [ ] **Step 8: Let the stage cope with a scene that changes after mount (`SceneStage.svelte`)**

Replace the music effect (lines 82-86):

```ts
  // UI5 (spec §7, Ruling E4): each place plays its loop, and takes the mixer back from a battle or a
  // speech (no leftover duck). Nothing sounds before the first tap (Ruling E3): the mixer waits.
  // Keyed on the track, not the scene object: the camp and the nest swap their scene object when
  // /camp arrives (spec 2026-10-02 nest by stage), which must not re-run e.scene() (it holds the voice).
  const music = $derived(scene.ambience.music);
  $effect(() => {
    const track = music;
    untrack(() => withAudio((e) => e.scene(track)));
  });
```

Replace the preload `onMount` (lines 94-101):

```ts
  // Fetch ahead the scenes the player is likely to open next (spec §4 performance; lib/scene/warm.ts
  // keeps them, since the browser's cache does not), 800 ms after the place opens; a list that grows
  // later (the camp learns the dragon's stage from /camp) is warmed as it changes (warm is idempotent).
  let warmReady = $state(false);
  onMount(() => {
    const t = setTimeout(() => (warmReady = true), 800);
    return () => clearTimeout(t);
  });
  $effect(() => {
    if (!warmReady) return;
    for (const src of scene.preload) warm(src);
  });
```

In the markup, guard both background images (a scene whose painting is not known yet shows the stage's night):

```svelte
  {#if hasBands && scene.background}
    <img class="stage-backdrop" data-testid="stage-backdrop" src={scene.background} alt="" aria-hidden="true" />
  {/if}
```

```svelte
        {#if scene.background}
          <img class="art-bg" src={scene.background} alt="" draggable="false" />
        {/if}
```

(`RotateScreen` already skips an empty `background`.)

- [ ] **Step 9: Docs: the README's art size and the style guide's file list**

Recompute the art folder's size and write it in `README.md` line 728-729 (« `web/public/art` (WebP, about N MB) »):

```bash
python -c "import os;t=sum(os.path.getsize(os.path.join(d,f)) for d,_,fs in os.walk('web/public/art') for f in fs);print(round(t/1e5)/10)"
```

(`readmeSizes.test.ts` is the authority: if it disagrees by 0.1 on a rounding edge, use its figure.) In `docs/art/style-guide.md` line 138, replace `nest` in the file list with `nest_<stage>` (six, "The nest by stage" below) and in the **Seeds** line replace `nest 603` with `nest 603 (replaced by the nest by stage, 2026-10-02)`.

- [ ] **Step 10: Run unit tests and the type check**

Run: `STACK=nest scripts/npm.sh run test > .../nest-test.log 2>&1` and `STACK=nest scripts/npm.sh run check > .../nest-check.log 2>&1` (background, then read the logs).
Expected: all tests PASS (including `artReferenced.test.ts`: the six WebPs are named in `art.ts`, `nest.webp` is gone; `readmeSizes.test.ts`; `budget.test.ts`), `svelte-check` 0 errors and 0 warnings. Any other failure or warning: fix it (CLAUDE.md), never skip it.

- [ ] **Step 11: Commit**

```bash
git add -A web/public/art/scenes web/src README.md docs/art/style-guide.md assets/art/scenes/nest.png assets/art/scenes/nest.json
git commit -m "The nest shows the painting of the dragon's stage (ART.nest, nestScene: one scene per stage, none while /camp is on its way, so a grown dragon never flashes the egg's nest); the camp warms that painting (campScene), SceneStage warms a preload list that changes after mount and keys its music on the track; nest.webp and its source go

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Place the dragon, its hotspot and the growth sheet per stage, tuned on the paintings

**Files:**
- Modify: `web/src/lib/world/scenes/nest.ts` (the `WIDTH` table and `nestDragonLayer`, lines 43-50 before Task 3)
- Modify: `web/src/lib/world/scenes/nest.shapes.ts`
- Modify: `web/src/lib/world/scenes/nest.test.ts` (the "seats the dragon" test)
- Modify: `web/src/screens/Nest.svelte` (the growth sheet and its style)
- Modify: `docs/art/scenes.md` (the nest section)

**Interfaces:**
- Consumes: `nestScene`, `BY_STAGE`, `dragonHotspot` (Task 3); `SAFE_ZONE`, `HUD_BAND`, `DIALOGUE_DOCK` from `web/src/lib/scene/geometry.ts`.
- Produces:
  - `NEST_STAGES: Record<DragonStage, { x: number; y: number; w: number; sheet: 'left' | 'right' }>` (art %).
  - `HUD_LINE = 10` (art %; the real HUD measures 71.5 px of a 720 px art box, Task 4), `SHEET_TOP = 18`, `SHEET_X: { left: { x: 13.5, w: 19 }, right: { x: 68.5, w: 19 } }`.
  - `dragonTop(stage: DragonStage): number` — the layer's top edge in art %.
  - `nestDragonLayer(stage)` unchanged in signature: `{ x, y, scale: w, depth: 0, idle: 'none' }`.
  - `NEST_SHAPES: Record<DragonStage, { dragon: EllipseShape }>`.
  - `Nest.svelte`'s sheet carries `data-side="left" | "right"` (Task 5's e2e reads it).

- [ ] **Step 1: Write the failing unit tests**

In `nest.test.ts`, import `DIALOGUE_DOCK, HUD_BAND, SAFE_ZONE` from `'../../scene/geometry'`, `NEST_SHAPES` from `'./nest.shapes'`, and `HUD_LINE, NEST_STAGES, SHEET_X, dragonTop` from `'./nest'`; replace the `it('seats the dragon in the straw bed, bigger as it grows', ...)` test with:

```ts
  it('seats the dragon on its painting, much bigger at every stage, its head below the HUD (spec 2026-10-02 nest by stage)', () => {
    for (const s of DRAGON_STAGES) {
      const { x, y, w } = NEST_STAGES[s];
      expect(nestDragonLayer(s), s).toEqual({ x, y, scale: w, depth: 0, idle: 'none' });
      expect(dragonTop(s), s).toBeCloseTo(y - (w * 16) / 9, 5);
      expect(dragonTop(s), `${s}: the head below the HUD`).toBeGreaterThanOrEqual(HUD_LINE);
      expect(y, `${s}: the feet in the frame`).toBeLessThanOrEqual(100);
      expect(x - w / 2, `${s}: inside the safe zone`).toBeGreaterThanOrEqual(SAFE_ZONE.x);
      expect(x + w / 2, `${s}: inside the safe zone`).toBeLessThanOrEqual(SAFE_ZONE.x + SAFE_ZONE.w);
    }
    const widths = DRAGON_STAGES.map((s) => NEST_STAGES[s].w);
    expect(widths.every((w, i) => i === 0 || w > widths[i - 1]), 'bigger at every stage').toBe(true);
    // She still looks at the dragon first: the ancestral fills nearly half the frame's width.
    expect(NEST_STAGES.ancestral.w).toBeGreaterThanOrEqual(40);
  });

  it('keeps the growth sheet beside the dragon up to the young stage and at the side from the adult, never over the dragon', () => {
    expect(DRAGON_STAGES.map((s) => NEST_STAGES[s].sheet)).toEqual(['left', 'left', 'left', 'right', 'right', 'right']);
    for (const s of DRAGON_STAGES) {
      const { x, w, sheet } = NEST_STAGES[s];
      const band = SHEET_X[sheet];
      const e = NEST_SHAPES[s].dragon;
      expect(band.x, s).toBeGreaterThanOrEqual(SAFE_ZONE.x);
      expect(band.x + band.w, s).toBeLessThanOrEqual(SAFE_ZONE.x + SAFE_ZONE.w);
      if (sheet === 'left') {
        expect(band.x + band.w, `${s}: the sheet left of the dragon`).toBeLessThanOrEqual(x - w / 2);
        expect(band.x + band.w, `${s}: the sheet left of the hotspot (Review Focus 4)`).toBeLessThanOrEqual(e.cx - e.rx);
      } else {
        expect(band.x, `${s}: the sheet right of the dragon`).toBeGreaterThanOrEqual(x + w / 2);
        expect(band.x, `${s}: the sheet right of the hotspot (Review Focus 4)`).toBeGreaterThanOrEqual(e.cx + e.rx);
        // The dragon shifts the other way, left of the frame's centre.
        expect(x, s).toBeLessThan(50);
      }
    }
  });

  it('covers the dragon with its hotspot at every stage, its plaque clear of the HUD and the dialogue dock', () => {
    for (const s of DRAGON_STAGES) {
      const { x, y, w } = NEST_STAGES[s];
      const top = dragonTop(s);
      const e = NEST_SHAPES[s].dragon;
      expect(nestScene(s).hotspots[0].shape, s).toBe(e);
      expect(e.cx, `${s}: centred on the dragon`).toBeGreaterThan(x - w / 2);
      expect(e.cx, `${s}: centred on the dragon`).toBeLessThan(x + w / 2);
      expect(e.cy, `${s}: centred on the dragon`).toBeGreaterThan(top);
      expect(e.cy, `${s}: centred on the dragon`).toBeLessThan(y);
      expect(2 * e.rx, `${s}: as wide as most of the dragon`).toBeGreaterThanOrEqual(0.6 * w);
      expect(2 * e.ry, `${s}: as tall as half the dragon`).toBeGreaterThanOrEqual(0.5 * (y - top));
      expect(e.cy - e.ry, `${s}: below the HUD band`).toBeGreaterThanOrEqual(HUD_BAND);
      // Review Focus 3: the plaque hangs below the ellipse (a 16 px leader and two lines, ~9 % of a
      // 720 px art box), so the ellipse ends 10 % above the dialogue dock.
      expect(e.cy + e.ry, `${s}: room for the plaque above the dialogue dock`).toBeLessThanOrEqual(DIALOGUE_DOCK.y - 10);
    }
  });
```

- [ ] **Step 2: Run them and see them fail**

Run the unit tests (background). Expected: FAIL — `NEST_STAGES`, `HUD_LINE`, `SHEET_X`, `dragonTop` are not exported and `NEST_SHAPES.egg` is undefined.

- [ ] **Step 3: Tune the values on the chosen paintings**

For each stage, start from the values below and run `nest_preview.py --grid` on `assets/art/scenes/nest_<stage>.png` (Task 1 Step 5's command lines, with `--grid`); Read each preview and adjust until:
- the sprite's feet stand on the painted straw or rock floor (move `y`, at most ±4 from the start) across the green line's width;
- the painted landmarks read at the right size next to the dragon (straw blades, the shell, rocks): `w` may move by at most ±3 from the start, keeping every stage bigger than the one before and `dragonTop >= 10` (`HUD_LINE`);
- `x` keeps the dragon in its empty spot (around 50 up to young, around 44 from adult);
- the ellipse sits on the dragon's body (head to belly) and the test rules of Step 1 hold (`cy + ry <= 70`, `cy - ry >= 14`, `2rx >= 0.6w`, `2ry >= 0.5h`, clear of the cyan band).

Start values (the spec's table; ellipses from the sprites' figures). All six rows were set with the user in Task 1 on the picked paintings (egg and hatchling on `nest_egg.png` 1663, young 1681, adult 1623, illustre 1633, ancestral 1652; `tmp` ladder sheet `review_ladder.png`), and every row already passes Step 1's checks: the egg and the hatchling's shell sit down in the small nest's hollow, the young stands in the straw of its big close-up nest (its box top at 10.24 with its feet at 77.8, just below the HUD line), the bigger dragons stand on the floor just in front of their nests. Keep x, y and w unless a check fails (then say so); move only the ellipses, within the rules:

| stage | x | y | w | sheet | ellipse cx, cy, rx, ry |
|---|---|---|---|---|---|
| egg | 50 | 54 | 16 | left | 50, 40, 7, 14 |
| hatchling | 50 | 55 | 21 | left | 50, 36.5, 9.5, 18.5 |
| young | 51.5 | 77.8 | 38 | left | 51.5, 37, 13, 23 |
| adult | 44 | 81.2 | 40 | right | 44, 40, 15, 22 |
| illustre | 44 | 88.9 | 44 | right | 44, 42, 17, 24 |
| ancestral | 44 | 94 | 47 | right | 44, 42.5, 20, 27.5 |

Write each stage's final preview to `assets/art/web/nest_variants/tuned_<stage>.png` (`--out`, with `--grid` off). Then write the tuned values into Steps 4-5's code (the code below shows the start values; replace any number you tuned, nothing else).

- [ ] **Step 4: The per-stage table (`nest.ts`)**

Replace the `// R11: ...` comment, the `WIDTH` table and `nestDragonLayer` with:

```ts
/** The dragon's place in each nest painting (spec 2026-10-02 nest by stage; docs/art/scenes.md
 *  "nest_<stage>"), art % of the 16:9 frame: `x` its centre, `y` its feet line, `w` its width (the
 *  square sprite stands w x 16/9 tall); `sheet` the growth sheet's side. Up to the young stage the
 *  sheet stands beside the dragon on the left; from the adult it moves to the right side of the frame
 *  and the dragon shifts left. Tuned on the paintings with tools/art/nest_preview.py. */
export const NEST_STAGES: Record<DragonStage, { x: number; y: number; w: number; sheet: 'left' | 'right' }> = {
  egg: { x: 50, y: 54, w: 16, sheet: 'left' },
  hatchling: { x: 50, y: 55, w: 21, sheet: 'left' },
  young: { x: 51.5, y: 77.8, w: 38, sheet: 'left' },
  adult: { x: 44, y: 81.2, w: 40, sheet: 'right' },
  illustre: { x: 44, y: 88.9, w: 44, sheet: 'right' },
  ancestral: { x: 44, y: 94, w: 47, sheet: 'right' },
};

/** The HUD's bottom edge in art % where it reaches lowest: 71.5 px (as the e2e measures `header.hud`:
 *  8 px padding, its row, 8 px) of a 1280x720 art box, 9.9 %. The dragon's picture stays below it. */
export const HUD_LINE = 10;
/** The growth sheet's top, and its band on each side (art %, its rods included), inside the 4:3 safe
 *  zone and clear of the HUD. */
export const SHEET_TOP = 18;
export const SHEET_X = { left: { x: 13.5, w: 19 }, right: { x: 68.5, w: 19 } } as const;

/** The top edge of the dragon's layer, art %. */
export function dragonTop(stage: DragonStage): number {
  const { y, w } = NEST_STAGES[stage];
  return y - (w * 16) / 9;
}

/** The dragon's cut-out on its stage's painting. Depth 0 and no idle: it sits still on its painting,
 *  as a parallax or a breath read as floating (playtest 2026-10-02). The living dragon (spec
 *  2026-10-02 living dragon) renders inside this same box. */
export function nestDragonLayer(stage: DragonStage): Omit<SceneLayerDef, 'id' | 'src' | 'alt'> {
  const { x, y, w } = NEST_STAGES[stage];
  return { x, y, scale: w, depth: 0, idle: 'none' };
}
```

In `BY_STAGE` (Task 3), replace `dragonHotspot(NEST_SHAPES.dragon)` with `dragonHotspot(NEST_SHAPES[s].dragon)`.

- [ ] **Step 5: The hotspot per stage (`nest.shapes.ts`)**

Replace the file with:

```ts
// Hotspot geometry of the dragon's nest, one painting per stage (nest_<stage>.webp, spec 2026-10-02
// nest by stage), art % of the 16:9 frame: an ellipse on the dragon's body (head to belly) at its
// place in NEST_STAGES (nest.ts), its bottom 10 % above the dialogue dock so the « Ton dragon »
// plaque hangs clear of it. Tuned with tools/art/nest_preview.py and checked with `?debug`.
import type { DragonStage } from '../types';
import type { EllipseShape } from '../../scene/types';

export const NEST_SHAPES: Record<DragonStage, { dragon: EllipseShape }> = {
  egg: { dragon: { kind: 'ellipse', cx: 50, cy: 40, rx: 7, ry: 14 } },
  hatchling: { dragon: { kind: 'ellipse', cx: 50, cy: 36.5, rx: 9.5, ry: 18.5 } },
  young: { dragon: { kind: 'ellipse', cx: 51.5, cy: 37, rx: 13, ry: 23 } },
  adult: { dragon: { kind: 'ellipse', cx: 44, cy: 40, rx: 15, ry: 22 } },
  illustre: { dragon: { kind: 'ellipse', cx: 44, cy: 42, rx: 17, ry: 24 } },
  ancestral: { dragon: { kind: 'ellipse', cx: 44, cy: 42.5, rx: 20, ry: 27.5 } },
};
```

- [ ] **Step 6: The growth sheet by stage (`Nest.svelte`)**

Import `NEST_STAGES, SHEET_TOP, SHEET_X` with the other `nest` names. Replace the sheet's opening tag (line 44) with:

```svelte
      {@const side = NEST_STAGES[d.stage].sheet}
      <div
        class="kit-sheet nest-growth stage-text"
        data-testid="nest-growth"
        data-side={side}
        style:left="{SHEET_X[side].x}%"
        style:top="{SHEET_TOP}%"
        style:width="calc({SHEET_X[side].w}% - 20px)"
      >
```

(`{@const}` must stay right after the `{@const g = ...}` line, inside the `{#if ctx.camp}` block.) In the `<style>`, replace the comment and the `left`, `top`, `width` lines of `.nest-growth` with:

```css
  /* The growth sheet pinned on the rock (spec 2026-10-02 nest by stage): beside the dragon on the
     left up to the young stage, at the right side of the frame from the adult; its band (left, top,
     width) comes from nest.ts SHEET_X / SHEET_TOP, inside the safe zone, clear of the dragon and the
     HUD band; `stage-text` fades it under overlays. .kit-sheet's own margin leaves room for its rods. */
  .nest-growth {
    position: absolute;
    box-sizing: border-box;
```

(keep `z-index: 3` and the rest). Update the screen's header comment (line 2-6): « its growth on a sheet pinned to the rock beside it (at the right side of the frame from the adult stage) ».

- [ ] **Step 7: Run unit tests and the type check**

Run both (background). Expected: PASS, `svelte-check` 0 errors and 0 warnings.

- [ ] **Step 8: Write the landmarks per painting (`docs/art/scenes.md`)**

Replace the `## nest: the dragon's nest` section (its intro line and table) with one subsection per painting, measured on the `--grid` previews (±2 %). The template's `…` and `<tuned>` cells mark data that exists only once the paintings do; each must be filled with a measured or tuned number, and none may reach the commit:

```markdown
## nest_<stage>: the dragon's nest, one painting per stage (spec 2026-10-02 nest by stage)

The place grows around the dragon; all six share the old nest's light and palette. The dragon's place
and size are `NEST_STAGES` (`web/src/lib/world/scenes/nest.ts`), its hotspot `NEST_SHAPES`
(`nest.shapes.ts`); the growth sheet's band is x 13.5-32.5 (egg to young) or x 68.5-87.5 (adult to
ancestral), from y 18.

### nest_egg: a straw nest in a sheltered hollow (close-up)

| Landmark | x | y | w | h | Notes |
|---|---|---|---|---|---|
| **Dragon spot** | … | … | … | … | Empty straw. Egg: feet at y <tuned>, centred at x <tuned>, width <tuned> |
| Nest (whole) | … | … | … | … | |
| Calm rock (the sheet) | … | … | … | … | |
```

…then the same table for `nest_hatchling` (the egg's painting plus the **Broken shell** row: its changed box from Task 2 Step 5, "Decorative, beside the dragon, outside its hotspot"), `nest_young` (rocky ledge), `nest_adult` (cave aerie), `nest_illustre` (the hoard and banners as decorative rows), `nest_ancestral` (mountain lair). Every `…` and `<tuned>` above is replaced by a measured or tuned number before the commit.

- [ ] **Step 9: Commit**

```bash
git add web/src/lib/world/scenes/nest.ts web/src/lib/world/scenes/nest.shapes.ts web/src/lib/world/scenes/nest.test.ts web/src/screens/Nest.svelte docs/art/scenes.md
git commit -m "The nest grows with the dragon: one table of its place per stage (NEST_STAGES, the dragon from 16 % to 47 % of the width, tuned on the paintings), its hotspot per stage, the growth sheet at the right side of the frame from the adult stage; the landmarks of the six paintings in docs/art/scenes.md

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 10: Report the six previews**

In the task report, list the six final previews (`assets/art/web/nest_variants/tuned_<stage>.png`, made with the tuned values) so the controller can show the user the result before the e2e task.

---

### Task 5: End-to-end: each stage on its own painting, clear of the sheet and the HUD; the cold open; the camp's warm-up

(This task is written as built, after its review: pre-flight ruling N1, controller ruling N3 and fix round 1.)

**Files:**
- Modify: `web/e2e/scenes-nest.spec.ts` (imports, the six-stages test, new tests), `web/e2e/scenes-preload.spec.ts`, `web/e2e/helpers.ts` (`watchNests`)
- Create: `web/src/lib/world/scenes/nest.sprites.ts` (`SPRITE_TOP_MARGIN`)
- Modify: `web/src/lib/world/scenes/nest.ts` (`HUD_LINE_SHORT`, `dragonHead`; young feet 77.8, illustre 88.9), `nest.test.ts`, `docs/art/scenes.md` (the young's and the illustre's Dragon spot rows)

**Interfaces:**
- Consumes: `data-side` on `nest-growth` (Task 4), `.art-bg` absent for an empty background (Task 3), `campScene` warm-up (Task 3); helpers `measureBoxes`, `expectInSafeZone`, `labelOverlaps`, `tap`, `expectScene`, `expectCamp`.
- Produces: `watchNests(page)` in `web/e2e/helpers.ts`; `HUD_LINE_SHORT`, `dragonHead(stage)` (nest.ts) and `SPRITE_TOP_MARGIN` (nest.sprites.ts).

- [x] **Step 1: The six stages on their own paintings, and the head on the shortest art box**

Ruling N3: the smallest supported art box is 640 px tall (a 1024x640 window). The HUD stays 71.5 px, 11.2 % of it, so the dragon's painted head (its picture's top plus the sprite's transparent rows) must clear 11.2 %. The young's feet move to 77.8 and the illustre's to 88.9 (the smallest values that clear; adult and ancestral clear by 1.1 and 1.6 px). At 640 px the heads measure egg 174.4, hatchling 118.9, young 71.9, adult 72.6, illustre 71.8, ancestral 73.1 px against the HUD's 71.5.

`nest.sprites.ts`:

```ts
// The dragon sprites' transparent margin above the head, apart from nest.ts so the e2e can import it
// without the app's modules (web/e2e/scenes-nest.spec.ts checks it against the files themselves).
import type { DragonStage } from '../types';

/** Each stage's sprite (`art/dragon/dragon_<stage>_cut.webp`, 1024x1024): its transparent rows above
 *  the head, as a fraction of its height. Measured with Pillow as the first row with a pixel whose
 *  alpha is above 128 (egg row 61, hatchling 25, young 15, adult 18, illustre 7, ancestral 12); the
 *  e2e (scenes-nest "short screen") measures the same row in the browser and fails, within one row,
 *  when a new cut changes it. */
export const SPRITE_TOP_MARGIN: Record<DragonStage, number> = {
  egg: 61 / 1024,
  hatchling: 25 / 1024,
  young: 15 / 1024,
  adult: 18 / 1024,
  illustre: 7 / 1024,
  ancestral: 12 / 1024,
};
```

`nest.ts` (after `HUD_LINE`, and after `dragonTop`):

```ts
/** The HUD's bottom edge in art % on the shortest art box the nest supports, 640 px tall (a 1024x640
 *  window, controller ruling N3): the HUD stays 71.5 px, 11.2 % of it. The dragon's painted head
 *  (its picture's top plus the sprite's transparent margin, nest.sprites.ts `SPRITE_TOP_MARGIN`)
 *  stays below it. */
export const HUD_LINE_SHORT = (71.5 / 640) * 100;

/** The top of the dragon's painted head, art %: its picture's top plus the sprite's margin. */
export function dragonHead(stage: DragonStage): number {
  const { w } = NEST_STAGES[stage];
  return dragonTop(stage) + SPRITE_TOP_MARGIN[stage] * ((w * 16) / 9);
}
```

`nest.test.ts`, in the "seats the dragon" test after the `HUD_LINE` check:

```ts
      // Controller ruling N3: on the shortest art box (640 px) the HUD reaches 11.2 %; the painted
      // head still clears it.
      expect(dragonHead(s), `${s}: the painted head below the HUD on a 640 px art box`).toBeGreaterThanOrEqual(HUD_LINE_SHORT);
```

In `scenes-nest.spec.ts` add `labelOverlaps` and `watchNests` to the helper imports, `import type { Page } from '@playwright/test'` and `import { SPRITE_TOP_MARGIN } from '../src/lib/world/scenes/nest.sprites'`; the comment above `XP_AT` says each stage is on its own painting; replace the six-stages test with:

```ts
const SHEET_RIGHT = new Set(['adult', 'illustre', 'ancestral']);

/** Routes this hero's /camp to the stage `stage()` returns, with an XP total that fits it. */
async function fakeStage(page: Page, id: number, stage: () => string) {
  await page.route(`**/api/profiles/${id}/camp`, async (route) => {
    const res = await route.fetch();
    const camp = await res.json();
    const s = stage();
    camp.dragon = { ...camp.dragon, stage: s, name: s === 'egg' ? null : 'Braise' };
    camp.xp = { ...camp.xp, ...XP_AT[s] };
    await route.fulfill({ response: res, json: camp });
  });
}

/** The top of the dragon's painted body (its first row at least half opaque: `row` of the sprite's
 *  `rows`) and the HUD's bottom edge, in viewport px: the sprite's transparent margin above the head
 *  may pass under the HUD. */
async function headAndHud(page: Page): Promise<{ head: number; hud: number; art: number; row: number; rows: number }> {
  return page.evaluate(async () => {
    const img = document.querySelector<HTMLImageElement>('[data-testid="nest-dragon-layer"] img.dragon-base')!;
    await img.decode();
    const c = document.createElement('canvas');
    [c.width, c.height] = [img.naturalWidth, img.naturalHeight];
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0);
    const a = g.getImageData(0, 0, c.width, c.height).data;
    let row = 0;
    find: for (; row < c.height; row++) for (let x = 0; x < c.width; x++) if (a[(row * c.width + x) * 4 + 3] > 128) break find;
    const r = img.getBoundingClientRect();
    const hud = document.querySelector('header.hud')!.getBoundingClientRect();
    const art = document.querySelector('[data-testid="scene-nest"] .art')!.getBoundingClientRect();
    return { head: r.top + (row / c.height) * r.height, hud: hud.bottom, art: art.height, row, rows: c.height };
  });
}

test('the nest shows each of the six stages on its own painting, clear of its growth sheet and of the HUD', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  let stage: string = 'egg';
  await fakeStage(page, id, () => stage);
  for (const [key, label, activity] of STAGES) {
    stage = key;
    await page.goto(`/#/p/${id}/dragon?debug`);
    await page.reload();
    await expectScene(page, 'nest');
    await expect(page.locator('[data-testid="scene-nest"] .art-bg')).toHaveAttribute('src', `/art/scenes/nest_${key}.webp`);
    await expect(page.getByTestId('nest-dragon-layer').locator('img.dragon-base')).toHaveAttribute('src', `/art/dragon/dragon_${key}_cut.webp`);
    await expect(page.getByTestId('dragon-stage')).toHaveText(label);
    await expect(page.getByTestId('nest-growth')).toContainText(activity);
    const right = SHEET_RIGHT.has(key);
    await expect(page.getByTestId('nest-growth')).toHaveAttribute('data-side', right ? 'right' : 'left');
    // The layer's own box (both the still picture and the living dragon's canvas fill it).
    const b = await measureBoxes(page, {
      growth: '[data-testid="nest-growth"]',
      layer: '[data-testid="nest-dragon-layer"]',
      spot: '[data-testid="nest-dragon"]',
      hud: 'header.hud',
    });
    const [g, l, s, hud] = [b.growth!, b.layer!, b.spot!, b.hud!];
    const hudBottom = hud.y + hud.height;
    if (right) {
      expect(g.x, `${key}: the growth sheet right of the dragon`).toBeGreaterThanOrEqual(l.x + l.width - 2);
      expect(g.x, `${key}: the growth sheet right of the hotspot`).toBeGreaterThanOrEqual(s.x + s.width - 2);
    } else {
      expect(g.x + g.width, `${key}: the growth sheet left of the dragon`).toBeLessThanOrEqual(l.x + 2);
      expect(g.x + g.width, `${key}: the growth sheet left of the hotspot`).toBeLessThanOrEqual(s.x + 2);
    }
    expect(l.y, `${key}: the dragon's picture below the HUD`).toBeGreaterThanOrEqual(hudBottom - 2);
    expect(g.y, `${key}: the growth sheet below the HUD`).toBeGreaterThanOrEqual(hudBottom - 2);
    // The hotspot covers the dragon: centred inside its picture, at least half as wide.
    const [cx, cy] = [s.x + s.width / 2, s.y + s.height / 2];
    expect(cx > l.x && cx < l.x + l.width && cy > l.y && cy < l.y + l.height, `${key}: the hotspot on the dragon`).toBe(true);
    expect(s.width, `${key}: the hotspot as wide as half the dragon`).toBeGreaterThanOrEqual(l.width * 0.5);
    // Review Focus 3: hotspot and plaque in the safe zone, the plaque clear of the dialogue dock.
    await expectInSafeZone(page, 'nest', ['nest-dragon']);
    expect(await labelOverlaps(page, 'nest'), key).toEqual([]);
  }
  // Review Focus 5: on a 4:3 iPad the outer eighths are cropped; the biggest dragon and the
  // right-side sheet stay inside the visible art.
  await page.setViewportSize({ width: 1366, height: 1024 });
  await expectScene(page, 'nest');
  const c = await measureBoxes(page, { art: '[data-testid="scene-nest"] .art', growth: '[data-testid="nest-growth"]', layer: '[data-testid="nest-dragon-layer"]' });
  const [left, rightEdge] = [c.art!.x + c.art!.width * 0.125, c.art!.x + c.art!.width * 0.875];
  expect(c.growth!.x + c.growth!.width, 'the sheet inside the 4:3 crop').toBeLessThanOrEqual(rightEdge + 1);
  expect(c.layer!.x, 'the ancestral dragon inside the 4:3 crop').toBeGreaterThanOrEqual(left - 1);
  // Review Focus 4: the sheet beside the ancestral never swallows the tap on it.
  await tap(page.getByTestId('nest-dragon'), testInfo);
  await expect(page.getByTestId('overlay-care')).toBeVisible();
});

// Task 4 review and controller ruling N3: the HUD is a fixed 71.5 px, so on a short screen it reaches
// lower in the art (11.2 % of a 640 px art box against 9.9 % of a 720 px one). A 1024x640 window (a
// small laptop's browser) is the shortest art box the nest supports: the dragon's painted head still
// clears the HUD there (nest.ts HUD_LINE_SHORT, nest.sprites.ts SPRITE_TOP_MARGIN).
test("the dragon's head clears the HUD on a short screen (1024x640)", async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  let stage: string = 'egg';
  await fakeStage(page, id, () => stage);
  await page.setViewportSize({ width: 1024, height: 640 });
  const seen: { key: (typeof STAGES)[number][0]; head: number; hud: number; art: number; row: number; rows: number }[] = [];
  for (const [key] of STAGES) {
    stage = key;
    await page.goto(`/#/p/${id}/dragon?debug`);
    await page.reload();
    await expectScene(page, 'nest');
    await expect(page.getByTestId('nest-dragon-layer').locator('img.dragon-base')).toHaveAttribute('src', `/art/dragon/dragon_${key}_cut.webp`);
    seen.push({ key, ...(await headAndHud(page)) });
  }
  const said = seen.map((m) => `${m.key}: head ${m.head.toFixed(1)} px, HUD bottom ${m.hud.toFixed(1)} px, art ${m.art.toFixed(0)} px tall`).join('; ');
  testInfo.annotations.push({ type: 'measures', description: said });
  for (const m of seen) {
    // nest.sprites.ts SPRITE_TOP_MARGIN (the unit rule's margin) is the sprite file's own, within a row.
    expect(Math.abs(m.row - SPRITE_TOP_MARGIN[m.key] * m.rows), `${m.key}: SPRITE_TOP_MARGIN matches the sprite (row ${m.row} of ${m.rows})`).toBeLessThanOrEqual(1);
    // No tolerance on purpose: the young and the illustre clear the HUD by 0.3-0.4 px at 640 px, so
    // the usual 2 px slack would let a head under the HUD pass.
    expect(m.head, `${m.key}: the painted head below the HUD (${said})`).toBeGreaterThanOrEqual(m.hud);
  }
});
```

- [x] **Step 2: The cold open of a grown dragon's nest (Review Focus 1)**

In `web/e2e/helpers.ts`:

```ts
// Spec 2026-10-02 nest by stage: every nest painting the page asks for (`nest_<stage>`, one entry per
// request: the server sends no-store, so a painting fetched twice shows twice), and those still on
// their way. Install before the navigation; wait for `pending` to empty before reading `fetched`.
export function watchNests(page: Page): { fetched: string[]; pending: Set<Request> } {
  const out = { fetched: [] as string[], pending: new Set<Request>() };
  page.on('request', (r) => {
    const m = r.url().match(/\/art\/scenes\/(nest\w*)\.webp$/)?.[1];
    if (!m) return;
    out.fetched.push(m);
    out.pending.add(r);
  });
  page.on('requestfinished', (r) => out.pending.delete(r));
  page.on('requestfailed', (r) => out.pending.delete(r));
  return out;
}
```

Appended to `scenes-nest.spec.ts` (ruling N1: wait for the scene to settle, then compare the whole list, one entry per request, so a double fetch fails too):

```ts
test("a grown dragon's nest opened cold shows no other stage's painting while /camp is on its way (spec 2026-10-02 nest by stage)", async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route(`**/api/profiles/${id}/camp`, async (route) => {
    const res = await route.fetch();
    const camp = await res.json();
    camp.dragon = { ...camp.dragon, stage: 'adult', name: 'Braise' };
    camp.xp = { ...camp.xp, ...XP_AT.adult };
    await held;
    await route.fulfill({ response: res, json: camp });
  });
  const nests = watchNests(page);
  await page.goto(`/#/p/${id}/dragon?debug`);
  await expectScene(page, 'nest');
  await expect(page.getByTestId('place-status')).toBeVisible();
  await expect(page.locator('[data-testid="scene-nest"] .art-bg')).toHaveCount(0);
  release();
  const bg = page.locator('[data-testid="scene-nest"] .art-bg');
  await expect(bg).toHaveAttribute('src', '/art/scenes/nest_adult.webp');
  await expect(page.getByTestId('nest-dragon')).toBeVisible();
  // Pre-flight N1: once the painting is decoded and no nest painting is still on its way, the whole
  // list of nest paintings fetched is the adult's alone (not a wait for a first match).
  await bg.evaluate((img: HTMLImageElement) => img.decode());
  await expect.poll(() => nests.pending.size).toBe(0);
  expect(nests.fetched).toEqual(['nest_adult']);
});
```

- [x] **Step 3: The camp warms the stage's nest, even late (Review Focus 2)**

Appended to `web/e2e/scenes-preload.spec.ts` (with `watchNests` imported from `./helpers`):

```ts
test("the camp warms the nest painting of the dragon's stage, even when /camp arrives after the warm-up timer (spec 2026-10-02 nest by stage)", async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.route(`**/api/profiles/${id}/camp`, async (route) => {
    const res = await route.fetch();
    const camp = await res.json();
    camp.dragon = { ...camp.dragon, stage: 'illustre', name: 'Braise' };
    camp.xp = { ...camp.xp, total: 20000, floor: 15000, next: 40000 };
    await new Promise((r) => setTimeout(r, 1500)); // after SceneStage's 800 ms warm-up timer
    await route.fulfill({ response: res, json: camp });
  });
  const nests = watchNests(page);
  await page.goto(`/#/p/${id}/camp`);
  await expectCamp(page);
  // The stage's nest is warmed; once it has arrived and no nest painting is still on its way, the
  // whole list is that one (no stale nest.webp, no other stage), not a wait for a first match.
  await expect.poll(() => nests.fetched.includes('nest_illustre')).toBe(true);
  await expect.poll(() => nests.pending.size).toBe(0);
  expect(nests.fetched).toEqual(['nest_illustre']);
});
```

- [x] **Step 4: Run the nest, preload and neighbouring specs**

Run (background): `PW_WORKERS=1 STACK=nest scripts/playwright.sh scenes-nest scenes-preload scenes-camp scenes-parure scenes-tours scenes-parity > C:/Users/nicol/.claude/jobs/9ac9a508/tmp/nest-e2e.log 2>&1`
Expected: every test PASS on desktop and ipad. A failing geometry check means a value of Task 4 is off: fix the value (and its unit test still passes), never loosen the check. A failure in a neighbouring spec (camp music, tours, parure) is ours too: fix it.

- [x] **Step 5: Run the unit tests and the type check once more**

Run both (background). Expected: PASS, 0 errors, 0 warnings.

- [x] **Step 6: Commit**

---

## Self-review notes

- Spec coverage: six paintings (Tasks 1-3), hatchling by two-pass inpaint (Task 2), variants shown and picked before tuning (STOPs in Tasks 1-2, tuning in Task 4), palette kept (prompts reuse `nest.json`'s light, style and composition), `nest.webp` and source removed (Task 3), background from the stage and camp preload (Task 3), one per-stage table, depth 0, no idle (Task 4), hotspot per stage (Task 4), sheet position by stage (Task 4), `docs/art/scenes.md` landmarks (Task 4), unit tests (Tasks 3-4) and e2e tests (Task 5) as listed in the spec. The living dragon renders in the same box: only the box changes here (Global Constraints).
- Out of scope, untouched: the camp's dragon size (`campDragonLayer`), the care panel, tints, `DragonFigure`.
