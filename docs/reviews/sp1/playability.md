# SP1 playability review — La Discorde, first playable

Reviewer: Playwright walk + screenshot reading, evaluated from two perspectives (a 13-year-old
fantasy fan, a game designer). This document **reports**; it does not fix. All quotes of UI text
are verbatim French from the build.

## 1. Setup

- **Build:** production image built from commit `c9fab2a` ("Task 12 fix round 1") in an isolated
  worktree. Two local patches were needed just to build and run in isolation and are *not* part
  of the review findings: `Dockerfile` had to `COPY content/reform1990.json` (the SP2 grading v2
  commit `a360767` imports it but only copies `homophones.json` into the web build stage — the
  main tree's later Dockerfile already differs, so this is flagged as a **build regression at
  `c9fab2a`**, see P0-1), and `scripts/lib.sh` / `compose.e2e.yaml` were pointed at a distinct
  compose project, image tag and volumes.
- **Viewports:** `ipad-landscape` 1180×820 and `ipad-portrait` 820×1180 (WebKit, touch,
  `devices['iPad Pro 11']`, 1× screenshots).
- **TTS:** stubbed (`web/e2e/helpers.ts` `stubSpeech`, plus a per-utterance delay so the
  "Écoute…" state could be captured).
- **Spec:** `web/e2e/playability.spec.ts`, config `web/playwright.playability.config.ts`, run via
  `scripts/playwright.sh --config playwright.playability.config.ts` → 2/2 tests pass, 84 PNGs in
  `docs/reviews/sp1/` (42 per orientation).
- **The walk** (per orientation): profile picker → create `Léa-<project>` (10H, dragon, no code)
  → library → add a custom text ("Le matin au camp", 95 words) → play the 10H seed **"La chouette
  d'Athéna"** (133 words, 5 sentences) at pace 1 → dictation typed from a draft derived from the
  reference with **8 planted, realistic mistakes**:

  | # | planted | kind |
  |---|---------|------|
  | 1 | `se taisaient` → `se taisait` | subject–verb -nt (subject "Les autres oiseaux", verb after "se") |
  | 2 | `appris à connaître` → `appris a connaître` | homophone a/à |
  | 3 | `ses grands yeux ronds` → `ces grands yeux ronds` | homophone ces/ses |
  | 4 | `l'avait choisie` → `l'avait choisi` | past participle with avoir, COD before |
  | 5 | `toits endormis` → `toits endormi` | noun-group plural (-s) |
  | 6 | `ruelles étroites` → `ruelles étroite` | noun-group plural adjective (-s) |
  | 7 | `clair là où` → `clair la où` | homophone là/la |
  | 8 | `attentive` → `atentive` | lexical |

  → proofreading at help stage 1: all four Argus passes, early "J'ai terminé" (confirmation),
  inline word editor, one **introduced** error (`ouvrait` → `ouvrais`), Chouette (1 hint), Bouclier
  (two sentences), whole-text editor → fixed 5 of 8 → results, tap a missed word and a caught
  word → library (history line) → stats → settings → paces 2, 3 and 4 on "Nausicaa et la lessive"
  (screenshots of the listening state, pause, and the resume banner after leaving mid-dictation)
  → three extra profiles promoted through the API to help stages 2, 3 and 4, same draft, screenshot
  of the proofreading screen at each stage (+ Chouette at stage 3, and a "nothing caught" results
  screen at stage 4) → profile `Max-<project>` (7H) with code `1234` → PIN gate, wrong code, right
  code.

Runtime notes captured by the spec (identical in both orientations):

```
first card in "À ton niveau (10H)": L'île de Circé
textarea attributes: {"autocorrect":"off","autocapitalize":"off","autocomplete":"off","spellcheck":"false","lang":"fr"}
Chouette pointed at: ces
results: Pièges déjoués : 5 sur 8 (63 %) / Score : 421
draft after resume: ""
stage 2 subtitle: Relis une catégorie à la fois, comme Argus te l'a appris. | lit tokens: 23 | dimmed: 0
stage 3 subtitle: 8 pièges sont cachés dans ce texte. | lit tokens: 0 | dimmed: 0
stage 4 subtitle: À toi de jouer. Valide quand tu es sûre. | lit tokens: 0 | dimmed: 0
Éris (nothing caught): Mes pièges sont restés bien cachés. Cette fois.
```

## 2. Screen-by-screen notes

File names below are `ipad-landscape-…` / `ipad-portrait-…`; both were inspected.

### 01 Profile picker (`01-profiles`, `01b-profiles-several`)
- Works: big tappable cards, avatar + name + level chip, "+ Nouveau héros" dashed card. Grid
  reflows to 5 columns landscape / 4 portrait.
- Empty state is a full-width dashed card with only "+ Nouveau héros" — fine functionally, but the
  first thing she ever sees of the game is a beige page with a headline and one grey button. No
  Éris, no Muses, no dragon, no illustration. Title "La Discorde" in the display serif is the only
  flavour.
- Long names wrap ("Léa-ipad-landscape") — real first names will not.

