<script lang="ts">
  // In-world overlay (scenes UI spec §2.2, §4): an object sliding over the dimmed scene, variants
  // scroll / codex / table. The caller gives it a route (plan Ruling 6), so Back closes it too.
  // Final review I5: while open, the scene stage behind is `inert` (overlayState), Tab stays inside
  // the panel, and closing hands focus back to `returnFocus` (the control that opened it).
  // Final review M7: backdrop and panel leave together, and neither catches a tap while leaving.
  import type { Snippet } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { reducedMotion } from '../../lib/juice/motion';
  import { modal } from '../../lib/scene/overlayState.svelte';
  import Icon from '../ui/Icon.svelte';

  let {
    variant,
    size = 'md',
    title,
    testId,
    onClose,
    returnFocus,
    children,
  }: {
    variant: 'scroll' | 'codex' | 'table';
    size?: 'md' | 'wide';
    title: string;
    testId: string;
    onClose: () => void;
    /** CSS selector of the element that gets focus back on close (e.g. the HUD's hero chip). */
    returnFocus?: string;
    children: Snippet;
  } = $props();

  const reduced = reducedMotion();
  // Task 11 review, fix round 1 #1: the OUT transitions below are local (no `|global`), unlike the
  // IN ones. An ancestor unmounting this overlay outright - leaving its place for a different one
  // (the title handing off to the camp, a work's "Jouer maintenant" leaving for /play...) - now
  // drops it at once instead of lingering for its 160ms close animation with a fixed full-screen
  // scene still covering the next one, `overlayState.open` still above 0 (the next scene stuck
  // `inert`), the modal stack still trapping Tab on the leaving panel, and `returnFocus` firing
  // late onto a same-testId control in the new place. This had already forced three separate
  // scoped-locator workarounds in the e2e suite before being root-caused.
  // Local transitions still fire for this overlay's own removal though: closing it (its seal, Back,
  // Escape) or the place swapping it for a sibling overlay (e.g. Task 11's portail <-> oeuvre) is
  // this same `{#if}` chain's own branch toggling, not an ancestor's. `<svelte:window onkeydown>`
  // stays bound to the DOM for that whole local 160ms fade, and an Escape landing there must not
  // fire `onClose` again: by the time it does, the caller's `onClose` may `replaceRoute` back over
  // a place that has already moved on (preflight.md-style race, found in Task 8 review).
  let closing = $state(false);

  // Focus, the Tab trap, the inert stage and focus return: the shared `modal` action
  // (overlayState.svelte.ts), also used by Onboarding.
  function onKey(e: KeyboardEvent) {
    if (closing) return;
    if (e.key === 'Escape') onClose();
  }

  // Leaving: stop catching taps at once, then fade.
  function leave(node: Element, params: { duration: number }) {
    closing = true;
    (node as HTMLElement).style.pointerEvents = 'none';
    return fade(node, params);
  }
</script>

<svelte:window onkeydown={onKey} />

<button
  type="button"
  class="overlay-backdrop"
  aria-label="Fermer"
  tabindex="-1"
  onclick={onClose}
  in:fade|global={{ duration: 200 }}
  out:leave={{ duration: 160 }}
></button>
<div
  use:modal={{ returnFocus }}
  class="overlay-panel overlay-{variant}"
  class:kit-parchment={variant === 'scroll'}
  class:kit-scroll={variant === 'scroll'}
  class:overlay-wide={size === 'wide'}
  role="dialog"
  aria-modal="true"
  aria-label={title}
  data-testid={testId}
  tabindex="-1"
  in:fly|global={{ y: reduced ? 0 : 40, duration: reduced ? 200 : 280, opacity: 0 }}
  out:leave={{ duration: 160 }}
>
  <header class="overlay-head">
    <h2 class="overlay-title">{title}</h2>
    <!-- Playability #4: a wax-seal close mark rather than a « Fermer » button (a tap outside closes too). -->
    <button type="button" class="overlay-seal" data-testid="overlay-close" aria-label="Fermer" onclick={onClose}>
      <Icon name="close" size={22} />
    </button>
  </header>
  <div class="overlay-body kit-form">{@render children()}</div>
</div>

<style>
  .overlay-backdrop {
    position: fixed;
    inset: 0;
    z-index: var(--z-overlay-backdrop);
    border: 0;
    padding: 0;
    background: var(--scrim);
    cursor: pointer;
  }
  .overlay-panel {
    position: fixed;
    z-index: var(--z-overlay);
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(640px, calc(100vw - 32px));
    max-height: calc(100dvh - 64px);
    overflow: auto;
    padding: 24px 28px;
    outline: none;
  }
  /* UI3: the scan's verify step, the three Oracle scrolls and the dossier need room. */
  .overlay-wide {
    width: min(1040px, calc(100vw - 32px));
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
  .overlay-seal {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    border: 2px solid var(--bronze-dark);
    background: radial-gradient(circle at 35% 30%, var(--bronze-light), var(--bronze) 55%, var(--bronze-dark));
    color: var(--bronze-ink);
    box-shadow:
      inset 0 0 0 3px rgba(255, 240, 200, 0.25),
      0 3px 8px rgba(0, 0, 0, 0.35);
    cursor: pointer;
  }
  .overlay-seal:focus-visible {
    outline: 3px solid var(--gold-light);
    outline-offset: 2px;
  }
  .overlay-title {
    margin: 0;
    font-family: var(--font-display);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
</style>
