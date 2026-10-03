<script lang="ts">
  // A combatant on the battle stage (UI4 Ruling C10; spec 2026-10-03 living battle, plan Rulings B5,
  // B7): an existing cut-out, alive on a canvas when `living` names its rig (DragonFigure's living path:
  // the still picture while it loads, under reduced motion, without WebGL2 or on any failure), reacting
  // through the Web Animations API. `.actor` moves in screen space; `.facing` mirrors the art so the two
  // sides look at each other. `aspect` (the picture's width over its height) gives the figure its box,
  // so the still picture and the canvas take the same place. The dragon wears its pieces (`overlays`,
  // spec 2026-09-29 drachmes §4, R19); the mirror flips the whole figure, pieces included.
  import DragonFigure from '../DragonFigure.svelte';
  import type { OverlayLayer } from '../../lib/world/accessories';
  import type { LivingRig } from '../../lib/living/stages';
  import type { Tint } from '../../lib/world/types';
  import { reactionAnimation, type Reaction } from '../../lib/battle/reactions';

  let {
    src,
    alt,
    side,
    mirror,
    tint = null,
    overlays = [],
    living = null,
    aspect,
    reaction,
    nonce,
    testId,
    reduced,
    hits = 0,
    paused = false,
  }: {
    src: string;
    alt: string;
    side: 'left' | 'right';
    mirror: boolean;
    tint?: Tint | null;
    overlays?: OverlayLayer[];
    living?: LivingRig | null;
    aspect: number;
    reaction: Reaction;
    nonce: number;
    testId: string;
    reduced: boolean;
    hits?: number;
    /** Holds the living figure's frame (the « Revoir » scroll covers the stage). */
    paused?: boolean;
  } = $props();

  let actor: HTMLDivElement | undefined = $state();

  $effect(() => {
    void nonce; // every reaction replays, the same one twice included
    const el = actor;
    const spec = reactionAnimation(reaction, { away: side === 'right' ? 1 : -1, reduced });
    if (!el || !spec) return;
    const a = el.animate(spec.keyframes, spec.options);
    return () => {
      // A held end pose (defeat, retreat) stays until the next reaction replaces it.
      if (spec.options.fill !== 'forwards') a.cancel();
    };
  });
</script>

<div class="combatant {side}" data-testid={testId} data-reaction={reaction} data-hits={hits}>
  <div class="actor" bind:this={actor}>
    <div class="facing" class:mirror>
      <DragonFigure {src} {alt} {tint} {overlays} {living} {paused} className="combatant-figure" style="aspect-ratio: {aspect}" />
    </div>
  </div>
</div>

<style>
  .combatant {
    position: absolute;
    bottom: var(--feet, 6%);
    height: var(--h, 40vh);
    pointer-events: none;
  }
  .combatant.left {
    left: var(--left-x, 4vw);
  }
  .combatant.right {
    right: var(--right-x, 4vw);
  }
  .actor,
  .facing {
    height: 100%;
  }
  .facing.mirror {
    transform: scaleX(-1);
  }
  /* The figure's box is the picture's, so the pieces' percentages hold at any height. */
  .facing :global(.combatant-figure) {
    height: 100%;
    display: inline-block;
  }
  .facing :global(.combatant-figure img.dragon-base) {
    height: 100%;
    width: auto;
    object-fit: contain;
    user-select: none;
  }
</style>
