# UI5 playability and immersion review (dialogue, tours, sound controls)

Scope: the 20 landscape shots in `docs/reviews/ui5/`, the walk notes, `notes.md` (Part 1 and the
Part 2 checklist), every line in `content/dialogue/*.json`, and the lines UI5 puts next to them
(`web/src/lib/battle/lines.ts`, `web/src/lib/explain.ts`, `SoundPlate.svelte`). Spec
`2026-09-24-scenes-ui-design.md` §1, §7, §8.

Typography check. The JSON is written with plain spaces, and `sayKey` and the battle helpers run
`frenchSpacing` at render. Every shot shows the narrow spaces: « Toc, toc ! », « Hou ! »,
« dansent », « Quoi ?! ». No line starts with a lone mark. Nothing to fix here.

Counts: **0 Critical, 6 Important, 16 Minor.**

## Findings

### 1. Important: the sound plate reads as a dark dropdown menu, not a bronze object (e11, e20)

**What she sees.** The HUD's lyre drops a near-black rounded rectangle with a 1px gold hairline and
a soft drop shadow. It has three rows of small-caps text with no dividers and no visible control,
plus an underlined web link, « La lyre ». Over the camp's sunset (e11) it passes as an iOS context
menu. Over the battle's cream parchment (e20) it is the darkest thing on screen, a black hole in the
top-right corner. Nothing else in the HUD looks like it: the HUD's round buttons are bronze, and the
lyre panel it leads to is parchment with bronze buttons.

**Why it hurts.** §1 wants every control to be an object from the world. This is the one piece of
UI5 that looks like the operating system, and she will open it often.

**Fix (CSS and markup only).** Make it a bronze plaque that hangs from the lyre button:
- a bronze gradient body (the `.kit-btn` bronze, for example `#8a5a2b` to `#5e3a1a`) with a 3px
  rim, a 1px inner highlight at the top, and four small rivets (radial gradients) at the corners;
- a small notch or tab at the top edge under the lyre button, so it visibly drops from it;
- engraved parchment-coloured text with a 1px dark text-shadow;
- thin engraved dividers between the rows;
- « La lyre » as a small bronze-on-parchment button (`Ouvrir la lyre`), not an underlined link.

If a plaque is too much, a parchment tablet with a bronze rim, matching the lyre panel, would also
fit. Night glass should not be used for it.

### 2. Important: on and off on the plate hang on a dimmed word, and the meaning is the lyre's reversed (e11, e20; `SoundPlate.svelte`)

**What she sees.** Music off (e11) and music on (e20) differ only by a thin stroke across a 26px
icon and the word « Musique » at half strength. Seen alone, a dimmed row reads as "not selected" or
"disabled", not as "the music is off". The notes say the state never rests on colour alone. But the
word is the same in both states: only its strength changes, so the state is carried by opacity plus
a small stroke.

In the lyre (e12) the button is « Sourdine », and pressed (dark bronze) means **silenced**. On the
plate, `aria-pressed` means **playing**. The same idea is shown two opposite ways, two taps apart.

**Fix.** Use the lyre's vocabulary on the plate. Each row gets the channel name, then a state word
that changes:
- on: « Musique » with « en marche » in small type;
- off: « Musique » with « en sourdine » in small type, and the struck icon.

Alternatively, give each row the lyre's own « Sourdine » pill: parchment when released, dark
bronze when pressed. Either way, the same look must mean the same thing in both places.

### 3. Important: Éris calls herself « Sournois », in the masculine (`web/src/lib/battle/lines.ts:184`, `VICTORY.erisIntroduced`)

