<script lang="ts">
  // The dragon companion's portrait: one cut WebP per stage, in its tint (TINT_SPECS, decision 11 -
  // never a new art generation for a tint), and the pieces it wears (spec 2026-09-29 drachmes §4),
  // drawn untinted by DragonFigure. Used by the victory's spoils (battle/VictorySpoils.svelte) for the
  // hatch and the camp's « grew while you were away » reveal (screens/Camp.svelte; the places draw the
  // dragon itself as a SceneLayer cut-out).
  // Its size comes from the caller; the places size each stage themselves (camp.ts / nest.ts `WIDTH`).
  import DragonFigure from './DragonFigure.svelte';
  import { ART } from '../lib/world/art';
  import { accessoryLayers } from '../lib/world/accessories';
  import type { Mood } from '../lib/world/dragon';
  import type { DragonStage, Tint } from '../lib/world/types';

  let {
    stage,
    tint,
    size = 120,
    mood = 'idle',
    name = null,
    worn = [],
  }: { stage: DragonStage; tint: Tint; size?: number; mood?: Mood; name?: string | null; worn?: readonly string[] } = $props();
</script>

<DragonFigure
  src={ART.dragon[stage]}
  alt={name ?? 'Ton dragon'}
  {tint}
  overlays={accessoryLayers(worn, stage)}
  className="dragon {mood}{stage === 'egg' ? ' egg' : ''}"
  style="width:{size}px"
/>

<style>
  /* The figure is DragonFigure's element: the mood's animation moves the picture and its pieces as one. */
  :global(.dragon-figure.dragon.idle) {
    animation: float 4s ease-in-out infinite;
  }
  :global(.dragon-figure.dragon.sleepy) {
    animation: float 7s ease-in-out infinite;
  }
  :global(.dragon-figure.dragon.happy) {
    animation: pop 0.5s ease both;
  }
  :global(.dragon-figure.dragon.egg.happy) {
    animation: wobble 0.5s ease both;
  }
</style>
