<script lang="ts">
  // The hero's cabin (scenes UI spec §3, UI3 Ruling B6): the trophy shelf opens the rewards
  // (#/p/:id/cabane?panel=tresors), the journal the stats (#/p/:id/stats), the lyre the settings
  // (#/p/:id/settings). Displayed decor hangs on the walls; it reloads when the cabin opens and
  // whenever the shelf puts something on display or away. The hero panel lives here too
  // (#/p/:id/cabane?panel=heros, Ruling B2): the HUD's hero chip is its shortcut from every place.
  import { untrack } from 'svelte';
  import PlaceScene from '../components/scene/PlaceScene.svelte';
  import Hotspot from '../components/scene/Hotspot.svelte';
  import Overlay from '../components/scene/Overlay.svelte';
  import Medallion from '../components/juice/Medallion.svelte';
  import TrophiesPanel from '../components/places/cabin/TrophiesPanel.svelte';
  import JournalPanel from '../components/places/cabin/JournalPanel.svelte';
  import LyrePanel from '../components/places/cabin/LyrePanel.svelte';
  import HeroPanel from '../components/places/cabin/HeroPanel.svelte';
  import { CABIN_SCENE, DECOR_SLOTS } from '../lib/world/scenes/cabin';
  import { worldApi } from '../lib/world/api';
  import { closePanel, openHotspot } from '../lib/scene/panelNav';
  import { hotspotSelector } from '../lib/scene/hotspotId';
  import { OVERLAY_TITLES, sceneHref, type PanelId } from '../lib/world/places';
  import type { HotspotDef } from '../lib/scene/types';
  import type { RewardOut } from '../lib/world/types';
  import type { Profile } from '../lib/types';

  let { profile, panel }: { profile: Profile; panel: PanelId | null } = $props();

  let debug = $state(false);
  let owned = $state<RewardOut[]>([]);
  const displayed = $derived(owned.filter((r) => r.kind === 'decor' && r.equipped));

  // Only the hero id is tracked: the walls reload for a new hero, and on demand (onChange).
  let generation = 0;
  function loadWalls(id: number) {
    const mine = ++generation;
    worldApi
      .rewards(id)
      .then((list) => {
        if (mine === generation) owned = list;
      })
      .catch(() => {
        if (mine === generation) owned = [];
      });
  }
  $effect(() => loadWalls(profile.id));

  const activate = (def: HotspotDef) => openHotspot(def, profile.id);
  const close = () => closePanel(sceneHref('cabin', profile.id));

  // The journal and the lyre opened from the hero panel give focus back to its medallion when
  // their seal steps back there; opened from the room, to their own hotspot. Only a move INTO one
  // of them records where it came from, so a leaving overlay keeps its target during its fade.
  let openedFrom = $state<PanelId | null>(null);
  let lastPanel = untrack(() => panel);
  $effect(() => {
    const p = panel;
    if (p === lastPanel) return;
    if (p === 'journal' || p === 'lyre') openedFrom = lastPanel;
    lastPanel = p;
  });
  const fromHero = $derived(openedFrom === 'heros');
</script>

<PlaceScene {profile} scene={CABIN_SCENE} bind:debug>
  {#snippet children(ctx)}
    {#each displayed as r, i (r.id)}
      {@const slot = DECOR_SLOTS[i % DECOR_SLOTS.length]}
      <div class="cabin-decor" data-testid="cabin-decor-{r.id}" style="left:{slot.x}%;top:{slot.y}%">
        <Medallion rewardId={r.id} size={52} label={r.name} />
      </div>
    {/each}
    {#each CABIN_SCENE.hotspots as def (def.id)}
      <Hotspot {def} status={def.state(ctx)} sceneId="cabin" onActivate={activate} />
    {/each}
  {/snippet}
</PlaceScene>

{#if panel === 'tresors'}
  <Overlay variant="table" size="wide" title={OVERLAY_TITLES.tresors} testId="overlay-trophies" onClose={close} returnFocus={hotspotSelector('cabin', 'trophies')}>
    <TrophiesPanel {profile} onChange={() => loadWalls(profile.id)} />
  </Overlay>
{:else if panel === 'journal'}
  <Overlay variant="codex" title={OVERLAY_TITLES.journal} testId="overlay-journal" onClose={close} returnFocus={fromHero ? '[data-testid="hero-journal"]' : hotspotSelector('cabin', 'journal')}>
    <JournalPanel {profile} />
  </Overlay>
{:else if panel === 'lyre'}
  <Overlay variant="scroll" title={OVERLAY_TITLES.lyre} testId="overlay-lyre" onClose={close} returnFocus={fromHero ? '[data-testid="hero-settings"]' : hotspotSelector('cabin', 'lyre')}>
    <LyrePanel {profile} />
  </Overlay>
{:else if panel === 'heros'}
  <Overlay variant="scroll" title={OVERLAY_TITLES.heros} testId="overlay-heros" onClose={close} returnFocus={'[data-testid="hud-hero"]'}>
    <HeroPanel {profile} />
  </Overlay>
{/if}

<style>
  .cabin-decor {
    position: absolute;
    z-index: 2;
    transform: translate(-50%, -50%);
    pointer-events: none;
    filter: drop-shadow(0 3px 5px rgba(0, 0, 0, 0.4));
  }
</style>
