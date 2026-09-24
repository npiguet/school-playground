<script lang="ts">
  // Scene entry (scenes UI spec §4): a gentle zoom-in, or a plain fade under reduced motion
  // ("fades only"). Svelte transitions run on the Web Animations API, which the global CSS
  // reduced-motion rule does not reach, hence the explicit check.
  import type { Snippet } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { reducedMotion } from '../../lib/juice/motion';

  let { kind = 'fade', children }: { kind?: 'fade' | 'zoom'; children: Snippet } = $props();

  function enter(node: Element) {
    return kind === 'zoom' && !reducedMotion()
      ? scale(node, { start: 1.04, opacity: 0, duration: 450 })
      : fade(node, { duration: 300 });
  }
</script>

<div class="scene-transition" in:enter|global>{@render children()}</div>

<style>
  .scene-transition {
    position: absolute;
    inset: 0;
  }
</style>
