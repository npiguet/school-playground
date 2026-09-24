# UI1 playability and immersion review

Reviewer: playability and immersion. Branch `scenes`, commit `78ccf57`. Scope: the Camp hub scene
(still on the old `camp.webp`), the HUD, dialogue, hero panel, rotate screen, and the jump from the
hub into the old-UI screens. I reviewed all 17 PNGs in `docs/reviews/ui1/` against spec §1, §3, §4
and §6, and against `hub_camp.webp` and its landmark map in `docs/art/scenes.md`.

**Verdict.** The Camp now reads as a game screen, not a form. The full-bleed painting, the dark
plaques with Cinzel labels, the marble "LE CAMP" plaque, the egg or dragon in the nest and the
dialogue box all belong to the world. What still feels like a school form is the **onboarding card**,
the **hero panel**, a few **captions** ("0 / 3 textes", "2 trésor(s)") and the **hard cut** into the
old screens. Nothing blocks UI1. One clipping defect and one clarity gap ("where do I play?") should
be fixed before she gets it.

## Findings

| # | Severity | Screenshot(s) | Finding | Concrete fix |
|---|---|---|---|---|
| 1 | **Important** | 01–08, 13, 14 (iPad) | **"LE CHEMIN DE DELPHES" is clipped at the left edge.** Its plaque starts at x = 0, so the left border and the "L" sit against the bezel. Its caption box is cut too. The debug shot (14) shows the label sticking out of the 4:3 safe zone (dashed line at x ≈ 43 px). On the laptop (15) it is fine. | Clamp every label plaque inside the safe zone: `left = clamp(safeLeft + 8px, anchor − w/2, safeRight − w − 8px)`, with the same rule for the right edge. Add an e2e assertion that each `hotspot-label` bounding box sits inside the safe-zone rect at 1180×820. |
| 2 | **Important** | 02–08 | **No obvious "play" place.** A new player sees seven places, but none of them says "this is where you fight a dictation". The core loop lives in "La tente des parchemins", which is the only big place **without a caption**. "Trois rouleaux scellés" and "les vrais mythes" are cryptic. At 13 she will guess, but the hub should point at the next action the way gacha hubs do. | Give the parchemins place an action caption such as "Choisis un texte à défendre", and give it the `is-new` glow while `texts_played == 0`. End the greeting dialogue with a pointer line from the dragon, e.g. "Les parchemins t'attendent, sous la tente." Once the prophecy column exists, it also points there. |
| 3 | **Important** | 01 | **The onboarding card is the most "school app" element left.** It is a cream rounded rectangle centred on a dimmed scene, with a plain-text "Passer" and a flat terracotta "Suivant" pill. It is also the first thing she sees. The flat terracotta button style is the old UI kit's, not the bronze kit's. | Stage onboarding through the `DialogueBox`, spoken by the egg, the owl or a Muse, with the same bronze "Passer" button. It becomes a sequence of lines rather than a modal. If it stays a panel, use the parchment kit with torn edges and the `kit-bronze` button, and drop the dim overlay to about 30 % so the camp stays visible. |
| 4 | **Important** | 06 | **The hero panel is a menu of three stacked buttons** ("Réglages", "Progrès", "Changer de héros") under a title and a "Fermer" button. It looks like a settings dialog. The owl avatar sits on a flat pale-blue disc (also in the HUD), which reads as clip art. "Progrès" sounds like a school report. | Short term: turn the buttons into a row of medallion icons with small captions (lyre = "Réglages", journal = "Ton journal", shield = "Changer de héros"). Replace "Fermer" with a ✕ seal or a tap outside. Give the avatar a bronze ring instead of the blue disc. UI3: these move into the cabin scene anyway (spec §3). Keep the panel only as a shortcut. |
| 5 | **Important** | 07, 08, 13, 14 | **The gold "1" badge is ambiguous.** It sits on the columns, between "Le tableau des quêtes" (above) and "Le sentier de la bataille" (right). The debug shot shows that it belongs to the quests hotspot, but its label is 40 px away and the battle label is closer. She will probably tap the battle. | Attach the badge to the label plaque (top-right corner of "Le tableau des quêtes"), not to the hotspot shape. Rule: badges always live on the plaque they count for. |
| 6 | Minor | all hub shots | **Captions with form grammar:** "Objectif de la semaine : 0 / 3 textes", "2 trésor(s)", "0 / 6 ruses neutralisées · les vrais mythes". The "(s)" plural and the "x / y" counts read like a dashboard. | Pluralise properly ("1 trésor", "2 trésors", "Aucun trésor encore"). For the banner, use something in-world: "Cette semaine : 0 / 3 parchemins défendus", with three laurel leaves that fill in instead of the numbers, or next to them. Shorten the bestiary caption to "2 ruses d'Éris déjouées" and drop "les vrais mythes" from the hub (that belongs inside the codex). |
| 7 | Minor | 01–08 | **The weekly-goal banner is off-centre.** It sits left of the "LE CAMP" plaque (x ≈ 255–620 px while the plaque is centred at 590 px), so the top of the screen looks unbalanced. Its dark translucent pill is also a different kit from the marble plaque. | Centre it under the plaque. Make it a cloth or ribbon banner (CSS: a darker strip with notched ends) or a small parchment strip, so it does not look like a toast notification. On the new art, place it in the open sky at x 40–65, y 8–18. |
| 8 | Minor | 01–08 | **The XP laurel is hard to read.** The ten grey pips on a pink sky are low-contrast, and at 872 XP only one is filled, so it feels like no progress. "Recrue du camp · 0 XP" is fine. | Put the title and laurel on a subtle dark scrim (like the label plaques), and use gold leaves with a dim bronze outline for the empty ones. Check that the leaf fill reflects the progress toward the *next* rank, not overall progress. |
| 9 | Minor | all hub shots | **HUD audio toggle is a 🔊 emoji.** It is the only emoji on the hub (the old screens are full of them, e.g. 📊 ⚙️ 🔄). | Use an inline SVG lyre or horn in bronze, matching the dragon medallion next to it. |
| 10 | Minor | 01–08 | **The hero name is truncated in the HUD** ("ARIANE-IPAD-LA…"). This is a test name, but real names such as "Anne-Charlotte" will be cut too, and Cinzel all-caps is wide. | Let the pill grow to about 260 px, or show the name in Alegreya small caps, which is narrower. |
| 11 | Minor | 02, 03, 07 | **The dialogue box is good, but it has two advance affordances.** The tiny "▸" caret sits right next to a large "PASSER" button, so it is unclear whether tapping the box goes to the next line or skips everything. | Make the caret bigger and animate it (a gentle bob, or a fade under reduced motion). Rename the button to "Tout passer", or make it a small text link, so the difference from "next" is clear. |
| 12 | Minor | 09–12 | **The jump from the hub into the old screens is a hard cut.** You go from a full-bleed painting to a beige page with a top nav bar, white cards, emoji and terracotta pills. The destination titles differ from the place names ("La tente des parchemins" → "Les Parchemins", "La tente de guerre" → "Le dossier d'Éris"), so it doesn't feel like entering the place you tapped. The "Ta cabane" banner shows the camp fire, not a cabin. | UI1: run `SceneTransition` (a fade through dark parchment) on every hub exit, and make each destination's title echo the hub label. Also rename the nav's "Camp" link to "← Retour au camp". UI3/UI4 replace these screens with scenes. |
| 13 | Minor | 10 | **Delphi wording and contrast (old screen, carried into UI3):** the "Ce qui arrive à l'école" scroll is school-like, and the gold "Récompense de la semaine" text on cream is low contrast. | Rename it to "Ce que prépare ta classe" or "La prophétie de l'école" (only if it stays true to the mechanic). Use a darker bronze (#8a5a1c) for the reward text. |
| 14 | Minor | 16 | **Ultrawide:** the blurred side bars work, but the HUD (hero pill, dragon medallion, sound toggle) is pinned to the *window* corners, over the blur, far from the stage. | Anchor the HUD to the 16:9 stage rectangle (or the safe-zone rectangle), not to the viewport, once the viewport is wider than 16:9. |
| 15 | Minor | 17 (portrait) | **The rotate screen is clean and well-worded** ("Tourne ton iPad" plaque, "Le camp se découvre à l'horizontale."). It is flat black, though, and the phone icon is static in the shot. | Put the camp art behind it, blurred and darkened to about 25 %, so it stays in-world. Animate the icon rotating 90° (a fade under reduced motion). |
| 16 | Minor | none | **Not covered by the walk:** the prophecy column with « Réviser », and a locked place. The prophecy copy in `Camp.svelte` reads "dictée le … (dans N jour(s))", which is school vocabulary and form plural in one line. | Add a walk step with a prophecy. Reword it to "La Pythie a vu ta prochaine épreuve : *{titre}*, dans 3 jours", with a proper plural. |
| 17 | Minor | 01–08, 14 | **Labels float over sky and sea.** "Le tableau des quêtes" and "Le sentier de la bataille" hang over the water, detached from their buildings, and some labels overlap roof lines. Most of this comes from the placeholder art (house ≠ tent, temple island = battle). | Accept it for UI1. In UI3, anchor each label to its landmark with a short leader line or a small pin. |

Checked and fine: nothing sits under the HUD or under the dialogue box. The dialogue box never covers
a label (the nearest one, "Ta cabane", clears it). Reduced motion (13) looks identical to the
normal state, as it should for a still shot. No red anywhere on the hub. No guilt wording.

## What works

- **Full-bleed painted hub.** No cards, no grid. Everything tappable is a place with a name. This is
  the change her father asked for, and on the iPad shots (04, 08) it really looks like a game hub.
- **Label plaques.** Dark translucent plates with Cinzel small caps and an Alegreya italic caption
  are readable over every part of the painting, including the bright sky. The captions give each
  place a live state ("Braise · Curieux", "Combat 1 : Sandales d'Hermès").
- **The dragon is alive in the scene.** The egg in the nest (01–05) and Braise hatched in the shell
  (07, 08) give it an emotional anchor. The HUD medallion follows the dragon's stage.
- **Dialogue box.** It is the best element: a parchment strip with a portrait, Literata body text,
  a bronze button, and short, warm lines in the right voice ("L'œuf frémit chaque fois qu'un piège
  d'Éris est déjoué.").
- **The marble "LE CAMP" plaque and the bronze kit buttons** (Passer, Fermer) match the style guide.
- **Tone.** The French is natural and not babyish. Éris is the antagonist, and nothing blames the player.
- **Laptop (15)** shows the whole 16:9 composition without clipping. **Ultrawide (16)** handles the
  extra width gracefully with blurred bars instead of stretching.
- **The hotspot debug overlay (14)** is a useful tool. It confirms the hotspots are generous ellipses on the
  actual buildings, and big enough for a finger.

## Recommendations for UI3 (real hub art)

1. **Re-map the places to `hub_camp.webp`'s landmarks** in `docs/art/scenes.md`, and keep the names
   literal to what she sees: the striped pavilion *is* "La tente des parchemins", and the wooden arch
   toward the storm *is* "Le sentier de la bataille". The label mismatch in finding 17 then goes away.
2. **The bestiary has no landmark in the new art** (the six are nest, Delphi, library, war tent,
   battle path, cabin). The codex lives in the war tent (spec §3). Drop the separate hub hotspot or
   turn it into a badge on the war tent. The same goes for **"Le tableau des quêtes"**: the new art
   has no quest board, and spec §3 puts the votive-tablet wall inside Delphi, so its badge moves
   onto the Delphi plaque. That takes the hub from eight labels to six, and it also resolves
   finding 5.
3. **Clip the edge landmarks as the map says.** Nest to x 12.5–25, cabin to x 76–87.5 / y 54–78.
   Apply the label clamp from finding 1, since both of these are edge landmarks again.
   The new art's upper stairs climb to the temple (x 21–38), and the library tent sits just below
   them. Keep the Delphi label up near the temple and the parchemins label under the tent, so the
   two never stack.
4. **Weekly banner in the open sky** (x 40–65, y 8–18), centred under the plaque, as a cloth banner.
5. **Fewer words at rest.** Show label and caption for at most the 2–3 places with news (new, badge,
   ready boss). The others show only the label, with the caption on focus or hover.
6. **Highlight the next step.** Give exactly one place the "new" glow and a dragon line pointing to
   it (see finding 2). The storm on the right makes a natural pull toward "Le sentier de la bataille"
   when a boss is ready.
7. **Place the dragon cut-out in the painted nest** at about (17, 50), so the nest and the dragon
   read as one object, and use the same crop for the dialogue portrait.
8. **Replace the hub exits with scene transitions** into the new Library, Delphi, War-tent and Cabin
   scenes, and retire the old top nav bar with its emoji. The HUD becomes the only chrome.
9. **Budget check:** the new `hub_camp.webp` is well under 600 KB. Preload the library and Delphi
   scenes from the hub, since those are her most likely next taps.
