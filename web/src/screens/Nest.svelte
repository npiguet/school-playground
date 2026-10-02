<script lang="ts">
  // The dragon's nest (scenes UI spec §3, UI3 Ruling B5): the dragon on its stage's painting (spec
  // 2026-10-02 nest by stage) at its stage and tint, its growth on a sheet pinned to the rock beside it
  // (at the right side of the frame from the adult stage; UI3b playability #5: the war tent's pinned
  // parchment and its laurel gauge, not a web card), a tap on it opens its care
  // (#/p/:id/dragon?panel=soin: name, tint and parure), where it speaks. It greets once per page load with
  // its stage line.
  import PlaceScene from '../components/scene/PlaceScene.svelte';
  import SceneLayer from '../components/scene/SceneLayer.svelte';
  import Hotspot from '../components/scene/Hotspot.svelte';
  import Overlay from '../components/scene/Overlay.svelte';
  import CarePanel from '../components/places/nest/CarePanel.svelte';
  import { NEST_STAGES, SHEET_TOP, SHEET_X, careLine, growth, nestDragonLayer, nestGreeting, nestScene } from '../lib/world/scenes/nest';
  import { ART } from '../lib/world/art';
  import { accessoryLayers } from '../lib/world/accessories';
  import { dragonCaption, stageActivity, stageLabel } from '../lib/world/dragon';
  import { livingStage } from '../lib/living/stages';
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
  // Spec 2026-10-02 nest by stage: the nest painted for the dragon's stage (none until /camp says it).
  const scene = $derived(nestScene(dragon?.stage ?? null));
  const greet = (camp: CampResponse | null) => (camp ? nestGreeting(camp.dragon) : null);
  const activate = (def: HotspotDef) => openHotspot(def, profile.id);
  const close = () => closePanel(sceneHref('nest', profile.id));
</script>

<PlaceScene {profile} {scene} bind:debug {greet}>
  {#snippet children(ctx)}
    {#if ctx.camp}
      {@const d = ctx.camp.dragon}
      {@const g = growth(ctx.camp.xp, d.stage)}
      {@const side = NEST_STAGES[d.stage].sheet}
      <SceneLayer
        layer={{ id: 'dragon', src: ART.dragon[d.stage], alt: dragonCaption(d), ...nestDragonLayer(d.stage) }}
        tint={d.tint}
        overlays={accessoryLayers(d.worn, d.stage)}
        living={livingStage(d.stage)}
        testId="nest-dragon-layer"
      />
      <div
        class="kit-sheet nest-growth stage-text"
        data-testid="nest-growth"
        data-side={side}
        style:left="{SHEET_X[side].x}%"
        style:top="{SHEET_TOP}%"
        style:width="calc({SHEET_X[side].w}% - 20px)"
      >
        <span class="kit-plaque nest-stage" data-testid="dragon-stage">{stageLabel(d.stage)}</span>
        <span
          class="kit-gauge"
          role="progressbar"
          aria-label={g.label}
          aria-valuemin={0}
          aria-valuemax={g.max}
          aria-valuetext={g.count ?? g.label}
          aria-valuenow={g.value}
          data-state={g.value >= g.max ? 'ok' : 'short'}
          style:--fill="{Math.min(100, (g.value / g.max) * 100)}%"
        >
          <span class="kit-gauge-label growth-label">{g.label}</span>
          <span class="kit-gauge-track"><span class="kit-gauge-fill"></span></span>
          {#if g.count}<span class="growth-count">{g.count}</span>{/if}
        </span>
        <p class="nest-activity">{stageActivity(d.stage)}</p>
      </div>
    {/if}
    {#each scene.hotspots as def (def.id)}
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
  /* The growth sheet pinned on the rock (spec 2026-10-02 nest by stage): beside the dragon on the
     left up to the young stage, at the right side of the frame from the adult; its band (left, top,
     width) comes from nest.ts SHEET_X / SHEET_TOP, inside the safe zone, clear of the dragon and the
     HUD band; `stage-text` fades it under overlays. .kit-sheet's own margin leaves room for its rods. */
  .nest-growth {
    position: absolute;
    box-sizing: border-box;
    z-index: 3;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 16px 14px 12px;
    text-align: center;
  }
  .nest-stage {
    font-size: 15px;
  }
  /* The gauge spans the sheet, its words centred above the track and the count under it. */
  .nest-growth .kit-gauge {
    align-self: stretch;
    gap: 4px;
  }
  .growth-label {
    font-size: 15px;
  }
  .growth-count {
    font-size: 14px;
    color: var(--form-ink-soft);
  }
  .nest-activity {
    margin: 0;
    font-style: italic;
  }
</style>
