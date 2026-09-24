<script lang="ts">
  // The camp as a hub scene (scenes UI spec §3 "Hub scene", §9 UI1): the painted camp with its
  // places (CAMP_SCENE hotspots, each routing to its unchanged pre-UI1 screen), the slim HUD, the
  // weekly goal banner, the Oracle's prophecy, the dragon's greeting and the hero panel overlay on
  // its own route (`?panel=heros`, plan Ruling 6).
  import { untrack } from 'svelte';
  import { fade } from 'svelte/transition';
  import SceneStage from '../components/scene/SceneStage.svelte';
  import SceneLayer from '../components/scene/SceneLayer.svelte';
  import Hotspot from '../components/scene/Hotspot.svelte';
  import Hud from '../components/scene/Hud.svelte';
  import DialogueBox from '../components/scene/DialogueBox.svelte';
  import Overlay from '../components/scene/Overlay.svelte';
  import Onboarding from '../components/Onboarding.svelte';
  import Avatar from '../components/Avatar.svelte';
  import {
    CAMP_DRAGON_LAYER,
    CAMP_SCENE,
    campGreeting,
    nearestProphecy as pickProphecy,
    prophecyWhen,
    weeklyCaption,
  } from '../lib/world/scenes/camp';
  import { campStore, loadCatalog, refreshCamp } from '../lib/world/campStore.svelte';
  import { TINT_FILTERS } from '../lib/world/dragon';
  import { ART } from '../lib/world/art';
  import { markGreeted, shouldGreet } from '../lib/scene/greeting';
  import type { DialogueLine, HotspotDef, SceneContext, SceneLayerDef } from '../lib/scene/types';
  import { initSound } from '../lib/juice/soundStore.svelte';
  import { playSfx, unlockAudio } from '../lib/juice/sfx';
  import { reducedMotion } from '../lib/juice/motion';
  import { clearProfile } from '../lib/profileStore.svelte';
  import { href } from '../lib/routes';
  import { navigate, router } from '../lib/router.svelte';
  import { closePanel, heroPanelHref, openPanel } from '../lib/scene/panelNav';
  import type { Profile } from '../lib/types';

  let { profile }: { profile: Profile } = $props();

  const profileId = $derived(String(profile.id));

  // Final review I2: depends on the profile id only. loadCatalog() reads campStore.catalog and
  // initSound() reads profile.settings; tracked, either would re-run this (a second /camp fetch,
  // a second initSound) as soon as the catalog arrived or a setting changed.
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
  const panel = $derived(router.route.query.panel ?? null);
  // Final review M11: SceneStage owns the ?debug flag and hands it back here.
  let debug = $state(false);

  let greeting = $state<DialogueLine[] | null>(null);
  $effect(() => {
    if (!camp || !profile.settings.onboarded || debug || !shouldGreet(profile.id)) return;
    markGreeted(profile.id);
    greeting = campGreeting(profile.name, camp);
  });

  const dragonLayer = $derived<SceneLayerDef | null>(
    camp
      ? { id: 'dragon', src: ART.dragon[camp.dragon.stage], alt: camp.dragon.name ?? 'Ton dragon', ...CAMP_DRAGON_LAYER }
      : null,
  );

  const nearestProphecy = $derived(camp ? pickProphecy(camp) : null);

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

  function activate(def: HotspotDef) {
    unlockAudio();
    playSfx('tap');
    leaveTo(href(def.target, { profileId }));
  }

  // UI3 Ruling A2: the shared overlay navigation (UI1's hero-panel tag, generalised).
  function openHero() {
    unlockAudio();
    playSfx('tap');
    openPanel(heroPanelHref(profile.id));
  }

  function closeHeroPanel() {
    closePanel(href('camp', { profileId }));
  }

  function review(textId: number) {
    navigate(href('play', { profileId, textId: String(textId) }));
  }
</script>

