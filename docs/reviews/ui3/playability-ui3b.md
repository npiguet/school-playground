# UI3b playability and immersion review (the hub, the war tent, the nest and the cabin)

Reviewer: playability and immersion (Opus). Branch `scenes`, commit `af26b97`. I looked at all 54
PNGs in `docs/reviews/ui3/`: a01 to a16 (title, library and Delphi, already reviewed in
`playability-ui3a-rereview.md`, so I only note what changed or what UI3b affects), b01 to b20 with b04b,
d01 to d07, and portrait-a01. I also read the walk (`web/e2e/playability-ui3.spec.ts`), the
implementer's report (`task-9-report.md`) and spec §1 to §3, §6 and §10. The shots are 1:1 with CSS
pixels (1180×820), so every size below is a real iPad size. Where a finding depends on code, I checked
the source and cite it.

**Short answer.** The four new scenes are real places. The hub reads at a glance, and so do the war tent
with its pinned sheets, the nest and the cabin. The hotspots match their landmarks, nothing overlaps,
and there is no emoji and no « niveau ». The problem is what opens from those places. In the cabin, and
in part of the war tent, the overlays still carry the old Stats and Settings screens: a gradebook
table, a numbered « level » row, a bare checkbox, a dashboard of gauges that repeats its numbers three
ways, and a « label + field + submit » naming form. The cabin is also the one place where nobody
speaks.

Counts: **0 Critical, 9 Important, 16 Minor.**

---

## 1. Findings

### 1. Important: the journal's « Ses ruses, une à une » is a gradebook (open item 3)

