<script lang="ts">
  // A combatant on the battle stage (UI4 Ruling C10): an existing cut-out, idle-breathing from the
  // kit, reacting through the Web Animations API. `.actor` moves in screen space; `.facing` mirrors
  // the art so the two sides look at each other. The dragon wears its pieces (`overlays`, spec
  // 2026-09-29 drachmes §4, R19); the mirror flips the whole figure, pieces included.
  import DragonFigure from '../DragonFigure.svelte';
  import type { OverlayLayer } from '../../lib/world/accessories';
  import type { Tint } from '../../lib/world/types';
  import { reactionAnimation, type Reaction } from '../../lib/battle/reactions';

  let {
    src,
    alt,
    side,
    mirror,
    tint = null,
    overlays = [],
    reaction,
    nonce,
    testId,
    idle,
    reduced,
    hits = 0,
  }: {
    src: string;
    alt: string;
    side: 'left' | 'right';
    mirror: boolean;
    tint?: Tint | null;
    overlays?: OverlayLayer[];
    reaction: Reaction;
    nonce: number;
    testId: string;
    idle: boolean;
    reduced: boolean;
    hits?: number;
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
      <DragonFigure {src} {alt} {tint} {overlays} className={idle && !reduced ? 'combatant-figure idle-breathe' : 'combatant-figure'} />
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
  .facing :global(.combatant-figure .dragon-base) {
    height: 100%;
    width: auto;
    object-fit: contain;
    user-select: none;
  }
</style>
