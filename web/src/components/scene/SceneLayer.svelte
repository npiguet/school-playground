<script lang="ts">
  // A positioned cut-out (scenes UI spec §4): x = centre, y = bottom edge, scale = width, in art %.
  // Parallax offset by depth; no parallax and no idle animation under reduced motion.
  import { parallaxOffset } from '../../lib/scene/geometry';
  import { useSceneRuntime } from '../../lib/scene/runtime.svelte';
  import type { SceneLayerDef } from '../../lib/scene/types';

  let { layer, filter = 'none', testId }: { layer: SceneLayerDef; filter?: string; testId?: string } = $props();

  const rt = useSceneRuntime();
  const off = $derived(rt.reduced || rt.editing ? { x: 0, y: 0 } : parallaxOffset(layer.depth, rt.nx, rt.ny));
</script>

<img
  class="scene-layer idle-{rt.reduced ? 'none' : layer.idle}"
  src={layer.src}
  alt={layer.alt}
  data-testid={testId}
  data-offset="{off.x},{off.y}"
  draggable="false"
  style="left:{layer.x - layer.scale / 2 + off.x}%;bottom:{100 - layer.y - off.y}%;width:{layer.scale}%;filter:{filter}"
/>

<style>
  .scene-layer {
    position: absolute;
    z-index: 1;
    height: auto;
    pointer-events: none;
    transition:
      left 0.35s ease-out,
      bottom 0.35s ease-out;
  }
</style>
