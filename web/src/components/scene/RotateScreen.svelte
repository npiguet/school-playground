<script lang="ts">
  // Portrait → "tourne ton iPad" (scenes UI spec §1, §4). Pure CSS: hidden unless the viewport
  // is in portrait orientation; SceneStage hides its content at the same breakpoint.
  // Playability #15: the scene's own art stays behind it, blurred and darkened, so the player
  // never leaves the world; the tablet (camera dot, home button) turns a quarter turn (a gentle pulse under reduced
  // motion, since reduced motion means "fades only").
  //
  // Plan Ruling P6: this must paint above EVERYTHING in portrait - the onboarding modal, any
  // overlay, and the hero panel (Task 6/7) - not just above the scene it's mounted in. SceneStage
  // renders us as a child of `.scene-stage`, but `.scene-stage` uses `position: fixed`, which
  // (per the CSS stacking-context spec) *always* opens its own stacking context regardless of its
  // z-index. A z-index set inside that context can never out-rank a sibling of `.scene-stage`
  // itself (e.g. Onboarding's overlay), so we portal our root node to <body> on mount: a true
  // top-level element, compared against every other top-level overlay by `--z-rotate-screen`
  // alone (see web/src/styles/kit.css).
  import { onMount } from 'svelte';

  let { background = null }: { background?: string | null } = $props();

  // A plain `let`, not `$state`: this is an imperative DOM ref (bind:this) used once in onMount
  // to portal the node to <body>, never read reactively, so it needs no reactivity of its own.
  let root: HTMLDivElement | undefined;

  onMount(() => {
    const node = root;
    if (!node) return;
    document.body.appendChild(node);
    return () => node.remove();
  });
</script>

<div bind:this={root} class="rotate-screen" data-testid="rotate-screen" role="status">
  {#if background}<img class="rotate-backdrop" src={background} alt="" aria-hidden="true" />{/if}
  <div class="rotate-icon" aria-hidden="true"></div>
  <p class="kit-plaque">Tourne ton iPad</p>
  <p class="rotate-hint">Le camp se découvre à l'horizontale.</p>
</div>

<style>
  .rotate-screen {
    display: none;
  }
  /* Spec §4: "portrait and aspect < 1" - `orientation: portrait` alone also matches an exactly
     square viewport (aspect ratio 1), which must NOT show the rotate screen. `aspect-ratio < 1`
     (range syntax, Safari 16.4+) is the literal, exact spec condition - unlike a max-aspect-ratio
     fraction, it needs no "close enough to 1 but technically under" approximation. */
  @media (orientation: portrait) and (aspect-ratio < 1) {
    .rotate-screen {
      position: fixed;
      inset: 0;
      z-index: var(--z-rotate-screen);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 20px;
      padding: 24px;
      overflow: hidden;
      background: var(--night);
      color: var(--bronze-ink);
      text-align: center;
    }
  }
  .rotate-backdrop {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: blur(10px) brightness(0.3);
    transform: scale(1.08);
  }
  .rotate-icon,
  .rotate-screen p {
    position: relative;
  }
  .rotate-icon {
    width: 64px;
    height: 96px;
    border: 4px solid var(--bronze-light);
    border-radius: 12px;
    background: rgba(21, 18, 26, 0.35);
    box-shadow: 0 0 18px rgba(200, 148, 80, 0.45);
    animation: rotate-hint 2.4s ease-in-out infinite;
  }
  /* A camera dot at the top, a home button at the bottom: a tablet, not an empty frame
     (playability #27). */
  .rotate-icon::before,
  .rotate-icon::after {
    content: '';
    position: absolute;
    left: 50%;
    border-radius: 50%;
    background: var(--bronze-light);
    transform: translateX(-50%);
  }
  .rotate-icon::before {
    top: 5px;
    width: 5px;
    height: 5px;
  }
  .rotate-icon::after {
    bottom: 5px;
    width: 10px;
    height: 10px;
    background: none;
    border: 2px solid var(--bronze-light);
  }
  .rotate-hint {
    margin: 0;
    font-family: var(--font-body);
    font-size: 20px;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7);
  }
  @keyframes rotate-hint {
    0%,
    12% {
      transform: rotate(0);
    }
    45%,
    85% {
      transform: rotate(-90deg);
    }
    100% {
      transform: rotate(0);
    }
  }
  @keyframes rotate-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.45;
    }
  }
  /* Reduced motion: no turn, a slow fade instead. The app-wide reduced-motion rule (app.css)
     shortens every animation to nothing with !important; this more specific !important rule
     keeps just this gentle fade alive, as "fades only" allows. */
  @media (prefers-reduced-motion: reduce) {
    .rotate-icon {
      animation: rotate-pulse 2.4s ease-in-out infinite !important;
      animation-duration: 2.4s !important;
      animation-iteration-count: infinite !important;
    }
  }
</style>
