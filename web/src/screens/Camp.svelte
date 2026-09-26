<script lang="ts">
  // The camp as a hub scene on hub_camp.webp (scenes UI spec §3 "Hub scene", UI3 Ruling B3): the
  // painted camp with its six places (CAMP_SCENE hotspots, each routing to its place), the slim HUD,
  // the weekly goal banner and the dragon's greeting. The hero panel lives in the cabin: `?panel=heros`
  // (plan Ruling 6) hands over to it (UI3 Ruling B2). Built on PlaceScene like every other place (final
  // review M2): the data load, the HUD, the greeting and the "camp unreachable" state are shared; what
  // is the camp's own is the dragon in its nest, the ribbon, the locked path to battle explaining
  // itself, the fade out to the next scene and having no exit sign (it is where the others lead).
  import { fade } from 'svelte/transition';
  import PlaceScene from '../components/scene/PlaceScene.svelte';
  import SceneLayer from '../components/scene/SceneLayer.svelte';
  import Hotspot from '../components/scene/Hotspot.svelte';
  import Onboarding from '../components/Onboarding.svelte';
  import { CAMP_SCENE, bossLockLine, campDragonLayer, campGreeting, weeklyCaption } from '../lib/world/scenes/camp';
  import { dragonSays } from '../lib/world/scenes/speakers';
  import { campFor } from '../lib/world/campStore.svelte';
  import { TINT_FILTERS, dragonCaption } from '../lib/world/dragon';
  import { ART } from '../lib/world/art';
  import type { CampResponse } from '../lib/world/types';
  import type { HotspotDef, SceneLayerDef } from '../lib/scene/types';
  import { playSfx, unlockAudio } from '../lib/juice/sfx';
  import { reducedMotion } from '../lib/juice/motion';
  import { navigate } from '../lib/router.svelte';
  import { heroPanelHref, hotspotHref, openPanel, replacePanel } from '../lib/scene/panelNav';
  import { hotspotSelector } from '../lib/scene/hotspotId';
  import type { PanelId } from '../lib/world/places';
  import type { Profile } from '../lib/types';

  // `panel` comes from placeFor, like every other place (final review M2).
  let { profile, panel }: { profile: Profile; panel: PanelId | null } = $props();

  // SceneStage owns the ?debug flag and hands it back through PlaceScene.
  let debug = $state(false);
  let place: PlaceScene | undefined = $state();

  // The dragon waits for the Muses' welcome card (Onboarding) before it speaks.
  const greet = (camp: CampResponse | null) =>
    camp && profile.settings.onboarded ? campGreeting(profile.name, camp) : null;

  function dragonLayer(camp: CampResponse): SceneLayerDef {
    return { id: 'dragon', src: ART.dragon[camp.dragon.stage], alt: dragonCaption(camp.dragon), ...campDragonLayer(camp.dragon.stage) };
  }

  // Playability #12: leaving the hub fades through the night before the next screen appears
  // (App.svelte fades the dark back out on arrival).
  // Idempotent, and the timer dies with the camp: a browser Back inside the fade must not be
  // overridden by a navigation that was still pending (fix wave 2).
  let leaving = $state(false);
  let leaveTimer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => () => clearTimeout(leaveTimer));
  // `panel`: an overlay of another place (the hero panel from the HUD chip) opens as a tagged
  // push, so its seal steps back to the camp (the cross-place overlay rule, panelNav.ts `go`).
  function leaveTo(path: string, mode: 'push' | 'panel' = 'push') {
    if (leaving) return;
    leaving = true;
    leaveTimer = setTimeout(() => (mode === 'panel' ? openPanel(path) : navigate(path)), reducedMotion() ? 60 : 180);
  }

  function openHero(path: string) {
    unlockAudio();
    playSfx('tap');
    leaveTo(path, 'panel');
  }

  // The tap sounds at once; the navigation waits for the fade (so not `go()`, which navigates now).
  function activate(def: HotspotDef) {
    const to = hotspotHref(def, profile.id);
    if (!to) return;
    unlockAudio();
    playSfx('tap');
    leaveTo(to);
  }

  // UI3 Ruling B3, carry #16/M9: the locked path to battle says how many tricks remain, in the
  // dragon's words. The tap on the locked path never takes the stage's one-tap guard (Hotspot.svelte).
  function explainLocked() {
    const camp = campFor(profile.id);
    if (!camp) return;
    unlockAudio();
    place?.say([dragonSays(camp.dragon, bossLockLine(camp))], hotspotSelector('camp', 'boss'));
  }

  // UI3 Ruling B2: `?panel=heros` stays a route; once the Muses' welcome is over (fix wave 3: the
  // onboarding takes precedence) it hands over to the hero panel in the cabin. replacePanel keeps a
  // tagged entry tagged, so the panel's seal still steps back to where it was opened.
  $effect(() => {
    if (panel === 'heros' && profile.settings.onboarded) replacePanel(heroPanelHref(profile.id));
  });
