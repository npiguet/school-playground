<script lang="ts">
  import TopBar from '../components/TopBar.svelte';
  import type { Profile } from '../lib/types';

  // Placeholder screen (Task 12 replaces it with the real stats page).
  let { profile }: { profile: Profile } = $props();
</script>

<TopBar {profile} title="Progrès" />

<div class="screen">
  <p class="muted">Tes progrès arrivent bientôt.</p>
</div>
