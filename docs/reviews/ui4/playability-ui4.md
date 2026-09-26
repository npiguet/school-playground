# UI4 battle stage: playability and immersion review

Reviewer: Opus playability/immersion pass, 2026-09-26. Branch `scenes` at `9f74285`.
Scope: spec §1 (a full-screen game with learning elements, not a school app; legibility beats décor)
and §5 (the battle stage). I read all 29 screenshots in `docs/reviews/ui4/`, the Task 8 walk report,
and the copy and components behind what the screenshots show (`lib/battle/lines.ts`,
`VictorySheet`, `VictorySpoils`, `LaurelBar`, `MusterPhase`, `ProofPhase`, `DragonNudge`,
`kit-objects.css`).

Decisions I respect and do not re-open:
- the HP bar stays full during play and drops at the reckoning;
- the painted chest and a flustered-Éris image are on hold, so the drawn laurel is the crown;
- the pace names « D'un bon pas » and « D'une traite ».

Counts: **0 Critical, 9 Important, 13 Minor.**

---

## Findings

### 1. Important: the victory tally reads like a marked test (c11, c13, c14, c16–c19, c18b, c18c)
- **What she sees.** Under a gold laurel and « Victoire ! », three lines:
  - « Pièges déjoués : 1 sur 2 (50 %) »
  - « Score : 94 »
  - « Mots justes : 12 / 13 »

  In the standoff (c17) the first line becomes « 0 sur 2 (0 %) ». « Score : 166 » (c16) is a number
  above 100 with no unit or meaning.
- **Why it hurts.** A score, a percentage and a « x / y » fraction together are a marked test. This
  is the one screen where the whole battle is summed up, and it is summed up in the school register.
  « (0 %) » under « Le combat continue » is the closest thing to shaming in the battle. The dragon's
  kind line then has to undo it.
- **Fix** (`lib/battle/lines.ts` `VICTORY`, and `VictorySheet.svelte`):
  - Rename the score as the glory the muster promises (« Plus le rythme est vif, plus la gloire est
    grande »): `score: (s) => \`Gloire gagnée : ${s}\``.
  - Turn the words count into a phrase: `words: (ok, all) => ok === all ? 'Pas un mot de travers !' : \`${ok} mots sur ${all} tiennent bon\``.
  - Drop the percentage from the headline, since it already sits in the Revoir and the journal:
    `caught: (c, d, _r, mode) => \`${mode === 'grimoire' ? 'Dés-accords retrouvés' : 'Pièges déjoués'} : ${c} sur ${d}\``.
  - When `caught === 0` and `draft > 0`, show « Ses pièges se sont bien cachés cette fois » in place
    of « 0 sur 2 ».
  - Keep `rateText` for the journal. The e2e `results-catch-rate` assertions need updating.

### 2. Important: the « +31 XP » headline disagrees with what she earned (c11)
- **What she sees.** A large « +31 XP ». Under it hang the tags « Texte +31 », « Ruse neutralisée
  +200 » and « Objectif de la semaine +40 ». The HUD moves from 154 to 425 XP, which is +271.
- **Why it hurts.** The big number is the smallest share of the gain. The best moment, a lieutenant
  neutralised for +200, reads as a footnote, and the sum does not add up for a child who checks it.
- **Fix** (`VictorySpoils.svelte`, `.xp-gain`):
  - Show the session's total: `progression.xp.session` plus the bonuses, or `xp.after - xp.before`
    if the payload carries it.
  - Keep the tags as the breakdown.
  - Or, if `session` must stay the headline, label it `+31 XP` → « Texte : +31 XP » and add a total
    line « En tout : +271 XP ».

### 3. Important (open item 1, confirmed): the grey XP pill on the sheet (c11, c16–c19, c18b, c18c)
- **What she sees.** A dark translucent rounded pill, « Sentinelle des textes », whose leaves are
  empty. It is grey on the cream parchment and identical to the HUD pill 400 px above it. In c11,
  right after a rank-up, all the leaves are empty.
