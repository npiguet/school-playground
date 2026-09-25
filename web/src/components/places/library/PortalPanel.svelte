<script lang="ts">
  // Bibliothèque d'Alexandrie (spec §5 SP2, "Decisions" #9/#12): browse the allowlisted
  // public-domain works so a player can adopt a scored chunk ("rouleau") as a parchemin.
  // UI3a Task 11: opened as an overlay of the library tent (panel 'portail') rather than a full
  // screen - the painted hero banner below is the view through the portal itself.
  import { tick } from 'svelte';
  import { api, ApiError } from '../../../lib/api';
  import { href } from '../../../lib/routes';
  import { openPanel } from '../../../lib/scene/panelNav';
  import type { AlexandriaWork, Profile } from '../../../lib/types';

  // `focusWorkId`: fix round 2 finding 4. Closing the work overlay remounts this panel fresh, and
  // Overlay's own `modal.destroy()` return-focus fires ~160ms after that (its local `out:leave`) -
  // a fixed delay that races this panel's own `works` fetch. Rather than guess a delay, LibraryTent
  // passes the work id to return to (only when actually coming back from one) and this panel moves
  // focus onto that card itself, once `works` has actually rendered - deterministic regardless of
  // how long the fetch took. Overlay's own `returnFocus` (targeting the same card) stays as a
  // harmless, purely opportunistic fallback for whichever case is faster.
  let { profile, focusWorkId }: { profile: Profile; focusWorkId?: string } = $props();

  let works = $state<AlexandriaWork[]>([]);
  let loading = $state(true);
  let error = $state('');

  async function load() {
    loading = true;
    error = '';
    try {
      works = await api.alexandria.works();
    } catch (e) {
      error = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
    } finally {
      loading = false;
    }
  }

  load();

  let focused = false;
  $effect(() => {
    if (focused || !focusWorkId || loading || works.length === 0) return;
    focused = true;
    const id = focusWorkId;
    tick().then(() => {
      document.querySelector<HTMLElement>(`[data-testid="work-card"][data-work-id="${id}"]`)?.focus();
    });
  });

  function statusLabel(w: AlexandriaWork): string {
    if (w.status === 'never') return 'Pas encore recopié';
    if (w.status === 'error') return "Hors d'atteinte";
    return `${w.chunk_count} rouleaux`;
  }

  function openWork(w: AlexandriaWork) {
    openPanel(href('alexandria-work', { profileId: String(profile.id), workId: w.id }));
  }
</script>

<div class="panel-portal">
  <div class="hero" role="presentation"></div>
  <p class="subtitle muted">
    Les scribes d'Alexandrie recopient des œuvres anciennes. Choisis une œuvre, puis un rouleau à
    ajouter aux Parchemins.
  </p>

  {#if loading}
    <p class="muted">Les Muses cherchent les scribes…</p>
  {:else if error}
    <p class="orange">Impossible de joindre la Bibliothèque : {error}</p>
  {:else}
    <div class="grid">
      {#each works as w (w.id)}
        <button
          type="button"
          class="card work-card"
          data-testid="work-card"
          data-work-id={w.id}
          onclick={() => openWork(w)}
        >
          <span class="title">{w.title}</span>
          <span class="credits muted">{w.credits}</span>
          <span class="chips">
            <span class="chip">niveau {w.level_hint}</span>
            <span class="chip" class:chip-error={w.status === 'error'}>{statusLabel(w)}</span>
          </span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .hero {
    height: 140px;
    border-radius: var(--radius);
    background-image: url('/art/scenes/alexandrie.webp');
    background-size: cover;
    background-position: center;
    margin-bottom: 16px;
  }
  .subtitle {
    margin-top: 0;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 16px;
  }
  .work-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .title {
    font-family: var(--font-display);
    font-size: 19px;
    font-weight: 600;
  }
  .credits {
    font-size: 14px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 4px;
  }
  .chips .chip {
    cursor: default;
    min-height: unset;
    padding: 3px 10px;
    font-size: 13px;
  }
  .chip-error {
    border-color: var(--orange);
    color: var(--orange);
    font-weight: 600;
  }
</style>
