# UI3a playability and immersion review

Reviewer: playability and immersion (Opus). Branch `scenes`, commit `0f5cfa7`. Scope: the Title
scene (gate, shields, naming ritual, PIN seal), the Library tent and its four overlays, Delphi and its
two overlays, the three `?debug` hotspot shots and the portrait rotate screen. I looked at all 20 PNGs
in `docs/reviews/ui3/` against spec §1–§3, §6 and §10, the UI1 review (`docs/reviews/ui1/playability.md`)
and `docs/reviews/ui1/carry-to-ui3.md`. The screenshots are 1:1 with CSS pixels (1180×820), so the
pixel sizes below are real iPad sizes.

**Verdict.** The three **scenes** now read as a game: the title gate at dusk with Éris's shadow, the
striped library tent and the Delphi temple are full-bleed paintings with plaques pinned to real
landmarks, a speaking owl and a speaking Pythia. That is the change the spec asked for. The
**overlays** are where the school form survives. Every overlay (naming ritual, shelves, desk, lens,
portal, Pythia, tablets) is the same cream rounded modal holding form labels, native selects, filter
pills and a grid of rounded cards with metadata chips. Tap « Tes parchemins » and you leave the tent
for a library catalogue. The scenes are ready to ship. The overlays need one more pass before UI3b
copies the same pattern into the war tent, the nest and the cabin.

Counts: **1 Critical, 14 Important, 12 Minor.**

## Findings

### 1. Critical: every overlay is the same modal form card, not an in-world object

- **Screenshots:** a03, a07, a08, a09, a10, a11, a14, a15, a16
- **What she sees:** a cream rounded rectangle with a thin bronze rule top and bottom, a Cinzel
  heading, a bronze ✕, then form rows or a 3-column grid of rounded cards with pill chips (« 10H »,
  « ≈ 136 mots », « Jamais joué », « niveau 6H », « Pas encore recopié »). The shelves, the scribe's
  desk, the bronze lens, the portal, the Pythia's three scrolls and the votive-tablet wall all look
  the same. Only the heading changes.
- **Why it hurts:** spec §2.2 says overlays are "in-world objects sliding over the dimmed scene,
  never a new form page", and §4 names the variants **scroll / codex / table**. This is exactly the
  "school application trying to be a little fun" look the redesign exists to remove. It is also the
  screen she spends the most time on: choosing a text happens in a07, not in the tent. The places
  panels still carry legacy `.card` / `.btn` / chip classes: `grep -c "btn-primary|class=\"card|pill"`
  finds 9 in `ShelvesPanel`, 8 in `LensPanel`, 7 in `PortalWorkPanel`, 5 in `TabletsPanel`,
  4 in `PortalPanel` and 3 in `PythiaPanel`.
- **Fix (code + CSS + art):**
  - Implement the three `Overlay` variants for real.
    - **scroll**: rolled wooden rods top and bottom and torn side edges, with a parchment texture
      (Krea, ≤ 150 KB WebP) instead of the flat cream fill. Use it for the naming ritual, the desk,
      the Pythia and the lens.
    - **codex**: a two-page open book with a gutter shadow. Use it for the portal/Alexandria and,
      in UI3b, the bestiary.
    - **table**: a dark wood board. Use it for the shelves and the tablets.
  - Restage the item lists as objects:
    - Shelves: each text is a **rolled scroll in a cubby**. It has a wax seal (unbroken = never
      defended, broken + laurel = defended) and a paper tag for the title.
    - Tablets: each monster is a **terracotta tablet hung on a cord**, as painted on the wall behind.
      Its medallion is pressed into the clay.
    - Pythia: three real rolled scrolls. See finding 9.
  - Replace the legacy `.card` / `.btn` / chip classes in `web/src/components/places/**` with kit
    classes (`kit-bronze`, `kit-parchment`, a new `kit-seal`, `kit-tag`). Add a vitest or lint guard
    that fails if `btn-primary` or `class="card"` appears under `components/places/`.