{#if !profile.settings.onboarded}
  <Onboarding {profile} />
{/if}

<SceneStage scene={CAMP_SCENE} {ctx} bind:debug>
  {#snippet hud()}
    <Hud {profile} {camp} onHero={openHero} />
  {/snippet}

  {#if dragonLayer && camp}
    <SceneLayer layer={dragonLayer} filter={TINT_FILTERS[camp.dragon.tint]} testId="camp-dragon-layer" />
  {/if}

  {#each CAMP_SCENE.hotspots as def (def.id)}
    <Hotspot {def} status={def.state(ctx)} sceneId="camp" onActivate={activate} />
  {/each}

  {#if camp}
    <!-- Playability #6, #7: a cloth ribbon centred under the « Le camp » plaque, in-world words,
         and three leaves that fill in as the week's parchments are defended. -->
    <p class="weekly" data-testid="camp-weekly">
      <span class="leaves" aria-hidden="true">
        {#each Array.from({ length: camp.weekly.target }, (_, i) => i) as i (i)}<span
            class="leaf"
            class:filled={i < camp.weekly.done}
          ></span>{/each}
      </span>
      <span>{weeklyCaption(camp.weekly)}</span>
    </p>
  {/if}

  <div class="camp-column" data-testid="camp-column">
    {#if camp}
      {#if nearestProphecy}
        <div class="kit-parchment prophecy" data-testid="camp-prophecy">
          <!-- Playability #16: the Pythia's words, no « dictée », no « jour(s) ». -->
          <p class="prophecy-text">
            <span class="prophecy-when">La Pythie a vu ton épreuve, {prophecyWhen(nearestProphecy.days_left)} :</span>
            <span class="prophecy-title">{nearestProphecy.title}</span>
          </p>
          <button type="button" class="kit-bronze" onclick={() => review(nearestProphecy!.text_id)}>Réviser</button>
        </div>
      {/if}
    {:else if campStore.loading}
      <p class="kit-parchment status">Les Muses préparent le camp…</p>
    {:else if campStore.error}
      <div class="kit-parchment status">
        <p>Impossible de rejoindre le camp : {campStore.error}</p>
        <button type="button" class="kit-bronze" onclick={() => refreshCamp(profile.id)}>Réessayer</button>
      </div>
    {/if}
  </div>

  {#if greeting}
    <DialogueBox lines={greeting} onDone={() => (greeting = null)} />
  {/if}
</SceneStage>

<!-- Onboarding takes precedence (fix wave 3): a deep link to ?panel=heros for a hero who hasn't
     been welcomed yet opens the panel only once the Muses' card has closed. -->
{#if panel === 'heros' && profile.settings.onboarded}
  <Overlay variant="scroll" title="Ton héros" testId="overlay-heros" onClose={closeHeroPanel} returnFocus={'[data-testid="hud-hero"]'}>
    <div class="hero-panel">
      <Avatar avatar={profile.avatar} size={72} ring />
      <p class="hero-name">{profile.name}</p>
      <!-- Playability #4: three bronze medallions, not a stack of settings buttons. -->
      <nav class="medallions" aria-label="Ton héros">
        <a class="medallion" data-testid="hero-settings" href={href('settings', { profileId })}>
          <span class="medallion-disc" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="34" height="34">
              <path d="M11 27C6 22 4 14 7 8c1-2 3-3 4-2M21 27c5-5 7-13 4-19-1-2-3-3-4-2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
              <path d="M7 10h18M10 27h12" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
              <path d="M13 10v17M16 10v17M19 10v17" stroke="currentColor" stroke-width="1.3" />
            </svg>
          </span>
          <span class="medallion-caption">Réglages</span>
        </a>
        <a class="medallion" data-testid="hero-journal" href={href('dossier', { profileId })}>
          <span class="medallion-disc" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="34" height="34">
              <path
                d="M7 6h8c1 0 1 1 1 2v18c0-1-1-2-2-2H7z M25 6h-8c-1 0-1 1-1 2v18c0-1 1-2 2-2h7z"
                fill="none"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linejoin="round"
              />
              <path d="M10 11h3M10 15h3M19 11h3M19 15h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
            </svg>
          </span>
          <span class="medallion-caption">Ton journal</span>
        </a>
        <a class="medallion" data-testid="hero-switch" href={href('profiles')} onclick={() => clearProfile()}>
          <span class="medallion-disc" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="34" height="34">
              <path d="M16 4l10 4v7c0 7-5 11-10 13C11 26 6 22 6 15V8z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" />
              <path d="M16 9v14M11 15h10" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </span>
          <span class="medallion-caption">Changer de héros</span>
        </a>
      </nav>
    </div>
  </Overlay>
{/if}

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
     « Réviser » out of view for a long prophecy title (the server allows up to 120 characters,
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
  .prophecy {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 8px 8px 12px;
  }
  .prophecy-text {
    flex: 1;
    min-width: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .prophecy-when {
    font-style: italic;
    font-size: 13px;
    line-height: 1.25;
  }
  .prophecy-title {
    font-weight: 700;
    font-size: 14px;
    line-height: 1.25;
    /* Clamp instead of scroll (round 1 review): a 120-char title (the server's own max, see
       schemas.py) is still just 2 lines. -webkit-line-clamp only clips the box visually - the
       full text stays in the DOM, so it's still exposed in full to assistive tech. */
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
  }
  .prophecy .kit-bronze {
    flex-shrink: 0;
    padding: 8px 12px;
    font-size: 15px;
  }
  .status p {
    margin: 0;
  }
  .status {
    margin: 0;
    padding: 8px 12px;
    font-size: 15px;
  }
  .hero-panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  .hero-name {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 20px;
  }
  .medallions {
    display: flex;
    justify-content: center;
    gap: 28px;
    margin-top: 4px;
  }
  .medallion {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    min-width: 96px;
    color: var(--ink);
    text-decoration: none;
  }
  .medallion-disc {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 68px;
    height: 68px;
    border-radius: 50%;
    border: 2px solid var(--bronze-dark);
    background: radial-gradient(circle at 35% 30%, var(--bronze-light), var(--bronze) 55%, var(--bronze-dark));
    color: var(--bronze-ink);
    box-shadow:
      inset 0 0 0 4px rgba(255, 240, 200, 0.2),
      0 4px 10px rgba(0, 0, 0, 0.3);
    transition: transform 0.1s ease;
  }
  .medallion:active .medallion-disc {
    transform: translateY(1px);
  }
  .medallion:focus-visible {
    outline: none;
  }
  .medallion:focus-visible .medallion-disc {
    outline: 3px solid var(--gold-light);
    outline-offset: 3px;
  }
  .medallion-caption {
    font-family: var(--font-body);
    font-weight: 700;
    font-size: 16px;
  }
  .exit-veil {
    position: fixed;
    inset: 0;
    z-index: 60;
    background: var(--night);
  }
</style>
