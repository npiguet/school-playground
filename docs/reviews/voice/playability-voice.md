# Kokoro voice playability review (the waiting line, Éris's card, the lyre's trial)

Scope: what the player sees while the server's voice gets ready, reads, pauses, fails and comes
back. That covers the three new pieces: the Pythia's waiting line, Éris's card (« Réessayer »,
« Retour au camp ») and the lyre's trial. Spec `2026-09-27-kokoro-voice-design.md` §5, the Task 9
and Task 10 reports, and the copy in `content/dialogue/battle.json` (`battle.voice.*`),
`web/src/lib/battle/lines.ts` (`VOICE_LOST`, `DICTATION`), `VoiceLostCard.svelte`,
`DictationPhase.svelte` and `LyrePanel.svelte`.

How it was played. `web/e2e/playability-voice.spec.ts` ran at iPad landscape (1180×820, touch)
on the **real voice** (`/api/tts/health`: `kokoro-82m-v1.0-onnx-direct`, Ryzen 9 5950X, 4 threads):

    TTS_STUB=0 WALK_OUT=docs/reviews/voice scripts/playwright.sh --config playwright.playability.config.ts playability-voice --project=ipad-landscape

The shots are `ipad-landscape-vNN-*.jpg` in this directory. `walk-notes-ipad-landscape.md` has the
status line's timeline, sampled every 25 ms from the page. The card comes from routes on
`/api/tts/speak`:
- a 503, which is what the game server answers while the `tts` container is stopped;
- a 500;
- a refused connection.

Task 10's `voice_walk.sh` stopped the real container three times and got the same card and the
same « voix : serveur injoignable ».

The walk cannot hear anything. Headless WebKit also "plays" a line in a few milliseconds, so no
shot shows a line halfway through. What counts here is what is on screen, and when.

Typography and copy check:
- Every new line has its narrow space: « Chut ! », « ravie de mon coup ! », « La voix s'est
  tue ? », « Appelle un parent : », « voix : serveur injoignable ».
- The waiting lines end on a real ellipsis (U+2026).
- Éris agrees in the feminine throughout (« très fière », « ravie »).
- There is no emoji, and nothing in a school register.

Counts: **0 Critical, 4 Important, 9 Minor.**

## Timings measured (the real voice, `walk-notes-ipad-landscape.md`)

| Start | Waiting line shows | First line starts | How long the waiting line is up |
|---|---|---|---|
| Pace I, a short text | 390–490 ms | 610–850 ms | 170–450 ms |
| Pace II | 390–490 ms | 610–1 210 ms | 220–810 ms |
| Pace III | 390–480 ms | 560–840 ms | 170–450 ms |
| Pace IV, 3 short sentences | 390–490 ms | 1 490–2 420 ms | 1.0–1.9 s |
| **Pace IV, « Les Mouches d'eau » (1 557 characters)** | **420 ms** | **20.7–22.5 s** | **about 21 s** |
| The card, 503 after « Suivant » | none | none | the card shows 250–260 ms after the tap |

These are the last three runs. Task 10 measured 23 to 26 s for the long text.

## Findings

### 1. Important: pace IV on a long text leaves her looking at one still line for over 20 seconds (v10, v11, v12)

**What she sees.** She taps « Commencer la dictée ». At 0.4 s the status reads « La Pythie reprend
son souffle… ». Ten seconds later (v11) nothing on screen has changed: the same small bold line,
the same seal, « Pause » lit. The first word comes at about 21 s (v12). The seal carries its
`pulse` class the whole time, because the runner's status is `playing` while the line is fetched.
So the only moving thing on the page says "the voice is speaking" while she hears nothing. « Pause »
is live too. For a 13-year-old, 21 s of silence under a "speaking" seal means "the sound is broken".
She will turn the iPad's volume up, open the lyre, or tap « Quitter ».

**Why it matters.** This is the known issue. The decided fix (per-sentence lines, so the first
sentence plays after about 1 s) removes almost all of it, and it should land before the voice is
called done. Two things remain after that fix, and they are cheap:
- While a line is being fetched, the seal should not pulse the way it does for a line being read.
  Give it the `waiting` look, or a slower "breath" of its own.