</script>

{#if !profile.settings.onboarded}
  <Onboarding {profile} />
{/if}

<PlaceScene bind:this={place} {profile} scene={CAMP_SCENE} bind:debug showExit={false} {greet} onHero={openHero}>
  {#snippet children(ctx)}
    {#if ctx.camp}
      <SceneLayer layer={dragonLayer(ctx.camp)} filter={TINT_FILTERS[ctx.camp.dragon.tint]} testId="camp-dragon-layer" />
    {/if}

    {#each CAMP_SCENE.hotspots as def (def.id)}
      <Hotspot {def} status={def.state(ctx)} sceneId="camp" onActivate={activate} onLocked={explainLocked} />
    {/each}

    {#if ctx.camp}
      <!-- Playability #6, #7: a cloth ribbon under the « Le camp » plaque, in-world words,
           and three leaves that fill in as the week's parchments are defended. -->
      <p class="weekly stage-text" data-testid="camp-weekly">
        <span class="leaves" aria-hidden="true">
          {#each Array.from({ length: ctx.camp.weekly.target }, (_, i) => i) as i (i)}<span
              class="leaf"
              class:filled={i < ctx.camp.weekly.done}
            ></span>{/each}
        </span>
        <span>{weeklyCaption(ctx.camp.weekly)}</span>
      </p>
    {/if}
  {/snippet}
</PlaceScene>

{#if leaving}
  <div class="exit-veil" data-testid="exit-veil" aria-hidden="true" in:fade={{ duration: 180 }}></div>
{/if}

<style>
  /* The weekly ribbon (playability #7): under the « Le camp » plaque (top 9.5 %), in the
     open sky of hub_camp.webp (docs/art/scenes.md: x 40-65, y 8-20), clear of every place and
     plaque (scenes-camp.spec.ts measures it). Centred at x 51.5 %, top 16 %, with slimmer notched
     ends: at 1280x720 (the widest ribbon in art %, five leaves) it clears the temple's box (right
     edge x 36) and ends above the battle arch's (top y 22), at least 4 px clear of both at every
     size. Notched cloth ends, not the pill of a toast notification. */
  .weekly {
    position: absolute;
    left: 51.5%;
    top: 16%;
    transform: translateX(-50%);
    z-index: 3;
    margin: 0;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 6px 20px;
    white-space: nowrap;
    font-family: var(--font-body);
    font-size: 15px;
    color: var(--bronze-ink);
    background: linear-gradient(180deg, #5b3d26, #3e2818 60%, #33200f);
    box-shadow:
      inset 0 2px 0 rgba(200, 148, 80, 0.55),
      inset 0 -2px 0 rgba(200, 148, 80, 0.55);
    clip-path: polygon(0 0, 100% 0, calc(100% - 14px) 50%, 100% 100%, 0 100%, 14px 50%);
    filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.35));
  }
  .leaves {
    display: inline-flex;
    gap: 3px;
  }
  .leaf {
    width: 10px;
    height: 16px;
    box-sizing: border-box;
    border-radius: 100% 0;
    border: 1px solid rgba(200, 148, 80, 0.8);
    background: rgba(200, 148, 80, 0.12);
    transform: rotate(-30deg);
  }
  .leaf.filled {
    border-color: var(--bronze-dark);
    background: linear-gradient(135deg, var(--gold-light), var(--gold));
  }
  .exit-veil {
    position: fixed;
    inset: 0;
    z-index: 60;
    background: var(--night);
  }
</style>
