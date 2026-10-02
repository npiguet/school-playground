<script lang="ts">
  import { untrack } from 'svelte';
  import { fade } from 'svelte/transition';
  import { router } from './lib/router.svelte';
  import { loadProfile, isUnlocked, profileStore } from './lib/profileStore.svelte';
  import { placeFor } from './lib/world/places';
  import { ApiError } from './lib/api';
  import { battleKey, href } from './lib/routes';
  import PinGate from './components/PinGate.svelte';
  import Title from './screens/Title.svelte';
  import Camp from './screens/Camp.svelte';
  import LibraryTent from './screens/LibraryTent.svelte';
  import Delphi from './screens/Delphi.svelte';
  import WarTent from './screens/WarTent.svelte';
  import Nest from './screens/Nest.svelte';
  import CabinRoom from './screens/CabinRoom.svelte';

  // The battle screens (Play, Boss and the battle stage under them, about a third of the game's code)
  // are their own chunks, so the entry chunk stays under Vite's 500 kB warning (living dragon plan,
  // Task 7, ruling O1). They load as soon as a hero is open, well before a battle is asked for; a
  // load that fails (offline, or a tab kept open across an update whose chunks have new names) offers
  // a reload instead of a blank page.
  type BattleScreens = {
    Play: typeof import('./screens/Play.svelte').default;
    Boss: typeof import('./screens/Boss.svelte').default;
  };
  let battleScreens = $state<BattleScreens | null>(null);
  let battleFailed = $state(false);
  let battleLoading = false;
  function loadBattleScreens(): void {
    if (battleScreens || battleLoading) return;
    battleLoading = true;
    battleFailed = false;
    Promise.all([import('./screens/Play.svelte'), import('./screens/Boss.svelte')])
      .then(([play, boss]) => (battleScreens = { Play: play.default, Boss: boss.default }))
      .catch(() => (battleFailed = true))
      .finally(() => (battleLoading = false));
  }

  const route = $derived(router.route);
  const view = $derived(placeFor(route));
  const profileId = $derived(route.params.profileId ? Number(route.params.profileId) : null);

  let gateLoading = $state(false);
  let gateError = $state('');
  let unlocked = $state(false);

  // Loads (or reloads) the profile a `/p/:profileId/...` route needs, and
  // resets the PIN unlock flag whenever the profile id in the URL changes.
  $effect(() => {
    const id = profileId;
    if (id === null) return;
    untrack(loadBattleScreens);
    gateLoading = true;
    gateError = '';
    unlocked = isUnlocked(id);
    loadProfile(id)
      .catch((e) => {
        gateError = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
      })
      .finally(() => {
        gateLoading = false;
      });
  });

  const gateProfile = $derived(
    profileId !== null && profileStore.current?.id === profileId ? profileStore.current : null,
  );

  function onUnlocked() {
    unlocked = true;
  }

  // Playability #12: the camp fades to night before it hands over (Camp.svelte's exit veil); the
  // screen it leads to then rises out of that night instead of cutting in. UI3b playability #18: so
  // does the hero chip from any other place (PlaceScene.svelte's veil): the cabin rises behind the
  // hero's scroll instead of cutting in.
  let arriving = $state(false);
  let lastRoute = untrack(() => route.name);
  $effect(() => {
    const name = route.name;
    const from = lastRoute;
    lastRoute = name;
    const fromCamp = from === 'camp' && name !== 'camp';
    const heroHandOff = name === 'cabin' && route.query.panel === 'heros' && from !== 'cabin';
    if (!fromCamp && !heroHandOff) return;
    arriving = true;
    const t = setTimeout(() => (arriving = false), 30);
    return () => clearTimeout(t);
  });
</script>