- If a wait still runs past about 5 s (a cold container, the NAS's CPU), the line should move on.
  A second variant after 5 s is enough, e.g. « Les vapeurs s'épaississent. Encore un instant… ».
  One frozen sentence for 20 s reads as a hang.

### 2. Important: with the keyboard open, the waiting line is not shown at all (v11b)

**What she sees.** During the long wait she taps the page to be ready to write. The keyboard opens,
and the stage folds into the compact bar (Ruling C4): the back arrow, the seal, « Lecture
complète » and « Pause ». The waiting line is gone. The `.status` row is `sr-only` in compact, and
`bar-status` only spells out « En pause. ». So a player with the keyboard up sees nothing about
the voice for the whole wait. This is the posture the game encourages: she writes as she listens.

**Fix.** In `DictationPhase`'s compact bar, show the waiting line (`voiceWait`) next to the seal the
way « En pause. » is shown, cut to one line with an ellipsis if it must be. The per-sentence fix
makes the wait shorter but does not remove it: each line can still be late mid-dictation, when the
keyboard is certain to be open.

### 3. Important: on paces I–III the waiting line flashes for a fifth of a second at every start (v02, v04, v06)

**What she sees.** The first line on a short text is ready in 0.6 to 0.85 s, and the waiting line
appears at 0.4 s. It is up for 170 to 450 ms: « La voix de la Pythie s'éclaircit… » replaces
« Écoute… » and is gone again before she can read six words. The screenshots catch it only
because the walk polls every animation frame. For her, it is a flicker of bold text next to the
seal, at the start of every dictation. The pace IV short-text case (1 to 1.9 s) is borderline, and
after the per-sentence fix that is the common case.

**Why it hurts.** A line that shows up and vanishes too fast to read looks like a glitch, not the
Pythia. The spec's 400 ms threshold was set before the real timings were known. Kokoro now answers
a short line in about 0.5 to 0.9 s on this CPU.

**Fix.** Either:
- raise the threshold to about 1.2 s; or
- once the line shows, keep it for at least 1.2 s, and start the voice on time underneath (the text
  can trail the sound; the reverse is what hurts).

The first is simpler and loses nothing: under 1.2 s, « Écoute… » is the honest status.

### 4. Important: the card tells her only a parent can fix it, and then offers her a button that fixes it (v14, v15, v16, v22)

**What she reads.**
- Éris gloats (fine, see "What works well").
- In bold: « Appelle un parent : lui seul peut rompre ce sortilège. »
- Then a primary, focused « Réessayer ».

« Lui seul » says the problem is out of her hands. Yet the most common failures are a blip, a
container restarting, or the NAS waking up, and « Réessayer » fixes those on its own (Task 10's
walk, v17). She is left with two contradictory messages. If a parent isn't at hand, the card
reads as "your game is broken until an adult comes". With « Plus un mot ne sortira de Delphes »
above it, that is a little ominous for a failure she can often clear herself. It does not blame
her. Nothing in the card says she did anything wrong, and that part is right.

**Fix.** Order the actions the way she should take them, in-world:
- « Touche « Réessayer ». Si la voix reste muette, appelle un parent : il saura rompre ce
  sortilège. »

« Il saura » keeps the parent as the one who ends it for good, without « lui seul ». The spec's
intent (§5.3: the card sends her to a parent) is kept.

### 5. Minor: every failed « Réessayer » brings back a different gloat (v14 → v15 → v16)

Each retry unmounts the card and mounts a new one. `sayKey('battle.voice.lost')` picks again, so
Éris says something new each time. For about 0.3 s in between, the card is gone and « Écoute… »
shows (walk notes: « La voix s'est tue. » → « Écoute… » → « La voix s'est tue. »). One gloat at the
failure is in-fiction. A fresh gloat in reply to each of her tries starts to read as Éris mocking
the child's attempts, not celebrating her own spell. The card also blinks away and back, which
looks like the button did nothing.

**Fix.** Keep the card mounted during a retry, with « Réessayer » disabled and a small « La Pythie
essaie encore… ». On a second failure, keep Éris's line, or use a separate key whose lines are
about her spell and never about the attempt: « Mon sort tient toujours. », « Ma magie résiste,
on dirait. ».

### 6. Minor: Éris's « La voix s'est tue ? » sits right over the status « La voix s'est tue. » (v15, v22)

One of the three `battle.voice.lost` variants opens with the same words as `DICTATION.status.silenced`,
which shows just under the card. It reads like an echo. Change the variant: « Plus un son ?
C'est mon œuvre, et j'en suis très fière. »

### 7. Minor: on the card, Éris's name runs into her line, and the note's wax seal floats beside her portrait (v14)

It reads « **Éris** Un petit sort sur la voix… », with the name and the line on one line and no
break. Every other speaking plate sets the name in small caps above the text: the muster's Éris
(v01) and the egg in the lyre (v19). The card's `kit-note` also keeps its orange seal at the
top-left, next to the portrait, so the corner holds two unrelated round things. Reuse the plate's
layout (name above, portrait left), and hide the seal (`.voice-lost::before { display: none }`)
since the portrait already marks the speaker.

### 8. Minor: the voice comes back without a word, and the page jumps (v14 → v17)

After a successful « Réessayer », the card vanishes. The controls and the textarea jump up about
200 px under her fingers, and the dictation carries on as if nothing happened. Éris's defeat by a
tap is a free in-fiction beat. A one-line status for about 1.5 s before « Écoute… » would close
the loop, e.g. « La Pythie a retrouvé sa voix. », or Éris: « Hmpf. Mon sort n'a pas tenu. ». The
jump is gentler if the card leaves with the stage's usual fade instead of being removed at once.

### 9. Minor: « La Pythie reprend son souffle… » as the very first line (v02, v10)

« Reprend son souffle » means she has been speaking and is pausing. At the start of a dictation,
nothing has been said yet. That variant fits a late line mid-dictation, not the start. A starting
variant would be « La Pythie s'apprête à parler… ». Also, the cue under the title is « Écris ce que
dit la voix. », the lyre says « La voix de la dictée », and the waiting line and the card say « la
Pythie ». Naming her once, in the cue (« Écris ce que dit la Pythie. »), would tie the three
together. That is optional, a copy-pass call.

### 10. Minor: in the lyre, the trial shows nothing while it plays, and after a failure two buttons do the same thing (v21, v22)

While the trial is being read, the only sign is « Écouter un essai » being disabled. The trial's
words (« Bonjour ! Je lirai tes dictées. Virgule, point. ») never show, so with the sound low she
cannot tell whether it played. After a failure, the short card's « Réessayer » sits just under
« Écouter un essai », and both replay the trial. Show a small line while it plays, like the
dictation's « Écoute… ». Hide « Écouter un essai » while the card is up, or drop « Réessayer » from
the card's short form.

### 11. Minor: a server that hangs (not stopped) keeps the waiting line up for 45 s to 3 min before the card

By reading `voice.ts`: the timeout is 20 s + 50 ms a character, and a timeout is retried once
silently. A pace I sentence (about 37 characters) therefore waits about 44 s under the waiting line
before the card. Pace IV's full reading of the long text (1 557 characters) waits about 196 s.
A stopped container answers 503 at once (card in 0.25 s), so this only bites on a hung service.
When it does, the child sits in front of a frozen sentence for minutes. The per-sentence fix
shortens pace IV's case. After that, consider not retrying a timeout (a second wait of the same
length rarely helps), or showing the card after the first timeout.

