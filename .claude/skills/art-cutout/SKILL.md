---
name: art-cutout
description: Turn a generated picture on a flat white background into a transparent game sprite (background removal with BiRefNet + alpha matting) and export it as WebP for the web app. Use after generating any character, creature, item, emblem, icon or accessory with the krea2 skill, or when re-cutting an existing asset.
---

# Background removal and web export (La Discorde art pipeline)

Everything runs in a throwaway `python:3.12-slim` Docker container through
`tools/art/run_docker.sh`: nothing is installed on the host, versions are pinned in the script, and
the ~900 MB model and pip wheels are cached in the named volumes `art-rembg-cache` and
`art-pip-cache` (only the first run downloads). Docker Desktop must be running.

The full rationale lives in `docs/art/style-guide.md` §6 "Tooling" and the comparison sheets in
`docs/art/cutout-comparison/`. Do not re-evaluate the method unless it visibly fails on a new
asset; it was chosen after a side-by-side test.

## The method (settled, 2026-09-24)

- rembg model **`birefnet-general`** + rembg **alpha matting** with erode 4, foreground threshold
  250, background threshold 5. Nothing else: the output is exactly what rembg returns.
- Rejected, do not retry: `isnet-general-use` (hard staircase edge, 1-px white rim, holes in pale
  areas), `birefnet-general-lite` / `birefnet-hrsod` (not better), wider matting bands of 10-15 px
  (blur fine strands, pale mist drifts), explicit colour decontamination against white, 1-px
  erosion/feather, speck removal (over-darkened pale areas or added a dark rim).
- About 15-25 s per image on CPU.

## Source picture requirements (set these at generation time, see the krea2 skill)

- Flat plain white background, the whole subject visible with room around it, soft even lighting:
  `isolated on a flat plain white background, centered, full body, soft even lighting` plus
  `(shadow:-2)(scenery:-3)`; add `(cast shadow on the ground:-3)` if a ground shadow remains.
- No "dramatic rim light from the side": it paints a coloured band outside the ink line that reads
  as a sticker rim once cut out.
- Never bake text into images; the game adds all text in HTML.

## Commands (from the repo root, Git Bash)

```bash
tools/art/run_docker.sh cutout path/to/new.png            # one file -> path/to/new_cut.png
tools/art/run_docker.sh cutout --force path/to/new.png    # re-cut an existing *_cut.png
tools/art/run_docker.sh cutout                            # every default folder under assets/art
tools/art/run_docker.sh webify                            # every PNG -> assets/art/web/**.webp (1024 px, q82)
tools/art/run_docker.sh webify --src <staging> --dst web/public/art/scenes --max-px 2048 --quality 88
tools/art/run_docker.sh icons                             # icon WebPs + contact sheet + app icons
```

- `cutout` writes `<name>_cut.png` next to the source and skips existing outputs unless `--force`.
  With no path it walks `assets/art/{characters,dragon,lieutenants,emblems,props,icons,ui}`.
- `assets/art/web/` is gitignored staging, never a source of truth. Copy the `*_cut.webp` you need
  into `web/public/art/<folder>/`; the game only reads those paths (`web/src/lib/world/art.ts`).
- Keep the source PNG, the `_cut.png` and the generator's sidecar JSON together in `assets/art/...`
  and commit all three.

## Check the result

Look at the cut-out composited on a dark, a mid and a terracotta background at 3x zoom (how the
comparison sheets were made). Watch for a white rim, holes in pale highlights, and lost thin parts
(hair strands, horn tips, wing edges). If one asset fails, fix its prompt (background, lighting)
and regenerate before touching the cut-out method.

## Not covered here

Isolating one object inside a picture (e.g. an accessory painted onto the dragon by inpainting)
is a different problem: background removal keeps the whole foreground. See the "Inpainting and
object extraction" section of the krea2 skill.

## Staging while the code is being wired (2026-09-30)

The web app's tests (`art.test.ts`, the `artReferenced` guard) fail on any file in
`web/public/art/` that no code references yet, and code agents run them in the same worktree. So
the art track never writes into `web/public/art/` itself: every web export goes to the same
relative path under **`assets/art/export/`** (e.g. `assets/art/export/emblems/palamede_cut.webp`,
`assets/art/export/icons/tool-palamede.webp`, `assets/art/export/dragon/dragon_illustre_cut.webp`),
and the code task that wires an asset moves it into `web/public/art/` (git mv). Even a redrawn
asset that replaces a referenced one (the adult dragon) is staged there, not overwritten in place.

- Emblem / sprite WebP (1024 px, q82, alpha, as webify.py does) straight from a `_cut.png` with
  Pillow: `Image.open(cut).convert("RGBA").save(dst, "WEBP", quality=82, method=6)`.
- One icon without rewriting the others: `tools/art/run_docker.sh icons webp --dst
  assets/art/export/icons --only tool-palamede` (`icons.py` gained `--dst` and `--only`).
