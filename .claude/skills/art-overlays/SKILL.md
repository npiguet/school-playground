---
name: art-overlays
description: Paint an accessory (collar, tail ring, saddle or cape, helmet or crown) onto a dragon stage picture and turn it into an aligned transparent overlay the game can stack on the tinted dragon, with a WebP crop and a manifest entry. Also covers the dragon's slot masks (cou, queue, dos, tete) and the segmentation venv (Grounding DINO + SAM 2.1). Use for any "item worn by the dragon" art, for rebuilding or fixing a slot mask, or whenever one object must be isolated inside a picture (background removal cannot do that; see art-cutout).
---

# Dragon accessory overlays (La Discorde art pipeline)

Proven 2026-09-30 on the young and adult stages (a gold collar and a crested helmet each, all four
passing on bronze and three tints; the before/after sheet is `docs/art/overlay-test.png`). Generation settings, the lock and the
checkpoint rule are in the `krea2` skill; cut-outs and web exports in `art-cutout`.

## What an overlay is

An RGBA PNG **the size of the stage picture** (1024²) holding only the item's pixels, alpha 0
elsewhere, so it lines up with `dragon_<stage>_cut.png` pixel for pixel. The game draws the dragon
with its CSS tint (`web/src/lib/world/dragon.ts` `TINT_FILTERS`) and the overlay on top, unfiltered,
so the item keeps its own colours. Never keep repainted skin: inpainting repaints everything inside
the mask, and a tinted dragon would show an untinted skin patch around the item.

## One-time set-up: the segmentation venv

```bash
python -m venv tools/art/seg/.venv                     # gitignored (.venv/)
tools/art/seg/.venv/Scripts/python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128
tools/art/seg/.venv/Scripts/python -m pip install transformers accelerate scipy
```

Verified 2026-09-30: host Python 3.14.3, torch 2.11.0+cu128 (CUDA available on the RTX 3060 Ti,
8 GB, driver 591.86), transformers 5.17.0. Models (ungated, ~1.8 GB, cached in
`~/.cache/huggingface`): `IDEA-Research/grounding-dino-base` and `facebook/sam2.1-hiera-large`
(transformers warns "sam2_video checkpoint into Sam2Model": harmless). SAM 3 is gated (Meta
licence + token); not used. Never share this venv with Forge's Python.

