<script lang="ts">
  // The library tent (scenes UI spec §3): the shelves hold her texts, the desk, the lens and the
  // portal bring new ones in. Every object opens its legacy route as an overlay on this scene (UI3
  // Ruling A1): #/p/:id/parchemins = the shelves. Athena's owl greets once per page load (A9).
  import PlaceScene from '../components/scene/PlaceScene.svelte';
  import Hotspot from '../components/scene/Hotspot.svelte';
  import DialogueBox from '../components/scene/DialogueBox.svelte';
  import Overlay from '../components/scene/Overlay.svelte';
  import ShelvesPanel from '../components/places/library/ShelvesPanel.svelte';
  import DeskPanel from '../components/places/library/DeskPanel.svelte';
  import LensPanel from '../components/places/library/LensPanel.svelte';
  import PortalPanel from '../components/places/library/PortalPanel.svelte';
  import PortalWorkPanel from '../components/places/library/PortalWorkPanel.svelte';
  import { LIBRARY_SCENE, owlGreeting } from '../lib/world/scenes/library';
  import { closePanel, openHotspot } from '../lib/scene/panelNav';
  import { markGreetedKey, shouldGreetKey } from '../lib/scene/greeting';
  import { sceneHref, type PanelId } from '../lib/world/places';
  import type { DialogueLine, HotspotDef } from '../lib/scene/types';
  import type { Profile } from '../lib/types';

  // `params.workId` (#/p/:id/alexandria/:workId) picks which work the portal overlay shows.
  let { profile, panel, params }: { profile: Profile; panel: PanelId | null; params: Record<string, string> } = $props();

  // Final review M11: the stage owns ?debug; no greeting while it is on.
  let debug = $state(false);
  let greeting = $state<DialogueLine[] | null>(null);
  $effect(() => {
    const key = `library:${profile.id}`;
    if (debug || !shouldGreetKey(key)) return;
    markGreetedKey(key);
    greeting = owlGreeting();
  });

  const activate = (def: HotspotDef) => openHotspot(def, profile.id);
  const close = () => closePanel(sceneHref('library', profile.id));

  // Fix round 1 #4: closing the work overlay lands back on the portal overlay, so focus should
  // return to the work card the player opened, not to the (now inert, behind the portal overlay)
  // `library-portal` hotspot. `params.workId` itself disappears the moment the route leaves
  // 'oeuvre' (back onto 'portail'), so it's captured here while still known rather than read
  // reactively at close time (same staleness risk `PortalWorkPanel` guards against for its own
  // `workId`, fix round 1 #2).
  let lastWorkId = $state('');
  $effect(() => {
    if (params.workId) lastWorkId = params.workId;
  });
</script>

<PlaceScene {profile} scene={LIBRARY_SCENE} bind:debug>
  {#snippet children(ctx)}
    {#each LIBRARY_SCENE.hotspots as def (def.id)}
      <Hotspot {def} status={def.state(ctx)} sceneId="library" onActivate={activate} />
    {/each}
    {#if greeting}
      <DialogueBox lines={greeting} onDone={() => (greeting = null)} />
    {/if}
  {/snippet}
</PlaceScene>

{#if panel === 'etageres'}
  <Overlay variant="scroll" size="wide" title="Les Parchemins" testId="overlay-shelves" onClose={close} returnFocus={'[data-testid="library-shelves"]'}>
    <ShelvesPanel {profile} />
  </Overlay>
{:else if panel === 'pupitre'}
  <Overlay variant="scroll" title="Nouveau parchemin" testId="overlay-desk" onClose={close} returnFocus={'[data-testid="library-desk"]'}>
    <DeskPanel {profile} />
  </Overlay>
{:else if panel === 'loupe'}
  <Overlay variant="scroll" size="wide" title="Scanner une feuille" testId="overlay-lens" onClose={close} returnFocus={'[data-testid="library-lens"]'}>
    <LensPanel {profile} />
  </Overlay>
{:else if panel === 'portail'}
  <Overlay variant="scroll" size="wide" title="Bibliothèque d'Alexandrie" testId="overlay-portal" onClose={close} returnFocus={'[data-testid="library-portal"]'}>
    <PortalPanel {profile} />
  </Overlay>
{:else if panel === 'oeuvre'}
  <Overlay
    variant="scroll"
    size="wide"
    title="Bibliothèque d'Alexandrie"
    testId="overlay-portal-work"
    onClose={close}
    returnFocus={`[data-testid="work-card"][data-work-id="${lastWorkId}"]`}
  >
    {#key params.workId}
      <PortalWorkPanel {profile} workId={params.workId ?? ''} />
    {/key}
  </Overlay>
{/if}