- **Why it hurts.** `LaurelBar` was designed for the HUD, over a bright sky (the `rgba(21,18,26,.55)`
  scrim). On parchment the scrim turns into a disabled grey widget. It sits exactly where the XP should
  feel like a laurel being won.
- **Fix** (`components/ui/LaurelBar.svelte`): add a `surface: 'sky' | 'parchment'` prop, pass
  `surface="parchment"` from `VictorySpoils`, and under `.laurel.on-parchment`:
  - `background: none; box-shadow: none; color: var(--bronze-dark)`
  - caption `text-shadow: none`
  - empty leaf `background: rgba(92,64,24,.10); border-color: var(--bronze)`
  - `.leaf { width: 16px; height: 26px }`, so the branch reads as the crown's sibling.

  After a rank-up, add the caption « Nouveau rang : les feuilles repoussent » or light the first leaf
  with the carry-over, so the empty branch reads as a fresh start and not as a loss. The ribbon
  « Nouveau rang : … » already explains it, so the cheap version is only the restyle.

### 4. Important (open item 2, confirmed and worse): the boss reward is a grey box, shown twice, and the climax sits below the fold (c18b)
- **What she sees.** « Sandales d'Hermès » in a grey recessed box. Under it, Éris's defeat line
  (« Impossible ! Garde ta pomme… ») is cut by the action footer.
- **Why it hurts.**
  - `.kit-cubby` is a dark recess made for the library's wooden shelves. On parchment it looks like a
    disabled card.
  - The gear reward is also listed twice. `extraRewards` keeps every non-relic reward that no quest
    showed, and the gear is then shown again in `.boss-won .reward-line`. The duplicate is below the
    fold, where she never sees it.
  - The biggest win of the game (beating Éris) ends in a scroll-to-read.
- **Fix** (`VictorySpoils.svelte`):
  - Exclude the boss reward from `extraRewards`:
    `progression.rewards.filter(r => r.kind !== 'relic' && !shownRewardIds.has(r.id) && r.id !== bossReward?.id)`.
  - Render the boss block as a `kit-sheet spoil` whose parts are Éris's voice, then a large
    `Medallion size={72}`, then « Tu gagnes les Sandales d'Hermès ! ».
  - Replace `.kit-cubby` for the other extra rewards with the same `kit-sheet spoil` + medallion.
  - Scroll the boss block into view (`scrollIntoView({block: 'nearest', behavior})`) when its
    `Reveal` fires.

### 5. Important (open item 3, confirmed): editing in compact cuts the first line and makes the rows jump (c10)
- **What she sees.** With the keyboard up, the top line of text is sliced in half under the tool bar.
  The row holding the word editor grows by about 12 px, and the hint « Vide = supprimer le mot »
  hangs under it and pushes « la musique. » down.
- **Why it hurts.** Compact mode shows only about 4–5 lines. Losing half of one, and having rows
  shift while she types, is exactly the legibility-over-décor failure the spec warns about.
- **Fix** (`ProofPhase.svelte`, compact editor):
  - Overlay the editor on the token (`position: absolute` over the run, or an anchored popover the
    width of the input) so it never changes the line box.
  - Move the hint into the compact bar, in place of the trap count, while editing.
  - After it opens, snap the scroller to whole lines:
    `el.scrollTop = Math.round(el.scrollTop / pitch) * pitch`, where `pitch` is the computed line
    height `visibleLines()` already uses.
  - Then `tok.scrollIntoView({block: 'nearest'})`.
  - Add an e2e check that the first visible line box is fully inside the scroller while editing.

### 6. Important: the Bouclier's arrows point the wrong way for her (c09)
- **What she sees.** « Phrase 1 sur 24, en partant de la fin ». The enabled button is « Phrase
  précédente » and « Phrase suivante » is greyed out. The counter wraps and leaves « fin » alone on a
  line. The single sentence floats at the top of an empty 540 px sheet.
- **Why it hurts.**
  - To move forward in the Bouclier walk she has to press « précédente ». Each step raises the
    counter while the label says "back".
  - The orphan « fin » makes the control look broken.
