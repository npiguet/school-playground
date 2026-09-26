<script lang="ts">
  // The dictation on the battle parchment (UI4 Task 4): « Quitter » and its confirm, the progress,
  // the status as a small seal and words, the bronze controls, and the textarea in Literata on the
  // ruled text zone. While the keyboard is open (Ruling C4, `layout === 'compact'`) everything but
  // the textarea folds into one bar under the stage's band. A flowing pace pauses itself when the
  // iPad turns to portrait (Ruling C11); « Reprendre » shows whenever the runner is paused.
  import { onDestroy, onMount, untrack } from 'svelte';
  import { createRunner, type RunnerState } from '../../lib/dictation/runner';
  import { buildScript, type DictationPlan, type Pace } from '../../lib/dictation/script';
  import { cancelSpeech, speak } from '../../lib/dictation/tts';
  import Icon from '../ui/Icon.svelte';
  import { DICTATION } from '../../lib/battle/lines';
  import { react } from '../../lib/battle/stage.svelte';
  import type { BattleLayout } from '../../lib/battle/layout';

  let {
    plan,
    pace,
    voice,
    text = $bindable(),
    layout,
    onFinish,
    onQuit,
  }: {
    plan: DictationPlan;
    pace: Pace;
    voice: SpeechSynthesisVoice | null;
    text: string;
    /** The stage's layout (UI4 Ruling C4): `compact` folds the controls into one bar. */
    layout: BattleLayout;
    onFinish: () => void;
    onQuit: () => void;
  } = $props();

  let runnerState = $state<RunnerState>({
    index: 0,
    status: 'idle',
    lastSay: null,
    replaysLeft: Infinity,
    done: 0,
    total: 0,
  });

  // The runner is built once from this run's plan/pace (a new Dictation instance is mounted for
  // each run, per the caller), so `plan` and `pace` here are deliberately read only once, not
  // tracked - untrack() says so explicitly instead of looking like an accidental one-shot read.
  const runner = untrack(() =>
    createRunner(buildScript(plan, pace), {
      pace,
      speak: (spoken, rate) => speak(spoken, { rate, voice }),
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      cancel: cancelSpeech,
      onChange: (s) => (runnerState = s),
    }),
  );

  onMount(() => {
    runner.start();
  });

  onDestroy(() => {
    runner.stop();
    // Belt and braces: stop() already cancels via deps.cancel(), but a
    // stray utterance must never keep talking past this component's life.
    cancelSpeech();
  });

  // Ruling C11: turning the iPad to portrait hides the text behind the rotate screen; a flowing
  // dictation (pace 3-4 never waits for a tap) must not keep reading words she cannot write. The
  // runner's own snapshot is read inside `check`, so this effect never re-subscribes on a status.
  // The window's own size decides: at a `resize` WebKit has not updated the media query yet
  // (`mq.matches` still false), and a quick turn back may never deliver its `change` at all.
  $effect(() => {
    if (typeof matchMedia !== 'function') return;
    const flowing = untrack(() => pace >= 3);
    const mq = matchMedia('(orientation: portrait)');
    const check = () => {
      if (flowing && window.innerWidth < window.innerHeight && runner.state().status === 'playing') runner.pause();
    };
    check();
    mq.addEventListener('change', check);
    window.addEventListener('resize', check);
    return () => {
      mq.removeEventListener('change', check);
      window.removeEventListener('resize', check);
    };
  });

  const compact = $derived(layout === 'compact');

  // Header/progress line: which unit is currently being said (defaults to
  // the pace's usual unit before the first step reports in).
  const currentLabel = $derived(
    runnerState.lastSay?.label ?? (pace === 1 ? 'sentence' : pace === 4 ? 'full' : 'chunk'),
  );
  const progress = $derived(
    currentLabel === 'sentence'
      ? DICTATION.sentence(runnerState.done, runnerState.total)
      : currentLabel === 'chunk'
        ? DICTATION.chunk(runnerState.done, runnerState.total)
        : DICTATION.full,
  );
  const statusText = $derived(DICTATION.status[runnerState.status]);

  // pace 1-2: she can finish as soon as she reaches the last manual wait,
  // even before tapping "Suivant" once more.
  const showFinishButton = $derived(
    runnerState.status === 'finished' ||
      ((pace === 1 || pace === 2) &&
        runnerState.status === 'waiting' &&
        runnerState.done === runnerState.total),
  );

  let textareaEl = $state<HTMLTextAreaElement | undefined>(undefined);

  function onInput() {
    if (!textareaEl) return;
    const atEnd = textareaEl.selectionEnd === text.length;
    if (atEnd) textareaEl.scrollTop = textareaEl.scrollHeight;
  }

  function finish() {
    cancelSpeech();
    react('dragon', 'cheer');
    onFinish();
  }

  // P1-4: the dictation has no HUD (deliberate minimalism) and was otherwise a dead end - the only
  // way out was the browser's back gesture. The draft is saved as she types (P1-3), so leaving is
  // safe; the confirm just makes that explicit rather than silent.
  let confirmQuit = $state(false);

  function confirmedQuit() {
    cancelSpeech();
    onQuit();
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

{#snippet controls()}
  <div class="controls" data-testid="dictation-controls">
    {#if pace === 1 || pace === 2}
      <button
        type="button"
        class="kit-bronze is-quiet"
        data-testid="btn-replay"
        onclick={() => runner.replay()}
        disabled={runnerState.status !== 'waiting' || runnerState.replaysLeft <= 0}
      >
        {DICTATION.replay}{#if pace === 2}&nbsp;({runnerState.replaysLeft}){/if}
      </button>
      <button type="button" class="kit-bronze" data-testid="btn-next" onclick={() => runner.next()} disabled={runnerState.status !== 'waiting'}>
        {DICTATION.next}
      </button>
    {/if}
    {#if runnerState.status === 'paused'}
      <button type="button" class="kit-bronze" data-testid="btn-resume" onclick={() => runner.resume()}>{DICTATION.resume}</button>
    {:else if pace >= 3}
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
      <span class="progress">{progress}</span>
      {@render controls()}
    </div>
  {:else}
    <div class="head">
      {@render quitButton()}
      <h2 class="phase-title">{DICTATION.title}</h2>
      <span class="progress">{progress}</span>
    </div>
  {/if}
  {#if compact}<h2 class="sr-only">{DICTATION.title}</h2>{/if}

  {#if confirmQuit}
    <div class="kit-note confirm" role="status">
      <p>{DICTATION.quitAsk}</p>
      <div class="confirm-actions">
        <button type="button" class="kit-bronze" data-testid="btn-quit-confirm" onclick={confirmedQuit}>{DICTATION.quitYes}</button>
        <button type="button" class="kit-bronze is-quiet" onclick={() => (confirmQuit = false)}>{DICTATION.quitNo}</button>
      </div>
    </div>
  {/if}

  <div class="status" class:sr-only={compact}>
    <span class="seal" class:pulse={runnerState.status === 'playing'} data-status={runnerState.status} aria-hidden="true"></span>
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
  .phase-title {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 24px;
    color: var(--ink);
  }
  .progress {
    margin-left: auto;
    font-size: 16px;
    color: var(--ink-soft);
    text-align: right;
  }
  .bar .progress {
    margin-left: 0;
    white-space: nowrap;
  }
  .icon-only {
    padding: 0;
    width: 48px;
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
  .seal[data-status='paused'] {
    opacity: 0.6;
  }
  .seal.pulse {
    animation: seal-pulse 1.2s ease-in-out infinite;
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
    .seal.pulse {
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
    font: 400 clamp(22px, 1.9vw, 26px) / 1.8 var(--font-reading);
    color: var(--ink);
    background-color: var(--battle-text-bg);
    background-image: repeating-linear-gradient(transparent 0 calc(1.8em - 1px), rgba(138, 90, 40, 0.14) calc(1.8em - 1px) 1.8em);
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
