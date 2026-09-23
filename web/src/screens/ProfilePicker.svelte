<script lang="ts">
  import Avatar from '../components/Avatar.svelte';
  import { api, ApiError } from '../lib/api';
  import { href } from '../lib/routes';
  import { navigate } from '../lib/router.svelte';
  import type { Profile } from '../lib/types';

  let profiles = $state<Profile[]>([]);
  let loading = $state(true);
  let error = $state('');

  async function load() {
    loading = true;
    error = '';
    try {
      profiles = await api.profiles.list();
    } catch (e) {
      error = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
    } finally {
      loading = false;
    }
  }

  load();

  function pick(profile: Profile) {
    navigate(href('library', { profileId: String(profile.id) }));
  }

  function createNew() {
    navigate(href('profile-new'));
  }
</script>

<div class="screen">
  <h1>La Discorde</h1>
  <p class="subtitle muted">Choisis ton héros</p>

  {#if loading}
    <p class="muted">Les Muses cherchent les héros…</p>
  {:else if error}
    <p class="orange">Impossible de charger les héros : {error}</p>
  {:else if profiles.length === 0}
    <p class="muted">Aucun héros pour l'instant. Crée le tien !</p>
    <button type="button" class="card new-card" onclick={createNew}>+ Nouveau héros</button>
  {:else}
    <div class="grid">
      {#each profiles as profile (profile.id)}
        <button type="button" class="card profile-card" onclick={() => pick(profile)}>
          <Avatar avatar={profile.avatar} size={72} />
          <span class="name">{profile.name}</span>
          <span class="chip">{profile.level}</span>
        </button>
      {/each}
      <button type="button" class="card new-card" onclick={createNew}>+ Nouveau héros</button>
    </div>
  {/if}
</div>

<style>
  .subtitle {
    margin-top: -4px;
    margin-bottom: 24px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 16px;
  }
  .profile-card,
  .new-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 24px 16px;
    text-align: center;
  }
  .new-card {
    justify-content: center;
    min-height: 160px;
    color: var(--ink-soft);
    border-style: dashed;
  }
  .name {
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 600;
  }
</style>