- **Fix** (`lib/battle/lines.ts` `PROOF`, `ProofPhase.svelte` lines ~505–511):
  - Name the directions on the page: `prevSentence: 'Plus haut'`, `nextSentence: 'Plus bas'`.
  - Show the position in text order: `sentencePos: (k, n) => \`Phrase ${k} sur ${n}\``, with
    `k = clampSentence(sentenceIndex) + 1`.
  - Add a one-time caption in the note slot: « Le Bouclier de Persée te fait lire à rebours, de la
    dernière phrase à la première. »
  - Give `.sentence-pos` `white-space: nowrap`.
  - Set the isolated sentence at `font-size: 1.15em` and centre it vertically in the sheet, so the
    shield reads as a spotlight and not as an empty page.

### 7. Important: the dragon breaks agreement in a game about agreement (c14)
- **What she sees.** « Tu as déjoué 1 piège sur 2. **Les autres se cachent** encore : on les
  débusquera ensemble. » Only one trap is left.
- **Why it hurts.** A 13-year-old learning subject–verb and number agreement will catch it, and it
  undercuts the dragon as the voice she trusts.
- **Fix** (`lib/battle/lines.ts` `dragonTally`, the `rate >= 0.5` branch):
  ```ts
  const left = o.draft - o.caught;
  const rest = left === 1
    ? 'Le dernier se cache encore : on le débusquera ensemble.'
    : 'Les autres se cachent encore : on les débusquera ensemble.';
  if (rate >= 0.5) return `${head} ${rest}`;
  ```
  Both « piège » and « dés-accord » are masculine, so one form serves both modes. Add a
  `lines.test.ts` case for (1, 2).

### 8. Important: the boss fight's muster offers a side door out of the fight (c27; real flow)
- **What she sees.** After « Affronter Éris » in the lair (c18), the battle muster shows « Combat
  contre Éris » and the locked paces. Under them sits the bronze « Grimoire corrompu » button with
  « Pas de dictée : relis et répare. »
- **Why it hurts.** `Boss.svelte` navigates to `play?quest=…&encounter=eris`, and `MusterPhase`
  always renders `.grimoire-way`. That button calls `href('grimoire', {profileId, textId})`, which
  drops `quest` and `encounter`. She leaves the boss fight for an ordinary grimoire without being
  told. It is also a second choice at the one moment that should be a single « Commencer ». The
  lieutenant musters (c01, c02) drop `encounter` the same way, a smaller version of the same leak.
- **Fix** (`MusterPhase.svelte` ~line 149):
  - Wrap `.grimoire-way` in `{#if encounter !== 'eris'}`.
  - For lieutenants, pass the encounter through: `href('grimoire', {...}, encounter ? { encounter } : undefined)`.
  - Add an e2e test that the boss muster has no `btn-grimoire`.

### 9. Important (open item 4, confirmed): naming the dragon is a bare form field (c12)
- **What she sees.** « L'œuf éclôt ! », then an empty white input and « C'est son nom ». There is no
  prompt and no placeholder, only an `aria-label`.
- **Why it hurts.** This is one of the big emotional beats of the game, and it is the one form element
  left on the sheet. She has to guess that the box is for a name.
- **Fix** (`VictorySpoils.svelte` ~line 337):
  - Add `<p class="name-ask">Comment vas-tu l'appeler ?</p>` above the field, with
    `placeholder="Son nom…"`.
  - Style the input as writing on the parchment, scoped under `.name-form input`:
    `background: transparent; border: 0; border-bottom: 2px solid var(--bronze); border-radius: 0; font-family: var(--font-display); font-size: 22px; text-align: center`.
  - Keep a 48 px height.

### 10. Minor: the "info box" callout is the last web-app shape on the parchment (c08, c15, c18c, c27)
- **What she sees.** Pale blue, peach or olive rectangles with a 4 px coloured left border:
  - the Fil's « Verbe : « danse ». Maintenant, touche son sujet. »;
  - the Revoir's « Attendu : « chantent » »;
  - the boss loss « Éris s'enfuit avec la pomme… »;
  - the boss banner « Combat contre Éris : … ».
