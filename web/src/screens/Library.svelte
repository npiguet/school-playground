<script lang="ts">
  import TopBar from '../components/TopBar.svelte';
  import AddMenu from '../components/AddMenu.svelte';
  import { api, ApiError } from '../lib/api';
  import { formatSwissDate, isProphecy } from '../lib/dates';
  import { levelIndex, LEVELS } from '../lib/levels';
  import { href } from '../lib/routes';
  import { navigate } from '../lib/router.svelte';
  import type { Profile, TextSummary } from '../lib/types';

  let { profile }: { profile: Profile } = $props();

  let texts = $state<TextSummary[]>([]);
  let loading = $state(true);
  let error = $state('');
  let levelFilter = $state<string>('Tous');
  let menuOpen = $state(false);

  async function load() {
    loading = true;
    error = '';
    try {
      texts = await api.texts.list(profile.id);
    } catch (e) {
      error = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
    } finally {
      loading = false;
    }
  }

  load();

  function credits(t: TextSummary): string {
    if (t.credits) return t.credits;
    if (t.source === 'custom' && t.added_by_name) return `Ajouté par ${t.added_by_name}`;
    return '';
  }

  function historyLine(t: TextSummary): string {
    if (!t.history || t.history.times_played === 0) return 'Jamais joué';
    const n = t.history.times_played;
    if (t.history.best_catch_rate === null || t.history.best_catch_rate === undefined) {
      return `Joué ${n}×`;
    }
    const pct = Math.round(t.history.best_catch_rate * 100);
    return `Joué ${n}× · meilleur taux de pièges déjoués ${pct} %`;
  }

  function play(t: TextSummary) {
    navigate(href('play', { profileId: String(profile.id), textId: String(t.id) }));
  }

  const filtered = $derived(
    levelFilter === 'Tous' ? texts : texts.filter((t) => t.level === levelFilter),
  );

  const sortByLevelThenTitle = (a: TextSummary, b: TextSummary) =>
    levelIndex(a.level) - levelIndex(b.level) || a.title.localeCompare(b.title, 'fr');

  // Prophecies (dictées préparées whose due date has not passed yet, spec's
  // "Decisions" #14) get their own top section in the "Tous" view and are
  // excluded from the two sections below so they aren't shown twice.
  const prophecies = $derived(
    texts
      .filter((t) => isProphecy(t.due_date))
      .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? '')),
  );
  const prophecyIds = $derived(new Set(prophecies.map((t) => t.id)));
  const ownLevel = $derived(
    texts.filter((t) => t.level === profile.level && !prophecyIds.has(t.id)).sort(sortByLevelThenTitle),
  );
  const otherLevels = $derived(
    texts.filter((t) => t.level !== profile.level && !prophecyIds.has(t.id)).sort(sortByLevelThenTitle),
  );
</script>

<TopBar {profile} title="Les Parchemins" />

<div class="screen library-screen">
  <p class="subtitle muted">Choisis un texte à protéger des dés-accords d'Éris.</p>

  <div class="filters">
    <button
      type="button"
      class="chip"
      class:chip-active={levelFilter === 'Tous'}
      onclick={() => (levelFilter = 'Tous')}
    >
      Tous
    </button>
    {#each LEVELS as l (l)}
      <button
        type="button"
        class="chip"
        class:chip-active={levelFilter === l}
        onclick={() => (levelFilter = l)}
      >
        {l}
      </button>
    {/each}
  </div>

  {#snippet textCard(t: TextSummary)}
    <button type="button" class="card text-card" data-testid="text-card" onclick={() => play(t)}>
      <span class="title">{t.title}</span>
      {#if credits(t)}<span class="credits muted">{credits(t)}</span>{/if}
      <span class="chips">
        <span class="chip">{t.level}</span>
        <span class="chip">≈ {t.word_count} mots</span>
        {#if t.source === 'scan'}<span class="chip chip-scan">Scanné</span>{/if}
        {#if t.source === 'online'}<span class="chip chip-online">Alexandrie</span>{/if}
        {#if t.due_date && isProphecy(t.due_date)}
          <span class="chip chip-prophecy" data-testid="chip-prophecy"
            >Prophétie : {formatSwissDate(t.due_date)}</span
          >
        {/if}
      </span>
      <span class="history muted">{historyLine(t)}</span>
    </button>
  {/snippet}

  {#if loading}
    <p class="muted">Les Muses déroulent les parchemins…</p>
  {:else if error}
    <p class="orange">Impossible de lire les parchemins : {error}</p>
  {:else if levelFilter === 'Tous'}
    <section>
      {#if prophecies.length > 0}
        <section class="prophecies">
          <h2>Prophéties de l'Oracle</h2>
          <p class="subtitle muted">Les dictées préparées pour l'école, à réviser avant le jour dit.</p>
          <div class="grid">
            {#each prophecies as t (t.id)}
              {@render textCard(t)}
            {/each}
          </div>
        </section>
      {/if}
      <h2>À ton niveau ({profile.level})</h2>
      <div class="grid">
        {#each ownLevel as t (t.id)}
          {@render textCard(t)}
        {/each}
      </div>
      <h2>Autres parchemins</h2>
      <div class="grid">
        {#each otherLevels as t (t.id)}
          {@render textCard(t)}
        {/each}
      </div>
    </section>
  {:else}
    <div class="grid">
      {#each filtered.slice().sort(sortByLevelThenTitle) as t (t.id)}
        {@render textCard(t)}
      {/each}
    </div>
  {/if}

  <button
    type="button"
    class="btn btn-primary fab"
    data-testid="btn-add-text"
    onclick={() => (menuOpen = true)}
  >
    + Ajouter un texte
  </button>
</div>

<AddMenu profileId={profile.id} bind:open={menuOpen} />

<style>
  /* Two classes for higher specificity than the global .screen rule (P1-7: the FAB
     was overlapping the last row of cards in both iPad orientations because the
     global padding-bottom could win the cascade). The FAB itself is ~48px tall,
     sitting 16px + safe-area above the edge with a drop shadow - 96px clears it
     with margin to spare. */
  .screen.library-screen {
    padding-bottom: calc(96px + env(safe-area-inset-bottom));
  }
  .subtitle {
    margin-top: 0;
  }
  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 20px;
  }
  /* Interactive level-filter chips need a full touch target; the decorative
     .chips spans on text cards (below) stay compact via their own override. */
  .filters .chip {
    min-height: 48px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }
  .text-card {
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
    margin: 4px 0;
  }
  .chips .chip {
    cursor: default;
    min-height: unset;
    padding: 3px 10px;
    font-size: 13px;
  }
  .chip-scan {
    border-color: var(--olive);
    color: var(--olive);
  }
  .chip-online {
    border-color: var(--aegean);
    color: var(--aegean);
  }
  .chip-prophecy {
    border-color: var(--gold);
    color: var(--gold);
    font-weight: 600;
  }
  .prophecies {
    margin-bottom: 8px;
  }
  .history {
    font-size: 13px;
  }
  .fab {
    position: fixed;
    right: calc(16px + env(safe-area-inset-right));
    bottom: calc(16px + env(safe-area-inset-bottom));
    box-shadow: 0 2px 10px rgba(43, 42, 40, 0.25);
    z-index: 10;
  }
</style>
