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
| e03 | The camp tour's last line, with no ring |
| e04 | After a reload: the greeting (`camp.enter`, with her name) |
| e05–e06 | The library tour on `lens` (the owl); the Delphi tour on `tablets` (the Pythia) |
| e07–e08 | The war tour's last step (Éris); her greeting on the second visit |
| e09–e10 | The nest tour on the egg; the cabin tour on `lyre` |
| e11 | The HUD's sound plate, with the music off |
| e12–e13 | The lyre's sound rows with the voice muted (its warning shown); « Les visites du camp » and the credits, open |
| e14–e16 | The muster's lines: `battle.start`; the muted-voice note with « Rendre la voix »; `battle.retry` after « Rejouer ce texte » |
| e17–e19 | The victory dialogue: Éris's `battle.caught`, the egg's `battle.explain` on « dansent », then the explanation |
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
  - Each toggle has an icon and a word, so on and off never rest on colour alone. Off is the struck
    drawing, at half strength, with the word dimmed.
  - In the band, the plate is opaque over the parchment.
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
  - No emoji anywhere. The arrows in the explanation (e19) are text arrows, not emoji.
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

### Left for the Opus playability review

1. **The sound plate's look (e11, e20).** It is OverlayVoice's night glass in a thin bronze rim, with
   three text rows. Whether it reads as a bronze object or as a dark dropdown menu is a judgment
   call. A heavier bronze rim, or a plaque shape, would be CSS only.
2. **Taps that do not start the sound.** After a reload, the tour's taps and the victory's buttons do
   not unlock the audio. Ruling E3 lists the taps that do: « Entrer », `go()`, the HUD and the
   hotspots.
   - So a child who reloads during a tour hears nothing until she taps a place or the HUD. The notes
     show `unlocked=false` from e01 to e10, and on e15–e19 after the reload.
   - Nothing is lost, but the dialogue box's « Suite » could also unlock. That needs a ruling on E3.
3. **The Delphi ring (e06).** It spans the whole votive wall, so the label « Le mur des quêtes » sits
   on the ring's edge. It is readable.

## Part 2: the iPad checklist (for the user)

Use a real iPad with Safari, the sound up and the silent switch off, unless a step says otherwise.
Tick each line, and note anything odd next to it.

**Before « Entrer »**
- [ ] The title page is silent: no music, no click, even after a tap on the background.
- [ ] After « Entrer », a soft chime plays and the sea wind fades in over about a second.

**Each place's loop**
- [ ] Camp, nest and cabin play the fire (`camp`).
- [ ] The parchment tent and Delphi play the temple drone (`temple`).
- [ ] The war tent plays Éris's loop (`lair`).
- [ ] A battle plays the drums (`battle`). Éris's own lair plays `lair`.
- [ ] Walking from one place to another crossfades in about a second: no gap, and never two loops
  at once for long.

**The loop seams.** A test build showed a tiny gap at the loop point of `temple` and `battle`. This
is the AAC encoder's start-up padding, and the game's loop regions should hide it.
- [ ] Stay in the camp for two full turns (about 2 minutes): no click and no gap at the seam.
- [ ] The same in the parchment tent (`temple`, about 67 s a turn).
- [ ] The same in a battle muster (`battle`, about 66 s a turn).
- [ ] The same in the war tent (`lair`) and on the title (`sea`, about 57 s).

**Ducking while the voice reads**
- [ ] During a dictation the battle loop drops low under the voice before the first word, and
  stays low while you write, between sentences too.
- [ ] While proofreading the loop stays low.
- [ ] At the victory the loop comes back up.
- [ ] Back at the camp, the fire is at full level, not stuck low.

**The voice slider** (the lyre, « La voix »)
- [ ] At 40 %, « Écouter un essai » and a dictation are quieter than at 100 %. If the iPad ignores
  the slider, only the device's volume buttons change the voice. The lyre says so; note which
  one you get.

**The voice muted** (the lyre, « Sourdine » for la voix; Ruling E7b)
- [ ] The lyre shows « En sourdine, la dictée n'est plus lue à voix haute… ».
- [ ] The muster shows « La voix de la dictée est en sourdine. » with « Rendre la voix ».
- [ ] In a dictation nothing is spoken, not even quietly, and the dictation still moves on at its
  usual pace.
- [ ] « Rendre la voix » gives the voice back for the next dictation.

**The silent switch** (Ruling E3)
- [ ] With the switch on, the music and the effects stop.
- [ ] Note whether the dictation's voice still speaks with the switch on. That is the iPad's
  choice, not the game's; just write down what happens.

**Coming back**
- [ ] Lock the iPad while a loop plays, then unlock: the loop is back by the first tap at the
  latest.
- [ ] The same after a phone or FaceTime call, or after Siri.
- [ ] The same after switching to another app and back.

**Memory.** Each place's loop is loaded again at each visit.
- [ ] Walk back and forth between the camp, the tents, Delphi and the nest about 30 times. The
  game stays smooth, the loops keep playing, and Safari does not reload the page.

**The sounds themselves** (Ruling E17's listening pass, if not done at the Task 3 checkpoint)
- [ ] The weekly laurel: when the week's goal is reached, the victory's laurel sound is a leaf
  rustle with a small chime. It is the fallback recording plus a chime; check that it does not
  hiss.
- [ ] The short effects (the tap, the seal, the scroll unrolling, the chime) are quieter than the
  others by design. Check that each one can still be heard over the music at the default levels.
- [ ] A reckoning's blows (`strike`) and a rout's fanfare sound like a fight, not a school bell.
- [ ] The overall mix at the defaults (music 50 %, effects 70 %, voice 100 %):
  - the music never covers the voice;
  - no effect is jarring;
  - the battle loop is not louder than the camp's.
- [ ] Rapid taps (for example, tapping a hotspot five times fast): no cascade of clicks, and no
  effect plays over the dictation's voice.
