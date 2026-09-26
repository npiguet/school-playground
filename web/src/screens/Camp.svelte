<script lang="ts">
  // The camp as a hub scene (scenes UI spec §3 "Hub scene", §9 UI1): the painted camp with its
  // places (CAMP_SCENE hotspots, each routing to its screen), the slim HUD, the weekly goal banner,
  // the Oracle's prophecy and the dragon's greeting; `?panel=heros` (plan Ruling 6) hands over to
  // the hero panel in the cabin (UI3 Ruling B2). Built on PlaceScene like every other place (final review M2):
  // the data load, the HUD, the greeting and the "camp unreachable" state are shared; what is the
  // camp's own is the dragon, the ribbon, the prophecy column, the fade out to the next scene and
  // having no exit sign (it is where the others lead).
  import { fade } from 'svelte/transition';
  import PlaceScene from '../components/scene/PlaceScene.svelte';
  import SceneLayer from '../components/scene/SceneLayer.svelte';
  import Hotspot from '../components/scene/Hotspot.svelte';
  import ProphecyCard from '../components/places/ProphecyCard.svelte';
  import Onboarding from '../components/Onboarding.svelte';
  import { CAMP_DRAGON_LAYER, CAMP_SCENE, campGreeting, weeklyCaption } from '../lib/world/scenes/camp';
  import { nearestProphecy } from '../lib/world/prophecy';
  import { TINT_FILTERS } from '../lib/world/dragon';
  import { ART } from '../lib/world/art';
  import type { CampResponse } from '../lib/world/types';
  import type { HotspotDef, SceneLayerDef } from '../lib/scene/types';
  import { playSfx, unlockAudio } from '../lib/juice/sfx';
  import { reducedMotion } from '../lib/juice/motion';
  import { href } from '../lib/routes';
  import { navigate } from '../lib/router.svelte';
  import { go, heroPanelHref, hotspotHref, replacePanel } from '../lib/scene/panelNav';
  import type { PanelId } from '../lib/world/places';
  import type { Profile } from '../lib/types';

  // `panel` comes from placeFor, like every other place (final review M2).
  let { profile, panel }: { profile: Profile; panel: PanelId | null } = $props();

  const profileId = $derived(String(profile.id));
  // SceneStage owns the ?debug flag and hands it back through PlaceScene.
  let debug = $state(false);

  // The dragon waits for the Muses' welcome card (Onboarding) before it speaks.
  const greet = (camp: CampResponse | null) =>
    camp && profile.settings.onboarded ? campGreeting(profile.name, camp) : null;

  function dragonLayer(camp: CampResponse): SceneLayerDef {
    return { id: 'dragon', src: ART.dragon[camp.dragon.stage], alt: camp.dragon.name ?? 'Ton dragon', ...CAMP_DRAGON_LAYER };
  }

  // Playability #12: leaving the hub fades through the night before the next screen appears
  // (App.svelte fades the dark back out on arrival).
  // Idempotent, and the timer dies with the camp: a browser Back inside the fade must not be
  // overridden by a navigation that was still pending (fix wave 2).
  let leaving = $state(false);
  let leaveTimer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => () => clearTimeout(leaveTimer));
  function leaveTo(path: string) {
    if (leaving) return;
    leaving = true;
    leaveTimer = setTimeout(() => navigate(path), reducedMotion() ? 60 : 180);
  }

  // The tap sounds at once; the navigation waits for the fade (so not `go()`, which navigates now).
  function activate(def: HotspotDef) {
    const to = hotspotHref(def, profile.id);
    if (!to) return;
    unlockAudio();
    playSfx('tap');
    leaveTo(to);
  }

  // UI3 Ruling B2: `?panel=heros` stays a route; once the Muses' welcome is over (fix wave 3: the
  // onboarding takes precedence) it hands over to the hero panel in the cabin. replacePanel keeps a
  // tagged entry tagged, so the panel's seal still steps back to where it was opened.
  $effect(() => {
    if (panel === 'heros' && profile.settings.onboarded) replacePanel(heroPanelHref(profile.id));
  });
  const review = (textId: number) => go(href('play', { profileId, textId: String(textId) }));
</script>

{#if !profile.settings.onboarded}
  <Onboarding {profile} />
{/if}

<PlaceScene {profile} scene={CAMP_SCENE} bind:debug showExit={false} {greet}>
  {#snippet children(ctx)}
    {#if ctx.camp}
      <SceneLayer layer={dragonLayer(ctx.camp)} filter={TINT_FILTERS[ctx.camp.dragon.tint]} testId="camp-dragon-layer" />
    {/if}

    {#each CAMP_SCENE.hotspots as def (def.id)}
      <Hotspot {def} status={def.state(ctx)} sceneId="camp" onActivate={activate} />
    {/each}

    {#if ctx.camp}
      <!-- Playability #6, #7: a cloth ribbon centred under the « Le camp » plaque, in-world words,
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

    <div class="camp-column stage-text" data-testid="camp-column">
      {#if ctx.camp}
        {@const prophecy = nearestProphecy(ctx.camp)}
        {#if prophecy}
          <ProphecyCard {prophecy} onReview={review} testId="camp-prophecy" compact />
        {/if}
      {/if}
    </div>
  {/snippet}
</PlaceScene>

{#if leaving}
  <div class="exit-veil" data-testid="exit-veil" aria-hidden="true" in:fade={{ duration: 180 }}></div>
{/if}

<style>
  /* The weekly ribbon (playability #7): centred under the « Le camp » plaque (top 9.5 %), in the
     sky band that no hotspot or label reaches (every label sits below y 24 %, see camp.shapes.ts
     and the column-overlap e2e test, which measures this banner too). Notched cloth ends, not the
     pill of a toast notification. */
  .weekly {
    position: absolute;
    left: 50%;
    top: 16.5%;
    transform: translateX(-50%);
    z-index: 3;
    margin: 0;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 6px 30px;
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
  /* Positioned in the zone free of every CAMP_HOTSPOTS shape box AND label (see camp.shapes.ts):
     a hotspot's label pill is wider than its shape and was measured (?debug, real boundingBox()es
     at both 1180x820 and 1366x1024) rather than assumed, since "below"/"above" labels extend well
     past their shape's own box. x 32-53.5% clears oracle's label (clamped into the safe zone, its right
     edge now reaches ~31.4% at 1280x720) and quests' label (left edge down to ~54.7% at 1280x720); y 23% starts under the weekly ribbon,
     and the prophecy card (text beside its button) ends well above the parchemins label.
     No `overflow`/`max-height` here on purpose (round 1 review): that combination scrolled
     « Te préparer » out of view for a long prophecy title (the server allows up to 120 characters,
     server/app/schemas.py). The title is `-webkit-line-clamp`-ed instead, which bounds its own
     height regardless of title length, so the button beside it is always laid out and visible. */
  .camp-column {
    position: absolute;
    left: 32%;
    top: 23%;
    width: 21.5%;
    z-index: 3;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  .exit-veil {
    position: fixed;
    inset: 0;
    z-index: 60;
    background: var(--night);
  }
</style>
