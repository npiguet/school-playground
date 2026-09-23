---
name: krea2
description: Generate images (game art, illustrations, backgrounds, character/creature art) with the local Krea 2 Turbo model through the sd-webui-forge-neo API on localhost:7860. Use whenever the project needs a new image asset or a visual concept.
---

# Krea 2 Turbo image generation (local Forge Neo)

## Setup facts (verified 2026-09-23)

- Server: **sd-webui-forge-neo** (`Version: neo-2.29`) at `http://127.0.0.1:7860`, A1111-compatible REST API (`/sdapi/v1/*`) is enabled. Interactive docs: `http://127.0.0.1:7860/docs`.
- If the server does not respond, ask the user to start Forge (launched with `--api`). Do not try to start it yourself.
- Model: **`krea2_turbo-Q3_K_M.gguf`** (user's choice; the official Krea 2 Turbo, 12B DiT, GGUF Q3). Do **not** use the `DasiwaKrea2Turbo…cutedisaster` checkpoint: it is an NSFW-leaning fine-tune and this project is a game for a child.
- Forge preset `krea` supplies the text encoder (`qwen3vl_4b_fp8_scaled`) and VAE (`qwen_image_vae`) automatically; selecting the checkpoint via `override_settings.sd_model_checkpoint` is enough. The switch persists after the call.
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
  --out assets/art/dragon_baby.png
```

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
- **Characters, creatures, items (sprites):** the model has no alpha channel. Prompt `isolated on a flat plain white background, centered, full body, soft even lighting` and add `(shadow:-2)(scenery:-3)`. Then remove the background (e.g. `pip install rembg` in a venv) before using it as a sprite.
- **Icons/badges:** 1024×1024, "a single emblem centered, bold simple shapes, readable at small size", then downscale.
- **Portrait cards (monsters, lieutenants):** 768×1344, character centered, dramatic rim light, simple background.
- **Audience:** the player is 13 and likes Percy Jackson / Wings of Fire. Aim for YA-novel-cover fantasy: not babyish, not gory, not scary-horror. Keep creatures expressive rather than frightening.

## Style files

`styles/*.txt` hold reusable style paragraphs appended by `--style <name>`. Add a new one when the project settles on an art direction, and reuse it for every asset in that set.

## Where things go

- Final assets: in the project's asset folder (e.g. `assets/art/…`), with the sidecar JSON committed next to them.
- Throwaway experiments: the session scratchpad, not the repo.
