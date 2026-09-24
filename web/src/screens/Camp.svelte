<script lang="ts">
  // The camp as a hub scene (scenes UI spec §3 "Hub scene", §9 UI1): the painted camp with its
  // places (CAMP_SCENE hotspots, each routing to its unchanged pre-UI1 screen), the slim HUD, the
  // weekly goal banner, the Oracle's prophecy, the dragon's greeting and the hero panel overlay on
  // its own route (`?panel=heros`, plan Ruling 6).
  import SceneStage from '../components/scene/SceneStage.svelte';
  import SceneLayer from '../components/scene/SceneLayer.svelte';
  import Hotspot from '../components/scene/Hotspot.svelte';
  import Hud from '../components/scene/Hud.svelte';
  import DialogueBox from '../components/scene/DialogueBox.svelte';
  import Overlay from '../components/scene/Overlay.svelte';
  import Onboarding from '../components/Onboarding.svelte';
  import Avatar from '../components/Avatar.svelte';
  import { CAMP_DRAGON_LAYER, CAMP_SCENE, campGreeting } from '../lib/world/scenes/camp';
  import { campStore, loadCatalog, refreshCamp } from '../lib/world/campStore.svelte';
  import { TINT_FILTERS } from '../lib/world/dragon';
  import { ART } from '../lib/world/art';
  import { markGreeted, shouldGreet } from '../lib/scene/greeting';
  import { isDebugMode } from '../lib/scene/debugMode';
  import type { DialogueLine, HotspotDef, SceneContext, SceneLayerDef } from '../lib/scene/types';
  import { initSound } from '../lib/juice/soundStore.svelte';
  import { playSfx, unlockAudio } from '../lib/juice/sfx';
  import { clearProfile } from '../lib/profileStore.svelte';
  import { formatSwissDate } from '../lib/dates';
  import { href } from '../lib/routes';
  import { navigate, router } from '../lib/router.svelte';
  import type { Profile } from '../lib/types';

  let { profile }: { profile: Profile } = $props();

  const profileId = $derived(String(profile.id));

  $effect(() => {
    initSound(profile);
    void refreshCamp(profile.id);
    void loadCatalog();
  });

  // campStore is shared across profiles: ignore a snapshot that belongs to the previous hero.
  const camp = $derived(campStore.data && campStore.data.profile.id === profile.id ? campStore.data : null);
  const ctx = $derived<SceneContext>({ camp, catalog: campStore.catalog });
  const panel = $derived(router.route.query.panel ?? null);
  const debug = $derived(isDebugMode(typeof location === 'undefined' ? '' : location.search, router.route.query));

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

  const nearestProphecy = $derived.by(() => {
    const list = camp?.prophecies ?? [];
    return list.length ? [...list].sort((a, b) => a.due_date.localeCompare(b.due_date))[0] : null;
  });

  function activate(def: HotspotDef) {
    unlockAudio();
    playSfx('tap');
    navigate(href(def.target, { profileId }));
  }

  function openHero() {
    unlockAudio();
    playSfx('tap');
    navigate(href('camp', { profileId }, { panel: 'heros' }));
  }

  function closePanel() {
    navigate(href('camp', { profileId }));
  }

  function review(textId: number) {
    navigate(href('play', { profileId, textId: String(textId) }));
  }
</script>

{#if !profile.settings.onboarded}
  <Onboarding {profile} />
{/if}

<SceneStage scene={CAMP_SCENE} {ctx}>
  {#snippet hud()}
    <Hud {profile} {camp} onHero={openHero} />
  {/snippet}

  {#if dragonLayer && camp}
    <SceneLayer layer={dragonLayer} filter={TINT_FILTERS[camp.dragon.tint]} testId="camp-dragon-layer" />
  {/if}

  {#each CAMP_SCENE.hotspots as def (def.id)}
    <Hotspot {def} status={def.state(ctx)} sceneId="camp" onActivate={activate} />
  {/each}

  <div class="camp-column" data-testid="camp-column">
    {#if camp}
      <p class="kit-banner weekly" data-testid="camp-weekly">
        <span class="leaves" aria-hidden="true">
          {#each Array.from({ length: camp.weekly.target }, (_, i) => i) as i (i)}<span
              class="leaf"
              class:filled={i < camp.weekly.done}>🌿</span
            >{/each}
        </span>
        <span>
          {#if camp.weekly.reached}
            Objectif atteint ! Les Muses sont fières.
          {:else}
            Objectif de la semaine : {camp.weekly.done} / {camp.weekly.target} textes
          {/if}
        </span>
      </p>
      {#if nearestProphecy}
        <div class="kit-parchment prophecy" data-testid="camp-prophecy">
          <p>
            Prophétie de l'Oracle : {nearestProphecy.title} — dictée le {formatSwissDate(nearestProphecy.due_date)}
            ({nearestProphecy.days_left === 0 ? "aujourd'hui" : `dans ${nearestProphecy.days_left} jour(s)`})
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

{#if panel === 'heros'}
  <Overlay variant="scroll" title="Ton héros" testId="overlay-heros" onClose={closePanel}>
    <div class="hero-panel">
      <Avatar avatar={profile.avatar} size={64} />
      <p class="hero-name">{profile.name}</p>
      <a class="kit-bronze" href={href('settings', { profileId })}>Réglages</a>
      <a class="kit-bronze" href={href('dossier', { profileId })}>Progrès</a>
      <a class="kit-bronze" href={href('profiles')} onclick={() => clearProfile()}>Changer de héros</a>
    </div>
  </Overlay>
{/if}

<style>
  /* Positioned in the zone free of every CAMP_HOTSPOTS shape box AND label (see camp.shapes.ts):
     a hotspot's label pill is wider than its shape and was measured (?debug, real boundingBox()es
     at both 1180x820 and 1366x1024) rather than assumed, since "below"/"above" labels extend well
     past their shape's own box. x 27-52% clears oracle's label (right edge measured up to ~25.1%)
     and quests' label (left edge measured down to ~55.8%); y 15-41%-ish clears the HUD band
     (< 14%) above and parchemins/bestiary (min y 44%) below.
     No `overflow`/`max-height` here on purpose (round 1 review): that combination scrolled
     « Réviser » out of view for a long prophecy title (the server allows up to 120 characters,
     server/app/schemas.py). The prophecy paragraph below is `-webkit-line-clamp`-ed instead, which
     bounds its own height regardless of title length, so the button after it is always laid out
     and always visible without ever needing to scroll the column. (The earlier "content grows past
     width: 25%" reading behind that `overflow` was also a misdiagnosis: SceneTransition zooms the
     whole art box in from scale 1.04 over 450ms - a transform, not layout - so a box measured
     mid-transition reads wider than its settled CSS width; there is no real overflow to guard.) */
  .camp-column {
    position: absolute;
    left: 27%;
    top: 15%;
    width: 25%;
    z-index: 3;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  .weekly {
    margin: 0;
    flex-wrap: wrap;
    font-size: 15px;
  }
  .leaf {
    filter: grayscale(1) opacity(0.5);
  }
  .leaf.filled {
    filter: none;
  }
  .prophecy {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 12px;
    font-size: 15px;
  }
  .prophecy p,
  .status p {
    margin: 0;
  }
  .prophecy p {
    /* Clamp instead of scroll (round 1 review): a 120-char title (the server's own max, see
       schemas.py) is still just 3 lines, not a box that grows past its column and pushes
       « Réviser » out of reach. -webkit-line-clamp only clips the box visually - the full text
       stays in the DOM, so it's still exposed in full to assistive tech. */
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    overflow: hidden;
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
</style>