- **Screenshot:** b16.
- **What she sees:** a four-column table with small-caps headers (RUSE / PIÈGES / DÉJOUÉS / RÉUSSITE)
  and rows like « Accord du verbe avec son sujet (L'Hydre) · 16 · 15 · 94 % ». The first column uses
  the grammar-book name, with the monster in brackets.
- **Why it hurts:** a table with a « Réussite » percentage column is a report card. It is the most
  school-like thing left in the game. The grammar term comes first and the monster she actually
  fought is an aside.
- **Fix (`JournalPanel.svelte:56–66`, `lib/explain.ts` is left alone):** drop the `<table>`. Render one
  line per ruse, with the lieutenant medallion (the same 40 px portrait as the dossier's), the monster
  name as the title, and the grammar term as a small italic subtitle:
  - Heading: « Les ruses d'Éris, une à une » (« Ses » has no clear owner on a journal page).
  - Line: « **L'Hydre** — tu as déjoué 15 de ses 16 pièges », then a small italic line under it:
    « l'accord du verbe avec son sujet ».
  - Add a laurel strip of 5 leaves (the `.leaves` markup already used for trap words), lit at
    `Math.round(rate * 5)`, instead of the percentage.
  - A lieutenant → category map already exists for the labels. Split `CATEGORY_LABELS` into
    `{ monster: 'L\'Hydre', rule: 'l\'accord du verbe avec son sujet' }`, or add a `JOURNAL_RUSES`
    map in `lib/world/journal.ts`, so the explain screen keeps its current strings.

### 2. Important: « L'aide des Muses » is a numbered level picker that does nothing, with a riddle for a caption

- **Screenshot:** b16.
- **What she sees:** four bronze medallions « 1 2 3 4 », the second one lit, and the line « Les Muses
  nomment les passes, sans les éclairer. »
- **Why it hurts:**
  - Numbered steps with the current one lit are the banned « niveau N sur 4 » in another form.
  - These are the same bronze medallions she taps in the lyre and the forge (`kit-medallion`), but
    here they are an `<ol>` of `<li>`, so tapping them does nothing. That is a broken affordance.
  - « nomment les passes, sans les éclairer » is unclear even to an adult: « passes » is not a word
    she knows in this sense.
- **Fix (`JournalPanel.svelte:47–55`, `lib/world/journal.ts` LINES):**
  - Remove the four number medallions. Show one sentence in the Muses' voice, plus a short line about
    how the help changes:
    - 1: « Les yeux d'Argus te montrent chaque piège. »
    - 2: « Les Muses te disent quelles ruses chercher, mais pas où elles se cachent. »
    - 3: « Les Muses te disent seulement combien de pièges se cachent. »
    - 4: « Tu relis seule, sans l'aide des Muses. » (Or « sans aide », to stay gender-neutral.)
    - Under it: « Plus tu déjoues de pièges, moins les Muses t'aident. »
  - If a visual is wanted, use four small painted icons (an eye, a lyre, a counter, a quill) in a
    non-button style (no bronze rim, no shadow), with only the current one in colour.

### 3. Important: the same numbers appear three times, in three formats, and they disagree

- **Screenshots:** b06, b07, b16.
- **What she sees:**
  - In the dossier (b07), each sheet has two stat lines: « Pièges tendus : 16 · déjoués : 15 · 94 % »
    and then « 3/3 jours · 12/10 pièges · 92 % ».
  - The portrait (b06) has three labelled green bars: « Jours de défense : 3/3 », « Pièges rencontrés :
    12/10 » and « Pièges déjoués : 92 %, il en faut 80 % ».
  - The journal (b16) repeats « 16 · 15 · 94 % » in its table.
- **Why it hurts:** she can't tell why L'Hydre is at 94 % in one line and 92 % in the next. The dossier
  is six cards of metrics under an « Éris » plate, which makes it a dashboard. `DossierPanel.svelte:123–125`
  prints the all-time numbers and the window numbers one above the other, with no word to tell them apart.
- **Fix:**
  - **Dossier** (Éris's file on the hero): keep only Éris's line and one visual per sheet. Delete the
    `numbers` line (`:123`). Replace the window line with one sentence in Éris's voice, from `eris.ts`:
    - Neutralised: the stamp alone.
    - In progress: « Encore 1 jour de garde et 4 pièges à déjouer avant qu'elle tombe. »
    - Not started: « Pas encore croisée. »
    - Keep the laurel gauge without its numeric label.
  - **Portrait:** see finding 12.
  - **Journal:** the one place for all-time totals (finding 1).

### 4. Important: naming the dragon is a « label + field + submit » form

- **Screenshot:** b13.
- **What she sees:** the small-caps heading « SON NOM », an empty rectangular input with no
  placeholder, and a « Garder ce nom » button beside it. Below that come « SA TEINTE » and six eggs,
  four of which carry the same small orange italic « À gagner : quête de l'Oracle » (about 12 px, on
  two lines each).
- **Why it hurts:** this is a sign-up field. The forge (a03) already solved the same moment: the name
  is written on a banner under the shield. Naming your dragon is the emotional peak of the nest, and
  here it looks like the least magical part of it. The repeated locked line is noise, four times over.
- **Fix (`CarePanel.svelte`):**
  - Remove the « Son nom » heading. Put the input on a painted name ribbon, the same `.name-banner`
    style as `HeroForm.svelte`, centred under the dragon plate, with `placeholder="Écris son nom…"`.
    Keep the button « Garder ce nom » next to it (it is a real input, as ruled in §2.4).
  - The dragon's line already asks for a name (« Il te regarde et attend un nom. »), so the plate does
    the job the heading was doing.
  - Say the locked rule once, under the row: « Les autres teintes se gagnent dans les quêtes de
    l'Oracle. » Remove `swatch-how` (`:143`). The lock icon on each egg is enough.

### 5. Important: the nest's growth card says « techniques » and looks like a web card

- **Screenshots:** b11, b12, d06.
- **What she sees:** a grey-cream rounded card in the top-left corner with « DRAGONNET », « Prochaine
  étape : 3 techniques neutralisées », « 2 / 3 », a flat green bar on a grey track, and « Curieux »
  alone at the bottom.
- **Why it hurts:**
  - « Techniques » appears nowhere else. The game says « ruses » (journal, codex) and « lieutenants »
    or monsters (war tent).
  - « Curieux » on its own reads like a form value: she can't tell whether it is a mood, a stage or a
    name.
  - The card is the only UI element on a scene that is not a painted object: it has no torn edge, no
    rod, and no bronze.
- **Fix:**
  - `lib/world/scenes/nest.ts:55` (and its test): « Pour grandir : 3 ruses d'Éris neutralisées »
    (plural via `plural(next, 'ruse d\'Éris neutralisée', 'ruses d\'Éris neutralisées')`).
  - The mood line: « Il est curieux. » (or « Humeur : curieux », but the sentence is better).
  - Style the card as `kit-sheet` (the pinned parchment of the war tent) and use the laurel gauge
    instead of the flat bar.

### 6. Important: the lyre is still a settings page, and the mute is a bare native checkbox (open item 4)

- **Screenshot:** b17.
- **What she sees:** « LA VOIX DE LA DICTÉE », then the label « Voix » above a native select
  (« Stub fr » in the walk; on an iPad it will show system names such as « Amélie (fr-CA) »), then
  « Écouter un essai », then the class medallions. Next comes « LES SONS » with a white 20 px native
  checkbox and the small-caps line « Couper les sons du jeu (la dictée reste lue) ». After that,
  « TON OBJECTIF » and « Textes par semaine » with four medallions, and « TON SCEAU », cut at the
  bottom rod.
- **Why it hurts:** every other choice in the game is now a medallion, and this checkbox is the one
  raw browser control left in sight. Section headings with a small label over each control make it a
  settings form. The spec (§7) also puts the music, sound and voice volumes here in UI5, so this panel
  will grow.
- **Fix (`LyrePanel.svelte:121–127`):**
  - Replace the checkbox with the medallion radio the panel already uses, `LevelMedallions` with
    options « Joués » / « Coupés ». The legend is « Les sons du camp ». The note under it is « La
    dictée est toujours lue. » This is a real `<input type="radio">`, so the ruling on real form
    controls still holds.
  - Remove the « Voix » label (the heading says it). Give the select `aria-label="Voix de la dictée"`
    and the `kit-select` parchment style (a bronze chevron, no white box).
  - Give the lyre a voice (finding 7), so the headings can shrink.

### 7. Important: the cabin is the only place where nobody speaks

- **Screenshots:** b14, b15, b16, b17, b18.
- **What she sees:** the owl speaks in the title and the library, the Pythia in Delphi, Éris in the
  war tent (and the owl in the codex), and the dragon at the hub and in the nest. The cabin has no
  greeting, and its four overlays (trophies, journal, lyre, hero panel) have no voice plate.
- **Why it hurts:** this breaks the project rule « every overlay is an in-world object with its
  character's voice ». These three panels are exactly the ones that slide back into screen form
  (findings 1, 2, 6 and 13). A voice line is what turns « Tes trésors » from a grid into someone
  showing her their shelf.
- **Fix:** the dragon is the narrator (spec §2.5), and the cabin is home, so it speaks here. Add a
  `speaker: 'dragon'` plate to each cabin overlay, and a first-visit greeting to the cabin scene:
  - Scene: « Ta cabane. Tout ce que tu as gagné est rangé ici. »
  - Trophies: « Chaque ruse neutralisée laisse une relique. Il en manque encore quatre ! »
  - Journal: « Ton journal se souvient de chaque texte défendu. »
  - Lyre: « Ici, tu choisis la voix qui te lit la dictée, et si le camp fait du bruit. »
  - Hero panel: no plate needed (it is a short menu).

### 8. Important: the inked labels are 12 px: « Ta cabane » on the hub, and the six sheets in the war tent (open item 2)

- **Screenshots:** b01 to b04, b19, b20 (the hub), b05, b10 and d05 (the war tent).
- **What she sees:** « TA CABANE » is a pale 12 px tag on the white wall. It is the smallest and
  palest name on the hub, and the only one of six places not on a dark plaque. On the war tent, « L'HYDRE /
  Neutralisée », « LA CHIMÈRE / Quête en cours » and « Dort encore » are 12 px as well.
- **Why it hurts:** at arm's length on an iPad, 12 px caps on a bright wall are the one label she
  has to squint at. The cabin also looks less important than the others, which is odd for « her »
  place.
  (`Hotspot.svelte:269–272`: `.label-on .hotspot-name, .hotspot-caption { font-size: 12px }`.)
- **Fix:**
  - Hub: give the cabin the same plaque as the others. In `camp.ts:117` use
    `labelPos: 'below', leader: true`, with the pin at the cabin's door sill. The plaque then sits on
    the dirt in front of the house (about x 990–1110, y 660–690 at 1180), where there is nothing to
    cover. Re-run `labelOverlaps` at the four sizes.
  - War-tent sheets: raise `.label-on .hotspot-name` to 14 px with `letter-spacing: 0.02em`, and
    `.hotspot-caption` to 13 px. « LES SIRÈNES » at 14 px is about 96 px wide, which fits the 90 px
    sheet with the tag's 6 px padding allowed to spill.

### 9. Important: in Delphi the glow says « Quête en cours » while it leads to the prophecy

- **Screenshots:** d03 (lived-in state), b04.
- **What she sees:** at the hub, the glowing « Le chemin de Delphes » plaque says « Une prophétie,
  dans 3 jours ». She goes to Delphi, where the one glow is on « La Pythie », captioned « Quête en
  cours ».
- **Why it hurts:** the hub promised a prophecy, and the glowing place talks about a quest. The glow
  chain works in code (`delphi.ts:24–26` glows for `step === 'prophecy'`), but the words break it. The
  prophecy strip is inside the Pythia panel (a15b), so she will find it, but the caption tells her to
  expect something else.
- **Fix (`lib/world/scenes/delphi.ts:26`):** when `step === 'prophecy'`, caption the Pythia with the
  same words as the hub: « Une prophétie, dans 3 jours » (`prophecyWhen(nearestProphecy(camp).days_left)`).
  Keep « Trois rouleaux à ouvrir » / « Quête en cours » for the other steps. Add a vitest case next
  to `nextStep.test.ts`.

### 10. Minor: the « Le sentier de la bataille » plaque covers the red tent's peak (open item 1)

- **Screenshots:** b04, b04b, b19.
- **What she sees:** with a caption, the plaque grows down to y ≈ 340 and sits on the war tent's
  finial and two spear tips.
- **Why it hurts:** it hides a landmark of a different place, so in the still frame the plaque reads
  as belonging to the red tent. This is small, because the pin and the leader point at the archway.
- **Fix:** slide the plaque right of the finial, not up (above the archway is sky).
  - Give the `boss` hotspot a label x offset, e.g. `labelDx: +12` (in % of the shape width), so the
    plaque centres at x ≈ 985 at 1180. That is clear of the finial (x ≈ 835) and over the olive tree.
  - Or anchor the pin on the archway's right post (x ≈ 930).
  - Re-run `labelOverlaps` at 1180, 1366, 1440 and 2560.

### 11. Minor: the codex page is lopsided, and it labels itself « Fiction du jeu » (open item 5)

- **Screenshot:** b09.
- **What she sees:** the left page holds the title, a 230 px image plate, « LE MYTHE » as a four-item
  bullet list, and « SOURCES » cut at the fold. The right page has a blue « FICTION DU JEU » tag,
  « AU CAMP », two lines and a button, and is about 70 % empty.
- **Why it hurts:** she has to scroll one page of a book while the other is blank. Bullets and a
  « Sources » heading are a school textbook's layout. « Fiction du jeu » steps outside the world to
  call it a game, and the owl has already said (b08) « Ce que le camp en a fait est écrit à part,
  sous « Au camp » ».
- **Fix (`CodexPagePanel.svelte`):**
  - Cap the plate at `max-height: 170px`.
  - Set the myth as running paragraphs (no `<ul>`), with a drop cap on the first letter.
  - Move « Sources » to the foot of the right page as one small italic line: « D'après : Apollodore,
    *Bibliothèque* II, 5, 2 ; … ».
  - Replace the « Fiction du jeu » stamp with a small painted camp emblem next to « Au camp ». The
    myth/fiction separation stays, because the pages and headings keep it.

### 12. Minor: « Pièges rencontrés : 12/10 », and the gauges on a neutralised lieutenant (open item 6)

- **Screenshot:** b06.
- **What she sees:** under « Neutralisée le mardi 4 août » come three bars: « Jours de défense :
  3/3 », « Pièges rencontrés : 12/10 », and « Pièges déjoués : 92 %, il en faut 80 % » (cut at the rod).
- **Why it hurts:** « 12/10 » looks like a mistake. The bars measure the way to neutralise her, which
  is already done. The fourth gauge-style line shows how the page is built: a status page, not a
  portrait.
- **Fix (`PortraitPanel.svelte:116–128`):**
  - When `lieutenantState.neutralised`, hide the three gauges. Éris's line and the relic medallion
    are the page.
  - Otherwise, show the numbers as a count toward the goal, capped: `Math.min(traps, 10)`, with the
    label « Pièges croisés : 10 sur 10 » once reached.
  - Say the rule as a sentence: « Pour la neutraliser : 3 jours de garde, 10 pièges croisés, et 8 sur
    10 déjoués. »

### 13. Minor: the trophies say « Comment l'obtenir : Neutraliser la Chimère » under grey « ? » coins

- **Screenshot:** b15.
- **What she sees:** four of the six relics are flat grey coins with a « ? », each with an infinitive
  instruction in 12 px gold italic on dark wood. The Chimère's relic is a « ? » too, although her
  quest is under way.
- **Why it hurts:** « Comment l'obtenir » plus an infinitive is FAQ or help-page register. The « ? »
  coins look like missing images. The small gold italic has weak contrast on dark wood.
- **Fix (`TrophiesPanel.svelte:117–118`):**
  - Line: « Neutralise la Chimère pour la gagner. » (Build it from the lieutenant with `agree`, and
    make the pronoun agree with the relic: la crinière → « la gagner », la perle → « la gagner »,
    etc.)
  - Size and colour: 14 px, `--parchment` colour.
  - `Medallion locked` should show the relic's dimmed silhouette (a `brightness(0) opacity(.35)`
    filter on the real art), not a « ? ».

### 14. Minor: the journal's « points » are a second currency, and its log repeats itself

- **Screenshot:** b16.
- **What she sees:** « samedi 26 septembre · 10 points · 75 % déjoués » and six rows of « La
  veillée des héros » that differ only by date. At the bottom: « 7 textes défendus · 70 points · 27
  pièges déjoués ». The HUD says 1082 XP.
- **Why it hurts:** points versus XP is one number too many. A list of dated rows with metrics is an
  activity log.
- **Fix (`JournalPanel.svelte`, `journal.ts defenceMeta`):**
  - Drop « points » from `defenceMeta` and from the totals: « 7 textes défendus · 27 pièges déjoués ».
  - Group recent defences by text: « La veillée des héros — défendue 6 fois, la dernière le mercredi
    5 août ».

### 15. Minor: the dragon talks about itself in the third person under its own name

- **Screenshots:** b11, b13.
- **What she sees:** the speaker is « TON DRAGON », and the line is « Ton dragon te regarde avec de
  grands yeux ambre. » and then « Il te regarde et attend un nom. »
- **Why it hurts:** the plate says the dragon is speaking, but the line is a narrator's. At the hub,
  the same character speaks in the first person.
- **Fix:** either label these lines as stage directions (italic, no speaker name, the
  `DialogueBox` `narration` style), or give the dragon its own voice: « Tu es revenue ! Tu me donnes
  un nom ? » (gender-neutral: « Te revoilà ! Tu me donnes un nom ? »).

### 16. Minor: in a still frame the next-step glow is a hairline

- **Screenshots:** b02, b04, b04b (compared at 2× crop).
- **What she sees:** the glowing plaque differs from the other captioned plaques by a slightly
  brighter 2 px border, an 18 px halo, and a pale haze on the landmark. The captioned plaques
  (« Le nid du dragon · Il attend un nom ») already have a thin gold rim.
- **Why it hurts:** the pulse (`kit-glow-strong`, 2.4 s) helps on a real screen. With reduced motion,
  or at a glance, « exactly one glow » is hard to spot among three captioned plaques.
- **Fix (`Hotspot.svelte:162–168`):** remove the gold rim from plaques that are not glowing, so gold
  means « next ». For the glowing plaque, use a gold-leaf background band (`background:
  linear-gradient(#5a4520, #2b2216)`) plus the halo, so the difference survives reduced motion.

### 17. Minor: the war tent's hub badge counts neutralised monsters, while the other badges mean « something waits »

- **Screenshot:** b04.
- **What she sees:** a gold « 2 » on « La tente de guerre » (two neutralised) and a gold « 1 » on
  Delphi (one quest ready).
- **Why it hurts:** the same coin means « to do » in one place and « score » in another. She will
  go into the tent looking for two new things.
- **Fix (`camp.ts:111–114`):** drop the count badge. Put the news in a caption only when something
  changed since her last visit (« L'Hydre est tombée »), or show the count as small gold seals on the
  plaque.

### 18. Minor: the hero chip takes her out of the place she was in

- **Screenshot:** b18 (opened from the HUD in Delphi, with the cabin behind it).
- **What she sees:** she taps her name in Delphi, and the cabin appears behind the « Ton héros »
  scroll.
- **Why it hurts:** a HUD button that switches scenes is disorienting. After closing it she may not
  know how she got into the cabin.
- **Fix:** open the hero panel over the current scene (an overlay route relative to the scene), and
  keep « La lyre » / « Ton journal » as the only links that move her to the cabin. If the route has
  to stay in the cabin, fade the scene change behind the scroll instead of cutting it.

### 19. Minor: the Alexandria work spread puts the owl on the right page (open item 7)

- **Screenshot:** a11.
- **What she sees:** the left page has the title, « ‹ Toutes les œuvres », the book title and
  « Demander aux scribes » over empty paper. On the right are the owl (« Demande-leur, à gauche. »)
  and the same library image as a10.
- **Why it hurts:** it is the one codex spread where the voice is not under the title, and the owl
  has to point across the fold to the button.
- **Fix (`PortalWorkPanel.svelte`):** move the plate to the left page, between the title and the
  button, with the line « Hou ! Les scribes n'ont encore rien recopié de ce livre. Demande-leur ! ».
  The picture stays on the right. That removes the exception and the « à gauche ».

### 20. Minor: « Ses ruses viendront dans une classe plus grande »

- **Screenshot:** b10.
- **What she sees:** « Protée dort encore. Ses ruses viendront dans une classe plus grande. »
- **Why it hurts:** « classe plus grande » is school register in the one place where the fiction
  could carry it.
- **Fix:** « Protée dort encore. Il se réveillera dans un an ou deux. » The locked caption stays
  « Dort encore ».

### 21. Minor: « Les amis du camp » lists places

- **Screenshot:** b08.
- **What she sees:** the list includes « Les Muses », « Delphes et l'Oracle » and « Le dragon des
  Muses ». Delphi is a place, not a friend.
- **Fix:** rename the heading to « Les amis et les lieux du camp », or split the list: « Les amis du
  camp » for Argus, Ariane, Persée, the owl, the Muses and the dragon, and « Les lieux sacrés » for
  Delphes.

### 22. Minor: the PIN seal breaks the name at its hyphen, and it is the last plain card

- **Screenshot:** a04.
- **What she sees:** « LE SCEAU D'ÉLISE- / MARGUERITE » on two lines, in a flat rounded card (no
  rods, no torn edge, no voice).
- **Fix:**
  - `white-space: nowrap` on the name span inside the plaque, with `font-size: clamp(16px, 2.2vw,
    20px)`, so « Le sceau d' » can wrap before the name but the name itself never breaks.
  - Give the card the `kit-roll` scroll frame used by every other title overlay.

### 23. Minor: the quest wall's « Défier » buttons look disabled

- **Screenshot:** a16.
- **What she sees:** « DÉFIER » in tan on a salmon tablet, with low contrast, next to the bronze
  buttons used everywhere else.
- **Fix:** use `kit-bronze` for « Défier » (the tablet colour stays), or a dark-ink engraved variant
  with at least 4.5:1 contrast.

### 24. Minor: two shots in the walk don't show what they claim

- **Screenshots:** a07c, a08b.
- **What I see:** a07c is a07 again (a 1 px scroll difference). The defended scroll was already in
  view in a07, so a07c adds nothing. In a08b, the gauge was caught mid-transition (`.kit-gauge-fill
  { transition: width .2s }`): at « 100 mots · parfait » the fill stops at about 27 %, short of the
  olive 80–200 band, although the CSS computes 50 %. A reader of the baseline would log that as a bug.
- **Fix (`playability-ui3.spec.ts`):**
  - Run the walk with `reducedMotion: 'reduce'` for overlay shots, or wait for `transitionend` on
    `desk-gauge .kit-gauge-fill` before `shot()`.
  - Scroll a07 to the top so that a07c's scroll (to the defended cubby) shows a different frame, or
    drop a07c.

### 25. Minor: the fixture dates put a neutralisation before today's session (open item 9)

- **Screenshots:** b06, b16.
- **What I see:** « Neutralisée le mardi 4 août », and August defences listed under a September 26
  one, all titled « La veillée des héros ».
- **Why it matters:** it is a walk artefact, not an app defect. But the baseline is what future
  reviewers judge, and six identical rows hide finding 14's grouping question.
- **Fix (walk):** post the lived-in sessions at `today − 5`, `today − 4` and `today − 3` (the
  3-day window still counts), and use three different titles (« La veillée des héros », « Le chant
  du berger », « La lettre d'Ulysse »).

---

## 2. Verdicts on the nine open items

| # | Item | Verdict |
|---|---|---|
| 1 | b04/b19 battle plaque over the red tent's peak | **Real, Minor.** Slide it right (finding 10), don't grow it upward into the sky. |
| 2 | « Ta cabane » plaque about 11 px | **Real, Important** (finding 8). It is 12 px in CSS and the palest label on the hub. Give it a normal dark plaque below the house. The same 12 px applies to the war-tent sheets. |
| 3 | b16 journal stats table | **Real, Important** (finding 1). It is the most school-form-like element in UI3. The numbered help medallions next to it are just as bad (finding 2). |
| 4 | b17 bare native mute checkbox | **Real, Important** (finding 6). Replace it with the medallion radio pair. Keep the select (a real control as ruled) but restyle it and drop its label. |
| 5 | b09 codex page: left overflows, right empty | **Real, Minor** (finding 11). Also drop the « Fiction du jeu » stamp. |
| 6 | b06 « 12/10 » | **Real, Minor** (finding 12). Cap it, and hide the gauges once neutralised. The deeper problem is the triple stats (finding 3). |
| 7 | a11 owl voice on the right page | **Accepted as working, but fix it cheaply** (finding 19, Minor). Moving the plate left removes the only exception and the « à gauche ». |
| 8 | a10 class medallions as grade codes on list rows | **Accept.** They are bronze seals at the row's edge, not text, and she needs them to pick a book at her level. Optional polish: ring her own class's medallion in gold so it reads « pour toi ». No finding. |
| 9 | Fixture dates, neutralisation before today's session | **Walk artefact, not an app defect. Fix it anyway** (finding 25, Minor): relative dates and distinct titles. |

## 3. Hotspots versus landmarks (?debug d01 to d07)

- **d01 title:** `title-gate` covers the door arch exactly. « Entrer » sits on the lintel.
- **d02 library:** shelves, desk, lens, portal and owl each sit on their object. The desk polygon
  hugs the slanted top. The owl circle is about 110 px, well above 48.
- **d03 Delphi:** the Pythia's rectangle covers the figure and the tripod, and the tablets cover the
  five rows of the wall. The altar card sits outside both, which is correct.
- **d04 hub:** oracle (temple and upper stairs), dragon (nest), parchemins (striped tent), dossier (red
  tent), cabin (house) and boss (archway, about 145×90 px) all fit their landmarks. The only issues
  are the plaques in findings 8 and 10.
- **d05 war tent:** six sheets are outlined 1:1. `war-dossier` is the map-table top. `war-bestiary`
  covers the codex, the lectern top and the edge of the shield, which is acceptable. The « Le dossier
  d'Éris » plaque floats on the tent cloth above the table with a leader. That is fine, but it reads
  better pinned to the table's front edge (below, where there is empty floor), if a later pass wants it.
- **d06 nest:** one ellipse on the straw bed and the dragon. The plaque is below with a leader.
- **d07 cabin:** the shelf and medals, the journal desk, and the lamp and lyre. All the targets are
  large. The journal plaque sits over the left window, and the lyre plaque over the wall, which is fine.

Tap targets: every hotspot, the medallions (about 56 px), the eggs (56 px), the back button (48 px)
and the overlay close buttons (50 px) are at or above 48 px. The one control under 48 px that looks
tappable is the journal's help medallions (about 40 px), which aren't buttons (finding 2).

## 4. What works well

- **The hub is a place.** Six landmarks read from across the room. The weekly goal is a cloth ribbon
  in the sky, and news appears as captions under plaques (« Une prophétie, dans 3 jours », « Il attend
  un nom », « Combat 1 : Sandales d'Hermès »). The locked path shows a padlock, and the egg explains
  it in the fiction: « Éris se cache encore. Neutralise encore 2 ruses et elle sortira. »
- **The war tent's pinned sheets** are the best new idea in UI3b. The monsters are portraits on the
  canvas, with gold seals when they are beaten, and « Dort encore » with a padlock for a younger hero
  (b10). The egg's line says why.
- **Éris's voice in the dossier and the portrait** is exactly right: « L'Hydre est neutralisée. Je
  refuse d'en parler. », « Écho est réduite au silence. Ce n'est pas une grande perte. (Si.) »
- **The bestiary codex** (b08) is a real book: the owl's plate under the title, the monsters with
  their cut-outs, and the camp's friends as painted medallions and vignettes.
- **The nest** (b12): the hatchling glows in the painted straw, and its caption carries the one thing
  to do.
- **The cabin scene** (b14): the shelf, the medals, the journal, the lamp and the lyre are real
  objects to tap, and there are no buttons on the scene.
- **The trophy cubbies** (b15) on dark wood, with Cinzel names and one-line descriptions
  (« Un coquillage qui répète le dernier mot juste. »).
- **The hero panel** (b18): three labelled medallions, and nothing else.
- **Consistency:** every place has « ‹ Le camp » in the same corner, a marble title plaque and the
  same HUD. Every overlay starts below the HUD. There is no emoji, no « niveau », no « (s) » plural and
  no visible admin wording on the scenes.
- **Scaling:** the hub holds at 1440×900 (b19) and 2560×1080 (b20, with blurred art on the sides).
  The rotate screen (portrait-a01) is in-world: « Tourne ton iPad · Le camp se découvre à
  l'horizontale. »

## 5. Does anything still look like a school form?

Yes, and it is now concentrated in one place: what opens from the cabin, plus the war tent's
numbers. The seven scenes are painted places with pinned, readable landmarks, one glow, and characters
who speak in the fiction. The title, the library, Delphi, the codex, the trophies and the hero panel
open as scrolls, tables and books. But the journal still has a four-column table with a
« Réussite » percentage and a numbered 1-to-4 help row that is a level in disguise. The lyre still
has a label over a select and a bare white checkbox. The dragon's naming is a « field + submit » line.
The dossier and the portrait show the same trap counts three ways (« 16 · 15 · 94 % », « 12/10 pièges
· 92 % », « 12/10 ») under Éris's voice. The cabin is also the only place where no character speaks,
so its overlays read as the old Stats and Settings screens moved into a room. Findings 1 to 7 are all
copy and layout inside existing components, with no new art, and they would close the gap. After
them, what is left is polish.
