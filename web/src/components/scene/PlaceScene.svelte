<script lang="ts">
  // The shell of every place scene but the title (UI3 Ruling A7), the camp included (final review
  // M2): the stage, the slim HUD and its hero chip, the exit sign (not at the camp, which is where
  // it leads), the /camp data the HUD and the hotspot states read, what the scene shows while that
  // data loads or cannot be reached (M4), and the place's greeting, once per hero per page load
  // (A9). The screen renders its hotspots, layers and in-scene objects through `children(ctx)`,
  // inside the art box; its overlays are rendered next to this component (they are
  // fixed-position).
  import { tick, untrack, type Snippet } from 'svelte';
  import { fade } from 'svelte/transition';
  import SceneStage from './SceneStage.svelte';
  import Hud from './Hud.svelte';
  import SceneExit from './SceneExit.svelte';
  import DialogueBox from './DialogueBox.svelte';
  import { campFor, campStore, loadCatalog, refreshCamp } from '../../lib/world/campStore.svelte';
  import { initSound } from '../../lib/juice/soundStore.svelte';
  import { go, heroPanelHref } from '../../lib/scene/panelNav';
  import { reducedMotion } from '../../lib/juice/motion';
  import { greetKey, markGreeted, shouldGreet } from '../../lib/scene/greeting';
  import type { DialogueLine, SceneContext, SceneDef } from '../../lib/scene/types';
  import type { CampResponse } from '../../lib/world/types';
  import type { Profile } from '../../lib/types';

  let {
    profile,
    scene,
    debug = $bindable(false),
    showExit = true,
    greet,
    onHero,
    children,
  }: {
    profile: Profile;
    scene: SceneDef;
    debug?: boolean;
    /** The « Le camp » sign; the camp itself has none. */
    showExit?: boolean;
    /** The place's greeting: its lines, or null while it is not ready to greet yet (e.g. the camp
     *  data has not arrived). Called inside an effect, so what it reads is tracked. */
    greet?: (camp: CampResponse | null) => DialogueLine[] | null;
    /** Opens the hero panel from the HUD chip. By default a place other than the cabin fades to
     *  night first (UI3b playability #18: the hero panel lives in the cabin, Ruling B2, and the cabin
     *  then rises behind its scroll, App.svelte, instead of cutting in); the camp routes it through
     *  its own night fade, like its other ways out (final review M13). */
    onHero?: (path: string) => void;
    children: Snippet<[SceneContext]>;
  } = $props();

  // Final review I2: depends on the profile id only. loadCatalog() reads campStore.catalog and
  // initSound() reads profile.settings; tracked, either would re-run this (a second /camp fetch,
  // a second initSound) as soon as the catalog arrived or a setting changed. A derived id (UI4 M6):
  // `profile.id` read in the effect would track the whole `profile` prop, so a new profile object
  // for the same hero (loadProfile after a session) would fetch again.
  const heroId = $derived(profile.id);
  $effect(() => {
    const id = heroId;
    untrack(() => {
      initSound(profile);
      void refreshCamp(id);
      void loadCatalog();
    });
  });

  // campStore is shared across profiles: ignore a snapshot that belongs to the previous hero.
  const camp = $derived(campFor(profile.id));
  const ctx = $derived<SceneContext>({ camp, catalog: campStore.catalog });

  // No greeting while ?debug is on (final review M11 of UI1: the stage owns the flag).
  let greeting = $state<DialogueLine[] | null>(null);
  $effect(() => {
    if (!greet || debug) return;
    const key = greetKey(scene.id, profile.id);
    if (!shouldGreet(key)) return;
    const lines = greet(camp);
    if (!lines) return;
    markGreeted(key);
    greeting = lines;
  });

  // The element whose tap asked for the lines on show (a selector, since the tap may not have
  // focused it: WebKit never focuses a clicked button), or null for the greeting.
  let saidFrom: string | null = null;

  /** A line the screen asks for on a tap (the library owl, playability #23, a locked place): shown
   *  in the same box as the greeting, replacing whatever it was saying. `returnFocus` is the
   *  selector of what asked (its hotspot): once the line is dismissed, focus goes back there
   *  instead of falling to <body> with the box (UI3b Task 7 review). */
  export function say(lines: DialogueLine[], returnFocus?: string) {
    saidFrom = returnFocus ?? null;
    greeting = lines;
  }

  async function dialogueDone() {
    const back = saidFrom;
    saidFrom = null;
    greeting = null;
    if (!back) return;
    await tick();
    // Only when focus was in the box (now gone) or nowhere: never pull it from where the player
    // has since moved it.
    const active = document.activeElement;
    if (active && active !== document.body) return;
    (document.querySelector(back) as HTMLElement | null)?.focus();
  }

  // Idempotent, and the timer dies with the place: a browser Back inside the fade wins.
  let toHero = $state(false);
  let heroTimer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => () => clearTimeout(heroTimer));
  function openHero() {
    const path = heroPanelHref(profile.id);
    if (onHero) return onHero(path);
    if (scene.id === 'cabin') return go(path, 'panel');
    if (toHero) return;
    toHero = true;
    heroTimer = setTimeout(() => go(path, 'panel'), reducedMotion() ? 60 : 180);
  }
</script>

<SceneStage {scene} {ctx} bind:debug>
  {#snippet hud()}
    <Hud {profile} {camp} onHero={openHero} />
  {/snippet}
  {@render children(ctx)}
  {#if !camp}
    <!-- Final review M4: every place, not only the camp, says when the camp data is on its way or
         out of reach, and offers to try again. -->
    {#if campStore.error && !campStore.loading}
      <div class="kit-parchment place-status stage-text" role="alert" data-testid="place-status">
        <p>Impossible de rejoindre le camp : {campStore.error}</p>
        <button type="button" class="kit-bronze" data-testid="place-retry" onclick={() => refreshCamp(profile.id)}>Réessayer</button>
      </div>
    {:else if campStore.loading}
      <p class="kit-parchment place-status stage-text" data-testid="place-status">Les Muses préparent le camp…</p>
    {/if}
  {/if}
  {#if greeting}
    <!-- Keyed: a new line (the owl tapped again) restarts the box from its first line. -->
    {#key greeting}
      <DialogueBox lines={greeting} onDone={dialogueDone} />
    {/key}
  {/if}
  {#if showExit}
    <SceneExit profileId={profile.id} />
  {/if}
</SceneStage>

{#if toHero}
  <div class="hero-veil" data-testid="hero-veil" aria-hidden="true" in:fade={{ duration: 180 }}></div>
{/if}

<style>
  /* Under the place's plaque, in the sky band every scene keeps free of hotspots (the camp's
     weekly ribbon sits there once the data has arrived; this only shows before). */
  .place-status {
    position: absolute;
    left: 50%;
    top: 23%;
    transform: translateX(-50%);
    z-index: 3;
    width: max-content;
    max-width: 40%;
    margin: 0;
    padding: 8px 12px;
    font-size: 15px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    text-align: center;
  }
  .place-status p {
    margin: 0;
  }
  /* The night the hero chip fades through on its way to the cabin (Camp.svelte's exit veil). */
  .hero-veil {
    position: fixed;
    inset: 0;
    z-index: 60;
    background: var(--night);
  }
</style>
