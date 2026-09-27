# UI5 walk notes and the iPad listening checklist

Two parts:
- Part 1 is the walk: what the shots show, what was checked, and what is left for the Opus
  playability review.
- Part 2 is the checklist for a real iPad. It covers the sound, which no e2e can hear (Ruling E10
  keeps real sound out of every test).

## Part 1: the walk

**How it is made.** `web/e2e/playability-ui5.spec.ts` runs on the iPad landscape viewport (1180×820)
with tours on. The baseline was written with:

    WALK_OUT=docs/reviews/ui5 scripts/playwright.sh --config playwright.playability.config.ts playability-ui5

**Heroes and fixtures.**
- « Nausicaa-Iris » is a fresh hero: she has seen no tour.
- « Pénélope-Aurore » is the battle hero.
- The battle section intercepts `/camp` so that no lieutenant is awake. This makes the free text
  Éris's own fight, so her muster line is `battle.start`.

**What the walk writes.** `walk-notes-ipad-landscape.md` records, for each shot:
- the mixer's state: the loop wanted and playing, and the ducks;
- any RED;
- the request origins.

The portrait run only checks that the rotate screen shows, and takes no shot.

| Shot | What it shows |
|---|---|
| e01 | The camp tour's first line (the egg), with the whole camp dimmed |
| e02 | The camp tour on `parchemins`, with the gold ring |
| e03 | The camp tour's last line, with no ring, and « C'est parti ! » in place of « Passer la visite » |
| e04 | After a reload: the greeting (`camp.enter`, with her name) |
| e05–e06 | The library tour on `lens` (the owl); the Delphi tour on `tablets` (the Pythia) |
| e21 | The war tour on its lieutenants' line: a rounded frame around the wall of portraits |
| e07–e08 | The war tour's last step (Éris); her greeting on the second visit |
| e09–e10 | The nest tour on the egg; the cabin tour on `lyre` |
| e11 | The HUD's sound plate (a bronze plaque), with the music « en sourdine » |
| e22 | The lyre as it opens: the egg's line in the parchment box, then the voice and the sound rows |
| e12–e13 | The lyre's sound rows with the voice muted (its warning shown); the seal, « Enregistrer » in its own row, then « Les visites du camp » past an engraved line, and the credits, open |
| e14–e16 | The muster's lines: `battle.start`; the muted-voice note with « Rendre la voix »; `battle.retry` after « Rejouer ce texte » |
| e17–e19 | The victory dialogue: Éris's `battle.caught`, the egg's `battle.explain` on « dansent », then the explanation in the egg's own words |
| e20 | The compact battle band (simulated keyboard) with the sound plate hanging below it |

### Checked on every shot

- **The ring (e02, e05, e06, e09, e10).**
  - It circles its hotspot.
  - The label stays readable next to it, not under the dimming.
  - The dialogue box never covers the ringed hotspot: every ring sits above the box's dock.
  - Only the 1180×820 size is shot. `scenes-tours` measures the ring against the shelves on both
    e2e projects.
- **The dimming.**
  - It is night-blue, never black.
  - The HUD band stays in daylight.
  - The place labels stay legible.
- **The sound plate (e11, e20).**
  - A bronze plaque with a dark rim, four rivets and a notch under the lyre button; engraved words
    and lines between the rows; « Ouvrir la lyre » is a small parchment button.
  - Each row says its state in the lyre's words, « en marche » or « en sourdine », so on and off never
    rest on colour alone. A silenced row sits pressed into the bronze, like the lyre's pressed
    « Sourdine », and its icon is struck through.
  - In the band, the plate is opaque over the parchment and hangs right under its lyre button.
- **The lyre rows (e12).**
  - The sliders are bronze on parchment.
  - « Sourdine », when pressed, is a bronze button.
  - A muted channel's slider is greyed.
  - The E7 warning shows under the voice row.
