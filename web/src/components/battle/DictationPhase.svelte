<script lang="ts">
  // The dictation on the battle parchment (UI4 Task 4): « Quitter » and its confirm, the progress,
  // the status as a small seal and words, the bronze controls, and the textarea in Literata on the
  // ruled text zone. While the keyboard is open (Ruling C4, `layout === 'compact'`) everything but
  // the textarea folds into one bar under the stage's band. The dictation pauses itself when the
  // iPad turns to portrait (Ruling C11) or the page is hidden (final review I1); « Reprendre » shows
  // whenever the runner is paused.
  // The voice is Kokoro on the server (spec 2026-09-27): a late line shows the waiting line, a silenced
  // one Éris's card.
  import { onDestroy, onMount, untrack } from 'svelte';
  import { createRunner, unitBeingRead, type RunnerState } from '../../lib/dictation/runner';
  import { buildScript, replayLimit, sayLines, type DictationPlan, type Pace } from '../../lib/dictation/script';
  import { createVoice, type VoiceFailure } from '../../lib/dictation/voice';
  import { createWaitLine } from '../../lib/dictation/waitLine';
  import { reducedMotion } from '../../lib/juice/motion';
  import { fade, slide } from 'svelte/transition';
  import { voiceMuted } from '../../lib/audio/voice';
  import { sayKey } from '../../lib/dialogue/select';
  import VoiceLostCard from './VoiceLostCard.svelte';
  import Icon from '../ui/Icon.svelte';
  import { DICTATION } from '../../lib/battle/lines';
  import { react } from '../../lib/battle/stage.svelte';
  import { focusOnMount } from '../../lib/battle/focus';
  import type { BattleLayout } from '../../lib/battle/layout';

  /** How long the Pythia's « the voice is back » line holds the status (playability #8). */
  const VOICE_BACK_MS = 1_500;
  /** The script's pauses at their length in the game. An e2e page sets a fraction (e2e/helpers.ts
   *  installFastPauses), as its recorded lines last 20 ms, so walking a dictation through its groups
   *  keeps the suite's pace; the game never sets it. */
  const pauseScale = (): number =>
    (globalThis as { __discordePauseScale?: number }).__discordePauseScale ?? 1;

  let {
    plan,
    pace,
    profileId,
    text = $bindable(),
    title,
    from = 0,
    replaysLeft: fromReplaysLeft,
    layout,
    onFinish,
    onQuit,
    onRestart,
    onLeaveToCamp,
    onProgress,
  }: {
    plan: DictationPlan;
    pace: Pace;
    /** The hero the voice speaks for (/api/tts/* needs her, Ruling K4). */
    profileId: number;
    text: string;
    /** The text's title, the phase's heading (UI4 playability #11). */
    title: string;
    /** Ruling M20: the saved step a resumed dictation starts from (its unit's first step). */
    from?: number;
    /** Closing item 1: the saved « Réécouter » count a resumed dictation starts from - undefined
     *  (a fresh dictation) still gets the pace's full allowance. */
    replaysLeft?: number;
    /** The stage's layout (UI4 Ruling C4): `compact` folds the controls into one bar. */
    layout: BattleLayout;
    onFinish: () => void;
    /** « Oui, quitter »: Play saves the dictation and leaves the battle. */
    onQuit: () => void;
    /** « Tout recommencer » on the quit confirm: this attempt is dropped, back to the muster. */
    onRestart: () => void;
    /** Éris's card's way back to the camp (spec 2026-09-27 §5.3). */
    onLeaveToCamp: () => void;
    /** Ruling M20 / closing item 1: the step and the replay count to save, each time either moves. */
    onProgress?: (step: number, replaysLeft: number) => void;
  } = $props();

  let runnerState = $state<RunnerState>({
    index: 0,
    status: 'idle',
    lastSay: null,
    replaysLeft: Infinity,
    done: 0,
    total: 0,
    resumeAt: 0,
    failure: null,
  });

  // The runner is built once from this run's plan/pace (a new Dictation instance is mounted for
  // each run, per the caller), so `plan` and `pace` here are deliberately read only once, not
  // tracked - untrack() says so explicitly instead of looking like an accidental one-shot read.
  let reported = untrack(() => from);
  let reportedReplays = untrack(() => fromReplaysLeft ?? replayLimit(pace));
  // The server's voice (spec 2026-09-27 §5): one per dictation, its clips freed when it ends.
  const voice = untrack(() => createVoice({ profileId }));
  // §5.2 and fix wave B ruling 1: the Pythia's waiting line while a line is more than 1.2 s late,
  // another past 5 s, each up at least 800 ms (null: the runner's own status).
  let voiceWait = $state<string | null>(null);
  const waitLine = createWaitLine(
    (text) => (voiceWait = text),
    (key) => sayKey(key).text,
  );
  // Playability #5 and #8: « Réessayer » keeps Éris's card up (its button waiting) until the voice
  // answers or fails again; when it answers, the Pythia says so for a moment, in the status line.
  // A pause meanwhile keeps the card too (re-review N4): the same card and gloat until the voice is back.
  let retrying = $state(false);
  let lostFailure = $state<VoiceFailure>('server');
  let voiceBack = $state<string | null>(null);
  let backTimer: ReturnType<typeof setTimeout> | undefined;
  function hideVoiceBack() {
    clearTimeout(backTimer);
    voiceBack = null;
  }
  /** The retried line is under way: heard (the Pythia says the voice is back), or said silently by a
   *  muted voice, which never starts a clip (re-review N1). Either way the card goes. */
  function voiceReturns(heard: boolean) {
    if (!retrying) return;
    retrying = false;
    if (!heard) return;
    voiceBack = sayKey('battle.voice.back').text;
    clearTimeout(backTimer);
    backTimer = setTimeout(hideVoiceBack, VOICE_BACK_MS);
  }
  function lineStarts() {
    waitLine.done();
    voiceReturns(true);
  }
  const steps = untrack(() => buildScript(plan, pace));
  let lastStatus = untrack(() => runnerState.status);
  const runner = untrack(() =>
    createRunner(
      steps,
      {
        pace,
        speak: (spoken, rate, next) => {
          // A muted voice fetches nothing and waits the line's length (voice.ts): it is said at once.
          if (voiceMuted()) voiceReturns(false);
          return voice
            .speak(spoken, rate, { next, onSlow: () => waitLine.slow(), onStart: lineStarts })
            .finally(() => waitLine.done());
        },
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms * pauseScale())),
        cancel: () => voice.cancel(),
        onChange: (s) => {
          runnerState = s;
          if (s.status === 'silenced' && s.failure) lostFailure = s.failure;
          // A pause, the silence, her turn to write or the end: the line is said or no longer coming.
          if (s.status !== lastStatus && s.status !== 'playing') {
            waitLine.clear();
            hideVoiceBack();
          }
          // Failed again (the card stays, `silenced`) or over; a pause keeps the retry (N4).
          if (s.status === 'silenced' || s.status === 'finished') retrying = false;
          lastStatus = s.status;
          let moved = false;
          if (s.resumeAt !== reported) {
            reported = s.resumeAt;
            moved = true;
          }
          if (s.replaysLeft !== reportedReplays) {
            reportedReplays = s.replaysLeft;
            moved = true;
          }
          if (moved) onProgress?.(reported, reportedReplays);
        },
      },
      from,
      fromReplaysLeft,
    ),
  );
  runnerState = untrack(() => runner.state());

  /** §5.2 and Ruling K12: the lines from the unit being read on, sent ahead in order. */
  const prepareAhead = () => voice.prepare(sayLines(steps.slice(runner.state().resumeAt)));

  onMount(() => {
    prepareAhead();
    runner.start();
  });

  // Final review M4: a voice unmuted mid-dictation never prepared anything (a muted one sends
  // nothing), so the rest of the script is sent then; « Réessayer » sends it too (retry below), for
  // a restarted voice has lost its queue.
  let wasMuted = untrack(() => voiceMuted());
  $effect(() => {
    const muted = voiceMuted();
    if (wasMuted && !muted) untrack(prepareAhead);
    wasMuted = muted;
  });

  function retry() {
    // Not from a card already leaving (N4), nor twice while it asks.
    if (!cardUp || (retrying && runnerState.status !== 'paused')) return;
    // Paused during a retry (N4): « Réessayer » asks again, as « Reprendre » does.
    if (runnerState.status === 'paused') {
      runner.resume();
      return;
    }
    retrying = true;
    prepareAhead();
    runner.retry();
  }

  onDestroy(() => {
    runner.stop();
    voice.dispose();
    waitLine.clear();
    clearTimeout(backTimer);
  });

  // Ruling C11: turning the iPad to portrait hides the text behind the rotate screen; the dictation
  // must not keep reading words she cannot write. Since the pace redesign every pace reads a group
  // twice, pauses included, without a tap, so every pace pauses itself. The runner's own snapshot is
  // read inside `check`, so this effect never re-subscribes on a status.
  // The window's own size decides: at a `resize` WebKit has not updated the media query yet
  // (`mq.matches` still false), and a quick turn back may never deliver its `change` at all.
  $effect(() => {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia('(orientation: portrait)');
    const check = () => {
      if (window.innerWidth < window.innerHeight && runner.state().status === 'playing') runner.pause();
    };
    check();
    mq.addEventListener('change', check);
    window.addEventListener('resize', check);
    return () => {
      mq.removeEventListener('change', check);
      window.removeEventListener('resize', check);
    };
  });

  // Final review I1: a hidden page (another app, the iPad locked) suspends the mixer, so a line
  // playing freezes and its watchdog gives it up; the dictation would read on into the silence (every
  // pace reads a group twice without a tap, and II and III have no « Réécouter »). It pauses as in
  // portrait (C11): « Reprendre » is her tap, and says the cut line again.
  $effect(() => {
    const onVisibility = () => {
      if (document.hidden && runner.state().status === 'playing') runner.pause();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  });

  const compact = $derived(layout === 'compact');

  // Header/progress line: the group being read, from its first reading on (paces review, Important 1),
  // or the final reading.
  const reading = $derived(unitBeingRead(steps, runnerState));
  const progress = $derived(
    reading?.unit === 'full' ? DICTATION.full : DICTATION.chunk((reading?.index ?? 0) + 1, runnerState.total),
  );
  // Éris's card is up while the voice is silenced, and while « Réessayer » asks again (playability #5).
  const cardUp = $derived(runnerState.status === 'silenced' || retrying);
  // The Pythia's own lines (waiting, then back) only while the dictation goes on (Task 9 review #1): a
  // pause or a silence cancels the line, but its fetch may still run for seconds, and the status must
  // say « En pause. » meanwhile.
  const going = $derived(runnerState.status === 'playing' || runnerState.status === 'waiting');
  const pythiaNote = $derived(cardUp || !going ? null : (voiceBack ?? voiceWait));
  const paused = $derived(runnerState.status === 'paused');
  const statusText = $derived(
    paused ? DICTATION.status.paused : cardUp ? DICTATION.status.silenced : (pythiaNote ?? DICTATION.status[runnerState.status]),
  );
  // Ruling 1: while a line is late the seal waits (a slow breath), it does not pulse as if reading.
  const sealStatus = $derived(
    paused ? 'paused' : cardUp ? 'silenced' : pythiaNote !== null && pythiaNote === voiceWait ? 'voice-waiting' : runnerState.status,
  );
  // Playability #8: the card leaves by folding away, so the textarea does not jump 200 px at once;
  // a card leaving no longer takes taps (re-review N4; Svelte also marks an outroing element inert,
  // and retry() ignores a card that is no longer up).
  const reduced = reducedMotion();
  function cardOut(node: Element) {
    (node as HTMLElement).inert = true;
    return reduced ? fade(node, { duration: 160 }) : slide(node, { duration: 320 });
  }

  // Pace I: she can finish as soon as she reaches the last manual wait,
  // even before tapping "Suivant" for the final reading.
  const showFinishButton = $derived(
    runnerState.status === 'finished' ||
      (pace === 1 && runnerState.status === 'waiting' && runnerState.done === runnerState.total),
  );

  let textareaEl = $state<HTMLTextAreaElement | undefined>(undefined);

  function onInput() {
    if (!textareaEl) return;
    const atEnd = textareaEl.selectionEnd === text.length;
    if (atEnd) textareaEl.scrollTop = textareaEl.scrollHeight;
  }

  function finish() {
    voice.cancel();
    react('dragon', 'cheer');
    onFinish();
  }

  // P1-4: the dictation has no HUD (deliberate minimalism) and was otherwise a dead end - the only
  // way out was the browser's back gesture. The draft is saved as she types (P1-3), so leaving is
  // safe; the confirm just makes that explicit rather than silent. The user's report 2026-10-02:
  // « Oui, quitter » leaves the battle, and the confirm also offers « Tout recommencer » (the resume
  // ribbon's, here too).
  let confirmQuit = $state(false);

  function confirmedQuit() {
    voice.cancel();
    onQuit();
  }

  function restartFromQuit() {
    voice.cancel();
    onRestart();
  }
</script>

{#snippet quitButton()}
  {#if compact}
    <button type="button" class="kit-bronze is-quiet icon-only" data-testid="btn-quit-dictation" aria-label={DICTATION.quit} onclick={() => (confirmQuit = true)}>
      <Icon name="arrow-left" size={22} />
    </button>
  {:else}
    <button type="button" class="kit-bronze is-quiet" data-testid="btn-quit-dictation" onclick={() => (confirmQuit = true)}>
      <Icon name="arrow-left" size={18} />{DICTATION.quit}
    </button>
  {/if}
{/snippet}

<!-- The status seal, in the full status line and in the compact bar alike (final review M15). -->
{#snippet seal()}
  <span class="seal" class:pulse={sealStatus === 'playing'} data-status={sealStatus} data-testid="dictation-seal" aria-hidden="true"></span>
{/snippet}

{#snippet controls()}
  <div class="controls" data-testid="dictation-controls">
    <!-- The pace redesign: pace I waits for « Suivant », with one « Réécouter » per group; II moves on
         and has « Pause »; III has neither. « Reprendre » shows at every pace after a pause, her own or
         the automatic one (portrait, a hidden page). -->
    {#if pace === 1}
      <button
        type="button"
        class="kit-bronze is-quiet"
        data-testid="btn-replay"
        onclick={() => runner.replay()}
        disabled={runnerState.status !== 'waiting' || runnerState.replaysLeft <= 0}
      >
        {DICTATION.replay}
      </button>
      <button type="button" class="kit-bronze" data-testid="btn-next" onclick={() => runner.next()} disabled={runnerState.status !== 'waiting'}>
        {DICTATION.next}
      </button>
    {/if}
    {#if runnerState.status === 'paused'}
      <button type="button" class="kit-bronze" data-testid="btn-resume" onclick={() => runner.resume()}>{DICTATION.resume}</button>
    {:else if pace === 2}
      <button type="button" class="kit-bronze is-quiet" data-testid="btn-pause" onclick={() => runner.pause()} disabled={runnerState.status !== 'playing'}>
        {DICTATION.pause}
      </button>
    {/if}
    {#if showFinishButton}
      <button type="button" class="kit-bronze finish" data-testid="btn-finish-writing" onclick={finish}>{DICTATION.finish}</button>
    {/if}
  </div>
{/snippet}

<div class="dictation" class:compact>
  {#if compact}
    <div class="bar">
      {@render quitButton()}
      <!-- The seal stays in sight, and a pause or the Pythia's line says so (playability #2: she writes
           with the keyboard up, so a late line is said here too; the live status below is read out). -->
      <span class="bar-status" data-testid="bar-status" aria-hidden="true">
        {@render seal()}
        {#if runnerState.status === 'paused'}{DICTATION.status.paused}{:else if pythiaNote}<span class="bar-note">{pythiaNote}</span>{/if}
      </span>
      <span class="progress" data-testid="dictation-progress">{progress}</span>
      {@render controls()}
    </div>
  {:else}
    <div class="head">
      {@render quitButton()}
      <!-- UI4 playability #11: the battle is the text's, the phase says what to do in the fiction. -->
      <div class="titles">
        <h2 class="phase-title">{title}</h2>
        <p class="cue">{DICTATION.cue}</p>
      </div>
      <span class="progress" data-testid="dictation-progress">{progress}</span>
    </div>
  {/if}
  {#if compact}<h2 class="sr-only">{title}</h2>{/if}

  {#if confirmQuit}
    <div class="kit-note confirm" role="status">
      <p>{DICTATION.quitAsk}</p>
      <div class="confirm-actions">
        <button type="button" class="kit-bronze" data-testid="btn-quit-confirm" onclick={confirmedQuit} use:focusOnMount>{DICTATION.quitYes}</button>
        <button type="button" class="kit-bronze is-quiet" data-testid="btn-quit-cancel" onclick={() => (confirmQuit = false)}>{DICTATION.quitNo}</button>
        <button type="button" class="kit-bronze is-quiet" data-testid="btn-quit-restart" onclick={restartFromQuit}>{DICTATION.quitRestart}</button>
      </div>
    </div>
  {/if}

  {#if cardUp}
    <div class="card-slot" data-testid="voice-lost-slot" out:cardOut>
      <VoiceLostCard failure={lostFailure} retrying={retrying && !paused} {compact} onRetry={retry} onLeave={onLeaveToCamp} />
    </div>
  {/if}

  <div class="status" class:sr-only={compact}>
    {@render seal()}
    <span data-testid="dictation-status" aria-live="polite">{statusText}</span>
  </div>

  {#if !compact}{@render controls()}{/if}

  <textarea
    bind:this={textareaEl}
    class="draft"
    data-testid="dictation-textarea"
    lang="fr"
    {...{ autocorrect: 'off' }}
    autocapitalize="off"
    autocomplete="off"
    spellcheck="false"
    placeholder={DICTATION.placeholder}
    bind:value={text}
    oninput={onInput}
  ></textarea>
</div>

<style>
  .dictation {
    display: flex;
    flex-direction: column;
    gap: 10px;
    height: 100%;
    padding: 14px 18px;
    color: var(--ink);
    font-family: var(--font-body);
  }
  .dictation.compact {
    gap: 8px;
    padding: 8px 12px 10px;
  }
  .head,
  .bar {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .bar {
    gap: 10px;
  }
  .titles {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .phase-title {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 24px;
    line-height: 1.15;
    color: var(--ink);
  }
  .cue {
    margin: 0;
    font-size: 16px;
    font-style: italic;
    color: var(--ink-soft);
  }
  /* Playability #12: « Phrase 2 sur 3 » never wraps; a long title wraps instead. */
  .progress {
    flex: none;
    margin-left: auto;
    font-size: 16px;
    color: var(--ink-soft);
    text-align: right;
    white-space: nowrap;
  }
  .bar .progress {
    margin-left: 0;
  }
  .bar-status {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    font-size: 17px;
    font-weight: 600;
    color: var(--ink);
    white-space: nowrap;
  }
  /* The Pythia's line in the bar: one line, cut with an ellipsis if the bar is short. */
  .bar-note {
    min-width: 0;
    max-width: 24em;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .card-slot {
    flex: none;
  }
  .confirm {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .confirm p {
    margin: 0;
    font-weight: 600;
  }
  .confirm-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .status {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 17px;
    font-weight: 600;
    color: var(--ink-soft);
  }
  /* The old status dot, as a small bronze seal; gold while the voice speaks. */
  .seal {
    flex: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 2px solid var(--bronze-dark);
    background: radial-gradient(circle at 38% 32%, var(--bronze-light), var(--bronze) 70%);
  }
  .seal[data-status='playing'] {
    background: radial-gradient(circle at 38% 32%, var(--gold-light), var(--gold) 70%);
  }
  .seal[data-status='finished'] {
    background: radial-gradient(circle at 38% 32%, var(--laurel-light), var(--laurel) 70%);
  }
  .seal[data-status='paused'],
  .seal[data-status='silenced'] {
    opacity: 0.6;
  }
  .seal.pulse {
    animation: seal-pulse 1.2s ease-in-out infinite;
  }
  /* A late line (ruling 1): bronze, breathing slowly, never the reading's gold pulse. */
  .seal[data-status='voice-waiting'] {
    animation: seal-breath 2.8s ease-in-out infinite;
  }
  @keyframes seal-breath {
    0%,
    100% {
      opacity: 0.95;
    }
    50% {
      opacity: 0.6;
    }
  }
  @keyframes seal-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.45;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .seal.pulse,
    .seal[data-status='voice-waiting'] {
      animation: none;
    }
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }
  .bar .controls {
    flex: 1;
    flex-wrap: nowrap;
    min-width: 0;
  }
  /* « J'ai fini d'écrire »: the gold call to action at the row's end. */
  .finish {
    margin-left: auto;
    border-color: #8a6a12;
    background: linear-gradient(180deg, var(--gold-light) 0%, var(--gold) 55%, #9a7a1a 100%);
    color: var(--ink);
    text-shadow: none;
  }
  .draft {
    flex: 1;
    min-height: 0;
    width: 100%;
    margin: 0;
    resize: none;
    /* 1.9, the proofreading's line (Ruling C12): the global floor is 1.8. */
    font: 400 clamp(22px, 1.9vw, 26px) / 1.9 var(--font-reading);
    color: var(--ink);
    background-color: var(--battle-text-bg);
    /* Sepia rulings, the parchment's own ink (UI4 playability #11: not an exercise book's grey). */
    background-image: repeating-linear-gradient(transparent 0 calc(1.9em - 1px), rgba(92, 64, 24, 0.14) calc(1.9em - 1px) 1.9em);
    background-attachment: local;
    background-position: 0 14px;
    border: 1px solid var(--parchment-edge);
    border-radius: 10px;
    padding: 14px 18px;
    box-shadow: inset 0 1px 3px rgba(92, 64, 24, 0.2);
  }
  .draft::placeholder {
    color: var(--ink-soft);
  }
  .draft:focus-visible {
    outline: 3px solid var(--gold-light);
    outline-offset: 1px;
  }
</style>