- **Why it hurts.** The left-border alert is a web UI idiom. Everything around it is now scrolls,
  tags, ribbons and voice plates.
- **Fix** (`styles/kit-objects.css` `.kit-note`, shared with the camp):
  - Drop `border-left`. Make it a torn slip: `border: 1px solid rgba(92,64,24,.25); border-radius: 3px; box-shadow: 0 2px 4px rgba(0,0,0,.15)` plus the `--grain` background.
  - Add a small wax seal via `::before` in the tone colour: olive, Éris orange, Aegean.
  - For the Fil, use a gold thread line (`border-top: 2px dashed var(--gold)`) in place of the blue
    bar.
  - The boss-loss line is Éris's exit, so render it as her voice plate
    (`OverlayVoice line={erisSays(…)}`) and not as a note.

### 11. Minor: « Dictée » / « Relecture » headings, grey ruled lines and « J'ai terminé ma relecture » (c04, c06–c09, c20)
- **What she sees.**
  - The battle's heading is the exercise name.
  - The dictation field is ruled in neutral grey, like a school exercise book.
  - « À toi de jouer. Valide quand tout te semble juste. » uses « Valide », form wording.
- **Why it hurts.** It is small, but it is the label she sees for the whole battle. The muster had the
  text's title (« Le chant des fées ») and it disappears once play starts.
- **Fix.**
  - Heading = `text.title`, with the phase as the in-fiction subtitle: « Écris ce que dit la voix »
    for dictation, « Traque les pièges d'Éris » for proofreading.
  - Rulings in sepia: `rgba(92,64,24,.14)`.
  - `stage4: 'À toi de jouer. Quand tout te semble juste, dis-le.'`

  The gold « J'ai terminé ma relecture » is clear and can stay.

### 12. Minor: Argus highlights are taller than the line, so the rows touch (c06)
- **What she sees.** The pale-blue chips around the verbs are about 45 px tall on a 43 px pitch. With
  15 highlights the paragraph becomes a patchwork, and « chantent »/« brillent » nearly meet across
  rows.
- **Fix** (`TokenText.svelte`, the Argus class): keep the button's hit height, but paint only the
  glyph band:
  `background: linear-gradient(transparent 18%, var(--argus-bg) 18% 88%, transparent 88%)`, or a
  `text-decoration: underline 3px var(--aegean); text-underline-offset: 4px` plus a faint tint.

  The legibility gain is large and the cost is nothing.

### 13. Minor: compact lines run to ~100–110 characters (c10, c22)
- **What she sees.** Full-width text at 22 px, so the eye travels 1130 px per line.
- **Why it hurts.** Proofreading beyond about 80 characters a line makes her lose her place on the
  return sweep. The full layout (45–60 characters) is right.
