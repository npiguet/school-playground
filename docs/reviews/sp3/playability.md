# SP3 playability review — La Discorde, world and progression

Reviewer: Playwright walk + screenshot reading, evaluated from two perspectives (a 13-year-old
fantasy fan, a game designer). This document **reports**; it does not fix. All quotes of UI text
are verbatim French from the build. Every string seen during the walk was read for French
correctness (gender/number agreement included); the ones that are wrong are in §5.

## 1. Setup

- **Build:** production image built from commit `45228a8` ("Add SP3 end-to-end tests…") in a
  detached worktree outside the repo. Only isolation patches were applied locally (compose project
  `discorde-review3`, image tag) — none touch app code. `DISCORDE_TEST_HOOKS=1` (compose.e2e.yaml)
  enables the `X-Discorde-Day` test clock used for the 3-day mastery window.
- **Viewports:** `ipad-landscape` 1180×820 and `ipad-portrait` 820×1180 (WebKit, touch, 1×).
- **TTS:** stubbed (`web/e2e/helpers.ts` `stubSpeech`). The pace-3 boss dictation auto-advances
  through real `setTimeout` pauses, so the spec shortens timers ≥ 500 ms 25× *during dictation
  only* (`installFastTimers`); nothing else is accelerated.
- **Spec:** `web/e2e/playability-sp3.spec.ts`, run with `scripts/playwright.sh --config
  playwright.playability.config.ts playability-sp3` → `2 passed (3.1m)`, **92 PNGs** in
  `docs/reviews/sp3/` (46 per orientation, `fullPage`).
