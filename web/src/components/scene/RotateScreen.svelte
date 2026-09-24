<script lang="ts">
  // Portrait → "tourne ton iPad" (scenes UI spec §1, §4). Pure CSS: hidden unless the viewport
  // is in portrait orientation; SceneStage hides its content at the same breakpoint.
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
  <div class="rotate-icon" aria-hidden="true"></div>
  <p class="kit-plaque">Tourne ton iPad</p>
  <p class="rotate-hint">Le camp se découvre à l'horizontale.</p>
</div>

<style>
  .rotate-screen {
    display: none;
  }
  /* Spec §4: "portrait and aspect < 1" - `orientation: portrait` alone also matches an exactly
     square viewport (aspect ratio 1), which must NOT show the rotate screen. max-aspect-ratio
     excludes it (999/1000 rather than 1/1 so it stays a strict "< 1", not "<= 1"). */
  @media (orientation: portrait) and (max-aspect-ratio: 999/1000) {
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
      background: var(--night);
      color: var(--bronze-ink);
      text-align: center;
    }
  }
  .rotate-icon {
    width: 64px;
    height: 96px;
    border: 4px solid var(--bronze-light);
    border-radius: 12px;
    animation: rotate-hint 2.4s ease-in-out infinite;
  }
  .rotate-hint {
    margin: 0;
    font-family: var(--font-body);
    font-size: 20px;
  }
  @keyframes rotate-hint {
    0%,
    30% {
      transform: rotate(0);
    }
    60%,
    100% {
      transform: rotate(-90deg);
    }
  }
</style>
