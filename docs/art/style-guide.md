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

- `.claude/skills/krea2/styles/discorde-illustration.txt`: scenes, characters, creatures.
- `.claude/skills/krea2/styles/discorde-emblem.txt`: round bronze/gold medallion UI emblems.

Prompt recipe (see the sidecars): framing → lighting → `subject:` block (longest) →
negatives as `(word:-2..-3)` → `isolated on a flat plain white background` for anything
that gets cut out. Generated with `--vscale 1.0` so the negative weights bite. Portrait
cards 768×1344, creatures/emblems 1024×1024, scenes 1344×768 with an "open empty sky in the
upper third" for the UI.

## 4. Character sheets

Reuse these sentences verbatim in any new prompt so recurring characters stay consistent.

**Éris** (seed 101): *Éris, the Greek goddess of discord, a tall vain theatrical villainess
with a haughty sly sideways smirk, chin tilted up, half-lidded scheming eyes with dark violet
eye makeup and one sharply arched eyebrow, long wild black hair with violet streaks flowing
as if in wind, a flowing dark purple and black chiton dress with gold embroidered trim, a
spiky golden crown, gold arm bracelets, holding a shining golden apple.*
Attitude: theatrical diva, smug, sore loser. Never sweet, never scary. Always add
`(sweet friendly kind smile:-3)`.

**The dragon companion** (seeds 201–204): *a dragon of the Discorde species, burnished
bronze-gold scales, amber eyes, a pale cream belly, curved ivory horns, leathery wings with
copper-coloured membranes, a row of ivory spines down its back.* Stages: egg (bronze-gold
scaled shell, amber glow through cracks, nest of olive branches) → hatchling (horn nubs,
stubby wings, sitting in the shell) → young (large-dog size, half-spread wings, small flame)
→ adult (long horns, huge wings spread, noble stance). The player recolours it later: keep
the hue shift in CSS/canvas, not in new generations.

**Lieutenants** (seeds 301–306):
- L'Hydre: five-headed serpent, olive-green scales fading to Aegean blue, cream belly, one
  cut stump sprouting two small heads. Each head has a different expression.
- Écho: slender nymph, long wavy pale teal hair, pale blue-green chiton, bare feet, hands
  cupped to call, translucent with two fainter copies of herself behind her.
- La Chimère: lioness body in terracotta-gold with a fiery mane, a goat head with curled
  horns growing from the back, a tail ending in an olive-green snake head; the heads argue.
- Protée: stocky old sea god, seaweed-and-foam beard, coral-and-shell crown, Aegean blue
  skin with sea-green scales, net-and-kelp chiton, one arm becoming an octopus tentacle,
  lower body dissolving into water, driftwood trident, sly wink.
- Les Sirènes: three bird-women, women from the waist up, bird bodies with Aegean blue,
  olive and cream plumage below, perched on one white marble rock, lyre / double flute /
  singing.
- Léthé: serene dreamy woman, hair and grey-blue robe dissolving into mist and slow water,
  half-closed eyes, crown of red poppies, holding a silver bowl of still water.

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

Scenes keep the upper third calm for the HUD; the battle backdrop keeps its centre empty so
the lieutenant card and the dragon can be composited over it.

Not yet made (candidates for a later batch): player avatar options, the Muses, per-stage
dragon colour variants, a title/hero banner 1536×640, small item icons (scroll, quill, laurel).

## 6. Tooling (no host installs)

`tools/art/run_docker.sh all` runs, inside a throwaway `python:3.12-slim` container with the
repo mounted at `/work`:

- `tools/art/cutout.py <folders>`: rembg (`isnet-general-use`) background removal →
  `*_cut.png`. Skips existing outputs unless `--force`.
- `tools/art/webify.py`: WebP export of every PNG into `assets/art/web/`, prints the total.

Regenerate one asset: `python .claude/skills/krea2/generate.py --prompt "<prompt from the
sidecar>" --style discorde-illustration --size 768x1344 --seed <seed> --vscale 1.0 --out
assets/art/...`, look at it, then rerun the Docker tools.

No text is baked into images; the game adds all text in HTML.
