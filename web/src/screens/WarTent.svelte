<script lang="ts">
  // The war tent (scenes UI spec §3, UI3 Ruling B4): each lieutenant's portrait is pinned to a
  // parchment sheet (tap → the lieutenant's page, #/p/:id/monstres/:key), the map table holds
  // Éris's file (#/p/:id/dossier), the codex on its lectern the bestiary (#/p/:id/bestiaire). A
  // lieutenant asleep at the hero's class is a locked place: the dragon says why (carry #16/M9).
  // A portrait opens from a sheet, from the file or from a codex page, and a codex page from the
  // codex: each seal steps back to where it was opened, and focus follows.
  import PlaceScene from '../components/scene/PlaceScene.svelte';
  import Hotspot from '../components/scene/Hotspot.svelte';
  import Overlay from '../components/scene/Overlay.svelte';
  import PortraitPanel from '../components/places/war/PortraitPanel.svelte';
  import DossierPanel from '../components/places/war/DossierPanel.svelte';
  import CodexPanel from '../components/places/war/CodexPanel.svelte';
  import CodexPagePanel from '../components/places/war/CodexPagePanel.svelte';
  import { LIEUTENANT_NAMES, WAR_SCENE, isLieutenantKey } from '../lib/world/scenes/war';
  import { WAR_SHAPES } from '../lib/world/scenes/war.shapes';
  import { dragonSays } from '../lib/world/scenes/speakers';
  import { bandFor, dossierLine, sleepingLine } from '../lib/world/eris';
  import { VOICES, erisSays } from '../lib/world/voices';
  import { sayKey } from '../lib/dialogue/select';
  import { entry } from '../lib/world/bestiary';
  import { ART, trophyIcon } from '../lib/world/art';
  import { campFor } from '../lib/world/campStore.svelte';
  import { shapeBox } from '../lib/scene/geometry';
  import { closePanel, openHotspot } from '../lib/scene/panelNav';
  import { hotspotSelector } from '../lib/scene/hotspotId';
  import { openedFrom } from '../lib/scene/openedFrom.svelte';
  import { unlockAudio } from '../lib/juice/sfx';
  import { OVERLAY_TITLES, sceneHref, type PanelId } from '../lib/world/places';
  import { LIEUTENANT_ORDER } from '../lib/world/types';
  import type { HotspotDef } from '../lib/scene/types';
  import type { Profile } from '../lib/types';

  let { profile, panel, params }: { profile: Profile; panel: PanelId | null; params: Record<string, string> } = $props();

  let debug = $state(false);
  let place: PlaceScene | undefined = $state();
  const camp = $derived(campFor(profile.id));

  const sheets = LIEUTENANT_ORDER.map((key) => ({ key, box: shapeBox(WAR_SHAPES[key]) }));
  const key = $derived(params.key ?? '');
  const portraitTitle = $derived(isLieutenantKey(key) ? LIEUTENANT_NAMES[key] : OVERLAY_TITLES.portrait);
  // Ruling B10: Éris speaks her line for this lieutenant from the sheet's voice plate.
  // Before /camp answers (a cold deep link) she is already there, leafing through her notes, so
  // the plate never pops in late (review fix round 1).
  const portraitVoice = $derived.by(() => {
    if (!isLieutenantKey(key)) return null;
    const l = camp?.lieutenants.find((x) => x.key === key);
    // Final review I1: a lieutenant asleep at the hero's class, however its portrait was reached
    // (a codex page, a deep link), is explained by the dragon, as on its locked sheet.
    if (camp && l && !l.available) return dragonSays(camp.dragon, sleepingLine(key, profile.level));
    return erisSays(l ? dossierLine(key, bandFor(l)) : 'Éris feuillette son dossier…');
  });

  const pageTitle = $derived(entry(key)?.name ?? OVERLAY_TITLES.page);
  // Where the portrait and the page were each opened from (openedFrom, like every place): each seal
  // steps back there, and focus follows. The page keeps its origin when the portrait it opened
  // closes onto it, so the chain codex → page → portrait → close → close still knows the page came
  // from the codex (review fix round 1).
  const from = openedFrom(() => panel, ['portrait', 'page'], { page: ['portrait'] });
  const portraitFocus = $derived(
    from.of('portrait') === 'dossier'
      ? `[data-testid="dossier-row-${key}"]`
      : from.of('portrait') === 'page'
        ? '[data-testid="codex-page-lieutenant"]'
        : hotspotSelector('war', key),
  );
  const pageFocus = $derived(from.of('page') === 'codex' ? `[data-testid="bestiary-card-${key}"]` : hotspotSelector('war', 'bestiary'));

  // UI5 Ruling E12: Éris greets in her tent, from her portrait's frame (erisSays), once per page load.
  const greet = () => [sayKey('war.enter')];

  const activate = (def: HotspotDef) => openHotspot(def, profile.id);

  // The tap on a locked sheet never takes the stage's one-tap guard (Hotspot.svelte), so the other
  // places stay tappable after the dragon has spoken.
  function explainLocked(def: HotspotDef) {
    if (!camp || !isLieutenantKey(def.id)) return;
    unlockAudio();
    place?.say([dragonSays(camp.dragon, sleepingLine(def.id, profile.level))], hotspotSelector('war', def.id));
  }

  const close = () => closePanel(sceneHref('war', profile.id));