### 2. Important: the shelves overlay is a school library catalogue

- **Screenshot:** a07
- **What she sees:**
  - a row of eight level pills « Tous 5H 6H 7H 8H 9H 10H 11H »
  - a heading « À TON NIVEAU (10H) »
  - cards with « 10H », « ≈ 136 mots » and « Jamais joué »
  - long titles set in **Cinzel mixed case** that wrap to two lines (« Les Misérables — la poupée de
    Cosette », « Voyage au centre de la Terre — la descente »)
  - the last row cut by the panel edge
- **Why it hurts:** HarmoS grade codes and word counts are school metadata. Eight grade pills
  describe the school system, not the camp. Spec §2.7 restricts Cinzel to caps labels. Long
  mixed-case Cinzel is the hardest face in the kit to read at 20 px.
- **Fix (code + copy):**
  - Default to her level and drop the pill row. Put other levels behind one bronze « Autres
    niveaux » toggle (or a small dial on the shelf frame).
  - Show length as « court / moyen / long », or as the scroll's thickness, instead of « ≈ 136 mots ».
  - Replace « Jamais joué » with the seal state from finding 1, or with « Jamais défendu ».
  - Set text titles in Alegreya 600 at 19–20 px, and keep Cinzel for the overlay heading only.
  - Rename the heading « À ton niveau (10H) » to « Pour toi ».

### 3. Important: the naming "ritual" is a registration form

- **Screenshot:** a03
- **What she sees:**
  - a « NOUVEAU HÉROS » modal
  - labelled fields « Ton prénom », « Ton avatar », « Ton niveau » and « Un code à quatre chiffres
    (facultatif) »
  - the help lines « HarmoS, comme à l'école » and « Pour que ton frère ou ta sœur ne joue pas sur
    ton profil »
  - a native grey `<select>` (see finding 4)
  - a 240 px name field, next to a 580 px level select
  - « Ton avatar » set in a different face and weight from the other three labels (Alegreya bold,
    not Cinzel small caps)
- **Why it hurts:** spec §3 asks for a "short naming ritual". This is the first thing a new player
  does, and it reads as signing up for a school app. « comme à l'école », « facultatif » and
  « profil » are school and admin vocabulary.
- **Fix (code + copy):**
  - Stage it as forging a shield. Title: « Forge ton bouclier ».
  - Show the chosen avatar live on a big shield preview (the shield that will hang on the gate).
  - Put the name on the shield's banner, in a full-width field.
  - Keep avatars as medallions without the card boxes.
  - Show the level as a row of bronze medallions « 5H … 11H » with the caption « Ta classe ».
  - Collapse the code behind a small « Protéger ton bouclier d'un sceau » toggle, whose help line
    is « Seul toi pourras l'ouvrir. ».
  - Button: « Accrocher mon bouclier ».
  - Let the dragon egg or the owl say one line in the `DialogueBox` above the scroll, not a help
    paragraph.
  - Fix the label style so all four labels match.

### 4. Important: native `<select>` is not restyled

- **Screenshots:** a03 (« Ton niveau »), a08 (« Niveau »)
- **What she sees:** a light-grey OS select with a black caret, the only unstyled control on the
  page.
- **Why it hurts:** spec §2.4 says form elements stay real HTML but are "restyled as semi-transparent
  parchment / bronze". A grey system control is the clearest "web form" tell.
- **Fix (CSS, `kit-form`):** add `select { appearance: none; -webkit-appearance: none; background:
  var(--parchment-field) url(bronze-chevron.svg) no-repeat right 12px center / 14px; border: 1px
  solid var(--bronze-light); border-radius: 8px; font: 17px var(--font-body); color: var(--ink); }`.
  Better still, replace these two selects with the medallion row from finding 3.

### 5. Important: the scribe's desk hides its only action and speaks like a teacher

