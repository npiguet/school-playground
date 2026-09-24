# SP2 playability review — La Discorde, analysis and text sources

Reviewer: Playwright walk + screenshot reading, evaluated from two perspectives (a 13-year-old
fantasy fan, a game designer). This document **reports**; it does not fix. All quotes of UI text
are verbatim French from the build. Every explanation the game showed during the walk is listed and
judged in §2 and §4.

## 1. Setup

- **Build:** production image built from commit `92e47a1` ("Add SP2 end-to-end tests…") in a
  detached worktree outside the repo. Only isolation patches were applied locally (compose project
  `discorde-review2`, image tag and volume names) — none touch app code. The app ran with the
  offline Alexandria fixtures (`DISCORDE_ALEXANDRIA_OFFLINE_DIR=/fixtures/alexandria`) and the scan
  fixture image `server/tests/fixtures/scan/handout.png`, exactly like the SP2 e2e specs.
- **Viewports:** `ipad-landscape` 1180×820 and `ipad-portrait` 820×1180 (WebKit, touch, 1×).
- **TTS:** stubbed (`web/e2e/helpers.ts` `stubSpeech`).
- **Spec:** `web/e2e/playability-sp2.spec.ts` (see §7), run with the SP1 playability config
  (`testMatch` extended to the SP2 spec, timeout raised) → `2 passed (54.1s)`, **68 PNGs** in
  `docs/reviews/sp2/` (34 per orientation).
- **The walk** (per orientation), profile `Ariane-<project>` (10H):
  1. FAB → « Ajouter un parchemin » menu → **scan** the fixture handout → verify → title + due date
     (today + 21 days) → library (« Prophéties de l'Oracle ») → intro with « Voir la feuille » →
     dictation at pace 1 (checks: no photo, reference hidden) → « Quitter ».
  2. **Grimoire corrompu** on the 10H seed « Nausicaa et la lessive »: intro → « Ouvrir le grimoire »
     → Fil d'Ariane (a noun, a medium-confidence verb, a high-confidence verb with a wrong then a
     right subject, a second verb failed twice) → fix every other plant → results → stats.
  3. **Dictation** of « La chouette d'Athéna » with a draft carrying 10 realistic mistakes + 2
     reform spellings (see table), Fil on her own wrong verb, 2 fixes → results, every explanation
     recorded, 6 popovers opened.
  4. **Dictation** of a 44-word custom text « Le festin des Muses » (coordinated subject,
     être + participle, qui-relative, attributes; 4 reform spellings in the draft) → results.
  5. **Bibliothèque d'Alexandrie**: works → « Lettres de mon moulin » refresh (no fixture → failure
     banner) → back → « Vingt mille lieues sous les mers » refresh → 7 scrolls → adopt → « Jouer
     maintenant » → library shows the « Alexandrie » chip.

  Draft mistakes planted in « La chouette d'Athéna » (the reform rows are *not* mistakes):

  | planted | kind |
  |---|---|
  | `se taisaient` → `se taisait` | verb -nt, subject « Les autres oiseaux » (elision `n'intriguait` earlier in the text) |
  | `ne distinguaient` → `ne distinguait` | verb -nt, subject « les autres » (medium chain) |
  | `qui l'entendaient` → `qui l'entendait` | verb -nt through relative « qui » |
  | `veillait sur` → `veillaient sur` | proximity attraction, subject « la déesse elle-même » |
  | `l'avait choisie` → `l'avait choisi` | participle with avoir, COD « l' » before |
  | `toits endormis` → `toits endormi` | participle used as adjective |
  | `ruelles étroites` → `ruelles étroite`, `yeux dorés` → `yeux doré` | adjective plural |
  | `appris à connaître` → `appris a connaitre` | homophone a/à **+ reform « connaitre »** |
  | `ses grands yeux` → `ces grands yeux`, `là où` → `la où` | homophones ces/ses, là/la |
  | `sa maîtresse` → `sa maitresse` | **reform « maitresse »** |

Runtime notes captured by the spec (identical in both orientations unless stated):

```
OCR wait: 0.5 s
scan textarea attributes: {"autocorrect":"off","autocapitalize":"sentences","autocomplete":null,"spellcheck":"false","lang":"fr"}
« À vérifier » chips: none shown            (also none for handout-rotated.jpg, probed through the API)
red scan (scan verify / grimoire results / chain results / alexandria error): []
Fil tap « étalaient » (medium conj chain): Le fil d'Ariane s'emmêle sur ce verbe. Essaie un autre verbe.
Fil tap « riaient » (high chain): Verbe : « riaient ». Maintenant, touche son sujet.
Fil tap wrong subject « balle »: Le fil ne tient pas. Le sujet, c'est qui fait l'action de « riaient ». Réessaie.
Fil tap subject « filles »: Le fil est tendu : « riaient » ↔ « Les jeunes filles » (pluriel). Vérifie la terminaison du verbe.
Fil two wrong subjects for « roula »: Le fil te guide : le sujet de « roula », c'est « la balle » (singulier).
Fil (dictation) tap « taisait »: Verbe : « taisait ». Maintenant, touche son sujet.   ← her spelling, not the reference
grimoire results (landscape): Dés-accords retrouvés : 3 sur 7 (43 %) / Score : 361 / Fils d'Ariane tendus : 1 sur 2
grimoire results (portrait):  Dés-accords retrouvés : 4 sur 7 (57 %) / Score : 397
chain results: Pièges déjoués : 2 sur 11 (18 %) / Score : 306      (12 planted, 2 reform spellings → 11 errors: reform accepted)
reform variants flagged as errors (connaitre, maitresse, ognon, connaitre, paraitre): 0
festin: « l'évènement » flagged → "Un accent change tout : « l'événement », pas « l'évènement »."   ← reform NOT accepted after an elision
Alexandria failure wait: 0.5 s; refresh (Verne) wait: 0.4 s; 7 chunks
```

Éris's plants (Grimoire, « Nausicaa et la lessive », 133 words → 7 plants, different per run):
- landscape: `le→la` [gender], `soleil→soleils` [number], `épuisé→épuise` [accent], `couvert→couverte`
  [participle], `immobile→imobile` [lexical], `couvert→couverts` [lexical], `si→s'y` [homophone]
- portrait: `étalaient→étala` [verb], `une→un` [gender], `roula→roulèrent` [verb], `ce→se` [homophone],
  `effrayées→effrayés` [participle], `sorti→sortie` [participle], `rassurée→rassurer` [lexical]

## 2. Screen-by-screen notes

File names are `ipad-landscape-…` / `ipad-portrait-…`; both were inspected.