- **Fix.** Keep the full width (lane P's decision), but raise the compact font to 24 px, or cap
  `.text` at `max-width: 82ch; margin-inline: auto`. Either brings it under about 85 characters.

### 14. Minor (open item 5, confirmed): the lair and grimoire musters float in a big empty parchment (c03, c18)
- **What she sees.** A full-height parchment with about 180 px empty above and below the centred
  content.
- **Why it hurts.** In the lair, the empty cream hides the one backdrop (green fire, purple drapes)
  that should feel dangerous.
- **Fix.** For short musters, let the parchment hug its content: on `.muster.short`'s parent
  panel, `height: auto; max-height: 100%; align-self: center`. Make the « Combat I » ribbon larger
  (`font-size: 28px`) and put it above Éris's plate, like a banner.

### 15. Minor: two speech styles on the victory sheet (c13/c14 vs c18b/c19)
- **What she sees.** The after-battle dialogue is a light cream plate with « Tout passer ». Éris's boss
  line and the break nudge are the dark muster voice plate.
- **Fix.** Pick one per purpose and document it:
  - the dark `OverlayVoice` for a single line;
  - the light `DialogueBox` for a conversation.

  The boss line is a single line, so it is fine. Give `DialogueBox dock="fill"` the same portrait size
  (the 56 px crop) so the two read as a family.

### 16. Minor: the break nudge's dragon talks about itself in the third person, and « Pause » goes to camp (c19)
- **What she sees.** The plate is headed « TON DRAGON » and says « Ton dragon bâille : ça fait
  vingt-cinq minutes… ». The button « Pause » actually calls `onCamp`.
- **Fix** (`DragonNudge.svelte`):
  - message: `« (Il bâille.) Vingt-cinq minutes qu'on chasse les pièges… On souffle un peu ? »`
  - the egg version: « (L'œuf frémit.) Vingt-cinq minutes qu'on chasse les pièges… On souffle un peu ? »
  - button: « On rentre souffler », next to « Encore un texte ».

### 17. Minor: the lair's rules read like a spec list (c18)
- **Copy now.** « Un long texte · les Yeux d'Argus restent éteints · chaque piège trouvé reste acquis,
  même si Éris s'enfuit : tu pourras recommencer. »
- **Fix** (`BOSS.rules`): « Un long texte, sans les Yeux d'Argus. Chaque piège que tu trouves reste
  acquis : si Éris s'enfuit, tu pourras revenir l'affronter. »

### 18. Minor: the Revoir scroll keeps three marking habits (c15)
- **What she sees.**
  - « Attendu : « chantent » », the corrector's word;
  - a « DÉJOUÉ ✓ » tick stamp, the teacher's red-pen gesture (in olive);
  - « Ton texte » in a white bordered box that looks like an input.
- **Fix.**
  - `expected: (w) => \`Il fallait : « ${w} »\``.
  - Replace « ✓ » with the small wax seal already used for the quest tag: « déjoué » plus a seal.
  - Give the « Ton texte » box the parchment grain and no white fill:
    `background: var(--grain), rgba(255,250,235,.5)`.

### 19. Minor: tool counts and the editor hint (c06–c10)
- **What she sees.** « Chouette d'Athéna (3) » in the full layout, but a coin badge « 1 » in compact.
  The hint reads « Vide = supprimer le mot ».
- **Fix.**
  - Use the coin badge in both layouts, and drop the parentheses.
  - `editorHint: 'Efface tout pour retirer le mot'`

### 20. Minor: battle presence is thin during a long proofreading (c06–c09, c20, c21, c05)
- **What she sees.**
  - The opponent stands still for minutes unless she uses the Chouette (`flinch`) or changes Argus
    pass (the dragon's `cheer`).
  - The hold bar is 8 px tall in the far corner, so at 2560 wide it is 1000 px from the text.
  - In compact (c05) Léthé is clipped by the right edge of the band.
- **Fix.**
  - Add a neutral reaction on every committed edit that says nothing about correctness: the dragon's
    `brace` or `nod`, which respects the full-HP decision.
  - Make the bar `height: 12px` and place the plate and bar above the opponent's head (anchored to
    the combatant box, not the viewport corner).
  - In the compact band, inset the cut-outs by 12 px so neither is clipped.

### 21. Minor: during the spoils, the next step competes with the footer (c12, c16, c17)
- **What she sees.** « Continuer », which starts the dialogue, sits above a footer whose « Revoir » is
  the darker, primary-looking button.
- **Fix** (`VictorySheet.svelte`): while `spoils` are showing, render all three footer buttons
  `is-quiet`. Make « Revoir » primary once the dialogue is over, when the dragon says « Touche
  « Revoir » ».

### 22. Minor: the rotate screen says « Le camp » over a battle (c23)
- **Copy now.** « Le camp se découvre à l'horizontale. »
- **Fix** (`RotateScreen.svelte`): « Tout se joue à l'horizontale. » This fits the camp, the battle
  and the lair.

---

## Verdicts on the seven open items

| # | Item | Verdict |
|---|------|---------|
| 1 | Grey XP laurel pill on the sheet | **Confirmed, Important** (finding 3). A parchment variant of `LaurelBar`. |
| 2 | Grey boss-reward box | **Confirmed, Important, and worse than reported** (finding 4). The gear reward is also rendered twice, and the climax is below the fold. |
| 3 | Half-cut first line when editing in compact | **Confirmed, Important** (finding 5). Overlay the editor and snap the scroll to whole lines. |
| 4 | Bare dragon-name field | **Confirmed, Important** (finding 9). A question plus an inked-line field. |
| 5 | Lair parchment mostly empty | **Confirmed, Minor** (finding 14). Also true of the grimoire muster (c03). |
| 6 | Faces shots titled « Le grimoire d'Ulysse » on a dictation muster | **Walk artefact, not an app defect.** Keep the shots. For the next walk, seed a dictation text for the faces. The c27 shot did expose a real defect, though: finding 8, the grimoire side door on the boss muster. |
| 7 | Simulated keyboard area shows marble | **Accepted, not a defect.** A real iPad keyboard covers it. |

---

## What works well

- **The long text is comfortable in the full layout.** Literata at about 22 px, a 1.9 line pitch,
  45–60 characters per line, dark ink on an opaque cream sheet, no décor behind the letters (c06, c07,
  c20, c21). Fixing the row height and the orphan full stop paid off: c07 reads like a page of a book.
- **The staging is right.** The dragon and the opponent face each other at every dragon stage and
  against every opponent, stand on their ground, and never enter the text zone. Each opponent has its
  own painted backdrop (river, coast, temple, lair), and the backdrop dims at the reckoning while the
  combatants stay lit.
- **Defeat reads without words.** Protée (c16) and Éris (c18b) fade into the backdrop. Paired with the
  emptied hold bar, this is the battle payoff.
- **Éris's voice is right.**
  - Every taunt is aimed at the camp or at her own creatures: « Mes Sirènes n'ont pas encore chanté »,
    « Aucun héros du camp ne les retrouvera tous », « Hmpf. La moitié de mes pièges, déjoués. J'en
    cacherai mieux la prochaine fois. »
  - Nothing targets the player.
  - The dragon's « on les débusquera ensemble » is warm (once finding 7 is fixed).
- **The muster is a real choice screen, not a form.**
  - The Roman-numeral medallions carry the new pace names.
  - « Plus le rythme est vif, plus la gloire est grande » turns speed into ambition.
  - The quest tag has its wax seal.
- **The compact mode keeps the battle alive.** The band keeps the opponent's plate and hold bar at the
  centre, and all tools stay in reach at 48 px (c05, c10, c22).
- **The victory sheet as an object.** The rods, the scroll, the laurel crown, the hanging paper tags
  and the rank ribbon match the camp's scroll/shelf/codex language. The Revoir scroll (c15), with its
  brass finials, is the best-looking panel of the battle.
- **The rules held.** No emoji, no grade code, no « niveau », no red anywhere. The orange and olive
  underlines in the Revoir are gentle.

---

## The answer

Yes, mostly. The battle now feels like a place and not a page:
- a painted field with two combatants who face each other;
- a taunting antagonist whose voice stays in the fiction;
- a parchment that keeps a long proofreading text as comfortable as a book in the full layout;
- a reckoning where the opponent visibly breaks and fades.

The school register has retreated to two spots. The first, and the one that matters, is the
**victory tally**: « Score : 94 · Mots justes : 12 / 13 · (50 %) », and « 0 sur 2 (0 %) » in a
standoff. That is a marked test sheet stapled under a laurel. With the confusing « +31 XP » headline
and the grey HUD pill and grey reward box on the parchment, it is also the least game-like moment of
the battle. The second is a handful of web-app shapes (the left-border info boxes, a bare name input)
and exercise labels (« Dictée », « Relecture », « Attendu »).

Legibility holds, except while editing in compact, where a half-cut top line and jumping rows undo it.
Two functional traps need fixing before this ships:
- the Bouclier's back-to-front buttons;
- the « Grimoire corrompu » side door that silently leaves a boss fight.

The dragon's « Les autres se cachent » for a single trap needs fixing too, since it is wrong French in
a French-agreement game. Fix findings 1–9 and the battle stage meets §1 and §5.
