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
  import { entry } from '../lib/world/bestiary';
  import { ART } from '../lib/world/art';
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

<PlaceScene bind:this={place} {profile} scene={WAR_SCENE} bind:debug>
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
        <img src={ART.lieutenants[s.key]} alt="" draggable="false" />
        {#if l?.neutralised}<span class="war-seal"></span>{/if}
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
  .war-sheet img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: 50% 10%;
    mix-blend-mode: multiply;
  }
  .war-sheet.asleep img {
    filter: grayscale(1);
    opacity: 0.45;
  }
  /* A gold seal pressed on a foiled lieutenant's sheet. */
  .war-seal {
    position: absolute;
    top: 6%;
    right: 8%;
    width: 30%;
    aspect-ratio: 1;
    border-radius: 50%;
    border: 2px solid var(--bronze-dark);
    background: radial-gradient(circle at 35% 30%, var(--gold-light), var(--gold) 70%);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  }
</style>