### 01 Add menu (`01-add-menu`)
- Works: the FAB opens a bottom sheet « Ajouter un parchemin » with three big cards (📝 « Taper ou
  coller un texte — Un texte que tu as sous la main. », 📷 « Scanner une feuille — Prends en photo
  une feuille imprimée (pas de manuscrit). », 📜 « Bibliothèque d'Alexandrie — Des textes classiques
  recopiés pour toi. ») and « Fermer ». Clear, 56 px targets, the subtitles say exactly what each
  does. The backdrop dims the library. Good.
- In landscape the sheet is 1180 px wide with three 40 px-tall rows: a lot of empty width; a
  centered max-width 640 px sheet would read as a card rather than a drawer.

### 02 Scan — capture (`02-scan-capture-empty`, `02-scan-capture`, `02b-scan-reading`)
- Works: one explanatory card (« Prends la feuille imprimée en photo, bien à plat et en pleine
  lumière. Une photo par page. L'écriture à la main ne marche pas. »), two full-width buttons
  « Prendre une photo » (primary, `capture="environment"`) / « Choisir dans les photos », a 120 px
  thumbnail with « Retirer », then « Lire le texte ». While reading: « Les scribes déchiffrent la
  feuille… » in grey under the button (no spinner). With the fixture the OCR took 0.5 s so the
  waiting state is barely visible; on a real 12 MP iPad photo it will be several seconds with only a
  grey sentence and a still-enabled-looking page.
- « Lire le texte » stays visible but disabled before a photo is chosen (good affordance).

### 03 Scan — verify (`03-scan-verify`)
- Works: « Vérifie le texte avec la feuille », the photo left / textarea right in landscape
  (two 520 px columns, the photo is legible at 1180 px: the fixture's 20 px serif renders at ~11 px,
  readable but small), stacked photo-then-textarea in portrait (photo 780×540, then the textarea:
  **she must scroll between paper and text** in portrait, but the photo is fully legible there).
  Word count « 46 mots », the hint « Corrige chaque mot qui diffère de la feuille : ce texte devient
  la clé de correction. » — this is the one line that tells her she is the answer key. Correct and
  important; it is 14 px grey under the textarea.
- OCR quality on the fixture: perfect, including the hyphenated « vil-lage » merged to « village
  endormi » and paragraph breaks kept. The handout's title line « Dictée préparée — Les fées de la
  clairière » is kept in the text (she has to delete it herself — the spec did).
- **No « À vérifier » chips appeared**, for either fixture (also probed `handout-rotated.jpg`
  directly on `POST /api/scan`: `low_confidence: []`). `LOW_CONF = 60` in `server/app/ocr.py` is
  never reached on clean prints, so the feature is untested on real photos and the review cannot
  judge chip usefulness. On a phone photo of a photocopied handout Tesseract routinely gives
  40–70 on accented words; the threshold seems right but needs one real photo in the fixtures.
- Textarea attributes: `autocorrect=off`, `spellcheck=false`, `lang=fr`, but
  **`autocapitalize="sentences"`** and no `autocomplete=off`. This is the *reference* she is
  typing into: iOS will capitalise after every full stop she types when fixing OCR (fine) but also
  after an abbreviation or a dialogue line break — a capital slipped into the answer key becomes a
  « Majuscules et ponctuation » error for everyone who plays the text later.
- « Le texte est juste » is the primary button; « Reprendre une photo » secondary. Right emphasis.

### 04 Scan — details (`04-scan-details`)
- Works: « Détails du parchemin », Titre, Niveau (full-width select, pre-filled 10H), « Dictée pour
  le » date input with hint « Si c'est une dictée préparée, indique la date du test : elle devient
  une prophétie de l'Oracle. », Auteur, Œuvre, « Sauvegarder dans les Parchemins ». The date input
  shows `15.10.2026` (Swiss format from the locale). Good.
- Same SP1 form imbalance: 240 px text inputs, 1070 px select.
- No public-domain hint for Auteur/Œuvre (a scanned handout is a class text — fine — but the
  same form is used for anything printed).

### 05 Library with a prophecy (`05-library-prophecy`, `16c-library-after-sp2`)
- Works, and it is the best new library moment: a new top section **« Prophéties de l'Oracle — Les
  dictées préparées pour l'école, à réviser avant le jour dit. »** with the card carrying an olive
  « Scanné » chip and a **gold « Prophétie : 15.10.2026 »** chip. The scanned text is excluded from
  the « À ton niveau » grid (not shown twice). The adopted Verne scroll appears at the end under
  « Autres parchemins » with an Aegean « Alexandrie » chip and its credits.
- The prophecy section is a plain h2 and one card; nothing says how many days are left, and the
  gold chip is the only visual difference from any other card. « Prophétie : 15.10.2026 » is
  fiction-correct but a 13-year-old wants « dans 21 jours ».
- The « + Ajouter un texte » FAB now floats over the empty last cell of a row (`16c`, over
  « Voyage au centre de la Terre » in portrait: **still overlaps card text** when the row is full).

### 06 Play intro of a scanned prophecy (`06-play-intro-prophecy`, `06b-scan-dictation`)
- Works: title, chips, the gold line **« Dictée préparée pour le 15.10.2026 — la prophétie de
  l'Oracle. »**, a « Voir la feuille » / « Cacher la feuille » toggle showing the stored photo (full
  width, 570 px tall), then the pace grid and both buttons « Commencer la dictée » / « Grimoire
  corrompu » with the hint « Éris a déjà recopié ce texte… avec ses dés-accords. Pas de dictée :
  relis et répare. ». The photo pushes the pace cards below the fold in both orientations while
  open — acceptable because she opened it.
- **Spec §3.3 check passed:** during the dictation of the scanned text the DOM contains no
  `img[src*="/api/scan/"]` and no word of the text (« clairière »). The dictation screen has the
  SP1-review fixes: « ← Quitter » top-left, « Phrase 1 sur 5 » while the first sentence plays.
- Portrait pace grid is still 3 + 1 (`ipad-portrait-06`).

### 07 Grimoire corrompu — intro (`07a-play-intro-with-grimoire-button`, `07-grimoire-intro`)
- Works: from the normal intro one tap on « Grimoire corrompu » gives a screen titled **« Grimoire
  corrompu »** (the text title only in the top bar), credits, chips, one line « Éris a recopié ce
  parchemin en y semant ses dés-accords. Pas de dictée cette fois : retrouve-les et répare-les. »
  and a terracotta « Ouvrir le grimoire ». While corrupting: « Éris corrompt le grimoire… ». One
  tap later she is proofreading. Friction: library card → intro → Grimoire → Ouvrir = 3 taps.
- It is the emptiest screen of the game: 890 px of beige under one paragraph. No grimoire, no
  Éris, no count (« Éris y a caché 7 dés-accords » would be the hook, at stage 1–2 where the count
  is otherwise hidden it could stay vague: « une poignée »). The word « grimoire » is not in the
  Greek world's vocabulary (it is Harry Potter's); she will like it, the Muses less so.