- **Screenshot:** a08
- **What she sees:**
  - « NOUVEAU PARCHEMIN », with a 240 px « Titre » field that truncates « Les fées de la
    clairière-mugri… »
  - a large textarea (good: Literata, around 19 px)
  - « 13 mots »
  - « Entre quatre-vingts et deux cents mots, nombres écrits en lettres. »
  - « Niveau » (a native select) cut at the bottom. The submit button (`DeskPanel.svelte:94`) is
    below the fold, so it isn't visible at all.
- **Why it hurts:** she types a text and can't see how to finish without discovering the scroll.
  The rule line is a teacher's instruction. « 13 mots » gives no sense of whether that is too short.
- **Fix (code + copy):**
  - Use two columns at ≥ 1000 px: the textarea on the left, and title, level and the submit button
    on the right, so the submit is always visible at 820 px height.
  - Make the title field full width.
  - Turn the counter into a quill gauge: « 13 mots · il en faut au moins 80 ». When it is in range:
    « 94 mots · parfait ».
  - Move the rule into an owl line in the dialogue box: « Hou ! Entre 80 et 200 mots, et les nombres
    en lettres, sinon Éris triche. ».
  - Name the submit « Poser sur l'étagère ».

### 6. Important: the lens overlay is a camera-app dialog

