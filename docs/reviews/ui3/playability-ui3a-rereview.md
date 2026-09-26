# UI3a playability and immersion re-review (after the immersion wave)

Reviewer: playability and immersion (Opus). Branch `scenes`, commit `7ddf49f`. I looked at all 25 PNGs
now in `docs/reviews/ui3/` (a01 to a16 with the new a03b, a04b, a06b, a07b and a09b, d01 to d03, and
portrait-a01). I compared them with the review at `0f5cfa7` (`playability-ui3a.md`) and the wave plan
(`docs/superpowers/plans/2026-09-25-ui3a-immersion-wave.md`, including its findings-to-tasks table and
Deferred table). I read the spec (§1 to §3, §6, §10) as binding. The shots are 1:1 with CSS pixels
(1180×820), so the sizes below are real iPad sizes.

**Short answer.** The wave did what it set out to do. The overlays are now objects: the scroll has
rods and torn edges, the shelves and the quest wall sit on a dark wood board, and Alexandria is an
open codex. The characters speak inside the panels, and the grade pills, native selects, hatched chips
and form plurals are gone. What still reads as "form" is small and local. There are small-caps field
labels above inputs (a03, a08), and repeated metadata lines on list items (a07, a10). The panels are
laid out as documents, with section headings and an empty state (a14, a16). Two first-glance problems
matter more than the rest: the Pythia's scrolls fall below the fold (a14), and the heroes' names on
the gate are set at 11 px with a « 10H » under each (a04b).

Counts: **25 FIXED, 2 PARTLY, 0 NOT FIXED, 0 fully DEFERRED.** Five fixed findings have a part
deferred to UI3b, as the plan says. New findings: **0 Critical, 4 Important, 12 Minor.**

## 1. Verdict on the 27 original findings

