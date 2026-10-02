<script lang="ts">
  // The dragon as drawn on screen (spec 2026-09-29 drachmes §4, R19): its stage picture under the tint's
  // CSS filter, and the pieces it wears on top, unfiltered (a tint recolours the dragon, never its
  // gear). The overlays are percentages of the picture's own box, so the figure scales as one.
  // `className` carries the caller's animation (idle, mood), so the pieces move with the dragon.
  import type { OverlayLayer } from '../lib/world/accessories';

  let {
    src,
    alt,
    filter = 'none',
    overlays = [],
    className = '',
    style = '',
  }: { src: string; alt: string; filter?: string; overlays?: OverlayLayer[]; className?: string; style?: string } = $props();
</script>

<div class="dragon-figure {className}" {style}>
  <img class="dragon-base" {src} {alt} style:filter draggable="false" />
  {#each overlays as o (o.item)}
    <img
      class="dragon-overlay"
      data-testid="dragon-overlay"
      data-item={o.item}
      src={o.src}
      alt=""
      draggable="false"
      style="left:{o.left}%;top:{o.top}%;width:{o.width}%;height:{o.height}%"
    />
  {/each}
</div>

<style>
  .dragon-figure {
    position: relative;
  }
  .dragon-base {
    display: block;
    width: 100%;
    height: auto;
  }
  .dragon-overlay {
    position: absolute;
    display: block;
    pointer-events: none;
  }
</style>
