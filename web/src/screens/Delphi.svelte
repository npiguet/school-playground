<script lang="ts">
  // Delphi (scenes UI spec §3): the Pythia on her tripod opens the weekly scrolls and the
  // prophecies (#/p/:id/delphes), the votive-tablet wall opens the quest board (#/p/:id/quetes).
  // The nearest prophecy also sits on the altar, with « Te préparer ». The Pythia greets once per page
  // load (UI3 Ruling A9).
  import PlaceScene from '../components/scene/PlaceScene.svelte';
  import Hotspot from '../components/scene/Hotspot.svelte';
  import Overlay from '../components/scene/Overlay.svelte';
  import ProphecyCard from '../components/places/ProphecyCard.svelte';
  import PythiaPanel from '../components/places/delphi/PythiaPanel.svelte';
  import TabletsPanel from '../components/places/delphi/TabletsPanel.svelte';
  import { DELPHI_SCENE, pythiaGreeting } from '../lib/world/scenes/delphi';
  import { VOICES } from '../lib/world/voices';
  import { campStore } from '../lib/world/campStore.svelte';
  import { nearestProphecy } from '../lib/world/prophecy';
  import { closePanel, go, openHotspot } from '../lib/scene/panelNav';
  import { hotspotSelector } from '../lib/scene/hotspotId';
  import { OVERLAY_TITLES, sceneHref, type PanelId } from '../lib/world/places';
  import { href } from '../lib/routes';
  import type { CampResponse } from '../lib/world/types';
  import type { HotspotDef } from '../lib/scene/types';
  import type { Profile } from '../lib/types';

  let { profile, panel }: { profile: Profile; panel: PanelId | null } = $props();

  let debug = $state(false);
  // The Pythia's line depends on this week's scrolls: she waits for /camp (PlaceScene loads it).
  const greet = (camp: CampResponse | null) => (camp ? pythiaGreeting(camp) : null);

  const activate = (def: HotspotDef) => openHotspot(def, profile.id);
  const close = () => closePanel(sceneHref('delphi', profile.id));
  const review = (textId: number) => go(href('play', { profileId: String(profile.id), textId: String(textId) }));
</script>

<PlaceScene {profile} scene={DELPHI_SCENE} bind:debug {greet}>
  {#snippet children(ctx)}
    {#each DELPHI_SCENE.hotspots as def (def.id)}
      <Hotspot {def} status={def.state(ctx)} sceneId="delphi" onActivate={activate} />
    {/each}
    {#if ctx.camp}
      {@const prophecy = nearestProphecy(ctx.camp)}
      {#if prophecy}
        <div class="altar-prophecy stage-text">
          <ProphecyCard {prophecy} onReview={review} testId="delphi-prophecy" />
        </div>
      {/if}
    {/if}
  {/snippet}
</PlaceScene>

{#if panel === 'pythie'}
  <Overlay variant="scroll" size="wide" title={OVERLAY_TITLES.pythie} testId="overlay-pythia" voice={campStore.data?.oracle.status === 'chosen' ? VOICES.pythiaChosen : VOICES.pythia} onClose={close} returnFocus={hotspotSelector('delphi', 'pythia')}>
    <PythiaPanel {profile} />
  </Overlay>
{:else if panel === 'tablettes'}
  <Overlay variant="table" size="wide" title={OVERLAY_TITLES.tablettes} testId="overlay-tablets" onClose={close} returnFocus={hotspotSelector('delphi', 'tablets')}>
    <TabletsPanel {profile} />
  </Overlay>
{/if}

<style>
  /* The nearest prophecy, laid on the altar under the tablet wall (playability #17: large enough to
     read from the sofa): clear of both places and their labels, above the dialogue dock (y 80). */
  .altar-prophecy {
    position: absolute;
    left: 53%;
    top: 64%;
    width: min(380px, 26%);
    min-width: 260px;
    z-index: 3;
  }
</style>
