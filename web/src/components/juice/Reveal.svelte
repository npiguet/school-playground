<script lang="ts">
  // Fade-up wrapper for staggering content in (spec §5 juice). Reduced motion is
  // handled globally by the `app.css` media query, which collapses the animation
  // duration to ~0 - no JS branch needed here.
  import type { Snippet } from 'svelte';

  let { delay = 0, children }: { delay?: number; children: Snippet } = $props();
</script>

<div class="reveal" style="animation-delay: {delay}ms">
  {@render children()}
</div>

<style>
  .reveal {
    animation: fade-up 0.45s both;
  }
</style>
