<script lang="ts">
  import TopBar from '../components/TopBar.svelte';
  import { api, ApiError } from '../lib/api';
  import type { Profile } from '../lib/types';

  // Placeholder screen (Task 10 replaces it with the dictation + proofreading flow).
  let { profile, textId }: { profile: Profile; textId: string } = $props();

  let title = $state('');
  let error = $state('');

  async function load() {
    error = '';
    try {
      const text = await api.texts.get(Number(textId));
      title = text.title;
    } catch (e) {
      error = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
    }
  }

  load();
</script>

<TopBar {profile} />

<div class="screen">
  {#if error}
    <p class="orange">Impossible de charger ce parchemin : {error}</p>
  {:else}
    <h1>{title}</h1>
    <p class="muted">La dictée arrive au prochain chapitre.</p>
  {/if}
</div>
