<script lang="ts">
  // In-world overlay (scenes UI spec §2.2, §4): an object sliding over the dimmed scene. The
  // variants are real objects (immersion wave Ruling W1): `scroll` a parchment sheet with torn sides
  // between two wooden rods, `table` a dark wood board the panel's objects lie on, `codex` an open
  // book (always wide, fixed height, one `.codex-spread` of two `.codex-page`). A place character
  // can speak from the top of the panel (`voice`, Ruling W2). The panel is centred below the HUD
  // band (Ruling W11). The caller gives it a route (plan Ruling 6), so Back closes it too.
  // Final review I5: while open, the scene stage behind is `inert` (overlayState), Tab stays inside
  // the panel, and closing hands focus back to `returnFocus` (the control that opened it).
  // Final review M7: backdrop and panel leave together, and neither catches a tap while leaving.
  import type { Snippet } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { reducedMotion } from '../../lib/juice/motion';
  import { modal } from '../../lib/scene/overlayState.svelte';
  import Icon from '../ui/Icon.svelte';
  import OverlayVoice from './OverlayVoice.svelte';
  import type { DialogueLine } from '../../lib/scene/types';

  let {
    variant,
    size = 'md',
    title,
    testId,
    onClose,
    returnFocus,
    voice = null,
    children,
  }: {
    variant: 'scroll' | 'codex' | 'table';
    size?: 'md' | 'wide';
    title: string;
    testId: string;
    onClose: () => void;
    /** CSS selector of the element that gets focus back on close (e.g. the HUD's hero chip). */
    returnFocus?: string;
    /** A character's line shown at the top of the panel (OverlayVoice, Ruling W2). */
    voice?: DialogueLine | null;
    children: Snippet;
  } = $props();

  const reduced = reducedMotion();
  // Task 11 review, fix round 1 #1: the OUT transitions below are local (no `|global`), unlike the
  // IN ones. An ancestor unmounting this overlay outright - leaving its place for a different one
  // (the title handing off to the camp, a work's « Le défendre maintenant » leaving for /play...) - now
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
  class:overlay-wide={size === 'wide' || variant === 'codex'}
  role="dialog"
  aria-modal="true"
  aria-label={title}
  data-testid={testId}
  data-variant={variant}
  tabindex="-1"
  in:fly|global={{ y: reduced ? 0 : 40, duration: reduced ? 200 : 280, opacity: 0 }}
  out:leave={{ duration: 160 }}
