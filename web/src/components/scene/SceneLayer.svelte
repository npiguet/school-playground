<script lang="ts">
  // A positioned cut-out (scenes UI spec §4): x = centre, y = bottom edge, scale = width, in art %.
  // Parallax offset by depth; no parallax and no idle animation under reduced motion. The dragon's
  // layer also carries the pieces it wears (`overlays`, spec 2026-09-29 drachmes §4, R19): the idle
  // animation is on the figure, so they breathe with it. Only the dragon's layer (the one given
  // `overlays`, even none) is a DragonFigure, in its `tint`; every other layer (the Pythia, the owl...)
  // stays a plain, untinted picture (SP4 Task 6 review, minor 4).
  import DragonFigure from '../DragonFigure.svelte';
  import type { OverlayLayer } from '../../lib/world/accessories';
  import { parallaxOffset } from '../../lib/scene/geometry';
  import { useSceneRuntime } from '../../lib/scene/runtime.svelte';
  import type { SceneLayerDef } from '../../lib/scene/types';
  import type { Tint } from '../../lib/world/types';

  let {
    layer,
    tint = null,
    overlays = null,
    testId,
  }: { layer: SceneLayerDef; tint?: Tint | null; overlays?: OverlayLayer[] | null; testId?: string } = $props();

  const rt = useSceneRuntime();
  const idle = $derived(`scene-layer-img idle-${rt.reduced ? 'none' : layer.idle}`);
  const off = $derived(rt.reduced || rt.debug ? { x: 0, y: 0 } : parallaxOffset(layer.depth, rt.nx, rt.ny));
  // Parallax animates a `transform` (compositor-only) rather than `left`/`bottom` (layout), so it
  // never triggers layout/paint on every pointer-move frame. `off` is in art %; converted here to
  // px of the art box (rt.artW/artH) since `transform: translate()` percentages resolve against
  // the element's own box, not the art box. The base position (left/bottom below) stays static.
  const offPx = $derived({ x: (off.x / 100) * rt.artW, y: (off.y / 100) * rt.artH });
</script>

<div
  class="scene-layer"
  data-testid={testId}
  data-offset="{off.x},{off.y}"
  style="left:{layer.x - layer.scale / 2}%;bottom:{100 - layer.y}%;width:{layer.scale}%;transform:translate({offPx.x}px,{offPx.y}px)"
>
  {#if overlays}
    <DragonFigure src={layer.src} alt={layer.alt} {tint} {overlays} className={idle} />
  {:else}
    <img class={idle} src={layer.src} alt={layer.alt} draggable="false" />
  {/if}
</div>

<style>
  .scene-layer {
    position: absolute;
    z-index: 1;
    pointer-events: none;
    transition: transform 0.35s ease-out;
  }
  .scene-layer :global(.scene-layer-img) {
    display: block;
    width: 100%;
  }
  img.scene-layer-img {
    height: auto;
  }
</style>