{#if view?.place === 'title'}
  <!-- UI3 Ruling A1: one Title instance for #/, #/?panel=tous and #/profiles/new, so opening an
       overlay never replays the scene's entry. -->
  <Title panel={view.panel} />
{:else if profileId !== null}
  {#key profileId}
    {#if gateLoading && !gateProfile}
      <div class="gate-night"><p class="kit-ribbon" data-testid="gate-loading">Les Muses cherchent ce héros…</p></div>
    {:else if gateError}
      <div class="gate-night" role="alert">
        <p class="kit-ribbon" data-testid="gate-error">Impossible de rejoindre ce héros{'\u202f: '}{gateError}</p>
        <a class="kit-bronze" href={href('profiles')}>Changer de héros</a>
      </div>
    {:else if gateProfile}
      {#if gateProfile.has_pin && !unlocked}
        <PinGate profile={gateProfile} {onUnlocked} />
      {:else if view?.place === 'camp'}
        <!-- Final review M2: the camp gets its panel from placeFor, like every place below. -->
        <Camp profile={gateProfile} panel={view.panel} />
      {:else if view?.place === 'library'}
        <!-- UI3a Task 9, Ruling A1: the tent scene and its overlays (`library-tent`, `library`,
             `text-new`, `text-scan`, `alexandria`, `alexandria-work`) share one place branch (not
             one per route.name, as above), so opening or closing an overlay never remounts
             LibraryTent and replays its entry zoom (Ruling 5: see scenes-library.spec.ts "the
             place stays mounted..."). Task 10 moved the desk and the lens in as overlays; Task 11
             did the same for the portal and its works, so every library route now goes through
             this one instance. -->
        <LibraryTent profile={gateProfile} panel={view.panel} params={route.params} />
      {:else if view?.place === 'delphi'}
        <!-- UI3a Task 12, same reasoning as the library branch above: the temple scene and its
             overlays (`delphi`, `oracle`, `quests`) share one place branch so opening or closing
             the Pythia's or the tablets' overlay never remounts Delphi and replays its entry zoom. -->
        <Delphi profile={gateProfile} panel={view.panel} />
      {:else if view?.place === 'war'}
        <!-- UI3b Tasks 2-3, same reasoning as the library branch: the tent and its overlays
             (`war-tent`, `lieutenant`, `dossier`, `bestiaire`, `bestiaire-entry`) share one place
             branch, so opening or closing a sheet, the file or the codex never remounts WarTent. -->
        <WarTent profile={gateProfile} panel={view.panel} params={route.params} />
      {:else if view?.place === 'nest'}
        <Nest profile={gateProfile} panel={view.panel} />
      {:else if view?.place === 'cabin'}
        <CabinRoom profile={gateProfile} panel={view.panel} />
      <!-- The battle routes render the battle stage (UI4); Play stays mounted across its phases and its « Revoir » panel (Ruling C1). -->
      <!-- Keyed on the battle (text, mode, quest, encounter, help, focus; not the panel): play/A to
           play/B in the app, or Back and Forward between them, is a fresh battle. -->
      {:else if (route.name === 'play' || route.name === 'grimoire' || route.name === 'boss') && !battleScreens}
        <!-- The battle screens' chunks, still loading (the night backdrop) or failed (a reload). -->
        <div
          class="gate-night"
          role={battleFailed ? 'alert' : undefined}
          aria-busy={battleFailed ? undefined : 'true'}
          data-testid="battle-loading"
        >
          {#if battleFailed}
            <p class="kit-ribbon">Impossible de charger le combat.</p>
            <button class="kit-bronze" type="button" onclick={() => location.reload()}>Recharger</button>
          {:else}
            <p class="kit-ribbon">Les Muses préparent le combat…</p>
          {/if}
        </div>
      {:else if route.name === 'play' && battleScreens}
        {#key battleKey(route)}
          <battleScreens.Play profile={gateProfile} textId={route.params.textId} query={route.query} />
        {/key}
      {:else if route.name === 'grimoire' && battleScreens}
        {#key battleKey(route)}
          <battleScreens.Play profile={gateProfile} textId={route.params.textId} mode="grimoire" query={route.query} />
        {/key}
      {:else if route.name === 'boss' && battleScreens}
        <battleScreens.Boss profile={gateProfile} />
      {/if}
    {/if}
  {/key}
{/if}

{#if arriving}
  <div class="arrive-veil" aria-hidden="true" out:fade={{ duration: 320 }}></div>
{/if}

<style>
  .arrive-veil {
    position: fixed;
    inset: 0;
    z-index: 60;
    background: var(--night);
    pointer-events: none;
  }

  /* UI3 Ruling B7: the profile gate's states on the night stage colour, never a white page. */
  .gate-night {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 24px;
    background: var(--night);
    text-align: center;
  }
</style>