>
  <!-- The object itself (Ruling W1): a parchment sheet with torn sides, a dark wood board, or an
       open book. Drawn behind the content, never a control. -->
  <div class="overlay-surface" aria-hidden="true"><div class="surface-sheet"></div></div>
  {#if variant === 'scroll'}
    <span class="scroll-rod rod-top" aria-hidden="true"></span>
    <span class="scroll-rod rod-bottom" aria-hidden="true"></span>
  {/if}
  <header class="overlay-head">
    <h2 class="overlay-title">{title}</h2>
    <!-- Playability #4: a wax-seal close mark rather than a « Fermer » button (a tap outside closes too). -->
    <button type="button" class="overlay-seal" data-testid="overlay-close" aria-label="Fermer" onclick={onClose}>
      <Icon name="close" size={22} />
    </button>
  </header>
  {#if voice}<OverlayVoice line={voice} />{/if}
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
    /* Centred in the part of the screen below the HUD band (playability #21, Ruling W11). */
    top: calc(var(--hud-band) + (100dvh - var(--hud-band)) / 2);
    transform: translate(-50%, -50%);
    /* 40 px each side: the scroll's rods (18 px) and their knobs (14 px more) stay on screen
       down to the narrowest landscape iPad (review fix round 1 #2). */
    width: min(640px, calc(100vw - 80px));
    max-height: calc(100dvh - var(--hud-band) - 36px);
    display: flex;
    flex-direction: column;
    padding: 26px 30px 22px;
    outline: none;
    isolation: isolate;
    color: var(--ink);
  }
  /* UI3: the scan's verify step, the three Oracle scrolls and the dossier need room. */
  .overlay-wide {
    width: min(1040px, calc(100vw - 80px));
  }
  /* The body scrolls between the rods; the rods and the seal stay put.
     Review fix round 1 #1: the scroll box clips, so it keeps 14 px of room on every side for focus
     rings (3 px + a 2 px offset) and the table cards' shadows, taken back from the layout by the
     negative margin (the right side keeps its 4 px gap before the scrollbar). `scroll-padding`
     makes focusing a control scroll it that far inside the edge, ring included.
     #5: the top and bottom 10 px fade out, so scrolled content slides softly under the voice plate
     and the bottom rod instead of being cut hard (the fade stays inside that room at rest). */
  .overlay-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
    overscroll-behavior: contain;
    padding: 14px 18px 14px 14px;
    margin: -14px;
    scroll-padding: 14px;
    -webkit-mask-image: linear-gradient(180deg, transparent, #000 10px, #000 calc(100% - 10px), transparent);
    mask-image: linear-gradient(180deg, transparent, #000 10px, #000 calc(100% - 10px), transparent);
  }
  .overlay-surface {
    position: absolute;
    inset: 0;
    z-index: -1;
    pointer-events: none;
  }
  .surface-sheet {
    position: absolute;
    inset: 0;
  }
  .overlay-head {
    flex: none;
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
    color: var(--ink);
    font-family: var(--font-display);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  /* --- scroll: parchment with torn sides between two wooden rods --------------------------- */
  /* The shadow sits on the wrapper: a mask would clip a shadow drawn on the masked sheet itself. */
  .overlay-scroll .overlay-surface {
    inset: 4px 0;
    filter: drop-shadow(0 10px 22px rgba(0, 0, 0, 0.45));
  }
  .overlay-scroll .surface-sheet {
    --torn-l: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='160'%3E%3Cpath d='M16 0H7L10 9 6 17 11 27 5 36 9 47 4 55 10 67 6 76 11 86 5 94 9 106 4 115 10 125 6 133 11 144 7 160H16Z'/%3E%3C/svg%3E");
    --torn-r: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='160'%3E%3Cpath d='M0 0H9L6 9 10 17 5 27 11 36 7 47 12 55 6 67 10 76 5 86 11 94 7 106 12 115 6 125 10 133 5 144 9 160H0Z'/%3E%3C/svg%3E");
    background:
      radial-gradient(ellipse at 20% 0%, rgba(255, 255, 255, 0.3), transparent 60%),
      linear-gradient(90deg, rgba(92, 64, 24, 0.14), transparent 8%, transparent 92%, rgba(92, 64, 24, 0.14)),
      var(--tex-parchment) 0 0 / 512px 512px repeat,
      var(--grain),
      linear-gradient(180deg, #f6ecd4, #ecdbb8);
    -webkit-mask:
      var(--torn-l) left top / 16px 160px repeat-y,
      linear-gradient(#000 0 0) center / calc(100% - 30px) 100% no-repeat,
      var(--torn-r) right top / 16px 160px repeat-y;
    mask:
      var(--torn-l) left top / 16px 160px repeat-y,
      linear-gradient(#000 0 0) center / calc(100% - 30px) 100% no-repeat,
      var(--torn-r) right top / 16px 160px repeat-y;
  }
  .scroll-rod {
    position: absolute;
    left: -18px;
    right: -18px;
    height: 22px;
    border-radius: 11px;
    z-index: 1;
    background: linear-gradient(180deg, #b98a57 0%, #7a5230 45%, #4e321b 100%);
    box-shadow:
      inset 0 2px 0 rgba(255, 236, 200, 0.35),
      0 3px 6px rgba(0, 0, 0, 0.45);
    pointer-events: none;
  }
  /* Turned gold-capped knobs at both ends of each rod. */
  .scroll-rod::before,
  .scroll-rod::after {
    content: '';
    position: absolute;
    top: -5px;
    width: 22px;
    height: 32px;
    border-radius: 40%;
    background: radial-gradient(circle at 40% 35%, var(--gold-light), var(--bronze) 60%, var(--bronze-dark));
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
  }
  .scroll-rod::before {
    left: -14px;
  }
  .scroll-rod::after {
    right: -14px;
  }
  .rod-top {
    top: -11px;
  }
  .rod-bottom {
    bottom: -11px;
  }

  /* --- table: a dark wood board; objects lie on it, text on the wood is light -------------- */
  .overlay-table .surface-sheet {
    border-radius: 14px;
    background:
      linear-gradient(180deg, rgba(59, 39, 21, 0.35), rgba(59, 39, 21, 0.55)),
      var(--tex-wood) center / cover no-repeat,
      linear-gradient(180deg, var(--wood), var(--wood-dark));
    box-shadow:
      inset 0 0 0 3px #2a1b0e,
      inset 0 0 0 5px rgba(241, 220, 154, 0.22),
      inset 0 0 60px rgba(0, 0, 0, 0.55),
      0 14px 36px rgba(0, 0, 0, 0.5);
  }
  .overlay-table .overlay-title {
    color: var(--gold-light);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  }
  /* Text that sits on the wood itself; objects (tags, sheets, tablets) set their own ink.
     `.overlay-table .overlay-body` (0,2,0) beats `.kit-form`'s ink (0,1,0). */
  .overlay-table .overlay-body {
    color: var(--bronze-ink);
  }
  /* Headings and a medallion row's legend (« Quelle classe ? » on the shelves) sit on the wood. */
  .overlay-table .overlay-body :global(:is(h3, h4, legend)) {
    color: var(--gold-light);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  }
  .overlay-table .overlay-body :global(.muted) {
    color: rgba(255, 247, 230, 0.86);
  }
  .overlay-table .overlay-body :global(.orange) {
    color: #f2a15e;
  }
  /* Until the tablets get their own objects (Task 12; the shelves have had theirs since Task 8),
     their cards are sheets of parchment laid on the wood: opaque, so the board's light ink never
     lands on cream. Inside one, the text goes back to the parchment's own ink (these outrank the
     light rules above). Task 12 deletes these four rules with the tablets' last legacy class. */
  .overlay-table .overlay-body :global(:is(.card, .parchment)) {
    background:
      var(--tex-parchment) 0 0 / 512px 512px repeat,
      linear-gradient(180deg, #f6ecd4, #ecdbb8);
    color: var(--ink);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.45);
  }
  .overlay-table .overlay-body :global(:is(.card, .parchment) :is(h3, h4)) {
    color: var(--bronze-dark);
    text-shadow: none;
  }
  .overlay-table .overlay-body :global(:is(.card, .parchment) .muted) {
    color: var(--form-ink-soft);
  }
  .overlay-table .overlay-body :global(:is(.card, .parchment) .orange) {
    color: var(--orange-ink);
  }

  /* --- codex: an open book, two pages and a gutter; always wide, fixed height ---------------- */
  .overlay-codex {
    height: calc(100dvh - var(--hud-band) - 36px);
    padding: 30px 44px 26px;
  }
  .overlay-codex .surface-sheet {
    border: 12px solid #4a2c17;
    border-radius: 12px 18px 18px 12px;
    background:
      linear-gradient(
        90deg,
        rgba(60, 36, 16, 0.22) 0,
        transparent 5%,
        transparent 44%,
        rgba(60, 36, 16, 0.18) 48.6%,
        rgba(40, 24, 10, 0.42) 50%,
        rgba(60, 36, 16, 0.18) 51.4%,
        transparent 56%,
        transparent 95%,
        rgba(60, 36, 16, 0.22) 100%
      ),
      var(--tex-parchment) 0 0 / 512px 512px repeat,
      var(--grain),
      linear-gradient(180deg, #f6ecd4, #ecdbb8);
    box-shadow:
      0 0 0 2px #2e1a0c,
      inset 0 0 40px rgba(92, 64, 24, 0.25),
      0 14px 36px rgba(0, 0, 0, 0.5);
  }
  /* Review fix round 1 #6: the seal is absolute, so the centred title keeps clear of it. */
  .overlay-codex .overlay-head {
    position: relative;
    justify-content: center;
    padding-inline: 56px;
  }
  .overlay-codex .overlay-title {
    text-align: center;
  }
  .overlay-codex .overlay-seal {
    position: absolute;
    right: 0;
  }
  /* Symmetric room (#1), so the grid's centre stays the book's gutter. */
  .overlay-codex .overlay-body {
    overflow: hidden;
    display: flex;
    padding: 14px;
  }
  /* Ruling W1's contract: a codex panel renders one .codex-spread with two .codex-page sections;
     the grid's centre is the book's gutter (the panel padding is symmetric). */
  .overlay-codex .overlay-body > :global(.codex-spread) {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: 72px;
  }
  /* Each page scrolls on its own: the same room for focus rings as the body (#1). */
  .overlay-codex .overlay-body :global(.codex-page) {
    min-height: 0;
    overflow: auto;
    overscroll-behavior: contain;
    padding: 8px;
    margin: -8px;
    scroll-padding: 8px;
  }
  @media (max-width: 900px) {
    .overlay-codex .overlay-body {
      overflow: auto;
      display: block;
    }
    .overlay-codex .overlay-body > :global(.codex-spread) {
      grid-template-columns: 1fr;
    }
    .overlay-codex .overlay-body :global(.codex-page) {
      overflow: visible;
    }
  }
</style>
