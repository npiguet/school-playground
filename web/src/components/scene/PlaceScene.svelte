<script lang="ts">
  // The shell of every place scene but the title (UI3 Ruling A7): the stage, the slim HUD, the
  // exit sign, and the /camp data the HUD and the hotspot states read. The screen renders its
  // hotspots, layers and in-scene objects through `children(ctx)`, inside the art box; its
  // overlays are rendered next to this component (they are fixed-position, like the camp's).
  import { untrack, type Snippet } from 'svelte';
  import SceneStage from './SceneStage.svelte';
  import Hud from './Hud.svelte';
  import SceneExit from './SceneExit.svelte';
  import { campStore, loadCatalog, refreshCamp } from '../../lib/world/campStore.svelte';
  import { initSound } from '../../lib/juice/soundStore.svelte';
  import { playSfx, unlockAudio } from '../../lib/juice/sfx';
  import { heroPanelHref, openPanel } from '../../lib/scene/panelNav';
  import type { SceneContext, SceneDef } from '../../lib/scene/types';
  import type { Profile } from '../../lib/types';

  let {
    profile,
    scene,
    debug = $bindable(false),
    children,
  }: { profile: Profile; scene: SceneDef; debug?: boolean; children: Snippet<[SceneContext]> } = $props();

  // Depends on the profile id only (same reasoning as Camp.svelte, final review I2).
  $effect(() => {
    const id = profile.id;
    untrack(() => {
      initSound(profile);
      void refreshCamp(id);
      void loadCatalog();
    });
  });

  // campStore is shared across profiles: ignore a snapshot that belongs to the previous hero.
  const camp = $derived(campStore.data && campStore.data.profile.id === profile.id ? campStore.data : null);
  const ctx = $derived<SceneContext>({ camp, catalog: campStore.catalog });

  function openHero() {
    unlockAudio();
    playSfx('tap');
    openPanel(heroPanelHref(profile.id));
  }
</script>

<SceneStage {scene} {ctx} bind:debug>
  {#snippet hud()}
    <Hud {profile} {camp} onHero={openHero} />
  {/snippet}
  {@render children(ctx)}
  <SceneExit profileId={profile.id} />
</SceneStage>