- **Screenshot:** a09
- **What she sees:** the heading « SCANNER UNE FEUILLE », an instruction paragraph in an inset
  white box (« Prends la feuille imprimée en photo… L'écriture à la main ne marche pas. ») and three
  full-width buttons. The third, « Lire le texte », is flat grey and disabled.
- **Why it hurts:** a disabled grey button is a classic form state, and "scanner" is technical
  vocabulary. The heading doesn't echo the landmark she tapped (« La lentille »).
- **Fix (code + copy):**
  - Heading: « La lentille de bronze ».
  - The instructions become the owl's line in the dialogue box.
  - Make the panel a round bronze lens frame, or a small scroll, with two bronze buttons
    (« Prendre une photo », « Choisir une photo »).
  - Don't render « Lire le texte » until at least one photo is taken. Then show it as the primary
    bronze button, « Déchiffrer ».
  - Hub caption: « Déchiffrer une feuille » instead of « Scanner une feuille ».

### 7. Important: the portal work view is an empty dead end with a legal footnote

- **Screenshot:** a11
- **What she sees:**
  - « BIBLIOTHÈQUE D'ALEXANDRIE »
  - a plain-text « Toutes les œuvres » with no arrow, about 30 px tall
  - « CONTES DE PERRAULT » followed by « Charles Perrault, Contes de Perrault », which repeats the
    title
  - « Les traducteurs et auteurs sont dans le domaine public. »
  - « Recopier depuis la Bibliothèque »
  - the eight level pills over an empty list, and « Aucun rouleau pour le moment. »
- **Why it hurts:** the empty list gives no next step, the filter filters nothing, the legal line is
  admin copy aimed at a parent, and the back link is neither recognisable nor a 44 px target.
- **Fix (code + copy):**
  - Hide the level pills while the list is empty.
  - Empty state: a scribe line with an arrow to the button, « Les scribes n'ont encore rien recopié
    de ce livre. Demande-leur ! ».
  - Back: a `kit-bronze` « ‹ Toutes les œuvres » with an SVG chevron and min-height 44 px.
  - Author line: author and translator only (« Charles Perrault », « Hans Christian Andersen, trad.
    David Soldi »).
  - Move the public-domain note to the credits (`ASSETS-LICENSES.md`, or the cabin's settings, UI3b).
  - Button: « Demander aux scribes ».

### 8. Important: the Pythia's scrolls repeat the reward four times, in low-contrast gold

- **Screenshot:** a14
- **What she sees:** « Cette semaine, ouvrir un rouleau rapporte : 150 XP · Teinte Écume » in gold
  above the scrolls, then « Récompense de la semaine : 150 XP · Teinte Écume » again in each of the
  three cards. The text is gold (about #b8892a) on cream, wrapping over two lines.
- **Why it hurts:** the same line four times is dashboard noise. UI1 finding 13 asked for darker
  bronze `#8a5a1c` reward text. That was not honoured in the new panel, and gold on cream is below
  4.5:1 at 17 px.
- **Fix (code + CSS):** keep the reward only in the header line (with the gem icon) and drop it from
  the three cards. Set the reward colour to `#8a5a1c` in both `PythiaPanel` and `TabletsPanel`
  (« Récompense : 60 XP · page du bestiaire » has the same problem in a16).

### 9. Important: the Pythia's scrolls are cards, and the école picker opens below the fold

- **Screenshots:** a14, a15
- **What she sees:** three identical cards, each with a wax seal flanked by two grey rounded pills.
  The pills are meant to be scroll rods, but they look like disabled toggles. Tapping « Ce que
  prépare ta classe » expands « Choisis le monstre : » **inside the narrow middle card**. Only
  « L'Hydre » and « Écho » are visible, the other monster chips and « Annuler » are below the panel
  edge, and the two outer cards stretch with empty space. The monster chips are about 40 px tall and
  carry the diagonal hatch texture, which reads as "disabled".
- **Why it hurts:** she broke a seal and the choice she has to make is hidden. The carry item
  « Ce que prépare ta classe » **is honoured** (good), but its picker is the least usable screen of
  the walk.
- **Fix (code + CSS + art):**
  - Draw the scrolls as scrolls: a vertical parchment roll with real rod ends, from a cut-out or a
    CSS gradient, not grey pills.
  - When a scroll opens, unroll it across the full width of the panel, replacing the three-card row.
    Lay the monsters out as a 3×2 grid of medallions (≥ 56 px) with names under them and « Annuler »
    visible.
  - Call `scrollIntoView({ block: 'nearest' })` on the picker after it opens.
  - Drop the hatch pattern from chips and pills everywhere. It is on the level pills in a07, a10 and
    a11 as well.

### 10. Important: the quest wall has three names, form plurals and a line repeated on every tablet

- **Screenshot:** a16 (plus a13, and the hub label in `camp.ts:99`)
- **What she sees:**
  - The hub says « Le tableau des quêtes », the Delphi plaque says « Le mur des quêtes » and the
    overlay heading says « LE TABLEAU DES QUÊTES ».
  - Every card ends with « Prochain trésor de cabane dans 2 quête(s) : Lanterne d'Hestia », the same
    sentence six times.
  - `TabletsPanel.svelte:177` also has « Neutralise N ruse(s) de plus ».
- **Why it hurts:** UI1 finding 6 banned the "(s)" form plural. A name that changes between the
  plaque and the overlay breaks "I opened what I tapped" (carry item 12).
- **Fix (copy + code):**
  - One name everywhere: « Le mur des quêtes », in the hub (until UI3b removes that hotspot, see the
    recommendations), the plaque and the overlay heading.
  - Add a `plural(n, 'quête', 'quêtes')` helper in `lib/` and use it at both `(s)` sites.
  - Show the cabin-treasure line **once**, under « En cours »: « Encore 2 quêtes et la Lanterne
    d'Hestia rejoint ta cabane. ».
  - Add a test that greps `components/places` and `screens` for the literals `(s)` and `(x)`.

### 11. Important: the "next step" glow is invisible

- **Screenshots:** a02, a06, a13
- **What she sees:** in the tent, « Tes parchemins » is the next step (`library.ts:18` sets
  `isNew` at 0 XP), but its plaque looks exactly like « Le pupitre », « La lentille » and « Le
  portail ». In Delphi, « La Pythie » (`isNew`, sealed scrolls) looks like « Le mur des quêtes ». At
  the gate, the door has no visible glow around the small « ENTRER » plaque.
- **Why it hurts:** carry recommendation 6 is "exactly one next-step glow". The logic is there, but
  `.hotspot-glow` rests at `opacity: 0.3` with a soft radial gradient (`Hotspot.svelte:136–142`),
  which disappears on a bright painting. She has to read all four captions to know where to go.
- **Fix (CSS, `Hotspot.svelte`):**
  - `.hotspot.is-new .hotspot-label { border-color: var(--gold-light); box-shadow: 0 0 0 2px
    rgba(241,220,154,.6), 0 0 18px rgba(255,220,140,.75); }`, plus the existing bob.
  - `.hotspot.is-new .hotspot-glow { opacity: .65 }`, with the `kit-glow` pulse between .45 and .85.
  - Keep a static gold border under reduced motion.
  - On the title, make « ENTRER » a bigger plaque (Cinzel 20 px, padding 8×20).

### 12. Important: the scene's plaques and labels show through the overlay panel

- **Screenshots:** a03, a07, a09, a11, a14, a16
- **What she sees:**
  - « LA DISCORDE », « Choisis ton héros » and « Aucun héros pour l'instant » ghost through the
    naming ritual.
  - « LA TENTE DES PARCHEMINS » sits behind « LES PARCHEMINS ».
  - « LE PUPITRE / Taper ou coller un texte » shows behind the heading and first button of the lens
    overlay.
  - « LE PORTAIL », « LA LENTILLE » and the portal glow show through the empty half of a11.
  - « LE TEMPLE DE DELPHES » and « LA PYTHIE » sit behind the Oracle's heading.
- **Why it hurts:** two layers of text at the same place compete, and at 13 she reads the ghost
  plaque as part of the panel. Transparency is welcome (spec §2.4), but legibility comes first.
- **Fix (CSS):** while an overlay is open, fade the scene's text chrome, e.g.
  `.scene-stage.has-overlay :is(.hotspot-label, .place-plaque, .kit-banner) { opacity: 0; transition:
  opacity .2s }`. Keep the painting visible through the panel. Alternatively, raise the panel fill
  to about 0.94 opacity behind text areas only.

### 13. Important: the title's shield row is a single "+" and two toast pills

- **Screenshot:** a02
- **What she sees:** after « Entrer », the gate shows a lone bronze « + » medallion with a dark
  « Nouveau héros » tag. It sits below the hooks rather than hanging from one. Two dark pills are
  stacked on the path: « Choisis ton héros » and « Aucun héros pour l'instant. Crée le tien ! ».
- **Why it hurts:** the two pills look like toast notifications and contradict each other: "choose"
  when there is nothing to choose. The shield is not *on* the gate, which is the whole idea of the
  scene (spec §3: "heroes are painted shields on the gate").
- **Fix (code + copy + CSS):**
  - With zero heroes, show one line only: « Accroche ton bouclier à la porte du camp. ». With heroes,
    show « Choisis ton bouclier ».
  - Style it as a cloth banner (the UI1 finding 7 ribbon), not a pill.
  - Align each shield so its top ring meets a painted hook: the hook rail is at y ≈ 55 % of the art,
    x 9–33 % and 66–93 %.
  - Draw the new-hero shield as a blank shield outline with a « + », not a coin.

### 14. Important: the PIN seal is a centred login card with a grammar slip and no digit cue

- **Screenshot:** a04
- **What she sees:**
  - a cream rounded card on the blurred gate
  - the painted padlock (good)
  - the plaque « CODE DE ARIANE-MUGRHXMUOKXQ0-CODE », which wraps to two lines
  - an empty 180 px box with no hint that four digits are expected and no submit button (it
    auto-submits at 4 digits, `PinGate.svelte:39`)
  - « Changer de héros » as the only button, so it looks like the main action
  - a darker band along the bottom edge (blur edge halo)
- **Why it hurts:**
  - « Code de Ariane » is wrong French: it needs elision, « d'Ariane ».
  - She sees one bronze button and may press it, taking her back to the gate.
  - An unlabelled box gives no feedback until the fourth digit.
- **Fix (code + copy + CSS):**
  - Plaque: « Le sceau d'Ariane », with a `de()` helper that elides before a vowel or mute h.
  - Four wax-seal slots that fill as digits arrive; keep the real `<input>` visually hidden over
    them.
  - Caption « Tes quatre chiffres » under the slots.
  - Make « Changer de héros » a small text link under the seal, not the bronze button.
  - Fix the halo with `inset: -16px` on `.pin-backdrop`.

### 15. Important: overlay titles don't echo the landmark tapped (carry item 12)

- **Screenshots:** a07, a09, a10, a14, a16
- **What she sees:** « Tes parchemins » opens « Les parchemins ». « La lentille » opens « Scanner
  une feuille ». « Le portail » opens « Bibliothèque d'Alexandrie ». « La Pythie » opens « L'Oracle
  de Delphes ». « Le mur des quêtes » opens « Le tableau des quêtes ». Hub to scene is fine:
  « La tente des parchemins » opens « La tente des parchemins », and « Le chemin de Delphes » opens
  « Le temple de Delphes », which is acceptable because the path leads to the temple.
- **Why it hurts:** the carry item was honoured one level up (hub to scene) but not one level down
  (scene to overlay).
- **Fix (copy):**
  - « Tes parchemins »
  - « La lentille de bronze »
  - « Le portail d'Alexandrie » (the banner image already says where it leads)
  - « La Pythie »
  - « Le mur des quêtes »

### 16. Minor: the « Le mur des quêtes » plaque sits on the altar, above the prophecy card

- **Screenshots:** a13, d03
- **What she sees:** the tablets hotspot is the wall (d03, dashed rectangle y ≈ 23–56 %). Its plaque
  hangs **below** it, among the vases on the altar, about 40 px above the prophecy card. It reads as
  the title of the altar card. The bottom row of tablets (y ≈ 51–58 %) is also partly outside the
  hotspot.
- **Fix (data, `delphi.ts` / `delphi.shapes.ts`):** `labelPos: 'above'`, so the plaque sits at the
  top of the wall between the two top laurel sprigs (y ≈ 17 %). Extend the rectangle's bottom edge to
  about 59 %. The other pinned labels are well anchored, which honours carry item 17. See "What
  works".

### 17. Minor: the altar prophecy card has small print

- **Screenshots:** a12, a13
- **What she sees:** « La Pythie a vu ton épreuve, dans 3 jours : » at 13 px italic
  (`ProphecyCard.svelte:44`) and the title at 14–15 px, on a pale card over a bright altar.
- **Fix (CSS):** lead at 15 px, title at 17 px Alegreya 600, and let the card grow to about 380 px
  wide. Consider « Te préparer » instead of « Réviser », which is school vocabulary. The dragon or
  Pythia voice fits better.

### 18. Minor: « Réviser » is underlined in the Oracle overlay

- **Screenshots:** a14, a15
- **What she sees:** the button text is underlined like a link, unlike the same button on the altar
  (a13).
- **Cause:** `PythiaPanel.svelte:155` still renders the legacy `<a class="btn btn-primary">`.
- **Fix (code):** use `kit-bronze` (which sets `text-decoration: none`, `kit.css:91`), or reuse
  `ProphecyCard` itself inside the panel.

### 19. Minor: mechanic-speak and administrative dates in the Oracle

- **Screenshot:** a14
- **What she sees:** « Révise-la avant le jour dit : l'XP est multipliée par 1,5 » and « — le
  28.09.2026 · dans 3 jours ».
- **Fix (copy):** « Défends-la avant le jour dit et la Pythie doublera presque ta gloire (+50 %
  XP). » and « jeudi 28 septembre · dans 3 jours ». Use `toLocaleDateString('fr-CH', { weekday:
  'long', day: 'numeric', month: 'long' })`.

### 20. Minor: library captions in technical and school register, and one plaque without an icon

- **Screenshot:** a06
- **What she sees:** « Taper ou coller un texte », « Scanner une feuille » and « Des textes
  classiques ». « Tes parchemins » has no icon, while the other three plaques do. The portal's icon
  reads as gold nuggets at 26 px.
- **Fix (copy + art):**
  - Captions: « Écrire un nouveau parchemin », « Déchiffrer une feuille » and « Les livres
    d'Alexandrie ».
  - Give « Tes parchemins » the scroll icon from `web/public/art/icons/`, and use an arch or key
    icon for the portal.

### 21. Minor: overlays cover the HUD half-way

- **Screenshots:** a07, a10, a15, a16
- **What she sees:** the panel starts at y ≈ 33 px, so the hero pill is cut to « A… », and the
  dragon and lyre medallions are half hidden behind the panel's top rule.
- **Fix (CSS, `Overlay.svelte`):** `top: calc(var(--hud-band) + 8px); max-height: calc(100% -
  var(--hud-band) - 24px)`, or fade the HUD to 0 while an overlay is open. The panel's ✕ is the only
  control that matters then.

### 22. Minor: the Pythia's greeting addresses her in the masculine

- **Screenshot:** a12
- **What she sees:** « Approche, héros. Trois rouleaux scellés t'attendent cette semaine. » The
  caption « Trois rouleaux scellés » is still cryptic, as UI1 noted.
- **Fix (copy, `content/dialogue`):** profiles have no gender, so use a neutral form: « Approche.
  Trois rouleaux scellés t'attendent cette semaine. ». Caption: « Trois prophéties à ouvrir ».

### 23. Minor: the library owl is scenery, not a speaker you can tap

- **Screenshot:** a06
- **What she sees:** the owl cut-out sits on its pedestal, but it isn't a hotspot. The Pythia is.
- **Fix (data):** add an `owl` hotspot (no label, 56 px minimum) that replays a random owl hint line.
  Do the same for the dragon in UI3b.

### 24. Minor: the portal cards repeat the title in the author line

- **Screenshot:** a10
- **What she sees:** « Contes de Perrault / Charles Perrault, Contes de Perrault », « Alice au pays
  des merveilles / Lewis Carroll, Alice au pays des merveilles, trad. Henri Bué ». The level chip
  reads « niveau 6H ».
- **Fix (code):** drop the work title from the byline when it equals the heading, and show the level
  as the same bronze medallion as in finding 3.

### 25. Minor: small tap targets inside overlays

- **Screenshots:** a11, a15
- **What she sees:** « Toutes les œuvres » is about 30 px tall, and the monster chips are about 40 px.
- **Fix (CSS):** `min-height: 48px` on every interactive element in `components/places/**`. Extend
  the existing e2e tap-target check to overlays.

### 26. Minor: the walk uses random-suffixed names, which hides real truncation

- **Screenshots:** all
- **What she sees:** « Ariane-mugrhxmuokxq0 » and « La dictée du jeudi-mugrianwxn4by » everywhere.
  The PIN plaque wrap (finding 14) and the HUD width can't be judged against a real long name
  (« Anne-Charlotte », accented).
- **Fix (test, `playability-ui3.spec.ts`):** delete any existing « Anne-Charlotte » profile via the
  API at the start of the walk, then create it by that name. Use a realistic title, and delete the
  text first.

### 27. Minor: the rotate screen icon is a static outline

- **Screenshot:** portrait-a01
- **What she sees:** UI1 finding 15 is mostly honoured: the gate art sits blurred and dimmed behind
  a marble plaque « TOURNE TON IPAD », with « Le camp se découvre à l'horizontale. ». The iPad icon
  is a plain rounded outline and doesn't rotate in the still.
- **Fix (CSS):** check that the 90° turn animation (fade under reduced motion) actually runs, and
  draw a home-button dot or camera notch so it reads as a tablet, not an empty frame.

## What works

- **The three scenes are real game screens.** The gate at dusk with Éris's giant shadow holding the
  apple is a strong, readable opening image. The striped library tent and the sunlit Delphi temple
  have clear, distinct landmarks, and nothing in them looks like a web page.
- **Carry item 17 is honoured:** plaques are pinned to their landmarks with a bronze leader and a
  gold pin. The debug shots (d01–d03) show generous hotspots that match the painted objects: the
  door arch, the bookcase, the desk, the lens ellipse, the portal arch, the Pythia's tripod and the
  tablet wall. Every hotspot is far above 48 px. No label enters the HUD band or the dialogue dock.
- **Speakers in their places.** The owl (a05) and the Pythia (a12) greet in the same dialogue box as
  the dragon, with a matching crop of the scene cut-out as portrait. The lines are short, warm and in
  character (« Hou ! Tes parchemins dorment sur les étagères. »). The UI1 advance/skip confusion is
  fixed: a large caret, and « Tout passer ».
- **Carry item 13 is honoured:** « Ce que prépare ta classe » is the scroll title, and the prophecy
  sits on the altar as the Pythia's words, with no « dictée » and no « jour(s) ».
- **Hub-to-scene titles echo** (« La tente des parchemins »). The scene exit « ‹ LE CAMP » is a
  clear bronze button in the same corner in both places.
- **UI1 HUD items are fixed:** the lyre SVG replaces the speaker emoji, the long hero name fits the
  pill, and the rotate screen now shows the art. No emoji is visible anywhere in the 20 shots; the
  padlock is the painted icon.
- **Consistency between places:** the same marble plaque, dark label plates, bronze exit and dialogue
  dock in the tent and the temple, so the second place teaches nothing new about controls.
- **Literata in the desk textarea** (a08) is large and clear. The texts she types or pastes are
  set in the face meant for them.
- **Tone:** nothing shames. The pun « dés-accords d'Éris », « Briser le sceau » and « Défier un
  monstre » have game energy.

## Recommendations for UI3b

1. **Build the overlay variants first** (finding 1): scroll, codex and table, with the list-as-objects
   pattern (scroll cubbies, terracotta tablets, codex pages). Retrofit UI3a's six panels before
   writing the war tent, nest and cabin. Otherwise the bestiary codex, the journal and the trophy
   shelf will be card grids too.
2. **Retire the legacy UI classes under `components/places/`** (`.card`, `.btn`, hatched chips), and
   add a guard test so new panels can only use kit classes.
3. **Finish the hub remap** from `carry-to-ui3.md`, which is still open: the hub still defines eight
   places, including « Le tableau des quêtes » and « Le bestiaire » (`camp.ts:99`, `camp.ts:129`).
   Drop both, move their badges onto the Delphi and war-tent plaques, show captions only for places
   with news, and seat the dragon in the painted nest.
4. **Move the hero panel into the cabin** (carry item 4) as the lamp-and-lyre, journal and trophy
   objects. Put the public-domain and asset credits in the cabin too (finding 7).
5. **One visible next-step glow per scene** (finding 11), driven by a single `nextStep(camp)`
   function shared by the hub and the places, so the hub and the place agree on where to go.
6. **Title rule for all places:** plaque = overlay heading = hub label wherever they name the same
   thing (findings 10, 15). Add a unit test that compares scene hotspot labels with overlay titles.
7. **Add the locked-place walk and e2e step** (carry item 16 / M9) as soon as the first locked
   hotspot exists (Alexandria portal or war-tent lieutenant).
8. **Clear the form plurals in legacy screens UI4 will stage:** `Results.svelte:196` (« nouveau(x)
   piège(s) »), with the same `plural()` helper as finding 10.
9. **Characters instead of help paragraphs:** every instruction line in a panel (desk rule, lens photo
   advice, Oracle XP rule, PIN hint) should be spoken by the place's character in the dialogue box, as
   spec §8 asks for first-visit tours.
