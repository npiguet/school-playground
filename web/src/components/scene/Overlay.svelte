<script lang="ts">
  // In-world overlay (scenes UI spec §2.2, §4): an object sliding over the dimmed scene, variants
  // scroll / codex / table. The caller gives it a route (plan Ruling 6), so Back closes it too.
  import type { Snippet } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { reducedMotion } from '../../lib/juice/motion';

  let {
    variant,
    title,
    testId,
    onClose,
    children,
  }: { variant: 'scroll' | 'codex' | 'table'; title: string; testId: string; onClose: () => void; children: Snippet } =
    $props();

  const reduced = reducedMotion();
  let panel: HTMLElement | undefined = $state();

  $effect(() => {
    panel?.focus();
  });

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
</script>

<svelte:window onkeydown={onKey} />

<button
  type="button"
  class="overlay-backdrop"
  aria-label="Fermer"
  tabindex="-1"
  onclick={onClose}
  transition:fade|global={{ duration: 200 }}
></button>
<div
  bind:this={panel}
  class="overlay-panel overlay-{variant}"
  class:kit-parchment={variant === 'scroll'}
  class:kit-scroll={variant === 'scroll'}
  role="dialog"
  aria-modal="true"
  aria-label={title}
  data-testid={testId}
  tabindex="-1"
  in:fly|global={{ y: reduced ? 0 : 40, duration: reduced ? 200 : 280, opacity: 0 }}
>
  <header class="overlay-head">
    <h2 class="overlay-title">{title}</h2>
    <button type="button" class="kit-bronze" data-testid="overlay-close" onclick={onClose}>Fermer</button>
  </header>
  <div class="overlay-body">{@render children()}</div>
</div>

<style>
  .overlay-backdrop {
    position: fixed;
    inset: 0;
    z-index: 39;
    border: 0;
    padding: 0;
    background: var(--scrim);
    cursor: pointer;
  }
  .overlay-panel {
    position: fixed;
    z-index: 40;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(640px, calc(100vw - 32px));
    max-height: calc(100dvh - 64px);
    overflow: auto;
    padding: 24px 28px;
    outline: none;
  }
  .overlay-codex {
    background:
      linear-gradient(90deg, rgba(0, 0, 0, 0.08), transparent 6%, transparent 94%, rgba(0, 0, 0, 0.08)),
      var(--parchment-solid);
    border: 10px solid #5a3b22;
    border-radius: 10px 16px 16px 10px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
  }
  .overlay-table {
    background:
      radial-gradient(ellipse at center, var(--parchment-solid) 0 62%, transparent 63%),
      repeating-linear-gradient(90deg, #6b4a2b 0 14px, #5e4026 14px 28px);
    border-radius: 14px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
  }
  .overlay-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
  }
  .overlay-title {
    margin: 0;
    font-family: var(--font-display);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
</style>
