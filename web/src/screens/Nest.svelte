<script lang="ts">
  // The dragon's nest (scenes UI spec §3, UI3 Ruling B5): the dragon in the straw bed at its stage
  // and tint, its growth on a parchment, a tap on it opens its care (#/p/:id/dragon?panel=soin:
  // name and tint), where it speaks. It greets once per page load with its stage line.
  import PlaceScene from '../components/scene/PlaceScene.svelte';
  import SceneLayer from '../components/scene/SceneLayer.svelte';
  import Hotspot from '../components/scene/Hotspot.svelte';
  import Overlay from '../components/scene/Overlay.svelte';
  import Gauge from '../components/juice/Gauge.svelte';
  import CarePanel from '../components/places/nest/CarePanel.svelte';
  import { NEST_SCENE, careLine, growth, nestDragonLayer, nestGreeting } from '../lib/world/scenes/nest';
  import { ART } from '../lib/world/art';
  import { TINT_FILTERS, stageActivity, stageLabel } from '../lib/world/dragon';
  import { campFor } from '../lib/world/campStore.svelte';
  import { closePanel, openHotspot } from '../lib/scene/panelNav';
  import { hotspotSelector } from '../lib/scene/hotspotId';
  import { OVERLAY_TITLES, sceneHref, type PanelId } from '../lib/world/places';
  import type { CampResponse } from '../lib/world/types';
  import type { HotspotDef } from '../lib/scene/types';
  import type { Profile } from '../lib/types';

  let { profile, panel }: { profile: Profile; panel: PanelId | null } = $props();

  let debug = $state(false);
  const dragon = $derived(campFor(profile.id)?.dragon ?? null);
  const greet = (camp: CampResponse | null) => (camp ? nestGreeting(camp.dragon) : null);
  const activate = (def: HotspotDef) => openHotspot(def, profile.id);
  const close = () => closePanel(sceneHref('nest', profile.id));
</script>

<PlaceScene {profile} scene={NEST_SCENE} bind:debug {greet}>
  {#snippet children(ctx)}
    {#if ctx.camp}
      {@const d = ctx.camp.dragon}
      {@const g = growth(d)}
      <SceneLayer
        layer={{ id: 'dragon', src: ART.dragon[d.stage], alt: d.name ?? 'Ton dragon', ...nestDragonLayer(d.stage) }}
        filter={TINT_FILTERS[d.tint]}
        testId="nest-dragon-layer"
      />
      <div class="kit-parchment nest-growth stage-text" data-testid="nest-growth">
        <span class="kit-plaque nest-stage" data-testid="dragon-stage">{stageLabel(d.stage)}</span>
        <Gauge value={g.value} max={g.max} label={g.label} />
        <p class="nest-activity">{stageActivity(d.stage)}</p>
      </div>
    {/if}
    {#each NEST_SCENE.hotspots as def (def.id)}
      <Hotspot {def} status={def.state(ctx)} sceneId="nest" onActivate={activate} />
    {/each}
  {/snippet}
</PlaceScene>

{#if panel === 'soin'}
  <Overlay variant="scroll" title={OVERLAY_TITLES.soin} testId="overlay-care" voice={dragon ? careLine(dragon) : null} onClose={close} returnFocus={hotspotSelector('nest', 'dragon')}>
    <CarePanel {profile} />
  </Overlay>
{/if}

<style>
  /* The growth parchment on the cliff, left of the nest (art x 13.5-32.5, from y 18): inside the safe
     zone, clear of the dragon's place (x 34+) and the HUD band; `stage-text` fades it under overlays. */
  .nest-growth {
    position: absolute;
    left: 13.5%;
    top: 18%;
    width: 19%;
    z-index: 3;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    text-align: center;
  }
  .nest-stage {
    font-size: 15px;
  }
  /* The gauge spans the sheet, its words centred above the « n / m » count (the sheet is narrow). */
  .nest-growth :global(.gauge) {
    align-self: stretch;
  }
  .nest-growth :global(.gauge-label) {
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  .nest-activity {
    margin: 0;
    font-style: italic;
  }
</style>
