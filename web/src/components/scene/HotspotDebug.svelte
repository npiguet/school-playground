<script lang="ts">
  // Read-only `?debug` overlay (Task 9b, replaces the interactive `?edit` editor): draws every
  // visible hotspot's shape outline, id tag and label-position box, plus the safe zone, HUD band
  // and dialogue dock, so hotspots authored as data (docs/art/scenes.md) can be checked visually
  // in screenshots. Entirely pointer-events: none so hotspots underneath stay clickable.
  import { DIALOGUE_DOCK, HUD_BAND, SAFE_ZONE, shapeBox } from '../../lib/scene/geometry';
  import type { Box, HotspotDef, LabelPos } from '../../lib/scene/types';

  let { sceneId, hotspots }: { sceneId: string; hotspots: HotspotDef[] } = $props();

  /** Polygon points normalised to the shape's own box, as `0-100` SVG user units (same maths as
   *  geometry.ts's clipPath(), for the 0 0 100 100 viewBox below). */
  function outlinePoints(def: HotspotDef, box: Box): string {
    if (def.shape.kind !== 'polygon') return '';
    return def.shape.points.map(([x, y]) => `${((x - box.x) / box.w) * 100},${((y - box.y) / box.h) * 100}`).join(' ');
  }

  const LABEL_BOX_H = 8;
  function labelBox(box: Box, labelPos: LabelPos): Box {
    if (labelPos === 'on') return { x: box.x, y: box.y + box.h - LABEL_BOX_H / 2, w: box.w, h: LABEL_BOX_H / 2 };
    return labelPos === 'below'
      ? { x: box.x, y: box.y + box.h, w: box.w, h: LABEL_BOX_H }
      : { x: box.x, y: box.y - LABEL_BOX_H, w: box.w, h: LABEL_BOX_H };
  }
</script>

<div class="hotspot-debug" data-testid="hotspot-debug">
  <div class="zone" style="left:{SAFE_ZONE.x}%;top:{SAFE_ZONE.y}%;width:{SAFE_ZONE.w}%;height:{SAFE_ZONE.h}%"></div>
  <div class="zone" style="left:0%;top:0%;width:100%;height:{HUD_BAND}%"></div>
  <div class="zone" style="left:{DIALOGUE_DOCK.x}%;top:{DIALOGUE_DOCK.y}%;width:{DIALOGUE_DOCK.w}%;height:{DIALOGUE_DOCK.h}%"></div>

  {#each hotspots as def (def.id)}
    {@const box = shapeBox(def.shape)}
    {@const lbox = labelBox(box, def.labelPos)}
    <svg
      class="outline"
      data-hotspot-id="{sceneId}-{def.id}"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style="left:{box.x}%;top:{box.y}%;width:{box.w}%;height:{box.h}%"
    >
      {#if def.shape.kind === 'ellipse'}
        <ellipse cx="50" cy="50" rx="49" ry="49" vector-effect="non-scaling-stroke" />
      {:else}
        <polygon points={outlinePoints(def, box)} vector-effect="non-scaling-stroke" />
      {/if}
    </svg>
    <div class="label-box" style="left:{lbox.x}%;top:{lbox.y}%;width:{lbox.w}%;height:{lbox.h}%"></div>
    <span class="tag" style="left:{box.x}%;top:{box.y}%">{sceneId}-{def.id}</span>
  {/each}
</div>

<style>
  .hotspot-debug {
    position: absolute;
    inset: 0;
    z-index: 20;
    pointer-events: none;
  }
  .zone {
    position: absolute;
    border: 1px dashed rgba(255, 255, 255, 0.4);
    background: rgba(255, 255, 255, 0.03);
  }
  .outline {
    position: absolute;
    overflow: visible;
  }
  .outline ellipse,
  .outline polygon {
    fill: rgba(0, 229, 255, 0.08);
    stroke: rgb(0, 229, 255);
    stroke-width: 2;
    stroke-dasharray: 4 3;
  }
  .label-box {
    position: absolute;
    border: 1px dashed rgba(0, 229, 255, 0.55);
  }
  .tag {
    position: absolute;
    transform: translateY(-100%);
    padding: 1px 4px;
    font-family: monospace;
    font-size: 10px;
    line-height: 1.4;
    color: rgb(0, 229, 255);
    background: rgba(15, 15, 20, 0.7);
    white-space: nowrap;
  }
</style>
