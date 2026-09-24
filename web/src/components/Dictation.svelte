<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { createRunner, type RunnerState } from '../lib/dictation/runner';
  import { buildScript, type DictationPlan, type Pace } from '../lib/dictation/script';
  import { cancelSpeech, speak } from '../lib/dictation/tts';

  let {
    plan,
    pace,
    voice,
    text = $bindable(),
    onFinish,
  }: {
    plan: DictationPlan;
    pace: Pace;
    voice: SpeechSynthesisVoice | null;
    text: string;
    onFinish: () => void;
  } = $props();

  let runnerState = $state<RunnerState>({
    index: 0,
    status: 'idle',
    lastSay: null,
    replaysLeft: Infinity,
    done: 0,
    total: 0,
  });

  const runner = createRunner(buildScript(plan, pace), {
    pace,
    speak: (spoken, rate) => speak(spoken, { rate, voice }),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    cancel: cancelSpeech,
    onChange: (s) => (runnerState = s),
  });

  onMount(() => {
    runner.start();
  });

  onDestroy(() => {
    runner.stop();
    // Belt and braces: stop() already cancels via deps.cancel(), but a
    // stray utterance must never keep talking past this component's life.
    cancelSpeech();
  });

  // Header/progress line: which unit is currently being said (defaults to
  // the pace's usual unit before the first step reports in).
  const currentLabel = $derived(
    runnerState.lastSay?.label ?? (pace === 1 ? 'sentence' : pace === 4 ? 'full' : 'chunk'),
  );

  const statusText = $derived(
    {
      idle: 'Écoute…',
      playing: 'Écoute…',
      waiting: 'À toi d’écrire.',
      paused: 'En pause.',
      finished: 'C’est fini ! Relis ton texte quand tu es prête.',
    }[runnerState.status],
  );

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
    onFinish();
  }

  // Keeps the current line above the iPad on-screen keyboard: the keyboard
  // shrinks the visual viewport (not the layout viewport), so we size the
  // column from `--vvh` rather than 100dvh/100vh.
  $effect(() => {
    const vv = window.visualViewport;
    const update = () => {
      document.documentElement.style.setProperty('--vvh', `${vv?.height ?? window.innerHeight}px`);
    };
    update();
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      document.documentElement.style.removeProperty('--vvh');
    };
  });
</script>

<div class="dictation" style="height: var(--vvh)">
  <div class="header">
    <h2>Dictée</h2>
    <span class="progress">
      {#if currentLabel === 'sentence'}
        Phrase {runnerState.done} sur {runnerState.total}
      {:else if currentLabel === 'chunk'}
        Groupe {runnerState.done} sur {runnerState.total}
      {:else}
        Lecture complète
      {/if}
    </span>
  </div>

  <div class="status-line">
    <span class="dot" class:pulse={runnerState.status === 'playing'} data-status={runnerState.status} aria-hidden="true"></span>
    <span>{statusText}</span>
  </div>

  <div class="controls">
    {#if pace === 1 || pace === 2}
      <button
        type="button"
        class="btn"
        onclick={() => runner.replay()}
        disabled={runnerState.status !== 'waiting' || runnerState.replaysLeft <= 0}
      >
        Réécouter{#if pace === 2}
          ({runnerState.replaysLeft}){/if}
      </button>
      <button
        type="button"
        class="btn"
        data-testid="btn-next"
        onclick={() => runner.next()}
        disabled={runnerState.status !== 'waiting'}
      >
        Suivant
      </button>
    {:else if runnerState.status === 'paused'}
      <button type="button" class="btn" onclick={() => runner.resume()}>Reprendre</button>
    {:else}
      <button type="button" class="btn" onclick={() => runner.pause()} disabled={runnerState.status !== 'playing'}>
        Pause
      </button>
    {/if}
    {#if showFinishButton}
      <button type="button" class="btn btn-primary" data-testid="btn-finish-writing" onclick={finish}>J’ai fini d’écrire</button>
    {/if}
  </div>

  <textarea
    bind:this={textareaEl}
    class="draft"
    data-testid="dictation-textarea"
    lang="fr"
    {...{ autocorrect: 'off' }}
    autocapitalize="off"
    autocomplete="off"
    spellcheck="false"
    placeholder="Écris ici ce que tu entends…"
    bind:value={text}
    oninput={onInput}
  ></textarea>
</div>

<style>
  .dictation {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 16px;
    padding-top: calc(12px + env(safe-area-inset-top));
    padding-left: calc(16px + env(safe-area-inset-left));
    padding-right: calc(16px + env(safe-area-inset-right));
  }
  .header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }
  .header h2 {
    margin: 0;
    font-size: 18px;
  }
  .progress {
    color: var(--ink-soft);
    font-size: 14px;
  }
  .status-line {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    color: var(--ink-soft);
  }
  .dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--aegean);
    flex-shrink: 0;
  }
  .dot[data-status='playing'] {
    background: var(--terracotta);
  }
  .dot[data-status='waiting'] {
    background: var(--aegean);
  }
  .dot[data-status='paused'] {
    background: var(--ink-soft);
  }
  .dot[data-status='finished'] {
    background: var(--olive);
  }
  .dot.pulse {
    animation: pulse 1.2s ease-in-out infinite;
  }
  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.45;
      transform: scale(1.3);
    }
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .draft {
    flex: 1;
    min-height: 0;
    width: 100%;
    resize: none;
    font-size: 22px;
    line-height: 1.6;
    font-family: var(--font-body);
    padding: 16px;
  }
</style>