### 02 Create profile (`02-profile-new`, `02b-profile-new-with-code`)
- Works: clear labels ("Ton prénom", "Ton avatar", "Ton niveau", "Un code à quatre chiffres
  (facultatif)"), hint "HarmoS, comme à l'école", "Pour que ton frère ou ta sœur ne joue pas sur
  ton profil." is exactly the right register. Selected avatar gets an Aegean border.
- The `<select>` for the level spans the full width (1800 px in landscape) while the name field is
  ~400 px — visually unbalanced. Native select on iPad opens a picker; acceptable.
- Avatars are emoji (🦉🐉🎵🔱🌿⚡) — OK for SP1, but the "Lyre" is a music note, not a lyre.
- The code field has no `type=password`/masking: the code is shown in clear (fine for a
  sibling lock, but a 13-year-old will expect dots).

### 03 Library — Les Parchemins (`03-library`, `03b-library-7H`, `04b-library-with-custom`, `15b-library-after-play`)
- Works: "À ton niveau (10H)" section first, then "Autres parchemins"; cards show title, credits,
  level and word-count chips, "Jamais joué" / "Joué 1× · meilleur taux de pièges déjoués 63 %".
  Level filter chips have 48 px targets. Custom text appears with "Les Muses" as credit.
- **The "+ Ajouter un texte" FAB overlaps card text** (landscape: covers "La Petite Sirène — le
  palais sous la mer"; portrait: covers "Le Vilain Petit Canard" chips). It is `position: fixed`
  over a scrolling grid without a bottom spacer under the last row — the `padding-bottom` only
  protects the very end of the page, not the row the FAB happens to float over when the page is
  scrolled.
- 35 cards of identical beige/white look the same; nothing says "start here". Titles like "Les
  Misérables — la poupée de Cosette" and "Notre-Dame de Paris — la cathédrale" read like a school
  anthology. The Muses' originals ("La chouette d'Athéna", "L'île de Circé") are mixed in without
  any visual cue that they are the game's own myths.
- Copy "Choisis un texte à protéger des dés-accords d'Éris." is the one line of fiction on the
  screen and it is good.

### 04 Add a text (`04-text-new`)
- Works: title, 12-row textarea with live word count "95 mots" and hint "Entre quatre-vingts et
  deux cents mots, nombres écrits en lettres.", level, author/work/translator, orange primary
  "Sauvegarder dans les Parchemins". Landscape textarea is comfortable.
- The title input is narrow (~400 px) and truncates "Le matin au camp (ipad-la"; the textarea is
  full width. Same imbalance as the profile form.
- No public-domain reminder or credits guidance (spec §3.2 rule) — a parent typing a text from a
  living author gets no nudge. Acceptable for SP1 but note it.

### 05 Play intro / pace select (`05-play-intro`)
- Works: title, credits, chips, "Choisis ton rythme", four pace cards with honest descriptions
  ("Pas à pas", "Par groupes", "Comme en classe", "Comme à l'examen"), default pace 3 for 10H,
  "Les récompenses augmentent avec le rythme." and a big terracotta "Commencer la dictée".
- Portrait: 3 cards on the first row and "Comme à l'examen" alone on a second row — looks like an
  afterthought; a 2×2 grid would read as a ladder.
- No estimated duration ("≈ 133 mots" is there, but "environ 6 minutes" would help her decide).
- There is no way back from this screen except the top bar; fine.

### 06–07 Dictation (`06-dictation-listening`, `07-dictation-typing`, `07b-dictation-keyboard-sim`, `07c-dictation-finished`, `18-dictation-pace2`, `20-dictation-pace3`, `20b-…-paused`, `21-dictation-pace4`)
- Works: the screen is stripped to essentials (no top bar), "Dictée" + "Phrase 2 sur 5" /
  "Groupe 1 sur 20" / "Lecture complète", a status dot + text ("Écoute…", "À toi d'écrire.",
  "En pause."), controls "Réécouter" / "Suivant" (pace 1–2, with "(3)" replays at pace 2),
  "Pause" / "Reprendre" (pace 3–4), "J'ai fini d'écrire" appears at the end. The textarea has
  22 px text, `autocorrect/autocapitalize/autocomplete=off`, `spellcheck=false`, `lang=fr`
  (verified). Reference text never appears in the DOM (asserted twice).
- **Keyboard-safe layout: good.** With `--vvh` forced to 58 % of the viewport (what the iPad
  keyboard leaves), the column shrinks and the textarea stays fully above the keyboard in both
  orientations (`07b`): header + status + controls take ~240 px, the textarea keeps ~440 px
  (landscape) / ~560 px (portrait). The current line is visible.
- **Dead end:** there is no way to leave the dictation screen (no top bar, no "Quitter"/"Retour").
  The only exits are the browser back gesture or reloading. The resume banner exists precisely
  for that case, but…
- **…the draft is lost when leaving mid-dictation.** After typing at pace 2 and navigating away,
  the resume banner "Tu reprends là où tu t'étais arrêtée." appeared, "Continuer" was tapped and
  the textarea came back **empty** (`draft after resume: ""`). `Play.svelte` only saves the play
  state on phase changes; the draft typed during dictation is never persisted, so a Safari
  backgrounding/reload during a 10-minute dictation loses everything, and the banner promises
  the opposite. Also, resuming restarts the runner at sentence 1.
- "Réécouter(3)" has no space before the parenthesis (pace 2).
- Pace 1 "Phrase 0 sur 5" while the first sentence is being read: 0 is odd; "Phrase 1 sur 5"
  while listening would be more natural.
- Pace 3/4 progress is only "Groupe 0 sur 20" — 20 chunks with no visual progress bar. At pace 4
  the whole text is read first with only "Lecture complète" as feedback and a Pause button; there
  is no hint that she should *listen* and not write yet.
- Placeholder "Écris ici ce que tu entends…" is right. The status colours (terracotta while
  speaking, Aegean when it is her turn, olive when finished) are subtle but consistent.

### 08–12 Proofreading — the main game (`08-proofreading-verbes`, `08b-…-confirm-early`, `09-proofreading-gn`, `09b-…-homophones`, `09c-…-mots-pieges`, `10-proofreading-edit`, `10b-…-wholetext`, `10c-…-before-done`, `11-bouclier`, `11b-bouclier-previous`, `12-chouette`)
- Works, and works well: "Relecture" + "Les Yeux d'Argus éclairent une catégorie à la fois.",
  pass chips (active in Aegean, done ones get "✓ "), "Passe suivante →", a per-pass hint in bold
  Aegean ("Pour chaque verbe, cherche son sujet : singulier ou pluriel ?", "Déterminant, nom,
  adjectif : ils s'accordent ensemble.", "a ou à ? et ou est ? Remplace par un autre mot pour
  vérifier.", "Les mots qui t'ont déjà piégée. Regarde chaque lettre."), tool chips (🛡️ Bouclier de
  Persée, 🦉 Chouette d'Athéna (3), ✏️ Modifier tout le texte), her text as large tappable tokens
  (22 px, 1.9 line-height) with the active category lit (Aegean pill, bold) and the rest dimmed to
  30 %. The spotlight is genuinely effective: on the Verbes pass the eye lands on "taisait" among
  the plural-looking verbs; on the GN pass "endormi" and "étroite" stand out among "les toits",
  "les ruelles".
- The Verbes pass lights participles too at 10H ("appris", "choisi", "endormi", "observé") as the
  spec says (≥ 8H). Homophones pass lights every "la", "et", "se", "ce", "dans", "tout", "leur",
  "mais"… (23 tokens) — correct per the table, but very noisy for a 133-word text; the actually
  suspicious ones ("a", "ces", "la où") do not stand out among them.
- **Mots-pièges pass on a new profile lights nothing and dims *everything*** (`09c`, `12`): the
  whole text drops to 30 % opacity with the hint "Les mots qui t'ont déjà piégée. Regarde chaque
  lettre." — she is told to look at every letter of a text she can barely read. The pass should
  be skipped, or shown with "Aucun mot-piège pour l'instant" and no dimming.
- Inline editor (`10`): tapping "taisait" swaps it for an input with the word selected, an orange
  "OK" and "Vide = supprimer le mot". Enter/blur commit. Clear and fast. Nice that the editor
  mounts inside the tap (iOS keyboard opens).
- Early "J'ai terminé ma relecture" (`08b`): "Il reste des passes à faire. Valider quand même ?" +
  "Oui, valider" / "Continuer la relecture". Good friction; does not block.
- Chouette (`12`): "La chouette a repéré un piège ici." (orange, bold) and the token "ces" gets
  an orange-light background with an orange underline; it reads clearly even when the rest of
  the text is dimmed (a first, unsettled screenshot suggested otherwise: the 0.2 s opacity
  transition makes the hint appear late, so a hint tapped right after a pass switch looks faint
  for a moment). The Chouette has no fiction beyond the one line: no owl, no sound, the counter
  just decrements, and the hinted word is not scrolled into view on a long text.
- Bouclier (`11`, `11b`): "Phrase 1 sur 5 — en partant de la fin", "← Phrase précédente" /
  "Phrase suivante →" (the *right* arrow goes *towards the end*, which in a last-to-first mode is
  the previous sentence — the labels are correct but the arrows fight the metaphor). The sentence
  shows alone; good. Combined with the empty Mots-pièges pass it is again fully dimmed.
- Whole-text editor (`10b`): a plain textarea with the whole text — a practical escape hatch for
  punctuation/spaces the token editor cannot reach.
- Portrait (`ipad-portrait-08`, `-10`): the same layout stacks; the text column is narrower (37
  chars/line) and the "J'ai terminé ma relecture" button stays pinned at the bottom. Chips wrap
  onto two rows without clipping. Good.
- No sense of time or progress inside the proofreading: the pass chips are the only progress.
  No count of edits made, no "3 passes sur 4" text, no ambient tension. It reads as a tool, not a
  hunt.

### 13–14 Results (`13-results`, `14-results-explanation`, `14b-results-caught`, `24b-results-nothing-caught`)
- Works: "Relecture terminée", an orange-bordered card **"Éris, agacée :"** with her line ("Hmpf.
  La moitié de mes pièges, déjoués. J'en cacherai mieux la prochaine fois. (Et j'en ai glissé 1
  pendant ta relecture. Sournois, je sais.)" — with introduced errors folded in; "Mes pièges sont
  restés bien cachés. Cette fois." when nothing was caught), then "Pièges déjoués : 5 sur 8
  (63 %)", "Score : 421", "Mots justes : 129 / 133", the final text with **orange solid underline
  for still-wrong words and olive dotted underline for words she fixed herself**, a tap → panel
  "Attendu : « ouvrait »" + explanation, or "Tu avais écrit « a », tu as corrigé en « à ». Bravo !"
  (olive). Then "Ce qu'Éris a tenté" grouped by category with "déjoué ✓" tags, and "Rejouer ce
  texte" / "Retour aux Parchemins". Never red anywhere. Tone is right: Éris taunts her own tricks.
- The catch-rate line is the hero metric but visually it is a plain 18 px paragraph; the Éris
  card above it is bigger. Nothing celebrates the 5 catches (no animation, no count-up, no dragon).
- **Pedagogical correctness of the explanations seen** (all of them, both orientations):
  - `« taisaient » s'accorde avec son sujet « taisaient » → pluriel → terminaison « ent »` —
    **wrong**: the subject is "Les autres oiseaux", the sentence names the verb as its own
    subject. Root cause found in `web/src/lib/explain.ts`: `explainAgreement` reads
    `ctx.refTokens[annot.subject]` and `ctx.annots[annot.subject]`, but `annot.subject` (and
    `annot.head`, used by `headNounText`) are **spaCy token indexes**, while `refTokens`/`annots`
    are indexed by the client tokenizer, which keeps "n'intriguait", "d'Athéna", "l'avait" as one
    token where spaCy makes two. In this text the drift is exactly 2 before "taisaient"
    (spaCy 24 = "oiseaux", client 24 = "taisaient"). Any text with elisions will name a wrong
    subject or a wrong head noun. This is the single most important pedagogical bug.
  - `Participe passé « endormis » : avec être, il s'accorde avec le sujet ; avec avoir, seulement
    si le complément est placé avant.` — **misleading**: "les toits endormis" is a participle used
    as an adjective; the right rule is "il s'accorde avec le nom « toits » → pluriel". The error
    is classified `agreement:participle` (Protée) and counted in the "Participes passés" stats
    row, although the annotation itself tags it `amod`/`nominal_group`. The template should
    branch on the adjectival deps.
  - `Participe passé « choisie » : avec être, il s'accorde avec le sujet ; avec avoir, seulement
    si le complément est placé avant.` — correct but generic; the whole point of this error is
    "l' = la chouette, placé avant → féminin → -e". SP2 chains should specialise it.
  - `« étroites » s'accorde avec le nom qu'il accompagne → pluriel` — correct but should say
    "avec « ruelles »"; the head noun lookup fails for the same index-space reason.
  - `Le verbe « ouvrait » s'accorde avec son sujet. Cherche qui fait l'action.` (introduced) —
    correct fallback; "elle" was available in principle.
  - Homophone a/à, ces/ses, la/là — **correct and well phrased** ("« a » (et « as ») peut se
    remplacer par « avait »…", "« ses » = les siens (« ses livres » → « son livre »)…"), but the
    ces/ses hint is a 4-line paragraph about six words (c'est, s'est, sais, sait) that were not
    involved. Too long for a 13-year-old reading a list; show only the pair concerned.
  - `Ce mot s'écrit « attentive ». Il rejoint tes mots-pièges pour t'entraîner.` — correct, kind.
  - Category labels "Accord du verbe avec son sujet (L'Hydre)", "Accord en nombre (L'Hydre)",
    "Participes passés (Protée)", "Homophones (Écho)" — good fiction hooks; "Orthographe des mots"
    and "Accents" have no monster yet.
- The introduced-error line "Éris a profité de la relecture pour glisser 1 nouveau(x) piège(s)."
  — the "(x)" "(s)" plural hack reads badly; pick the singular/plural form in code.
- The caught-word popover appears **below** the text block (not near the tapped word); in portrait
  with a long text she has to scroll to see it.
- Scoring: 421 pts for 5/8 caught, 250 for 0/8. The number has no scale ("sur combien ?") and no
  history to compare with until the stats page. She will not know if 421 is good.

### 15 Stats — Progrès (`15-stats`)
- Works: "Ce qu'Éris note dans son dossier « Ses points faibles »… et ce qu'elle préfère
  taire.", card "Aide des Muses : niveau 1 sur 4" + "1 — Les Yeux d'Argus éclairent chaque
  catégorie.", table Catégorie / Pièges rencontrés / Déjoués / Taux, "Mots-pièges" chips
  ("attentive boîte 1"), "Dernières parties" ("La chouette d'Athéna · 24.09 · 421 pts · 63 %"),
  "Totaux" ("1 parties · 421 points · 5 pièges déjoués").
- It is a spreadsheet. The Éris framing in the subtitle is not carried into the table: no Éris
  voice lines, no "L'Hydre te bat 1 fois sur 1". "1 parties" plural bug. "boîte 1" means nothing
  to her. "Aide des Muses : niveau 1 sur 4" sounds like *she* is at level 1 (lowest), while it
  means the most help is on — a 13-year-old will read it as a bad grade.
- Categories with 0 errors are hidden (good), but there is no "what to do next".

### 16 Settings — Réglages (`16-settings`)
- Works: "Voix de la dictée" select + "Écouter un essai" (speaks "Bonjour ! Je lirai tes dictées.
  Virgule, point."), "Niveau", "Code" ("Nouveau code (quatre chiffres)", "Retirer le code" when
  set), "Enregistrer", toast "C'est noté.".
- Fine. The level select is again full width. Nothing here matters to her; a parent screen.

### 17 PIN gate (`17-pin-gate`, `17b-pin-gate-wrong`)
- Works: "Code de Max-ipad-portrait", a big centred numeric input (auto-submits at 4 digits),
  "Ce n'est pas le bon code. Réessaie." in orange, "Changer de héros" link.
- Digits are shown in clear (no masking). Empty beige page otherwise.

### 19 Resume banner (`19-resume-banner`)
- Aegean banner "Tu reprends là où tu t'étais arrêtée." + "Continuer" / "Recommencer". Good
  copy, but see the lost-draft bug above (the promise is currently false during dictation).

### 22–24 Help stages 2, 3, 4 (`22-proofreading-stage2`, `23-proofreading-stage3`, `23b-…-stage3-chouette`, `24-proofreading-stage4`)
- Stage 2 subtitle "Relis une catégorie à la fois, comme Argus te l'a appris." — but **23 tokens
  are still lit** in Aegean (only the dimming is off). The spec says stage 2 = "named passes
  *without spotlight*". As shipped, stage 2 is visually almost identical to stage 1 (compare
  `08` and `22`); the scaffold barely fades. Chouette drops from 3 to 2 hints.
- Stage 3 "8 pièges sont cachés dans ce texte." + Chouette (1), no passes — correct and the count
  is a strong hook (the best line in the whole proofreading UI, honestly).
- Stage 4 "À toi de jouer. Valide quand tu es sûre." — no passes, no Chouette, Bouclier and
  whole-text remain. Correct.
- Nothing in the flow tells her *why* the passes disappeared when she moves up; the results
  screen shows "Les Muses te font confiance : les Yeux d'Argus s'éteignent un peu." (olive
  banner) once, which is good — but it was not triggered in this walk (promotion was done via the
  API), so it is untested visually.

### Top bar (all screens with it)
- Landscape: avatar + name, centred title, "📊 Progrès", "⚙️ Réglages", "🔄 Changer de héros".
  Portrait (< 900 px): labels hidden, icons only, name truncated to "Léa-ipa…". The three emoji
  are the only iconography in the app; they look like a chat app, not a Greek camp.

## 3. As a 13-year-old fantasy fan

**First impression.** "A dictation website my teacher would make." Beige, serif title, a form.
Nothing on the first three screens (picker, create, library) shows Éris, the Muses, the dragon,
Argus, anything. The one line "Choisis un texte à protéger des dés-accords d'Éris." is the first
whiff of story, and it is in grey small text under the header. Percy Jackson opens with a
fight; this opens with a level dropdown.

**Tone of Éris and the Muses.** Where they exist, they are good. "Éris, agacée : Hmpf. La moitié
de mes pièges, déjoués. J'en cacherai mieux la prochaine fois. (Et j'en ai glissé 1 pendant ta
relecture. Sournois, je sais.)" is exactly the sore-loser goddess promised; it never mocks *her*.
"Mes pièges sont restés bien cachés. Cette fois." after a 0/8 is gentle and even a little
motivating. "Les Muses te font confiance : les Yeux d'Argus s'éteignent un peu." is a lovely
line. But Éris speaks **once** per session, in one card, in plain text. The Muses only exist as
"Les Muses cherchent les héros…" loading lines. Nobody speaks during proofreading, which is the
part that is supposed to be a duel with her.

**Babyish or preachy?** Not babyish: no stickers, no "Bravo champion !", the vocabulary ("dés-
accords", "pièges déjoués", "Bouclier de Persée") is her age. Not preachy: no rule lectures
before playing. The one thing that could feel schoolish is the Progrès table and the level
select ("HarmoS, comme à l'école") — the word école appears where it does not need to.

**The tools — cool or just buttons?** Just buttons, for now. "🛡️ Bouclier de Persée" is a chip that
filters to one sentence; "🦉 Chouette d'Athéna (3)" is a chip that underlines a word and prints
"La chouette a repéré un piège ici."; "Les Yeux d'Argus" is a subtitle. The *mechanics* behind
them are excellent and the names are evocative, but there is zero presentation: no icon art,
no sound, no motion when the spotlight moves, no owl swooping in. She would call them "the
filter buttons".

**Is proofreading the part she remembers?** Yes — and that is the good news. The dictation is
plain and slightly tedious (20 chunks, one button), but the moment the Verbes pass lights up and
"taisait" sits there among "cherchaient" and "distinguaient", she *sees* it. Fixing it inline in
two taps and later getting the olive dotted underline + "Tu avais écrit « a », tu as corrigé en
« à ». Bravo !" is the closest thing to a mastery moment in the build. Stage 3's "8 pièges sont
cachés dans ce texte." is a genuine hook ("I found 5, where are the other 3?").

**Frustrating.** No way out of the dictation once started; losing a typed draft if Safari
reloads; the Mots-pièges pass greying the whole text with nothing lit; the wrong subject "« taisaient » s'accorde avec son sujet « taisaient »"
(she *knows* the rules — she will spot that the game is wrong, and trust drops).

**Boring.** Library of 35 look-alike cards. Results list of 8 long bullet explanations. The stats
table.

**Delightful.** The spotlight passes. The olive "déjoué ✓". Éris's parenthesis about the
introduced error. Being able to tap a word and just fix it.

**Would she come back?** Once or twice for the proofreading mechanic, if a parent sits with her.
Not on her own yet: there is no dragon, no quest, no world, no reason to open it tomorrow, and
the first screens do not promise any. That is expected for SP1 (world is SP3), but the review
question was asked, and the honest answer is: the *core* is there, the *pull* is not.

## 4. As a game designer

**Friction.** Taps from launch to hearing the first sentence: picker → card → (library) card →
"Commencer la dictée" = 3 taps, fine. Adding a text is 1 tap + form. Dead ends: the dictation
screen (no exit), the PIN gate (only "Changer de héros"). The whole-text editor and the Bouclier
are both toggles with no explanation of what they do until tried. The "Passe suivante →" button
sits at the end of the chip row, so in portrait it wraps to a second line and looks like a fifth
category.

**Clarity.** She knows what to do at every step *mechanically*: every screen has one terracotta
primary button. She does *not* know what the passes mean the first time (no onboarding, no
"first pass" tooltip), what a "taux de pièges déjoués" is, what the score is out of, or why the
Argus chips vanished at stage 3. The status dot on the dictation screen carries a lot of meaning
(speaking/your turn/paused/finished) with 12 px of colour.

**Fun / agency / mastery.** Agency is real in proofreading: order of passes, tools, which word to
edit, when to stop — all hers. The mastery moment (caught error revealed in olive) is under-
served: it is the same visual weight as the missed errors, and the catch-rate line is a plain
sentence. The reveal is a list, not a moment: no sequence "here is what Éris tried… here is what
you caught… here is what got through". Nothing changes on screen when she fixes a word during
proofreading (no acknowledgement — deliberate, and right: no live grading), but the *end* should
pay it back with more ceremony.

**Tone.** No blame anywhere, orange not red, verified across all screens (`.orange`,
`--orange`, olive for caught). Introduced errors are framed as Éris's doing. The only off-tone
strings: "Aide des Muses : niveau 1 sur 4" (reads as a grade), "1 parties", "nouveau(x) piège(s)".

**Pacing.** 133 words at pace 1 = 5 sentences, quick. At pace 3 the same text is 20 chunks each
read twice with a pause of `max(3 s, 1.8 s × words)` — about 5–6 minutes of dictation before the
game starts. Proofreading a 133-word text with four passes took the scripted player ~1 minute;
a real 13-year-old maybe 4–6 minutes. So dictation ≈ proofreading in time, and dictation is the
*less* interesting half. With 180–200-word seeds ("Les Misérables", 189 words) at pace 3/4 the
dictation alone approaches 10 minutes — the spec's whole "chapter" budget.

**Feedback.** Results screen is legible and complete; explanations are specific (when correct);
score has no meaning without a reference. Stats are correct and dull. Missing feedback:
during dictation, whether the app heard her tap "Suivant" (button just re-enables); after
"J'ai fini d'écrire", no transition — the proofreading screen appears instantly with the passes
already lit, which is efficient but skips the "Éris has been here" beat.

**Is proofreading the core, or does the dictation dominate?** In *design*, proofreading is the
core and the build honours it: proofreading has 3 tools, 4 passes, 4 help stages, its own
screen with the top bar removed, a confirmation before leaving, and a results screen built around
the catch rate. Dictation is a plain typing screen. In *time and attention*, however, dictation
dominates at paces 3–4 (see pacing) and the player spends her energy typing, arriving at the
proofreading tired — which is realistic for class, and exactly the Léthé effect the game wants
to train, but for a game session it means the fun part starts after the boring part. Two SP2
items directly fix this: the *Grimoire corrompu* mode (proofreading-only) and shorter/adaptive
chunking. For SP1 as-is: proofreading is the core on paper and on screen; the loop just needs the
dictation to feel like *setup* (faster, more scaffolded, skippable in practice) rather than the
main task.

**iPad ergonomics.** Touch targets are ≥ 44 px throughout (chips 40–48, tokens padded to ~44 px,
buttons 48). Text is large (18–22 px). Keyboard-safe layouts verified for dictation and
proofreading. Portrait works, only the pace grid (3+1) and the FAB overlap are awkward. Native
selects and no custom scroll containers — good for Safari. `env(safe-area-inset-*)` is applied.
No landscape-only assumptions found.

## 5. Prioritised findings

Legend: **P0** blocks play · **P1** hurts the core loop / teaches something wrong · **P2** polish
(later / SP3). Screen → evidence → suggested fix.

| Prio | Screen | Finding | Evidence | Suggested fix |
|------|--------|---------|----------|---------------|
| **P0-1** | Build | `c9fab2a` does not build a production image: `web` stage fails with `Could not load /work/content/reform1990.json (imported by src/lib/grading/reform.ts)` because the Dockerfile copies only `content/homophones.json` before `npm run build`. | build log; local patch needed to run this review | Add `COPY content/reform1990.json content/reform1990.json` (or `COPY content/*.json content/`) to the web stage; add the image build to `scripts/check.sh` gating (it is there, so the grading-v2 commit was merged without running it). |
| **P1-1** | Results | Verb-agreement explanation names the wrong subject: `« taisaient » s'accorde avec son sujet « taisaient »`. `explain.ts` indexes `refTokens`/`annots` with spaCy token indexes (`annot.subject`, `annot.head`); the two tokenizers disagree on elisions (`n'intriguait`, `d'Athéna`, `l'avait`), so the index drifts. Same bug silently breaks `headNounText` (→ generic "avec le nom qu'il accompagne" for « étroites »). | `13-results`, `24b-results-nothing-caught`, notes | Map spaCy indexes to client token indexes through `mapAnnotation` (build the reverse map spaCy→client once), or store `subject`/`head` as character offsets and resolve by span. Add a unit test with an elision before the verb. |
| **P1-2** | Results / Stats | Adjectival participle explained with the être/avoir rule: `Participe passé « endormis » : avec être, il s'accorde avec le sujet ; avec avoir, seulement si le complément est placé avant.` for "les toits endormis"; also counted under "Participes passés (Protée)". | `13-results` | When the annotation has `dep ∈ {amod, acl, acl:relcl}` (already tagged `nominal_group` server-side), classify as `agreement:number`/`gender` and explain "s'accorde avec « toits » → pluriel". Keep Protée for real aux+participle. |
| **P1-3** | Dictation / Resume | Draft typed during dictation is never saved; "Tu reprends là où tu t'étais arrêtée." → "Continuer" → empty textarea. A reload or Safari backgrounding mid-dictation loses 5–10 minutes of typing. | `19-resume-banner`, note `draft after resume: ""` | Persist `playState.draft` (debounced) on every input during dictation, plus the runner index so "Continuer" resumes at the right sentence/chunk. |
| **P1-4** | Dictation | No way to leave the dictation screen (top bar hidden, no "Quitter"). Combined with P1-3 it is a trap. | `06`, `07`, `18`, `20`, `21` | Add a discreet "Quitter" (ghost button) that pauses and returns to the intro with the resume banner. |
| **P1-5** | Proofreading | Mots-pièges pass on a profile with no trap words dims the entire text and lights nothing; hint says "Regarde chaque lettre." Bouclier + Chouette inherit the dimming. | `09c-proofreading-mots-pieges`, `12-chouette`, `11-bouclier` | Skip the pass when `trapWords` is empty (or when nothing in the text is lit), or render it undimmed with "Aucun mot-piège pour l'instant — Éris n'a encore rien noté." |
| **P1-6** | Proofreading stage 2 | Stage 2 still lights all category tokens (23 lit); only the dimming is removed, so the scaffold barely fades and stage 1→2 is not perceptible. Spec: "named passes without spotlight". | `22-proofreading-stage2` vs `08` | At stage 2, do not apply `.lit`; keep only the chips, the hint line and (optionally) a count of words in the category. |
| **P1-7** | Library | "+ Ajouter un texte" FAB overlaps card content on both orientations. | `03-library` (over "La Petite Sirène"), `ipad-portrait-03-library` | Move the action into the header row (a secondary button next to the filters) or add bottom padding equal to the FAB height to the last grid row and a right gutter. |
| **P2-0** | Proofreading | Chouette hint has no personality and is not scrolled into view; the hint appears through a 0.2 s fade that reads as "nothing happened" for a beat. | `12-chouette` | Instant highlight (no opacity transition on `.hint`), `scrollIntoView`, a small owl glyph before the word, 2–3 owl lines. |
| **P2-1** | Results | Catch rate is the key metric but is a plain 18 px line under a bigger Éris card; no celebration of the caught errors; caught popover appears far below the text. | `13-results`, `14b` | Make "Pièges déjoués 5 / 8" the hero (big, olive), animate a count-up, show caught words first; anchor the popover near the tapped word. |
| **P2-2** | Results | Homophone explanations dump the whole set's hint (ces/ses/c'est/s'est/sais/sait: 4 lines). | `13-results` | Show only the two forms involved; keep the full hint behind "en savoir plus". |
| **P2-3** | Results | Plural hacks: "1 nouveau(x) piège(s)", "1 parties". "Aide des Muses : niveau 1 sur 4" reads as a low grade. | `13`, `15` | Pluralise in code; rename to "Les Yeux d'Argus : grand ouverts / entrouverts / fermés / …" or "Étape 1 : Argus t'éclaire". |
| **P2-4** | Dictation | "Réécouter(3)" missing space; "Phrase 0 sur 5" while the first sentence plays; no progress bar for 20 chunks; pace 4 first full reading gives no "écoute seulement" cue. | `18`, `06`, `20`, `21` | "Réécouter (3)"; count from 1 while speaking; thin progress bar; status text "Écoute tout le texte, sans écrire." during the full read. |
| **P2-5** | Play intro | Pace cards 3+1 in portrait; no duration estimate. | `ipad-portrait-05-play-intro` | 2×2 grid below 900 px; "≈ 6 min" per pace computed from the plan. |
| **P2-6** | Proofreading | Bouclier arrows: "Phrase suivante →" moves toward the *end* of the text while reading last-to-first; "en partant de la fin" mitigates but the arrows fight the metaphor. | `11`, `11b` | Label "← Phrase d'avant (vers le début)" / "Phrase d'après →" or flip to "Remonter / Descendre". |
| **P2-7** | Proofreading | Homophones pass lights 23 function words; the suspicious ones drown. | `09b` | Consider lighting only homophones whose *set* has ≥ 2 members plausible in context (a/à, et/est, ces/ses, la/là, ou/où, son/sont, on/ont) and leave "dans", "tout", "mais" for stage-3+ only; or order them by her stats. |
| **P2-8** | Forms | Level `<select>` is full width while text inputs are ~400 px; title input truncates; PIN digits not masked. | `02`, `04`, `16`, `17` | `max-width: 360px` on selects; wider title input; `type=password`-like masking with `inputmode=numeric`. |
| **P2-9** | Stats | Pure table; no Éris voice, "boîte 1" opaque, no "what next". | `15-stats` | One Éris line per weakest category ("L'Hydre te reprend 1 tête sur 1…"), replace "boîte n" by dots, add "Rejouer un texte avec des homophones" link. (Largely SP3.) |
| **P2-10** | Picker / Library / Top bar | No world: empty beige screens, emoji icons, 35 identical cards, Muses' originals not distinguished. | `01`, `03`, top bar | SP3 art direction; for SP1 a header illustration and a "Textes des Muses" chip would already help. |
| **P2-11** | Add text | No public-domain/credits guidance. | `04-text-new` | One hint line under Auteur: "Auteur et traducteur morts avant 1956, ou texte de la classe." |

**What should not change**
- The spotlight passes themselves (dim to 30 %, Aegean pill, bold) — they work, keep the contrast.
- The inline word editor (tap → input with word selected → OK/Enter, "Vide = supprimer le mot").
- The confirmation "Il reste des passes à faire. Valider quand même ?" — light, not blocking.
- Éris's lines and the "Éris, agacée :" card; "déjoué ✓" in olive; the introduced-error framing
  "(Et j'en ai glissé 1 pendant ta relecture. Sournois, je sais.)".
- Stage 3's "8 pièges sont cachés dans ce texte." — the strongest hook in the build.
- The keyboard-safe column (`--vvh`) on dictation and proofreading; the dictation screen's
  minimalism (no top bar) — just add an exit.
- Text sizes and touch targets.
- The four pace descriptions — honest and short.

## 6. Spec conformance spot-checks

| Check | Result |
|-------|--------|
| Reference never visible during dictation (§3.3) | **Pass** — `expect(body).not.toContainText('silencieusement' / 'intriguait')` during dictation, and `not.toContainText('taisaient')` at the start of proofreading (the draft had "taisait"). |
| No red (§1.6) | **Pass** — every error/warning uses `--orange #e07b2a` / `--orange-light`; caught words olive; no `red`/`#f00`/`crimson` in `app.css` or components (grep). |
| Help stages visible (§3.4) | **Pass** — stage 1 spotlight + 4 chips + Chouette (3); stage 2 chips + hint, Chouette (2) — but see P1-6 (still lit); stage 3 count "8 pièges sont cachés dans ce texte." + Chouette (1); stage 4 "À toi de jouer. Valide quand tu es sûre.", no Chouette. |
| Textarea attributes (§3.3) | **Pass** — `page.getAttribute` on `[data-testid=dictation-textarea]`: `autocorrect=off`, `autocapitalize=off`, `autocomplete=off`, `spellcheck=false`, `lang=fr` (both orientations). |
| Keyboard-safe layout (§3.3) | **Pass** — with `--vvh` set to 58 % of the viewport height the textarea stays entirely above the keyboard zone in both orientations (`07b-dictation-keyboard-sim`). |
| Argus order default Verbes → GN → Homophones → Mots-pièges (§3.4) | **Pass** on a new profile. Weakest-first ordering not exercised (needs ≥ 5 draft errors in a bucket). |
| Catch rate = caught ÷ draft errors (§1.4) | **Pass** — 5 / 8 = 63 %; the introduced error is excluded from the denominator and mentioned separately. |
| Score never negative (§3.5) | **Pass** — 250 for 0/8 caught + 1 introduced… (0 caught run), 421 for 5/8. |
| Punctuation spoken (§3.3) | Verified indirectly: `__spoken` captured strings with "virgule", "point" (settings "Écouter un essai" speaks "Virgule, point."). |
| Public-domain rule enforced on add-text (§3.2) | **Not enforced / not hinted** in the UI (P2-11). |
| Stage adaptation messages (§3.4) | Server returns `help_stage_message`; results banner exists (`banner-olive`) but was not visually exercised (promotion via API). |

## 7. Reproduction

The Playwright spec and config that produced these screenshots are kept next to them in
`docs/reviews/sp1/tooling/` (`playability.spec.ts`, `playwright.playability.config.ts`). To run
them, copy them to `web/e2e/` and `web/` respectively and run
`scripts/playwright.sh --config playwright.playability.config.ts` (the review was made in an
isolated worktree; only `docs/reviews/sp1/` was committed to the main tree so as not to touch
`web/` while SP2 work is in progress there).
