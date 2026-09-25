<script lang="ts">
  // Delphi (scenes UI spec §3): the Pythia on her tripod opens the weekly scrolls and the
  // prophecies (#/p/:id/delphes), the votive-tablet wall opens the quest board (#/p/:id/quetes).
  // The nearest prophecy also sits on the altar, with « Réviser ». The Pythia greets once per page
  // load (UI3 Ruling A9).
  import PlaceScene from '../components/scene/PlaceScene.svelte';
  import Hotspot from '../components/scene/Hotspot.svelte';
  import DialogueBox from '../components/scene/DialogueBox.svelte';
  import Overlay from '../components/scene/Overlay.svelte';
  import ProphecyCard from '../components/places/ProphecyCard.svelte';
  import PythiaPanel from '../components/places/delphi/PythiaPanel.svelte';
  import TabletsPanel from '../components/places/delphi/TabletsPanel.svelte';
  import { DELPHI_SCENE, pythiaGreeting } from '../lib/world/scenes/delphi';
  import { nearestProphecy } from '../lib/world/scenes/camp';
  import { campFor } from '../lib/world/campStore.svelte';
  import { closePanel, openHotspot } from '../lib/scene/panelNav';
  import { markGreetedKey, shouldGreetKey } from '../lib/scene/greeting';
  import { sceneHref, type PanelId } from '../lib/world/places';
  import { unlockAudio } from '../lib/juice/sfx';
  import { href } from '../lib/routes';
  import { navigate } from '../lib/router.svelte';
  import type { DialogueLine, HotspotDef } from '../lib/scene/types';
  import type { Profile } from '../lib/types';

  let { profile, panel }: { profile: Profile; panel: PanelId | null } = $props();

  let debug = $state(false);
  let greeting = $state<DialogueLine[] | null>(null);

  // The Pythia's line depends on this week's scrolls: wait for /camp (PlaceScene loads it). Only
  // used by the greeting effect below - the snippet's own `ctx.camp` covers everything else
  // (the hotspot states, the altar prophecy).
  const camp = $derived(campFor(profile.id));
  $effect(() => {
    const key = `delphi:${profile.id}`;
    if (!camp || debug || !shouldGreetKey(key)) return;
    markGreetedKey(key);
    greeting = pythiaGreeting(camp);
  });

  const activate = (def: HotspotDef) => openHotspot(def, profile.id);
  const close = () => closePanel(sceneHref('delphi', profile.id));

  function review(textId: number) {
    unlockAudio();
    navigate(href('play', { profileId: String(profile.id), textId: String(textId) }));
  }
</script>

<PlaceScene {profile} scene={DELPHI_SCENE} bind:debug>
  {#snippet children(ctx)}
    {#each DELPHI_SCENE.hotspots as def (def.id)}
      <Hotspot {def} status={def.state(ctx)} sceneId="delphi" onActivate={activate} />
    {/each}
    {#if ctx.camp}
      {@const prophecy = nearestProphecy(ctx.camp)}
      {#if prophecy}
        <div class="altar-prophecy">
          <ProphecyCard {prophecy} onReview={review} testId="delphi-prophecy" />
        </div>
      {/if}
    {/if}
    {#if greeting}
      <DialogueBox lines={greeting} onDone={() => (greeting = null)} />
    {/if}
  {/snippet}
</PlaceScene>

{#if panel === 'pythie'}
  <Overlay variant="scroll" size="wide" title="L'Oracle de Delphes" testId="overlay-pythia" onClose={close} returnFocus={'[data-testid="delphi-pythia"]'}>
    <PythiaPanel {profile} />
  </Overlay>
{:else if panel === 'tablettes'}
  <Overlay variant="scroll" size="wide" title="Le tableau des quêtes" testId="overlay-tablets" onClose={close} returnFocus={'[data-testid="delphi-tablets"]'}>
    <TabletsPanel {profile} />
  </Overlay>
{/if}

<style>
  /* The nearest prophecy, laid on the altar under the tablet wall (art x 54-78, y 66-78): clear of
     both places and their labels, above the dialogue dock (y 80). */
  .altar-prophecy {
    position: absolute;
    left: 54%;
    top: 66%;
    width: 24%;
    z-index: 3;
  }
</style>