- **The walk** (per orientation), profile `Ariane-<project>` (10H) created through the UI:
  1. Onboarding (3 cards, « Entrer au camp ») → camp with the egg; mute toggle.
  2. Delphes: three sealed scrolls → « Ce qui arrive à l'école » → monster picker → the Hydre.
  3. Quest board: Oracle quest + two board quests (Écho, Chimère), a third refused, Chimère
     shelved (« Ranger »). Lieutenant page (Hydre, gauges at 0). Bestiary grid, Hydre page
     locked, Ariane page. Dossier (fresh).
  4. API: one Hydre session dated 2026-09-14 (previous ISO week) → Oracle quest 1/3.
  5. **UI session 1** « Les fées de la clairière » (13 words, pace 1) with one accent slip fixed
     → reveal (+46 XP, Oracle 2/3, Écho 1/3) → results.
  6. API: 2026-09-15 → Oracle quest 3/3 → Teinte Écume; Hydre window 2/3 days, 9/10 traps.
  7. **UI session 2** « Le retour des héros » with `revienne → reviennent` fixed → day 3 of the
     window → reveal: rank up, « L'Hydre — neutralisé ! », **« L'œuf éclôt ! »**, named `Braise`.
  8. Camp (hatchling), dragon page (Écume tint applied), cabin, dossier (neutralised), bestiary
     Hydre unlocked, lieutenant page neutralised.
  9. API: Écho neutralised (3 days of homophones, 2026-09-01..03) → boss tier 1 available.
  10. Camp boss panel → boss screen → « Affronter Éris » → the endpoint served the seed **« Les
      Misérables — la poupée de Cosette » (189 words, 10H)** at pace 3 (paces 1–2 disabled) with
      5 generic mistakes planted and nothing fixed → **lost** → reveal → results → boss screen
      again → the same text with a perfect draft → **won** (« Éris n'a rien trouvé à saboter »)
      → cabin with the Sandales (« Exposer » → « Ranger ») → board (Terminées).
  11. Break nudge: `discorde.playClock` seeded at 26 min, short text → « Braise bâille… ».
  12. Settings, camp with the weekly goal reached, reduced motion (camp + Delphes).
  13. Sibling `Léo-<project>` (6H): onboarding skipped (« Passer »), camp, dossier, board, Oracle
      picker (Protée « dort encore »), library.

  Boss plants (identical in both orientations): `couraient/avaient → -ait`, `et → est`,
  `à → a`, `des épis → des épi`, `poupée → poupé` (5 planted; « les …s » and « ses » patterns
  did not match).

Runtime notes captured by the spec (identical in both orientations unless stated):

```
red scan (camp, delphes, board, lieutenant, dossier, reveal ×3, cabin, boss): [] everywhere
imgs without alt (camp, lieutenant, bestiary, reveal, boss): 0
small targets < 44 px (camp, dragon): []
topbar-mute aria-pressed: before=false after toggle=true
request origins: ["http://app:8080"]                      ← no external request at all
art on camp (first visit): 152 KB (scenes/camp.webp 82K, dragon/dragon_egg_cut.webp 70K)
art on delphes: 157 KB · lieutenant: 57 KB · dossier: 83 KB · play (hatch): 64 KB
art on bestiary: 1026 KB (12 files: six lieutenants 66–130K, Éris 77K, four emblems 71–112K,
                          scenes/parchemins 75K, dragon_young 87K)                ← > 600 KB
art files fetched over the walk: 19, 1538 KB total
reduced-motion camp opacities: all "1"; delphes open scroll content: opacity 1 / max-height 600px
break nudge (hatched): Braise bâille : ça fait vingt-cinq minutes qu'on chasse les pièges. On souffle un peu ?
board third-quest refusal: Deux quêtes à la fois, c'est déjà beaucoup. Termine-en une ou range-la.
shelve confirm: Ranger cette quête ? Elle ne compte plus, sans rien perdre.
boss (perfect draft) subtitle: Éris n'a rien trouvé à saboter cette fois. Relis une dernière fois, puis valide.
reveal (hatch): +46 XP Sentinelle des textes 441 / 250 · Texte +46 · Ruse neutralisée +200 · Nouveau rang …
reveal (boss lost): Combat contre Éris (I) · Ce texte ne compte pas cette fois : 0 / 1 · Objectif de la semaine atteint ! +40 XP
reveal (boss won):  Œil d'Argus 756 / 600 · Éris vaincue +300 · Quête accomplie ! 300 XP · Sandales d'Hermès
recommended texts (Hydre quest): landscape → Le Vilain Petit Canard · 5H, La pomme d'or · 5H, Le dragon des Muses · 6H
                                 portrait  → La lanterne du soir · 10H (12 mots), Le retour des héros (14), Les fées (13)
```

## 2. Screen-by-screen notes

File names are `ipad-landscape-…` / `ipad-portrait-…`; both were inspected.

### 01–03 Onboarding and camp (`01-camp-onboarding-1`, `02-camp-onboarding-3`, `03-camp-egg`, `16-camp-hatchling`, `21-camp-boss-available`, `26-camp-weekly-reached`)
- Works: three parchment cards over the dimmed camp — **« Les Muses ont choisi un héros : toi. »**,
  « Éris sème des dés-accords. Un -s oublié, un a pour un à… Ses lieutenants sont chacun une
  ruse. Relis, une chose à la fois, et ils tombent. », **« Un œuf t'a été confié. Il éclora quand
  tu auras neutralisé la première ruse d'Éris. Tu lui donneras un nom. »** — « Passer » /
  « Suivant » / « Entrer au camp ». Three sentences that say the whole game; the third one is the
  hook. (At 0.7 s after arrival the first card was still empty — the fade-up waits behind the
  camp art decode; at 1.5 s it is there. Minor.)
- **Does the camp read as a home?** Yes: the scene (fire pit, shields, cabins) fills the upper
  third, the egg card sits right under it with its own line (« L'œuf frémit chaque fois qu'un
  piège d'Éris est déjoué. »), then six cards (Parchemins, Delphes with a gold dot while scrolls
  are sealed, Tableau des quêtes, Bestiaire, Dossier d'Éris, Ta cabane) each with a live subtitle
  (« Trois rouleaux scellés t'attendent cette semaine. », « 0 quête(s) en cours », « 0 sur 6
  ruse(s) neutralisée(s) · les vrais mythes », « 0 trésor(s) »). Landscape: 4 + 2 cards, the
  second row half empty; portrait: a clean 3 × 2.
- **Is the calm upper third actually calm under the HUD?** No — it is the weakest part of the
  screen. The HUD (« Recrue du camp · 0 XP », the gauge with its 14 px grey « Recrue du camp » /
  « 0 / 150 », the laurel row « Objectif de la semaine : 0 / 3 textes ») sits directly on the
  busy painting behind a light scrim. The h1 is fine; the XP line is borderline; the gauge label
  and its value (« 182 / 800 » in `26`) and the greyed-out leaves are **not legible**. In `26` the
  three green leaves plus « Objectif atteint ! Les Muses sont fières. » are the one celebratory
  line of the week and it is the least readable text on the page.
- **Is the egg the emotional centre?** It is the second element, at 84 px, in a white card with a
  name and a line — visible but small. After the hatch (`16`) the same card shows Braise and « Braise
  te regarde avec de grands yeux ambre. »; with the Écume tint (`21`) the little blue dragon on the
  white card pops. The boss panel (`21`) — Éris's smug portrait on violet, « Éris t'attend au bord
  du camp. Combat 1 : Sandales d'Hermès » — is the best-looking thing on the camp and it makes the
  reward visible before the fight, as the spec wants. « Combat 1 » here vs « Combat I » on the
  board and the boss screen.
- The portrait top bar drops the labels (icons only) and truncates the name to 80 px
  (« Ariane-i… »); « Ariane » alone would fit.

### 04–06 Delphes (`04-delphes-sealed`, `05-delphes-picker`, `06-delphes-revealed`, `27b-delphes-reduced-motion`)
- Works: the temple scene, « Les trois rouleaux », the gold line **« Cette semaine, ouvrir un
  rouleau rapporte : 150 XP · Teinte Écume »**, then three parchment scrolls with a wax seal
  (« Le point faible — Le monstre qui te piège le plus souvent en ce moment. », « Ce qui arrive
  à l'école — Choisis le monstre qui ressemble à ce que ta classe étudie. », « Le choix du destin —
  Un monstre que tu n'as pas affronté depuis longtemps. »), each repeating **« Récompense de la
  semaine : 150 XP · Teinte Écume »** and a full-width « Briser le sceau ». Three abreast in
  landscape, stacked in portrait.
- **Exciting without being a gamble?** Yes. The seal, the title and the hint make the three
  scrolls feel different (which monster), while the reward line — the same on all three *and*
  once above them — makes it impossible to think one is better than another. Four copies of the
  same gold line is one or two too many, but the rule is unmissable.
- The école picker opens *inside* the scroll (no seal break, no sound — verified by the M4 note
  in the code): « Choisis le monstre : » six 48 px chips with glyphs, « Annuler » and a confirm
  that agrees with the choice: **« C'est celle-là »** for the Hydre (« C'est celui-là » before any
  choice, disabled; « Ce sont celles-là » for the Sirènes per code). Correct French.
- After the choice (`06`): sparkles, the Hydre's art unrolls in the middle scroll with **« L'Hydre
  de Lerne »**, the other two read « Refermé jusqu'à lundi. », and « La quête de la semaine »
  shows the quest card (« Rouleau de l'Oracle : L'Hydre », gauge « 0 / 3 textes », **« Récompense
  connue : 150 XP · Teinte Écume · page du bestiaire »**, three text buttons) and « L'Oracle
  parlera de nouveau lundi. ». Reload keeps it (server state).
- Under reduced motion (`27b`) the open scroll is fully visible (opacity 1, max-height 600 px):
  nothing depends on the unroll animation.
- Quest title « Rouleau de l'Oracle : L'Hydre » keeps the capital « L' » after the colon while the
  board's « Tenir la Chimère en échec » lower-cases it — inconsistent (see P2).

### 07 Quest board (`07-quest-board`, `07b-quest-shelve-confirm`, `23e-quest-board-after-boss`, `30-sibling-board`)
- Works: scene strip, « En cours » with the quest cards (kind chip « Tableau » / gold « Oracle » /
  violet « Éris »), « Défier un monstre » with six cards (glyph, name, technique sentence,
  « Quête en cours » chip, **« Récompense : 60 XP · page du bestiaire »**, « Prochain trésor de
  cabane dans 2 quête(s) : Lanterne d'Hestia », « Lancer une quête »), an « Éris » panel
  (« Éris se cache. Neutralise 2 ruse(s) de plus pour la faire sortir. » → later « Combat I —
  récompense : Sandales d'Hermès » + « Se rendre au bord du camp »), and a collapsed
  « Terminées ». The third board quest is refused in orange: **« Deux quêtes à la fois, c'est déjà
  beaucoup. Termine-en une ou range-la. »** — a kind cap. Shelving: **« Ranger cette quête ? Elle
  ne compte plus, sans rien perdre. »** Oui / Non — exactly the no-penalty wording wanted.
- **Is the « known reward » line prominent?** Yes on the quest cards (gold, bold, its own line
  under the gauge) and yes on the challenge cards. It is *repeated* on all six cards along with
  « Prochain trésor de cabane dans 2 quête(s) : Lanterne d'Hestia » — the same two lines six
  times; the decor hint belongs once, above the grid.
- The recommended text buttons on each quest are the weak point: see P1-3 — on a 10H profile the
  Hydre quest recommends « Le Vilain Petit Canard · 5H », « La pomme d'or · 5H », « Le dragon des
  Muses · 6H » (landscape) or three 12–14-word test texts (portrait). She will notice she is
  being sent to 5H texts.
- « Terminées » (`23e`) lists « Combat contre Éris (I) — Un combat — 1 / 1 — Terminée le
  24.09.2026 », « Tenir Écho en échec — Terminée le 02.09.2026 » (the test-clock date, correct),
  the Oracle quest. Good history, gold chips.

### 08 Lieutenant page (`08-lieutenant-hydre`, `13c-lieutenant-hydre-mid-window`, `20b-lieutenant-hydre-neutralised`)
- Works: the battle scene with the Hydre art centred, the technique in italics (« Elle sème des
  dés-accords de nombre : un -s ou un -nt qui manque, et deux têtes repoussent. »), Éris's line
  for the band (« Mon Hydre n'a pas encore montré ses têtes dans ces textes. Patience : elles
  repoussent vite. » → « L'Hydre est neutralisée. Je refuse d'en parler. »), three bars
  **« 0/3 jours différents »**, **« 0/10 pièges rencontrés »**, **« Taux dans la fenêtre : — »**
  with a gold marker at 80 %, « Quête en cours » (disabled) / « Lancer une quête » + « Récompense :
  60 XP · page du bestiaire », « Ouvrir son grimoire corrompu », « Textes conseillés ». Mid-window
  (`13c`): « 2/3 jours différents · 9/10 pièges rencontrés · Taux dans la fenêtre : 100 % ».
  Neutralised (`20b`): a gold medallion banner **« Neutralisée le 24.09.2026 »** (agreement
  correct), all three bars full.
- **Do three gauges explain the 80 %/3 days/10 traps rule to a 13-year-old?** Two of them do
  (« jours différents », « pièges rencontrés » are concrete). The third does not: « Taux dans la
  fenêtre » is the developer's word (« fenêtre » = the rolling window) and the 80 % target is a
  thin gold tick with a mouse-only `title="Objectif : 80 %"`. Nothing on the page states the rule
  as a sentence. She will understand « 3 days, 10 traps » and guess the third bar has to reach
  the gold line — but not that the gold line is 80 %, nor that the three conditions must hold
  *together*. One sentence above the bars fixes it (P2-3).
- Subtle but important: « pièges rencontrés » counts *her own draft errors* in this category. A
  child who makes no Hydre mistakes can never fill the second bar with dictations — the Grimoire
  corrompu (Éris's plants) is the intended way and the button is right there, but nothing says
  « Pas assez de pièges ? Le grimoire en contient toujours. » (P2-3).

### 09–10 Bestiary (`09-bestiary-locked`, `10-bestiary-entry-locked`, `10b-bestiary-entry-ariane`, `20-bestiary-entry-unlocked`)
- Works: subtitle « Les vrais mythes derrière chaque ruse d'Éris - et la fiction du camp, bien
  séparée. », 14 cards (six lieutenants greyed while locked with **« À découvrir »** and « Mythe
  à débloquer : termine une quête contre elle / lui / elles » — pronouns agree), Éris, the four
  tool emblems (Argus, Ariane, Persée, Athéna), the Muses, Delphes, the dragon. Three columns
  landscape, two portrait.
- Entry page: the art, **« Le mythe »** (teaser only + orange « Mythe à débloquer : termine une
  quête contre elle. » while locked; four real facts once unlocked), **« Sources »** (« Hésiode,
  Théogonie ; Apollodore, Bibliothèque, II, 5, 2. »), then a parchment box with an olive chip
  **« Fiction du jeu »** and the heading **« Au camp »** (« Au camp, l'Hydre sème les dés-accords
  de nombre : un pluriel oublié, et deux autres se cachent plus loin. »), and « Voir la ruse et la
  quête ». **Myth vs « Au camp » separation:** clear — different box, a chip that says fiction,
  a sources line in between. A child cannot mistake Iolaos for game lore.
- The facts are the right length and the right register (« Ovide raconte son histoire… », « C'est
  d'elle que vient le mot « écho » »). Spot-checks in §6.
- Cost: the grid fetches 12 full-size cut WebPs (66–130 KB each, 1024² or 768×1344) to draw
  96 px thumbnails — **1 026 KB** for one screen (P2-1). The bestiary subtitle uses a hyphen
  « - » where the rest of the UI uses « — ».

### 11, 19 Dossier (`11-dossier-fresh`, `19-dossier-neutralised`, `29-sibling-dossier`)
- Works: a violet header with Éris's smug portrait (floating) and her intro (**« Dossier
  « Ariane-ipad-landscape ». Rien à signaler pour l'instant. Ça ne durera pas. »** → « 4 textes
  surveillés de près. Voici où mes ruses passent encore. »), « Ses points faibles » with one
  parchment row per lieutenant: glyph + name (+ gold « Neutralisée » chip), her line in italics,
  then the real numbers in grey (« Pièges tendus : 10 · déjoués : 10 · taux : 100 % ») and the
  window gauge (« 3/3 jours · 10/10 pièges · 100 % »). Then « Mes petites ruses (accents,
  lettres, majuscules) : 1 tentative, 1 déjouée. Je note. » with « Mots qu'elle vise » chips
  (« clairière ») and « Voir les chiffres bruts », and « Ce qu'elle préfère taire » (best catch
  rate, total caught, rank).
- **Is Éris's voice fun and never humiliating?** Yes. Every line is about *her* monsters: « Mon
  Hydre n'a pas encore montré ses têtes dans ces textes. Patience : elles repoussent vite. »,
  « Écho attend son heure : a ou à, et ou est… elle répète, et on la croit. », « Protée dort au
  fond de la mer. Ses participes changent de forme quand on les regarde. », « L'Hydre est
  neutralisée. Je refuse d'en parler. » Nothing addresses the player's ability; the bands only
  change *her* mood. « Ce qu'elle préfère taire » is a good inversion: the player's real stats
  presented as what the villain hides.
- **Are the real numbers legible under her lines?** Legible, yes (14 px grey + a 14 px gauge
  label), but the row carries the window twice in different notations: « Pièges tendus : 10 ·
  déjoués : 10 · taux : 100 % » (all-time) and « 3/3 jours · 10/10 pièges · 100 % — 3 / 3 »
  (window). A 13-year-old will not know why there are two « 10 » and two « 100 % ». One caption
  each (« Depuis le début » / « Vers la neutralisation ») would do (P2-4).
- The 6H sibling (`29`) gets « Protée — Protée dort encore à ce niveau. » as a greyed row: right.

### 12–15 Play intro and the progression reveal (`12-play-quest-intro`, `13-progression-reveal-xp`, `13b-results-after-reveal`, `14-progression-reveal-hatch`, `15-progression-reveal-named`)
- Intro: the parchment banner **« Ce texte compte pour ta quête. »** under the chips; the rest is
  the SP1/SP2 intro. Portrait pace grid is still 3 + 1.
- **Reveal pacing:** cards fade up 250 ms apart above the results: the XP card (« +46 XP », the
  rank gauge, chips « Texte +46 », « Ruse neutralisée +200 », gold « Nouveau rang : Sentinelle des
  textes »), one card per active quest (« Rouleau de l'Oracle : L'Hydre — Ce texte compte : 2 / 3 »;
  « Tenir Écho en échec — Ce texte ne compte pas cette fois : 1 / 3 »), the neutralised parchment
  (Hydre art, **« L'Hydre — neutralisé ! »**, « Sa ruse ne te piège plus : taux ≥ 80 % sur trois
  jours. », medallion, burst), the dragon card, then « Voir la relecture ». With four cards the
  whole thing is on screen in ~1.5 s: right length, no dead time, nothing to tap through.
- **The hatch moment (`14`):** the egg wobbles, then the hatchling pops with sparkles and
  **« L'œuf éclôt ! »**, a text field and **« C'est son nom »**. Typing `Braise` → chime, the form
  disappears (`15`), the camp and the top bar say Braise from then on. This is the best 10 seconds
  of SP3: the reward is the creature she was promised on card 3 of the onboarding, it arrives
  inside the results of a real session, and naming it is one field and one tap.
- What is wrong on the same screen: **« L'Hydre — neutralisé ! »** (feminine → « neutralisée »,
  P1-1); the XP gauge reads **« Sentinelle des textes 441 / 250 »** — full bar, value above the
  max — because after a rank-up the gauge keeps the *previous* rank's scale (P1-2, also
  « Œil d'Argus 756 / 600 » in `23f`); « Ce texte ne compte pas cette fois : 1 / 3 » gives no
  reason (P2-5).
- The reveal is not a screen of its own: the results (« Relecture terminée », Éris's line, the
  text, « Ce qu'Éris a tenté ») are rendered *below it* at the same time, so on the iPad she sees
  the XP card and « Relecture terminée » together; « Voir la relecture » only collapses the cards.
  The reveal cards are also edge-to-edge (no side padding) while the results below have the
  56 px page margin — they read as a different page glued on top (P2-6).

### 16–18 Dragon and cabin (`16-camp-hatchling`, `17-dragon-screen-tints`, `17b-dragon-ecume`, `18-cabin`, `23d-cabin-after-boss`)
- Dragon page: the hatchling at `min(420px, 55vw)` over the camp scene (portrait is the prettiest
  screen of the game), chip « Dragonnet », gauge « Prochaine étape : 3 technique(s)
  neutralisée(s) » (label runs into the value: « neutralisée(s)1 / 3 »), « Nom » with the field
  and « Garder ce nom », « Teinte » with six 56 px swatches (egg icon under each filter): Bronze,
  Écume, then Olivier/Braise/Jade/Argent greyed with a 🔒 (tooltip « À gagner : quête de
  l'Oracle » — mouse only).
- **Tint contrast on the cut image:** Écume (`hue-rotate(190deg)`) turns the bronze hatchling
  steel-blue everywhere — camp card, boss scene, break nudge — and it still reads as the same
  creature; the swatches make the six colours distinguishable, though the locked four are
  grey so their real colour is unknown until earned (the cabin card names them: « Ton dragon
  prend le vert des oliviers. »). Fine.
- Cabin: four sections — **Reliques** (six, « Écaille de l'Hydre — Une écaille vert olive, tiède
  comme un marais. » owned in gold, the rest grey « ? » with **« Comment l'obtenir : Neutraliser
  Écho »**), **Armes et armures divines** (Sandales d'Hermès / Égide / Foudre de Zeus « Vaincre
  Éris (première fois) »…), **Objets de la cabane** (Lanterne d'Hestia « Deux quêtes du tableau »,
  Tapis de Pénélope, Étagère d'Alexandrie, Trophée de la Pomme, Fresque des Muses « Sixième quête
  de l'Oracle »), **Teintes**. **Greyed-but-listed:** every reward in the game is on this page
  with its recipe before it is earned — the cleanest anti-gamble screen in SP3. Once owned, gear
  and decor get « Exposer » / « Ranger »; decor pins onto the scene, but **gear has no visible
  effect anywhere** after « Exposer » (P2-7).

### 21–23 Boss (`21-camp-boss-available`, `21b-boss-intro`, `22-play-boss-intro`, `22b-boss-proofreading`, `23-reveal-boss-lost`, `23b-results-boss-lost`, `23c-boss-after-loss`, `23f-reveal-boss-won`)
- Boss screen: the battlefield scene with *her* dragon (tinted) on the left and Éris on the
  right, her line on violet **« Deux de mes ruses réduites au silence ? Voyons si mes pièges
  tiennent quand ils jouent tous ensemble. »**, then « Combat I », gold **« Récompense si tu
  gagnes : 300 XP · Sandales d'Hermès »**, the rules **« Un long texte · les Yeux d'Argus restent
  éteints · aucun piège n'est perdu si Éris s'enfuit : tu pourras recommencer. »** and « Affronter
  Éris ». **Intro tension:** good — the composition (small dragon vs tall goddess, storm sky) does
  the work, the reward and the rules are both stated before the tap.
- Play intro: the violet banner **« Combat contre Éris — les Yeux d'Argus restent éteints. »**
  under the quest banner; paces 1–2 greyed with « Pas pendant un combat », pace 3 preselected.
  Proofreading: « 5 pièges sont cachés dans ce texte. », no Argus chips, Bouclier / Chouette (1) /
  Fil / Modifier available. A 189-word text at pace 3 with no spotlight is a real fight.
- **Lost (`23`):** « +43 XP », « Combat contre Éris (I) — Ce texte ne compte pas cette fois :
  0 / 1 », the weekly laurels, and a parchment **« Éris s'enfuit avec la pomme… pour cette fois.
  Le combat reste ouvert, rien n'est perdu. »**; results say « Mes pièges sont restés bien cachés.
  Cette fois. » and « Pièges déjoués : 0 sur 5 (0 %) »; the boss screen afterwards (`23c`) is
  identical to before, « Affronter Éris » again. **Does the lost fight read as open?** The
  sentence does. The quest card above it does not: « Ce texte ne compte pas cette fois : 0 / 1 »
  is the board-quest template applied to a single fight and reads like a failed counter (P2-5).
  The lost line is in « » as if Éris said « rien n'est perdu » — she would never.
- **Won (`23f`):** « Œil d'Argus 756 / 600 » (P1-2 again), the quest card in a gold frame
  « Ce texte compte : 1 / 1 — Quête accomplie ! — 300 XP · Sandales d'Hermès », and the violet
  panel with Éris mirrored: **« Impossible ! Garde ta pomme, je reviendrai avec de nouvelles
  ruses. »** — « Sandales d'Hermès ». Good.
- The win was obtained with a *perfect dictation*: « Éris n'a rien trouvé à saboter cette fois.
  Relis une dernière fois, puis valide. » → « Texte parfait dès la dictée ! » → 300 XP + gear.
  The rule is Decision 8 (< 3 draft errors = win) and it is fair to the child, but the boss — the
  one place where « toutes ses ruses » should be at work — then contains no proofreading at all
  (P1-5).
- Results after the lost fight also show two wrong explanations inherited from SP2: « « poupée »
  s'accorde avec « fond » → féminin » (the noun is explained as an adjective of the wrong noun)
  and « « épis » s'accorde avec « robe » → pluriel »; the homophone hints are still the full-set
  dumps (P2-9).

### 24 Break nudge (`24-break-nudge`)
- Works: a parchment above the reveal with the hatchling and **« Braise bâille : ça fait
  vingt-cinq minutes qu'on chasse les pièges. On souffle un peu ? »**, « Pause » (primary → camp)
  and « Encore un texte » (dismisses, resets the clock). Egg variant in code: « L'œuf frémit : ça
  fait vingt-cinq minutes… ». Never blocking, never a timer on screen. The dragon *asking* rather
  than the app *telling* is the right voice.

### 25 Settings (`25-settings-sound-weekly`)
- « Son — ☐ Couper les sons du jeu (la dictée reste lue) » and « Objectif de la semaine — Textes
  par semaine [3] » (2–5) are there, plain and adjustable. The level select is still full-width
  next to 360 px selects (SP1 note).

### 27 Reduced motion (`27-camp-reduced-motion`, `27b-delphes-reduced-motion`)
- Camp cards, h1 and the boss panel all at opacity 1; the open scroll content visible; the walk's
  reveal cards depend only on CSS animation-delay, which the global rule zeroes. Nothing on these
  screens needs motion to be seen. Particles are `Particles.svelte` canvases that render nothing
  under reduced motion (code), not exercised visually.

### 28–32 A 6H sibling (`28-sibling-camp`, `29-sibling-dossier`, `30-sibling-board`, `31-sibling-oracle-picker`, `32-sibling-parchemins`)
- Same camp, « 0 sur 5 ruse(s) neutralisée(s) », Protée shown as « Dort encore à ce niveau. » on
  the board, « Protée · dort encore » disabled in the picker, a greyed dossier row. Tone is
  identical for a 9-year-old — Éris's lines (« Ma Chimère n'a pas encore rugi ici. ») and the
  bestiary facts read fine at that age; the lieutenant technique sentences (« Elle répète un mot
  qui sonne juste mais s'écrit faux : a ou à, et ou est, son ou sont. ») are the clearest
  grammar explanations in the game.
- The library (`32`) shows « À ton niveau (6H) » with four texts, then **« Autres parchemins »
  with every text of every level up to 11H**, including the review's own test texts (« Le Grand
  Désaccord (ipad-landscape) », « La lanterne du soir · 12 mots »). A 6H child scrolling past
  « Notre-Dame de Paris — la cathédrale · 11H » is not harmed but the list is long; the FAB still
  covers card text (SP2 P2-8 open).

## 3. As a 13-year-old fantasy fan

**Would she want to come back to the camp?** Yes, for two reasons that did not exist in SP2: the
egg and the scrolls. The camp itself is a menu with a painting, but the egg card says something
will happen (« L'œuf frémit chaque fois qu'un piège d'Éris est déjoué »), and the Oracle card with
its gold dot says something is waiting *this week*. Once the dragon is hatched and named, « Braise
te regarde avec de grands yeux ambre » on the home screen is the kind of line she screenshots.
What would make her *not* come back: the home HUD is hard to read, the six cards below are
identical white rectangles, and after a session the game drops her in « Les Parchemins », not at
the camp (« Retour aux Parchemins » is the only exit) — the loop does not close on the home.

**Does the egg make her want to neutralise the Hydre?** The onboarding sets it up (« Il éclora
quand tu auras neutralisé la première ruse d'Éris ») and the lieutenant page shows three bars to
fill, so the goal is legible. The link between « 3 jours · 10 pièges · 80 % » and the egg is only
in her memory of card 3, though: nothing on the lieutenant page or the dragon page says « l'œuf
éclôt à la première ruse neutralisée » (the dragon page says « Prochaine étape : 3 technique(s)
neutralisée(s) » only *after* the hatch). And the hatch itself is worth the wait — the reveal
(`14`) is genuinely a moment.

**Are the Oracle scrolls a weekly ritual she'd tell a friend about?** Probably: « je dois briser
un sceau chaque lundi et choisir mon monstre » is a sentence a 13-year-old says. The seal, the
unrolling, the monster's art popping out of the scroll, and the closed-until-Monday note make it
feel like an event rather than a menu. The one thing missing for the story is *the Oracle's voice*:
the Pythia never speaks; the scrolls are labels. One cryptic line per scroll (« Trois têtes
repoussent là où tu ne regardes pas… ») would make it Delphi.

**Is Éris funny?** Yes, more than in SP1–2 because she now has a dossier, a mood per monster and
a boss line: « Une tête coupée sur deux. L'Hydre s'énerve, et moi aussi. », « Écho est réduite au
silence. Ce n'est pas une grande perte. (Si.) », « Le Grand Désaccord. Toutes mes ruses, un seul
texte, et la pomme d'or en jeu. Après ça, je ne reviendrai pas. (Si.) », « Impossible ! Garde ta
pomme, je reviendrai avec de nouvelles ruses. ». The « (Si.) » tic is exactly the Percy-Jackson
register she likes. The only line that is not hers but wears her quotes is the lost-fight card.

**Does the bestiary teach her something she'd repeat?** Yes: « Héra plaça ses yeux sur la queue
du paon : c'est pour cela que les plumes du paon ont des « yeux » », « les sirènes à queue de
poisson viennent du Moyen Âge », « porter des chouettes à Athènes ». The « Fiction du jeu » box
under each page is the honest part she will respect. The locked pages (« Mythe à débloquer »)
are a real motivation to run a board quest on a monster she has not met.

**Which reward would she want first?** The dragon's tint (Écume is visible on the camp within the
first Oracle quest) and the Sandales d'Hermès (they are the reward printed on the camp's boss
panel). The relics (« Une écaille vert olive, tiède comme un marais ») have the best descriptions
but no place to be seen; the cabin decor is the least motivating (a lantern in a list).

**Babyish / boring / confusing.** Nothing babyish — the tone holds for 13 and works for 9. Boring:
the six identical camp cards; the same « Récompense : 60 XP · page du bestiaire / Prochain trésor
de cabane dans 2 quête(s) » block six times on the board. Confusing: « Taux dans la fenêtre »;
« Ce texte ne compte pas cette fois » with no reason; two sets of numbers per dossier row; the
5H texts recommended to a 10H player; a gauge reading « 441 / 250 ».

## 4. As a game designer

**Engagement loop (camp → quest → text → reveal → camp).** Camp → Delphes (1 tap) → « Briser le
sceau » (1) → monster chip + « C'est celle-là » (2) → a recommended text button on the quest card
(1) → pace + « Commencer la dictée » (2) → dictation (6–10 min at pace 1 for a 130-word text) →
relecture (3–5 min) → « J'ai terminé ma relecture » (+ confirm) (1–2) → reveal, auto, ~1.5 s →
« Voir la relecture » (1) → results → **« Retour aux Parchemins » (1) → top-bar « Camp » (1)**.
Nine or ten taps around a 10–15-minute session — fine — but the last two go the wrong way: the
results exit to the library, and the camp (now the home, and the place where the egg/boss panel
changed) is one more tap that nothing invites her to take. The board quest loop from the camp is
shorter (camp → board → « Lancer une quête » → text button = 3 taps to the intro).

**Clarity — does she know at every moment what to do next?** Camp: yes (the Oracle dot, the boss
panel, « N quête(s) en cours »). Delphes: yes. Board: yes. Lieutenant page: mostly — the bars say
what, not why. Results: no — the reveal says what she gained, then nothing says « retourne au camp,
l'œuf a bougé ». Dragon page: « Prochaine étape : 3 technique(s) neutralisée(s) » says how many,
not which (a link to the board would do).

**Fairness — is the mastery window understandable and reachable in ~2 weeks of 3 sessions?**
Reachable: a 10H child playing 130-word texts makes 2–4 Hydre-category errors per text; 10 traps
over 3 different days comes in 3–5 sessions, i.e. the second week, and the 80 % catch rate is the
skill being trained, so the first neutralisation lands around session 5–6 — right where the spec
wants the hatch. The window is *permanent* once reached (Decision 3) and the dossier keeps the
« Neutralisée » chip forever: nothing is lost. Two fairness gaps: (1) a child who makes *no*
errors in a category can only fill « pièges rencontrés » through the Grimoire corrompu — which is
the right mechanic but is not explained; (2) board/Oracle quests count a session with zero errors
when the text merely *offered* ≥ 3 opportunities, so three 13-word texts finish « Tenir Écho en
échec » without Écho ever appearing (`13`: « Tenir Écho en échec — Ce texte compte : 1 / 3 » on a
text with no homophone) — combined with the recommender favouring tiny/low-level texts, a board
quest is farmable in three minutes (P1-3, P1-4).

**Tone.** No blame anywhere: « Ce texte ne compte pas cette fois », « Éris s'enfuit… pour cette
fois », « aucun piège n'est perdu si Éris s'enfuit ». No red: the computed-style scan found no
red-dominant colour on nine screens (orange is Éris's, olive is the player's, gold is rewards,
violet is Éris's panels). The words « manqué / raté / perdu / échec » do not appear on the camp;
« rien n'est perdu » and « tenir … en échec » are the only uses, both positive. The two tone
misses: the feminine agreement in the reveal, and the lost-fight quest card's « 0 / 1 ».

**Dark-pattern audit (spec §1, §3.6).**
- *Streaks:* none. The weekly goal is three leaves and « Objectif de la semaine : 2 / 3 textes »;
  when the week ends unmet nothing is said (Decision 15; no string for it exists in the code).
- *Timers:* none on screen. The only clock is the 25-minute break nudge, which appears once, on
  the results, and is dismissed with one tap. Paces are chosen by the player.
- *Variable rewards:* none. The Oracle reward is printed above the scrolls and on each scroll
  before any is opened, the quest cards say « Récompense connue », the boss says « Récompense si
  tu gagnes », the cabin lists every reward with « Comment l'obtenir » (« Chaque récompense est
  annoncée à l'avance : rien n'est tiré au sort. » when empty).
- *Scarcity / FOMO at week end:* « Refermé jusqu'à lundi. » and « L'Oracle parlera de nouveau
  lundi. » are informational; an unfinished Oracle quest is set `expired` silently at the next
  consultation and simply disappears from « En cours » (no string names it; the Terminées list
  only shows `done`). The tint she did not earn is offered again next week (the reward index
  counts *completed* Oracle quests), so nothing is missed for good. No « last chance », no
  countdown.
- *Notifications:* none (no service worker, no permission request, no external origin — the
  request log shows only `http://app:8080`).
- *Currency:* none. XP is a rank ladder (« Recrue du camp » → « Légende du camp »), not spendable;
  no shop, no cosmetics for XP.
- *Social pressure:* none; no cross-profile numbers anywhere (« Personal bests, not
  leaderboards »).
- The one soft nudge is the gold dot on the Delphes card while the scrolls are sealed. Acceptable.

**Pacing.** The reveal is 1–1.5 s of staggered cards and one tap; a hatch adds one field. The
onboarding is three cards. The 25-minute nudge fires after real *active* play (dictation +
proofreading only) and resets after 10 idle minutes. A boss fight at pace 3 on 189 words is a
~15-minute session — the right size for « the big one ».

**Feedback.** XP bar on the camp and in the reveal (but wrong scale after a rank-up); quest
counters on the board, the Oracle and in the reveal; three mastery bars per lieutenant; the
dossier numbers; the dragon stage chip and « Prochaine étape ». What is missing: a reason when a
text does not count, and any trace of *why* a boss was lost (« 0 sur 5 » is on the results, not
on the reveal card).

**Accessibility / iPad ergonomics.** Touch targets: no interactive element under 44 px on the
camp and dragon pages (scan), Oracle chips 48 px, tint swatches 72 × 68 px, top-bar links 48 px.
`<img>` without `alt`: 0 on every scanned screen (decorative art has `alt=""`, portraits carry
names, the dragon `alt` is its name). `aria-pressed` on the mute button flips `false → true` and
the icon changes; the Settings checkbox mirrors it. Reduced motion respected (opacity 1
everywhere, no reliance on animation). Portrait layouts: scrolls stacked, board 3 columns,
cabin 4 columns (tight at 180 px but readable), pace grid 3 + 1, name truncated to « Ariane-i… ».

**Key question — does SP3 make proofreading the core game?** Structurally it does: every quest,
gauge, dragon stage and boss verdict is computed from the catch rate on Éris's categories, the
lieutenant page sends her to the Grimoire, the boss removes the spotlight. Two leaks undermine
it: a quest can be advanced without ever meeting the monster (opportunity rule + tiny texts), and
the boss can be won with a perfect dictation and zero proofreading. Close those two and the
world's rewards all flow from the trained skill.

## 5. Prioritised findings

Legend: **P0** blocks play · **P1** hurts the loop or the tone · **P2** polish · **P3** later.
Screen → evidence → suggested fix.

| Prio | Screen | Finding | Evidence | Suggested fix |
|------|--------|---------|----------|---------------|
| **P0** | — | *None.* Every SP3 flow completes in both orientations; no crash, no red, no external request, no guilt wording. | run log `2 passed`, notes | — |
| **P1-1** | Progression reveal | **Wrong gender agreement:** « L'Hydre — neutralisé ! » (would also give « Les Sirènes — neutralisé ! », « Écho — neutralisé ! »). `ProgressionReveal.svelte` hard-codes « neutralisé » instead of `agree('Neutralisé', key)`, which the dossier, board and lieutenant page already use (« Neutralisée le 24.09.2026 » is correct). | `14`, `15` (both orientations), notes `reveal (hatch)` | `{names[key]} — {agree('neutralisé', key as LieutenantKey)} !`; add the reveal to the `eris.test.ts` agreement cases. Same file: `questLabel()` renders « Tenir L'Hydre en échec » / « Tenir La Chimère en échec » (capital article) — reuse `questTitle()` from `quests.ts`. |
| **P1-2** | Progression reveal | **XP gauge keeps the old rank's scale after a rank-up:** « Sentinelle des textes 441 / 250 », « Œil d'Argus 756 / 600 » — a full bar with a value above its max, at the exact moment the game says « Nouveau rang ». `gaugeMax` is built from `rank_before`; `xpValue` from `total_after`. | `14`, `15`, `23f` | When `rank_after > rank_before`: animate to the old max, then (after ~400 ms) switch floor/next to `rank_after`'s and animate to `total_after − newFloor`; label with `title_after` only after the switch. Also guard the 150 ms timeout against a still-loading catalog (compute from `progression.xp` + catalog inside the timeout). |
| **P1-3** | Quest cards, lieutenant page, Oracle | **Recommended texts ignore level and length:** for a 10H player the Hydre quest offers « Le Vilain Petit Canard · 5H », « La pomme d'or · 5H », « Le dragon des Muses · 6H » (landscape) or three 12–14-word texts (portrait, once such texts exist). `recommend_texts` ranks by category density only. | `06`, `07`, `08`, `13c` (both), notes `recommended texts` | In `recommend_texts`: filter `word_count ≥ 80` and level within one step of the profile (fall back to two steps, then any); sort by `(level distance, −density)`; never recommend a text with fewer than 3 opportunities in the category. |
| **P1-4** | Quests | **A text that never meets the monster still counts:** « Tenir Écho en échec — Ce texte compte : 1 / 3 » on a 13-word text with no homophone error (`session_counts_for` accepts 0 draft errors with ≥ 3 « opportunities »). With P1-3, a board quest is finished in three 1-minute texts and the « page du bestiaire » unlocks without a single trap deflected. | `13`, notes `reveal (session 1)` | Count a session only when the text has ≥ 80 words **and** (≥ 1 draft error in the category with `caught/draft ≥ 0.5`, or 0 draft errors with ≥ 5 opportunities). Show the reason on the reveal card when it does not count (« trop court pour compter », « aucun piège d'Écho dans ce texte »). |
| **P1-5** | Boss | **A perfect dictation wins the boss without any proofreading:** « Éris n'a rien trouvé à saboter cette fois. Relis une dernière fois, puis valide. » → « Texte parfait dès la dictée ! » → 300 XP + Sandales d'Hermès. Decision 8 (< 3 draft errors = win) is kind, but the tier-1 fight — « toutes ses ruses, un seul texte » — then contains none of the trained skill, and it is the biggest single reward in the game. | `23f`, notes `boss (perfect draft)`, `reveal (boss won)` | When the draft has < 3 errors in a boss session, fall back to Éris's corrupted copy: « Éris n'a rien trouvé à saboter… alors elle a recopié le texte. » → Grimoire hunt of the same text with ≥ 6 plants across her lieutenants, judged on the catch rate. Keep the < 3-error rule for ordinary sessions. |
| **P1-6** | Camp | **HUD on the scene is not legible:** the rank line, the gauge label/value (« 182 / 800 » grey on stone) and the weekly leaves/caption sit on the busy painting behind a light scrim; « Objectif atteint ! Les Muses sont fières. » is the hardest line to read on the home. | `03`, `16`, `26` (both) | Put the HUD in a parchment strip under the scene (h1 stays on the art), or a solid `rgba(244,239,230,.85)` block with 12 px padding behind the three lines; make the greyed leaves outlines instead of 50 % grey. |
| **P2-1** | Bestiary | The grid fetches 12 full-size cut WebPs (1 026 KB) to draw 96 px thumbnails; the camp is 152 KB. | notes `art on bestiary` | Ship 192 px thumbnails (`*_thumb.webp`, ~6 KB each) for the grid and `loading="lazy"`; keep the full image for the entry page. |
| **P2-2** | Results exit | After a session the only exits are « Rejouer ce texte » / « Retour aux Parchemins »; the camp — where the egg, the boss panel and the quest counters just changed — is a further top-bar tap. | `13b`, `23b` | Primary « Retour au camp » (secondary « Rejouer », tertiary « Les Parchemins »); when something changed at the camp, say it on the button (« Retour au camp — l'œuf a bougé »). |
| **P2-3** | Lieutenant page | The three bars do not state the rule; « Taux dans la fenêtre » is jargon; the 80 % mark is a tooltip; nothing says the Grimoire is how to meet traps you never make. | `08`, `13c` | One line above the bars: « Pour neutraliser l'Hydre : 3 jours différents, 10 pièges rencontrés, 80 % déjoués. » Rename the third bar « Pièges déjoués sur ces jours : 100 % (objectif 80 %) ». Under « Ouvrir son grimoire corrompu »: « Pas assez de pièges ? Le grimoire en cache toujours. » |
| **P2-4** | Dossier | Each row shows the same numbers twice in two notations (« Pièges tendus : 10 · déjoués : 10 · taux : 100 % » and « 3/3 jours · 10/10 pièges · 100 % — 3 / 3 »). | `11`, `19` | Keep one: « Depuis le début : 10 pièges, 10 déjoués (100 %) » + the window gauge captioned « Vers la neutralisation ». |
| **P2-5** | Progression reveal | « Ce texte ne compte pas cette fois : 1 / 3 » gives no reason; on a boss the card reads « Combat contre Éris (I) — Ce texte ne compte pas cette fois : 0 / 1 » (a failed counter, and the « 1 / 1 » / « Un combat » gauge on the board); the lost line is in Éris quotes although it is the narrator's. | `14`, `23`, `23e` | Boss card: no counter, narrator line without « » (« Éris s'enfuit avec la pomme… pour cette fois. Le combat reste ouvert : tu pourras recommencer. ») + Éris's own « Hmpf. » line; quest cards: add the reason (P1-4). |
| **P2-6** | Progression reveal | Reveal cards are edge-to-edge while the results below keep the page margin; the results are visible under the reveal at the same time (« Voir la relecture » only collapses the cards). | `13`, `14`, `23` | Give `.reveal-stack` the `.screen` padding; render the reveal as the first stage (results hidden until « Voir la relecture ») or, if both must be visible, keep only a « Relecture terminée » heading under it. |
| **P2-7** | Cabin | « Exposer » on gear has no visible effect anywhere (decor pins to the cabin scene, gear does not). | `23d` | Show equipped gear as a medallion on the camp dragon card and on the boss scene next to the dragon. |
| **P2-8** | Dragon page | Gauge label runs into the value: « Prochaine étape : 3 technique(s) neutralisée(s)1 / 3 »; « technique(s) » next to « ruse » used everywhere else; « Prochaine étape » does not say which lieutenants remain. | `17` (both) | « Jeune dragon à 3 ruses neutralisées (1 / 3) » with a link « Voir les ruses restantes » → board; give `.gauge-label` `gap: 12px; flex-wrap: wrap`. |
| **P2-9** | Results (SP2 carry-over) | Boss results explain noun plants as adjectives of the wrong noun: « « poupée » s'accorde avec « fond » → féminin », « « épis » s'accorde avec « robe » → pluriel »; homophone hints still dump the whole set. | `23b` (both) | SP2 P1-5 / P2-10: exclude nominal-chain controllers from noun-group explanations; shorten homophone hints to the pair. |
| **P2-10** | Board | « Récompense : 60 XP · page du bestiaire » + « Prochain trésor de cabane dans 2 quête(s) : Lanterne d'Hestia » repeated on all six cards. | `07`, `30` | One line above the grid: « Chaque quête : 60 XP · la page du bestiaire du monstre. Prochain trésor de cabane dans 2 quêtes : Lanterne d'Hestia. » |
| **P2-11** | Everywhere | « (s) » plural hacks in player-facing text: « quête(s) en cours », « trésor(s) », « ruse(s) neutralisée(s) », « dans N jour(s) », « technique(s) neutralisée(s) », « nouveau(x) piège(s) ». | `03`, `17`, camp prophecy banner | A tiny `plural(n, 'quête')` helper; the French is otherwise clean. |
| **P2-12** | Library (sibling) | A 6H child sees every text up to 11H under « Autres parchemins », plus other players' custom texts; the FAB still overlaps card text (SP2 P2-8). | `32` | Collapse « Autres parchemins » by level (« Plus difficiles (7H–11H) » folded); move the FAB into the header. |
| **P3-1** | Camp / board / boss | « Combat 1 » (camp) vs « Combat I » (board, boss screen, quest title). | `21`, `21b`, `23e` | `romanTier()` on the camp too. |
| **P3-2** | Delphes | The reward line appears four times (once above, once per scroll); the Oracle has no voice of her own. | `04` | Keep the line above and on the *chosen* scroll only; add one cryptic Pythia line per scroll. |
| **P3-3** | Bestiary | Subtitle uses « - » instead of « — »; entry pages have no « ← Bestiaire » link (top bar only). | `09`, `10` | Typography; a back link. |
| **P3-4** | Top bar (portrait) | Name truncated at 80 px (« Ariane-i… »); « Progrès » points at the dossier while the stats page is « Voir les chiffres bruts ». | `03` portrait | 120 px; fine as is for real first names. |
| **P3-5** | Onboarding | The first card is empty for ~1 s on first arrival (fade-up waits behind the camp art). | `01` at 0.7 s vs 1.5 s | `fetchpriority="high"` on the camp scene or start the fade after `load`. |

**What should not change**
- The onboarding's three sentences, « Passer » always available, and « Entrer au camp ».
- The Oracle: seal → picker inside the scroll → monster art unrolling; the reward line above the
  scrolls; « Refermé jusqu'à lundi. » / « L'Oracle parlera de nouveau lundi. »; the agreeing confirm
  button (« C'est celle-là » / « Ce sont celles-là »).
- « Récompense connue : … » on every quest card; « Récompense si tu gagnes : … » on the boss; the
  cabin listing every reward with « Comment l'obtenir » and « rien n'est tiré au sort ».
- « Deux quêtes à la fois, c'est déjà beaucoup. Termine-en une ou range-la. » and « Ranger cette
  quête ? Elle ne compte plus, sans rien perdre. »
- The dossier structure (Éris's line → real numbers → gauge), every dossier line quoted above,
  « Ce qu'elle préfère taire ».
- The bestiary's « Le mythe » / « Sources » / « Fiction du jeu — Au camp » split and the locked
  teaser with « termine une quête contre elle ».
- The hatch reveal: egg → hatchling → « L'œuf éclôt ! » → name field → « C'est son nom »; the
  250 ms stagger; the medallion + burst on a neutralisation.
- The boss screen composition and its three lines (challenge, reward, rules); pace 1–2 disabled
  with « Pas pendant un combat »; the violet banner; Éris's won/lost lines.
- The break nudge wording and its two buttons; the weekly laurels; no streak, no timer, no
  currency, no external request.
- The permanence of « Neutralisée » and « Terminée le … ».

## 6. Spec conformance spot-checks

| Check | Result |
|-------|--------|
| §3.6 mastery rule visible and correct (≥ 80 % over 3 different days, ≥ 10 occurrences) | **Pass (rule), partial (wording)** — the window closed exactly when the third distinct day brought the traps to 10 with 10 caught (`13c`: 2/3 · 9/10 → UI session → neutralised; the API run that stayed at 2 days and 9 traps did *not* neutralise). The three bars show the three conditions; « Taux dans la fenêtre » and the unlabeled 80 % mark are the weak wording (P2-3). |
| Weekly goal instead of streaks (§3.6) | **Pass** — « Objectif de la semaine : n / 3 textes » with three leaves, settable 2–5 in Réglages, +40 XP once (« Objectif de la semaine atteint ! +40 XP » in the reveal), « Objectif atteint ! Les Muses sont fières. » on the camp; no string for a missed week exists. |
| Break suggestion present and dismissible (§3.6) | **Pass** — « Braise bâille : ça fait vingt-cinq minutes qu'on chasse les pièges. On souffle un peu ? » with « Pause » / « Encore un texte »; the nudge appears on the results only, never blocks, and `break-continue` removes it. |
| Rewards known in advance everywhere (Oracle, board, boss, cabin) | **Pass** — `oracle-reward` « 150 XP · Teinte Écume » before any seal is broken and identical on the three scrolls; « Récompense connue : 150 XP · Teinte Écume · page du bestiaire » / « 60 XP · page du bestiaire » on cards; « Récompense si tu gagnes : 300 XP · Sandales d'Hermès »; the camp boss panel names the gear; the cabin lists all 19 rewards with recipes while unowned. |
| §2 taunts about her tricks only (three dossier lines) | **Pass** — « Mon Hydre n'a pas encore montré ses têtes dans ces textes. Patience : elles repoussent vite. » · « Écho attend son heure : a ou à, et ou est… elle répète, et on la croit. » · « L'Hydre est neutralisée. Je refuse d'en parler. » (also seen: « Protée dort au fond de la mer. Ses participes changent de forme quand on les regarde. », « Mes Sirènes n'ont pas encore chanté : elles éloignent le sujet de son verbe et attendent. », « Léthé attend la fin des textes. C'est là que la vigilance s'endort. »). None names the player's ability; `FORBIDDEN` list unit-tested. |
| Bestiary facts are real (two spot-checks against the cited sources) | **Pass** — *Hydre* (Apollodore, Bibliothèque II, 5, 2): Lerna near Argos; second labour; two heads regrow per head cut; Iolaos burns the neck stumps; the immortal middle head buried under a rock; arrows dipped in the gall; Eurystheus refuses to count the labour because of Iolaos's help — all as written. *Sirènes* (Odyssée XII; Argonautiques IV; Pausanias IX, 34, 3): wax in the companions' ears and Ulysses bound to the mast; Orpheus outplaying them for the Argonauts; the singing contest lost to the Muses (Pausanias) — as written; the bird-body / medieval fish-tail distinction is correct. One nuance in *Écho*: Ovid has Juno detained by Echo's talk so that the *nymphs* with Jupiter could flee (« pendant que Zeus s'échappait » is a fair simplification). |
| No external requests | **Pass** — `page.on('request')` origins over the whole walk: `["http://app:8080"]` only (fonts are system fonts; no CDN, no analytics). |
| Art served from `/art/` | **Pass** — 19 distinct files, all under `/art/{scenes,dragon,lieutenants,characters,emblems}/…webp`; camp first visit 152 KB (< 600 KB); Delphes 157 KB, dossier 83 KB, lieutenant 57 KB; **bestiary 1 026 KB** (P2-1). |
| `prefers-reduced-motion` respected (Decision 18) | **Pass** — with `reducedMotion: 'reduce'` the camp cards/h1/boss panel compute to opacity 1 and the chosen scroll's content is open (opacity 1, max-height 600 px); the global `app.css` rule zeroes durations and delays; `Particles` renders nothing under reduced motion (by code). |
| No red (§1.6) | **Pass** — computed-style scan (color, background, border, underline, outline, box-shadow) on camp, Delphes, board, lieutenant, dossier, three reveals, cabin and boss: no `rgb(r ≥ 170, g ≤ 70, b ≤ 70)`. |
| No guilt wording on the camp | **Pass** — `body` never contains `manqué|raté|perdu|échec` on the camp; the only « perdu » in SP3 is « rien n'est perdu » (results of a lost boss) and « aucun piège n'est perdu » (boss rules). |
| Lost boss fight loses nothing (Decision 8) | **Pass** — after « 0 sur 5 » the quest stays `active`, the boss screen is unchanged (« Affronter Éris »), XP was still granted (+43), and the same text is served again. |
| Two board quests max, Oracle quest on top (Decision 7) | **Pass** — third « Lancer une quête » refused with the orange alert; the Oracle quest coexists. |
| Onboarding once, skippable (Decision 22) | **Pass** — shown on the first camp; « Passer » on the sibling closed it; not shown again after `settings.onboarded`. |
| Mute toggle (Decision 17) | **Pass** — `topbar-mute` `aria-pressed` `false → true`, icon 🔊 → 🔇; Réglages « Couper les sons du jeu (la dictée reste lue) ». |
| Lieutenant availability by level (Decision 1) | **Pass** — 6H: Protée « dort encore » in the picker, the dossier and the board; « 0 sur 5 ruse(s) » on the camp. |

## 7. Reproduction

`web/e2e/playability-sp3.spec.ts`, matched by `web/playwright.playability.config.ts`
(`testMatch` extended). To rerun: `scripts/playwright.sh --config
playwright.playability.config.ts playability-sp3` (≈ 3 min; the SP1/SP2 walks in the same config
are unchanged). The spec drives multi-day mastery with `postSession` + `X-Discorde-Day` (previous
ISO weeks, so the weekly goal is reached by UI sessions only), plants five generic mistakes into
whatever text the boss endpoint serves, and prints its notes (quoted in §1) even when a step
fails. Screenshots are written to `docs/reviews/sp3/`.