### 08 Grimoire — proofreading (`08-grimoire-proofreading`, `10c-grimoire-before-done`)
- Works: exactly the SP1 proofreading screen with the header **« Grimoire corrompu »** and the
  subtitle **« Éris a corrompu ce grimoire. Les Yeux d'Argus éclairent une catégorie à la fois. »**;
  three Argus chips (Verbes, Groupes nominaux, Homophones — the empty Mots-pièges pass is now
  skipped, SP1 P1-5 fixed), the four tools including the new **« 🧵 Fil d'Ariane »**, her text as
  tappable tokens with the Verbes spotlight. Portrait stacks cleanly (37 chars/line).
- Éris's plants are plausible and *in* the spotlight where they belong: « la linge », « le
  soleils », « couverte », « s'y respectueuses », « imobile »; in portrait « étala », « roulèrent »,
  « un balle », « se rivage », « effrayés », « sortie », « rassurer ». The Verbes pass lights the
  planted « épuise » (aligned to the participle « épuisé ») — good, she can find it.
- **Does it feel like a mode of its own?** No. Title and subtitle differ; everything else — chips,
  tools, text box, « J'ai terminé ma relecture » — is identical to the post-dictation screen. There
  is no corrupted-grimoire framing (no parchment texture, no Éris glyph, no different button label
  such as « Le grimoire est réparé »). Functionally it is the right screen; emotionally it is the
  same screen with a different h2.
- Quality of the plants (pedagogy): two are questionable. `étalaient → étala` is a **tense**
  change (imparfait → passé simple), not a number flip — `lexicon.flip_number` picked the most
  frequent 3sg form of *étaler* (the passé simple) instead of the imparfait; the results then call
  it « Accord du verbe avec son sujet » with « terminaison « ient » » (see §4). `épuisé → épuise`
  (accent plant) turns a participle into a present-tense verb form, graded as « Participes passés
  (Protée) » with the generic être/avoir sentence although « un naufragé … épuisé » is adjectival.
  `soleil → soleils` plants on the **head noun** itself (« par le soleils »), which the explanation
  cannot handle (see §4).

