<script lang="ts">
  // Scene entry (scenes UI spec §4): a gentle zoom-in, or a plain fade under reduced motion
  // ("fades only"). Svelte transitions run on the Web Animations API, which the global CSS
  // reduced-motion rule does not reach, hence the explicit check.
  // Final review M10: `data-settled` flips to "true" once the entry has finished (introend), so
  // tests and screenshots wait for the real end of the animation, not for a moment before it
  // started.
  // Fix round 1 minor #1: `introend` was observed missing under heavy parallel WebKit load (the
  // scene never settled within helpers.ts's timeout). `onintrostart` opens a second, independent
  // path to the same flag by awaiting the Web Animation(s) directly, so a dropped/aborted custom
  // event no longer leaves the stage stuck.
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

  async function onIntroStart(e: Event) {
    const node = e.target as Element;
    // Let the transition's own animate() call (issued right after this event fires) run first,
    // so getAnimations() below actually sees it.
    await Promise.resolve();
    await Promise.allSettled(node.getAnimations().map((a) => a.finished));
    settled = true;
  }
</script>

<div
  class="scene-transition"
  data-settled={settled ? 'true' : 'false'}
  in:enter|global
  onintrostart={onIntroStart}
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