**What she reads.** « (Et j'en ai glissé 2 pendant ta relecture. Sournois, je sais.) »

**Why it hurts.** Éris is a goddess, and elsewhere she agrees correctly (« Je note, vexée. »). In a
game about agreement, the antagonist gets her own adjective wrong. A 13-year-old who has just been
drilled on accords will notice, or worse, learn it.

**Fix.** « (Et j'en ai glissé 2 pendant ta relecture. Sournoise, je sais.) » Also add a content test
that checks the feminine forms of the adjectives Éris uses about herself.

### 4. Important: the dragon's explanation is a grammar-book formula, not the dragon talking (e19; `explain.ts:169`, `:237`)

**What she reads.** Under « L'ŒUF »: « « dansent » s'accorde avec son sujet « Les fées » → pluriel →
terminaison « nt » ». It has arrows, no verb, no final full stop, and « terminaison », a word from
the textbook.

**Why it hurts.** The line before it is warm (« Un piège que je veux te montrer : « dansent ». »),
and then the character's box turns into an exercise-sheet caption. §8 says characters speak and
there is no school register. This is the one moment the companion teaches, so it is where the voice
matters most. The arrow chain is fine in « Revoir »'s reference cards, but not in a speech bubble.

**Fix.** Give the dialogue its own spoken form of each explanation. Keep the arrow form for Revoir.

- For the verb agreement: « Qui danse ? « Les fées ». Elles sont plusieurs, alors le verbe prend
  « -nt » : « dansent ». »
- The fallback at `explain.ts:110` becomes: « Ce verbe suit celui qui fait l'action. Cherche qui
  danse, et tu sauras comment l'écrire. »

Each spoken line ends with a full stop.

### 5. Important: two of Éris's reckoning lines mock the child's low score instead of the camp (e17; `battle.json` `battle.caught`[2], `battle.missed`[1])

**What she reads.**
- At 1 trap in 4 (e17): « Tu en as trouvé quelques-uns ? Garde-les. J'en ai plein d'autres. »
- At zero: « Pas un piège débusqué ! Mes lieutenants sont fiers d'eux… pour aujourd'hui. »

**Why it hurts.** The spec says Éris's taunts target the camp's heroes in-fiction, and never shame.
The first line sneers at her small success: "keep your little finds". The second celebrates her zero
with an exclamation mark. Both land right on the score line, when she is most exposed. The other
lines in these keys do it well: « Mais tu commences à voir clair… », « Le dragon va vouloir les
chercher avec toi, je parie ».

**Fix.**
- `battle.caught`[2]: « Quelques-uns de mes pièges, débusqués… Le camp apprend vite. Trop vite à mon
  goût. »
- `battle.missed`[1]: « Mes pièges ont tenu, cette fois. Mais au camp, on les cherche déjà, je le
  sens. »

### 6. Important: after a reload, a whole tour, and the victory, play in silence (walk notes e01–e10, e15–e19: `unlocked=false`)

**What she sees and hears.** Safari on an iPad evicts and reloads background tabs often. She comes
back and the tour runs with no fire and no chime until she happens to touch a place or the HUD. Only
the taps that Ruling E3 lists unlock the sound. She will think the sound is broken right in the
first-visit experience, and she may go and mute or unmute things to "fix" it.

**Fix.** Ask for a ruling that extends E3: every tap on the dialogue box (the chevron, « Passer la
visite », « Tout passer », a tap anywhere on a tour) and on the victory's buttons calls
`unlockAudio()`. They are all real user gestures, and unlocking on them has no downside.

### 7. Minor: the camp tour opens with four lines of lore and nothing lit (e01; `camp.json` `tour`[0–4])

**What she sees.** The egg's hello comes first. Then the Muses, then the dés-accords, then « Relis
une chose à la fois… ». That is four taps on a dimmed camp with no ring before the first place
lights up. There are eleven steps in all.

**Fix.** Merge the three lore lines into two:
- « Les Muses comptent sur toi : Éris, la déesse de la Discorde, sème des dés-accords dans les
  textes du camp. Un -s oublié, un a pour un à… »
- « Chacun de ses lieutenants cache une ruse. Relis une chose à la fois, et elles tombent une à
  une. »

### 8. Minor: the tour's last step still offers « Passer la visite » (e03)

**What she sees.** The last line tells her « touche un lieu du camp ! », yet the button next to it
still says « Passer la visite », which is odd for the step that ends the tour.

**Fix.** On the last step, label the button « C'est parti ! ».

### 9. Minor: Éris's war-tent greeting can repeat, word for word, the tour she just heard (e07, e08; `war.json`)

**What she reads.** The tour ends with « Fouillez mon dossier tant que vous voudrez, au camp. Mes
meilleures ruses n'y sont pas écrites. » `war.enter`[0] is « Tiens, de la visite. Fouillez mon
dossier : mes meilleures ruses n'y sont pas écrites. »

**Why it hurts.** The anti-repeat memory is per key, so on her second visit the greeting has a
one-in-four chance of being a rerun.

**Fix.** Replace `war.enter`[0] with « Tiens, de la visite. Mon dossier te plaît ? Il en manque la
moitié, bien sûr. »

### 10. Minor: the war tour names the lieutenants on the canvas but does not light them (e07; `war.json` `tour`[1])

**What she sees.** « Ses lieutenants sont épinglés sur la toile » is said with `target: null`. The
six portraits are right there, and they are the most striking thing in the tent.

**Fix.** Ring the portrait wall. If it has no hotspot, give the tour a target area for it, or ring
« L'Hydre ».

### 11. Minor: the owl's « Hou ! » tic, and one sentence said three ways (`library.json`)

**What she reads.** Nine of the owl's twelve lines start with « Hou ! ». Three of them say almost
the same thing: `library.enter`[0], `library.owl`[0] and `tour`[0] are all « Tes parchemins dorment
sur les étagères… ». Entering the tent and then tapping the owl can give that sentence twice in ten
seconds.

**Fix.**
- Keep « Hou ! » on about a third of the lines.
- `library.enter`[0]: « Bienvenue sous la tente. Les étagères sont pleines, et le pupitre attend
  ta plume. »
- `library.owl`[1]: « Au pupitre, tu peux écrire ou coller un texte à toi. »
- `library.owl`[2]: « Hou… La lentille de bronze déchiffre les feuilles imprimées de ta classe. »

### 12. Minor: « Te revoilà » three times across keys (`camp.json` `camp.enter`[1], `nest.json` `nest.enter` hatchling[0], `nest.name`[0])

**What she reads.** Walking from the camp to the nest can give « Te revoilà ! » twice in a minute.

**Fix.**
- `nest.enter` hatchling[0]: « Ah, c'est toi ! Chaque ruse d'Éris neutralisée me fait grandir. »
- `nest.name`[0]: « Alors, tu m'as trouvé un nom ? »

### 13. Minor: outside the nest, the dragon speaks the same at every stage (e04, e11; `camp.json` `camp.enter`, `camp.next.*`)

**What she reads.** The egg says « Salut, {hero}. Le camp est plus calme quand tu es là. » and
« On y va quand tu veux ». The adult guardian says the same words. Only the nest has lines by
stage, so the companion does not grow where she spends most of her time.

**Fix.** Add two lines to `camp.enter` for each stage (the `when.stage` pool wins over the generic
one):
- egg: « Toc, toc ! Bonjour, {hero}. Je t'attendais bien au chaud. » and « {hero} ! J'ai
  tapoté ma coquille toute la nuit. »
- hatchling: « {hero} ! Regarde, j'ai fait de la fumée ! »
- young: « {hero} ! J'ai volé jusqu'au temple, ce matin. »
- adult: « {hero}. J'ai fait le tour du camp en volant : tout est calme. »

### 14. Minor: the Pythia sends her to shelves that are in another tent (e06; `delphi.json` `tour`[2])

**What she reads.** « …pose son texte sur les étagères : j'en ferai une prophétie. » She is in
Delphi, where there are no shelves. The shelves are in the parchment tent.

**Fix.** « Et quand ta classe prépare une dictée, apporte son texte à la tente des parchemins :
j'en ferai une prophétie. »

### 15. Minor: the cabin tour's trophy line sounds like a design promise to parents (e10; `cabin.json` `tour`[0])

**What she reads.** « Chaque récompense est annoncée à l'avance : rien n'est tiré au sort. » The
dragon is quoting the spec's no-loot-box rule.

**Fix.** « L'étagère garde tes trésors. Ici, pas de hasard : tu sais toujours ce que tu peux
gagner. »

### 16. Minor: in the lyre, the pinned egg box crops a label, and « Enregistrer » looks as if it belongs to the tours (e13)

**What she sees.**
- The egg's box stays pinned at the top of the scroll, and « Tes quatre chiffres » shows only as a
  sliver under it.
- « Enregistrer » sits right under « Refaire les visites du camp », so it reads as the button that
  saves the tours.

**Fix.**
- Let the box scroll away with the content, or give its bottom edge a parchment fade.
- Put « Enregistrer » in its own row, before « Les visites du camp », with a divider between them.

### 17. Minor: the egg's line in the lyre is clumsy (e12; lyre panel intro)

**What she reads.** « Ici, tu choisis la voix qui te lit la dictée, et si le camp fait du bruit. »

**Fix.** « Ici, tu règles la voix qui te lit la dictée, la musique du camp et ses bruitages. »

### 18. Minor: the same characters speak in two different boxes (e12, e14–e16 compared with e01–e10)

**What she sees.** In the places, the box is light parchment with upright text. Inside a panel (the
lyre, the muster) it is dark night glass with italic text, the same material as the sound plate.

**Fix.** Use the parchment box with a bronze rim inside panels too, with upright text. Italics can
stay for asides only.

### 19. Minor: « Écoute bien la voix… » can play while the voice is muted (e15; `battle.json` `battle.start`[3])

**What she sees.** In e15 the muster shows « La voix de la dictée est en sourdine » directly under
Éris. The generic `battle.start` pool includes a line that tells her to listen to that voice.

**Fix.** « Ouvre l'œil… Moi, je guette les accords qui s'égarent. »

### 20. Minor: the victory panel leaves a large empty space under Éris (e17–e19)

**What she sees.** The dialogue box sits in the middle, and about 200px of blank parchment lie
between it and the buttons. It looks unfinished.

**Fix.** Dock the dialogue box just above the button row, or centre the whole block vertically.

### 21. Minor: Éris's retry line never names the lieutenant on the field (e16)

**What she sees.** The Hydra fills the right side of the screen, and Éris says « J'ai changé mes
pièges de cachette. »

**Fix.** The context already carries `opponent`. Add one `battle.retry` line per lieutenant, for
example:
- `hydre`: « Revoilà ce parchemin ? Mon Hydre y a fait repousser ses têtes. »
- `echo`: « Encore ce texte ? Écho y répète ses pièges, un peu différemment. »

### 22. Minor: the muster's last line is cut in half at the panel's edge (e15)

**What she sees.** « Éris a déjà recopié ce texte… Pas de dictée : relis et répare. » shows as the
top half of a line of letters. The muted-voice note pushed it down.

**Fix.** Add a bottom padding equal to one line-height inside the scroll area, or a parchment fade
at the bottom edge, so that a cut line clearly reads as "there is more below".

## The iPad checklist (notes.md Part 2): clarity for a parent

Overall the checklist is concrete and tickable. Its problems are developer vocabulary and a few
steps that do not say how to get there.

1. **Internal loop names.** `camp`, `temple`, `lair`, `sea` and `battle` mean nothing when you
   listen. Describe the sound instead: « a crackling fire », « a low temple hum », « Éris's darker
   music, with low strings », « the wind and the sea », « drums ».
2. **Rulings and tasks** (« Ruling E7b », « Ruling E3 », « E17's listening pass », « the Task 3
   checkpoint »). Remove them from the parent's text, or move them into a hidden trailing comment.
3. **« Éris's own lair plays `lair` ».** A parent does not know where that is. Say how to reach it:
   « When the battle path at the camp is open and Éris herself shows up, open that battle. You
   should hear Éris's music, not the drums. »
4. **The silent switch.** iPads made since about 2020 have no side switch. Rewrite: « Silent mode:
   open Control Centre (swipe down from the top-right corner) and tap the bell. Older iPads have a
   switch on the side instead. »
5. **The loop seams.** « the AAC encoder's start-up padding, and the game's loop regions » is
   jargon. Rewrite: « Each place's music repeats. Listen for the moment it starts over: you should
   hear no click and no short silence. »
6. **The title's `sea`, about 57 s,** contradicts « the title page is silent ». Say which screen
   plays the sea: « After « Entrer », on the hero choice screen… ».
7. **« While proofreading ».** Rewrite: « After the last sentence, when the whole text is shown for
   you to reread and fix, the music stays low. »
8. **The voice slider item** mixes an instruction with an explanation. Rewrite: « In the lyre, set
   « La voix » to 40 % and tap « Écouter un essai ». Set it to 100 % and tap it again. Is the
   second one louder? Write yes or no. If no, try the iPad's volume buttons during a dictation
   instead, and write down whether they work. »
9. **The weekly laurel.** It does not say how to trigger it. Rewrite: « In the lyre, set « Ton
   objectif » to 1 text a week, then win one battle. At the victory you should hear leaves rustling
   and a small chime. Listen for any hiss. »
10. **« A reckoning's blows (`strike`) and a rout's fanfare ».** Rewrite: « During the victory
    count, each trap that is still standing makes a hit sound. When you catch almost every trap,
    a short fanfare plays. Both should sound like a fight, not like a school bell. »
11. **« Never two loops at once for long ».** Say what "long" is: « The old music fades out while
    the new one fades in. After about a second you should hear only the new place. »
12. **Memory, about 30 times.** A time is easier to track than a count: « Walk between the camp,
    the tents, Delphi and the nest for about 5 minutes. »
13. **Add a line on where to write down problems** (the screen and the time), and one saying that
    a failing item is not the parent's fault and needs no fixing on their side.

## What works well

- **The tours are a real improvement on instruction paragraphs.** The ring (e02, e05, e09, e10) is
  gold and soft, and it frames the object, not a UI box. The labels stay readable. The box never
  covers the ring. « Passer la visite » is always there, so she is never trapped.
- **Each place has its host.** The owl in the tent, the Pythia in Delphi, and the egg everywhere
  else. Éris gets the last word in the war tent, which is the right place for it (e07). This is
  §8's « characters speak in their places » done properly.
- **The egg's voice at the nest is lovely and grows by stage:** « J'ai essayé de cracher du feu.
  Juste de la fumée, pour l'instant. », « Mes ailes me portent déjà jusqu'au feu du camp. » It is
  warm and slightly funny, and it fits a 13-year-old.
- **Éris is mostly pitched right.** She is vain and petty and always loses face: « Je recule… d'un
  pas. Un tout petit pas. », « Mes lieutenants tremblent. Un peu. Pas beaucoup. », « Je note,
  vexée. ». The grimoire lines are specific to that mode, and « dés-accords » is a good running
  pun. She uses « tu » for the child and « vous » for the camp, and she keeps to it.
- **There is no FOMO anywhere.** « Tu peux souffler, ou continuer si le cœur t'en dit. » is exactly
  the tone the spec asks for. Delphi says « lundi » without any countdown.
- **The muted voice is handled kindly.** The copy is plain and non-judgemental (« il faudra
  quelqu'un pour te la lire »). The fix, « Rendre la voix », is one tap on the very screen where it
  matters (e15).
- **The lyre's rows (e12) are good in-world controls.** They have bronze sliders, a « Sourdine »
  that clearly depresses into dark bronze, and a greyed slider when muted. The plate should borrow
  from them (findings 1 and 2).
- **The typography is clean everywhere**, and the agreements addressed to the player stay neutral
  (« tu n'as rien laissé passer », « tes trésors t'attendent »). There is no emoji, no red, and no
  « niveau ».

## Verdict

Yes, for the most part the characters now carry the game. The tours turn the camp into a place
someone shows you around, and the owl, the Pythia and the growing egg give each space a host.
Éris's asides at the muster and the victory make each battle feel like a scene rather than a form.
Four things still break the illusion, and all are cheap to fix:
- the dragon slips into textbook arrows at the one moment it teaches (4);
- Éris mis-agrees her own adjective (3) and, twice, sneers at a low score instead of at the camp
  (5);
- the sound plate is the one object that looks like iOS rather than the world (1, 2);
- sound stays off after a reload until the right tap (6).

Fix those six Important items and the minor voice-variety passes (the owl's tic, the staged egg at
the camp, the repeated greetings), and the dialogue layer will be the strongest part of the game's
immersion.