### 12. Minor: the progress label wraps when the title takes two lines

In a first run with longer titles (30 characters and more, which some real titles reach),
« Phrase 0 sur 3 » wrapped to « Phrase 0 sur » / « 3 » in the header's right column. The final shots
use short titles, so they don't show it. Give `.progress` `white-space: nowrap` and let the title
wrap instead.

### 13. Minor: the parent's line is the faintest text on the screen (v14)

« voix : serveur injoignable » is 14 px italic `--ink-soft` on Éris's peach note. The component's
comment says it is what a parent reads out when asking for help, often from over the child's
shoulder. Setting it upright, at 15 px, in `--ink` keeps it small and makes it readable at arm's
length.

## What works well

- **The muster is clean now (v01).** With the "cet appareil ne sait pas lire à voix haute" note
  gone, the parchment goes straight from Éris's aside to « Choisis ton rythme ». Nothing warns her
  about her device before she has played.
- **The failure is fast and honest.** With a stopped container the card is up 0.25 s after
  « Suivant » (walk notes). No dead dictation, and no spinner that never ends.
- **Éris's gloat stays in-fiction.** « Un petit sort sur la voix, et la voilà muette. Je suis ravie
  de mon coup ! » and « Chut ! J'ai fait taire la voix de la Pythie. » are about her spell and her
  vanity, never about the player. The failure becomes one more of her mischiefs, which is exactly
  the spec's idea, and it spares the child any "error" wording. She is feminine and in her usual
  register.
- **Nothing is lost.** The draft stays in place under the card, through three failures in a row
  and the retry (v14 to v18). « Retour au camp » leaves as « Quitter » does, with the draft waiting
  behind the ribbon (Task 9's e2e).
- **The pause is right (v13).** « En pause. » and a single « Reprendre ». The waiting line never
  overrides it (Task 9 fix round 1).
- **The card fits the compact layout (v16b).** With the keyboard open it still shows whole, with
  both buttons and one line of her draft.
- **The waiting lines themselves are good copy.** « Les vapeurs de Delphes montent. La voix
  arrive… » is in-world, short, and tells her what is happening. Findings 1 to 3 are about when
  and where they show, not what they say.

## Verdict

As the 13-year-old: when the voice fails she is not scared or blamed. Éris is being Éris, the draft
is safe, and there is a big button. The card only needs to tell her to press it before calling a
parent (4). The waiting is where it goes wrong:
- on a long text at « D'une traite » she stares at one frozen line for 21 s, under a seal that
  looks as if the voice is talking (1);
- if she has the keyboard up, she doesn't even get the line (2);
- on the short paces the same line flickers past too fast to read (3).

As a designer: the failure path is solid and in-fiction. The waiting path needs the decided
per-sentence fix, plus three small UI changes: the compact bar's line, a threshold that fits
Kokoro's real 0.6–0.9 s, and a seal that doesn't pulse while nothing is being read. Fix the four
Important items and the voice will feel like the Pythia taking a breath, not like a page loading.
