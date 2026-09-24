<script lang="ts">
  // Scene entry (scenes UI spec §4): a gentle zoom-in, or a plain fade under reduced motion
  // ("fades only"). Svelte transitions run on the Web Animations API, which the global CSS
  // reduced-motion rule does not reach, hence the explicit check.
  // Final review M10: `data-settled` flips to "true" once the entry has finished (introend), so
  // tests and screenshots wait for the real end of the animation, not for a moment before it
  // started.
  import type { Snippet } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { reducedMotion } from '../../lib/juice/motion';

  let { kind = 'fade', children }: { kind?: 'fade' | 'zoom'; children: Snippet } = $props();

  let settled = $state(false);

  function enter(node: Element) {
    return kind === 'zoom' && !reducedMotion()
      ? scale(node, { start: 1.04, opacity: 0, duration: 450 })
      : fade(node, { duration: 300 });
  }
</script>

<div
  class="scene-transition"
  data-settled={settled ? 'true' : 'false'}
  in:enter|global
  onintroend={() => (settled = true)}
>
  {@render children()}
</div>

<style>
  .scene-transition {
    position: absolute;
    inset: 0;
  }
</style>