</script>

<PlaceScene bind:this={place} {profile} scene={WAR_SCENE} bind:debug {greet}>
  {#snippet children(ctx)}
    {#each sheets as s (s.key)}
      {@const l = ctx.camp?.lieutenants.find((x) => x.key === s.key)}
      <div
        class="war-sheet"
        class:asleep={l !== undefined && !l.available}
        data-testid="war-sheet-{s.key}"
        style="left:{s.box.x}%;top:{s.box.y}%;width:{s.box.w}%;height:{s.box.h}%"
        aria-hidden="true"
      >
        <img class="war-portrait" src={ART.lieutenants[s.key]} alt="" draggable="false" />
        <!-- Spec 2026-09-29 lieutenant levels §5 (R13): the seal won, its trophy; a plain outline before the first. -->
        {#if l?.available && l.level > 0}
          <img class="war-seal" src={trophyIcon(s.key, l.level)} alt="" draggable="false" data-level={l.level} />
        {:else if l?.available}
          <span class="war-seal is-outline" data-level="0"></span>
        {/if}
      </div>
    {/each}
    {#each WAR_SCENE.hotspots as def (def.id)}
      <Hotspot {def} status={def.state(ctx)} sceneId="war" onActivate={activate} onLocked={explainLocked} />
    {/each}
  {/snippet}
</PlaceScene>

{#if panel === 'portrait'}
  <Overlay variant="scroll" size="wide" title={portraitTitle} testId="overlay-portrait" voice={portraitVoice} onClose={close} returnFocus={portraitFocus}>
    {#key key}
      <PortraitPanel {profile} lieutenantKey={key} />
    {/key}
  </Overlay>
{:else if panel === 'dossier'}
  <Overlay variant="table" size="wide" title={OVERLAY_TITLES.dossier} testId="overlay-dossier" onClose={close} returnFocus={hotspotSelector('war', 'dossier')}>
    <DossierPanel {profile} />
  </Overlay>
{:else if panel === 'codex'}
  <Overlay variant="codex" title={OVERLAY_TITLES.codex} testId="overlay-codex" voice={VOICES.bestiary} onClose={close} returnFocus={hotspotSelector('war', 'bestiary')}>
    <CodexPanel {profile} />
  </Overlay>
{:else if panel === 'page'}
  <Overlay variant="codex" title={pageTitle} testId="overlay-codex-page" onClose={close} returnFocus={pageFocus}>
    {#key key}
      <CodexPagePanel {profile} entryKey={key} />
    {/key}
  </Overlay>
{/if}

<style>
  /* A lieutenant's painted cut-out on its blank sheet (the sheets are part of the art); the name is
     inked on the sheet by the hotspot's `on` label. Under the hotspots (z 3). */
  .war-sheet {
    position: absolute;
    z-index: 2;
    overflow: hidden;
    pointer-events: none;
  }
  .war-sheet .war-portrait {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: 50% 10%;
    mix-blend-mode: multiply;
  }
  .war-sheet.asleep .war-portrait {
    filter: grayscale(1);
    opacity: 0.45;
  }
  /* The seal won on this lieutenant: its trophy pinned to the sheet's corner (R13). */
  .war-seal {
    position: absolute;
    top: 4%;
    right: 6%;
    width: 32%;
    aspect-ratio: 1;
    object-fit: contain;
    filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.45));
  }
  /* Before the first seal: its place, a plain outline. */
  .war-seal.is-outline {
    width: 24%;
    border-radius: 50%;
    border: 2px dashed var(--bronze-dark);
    opacity: 0.55;
    filter: none;
  }
</style>
