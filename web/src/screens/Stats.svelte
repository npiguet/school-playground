<script lang="ts">
  // The stats screen (spec §3.6 "Éris keeps a file on each player: « Ses points faibles »"):
  // per-category catch rate, mots-pièges and recent sessions, loaded from the server.
  import TopBar from '../components/TopBar.svelte';
  import { api, ApiError } from '../lib/api';
  import { CATEGORY_LABELS } from '../lib/explain';
  import type { StatKey } from '../lib/grading/types';
  import type { CategoryRow, Profile, StatsResponse } from '../lib/types';

  let { profile }: { profile: Profile } = $props();

  let stats = $state<StatsResponse | null>(null);
  let loading = $state(true);
  let error = $state('');

  async function load() {
    loading = true;
    error = '';
    try {
      stats = await api.profiles.stats(profile.id);
    } catch (e) {
      error = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
    } finally {
      loading = false;
    }
  }

  load();

  const HELP_STAGE_DESCRIPTIONS: Record<number, string> = {
    1: "1 — Les Yeux d'Argus éclairent chaque catégorie.",
    2: '2 — Les passes sont nommées, sans lumière.',
    3: '3 — Seul le nombre de pièges est annoncé.',
    4: '4 — Comme en classe : à toi de jouer.',
  };

  function categoryLabel(category: string): string {
    return CATEGORY_LABELS[category as StatKey] ?? category;
  }

  function pct(rate: number | null): string {
    return rate === null ? '—' : `${Math.round(100 * rate)} %`;
  }

  function formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}.${mm}`;
  }

  const categories = $derived((stats?.categories ?? []).filter((c: CategoryRow) => c.errors_in_draft > 0));
</script>

<TopBar {profile} title="Progrès" />

<div class="screen">
  <p class="subtitle muted">
    Ce qu'Éris note dans son dossier « Ses points faibles »… et ce qu'elle préfère taire.
  </p>

  {#if loading}
    <p class="muted">Les Muses consultent le dossier…</p>
  {:else if error}
    <p class="orange">Impossible de lire les progrès : {error}</p>
  {:else if stats}
    <section class="card help-stage">
      <h2>Aide des Muses : niveau {stats.profile.help_stage} sur 4</h2>
      <p class="muted">{HELP_STAGE_DESCRIPTIONS[stats.profile.help_stage] ?? ''}</p>
    </section>

    <h2>Par catégorie</h2>
    {#if categories.length === 0}
      <p class="muted">Éris n'a encore rien noté. Joue un texte !</p>
    {:else}
      <table class="cat-table">
        <thead>
          <tr>
            <th>Catégorie</th>
            <th>Pièges rencontrés</th>
            <th>Déjoués</th>
            <th>Taux</th>
          </tr>
        </thead>
        <tbody>
          {#each categories as c (c.category)}
            <tr>
              <td>{categoryLabel(c.category)}</td>
              <td>{c.errors_in_draft}</td>
              <td>{c.caught}</td>
              <td>{pct(c.catch_rate)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}

    <h2>Mots-pièges</h2>
    {#if stats.trap_words.length === 0}
      <p class="muted">Aucun mot-piège pour l'instant.</p>
    {:else}
      <div class="chips">
        {#each stats.trap_words as w (w.word)}
          <span class="chip trap" title={`boîte ${w.box}`}>{w.word}<span class="muted">boîte {w.box}</span></span>
        {/each}
      </div>
    {/if}

    <h2>Dernières parties</h2>
    {#if stats.recent_sessions.length === 0}
      <p class="muted">Aucune partie jouée pour l'instant.</p>
    {:else}
      <ul class="sessions">
        {#each stats.recent_sessions as s (s.id)}
          <li>
            {s.title} · {formatDate(s.finished_at)} · {s.score} pts · {pct(s.catch_rate)}
            {#if s.mode === 'grimoire'}<span class="chip chip-mode">Grimoire</span>{/if}
          </li>
        {/each}
      </ul>
    {/if}

    <h2>Totaux</h2>
    <p>{stats.totals.sessions} parties · {stats.totals.score} points · {stats.totals.caught} pièges déjoués</p>
  {/if}
</div>

<style>
  .subtitle {
    margin-top: 0;
  }
  .help-stage {
    cursor: default;
    margin-bottom: 16px;
  }
  .help-stage h2 {
    margin: 0 0 4px;
  }
  .help-stage p {
    margin: 0;
  }
  h2 {
    margin-top: 24px;
  }
  .cat-table {
    width: 100%;
    border-collapse: collapse;
  }
  .cat-table th,
  .cat-table td {
    text-align: left;
    padding: 8px 10px;
    border-bottom: 1px solid var(--marble-dark);
  }
  .cat-table th {
    color: var(--ink-soft);
    font-weight: 600;
    font-size: 14px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .chip.trap {
    cursor: default;
    display: flex;
    gap: 6px;
    align-items: baseline;
  }
  .sessions {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .sessions li {
    background: #fff;
    border: 1px solid var(--marble-dark);
    border-radius: var(--radius);
    padding: 10px 14px;
  }
  .chip-mode {
    cursor: default;
    margin-left: 8px;
    min-height: auto;
    padding: 2px 10px;
    font-size: 13px;
  }
</style>
