<script lang="ts">
  import { router } from './lib/router.svelte';
  import { loadProfile, isUnlocked, profileStore } from './lib/profileStore.svelte';
  import { ApiError } from './lib/api';
  import PinGate from './components/PinGate.svelte';
  import ProfilePicker from './screens/ProfilePicker.svelte';
  import ProfileCreate from './screens/ProfileCreate.svelte';
  import Camp from './screens/Camp.svelte';
  import Library from './screens/Library.svelte';
  import TextCreate from './screens/TextCreate.svelte';
  import ScanText from './screens/ScanText.svelte';
  import Alexandria from './screens/Alexandria.svelte';
  import AlexandriaWork from './screens/AlexandriaWork.svelte';
  import Play from './screens/Play.svelte';
  import Stats from './screens/Stats.svelte';
  import Settings from './screens/Settings.svelte';

  const route = $derived(router.route);
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
</script>

{#if route.name === 'profiles'}
  <ProfilePicker />
{:else if route.name === 'profile-new'}
  <ProfileCreate />
{:else if profileId !== null}
  {#key profileId}
    {#if gateLoading && !gateProfile}
      <div class="screen"><p class="muted">Les Muses cherchent ce héros…</p></div>
    {:else if gateError}
      <div class="screen"><p class="orange">Impossible de charger ce héros : {gateError}</p></div>
    {:else if gateProfile}
      {#if gateProfile.has_pin && !unlocked}
        <PinGate profile={gateProfile} {onUnlocked} />
      {:else if route.name === 'camp'}
        <Camp profile={gateProfile} />
      {:else if route.name === 'library'}
        <Library profile={gateProfile} />
      {:else if route.name === 'text-new'}
        <TextCreate profile={gateProfile} />
      {:else if route.name === 'text-scan'}
        <ScanText profile={gateProfile} />
      {:else if route.name === 'alexandria'}
        <Alexandria profile={gateProfile} />
      {:else if route.name === 'alexandria-work'}
        <AlexandriaWork profile={gateProfile} workId={route.params.workId} />
      {:else if route.name === 'play'}
        <Play profile={gateProfile} textId={route.params.textId} />
      {:else if route.name === 'grimoire'}
        <Play profile={gateProfile} textId={route.params.textId} mode="grimoire" />
      {:else if route.name === 'stats'}
        <Stats profile={gateProfile} />
      {:else if route.name === 'settings'}
        <Settings profile={gateProfile} />
      {/if}
    {/if}
  {/key}
{/if}
