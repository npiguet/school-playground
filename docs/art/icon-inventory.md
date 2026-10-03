# Icon and badge inventory

> **Superseded by UI3b (2026-09-26).** A historical sweep: the screens it cites (`DragonScreen`,
> `Cabin`, `Lieutenant`, `Dossier`, `Bestiaire`, the camp's old hero panel) are gone, replaced by
> the places and their overlays (`web/src/screens/Nest.svelte`, `CabinRoom.svelte`,
> `WarTent.svelte`, `web/src/components/places/`). Its rows keep their original paths as a record.

A sweep of every small visual element (icon, badge, avatar, marker, chip, insignia, pictogram,
status symbol, decorative glyph) the player can see in La Discorde, done for the iPad rebuild.
Repo-root `CLAUDE.md` rule: **no emoji anywhere the player can see**, including inside French text.
This sweep found that rule broken in many places — almost always via `glyph`/`FIXED_GLYPHS` style
lookup tables that were never replaced with real art after being used as SP1/SP2/SP3 placeholders.

Legend for the **category** column:
(a) emoji/unicode pictograph · (b) text standing in for an icon · (c) CSS-only shape ·
(d) SVG · (e) proper painted art · (f) missing (a spot that should have an icon but has none)

Legend for **priority**: high = hub or a screen seen every session; medium = a real screen, seen
often but not every session; low = rare, edge-case, or dev-only.

---

## 1. Avatars

| # | Where | What the player sees today | Cat. | Proposed replacement | Priority |
|---|---|---|---|---|---|
| 1 | `web/src/lib/levels.ts:11-18` (`AVATAR_GLYPHS`, source of truth) | 🦉 🐉 🎵 🔱 🌿 ⚡ — one emoji per avatar (`chouette`, `dragon`, `lyre`, `trident`, `laurier`, `foudre`) | a | 6 new painted avatar medallions (briefs in Summary) | High |
| 2 | `web/src/components/Avatar.svelte:15` (renders `AVATAR_GLYPHS`, used by every screen below) | Same 6 emoji, plus a 🦉 fallback if the avatar key is unknown | a | Same 6 assets; fallback becomes `avatar_chouette` | High |
| 3 | `web/src/screens/ProfileCreate.svelte:70-79` — the "Ton avatar" picker (6 radio choices) | 6 emoji in circles, the player's first-ever encounter with an avatar | a | Same 6 assets | High |
| 4 | `web/src/screens/ProfilePicker.svelte:50` — "Choisis ton héros" card grid | Emoji avatar per hero card | a | Same 6 assets | High |
| 5 | `web/src/components/scene/Hud.svelte:32` — hero chip, top-left of every hub scene | Emoji avatar in a bronze ring (`Avatar ring`) | a | Same 6 assets | High |
| 6 | `web/src/components/TopBar.svelte:25` — legacy screens' top bar (every non-hub screen) | Emoji avatar, no ring | a | Same 6 assets | High |
| 7 | `web/src/screens/Camp.svelte:179` — hero panel overlay (`?panel=heros`) | Emoji avatar, 72px, ring | a | Same 6 assets | High |

## 2. HUD and controls

| # | Where | What the player sees today | Cat. | Proposed replacement | Priority |
|---|---|---|---|---|---|
| 8 | `web/src/components/TopBar.svelte:31` — "Retour au camp" | ← (unicode arrow) | a | Inline SVG arrow, matching `Hud`/`Overlay`'s stroke style | High |
| 9 | `web/src/components/TopBar.svelte:33` — "Progrès" (Dossier link) | 📊 emoji | a | New small painted/SVG "scroll with a chart" icon | High |
| 10 | `web/src/components/TopBar.svelte:34` — "Réglages" | ⚙️ emoji | a | Reuse the gear SVG already built in `Camp.svelte:186-189` (hero panel "Réglages" medallion) — just needs extracting into a shared component | High |
| 11 | `web/src/components/TopBar.svelte:42` — mute toggle | 🔊 / 🔇 emoji | a | Reuse the struck-lyre SVG already built in `Hud.svelte:53-63` | High |
| 12 | `web/src/components/TopBar.svelte:45` — "Changer de héros" | 🔄 emoji | a | Reuse the winged-sandal SVG already built in `Camp.svelte:209-213` (hero panel "Changer de héros" medallion) | High |
| 13 | `web/src/components/scene/Hud.svelte:51-64` — hub scene mute button | Bronze lyre SVG, struck through when muted | d | Already done correctly — reference pattern for #10-12 | — |
| 14 | `web/src/components/scene/Overlay.svelte:70-74` — modal close ("wax-seal ✕") | Inline SVG X in a bronze seal | d | Already done correctly — reference pattern | — |
| 15 | `web/src/screens/Camp.svelte:183-217` — hero panel: Réglages / Ton journal / Changer de héros | 3 inline SVGs (gear, open book, winged sandal) in bronze medallions | d | Already done correctly — this is the pattern #9-12 should copy | — |
| 16 | `web/src/components/AddMenu.svelte:26` — "Taper ou coller un texte" | 📝 emoji | a | New painted icon `icon_add_text` (quill over parchment) | Medium |
| 17 | `web/src/components/AddMenu.svelte:34` — "Scanner une feuille" | 📷 emoji | a | New painted icon `icon_add_scan` (camera over a sheet) | Medium |
| 18 | `web/src/components/AddMenu.svelte:47` — "Bibliothèque d'Alexandrie" | 📜 emoji | a | New painted icon `icon_add_alexandria` (stacked scrolls) | Medium |
| 19 | `web/src/screens/DragonScreen.svelte:174` — locked tint swatch | 🔒 emoji overlay | a | Inline SVG lock, same stroke style as #13-15 | Medium |
| 20 | `web/src/components/PinGate.svelte` (whole screen) | No icon at all — just a title and a 4-digit input | f | Optional: a small bronze lock/key icon above the title, matching the Overlay/Hud SVG family | Low |
| 21 | `web/src/screens/ScanText.svelte` capture step | No camera/upload icon — a plain native file input styled as a button | f | Reuse `icon_add_scan` (#17) once painted | Low |
| 22 | `web/src/components/Dictation.svelte:170-190` — Réécouter / Suivant / Pause / Reprendre | Plain text buttons, no icon | b | Acceptable as-is (large touch-target text buttons read clearly); optional small play/pause/replay SVG triad if the run wants tighter parity with iOS conventions | Low |
| 23 | `web/src/components/Dictation.svelte:161` — playing/paused status dot | CSS-only coloured dot (`.dot`, pulses while playing) | c | Fine as-is | — |
| 24 | `web/src/components/scene/RotateScreen.svelte:34` — "turn your iPad" prompt | CSS-only `.rotate-icon` shape | c | Fine as-is | — |
| 25 | `web/src/screens/Camp.svelte:136-144` — weekly-goal ribbon leaves (hub scene) | CSS-only laurel-leaf shapes (`.leaf`), fill in gold as the week progresses | c | Fine as-is — this is the correct pattern; see row 39 for the reveal screen's emoji duplicate of this same element | — |

## 3. Rewards (gear, decor, tints)

| # | Where | What the player sees today | Cat. | Proposed replacement | Priority |
|---|---|---|---|---|---|
| 26 | `web/src/components/ProgressionReveal.svelte:46-55` (`FIXED_GLYPHS`) and `web/src/screens/Cabin.svelte:52-61` (duplicated `FIXED_GLYPHS`) | 👟 🛡️ ⚡ 🏮 🧶 📚 🍎 🎨 — one emoji per non-relic reward (`sandales_hermes`, `egide`, `foudre_zeus`, 4× `decor:*`) | a | 8 painted reward icons — **already in progress**: another agent is generating these into `web/public/art/icons/` per `server/app/world/catalog.py` REWARDS ids. Once landed, swap both duplicated `FIXED_GLYPHS` maps for `ART.icons[id]` lookups. | High |
| 27 | `web/src/components/juice/Medallion.svelte:22` — reward medallion | Renders whatever `glyph` string it's given (the emoji above) inside a CSS gold-ring medallion; `locked` state swaps it for a plain `?` | a/b | Medallion frame itself (CSS ring) is fine and should stay; only the `glyph` content needs to become an `<img>` once painted icons exist. The `?` mystery state is plain ASCII and is fine as-is. | High |
| 28 | `web/src/components/places/cabin/TrophiesPanel.svelte` — tint cubbies | `<img>` of the egg's baked picture in the tint (`dragonArt('egg', tint)`, OKLCH baked offline since 2026-10-03), a locked one the bronze egg greyed by a CSS filter | e | Already proper art — no action | — |

## 4. Lieutenants and bestiary

| # | Where | What the player sees today | Cat. | Proposed replacement | Priority |
|---|---|---|---|---|---|
| 29 | `server/app/world/catalog.py:8-18` (`LIEUTENANTS[*].glyph`, source of truth, served by `GET /api/world`) | 🐍 🔊 🦁 🌊 🎶 🌫️ — one emoji per lieutenant (Hydre, Écho, Chimère, Protée, Sirènes, Léthé) | a | 6 new small painted glyph icons (briefs in Summary), or crops of the existing full portraits at `web/public/art/lieutenants/*_cut.webp` | High |
| 30 | Client-side `FALLBACK_GLYPHS`, duplicated verbatim in `web/src/screens/QuestBoard.svelte:19-26`, `web/src/screens/Oracle.svelte:26-33`, `web/src/screens/Lieutenant.svelte:24-31`, `web/src/screens/Dossier.svelte:25-32` | Same 6 emoji, used only until the world catalog loads (or if it never does) | a | Same 6 assets as #29; also worth deduplicating this constant into one shared module while touching these files | High |
| 31 | `web/src/screens/QuestBoard.svelte:138` — "Défier un monstre" challenge cards | Lieutenant glyph, 26px | a | Same asset | High |
| 32 | `web/src/screens/Oracle.svelte:200` — "École" scroll's monster-picker chips | Lieutenant glyph per chip | a | Same asset | Medium |
| 33 | `web/src/screens/Lieutenant.svelte:44,123` — lieutenant's own page + "Neutralisé" medallion | Lieutenant glyph (or `❓` if the key is unknown) | a | Same asset; `❓` fallback → a generic "unknown monster" icon | High |
| 34 | `web/src/screens/Dossier.svelte:120,128` — "Ses points faibles" list rows | Lieutenant glyph per row | a | Same asset | High |
| 35 | `web/src/components/ProgressionReveal.svelte:57-64,310` (`LIEUTENANT_GLYPHS`, third duplicate) — "neutralised" reveal card | Lieutenant glyph inside a `Medallion` | a | Same asset | High |
| 36 | `web/src/screens/Bestiaire.svelte` / `BestiaireEntry.svelte` — monster/place/tool cards and pages | Proper painted art (`e.art`, from `ART.lieutenants`/`ART.emblems`/`ART.scenes`) | e | Already correct — no action | — |
| 37 | `web/src/screens/Bestiaire.svelte:33-40,67-73` — combat status chip ("À découvrir" / "En cours" / "Neutralisé") | Plain coloured text chip, no icon | b | Fine as-is | — |

## 5. Dictation help tools (Argus, Bouclier de Persée, Chouette d'Athéna, Fil d'Ariane)

| # | Where | What the player sees today | Cat. | Proposed replacement | Priority |
|---|---|---|---|---|---|
| 38 | `web/src/components/Proofreading.svelte:369` — "Bouclier de Persée" tool chip | 🛡️ emoji | a | New small icon `icon_bouclier_persee`, or a cropped/re-rendered small version of the existing `web/public/art/emblems/persee_cut.webp` portrait (currently only used in the Bestiaire, never in the tool the player actually taps) | High |
| 39 | `web/src/components/Proofreading.svelte:372` — "Chouette d'Athéna" tool chip | 🦉 emoji | a | New small icon `icon_chouette_athena`, or crop of `web/public/art/emblems/athena_cut.webp` (same reuse gap as #38) | High |
| 40 | `web/src/components/Proofreading.svelte:382` — "Fil d'Ariane" tool chip | 🧵 emoji | a | New small icon `icon_fil_ariane`, or crop of `web/public/art/emblems/ariane_cut.webp` (same reuse gap) | High |
| 41 | `web/src/components/Proofreading.svelte:391` — "Modifier tout le texte" toggle | ✏️ emoji | a | New small SVG/painted pencil-and-scroll icon (no existing emblem covers this one — it's a UI toggle, not one of the 4 named tools) | Medium |
| 42 | `web/src/components/Proofreading.svelte:337-357` — "Passes d'Argus" chip row | No Argus icon at all next to the heading, though `web/public/art/emblems/argus_cut.webp` exists and is used only in the Bestiaire | f | New small icon `icon_argus` (many-eyed motif), or crop of the existing Argus portrait | Medium |
| 43 | `web/src/components/Proofreading.svelte:348` — a completed Argus pass | `✓ ` prefix (unicode checkmark) before the pass title | a | One shared olive SVG checkmark, reused at #43/#54/#57 | Medium |
| 44 | `web/src/components/Proofreading.svelte:353` — "Passe suivante →" | → (unicode arrow) | a | Inline SVG arrow, matching the Hud/Overlay stroke style | Medium |
| 45 | `web/src/components/Proofreading.svelte:417,428` — sentence navigation ("← Phrase précédente" / "Phrase suivante →") | ← / → (unicode arrows) | a | Same shared SVG arrow as #44 | Medium |

## 6. Quests and Oracle

| # | Where | What the player sees today | Cat. | Proposed replacement | Priority |
|---|---|---|---|---|---|
| 46 | `web/src/components/QuestCard.svelte:32-33,58` — quest "kind" chip ("Tableau" / "Oracle" / "Éris") | Colour-coded text chip, no icon | b | Fine as-is; optional small kind icon (board/scroll/skull) if the design wants extra scannability | Low |
| 47 | `web/src/components/Scroll.svelte:65,118-129` — Oracle scroll's wax seal | `✶` (six-pointed-star dingbat) centred in a terracotta CSS circle | a | New small icon `icon_oracle_seal` (a pressed wax seal with a sun/star motif), or an SVG star | Medium |
| 48 | `web/src/screens/AlexandriaWork.svelte:207-208` — chunk "richesse en accords" rating | `'★'.repeat(starsFor(chunk.score))` — literal unicode stars | a | Small reusable SVG star, repeated the same way (gold/olive fill) | Medium |
| 49 | `web/src/screens/Library.svelte:107-113`, `Alexandria.svelte:65-67`, `AlexandriaWork.svelte:168-205` — source/level/status chips ("Scanné", "Alexandrie", "niveau…", prophecy chip) | Plain coloured text chips, no icon | b | Fine as-is | — |

## 7. States and badges

| # | Where | What the player sees today | Cat. | Proposed replacement | Priority |
|---|---|---|---|---|---|
| 50 | `web/src/components/ProgressionReveal.svelte:359-361` — weekly-goal-reached reveal card | `🌿` (leaf emoji) repeated once per weekly target | a | Reuse the CSS-only laurel-leaf shape already built for the exact same element in `web/src/screens/Camp.svelte:136-144` (`.leaf`) — zero new art needed, just consistency | High |
| 51 | `web/src/components/ProgressionReveal.svelte:69,71` — unknown/undiscovered reward glyph fallback | `❔` (unicode question mark ornament) | a | Reuse `Medallion`'s existing plain-`?` "locked" treatment (row 27) instead of a second, different placeholder glyph | Low |
| 52 | `web/src/components/Results.svelte:220` — a still-missing word/punctuation marker | `▢` (unicode white square) as a tappable button | a | Small SVG marker (e.g. a dashed caret/box), olive or orange per the design's existing colour rules | Medium |
| 53 | `web/src/components/Results.svelte:256` — "Ce qu'Éris a tenté" list, a caught error | "déjoué ✓" — unicode checkmark appended to French text | a | Shared olive SVG checkmark (see #43), placed after the text rather than baked into it | Medium |
| 54 | `web/src/screens/ScanText.svelte:236` — verify step, a word the player has tapped/viewed | `✓ ` prefix (unicode checkmark) | a | Same shared SVG checkmark | Medium |
| 55 | `web/src/components/scene/Hotspot.svelte:65,151-165` — hub scene plaque badge (e.g. quest count) | CSS-only numeric badge, no icon | c | Fine as-is | — |
| 56 | **Obsolete (ranks removed in sub-project 3, 2026-09-29 dragon growth: the dragon's six painted stages replaced them).** Rank/level insignia — `server/app/world/catalog.py:47-49` `RANKS` (10 tiers, "Recrue du camp" → "Légende du camp"), shown in `ProgressionReveal.svelte` and `Dossier.svelte` | No icon of any kind — only the rank title text plus the laurel XP gauge (`LaurelBar`) | f | Optional: a tiered laurel-wreath insignia (e.g. 3-4 medallion border treatments reused across rank bands) rather than 10 bespoke icons — keeps the asset count sane | Medium |
| 57 | Loading/empty/error text across `ProfilePicker.svelte`, `QuestBoard.svelte`, `Oracle.svelte`, `Cabin.svelte`, `Dossier.svelte`, `Bestiaire.svelte`, `Library.svelte` (e.g. "Les Muses cherchent…", "Aucune quête en cours…", "Impossible de charger…") | Plain French sentences, no icon | b/f | Acceptable as-is for a calm, book-like UI; if desired later, one shared small "closed scroll" (empty) and one "torn parchment" (error) motif could reinforce state, but this is not a gap that needs closing now | Low |

## 8. App icon

| # | Where | What the player sees today | Cat. | Proposed replacement | Priority |
|---|---|---|---|---|---|
| 58 | `web/public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`; referenced from `web/index.html:9` and `web/public/manifest.json` | A flat-vector golden apple on a terracotta rounded square — correctly sized (180/192/512px) and present, but flat/vector style, not the painted-brushwork look of the rest of the game | d | Low-effort: keep as-is (it already reads well and is on-theme — the golden apple / Pomme d'Or). Optional: repaint in the game's painted style for full visual consistency, matching `web/public/art/emblems/apple_cut.webp` | Low |

## 9. Other (checked, no issue found)

| # | Where | What the player sees today | Cat. | Proposed replacement | Priority |
|---|---|---|---|---|---|
| 59 | `web/src/components/juice/Gauge.svelte`, `web/src/components/ui/LaurelBar.svelte` | CSS-only progress bar / laurel-leaf XP bar | c | Fine as-is | — |
| 60 | `web/src/lib/explain.ts:18-28` (`CATEGORY_LABELS`) — Results screen's "Ce qu'Éris a tenté" grouping headers | Plain French category text ("Accord du verbe avec son sujet (L'Hydre)", etc.), no icon | b | Fine as-is — the lieutenant name in parentheses already does the job an icon would | — |
| 61 | `server/app/**/*.py` strings reaching the UI (oracle, quests, dossier prose in `eris.py`/`quests.py`, etc.) | Plain French text | b | No pictographs found server-side outside `catalog.py`'s `LIEUTENANTS[*].glyph` (row 29) | — |
| 62 | `content/*.json` (seed dictées, homophones, reform1990) | Plain French story/word text | b | Regex scan for `\p{Extended_Pictographic}` returned no matches — clean | — |
| 63 | CSS `content:` pseudo-elements (`web/src/app.css:287`, `web/src/styles/kit.css:55`) | `content: ''` (empty, structural, not a glyph) | c | Not a visual element — no action | — |
| 64 | `web/src/components/scene/HotspotDebug.svelte:32-44` | Inline SVG debug overlay | d | Dev-only (`?debug`), never player-facing — out of scope | — |

---

## Summary

UI3a Task 4: the 35 painted icons this sweep called for have landed at `web/public/art/icons/`,
mapped by `web/src/lib/world/art.ts`'s `ART.icons` — real file names are `<id>.webp` for
gear/relic rewards (e.g. `sandales_hermes.webp`), `avatar-*.webp`, `lt-*.webp` (lieutenants),
`decor-*.webp` (the four cabin decor rewards + the fresque, `:` swapped for `-`), `add-*.webp`,
`tool-*.webp`, `seal-oracle.webp` and `lock.webp` — not the `avatar_*`/`glyph_*`/`icon_*` names
proposed below. Reward medallions (rows 26-27) and the lieutenants' five duplicated glyph tables
(rows 29-35) are wired up; avatars (row 1-7), the TopBar/tool/add-menu/mark icons (rows 8-21,
38-45) still consume `AVATAR_ICONS`/`TOOL_ICONS`/`ADD_ICONS`/`MARK_ICONS` in a later task.

**Distinct new painted icons needed (deduplicated): 21**, beyond the 8 reward icons already being
generated elsewhere. Where an existing painted asset can plausibly be cropped instead of painted
from scratch, that's noted below — but each still needs a new *icon-sized* file, so it's counted.

1. `avatar_chouette` — small painted medallion: an owl's head, warm bronze/olive palette, matching the game's painted-character style.
2. `avatar_dragon` — small painted medallion: a young dragon's head/snout, distinct from the full-body dragon character art.
3. `avatar_lyre` — small painted medallion: a bronze lyre, Greek key ornament optional.
4. `avatar_trident` — small painted medallion: a bronze trident, sea-god motif.
5. `avatar_laurier` — small painted medallion: a laurel wreath sprig, gold-green.
6. `avatar_foudre` — small painted medallion: a stylised lightning bolt, Zeus's foudre, warm gold.
7. `glyph_hydre` — small icon: a coiled hydra head with scales, olive-green.
8. `glyph_echo` — small icon: a conch shell or sound-ripple motif, aegean blue.
9. `glyph_chimere` — small icon: a chimera's head (lion mane + flame), terracotta/gold.
10. `glyph_protee` — small icon: a shifting sea-wave or shapeshifting silhouette, aegean blue.
11. `glyph_sirenes` — small icon: a feather with a musical note, violet/blue.
12. `glyph_lethe` — small icon: a misty poppy flower, muted violet-grey.
13. `icon_bouclier_persee` — small icon: a round bronze shield with a gorgon motif (or crop of `emblems/persee_cut.webp`).
14. `icon_chouette_athena` — small icon: an owl (or crop of `emblems/athena_cut.webp`); visually distinct enough from `avatar_chouette` in framing/context.
15. `icon_fil_ariane` — small icon: a spool of golden thread (or crop of `emblems/ariane_cut.webp`).
16. `icon_argus` — small icon: a many-eyed motif (or crop of `emblems/argus_cut.webp`).
17. `icon_add_text` — small icon: a quill over a parchment.
18. `icon_add_scan` — small icon: a camera over a printed sheet.
19. `icon_add_alexandria` — small icon: a stack of scrolls/a small library facade.
20. `icon_oracle_seal` — small icon: a pressed wax seal with a sun/star motif, terracotta.
21. `icon_lock` — small icon (or SVG, matching the Hud/Overlay stroke family): a simple bronze padlock, for the PIN gate and locked dragon tints.

**Rows that only need SVG or plain words (no new painted art):** rows 8, 9 (if done as SVG rather
than painted), 11 (reuse), 12 (reuse), 19, 20, 22, 41, 43/53/54 (shared checkmark), 44, 45, 46, 48,
52, 56 (obsolete: the ranks were removed in sub-project 3), 57.

**Already correct, used as the reference pattern for every SVG fix above:** `Hud.svelte`'s mute
lyre, `Overlay.svelte`'s wax-seal close button, and `Camp.svelte`'s hero-panel medallions (rows
13-15) — all inline SVG, bronze stroke, no emoji.

**Top 5 most visible gaps** (highest player-facing frequency × severity):
1. **Avatar glyphs** (`AVATAR_GLYPHS`, row 1) — 6 emoji, rendered on nearly every screen via `Avatar.svelte`/`Hud`/`TopBar`.
2. **Lieutenant glyphs** (`LIEUTENANT[*].glyph` + 4 duplicated client fallbacks, rows 29-35) — 6 emoji, rendered on the Quest Board, Oracle, Lieutenant page, Dossier, and every session's Progression Reveal.
3. **Dictation help-tool chips** (Bouclier de Persée, Chouette d'Athéna, Fil d'Ariane, rows 38-40) — 3 emoji, shown in every single dictation session, right where matching painted emblem art already exists but is unused.
4. **Legacy TopBar icons** (rows 8-12) — 5 emoji, shown on every non-hub screen, while the hub scene already has the correct SVG pattern sitting right next to it in `Camp.svelte`/`Hud.svelte`.
5. **Weekly-goal reveal leaves** (row 50) — emoji `🌿` duplicating a CSS-only element that already exists correctly one screen away, in `Camp.svelte`.