| # | Sev. | Finding | Verdict | Evidence |
|---|---|---|---|---|
| 1 | C | Every overlay is the same modal form card | FIXED (bestiary codex DEFERRED to UI3b Task 3: the bestiary is still a legacy screen) | The scroll variant in a03, a08, a09 and a14. The table variant in a07 and a16. The codex in a10 and a11. `placesKit.test.ts` has an empty `PENDING` set. |
| 2 | I | The shelves are a school catalogue | FIXED | a07: the pill row is gone, the heading is « Pour toi », titles are in Alegreya, and cards say « moyen / long » and « Jamais défendu ». Other classes are behind a toggle (a07b). See N2 for what remains. |
| 3 | I | The naming ritual is a registration form | FIXED | a03: « Forge ton bouclier », a live shield preview with the name banner, emblem and class medallions, the owl's line, the seal behind a toggle (a03b) and « Accrocher mon bouclier ». The flagged residue is in N3 and N5. |
| 4 | I | Native `<select>` | FIXED | a03 and a08: medallion radios. No select is visible anywhere. |
| 5 | I | The desk hides its submit and sounds like a teacher | FIXED | a08: two columns, « Poser sur l'étagère » in view, a full-width title, the gauge « 13 mots · il en faut au moins 80 », and the rule spoken by the owl. See N7. |
| 6 | I | The lens is a camera-app dialog | FIXED | a09: « La lentille de bronze », the owl's advice, and a round lens frame. a09b: « Déchiffrer » appears only after a photo is taken. The caption is « Déchiffrer une feuille » (a06). |
| 7 | I | The portal work view is a dead end with a legal footnote | FIXED (credits in the cabin DEFERRED to UI3b Task 6; `ASSETS-LICENSES.md` has them now) | a11: a 48 px bronze « ‹ Toutes les œuvres », the byline « Charles Perrault », « Demander aux scribes », the scribes' empty-state line, no pills and no legal line. |
| 8 | I | The Pythia's reward appears four times, in gold on cream | FIXED | a14: one line with the gem, in dark reward ink. The scrolls carry no reward text. |
| 9 | I | The Pythia's scrolls are cards, the picker opens below the fold, hatched chips | FIXED | a14: upright rolled scrolls with wax seals. a15: the scroll unrolls full width into a 3×2 medallion grid, with « Annuler » visible. No hatching anywhere. See N1 and N12. |
| 10 | I | Three names for the quest wall, « (s) », a line repeated six times | FIXED (removing the hub's own hotspot is DEFERRED to UI3b Task 7) | a13 and a16: « Le mur des quêtes » on both. The treasure line appears once: « Encore 2 quêtes avant le prochain trésor de ta cabane : Lanterne d'Hestia. » |
| 11 | I | The next-step glow is invisible | FIXED (a shared `nextStep(camp)` is DEFERRED to UI3b Task 7) | a06: a gold border on « Tes parchemins » only. a13: on « La Pythie » only. a01: a larger « ENTRER » plaque and a lit door. |
| 12 | I | Scene plaques show through overlays | FIXED | a07, a09, a10, a14 and a16: no scene plaque or caption shows through a panel. |
| 13 | I | The title's shield row: a coin and two toast pills | PARTLY | a02: one cloth ribbon, « Accroche ton bouclier à la porte du camp. ». a04b: « Choisis ton bouclier », and the shields hang from painted hooks. But the new-hero shield is still a round, washed-out, dashed coin that looks disabled, not a blank shield outline. See N4. |
| 14 | I | The PIN seal: a login card, « Code de Ariane », no digit cue | FIXED | a04: « Le sceau d'Élise-Marguerite », four wax slots that fill, « Tes quatre chiffres », « Changer de héros » as a text link, and no edge halo. |
| 15 | I | Overlay titles don't echo the landmark | FIXED | a07 « Tes parchemins », a09 « La lentille de bronze », a10 « Le portail d'Alexandrie », a14 « La Pythie », a16 « Le mur des quêtes ». |
| 16 | M | The tablets' plaque sits on the altar | FIXED | a13 and d03: the plaque is above the wall, and the rectangle covers the bottom row. |
| 17 | M | Small print on the altar card | FIXED | a13: the lead is 15 px, the title 17 px/600, the card about 380 px, and the button says « Te préparer ». There is one small wrap left (N16). |
| 18 | M | « Réviser » is underlined | FIXED | a14: a bronze « Te préparer » with no underline. |
| 19 | M | Mechanic-speak and administrative dates | PARTLY | a14: the date now reads « lundi 28 septembre · dans 2 jours ». The rule is still arithmetic: « une fois et demie plus de gloire (+50 % XP) ». See N6. |
| 20 | M | Technical captions, a plaque without an icon | FIXED | a06: « Écrire un nouveau parchemin », « Déchiffrer une feuille », « Les livres d'Alexandrie ». All four plaques have icons, and the portal's is an arch. |
| 21 | M | Overlays cover the HUD | FIXED | a07, a08 and a16: every panel starts below the 64 px HUD band. The hero pill and the two medallions stay whole (dimmed). |
| 22 | M | The Pythia uses the masculine vocative | FIXED | a12: « Approche. Trois rouleaux scellés t'attendent cette semaine. » The caption is « Trois rouleaux à ouvrir ». |
| 23 | M | The owl is scenery | FIXED (the same for the dragon is DEFERRED to UI3b Task 7) | d02: a `library-owl` hotspot. a06b: the owl speaks a new hint. |
| 24 | M | The portal byline repeats the title | FIXED | a10: « Charles Perrault », « Lewis Carroll, trad. Henri Bué », with bronze class medallions. |
| 25 | M | Small tap targets inside overlays | FIXED | a11: the back button is 48 px. a15: the monster tiles are about 120 px. The class medallions are about 56 px. The emblem choices are 64 px wide with their label (the icon is small, see N3). |
| 26 | M | The walk uses random-suffixed names | FIXED | a03, a04 and a04b use « Anne-Charlotte », « Élise-Marguerite » and « La dictée du jeudi ». |
| 27 | M | The rotate icon is a static outline | FIXED | portrait-a01: a tablet with a camera dot and a home button. `RotateScreen.svelte` has `rotate-hint` keyframes and a reduced-motion pulse. |

## 2. New findings

### N1. Important: the Pythia's three scrolls fall below the fold

- **Screenshot:** a14.
- **What she sees:** she taps « La Pythie · Trois rouleaux à ouvrir » (the next step, glowing). The
  panel opens on the Pythia's line about the scrolls. Then comes a « PROPHÉTIES » heading, a
  two-line rule paragraph, the prophecy strip (the same one as on the altar), and a second heading,
  « LES TROIS ROULEAUX », with the reward line. The three scrolls start at y ≈ 630 px and the bottom
  rod cuts them. Their seals are barely visible, and their titles (« Ce que prépare ta classe »…)
  can't be seen at all.
- **Why it hurts:** the thing she was sent here to do is the one thing she can't see. The Pythia
  says « Choisis celui qui t'appelle » over a document of headings. This happens because
  `prophecyFirst` (`PythiaPanel.svelte:94`) moves the prophecies up whenever one is due within 7
  days, which will be most weeks.
- **Fix (code + CSS + copy):**
  - Delete the « Prophéties » `<h3>` and the rule paragraph (`PythiaPanel.svelte:168–169`). The
    bonus moves onto the strip as a tag (see N6).
  - While `oracle.status !== 'chosen'`, render the scrolls first whatever the prophecies say, and
    put the prophecy strip under them. The altar already shows the nearest prophecy on the scene.
    Keep `prophecyFirst` only for the chosen state.
  - Cap the roll height (e.g. `.oracle-roll { height: clamp(140px, 22vh, 180px) }`), so that the
    three scrolls and their title tags fit above the bottom rod at 820 px.
  - Add an e2e assertion that the three `scroll-<key>` elements are fully inside the overlay's
    viewport at 1180×820 when a prophecy is due within 7 days.

### N2. Important: the shelf tags cut titles mid-word and repeat the same metadata on every scroll

- **Screenshots:** a07, a07b.
- **What she sees:** « Les Trois Mousquetaires — l… », « Voyage au centre de la Terre — la… »,
  « Le Petit Chaperon rouge — la… ». These are chapter titles, and the part that tells two chapters
  of one book apart is exactly the part that is cut (`kit-objects.css:153`, a 2-line clamp). Every
  tag also ends with « parchemin moyen · Jamais défendu » or « parchemin long · Jamais défendu »,
  wrapping over two lines. The word « parchemin » repeats what the object already shows. « Jamais
  défendu » repeats what the unbroken wax seal already says.
- **Why it hurts:** this is the screen she chooses from every session. A catalogue line under every
  item is the last trace of the "library catalogue" look. Truncated titles make her open scrolls to
  find out which one is which.
- **Fix (code + CSS):**
  - Split the title at « — » into the book, in Alegreya 600 at 19 px, and the chapter, in Alegreya
    italic at 16 px on its own line. Clamp each at 2 lines, which in practice never cuts.
  - Drop the word « parchemin ». Show the length as the roll's thickness (`--roll-scale: .85 / 1 /
    1.15` for court / moyen / long), and keep « court / moyen / long » only in the `aria-label`.
  - Show the history line only once the text has been defended (« Défendu 2 fois · 85 % des pièges
    déjoués »). For a text never defended, the unbroken seal is the message.
  - The tag then holds a title, a chapter and an author, and fits without the bottom row being
    half-cut.

### N3. Important: the emblem (the fun, personal choice) is the smallest thing on the ritual scroll (flagged)

- **Screenshot:** a03 (and a03b).
- **What she sees:** six 32 px emblems (`HeroForm.svelte:84`, `size={32}`) above seven 56 px class
  medallions. At 32 px the lyre, the trident and the thunderbolt are dark smudges on a bronze ring.
  She can only tell them apart by their captions, or by watching the big shield preview.
- **Why it hurts:** the emblem is how she recognises herself on the gate. The class is admin data.
  The sizes send the opposite message, and it is the first screen she ever fills in.
- **Fix (code):** `<Avatar avatar={a} size={60} ring />`, with `.avatar-choice { min-width: 84px }`.
  Six across is about 540 px, which fits the 720 px column. Keep the class row at 48 to 52 px
  (`LevelMedallions` with a `size="sm"` prop) so the class reads as secondary. The selected emblem
  keeps its gold ring.

### N4. Important: the heroes' names on the gate are 11 px, wrapped, with a school code under them (the real-names check)

- **Screenshots:** a04b, a02.
- **What she sees:** the shields hang from the hooks (good). Under each one is a dark plate:
  « Élise- / Marguerite / 10H » and « Anne- / Charlotte / 10H ». Even the ordinary « Anne-Charlotte »
  breaks at its hyphen, because the plate is only as wide as the 64 px shield. The name is 11 px
  (`Title.svelte:240`). The « 10H » (12 px, `Title.svelte:243`) is a HarmoS code on the camp gate,
  the one piece of school vocabulary left on a scene. The « Nouveau héros » shield is a pale, dashed,
  semi-transparent disc that looks disabled (#13 PARTLY).
- **Why it hurts:** the shield with her name is the first thing she taps every session, and its
  label is the smallest text in the game. The grade code turns a row of heroes into a class list.
- **Fix (code + CSS):**
  - Remove `<span class="shield-level">` from the visible plaque, and keep the level in the
    `aria-label`. If siblings share one iPad and need to tell shields apart, the emblem already does
    that.
  - Restyle `.shield-plaque` as the small cloth ribbon from a02/a03 (`kit-ribbon`), with `.shield-name`
    in Alegreya 600 at 15 px, `white-space: nowrap`, `width: max-content` and `max-width: 150px`,
    ellipsis only past 150 px. The slots are about 9 % (106 px) apart, so let the ribbons overlap
    the rail between shields rather than wrap.
  - Raise the shield to `min-width: 80px`.
  - Draw « Nouveau héros » as a full-opacity shield outline: a bronze rim, a bare wood face and a
    bronze « + ». No dashes and no transparency.

### N5. Minor: small-caps field labels are the last form tell on the ritual and the desk (flagged)

- **Screenshots:** a03, a03b, a08.
- **What she sees:** « TON PRÉNOM », « TON EMBLÈME », « TA CLASSE », « TON SCEAU À QUATRE CHIFFRES »,
  « TEXTE », « TITRE » and « CLASSE », each a small-caps label above a field.
- **My call:** Minor, not Important. The scroll, the owl, the shield preview and the medallions carry
  these screens now, and a label over a medallion row reads as a caption. The pattern that still
  says "form" is *label over an input box*. Fix only those, and leave the medallion legends as
  italic captions:
  - a03: put the name field **on** the banner. Style the input as the ribbon itself (Alegreya 600,
    20 px, centred, parchment-on-ribbon), with the placeholder « Ton prénom ». The `<label>` becomes
    visually hidden. The emblem and class legends become Alegreya italic at 16 px: « Choisis ton
    emblème », « Ta classe ».
  - a08: make the textarea's label visually hidden (the owl already says what to write). Make the
    title field a heading line written on the parchment, with a bottom rule only, Alegreya 600 at
    20 px, and the placeholder « Le titre de ton parchemin ». The class legend becomes « Pour quelle
    classe ? », the same as the shelves' « Quelle classe ? » register.
  - a03b: « Ton sceau à quatre chiffres » gets the four wax slots from the PIN gate (a04) instead of
    a 160 px text box, so the seal she makes looks like the seal she will break.

### N6. Minor: « une fois et demie plus de gloire (+50 % XP) » (flagged)

- **Screenshot:** a14.
- **My call:** XP isn't the problem. The HUD shows « 0 XP » on every scene, so XP is the game's own
  word. The problem is the arithmetic sentence and the extra section it needs. Replace the heading
  and paragraph with a reward-ink tag on each prophecy strip: « « La dictée du jeudi » · lundi 28
  septembre · dans 2 jours », and under it « Défendue avant lundi : +50 % d'XP ». Or, if the tag
  is too busy, put it in the Pythia's line when a prophecy exists: « Défends « La dictée du jeudi »
  avant lundi, et je t'offrirai la moitié de gloire en plus. » (≤ 160 characters, W10).

### N7. Minor: the desk lets her shelve a 13-word text while the owl says 80 is the minimum

- **Screenshot:** a08.
- **What she sees:** the owl says « Entre 80 et 200 mots… sinon Éris triche. » and the gauge says
  « il en faut au moins 80 », but « Poser sur l'étagère » is lit and works
  (`DeskPanel.svelte:91` only checks that the title and body aren't empty).
- **Why it hurts:** a rule that is stated and then not enforced teaches her to ignore the owl. A
  13-word "dictation" also defeats the spec's 80 to 200 range.
- **Fix (code + copy):** `disabled={submitting || !title.trim() || gauge.state !== 'ok'}`, with a
  line under the button while it is disabled: « Encore 67 mots avant l'étagère » (from `WORDS_MIN -
  wordCount`, with `plural()`). Or, if short texts must stay allowed for a parent, soften the owl to
  « Hou ! Entre 80 et 200 mots, c'est l'idéal, et les nombres en lettres. » and the gauge to « 13
  mots · l'idéal : 80 à 200 ». Pick one: the current mix contradicts itself.

### N8. Minor: the desk's class medallions wrap 5 + 2

- **Screenshot:** a08.
- **What she sees:** « 5H … 9H » on one row and « 10H 11H » alone on a second, which looks like a
  layout accident.
- **Fix (CSS):** in the desk column, use `LevelMedallions` at 48 px with a 4 px gap (7 × 48 + 6 × 4
  = 360 px, which fits the 367 px side column measured in a08), or split them into two even
  rows of 4 and 3 with `justify-content: flex-start`. The a03 ritual row is fine.

### N9. Minor: the lens crops the photographed page into a circle, and shows it twice

- **Screenshot:** a09b.
- **What she sees:** the lens frame shows the photo cropped round, so the page's left margin and
  first words are cut. A rectangular white thumbnail of the same page sits below « Déchiffrer ».
  « Prendre une photo » and « Déchiffrer » are both primary bronze buttons.
- **Fix (code + CSS):** inside the lens, show the latest page with `object-fit: contain` on the
  parchment colour, slightly tilted like a sheet under glass. Or keep the lens empty and show only
  the page thumbnails under it, as small parchment sheets with a « Retirer » corner. After the
  first photo, relabel « Prendre une photo » as « Une autre page » in the secondary style, so
  « Déchiffrer » is the only primary.

### N10. Minor: the codex's title and the owl cross the book's fold; « Pas encore recopié » repeats on every row

- **Screenshot:** a10.
- **What she sees:** the gutter shadow at x ≈ 590 runs through « LE PORTAIL D'ALEXANDRIE » and the
  owl's plate, as if they were printed across the binding. Every one of the eight works ends with
  « Pas encore recopié ».
- **Fix (CSS + code):** put the title and the owl's plate on the left page, above the banner, and
  start the list at the top of the right page. Show a status only when something exists
  (« 3 rouleaux recopiés »). For `never`, show nothing, or a small empty-inkwell icon with
  `aria-label="Pas encore recopié"`.

### N11. Minor: the work page is two empty pages, with a chevron that reads as "back"

- **Screenshot:** a11.
- **What she sees:** the left page holds a button, a title, an author and « Demander aux scribes »
  in its top third. The right page holds only « ‹ Les scribes n'ont encore rien recopié de ce
  livre. Demande-leur ! ». The « ‹ » is the same glyph as « ‹ Toutes les œuvres », so it reads as a
  second back button. There is no voice plate, unlike a10.
- **Fix (code + copy):** turn the empty-state line into the owl's plate at the top of the right
  page: « Hou ! Les scribes n'ont encore rien recopié de ce livre. Demande-leur, à gauche. ». Remove
  the chevron. Under the plate, show the Alexandria banner crop or a painted empty lectern, so the
  page isn't bare.

### N12. Minor: the monster picker is a grid of cream cards, and its confirm looks disabled

- **Screenshot:** a15.
- **What she sees:** each monster medallion sits in a rounded cream box, a card grid inside the
  unrolled scroll. « C'est celui-là » is a dark grey-brown slab next to the cream « Annuler », which
  is the "disabled" look the first review flagged on the lens.
- **Fix (CSS):** drop the tile boxes. Use 72 px medallions straight on the parchment with the name
  underneath, the selected one ringed in `--gold-light`, and the whole medallion plus name as the
  48 px or larger target. Render « C'est celui-là » as `kit-bronze`, at `opacity: .55` when disabled
  rather than a different fill. It becomes the same bronze as every other primary once a monster is
  chosen.

### N13. Minor: the quest wall is laid out as a dashboard

- **Screenshot:** a16.
- **What she sees:** a rule line, an « EN COURS » heading over an empty state (« Aucune quête en
  cours… »), the treasure line, then « DÉFIER UN MONSTRE ». The tablets start halfway down. Six
  identical « Lancer une quête » buttons follow. The wall is also the only overlay without a voice.
- **Fix (code + copy):** when nothing is in progress, hide the « En cours » section. Put the rule
  and the treasure into a Pythia plate: « Chaque monstre défié rapporte 60 XP et une page du
  bestiaire. Encore 2 quêtes et la Lanterne d'Hestia rejoint ta cabane. ». Make each whole tablet
  the button, with the single word « Défier » pressed into the clay at the bottom. Keep
  `data-testid` on the tablet.

### N14. Minor: « TOUS » overflows its medallion; the class toggle is a different button style

- **Screenshot:** a07b.
- **What she sees:** « TOUS » touches the medallion's rim (four caps in a 48 px disc), while « 5H »
  to « 11H » sit comfortably. The class toggle is a cream slab, unlike the bronze or text-link
  toggles elsewhere (« Qui l'a écrit ? », « Protéger ton bouclier d'un sceau »). (Its label is
  already ruled to become « Autres classes ».)
- **Fix (CSS):** `font-size: 13px; letter-spacing: 0` on the « Tous » medallion only, or let it be a
  64 px wide pill-medallion. Render the toggle as `kit-link` with the chevron icon, like the ritual's
  seal toggle.

### N15. Minor: the walk still skips states that decide whether the shelves read as a game

- **Screenshots:** the whole walk.
- **What's missing:**
  - the shelves with a prophecy on them (the walk creates « La dictée du jeudi » after a07);
  - a defended scroll with its broken seal and laurel;
  - the desk in its « parfait » state;
  - the title's « Tous les héros » overlay (six or more heroes);
  - the Pythia after a scroll is chosen, showing « La quête de la semaine ».
- **Fix (test, `playability-ui3.spec.ts`):** create the prophecy text before a07. Post one finished
  session for a shelf text through the API. Add shots a07c (prophecy plus a defended scroll), a08b
  (100 words), a02b (seven heroes, the « Tous les héros » shield and its overlay) and a15b (the
  chosen week). Delete the fixtures at the end, as W12 does.

### N16. Minor: the altar card's lead breaks « dans / 2 jours : »

- **Screenshot:** a13.
- **What she sees:** « La Pythie a vu ton épreuve, dans » on one line and « 2 jours : » on the next.
- **Fix (code):** join « dans », the number and « jours » with no-break spaces in `prophecyWhen`
  (`dans 2 jours`), or let the card grow to `min(420px, 30%)` so the lead fits on one line.

## 3. What now works well

- **The overlays are objects.** The scroll's rods and torn edges (a03, a08, a09, a14), the wood
  board with its cubbies, rolled scrolls, wax seals and pinned paper tags (a07), the terracotta
  tablets hanging on cords from a rail (a16), and the open codex with its gutter (a10, a11) finally
  match spec §2.2 and §4. Nothing in them looks like a web card any more, except the residue in N12.
- **The characters talk inside the panels.** The owl's plate on every library overlay and the
  Pythia's plate in her scroll replace every instruction paragraph. The lines are short, warm and
  in character: « Hou ! Entre 80 et 200 mots, et les nombres en lettres, sinon Éris triche. » and
  « L'écriture à la main, je ne sais pas la lire. »
- **The naming ritual is now a ritual.** The big shield preview with the name on a ribbon, emblems,
  class medallions, the seal behind « Protéger ton bouclier d'un sceau » and « Accrocher mon
  bouclier » (a03) turn sign-up into making something.
- **The PIN seal** (a04) is the best small screen in the game: four wax discs filling, the elided
  « Le sceau d'Élise-Marguerite », and one quiet way out.
- **The gate tells a story.** Shields hang on real painted hooks. A single cloth ribbon says
  « Accroche ton bouclier à la porte du camp. » and then « Choisis ton bouclier » (a02, a04b).
- **One name per thing.** Plaque, overlay title and hub label match everywhere (a06→a07, a09, a10,
  a13→a14, a16).
- **One visible next step per scene.** Its gold-bordered plaque is now noticeable without shouting
  (a06, a13).
- **The school register is gone.** No HarmoS, niveau, facultatif, profil, scanner, réviser or « (s) »
  anywhere on the overlays. The dates read the way a person says them (« lundi 28 septembre · dans
  2 jours »). The only grade code left on a scene is the shield tag (N4).
- **Layout discipline.** Every overlay clears the HUD. No scene text ghosts through a panel. The
  desk's submit is always in view. The picker unrolls full width with « Annuler » visible (a15).
  Tap targets hold 48 px.
- **Real names work.** « Anne-Charlotte » fits the HUD pill (a05) and the ritual banner (a03). The
  hyphenated plaque on the PIN wraps cleanly.
- **No emoji anywhere** in the 25 shots. The icons are the painted set.

## 4. Does anything still look like a school form?

Not at the level of the screens any more. Each scene and each overlay now reads first as a place or
an object: a gate, a tent, a scroll handed over by the owl, a board of scrolls, a book, a wall of
clay tablets. That was the redesign's goal, and this wave reached it. What survives is typographic
and structural, at the scale of a line rather than a page:

- small-caps labels sitting over input boxes (a03, a08);
- a catalogue line repeated under every item (« parchemin moyen · Jamais défendu », « Pas encore
  recopié »);
- section headings with an empty state stacked above the real content (a14, a16);
- a HarmoS « 10H » under each hero's name on the gate (a04b).

None of these would make her think "school app" on its own. Together they are the last places where
the game explains itself like a form instead of showing things. N1 and N4 are the two worth fixing
before UI3b copies these panels: the scrolls she was sent to open are hidden, and her own name is
the smallest text in the game. The rest are a polish pass that the war tent, the nest and the cabin
should start from rather than inherit.
