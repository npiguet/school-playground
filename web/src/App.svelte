<script lang="ts">
  import { untrack } from 'svelte';
  import { fade } from 'svelte/transition';
  import { router } from './lib/router.svelte';
  import { loadProfile, isUnlocked, profileStore } from './lib/profileStore.svelte';
  import { placeFor } from './lib/world/places';
  import { ApiError } from './lib/api';
  import PinGate from './components/PinGate.svelte';
  import Title from './screens/Title.svelte';
  import Camp from './screens/Camp.svelte';
  import LibraryTent from './screens/LibraryTent.svelte';
  import Delphi from './screens/Delphi.svelte';
  import Play from './screens/Play.svelte';
  import Stats from './screens/Stats.svelte';
  import Settings from './screens/Settings.svelte';
  import Dossier from './screens/Dossier.svelte';
  import Bestiaire from './screens/Bestiaire.svelte';
  import BestiaireEntry from './screens/BestiaireEntry.svelte';
  import Lieutenant from './screens/Lieutenant.svelte';
  import Boss from './screens/Boss.svelte';
  import DragonScreen from './screens/DragonScreen.svelte';
  import Cabin from './screens/Cabin.svelte';

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
  // screen it leads to then rises out of that night instead of cutting in.
  let arriving = $state(false);
  let lastRoute = untrack(() => route.name);
  $effect(() => {
    const name = route.name;
    const from = lastRoute;
    lastRoute = name;
    if (from !== 'camp' || name === 'camp') return;
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
      <div class="screen"><p class="muted">Les Muses cherchent ce héros…</p></div>
    {:else if gateError}
      <div class="screen"><p class="orange">Impossible de charger ce héros : {gateError}</p></div>
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
      {:else if route.name === 'play'}
        <Play profile={gateProfile} textId={route.params.textId} query={route.query} />
      {:else if route.name === 'grimoire'}
        <Play profile={gateProfile} textId={route.params.textId} mode="grimoire" query={route.query} />
      {:else if route.name === 'stats'}
        <Stats profile={gateProfile} />
      {:else if route.name === 'settings'}
        <Settings profile={gateProfile} />
      {:else if route.name === 'dossier'}
        <Dossier profile={gateProfile} />
      {:else if route.name === 'bestiaire'}
        <Bestiaire profile={gateProfile} />
      {:else if route.name === 'bestiaire-entry'}
        <BestiaireEntry profile={gateProfile} entryKey={route.params.key} />
      {:else if route.name === 'lieutenant'}
        <Lieutenant profile={gateProfile} lieutenantKey={route.params.key} />
      {:else if route.name === 'boss'}
        <Boss profile={gateProfile} />
      {:else if route.name === 'dragon'}
        <DragonScreen profile={gateProfile} />
      {:else if route.name === 'cabin'}
        <Cabin profile={gateProfile} />
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
</style>