GPU vs CPU: Forge holds most of the 8 GB while it generates. Pass `--cpu` whenever Forge may be
busy (another agent's batch): a full extract is ~30 s on the CPU (model load included), fine.
Grounding DINO is only needed by `segment.py --prompt`; extraction and slot masks use SAM only.

## The scripts (all under `tools/art/`)

| Script | Runs in | Does |
|---|---|---|
| `slots.py build/sheet` + `slots.json` | seg venv | the slot masks `assets/art/dragon/slots/<stage>_<slot>.png` and `docs/art/slot-masks.png` |
| `img2img.py --mask` | host python (stdlib) | the inpainting call (defaults below) |
| `segment.py` | seg venv | SAM 2.1 masks (box and/or points, `sam_mask`, `sam_point_masks`) and Grounding DINO boxes (`detect`) |
| `overlay.py extract` | seg venv | inpainted result + hand points -> aligned RGBA overlay |
| `overlay.py check` | seg venv | composite sheet: stage + overlay, bronze and 3 tints, 3 grounds, 2x zoom |
| `overlay.py crop` | seg venv | trim to the item, WebP (q88), manifest entry `{src, x, y, w, h}` |

## Step by step (one item on one stage)

```bash
S=C:/Users/nicol/.claude/jobs/<job>/tmp/art        # scratch dir, Windows-style path (see krea2)
# 1. inpaint, several seeds, under the machine lock
tools/art/with_lock.sh python tools/art/img2img.py --init assets/art/dragon/dragon_young.png \
  --mask assets/art/dragon/slots/young_cou.png --prompt-file $S/item.txt \
  --style discorde-inked-clean --denoise 0.75 --seed 700 --count 3 --out $S/young_item.png
# 2. look at every result (crop the slot at 1.5-2x); keep the best
# 3. extract (points read off a 50 px grid view of the result, see below)
tools/art/seg/.venv/Scripts/python tools/art/overlay.py extract assets/art/dragon/dragon_young.png \
  $S/young_item_2.png assets/art/dragon/slots/young_cou.png --cpu --pos X,Y X,Y ... --neg X,Y ... \
  --out assets/art/dragon/accessories/<item>_young.png --debug $S/dbg.png
# 4. check (look at it: no skin patch, no halo, nothing missing, sits on the body, tints)
tools/art/seg/.venv/Scripts/python tools/art/overlay.py check assets/art/dragon/dragon_young_cut.png \
  assets/art/dragon/accessories/<item>_young.png --out $S/check.png
# 5. crop + manifest (staged under assets/art/export, see art-cutout)
tools/art/seg/.venv/Scripts/python tools/art/overlay.py crop assets/art/dragon/accessories/<item>_young.png \
  --webp assets/art/export/dragon/accessories/<item>_young.webp \
  --manifest assets/art/export/dragon/accessories.json --item <item> --stage young
```

## Inpainting settings (proven)

`img2img.py` defaults: Euler/Simple, CFG 1, steps `max(9, round(8/denoise))`, `mask_blur` 4,
`inpainting_fill` 1 (original), "only masked" (`inpaint_full_res`) with padding 48, NegPiP V-scale
1.0, checkpoint override on every call.

- **Denoise 0.75 for items that wrap the body (collars, rings, harness straps)**: at 0.8-0.9 the
  model re-imagines the neck inside the mask narrower than it is, so the collar ended ~20 px short
  of the neck's outline once laid on the original picture (young, seeds 700-701). At 0.75 it keeps
  the outline and the collar reaches both edges. 0.85 also passed on the adult, whose neck fills
  the band. Use 0.85-0.9 for items that stand out of the silhouette (crests, crowns), which need
  the freedom.
- Soft Inpainting (`--soft`, the script's default args) was worse: a collar starting mid-neck.
- Prompt: describe the body part and the item together, end with "clean dark ink outline around
  the <item>", then the style block (`--style discorde-inked-clean`). Name the stage ("a young
  dragon" / "an adult dragon"). Make the item a **solid, well-bounded object** in a colour that
  differs from the bronze scales: "one solid rounded dome of smooth polished bright bronze metal
  that completely covers the top of the skull ... no scales showing through" plus
  `(open frame:-2) (visor:-2)`. A first helmet prompt gave an open bronze frame with the forehead
  scales showing through it: no segmentation can separate that from the skin.
- Prompts proven on the test (young; say "an adult dragon" / "long ivory horns" for the adult):
  collar *"... wearing a snug ancient Greek collar around its neck: a wide band of polished gold
  plates with a Greek key pattern and a round red carnelian gem at the front, the collar wraps
  closely around the neck and follows its curve, clean dark ink outline around the collar."*;
  helmet *"the head of a young dragon ... wearing an ancient Greek helmet on top of its head
  between the horns: one solid rounded dome of smooth polished bright bronze metal that completely
  covers the top of the skull, a thick dark ink outline all around it, a tall bright red horsehair
  crest on a bronze holder running from front to back, the helmet's front edge sits just above the
  eyes, the metal dome is smooth and plain with no scales showing through, (open frame:-2)
  (visor:-2)."* Seeds kept: young collar 701 (0.75), young helmet 713, adult collar 721, adult
  helmet 733 (0.85).

## Extraction (`overlay.py extract`) and why each step is there

**Default: place the SAM points by hand.** Look at the chosen result on a 50 px grid view (crop the
slot, scale 3x), then give 4-6 points on the item and 3-5 on what is not the item:

```bash
tools/art/seg/.venv/Scripts/python tools/art/overlay.py extract STAGE.png RESULT.png SLOT.png --cpu   --pos 540,388 590,398 640,405 690,410 --neg 580,338 640,350 600,440 --out OVERLAY.png --debug dbg.png
```

Put positives on every separate part (the crest AND the cap of a helmet, both ends of a collar and the
gem), negatives on the repainted skin just outside the item, the nearest horn, the eye.

1. **Changed pixels**: max channel difference result vs stage > 28 (`--diff`), closed 3 px and
   hole-filled, inside the slot: an upper bound of the item.
2. **SAM 2.1** with the slot's bounding box (or `--box`) and the points. Of its three masks
   (part, object, whole) it keeps the best-scoring one that contains every positive and no negative.
3. **Object = SAM ∩ slot (grown 2 px) ∩ changed region (grown 2 px)**, holes filled, parts under
   10 % of the largest dropped (a fleck of repainted throat above the adult collar survived at 2 %).
4. **Alpha**: eroded 1 px then a 0.8 px blur, clipped to the object: the rim pixel, which blends
   item and repainted skin, never shows. No halo on dark, mid or parchment grounds.

Without `--pos` the script prompts SAM automatically from the **novelty map** (per pixel, the
colour distance to the closest colour of the original within 12 px: the item's new colours score
high, redrawn scales low; `--novelty` 45). It worked on 3 of the 4 test items but took a pale
repainted throat patch as "new" on the young collar, so treat it as a first guess and always check
the `--debug` sheet (stage, result with box and points, slot, changed, novel, SAM, object,
novelty map) and the `check` sheet.

Rejected, do not retry:
- **Grounding DINO boxes for the item** ("golden collar", "bronze helmet. red crest."): it found
  the collar but boxed only the crest of a helmet or the whole head, and found no bronze helmet at
  all on bronze scales. Detection stays in `segment.py` for other uses.
- **SAM's own best-scoring mask** from a box: prefers a crisp part (the crest without its cap).
- **Diffing against a no-item twin** (same seed, prompt with the item weighted 0 or a "bare head"
  prompt): the twin repaints the head differently, so nothing lines up.
- **"New segment" matching** (SAM point grid on result and original, keep segments with no match):
  bits of skin everywhere.

**Horns must stay out of the head slot** (`minus_sam` in `slots.json`): inside an inpainting mask
the model redraws a horn a few px away, and that bronze-coloured redrawn horn then gets cut into
the overlay and sits, untinted, on top of the real one. With the horns (and the adult/ancestral's
ear) removed from the mask, the helmet goes behind or around them and the real horns keep the tint.

## Slot masks

`assets/art/dragon/slots/<stage>_<slot>.png`, stages `young, adult, illustre, ancestral`, slots
`cou, queue, dos, tete`; white = where the item may be painted (the inpainting mask). Built by
`slots.py build` from `slots.json`: the stage silhouette (alpha of `_cut.png`) ∩ a hand-placed
region polygon, dilated 6 px (8 for the head) past the outline, minus areas an item must never
cover (the eyes; the ancestral's beard in front of the throat), minus the parts listed in
`minus_sam` (one point per horn root and tip, per ear: SAM 2.1's smallest confident mask of that
part on the stage picture, dilated 2 px; see "Horns must stay out" above), plus "air" rectangles
above the skull where a crest or crown stands out of the body.

```bash
tools/art/seg/.venv/Scripts/python tools/art/slots.py build [--stage adult] [--slot tete] [--cpu]
tools/art/seg/.venv/Scripts/python tools/art/slots.py sheet
```

- Why hand-placed regions: Grounding DINO finds "head" and "neck" boxes well on these pictures,
  but "back" and "tail" come back as the whole dragon or the haunch, so the band where an item sits
  is a decision recorded in `slots.json`, with the pixels from the cut-out. Place the polygons on a
  50 px grid overlay of the stage picture.
- cou: a band across the neck just below the jaw. tete: the skull above the eye line, the eye
  boxes removed, plus 80-110 px of air above (a first adult mask with 50 px of air gave a helmet
  too small for the head). dos: the back and shoulder between the near wing's arm and the hip
  (a saddle or cape drapes down the side). queue: a band across the tail where it curls down in
  front of the hip, left of the near hind leg.
- After any change: `slots.py sheet` and look at `docs/art/slot-masks.png`.
- A stage that is redrawn needs its polygons re-placed (they are in picture coordinates).

## Acceptance (look, every time)

On `overlay.py check`: no repainted skin around the item (a tinted dragon shows it at once), no
light or dark rim, no missing part (crest tips, collar ends), the item reaches the body's outline
and does not float, it covers no eye, and it matches the ink-and-paint style.

## Notes from Écho's set (2026-10-01): hanging items, parts, raw + mask kept

Proven on the 16 Écho overlays (conch pendant, bronze tail bells, cave-rock cape, shell diadem;
seeds in `docs/art/style-guide.md`, "Accessories: echo").

- **Keep the generated picture and the item mask next to every overlay** (the user repaints masks by
  hand where the extraction is not perfect; erased pixels cannot be recovered, a mask can):
  `python tools/art/overlay_raw.py save <item>_<stage>.png <result>.png <inpaint mask>.png` writes
  `<item>_<stage>_raw.png` (the inpainted result, cropped to the inpainting mask's box plus the item's,
  padded 24 px: every painted pixel) and `<item>_<stage>_mask.png` (the overlay's alpha, same crop), and
  records `raw_crop` in the sidecar. After a mask is repainted: `overlay_raw.py rebuild <item>_<stage>.png`,
  then `overlay.py crop` again. Commit both files with the overlay.
- **Hanging parts (bells, charms) need room below the slot.** On the plain queue slot the bells were cut
  flat by the mask's bottom edge (young, seeds 1131-1133). Inpaint and extract with the slot united with
  itself shifted down: `python tools/art/extmask.py <stage> queue 22 <scratch>/m_<stage>_queue.png`.
- **An item with separate small parts (a band and three bells) extracts cleanly one part at a time**:
  one `overlay.py extract` per part with its own `--box` and 1-2 points (the other parts as negatives),
  then `overlay.py merge`. One SAM call for the whole ornament took the repainted scales between the bells.
- **Hand clean-up**: `tools/art/overlay_clean.py OVERLAY OUT --poly "x,y x,y ..."` erases polygons of
  repainted skin (stage px, read off a magenta preview of the overlay at 3-5x with a 20 px tick grid) and
  re-softens the cut edge; record the polygons in the sidecar. `--drop-hue bronze` is risky: it ate an
  orange conch and the cowries' shading; prefer polygons.
- **A tail ring must wrap the tail**: one result laid the band across the tail like a sash that stopped
  ~20 px short of the far edge (illustre, 1341). The next seeds (1344-1349) all wrapped it; look for the
  band reaching both outlines.
- **Diadem / crown behind the horns**: with the horns kept out of the head slot, the band disappears
  behind the horn and a tall shell stands behind it (ancestral 1413): this reads correctly, keep it.
- Batch scripts that name results by index (`..._1.png`, `_2.png`) overwrite earlier seeds of the same
  stage, slot and denoise: put the seed in the file name, or copy a kept result away before rerunning.
- Lock: wait for Forge idle and for any e2e-priority flag OUTSIDE `with_lock.sh`, then hold the lock for
  one 3-image job (see the krea2 skill, "Lock rule addendum").

## Notes from the Hydra's set (2026-10-01): extract options, gaps, standing parts

Proven on the 16 Hydra overlays (emerald scale collar, bronze serpent tail ring, marsh saddle, serpent
helmet; seeds in `docs/art/style-guide.md`, "Accessories: hydre").

- **`--keep-white`** on any glossy item (polished bronze, glazed scales, bells): by default `extract`
  drops near-white patches of 30+ px as painted white ground, which also eats an item's specular
  highlights (holes in the scales of a collar). Leave it off only where the item stands out of the
  silhouette over white ground (a crest), or drop white by hand there (see below).
- **`--max-hole N` + negatives between the coils** for a ring of coils: by default every enclosed hole
  is filled, so the repainted tail seen between two coils becomes part of the overlay (an untinted
  skin patch). `--max-hole 40` fills only specks; add `--cut 'X,Y ...'` polygons for what SAM still
  takes in.
- **The reverse: a gap the extraction cut out of a solid item** (a dull patch of a saddle seat whose
  colours match the original within the "same as original" threshold): the overlay shows the tinted
  dragon through the leather. Fill the enclosed hole back from the result at full alpha, its softened
  rim included (dilate the hole 4 px inside the object); 2 px left a faint ring.
- **Standing parts beyond the slot's air** (a serpent rising from a crest, its head above the mask):
  extract it as its own part with `--grow 6-8` (the default 2 px clipped its neck where it runs out of
  the slot), then drop the white ground left beside it by hand (pixels with min channel > 200 in a
  small box around it) since `--keep-white` was not used on that part.
- **Floating heads on a head slot**: with the horns kept out of the mask, the model often hides a
  crest serpent's body behind the horn and paints its head alone in the air (illustre 1311-1312,
  ancestral 1411-1412). Reject those: once laid on the real picture the head floats beside the horn.
- **Item spilling past the real outline**: at 0.75 the model sometimes widens a tail and wraps coils
  around the wider one (ancestral 1422-1423). Before extracting, look at each result with the stage
  cut-out's silhouette drawn on it (red outline over the result); reject coils outside it.
- Lock and memory: one `with_lock.sh` call per 3-image job, Forge-idle wait outside the lock, 5 min
  pause between jobs; `--cpu` for every extract, one at a time. A runner killed by the harness's
  background time limit can leave its child alive: check the log, not only the task status.

## Notes from the Chimera's set (2026-10-01): crests on the big heads, composite raws

Proven on the 16 Chimera overlays (goat-horn torque, serpent tail guard, ember-red cape, lion-mane
helmet; seeds in `docs/art/style-guide.md`, "Accessories: chimere").

- **Head items on illustre and ancestral need air above the skull, but only for the standing part.**
  The plain head slot gives a dome with no crest (no room). A mask united with the open air above the
  skull (slot | stage cut-out alpha < 8 inside a hand-placed box) gives a tall crest, but the model then
  redraws a horn in the air (untinted, blue) and paints open-frame domes. So: dome and brow band
  extracted from a plain-slot result, crest and holder from an air-mask result (its own `--box` around
  the crest, negatives on the redrawn horn), `overlay.py merge`. The crest stands behind the real horn,
  which stays out of both masks.
- **A merged overlay from two results needs a composite raw**: `overlay_raw.py save` refuses a raw whose
  pixels differ from the overlay's. Build it as the plain result with each other part's pixels pasted in
  (where that part's alpha > 0), plus the overlay's own pixels wherever a clean-up changed them; record
  the recipe in the sidecar's `note`, and save the raw over the air mask's box (it is the larger mask).
- **Gap between a pasted part and the real outline**: the crest's holder, extracted from the air result,
  sat 1-3 px above the real horn (the result's own horn was redrawn there), showing a thin line of
  background. Fill pixels within 4 px of both the part and the stage body (cut-out alpha > 250) from the
  result, then paint the pale ones dark ink (over air) or drop them (over the body).
- **Crests over white ground need a near-white defringe**: hair strands painted on the white background
  keep white between them; drop pixels with min channel > 200 and spread < 45 inside a box around the
  crest only, and fade the new edge 1 px. Never on the whole overlay (it eats highlights).
- Runners killed by the background time limit keep their child alive and waiting on the lock: before
  re-queuing a batch check the process table (`/proc/<pid>/cmdline`, since Git Bash `ps` shows only
  `bash`) and the log, and make every runner skip outputs that already exist.
