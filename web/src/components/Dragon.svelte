<script lang="ts">
  // The dragon companion's portrait: one cut WebP per stage, tinted with a CSS filter (decision
  // 11 - never a new art generation for a tint). Used by the victory's spoils
  // (battle/VictorySpoils.svelte) for the hatch (the places draw the dragon as a SceneLayer cut-out).
  import { ART } from '../lib/world/art';
  import { TINT_FILTERS, type Mood } from '../lib/world/dragon';
  import type { DragonStage, Tint } from '../lib/world/types';

  let {
    stage,
    tint,
    size = 120,
    mood = 'idle',
    name = null,
  }: { stage: DragonStage; tint: Tint; size?: number; mood?: Mood; name?: string | null } = $props();
</script>

<img
  src={ART.dragon[stage]}
  alt={name ?? 'Ton dragon'}
  style={`filter: ${TINT_FILTERS[tint]}; width: ${size}px`}
  class="dragon {mood}"
  class:egg={stage === 'egg'}
  loading="eager"
  decoding="async"
/>

<style>
  .dragon {
    display: block;
    height: auto;
    object-fit: contain;
  }
  .dragon.idle {
    animation: float 4s ease-in-out infinite;
  }
  .dragon.sleepy {
    animation: float 7s ease-in-out infinite;
  }
  .dragon.happy {
    animation: pop 0.5s ease both;
  }
  .dragon.egg.happy {
    animation: wobble 0.5s ease both;
  }
</style>
