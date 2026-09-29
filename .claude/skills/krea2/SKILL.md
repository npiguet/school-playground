---
name: krea2
description: Generate images (game art, illustrations, backgrounds, character/creature art) with the local Krea 2 Turbo model through the sd-webui-forge-neo API on localhost:7860. Use whenever the project needs a new image asset or a visual concept, or needs to paint something onto an existing picture (img2img inpainting, e.g. dragon accessories) and extract it as an overlay.
---

# Krea 2 Turbo image generation (local Forge Neo)

## Setup facts (verified 2026-09-23)

- Server: **sd-webui-forge-neo** (`Version: neo-2.29`) at `http://127.0.0.1:7860`, A1111-compatible REST API (`/sdapi/v1/*`) is enabled. Interactive docs: `http://127.0.0.1:7860/docs`.
- If the server does not respond, ask the user to start Forge (launched with `--api`). Do not try to start it yourself.
- Model: **`krea2_turbo-Q3_K_M.gguf`** (user's choice; the official Krea 2 Turbo, 12B DiT, GGUF Q3). Do **not** use the `DasiwaKrea2Turbo…cutedisaster` checkpoint: it is an NSFW-leaning fine-tune and this project is a game for a child.
- Forge preset `krea` supplies the text encoder (`qwen3vl_4b_fp8_scaled`) and VAE (`qwen_image_vae`) automatically; selecting the checkpoint via `override_settings.sd_model_checkpoint` is enough. The switch does **not** persist: the API defaults to `override_settings_restore_afterwards: true`, and Forge's own Krea checkpoint setting (`forge_checkpoint_krea`) points at the forbidden Dasiwa model (checked 2026-09-29), so **every** txt2img/img2img call must pass the override (`generate.py` does).
- Speed: ~45–60 s per 1024×1024 image. Generate one image, look at it, then iterate. Don't batch dozens blindly.

## How to generate

Use the bundled script (stdlib only, no venv needed):

```bash
python .claude/skills/krea2/generate.py \
  --prompt-file prompt.txt \        # or --prompt "..."
  --style ancient-illustration \    # optional: appends a style block from styles/<name>.txt
  --size 1024x1024 \                # see sizes below
  --seed 42 \                       # omit for random; reuse to iterate on one image
  --count 1 \
  --vscale 1.0 \                    # optional: NegPiP V-Scaling, stronger (word:weight) effect
  --variance 1.2 \                  # optional: more variety between seeds (Krea2 Variance)
  --tiling \                        # optional: ask the sampler for a seamlessly tileable image
  --out assets/art/dragon_baby.png
```

`--tiling` sets the raw txt2img `"tiling": true` field (confirmed present in `/openapi.json`'s
`StableDiffusionProcessingTxt2Img` schema, default null/off). It nudges the sampler toward an
edge-matching image but is not a substitute for the low-contrast/no-vignette prompting rules below
or for `tools/art/uiart.py`'s own `seamless()` post-process — use both together for tile textures.

It writes the PNG plus a sidecar `*.json` (prompt, seed, settings) next to it, so any asset can be reproduced or tweaked later. Always view the result with the Read tool before using it.

Raw API equivalent (POST `/sdapi/v1/txt2img`, response `images[0]` is base64 PNG, `info` is a JSON string):

```json
{"prompt": "...", "steps": 8, "cfg_scale": 1.0, "sampler_name": "Euler", "scheduler": "simple",
 "width": 1024, "height": 1024, "seed": 42,
 "override_settings": {"sd_model_checkpoint": "krea2_turbo-Q3_K_M.gguf"}}
```

## Settings for Turbo

| Setting | Value | Notes |
|---|---|---|
| steps | 8 | 4 for quick previews, 9–10 slightly cleaner |
| cfg_scale | 1.0 | Turbo is distilled. CFG > 2 gives flat, oversaturated images. At 1.0 **the negative prompt does nothing** |
| sampler / scheduler | `Euler` / `simple` | Verified. `ER SDE` / `simple` is the community alternative |
| size | 1024–2048 px per side, multiples of 16 | 1024×1024 square, 1344×768 landscape (backgrounds), 768×1344 portrait (cards/characters), 1536×640 banners |

## Prompting rules

The text encoder is **Qwen3-VL, a language model**, not CLIP. It reads sentences.

1. **Natural language, 30–150 words.** No tag soup ("masterpiece, best quality, 8k" does nothing useful).
2. **Block order:** framing/camera → lighting → `subject:` (the longest block) → environment → expression/pose → `Style:` (one paragraph).
3. **One style paragraph per prompt.** Keep the subject block longer than the style block, or the style wins over the content.
4. **Negation = negative weights, not words.** "no trees" or "without a hat" do not work (no CFG). Write `(olive trees:-3)` instead. Verified: this removed the trees from a test image. Range −1 to −5. This works thanks to the NegPiP extension (see below).
5. **Emphasis:** `(keyword:1.5)` to `(keyword:2.5)`. Never above 3 (artifacts). No nesting. At most 3–5 weights per prompt. Positive weights are weak unless V-Scaling is on (`--vscale 1`).
6. **Text in images:** put the exact glyphs in quotes, `a stone tablet engraved with "ÉRIS"`. Keep it short and verify the result. Prefer adding text in HTML/CSS in the game instead of baking it into images.
7. **Consistency across a set:** reuse the *same style file verbatim* and the same wording for recurring characters (a fixed "character sheet" sentence, e.g. the dragon's colour, horns, eye colour). Fix the seed while iterating on one asset.

Example that produced a good result (seed 42, 1024², 8 steps):

```
wide shot, soft golden morning light. subject: a small friendly bronze-scaled baby dragon with amber eyes
curled on a marble column capital in an ancient Greek temple ruin, olive trees behind. Style: a warm painterly
fantasy book illustration style built on clean confident linework, soft cel shading, rounded appealing
proportions and gentle wonder, suitable for a young-adult adventure novel cover.
```

## Installed extensions that matter

- **NegPiP (`flyfront/sd-forge-negpip`, Krea 2 fork).** Forge Neo's built-in `(word:w)` weighting barely works on Krea 2 (the text encoder normalises it away). NegPiP replaces it and **activates automatically whenever a prompt contains any weight ≠ 1** (infotext shows `NegPiP: True`). Negative weights then work well; positive weights stay subtle.
  - **V-Scaling** makes weights (especially positive ones) much stronger by scaling attention values. API: `"alwayson_scripts": {"negpip": {"args": [true, 1.0]}}` = `[enabled, strength 0–2]`. Script: `--vscale 1.0`. Verified: `(glowing blue magical sparkles:2)` is clearly stronger with it on, same seed. It changes the image noticeably, so turn it on only when a weight isn't biting, and keep it on for the whole iteration of that asset.
  - A weighted prompt renders differently from the same prompt without weights, even at the same seed.
  - A bare `BREAK` behaves like `(BREAK:-1)` while NegPiP is active. Don't write `BREAK`.
- **Dynamic Prompts is enabled.** `{a|b|c}` in a prompt is replaced by a random choice and `__name__` is a wildcard. Never use curly braces or double underscores literally in prompts. It can be used on purpose for variations.
- **Krea2 Variance** (`alwayson_scripts` key `krea2 variance`, args `[enabled, eta, noise_er_sde, noise_euler, start, end, cond_noise, cond_noise_steps]`, defaults `[false, 1.0, 1.0, 0.3, 0, 49, 1.2, 1]`). Turbo produces very similar compositions and faces across seeds. Enabling it (cond noise 1.2, 1 step) gives more variety between seeds. Script: `--variance 1.2`. Useful when exploring options, not needed for a fixed asset.

## Game asset recipes

- **Backgrounds/scenes:** 1344×768, describe the depth layers (foreground, midground, sky) and leave calm space where UI will go: `(busy details:-2)` plus "open empty sky in the upper third".
- **Characters, creatures, items (sprites):** the model has no alpha channel. Prompt `isolated on a flat plain white background, centered, full body, soft even lighting` and add `(shadow:-2)(scenery:-3)`. Then remove the background with the `art-cutout` skill (`tools/art/run_docker.sh cutout <file>`) before using it as a sprite.
- **Icons/badges:** 1024×1024, "a single emblem centered, bold simple shapes, readable at small size", then downscale.
- **Portrait cards (monsters, lieutenants):** 768×1344, character centered, dramatic rim light, simple background.
- **Audience:** the player is 13 and likes Percy Jackson / Wings of Fire. Aim for YA-novel-cover fantasy: not babyish, not gory, not scary-horror. Keep creatures expressive rather than frightening.

## Inpainting and object extraction (researched and tested 2026-09-29)

Use case: paint something *onto* an existing picture (an accessory on a dragon stage) and keep the
rest pixel-identical. Background removal (`art-cutout` skill) keeps the whole foreground, so it
cannot isolate one object inside a picture; that needs a text-prompted segmentation step.

**Inpainting works on Krea 2 Turbo through the plain A1111 API** (tested on
`assets/art/dragon/dragon_young.png`, a gold collar on the neck, seed 4242: mean pixel change 51
inside the mask, 0.01 outside). `POST /sdapi/v1/img2img`, schema `StableDiffusionProcessingImg2Img`:

```json
{"prompt": "a young bronze dragon wearing an ornate ancient Greek golden amulet collar ...",
 "init_images": ["<b64 png>"], "mask": "<b64 png, white = repaint>",
 "mask_blur": 4, "inpainting_fill": 1, "inpaint_full_res": true, "inpaint_full_res_padding": 48,
 "denoising_strength": 0.9, "steps": 9, "cfg_scale": 1, "sampler_name": "Euler", "scheduler": "Simple",
 "seed": 4242, "width": 1024, "height": 1024,
 "override_settings": {"sd_model_checkpoint": "krea2_turbo-Q3_K_M"}}
```

- `inpainting_fill`: 0 fill, 1 original, 2 latent noise, 3 latent nothing. To add a new object use 1
  with denoise 0.85–1.0. Turbo has only ~8 steps, so at low denoise raise `steps` to about 8/denoise.
  API defaults: `mask_blur` 4, `inpainting_fill` 0, `inpaint_full_res` true with padding 0,
  denoise 0.75, `mask_round` true. Forge's img2img defaults for Krea: 8 steps, CFG 1, Euler/Simple.
- Describe the whole subject plus the new object and end with the style words; the prompt is read
  for the masked crop only.
- **Everything inside the mask is repainted, not just the object.** In the test the neck skin above
  the collar came back darker and hatched. So: keep the mask tight around the slot, and use only the
  object's pixels from the result, never the whole masked area.
- Known upstream bug (Haoming02/sd-webui-forge-classic issue #1033, closed "not planned"): in the
  UI, inpainting silently changes nothing when mask blur is above 4 or the mask is small. Through
  the API, blur 8 on a 270×150 px mask worked fine here; small masks are untested. If a result comes
  back unchanged, check the mean diff inside the mask, lower `mask_blur` to 0–4 and feather the mask
  yourself.
- Soft Inpainting is available as an img2img script (`soft inpainting`), untried.

**No dedicated Krea 2 inpaint/edit/ControlNet models are usable here.** Krea publishes only Raw and
Turbo. Community inpaint LoRAs (`yijunwang2/krea2-anypaint`, `Cierpliwy/krea2-inpaint-edit`) need
ComfyUI nodes. The Krea 2 "Identity Edit" reference editing exists in Neo (option
`krea2_do_reference`, off) but its reference inputs are not exposed through the API. Neo's ControlNet
covers SDXL/Anima only (`/controlnet/model_list` is empty here). Kontext / Qwen-Image-Edit would
work via img2img but are other models with another style. Plain inpainting is the route.

**Isolating the painted object: a local Python script, not a Forge extension.**
`sd-webui-segment-anything` has known Forge problems and Neo does not support third-party extension
issues. Use `transformers` in a separate venv (Neo wants its own Python; don't share it):
- SAM 3 (`facebook/sam3`, `Sam3Model`/`Sam3Processor`, text prompt directly, e.g. "gold collar").
  Gated on Hugging Face: the user must accept Meta's licence and provide a token first.
- Ungated fallback: Grounding DINO (`IDEA-Research/grounding-dino-base`,
  `AutoModelForZeroShotObjectDetection`) for a box, then SAM 2.1 (`facebook/sam2.1-hiera-large`,
  `Sam2Model`) with `input_boxes` for the mask.
- Neither is tested yet in this project. GPU recommended (it shares VRAM with Forge; run it while
  Forge is idle).

**Pipeline for an aligned overlay** (the object alone, so the dragon's CSS tint does not recolour it
and repainted skin is not kept):
1. Mask the slot tightly on the stage picture (by hand, or segment "neck"/"head" and dilate).
2. Inpaint as above with a fixed seed.
3. Segment the object in the result, intersect with the inpaint mask, and also with the pixels that
   actually changed versus the original.
4. Write an RGBA layer the size of the stage picture: the result's pixels where the object is, alpha
   0 elsewhere, edge softened 1–2 px. It lines up with the stage picture pixel for pixel.
5. Check it composited on the stage picture and on a tinted copy (the CSS `hue-rotate` filters in
   `web/src/lib/world/dragon.ts`).

## Style files

`styles/*.txt` hold reusable style paragraphs appended by `--style <name>`. Add a new one when the project settles on an art direction, and reuse it for every asset in that set.

## Where things go

- Final assets: in the project's asset folder (e.g. `assets/art/…`), with the sidecar JSON committed next to them.
- Throwaway experiments: the session scratchpad, not the repo.
