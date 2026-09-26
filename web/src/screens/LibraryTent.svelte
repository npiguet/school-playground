<script lang="ts">
  // The library tent (scenes UI spec §3): the shelves hold her texts, the desk, the lens and the
  // portal bring new ones in. Every object opens its legacy route as an overlay on this scene (UI3
  // Ruling A1): #/p/:id/parchemins = the shelves. Athena's owl greets once per page load (A9), and
  // speaks one of her hints again whenever she is tapped (immersion wave, playability #23).
  import PlaceScene from '../components/scene/PlaceScene.svelte';
  import Hotspot from '../components/scene/Hotspot.svelte';
  import Overlay from '../components/scene/Overlay.svelte';
  import ShelvesPanel from '../components/places/library/ShelvesPanel.svelte';
  import DeskPanel from '../components/places/library/DeskPanel.svelte';
  import LensPanel from '../components/places/library/LensPanel.svelte';
  import PortalPanel from '../components/places/library/PortalPanel.svelte';
  import PortalWorkPanel from '../components/places/library/PortalWorkPanel.svelte';
  import { LIBRARY_SCENE, owlGreeting, owlHint } from '../lib/world/scenes/library';
  import { VOICES } from '../lib/world/voices';
  import { closePanel, openHotspot } from '../lib/scene/panelNav';
  import { hotspotSelector } from '../lib/scene/hotspotId';
  import { href } from '../lib/routes';
  import { OVERLAY_TITLES, sceneHref, type PanelId } from '../lib/world/places';
  import type { HotspotDef } from '../lib/scene/types';
  import type { Profile } from '../lib/types';

  // `params.workId` (#/p/:id/alexandria/:workId) picks which work the portal overlay shows.
  let { profile, panel, params }: { profile: Profile; panel: PanelId | null; params: Record<string, string> } = $props();

  // The stage owns ?debug (PlaceScene holds no greeting while it is on).
  let debug = $state(false);
  // Athena's owl needs no camp data to speak.
  const greet = () => owlGreeting();

  let place: PlaceScene | undefined = $state();
  // Never the same hint twice in a row (owlHint).
  let lastHint = -1;
  function speak() {
    const { line, index } = owlHint(lastHint);
    lastHint = index;
    place?.say([line], hotspotSelector('library', 'owl'));
  }
  const activate = (def: HotspotDef) => (def.id === 'owl' ? speak() : openHotspot(def, profile.id));
  const close = () => closePanel(sceneHref('library', profile.id));
  // Final review M9: the seal on a work steps back one overlay, onto the works, exactly like
  // « Toutes les œuvres » (a tagged entry goes back to the portal, a deep link is replaced by it).
  const closeWork = () => closePanel(href('alexandria', { profileId: String(profile.id) }));
  const focusOn = (id: string) => hotspotSelector('library', id);

  // Fix round 1 #4: closing the work overlay lands back on the portal overlay, so focus should
  // return to the work card the player opened, not to the (now inert, behind the portal overlay)
  // `library-portal` hotspot. `params.workId` itself disappears the moment the route leaves
  // 'oeuvre' (back onto 'portail'), so it's captured here while still known rather than read
  // reactively at close time (same staleness risk `PortalWorkPanel` guards against for its own
  // `workId`, fix round 1 #2).
  let lastWorkId = $state('');
  // Fix round 2 finding 4: PortalPanel needs to know it is specifically returning *from that work*
  // (not just reopened fresh via the hotspot, which must not steal focus onto a card the player
  // never asked for). Only the exact 'oeuvre' -> 'portail' transition sets it; any other way into
  // 'portail' clears it.
  let previousPanel: PanelId | null = null;
  let returningFromWorkId = $state('');
  $effect(() => {
    if (params.workId) lastWorkId = params.workId;
    const from = previousPanel;
    previousPanel = panel;
    if (panel === 'portail') returningFromWorkId = from === 'oeuvre' ? lastWorkId : '';
  });
</script>

<PlaceScene bind:this={place} {profile} scene={LIBRARY_SCENE} bind:debug {greet}>
  {#snippet children(ctx)}
    {#each LIBRARY_SCENE.hotspots as def (def.id)}
      <Hotspot {def} status={def.state(ctx)} sceneId="library" onActivate={activate} />
    {/each}
  {/snippet}
</PlaceScene>

{#if panel === 'etageres'}
  <Overlay
    variant="table"
    size="wide"
    title={OVERLAY_TITLES.etageres}
    testId="overlay-shelves"
    onClose={close}
    returnFocus={focusOn('shelves')}
    voice={VOICES.shelves}
  >
    <ShelvesPanel {profile} />
  </Overlay>
{:else if panel === 'pupitre'}
  <Overlay
    variant="scroll"
    size="wide"
    title={OVERLAY_TITLES.pupitre}
    testId="overlay-desk"
    onClose={close}
    returnFocus={focusOn('desk')}
    voice={VOICES.desk}
  >
    <DeskPanel {profile} />
  </Overlay>
{:else if panel === 'loupe'}
  <Overlay
    variant="scroll"
    size="wide"
    title={OVERLAY_TITLES.loupe}
    testId="overlay-lens"
    onClose={close}
    returnFocus={focusOn('lens')}
    voice={VOICES.lens}
  >
    <LensPanel {profile} />
  </Overlay>
{:else if panel === 'portail'}
  <Overlay
    variant="codex"
    title={OVERLAY_TITLES.portail}
    testId="overlay-portal"
    onClose={close}
    returnFocus={focusOn('portal')}
    voice={VOICES.portal}
  >
    <PortalPanel {profile} focusWorkId={returningFromWorkId} />
  </Overlay>
{:else if panel === 'oeuvre'}
  <Overlay
    variant="codex"
    title={OVERLAY_TITLES.oeuvre}
    testId="overlay-portal-work"
    onClose={closeWork}
    returnFocus={`[data-testid="work-card"][data-work-id="${lastWorkId}"]`}
  >
    {#key params.workId}
      <PortalWorkPanel {profile} workId={params.workId ?? ''} />
    {/key}
  </Overlay>
{/if}