### 09–10 Fil d'Ariane (`09-fil-pick-verb`, `09b-fil-medium-chain`, `09c-fil-verb-picked`, `10-fil-thread`, `10b-fil-guided`, `12a-fil-on-typed-error`)
- Works: tapping « 🧵 Fil d'Ariane » turns the chip Aegean and opens an Aegean panel **« Touche un
  verbe, puis son sujet. »** with « Quitter le fil ». Taps then drive the thread instead of the
  editor (the token `aria-label` switches to « Fil d'Ariane : choisir « … » »). Messages seen:
  - noun « plage »: « Ce mot ne semble pas être un verbe conjugué. Cherche un mot qui dit ce que
    fait quelqu'un. » — kind, correct.
  - medium-confidence verb « étalaient » (coordinated subject): **« Le fil d'Ariane s'emmêle sur ce
    verbe. Essaie un autre verbe. »** — the spec's high-confidence-only rule, verified. Same for the
    `qui`-relatives « l'entendait » / « attendait » and the conj « coupait ».
  - high-confidence verb: **« Verbe : « riaient ». Maintenant, touche son sujet. »**, the verb gets
    a 3 px Aegean outline; wrong subject « balle »: **« Le fil ne tient pas. Le sujet, c'est qui
    fait l'action de « riaient ». Réessaie. »**; right subject « filles »: **« Le fil est tendu :
    « riaient » ↔ « Les jeunes filles » (pluriel). Vérifie la terminaison du verbe. »** and the
    three subject words get a gold underline. Second failure: **« Le fil te guide : le sujet de
    « roula », c'est « la balle » (singulier). »**.
  - On her own wrong verb in the dictation flow: **« Verbe : « taisait ». Maintenant, touche son
    sujet. »** — quotes *her* spelling « taisait », never « taisaient ». **No answer leak** in any
    Fil message, in either mode (the subject group is also read from her tokens).
- **Discoverability of the two-tap flow:** the panel sentence is enough for the first tap; the
  second tap is prompted explicitly (« Maintenant, touche son sujet »). Good. What is not
  discoverable: which verbs the Fil accepts. Of the 22 lit verbs in « Nausicaa », only 8 have a
  high-confidence subject chain; a third of her taps will answer « s'emmêle ». The message is
  honest but she cannot predict it, and after two « s'emmêle » she will conclude the tool is
  broken.
- **Does the thread feel rewarding?** Half. The message is well written and the number word
  (« pluriel ») is exactly the cue she needs. But the *thread* is a sentence in a box: the gold
  underline under « Les jeunes filles » sits on tokens dimmed to 30 % by the Verbes spotlight
  (`10-fil-thread`) so it is faint, there is no line drawn between subject and verb, no motion,
  no sound, and the panel never says whether the verb she checked is actually right. The results
  line **« Fils d'Ariane tendus : 1 sur 2 »** is the only trace.
- **State bug:** after a thread is drawn the panel stays open in its « done » state and the chip
  stays active, but the next tap on any word **leaves the Fil silently and opens the word
  editor** (observed in run 3 of the spec: tapping the next verb opened « Nouveau mot » with
  « roula »). She will tap a second verb expecting a second thread and get a text field instead;
  to draw another thread she must « Quitter le fil » and tap the chip again. The spec notes record
  `Fil still active after a drawn thread: true`.
- The counter attempts: 2 (then guided). Right for a 13-year-old.

### 11 Grimoire — results (`11-grimoire-results`, `11b-grimoire-explanation`, `11c-stats-after-grimoire`)
- Works: **« Éris, agacée : »** with grimoire-specific lines (« Ha ! Quelques dés-accords retrouvés.
  Le grimoire commence à se réparer. » at 43 %; « Hmpf. La moitié de mes dés-accords retrouvés. Le
  grimoire garde encore quelques secrets… » at 57 %), the hero line **« Dés-accords retrouvés : 3
  sur 7 (43 %) »**, « Score : 361 », « Mots justes : 129 / 133 », **« Fils d'Ariane tendus : 1 sur
  2 »**, the text with orange underlines (missed) and olive dotted (fixed), popover « Attendu : « le »
  — « le » s'accorde avec le nom « linge » → masculin singulier », then « Ce qu'Éris a tenté ».
  Stats: the session row gets a grey **« Grimoire »** chip, « Par catégorie » counts the plants.
- The wording is consistent with the intro (« dés-accords », « retrouvés », « réparer »); « Ce
  qu'Éris a tenté » and « déjoué ✓ » are the dictation words but still fit. « Mots justes : 129 /
  133 » is meaningless in a mode where she typed nothing — it measures Éris, not her.
- **Data pollution at `92e47a1`:** « Mots-pièges » in the stats shows **« immobile boîte 1 »** — the
  word Éris misspelled (« imobile ») and she *caught* entered her personal trap list
  (`update_trap_words` adds every lexical `draftErrors`, and in grimoire mode the draft is Éris's).
  Her next dictation's « Mots-pièges » pass will light a word she never got wrong. (Main already
  carries `b686bc5 "Fix I-5: Grimoire sessions never create or reset mots-pièges"`, after this
  commit.)

### 12 Chain explanations after a dictation (`12-results-chain-explanation`, `12b-results-qui-explanation`, `12c-results-conj-reform`, `12d-results-etre-participle`)
- Works: the same results layout; the popover under the text repeats the list sentence with
  « Attendu : « … » ». Explanations are now chain-based and most of them are what SP1 asked for:
  - **« taisaient » s'accorde avec son sujet « Les autres oiseaux » → pluriel → terminaison « ent »** —
    the SP1 P1-1 index-drift bug is fixed: the subject is named correctly despite the elisions
    before it.
  - **« l'entendaient » s'accorde avec « qui », qui reprend « Les habitants » → pluriel → terminaison
    « ent »** — the qui-relative reads exactly like a teacher would say it. Same for « attendaient …
    « qui », qui reprend « Les invités » ».
  - **« veillait » s'accorde avec son sujet « la déesse » → singulier → terminaison « t »** — correct
    (the trap was the plural « en pensant que la déesse … veillaient sur leur ville »).
  - **« endormis » s'accorde avec le nom « toits » → masculin pluriel**, « étroites » … « ruelles »
    → féminin pluriel, « dorés » … « yeux » → masculin pluriel — SP1 P1-2 fixed: the adjectival
    participle is explained as a noun-group agreement, not with the être/avoir rule.
  - **Avec « être », le participe « fatiguées » s'accorde avec le sujet « Les Muses » → féminin
    pluriel** and « arrivées » s'accorde avec le nom « Muses » → féminin pluriel — both correct.
  - The remaining ones are wrong or misleading — see §4 and the P1 table.
- **Reform variants:** « connaitre », « maitresse », « ognon », « connaitre », « paraitre » were
  not flagged (the chain text had 12 substitutions and « Pièges déjoués : 2 sur 11 »). But
  **« l'évènement » was flagged** — « Un accent change tout : « l'événement », pas « l'évènement ». »
  The reform table is consulted on the whole client token `l'évènement`, which is not in
  `pairs`; the elided article defeats the lookup. The game tells her a correct spelling is wrong.
- The homophone hints are still the full-set dumps from SP1 (ces/ses/c'est/s'est/sais/sait: 4
  lines; la/l'a/l'as/là: 3 lines) — SP1 P2-2 not addressed.

### 13–16 Bibliothèque d'Alexandrie (`13-alexandria-works`, `13b-alexandria-work-empty`, `13c-alexandria-refreshing`, `14-alexandria-error`, `15-alexandria-chunks`, `16-alexandria-adopted`, `16b-alexandria-play-intro`)
- Works: a **header illustration** (the library, statue, armillary sphere — the first piece of art
  in the game and it lands), the line « Les scribes d'Alexandrie recopient des œuvres anciennes.
  Choisis une œuvre, puis un rouleau à ajouter aux Parchemins. », 19 work cards with title,
  credits (author, work, « trad. » translator), chips « niveau 6H » and status (« Pas encore
  recopié » / **orange « Hors d'atteinte »** / « 7 rouleaux »). 4 columns landscape, 3 portrait.
- Work screen: title, bold credits, the small line **« Les traducteurs et auteurs sont dans le
  domaine public. »**, a primary « Recopier depuis la Bibliothèque » (→ « Recopier à nouveau » once
  cached), « Les scribes recopient… (cela peut prendre une minute) » while waiting, level filter
  chips (48 px), scroll cards **« Rouleau 3 · 11H · ≈ 110 mots · ★★★★★ »** with an italic
  preview and « Ajouter aux Parchemins » (→ Aegean confirmation « Rouleau ajouté aux Parchemins. »
  + « Jouer maintenant » / « Continuer à fouiller »; later « Déjà dans les Parchemins · Jouer »).
- **Failure banner** (Daudet, no fixture): orange-light box **« La Bibliothèque d'Alexandrie est
  hors d'atteinte pour le moment. La Bibliothèque d'Alexandrie est inaccessible pour le moment
  (fichier introuvable: /fixtures/alexandria/wikisource/lettres-de-mon-moulin-installation.html)
  Les rouleaux déjà recopiés restent disponibles. »**, then « Aucun rouleau pour le moment. ». The
  app never crashed, the works list reflects the failure with the « Hors d'atteinte » chip, and the
  third sentence is exactly the reassurance wanted. But the banner says « hors d'atteinte pour le
  moment » **twice** (client wrapper + server detail) and prints a **container file path** to a
  13-year-old. With a real network error the detail would be an httpx message in English.
- **Does it read as a library?** The works grid does (illustration + classics + credits). The
  scrolls screen reads as a search result: cards sorted by score, « Rouleau 3 » before « Rouleau 1 »,
  a 9H work whose first four scrolls are **11H**, stars whose meaning (« Richesse en accords ») is
  only a mouse `title` tooltip — invisible on iPad. « Vingt mille lieues » and « Les Trois
  Mousquetaires » appear **twice** in the works grid (Wikisource and Gutenberg entries) with
  identical cards; nothing tells her which to choose.
- Success banner after the Verne refresh: **« 23 page(s) n'ont pas pu être lues. »** in olive — a
  fixture artefact (one page provided) but the wording will appear in production whenever a
  chapter page is missing; « page(s) » is the SP1 plural hack again, and « n'ont pas pu être
  lues » on a *success* banner reads as failure.
- Adopted text: title **« Vingt mille lieues sous les mers — rouleau 3 »**, credits « Jules Verne,
  Vingt mille lieues sous les mers » on the intro and in the library with the « Alexandrie » chip.
  Public-domain credits: shown everywhere (works, scrolls, intro, library card). Spec conformance
  passed.
- Pacing: fixtures make both refreshes instant (0.4–0.5 s); the spinner sentence promises « une
  minute », honest for the real fetch (20 s httpx timeout per page × pages).

## 3. As a 13-year-old fantasy fan

**Grimoire corrompu — fun or homework?** Closer to fun than the dictation, and that is the point:
no ten minutes of typing, straight to the hunt. « Éris a recopié ce parchemin en y semant ses
dés-accords » is a good premise, « Ouvrir le grimoire » is a good button, and the plants are the
kind of thing she actually gets wrong (« la linge », « un balle », « effrayés », « s'y »). What
turns it back into homework: the grimoire screen *is* the relecture screen. Same chips, same box,
same button. Nothing was corrupted visually, nothing is repaired visually when she fixes a word.
The results line « Dés-accords retrouvés : 4 sur 7 (57 %) » and Éris's « Le grimoire garde encore
quelques secrets… » are the only payoff — good lines, but there are no three remaining secrets to
go and find (no replay with the same plants, no reveal of where they were beyond the underlines).
She would play it twice in a row, which she would never do with the dictation.

**Is Éris's voice consistent?** Yes. The new lines — « Éris a corrompu ce grimoire. », « Quoi ?!
Tu as trouvé tous mes dés-accords dans ce grimoire. Je le corromprai mieux la prochaine fois. »,
« Le grimoire commence à se réparer. », « Mes dés-accords sont restés bien cachés dans ce
grimoire. Cette fois. » — are the same sore-loser goddess as SP1, and they never mock her. The
Fil's voice is not Éris's and not the Muses' either; « Le fil d'Ariane s'emmêle sur ce verbe » and
« Le fil te guide » are neutral-kind, fine. The scan and Alexandria copy is the Muses' scribe
register (« Les scribes déchiffrent la feuille… », « Les scribes recopient… ») — consistent, and
« Prophétie de l'Oracle » for a class test date is the one genuinely witty idea of SP2.

**Does Alexandria feel like a real place?** The entrance does: the illustration is the first time
the game *looks* like anything, and a grid of Verne, Dumas, Poe, Kipling with « trad. » credits
feels like shelves. Inside a work it stops being a place: « Rouleau 3 · 11H · ★★★★★ » is a
catalogue row, and « 23 page(s) n'ont pas pu être lues. » / a file path in an error box is the
back office showing through. A 13-year-old will not know what « Recopier depuis la Bibliothèque »
does before pressing it, and will wonder why « Les Trois Mousquetaires » is there twice.

**Would she scan a handout before a test?** Yes, if a parent shows her once. The flow is four
taps plus typing a title and date, the photo-beside-text verification is exactly what she does at
her desk anyway, and the reward is real: her own class dictation shows up as a gold « Prophétie :
15.10.2026 » card at the top of the library, and the game reads it to her. This is the feature
that connects the game to Thursday's test; it is the most useful thing in SP2 for her, even if it
is the least « game ».

**Which of the three would she talk about?** The Grimoire (« Éris wrote my text wrong and I have
to find the 7 mistakes ») — it is describable in one sentence and it is a challenge. Then the
scan (« it turns my dictée into a prophecy »). Alexandria is for the parent.

**Frustrating.** The Fil answering « s'emmêle » on a third of the verbs with no way to know
which ones will work; the Fil turning into the word editor after one thread; « Un accent change
tout : « l'événement », pas « l'évènement » » when her teacher taught her « évènement » is fine
(she *will* argue with the iPad); « couplaient a plusieurs sujets : « soir et cuisinier et fille » »
— she knows « le soir » is not a subject, and the game's credibility drops exactly where it should
be highest.

**Delightful.** The gold prophecy chip. « Le fil est tendu : « riaient » ↔ « Les jeunes filles »
(pluriel). » « « qui », qui reprend « Les habitants » ». Éris's grimoire lines. The Alexandria
painting.

## 4. As a game designer

**Friction.** Library → text → « Grimoire corrompu » → « Ouvrir le grimoire » → proofreading = 3
taps from a card; acceptable, but the grimoire is only reachable *through* the dictation intro, so
the library never shows it as a thing that exists (no « Grimoire » chip, no filter, no « Éris a
corrompu 3 parchemins » hook). Library → scanned text → « Commencer la dictée » = 2 taps, same
as any text. Library → FAB → Alexandrie → work → Recopier → wait → Ajouter → Jouer maintenant →
intro = 7 taps and one wait for a first scroll; fine for a parent, long for her.

**Clarity — is it clear that she is the answer key when verifying a scan?** Partly. The heading
« Vérifie le texte avec la feuille » and the button « Le texte est juste » say *what*; only the
14 px grey hint says *why* (« ce texte devient la clé de correction »). Nothing marks what she
should look at: no « À vérifier » chips ever appeared (threshold never crossed on the fixtures),
no diff against a dictionary, no per-paragraph confirmation. A child who trusts machines will
press « Le texte est juste » in two seconds. The consequence (an OCR error graded as correct
forever, for every profile) is the single most expensive mistake a player can make in this game
and the UI treats it as a formality.

**Fun — Fil d'Ariane as a mechanic vs. a checkbox.** As designed it is a mechanic: two taps,
feedback on each, a bounded number of attempts, a per-session tally. As shipped it is a
checkbox with good copy: the thread is invisible (a faint underline on dimmed words, no line, no
motion), the success state does not tell her anything she can act on beyond « Vérifie la
terminaison », and it does not connect to the edit (after « Le fil est tendu » the natural next
tap — on the verb, to fix it — silently exits the tool, which is right, but nothing says so). The
gating to high-confidence chains is correct per spec and it is honest, but it makes the tool feel
random. It is also unrewarded: no score bonus, no Éris reaction, and the results line « Fils
d'Ariane tendus : 1 sur 2 » counts a guided failure as a drawn thread.

**Tone.** No blame anywhere; orange not red — the computed-style scan found **no red-dominant
colour** on the scan verify, both results screens and the Alexandria error (`[]` in all four).
« hors d'atteinte », « s'emmêle », « Le fil te guide », « à vérifier » are all right. Two
off-tone strings: the server's file path in the Alexandria banner, and « 23 page(s) n'ont pas pu
être lues » in an olive (success) box.

**Pacing.** OCR and Alexandria were instant on fixtures, so the waiting states could not be
judged for duration; the copy is fine (« Les scribes déchiffrent la feuille… », « Les scribes
recopient… (cela peut prendre une minute) ») but neither has a spinner or a disabled-page state,
and both leave the primary button visible. A grimoire session on a 133-word text is 7 plants
found in 2–5 minutes: this is the 10-minute « chapter » the spec wants, with no dictation tax.

**Feedback.** Results wording in grimoire mode is consistent (« Dés-accords retrouvés », the
three Éris lines, « Le grimoire commence à se réparer »). « Mots justes : 129 / 133 » should not
be shown in this mode. The threads line is correct but tiny.

**Pedagogical correctness of every explanation seen** (both orientations; verdict in bold):

| Explanation (verbatim) | Context | Verdict |
|---|---|---|
| « taisaient » s'accorde avec son sujet « Les autres oiseaux » → pluriel → terminaison « ent » | Chouette | **correct** (SP1 P1-1 fixed) |
| « distinguaient » s'accorde avec son sujet « autres » → pluriel → terminaison « ent » | « les autres ne distinguaient » | correct but **truncated**: the subject is « les autres »; medium chain's controller group holds only the pronoun |
| « l'entendaient » s'accorde avec « qui », qui reprend « Les habitants » → pluriel → terminaison « ent » | qui-relative | **correct, excellent** |
| « veillait » s'accorde avec son sujet « la déesse » → singulier → terminaison « t » | attraction trap | **correct** (« la déesse elle-même » would be fuller) |
| « endormis » / « étroites » / « dorés » s'accorde avec le nom « toits » / « ruelles » / « yeux » → … pluriel | adjectives | **correct** (SP1 P1-2 fixed) |
| **« choisie » s'accorde avec le nom qu'il accompagne → féminin** | « Athéna l'avait choisie » | **wrong rule.** Participle with *avoir* and COD « l' » before; there is no noun it « accompanies ». Classified `agreement:gender` (Chimère) because the chain builder produced no `participle_avoir` chain for this clitic COD; the gender fallback then applies the noun-group sentence. Should be « Avec « avoir », le participe « choisie » s'accorde avec le complément « l' » (= la chouette) placé avant → féminin », or at least the SP1 generic participle sentence. |
| **« coupaient » a plusieurs sujets : « soir et cuisinier et fille » → pluriel → terminaison « ent »** | « Le soir de l'événement, le cuisinier et sa fille coupaient » | **wrong.** « soir » is a time adverbial, not a subject; spaCy attached it as a conj member and the medium-confidence chain is still used for the explanation. Also the group loses its determiners (« le cuisinier et sa fille »). Teaches a false subject. |
| « étalaient » a plusieurs sujets : « princesse et servantes » → pluriel → terminaison « ient » | Grimoire plant `étalaient→étala` | **misleading twice**: the group is rendered as bare head nouns (« la princesse Nausicaa et ses servantes » expected), and « terminaison « ient » » is the diff suffix of a *tense* change, not the plural ending « -aient ». |
| « roula » s'accorde avec son sujet « la balle » → singulier → terminaison « a » | Grimoire plant `roula→roulèrent` | **correct** |
| **« soleil » s'accorde avec le nom qu'il accompagne → singulier** | Grimoire plant `soleil→soleils` on « par le soleil » | **wrong.** « soleil » *is* the noun; the sentence tells her a noun agrees with a noun it accompanies. Planting on a nominal-chain controller should either be excluded or explained as « « le » et « soleil » vont ensemble → singulier ». |
| « couvert » s'accorde avec le nom qu'il accompagne → singulier | plant `couvert→couverts` (« couvert d'un rameau », Ulysse) | acceptable generic; « avec « Ulysse » » was available in principle |
| « le » s'accorde avec le nom « linge » → masculin singulier; « une » … « balle » → féminin singulier; « couvert » … « naufragé »; « sorti » … « homme »; « effrayées » … « servantes » → féminin pluriel | Grimoire | **correct** |
| Participe passé « épuisé » : avec être, il s'accorde avec le sujet ; avec avoir, seulement si le complément est placé avant. | plant `épuisé→épuise` (« dormait, épuisé, un naufragé ») | **misleading**: adjectival participle in apposition, no auxiliary; the plant is an accent/verb-form slip, graded as Protée. Same SP1 P1-2 pattern, surviving where no chain covers the token. |
| Avec « être », le participe « fatiguées » s'accorde avec le sujet « Les Muses » → féminin pluriel | festin | **correct** |
| « arrivées » s'accorde avec le nom « Muses » → féminin pluriel | apposition | **correct** |
| « attendaient » s'accorde avec « qui », qui reprend « Les invités » → pluriel → terminaison « ent » | festin | **correct** |
| « joyeuses » / « impatients » s'accorde avec le nom qu'il accompagne → pluriel | « restaient joyeuses », « semblaient impatients » | **misleading**: attributes of the subject after a copula; there is no accompanying noun. No `attribute` chain was built for *rester/sembler*. Should fall back to « s'accorde avec le sujet » or the fully generic sentence. |
| **Un accent change tout : « l'événement », pas « l'évènement ».** | reform spelling | **wrong**: « évènement » is the 1990 spelling the spec accepts; fails only because the token is elided (`l'évènement`). |
| « a » ou « à » ? … / « ces » ou « ses » ? … / « la » ou « là » ? … / « se » ou « ce » ? … / « s'y » ou « si » ? … | homophones | **correct**, still too long (SP1 P2-2) |
| « rassurer » ou « rassurée » ? Après un mot comme « avoir » ou « être », c'est un participe (-é) ; quand on peut remplacer par « vendre », c'est l'infinitif (-er). Ici : « rassurée ». | plant `rassurée→rassurer` (« la jeune princesse, rassurée, ordonna ») | acceptable: the « vendre » test works; the avoir/être clause does not apply here |
| Ce mot s'écrit « immobile ». Il rejoint tes mots-pièges pour t'entraîner. | Grimoire plant `imobile` | **correct sentence, wrong consequence** at 92e47a1: Éris's misspelling entered *her* mots-pièges (fixed on main, b686bc5) |

**Answer leaks.** None found. Fil messages quote her typed words in both modes; the reference
never appears in the DOM during the dictation of a scanned text; the photo is intro-only; the
grimoire's proofreading shows Éris's text only. The results screen reveals expected forms — by
design.

**Key question — does the Grimoire corrompu make proofreading the core game more than the
dictation does?** Yes, structurally, and it is the most important thing SP2 did for the design
thesis: a session is now *only* the hunt, 100 % of the time is spent on the trained skill, the
errors are chosen by the profile's weaknesses, Éris finally acts (she corrupts, she taunts about
the grimoire), and the metric on screen is the catch rate under another name. It also fixes SP1's
pacing complaint (dictation ≈ proofreading in time). What it does not yet do is *look* like the
core game: it borrows the dictation's proofreading screen wholesale, it is hidden behind the
dictation intro, and it has no loop of its own (no « encore 3 dés-accords, veux-tu les chercher ? »,
no second pass on the same plants, no Éris line during the hunt). Dictation still owns the
library, the intro, the pace cards and the fiction of « protéger un texte »; the grimoire is a
secondary button on that screen. In SP3 the grimoire should be the default « Éris a frappé » play
action and the dictation the « préparer une dictée » one.

**iPad ergonomics.** Touch targets ≥ 44 px everywhere new (menu 56, tools 44, level chips 48,
adopt buttons 48). Portrait verify screen stacks photo then text (scrolling between them). No
horizontal scroll anywhere. Native date input works. The Fil panel wraps to two lines in
portrait with « Quitter le fil » below the message (fine).

## 5. Prioritised findings

Legend: **P0** blocks play · **P1** hurts the core loop / teaches something wrong · **P2** polish ·
**P3** later. Screen → evidence → suggested fix.

| Prio | Screen | Finding | Evidence | Suggested fix |
|------|--------|---------|----------|---------------|
| **P0** | — | *None.* Every SP2 flow completes in both orientations; no crash on the Alexandria failure; no red; no answer leak. | run log `2 passed`, `red scan: []` ×4 | — |
| **P1-1** | Results | **Reform spelling rejected after an elision**: « Un accent change tout : « l'événement », pas « l'évènement ». » (`12c`). `reformCanon` runs on the whole client token `l'évènement`; the `pairs` lookup never matches. Same for `d'ognon`, `l'ognon`, `qu'il connaisse`… | `12c-results-conj-reform`, notes `festin explanations` | In `normalize`/`reformCanon`, split a leading elision (`^(l|d|qu|j|n|m|t|s|c)['’]`) off before the table lookup and re-attach it; add a unit test with « l'évènement »/« l'événement » and « d'ognon ». |
| **P1-2** | Results | **False subject named in a conj explanation**: « « coupaient » a plusieurs sujets : « soir et cuisinier et fille » → pluriel » (`12c`). The medium-confidence conj chain includes a non-subject conj member; explanations use medium chains. Also the group drops determiners (« princesse et servantes » for « la princesse Nausicaa et ses servantes », `ipad-portrait-11`). | `12c`, `ipad-portrait-11-grimoire-results` | Server: only accept conj members whose head is the `nsubj` (or that are `conj` of the nsubj) and downgrade to `low` when a member is `obl`/`nmod`; or client: for `via: 'conj'` at medium confidence fall back to « « coupaient » a plusieurs sujets → pluriel ». Render each member with its det/adj group (« le cuisinier et sa fille »). |
| **P1-3** | Results | **Participle with avoir explained as a noun-group agreement**: « « choisie » s'accorde avec le nom qu'il accompagne → féminin » for « Athéna l'avait choisie » (`12`). No `participle_avoir` chain when the COD is the clitic `l'`; the `gender` fallback uses the noun-group sentence. | `12-results-chain-explanation`, popover « choisi » | Server: build `participle_avoir` (`rule: cod_before`) when the `obj` is a clitic pronoun (`l'`, `la`, `les`, `que`) preceding `avoir`; client: when `e.sub ∈ {gender, number}` but the reference token's `morph.VerbForm === 'Part'` and its head is `AUX/VERB`, use the participle template instead of « le nom qu'il accompagne ». |
| **P1-4** | Grimoire | **Wrong-tense plant**: `étalaient → étala` (imparfait → passé simple) labelled « Accord du verbe avec son sujet … terminaison « ient » ». `lexicon.flip_number` chooses the most frequent form matching the flipped person code without pinning tense/mood. | `ipad-portrait-08`, `ipad-portrait-11`, notes `Éris planted` | In `flip_number`, require the candidate's `infover` to share the original's tense/mood tag (e.g. `ind:imp:3s` ↔ `ind:imp:3p`), never just the person/number; skip the token when no such form exists. `verbEnding` should then produce « aient ». |
| **P1-5** | Grimoire / Results | **Plant on a head noun explained as an adjective**: `soleil → soleils` (« par le soleils ») → « « soleil » s'accorde avec le nom qu'il accompagne → singulier ». | `08-grimoire-proofreading`, `11-grimoire-results` | Exclude nominal-chain *controllers* (`t["i"] == c["controller"]`) from `agreement:number` candidates in `corrupt.candidates`, or give them their own explanation (« le déterminant « le » et le nom « soleil » vont ensemble → singulier »). |
| **P1-6** | Stats (at `92e47a1`) | Éris's lexical plants enter the child's **mots-pièges** (« immobile boîte 1 » after a grimoire where she caught « imobile »); the next Mots-pièges pass lights words she never misspelled. | `11c-stats-after-grimoire` | Already fixed on main (`b686bc5`): in grimoire mode never insert/reset trap words. Verify the fix also ignores *missed* plants (a word she failed to spot is still Éris's spelling, not hers). |
| **P1-7** | Proofreading (Fil) | After a thread is drawn the Fil panel and chip stay active but the **next tap opens the word editor** instead of a new thread; she has to quit and re-arm the tool. | run-3 failure snapshot (« Nouveau mot » open with « roula »), notes `Fil still active after a drawn thread: true` | On `done`: either auto-exit (close panel, deactivate chip, keep the highlight 2 s) or stay in `pick-verb` with the message « Fil tendu. Touche un autre verbe, ou corrige « riaient » en le touchant. » and treat a tap on the highlighted verb as edit, any other verb as a new pick. |
| **P1-8** | Scan verify | **She is the answer key but nothing makes her look**: no « À vérifier » chips on either fixture (`LOW_CONF = 60` never reached), the only warning is a 14 px grey hint, « Le texte est juste » is one tap away. An accepted OCR error is a wrong answer key for every profile forever. | `03-scan-verify` (both), notes `« À vérifier » chips: none shown` | Add a real phone photo of a photocopied handout to the fixtures and calibrate; when no word is low-confidence still show a checklist line (« Relis chaque ligne avec la feuille : accents, majuscules, ponctuation ») and make the button read « J'ai vérifié chaque mot »; consider requiring a scroll-through of the textarea (or a 3 s delay) before enabling it. |
| **P2-1** | Alexandria work | Failure banner repeats « hors d'atteinte / inaccessible pour le moment » and shows a **server file path**; with a live network it will show an English httpx message. | `14-alexandria-error` | Client: show only the fixed sentence + « Les rouleaux déjà recopiés restent disponibles. »; log `result.error` to console. Server: map exceptions to a short French `error` (« pas de connexion », « page introuvable »). |
| **P2-2** | Alexandria work | « 23 page(s) n'ont pas pu être lues. » in an olive *success* box after a successful refresh; « page(s) » plural hack. | `15-alexandria-chunks` | « 7 rouleaux recopiés. (23 pages sur 24 n'ont pas pu être lues.) » only when > 0, pluralised in code; keep olive. |
| **P2-3** | Alexandria | Duplicate works (« Le Tour du monde », « Les Trois Mousquetaires » ×2, Wikisource + Gutenberg) with identical cards; stars only explained by a mouse tooltip; chunks ordered by score not by « Rouleau n »; a 9H work yields 11H scrolls first. | `13-alexandria-works`, `15` | Merge same-work entries into one card with a source fallback; add a legend line « ★ = richesse en accords »; default sort by level closeness to the profile then score; show « niveau 9H » only when at least one scroll is ≤ hint. |
| **P2-4** | Grimoire intro / proofreading | The mode has no identity: intro is one paragraph on beige, proofreading is the SP1 screen with a new h2; no count hook, no repaired state, no Éris during the hunt. | `07-grimoire-intro`, `08` | Intro: parchment card with the text title, « Éris y a caché des dés-accords » (+ exact count at stage ≥ 3), Éris line. Proofreading: header tint, « Réparer le grimoire » as the done button, olive flash when a planted word is edited (no grading — just acknowledge the edit). |
| **P2-5** | Proofreading (Fil) | Thread is not visible: gold underline on 30 %-dimmed subject tokens; no subject↔verb line; « s'emmêle » on ~2/3 of lit verbs with no cue which verbs work. | `10-fil-thread`, `09b` | Lift dimming for `fil-verb`/`fil-subject` tokens (`opacity: 1`); draw an SVG line between the two spans; in Fil mode add a faint dotted underline under the verbs with a high-confidence chain (no answer given, just « ce fil s'accroche »). |
| **P2-6** | Results (grimoire) | « Mots justes : 129 / 133 » shown although she typed nothing; « Ce qu'Éris a tenté » fine. | `11-grimoire-results` | Hide the words line in grimoire mode; replace with « Dés-accords réparés : 3 · restants : 4 ». |
| **P2-7** | Results | Generic « avec le nom qu'il accompagne » for attributes (« joyeuses », « impatients ») and for the adjectival participle « épuisé » (Protée template). | `12d`, `11` | Build `attribute` chains for *rester/sembler/paraître/devenir/demeurer*; for a `Part` token with `dep ∈ {amod, acl, appos}` and no chain use « s'accorde avec le nom … » not the être/avoir sentence; when nothing is known say « « joyeuses » doit s'accorder → pluriel. Regarde de qui on parle. » |
| **P2-8** | Library | Prophecy card has no countdown; FAB still overlaps card text in portrait when a row is full. | `05-library-prophecy`, `ipad-portrait-16c` | « Prophétie : dans 21 jours (15.10) »; move the FAB into the header row. |
| **P2-9** | Scan verify | `autocapitalize="sentences"` and no `autocomplete="off"` on the reference textarea; portrait forces scrolling between photo and text. | `03-scan-verify`, notes | `autocapitalize="off" autocomplete="off"` (same as the dictation textarea); in portrait cap the photo at 40 vh with pinch-zoom, or offer a « Feuille / Texte » segmented toggle. |
| **P2-10** | Results | Homophone hints still dump the whole set (4 lines for ces/ses); « distinguaient … sujet « autres » » drops « les ». | `12` | SP1 P2-2; include the determiner of a pronoun-headed controller group. |
| **P3-1** | Add menu | Landscape bottom sheet is full-width for three short rows. | `01-add-menu` | `max-width: 640px; margin: 0 auto` on the sheet. |
| **P3-2** | Scan / Alexandria | Waiting states are a grey sentence with the primary button still visible. | `02b`, `13c` | Spinner glyph + disable the page's buttons while pending. |
| **P3-3** | Fiction | « Grimoire » is not Greek; fine for her, but SP3 could rename the mode « Parchemin corrompu » or keep « grimoire » as Éris's own word. | `07` | Decide in SP3 art direction. |

**What should not change**
- The verify layout with the photo beside the text and the sentence « Corrige chaque mot qui
  diffère de la feuille : ce texte devient la clé de correction. » — keep, make it louder.
- « Prophéties de l'Oracle » as a top library section with the gold chip, and the intro line
  « Dictée préparée pour le 15.10.2026 — la prophétie de l'Oracle. ».
- Photo strictly intro-only; reference hidden during dictation (verified).
- The Fil messages: « Touche un verbe, puis son sujet. », « Verbe : « riaient ». Maintenant, touche
  son sujet. », « Le fil est tendu : … (pluriel). Vérifie la terminaison du verbe. », « Le fil te
  guide : … » — and the rule that they quote *her* words.
- The high-confidence-only gating (« s'emmêle ») — keep the rule, fix the discoverability.
- Éris's grimoire lines and « Dés-accords retrouvés : n sur m ».
- The qui-relative and être-participle explanations, and the fixed subject naming.
- The Alexandria header illustration, the credits everywhere, « Les traducteurs et auteurs sont
  dans le domaine public. », the « Hors d'atteinte » chip on the works grid, and the third sentence
  of the failure banner.
- Skipping the empty Mots-pièges pass.

## 6. Spec conformance spot-checks

| Check | Result |
|-------|--------|
| Reference never visible during dictation, also for scanned texts; photo only on the intro (§3.2, §3.3) | **Pass** — `not.toContainText('clairière')` and `img[src*="/api/scan/"]` count 0 during the dictation of the scanned text; « Voir la feuille » exists only in the intro phase (`Play.svelte` toggles `showPhotos` in intro only). |
| Fil d'Ariane reacts only to high-confidence chains (§3.4, §1.3) | **Pass** — medium chains (« étalaient » conj, « l'entendait » qui, « coupait » conj, « attendait » qui) all answered « Le fil d'Ariane s'emmêle sur ce verbe. Essaie un autre verbe. »; high chains (« riaient », « roula », « taisait », « veillaient », « voulait ») accepted. |
| Fil messages never reveal the reference (§1.3, fix round 1) | **Pass** — « Verbe : « taisait » … » quotes her spelling; subject groups are read from her tokens. |
| No red (§1.6) | **Pass** — computed-style scan of every element (color, background, border, underline, outline, box-shadow) on scan verify, both results screens and the Alexandria error: no `rgb(r≥170, g≤70, b≤70)`. Errors orange, caught olive, prophecy gold. |
| Scan textarea attributes (§3.3 by analogy) | **Partial** — `autocorrect=off`, `spellcheck=false`, `lang=fr` ✓; `autocapitalize=sentences`, no `autocomplete` (P2-9). |
| Alexandria never crashes on network failure (§5 SP2) | **Pass** — missing fixture → `status: 'error'` → orange banner, works grid shows « Hors d'atteinte », app usable; no exception surfaced. |
| Public-domain credits on adopted scrolls (§3.2) | **Pass** — works grid, work header (+ domain-public line), adopted intro « Jules Verne, Vingt mille lieues sous les mers », library card with « Alexandrie » chip. |
| 1990 reform variants accepted (§5 SP2) | **Partial** — « connaitre », « maitresse », « ognon », « paraitre » accepted (0 flagged); **« l'évènement » rejected** (P1-1). |
| Due date → Oracle prophecy (§3.2) | **Pass** — library section + chip + intro line; date ≥ today enforced by `min`. |
| Grimoire weighted by weaknesses (§5 SP2) | Not observable on a fresh profile (uniform weights); plants covered 6 of 7 categories across the two runs. |
| Grimoire sessions do not move the help stage (plan decision 8) | Not exercised (one session). |
| Scanned/adopted texts are ordinary `text` rows, replayable (§3.2) | **Pass** — both appear as cards with « Jamais joué », playable in both modes. |

## 7. Reproduction

The Playwright spec that produced these screenshots lives in `web/e2e/playability-sp2.spec.ts`,
next to the SP1 walk; `web/playwright.playability.config.ts` matches both walks (timeout 600 s).
It was first kept under `docs/reviews/sp2/tooling/` because the review was made in an isolated
worktree while SP2 fix work was in progress in `web/`, and moved with the P1 fixes (as for SP1).
To rerun: `scripts/playwright.sh --config playwright.playability.config.ts playability-sp2`.
The spec was updated with the P1 fixes: the scan verify step now goes through the chips and the
confirmation (P1-8), and the second Fil thread is started directly after the first (P1-7).
