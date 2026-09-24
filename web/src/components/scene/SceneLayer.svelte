<script lang="ts">
  // A positioned cut-out (scenes UI spec §4): x = centre, y = bottom edge, scale = width, in art %.
  // Parallax offset by depth; no parallax and no idle animation under reduced motion.
  import { parallaxOffset } from '../../lib/scene/geometry';
  import { useSceneRuntime } from '../../lib/scene/runtime.svelte';
  import type { SceneLayerDef } from '../../lib/scene/types';

  let { layer, filter = 'none', testId }: { layer: SceneLayerDef; filter?: string; testId?: string } = $props();

  const rt = useSceneRuntime();
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
  <img
    class="scene-layer-img idle-{rt.reduced ? 'none' : layer.idle}"
    src={layer.src}
    alt={layer.alt}
    draggable="false"
    style="filter:{filter}"
  />
</div>

<style>
  .scene-layer {
    position: absolute;
    z-index: 1;
    pointer-events: none;
    transition: transform 0.35s ease-out;
  }
  .scene-layer-img {
    display: block;
    width: 100%;
    height: auto;
  }
</style>