- **French spacing.**
  - Every « ! ? : » has its narrow space: « Toc, toc ! », « Deuxième manche ! », « L'Hydre recule ! ».
  - The guillemets are spaced inside: « dansent ».
  - No line starts with a lone mark.
- **Colour, emoji and school words.**
  - No red: `redScan` ran on e01, e04, e05, e07, e10, e11, e12, e14, e17 and e20, and found none.
  - No emoji anywhere. The explanation in the dialogue (e19) has no arrows any more; « Revoir »'s
    cards keep their text arrows (not emoji).
  - No « niveau ». The only grade codes are the lyre's class medallions (5H–11H, e12), which the
    UI3 re-review accepted.
- **One request origin.**

### Fixed during the walk

- **The sound plate stayed open under a tour.** The camp tour starts when the camp data arrives, and
  the plate may be open at that moment.
  - On a real iPad a tapped button takes no focus, so the tour taking focus did not close the plate.
    The next tap then did two things: it closed the plate (the plate's tap-outside) and moved the
    tour on (the tour's tap-anywhere).
  - Fix: `SoundPlate` now closes whenever a modal opens (a tour or a panel).
  - The e2e is « a tour that opens closes the sound plate, and the HUD stays shut under the tour »
    in `scenes-tours`.
- **The walk itself.** e11 was first shot while the greeting was still typing its line. The walk now
  shows the line whole first.

### Left for the Opus playability review, and what became of it

1. **The sound plate's look (e11, e20).** The review found it read as a dark dropdown menu. Fix wave B
   made it a bronze plaque (see above).
2. **Taps that do not start the sound.** Ruling E3b (fix wave A): the first completed tap anywhere
   unlocks the audio after a reload (the title keeps « Entrer »). The walk notes show it: e04, e08
   and e15 are shot right after a reload, before any tap (`unlocked=false`); every shot after the
   next tap, a tour's included (e02, e05, e16–e19), has `unlocked=true`.
3. **The Delphi ring (e06).** It spans the whole votive wall, so the label « Le mur des quêtes » sits
   on the ring's edge. It is readable.

## Part 2: the iPad checklist (for the user)

Use a real iPad with Safari and the sound up. Silent mode must be off unless a step says otherwise:
open Control Centre (swipe down from the top-right corner of the screen) and check that the bell is
not crossed out. Older iPads have a switch on the side instead.

Tick each line. When something is wrong, write down next to it which screen you were on and the
time. A failing line is never your fault, and there is nothing to fix on your side: the note is all
we need.

**Before « Entrer »**
- [ ] The title page is silent: no music and no click, even after a tap on the background.
- [ ] After a tap on « Entrer », a soft chime plays. On the next screen, where you choose a hero,
  the sound of the wind and the sea fades in over about a second.

**The music of each place**
- [ ] The camp, the dragon's nest and your cabin play a crackling fire.
- [ ] The parchment tent and Delphi play a low temple hum.
- [ ] The war tent plays Éris's darker music, with low strings.
- [ ] A battle plays drums.
- [ ] Once the battle path at the camp is open and Éris herself shows up, open that battle. You
  should hear Éris's darker music, not the drums.
- [ ] When you walk from one place to another, the old music fades out while the new one fades in.
  After about a second you should hear only the new place.

**When the music starts over.** Each place's music repeats. Listen for the moment it starts over:
you should hear no click and no short silence.
- [ ] At the camp: stay for about 2 minutes.
- [ ] In the parchment tent: stay for about 2 minutes.
- [ ] In a battle, on the screen where you choose the rhythm: stay for about 2 minutes.
- [ ] In the war tent, and on the screen where you choose a hero (the wind and the sea): about
  2 minutes each.

**The music goes quiet while the voice reads**
- [ ] During a dictation, the drums drop low before the first word. They stay low while you write,
  between sentences too.
- [ ] After the last sentence, when the whole text is shown for you to reread and fix, the music
  stays low.
- [ ] When the battle is won, the music comes back up.
- [ ] Back at the camp, the fire is at its full level, not stuck low.

**The voice's volume**
- [ ] In the lyre, set « La voix » to 40 % and tap « Écouter un essai ». Set it to 100 % and tap it
  again. Is the second one louder? Write yes or no.
- [ ] If no: during a dictation, try the iPad's volume buttons instead, and write down whether they
  change the voice.

**The voice in « Sourdine »** (in the lyre, the « Sourdine » button of « La voix »)
- [ ] The lyre shows « En sourdine, la dictée n'est plus lue à voix haute… ».
- [ ] Before a battle, the rhythm screen shows « La voix de la dictée est en sourdine. » with
  « Rendre la voix ».
- [ ] In a dictation nothing is spoken, not even quietly, and the dictation still moves on at its
  usual pace.
- [ ] Choose the third rhythm, « D'un bon pas », and read the dictation aloud yourself as it goes:
  each group of words leaves you the time to say it twice, as the voice would. Write down if it runs
  ahead of you or drags.
- [ ] « Rendre la voix » gives the voice back for the next dictation.

**Silent mode**
- [ ] Turn silent mode on (the bell in Control Centre; on an older iPad, the side switch): the music
  and the sound effects stop.
- [ ] Write down whether the dictation's voice still speaks in silent mode. The iPad decides that,
  not the game: just note what happens.

**Coming back to the game**
- [ ] Lock the iPad while music plays, then unlock it: the music is back by your first tap at the
  latest.
- [ ] The same after a phone or FaceTime call, or after Siri. Make that first tap a tap on the
  character's speech box or on a tour, not on a place: any tap anywhere must bring the music back.
- [ ] The same after switching to another app and back.
- [ ] Reload the page at the camp: it is silent until your first tap, and that first tap brings the
  fire, wherever it lands: the speech box, a tour, an empty spot of the camp. On the title page,
  only « Entrer » starts the sound.
- [ ] During a dictation, if the voice ever stops in the middle of a sentence and nothing happens,
  wait: within a few seconds the dictation moves on by itself and the music comes back up.

**Memory**
- [ ] Walk between the camp, the tents, Delphi and the nest for about 5 minutes. The game stays
  smooth, the music keeps playing, and Safari does not reload the page.

**The sounds themselves**
- [ ] The weekly laurel: in the lyre, set « Ton objectif » to 2 texts a week, then win two battles
  in the same week. At the second victory you should hear leaves rustling and a small chime. Listen
  for any hiss.
- [ ] The small sounds (a tap, a wax seal breaking, a scroll unrolling, a chime) are quieter than the
  others on purpose. Check that you can still hear each one over the music.
- [ ] During the victory count, each trap that is still standing makes a hit sound. When you catch
  almost every trap, a short fanfare plays. Both should sound like a fight, not like a school bell.
- [ ] With the lyre at its first settings (music 50 %, sound effects 70 %, voice 100 %):
  - the music never covers the voice;
  - no sound is jarring;
  - the battle drums are not louder than the camp's fire.
- [ ] Tap a place five times fast: no cascade of clicks. During a dictation, no sound effect plays
  over the voice.

<!-- For the developers, not the parent. Where each line comes from: the loops are `camp` (fire),
`temple` (hum), `lair` (Éris, also her own battle), `battle` (drums), `sea` (the hero choice, ~57 s);
Rulings E3/E3b (unlock, silent mode, the title's « Entrer »), E5 (ducking), E7/E7b (the voice in
« Sourdine » waits the time of its speech: `SPEECH_MS_PER_CHAR`, final review I1), E9 (the loop seams:
the AAC priming skipped by the loop regions), E17 (the listening pass); final review I2 (the watchdog)
and I3 (resume on any tap); the memory line was « about 30 walks » (the loops are decoded again at
each visit). The laurel is the fallback recording plus a chime layer (Task 3b). UI5 playability
review, Part 2: plain words for a parent, Control Centre's bell on iPads without a side switch. -->
